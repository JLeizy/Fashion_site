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
    for (const x of r) { if (!x.trigger || !x.actions?.length) throw new Error('плохая реакция'); if (x.trigger.deprecatedVersion !== undefined) throw new Error('лишнее поле'); for (const a of x.actions) if (a.type === 'NODE' && !a.destinationId) throw new Error('нет destinationId'); }
    n.reactions = r;
  };
  n.remove = () => { const i = n.parent.children.indexOf(n); if (i >= 0) n.parent.children.splice(i, 1); n.removed = true; };
  n.x = 0; n.y = 0; n.width = 100; n.height = 20;
  if (type === 'TEXT') {
    n.fontName = { family: 'Inter', style: 'Regular' }; n.letterSpacing = { unit: 'PERCENT', value: 0 }; n.lineHeight = { unit: 'AUTO' };
    n.setTextStyleIdAsync = async (id) => { if (!id) throw new Error('нет id стиля'); n.textStyleId = id; };
    n.setFillStyleIdAsync = async (id) => { if (!id) throw new Error('нет id цвета'); n.fillStyleId = id; };
    let ch = '';
    Object.defineProperty(n, 'characters', { get: () => ch, set: (v) => { if (!fontsLoaded.has(n.fontName.family + '|' + n.fontName.style)) throw new Error('шрифт не загружен'); ch = v; } });
  }
  if (parent) parent.children.push(n);
  return n;
}
const fontsLoaded = new Set();
const page = node('PAGE', 'Прототип', null);
page.flowStartingPoints = [];
// фреймы из SVG: <g> → GROUP, <text> → TEXT, <rect>/<path> → RECTANGLE
const LIST = [...fs.readdirSync(PROTO).sort().flatMap((folder) => fs.readdirSync(path.join(PROTO, folder)).filter((x) => x.endsWith('.svg')).map((f) => path.join(PROTO, folder, f))), ...['1_Стили/Стили.svg', '2_Компоненты/Компоненты.svg', '4_Обложка/Обложка.svg', '5_Карта_переходов/Карта_переходов.svg'].map((x) => path.join(DOCS, x))];
for (const file of LIST) {
  {
    const fr = node('FRAME', path.basename(file).replace('.svg', ''), page);
    const svg = fs.readFileSync(file, 'utf8').replace(/<defs>[\s\S]*<\/defs>/, '');
    const stack = [fr];
    const dec = (t) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    for (const m of svg.matchAll(/<(\/?)(g|rect|path)\b([^>]*?)(\/?)>|<text ([^>]*)>((?:<tspan[^>]*>[^<]*<\/tspan>)*)<\/text>/g)) {
      if (m[5] !== undefined) {
        const id = (m[5].match(/id="([^"]*)"/) || [])[1] || 'text';
        const lines = [...m[6].matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)].map((x) => dec(x[1]));
        lines.forEach((ln, i) => { const t = node('TEXT', lines.length > 1 ? ln.trim() : id, stack[stack.length - 1]); fontsLoaded.add('Inter|Regular'); t.characters = ln; t.y = i * 20; });
        continue;
      }
      const [, close, tag, attrs, self] = m;
      if (close) { if (tag === 'g') stack.pop(); continue; }
      const id = (attrs.match(/id="([^"]*)"/) || [])[1] || tag;
      const n = node(tag === 'g' ? 'GROUP' : 'RECTANGLE', id, stack[stack.length - 1]);
      if (tag === 'g' && !self) stack.push(n);
    }
  }
}
const styles = { paint: [], text: [], effect: [], grid: [] };
let sid = 0;
const mkStyle = (kind) => () => { const s = { id: 'S:' + (++sid), name: '', description: '' }; styles[kind].push(s); return s; };
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
  loadFontAsync: async (f) => { if (!GOOGLE[f.family]?.includes(f.style)) throw new Error('нет шрифта ' + f.family + ' ' + f.style); fontsLoaded.add(f.family + '|' + f.style); },
  notify: () => {},
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
  const texts = page.findAll((n) => n.type === 'TEXT' && !n.removed);
  console.log('слоёв текста после шага «Тексты»:', texts.length, 'со стилем:', texts.filter((t) => t.textStyleId).length, 'с цветом-стилем:', texts.filter((t) => t.fillStyleId).length, 'многострочных:', texts.filter((t) => t.characters.includes('\n')).length);
  const pre = page.children.find((f) => f.name === '01_Заставка_1920');
  console.log('заставка:', JSON.stringify(pre.reactions.map((r) => r.trigger)));
  const cat = page.children.find((f) => f.name === '02_Каталог_1920').findOne((n) => n.name === 'Карточка_товара_1');
  console.log('карточка в каталоге:', JSON.stringify(cat.reactions.map((r) => r.trigger.type)));
})();
