// Класс ошибки API: HTTP-статус + ключ сообщения из server/lib/i18n.js.
// Текст переводится на язык запроса в обработчике ошибок (server/middleware/errorHandler.js).
export class ApiError extends Error {
  constructor(status, messageKey, { params = {}, details = null, code = null } = {}) {
    super(messageKey);
    this.status = status;
    this.messageKey = messageKey;
    this.params = params;
    this.details = details;
    this.code = code;
  }

  static badRequest(key = 'errors.badRequest', opts) {
    return new ApiError(400, key, opts);
  }
  static unauthorized(key = 'errors.unauthorized', opts) {
    return new ApiError(401, key, opts);
  }
  static forbidden(key = 'errors.forbidden', opts) {
    return new ApiError(403, key, opts);
  }
  static notFound(key = 'errors.notFound', opts) {
    return new ApiError(404, key, opts);
  }
  static conflict(key = 'errors.conflict', opts) {
    return new ApiError(409, key, opts);
  }
}

export default ApiError;
