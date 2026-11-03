// Плавающая панель сравнения внизу экрана со счётчиком (раздел 6.9 ТЗ).
import { $, esc } from '../core/dom.js';
import { store, compare } from '../core/store.js';
import api from '../core/api.js';

const thumbs = new Map(); // productId → url фото

async function render() {
  const bar = $('[data-compare-bar]');
  if (!bar) return;
  const ids = compare.ids();
  const onComparePage = document.body.dataset.page === 'compare';
  bar.hidden = ids.length === 0 || onComparePage;
  document.body.classList.toggle('has-compare-bar', !bar.hidden);
  if (bar.hidden) return;
  const missing = ids.filter((id) => !thumbs.has(id));
  if (missing.length) {
    try {
      const { products } = await api.get('/compare/products', { ids: missing.join(',') });
      products.forEach((p) => thumbs.set(p.id, p.images[0]));
    } catch {
      /* миниатюры не критичны */
    }
  }
  $('[data-compare-bar-items]', bar).innerHTML = ids
    .map((id) => (thumbs.get(id) ? `<a href="/product/${id}"><img src="${esc(thumbs.get(id))}" alt=""></a>` : ''))
    .join('');
  $('[data-compare-bar-count]', bar).textContent = ids.length;
}

export function initCompareBar() {
  render();
  store.on('compare:change', render);
  store.on('user', render);
  $('[data-compare-bar-clear]')?.addEventListener('click', () => compare.clear());
}
