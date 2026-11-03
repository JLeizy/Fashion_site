// npm run placeholders — генерация стилизованных SVG-заглушек (раздел 14 ТЗ).
// Скрипт читает из БД пути картинок (product_images.url, collections.cover_image, brands.hero_image,
// creative_directors.photo, banners.image, brand_history_sections.image) и рисует SVG по этим путям.
// Если вы заменили заглушку своим фото (jpg / webp) и обновили расширение в БД — такой файл не трогается.
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { config } from '../config/index.js';
import { ensureEmbeddedPostgres, stopEmbeddedPostgres } from '../db/embedded.js';
import { BRANDS } from '../db/seed-data/brands.js';
import { COLOR_HEX, FONTS, silhouetteFor, frameFor, renderSilhouette, inkFor, BUST } from './placeholder-art.js';

const PUBLIC = path.join(config.root, 'public');
const PALETTES = Object.fromEntries(BRANDS.map((b) => [b.slug, b.palette]));
const ICON_CATEGORIES = Object.fromEntries(Object.entries({
  balenciaga: ['sneakers', 'crossbody', 'hoodies'], vetements: ['hoodies', 'tshirts', 'coats'], gucci: ['loafers', 'crossbody', 'scarves'],
  prada: ['backpacks', 'totes', 'boots'], 'enfants-riches-deprimes': ['jackets', 'tshirts', 'sweaters'], avavav: ['sneakers', 'clutches', 'jackets'],
  supreme: ['hoodies', 'headwear', 'tshirts'], 'chrome-hearts': ['pendants', 'rings', 'chains'], 'louis-vuitton': ['totes', 'sneakers', 'backpacks'],
  chanel: ['crossbody', 'jackets', 'fragrance-women'], 'maison-margiela': ['boots', 'sneakers', 'fragrance-unisex'], givenchy: ['totes', 'boots', 'tshirts'],
  versace: ['shirts', 'dresses', 'sneakers'], 'alexander-mcqueen': ['sneakers', 'scarves', 'clutches'], 'loro-piana': ['loafers', 'sweaters', 'crossbody'],
}));

// Палитра для брендов, добавленных через админку (нет в brands.js) — строится от accent_color
function paletteFor(slug, accent = '#5A0F1C') {
  return PALETTES[slug] || { bg: '#111112', bg2: '#1D1D20', fg: '#EDE6DA', accent, frame: 'cross', font: 'serif' };
}

// Детерминированный ГПСЧ от строки — одинаковая картинка при каждом запуске
function rngFrom(text) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function defs(p) {
  return `<defs>
<radialGradient id="bg" cx="50%" cy="42%" r="80%"><stop offset="0" stop-color="${p.bg2}"/><stop offset="1" stop-color="${p.bg}"/></radialGradient>
<linearGradient id="bgd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.bg2}"/><stop offset="1" stop-color="${p.bg}"/></linearGradient>
<linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".30"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>
<linearGradient id="multi" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#B3122E"/><stop offset=".35" stop-color="#C9A227"/><stop offset=".7" stop-color="#2F5D46"/><stop offset="1" stop-color="#3557A0"/></linearGradient>
<radialGradient id="vig" cx="50%" cy="50%" r="75%"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient>
</defs>`;
}

// Название бренда шрифтом его микростилистики (у Supreme — белые буквы на красной плашке)
function brandText(name, p, x, y, size, anchor = 'middle') {
  const f = FONTS[p.font] || FONTS.serif;
  const label = f.upper ? name.toUpperCase() : name;
  const style = `font-family="${f.family}" font-weight="${f.weight}" letter-spacing="${(f.spacing * size) / 20}"${f.italic ? ' font-style="italic"' : ''}`;
  if (p.frame === 'box') {
    const w = label.length * size * 0.62 + size * 0.9;
    const bx = anchor === 'middle' ? x - w / 2 : x;
    return `<rect x="${bx}" y="${y - size * 0.95}" width="${w}" height="${size * 1.3}" fill="${p.accent}"/><text x="${bx + w / 2}" y="${y}" text-anchor="middle" font-size="${size}" fill="#FFFFFF" ${style}>${esc(label)}</text>`;
  }
  const skew = f.skew ? ` transform="skewX(${f.skew})"` : '';
  return `<g${skew}><text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" fill="${p.fg}" ${style}>${esc(label)}</text></g>`;
}

const mono = (text, x, y, size, color, opacity = 1, anchor = 'middle', spacing = 2) =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="'Courier New', Courier, monospace" font-size="${size}" letter-spacing="${spacing}" fill="${color}" opacity="${opacity}">${esc(text)}</text>`;

// ---------------------------------------------------------------------
// Карточка товара: ракурс 1 (общий план) и ракурс 2 (деталь крупно)
// ---------------------------------------------------------------------
function productSvg(row, variant) {
  const p = paletteFor(row.brand_slug, row.accent_color);
  const rng = rngFrom(`${row.sku}-${variant}`);
  const W = 400;
  const H = 500;
  const shapes = silhouetteFor(row.category_slug, row.name_en);
  const fill = COLOR_HEX[row.color] || '#888';
  const ink = inkFor(row.color === 'multicolor' ? '#7A6A3A' : fill, p);
  const label = row.category_slug.replace('fragrance-', 'fragrance · ').replace(/-/g, ' ').toUpperCase();
  if (variant === 1) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="800" height="1000">${defs(p)}
<rect width="${W}" height="${H}" fill="url(#bg)"/>${frameFor(p.frame, W, H, p, rng)}
<ellipse cx="200" cy="406" rx="118" ry="11" fill="#000" opacity="0.22"/>
<g transform="translate(72 132) scale(1.28)">${renderSilhouette(shapes, { fill, stroke: ink })}</g>
${brandText(row.brand_name, p, 200, 70, row.brand_name.length > 16 ? 15 : 19)}
${mono(label, 200, 92, 8.5, p.fg, 0.6, 'middle', 3)}
${mono(row.sku, 200, 452, 11, p.fg, 0.9)}
${mono('AMFIBIA · VERIFIED', 200, 468, 7, p.fg, 0.5, 'middle', 3)}
<rect width="${W}" height="${H}" fill="url(#vig)"/></svg>`;
  }
  const angle = -6 - rng() * 8;
  const initial = row.brand_name[0];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="800" height="1000">${defs(p)}
<rect width="${W}" height="${H}" fill="url(#bgd)"/>
<text x="210" y="430" text-anchor="middle" font-family="Georgia, serif" font-size="520" fill="${p.fg}" opacity="0.06">${esc(initial)}</text>
${frameFor(p.frame, W, H, p, rng)}
<g transform="rotate(${angle.toFixed(1)} 200 250) translate(${(-20 + rng() * 30).toFixed(0)} 20) scale(2.15)">${renderSilhouette(shapes, { fill, stroke: ink, strokeWidth: 1.4 })}</g>
<g transform="translate(34 470) rotate(-90)">${mono(`DETAIL — ${row.sku}`, 0, 0, 10, p.fg, 0.75, 'start', 3)}</g>
${brandText(row.brand_name, p, 366, 466, 11, 'end')}
<rect width="${W}" height="${H}" fill="url(#vig)"/></svg>`;
}

// Обложка коллекции 600×800: сезон и год крупной типографикой + коллаж силуэтов
function collectionSvg(row) {
  const p = paletteFor(row.brand_slug, row.accent_color);
  const rng = rngFrom(`collection-${row.id}`);
  const W = 600;
  const H = 800;
  const f = FONTS[p.font] || FONTS.serif;
  const cats = ICON_CATEGORIES[row.brand_slug] || ['tshirts', 'sneakers', 'totes'];
  const main = cats[row.id % cats.length];
  const minor = cats.filter((c) => c !== main);
  const ink = inkFor(p.accent, p);
  // Журнальная композиция: крупный силуэт по центру + два маленьких «на полях»
  const collage = [
    `<g transform="translate(300 470) rotate(${((rng() - 0.5) * 14).toFixed(1)}) scale(1.85) translate(-100 -100)">${renderSilhouette(silhouetteFor(main), { fill: p.accent, stroke: ink, strokeWidth: 1.3 })}</g>`,
    `<g transform="translate(110 640) rotate(-12) scale(0.62) translate(-100 -100)" opacity="0.55">${renderSilhouette(silhouetteFor(minor[0]), { fill: 'none', stroke: p.fg, strokeWidth: 1 })}</g>`,
    `<g transform="translate(500 300) rotate(10) scale(0.55) translate(-100 -100)" opacity="0.45">${renderSilhouette(silhouetteFor(minor[1] || main), { fill: 'none', stroke: p.fg, strokeWidth: 1 })}</g>`,
  ].join('');
  const season = row.season === 'Pre-Fall' ? 'PF' : row.season === 'Resort' ? 'RS' : row.season;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="900" height="1200">${defs(p)}
<rect width="${W}" height="${H}" fill="url(#bgd)"/>${frameFor(p.frame, W, H, p, rng)}
${collage}
<text x="50" y="200" font-family="${f.family}" font-weight="${Math.max(f.weight, 400)}" font-size="170" fill="${p.fg}" opacity="0.92"${f.italic ? ' font-style="italic"' : ''}>${season}</text>
<text x="56" y="250" font-family="'Courier New', monospace" font-size="40" letter-spacing="14" fill="${p.accent === p.fg ? p.fg : p.accent}">${row.year}</text>
${brandText(row.brand_name, p, 300, 730, 24)}
<rect width="${W}" height="${H}" fill="url(#vig)"/></svg>`;
}

// Hero бренда / слайд главной 16:9 — только графика (заголовки накладываются HTML-ом)
function heroSvg(slug, brandName, accent, seed, { W = 1600, H = 900 } = {}) {
  const p = paletteFor(slug, accent);
  const rng = rngFrom(seed);
  const cats = ICON_CATEGORIES[slug] || ['tshirts', 'sneakers', 'totes'];
  const f = FONTS[p.font] || FONTS.serif;
  const big = cats.map((cat, i) => {
    const s = 2.6 + rng() * 1.4;
    const x = W * (0.52 + i * 0.17) + (rng() - 0.5) * 80;
    const y = H * (0.42 + (rng() - 0.5) * 0.3);
    const r = (rng() - 0.5) * 26;
    return `<g transform="translate(${x.toFixed(0)} ${y.toFixed(0)}) rotate(${r.toFixed(0)}) scale(${s.toFixed(2)}) translate(-100 -100)" opacity="${(0.5 + rng() * 0.35).toFixed(2)}">${renderSilhouette(silhouetteFor(cat), { fill: i === 0 ? p.accent : p.bg2, stroke: p.fg, strokeWidth: 1.4 })}</g>`;
  }).join('');
  let lines = '';
  for (let i = 0; i < 9; i++) lines += `<path d="M${-200 + i * 260} ${H} L${200 + i * 260} 0" stroke="${p.fg}" stroke-width="0.6" opacity="0.05"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${defs(p)}
<rect width="${W}" height="${H}" fill="url(#bgd)"/>${lines}
<text x="${W * 0.04}" y="${H * 0.92}" font-family="${f.family}" font-size="${H * 0.36}" font-weight="${f.weight}" fill="${p.fg}" opacity="0.06"${f.italic ? ' font-style="italic"' : ''}>${esc(f.upper ? brandName.toUpperCase() : brandName)}</text>
${frameFor(p.frame, W, H, p, rng)}${big}
<rect width="${W}" height="${H}" fill="url(#vig)"/></svg>`;
}

// Портрет-заглушка креативного директора 600×800
function directorSvg(row) {
  const p = paletteFor(row.brand_slug, row.accent_color);
  const rng = rngFrom(`director-${row.id}`);
  const W = 600;
  const H = 800;
  const initials = row.name.split(/\s+/).filter((w) => /^[A-ZÀ-Ý]/.test(w)).map((w) => w[0]).join('').slice(0, 2) || row.name[0];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="600" height="800">${defs(p)}
<rect width="${W}" height="${H}" fill="url(#bg)"/>
<text x="300" y="560" text-anchor="middle" font-family="Georgia, serif" font-size="420" fill="${p.fg}" opacity="0.07">${esc(initials)}</text>
${frameFor(p.frame, W, H, p, rng)}
<g transform="translate(90 250) scale(2.1)">${renderSilhouette(BUST, { fill: p.bg2, stroke: p.fg, strokeWidth: 1.2 })}</g>
${mono(`${row.years_from}—${row.years_to || 'NOW'}`, 300, 720, 22, p.fg, 0.85, 'middle', 6)}
<rect width="${W}" height="${H}" fill="url(#vig)"/></svg>`;
}

// Иллюстрация раздела истории 1600×900
function historySvg(row) {
  const p = paletteFor(row.brand_slug, row.accent_color);
  const rng = rngFrom(`history-${row.id}`);
  const W = 1600;
  const H = 900;
  const cats = ICON_CATEGORIES[row.brand_slug] || ['tshirts'];
  const cat = cats[row.sort_order % cats.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${defs(p)}
<rect width="${W}" height="${H}" fill="url(#bgd)"/>
<text x="${W / 2}" y="${H * 0.66}" text-anchor="middle" font-family="Georgia, serif" font-size="${H * 0.42}" fill="${p.fg}" opacity="0.07">${esc(row.period || '')}</text>
${frameFor(p.frame, W, H, p, rng)}
<g transform="translate(${W / 2} ${H / 2}) rotate(${((rng() - 0.5) * 20).toFixed(0)}) scale(3) translate(-100 -100)">${renderSilhouette(silhouetteFor(cat), { fill: p.accent, stroke: p.fg, strokeWidth: 1.3 })}</g>
<rect width="${W}" height="${H}" fill="url(#vig)"/></svg>`;
}

const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#0B0B0C"/><rect x="5" y="5" width="54" height="54" rx="9" fill="none" stroke="#5A0F1C" stroke-width="2"/><path d="M32 10 L35 22 L47 20 L37 28 L44 40 L32 33 L20 40 L27 28 L17 20 L29 22 Z" fill="#EDE6DA"/><path d="M22 54 L32 30 L42 54 M26 46 L38 46" fill="none" stroke="#B8B8B8" stroke-width="3" stroke-linejoin="round"/></svg>`;

function write(publicUrl, content, stats) {
  if (!publicUrl || !publicUrl.startsWith('/images/') || !publicUrl.endsWith('.svg')) {
    stats.skipped += 1;
    return;
  }
  const file = path.join(PUBLIC, publicUrl);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  stats.written += 1;
}

async function main() {
  await ensureEmbeddedPostgres({ quiet: true });
  const client = new pg.Client(config.db);
  await client.connect();
  const stats = { written: 0, skipped: 0 };
  const started = Date.now();
  try {
    // Папки public/images/brands/<бренд>/products/ для всех брендов
    // SQL: список брендов (таблица brands, только чтение)
    const { rows: brands } = await client.query('SELECT id, slug, name, accent_color, hero_image, founded_year FROM brands ORDER BY sort_order');
    for (const b of brands) fs.mkdirSync(path.join(PUBLIC, 'images', 'brands', b.slug, 'products'), { recursive: true });

    // SQL: фото товаров (product_images JOIN products, brands, categories)
    const { rows: images } = await client.query(
      `SELECT pi.url, pi.sort_order, p.sku, p.color, p.name_en, b.slug AS brand_slug, b.name AS brand_name, b.accent_color, c.slug AS category_slug
         FROM product_images pi
         JOIN products p   ON p.id = pi.product_id
         JOIN brands b     ON b.id = p.brand_id
         JOIN categories c ON c.id = p.category_id`
    );
    for (const row of images) write(row.url, productSvg(row, /-2\.svg$/.test(row.url) ? 2 : 1), stats);

    // SQL: обложки коллекций (collections JOIN brands)
    const { rows: collections } = await client.query(
      `SELECT c.id, c.name, c.season, c.year, c.cover_image, b.slug AS brand_slug, b.name AS brand_name, b.accent_color
         FROM collections c JOIN brands b ON b.id = c.brand_id`
    );
    for (const row of collections) write(row.cover_image, collectionSvg(row), stats);

    // Hero брендов
    for (const b of brands) write(b.hero_image, heroSvg(b.slug, b.name, b.accent_color, `hero-${b.slug}`), stats);

    // SQL: слайды главной (banners LEFT JOIN brands)
    const { rows: banners } = await client.query(
      `SELECT bn.id, bn.image, b.slug, b.name, b.accent_color FROM banners bn LEFT JOIN brands b ON b.id = bn.brand_id`
    );
    for (const bn of banners) write(bn.image, heroSvg(bn.slug || 'amfibia', bn.name || 'AMFIBIA', bn.accent_color, `banner-${bn.id}`, { W: 1920, H: 1080 }), stats);

    // SQL: портреты креативных директоров (creative_directors JOIN brands)
    const { rows: directors } = await client.query(
      `SELECT d.id, d.name, d.years_from, d.years_to, d.photo, b.slug AS brand_slug, b.accent_color
         FROM creative_directors d JOIN brands b ON b.id = d.brand_id`
    );
    for (const row of directors) write(row.photo, directorSvg(row), stats);

    // SQL: иллюстрации разделов истории (brand_history_sections JOIN brands)
    const { rows: sections } = await client.query(
      `SELECT s.id, s.period, s.sort_order, s.image, b.slug AS brand_slug, b.accent_color
         FROM brand_history_sections s JOIN brands b ON b.id = s.brand_id`
    );
    for (const row of sections) write(row.image, historySvg(row), stats);

    fs.writeFileSync(path.join(PUBLIC, 'images', 'favicon.svg'), FAVICON);
    fs.mkdirSync(path.join(PUBLIC, 'uploads'), { recursive: true });
    if (!fs.existsSync(path.join(PUBLIC, 'uploads', '.gitkeep'))) fs.writeFileSync(path.join(PUBLIC, 'uploads', '.gitkeep'), '');
    console.log(`[placeholders] Создано SVG: ${stats.written}, пропущено (свои фото): ${stats.skipped} — за ${((Date.now() - started) / 1000).toFixed(1)} с`);
  } finally {
    await client.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  try {
    await main();
  } catch (err) {
    console.error('[placeholders] Ошибка:', err.message);
    process.exitCode = 1;
  } finally {
    await stopEmbeddedPostgres();
  }
}
