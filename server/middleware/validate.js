// Обёртка над express-validator: запускает цепочки проверок и при ошибках
// возвращает 422 со списком полей и переведёнными сообщениями (ключи validation.* из server/lib/i18n.js).
import { validationResult, matchedData } from 'express-validator';
import { ApiError } from '../lib/errors.js';

export function validate(chains) {
  return [
    ...chains,
    (req, res, next) => {
      const result = validationResult(req);
      if (result.isEmpty()) {
        req.valid = matchedData(req, { onlyValidData: true, includeOptionals: false });
        return next();
      }
      const details = result.array({ onlyFirstError: true }).map((error) => {
        const raw = typeof error.msg === 'string' ? { key: error.msg, params: {} } : error.msg;
        return { field: error.path, message: req.t(raw.key, raw.params) };
      });
      next(new ApiError(422, 'errors.validation', { details }));
    },
  ];
}

// Сообщение с параметрами для withMessage: msg('validation.length', { min: 2, max: 60 })
export const msg = (key, params = {}) => ({ key, params });

export default validate;
