// Редакционные фото бренда — лукбуки коллекций, обложки, hero, баннер и иллюстрации истории:
//   npm run images:editorial -- --brand vetements     (или --all)
//
// Правила:
//   • коллекция = настоящий показ того же сезона на Vogue Runway (ready-to-wear, мужской или кутюр);
//     лукбук — первые LOOKS выходов показа по порядку, обложка — первый выход;
//   • раздел истории — выход показа из лет этого раздела (период «1997–2003» → показы 1997–2003 годов);
//     если показов той эпохи на Vogue нет — остаётся фото из Википедии (если было) или раздел идёт без иллюстрации;
//   • ни один кадр не повторяется в пределах бренда (коллекции, hero, баннер, история, директора);
//   • показы и кадры из plan.excludeShows / plan.excludeLooks (db/content/image-plan.js) не используются никогда;
//   • директорам без портрета — выход показа из лет их работы (с честной подписью).
// Скачанные файлы → public/images/brands/<бренд>/…; источники → db/content/image-sources.json, images-manifest.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import pg from 'pg';
import { ensureProxyAwareFetch, BROWSER_UA, sleep } from './lib/net.js';
import { designerShows, showLooks, lookUrl, seasonCandidates } from './lib/vogue.js';
import { IMAGE_PLAN } from '../db/content/image-plan.js';
import { BRANDS } from '../db/seed-data/brands.js';
import { config } from '../config/index.js';

ensureProxyAwareFetch();

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const SOURCES = path.join(ROOT, 'db', 'content', 'image-sources.json');
const MANIFEST = path.join(ROOT, 'db', 'content', 'images-manifest.json');
const OVERRIDES = path.join(ROOT, 'db', 'content', 'image-overrides.json');
const LOOKS = 10; // выходов в лукбуке коллекции
const WIDTH = { look: 1000, collection: 1000, history: 1200, director: 700, hero: 1600, banner: 1600 };
const NOW_YEAR = new Date().getFullYear();

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
};
const slugify = (text) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const readJson = (file, fallback) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback);

// Год показа по слагу сезона: 'fall-2015-ready-to-wear' → 2015
const showYear = (season) => Number((season.match(/(\d{4})/) || [])[1]) || 0;
// Годы раздела истории: «1997–2003», «1960-е — н. в.», «2014» → [from, to]
function periodRange(period) {
  if (!period) return null;
  const years = [...String(period).matchAll(/(\d{4})(-е)?/g)].map((m) => [Number(m[1]), m[2] ? Number(m[1]) + 9 : Number(m[1])]);
  if (!years.length) return null;
  let from = Math.min(...years.map((y) => y[0]));
  let to = Math.max(...years.map((y) => y[1]));
  if (/н\.\s*в\./.test(period)) to = NOW_YEAR;
  if (from === to) to += 1; // показ «весна 2016» проходит осенью 2015 — допускаем соседний год
  return [from, to];
}

async function saveImage(url, target, kind) {
  const res = await fetch(url, { headers: { 'User-Agent': BROWSER_UA, Accept: 'image/*' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const file = path.join(PUBLIC, target);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const info = await sharp(buf).rotate().resize({ width: WIDTH[kind] || 1000, withoutEnlargement: true }).webp({ quality: 78 }).toFile(file);
  return info;
}

async function processBrand(db, slug) {
  const plan = IMAGE_PLAN[slug] || {};
  const vogueSlugs = [].concat(plan.vogue || []);
  const brand = BRANDS.find((b) => b.slug === slug);
  if (!vogueSlugs.length || !brand) {
    console.log(`[editorial] ${slug}: показов на Vogue Runway нет — пропуск`);
    return;
  }
  const excludeShows = new Set(plan.excludeShows || []);
  const excludeLooks = new Set(plan.excludeLooks || []);
  // Показы дизайнера: сезон → слаг страницы Vogue
  const showSlug = new Map();
  for (const vs of vogueSlugs) for (const s of await designerShows(vs)) if (!showSlug.has(s) && !excludeShows.has(s)) showSlug.set(s, vs);
  const looksOf = async (season) => (showSlug.has(season) ? (await showLooks(showSlug.get(season), season)).filter((l) => !excludeLooks.has(l.id)) : []);
  console.log(`[editorial] ${slug}: показов ${showSlug.size}`);

  const sources = readJson(SOURCES, []);
  const overrides = readJson(OVERRIDES, []).filter((o) => o.target.includes(`/brands/${slug}/`) || o.target.includes(`/banners/${slug}.`));
  // Использованные кадры: id и имя файла (у совместных показов страницы menswear и ready-to-wear отдают одни и те же снимки)
  const used = new Set();
  const isUsed = (l) => used.has(l.id) || used.has(l.file);
  // Кадры, закреплённые вручную (image-overrides.json), не повторяем
  overrides.forEach((o) => {
    const id = (String(o.url).match(/assets\.vogue\.com\/photos\/([a-f0-9]+)/) || [])[1];
    if (id) used.add(id);
  });
  const out = [];
  const take = async (look, target, kind, note) => {
    used.add(look.id);
    used.add(look.file);
    const url = lookUrl(look, WIDTH[kind] >= 1200 ? 1600 : 1280);
    const info = await saveImage(url, target, kind);
    out.push({ target, kind, page: look.page, url, note, width: info.width, height: info.height, bytes: info.size });
    await sleep(250);
  };
  const label = (look) => `Vogue Runway, ${look.season}, выход ${look.num}`;

  // ---------- Коллекции: лукбук и обложка ----------
  let newest = null;
  for (const [name, season, year, isNew] of brand.collections) {
    const colSlug = slugify(name);
    let show = null;
    for (const cand of seasonCandidates(season, year)) {
      const looks = await looksOf(cand);
      if (looks.length >= 4) {
        show = { season: cand, looks };
        break;
      }
    }
    if (!show) {
      console.warn(`[editorial] ${slug}: для коллекции «${name}» нет показа на Vogue Runway`);
      continue;
    }
    const dir = path.join(PUBLIC, 'images', 'brands', slug, 'collections', colSlug);
    fs.rmSync(dir, { recursive: true, force: true });
    const picked = show.looks.filter((l) => !isUsed(l)).slice(0, LOOKS);
    for (const look of picked) await take(look, `/images/brands/${slug}/collections/${colSlug}/look-${String(look.num).padStart(2, '0')}.webp`, 'look', label(look));
    // Обложка — первый выход (тот же кадр, что открывает лукбук)
    const cover = picked[0];
    const info = await saveImage(lookUrl(cover, 1280), `/images/brands/${slug}/collections/${colSlug}.webp`, 'collection');
    out.push({ target: `/images/brands/${slug}/collections/${colSlug}.webp`, kind: 'collection', page: cover.page, url: lookUrl(cover, 1280), note: label(cover), width: info.width, height: info.height, bytes: info.size });
    console.log(`[editorial] ${slug}: «${name}» ← ${show.season}, выходов ${picked.length}`);
    if (isNew || !newest) newest = show;
  }

  // ---------- Hero бренда и баннер главной — кадры новейшего показа, не попавшие в лукбук ----------
  if (newest) {
    const free = newest.looks.filter((l) => !isUsed(l));
    if (free[0]) await take(free[0], `/images/brands/${slug}/hero.webp`, 'hero', label(free[0]));
    if (free[1] && fs.existsSync(path.join(PUBLIC, 'images', 'banners', `${slug}.svg`))) await take(free[1], `/images/banners/${slug}.webp`, 'banner', label(free[1]));
  }

  // ---------- История: кадры показов из лет раздела ----------
  const { rows: sections } = await db.query(
    'SELECT s.sort_order, s.period FROM brand_history_sections s JOIN brands b ON b.id = s.brand_id WHERE b.slug = $1 ORDER BY s.sort_order',
    [slug]
  );
  const { rows: directors } = await db.query(
    'SELECT d.name, d.years_from, d.years_to FROM creative_directors d JOIN brands b ON b.id = d.brand_id WHERE b.slug = $1 ORDER BY d.id',
    [slug]
  );
  const showsSorted = [...showSlug.keys()].filter((s) => !/details|beauty/.test(s)).sort((a, b) => showYear(a) - showYear(b));
  const showUse = new Map(); // сколько раз показ уже взят для истории — чтобы разделы одного периода получили разные показы
  async function lookFromYears(from, to) {
    const cands = showsSorted.filter((s) => showYear(s) >= from && showYear(s) <= to);
    cands.sort((a, b) => (showUse.get(a) || 0) - (showUse.get(b) || 0) || showYear(a) - showYear(b));
    for (const season of cands) {
      const looks = await looksOf(season);
      // Начинаем не с первого выхода: первые кадры чаще уходят в лукбуки и обложки
      const free = looks.filter((l) => !isUsed(l));
      const look = free[Math.min(free.length - 1, 2 + (showUse.get(season) || 0) * 3)];
      if (look) {
        showUse.set(season, (showUse.get(season) || 0) + 1);
        return look;
      }
    }
    return null;
  }
  const oldHistory = new Map(sources.filter((s) => s.kind === 'history' && s.target.includes(`/brands/${slug}/`)).map((s) => [s.target, s]));
  let histCount = 0;
  let wikiKept = 0;
  let noImage = 0;
  for (const s of sections) {
    const target = `/images/brands/${slug}/history/${s.sort_order}.webp`;
    if (overrides.some((o) => o.target === target)) continue;
    const prev = oldHistory.get(target);
    // Фото из Википедии (портреты, здания, архивные снимки) оставляем как есть
    if (prev && /wiki(pedia|media)/.test(`${prev.page} ${prev.url}`) && fs.existsSync(path.join(PUBLIC, target))) {
      out.push({ target, kind: 'history', page: prev.page, url: prev.url, note: prev.note });
      wikiKept += 1;
      continue;
    }
    const range = periodRange(s.period);
    const look = range ? await lookFromYears(range[0], range[1]) : null;
    if (look) {
      await take(look, target, 'history', label(look));
      histCount += 1;
    } else {
      // Показов той эпохи нет — раздел остаётся без иллюстрации (без случайных кадров из других лет)
      fs.rmSync(path.join(PUBLIC, target), { force: true });
      noImage += 1;
    }
  }

  // ---------- Директора без портрета: выход показа из лет их работы ----------
  const oldDirectors = new Map(sources.filter((s) => s.kind === 'director' && s.target.includes(`/brands/${slug}/`)).map((s) => [s.target, s]));
  for (const [i, d] of directors.entries()) {
    const target = `/images/brands/${slug}/directors/${i + 1}.webp`;
    const prev = oldDirectors.get(target);
    if (overrides.some((o) => o.target === target)) continue;
    if (prev && !/Vogue Runway/.test(prev.note || '') && fs.existsSync(path.join(PUBLIC, target))) {
      out.push({ target, kind: 'director', page: prev.page, url: prev.url, note: prev.note });
      continue;
    }
    const look = await lookFromYears(d.years_from || 0, d.years_to || NOW_YEAR);
    if (look) await take(look, target, 'director', `Портрета в открытых источниках нет — образ показа ${d.name}: ${label(look)}`);
  }

  // ---------- Запись источников: редакционные записи бренда заменяются целиком, товары не трогаем ----------
  const mine = (t) => (t.includes(`/brands/${slug}/`) || t.includes(`/banners/${slug}.`)) && !t.includes('/products/');
  const manifest = readJson(MANIFEST, {});
  for (const t of Object.keys(manifest)) if (mine(t) && !out.some((o) => o.target === t) && !overrides.some((o) => o.target === t)) delete manifest[t];
  const date = new Date().toISOString().slice(0, 10);
  for (const o of out) if (o.bytes) manifest[o.target] = { kind: o.kind, page: o.page, url: o.url, date, note: o.note, bytes: o.bytes, width: o.width, height: o.height };
  fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  const clean = out.map(({ target, kind, page, url, note }) => ({ target, kind, page, url, note }));
  const merged = [...sources.filter((s) => !mine(s.target)), ...clean, ...overrides.filter((o) => !clean.some((c) => c.target === o.target))];
  fs.writeFileSync(SOURCES, `${JSON.stringify(merged, null, 2)}\n`);
  // Старые обложки коллекций, которых больше нет в сиде, удаляем
  const colDir = path.join(PUBLIC, 'images', 'brands', slug, 'collections');
  const keep = new Set(brand.collections.map(([name]) => slugify(name)));
  for (const f of fs.existsSync(colDir) ? fs.readdirSync(colDir) : []) {
    const base = f.replace(/\.(webp|svg)$/, '');
    if (!keep.has(base)) fs.rmSync(path.join(colDir, f), { recursive: true, force: true });
  }
  console.log(`[editorial] ${slug}: кадров ${out.filter((o) => o.bytes).length}; история — показы ${histCount}, Википедия ${wikiKept}, без иллюстрации ${noImage}`);
}

async function main() {
  const list = args.includes('--all') ? Object.keys(IMAGE_PLAN) : [opt('brand')].filter(Boolean);
  if (!list.length || list.some((b) => !IMAGE_PLAN[b])) {
    console.error(`Укажите --brand ${Object.keys(IMAGE_PLAN).join('|')} или --all`);
    process.exit(1);
  }
  const db = new pg.Client(config.db);
  await db.connect();
  try {
    for (const slug of list) await processBrand(db, slug);
  } finally {
    await db.end();
  }
  console.log('[editorial] Дальше: npm run db:seed && npm run placeholders');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
