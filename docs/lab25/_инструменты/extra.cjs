// Дополнительные окна: модальные окна, подтверждения, вложенные вкладки кабинетов, пустые состояния
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');

const OUT = '/home/user/Fashion_site/docs/lab25/3_Прототип';
const only = process.argv[2] ? new RegExp(process.argv[2], 'i') : null;

async function api(page, method, url, body) {
  return page.evaluate(async ({ method, url, body }) => {
    const t = document.querySelector('meta[name="csrf-token"]')?.content || '';
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': t }, body: body ? JSON.stringify(body) : undefined });
    let j = null;
    try { j = await r.json(); } catch {}
    return { status: r.status, json: j };
  }, { method, url, body });
}
const wait = (p, ms = 500) => p.waitForTimeout(ms);
const noAnim = (p) => p.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
const click = async (p, sel, ms = 1200) => { await p.locator(sel).first().click({ timeout: 8000, force: true }); await wait(p, ms); };
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
    if (f.viewport) await page.evaluate(() => window.scrollTo(0, 0));
    await L.capture(page, { frameName: f.file.replace(/\.svg$/, ''), outFile: path.join(OUT, f.folder, f.file), prep: f.prep ? new Function(f.prep) : null, viewportOnly: !!f.viewport });
  } catch (e) {
    console.log('✗', f.file, e.message.split('\n')[0]);
  }
  await page.close();
}

async function asRole(browser, email) {
  const c = await L.newContext(browser);
  const p = await c.newPage();
  await L.login(p, email);
  return { c, p };
}

(async () => {
  const browser = await L.chromium.launch();
  const V = '01_Витрина', ST = '09_Состояния_и_переходы', A = '04_Личный_кабинет', S = '05_Кабинеты_сотрудников', AD = '06_Админ-панель';

  // ---------- Гость ----------
  const guest = await L.newContext(browser);
  const gp = await guest.newPage();
  await gp.goto(L.B + '/');
  const list = (await (await gp.request.get(L.B + '/api/products?sort=popular&inStock=1&limit=30')).json()).items;
  let hero = null;
  for (const p of list) { const full = (await (await gp.request.get(L.B + '/api/products/' + p.id)).json()).product; if (full.images.length >= 2) { hero = full; break; } }
  await gp.close();

  await shot(guest, { folder: V, file: '08_Каталог_ничего_не_найдено_1920.svg', url: '/catalog?brand=supreme&price_min=1&price_max=50' });
  await shot(guest, { folder: ST, file: '18_Поиск_ничего_не_найдено_1920.svg', url: '/', viewport: true, setup: async (p) => { await click(p, '.header__actions [data-search-open]', 800); await p.locator('.search__input').fill('скафандр'); await wait(p, 2200); } });
  await shot(guest, { folder: ST, file: '19_Галерея_на_весь_экран_1920.svg', url: '/product/' + hero.id, viewport: true, setup: async (p) => click(p, '[data-gallery-expand]', 1500) });
  await shot(guest, { folder: ST, file: '20_Окно_Войдите_1920.svg', url: '/catalog', viewport: true, setup: async (p) => { await p.locator('.p-card').first().hover(); await click(p, '.p-card [data-card-wish]', 1500); } });
  await shot(guest, { folder: ST, file: '21_Лукбук_коллекции_1920.svg', url: '/brand/balenciaga', viewport: true, setup: async (p) => { await p.locator('[data-lookbook]').first().scrollIntoViewIfNeeded(); await click(p, '[data-lookbook]', 1800); await p.evaluate(() => window.scrollTo(0, 0)); } });
  await guest.close();

  // ---------- Покупатель ----------
  const { c: buyer, p: bp } = await asRole(browser, 'buyer@amfibia.by');
  const orders = (await api(bp, 'GET', '/api/orders?status=all&limit=50')).json;
  const olist = orders?.items || orders?.orders || orders?.rows || [];
  const cancellable = olist.find((o) => ['confirmed', 'assembling', 'new', 'pending'].includes(o.status));
  const delivered = olist.filter((o) => o.status === 'delivered');
  const tickets = (await api(bp, 'GET', '/api/tickets')).json;
  const tlist = tickets?.items || tickets?.tickets || tickets?.rows || [];
  // корзина и сравнение не пустые — для окон подтверждения
  const cart = (await api(bp, 'GET', '/api/cart')).json;
  if (!(cart?.items || []).length) { const v = hero.variants.find((x) => x.available > 0); if (v) await api(bp, 'POST', '/api/cart/items', { variantId: v.variantId, quantity: 1 }); }
  await api(bp, 'POST', '/api/compare', { productId: hero.id });
  let returnOrder = null;
  for (const o of delivered.slice(0, 8)) {
    await bp.goto(L.B + '/account/orders/' + o.id, { waitUntil: 'networkidle' });
    if (await bp.locator('[data-return]').count()) { returnOrder = o; break; }
  }
  console.log('отмена:', cancellable?.id, cancellable?.status, 'возврат:', returnOrder?.id, 'обращений:', tlist.length);
  await bp.close();

  if (cancellable) await shot(buyer, { folder: A, file: '13_Отмена_заказа_окно_1920.svg', url: '/account/orders/' + cancellable.id, viewport: true, setup: async (p) => click(p, '[data-cancel]', 1200) });
  if (returnOrder) await shot(buyer, { folder: A, file: '14_Оформление_возврата_окно_1920.svg', url: '/account/orders/' + returnOrder.id, viewport: true, setup: async (p) => click(p, '[data-return]', 1200) });
  await shot(buyer, { folder: A, file: '15_Новый_адрес_окно_1920.svg', url: '/account/addresses', viewport: true, setup: async (p) => click(p, '[data-add]', 1200) });
  await shot(buyer, { folder: A, file: '16_Удаление_адреса_подтверждение_1920.svg', url: '/account/addresses', viewport: true, setup: async (p) => click(p, '[data-del]', 1200) });
  if (tlist[0]) await shot(buyer, { folder: A, file: '17_Обращение_переписка_1920.svg', url: '/account/support/' + tlist[0].id });
  await shot(buyer, { folder: ST, file: '22_Очистить_корзину_подтверждение_1920.svg', url: '/cart', viewport: true, setup: async (p) => click(p, '[data-cart-clear]', 1200) });
  await shot(buyer, { folder: ST, file: '23_Очистить_сравнение_подтверждение_1920.svg', url: '/compare', viewport: true, setup: async (p) => click(p, '[data-cmp-clear]', 1200) });
  // Пустое избранное: временно убираем вещи и возвращаем после снимка
  {
    const p = await buyer.newPage();
    await p.goto(L.B + '/account');
    const w = (await api(p, 'GET', '/api/wishlist')).json;
    const ids = (w?.items || w?.products || w?.rows || []).map((x) => x.productId || x.id).filter(Boolean);
    for (const id of ids) await api(p, 'DELETE', '/api/wishlist/' + id);
    await p.close();
    await shot(buyer, { folder: A, file: '18_Избранное_пустое_1920.svg', url: '/wishlist' });
    const p2 = await buyer.newPage();
    await p2.goto(L.B + '/account');
    for (const id of ids.reverse()) await api(p2, 'POST', '/api/wishlist', { productId: id });
    await p2.close();
    console.log('избранное восстановлено:', ids.length);
  }
  await buyer.close();

  // ---------- Сотрудники ----------
  const trimRows = trimTo('table tbody tr', 14);
  {
    const { c, p } = await asRole(browser, 'official@amfibia.by');
    await p.close();
    await shot(c, { folder: S, file: '10_Продавец_Отзывы_1920.svg', url: '/account/shop/reviews', prep: trimTo('.review, table tbody tr', 10) });
    await shot(c, { folder: S, file: '11_Продавец_Удаление_товара_подтверждение_1920.svg', url: '/account/shop', viewport: true, setup: async (p) => click(p, '[data-del]', 1200) });
    await c.close();
  }
  {
    const { c, p } = await asRole(browser, 'warehouse@amfibia.by');
    await p.close();
    await shot(c, { folder: S, file: '12_Склад_Очередь_сборки_1920.svg', url: '/account/stock/queue' });
    await shot(c, { folder: S, file: '13_Склад_Приёмка_возвратов_1920.svg', url: '/account/stock/returns', prep: trimRows });
    await shot(c, { folder: S, file: '14_Склад_Журнал_движений_1920.svg', url: '/account/stock/movements', prep: trimRows });
    await shot(c, { folder: S, file: '15_Склад_Приёмка_товара_окно_1920.svg', url: '/account/stock', viewport: true, setup: async (p) => click(p, '[data-income], [data-income-new]', 1400) });
    await c.close();
  }
  {
    const { c, p } = await asRole(browser, 'courier@amfibia.by');
    const r = (await api(p, 'GET', '/api/courier/orders?scope=active')).json;
    const cid = (r?.items || r?.orders || r?.rows || [])[0]?.id;
    await p.close();
    await shot(c, { folder: S, file: '16_Курьер_Доставленные_1920.svg', url: '/account/deliveries/done', prep: trimTo('.route, [data-to]', 8) });
    if (cid) await shot(c, { folder: S, file: '17_Курьер_Маршрутный_лист_1920.svg', url: '/account/deliveries/order/' + cid });
    await c.close();
  }
  {
    const { c, p } = await asRole(browser, 'support@amfibia.by');
    const r = (await api(p, 'GET', '/api/support/tickets?status=all&limit=20')).json;
    const tid = (r?.items || r?.tickets || r?.rows || [])[0]?.id;
    const o = (await api(p, 'GET', '/api/support/orders?status=all&limit=5')).json;
    const oid = (o?.items || o?.orders || o?.rows || [])[0]?.id;
    await p.close();
    if (tid) await shot(c, { folder: S, file: '18_Поддержка_Обращение_переписка_1920.svg', url: '/account/desk/tickets/' + tid });
    await shot(c, { folder: S, file: '19_Поддержка_Заказы_клиентов_1920.svg', url: '/account/desk/orders', prep: trimRows });
    if (oid) await shot(c, { folder: S, file: '20_Поддержка_Заказ_клиента_1920.svg', url: '/account/desk/orders/' + oid });
    await shot(c, { folder: S, file: '21_Поддержка_Решение_по_возврату_окно_1920.svg', url: '/account/desk/returns', viewport: true, setup: async (p) => click(p, '[data-resolve]', 1400) });
    await c.close();
  }

  // ---------- Админ-панель ----------
  {
    const { c, p } = await asRole(browser, 'owner@amfibia.by');
    const u = (await api(p, 'GET', '/api/admin/users?limit=5&role=buyer')).json;
    const uid = (u?.rows || u?.items || u?.users || []).find((x) => x.role === 'buyer')?.id || (u?.rows || u?.items || u?.users || [])[0]?.id;
    await p.close();
    await shot(c, { folder: AD, file: '17_Бренд_подробно_1920.svg', url: '/admin/brands/1' });
    await shot(c, { folder: AD, file: '18_Бренд_редактирование_окно_1920.svg', url: '/admin/brands/1', viewport: true, setup: async (p) => click(p, '[data-edit]', 1600) });
    if (uid) await shot(c, { folder: AD, file: '19_Пользователь_подробно_1920.svg', url: '/admin/users/' + uid });
    if (uid) await shot(c, { folder: AD, file: '20_Пользователь_редактирование_окно_1920.svg', url: '/admin/users/' + uid, viewport: true, setup: async (p) => click(p, '[data-edit]', 1600) });
    await shot(c, { folder: AD, file: '21_Промокод_новый_окно_1920.svg', url: '/admin/promos', viewport: true, setup: async (p) => click(p, '[data-add]', 1400) });
    await shot(c, { folder: AD, file: '22_Удаление_подтверждение_1920.svg', url: '/admin/warehouses', viewport: true, setup: async (p) => click(p, '[data-del]', 1200) });
    await c.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
