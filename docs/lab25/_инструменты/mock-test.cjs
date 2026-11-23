// Проверка плагина без Figma: имитация API (страница, фреймы из SVG, стили, шрифты Google) и прогон code.js
const fs = require('fs');
const path = require('path');
const DOCS = '/home/user/Fashion_site/docs/lab25';
const PROTO = path.join(DOCS, '3_Прототип');
const code = fs.readFileSync(path.join(DOCS, '6_Для_Figma/Плагин_Amfibia/code.js'), 'utf8');

let uid = 0;
function node(type, name, parent) {
  const n = { id: `${++uid}:1`, type, name, parent, children: [], reactions: [] };
  n.findAll = (fn) => { const out = []; const w = (x) => { for (const c of x.children) { if (fn(c)) out.push(c); w(c); } }; w(n); return out; };
  n.findOne = (fn) => { let r = null; const w = (x) => { for (const c of x.children) { if (r) return; if (fn(c)) { r = c; return; } w(c); } }; w(n); return r; };
  n.setReactionsAsync = async (r) => {
    if (!['FRAME', 'GROUP', 'TEXT', 'RECTANGLE', 'VECTOR'].includes(n.type)) throw new Error('нет reactions у ' + n.type);
    for (const x of r) { if (!x.trigger || !x.actions?.length) throw new Error('плохая реакция'); for (const a of x.actions) if (a.type === 'NODE' && !a.destinationId) throw new Error('нет destinationId'); }
    n.reactions = r;
  };
  if (parent) parent.children.push(n);
  return n;
}
const page = node('PAGE', 'Прототип', null);
page.flowStartingPoints = [];
// фреймы из SVG: <g> → GROUP, <text> → TEXT, <rect>/<path> → RECTANGLE
for (const folder of fs.readdirSync(PROTO).sort()) {
  for (const f of fs.readdirSync(path.join(PROTO, folder)).filter((x) => x.endsWith('.svg'))) {
    const fr = node('FRAME', f.replace('.svg', ''), page);
    const svg = fs.readFileSync(path.join(PROTO, folder, f), 'utf8').replace(/<defs>[\s\S]*<\/defs>/, '');
    const stack = [fr];
    for (const m of svg.matchAll(/<(\/?)(g|text|rect|path)\b([^>]*?)(\/?)>/g)) {
      const [, close, tag, attrs, self] = m;
      if (close) { if (tag === 'g' || tag === 'text') stack.pop(); continue; }
      const id = (attrs.match(/id="([^"]*)"/) || [])[1] || tag;
      const n = node(tag === 'g' ? 'GROUP' : tag === 'text' ? 'TEXT' : 'RECTANGLE', id, stack[stack.length - 1]);
      if ((tag === 'g' || tag === 'text') && !self) stack.push(n);
    }
  }
}
const styles = { paint: [], text: [], effect: [], grid: [] };
const mkStyle = (kind) => () => { const s = { name: '', description: '' }; styles[kind].push(s); return s; };
const GOOGLE = { 'Inter': ['Light', 'Regular', 'Medium', 'Semi Bold', 'Bold', 'Extra Bold', 'Black', 'Italic', 'Black Italic'], 'JetBrains Mono': ['Regular', 'Medium', 'Bold'], 'Cormorant Garamond': ['Light', 'Regular', 'Medium', 'SemiBold', 'Bold', 'Italic', 'Medium Italic', 'SemiBold Italic'],
  'UnifrakturMaguntia': ['Book'], 'Forum': ['Regular'], 'Playfair Display': ['Regular', 'Italic', 'Bold'], 'Unbounded': ['Regular', 'Bold', 'Black'], 'Caveat': ['Regular', 'Bold'], 'Rubik Glitch': ['Regular'] };
let closed = null;
const figma = {
  command: process.argv[2] || 'all',
  root: { children: [page] },
  loadAllPagesAsync: async () => {},
  getLocalPaintStylesAsync: async () => styles.paint, getLocalTextStylesAsync: async () => styles.text, getLocalEffectStylesAsync: async () => styles.effect, getLocalGridStylesAsync: async () => styles.grid,
  createPaintStyle: mkStyle('paint'), createTextStyle: mkStyle('text'), createEffectStyle: mkStyle('effect'), createGridStyle: mkStyle('grid'),
  listAvailableFontsAsync: async () => Object.entries(GOOGLE).flatMap(([family, st]) => st.map((style) => ({ fontName: { family, style } }))),
  loadFontAsync: async (f) => { if (!GOOGLE[f.family]?.includes(f.style)) throw new Error('нет шрифта ' + f.family + ' ' + f.style); },
  closePlugin: (msg) => { closed = msg; },
};
(async () => {
  const t = Date.now();
  new Function('figma', code)(figma);
  for (let i = 0; i < 600 && closed === null; i++) await new Promise((r) => setTimeout(r, 50));
  console.log('Сообщение плагина:', closed, `(${Date.now() - t} мс)`);
  const withR = page.findAll((n) => n.reactions.length);
  const byType = {};
  for (const n of withR) byType[n.type] = (byType[n.type] || 0) + 1;
  console.log('слоёв с переходами:', withR.length, byType, 'flows:', page.flowStartingPoints.length);
  console.log('стили:', Object.fromEntries(Object.entries(styles).map(([k, v]) => [k, v.length])));
  console.log('пример стиля текста:', JSON.stringify(styles.text[3]).slice(0, 200));
  const home = page.children.find((f) => f.name === '01_Главная_1920');
  console.log('переходы главной:', home.findAll((n) => n.reactions.length).length);
})();
