// Общие элементы кабинетов сотрудников (продавец, склад, курьер, поддержка; этап 13):
// подвкладки раздела, строка KPI, загрузка Chart.js и цвета графиков из CSS-переменных текущей темы,
// мини-состав заказа, «возраст» заказа, выбор файла изображений.
import { esc, icon } from '../core/dom.js';
import { t, loc, fmtNumber, fmtRelative } from '../core/i18n.js';
import { formatPrice } from '../core/currency.js';

// Подвкладки раздела: /account/<base>/<id> (или полный путь base, начинающийся с «/», например /admin/products).
// tabs: [{ id, label, count, icon }]
export function subtabs(base, tabs, active) {
  const prefix = base.startsWith('/') ? base : `/account/${base}`;
  const linkAttr = prefix.startsWith('/admin') ? 'data-adm-link' : 'data-acc-link';
  return `<nav class="stabs" aria-label="${esc(t('staff.sections'))}">
    ${tabs
      .map(
        (tab, i) => `<a class="stabs__tab ${tab.id === active ? 'is-active' : ''}" href="${prefix}${tab.id ? `/${tab.id}` : ''}" ${linkAttr} ${tab.id === active ? 'aria-current="page"' : ''}>
          <span class="stabs__n t-mono">${String(i + 1).padStart(2, '0')}</span>
          <span class="stabs__label">${tab.icon ? icon(tab.icon, 'icon icon--sm') : ''}${esc(tab.label)}</span>
          ${tab.count ? `<sup class="stabs__count t-mono">${fmtNumber(tab.count)}</sup>` : ''}
        </a>`
      )
      .join('')}
  </nav>`;
}

// Строка показателей. items: [{ label, value (HTML), hint, delta (число %), tone }]
export function kpis(items) {
  return `<ul class="kpis">${items
    .map(
      (k, i) => `<li class="kpi ${k.tone ? `kpi--${k.tone}` : ''}" data-reveal>
        <span class="kpi__n t-mono">${String(i + 1).padStart(2, '0')}</span>
        <span class="kpi__v">${k.value}</span>
        <span class="kpi__k t-mono">${esc(k.label)}</span>
        ${k.delta !== undefined && k.delta !== null && Number.isFinite(k.delta) ? `<span class="kpi__delta t-mono ${k.delta >= 0 ? 'is-up' : 'is-down'}">${k.delta >= 0 ? '▲' : '▼'} ${fmtNumber(Math.abs(k.delta), { maximumFractionDigits: 1 })} %</span>` : ''}
        ${k.hint ? `<span class="kpi__hint">${esc(k.hint)}</span>` : ''}
      </li>`
    )
    .join('')}</ul>`;
}

// Цена в BYN с автоматическим пересчётом при смене валюты (data-price → refreshPrices)
export const money = (byn, cls = '') => `<span class="${cls}" data-price="${Number(byn)}">${esc(formatPrice(byn))}</span>`;

// Изменение показателя к прошлому периоду, %
export const delta = (now, prev) => (prev > 0 ? ((now - prev) / prev) * 100 : null);

// Миниатюры позиций заказа
export function itemsStrip(items, max = 5) {
  return `<span class="istrip">${items
    .slice(0, max)
    .map((i) => `<img src="${esc(i.image || '')}" alt="${esc(loc(i.name))}" loading="lazy">`)
    .join('')}${items.length > max ? `<b class="t-mono">+${items.length - max}</b>` : ''}</span>`;
}

// Сколько времени заказ находится в текущем статусе — «5 ч назад»
export const since = (date) => (date ? fmtRelative(date) : '');

// ---------- Chart.js ----------
// Библиотека подключается один раз по требованию (UMD-сборка из node_modules → /vendor/chart)
let chartPromise = null;
export function loadChart() {
  if (window.Chart) return Promise.resolve(window.Chart);
  chartPromise ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = '/vendor/chart/chart.umd.min.js';
    s.onload = () => resolve(window.Chart);
    s.onerror = () => reject(new Error('Chart.js'));
    document.head.appendChild(s);
  });
  return chartPromise;
}

// Цвета графиков — из CSS-переменных темы (графики корректно выглядят во всех трёх темах)
export function chartTheme() {
  const css = getComputedStyle(document.documentElement);
  const v = (name) => css.getPropertyValue(name).trim();
  return {
    text: v('--text'),
    text2: v('--text-2'),
    text3: v('--text-3'),
    line: v('--line'),
    line2: v('--line-2'),
    accent: v('--accent-text'),
    accentBg: v('--accent'),
    silver: v('--silver'),
    surface: v('--surface'),
    success: v('--success'),
    warning: v('--warning'),
    danger: v('--danger'),
    mono: v('--font-mono'),
    body: v('--font-body'),
    display: v('--font-display'),
  };
}

// Общие настройки осей и подсказок в стиле сайта
export function chartDefaults(Chart, c) {
  Chart.defaults.color = c.text3;
  Chart.defaults.borderColor = c.line;
  Chart.defaults.font.family = c.mono;
  Chart.defaults.font.size = 11;
  Chart.defaults.plugins.legend.labels.boxWidth = 10;
  Chart.defaults.plugins.legend.labels.boxHeight = 10;
  Chart.defaults.plugins.tooltip.backgroundColor = c.surface;
  Chart.defaults.plugins.tooltip.titleColor = c.text;
  Chart.defaults.plugins.tooltip.bodyColor = c.text2;
  Chart.defaults.plugins.tooltip.borderColor = c.line2;
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.padding = 12;
  Chart.defaults.plugins.tooltip.cornerRadius = 2;
  Chart.defaults.animation.duration = document.documentElement.classList.contains('reduced-motion') ? 0 : 900;
}

// Палитра серий: акцент темы, серебро и приглушённые тона
export const seriesColors = (c) => [c.accent, c.silver, c.warning, c.success, c.text2, c.danger, c.text3, c.accentBg];

// Выбор файлов изображений (скрытый input) → Promise<File[]>
export function pickImages({ multiple = true } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.multiple = multiple;
    input.addEventListener('change', () => resolve([...input.files]));
    input.click();
  });
}
