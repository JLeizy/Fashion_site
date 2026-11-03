// Авторизация, регистрация, аутентификация (раздел 6.2 ТЗ).
// Пароли — bcrypt; блокировка входа после 5 неудачных попыток на 15 минут; коды — в консоль сервера.
import express from 'express';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import { body } from 'express-validator';
import { query } from '../../../db/pool.js';
import { config } from '../../../config/index.js';
import { ensureCsrfToken } from '../../middleware/csrf.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { ApiError } from '../../lib/errors.js';
import { translate } from '../../lib/i18n.js';
import { getRates } from '../../services/rates.js';
import { issueCode, consumeCode, loginLockState, recordAttempt, findUserByEmail, establishSession, destroyUserSessions } from '../../services/authService.js';

const router = express.Router();
const DUMMY_HASH = bcrypt.hashSync('amfibia-timing-guard', config.auth.bcryptRounds);

// Ограничение частоты запросов к /api/auth (кроме GET /me): защита от перебора
router.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 80,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: (req) => req.method === 'GET',
    handler: (req, res) =>
      res.status(429).json({ error: { status: 429, code: 'RATE_LIMIT', message: translate(req.lang, 'errors.tooManyRequests'), details: null } }),
  })
);

// Общие правила проверки полей
const NAME_RE = /^[\p{L}][\p{L}\s'’.-]{0,59}$/u;
const rules = {
  email: () => body('email').trim().toLowerCase().isEmail().withMessage('validation.email').bail().isLength({ max: 255 }).withMessage('validation.email'),
  password: (field = 'password') =>
    body(field)
      .isString()
      .isLength({ min: 8, max: 72 })
      .withMessage('validation.password')
      .bail()
      .matches(/\p{L}/u)
      .withMessage('validation.password')
      .bail()
      .matches(/\d/)
      .withMessage('validation.password'),
  code: () => body('code').trim().matches(/^\d{6}$/).withMessage('validation.code'),
  name: (field) => body(field).trim().matches(NAME_RE).withMessage('validation.name'),
  phone: () => body('phone').trim().matches(/^\+\d{10,15}$/).withMessage('validation.phone'),
};

// Публичное представление пользователя (без хеша пароля и служебных полей)
export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    firstName: u.first_name,
    lastName: u.last_name,
    phone: u.phone,
    avatar: u.avatar,
    role: u.role,
    roleName: { ru: u.role_name_ru, en: u.role_name_en },
    emailVerified: u.email_verified,
    twoFactorEnabled: u.two_factor_enabled,
    lang: u.preferred_lang,
    theme: u.preferred_theme,
    currency: u.preferred_currency,
    createdAt: u.created_at,
  };
}

// Счётчики шапки и списки id для избранного и сравнения
// Таблицы: carts, cart_items, wishlist, comparisons, notifications (SELECT)
export async function headerState(userId) {
  const { rows } = await query(
    `SELECT
       (SELECT COALESCE(SUM(ci.quantity), 0)::int FROM carts c JOIN cart_items ci ON ci.cart_id = c.id WHERE c.user_id = $1) AS cart,
       (SELECT COUNT(*)::int FROM wishlist WHERE user_id = $1) AS wishlist,
       (SELECT COUNT(*)::int FROM comparisons WHERE user_id = $1) AS compare,
       (SELECT COUNT(*)::int FROM notifications WHERE user_id = $1 AND NOT is_read) AS notifications,
       (SELECT COALESCE(array_agg(product_id), '{}') FROM wishlist WHERE user_id = $1) AS wishlist_ids,
       (SELECT COALESCE(array_agg(product_id ORDER BY created_at), '{}') FROM comparisons WHERE user_id = $1) AS compare_ids`,
    [userId]
  );
  const r = rows[0];
  return {
    counts: { cart: r.cart, wishlist: r.wishlist, compare: r.compare, notifications: r.notifications },
    wishlistIds: r.wishlist_ids,
    compareIds: r.compare_ids,
  };
}

// Завершение входа: сессия, время последнего входа, ответ клиенту
// Таблицы: users (UPDATE last_login_at), login_attempts (INSERT success)
async function completeLogin(req, res, user, remember) {
  const csrfToken = await establishSession(req, user.id, remember);
  await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);
  await recordAttempt(user.email, req.ip, true);
  res.json({ ok: true, user: publicUser(user), csrfToken });
}

// GET /api/auth/me — текущий пользователь, CSRF-токен, курсы валют и счётчики шапки (роль: любая, включая гостя)
// Таблицы: users + roles (в loadUser), currency_rates, carts, cart_items, wishlist, comparisons, notifications (SELECT)
router.get('/me', async (req, res) => {
  const csrfToken = ensureCsrfToken(req);
  const rates = await getRates();
  // Настройки магазина для клиента (порог бесплатной доставки, лимит сравнения, срок возврата) — из config/index.js
  const shop = { freeDeliveryFromByn: config.shop.freeDeliveryFromByn, maxCompare: config.shop.maxCompare, returnDays: config.shop.returnDays };
  if (!req.user) return res.json({ user: null, csrfToken, rates, shop, counts: null, wishlistIds: [], compareIds: [] });
  res.json({ user: publicUser(req.user), csrfToken, rates, shop, ...(await headerState(req.user.id)) });
});

// POST /api/auth/register — регистрация покупателя (роль: гость)
// Таблицы: users (SELECT — занят ли email; INSERT с ролью buyer), roles (SELECT id), email_codes (INSERT — код подтверждения)
router.post(
  '/register',
  validate([
    rules.name('firstName'),
    rules.name('lastName'),
    rules.email(),
    rules.phone(),
    rules.password(),
    body('passwordConfirm').custom((value, { req }) => value === req.body.password).withMessage('validation.passwordMatch'),
    body('terms').custom((value) => value === true || value === 'true' || value === 'on').withMessage('validation.terms'),
  ]),
  async (req, res) => {
    const { firstName, lastName, email, phone, password } = req.body;
    const existing = await findUserByEmail(email);
    if (existing) throw new ApiError(409, 'auth.emailTaken', { details: [{ field: 'email', message: req.t('auth.emailTaken') }] });
    const hash = await bcrypt.hash(password, config.auth.bcryptRounds);
    const { rows } = await query(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone, role_id, preferred_lang)
       VALUES ($1, $2, $3, $4, $5, (SELECT id FROM roles WHERE code = 'buyer'), $6)
       RETURNING id, email`,
      [email, hash, firstName.trim(), lastName.trim(), phone, req.lang]
    );
    const timing = await issueCode(rows[0], 'verify', { force: true });
    res.status(201).json({ ok: true, needVerification: true, email, ...timing });
  }
);

// POST /api/auth/verify-email — подтверждение email 6-значным кодом и вход (роль: гость)
// Таблицы: users (SELECT, UPDATE email_verified), email_codes (SELECT, UPDATE used/attempts), session (новая сессия)
router.post('/verify-email', validate([rules.email(), rules.code(), body('remember').optional().isBoolean()]), async (req, res) => {
  const user = await findUserByEmail(req.body.email);
  if (!user) throw new ApiError(400, 'auth.codeInvalid');
  if (user.status !== 'active') throw new ApiError(403, user.status === 'blocked' ? 'auth.blocked' : 'auth.deleted');
  if (!user.email_verified) {
    await consumeCode(user.id, 'verify', req.body.code);
    await query('UPDATE users SET email_verified = TRUE WHERE id = $1', [user.id]);
    user.email_verified = true;
  }
  await completeLogin(req, res, user, Boolean(req.body.remember));
});

// POST /api/auth/resend-code — повторная отправка кода (роль: гость). Не чаще раза в 60 секунд.
// Таблицы: users (SELECT), email_codes (SELECT паузы, UPDATE, INSERT)
router.post('/resend-code', validate([rules.email(), body('type').isIn(['verify', 'reset', '2fa']).withMessage('validation.enum')]), async (req, res) => {
  const { type } = req.body;
  if (type === '2fa') {
    const pending = req.session.pending2fa;
    if (!pending) throw new ApiError(400, 'auth.twoFactorNoPending');
    const { rows } = await query('SELECT id, email FROM users WHERE id = $1', [pending.userId]);
    return res.json({ ok: true, message: req.t('auth.codeSent'), ...(await issueCode(rows[0], '2fa')) });
  }
  const user = await findUserByEmail(req.body.email);
  // Для сброса пароля не раскрываем, существует ли аккаунт
  if (!user || user.status !== 'active' || (type === 'verify' && user.email_verified)) {
    return res.json({ ok: true, message: req.t(type === 'reset' ? 'auth.resetSent' : 'auth.codeSent'), resendIn: config.auth.codeResendSeconds });
  }
  res.json({ ok: true, message: req.t('auth.codeSent'), ...(await issueCode(user, type)) });
});

// POST /api/auth/login — вход по email и паролю (роль: гость)
// Таблицы: login_attempts (SELECT — блокировка, INSERT — попытка), users JOIN roles (SELECT),
// email_codes (INSERT — код 2FA или подтверждения), session (новая сессия)
router.post('/login', validate([rules.email(), body('password').isString().isLength({ min: 1, max: 200 }).withMessage('validation.required'), body('remember').optional().isBoolean()]), async (req, res) => {
  const { email, password } = req.body;
  const remember = Boolean(req.body.remember);
  const lock = await loginLockState(email);
  if (lock.locked) throw new ApiError(429, 'auth.locked', { params: { minutes: lock.minutesLeft }, code: 'LOGIN_LOCKED' });

  const user = await findUserByEmail(email);
  // Если пользователя нет — всё равно тратим время на bcrypt, чтобы по скорости ответа нельзя было понять, есть ли аккаунт
  const valid = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!valid) {
    await recordAttempt(email, req.ip, false);
    const left = config.auth.maxLoginAttempts - lock.fails - 1;
    if (left <= 0) throw new ApiError(429, 'auth.locked', { params: { minutes: config.auth.lockMinutes }, code: 'LOGIN_LOCKED' });
    throw new ApiError(401, left <= 2 ? 'auth.attemptsLeft' : 'auth.invalidCredentials', { params: { left }, code: 'INVALID_CREDENTIALS' });
  }
  if (user.status === 'blocked') throw new ApiError(403, 'auth.blocked', { code: 'BLOCKED' });
  if (user.status === 'deleted') throw new ApiError(403, 'auth.deleted', { code: 'DELETED' });

  if (!user.email_verified) {
    const timing = await issueCode(user, 'verify', { force: true }).catch(() => ({ resendIn: config.auth.codeResendSeconds }));
    return res.json({ ok: false, needVerification: true, email: user.email, message: req.t('auth.emailNotVerified'), ...timing });
  }
  if (user.two_factor_enabled) {
    req.session.pending2fa = { userId: user.id, remember, at: Date.now() };
    const timing = await issueCode(user, '2fa', { force: true });
    return res.json({ ok: false, twoFactorRequired: true, email: user.email, message: req.t('auth.twoFactorRequired'), ...timing });
  }
  await completeLogin(req, res, user, remember);
});

// POST /api/auth/login/2fa — второй шаг входа: код 2FA (роль: гость с незавершённым входом в сессии)
// Таблицы: email_codes (SELECT, UPDATE), users JOIN roles (SELECT), session (новая сессия)
router.post('/login/2fa', validate([rules.code()]), async (req, res) => {
  const pending = req.session.pending2fa;
  if (!pending || Date.now() - pending.at > config.auth.codeTtlMinutes * 60_000) throw new ApiError(400, 'auth.twoFactorNoPending');
  await consumeCode(pending.userId, '2fa', req.body.code);
  const { rows } = await query(
    `SELECT u.*, r.code AS role, r.name_ru AS role_name_ru, r.name_en AS role_name_en
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
    [pending.userId]
  );
  const user = rows[0];
  if (!user || user.status !== 'active') throw new ApiError(403, 'auth.blocked');
  delete req.session.pending2fa;
  await completeLogin(req, res, user, pending.remember);
});

// POST /api/auth/logout — выход (роль: любой авторизованный). Таблицы: session (DELETE текущей сессии)
router.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('amf.sid');
    res.json({ ok: true, message: translate(req.lang, 'auth.loggedOut') });
  });
});

// POST /api/auth/forgot — запрос кода сброса пароля (роль: гость). Ответ одинаковый, даже если email не найден.
// Таблицы: users (SELECT), email_codes (INSERT)
router.post('/forgot', validate([rules.email()]), async (req, res) => {
  const user = await findUserByEmail(req.body.email);
  let timing = { resendIn: config.auth.codeResendSeconds };
  if (user && user.status === 'active') timing = await issueCode(user, 'reset');
  res.json({ ok: true, message: req.t('auth.resetSent'), ...timing });
});

// POST /api/auth/reset — новый пароль по коду (роль: гость)
// Таблицы: users (SELECT, UPDATE password_hash), email_codes (SELECT, UPDATE), session (DELETE — все сессии пользователя)
router.post(
  '/reset',
  validate([rules.email(), rules.code(), rules.password(), body('passwordConfirm').custom((v, { req }) => v === req.body.password).withMessage('validation.passwordMatch')]),
  async (req, res) => {
    const user = await findUserByEmail(req.body.email);
    if (!user || user.status !== 'active') throw new ApiError(400, 'auth.codeInvalid');
    await consumeCode(user.id, 'reset', req.body.code);
    const hash = await bcrypt.hash(req.body.password, config.auth.bcryptRounds);
    await query('UPDATE users SET password_hash = $1, email_verified = TRUE WHERE id = $2', [hash, user.id]);
    await destroyUserSessions(user.id);
    res.json({ ok: true, message: req.t('auth.resetDone') });
  }
);

// POST /api/auth/change-password — смена пароля в настройках профиля (роль: любой авторизованный)
// Таблицы: users (SELECT password_hash, UPDATE), session (DELETE — другие сессии пользователя)
router.post(
  '/change-password',
  requireAuth,
  validate([
    body('currentPassword').isString().isLength({ min: 1 }).withMessage('validation.required'),
    rules.password('newPassword'),
    body('newPasswordConfirm').custom((v, { req }) => v === req.body.newPassword).withMessage('validation.passwordMatch'),
  ]),
  async (req, res) => {
    const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!(await bcrypt.compare(req.body.currentPassword, rows[0].password_hash))) {
      throw new ApiError(400, 'auth.wrongPassword', { details: [{ field: 'currentPassword', message: req.t('auth.wrongPassword') }] });
    }
    if (await bcrypt.compare(req.body.newPassword, rows[0].password_hash)) {
      throw new ApiError(400, 'auth.samePassword', { details: [{ field: 'newPassword', message: req.t('auth.samePassword') }] });
    }
    const hash = await bcrypt.hash(req.body.newPassword, config.auth.bcryptRounds);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    await destroyUserSessions(req.user.id, req.sessionID);
    res.json({ ok: true, message: req.t('auth.passwordChanged') });
  }
);

// POST /api/auth/two-factor — включение / выключение 2FA (роль: любой авторизованный)
// Таблицы: users (UPDATE two_factor_enabled)
router.post('/two-factor', requireAuth, validate([body('enabled').isBoolean().withMessage('validation.enum')]), async (req, res) => {
  const enabled = req.body.enabled === true || req.body.enabled === 'true';
  await query('UPDATE users SET two_factor_enabled = $1 WHERE id = $2', [enabled, req.user.id]);
  res.json({ ok: true, enabled });
});

export default router;
