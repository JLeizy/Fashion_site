// Выбор файла изображения при наполнении БД (правка П4).
// У каждой картинки есть SVG-заглушка (scripts/generate-placeholders.js) и, возможно, реальная фотография
// с тем же именем в формате .webp (scripts/fetch-images.js или своя). Если фото лежит в public/ — в БД пишется путь
// к .webp, иначе — к .svg. Заглушка при этом остаётся рядом: страница переключается на неё, если фото не загрузилось.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

// '/images/brands/gucci/products/GUC-LOF-0001-1.svg' → '/images/brands/gucci/products/GUC-LOF-0001-1.webp', если файл есть
export function preferPhoto(svgUrl) {
  if (typeof svgUrl !== 'string' || !svgUrl.endsWith('.svg')) return svgUrl;
  const webp = svgUrl.replace(/\.svg$/, '.webp');
  return fs.existsSync(path.join(PUBLIC, webp)) ? webp : svgUrl;
}

// Обратное преобразование: путь к фото → путь к его SVG-заглушке
export const placeholderFor = (url) => String(url).replace(/\.(webp|jpe?g|png)$/i, '.svg');

export default preferPhoto;

// Только настоящее фото: путь к .webp, если файл есть, иначе null (иллюстрация не показывается вовсе)
export function photoOnly(svgUrl) {
  const url = preferPhoto(svgUrl);
  return typeof url === 'string' && url.endsWith('.webp') ? url : null;
}
