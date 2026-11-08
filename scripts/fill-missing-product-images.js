// Дозаполнение вторых фото товаров (npm run images:fill).
// Что делает: для каждого товара из db/content/image-sources.json, у которого нет файла второго фото (-2.webp),
// пробует другие ракурсы того же снимка SSENSE (_3 … _6); если их нет — копирует первое фото товара (-1.webp).
// Источник в image-sources.json обновляется с пометкой, чтобы было видно, откуда взят снимок.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { ensureProxyAwareFetch, uaFor, sleep } from './lib/net.js';

ensureProxyAwareFetch();

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const SOURCES = path.join(ROOT, 'db', 'content', 'image-sources.json');

// Скачивание картинки и сохранение в webp (900 px по ширине, качество 80 — как у остальных фото товаров)
async function download(url, file) {
  const res = await fetch(url, { headers: { 'User-Agent': uaFor(url), Accept: 'image/*' } });
  if (!res.ok) return false;
  const buf = Buffer.from(await res.arrayBuffer());
  await sharp(buf).rotate().resize({ width: 900, withoutEnlargement: true }).webp({ quality: 80 }).toFile(file);
  return true;
}

async function main() {
  const sources = JSON.parse(fs.readFileSync(SOURCES, 'utf8'));
  let fetched = 0;
  let copied = 0;
  for (const entry of sources) {
    if (entry.kind !== 'product' || !/-2\.webp$/.test(entry.target)) continue;
    const file = path.join(PUBLIC, entry.target);
    if (fs.existsSync(file)) continue;
    let done = false;
    // Другие ракурсы того же товара на SSENSE
    if (/ssensemedia\.com/.test(entry.url)) {
      for (const n of [3, 4, 5, 6]) {
        const alt = entry.url.replace(/_2\.jpg$/, `_${n}.jpg`);
        try {
          if (await download(alt, file)) {
            entry.url = alt;
            entry.note = `${entry.note || ''} (другой ракурс — снимок ${n})`.trim();
            fetched += 1;
            done = true;
            break;
          }
        } catch {
          /* пробуем следующий ракурс */
        }
        await sleep(400);
      }
    }
    // Ракурсов нет — второе фото повторяет первое
    if (!done) {
      const first = file.replace(/-2\.webp$/, '-1.webp');
      if (fs.existsSync(first)) {
        fs.copyFileSync(first, file);
        const firstEntry = sources.find((s) => s.target === entry.target.replace(/-2\.webp$/, '-1.webp'));
        if (firstEntry) entry.url = firstEntry.url;
        entry.note = `${entry.note || ''} (второго ракурса нет — повторено первое фото)`.trim();
        copied += 1;
      }
    }
  }
  fs.writeFileSync(SOURCES, `${JSON.stringify(sources, null, 2)}\n`);
  console.log(`[fill] Скачано других ракурсов: ${fetched}, повторено первое фото: ${copied}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
