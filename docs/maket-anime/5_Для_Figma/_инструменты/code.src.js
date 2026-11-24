// «Мультивселенная аниме» — стили и переходы (плагин Figma)
//
// Добавляет к готовому макету стили (цвета, градиенты, тексты, сетки) и переходы прототипа.
// Внешний вид макета не меняется:
//   • стиль цвета привязывается к слою, только если цвет слоя совпадает со стилем;
//   • стиль текста — только если шрифт, кегль, разрядка и регистр совпадают; если меняется лишь
//     интерлиньяж однострочного текста, слой сдвигается так, что буквы остаются на месте;
//   • в конце каждый изменённый фрейм сравнивается с исходным пиксель в пиксель,
//     при любом отличии привязки в этом фрейме отменяются.
// Что уже сделано вручную (стили, переходы, привязки), не трогается. Гамбургер остаётся некликабельным.
// Новых страниц и фреймов плагин не создаёт.
const DATA = /*DATA*/ {};
const UI_HTML = /*UI*/ '';

const CMD = figma.command || 'all';
const DRY = CMD === 'check';
const DO_STYLES = CMD === 'all' || CMD === 'styles' || DRY;
const DO_LINKS = CMD === 'all' || CMD === 'links' || DRY;

// ---------- окно с отчётом ----------
let uiReadyResolve;
const uiReady = new Promise((r) => { uiReadyResolve = r; });
const pending = new Map();
let reqId = 0;
figma.showUI(UI_HTML, { width: 520, height: 640, title: 'Мультивселенная — стили и переходы' });
figma.ui.onmessage = (m) => {
  if (!m) return;
  if (m.type === 'ready') uiReadyResolve();
  if (m.type === 'compared' && pending.has(m.id)) { const f = pending.get(m.id); pending.delete(m.id); f(m); }
  if (m.type === 'close') figma.closePlugin();
};
const out = (text, cls) => figma.ui.postMessage({ type: 'log', text, cls });
const head = (text) => out(text, 'h');
const state = (text) => figma.ui.postMessage({ type: 'state', text });
const comparePng = (a, b) => new Promise((res) => {
  const id = ++reqId;
  pending.set(id, res);
  figma.ui.postMessage({ type: 'compare', id, a, b });
  setTimeout(() => { if (pending.has(id)) { pending.delete(id); res({ error: 'окно не ответило' }); } }, 180000);
});

// ---------- общие помощники ----------
const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/ё/g, 'е').replace(/[\s_\-–—.]+/g, ' ').trim();
const baseName = (s) => String(s).replace(/\.svg$/i, '').replace(/\s+\d+$/, '').trim();
const normText = (s) => String(s).replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const isBurger = (n) => /бургер|burger/.test(norm(n.name));
const ancestor = (n, pred) => { for (let p = n.parent; p && p.type !== 'PAGE' && p.type !== 'DOCUMENT'; p = p.parent) if (pred(p)) return p; return null; };
const inInstance = (n) => !!ancestor(n, (p) => p.type === 'INSTANCE');
const plural = (n, one, few, many) => { const a = Math.abs(n) % 100, b = a % 10; return `${n} ${a > 10 && a < 20 ? many : b > 1 && b < 5 ? few : b === 1 ? one : many}`; };
const clone = (v) => (v === undefined || typeof v === 'symbol' ? v : JSON.parse(JSON.stringify(v)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- кадры макета ----------
const KEYS = [['home', 'Главная', /^главн/], ['bleach', 'Блич', /^блич/], ['onepiece', 'Ван-Пис', /^ван ?пис/], ['angel', 'Ангельские_ритмы', /^ангел/]];
const TITLE = { home: 'Главная', bleach: 'Блич', onepiece: 'Ван-Пис', angel: 'Ангельские ритмы' };
const BPS = [1440, 768, 375];

function scan() {
  const frames = [];
  const visit = (parent, page) => {
    for (const c of parent.children) {
      if (c.type === 'SECTION') visit(c, page);
      else if (c.type === 'FRAME' || c.type === 'COMPONENT' || c.type === 'COMPONENT_SET') frames.push({ node: c, page });
    }
  };
  for (const page of figma.root.children) visit(page, page);
  const screens = { 1440: {}, 768: {}, 375: {} };
  const dupes = [];
  for (const f of frames) {
    const b = baseName(f.node.name);
    const n = norm(b);
    f.base = b;
    f.canon = b;
    if (/^обложк/.test(n)) { f.cover = true; f.canon = 'Обложка'; continue; }
    if (/^стили/.test(n)) f.canon = 'Стили';
    if (/^компонент/.test(n)) f.canon = 'Компоненты';
    const k = KEYS.find(([, , re]) => re.test(n));
    if (!k || f.node.type !== 'FRAME') continue;
    const m = b.match(/(1440|768|375)(?!\d)/);
    const bp = m ? +m[1] : f.node.width >= 1200 ? 1440 : f.node.width >= 600 ? 768 : 375;
    f.key = k[0];
    f.bp = bp;
    f.canon = `${k[1]}_${bp}`;
    if (screens[bp][k[0]]) { dupes.push(f.node.name); continue; }
    screens[bp][k[0]] = f;
  }
  return { frames, screens, dupes };
}

// ---------- шрифты ----------
let FONTS = null;
async function stylesOf(family) {
  if (!FONTS) {
    FONTS = new Map();
    for (const f of await figma.listAvailableFontsAsync()) {
      if (!FONTS.has(f.fontName.family)) FONTS.set(f.fontName.family, []);
      FONTS.get(f.fontName.family).push(f.fontName.style);
    }
  }
  return FONTS.get(family) || [];
}
async function resolveFont(family, style) {
  const list = await stylesOf(family);
  if (!list.length) return null;
  const want = norm(style).replace(/ /g, '');
  const hit = list.find((s) => norm(s).replace(/ /g, '') === want);
  return hit ? { family, style: hit } : null;
}
const loadedFonts = new Set();
async function loadFont(f) {
  if (!f || f === figma.mixed) return false;
  const k = `${f.family}|${f.style}`;
  if (loadedFonts.has(k)) return true;
  try { await figma.loadFontAsync(f); loadedFonts.add(k); return true; } catch (e) { return false; }
}

// ---------- цвета ----------
const hexRgb = (hex) => { const h = hex.replace('#', ''); return { r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255 }; };
const c255 = (v) => Math.round(v * 255);
const hexOf = (c) => '#' + [c.r, c.g, c.b].map((v) => c255(v).toString(16).padStart(2, '0')).join('').toUpperCase();
const opOf = (p) => (p.opacity == null ? 1 : p.opacity);
function paintKey(p) {
  if (!p || p.visible === false) return null;
  if (p.blendMode && p.blendMode !== 'NORMAL' && p.blendMode !== 'PASS_THROUGH') return null;
  if (p.boundVariables && Object.keys(p.boundVariables).length) return null;
  if (p.type === 'SOLID') return `S:${c255(p.color.r)},${c255(p.color.g)},${c255(p.color.b)}|${Math.round(opOf(p) * 100)}`;
  if (p.type === 'GRADIENT_LINEAR') {
    const st = p.gradientStops.map((s) => `${s.position.toFixed(3)}:${c255(s.color.r)},${c255(s.color.g)},${c255(s.color.b)},${Math.round(s.color.a * 100)}`).join(';');
    const tr = p.gradientTransform.map((r) => r.map((v) => v.toFixed(3)).join(',')).join(';');
    return `G:${st}|${tr}|${Math.round(opOf(p) * 100)}`;
  }
  return null;
}
const paintsKey = (paints) => (Array.isArray(paints) && paints.length === 1 ? paintKey(paints[0]) : null);
const paintLabel = (p) => (p.type === 'SOLID' ? hexOf(p.color) + (opOf(p) < 0.999 ? ` ${Math.round(opOf(p) * 100)}%` : '') : 'градиент');

// направление градиента #0F0F14: 'h' — тёмный слева, 'v' — тёмный снизу
function gradientKind(p, hex) {
  if (!p || p.type !== 'GRADIENT_LINEAR' || p.gradientStops.length < 2) return null;
  const s0 = p.gradientStops[0].color, s1 = p.gradientStops[p.gradientStops.length - 1].color;
  if (hexOf(s0) !== hex || hexOf(s1) !== hex) return null;
  const [[a, b], [d, e]] = [[p.gradientTransform[0][0], p.gradientTransform[0][1]], [p.gradientTransform[1][0], p.gradientTransform[1][1]]];
  const det = a * e - b * d;
  if (Math.abs(det) < 1e-9) return null;
  const vx = e / det, vy = -d / det; // направление градиента в координатах слоя
  if (Math.abs(vx) >= Math.abs(vy)) {
    const left = vx > 0 ? s0.a : s1.a, right = vx > 0 ? s1.a : s0.a;
    return left > 0.9 && right < 0.1 ? 'h' : null;
  }
  const top = vy > 0 ? s0.a : s1.a, bottom = vy > 0 ? s1.a : s0.a;
  return top < 0.1 && bottom > 0.9 ? 'v' : null;
}
function defaultGradient(g) {
  const c = hexRgb(g.hex);
  return {
    type: 'GRADIENT_LINEAR',
    gradientTransform: g.dir === 'h' ? [[1, 0, 0], [0, 1, 0]] : [[0, 1, 0], [-1, 0, 1]],
    gradientStops: [{ position: 0, color: { r: c.r, g: c.g, b: c.b, a: g.a0 } }, { position: 1, color: { r: c.r, g: c.g, b: c.b, a: g.a1 } }],
  };
}
const cleanPaint = (p) => { const q = clone(p); delete q.boundVariables; for (const st of q.gradientStops || []) delete st.boundVariables; return q; };

// ---------- тексты ----------
const lhPx = (lh, size) => (!lh || lh.unit === 'AUTO' ? null : lh.unit === 'PIXELS' ? lh.value : (lh.value * size) / 100);
const lsPx = (ls, size) => (ls.unit === 'PIXELS' ? ls.value : (ls.value * size) / 100);
const sameLh = (a, b, size) => { const pa = lhPx(a, size), pb = lhPx(b, size); return pa === null || pb === null ? pa === pb : Math.abs(pa - pb) < 0.05; };
const lhLabel = (lh, size) => (!lh || lh.unit === 'AUTO' ? 'авто' : lh.unit === 'PERCENT' ? `${+lh.value.toFixed(2)}%` : `${+lh.value.toFixed(2)} px`);
const lsLabel = (ls) => (ls.unit === 'PERCENT' ? `${+ls.value.toFixed(2)}%` : `${+ls.value.toFixed(2)} px`);
const isUpper = (s) => s === s.toUpperCase();
function caseOk(t, styleCase) {
  if (t.textCase === styleCase) return true;
  const both = [t.textCase, styleCase];
  return both.includes('UPPER') && both.includes('ORIGINAL') && isUpper(t.characters);
}

function guessRole(t, bp) {
  const fam = t.fontName.family, st = norm(t.fontName.style), size = Math.round(t.fontSize);
  const bold = /bold|black|heavy|semi|demi/.test(st), medium = /medium/.test(st);
  if (fam === 'Unbounded') {
    const map = { 72: 'Общие/Оценка', 88: 'Обложка/Заголовок', 18: 'Общие/Логотип', 16: 'Мобильный/Логотип', 64: 'Десктоп/Заголовок_h1', 44: 'Планшет/Заголовок_h1', 40: 'Десктоп/Заголовок_h2', 26: 'Мобильный/Заголовок_h2', 24: 'Десктоп/Заголовок_h3', 22: 'Планшет/Заголовок_h3', 20: 'Мобильный/Заголовок_h3' };
    if (map[size]) return map[size];
    if (size === 32) return bp === 768 || (bp !== 375 && /semi/.test(st)) ? 'Планшет/Заголовок_h2' : 'Мобильный/Заголовок_h1';
  }
  if (fam === 'Inter') {
    if (size === 13) return 'Общие/Тег';
    if (size === 14) return bold ? 'Общие/Текст_малый_акцент' : 'Общие/Текст_малый';
    if (size === 16) {
      if (bold) return 'Общие/Кнопка';
      if (medium || bp === 1440) return 'Общие/Навигация';
      if (t.characters.length <= 24 && !t.characters.includes('\n')) return 'Общие/Навигация';
      return bp === 768 ? 'Планшет/Текст' : 'Мобильный/Текст';
    }
    if (size === 18) return 'Десктоп/Текст';
    if (size === 24) return 'Обложка/Подзаголовок';
  }
  return null;
}
function roleOf(t, table, bp) {
  const size = Math.round(t.fontSize), fam = t.fontName.family;
  for (const s of [normText(t.characters), normText(t.characters.split('\n')[0])]) {
    const r = table[`${s}|${size}|${fam}`];
    if (r && r !== '?') return r;
  }
  return guessRole(t, bp);
}
// текст «в потоке»: он или его группа стоит в Auto layout — менять высоту блока нельзя
function inFlow(n, top) {
  for (let c = n; c && c !== top; c = c.parent) {
    const p = c.parent;
    if (!p || p.type === 'PAGE') return false;
    if (p.layoutMode && p.layoutMode !== 'NONE' && c.layoutPositioning !== 'ABSOLUTE') return true;
  }
  return false;
}
const hidden = (n) => !n.visible || !!ancestor(n, (p) => p.visible === false);
function compat(e, v) {
  const t = e.t;
  if (t.fontName.family !== v.fontName.family || t.fontName.style !== v.fontName.style) return 'шрифт';
  if (Math.abs(t.fontSize - v.fontSize) > 0.01) return 'кегль';
  if (t.letterSpacing === figma.mixed || Math.abs(lsPx(t.letterSpacing, t.fontSize) - lsPx(v.letterSpacing, v.fontSize)) > 0.01) return 'разрядка';
  if (t.textCase === figma.mixed || !caseOk(t, v.textCase)) return 'регистр';
  if (t.textDecoration === figma.mixed || t.textDecoration !== 'NONE') return 'подчёркивание';
  if (t.lineHeight === figma.mixed) return 'интерлиньяж';
  if (!sameLh(t.lineHeight, v.lineHeight, t.fontSize)) return e.rigid ? 'интерлиньяж' : 'shift';
  return 'ok';
}
const TEXT_PROPS = ['fontName', 'fontSize', 'lineHeight', 'letterSpacing', 'textCase', 'textDecoration', 'paragraphSpacing', 'paragraphIndent', 'leadingTrim'];
function textState(t) {
  const s = { x: t.x, y: t.y, w: t.width, h: t.height, rb: t.absoluteRenderBounds ? clone(t.absoluteRenderBounds) : null };
  for (const k of TEXT_PROPS) if (k in t && typeof t[k] !== 'symbol') s[k] = clone(t[k]);
  return s;
}

// ---------- 1. Стили ----------
const R = {
  paintCreated: [], paintReused: [], textCreated: [], textReused: [], gridCreated: [], gridReused: [],
  fills: 0, strokes: 0, textFills: 0, texts: 0, textsShifted: 0, alreadyStyled: 0, gridsSet: 0, gridsHad: 0,
  textSkip: new Map(), colorsLeft: new Map(), deviations: [], frameChecks: [], reverted: 0,
  links: 0, scrolls: 0, linksKept: 0, linksMissing: [], burgerCleared: 0, burgerWarn: [], otherPage: 0,
  flows: [], comp: 0, errors: [],
};
const skip = (why) => R.textSkip.set(why, (R.textSkip.get(why) || 0) + 1);

async function planPaints(S) {
  const existing = await figma.getLocalPaintStylesAsync();
  const byName = new Map(existing.map((s) => [norm(s.name), s]));
  const byKey = new Map();
  for (const s of existing) { const k = paintsKey(s.paints); if (k && !byKey.has(k)) byKey.set(k, s); }
  const screens = S.frames.filter((f) => f.key);
  const specs = [];
  for (const c of DATA.colors) {
    const paints = [{ type: 'SOLID', color: hexRgb(c.hex), opacity: c.opacity }];
    specs.push({ name: c.name, desc: c.desc, paints, key: paintsKey(paints) });
  }
  for (const g of DATA.gradients) {
    // образец градиента берём из самого макета: слой «Затемнение_…» или градиент того же вида
    let rep = null;
    const want = norm(g.name.split('/')[1]);
    for (const f of screens) {
      const n = f.node.findOne((x) => 'fills' in x && Array.isArray(x.fills) && x.fills.length === 1 && x.fills[0].type === 'GRADIENT_LINEAR'
        && (norm(x.name).startsWith(want) || gradientKind(x.fills[0], g.hex) === g.dir));
      if (n) { rep = n.fills[0]; break; }
    }
    const paints = [rep ? cleanPaint(rep) : defaultGradient(g)];
    specs.push({ name: g.name, desc: g.desc, paints, key: paintsKey(paints) });
  }
  for (const sp of specs) {
    sp.style = byName.get(norm(sp.name)) || byKey.get(sp.key) || null;
    if (sp.style) sp.key = paintsKey(sp.style.paints) || sp.key;
  }
  return specs;
}

async function planTextStyles(S) {
  const existing = await figma.getLocalTextStylesAsync();
  const byName = new Map(existing.map((s) => [norm(s.name), s]));
  const roles = new Map(DATA.textStyles.map((sp) => [sp.name, { spec: sp, entries: [] }]));
  for (const f of S.frames) {
    const table = DATA.lookup[f.canon] || DATA.lookup[f.base] || {};
    for (const t of f.node.findAll((n) => n.type === 'TEXT')) {
      if (inInstance(t)) continue;
      if (t.textStyleId !== '') { R.alreadyStyled++; continue; }
      if (t.hasMissingFont) { skip('шрифта нет в Figma'); continue; }
      if (t.fontName === figma.mixed || t.fontSize === figma.mixed) { skip('несколько шрифтов в одном слое'); continue; }
      const r = roleOf(t, table, f.bp);
      if (!r || !roles.has(r)) { skip('шрифт не из дизайн-системы'); continue; }
      const rigid = t.characters.includes('\n') || inFlow(t, f.node) || Math.abs(t.rotation || 0) > 0.01 || hidden(t);
      roles.get(r).entries.push({ t, f, rigid });
    }
  }
  for (const [name, role] of roles) {
    const sp = role.spec;
    role.style = byName.get(norm(name)) || null;
    if (role.style) {
      const s = role.style;
      role.values = { fontName: s.fontName, fontSize: s.fontSize, lineHeight: s.lineHeight, letterSpacing: s.letterSpacing, textCase: s.textCase, textDecoration: s.textDecoration };
      continue;
    }
    // значения стиля: как в макете (шрифт, кегль, разрядка — большинство слоёв), интерлиньяж — по странице «Стили», если его можно задать без сдвига букв
    const count = (fn) => { const m = new Map(); for (const e of role.entries) { const k = fn(e.t); m.set(k, (m.get(k) || 0) + 1); } return [...m.entries()].sort((a, b) => b[1] - a[1]); };
    const design = await resolveFont(sp.family, sp.style);
    let fontName = design, fontSize = sp.size, letterSpacing = { unit: 'PERCENT', value: sp.ls }, textCase = sp.upper ? 'UPPER' : 'ORIGINAL';
    if (role.entries.length) {
      const [fk] = count((t) => `${t.fontName.family}|${t.fontName.style}`)[0];
      fontName = { family: fk.split('|')[0], style: fk.split('|')[1] };
      fontSize = +count((t) => t.fontSize)[0][0];
      const lsTop = +count((t) => (t.letterSpacing === figma.mixed ? 'x' : lsPx(t.letterSpacing, t.fontSize).toFixed(2)))[0][0];
      const lsDesign = (sp.ls * fontSize) / 100;
      letterSpacing = Math.abs(lsTop - lsDesign) < 0.01 ? { unit: 'PERCENT', value: sp.ls } : lsTop === 0 ? { unit: 'PERCENT', value: 0 } : { unit: 'PIXELS', value: lsTop };
      const sameFont = role.entries.filter((e) => e.t.fontName.family === fontName.family && e.t.fontName.style === fontName.style);
      textCase = sp.upper && sameFont.every((e) => isUpper(e.t.characters)) ? 'UPPER' : count((t) => t.textCase)[0][0];
    }
    if (!fontName) { role.values = null; continue; }
    const base = { fontName, fontSize, letterSpacing, textCase, textDecoration: 'NONE' };
    const cands = [{ unit: 'PERCENT', value: sp.lh }];
    for (const e of role.entries) if (e.t.lineHeight !== figma.mixed && !cands.some((c) => sameLh(c, e.t.lineHeight, fontSize) && c.unit === e.t.lineHeight.unit)) cands.push(clone(e.t.lineHeight));
    let best = null;
    for (const lh of cands) {
      const v = Object.assign({}, base, { lineHeight: lh });
      const score = role.entries.filter((e) => { const c = compat(e, v); return c === 'ok' || c === 'shift'; }).length;
      if (!best || score > best.score) best = { score, v };
    }
    role.values = best.v;
    // где значения расходятся со страницей «Стили» — сказать в отчёте
    const diff = [];
    if (design && (fontName.family !== design.family || fontName.style !== design.style)) diff.push(`шрифт ${fontName.family} ${fontName.style} (на странице «Стили» ${sp.family} ${sp.style})`);
    if (Math.abs(lsPx(letterSpacing, fontSize) - (sp.ls * fontSize) / 100) > 0.01) diff.push(`разрядка ${lsLabel(letterSpacing)} (на странице «Стили» ${sp.ls}%)`);
    if (!(best.v.lineHeight.unit === 'PERCENT' && Math.abs(best.v.lineHeight.value - sp.lh) < 0.01)) diff.push(`интерлиньяж ${lhLabel(best.v.lineHeight, fontSize)} (на странице «Стили» ${sp.lh}%)`);
    role.diff = diff;
  }
  return roles;
}

async function planGrids() {
  const existing = await figma.getLocalGridStylesAsync();
  const byName = new Map(existing.map((s) => [norm(s.name), s]));
  return DATA.grids.map((g) => {
    const grid = { pattern: 'COLUMNS', alignment: 'STRETCH', gutterSize: g.gutter, count: g.count, offset: g.margin, visible: true, color: { r: 1, g: 0, b: 0, a: 0.1 } };
    const byValue = existing.find((s) => s.layoutGrids.length === 1 && s.layoutGrids[0].pattern === 'COLUMNS' && s.layoutGrids[0].count === g.count && s.layoutGrids[0].gutterSize === g.gutter && s.layoutGrids[0].offset === g.margin);
    return { spec: g, grid, style: byName.get(norm(g.name)) || byValue || null };
  });
}

async function exportFrame(node) {
  const px = node.width * node.height;
  const scale = px > 30e6 ? 0.5 : 1;
  return node.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: scale } });
}

async function stylesStep(S) {
  state('Разбираю цвета и тексты макета…');
  const paints = await planPaints(S);
  const roles = await planTextStyles(S);
  const grids = await planGrids();

  // ----- что будет привязано -----
  const keyToSpec = new Map();
  for (const sp of paints) if (sp.key && !keyToSpec.has(sp.key)) keyToSpec.set(sp.key, sp);
  const jobs = new Map(); // кадр → список действий
  const job = (f) => { if (!jobs.has(f.node.id)) jobs.set(f.node.id, { f, fills: [], strokes: [], texts: [] }); return jobs.get(f.node.id); };
  for (const f of S.frames) {
    const nodes = [f.node, ...f.node.findAll(() => true)];
    for (const n of nodes) {
      if (n.type === 'INSTANCE' || inInstance(n)) continue;
      if ('fills' in n && n.fillStyleId === '' && Array.isArray(n.fills) && n.fills.length) {
        const sp = keyToSpec.get(paintsKey(n.fills));
        if (sp) job(f).fills.push({ n, sp });
        else if ((f.key || f.cover) && n !== f.node) for (const p of n.fills) if (p.visible !== false && (p.type === 'SOLID' || p.type.startsWith('GRADIENT'))) R.colorsLeft.set(paintLabel(p), (R.colorsLeft.get(paintLabel(p)) || 0) + 1);
      }
      if ('strokes' in n && n.strokeStyleId === '' && Array.isArray(n.strokes) && n.strokes.length) {
        const sp = keyToSpec.get(paintsKey(n.strokes));
        if (sp) job(f).strokes.push({ n, sp });
        else if (f.key || f.cover) for (const p of n.strokes) if (p.visible !== false && p.type === 'SOLID') R.colorsLeft.set(paintLabel(p) + ' (обводка)', (R.colorsLeft.get(paintLabel(p) + ' (обводка)') || 0) + 1);
      }
    }
  }
  for (const role of roles.values()) {
    if (!role.values) { for (const e of role.entries) skip('шрифта стиля нет в Figma'); continue; }
    for (const e of role.entries) {
      const c = compat(e, role.values);
      if (c === 'ok' || c === 'shift') job(e.f).texts.push({ e, role, shift: c === 'shift' });
      else skip(`отличается ${c} от стиля «${role.spec.name}»`);
    }
  }

  // ----- создать недостающие стили -----
  for (const sp of paints) {
    if (sp.style) { R.paintReused.push(sp.style.name === sp.name ? sp.name : `${sp.name} → ваш «${sp.style.name}»`); continue; }
    const used = [...jobs.values()].some((j) => j.fills.some((x) => x.sp === sp) || j.strokes.some((x) => x.sp === sp));
    const isExtra = sp.name === 'Фон/Карточка_прозрачная';
    if (isExtra && !used) continue; // дополнительный цвет — только если он есть в макете
    R.paintCreated.push(sp.name);
    if (DRY) continue;
    const s = figma.createPaintStyle();
    s.name = sp.name;
    s.paints = sp.paints;
    s.description = sp.desc;
    sp.style = s;
  }
  for (const [name, role] of roles) {
    if (role.style) { R.textReused.push(name); continue; }
    const isExtra = /Мобильный\/Логотип|Текст_малый_акцент|^Обложка\//.test(name);
    if (!role.values) { R.errors.push(`стиль «${name}»: нет шрифта ${role.spec.family} ${role.spec.style}`); continue; }
    if (isExtra && !role.entries.length) continue;
    const v = role.values;
    R.textCreated.push(name);
    if (role.diff && role.diff.length) R.deviations.push(`${name}: ${role.diff.join(', ')}`);
    if (DRY) continue;
    if (!(await loadFont(v.fontName))) { R.errors.push(`стиль «${name}»: не загрузился шрифт ${v.fontName.family} ${v.fontName.style}`); continue; }
    const s = figma.createTextStyle();
    s.name = name;
    s.fontName = v.fontName;
    s.fontSize = v.fontSize;
    s.lineHeight = v.lineHeight;
    s.letterSpacing = v.letterSpacing;
    s.textCase = v.textCase;
    s.description = `${role.spec.desc}. ${v.fontName.family} ${v.fontName.style} · ${+v.fontSize.toFixed(2)} px · интерлиньяж ${lhLabel(v.lineHeight, v.fontSize)}` +
      (lsPx(v.letterSpacing, v.fontSize) ? ` · разрядка ${lsLabel(v.letterSpacing)}` : '') + (v.textCase === 'UPPER' ? ' · все заглавные' : '');
    role.style = s;
  }
  for (const g of grids) {
    if (g.style) { R.gridReused.push(g.spec.name); continue; }
    R.gridCreated.push(g.spec.name);
    if (DRY) continue;
    const s = figma.createGridStyle();
    s.name = g.spec.name;
    s.layoutGrids = [g.grid];
    s.description = g.spec.desc;
    g.style = s;
  }

  // ----- сетки на фреймах (в экспорт и прототип не попадают) -----
  for (const g of grids) {
    for (const f of Object.values(S.screens[g.spec.bp])) {
      if (f.node.layoutGrids.length || f.node.gridStyleId) { R.gridsHad++; continue; }
      R.gridsSet++;
      if (!DRY && g.style) await f.node.setGridStyleIdAsync(g.style.id);
    }
  }

  const total = (k) => [...jobs.values()].reduce((a, j) => a + j[k].length, 0);
  if (DRY) {
    const fl = [...jobs.values()].flatMap((j) => j.fills);
    R.fills = fl.filter((x) => x.n.type !== 'TEXT').length; R.textFills = fl.length - R.fills;
    R.strokes = total('strokes'); R.texts = total('texts');
    R.textsShifted = [...jobs.values()].reduce((a, j) => a + j.texts.filter((x) => x.shift).length, 0);
    return;
  }

  // ----- по одному фрейму: снимок «до» → привязка → снимок «после» → сравнение пиксель в пиксель -----
  const list = [...jobs.values()].filter((j) => j.fills.length + j.strokes.length + j.texts.length);
  let i = 0;
  for (const j of list) {
    const name = j.f.node.name;
    i++;
    state(`Фрейм ${i} из ${list.length}: ${name} — снимок до изменений…`);
    let before = null;
    try { before = await exportFrame(j.f.node); } catch (e) { before = null; }
    state(`Фрейм ${i} из ${list.length}: ${name} — привязываю стили…`);
    const undo = [];
    for (const { n, sp } of j.fills) {
      if (!sp.style) continue;
      const old = clone(n.fills);
      try { await n.setFillStyleIdAsync(sp.style.id); undo.push({ kind: 'fill', n, old }); if (n.type === 'TEXT') R.textFills++; else R.fills++; } catch (e) { R.errors.push(`цвет «${n.name}»: ${e.message || e}`); }
    }
    for (const { n, sp } of j.strokes) {
      if (!sp.style) continue;
      const old = clone(n.strokes);
      try { await n.setStrokeStyleIdAsync(sp.style.id); undo.push({ kind: 'stroke', n, old }); R.strokes++; } catch (e) { R.errors.push(`обводка «${n.name}»: ${e.message || e}`); }
    }
    for (const { e, role, shift } of j.texts) {
      const t = e.t;
      if (!role.style) continue;
      const old = textState(t);
      try {
        if (!(await loadFont(t.fontName)) || !(await loadFont(role.style.fontName))) { skip('шрифт не загрузился'); continue; }
        await t.setTextStyleIdAsync(role.style.id);
        let ok = true;
        const rb = t.absoluteRenderBounds;
        if (old.rb && rb) {
          // буквы должны остаться там же: если интерлиньяж стиля другой, слой сдвигается на разницу
          const dx = old.rb.x - rb.x, dy = old.rb.y - rb.y;
          if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) { t.x += dx; t.y += dy; }
          const rb2 = t.absoluteRenderBounds;
          ok = !!rb2 && Math.abs(rb2.x - old.rb.x) < 0.02 && Math.abs(rb2.y - old.rb.y) < 0.02 && Math.abs(rb2.width - old.rb.width) < 0.05 && Math.abs(rb2.height - old.rb.height) < 0.05;
        } else ok = Math.abs(t.width - old.w) < 0.01 && Math.abs(t.height - old.h) < 0.01;
        if (e.rigid && (Math.abs(t.width - old.w) > 0.01 || Math.abs(t.height - old.h) > 0.01)) ok = false;
        if (!ok) { await restoreText(t, old); skip('после привязки буквы сдвинулись бы — оставлено как было'); continue; }
        undo.push({ kind: 'text', n: t, old, shift });
        R.texts++;
        if (shift) R.textsShifted++;
      } catch (err) {
        try { await restoreText(t, old); } catch (e2) {}
        R.errors.push(`текст «${t.characters.slice(0, 30)}»: ${err.message || err}`);
      }
    }
    if (!undo.length) continue;
    if (!before) { R.frameChecks.push({ name, res: 'не удалось снять фрейм до изменений — сравнение пропущено' }); continue; }
    state(`Фрейм ${i} из ${list.length}: ${name} — сверяю пиксель в пиксель…`);
    let res;
    try { res = await comparePng(before, await exportFrame(j.f.node)); } catch (e) { res = { error: (e && e.message) || String(e) }; }
    if (res.error) { R.frameChecks.push({ name, res: `сравнение не удалось: ${res.error}` }); continue; }
    if (res.same) { R.frameChecks.push({ name, res: 'ok' }); continue; }
    // есть отличие — отменить все привязки в этом фрейме
    for (const u of undo.reverse()) {
      try {
        if (u.kind === 'fill') { await u.n.setFillStyleIdAsync(''); u.n.fills = u.old; if (u.n.type === 'TEXT') R.textFills--; else R.fills--; }
        if (u.kind === 'stroke') { await u.n.setStrokeStyleIdAsync(''); u.n.strokes = u.old; R.strokes--; }
        if (u.kind === 'text') { await restoreText(u.n, u.old); R.texts--; if (u.shift) R.textsShifted--; }
        R.reverted++;
      } catch (e) {}
    }
    try { res = await comparePng(before, await exportFrame(j.f.node)); } catch (e) { res = { same: false }; }
    R.frameChecks.push({ name, res: res.same ? 'reverted' : 'reverted-diff', changed: res.changed });
  }
}

async function restoreText(t, s) {
  await t.setTextStyleIdAsync('');
  if (s.fontName && (await loadFont(s.fontName))) t.fontName = s.fontName;
  for (const k of TEXT_PROPS) if (k !== 'fontName' && k in s && JSON.stringify(t[k]) !== JSON.stringify(s[k])) { try { t[k] = s[k]; } catch (e) {} }
  t.x = s.x;
  t.y = s.y;
}

// ---------- 2. Переходы ----------
const EASE_OUT = { type: 'EASE_OUT' };
const NAV = (id) => ({ type: 'NODE', destinationId: id, navigation: 'NAVIGATE', transition: { type: 'DISSOLVE', easing: EASE_OUT, duration: 0.3 } });
const SCROLL = (id, animated) => ({ type: 'NODE', destinationId: id, navigation: 'SCROLL_TO', transition: animated ? { type: 'SCROLL_ANIMATE', easing: { type: 'EASE_IN_AND_OUT' }, duration: 0.6 } : null });
function destKey(s) {
  s = norm(s);
  if (/ван ?пис/.test(s)) return 'onepiece';
  if (/ангел/.test(s)) return 'angel';
  if (/блич/.test(s)) return 'bleach';
  if (/главн|портал/.test(s)) return 'home';
  return null;
}
const byName = (root, re) => (root && 'findOne' in root ? root.findOne((n) => re.test(norm(n.name))) : null);
const textOf = (n) => (n.type === 'TEXT' ? n.characters : 'findAll' in n ? n.findAll((x) => x.type === 'TEXT').map((x) => x.characters).join(' ') : '');
function section(F, re) {
  const c = F.findAll((n) => n.type !== 'TEXT' && re.test(norm(n.name)) && !ancestor(n, (p) => /^(шапка|подвал|первый экран)/.test(norm(p.name))));
  c.sort((a, b) => b.width * b.height - a.width * a.height);
  return c[0] || null;
}
function outermost(list) { const set = new Set(list); return list.filter((n) => !ancestor(n, (p) => set.has(p))); }

function planLinks(S) {
  const plan = [];
  const add = (f, node, dest, label) => plan.push({ f, node, dest, label });
  for (const bp of BPS) {
    for (const key of Object.keys(S.screens[bp])) {
      const f = S.screens[bp][key];
      const F = f.node;
      const header = byName(F, /^шапка/), footer = byName(F, /^подвал/);
      if (header) {
        add(f, byName(header, /^логотип( \d+)?$/) || byName(header, /^логотип/), 'home', 'логотип в шапке');
        const nav = byName(header, /^навигац/);
        if (nav) {
          let items = nav.children || [];
          if (items.length === 1 && items[0].children) items = items[0].children;
          for (const it of items) add(f, it, destKey(it.name) || destKey(textOf(it)), `меню «${normText(textOf(it))}»`);
        }
      } else add(f, null, 'home', 'шапка');
      if (footer) {
        add(f, byName(footer, /^логотип( \d+)?$/) || byName(footer, /^логотип/), 'home', 'логотип в подвале');
        const links = byName(footer, /^ссылки/);
        if (links) {
          for (const t of links.findAll((n) => n.type === 'TEXT')) {
            const d = destKey(t.characters);
            if (!d) continue;
            const p = t.parent;
            const target = p && p !== links && p.type === 'GROUP' && p.children.length === 1 ? p : t;
            add(f, target, d, `подвал «${normText(t.characters)}»`);
          }
        }
      }
      if (key === 'home') {
        add(f, byName(F, /^кнопка выбрать мир/), { scroll: section(F, /^миры/) }, 'кнопка «Выбрать мир»');
        add(f, byName(F, /^кнопка о проекте/), { scroll: section(F, /^о проекте/) }, 'кнопка «О проекте»');
        const worlds = section(F, /^миры/);
        if (worlds) {
          for (const card of outermost(worlds.findAll((n) => /^карточка/.test(norm(n.name))))) {
            const d = destKey(card.name) || destKey(textOf(card));
            if (d && d !== 'home') add(f, card, d, `карточка мира «${TITLE[d]}»`);
          }
        }
      } else {
        const next = byName(F, /^следующий мир/);
        if (next) {
          const banner = byName(next, /^баннер/) || next;
          const title = byName(next, /^название/);
          add(f, banner, destKey(textOf(title || next)), 'баннер «Следующий мир»');
        } else add(f, null, null, 'баннер «Следующий мир»');
      }
    }
  }
  return plan;
}

async function setReactions(node, reactions) {
  if (typeof node.setReactionsAsync === 'function') await node.setReactionsAsync(reactions);
  else node.reactions = reactions;
}

async function linksStep(S) {
  state('Расставляю переходы…');
  const plan = planLinks(S);
  const pages = new Set();
  for (const it of plan) {
    const { f, node } = it;
    if (!node) { R.linksMissing.push(`${f.node.name}: не найден слой — ${it.label}`); continue; }
    if (isBurger(node) || ancestor(node, isBurger) || node.findOne && node.findOne(isBurger)) { R.linksMissing.push(`${f.node.name}: ${it.label} — пропущено, внутри гамбургер`); continue; }
    if (node.reactions && node.reactions.length) { R.linksKept++; continue; }
    let action, scroll = false;
    if (it.dest && typeof it.dest === 'object') {
      if (!it.dest.scroll) { R.linksMissing.push(`${f.node.name}: не найден блок для ${it.label}`); continue; }
      action = SCROLL(it.dest.scroll.id, true);
      scroll = true;
    } else {
      if (!it.dest) { R.linksMissing.push(`${f.node.name}: не понял, куда ведёт ${it.label}`); continue; }
      if (it.dest === f.key) {
        // ссылка на ту же страницу — прокрутка наверх
        const top = byName(f.node, /^шапка/) || byName(f.node, /^первый экран/);
        if (!top) continue;
        action = SCROLL(top.id, true);
        scroll = true;
      } else {
        const dst = S.screens[f.bp][it.dest];
        if (!dst) { R.linksMissing.push(`${f.node.name}: нет фрейма «${TITLE[it.dest]}_${f.bp}» для ${it.label}`); continue; }
        if (dst.page !== f.page) { R.otherPage++; continue; }
        action = NAV(dst.node.id);
      }
    }
    pages.add(f.page);
    if (DRY) { if (scroll) R.scrolls++; else R.links++; continue; }
    try {
      await setReactions(node, [{ trigger: { type: 'ON_CLICK' }, actions: [action] }]);
    } catch (e) {
      if (!scroll) { R.errors.push(`переход «${it.label}» (${f.node.name}): ${e.message || e}`); continue; }
      try { await setReactions(node, [{ trigger: { type: 'ON_CLICK' }, actions: [SCROLL(action.destinationId, false)] }]); } catch (e2) { R.errors.push(`прокрутка «${it.label}» (${f.node.name}): ${e2.message || e2}`); continue; }
    }
    if (scroll) R.scrolls++; else R.links++;
  }

  // гамбургер — без переходов
  for (const f of S.frames) {
    for (const b of f.node.findAll(isBurger)) {
      for (const n of [b, ...('findAll' in b ? b.findAll(() => true) : [])]) {
        if (n.reactions && n.reactions.length) { R.burgerCleared++; if (!DRY) await setReactions(n, []); }
      }
      const up = ancestor(b, (p) => p.reactions && p.reactions.some((r) => r.trigger && r.trigger.type === 'ON_CLICK'));
      if (up) R.burgerWarn.push(`${f.node.name}: у слоя «${up.name}», в котором лежит гамбургер, есть свой переход — нажатие на гамбургер сработает как нажатие на «${up.name}»`);
    }
  }

  // стартовые точки (Flows)
  for (const page of figma.root.children) {
    const want = [['Десктоп 1440', 1440], ['Планшет 768', 768], ['Мобильный 375', 375]]
      .map(([name, bp]) => ({ name, f: S.screens[bp].home }))
      .filter((x) => x.f && x.f.page === page);
    if (!want.length) continue;
    const flows = (page.flowStartingPoints || []).map((x) => ({ nodeId: x.nodeId, name: x.name }));
    let changed = false;
    for (const w of want) {
      if (flows.some((x) => x.nodeId === w.f.node.id)) continue;
      flows.push({ nodeId: w.f.node.id, name: flows.some((x) => x.name === w.name) ? `${w.name} (${w.f.node.name})` : w.name });
      R.flows.push(w.name);
      changed = true;
    }
    if (changed && !DRY) page.flowStartingPoints = flows;
  }

  // состояния компонентов: наведение, нажатие, открыть/закрыть (если в файле есть варианты)
  const DEF = /^(default|по ?умолчанию|обычн|норм|базов|rest|idle|enabled|static|покой)/;
  const HOV = /hover|навед/;
  const PRS = /press|нажат|active|актив/;
  const OPN = /^(open|opened|открыт|развернут|показан|expanded)/;
  const CLS = /^(close|closed|закрыт|свернут|скрыт|collapsed)/;
  const SMART = { type: 'SMART_ANIMATE', easing: EASE_OUT, duration: 0.2 };
  for (const page of figma.root.children) {
    for (const set of page.findAll((n) => n.type === 'COMPONENT_SET')) {
      if (isBurger(set)) continue;
      let vars, props;
      try {
        vars = set.children.filter((c) => c.type === 'COMPONENT' && c.variantProperties);
        props = set.variantGroupProperties || {};
      } catch (e) { continue; } // в наборе вариантов есть ошибки — пропускаем
      for (const prop of Object.keys(props)) {
        const vals = props[prop].values || [];
        const pick = (re) => vals.find((v) => re.test(norm(v)));
        const vDef = pick(DEF), vHov = pick(HOV), vPrs = pick(PRS), vOpn = pick(OPN), vCls = pick(CLS);
        const twin = (v, val) => vars.find((w) => w !== v && w.variantProperties[prop] === val && Object.keys(v.variantProperties).every((k) => k === prop || w.variantProperties[k] === v.variantProperties[k]));
        for (const v of vars) {
          if (isBurger(v) || (v.reactions && v.reactions.length)) continue;
          const val = v.variantProperties[prop];
          const rs = [];
          const go = (trig, val2) => { const w = twin(v, val2); if (w) rs.push({ trigger: { type: trig }, actions: [{ type: 'NODE', destinationId: w.id, navigation: 'CHANGE_TO', transition: SMART }] }); };
          if (vDef && val === vDef) { if (vHov) go('ON_HOVER', vHov); if (vPrs) go('ON_PRESS', vPrs); }
          if (vHov && val === vHov && vPrs) go('ON_PRESS', vPrs);
          if (vOpn && vCls && val === vCls) go('ON_CLICK', vOpn);
          if (vOpn && vCls && val === vOpn) go('ON_CLICK', vCls);
          if (!rs.length) continue;
          R.comp += rs.length;
          if (!DRY) { try { await setReactions(v, rs); } catch (e) { R.comp -= rs.length; R.errors.push(`компонент «${set.name}»: ${e.message || e}`); } }
        }
      }
    }
  }
}

// ---------- отчёт ----------
function report(S) {
  const will = DRY ? 'будет ' : '';
  if (DO_STYLES) {
    head(DRY ? 'Стили — что будет сделано' : 'Стили');
    out(`Цвета: ${DRY ? 'будет создано' : 'создано'} ${R.paintCreated.length}${R.paintReused.length ? `, уже были ${R.paintReused.length}` : ''}.`);
    if (R.paintCreated.length) out('  ' + R.paintCreated.join(', '), 'dim');
    if (R.paintReused.length) out('  уже были: ' + R.paintReused.join(', '), 'dim');
    out(`Текстовые стили: ${DRY ? 'будет создано' : 'создано'} ${R.textCreated.length}${R.textReused.length ? `, уже были ${R.textReused.length}` : ''}.`);
    if (R.textCreated.length) out('  ' + R.textCreated.join(', '), 'dim');
    out(`Сетки: ${DRY ? 'будет создано' : 'создано'} ${R.gridCreated.length}${R.gridReused.length ? `, уже были ${R.gridReused.length}` : ''}; ${will}назначено фреймам: ${R.gridsSet}${R.gridsHad ? `, у ${R.gridsHad} сетка уже была` : ''}.`);
    out(`${DRY ? 'Будет привязано' : 'Привязано'} к стилям: заливки ${R.fills}, обводки ${R.strokes}, цвет текста ${R.textFills}, текстовые стили ${R.texts}${R.textsShifted ? ` (у ${R.textsShifted} подправлено положение слоя, чтобы буквы не сдвинулись)` : ''}.`, 'ok');
    if (R.alreadyStyled) out(`Тексты, у которых стиль уже был: ${R.alreadyStyled} — не тронуты.`, 'dim');
    if (R.textSkip.size) { out('Тексты без стиля (оставлены как есть):', 'warn'); for (const [k, v] of R.textSkip) out(`  ${k}: ${v}`, 'warn'); }
    if (R.colorsLeft.size) {
      out('Цвета в макете не из палитры (оставлены как есть):', 'warn');
      for (const [k, v] of [...R.colorsLeft.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) out(`  ${k}: ${v}`, 'warn');
    }
    if (R.deviations.length) {
      out('Стили созданы по тому, как текст выглядит в макете (чтобы ничего не сдвинулось). Отличия от страницы «Стили»:', 'warn');
      for (const d of R.deviations) out('  ' + d, 'warn');
    }
    if (!DRY && R.frameChecks.length) {
      const ok = R.frameChecks.filter((c) => c.res === 'ok');
      out(`Проверка: ${ok.length} из ${R.frameChecks.length} фреймов после изменений совпадают с исходными пиксель в пиксель.`, ok.length === R.frameChecks.length ? 'ok' : 'warn');
      for (const c of R.frameChecks) {
        if (c.res === 'ok') continue;
        if (c.res === 'reverted') out(`  ${c.name}: нашлись отличия — привязки в этом фрейме отменены, фрейм как был.`, 'warn');
        else if (c.res === 'reverted-diff') out(`  ${c.name}: отличия остались и после отмены (${c.changed} пикс.) — проверь фрейм.`, 'err');
        else out(`  ${c.name}: ${c.res}`, 'warn');
      }
    }
  }
  if (DO_LINKS) {
    head(DRY ? 'Переходы — что будет сделано' : 'Переходы');
    out(`${DRY ? 'Будет добавлено' : 'Добавлено'}: переходы между страницами ${R.links}, прокрутка по странице ${R.scrolls}.`, 'ok');
    if (R.linksKept) out(`На ${plural(R.linksKept, 'слое', 'слоях', 'слоях')} переходы уже были — не тронуты.`, 'dim');
    out(R.burgerCleared ? `Гамбургер: ${DRY ? 'будет снято' : 'снято'} переходов — ${R.burgerCleared}, он некликабельный.` : 'Гамбургер: без переходов, некликабельный.', 'ok');
    for (const w of R.burgerWarn) out('  ' + w, 'warn');
    if (R.flows.length) out(`Стартовые точки (Flows): ${R.flows.join(', ')}.`, 'ok');
    if (R.comp) out(`Состояния компонентов (наведение, нажатие, открыть/закрыть): ${R.comp}.`, 'ok');
    if (R.otherPage) out(`Не связано: ${R.otherPage} — экраны лежат на разных страницах Figma (переходы между страницами Figma не поддерживает).`, 'warn');
    for (const m of R.linksMissing.slice(0, 30)) out('  ' + m, 'warn');
  }
  if (R.errors.length) { head('Ошибки'); for (const e of R.errors.slice(0, 30)) out(e, 'err'); }
  if (S.dupes.length) out(`Повторы экранов (взят первый): ${S.dupes.join(', ')}`, 'warn');
}

(async () => {
  await Promise.race([uiReady, sleep(4000)]);
  try {
    if (figma.loadAllPagesAsync) await figma.loadAllPagesAsync();
    const S = scan();
    const found = BPS.map((bp) => `${bp}: ${Object.keys(S.screens[bp]).length}`).join(', ');
    head(DRY ? 'Проверка — в файле ничего не меняется' : 'Макет');
    out(`Экраны: ${found}${S.frames.some((f) => f.cover) ? ' + обложка' : ''}. Всего фреймов в файле: ${S.frames.length}.`);
    const missing = [];
    for (const bp of BPS) for (const [k, , ] of KEYS) if (!S.screens[bp][k]) missing.push(`${TITLE[k]}_${bp}`);
    if (missing.length === 12) { out('Экраны макета не найдены: фреймы должны называться «Главная_1440», «Блич_768», «Ван-Пис_375» и т. п. (можно с « 1» в конце).', 'err'); figma.ui.postMessage({ type: 'done', text: 'Экраны не найдены — файл не менялся.' }); return; }
    if (missing.length) out(`Не найдены экраны: ${missing.join(', ')} (имена фреймов должны начинаться с «Главная», «Блич», «Ван-Пис», «Ангельские_ритмы» и заканчиваться шириной).`, 'warn');
    if (DO_STYLES) await stylesStep(S);
    if (DO_LINKS) await linksStep(S);
    report(S);
    const sum = [];
    if (DO_STYLES) sum.push(`стилей ${R.paintCreated.length + R.textCreated.length + R.gridCreated.length}, привязок ${R.fills + R.strokes + R.textFills + R.texts}`);
    if (DO_LINKS) sum.push(`переходов ${R.links + R.scrolls}`);
    const text = (DRY ? 'Проверка закончена — файл не менялся. Будет: ' : 'Готово: ') + sum.join(', ') + (DRY ? '' : '. Отменить всё — Ctrl+Z.');
    figma.ui.postMessage({ type: 'done', text });
    figma.notify(text, { timeout: 6000 });
  } catch (e) {
    out(`Ошибка: ${(e && e.message) || e}`, 'err');
    figma.ui.postMessage({ type: 'done', text: 'Ошибка — подробности ниже.' });
  }
})();
