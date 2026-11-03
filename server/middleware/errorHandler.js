// Централизованная обработка ошибок.
// API (/api/...) получает JSON { error: { status, code, message, details } } на языке запроса;
// HTML-страницы получают оформленные страницы views/404.html, views/403.html, views/500.html.
import { ApiError } from '../lib/errors.js';
import { renderPage } from '../lib/render.js';

export function notFoundHandler(req, res, next) {
  if (req.path.startsWith('/api/')) return next(new ApiError(404, 'errors.apiNotFound'));
  next(new ApiError(404, 'errors.notFound'));
}

// Ошибки PostgreSQL и прочие исключения → понятный статус и ключ сообщения
function normalize(err) {
  if (err instanceof ApiError) return err;
  if (err?.type === 'entity.parse.failed') return new ApiError(400, 'errors.badRequest');
  if (err?.type === 'entity.too.large') return new ApiError(413, 'errors.badRequest');

  // Собственные исключения из триггеров БД: RAISE EXCEPTION 'AMF:compare.limit' (код P0001)
  if (err?.code === 'P0001' && typeof err.message === 'string' && err.message.startsWith('AMF:')) {
    const [key, ...rest] = err.message.slice(4).split('|');
    const params = Object.fromEntries(rest.map((pair) => pair.split('=')));
    return new ApiError(409, key, { params, code: key });
  }
  switch (err?.code) {
    case '23505':
      return new ApiError(409, 'errors.conflict', { code: 'UNIQUE', details: err.constraint || null });
    case '23503':
      return new ApiError(409, 'errors.fkViolation', { code: 'FOREIGN_KEY', details: err.constraint || null });
    case '23514':
      return new ApiError(400, 'errors.checkViolation', { code: 'CHECK', details: err.constraint || null });
    case '22P02':
    case '22003':
      return new ApiError(400, 'errors.badRequest', { code: 'INVALID_INPUT' });
    case 'ECONNREFUSED':
    case '57P01':
    case '57P03':
      return new ApiError(503, 'errors.dbUnavailable', { code: 'DB_UNAVAILABLE' });
    default:
      return null;
  }
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const apiError = normalize(err) || new ApiError(500, 'errors.internal', { code: 'INTERNAL' });
  if (apiError.status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}\n`, err?.stack || err, err?.sql ? `\nSQL: ${err.sql}` : '');
  }
  if (res.headersSent) return;

  const t = req.t || ((key) => key);
  const wantsJson = req.path.startsWith('/api/') || req.get('Accept')?.includes('application/json');
  if (wantsJson) {
    return res.status(apiError.status).json({
      error: {
        status: apiError.status,
        code: apiError.code,
        message: t(apiError.messageKey, apiError.params),
        details: apiError.details,
      },
    });
  }

  const view = apiError.status === 403 ? '403.html' : apiError.status === 404 ? '404.html' : '500.html';
  try {
    renderPage(req, res, view, { page: `error-${apiError.status}`, title: `${apiError.status} — AMFIBIA` }, apiError.status);
  } catch (renderErr) {
    console.error('[error] Не удалось отрисовать страницу ошибки:', renderErr.message);
    res.status(apiError.status).type('text').send(`${apiError.status} — ${t(apiError.messageKey)}`);
  }
}

export default errorHandler;
