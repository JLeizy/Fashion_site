// Оформление и заказы покупателя (разделы 6.11, 6.12 ТЗ): способы доставки и оплаты, расчёт, оформление,
// список и детали своих заказов, отмена, повтор; публичное отслеживание по трек-номеру.
import express from 'express';
import { body, param, query as q, validationResult } from 'express-validator';
import { query } from '../../../db/pool.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate, msg } from '../../middleware/validate.js';
import { ApiError } from '../../lib/errors.js';
import { isValidTrackingNumber } from '../../lib/tracking.js';
import { createOrder, changeStatus, quote, flowFor } from '../../services/orderService.js';
import { addItem } from '../../services/cartService.js';
import { addressValidators } from './addresses.js';

const router = express.Router();

// GET /api/checkout/options — способы доставки и оплаты (роль: любая).
// Таблицы: delivery_methods, payment_methods (SELECT активных)
router.get('/checkout/options', async (req, res) => {
  const [delivery, payment] = await Promise.all([
    query('SELECT id, code, name_ru, name_en, price_byn, days_min, days_max, is_pickup FROM delivery_methods WHERE is_active ORDER BY sort_order, id'),
    query('SELECT id, code, name_ru, name_en, is_online FROM payment_methods WHERE is_active ORDER BY sort_order, id'),
  ]);
  res.json({
    delivery: delivery.rows.map((d) => ({ id: d.id, code: d.code, name: { ru: d.name_ru, en: d.name_en }, price: Number(d.price_byn), daysMin: d.days_min, daysMax: d.days_max, isPickup: d.is_pickup })),
    payment: payment.rows.map((p) => ({ id: p.id, code: p.code, name: { ru: p.name_ru, en: p.name_en }, isOnline: p.is_online })),
  });
});

// GET /api/checkout/quote?delivery=ID — расчёт итога для шага «Подтверждение» (роль: любой авторизованный).
// Промокод берётся из сессии (POST /api/cart/promo). Таблицы: carts, cart_items, products, delivery_methods, promo_codes (SELECT)
router.get('/checkout/quote', requireAuth, validate([q('delivery').optional().isInt({ min: 1 }).toInt()]), async (req, res) => {
  const r = await quote(req.user.id, { deliveryMethodId: req.valid.delivery || null, promoCode: req.session.promoCode || null });
  res.json({
    items: r.items.map((i) => ({
      variantId: i.variant_id,
      productId: i.product_id,
      name: { ru: i.name_ru, en: i.name_en },
      brand: i.brand_name,
      size: i.size_label,
      image: i.image,
      price: Number(i.price_byn),
      quantity: i.quantity,
      available: i.available,
      ok: i.moderation_status === 'approved' && i.quantity <= i.available,
    })),
    subtotal: r.subtotal,
    discount: r.discount,
    promo: r.promo ? { code: r.promo.code, percent: r.promo.discount_percent } : null,
    deliveryPrice: r.deliveryPrice,
    total: r.total,
  });
});

const orderValidators = [
  body('contact.name').isString().trim().isLength({ min: 2, max: 120 }).withMessage(msg('validation.length', { min: 2, max: 120 })),
  body('contact.phone').isString().trim().matches(/^\+\d[\d ()-]{7,20}$/).withMessage(msg('validation.phone')),
  body('contact.email').isEmail().withMessage(msg('validation.email')).normalizeEmail({ gmail_remove_dots: false }),
  body('addressId').optional({ values: 'null' }).isInt({ min: 1 }).toInt(),
  body('address').optional({ values: 'null' }).isObject(),
  body('saveAddress').optional().isBoolean(),
  body('deliveryMethodId').isInt({ min: 1 }).withMessage(msg('validation.required')).toInt(),
  body('paymentMethodId').isInt({ min: 1 }).withMessage(msg('validation.required')).toInt(),
  body('currency').optional().isIn(['BYN', 'USD', 'EUR']),
  body('comment').optional({ values: 'falsy' }).isString().trim().isLength({ max: 500 }),
  // Номер карты на сервер НЕ передаётся — только последние 4 цифры для комментария к оплате (имитация)
  body('cardLast4').optional({ values: 'falsy' }).matches(/^\d{4}$/),
];

// POST /api/orders — оформление заказа (роль: любой авторизованный — покупатель)
// Таблицы: orders (INSERT), order_items (INSERT), stock (SELECT … FOR UPDATE, UPDATE reserved), stock_movements (INSERT),
//          promo_codes (FOR UPDATE, UPDATE used_count), addresses (INSERT — при сохранении нового), order_status_history (INSERT),
//          notifications (INSERT), cart_items (DELETE). Выполняется в одной транзакции (services/orderService.js → createOrder).
router.post('/orders', requireAuth, validate(orderValidators), async (req, res, next) => {
  // Новый адрес проверяется теми же правилами, что и адресная книга
  if (!req.body.addressId) {
    if (!req.body.address) return next(new ApiError(422, 'orders.addressRequired'));
    const checks = addressValidators('address.');
    for (const chain of checks) await chain.run(req);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const details = errors.array({ onlyFirstError: true }).map((e) => ({ field: e.path, message: req.t(e.msg?.key || 'errors.validation', e.msg?.params || {}) }));
      return next(new ApiError(422, 'errors.validation', { details }));
    }
  }
  const b = req.body;
  const result = await createOrder(
    req.user,
    {
      contact: { name: req.valid.contact.name, phone: req.valid.contact.phone, email: req.valid.contact.email },
      addressId: req.valid.addressId || null,
      address: b.addressId ? null : {
        country: b.address.country, city: String(b.address.city).trim(), street: String(b.address.street).trim(), house: String(b.address.house).trim(),
        apartment: b.address.apartment ? String(b.address.apartment).trim() : null, postalCode: b.address.postalCode ? String(b.address.postalCode).trim() : null,
        recipient: String(b.address.recipient).trim(), phone: String(b.address.phone).trim(),
      },
      saveAddress: Boolean(b.saveAddress),
      deliveryMethodId: req.valid.deliveryMethodId,
      paymentMethodId: req.valid.paymentMethodId,
      currency: req.valid.currency || 'BYN',
      comment: req.valid.comment || null,
      cardLast4: req.valid.cardLast4 || null,
      promoCode: req.session.promoCode || null,
    },
    req.ip
  );
  delete req.session.promoCode;
  res.status(201).json({ order: result });
});

// Полные данные заказа для владельца заказа / сотрудников. Таблицы: orders, delivery_methods, payment_methods,
// promo_codes, order_items, order_status_history, users (SELECT)
export async function loadOrder(where, params) {
  const { rows } = await query(
    `SELECT o.*, dm.code AS dm_code, dm.name_ru AS dm_ru, dm.name_en AS dm_en, dm.is_pickup, dm.days_min, dm.days_max,
            pm.code AS pm_code, pm.name_ru AS pm_ru, pm.name_en AS pm_en, pm.is_online,
            pc.code AS promo_code, cu.first_name AS courier_first, cu.last_name AS courier_last, cu.phone AS courier_phone
       FROM orders o
       JOIN delivery_methods dm ON dm.id = o.delivery_method_id
       JOIN payment_methods pm  ON pm.id = o.payment_method_id
       LEFT JOIN promo_codes pc ON pc.id = o.promo_code_id
       LEFT JOIN users cu       ON cu.id = o.courier_id
      WHERE ${where}`,
    params
  );
  const o = rows[0];
  if (!o) return null;
  const [items, history] = await Promise.all([
    query(
      `SELECT oi.id, oi.product_id, oi.variant_id, oi.product_name, oi.product_name_en, oi.size_label, oi.sku, oi.image_url, oi.price_byn, oi.quantity,
              EXISTS (SELECT 1 FROM reviews r WHERE r.product_id = oi.product_id AND r.user_id = $2) AS reviewed,
              (SELECT rr.status FROM return_requests rr WHERE rr.order_item_id = oi.id ORDER BY rr.id DESC LIMIT 1) AS return_status
         FROM order_items oi WHERE oi.order_id = $1 ORDER BY oi.id`,
      [o.id, o.user_id]
    ),
    query('SELECT status, comment, created_at FROM order_status_history WHERE order_id = $1 ORDER BY created_at, id', [o.id]),
  ]);
  return {
    id: o.id,
    orderNumber: o.order_number,
    trackingNumber: o.tracking_number,
    status: o.status,
    paymentStatus: o.payment_status,
    createdAt: o.created_at,
    expectedDeliveryDate: o.expected_delivery_date,
    contact: { name: o.contact_name, phone: o.contact_phone, email: o.contact_email },
    address: o.address_snapshot,
    delivery: { code: o.dm_code, name: { ru: o.dm_ru, en: o.dm_en }, isPickup: o.is_pickup, daysMin: o.days_min, daysMax: o.days_max },
    payment: { code: o.pm_code, name: { ru: o.pm_ru, en: o.pm_en }, isOnline: o.is_online },
    subtotal: Number(o.subtotal_byn),
    deliveryPrice: Number(o.delivery_price_byn),
    discount: Number(o.discount_byn),
    total: Number(o.total_byn),
    promoCode: o.promo_code,
    currency: o.currency,
    exchangeRate: Number(o.exchange_rate),
    totalInCurrency: Number(o.total_in_currency),
    comment: o.comment,
    courier: o.courier_first ? { name: `${o.courier_first} ${o.courier_last}`, phone: o.courier_phone } : null,
    userId: o.user_id,
    flow: flowFor(o.is_pickup),
    items: items.rows.map((i) => ({
      id: i.id,
      productId: i.product_id,
      variantId: i.variant_id,
      name: { ru: i.product_name, en: i.product_name_en || i.product_name },
      size: i.size_label,
      sku: i.sku,
      image: i.image_url,
      price: Number(i.price_byn),
      quantity: i.quantity,
      reviewed: i.reviewed,
      returnStatus: i.return_status,
    })),
    history: history.rows.map((h) => ({ status: h.status, comment: h.comment, at: h.created_at })),
  };
}

// GET /api/orders?status=active|done|all&page=1 — мои заказы (роль: любой авторизованный, только свои)
// Таблицы: orders, order_items, delivery_methods (SELECT)
router.get('/orders', requireAuth, validate([q('status').optional().isIn(['all', 'active', 'done']), q('page').optional().isInt({ min: 1 }).toInt()]), async (req, res) => {
  const status = req.query.status || 'all';
  const page = req.valid.page || 1;
  const limit = 10;
  const filter = status === 'active' ? "AND o.status NOT IN ('delivered', 'cancelled', 'returned')" : status === 'done' ? "AND o.status IN ('delivered', 'cancelled', 'returned')" : '';
  const { rows } = await query(
    `SELECT o.id, o.order_number, o.tracking_number, o.status, o.payment_status, o.total_byn, o.currency, o.total_in_currency, o.created_at,
            o.expected_delivery_date, dm.name_ru AS dm_ru, dm.name_en AS dm_en,
            (SELECT json_agg(json_build_object('image', oi.image_url, 'name', oi.product_name) ORDER BY oi.id) FROM order_items oi WHERE oi.order_id = o.id) AS items,
            (SELECT SUM(quantity)::int FROM order_items oi WHERE oi.order_id = o.id) AS count,
            COUNT(*) OVER () AS total
       FROM orders o JOIN delivery_methods dm ON dm.id = o.delivery_method_id
      WHERE o.user_id = $1 ${filter}
      ORDER BY o.created_at DESC
      LIMIT $2 OFFSET $3`,
    [req.user.id, limit, (page - 1) * limit]
  );
  const total = rows[0]?.total || 0;
  res.json({
    orders: rows.map((o) => ({
      id: o.id,
      orderNumber: o.order_number,
      trackingNumber: o.tracking_number,
      status: o.status,
      paymentStatus: o.payment_status,
      total: Number(o.total_byn),
      currency: o.currency,
      totalInCurrency: Number(o.total_in_currency),
      createdAt: o.created_at,
      expectedDeliveryDate: o.expected_delivery_date,
      delivery: { ru: o.dm_ru, en: o.dm_en },
      items: o.items || [],
      count: o.count || 0,
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
});

// GET /api/orders/:id — детали своего заказа (роль: покупатель — только свой; сотрудники — через /api/admin)
router.get('/orders/:id', requireAuth, validate([param('id').isInt({ min: 1 }).toInt()]), async (req, res) => {
  const order = await loadOrder('o.id = $1 AND o.user_id = $2', [req.valid.id, req.user.id]);
  if (!order) throw new ApiError(404, 'orders.notFound');
  res.json({ order });
});

// POST /api/orders/:id/cancel — отмена своего заказа покупателем: только в статусе created или confirmed (роль: buyer)
// Таблицы: orders (UPDATE status, payment_status), stock (UPDATE reserved), stock_movements (INSERT 'unreserve'),
//          order_status_history, notifications (INSERT). Транзакция — services/orderService.js → changeStatus
router.post('/orders/:id/cancel', requireAuth, validate([param('id').isInt({ min: 1 }).toInt(), body('reason').optional().isString().isLength({ max: 300 })]), async (req, res) => {
  // SQL: проверка владельца и статуса
  const { rows } = await query('SELECT status FROM orders WHERE id = $1 AND user_id = $2', [req.valid.id, req.user.id]);
  if (!rows[0]) throw new ApiError(404, 'orders.notFound');
  if (!['created', 'confirmed'].includes(rows[0].status)) throw new ApiError(409, 'orders.cannotCancel');
  const reason = req.body.reason ? String(req.body.reason).trim() : null;
  await changeStatus(req.valid.id, 'cancelled', req.user, { comment: reason ? `Отменён покупателем: ${reason}` : 'Отменён покупателем', ip: req.ip });
  const order = await loadOrder('o.id = $1', [req.valid.id]);
  res.json({ order });
});

// POST /api/orders/:id/repeat — повторить заказ: доступные позиции добавляются в корзину (роль: любой авторизованный)
// Таблицы: order_items (SELECT), v_variant_stock (проверка остатка), carts / cart_items (INSERT … ON CONFLICT)
router.post('/orders/:id/repeat', requireAuth, validate([param('id').isInt({ min: 1 }).toInt()]), async (req, res) => {
  const { rows } = await query(
    `SELECT oi.variant_id, SUM(oi.quantity)::int AS quantity
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.id = $1 AND o.user_id = $2 AND oi.variant_id IS NOT NULL
      GROUP BY oi.variant_id`,
    [req.valid.id, req.user.id]
  );
  if (!rows.length) throw new ApiError(404, 'orders.notFound');
  let added = 0;
  let skipped = 0;
  for (const r of rows) {
    try {
      await addItem(req.user.id, r.variant_id, r.quantity);
      added += 1;
    } catch {
      skipped += 1; // нет в наличии или снят с продажи
    }
  }
  res.json({ added, skipped });
});

// GET /api/tracking/:number — публичное отслеживание по трек-номеру (роль: любая, включая гостя).
// Без персональных данных: только статус, таймлайн, состав, город и способ доставки.
// Таблицы: orders, delivery_methods, order_items, order_status_history (SELECT)
router.get('/tracking/:number', async (req, res) => {
  const number = String(req.params.number || '').trim().toUpperCase();
  if (!isValidTrackingNumber(number)) throw new ApiError(404, 'orders.trackingNotFound');
  const order = await loadOrder('o.tracking_number = $1', [number]);
  if (!order) throw new ApiError(404, 'orders.trackingNotFound');
  const own = req.user && req.user.id === order.userId;
  // Город из снимка адреса — вторая строка «индекс, страна, город»
  const city = String(order.address).split('\n')[1] || '';
  res.json({
    order: {
      orderNumber: order.orderNumber,
      trackingNumber: order.trackingNumber,
      status: order.status,
      createdAt: order.createdAt,
      expectedDeliveryDate: order.expectedDeliveryDate,
      delivery: order.delivery,
      destination: own ? order.address : city.replace(/^\d+,\s*/, ''),
      items: order.items.map((i) => ({ name: i.name, size: i.size, image: i.image, quantity: i.quantity, productId: i.productId })),
      history: order.history,
      flow: order.flow,
      own,
      id: own ? order.id : null,
    },
  });
});

export default router;
