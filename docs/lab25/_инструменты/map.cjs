// «Карта переходов»: миниатюры экранов и стрелки с действиями. Плюс текстовый список переходов для инструкции.
const fs = require('fs');
const path = require('path');
const sharp = require('/home/user/Fashion_site/node_modules/sharp');
const L = require('./lib.cjs');
const DOCS = '/home/user/Fashion_site/docs/lab25';
const PROTO = path.join(DOCS, '3_Прототип');
const PREV = path.join(DOCS, 'Превью');

const F = {
  home: '01_Витрина/01_Главная_1920', catalog: '01_Витрина/02_Каталог_1920', catf: '01_Витрина/03_Каталог_фильтр_Balenciaga_1920', brand: '10_Страницы_брендов/01_Бренд_Balenciaga_1920',
  brand2: '10_Страницы_брендов/10_Бренд_Chanel_1920', product: '01_Витрина/04_Товар_1920', hist: '01_Витрина/05_Истории_брендов_1920', story: '11_Истории_брендов/01_История_Balenciaga_1920',
  cmp0: '01_Витрина/06_Сравнение_пустое_1920', cmp: '01_Витрина/07_Сравнение_1920', empty: '01_Витрина/08_Каталог_ничего_не_найдено_1920',
  cart: '02_Покупка/01_Корзина_1920', cart0: '02_Покупка/02_Корзина_пустая_1920', co1: '02_Покупка/03_Оформление_шаг1_Контакты_1920', co2: '02_Покупка/04_Оформление_шаг2_Адрес_1920',
  co3: '02_Покупка/05_Оформление_шаг3_Доставка_1920', co4: '02_Покупка/06_Оформление_шаг4_Оплата_1920', co5: '02_Покупка/07_Оформление_шаг5_Подтверждение_1920', done: '02_Покупка/08_Заказ_оформлен_1920',
  trk: '02_Покупка/09_Отслеживание_заказа_1920', trk2: '02_Покупка/10_Отслеживание_результат_1920',
  login: '03_Вход_и_регистрация/01_Вход_1920', loginErr: '03_Вход_и_регистрация/02_Вход_ошибка_1920', reg: '03_Вход_и_регистрация/03_Регистрация_1920', code: '03_Вход_и_регистрация/04_Подтверждение_почты_1920',
  forgot: '03_Вход_и_регистрация/05_Восстановление_пароля_1920', reset: '03_Вход_и_регистрация/06_Новый_пароль_1920',
  acc: '04_Личный_кабинет/01_Обзор_1920', orders: '04_Личный_кабинет/02_Мои_заказы_1920', order: '04_Личный_кабинет/03_Заказ_подробно_1920', returns: '04_Личный_кабинет/04_Возвраты_1920',
  addr: '04_Личный_кабинет/05_Адреса_1920', notif: '04_Личный_кабинет/06_Уведомления_1920', wish: '04_Личный_кабинет/07_Избранное_1920', viewed: '04_Личный_кабинет/08_Просмотренные_1920',
  reviews: '04_Личный_кабинет/09_Мои_отзывы_1920', support: '04_Личный_кабинет/10_Поддержка_1920', seller: '04_Личный_кабинет/11_Стать_продавцом_1920', settings: '04_Личный_кабинет/12_Настройки_1920',
  shop: '05_Кабинеты_сотрудников/01_Продавец_Мой_магазин_1920', shopOrders: '05_Кабинеты_сотрудников/02_Продавец_Заказы_1920', shopStats: '05_Кабинеты_сотрудников/03_Продавец_Статистика_1920',
  shopNew: '05_Кабинеты_сотрудников/04_Продавец_Новый_товар_1920', shopEdit: '05_Кабинеты_сотрудников/05_Продавец_Редактирование_товара_1920', stock: '05_Кабинеты_сотрудников/06_Склад_Остатки_1920',
  courier: '05_Кабинеты_сотрудников/07_Курьер_Доставки_1920', desk: '05_Кабинеты_сотрудников/08_Поддержка_Обращения_1920', deskRet: '05_Кабинеты_сотрудников/09_Поддержка_Возвраты_1920',
  pre: '09_Состояния_и_переходы/01_Заставка_1920', megaB: '09_Состояния_и_переходы/02_Мега-меню_Бренды_1920', megaC: '09_Состояния_и_переходы/03_Мега-меню_Каталог_1920',
  search: '09_Состояния_и_переходы/04_Поиск_подсказки_1920', searchR: '09_Состояния_и_переходы/05_Поиск_результаты_1920', theme: '09_Состояния_и_переходы/06_Выбор_темы_1920',
  cur: '09_Состояния_и_переходы/07_Выбор_валюты_1920', quick: '09_Состояния_и_переходы/08_Быстрый_просмотр_1920', sizes: '09_Состояния_и_переходы/09_Таблица_размеров_1920',
  cmpBar: '09_Состояния_и_переходы/10_Сравнение_панель_1920', light: '09_Состояния_и_переходы/11_Главная_тема_Светлая_1920', dark: '09_Состояния_и_переходы/12_Главная_тема_Тёмная_1920',
  mini: '09_Состояния_и_переходы/15_Мини-корзина_1920', notifP: '09_Состояния_и_переходы/16_Уведомления_1920', added: '09_Состояния_и_переходы/17_Товар_добавлен_в_корзину_1920',
  hover: '09_Состояния_и_переходы/24_Каталог_наведение_на_карточку_1920',
  e403: '08_Ошибки/01_Ошибка_403_1920', e404: '08_Ошибки/02_Ошибка_404_1920', e500: '08_Ошибки/03_Ошибка_500_1920',
};
const admin = fs.existsSync(path.join(PROTO, '06_Админ-панель')) ? fs.readdirSync(path.join(PROTO, '06_Админ-панель')).filter((f) => f.endsWith('.svg')).sort().map((f) => '06_Админ-панель/' + f.replace('.svg', '')) : [];
const dirList = (d) => (fs.existsSync(path.join(PROTO, d)) ? fs.readdirSync(path.join(PROTO, d)).filter((f) => f.endsWith('.svg')).sort().map((f) => d + '/' + f.replace('.svg', '')) : []);
const allBrands = dirList('10_Страницы_брендов'), allStories = dirList('11_Истории_брендов');
const infos = fs.existsSync(path.join(PROTO, '07_Информационные_страницы')) ? fs.readdirSync(path.join(PROTO, '07_Информационные_страницы')).filter((f) => f.endsWith('.svg')).sort().map((f) => '07_Информационные_страницы/' + f.replace('.svg', '')) : [];

// Сценарии: chain — цепочка, bus — из одного экрана в несколько
const ROWS = [
  { title: 'Сценарий покупки', type: 'chain', steps: [[F.home, ''], [F.catalog, 'Каталог в шапке'], [F.product, 'Клик по карточке'], [F.added, 'Размер → В корзину'], [F.cart, 'Перейти в корзину'], [F.co1, 'Оформить заказ']] },
  { title: 'Оформление заказа — 5 шагов', type: 'chain', steps: [[F.co1, ''], [F.co2, 'Далее'], [F.co3, 'Далее'], [F.co4, 'Далее'], [F.co5, 'Далее'], [F.done, 'Оформить заказ']] },
  { title: 'После заказа', type: 'chain', steps: [[F.done, ''], [F.orders, 'Мои заказы'], [F.order, 'Клик по заказу'], [F.trk2, 'Отследить посылку'], [F.support, 'Вопрос по заказу']] },
  { title: 'Шапка сайта — с любой страницы', type: 'bus', from: F.home, to: [[F.megaB, 'Бренды ⌄'], [F.megaC, 'Каталог ⌄'], [F.search, 'Иконка поиска'], [F.searchR, 'Ввод запроса'], [F.mini, 'Иконка корзины'], [F.notifP, 'Колокольчик'], [F.theme, 'Иконка темы'], [F.cur, 'Валюта'], [F.wish, 'Сердце'], [F.cmp, 'Сравнение'], [F.login, 'Профиль (гость)'], [F.acc, 'Профиль (вошёл)']] },
  { title: 'Каталог и товар', type: 'bus', from: F.catalog, to: [[F.hover, 'Наведение на карточку'], [F.catf, 'Фильтр по бренду'], [F.empty, 'Фильтр без результатов'], [F.quick, 'Быстрый просмотр (наведение)'], [F.cmpBar, 'Добавить к сравнению'], [F.cmp, 'Сравнить'], [F.product, 'Клик по карточке'], [F.sizes, 'Таблица размеров (на товаре)']] },
  { title: 'Бренды и истории', type: 'bus', from: F.home, to: [[F.brand, 'Плитка бренда'], [F.brand2, 'Мега-меню бренда'], [F.hist, 'Истории'], [F.story, 'История бренда'], [F.catf, 'Каталог бренда'], [F.cmp0, 'Сравнение пустое']] },
  { title: 'Все 15 модных домов — из мега-меню «Бренды»', type: 'bus', from: F.megaB, to: allBrands.map((a) => [a, a.split('/')[1].replace(/^\d+_Бренд_/, '').replace(/_1920$/, '').replace(/_/g, ' ')]) },
  { title: 'Истории брендов — со страницы «Истории»', type: 'bus', from: F.hist, to: allStories.map((a) => [a, a.split('/')[1].replace(/^\d+_История_/, '').replace(/_1920$/, '').replace(/_/g, ' ')]) },
  { title: 'Вход и регистрация', type: 'bus', from: F.login, to: [[F.loginErr, 'Неверный пароль'], [F.reg, 'Вкладка Регистрация'], [F.code, 'Код из письма'], [F.acc, 'Успешный вход'], [F.forgot, 'Забыли пароль?'], [F.reset, 'Код + новый пароль']] },
  { title: 'Корзина', type: 'bus', from: F.cart, to: [[F.cart0, 'Удалить всё'], [F.login, 'Оформить (гость)'], [F.co1, 'Оформить (вошёл)'], [F.catalog, 'В каталог'], [F.mini, 'Мини-корзина'], [F.product, 'Клик по товару']] },
  { title: 'Личный кабинет покупателя', type: 'bus', from: F.acc, to: dirList('04_Личный_кабинет').slice(1).map((a) => [a, a.split('/')[1].replace(/^\d+_/, '').replace(/_1920$/, '').replace(/_/g, ' ')]) },
  { title: 'Кабинеты сотрудников — вход под ролью', type: 'bus', from: F.login, to: [...dirList('05_Кабинеты_сотрудников').map((a) => [a, a.split('/')[1].replace(/^\d+_/, '').replace(/_1920$/, '').replace(/_/g, ' ')]), [admin[0], 'Админ-панель']] },
  { title: 'Админ-панель', type: 'bus', from: admin[0], to: admin.slice(1).map((a) => [a, a.split('/')[1].replace(/^\d+_/, '').replace(/_1920$/, '').replace(/_/g, ' ')]) },
  { title: 'Окна, подтверждения и пустые состояния', type: 'bus', from: F.product, to: [
    ['09_Состояния_и_переходы/19_Галерея_на_весь_экран_1920', 'На весь экран'], ['09_Состояния_и_переходы/20_Окно_Войдите_1920', 'Сердце у гостя'], ['09_Состояния_и_переходы/21_Лукбук_коллекции_1920', 'Лукбук (бренд)'],
    ['09_Состояния_и_переходы/22_Очистить_корзину_подтверждение_1920', 'Очистить корзину'], ['09_Состояния_и_переходы/23_Очистить_сравнение_подтверждение_1920', 'Очистить сравнение'],
    ['09_Состояния_и_переходы/18_Поиск_ничего_не_найдено_1920', 'Поиск без результатов'], [F.empty, 'Фильтр без результатов'], ['04_Личный_кабинет/18_Избранное_пустое_1920', 'Избранное пустое']] },
  { title: 'Подвал — информация', type: 'bus', from: F.home, to: infos.map((a) => [a, a.split('/')[1].replace(/^\d+_/, '').replace(/_1920$/, '').replace(/_/g, ' ')]) },
  { title: 'Ошибки и темы', type: 'bus', from: F.e404, to: [[F.home, 'На главную'], [F.catalog, 'В каталог'], [F.e403, 'Нет доступа'], [F.e500, 'Ошибка сервера'], [F.light, 'Светлая тема'], [F.dark, 'Тёмная тема'], [F.pre, 'Заставка при входе']] },
];

const nice = (f) => f.split('/')[1].replace(/^\d+_/, '').replace(/_1920$/, '').replace(/_/g, ' ');

async function thumb(f) {
  const p = path.join(PREV, f + '.jpg');
  if (!fs.existsSync(p)) return null;
  const m = await sharp(p).metadata();
  const h = Math.min(m.height, Math.round((m.width * 1080) / 1920));
  const buf = await sharp(p).extract({ left: 0, top: 0, width: m.width, height: h }).resize(400, 225).jpeg({ quality: 72 }).toBuffer();
  return 'data:image/jpeg;base64,' + buf.toString('base64');
}

(async () => {
  const W = 1920, PAD = 100, CW = 200, CH = 113, CAP = 46;
  const thumbs = {};
  for (const r of ROWS) for (const f of [r.from, ...(r.steps || []).map((s) => s[0]), ...(r.to || []).map((s) => s[0])]) if (f && !(f in thumbs)) thumbs[f] = await thumb(f);

  let y = 360;
  const cards = [], arrows = [], labels = [], titles = [];
  const card = (f, x, y, rowName, i) => cards.push({ f, x, y, name: `${rowName}_${i}` });
  ROWS.forEach((r, ri) => {
    const rowName = `Сценарий_${String(ri + 1).padStart(2, '0')}`;
    titles.push({ y, text: `${String(ri + 1).padStart(2, '0')} — ${r.title}`, name: rowName });
    y += 56;
    if (r.type === 'chain') {
      const gap = (W - 2 * PAD - r.steps.length * CW) / (r.steps.length - 1);
      r.steps.forEach(([f, lab], i) => {
        const x = PAD + i * (CW + gap);
        card(f, x, y + 30, rowName, i + 1);
        if (i > 0) {
          const x1 = x - gap + 8, x2 = x - 8, yy = y + 30 + CH / 2;
          arrows.push({ d: `M${x1} ${yy} H${x2}`, head: [x2, yy, 'r'] });
          labels.push({ x: x1, w: gap - 16, y: yy - 42, text: lab });
        }
      });
      y += 30 + CH + CAP + 60;
    } else {
      const per = 6;
      const tx0 = PAD + CW + 80;
      const tgap = (W - PAD - tx0 - per * CW) / (per - 1);
      card(r.from, PAD, y + 50, rowName, 0);
      const rows = Math.ceil(r.to.length / per);
      for (let k = 0; k < rows; k++) {
        const busY = y + 20 + k * (CH + CAP + 80);
        const items = r.to.slice(k * per, k * per + per);
        const lastX = tx0 + (items.length - 1) * (CW + tgap) + CW / 2;
        const startX = PAD + CW;
        arrows.push({ d: k === 0 ? `M${startX} ${y + 50 + CH / 2} H${PAD + CW + 40} V${busY} H${lastX}` : `M${PAD + CW + 40} ${y + 20} V${busY} H${lastX}` });
        items.forEach(([f, lab], i) => {
          const x = tx0 + i * (CW + tgap);
          const cx = x + CW / 2;
          arrows.push({ d: `M${cx} ${busY} V${busY + 22}`, head: [cx, busY + 26, 'd'] });
          labels.push({ x: x, w: CW, y: busY + 3, text: lab, under: true });
          card(f, x, busY + 30, rowName, k * per + i + 1);
        });
      }
      y += 20 + rows * (CH + CAP + 80) + 30;
    }
  });
  const H = y + 80;

  const head = (x, y, dir) => (dir === 'r' ? `M${x - 9} ${y - 5} L${x} ${y} L${x - 9} ${y + 5}` : `M${x - 5} ${y - 9} L${x} ${y} L${x + 5} ${y - 9}`);
  const html = `<div data-layer="Карта_переходов" style="position:relative;width:${W}px;height:${H}px;background:#0b0b0c;color:#ede6da;font-family:var(--font-body)">
    <div data-layer="Заголовок_страницы" style="position:absolute;left:${PAD}px;top:96px;width:1720px;display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1px solid rgba(237,230,218,.22);padding-bottom:36px">
      <div data-layer="Название"><span data-layer="Логотип" style="font-family:var(--font-gothic);font-size:40px">Amfibia</span><h1 data-layer="Заголовок" style="font-family:var(--font-display);font-weight:300;font-size:96px;line-height:1;margin:14px 0 0">Карта переходов</h1></div>
      <p data-layer="Описание" style="max-width:640px;color:#bdb6aa;font-size:15px;line-height:1.6;margin:0">Как пользователь переходит между экранами прототипа. Над стрелкой — действие (кнопка, ссылка, иконка). Все ${Object.keys(thumbs).length} экранов — отдельные фреймы 1920 px в разделе «3_Прототип».</p>
    </div>
    ${titles.map((t) => `<p data-layer="Заголовок_${t.name}" style="position:absolute;left:${PAD}px;top:${t.y}px;margin:0;font-family:var(--font-display);font-size:34px;font-weight:300;white-space:nowrap">${t.text}</p>`).join('')}
    <svg data-layer="Стрелки" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="position:absolute;left:0;top:0;overflow:visible">${arrows.map((a) => `<path d="${a.d}" fill="none" stroke="#d9707f" stroke-width="1.5" stroke-linejoin="round"/>${a.head ? `<path d="${head(...a.head)}" fill="none" stroke="#d9707f" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>` : ''}`).join('')}</svg>
    ${labels.map((l, i) => `<p data-layer="Действие_${i + 1}" style="position:absolute;left:${l.x}px;top:${l.y}px;width:${l.w}px;margin:0;font-family:var(--font-mono);font-size:11px;line-height:1.35;letter-spacing:.04em;color:#d9707f;text-align:${l.under ? 'left' : 'center'};${l.under ? 'padding-left:' + (l.w / 2 + 8) + 'px;box-sizing:border-box;' : ''}">${l.text}</p>`).join('')}
    ${cards.map((c) => `<div data-layer="Экран_${nice(c.f).replace(/ /g, '_')}" style="position:absolute;left:${c.x}px;top:${c.y}px;width:${CW}px">
      ${thumbs[c.f] ? `<img data-layer="Миниатюра" src="${thumbs[c.f]}" style="display:block;width:${CW}px;height:${CH}px;object-fit:cover;border:1px solid rgba(237,230,218,.22)">` : `<div data-layer="Миниатюра" style="width:${CW}px;height:${CH}px;border:1px dashed rgba(237,230,218,.3)"></div>`}
      <p data-layer="Название_экрана" style="margin:8px 0 0;font-size:12px;line-height:1.35;color:#ede6da">${nice(c.f)}</p>
      <p data-layer="Раздел" style="margin:2px 0 0;font-family:var(--font-mono);font-size:10px;color:#8a857d">${c.f.split('/')[0].replace(/^\d+_/, '').replace(/_/g, ' ')}</p></div>`).join('')}
  </div>`;

  const browser = await L.chromium.launch();
  const ctx = await L.newContext(browser);
  const page = await ctx.newPage();
  await page.goto(L.B + '/about', { waitUntil: 'networkidle' });
  await page.evaluate((html) => {
    const sprite = [...document.body.children].find((e) => e.tagName.toLowerCase() === 'svg' && e.querySelector('symbol'));
    document.body.className = '';
    document.body.innerHTML = html;
    if (sprite) document.body.prepend(sprite);
    const st = document.createElement('style');
    st.textContent = 'body{margin:0;background:#0b0b0c!important}';
    document.head.appendChild(st);
  }, html);
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => (i.onload = i.onerror = r))))); });
  await L.capture(page, { frameName: 'Карта_переходов', outFile: path.join(DOCS, '5_Карта_переходов', 'Карта_переходов.svg'), height: H });
  await browser.close();

  // Текстовый список переходов (для инструкции)
  const lines = [];
  ROWS.forEach((r, ri) => {
    lines.push(`\n${String(ri + 1).padStart(2, '0')}. ${r.title}`);
    if (r.type === 'chain') r.steps.slice(1).forEach(([f, lab], i) => lines.push(`    ${nice(r.steps[i][0])}  —[ ${lab} ]→  ${nice(f)}`));
    else r.to.forEach(([f, lab]) => lines.push(`    ${nice(r.from)}  —[ ${lab} ]→  ${nice(f)}`));
  });
  fs.writeFileSync(path.join(__dirname, 'transitions.txt'), lines.join('\n'));
  console.log('переходов:', lines.filter((l) => l.includes('→')).length);
})().catch((e) => { console.error(e); process.exit(1); });
