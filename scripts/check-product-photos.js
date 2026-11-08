// Проверка: совпадает ли вещь на фото товара с его категорией (npm run images:check).
// Что делает: для каждого товара берёт источник первого фото из db/content/image-sources.json и ищет в названии вещи
// слова категории (ремень → belt, кольцо → ring …). Фото с показов Vogue (образы целиком) не проверяются — по ним
// категорию по названию не определить. Печатает несовпадения (--list), исправляет их (--fix).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { config } from '../config/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCES = path.join(ROOT, 'db', 'content', 'image-sources.json');

// Слова категорий — те же, что в scripts/collect-image-sources.js (сопоставление товаров)
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

const sources = JSON.parse(fs.readFileSync(SOURCES, 'utf8'));
const db = new pg.Client(config.db);
await db.connect();
// SQL: товары каталога с брендом и категорией (только чтение)
const { rows } = await db.query(
  `SELECT p.sku, b.slug AS brand, c.slug AS category, p.name_en FROM products p
     JOIN brands b ON b.id = p.brand_id JOIN categories c ON c.id = p.category_id ORDER BY b.slug, p.sku`);
await db.end();

const bad = [];
let checked = 0;
for (const p of rows) {
  const e = sources.find((s) => s.target === `/images/brands/${p.brand}/products/${p.sku}-1.webp`);
  if (!e || /Vogue Runway/.test(e.note || '')) continue;
  checked += 1;
  const item = ((e.note || '').match(/:\s*([^ (;]+)/) || [])[1] || '';
  const words = item.toLowerCase().split('-');
  const want = CATEGORY_WORDS[p.category] || [p.category.replace(/s$/, '')];
  const ok = want.some((w) => (w.includes('-') ? item.includes(w) : words.includes(w) || words.includes(`${w}s`)));
  if (!ok) bad.push({ sku: p.sku, brand: p.brand, category: p.category, name: p.name_en, photo: item });
}
const by = {};
bad.forEach((b) => { by[b.brand] = (by[b.brand] || 0) + 1; });
console.log(`[check] Проверено товаров с фото из магазинов: ${checked}; несовпадений категории: ${bad.length}`, JSON.stringify(by));
if (process.argv.includes('--list')) bad.forEach((b) => console.log(`${b.sku} | ${b.category} | ${b.name} | фото: ${b.photo}`));
// --fix: товару с вещью другой категории — фото вещи той же категории этого бренда из уже найденных снимков;
// если такой нет — товар исключается из каталога (db/content/excluded-products.json), его фото удаляются
if (process.argv.includes('--fix')) {
  const PUBLIC = path.join(ROOT, 'public');
  const EXCLUDED = path.join(ROOT, 'db', 'content', 'excluded-products.json');
  const excluded = fs.existsSync(EXCLUDED) ? JSON.parse(fs.readFileSync(EXCLUDED, 'utf8')) : {};
  const itemOf = (e) => (((e && e.note) || '').match(/:\s*([^ (;]+)/) || [])[1] || '';
  const fitsCat = (item, cat) => {
    const words = item.toLowerCase().split('-');
    return (CATEGORY_WORDS[cat] || [cat.replace(/s$/, '')]).some((w) => (w.includes('-') ? item.includes(w) : words.includes(w) || words.includes(`${w}s`)));
  };
  let replaced = 0;
  let removed = 0;
  for (const b of bad) {
    // Кандидаты — снимки других товаров того же бренда, на которых вещь нужной категории
    const donors = sources.filter((e) => e.kind === 'product' && /-1\.webp$/.test(e.target) && e.target.includes(`/brands/${b.brand}/`)
      && !/Vogue Runway/.test(e.note || '') && fitsCat(itemOf(e), b.category) && fs.existsSync(path.join(PUBLIC, e.target)));
    const base = `/images/brands/${b.brand}/products/${b.sku}`;
    if (donors.length) {
      const d = donors[replaced % donors.length];
      const dBase = d.target.replace(/-1\.webp$/, '');
      for (const n of [1, 2]) {
        const from = path.join(PUBLIC, `${dBase}-${n}.webp`);
        const to = path.join(PUBLIC, `${base}-${n}.webp`);
        if (fs.existsSync(from)) fs.copyFileSync(from, to);
        const src = sources.find((e) => e.target === `${dBase}-${n}.webp`) || d;
        const i = sources.findIndex((e) => e.target === `${base}-${n}.webp`);
        const entry = { ...src, target: `${base}-${n}.webp`, note: `${(src.note || '').replace(/\s*\(.*\)\s*$/, '')} (вещь той же категории этого бренда, не эта модель)` };
        if (i >= 0) sources[i] = entry;
        else sources.push(entry);
      }
      replaced += 1;
    } else {
      (excluded[b.brand] = excluded[b.brand] || []).includes(b.sku) || excluded[b.brand].push(b.sku);
      for (const n of [1, 2]) {
        const f = path.join(PUBLIC, `${base}-${n}.webp`);
        if (fs.existsSync(f)) fs.unlinkSync(f);
      }
      removed += 1;
    }
  }
  fs.writeFileSync(SOURCES, `${JSON.stringify(sources, null, 2)}\n`);
  fs.writeFileSync(EXCLUDED, `${JSON.stringify(excluded, null, 2)}\n`);
  console.log(`[check] Исправлено фото той же категории: ${replaced}; исключено товаров без подходящего фото: ${removed}`);
}
if (process.argv.includes('--json')) fs.writeFileSync(process.argv[process.argv.indexOf('--json') + 1], JSON.stringify(bad, null, 2));
