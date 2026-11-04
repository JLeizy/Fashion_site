// Кабинет продавца (раздел 4 ТЗ, роль seller; owner проходит всегда): свои товары (CRUD, фото, варианты-размеры,
// цена и скидка), статусы модерации и причины отклонения, заказы со своими позициями (только просмотр),
// статистика (выручка, продажи по дням, топ товаров, просмотры), отзывы на свои товары.
// Продавец видит и меняет ТОЛЬКО свои товары: во всех запросах условие products.seller_id = req.user.id
// (owner работает с товарами официального магазина и любыми товарами по ?seller=… не нужен — для owner есть админка).
// Новый или изменённый товар уходит на модерацию: moderation_status = 'pending' (или 'draft' — черновик).
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { body, param, query as q } from 'express-validator';
import { query, withTransaction } from '../../../db/pool.js';
import { checkRole } from '../../middleware/auth.js';
import { validate, msg } from '../../middleware/validate.js';
import { ApiError } from '../../lib/errors.js';
import { listValidators, listParams, pageResult, likePattern } from '../../lib/listing.js';
import { uploadProductImages, removeUploadedFile } from '../../middleware/upload.js';
import { audit } from '../../services/orderService.js';
import { config } from '../../../config/index.js';
import { writeProductPlaceholders } from '../../../scripts/generate-placeholders.js';

const router = express.Router();
router.use(checkRole('seller'));

const GENDERS = ['men', 'women', 'unisex'];
const MAX_IMAGES = 8;
const COUNTRIES = ['IT', 'FR', 'ES', 'PT', 'US', 'JP', 'GB', 'DE', 'CH', 'RO', 'TR', 'CN', 'GE', 'BY'];

// Заглушка или загруженное фото: заглушки лежат в /images/brands/<бренд>/products/
const isPlaceholder = (url) => typeof url === 'string' && url.startsWith('/images/brands/');

// Удаление SVG-заглушки удалённого товара (только файлы внутри public/images/brands)
function removePlaceholderFile(url) {
  if (!isPlaceholder(url) || !url.endsWith('.svg')) return;
  const base = path.join(config.root, 'public', 'images', 'brands');
  const file = path.join(config.root, 'public', url);
  if (file.startsWith(base)) fs.rm(file, { force: true }, () => {});
}

// ---------------------------------------------------------------------------------------------
// GET /api/seller/refs — справочники для редактора товара (роль: seller)
// Таблицы: brands, categories, collections, sizes, products (SELECT DISTINCT цветов, материалов, стран)
// ---------------------------------------------------------------------------------------------
router.get('/refs', async (req, res) => {
  const [brands, categories, collections, sizes, distinct] = await Promise.all([
    // SQL: бренды
    query('SELECT id, name, slug, accent_color FROM brands ORDER BY sort_order, name'),
    // SQL: листовые категории (подкатегории) с размерной сеткой — своя или родительская
    query(
      `SELECT c.id, c.slug, c.name_ru, c.name_en, p.name_ru AS parent_ru, p.name_en AS parent_en,
              COALESCE(c.size_type, p.size_type, 'one_size') AS size_type
         FROM categories c LEFT JOIN categories p ON p.id = c.parent_id
        WHERE NOT EXISTS (SELECT 1 FROM categories ch WHERE ch.parent_id = c.id)
        ORDER BY p.sort_order NULLS FIRST, c.sort_order, c.id`
    ),
    // SQL: коллекции всех брендов (на клиенте фильтруются по выбранному бренду)
    query('SELECT id, brand_id, name, season, year FROM collections ORDER BY year DESC, id DESC'),
    // SQL: размерная сетка
    query('SELECT id, type, value_int, value_eu, value_it, value_us FROM sizes ORDER BY type, sort_order, id'),
    // SQL: используемые в каталоге цвета, материалы и страны производства
    query(
      `SELECT ARRAY(SELECT DISTINCT color FROM products ORDER BY 1) AS colors,
              ARRAY(SELECT DISTINCT material FROM products ORDER BY 1) AS materials,
              ARRAY(SELECT DISTINCT country_of_origin FROM products ORDER BY 1) AS countries`
    ),
  ]);
  const d = distinct.rows[0];
  res.json({
    brands: brands.rows.map((b) => ({ id: b.id, name: b.name, slug: b.slug, accent: b.accent_color })),
    categories: categories.rows.map((c) => ({ id: c.id, slug: c.slug, name: { ru: c.name_ru, en: c.name_en }, parent: { ru: c.parent_ru, en: c.parent_en }, sizeType: c.size_type })),
    collections: collections.rows.map((c) => ({ id: c.id, brandId: c.brand_id, name: c.name, season: c.season, year: c.year })),
    sizes: sizes.rows.map((s) => ({ id: s.id, type: s.type, label: s.value_int, eu: s.value_eu, it: s.value_it, us: s.value_us })),
    colors: d.colors,
    materials: d.materials,
    countries: [...new Set([...d.countries, ...COUNTRIES])].sort(),
    genders: GENDERS,
  });
});

// ---------------------------------------------------------------------------------------------
// GET /api/seller/summary — счётчики для шапки кабинета (роль: seller)
// Таблицы: products (SELECT COUNT по статусам модерации), order_items, orders (SELECT SUM)
// ---------------------------------------------------------------------------------------------
router.get('/summary', async (req, res) => {
  // SQL: товары по статусам модерации и выручка продавца за 30 дней
  const { rows } = await query(
    `SELECT COUNT(*) FILTER (WHERE moderation_status = 'approved')::int AS approved,
            COUNT(*) FILTER (WHERE moderation_status = 'pending')::int  AS pending,
            COUNT(*) FILTER (WHERE moderation_status = 'rejected')::int AS rejected,
            COUNT(*) FILTER (WHERE moderation_status = 'draft')::int    AS draft,
            COUNT(*)::int AS total,
            (SELECT COALESCE(SUM(oi.price_byn * oi.quantity), 0)
               FROM order_items oi JOIN orders o ON o.id = oi.order_id
              WHERE oi.seller_id = $1 AND o.status NOT IN ('cancelled', 'returned') AND o.created_at > NOW() - INTERVAL '30 days') AS revenue30
       FROM products WHERE seller_id = $1`,
    [req.user.id]
  );
  const r = rows[0];
  res.json({ counts: { approved: r.approved, pending: r.pending, rejected: r.rejected, draft: r.draft, total: r.total }, revenue30: Number(r.revenue30) });
});

// ---------------------------------------------------------------------------------------------
// GET /api/seller/products?status=&q=&brand=&page=&sort=&dir= — свои товары (роль: seller)
// Таблицы: products, brands, categories, product_images, v_variant_stock, order_items (SELECT)
// ---------------------------------------------------------------------------------------------
const PRODUCT_SORT = { created: 'p.created_at', name: 'p.name_ru', price: 'p.price_byn', status: 'p.moderation_status', views: 'p.views_count', stock: 'stock_available', sold: 'units_sold', rating: 'p.rating_avg', sku: 'p.sku' };
router.get(
  '/products',
  validate([...listValidators, q('status').optional().isIn(['all', 'draft', 'pending', 'approved', 'rejected']), q('brand').optional().isInt({ min: 1 }).toInt()]),
  async (req, res) => {
    const lp = listParams(req, PRODUCT_SORT, 'created');
    const params = [req.user.id];
    const where = ['p.seller_id = $1'];
    if (req.valid.status && req.valid.status !== 'all') {
      params.push(req.valid.status);
      where.push(`p.moderation_status = $${params.length}`);
    }
    if (req.valid.brand) {
      params.push(req.valid.brand);
      where.push(`p.brand_id = $${params.length}`);
    }
    if (lp.search) {
      params.push(likePattern(lp.search));
      where.push(`(p.name_ru ILIKE $${params.length} OR p.name_en ILIKE $${params.length} OR p.sku ILIKE $${params.length})`);
    }
    params.push(lp.limit, lp.offset);
    // SQL: страница своих товаров с остатком, продажами и главным фото
    const { rows } = await query(
      `SELECT p.id, p.sku, p.name_ru, p.name_en, p.price_byn, p.old_price_byn, p.moderation_status, p.rejection_reason,
              p.is_authenticated, p.views_count, p.rating_avg, p.reviews_count, p.created_at, p.updated_at,
              b.name AS brand, c.name_ru AS category_ru, c.name_en AS category_en,
              (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_main DESC, pi.sort_order LIMIT 1) AS image,
              (SELECT COALESCE(SUM(vs.available), 0)::int FROM v_variant_stock vs WHERE vs.product_id = p.id) AS stock_available,
              (SELECT COALESCE(SUM(oi.quantity), 0)::int FROM order_items oi JOIN orders o ON o.id = oi.order_id
                WHERE oi.product_id = p.id AND o.status NOT IN ('cancelled', 'returned')) AS units_sold,
              COUNT(*) OVER () AS total
         FROM products p
         JOIN brands b ON b.id = p.brand_id
         JOIN categories c ON c.id = p.category_id
        WHERE ${where.join(' AND ')}
        ORDER BY ${lp.order}, p.id DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json(
      pageResult(
        rows.map((p) => ({
          id: p.id,
          sku: p.sku,
          name: { ru: p.name_ru, en: p.name_en },
          brand: p.brand,
          category: { ru: p.category_ru, en: p.category_en },
          price: Number(p.price_byn),
          oldPrice: p.old_price_byn ? Number(p.old_price_byn) : null,
          status: p.moderation_status,
          rejectionReason: p.rejection_reason,
          authenticated: p.is_authenticated,
          views: p.views_count,
          rating: Number(p.rating_avg),
          reviews: p.reviews_count,
          stock: p.stock_available,
          sold: p.units_sold,
          image: p.image,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
        })),
        Number(rows[0]?.total || 0),
        lp
      )
    );
  }
);

// Загрузка своего товара целиком (для формы редактирования).
// Таблицы: products, brands, categories, product_images, product_variants, sizes, v_variant_stock (SELECT)
async function loadOwnProduct(id, user) {
  const ownerCheck = user.role === 'owner' ? '' : 'AND p.seller_id = $2';
  const args = user.role === 'owner' ? [id] : [id, user.id];
  // SQL: товар (только свой — для продавца)
  const { rows } = await query(
    `SELECT p.*, b.name AS brand_name, b.slug AS brand_slug, b.accent_color, c.slug AS category_slug
       FROM products p JOIN brands b ON b.id = p.brand_id JOIN categories c ON c.id = p.category_id
      WHERE p.id = $1 ${ownerCheck}`,
    args
  );
  const p = rows[0];
  if (!p) return null;
  const [images, variants] = await Promise.all([
    // SQL: фото товара
    query('SELECT id, url, sort_order, is_main FROM product_images WHERE product_id = $1 ORDER BY is_main DESC, sort_order, id', [id]),
    // SQL: варианты-размеры с остатком по всем складам
    query(
      `SELECT pv.id, pv.size_id, pv.sku_variant, s.value_int AS label, s.sort_order, COALESCE(vs.quantity, 0) AS quantity, COALESCE(vs.available, 0) AS available
         FROM product_variants pv JOIN sizes s ON s.id = pv.size_id LEFT JOIN v_variant_stock vs ON vs.variant_id = pv.id
        WHERE pv.product_id = $1 ORDER BY s.sort_order, s.id`,
      [id]
    ),
  ]);
  return {
    id: p.id,
    sku: p.sku,
    brandId: p.brand_id,
    brand: { name: p.brand_name, slug: p.brand_slug, accent: p.accent_color },
    collectionId: p.collection_id,
    categoryId: p.category_id,
    nameRu: p.name_ru,
    nameEn: p.name_en,
    descriptionRu: p.description_ru,
    descriptionEn: p.description_en,
    compositionRu: p.composition_ru,
    compositionEn: p.composition_en,
    careRu: p.care_ru,
    careEn: p.care_en,
    price: Number(p.price_byn),
    oldPrice: p.old_price_byn ? Number(p.old_price_byn) : null,
    gender: p.gender,
    color: p.color,
    material: p.material,
    country: p.country_of_origin,
    isLimited: p.is_limited,
    isNew: p.is_new,
    status: p.moderation_status,
    rejectionReason: p.rejection_reason,
    authenticated: p.is_authenticated,
    views: p.views_count,
    rating: Number(p.rating_avg),
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    images: images.rows.map((i) => ({ id: i.id, url: i.url, isMain: i.is_main, placeholder: isPlaceholder(i.url) })),
    variants: variants.rows.map((v) => ({ id: v.id, sizeId: v.size_id, sku: v.sku_variant, label: v.label, quantity: v.quantity, available: v.available })),
    sizeIds: variants.rows.map((v) => v.size_id),
  };
}

// GET /api/seller/products/:id — свой товар для редактирования (роль: seller, только свой)
// Таблицы: см. loadOwnProduct
router.get('/products/:id', validate([param('id').isInt({ min: 1 }).toInt()]), async (req, res) => {
  const product = await loadOwnProduct(req.valid.id, req.user);
  if (!product) throw new ApiError(404, 'catalog.productNotFound');
  res.json({ product });
});

// Правила проверки формы товара
const productValidators = [
  body('brandId').isInt({ min: 1 }).withMessage(msg('validation.required')).toInt(),
  body('collectionId').optional({ values: 'null' }).isInt({ min: 1 }).toInt(),
  body('categoryId').isInt({ min: 1 }).withMessage(msg('validation.required')).toInt(),
  body('nameRu').isString().trim().isLength({ min: 2, max: 200 }).withMessage(msg('validation.length', { min: 2, max: 200 })),
  body('nameEn').isString().trim().isLength({ min: 2, max: 200 }).withMessage(msg('validation.length', { min: 2, max: 200 })),
  body('descriptionRu').isString().trim().isLength({ min: 20, max: 5000 }).withMessage(msg('validation.length', { min: 20, max: 5000 })),
  body('descriptionEn').isString().trim().isLength({ min: 20, max: 5000 }).withMessage(msg('validation.length', { min: 20, max: 5000 })),
  body('compositionRu').optional().isString().trim().isLength({ max: 300 }).withMessage(msg('validation.length', { min: 0, max: 300 })),
  body('compositionEn').optional().isString().trim().isLength({ max: 300 }).withMessage(msg('validation.length', { min: 0, max: 300 })),
  body('careRu').optional().isString().trim().isLength({ max: 2000 }).withMessage(msg('validation.length', { min: 0, max: 2000 })),
  body('careEn').optional().isString().trim().isLength({ max: 2000 }).withMessage(msg('validation.length', { min: 0, max: 2000 })),
  body('price').isFloat({ min: 0.01, max: 9999999 }).withMessage(msg('validation.price')).toFloat(),
  body('oldPrice').optional({ values: 'null' }).isFloat({ min: 0.01, max: 9999999 }).withMessage(msg('validation.price')).toFloat()
    .custom((value, { req }) => value > Number(req.body.price)).withMessage(msg('validation.oldPrice')),
  body('gender').isIn(GENDERS).withMessage(msg('validation.enum')),
  body('color').isString().trim().matches(/^[a-z][a-z0-9_-]{1,29}$/).withMessage(msg('validation.enum')),
  body('material').isString().trim().matches(/^[a-z][a-z0-9_-]{1,39}$/).withMessage(msg('validation.enum')),
  body('country').isString().trim().matches(/^[A-Z]{2}$/).withMessage(msg('validation.country')),
  body('isLimited').optional().isBoolean().toBoolean(),
  body('isNew').optional().isBoolean().toBoolean(),
  body('sizeIds').isArray({ min: 1, max: 40 }).withMessage(msg('seller.sizesRequired')),
  body('sizeIds.*').isInt({ min: 1 }).toInt(),
  body('submit').optional().isBoolean().toBoolean(),
];

// Проверка бренда, категории (листовая), коллекции (того же бренда) и размеров (сетка категории).
// Таблицы: brands, categories, collections, sizes (SELECT)
async function checkRefs(client, v) {
  // SQL: бренд, листовая категория с размерной сеткой, коллекция
  const { rows } = await client.query(
    `SELECT b.id AS brand_id, b.slug AS brand_slug, b.name AS brand_name, b.accent_color,
            c.id AS category_id, c.slug AS category_slug, COALESCE(c.size_type, pc.size_type, 'one_size') AS size_type,
            EXISTS (SELECT 1 FROM categories ch WHERE ch.parent_id = c.id) AS has_children,
            (SELECT brand_id FROM collections WHERE id = $3) AS collection_brand
       FROM brands b, categories c LEFT JOIN categories pc ON pc.id = c.parent_id
      WHERE b.id = $1 AND c.id = $2`,
    [v.brandId, v.categoryId, v.collectionId || null]
  );
  const r = rows[0];
  if (!r) throw new ApiError(422, 'errors.validation', { details: [{ field: 'brandId', message: 'brand / category' }] });
  if (r.has_children) throw new ApiError(422, 'seller.categoryLeaf');
  if (v.collectionId && r.collection_brand !== v.brandId) throw new ApiError(422, 'seller.collectionBrand');
  const ids = [...new Set(v.sizeIds)];
  // SQL: выбранные размеры должны относиться к сетке категории
  const sizes = await client.query('SELECT id, value_int FROM sizes WHERE id = ANY($1::int[]) AND type = $2', [ids, r.size_type]);
  if (sizes.rowCount !== ids.length) throw new ApiError(422, 'seller.sizesRequired');
  return { ...r, sizes: sizes.rows };
}

// Префикс артикула: код бренда + код категории, как у товаров seed (BAL-SNK-0001).
// Коды берутся из уже существующих артикулов; для новых брендов и категорий — из slug.
// Таблица: products (SELECT)
async function nextSku(client, brandId, categoryId, brandSlug, categorySlug) {
  // SQL: самый частый код бренда и категории среди существующих артикулов
  const { rows } = await client.query(
    `SELECT (SELECT split_part(sku, '-', 1) FROM products WHERE brand_id = $1 GROUP BY 1 ORDER BY COUNT(*) DESC LIMIT 1) AS b,
            (SELECT split_part(sku, '-', 2) FROM products WHERE category_id = $2 GROUP BY 1 ORDER BY COUNT(*) DESC LIMIT 1) AS c`,
    [brandId, categoryId]
  );
  const code = (slug) => slug.replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase().padEnd(3, 'X');
  const prefix = `${rows[0].b || code(brandSlug)}-${rows[0].c || code(categorySlug)}`;
  // SQL: следующий номер артикула с этим префиксом
  const n = await client.query(
    `SELECT COALESCE(MAX(split_part(sku, '-', 3)::int), 0) + 1 AS next FROM products WHERE sku ~ ('^' || $1 || '-[0-9]+$')`,
    [prefix]
  );
  return `${prefix}-${String(n.rows[0].next).padStart(4, '0')}`;
}

const variantSku = (sku, label) => `${sku}-${String(label).replace(/\s+/g, '').replace('.', '').toUpperCase()}`;

// Синхронизация вариантов с выбранными размерами: новые добавляются, снятые удаляются,
// если по ним нет остатков на складе и заказов. Таблицы: product_variants (SELECT, INSERT, DELETE), stock, order_items (SELECT)
async function syncVariants(client, productId, sku, sizes) {
  // SQL: текущие варианты с признаком «используется»
  const { rows: current } = await client.query(
    `SELECT pv.id, pv.size_id, s.value_int AS label,
            (EXISTS (SELECT 1 FROM stock st WHERE st.variant_id = pv.id AND st.quantity > 0)
             OR EXISTS (SELECT 1 FROM order_items oi WHERE oi.variant_id = pv.id)) AS in_use
       FROM product_variants pv JOIN sizes s ON s.id = pv.size_id WHERE pv.product_id = $1`,
    [productId]
  );
  const wanted = new Set(sizes.map((s) => s.id));
  for (const v of current) {
    if (wanted.has(v.size_id)) continue;
    if (v.in_use) throw new ApiError(409, 'seller.sizeInUse', { params: { size: v.label } });
    // SQL: удаление снятого размера (строки stock с нулём и корзины удаляются каскадно)
    await client.query('DELETE FROM product_variants WHERE id = $1', [v.id]);
  }
  const have = new Set(current.map((v) => v.size_id));
  for (const s of sizes) {
    if (have.has(s.id)) continue;
    // SQL: новый вариант-размер (остатки заводит кладовщик приёмкой)
    await client.query('INSERT INTO product_variants (product_id, size_id, sku_variant) VALUES ($1, $2, $3)', [productId, s.id, variantSku(sku, s.value_int)]);
  }
}

// Перерисовка SVG-заглушек товара (если у товара нет своих фото): цвет и название могли измениться
// Таблица: product_images (SELECT)
async function refreshPlaceholders(client, productId, ref, v, sku) {
  const { rows } = await client.query('SELECT url FROM product_images WHERE product_id = $1', [productId]);
  const urls = rows.map((r) => r.url).filter(isPlaceholder);
  if (!urls.length) return;
  writeProductPlaceholders({ sku, color: v.color, name_en: v.nameEn, brand_slug: ref.brand_slug, brand_name: ref.brand_name, accent_color: ref.accent_color, category_slug: ref.category_slug }, urls);
}

// ---------------------------------------------------------------------------------------------
// POST /api/seller/products — новый товар (роль: seller). submit=true → на модерацию (pending), иначе черновик (draft)
// Транзакция. Таблицы: products (INSERT), product_variants (INSERT), product_images (INSERT — SVG-заглушки), audit_log (INSERT)
// Файлы: public/images/brands/<бренд>/products/<sku>-1.svg, -2.svg (scripts/generate-placeholders.js)
// ---------------------------------------------------------------------------------------------
router.post('/products', validate(productValidators), async (req, res) => {
  const v = req.valid;
  const created = await withTransaction(async (client) => {
    const ref = await checkRefs(client, v);
    const sku = await nextSku(client, v.brandId, v.categoryId, ref.brand_slug, ref.category_slug);
    const status = v.submit ? 'pending' : 'draft';
    // SQL: новый товар продавца (seller_id = текущий пользователь)
    const ins = await client.query(
      `INSERT INTO products (sku, model_code, brand_id, collection_id, category_id, seller_id, name_ru, name_en, description_ru, description_en,
                             composition_ru, composition_en, care_ru, care_en, price_byn, old_price_byn, gender, color, material,
                             country_of_origin, is_limited, is_new, moderation_status, is_authenticated)
       VALUES ($1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, FALSE)
       RETURNING id`,
      [sku, v.brandId, v.collectionId || null, v.categoryId, req.user.id, v.nameRu, v.nameEn, v.descriptionRu, v.descriptionEn,
        v.compositionRu || '', v.compositionEn || '', v.careRu || '', v.careEn || '', v.price, v.oldPrice || null, v.gender, v.color, v.material,
        v.country, Boolean(v.isLimited), Boolean(v.isNew), status]
    );
    const id = ins.rows[0].id;
    await syncVariants(client, id, sku, ref.sizes);
    // SQL: две SVG-заглушки фото (их можно заменить своими фото в редакторе)
    const urls = [1, 2].map((n) => `/images/brands/${ref.brand_slug}/products/${sku}-${n}.svg`);
    await client.query('INSERT INTO product_images (product_id, url, sort_order, is_main) VALUES ($1, $2, 1, TRUE), ($1, $3, 2, FALSE)', [id, urls[0], urls[1]]);
    writeProductPlaceholders({ sku, color: v.color, name_en: v.nameEn, brand_slug: ref.brand_slug, brand_name: ref.brand_name, accent_color: ref.accent_color, category_slug: ref.category_slug }, urls);
    await audit(client, { userId: req.user.id, action: 'product.create', entity: 'products', entityId: id, newData: { sku, status, name_ru: v.nameRu, price_byn: v.price }, ip: req.ip });
    return { id, sku, status };
  });
  res.status(201).json({ product: created });
});

// ---------------------------------------------------------------------------------------------
// PUT /api/seller/products/:id — изменение своего товара (роль: seller, только свой).
// Любое изменение снимает отметку подлинности и отправляет товар на повторную модерацию (pending) или в черновик.
// Транзакция. Таблицы: products (SELECT FOR UPDATE, UPDATE), product_variants (INSERT, DELETE), audit_log (INSERT)
// ---------------------------------------------------------------------------------------------
router.put('/products/:id', validate([param('id').isInt({ min: 1 }).toInt(), ...productValidators]), async (req, res) => {
  const v = req.valid;
  const updated = await withTransaction(async (client) => {
    // SQL: свой товар блокируется на время изменения
    const own = await client.query(`SELECT * FROM products WHERE id = $1 ${req.user.role === 'owner' ? '' : 'AND seller_id = $2'} FOR UPDATE`, req.user.role === 'owner' ? [v.id] : [v.id, req.user.id]);
    const old = own.rows[0];
    if (!old) throw new ApiError(404, 'catalog.productNotFound');
    const ref = await checkRefs(client, v);
    const status = v.submit ? 'pending' : 'draft';
    // SQL: новые данные товара; отметка подлинности и причина отклонения сбрасываются
    await client.query(
      `UPDATE products SET brand_id = $2, collection_id = $3, category_id = $4, name_ru = $5, name_en = $6, description_ru = $7, description_en = $8,
              composition_ru = $9, composition_en = $10, care_ru = $11, care_en = $12, price_byn = $13, old_price_byn = $14, gender = $15,
              color = $16, material = $17, country_of_origin = $18, is_limited = $19, is_new = $20,
              moderation_status = $21, rejection_reason = NULL, is_authenticated = FALSE
        WHERE id = $1`,
      [v.id, v.brandId, v.collectionId || null, v.categoryId, v.nameRu, v.nameEn, v.descriptionRu, v.descriptionEn, v.compositionRu || '', v.compositionEn || '',
        v.careRu || '', v.careEn || '', v.price, v.oldPrice || null, v.gender, v.color, v.material, v.country, Boolean(v.isLimited), Boolean(v.isNew), status]
    );
    await syncVariants(client, v.id, old.sku, ref.sizes);
    await refreshPlaceholders(client, v.id, ref, v, old.sku);
    await audit(client, {
      userId: req.user.id, action: 'product.update', entity: 'products', entityId: v.id,
      oldData: { status: old.moderation_status, price_byn: Number(old.price_byn), old_price_byn: old.old_price_byn ? Number(old.old_price_byn) : null, name_ru: old.name_ru },
      newData: { status, price_byn: v.price, old_price_byn: v.oldPrice || null, name_ru: v.nameRu }, ip: req.ip,
    });
    return { id: v.id, sku: old.sku, status };
  });
  res.json({ product: updated });
});

// ---------------------------------------------------------------------------------------------
// DELETE /api/seller/products/:id — удаление своего товара (роль: seller, только свой).
// Если товар уже заказывали или он лежит на складе — не удаляется, а снимается с публикации (draft).
// Транзакция. Таблицы: products (SELECT FOR UPDATE, DELETE или UPDATE), order_items, stock (SELECT), product_images (SELECT),
//             каскадно: product_images, product_variants, stock, cart_items, wishlist, comparisons; audit_log (INSERT)
// ---------------------------------------------------------------------------------------------
router.delete('/products/:id', validate([param('id').isInt({ min: 1 }).toInt()]), async (req, res) => {
  const result = await withTransaction(async (client) => {
    const own = await client.query(`SELECT id, sku, moderation_status FROM products WHERE id = $1 ${req.user.role === 'owner' ? '' : 'AND seller_id = $2'} FOR UPDATE`, req.user.role === 'owner' ? [req.valid.id] : [req.valid.id, req.user.id]);
    const p = own.rows[0];
    if (!p) throw new ApiError(404, 'catalog.productNotFound');
    // SQL: есть ли заказы или остатки на складе
    const used = await client.query(
      `SELECT EXISTS (SELECT 1 FROM order_items WHERE product_id = $1) AS ordered,
              EXISTS (SELECT 1 FROM stock st JOIN product_variants pv ON pv.id = st.variant_id WHERE pv.product_id = $1 AND st.quantity > 0) AS stocked`,
      [p.id]
    );
    if (used.rows[0].ordered || used.rows[0].stocked) {
      // SQL: снятие с публикации вместо удаления
      await client.query("UPDATE products SET moderation_status = 'draft' WHERE id = $1", [p.id]);
      await audit(client, { userId: req.user.id, action: 'product.unpublish', entity: 'products', entityId: p.id, oldData: { status: p.moderation_status }, newData: { status: 'draft' }, ip: req.ip });
      return { deleted: false, status: 'draft' };
    }
    const imgs = await client.query('SELECT url FROM product_images WHERE product_id = $1', [p.id]);
    // SQL: удаление товара (фото, варианты, остатки с нулём, позиции корзин/избранного — каскадно)
    await client.query('DELETE FROM products WHERE id = $1', [p.id]);
    await audit(client, { userId: req.user.id, action: 'product.delete', entity: 'products', entityId: p.id, oldData: { sku: p.sku, status: p.moderation_status }, ip: req.ip });
    return { deleted: true, files: imgs.rows.map((r) => r.url) };
  });
  (result.files || []).forEach((url) => (isPlaceholder(url) ? removePlaceholderFile(url) : removeUploadedFile(url)));
  res.json(result.deleted ? { deleted: true } : { deleted: false, status: result.status, message: req.t('seller.unpublished') });
});

// ---------------------------------------------------------------------------------------------
// POST /api/seller/products/:id/images — загрузка фото (multipart, поле images, до 8 файлов; multer) (роль: seller, только свой)
// Первые свои фото заменяют SVG-заглушки. Изменение фото отправляет опубликованный товар на повторную модерацию.
// Транзакция. Таблицы: products (SELECT FOR UPDATE, UPDATE moderation_status), product_images (SELECT, DELETE заглушек, INSERT)
// ---------------------------------------------------------------------------------------------
router.post('/products/:id/images', uploadProductImages, validate([param('id').isInt({ min: 1 }).toInt()]), async (req, res) => {
  const files = req.files || [];
  if (!files.length) throw new ApiError(400, 'errors.badRequest');
  try {
    await withTransaction(async (client) => {
      const own = await client.query(`SELECT id, moderation_status FROM products WHERE id = $1 ${req.user.role === 'owner' ? '' : 'AND seller_id = $2'} FOR UPDATE`, req.user.role === 'owner' ? [req.valid.id] : [req.valid.id, req.user.id]);
      const p = own.rows[0];
      if (!p) throw new ApiError(404, 'catalog.productNotFound');
      // SQL: текущие фото товара
      const cur = await client.query('SELECT id, url, sort_order FROM product_images WHERE product_id = $1 ORDER BY sort_order, id', [p.id]);
      const real = cur.rows.filter((r) => !isPlaceholder(r.url));
      if (real.length + files.length > MAX_IMAGES) throw new ApiError(409, 'seller.imagesLimit');
      if (!real.length && cur.rows.length) {
        // SQL: заглушки уступают место настоящим фото
        await client.query('DELETE FROM product_images WHERE product_id = $1', [p.id]);
      }
      let order = real.reduce((m, r) => Math.max(m, r.sort_order), 0);
      for (const [i, file] of files.entries()) {
        order += 1;
        // SQL: новое фото; главным становится первое, если главного нет
        await client.query(
          `INSERT INTO product_images (product_id, url, sort_order, is_main)
           VALUES ($1, $2, $3, $4 AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = $1 AND is_main))`,
          [p.id, file.publicUrl, order, i === 0]
        );
      }
      // SQL: опубликованный товар с новыми фото уходит на повторную модерацию
      if (p.moderation_status === 'approved' || p.moderation_status === 'rejected') {
        await client.query("UPDATE products SET moderation_status = 'pending', rejection_reason = NULL, is_authenticated = FALSE WHERE id = $1", [p.id]);
      }
    });
  } catch (err) {
    files.forEach((f) => removeUploadedFile(f.publicUrl));
    throw err;
  }
  const product = await loadOwnProduct(req.valid.id, req.user);
  res.status(201).json({ product });
});

// ---------------------------------------------------------------------------------------------
// PATCH /api/seller/products/:id/images/:imageId/main — сделать фото главным (роль: seller, только свой)
// Транзакция. Таблицы: products (SELECT), product_images (UPDATE is_main)
// ---------------------------------------------------------------------------------------------
router.patch('/products/:id/images/:imageId/main', validate([param('id').isInt({ min: 1 }).toInt(), param('imageId').isInt({ min: 1 }).toInt()]), async (req, res) => {
  await withTransaction(async (client) => {
    // SQL: фото своего товара
    const img = await client.query(
      `SELECT pi.id FROM product_images pi JOIN products p ON p.id = pi.product_id
        WHERE pi.id = $1 AND p.id = $2 ${req.user.role === 'owner' ? '' : 'AND p.seller_id = $3'}`,
      req.user.role === 'owner' ? [req.valid.imageId, req.valid.id] : [req.valid.imageId, req.valid.id, req.user.id]
    );
    if (!img.rows[0]) throw new ApiError(404, 'errors.notFound');
    // SQL: снять отметку «главное» со всех фото, затем поставить выбранному (частичный уникальный индекс uq_product_images_main)
    await client.query('UPDATE product_images SET is_main = FALSE WHERE product_id = $1 AND is_main', [req.valid.id]);
    await client.query('UPDATE product_images SET is_main = TRUE WHERE id = $1', [req.valid.imageId]);
  });
  res.json({ product: await loadOwnProduct(req.valid.id, req.user) });
});

// ---------------------------------------------------------------------------------------------
// DELETE /api/seller/products/:id/images/:imageId — удалить фото (роль: seller, только свой).
// Если фото не осталось — возвращаются SVG-заглушки. Транзакция. Таблицы: products, product_images (SELECT, DELETE, UPDATE, INSERT)
// ---------------------------------------------------------------------------------------------
router.delete('/products/:id/images/:imageId', validate([param('id').isInt({ min: 1 }).toInt(), param('imageId').isInt({ min: 1 }).toInt()]), async (req, res) => {
  const removed = await withTransaction(async (client) => {
    // SQL: фото своего товара + данные для заглушек
    const { rows } = await client.query(
      `SELECT pi.id, pi.url, pi.is_main, p.sku, p.color, p.name_en, b.slug AS brand_slug, b.name AS brand_name, b.accent_color, c.slug AS category_slug
         FROM product_images pi JOIN products p ON p.id = pi.product_id JOIN brands b ON b.id = p.brand_id JOIN categories c ON c.id = p.category_id
        WHERE pi.id = $1 AND p.id = $2 ${req.user.role === 'owner' ? '' : 'AND p.seller_id = $3'}`,
      req.user.role === 'owner' ? [req.valid.imageId, req.valid.id] : [req.valid.imageId, req.valid.id, req.user.id]
    );
    const img = rows[0];
    if (!img) throw new ApiError(404, 'errors.notFound');
    // SQL: удаление фото
    await client.query('DELETE FROM product_images WHERE id = $1', [img.id]);
    // SQL: если удалили главное — главным становится первое оставшееся
    if (img.is_main) {
      await client.query('UPDATE product_images SET is_main = TRUE WHERE id = (SELECT id FROM product_images WHERE product_id = $1 ORDER BY sort_order, id LIMIT 1)', [req.valid.id]);
    }
    const left = await client.query('SELECT COUNT(*)::int AS n FROM product_images WHERE product_id = $1', [req.valid.id]);
    if (!left.rows[0].n) {
      const urls = [1, 2].map((n) => `/images/brands/${img.brand_slug}/products/${img.sku}-${n}.svg`);
      // SQL: фото не осталось — снова SVG-заглушки
      await client.query('INSERT INTO product_images (product_id, url, sort_order, is_main) VALUES ($1, $2, 1, TRUE), ($1, $3, 2, FALSE)', [req.valid.id, urls[0], urls[1]]);
      writeProductPlaceholders(img, urls);
    }
    return img.url;
  });
  removeUploadedFile(removed);
  res.json({ product: await loadOwnProduct(req.valid.id, req.user) });
});

// ---------------------------------------------------------------------------------------------
// GET /api/seller/orders?status=&q=&page= — заказы, в которых есть товары продавца (роль: seller; только просмотр).
// Покупателю видны только свои позиции продавца; персональные данные — имя и город доставки.
// Таблицы: orders, order_items, delivery_methods (SELECT)
// ---------------------------------------------------------------------------------------------
const ORDER_SORT = { created: 'o.created_at', number: 'o.order_number', status: 'o.status', sum: 'seller_total' };
router.get('/orders', validate([...listValidators, q('status').optional().isIn(['all', 'active', 'delivered', 'cancelled', 'returned'])]), async (req, res) => {
  const lp = listParams(req, ORDER_SORT, 'created');
  const params = [req.user.id];
  const where = ['EXISTS (SELECT 1 FROM order_items x WHERE x.order_id = o.id AND x.seller_id = $1)'];
  const st = req.valid.status;
  if (st === 'active') where.push("o.status NOT IN ('delivered', 'cancelled', 'returned')");
  else if (st && st !== 'all') {
    params.push(st);
    where.push(`o.status = $${params.length}`);
  }
  if (lp.search) {
    params.push(likePattern(lp.search));
    where.push(`(o.order_number ILIKE $${params.length} OR EXISTS (SELECT 1 FROM order_items y WHERE y.order_id = o.id AND y.seller_id = $1 AND (y.product_name ILIKE $${params.length} OR y.sku ILIKE $${params.length})))`);
  }
  params.push(lp.limit, lp.offset);
  // SQL: заказы со своими позициями и суммой по ним
  const { rows } = await query(
    `SELECT o.id, o.order_number, o.status, o.payment_status, o.created_at, o.contact_name, dm.name_ru AS dm_ru, dm.name_en AS dm_en,
            split_part(o.address_snapshot, E'\\n', 2) AS city,
            (SELECT SUM(oi.price_byn * oi.quantity) FROM order_items oi WHERE oi.order_id = o.id AND oi.seller_id = $1) AS seller_total,
            (SELECT json_agg(json_build_object('name', oi.product_name, 'nameEn', oi.product_name_en, 'sku', oi.sku, 'size', oi.size_label,
                                               'qty', oi.quantity, 'price', oi.price_byn, 'image', oi.image_url, 'productId', oi.product_id) ORDER BY oi.id)
               FROM order_items oi WHERE oi.order_id = o.id AND oi.seller_id = $1) AS items,
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
        id: o.id,
        orderNumber: o.order_number,
        status: o.status,
        paymentStatus: o.payment_status,
        createdAt: o.created_at,
        buyer: (o.contact_name || '').split(' ')[0],
        city: o.city,
        delivery: { ru: o.dm_ru, en: o.dm_en },
        total: Number(o.seller_total || 0),
        items: (o.items || []).map((i) => ({ ...i, name: { ru: i.name, en: i.nameEn || i.name }, price: Number(i.price) })),
      })),
      Number(rows[0]?.total || 0),
      lp
    )
  );
});

// ---------------------------------------------------------------------------------------------
// GET /api/seller/stats?days=30 — статистика продавца (роль: seller)
// Таблицы: order_items, orders (SELECT SUM / COUNT по дням), products (SELECT views_count, rating), v_top_products не подходит
// (он по всем продавцам), поэтому топ считается отдельным запросом по своим позициям.
// ---------------------------------------------------------------------------------------------
router.get('/stats', validate([q('days').optional().isInt({ min: 7, max: 365 }).toInt()]), async (req, res) => {
  const days = req.valid.days || 30;
  const [kpi, daily, top, cats] = await Promise.all([
    // SQL: выручка, проданные штуки, заказы, средний чек за период и за предыдущий такой же период; просмотры и рейтинг товаров
    query(
      `WITH s AS (
         SELECT oi.order_id, oi.quantity, oi.price_byn, o.created_at
           FROM order_items oi JOIN orders o ON o.id = oi.order_id
          WHERE oi.seller_id = $1 AND o.status NOT IN ('cancelled', 'returned') AND o.created_at > NOW() - ($2 * 2) * INTERVAL '1 day'
       )
       SELECT COALESCE(SUM(quantity * price_byn) FILTER (WHERE created_at > NOW() - $2 * INTERVAL '1 day'), 0) AS revenue,
              COALESCE(SUM(quantity * price_byn) FILTER (WHERE created_at <= NOW() - $2 * INTERVAL '1 day'), 0) AS revenue_prev,
              COALESCE(SUM(quantity) FILTER (WHERE created_at > NOW() - $2 * INTERVAL '1 day'), 0)::int AS units,
              COUNT(DISTINCT order_id) FILTER (WHERE created_at > NOW() - $2 * INTERVAL '1 day')::int AS orders,
              COUNT(DISTINCT order_id) FILTER (WHERE created_at <= NOW() - $2 * INTERVAL '1 day')::int AS orders_prev,
              (SELECT COALESCE(SUM(views_count), 0)::int FROM products WHERE seller_id = $1) AS views,
              (SELECT COALESCE(ROUND(AVG(NULLIF(rating_avg, 0)), 2), 0) FROM products WHERE seller_id = $1 AND moderation_status = 'approved') AS rating,
              (SELECT COUNT(*)::int FROM products WHERE seller_id = $1 AND moderation_status = 'approved') AS live
         FROM s`,
      [req.user.id, days]
    ),
    // SQL: продажи по дням (generate_series — дни без продаж тоже попадают в график с нулём)
    query(
      `SELECT d::date AS day,
              COALESCE(SUM(oi.price_byn * oi.quantity), 0) AS revenue,
              COALESCE(SUM(oi.quantity), 0)::int AS units
         FROM generate_series(CURRENT_DATE - ($2 - 1) * INTERVAL '1 day', CURRENT_DATE, INTERVAL '1 day') d
         LEFT JOIN orders o ON o.created_at::date = d::date AND o.status NOT IN ('cancelled', 'returned')
         LEFT JOIN order_items oi ON oi.order_id = o.id AND oi.seller_id = $1
        GROUP BY d ORDER BY d`,
      [req.user.id, days]
    ),
    // SQL: топ-8 своих товаров по выручке за период
    query(
      `SELECT p.id, p.sku, p.name_ru, p.name_en, p.views_count, b.name AS brand,
              SUM(oi.quantity)::int AS units, SUM(oi.quantity * oi.price_byn) AS revenue,
              (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_main DESC, pi.sort_order LIMIT 1) AS image
         FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN products p ON p.id = oi.product_id JOIN brands b ON b.id = p.brand_id
        WHERE oi.seller_id = $1 AND o.status NOT IN ('cancelled', 'returned') AND o.created_at > NOW() - $2 * INTERVAL '1 day'
        GROUP BY p.id, b.name ORDER BY revenue DESC LIMIT 8`,
      [req.user.id, days]
    ),
    // SQL: выручка по корневым категориям за период
    query(
      `SELECT COALESCE(root.name_ru, c.name_ru) AS name_ru, COALESCE(root.name_en, c.name_en) AS name_en, SUM(oi.quantity * oi.price_byn) AS revenue
         FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN products p ON p.id = oi.product_id
         JOIN categories c ON c.id = p.category_id LEFT JOIN categories root ON root.id = c.parent_id
        WHERE oi.seller_id = $1 AND o.status NOT IN ('cancelled', 'returned') AND o.created_at > NOW() - $2 * INTERVAL '1 day'
        GROUP BY 1, 2 ORDER BY revenue DESC`,
      [req.user.id, days]
    ),
  ]);
  const k = kpi.rows[0];
  res.json({
    days,
    kpi: {
      revenue: Number(k.revenue),
      revenuePrev: Number(k.revenue_prev),
      units: k.units,
      orders: k.orders,
      ordersPrev: k.orders_prev,
      avg: k.orders ? Math.round((Number(k.revenue) / k.orders) * 100) / 100 : 0,
      views: k.views,
      rating: Number(k.rating),
      live: k.live,
    },
    daily: daily.rows.map((d) => ({ day: d.day, revenue: Number(d.revenue), units: d.units })),
    top: top.rows.map((p) => ({ id: p.id, sku: p.sku, name: { ru: p.name_ru, en: p.name_en }, brand: p.brand, units: p.units, revenue: Number(p.revenue), views: p.views_count, image: p.image })),
    categories: cats.rows.map((c) => ({ name: { ru: c.name_ru, en: c.name_en }, revenue: Number(c.revenue) })),
  });
});

// ---------------------------------------------------------------------------------------------
// GET /api/seller/reviews?status=&rating=&page= — отзывы на товары продавца (роль: seller; только просмотр)
// Таблицы: reviews, products, users, product_images (SELECT)
// ---------------------------------------------------------------------------------------------
router.get(
  '/reviews',
  validate([...listValidators, q('status').optional().isIn(['all', 'pending', 'approved', 'rejected']), q('rating').optional().isInt({ min: 1, max: 5 }).toInt()]),
  async (req, res) => {
    const lp = listParams(req, { created: 'r.created_at', rating: 'r.rating' }, 'created', 'desc', 10);
    const params = [req.user.id];
    const where = ['p.seller_id = $1'];
    if (req.valid.status && req.valid.status !== 'all') {
      params.push(req.valid.status);
      where.push(`r.status = $${params.length}`);
    }
    if (req.valid.rating) {
      params.push(req.valid.rating);
      where.push(`r.rating = $${params.length}`);
    }
    params.push(lp.limit, lp.offset);
    // SQL: отзывы на свои товары + распределение оценок по одобренным
    const [list, dist] = await Promise.all([
      query(
        `SELECT r.id, r.rating, r.text, r.status, r.created_at, u.first_name, p.id AS product_id, p.name_ru, p.name_en, p.sku,
                (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_main DESC, pi.sort_order LIMIT 1) AS image,
                COUNT(*) OVER () AS total
           FROM reviews r JOIN products p ON p.id = r.product_id JOIN users u ON u.id = r.user_id
          WHERE ${where.join(' AND ')}
          ORDER BY ${lp.order}, r.id DESC
          LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      ),
      query(
        `SELECT r.rating, COUNT(*)::int AS n FROM reviews r JOIN products p ON p.id = r.product_id
          WHERE p.seller_id = $1 AND r.status = 'approved' GROUP BY r.rating`,
        [req.user.id]
      ),
    ]);
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    dist.rows.forEach((d) => (distribution[d.rating] = d.n));
    res.json({
      ...pageResult(
        list.rows.map((r) => ({ id: r.id, rating: r.rating, text: r.text, status: r.status, createdAt: r.created_at, author: r.first_name, product: { id: r.product_id, sku: r.sku, name: { ru: r.name_ru, en: r.name_en }, image: r.image } })),
        Number(list.rows[0]?.total || 0),
        lp
      ),
      distribution,
    });
  }
);

export default router;
