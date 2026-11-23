// Amfibia — стили и переходы прототипа (плагин Figma, ЛР №25)
// Запуск: Plugins → Development → Amfibia — стили и переходы → нужная команда.
// Данные (токены и переходы) вшиты ниже — плагину не нужен интернет.
const DATA = /*DATA*/ {};

const hexToRgb = (hex) => {
  const h = hex.replace('#', '');
  return { r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255 };
};
const report = { colors: 0, texts: 0, effects: 0, grids: 0, links: 0, back: 0, missingFrames: new Set(), missingLayers: 0, otherPage: 0, failed: 0, fontsMissing: new Set() };

async function upsert(kind, name) {
  const getters = { paint: 'getLocalPaintStylesAsync', text: 'getLocalTextStylesAsync', effect: 'getLocalEffectStylesAsync', grid: 'getLocalGridStylesAsync' };
  const creators = { paint: 'createPaintStyle', text: 'createTextStyle', effect: 'createEffectStyle', grid: 'createGridStyle' };
  const list = await figma[getters[kind]]();
  const found = list.find((s) => s.name === name);
  if (found) return found;
  const s = figma[creators[kind]]();
  s.name = name;
  return s;
}

// ---------- 1. Стили ----------
async function createStyles() {
  // Цвета интерфейса — три темы
  for (const [theme, cols] of Object.entries(DATA.tokens.colors)) {
    for (const [name, c] of Object.entries(cols)) {
      const s = await upsert('paint', `Тема ${theme}/${name.replace(/_/g, ' ')}`);
      s.paints = [{ type: 'SOLID', color: hexToRgb(c.value), opacity: c.opacity ?? 1 }];
      s.description = `CSS: ${c.css}`;
      report.colors++;
    }
  }
  // Цвета товаров
  for (const [name, c] of Object.entries(DATA.tokens.productColors)) {
    const s = await upsert('paint', `Цвета товаров/${name.replace(/_/g, ' ')}`);
    if (c.value) s.paints = [{ type: 'SOLID', color: hexToRgb(c.value) }];
    else {
      const stops = c.stops.map((h, i) => ({ position: i / Math.max(1, c.stops.length - 1), color: { ...hexToRgb(h), a: 1 } }));
      s.paints = [{ type: /conic/.test(c.gradient) ? 'GRADIENT_ANGULAR' : 'GRADIENT_LINEAR', gradientTransform: [[1, 0, 0], [0, 1, 0]], gradientStops: stops }];
    }
    s.description = `CSS: ${c.css}`;
    report.colors++;
  }
  // Акценты брендов
  for (const b of DATA.tokens.brands) {
    for (const [k, label] of [['accent', 'Акцент'], ['accentText', 'Акцент текст'], ['accentTextLight', 'Акцент текст (светлая тема)']]) {
      if (!b[k]) continue;
      const s = await upsert('paint', `Бренды/${b.name}/${label}`);
      s.paints = [{ type: 'SOLID', color: hexToRgb(b[k]) }];
      report.colors++;
    }
  }
  // Текстовые стили
  const fonts = await figma.listAvailableFontsAsync();
  const byFamily = {};
  for (const f of fonts) (byFamily[f.fontName.family] = byFamily[f.fontName.family] || []).push(f.fontName.style);
  const W = [[/thin|hairline/i, 100], [/extra ?light|ultra ?light/i, 200], [/light/i, 300], [/semi ?bold|demi ?bold/i, 600], [/extra ?bold|ultra ?bold/i, 800], [/black|heavy/i, 900], [/bold/i, 700], [/medium/i, 500]];
  const weightOf = (style) => { for (const [re, w] of W) if (re.test(style)) return w; return 400; };
  const pickStyle = (family, weight, italic) => {
    const styles = byFamily[family];
    if (!styles) return null;
    let best = null, bestScore = 1e9;
    for (const st of styles) {
      const it = /italic|oblique/i.test(st);
      const score = Math.abs(weightOf(st) - weight) + (it === italic ? 0 : 1000);
      if (score < bestScore) { bestScore = score; best = st; }
    }
    return best;
  };
  const textStyles = [...DATA.tokens.textStyles, ...DATA.tokens.brands.map((b) => ({ name: `Бренды/${b.name} — заголовок`, family: b.font, size: 96, weight: b.weight, italic: b.italic, letterSpacingPx: Math.round(b.trackingEm * 96 * 100) / 100, usage: 0, where: ['Страница бренда'] }))];
  for (const t of textStyles) {
    const style = pickStyle(t.family, t.weight, t.italic);
    if (!style) { report.fontsMissing.add(t.family); continue; }
    try {
      const fontName = { family: t.family, style };
      await figma.loadFontAsync(fontName);
      const s = await upsert('text', t.name);
      s.fontName = fontName;
      s.fontSize = t.size;
      s.letterSpacing = { unit: 'PIXELS', value: t.letterSpacingPx || 0 };
      s.lineHeight = { unit: 'AUTO' };
      s.description = t.usage ? `Встречается ${t.usage} раз: ${t.where.join(', ')}` : 'Голос заголовков бренда';
      report.texts++;
    } catch (e) { report.fontsMissing.add(t.family); }
  }
  // Тени
  for (const [name, e] of Object.entries(DATA.tokens.effects)) {
    const s = await upsert('effect', name.replace(/_/g, ' ').replace(/^(\S+)\//, 'Тени/$1/'));
    s.effects = [{ type: 'DROP_SHADOW', color: { ...hexToRgb(e.color), a: e.opacity }, offset: { x: e.x, y: e.y }, radius: e.blur, spread: 0, visible: true, blendMode: 'NORMAL', showShadowBehindNode: false }];
    report.effects++;
  }
  // Сетка
  const L = DATA.tokens.layout;
  const g = await upsert('grid', 'Сетка/Десктоп 1920 — 12 колонок');
  g.layoutGrids = [{ pattern: 'COLUMNS', alignment: 'STRETCH', gutterSize: L.gutter, count: L.columns, offset: L.margin, visible: true, color: { r: 0.85, g: 0.44, b: 0.5, a: 0.12 } }];
  report.grids++;
}

// ---------- 2. Переходы ----------
const EASE = DATA.easing; // кривая сайта --ease-out
function transition(kind) {
  const easing = { type: 'CUSTOM_CUBIC_BEZIER', easingFunctionCubicBezier: { x1: EASE[0], y1: EASE[1], x2: EASE[2], y2: EASE[3] } };
  if (kind === 'instant') return null;
  if (kind === 'slide') return { type: 'MOVE_IN', direction: 'LEFT', matchLayers: false, easing, duration: 0.64 };
  if (kind === 'smart') return { type: 'SMART_ANIMATE', easing, duration: 0.64 };
  return { type: 'DISSOLVE', easing, duration: kind === 'fast' ? 0.16 : 0.32 };
}

async function setReactions(node, reactions) {
  if (typeof node.setReactionsAsync === 'function') await node.setReactionsAsync(reactions);
  else node.reactions = reactions;
}

async function createLinks() {
  if (figma.loadAllPagesAsync) await figma.loadAllPagesAsync();
  const frames = new Map();
  for (const page of figma.root.children) {
    const tops = page.findAll((n) => n.type === 'FRAME' && (n.parent.type === 'PAGE' || n.parent.type === 'SECTION'));
    for (const f of tops) {
      const rec = { node: f, page };
      frames.set(f.name.replace(/\.svg$/i, '').trim(), rec);
      // запасной вариант: имя экрана хранится и в группе внутри фрейма
      const g = f.children && f.children.find((c) => c.type === 'GROUP' && /_1920$/.test(c.name));
      if (g && !frames.has(g.name)) frames.set(g.name, rec);
    }
  }
  const added = new Map(); // node.id → reactions
  const push = (node, reaction) => { if (!added.has(node.id)) added.set(node.id, { node, list: [] }); added.get(node.id).list.push(reaction); };
  for (const L of DATA.links) {
    const src = frames.get(L.from);
    if (!src) { report.missingFrames.add(L.from); continue; }
    let action;
    if (L.action === 'BACK') action = { type: 'BACK' };
    else {
      const dst = frames.get(L.to);
      if (!dst) { report.missingFrames.add(L.to); continue; }
      if (dst.page !== src.page) { report.otherPage++; continue; }
      action = { type: 'NODE', destinationId: dst.node.id, navigation: 'NAVIGATE', transition: transition(L.anim) };
    }
    const re = L.regex ? new RegExp(L.regex, 'i') : null;
    const targets = re ? src.node.findAll((n) => re.test(n.name)).slice(0, L.limit || 60) : [src.node.findOne((n) => n.name === L.trigger)].filter(Boolean);
    if (!targets.length) { report.missingLayers++; continue; }
    for (const t of targets) push(t, { trigger: { type: 'ON_CLICK' }, actions: [action] });
    if (L.action === 'BACK') report.back += targets.length; else report.links += targets.length;
  }
  for (const { node, list } of added.values()) {
    try { await setReactions(node, list.slice(0, 1)); } catch (e) { report.failed++; }
  }
  // Начальные точки сценариев
  for (const page of figma.root.children) {
    const flows = [];
    for (const [name, title] of DATA.flows) { const f = frames.get(name); if (f && f.page === page) flows.push({ nodeId: f.node.id, name: title }); }
    if (flows.length) page.flowStartingPoints = flows;
  }
}

(async () => {
  const cmd = figma.command || 'all';
  try {
    if (cmd === 'styles' || cmd === 'all') await createStyles();
    if (cmd === 'links' || cmd === 'all') await createLinks();
    const parts = [];
    if (cmd !== 'links') parts.push(`стилей: цвета ${report.colors}, текст ${report.texts}, тени ${report.effects}, сетка ${report.grids}`);
    if (cmd !== 'styles') parts.push(`переходов ${report.links}, «назад» ${report.back}`);
    if (report.missingFrames.size) parts.push(`нет фреймов: ${report.missingFrames.size}`);
    if (report.otherPage) parts.push(`на другой странице: ${report.otherPage}`);
    if (report.fontsMissing.size) parts.push(`нет шрифтов: ${[...report.fontsMissing].join(', ')}`);
    console.log('Amfibia:', JSON.stringify({ ...report, missingFrames: [...report.missingFrames], fontsMissing: [...report.fontsMissing] }, null, 1));
    figma.closePlugin('Amfibia: ' + parts.join(' · '));
  } catch (e) {
    console.error(e);
    figma.closePlugin('Ошибка: ' + (e && e.message ? e.message : e));
  }
})();
