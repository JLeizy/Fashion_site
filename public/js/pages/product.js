// Страница товара /product/:id (раздел 6.8 ТЗ): галерея с лупой и полноэкранным просмотром, цвета модели,
// размеры с наличием, таблица размеров, количество, «В корзину» с полётом в иконку корзины, избранное,
// сравнение, аккордеоны, продавец, характеристики, отзывы с формой, «С этим покупают», «Похожие», «Вы смотрели».
// Данные: GET /api/products/:id, /api/products/:id/reviews, /api/products/:id/related; просмотр — POST /api/products/:id/view.
import { initApp } from '../app.js';
import { $, $$, esc, icon, storage, initials } from '../core/dom.js';
import { t, loc, onLangChange, fmtDate, countryName, fmtNumber } from '../core/i18n.js';
import api from '../core/api.js';
import { formatPrice, formatMoney, convert, getCurrency, CURRENCIES, onCurrencyChange, refreshPrices } from '../core/currency.js';
import { store, cart, wishlist, compare, isAuth, requireAuth } from '../core/store.js';
import { renderBreadcrumbs } from '../ui/breadcrumbs.js';
import { renderCard, labelsHtml, colorVar, lineNumber, bindCardActions } from '../ui/productCard.js';
import { openQuickView } from '../ui/quickView.js';
import { createGallery } from '../ui/gallery.js';
import { openSizeChart } from '../ui/sizeChart.js';
import { initAccordions } from '../ui/accordion.js';
import { initRail } from '../ui/rail.js';
import { flyToCart } from '../ui/flyToCart.js';
import { toast } from '../ui/toast.js';
import { withLoading, showApiError, clearErrors } from '../ui/forms.js';
import { initReveals, refreshScroll, scrollTo } from '../ui/motion.js';

const VIEWED_KEY = 'amf:viewed';
const productId = Number(document.body.dataset.productPage);
const app = await initApp();
initAccordions();
bindCardActions({ onQuickView: (id) => openQuickView(id) });

let product = null;
let selected = null; // выбранный вариант (размер)
let quantity = 1;
let related = null;
const reviewsState = { page: 1, sort: 'new', data: null };

// ---------- «Вы смотрели» у гостя: id в localStorage (у вошедшего — таблица viewed_products) ----------
function rememberViewed(id) {
  const list = (Array.isArray(storage(VIEWED_KEY)) ? storage(VIEWED_KEY) : []).filter((x) => x !== id);
  storage(VIEWED_KEY, [id, ...list].slice(0, 20));
}
const viewedIds = () => (Array.isArray(storage(VIEWED_KEY)) ? storage(VIEWED_KEY) : []);

// ---------- Информация о товаре ----------
const els = {
  pp: $('[data-pp]'),
  brand: $('[data-pp-brand]'),
  name: $('[data-pp-name]'),
  sku: $('[data-pp-sku]'),
  rating: $('[data-pp-rating]'),
  price: $('[data-pp-price]'),
  priceAlt: $('[data-pp-price-alt]'),
  labels: $('[data-pp-labels]'),
  colorsBlock: $('[data-pp-colors-block]'),
  colorLabel: $('[data-pp-color-label]'),
  colors: $('[data-pp-colors]'),
  sizesBlock: $('[data-pp-sizes-block]'),
  sizeLabel: $('[data-pp-size-label]'),
  sizes: $('[data-pp-sizes]'),
  stock: $('[data-pp-stock]'),
  qtyInput: $('[data-qty-input]'),
  add: $('[data-pp-add]'),
  wish: $('[data-pp-wish]'),
  cmp: $('[data-pp-compare]'),
  auth: $('[data-pp-auth]'),
  desc: $('[data-pp-desc]'),
  composition: $('[data-pp-composition]'),
  care: $('[data-pp-care]'),
  seller: $('[data-pp-seller]'),
  specs: $('[data-pp-specs]'),
  tag: $('[data-pp-tag]'),
  notice: $('[data-pp-notice]'),
  bgName: $('[data-pp-bgname]'),
  sticky: $('[data-pp-sticky]'),
};

const paragraphs = (text) =>
  String(text || '')
    .split(/\n{1,}/)
    .filter(Boolean)
    .map((p) => `<p>${esc(p)}</p>`)
    .join('');

function renderCrumbs() {
  const crumbs = [
    { href: '/', label: t('nav.home') },
    { href: '/catalog', label: t('nav.catalog') },
  ];
  if (product.parentCategory) crumbs.push({ href: `/catalog?category=${product.parentCategory.slug}`, label: loc(product.parentCategory.name) });
  crumbs.push({ href: `/catalog?category=${product.category.slug}`, label: loc(product.category.name) });
  crumbs.push({ label: loc(product.name) });
  renderBreadcrumbs($('[data-breadcrumbs]'), crumbs);
}

function renderPrice() {
  els.price.innerHTML = `
    <span class="pp-price__now ${product.oldPrice ? 'is-sale' : ''}" data-price="${product.price}">${formatPrice(product.price)}</span>
    ${product.oldPrice ? `<s class="pp-price__old" data-price="${product.oldPrice}">${formatPrice(product.oldPrice)}</s><span class="label label--sale">${esc(t('product.discount', { n: product.discount }))}</span>` : ''}`;
  // Цена в двух других валютах (раздел 6.8: «цена в выбранной валюте» + справочно остальные)
  const others = CURRENCIES.filter((c) => c !== getCurrency()).map((c) => formatMoney(convert(product.price, c), c));
  els.priceAlt.textContent = `${t('product.otherCurrencies')}: ${others.join(' · ')}`;
  $('[data-pp-sticky-price]').innerHTML = `<span data-price="${product.price}">${formatPrice(product.price)}</span>`;
}

function renderRatingLink() {
  els.rating.innerHTML = product.reviewsCount
    ? `<span class="stars" style="--value:${product.rating}" aria-hidden="true"></span><span>${product.rating.toFixed(1)}</span><span class="t-muted">${esc(t('product.reviewsCount', { n: product.reviewsCount }))}</span>`
    : `<span class="t-muted">${esc(t('product.noReviews'))}</span>`;
  els.rating.setAttribute('aria-label', product.reviewsCount ? t('product.ratingAria', { rating: product.rating.toFixed(1) }) : t('product.noReviews'));
}

function renderColors() {
  els.colorsBlock.hidden = product.colors.length < 2;
  els.colorLabel.textContent = `${t('product.color')}: ${t(`colors.${product.color}`)}`;
  els.colors.innerHTML = product.colors
    .map(
      (c) => `<a href="/product/${c.id}" class="pp-color ${c.current ? 'is-active' : ''}" ${c.current ? 'aria-current="true"' : ''} title="${esc(t(`colors.${c.color}`))}" aria-label="${esc(t(`colors.${c.color}`))}">
        ${c.image ? `<img src="${esc(c.image)}" alt="" loading="lazy">` : ''}<span class="color-dot" style="--dot:${colorVar(c.color)}"></span></a>`
    )
    .join('');
}

function renderSizes() {
  const oneSize = product.variants.length === 1 && product.variants[0].type === 'one_size';
  els.sizes.innerHTML = product.variants
    .map(
      (v) => `<button type="button" class="size-btn" role="radio" data-variant="${v.variantId}" aria-checked="${selected?.variantId === v.variantId}" aria-pressed="${selected?.variantId === v.variantId}" ${v.available > 0 ? '' : 'disabled'}
        title="${esc(v.available > 0 ? t('product.availableN', { n: v.available }) : t('product.outOfStock'))}">${esc(v.label)}${v.available > 0 && v.available <= 2 ? '<i class="size-btn__dot" aria-hidden="true"></i>' : ''}</button>`
    )
    .join('');
  $('[data-size-chart]').hidden = oneSize;
  els.sizeLabel.textContent = selected ? t('product.selectedSize', { size: selected.label }) : t('product.size');
  renderStock();
}

function renderStock() {
  const max = selected ? selected.available : 1;
  quantity = Math.max(1, Math.min(quantity, max || 1));
  els.qtyInput.value = String(quantity);
  els.qtyInput.max = String(max || 1);
  $('[data-qty="-1"]').disabled = quantity <= 1;
  $('[data-qty="1"]').disabled = !selected || quantity >= max;
  els.add.disabled = !product.inStock;
  $('.btn__label', els.add).textContent = product.inStock ? t('product.addToCart') : t('product.outOfStock');
  if (!product.inStock) {
    els.stock.innerHTML = `<span class="pp-stock__dot is-out"></span>${esc(t('product.outOfStock'))}`;
    return;
  }
  if (!selected) {
    els.stock.innerHTML = `<span class="pp-stock__dot"></span>${esc(t('product.chooseSize'))}`;
    return;
  }
  const n = selected.available;
  const text = n === 1 ? t('product.lastOne') : n <= 3 ? t('product.fewLeft', { n }) : t('product.availableN', { n });
  els.stock.innerHTML = `<span class="pp-stock__dot ${n <= 3 ? 'is-low' : 'is-ok'}"></span>${esc(text)}`;
}

function renderToggles() {
  const inWish = wishlist.has(product.id);
  const inCmp = compare.has(product.id);
  els.wish.classList.toggle('is-active', inWish);
  els.wish.setAttribute('aria-pressed', String(inWish));
  els.wish.setAttribute('aria-label', t(inWish ? 'product.removeFromWishlist' : 'product.toWishlist'));
  els.cmp.classList.toggle('is-active', inCmp);
  els.cmp.setAttribute('aria-pressed', String(inCmp));
  els.cmp.title = t(inCmp ? 'product.inCompare' : 'product.toCompare');
}

function renderSeller() {
  const s = product.seller;
  const official = s.name === 'Amfibia Official';
  const [first = '', last = ''] = s.name.split(' ');
  els.seller.innerHTML = `
    <p class="t-eyebrow">${esc(t('product.seller'))}</p>
    <div class="pp-seller__row">
      <span class="avatar pp-seller__avatar">${official ? icon('orn-cross', 'icon icon--fill') : esc(initials(first, last))}</span>
      <div>
        <p class="pp-seller__name">${esc(s.name)} ${official ? `<span class="pp-seller__badge t-mono">${esc(t('product.officialSeller'))}</span>` : ''}</p>
        <p class="pp-seller__meta t-mono">${esc(t('product.sellerSince', { date: fmtDate(s.since, { month: 'long', year: 'numeric' }) }))} · ${esc(t('product.sellerProducts', { n: s.products }))}${s.rating ? ` · ${esc(t('product.sellerRating'))} ${s.rating.toFixed(1)}` : ''}</p>
      </div>
    </div>`;
}

function renderSpecs() {
  const rows = [
    product.collection && [
      t('product.specCollection'),
      // Если в названии коллекции уже есть год (например, «Fall/Winter 2026»), сезон не дублируем
      String(product.collection.name).includes(String(product.collection.year))
        ? product.collection.name
        : `${product.collection.name} · ${t(`seasons.${product.collection.season}`)} ${product.collection.year}`,
    ],
    [t('product.specCategory'), [product.parentCategory && loc(product.parentCategory.name), loc(product.category.name)].filter(Boolean).join(' / ')],
    [t('product.specMaterial'), t(`materials.${product.material}`)],
    [t('product.specColor'), t(`colors.${product.color}`)],
    [t('product.specCountry'), countryName(product.country)],
    [t('product.specGender'), t(`genders.${product.gender}`)],
    [t('product.specSku'), product.sku],
    [t('product.specViews'), fmtNumber(product.views)],
  ].filter(Boolean);
  els.specs.innerHTML = rows
    .map(([k, v], i) => `<div class="pp-spec" data-reveal><dt><span class="t-mono">${String(i + 1).padStart(2, '0')}</span>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
    .join('');
  // Бирка в духе Maison Margiela: ряд цифр 0–23, обведён «номер линии»
  const line = lineNumber(product);
  const nums = Array.from({ length: 24 }, (_, n) => `<span class="${n === line ? 'is-on' : ''}">${n}</span>`).join('');
  els.tag.innerHTML = `
    <div class="pp-label-tag__nums t-mono">${nums}</div>
    <p class="pp-label-tag__brand b-title">${esc(product.brand.name)}</p>
    <p class="pp-label-tag__comp">${esc(loc(product.composition))}</p>
    <p class="pp-label-tag__sku t-mono">${esc(product.sku)} · ${esc(countryName(product.country))}</p>`;
}

function renderNotice() {
  if (product.moderationStatus === 'approved') {
    els.notice.hidden = true;
    return;
  }
  els.notice.hidden = false;
  els.notice.className = `pp-notice notice ${product.moderationStatus === 'rejected' ? 'notice--danger' : 'notice--accent'}`;
  els.notice.textContent =
    product.moderationStatus === 'rejected'
      ? t('product.rejectedNotice', { reason: product.rejectionReason || '—' })
      : t('product.pendingNotice', { status: product.moderationStatus });
}

function renderInfo() {
  document.title = `${product.brand.name} — ${loc(product.name)} — AMFIBIA`;
  renderCrumbs();
  els.bgName.textContent = product.brand.name;
  els.brand.textContent = product.brand.name;
  els.brand.href = `/brand/${product.brand.slug}`;
  els.name.textContent = loc(product.name);
  els.sku.textContent = `${t('product.sku')}: ${product.sku}`;
  els.labels.innerHTML = labelsHtml({ ...product, sizes: product.variants });
  els.auth.hidden = !product.isAuthenticated;
  els.desc.innerHTML = paragraphs(loc(product.description));
  els.composition.innerHTML = paragraphs(loc(product.composition));
  els.care.innerHTML = paragraphs(loc(product.care));
  $('[data-pp-sticky-name]').textContent = `${product.brand.name} — ${loc(product.name)}`;
  renderPrice();
  renderRatingLink();
  renderColors();
  renderSizes();
  renderToggles();
  renderSeller();
  renderSpecs();
  renderNotice();
}

// ---------- Действия ----------
function shakeSizes() {
  els.sizes.animate([{ transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(-4px)' }, { transform: 'none' }], { duration: 380, easing: 'ease-out' });
  els.stock.innerHTML = `<span class="pp-stock__dot is-low"></span>${esc(t('product.chooseSize'))}`;
  els.sizesBlock.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
}

async function addToCart(button) {
  if (!product.inStock) return;
  if (!selected) {
    shakeSizes();
    return;
  }
  await withLoading(button, async () => {
    try {
      const img = $('[data-gallery-main] .pp-gallery__slide img') || $('[data-gallery-main] img');
      await Promise.all([flyToCart(img), cart.add(selected.variantId, quantity)]);
      // Мини-корзина открывается сама (событие cart:added), тост — короткое подтверждение
      toast.success(t('product.addedToCart'), `${product.brand.name} — ${loc(product.name)} · ${selected.label} × ${quantity}`);
    } catch (err) {
      toast.error(t('cart.error'), err.message);
    }
  });
}

function bindActions() {
  els.sizes.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-variant]');
    if (!btn) return;
    selected = product.variants.find((v) => v.variantId === Number(btn.dataset.variant)) || null;
    renderSizes();
    $(`[data-variant="${selected.variantId}"]`, els.sizes)?.focus({ preventScroll: true });
  });
  // Стрелки внутри группы размеров (роль radiogroup)
  els.sizes.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const buttons = $$('[data-variant]:not([disabled])', els.sizes);
    const i = buttons.indexOf(document.activeElement);
    const next = buttons[(i + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length];
    next?.click();
    e.preventDefault();
  });
  $('[data-pp-qty]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-qty]');
    if (!b) return;
    if (!selected) return shakeSizes();
    quantity += Number(b.dataset.qty);
    renderStock();
  });
  els.qtyInput.addEventListener('change', () => {
    quantity = Math.max(1, Number(els.qtyInput.value) || 1);
    if (selected && quantity > selected.available) toast.info(t('cart.notEnough', { n: selected.available }));
    renderStock();
  });
  els.add.addEventListener('click', () => addToCart(els.add));
  $('[data-pp-sticky-add]').addEventListener('click', (e) => {
    if (!selected) {
      scrollTo(els.sizesBlock, { offset: -160 });
      setTimeout(shakeSizes, 500);
      return;
    }
    addToCart(e.currentTarget);
  });
  els.wish.addEventListener('click', async () => {
    try {
      const active = await wishlist.toggle(product.id);
      if (active === null) return;
      const svg = $('svg', els.wish);
      svg.classList.remove('heart-pop');
      void svg.getBoundingClientRect();
      svg.classList.add('heart-pop');
      toast.success(t(active ? 'wishlist.added' : 'wishlist.removed'));
    } catch (err) {
      toast.error(err.message);
    }
  });
  els.cmp.addEventListener('click', async () => {
    try {
      const active = await compare.toggle(product.id);
      toast({ type: 'success', title: t(active ? 'compare.added' : 'compare.removed'), action: active ? { label: t('compare.open'), onClick: () => (location.href = '/compare') } : null });
    } catch (err) {
      toast.error(err.code === 'COMPARE_LIMIT' ? t('compare.limit', { max: 4 }) : err.message);
    }
  });
  $('[data-size-chart]').addEventListener('click', () => openSizeChart(product, { selectedVariantId: selected?.variantId }));
  store.on('wishlist:change', ({ productId: id }) => id === product.id && renderToggles());
  store.on('compare:change', renderToggles);

  // Липкая панель покупки на телефоне: видна, когда основная кнопка «В корзину» осталась выше экрана.
  // Проверка по прокрутке (а не IntersectionObserver), чтобы срабатывать и при «прыжках» к якорям.
  let stickyShown = false;
  let ticking = false;
  const syncSticky = () => {
    ticking = false;
    const show = els.add.getBoundingClientRect().bottom < 0;
    if (show === stickyShown) return;
    stickyShown = show;
    els.sticky.classList.toggle('is-visible', show);
    document.body.classList.toggle('has-sticky-buy', show);
    els.sticky.setAttribute('aria-hidden', String(!show));
    $('[data-pp-sticky-add]').tabIndex = show ? 0 : -1;
  };
  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(syncSticky);
      }
    },
    { passive: true }
  );
  syncSticky();
}

// ---------- Отзывы ----------
const reviewsEls = {
  summary: $('[data-reviews-summary]'),
  list: $('[data-reviews-list]'),
  total: $('[data-reviews-total]'),
  pages: $('[data-reviews-pages]'),
  sort: $('[data-reviews-sort]'),
  formWrap: $('[data-review-form-wrap]'),
};

function renderReviewsSummary() {
  const total = Object.values(product.ratingDistribution).reduce((a, b) => a + b, 0);
  const bars = [5, 4, 3, 2, 1]
    .map((star) => {
      const n = product.ratingDistribution[star] || 0;
      const pct = total ? Math.round((n / total) * 100) : 0;
      return `<li class="rbar"><span class="rbar__label t-mono">${star} ${icon('i-star', 'icon icon--xs icon--fill')}</span>
        <span class="rbar__track"><span class="rbar__fill" style="transform:scaleX(${pct / 100})"></span></span><span class="rbar__n t-mono">${n}</span></li>`;
    })
    .join('');
  reviewsEls.summary.innerHTML = `
    <p class="t-eyebrow">${esc(t('reviews.average'))}</p>
    <p class="pp-reviews__avg">${total ? fmtNumber(product.rating, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—'}</p>
    <span class="stars stars--lg" style="--value:${product.rating}" aria-hidden="true"></span>
    <p class="t-mono t-muted">${esc(total ? t('reviews.basedOn', { n: total }) : t('product.noReviews'))}</p>
    <ol class="rbars">${bars}</ol>`;
}

function reviewItem(r) {
  const [first = '', last = ''] = r.author.split(' ');
  return `<li class="review" data-reveal>
    <div class="review__head">
      <span class="avatar avatar--sm">${r.avatar ? `<img src="${esc(r.avatar)}" alt="">` : esc(initials(first, last))}</span>
      <div class="review__who">
        <p class="review__author">${esc(r.author)}</p>
        <p class="review__date t-mono">${esc(fmtDate(r.createdAt))}</p>
      </div>
      <span class="stars" style="--value:${r.rating}" role="img" aria-label="${esc(t('product.ratingAria', { rating: r.rating }))}"></span>
    </div>
    <p class="review__text">${esc(r.text)}</p>
    <p class="review__meta t-mono">${r.verifiedPurchase ? `${icon('i-check', 'icon icon--xs')} ${esc(t('reviews.verified'))}` : ''}${r.size ? ` · ${esc(t('reviews.size', { size: r.size }))}` : ''}</p>
  </li>`;
}

function renderReviewForm(canReview) {
  const wrap = reviewsEls.formWrap;
  if (!canReview.allowed) {
    const text =
      canReview.reason === 'auth'
        ? t('reviews.loginToReview')
        : canReview.reason === 'exists'
          ? canReview.status === 'pending'
            ? t('reviews.existsPending')
            : t('reviews.exists')
          : t('reviews.notBought');
    wrap.innerHTML = `<div class="pp-review-form__note">${icon('orn-fleur', 'icon icon--fill')}<p>${esc(text)}</p>
      ${canReview.reason === 'auth' ? `<button type="button" class="btn btn--sm btn--ghost" data-review-login>${esc(t('reviews.login'))}</button>` : ''}</div>`;
    $('[data-review-login]', wrap)?.addEventListener('click', () => requireAuth('review'));
    return;
  }
  const stars = [1, 2, 3, 4, 5]
    .map(
      (n) => `<input type="radio" name="rating" id="rate-${n}" value="${n}"><label for="rate-${n}" title="${esc(t('reviews.star', { n }))}">${icon('i-star', 'icon icon--fill')}<span class="sr-only">${esc(t('reviews.star', { n }))}</span></label>`
    )
    .reverse()
    .join('');
  wrap.innerHTML = `
    <form class="review-form" novalidate data-review-form>
      <h3 class="review-form__title">${esc(t('reviews.writeTitle'))}</h3>
      <fieldset class="field">
        <legend class="field__label">${esc(t('reviews.yourRating'))}</legend>
        <div class="star-input">${stars}</div>
        <p class="field__error" data-error-for="rating" hidden></p>
      </fieldset>
      <div class="field">
        <label class="field__label" for="review-text">${esc(t('reviews.text'))}</label>
        <textarea class="textarea" id="review-text" name="text" rows="5" minlength="10" maxlength="2000" required></textarea>
        <p class="field__hint">${esc(t('reviews.textHint'))}</p>
        <p class="field__error" data-error-for="text" hidden></p>
      </div>
      <p class="notice notice--danger" data-form-error hidden></p>
      <button type="submit" class="btn">${esc(t('reviews.submit'))}</button>
    </form>`;
  const form = $('[data-review-form]', wrap);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    const rating = Number(form.elements.rating.value);
    const text = form.elements.text.value.trim();
    if (!rating) {
      showApiError(form, { status: 422, details: [{ field: 'rating', message: t('reviews.chooseRating') }] });
      return;
    }
    if (text.length < 10) {
      showApiError(form, { status: 422, details: [{ field: 'text', message: t('reviews.textHint') }] });
      return;
    }
    await withLoading($('[type="submit"]', form), async () => {
      try {
        await api.post(`/products/${product.id}/reviews`, { rating, text });
        toast.success(t('reviews.sent'));
        renderReviewForm({ allowed: false, reason: 'exists', status: 'pending' });
      } catch (err) {
        showApiError(form, err);
      }
    });
  });
}

async function loadReviews({ scroll = false } = {}) {
  reviewsEls.list.classList.add('is-dim');
  try {
    const data = await api.get(`/products/${product.id}/reviews`, { page: reviewsState.page, sort: reviewsState.sort, limit: 5 });
    reviewsState.data = data;
    renderReviews();
    if (scroll) scrollTo($('#reviews'), { offset: -100 });
  } catch (err) {
    reviewsEls.list.innerHTML = `<li class="notice notice--danger">${esc(err.message)}</li>`;
  } finally {
    reviewsEls.list.classList.remove('is-dim');
  }
}

function renderReviews() {
  const data = reviewsState.data;
  if (!data) return;
  renderReviewsSummary();
  reviewsEls.total.textContent = data.total ? t('product.reviewsCount', { n: data.total }) : '';
  reviewsEls.sort.closest('label').hidden = data.total < 2;
  reviewsEls.list.innerHTML = data.items.length
    ? data.items.map(reviewItem).join('')
    : `<li class="empty pp-reviews__empty">${icon('orn-cross-filigree', 'empty__orn icon--fill')}<p class="empty__text">${esc(t('reviews.empty'))}</p></li>`;
  reviewsEls.pages.innerHTML =
    data.pages > 1
      ? Array.from({ length: data.pages }, (_, i) => `<button type="button" data-review-page="${i + 1}" ${i + 1 === data.page ? 'aria-current="page"' : ''}>${i + 1}</button>`).join('')
      : '';
  renderReviewForm(data.canReview);
  initReveals(reviewsEls.list);
  refreshScroll();
}

reviewsEls.sort.addEventListener('change', () => {
  reviewsState.sort = reviewsEls.sort.value;
  reviewsState.page = 1;
  loadReviews();
});
reviewsEls.pages.addEventListener('click', (e) => {
  const b = e.target.closest('[data-review-page]');
  if (!b) return;
  reviewsState.page = Number(b.dataset.reviewPage);
  loadReviews({ scroll: true });
});

// ---------- Подборки ----------
const rails = {};
function renderRails() {
  if (!related) return;
  ['together', 'similar', 'viewed'].forEach((key) => {
    const section = $(`[data-rail="${key}"]`);
    const items = related[key] || [];
    section.hidden = items.length === 0;
    if (!items.length) return;
    $('[data-rail-track]', section).innerHTML = items.map((p) => `<div class="rail__item">${renderCard(p)}</div>`).join('');
    rails[key] ||= initRail(section);
    rails[key]?.update();
  });
  initReveals();
  refreshScroll();
}

async function loadRelated() {
  try {
    related = await api.get(`/products/${product.id}/related`, isAuth() ? {} : { viewed: viewedIds().join(',') });
    renderRails();
  } catch (err) {
    console.error(err);
  }
}

// ---------- Запуск ----------
async function main() {
  try {
    ({ product } = await api.get(`/products/${productId}`));
  } catch (err) {
    els.pp.innerHTML = `<div class="empty"><p class="empty__title">${esc(t('common.error'))}</p><p class="empty__text">${esc(err.message)}</p><a class="btn" href="/catalog">${esc(t('nav.catalog'))}</a></div>`;
    await app.reveal();
    return;
  }
  // Единственный доступный размер выбирается автоматически; параметр ?size=<variantId> — из корзины/ссылки
  const fromUrl = Number(new URLSearchParams(location.search).get('size'));
  const available = product.variants.filter((v) => v.available > 0);
  selected = product.variants.find((v) => v.variantId === fromUrl && v.available > 0) || (available.length === 1 ? available[0] : null);

  createGallery($('[data-gallery]'), { images: product.images, alt: `${product.brand.name} — ${loc(product.name)}` });
  renderInfo();
  bindActions();
  els.pp.removeAttribute('aria-busy');

  rememberViewed(product.id);
  api.post(`/products/${product.id}/view`).catch(() => {});

  await Promise.all([loadReviews(), loadRelated()]);
  await app.reveal();

  onLangChange(() => {
    renderInfo();
    renderReviews();
    renderRails();
  });
  onCurrencyChange(() => {
    renderPrice();
    refreshPrices();
  });
}

main();
