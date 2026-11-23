// Дизайн-токены Amfibia → docs/lab25/6_Для_Figma/Дизайн-токены.json
// Источники: public/css/tokens.css, public/css/brands.css, реальные тексты всех SVG-кадров (стили текста по частоте)
const fs = require('fs');
const path = require('path');
const SITE = '/home/user/Fashion_site';
const DOCS = path.join(SITE, 'docs/lab25');
const css = fs.readFileSync(path.join(SITE, 'public/css/tokens.css'), 'utf8');
const bcss = fs.readFileSync(path.join(SITE, 'public/css/brands.css'), 'utf8');

const block = (sel) => { const i = css.indexOf(sel); const a = css.indexOf('{', i), b = css.indexOf('}', a); return css.slice(a + 1, b); };
const vars = (body) => Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const root = vars(block(':root {'));
const themes = { amfibia: vars(block("[data-theme='amfibia'] {")), light: vars(block("[data-theme='light'] {")), dark: vars(block("[data-theme='dark'] {")) };

const COLOR_NAMES = {
  bg: 'Фон', 'bg-2': 'Фон_2', 'bg-3': 'Фон_3', surface: 'Поверхность', 'surface-2': 'Поверхность_2', 'surface-3': 'Поверхность_3',
  text: 'Текст', 'text-2': 'Текст_вторичный', 'text-3': 'Текст_приглушённый', line: 'Линия_1', 'line-2': 'Линия_2', 'line-3': 'Линия_3',
  accent: 'Акцент', 'accent-2': 'Акцент_наведение', 'accent-text': 'Акцент_текст', 'on-accent': 'Текст_на_акценте', silver: 'Серебро', focus: 'Фокус',
  success: 'Успех', danger: 'Ошибка', warning: 'Предупреждение', overlay: 'Затемнение', 'header-bg': 'Фон_шапки', ornament: 'Орнамент', vignette: 'Виньетка',
  'skeleton-a': 'Загрузка_1', 'skeleton-b': 'Загрузка_2', 'selection-bg': 'Выделение', 'selection-text': 'Текст_выделения',
};
const THEME_NAMES = { amfibia: 'Amfibia', light: 'Светлая', dark: 'Тёмная' };
function parseColor(v) {
  v = v.trim();
  let m = v.match(/^#([0-9a-f]{3,8})$/i);
  if (m) { let h = m[1]; if (h.length === 3) h = h.split('').map((c) => c + c).join(''); return { hex: '#' + h.slice(0, 6).toLowerCase(), a: h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1 }; }
  m = v.match(/^rgba?\(([^)]+)\)$/);
  if (m) { const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number); return { hex: '#' + p.slice(0, 3).map((x) => Math.round(x).toString(16).padStart(2, '0')).join(''), a: p[3] ?? 1 }; }
  return null;
}
const colors = {};
for (const [t, vs] of Object.entries(themes)) {
  colors[THEME_NAMES[t]] = {};
  for (const [k, n] of Object.entries(COLOR_NAMES)) { const c = vs[k] && parseColor(vs[k]); if (c) colors[THEME_NAMES[t]][n] = { value: c.hex, opacity: Math.round(c.a * 1000) / 1000, css: '--' + k }; }
}
const PRODUCT = { black: 'Чёрный', white: 'Белый', ivory: 'Слоновая_кость', beige: 'Бежевый', camel: 'Кэмел', brown: 'Коричневый', grey: 'Серый', silver: 'Серебристый', gold: 'Золотой', red: 'Красный', burgundy: 'Бордовый', pink: 'Розовый', green: 'Зелёный', khaki: 'Хаки', navy: 'Тёмно-синий', blue: 'Синий', lightblue: 'Голубой', yellow: 'Жёлтый', purple: 'Фиолетовый', orange: 'Оранжевый', multicolor: 'Разноцветный' };
const productColors = {};
for (const [k, n] of Object.entries(PRODUCT)) {
  const v = root['c-' + k];
  if (!v) continue;
  const c = parseColor(v);
  if (c) productColors[n] = { value: c.hex, css: '--c-' + k };
  else productColors[n] = { gradient: v, stops: [...v.matchAll(/#[0-9a-f]{6}/gi)].map((x) => x[0].toLowerCase()), css: '--c-' + k };
}

// Тени
const shadow = (v) => { const m = v.match(/^(-?\d+)(?:px)?\s+(-?\d+)(?:px)?\s+(\d+)(?:px)?\s+(rgba?\([^)]+\))$/); if (!m) return null; const c = parseColor(m[4]); return { x: +m[1], y: +m[2], blur: +m[3], color: c.hex, opacity: c.a }; };
const effects = {};
for (const [t, vs] of Object.entries(themes)) for (const k of ['shadow-1', 'shadow-2']) { const s = vs[k] && shadow(vs[k]); if (s) effects[`${THEME_NAMES[t]}/Тень_${k === 'shadow-1' ? 'карточки' : 'окна'}`] = { type: 'DROP_SHADOW', ...s, css: '--' + k }; }

// Анимации и переходы
const bez = (v) => (v.match(/cubic-bezier\(([^)]+)\)/) || [])[1]?.split(',').map(Number);
const motion = {
  easings: {
    'Плавный_выход': { css: '--ease-out', bezier: bez(root['ease-out']), use: 'появление, открытие окон и панелей, наведение' },
    'Плавный_вход_выход': { css: '--ease-in-out', bezier: bez(root['ease-in-out']), use: 'смена слайдов, шторка между страницами' },
    'Плавный_вход': { css: '--ease-in', bezier: bez(root['ease-in']), use: 'закрытие, уход элементов' },
    'Пружина': { css: '--ease-back', bezier: bez(root['ease-back']), use: 'счётчики, сердечко «в избранное», бейджи' },
  },
  durations: { 'Быстро': { css: '--dur-1', ms: parseInt(root['dur-1']) }, 'Обычно': { css: '--dur-2', ms: parseInt(root['dur-2']) }, 'Медленно': { css: '--dur-3', ms: parseInt(root['dur-3']) }, 'Очень_медленно': { css: '--dur-4', ms: parseInt(root['dur-4']) } },
  transitions: [
    ['Переход между страницами', 'клик по ссылке', 'шторка с орнаментом закрывает и открывает экран', 1100, 'Плавный_вход_выход', 'Navigate → Dissolve'],
    ['Заставка', 'первый вход на сайт', 'логотип рисуется контуром, затем заливается; полоса загрузки', 2200, 'Плавный_вход_выход', 'After delay 2,2 с → Navigate → Dissolve'],
    ['Слайдер на главной', 'стрелки, автопрокрутка', 'кадр раскрывается маской снизу вверх', 1300, 'Плавный_вход_выход', 'Navigate → Smart animate'],
    ['Мега-меню', 'наведение / клик «Бренды», «Каталог»', 'панель выезжает из-под шапки', 320, 'Плавный_выход', 'Open overlay → Move in сверху'],
    ['Поиск', 'иконка лупы', 'панель на весь экран, затемнение фона', 320, 'Плавный_выход', 'Open overlay → Dissolve'],
    ['Мини-корзина', 'иконка корзины, «В корзину»', 'панель выезжает справа', 640, 'Плавный_выход', 'Open overlay → Move in справа'],
    ['Модальные окна', 'кнопки «Быстрый просмотр», «Таблица размеров», «Удалить»…', 'окно появляется с лёгким подъёмом', 320, 'Плавный_выход', 'Open overlay → Dissolve (центр)'],
    ['Закрытие окна', 'крестик, клик по затемнению, Esc', 'окно исчезает', 160, 'Плавный_вход', 'Close overlay / Back'],
    ['Кнопка', 'наведение', 'заливка «выезжает» слева направо, текст меняет цвет', 320, 'Плавный_выход', 'While hovering → Change to (вариант «Наведение»)'],
    ['Карточка товара', 'наведение', 'второй ракурс фото, появляются «Сравнить», «Быстрый просмотр»', 640, 'Плавный_выход', 'While hovering → Change to'],
    ['Ссылка', 'наведение', 'подчёркивание прорисовывается слева направо', 320, 'Плавный_выход', 'While hovering → Change to'],
    ['Избранное', 'клик по сердечку', 'сердечко «подпрыгивает» и заливается', 640, 'Пружина', 'On click → Change to (Smart animate)'],
    ['Блоки при прокрутке', 'прокрутка страницы', 'появление снизу на 40 px с проявлением', 1100, 'Плавный_выход', 'Smart animate / не требуется в статике'],
    ['Бегущая строка брендов', 'постоянно', 'бесконечная прокрутка лент в разные стороны', 40000, 'Линейная', 'не требуется в статике'],
    ['Уведомление (toast)', 'действие выполнено', 'выезжает снизу, исчезает через 4 с', 640, 'Плавный_выход', 'After delay → Close overlay'],
    ['Шаги оформления', '«Далее»', 'текущий шаг сворачивается, следующий раскрывается', 640, 'Плавный_выход', 'Navigate → Smart animate'],
  ].map(([what, trigger, how, ms, easing, figma]) => ({ what, trigger, how, ms, easing, figma })),
};

// Сетка и размеры
const layout = {
  frame: 1920, container: parseInt(root.container), columns: 12, margin: 100, gutter: 24,
  headerHeight: parseInt(root['header-h']), headerCompact: parseInt(root['header-h-compact']),
  radius: { 'Малый': parseInt(root.radius), 'Большой': parseInt(root['radius-lg']), 'Круг': '50%' },
  lineWidth: 1, spacing: [4, 8, 12, 16, 24, 32, 40, 56, 72, 96, 120],
};

// Бренды
const brandSlugs = ['balenciaga', 'vetements', 'gucci', 'prada', 'enfants-riches-deprimes', 'avavav', 'supreme', 'chrome-hearts', 'louis-vuitton', 'chanel', 'maison-margiela', 'givenchy', 'versace', 'alexander-mcqueen', 'loro-piana'];
const brandFiles = fs.readdirSync(path.join(DOCS, '3_Прототип/10_Страницы_брендов')).sort();
const brands = brandSlugs.map((slug, i) => {
  const blocks = [...bcss.matchAll(new RegExp(`\\[data-brand='${slug}'\\]\\s*\\{([^}]*)\\}`, 'g'))].map((m) => m[1]);
  const dark = blocks[0] || '', light = blocks[1] || '';
  const g = (b, k) => (b.match(new RegExp(`--${k}:\\s*([^;]+);`)) || [])[1]?.trim();
  const svg = fs.readFileSync(path.join(DOCS, '3_Прототип/10_Страницы_брендов', brandFiles[i]), 'utf8');
  const t = (svg.match(/<text id="Название_бренда" ([^>]*)>(?:<tspan[^>]*>([^<]*)<\/tspan>)+/) || []);
  const a = t[1] || '';
  const at = (k) => (a.match(new RegExp(`${k}="([^"]*)"`)) || [])[1];
  const name = brandFiles[i].replace(/^\d+_Бренд_/, '').replace(/_1920\.svg$/, '').replace(/_/g, ' ');
  const size = parseFloat(at('font-size') || 0);
  return { slug, name, font: at('font-family'), weight: Number(at('font-weight') || 400), italic: /italic/.test(a), trackingEm: size ? Math.round((parseFloat(at('letter-spacing') || 0) / size) * 100) / 100 : 0,
    accent: g(dark, 'b-accent'), accentText: g(dark, 'b-accent-text'), accentTextLight: g(light, 'b-accent-text') };
});

// Стили текста — по реальному использованию во всех кадрах
const WEIGHT = { 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black' };
const GROUP = { UnifrakturMaguntia: 'Логотип', 'Cormorant Garamond': 'Заголовки', Inter: 'Текст', 'JetBrains Mono': 'Метки' };
const stats = new Map();
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
  const f = path.join(d, e.name);
  if (e.isDirectory()) return walk(f);
  if (!f.endsWith('.svg')) return;
  const folder = path.basename(path.dirname(f)).replace(/^\d+_/, '').replace(/_/g, ' ');
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/<text ([^>]*)>((?:<tspan[^>]*>[^<]*<\/tspan>)+)<\/text>/g)) {
    const a = m[1];
    const at = (k) => (a.match(new RegExp(`${k}="([^"]*)"`)) || [])[1];
    const size = Math.round(parseFloat(at('font-size') || 0));
    if (!size) continue;
    const em = Math.round(((parseFloat(at('letter-spacing') || 0) / size) / 0.04)) * 0.04;
    const key = [at('font-family'), size, Number(at('font-weight') || 400), /italic/.test(a), Math.round(em * 100) / 100].join('|');
    const text = [...m[2].matchAll(/>([^<]*)</g)].map((x) => x[1]).join(' ').trim();
    const st = stats.get(key) || { n: 0, sample: '', where: {} };
    st.n++;
    if (!st.sample || (text.length > st.sample.length && text.length < 46)) st.sample = text.slice(0, 60);
    st.where[folder] = (st.where[folder] || 0) + 1;
    stats.set(key, st);
  }
});
walk(path.join(DOCS, '3_Прототип'));
const total = [...stats.values()].reduce((a, b) => a + b.n, 0);
const sorted = [...stats.entries()].sort((a, b) => b[1].n - a[1].n);
let acc = 0;
const textStyles = [];
for (const [key, st] of sorted) {
  const [family, size, weight, italic, em] = key.split('|');
  if (acc / total >= 0.97 && st.n < 20) break;
  acc += st.n;
  const group = GROUP[family] || 'Бренды';
  const track = Number(em) ? ` · трекинг ${Number(em) > 0 ? '+' : ''}${Number(em).toFixed(2)}` : '';
  textStyles.push({
    name: `${group}/${size} ${WEIGHT[weight] || weight}${italic === 'true' ? ' Italic' : ''}${track}`,
    family, size: Number(size), weight: Number(weight), italic: italic === 'true', letterSpacingPx: Math.round(Number(em) * Number(size) * 100) / 100,
    usage: st.n, sample: st.sample, where: Object.entries(st.where).sort((a, b) => b[1] - a[1]).slice(0, 3).map((x) => x[0]),
  });
}
const ORDER = ['Логотип', 'Заголовки', 'Текст', 'Метки', 'Бренды'];
textStyles.sort((a, b) => ORDER.indexOf(GROUP[a.family] || 'Бренды') - ORDER.indexOf(GROUP[b.family] || 'Бренды') || b.size - a.size || a.weight - b.weight);
// уникальные имена
const seen = {};
for (const t of textStyles) { if (seen[t.name]) t.name += ` (${++seen[t.name]})`; else seen[t.name] = 1; }
const fonts = [...new Set(textStyles.map((t) => t.family))];

const tokens = { name: 'Amfibia — дизайн-токены', version: '1.0', generated: new Date().toISOString().slice(0, 10), colors, productColors, effects, motion, layout, brands, fonts, textStyles, textCoverage: Math.round((acc / total) * 1000) / 10 };
fs.mkdirSync(path.join(DOCS, '6_Для_Figma'), { recursive: true });
fs.writeFileSync(path.join(DOCS, '6_Для_Figma', 'Дизайн-токены.json'), JSON.stringify(tokens, null, 1));
console.log('цветов в темах:', Object.values(colors).map((c) => Object.keys(c).length).join('/'), 'товарных:', Object.keys(productColors).length, 'теней:', Object.keys(effects).length,
  'стилей текста:', textStyles.length, `(покрывают ${tokens.textCoverage}% текстов)`, 'брендов:', brands.length, 'шрифтов:', fonts.length);
