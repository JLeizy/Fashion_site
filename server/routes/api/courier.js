// Кабинет курьера (раздел 4 ТЗ, роль courier; owner проходит всегда): заказы, назначенные ему (адрес, телефон
// получателя, состав), смена статусов handed_to_delivery → in_transit → arrived (только для пунктов выдачи) → delivered.
// Курьер видит только свои заказы: orders.courier_id = req.user.id (owner — все заказы в доставке).
import express from 'express';
import { body, param, query as q } from 'express-validator';
import { query, withTransaction } from '../../../db/pool.js';
import { checkRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { ApiError } from '../../lib/errors.js';
import { changeStatus, nextStatus } from '../../services/orderService.js';
import { loadOrder } from './orders.js';

const router = express.Router();
router.use(checkRole('courier'));

const ACTIVE = ['handed_to_delivery', 'in_transit', 'arrived'];
const DONE = ['delivered', 'returned'];

// Условие «заказ мой»: для курьера — courier_id, для owner — любой
const mine = (user, n) => (user.role === 'owner' ? 'TRUE' : `o.courier_id = $${n}`);

// ---------------------------------------------------------------------------------------------
// GET /api/courier/orders?scope=active|done — мои доставки (роль: courier)
// active — в доставке (handed_to_delivery, in_transit, arrived); done — доставленные за 30 дней.
// Таблицы: orders, order_items, delivery_methods, payment_methods, users (SELECT)
// ---------------------------------------------------------------------------------------------
router.get('/orders', validate([q('scope').optional().isIn(['active', 'done'])]), async (req, res) => {
  const scope = req.valid.scope || 'active';
  const params = [scope === 'active' ? ACTIVE : DONE];
  if (req.user.role !== 'owner') params.push(req.user.id);
  // SQL: заказы курьера с адресом, получателем и составом; для завершённых — только за последние 30 дней
  const { rows } = await query(
    `SELECT o.id, o.order_number, o.tracking_number, o.status, o.payment_status, o.total_byn, o.contact_name, o.contact_phone,
            o.address_snapshot, o.comment, o.expected_delivery_date, o.created_at,
            dm.code AS dm_code, dm.name_ru AS dm_ru, dm.name_en AS dm_en, dm.is_pickup, pm.is_online, pm.name_ru AS pm_ru, pm.name_en AS pm_en,
            cu.first_name || ' ' || cu.last_name AS courier,
            (SELECT json_agg(json_build_object('name', oi.product_name, 'nameEn', oi.product_name_en, 'size', oi.size_label, 'qty', oi.quantity, 'image', oi.image_url) ORDER BY oi.id)
               FROM order_items oi WHERE oi.order_id = o.id) AS items,
            (SELECT MAX(h.created_at) FROM order_status_history h WHERE h.order_id = o.id) AS status_at
       FROM orders o
       JOIN delivery_methods dm ON dm.id = o.delivery_method_id
       JOIN payment_methods pm ON pm.id = o.payment_method_id
       LEFT JOIN users cu ON cu.id = o.courier_id
      WHERE o.status = ANY($1::text[]) AND ${mine(req.user, 2)}
        ${scope === 'done' ? "AND o.updated_at > NOW() - INTERVAL '30 days'" : ''}
      ORDER BY ${scope === 'active' ? 'o.expected_delivery_date ASC NULLS LAST, o.created_at ASC' : 'o.updated_at DESC'}
      LIMIT 200`,
    params
  );
  res.json({
    orders: rows.map((o) => ({
      id: o.id,
      orderNumber: o.order_number,
      trackingNumber: o.tracking_number,
      status: o.status,
      next: nextStatus(o.status, o.is_pickup),
      paymentStatus: o.payment_status,
      // К оплате при получении — только если заказ ещё не оплачен
      toCollect: !o.is_online && o.payment_status === 'pending' ? Number(o.total_byn) : 0,
      payment: { ru: o.pm_ru, en: o.pm_en },
      recipient: { name: o.contact_name, phone: o.contact_phone },
      address: o.address_snapshot,
      comment: o.comment,
      expectedDeliveryDate: o.expected_delivery_date,
      statusAt: o.status_at,
      createdAt: o.created_at,
      courier: o.courier,
      delivery: { code: o.dm_code, name: { ru: o.dm_ru, en: o.dm_en }, isPickup: o.is_pickup },
      items: (o.items || []).map((i) => ({ ...i, name: { ru: i.name, en: i.nameEn || i.name } })),
    })),
  });
});

// ---------------------------------------------------------------------------------------------
// GET /api/courier/orders/:id — детали своего заказа (роль: courier, только назначенный ему)
// Таблицы: orders (SELECT courier_id) + см. loadOrder (orders.js)
// ---------------------------------------------------------------------------------------------
router.get('/orders/:id', validate([param('id').isInt({ min: 1 }).toInt()]), async (req, res) => {
  const order = req.user.role === 'owner' ? await loadOrder('o.id = $1', [req.valid.id]) : await loadOrder('o.id = $1 AND o.courier_id = $2', [req.valid.id, req.user.id]);
  if (!order) throw new ApiError(404, 'orders.notFound');
  res.json({ order });
});

// ---------------------------------------------------------------------------------------------
// POST /api/courier/orders/:id/advance — следующий статус доставки (роль: courier, только свой заказ):
//   handed_to_delivery → in_transit → arrived (для способов с is_pickup) → delivered.
//   При delivered и оплате при получении payment_status → paid (в changeStatus).
// Транзакция. Таблицы: orders (SELECT FOR UPDATE, UPDATE), order_status_history, notifications, audit_log (INSERT)
// ---------------------------------------------------------------------------------------------
router.post('/orders/:id/advance', validate([param('id').isInt({ min: 1 }).toInt(), body('comment').optional({ values: 'falsy' }).isString().trim().isLength({ max: 300 })]), async (req, res) => {
  const result = await withTransaction(async (client) => {
    // SQL: заказ курьера блокируется на время смены статуса
    const { rows } = await client.query(
      'SELECT o.status, o.courier_id, dm.is_pickup FROM orders o JOIN delivery_methods dm ON dm.id = o.delivery_method_id WHERE o.id = $1 FOR UPDATE OF o',
      [req.valid.id]
    );
    const o = rows[0];
    if (!o) throw new ApiError(404, 'orders.notFound');
    if (req.user.role !== 'owner' && o.courier_id !== req.user.id) throw new ApiError(403, 'orders.notAssigned');
    if (!ACTIVE.includes(o.status)) throw new ApiError(409, 'courier.notActive');
    const to = nextStatus(o.status, o.is_pickup);
    const defaults = { in_transit: 'Курьер забрал заказ', arrived: 'Заказ в пункте выдачи', delivered: 'Вручён получателю' };
    return changeStatus(req.valid.id, to, req.user, { comment: req.valid.comment || defaults[to], ip: req.ip, client });
  });
  res.json({ result });
});

export default router;
