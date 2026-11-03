// Загрузка полных историй брендов из db/content/histories/<slug>.js.
// Каждый файл экспортирует по умолчанию объект:
//   { slug, sections: [{ period, title_ru, title_en, content_ru, content_en, quote_ru, quote_en, quote_author, image }],
//     timeline?: [[year, title_ru, title_en, desc_ru, desc_en], ...],   — заменяет стартовую хронологию из brands.js
//     directors?: [[name, from, to, desc_ru, desc_en, key_ru, key_en], ...] — заменяет стартовый список директоров }
// seed.js записывает их в таблицы brand_history_sections, brand_timeline_events, creative_directors.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DIR = path.join(import.meta.dirname, 'histories');

export async function loadHistories() {
  const result = {};
  if (!fs.existsSync(DIR)) return result;
  const files = fs.readdirSync(DIR).filter((file) => file.endsWith('.js')).sort();
  for (const file of files) {
    const mod = await import(pathToFileURL(path.join(DIR, file)).href);
    const history = mod.default;
    if (history?.slug && Array.isArray(history.sections)) result[history.slug] = history;
  }
  return result;
}
