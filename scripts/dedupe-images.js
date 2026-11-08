// Проверка и устранение повторов фото: npm run images:dedupe
//   • у товара второй ракурс совпадает с первым байт в байт — второй убираем (товар показывает одно фото);
//   • иллюстрация истории совпадает с другой иллюстрацией истории, обложкой коллекции или hero бренда —
//     у раздела остаётся текст без картинки (повторов на странице бренда и в истории не бывает).
//   • тот же снимок под другим именем файла (Vogue публикует совместные показы дважды) — по перцептивному хешу
//     16×16 и средней разнице пикселей: повтор выхода в лукбуке убирается, «портрет» директора, совпавший с кадром, — тоже (будут инициалы),
//     иллюстрация истории, совпавшая с чем-то ещё, — убирается.
// Обложка коллекции = первый выход её лукбука — так задумано, это не повтор.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const BRANDS_DIR = path.join(PUBLIC, 'images', 'brands');
const CATALOG = path.join(ROOT, 'db', 'content', 'catalog');
const SOURCES = path.join(ROOT, 'db', 'content', 'image-sources.json');
const md5 = (file) => crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');

let productFixes = 0;
let historyFixes = 0;
const removed = new Set();
// 1. Товары: второй ракурс = первый
for (const f of fs.readdirSync(CATALOG).filter((x) => x.endsWith('.json'))) {
  const file = path.join(CATALOG, f);
  const items = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const it of items) {
    if (it.images.length < 2) continue;
    const first = md5(path.join(PUBLIC, it.images[0]));
    const keep = [it.images[0]];
    for (const img of it.images.slice(1)) {
      if (md5(path.join(PUBLIC, img)) === first) {
        fs.rmSync(path.join(PUBLIC, img), { force: true });
        removed.add(img);
        productFixes += 1;
      } else keep.push(img);
    }
    it.images = keep;
    if (it.image_urls) it.image_urls = it.image_urls.slice(0, keep.length);
  }
  fs.writeFileSync(file, `${JSON.stringify(items, null, 1)}\n`);
}
// 2. История: повтор другой иллюстрации истории, обложки коллекции или hero
for (const brand of fs.readdirSync(BRANDS_DIR)) {
  const dir = path.join(BRANDS_DIR, brand);
  const seen = new Map();
  const reserve = (rel) => {
    const abs = path.join(dir, rel);
    if (fs.existsSync(abs)) seen.set(md5(abs), rel);
  };
  reserve('hero.webp');
  const colDir = path.join(dir, 'collections');
  if (fs.existsSync(colDir)) for (const f of fs.readdirSync(colDir).filter((x) => x.endsWith('.webp'))) reserve(`collections/${f}`);
  const histDir = path.join(dir, 'history');
  if (!fs.existsSync(histDir)) continue;
  const files = fs.readdirSync(histDir).filter((x) => x.endsWith('.webp')).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  for (const f of files) {
    const abs = path.join(histDir, f);
    const h = md5(abs);
    if (seen.has(h)) {
      fs.rmSync(abs);
      removed.add(`/images/brands/${brand}/history/${f}`);
      historyFixes += 1;
      console.log(`[dedupe] ${brand}/history/${f} = ${seen.get(h)} — иллюстрация убрана`);
    } else seen.set(h, `history/${f}`);
  }
}
// 3. Визуальные повторы (тот же кадр, другой файл): dHash 16×16, расстояние ≤ 10 из 256
async function dhash(file) {
  const { data } = await sharp(file).resize(17, 16, { fit: 'fill' }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const bits = [];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) bits.push(data[y * 17 + x] > data[y * 17 + x + 1] ? 1 : 0);
  return bits;
}
const distance = (a, b) => a.reduce((n, v, i) => n + (v !== b[i]), 0);
// Второй признак — средняя разница пикселей уменьшенных копий (ловит тот же кадр в другом размере обработки)
const thumb = async (file) => sharp(file).resize(32, 48, { fit: 'fill' }).greyscale().raw().toBuffer();
const mad = (a, b) => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
};
const same = (k, hash, small) => distance(k.hash, hash) <= 10 || mad(k.small, small) <= 1;
// Порядок важности: обложки и лукбуки → hero → баннер → директора → история (остаётся первое, повтор убирается)
const rank = (rel) => (rel.startsWith('collections/') ? 0 : rel === 'hero.webp' ? 1 : rel.startsWith('directors/') ? 3 : rel.startsWith('history/') ? 4 : 2);
let visualFixes = 0;
for (const brand of fs.readdirSync(BRANDS_DIR)) {
  const dir = path.join(BRANDS_DIR, brand);
  const files = [];
  const walk = (d, rel = '') => {
    for (const f of fs.readdirSync(d)) {
      const abs = path.join(d, f);
      const r = rel ? `${rel}/${f}` : f;
      if (fs.statSync(abs).isDirectory()) {
        if (f !== 'products') walk(abs, r);
      } else if (f.endsWith('.webp')) files.push(r);
    }
  };
  walk(dir);
  files.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, 'en', { numeric: true }));
  const kept = [];
  for (const rel of files) {
    const hash = await dhash(path.join(dir, rel));
    const small = await thumb(path.join(dir, rel));
    // Обложка коллекции и первый выход её же лукбука — один кадр намеренно
    const twin = kept.find((k) => same(k, hash, small) && !(rel.startsWith(k.rel.replace(/\.webp$/, '/')) || k.rel.startsWith(rel.replace(/\.webp$/, '/'))));
    if (twin && (rel.startsWith('history/') || rel.startsWith('directors/') || /\/look-\d+\.webp$/.test(rel))) {
      fs.rmSync(path.join(dir, rel));
      removed.add(`/images/brands/${brand}/${rel}`);
      visualFixes += 1;
      console.log(`[dedupe] ${brand}/${rel} ≈ ${twin.rel} — повтор убран`);
      continue;
    }
    kept.push({ rel, hash, small });
  }
}
console.log(`[dedupe] визуальных повторов убрано: ${visualFixes}`);

// 4. Источники: записи удалённых файлов убираем
const sources = JSON.parse(fs.readFileSync(SOURCES, 'utf8')).filter((s) => !removed.has(s.target));
fs.writeFileSync(SOURCES, `${JSON.stringify(sources, null, 2)}\n`);
console.log(`[dedupe] товары: убрано повторных ракурсов ${productFixes}; история: убрано повторов ${historyFixes}`);
