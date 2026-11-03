// Единый формат «карточки товара» для каталога, поиска, избранного, рекомендаций и главной.
// Здесь же — общий фрагмент SQL, чтобы все списки товаров читали одни и те же поля.

// SQL: SELECT-часть карточки. Таблицы: products, brands, categories (JOIN), product_images, product_variants,
// sizes, v_variant_stock (LATERAL-подзапросы: фото и размеры с остатками).
export const CARD_SELECT = `
  p.id, p.sku, p.model_code, p.name_ru, p.name_en, p.price_byn, p.old_price_byn, p.color, p.material, p.gender,
  p.is_new, p.is_limited, p.is_iconic, p.is_authenticated, p.rating_avg, p.reviews_count, p.views_count, p.created_at,
  p.description_ru, p.description_en, p.country_of_origin, p.collection_id,
  b.id AS brand_id, b.name AS brand_name, b.slug AS brand_slug,
  c.id AS category_id, c.slug AS category_slug, c.name_ru AS category_ru, c.name_en AS category_en,
  img.urls AS images,
  sz.sizes`;

export const CARD_JOINS = `
  JOIN brands b     ON b.id = p.brand_id
  JOIN categories c ON c.id = p.category_id
  LEFT JOIN LATERAL (
    SELECT array_agg(pi.url ORDER BY pi.is_main DESC, pi.sort_order) AS urls
      FROM product_images pi WHERE pi.product_id = p.id
  ) img ON TRUE
  LEFT JOIN LATERAL (
    SELECT json_agg(json_build_object('variantId', pv.id, 'label', s.value_int, 'type', s.type, 'available', COALESCE(vs.available, 0)) ORDER BY s.sort_order) AS sizes
      FROM product_variants pv
      JOIN sizes s ON s.id = pv.size_id
      LEFT JOIN v_variant_stock vs ON vs.variant_id = pv.id
     WHERE pv.product_id = p.id
  ) sz ON TRUE`;

// Строка БД → JSON карточки (названия на обоих языках — клиент выбирает по текущему языку)
export function toCard(row) {
  const sizes = row.sizes || [];
  const inStock = sizes.filter((s) => s.available > 0);
  const totalAvailable = inStock.reduce((sum, s) => sum + s.available, 0);
  const price = Number(row.price_byn);
  const oldPrice = row.old_price_byn ? Number(row.old_price_byn) : null;
  return {
    id: row.id,
    sku: row.sku,
    modelCode: row.model_code,
    name: { ru: row.name_ru, en: row.name_en },
    description: row.description_ru !== undefined ? { ru: row.description_ru, en: row.description_en } : undefined,
    brand: { id: row.brand_id, name: row.brand_name, slug: row.brand_slug },
    category: { id: row.category_id, slug: row.category_slug, ru: row.category_ru, en: row.category_en },
    price,
    oldPrice,
    discount: oldPrice ? Math.round((1 - price / oldPrice) * 100) : 0,
    color: row.color,
    material: row.material,
    gender: row.gender,
    country: row.country_of_origin,
    collectionId: row.collection_id,
    isNew: row.is_new,
    isLimited: row.is_limited,
    isIconic: row.is_iconic,
    isAuthenticated: row.is_authenticated,
    rating: Number(row.rating_avg) || 0,
    reviewsCount: row.reviews_count || 0,
    images: row.images || [],
    sizes: sizes.map((s) => ({ variantId: s.variantId, label: s.label, type: s.type, available: s.available })),
    inStock: totalAvailable > 0,
    lastSize: sizes.length > 1 ? inStock.length === 1 : totalAvailable === 1,
  };
}

export default { CARD_SELECT, CARD_JOINS, toCard };
