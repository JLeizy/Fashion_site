// Личный кабинет покупателя (разделы 4 и 6.13 ТЗ): профиль и аватар, недавно просмотренные, мои отзывы,
// заявки на возврат, обращения в поддержку (переписка), заявка «Стать продавцом».
// Все маршруты — только для вошедших и только со своими данными (user_id = req.user.id).
import express from 'express';
import { body, param, query as q } from 'express-validator';
import { query, withTransaction } from '../../../db/pool.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate, msg } from '../../middleware/validate.js';
import { ApiError } from '../../lib/errors.js';
import { config } from '../../../config/index.js';
import { uploadAvatar, uploadReturnPhoto, uploadTicketImage, removeUploadedFile } from '../../middleware/upload.js';
import { CARD_SELECT, CARD_JOINS, toCard } from '../../services/productCards.js';
import { publicUser } from './auth.js';

const router = express.Router();
// Роутер подключён к /api, поэтому вход проверяется только для путей кабинета (а не для всего API)
router.use(['/account', '/returns', '/tickets', '/seller-application'], requireAuth);

// GET /api/account — профиль и сводка кабинета (роль: любой авторизованный)
// Таблицы: users (уже загружен в loadUser), orders, wishlist, reviews, support_tickets, seller_applications (SELECT COUNT / SUM)
router.get('/account', async (req, res) => {
  const { rows } = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM orders WHERE user_id = $1) AS orders,
       (SELECT COUNT(*)::int FROM orders WHERE user_id = $1 AND status NOT IN ('delivered', 'cancelled', 'returned')) AS active_orders,
       (SELECT COALESCE(SUM(total_byn), 0) FROM orders WHERE user_id = $1 AND status = 'delivered') AS spent,
       (SELECT COUNT(*)::int FROM wishlist WHERE user_id = $1) AS wishlist,
       (SELECT COUNT(*)::int FROM reviews WHERE user_id = $1) AS reviews,
       (SELECT COUNT(*)::int FROM support_tickets WHERE user_id = $1 AND status = 'answered') AS tickets_answered,
       (SELECT COUNT(*)::int FROM addresses WHERE user_id = $1) AS addresses,
       (SELECT row_to_json(sa) FROM (SELECT status, shop_name, comment, created_at FROM seller_applications WHERE user_id = $1 ORDER BY id DESC LIMIT 1) sa) AS seller_app`,
    [req.user.id]
  );
  const s = rows[0];
  res.json({
    user: publicUser(req.user),
    stats: { orders: s.orders, activeOrders: s.active_orders, spent: Number(s.spent), wishlist: s.wishlist, reviews: s.reviews, ticketsAnswered: s.tickets_answered, addresses: s.addresses },
    sellerApplication: s.seller_app,
  });
});

// PATCH /api/account/profile — имя, фамилия, телефон (роль: любой авторизованный). Таблица: users (UPDATE)
router.patch(
  '/account/profile',
  validate([
    body('firstName').isString().trim().matches(/^[\p{L}][\p{L}\s'’.-]{0,59}$/u).withMessage(msg('validation.name')),
    body('lastName').isString().trim().matches(/^[\p{L}][\p{L}\s'’.-]{0,59}$/u).withMessage(msg('validation.name')),
    body('phone').optional({ values: 'falsy' }).isString().matches(/^\+\d{10,15}$/).withMessage(msg('validation.phone')),
  ]),
  async (req, res) => {
    const { rows } = await query(
      `UPDATE users SET first_name = $2, last_name = $3, phone = COALESCE($4, phone) WHERE id = $1
       RETURNING id`,
      [req.user.id, req.valid.firstName, req.valid.lastName, req.valid.phone || null]
    );
    if (!rows[0]) throw ApiError.notFound();
    res.json({ ok: true, user: { ...publicUser(req.user), firstName: req.valid.firstName, lastName: req.valid.lastName, phone: req.valid.phone || req.user.phone } });
  }
);

// POST /api/account/avatar — загрузка аватара (multer: только изображения, лимит размера) (роль: любой авторизованный)
// Таблица: users (UPDATE avatar); старый файл удаляется из public/uploads/avatars
router.post('/account/avatar', uploadAvatar, async (req, res) => {
  if (!req.file) throw new ApiError(400, 'errors.badRequest');
  const old = req.user.avatar;
  await query('UPDATE users SET avatar = $2 WHERE id = $1', [req.user.id, req.file.publicUrl]);
  removeUploadedFile(old);
  res.json({ avatar: req.file.publicUrl });
});

// DELETE /api/account/avatar — удалить аватар (роль: любой авторизованный). Таблица: users (UPDATE avatar = NULL)
router.delete('/account/avatar', async (req, res) => {
  await query('UPDATE users SET avatar = NULL WHERE id = $1', [req.user.id]);
  removeUploadedFile(req.user.avatar);
  res.json({ avatar: null });
});

// GET /api/account/viewed — недавно просмотренные товары (роль: любой авторизованный)
// Таблицы: viewed_products JOIN products + каталог (SELECT)
router.get('/account/viewed', async (req, res) => {
  const { rows } = await query(
    `SELECT ${CARD_SELECT}, vp.viewed_at FROM viewed_products vp JOIN products p ON p.id = vp.product_id ${CARD_JOINS}
      WHERE vp.user_id = $1 AND p.moderation_status = 'approved' ORDER BY vp.viewed_at DESC LIMIT 24`,
    [req.user.id]
  );
  res.json({ items: rows.map(toCard) });
});

// GET /api/account/reviews — мои отзывы со статусом модерации (роль: любой авторизованный)
// Таблицы: reviews, products, brands, product_images (SELECT)
router.get('/account/reviews', async (req, res) => {
  const { rows } = await query(
    `SELECT r.id, r.rating, r.text, r.status, r.created_at, p.id AS product_id, p.name_ru, p.name_en, b.name AS brand,
            (SELECT url FROM product_images WHERE product_id = p.id ORDER BY is_main DESC, sort_order LIMIT 1) AS image
       FROM reviews r JOIN products p ON p.id = r.product_id JOIN brands b ON b.id = p.brand_id
      WHERE r.user_id = $1 ORDER BY r.created_at DESC`,
    [req.user.id]
  );
  res.json({
    reviews: rows.map((r) => ({ id: r.id, rating: r.rating, text: r.text, status: r.status, createdAt: r.created_at, product: { id: r.product_id, name: { ru: r.name_ru, en: r.name_en }, brand: r.brand, image: r.image } })),
  });
});

// ---------------------------------------------------------------------------------------------
// Возвраты: заявка на возврат доставленного товара в течение 14 дней (причина, фото)
// ---------------------------------------------------------------------------------------------
const RETURN_REASONS = ['size', 'defect', 'not_as_described', 'changed_mind', 'wrong_item', 'other'];

// GET /api/returns — мои заявки на возврат (роль: любой авторизованный)
// Таблицы: return_requests, order_items, orders (SELECT)
router.get('/returns', async (req, res) => {
  const { rows } = await query(
    `SELECT rr.*, oi.product_name, oi.product_name_en, oi.image_url, oi.size_label, oi.price_byn, o.order_number
       FROM return_requests rr JOIN order_items oi ON oi.id = rr.order_item_id JOIN orders o ON o.id = rr.order_id
      WHERE rr.user_id = $1 ORDER BY rr.created_at DESC`,
    [req.user.id]
  );
  res.json({
    returns: rows.map((r) => ({
      id: r.id,
      orderId: r.order_id,
      orderNumber: r.order_number,
      item: { name: { ru: r.product_name, en: r.product_name_en || r.product_name }, image: r.image_url, size: r.size_label, price: Number(r.price_byn) },
      quantity: r.quantity,
      reasonCode: r.reason_code,
      reason: r.reason,
      photo: r.photo,
      status: r.status,
      comment: r.comment,
      received: Boolean(r.received_at),
      createdAt: r.created_at,
    })),
  });
});

// POST /api/returns — заявка на возврат (multipart: orderItemId, quantity, reasonCode, reason, photo?) (роль: покупатель, только свой заказ)
// Условия: заказ доставлен, прошло не больше 14 дней с даты доставки (order_status_history), по позиции нет активной заявки.
// Таблицы: order_items, orders, order_status_history, return_requests (SELECT), return_requests (INSERT), notifications (INSERT)
router.post(
  '/returns',
  uploadReturnPhoto,
  validate([
    body('orderItemId').isInt({ min: 1 }).toInt(),
    body('quantity').optional().isInt({ min: 1, max: 20 }).toInt(),
    body('reasonCode').isIn(RETURN_REASONS).withMessage(msg('validation.enum')),
    body('reason').isString().trim().isLength({ min: 10, max: 1000 }).withMessage(msg('validation.length', { min: 10, max: 1000 })),
  ]),
  async (req, res) => {
    const v = req.valid;
    const created = await withTransaction(async (client) => {
      // SQL: позиция заказа пользователя, статус заказа и дата доставки
      const { rows } = await client.query(
        `SELECT oi.id, oi.order_id, oi.quantity, o.status, o.order_number,
                (SELECT MAX(created_at) FROM order_status_history h WHERE h.order_id = o.id AND h.status = 'delivered') AS delivered_at
           FROM order_items oi JOIN orders o ON o.id = oi.order_id
          WHERE oi.id = $1 AND o.user_id = $2
          FOR UPDATE OF o`,
        [v.orderItemId, req.user.id]
      );
      const item = rows[0];
      if (!item) throw new ApiError(404, 'orders.notFound');
      if (item.status !== 'delivered' || !item.delivered_at) throw new ApiError(409, 'returns.notAllowed');
      const days = (Date.now() - new Date(item.delivered_at).getTime()) / 86400000;
      if (days > config.shop.returnDays) throw new ApiError(409, 'returns.expired', { params: { days: config.shop.returnDays } });
      // SQL: по позиции уже есть заявка, кроме отклонённых
      const dup = await client.query("SELECT 1 FROM return_requests WHERE order_item_id = $1 AND status <> 'rejected'", [item.id]);
      if (dup.rowCount) throw new ApiError(409, 'returns.exists');
      const quantity = Math.min(v.quantity || 1, item.quantity);
      const ins = await client.query(
        `INSERT INTO return_requests (order_id, order_item_id, user_id, quantity, reason_code, reason, photo)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, status, created_at`,
        [item.order_id, item.id, req.user.id, quantity, v.reasonCode, v.reason, req.file?.publicUrl || null]
      );
      await client.query(
        `INSERT INTO notifications (user_id, type, title_ru, title_en, text_ru, text_en, link) VALUES ($1, 'return_decision', $2, $3, $4, $5, $6)`,
        [req.user.id, `Заявка на возврат по заказу ${item.order_number} принята`, `Return request for order ${item.order_number} received`, 'Поддержка рассмотрит её в течение 1–2 рабочих дней.', 'Support will review it within 1–2 business days.', '/account/returns']
      );
      return ins.rows[0];
    });
    res.status(201).json({ return: created });
  }
);

// ---------------------------------------------------------------------------------------------
// Обращения в поддержку
// ---------------------------------------------------------------------------------------------
// GET /api/tickets — мои обращения (роль: любой авторизованный). Таблицы: support_tickets, ticket_messages, orders (SELECT)
router.get('/tickets', async (req, res) => {
  const { rows } = await query(
    `SELECT t.id, t.subject, t.status, t.created_at, t.updated_at, o.order_number,
            (SELECT message FROM ticket_messages m WHERE m.ticket_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
            (SELECT COUNT(*)::int FROM ticket_messages m WHERE m.ticket_id = t.id) AS messages
       FROM support_tickets t LEFT JOIN orders o ON o.id = t.order_id
      WHERE t.user_id = $1 ORDER BY t.updated_at DESC`,
    [req.user.id]
  );
  res.json({ tickets: rows.map((t) => ({ id: t.id, subject: t.subject, status: t.status, createdAt: t.created_at, updatedAt: t.updated_at, orderNumber: t.order_number, lastMessage: t.last_message, messages: t.messages })) });
});

// POST /api/tickets — новое обращение (роль: любой авторизованный)
// Таблицы: orders (SELECT — заказ свой), support_tickets (INSERT), ticket_messages (INSERT). Транзакция.
router.post(
  '/tickets',
  validate([
    body('subject').isString().trim().isLength({ min: 3, max: 200 }).withMessage(msg('validation.length', { min: 3, max: 200 })),
    body('message').isString().trim().isLength({ min: 10, max: 4000 }).withMessage(msg('validation.length', { min: 10, max: 4000 })),
    body('orderId').optional({ values: 'falsy' }).isInt({ min: 1 }).toInt(),
  ]),
  async (req, res) => {
    const v = req.valid;
    const ticket = await withTransaction(async (client) => {
      if (v.orderId) {
        const own = await client.query('SELECT 1 FROM orders WHERE id = $1 AND user_id = $2', [v.orderId, req.user.id]);
        if (!own.rowCount) throw new ApiError(404, 'orders.notFound');
      }
      const t = await client.query('INSERT INTO support_tickets (user_id, order_id, subject) VALUES ($1, $2, $3) RETURNING id', [req.user.id, v.orderId || null, v.subject]);
      await client.query('INSERT INTO ticket_messages (ticket_id, user_id, message, is_staff) VALUES ($1, $2, $3, FALSE)', [t.rows[0].id, req.user.id, v.message]);
      return t.rows[0];
    });
    res.status(201).json({ ticket });
  }
);

// GET /api/tickets/:id — переписка по своему обращению (роль: любой авторизованный)
// Таблицы: support_tickets, ticket_messages, users (SELECT)
router.get('/tickets/:id', validate([param('id').isInt({ min: 1 }).toInt()]), async (req, res) => {
  const t = await query(
    `SELECT t.*, o.order_number FROM support_tickets t LEFT JOIN orders o ON o.id = t.order_id WHERE t.id = $1 AND t.user_id = $2`,
    [req.valid.id, req.user.id]
  );
  if (!t.rows[0]) throw new ApiError(404, 'tickets.notFound');
  const m = await query(
    `SELECT m.id, m.message, m.image, m.is_staff, m.created_at, u.first_name, u.last_name
       FROM ticket_messages m LEFT JOIN users u ON u.id = m.user_id WHERE m.ticket_id = $1 ORDER BY m.created_at, m.id`,
    [req.valid.id]
  );
  const ticket = t.rows[0];
  res.json({
    ticket: { id: ticket.id, subject: ticket.subject, status: ticket.status, orderId: ticket.order_id, orderNumber: ticket.order_number, createdAt: ticket.created_at },
    messages: m.rows.map((r) => ({ id: r.id, message: r.message, image: r.image, isStaff: r.is_staff, author: r.is_staff ? `${r.first_name || ''}`.trim() : `${r.first_name} ${r.last_name}`, createdAt: r.created_at })),
  });
});

// POST /api/tickets/:id/messages — сообщение в своё обращение (multipart: message, image?) (роль: любой авторизованный)
// Таблицы: support_tickets (SELECT, UPDATE status = 'open'), ticket_messages (INSERT)
router.post('/tickets/:id/messages', uploadTicketImage, validate([param('id').isInt({ min: 1 }).toInt(), body('message').isString().trim().isLength({ min: 1, max: 4000 }).withMessage(msg('validation.length', { min: 1, max: 4000 }))]), async (req, res) => {
  await withTransaction(async (client) => {
    const t = await client.query('SELECT status FROM support_tickets WHERE id = $1 AND user_id = $2 FOR UPDATE', [req.valid.id, req.user.id]);
    if (!t.rows[0]) throw new ApiError(404, 'tickets.notFound');
    if (t.rows[0].status === 'closed') throw new ApiError(409, 'tickets.closed');
    await client.query('INSERT INTO ticket_messages (ticket_id, user_id, message, image, is_staff) VALUES ($1, $2, $3, $4, FALSE)', [req.valid.id, req.user.id, req.valid.message, req.file?.publicUrl || null]);
    await client.query("UPDATE support_tickets SET status = 'open' WHERE id = $1", [req.valid.id]);
  });
  res.status(201).json({ ok: true });
});

// POST /api/tickets/:id/close — закрыть своё обращение (роль: любой авторизованный). Таблица: support_tickets (UPDATE)
router.post('/tickets/:id/close', validate([param('id').isInt({ min: 1 }).toInt()]), async (req, res) => {
  const { rowCount } = await query("UPDATE support_tickets SET status = 'closed' WHERE id = $1 AND user_id = $2", [req.valid.id, req.user.id]);
  if (!rowCount) throw new ApiError(404, 'tickets.notFound');
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------------------------
// Заявка «Стать продавцом»
// ---------------------------------------------------------------------------------------------
// GET /api/seller-application — последняя своя заявка (роль: любой авторизованный). Таблица: seller_applications (SELECT)
router.get('/seller-application', async (req, res) => {
  const { rows } = await query('SELECT id, shop_name, description, status, comment, created_at, reviewed_at FROM seller_applications WHERE user_id = $1 ORDER BY id DESC LIMIT 1', [req.user.id]);
  const a = rows[0];
  res.json({ application: a ? { id: a.id, shopName: a.shop_name, description: a.description, status: a.status, comment: a.comment, createdAt: a.created_at, reviewedAt: a.reviewed_at } : null });
});

// POST /api/seller-application — подать заявку (роль: buyer). Рассматривает модератор (этап 14), при одобрении role → seller.
// Таблица: seller_applications (SELECT — нет ли ожидающей заявки, INSERT)
router.post(
  '/seller-application',
  validate([
    body('shopName').isString().trim().isLength({ min: 2, max: 120 }).withMessage(msg('validation.length', { min: 2, max: 120 })),
    body('description').isString().trim().isLength({ min: 20, max: 2000 }).withMessage(msg('validation.length', { min: 20, max: 2000 })),
  ]),
  async (req, res) => {
    if (req.user.role !== 'buyer') throw new ApiError(409, 'seller.alreadySeller');
    const pending = await query("SELECT 1 FROM seller_applications WHERE user_id = $1 AND status = 'pending'", [req.user.id]);
    if (pending.rowCount) throw new ApiError(409, 'seller.applicationExists');
    const { rows } = await query(
      'INSERT INTO seller_applications (user_id, shop_name, description) VALUES ($1, $2, $3) RETURNING id, status, created_at',
      [req.user.id, req.valid.shopName, req.valid.description]
    );
    res.status(201).json({ application: rows[0] });
  }
);

export default router;
