// Страница корзины /cart (раздел 6.10 ТЗ): список (фото, название, смена размера, количество +/−, цена),
// удаление с анимацией и кнопкой «Отменить» 5 секунд, проверка остатка, промокод, итог в выбранной валюте,
// шкала бесплатной доставки, пустая корзина с рекомендациями.
// Данные: авторизованный — /api/cart (carts, cart_items), гость — localStorage + POST /api/cart/preview.
import { initApp } from '../app.js';
import { $, $$, esc, icon } from '../core/dom.js';
import { t, loc, onLangChange } from '../core/i18n.js';
import api from '../core/api.js';
import { formatPrice, onCurrencyChange } from '../core/currency.js';
import { store, cart, isAuth, requireAuth } from '../core/store.js';
import { renderBreadcrumbs } from '../ui/breadcrumbs.js';
import { renderCard, bindCardActions } from '../ui/productCard.js';
import { openQuickView } from '../ui/quickView.js';
import { initRail } from '../ui/rail.js';
import { emptyStateHtml } from '../ui/emptyState.js';
import { toast } from '../ui/toast.js';
import { confirmModal } from '../ui/modal.js';
import { withLoading } from '../ui/forms.js';
import { initReveals, refreshScroll } from '../ui/motion.js';

const app = await initApp();
bindCardActions({ onQuickView: (id) => openQuickView(id) });
const FREE_FROM = app.me?.shop?.freeDeliveryFromByn ?? 3000;

const els = {
  items: $('[data-cart-items]'),
  summary: $('[data-cart-summary]'),
  tools: $('[data-cart-tools]'),
  count: $('[data-cart-count]'),
  free: $('[data-free-delivery]'),
  promoForm: $('[data-promo-form]'),
  promoInput: $('#promo-code'),
  promoApplied: $('[data-promo-applied]'),
  promoError: $('[data-promo-error]'),
};
let promo = null; // { code, percent }
let busy = false;
let recommendLoaded = false;

renderBreadcrumbs($('[data-breadcrumbs]'), [{ href: '/', label: t('nav.home') }, { label: t('cart.title') }]);

// ---------- Позиции ----------
const key = (item) => (item.id ? `i${item.id}` : `v${item.variantId}`);

function itemHtml(item) {
  const name = loc(item.name);
  const max = Math.min(item.available, 20);
  const sizeSelect =
    item.sizes.length > 1
      ? `<label class="citem__size"><span class="sr-only">${esc(t('cartPage.sizeLabel'))}</span>
          <select class="select select--sm" data-size="${key(item)}">${item.sizes
            .map((s) => `<option value="${s.variantId}" ${s.variantId === item.variantId ? 'selected' : ''} ${s.available > 0 || s.variantId === item.variantId ? '' : 'disabled'}>${esc(s.label)}${s.available > 0 ? '' : ` — ${esc(t('cart.unavailable'))}`}</option>`)
            .join('')}</select></label>`
      : `<span class="citem__size-one t-mono">${esc(t('cartPage.sizeLabel'))}: ${esc(item.size)}</span>`;
  return `<li class="citem ${item.isAvailable ? '' : 'is-unavailable'}" data-item="${key(item)}">
    <a class="citem__media" href="/product/${item.productId}?size=${item.variantId}" aria-label="${esc(t('cartPage.toProduct'))}"><img src="${esc(item.image)}" alt="" loading="lazy"></a>
    <div class="citem__body">
      <p class="citem__brand t-mono">${esc(item.brand.name)}</p>
      <a class="citem__name" href="/product/${item.productId}">${esc(name)}</a>
      <p class="citem__sku t-mono">${esc(t('cartPage.sku', { sku: item.skuVariant || item.sku }))}</p>
      <div class="citem__opts">
        ${sizeSelect}
        <div class="qty citem__qty" role="group" aria-label="${esc(t('cartPage.qty'))}">
          <button type="button" data-qty="-1" data-for="${key(item)}" ${item.quantity <= 1 ? 'disabled' : ''} aria-label="−">${icon('i-minus', 'icon icon--sm')}</button>
          <span class="t-mono" aria-live="polite">${item.quantity}</span>
          <button type="button" data-qty="1" data-for="${key(item)}" ${item.quantity >= max ? 'disabled' : ''} aria-label="+">${icon('i-plus', 'icon icon--sm')}</button>
        </div>
      </div>
      ${item.isAvailable ? (item.available <= 3 ? `<p class="citem__warn t-mono">${esc(t('product.fewLeft', { n: item.available }))}</p>` : '') : `<p class="citem__warn is-bad t-mono">${esc(t('cart.unavailable'))}</p>`}
    </div>
    <div class="citem__side">
      <p class="citem__total t-mono"><span data-price="${item.price * item.quantity}">${formatPrice(item.price * item.quantity)}</span></p>
      ${item.quantity > 1 ? `<p class="citem__each t-mono">${esc(t('cartPage.each', { price: formatPrice(item.price) }))}</p>` : ''}
      ${item.oldPrice ? `<s class="citem__old t-mono">${formatPrice(item.oldPrice * item.quantity)}</s>` : ''}
      <button type="button" class="citem__remove link-u t-mono" data-remove="${key(item)}">${icon('i-trash', 'icon icon--xs')} ${esc(t('cart.remove'))}</button>
    </div>
  </li>`;
}

function render() {
  const data = cart.data;
  if (!data) return;
  const items = data.items;
  els.count.textContent = items.length ? t('cartPage.itemsCount', { n: data.count }) : '';
  els.summary.hidden = !items.length;
  els.tools.hidden = !items.length;
  els.free.hidden = !items.length;
  els.items.closest('.cart')?.classList.toggle('is-empty', !items.length);
  if (!items.length) {
    els.items.innerHTML = `<li class="cart__empty">${emptyStateHtml({ title: t('cart.emptyTitle'), text: t('cart.emptyText'), cta: { href: '/catalog?new=1&sort=new', label: t('cart.emptyCta') } })}</li>`;
    loadRecommendations();
    return;
  }
  els.items.innerHTML = items.map(itemHtml).join('');
  renderSummary();
  loadRecommendations();
}

function renderSummary() {
  const data = cart.data;
  const subtotal = data.subtotal;
  const discount = promo ? Math.round(subtotal * promo.percent) / 100 : 0;
  const total = Math.max(0, subtotal - discount);
  $('[data-sum-subtotal]').innerHTML = `<span data-price="${subtotal}">${formatPrice(subtotal)}</span>`;
  $('[data-sum-discount-row]').hidden = !promo;
  if (promo) {
    $('[data-sum-discount-label]').textContent = t('cartPage.discount', { percent: promo.percent });
    $('[data-sum-discount]').innerHTML = `−<span data-price="${discount}">${formatPrice(discount)}</span>`;
  }
  $('[data-sum-total]').innerHTML = `<span data-price="${total}">${formatPrice(total)}</span>`;
  const unavailable = data.items.some((i) => !i.isAvailable);
  $('[data-sum-note]').textContent = unavailable ? t('cartPage.unavailableNote') : t('cart.deliveryNote');
  $('[data-checkout]').disabled = subtotal <= 0;
  // Шкала бесплатной доставки (порог — config.shop.freeDeliveryFromByn)
  const left = Math.max(0, FREE_FROM - total);
  $('[data-free-text]').innerHTML = left > 0 ? esc(t('cartPage.freeLeft', { sum: formatPrice(left) })) : `${icon('i-check', 'icon icon--xs')} ${esc(t('cartPage.freeDone'))}`;
  $('[data-free-bar]').style.transform = `scaleX(${Math.min(1, total / FREE_FROM)})`;
  els.free.classList.toggle('is-done', left <= 0);
  // Промокод
  els.promoApplied.hidden = !promo;
  if (promo) {
    els.promoApplied.innerHTML = `${icon('i-check', 'icon icon--xs')} ${esc(t('cartPage.promoApplied', { code: promo.code, percent: promo.percent }))} <button type="button" class="link-u" data-promo-remove>${esc(t('cartPage.removePromo'))}</button>`;
  }
}

const findItem = (k) => cart.data?.items.find((i) => key(i) === k);

async function run(fn) {
  if (busy) return;
  busy = true;
  els.items.classList.add('is-busy');
  try {
    await fn();
  } catch (err) {
    toast.error(t('cart.error'), err.message);
    render();
  } finally {
    busy = false;
    els.items.classList.remove('is-busy');
  }
}

// Удаление: строка схлопывается, в тосте — «Отменить» на 5 секунд
async function removeItem(k) {
  const item = findItem(k);
  const row = $(`[data-item="${k}"]`, els.items);
  if (!item || !row) return;
  row.style.height = `${row.offsetHeight}px`;
  row.classList.add('is-removing');
  await new Promise((r) => setTimeout(r, 420));
  await run(async () => {
    await cart.remove(item);
    toast({
      type: 'info',
      title: t('cartPage.removedUndo'),
      text: `${item.brand.name} — ${loc(item.name)}`,
      duration: 5000,
      action: { label: t('common.undo'), onClick: () => run(() => cart.restore(item)) },
    });
  });
}

els.items.addEventListener('click', (e) => {
  const qtyBtn = e.target.closest('[data-qty]');
  if (qtyBtn) {
    const item = findItem(qtyBtn.dataset.for);
    if (!item) return;
    const next = item.quantity + Number(qtyBtn.dataset.qty);
    if (next < 1) return;
    if (next > item.available) return toast.info(t('cartPage.maxReached'), t('cart.notEnough', { n: item.available }));
    run(() => cart.update(item, { quantity: next }));
    return;
  }
  const rm = e.target.closest('[data-remove]');
  if (rm) removeItem(rm.dataset.remove);
});
els.items.addEventListener('change', (e) => {
  const sel = e.target.closest('[data-size]');
  if (!sel) return;
  const item = findItem(sel.dataset.size);
  if (item) run(() => cart.update(item, { variantId: Number(sel.value) }));
});

$('[data-cart-clear]').addEventListener('click', async () => {
  const ok = await confirmModal({ title: t('cartPage.clear'), text: t('cartPage.clearConfirm'), confirmLabel: t('common.delete'), danger: true });
  if (!ok) return;
  run(async () => {
    for (const item of [...cart.data.items]) await cart.remove(item);
  });
});

// ---------- Промокод (сессия; проверка — promo_codes) ----------
els.promoForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  els.promoError.hidden = true;
  const code = els.promoInput.value.trim();
  if (!code) return;
  await withLoading($('[type="submit"]', els.promoForm), async () => {
    try {
      const res = await api.post('/cart/promo', { code });
      promo = res.promo;
      els.promoInput.value = '';
      toast.success(res.message);
      renderSummary();
    } catch (err) {
      els.promoError.textContent = err.details?.[0]?.message || err.message;
      els.promoError.hidden = false;
      els.promoInput.focus();
    }
  });
});
els.promoApplied.addEventListener('click', async (e) => {
  if (!e.target.closest('[data-promo-remove]')) return;
  await api.del('/cart/promo');
  promo = null;
  renderSummary();
});

// ---------- Оформление: только для авторизованных ----------
$('[data-checkout]').addEventListener('click', () => {
  if (!isAuth()) return requireAuth('checkout');
  location.href = '/checkout';
});

// ---------- Рекомендации ----------
async function loadRecommendations() {
  if (recommendLoaded) return;
  recommendLoaded = true;
  try {
    const exclude = new Set((cart.data?.items || []).map((i) => i.productId));
    const res = await api.get('/products', { sort: 'popular', limit: 16, in_stock: '1' });
    const items = res.items.filter((p) => !exclude.has(p.id)).slice(0, 12);
    const section = $('[data-rail="recommend"]');
    section.hidden = !items.length;
    $('[data-rail-track]', section).innerHTML = items.map((p) => `<div class="rail__item">${renderCard(p)}</div>`).join('');
    initRail(section);
    initReveals(section);
    refreshScroll();
  } catch (err) {
    console.error(err);
  }
}

async function main() {
  try {
    const [, promoRes] = await Promise.all([cart.load(), api.get('/cart/promo')]);
    promo = promoRes.promo;
  } catch (err) {
    els.items.innerHTML = `<li class="notice notice--danger">${esc(err.message)}</li>`;
  }
  render();
  // Изменения из мини-корзины и других вкладок страницы синхронизируются через store
  store.on('cart:change', () => setTimeout(render, 0));
  await app.reveal();
  onLangChange(render);
  onCurrencyChange(render);
}

main();
