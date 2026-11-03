// Корзина (раздел 6.10 ТЗ). Авторизованный пользователь — корзина в БД;
// гость хранит корзину в localStorage и получает данные товаров через POST /api/cart/preview.
import express from 'express';
import { body, param } from 'express-validator';
import { query } from '../../../db/pool.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate, msg } from '../../middleware/validate.js';
import { ApiError } from '../../lib/errors.js';
import { getCart, previewItems, addItem, mergeItems, getVariant, MAX_QTY } from '../../services/cartService.js';

const router = express.Router();

// GET /api/cart — корзина текущего пользователя (роль: любой авторизованный)
// Таблицы: carts, cart_items, product_variants, products, brands, sizes, product_images, v_variant_stock (SELECT)
router.get('/', requireAuth, async (req, res) => {
  res.json(await getCart(req.user.id));
});

// POST /api/cart/preview — данные товаров для гостевой корзины из localStorage (роль: любая)
// Таблицы: product_variants + каталог (SELECT)
router.post(
  '/preview',
  validate([body('items').isArray({ max: 50 }).withMessage('errors.badRequest')]),
  async (req, res) => {
    res.json(await previewItems(req.body.items));
  }
);

// POST /api/cart/items — добавить вариант (товар + размер) в корзину (роль: любой авторизованный)
// Таблицы: carts (INSERT … ON CONFLICT), cart_items (INSERT … ON CONFLICT DO UPDATE quantity), v_variant_stock (проверка остатка)
router.post(
  '/items',
  requireAuth,
  validate([
    body('variantId').isInt({ min: 1 }).toInt().withMessage('validation.int'),
    body('quantity').optional().isInt({ min: 1, max: MAX_QTY }).toInt().withMessage(msg('validation.length', { min: 1, max: MAX_QTY })),
  ]),
  async (req, res) => {
    await addItem(req.user.id, req.body.variantId, req.body.quantity || 1);
    res.status(201).json(await getCart(req.user.id));
  }
);

// PATCH /api/cart/items/:id — изменить количество или размер позиции (роль: любой авторизованный, только своя корзина)
// Таблицы: cart_items (UPDATE / DELETE при слиянии одинаковых вариантов), v_variant_stock (проверка остатка)
router.patch(
  '/items/:id',
  requireAuth,
  validate([
    param('id').isInt({ min: 1 }).toInt(),
    body('quantity').optional().isInt({ min: 1, max: MAX_QTY }).toInt(),
    body('variantId').optional().isInt({ min: 1 }).toInt(),
  ]),
  async (req, res) => {
    // SQL: позиция должна принадлежать корзине текущего пользователя
    const { rows } = await query(
      `SELECT ci.id, ci.cart_id, ci.variant_id, ci.quantity
         FROM cart_items ci JOIN carts c ON c.id = ci.cart_id
        WHERE ci.id = $1 AND c.user_id = $2`,
      [req.params.id, req.user.id]
    );
    const item = rows[0];
    if (!item) throw new ApiError(404, 'cart.itemNotFound');

    const targetVariantId = req.body.variantId || item.variant_id;
    const quantity = req.body.quantity || item.quantity;
    const variant = await getVariant(targetVariantId);
    if (quantity > variant.available) throw new ApiError(409, 'cart.notEnoughStock', { params: { available: variant.available } });

    if (targetVariantId !== item.variant_id) {
      // Смена размера: если такой размер уже лежит в корзине — объединяем позиции
      // SQL: cart_items (UPDATE quantity у существующей позиции, DELETE старой) или UPDATE variant_id
      const { rows: same } = await query('SELECT id, quantity FROM cart_items WHERE cart_id = $1 AND variant_id = $2', [item.cart_id, targetVariantId]);
      if (same[0]) {
        const merged = Math.min(same[0].quantity + quantity, variant.available, MAX_QTY);
        await query('UPDATE cart_items SET quantity = $1 WHERE id = $2', [merged, same[0].id]);
        await query('DELETE FROM cart_items WHERE id = $1', [item.id]);
      } else {
        await query('UPDATE cart_items SET variant_id = $1, quantity = $2 WHERE id = $3', [targetVariantId, quantity, item.id]);
      }
    } else {
      await query('UPDATE cart_items SET quantity = $1 WHERE id = $2', [quantity, item.id]);
    }
    res.json(await getCart(req.user.id));
  }
);

// DELETE /api/cart/items/:id — удалить позицию (роль: любой авторизованный, только своя корзина)
// Таблицы: cart_items (DELETE с проверкой владельца через carts)
router.delete('/items/:id', requireAuth, validate([param('id').isInt({ min: 1 }).toInt()]), async (req, res) => {
  await query(
    `DELETE FROM cart_items ci USING carts c
      WHERE ci.cart_id = c.id AND ci.id = $1 AND c.user_id = $2`,
    [req.params.id, req.user.id]
  );
  res.json(await getCart(req.user.id));
});

// DELETE /api/cart — очистить корзину (роль: любой авторизованный). Таблицы: cart_items (DELETE)
router.delete('/', requireAuth, async (req, res) => {
  await query('DELETE FROM cart_items ci USING carts c WHERE ci.cart_id = c.id AND c.user_id = $1', [req.user.id]);
  res.json(await getCart(req.user.id));
});

// POST /api/cart/merge — перенос гостевой корзины в БД после входа (роль: любой авторизованный)
// Таблицы: carts, cart_items (INSERT … ON CONFLICT DO UPDATE)
router.post('/merge', requireAuth, validate([body('items').isArray({ max: 50 })]), async (req, res) => {
  await mergeItems(req.user.id, req.body.items);
  res.json(await getCart(req.user.id));
});

export default router;
