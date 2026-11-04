// Админ-панель /admin (раздел 8 ТЗ): дашборд, пользователи, модерация товаров и отзывов, заявки продавцов,
// заказы (смена статуса, назначение курьера, демонстрация «продвинуть» / «провести по всем статусам»), журнал действий.
// Доступ: owner — всё; moderator — пользователи (без создания и смены ролей), модерация товаров и отзывов, заявки продавцов.
// Справочники (бренды, истории, коллекции, категории, склады, доставка/оплата, промокоды, баннеры, курсы) — routes/api/adminRefs.js.
// Все изменения пишутся в audit_log (функция audit из services/orderService.js).
import crypto from 'node:crypto';
import express from 'express';
import bcrypt from 'bcrypt';
import { body, param, query as q } from 'express-validator';
import { query, withTransaction } from '../../../db/pool.js';
import { checkRole } from '../../middleware/auth.js';
import { validate, msg } from '../../middleware/validate.js';
import { ApiError } from '../../lib/errors.js';
import { config } from '../../../config/index.js';
import { listValidators, listParams, pageResult, likePattern } from '../../lib/listing.js';
import { changeStatus, nextStatus, audit, notify, assignCourierIfMissing, FINAL } from '../../services/orderService.js';
import { productModerationNotification, sellerApplicationNotification } from '../../services/notificationTexts.js';
import { destroyUserSessions } from '../../services/authService.js';
import { loadOrder } from './orders.js';

const router = express.Router();
const staff = checkRole('moderator'); // модератор и владелец
const ownerOnly = checkRole(); // только владелец (owner проходит checkRole всегда)
router.use(staff);

const ROLES = ['buyer', 'seller', 'warehouse', 'courier', 'support', 'moderator', 'owner'];
const idParam = param('id').isInt({ min: 1 }).toInt();
const idsBody = [body('ids').isArray({ min: 1, max: 200 }), body('ids.*').isInt({ min: 1 }).toInt()];

// ---------------------------------------------------------------------------------------------
// GET /api/admin/summary — счётчики меню админки (роль: moderator, owner)
// Таблицы: products, reviews, seller_applications, users, orders, support_tickets, return_requests (SELECT COUNT)
// ---------------------------------------------------------------------------------------------
router.get('/summary', async (req, res) => {
  // SQL: очереди модерации и активные задачи
  const { rows } = await query(
    `SELECT (SELECT COUNT(*)::int FROM products WHERE moderation_status = 'pending') AS products,
            (SELECT COUNT(*)::int FROM reviews WHERE status = 'pending') AS reviews,
            (SELECT COUNT(*)::int FROM seller_applications WHERE status = 'pending') AS applications,
            (SELECT COUNT(*)::int FROM users WHERE status <> 'deleted') AS users,
            (SELECT COUNT(*)::int FROM orders WHERE status NOT IN ('delivered', 'cancelled', 'returned')) AS orders,
            (SELECT COUNT(*)::int FROM support_tickets WHERE status = 'open') AS tickets,
            (SELECT COUNT(*)::int FROM return_requests WHERE status = 'pending') AS returns`
  );
  res.json(rows[0]);
});

// ---------------------------------------------------------------------------------------------
// GET /api/admin/dashboard?days=30 — дашборд владельца (роль: owner)
// Таблицы: orders, users (SELECT SUM / COUNT), v_sales_by_brand, v_top_products, v_low_stock (представления),
//          order_items (через представления), generate_series — продажи по дням
// ---------------------------------------------------------------------------------------------
router.get('/dashboard', ownerOnly, validate([q('days').optional().isInt({ min: 7, max: 365 }).toInt()]), async (req, res) => {
  const days = req.valid.days || 30;
  const VALID = "status NOT IN ('cancelled', 'returned')";
  const [kpi, daily, brands, statuses, top, recent, low] = await Promise.all([
    // SQL: выручка за день / неделю / месяц (и прошлые периоды), заказы, новые пользователи, средний чек
    query(
      `SELECT COALESCE(SUM(total_byn) FILTER (WHERE created_at >= CURRENT_DATE), 0) AS rev_day,
              COALESCE(SUM(total_byn) FILTER (WHERE created_at >= CURRENT_DATE - 1 AND created_at < CURRENT_DATE), 0) AS rev_day_prev,
              COALESCE(SUM(total_byn) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days'), 0) AS rev_week,
              COALESCE(SUM(total_byn) FILTER (WHERE created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days'), 0) AS rev_week_prev,
              COALESCE(SUM(total_byn) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'), 0) AS rev_month,
              COALESCE(SUM(total_byn) FILTER (WHERE created_at >= NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days'), 0) AS rev_month_prev,
              COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS orders_month,
              COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days')::int AS orders_month_prev,
              (SELECT COUNT(*)::int FROM users WHERE created_at >= NOW() - INTERVAL '30 days') AS new_users,
              (SELECT COUNT(*)::int FROM users WHERE created_at >= NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days') AS new_users_prev
         FROM orders WHERE ${VALID}`
    ),
    // SQL: продажи по дням (дни без заказов — с нулём)
    query(
      `SELECT d::date AS day, COALESCE(SUM(o.total_byn), 0) AS revenue, COUNT(o.id)::int AS orders
         FROM generate_series(CURRENT_DATE - ($1 - 1) * INTERVAL '1 day', CURRENT_DATE, INTERVAL '1 day') d
         LEFT JOIN orders o ON o.created_at::date = d::date AND o.${VALID}
        GROUP BY d ORDER BY d`,
      [days]
    ),
    // SQL: выручка по брендам (представление v_sales_by_brand)
    query('SELECT brand_name, brand_slug, accent_color, orders_count, items_sold, revenue_byn FROM v_sales_by_brand ORDER BY revenue_byn DESC'),
    // SQL: заказы по статусам
    query('SELECT status, COUNT(*)::int AS n FROM orders GROUP BY status'),
    // SQL: топ-10 товаров (представление v_top_products)
    query('SELECT product_id, sku, name_ru, name_en, brand_name, units_sold, revenue_byn, image FROM v_top_products ORDER BY units_sold DESC, revenue_byn DESC LIMIT 10'),
    // SQL: последние заказы
    query(
      `SELECT o.id, o.order_number, o.status, o.payment_status, o.total_byn, o.created_at, o.contact_name
         FROM orders o ORDER BY o.created_at DESC LIMIT 8`
    ),
    // SQL: товары с низким остатком (представление v_low_stock, только продаваемые товары)
    query(
      `SELECT l.product_id, l.sku_variant, l.name_ru, l.name_en, l.brand_name, l.size_label, l.warehouse_city, l.available
         FROM v_low_stock l JOIN products p ON p.id = l.product_id
        WHERE p.moderation_status = 'approved' AND l.quantity > 0
        ORDER BY l.available, l.sku_variant LIMIT 10`
    ),
  ]);
  const k = kpi.rows[0];
  const n = (v) => Number(v);
  res.json({
    days,
    kpi: {
      revenueDay: n(k.rev_day), revenueDayPrev: n(k.rev_day_prev), revenueWeek: n(k.rev_week), revenueWeekPrev: n(k.rev_week_prev),
      revenueMonth: n(k.rev_month), revenueMonthPrev: n(k.rev_month_prev), ordersMonth: k.orders_month, ordersMonthPrev: k.orders_month_prev,
      newUsers: k.new_users, newUsersPrev: k.new_users_prev,
      avg: k.orders_month ? Math.round((n(k.rev_month) / k.orders_month) * 100) / 100 : 0,
      avgPrev: k.orders_month_prev ? Math.round((n(k.rev_month_prev) / k.orders_month_prev) * 100) / 100 : 0,
    },
    daily: daily.rows.map((d) => ({ day: d.day, revenue: n(d.revenue), orders: d.orders })),
    brands: brands.rows.map((b) => ({ name: b.brand_name, slug: b.brand_slug, accent: b.accent_color, orders: b.orders_count, units: b.items_sold, revenue: n(b.revenue_byn) })),
    statuses: Object.fromEntries(statuses.rows.map((s) => [s.status, s.n])),
    top: top.rows.map((p) => ({ id: p.product_id, sku: p.sku, name: { ru: p.name_ru, en: p.name_en }, brand: p.brand_name, units: p.units_sold, revenue: n(p.revenue_byn), image: p.image })),
    recent: recent.rows.map((o) => ({ id: o.id, orderNumber: o.order_number, status: o.status, paymentStatus: o.payment_status, total: n(o.total_byn), createdAt: o.created_at, customer: o.contact_name })),
    lowStock: low.rows.map((l) => ({ productId: l.product_id, sku: l.sku_variant, name: { ru: l.name_ru, en: l.name_en }, brand: l.brand_name, size: l.size_label, city: l.warehouse_city, available: l.available })),
  });
});

// =============================================================================================
// ПОЛЬЗОВАТЕЛИ
// =============================================================================================
const USER_SORT = { created: 'u.created_at', name: "u.last_name || ' ' || u.first_name", email: 'u.email', role: 'r.code', status: 'u.status', login: 'u.last_login_at', orders: 'orders_count', spent: 'spent' };

// GET /api/admin/users?q=&role=&status=&page=&sort=&dir= — список пользователей (роль: moderator, owner)
// Таблицы: users, roles, orders (SELECT, поиск по trigram-индексу idx_users_name_trgm)
router.get('/users', validate([...listValidators, q('role').optional().isIn(['all', ...ROLES]), q('status').optional().isIn(['all', 'active', 'blocked', 'deleted'])]), async (req, res) => {
  const lp = listParams(req, USER_SORT, 'created');
  const params = [];
  const where = ['TRUE'];
  if (req.valid.role && req.valid.role !== 'all') {
    params.push(req.valid.role);
    where.push(`r.code = $${params.length}`);
  }
  if (req.valid.status && req.valid.status !== 'all') {
    params.push(req.valid.status);
    where.push(`u.status = $${params.length}`);
  }
  if (lp.search) {
    params.push(likePattern(lp.search));
    where.push(`(u.first_name || ' ' || u.last_name || ' ' || u.email) ILIKE $${params.length} OR u.phone ILIKE $${params.length}`);
  }
  params.push(lp.limit, lp.offset);
  // SQL: страница пользователей с числом заказов и суммой покупок
  const { rows } = await query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.avatar, u.status, u.email_verified, u.two_factor_enabled, u.created_at, u.last_login_at,
            r.code AS role,
            (SELECT COUNT(*)::int FROM orders o WHERE o.user_id = u.id) AS orders_count,
            (SELECT COALESCE(SUM(total_byn), 0) FROM orders o WHERE o.user_id = u.id AND o.status = 'delivered') AS spent,
            COUNT(*) OVER () AS total
       FROM users u JOIN roles r ON r.id = u.role_id
      WHERE ${where.map((w) => `(${w})`).join(' AND ')}
      ORDER BY ${lp.order}, u.id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  res.json(
    pageResult(
      rows.map((u) => ({ id: u.id, email: u.email, firstName: u.first_name, lastName: u.last_name, phone: u.phone, avatar: u.avatar, status: u.status, emailVerified: u.email_verified, twoFactor: u.two_factor_enabled, role: u.role, createdAt: u.created_at, lastLoginAt: u.last_login_at, orders: u.orders_count, spent: Number(u.spent) })),
      Number(rows[0]?.total || 0),
      lp
    )
  );
});

// GET /api/admin/users/:id — карточка пользователя: данные, последние заказы, заявка продавца, активность (роль: moderator, owner)
// Таблицы: users, roles, orders, seller_applications, reviews, login_attempts (SELECT)
router.get('/users/:id', validate([idParam]), async (req, res) => {
  const u = await query(
    `SELECT u.*, r.code AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
    [req.valid.id]
  );
  const user = u.rows[0];
  if (!user) throw ApiError.notFound();
  const [orders, stats, app, logins] = await Promise.all([
    // SQL: последние 20 заказов пользователя
    query('SELECT id, order_number, status, payment_status, total_byn, created_at FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20', [user.id]),
    // SQL: сводка активности
    query(
      `SELECT (SELECT COUNT(*)::int FROM orders WHERE user_id = $1) AS orders,
              (SELECT COALESCE(SUM(total_byn), 0) FROM orders WHERE user_id = $1 AND status = 'delivered') AS spent,
              (SELECT COUNT(*)::int FROM reviews WHERE user_id = $1) AS reviews,
              (SELECT COUNT(*)::int FROM products WHERE seller_id = $1) AS products,
              (SELECT COUNT(*)::int FROM addresses WHERE user_id = $1) AS addresses`,
      [user.id]
    ),
    // SQL: последняя заявка продавца
    query('SELECT shop_name, status, created_at FROM seller_applications WHERE user_id = $1 ORDER BY id DESC LIMIT 1', [user.id]),
    // SQL: последние попытки входа
    query('SELECT ip, success, created_at FROM login_attempts WHERE email = $1 ORDER BY created_at DESC LIMIT 5', [user.email]),
  ]);
  const s = stats.rows[0];
  res.json({
    user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, phone: user.phone, avatar: user.avatar, status: user.status, role: user.role, emailVerified: user.email_verified, twoFactor: user.two_factor_enabled, lang: user.preferred_lang, theme: user.preferred_theme, currency: user.preferred_currency, createdAt: user.created_at, lastLoginAt: user.last_login_at },
    stats: { orders: s.orders, spent: Number(s.spent), reviews: s.reviews, products: s.products, addresses: s.addresses },
    orders: orders.rows.map((o) => ({ id: o.id, orderNumber: o.order_number, status: o.status, paymentStatus: o.payment_status, total: Number(o.total_byn), createdAt: o.created_at })),
    sellerApplication: app.rows[0] || null,
    logins: logins.rows.map((l) => ({ ip: l.ip, success: l.success, at: l.created_at })),
  });
});

// Защита: модератор не трогает владельца; никто не блокирует и не удаляет сам себя. Таблицы: users, roles (SELECT FOR UPDATE)
async function lockTarget(client, req, id, { self = false } = {}) {
  const { rows } = await client.query('SELECT u.*, r.code AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1 FOR UPDATE OF u', [id]);
  const target = rows[0];
  if (!target) throw ApiError.notFound();
  if (target.role === 'owner' && req.user.role !== 'owner') throw new ApiError(403, 'admin.cannotTouchOwner');
  if (!self && target.id === req.user.id) throw new ApiError(409, 'admin.cannotBlockSelf');
  return target;
}

const nameRule = (field) => body(field).isString().trim().matches(/^[\p{L}][\p{L}\s'’.-]{0,59}$/u).withMessage(msg('validation.name'));

// POST /api/admin/users — создание сотрудника или пользователя (роль: owner). Пароль: заданный или временный (печатается в консоль).
// Таблицы: roles (SELECT), users (INSERT), audit_log (INSERT)
router.post(
  '/users',
  ownerOnly,
  validate([
    body('email').isEmail().withMessage(msg('validation.email')).normalizeEmail({ gmail_remove_dots: false }),
    nameRule('firstName'),
    nameRule('lastName'),
    body('phone').optional({ values: 'falsy' }).isString().matches(/^\+\d{10,15}$/).withMessage(msg('validation.phone')),
    body('role').isIn(ROLES).withMessage(msg('validation.enum')),
    body('password').optional({ values: 'falsy' }).isString().isLength({ min: 8, max: 100 }).matches(/[A-Za-zА-Яа-яЁё]/).matches(/\d/).withMessage(msg('validation.password')),
  ]),
  async (req, res) => {
    const v = req.valid;
    const password = v.password || `Amf-${crypto.randomBytes(4).toString('hex')}7`;
    const hash = await bcrypt.hash(password, config.auth.bcryptRounds);
    const created = await withTransaction(async (client) => {
      // SQL: новый пользователь с выбранной ролью (email считается подтверждённым — аккаунт создан владельцем)
      const ins = await client.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, phone, role_id, status, email_verified)
         VALUES ($1, $2, $3, $4, $5, (SELECT id FROM roles WHERE code = $6), 'active', TRUE) RETURNING id`,
        [v.email.toLowerCase(), hash, v.firstName, v.lastName, v.phone || null, v.role]
      );
      await audit(client, { userId: req.user.id, action: 'user.create', entity: 'users', entityId: ins.rows[0].id, newData: { email: v.email, role: v.role }, ip: req.ip });
      return ins.rows[0];
    });
    if (!v.password) console.log(`\n[admin] Временный пароль для ${v.email}: ${password}\n`);
    res.status(201).json({ user: created, temporaryPassword: !v.password });
  }
);

// PUT /api/admin/users/:id — изменение данных пользователя: имя, фамилия, телефон, email, подтверждение email (роль: moderator, owner)
// Роль здесь не меняется (только owner — PATCH /users/:id/role). Таблицы: users (SELECT FOR UPDATE, UPDATE), audit_log (INSERT)
router.put(
  '/users/:id',
  validate([
    idParam,
    nameRule('firstName'),
    nameRule('lastName'),
    body('email').isEmail().withMessage(msg('validation.email')).normalizeEmail({ gmail_remove_dots: false }),
    body('phone').optional({ values: 'falsy' }).isString().matches(/^\+\d{10,15}$/).withMessage(msg('validation.phone')),
    body('emailVerified').optional().isBoolean().toBoolean(),
  ]),
  async (req, res) => {
    const v = req.valid;
    await withTransaction(async (client) => {
      const t = await lockTarget(client, req, v.id, { self: true });
      // SQL: новые данные пользователя
      await client.query(
        'UPDATE users SET first_name = $2, last_name = $3, email = $4, phone = $5, email_verified = COALESCE($6, email_verified) WHERE id = $1',
        [v.id, v.firstName, v.lastName, v.email.toLowerCase(), v.phone || null, v.emailVerified ?? null]
      );
      await audit(client, {
        userId: req.user.id, action: 'user.update', entity: 'users', entityId: v.id,
        oldData: { first_name: t.first_name, last_name: t.last_name, email: t.email, phone: t.phone, email_verified: t.email_verified },
        newData: { first_name: v.firstName, last_name: v.lastName, email: v.email, phone: v.phone || null, email_verified: v.emailVerified ?? t.email_verified }, ip: req.ip,
      });
    });
    res.json({ ok: true });
  }
);

// PATCH /api/admin/users/:id/role — смена роли (роль: owner). Транзакция: users (SELECT FOR UPDATE, UPDATE role_id),
// notifications (INSERT), audit_log (INSERT). Свою роль менять нельзя (чтобы не потерять доступ владельца).
router.patch('/users/:id/role', ownerOnly, validate([idParam, body('role').isIn(ROLES).withMessage(msg('validation.enum'))]), async (req, res) => {
  if (req.valid.id === req.user.id) throw new ApiError(409, 'admin.cannotChangeOwnRole');
  await withTransaction(async (client) => {
    const t = await lockTarget(client, req, req.valid.id);
    if (t.role === req.valid.role) return;
    // SQL: новая роль пользователя
    await client.query('UPDATE users SET role_id = (SELECT id FROM roles WHERE code = $2) WHERE id = $1', [t.id, req.valid.role]);
    const names = (await client.query('SELECT name_ru, name_en FROM roles WHERE code = $1', [req.valid.role])).rows[0];
    await notify(client, t.id, { type: 'role_change', title_ru: `Ваша роль: ${names.name_ru}`, title_en: `Your role: ${names.name_en}`, text_ru: 'Новые разделы доступны в личном кабинете.', text_en: 'New sections are available in your account.', link: '/account' });
    await audit(client, { userId: req.user.id, action: 'user.role', entity: 'users', entityId: t.id, oldData: { role: t.role }, newData: { role: req.valid.role }, ip: req.ip });
  });
  res.json({ ok: true });
});

// Блокировка / разблокировка / мягкое удаление одного пользователя внутри транзакции.
// Таблицы: users (UPDATE status), session (DELETE — активные сессии заблокированного завершаются), audit_log (INSERT)
async function setUserStatus(client, req, id, status) {
  const t = await lockTarget(client, req, id);
  if (t.status === status) return false;
  // SQL: новый статус пользователя
  await client.query('UPDATE users SET status = $2 WHERE id = $1', [id, status]);
  await audit(client, { userId: req.user.id, action: `user.${status === 'active' ? 'unblock' : status === 'blocked' ? 'block' : 'delete'}`, entity: 'users', entityId: id, oldData: { status: t.status }, newData: { status }, ip: req.ip });
  return true;
}

// POST /api/admin/users/:id/status — active | blocked | deleted (роль: moderator, owner). Транзакция; сессии удаляются.
router.post('/users/:id/status', validate([idParam, body('status').isIn(['active', 'blocked', 'deleted']).withMessage(msg('validation.enum'))]), async (req, res) => {
  await withTransaction((client) => setUserStatus(client, req, req.valid.id, req.valid.status));
  if (req.valid.status !== 'active') await destroyUserSessions(req.valid.id);
  res.json({ ok: true });
});

// POST /api/admin/users/bulk — массовая блокировка / разблокировка (роль: moderator, owner). Одна транзакция на всех.
// Таблицы: users (UPDATE status), session (DELETE), audit_log (INSERT)
router.post('/users/bulk', validate([...idsBody, body('action').isIn(['block', 'unblock']).withMessage(msg('validation.enum'))]), async (req, res) => {
  const status = req.valid.action === 'block' ? 'blocked' : 'active';
  let changed = 0;
  await withTransaction(async (client) => {
    for (const id of req.valid.ids) {
      if (id === req.user.id) continue;
      if (await setUserStatus(client, req, id, status)) changed += 1;
    }
  });
  if (status === 'blocked') for (const id of req.valid.ids) if (id !== req.user.id) await destroyUserSessions(id);
  res.json({ changed });
});

// POST /api/admin/users/:id/reset-password — сброс пароля: временный пароль печатается в консоль сервера (роль: moderator, owner)
// Таблицы: users (UPDATE password_hash), session (DELETE — пользователь выходит отовсюду), audit_log (INSERT)
router.post('/users/:id/reset-password', validate([idParam]), async (req, res) => {
  const password = `Amf-${crypto.randomBytes(4).toString('hex')}7`;
  const hash = await bcrypt.hash(password, config.auth.bcryptRounds);
  const email = await withTransaction(async (client) => {
    const t = await lockTarget(client, req, req.valid.id, { self: true });
    // SQL: новый хеш пароля
    await client.query('UPDATE users SET password_hash = $2 WHERE id = $1', [t.id, hash]);
    await audit(client, { userId: req.user.id, action: 'user.reset_password', entity: 'users', entityId: t.id, ip: req.ip });
    return t.email;
  });
  await destroyUserSessions(req.valid.id, req.valid.id === req.user.id ? req.sessionID : null);
  console.log(`\n[admin] Новый временный пароль для ${email}: ${password}\n`);
  res.json({ ok: true, message: req.t('admin.passwordReset') });
});

// =============================================================================================
// ТОВАРЫ И МОДЕРАЦИЯ
// =============================================================================================
const PRODUCT_SORT = { created: 'p.created_at', updated: 'p.updated_at', name: 'p.name_ru', price: 'p.price_byn', brand: 'b.name', status: 'p.moderation_status', views: 'p.views_count', rating: 'p.rating_avg' };

// GET /api/admin/products?status=&brand=&seller=&q=&page= — все товары площадки (роль: moderator, owner)
// Таблицы: products, brands, categories, users (продавец), seller_applications (название магазина), product_images (SELECT)
router.get(
  '/products',
  validate([...listValidators, q('status').optional().isIn(['all', 'draft', 'pending', 'approved', 'rejected']), q('brand').optional({ values: 'falsy' }).isInt({ min: 1 }).toInt(), q('seller').optional({ values: 'falsy' }).isInt({ min: 1 }).toInt(), q('verified').optional().isIn(['', '0', '1'])]),
  async (req, res) => {
    const lp = listParams(req, PRODUCT_SORT, 'updated');
    const params = [];
    const where = ['TRUE'];
    const add = (sql, value) => {
      params.push(value);
      where.push(sql.replaceAll('?', `$${params.length}`));
    };
    if (req.valid.status && req.valid.status !== 'all') add('p.moderation_status = ?', req.valid.status);
    if (req.valid.brand) add('p.brand_id = ?', req.valid.brand);
    if (req.valid.seller) add('p.seller_id = ?', req.valid.seller);
    if (req.valid.verified === '1') where.push('p.is_authenticated');
    if (req.valid.verified === '0') where.push('NOT p.is_authenticated');
    if (lp.search) add('(p.name_ru ILIKE ? OR p.name_en ILIKE ? OR p.sku ILIKE ?)', likePattern(lp.search));
    params.push(lp.limit, lp.offset);
    // SQL: страница товаров с продавцом и главным фото
    const { rows } = await query(
      `SELECT p.id, p.sku, p.name_ru, p.name_en, p.description_ru, p.price_byn, p.old_price_byn, p.moderation_status, p.rejection_reason, p.is_authenticated,
              p.views_count, p.rating_avg, p.created_at, p.updated_at, p.color, p.material, p.country_of_origin,
              b.name AS brand, c.name_ru AS category_ru, c.name_en AS category_en,
              u.id AS seller_id, COALESCE((SELECT sa.shop_name FROM seller_applications sa WHERE sa.user_id = u.id AND sa.status = 'approved' ORDER BY sa.id DESC LIMIT 1), u.first_name || ' ' || u.last_name) AS seller,
              (SELECT json_agg(pi.url ORDER BY pi.is_main DESC, pi.sort_order) FROM product_images pi WHERE pi.product_id = p.id) AS images,
              COUNT(*) OVER () AS total
         FROM products p JOIN brands b ON b.id = p.brand_id JOIN categories c ON c.id = p.category_id JOIN users u ON u.id = p.seller_id
        WHERE ${where.join(' AND ')}
        ORDER BY ${lp.order}, p.id DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json(
      pageResult(
        rows.map((p) => ({
          id: p.id, sku: p.sku, name: { ru: p.name_ru, en: p.name_en }, description: p.description_ru, price: Number(p.price_byn), oldPrice: p.old_price_byn ? Number(p.old_price_byn) : null,
          status: p.moderation_status, rejectionReason: p.rejection_reason, authenticated: p.is_authenticated, views: p.views_count, rating: Number(p.rating_avg),
          createdAt: p.created_at, updatedAt: p.updated_at, brand: p.brand, category: { ru: p.category_ru, en: p.category_en }, color: p.color, material: p.material, country: p.country_of_origin,
          seller: { id: p.seller_id, name: p.seller }, images: p.images || [], image: (p.images || [])[0] || null,
        })),
        Number(rows[0]?.total || 0),
        lp
      )
    );
  }
);

// Решение модерации по одному товару (внутри транзакции).
// Таблицы: products (SELECT FOR UPDATE, UPDATE moderation_status, rejection_reason, is_authenticated), notifications (INSERT), audit_log (INSERT)
async function moderateProduct(client, req, id, { decision, reason = null, authenticated = null }) {
  const { rows } = await client.query('SELECT id, name_ru, seller_id, moderation_status, is_authenticated FROM products WHERE id = $1 FOR UPDATE', [id]);
  const p = rows[0];
  if (!p) throw new ApiError(404, 'catalog.productNotFound');
  if (decision === 'authenticate') {
    // SQL: только отметка «Проверено на подлинность»
    await client.query('UPDATE products SET is_authenticated = $2 WHERE id = $1', [id, authenticated !== false]);
    await audit(client, { userId: req.user.id, action: 'product.authenticate', entity: 'products', entityId: id, oldData: { is_authenticated: p.is_authenticated }, newData: { is_authenticated: authenticated !== false }, ip: req.ip });
    return;
  }
  const approved = decision === 'approve';
  const status = approved ? 'approved' : 'rejected';
  const auth = approved ? (authenticated ?? true) : false;
  // SQL: решение модерации
  await client.query('UPDATE products SET moderation_status = $2, rejection_reason = $3, is_authenticated = $4 WHERE id = $1', [id, status, approved ? null : reason, auth]);
  await notify(client, p.seller_id, productModerationNotification(id, p.name_ru, approved, reason || ''));
  await audit(client, { userId: req.user.id, action: `product.${status}`, entity: 'products', entityId: id, oldData: { status: p.moderation_status, is_authenticated: p.is_authenticated }, newData: { status, reason, is_authenticated: auth }, ip: req.ip });
}

const moderationRules = [
  body('decision').isIn(['approve', 'reject', 'authenticate']).withMessage(msg('validation.enum')),
  body('reason').if(body('decision').equals('reject')).isString().withMessage(msg('validation.length', { min: 5, max: 500 })).trim().isLength({ min: 5, max: 500 }).withMessage(msg('validation.length', { min: 5, max: 500 })),
  body('authenticated').optional().isBoolean().toBoolean(),
];

// POST /api/admin/products/:id/moderate — одобрить / отклонить с причиной / отметить подлинность (роль: moderator, owner). Транзакция.
router.post('/products/:id/moderate', validate([idParam, ...moderationRules]), async (req, res) => {
  await withTransaction((client) => moderateProduct(client, req, req.valid.id, req.valid));
  res.json({ ok: true });
});

// POST /api/admin/products/bulk — массовая модерация (роль: moderator, owner). Одна транзакция на все товары.
router.post('/products/bulk', validate([...idsBody, ...moderationRules]), async (req, res) => {
  await withTransaction(async (client) => {
    for (const id of req.valid.ids) await moderateProduct(client, req, id, req.valid);
  });
  res.json({ changed: req.valid.ids.length });
});

// =============================================================================================
// ОТЗЫВЫ
// =============================================================================================
// GET /api/admin/reviews?status=&rating=&q=&page= — отзывы (роль: moderator, owner). Таблицы: reviews, products, users, product_images (SELECT)
router.get('/reviews', validate([...listValidators, q('status').optional().isIn(['all', 'pending', 'approved', 'rejected']), q('rating').optional({ values: 'falsy' }).isInt({ min: 1, max: 5 }).toInt()]), async (req, res) => {
  const lp = listParams(req, { created: 'r.created_at', rating: 'r.rating', status: 'r.status' }, 'created');
  const params = [];
  const where = ['TRUE'];
  if (req.valid.status && req.valid.status !== 'all') {
    params.push(req.valid.status);
    where.push(`r.status = $${params.length}`);
  }
  if (req.valid.rating) {
    params.push(req.valid.rating);
    where.push(`r.rating = $${params.length}`);
  }
  if (lp.search) {
    params.push(likePattern(lp.search));
    where.push(`(r.text ILIKE $${params.length} OR p.name_ru ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
  }
  params.push(lp.limit, lp.offset);
  // SQL: страница отзывов с товаром и автором
  const { rows } = await query(
    `SELECT r.id, r.rating, r.text, r.status, r.created_at, r.moderated_at, u.id AS user_id, u.first_name || ' ' || u.last_name AS author, u.email,
            p.id AS product_id, p.sku, p.name_ru, p.name_en, b.name AS brand,
            (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_main DESC, pi.sort_order LIMIT 1) AS image,
            (r.order_item_id IS NOT NULL) AS verified_purchase, COUNT(*) OVER () AS total
       FROM reviews r JOIN products p ON p.id = r.product_id JOIN brands b ON b.id = p.brand_id JOIN users u ON u.id = r.user_id
      WHERE ${where.join(' AND ')}
      ORDER BY ${lp.order}, r.id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  res.json(
    pageResult(
      rows.map((r) => ({ id: r.id, rating: r.rating, text: r.text, status: r.status, createdAt: r.created_at, moderatedAt: r.moderated_at, author: r.author, email: r.email, userId: r.user_id, verifiedPurchase: r.verified_purchase, product: { id: r.product_id, sku: r.sku, name: { ru: r.name_ru, en: r.name_en }, brand: r.brand, image: r.image } })),
      Number(rows[0]?.total || 0),
      lp
    )
  );
});

// Решение по отзыву. Таблицы: reviews (UPDATE status, moderated_by, moderated_at — триггер пересчитывает рейтинг товара), audit_log (INSERT)
async function moderateReview(client, req, id, status) {
  const { rows } = await client.query('UPDATE reviews SET status = $2, moderated_by = $3, moderated_at = NOW() WHERE id = $1 RETURNING id', [id, status, req.user.id]);
  if (!rows[0]) throw ApiError.notFound();
  await audit(client, { userId: req.user.id, action: `review.${status}`, entity: 'reviews', entityId: id, newData: { status }, ip: req.ip });
}

// POST /api/admin/reviews/:id/moderate {status: approved|rejected} — модерация отзыва (роль: moderator, owner). Транзакция.
router.post('/reviews/:id/moderate', validate([idParam, body('status').isIn(['approved', 'rejected', 'pending']).withMessage(msg('validation.enum'))]), async (req, res) => {
  await withTransaction((client) => moderateReview(client, req, req.valid.id, req.valid.status));
  res.json({ ok: true });
});

// POST /api/admin/reviews/bulk {ids, status} — массовая модерация отзывов (роль: moderator, owner). Транзакция.
router.post('/reviews/bulk', validate([...idsBody, body('status').isIn(['approved', 'rejected']).withMessage(msg('validation.enum'))]), async (req, res) => {
  await withTransaction(async (client) => {
    for (const id of req.valid.ids) await moderateReview(client, req, id, req.valid.status);
  });
  res.json({ changed: req.valid.ids.length });
});

// DELETE /api/admin/reviews/:id — удаление отзыва (роль: moderator, owner). Таблицы: reviews (DELETE), audit_log (INSERT)
router.delete('/reviews/:id', validate([idParam]), async (req, res) => {
  await withTransaction(async (client) => {
    const { rows } = await client.query('DELETE FROM reviews WHERE id = $1 RETURNING product_id, user_id, rating, text', [req.valid.id]);
    if (!rows[0]) throw ApiError.notFound();
    await audit(client, { userId: req.user.id, action: 'review.delete', entity: 'reviews', entityId: req.valid.id, oldData: rows[0], ip: req.ip });
  });
  res.json({ ok: true });
});

// =============================================================================================
// ЗАЯВКИ «СТАТЬ ПРОДАВЦОМ»
// =============================================================================================
// GET /api/admin/seller-applications?status= — заявки (роль: moderator, owner). Таблицы: seller_applications, users (SELECT)
router.get('/seller-applications', validate([q('status').optional().isIn(['all', 'pending', 'approved', 'rejected'])]), async (req, res) => {
  const st = req.valid.status || 'pending';
  // SQL: заявки с данными пользователя
  const { rows } = await query(
    `SELECT sa.*, u.email, u.first_name || ' ' || u.last_name AS name, u.created_at AS user_since, r.code AS role,
            rv.first_name || ' ' || rv.last_name AS reviewer,
            (SELECT COUNT(*)::int FROM orders o WHERE o.user_id = u.id) AS orders
       FROM seller_applications sa JOIN users u ON u.id = sa.user_id JOIN roles r ON r.id = u.role_id LEFT JOIN users rv ON rv.id = sa.reviewed_by
      WHERE ($1 = 'all' OR sa.status = $1)
      ORDER BY sa.created_at DESC LIMIT 200`,
    [st]
  );
  res.json({ applications: rows.map((a) => ({ id: a.id, userId: a.user_id, shopName: a.shop_name, description: a.description, status: a.status, comment: a.comment, createdAt: a.created_at, reviewedAt: a.reviewed_at, reviewer: a.reviewer, email: a.email, name: a.name, userSince: a.user_since, role: a.role, orders: a.orders })) });
});

// POST /api/admin/seller-applications/:id/resolve {decision, comment} — одобрение (роль пользователя → seller) или отказ
// (роль: moderator, owner). Транзакция: seller_applications (SELECT FOR UPDATE, UPDATE), users (UPDATE role_id), notifications, audit_log (INSERT)
router.post(
  '/seller-applications/:id/resolve',
  validate([
    idParam,
    body('decision').isIn(['approve', 'reject']).withMessage(msg('validation.enum')),
    body('comment').if(body('decision').equals('reject')).isString().withMessage(msg('validation.length', { min: 5, max: 500 })).trim().isLength({ min: 5, max: 500 }).withMessage(msg('validation.length', { min: 5, max: 500 })),
    body('comment').optional({ values: 'falsy' }).isString().trim().isLength({ max: 500 }),
  ]),
  async (req, res) => {
    const approved = req.valid.decision === 'approve';
    await withTransaction(async (client) => {
      const { rows } = await client.query(
        'SELECT sa.*, r.code AS role FROM seller_applications sa JOIN users u ON u.id = sa.user_id JOIN roles r ON r.id = u.role_id WHERE sa.id = $1 FOR UPDATE OF sa',
        [req.valid.id]
      );
      const a = rows[0];
      if (!a) throw ApiError.notFound();
      if (a.status !== 'pending') throw new ApiError(409, 'returns.alreadyResolved');
      const status = approved ? 'approved' : 'rejected';
      // SQL: решение по заявке
      await client.query('UPDATE seller_applications SET status = $2, comment = $3, reviewed_by = $4, reviewed_at = NOW() WHERE id = $1', [a.id, status, req.valid.comment || null, req.user.id]);
      if (approved && a.role === 'buyer') {
        // SQL: смена роли покупателя на «продавец» (в той же транзакции)
        await client.query("UPDATE users SET role_id = (SELECT id FROM roles WHERE code = 'seller') WHERE id = $1", [a.user_id]);
        await audit(client, { userId: req.user.id, action: 'user.role', entity: 'users', entityId: a.user_id, oldData: { role: a.role }, newData: { role: 'seller' }, ip: req.ip });
      }
      await notify(client, a.user_id, sellerApplicationNotification(approved, a.shop_name, req.valid.comment || ''));
      await audit(client, { userId: req.user.id, action: `seller_application.${status}`, entity: 'seller_applications', entityId: a.id, oldData: { status: 'pending' }, newData: { status, comment: req.valid.comment || null }, ip: req.ip });
    });
    res.json({ ok: true });
  }
);

// =============================================================================================
// ЗАКАЗЫ (только владелец)
// =============================================================================================
const ORDER_SORT = { created: 'o.created_at', number: 'o.order_number', status: 'o.status', total: 'o.total_byn', customer: 'o.contact_name' };

// GET /api/admin/orders?status=&courier=&q=&page=&sort= — все заказы (роль: owner). Таблицы: orders, users, delivery_methods (SELECT)
router.get('/orders', ownerOnly, validate([...listValidators, q('status').optional().isString().isLength({ max: 20 }), q('courier').optional({ values: 'falsy' }).isString().isLength({ max: 10 })]), async (req, res) => {
  const lp = listParams(req, ORDER_SORT, 'created');
  const params = [];
  const where = ['TRUE'];
  const st = req.valid.status;
  if (st === 'active') where.push("o.status NOT IN ('delivered', 'cancelled', 'returned')");
  else if (st && st !== 'all') {
    params.push(st);
    where.push(`o.status = $${params.length}`);
  }
  if (req.valid.courier === 'none') where.push("o.courier_id IS NULL AND o.status IN ('confirmed', 'assembling', 'assembled')");
  else if (req.valid.courier && /^\d+$/.test(req.valid.courier)) {
    params.push(Number(req.valid.courier));
    where.push(`o.courier_id = $${params.length}`);
  }
  if (lp.search) {
    params.push(likePattern(lp.search));
    const n = params.length;
    where.push(`(o.order_number ILIKE $${n} OR o.tracking_number ILIKE $${n} OR o.contact_email ILIKE $${n} OR o.contact_name ILIKE $${n})`);
  }
  params.push(lp.limit, lp.offset);
  // SQL: страница заказов с курьером и способом доставки
  const { rows } = await query(
    `SELECT o.id, o.order_number, o.tracking_number, o.status, o.payment_status, o.total_byn, o.currency, o.total_in_currency, o.created_at,
            o.contact_name, o.contact_email, dm.name_ru AS dm_ru, dm.name_en AS dm_en, dm.is_pickup,
            cu.first_name || ' ' || cu.last_name AS courier,
            (SELECT SUM(quantity)::int FROM order_items oi WHERE oi.order_id = o.id) AS count,
            COUNT(*) OVER () AS total
       FROM orders o JOIN delivery_methods dm ON dm.id = o.delivery_method_id LEFT JOIN users cu ON cu.id = o.courier_id
      WHERE ${where.join(' AND ')}
      ORDER BY ${lp.order}, o.id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  res.json(
    pageResult(
      rows.map((o) => ({ id: o.id, orderNumber: o.order_number, trackingNumber: o.tracking_number, status: o.status, next: nextStatus(o.status, o.is_pickup), paymentStatus: o.payment_status, total: Number(o.total_byn), currency: o.currency, totalInCurrency: Number(o.total_in_currency), createdAt: o.created_at, customer: { name: o.contact_name, email: o.contact_email }, delivery: { ru: o.dm_ru, en: o.dm_en }, courier: o.courier, count: o.count || 0 })),
      Number(rows[0]?.total || 0),
      lp
    )
  );
});

// GET /api/admin/couriers — курьеры с текущей нагрузкой (роль: owner). Таблицы: users, roles, orders (SELECT)
router.get('/couriers', ownerOnly, async (req, res) => {
  // SQL: активные курьеры и число заказов в доставке
  const { rows } = await query(
    `SELECT u.id, u.first_name || ' ' || u.last_name AS name, u.phone,
            (SELECT COUNT(*)::int FROM orders o WHERE o.courier_id = u.id AND o.status IN ('handed_to_delivery', 'in_transit', 'arrived')) AS active
       FROM users u JOIN roles r ON r.id = u.role_id AND r.code = 'courier' WHERE u.status = 'active' ORDER BY u.id`
  );
  res.json({ couriers: rows });
});

// GET /api/admin/orders/:id — заказ целиком + история с авторами (роль: owner)
// Таблицы: см. loadOrder (orders.js) + order_status_history, users, roles (SELECT)
router.get('/orders/:id', ownerOnly, validate([idParam]), async (req, res) => {
  const order = await loadOrder('o.id = $1', [req.valid.id]);
  if (!order) throw new ApiError(404, 'orders.notFound');
  // SQL: история статусов с автором изменения и курьер заказа
  const [history, courier] = await Promise.all([
    query(
      `SELECT h.status, h.comment, h.created_at, u.first_name || ' ' || u.last_name AS author, r.code AS role
         FROM order_status_history h LEFT JOIN users u ON u.id = h.changed_by LEFT JOIN roles r ON r.id = u.role_id
        WHERE h.order_id = $1 ORDER BY h.created_at, h.id`,
      [order.id]
    ),
    query('SELECT courier_id FROM orders WHERE id = $1', [order.id]),
  ]);
  res.json({
    order: { ...order, courierId: courier.rows[0].courier_id, next: nextStatus(order.status, order.delivery.isPickup), demoRunning: demoRuns.has(order.id) },
    history: history.rows.map((h) => ({ status: h.status, comment: h.comment, at: h.created_at, author: h.author, role: h.role })),
  });
});

// Переход заказа на следующий статус от имени владельца (одна транзакция). Для передачи в доставку — автоназначение курьера.
// Таблицы: orders, stock, stock_movements, order_status_history, notifications, audit_log — services/orderService.js
function advanceOrder(orderId, actor, ip, comment = null) {
  return withTransaction(async (client) => {
    // SQL: статус и способ доставки заказа (блокировка строки)
    const { rows } = await client.query('SELECT o.status, dm.is_pickup FROM orders o JOIN delivery_methods dm ON dm.id = o.delivery_method_id WHERE o.id = $1 FOR UPDATE OF o', [orderId]);
    const o = rows[0];
    if (!o) throw new ApiError(404, 'orders.notFound');
    const to = nextStatus(o.status, o.is_pickup);
    if (!to) throw new ApiError(409, 'orders.finalStatus');
    if (to === 'handed_to_delivery') await assignCourierIfMissing(client, orderId, actor, ip);
    return changeStatus(orderId, to, actor, { comment: comment || `Демонстрация: ${actor.first_name} продвинул(а) заказ`, ip, client });
  });
}

// POST /api/admin/orders/:id/status {status, comment} — смена статуса владельцем: следующий по цепочке или отмена (роль: owner)
router.post('/orders/:id/status', ownerOnly, validate([idParam, body('status').isString().isLength({ max: 20 }), body('comment').optional({ values: 'falsy' }).isString().trim().isLength({ max: 300 })]), async (req, res) => {
  if (demoRuns.has(req.valid.id)) throw new ApiError(409, 'orders.demoRunning');
  const result =
    req.valid.status === 'cancelled'
      ? await changeStatus(req.valid.id, 'cancelled', req.user, { comment: req.valid.comment || 'Отменён администрацией', ip: req.ip })
      : await advanceOrder(req.valid.id, req.user, req.ip, req.valid.comment);
  res.json({ result });
});

// POST /api/admin/orders/:id/advance — демо-кнопка «Продвинуть заказ на следующий статус» (роль: owner)
router.post('/orders/:id/advance', ownerOnly, validate([idParam]), async (req, res) => {
  if (demoRuns.has(req.valid.id)) throw new ApiError(409, 'orders.demoRunning');
  res.json({ result: await advanceOrder(req.valid.id, req.user, req.ip) });
});

// POST /api/admin/orders/:id/run-all — демо «Провести заказ по всем статусам» с паузой 2,5 с между шагами (роль: owner).
// Ответ приходит сразу (202), шаги выполняются на сервере; страница опрашивает GET /orders/:id и анимирует таймлайн.
// Каждый шаг — отдельная транзакция advanceOrder (те же правила остатков, история, уведомления, журнал).
const demoRuns = new Set();
const DEMO_PAUSE_MS = 2500;
router.post('/orders/:id/run-all', ownerOnly, validate([idParam]), async (req, res) => {
  const id = req.valid.id;
  if (demoRuns.has(id)) throw new ApiError(409, 'orders.demoRunning');
  // SQL: заказ существует и не в финальном статусе
  const { rows } = await query('SELECT status FROM orders WHERE id = $1', [id]);
  if (!rows[0]) throw new ApiError(404, 'orders.notFound');
  if (FINAL.includes(rows[0].status)) throw new ApiError(409, 'orders.finalStatus');
  demoRuns.add(id);
  const actor = { ...req.user };
  const ip = req.ip;
  res.status(202).json({ started: true, pauseMs: DEMO_PAUSE_MS });
  (async () => {
    try {
      for (let step = 0; step < 10; step += 1) {
        await new Promise((r) => setTimeout(r, step === 0 ? 600 : DEMO_PAUSE_MS));
        const r = await advanceOrder(id, actor, ip, 'Демонстрация: автоматический проход по статусам');
        if (r.to === 'delivered') break;
      }
    } catch (err) {
      console.error(`[demo] Заказ ${id}: ${err.message}`);
    } finally {
      demoRuns.delete(id);
    }
  })();
});

// POST /api/admin/orders/:id/courier {courierId} — назначение курьера (роль: owner)
// Таблицы: users, roles (SELECT — проверка роли courier), orders (UPDATE courier_id), audit_log (INSERT)
router.post('/orders/:id/courier', ownerOnly, validate([idParam, body('courierId').isInt({ min: 1 }).toInt()]), async (req, res) => {
  await withTransaction(async (client) => {
    const c = await client.query("SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1 AND r.code = 'courier' AND u.status = 'active'", [req.valid.courierId]);
    if (!c.rows[0]) throw new ApiError(422, 'orders.notCourier');
    // SQL: заказ блокируется и получает курьера
    const o = await client.query('SELECT courier_id, status FROM orders WHERE id = $1 FOR UPDATE', [req.valid.id]);
    if (!o.rows[0]) throw new ApiError(404, 'orders.notFound');
    if (FINAL.includes(o.rows[0].status)) throw new ApiError(409, 'orders.finalStatus');
    await client.query('UPDATE orders SET courier_id = $2 WHERE id = $1', [req.valid.id, req.valid.courierId]);
    await audit(client, { userId: req.user.id, action: 'order.courier', entity: 'orders', entityId: req.valid.id, oldData: { courier_id: o.rows[0].courier_id }, newData: { courier_id: req.valid.courierId }, ip: req.ip });
  });
  res.json({ ok: true });
});

// =============================================================================================
// ЖУРНАЛ ДЕЙСТВИЙ
// =============================================================================================
// GET /api/admin/audit?user=&action=&entity=&from=&to=&q=&page= — журнал действий с «было / стало» (роль: owner)
// Таблицы: audit_log, users, roles (SELECT)
router.get(
  '/audit',
  ownerOnly,
  validate([
    ...listValidators,
    q('user').optional({ values: 'falsy' }).isInt({ min: 1 }).toInt(),
    q('action').optional({ values: 'falsy' }).isString().isLength({ max: 60 }),
    q('entity').optional({ values: 'falsy' }).isString().isLength({ max: 40 }),
    q('from').optional({ values: 'falsy' }).isISO8601().withMessage(msg('validation.date')),
    q('to').optional({ values: 'falsy' }).isISO8601().withMessage(msg('validation.date')),
  ]),
  async (req, res) => {
    const lp = listParams(req, { created: 'a.created_at', action: 'a.action', entity: 'a.entity' }, 'created', 'desc', 30);
    const params = [];
    const where = ['TRUE'];
    const add = (sql, value) => {
      params.push(value);
      where.push(sql.replaceAll('?', `$${params.length}`));
    };
    if (req.valid.user) add('a.user_id = ?', req.valid.user);
    if (req.valid.action) add('a.action LIKE ?', `${req.valid.action.replace(/[\\%_]/g, '\\$&')}%`);
    if (req.valid.entity) add('a.entity = ?', req.valid.entity);
    if (req.valid.from) add('a.created_at >= ?::date', req.valid.from);
    if (req.valid.to) add("a.created_at < ?::date + INTERVAL '1 day'", req.valid.to);
    if (lp.search) add('(a.action ILIKE ? OR a.entity ILIKE ? OR a.old_data::text ILIKE ? OR a.new_data::text ILIKE ?)', likePattern(lp.search));
    params.push(lp.limit, lp.offset);
    // SQL: страница журнала действий с автором
    const { rows } = await query(
      `SELECT a.id, a.action, a.entity, a.entity_id, a.old_data, a.new_data, a.ip, a.created_at, a.user_id,
              u.first_name || ' ' || u.last_name AS author, u.email, r.code AS role, COUNT(*) OVER () AS total
         FROM audit_log a LEFT JOIN users u ON u.id = a.user_id LEFT JOIN roles r ON r.id = u.role_id
        WHERE ${where.join(' AND ')}
        ORDER BY ${lp.order}, a.id DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json(
      pageResult(
        rows.map((a) => ({ id: a.id, action: a.action, entity: a.entity, entityId: a.entity_id, oldData: a.old_data, newData: a.new_data, ip: a.ip, createdAt: a.created_at, userId: a.user_id, author: a.author, email: a.email, role: a.role })),
        Number(rows[0]?.total || 0),
        lp
      )
    );
  }
);

// GET /api/admin/audit/filters — значения фильтров журнала: сотрудники, типы действий и сущностей (роль: owner)
// Таблицы: audit_log, users, roles (SELECT DISTINCT)
router.get('/audit/filters', ownerOnly, async (req, res) => {
  const [users, actions, entities] = await Promise.all([
    query(`SELECT DISTINCT u.id, u.first_name || ' ' || u.last_name AS name, r.code AS role FROM audit_log a JOIN users u ON u.id = a.user_id JOIN roles r ON r.id = u.role_id ORDER BY name`),
    query("SELECT DISTINCT split_part(action, '.', 1) || '.' || split_part(action, '.', 2) AS action FROM audit_log ORDER BY 1"),
    query('SELECT DISTINCT entity FROM audit_log ORDER BY 1'),
  ]);
  res.json({ users: users.rows, actions: actions.rows.map((a) => a.action.replace(/\.$/, '')), entities: entities.rows.map((e) => e.entity) });
});

export default router;
