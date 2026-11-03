// Определение языка запроса (ru / en) — раздел 12 ТЗ.
// Приоритет: ?lang=… → заголовок X-Lang (его шлёт клиентский api.js) → cookie amf_lang → Accept-Language.
// После middleware в каждом запросе доступны req.lang и req.t(key, params).
import { translate, SUPPORTED_LANGS } from '../lib/i18n.js';

export function detectLang(req) {
  const candidates = [req.query?.lang, req.get('X-Lang'), req.cookies?.amf_lang];
  const explicit = candidates.find((value) => SUPPORTED_LANGS.includes(value));
  if (explicit) return explicit;
  return req.acceptsLanguages(...SUPPORTED_LANGS) || 'ru';
}

export function i18nMiddleware(req, res, next) {
  req.lang = detectLang(req);
  req.t = (key, params) => translate(req.lang, key, params);
  res.setHeader('Content-Language', req.lang);
  next();
}

export default i18nMiddleware;
