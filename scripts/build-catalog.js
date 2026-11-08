// Каталог из реальных товаров: npm run catalog -- --brand chanel   (или --all)
//
// Каждый товар сайта — конкретная вещь из магазина-источника: название, цвет, категория, материал, цена и фото
// берутся из ОДНОЙ карточки, поэтому фото всегда совпадает с товаром. Цвета одной модели — отдельные товары
// с общим model_code и своими фото (переключатель цвета на странице товара показывает снимок этого цвета).
//
// Источники (db/content/image-plan.js → catalog):
//   • official — официальный сайт марки, разметка schema.org/Product на странице товара (Chanel, Prada) или
//                страницы магазина Chrome Hearts;
//   • fashionphile — открытый каталог Fashionphile (подлинные вещи с проверкой, ресейл): Gucci, Louis Vuitton,
//                Loro Piana, украшения Chrome Hearts;
//   • shopPhotos — уже скачанные фото конкретных вещей из магазинов (SSENSE, Supreme): товар получает название
//                и цвет той вещи, что на фото.
// Результат: db/content/catalog/<бренд>.json и фото public/images/brands/<бренд>/products/<ключ>-<n>.webp.
// Русские названия — db/content/catalog-ru.json (название EN → RU); без перевода — «Категория + название EN».
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { ensureProxyAwareFetch, BROWSER_UA, sleep } from './lib/net.js';
import { categoryOf, colorOf, materialOf, modelKey, titleCase, ITEM_NOUN, ruName } from './lib/catalog-rules.js';
import { IMAGE_PLAN } from '../db/content/image-plan.js';
import { BRANDS } from '../db/seed-data/brands.js';

ensureProxyAwareFetch();

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const OUT_DIR = path.join(ROOT, 'db', 'content', 'catalog');
const SOURCES = path.join(ROOT, 'db', 'content', 'image-sources.json');
const MAX_PER_BRAND = 60;
const USD_TO_BYN = 3.3;

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
};
const readJson = (file, fallback) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback);
const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);
const round10 = (n) => Math.round(n / 10) * 10;

async function get(url, type = 'text') {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': BROWSER_UA, Accept: type === 'json' ? 'application/json' : 'text/html,*/*' } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return type === 'json' ? await res.json() : await res.text();
    } catch (err) {
      if (attempt === 2) {
        console.warn(`[catalog] ${url}: ${err.message}`);
        return null;
      }
      await sleep(1500 * (attempt + 1));
    }
  }
  return null;
}
const decode = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const stripHtml = (s) => decode(String(s || '').replace(/<[^>]+>/g, ' '));

// schema.org/Product со страницы товара
function ldProduct(html) {
  for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const data = JSON.parse(m[1].trim());
      const list = Array.isArray(data) ? data : data['@graph'] || [data];
      const p = list.find((x) => x && (x['@type'] === 'Product' || (Array.isArray(x['@type']) && x['@type'].includes('Product'))));
      if (p) return p;
    } catch {
      /* битый JSON-LD — пропускаем */
    }
  }
  return null;
}

// ---------- Источник: официальный сайт Chanel ----------
async function chanelItems(cfg) {
  const urls = new Map();
  for (const listing of cfg.listings) {
    const html = await get(`https://www.chanel.com${listing}`);
    if (!html) continue;
    for (const m of html.matchAll(/https:\/\/www\.chanel\.com(\/us\/(?:fashion|eyewear|fragrance)\/p\/[A-Za-z0-9]+\/[a-z0-9-]+\/)/g)) if (!urls.has(m[1])) urls.set(m[1], listing);
    await sleep(600);
  }
  console.log(`[catalog] chanel: ссылок на товары ${urls.size}`);
  const items = [];
  for (const [u] of urls) {
    if (items.length >= cfg.limit) break;
    const html = await get(`https://www.chanel.com${u}`);
    await sleep(500);
    if (!html) continue;
    const p = ldProduct(html);
    if (!p?.name) continue;
    const ids = [...new Set([...html.matchAll(/\/images\/as\/[^"\s\\]*?\/(-?\d{6,})\.jpg/g)].map((m) => m[1]))].slice(0, 3);
    if (!ids.length) continue;
    const ref = (u.match(/\/p\/([A-Za-z0-9]+)\//) || [])[1];
    const desc = stripHtml(p.description || '');
    // У Chanel названия общие («Pumps», «Mules») — добавляем материалы из адреса страницы:
    // /p/…/pumps-lambskin-grosgrain/ → «Pumps, Lambskin & Grosgrain»
    const baseName = titleCase(decode(p.name)).replace(/^N°5/i, 'N°5');
    const nameSlug = baseName.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const slugTail = (u.match(/\/p\/[A-Za-z0-9]+\/([a-z0-9-]+)\//) || [])[1] || '';
    const matWords = [...new Set(slugTail.replace(nameSlug, '').split('-').filter((w) => w && !/^\d+$/.test(w)))];
    const materials = titleCase(matWords.join(' ')).replace(/Gold Tone/g, 'Gold-Tone').replace(/Silver Tone/g, 'Silver-Tone').replace(/Ruthenium Finish/g, 'Ruthenium-Finish');
    const name = materials && baseName.split(' ').length <= 4 ? `${baseName}, ${materials}` : baseName;
    items.push({
      key: `ch-${ref}`, name, colorText: p.color || desc, desc, type: `${urls.get(u)} ${u}`, gender: /men\b/.test(desc) ? 'men' : 'women',
      priceUsd: Number(p.offers?.price || p.offers?.[0]?.price) || null, page: `https://www.chanel.com${u}`,
      // Снимки Chanel — большой белый холст с вещью в центре: берём крупный размер и обрезаем поля (trim)
      images: ids.slice(0, 2).map((id) => `https://www.chanel.com/images/as/f_auto,q_auto:good,dpr_1.1/w_2400/${id}.jpg`),
      trim: true,
      detail: desc,
    });
  }
  return items;
}

// ---------- Источник: официальный сайт Prada ----------
async function pradaItems(cfg) {
  const urls = new Map();
  for (const listing of cfg.listings) {
    const html = await get(`https://www.prada.com${listing}`);
    if (!html) continue;
    let n = 0;
    for (const m of html.matchAll(/"url":"(https:\/\/www\.prada\.com\/us\/en\/p\/[^"]+)"/g)) {
      if (n >= cfg.perListing) break;
      if (!urls.has(m[1])) {
        urls.set(m[1], listing);
        n += 1;
      }
    }
    await sleep(600);
  }
  console.log(`[catalog] prada: ссылок на товары ${urls.size}`);
  const items = [];
  for (const [u, listing] of urls) {
    const html = await get(u);
    await sleep(500);
    if (!html) continue;
    const p = ldProduct(html);
    if (!p?.name) continue;
    const images = [].concat(p.image || []).filter((x) => /_SLF\.|_SLD\.|_SLR\.|_MDF\./.test(x));
    const front = images.find((x) => /_SLF\./.test(x)) || images[0];
    const second = images.find((x) => x !== front);
    if (!front) continue;
    const gender = p.audience?.suggestedGender === 'male' || /\/mens\//.test(listing) ? 'men' : 'women';
    items.push({
      // «Antiqued leather belt - Black» → название без цвета (цвет — отдельное поле товара)
      key: `pr-${(u.split('/').pop() || hash(u)).toLowerCase()}`, name: titleCase(decode(p.name).replace(/\s+-\s+[^-]+$/, '')), colorText: `${p.color || ''} ${(decode(p.name).match(/\s-\s([^-]+)$/) || [])[1] || ''}`, desc: stripHtml(p.description), type: `${p.category || ''} ${listing}`,
      gender, priceUsd: Number(p.offers?.price) || null, page: u, images: [front, second].filter(Boolean),
    });
  }
  return items;
}

// ---------- Источник: официальный онлайн-магазин Chrome Hearts ----------
async function chromeHeartsItems(cfg) {
  const pages = new Set();
  for (const listing of cfg.listings) {
    const res = await fetch(`https://www.chromehearts.com${listing}`, { headers: { 'User-Agent': BROWSER_UA }, redirect: 'follow' });
    const html = res.ok ? await res.text() : '';
    if (/\.html/.test(res.url)) pages.add(res.url.split('?')[0]);
    for (const m of html.matchAll(/href="((?:https:\/\/www\.chromehearts\.com)?\/[a-z0-9-]+\/[^"#?]+\.html)"/g)) {
      const u = m[1].startsWith('http') ? m[1] : `https://www.chromehearts.com${m[1]}`;
      if (!/(locations|magazine|terms|privacy|disclosure|general|contact)\.html$/.test(u)) pages.add(u);
    }
    await sleep(600);
  }
  console.log(`[catalog] chrome-hearts (официальный магазин): страниц товаров ${pages.size}`);
  const items = [];
  for (const u of pages) {
    const html = await get(u);
    await sleep(500);
    if (!html) continue;
    const p = ldProduct(html) || {};
    const name = decode(p.name || (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1]);
    const imgs = [...new Set([...html.matchAll(/(https:\/\/www\.chromehearts\.com\/dw\/image\/[^"'\s]+?img_products[^"'\s]+?\.(?:jpg|png))/g)].map((m) => m[1].split('?')[0]))];
    if (!name || !imgs.length) continue;
    const section = u.replace('https://www.chromehearts.com/', '').split('/')[0];
    const colorOnPage = (html.match(/COLOR:\s*([A-Za-z /]+)/) || [])[1] || '';
    items.push({
      key: `chs-${hash(u)}`, name: titleCase(stripHtml(name)), colorText: `${colorOnPage} ${name}`, desc: stripHtml(p.description || ''), type: section,
      gender: /intimates/.test(section) ? 'women' : 'unisex', priceUsd: Number(p.offers?.price) || null, page: u,
      images: imgs.slice(0, 2).map((x) => `${x}?sw=1000&sh=1250`),
    });
  }
  return items;
}

// ---------- Источник: официальный магазин Enfants Riches Déprimés (страницы товаров со schema.org/Product) ----------
async function erdItems(cfg) {
  const handles = new Set();
  for (const listing of cfg.listings) {
    const html = await get(`https://www.enfantsrichesdeprimes.com${listing}`);
    for (const m of (html || '').matchAll(/href="\/products\/([^"?#]+)"/g)) handles.add(m[1]);
    await sleep(600);
  }
  console.log(`[catalog] enfants-riches-deprimes: товаров в каталоге ${handles.size}`);
  const items = [];
  for (const h of handles) {
    const u = `https://www.enfantsrichesdeprimes.com/products/${h}`;
    const html = await get(u);
    await sleep(500);
    if (!html) continue;
    const p = ldProduct(html);
    const first = [].concat(p?.image || [])[0];
    if (!p?.name || !first) continue;
    const offer = [].concat(p.offers || [])[0] || {};
    const words = h.replace(/-\d{2}-\d{3,4}$/, '');
    items.push({
      key: `erd-${h.match(/(\d{2}-\d{3,4})$/)?.[1] || hash(h)}`, name: titleCase(decode(p.name)), colorText: words, desc: stripHtml(p.description || ''),
      type: h, gender: /women/.test(cfg.listings.join()) && !/men\b/.test(h) ? 'unisex' : 'unisex', priceUsd: Number(offer.price) || null, page: u,
      // Второй ракурс у марки — тот же файл с суффиксом -B
      images: [first.split('?')[0], first.split('?')[0].replace(/-A\.(png|jpe?g)$/i, '-B.$1')].filter((x, i, a) => a.indexOf(x) === i),
    });
  }
  return items;
}

// ---------- Источник: Fashionphile (Shopify, открытый products.json) ----------
async function fashionphileItems(cfg) {
  const items = [];
  for (const collection of cfg.collections) {
    for (let page = 1; page <= (cfg.pages || 2); page++) {
      const data = await get(`https://www.fashionphile.com/collections/${collection}/products.json?limit=250&page=${page}`, 'json');
      await sleep(800);
      const list = data?.products || [];
      for (const p of list) {
        if (cfg.vendor && String(p.vendor).toLowerCase() !== cfg.vendor.toLowerCase()) continue;
        if (!p.images?.length) continue;
        // Чемоданы, косметички, цепочки и ремни для сумок — не вещи для каталога
        if (/suitcase|luggage|trunk|rolling|cosmetic|toiletry|bag chain|^metal chain$|(coussin|pochette|speedy|alma|felicie|bag)\b.*\bchain$|strap/i.test(decode(p.title))) continue;
        const desc = stripHtml(p.body_html);
        // Название Fashionphile: «<материал> <модель> <вещь> [размер] <цвета>» — например,
        // «Calfskin Mini GG Marmont Chain Wallet Black», «… Loafers 38 Black». Всё после последнего слова-вещи —
        // размер и цвет: в название не идёт, цвет определяется по этому хвосту.
        const title = decode(p.title);
        let cut = -1;
        for (const m of title.matchAll(ITEM_NOUN)) cut = m.index + m[0].length;
        // Модельный размер LV (PM / MM / GM / BB / Nano) остаётся в названии
        const size = cut > 0 ? (title.slice(cut).match(/^\s+(PM|MM|GM|BB|Nano|Mini)\b/) || [''])[0] : '';
        if (size) cut += size.length;
        let name = (cut > 0 ? title.slice(0, cut) : title).trim();
        let tail = cut > 0 ? title.slice(cut) : '';
        if (cut < 0) {
          // Слова-вещи нет («Shearling Pulsion Lockit Grey») — цвет ищем в двух последних словах
          const words = title.split(' ');
          for (const n of [2, 1]) {
            const end = words.slice(-n).join(' ');
            if (words.length > n + 1 && colorOf(end)) {
              tail = end;
              name = words.slice(0, -n).join(' ');
              break;
            }
          }
        }
        items.push({
          key: `fp-${p.id}`, name, colorText: tail || title, desc, type: p.product_type,
          gender: /\bmen'?s\b/i.test(desc) ? 'men' : 'unisex', priceUsd: Number(p.variants?.[0]?.price) || null,
          page: `https://www.fashionphile.com/products/${p.handle}`, images: p.images.slice(0, 2).map((i) => i.src.split('?')[0] + '?width=1000'),
          preowned: true,
        });
      }
      if (list.length < 250) break;
    }
  }
  return items;
}

// ---------- Источник: уже скачанные фото конкретных вещей (SSENSE, Supreme) ----------
function shopPhotoItems(slug) {
  const sources = readJson(SOURCES, []).filter((s) => s.kind === 'product' && s.target.includes(`/brands/${slug}/`) && /-1\.webp$/.test(s.target));
  const seen = new Set();
  const items = [];
  for (const s of sources) {
    if (!/ssense\.com|supreme\.com/.test(s.page) || seen.has(s.page)) continue;
    seen.add(s.page);
    // Фото уже могли быть перенесены под ключ вещи при прошлом запуске (…/products/ss-19788181-1.webp)
    const keyOf = /ssense\.com/.test(s.page) ? `ss-${(s.page.match(/\/(\d+)(?:[/?#]|$)/) || [])[1]}` : `sp-${hash(s.page)}`;
    const moved = `/images/brands/${slug}/products/${keyOf}-1.webp`;
    const file1 = fs.existsSync(path.join(PUBLIC, s.target)) ? s.target : moved;
    const file2 = file1.replace(/-1\.webp$/, '-2.webp');
    if (!fs.existsSync(path.join(PUBLIC, file1))) continue;
    let name;
    let colorText;
    let gender = 'unisex';
    if (/ssense\.com/.test(s.page)) {
      const [, g, itemSlug, id] = s.page.match(/\/(men|women)\/product\/[^/]+\/([^/]+)\/(\d+)/) || [];
      if (!itemSlug) continue;
      gender = g === 'women' ? 'women' : 'men';
      // «black-and-white-oversized-sneakers» → цвет в начале, дальше — название модели
      const words = itemSlug.split('-');
      const colorWords = [];
      while (words.length > 1 && (colorOf(words[0]) || ['and', 'off', 'multicolor'].includes(words[0]))) colorWords.push(words.shift());
      colorText = colorWords.join(' ');
      // Слаг SSENSE теряет дефисы и апострофы: «t-shirt» → «t shirt», «l'esbian» → «l esbian»
      name = titleCase(words.join(' '))
        .replace(/\bT Shirts?\b/g, 'T-Shirt').replace(/\bZip Up\b/g, 'Zip-Up').replace(/\bCut Up\b/g, 'Cut-Up').replace(/\bO Leg\b/g, 'O-Leg')
        .replace(/\bL Esbian\b/g, "L'Esbian").replace(/\bHigh Top\b/g, 'High-Top').replace(/\bLow Top\b/g, 'Low-Top').replace(/\bSlip On\b/g, 'Slip-On')
        .replace(/\bCrew Neck\b/g, 'Crewneck').replace(/\bMock Neck\b/g, 'Mock-Neck').replace(/\bV Neck\b/g, 'V-Neck').replace(/\bX Ray\b/g, 'X-Ray')
        .replace(/\bDouble Breasted\b/g, 'Double-Breasted').replace(/\bSingle Breasted\b/g, 'Single-Breasted').replace(/\bWide Leg\b/g, 'Wide-Leg');
      items.push({ key: `ss-${id}`, name, colorText, desc: '', type: '', gender, priceUsd: null, page: s.page, files: [file1, file2], urls: [s.url, s.url.replace(/_1\.jpg$/, '_2.jpg')] });
    } else {
      const itemSlug = (String(s.note).match(/supreme\.com:\s*([a-z0-9-]+)/) || [])[1];
      if (!itemSlug) continue;
      const words = itemSlug.split('-');
      const tail = [];
      while (words.length > 2 && (colorOf(words[words.length - 1]) || ['heather', 'light', 'dark', 'washed'].includes(words[words.length - 1]))) tail.unshift(words.pop());
      colorText = tail.join(' ') || itemSlug;
      name = titleCase(words.join(' ')).replace(/^Supreme /, 'Supreme/').replace(/\bB B Simon\b/, 'B.B. Simon').replace(/\bS S\b/, 'S/S');
      items.push({ key: `sp-${hash(s.page)}`, name, colorText, desc: '', type: '', gender, priceUsd: null, page: s.page, files: [file1, file2], urls: [s.url] });
    }
  }
  return items;
}

async function saveImage(url, target, { trim = false } = {}) {
  const res = await fetch(url, { headers: { 'User-Agent': BROWSER_UA, Accept: 'image/*' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  let buf = Buffer.from(await res.arrayBuffer());
  if (trim) {
    // Обрезаем однотонные поля и оставляем ~9 % воздуха вокруг вещи
    // Рамка вещи — по пикселям темнее почти-белого (светло-серые подложки и тени считаются фоном)
    const { data: px, info: meta } = await sharp(buf).flatten({ background: '#ffffff' }).raw().toBuffer({ resolveWithObject: true });
    let x0 = meta.width, y0 = meta.height, x1 = -1, y1 = -1;
    for (let y = 0; y < meta.height; y += 2) {
      for (let x = 0; x < meta.width; x += 2) {
        const i = (y * meta.width + x) * meta.channels;
        if (Math.min(px[i], px[i + 1], px[i + 2]) < 200) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 <= x0 || y1 <= y0) throw new Error('пустой кадр');
    const data = await sharp(buf).flatten({ background: '#ffffff' }).extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }).toBuffer();
    const info = { width: x1 - x0 + 1, height: y1 - y0 + 1 };
    // Слишком вытянутая рамка — значит, обрезка зацепила подложку, а вещь осталась крошечной: кадр не годится
    const ratio = info.width / info.height;
    if (ratio > 3.2 || ratio < 0.42) throw new Error('кадр с подложкой — вещь занимает малую часть снимка');
    const pad = Math.round(Math.max(info.width, info.height) * 0.09);
    buf = await sharp(data).extend({ top: pad, bottom: pad, left: pad, right: pad, background: '#ffffff' }).toBuffer();
  }
  const file = path.join(PUBLIC, target);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Фото товара: до 900 px по ширине, белое поле до пропорции 4:5 (как у карточек), ≤ ~110 КБ
  let quality = 80;
  let out;
  do {
    out = await sharp(buf).rotate().resize({ width: 900, height: 1125, fit: 'contain', background: '#ffffff' }).flatten({ background: '#ffffff' }).webp({ quality }).toBuffer();
    quality -= 8;
  } while (out.length > 110 * 1024 && quality > 50);
  fs.writeFileSync(file, out);
}

async function buildBrand(slug) {
  const brand = BRANDS.find((b) => b.slug === slug);
  const cfg = IMAGE_PLAN[slug]?.catalog;
  if (!brand || !cfg) {
    console.log(`[catalog] ${slug}: источников нет — пропуск`);
    return;
  }
  let raw = [];
  for (const src of cfg) {
    if (src.type === 'chanel') raw.push(...(await chanelItems(src)));
    if (src.type === 'prada') raw.push(...(await pradaItems(src)));
    if (src.type === 'chromehearts') raw.push(...(await chromeHeartsItems(src)));
    if (src.type === 'fashionphile') raw.push(...(await fashionphileItems(src)));
    if (src.type === 'erd') raw.push(...(await erdItems(src)));
    if (src.type === 'shopPhotos') raw.push(...shopPhotoItems(slug));
  }
  console.log(`[catalog] ${slug}: вещей в источниках ${raw.length}`);
  // Разбор: категория / цвет / материал; без категории или с запрещёнными словами — не берём
  const ban = new RegExp(IMAGE_PLAN[slug].catalogExclude || '^$', 'i');
  const parsed = [];
  for (const it of raw) {
    if (ban.test(`${it.name} ${it.page}`)) continue;
    let category = categoryOf(it.name) || categoryOf(it.name, it.type) || categoryOf(it.name, it.desc);
    // Fashionphile: тип «Bags» — у сумок без слова-вещи в названии (Lockit, Capucines) — сумка
    if (it.type === 'Bags' && !['totes', 'crossbody', 'backpacks', 'clutches', 'wallets'].includes(category)) category = categoryOf(`${it.name} bag`) || 'crossbody';
    if (it.type === 'Jewelry' && !['rings', 'chains', 'bracelets', 'earrings', 'pendants'].includes(category)) category = null;
    // Раздел «обувь» на сайте марки: «Thongs» — сандалии-вьетнамки, а не бельё
    if (/\/shoes\//.test(it.type) && !['sneakers', 'boots', 'heels', 'loafers', 'sandals'].includes(category)) category = 'sandals';
    if (!category) continue;
    const color = colorOf(it.colorText, it.name, it.desc) || 'multicolor';
    const material = materialOf(category, it.name, it.desc);
    parsed.push({ ...it, category, color, material, model: modelKey(it.name) });
  }
  // Не больше MAX_PER_BRAND: по кругу по категориям, чтобы ассортимент был разнообразным
  const byCat = new Map();
  for (const p of parsed) {
    if (!byCat.has(p.category)) byCat.set(p.category, []);
    // Один и тот же товар (тот же цвет и модель) дважды не берём
    if (byCat.get(p.category).some((x) => x.model === p.model && x.color === p.color)) continue;
    byCat.get(p.category).push(p);
  }
  const picked = [];
  const queues = [...byCat.values()];
  while (picked.length < MAX_PER_BRAND && queues.some((q) => q.length)) for (const q of queues) if (q.length && picked.length < MAX_PER_BRAND) picked.push(q.shift());
  // Фото
  const productsDir = `/images/brands/${slug}/products`;
  const result = [];
  const keepFiles = new Set();
  for (const p of picked) {
    const images = [];
    try {
      if (p.files) {
        for (const [i, f] of p.files.entries()) {
          if (!fs.existsSync(path.join(PUBLIC, f))) continue;
          const target = `${productsDir}/${p.key}-${i + 1}.webp`;
          if (path.join(PUBLIC, f) !== path.join(PUBLIC, target)) fs.copyFileSync(path.join(PUBLIC, f), path.join(PUBLIC, target));
          images.push(target);
        }
      } else {
        for (const [i, url] of p.images.entries()) {
          const target = `${productsDir}/${p.key}-${i + 1}.webp`;
          try {
            if (!fs.existsSync(path.join(PUBLIC, target)) || args.includes('--refresh-images')) {
              await saveImage(url, target, { trim: p.trim });
              await sleep(300);
            }
            images.push(target);
          } catch (err) {
            fs.rmSync(path.join(PUBLIC, target), { force: true });
            // Неудачный кадр пропускаем: главным станет следующий ракурс; без единого фото товар не берём
          }
        }
        if (!images.length) throw new Error('нет пригодного фото');
        // Файлы по порядку: -1 — главное фото, -2 — второй ракурс
        images.forEach((img, n) => {
          const want = `${productsDir}/${p.key}-${n + 1}.webp`;
          if (img !== want) {
            fs.renameSync(path.join(PUBLIC, img), path.join(PUBLIC, want));
            images[n] = want;
          }
        });
      }
    } catch (err) {
      console.warn(`[catalog] ${p.key}: фото не скачано (${err.message}) — товар пропущен`);
      continue;
    }
    if (!images.length) continue;
    images.forEach((f) => keepFiles.add(path.basename(f)));
    result.push({
      key: p.key, model: p.model, name_en: p.name, name_ru: ruName(p.name, p.category), category: p.category, color: p.color, material: p.material, gender: p.gender,
      price_byn: p.priceUsd ? round10(p.priceUsd * USD_TO_BYN) : null, preowned: Boolean(p.preowned), images, page: p.page,
      source: new URL(p.page).hostname.replace(/^www\./, ''),
      image_urls: (p.images || p.urls || []).slice(0, images.length),
    });
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, `${slug}.json`), `${JSON.stringify(result, null, 1)}\n`);
  // Старые фото товаров (прежние артикулы и вещи, не вошедшие в каталог) удаляем
  const dir = path.join(PUBLIC, productsDir);
  let removed = 0;
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    if (f.endsWith('.webp') && !keepFiles.has(f)) {
      fs.rmSync(path.join(dir, f));
      removed += 1;
    }
  }
  const cats = {};
  result.forEach((r) => (cats[r.category] = (cats[r.category] || 0) + 1));
  console.log(`[catalog] ${slug}: товаров ${result.length}, моделей ${new Set(result.map((r) => r.model)).size}; удалено старых фото ${removed}; ${JSON.stringify(cats)}`);
}

// Список источников фото (image-sources.json): записи товаров заменяются записями из каталогов —
// так npm run images -- --from-manifest и проверка источников видят настоящие фото вещей
function syncSources() {
  const sources = readJson(SOURCES, []).filter((s) => s.kind !== 'product');
  let n = 0;
  for (const f of fs.readdirSync(OUT_DIR).filter((x) => x.endsWith('.json'))) {
    for (const item of readJson(path.join(OUT_DIR, f), [])) {
      item.images.forEach((target, i) => {
        sources.push({ target, kind: 'product', page: item.page, url: item.image_urls?.[i] || null, note: `${item.source}: ${item.name_en}${item.preowned ? ' (подлинная вещь с ресейла)' : ''}` });
        n += 1;
      });
    }
  }
  fs.writeFileSync(SOURCES, `${JSON.stringify(sources, null, 2)}\n`);
  console.log(`[catalog] image-sources.json: записей товаров ${n}`);
}

async function main() {
  if (args.includes('--sync-sources')) return syncSources();
  const list = args.includes('--all') ? Object.keys(IMAGE_PLAN).filter((b) => IMAGE_PLAN[b].catalog) : [opt('brand')].filter(Boolean);
  if (!list.length) {
    console.error('Укажите --brand <slug> или --all');
    process.exit(1);
  }
  for (const slug of list) await buildBrand(slug);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
