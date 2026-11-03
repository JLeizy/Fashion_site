// Корзина: чтение позиций с данными товара и доступным остатком, добавление с проверкой остатка,
// объединение гостевой корзины (localStorage) с корзиной в БД после входа.
import { query } from '../../db/pool.js';
import { ApiError } from '../lib/errors.js';

export const MAX_QTY = 20;

// SQL: позиции корзины с товаром, размером, фото и доступным остатком.
// Таблицы: carts, cart_items, product_variants, products, brands, sizes, product_images, v_variant_stock (только чтение)
const ITEM_SELECT = `
  pv.id AS variant_id, pv.sku_variant, sz.value_int AS size_label, sz.type AS size_type,
  p.id AS product_id, p.sku, p.name_ru, p.name_en, p.price_byn, p.old_price_byn, p.moderation_status, p.color,
  b.name AS brand_name, b.slug AS brand_slug,
  (SELECT pi.url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_main DESC, pi.sort_order LIMIT 1) AS image,
  COALESCE(vs.available, 0) AS available,
  (SELECT json_agg(json_build_object('variantId', v2.id, 'label', s2.value_int, 'available', COALESCE(vs2.available, 0)) ORDER BY s2.sort_order)
     FROM product_variants v2 JOIN sizes s2 ON s2.id = v2.size_id LEFT JOIN v_variant_stock vs2 ON vs2.variant_id = v2.id
    WHERE v2.product_id = p.id) AS sizes`;

const ITEM_JOINS = `
  JOIN products p ON p.id = pv.product_id
  JOIN brands b   ON b.id = p.brand_id
  JOIN sizes sz   ON sz.id = pv.size_id
  LEFT JOIN v_variant_stock vs ON vs.variant_id = pv.id`;

function toItem(row) {
  return {
    id: row.id ?? null,
    variantId: row.variant_id,
    productId: row.product_id,
    sku: row.sku,
    skuVariant: row.sku_variant,
    name: { ru: row.name_ru, en: row.name_en },
    brand: { name: row.brand_name, slug: row.brand_slug },
    image: row.image,
    color: row.color,
    size: row.size_label,
    sizeType: row.size_type,
    sizes: row.sizes || [],
    price: Number(row.price_byn),
    oldPrice: row.old_price_byn ? Number(row.old_price_byn) : null,
    quantity: row.quantity,
    available: row.available,
    isAvailable: row.moderation_status === 'approved' && row.available > 0,
  };
}

export function summarize(items) {
  const valid = items.filter((i) => i.isAvailable);
  const subtotal = Math.round(valid.reduce((sum, i) => sum + i.price * Math.min(i.quantity, i.available), 0) * 100) / 100;
  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  return { items, count, subtotal };
}

// Корзина пользователя (создаётся при первом обращении)
// SQL: INSERT … ON CONFLICT — таблица carts (INSERT / UPDATE updated_at)
export async function ensureCart(userId, client = null) {
  const run = client ? client.query.bind(client) : query;
  const { rows } = await run(
    `INSERT INTO carts (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
     RETURNING id`,
    [userId]
  );
  return rows[0].id;
}

// Позиции корзины пользователя. Таблицы: carts, cart_items + каталог (только чтение)
export async function getCart(userId) {
  const { rows } = await query(
    `SELECT ci.id, ci.quantity, ci.added_at, ${ITEM_SELECT}
       FROM carts c
       JOIN cart_items ci       ON ci.cart_id = c.id
       JOIN product_variants pv ON pv.id = ci.variant_id
       ${ITEM_JOINS}
      WHERE c.user_id = $1
      ORDER BY ci.added_at DESC, ci.id DESC`,
    [userId]
  );
  return summarize(rows.map(toItem));
}

// Гостевая корзина: клиент присылает [{ variantId, quantity }], сервер возвращает данные товаров.
// Таблицы: product_variants + каталог (только чтение)
export async function previewItems(items) {
  const clean = (Array.isArray(items) ? items : [])
    .map((i) => ({ variantId: Number(i.variantId), quantity: Math.max(1, Math.min(MAX_QTY, Number(i.quantity) || 1)) }))
    .filter((i) => Number.isInteger(i.variantId) && i.variantId > 0)
    .slice(0, 50);
  if (!clean.length) return summarize([]);
  const { rows } = await query(
    `SELECT ${ITEM_SELECT}
       FROM product_variants pv
       ${ITEM_JOINS}
      WHERE pv.id = ANY($1::int[])`,
    [clean.map((i) => i.variantId)]
  );
  const byId = new Map(rows.map((r) => [r.variant_id, r]));
  const result = clean.filter((i) => byId.has(i.variantId)).map((i) => toItem({ ...byId.get(i.variantId), quantity: i.quantity }));
  return summarize(result);
}

// Данные варианта для проверки перед добавлением. Таблицы: product_variants, products, v_variant_stock
export async function getVariant(variantId) {
  const { rows } = await query(
    `SELECT pv.id, pv.product_id, p.moderation_status, COALESCE(vs.available, 0) AS available
       FROM product_variants pv
       JOIN products p ON p.id = pv.product_id
       LEFT JOIN v_variant_stock vs ON vs.variant_id = pv.id
      WHERE pv.id = $1`,
    [variantId]
  );
  const variant = rows[0];
  if (!variant || variant.moderation_status !== 'approved') throw new ApiError(404, 'cart.variantNotFound');
  return variant;
}

// Добавление в корзину с проверкой остатка (quantity − reserved по всем складам)
// SQL: cart_items (INSERT … ON CONFLICT DO UPDATE quantity)
export async function addItem(userId, variantId, quantity) {
  const variant = await getVariant(variantId);
  if (variant.available <= 0) throw new ApiError(409, 'cart.outOfStock');
  const cartId = await ensureCart(userId);
  const { rows: existing } = await query('SELECT quantity FROM cart_items WHERE cart_id = $1 AND variant_id = $2', [cartId, variantId]);
  const nextQty = (existing[0]?.quantity || 0) + quantity;
  if (nextQty > variant.available) throw new ApiError(409, 'cart.notEnoughStock', { params: { available: variant.available } });
  await query(
    `INSERT INTO cart_items (cart_id, variant_id, quantity) VALUES ($1, $2, $3)
     ON CONFLICT (cart_id, variant_id) DO UPDATE SET quantity = LEAST(cart_items.quantity + EXCLUDED.quantity, ${MAX_QTY}), added_at = NOW()`,
    [cartId, variantId, quantity]
  );
}

// Объединение гостевой корзины с корзиной в БД (после входа): количество ограничивается остатком
// SQL: cart_items (INSERT … ON CONFLICT DO UPDATE)
export async function mergeItems(userId, items) {
  const preview = await previewItems(items);
  const cartId = await ensureCart(userId);
  for (const item of preview.items) {
    if (!item.isAvailable) continue;
    await query(
      `INSERT INTO cart_items (cart_id, variant_id, quantity) VALUES ($1, $2, LEAST($3::int, $4::int))
       ON CONFLICT (cart_id, variant_id) DO UPDATE SET quantity = LEAST(GREATEST(cart_items.quantity, EXCLUDED.quantity), $4::int)`,
      [cartId, item.variantId, item.quantity, Math.min(item.available, MAX_QTY)]
    );
  }
}

export async function cartCount(userId) {
  // SQL: сумма количеств в корзине (carts JOIN cart_items)
  const { rows } = await query(
    'SELECT COALESCE(SUM(ci.quantity), 0)::int AS n FROM carts c JOIN cart_items ci ON ci.cart_id = c.id WHERE c.user_id = $1',
    [userId]
  );
  return rows[0].n;
}

export default { getCart, previewItems, addItem, mergeItems, ensureCart, getVariant, cartCount, summarize, MAX_QTY };
