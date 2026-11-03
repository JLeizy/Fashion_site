// Общие элементы разделов кабинета: статусы, пустые состояния, суммы заказа, пагинация.
import { esc, icon } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { formatMoney } from '../core/currency.js';

const STATUS_TONE = {
  created: 'info', confirmed: 'info', assembling: 'warn', assembled: 'warn', handed_to_delivery: 'info',
  in_transit: 'info', arrived: 'ok', delivered: 'ok', cancelled: 'bad', returned: 'muted',
  pending: 'warn', approved: 'ok', rejected: 'bad', open: 'warn', answered: 'ok', closed: 'muted', paid: 'ok', refunded: 'muted',
};

export const statusBadge = (status, label = t(`statuses.${status}`)) => `<span class="status status--${STATUS_TONE[status] || 'muted'}">${esc(label)}</span>`;

export const empty = ({ ornament = 'orn-cross-filigree', title, text = '', action = '' }) => `
  <div class="empty acc-empty">
    <svg class="empty__orn icon--fill" aria-hidden="true"><use href="#${ornament}"/></svg>
    <p class="empty__title">${esc(title)}</p>${text ? `<p class="empty__text">${esc(text)}</p>` : ''}${action}
  </div>`;

// Сумма заказа — в валюте оформления (курс зафиксирован в orders.exchange_rate)
export const orderMoney = (o) => esc(formatMoney(o.totalInCurrency, o.currency));

export function pager(page, pages, attr = 'data-page-go') {
  if (pages <= 1) return '';
  return `<nav class="pagination acc-pager">${Array.from({ length: pages }, (_, i) => `<button type="button" ${attr}="${i + 1}" ${i + 1 === page ? 'aria-current="page"' : ''}>${i + 1}</button>`).join('')}</nav>`;
}

export const loading = () => '<div class="skeleton acc-skeleton"></div><div class="skeleton acc-skeleton"></div>';

export const chevron = () => icon('i-arrow-right', 'icon icon--sm');
