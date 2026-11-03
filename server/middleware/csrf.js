// CSRF-защита — собственная реализация по схеме «synchronizer token» (раздел 15 ТЗ; пакет csurf устарел).
// 1) Сервер хранит случайный токен в сессии (таблица session, поле sess.csrfToken).
// 2) Токен попадает на страницу в <meta name="csrf-token"> (server/lib/render.js) и в ответ GET /api/auth/me.
// 3) Клиент (public/js/core/api.js) отправляет его в заголовке X-CSRF-Token при POST / PUT / PATCH / DELETE.
// 4) Middleware сравнивает токены за постоянное время; не совпали — 403.
import crypto from 'node:crypto';
import { ApiError } from '../lib/errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Выдаёт токен текущей сессии (создаёт при первом обращении)
export function ensureCsrfToken(req) {
  if (!req.session) return '';
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  return req.session.csrfToken;
}

function tokensEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

export function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const sent = req.get('X-CSRF-Token');
  const expected = req.session?.csrfToken;
  if (!sent || !expected || !tokensEqual(sent, expected)) {
    return next(new ApiError(403, 'errors.csrf', { code: 'CSRF' }));
  }
  next();
}

export default csrfProtection;
