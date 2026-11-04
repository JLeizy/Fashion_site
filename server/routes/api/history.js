// Истории брендов (раздел 7 ТЗ): тексты хранятся в БД — brand_history_sections (разделы), brand_timeline_events
// (интерактивная хронология), creative_directors (карточки директоров). Страницы /history/:slug и /histories.
import express from 'express';
import { param } from 'express-validator';
import { query } from '../../../db/pool.js';
import { validate } from '../../middleware/validate.js';
import { ApiError } from '../../lib/errors.js';
import { CARD_SELECT, CARD_JOINS, toCard } from '../../services/productCards.js';

const router = express.Router();

// Количество слов в тексте (для времени чтения: ~200 слов в минуту)
const words = (text) => (text ? String(text).trim().split(/\s+/).filter(Boolean).length : 0);

// ---------------------------------------------------------------------------------------------
// GET /api/histories — оглавление историй: 15 брендов с числом разделов, слов и событий хронологии (роль: любая)
// Таблицы: brands, brand_history_sections, brand_timeline_events, creative_directors (SELECT)
// ---------------------------------------------------------------------------------------------
router.get('/histories', async (req, res) => {
  // SQL: бренды и сводка по их историям
  const { rows } = await query(
    `SELECT b.id, b.name, b.slug, b.country, b.founded_year, b.founder, b.short_desc_ru, b.short_desc_en, b.hero_image, b.accent_color,
            (SELECT COUNT(*)::int FROM brand_history_sections s WHERE s.brand_id = b.id) AS sections,
            (SELECT COALESCE(SUM(array_length(regexp_split_to_array(trim(s.content_ru), '\\s+'), 1)), 0)::int FROM brand_history_sections s WHERE s.brand_id = b.id) AS words_ru,
            (SELECT COALESCE(SUM(array_length(regexp_split_to_array(trim(s.content_en), '\\s+'), 1)), 0)::int FROM brand_history_sections s WHERE s.brand_id = b.id AND s.content_en <> '') AS words_en,
            (SELECT COUNT(*)::int FROM brand_timeline_events e WHERE e.brand_id = b.id) AS events,
            (SELECT COUNT(*)::int FROM creative_directors d WHERE d.brand_id = b.id) AS directors
       FROM brands b ORDER BY b.sort_order, b.name`
  );
  res.json({
    histories: rows.map((b) => ({
      id: b.id, name: b.name, slug: b.slug, country: b.country, foundedYear: b.founded_year, founder: b.founder,
      shortDesc: { ru: b.short_desc_ru, en: b.short_desc_en }, hero: b.hero_image, accent: b.accent_color,
      sections: b.sections, words: { ru: b.words_ru, en: b.words_en }, readMinutes: { ru: Math.max(1, Math.round(b.words_ru / 200)), en: Math.max(1, Math.round(b.words_en / 200)) },
      events: b.events, directors: b.directors,
    })),
  });
});

// ---------------------------------------------------------------------------------------------
// GET /api/history/:slug — полная история бренда (роль: любая)
// Таблицы: brands, brand_history_sections, brand_timeline_events, creative_directors, products + каталог (культовые вещи) (SELECT)
// ---------------------------------------------------------------------------------------------
router.get('/history/:slug', validate([param('slug').isString().isLength({ max: 80 })]), async (req, res) => {
  // SQL: бренд по адресу
  const b = (await query('SELECT * FROM brands WHERE slug = $1', [req.valid.slug])).rows[0];
  if (!b) throw new ApiError(404, 'catalog.brandNotFound');
  const [sections, timeline, directors, iconic, all] = await Promise.all([
    // SQL: разделы истории по порядку
    query('SELECT id, sort_order, period, title_ru, title_en, content_ru, content_en, quote_ru, quote_en, quote_author, image FROM brand_history_sections WHERE brand_id = $1 ORDER BY sort_order, id', [b.id]),
    // SQL: события хронологии по годам
    query('SELECT id, year, title_ru, title_en, description_ru, description_en FROM brand_timeline_events WHERE brand_id = $1 ORDER BY year, id', [b.id]),
    // SQL: креативные директора по годам работы
    query('SELECT id, name, years_from, years_to, description_ru, description_en, key_collections_ru, key_collections_en, photo FROM creative_directors WHERE brand_id = $1 ORDER BY years_from, id', [b.id]),
    // SQL: культовые вещи бренда (только опубликованные)
    query(`SELECT ${CARD_SELECT} FROM products p ${CARD_JOINS} WHERE p.brand_id = $1 AND p.is_iconic AND p.moderation_status = 'approved' ORDER BY p.views_count DESC LIMIT 8`, [b.id]),
    // SQL: порядок брендов — для ссылок «Предыдущая / Следующая история»
    query('SELECT slug, name, accent_color FROM brands ORDER BY sort_order, name'),
  ]);
  const i = all.rows.findIndex((x) => x.slug === b.slug);
  const neighbour = (k) => {
    const n = all.rows[(i + k + all.rows.length) % all.rows.length];
    return { slug: n.slug, name: n.name, accent: n.accent_color };
  };
  const wRu = sections.rows.reduce((s, x) => s + words(x.content_ru), 0);
  const wEn = sections.rows.reduce((s, x) => s + words(x.content_en), 0);
  res.json({
    brand: { id: b.id, name: b.name, slug: b.slug, country: b.country, foundedYear: b.founded_year, founder: b.founder, shortDesc: { ru: b.short_desc_ru, en: b.short_desc_en }, hero: b.hero_image, accent: b.accent_color },
    words: { ru: wRu, en: wEn },
    readMinutes: { ru: Math.max(1, Math.round(wRu / 200)), en: Math.max(1, Math.round(wEn / 200)) },
    sections: sections.rows.map((s) => ({ id: s.id, period: s.period, title: { ru: s.title_ru, en: s.title_en }, content: { ru: s.content_ru, en: s.content_en }, quote: s.quote_ru || s.quote_en ? { ru: s.quote_ru, en: s.quote_en, author: s.quote_author } : null, image: s.image })),
    timeline: timeline.rows.map((e) => ({ id: e.id, year: e.year, title: { ru: e.title_ru, en: e.title_en }, description: { ru: e.description_ru, en: e.description_en } })),
    directors: directors.rows.map((d) => ({ id: d.id, name: d.name, from: d.years_from, to: d.years_to, description: { ru: d.description_ru, en: d.description_en }, collections: { ru: d.key_collections_ru, en: d.key_collections_en }, photo: d.photo })),
    iconic: iconic.rows.map(toCard),
    prev: neighbour(-1),
    next: neighbour(1),
  });
});

export default router;
