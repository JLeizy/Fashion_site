// Подбор источников реальных фотографий для бренда (правка П4): npm run images:collect -- --brand balenciaga
// Результат — записи в db/content/image-sources.json, которые затем скачивает `npm run images` (scripts/fetch-images.js).
//
// Откуда берутся фото (план — db/content/image-plan.js):
//   • товары — SSENSE: страницы дизайнера (мужское и женское) открываются в Chromium (Playwright), для каждого товара
//     из БД подбирается реальная вещь того же бренда по категории, названию модели и цвету; ракурс _1 — основное фото
//     (предметная съёмка на белом фоне), _2 — второй ракурс для смены при наведении. Одна вещь SSENSE — одному товару;
//   • обложки коллекций, hero бренда, баннер главной — образы показов Vogue Runway того же сезона и года;
//   • портреты креативных директоров и часть иллюстраций истории — главное изображение статьи Википедии;
//   • остальные иллюстрации истории — образы показов Vogue Runway нужной эпохи.
// Таблицы БД (только чтение): brands, products, categories, collections, creative_directors, brand_history_sections, banners.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { ensureProxyAwareFetch, loadPlaywright, uaFor, sleep, BROWSER_UA } from './lib/net.js';
import { config } from '../config/index.js';
import { IMAGE_PLAN } from '../db/content/image-plan.js';

ensureProxyAwareFetch();

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCES = path.join(ROOT, 'db', 'content', 'image-sources.json');
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
};
const BRAND = opt('brand');
const MAX_PAGES = Number(opt('pages') || 5);
if (!BRAND || !IMAGE_PLAN[BRAND]) {
  console.error(`Укажите бренд из db/content/image-plan.js: --brand ${Object.keys(IMAGE_PLAN).join('|')}`);
  process.exit(1);
}
const plan = IMAGE_PLAN[BRAND];
const toWebp = (url) => String(url).replace(/\.(svg|jpe?g|png)$/i, '.webp');

// ---------- Vogue Runway: список образов показа ----------
const vogueCache = new Map();
async function vogueLooks(season) {
  if (vogueCache.has(season)) return vogueCache.get(season);
  const page = `https://www.vogue.com/fashion-shows/${season}/${plan.vogue}`;
  let looks = [];
  try {
    const res = await fetch(page, { headers: { 'User-Agent': BROWSER_UA } });
    if (res.ok) {
      const html = (await res.text()).replace(/\\u002F/g, '/');
      const re = /assets\.vogue\.com\/photos\/([a-f0-9]{16,})\/master\/[^/"\s]+\/((\d{3,5})-[^"?\s/]+\.jpg)/g;
      const byNum = new Map();
      let m;
      while ((m = re.exec(html))) {
        const [, id, file, num] = m;
        if (!file.includes(plan.vogue)) continue;
        if (!byNum.has(Number(num))) byNum.set(Number(num), { id, file });
      }
      looks = [...byNum.entries()].sort((a, b) => a[0] - b[0]).map(([num, { id, file }]) => ({ num, page, id, file }));
    }
  } catch (err) {
    console.warn(`[collect] Vogue ${season}: ${err.message}`);
  }
  vogueCache.set(season, looks);
  await sleep(700);
  return looks;
}
const vogueUrl = (look, width) => `https://assets.vogue.com/photos/${look.id}/master/w_${width},c_limit/${look.file}`;
async function vogueLook(season, n) {
  const looks = await vogueLooks(season);
  return looks.find((l) => l.num === n) || looks[n - 1] || null;
}

// ---------- Википедия: главное изображение статьи ----------
async function wikiImage(title) {
  try {
    let res;
    for (let attempt = 0; attempt < 4; attempt++) {
      res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`, { headers: { 'User-Agent': uaFor('wikipedia.org') } });
      if (res.status !== 429 && res.status < 500) break;
      await sleep(3000 * (attempt + 1)); // лимит частоты Wikimedia — ждём и повторяем
    }
    if (!res.ok) return null;
    const d = await res.json();
    const src = d.originalimage?.source || d.thumbnail?.source;
    if (!src || /\.svg(\?|$)/i.test(src)) return null; // логотипы и схемы в SVG не берём
    // Wikimedia просит автоматических клиентов брать миниатюры стандартных размеров, а не оригиналы
    const clean = src.split('?')[0];
    const m = clean.match(/^(https:\/\/upload\.wikimedia\.org\/wikipedia\/[^/]+)\/(?!thumb\/)([0-9a-f]\/[0-9a-f]{2})\/([^/]+)$/);
    const url = m ? `${m[1]}/thumb/${m[2]}/${m[3]}/960px-${m[3]}` : clean;
    return { url, page: d.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}` };
  } catch {
    return null;
  } finally {
    await sleep(500);
  }
}

// ---------- SSENSE: товары дизайнера ----------
async function ssenseItems() {
  if (!plan.ssense) return [];
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch();
  const items = new Map();
  for (const gender of ['men', 'women']) {
    for (let p = 1; p <= MAX_PAGES; p++) {
      // Новый контекст на каждую страницу — без накопленных cookie, которые запускают защиту от ботов
      const ctx = await browser.newContext({ userAgent: BROWSER_UA, viewport: { width: 1440, height: 1000 }, locale: 'en-US' });
      const page = await ctx.newPage();
      const url = `https://www.ssense.com/en-us/${gender}/designers/${plan.ssense}${p > 1 ? `?page=${p}` : ''}`;
      let found = 0;
      let tilesCount = 0;
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(4500);
        for (let i = 0; i < 6; i++) {
          await page.mouse.wheel(0, 2200);
          await page.waitForTimeout(700);
        }
        const tiles = await page.evaluate(() =>
          [...document.querySelectorAll('a[href*="/product/"]')].map((a) => {
            const img = a.querySelector('img');
            return { href: a.href.split('?')[0], img: img ? img.currentSrc || img.src || img.getAttribute('data-src') || '' : '' };
          })
        );
        tilesCount = tiles.length;
        for (const t of tiles) {
          const code = (t.img.match(/\/([0-9A-Z]+)_1\.jpg/) || [])[1];
          const slug = (t.href.match(/\/product\/[^/]+\/([^/]+)\/\d+/) || [])[1];
          if (!code || !slug || items.has(code)) continue;
          items.set(code, { code, slug, gender, page: t.href });
          found += 1;
        }
      } catch (err) {
        console.warn(`[collect] SSENSE ${url}: ${err.message}`);
      }
      await ctx.close();
      console.log(`[collect] SSENSE ${gender} p.${p}: карточек ${tilesCount}, новых ${found}`);
      if (!tilesCount || (!found && p > 1)) break;
      await sleep(1500);
    }
  }
  await browser.close();
  return [...items.values()];
}

// Ключевые слова категорий в названиях SSENSE
const CATEGORY_WORDS = {
  sneakers: ['sneaker', 'trainer', 'runner'], boots: ['boot'], loafers: ['loafer'], sandals: ['sandal', 'slide', 'mule', 'flip'],
  heels: ['heel', 'pump', 'slingback'], tshirts: ['t-shirt', 'tee', 'polo'], hoodies: ['hoodie', 'zip-up'], sweaters: ['sweater', 'cardigan', 'knit'],
  shirts: ['shirt'], jackets: ['jacket', 'blazer', 'bomber', 'puffer'], coats: ['coat', 'trench', 'parka'], trousers: ['trouser', 'pant', 'sweatpant', 'lounge'],
  jeans: ['jeans'], shorts: ['shorts'], dresses: ['dress'], skirts: ['skirt'], suits: ['suit'],
  totes: ['tote', 'shopper', 'bag'], crossbody: ['bag', 'crossbody'], backpacks: ['backpack'], clutches: ['clutch', 'pouch'],
  belts: ['belt'], sunglasses: ['sunglasses', 'glasses'], headwear: ['cap', 'hat', 'beanie'], scarves: ['scarf'], wallets: ['wallet', 'card-holder', 'cardholder'],
  gloves: ['gloves'], rings: ['ring'], chains: ['necklace', 'chain'], bracelets: ['bracelet'], earrings: ['earring'], pendants: ['pendant', 'necklace'],
  'fragrance-men': ['fragrance', 'eau', 'parfum'], 'fragrance-women': ['fragrance', 'eau', 'parfum'], 'fragrance-unisex': ['fragrance', 'eau', 'parfum'],
};
const COLOR_WORDS = { grey: ['gray', 'grey'], navy: ['navy'], beige: ['beige', 'taupe', 'off-white'], silver: ['silver'], gold: ['gold'] };
const STOP = new Set(['the', 'and', 'of', 'a', 'small', 'medium', 'large', 'extra', 'mini', 'sample', 'de', 'la', 'le', 'no']);

function matchProducts(products, items) {
  const used = new Set();
  const result = new Map();
  const info = products.map((p) => ({
    p,
    catWords: CATEGORY_WORDS[p.category] || [p.category.replace(/s$/, '')],
    tokens: p.name_en.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1 && !STOP.has(t) && !(CATEGORY_WORDS[p.category] || []).some((w) => w.startsWith(t))),
    colors: COLOR_WORDS[p.color] || [p.color],
  }));
  // Мелочи, которые не подходят ни одной категории товаров: брелоки, подвески-чармы, пыльники, чехлы
  const EXCLUDE = ['charm', 'keychain', 'keyring', 'dust', 'pouch-keychain', 'case', 'strap', 'socks', 'sock'];
  const describe = (x, it) => {
    const words = it.slug.split('-');
    // Категория — по целым словам (bag ≠ baggy), составные ключи вида t-shirt, card-holder — как подстрока
    const catOk = !EXCLUDE.some((e) => words.includes(e)) && x.catWords.some((w) => (w.includes('-') ? it.slug.includes(w) : words.includes(w) || words.includes(`${w}s`)));
    const model = x.tokens.length ? x.tokens.filter((t) => words.includes(t)).length / x.tokens.length : 0;
    const colorOk = x.colors.some((c) => it.slug.startsWith(`${c}-`) || words.includes(c));
    const genderOk = x.p.gender === 'unisex' || it.gender === x.p.gender;
    return { catOk, model, colorOk, genderOk };
  };
  // Проходы от самого точного к самому общему: модель + цвет → модель → категория + цвет → категория.
  // Так точное совпадение не «уводит» товар, которому оно подходит лучше
  const passes = [
    (d) => d.catOk && d.model >= 0.99 && d.colorOk,
    (d) => d.catOk && d.model >= 0.99,
    (d) => d.catOk && d.model >= 0.5 && d.colorOk,
    (d) => d.catOk && d.model >= 0.5,
    (d) => d.catOk && d.colorOk && d.genderOk,
    (d) => d.catOk,
  ];
  passes.forEach((ok, pass) => {
    for (const x of info) {
      if (result.has(x.p.sku)) continue;
      const it = items.find((i) => !used.has(i.code) && ok(describe(x, i)));
      if (!it) continue;
      used.add(it.code);
      const d = describe(x, it);
      result.set(x.p.sku, { ...it, colorOk: d.colorOk, exact: pass <= 1 });
    }
  });
  return result;
}
const ssenseUrl = (code, angle) => `https://img.ssensemedia.com/image/upload/b_white,c_lpad,g_center,ar_4:5/f_jpg,c_limit,w_900,q_90/${code}_${angle}.jpg`;

async function main() {
  const db = new pg.Client(config.db);
  await db.connect();
  // SQL: данные бренда для подбора фото (только чтение)
  const { rows: [brand] } = await db.query('SELECT id, slug, hero_image FROM brands WHERE slug = $1', [BRAND]);
  const products = (await db.query(
    `SELECT p.sku, p.name_en, p.color, p.gender, c.slug AS category,
            (SELECT url FROM product_images WHERE product_id = p.id ORDER BY sort_order LIMIT 1) AS img1
       FROM products p JOIN categories c ON c.id = p.category_id WHERE p.brand_id = $1 ORDER BY p.id`, [brand.id])).rows;
  const collections = (await db.query('SELECT name, season, year, cover_image FROM collections WHERE brand_id = $1 ORDER BY year, season', [brand.id])).rows;
  const directors = (await db.query('SELECT name, photo FROM creative_directors WHERE brand_id = $1 ORDER BY id', [brand.id])).rows;
  const sections = (await db.query('SELECT sort_order, image FROM brand_history_sections WHERE brand_id = $1 ORDER BY sort_order', [brand.id])).rows;
  const banners = (await db.query('SELECT image FROM banners WHERE link = $1', [`/brand/${BRAND}`])).rows;
  await db.end();

  const out = [];
  const add = (target, kind, page, url, note) => out.push({ target: toWebp(target), kind, page, url, note: note || null });

  // Товары
  const items = await ssenseItems();
  console.log(`[collect] SSENSE: найдено вещей ${items.length}`);
  const matches = matchProducts(products, items);
  let exact = 0;
  for (const p of products) {
    const m = matches.get(p.sku);
    if (!m) continue;
    if (m.exact) exact += 1;
    const base = p.img1.replace(/-1\.(svg|webp)$/, '');
    const note = `SSENSE: ${m.slug}${m.exact ? '' : ' (ближайшая вещь той же категории)'}${m.colorOk ? '' : `; цвет на фото не совпадает с «${p.color}»`}`;
    add(`${base}-1.webp`, 'product', m.page, ssenseUrl(m.code, 1), note);
    add(`${base}-2.webp`, 'product', m.page, ssenseUrl(m.code, 2), note);
  }
  console.log(`[collect] Товары: подобрано ${matches.size} из ${products.length} (точное совпадение модели — ${exact})`);

  // Коллекции, hero, баннер — Vogue Runway
  const seasonSlug = (c) => {
    const s = { SS: 'spring', FW: 'fall', Resort: 'resort', 'Pre-Fall': 'pre-fall' }[c.season] || 'spring';
    return s === 'resort' || s === 'pre-fall' ? `${s}-${c.year}` : `${s}-${c.year}-ready-to-wear`;
  };
  let newest = null;
  for (const c of collections) {
    const look = await vogueLook(seasonSlug(c), 1);
    if (!look) continue;
    add(c.cover_image, 'collection', look.page, vogueUrl(look, 900), `Vogue Runway, ${seasonSlug(c)}, образ ${look.num}`);
    newest = { c, slug: seasonSlug(c) };
  }
  if (newest) {
    const heroLook = await vogueLook(newest.slug, 1);
    add(brand.hero_image, 'hero', heroLook.page, vogueUrl(heroLook, 1600), `Vogue Runway, ${newest.slug}, образ ${heroLook.num}`);
    const bannerLook = (await vogueLook(newest.slug, 2)) || heroLook;
    banners.forEach((b) => add(b.image, 'banner', bannerLook.page, vogueUrl(bannerLook, 1600), `Vogue Runway, ${newest.slug}, образ ${bannerLook.num}`));
  }

  // Директора — Википедия
  for (const d of directors) {
    const img = await wikiImage(plan.directors?.[d.name] || d.name);
    if (img) add(d.photo, 'director', img.page, img.url, `Википедия: ${plan.directors?.[d.name] || d.name}`);
  }

  // Иллюстрации истории
  for (const s of sections) {
    const candidates = plan.history?.[s.sort_order - 1] || [];
    for (const cand of candidates) {
      if (cand.wiki) {
        const img = await wikiImage(cand.wiki);
        if (img) {
          add(s.image, 'history', img.page, img.url, `Википедия: ${cand.wiki}`);
          break;
        }
      } else if (cand.vogue) {
        const look = await vogueLook(cand.vogue, cand.look || 1);
        if (look) {
          add(s.image, 'history', look.page, vogueUrl(look, 900), `Vogue Runway, ${cand.vogue}, образ ${look.num}`);
          break;
        }
      }
    }
  }

  // Слияние со списком источников: записи этого бренда заменяются целиком
  const existing = fs.existsSync(SOURCES) ? JSON.parse(fs.readFileSync(SOURCES, 'utf8')) : [];
  const mine = (t) => t.includes(`/brands/${BRAND}/`) || t.includes(`/banners/${BRAND}.`);
  const merged = [...existing.filter((s) => !mine(s.target)), ...out];
  fs.writeFileSync(SOURCES, `${JSON.stringify(merged, null, 2)}\n`);
  const count = (k) => out.filter((o) => o.kind === k).length;
  console.log(`[collect] ${BRAND}: товары ${count('product')}, коллекции ${count('collection')}, hero ${count('hero')}, баннеры ${count('banner')}, директора ${count('director')}, история ${count('history')} из ${sections.length}`);
  console.log('[collect] Дальше: npm run images -- --brand ' + BRAND);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
