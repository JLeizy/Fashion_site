// Загрузка реальных фотографий (правка П4): npm run images [-- --brand gucci] [-- --force] [-- --from-manifest] [-- --dry]
//
// Откуда: db/content/image-sources.json — список источников, по одному на картинку сайта:
//   { "target": "/images/brands/gucci/products/GUC-LOF-0001-1.webp",   ← путь на сайте (в public/)
//     "kind": "product",                                               ← product | collection | history | director | hero | banner
//     "page": "https://…/страница-товара",                             ← страница-источник (для манифеста и Referer)
//     "url":  "https://…/image.jpg",                                   ← прямая ссылка на изображение (если есть)
//     "note": "цвет в seed изменён на black — фото чёрной модели" }   ← примечание о замене (необязательно)
// Если "url" не указан, страница открывается в Chromium (Playwright) и берётся og:image или самое крупное изображение.
//
// Что делает: скачивает (fetch с User-Agent обычного браузера, повтор при сбое, пауза между запросами),
// обрабатывает через sharp → webp, качество ~80 (hero и баннеры — до 1600 px по ширине, товары, коллекции и
// история — до 900 px, портреты — до 600 px; товарные фото ужимаются до ≤ 100 КБ), сохраняет в public/
// и записывает в db/content/images-manifest.json: путь → { page, url, date, note, bytes, width, height }.
// Идемпотентно: уже скачанные файлы пропускаются (кроме --force), поэтому после обрыва можно просто запустить снова.
// --from-manifest — перекачать всё, что записано в манифесте (например, на новой машине).
// После загрузки: npm run db:seed && npm run placeholders — в БД попадут пути к .webp, заглушки останутся фолбэком.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { ensureProxyAwareFetch, loadPlaywright, uaFor, BROWSER_UA, sleep } from './lib/net.js';

ensureProxyAwareFetch();

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const SOURCES = path.join(ROOT, 'db', 'content', 'image-sources.json');
const MANIFEST = path.join(ROOT, 'db', 'content', 'images-manifest.json');
const MAX_WIDTH = { hero: 1600, banner: 1600, product: 900, collection: 900, history: 900, director: 600 };
const PRODUCT_MAX_BYTES = 100 * 1024;
const PAUSE_MS = 1200;

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
};
const readJson = (file, fallback) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback);

let browser = null;
async function imageUrlFromPage(page) {
  // Страница с защитой от ботов или JS-рендерингом: открываем в Chromium и ищем og:image / самую крупную картинку
  if (!browser) {
    const { chromium } = await loadPlaywright();
    browser = await chromium.launch();
  }
  const ctx = await browser.newContext({ userAgent: BROWSER_UA, viewport: { width: 1440, height: 1000 } });
  const tab = await ctx.newPage();
  try {
    await tab.goto(page, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await tab.waitForTimeout(2500);
    return await tab.evaluate(() => {
      const og = document.querySelector('meta[property="og:image"], meta[name="twitter:image"]')?.content;
      if (og) return new URL(og, location.href).href;
      const imgs = [...document.images].filter((i) => i.naturalWidth >= 400).sort((a, b) => b.naturalWidth * b.naturalHeight - a.naturalWidth * a.naturalHeight);
      return imgs[0] ? new URL(imgs[0].currentSrc || imgs[0].src, location.href).href : null;
    });
  } finally {
    await ctx.close();
  }
}

async function download(url, referer) {
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': uaFor(url), Accept: 'image/avif,image/webp,image/*,*/*;q=0.8', ...(referer ? { Referer: referer } : {}) }, redirect: 'follow' });
      if (res.status === 429) {
        // Лимит частоты (Wikimedia и др.): ждём дольше и повторяем
        lastError = new Error('HTTP 429');
        await sleep(15000 * attempt);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const type = res.headers.get('content-type') || '';
      if (!type.startsWith('image/')) throw new Error(`не изображение (${type || 'без content-type'})`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      lastError = err;
      await sleep(1000 * 2 ** attempt);
    }
  }
  throw lastError;
}

async function toWebp(buffer, kind) {
  const width = MAX_WIDTH[kind] || 900;
  let quality = 80;
  let out = await sharp(buffer).rotate().resize({ width, withoutEnlargement: true }).webp({ quality }).toBuffer({ resolveWithObject: true });
  // Товарные фото — не больше ~100 КБ: постепенно снижаем качество
  while (kind === 'product' && out.data.length > PRODUCT_MAX_BYTES && quality > 55) {
    quality -= 8;
    out = await sharp(buffer).rotate().resize({ width, withoutEnlargement: true }).webp({ quality }).toBuffer({ resolveWithObject: true });
  }
  return out;
}

async function main() {
  const manifest = readJson(MANIFEST, {});
  let list = flag('from-manifest')
    ? Object.entries(manifest).map(([target, m]) => ({ target, kind: m.kind, page: m.page, url: m.url, note: m.note }))
    : readJson(SOURCES, []);
  const brand = opt('brand');
  if (brand) list = list.filter((s) => s.target.includes(`/brands/${brand}/`) || s.target.includes(`/banners/${brand}`));
  const stats = { saved: 0, skipped: 0, failed: 0 };
  console.log(`[images] Источников: ${list.length}${brand ? ` (бренд ${brand})` : ''}`);

  for (const src of list) {
    const target = src.target.replace(/\.(svg|jpe?g|png)$/i, '.webp');
    const file = path.join(PUBLIC, target);
    if (!target.startsWith('/images/') || !file.startsWith(PUBLIC)) {
      console.warn(`[images] пропуск: недопустимый путь ${src.target}`);
      stats.failed += 1;
      continue;
    }
    if (fs.existsSync(file) && !flag('force')) {
      stats.skipped += 1;
      continue;
    }
    if (flag('dry')) {
      console.log(`[images] (dry) ${target} ← ${src.url || src.page}`);
      continue;
    }
    try {
      const url = src.url || (src.page ? await imageUrlFromPage(src.page) : null);
      if (!url) throw new Error('не найден URL изображения');
      const raw = await download(url, src.page);
      const { data, info } = await toWebp(raw, src.kind);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, data);
      manifest[target] = { kind: src.kind, page: src.page || null, url, date: new Date().toISOString().slice(0, 10), note: src.note || null, bytes: data.length, width: info.width, height: info.height };
      fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
      stats.saved += 1;
      console.log(`[images] ✓ ${target} (${Math.round(data.length / 1024)} КБ, ${info.width}×${info.height})`);
    } catch (err) {
      stats.failed += 1;
      console.warn(`[images] ✗ ${target}: ${err.message}`);
    }
    await sleep(PAUSE_MS);
  }
  if (browser) await browser.close();
  console.log(`[images] Сохранено: ${stats.saved}, уже были: ${stats.skipped}, ошибок: ${stats.failed}`);
  if (stats.saved) console.log('[images] Дальше: npm run db:seed && npm run placeholders — в БД попадут пути к .webp');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
