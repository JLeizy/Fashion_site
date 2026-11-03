// Фильтрация каталога (раздел 9 ТЗ): параметры из URL → условия WHERE с плейсхолдерами $1, $2…
// Один и тот же построитель используется для списка товаров (один SQL-запрос) и для фасетов
// (количество товаров возле каждого значения фильтра: группа считается без собственного условия).
import { buildSearch } from './searchQuery.js';

export const SEASONS = ['SS', 'FW', 'Resort', 'Pre-Fall'];
export const GENDERS = ['men', 'women', 'unisex'];
export const CURRENCIES = ['BYN', 'USD', 'EUR'];

const list = (value) =>
  String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 60);
const num = (value) => (value === undefined || value === null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value));
const flag = (value) => value === '1' || value === 'true';

// Разбор параметров запроса (?brand=gucci,prada&category=sneakers&price_min=…)
export function parseFilters(q = {}) {
  return {
    brand: list(q.brand).filter((s) => /^[a-z0-9-]+$/.test(s)),
    category: list(q.category).filter((s) => /^[a-z0-9-]+$/.test(s)),
    collection: list(q.collection).map(Number).filter((n) => Number.isInteger(n) && n > 0),
    season: list(q.season).filter((s) => SEASONS.includes(s)),
    year: list(q.year).map(Number).filter((n) => Number.isInteger(n) && n > 1900 && n < 2100),
    priceMin: num(q.price_min),
    priceMax: num(q.price_max),
    currency: CURRENCIES.includes(q.currency) ? q.currency : 'BYN',
    size: list(q.size).map((s) => s.slice(0, 12)),
    color: list(q.color).filter((s) => /^[a-z]+$/.test(s)),
    material: list(q.material).filter((s) => /^[a-z0-9]+$/.test(s)),
    gender: list(q.gender).filter((g) => GENDERS.includes(g)),
    country: list(q.country).map((c) => c.toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c)),
    inStock: flag(q.in_stock),
    isNew: flag(q.new),
    sale: flag(q.sale),
    limited: flag(q.limited),
    iconic: flag(q.iconic),
    rating: num(q.rating),
    q: String(q.q || '').trim().slice(0, 80),
  };
}

// Общая часть FROM для списка и фасетов
// Таблицы: products (p), brands (b), categories (c), collections (col)
export const BASE_FROM = `
  FROM products p
  JOIN brands b      ON b.id = p.brand_id
  JOIN categories c  ON c.id = p.category_id
  LEFT JOIN collections col ON col.id = p.collection_id`;

// Условия WHERE. exclude — группа фильтра, которую не нужно учитывать (для подсчёта фасета этой группы)
export function buildWhere(f, params, rates = {}, exclude = null) {
  const add = (value) => {
    params.push(value);
    return `$${params.length}`;
  };
  const where = ["p.moderation_status = 'approved'"];

  if (f.brand.length && exclude !== 'brand') where.push(`b.slug = ANY(${add(f.brand)}::text[])`);
  if (f.category.length && exclude !== 'category') {
    // Корневая категория включает все свои подкатегории
    const ph = add(f.category);
    where.push(`(c.slug = ANY(${ph}::text[]) OR c.parent_id IN (SELECT id FROM categories WHERE slug = ANY(${ph}::text[])))`);
  }
  if (f.collection.length && exclude !== 'collection') where.push(`p.collection_id = ANY(${add(f.collection)}::int[])`);
  if (f.season.length && exclude !== 'season') where.push(`col.season = ANY(${add(f.season)}::text[])`);
  if (f.year.length && exclude !== 'year') where.push(`col.year = ANY(${add(f.year)}::int[])`);

  // Цена задаётся в выбранной валюте → переводим границы в BYN по курсу из currency_rates
  if (exclude !== 'price') {
    const rate = rates[f.currency] || 1;
    if (f.priceMin !== null) where.push(`p.price_byn >= ${add(Math.floor(f.priceMin * rate * 100) / 100)}`);
    if (f.priceMax !== null) where.push(`p.price_byn <= ${add(Math.ceil(f.priceMax * rate * 100) / 100)}`);
  }

  if (f.size.length && exclude !== 'size') {
    where.push(`EXISTS (SELECT 1 FROM product_variants pv JOIN sizes s ON s.id = pv.size_id
                         ${f.inStock ? 'JOIN v_variant_stock vs ON vs.variant_id = pv.id AND vs.available > 0' : ''}
                        WHERE pv.product_id = p.id AND s.value_int = ANY(${add(f.size)}::text[]))`);
  }
  if (f.color.length && exclude !== 'color') where.push(`p.color = ANY(${add(f.color)}::text[])`);
  if (f.material.length && exclude !== 'material') where.push(`p.material = ANY(${add(f.material)}::text[])`);
  if (f.gender.length && exclude !== 'gender') where.push(`p.gender = ANY(${add(f.gender)}::text[])`);
  if (f.country.length && exclude !== 'country') where.push(`p.country_of_origin = ANY(${add(f.country)}::text[])`);

  if (exclude !== 'flags') {
    if (f.inStock) where.push('EXISTS (SELECT 1 FROM v_variant_stock vs WHERE vs.product_id = p.id AND vs.available > 0)');
    if (f.isNew) where.push('p.is_new');
    if (f.sale) where.push('p.old_price_byn IS NOT NULL');
    if (f.limited) where.push('p.is_limited');
    if (f.iconic) where.push('p.is_iconic');
  }
  if (f.rating !== null && exclude !== 'rating') where.push(`p.rating_avg >= ${add(f.rating)}`);

  let rank = null;
  if (f.q && exclude !== 'q') {
    const search = buildSearch(f.q, params);
    if (search) {
      where.push(search.where);
      rank = search.rank;
    }
  }
  return { where: where.join('\n    AND '), rank };
}

// Сортировки (раздел 9 ТЗ): популярные, новые, дешёвые, дорогие, рейтинг, размер скидки, А–Я
export function orderBy(sort, lang, rank) {
  switch (sort) {
    case 'new':
      return 'p.created_at DESC, p.id DESC';
    case 'price_asc':
      return 'p.price_byn ASC, p.id';
    case 'price_desc':
      return 'p.price_byn DESC, p.id';
    case 'rating':
      return 'p.rating_avg DESC, p.reviews_count DESC, p.id';
    case 'discount':
      return 'COALESCE(1 - p.price_byn / NULLIF(p.old_price_byn, 0), 0) DESC, p.id';
    case 'name':
      return `lower(p.name_${lang === 'en' ? 'en' : 'ru'}) ASC, p.id`;
    case 'relevance':
      return rank ? `${rank} DESC, p.views_count DESC, p.id` : 'p.views_count DESC, p.id';
    default:
      return 'p.is_iconic DESC, p.views_count DESC, p.rating_avg DESC, p.id';
  }
}

export default { parseFilters, buildWhere, orderBy, BASE_FROM };
