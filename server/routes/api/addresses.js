// Адресная книга покупателя (раздел 4: buyer → «Адресная книга (CRUD)»). Используется в профиле и на шаге
// «Адрес» оформления заказа. Каждый маршрут работает только с адресами текущего пользователя.
import express from 'express';
import { body, param } from 'express-validator';
import { query, withTransaction } from '../../../db/pool.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate, msg } from '../../middleware/validate.js';
import { ApiError } from '../../lib/errors.js';

const router = express.Router();
router.use(requireAuth);

export const CIS_COUNTRIES = ['BY', 'RU', 'KZ', 'AM', 'UZ', 'KG', 'AZ', 'TJ', 'MD', 'GE'];

export const addressValidators = (prefix = '') => [
  body(`${prefix}country`).isIn(CIS_COUNTRIES).withMessage(msg('validation.country')),
  body(`${prefix}city`).isString().trim().isLength({ min: 2, max: 80 }).withMessage(msg('validation.length', { min: 2, max: 80 })),
  body(`${prefix}street`).isString().trim().isLength({ min: 2, max: 120 }).withMessage(msg('validation.length', { min: 2, max: 120 })),
  body(`${prefix}house`).isString().trim().isLength({ min: 1, max: 20 }).withMessage(msg('validation.length', { min: 1, max: 20 })),
  body(`${prefix}apartment`).optional({ values: 'falsy' }).isString().trim().isLength({ max: 20 }),
  body(`${prefix}postalCode`).optional({ values: 'falsy' }).isString().trim().matches(/^[0-9A-Za-z -]{3,12}$/).withMessage(msg('validation.length', { min: 3, max: 12 })),
  body(`${prefix}recipient`).isString().trim().isLength({ min: 2, max: 120 }).withMessage(msg('validation.length', { min: 2, max: 120 })),
  body(`${prefix}phone`).isString().trim().matches(/^\+\d[\d ()-]{7,20}$/).withMessage(msg('validation.phone')),
];

export const toAddress = (a) => ({
  id: a.id,
  country: a.country,
  city: a.city,
  street: a.street,
  house: a.house,
  apartment: a.apartment,
  postalCode: a.postal_code,
  recipient: a.recipient,
  phone: a.phone,
  isDefault: a.is_default,
});

// GET /api/addresses — адреса текущего пользователя (роль: любой авторизованный). Таблица: addresses (SELECT)
router.get('/', async (req, res) => {
  const { rows } = await query('SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC', [req.user.id]);
  res.json({ addresses: rows.map(toAddress) });
});

// POST /api/addresses — новый адрес (роль: любой авторизованный). Таблица: addresses (INSERT; при isDefault — UPDATE остальных)
// Выполняется в транзакции: у пользователя может быть только один адрес по умолчанию.
router.post('/', validate([...addressValidators(), body('isDefault').optional().isBoolean()]), async (req, res) => {
  const v = req.valid;
  const address = await withTransaction(async (client) => {
    // SQL: сколько адресов уже есть (первый становится адресом по умолчанию)
    const count = (await client.query('SELECT COUNT(*)::int AS n FROM addresses WHERE user_id = $1', [req.user.id])).rows[0].n;
    if (count >= 10) throw new ApiError(409, 'errors.conflict');
    const makeDefault = Boolean(req.body.isDefault) || count === 0;
    // SQL: снимаем флаг по умолчанию с остальных адресов
    if (makeDefault) await client.query('UPDATE addresses SET is_default = FALSE WHERE user_id = $1', [req.user.id]);
    const { rows } = await client.query(
      `INSERT INTO addresses (user_id, country, city, street, house, apartment, postal_code, recipient, phone, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [req.user.id, v.country, v.city, v.street, v.house, v.apartment || null, v.postalCode || null, v.recipient, v.phone, makeDefault]
    );
    return rows[0];
  });
  res.status(201).json({ address: toAddress(address) });
});

// PUT /api/addresses/:id — изменить адрес (роль: любой авторизованный, только свой). Таблица: addresses (UPDATE)
router.put('/:id', validate([param('id').isInt({ min: 1 }).toInt(), ...addressValidators(), body('isDefault').optional().isBoolean()]), async (req, res) => {
  const v = req.valid;
  const address = await withTransaction(async (client) => {
    if (req.body.isDefault) await client.query('UPDATE addresses SET is_default = FALSE WHERE user_id = $1', [req.user.id]);
    const { rows } = await client.query(
      `UPDATE addresses SET country = $3, city = $4, street = $5, house = $6, apartment = $7, postal_code = $8, recipient = $9, phone = $10,
              is_default = CASE WHEN $11 THEN TRUE ELSE is_default END
        WHERE id = $1 AND user_id = $2 RETURNING *`,
      [v.id, req.user.id, v.country, v.city, v.street, v.house, v.apartment || null, v.postalCode || null, v.recipient, v.phone, Boolean(req.body.isDefault)]
    );
    if (!rows[0]) throw new ApiError(404, 'orders.addressNotFound');
    return rows[0];
  });
  res.json({ address: toAddress(address) });
});

// PATCH /api/addresses/:id/default — сделать адресом по умолчанию (роль: любой авторизованный). Таблица: addresses (UPDATE, транзакция)
router.patch('/:id/default', validate([param('id').isInt({ min: 1 }).toInt()]), async (req, res) => {
  await withTransaction(async (client) => {
    const own = await client.query('SELECT id FROM addresses WHERE id = $1 AND user_id = $2', [req.valid.id, req.user.id]);
    if (!own.rowCount) throw new ApiError(404, 'orders.addressNotFound');
    await client.query('UPDATE addresses SET is_default = (id = $1) WHERE user_id = $2', [req.valid.id, req.user.id]);
  });
  res.json({ ok: true });
});

// DELETE /api/addresses/:id — удалить адрес (роль: любой авторизованный, только свой). Таблица: addresses (DELETE).
// В заказах остаётся текстовая копия адреса (orders.address_snapshot), address_id станет NULL (ON DELETE SET NULL).
router.delete('/:id', validate([param('id').isInt({ min: 1 }).toInt()]), async (req, res) => {
  const { rows } = await query('DELETE FROM addresses WHERE id = $1 AND user_id = $2 RETURNING is_default', [req.valid.id, req.user.id]);
  if (!rows[0]) throw new ApiError(404, 'orders.addressNotFound');
  // SQL: если удалили адрес по умолчанию — назначаем последний добавленный
  if (rows[0].is_default) {
    await query(
      `UPDATE addresses SET is_default = TRUE
        WHERE id = (SELECT id FROM addresses WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1)`,
      [req.user.id]
    );
  }
  res.json({ ok: true });
});

export default router;
