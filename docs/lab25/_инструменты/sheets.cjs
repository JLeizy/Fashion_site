// Страницы «Стили», «Компоненты», «Обложка»: собираются на холсте сайта (его CSS и шрифты) и переводятся в SVG
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');
const DOCS = '/home/user/Fashion_site/docs/lab25';
const only = process.argv[2] ? new RegExp(process.argv[2], 'i') : null;

const SHEET_CSS = `
  body{background:#0b0b0c!important;margin:0}
  .sh{width:1920px;padding:96px 100px 120px;box-sizing:border-box;color:var(--text);font-family:var(--font-body)}
  .sh-head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1px solid var(--line-2);padding-bottom:36px;margin-bottom:72px}
  .sh-head h1{font-family:var(--font-display);font-weight:300;font-size:96px;line-height:1;margin:14px 0 0}
  .sh-head p{max-width:560px;color:var(--text-2);font-size:15px;line-height:1.6;margin:0}
  .sh-logo{font-family:var(--font-gothic);font-size:40px;color:var(--text)}
  .sh-sec{margin-bottom:96px}
  .sh-sec__head{display:flex;align-items:baseline;gap:24px;margin-bottom:36px}
  .sh-sec__n{font-family:var(--font-mono);font-size:12px;color:var(--accent-text);letter-spacing:.16em}
  .sh-sec__t{font-family:var(--font-display);font-size:48px;font-weight:300;margin:0}
  .sh-sec__d{color:var(--text-3);font-size:14px;margin-left:auto;max-width:520px;text-align:right}
  .sh-themes{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
  .sh-theme{border:1px solid var(--line-2);padding:28px;border-radius:6px;color:var(--text)}
  .sh-theme__t{font-family:var(--font-mono);font-size:12px;letter-spacing:.16em;text-transform:uppercase;margin:0 0 20px}
  .sh-sw{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
  .sh-swatch__c{height:72px;border-radius:4px;border:1px solid rgba(128,128,128,.35)}
  .sh-swatch__n{font-size:12px;margin:8px 0 2px}
  .sh-swatch__v{font-family:var(--font-mono);font-size:11px;color:var(--text-3)}
  .sh-type{display:grid;grid-template-columns:320px 1fr 420px;border-top:1px solid var(--line);align-items:center}
  .sh-type > *{padding:22px 0}
  .sh-type__name{font-family:var(--font-mono);font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-2)}
  .sh-type__spec{font-family:var(--font-mono);font-size:11px;color:var(--text-3);line-height:1.7}
  .sh-grid{position:relative;height:420px;border:1px solid var(--line-2);background:var(--bg-2)}
  .sh-grid__cols{position:absolute;inset:0 100px;display:grid;grid-template-columns:repeat(12,1fr);gap:24px}
  .sh-grid__col{background:rgba(217,112,127,.14);border-left:1px solid rgba(217,112,127,.4);border-right:1px solid rgba(217,112,127,.4)}
  .sh-grid__lbl{position:absolute;font-family:var(--font-mono);font-size:11px;color:var(--text-2);letter-spacing:.1em}
  .sh-icons{display:grid;grid-template-columns:repeat(12,1fr);gap:12px}
  .sh-icon{border:1px solid var(--line);border-radius:4px;height:96px;display:grid;place-items:center;align-content:center;gap:10px}
  .sh-icon .icon{width:24px;height:24px}
  .sh-icon span{font-family:var(--font-mono);font-size:10px;color:var(--text-3)}
  .sh-orns{display:grid;grid-template-columns:repeat(8,1fr);gap:12px}
  .sh-orn{border:1px solid var(--line);height:120px;display:grid;place-items:center;align-content:center;gap:10px;color:var(--silver)}
  .sh-orn svg{width:48px;height:48px;fill:currentColor}
  .sh-orn span{font-family:var(--font-mono);font-size:10px;color:var(--text-3)}
  .sh-row{display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start}
  .sh-item{display:grid;gap:12px;align-content:start}
  .sh-cap{font-family:var(--font-mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--text-3)}
  .sh-box{border:1px dashed var(--line-2);padding:28px;border-radius:6px}
  .sh-wide{width:1720px}
  .sh-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:24px}
  .sh-cover{position:relative;width:1920px;height:1080px;overflow:hidden;background:#0b0b0c}
`;

function swatches(theme, vars) {
  return `<div class="sh-theme" data-theme="${theme}" data-layer="Тема_${{ amfibia: 'Amfibia', light: 'Светлая', dark: 'Тёмная' }[theme]}" style="background:var(--bg)">
    <p class="sh-theme__t" data-layer="Название_темы">${{ amfibia: 'Amfibia — основная', light: 'Светлая', dark: 'Тёмная' }[theme]}</p>
    <div class="sh-sw" data-layer="Образцы">${vars.map(([v, n]) => `<div class="sh-swatch" data-layer="Цвет_${n}"><div class="sh-swatch__c" data-layer="Образец" style="background:var(${v})"></div><p class="sh-swatch__n" data-layer="Имя">${n}</p><p class="sh-swatch__v" data-layer="Значение" data-var="${v}"></p></div>`).join('')}</div></div>`;
}

const COLOR_VARS = [['--bg', 'Фон'], ['--bg-2', 'Фон_2'], ['--surface', 'Поверхность'], ['--surface-2', 'Поверхность_2'], ['--text', 'Текст'], ['--text-2', 'Текст_2'], ['--text-3', 'Текст_3'],
  ['--line-2', 'Линия'], ['--accent', 'Акцент'], ['--accent-text', 'Акцент_текст'], ['--success', 'Успех'], ['--danger', 'Ошибка'], ['--warning', 'Предупреждение'], ['--silver', 'Серебро'], ['--focus', 'Фокус'], ['--on-accent', 'На_акценте']];

async function canvas(page, html, { theme = 'amfibia' } = {}) {
  await page.goto(L.B + '/about', { waitUntil: 'networkidle' });
  await page.evaluate(({ html, css, theme }) => {
    const sprite = [...document.body.children].find((e) => e.tagName.toLowerCase() === 'svg' && e.querySelector('symbol'));
    document.documentElement.dataset.theme = theme;
    document.body.className = '';
    document.body.removeAttribute('data-page');
    document.body.innerHTML = html;
    if (sprite) document.body.prepend(sprite);
    const st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);
    document.querySelectorAll('[data-var]').forEach((e) => { e.textContent = getComputedStyle(e.closest('[data-theme]')).getPropertyValue(e.dataset.var).trim().toUpperCase(); });
  }, { html, css: SHEET_CSS, theme });
  await page.evaluate(async () => {
    document.querySelectorAll('img').forEach((i) => { i.loading = 'eager'; if (i.dataset.src && !i.src) i.src = i.dataset.src; });
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 5000); }))));
  });
  await page.waitForTimeout(500);
}

const L_capture = (page, frameName, outFile) => L.capture(page, { frameName, outFile });

(async () => {
  const browser = await L.chromium.launch();
  const ctx = await L.newContext(browser);
  const page = await ctx.newPage();

  // --- образцы текста с реальных страниц ---
  const samples = {};
  const grab = async (url, list) => {
    await page.goto(L.B + url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    Object.assign(samples, await page.evaluate((list) => {
      const out = {};
      for (const [key, sel] of list) {
        const e = document.querySelector(sel);
        if (!e) continue;
        const cs = getComputedStyle(e);
        out[key] = { ff: cs.fontFamily, fs: cs.fontSize, fw: cs.fontWeight, lh: cs.lineHeight, ls: cs.letterSpacing, tt: cs.textTransform, fst: cs.fontStyle, html: e.outerHTML };
      }
      return out;
    }, list));
  };
  await grab('/', [['logo', '.logo__text'], ['h1', '.hero__title'], ['h2', '.home-title'], ['eyebrow', '.t-eyebrow'], ['nav', '.nav-link'], ['btn', '.btn'], ['header', 'header.header'], ['footer', 'footer.footer'],
    ['tile', '.brand-tile'], ['hcard', '.hcol__card'], ['perk', '.perk'], ['story', '.story']]);
  await grab('/catalog', [['cardname', '.p-card__name'], ['cardbrand', '.p-card__brand'], ['price', '.p-card__price'], ['body', '.filter__label, .check'], ['card', '.p-card'], ['card2', '.p-card:nth-child(5)'],
    ['filter', '.filters__body > .filter:nth-child(2), .filter:nth-of-type(2)'], ['pagination', '.pagination'], ['crumbs', '.breadcrumbs'], ['sizegrid', '.size-grid'], ['toolbar', '.catalog__toolbar']]);
  await grab('/product/473', [['ppname', '.pp-name'], ['pptext', '.accordion__content, .pp-info p'], ['sizes', '.pp-sizes'], ['buy', '.pp-buy'], ['acc', '.accordion__item'], ['review', '.review'], ['rbars', '.rbars'], ['tag', '.pp-tag']]);
  await grab('/auth', [['field', '.field'], ['tabs', '.auth__tabs']]);

  const font = (k) => samples[k] ? `font-family:${samples[k].ff.replace(/"/g, "'")};font-size:${samples[k].fs};font-weight:${samples[k].fw};line-height:${samples[k].lh};letter-spacing:${samples[k].ls};text-transform:${samples[k].tt};font-style:${samples[k].fst}` : '';
  const spec = (k) => samples[k] ? `${samples[k].ff.split(',')[0].replace(/"/g, '')} · ${samples[k].fw} · ${Math.round(parseFloat(samples[k].fs))} px / ${samples[k].lh === 'normal' ? 'auto' : Math.round(parseFloat(samples[k].lh)) + ' px'}${samples[k].ls !== 'normal' && parseFloat(samples[k].ls) ? ' · трекинг ' + parseFloat(samples[k].ls).toFixed(1) : ''}${samples[k].tt === 'uppercase' ? ' · ПРОПИСНЫЕ' : ''}` : '';

  // ====================== СТИЛИ ======================
  if (!only || only.test('Стили')) {
    const T = JSON.parse(fs.readFileSync(path.join(DOCS, '6_Для_Figma', 'Дизайн-токены.json'), 'utf8'));
    const icons = ['search', 'heart', 'compare', 'bag', 'bell', 'user', 'close', 'menu', 'arrow-right', 'arrow-left', 'arrow-up', 'arrow-ne', 'chevron-down', 'chevron-right', 'chevron-left', 'plus', 'minus', 'trash', 'check', 'star', 'eye', 'filter',
      'grid2', 'grid3', 'grid4', 'list', 'globe', 'palette', 'truck', 'shield', 'return', 'chat', 'box', 'pin', 'phone', 'mail', 'logout', 'settings', 'home', 'catalog', 'book', 'play', 'pause', 'expand', 'ruler', 'upload', 'download', 'edit',
      'lock', 'clock', 'refresh', 'sparkle', 'info', 'warning', 'card', 'cash', 'sun', 'moon'];
    const orns = ['cross', 'cross-filigree', 'fleur', 'dagger', 'divider', 'corner', 'arch', 'star'];
    const sec = (n, t, d, inner) => `<section class="sh-sec" data-layer="${n}_${t.replace(/[ ,—]+/g, '_')}"><div class="sh-sec__head" data-layer="Заголовок_секции"><span class="sh-sec__n">${n}</span><h2 class="sh-sec__t">${t}</h2><p class="sh-sec__d">${d}</p></div>${inner}</section>`;
    const themeKey = { Amfibia: 'amfibia', 'Светлая': 'light', 'Тёмная': 'dark' };
    const hexA = (c) => c.value.toUpperCase() + (c.opacity < 1 ? ` · ${Math.round(c.opacity * 100)}%` : '');
    const rgba = (c) => { const h = c.value.slice(1); const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16); return `rgba(${r},${g},${b},${c.opacity ?? 1})`; };
    const themes = Object.entries(T.colors).map(([tn, cols]) => `<div class="sh-theme" data-theme="${themeKey[tn]}" data-layer="Тема_${tn}" style="background:var(--bg)">
      <p class="sh-theme__t" data-layer="Название_темы">${tn === 'Amfibia' ? 'Amfibia — основная' : tn}</p>
      <div class="sh-sw" data-layer="Образцы" style="grid-template-columns:repeat(5,1fr)">${Object.entries(cols).map(([n, c]) => `<div class="sh-swatch" data-layer="Цвет_${n}"><div class="sh-swatch__c" data-layer="Образец" style="background:${rgba(c)};height:56px"></div><p class="sh-swatch__n" data-layer="Имя">${n.replace(/_/g, ' ')}</p><p class="sh-swatch__v" data-layer="Значение">${hexA(c)}</p></div>`).join('')}</div></div>`).join('');
    const prod = Object.entries(T.productColors).map(([n, c]) => `<div class="sh-swatch" data-layer="Цвет_товара_${n}"><div class="sh-swatch__c" data-layer="Образец" style="height:64px;border-radius:50%;width:64px;background:${c.value || c.gradient}" ${c.gradient && /conic/.test(c.gradient) ? 'data-proto-raster' : ''}></div><p class="sh-swatch__n" data-layer="Имя">${n.replace(/_/g, ' ')}</p><p class="sh-swatch__v" data-layer="Значение">${c.value ? c.value.toUpperCase() : 'градиент'}</p></div>`).join('');
    const brands = T.brands.map((b) => `<div data-layer="Бренд_${b.name.replace(/[^\p{L}\p{N}]+/gu, '_')}" style="border:1px solid var(--line-2);border-radius:6px;padding:22px 22px 18px;display:grid;gap:12px;align-content:start;overflow:hidden">
      <p data-layer="Название" style="margin:0;font-family:'${b.font}';font-weight:${b.weight};font-style:${b.italic ? 'italic' : 'normal'};letter-spacing:${b.trackingEm}em;font-size:34px;line-height:1.1;color:var(--text);white-space:nowrap">${b.name.toUpperCase() === b.name || ['Balenciaga', 'Vetements', 'Supreme', 'AVAVAV'].includes(b.name) ? b.name.toUpperCase() : b.name}</p>
      <div data-layer="Цвета" style="display:flex;gap:8px;align-items:center"><span data-layer="Акцент" style="width:28px;height:28px;border-radius:50%;background:${b.accent}"></span><span data-layer="Акцент_текст" style="width:28px;height:28px;border-radius:50%;background:${b.accentText}"></span><span data-layer="Акцент_светлая_тема" style="width:28px;height:28px;border-radius:50%;background:${b.accentTextLight};border:1px solid var(--line-2)"></span></div>
      <p class="sh-swatch__v" data-layer="Параметры" style="line-height:1.6">${b.font} · ${b.weight}${b.italic ? ' Italic' : ''} · трекинг ${b.trackingEm}em<br>${b.accent} · ${b.accentText} · ${b.accentTextLight}</p></div>`).join('');
    const fontUse = { UnifrakturMaguntia: 'логотип, водяной знак', 'Cormorant Garamond': 'заголовки страниц, названия товаров', Inter: 'основной текст, описания, формы', 'JetBrains Mono': 'метки, кнопки, цены, навигация', Forum: 'бренды Givenchy, Versace', 'Playfair Display': 'бренды Gucci, Chanel', Unbounded: 'бренд Balenciaga', Caveat: 'бренд Enfants Riches Déprimés', 'Rubik Glitch': 'бренд AVAVAV' };
    const fonts = T.fonts.map((f) => `<div data-layer="Шрифт_${f.replace(/ /g, '_')}" style="border-top:1px solid var(--line);padding:22px 0;display:grid;grid-template-columns:140px 1fr 360px;align-items:center;gap:24px">
      <span data-layer="Аа" style="font-family:'${f}';font-size:72px;line-height:1">Аа</span><span data-layer="Алфавит" style="font-family:'${f}';font-size:24px;line-height:1.4;color:var(--text-2)">Абвгдеёжзийклмнопрстуфхцчшщъыьэюя<br>ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789</span>
      <span class="sh-type__spec" data-layer="Где_используется"><b style="color:var(--text);font-weight:500">${f}</b><br>${fontUse[f] || ''}</span></div>`).join('');
    const tstyles = T.textStyles.map((t) => { const shown = Math.min(t.size, 88); return `<div class="sh-type" data-layer="Стиль_${t.name.replace(/[\/ ·]+/g, '_')}" style="grid-template-columns:330px 1fr 380px">
      <span class="sh-type__name" data-layer="Название_стиля" style="text-transform:none;letter-spacing:.02em">${t.name}</span>
      <span data-layer="Пример" style="font-family:'${t.family}';font-size:${shown}px;font-weight:${t.weight};font-style:${t.italic ? 'italic' : 'normal'};letter-spacing:${(t.letterSpacingPx * shown) / t.size}px;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${(t.sample || 'Amfibia').replace(/</g, '')}</span>
      <span class="sh-type__spec" data-layer="Параметры">${t.family} · ${t.weight}${t.italic ? ' Italic' : ''} · ${t.size} px${t.letterSpacingPx ? ' · трекинг ' + t.letterSpacingPx + ' px' : ''}${t.lineHeightPx ? ' · интерлиньяж ' + t.lineHeightPx + ' px' : ''}${shown < t.size ? ' · показан в ' + shown + ' px' : ''}<br>встречается ${t.usage} раз · ${t.where.join(', ')}</span></div>`; }).join('');
    const bezPath = (b) => { const W = 220, H = 160; const P = (x, y) => `${(x * W).toFixed(1)} ${(H - y * H).toFixed(1)}`; return `M${P(0, 0)} C${P(b[0], b[1])} ${P(b[2], b[3])} ${P(1, 1)}`; };
    const eases = Object.entries(T.motion.easings).map(([n, e]) => `<div data-layer="Кривая_${n}" style="border:1px solid var(--line-2);border-radius:6px;padding:22px;display:grid;gap:14px">
      <svg width="260" height="200" viewBox="-20 -20 260 200" style="overflow:visible"><path d="M0 160 H220 M0 0 V160" fill="none" stroke="#45433f" stroke-width="1"/><path d="${bezPath([0, 0, 1, 1])}" fill="none" stroke="#45433f" stroke-width="1" stroke-dasharray="4 4"/><path d="${bezPath(e.bezier)}" fill="none" stroke="#d9707f" stroke-width="2.5" stroke-linecap="round"/></svg>
      <p style="margin:0;font-family:var(--font-display);font-size:26px" data-layer="Название">${n.replace(/_/g, ' ')}</p><p class="sh-type__spec" data-layer="Параметры">cubic-bezier(${e.bezier.join(', ')}) · ${e.css}<br>${e.use}</p></div>`).join('');
    const durs = Object.entries(T.motion.durations).map(([n, d]) => `<div data-layer="Длительность_${n}" style="display:grid;grid-template-columns:220px 1fr 120px;align-items:center;gap:20px;border-top:1px solid var(--line);padding:16px 0"><span class="sh-type__name">${n.replace(/_/g, ' ')}</span><span data-layer="Шкала" style="height:8px;background:#5a0f1c;width:${(d.ms / 1100) * 100}%"></span><span class="sh-type__spec">${d.ms} мс · ${d.css}</span></div>`).join('');
    const trs = `<div data-layer="Таблица_переходов" style="margin-top:36px"><div class="sh-type" style="grid-template-columns:260px 280px 1fr 120px 200px 320px;color:var(--text-3)" data-layer="Шапка_таблицы">${['Элемент', 'Когда', 'Что происходит', 'Длительность', 'Кривая', 'Как сделать в Figma'].map((h) => `<span class="sh-type__name">${h}</span>`).join('')}</div>
      ${T.motion.transitions.map((t, i) => `<div class="sh-type" data-layer="Переход_${i + 1}_${t.what.replace(/[ ,«»—]+/g, '_')}" style="grid-template-columns:260px 280px 1fr 120px 200px 320px;align-items:start;font-size:14px"><span style="font-family:var(--font-display);font-size:20px">${t.what}</span><span style="color:var(--text-2)">${t.trigger}</span><span style="color:var(--text-2)">${t.how}</span><span class="sh-type__spec">${t.ms >= 10000 ? t.ms / 1000 + ' с' : t.ms + ' мс'}</span><span class="sh-type__spec">${t.easing.replace(/_/g, ' ')}</span><span class="sh-type__spec" style="color:var(--accent-text)">${t.figma}</span></div>`).join('')}</div>`;
    const shadows = Object.entries(T.effects).map(([n, e]) => { const [tn] = n.split('/'); return `<div data-theme="${themeKey[tn]}" data-layer="Тень_${n.replace(/\//g, '_')}" style="background:var(--bg);padding:40px;border-radius:6px;border:1px solid var(--line-2)"><div data-proto-raster style="padding:24px"><div style="height:120px;background:var(--surface);border-radius:6px;box-shadow:${e.x}px ${e.y}px ${e.blur}px ${rgba({ value: e.color, opacity: e.opacity })}"></div></div><p class="sh-swatch__n" style="color:var(--text)">${n.replace(/\//g, ' — ').replace(/_/g, ' ')}</p><p class="sh-swatch__v">X ${e.x} · Y ${e.y} · размытие ${e.blur} · ${e.color.toUpperCase()} ${Math.round(e.opacity * 100)}%</p></div>`; }).join('');
    const L = T.layout;
    const html = `<div class="sh" data-layer="Стили">
      <div class="sh-head" data-layer="Заголовок_страницы"><div data-layer="Название"><span class="sh-logo" data-layer="Логотип">Amfibia</span><h1 data-layer="Заголовок">Стили</h1></div>
        <p data-layer="Описание">Все стили интерфейса Amfibia: 3 темы × ${Object.keys(T.colors.Amfibia).length} цветов, ${Object.keys(T.productColors).length} цвет товаров, стили 15 брендов, ${T.fonts.length} шрифтов, ${T.textStyles.length} текстовых стилей (покрывают ${T.textCoverage}% всех текстов прототипа), сетка, отступы, скругления, тени, анимации и переходы, иконки и орнаменты. Значения взяты из CSS сайта; те же стили создаёт плагин из папки «6_Для_Figma».</p></div>
      ${sec('01', 'Цвета интерфейса — три темы', 'Контраст текста по WCAG AA: основной 16,5 : 1, вторичный 5,4 : 1, акцент 6,2 : 1', `<div class="sh-themes" data-layer="Темы" style="grid-template-columns:1fr;gap:24px">${themes}</div>`)}
      ${sec('02', 'Цвета товаров', 'Кружки-образцы фильтра «Цвет» и выбора цвета на странице товара', `<div data-layer="Цвета_товаров" style="display:grid;grid-template-columns:repeat(11,1fr);gap:20px">${prod}</div>`)}
      ${sec('03', 'Стили брендов', 'У каждого дома свой «голос» заголовков: шрифт, начертание, трекинг и акцентные цвета (тёмная и светлая темы)', `<div data-layer="Бренды" style="display:grid;grid-template-columns:repeat(5,1fr);gap:20px">${brands}</div>`)}
      ${sec('04', 'Шрифты', 'Бесплатные Google Fonts — все есть в Figma', `<div data-layer="Шрифты">${fonts}</div>`)}
      ${sec('05', 'Текстовые стили', `Собраны со всех экранов прототипа: ${T.textStyles.length} стилей покрывают ${T.textCoverage}% текстов. Имя стиля = группа / кегль / начертание / трекинг`, `<div data-layer="Стили_текста">${tstyles}</div>`)}
      ${sec('06', 'Сетка, отступы, скругления', `Фрейм ${L.frame} · ${L.columns} колонок · контейнер ${L.container} · поля ${L.margin} · промежуток ${L.gutter} · шапка ${L.headerHeight} px (в прокрутке ${L.headerCompact})`, `
        <div class="sh-grid" data-layer="Сетка_12_колонок"><div class="sh-grid__cols" data-layer="Колонки">${Array.from({ length: 12 }, (_, i) => `<div class="sh-grid__col" data-layer="Колонка_${i + 1}"></div>`).join('')}</div>
          <span class="sh-grid__lbl" style="left:110px;top:16px">КОНТЕЙНЕР ${L.container}</span><span class="sh-grid__lbl" style="left:12px;top:200px">${L.margin}</span><span class="sh-grid__lbl" style="right:12px;top:200px">${L.margin}</span><span class="sh-grid__lbl" style="left:110px;bottom:16px">КОЛОНКА 121 · ПРОМЕЖУТОК ${L.gutter}</span></div>
        <div data-layer="Отступы" style="display:flex;gap:28px;align-items:flex-end;margin-top:48px">${L.spacing.map((v) => `<div data-layer="Отступ_${v}" style="display:grid;gap:10px;justify-items:center"><span style="width:${v}px;height:${v}px;background:rgba(217,112,127,.35);border:1px solid #d9707f"></span><span class="sh-swatch__v">${v}</span></div>`).join('')}</div>
        <div data-layer="Скругления_и_линии" style="display:flex;gap:40px;margin-top:48px;align-items:center">${Object.entries(L.radius).map(([n, r]) => `<div data-layer="Скругление_${n}" style="display:grid;gap:10px;justify-items:center"><span style="width:96px;height:96px;border:1px solid var(--text-2);border-radius:${typeof r === 'number' ? r + 'px' : r}"></span><span class="sh-swatch__v">${n} · ${typeof r === 'number' ? r + ' px' : r}</span></div>`).join('')}
          ${['--line', '--line-2', '--line-3'].map((v, i) => `<div data-layer="Линия_${i + 1}" style="display:grid;gap:10px;width:200px"><span style="height:1px;background:var(${v})"></span><span class="sh-swatch__v">Линия ${i + 1} · 1 px · ${v}</span></div>`).join('')}</div>`)}
      ${sec('07', 'Тени и наложения', 'Тень карточки и тень окна в каждой теме; затемнение под окнами — цвет «Затемнение» темы', `<div data-layer="Тени" style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px">${shadows}</div>`)}
      ${sec('08', 'Анимации и переходы', 'Кривые и длительности из CSS сайта и все анимированные переходы интерфейса с подсказкой, как повторить их во вкладке Prototype', `<div data-layer="Кривые" style="display:grid;grid-template-columns:repeat(4,1fr);gap:20px">${eases}</div><div data-layer="Длительности" style="margin-top:40px">${durs}</div>${trs}`)}
      ${sec('09', 'Иконки', 'Линейные, 24 × 24, обводка 1,5 px, цвет — текущий цвет текста', `<div class="sh-icons" data-layer="Набор_иконок">${icons.map((i) => `<div class="sh-icon" data-layer="Иконка_${i}"><svg class="icon"><use href="#i-${i}"/></svg><span>${i}</span></div>`).join('')}</div>`)}
      ${sec('10', 'Орнаменты', 'Готические элементы: кресты, лилия, кинжал, разделитель, уголок, арка', `<div class="sh-orns" data-layer="Набор_орнаментов">${orns.map((o) => `<div class="sh-orn" data-layer="Орнамент_${o}"><svg><use href="#orn-${o}"/></svg><span>${o}</span></div>`).join('')}</div>`)}
    </div>`;
    await canvas(page, html);
    await L_capture(page, 'Стили', path.join(DOCS, '1_Стили', 'Стили.svg'));
  }

  // ====================== КОМПОНЕНТЫ ======================
  if (!only || only.test('Компоненты')) {
    const s = (k) => samples[k]?.html || '';
    const block = (n, t, d, inner) => `<section class="sh-sec" data-layer="${n}_${t.replace(/[ ,—]+/g, '_')}"><div class="sh-sec__head" data-layer="Заголовок_секции"><span class="sh-sec__n">${n}</span><h2 class="sh-sec__t">${t}</h2><p class="sh-sec__d">${d}</p></div>${inner}</section>`;
    const item = (name, cap, inner, style = '') => `<div class="sh-item" data-layer="${name}" style="${style}"><span class="sh-cap" data-layer="Подпись">${cap}</span>${inner}</div>`;
    const html = `<div class="sh" data-layer="Компоненты">
      <div class="sh-head" data-layer="Заголовок_страницы"><div data-layer="Название"><span class="sh-logo" data-layer="Логотип">Amfibia</span><h1 data-layer="Заголовок">Компоненты</h1></div>
        <p data-layer="Описание">Элементы интерфейса из прототипа: шапка, подвал, кнопки, поля, переключатели, метки, карточки. Каждый блок подписан состоянием — из них собраны все страницы.</p></div>
      ${block('01', 'Шапка', 'Навигация, логотип по центру, поиск, язык, валюта, тема, избранное, сравнение, корзина, профиль', `<div class="sh-wide" data-layer="Шапка / По умолчанию" style="position:relative;height:84px;margin-left:-100px;width:1920px">${s('header').replace(/class="header"/, 'class="header" style="position:absolute;inset:0;"')}</div>`)}
      ${block('02', 'Кнопки', 'Основная, контурная, акцентная, опасное действие; размеры L / S / XS; неактивная', `<div class="sh-row" data-layer="Варианты_кнопок">
        ${item('Кнопка / Основная', 'Основная', '<a class="btn">Смотреть коллекцию</a>')}
        ${item('Кнопка / Контурная', 'Контурная', '<a class="btn btn--ghost">Весь каталог</a>')}
        ${item('Кнопка / Акцентная', 'Акцентная', '<a class="btn btn--accent">Оформить заказ</a>')}
        ${item('Кнопка / Опасная', 'Опасное действие', '<a class="btn btn--danger">Удалить товар</a>')}
        ${item('Кнопка / С_иконкой', 'С иконкой', '<a class="btn"><svg class="icon icon--sm"><use href="#i-bag"/></svg><span>В корзину</span></a>')}
        ${item('Кнопка / Маленькая', 'Размер S', '<a class="btn btn--sm">Каталог бренда</a>')}
        ${item('Кнопка / Мини', 'Размер XS', '<a class="btn btn--xs btn--ghost">Подробнее</a>')}
        ${item('Кнопка / Неактивная', 'Неактивная', '<button class="btn" disabled>Нет в наличии</button>')}
        ${item('Кнопка / Иконка', 'Иконка', '<div class="row" style="gap:6px"><button class="icon-btn"><svg class="icon"><use href="#i-heart"/></svg></button><button class="icon-btn"><svg class="icon"><use href="#i-compare"/></svg></button><button class="icon-btn"><svg class="icon"><use href="#i-bag"/></svg><span class="badge">3</span></button></div>')}
      </div>`)}
      ${block('03', 'Поля ввода', 'Пустое, заполненное, ошибка, с подсказкой; список; многострочное; промокод', `<div class="sh-row" data-layer="Варианты_полей" style="gap:32px">
        ${item('Поле / Пустое', 'Пустое', '<div class="field" style="width:340px"><label class="field__label">Email</label><input class="input" placeholder="name@example.com"></div>')}
        ${item('Поле / Заполненное', 'Заполненное', '<div class="field" style="width:340px"><label class="field__label">Имя</label><input class="input" value="Ева Лисовская"></div>')}
        ${item('Поле / Ошибка', 'Ошибка', '<div class="field is-invalid" style="width:340px"><label class="field__label">Пароль</label><input class="input is-invalid" value="12345" aria-invalid="true" style="border-color:var(--danger)"><p class="field__error" style="display:block">Минимум 8 символов, буква и цифра</p></div>')}
        ${item('Поле / Список', 'Выпадающий список', '<select class="select" style="width:240px"><option>Популярные</option></select>')}
        ${item('Поле / Многострочное', 'Комментарий', '<textarea class="input textarea" style="width:340px;height:96px" placeholder="Комментарий к заказу"></textarea>')}
        ${item('Поле / Промокод', 'Промокод', '<div class="promo" style="width:340px"><div class="promo__row" style="display:flex;gap:8px"><input class="input" value="AMFIBIA10"><button class="btn btn--sm">Применить</button></div></div>')}
      </div>`)}
      ${block('04', 'Выбор', 'Чекбоксы, радиокнопки способов доставки, переключатель, чипы, вкладки, размеры, цвета', `<div class="sh-row" data-layer="Элементы_выбора" style="gap:40px">
        ${item('Чекбокс / Состояния', 'Чекбокс', `<div style="display:grid;gap:10px;width:220px">${s('filter') ? '' : ''}<label class="check"><input type="checkbox" checked><span class="check__box"></span><span>Balenciaga</span><span class="check__count">56</span></label><label class="check"><input type="checkbox"><span class="check__box"></span><span>Vetements</span><span class="check__count">41</span></label></div>`)}
        ${item('Переключатель / Вкл_Выкл', 'Переключатель', '<div style="display:grid;gap:12px"><label class="switch"><input type="checkbox" checked><span class="switch__track"></span><span>Только в наличии</span></label><label class="switch"><input type="checkbox"><span class="switch__track"></span><span>Со скидкой</span></label></div>')}
        ${item('Чип / Активный_и_обычный', 'Чипы', '<div class="chips"><button class="chip chip--active">Balenciaga ×</button><button class="chip">Обувь</button><button class="chip">До 5 000 Br</button></div>')}
        ${item('Вкладки', 'Вкладки', s('tabs') || '<div class="tabs"><button class="tab is-active">Вход</button><button class="tab">Регистрация</button></div>', 'width:420px')}
        ${item('Размеры', 'Размеры: доступен / выбран / нет', s('sizes'), 'width:520px')}
      </div>`)}
      ${block('05', 'Метки и статусы', 'Метки товара, счётчики, статусы заказов, уведомления', `<div class="sh-row" data-layer="Метки" style="gap:28px">
        ${item('Метка / Новинка', 'Новинка', '<span class="label label--new">NEW</span>')}
        ${item('Метка / Лимитированный', 'Лимитированный', '<span class="label label--limited">LIMITED</span>')}
        ${item('Метка / Скидка', 'Скидка', '<span class="label label--sale">−22%</span>')}
        ${item('Метка / Последний', 'Последний экземпляр', '<span class="label label--last">Последний экземпляр</span>')}
        ${item('Метка / Подлинность', 'Проверено', '<span class="label label--verified"><svg class="icon"><use href="#i-shield"/></svg>Verified by Amfibia</span>')}
        ${item('Статус / Доставлен', 'Статус: успех', '<span class="status status--ok">● Доставлен</span>')}
        ${item('Статус / В_пути', 'Статус: в пути', '<span class="status status--warn">● В пути</span>')}
        ${item('Статус / Отменён', 'Статус: отменён', '<span class="status status--bad">● Отменён</span>')}
        ${item('Рейтинг', 'Рейтинг', '<span class="stars" style="--value:4.5" aria-label="4,5"></span>')}
      </div>
      <div class="sh-row" data-layer="Уведомления" style="margin-top:32px;gap:24px">
        ${item('Уведомление / Обычное', 'Уведомление', '<p class="notice" style="width:520px"><svg class="icon icon--sm"><use href="#i-info"/></svg> Доставка по Минску — на следующий день</p>')}
        ${item('Уведомление / Акцент', 'Акцент', '<p class="notice notice--accent" style="width:520px"><svg class="icon icon--sm"><use href="#i-bag"/></svg> Чтобы оформить заказ, войдите или зарегистрируйтесь</p>')}
        ${item('Уведомление / Ошибка', 'Ошибка', '<p class="notice notice--danger" style="width:520px"><svg class="icon icon--sm"><use href="#i-warning"/></svg> Неверный email или пароль</p>')}
      </div>`)}
      ${block('06', 'Карточки', 'Карточка товара (обычная и со скидкой), плитка бренда, карточка коллекции, преимущество', `<div class="sh-cards" data-layer="Карточки_товара" style="grid-template-columns:repeat(4,1fr);align-items:start">
        ${item('Карточка_товара / Обычная', 'Карточка товара', s('card'))}
        ${item('Карточка_товара / Скидка', 'Со скидкой', s('card2'))}
        ${item('Карточка_коллекции', 'Карточка коллекции', s('hcard'))}
        ${item('Преимущество', 'Преимущество', s('perk'))}
      </div>
      <div class="sh-row" data-layer="Плитки" style="margin-top:40px;gap:24px">${item('Плитка_бренда', 'Плитка бренда', `<div class="sh-tile" style="width:620px;height:320px;overflow:hidden;position:relative">${s('tile')}</div>`)}${item('Фильтр', 'Фильтр каталога', `<div style="width:300px">${s('filter')}</div>`)}${item('Хлебные_крошки_и_пагинация', 'Навигация по разделам', `<div style="display:grid;gap:28px;width:560px">${s('crumbs')}${s('pagination')}</div>`)}</div>`)}
      ${block('07', 'Блоки товара', 'Покупка, аккордеон, отзыв, распределение оценок, бирка', `<div class="sh-row" data-layer="Блоки_товара" style="gap:32px">
        ${item('Покупка', 'Количество и «В корзину»', `<div style="width:520px">${s('buy')}</div>`)}
        ${item('Аккордеон', 'Аккордеон', `<div style="width:520px">${s('acc')}</div>`)}
        ${item('Отзыв', 'Отзыв', `<div style="width:520px">${s('review')}</div>`)}
      </div>`)}
      ${block('08', 'Состояния элементов', 'Как элементы выглядят при наведении, нажатии, фокусе с клавиатуры, ошибке и блокировке — для вариантов компонентов в Figma', (() => {
        const st = (name, cells) => `<div data-layer="${name}" style="display:grid;grid-template-columns:220px repeat(6,1fr);gap:20px;align-items:center;border-top:1px solid var(--line);padding:22px 0"><span class="sh-type__name" data-layer="Название">${name.replace(/_/g, ' ')}</span>${cells.map(([cap, html]) => `<div class="sh-item" data-layer="${name} / ${cap}"><span class="sh-cap" data-layer="Подпись">${cap}</span>${html}</div>`).join('')}</div>`;
        const btn = (cls, extra = '') => `<a class="btn ${cls}" ${extra}>Смотреть</a>`;
        const inp = (extra = '', val = '') => `<input class="input" style="width:100%" placeholder="Email" ${val ? `value="${val}"` : ''} ${extra}>`;
        const card = s('card');
        return `<div data-layer="Таблица_состояний">
          ${st('Кнопка_основная', [['Обычная', btn('')], ['Наведение', btn('', 'data-force="hover"')], ['Нажатие', btn('', 'data-force="hover active"')], ['Фокус', btn('', 'data-force="focus focus-visible"')], ['Неактивная', '<button class="btn" disabled>Смотреть</button>']])}
          ${st('Кнопка_контурная', [['Обычная', btn('btn--ghost')], ['Наведение', btn('btn--ghost', 'data-force="hover"')], ['Нажатие', btn('btn--ghost', 'data-force="hover active"')], ['Фокус', btn('btn--ghost', 'data-force="focus focus-visible"')], ['Неактивная', '<button class="btn btn--ghost" disabled>Смотреть</button>']])}
          ${st('Кнопка_акцентная', [['Обычная', btn('btn--accent')], ['Наведение', btn('btn--accent', 'data-force="hover"')], ['Нажатие', btn('btn--accent', 'data-force="hover active"')], ['Фокус', btn('btn--accent', 'data-force="focus focus-visible"')], ['Загрузка', '<a class="btn btn--accent is-loading"><span class="btn__label">Смотреть</span></a>']])}
          ${st('Кнопка_иконка', [['Обычная', '<button class="icon-btn"><svg class="icon"><use href="#i-heart"/></svg></button>'], ['Наведение', '<button class="icon-btn" data-force="hover"><svg class="icon"><use href="#i-heart"/></svg></button>'], ['Фокус', '<button class="icon-btn" data-force="focus focus-visible"><svg class="icon"><use href="#i-heart"/></svg></button>'], ['Со счётчиком', '<button class="icon-btn"><svg class="icon"><use href="#i-bag"/></svg><span class="badge">3</span></button>']])}
          ${st('Ссылка', [['Обычная', '<a class="link-u" href="#">Все новинки</a>'], ['Наведение', '<a class="link-u" href="#" data-force="hover">Все новинки</a>'], ['Пункт_меню', '<a class="nav-link link-u" href="#">Новинки</a>'], ['Пункт_меню_наведение', '<a class="nav-link link-u" href="#" data-force="hover">Новинки</a>']])}
          ${st('Поле_ввода', [['Пустое', inp()], ['Наведение', inp('data-force="hover"')], ['Фокус', inp('data-force="focus focus-visible"')], ['Заполненное', inp('', 'eva@example.com')], ['Ошибка', inp('aria-invalid="true" style="width:100%;border-color:var(--danger)"', 'eva@')], ['Неактивное', inp('disabled', 'eva@example.com')]])}
          ${st('Чекбокс', [['Выключен', '<label class="check"><input type="checkbox"><span class="check__box"></span><span>Gucci</span></label>'], ['Включён', '<label class="check"><input type="checkbox" checked><span class="check__box"></span><span>Gucci</span></label>'], ['Наведение', '<label class="check" data-force="hover"><input type="checkbox"><span class="check__box"></span><span>Gucci</span></label>'], ['Неактивный', '<label class="check"><input type="checkbox" disabled><span class="check__box"></span><span>Gucci</span></label>']])}
          ${st('Переключатель', [['Выключен', '<label class="switch"><input type="checkbox"><span class="switch__track"></span><span>Со скидкой</span></label>'], ['Включён', '<label class="switch"><input type="checkbox" checked><span class="switch__track"></span><span>Со скидкой</span></label>']])}
          ${st('Размер', [['Доступен', '<button class="size-btn">M</button>'], ['Наведение', '<button class="size-btn" data-force="hover">M</button>'], ['Выбран', '<button class="size-btn" aria-pressed="true">M</button>'], ['Нет_в_наличии', '<button class="size-btn" disabled>M</button>']])}
          ${st('Чип', [['Обычный', '<button class="chip">Обувь</button>'], ['Наведение', '<button class="chip" data-force="hover">Обувь</button>'], ['Выбран', '<button class="chip chip--active">Обувь ×</button>']])}
          <div data-layer="Карточка_товара_состояния" style="display:grid;grid-template-columns:220px 1fr 1fr 1fr 1fr;gap:20px;align-items:start;border-top:1px solid var(--line);padding:22px 0"><span class="sh-type__name">Карточка товара</span>
            <div class="sh-item" data-layer="Карточка_товара / Обычная"><span class="sh-cap">Обычная</span>${card}</div>
            <div class="sh-item" data-layer="Карточка_товара / Наведение"><span class="sh-cap">Наведение: второй ракурс и действия</span>${card.replace('<article ', '<article data-force="hover" ')}</div></div>
        </div>`;
      })())}
      ${block('09', 'Подвал', 'Рассылка, четыре колонки ссылок, копирайт', `<div data-layer="Подвал / По умолчанию" style="margin-left:-100px;width:1920px">${s('footer')}</div>`)}
    </div>`;
    await canvas(page, html);
    await page.evaluate(() => {
      document.querySelectorAll('.sh [data-reveal]').forEach((e) => e.removeAttribute('data-reveal'));
      document.querySelectorAll('[data-layer="Фильтр"] .filter__list > *').forEach((e, i) => { if (i >= 6) e.remove(); });
      const t = document.querySelector('.sh-tile > *'); if (t) { t.style.width = '100%'; t.style.height = '100%'; t.style.gridArea = 'auto'; }
    });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
    const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '[data-force]' });
    for (const id of nodeIds) {
      const { attributes } = await cdp.send('DOM.getAttributes', { nodeId: id });
      const states = attributes[attributes.indexOf('data-force') + 1].split(/\s+/);
      await cdp.send('CSS.forcePseudoState', { nodeId: id, forcedPseudoClasses: states });
    }
    console.log('состояний включено:', nodeIds.length);
    await page.waitForTimeout(300);
    await L.capture(page, { frameName: 'Компоненты', outFile: path.join(DOCS, '2_Компоненты', 'Компоненты.svg') });
    await cdp.detach();
  }

  // ====================== ОБЛОЖКА ======================
  if (!only || only.test('Обложка')) {
    const html = `<div class="sh-cover" data-layer="Обложка">
      <img src="/images/brands/balenciaga/hero.webp" data-layer="Фото_показа" style="position:absolute;right:0;top:0;width:980px;height:1080px;object-fit:cover">
      <div data-layer="Затемнение" style="position:absolute;right:0;top:0;width:980px;height:1080px;background:linear-gradient(90deg,#0b0b0c 0%,rgba(11,11,12,0) 45%)"></div>
      <div data-layer="Текст" style="position:absolute;left:120px;top:120px;width:900px;color:#ede6da">
        <p data-layer="Надзаголовок" style="font-family:var(--font-mono);font-size:14px;letter-spacing:.24em;text-transform:uppercase;color:#d9707f;margin:0 0 40px">Лабораторная работа № 25 · Прототипирование</p>
        <p data-layer="Логотип" style="font-family:var(--font-gothic);font-size:150px;line-height:1;margin:0">Amfibia</p>
        <h1 data-layer="Заголовок" style="font-family:var(--font-display);font-weight:300;font-size:64px;line-height:1.08;margin:36px 0 28px">Прототип всех страниц интернет-магазина брендовой одежды</h1>
        <p data-layer="Описание" style="font-size:20px;line-height:1.6;color:#bdb6aa;margin:0;max-width:720px">Высокая детализация · 1920 px · 15 модных домов · витрина, покупка, личный кабинет, кабинеты сотрудников и админ-панель</p>
      </div>
      <div data-layer="Подпись" style="position:absolute;left:120px;bottom:110px;display:grid;gap:14px;font-family:var(--font-mono);font-size:16px;letter-spacing:.08em;color:#ede6da">
        <span data-layer="Студент" style="color:#bdb6aa">Выполнил(а): ФИО студента</span>
        <span data-layer="Группа" style="color:#bdb6aa">Группа: ______</span>
        <span data-layer="Год" style="color:#8a857d">2026</span>
      </div>
      <div data-layer="Линия" style="position:absolute;left:120px;bottom:80px;width:780px;height:1px;background:rgba(237,230,218,.22)"></div>
    </div>`;
    await canvas(page, html);
    await L.capture(page, { frameName: 'Обложка', outFile: path.join(DOCS, '4_Обложка', 'Обложка.svg'), height: 1080 });
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
