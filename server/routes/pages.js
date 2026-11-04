// Маршруты HTML-страниц. Каждая страница — файл из views/, данные подгружаются на клиенте через /api.
import express from 'express';
import { config } from '../../config/index.js';
import { renderPage } from '../lib/render.js';
import { query } from '../../db/pool.js';
import { ApiError } from '../lib/errors.js';
import { pageRequireAuth, pageCheckRole } from '../middleware/auth.js';

const router = express.Router();

// Блок быстрого входа под тестовыми ролями — только в режиме разработки (для демонстрации проекта)
const DEMO_ACCOUNTS = [
  ['buyer', 'buyer@amfibia.by'],
  ['seller', 'official@amfibia.by'],
  ['warehouse', 'warehouse@amfibia.by'],
  ['courier', 'courier@amfibia.by'],
  ['support', 'support@amfibia.by'],
  ['moderator', 'moderator@amfibia.by'],
  ['owner', 'owner@amfibia.by'],
];
const demoAccountsHtml = () =>
  config.isDev
    ? `<details class="auth-demo">
        <summary class="t-mono" data-i18n="auth.demoTitle">Демо-аккаунты (режим разработки)</summary>
        <p class="t-muted auth-demo__note" data-i18n="auth.demoNote">Пароль у всех: Amfibia2026. Нажмите роль — поля заполнятся.</p>
        <div class="auth-demo__grid">${DEMO_ACCOUNTS.map(([role, email]) => `<button type="button" class="chip" data-demo-login="${email}"><span data-i18n="roles.${role}">${role}</span></button>`).join('')}</div>
      </details>`
    : '';

// GET / — главная (роль: любая)
router.get('/', (req, res) => renderPage(req, res, 'index.html', { page: 'home' }));

// GET /auth — вход, регистрация, подтверждение email, 2FA, восстановление пароля (роль: гость).
// Авторизованного пользователя перенаправляем в профиль (или на next).
router.get('/auth', (req, res) => {
  const next = typeof req.query.next === 'string' && req.query.next.startsWith('/') && !req.query.next.startsWith('//') ? req.query.next : '/account';
  if (req.user) return res.redirect(next);
  renderPage(req, res, 'auth.html', { page: 'auth', demoAccounts: demoAccountsHtml() });
});

// GET /catalog — общий каталог с фильтрами; все параметры фильтра в URL (роль: любая)
router.get('/catalog', (req, res) => renderPage(req, res, 'catalog.html', { page: 'catalog' }));

// GET /product/:id — страница товара (роль: любая; неопубликованный товар — только продавец и модерация).
// Сервер подставляет <title> и meta description, остальное страница грузит через /api/products/:id.
// Таблицы: products, brands (SELECT)
router.get('/product/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return next(ApiError.notFound());
  // SQL: название, бренд и описание товара для заголовка страницы
  const { rows } = await query(
    `SELECT p.id, p.name_ru, p.name_en, p.description_ru, p.description_en, p.moderation_status, p.seller_id, b.name AS brand, b.slug AS brand_slug
       FROM products p JOIN brands b ON b.id = p.brand_id
      WHERE p.id = $1`,
    [id]
  );
  const p = rows[0];
  const staff = req.user && ['owner', 'moderator'].includes(req.user.role);
  if (!p || (p.moderation_status !== 'approved' && !staff && req.user?.id !== p.seller_id)) return next(ApiError.notFound());
  const en = req.lang === 'en';
  const name = en ? p.name_en : p.name_ru;
  renderPage(req, res, 'product.html', {
    page: 'product',
    productId: p.id,
    brandSlug: p.brand_slug,
    title: `${p.brand} — ${name} — AMFIBIA`,
    description: String(en ? p.description_en : p.description_ru).slice(0, 200),
  });
});

// GET /brand/:slug — страница бренда, один шаблон на 15 домов (роль: любая).
// Сервер подставляет title, описание и data-brand (микростилистика из brands.css). Таблица: brands (SELECT)
router.get('/brand/:slug', async (req, res, next) => {
  // SQL: бренд по slug для заголовка страницы
  const { rows } = await query('SELECT name, slug, short_desc_ru, short_desc_en FROM brands WHERE slug = $1', [String(req.params.slug).slice(0, 80)]);
  const b = rows[0];
  if (!b) return next(ApiError.notFound());
  renderPage(req, res, 'brand.html', {
    page: 'brand',
    brandSlug: b.slug,
    brandName: b.name,
    title: `${b.name} — AMFIBIA`,
    description: String(req.lang === 'en' ? b.short_desc_en : b.short_desc_ru).slice(0, 200),
  });
});

// GET /cart — корзина (роль: любая; гость видит корзину из localStorage)
router.get('/cart', (req, res) => renderPage(req, res, 'cart.html', { page: 'cart' }));

// GET /compare — сравнение до 4 товаров (роль: любая; гость — список из localStorage)
router.get('/compare', (req, res) => renderPage(req, res, 'compare.html', { page: 'compare' }));

// GET /wishlist — избранное (роль: любой авторизованный; гость перенаправляется на вход)
router.get('/wishlist', pageRequireAuth, (req, res) => renderPage(req, res, 'wishlist.html', { page: 'wishlist' }));

// GET /checkout — пошаговое оформление заказа (роль: любой авторизованный; гость → вход с возвратом сюда)
router.get('/checkout', pageRequireAuth, (req, res) => renderPage(req, res, 'checkout.html', { page: 'checkout' }));

// GET /checkout/success/:number — страница успеха после оформления (роль: владелец заказа).
// Таблица: orders (SELECT по номеру и user_id — чужой номер даст 404)
router.get('/checkout/success/:number', pageRequireAuth, async (req, res, next) => {
  const { rows } = await query('SELECT id FROM orders WHERE order_number = $1 AND user_id = $2', [String(req.params.number).slice(0, 20), req.user.id]);
  if (!rows[0]) return next(ApiError.notFound());
  renderPage(req, res, 'checkout-success.html', { page: 'checkout-success', orderId: rows[0].id });
});

// GET /tracking — публичное отслеживание заказа по трек-номеру (роль: любая)
router.get('/tracking', (req, res) => renderPage(req, res, 'tracking.html', { page: 'tracking' }));

// GET /account, /account/* — личный кабинет; набор вкладок зависит от роли (роль: любой авторизованный).
// Разделы рисуются на клиенте (js/pages/account.js), данные — через /api; права проверяются на сервере в каждом API.
router.get(['/account', '/account/*path'], pageRequireAuth, (req, res) => renderPage(req, res, 'account.html', { page: 'account' }));

// GET /histories — оглавление историй 15 брендов (роль: любая)
router.get('/histories', (req, res) => renderPage(req, res, 'histories.html', { page: 'histories' }));

// GET /history/:slug — полная история бренда в его микростилистике (роль: любая).
// Сервер подставляет title, описание и data-brand; тексты страница грузит через /api/history/:slug. Таблица: brands (SELECT)
router.get('/history/:slug', async (req, res, next) => {
  // SQL: бренд по slug для заголовка страницы
  const { rows } = await query('SELECT name, slug, short_desc_ru, short_desc_en FROM brands WHERE slug = $1', [String(req.params.slug).slice(0, 80)]);
  const b = rows[0];
  if (!b) return next(ApiError.notFound());
  const en = req.lang === 'en';
  renderPage(req, res, 'history.html', {
    page: 'history',
    brandSlug: b.slug,
    brandName: b.name,
    title: en ? `${b.name}: the full story — AMFIBIA` : `${b.name}: полная история — AMFIBIA`,
    description: String(en ? b.short_desc_en : b.short_desc_ru).slice(0, 200),
  });
});

// Служебные страницы (раздел 6.15 ТЗ): один шаблон info.html, тексты — в i18n (info.<ключ>), роль: любая
const INFO_PAGES = { '/delivery': 'delivery', '/returns': 'returns', '/size-guide': 'sizes', '/about': 'about', '/contacts': 'contacts', '/privacy': 'privacy' };
for (const [path, key] of Object.entries(INFO_PAGES)) {
  router.get(path, (req, res) => renderPage(req, res, 'info.html', { page: 'info', infoKey: key }));
}

// GET /admin, /admin/* — админ-панель со своим макетом (роль: moderator, owner; остальным — страница 403).
// Разделы рисуются на клиенте (js/pages/admin.js), данные — /api/admin/*; права проверяются на сервере в каждом API.
router.get(['/admin', '/admin/*path'], pageCheckRole('moderator'), (req, res) => renderPage(req, res, 'admin.html', { page: 'admin', title: 'Admin — AMFIBIA' }));

// Просмотр оформленных страниц ошибок напрямую (роль: любая)
router.get('/403', (req, res) => renderPage(req, res, '403.html', { page: 'error-403' }, 403));
router.get('/404', (req, res) => renderPage(req, res, '404.html', { page: 'error-404' }, 404));
router.get('/500', (req, res) => renderPage(req, res, '500.html', { page: 'error-500' }, 500));

export default router;
