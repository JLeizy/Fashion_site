// Избранное /wishlist (раздел 4: покупатель): сетка карточек из GET /api/wishlist (таблица wishlist),
// сортировка на клиенте, удаление сердцем на карточке — карточка плавно исчезает, пустое состояние.
import { initApp } from '../app.js';
import { $, esc } from '../core/dom.js';
import { t, onLangChange } from '../core/i18n.js';
import api from '../core/api.js';
import { store } from '../core/store.js';
import { renderBreadcrumbs } from '../ui/breadcrumbs.js';
import { renderCard, bindCardActions } from '../ui/productCard.js';
import { openQuickView } from '../ui/quickView.js';
import { initReveals, refreshScroll } from '../ui/motion.js';

const app = await initApp();
bindCardActions({ onQuickView: (id) => openQuickView(id) });
const grid = $('[data-wish-grid]');
const sortSel = $('[data-wish-sort]');
let items = [];

const SORTS = {
  added: (a, b) => new Date(b.addedAt) - new Date(a.addedAt),
  price_asc: (a, b) => a.price - b.price,
  price_desc: (a, b) => b.price - a.price,
  brand: (a, b) => a.brand.name.localeCompare(b.brand.name) || a.price - b.price,
};

function render() {
  renderBreadcrumbs($('[data-breadcrumbs]'), [{ href: '/', label: t('nav.home') }, { label: t('header.wishlist') }]);
  $('[data-wish-count]').textContent = items.length ? t('wishlistPage.count', { n: items.length }) : '';
  sortSel.closest('label').hidden = items.length < 2;
  if (!items.length) {
    grid.innerHTML = `<div class="empty">
      <svg class="empty__orn icon--fill" aria-hidden="true"><use href="#orn-fleur"/></svg>
      <p class="empty__title">${esc(t('wishlistPage.emptyTitle'))}</p>
      <p class="empty__text">${esc(t('wishlistPage.emptyText'))}</p>
      <a class="btn" href="/catalog">${esc(t('nav.catalog'))}</a></div>`;
    return;
  }
  const sorted = [...items].sort(SORTS[sortSel.value] || SORTS.added);
  grid.innerHTML = sorted.map((p, i) => renderCard(p, { eager: i < 4 })).join('');
  initReveals(grid);
  refreshScroll();
}

sortSel.addEventListener('change', render);

// Снятие сердца на карточке убирает её из списка (с анимацией исчезновения)
store.on('wishlist:change', ({ productId, active }) => {
  if (active) return;
  const card = grid.querySelector(`[data-product-id="${productId}"]`);
  items = items.filter((p) => p.id !== productId);
  if (!card) return render();
  card.classList.add('is-leaving');
  setTimeout(render, 450);
});

try {
  ({ items } = await api.get('/wishlist'));
} catch (err) {
  grid.innerHTML = `<p class="notice notice--danger">${esc(err.message)}</p>`;
}
render();
await app.reveal();
onLangChange(render);
