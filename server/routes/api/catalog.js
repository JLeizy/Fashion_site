// Справочники каталога и подсказки поиска (роль: любая, включая гостя).
// Полный каталог с фильтрами, страница товара и бренда добавляются на этапах 6–9.
import express from 'express';
import { query } from '../../../db/pool.js';
import { getRates } from '../../services/rates.js';
import { buildSearch } from '../../services/searchQuery.js';

const router = express.Router();

// GET /api/brands — список брендов с числом опубликованных товаров (роль: любая)
// Таблицы: brands, products (SELECT, LEFT JOIN + COUNT)
router.get('/brands', async (req, res) => {
  const { rows } = await query(
    `SELECT b.id, b.name, b.slug, b.country, b.founded_year, b.founder, b.short_desc_ru, b.short_desc_en,
            b.hero_image, b.accent_color, b.sort_order,
            COUNT(p.id) FILTER (WHERE p.moderation_status = 'approved')::int AS products_count
       FROM brands b
       LEFT JOIN products p ON p.brand_id = b.id
      GROUP BY b.id
      ORDER BY b.sort_order, b.name`
  );
  res.set('Cache-Control', 'public, max-age=60');
  res.json({
    brands: rows.map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      country: b.country,
      foundedYear: b.founded_year,
      founder: b.founder,
      shortDesc: { ru: b.short_desc_ru, en: b.short_desc_en },
      heroImage: b.hero_image,
      accentColor: b.accent_color,
      productsCount: b.products_count,
    })),
  });
});

// GET /api/categories — дерево категорий с числом товаров (роль: любая)
// Таблицы: categories, products (SELECT; рекурсия собирается в JS по parent_id)
router.get('/categories', async (req, res) => {
  const { rows } = await query(
    `SELECT c.id, c.parent_id, c.slug, c.name_ru, c.name_en, c.size_type, c.sort_order,
            (SELECT COUNT(*)::int FROM products p WHERE p.category_id = c.id AND p.moderation_status = 'approved') AS products_count
       FROM categories c
      ORDER BY c.parent_id NULLS FIRST, c.sort_order, c.id`
  );
  const nodes = new Map(
    rows.map((c) => [c.id, { id: c.id, parentId: c.parent_id, slug: c.slug, name: { ru: c.name_ru, en: c.name_en }, sizeType: c.size_type, sortOrder: c.sort_order, count: c.products_count, children: [] }])
  );
  const roots = [];
  for (const node of nodes.values()) {
    if (node.parentId && nodes.has(node.parentId)) nodes.get(node.parentId).children.push(node);
    else roots.push(node);
  }
  const total = (node) => {
    node.count += node.children.reduce((sum, child) => sum + total(child), 0);
    return node.count;
  };
  roots.forEach(total);
  res.set('Cache-Control', 'public, max-age=60');
  res.json({ categories: roots });
});

// GET /api/currency-rates — курсы валют к BYN (роль: любая). Таблица: currency_rates (SELECT)
router.get('/currency-rates', async (req, res) => {
  res.json({ rates: await getRates() });
});

// GET /api/search/suggest?q=… — подсказки поиска: товары с картинками, бренды, категории (роль: любая)
// Таблицы: products, brands, categories, product_images (SELECT; ILIKE по trigram-индексам + ts_rank по search_vector)
router.get('/search/suggest', async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 80);
  if (q.length < 1) return res.json({ q, products: [], brands: [], categories: [], total: 0 });

  const params = [];
  const search = buildSearch(q, params);
  if (!search) return res.json({ q, products: [], brands: [], categories: [], total: 0 });

  // SQL: товары, подходящие под все слова запроса, по релевантности
  const productsSql = `
    SELECT p.id, p.sku, p.name_ru, p.name_en, p.price_byn, p.old_price_byn, b.name AS brand_name, b.slug AS brand_slug,
           (SELECT pi.url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_main DESC, pi.sort_order LIMIT 1) AS image,
           COUNT(*) OVER () AS total
      FROM products p
      JOIN brands b     ON b.id = p.brand_id
      JOIN categories c ON c.id = p.category_id
     WHERE p.moderation_status = 'approved' AND ${search.where}
     ORDER BY ${search.rank} DESC, p.views_count DESC
     LIMIT 8`;

  // SQL: бренды — по вхождению и по похожести (опечатки: «balensiaga» → Balenciaga)
  const brandsSql = `
    SELECT id, name, slug, founded_year, similarity(name, $1) AS sim
      FROM brands
     WHERE name ILIKE '%' || $1 || '%' OR similarity(name, $1) > 0.25
     ORDER BY sim DESC LIMIT 4`;

  // SQL: категории по названию на обоих языках
  const categoriesSql = `
    SELECT c.id, c.slug, c.name_ru, c.name_en, parent.slug AS parent_slug
      FROM categories c
      LEFT JOIN categories parent ON parent.id = c.parent_id
     WHERE c.name_ru ILIKE '%' || $1 || '%' OR c.name_en ILIKE '%' || $1 || '%'
     ORDER BY c.parent_id NULLS FIRST, c.sort_order LIMIT 5`;

  const [products, brands, categories] = await Promise.all([query(productsSql, params), query(brandsSql, [q]), query(categoriesSql, [q])]);
  res.json({
    q,
    total: products.rows[0]?.total || 0,
    products: products.rows.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: { ru: p.name_ru, en: p.name_en },
      brand: { name: p.brand_name, slug: p.brand_slug },
      price: Number(p.price_byn),
      oldPrice: p.old_price_byn ? Number(p.old_price_byn) : null,
      image: p.image,
    })),
    brands: brands.rows.map((b) => ({ id: b.id, name: b.name, slug: b.slug, foundedYear: b.founded_year })),
    categories: categories.rows.map((c) => ({ id: c.id, slug: c.slug, name: { ru: c.name_ru, en: c.name_en }, parentSlug: c.parent_slug })),
  });
});

export default router;
