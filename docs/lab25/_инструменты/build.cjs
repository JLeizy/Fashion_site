// Сборка SVG из дерева слоёв (Node). Картинки вшиваются как заливка прямоугольника (как экспорт Figma).
const fs = require('fs');
const path = require('path');
const sharp = require('/home/user/Fashion_site/node_modules/sharp');

const SITE = '/home/user/Fashion_site/public';
const BASE = 'http://localhost:3000';
const IMG_SCALE = Number(process.env.IMG_SCALE || 1.25);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const R = (v) => Math.round(v * 100) / 100;

function cleanName(s, max = 48) {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  if (s.length > max) s = s.slice(0, max - 1).trim() + '…';
  return s;
}

async function loadSource(src) {
  if (src.startsWith('data:')) {
    const m = src.match(/^data:([^;,]+)(;base64)?,(.*)$/s);
    if (!m) return null;
    return m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]));
  }
  let p = src.startsWith(BASE) ? src.slice(BASE.length) : src.startsWith('/') ? src : null;
  if (p) {
    p = decodeURIComponent(p.split('?')[0]);
    const cands = [path.join(SITE, p)];
    if (p.startsWith('/vendor/')) cands.push(path.join('/home/user/Fashion_site/node_modules', p.replace('/vendor/fonts/', '/@fontsource/')));
    for (const c of cands) if (fs.existsSync(c)) return fs.readFileSync(c);
  }
  try {
    const res = await fetch(src.startsWith('http') ? src : BASE + src);
    if (res.ok) return Buffer.from(await res.arrayBuffer());
  } catch {}
  return null;
}

function parseLen(v, total, img) {
  if (v === 'auto') return null;
  if (v.endsWith('%')) return (parseFloat(v) / 100) * total;
  return parseFloat(v);
}

// Где на странице нарисована вся картинка целиком (до обрезки)
function drawnRect(item, iw, ih) {
  const b = item.box;
  let w = iw, h = ih;
  const fit = (item.fit || 'fill').trim();
  if (item.role === 'img') {
    if (fit === 'cover' || fit === 'contain' || fit === 'scale-down') {
      let s = fit === 'cover' ? Math.max(b.w / iw, b.h / ih) : Math.min(b.w / iw, b.h / ih);
      if (fit === 'scale-down') s = Math.min(1, s);
      w = iw * s; h = ih * s;
    } else if (fit === 'none') { w = iw; h = ih; } else { w = b.w; h = b.h; }
  } else {
    if (fit === 'cover' || fit === 'contain') {
      const s = fit === 'cover' ? Math.max(b.w / iw, b.h / ih) : Math.min(b.w / iw, b.h / ih);
      w = iw * s; h = ih * s;
    } else {
      const parts = fit.split(/\s+/);
      const pw = parseLen(parts[0], b.w), ph = parseLen(parts[1] || 'auto', b.h);
      if (pw != null && ph != null) { w = pw; h = ph; } else if (pw != null) { w = pw; h = (pw * ih) / iw; } else if (ph != null) { h = ph; w = (ph * iw) / ih; }
    }
  }
  const toks = (item.pos || '50% 50%').match(/calc\([^)]*\)|\S+/g) || [];
  const px = toks[0] || '50%', py = toks[1] || '50%';
  const off = (v, free) => {
    const c = v.match(/calc\(\s*([\d.]+)%\s*([+-])\s*([\d.]+)px\s*\)/);
    if (c) return (free * parseFloat(c[1])) / 100 + (c[2] === '-' ? -1 : 1) * parseFloat(c[3]);
    if (v.endsWith('%')) return (free * parseFloat(v)) / 100;
    return parseFloat(v) || 0;
  };
  const ox = off(px, b.w - w), oy = off(py, b.h - h);
  return { x: b.x + ox, y: b.y + oy, w, h };
}

function inter(a, b) {
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
  if (x2 - x <= 0.5 || y2 - y <= 0.5) return null;
  return { x, y, w: x2 - x, h: y2 - y };
}

const imgCache = new Map();
async function prepareImage(item) {
  let buf = await loadSource(item.src);
  if (!buf) return null;
  let meta;
  try { meta = await sharp(buf).metadata(); } catch { return null; }
  let iw = meta.width, ih = meta.height;
  if (!iw || !ih) return null;
  if (meta.format === 'svg') {
    const k = 3;
    buf = await sharp(buf, { density: 72 * k }).png().toBuffer();
    const m2 = await sharp(buf).metadata();
    meta = { ...m2, hasAlpha: true };
    var srcW = m2.width, srcH = m2.height;
  } else { var srcW = iw, srcH = ih; }
  const D = drawnRect(item, iw, ih);
  const V = inter(D, item.vis);
  if (!V) return null;
  const sx = srcW / D.w, sy = srcH / D.h;
  const crop = {
    left: Math.max(0, Math.floor((V.x - D.x) * sx)), top: Math.max(0, Math.floor((V.y - D.y) * sy)),
  };
  crop.width = Math.max(1, Math.min(srcW - crop.left, Math.round(V.w * sx)));
  crop.height = Math.max(1, Math.min(srcH - crop.top, Math.round(V.h * sy)));
  if (crop.left >= srcW || crop.top >= srcH) return null;
  const outW = Math.max(1, Math.min(crop.width, Math.round(V.w * IMG_SCALE)));
  const outH = Math.max(1, Math.round((outW * crop.height) / crop.width));
  const key = item.src + JSON.stringify(crop) + outW;
  if (imgCache.has(key)) return { ...imgCache.get(key), rect: V };
  let pipe = sharp(buf).extract(crop).resize(outW, outH, { fit: 'fill' });
  let mime, data;
  if (meta.hasAlpha) {
    const st = await sharp(buf).extract(crop).stats();
    if (st.isOpaque) { data = await pipe.jpeg({ quality: 80, mozjpeg: true }).toBuffer(); mime = 'image/jpeg'; }
    else { data = await pipe.png({ compressionLevel: 9, palette: outW * outH > 40000 }).toBuffer(); mime = 'image/png'; }
  } else { data = await pipe.jpeg({ quality: 80, mozjpeg: true }).toBuffer(); mime = 'image/jpeg'; }
  const res = { href: `data:${mime};base64,${data.toString('base64')}`, pw: outW, ph: outH };
  imgCache.set(key, res);
  return { ...res, rect: V };
}

function rectShape(box, radius) {
  const [tl, tr, br, bl] = radius || [0, 0, 0, 0];
  const { x, y, w, h } = box;
  if (tl === tr && tr === br && br === bl) return { tag: 'rect', attrs: `x="${R(x)}" y="${R(y)}" width="${R(w)}" height="${R(h)}"${tl > 0.5 ? ` rx="${R(tl)}"` : ''}` };
  const d = `M${R(x + tl)} ${R(y)}H${R(x + w - tr)}${tr ? `A${R(tr)} ${R(tr)} 0 0 1 ${R(x + w)} ${R(y + tr)}` : ''}V${R(y + h - br)}${br ? `A${R(br)} ${R(br)} 0 0 1 ${R(x + w - br)} ${R(y + h)}` : ''}H${R(x + bl)}${bl ? `A${R(bl)} ${R(bl)} 0 0 1 ${R(x)} ${R(y + h - bl)}` : ''}V${R(y + tl)}${tl ? `A${R(tl)} ${R(tl)} 0 0 1 ${R(x + tl)} ${R(y)}` : ''}Z`;
  return { tag: 'path', attrs: `d="${d}"` };
}

function overlaps(a, b) {
  if (!a || !b) return false;
  const i = inter(a, b);
  return i && i.w > 1 && i.h > 1;
}

// Порядок: по слоям отрисовки; внутри слоя без перекрытий — обратный (в Figma читается сверху вниз)
function ordered(children) {
  const own = children.filter((c) => ['rect', 'image', 'raster'].includes(c.kind) && c.role !== 'outline');
  const outline = children.filter((c) => c.role === 'outline');
  const rest = children.filter((c) => !own.includes(c) && !outline.includes(c));
  const tiers = new Map();
  for (const c of rest) {
    const t = c.tier ?? 0;
    if (!tiers.has(t)) tiers.set(t, []);
    tiers.get(t).push(c);
  }
  const out = [...own];
  const area = (b) => Math.max(0, b.w) * Math.max(0, b.h);
  const realOverlap = (a, b) => {
    a = a.ubox || a.box; b = b.ubox || b.box;
    if (!a || !b) return false;
    const i = inter(a, b);
    if (!i || i.w <= 2 || i.h <= 2) return false;
    return area(i) > 0.02 * Math.min(area(a), area(b));
  };
  // Перекрывающиеся пары рисуются в порядке отрисовки CSS (слой, затем DOM); остальное — обратный DOM,
  // чтобы в панели слоёв Figma блоки читались сверху вниз, как на странице
  const list = rest, n = list.length;
  const key = (i) => [list[i].tier ?? 0, i];
  const before = (i, j) => { const a = key(i), b = key(j); return a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]); };
  const indeg = new Array(n).fill(0), nxt = list.map(() => []);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (realOverlap(list[i], list[j])) {
    const [a, b] = before(i, j) ? [i, j] : [j, i];
    nxt[a].push(b); indeg[b]++;
  }
  const done = new Array(n).fill(false);
  for (let k = 0; k < n; k++) {
    let pick = -1;
    for (let i = n - 1; i >= 0; i--) if (!done[i] && indeg[i] === 0) { pick = i; break; }
    if (pick < 0) pick = done.indexOf(false);
    done[pick] = true;
    out.push(list[pick]);
    for (const j of nxt[pick]) indeg[j]--;
  }
  return out.concat(outline);
}

class Builder {
  constructor(frameName) {
    this.frameName = frameName;
    this.defs = [];
    this.n = 0;
    this.stats = { images: 0, texts: 0, icons: 0, groups: 0, rects: 0 };
  }

  async imageEl(item, name) {
    const im = item.prepared;
    if (!im) return '';
    const id = ++this.n;
    this.defs.push(
      `<pattern id="pattern${id}" patternContentUnits="objectBoundingBox" width="1" height="1"><use xlink:href="#image${id}" transform="scale(${1 / im.pw} ${1 / im.ph})"/></pattern>`,
      `<image id="image${id}" width="${im.pw}" height="${im.ph}" preserveAspectRatio="none" xlink:href="${im.href}"/>`
    );
    const sh = rectShape(im.rect, item.radius && Math.max(...item.radius) > 3 ? item.radius : null);
    this.stats.images++;
    return `<${sh.tag} id="${esc(name)}" ${sh.attrs} fill="url(#pattern${id})"${item.opacity < 1 ? ` opacity="${item.opacity}"` : ''}/>`;
  }

  textEl(t, name) {
    const s = t.style;
    this.stats.texts++;
    const attrs = [
      `id="${esc(name || cleanName(t.lines.map((l) => l.text).join(' ')))}"`,
      `font-family="${esc(s.family)}"`, `font-size="${R(s.size)}"`, `font-weight="${s.weight}"`,
      s.italic ? 'font-style="italic"' : '', `fill="${s.fill}"`, s.opacity < 1 ? `fill-opacity="${s.opacity}"` : '',
      s.ls ? `letter-spacing="${s.ls}"` : '',
      s.stroke ? `stroke="${s.stroke}" stroke-width="${s.strokeW}"${s.strokeOp < 1 ? ` stroke-opacity="${s.strokeOp}"` : ''}` : '', t.anchor && t.anchor !== 'start' ? `text-anchor="${t.anchor}"` : '',
      s.underline ? 'text-decoration="underline"' : s.strike ? 'text-decoration="line-through"' : '',
      'xml:space="preserve"',
    ].filter(Boolean).join(' ');
    return `<text ${attrs}>${t.lines.map((l) => `<tspan x="${l.x}" y="${l.y}">${esc(l.text)}</tspan>`).join('')}</text>`;
  }

  iconEl(ic, name) {
    this.stats.icons++;
    const nm = name || (ic.iconId ? 'Иконка_' + ic.iconId.replace(/^i-/, '').replace(/^orn-/, 'орнамент_') : 'Иконка');
    return `<g id="${esc(nm)}" transform="${ic.transform}" fill="${ic.fill}" stroke="${ic.stroke}" stroke-width="${ic.sw}" stroke-linecap="${ic.cap}" stroke-linejoin="${ic.join}"${ic.opacity < 1 ? ` opacity="${ic.opacity}"` : ''}>${ic.markup}</g>`;
  }

  rectEl(r, name) {
    this.stats.rects++;
    if (!r.box) return '';
    const sh = rectShape(r.box, r.radius);
    if (r.gradient) {
      const id = ++this.n;
      const g = r.gradient;
      const stops = g.stops.map((s) => `<stop offset="${R(s.offset)}" stop-color="${s.color}"${s.opacity < 1 ? ` stop-opacity="${s.opacity}"` : ''}/>`).join('');
      if (g.type === 'linear') this.defs.push(`<linearGradient id="paint${id}" x1="${g.x1}" y1="${g.y1}" x2="${g.x2}" y2="${g.y2}" gradientUnits="userSpaceOnUse">${stops}</linearGradient>`);
      else this.defs.push(`<radialGradient id="paint${id}" cx="${g.cx}" cy="${g.cy}" r="0.71" gradientUnits="objectBoundingBox">${stops}</radialGradient>`);
      return `<${sh.tag} id="${esc(name)}" ${sh.attrs} fill="url(#paint${id})"${r.opacity < 1 ? ` opacity="${r.opacity}"` : ''}/>`;
    }
    if (r.stroke) {
      const hw = r.sw / 2;
      const b = { x: r.box.x + hw, y: r.box.y + hw, w: Math.max(0, r.box.w - r.sw), h: Math.max(0, r.box.h - r.sw) };
      const sh2 = rectShape(b, (r.radius || [0, 0, 0, 0]).map((v) => Math.max(0, v - hw)));
      return `<${sh2.tag} id="${esc(name)}" ${sh2.attrs} stroke="${r.stroke}" stroke-width="${r.sw}"${r.dash ? ` stroke-dasharray="${r.dash.join(' ')}"` : ''}${r.opacity < 1 ? ` stroke-opacity="${r.opacity}"` : ''} fill="none"/>`;
    }
    return `<${sh.tag} id="${esc(name)}" ${sh.attrs} fill="${r.fill}"${r.opacity < 1 ? ` fill-opacity="${r.opacity}"` : ''}/>`;
  }

  // Подготовка картинок (асинхронно, до сериализации)
  async prepare(node, rasterMap) {
    if (!node) return;
    if (node.kind === 'image') node.prepared = await prepareImage(node);
    if (node.kind === 'raster') {
      const r = rasterMap[node.id];
      if (r) node.prepared = { href: r.href, pw: r.pw, ph: r.ph, rect: node.box };
    }
    if (node.children) for (const c of node.children) await this.prepare(c, rasterMap);
  }

  async ser(node, parentName) {
    if (!node) return '';
    switch (node.kind) {
      case 'rect': {
        const nm = node.name || (node.role === 'bg' ? (parentName ? 'Фон_' + parentName : 'Фон') : node.role === 'border' ? 'Рамка' : node.role === 'gradient' ? 'Градиент' : node.role === 'outline' ? 'Фокус' : 'Линия');
        return this.rectEl(node, nm);
      }
      case 'image': {
        const nm = node.name || (node.role === 'bgimage' ? 'Фоновое_изображение' : node.alt ? 'Фото_' + cleanName(node.alt, 40) : 'Фото');
        return this.imageEl(node, nm);
      }
      case 'raster':
        return this.imageEl(node, node.name || (parentName ? 'Изображение_' + parentName : 'Изображение'));
      case 'text':
        return this.textEl(node, node.name);
      case 'icon':
        return this.iconEl(node, node.name);
      case 'group': {
        let kids = ordered(node.children);
        // Одиночный текст или иконка внутри именованного блока без фона — сам слой получает имя блока
        if (node.name && kids.length === 1 && (kids[0].kind === 'text' || kids[0].kind === 'icon') && !kids[0].name) {
          kids[0].name = node.name;
          return this.ser(kids[0], parentName);
        }
        if (node.name && kids.length === 1 && kids[0].kind === 'group' && !kids[0].name) {
          node.children = kids[0].children;
          return this.ser(node, parentName);
        }
        if (node.name && kids.length === 1 && (kids[0].kind === 'image' || kids[0].kind === 'raster') && !kids[0].name && !/^(Ссылка|Кнопка|Пункт)/.test(node.name)) {
          kids[0].name = node.name;
          return this.ser(kids[0], parentName);
        }
        const inner = [];
        for (const k of kids) inner.push(await this.ser(k, node.name || parentName));
        // Нумерация одинаковых соседних блоков: Карточка_товара_1, _2…
        const body = inner.filter(Boolean);
        if (!node.name) return body.join('');
        this.stats.groups++;
        return `<g id="${esc(node.name)}">${body.join('')}</g>`;
      }
    }
    return '';
  }
}

// Нумерация повторяющихся имён среди соседей
function numberSiblings(node) {
  if (!node || !node.children) return;
  // поднимаем детей безымянных групп для подсчёта соседей
  const flat = [];
  const collect = (n) => { for (const c of n.children || []) { if (c.kind === 'group' && !c.name) collect(c); else flat.push(c); } };
  collect(node);
  const counts = {};
  for (const c of flat) if (c.kind === 'group' && c.name && !c.keepName) counts[c.name] = (counts[c.name] || 0) + 1;
  const idx = {};
  for (const c of flat) if (c.kind === 'group' && c.name && counts[c.name] > 1 && !c.keepName) { idx[c.name] = (idx[c.name] || 0) + 1; c.name = `${c.name}_${idx[c.name]}`; }
  for (const c of node.children) numberSiblings(c);
}

async function buildSVG({ tree, rasterMap, frameName, width, height, bg }) {
  const b = new Builder(frameName);
  numberSiblings(tree);
  await b.prepare(tree, rasterMap);
  tree.name = null; // body — без отдельной группы
  tree.children = (tree.children || []).filter((c) => !(c.kind === 'rect' && c.role === 'bg'));
  const body = await b.ser(tree, null);
  const svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">\n<g id="${esc(frameName)}"><rect id="Фон_${esc(frameName)}" width="${width}" height="${height}" fill="${bg}"/>${body}</g>\n<defs>\n${b.defs.join('\n')}\n</defs>\n</svg>\n`;
  return { svg, stats: b.stats };
}

module.exports = { buildSVG, cleanName };
