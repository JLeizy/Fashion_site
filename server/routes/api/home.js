// Данные главной страницы (раздел 6.3 ТЗ) одним запросом к API: слайды hero, новые коллекции,
// новинки, культовые вещи, анонсы историй брендов, подборки с количеством товаров.
// Роль: любая (включая гостя). Только чтение.
import express from 'express';
import { query } from '../../../db/pool.js';
import { CARD_SELECT, CARD_JOINS, toCard } from '../../services/productCards.js';

const router = express.Router();

// Подборки главной: условие отбора + ссылка в каталог с теми же фильтрами (параметры URL каталога).
// brands — slug брендов, categories — slug корневых категорий.
export const SELECTIONS = [
  { key: 'gothic', brands: ['chrome-hearts', 'alexander-mcqueen', 'givenchy', 'enfants-riches-deprimes'], categories: null, colors: ['black'] },
  { key: 'streetwear', brands: ['supreme', 'vetements', 'balenciaga', 'avavav'], categories: ['clothing', 'shoes'], colors: null },
  { key: 'classic', brands: ['loro-piana', 'chanel', 'louis-vuitton', 'prada'], categories: null, colors: null },
  { key: 'jewelry', brands: null, categories: ['jewelry'], colors: null },
  { key: 'fragrance', brands: null, categories: ['fragrance'], colors: null },
];

function selectionLink(s) {
  const params = new URLSearchParams();
  if (s.brands) params.set('brand', s.brands.join(','));
  if (s.categories) params.set('category', s.categories.join(','));
  if (s.colors) params.set('color', s.colors.join(','));
  return `/catalog?${params.toString()}`;
}

// GET /api/home — всё для главной (роль: любая)
// Таблицы: banners, brands, collections, products, categories, product_images, product_variants, sizes,
//          v_variant_stock (SELECT). Каждый блок — отдельный параметризованный запрос, выполняются параллельно.
router.get('/home', async (req, res) => {
  // SQL: активные слайды hero (banners LEFT JOIN brands, collections) в порядке sort_order
  const bannersSql = query(
    `SELECT bn.id, bn.title_ru, bn.title_en, bn.subtitle_ru, bn.subtitle_en, bn.image, bn.link,
            b.name AS brand_name, b.slug AS brand_slug, b.accent_color, b.founded_year,
            col.name AS collection_name, col.season, col.year
       FROM banners bn
       LEFT JOIN brands b        ON b.id = bn.brand_id
       LEFT JOIN collections col ON col.id = bn.collection_id
      WHERE bn.is_active
      ORDER BY bn.sort_order, bn.id`
  );

  // SQL: новые коллекции всех брендов с количеством опубликованных товаров (collections JOIN brands, LEFT JOIN products)
  const collectionsSql = query(
    `SELECT col.id, col.name, col.season, col.year, col.cover_image,
            b.name AS brand_name, b.slug AS brand_slug, b.accent_color,
            COUNT(p.id) FILTER (WHERE p.moderation_status = 'approved')::int AS products_count
       FROM collections col
       JOIN brands b ON b.id = col.brand_id
       LEFT JOIN products p ON p.collection_id = col.id
      WHERE col.is_new
      GROUP BY col.id, b.id
      ORDER BY col.year DESC, b.sort_order`
  );

  // SQL: новинки — последние опубликованные товары с флагом is_new, не больше двух на бренд (оконная функция)
  const newSql = query(
    `SELECT * FROM (
       SELECT ${CARD_SELECT}, ROW_NUMBER() OVER (PARTITION BY p.brand_id ORDER BY p.created_at DESC, p.id DESC) AS rn
         FROM products p ${CARD_JOINS}
        WHERE p.moderation_status = 'approved' AND p.is_new
     ) t
     WHERE t.rn <= 2
     ORDER BY t.created_at DESC, t.id DESC
     LIMIT 16`
  );

  // SQL: культовые вещи — по одной самой популярной культовой модели у шести разных брендов (DISTINCT ON)
  const iconicSql = query(
    `SELECT * FROM (
       SELECT DISTINCT ON (p.brand_id) ${CARD_SELECT}, b.sort_order AS brand_sort, b.founded_year
         FROM products p ${CARD_JOINS}
        WHERE p.moderation_status = 'approved' AND p.is_iconic
        ORDER BY p.brand_id, p.views_count DESC, p.rating_avg DESC
     ) t
     ORDER BY t.views_count DESC
     LIMIT 6`
  );

  // SQL: анонсы историй — бренды, основатель, год, описание и количество разделов истории (brand_history_sections)
  const storiesSql = query(
    `SELECT b.id, b.name, b.slug, b.founder, b.founded_year, b.country, b.short_desc_ru, b.short_desc_en, b.hero_image, b.accent_color,
            (SELECT COUNT(*)::int FROM brand_history_sections s WHERE s.brand_id = b.id) AS sections,
            (SELECT COUNT(*)::int FROM brand_timeline_events e WHERE e.brand_id = b.id) AS events
       FROM brands b
      ORDER BY b.founded_year
      LIMIT 15`
  );

  // SQL: количество товаров и обложка для каждой подборки (products JOIN brands, categories + родительская категория)
  const selectionsSql = Promise.all(
    SELECTIONS.map((s) =>
      query(
        `SELECT COUNT(*)::int AS n,
                (ARRAY_AGG(pi.url ORDER BY p.is_iconic DESC, p.views_count DESC))[1] AS image
           FROM products p
           JOIN brands b ON b.id = p.brand_id
           JOIN categories c ON c.id = p.category_id
           LEFT JOIN categories root ON root.id = c.parent_id
           LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_main
          WHERE p.moderation_status = 'approved'
            AND ($1::text[] IS NULL OR b.slug = ANY($1::text[]))
            AND ($2::text[] IS NULL OR root.slug = ANY($2::text[]) OR c.slug = ANY($2::text[]))
            AND ($3::text[] IS NULL OR p.color = ANY($3::text[]))`,
        [s.brands, s.categories, s.colors]
      ).then((r) => ({ key: s.key, count: r.rows[0].n, image: r.rows[0].image, link: selectionLink(s), brands: s.brands }))
    )
  );

  const [banners, collections, newest, iconic, stories, selections] = await Promise.all([bannersSql, collectionsSql, newSql, iconicSql, storiesSql, selectionsSql]);

  res.set('Cache-Control', 'private, max-age=30');
  res.json({
    banners: banners.rows.map((b) => ({
      id: b.id,
      title: { ru: b.title_ru, en: b.title_en },
      subtitle: { ru: b.subtitle_ru, en: b.subtitle_en },
      image: b.image,
      link: b.link,
      brand: b.brand_slug ? { name: b.brand_name, slug: b.brand_slug, accentColor: b.accent_color, foundedYear: b.founded_year } : null,
      collection: b.collection_name ? { name: b.collection_name, season: b.season, year: b.year } : null,
    })),
    collections: collections.rows.map((c) => ({
      id: c.id,
      name: c.name,
      season: c.season,
      year: c.year,
      cover: c.cover_image,
      productsCount: c.products_count,
      brand: { name: c.brand_name, slug: c.brand_slug, accentColor: c.accent_color },
    })),
    newProducts: newest.rows.map(toCard),
    iconic: iconic.rows.map((r) => ({ ...toCard(r), foundedYear: r.founded_year })),
    stories: stories.rows.map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      founder: b.founder,
      foundedYear: b.founded_year,
      country: b.country,
      shortDesc: { ru: b.short_desc_ru, en: b.short_desc_en },
      image: b.hero_image,
      accentColor: b.accent_color,
      sections: b.sections,
      events: b.events,
    })),
    selections,
  });
});

export default router;
