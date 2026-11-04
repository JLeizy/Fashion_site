// Кабинет поддержки (раздел 4 ТЗ, роль support; owner проходит всегда): просмотр всех заказов и обращений,
// ответы в тикетах, из действий с заказами — только отмена по просьбе клиента, рассмотрение заявок на возврат
// (одобрить / отклонить с комментарием). Все решения пишутся в audit_log и создают уведомление покупателю.
import express from 'express';
import { body, param, query as q } from 'express-validator';
import { query, withTransaction } from '../../../db/pool.js';
import { checkRole } from '../../middleware/auth.js';
import { validate, msg } from '../../middleware/validate.js';
import { ApiError } from '../../lib/errors.js';
import { listValidators, listParams, pageResult, likePattern } from '../../lib/listing.js';
import { uploadTicketImage } from '../../middleware/upload.js';
import { changeStatus, CANCELLABLE, audit, notify } from '../../services/orderService.js';
import { ticketReplyNotification, returnDecisionNotification } from '../../services/notificationTexts.js';
import { loadOrder } from './orders.js';

const router = express.Router();
router.use(checkRole('support'));

// ---------------------------------------------------------------------------------------------
// GET /api/support/summary — счётчики для вкладок (роль: support)
// Таблицы: support_tickets, return_requests, orders (SELECT COUNT)
// ---------------------------------------------------------------------------------------------
router.get('/summary', async (req, res) => {
  // SQL: открытые обращения, возвраты на рассмотрении, активные заказы
  const { rows } = await query(
    `SELECT (SELECT COUNT(*)::int FROM support_tickets WHERE status = 'open') AS open_tickets,
            (SELECT COUNT(*)::int FROM support_tickets WHERE status = 'answered') AS answered_tickets,
            (SELECT COUNT(*)::int FROM return_requests WHERE status = 'pending') AS pending_returns,
            (SELECT COUNT(*)::int FROM orders WHERE status NOT IN ('delivered', 'cancelled', 'returned')) AS active_orders,
            (SELECT COUNT(*)::int FROM orders WHERE created_at::date = CURRENT_DATE) AS orders_today`
  );
  res.json(rows[0]);
});

// ---------------------------------------------------------------------------------------------
// GET /api/support/orders?status=&q=&page=&sort=&dir= — все заказы (роль: support; только чтение)
// Поиск: номер заказа, трек-номер, email, имя или телефон получателя.
// Таблицы: orders, users, delivery_methods, order_items (SELECT)
// ---------------------------------------------------------------------------------------------
const ORDER_SORT = { created: 'o.created_at', number: 'o.order_number', status: 'o.status', total: 'o.total_byn', customer: 'o.contact_name' };
router.get('/orders', validate([...listValidators, q('status').optional().isIn(['all', 'active', 'created', 'confirmed', 'assembling', 'assembled', 'handed_to_delivery', 'in_transit', 'arrived', 'delivered', 'cancelled', 'returned'])]), async (req, res) => {
  const lp = listParams(req, ORDER_SORT, 'created');
  const params = [];
  const where = ['TRUE'];
  const st = req.valid.status;
  if (st === 'active') where.push("o.status NOT IN ('delivered', 'cancelled', 'returned')");
  else if (st && st !== 'all') {
    params.push(st);
    where.push(`o.status = $${params.length}`);
  }
  if (lp.search) {
    params.push(likePattern(lp.search));
    const n = params.length;
    where.push(`(o.order_number ILIKE $${n} OR o.tracking_number ILIKE $${n} OR o.contact_email ILIKE $${n} OR o.contact_name ILIKE $${n} OR o.contact_phone ILIKE $${n})`);
  }
  params.push(lp.limit, lp.offset);
  // SQL: страница всех заказов с фильтром и поиском
  const { rows } = await query(
    `SELECT o.id, o.order_number, o.tracking_number, o.status, o.payment_status, o.total_byn, o.currency, o.total_in_currency, o.created_at,
            o.contact_name, o.contact_email, o.contact_phone, dm.name_ru AS dm_ru, dm.name_en AS dm_en,
            (SELECT SUM(quantity)::int FROM order_items oi WHERE oi.order_id = o.id) AS count,
            (SELECT COUNT(*)::int FROM support_tickets t WHERE t.order_id = o.id AND t.status <> 'closed') AS tickets,
            COUNT(*) OVER () AS total
       FROM orders o JOIN delivery_methods dm ON dm.id = o.delivery_method_id
      WHERE ${where.join(' AND ')}
      ORDER BY ${lp.order}, o.id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  res.json(
    pageResult(
      rows.map((o) => ({
        id: o.id, orderNumber: o.order_number, trackingNumber: o.tracking_number, status: o.status, paymentStatus: o.payment_status,
        total: Number(o.total_byn), currency: o.currency, totalInCurrency: Number(o.total_in_currency), createdAt: o.created_at,
        customer: { name: o.contact_name, email: o.contact_email, phone: o.contact_phone }, delivery: { ru: o.dm_ru, en: o.dm_en },
        count: o.count || 0, tickets: o.tickets, cancellable: CANCELLABLE.includes(o.status),
      })),
      Number(rows[0]?.total || 0),
      lp
    )
  );
});

// ---------------------------------------------------------------------------------------------
// GET /api/support/orders/:id — заказ с данными клиента, обращениями и возвратами (роль: support)
// Таблицы: см. loadOrder (orders.js) + users, support_tickets, return_requests (SELECT)
// ---------------------------------------------------------------------------------------------
router.get('/orders/:id', validate([param('id').isInt({ min: 1 }).toInt()]), async (req, res) => {
  const order = await loadOrder('o.id = $1', [req.valid.id]);
  if (!order) throw new ApiError(404, 'orders.notFound');
  const [user, tickets, history] = await Promise.all([
    // SQL: покупатель заказа и число его заказов
    query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.created_at, u.status,
              (SELECT COUNT(*)::int FROM orders WHERE user_id = u.id) AS orders
         FROM users u WHERE u.id = $1`,
      [order.userId]
    ),
    // SQL: обращения по этому заказу
    query('SELECT id, subject, status, updated_at FROM support_tickets WHERE order_id = $1 ORDER BY updated_at DESC', [order.id]),
    // SQL: история статусов с автором (для сотрудников видно, кто менял статус)
    query(
      `SELECT h.status, h.comment, h.created_at, u.first_name || ' ' || u.last_name AS author, r.code AS role
         FROM order_status_history h LEFT JOIN users u ON u.id = h.changed_by LEFT JOIN roles r ON r.id = u.role_id
        WHERE h.order_id = $1 ORDER BY h.created_at, h.id`,
      [order.id]
    ),
  ]);
  const u = user.rows[0];
  res.json({
    order: { ...order, cancellable: CANCELLABLE.includes(order.status) },
    customer: u ? { id: u.id, email: u.email, name: `${u.first_name} ${u.last_name}`.trim(), phone: u.phone, since: u.created_at, status: u.status, orders: u.orders } : null,
    tickets: tickets.rows.map((t) => ({ id: t.id, subject: t.subject, status: t.status, updatedAt: t.updated_at })),
    history: history.rows.map((h) => ({ status: h.status, comment: h.comment, at: h.created_at, author: h.author, role: h.role })),
  });
});

// ---------------------------------------------------------------------------------------------
// POST /api/support/orders/:id/cancel — отмена заказа по просьбе клиента (роль: support).
// Возможна до передачи в доставку (created, confirmed, assembling, assembled). Резерв снимается, оплата → refunded.
// Транзакция — services/orderService.js → changeStatus. Таблицы: orders, stock, stock_movements, order_status_history,
//             notifications, audit_log
// ---------------------------------------------------------------------------------------------
router.post('/orders/:id/cancel', validate([param('id').isInt({ min: 1 }).toInt(), body('reason').isString().trim().isLength({ min: 3, max: 300 }).withMessage(msg('validation.length', { min: 3, max: 300 }))]), async (req, res) => {
  await changeStatus(req.valid.id, 'cancelled', req.user, { comment: `Отменён поддержкой по просьбе клиента: ${req.valid.reason}`, ip: req.ip });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------------------------
// GET /api/support/tickets?status=&q=&page= — все обращения (роль: support)
// Таблицы: support_tickets, ticket_messages, users, orders (SELECT)
// ---------------------------------------------------------------------------------------------
router.get('/tickets', validate([...listValidators, q('status').optional().isIn(['all', 'open', 'answered', 'closed']), q('mine').optional().isIn(['0', '1'])]), async (req, res) => {
  const lp = listParams(req, { updated: 't.updated_at', created: 't.created_at', status: 't.status' }, 'updated', 'desc', 20);
  const params = [];
  const where = ['TRUE'];
  if (req.valid.status && req.valid.status !== 'all') {
    params.push(req.valid.status);
    where.push(`t.status = $${params.length}`);
  }
  if (req.valid.mine === '1') {
    params.push(req.user.id);
    where.push(`t.assigned_to = $${params.length}`);
  }
  if (lp.search) {
    params.push(likePattern(lp.search));
    const n = params.length;
    where.push(`(t.subject ILIKE $${n} OR u.email ILIKE $${n} OR (u.first_name || ' ' || u.last_name) ILIKE $${n} OR o.order_number ILIKE $${n})`);
  }
  params.push(lp.limit, lp.offset);
  // SQL: обращения: открытые — первыми, затем по дате обновления
  const { rows } = await query(
    `SELECT t.id, t.subject, t.status, t.created_at, t.updated_at, t.order_id, o.order_number,
            u.first_name || ' ' || u.last_name AS customer, u.email, a.first_name AS assignee,
            (SELECT message FROM ticket_messages m WHERE m.ticket_id = t.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_message,
            (SELECT is_staff FROM ticket_messages m WHERE m.ticket_id = t.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_is_staff,
            (SELECT COUNT(*)::int FROM ticket_messages m WHERE m.ticket_id = t.id) AS messages,
            COUNT(*) OVER () AS total
       FROM support_tickets t JOIN users u ON u.id = t.user_id LEFT JOIN orders o ON o.id = t.order_id LEFT JOIN users a ON a.id = t.assigned_to
      WHERE ${where.join(' AND ')}
      ORDER BY (t.status = 'open') DESC, ${lp.order}, t.id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  res.json(
    pageResult(
      rows.map((t) => ({ id: t.id, subject: t.subject, status: t.status, createdAt: t.created_at, updatedAt: t.updated_at, orderId: t.order_id, orderNumber: t.order_number, customer: t.customer, email: t.email, assignee: t.assignee, lastMessage: t.last_message, lastIsStaff: t.last_is_staff, messages: t.messages })),
      Number(rows[0]?.total || 0),
      lp
    )
  );
});

// ---------------------------------------------------------------------------------------------
// GET /api/support/tickets/:id — переписка по обращению (роль: support)
// Таблицы: support_tickets, ticket_messages, users, orders (SELECT)
// ---------------------------------------------------------------------------------------------
router.get('/tickets/:id', validate([param('id').isInt({ min: 1 }).toInt()]), async (req, res) => {
  // SQL: обращение с клиентом и заказом
  const t = await query(
    `SELECT t.*, o.order_number, o.status AS order_status, u.first_name || ' ' || u.last_name AS customer, u.email, u.phone,
            a.first_name || ' ' || a.last_name AS assignee
       FROM support_tickets t JOIN users u ON u.id = t.user_id LEFT JOIN orders o ON o.id = t.order_id LEFT JOIN users a ON a.id = t.assigned_to
      WHERE t.id = $1`,
    [req.valid.id]
  );
  const tk = t.rows[0];
  if (!tk) throw new ApiError(404, 'tickets.notFound');
  // SQL: сообщения переписки
  const m = await query(
    `SELECT m.id, m.message, m.image, m.is_staff, m.created_at, u.first_name, u.last_name
       FROM ticket_messages m LEFT JOIN users u ON u.id = m.user_id WHERE m.ticket_id = $1 ORDER BY m.created_at, m.id`,
    [req.valid.id]
  );
  res.json({
    ticket: { id: tk.id, subject: tk.subject, status: tk.status, createdAt: tk.created_at, orderId: tk.order_id, orderNumber: tk.order_number, orderStatus: tk.order_status, customer: tk.customer, email: tk.email, phone: tk.phone, assignee: tk.assignee },
    messages: m.rows.map((r) => ({ id: r.id, message: r.message, image: r.image, isStaff: r.is_staff, author: `${r.first_name || ''} ${r.last_name || ''}`.trim(), createdAt: r.created_at })),
  });
});

// ---------------------------------------------------------------------------------------------
// POST /api/support/tickets/:id/messages — ответ поддержки (multipart: message, image?) (роль: support)
// Обращение получает статус answered и назначается отвечающему; покупателю — уведомление.
// Транзакция. Таблицы: support_tickets (SELECT FOR UPDATE, UPDATE status, assigned_to), ticket_messages (INSERT), notifications (INSERT)
// ---------------------------------------------------------------------------------------------
router.post(
  '/tickets/:id/messages',
  uploadTicketImage,
  validate([param('id').isInt({ min: 1 }).toInt(), body('message').isString().trim().isLength({ min: 1, max: 4000 }).withMessage(msg('validation.length', { min: 1, max: 4000 }))]),
  async (req, res) => {
    await withTransaction(async (client) => {
      // SQL: обращение блокируется на время ответа
      const t = await client.query('SELECT id, user_id, subject, status FROM support_tickets WHERE id = $1 FOR UPDATE', [req.valid.id]);
      const tk = t.rows[0];
      if (!tk) throw new ApiError(404, 'tickets.notFound');
      if (tk.status === 'closed') throw new ApiError(409, 'tickets.closed');
      // SQL: сообщение сотрудника (is_staff = TRUE)
      await client.query('INSERT INTO ticket_messages (ticket_id, user_id, message, image, is_staff) VALUES ($1, $2, $3, $4, TRUE)', [tk.id, req.user.id, req.valid.message, req.file?.publicUrl || null]);
      // SQL: статус «ответили» и ответственный сотрудник
      await client.query("UPDATE support_tickets SET status = 'answered', assigned_to = $2 WHERE id = $1", [tk.id, req.user.id]);
      await notify(client, tk.user_id, ticketReplyNotification(tk.id, tk.subject));
    });
    res.status(201).json({ ok: true });
  }
);

// ---------------------------------------------------------------------------------------------
// POST /api/support/tickets/:id/close — закрыть обращение (роль: support)
// Таблицы: support_tickets (UPDATE), audit_log (INSERT)
// ---------------------------------------------------------------------------------------------
router.post('/tickets/:id/close', validate([param('id').isInt({ min: 1 }).toInt()]), async (req, res) => {
  await withTransaction(async (client) => {
    // SQL: закрытие обращения
    const r = await client.query("UPDATE support_tickets SET status = 'closed' WHERE id = $1 AND status <> 'closed' RETURNING id", [req.valid.id]);
    if (!r.rowCount) throw new ApiError(404, 'tickets.notFound');
    await audit(client, { userId: req.user.id, action: 'ticket.close', entity: 'support_tickets', entityId: req.valid.id, ip: req.ip });
  });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------------------------
// GET /api/support/returns?status=pending|approved|rejected|all&q=&page= — заявки на возврат (роль: support)
// Таблицы: return_requests, order_items, orders, users (SELECT)
// ---------------------------------------------------------------------------------------------
router.get('/returns', validate([...listValidators, q('status').optional().isIn(['all', 'pending', 'approved', 'rejected'])]), async (req, res) => {
  const lp = listParams(req, { created: 'rr.created_at', status: 'rr.status' }, 'created', 'desc', 20);
  const params = [];
  const where = ['TRUE'];
  const st = req.valid.status || 'pending';
  if (st !== 'all') {
    params.push(st);
    where.push(`rr.status = $${params.length}`);
  }
  if (lp.search) {
    params.push(likePattern(lp.search));
    const n = params.length;
    where.push(`(o.order_number ILIKE $${n} OR oi.product_name ILIKE $${n} OR u.email ILIKE $${n})`);
  }
  params.push(lp.limit, lp.offset);
  // SQL: заявки на возврат с позицией, заказом, покупателем и датой доставки
  const { rows } = await query(
    `SELECT rr.*, oi.product_name, oi.product_name_en, oi.sku, oi.size_label, oi.image_url, oi.price_byn, oi.quantity AS item_qty,
            o.order_number, u.first_name || ' ' || u.last_name AS customer, u.email,
            rs.first_name || ' ' || rs.last_name AS resolver,
            (SELECT MAX(h.created_at) FROM order_status_history h WHERE h.order_id = o.id AND h.status = 'delivered') AS delivered_at,
            COUNT(*) OVER () AS total
       FROM return_requests rr
       JOIN order_items oi ON oi.id = rr.order_item_id
       JOIN orders o ON o.id = rr.order_id
       JOIN users u ON u.id = rr.user_id
       LEFT JOIN users rs ON rs.id = rr.resolved_by
      WHERE ${where.join(' AND ')}
      ORDER BY ${lp.order}, rr.id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  res.json(
    pageResult(
      rows.map((r) => ({
        id: r.id, orderId: r.order_id, orderNumber: r.order_number, quantity: r.quantity, reasonCode: r.reason_code, reason: r.reason, photo: r.photo,
        status: r.status, comment: r.comment, resolver: r.resolver, resolvedAt: r.resolved_at, received: Boolean(r.received_at), createdAt: r.created_at,
        deliveredAt: r.delivered_at, customer: r.customer, email: r.email,
        item: { name: { ru: r.product_name, en: r.product_name_en || r.product_name }, sku: r.sku, size: r.size_label, image: r.image_url, price: Number(r.price_byn), quantity: r.item_qty },
      })),
      Number(rows[0]?.total || 0),
      lp
    )
  );
});

// ---------------------------------------------------------------------------------------------
// POST /api/support/returns/:id/resolve — решение по возврату: approve | reject + комментарий (роль: support)
// Одобренный возврат попадает к кладовщику на приёмку (там quantity += N). Покупателю — уведомление.
// Транзакция. Таблицы: return_requests (SELECT FOR UPDATE, UPDATE), orders (SELECT), notifications (INSERT), audit_log (INSERT)
// ---------------------------------------------------------------------------------------------
router.post(
  '/returns/:id/resolve',
  validate([
    param('id').isInt({ min: 1 }).toInt(),
    body('decision').isIn(['approve', 'reject']).withMessage(msg('validation.enum')),
    body('comment').if(body('decision').equals('reject')).isString().withMessage(msg('validation.length', { min: 5, max: 500 })).trim().isLength({ min: 5, max: 500 }).withMessage(msg('validation.length', { min: 5, max: 500 })),
    body('comment').optional({ values: 'falsy' }).isString().trim().isLength({ max: 500 }),
  ]),
  async (req, res) => {
    const approved = req.valid.decision === 'approve';
    const result = await withTransaction(async (client) => {
      // SQL: заявка блокируется (решение принимается один раз)
      const { rows } = await client.query('SELECT rr.*, o.order_number FROM return_requests rr JOIN orders o ON o.id = rr.order_id WHERE rr.id = $1 FOR UPDATE OF rr', [req.valid.id]);
      const r = rows[0];
      if (!r) throw new ApiError(404, 'returns.notFound');
      if (r.status !== 'pending') throw new ApiError(409, 'returns.alreadyResolved');
      const status = approved ? 'approved' : 'rejected';
      // SQL: решение по заявке
      await client.query('UPDATE return_requests SET status = $2, comment = $3, resolved_by = $4, resolved_at = NOW() WHERE id = $1', [r.id, status, req.valid.comment || null, req.user.id]);
      await notify(client, r.user_id, returnDecisionNotification(r.id, r.order_number, approved, req.valid.comment || ''));
      await audit(client, { userId: req.user.id, action: `return.${status}`, entity: 'return_requests', entityId: r.id, oldData: { status: 'pending' }, newData: { status, comment: req.valid.comment || null }, ip: req.ip });
      return { id: r.id, status };
    });
    res.json(result);
  }
);

export default router;
