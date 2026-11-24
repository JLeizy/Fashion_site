// Все кадры прототипа: страницы, состояния, роли. Запуск: node pages.cjs [фильтр по имени]
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');

const OUT = '/home/user/Fashion_site/docs/lab25/3_Прототип';
const only = process.argv[2] ? new RegExp(process.argv[2], 'i') : null;
const log = [];

async function api(page, method, url, body) {
  return page.evaluate(async ({ method, url, body }) => {
    const t = document.querySelector('meta[name="csrf-token"]')?.content || '';
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': t }, body: body ? JSON.stringify(body) : undefined });
    let j = null;
    try { j = await r.json(); } catch {}
    return { status: r.status, json: j };
  }, { method, url, body });
}

const noAnim = (page) => page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
const wait = (page, ms = 500) => page.waitForTimeout(ms);
const click = async (page, sel, opts = {}) => { await page.locator(sel).first().click({ timeout: 8000, ...opts }); await wait(page, opts.ms || 700); };

// Обрезать длинные списки, чтобы фрейм оставался разумной высоты
const trimTo = (sel, keep) => `document.querySelectorAll(${JSON.stringify(sel)}).forEach((e, i) => { if (i >= ${keep}) e.remove(); });`;

async function shot(ctx, f) {
  if (only && !only.test(f.folder + '/' + f.file)) return;
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  try {
    if (f.url) await page.goto(L.B + f.url, { waitUntil: 'domcontentloaded' });
    await L.settle(page, { scroll: !f.viewport });
    await noAnim(page);
    if (f.setup) await f.setup(page);
    await wait(page, 400);
    const name = f.file.replace(/\.svg$/, '');
    const res = await L.capture(page, {
      frameName: name, outFile: path.join(OUT, f.folder, f.file),
      prep: f.prep ? new Function(f.prep) : null, viewportOnly: !!f.viewport, keepCompareBar: !!f.keepCompareBar,
    });
    log.push({ folder: f.folder, file: f.file, url: f.url, h: res.H, ...res.stats });
  } catch (e) {
    console.log('✗', f.file, e.message.split('\n')[0]);
    log.push({ folder: f.folder, file: f.file, error: e.message.split('\n')[0] });
  }
  await page.close();
}

(async () => {
  const browser = await L.chromium.launch();
  const guest = await L.newContext(browser);
  const gp = await guest.newPage();
  await gp.goto(L.B + '/');

  // Подбор товара для страницы товара: одежда с размерами, двумя фото и отзывами
  const list = (await (await gp.request.get(L.B + '/api/products?sort=popular&inStock=1&limit=60')).json()).items;
  let hero = null;
  const inStock = [];
  for (const p of list) {
    const full = (await (await gp.request.get(L.B + '/api/products/' + p.id)).json()).product;
    const vs = (full.variants || []).filter((v) => v.available > 0);
    if (vs.length) inStock.push({ id: full.id, variantId: vs[Math.floor(vs.length / 2)].variantId, cat: full.category?.slug });
    if (!hero && full.variants.length >= 4 && full.images.length >= 2 && full.reviewsCount >= 2 && vs.length >= 3) hero = full;
  }
  hero = hero || list[0];
  console.log('Товар для страницы товара:', hero.id, hero.name.ru, 'вариантов в наличии', inStock.length);
  await gp.close();

  // ---------- Гость ----------
  const V = '01_Витрина';
  await shot(guest, { folder: V, file: '01_Главная_1920.svg', url: '/' });
  await shot(guest, { folder: V, file: '02_Каталог_1920.svg', url: '/catalog' });
  await shot(guest, { folder: V, file: '03_Каталог_фильтр_Balenciaga_1920.svg', url: '/catalog?brand=balenciaga&sort=price_desc', prep: trimTo('.catalog__grid > *', 12) });
  await shot(guest, { folder: V, file: '04_Товар_1920.svg', url: '/product/' + hero.id, setup: async (p) => { await p.locator('[data-pp-sizes] [data-variant]:not([disabled])').nth(1).click().catch(() => {}); await wait(p, 300); } });
  await shot(guest, { folder: V, file: '05_Истории_брендов_1920.svg', url: '/histories' });

  const ER = '08_Ошибки';
  await shot(guest, { folder: ER, file: '01_Ошибка_403_1920.svg', url: '/403' });
  await shot(guest, { folder: ER, file: '02_Ошибка_404_1920.svg', url: '/404' });
  await shot(guest, { folder: ER, file: '03_Ошибка_500_1920.svg', url: '/500' });

  const INF = '07_Информационные_страницы';
  const infos = [['delivery', 'Доставка_и_оплата'], ['returns', 'Возврат_и_обмен'], ['size-guide', 'Таблица_размеров'], ['about', 'О_нас'], ['contacts', 'Контакты'], ['privacy', 'Политика_конфиденциальности']];
  for (const [i, [u, n]] of infos.entries()) await shot(guest, { folder: INF, file: `0${i + 1}_${n}_1920.svg`, url: '/' + u });

  const AU = '03_Вход_и_регистрация';
  await shot(guest, { folder: AU, file: '01_Вход_1920.svg', url: '/auth', setup: async (p) => { await p.fill('#login-email', 'buyer@amfibia.by'); await p.fill('#login-password', 'Amfibia2026'); } });
  await shot(guest, {
    folder: AU, file: '02_Вход_ошибка_1920.svg', url: '/auth',
    setup: async (p) => { await p.fill('#login-email', 'buyer@amfibia.by'); await p.fill('#login-password', 'wrong-pass'); await click(p, '[data-form="login"] [type="submit"]', { ms: 1500 }); },
  });
  await shot(guest, {
    folder: AU, file: '03_Регистрация_1920.svg', url: '/auth',
    setup: async (p) => {
      await click(p, '[data-auth-tab="register"]', { ms: 900 });
      await p.evaluate(() => {
        const inner = document.querySelector('[data-flip-inner]');
        const front = document.querySelector('[data-face="login"]');
        const back = document.querySelector('[data-face="register"]');
        if (inner) inner.style.transform = 'none';
        if (front) front.style.display = 'none';
        if (back) { back.style.transform = 'none'; back.style.position = 'relative'; back.style.inset = 'auto'; back.style.backfaceVisibility = 'visible'; }
      });
      const f = async (sel, v) => p.locator(sel).first().fill(v).catch(() => {});
      await f('[data-form="register"] [name="firstName"]', 'Ева');
      await f('[data-form="register"] [name="lastName"]', 'Лисовская');
      await f('[data-form="register"] [name="email"]', 'eva@example.com');
      await f('[data-form="register"] [name="password"]', 'Amfibia2026!');
      await f('[data-form="register"] [name="passwordConfirm"]', 'Amfibia2026!');
      await wait(p, 400);
    },
  });
  const showView = (v) => async (p) => { await p.evaluate((v) => document.querySelectorAll('[data-view]').forEach((e) => (e.hidden = e.dataset.view !== v)), v); await wait(p, 300); };
  await shot(guest, { folder: AU, file: '04_Подтверждение_почты_1920.svg', url: '/auth', setup: async (p) => { await showView('code')(p); await p.evaluate(() => { const ins = document.querySelectorAll('[data-view="code"] input'); '4827'.split('').forEach((d, i) => ins[i] && (ins[i].value = d)); }); } });
  await shot(guest, { folder: AU, file: '05_Восстановление_пароля_1920.svg', url: '/auth', setup: async (p) => { await showView('forgot')(p); await p.locator('[data-form="forgot"] [name="email"]').fill('buyer@amfibia.by').catch(() => {}); } });
  await shot(guest, { folder: AU, file: '06_Новый_пароль_1920.svg', url: '/auth', setup: showView('reset') });

  // Состояния (экран 1920×1080)
  const ST = '09_Состояния_и_переходы';
  await shot(guest, {
    folder: ST, file: '01_Заставка_1920.svg', url: '/', viewport: true,
    setup: async (p) => {
      await p.addStyleTag({ content: 'html .preloader[data-preloader]{display:grid!important;opacity:1!important;visibility:visible!important;clip-path:none!important}' });
      await p.evaluate(() => { const b = document.querySelector('[data-preloader-bar]'); if (b) { b.style.transform = 'scaleX(0.62)'; b.style.width = '100%'; } const lg = document.querySelector('.preloader__logo'); if (lg) { const t = document.createElement('div'); t.className = 'preloader__word'; t.textContent = 'Amfibia'; t.style.cssText = 'font-family:var(--font-gothic);font-size:190px;line-height:1.1;color:transparent;-webkit-text-stroke:1.2px #ede6da;text-align:center'; lg.replaceWith(t); } });
    },
  });
  await shot(guest, { folder: ST, file: '02_Мега-меню_Бренды_1920.svg', url: '/', viewport: true, setup: async (p) => { await click(p, '[data-mega-toggle="brands"]', { ms: 1200 }); await p.locator('.mega__brands a, .mega__brands button').nth(3).hover().catch(() => {}); await wait(p, 900); } });
  await shot(guest, { folder: ST, file: '03_Мега-меню_Каталог_1920.svg', url: '/', viewport: true, setup: async (p) => click(p, '[data-mega-toggle="catalog"]', { ms: 1200 }) });
  await shot(guest, { folder: ST, file: '04_Поиск_подсказки_1920.svg', url: '/', viewport: true, setup: async (p) => click(p, '.header__actions [data-search-open]', { ms: 1000 }) });
  await shot(guest, { folder: ST, file: '05_Поиск_результаты_1920.svg', url: '/', viewport: true, setup: async (p) => { await click(p, '.header__actions [data-search-open]', { ms: 800 }); await p.locator('.search__input, [data-search-input], .search input').first().fill('сумка balenciaga'); await wait(p, 2200); } });
  await shot(guest, { folder: ST, file: '06_Выбор_темы_1920.svg', url: '/', viewport: true, setup: async (p) => click(p, '[data-theme-toggle]', { ms: 600 }) });
  await shot(guest, { folder: ST, file: '07_Выбор_валюты_1920.svg', url: '/', viewport: true, setup: async (p) => click(p, '.dropdown__toggle', { ms: 600 }) });
  await shot(guest, { folder: ST, file: '08_Быстрый_просмотр_1920.svg', url: '/catalog', viewport: true, setup: async (p) => { await p.locator('.p-card').first().hover(); await click(p, '.p-card [data-card-quick]', { ms: 1800, force: true }); } });
  await shot(guest, { folder: ST, file: '09_Таблица_размеров_1920.svg', url: '/product/' + hero.id, viewport: true, setup: async (p) => click(p, '[data-size-chart]', { ms: 1500 }) });
  await shot(guest, { folder: ST, file: '10_Сравнение_панель_1920.svg', url: '/catalog', viewport: true, keepCompareBar: true, setup: async (p) => {
    const btns = p.locator('.p-card [data-card-compare], .p-card [data-compare]');
    const n = await btns.count();
    for (let i = 0; i < Math.min(3, n); i++) { await btns.nth(i).click({ force: true }).catch(() => {}); await wait(p, 400); }
    await p.evaluate(() => window.scrollTo(0, 0));
  } });
  for (const [theme, label] of [['light', 'Светлая'], ['dark', 'Тёмная']]) {
    await shot(guest, { folder: ST, file: `${theme === 'light' ? '11' : '12'}_Главная_тема_${label}_1920.svg`, url: '/', viewport: true, setup: async (p) => { await p.evaluate((t) => { document.documentElement.dataset.theme = t; localStorage.setItem('amf:theme', t); }, theme); await wait(p, 600); } });
    await shot(guest, { folder: ST, file: `${theme === 'light' ? '13' : '14'}_Каталог_тема_${label}_1920.svg`, url: '/catalog', viewport: true, setup: async (p) => { await p.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme); await wait(p, 600); } });
  }
  await shot(guest, { folder: '01_Витрина', file: '06_Сравнение_пустое_1920.svg', url: '/compare', setup: async (p) => { await p.evaluate(() => { for (const k of Object.keys(localStorage)) if (/compare/i.test(k)) localStorage.removeItem(k); }); await p.reload({ waitUntil: 'networkidle' }); await L.settle(p); } });
  await shot(guest, { folder: '02_Покупка', file: '09_Отслеживание_заказа_1920.svg', url: '/tracking' });
  await guest.close();

  // ---------- Покупатель ----------
  const buyer = await L.newContext(browser);
  const bp = await buyer.newPage();
  await L.login(bp, 'buyer@amfibia.by');
  await api(bp, 'DELETE', '/api/cart');
  await api(bp, 'DELETE', '/api/compare');
  // Трек-номер для страницы отслеживания
  const orders = (await api(bp, 'GET', '/api/orders?status=all&limit=50')).json;
  const olist = orders?.items || orders?.orders || [];
  const tracked = olist.find((o) => o.trackingNumber && /in_transit|handed|arrived/.test(o.status)) || olist.find((o) => o.trackingNumber);
  const detailOrder = olist.find((o) => o.status === 'in_transit') || olist[0];
  console.log('Заказов у покупателя:', olist.length, 'трек:', tracked?.trackingNumber, 'деталь:', detailOrder?.id);

  const P = '02_Покупка';
  await shot(buyer, { folder: P, file: '02_Корзина_пустая_1920.svg', url: '/cart' });
  // Корзина: 3 вещи
  const picks = [];
  const usedCats = new Set();
  for (const it of inStock) { if (picks.length >= 3) break; if (it.id === hero.id || usedCats.has(it.cat)) continue; picks.push(it); usedCats.add(it.cat); }
  for (const it of [{ variantId: hero.variants.find((v) => v.available > 0).variantId }, ...picks.slice(0, 2)]) await api(bp, 'POST', '/api/cart/items', { variantId: it.variantId, quantity: 1 });
  for (const it of [hero, ...picks].slice(0, 3)) await api(bp, 'POST', '/api/compare', { productId: it.id });
  await bp.close();

  await shot(buyer, { folder: P, file: '01_Корзина_1920.svg', url: '/cart' });
  await shot(buyer, { folder: ST, file: '15_Мини-корзина_1920.svg', url: '/', viewport: true, setup: async (p) => click(p, '[data-cart-open]', { ms: 1400 }) });
  await shot(buyer, { folder: ST, file: '16_Уведомления_1920.svg', url: '/', viewport: true, setup: async (p) => click(p, '[data-notif-toggle]', { ms: 1400 }) });
  await shot(buyer, { folder: ST, file: '17_Товар_добавлен_в_корзину_1920.svg', url: '/product/' + picks[2]?.id || hero.id, viewport: true, setup: async (p) => {
    await p.locator('[data-pp-sizes] [data-variant]:not([disabled])').first().click().catch(() => {});
    await p.locator('[data-pp-add]').click().catch(() => {});
    await wait(p, 1500);
  } });
  await shot(buyer, { folder: '01_Витрина', file: '07_Сравнение_1920.svg', url: '/compare' });

  // Оформление: 5 шагов
  const coSteps = [
    ['03_Оформление_шаг1_Контакты_1920.svg', 1],
    ['04_Оформление_шаг2_Адрес_1920.svg', 2],
    ['05_Оформление_шаг3_Доставка_1920.svg', 3],
    ['06_Оформление_шаг4_Оплата_1920.svg', 4],
    ['07_Оформление_шаг5_Подтверждение_1920.svg', 5],
  ];
  for (const [file, step] of coSteps) {
    await shot(buyer, {
      folder: P, file, url: '/checkout',
      setup: async (p) => {
        await p.waitForSelector('#co-name', { timeout: 10000 }).catch(() => {});
        if (step >= 2) await click(p, '[data-step="1"] [type="submit"]', { ms: 900 });
        if (step >= 3) await click(p, '[data-step="2"] [type="submit"]', { ms: 900 });
        if (step >= 3) await p.locator('[data-delivery-list] label.opt').first().click().catch(() => {});
        if (step >= 4) await click(p, '[data-step="3"] [type="submit"]', { ms: 900 });
        if (step >= 4) {
          await p.locator('[data-payment-list] label.opt').first().click().catch(() => {});
          await wait(p, 400);
          for (const [s, v] of [['#cc-number', '4242 4242 4242 4242'], ['#cc-exp', '12/30'], ['#cc-cvc', '123'], ['#cc-name', 'EVA LISOVSKAYA']]) await p.locator(s).fill(v).catch(() => {});
        }
        if (step >= 5) { await click(p, '[data-step="4"] [type="submit"]', { ms: 900 }); await p.locator('[data-step="5"] input[name="agree"]').check({ force: true }).catch(() => {}); }
        await p.evaluate(() => window.scrollTo(0, 0));
      },
    });
  }
  // Оформить настоящий заказ → страница успеха
  await shot(buyer, {
    folder: P, file: '08_Заказ_оформлен_1920.svg', url: '/checkout',
    setup: async (p) => {
      await p.waitForSelector('#co-name').catch(() => {});
      await click(p, '[data-step="1"] [type="submit"]');
      await click(p, '[data-step="2"] [type="submit"]');
      await p.locator('[data-delivery-list] label.opt').first().click();
      await click(p, '[data-step="3"] [type="submit"]');
      const pay = p.locator('[data-payment-list] label.opt');
      const n = await pay.count();
      let ok = false;
      for (let i = 0; i < n && !ok; i++) if (/налич|ерип|получен/i.test(await pay.nth(i).innerText())) { await pay.nth(i).click(); ok = true; }
      if (!ok) { await pay.first().click(); for (const [s, v] of [['#cc-number', '4242 4242 4242 4242'], ['#cc-exp', '12/30'], ['#cc-cvc', '123'], ['#cc-name', 'EVA LISOVSKAYA']]) await p.locator(s).fill(v).catch(() => {}); }
      await click(p, '[data-step="4"] [type="submit"]');
      await p.locator('[data-step="5"] input[name="agree"]').check({ force: true });
      await p.locator('[data-place]').click();
      await p.waitForURL(/checkout\/success/, { timeout: 25000 });
      await L.settle(p);
    },
  });
  if (tracked) await shot(buyer, { folder: P, file: '10_Отслеживание_результат_1920.svg', url: '/tracking?number=' + encodeURIComponent(tracked.trackingNumber), setup: async (p) => {
    const inp = p.locator('#trk-number').first();
    if (await inp.count()) { await inp.fill(tracked.trackingNumber); await p.keyboard.press('Enter'); await wait(p, 1800); }
  } });

  const A = '04_Личный_кабинет';
  const accs = [
    ['', 'Обзор'], ['orders', 'Мои_заказы'], [detailOrder ? 'orders/' + detailOrder.id : 'orders', 'Заказ_подробно'], ['returns', 'Возвраты'], ['addresses', 'Адреса'],
    ['notifications', 'Уведомления'], ['viewed', 'Просмотренные'], ['reviews', 'Мои_отзывы'], ['support', 'Поддержка'], ['seller', 'Стать_продавцом'], ['settings', 'Настройки'],
  ];
  let k = 1;
  for (const [u, n] of accs) {
    await shot(buyer, { folder: A, file: `${String(k).padStart(2, '0')}_${n}_1920.svg`, url: '/account' + (u ? '/' + u : ''), prep: trimTo('.olist > *', 8) + trimTo('.notif-list > *, .acc-notifs > *', 10) });
    k++;
    if (n === 'Уведомления') { await shot(buyer, { folder: A, file: `${String(k).padStart(2, '0')}_Избранное_1920.svg`, url: '/wishlist' }); k++; }
  }
  await buyer.close();

  // ---------- Сотрудники ----------
  const S = '05_Кабинеты_сотрудников';
  const staff = [
    ['official@amfibia.by', [['/account/shop', '01_Продавец_Мой_магазин'], ['/account/shop/orders', '02_Продавец_Заказы'], ['/account/shop/stats', '03_Продавец_Статистика'], ['/account/shop/products/new', '04_Продавец_Новый_товар']]],
    ['warehouse@amfibia.by', [['/account/stock', '06_Склад_Остатки']]],
    ['courier@amfibia.by', [['/account/deliveries', '07_Курьер_Доставки']]],
    ['support@amfibia.by', [['/account/desk', '08_Поддержка_Обращения'], ['/account/desk/returns', '09_Поддержка_Возвраты']]],
  ];
  for (const [email, frames] of staff) {
    const c = await L.newContext(browser);
    const p = await c.newPage();
    await L.login(p, email);
    if (email.startsWith('official')) {
      const r = await api(p, 'GET', '/api/seller/products?limit=5');
      const pid = (r.json?.rows || r.json?.items || r.json?.products || [])[0]?.id;
      if (pid) frames.push(['/account/shop/products/' + pid, '05_Продавец_Редактирование_товара']);
    }
    await p.close();
    for (const [u, n] of frames) await shot(c, { folder: S, file: n + '_1920.svg', url: u, prep: trimTo('.dt tbody tr, table tbody tr', 14) });
    await c.close();
  }

  // ---------- Админ-панель (владелец) ----------
  const AD = '06_Админ-панель';
  const owner = await L.newContext(browser);
  const op = await owner.newPage();
  await L.login(op, 'owner@amfibia.by');
  await op.close();
  const adm = [['', 'Дашборд'], ['products', 'Модерация_товаров'], ['reviews', 'Модерация_отзывов'], ['sellers', 'Заявки_продавцов'], ['orders', 'Заказы'], ['brands', 'Бренды'],
    ['collections', 'Коллекции'], ['categories', 'Категории'], ['banners', 'Баннеры'], ['users', 'Пользователи'], ['warehouses', 'Склады'], ['delivery', 'Способы_доставки'],
    ['payment', 'Способы_оплаты'], ['promos', 'Промокоды'], ['rates', 'Курсы_валют'], ['audit', 'Журнал_действий']];
  for (const [i, [u, n]] of adm.entries()) await shot(owner, { folder: AD, file: `${String(i + 1).padStart(2, '0')}_${n}_1920.svg`, url: '/admin' + (u ? '/' + u : ''), prep: trimTo('.dt tbody tr, table tbody tr', 14) + "document.head.insertAdjacentHTML('beforeend', '<style>.adm-side{position:relative!important;height:auto!important;min-height:100vh}.adm-nav{overflow:visible!important}</style>');" });
  await owner.close();

  fs.writeFileSync(path.join(__dirname, 'log-' + (process.argv[2] || 'all').replace(/\W/g, '') + '.json'), JSON.stringify(log, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
