// Каталог (разделы 6.6 и 9 ТЗ): панель фильтров с количеством товаров, активные фильтры «чипсами»,
// сортировка, вид 2 / 3 / 4 колонки или список, пагинация + «Показать ещё», скелетоны, пустое состояние.
// Все параметры живут в URL (?brand=gucci,prada&category=sneakers&price_min=…): ссылкой можно поделиться,
// кнопки «назад / вперёд» работают. Фильтрация выполняется на сервере (GET /api/products).
import { $, $$, esc, icon, debounce, storage } from '../core/dom.js';
import { t, loc, onLangChange, countryName } from '../core/i18n.js';
import { getCurrency, getRates, formatMoney, onCurrencyChange, refreshPrices } from '../core/currency.js';
import api from '../core/api.js';
import { renderCard, skeletonCards, bindCardActions, colorVar } from './productCard.js';
import { openQuickView } from './quickView.js';
import { getCategories, getBrands } from './catalogCache.js';
import { initReveals, refreshScroll, scrollTo, stopScroll, startScroll } from './motion.js';

const LIST_KEYS = ['brand', 'category', 'collection', 'season', 'year', 'size', 'color', 'material', 'gender', 'country'];
const FLAG_KEYS = ['in_stock', 'new', 'sale', 'limited', 'iconic'];
const SORTS = ['popular', 'new', 'price_asc', 'price_desc', 'rating', 'discount', 'name'];
const SIZE_TYPES = ['clothing', 'shoes', 'ring', 'volume_ml', 'one_size'];
const LIMIT = 24;

function emptyState() {
  const s = { price_min: '', price_max: '', price_currency: '', rating: '', q: '', sort: '', page: 1 };
  LIST_KEYS.forEach((k) => (s[k] = []));
  FLAG_KEYS.forEach((k) => (s[k] = false));
  return s;
}

function readState() {
  const p = new URLSearchParams(location.search);
  const s = emptyState();
  LIST_KEYS.forEach((k) => (s[k] = (p.get(k) || '').split(',').map((v) => v.trim()).filter(Boolean)));
  FLAG_KEYS.forEach((k) => (s[k] = p.get(k) === '1'));
  s.price_min = p.get('price_min') || '';
  s.price_max = p.get('price_max') || '';
  s.price_currency = p.get('currency') || getCurrency();
  s.rating = p.get('rating') || '';
  s.q = p.get('q') || '';
  s.sort = SORTS.includes(p.get('sort')) ? p.get('sort') : '';
  s.page = Math.max(1, Number(p.get('page')) || 1);
  return s;
}

export function createCatalog(root, { fixed = {}, onResult = null, scrollOffset = -120 } = {}) {
  const els = {
    filters: $('[data-filters-body]', root),
    sheet: $('[data-filters]', root),
    grid: $('[data-grid]', root),
    chips: $('[data-active-chips]', root),
    sort: $('[data-sort]', root),
    count: $('[data-catalog-count]'),
    more: $('[data-load-more]', root),
    pagination: $('[data-pagination]', root),
    filtersCount: $('[data-filters-count]', root),
    sheetTotal: $('[data-sheet-total]', root),
  };
  let state = readState();
  let data = null;
  let seq = 0;
  let loadedPages = 1;
  let categories = [];
  let brands = [];
  const openGroups = new Set(storage('amf:filters-open') || ['category', 'brand', 'price', 'size', 'color', 'flags']);

  // ---------- URL ----------
  function toQuery({ forApi = false } = {}) {
    const q = {};
    LIST_KEYS.forEach((k) => {
      if (state[k].length) q[k] = state[k].join(',');
    });
    FLAG_KEYS.forEach((k) => {
      if (state[k]) q[k] = '1';
    });
    if (state.price_min !== '' || state.price_max !== '') {
      if (state.price_min !== '') q.price_min = state.price_min;
      if (state.price_max !== '') q.price_max = state.price_max;
      q.currency = state.price_currency || getCurrency();
    }
    if (state.rating) q.rating = state.rating;
    if (state.q) q.q = state.q;
    if (state.sort) q.sort = state.sort;
    if (state.page > 1) q.page = String(state.page);
    if (forApi) {
      Object.entries(fixed).forEach(([k, v]) => (q[k] = Array.isArray(v) ? v.join(',') : v));
      q.limit = LIMIT;
      q.facets = '1';
    }
    return q;
  }
  function pushUrl(replace = false) {
    const qs = new URLSearchParams(toQuery()).toString();
    const url = `${location.pathname}${qs ? `?${qs}` : ''}`;
    if (replace) history.replaceState(null, '', url);
    else history.pushState(null, '', url);
  }

  // ---------- Загрузка ----------
  async function load({ append = false, scroll = false } = {}) {
    const id = ++seq;
    root.classList.add('is-loading');
    if (!append) {
      els.grid.setAttribute('aria-busy', 'true');
      if (!data) els.grid.innerHTML = skeletonCards(12);
      else els.grid.classList.add('is-dim');
    }
    const query = toQuery({ forApi: true });
    if (append) query.page = String(state.page + loadedPages);
    try {
      const result = await api.get('/products', query);
      if (id !== seq) return;
      if (append) {
        loadedPages += 1;
        data.items = data.items.concat(result.items);
        data.facets = result.facets;
        els.grid.insertAdjacentHTML('beforeend', result.items.map((p) => renderCard(p, { variant: view() === 'list' ? 'row' : 'grid' })).join(''));
      } else {
        loadedPages = 1;
        data = result;
        renderGrid();
      }
      renderFilters();
      renderChips();
      renderPagination();
      renderCount();
      onResult?.(data, state);
      initReveals(els.grid);
      refreshScroll();
      if (scroll) scrollTo(els.grid, { offset: scrollOffset });
    } catch (err) {
      if (id !== seq) return;
      els.grid.innerHTML = `<div class="empty"><p class="empty__title">${esc(t('common.error'))}</p><p class="empty__text">${esc(err.message)}</p></div>`;
    } finally {
      if (id === seq) {
        root.classList.remove('is-loading');
        els.grid.classList.remove('is-dim');
        els.grid.removeAttribute('aria-busy');
      }
    }
  }

  const view = () => storage('amf:catalog-view') || '3';

  function renderGrid() {
    els.grid.dataset.cols = view();
    if (!data.items.length) {
      els.grid.innerHTML = `<div class="empty catalog__empty">
        <svg class="empty__orn icon--fill" aria-hidden="true"><use href="#orn-cross-filigree"/></svg>
        <p class="empty__title">${esc(t('catalog.emptyTitle'))}</p>
        <p class="empty__text">${esc(t('catalog.emptyText'))}</p>
        <button type="button" class="btn btn--sm" data-reset-all>${esc(t('catalog.resetAll'))}</button></div>`;
      return;
    }
    els.grid.innerHTML = data.items.map((p, i) => renderCard(p, { variant: view() === 'list' ? 'row' : 'grid', eager: i < 4 })).join('');
  }

  function renderCount() {
    if (!els.count || !data) return;
    els.count.textContent = t('catalog.found', { n: data.total });
    if (els.sheetTotal) els.sheetTotal.textContent = t('catalog.show', { n: data.total });
  }

  function renderPagination() {
    if (!els.pagination || !data) return;
    const current = state.page + loadedPages - 1;
    els.more.hidden = current >= data.pages;
    if (data.pages <= 1) {
      els.pagination.innerHTML = '';
      return;
    }
    const pages = new Set([1, data.pages, state.page, state.page - 1, state.page + 1, state.page + 2]);
    const sorted = [...pages].filter((n) => n >= 1 && n <= data.pages).sort((a, b) => a - b);
    let html = `<button type="button" data-page="${state.page - 1}" ${state.page <= 1 ? 'disabled' : ''} aria-label="${esc(t('catalog.prev'))}">${icon('i-chevron-left', 'icon icon--sm')}</button>`;
    sorted.forEach((n, i) => {
      if (i > 0 && n - sorted[i - 1] > 1) html += '<span class="t-muted">…</span>';
      const inRange = n >= state.page && n <= current;
      html += `<button type="button" data-page="${n}" ${inRange ? 'aria-current="page"' : ''}>${n}</button>`;
    });
    html += `<button type="button" data-page="${current + 1}" ${current >= data.pages ? 'disabled' : ''} aria-label="${esc(t('catalog.next'))}">${icon('i-chevron-right', 'icon icon--sm')}</button>`;
    els.pagination.innerHTML = html;
  }

  // ---------- Фильтры ----------
  const isChecked = (key, value) => state[key].includes(String(value));
  const opt = (key, value, label, n, extra = '') =>
    `<label class="check filter__opt ${n === 0 && !isChecked(key, value) ? 'is-empty' : ''}">
      <input type="checkbox" data-filter="${key}" value="${esc(value)}" ${isChecked(key, value) ? 'checked' : ''}>
      <span class="check__box"></span><span class="filter__label">${extra}${esc(label)}</span><span class="check__count">${n}</span></label>`;
  const group = (key, title, body, selected = 0) =>
    `<details class="filter" data-group="${key}" ${openGroups.has(key) ? 'open' : ''}>
      <summary class="filter__head"><span>${esc(title)}</span>${selected ? `<span class="filter__badge">${selected}</span>` : ''}<span class="filter__chevron">${icon('i-chevron-down', 'icon icon--xs')}</span></summary>
      <div class="filter__body">${body}</div></details>`;

  function categoryGroup(facets) {
    const counts = facets.categories || {};
    const rows = categories
      .map((root) => {
        const rootCount = root.children.reduce((sum, c) => sum + (counts[c.slug] || 0), 0);
        const expanded = root.children.some((c) => isChecked('category', c.slug)) || isChecked('category', root.slug);
        return `<li class="tree__item ${expanded ? 'is-open' : ''}">
          <div class="tree__row">
            ${opt('category', root.slug, loc(root.name), rootCount)}
            <button type="button" class="tree__toggle" data-tree-toggle aria-expanded="${expanded}" aria-label="${esc(loc(root.name))}">${icon('i-chevron-down', 'icon icon--xs')}</button>
          </div>
          <ul class="tree__children">${root.children.map((c) => `<li>${opt('category', c.slug, loc(c.name), counts[c.slug] || 0)}</li>`).join('')}</ul></li>`;
      })
      .join('');
    return group('category', t('filters.category'), `<ul class="tree">${rows}</ul>`, state.category.length);
  }

  function priceGroup(facets) {
    const rates = getRates();
    const cur = getCurrency();
    const min = Math.floor((facets.price.min || 0) / rates[cur]);
    const max = Math.ceil((facets.price.max || 0) / rates[cur]);
    const conv = (v) => (v === '' ? '' : Math.round((Number(v) * rates[state.price_currency || cur]) / rates[cur]));
    const lo = state.price_min !== '' ? conv(state.price_min) : min;
    const hi = state.price_max !== '' ? conv(state.price_max) : max;
    const step = Math.max(1, Math.round((max - min) / 200));
    const symbol = formatMoney(0, cur).replace(/[\d\s., ]/g, '');
    return group(
      'price',
      t('filters.price'),
      `<div class="price-filter" data-price-filter data-min="${min}" data-max="${max}">
        <div class="range" data-range>
          <div class="range__track"></div><div class="range__fill" data-range-fill></div>
          <input type="range" min="${min}" max="${max}" step="${step}" value="${Math.max(min, Math.min(lo, max))}" data-range-min aria-label="${esc(t('filters.priceFrom'))}">
          <input type="range" min="${min}" max="${max}" step="${step}" value="${Math.max(min, Math.min(hi, max))}" data-range-max aria-label="${esc(t('filters.priceTo'))}">
        </div>
        <div class="price-filter__inputs">
          <input class="input" inputmode="numeric" data-price-input="min" value="${state.price_min !== '' ? lo : ''}" placeholder="${min}" aria-label="${esc(t('filters.priceFrom'))}">
          <span>—</span>
          <input class="input" inputmode="numeric" data-price-input="max" value="${state.price_max !== '' ? hi : ''}" placeholder="${max}" aria-label="${esc(t('filters.priceTo'))}">
          <span class="t-mono">${esc(symbol)}</span>
        </div></div>`,
      state.price_min !== '' || state.price_max !== '' ? 1 : 0
    );
  }

  function sizeGroup(facets) {
    const byType = {};
    facets.sizes.forEach((s) => (byType[s.type] ||= []).push(s));
    const body = SIZE_TYPES.filter((type) => byType[type])
      .map(
        (type) => `<p class="filter__sub t-eyebrow">${esc(t(`filters.sizeTypes.${type}`))}</p>
        <div class="size-grid size-grid--filter">${byType[type]
          .map((s) => `<button type="button" class="size-btn" data-filter-toggle="size" data-value="${esc(s.value)}" aria-pressed="${isChecked('size', s.value)}" ${s.n === 0 && !isChecked('size', s.value) ? 'disabled' : ''} title="${s.n}">${esc(s.value)}</button>`)
          .join('')}</div>`
      )
      .join('');
    return body ? group('size', t('filters.size'), body, state.size.length) : '';
  }

  function colorGroup(facets) {
    const body = `<div class="swatches">${facets.colors
      .map(
        (c) => `<button type="button" class="swatch-btn" data-filter-toggle="color" data-value="${esc(c.value)}" aria-pressed="${isChecked('color', c.value)}" title="${esc(`${t(`colors.${c.value}`)} (${c.n})`)}" aria-label="${esc(t(`colors.${c.value}`))}">
          <span class="color-dot" style="--dot:${colorVar(c.value)}"></span><span class="swatch-btn__n t-mono">${c.n}</span></button>`
      )
      .join('')}</div>`;
    return group('color', t('filters.color'), body, state.color.length);
  }

  const listGroup = (key, title, items, labelFn) =>
    items.length ? group(key, title, `<div class="filter__list">${items.map((i) => opt(key, i.value, labelFn(i), i.n)).join('')}</div>`, state[key].length) : '';

  function chipsGroup(key, title, items, labelFn) {
    if (!items.length) return '';
    return group(
      key,
      title,
      `<div class="chips">${items
        .map((i) => `<button type="button" class="chip ${isChecked(key, i.value) ? 'chip--active' : ''}" data-filter-toggle="${key}" data-value="${esc(i.value)}" aria-pressed="${isChecked(key, i.value)}">${esc(labelFn(i))} <span class="t-mono t-muted">${i.n}</span></button>`)
        .join('')}</div>`,
      state[key].length
    );
  }

  function flagsGroup(facets) {
    const body = FLAG_KEYS.map(
      (k) => `<label class="switch filter__switch"><input type="checkbox" data-flag="${k}" ${state[k] ? 'checked' : ''}><span class="switch__track"></span>
        <span class="filter__label">${esc(t(`filters.flags.${k}`))}</span><span class="check__count">${facets.flags[k] ?? 0}</span></label>`
    ).join('');
    return group('flags', t('filters.flagsTitle'), `<div class="filter__list">${body}</div>`, FLAG_KEYS.filter((k) => state[k]).length);
  }

  function ratingGroup(facets) {
    const options = [
      ['', t('filters.ratingAny'), null],
      ['4', t('filters.ratingFrom', { n: 4 }), facets.ratings[4]],
      ['3', t('filters.ratingFrom', { n: 3 }), facets.ratings[3]],
      ['2', t('filters.ratingFrom', { n: 2 }), facets.ratings[2]],
    ];
    const body = options
      .map(
        ([value, label, n]) => `<label class="check filter__opt"><input type="radio" name="rating" data-rating value="${value}" ${state.rating === value ? 'checked' : ''}>
          <span class="check__box"></span><span class="filter__label">${value ? `<span class="stars" style="--value:${value}"></span> ` : ''}${esc(label)}</span>${n !== null ? `<span class="check__count">${n}</span>` : ''}</label>`
      )
      .join('');
    return group('rating', t('filters.rating'), `<div class="filter__list">${body}</div>`, state.rating ? 1 : 0);
  }

  function brandGroup(facets) {
    if (fixed.brand) return '';
    const body = `<input class="input input--sm filter__search" type="search" data-brand-search placeholder="${esc(t('filters.brandSearch'))}" aria-label="${esc(t('filters.brandSearch'))}">
      <div class="filter__list" data-brand-list>${facets.brands.map((b) => opt('brand', b.value, b.label, b.n)).join('')}</div>`;
    return group('brand', t('filters.brand'), body, state.brand.length);
  }

  function renderFilters() {
    if (!els.filters || !data?.facets) return;
    const f = data.facets;
    const focusKey = document.activeElement?.closest?.('[data-filters-body]') ? document.activeElement.dataset.value || document.activeElement.value : null;
    const scroll = els.filters.scrollTop;
    const showCollections = Boolean(fixed.brand || state.brand.length);
    els.filters.innerHTML = [
      categoryGroup(f),
      brandGroup(f),
      priceGroup(f),
      sizeGroup(f),
      colorGroup(f),
      showCollections ? listGroup('collection', t('filters.collection'), f.collections, (c) => `${c.label} · ${t(`seasons.${c.season}`)} ${c.year}`) : '',
      chipsGroup('season', t('filters.season'), f.seasons, (s) => t(`seasons.${s.value}`)),
      chipsGroup('year', t('filters.year'), f.years.map((y) => ({ ...y, value: String(y.value) })), (y) => y.value),
      listGroup('material', t('filters.material'), f.materials, (m) => t(`materials.${m.value}`)),
      listGroup('gender', t('filters.gender'), f.genders, (g) => t(`genders.${g.value}`)),
      listGroup('country', t('filters.country'), f.countries, (c) => countryName(c.value)),
      flagsGroup(f),
      ratingGroup(f),
    ].join('');
    els.filters.scrollTop = scroll;
    if (focusKey) $(`[value="${CSS.escape(focusKey)}"], [data-value="${CSS.escape(focusKey)}"]`, els.filters)?.focus({ preventScroll: true });
    updateRangeFill();
    const active = activeFilters().length;
    if (els.filtersCount) {
      els.filtersCount.textContent = active ? `(${active})` : '';
    }
  }

  function updateRangeFill() {
    const box = $('[data-price-filter]', els.filters);
    if (!box) return;
    const min = Number(box.dataset.min);
    const max = Number(box.dataset.max);
    const lo = Number($('[data-range-min]', box).value);
    const hi = Number($('[data-range-max]', box).value);
    const span = Math.max(1, max - min);
    const fill = $('[data-range-fill]', box);
    fill.style.left = `${((lo - min) / span) * 100}%`;
    fill.style.right = `${100 - ((hi - min) / span) * 100}%`;
  }

  // ---------- Активные фильтры (чипсы) ----------
  function activeFilters() {
    const items = [];
    const facets = data?.facets || {};
    const findCategory = (slug) => {
      for (const r of categories) {
        if (r.slug === slug) return loc(r.name);
        const c = r.children.find((x) => x.slug === slug);
        if (c) return loc(c.name);
      }
      return slug;
    };
    state.category.forEach((v) => items.push({ key: 'category', value: v, label: findCategory(v) }));
    state.brand.forEach((v) => items.push({ key: 'brand', value: v, label: brands.find((b) => b.slug === v)?.name || v }));
    state.collection.forEach((v) => items.push({ key: 'collection', value: v, label: facets.collections?.find((c) => String(c.value) === v)?.label || `#${v}` }));
    state.season.forEach((v) => items.push({ key: 'season', value: v, label: t(`seasons.${v}`) }));
    state.year.forEach((v) => items.push({ key: 'year', value: v, label: v }));
    state.size.forEach((v) => items.push({ key: 'size', value: v, label: `${t('filters.size')}: ${v}` }));
    state.color.forEach((v) => items.push({ key: 'color', value: v, label: t(`colors.${v}`) }));
    state.material.forEach((v) => items.push({ key: 'material', value: v, label: t(`materials.${v}`) }));
    state.gender.forEach((v) => items.push({ key: 'gender', value: v, label: t(`genders.${v}`) }));
    state.country.forEach((v) => items.push({ key: 'country', value: v, label: countryName(v) }));
    if (state.price_min !== '' || state.price_max !== '') {
      const cur = state.price_currency || getCurrency();
      const from = state.price_min !== '' ? formatMoney(Number(state.price_min), cur) : '…';
      const to = state.price_max !== '' ? formatMoney(Number(state.price_max), cur) : '…';
      items.push({ key: 'price', value: '', label: `${from} — ${to}` });
    }
    FLAG_KEYS.forEach((k) => state[k] && items.push({ key: k, value: '', label: t(`filters.flags.${k}`) }));
    if (state.rating) items.push({ key: 'rating', value: '', label: t('filters.ratingFrom', { n: state.rating }) });
    if (state.q) items.push({ key: 'q', value: '', label: `«${state.q}»` });
    return items;
  }

  function renderChips() {
    if (!els.chips) return;
    const items = activeFilters();
    els.chips.innerHTML = items.length
      ? `${items.map((i) => `<button type="button" class="chip chip--active" data-chip-remove="${esc(i.key)}" data-value="${esc(i.value)}">${esc(i.label)} ${icon('i-close', 'icon')}</button>`).join('')}
         <button type="button" class="chip" data-reset-all>${esc(t('catalog.resetAll'))}</button>`
      : '';
  }

  // ---------- Изменение фильтров ----------
  function apply({ scroll = false } = {}) {
    state.page = 1;
    pushUrl();
    load({ scroll });
  }
  const applyDebounced = debounce(() => apply(), 350);

  function toggleList(key, value) {
    const v = String(value);
    state[key] = state[key].includes(v) ? state[key].filter((x) => x !== v) : [...state[key], v];
    // Выбор корневой категории снимает её подкатегории (и наоборот)
    if (key === 'category') {
      const rootNode = categories.find((r) => r.slug === v);
      if (rootNode && state.category.includes(v)) state.category = state.category.filter((s) => !rootNode.children.some((c) => c.slug === s));
      const parent = categories.find((r) => r.children.some((c) => c.slug === v));
      if (parent && state.category.includes(v)) state.category = state.category.filter((s) => s !== parent.slug);
    }
  }

  root.addEventListener('change', (e) => {
    const input = e.target;
    if (input.matches('[data-filter]')) {
      toggleList(input.dataset.filter, input.value);
      applyDebounced();
    } else if (input.matches('[data-flag]')) {
      state[input.dataset.flag] = input.checked;
      applyDebounced();
    } else if (input.matches('[data-rating]')) {
      state.rating = input.value;
      applyDebounced();
    } else if (input.matches('[data-sort]')) {
      state.sort = input.value === 'popular' ? '' : input.value;
      apply();
    } else if (input.matches('[data-range-min], [data-range-max]')) {
      commitPrice();
    }
  });

  function commitPrice() {
    const box = $('[data-price-filter]', els.filters);
    if (!box) return;
    const min = Number(box.dataset.min);
    const max = Number(box.dataset.max);
    let lo = Number($('[data-range-min]', box).value);
    let hi = Number($('[data-range-max]', box).value);
    if (lo > hi) [lo, hi] = [hi, lo];
    state.price_min = lo > min ? String(lo) : '';
    state.price_max = hi < max ? String(hi) : '';
    state.price_currency = getCurrency();
    apply();
  }

  root.addEventListener('input', (e) => {
    const input = e.target;
    if (input.matches('[data-range-min], [data-range-max]')) {
      const box = input.closest('[data-price-filter]');
      const lo = $('[data-range-min]', box);
      const hi = $('[data-range-max]', box);
      if (Number(lo.value) > Number(hi.value)) (input === lo ? hi : lo).value = input.value;
      $('[data-price-input="min"]', box).value = lo.value;
      $('[data-price-input="max"]', box).value = hi.value;
      updateRangeFill();
    } else if (input.matches('[data-price-input]')) {
      priceTyped();
    } else if (input.matches('[data-brand-search]')) {
      const q = input.value.trim().toLowerCase();
      $$('[data-brand-list] .filter__opt', root).forEach((row) => {
        row.hidden = q && !row.textContent.toLowerCase().includes(q);
      });
    }
  });

  const priceTyped = debounce(() => {
    const box = $('[data-price-filter]', els.filters);
    if (!box) return;
    const lo = $('[data-price-input="min"]', box).value.replace(/[^\d]/g, '');
    const hi = $('[data-price-input="max"]', box).value.replace(/[^\d]/g, '');
    state.price_min = lo;
    state.price_max = hi;
    state.price_currency = getCurrency();
    apply();
  }, 700);

  root.addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-filter-toggle]');
    if (toggle) {
      toggleList(toggle.dataset.filterToggle, toggle.dataset.value);
      toggle.setAttribute('aria-pressed', String(isChecked(toggle.dataset.filterToggle, toggle.dataset.value)));
      applyDebounced();
      return;
    }
    const tree = e.target.closest('[data-tree-toggle]');
    if (tree) {
      const item = tree.closest('.tree__item');
      item.classList.toggle('is-open');
      tree.setAttribute('aria-expanded', String(item.classList.contains('is-open')));
      return;
    }
    const chip = e.target.closest('[data-chip-remove]');
    if (chip) {
      const key = chip.dataset.chipRemove;
      if (LIST_KEYS.includes(key)) state[key] = state[key].filter((v) => v !== chip.dataset.value);
      else if (FLAG_KEYS.includes(key)) state[key] = false;
      else if (key === 'price') {
        state.price_min = '';
        state.price_max = '';
      } else state[key] = '';
      apply();
      return;
    }
    if (e.target.closest('[data-reset-all]')) {
      // Сбрасываются фильтры; поисковый запрос остаётся (его убирает отдельный чипс)
      state = { ...emptyState(), q: state.q, sort: state.sort };
      apply({ scroll: true });
      return;
    }
    const page = e.target.closest('[data-page]');
    if (page && !page.disabled) {
      state.page = Number(page.dataset.page);
      pushUrl();
      load({ scroll: true });
      return;
    }
    if (e.target.closest('[data-load-more]')) {
      load({ append: true });
      return;
    }
    const viewBtn = e.target.closest('[data-view]');
    if (viewBtn) {
      storage('amf:catalog-view', viewBtn.dataset.view);
      $$('[data-view]', root).forEach((b) => b.setAttribute('aria-pressed', String(b === viewBtn)));
      if (data) {
        renderGrid();
        initReveals(els.grid);
        refreshScroll();
      }
      return;
    }
    if (e.target.closest('[data-filters-open]')) openSheet();
    if (e.target.closest('[data-filters-close]')) closeSheet();
  });

  // Запоминаем, какие группы фильтров раскрыты
  root.addEventListener(
    'toggle',
    (e) => {
      const details = e.target.closest?.('details[data-group]');
      if (!details) return;
      if (details.open) openGroups.add(details.dataset.group);
      else openGroups.delete(details.dataset.group);
      storage('amf:filters-open', [...openGroups]);
    },
    true
  );

  // ---------- Фильтры на телефоне: панель выезжает снизу ----------
  function openSheet() {
    els.sheet.classList.add('is-open');
    stopScroll();
  }
  function closeSheet() {
    els.sheet.classList.remove('is-open');
    startScroll();
  }

  // ---------- Навигация браузера, язык, валюта ----------
  window.addEventListener('popstate', () => {
    state = readState();
    syncToolbar();
    load();
  });
  onLangChange(() => {
    if (!data) return;
    renderGrid();
    renderFilters();
    renderChips();
    renderCount();
    initReveals(els.grid);
  });
  onCurrencyChange(() => {
    // Фильтр цены пересчитывается в новую валюту
    if (state.price_min !== '' || state.price_max !== '') {
      const rates = getRates();
      const from = state.price_currency || 'BYN';
      const to = getCurrency();
      const conv = (v) => (v === '' ? '' : String(Math.round((Number(v) * rates[from]) / rates[to])));
      state.price_min = conv(state.price_min);
      state.price_max = conv(state.price_max);
      state.price_currency = to;
      pushUrl(true);
    }
    renderFilters();
    renderChips();
    refreshPrices(root);
  });

  function syncToolbar() {
    if (els.sort) els.sort.value = state.sort || (state.q ? 'relevance' : 'popular');
    $$('[data-view]', root).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === view())));
  }

  bindCardActions({ onQuickView: (id) => openQuickView(id) });

  return {
    state: () => state,
    data: () => data,
    async init() {
      [categories, brands] = await Promise.all([getCategories(), getBrands()]);
      syncToolbar();
      await load();
    },
    reload: () => load(),
  };
}
