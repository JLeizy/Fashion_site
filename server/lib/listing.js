// Общие параметры списков для кабинетов сотрудников и админки: страница, размер страницы, сортировка, поиск.
// Сортировка — только по белому списку столбцов (имя столбца нельзя передать параметром $1, поэтому
// пользовательский ввод сопоставляется со словарём и в SQL подставляется только значение из словаря).
import { query as q } from 'express-validator';

// Валидаторы: ?page=1&limit=20&sort=created_at&dir=desc&q=текст
export const listValidators = [
  q('page').optional().isInt({ min: 1, max: 100000 }).toInt(),
  q('limit').optional().isInt({ min: 1, max: 1000 }).toInt(),
  q('sort').optional().isString().isLength({ max: 40 }),
  q('dir').optional().isIn(['asc', 'desc']),
  q('q').optional().isString().trim().isLength({ max: 120 }),
];

// Разбор параметров списка. sortMap: { ключ из URL: 'выражение SQL' }; defaultSort — ключ из sortMap
export function listParams(req, sortMap, defaultSort, defaultDir = 'desc', defaultLimit = 20) {
  const v = req.valid || {};
  const page = v.page || 1;
  const limit = v.limit || defaultLimit;
  const sortKey = Object.hasOwn(sortMap, v.sort || '') ? v.sort : defaultSort;
  const dir = (v.dir || defaultDir) === 'asc' ? 'ASC' : 'DESC';
  return {
    page,
    limit,
    offset: (page - 1) * limit,
    order: `${sortMap[sortKey]} ${dir} NULLS LAST`,
    search: v.q ? String(v.q).trim() : '',
    sortKey,
    dir: dir.toLowerCase(),
  };
}

// Ответ со страницей: { rows, total, page, pages, limit }
export function pageResult(rows, total, { page, limit }) {
  return { rows, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

// Строка поиска для ILIKE (экранирование % и _ — чтобы пользователь искал их буквально)
export const likePattern = (text) => `%${String(text).replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

export default { listValidators, listParams, pageResult, likePattern };
