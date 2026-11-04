// Справочники админ-панели (раздел 8 ТЗ, роль owner): бренды, разделы историй брендов, события хронологии,
// креативные директора, коллекции, склады, способы доставки и оплаты, промокоды, баннеры главной; дерево категорий
// с перетаскиванием; курсы валют; загрузка изображений.
//
// Как устроено: ENTITIES — белый список таблиц и столбцов с типами. Имена таблиц и столбцов в SQL берутся ТОЛЬКО из этого
// словаря (пользовательский ввод не попадает в текст запроса), значения — только параметрами $1, $2…
// Пример: PUT /api/admin/refs/brands/3 → UPDATE brands SET name = $2, slug = $3, … WHERE id = $1.
// Каждое изменение пишется в audit_log с данными «было / стало».
import express from 'express';
import { body, param, query as q } from 'express-validator';
import { query, withTransaction } from '../../../db/pool.js';
import { checkRole } from '../../middleware/auth.js';
import { validate, msg } from '../../middleware/validate.js';
import { ApiError } from '../../lib/errors.js';
import { listValidators, listParams, pageResult, likePattern } from '../../lib/listing.js';
import { uploadAdminImage } from '../../middleware/upload.js';
import { audit } from '../../services/orderService.js';
import { invalidateRates } from '../../services/rates.js';

const router = express.Router();
router.use(checkRole()); // только владелец (owner)

// Типы полей: text [min, max], int [min, max], num [min, max], bool, slug, color, country, code, upper, date, enum [values],
// image (путь /images/… или /uploads/…), link (/путь), fk (таблица). opt: true — поле необязательно (NULL / '').
const t = (min, max, opt = false) => ({ type: 'text', min, max, opt });
const ENTITIES = {
  // Таблица brands — 15 модных домов (страница /brand/:slug, история /history/:slug)
  brands: {
    table: 'brands', order: 'sort_order, id', search: ['name', 'slug', 'founder'], sorts: ['name', 'founded_year', 'sort_order'],
    extra: '(SELECT COUNT(*)::int FROM products p WHERE p.brand_id = t.id) AS products_count, (SELECT COUNT(*)::int FROM brand_history_sections s WHERE s.brand_id = t.id) AS sections_count',
    fields: {
      name: t(2, 80), slug: { type: 'slug' }, country: { type: 'country' }, founded_year: { type: 'int', min: 1800, max: 2100 }, founder: t(2, 200),
      short_desc_ru: t(10, 2000), short_desc_en: t(10, 2000), hero_image: { type: 'image', opt: true }, accent_color: { type: 'color' }, sort_order: { type: 'int', min: 0, max: 999 },
    },
  },
  // Таблица brand_history_sections — разделы полной истории бренда (тексты в БД, страница /history/:slug)
  history: {
    table: 'brand_history_sections', parent: 'brand_id', order: 'sort_order, id', search: ['title_ru', 'title_en', 'period'], reorder: true,
    extra: 'length(t.content_ru) AS length_ru, length(t.content_en) AS length_en',
    fields: {
      brand_id: { type: 'fk', table: 'brands' }, sort_order: { type: 'int', min: 0, max: 999 }, period: t(0, 40, true), title_ru: t(2, 200), title_en: t(2, 200),
      content_ru: t(1, 200000), content_en: t(0, 200000, true), quote_ru: t(0, 2000, true), quote_en: t(0, 2000, true), quote_author: t(0, 120, true), image: { type: 'image', opt: true },
    },
  },
  // Таблица brand_timeline_events — интерактивная хронология на странице истории
  timeline: {
    table: 'brand_timeline_events', parent: 'brand_id', order: 'year, id', search: ['title_ru', 'title_en'],
    fields: { brand_id: { type: 'fk', table: 'brands' }, year: { type: 'int', min: 1800, max: 2100 }, title_ru: t(2, 200), title_en: t(2, 200), description_ru: t(0, 4000, true), description_en: t(0, 4000, true) },
  },
  // Таблица creative_directors — карточки креативных директоров
  directors: {
    table: 'creative_directors', parent: 'brand_id', order: 'years_from, id', search: ['name'],
    fields: {
      brand_id: { type: 'fk', table: 'brands' }, name: t(2, 120), years_from: { type: 'int', min: 1800, max: 2100 }, years_to: { type: 'int', min: 1800, max: 2100, opt: true },
      description_ru: t(0, 6000, true), description_en: t(0, 6000, true), key_collections_ru: t(0, 2000, true), key_collections_en: t(0, 2000, true), photo: { type: 'image', opt: true },
    },
  },
  // Таблица collections — коллекции брендов (вкладки на странице бренда, фильтр каталога)
  collections: {
    table: 'collections', parent: 'brand_id', order: 'year DESC, id DESC', search: ['name'], sorts: ['name', 'year'],
    extra: '(SELECT COUNT(*)::int FROM products p WHERE p.collection_id = t.id) AS products_count, (SELECT name FROM brands b WHERE b.id = t.brand_id) AS brand_name',
    fields: {
      brand_id: { type: 'fk', table: 'brands' }, name: t(2, 120), season: { type: 'enum', values: ['SS', 'FW', 'Resort', 'Pre-Fall'] }, year: { type: 'int', min: 1900, max: 2100 },
      is_new: { type: 'bool' }, cover_image: { type: 'image', opt: true }, description_ru: t(0, 2000, true), description_en: t(0, 2000, true),
    },
  },
  // Таблица warehouses — склады (остатки — stock, движения — stock_movements)
  warehouses: {
    table: 'warehouses', order: 'id', search: ['name', 'city'],
    extra: '(SELECT COALESCE(SUM(s.quantity), 0)::int FROM stock s WHERE s.warehouse_id = t.id) AS quantity',
    fields: { name: t(2, 120), city: t(2, 80), address: t(3, 200) },
  },
  // Таблица delivery_methods — способы доставки (шаг 3 оформления заказа)
  delivery: {
    table: 'delivery_methods', order: 'sort_order, id', search: ['code', 'name_ru', 'name_en'], reorder: true,
    extra: '(SELECT COUNT(*)::int FROM orders o WHERE o.delivery_method_id = t.id) AS orders_count',
    fields: {
      code: { type: 'code' }, name_ru: t(2, 80), name_en: t(2, 80), price_byn: { type: 'num', min: 0, max: 100000 }, days_min: { type: 'int', min: 0, max: 60 }, days_max: { type: 'int', min: 0, max: 90 },
      is_pickup: { type: 'bool' }, is_active: { type: 'bool' }, sort_order: { type: 'int', min: 0, max: 999 },
    },
    check: (v) => (v.days_max < v.days_min ? [{ field: 'days_max', key: 'validation.dateRange' }] : []),
  },
  // Таблица payment_methods — способы оплаты (шаг 4 оформления)
  payment: {
    table: 'payment_methods', order: 'sort_order, id', search: ['code', 'name_ru', 'name_en'], reorder: true,
    extra: '(SELECT COUNT(*)::int FROM orders o WHERE o.payment_method_id = t.id) AS orders_count',
    fields: { code: { type: 'code' }, name_ru: t(2, 80), name_en: t(2, 80), is_online: { type: 'bool' }, is_active: { type: 'bool' }, sort_order: { type: 'int', min: 0, max: 999 } },
  },
  // Таблица promo_codes — промокоды (корзина, оформление заказа)
  promos: {
    table: 'promo_codes', order: 'id DESC', search: ['code'], sorts: ['code', 'discount_percent', 'used_count', 'valid_to'],
    fields: {
      code: { type: 'upper' }, discount_percent: { type: 'int', min: 1, max: 90 }, valid_from: { type: 'date' }, valid_to: { type: 'date', opt: true },
      usage_limit: { type: 'int', min: 1, max: 1000000, opt: true }, is_active: { type: 'bool' },
    },
    check: (v) => (v.valid_to && v.valid_from && new Date(v.valid_to) <= new Date(v.valid_from) ? [{ field: 'valid_to', key: 'validation.dateRange' }] : []),
  },
  // Таблица banners — слайды hero главной страницы
  banners: {
    table: 'banners', order: 'sort_order, id', search: ['title_ru', 'title_en'], reorder: true,
    extra: '(SELECT name FROM brands b WHERE b.id = t.brand_id) AS brand_name',
    fields: {
      title_ru: t(2, 200), title_en: t(2, 200), subtitle_ru: t(0, 300, true), subtitle_en: t(0, 300, true), image: { type: 'image' }, link: { type: 'link' },
      brand_id: { type: 'fk', table: 'brands', opt: true }, collection_id: { type: 'fk', table: 'collections', opt: true }, sort_order: { type: 'int', min: 0, max: 999 }, is_active: { type: 'bool' },
    },
  },
};

// Проверка и приведение значений по описанию полей. Возвращает { values, details } (details — ошибки для 422).
function coerce(cfg, input, req) {
  const values = {};
  const details = [];
  const err = (field, key, params = {}) => details.push({ field, message: req.t(key, params) });
  for (const [name, f] of Object.entries(cfg.fields)) {
    let v = input[name];
    if (typeof v === 'string') v = v.trim();
    const empty = v === undefined || v === null || v === '';
    if (f.type === 'bool') {
      values[name] = v === true || v === 'true' || v === 1 || v === '1';
      continue;
    }
    if (empty) {
      // Пустой необязательный текст хранится как '' (столбцы NOT NULL DEFAULT ''), остальное — NULL
      if (f.opt) values[name] = f.type === 'text' ? '' : null;
      else err(name, 'validation.required');
      continue;
    }
    switch (f.type) {
      case 'text':
        if (typeof v !== 'string' || v.length < f.min || v.length > f.max) err(name, 'validation.length', { min: f.min, max: f.max });
        else values[name] = v;
        break;
      case 'int':
      case 'fk': {
        const n = Number(v);
        const min = f.type === 'fk' ? 1 : f.min;
        const max = f.type === 'fk' ? 2147483647 : f.max;
        if (!Number.isInteger(n) || n < min || n > max) err(name, 'validation.int');
        else values[name] = n;
        break;
      }
      case 'num': {
        const n = Number(v);
        if (!Number.isFinite(n) || n < f.min || n > f.max) err(name, 'validation.nonNegative');
        else values[name] = Math.round(n * 100) / 100;
        break;
      }
      case 'slug':
        if (!/^[a-z0-9-]{2,80}$/.test(v)) err(name, 'validation.slug');
        else values[name] = v;
        break;
      case 'code':
        if (!/^[a-z0-9_]{2,20}$/.test(v)) err(name, 'validation.slug');
        else values[name] = v;
        break;
      case 'upper':
        if (!/^[A-Za-z0-9_-]{2,30}$/.test(v)) err(name, 'validation.slug');
        else values[name] = v.toUpperCase();
        break;
      case 'color':
        if (!/^#[0-9A-Fa-f]{6}$/.test(v)) err(name, 'validation.color');
        else values[name] = v.toUpperCase();
        break;
      case 'country':
        if (!/^[A-Za-z]{2}$/.test(v)) err(name, 'validation.country');
        else values[name] = v.toUpperCase();
        break;
      case 'date':
        if (Number.isNaN(Date.parse(v))) err(name, 'validation.date');
        else values[name] = new Date(v).toISOString();
        break;
      case 'enum':
        if (!f.values.includes(v)) err(name, 'validation.enum');
        else values[name] = v;
        break;
      case 'image':
        if (!/^\/(images|uploads)\/[\w./-]{1,400}$/.test(v) || v.includes('..')) err(name, 'validation.enum');
        else values[name] = v;
        break;
      case 'link':
        if (!/^\/[\w\-./?=&%#,]{0,290}$/.test(v)) err(name, 'validation.enum');
        else values[name] = v;
        break;
      default:
        err(name, 'validation.enum');
    }
  }
  if (!details.length && cfg.check) cfg.check(values).forEach((e) => err(e.field, e.key));
  return { values, details };
}

function entityOf(req) {
  const cfg = ENTITIES[req.params.entity];
  if (!cfg) throw ApiError.notFound('errors.apiNotFound');
  return cfg;
}

// ---------------------------------------------------------------------------------------------
// GET /api/admin/refs/:entity?brand=&q=&page=&limit=&sort=&dir= — список записей справочника (роль: owner)
// Таблица: из ENTITIES[entity].table (SELECT) + подсчёты из extra (products, orders, stock…)
// ---------------------------------------------------------------------------------------------
router.get('/refs/:entity', validate([...listValidators, q('brand').optional({ values: 'falsy' }).isInt({ min: 1 }).toInt()]), async (req, res) => {
  const cfg = entityOf(req);
  const sortMap = Object.fromEntries([['default', cfg.order], ...(cfg.sorts || []).map((s) => [s, `t.${s}`])]);
  const lp = listParams(req, sortMap, 'default', 'asc', 50);
  const params = [];
  const where = ['TRUE'];
  if (cfg.parent && req.valid.brand) {
    params.push(req.valid.brand);
    where.push(`t.${cfg.parent} = $${params.length}`);
  }
  if (lp.search) {
    params.push(likePattern(lp.search));
    where.push(`(${cfg.search.map((c) => `t.${c}::text ILIKE $${params.length}`).join(' OR ')})`);
  }
  params.push(lp.limit, lp.offset);
  const order = lp.sortKey === 'default' ? cfg.order.split(',').map((s) => `t.${s.trim()}`).join(', ') : lp.order;
  // SQL: страница справочника (таблица и столбцы — из белого списка ENTITIES)
  const { rows } = await query(
    `SELECT t.*${cfg.extra ? `, ${cfg.extra}` : ''}, COUNT(*) OVER () AS total
       FROM ${cfg.table} t
      WHERE ${where.join(' AND ')}
      ORDER BY ${order}
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  const total = Number(rows[0]?.total || 0);
  rows.forEach((r) => delete r.total);
  res.json(pageResult(rows, total, lp));
});

// GET /api/admin/refs/:entity/:id — одна запись (роль: owner). Таблица: ENTITIES[entity].table (SELECT)
router.get('/refs/:entity/:id', validate([param('id').isInt({ min: 1 }).toInt()]), async (req, res) => {
  const cfg = entityOf(req);
  const { rows } = await query(`SELECT t.*${cfg.extra ? `, ${cfg.extra}` : ''} FROM ${cfg.table} t WHERE t.id = $1`, [req.valid.id]);
  if (!rows[0]) throw ApiError.notFound();
  res.json({ item: rows[0] });
});

// POST /api/admin/refs/:entity — новая запись (роль: owner). Транзакция: INSERT в таблицу справочника, audit_log (INSERT)
router.post('/refs/:entity', async (req, res) => {
  const cfg = entityOf(req);
  const { values, details } = coerce(cfg, req.body || {}, req);
  if (details.length) throw new ApiError(422, 'errors.validation', { details });
  const cols = Object.keys(values);
  const item = await withTransaction(async (client) => {
    // SQL: INSERT INTO <таблица> (<столбцы из белого списка>) VALUES ($1, $2, …)
    const { rows } = await client.query(`INSERT INTO ${cfg.table} (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`, cols.map((c) => values[c]));
    await audit(client, { userId: req.user.id, action: `${req.params.entity}.create`, entity: cfg.table, entityId: rows[0].id, newData: values, ip: req.ip });
    return rows[0];
  });
  res.status(201).json({ item });
});

// PUT /api/admin/refs/:entity/:id — изменение записи (роль: owner).
// Транзакция: SELECT … FOR UPDATE (данные «было»), UPDATE таблицы справочника, audit_log (INSERT «было / стало»)
router.put('/refs/:entity/:id', validate([param('id').isInt({ min: 1 }).toInt()]), async (req, res) => {
  const cfg = entityOf(req);
  const { values, details } = coerce(cfg, req.body || {}, req);
  if (details.length) throw new ApiError(422, 'errors.validation', { details });
  const cols = Object.keys(values);
  const item = await withTransaction(async (client) => {
    const old = await client.query(`SELECT * FROM ${cfg.table} WHERE id = $1 FOR UPDATE`, [req.valid.id]);
    if (!old.rows[0]) throw ApiError.notFound();
    // SQL: UPDATE <таблица> SET <столбец> = $2, … WHERE id = $1
    const { rows } = await client.query(`UPDATE ${cfg.table} SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')} WHERE id = $1 RETURNING *`, [req.valid.id, ...cols.map((c) => values[c])]);
    const before = Object.fromEntries(cols.map((c) => [c, old.rows[0][c]]));
    const changed = cols.filter((c) => JSON.stringify(before[c]) !== JSON.stringify(rows[0][c]));
    if (changed.length) {
      await audit(client, { userId: req.user.id, action: `${req.params.entity}.update`, entity: cfg.table, entityId: req.valid.id, oldData: Object.fromEntries(changed.map((c) => [c, before[c]])), newData: Object.fromEntries(changed.map((c) => [c, rows[0][c]])), ip: req.ip });
    }
    return rows[0];
  });
  res.json({ item });
});

// DELETE /api/admin/refs/:entity/:id — удаление (роль: owner). Если запись используется (внешний ключ RESTRICT) — 409 admin.inUse.
// Транзакция: SELECT, DELETE из таблицы справочника, audit_log (INSERT)
router.delete('/refs/:entity/:id', validate([param('id').isInt({ min: 1 }).toInt()]), async (req, res) => {
  const cfg = entityOf(req);
  try {
    await withTransaction(async (client) => {
      // SQL: DELETE FROM <таблица> WHERE id = $1
      const { rows } = await client.query(`DELETE FROM ${cfg.table} WHERE id = $1 RETURNING *`, [req.valid.id]);
      if (!rows[0]) throw ApiError.notFound();
      await audit(client, { userId: req.user.id, action: `${req.params.entity}.delete`, entity: cfg.table, entityId: req.valid.id, oldData: rows[0], ip: req.ip });
    });
  } catch (err) {
    if (err.code === '23503') throw new ApiError(409, 'admin.inUse');
    throw err;
  }
  res.json({ ok: true });
});

// POST /api/admin/refs/:entity/reorder {ids} — новый порядок записей после перетаскивания (роль: owner)
// Транзакция: UPDATE <таблица> SET sort_order = позиция для каждой записи, audit_log (INSERT)
router.post('/refs/:entity/reorder', validate([body('ids').isArray({ min: 1, max: 500 }), body('ids.*').isInt({ min: 1 }).toInt()]), async (req, res) => {
  const cfg = entityOf(req);
  if (!cfg.reorder && !cfg.fields.sort_order) throw ApiError.badRequest();
  await withTransaction(async (client) => {
    for (const [i, id] of req.valid.ids.entries()) {
      // SQL: позиция записи в списке
      await client.query(`UPDATE ${cfg.table} SET sort_order = $2 WHERE id = $1`, [id, (i + 1) * 10]);
    }
    await audit(client, { userId: req.user.id, action: `${req.params.entity}.reorder`, entity: cfg.table, newData: { ids: req.valid.ids }, ip: req.ip });
  });
  res.json({ ok: true });
});

// =============================================================================================
// КАТЕГОРИИ — дерево с перетаскиванием
// =============================================================================================
// GET /api/admin/categories — плоский список категорий с числом товаров (роль: owner). Таблицы: categories, products (SELECT)
router.get('/categories', async (req, res) => {
  // SQL: все категории + количество товаров в каждой
  const { rows } = await query(
    `SELECT c.id, c.parent_id, c.slug, c.name_ru, c.name_en, c.size_type, c.sort_order,
            (SELECT COUNT(*)::int FROM products p WHERE p.category_id = c.id) AS products
       FROM categories c ORDER BY c.parent_id NULLS FIRST, c.sort_order, c.id`
  );
  res.json({ categories: rows.map((c) => ({ id: c.id, parentId: c.parent_id, slug: c.slug, name: { ru: c.name_ru, en: c.name_en }, sizeType: c.size_type, sortOrder: c.sort_order, products: c.products })) });
});

const categoryRules = [
  body('parentId').optional({ values: 'null' }).isInt({ min: 1 }).toInt(),
  body('slug').isString().trim().matches(/^[a-z0-9-]{2,60}$/).withMessage(msg('validation.slug')),
  body('nameRu').isString().trim().isLength({ min: 2, max: 80 }).withMessage(msg('validation.length', { min: 2, max: 80 })),
  body('nameEn').isString().trim().isLength({ min: 2, max: 80 }).withMessage(msg('validation.length', { min: 2, max: 80 })),
  body('sizeType').optional({ values: 'null' }).isIn(['clothing', 'shoes', 'ring', 'one_size', 'volume_ml']).withMessage(msg('validation.enum')),
];

// POST /api/admin/categories — новая категория (роль: owner). Транзакция: categories (INSERT, sort_order — в конец), audit_log
router.post('/categories', validate(categoryRules), async (req, res) => {
  const v = req.valid;
  const item = await withTransaction(async (client) => {
    // SQL: новая категория в конце списка своего уровня
    const { rows } = await client.query(
      `INSERT INTO categories (parent_id, slug, name_ru, name_en, size_type, sort_order)
       VALUES ($1, $2, $3, $4, $5, (SELECT COALESCE(MAX(sort_order), 0) + 10 FROM categories WHERE parent_id IS NOT DISTINCT FROM $1)) RETURNING *`,
      [v.parentId || null, v.slug, v.nameRu, v.nameEn, v.sizeType || null]
    );
    await audit(client, { userId: req.user.id, action: 'categories.create', entity: 'categories', entityId: rows[0].id, newData: rows[0], ip: req.ip });
    return rows[0];
  });
  res.status(201).json({ item });
});

// PUT /api/admin/categories/:id — изменение названия, slug, размерной сетки (роль: owner). Транзакция: categories (UPDATE), audit_log
router.put('/categories/:id', validate([param('id').isInt({ min: 1 }).toInt(), ...categoryRules.slice(1)]), async (req, res) => {
  const v = req.valid;
  await withTransaction(async (client) => {
    const old = await client.query('SELECT * FROM categories WHERE id = $1 FOR UPDATE', [v.id]);
    if (!old.rows[0]) throw ApiError.notFound();
    // SQL: новые данные категории
    await client.query('UPDATE categories SET slug = $2, name_ru = $3, name_en = $4, size_type = $5 WHERE id = $1', [v.id, v.slug, v.nameRu, v.nameEn, v.sizeType || null]);
    const o = old.rows[0];
    await audit(client, { userId: req.user.id, action: 'categories.update', entity: 'categories', entityId: v.id, oldData: { slug: o.slug, name_ru: o.name_ru, name_en: o.name_en, size_type: o.size_type }, newData: { slug: v.slug, name_ru: v.nameRu, name_en: v.nameEn, size_type: v.sizeType || null }, ip: req.ip });
  });
  res.json({ ok: true });
});

// DELETE /api/admin/categories/:id — удаление пустой категории (роль: owner). Если есть подкатегории или товары — 409 (RESTRICT).
router.delete('/categories/:id', validate([param('id').isInt({ min: 1 }).toInt()]), async (req, res) => {
  try {
    await withTransaction(async (client) => {
      // SQL: удаление категории
      const { rows } = await client.query('DELETE FROM categories WHERE id = $1 RETURNING *', [req.valid.id]);
      if (!rows[0]) throw ApiError.notFound();
      await audit(client, { userId: req.user.id, action: 'categories.delete', entity: 'categories', entityId: req.valid.id, oldData: rows[0], ip: req.ip });
    });
  } catch (err) {
    if (err.code === '23503') throw new ApiError(409, 'admin.inUse');
    throw err;
  }
  res.json({ ok: true });
});

// POST /api/admin/categories/move {id, parentId, ids} — перенос категории (перетаскивание): новый родитель и порядок соседей
// (роль: owner). Проверка цикла (категорию нельзя вложить в её же потомка) — рекурсивный CTE.
// Транзакция: categories (UPDATE parent_id, sort_order), audit_log (INSERT)
router.post(
  '/categories/move',
  validate([body('id').isInt({ min: 1 }).toInt(), body('parentId').optional({ values: 'null' }).isInt({ min: 1 }).toInt(), body('ids').isArray({ min: 1, max: 500 }), body('ids.*').isInt({ min: 1 }).toInt()]),
  async (req, res) => {
    const v = req.valid;
    await withTransaction(async (client) => {
      if (v.parentId) {
        if (v.parentId === v.id) throw new ApiError(409, 'admin.categoryCycle');
        // SQL: все потомки переносимой категории (WITH RECURSIVE) — новый родитель не может быть среди них
        const desc = await client.query(
          `WITH RECURSIVE d AS (SELECT id FROM categories WHERE parent_id = $1 UNION ALL SELECT c.id FROM categories c JOIN d ON c.parent_id = d.id)
           SELECT 1 FROM d WHERE id = $2`,
          [v.id, v.parentId]
        );
        if (desc.rowCount) throw new ApiError(409, 'admin.categoryCycle');
      }
      const old = await client.query('SELECT parent_id FROM categories WHERE id = $1 FOR UPDATE', [v.id]);
      if (!old.rows[0]) throw ApiError.notFound();
      // SQL: новый родитель
      await client.query('UPDATE categories SET parent_id = $2 WHERE id = $1', [v.id, v.parentId || null]);
      for (const [i, id] of v.ids.entries()) {
        // SQL: порядок категорий внутри нового родителя
        await client.query('UPDATE categories SET sort_order = $2 WHERE id = $1 AND parent_id IS NOT DISTINCT FROM $3', [id, (i + 1) * 10, v.parentId || null]);
      }
      await audit(client, { userId: req.user.id, action: 'categories.move', entity: 'categories', entityId: v.id, oldData: { parent_id: old.rows[0].parent_id }, newData: { parent_id: v.parentId || null, order: v.ids }, ip: req.ip });
    });
    res.json({ ok: true });
  }
);

// =============================================================================================
// КУРСЫ ВАЛЮТ
// =============================================================================================
// GET /api/admin/rates — курсы USD / EUR к BYN и кто менял (роль: owner). Таблицы: currency_rates, users (SELECT)
router.get('/rates', async (req, res) => {
  const { rows } = await query(
    `SELECT c.code, c.rate_to_byn, c.updated_at, u.first_name || ' ' || u.last_name AS updated_by
       FROM currency_rates c LEFT JOIN users u ON u.id = c.updated_by ORDER BY c.id`
  );
  res.json({ rates: rows.map((r) => ({ code: r.code, rate: Number(r.rate_to_byn), updatedAt: r.updated_at, updatedBy: r.updated_by })) });
});

// PUT /api/admin/rates {USD, EUR} — новые курсы (роль: owner). Транзакция: currency_rates (UPDATE), audit_log (INSERT);
// кэш курсов на сервере сбрасывается (services/rates.js → invalidateRates), новые цены видны сразу.
router.put(
  '/rates',
  validate([body('USD').isFloat({ min: 0.0001, max: 1000 }).withMessage(msg('validation.positive')).toFloat(), body('EUR').isFloat({ min: 0.0001, max: 1000 }).withMessage(msg('validation.positive')).toFloat()]),
  async (req, res) => {
    await withTransaction(async (client) => {
      const old = await client.query("SELECT code, rate_to_byn FROM currency_rates WHERE code IN ('USD', 'EUR') FOR UPDATE");
      for (const code of ['USD', 'EUR']) {
        // SQL: курс валюты к BYN
        await client.query('UPDATE currency_rates SET rate_to_byn = $2, updated_at = NOW(), updated_by = $3 WHERE code = $1', [code, req.valid[code], req.user.id]);
      }
      await audit(client, { userId: req.user.id, action: 'rates.update', entity: 'currency_rates', oldData: Object.fromEntries(old.rows.map((r) => [r.code, Number(r.rate_to_byn)])), newData: { USD: req.valid.USD, EUR: req.valid.EUR }, ip: req.ip });
    });
    invalidateRates();
    res.json({ ok: true });
  }
);

// POST /api/admin/upload — загрузка изображения для справочников (обложки, hero, портреты, баннеры) (роль: owner)
// multer: только JPG/PNG/WEBP/GIF, лимит размера; файл → public/uploads/content/, в ответе — путь для записи в БД
router.post('/upload', uploadAdminImage, (req, res) => {
  if (!req.file) throw ApiError.badRequest();
  res.status(201).json({ url: req.file.publicUrl });
});

export default router;
