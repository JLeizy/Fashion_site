// Карточка товара в списке (раздел 6.7 ТЗ): второе изображение при наведении, метки NEW / LIMITED / −20 % /
// «Последний размер» / Verified by Amfibia, избранное (анимация сердца), сравнение, быстрый просмотр,
// доступные размеры при наведении, бирка в стиле Margiela, лёгкий 3D-наклон.
import { $$, esc, icon } from '../core/dom.js';
import { t, loc } from '../core/i18n.js';
import { formatPrice } from '../core/currency.js';
import { store, wishlist, compare } from '../core/store.js';
import { toast } from './toast.js';

// «Номер линии» на бирке — отсылка к нумерации Margiela (1 — женская, 10 — мужская, 11 — аксессуары, 22 — обувь…)
const LINE_NUMBER = { clothing: { women: 1, men: 10, unisex: 14 }, shoes: 22, bags: 11, accessories: 11, jewelry: 12, fragrance: 3, home: 13 };
const CATEGORY_ROOT = {
  tshirts: 'clothing', hoodies: 'clothing', sweaters: 'clothing', shirts: 'clothing', jackets: 'clothing', coats: 'clothing',
  trousers: 'clothing', jeans: 'clothing', shorts: 'clothing', dresses: 'clothing', skirts: 'clothing', suits: 'clothing', underwear: 'clothing',
  sneakers: 'shoes', boots: 'shoes', heels: 'shoes', loafers: 'shoes', sandals: 'shoes',
  totes: 'bags', crossbody: 'bags', backpacks: 'bags', clutches: 'bags',
  belts: 'accessories', sunglasses: 'accessories', headwear: 'accessories', scarves: 'accessories', wallets: 'accessories', gloves: 'accessories', socks: 'accessories',
  rings: 'jewelry', chains: 'jewelry', bracelets: 'jewelry', earrings: 'jewelry', pendants: 'jewelry',
  'fragrance-men': 'fragrance', 'fragrance-women': 'fragrance', 'fragrance-unisex': 'fragrance',
  homeware: 'home',
};

export function lineNumber(product) {
  const root = CATEGORY_ROOT[product.category?.slug] || 'accessories';
  const value = LINE_NUMBER[root];
  return typeof value === 'object' ? value[product.gender] || 14 : value;
}

export const colorVar = (color) => `var(--c-${color || 'grey'})`;

export function labelsHtml(p) {
  const labels = [];
  if (p.isNew) labels.push(`<span class="label label--new">${esc(t('labels.new'))}</span>`);
  if (p.isLimited) labels.push(`<span class="label label--limited">${esc(t('labels.limited'))}</span>`);
  if (p.discount > 0) labels.push(`<span class="label label--sale">−${p.discount}%</span>`);
  if (p.lastSize && p.inStock) labels.push(`<span class="label label--last">${esc(t(p.sizes?.length > 1 ? 'labels.lastSize' : 'labels.lastItem'))}</span>`);
  if (p.isAuthenticated) labels.push(`<span class="label label--verified" title="${esc(t('labels.verified'))}">${icon('i-shield', 'icon')}<span class="label__text">${esc(t('labels.verified'))}</span></span>`);
  return labels.join('');
}

export function priceBlock(p) {
  return `<span class="${p.oldPrice ? 'is-sale' : ''}" data-price="${p.price}">${formatPrice(p.price)}</span>${p.oldPrice ? `<s data-price="${p.oldPrice}">${formatPrice(p.oldPrice)}</s>` : ''}`;
}

// HTML карточки. variant: 'grid' | 'row' (вид «список»)
export function renderCard(p, { variant = 'grid', eager = false } = {}) {
  const name = loc(p.name);
  const [main, alt] = p.images;
  const inWish = wishlist.has(p.id);
  const inCompare = compare.has(p.id);
  const sizes = (p.sizes || [])
    .slice(0, 12)
    .map((s) => `<span class="${s.available > 0 ? '' : 'is-out'}">${esc(s.label)}</span>`)
    .join('');
  const media = `
    <div class="p-card__media" data-tilt>
      <a class="p-card__link" href="/product/${p.id}" data-cursor-view tabindex="-1" aria-hidden="true">
        <img class="p-card__img--main" src="${esc(main)}" alt="${esc(`${p.brand.name} — ${name}`)}" width="800" height="1000" ${eager ? '' : 'loading="lazy"'} decoding="async">
        ${alt ? `<img class="p-card__img--alt" src="${esc(alt)}" alt="" width="800" height="1000" loading="lazy" decoding="async">` : ''}
      </a>
      <div class="p-card__labels">${labelsHtml(p)}</div>
      <div class="p-card__actions">
        <button type="button" class="p-card__action ${inWish ? 'is-active' : ''}" data-card-wish aria-pressed="${inWish}" aria-label="${esc(t('product.toWishlist'))}" title="${esc(t('product.toWishlist'))}">${icon('i-heart', 'icon heart-icon')}</button>
        <button type="button" class="p-card__action ${inCompare ? 'is-active' : ''}" data-card-compare aria-pressed="${inCompare}" aria-label="${esc(t('product.toCompare'))}" title="${esc(t('product.toCompare'))}">${icon('i-compare')}</button>
        <button type="button" class="p-card__action" data-card-quick aria-label="${esc(t('product.quickView'))}" title="${esc(t('product.quickView'))}">${icon('i-eye')}</button>
      </div>
      ${sizes ? `<div class="p-card__sizes" aria-hidden="true">${sizes}</div>` : ''}
      <span class="mm-tag" aria-hidden="true">N° <b>${lineNumber(p)}</b><br>${esc(p.sku.slice(-4))}</span>
    </div>`;
  const body = `
    <div class="p-card__body">
      <p class="p-card__brand">${esc(p.brand.name)}</p>
      <h3 class="p-card__name"><a href="/product/${p.id}">${esc(name)}</a></h3>
      <p class="p-card__price">${priceBlock(p)}</p>
      <div class="p-card__meta">
        ${p.reviewsCount ? `<span class="stars" style="--value:${p.rating}" aria-label="${esc(t('product.ratingAria', { rating: p.rating.toFixed(1) }))}"></span><span>(${p.reviewsCount})</span>` : ''}
        <span class="color-dot" style="--dot:${colorVar(p.color)}" title="${esc(t(`colors.${p.color}`))}"></span>
        ${p.inStock ? '' : `<span class="status status--muted">${esc(t('product.outOfStock'))}</span>`}
      </div>
      ${variant === 'row' ? `<p class="p-card__desc">${esc(loc(p.description))}</p>` : ''}
    </div>`;
  if (variant === 'row') {
    return `<article class="p-card p-card--row" data-product-id="${p.id}">${media}${body}
      <div class="p-card__side"><button type="button" class="btn btn--sm btn--ghost" data-card-quick>${esc(t('product.quickView'))}</button></div></article>`;
  }
  return `<article class="p-card" data-product-id="${p.id}">${media}${body}</article>`;
}

export const skeletonCards = (n = 8) =>
  Array.from({ length: n }, () => '<div class="skeleton-card" aria-hidden="true"><div class="skeleton"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line skeleton-line--short"></div></div>').join('');

// Состояние кнопок избранного / сравнения во всех карточках товара
function syncCardState(productId) {
  $$(`[data-product-id="${productId}"]`).forEach((card) => {
    const wishBtn = card.querySelector('[data-card-wish]');
    const cmpBtn = card.querySelector('[data-card-compare]');
    if (wishBtn) {
      wishBtn.classList.toggle('is-active', wishlist.has(productId));
      wishBtn.setAttribute('aria-pressed', String(wishlist.has(productId)));
    }
    if (cmpBtn) {
      cmpBtn.classList.toggle('is-active', compare.has(productId));
      cmpBtn.setAttribute('aria-pressed', String(compare.has(productId)));
    }
  });
}

let bound = false;
// Делегирование событий карточек на весь документ (один раз)
export function bindCardActions({ onQuickView } = {}) {
  if (bound) return;
  bound = true;
  document.addEventListener('click', async (e) => {
    const card = e.target.closest('[data-product-id]');
    if (!card) return;
    const id = Number(card.dataset.productId);
    const wishBtn = e.target.closest('[data-card-wish]');
    const cmpBtn = e.target.closest('[data-card-compare]');
    const quickBtn = e.target.closest('[data-card-quick]');
    if (!wishBtn && !cmpBtn && !quickBtn) return;
    e.preventDefault();
    try {
      if (wishBtn) {
        const active = await wishlist.toggle(id);
        if (active === null) return;
        const svg = wishBtn.querySelector('svg');
        svg.classList.remove('heart-pop');
        void svg.getBoundingClientRect();
        svg.classList.add('heart-pop');
        toast.success(t(active ? 'wishlist.added' : 'wishlist.removed'));
      } else if (cmpBtn) {
        const active = await compare.toggle(id);
        toast({ type: 'success', title: t(active ? 'compare.added' : 'compare.removed'), action: active ? { label: t('compare.open'), onClick: () => (location.href = '/compare') } : null });
      } else if (quickBtn) {
        onQuickView?.(id);
      }
    } catch (err) {
      toast.error(err.code === 'COMPARE_LIMIT' ? t('compare.limit', { max: 4 }) : err.message);
    }
  });
  store.on('wishlist:change', ({ productId }) => syncCardState(productId));
  store.on('compare:change', ({ ids }) => {
    const all = new Set([...ids, ...$$('[data-card-compare].is-active').map((b) => Number(b.closest('[data-product-id]').dataset.productId))]);
    all.forEach(syncCardState);
  });
}
