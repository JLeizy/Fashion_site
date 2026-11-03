// Интернационализация (раздел 12 ТЗ): ru.json / en.json, атрибуты data-i18n в HTML,
// переключение языка без перезагрузки страницы, форматы дат и чисел через Intl.
import { $$, setCookie } from './dom.js';

const dictionaries = {};
let lang = document.documentElement.lang === 'en' ? 'en' : 'ru';
let dict = {};

export const getLang = () => lang;
export const locale = () => (lang === 'en' ? 'en-GB' : 'ru-RU');

function loadDict(code) {
  dictionaries[code] ||= fetch(`/i18n/${code}.json`, { credentials: 'same-origin' }).then((r) => {
    if (!r.ok) throw new Error(`i18n ${code}: ${r.status}`);
    return r.json();
  });
  return dictionaries[code];
}

// Перевод ключа. Поддерживаются подстановки {name} и множественное число: { one, few, many, other } + params.n
export function t(key, params = {}) {
  let value = key.split('.').reduce((obj, part) => (obj && obj[part] !== undefined ? obj[part] : undefined), dict);
  if (value && typeof value === 'object' && params.n !== undefined) {
    const rule = new Intl.PluralRules(lang).select(Number(params.n));
    value = value[rule] ?? value.other ?? value.many;
  }
  if (typeof value !== 'string') return key;
  return value.replace(/\{(\w+)\}/g, (_, name) => (params[name] !== undefined ? params[name] : `{${name}}`));
}

// Поле из БД вида { ru, en } → строка на текущем языке
export const loc = (field) => (field && typeof field === 'object' ? field[lang] || field.ru || field.en || '' : field || '');

// Применение переводов к разметке: data-i18n (текст), data-i18n-html (доверенная разметка словаря), data-i18n-attr="attr:key; attr2:key2"
export function applyTranslations(root = document) {
  $$('[data-i18n]', root).forEach((el) => {
    const value = t(el.dataset.i18n, el.dataset.i18nN ? { n: el.dataset.i18nN } : {});
    if (value !== el.dataset.i18n) el.textContent = value;
  });
  $$('[data-i18n-html]', root).forEach((el) => {
    const value = t(el.dataset.i18nHtml);
    if (value !== el.dataset.i18nHtml) el.innerHTML = value;
  });
  $$('[data-i18n-attr]', root).forEach((el) => {
    el.dataset.i18nAttr.split(';').forEach((pair) => {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      if (!attr || !key) return;
      const value = t(key);
      if (value !== key) el.setAttribute(attr, value);
    });
  });
}

export async function initI18n() {
  try {
    dict = await loadDict(lang);
  } catch (err) {
    console.error(err);
    dict = {};
  }
  applyTranslations(document);
}

// Смена языка без перезагрузки: словарь, атрибут lang, localStorage + cookie (сервер отдаёт ошибки на этом языке)
export async function setLang(next) {
  if (!['ru', 'en'].includes(next) || next === lang) return;
  dict = await loadDict(next);
  lang = next;
  document.documentElement.lang = next;
  try {
    localStorage.setItem('amf:lang', next);
  } catch {
    /* не критично */
  }
  setCookie('amf_lang', next);
  applyTranslations(document);
  document.dispatchEvent(new CustomEvent('amf:langchange', { detail: { lang: next } }));
}

export const onLangChange = (fn) => document.addEventListener('amf:langchange', fn);

// ---------- Форматы дат и чисел (зависят от языка) ----------
export function fmtDate(value, options = { day: 'numeric', month: 'long', year: 'numeric' }) {
  if (!value) return '';
  return new Intl.DateTimeFormat(locale(), options).format(new Date(value));
}
export const fmtDateTime = (value) => fmtDate(value, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const fmtShortDate = (value) => fmtDate(value, { day: '2-digit', month: '2-digit', year: 'numeric' });
export const fmtNumber = (value, options = {}) => new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'ru-RU', options).format(value);

export function fmtRelative(value) {
  const diff = (new Date(value).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' });
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  return fmtDate(value);
}

export function countryName(code) {
  if (!code) return '';
  try {
    return new Intl.DisplayNames([lang], { type: 'region' }).of(code) || code;
  } catch {
    return code;
  }
}

export default { t, loc, getLang, setLang, initI18n, applyTranslations, onLangChange, fmtDate, fmtDateTime, fmtNumber, fmtRelative, countryName };
