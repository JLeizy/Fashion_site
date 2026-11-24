// Имитация Figma для проверки плагина: макет «Мультивселенная» как после импорта SVG
// (текст по строкам, Medium→Regular, SemiBold→Bold, разрядка потеряна, интерлиньяж «авто»)
// + «ручная работа» пользователя: свой стиль цвета и текста, свой переход, переход на гамбургере, свой Flow.
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const CODE = fs.readFileSync('/home/user/Fashion_site/docs/maket-anime/5_Для_Figma/Плагин_Мультивселенная/code.js', 'utf8');
const FR = JSON.parse(fs.readFileSync(path.join(DIR, 'mock/frames.json'), 'utf8'));
const CMD = process.argv[2] || 'all';
const VARIANT = process.argv[3] || 'user'; // user — с ручной работой, clean — чистый импорт

const MIXED = Symbol('mixed');
let uid = 0;
const fontsLoaded = new Set();
const FONTS = {
  Unbounded: ['ExtraLight', 'Light', 'Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold', 'Black'],
  Inter: ['Thin', 'Extra Light', 'Light', 'Regular', 'Medium', 'Semi Bold', 'Bold', 'Extra Bold', 'Black'],
};
const hexRgb = (hex) => { const h = hex.replace('#', ''); return { r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255 }; };
const clone = (v) => JSON.parse(JSON.stringify(v));
const styles = new Map();
const errors = [];

function base(type, name, parent) {
  const n = { id: `${++uid}:${uid % 7}`, type, name, parent: null, children: [], visible: true, reactions: [], x: 0, y: 0, width: 0, height: 0 };
  n.findAll = (fn) => { const out = []; const w = (x) => { for (const c of x.children || []) { if (fn(c)) out.push(c); w(c); } }; w(n); return out; };
  n.findOne = (fn) => { let r = null; const w = (x) => { for (const c of x.children || []) { if (r) return; if (fn(c)) { r = c; return; } w(c); } }; w(n); return r; };
  n.setReactionsAsync = async (rs) => {
    for (const r of rs) {
      if (!r.trigger || !r.actions || !r.actions.length) throw new Error('плохая реакция');
      if (!['ON_CLICK', 'ON_HOVER', 'ON_PRESS', 'ON_DRAG', 'AFTER_TIMEOUT', 'MOUSE_ENTER', 'MOUSE_LEAVE'].includes(r.trigger.type)) throw new Error('плохой триггер ' + r.trigger.type);
      for (const a of r.actions) {
        if (a.type !== 'NODE') throw new Error('плохое действие');
        if (!a.destinationId || !ALL.has(a.destinationId)) throw new Error('нет слоя ' + a.destinationId);
        if (!['NAVIGATE', 'SCROLL_TO', 'CHANGE_TO', 'OVERLAY', 'SWAP'].includes(a.navigation)) throw new Error('плохая навигация');
        if (a.navigation === 'SCROLL_TO' && top(ALL.get(a.destinationId)) !== top(n)) throw new Error('прокрутка в другой кадр');
        if (a.navigation === 'NAVIGATE' && ALL.get(a.destinationId).parent.type !== 'PAGE') throw new Error('переход не на кадр');
        if (a.navigation === 'CHANGE_TO' && ALL.get(a.destinationId).parent !== n.parent) throw new Error('CHANGE_TO не на вариант');
        if (a.transition && !['DISSOLVE', 'SMART_ANIMATE', 'SCROLL_ANIMATE', 'MOVE_IN'].includes(a.transition.type)) throw new Error('плохая анимация');
        if (a.navigation === 'SCROLL_TO' && a.transition && a.transition.type !== 'SCROLL_ANIMATE') throw new Error('прокрутка: анимация');
      }
    }
    n.reactions = clone(rs);
  };
  n.exportAsync = async () => new TextEncoder().encode(render(n));
  ALL.set(n.id, n);
  if (parent) { n.parent = parent; parent.children.push(n); }
  return n;
}
const ALL = new Map();
const top = (n) => { while (n.parent && n.parent.type !== 'PAGE') n = n.parent; return n; };
const frameOf = (n) => top(n);

function paintsFrom(p) {
  if (!p) return [];
  if (p.image) return [{ type: 'IMAGE', imageHash: 'h' + uid, scaleMode: 'FILL', visible: true, opacity: 1, blendMode: 'NORMAL' }];
  if (p.grad) {
    const st = p.grad.stops.map(([pos, hex, a]) => ({ position: pos, color: Object.assign(hexRgb(hex), { a }) }));
    return [{ type: 'GRADIENT_LINEAR', gradientTransform: p.grad.h ? [[1, 0, 0], [0, 1, 0]] : [[0, 1, 0], [-1, 0, 1]], gradientStops: st, visible: true, opacity: 1, blendMode: 'NORMAL' }];
  }
  return [{ type: 'SOLID', color: hexRgb(p.hex), opacity: p.op, visible: true, blendMode: 'NORMAL', boundVariables: {} }];
}
function stylable(n) {
  let fills = [], strokes = [];
  n.fillStyleId = ''; n.strokeStyleId = '';
  Object.defineProperty(n, 'fills', { get: () => fills, set: (v) => { fills = clone(v); n.fillStyleId = ''; } });
  Object.defineProperty(n, 'strokes', { get: () => strokes, set: (v) => { strokes = clone(v); n.strokeStyleId = ''; } });
  n.setFillStyleIdAsync = async (id) => { if (id === '') { n.fillStyleId = ''; return; } const s = styles.get(id); if (!s || s.type !== 'PAINT') throw new Error('нет стиля'); fills = clone(s.paints); n.fillStyleId = id;
    // FAULT: имитация неожиданного отличия при привязке в одном фрейме
    if (process.env.FAULT && top(n).name === 'Ван-Пис_768 1' && fills[0].type === 'SOLID') fills[0].color.r = Math.min(1, fills[0].color.r + 0.2); };
  n.setStrokeStyleIdAsync = async (id) => { if (id === '') { n.strokeStyleId = ''; return; } const s = styles.get(id); if (!s) throw new Error('нет стиля'); strokes = clone(s.paints); n.strokeStyleId = id; };
}
const autoLh = (fam, size) => size * (fam === 'Unbounded' ? 1.24 : 1.21);
const lhPx = (lh, size) => (lh.unit === 'AUTO' ? null : lh.unit === 'PIXELS' ? lh.value : (lh.value * size) / 100);
const TP = ['fontName', 'fontSize', 'lineHeight', 'letterSpacing', 'textCase', 'textDecoration', 'paragraphSpacing', 'paragraphIndent', 'leadingTrim'];
function textNode(parent, name, chars, fam, style, size, fill) {
  const t = base('TEXT', name, parent);
  stylable(t);
  const P = { fontName: { family: fam, style }, fontSize: size, lineHeight: { unit: 'AUTO' }, letterSpacing: { unit: 'PERCENT', value: 0 }, textCase: 'ORIGINAL', textDecoration: 'NONE', paragraphSpacing: 0, paragraphIndent: 0, leadingTrim: 'NONE' };
  t.textStyleId = '';
  t.textAutoResize = 'WIDTH_AND_HEIGHT';
  t.rotation = 0;
  t.hasMissingFont = false;
  t.characters = chars;
  const need = () => { if (!fontsLoaded.has(P.fontName.family + '|' + P.fontName.style)) throw new Error('шрифт не загружен: ' + P.fontName.family + ' ' + P.fontName.style); };
  const relayout = () => {
    const lines = t.characters.split('\n').length;
    const lh = lhPx(P.lineHeight, P.fontSize) || autoLh(P.fontName.family, P.fontSize);
    const ls = P.letterSpacing.unit === 'PIXELS' ? P.letterSpacing.value : (P.letterSpacing.value * P.fontSize) / 100;
    const wk = /Bold|Black/.test(P.fontName.style) ? 0.6 : 0.55;
    t.width = Math.max(...t.characters.split('\n').map((l) => l.length)) * (P.fontSize * wk + ls);
    t.height = lh * lines;
    t._lh = lh;
  };
  for (const k of TP) {
    Object.defineProperty(t, k, {
      get: () => P[k],
      set: (v) => {
        need();
        if (k === 'fontName' && !fontsLoaded.has(v.family + '|' + v.style)) throw new Error('новый шрифт не загружен');
        if (JSON.stringify(P[k]) !== JSON.stringify(v) && t.textStyleId) t.textStyleId = ''; // Figma отвязывает стиль
        P[k] = clone(v);
        relayout();
      },
    });
  }
  t.setTextStyleIdAsync = async (id) => {
    if (id === '') { t.textStyleId = ''; return; }
    const s = styles.get(id);
    if (!s || s.type !== 'TEXT') throw new Error('нет текстового стиля');
    need();
    if (!fontsLoaded.has(s.fontName.family + '|' + s.fontName.style)) throw new Error('шрифт стиля не загружен');
    for (const k of TP) if (k in s) P[k] = clone(s[k]);
    relayout();
    t.textStyleId = id;
  };
  Object.defineProperty(t, 'absoluteRenderBounds', {
    get: () => {
      if (!t.visible) return null;
      const F = frameOf(t);
      const lh = t._lh;
      const upper = P.textCase === 'UPPER';
      return { x: F.x + t.x, y: F.y + t.y + (lh - 1.2 * P.fontSize) / 2 + 0.1 * P.fontSize, width: t.width * (upper ? 1 : 1), height: (t.height - lh) + 0.8 * P.fontSize };
    },
  });
  fontsLoaded.add(fam + '|' + style);
  relayout();
  t.fills = paintsFrom(fill);
  return t;
}
// «отрисовка» кадра: всё, что видно глазом (без рамок слоёв и привязок к стилям)
function render(F) {
  const rows = [];
  const pk = (ps) => ps.map((p) => p.type === 'SOLID' ? `S${Math.round(p.color.r * 255)},${Math.round(p.color.g * 255)},${Math.round(p.color.b * 255)},${Math.round((p.opacity ?? 1) * 1000)}` : p.type + JSON.stringify(p.gradientStops || p.imageHash) + JSON.stringify(p.gradientTransform || '')).join('+');
  const w = (n) => {
    if (n.visible === false) return;
    if (n.type === 'TEXT') {
      const rb = n.absoluteRenderBounds;
      const chars = n.textCase === 'UPPER' ? n.characters.toUpperCase() : n.characters;
      const ls = n.letterSpacing.unit === 'PIXELS' ? n.letterSpacing.value : (n.letterSpacing.value * n.fontSize) / 100;
      rows.push(`T|${chars}|${n.fontName.family}|${n.fontName.style}|${n.fontSize}|${ls.toFixed(3)}|${rb.x.toFixed(2)},${rb.y.toFixed(2)},${rb.width.toFixed(2)},${rb.height.toFixed(2)}|${pk(n.fills)}`);
    } else if ('fills' in n) rows.push(`${n.type}|${n.x},${n.y},${n.width},${n.height}|${pk(n.fills)}|${pk(n.strokes)}`);
    for (const c of n.children || []) w(c);
  };
  w(F);
  return rows.join('\n');
}

// ---------- документ ----------
const doc = { type: 'DOCUMENT', children: [] };
function page(name) { const p = base('PAGE', name, null); p.parent = doc; doc.children.push(p); p.flowStartingPoints = []; return p; }
const pMaket = page('Макет');
const pStyles = page('Стили');
const pComp = page('Компоненты');
function frame(pageNode, name, data, x) {
  const F = base('FRAME', name, pageNode);
  stylable(F);
  F.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 1, visible: true, blendMode: 'NORMAL' }];
  F.x = x; F.y = 0; F.width = data.w; F.height = data.h;
  F.layoutMode = 'NONE'; F.layoutGrids = []; F.gridStyleId = '';
  F.setGridStyleIdAsync = async (id) => { const s = styles.get(id); if (!s) throw new Error('нет сетки'); F.layoutGrids = clone(s.layoutGrids); F.gridStyleId = id; };
  const build = (e, parent) => {
    if (e.k === 'g') { const g = base('GROUP', e.id, parent); for (const c of e.kids) build(c, g); return g; }
    if (e.k === 'shape') { const s = base(e.id.startsWith('Фон') || e.id.includes('Картинка') ? 'RECTANGLE' : 'VECTOR', e.id, parent); stylable(s); Object.assign(s, { x: e.x, y: e.y, width: e.w, height: e.h }); s.fills = paintsFrom(e.fill); s.strokes = paintsFrom(e.stroke); return s; }
    if (e.k === 'text') {
      const style = e.w >= 600 ? 'Bold' : 'Regular';
      for (const ln of e.lines) {
        const t = textNode(parent, e.lines.length > 1 ? ln.t.trim() : e.id, ln.t, e.fam, style, e.size, e.fill);
        t.x = ln.x; t.y = ln.y - e.size; // верх строки
      }
    }
  };
  for (const c of data.tree.kids) build(c, F);
  return F;
}
let X = 0;
const order = ['Обложка', 'Ангельские_ритмы_375', 'Ван-Пис_375', 'Блич_375', 'Главная_375', 'Ангельские_ритмы_768', 'Ван-Пис_768', 'Блич_768', 'Главная_768', 'Ангельские_ритмы_1440', 'Блич_1440', 'Ван-Пис_1440', 'Главная_1440'];
for (const n of order) { frame(pMaket, n + ' 1', FR[n], X); X += FR[n].w + 100; }
frame(pStyles, 'Стили', FR['Стили'], 0);
frame(pComp, 'Компоненты', FR['Компоненты'], 0);
// наборы вариантов на странице «Компоненты»
function set(name, prop, values) {
  const S = base('COMPONENT_SET', name, pComp);
  S.variantGroupProperties = { [prop]: { values } };
  for (const v of values) { const c = base('COMPONENT', `${prop}=${v}`, S); c.variantProperties = { [prop]: v }; }
  return S;
}
set('Кнопка', 'Состояние', ['Обычная', 'Наведение', 'Нажатие']);
set('Спойлер', 'Состояние', ['Закрыт', 'Открыт']);
set('Бургер', 'Состояние', ['Закрыт', 'Открыт']);

const byName = (root, name) => root.findOne((n) => n.name === name);
const F = (name) => pMaket.children.find((f) => f.name === name + ' 1');

// ---------- ручная работа пользователя ----------
let sid = 0;
function mkStyle(type) {
  const s = { id: `S:${++sid},`, type, name: '', description: '' };
  if (type === 'TEXT') {
    for (const k of TP) Object.defineProperty(s, '_' + k, { value: null, writable: true });
    for (const k of TP) Object.defineProperty(s, k, { get: () => s['_' + k], set: (v) => { if (k === 'fontName' && !fontsLoaded.has(v.family + '|' + v.style)) throw new Error('стиль: шрифт не загружен'); s['_' + k] = clone(v); }, enumerable: true });
    s.fontName = { family: 'Inter', style: 'Regular' }; s.fontSize = 12; s.lineHeight = { unit: 'AUTO' }; s.letterSpacing = { unit: 'PERCENT', value: 0 }; s.textCase = 'ORIGINAL'; s.textDecoration = 'NONE'; s.paragraphSpacing = 0; s.paragraphIndent = 0; s.leadingTrim = 'NONE';
  }
  if (type === 'PAINT') s.paints = [];
  if (type === 'GRID') s.layoutGrids = [];
  styles.set(s.id, s);
  return s;
}
if (VARIANT === 'user') {
  const s = mkStyle('PAINT'); s.name = 'Фон/Основной'; s.paints = [{ type: 'SOLID', color: hexRgb('#0F0F14'), opacity: 1 }];
  const bg = F('Главная_1440').findOne((n) => n.fills && n.fills.length && n.fills[0].type === 'SOLID' && Math.round(n.fills[0].color.r * 255) === 15 && n.type !== 'TEXT');
  bg.setFillStyleIdAsync(s.id);
  const black = mkStyle('PAINT'); black.name = 'Мой чёрный'; black.paints = [{ type: 'SOLID', color: hexRgb('#1B1B24'), opacity: 1 }];
  const ts = mkStyle('TEXT'); ts.name = 'Десктоп/Заголовок_h1'; ts.fontName = { family: 'Unbounded', style: 'Bold' }; ts.fontSize = 64; ts.lineHeight = { unit: 'PERCENT', value: 115 };
  // пользователь сам привязал заголовок главной
  const h1 = F('Главная_1440').findOne((n) => n.type === 'TEXT' && n.fontSize === 64);
  h1.setTextStyleIdAsync(ts.id);
  // свой переход в меню
  const link = byName(F('Главная_1440'), 'Ссылка_Блич');
  link.reactions = [{ trigger: { type: 'ON_CLICK' }, actions: [{ type: 'NODE', destinationId: F('Блич_1440').id, navigation: 'NAVIGATE', transition: null }] }];
  // переход на гамбургере, который надо снять
  const burger = byName(F('Главная_375'), 'Бургер');
  burger.reactions = [{ trigger: { type: 'ON_CLICK' }, actions: [{ type: 'NODE', destinationId: F('Блич_375').id, navigation: 'NAVIGATE', transition: null }] }];
  pMaket.flowStartingPoints = [{ nodeId: F('Главная_1440').id, name: 'Мой сценарий' }];
  // блок «Текстовый_блок» первого экрана Блич_1440 пользователь сделал Auto layout
  const tb = byName(F('Блич_1440'), 'Текстовый_блок');
  tb.type = 'FRAME'; tb.layoutMode = 'VERTICAL';
}

// ---------- figma ----------
const log = [];
let done = null;
const ui = { onmessage: null, postMessage: (m) => {
  if (m.type === 'log') log.push((m.cls === 'h' ? '\n## ' : m.cls === 'warn' ? '! ' : m.cls === 'err' ? '✗ ' : '') + m.text);
  if (m.type === 'done') done = m.text;
  if (m.type === 'compare') setTimeout(() => {
    const a = Buffer.from(m.a), b = Buffer.from(m.b);
    ui.onmessage({ type: 'compared', id: m.id, same: a.equals(b), changed: a.equals(b) ? 0 : 1, max: 0 });
  }, 1);
} };
const figma = {
  command: CMD,
  mixed: MIXED,
  root: doc,
  ui,
  showUI: () => { setTimeout(() => ui.onmessage && ui.onmessage({ type: 'ready' }), 5); },
  loadAllPagesAsync: async () => {},
  listAvailableFontsAsync: async () => Object.entries(FONTS).flatMap(([family, st]) => st.map((style) => ({ fontName: { family, style } }))),
  loadFontAsync: async (f) => { if (!FONTS[f.family] || !FONTS[f.family].includes(f.style)) throw new Error('нет шрифта'); fontsLoaded.add(f.family + '|' + f.style); },
  getLocalPaintStylesAsync: async () => [...styles.values()].filter((s) => s.type === 'PAINT'),
  getLocalTextStylesAsync: async () => [...styles.values()].filter((s) => s.type === 'TEXT'),
  getLocalGridStylesAsync: async () => [...styles.values()].filter((s) => s.type === 'GRID'),
  createPaintStyle: () => mkStyle('PAINT'), createTextStyle: () => mkStyle('TEXT'), createGridStyle: () => mkStyle('GRID'),
  notify: () => {}, closePlugin: () => {},
};
for (const p of doc.children) p.parent = doc;

const snapshot = () => doc.children.map((p) => p.children.map((f) => render(f)).join('\n') + JSON.stringify(p.flowStartingPoints)).join('\n') + [...ALL.values()].map((n) => JSON.stringify(n.reactions) + (n.fillStyleId || '') + (n.textStyleId || '')).join('') + styles.size;
const renders0 = new Map(pMaket.children.map((f) => [f.name, render(f)]));
const snap0 = snapshot();
(async () => {
  const t0 = Date.now();
  new Function('figma', '__html__', CODE)(figma, '');
  for (let i = 0; i < 2000 && done === null; i++) await new Promise((r) => setTimeout(r, 10));
  if (process.env.TWICE) { // второй запуск: ничего нового не создаётся и не дублируется
    const n0 = styles.size, r0 = [...ALL.values()].filter((n) => n.reactions.length).length;
    log.length = 0; done = null; figma.showUI = () => setTimeout(() => ui.onmessage({ type: 'ready' }), 5);
    new Function('figma', '__html__', CODE)(figma, '');
    for (let i = 0; i < 2000 && done === null; i++) await new Promise((r) => setTimeout(r, 10));
    console.log('ВТОРОЙ ЗАПУСК: стилей было', n0, 'стало', styles.size, '; слоёв с переходами было', r0, 'стало', [...ALL.values()].filter((n) => n.reactions.length).length);
  }
  console.log(log.join('\n'));
  console.log('\nИТОГ:', done, `(${Date.now() - t0} мс)`);
  if (CMD === 'check') { console.log('файл не изменился:', snapshot() === snap0); process.exit(0); }
  // макет не изменился?
  let same = 0;
  for (const f of pMaket.children) if (render(f) === renders0.get(f.name)) same++; else console.log('ИЗМЕНИЛСЯ', f.name);
  console.log('кадров без изменений:', same, 'из', pMaket.children.length);
  // переходы
  const nameOf = (id) => ALL.get(id).name;
  const show = (fr, layer) => { const n = byName(F(fr), layer); console.log(`${fr} / ${layer} →`, n ? n.reactions.map((r) => `${r.trigger.type} ${r.actions[0].navigation} ${nameOf(r.actions[0].destinationId)}`).join('; ') || '—' : 'нет слоя'); };
  show('Главная_1440', 'Логотип'); show('Главная_1440', 'Ссылка_Блич'); show('Главная_1440', 'Ссылка_Ван-Пис'); show('Главная_1440', 'Ссылка_Главная');
  show('Главная_1440', 'Кнопка_Выбрать_мир'); show('Главная_1440', 'Кнопка_О_проекте'); show('Главная_1440', 'Карточка_Ангельские_ритмы');
  show('Блич_1440', 'Баннер'); show('Ван-Пис_768', 'Баннер'); show('Ангельские_ритмы_375', 'Баннер'); show('Блич_375', 'Бургер'); show('Главная_375', 'Бургер');
  show('Блич_768', 'Логотип'); show('Блич_768', 'Логотип_2'); show('Блич_768', 'Блич_3'); show('Блич_768', 'Ангельские_ритмы_3');
  console.log('Flows:', JSON.stringify(pMaket.flowStartingPoints.map((f) => f.name + '→' + nameOf(f.nodeId))));
  const comp = pComp.findAll((n) => n.type === 'COMPONENT' && n.reactions.length).map((n) => `${n.parent.name}:${n.name} ${n.reactions.map((r) => r.trigger.type + '→' + nameOf(r.actions[0].destinationId)).join(',')}`);
  console.log('компоненты:', comp.join(' | '));
  const texts = [...ALL.values()].filter((n) => n.type === 'TEXT');
  console.log('текстов:', texts.length, 'со стилем:', texts.filter((t) => t.textStyleId).length, 'с цветом-стилем:', texts.filter((t) => t.fillStyleId).length);
  const shapes = [...ALL.values()].filter((n) => n.type !== 'TEXT' && 'fills' in n && n.fills.length && n.fills[0].type !== 'IMAGE');
  console.log('фигур с цветом:', shapes.length, 'со стилем:', shapes.filter((s) => s.fillStyleId).length);
  console.log('стили:', [...styles.values()].map((s) => `${s.type[0]}:${s.name}`).join(', '));
  const ex = [...styles.values()].filter((s) => s.type === 'TEXT').slice(0, 30).map((s) => `${s.name} = ${s.fontName.family} ${s.fontName.style} ${s.fontSize} lh ${JSON.stringify(s.lineHeight)} ls ${JSON.stringify(s.letterSpacing)} ${s.textCase}`);
  console.log(ex.join('\n'));
  process.exit(0);
})();
