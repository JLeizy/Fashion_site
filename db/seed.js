// npm run db:seed — наполнение базы тестовыми данными (раздел 3.8 ТЗ).
// Всё выполняется в ОДНОЙ транзакции: сначала TRUNCATE всех таблиц, затем вставка.
// Генератор детерминированный (собственный ГПСЧ), поэтому каждый запуск даёт одинаковые данные.
// Движение остатков моделируется по правилам раздела 3.3:
//   приёмка (income) → резерв при оформлении (reserve) → списание при передаче в доставку (outcome);
//   отмена до передачи в доставку — снятие резерва (unreserve); принятый возврат — return.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import bcrypt from 'bcrypt';
import { config } from '../config/index.js';
import { ensureEmbeddedPostgres, stopEmbeddedPostgres } from './embedded.js';
import { BRANDS } from './seed-data/brands.js';
import { CATEGORIES, SUBCATEGORY_INFO } from './seed-data/categories.js';
import { SIZES, sizeLabelsFor } from './seed-data/sizes.js';
import { MODELS } from './seed-data/models.js';
import { BRAND_VOICE, CATEGORY_SENTENCE, MATERIAL_SENTENCE, composition, care, COLLECTION_TEXT, REVIEW_TEXTS, REVIEW_DETAIL } from './seed-data/texts.js';
import { STAFF, BUYERS, ROLES, TEST_PASSWORD } from './seed-data/users.js';
import { loadHistories } from './content/index.js';
import { preferPhoto, photoOnly } from './imagePath.js';
import { ruName } from '../scripts/lib/catalog-rules.js';
import { makeTrackingNumber } from '../server/lib/tracking.js';
import { orderStatusNotification, ticketReplyNotification, sellerApplicationNotification, returnDecisionNotification, productModerationNotification } from '../server/services/notificationTexts.js';

const PRODUCTS_PER_BRAND = 60;
const ORDER_COUNT = 300;
const NOW = Date.now();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// ---------------------------------------------------------------------
// Детерминированный генератор случайных чисел (mulberry32)
// ---------------------------------------------------------------------
function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(19882026);
const randInt = (min, max) => min + Math.floor(rand() * (max - min + 1));
const randFloat = (min, max) => min + rand() * (max - min);
const pick = (list) => list[Math.floor(rand() * list.length)];
const chance = (p) => rand() < p;
function weighted(pairs) {
  const total = pairs.reduce((sum, [, w]) => sum + w, 0);
  let r = rand() * total;
  for (const [value, w] of pairs) {
    r -= w;
    if (r <= 0) return value;
  }
  return pairs[pairs.length - 1][0];
}
function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
const round10 = (value) => Math.round(value / 10) * 10;
const money = (value) => Math.round(value * 100) / 100;
const ts = (ms) => new Date(ms).toISOString();
const dateOnly = (ms) => new Date(ms).toISOString().slice(0, 10);
const PUBLIC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const slugify = (text) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Реальный каталог (npm run catalog): db/content/catalog/<бренд>.json — каждая запись = конкретная вещь из магазина,
// фото, название, цвет и категория которой взяты из одной карточки. Русские названия — db/content/catalog-ru.json.
const CONTENT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'content');
const readCatalog = (slug) => {
  const file = path.join(CONTENT_DIR, 'catalog', `${slug}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
};
const CATALOG_RU = fs.existsSync(path.join(CONTENT_DIR, 'catalog-ru.json')) ? JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, 'catalog-ru.json'), 'utf8')) : {};
// Культовые модели брендов — по словам в названии реальной вещи
const ICONIC = {
  balenciaga: /triple s|speed|le cagole|hourglass|le city|\bcity\b|track/i, vetements: /dhl|antwerpen|polizei|limited edition/i,
  gucci: /horsebit|jackie|dionysus|marmont|bamboo|ace\b|ophidia|interlocking/i, prada: /re-edition|re-nylon|galleria|cleo|monolith|triangle/i,
  'enfants-riches-deprimes': /logo|classic/i, avavav: /x-ray|nun/i, supreme: /box logo|box/i, 'chrome-hearts': /cross|dagger|keeper|forever|floral|baby fat|\+22\+/i,
  'louis-vuitton': /speedy|neverfull|keepall|alma|pochette|monogram/i, chanel: /classic|flap|2\.55|boy|chanel 22|chanel 25|slingback|ballerina|ballet/i,
  'maison-margiela': /tabi|5ac|glam slam|replica|gat\b/i, givenchy: /antigona|voyou|4g|shark|g-tote|pandora/i,
  versace: /medusa|barocco|greca|la greca/i, 'alexander-mcqueen': /oversized|seal|skull|knuckle/i, 'loro-piana': /summer walk|open walk|extra pocket|baby cashmere|l27/i,
};
// Цена, если в источнике её нет (фото из SSENSE): средняя цена той же категории у бренда в исходном списке моделей
function fallbackPrice(slug, cat) {
  const list = (MODELS[slug] || []).filter((m) => m[1] === cat).map((m) => m[4]);
  const any = Object.values(MODELS).flat().filter((m) => m[1] === cat).map((m) => m[4]);
  const src = list.length ? list : any;
  return src.length ? round10(src.reduce((a, b) => a + b, 0) / src.length) : 1500;
}
const CATEGORY_NOUN_RU = Object.fromEntries(CATEGORIES.flatMap((r) => r.children.map((c) => [c.slug, c.name_ru])));

// Пакетная вставка: один параметризованный INSERT … VALUES ($1,$2…),(…) на порцию строк
async function insertMany(client, table, columns, rows, returning = null, chunk = 400) {
  const result = [];
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    const params = [];
    const values = part.map((row) => `(${row.map((value) => { params.push(value); return `$${params.length}`; }).join(', ')})`);
    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${values.join(', ')}${returning ? ` RETURNING ${returning}` : ''}`;
    const { rows: inserted } = await client.query(sql, params);
    result.push(...inserted);
  }
  return result;
}

const COUNTRY_RU = { BY: 'Беларусь', RU: 'Россия', KZ: 'Казахстан', AM: 'Армения', UZ: 'Узбекистан', KG: 'Кыргызстан', AZ: 'Азербайджан', TJ: 'Таджикистан', MD: 'Молдова', GE: 'Грузия' };

function formatAddress(a) {
  const flat = a.apartment ? `, кв. ${a.apartment}` : '';
  return `${a.recipient}, ${a.phone}\n${COUNTRY_RU[a.country] || a.country}, ${a.postal_code || ''} ${a.city}\n${a.street}, д. ${a.house}${flat}`.replace(/ {2,}/g, ' ');
}

const ALT_COUNTRIES = {
  balenciaga: ['IT', 'IT', 'ES', 'PT'], vetements: ['PT', 'PT', 'IT'], gucci: ['IT'], prada: ['IT', 'IT', 'RO'],
  'enfants-riches-deprimes': ['US', 'US', 'FR', 'IT'], avavav: ['IT', 'IT', 'PT'], supreme: ['US', 'US', 'CA', 'CN'],
  'chrome-hearts': ['US'], 'louis-vuitton': ['FR', 'FR', 'ES', 'IT', 'US'], chanel: ['FR', 'FR', 'IT'],
  'maison-margiela': ['IT', 'IT', 'RO'], givenchy: ['IT', 'IT', 'FR', 'PT'], versace: ['IT'], 'alexander-mcqueen': ['IT', 'IT', 'GB'], 'loro-piana': ['IT'],
};

const CATEGORY_GROUP = (slug) => {
  const parent = SUBCATEGORY_INFO[slug]?.parent;
  if (parent === 'shoes') return 'shoes';
  if (parent === 'bags') return 'bags';
  if (parent === 'jewelry') return 'jewelry';
  if (parent === 'fragrance') return 'fragrance';
  if (parent === 'accessories') return 'accessories';
  return 'clothing';
};

// =====================================================================
async function main() {
  await ensureEmbeddedPostgres({ quiet: true });
  const client = new pg.Client(config.db);
  await client.connect();
  const started = Date.now();
  try {
    await client.query('BEGIN');

    // -----------------------------------------------------------------
    // 0. Очистка всех таблиц
    // -----------------------------------------------------------------
    await client.query(`TRUNCATE TABLE audit_log, notifications, ticket_messages, support_tickets, reviews, return_requests,
      order_status_history, order_items, orders, payment_methods, delivery_methods, promo_codes, viewed_products,
      comparisons, wishlist, cart_items, carts, stock_movements, stock, warehouses, product_variants, sizes,
      product_images, products, categories, collection_looks, collections, creative_directors, brand_timeline_events,
      brand_history_sections, brands, seller_applications, addresses, "session", login_attempts, email_codes,
      users, roles, currency_rates, banners, newsletter_subscribers RESTART IDENTITY CASCADE`);
    await client.query('ALTER SEQUENCE order_number_seq RESTART WITH 1');

    // -----------------------------------------------------------------
    // 1. Роли и пользователи (roles, users, addresses, seller_applications)
    // -----------------------------------------------------------------
    const roleRows = await insertMany(client, 'roles', ['code', 'name_ru', 'name_en'], ROLES.map((r) => [r.code, r.name_ru, r.name_en]), 'id, code');
    const roleId = Object.fromEntries(roleRows.map((r) => [r.code, r.id]));

    const people = [
      ...STAFF.map((s) => ({ ...s })),
      ...BUYERS.map((b) => ({ ...b, role: 'buyer' })),
      { email: 'blocked.user@example.com', first_name: 'Тимофей', last_name: 'Заблокированный', role: 'buyer', phone: '+375290000000', status: 'blocked' },
    ];
    const hashes = await Promise.all(people.map(() => bcrypt.hash(TEST_PASSWORD, config.auth.bcryptRounds)));
    const userRows = await insertMany(
      client,
      'users',
      ['email', 'password_hash', 'first_name', 'last_name', 'phone', 'role_id', 'status', 'email_verified', 'two_factor_enabled', 'preferred_lang', 'preferred_theme', 'preferred_currency', 'last_login_at', 'created_at'],
      people.map((p, i) => {
        const isStaff = p.role !== 'buyer';
        const created = isStaff ? NOW - randInt(330, 420) * DAY : p.email === 'buyer@amfibia.by' ? NOW - 300 * DAY : NOW - randInt(160, 400) * DAY;
        const lang = ['dmitry.sokolov@example.com', 'dana.seitkali@example.com', 'ruslan.aliev@example.com'].includes(p.email) ? 'en' : 'ru';
        const currency = ['KZ', 'UZ', 'KG', 'AZ'].includes(p.country) ? 'USD' : p.country === 'AM' ? 'EUR' : 'BYN';
        return [
          p.email, hashes[i], p.first_name, p.last_name, p.phone, roleId[p.role], p.status || 'active', true,
          p.email === 'anna.kovaleva@example.com', lang, 'amfibia', currency, ts(NOW - randInt(0, 20) * DAY - randInt(0, 23) * HOUR), ts(created),
        ];
      }),
      'id, email'
    );
    const userId = Object.fromEntries(userRows.map((u) => [u.email, u.id]));
    const person = Object.fromEntries(people.map((p) => [p.email, { ...p, id: userId[p.email] }]));
    const U = {
      owner: userId['owner@amfibia.by'], moderator: userId['moderator@amfibia.by'], support: userId['support@amfibia.by'],
      warehouse: userId['warehouse@amfibia.by'], courier: userId['courier@amfibia.by'], courier2: userId['courier2@amfibia.by'],
      official: userId['official@amfibia.by'], seller1: userId['seller1@amfibia.by'], seller2: userId['seller2@amfibia.by'],
      seller3: userId['seller3@amfibia.by'], buyer: userId['buyer@amfibia.by'],
    };

    // Адреса покупателей: основной + у части покупателей второй
    const addressPeople = [person['buyer@amfibia.by'], ...BUYERS.map((b) => person[b.email])];
    const addressData = [];
    for (const p of addressPeople) {
      const recipient = `${p.first_name} ${p.last_name}`;
      addressData.push({ user: p.id, country: p.country, city: p.city, street: p.street, house: p.house, apartment: p.apartment, postal_code: p.postal, recipient, phone: p.phone, is_default: true });
      if (chance(0.3) || p.email === 'buyer@amfibia.by') {
        addressData.push({ user: p.id, country: p.country, city: p.city, street: p.email === 'buyer@amfibia.by' ? 'ул. Интернациональная' : 'ул. Центральная', house: String(randInt(1, 90)), apartment: null, postal_code: p.postal, recipient: `${recipient} (офис)`, phone: p.phone, is_default: false });
      }
    }
    const addressRows = await insertMany(
      client, 'addresses',
      ['user_id', 'country', 'city', 'street', 'house', 'apartment', 'postal_code', 'recipient', 'phone', 'is_default'],
      addressData.map((a) => [a.user, a.country, a.city, a.street, a.house, a.apartment, a.postal_code, a.recipient, a.phone, a.is_default]),
      'id, user_id, is_default'
    );
    addressData.forEach((a, i) => { a.id = addressRows[i].id; });
    const defaultAddress = Object.fromEntries(addressData.filter((a) => a.is_default).map((a) => [a.user, a]));

    // Заявки продавцов
    const sellerApps = [
      ...STAFF.filter((s) => s.shop).map((s) => [userId[s.email], s.shop, s.shopDesc, 'approved', U.moderator, null, ts(NOW - 320 * DAY), ts(NOW - 325 * DAY)]),
      [userId['arman.petrosyan@example.com'], 'Yerevan Archive', 'Архивные вещи Maison Margiela и Givenchy из частной коллекции.', 'pending', null, null, null, ts(NOW - 2 * DAY)],
      [userId['sofia.morozova@example.com'], 'Kazan Vintage Room', 'Винтажные сумки Louis Vuitton и Gucci с документами.', 'pending', null, null, null, ts(NOW - 5 * DAY)],
      [userId['nikita.orlov@example.com'], 'Replica Store', 'Качественные копии популярных моделей.', 'rejected', U.moderator, 'Площадка не принимает реплики и копии.', ts(NOW - 40 * DAY), ts(NOW - 42 * DAY)],
    ];
    await insertMany(client, 'seller_applications', ['user_id', 'shop_name', 'description', 'status', 'reviewed_by', 'comment', 'reviewed_at', 'created_at'], sellerApps);

    // -----------------------------------------------------------------
    // 2. Каталог: бренды, категории, коллекции, директора, хронология, истории
    // -----------------------------------------------------------------
    const brandRows = await insertMany(
      client, 'brands',
      ['name', 'slug', 'country', 'founded_year', 'founder', 'short_desc_ru', 'short_desc_en', 'hero_image', 'accent_color', 'sort_order'],
      BRANDS.map((b, i) => [b.name, b.slug, b.country, b.founded_year, b.founder, b.short_desc_ru, b.short_desc_en, preferPhoto(`/images/brands/${b.slug}/hero.svg`), b.accent_color, i + 1]),
      'id, slug'
    );
    const brandId = Object.fromEntries(brandRows.map((b) => [b.slug, b.id]));

    const categoryId = {};
    for (const [i, root] of CATEGORIES.entries()) {
      const { rows } = await client.query(
        'INSERT INTO categories (parent_id, slug, name_ru, name_en, size_type, sort_order) VALUES (NULL, $1, $2, $3, $4, $5) RETURNING id',
        [root.slug, root.name_ru, root.name_en, root.size_type, i + 1]
      );
      categoryId[root.slug] = rows[0].id;
      const children = await insertMany(
        client, 'categories', ['parent_id', 'slug', 'name_ru', 'name_en', 'size_type', 'sort_order'],
        root.children.map((c, j) => [rows[0].id, c.slug, c.name_ru, c.name_en, c.size_type || root.size_type, j + 1]),
        'id, slug'
      );
      children.forEach((c) => { categoryId[c.slug] = c.id; });
    }

    const collectionsByBrand = {};
    for (const b of BRANDS) {
      const rows = await insertMany(
        client, 'collections', ['brand_id', 'name', 'season', 'year', 'is_new', 'cover_image', 'description_ru', 'description_en', 'created_at'],
        b.collections.map(([name, season, year, isNew], i) => [
          brandId[b.slug], name, season, year, isNew, preferPhoto(`/images/brands/${b.slug}/collections/${slugify(name)}.svg`),
          `${b.name}: ${COLLECTION_TEXT[season][0]}`, `${b.name}: ${COLLECTION_TEXT[season][1]}`, ts(NOW - (b.collections.length - i) * 120 * DAY),
        ]),
        'id, is_new, name'
      );
      collectionsByBrand[b.slug] = rows;
      // Лукбук: кадры показа сезона, скачанные npm run images:editorial —
      // public/images/brands/<бренд>/collections/<коллекция>/look-07.webp (число — номер выхода на показе)
      const lookRows = [];
      for (const c of rows) {
        const dir = path.join(PUBLIC_DIR, 'images', 'brands', b.slug, 'collections', slugify(c.name));
        if (!fs.existsSync(dir)) continue;
        const files = fs.readdirSync(dir).filter((f) => /^look-\d+\.webp$/.test(f)).sort((x, y) => parseInt(x.slice(5), 10) - parseInt(y.slice(5), 10));
        files.forEach((f, i) => lookRows.push([c.id, i + 1, `/images/brands/${b.slug}/collections/${slugify(c.name)}/${f}`, parseInt(f.slice(5), 10)]));
      }
      if (lookRows.length) await insertMany(client, 'collection_looks', ['collection_id', 'sort_order', 'image', 'look_number'], lookRows);
    }

    const histories = await loadHistories();
    for (const b of BRANDS) {
      const history = histories[b.slug];
      const directors = history?.directors || b.directors;
      const timeline = history?.timeline || b.timeline;
      await insertMany(
        client, 'creative_directors',
        ['brand_id', 'name', 'years_from', 'years_to', 'description_ru', 'description_en', 'key_collections_ru', 'key_collections_en', 'photo'],
        directors.map((d, i) => [brandId[b.slug], d[0], d[1], d[2], d[3], d[4], d[5], d[6], photoOnly(`/images/brands/${b.slug}/directors/${i + 1}.svg`)])
      );
      await insertMany(
        client, 'brand_timeline_events', ['brand_id', 'year', 'title_ru', 'title_en', 'description_ru', 'description_en'],
        timeline.map((e) => [brandId[b.slug], e[0], e[1], e[2], e[3], e[4]])
      );
      if (history) {
        await insertMany(
          client, 'brand_history_sections',
          ['brand_id', 'sort_order', 'period', 'title_ru', 'title_en', 'content_ru', 'content_en', 'quote_ru', 'quote_en', 'quote_author', 'image'],
          history.sections.map((s, i) => [brandId[b.slug], i + 1, s.period || null, s.title_ru, s.title_en, s.content_ru, s.content_en || '', s.quote_ru || null, s.quote_en || null, s.quote_author || null, s.image || photoOnly(`/images/brands/${b.slug}/history/${i + 1}.svg`)]),
          null, 50
        );
      }
    }

    // -----------------------------------------------------------------
    // 3. Размеры, склады
    // -----------------------------------------------------------------
    const sizeRows = await insertMany(client, 'sizes', ['type', 'value_eu', 'value_it', 'value_us', 'value_int', 'sort_order'],
      SIZES.map((s) => [s.type, s.value_eu, s.value_it, s.value_us, s.value_int, s.sort_order]), 'id, type, value_int');
    const sizeId = Object.fromEntries(sizeRows.map((s) => [`${s.type}:${s.value_int}`, s.id]));

    const warehouseRows = await insertMany(client, 'warehouses', ['name', 'city', 'address', 'created_at'], [
      ['AMFIBIA Минск — центральный склад', 'Минск', 'ул. Тимирязева, 65Б', ts(NOW - 400 * DAY)],
      ['AMFIBIA Москва', 'Москва', 'ул. Складочная, 1, стр. 18', ts(NOW - 380 * DAY)],
      ['AMFIBIA Алматы', 'Алматы', 'ул. Бекмаханова, 93', ts(NOW - 360 * DAY)],
    ], 'id, city');
    const W = warehouseRows.map((w) => w.id); // [Минск, Москва, Алматы]

    // -----------------------------------------------------------------
    // 4. Товары, фото, варианты (products, product_images, product_variants)
    // -----------------------------------------------------------------
    const productDrafts = [];
    for (const b of BRANDS) {
      const catalog = readCatalog(b.slug);
      if (catalog?.length) {
        const brandCollections = collectionsByBrand[b.slug];
        const newCollection = brandCollections.find((c) => c.is_new);
        const oldCollections = brandCollections.filter((c) => !c.is_new);
        const modelIndex = new Map();
        catalog.forEach((item, idx) => {
          // «fragrance» в каталоге — раздел; подкатегория аромата — по полу (мужской / женский / унисекс)
          const catInfo = SUBCATEGORY_INFO[item.category === 'fragrance' ? 'fragrance-unisex' : item.category];
          if (!catInfo || !item.images?.length) return;
          if (!item.images.every((img) => fs.existsSync(path.join(PUBLIC_DIR, img)))) return;
          const seq = idx + 1;
          if (!modelIndex.has(item.model)) modelIndex.set(item.model, modelIndex.size + 1);
          const cat = item.category === 'fragrance' ? (item.gender === 'women' ? 'fragrance-women' : item.gender === 'men' ? 'fragrance-men' : 'fragrance-unisex') : item.category;
          const info = SUBCATEGORY_INFO[cat];
          const sku = `${b.code}-${info.code}-${String(seq).padStart(4, '0')}`;
          const voice = BRAND_VOICE[b.slug][seq % BRAND_VOICE[b.slug].length];
          const material = MATERIAL_SENTENCE[item.material] ? item.material : 'cotton';
          const preowned = item.preowned
            ? ['Подлинная вещь с проверкой: прошла экспертизу и находится в отличном состоянии.', 'An authenticated piece in excellent condition.']
            : null;
          const descRu = [voice[0], CATEGORY_SENTENCE[cat][0], MATERIAL_SENTENCE[material][0], preowned?.[0]].filter(Boolean).join(' ');
          const descEn = [voice[1], CATEGORY_SENTENCE[cat][1], MATERIAL_SENTENCE[material][1], preowned?.[1]].filter(Boolean).join(' ');
          const [compRu, compEn] = composition(material, cat);
          const [careRu, careEn] = care(material, cat);
          const iconic = Boolean(ICONIC[b.slug]?.test(item.name_en));
          const isNew = !item.preowned && chance(iconic ? 0.15 : 0.3);
          const collection = isNew ? newCollection : pick(oldCollections);
          const price = item.price_byn || fallbackPrice(b.slug, cat);
          const hasDiscount = chance(iconic ? 0.08 : 0.18);
          productDrafts.push({
            brand: b, sku, model_code: `${b.code}-M${String(modelIndex.get(item.model)).padStart(3, '0')}`, cat, catInfo: info,
            name_ru: CATALOG_RU[item.name_en] || ruName(item.name_en, item.category), name_en: item.name_en,
            description_ru: descRu, description_en: descEn, composition_ru: compRu, composition_en: compEn, care_ru: careRu, care_en: careEn,
            price_byn: price, old_price_byn: hasDiscount ? round10(price * randFloat(1.15, 1.4)) : null, gender: item.gender || 'unisex',
            color: item.color, material, country: b.origin, is_limited: chance(0.04), is_new: isNew, is_iconic: iconic,
            collection_id: collection?.id || null, views_count: iconic ? randInt(1500, 6500) : randInt(40, 1400),
            created_at: isNew ? NOW - randInt(3, 45) * DAY : NOW - randInt(60, 420) * DAY,
            // Вещи с ресейла (Fashionphile) — у продавцов-ресейлеров, в единственном экземпляре
            seller: item.preowned ? (SUBCATEGORY_INFO[cat].parent === 'jewelry' ? U.seller2 : U.seller3) : U.official,
            single: Boolean(item.preowned), preowned: Boolean(item.preowned), images: item.images, source: item.page,
          });
        });
        continue;
      }
      const models = MODELS[b.slug].map((m) => ({ m, colors: [...m[5]] }));
      let total = models.reduce((sum, x) => sum + x.colors.length, 0);
      // Обрезаем до 60 товаров: сначала убираем лишние цвета у некультовых моделей
      while (total > PRODUCTS_PER_BRAND) {
        let candidates = models.filter((x) => !x.m[8].i && x.colors.length > 1);
        if (!candidates.length) candidates = models.filter((x) => x.colors.length > 1);
        if (candidates.length) {
          candidates.sort((a, c) => c.colors.length - a.colors.length || models.indexOf(c) - models.indexOf(a));
          candidates[0].colors.pop();
        } else {
          models.splice(models.map((x) => !x.m[8].i).lastIndexOf(true), 1);
        }
        total -= 1;
      }
      if (total < PRODUCTS_PER_BRAND) console.warn(`[seed] ${b.name}: только ${total} товаров`);

      const brandCollections = collectionsByBrand[b.slug];
      const newCollection = brandCollections.find((c) => c.is_new);
      const oldCollections = brandCollections.filter((c) => !c.is_new);
      let seq = 0;
      for (const { m, colors } of models) {
        const [code, cat, nameEn, nameRu, price, , material, gender, opts] = m;
        for (const color of colors) {
          seq += 1;
          const catInfo = SUBCATEGORY_INFO[cat];
          const sku = `${b.code}-${catInfo.code}-${String(seq).padStart(4, '0')}`;
          const voice = BRAND_VOICE[b.slug][seq % BRAND_VOICE[b.slug].length];
          const descRu = [voice[0], opts.n?.[0], CATEGORY_SENTENCE[cat][0], MATERIAL_SENTENCE[material][0]].filter(Boolean).join(' ');
          const descEn = [voice[1], opts.n?.[1], CATEGORY_SENTENCE[cat][1], MATERIAL_SENTENCE[material][1]].filter(Boolean).join(' ');
          const [compRu, compEn] = composition(material, cat);
          const [careRu, careEn] = care(material, cat);
          const isNew = chance(opts.i ? 0.15 : 0.28);
          const collection = isNew ? newCollection : pick(oldCollections);
          const hasDiscount = chance(opts.i ? 0.08 : 0.2);
          const oldPrice = hasDiscount ? round10(price * randFloat(1.15, 1.45)) : null;
          const country = opts.c || (chance(0.75) ? b.origin : pick(ALT_COUNTRIES[b.slug]));
          productDrafts.push({
            brand: b, sku, model_code: `${b.code}-${code}`, cat, catInfo, name_ru: nameRu, name_en: nameEn,
            description_ru: descRu, description_en: descEn, composition_ru: compRu, composition_en: compEn, care_ru: careRu, care_en: careEn,
            price_byn: price, old_price_byn: oldPrice, gender, color, material, country,
            is_limited: Boolean(opts.l) || chance(0.04), is_new: isNew, is_iconic: Boolean(opts.i),
            collection_id: collection?.id || null,
            views_count: opts.i ? randInt(1500, 6500) : randInt(40, 1400),
            created_at: isNew ? NOW - randInt(3, 45) * DAY : NOW - randInt(60, 420) * DAY,
            seller: U.official,
          });
        }
      }
    }
    // Товары, для которых не нашлось фото вещи той же категории, в каталог не попадают
    // (список ведёт сборщик фото: db/content/excluded-products.json, по брендам)
    // fileURLToPath — корректный путь и на Windows (у URL.pathname там лишний «/» перед буквой диска)
    const excludedFile = path.join(path.dirname(fileURLToPath(import.meta.url)), 'content', 'excluded-products.json');
    const excludedSkus = new Set(fs.existsSync(excludedFile) ? Object.values(JSON.parse(fs.readFileSync(excludedFile, 'utf8'))).flat() : []);
    // (только для товаров из старого списка моделей — у реального каталога фото есть у каждой вещи)
    for (let i = productDrafts.length - 1; i >= 0; i--) if (!productDrafts[i].images && excludedSkus.has(productDrafts[i].sku)) productDrafts.splice(i, 1);
    if (excludedSkus.size) console.log(`[seed] Исключено товаров без подходящего фото: ${excludedSkus.size}`);
    // Часть товаров принадлежит тестовым продавцам (архив, серебро, винтаж)
    const sellerPlan = [
      [U.seller1, ['balenciaga', 'vetements', 'enfants-riches-deprimes'], () => true, 5],
      [U.seller2, ['chrome-hearts', 'alexander-mcqueen', 'givenchy'], (p) => ['rings', 'chains', 'bracelets', 'earrings', 'pendants'].includes(p.cat), 3],
      [U.seller3, ['chanel', 'louis-vuitton', 'maison-margiela'], (p) => SUBCATEGORY_INFO[p.cat].parent === 'bags' || p.cat === 'tshirts', 3],
    ];
    for (const [seller, brands, filter, every] of sellerPlan) {
      productDrafts.filter((p) => !p.preowned && brands.includes(p.brand.slug) && filter(p)).forEach((p, i) => { if (i % every === 0) p.seller = seller; });
    }

    const productRows = await insertMany(
      client, 'products',
      ['sku', 'model_code', 'brand_id', 'collection_id', 'category_id', 'seller_id', 'name_ru', 'name_en', 'description_ru', 'description_en',
        'composition_ru', 'composition_en', 'care_ru', 'care_en', 'price_byn', 'old_price_byn', 'gender', 'color', 'material', 'country_of_origin',
        'is_limited', 'is_new', 'is_iconic', 'moderation_status', 'is_authenticated', 'views_count', 'created_at', 'updated_at'],
      productDrafts.map((p) => [
        p.sku, p.model_code, brandId[p.brand.slug], p.collection_id, categoryId[p.cat], p.seller, p.name_ru, p.name_en, p.description_ru, p.description_en,
        p.composition_ru, p.composition_en, p.care_ru, p.care_en, p.price_byn, p.old_price_byn, p.gender, p.color, p.material, p.country,
        p.is_limited, p.is_new, p.is_iconic, 'approved', true, p.views_count, ts(p.created_at), ts(p.created_at),
      ]),
      'id, sku'
    );
    const productIdBySku = Object.fromEntries(productRows.map((r) => [r.sku, r.id]));
    productDrafts.forEach((p) => { p.id = productIdBySku[p.sku]; });

    await insertMany(client, 'product_images', ['product_id', 'url', 'sort_order', 'is_main'],
      productDrafts.flatMap((p) =>
        p.images
          ? p.images.map((url, i) => [p.id, url, i + 1, i === 0])
          : [
              [p.id, preferPhoto(`/images/brands/${p.brand.slug}/products/${p.sku}-1.svg`), 1, true],
              [p.id, preferPhoto(`/images/brands/${p.brand.slug}/products/${p.sku}-2.svg`), 2, false],
            ]
      ));

    const variantDrafts = [];
    for (const p of productDrafts) {
      const labels = sizeLabelsFor(p.catInfo.size_type, p.gender, rand);
      // Вещь с ресейла — один экземпляр одного размера
      for (const label of p.single ? [labels[Math.floor(labels.length / 2)]] : labels) {
        variantDrafts.push({ product: p, size_id: sizeId[`${p.catInfo.size_type}:${label}`], label, sku_variant: `${p.sku}-${label.replace(/\s+/g, '').replace('.', '').toUpperCase()}` });
      }
    }
    const variantRows = await insertMany(client, 'product_variants', ['product_id', 'size_id', 'sku_variant'],
      variantDrafts.map((v) => [v.product.id, v.size_id, v.sku_variant]), 'id, sku_variant');
    const variantIdBySku = Object.fromEntries(variantRows.map((v) => [v.sku_variant, v.id]));
    variantDrafts.forEach((v) => { v.id = variantIdBySku[v.sku_variant]; });
    const variantsByProduct = new Map();
    variantDrafts.forEach((v) => {
      if (!variantsByProduct.has(v.product.id)) variantsByProduct.set(v.product.id, []);
      variantsByProduct.get(v.product.id).push(v);
    });

    // -----------------------------------------------------------------
    // 5. Остатки: начальная приёмка на 3 склада (stock + stock_movements income)
    // -----------------------------------------------------------------
    const stock = new Map(); // `${variant}:${warehouse}` → { quantity, reserved }
    const movements = []; // [variant_id, warehouse_id, type, quantity, order_id, user_id, comment, created_at]
    const stockKey = (v, w) => `${v}:${w}`;
    const distribution = [
      [[0, 6], [1, 8], [2, 12], [3, 16], [4, 16], [5, 14], [6, 10], [8, 9], [12, 6]],
      [[0, 24], [1, 18], [2, 18], [3, 14], [4, 10], [5, 7], [7, 6], [10, 3]],
      [[0, 38], [1, 20], [2, 16], [3, 12], [4, 8], [6, 6]],
    ];
    for (const v of variantDrafts) {
      if (v.product.single) {
        W.forEach((w, wi) => {
          stock.set(stockKey(v.id, w), { quantity: wi === 0 ? 1 : 0, reserved: 0 });
          if (wi === 0) movements.push([v.id, w, 'income', 1, null, U.warehouse, 'Приёмка вещи после экспертизы подлинности', ts(NOW - randInt(165, 175) * DAY)]);
        });
        continue;
      }
      const soldOut = chance(0.05);
      W.forEach((w, wi) => {
        let qty = soldOut ? 0 : weighted(distribution[wi]);
        if (v.product.price_byn > 12000) qty = Math.ceil(qty / 2);
        if (v.label === 'OS' && qty > 0) qty += randInt(0, 3);
        stock.set(stockKey(v.id, w), { quantity: qty, reserved: 0 });
        if (qty > 0) movements.push([v.id, w, 'income', qty, null, U.warehouse, 'Первичная приёмка товара', ts(NOW - randInt(165, 175) * DAY)]);
        if (!soldOut && chance(0.12)) {
          const extra = randInt(2, 6);
          stock.get(stockKey(v.id, w)).quantity += extra;
          movements.push([v.id, w, 'income', extra, null, U.warehouse, 'Допоставка от дистрибьютора', ts(NOW - randInt(152, 158) * DAY)]);
        }
      });
    }
    const available = (v, w) => {
      const s = stock.get(stockKey(v, w));
      return s ? s.quantity - s.reserved : 0;
    };

    // -----------------------------------------------------------------
    // 6. Справочники заказов: доставка, оплата, промокоды, курсы, баннеры
    // -----------------------------------------------------------------
    const deliveryRows = await insertMany(client, 'delivery_methods', ['code', 'name_ru', 'name_en', 'price_byn', 'days_min', 'days_max', 'is_pickup', 'is_active', 'sort_order'], [
      ['courier', 'Курьер до двери', 'Courier to the door', 15, 1, 3, false, true, 1],
      ['belpost', 'Белпочта', 'Belpost', 8, 3, 7, true, true, 2],
      ['europost', 'Европочта', 'Europost', 6, 2, 4, true, true, 3],
      ['cdek', 'СДЭК', 'CDEK', 20, 3, 10, true, true, 4],
      ['boxberry', 'Boxberry', 'Boxberry', 18, 4, 12, true, true, 5],
    ], 'id, code, price_byn, days_min, days_max, is_pickup, name_ru');
    const delivery = Object.fromEntries(deliveryRows.map((d) => [d.code, d]));

    const paymentRows = await insertMany(client, 'payment_methods', ['code', 'name_ru', 'name_en', 'is_online', 'is_active', 'sort_order'], [
      ['card', 'Банковская карта', 'Bank card', true, true, 1],
      ['erip', 'ЕРИП', 'ERIP', true, true, 2],
      ['cash', 'Наличными при получении', 'Cash on delivery', false, true, 3],
    ], 'id, code, is_online');
    const payment = Object.fromEntries(paymentRows.map((p) => [p.code, p]));

    const promoRows = await insertMany(client, 'promo_codes', ['code', 'discount_percent', 'valid_from', 'valid_to', 'usage_limit', 'used_count', 'is_active'], [
      ['AMFIBIA10', 10, '2026-01-01T00:00:00Z', '2026-12-31T23:59:59Z', null, 0, true],
      ['GOTHIC15', 15, '2026-05-01T00:00:00Z', '2026-12-31T23:59:59Z', 200, 0, true],
      ['WELCOME20', 20, '2026-01-01T00:00:00Z', null, 1000, 0, true],
      ['SUMMER25', 25, '2026-06-01T00:00:00Z', '2026-08-31T23:59:59Z', null, 0, true],
      ['VIP30', 30, '2026-01-01T00:00:00Z', '2026-12-31T23:59:59Z', 5, 5, true],
    ], 'id, code, discount_percent');
    const promo = Object.fromEntries(promoRows.map((p) => [p.code, p]));
    const promoUsage = {};

    const RATES = { BYN: 1, USD: 3.2051, EUR: 3.4722 };
    await insertMany(client, 'currency_rates', ['code', 'rate_to_byn', 'updated_at', 'updated_by'],
      Object.entries(RATES).map(([code, rate]) => [code, rate, ts(NOW - 2 * DAY), U.owner]));

    const bannerPlan = [
      ['balenciaga', 'Индустриальная строгость', 'Industrial rigour', 'Скульптурный объём и холодный серый — новая коллекция', 'Sculptural volume and cold grey — the new collection'],
      ['chrome-hearts', 'Серебро и готика', 'Silver and gothic', 'Кресты, кожа и ручная работа из Голливуда', 'Crosses, leather and handwork from Hollywood'],
      ['maison-margiela', 'Белая бирка', 'The blank label', 'Деконструкция, таби и анонимность', 'Deconstruction, Tabi and anonymity'],
      ['gucci', 'Флорентийское наследие', 'Florentine heritage', 'Трензель, бамбук и полоса Web в новом прочтении', 'Horsebit, bamboo and the Web stripe reimagined'],
      ['alexander-mcqueen', 'Мрачный романтизм', 'Dark romanticism', 'Корсеты, черепа и портновская точность', 'Corsetry, skulls and tailoring precision'],
      ['loro-piana', 'Тихая роскошь', 'Quiet luxury', 'Кашемир, викунья и мокасины Summer Walk', 'Cashmere, vicuña and Summer Walk loafers'],
    ];
    await insertMany(client, 'banners', ['title_ru', 'title_en', 'subtitle_ru', 'subtitle_en', 'image', 'link', 'brand_id', 'collection_id', 'sort_order', 'is_active'],
      bannerPlan.map(([slug, tRu, tEn, sRu, sEn], i) => [tRu, tEn, sRu, sEn, preferPhoto(`/images/banners/${slug}.svg`), `/brand/${slug}`, brandId[slug], collectionsByBrand[slug].find((c) => c.is_new)?.id || null, i + 1, true]));

    // -----------------------------------------------------------------
    // 7. Заказы с историей статусов, движениями остатков и уведомлениями
    // -----------------------------------------------------------------
    const approvedProducts = productDrafts;
    const buyersList = [person['buyer@amfibia.by'], ...BUYERS.map((b) => person[b.email])];
    const preferredWarehouse = (country) => (country === 'BY' ? [0, 1, 2] : ['KZ', 'KG', 'UZ'].includes(country) ? [2, 1, 0] : [1, 0, 2]);

    // План заказов основного тестового покупателя — по одному в каждом статусе (для демонстрации)
    const plans = [
      { user: person['buyer@amfibia.by'], age: 0.08, status: 'confirmed', delivery: 'courier', pay: 'card' },
      { user: person['buyer@amfibia.by'], age: 0.6, status: 'assembling', delivery: 'europost', pay: 'cash' },
      { user: person['buyer@amfibia.by'], age: 1.3, status: 'assembled', delivery: 'courier', pay: 'erip' },
      { user: person['buyer@amfibia.by'], age: 2.2, status: 'handed_to_delivery', delivery: 'courier', pay: 'card' },
      { user: person['buyer@amfibia.by'], age: 3.4, status: 'in_transit', delivery: 'cdek', pay: 'card' },
      { user: person['buyer@amfibia.by'], age: 5.5, status: 'arrived', delivery: 'europost', pay: 'cash' },
      { user: person['buyer@amfibia.by'], age: 7, status: 'delivered', delivery: 'courier', pay: 'card', returnPending: true },
      { user: person['buyer@amfibia.by'], age: 24, status: 'delivered', delivery: 'belpost', pay: 'erip' },
      { user: person['buyer@amfibia.by'], age: 46, status: 'delivered', delivery: 'courier', pay: 'card', promo: 'AMFIBIA10' },
      { user: person['buyer@amfibia.by'], age: 12, status: 'cancelled', delivery: 'europost', pay: 'card' },
      { user: person['buyer@amfibia.by'], age: 33, status: 'returned', delivery: 'courier', pay: 'card' },
      { user: person['buyer@amfibia.by'], age: 75, status: 'delivered', delivery: 'boxberry', pay: 'cash' },
    ];
    const pickStatus = (age, isPickup) => {
      if (age < 1) return weighted([['confirmed', 6], ['assembling', 3], ['cancelled', 1]]);
      if (age < 3) return weighted([['assembling', 3], ['assembled', 3], ['handed_to_delivery', 2], ['confirmed', 1], ['cancelled', 1]]);
      if (age < 6) return weighted([['handed_to_delivery', 2], ['in_transit', 4], [isPickup ? 'arrived' : 'in_transit', 2], ['delivered', 2], ['cancelled', 1]]);
      if (age < 12) return weighted([['in_transit', 1], [isPickup ? 'arrived' : 'delivered', 2], ['delivered', 6], ['cancelled', 1]]);
      return weighted([['delivered', 16], ['cancelled', 2], ['returned', 1.6]]);
    };
    while (plans.length < ORDER_COUNT) {
      const user = pick(buyersList.slice(1));
      const age = Math.pow(rand(), 1.8) * 150; // больше свежих заказов — чтобы были очереди сборки и доставки
      const deliveryCode = user.country === 'BY'
        ? weighted([['courier', 4], ['europost', 4], ['belpost', 2], ['boxberry', 1]])
        : weighted([['cdek', 6], ['boxberry', 3], ['courier', 1]]);
      plans.push({ user, age, status: null, delivery: deliveryCode, pay: weighted([['card', 5], ['erip', 2], ['cash', 3]]), promo: chance(0.14) ? weighted([['AMFIBIA10', 5], ['GOTHIC15', 3], ['WELCOME20', 2]]) : null });
    }
    plans.forEach((p) => {
      p.createdAt = NOW - p.age * DAY - (p.age > 1 ? randInt(0, 8) * HOUR : 0);
      p.status ||= pickStatus(p.age, delivery[p.delivery].is_pickup);
      p.currency = p.user.email === 'buyer@amfibia.by' ? 'BYN' : weighted([['BYN', 6], ['USD', 3], ['EUR', 1.5]]);
    });
    plans.sort((a, b) => a.createdAt - b.createdAt);

    const statusHistory = []; // [order_id, status, changed_by, comment, created_at]
    const notifications = []; // [user_id, type, title_ru, title_en, text_ru, text_en, link, is_read, created_at]
    const deliveredItems = []; // для отзывов и возвратов
    const returnedOrders = [];
    const usedTracking = new Set();
    const courierName = { [U.courier]: 'Денис Быков', [U.courier2]: 'Сергей Ляхов' };
    const warehouseCity = Object.fromEntries(warehouseRows.map((w) => [w.id, w.city]));

    for (const plan of plans) {
      const method = delivery[plan.delivery];
      const pay = payment[plan.pay];
      const chain = ['created', 'confirmed', 'assembling', 'assembled', 'handed_to_delivery', 'in_transit', ...(method.is_pickup ? ['arrived'] : []), 'delivered'];

      // --- позиции заказа с резервированием на складе ---
      const itemCount = weighted([[1, 60], [2, 30], [3, 10]]);
      const order = { items: [] };
      const usedProducts = new Set();
      let attempts = 0;
      while (order.items.length < itemCount && attempts < 60) {
        attempts += 1;
        const product = pick(approvedProducts);
        if (usedProducts.has(product.id)) continue;
        const qty = chance(0.1) ? 2 : 1;
        const variants = shuffle(variantsByProduct.get(product.id));
        let chosen = null;
        for (const v of variants) {
          const w = preferredWarehouse(plan.user.country).map((i) => W[i]).find((wid) => available(v.id, wid) >= qty);
          if (w) { chosen = { v, w }; break; }
        }
        if (!chosen) continue;
        usedProducts.add(product.id);
        order.items.push({ product, variant: chosen.v, warehouse: chosen.w, qty, price: product.price_byn });
      }
      if (!order.items.length) continue;

      // --- цепочка статусов и время каждого шага ---
      let steps;
      if (plan.status === 'cancelled') {
        const cut = randInt(1, 3);
        steps = [...chain.slice(0, cut + 1), 'cancelled'];
      } else if (plan.status === 'returned') {
        steps = [...chain, 'returned'];
      } else {
        steps = chain.slice(0, chain.indexOf(plan.status) + 1);
      }
      const gaps = {
        created: 0, confirmed: randInt(1, 4) * MIN, assembling: randFloat(1, 16) * HOUR, assembled: randFloat(1, 7) * HOUR,
        handed_to_delivery: randFloat(2, 18) * HOUR, in_transit: randFloat(1, 8) * HOUR, arrived: randFloat(1, Math.max(1.5, method.days_max - 1)) * DAY,
        delivered: method.is_pickup ? randFloat(0.2, 2.5) * DAY : randFloat(0.4, Math.max(1, method.days_max - 0.5)) * DAY,
        cancelled: randFloat(0.5, 20) * HOUR, returned: randFloat(2, 9) * DAY,
      };
      let t = plan.createdAt;
      const times = steps.map((s) => (t += gaps[s]));
      const latest = NOW - randInt(5, 90) * MIN;
      if (times[times.length - 1] > latest) {
        const span = times[times.length - 1] - plan.createdAt;
        const allowed = Math.max(latest - plan.createdAt, steps.length * MIN);
        for (let i = 0; i < times.length; i++) times[i] = plan.createdAt + ((times[i] - plan.createdAt) * allowed) / span;
      }
      const timeOf = (status) => times[steps.indexOf(status)];

      // --- суммы и валюта ---
      const subtotal = money(order.items.reduce((sum, it) => sum + it.price * it.qty, 0));
      const promoRow = plan.promo ? promo[plan.promo] : null;
      const discount = promoRow ? money((subtotal * promoRow.discount_percent) / 100) : 0;
      const deliveryPrice = subtotal - discount >= config.shop.freeDeliveryFromByn ? 0 : Number(method.price_byn);
      const total = money(subtotal - discount + deliveryPrice);
      const rate = RATES[plan.currency];
      const address = defaultAddress[plan.user.id];
      const reachedHanded = steps.includes('handed_to_delivery');
      const courier = reachedHanded ? (chance(0.7) ? U.courier : U.courier2) : null;
      const delivered = steps.includes('delivered');
      const paymentStatus =
        plan.status === 'returned' ? 'refunded'
          : plan.status === 'cancelled' ? (pay.is_online ? 'refunded' : 'pending')
            : pay.is_online || delivered ? 'paid' : 'pending';
      let tracking;
      do { tracking = makeTrackingNumber(randInt(0, 99_999_999)); } while (usedTracking.has(tracking));
      usedTracking.add(tracking);
      if (promoRow) promoUsage[promoRow.id] = (promoUsage[promoRow.id] || 0) + 1;

      const { rows: [inserted] } = await client.query(
        `INSERT INTO orders (tracking_number, user_id, contact_name, contact_phone, contact_email, address_id, address_snapshot,
           delivery_method_id, payment_method_id, subtotal_byn, delivery_price_byn, discount_byn, total_byn, promo_code_id,
           currency, exchange_rate, total_in_currency, status, payment_status, courier_id, comment, expected_delivery_date, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
         RETURNING id, order_number`,
        [
          tracking, plan.user.id, `${plan.user.first_name} ${plan.user.last_name}`, plan.user.phone, plan.user.email,
          address.id, formatAddress(address),
          method.id, pay.id, subtotal, deliveryPrice, discount, total, promoRow?.id || null,
          plan.currency, rate, money(total / rate), steps[steps.length - 1], paymentStatus, courier,
          chance(0.15) ? pick(['Позвоните за час до доставки', 'Упакуйте, пожалуйста, как подарок', 'Домофон не работает — звоните на телефон']) : null,
          dateOnly(plan.createdAt + method.days_max * DAY), ts(plan.createdAt), ts(times[times.length - 1]),
        ]
      );
      const orderId = inserted.id;
      const orderNumber = inserted.order_number;

      const itemRows = await insertMany(client, 'order_items',
        ['order_id', 'variant_id', 'product_id', 'seller_id', 'warehouse_id', 'product_name', 'product_name_en', 'size_label', 'sku', 'image_url', 'price_byn', 'quantity'],
        order.items.map((it) => [orderId, it.variant.id, it.product.id, it.product.seller, it.warehouse, `${it.product.brand.name} — ${it.product.name_ru}`, `${it.product.brand.name} — ${it.product.name_en}`, it.variant.label, it.variant.sku_variant, it.product.images?.[0] || preferPhoto(`/images/brands/${it.product.brand.slug}/products/${it.product.sku}-1.svg`), it.price, it.qty]),
        'id');
      order.items.forEach((it, i) => { it.id = itemRows[i].id; });

      // Резерв при оформлении
      for (const it of order.items) {
        stock.get(stockKey(it.variant.id, it.warehouse)).reserved += it.qty;
        movements.push([it.variant.id, it.warehouse, 'reserve', it.qty, orderId, plan.user.id, `Резерв под заказ ${orderNumber}`, ts(plan.createdAt)]);
      }
      // Передача в доставку — списание; отмена — снятие резерва
      if (reachedHanded) {
        for (const it of order.items) {
          const s = stock.get(stockKey(it.variant.id, it.warehouse));
          s.quantity -= it.qty;
          s.reserved -= it.qty;
          movements.push([it.variant.id, it.warehouse, 'outcome', it.qty, orderId, U.warehouse, `Передан в доставку, заказ ${orderNumber}`, ts(timeOf('handed_to_delivery'))]);
        }
      } else if (plan.status === 'cancelled') {
        for (const it of order.items) {
          stock.get(stockKey(it.variant.id, it.warehouse)).reserved -= it.qty;
          movements.push([it.variant.id, it.warehouse, 'unreserve', it.qty, orderId, U.support, `Отмена заказа ${orderNumber}`, ts(timeOf('cancelled'))]);
        }
      }

      // История статусов + уведомления покупателю
      steps.forEach((status, i) => {
        const at = times[i];
        let comment = null;
        let by = plan.user.id;
        switch (status) {
          case 'confirmed':
            comment = plan.pay === 'card' ? `Оплата картой •••• ${randInt(1000, 9999)} прошла успешно` : plan.pay === 'erip' ? 'Оплата через ЕРИП подтверждена' : 'Оплата при получении';
            break;
          case 'assembling':
            by = U.warehouse; comment = `Сборка на складе: ${warehouseCity[order.items[0].warehouse]}`; break;
          case 'assembled':
            by = U.warehouse; comment = 'Заказ собран и упакован'; break;
          case 'handed_to_delivery':
            by = U.warehouse; comment = plan.delivery === 'courier' ? `Передан курьеру: ${courierName[courier]}` : `Передан в службу доставки: ${method.name_ru}`; break;
          case 'in_transit':
            by = courier; comment = 'Посылка в пути'; break;
          case 'arrived':
            by = courier; comment = 'Ожидает в пункте выдачи'; break;
          case 'delivered':
            by = courier; comment = pay.is_online ? 'Получен покупателем' : 'Получен покупателем, оплата принята'; break;
          case 'cancelled':
            by = chance(0.6) ? plan.user.id : U.support;
            comment = by === U.support ? 'Отменён поддержкой по просьбе покупателя' : 'Отменён покупателем';
            break;
          case 'returned':
            by = U.support; comment = 'Возврат одобрен поддержкой'; break;
          default:
            comment = 'Заказ оформлен';
        }
        statusHistory.push([orderId, status, by, comment, ts(at)]);
        const n = orderStatusNotification(status, orderNumber, orderId);
        notifications.push([plan.user.id, n.type, n.title_ru, n.title_en, n.text_ru, n.text_en, n.link, NOW - at > 5 * DAY || chance(0.4), ts(at + randInt(0, 3) * MIN)]);
      });

      if (delivered && plan.status !== 'returned') {
        order.items.forEach((it) => deliveredItems.push({ user: plan.user.id, orderId, orderNumber, item: it, deliveredAt: timeOf('delivered'), returnPending: plan.returnPending }));
      }
      if (plan.status === 'returned') returnedOrders.push({ orderId, orderNumber, user: plan.user.id, item: order.items[0], returnedAt: timeOf('returned') });
    }

    await insertMany(client, 'order_status_history', ['order_id', 'status', 'changed_by', 'comment', 'created_at'], statusHistory);
    for (const [id, used] of Object.entries(promoUsage)) {
      await client.query('UPDATE promo_codes SET used_count = used_count + $1 WHERE id = $2', [used, Number(id)]);
    }

    // -----------------------------------------------------------------
    // 8. Возвраты (return_requests) и движения return
    // -----------------------------------------------------------------
    const reasons = [
      ['size', 'Не подошёл размер'], ['changed_mind', 'Передумал(а), вещь не подошла по стилю'],
      ['not_as_described', 'Цвет отличается от фотографий'], ['defect', 'Небольшой дефект шва'],
    ];
    const returnRows = [];
    returnedOrders.forEach((r, i) => {
      const [code, text] = pick(reasons);
      const receivedAt = r.returnedAt + randFloat(1, 4) * DAY;
      const received = i < returnedOrders.length - 1 && receivedAt < NOW; // самый свежий возврат ждёт приёмки на складе
      returnRows.push([r.orderId, r.item.id, r.user, r.item.qty, code, text, null, 'approved', U.support, 'Возврат одобрен, товар без следов носки', ts(r.returnedAt), received ? U.warehouse : null, received ? ts(receivedAt) : null, ts(r.returnedAt - randFloat(1, 3) * DAY)]);
      if (received) {
        stock.get(stockKey(r.item.variant.id, r.item.warehouse)).quantity += r.item.qty;
        movements.push([r.item.variant.id, r.item.warehouse, 'return', r.item.qty, r.orderId, U.warehouse, `Принят возврат по заказу ${r.orderNumber}`, ts(receivedAt)]);
      }
      const n = returnDecisionNotification(i + 1, r.orderNumber, true);
      notifications.push([r.user, n.type, n.title_ru, n.title_en, n.text_ru, n.text_en, n.link, true, ts(r.returnedAt)]);
    });
    // Ожидающий решения возврат у основного покупателя + один отклонённый
    const pendingReturn = deliveredItems.find((d) => d.returnPending);
    if (pendingReturn) {
      returnRows.push([pendingReturn.orderId, pendingReturn.item.id, pendingReturn.user, 1, 'size', 'Размер маломерит, нужен на размер больше', null, 'pending', null, null, null, null, null, ts(NOW - 2 * HOUR)]);
    }
    const rejectCandidate = deliveredItems.find((d) => d.user !== U.buyer && NOW - d.deliveredAt < 30 * DAY && NOW - d.deliveredAt > 3 * DAY);
    if (rejectCandidate) {
      returnRows.push([rejectCandidate.orderId, rejectCandidate.item.id, rejectCandidate.user, 1, 'changed_mind', 'Передумал', null, 'rejected', U.support, 'На фото видны следы носки, товар не подлежит возврату', ts(rejectCandidate.deliveredAt + 2 * DAY), null, null, ts(rejectCandidate.deliveredAt + DAY)]);
    }
    await insertMany(client, 'return_requests',
      ['order_id', 'order_item_id', 'user_id', 'quantity', 'reason_code', 'reason', 'photo', 'status', 'resolved_by', 'comment', 'resolved_at', 'received_by', 'received_at', 'created_at'],
      returnRows);

    // -----------------------------------------------------------------
    // 9. Отзывы (только на купленные и доставленные товары)
    // -----------------------------------------------------------------
    const reviewed = new Set();
    const reviewRows = [];
    for (const d of deliveredItems) {
      const key = `${d.user}:${d.item.product.id}`;
      if (reviewed.has(key) || !chance(0.92)) continue;
      reviewed.add(key);
      const rating = weighted([[5, 56], [4, 27], [3, 10], [2, 5], [1, 2]]);
      const english = chance(0.18);
      const base = pick(REVIEW_TEXTS[rating]);
      const detail = pick(REVIEW_DETAIL[CATEGORY_GROUP(d.item.product.cat)]);
      const text = english ? `${base[1]} ${detail[1]}` : `${base[0]} ${detail[0]}`;
      const status = weighted([['approved', 94], ['pending', 4], ['rejected', 2]]);
      const createdAt = Math.min(d.deliveredAt + randFloat(0.5, 18) * DAY, NOW - randInt(10, 300) * MIN);
      reviewRows.push([d.item.product.id, d.user, d.item.id, rating, text, status, status === 'pending' ? null : U.moderator, status === 'pending' ? null : ts(createdAt + 6 * HOUR), ts(createdAt)]);
    }
    await insertMany(client, 'reviews', ['product_id', 'user_id', 'order_item_id', 'rating', 'text', 'status', 'moderated_by', 'moderated_at', 'created_at'], reviewRows, null, 200);

    // -----------------------------------------------------------------
    // 10. Списания (writeoff) и запись остатков (stock)
    // -----------------------------------------------------------------
    let writeoffs = 0;
    for (const v of shuffle(variantDrafts)) {
      if (writeoffs >= 12) break;
      const w = W[0];
      if (available(v.id, w) >= 2) {
        stock.get(stockKey(v.id, w)).quantity -= 1;
        movements.push([v.id, w, 'writeoff', 1, null, U.warehouse, pick(['Брак: повреждение при транспортировке', 'Списание: дефект фурнитуры', 'Списание: образец для фотосъёмки']), ts(NOW - randInt(5, 120) * DAY)]);
        writeoffs += 1;
      }
    }
    await insertMany(client, 'stock', ['variant_id', 'warehouse_id', 'quantity', 'reserved'],
      [...stock.entries()].map(([key, s]) => { const [v, w] = key.split(':').map(Number); return [v, w, s.quantity, s.reserved]; }), null, 1000);
    movements.sort((a, b) => (a[7] < b[7] ? -1 : 1));
    await insertMany(client, 'stock_movements', ['variant_id', 'warehouse_id', 'type', 'quantity', 'order_id', 'user_id', 'comment', 'created_at'], movements, null, 1000);

    // -----------------------------------------------------------------
    // 11. Корзина, избранное, сравнение, просмотренные
    // -----------------------------------------------------------------
    const inStockVariant = (product) => variantsByProduct.get(product.id).find((v) => W.some((w) => available(v.id, w) > 0));
    const { rows: [cart] } = await client.query('INSERT INTO carts (user_id) VALUES ($1) RETURNING id', [U.buyer]);
    const cartPicks = [productDrafts.find((p) => p.sku.startsWith('MMG-BOT')), productDrafts.find((p) => p.sku.startsWith('CHH-PND'))].filter(Boolean);
    await insertMany(client, 'cart_items', ['cart_id', 'variant_id', 'quantity'], cartPicks.map((p) => [cart.id, inStockVariant(p).id, 1]));

    const wishRows = [];
    const viewedRows = [];
    for (const p of buyersList) {
      const count = p.id === U.buyer ? 9 : randInt(0, 6);
      shuffle(productDrafts).slice(0, count).forEach((prod) => wishRows.push([p.id, prod.id, ts(NOW - randInt(1, 60) * DAY)]));
      const viewed = p.id === U.buyer ? 14 : randInt(0, 10);
      shuffle(productDrafts).slice(0, viewed).forEach((prod) => viewedRows.push([p.id, prod.id, ts(NOW - randInt(0, 30) * DAY - randInt(0, 23) * HOUR)]));
    }
    await insertMany(client, 'wishlist', ['user_id', 'product_id', 'created_at'], wishRows);
    await insertMany(client, 'viewed_products', ['user_id', 'product_id', 'viewed_at'], viewedRows);
    const sneakers = productDrafts.filter((p) => p.cat === 'sneakers' && p.is_iconic);
    await insertMany(client, 'comparisons', ['user_id', 'product_id'], shuffle(sneakers).slice(0, 3).map((p) => [U.buyer, p.id]));

    // -----------------------------------------------------------------
    // 12. Обращения в поддержку
    // -----------------------------------------------------------------
    const ticketPlan = [
      { user: U.buyer, subject: 'Когда приедет мой заказ?', status: 'answered', age: 3, messages: [['user', 'Добрый день! Заказ в пути уже третий день, подскажите сроки?'], ['staff', 'Здравствуйте, Ева! Посылка передана в СДЭК, ожидаемая дата доставки указана в отслеживании. Если будут задержки — напишем.']] },
      { user: U.buyer, subject: 'Как подобрать размер ботинок Tabi?', status: 'open', age: 0.3, messages: [['user', 'Обычно ношу 38, у Tabi колодка большемерит? Стоит ли брать 37,5?']] },
      { user: userId['anna.kovaleva@example.com'], subject: 'Документы о подлинности сумки', status: 'answered', age: 15, messages: [['user', 'Можно ли получить сертификат подлинности для сумки Chanel?'], ['staff', 'Конечно! Каждая вещь проходит проверку Amfibia, сертификат приложен к заказу и доступен в профиле.'], ['user', 'Спасибо, нашла!']] },
      { user: userId['dmitry.sokolov@example.com'], subject: 'Refund for cancelled order', status: 'closed', age: 40, messages: [['user', 'Hello, when will I get the refund for my cancelled order?'], ['staff', 'Hello Dmitry! The refund was processed today and will reach your card within 3–5 business days.']] },
      { user: userId['aliya.nurlanova@example.com'], subject: 'Изменить адрес доставки', status: 'open', age: 1, messages: [['user', 'Хочу поменять адрес доставки в заказе, это возможно?']] },
      { user: userId['arman.petrosyan@example.com'], subject: 'Вопрос по заявке продавца', status: 'answered', age: 2, messages: [['user', 'Сколько рассматривается заявка «Стать продавцом»?'], ['staff', 'Обычно 1–3 рабочих дня. Модератор проверит описание магазина и свяжется с вами.']] },
    ];
    for (const tk of ticketPlan) {
      const created = NOW - tk.age * DAY;
      const { rows: [ticket] } = await client.query(
        'INSERT INTO support_tickets (user_id, subject, status, assigned_to, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [tk.user, tk.subject, tk.status, tk.status === 'open' ? null : U.support, ts(created), ts(created + tk.messages.length * 2 * HOUR)]
      );
      await insertMany(client, 'ticket_messages', ['ticket_id', 'user_id', 'message', 'is_staff', 'created_at'],
        tk.messages.map(([who, text], i) => [ticket.id, who === 'staff' ? U.support : tk.user, text, who === 'staff', ts(created + i * 2 * HOUR)]));
      if (tk.messages.some(([who]) => who === 'staff')) {
        const n = ticketReplyNotification(ticket.id, tk.subject);
        notifications.push([tk.user, n.type, n.title_ru, n.title_en, n.text_ru, n.text_en, n.link, tk.age > 2, ts(created + 2 * HOUR)]);
      }
    }

    // -----------------------------------------------------------------
    // 13. Товары тестовых продавцов на модерации (pending / rejected / draft)
    // -----------------------------------------------------------------
    // Название, цвет и фото — от реальной вещи той же марки и категории из каталога (фото совпадает с товаром)
    const moderationDemo = [
      { seller: U.seller1, brand: 'balenciaga', cat: 'sneakers', sku: 'BAL-SNK-9001', ru: 'образец из архива', en: 'archive sample', price: 4800, status: 'pending' },
      { seller: U.seller2, brand: 'chrome-hearts', cat: 'rings', sku: 'CHH-RNG-9002', ru: 'из частной коллекции', en: 'from a private collection', price: 5200, status: 'pending' },
      { seller: U.seller1, brand: 'vetements', cat: 'hoodies', sku: 'VTM-HOD-9003', ru: 'архив', en: 'archive', price: 2400, status: 'rejected', reason: 'Недостаточно фото для проверки подлинности: нужны крупные планы бирок и швов.' },
      { seller: U.seller3, brand: 'chanel', cat: 'crossbody', sku: 'CHA-CRB-9004', ru: 'винтаж', en: 'vintage', price: 28000, status: 'draft' },
      { seller: U.seller3, brand: 'louis-vuitton', cat: 'totes', sku: 'LVT-TOT-9005', ru: 'винтаж', en: 'vintage', price: 5600, status: 'pending' },
    ].map((d) => {
      const ref = productDrafts.find((p) => p.images && p.brand.slug === d.brand && p.cat === d.cat) || productDrafts.find((p) => p.images && p.brand.slug === d.brand);
      if (!ref) return null;
      return { ...d, cat: ref.cat, ru: `${ref.name_ru} (${d.ru})`, en: `${ref.name_en} (${d.en})`, color: ref.color, material: ref.material, images: ref.images };
    }).filter(Boolean);
    for (const d of moderationDemo) {
      const b = BRANDS.find((x) => x.slug === d.brand);
      const [compRu, compEn] = composition(d.material, d.cat);
      const [careRu, careEn] = care(d.material, d.cat);
      const { rows: [prod] } = await client.query(
        `INSERT INTO products (sku, model_code, brand_id, category_id, seller_id, name_ru, name_en, description_ru, description_en,
           composition_ru, composition_en, care_ru, care_en, price_byn, gender, color, material, country_of_origin,
           moderation_status, rejection_reason, is_authenticated, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'unisex',$15,$16,$17,$18,$19,FALSE,$20,$20) RETURNING id`,
        [d.sku, `${b.code}-ARCHIVE`, brandId[d.brand], categoryId[d.cat], d.seller, d.ru, d.en,
          `Вещь из частной коллекции, состояние отличное. ${CATEGORY_SENTENCE[d.cat][0]}`, `From a private collection, excellent condition. ${CATEGORY_SENTENCE[d.cat][1]}`,
          compRu, compEn, careRu, careEn, d.price, d.color, d.material, b.origin, d.status, d.reason || null, ts(NOW - randInt(1, 6) * DAY)]
      );
      await insertMany(client, 'product_images', ['product_id', 'url', 'sort_order', 'is_main'], d.images.map((url, i) => [prod.id, url, i + 1, i === 0]));
      const sizeType = SUBCATEGORY_INFO[d.cat].size_type;
      const labels = sizeLabelsFor(sizeType, 'unisex', rand).slice(0, 3);
      const vRows = await insertMany(client, 'product_variants', ['product_id', 'size_id', 'sku_variant'],
        labels.map((l) => [prod.id, sizeId[`${sizeType}:${l}`], `${d.sku}-${l.replace(/\s+/g, '').replace('.', '').toUpperCase()}`]), 'id');
      await insertMany(client, 'stock', ['variant_id', 'warehouse_id', 'quantity', 'reserved'], vRows.map((v) => [v.id, W[0], 1, 0]));
      await insertMany(client, 'stock_movements', ['variant_id', 'warehouse_id', 'type', 'quantity', 'user_id', 'comment', 'created_at'],
        vRows.map((v) => [v.id, W[0], 'income', 1, U.warehouse, 'Приёмка товара продавца на проверку подлинности', ts(NOW - 2 * DAY)]));
      if (d.status === 'rejected') {
        const n = productModerationNotification(prod.id, d.ru, false, d.reason);
        notifications.push([d.seller, n.type, n.title_ru, n.title_en, n.text_ru, n.text_en, n.link, false, ts(NOW - DAY)]);
      }
    }

    // Уведомления о решениях по заявкам продавцов
    for (const s of STAFF.filter((x) => x.shop)) {
      const n = sellerApplicationNotification(true, s.shop);
      notifications.push([userId[s.email], n.type, n.title_ru, n.title_en, n.text_ru, n.text_en, n.link, true, ts(NOW - 320 * DAY)]);
    }
    const rejectedApp = sellerApplicationNotification(false, 'Replica Store', 'Площадка не принимает реплики и копии.');
    notifications.push([userId['nikita.orlov@example.com'], rejectedApp.type, rejectedApp.title_ru, rejectedApp.title_en, rejectedApp.text_ru, rejectedApp.text_en, rejectedApp.link, true, ts(NOW - 40 * DAY)]);
    notifications.sort((a, b) => (a[8] < b[8] ? -1 : 1));
    await insertMany(client, 'notifications', ['user_id', 'type', 'title_ru', 'title_en', 'text_ru', 'text_en', 'link', 'is_read', 'created_at'], notifications, null, 800);

    // -----------------------------------------------------------------
    // 14. Журнал действий и подписчики
    // -----------------------------------------------------------------
    await insertMany(client, 'audit_log', ['user_id', 'action', 'entity', 'entity_id', 'old_data', 'new_data', 'ip', 'created_at'], [
      [U.owner, 'currency_rates.update', 'currency_rates', 2, JSON.stringify({ rate_to_byn: 3.1985 }), JSON.stringify({ rate_to_byn: 3.2051 }), '127.0.0.1', ts(NOW - 2 * DAY)],
      [U.owner, 'currency_rates.update', 'currency_rates', 3, JSON.stringify({ rate_to_byn: 3.4610 }), JSON.stringify({ rate_to_byn: 3.4722 }), '127.0.0.1', ts(NOW - 2 * DAY)],
      [U.owner, 'promo_codes.create', 'promo_codes', promo.GOTHIC15.id, null, JSON.stringify({ code: 'GOTHIC15', discount_percent: 15 }), '127.0.0.1', ts(NOW - 180 * DAY)],
      [U.moderator, 'seller_application.approve', 'seller_applications', 2, JSON.stringify({ status: 'pending' }), JSON.stringify({ status: 'approved' }), '127.0.0.1', ts(NOW - 320 * DAY)],
      [U.moderator, 'seller_application.reject', 'seller_applications', 7, JSON.stringify({ status: 'pending' }), JSON.stringify({ status: 'rejected', comment: 'Площадка не принимает реплики и копии.' }), '127.0.0.1', ts(NOW - 40 * DAY)],
      [U.moderator, 'user.block', 'users', userId['blocked.user@example.com'], JSON.stringify({ status: 'active' }), JSON.stringify({ status: 'blocked' }), '127.0.0.1', ts(NOW - 9 * DAY)],
      [U.moderator, 'product.reject', 'products', null, JSON.stringify({ moderation_status: 'pending' }), JSON.stringify({ moderation_status: 'rejected' }), '127.0.0.1', ts(NOW - DAY)],
      [U.owner, 'banners.update', 'banners', 1, JSON.stringify({ is_active: false }), JSON.stringify({ is_active: true }), '127.0.0.1', ts(NOW - 6 * DAY)],
    ]);
    await insertMany(client, 'newsletter_subscribers', ['email', 'lang', 'created_at'],
      BUYERS.slice(0, 14).map((b, i) => [b.email, i % 5 === 0 ? 'en' : 'ru', ts(NOW - randInt(5, 200) * DAY)]));

    await client.query('COMMIT');

    // -----------------------------------------------------------------
    // Итоговая сводка
    // -----------------------------------------------------------------
    const { rows: [summary] } = await client.query(`
      SELECT (SELECT COUNT(*) FROM brands) AS brands, (SELECT COUNT(*) FROM categories) AS categories,
             (SELECT COUNT(*) FROM collections) AS collections, (SELECT COUNT(*) FROM creative_directors) AS directors,
             (SELECT COUNT(*) FROM products) AS products, (SELECT COUNT(*) FROM products WHERE moderation_status = 'approved') AS approved,
             (SELECT COUNT(*) FROM product_variants) AS variants, (SELECT COUNT(*) FROM stock) AS stock_rows,
             (SELECT COUNT(*) FROM stock_movements) AS movements, (SELECT COUNT(*) FROM users) AS users,
             (SELECT COUNT(*) FROM orders) AS orders, (SELECT COUNT(*) FROM order_status_history) AS history,
             (SELECT COUNT(*) FROM reviews WHERE status = 'approved') AS reviews, (SELECT COUNT(*) FROM notifications) AS notifications,
             (SELECT COUNT(*) FROM brand_history_sections) AS history_sections`);
    const { rows: statusRows } = await client.query('SELECT status, COUNT(*) AS n FROM orders GROUP BY status ORDER BY n DESC');
    console.log('[seed] Готово за', ((Date.now() - started) / 1000).toFixed(1), 'с');
    console.table(summary);
    console.log('[seed] Заказы по статусам:', statusRows.map((r) => `${r.status}=${r.n}`).join(', '));
    console.log(`[seed] Пароль всех тестовых аккаунтов: ${TEST_PASSWORD}`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  try {
    await main();
  } catch (err) {
    console.error('[seed] Ошибка:', err.message);
    if (err.detail) console.error('       ', err.detail);
    if (err.where) console.error('       ', err.where);
    process.exitCode = 1;
  } finally {
    await stopEmbeddedPostgres();
  }
}
