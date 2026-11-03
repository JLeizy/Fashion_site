// Авторизация и проверка ролей (раздел 4 ТЗ). Права проверяются ТОЛЬКО на сервере.
//   loadUser       — подгружает пользователя по req.session.userId (для каждого запроса);
//   requireAuth    — пропускает только вошедших;
//   checkRole(...) — пропускает только указанные роли; owner (создатель магазина) проходит всегда.
import { query } from '../../db/pool.js';
import { ApiError } from '../lib/errors.js';

// loadUser — текущий пользователь из БД.
// Таблицы: users (SELECT), roles (SELECT). Доступ: любой запрос.
// Если пользователь заблокирован или удалён — его сессия уничтожается (раздел 15: «активные сессии завершаются»).
export async function loadUser(req, res, next) {
  req.user = null;
  const userId = req.session?.userId;
  if (!userId) return next();

  // SQL: данные пользователя вместе с кодом роли (users JOIN roles)
  const { rows } = await query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.avatar, u.status,
            u.email_verified, u.two_factor_enabled, u.preferred_lang, u.preferred_theme,
            u.preferred_currency, u.created_at, u.last_login_at,
            r.code AS role, r.name_ru AS role_name_ru, r.name_en AS role_name_en
       FROM users u
       JOIN roles r ON r.id = u.role_id
      WHERE u.id = $1`,
    [userId]
  );
  const user = rows[0];
  if (!user || user.status !== 'active') {
    await new Promise((resolve) => req.session.destroy(() => resolve()));
    res.clearCookie('amf.sid');
    return next();
  }
  req.user = user;
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return next(ApiError.unauthorized());
  next();
}

// checkRole('warehouse', 'support') — доступ только этим ролям (и owner)
export function checkRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (req.user.role === 'owner' || roles.includes(req.user.role)) return next();
    next(ApiError.forbidden());
  };
}

// Для HTML-страниц: гость перенаправляется на /auth?next=…, чужая роль получает страницу 403
export function pageRequireAuth(req, res, next) {
  if (!req.user) return res.redirect(`/auth?next=${encodeURIComponent(req.originalUrl)}`);
  next();
}

export function pageCheckRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.redirect(`/auth?next=${encodeURIComponent(req.originalUrl)}`);
    if (req.user.role === 'owner' || roles.includes(req.user.role)) return next();
    next(ApiError.forbidden());
  };
}

export const isStaff = (user) => Boolean(user) && user.role !== 'buyer';

export default { loadUser, requireAuth, checkRole, pageRequireAuth, pageCheckRole, isStaff };
