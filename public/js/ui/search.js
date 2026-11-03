// Полноэкранный поиск (разделы 6.1 и 9 ТЗ): подсказки при вводе с debounce 300 мс, картинки товаров,
// подсветка совпадений, история поиска (localStorage), навигация стрелками, Enter — все результаты в каталоге.
import { $, $$, esc, debounce, highlight, storage, showAnimated } from '../core/dom.js';
import { t, loc, onLangChange } from '../core/i18n.js';
import { formatPrice } from '../core/currency.js';
import api from '../core/api.js';
import { stopScroll, startScroll } from './motion.js';
import { leaveTo } from './transitions.js';

const HISTORY_KEY = 'amf:search-history';
const MAX_HISTORY = 8;

export const getHistory = () => (Array.isArray(storage(HISTORY_KEY)) ? storage(HISTORY_KEY) : []);
export function pushHistory(q) {
  const value = String(q || '').trim();
  if (!value) return;
  storage(HISTORY_KEY, [value, ...getHistory().filter((h) => h.toLowerCase() !== value.toLowerCase())].slice(0, MAX_HISTORY));
}

export function initSearch() {
  const root = $('[data-search]');
  if (!root) return;
  const input = $('[data-search-input]', root);
  const form = $('[data-search-form]', root);
  const results = $('[data-search-results]', root);
  const intro = $('[data-search-intro]', root);
  const spinner = $('[data-search-spinner]', root);
  let lastFocus = null;
  let controller = null;
  let activeIndex = -1;
  let lastQuery = '';
  let lastData = null;

  const renderHistory = () => {
    const history = getHistory();
    const block = $('[data-search-history-block]', root);
    block.hidden = history.length === 0;
    $('[data-search-history]', root).innerHTML = history.map((h) => `<button type="button" class="chip" data-search-chip="${esc(h)}">${esc(h)}</button>`).join('');
  };

  const open = () => {
    lastFocus = document.activeElement;
    renderHistory();
    showAnimated(root);
    stopScroll();
    setTimeout(() => input.focus(), 120);
  };
  const close = () => {
    root.classList.remove('is-open');
    startScroll();
    setTimeout(() => {
      if (!root.classList.contains('is-open')) root.hidden = true;
    }, 800);
    lastFocus?.focus?.();
  };

  const goToCatalog = (q) => {
    pushHistory(q);
    close();
    leaveTo(`/catalog?q=${encodeURIComponent(q)}`);
  };

  const render = (data) => {
    lastData = data;
    activeIndex = -1;
    const q = data.q;
    if (!data.products.length && !data.brands.length && !data.categories.length) {
      results.innerHTML = `<div class="empty"><svg class="empty__orn icon--fill"><use href="#orn-cross"/></svg>
        <p class="empty__title">${esc(t('search.nothing', { q }))}</p><p class="empty__text">${esc(t('search.nothingHint'))}</p></div>`;
      results.hidden = false;
      intro.hidden = true;
      return;
    }
    results.innerHTML = `
      <div>
        <p class="search__group-title">${esc(t('search.products'))}</p>
        <div class="search__products">${data.products
          .map(
            (p) => `<a class="search-item" role="option" href="/product/${p.id}" data-search-option>
              <img src="${esc(p.image)}" alt="" loading="lazy">
              <span><span class="search-item__brand">${highlight(p.brand.name, q)}</span>
              <span class="search-item__name">${highlight(loc(p.name), q)}</span>
              <span class="search-item__price" data-price="${p.price}">${formatPrice(p.price)}</span></span></a>`
          )
          .join('')}</div>
        ${data.total > data.products.length ? `<a class="btn btn--ghost btn--sm search__all" href="/catalog?q=${encodeURIComponent(q)}" data-search-option>${esc(t('search.all', { n: data.total }))}</a>` : ''}
      </div>
      <div class="stack">
        ${data.brands.length ? `<div><p class="search__group-title">${esc(t('search.brands'))}</p>${data.brands.map((b) => `<a class="search-link" href="/brand/${esc(b.slug)}" data-search-option><span>${highlight(b.name, q)}</span><small>${b.foundedYear}</small></a>`).join('')}</div>` : ''}
        ${data.categories.length ? `<div><p class="search__group-title">${esc(t('search.categories'))}</p>${data.categories.map((c) => `<a class="search-link" href="/catalog?category=${esc(c.slug)}" data-search-option><span>${highlight(loc(c.name), q)}</span></a>`).join('')}</div>` : ''}
      </div>`;
    results.hidden = false;
    intro.hidden = true;
  };

  const run = debounce(async (q) => {
    if (controller) controller.abort();
    if (!q) {
      results.hidden = true;
      intro.hidden = false;
      spinner.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      return;
    }
    controller = new AbortController();
    spinner.hidden = false;
    try {
      const data = await api.get('/search/suggest', { q }, { signal: controller.signal });
      if (q === lastQuery) {
        render(data);
        input.setAttribute('aria-expanded', 'true');
      }
    } catch (err) {
      if (err.name !== 'AbortError') console.error(err);
    } finally {
      spinner.hidden = true;
    }
  }, 300);

  input.addEventListener('input', () => {
    lastQuery = input.value.trim();
    run(lastQuery);
  });

  input.addEventListener('keydown', (e) => {
    const options = $$('[data-search-option]', results);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!options.length) return;
      e.preventDefault();
      activeIndex = e.key === 'ArrowDown' ? (activeIndex + 1) % options.length : (activeIndex - 1 + options.length) % options.length;
      options.forEach((o, i) => o.classList.toggle('is-active', i === activeIndex));
      options[activeIndex].scrollIntoView({ block: 'nearest' });
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const options = $$('[data-search-option]', results);
    if (activeIndex >= 0 && options[activeIndex]) {
      pushHistory(input.value);
      close();
      leaveTo(options[activeIndex].href);
      return;
    }
    const q = input.value.trim();
    if (q) goToCatalog(q);
  });

  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-search-close]')) return close();
    const chip = e.target.closest('[data-search-chip]');
    if (chip) {
      input.value = chip.dataset.searchChip;
      lastQuery = input.value;
      run(lastQuery);
      input.focus();
      return;
    }
    if (e.target.closest('[data-search-history-clear]')) {
      storage(HISTORY_KEY, null);
      renderHistory();
      return;
    }
    if (e.target.closest('[data-search-option]')) pushHistory(input.value);
  });

  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-search-open]')) {
      e.preventDefault();
      open();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !root.hidden) close();
    // «/» или Ctrl+K — быстрый поиск
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
    if (!typing && root.hidden && (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'))) {
      e.preventDefault();
      open();
    }
  });
  onLangChange(() => {
    if (lastData && !results.hidden) render(lastData);
  });
}
