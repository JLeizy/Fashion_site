// Vogue Runway: список показов дизайнера и кадры показа.
// Данные берутся из состояния страницы (window.__PRELOADED_STATE__ → transformed.runwayShowGalleries): там лежат
// все галереи показа (Collection, Details, Beauty…) с порядком кадров. Так находятся и старые показы, у которых
// в имени файла нет названия марки (например, MARC0004.jpg у Vetements осень-2015).
import { BROWSER_UA, sleep } from './net.js';

const stateCache = new Map();

async function pageState(url) {
  if (stateCache.has(url)) return stateCache.get(url);
  let state = null;
  for (let attempt = 0; attempt < 3 && !state; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' } });
      if (res.status === 404) break;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const i = html.indexOf('window.__PRELOADED_STATE__');
      if (i < 0) break;
      const j = html.indexOf('</script>', i);
      const raw = html.slice(html.indexOf('=', i) + 1, j).trim().replace(/;$/, '');
      state = JSON.parse(raw);
    } catch {
      await sleep(1500 * (attempt + 1));
    }
  }
  stateCache.set(url, state);
  await sleep(500);
  return state;
}

// Показы дизайнера: ['spring-2026-ready-to-wear', 'fall-2025-menswear', …] (по убыванию даты, как на Vogue)
export async function designerShows(slug) {
  const res = await fetch(`https://www.vogue.com/fashion-shows/designer/${slug}`, { headers: { 'User-Agent': BROWSER_UA } });
  if (!res.ok) return [];
  const html = (await res.text()).replace(/\\u002F/g, '/');
  const re = new RegExp(`fashion-shows/([a-z0-9-]+)/${slug}(?=["/?#])`, 'g');
  const seen = new Set();
  let m;
  while ((m = re.exec(html))) if (m[1] !== 'designer') seen.add(m[1]);
  return [...seen];
}

// Кадры показа: gallery 'collection' — образы, 'details' — детали. [{ num, id, file, season, page }]
export async function showLooks(slug, season, gallery = 'collection') {
  const page = `https://www.vogue.com/fashion-shows/${season}/${slug}`;
  const state = await pageState(page);
  const galleries = state?.transformed?.runwayShowGalleries?.galleries || [];
  const g = galleries.find((x) => String(x.title || '').toLowerCase().startsWith(gallery)) || (gallery === 'collection' ? galleries[0] : null);
  if (!g) return [];
  return (g.items || [])
    .map((it, i) => {
      const src = it.image?.sources?.md?.url || it.image?.sources?.lg?.url || it.image?.sources?.sm?.url || '';
      const m = src.match(/assets\.vogue\.com\/photos\/([a-f0-9]+)\/master\/[^/]+\/([^/?]+)$/);
      return m ? { num: i + 1, id: m[1], file: m[2], season, page: `${page}/slideshow/${gallery}#${i + 1}` } : null;
    })
    .filter(Boolean);
}

export const lookUrl = (look, width = 1200) => `https://assets.vogue.com/photos/${look.id}/master/w_${width},c_limit/${look.file}`;

// Сезон коллекции из БД → кандидаты показов Vogue (ready-to-wear, мужской, кутюр; круиз; предосенняя)
export function seasonCandidates(season, year) {
  if (season === 'Resort') return [`resort-${year}`];
  if (season === 'Pre-Fall') return [`pre-fall-${year}`];
  const s = season === 'FW' ? 'fall' : 'spring';
  return [`${s}-${year}-ready-to-wear`, `${s}-${year}-menswear`, `${s}-${year}-couture`];
}
