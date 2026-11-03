// Избранное (только для авторизованных — гостю показывается окно входа).
import express from 'express';
import { body, param } from 'express-validator';
import { query } from '../../../db/pool.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { ApiError } from '../../lib/errors.js';
import { CARD_SELECT, CARD_JOINS, toCard } from '../../services/productCards.js';

const router = express.Router();
router.use(requireAuth);

// GET /api/wishlist — товары в избранном (роль: любой авторизованный)
// Таблицы: wishlist JOIN products, brands, categories, product_images, product_variants, v_variant_stock (SELECT)
router.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT ${CARD_SELECT}, w.created_at AS added_at
       FROM wishlist w
       JOIN products p ON p.id = w.product_id
       ${CARD_JOINS}
      WHERE w.user_id = $1 AND p.moderation_status = 'approved'
      ORDER BY w.created_at DESC`,
    [req.user.id]
  );
  res.json({ items: rows.map((r) => ({ ...toCard(r), addedAt: r.added_at })) });
});

// POST /api/wishlist — добавить товар в избранное (роль: любой авторизованный)
// Таблицы: products (проверка), wishlist (INSERT … ON CONFLICT DO NOTHING)
router.post('/', validate([body('productId').isInt({ min: 1 }).toInt()]), async (req, res) => {
  const { rowCount } = await query("SELECT 1 FROM products WHERE id = $1 AND moderation_status = 'approved'", [req.body.productId]);
  if (!rowCount) throw new ApiError(404, 'catalog.productNotFound');
  await query('INSERT INTO wishlist (user_id, product_id) VALUES ($1, $2) ON CONFLICT (user_id, product_id) DO NOTHING', [req.user.id, req.body.productId]);
  const { rows } = await query('SELECT COUNT(*)::int AS n FROM wishlist WHERE user_id = $1', [req.user.id]);
  res.status(201).json({ ok: true, count: rows[0].n });
});

// DELETE /api/wishlist/:productId — убрать товар из избранного (роль: любой авторизованный)
// Таблицы: wishlist (DELETE)
router.delete('/:productId', validate([param('productId').isInt({ min: 1 }).toInt()]), async (req, res) => {
  await query('DELETE FROM wishlist WHERE user_id = $1 AND product_id = $2', [req.user.id, req.params.productId]);
  const { rows } = await query('SELECT COUNT(*)::int AS n FROM wishlist WHERE user_id = $1', [req.user.id]);
  res.json({ ok: true, count: rows[0].n });
});

export default router;
