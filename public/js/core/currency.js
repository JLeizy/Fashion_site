// Валюты (раздел 13 ТЗ): цены хранятся в BYN, пересчёт в USD/EUR по курсам из currency_rates.
// Формат: 1 250,00 Br / $390.00 / 360,00 €. Все элементы с data-price пересчитываются сразу при смене валюты.
import { $$, setCookie } from './dom.js';

export const CURRENCIES = ['BYN', 'USD', 'EUR'];
let rates = { BYN: 1, USD: 3.2051, EUR: 3.4722 };
let current = CURRENCIES.includes(document.documentElement.dataset.currency) ? document.documentElement.dataset.currency : 'BYN';

const ruFormat = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const enFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NBSP = ' ';

export const getCurrency = () => current;
export const getRates = () => ({ ...rates });

export function setRates(next) {
  if (!next) return;
  for (const code of CURRENCIES) if (Number(next[code]) > 0) rates[code] = Number(next[code]);
  rates.BYN = 1;
}

// BYN → выбранная валюта
export const convert = (byn, code = current) => Number(byn) / (rates[code] || 1);
// выбранная валюта → BYN (для фильтра цены)
export const toByn = (amount, code = current) => Number(amount) * (rates[code] || 1);

export function formatMoney(amount, code = current) {
  if (code === 'USD') return `$${enFormat.format(amount)}`;
  if (code === 'EUR') return `${ruFormat.format(amount)}${NBSP}€`;
  return `${ruFormat.format(amount)}${NBSP}Br`;
}

export const formatPrice = (byn, code = current) => formatMoney(convert(byn, code), code);

// HTML цены, который пересчитывается при смене валюты
export const priceHtml = (byn, cls = '') => `<span class="${cls}" data-price="${Number(byn)}">${formatPrice(byn)}</span>`;

export function refreshPrices(root = document) {
  $$('[data-price]', root).forEach((el) => {
    el.textContent = formatPrice(Number(el.dataset.price));
  });
}

export function setCurrency(code) {
  if (!CURRENCIES.includes(code) || code === current) return;
  current = code;
  document.documentElement.dataset.currency = code;
  try {
    localStorage.setItem('amf:currency', code);
  } catch {
    /* не критично */
  }
  setCookie('amf_currency', code);
  refreshPrices(document);
  document.dispatchEvent(new CustomEvent('amf:currencychange', { detail: { currency: code } }));
}

export const onCurrencyChange = (fn) => document.addEventListener('amf:currencychange', fn);

export default { getCurrency, setCurrency, setRates, getRates, convert, toByn, formatPrice, formatMoney, priceHtml, refreshPrices, onCurrencyChange };
