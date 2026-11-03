// Кабинет → Вы смотрели: недавно просмотренные товары (таблица viewed_products). API: GET /api/account/viewed
import { esc } from '../core/dom.js';
import { t } from '../core/i18n.js';
import api from '../core/api.js';
import { renderCard, bindCardActions } from '../ui/productCard.js';
import { openQuickView } from '../ui/quickView.js';
import { empty, loading } from './common.js';

export async function render(view) {
  bindCardActions({ onQuickView: (id) => openQuickView(id) });
  view.innerHTML = loading();
  const { items } = await api.get('/account/viewed');
  view.innerHTML = items.length
    ? `<div class="catalog__grid" data-cols="3">${items.map((p) => renderCard(p)).join('')}</div>`
    : empty({ ornament: 'orn-cross', title: t('account.noViewed'), action: `<a class="btn" href="/catalog">${esc(t('account.toCatalog'))}</a>` });
}
