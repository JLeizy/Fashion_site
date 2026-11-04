// Кабинет кладовщика (раздел 4 ТЗ, роль warehouse; owner проходит всегда): остатки по складам, размерам и товарам
// (поиск, фильтры, подсветка «доступно < 3»), приёмка (income) и списание (writeoff) с комментарием, очередь сборки
// confirmed → assembling → assembled → handed_to_delivery (списание остатков — в orderService.changeStatus),
// приёмка одобренных возвратов (return), журнал движений с фильтрами.
// Все движения остатков пишутся в stock_movements; изменения — в audit_log.
import express from 'express';
import { body, param, query as q } from 'express-validator';
import { query, withTransaction } from '../../../db/pool.js';
import { checkRole } from '../../middleware/auth.js';
import { validate, msg } from '../../middleware/validate.js';
import { ApiError } from '../../lib/errors.js';
import { listValidators, listParams, pageResult, likePattern } from '../../lib/listing.js';
import { changeStatus, nextStatus, audit, notify, assignCourierIfMissing, markReturned } from '../../services/orderService.js';
import { loadOrder } from './orders.js';

const router = express.Router();
router.use(checkRole('warehouse'));

const LOW = 3; // порог «низкого остатка» (доступно < 3), как в представлении v_low_stock
const QUEUE = ['confirmed', 'assembling', 'assembled'];

// ---------------------------------------------------------------------------------------------
// GET /api/warehouse/warehouses — склады со сводкой остатков (роль: warehouse)
// Таблицы: warehouses, stock (SELECT SUM), v_low_stock (SELECT COUNT)
// ---------------------------------------------------------------------------------------------
router.get('/warehouses', async (req, res) => {
  // SQL: склады + суммарные количество, резерв и число позиций с низким остатком
  const { rows } = await query(
    `SELECT w.id, w.name, w.city, w.address,
            COALESCE(SUM(s.quantity), 0)::int AS quantity,
            COALESCE(SUM(s.reserved), 0)::int AS reserved,
            COUNT(s.id) FILTER (WHERE s.quantity > 0)::int AS positions,
            (SELECT COUNT(*)::int FROM v_low_stock l WHERE l.warehouse_id = w.id) AS low
       FROM warehouses w LEFT JOIN stock s ON s.warehouse_id = w.id
      GROUP BY w.id ORDER BY w.id`
  );
  res.json({ warehouses: rows.map((w) => ({ id: w.id, name: w.name, city: w.city, address: w.address, quantity: w.quantity, reserved: w.reserved, available: w.quantity - w.reserved, positions: w.positions, low: w.low })) });
});

// ---------------------------------------------------------------------------------------------
// GET /api/warehouse/summary — счётчики для вкладок (роль: warehouse)
// Таблицы: orders (SELECT COUNT по статусам очереди), return_requests (SELECT COUNT), v_low_stock (SELECT COUNT)
// ---------------------------------------------------------------------------------------------
router.get('/summary', async (req, res) => {
  // SQL: очередь сборки по статусам, ожидающие приёмки возвраты, низкие остатки, движения за сегодня
  const { rows } = await query(
    `SELECT COUNT(*) FILTER (WHERE status = 'confirmed')::int AS confirmed,
            COUNT(*) FILTER (WHERE status = 'assembling')::int AS assembling,
            COUNT(*) FILTER (WHERE status = 'assembled')::int AS assembled,
            (SELECT COUNT(*)::int FROM return_requests WHERE status = 'approved' AND received_at IS NULL) AS returns,
            (SELECT COUNT(*)::int FROM v_low_stock) AS low,
            (SELECT COUNT(*)::int FROM stock_movements WHERE created_at::date = CURRENT_DATE) AS movements_today
       FROM orders WHERE status = ANY($1::text[])`,
    [QUEUE]
  );
  res.json(rows[0]);
});

// ---------------------------------------------------------------------------------------------
// GET /api/warehouse/stock?warehouse=&q=&brand=&low=1&page=&sort=&dir= — остатки по складам и размерам (роль: warehouse)
// Строка = вариант (размер) товара на складе. Доступно = quantity − reserved.
// Таблицы: stock, warehouses, product_variants, products, brands, sizes, product_images (SELECT)
// ---------------------------------------------------------------------------------------------
const STOCK_SORT = { sku: 'pv.sku_variant', name: 'p.name_ru', brand: 'b.name', warehouse: 'w.name', quantity: 's.quantity', reserved: 's.reserved', available: '(s.quantity - s.reserved)', updated: 's.updated_at' };
router.get(
  '/stock',
  validate([...listValidators, q('warehouse').optional().isInt({ min: 1 }).toInt(), q('brand').optional().isInt({ min: 1 }).toInt(), q('low').optional().isIn(['0', '1'])]),
  async (req, res) => {
    const lp = listParams(req, STOCK_SORT, 'available', 'asc', 25);
    const params = [];
    const where = ['TRUE'];
    if (req.valid.warehouse) {
      params.push(req.valid.warehouse);
      where.push(`s.warehouse_id = $${params.length}`);
    }
    if (req.valid.brand) {
      params.push(req.valid.brand);
      where.push(`p.brand_id = $${params.length}`);
    }
    if (req.valid.low === '1') where.push(`s.quantity - s.reserved < ${LOW}`);
    if (lp.search) {
      params.push(likePattern(lp.search));
      where.push(`(p.sku ILIKE $${params.length} OR pv.sku_variant ILIKE $${params.length} OR p.name_ru ILIKE $${params.length} OR p.name_en ILIKE $${params.length} OR b.name ILIKE $${params.length})`);
    }
    params.push(lp.limit, lp.offset);
    // SQL: страница остатков с фильтрами (один параметризованный запрос)
    const { rows } = await query(
      `SELECT s.id, s.variant_id, s.warehouse_id, s.quantity, s.reserved, s.quantity - s.reserved AS available, s.updated_at,
              w.name AS warehouse, w.city, pv.sku_variant, sz.value_int AS size, p.id AS product_id, p.sku, p.name_ru, p.name_en, b.name AS brand,
              (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_main DESC, pi.sort_order LIMIT 1) AS image,
              COUNT(*) OVER () AS total
         FROM stock s
         JOIN warehouses w        ON w.id = s.warehouse_id
         JOIN product_variants pv ON pv.id = s.variant_id
         JOIN products p          ON p.id = pv.product_id
         JOIN brands b            ON b.id = p.brand_id
         JOIN sizes sz            ON sz.id = pv.size_id
        WHERE ${where.join(' AND ')}
        ORDER BY ${lp.order}, s.id
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json(
      pageResult(
        rows.map((r) => ({
          id: r.id, variantId: r.variant_id, warehouseId: r.warehouse_id, warehouse: r.warehouse, city: r.city,
          sku: r.sku_variant, productSku: r.sku, size: r.size, productId: r.product_id, name: { ru: r.name_ru, en: r.name_en }, brand: r.brand,
          image: r.image, quantity: r.quantity, reserved: r.reserved, available: r.available, low: r.available < LOW, updatedAt: r.updated_at,
        })),
        Number(rows[0]?.total || 0),
        lp
      )
    );
  }
);

// ---------------------------------------------------------------------------------------------
// GET /api/warehouse/variants?q= — поиск варианта товара для приёмки (по артикулу или названию) (роль: warehouse)
// Таблицы: product_variants, products, brands, sizes, stock (SELECT)
// ---------------------------------------------------------------------------------------------
router.get('/variants', validate([q('q').isString().trim().isLength({ min: 2, max: 80 })]), async (req, res) => {
  // SQL: до 20 вариантов, подходящих под запрос, с остатками по складам
  const { rows } = await query(
    `SELECT pv.id, pv.sku_variant, sz.value_int AS size, p.id AS product_id, p.name_ru, p.name_en, p.moderation_status, b.name AS brand,
            (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_main DESC, pi.sort_order LIMIT 1) AS image,
            (SELECT json_agg(json_build_object('warehouseId', s.warehouse_id, 'quantity', s.quantity, 'reserved', s.reserved) ORDER BY s.warehouse_id)
               FROM stock s WHERE s.variant_id = pv.id) AS stock
       FROM product_variants pv JOIN products p ON p.id = pv.product_id JOIN brands b ON b.id = p.brand_id JOIN sizes sz ON sz.id = pv.size_id
      WHERE pv.sku_variant ILIKE $1 OR p.sku ILIKE $1 OR p.name_ru ILIKE $1 OR p.name_en ILIKE $1
      ORDER BY p.sku, sz.sort_order LIMIT 20`,
    [likePattern(req.valid.q)]
  );
  res.json({ variants: rows.map((r) => ({ id: r.id, sku: r.sku_variant, size: r.size, productId: r.product_id, name: { ru: r.name_ru, en: r.name_en }, brand: r.brand, status: r.moderation_status, image: r.image, stock: r.stock || [] })) });
});

const movementValidators = [
  body('variantId').isInt({ min: 1 }).withMessage(msg('validation.required')).toInt(),
  body('warehouseId').isInt({ min: 1 }).withMessage(msg('validation.required')).toInt(),
  body('quantity').isInt({ min: 1, max: 10000 }).withMessage(msg('validation.positive')).toInt(),
  body('comment').isString().trim().isLength({ min: 3, max: 300 }).withMessage(msg('validation.length', { min: 3, max: 300 })),
];

// ---------------------------------------------------------------------------------------------
// POST /api/warehouse/income — приёмка товара на склад (роль: warehouse)
// Транзакция. Таблицы: product_variants, warehouses (SELECT), stock (INSERT … ON CONFLICT DO UPDATE quantity += N),
//             stock_movements (INSERT 'income'), audit_log (INSERT)
// ---------------------------------------------------------------------------------------------
router.post('/income', validate(movementValidators), async (req, res) => {
  const v = req.valid;
  const stock = await withTransaction(async (client) => {
    // SQL: вариант и склад существуют
    const chk = await client.query('SELECT (SELECT 1 FROM product_variants WHERE id = $1) AS v, (SELECT 1 FROM warehouses WHERE id = $2) AS w', [v.variantId, v.warehouseId]);
    if (!chk.rows[0].v) throw new ApiError(404, 'warehouse.variantNotFound');
    if (!chk.rows[0].w) throw new ApiError(404, 'warehouse.notFound');
    // SQL: остаток += N (строка создаётся, если варианта на этом складе ещё не было)
    const up = await client.query(
      `INSERT INTO stock (variant_id, warehouse_id, quantity, reserved) VALUES ($1, $2, $3, 0)
       ON CONFLICT (variant_id, warehouse_id) DO UPDATE SET quantity = stock.quantity + EXCLUDED.quantity
       RETURNING id, quantity, reserved`,
      [v.variantId, v.warehouseId, v.quantity]
    );
    // SQL: движение 'income'
    await client.query(
      `INSERT INTO stock_movements (variant_id, warehouse_id, type, quantity, user_id, comment) VALUES ($1, $2, 'income', $3, $4, $5)`,
      [v.variantId, v.warehouseId, v.quantity, req.user.id, v.comment]
    );
    await audit(client, { userId: req.user.id, action: 'stock.income', entity: 'stock', entityId: up.rows[0].id, oldData: { quantity: up.rows[0].quantity - v.quantity }, newData: { quantity: up.rows[0].quantity, comment: v.comment }, ip: req.ip });
    return up.rows[0];
  });
  res.status(201).json({ stock: { id: stock.id, quantity: stock.quantity, reserved: stock.reserved, available: stock.quantity - stock.reserved } });
});

// ---------------------------------------------------------------------------------------------
// POST /api/warehouse/writeoff — списание (брак, утеря, пересорт) (роль: warehouse).
// Списать можно только свободный остаток (quantity − reserved): зарезервированное под заказы не трогаем.
// Транзакция. Таблицы: stock (SELECT … FOR UPDATE, UPDATE quantity −= N), stock_movements (INSERT 'writeoff'), audit_log (INSERT)
// ---------------------------------------------------------------------------------------------
router.post('/writeoff', validate(movementValidators), async (req, res) => {
  const v = req.valid;
  const stock = await withTransaction(async (client) => {
    // SQL: строка остатка блокируется (SELECT … FOR UPDATE), чтобы параллельный заказ не зарезервировал списываемое
    const { rows } = await client.query('SELECT id, quantity, reserved FROM stock WHERE variant_id = $1 AND warehouse_id = $2 FOR UPDATE', [v.variantId, v.warehouseId]);
    const s = rows[0];
    if (!s) throw new ApiError(404, 'warehouse.stockNotFound');
    const available = s.quantity - s.reserved;
    if (v.quantity > available) throw new ApiError(409, 'warehouse.insufficient', { params: { available } });
    // SQL: quantity −= N
    const up = await client.query('UPDATE stock SET quantity = quantity - $2 WHERE id = $1 RETURNING id, quantity, reserved', [s.id, v.quantity]);
    // SQL: движение 'writeoff'
    await client.query(
      `INSERT INTO stock_movements (variant_id, warehouse_id, type, quantity, user_id, comment) VALUES ($1, $2, 'writeoff', $3, $4, $5)`,
      [v.variantId, v.warehouseId, v.quantity, req.user.id, v.comment]
    );
    await audit(client, { userId: req.user.id, action: 'stock.writeoff', entity: 'stock', entityId: s.id, oldData: { quantity: s.quantity }, newData: { quantity: up.rows[0].quantity, comment: v.comment }, ip: req.ip });
    return up.rows[0];
  });
  res.json({ stock: { id: stock.id, quantity: stock.quantity, reserved: stock.reserved, available: stock.quantity - stock.reserved } });
});

// ---------------------------------------------------------------------------------------------
// GET /api/warehouse/queue?status=&q= — очередь сборки: заказы confirmed / assembling / assembled (роль: warehouse)
// Состав с указанием склада резерва по каждой позиции; старые заказы — первыми (FIFO).
// Таблицы: orders, order_items, warehouses, delivery_methods, users (курьер) (SELECT)
// ---------------------------------------------------------------------------------------------
router.get('/queue', validate([q('status').optional().isIn(['all', ...QUEUE]), q('q').optional().isString().trim().isLength({ max: 40 }), q('warehouse').optional().isInt({ min: 1 }).toInt()]), async (req, res) => {
  const params = [req.valid.status && req.valid.status !== 'all' ? [req.valid.status] : QUEUE];
  const where = ['o.status = ANY($1::text[])'];
  if (req.valid.q) {
    params.push(likePattern(req.valid.q));
    where.push(`(o.order_number ILIKE $${params.length} OR o.tracking_number ILIKE $${params.length})`);
  }
  if (req.valid.warehouse) {
    params.push(req.valid.warehouse);
    where.push(`EXISTS (SELECT 1 FROM order_items x WHERE x.order_id = o.id AND x.warehouse_id = $${params.length})`);
  }
  // SQL: заказы очереди с составом (до 200 — очередь склада не бывает длиннее)
  const { rows } = await query(
    `SELECT o.id, o.order_number, o.status, o.created_at, o.updated_at, o.comment, o.expected_delivery_date,
            dm.code AS dm_code, dm.name_ru AS dm_ru, dm.name_en AS dm_en, dm.is_pickup,
            split_part(o.address_snapshot, E'\\n', 2) AS city,
            cu.first_name || ' ' || cu.last_name AS courier,
            (SELECT json_agg(json_build_object('id', oi.id, 'name', oi.product_name, 'nameEn', oi.product_name_en, 'sku', oi.sku, 'size', oi.size_label,
                                               'qty', oi.quantity, 'image', oi.image_url, 'warehouse', w.name, 'warehouseId', oi.warehouse_id) ORDER BY oi.warehouse_id, oi.id)
               FROM order_items oi LEFT JOIN warehouses w ON w.id = oi.warehouse_id WHERE oi.order_id = o.id) AS items,
            (SELECT MAX(h.created_at) FROM order_status_history h WHERE h.order_id = o.id) AS status_at
       FROM orders o JOIN delivery_methods dm ON dm.id = o.delivery_method_id LEFT JOIN users cu ON cu.id = o.courier_id
      WHERE ${where.join(' AND ')}
      ORDER BY o.created_at ASC
      LIMIT 200`,
    params
  );
  res.json({
    orders: rows.map((o) => ({
      id: o.id, orderNumber: o.order_number, status: o.status, createdAt: o.created_at, statusAt: o.status_at, comment: o.comment, city: o.city,
      expectedDeliveryDate: o.expected_delivery_date, courier: o.courier, next: nextStatus(o.status, o.is_pickup),
      delivery: { code: o.dm_code, name: { ru: o.dm_ru, en: o.dm_en }, isPickup: o.is_pickup },
      items: (o.items || []).map((i) => ({ ...i, name: { ru: i.name, en: i.nameEn || i.name } })),
    })),
  });
});

// GET /api/warehouse/orders/:id — детали заказа из очереди (роль: warehouse). Таблицы: см. loadOrder (orders.js)
router.get('/orders/:id', validate([param('id').isInt({ min: 1 }).toInt()]), async (req, res) => {
  const order = await loadOrder('o.id = $1', [req.valid.id]);
  if (!order) throw new ApiError(404, 'orders.notFound');
  res.json({ order });
});

// ---------------------------------------------------------------------------------------------
// POST /api/warehouse/orders/:id/advance — следующий шаг сборки (роль: warehouse):
//   confirmed → assembling («Начать сборку»), assembling → assembled («Собран»),
//   assembled → handed_to_delivery («Передать в доставку»: списание quantity −= N, reserved −= N, движение outcome;
//   если курьер не назначен владельцем — автоназначение курьера с наименьшей нагрузкой).
// Транзакция. Таблицы: orders (SELECT FOR UPDATE, UPDATE status, courier_id), stock (UPDATE), stock_movements (INSERT),
//             order_status_history (INSERT), notifications (INSERT), audit_log (INSERT) — services/orderService.js → changeStatus
// ---------------------------------------------------------------------------------------------
router.post('/orders/:id/advance', validate([param('id').isInt({ min: 1 }).toInt(), body('comment').optional({ values: 'falsy' }).isString().trim().isLength({ max: 300 })]), async (req, res) => {
  const result = await withTransaction(async (client) => {
    // SQL: статус и способ доставки заказа
    const { rows } = await client.query('SELECT o.status, dm.is_pickup FROM orders o JOIN delivery_methods dm ON dm.id = o.delivery_method_id WHERE o.id = $1 FOR UPDATE OF o', [req.valid.id]);
    const o = rows[0];
    if (!o) throw new ApiError(404, 'orders.notFound');
    if (!QUEUE.includes(o.status)) throw new ApiError(409, 'warehouse.notInQueue');
    const to = nextStatus(o.status, o.is_pickup);
    if (to === 'handed_to_delivery') await assignCourierIfMissing(client, req.valid.id, req.user, req.ip);
    const defaults = { assembling: 'Сборка начата', assembled: 'Заказ собран и упакован', handed_to_delivery: 'Передан курьеру' };
    return changeStatus(req.valid.id, to, req.user, { comment: req.valid.comment || defaults[to], ip: req.ip, client });
  });
  res.json({ result });
});

// ---------------------------------------------------------------------------------------------
// GET /api/warehouse/returns?scope=awaiting|received — одобренные поддержкой возвраты для приёмки на склад (роль: warehouse)
// Таблицы: return_requests, order_items, orders, warehouses, users (SELECT)
// ---------------------------------------------------------------------------------------------
router.get('/returns', validate([q('scope').optional().isIn(['awaiting', 'received'])]), async (req, res) => {
  const received = req.valid.scope === 'received';
  // SQL: возвраты, ожидающие приёмки (или уже принятые — последние 100)
  const { rows } = await query(
    `SELECT rr.id, rr.quantity, rr.reason_code, rr.reason, rr.photo, rr.comment, rr.resolved_at, rr.received_at, rr.created_at,
            oi.product_name, oi.product_name_en, oi.sku, oi.size_label, oi.image_url, oi.price_byn, oi.warehouse_id, oi.variant_id,
            w.name AS warehouse, o.id AS order_id, o.order_number, u.first_name || ' ' || u.last_name AS buyer,
            rv.first_name || ' ' || rv.last_name AS received_by
       FROM return_requests rr
       JOIN order_items oi ON oi.id = rr.order_item_id
       JOIN orders o ON o.id = rr.order_id
       JOIN users u ON u.id = rr.user_id
       LEFT JOIN warehouses w ON w.id = oi.warehouse_id
       LEFT JOIN users rv ON rv.id = rr.received_by
      WHERE rr.status = 'approved' AND (rr.received_at IS NOT NULL) = $1
      ORDER BY ${received ? 'rr.received_at DESC' : 'rr.resolved_at ASC NULLS LAST'}
      LIMIT 100`,
    [received]
  );
  res.json({
    returns: rows.map((r) => ({
      id: r.id, quantity: r.quantity, reasonCode: r.reason_code, reason: r.reason, photo: r.photo, comment: r.comment, resolvedAt: r.resolved_at,
      receivedAt: r.received_at, receivedBy: r.received_by, createdAt: r.created_at, orderId: r.order_id, orderNumber: r.order_number, buyer: r.buyer,
      item: { name: { ru: r.product_name, en: r.product_name_en || r.product_name }, sku: r.sku, size: r.size_label, image: r.image_url, price: Number(r.price_byn), warehouseId: r.warehouse_id, warehouse: r.warehouse, restockable: Boolean(r.variant_id) },
    })),
  });
});

// ---------------------------------------------------------------------------------------------
// POST /api/warehouse/returns/:id/receive — приёмка возвращённого товара (роль: warehouse).
// quantity += N на складе (движение 'return'), отметка received_by / received_at, уведомление покупателю;
// если по заказу возвращены все позиции — заказ переходит в returned, оплата — в refunded (orderService.markReturned).
// Транзакция. Таблицы: return_requests (SELECT FOR UPDATE, UPDATE), order_items (SELECT), stock (INSERT … ON CONFLICT UPDATE),
//             stock_movements (INSERT), orders, order_status_history, notifications, audit_log (INSERT / UPDATE)
// ---------------------------------------------------------------------------------------------
router.post(
  '/returns/:id/receive',
  validate([param('id').isInt({ min: 1 }).toInt(), body('warehouseId').optional({ values: 'null' }).isInt({ min: 1 }).toInt(), body('comment').optional({ values: 'falsy' }).isString().trim().isLength({ max: 300 })]),
  async (req, res) => {
    const result = await withTransaction(async (client) => {
      // SQL: заявка блокируется (повторная приёмка невозможна)
      const { rows } = await client.query(
        `SELECT rr.*, oi.variant_id, oi.warehouse_id, oi.product_name, o.order_number, o.user_id AS buyer_id
           FROM return_requests rr JOIN order_items oi ON oi.id = rr.order_item_id JOIN orders o ON o.id = rr.order_id
          WHERE rr.id = $1 FOR UPDATE OF rr`,
        [req.valid.id]
      );
      const r = rows[0];
      if (!r) throw new ApiError(404, 'returns.notFound');
      if (r.status !== 'approved') throw new ApiError(409, 'returns.notApproved');
      if (r.received_at) throw new ApiError(409, 'returns.alreadyReceived');
      const warehouseId = req.valid.warehouseId || r.warehouse_id;
      if (r.variant_id && warehouseId) {
        // SQL: товар возвращается на склад: quantity += N
        await client.query(
          `INSERT INTO stock (variant_id, warehouse_id, quantity, reserved) VALUES ($1, $2, $3, 0)
           ON CONFLICT (variant_id, warehouse_id) DO UPDATE SET quantity = stock.quantity + EXCLUDED.quantity`,
          [r.variant_id, warehouseId, r.quantity]
        );
        // SQL: движение 'return'
        await client.query(
          `INSERT INTO stock_movements (variant_id, warehouse_id, type, quantity, order_id, user_id, comment) VALUES ($1, $2, 'return', $3, $4, $5, $6)`,
          [r.variant_id, warehouseId, r.quantity, r.order_id, req.user.id, req.valid.comment || `Возврат по заказу ${r.order_number}`]
        );
      }
      // SQL: отметка о приёмке
      await client.query('UPDATE return_requests SET received_by = $2, received_at = NOW() WHERE id = $1', [r.id, req.user.id]);
      await notify(client, r.buyer_id, {
        type: 'return_decision',
        title_ru: `Возврат по заказу ${r.order_number} принят на склад`,
        title_en: `Return for order ${r.order_number} received`,
        text_ru: 'Товар проверен и принят. Деньги вернутся в течение 3–5 рабочих дней.',
        text_en: 'The item has been inspected and received. The refund will arrive within 3–5 business days.',
        link: '/account/returns',
      });
      await audit(client, { userId: req.user.id, action: 'return.receive', entity: 'return_requests', entityId: r.id, newData: { warehouse_id: warehouseId, quantity: r.quantity }, ip: req.ip });
      // SQL: все ли позиции заказа возвращены полностью (по принятым возвратам)
      const left = await client.query(
        `SELECT COUNT(*)::int AS n FROM order_items oi
          WHERE oi.order_id = $1
            AND oi.quantity > COALESCE((SELECT SUM(x.quantity) FROM return_requests x WHERE x.order_item_id = oi.id AND x.status = 'approved' AND x.received_at IS NOT NULL), 0)`,
        [r.order_id]
      );
      const fully = left.rows[0].n === 0 ? await markReturned(client, r.order_id, req.user, { comment: 'Все позиции возвращены и приняты складом', ip: req.ip }) : null;
      return { id: r.id, orderReturned: Boolean(fully) };
    });
    res.json(result);
  }
);

// ---------------------------------------------------------------------------------------------
// GET /api/warehouse/movements?type=&warehouse=&q=&from=&to=&page= — журнал движений остатков (роль: warehouse)
// Таблицы: stock_movements, product_variants, products, warehouses, users, orders (SELECT)
// ---------------------------------------------------------------------------------------------
const MOVE_TYPES = ['income', 'reserve', 'unreserve', 'outcome', 'return', 'writeoff'];
router.get(
  '/movements',
  validate([
    ...listValidators,
    q('type').optional().isIn(['all', ...MOVE_TYPES]),
    q('warehouse').optional().isInt({ min: 1 }).toInt(),
    q('from').optional({ values: 'falsy' }).isISO8601().withMessage(msg('validation.date')),
    q('to').optional({ values: 'falsy' }).isISO8601().withMessage(msg('validation.date')),
  ]),
  async (req, res) => {
    const lp = listParams(req, { created: 'm.created_at', quantity: 'm.quantity', type: 'm.type' }, 'created', 'desc', 30);
    const params = [];
    const where = ['TRUE'];
    const add = (sql, value) => {
      params.push(value);
      where.push(sql.replace('?', `$${params.length}`));
    };
    if (req.valid.type && req.valid.type !== 'all') add('m.type = ?', req.valid.type);
    if (req.valid.warehouse) add('m.warehouse_id = ?', req.valid.warehouse);
    if (req.valid.from) add('m.created_at >= ?::date', req.valid.from);
    if (req.valid.to) add("m.created_at < ?::date + INTERVAL '1 day'", req.valid.to);
    if (lp.search) {
      params.push(likePattern(lp.search));
      const n = params.length;
      where.push(`(pv.sku_variant ILIKE $${n} OR p.name_ru ILIKE $${n} OR p.name_en ILIKE $${n} OR o.order_number ILIKE $${n} OR m.comment ILIKE $${n})`);
    }
    params.push(lp.limit, lp.offset);
    // SQL: страница журнала движений с фильтрами
    const { rows } = await query(
      `SELECT m.id, m.type, m.quantity, m.comment, m.created_at, m.order_id, o.order_number, w.name AS warehouse,
              pv.sku_variant, p.id AS product_id, p.name_ru, p.name_en, u.first_name || ' ' || u.last_name AS author, r.code AS author_role,
              COUNT(*) OVER () AS total
         FROM stock_movements m
         JOIN product_variants pv ON pv.id = m.variant_id
         JOIN products p ON p.id = pv.product_id
         JOIN warehouses w ON w.id = m.warehouse_id
         LEFT JOIN orders o ON o.id = m.order_id
         LEFT JOIN users u ON u.id = m.user_id
         LEFT JOIN roles r ON r.id = u.role_id
        WHERE ${where.join(' AND ')}
        ORDER BY ${lp.order}, m.id DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json(
      pageResult(
        rows.map((m) => ({ id: m.id, type: m.type, quantity: m.quantity, comment: m.comment, createdAt: m.created_at, orderId: m.order_id, orderNumber: m.order_number, warehouse: m.warehouse, sku: m.sku_variant, productId: m.product_id, name: { ru: m.name_ru, en: m.name_en }, author: m.author, authorRole: m.author_role })),
        Number(rows[0]?.total || 0),
        lp
      )
    );
  }
);

export default router;
