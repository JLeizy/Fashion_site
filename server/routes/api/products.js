// Каталог товаров (разделы 6.6–6.8 и 9 ТЗ): список с фильтрами, фасеты, карточка товара, просмотры.
import express from 'express';
import { body, param, query as q } from 'express-validator';
import { query } from '../../../db/pool.js';
import { validate, msg } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { ApiError } from '../../lib/errors.js';
import { getRates } from '../../services/rates.js';
import { CARD_SELECT, CARD_JOINS, toCard } from '../../services/productCards.js';
import { parseFilters, buildWhere, orderBy, BASE_FROM } from '../../services/catalogQuery.js';

const router = express.Router();
const SORTS = ['popular', 'new', 'price_asc', 'price_desc', 'rating', 'discount', 'name', 'relevance'];

// Фасеты: количество товаров для каждого значения фильтра (каждая группа — без собственного условия)
// Таблицы: products, brands, categories, collections, product_variants, sizes, v_variant_stock (SELECT, GROUP BY)
async function computeFacets(filters, rates, lang) {
  const run = (exclude, select, groupBy = '', extraJoin = '', orderSql = '') => {
    const params = [];
    const { where } = buildWhere(filters, params, rates, exclude);
    const sql = `SELECT ${select} ${BASE_FROM} ${extraJoin} WHERE ${where} ${groupBy ? `GROUP BY ${groupBy}` : ''} ${orderSql}`;
    return query(sql, params).then((r) => r.rows);
  };
  const [brands, categories, seasons, years, collections, sizes, colors, materials, genders, countries, flags, price] = await Promise.all([
    run('brand', 'b.slug, b.name, COUNT(*)::int AS n', 'b.slug, b.name, b.sort_order', '', 'ORDER BY b.sort_order'),
    run('category', 'c.slug, COUNT(*)::int AS n', 'c.slug'),
    run('season', 'col.season AS value, COUNT(*)::int AS n', 'col.season', '', 'ORDER BY col.season'),
    run('year', 'col.year AS value, COUNT(*)::int AS n', 'col.year', '', 'ORDER BY col.year DESC'),
    run('collection', 'col.id, col.name, col.season, col.year, b.name AS brand, COUNT(*)::int AS n', 'col.id, b.name', '', 'ORDER BY col.year DESC, b.name LIMIT 40'),
    run('size', 's.value_int AS value, s.type, MIN(s.sort_order) AS sort, COUNT(DISTINCT p.id)::int AS n', 's.value_int, s.type', 'JOIN product_variants pv ON pv.product_id = p.id JOIN sizes s ON s.id = pv.size_id', 'ORDER BY sort'),
    run('color', 'p.color AS value, COUNT(*)::int AS n', 'p.color', '', 'ORDER BY n DESC'),
    run('material', 'p.material AS value, COUNT(*)::int AS n', 'p.material', '', 'ORDER BY n DESC'),
    run('gender', 'p.gender AS value, COUNT(*)::int AS n', 'p.gender'),
    run('country', 'p.country_of_origin AS value, COUNT(*)::int AS n', 'p.country_of_origin', '', 'ORDER BY n DESC'),
    run(
      'flags',
      `COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM v_variant_stock vs WHERE vs.product_id = p.id AND vs.available > 0))::int AS in_stock,
       COUNT(*) FILTER (WHERE p.is_new)::int AS new, COUNT(*) FILTER (WHERE p.old_price_byn IS NOT NULL)::int AS sale,
       COUNT(*) FILTER (WHERE p.is_limited)::int AS limited, COUNT(*) FILTER (WHERE p.is_iconic)::int AS iconic,
       COUNT(*) FILTER (WHERE p.rating_avg >= 4)::int AS r4, COUNT(*) FILTER (WHERE p.rating_avg >= 3)::int AS r3,
       COUNT(*) FILTER (WHERE p.rating_avg >= 2)::int AS r2`
    ),
    run('price', 'MIN(p.price_byn) AS min, MAX(p.price_byn) AS max'),
  ]);
  const f = flags[0] || {};
  return {
    brands: brands.map((r) => ({ value: r.slug, label: r.name, n: r.n })),
    categories: Object.fromEntries(categories.map((r) => [r.slug, r.n])),
    seasons: seasons.filter((r) => r.value).map((r) => ({ value: r.value, n: r.n })),
    years: years.filter((r) => r.value).map((r) => ({ value: r.value, n: r.n })),
    collections: collections.map((r) => ({ value: r.id, label: `${r.brand} — ${r.name}`, season: r.season, year: r.year, n: r.n })),
    sizes: sizes.map((r) => ({ value: r.value, type: r.type, n: r.n })),
    colors: colors.map((r) => ({ value: r.value, n: r.n })),
    materials: materials.map((r) => ({ value: r.value, n: r.n })),
    genders: genders.map((r) => ({ value: r.value, n: r.n })),
    countries: countries.map((r) => ({ value: r.value, n: r.n })),
    flags: { in_stock: f.in_stock || 0, new: f.new || 0, sale: f.sale || 0, limited: f.limited || 0, iconic: f.iconic || 0 },
    ratings: { 4: f.r4 || 0, 3: f.r3 || 0, 2: f.r2 || 0 },
    price: { min: Number(price[0]?.min) || 0, max: Number(price[0]?.max) || 0 },
    lang,
  };
}

const listValidators = [
  q('page').optional().isInt({ min: 1, max: 1000 }),
  q('limit').optional().isInt({ min: 1, max: 60 }),
  q('sort').optional().isIn(SORTS),
  q('price_min').optional().isFloat({ min: 0 }),
  q('price_max').optional().isFloat({ min: 0 }),
  q('rating').optional().isFloat({ min: 0, max: 5 }),
];

// GET /api/products — каталог: фильтры, сортировка, пагинация на сервере (LIMIT / OFFSET) (роль: любая)
// ОДИН параметризованный SQL-запрос: products JOIN brands, categories, collections + LATERAL фото и размеры.
// Параметр facets=1 добавляет количество товаров возле каждого значения фильтра.
router.get('/', validate(listValidators), async (req, res) => {
  const filters = parseFilters(req.query);
  const rates = await getRates();
  const limit = Number(req.query.limit) || 24;
  const page = Number(req.query.page) || 1;
  const sort = SORTS.includes(req.query.sort) ? req.query.sort : filters.q ? 'relevance' : 'popular';
  const params = [];
  const { where, rank } = buildWhere(filters, params, rates);
  params.push(limit, (page - 1) * limit);
  const sql = `
    SELECT ${CARD_SELECT}, COUNT(*) OVER () AS total
      FROM products p
      ${CARD_JOINS}
      LEFT JOIN collections col ON col.id = p.collection_id
     WHERE ${where}
     ORDER BY ${orderBy(sort, req.lang, rank)}
     LIMIT $${params.length - 1} OFFSET $${params.length}`;
  const [{ rows }, facets] = await Promise.all([query(sql, params), req.query.facets === '1' ? computeFacets(filters, rates, req.lang) : null]);
  const total = rows[0]?.total || 0;
  res.json({ items: rows.map(toCard), total, page, limit, pages: Math.max(1, Math.ceil(total / limit)), sort, facets });
});

// GET /api/products/facets — только фасеты для текущих фильтров (роль: любая)
router.get('/facets', validate(listValidators), async (req, res) => {
  res.json(await computeFacets(parseFilters(req.query), await getRates(), req.lang));
});

// GET /api/products/by-ids?ids=1,2,3 — карточки по списку id в заданном порядке
// (недавно просмотренные у гостя, подборки) (роль: любая). Таблицы: products + каталог (SELECT)
router.get('/by-ids', validate([q('ids').isString()]), async (req, res) => {
  const ids = String(req.query.ids)
    .split(',')
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 40);
  if (!ids.length) return res.json({ items: [] });
  const { rows } = await query(
    `SELECT ${CARD_SELECT} FROM products p ${CARD_JOINS}
      WHERE p.id = ANY($1::int[]) AND p.moderation_status = 'approved'`,
    [ids]
  );
  const byId = new Map(rows.map((r) => [r.id, toCard(r)]));
  res.json({ items: ids.filter((id) => byId.has(id)).map((id) => byId.get(id)) });
});

// Полная информация о товаре (используется страницей товара и быстрым просмотром)
// Таблицы: products, brands, categories (+ родительская), collections, users, seller_applications,
// product_images, product_variants, sizes, v_variant_stock, reviews (SELECT)
export async function loadProduct(id, viewer) {
  const { rows } = await query(
    `SELECT p.*, b.name AS brand_name, b.slug AS brand_slug, b.accent_color, b.founded_year,
            c.slug AS category_slug, c.name_ru AS category_ru, c.name_en AS category_en, c.size_type,
            parent.slug AS parent_slug, parent.name_ru AS parent_ru, parent.name_en AS parent_en,
            col.id AS col_id, col.name AS col_name, col.season AS col_season, col.year AS col_year,
            u.id AS seller_user_id, u.created_at AS seller_since,
            COALESCE(sa.shop_name, u.first_name || ' ' || u.last_name) AS seller_name
       FROM products p
       JOIN brands b      ON b.id = p.brand_id
       JOIN categories c  ON c.id = p.category_id
       LEFT JOIN categories parent ON parent.id = c.parent_id
       LEFT JOIN collections col   ON col.id = p.collection_id
       JOIN users u       ON u.id = p.seller_id
       LEFT JOIN seller_applications sa ON sa.user_id = u.id AND sa.status = 'approved'
      WHERE p.id = $1`,
    [id]
  );
  const p = rows[0];
  if (!p) return null;
  // Неопубликованный товар видят только его продавец и сотрудники модерации
  const staff = viewer && ['owner', 'moderator'].includes(viewer.role);
  if (p.moderation_status !== 'approved' && !(staff || viewer?.id === p.seller_id)) return null;

  const [images, variants, siblings, ratings, sellerStats] = await Promise.all([
    query('SELECT url, is_main FROM product_images WHERE product_id = $1 ORDER BY is_main DESC, sort_order, id', [id]),
    query(
      `SELECT pv.id, pv.sku_variant, s.type, s.value_int, s.value_eu, s.value_it, s.value_us, COALESCE(vs.available, 0) AS available
         FROM product_variants pv JOIN sizes s ON s.id = pv.size_id LEFT JOIN v_variant_stock vs ON vs.variant_id = pv.id
        WHERE pv.product_id = $1 ORDER BY s.sort_order`,
      [id]
    ),
    p.model_code
      ? query(
          `SELECT p2.id, p2.color, (SELECT url FROM product_images WHERE product_id = p2.id ORDER BY is_main DESC, sort_order LIMIT 1) AS image
             FROM products p2 WHERE p2.model_code = $1 AND p2.moderation_status = 'approved' ORDER BY p2.id`,
          [p.model_code]
        )
      : { rows: [] },
    query("SELECT rating, COUNT(*)::int AS n FROM reviews WHERE product_id = $1 AND status = 'approved' GROUP BY rating", [id]),
    query(
      `SELECT COUNT(*)::int AS products, COALESCE(ROUND(AVG(NULLIF(rating_avg, 0)), 2), 0) AS rating
         FROM products WHERE seller_id = $1 AND moderation_status = 'approved'`,
      [p.seller_id]
    ),
  ]);
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  ratings.rows.forEach((r) => {
    distribution[r.rating] = r.n;
  });
  const price = Number(p.price_byn);
  const oldPrice = p.old_price_byn ? Number(p.old_price_byn) : null;
  const totalAvailable = variants.rows.reduce((sum, v) => sum + v.available, 0);
  return {
    id: p.id,
    sku: p.sku,
    modelCode: p.model_code,
    name: { ru: p.name_ru, en: p.name_en },
    description: { ru: p.description_ru, en: p.description_en },
    composition: { ru: p.composition_ru, en: p.composition_en },
    care: { ru: p.care_ru, en: p.care_en },
    brand: { id: p.brand_id, name: p.brand_name, slug: p.brand_slug, accentColor: p.accent_color, foundedYear: p.founded_year },
    category: { id: p.category_id, slug: p.category_slug, name: { ru: p.category_ru, en: p.category_en }, sizeType: p.size_type },
    parentCategory: p.parent_slug ? { slug: p.parent_slug, name: { ru: p.parent_ru, en: p.parent_en } } : null,
    collection: p.col_id ? { id: p.col_id, name: p.col_name, season: p.col_season, year: p.col_year } : null,
    seller: { id: p.seller_user_id, name: p.seller_name, since: p.seller_since, products: sellerStats.rows[0].products, rating: Number(sellerStats.rows[0].rating) },
    price,
    oldPrice,
    discount: oldPrice ? Math.round((1 - price / oldPrice) * 100) : 0,
    gender: p.gender,
    color: p.color,
    material: p.material,
    country: p.country_of_origin,
    isNew: p.is_new,
    isLimited: p.is_limited,
    isIconic: p.is_iconic,
    isAuthenticated: p.is_authenticated,
    moderationStatus: p.moderation_status,
    rejectionReason: p.rejection_reason,
    rating: Number(p.rating_avg) || 0,
    reviewsCount: p.reviews_count,
    ratingDistribution: distribution,
    views: p.views_count,
    images: images.rows.map((i) => i.url),
    variants: variants.rows.map((v) => ({ variantId: v.id, sku: v.sku_variant, type: v.type, label: v.value_int, eu: v.value_eu, it: v.value_it, us: v.value_us, available: v.available })),
    inStock: totalAvailable > 0,
    lastSize: variants.rows.length > 1 ? variants.rows.filter((v) => v.available > 0).length === 1 : totalAvailable === 1,
    colors: siblings.rows.map((s) => ({ id: s.id, color: s.color, image: s.image, current: s.id === p.id })),
    createdAt: p.created_at,
  };
}

// GET /api/products/:id — карточка товара (роль: любая; неопубликованный — только продавец и модерация)
router.get('/:id', validate([param('id').isInt({ min: 1 })]), async (req, res) => {
  const product = await loadProduct(Number(req.params.id), req.user);
  if (!product) throw new ApiError(404, 'catalog.productNotFound');
  res.json({ product });
});

// POST /api/products/:id/view — учёт просмотра (роль: любая)
// Таблицы: products (UPDATE views_count), viewed_products (INSERT … ON CONFLICT DO UPDATE viewed_at — только для авторизованных)
router.post('/:id/view', validate([param('id').isInt({ min: 1 })]), async (req, res) => {
  const id = Number(req.params.id);
  // Один просмотр на сессию — чтобы обновление страницы не накручивало счётчик
  req.session.viewed ||= [];
  if (!req.session.viewed.includes(id)) {
    req.session.viewed = [...req.session.viewed.slice(-200), id];
    await query("UPDATE products SET views_count = views_count + 1 WHERE id = $1 AND moderation_status = 'approved'", [id]);
  }
  if (req.user) {
    await query(
      `INSERT INTO viewed_products (user_id, product_id) VALUES ($1, $2)
       ON CONFLICT (user_id, product_id) DO UPDATE SET viewed_at = NOW()`,
      [req.user.id, id]
    );
  }
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------------------------
// Отзывы (раздел 6.8 ТЗ): на сайте видны только одобренные; оставить отзыв может только
// покупатель, который купил и получил товар (заказ в статусе delivered). Новый отзыв — pending.
// ---------------------------------------------------------------------------------------------

// Может ли пользователь оставить отзыв на товар.
// Таблицы: reviews (SELECT — уже оставлял?), order_items JOIN orders (SELECT — купил и получил?)
async function reviewEligibility(userId, productId) {
  if (!userId) return { allowed: false, reason: 'auth', orderItemId: null };
  // SQL: отзыв этого пользователя на этот товар (UNIQUE(product_id, user_id) — второй оставить нельзя)
  const existing = await query('SELECT id, status FROM reviews WHERE product_id = $1 AND user_id = $2', [productId, userId]);
  if (existing.rowCount) return { allowed: false, reason: 'exists', status: existing.rows[0].status, orderItemId: null };
  // SQL: последняя позиция доставленного заказа пользователя с этим товаром
  const bought = await query(
    `SELECT oi.id
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
      WHERE o.user_id = $1 AND oi.product_id = $2 AND o.status = 'delivered'
      ORDER BY o.created_at DESC
      LIMIT 1`,
    [userId, productId]
  );
  if (!bought.rowCount) return { allowed: false, reason: 'notBought', orderItemId: null };
  return { allowed: true, reason: null, orderItemId: bought.rows[0].id };
}

const REVIEW_SORTS = {
  new: 'r.created_at DESC',
  best: 'r.rating DESC, r.created_at DESC',
  worst: 'r.rating ASC, r.created_at DESC',
};

// GET /api/products/:id/reviews?page=1&limit=5&sort=new — одобренные отзывы с пагинацией (роль: любая)
// Таблицы: reviews (SELECT approved), users (имя автора), order_items (купленный размер) — SELECT.
// Дополнительно: canReview — может ли текущий пользователь оставить отзыв (reviews, order_items, orders).
router.get(
  '/:id/reviews',
  validate([
    param('id').isInt({ min: 1 }),
    q('page').optional().isInt({ min: 1, max: 500 }),
    q('limit').optional().isInt({ min: 1, max: 20 }),
    q('sort').optional().isIn(Object.keys(REVIEW_SORTS)),
  ]),
  async (req, res) => {
    const productId = Number(req.params.id);
    const limit = Number(req.query.limit) || 5;
    const page = Number(req.query.page) || 1;
    const sort = REVIEW_SORTS[req.query.sort] ? req.query.sort : 'new';
    const [list, eligibility] = await Promise.all([
      // SQL: страница одобренных отзывов + общее количество (оконная функция COUNT(*) OVER ())
      query(
        `SELECT r.id, r.rating, r.text, r.created_at,
                u.first_name, LEFT(u.last_name, 1) AS last_initial, u.avatar,
                oi.size_label,
                COUNT(*) OVER () AS total
           FROM reviews r
           JOIN users u ON u.id = r.user_id
           LEFT JOIN order_items oi ON oi.id = r.order_item_id
          WHERE r.product_id = $1 AND r.status = 'approved'
          ORDER BY ${REVIEW_SORTS[sort]}
          LIMIT $2 OFFSET $3`,
        [productId, limit, (page - 1) * limit]
      ),
      reviewEligibility(req.user?.id, productId),
    ]);
    const total = list.rows[0]?.total || 0;
    res.json({
      items: list.rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        text: r.text,
        createdAt: r.created_at,
        author: `${r.first_name} ${r.last_initial ? `${r.last_initial}.` : ''}`.trim(),
        avatar: r.avatar,
        size: r.size_label,
        verifiedPurchase: Boolean(r.size_label),
      })),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      sort,
      canReview: { allowed: eligibility.allowed, reason: eligibility.reason, status: eligibility.status || null },
    });
  }
);

// POST /api/products/:id/reviews — новый отзыв (роль: любой вошедший, фактически — покупатель с доставленным заказом)
// Таблицы: reviews (INSERT, status = 'pending' — появится на сайте после модерации),
//          order_items + orders (SELECT — проверка покупки), products (SELECT — товар опубликован)
router.post(
  '/:id/reviews',
  requireAuth,
  validate([
    param('id').isInt({ min: 1 }),
    body('rating').isInt({ min: 1, max: 5 }).withMessage(msg('validation.rating')).toInt(),
    body('text').isString().trim().isLength({ min: 10, max: 2000 }).withMessage(msg('validation.length', { min: 10, max: 2000 })),
  ]),
  async (req, res) => {
    const productId = Number(req.params.id);
    // SQL: товар существует и опубликован
    const product = await query("SELECT id FROM products WHERE id = $1 AND moderation_status = 'approved'", [productId]);
    if (!product.rowCount) throw new ApiError(404, 'catalog.productNotFound');
    const eligibility = await reviewEligibility(req.user.id, productId);
    if (!eligibility.allowed) throw new ApiError(eligibility.reason === 'exists' ? 409 : 403, eligibility.reason === 'exists' ? 'reviews.exists' : 'reviews.notAllowed');
    // SQL: отзыв уходит на модерацию; текст хранится как есть и экранируется при выводе (защита от XSS)
    const { rows } = await query(
      `INSERT INTO reviews (product_id, user_id, order_item_id, rating, text, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING id, status, created_at`,
      [productId, req.user.id, eligibility.orderItemId, req.valid.rating, req.valid.text]
    );
    res.status(201).json({ review: rows[0], message: req.t('reviews.sent') });
  }
);

// ---------------------------------------------------------------------------------------------
// Рекомендации на странице товара: «Похожие товары», «С этим покупают», «Вы смотрели»
// ---------------------------------------------------------------------------------------------

// GET /api/products/:id/related?viewed=1,2,3 — три подборки карточек (роль: любая)
//   similar  — та же подкатегория (сначала тот же бренд и близкая цена), без других цветов этой же модели;
//   together — товары, которые встречаются в одних заказах с этим (order_items × order_items),
//              дополняются вещами того же бренда из других корневых категорий;
//   viewed   — у вошедшего из viewed_products, у гостя — id из параметра viewed (localStorage).
// Таблицы: products, brands, categories, product_images, product_variants, sizes, v_variant_stock,
//          order_items, viewed_products (SELECT)
router.get(
  '/:id/related',
  validate([param('id').isInt({ min: 1 }), q('viewed').optional().isString()]),
  async (req, res) => {
    const id = Number(req.params.id);
    // SQL: базовые поля текущего товара (подкатегория, родительская категория, бренд, цена, модель)
    const base = await query(
      `SELECT p.id, p.brand_id, p.category_id, p.price_byn, p.model_code, c.parent_id
         FROM products p JOIN categories c ON c.id = p.category_id
        WHERE p.id = $1 AND p.moderation_status = 'approved'`,
      [id]
    );
    const cur = base.rows[0];
    if (!cur) throw new ApiError(404, 'catalog.productNotFound');

    // SQL: похожие — та же подкатегория; сортировка: тот же бренд, затем близость цены
    const similarSql = query(
      `SELECT ${CARD_SELECT}
         FROM products p ${CARD_JOINS}
        WHERE p.category_id = $1 AND p.id <> $2 AND p.moderation_status = 'approved'
          AND ($3::varchar IS NULL OR p.model_code IS DISTINCT FROM $3)
        ORDER BY (p.brand_id = $4) DESC, ABS(p.price_byn - $5) ASC, p.id
        LIMIT 12`,
      [cur.category_id, id, cur.model_code, cur.brand_id, cur.price_byn]
    );

    // SQL: «с этим покупают» — частота совместных покупок в одном заказе
    const togetherSql = query(
      `WITH pairs AS (
         SELECT oi2.product_id, COUNT(*) AS n
           FROM order_items oi1
           JOIN order_items oi2 ON oi2.order_id = oi1.order_id AND oi2.product_id <> oi1.product_id
          WHERE oi1.product_id = $1 AND oi2.product_id IS NOT NULL
          GROUP BY oi2.product_id
       )
       SELECT ${CARD_SELECT}, pairs.n AS pair_n
         FROM pairs
         JOIN products p ON p.id = pairs.product_id ${CARD_JOINS}
        WHERE p.moderation_status = 'approved'
        ORDER BY pairs.n DESC, p.rating_avg DESC
        LIMIT 12`,
      [id]
    );

    // SQL: дополнение «с этим покупают» — тот же бренд, другая корневая категория (образ целиком)
    const complementSql = query(
      `SELECT ${CARD_SELECT}
         FROM products p ${CARD_JOINS}
        WHERE p.brand_id = $1 AND p.id <> $2 AND p.moderation_status = 'approved'
          AND c.parent_id IS DISTINCT FROM $3
        ORDER BY p.is_iconic DESC, p.rating_avg DESC, p.views_count DESC
        LIMIT 12`,
      [cur.brand_id, id, cur.parent_id]
    );

    // «Вы смотрели»: вошедший — из БД, гость — список id из localStorage
    let viewedSql;
    if (req.user) {
      // SQL: последние просмотренные пользователем товары (viewed_products), кроме текущего
      viewedSql = query(
        `SELECT ${CARD_SELECT}
           FROM viewed_products vp
           JOIN products p ON p.id = vp.product_id ${CARD_JOINS}
          WHERE vp.user_id = $1 AND p.id <> $2 AND p.moderation_status = 'approved'
          ORDER BY vp.viewed_at DESC
          LIMIT 12`,
        [req.user.id, id]
      );
    } else {
      const ids = String(req.query.viewed || '')
        .split(',')
        .map(Number)
        .filter((n) => Number.isInteger(n) && n > 0 && n !== id)
        .slice(0, 12);
      // SQL: карточки по списку id; порядок восстанавливается через array_position
      viewedSql = ids.length
        ? query(
            `SELECT ${CARD_SELECT} FROM products p ${CARD_JOINS}
              WHERE p.id = ANY($1::int[]) AND p.moderation_status = 'approved'
              ORDER BY array_position($1::int[], p.id)`,
            [ids]
          )
        : Promise.resolve({ rows: [] });
    }

    const [similar, together, complement, viewed] = await Promise.all([similarSql, togetherSql, complementSql, viewedSql]);
    const seen = new Set(together.rows.map((r) => r.id));
    const togetherRows = [...together.rows, ...complement.rows.filter((r) => !seen.has(r.id))].slice(0, 12);
    res.json({
      similar: similar.rows.map(toCard),
      together: togetherRows.map(toCard),
      viewed: viewed.rows.map(toCard),
    });
  }
);

export default router;
