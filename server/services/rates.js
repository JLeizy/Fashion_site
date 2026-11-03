// Курсы валют (таблица currency_rates) с коротким кэшем в памяти.
// Кэш сбрасывается, когда владелец меняет курсы в админке (invalidateRates).
import { query } from '../../db/pool.js';

let cache = null;
let cachedAt = 0;
const TTL_MS = 60_000;

export async function getRates() {
  if (cache && Date.now() - cachedAt < TTL_MS) return cache;
  // SQL: курсы к BYN (currency_rates, только чтение)
  const { rows } = await query('SELECT code, rate_to_byn, updated_at FROM currency_rates ORDER BY id');
  cache = Object.fromEntries(rows.map((r) => [r.code, Number(r.rate_to_byn)]));
  cache.BYN = 1;
  cache.updatedAt = rows.reduce((max, r) => (r.updated_at > max ? r.updated_at : max), rows[0]?.updated_at || null);
  cachedAt = Date.now();
  return cache;
}

export function invalidateRates() {
  cache = null;
}

// Перевод суммы из валюты в BYN (фильтр цены в выбранной валюте → границы в BYN)
export async function toByn(amount, currency) {
  const rates = await getRates();
  return amount * (rates[currency] || 1);
}

export default { getRates, invalidateRates, toByn };
