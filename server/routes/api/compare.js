// Сравнение товаров (раздел 6.9 ТЗ): до 4 товаров. Гость хранит список в localStorage,
// авторизованный — в таблице comparisons (лимит проверяется в API и триггером trg_comparisons_limit).
import express from 'express';
import { body, param, query as q } from 'express-validator';
import { query, withTransaction } from '../../../db/pool.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { ApiError } from '../../lib/errors.js';
import { config } from '../../../config/index.js';
import { CARD_SELECT, CARD_JOINS, toCard } from '../../services/productCards.js';

const router = express.Router();
const MAX = config.shop.maxCompare;

// Данные для таблицы сравнения: карточка + коллекция, состав, размеры в наличии
// Таблицы: products, brands, categories, collections, product_images, product_variants, sizes, v_variant_stock (SELECT)
async function compareProducts(ids) {
  if (!ids.length) return [];
  const { rows } = await query(
    `SELECT ${CARD_SELECT}, p.composition_ru, p.composition_en,
            col.name AS collection_name, col.season AS collection_season, col.year AS collection_year
       FROM products p
       ${CARD_JOINS}
       LEFT JOIN collections col ON col.id = p.collection_id
      WHERE p.id = ANY($1::int[]) AND p.moderation_status = 'approved'`,
    [ids]
  );
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids
    .filter((id) => byId.has(id))
    .map((id) => {
      const r = byId.get(id);
      return {
        ...toCard(r),
        composition: { ru: r.composition_ru, en: r.composition_en },
        collection: r.collection_name ? { name: r.collection_name, season: r.collection_season, year: r.collection_year } : null,
      };
    });
}

const parseIds = (value) =>
  String(value || '')
    .split(',')
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, MAX);

// GET /api/compare/products?ids=1,2,3 — данные для гостевого сравнения (роль: любая). Таблицы: см. compareProducts
router.get('/products', validate([q('ids').optional().isString()]), async (req, res) => {
  res.json({ products: await compareProducts(parseIds(req.query.ids)) });
});

// GET /api/compare — сравнение текущего пользователя (роль: любой авторизованный)
// Таблицы: comparisons (SELECT) + данные товаров
router.get('/', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT product_id FROM comparisons WHERE user_id = $1 ORDER BY created_at', [req.user.id]);
  const ids = rows.map((r) => r.product_id);
  res.json({ ids, products: await compareProducts(ids) });
});

// POST /api/compare — добавить товар (роль: любой авторизованный). Не больше 4 — проверка на сервере.
// Таблицы: comparisons (SELECT COUNT, INSERT) — в транзакции с блокировкой строки пользователя
router.post('/', requireAuth, validate([body('productId').isInt({ min: 1 }).toInt()]), async (req, res) => {
  const ids = await withTransaction(async (client) => {
    // SQL: блокируем строку пользователя, чтобы параллельные запросы не обошли лимит
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [req.user.id]);
    const { rows } = await client.query('SELECT product_id FROM comparisons WHERE user_id = $1 ORDER BY created_at', [req.user.id]);
    const current = rows.map((r) => r.product_id);
    if (current.includes(req.body.productId)) return current;
    if (current.length >= MAX) throw new ApiError(409, 'compare.limit', { params: { max: MAX }, code: 'COMPARE_LIMIT' });
    const { rowCount } = await client.query("SELECT 1 FROM products WHERE id = $1 AND moderation_status = 'approved'", [req.body.productId]);
    if (!rowCount) throw new ApiError(404, 'catalog.productNotFound');
    await client.query('INSERT INTO comparisons (user_id, product_id) VALUES ($1, $2)', [req.user.id, req.body.productId]);
    return [...current, req.body.productId];
  });
  res.status(201).json({ ids });
});

// DELETE /api/compare/:productId — убрать товар из сравнения (роль: любой авторизованный). Таблицы: comparisons (DELETE)
router.delete('/:productId', requireAuth, validate([param('productId').isInt({ min: 1 }).toInt()]), async (req, res) => {
  await query('DELETE FROM comparisons WHERE user_id = $1 AND product_id = $2', [req.user.id, req.params.productId]);
  const { rows } = await query('SELECT product_id FROM comparisons WHERE user_id = $1 ORDER BY created_at', [req.user.id]);
  res.json({ ids: rows.map((r) => r.product_id) });
});

// DELETE /api/compare — очистить сравнение (роль: любой авторизованный). Таблицы: comparisons (DELETE)
router.delete('/', requireAuth, async (req, res) => {
  await query('DELETE FROM comparisons WHERE user_id = $1', [req.user.id]);
  res.json({ ids: [] });
});

// POST /api/compare/merge — перенос гостевого сравнения в БД после входа (роль: любой авторизованный)
// Таблицы: comparisons (INSERT … ON CONFLICT DO NOTHING, не больше 4)
router.post('/merge', requireAuth, validate([body('productIds').isArray({ max: 10 })]), async (req, res) => {
  const incoming = req.body.productIds.map(Number).filter((n) => Number.isInteger(n) && n > 0);
  const ids = await withTransaction(async (client) => {
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [req.user.id]);
    const { rows } = await client.query('SELECT product_id FROM comparisons WHERE user_id = $1 ORDER BY created_at', [req.user.id]);
    const current = rows.map((r) => r.product_id);
    for (const id of incoming) {
      if (current.length >= MAX) break;
      if (current.includes(id)) continue;
      const { rowCount } = await client.query("SELECT 1 FROM products WHERE id = $1 AND moderation_status = 'approved'", [id]);
      if (!rowCount) continue;
      await client.query('INSERT INTO comparisons (user_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.user.id, id]);
      current.push(id);
    }
    return current;
  });
  res.json({ ids });
});

export default router;
