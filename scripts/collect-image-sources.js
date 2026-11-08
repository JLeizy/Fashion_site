// Подбор источников реальных фотографий для бренда (правка П4): npm run images:collect -- --brand balenciaga
// Результат — записи в db/content/image-sources.json, которые затем скачивает `npm run images` (scripts/fetch-images.js).
//
// Откуда берутся фото (план по брендам — db/content/image-plan.js):
//   • товары:
//       – SSENSE (plan.ssense): страницы дизайнера открываются в Chromium (Playwright); для каждого товара из БД
//         подбирается реальная вещь бренда по категории, названию модели и цвету; ракурс _1 — основное фото
//         (предметная съёмка на белом фоне), _2 — второй ракурс для смены при наведении;
//       – Shopify-магазины (plan.shopify: официальный магазин Supreme, Dover Street Market для Chrome Hearts):
//         карточки со страниц каталога, фото и названия — из /products/<handle>.js (запрос из браузера);
//       – Vogue Runway (plan.productSeasons) — для марок, которых нет в магазинах: аксессуары, обувь и украшения —
//         кадры галереи деталей показа, одежда — образы показа (реальные вещи бренда, но не точная модель — так и
//         записано в примечании манифеста);
//     одна найденная вещь (или кадр) — одному товару;
//   • обложки коллекций, hero бренда, баннер главной — образы показов Vogue Runway того же сезона и года
//     (если показа сезона нет — мужской показ, кутюр, затем запасные сезоны плана);
//   • портреты креативных директоров и часть иллюстраций истории — главное изображение статьи Википедии
//     (миниатюра 960 px — так Wikimedia просит обращаться к ним автоматических клиентов);
//   • остальные иллюстрации истории — образы показов Vogue Runway нужной эпохи; если кадр не найден — неиспользованный
//     образ из запасных сезонов плана (без повторов).
// Таблицы БД (только чтение): brands, products, categories, product_images, collections, creative_directors,
// brand_history_sections, banners.
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
const VOGUE_SLUGS = [].concat(plan.vogue || []);
const toWebp = (url) => String(url).replace(/\.(svg|jpe?g|png)$/i, '.webp');

// ---------- Vogue Runway: образы показа (gallery: collection) и кадры деталей (gallery: details) ----------
const vogueCache = new Map();
async function vogueLooks(season, gallery = 'collection') {
  const key = `${season}|${gallery}`;
  if (vogueCache.has(key)) return vogueCache.get(key);
  let looks = [];
  for (const slug of VOGUE_SLUGS) {
    const page = `https://www.vogue.com/fashion-shows/${season}/${slug}${gallery === 'details' ? '/slideshow/details' : ''}`;
    try {
      const res = await fetch(page, { headers: { 'User-Agent': BROWSER_UA } });
      if (!res.ok) continue;
      const html = (await res.text()).replace(/\\u002F/g, '/');
      const re = /assets\.vogue\.com\/photos\/([a-f0-9]{16,})\/master\/[^/"\s]+\/((\d{3,5})-[^"?\s/]+\.jpg)/g;
      const byNum = new Map();
      let m;
      while ((m = re.exec(html))) {
        const [, id, file, num] = m;
        // В именах файлов Vogue слаг страницы встречается не всегда (у Margiela страница maison-martin-margiela,
        // а файлы …-margiela-…), поэтому допускается ключ из плана: plan.vogueFileKey.
        if (!file.includes(slug) && !(plan.vogueFileKey && file.includes(plan.vogueFileKey))) continue;
        const isDetail = file.includes('-details-');
        if ((gallery === 'details') !== isDetail) continue;
        if (!byNum.has(Number(num))) byNum.set(Number(num), { id, file });
      }
      looks = [...byNum.entries()].sort((a, b) => a[0] - b[0]).map(([num, { id, file }]) => ({ num, page, id, file, season }));
      if (looks.length) break;
    } catch (err) {
      console.warn(`[collect] Vogue ${season}/${slug}: ${err.message}`);
    }
  }
  vogueCache.set(key, looks);
  await sleep(700);
  return looks;
}
const vogueUrl = (look, width) => `https://assets.vogue.com/photos/${look.id}/master/w_${width},c_limit/${look.file}`;
const usedLooks = new Set(); // кадры Vogue, уже назначенные (чтобы не повторять одно фото)
const lookKey = (l) => `${l.id}`;
async function vogueLook(season, n, gallery = 'collection') {
  const looks = await vogueLooks(season, gallery);
  return looks.find((l) => l.num === n) || looks[n - 1] || null;
}
async function nextFreeLook(seasons, gallery = 'collection') {
  for (const season of seasons) {
    const looks = await vogueLooks(season, gallery);
    const free = looks.find((l) => !usedLooks.has(lookKey(l)));
    if (free) {
      usedLooks.add(lookKey(free));
      return free;
    }
  }
  return null;
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
    if (d.type === 'disambiguation') return null;
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

// ---------- Магазины: SSENSE и Shopify ----------
let browserPromise = null;
async function browser() {
  if (!browserPromise) browserPromise = loadPlaywright().then(({ chromium }) => chromium.launch());
  return browserPromise;
}
async function openPage(url) {
  const b = await browser();
  // Новый контекст на каждую страницу — без накопленных cookie, которые запускают защиту от ботов
  const ctx = await b.newContext({ userAgent: BROWSER_UA, viewport: { width: 1440, height: 1000 }, locale: 'en-US' });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(4500);
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, 2200);
    await page.waitForTimeout(700);
  }
  return { page, close: () => ctx.close() };
}

async function ssenseItems() {
  const items = new Map();
  for (const gender of ['men', 'women']) {
    for (let p = 1; p <= MAX_PAGES; p++) {
      const url = `https://www.ssense.com/en-us/${gender}/designers/${plan.ssense}${p > 1 ? `?page=${p}` : ''}`;
      let found = 0;
      let tilesCount = 0;
      try {
        const { page, close } = await openPage(url);
        const tiles = await page.evaluate(() =>
          [...document.querySelectorAll('a[href*="/product/"]')].map((a) => {
            const img = a.querySelector('img');
            return { href: a.href.split('?')[0], img: img ? img.currentSrc || img.src || img.getAttribute('data-src') || '' : '' };
          })
        );
        await close();
        tilesCount = tiles.length;
        for (const t of tiles) {
          const code = (t.img.match(/\/([0-9A-Z]+)_1\.jpg/) || [])[1];
          const slug = (t.href.match(/\/product\/[^/]+\/([^/]+)\/\d+/) || [])[1];
          if (!code || !slug || items.has(code)) continue;
          items.set(code, {
            code, slug, gender, page: t.href,
            images: [1, 2].map((a) => `https://img.ssensemedia.com/image/upload/b_white,c_lpad,g_center,ar_4:5/f_jpg,c_limit,w_900,q_90/${code}_${a}.jpg`),
          });
          found += 1;
        }
      } catch (err) {
        console.warn(`[collect] SSENSE ${url}: ${err.message}`);
      }
      console.log(`[collect] SSENSE ${gender} p.${p}: карточек ${tilesCount}, новых ${found}`);
      if (!tilesCount || (!found && p > 1)) break;
      await sleep(1500);
    }
  }
  return [...items.values()];
}

async function shopifyItems() {
  const { base, listings, vendor } = plan.shopify;
  const handles = new Map();
  for (const listing of listings) {
    try {
      const { page, close } = await openPage(base + listing);
      // Карточки каталога → handle товара; фото и название — из /products/<handle>.js (тот же источник, что у витрины)
      const found = await page.evaluate(async ({ vendor }) => {
        const hs = [...new Set([...document.querySelectorAll('a[href*="/products/"]')].map((a) => (a.pathname.match(/\/products\/([^/?#]+)/) || [])[1]).filter(Boolean))];
        // Фото и подпись из карточки каталога — на случай, если /products/<handle>.js закрыт защитой от ботов (Supreme)
        const tile = (h) => {
          const a = [...document.querySelectorAll(`a[href*="/products/${h}"]`)].find((x) => x.querySelector('img'));
          const img = a && a.querySelector('img');
          if (!img) return null;
          const src = img.currentSrc || img.src || '';
          const name = img.alt || (src.split('/').pop() || '').replace(/_\d+x\.\w+.*$/, '').replace(/[_]+/g, ' ');
          return { handle: h, title: name, type: '', images: [src] };
        };
        const out = [];
        for (const h of hs.slice(0, 160)) {
          try {
            const r = await fetch(`/products/${h}.js`);
            if (!r.ok) {
              const t = tile(h);
              if (t && t.images[0]) out.push(t);
              continue;
            }
            const j = await r.json();
            if (vendor && !String(j.vendor || '').toLowerCase().includes(vendor.toLowerCase())) continue;
            out.push({ handle: h, title: j.title, type: j.type, images: (j.images || []).slice(0, 2) });
          } catch {
            /* пропускаем товар */
          }
        }
        return out;
      }, { vendor });
      await close();
      found.forEach((f) => handles.set(f.handle, f));
      console.log(`[collect] Shopify ${listing}: товаров ${found.length}`);
    } catch (err) {
      console.warn(`[collect] Shopify ${listing}: ${err.message}`);
    }
    await sleep(1500);
  }
  return [...handles.values()]
    .filter((f) => f.images.length)
    .map((f) => {
      const abs = (u) => {
        const url = new URL((u.startsWith('//') ? `https:${u}` : u).replace(/_\d+x(\.\w+)/, '$1'), base);
        url.searchParams.set('width', '900');
        return url.href;
      };
      // Подписи из имён файлов вида BBSimonFurBomber разбиваются на слова, чтобы сработало сопоставление по категории
      const slug = `${f.title} ${f.type || ''}`.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      return { code: f.handle, slug, gender: 'unisex', page: `${base}/products/${f.handle}`, images: [abs(f.images[0]), abs(f.images[1] || f.images[0])] };
    });
}

// ---------- Официальный магазин на Salesforce Commerce (Chrome Hearts): категории → страницы товаров → фото ----------
async function sfccItems() {
  const { base, listings } = plan.sfcc;
  const pages = new Set();
  for (const listing of listings) {
    try {
      const { page, close } = await openPage(base + listing);
      // Категория с одним товаром сразу открывает его страницу — её тоже берём
      if (/\.html$/.test(page.url())) pages.add(page.url().split('?')[0]);
      const links = await page.$$eval('a[href$=".html"]', (as) => [...new Set(as.map((a) => a.href.split('?')[0]))]);
      links.filter((l) => l.startsWith(base) && !/(locations|magazine|terms|privacy|disclosure|general)\.html$/.test(l)).forEach((l) => pages.add(l));
      await close();
    } catch (err) {
      console.warn(`[collect] Магазин ${listing}: ${err.message}`);
    }
    await sleep(1200);
  }
  const items = [];
  for (const url of [...pages].slice(0, 80)) {
    try {
      const { page, close } = await openPage(url);
      const data = await page.evaluate(() => ({
        title: (document.querySelector('h1') || {}).textContent || document.title,
        imgs: [...new Set([...document.querySelectorAll('img')].map((i) => i.currentSrc || i.src).filter((s) => /img_products/.test(s)))],
      }));
      await close();
      if (!data.imgs.length) continue;
      const big = (u) => u.replace(/\?.*$/, '?sw=900&sh=1125');
      const slugPart = url.replace(base, '').replace(/\.html$/, '').split('/').filter(Boolean).join('-');
      const slug = `${data.title} ${slugPart}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      items.push({ code: slugPart, slug, gender: 'unisex', page: url, images: [big(data.imgs[0]), big(data.imgs[1] || data.imgs[0])] });
    } catch (err) {
      console.warn(`[collect] Товар ${url}: ${err.message}`);
    }
    await sleep(800);
  }
  console.log(`[collect] Официальный магазин: товаров с фото ${items.length} (страниц ${pages.size})`);
  return items;
}

// ---------- Сопоставление товаров БД с найденными вещами ----------
const CATEGORY_WORDS = {
  sneakers: ['sneaker', 'trainer', 'runner'], boots: ['boot'], loafers: ['loafer'], sandals: ['sandal', 'slide', 'mule', 'flip'],
  heels: ['heel', 'pump', 'slingback'], tshirts: ['t-shirt', 'tee', 'polo'], hoodies: ['hoodie', 'zip-up', 'sweatshirt'], sweaters: ['sweater', 'cardigan', 'knit'],
  shirts: ['shirt'], jackets: ['jacket', 'blazer', 'bomber', 'puffer'], coats: ['coat', 'trench', 'parka'], trousers: ['trouser', 'pant', 'sweatpant', 'lounge'],
  jeans: ['jeans', 'jean'], shorts: ['shorts', 'short'], dresses: ['dress'], skirts: ['skirt'], suits: ['suit'],
  totes: ['tote', 'shopper', 'bag'], crossbody: ['bag', 'crossbody'], backpacks: ['backpack'], clutches: ['clutch', 'pouch'],
  belts: ['belt'], sunglasses: ['sunglasses', 'glasses', 'eyewear'], headwear: ['cap', 'hat', 'beanie'], scarves: ['scarf'], wallets: ['wallet', 'card-holder', 'cardholder'],
  gloves: ['gloves', 'glove'], rings: ['ring'], chains: ['necklace', 'chain'], bracelets: ['bracelet', 'bangle'], earrings: ['earring', 'earrings'], pendants: ['pendant', 'necklace', 'charm'],
  'fragrance-men': ['fragrance', 'eau', 'parfum', 'perfume'], 'fragrance-women': ['fragrance', 'eau', 'parfum', 'perfume'], 'fragrance-unisex': ['fragrance', 'eau', 'parfum', 'perfume'],
};
const ACCESSORY = new Set(['sneakers', 'boots', 'loafers', 'sandals', 'heels', 'totes', 'crossbody', 'backpacks', 'clutches', 'belts', 'sunglasses', 'headwear', 'scarves', 'wallets', 'gloves', 'rings', 'chains', 'bracelets', 'earrings', 'pendants', 'fragrance-men', 'fragrance-women', 'fragrance-unisex']);
const COLOR_WORDS = { grey: ['gray', 'grey'], navy: ['navy'], beige: ['beige', 'taupe', 'off-white'], silver: ['silver'], gold: ['gold'] };
const STOP = new Set(['the', 'and', 'of', 'a', 'small', 'medium', 'large', 'extra', 'mini', 'sample', 'de', 'la', 'le', 'no']);
const EXCLUDE = ['charm', 'keychain', 'keyring', 'dust', 'case', 'strap', 'socks', 'sock', 'sticker', 'skateboard', 'deck'];

function matchProducts(products, items) {
  const used = new Set();
  const result = new Map();
  const info = products.map((p) => ({
    p,
    catWords: CATEGORY_WORDS[p.category] || [p.category.replace(/s$/, '')],
    tokens: p.name_en.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1 && !STOP.has(t) && !(CATEGORY_WORDS[p.category] || []).some((w) => w.startsWith(t))),
    colors: COLOR_WORDS[p.color] || [p.color],
  }));
  const describe = (x, it) => {
    const words = it.slug.split('-');
    // Категория — по целым словам (bag ≠ baggy), составные ключи вида t-shirt, card-holder — как подстрока
    const catOk = !EXCLUDE.some((e) => words.includes(e) && !x.catWords.includes(e)) && x.catWords.some((w) => (w.includes('-') ? it.slug.includes(w) : words.includes(w) || words.includes(`${w}s`)));
    const model = x.tokens.length ? x.tokens.filter((t) => words.includes(t)).length / x.tokens.length : 0;
    const colorOk = x.colors.some((c) => it.slug.startsWith(`${c}-`) || words.includes(c));
    const genderOk = x.p.gender === 'unisex' || it.gender === 'unisex' || it.gender === x.p.gender;
    return { catOk, model, colorOk, genderOk };
  };
  // Проходы от самого точного к самому общему: модель + цвет → модель → категория + цвет → категория
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
  const baseOf = (p) => p.img1.replace(/-1\.(svg|webp)$/, '');

  // ---------- Товары ----------
  let matched = 0;
  let exact = 0;
  let shopItems = [];
  if (plan.ssense || plan.shopify || plan.sfcc) {
    const items = plan.ssense ? await ssenseItems() : plan.sfcc ? await sfccItems() : await shopifyItems();
    shopItems = items;
    console.log(`[collect] Найдено вещей в магазине: ${items.length}`);
    const matches = matchProducts(products, items);
    for (const p of products) {
      const m = matches.get(p.sku);
      if (!m) continue;
      matched += 1;
      if (m.exact) exact += 1;
      const shop = plan.ssense ? 'SSENSE' : new URL(m.page).hostname;
      const note = `${shop}: ${m.slug}${m.exact ? '' : ' (ближайшая вещь той же категории)'}${m.colorOk ? '' : `; цвет на фото не совпадает с «${p.color}»`}`;
      add(`${baseOf(p)}-1.webp`, 'product', m.page, m.images[0], note);
      add(`${baseOf(p)}-2.webp`, 'product', m.page, m.images[1], note);
    }
    // Марки без показов и с узким онлайн-ассортиментом (plan.shopFallback): товарам без пары — фото другой вещи бренда
    // из официального магазина той же группы (одежда / аксессуары); в источнике это честно помечено.
    if (plan.shopFallback && items.length) {
      const usedCodes = new Set([...matches.values()].map((m) => m.code));
      const isAcc = (slug) => Object.entries(CATEGORY_WORDS).some(([cat, ws]) => ACCESSORY.has(cat) && ws.some((w) => slug.split('-').includes(w)));
      let i = 0;
      for (const p of products) {
        if (matches.get(p.sku)) continue;
        const wantAcc = ACCESSORY.has(p.category);
        const pool = items.filter((it) => isAcc(it.slug) === wantAcc);
        const list = pool.length ? pool : items;
        const it = list.find((x) => !usedCodes.has(x.code)) || list[i++ % list.length];
        usedCodes.add(it.code);
        matched += 1;
        const shop = new URL(it.page).hostname;
        const note = `${shop}: ${it.slug} (вещь бренда из официального магазина, не эта модель)`;
        add(`${baseOf(p)}-1.webp`, 'product', it.page, it.images[0], note);
        add(`${baseOf(p)}-2.webp`, 'product', it.page, it.images[1], note);
      }
    }
  } else if (plan.productSeasons) {
    // Марки без магазинов: кадры деталей (аксессуары) и образы (одежда) с показов Vogue Runway, без повторов
    for (const p of products) {
      const gallery = ACCESSORY.has(p.category) ? 'details' : 'collection';
      const a = (await nextFreeLook(plan.productSeasons, gallery)) || (await nextFreeLook(plan.productSeasons, 'collection'));
      const b = (await nextFreeLook(plan.productSeasons, gallery)) || a;
      if (!a) continue;
      matched += 1;
      const note = `Vogue Runway, ${a.season}${gallery === 'details' ? ', деталь показа' : ', образ показа'} (реальная вещь бренда, не точная модель)`;
      add(`${baseOf(p)}-1.webp`, 'product', a.page, vogueUrl(a, 900), note);
      add(`${baseOf(p)}-2.webp`, 'product', b.page, vogueUrl(b, 900), note);
    }
  }
  console.log(`[collect] Товары: подобрано ${matched} из ${products.length} (точное совпадение модели — ${exact})`);

  // ---------- Коллекции, hero, баннер — Vogue Runway ----------
  const seasonCandidates = (c) => {
    const s = { SS: 'spring', FW: 'fall', Resort: 'resort', 'Pre-Fall': 'pre-fall' }[c.season] || 'spring';
    if (s === 'resort' || s === 'pre-fall') return [`${s}-${c.year}`];
    return [`${s}-${c.year}-ready-to-wear`, `${s}-${c.year}-menswear`, `${s}-${c.year}-couture`];
  };
  let newest = null;
  for (const c of collections) {
    let look = null;
    for (const season of seasonCandidates(c)) {
      look = await vogueLook(season, 1);
      if (look) break;
    }
    if (!look && plan.fallbackSeasons) look = await nextFreeLook(plan.fallbackSeasons);
    if (!look) continue;
    usedLooks.add(lookKey(look));
    add(c.cover_image, 'collection', look.page, vogueUrl(look, 900), `Vogue Runway, ${look.season}, образ ${look.num}`);
    newest = look;
  }
  if (newest) {
    add(brand.hero_image, 'hero', newest.page, vogueUrl(newest, 1600), `Vogue Runway, ${newest.season}, образ ${newest.num}`);
    const bannerLook = (await vogueLook(newest.season, 2)) || newest;
    usedLooks.add(lookKey(bannerLook));
    banners.forEach((b) => add(b.image, 'banner', bannerLook.page, vogueUrl(bannerLook, 1600), `Vogue Runway, ${bannerLook.season}, образ ${bannerLook.num}`));
  }

  // ---------- Директора — Википедия ----------
  for (const d of directors) {
    const title = plan.directors?.[d.name] === undefined ? d.name : plan.directors[d.name];
    if (!title) continue; // null в плане — портрета нет (например, «дизайн-студия»)
    const img = await wikiImage(title);
    if (img) add(d.photo, 'director', img.page, img.url, `Википедия: ${title}`);
  }

  // ---------- Иллюстрации истории ----------
  for (const s of sections) {
    let done = false;
    for (const cand of plan.history?.[s.sort_order - 1] || []) {
      if (cand.wiki) {
        const img = await wikiImage(cand.wiki);
        if (img) {
          add(s.image, 'history', img.page, img.url, `Википедия: ${cand.wiki}`);
          done = true;
        }
      } else if (cand.vogue) {
        const look = await vogueLook(cand.vogue, cand.look || 1);
        if (look && !usedLooks.has(lookKey(look))) {
          usedLooks.add(lookKey(look));
          add(s.image, 'history', look.page, vogueUrl(look, 900), `Vogue Runway, ${cand.vogue}, образ ${look.num}`);
          done = true;
        }
      }
      if (done) break;
    }
    if (!done && plan.fallbackSeasons) {
      const look = await nextFreeLook(plan.fallbackSeasons);
      if (look) add(s.image, 'history', look.page, vogueUrl(look, 900), `Vogue Runway, ${look.season}, образ ${look.num}`);
    }
  }
  // Марки без показов на Vogue (plan.shopFallback): коллекции, обложка и разделы истории без иллюстрации получают
  // фото вещей бренда из официального магазина — по одному снимку, без повторов, пока они есть.
  if (plan.shopFallback && shopItems.length) {
    const taken = new Set(out.map((o) => o.target));
    let k = 0;
    const nextShop = () => {
      const it = shopItems[k % shopItems.length];
      const img = it.images[Math.floor(k / shopItems.length) % 2];
      k += 1;
      return { it, img };
    };
    const fill = (target, kind) => {
      if (!target || taken.has(toWebp(target))) return;
      const { it, img } = nextShop();
      add(target, kind, it.page, img, `${new URL(it.page).hostname}: ${it.slug} (вещь бренда из официального магазина, иллюстрация)`);
      taken.add(toWebp(target));
    };
    collections.forEach((c) => fill(c.cover_image, 'collection'));
    fill(brand.hero_image, 'hero');
    banners.forEach((b) => fill(b.image, 'banner'));
    sections.forEach((s) => fill(s.image, 'history'));
  }
  if (browserPromise) await (await browserPromise).close();

  // Слияние со списком источников: записи этого бренда заменяются целиком
  const existing = fs.existsSync(SOURCES) ? JSON.parse(fs.readFileSync(SOURCES, 'utf8')) : [];
  const mine = (t) => t.includes(`/brands/${BRAND}/`) || t.includes(`/banners/${BRAND}.`);
  const merged = [...existing.filter((s) => !mine(s.target)), ...out];
  fs.writeFileSync(SOURCES, `${JSON.stringify(merged, null, 2)}\n`);
  const count = (k) => out.filter((o) => o.kind === k).length;
  console.log(`[collect] ${BRAND}: товары ${count('product')}, коллекции ${count('collection')}/${collections.length}, hero ${count('hero')}, баннеры ${count('banner')}, директора ${count('director')}/${directors.length}, история ${count('history')}/${sections.length}`);
  console.log('[collect] Дальше: npm run images -- --brand ' + BRAND);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
