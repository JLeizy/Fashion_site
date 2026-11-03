// Рендер HTML-страниц из папки views/.
// Страницы — обычные HTML5-файлы. Общие блоки (head, шапка, подвал, SVG-орнаменты) подключаются
// директивой <!-- @include partials/header.html -->, а значения подставляются через {{name}}
// (с экранированием HTML) или {{{name}}} (без экранирования — только для доверенной разметки сервера).
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../config/index.js';
import { ensureCsrfToken } from '../middleware/csrf.js';

const VIEWS_DIR = path.join(config.root, 'views');
const INCLUDE_RE = /<!--\s*@include\s+([\w./-]+)\s*-->/g;
const VAR_RE = /\{\{\{\s*(\w+)\s*\}\}\}|\{\{\s*(\w+)\s*\}\}/g;
const templateCache = new Map();

export const THEMES = ['amfibia', 'light', 'dark'];
export const CURRENCIES = ['BYN', 'USD', 'EUR'];

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

// Читает шаблон и рекурсивно раскрывает @include (в режиме разработки — без кэша, чтобы правки были видны сразу)
function loadTemplate(name, depth = 0) {
  if (depth > 8) throw new Error(`Слишком глубокая вложенность @include: ${name}`);
  const file = path.normalize(path.join(VIEWS_DIR, name));
  if (!file.startsWith(VIEWS_DIR)) throw new Error(`Недопустимый путь шаблона: ${name}`);
  if (!config.isDev && templateCache.has(file)) return templateCache.get(file);
  const html = fs.readFileSync(file, 'utf8').replace(INCLUDE_RE, (_, include) => loadTemplate(include, depth + 1));
  if (!config.isDev) templateCache.set(file, html);
  return html;
}

export function renderView(name, context = {}) {
  return loadTemplate(name).replace(VAR_RE, (_, raw, escaped) =>
    raw ? String(context[raw] ?? '') : escapeHtml(context[escaped])
  );
}

// Общий контекст каждой страницы: язык, тема, валюта, CSRF-токен, роль
export function pageContext(req, extra = {}) {
  const cookieTheme = req.cookies?.amf_theme;
  const cookieCurrency = req.cookies?.amf_currency;
  const theme = THEMES.includes(cookieTheme) ? cookieTheme : req.user?.preferred_theme || 'amfibia';
  const currency = CURRENCIES.includes(cookieCurrency) ? cookieCurrency : req.user?.preferred_currency || 'BYN';
  return {
    lang: req.lang || 'ru',
    theme,
    currency,
    csrf: ensureCsrfToken(req),
    role: req.user?.role || 'guest',
    page: '',
    brand: '',
    title: 'AMFIBIA',
    description:
      req.lang === 'en'
        ? 'AMFIBIA — marketplace of luxury fashion: Balenciaga, Gucci, Prada, Chrome Hearts, Maison Margiela and more.'
        : 'AMFIBIA — маркетплейс брендовой одежды: Balenciaga, Gucci, Prada, Chrome Hearts, Maison Margiela и другие.',
    year: new Date().getFullYear(),
    ...extra,
  };
}

export function renderPage(req, res, view, extra = {}, status = 200) {
  const html = renderView(view, pageContext(req, extra));
  res.status(status).type('html').set('Cache-Control', 'no-store').send(html);
}

export default { renderView, renderPage, pageContext, escapeHtml };
