// Справочники каталога и подсказки поиска (роль: любая, включая гостя).
// Полный каталог с фильтрами, страница товара и бренда добавляются на этапах 6–9.
import express from 'express';
import { query } from '../../../db/pool.js';
import { getRates } from '../../services/rates.js';
import { buildSearch } from '../../services/searchQuery.js';
import { CARD_SELECT, CARD_JOINS, toCard } from '../../services/productCards.js';
import { ApiError } from '../../lib/errors.js';

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

// GET /api/brands/:slug — страница бренда (раздел 6.4 ТЗ): данные дома, коллекции, креативные директора,
// культовые модели, статистика и соседние бренды для навигации «предыдущий / следующий» (роль: любая).
// Таблицы: brands, collections, products, creative_directors, brand_history_sections, product_images,
//          product_variants, sizes, v_variant_stock (SELECT)
router.get('/brands/:slug', async (req, res) => {
  // SQL: бренд по slug
  const { rows } = await query(
    `SELECT b.*, (SELECT COUNT(*)::int FROM brand_history_sections s WHERE s.brand_id = b.id) AS history_sections
       FROM brands b WHERE b.slug = $1`,
    [String(req.params.slug).slice(0, 80)]
  );
  const b = rows[0];
  if (!b) throw new ApiError(404, 'catalog.brandNotFound');

  const [collections, directors, iconic, stats, neighbours, looks, runway] = await Promise.all([
    // SQL: коллекции бренда с количеством опубликованных товаров, новые — первыми
    query(
      `SELECT col.id, col.name, col.season, col.year, col.is_new, col.cover_image,
              COUNT(p.id) FILTER (WHERE p.moderation_status = 'approved')::int AS products_count
         FROM collections col
         LEFT JOIN products p ON p.collection_id = col.id
        WHERE col.brand_id = $1
        GROUP BY col.id
        ORDER BY col.year DESC, col.is_new DESC, col.id DESC`,
      [b.id]
    ),
    // SQL: креативные директора в хронологическом порядке
    query(
      `SELECT id, name, years_from, years_to, description_ru, description_en, key_collections_ru, key_collections_en, photo
         FROM creative_directors WHERE brand_id = $1 ORDER BY years_from`,
      [b.id]
    ),
    // SQL: культовые модели бренда (карточки)
    query(
      `SELECT ${CARD_SELECT} FROM products p ${CARD_JOINS}
        WHERE p.brand_id = $1 AND p.is_iconic AND p.moderation_status = 'approved'
        ORDER BY p.views_count DESC, p.rating_avg DESC
        LIMIT 8`,
      [b.id]
    ),
    // SQL: статистика бренда — товаров, минимальная цена, средний рейтинг, категорий
    query(
      `SELECT COUNT(*)::int AS products, MIN(price_byn) AS min_price, ROUND(AVG(NULLIF(rating_avg, 0)), 2) AS rating,
              COUNT(DISTINCT category_id)::int AS categories
         FROM products WHERE brand_id = $1 AND moderation_status = 'approved'`,
      [b.id]
    ),
    // SQL: предыдущий и следующий бренд по sort_order (по кругу)
    query(
      `SELECT slug, name, sort_order FROM brands ORDER BY sort_order, name`
    ),
    // SQL: образы для лукбука — по 12 главных фото товаров каждой коллекции бренда
    query(
      `SELECT * FROM (
         SELECT p.id, p.collection_id, p.name_ru, p.name_en, p.price_byn,
                (SELECT url FROM product_images WHERE product_id = p.id ORDER BY is_main DESC, sort_order LIMIT 1) AS image,
                ROW_NUMBER() OVER (PARTITION BY p.collection_id ORDER BY p.is_iconic DESC, p.views_count DESC) AS rn
           FROM products p
          WHERE p.brand_id = $1 AND p.moderation_status = 'approved' AND p.collection_id IS NOT NULL
       ) t WHERE t.rn <= 12`,
      [b.id]
    ),
    // SQL: лукбук — реальные кадры показа сезона (если скачаны), по порядку выхода
    query(
      `SELECT cl.collection_id, cl.image, cl.look_number
         FROM collection_looks cl JOIN collections col ON col.id = cl.collection_id
        WHERE col.brand_id = $1
        ORDER BY cl.collection_id, cl.sort_order`,
      [b.id]
    ),
  ]);
  const list = neighbours.rows;
  const i = list.findIndex((x) => x.slug === b.slug);
  const prev = list[(i - 1 + list.length) % list.length];
  const next = list[(i + 1) % list.length];
  const s = stats.rows[0];
  res.json({
    brand: {
      id: b.id,
      name: b.name,
      slug: b.slug,
      country: b.country,
      foundedYear: b.founded_year,
      founder: b.founder,
      shortDesc: { ru: b.short_desc_ru, en: b.short_desc_en },
      heroImage: b.hero_image,
      accentColor: b.accent_color,
      hasHistory: b.history_sections > 0,
    },
    stats: { products: s.products, minPrice: s.min_price ? Number(s.min_price) : 0, rating: s.rating ? Number(s.rating) : 0, categories: s.categories },
    collections: collections.rows.map((c) => ({
      id: c.id,
      name: c.name,
      season: c.season,
      year: c.year,
      isNew: c.is_new,
      cover: c.cover_image,
      productsCount: c.products_count,
      // Лукбук — кадры показа этого сезона; у марок без показов (Supreme, Chrome Hearts) — фото вещей коллекции
      looks: runway.rows.some((l) => l.collection_id === c.id)
        ? runway.rows.filter((l) => l.collection_id === c.id).map((l) => ({ image: l.image, lookNumber: l.look_number }))
        : looks.rows
            .filter((l) => l.collection_id === c.id)
            .map((l) => ({ id: l.id, name: { ru: l.name_ru, en: l.name_en }, price: Number(l.price_byn), image: l.image })),
    })),
    directors: directors.rows.map((d) => ({
      id: d.id,
      name: d.name,
      yearsFrom: d.years_from,
      yearsTo: d.years_to,
      description: { ru: d.description_ru, en: d.description_en },
      keyCollections: { ru: d.key_collections_ru, en: d.key_collections_en },
      photo: d.photo,
    })),
    iconic: iconic.rows.map(toCard),
    prev: { slug: prev.slug, name: prev.name },
    next: { slug: next.slug, name: next.name },
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

// GET /api/sizes — справочник размеров EU / IT / US / INT по сеткам (страница «Таблица размеров») (роль: любая)
// Таблица: sizes (SELECT)
router.get('/sizes', async (req, res) => {
  // SQL: все размеры по типу сетки и порядку
  const { rows } = await query('SELECT type, value_int, value_eu, value_it, value_us FROM sizes ORDER BY type, sort_order, id');
  const groups = {};
  rows.forEach((r) => (groups[r.type] ||= []).push({ int: r.value_int, eu: r.value_eu, it: r.value_it, us: r.value_us }));
  res.json({ sizes: groups });
});

export default router;
