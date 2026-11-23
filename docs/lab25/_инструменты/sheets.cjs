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
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => (i.onload = i.onerror = r))))); });
  await page.waitForTimeout(500);
}

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
    const types = [
      ['logo', 'Логотип', 'Amfibia'], ['h1', 'Заголовок H1 — слайд', 'Индустриальная строгость'], ['h2', 'Заголовок H2 — секция', 'Новые коллекции'], ['ppname', 'Заголовок H3 — товар', 'Слингбэки — кожа ягнёнка'],
      ['cardname', 'Название в карточке', 'Лоферы Medusa 95 Croc Effect'], ['body', 'Основной текст', 'Подлинные вещи 15 модных домов с проверкой и доставкой по Беларуси'],
      ['eyebrow', 'Надзаголовок', 'Сезон осень — зима 2026'], ['nav', 'Пункт меню', 'Каталог'], ['btn', 'Кнопка', 'Смотреть коллекцию'], ['price', 'Цена', '4 160,00 Br'], ['cardbrand', 'Бренд в карточке', 'Versace'],
    ];
    const icons = ['search', 'heart', 'compare', 'bag', 'bell', 'user', 'close', 'menu', 'arrow-right', 'arrow-left', 'arrow-up', 'arrow-ne', 'chevron-down', 'chevron-right', 'chevron-left', 'plus', 'minus', 'trash', 'check', 'star', 'eye', 'filter',
      'grid2', 'grid3', 'grid4', 'list', 'globe', 'palette', 'truck', 'shield', 'return', 'chat', 'box', 'pin', 'phone', 'mail', 'logout', 'settings', 'home', 'catalog', 'book', 'play', 'pause', 'expand', 'ruler', 'upload', 'download', 'edit',
      'lock', 'clock', 'refresh', 'sparkle', 'info', 'warning', 'card', 'cash', 'sun', 'moon'];
    const orns = ['cross', 'cross-filigree', 'fleur', 'dagger', 'divider', 'corner', 'arch', 'star'];
    const html = `<div class="sh" data-layer="Стили">
      <div class="sh-head" data-layer="Заголовок_страницы"><div data-layer="Название"><span class="sh-logo" data-layer="Логотип">Amfibia</span><h1 data-layer="Заголовок">Стили</h1></div>
        <p data-layer="Описание">Дизайн-токены интернет-магазина Amfibia: три темы оформления, шрифты и типографическая шкала, сетка 12 колонок, иконки и орнаменты. Все значения взяты из CSS сайта (tokens.css).</p></div>
      <section class="sh-sec" data-layer="01_Цвета"><div class="sh-sec__head" data-layer="Заголовок_секции"><span class="sh-sec__n">01</span><h2 class="sh-sec__t">Цвета — три темы</h2><p class="sh-sec__d">Контраст текста проверен по WCAG AA: основной текст 16,5 : 1, вторичный 5,4 : 1, акцент 6,2 : 1</p></div>
        <div class="sh-themes" data-layer="Темы">${['amfibia', 'light', 'dark'].map((t) => swatches(t, COLOR_VARS)).join('')}</div></section>
      <section class="sh-sec" data-layer="02_Типографика"><div class="sh-sec__head" data-layer="Заголовок_секции"><span class="sh-sec__n">02</span><h2 class="sh-sec__t">Типографика</h2><p class="sh-sec__d">UnifrakturMaguntia — логотип · Cormorant Garamond — заголовки · Inter — текст · JetBrains Mono — метки, кнопки, цены</p></div>
        <div data-layer="Стили_текста">${types.map(([k, n, s]) => `<div class="sh-type" data-layer="Текст_${n.replace(/[ —]+/g, '_')}"><span class="sh-type__name" data-layer="Название_стиля">${n}</span><span data-layer="Пример" style="${font(k)}">${s}</span><span class="sh-type__spec" data-layer="Параметры">${spec(k)}</span></div>`).join('')}</div></section>
      <section class="sh-sec" data-layer="03_Сетка"><div class="sh-sec__head" data-layer="Заголовок_секции"><span class="sh-sec__n">03</span><h2 class="sh-sec__t">Сетка 1920</h2><p class="sh-sec__d">12 колонок · контейнер 1720 px · поля по 100 px · промежуток 24 px · высота шапки 84 px</p></div>
        <div class="sh-grid" data-layer="Сетка_12_колонок"><div class="sh-grid__cols" data-layer="Колонки">${Array.from({ length: 12 }, (_, i) => `<div class="sh-grid__col" data-layer="Колонка_${i + 1}"></div>`).join('')}</div>
          <span class="sh-grid__lbl" style="left:110px;top:16px">КОНТЕЙНЕР 1720</span><span class="sh-grid__lbl" style="left:12px;top:200px">100</span><span class="sh-grid__lbl" style="right:12px;top:200px">100</span><span class="sh-grid__lbl" style="left:110px;bottom:16px">КОЛОНКА 121 · ПРОМЕЖУТОК 24</span></div></section>
      <section class="sh-sec" data-layer="04_Иконки"><div class="sh-sec__head" data-layer="Заголовок_секции"><span class="sh-sec__n">04</span><h2 class="sh-sec__t">Иконки</h2><p class="sh-sec__d">Линейные, 24 × 24, обводка 1,5 px, цвет — текущий цвет текста</p></div>
        <div class="sh-icons" data-layer="Набор_иконок">${icons.map((i) => `<div class="sh-icon" data-layer="Иконка_${i}"><svg class="icon"><use href="#i-${i}"/></svg><span>${i}</span></div>`).join('')}</div></section>
      <section class="sh-sec" data-layer="05_Орнаменты"><div class="sh-sec__head" data-layer="Заголовок_секции"><span class="sh-sec__n">05</span><h2 class="sh-sec__t">Орнаменты</h2><p class="sh-sec__d">Готические элементы: кресты, лилия, кинжал, разделитель, уголок, арка</p></div>
        <div class="sh-orns" data-layer="Набор_орнаментов">${orns.map((o) => `<div class="sh-orn" data-layer="Орнамент_${o}"><svg><use href="#orn-${o}"/></svg><span>${o}</span></div>`).join('')}</div></section>
    </div>`;
    await canvas(page, html);
    await L.capture(page, { frameName: 'Стили', outFile: path.join(DOCS, '1_Стили', 'Стили.svg') });
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
      ${block('08', 'Подвал', 'Рассылка, четыре колонки ссылок, копирайт', `<div data-layer="Подвал / По умолчанию" style="margin-left:-100px;width:1920px">${s('footer')}</div>`)}
    </div>`;
    await canvas(page, html);
    await page.evaluate(() => {
      document.querySelectorAll('.sh [data-reveal]').forEach((e) => e.removeAttribute('data-reveal'));
      document.querySelectorAll('[data-layer="Фильтр"] .filter__list > *').forEach((e, i) => { if (i >= 6) e.remove(); });
      const t = document.querySelector('.sh-tile > *'); if (t) { t.style.width = '100%'; t.style.height = '100%'; t.style.gridArea = 'auto'; }
    });
    await L.capture(page, { frameName: 'Компоненты', outFile: path.join(DOCS, '2_Компоненты', 'Компоненты.svg') });
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
