// Заказы: оформление и смена статусов (разделы 3.3, 3.5 ТЗ). Единственное место, где меняются остатки по заказам —
// оформление, сборка, передача в доставку, доставка, отмена; его используют покупатель, склад, курьер,
// поддержка и владелец (в т. ч. демо-кнопки «провести заказ по всем статусам»).
//
// Правила движения остатков (stock: quantity — на складе, reserved — в резерве; доступно = quantity − reserved):
//   оформление              → reserved += N                      (stock_movements.type = 'reserve')
//   передача в доставку     → quantity −= N, reserved −= N       ('outcome')
//   отмена до передачи      → reserved −= N                      ('unreserve')
//   одобренный возврат      → quantity += N                      ('return' — в returnService, этап 12–13)
import { withTransaction, query } from '../../db/pool.js';
import { ApiError } from '../lib/errors.js';
import { randomTrackingNumber } from '../lib/tracking.js';
import { statusLabel } from '../lib/i18n.js';
import { config } from '../../config/index.js';
import { getRates } from './rates.js';
import { validatePromo } from './cartService.js';
import { orderStatusNotification } from './notificationTexts.js';

// Основная цепочка статусов; arrived — только для способов доставки с is_pickup = true
export const FLOW = ['created', 'confirmed', 'assembling', 'assembled', 'handed_to_delivery', 'in_transit', 'arrived', 'delivered'];
export const FINAL = ['delivered', 'cancelled', 'returned'];
// Отменить можно до передачи в доставку (покупатель — только created / confirmed, проверяется в маршруте)
export const CANCELLABLE = ['created', 'confirmed', 'assembling', 'assembled'];

export function flowFor(isPickup) {
  return FLOW.filter((s) => s !== 'arrived' || isPickup);
}

// Следующий статус по цепочке (для кнопок склада, курьера и демо владельца)
export function nextStatus(status, isPickup) {
  const flow = flowFor(isPickup);
  const i = flow.indexOf(status);
  return i >= 0 && i < flow.length - 1 ? flow[i + 1] : null;
}

const round2 = (n) => Math.round(n * 100) / 100;

const COUNTRY_NAMES = { BY: 'Беларусь', RU: 'Россия', KZ: 'Казахстан', AM: 'Армения', UZ: 'Узбекистан', KG: 'Кыргызстан', AZ: 'Азербайджан', TJ: 'Таджикистан', MD: 'Молдова', GE: 'Грузия' };

export function addressToText(a) {
  return [
    `${a.recipient}, ${a.phone}`,
    [a.postal_code, COUNTRY_NAMES[a.country] || a.country, a.city].filter(Boolean).join(', '),
    [a.street, a.house && `д. ${a.house}`, a.apartment && `кв. ${a.apartment}`].filter(Boolean).join(', '),
  ].join('\n');
}

// Запись уведомления покупателю. Таблица: notifications (INSERT)
export async function notify(client, userId, n) {
  await client.query(
    `INSERT INTO notifications (user_id, type, title_ru, title_en, text_ru, text_en, link)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [userId, n.type, n.title_ru, n.title_en, n.text_ru || '', n.text_en || '', n.link || null]
  );
}

// Запись в журнал действий (действия сотрудников). Таблица: audit_log (INSERT)
export async function audit(client, { userId, action, entity, entityId, oldData = null, newData = null, ip = null }) {
  await client.query(
    `INSERT INTO audit_log (user_id, action, entity, entity_id, old_data, new_data, ip)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [userId, action, entity, entityId, oldData ? JSON.stringify(oldData) : null, newData ? JSON.stringify(newData) : null, ip]
  );
}

// ---------------------------------------------------------------------------------------------
// Расчёт заказа (без записи): позиции корзины, доставка, промокод, итог. Используется шагом «Подтверждение»
// и самим оформлением. Таблицы: carts, cart_items, product_variants, products, brands, sizes, product_images,
// v_variant_stock, delivery_methods, promo_codes (SELECT)
// ---------------------------------------------------------------------------------------------
export async function quote(userId, { deliveryMethodId = null, promoCode = null } = {}, client = null) {
  const run = client ? client.query.bind(client) : query;
  // SQL: позиции корзины пользователя с ценой, остатком и фото
  const { rows: items } = await run(
    `SELECT ci.id AS cart_item_id, ci.quantity, pv.id AS variant_id, pv.sku_variant, s.value_int AS size_label,
            p.id AS product_id, p.sku, p.name_ru, p.name_en, p.price_byn, p.seller_id, p.moderation_status,
            b.name AS brand_name,
            (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_main DESC, pi.sort_order LIMIT 1) AS image,
            COALESCE(vs.available, 0) AS available
       FROM carts c
       JOIN cart_items ci      ON ci.cart_id = c.id
       JOIN product_variants pv ON pv.id = ci.variant_id
       JOIN products p          ON p.id = pv.product_id
       JOIN brands b            ON b.id = p.brand_id
       JOIN sizes s             ON s.id = pv.size_id
       LEFT JOIN v_variant_stock vs ON vs.variant_id = pv.id
      WHERE c.user_id = $1
      ORDER BY ci.added_at DESC`,
    [userId]
  );
  const valid = items.filter((i) => i.moderation_status === 'approved' && i.available > 0);
  const subtotal = round2(valid.reduce((sum, i) => sum + Number(i.price_byn) * Math.min(i.quantity, i.available), 0));

  let promo = null;
  if (promoCode) {
    try {
      promo = await validatePromo(promoCode, client);
    } catch (err) {
      if (client) throw err; // при оформлении — ошибка; при расчёте — просто без скидки
      promo = null;
    }
  }
  const discount = promo ? round2((subtotal * promo.discount_percent) / 100) : 0;

  let delivery = null;
  let deliveryPrice = 0;
  if (deliveryMethodId) {
    // SQL: выбранный способ доставки
    const d = await run('SELECT * FROM delivery_methods WHERE id = $1 AND is_active', [deliveryMethodId]);
    delivery = d.rows[0] || null;
    if (!delivery) throw new ApiError(422, 'orders.deliveryInvalid');
    const afterDiscount = subtotal - discount;
    deliveryPrice = afterDiscount >= config.shop.freeDeliveryFromByn ? 0 : Number(delivery.price_byn);
  }
  const total = round2(subtotal - discount + deliveryPrice);
  return { items, valid, subtotal, discount, promo, delivery, deliveryPrice, total };
}

// ---------------------------------------------------------------------------------------------
// POST /api/orders → оформление заказа. ОДНА транзакция:
//   1) адрес (свой из адресной книги или новый → addresses INSERT), способы доставки и оплаты;
//   2) позиции корзины; остатки по складам блокируются SELECT … FOR UPDATE (нельзя продать больше, чем есть);
//   3) промокод (promo_codes FOR UPDATE, used_count + 1);
//   4) orders INSERT (цены, валюта, курс фиксируются), order_items INSERT (снимок названия и цены);
//   5) stock UPDATE reserved += N, stock_movements INSERT 'reserve';
//   6) order_status_history: created → confirmed; notifications; cart_items DELETE.
// ---------------------------------------------------------------------------------------------
export async function createOrder(user, input, ip = null) {
  return withTransaction(async (client) => {
    // 1. Адрес
    let address;
    if (input.addressId) {
      // SQL: адрес из адресной книги — только свой
      const a = await client.query('SELECT * FROM addresses WHERE id = $1 AND user_id = $2', [input.addressId, user.id]);
      address = a.rows[0];
      if (!address) throw new ApiError(404, 'orders.addressNotFound');
    } else if (input.address) {
      const a = input.address;
      if (input.saveAddress) {
        // SQL: новый адрес сохраняется в адресную книгу (первый — по умолчанию)
        const ins = await client.query(
          `INSERT INTO addresses (user_id, country, city, street, house, apartment, postal_code, recipient, phone, is_default)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOT EXISTS (SELECT 1 FROM addresses WHERE user_id = $1))
           RETURNING *`,
          [user.id, a.country, a.city, a.street, a.house, a.apartment || null, a.postalCode || null, a.recipient, a.phone]
        );
        address = ins.rows[0];
      } else {
        address = { id: null, country: a.country, city: a.city, street: a.street, house: a.house, apartment: a.apartment, postal_code: a.postalCode, recipient: a.recipient, phone: a.phone };
      }
    } else {
      throw new ApiError(422, 'orders.addressRequired');
    }

    // 2. Оплата
    // SQL: способ оплаты
    const pm = await client.query('SELECT * FROM payment_methods WHERE id = $1 AND is_active', [input.paymentMethodId]);
    const payment = pm.rows[0];
    if (!payment) throw new ApiError(422, 'orders.paymentInvalid');

    // 3. Корзина, доставка, промокод (промокод блокируется FOR UPDATE внутри validatePromo)
    const q = await quote(user.id, { deliveryMethodId: input.deliveryMethodId, promoCode: input.promoCode }, client);
    if (!q.items.length) throw new ApiError(422, 'cart.empty');
    if (q.valid.length !== q.items.length || q.items.some((i) => i.quantity > i.available)) {
      throw new ApiError(409, 'orders.stockChanged', { code: 'STOCK_CHANGED' });
    }

    // 4. Распределение по складам с блокировкой строк остатков
    const allocations = []; // { item, warehouseId, qty }
    for (const item of q.items) {
      // SQL: остатки варианта по складам — блокировка строк до конца транзакции (SELECT … FOR UPDATE)
      const st = await client.query(
        `SELECT id, warehouse_id, quantity, reserved
           FROM stock
          WHERE variant_id = $1 AND quantity - reserved > 0
          ORDER BY (quantity - reserved) DESC, warehouse_id
          FOR UPDATE`,
        [item.variant_id]
      );
      let need = item.quantity;
      for (const row of st.rows) {
        if (need <= 0) break;
        const take = Math.min(need, row.quantity - row.reserved);
        allocations.push({ item, stockId: row.id, warehouseId: row.warehouse_id, qty: take });
        need -= take;
      }
      if (need > 0) throw new ApiError(409, 'orders.stockChanged', { code: 'STOCK_CHANGED' });
    }

    // 5. Валюта и курс на момент оформления (currency_rates)
    const rates = await getRates();
    const currency = ['BYN', 'USD', 'EUR'].includes(input.currency) ? input.currency : 'BYN';
    const rate = rates[currency] || 1;
    const totalInCurrency = round2(q.total / rate);
    const expected = new Date(Date.now() + q.delivery.days_max * 86400000).toISOString().slice(0, 10);

    // 6. Заказ. Трек-номер уникален — при редком совпадении генерируем заново
    let order;
    for (let attempt = 0; attempt < 5 && !order; attempt += 1) {
      try {
        await client.query('SAVEPOINT order_insert');
        // SQL: заказ (номер AMF-ГГГГ-NNNNNN — DEFAULT next_order_number())
        const ins = await client.query(
          `INSERT INTO orders (tracking_number, user_id, contact_name, contact_phone, contact_email, address_id, address_snapshot,
                               delivery_method_id, payment_method_id, subtotal_byn, delivery_price_byn, discount_byn, total_byn,
                               promo_code_id, currency, exchange_rate, total_in_currency, status, payment_status, comment,
                               expected_delivery_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'created', 'pending', $18, $19)
           RETURNING *`,
          [
            randomTrackingNumber(), user.id, input.contact.name, input.contact.phone, input.contact.email, address.id, addressToText(address),
            q.delivery.id, payment.id, q.subtotal, q.deliveryPrice, q.discount, q.total, q.promo?.id || null, currency, rate,
            totalInCurrency, input.comment || null, expected,
          ]
        );
        order = ins.rows[0];
        await client.query('RELEASE SAVEPOINT order_insert');
      } catch (err) {
        await client.query('ROLLBACK TO SAVEPOINT order_insert');
        if (err.code !== '23505') throw err;
      }
    }
    if (!order) throw new ApiError(500, 'errors.internal');

    // 7. Позиции (снимок названия и цены) + резерв на складе + журнал движений
    for (const a of allocations) {
      const it = a.item;
      // SQL: позиция заказа
      await client.query(
        `INSERT INTO order_items (order_id, variant_id, product_id, seller_id, warehouse_id, product_name, product_name_en,
                                  size_label, sku, image_url, price_byn, quantity)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [order.id, it.variant_id, it.product_id, it.seller_id, a.warehouseId, `${it.brand_name} — ${it.name_ru}`, `${it.brand_name} — ${it.name_en}`, it.size_label, it.sku_variant || it.sku, it.image, it.price_byn, a.qty]
      );
      // SQL: резерв (reserved += N) — строка уже заблокирована FOR UPDATE
      await client.query('UPDATE stock SET reserved = reserved + $1 WHERE id = $2', [a.qty, a.stockId]);
      // SQL: движение 'reserve'
      await client.query(
        `INSERT INTO stock_movements (variant_id, warehouse_id, type, quantity, order_id, user_id, comment)
         VALUES ($1, $2, 'reserve', $3, $4, $5, $6)`,
        [it.variant_id, a.warehouseId, a.qty, order.id, user.id, `Резерв под заказ ${order.order_number}`]
      );
    }

    // 8. Промокод использован
    if (q.promo) {
      // SQL: счётчик использований промокода (строка заблокирована в validatePromo)
      await client.query('UPDATE promo_codes SET used_count = used_count + 1 WHERE id = $1', [q.promo.id]);
    }

    // 9. Статусы: created, затем confirmed (онлайн-оплата — сразу paid; при получении — pending)
    // SQL: история статусов
    await client.query(`INSERT INTO order_status_history (order_id, status, changed_by, comment) VALUES ($1, 'created', $2, NULL)`, [order.id, user.id]);
    const paid = payment.is_online;
    const confirmComment = paid ? `Оплата: ${payment.name_ru}${input.cardLast4 ? ` •••• ${input.cardLast4}` : ''}` : `Оплата при получении: ${payment.name_ru}`;
    // SQL: подтверждение заказа и статус оплаты
    await client.query(`UPDATE orders SET status = 'confirmed', payment_status = $2 WHERE id = $1`, [order.id, paid ? 'paid' : 'pending']);
    await client.query(`INSERT INTO order_status_history (order_id, status, changed_by, comment) VALUES ($1, 'confirmed', $2, $3)`, [order.id, user.id, confirmComment]);
    await notify(client, user.id, orderStatusNotification('confirmed', order.order_number, order.id));

    // 10. Купленные позиции убираются из корзины
    // SQL: cart_items DELETE
    await client.query('DELETE FROM cart_items WHERE id = ANY($1::int[])', [q.items.map((i) => i.cart_item_id)]);

    return { id: order.id, orderNumber: order.order_number, trackingNumber: order.tracking_number, total: q.total, currency, totalInCurrency };
  });
}

// ---------------------------------------------------------------------------------------------
// Смена статуса заказа с проверкой перехода и движением остатков (одна транзакция).
// actor — пользователь, выполняющий действие (для history.changed_by, audit_log); options.client — внешняя транзакция.
// Таблицы: orders (SELECT FOR UPDATE, UPDATE), delivery_methods, order_items, stock (UPDATE), stock_movements (INSERT),
//          order_status_history (INSERT), notifications (INSERT), audit_log (INSERT — для сотрудников)
// ---------------------------------------------------------------------------------------------
export async function changeStatus(orderId, to, actor, { comment = null, ip = null, client = null } = {}) {
  const work = async (c) => {
    // SQL: заказ блокируется на время смены статуса
    const { rows } = await c.query(
      `SELECT o.*, dm.is_pickup FROM orders o JOIN delivery_methods dm ON dm.id = o.delivery_method_id WHERE o.id = $1 FOR UPDATE OF o`,
      [orderId]
    );
    const order = rows[0];
    if (!order) throw new ApiError(404, 'orders.notFound');
    const from = order.status;
    if (FINAL.includes(from)) throw new ApiError(409, 'orders.finalStatus');

    if (to === 'cancelled') {
      if (!CANCELLABLE.includes(from)) throw new ApiError(409, 'orders.cannotCancel');
    } else if (nextStatus(from, order.is_pickup) !== to) {
      throw new ApiError(409, 'orders.invalidTransition', { params: { from: statusLabel(from, 'ru'), to: statusLabel(to, 'ru') } });
    }
    if (to === 'handed_to_delivery' && !order.courier_id && !order.is_pickup) {
      // Курьерская доставка без назначенного курьера — передавать некому
      const dm = await c.query('SELECT code FROM delivery_methods WHERE id = $1', [order.delivery_method_id]);
      if (dm.rows[0]?.code === 'courier') throw new ApiError(409, 'orders.noCourier');
    }

    // SQL: позиции заказа для движения остатков
    const items = (await c.query('SELECT variant_id, warehouse_id, quantity FROM order_items WHERE order_id = $1 AND variant_id IS NOT NULL', [orderId])).rows;
    if (to === 'cancelled') {
      for (const it of items) {
        // SQL: снятие резерва (reserved −= N)
        await c.query('UPDATE stock SET reserved = GREATEST(reserved - $1, 0) WHERE variant_id = $2 AND warehouse_id = $3', [it.quantity, it.variant_id, it.warehouse_id]);
        await c.query(
          `INSERT INTO stock_movements (variant_id, warehouse_id, type, quantity, order_id, user_id, comment) VALUES ($1, $2, 'unreserve', $3, $4, $5, $6)`,
          [it.variant_id, it.warehouse_id, it.quantity, orderId, actor?.id || null, `Отмена заказа ${order.order_number}`]
        );
      }
    }
    if (to === 'handed_to_delivery') {
      for (const it of items) {
        // SQL: списание со склада (quantity −= N, reserved −= N)
        await c.query(
          'UPDATE stock SET quantity = quantity - $1, reserved = GREATEST(reserved - $1, 0) WHERE variant_id = $2 AND warehouse_id = $3',
          [it.quantity, it.variant_id, it.warehouse_id]
        );
        await c.query(
          `INSERT INTO stock_movements (variant_id, warehouse_id, type, quantity, order_id, user_id, comment) VALUES ($1, $2, 'outcome', $3, $4, $5, $6)`,
          [it.variant_id, it.warehouse_id, it.quantity, orderId, actor?.id || null, `Передан в доставку, заказ ${order.order_number}`]
        );
      }
    }

    // Статус оплаты: отмена оплаченного → refunded; доставка с оплатой при получении → paid
    let paymentStatus = order.payment_status;
    if (to === 'cancelled' && paymentStatus === 'paid') paymentStatus = 'refunded';
    if (to === 'delivered' && paymentStatus === 'pending') paymentStatus = 'paid';
    // SQL: новый статус заказа
    await c.query('UPDATE orders SET status = $2, payment_status = $3 WHERE id = $1', [orderId, to, paymentStatus]);
    // SQL: запись в историю статусов
    await c.query('INSERT INTO order_status_history (order_id, status, changed_by, comment) VALUES ($1, $2, $3, $4)', [orderId, to, actor?.id || null, comment]);
    await notify(c, order.user_id, orderStatusNotification(to, order.order_number, order.id, comment));
    if (actor && actor.role !== 'buyer') {
      await audit(c, { userId: actor.id, action: `order.status.${to}`, entity: 'orders', entityId: orderId, oldData: { status: from, payment_status: order.payment_status }, newData: { status: to, payment_status: paymentStatus, comment }, ip });
    }
    return { id: orderId, from, to, paymentStatus, orderNumber: order.order_number };
  };
  return client ? work(client) : withTransaction(work);
}

// ---------------------------------------------------------------------------------------------
// Автоназначение курьера при передаче в доставку (решение 9 в PROGRESS.md): если владелец не назначил
// курьера, выбирается активный курьер с наименьшим числом заказов в доставке. Вызывается внутри транзакции склада.
// Таблицы: orders (SELECT FOR UPDATE, UPDATE courier_id), users, roles (SELECT), audit_log (INSERT)
// ---------------------------------------------------------------------------------------------
export async function assignCourierIfMissing(client, orderId, actor, ip = null) {
  // SQL: текущий курьер заказа (строка блокируется до конца транзакции)
  const { rows } = await client.query('SELECT courier_id FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
  if (!rows[0]) throw new ApiError(404, 'orders.notFound');
  if (rows[0].courier_id) return rows[0].courier_id;
  // SQL: активный курьер с наименьшей нагрузкой (заказы в статусах доставки)
  const c = await client.query(
    `SELECT u.id
       FROM users u
       JOIN roles r ON r.id = u.role_id AND r.code = 'courier'
      WHERE u.status = 'active'
      ORDER BY (SELECT COUNT(*) FROM orders o WHERE o.courier_id = u.id AND o.status IN ('handed_to_delivery', 'in_transit', 'arrived')), u.id
      LIMIT 1`
  );
  const courierId = c.rows[0]?.id;
  if (!courierId) throw new ApiError(409, 'warehouse.noCourierAvailable');
  // SQL: назначение курьера
  await client.query('UPDATE orders SET courier_id = $2 WHERE id = $1', [orderId, courierId]);
  await audit(client, { userId: actor?.id || null, action: 'order.courier.auto', entity: 'orders', entityId: orderId, oldData: { courier_id: null }, newData: { courier_id: courierId }, ip });
  return courierId;
}

// ---------------------------------------------------------------------------------------------
// Заказ полностью возвращён (все позиции приняты складом по одобренным возвратам): delivered → returned,
// оплата → refunded. Вызывается из маршрута приёмки возврата внутри его транзакции.
// Таблицы: orders (SELECT FOR UPDATE, UPDATE), order_status_history (INSERT), notifications (INSERT), audit_log (INSERT)
// ---------------------------------------------------------------------------------------------
export async function markReturned(client, orderId, actor, { comment = null, ip = null } = {}) {
  // SQL: заказ блокируется на время смены статуса
  const { rows } = await client.query('SELECT id, status, payment_status, user_id, order_number FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
  const order = rows[0];
  if (!order) throw new ApiError(404, 'orders.notFound');
  if (order.status !== 'delivered') return null;
  const paymentStatus = order.payment_status === 'paid' ? 'refunded' : order.payment_status;
  // SQL: статус «возврат оформлен» и возврат денег
  await client.query("UPDATE orders SET status = 'returned', payment_status = $2 WHERE id = $1", [orderId, paymentStatus]);
  // SQL: запись в историю статусов
  await client.query("INSERT INTO order_status_history (order_id, status, changed_by, comment) VALUES ($1, 'returned', $2, $3)", [orderId, actor?.id || null, comment]);
  await notify(client, order.user_id, orderStatusNotification('returned', order.order_number, order.id));
  await audit(client, { userId: actor?.id || null, action: 'order.status.returned', entity: 'orders', entityId: orderId, oldData: { status: order.status, payment_status: order.payment_status }, newData: { status: 'returned', payment_status: paymentStatus }, ip });
  return { id: orderId, orderNumber: order.order_number };
}

export default { createOrder, changeStatus, quote, nextStatus, flowFor, FLOW, FINAL, CANCELLABLE, addressToText, notify, audit, assignCourierIfMissing, markReturned };
