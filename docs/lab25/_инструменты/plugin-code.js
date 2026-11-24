// Amfibia — стили, тексты и переходы прототипа (плагин Figma, ЛР №25)
// Запуск: Plugins → Development → «Amfibia — стили, тексты, переходы» → «Всё сразу».
// Данные (токены, тексты, переходы) вшиты ниже — плагину не нужен интернет.
// Проверено в Figma: переходы на группах, текстах и векторах, «наведение», «через N с», «назад», стили, Flows.
const DATA = /*DATA*/ {};

const hexToRgb = (hex) => {
  const h = hex.replace('#', '');
  return { r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255 };
};
const report = { colors: 0, texts: 0, effects: 0, grids: 0, links: 0, back: 0, hover: 0, timers: 0, merged: 0, fixed: 0, styled: 0, textMiss: 0, missingFrames: new Set(), missingLayers: 0, otherPage: 0, failed: 0, fontsMissing: new Set() };
const say = (msg) => { try { figma.notify(msg, { timeout: 1500 }); } catch (e) {} };

// ---------- кадры прототипа ----------
let FRAMES = null;
async function frameIndex() {
  if (FRAMES) return FRAMES;
  if (figma.loadAllPagesAsync) await figma.loadAllPagesAsync();
  FRAMES = new Map();
  for (const page of figma.root.children) {
    const tops = page.findAll((n) => n.type === 'FRAME' && (n.parent.type === 'PAGE' || n.parent.type === 'SECTION'));
    for (const f of tops) {
      const rec = { node: f, page };
      FRAMES.set(f.name.replace(/\.svg$/i, '').trim(), rec);
      // запасной вариант: имя экрана хранится и в группе внутри фрейма
      const g = f.children && f.children.find((c) => c.type === 'GROUP');
      if (g && !FRAMES.has(g.name)) FRAMES.set(g.name, rec);
    }
  }
  return FRAMES;
}

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

// ---------- шрифты ----------
let AVAIL = null;
const W = [[/thin|hairline/i, 100], [/extra ?light|ultra ?light/i, 200], [/light/i, 300], [/semi ?bold|demi ?bold/i, 600], [/extra ?bold|ultra ?bold/i, 800], [/black|heavy/i, 900], [/bold/i, 700], [/medium/i, 500]];
const weightOf = (style) => { for (const [re, w] of W) if (re.test(style)) return w; return 400; };
async function pickStyle(family, weight, italic) {
  if (!AVAIL) {
    AVAIL = {};
    for (const f of await figma.listAvailableFontsAsync()) (AVAIL[f.fontName.family] = AVAIL[f.fontName.family] || []).push(f.fontName.style);
  }
  const styles = AVAIL[family];
  if (!styles) return null;
  let best = null, bestScore = 1e9;
  for (const st of styles) {
    const it = /italic|oblique/i.test(st);
    const score = Math.abs(weightOf(st) - weight) + (it === italic ? 0 : 1000);
    if (score < bestScore) { bestScore = score; best = st; }
  }
  return best;
}
const loaded = new Map();
async function loadFont(f) {
  if (!f || f === figma.mixed) return false;
  const k = f.family + '|' + f.style;
  if (!loaded.has(k)) loaded.set(k, figma.loadFontAsync(f).then(() => true, () => { report.fontsMissing.add(f.family + ' ' + f.style); return false; }));
  return loaded.get(k);
}

// ---------- 1. Стили ----------
const TEXT_STYLE_IDS = [];
async function createStyles() {
  for (const [theme, cols] of Object.entries(DATA.tokens.colors)) {
    for (const [name, c] of Object.entries(cols)) {
      const s = await upsert('paint', `Тема ${theme}/${name.replace(/_/g, ' ')}`);
      s.paints = [{ type: 'SOLID', color: hexToRgb(c.value), opacity: c.opacity ?? 1 }];
      s.description = `CSS: ${c.css}`;
      report.colors++;
    }
  }
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
  for (const b of DATA.tokens.brands) {
    for (const [k, label] of [['accent', 'Акцент'], ['accentText', 'Акцент текст'], ['accentTextLight', 'Акцент текст (светлая тема)']]) {
      if (!b[k]) continue;
      const s = await upsert('paint', `Бренды/${b.name}/${label}`);
      s.paints = [{ type: 'SOLID', color: hexToRgb(b[k]) }];
      report.colors++;
    }
  }
  const all = [...DATA.tokens.textStyles, ...DATA.tokens.brands.map((b) => ({ name: `Бренды/${b.name} — заголовок`, family: b.font, size: 96, weight: b.weight, italic: b.italic, letterSpacingPx: Math.round(b.trackingEm * 96 * 100) / 100, usage: 0, where: ['Страница бренда'] }))];
  for (const [i, t] of all.entries()) {
    const style = await pickStyle(t.family, t.weight, t.italic);
    if (!style) { report.fontsMissing.add(t.family); continue; }
    const fontName = { family: t.family, style };
    if (!(await loadFont(fontName))) continue;
    const s = await upsert('text', t.name);
    s.fontName = fontName;
    s.fontSize = t.size;
    s.letterSpacing = { unit: 'PIXELS', value: t.letterSpacingPx || 0 };
    s.lineHeight = t.lineHeightPx ? { unit: 'PIXELS', value: t.lineHeightPx } : { unit: 'AUTO' };
    s.description = t.usage ? `Встречается ${t.usage} раз: ${t.where.join(', ')}` : 'Голос заголовков бренда';
    if (i < DATA.tokens.textStyles.length) TEXT_STYLE_IDS[i] = s.id;
    report.texts++;
  }
  for (const [name, e] of Object.entries(DATA.tokens.effects)) {
    const s = await upsert('effect', name.replace(/_/g, ' ').replace(/^(\S+)\//, 'Тени/$1/'));
    s.effects = [{ type: 'DROP_SHADOW', color: { ...hexToRgb(e.color), a: e.opacity }, offset: { x: e.x, y: e.y }, radius: e.blur, spread: 0, visible: true, blendMode: 'NORMAL', showShadowBehindNode: false }];
    report.effects++;
  }
  const L = DATA.tokens.layout;
  const g = await upsert('grid', 'Сетка/Десктоп 1920 — 12 колонок');
  g.layoutGrids = [{ pattern: 'COLUMNS', alignment: 'STRETCH', gutterSize: L.gutter, count: L.columns, offset: L.margin, visible: true, color: { r: 0.85, g: 0.44, b: 0.5, a: 0.12 } }];
  report.grids++;
}

// ---------- 2. Тексты ----------
// Figma при импорте SVG: разбивает многострочный текст на слои-строки, теряет межбуквенный интервал
// и насыщенность (кроме Regular/Bold). Шаг собирает строки обратно и восстанавливает всё по данным.
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
async function fixTexts() {
  const frames = await frameIndex();
  if (!TEXT_STYLE_IDS.length) {
    const byName = new Map((await figma.getLocalTextStylesAsync()).map((s) => [s.name, s.id]));
    DATA.tokens.textStyles.forEach((t, i) => { if (byName.has(t.name)) TEXT_STYLE_IDS[i] = byName.get(t.name); });
  }
  const paintIds = new Map((await figma.getLocalPaintStylesAsync()).map((s) => [s.name, s.id]));
  const names = Object.keys(DATA.texts);
  for (const [fi, fname] of names.entries()) {
    const rec = frames.get(fname);
    if (!rec) continue;
    if (fi % 10 === 0) say(`Тексты: экран ${fi + 1} из ${names.length}`);
    const nodes = rec.node.findAll((n) => n.type === 'TEXT');
    let i = 0;
    for (const e of DATA.texts[fname]) {
      const [name, lines, fontI, ls, gap, anc, si, ci] = e;
      let start = -1;
      for (let j = i; j < Math.min(nodes.length, i + 10); j++) if (norm(nodes[j].characters) === norm(lines[0])) { start = j; break; }
      if (start < 0) { report.textMiss++; continue; }
      let k = 1;
      while (k < lines.length && start + k < nodes.length && norm(nodes[start + k].characters) === norm(lines[k])) k++;
      const group = nodes.slice(start, start + k);
      i = start + k;
      const t0 = group[0];
      try {
        const font = DATA.fonts[fontI];
        const okOld = await loadFont(t0.fontName);
        const okNew = await loadFont(font);
        if (!okOld) continue;
        const before = { x: t0.x, y: t0.y, w: t0.width, h: t0.height };
        if (group.length > 1) {
          t0.characters = group.map((t) => t.characters).join('\n');
          for (const t of group.slice(1)) t.remove();
          report.merged++;
        }
        if (okNew) t0.fontName = font;
        if (ls) t0.letterSpacing = { unit: 'PIXELS', value: ls };
        if (group.length > 1 && gap) t0.lineHeight = { unit: 'PIXELS', value: gap };
        t0.textAlignHorizontal = anc === 1 ? 'CENTER' : anc === 2 ? 'RIGHT' : 'LEFT';
        t0.textAutoResize = 'WIDTH_AND_HEIGHT';
        if (si >= 0 && TEXT_STYLE_IDS[si]) {
          await t0.setTextStyleIdAsync(TEXT_STYLE_IDS[si]);
          // свой интервал задаём, только если он отличается от интервала стиля (иначе стиль остаётся привязанным)
          const lh = DATA.tokens.textStyles[si].lineHeightPx;
          if (group.length > 1 && gap && (!lh || Math.abs(lh - gap) > 0.6)) t0.lineHeight = { unit: 'PIXELS', value: gap };
          report.styled++;
        }
        if (ci >= 0 && paintIds.has(DATA.colors[ci])) await t0.setFillStyleIdAsync(paintIds.get(DATA.colors[ci]));
        // положение: якорь строки (лево / центр / право) и верх первой строки остаются на месте
        t0.x = anc === 1 ? before.x + before.w / 2 - t0.width / 2 : anc === 2 ? before.x + before.w - t0.width : before.x;
        // верх первой строки: строка новой высоты центрируется на месте старой (как line-height в CSS)
        const lineH = t0.height / Math.max(1, t0.characters.split('\n').length);
        t0.y = before.y - (lineH - before.h) / 2;
        if (name) t0.name = name;
        report.fixed++;
      } catch (err) { report.failed++; }
    }
  }
}

// ---------- 3. Переходы ----------
const EASE = DATA.easing; // кривая сайта --ease-out
function transition(kind) {
  const easing = { type: 'CUSTOM_CUBIC_BEZIER', easingFunctionCubicBezier: { x1: EASE[0], y1: EASE[1], x2: EASE[2], y2: EASE[3] } };
  if (kind === 'instant') return null;
  if (kind === 'slide') return { type: 'MOVE_IN', direction: 'LEFT', matchLayers: false, easing, duration: 0.64 };
  if (kind === 'smart') return { type: 'SMART_ANIMATE', easing, duration: 0.64 };
  return { type: 'DISSOLVE', easing, duration: kind === 'fast' ? 0.16 : 0.32 };
}
function trigger(L) {
  if (L.trig === 'MOUSE_ENTER' || L.trig === 'MOUSE_LEAVE') return { type: L.trig, delay: 0 };
  if (L.trig === 'AFTER_TIMEOUT') return { type: 'AFTER_TIMEOUT', timeout: L.timeout || 1 };
  return { type: 'ON_CLICK' };
}
async function setReactions(node, reactions) {
  if (typeof node.setReactionsAsync === 'function') await node.setReactionsAsync(reactions);
  else node.reactions = reactions;
}

async function createLinks() {
  const frames = await frameIndex();
  const added = new Map(); // node.id → { node, byTrigger }
  const push = (node, reaction) => {
    if (!added.has(node.id)) added.set(node.id, { node, byTrigger: new Map() });
    const rec = added.get(node.id);
    if (!rec.byTrigger.has(reaction.trigger.type)) rec.byTrigger.set(reaction.trigger.type, reaction); // один переход на каждый тип триггера
  };
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
    let targets;
    if (L.trigger === '__frame__') targets = [src.node];
    else if (L.regex) { const re = new RegExp(L.regex, 'i'); targets = src.node.findAll((n) => re.test(n.name)).slice(0, L.limit || 60); }
    else targets = [src.node.findOne((n) => n.name === L.trigger)].filter(Boolean);
    if (!targets.length) { report.missingLayers++; continue; }
    for (const t of targets) push(t, { trigger: trigger(L), actions: [action] });
    if (L.action === 'BACK') report.back += targets.length;
    else if (L.trig === 'AFTER_TIMEOUT') report.timers += targets.length;
    else if (L.trig) report.hover += targets.length;
    else report.links += targets.length;
  }
  for (const { node, byTrigger } of added.values()) {
    try { await setReactions(node, [...byTrigger.values()]); } catch (e) { report.failed++; }
  }
  for (const page of figma.root.children) {
    const flows = [];
    for (const [name, title] of DATA.flows) { const f = frames.get(name); if (f && f.page === page) flows.push({ nodeId: f.node.id, name: title }); }
    if (flows.length) page.flowStartingPoints = flows;
  }
}

(async () => {
  const cmd = figma.command || 'all';
  try {
    if (cmd === 'styles' || cmd === 'all') { say('Amfibia: создаю стили…'); await createStyles(); }
    if (cmd === 'texts' || cmd === 'all') { say('Amfibia: исправляю тексты…'); await fixTexts(); }
    if (cmd === 'links' || cmd === 'all') { say('Amfibia: расставляю переходы…'); await createLinks(); }
    const parts = [];
    if (cmd === 'styles' || cmd === 'all') parts.push(`стили: цвета ${report.colors}, текст ${report.texts}, тени ${report.effects}, сетка ${report.grids}`);
    if (cmd === 'texts' || cmd === 'all') parts.push(`тексты: исправлено ${report.fixed}, склеено абзацев ${report.merged}, со стилем ${report.styled}`);
    if (cmd === 'links' || cmd === 'all') parts.push(`переходы: клик ${report.links}, наведение ${report.hover}, таймер ${report.timers}, назад ${report.back}`);
    if (report.missingFrames.size) parts.push(`не найдено экранов: ${report.missingFrames.size}`);
    if (report.otherPage) parts.push(`на другой странице: ${report.otherPage}`);
    if (report.fontsMissing.size) parts.push(`нет шрифтов: ${[...report.fontsMissing].join(', ')}`);
    console.log('Amfibia:', JSON.stringify({ ...report, missingFrames: [...report.missingFrames], fontsMissing: [...report.fontsMissing] }, null, 1));
    figma.closePlugin('Amfibia — ' + parts.join(' · '));
  } catch (e) {
    console.error(e);
    figma.closePlugin('Ошибка: ' + (e && e.message ? e.message : e));
  }
})();
