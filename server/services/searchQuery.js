// Построение условия поиска по названию (RU/EN), бренду, категории и артикулу.
// Используется подсказками поиска и общим каталогом. Каждое слово запроса должно найтись
// хотя бы в одном из полей (ILIKE по trigram-индексам), а релевантность считается через
// полнотекстовый индекс products.search_vector (GIN) и trigram-похожесть названия.

// Слова запроса без служебных символов (буквы любых алфавитов, цифры, дефис, °)
export function searchWords(q) {
  return String(q || '')
    .toLowerCase()
    .normalize('NFC')
    .split(/[^\p{L}\p{N}°\-]+/u)
    .map((w) => w.replace(/^-+|-+$/g, ''))
    .filter((w) => w.length >= 1)
    .slice(0, 6);
}

// Экранирование % и _ для ILIKE
const likeEscape = (w) => w.replace(/[\\%_]/g, (ch) => `\\${ch}`);

// Возвращает { where, rank } — фрагменты SQL; значения добавляются в массив params ($n)
// Ожидаемые псевдонимы таблиц: p — products, b — brands, c — categories
export function buildSearch(q, params) {
  const words = searchWords(q);
  if (!words.length) return null;
  const conditions = words.map((word) => {
    params.push(`%${likeEscape(word)}%`);
    const n = params.length;
    return `(p.name_ru ILIKE $${n} OR p.name_en ILIKE $${n} OR p.sku ILIKE $${n} OR b.name ILIKE $${n} OR c.name_ru ILIKE $${n} OR c.name_en ILIKE $${n})`;
  });
  params.push(words.map((w) => `${w.replace(/[^\p{L}\p{N}]/gu, '')}:*`).filter((w) => w !== ':*').join(' & ') || 'a:*');
  const tsq = params.length;
  params.push(words.join(' '));
  const plain = params.length;
  return {
    where: conditions.join(' AND '),
    rank: `(ts_rank(p.search_vector, to_tsquery('simple', $${tsq})) * 2 + similarity(p.name_en, $${plain}) + similarity(b.name, $${plain}))`,
  };
}

export default { buildSearch, searchWords };
