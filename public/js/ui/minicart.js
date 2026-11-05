// Мини-корзина — выезжающая панель справа (раздел 6.1 ТЗ).
// Количество меняется с проверкой остатка, удаление — с кнопкой «Отменить» в тосте.
import { $, esc, icon, trapFocus, showAnimated } from '../core/dom.js';
import { t, loc, onLangChange } from '../core/i18n.js';
import { formatPrice, onCurrencyChange } from '../core/currency.js';
import { store, cart, isAuth, requireAuth } from '../core/store.js';
import { stopScroll, startScroll } from './motion.js';
import { toast } from './toast.js';

let root;
let releaseTrap = null;
let lastFocus = null;

function emptyHtml() {
  return `<div class="empty">
    <svg class="empty__orn icon--fill" aria-hidden="true"><use href="#orn-fleur"/></svg>
    <p class="empty__title">${esc(t('cart.emptyTitle'))}</p>
    <p class="empty__text">${esc(t('cart.emptyText'))}</p>
    <a class="btn btn--sm" href="/catalog?new=1">${esc(t('cart.emptyCta'))}</a></div>`;
}

function itemHtml(item) {
  const maxQty = Math.min(item.available, 20);
  return `<article class="mini-item" data-variant="${item.variantId}">
    <a href="/product/${item.productId}"><img src="${esc(item.image)}" alt="${esc(loc(item.name))}" width="800" height="1000" loading="lazy"></a>
    <div>
      <p class="mini-item__brand">${esc(item.brand.name)}</p>
      <a class="mini-item__name" href="/product/${item.productId}">${esc(loc(item.name))}</a>
      <div class="mini-item__meta"><span>${esc(t('cart.size'))}: <span class="t-mono">${esc(item.size)}</span></span>
        <span class="mini-item__price" data-price="${item.price * item.quantity}">${formatPrice(item.price * item.quantity)}</span></div>
      ${item.isAvailable
        ? `<div class="mini-item__meta">
            <div class="qty">
              <button type="button" data-mini-dec aria-label="−" ${item.quantity <= 1 ? 'disabled' : ''}>${icon('i-minus')}</button>
              <output>${item.quantity}</output>
              <button type="button" data-mini-inc aria-label="+" ${item.quantity >= maxQty ? 'disabled' : ''}>${icon('i-plus')}</button>
            </div>
            <button type="button" class="link-u t-mono" data-mini-remove>${esc(t('cart.remove'))}</button></div>`
        : `<div class="mini-item__meta"><span class="status status--bad">${esc(t('cart.unavailable'))}</span><button type="button" class="link-u t-mono" data-mini-remove>${esc(t('cart.remove'))}</button></div>`}
    </div></article>`;
}

function render(data) {
  if (!root) return;
  const body = $('[data-minicart-body]', root);
  const foot = $('[data-minicart-foot]', root);
  $('[data-minicart-count]', root).textContent = data?.count || 0;
  if (!data || !data.items.length) {
    body.innerHTML = emptyHtml();
    foot.hidden = true;
    return;
  }
  body.innerHTML = data.items.map(itemHtml).join('');
  const total = $('[data-minicart-total]', root);
  total.dataset.price = data.subtotal;
  total.textContent = formatPrice(data.subtotal);
  foot.hidden = false;
}

export async function openMiniCart() {
  if (!root) return;
  lastFocus = document.activeElement;
  showAnimated(root);
  stopScroll();
  releaseTrap = trapFocus(root);
  setTimeout(() => $('[data-minicart-close].icon-btn', root)?.focus(), 100);
  if (!cart.data) $('[data-minicart-body]', root).innerHTML = `<p class="t-muted" style="padding:24px 0">${esc(t('common.loading'))}</p>`;
  try {
    render(await cart.load());
  } catch (err) {
    $('[data-minicart-body]', root).innerHTML = `<p class="notice notice--danger">${esc(err.message)}</p>`;
  }
}

export function closeMiniCart() {
  if (!root || root.hidden) return;
  root.classList.remove('is-open');
  releaseTrap?.();
  startScroll();
  setTimeout(() => {
    if (!root.classList.contains('is-open')) root.hidden = true;
  }, 750);
  lastFocus?.focus?.();
}

export function initMiniCart() {
  root = $('[data-minicart]');
  if (!root) return;
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-cart-open]')) {
      e.preventDefault();
      openMiniCart();
    }
  });
  root.addEventListener('click', async (e) => {
    if (e.target.closest('[data-minicart-close]')) return closeMiniCart();
    if (e.target.closest('[data-minicart-checkout]') && !isAuth()) {
      e.preventDefault();
      closeMiniCart();
      requireAuth('checkout');
      return;
    }
    const row = e.target.closest('[data-variant]');
    if (!row || !cart.data) return;
    const item = cart.data.items.find((i) => i.variantId === Number(row.dataset.variant));
    if (!item) return;
    try {
      if (e.target.closest('[data-mini-inc]')) await cart.update(item, { quantity: item.quantity + 1 });
      else if (e.target.closest('[data-mini-dec]')) await cart.update(item, { quantity: item.quantity - 1 });
      else if (e.target.closest('[data-mini-remove]')) {
        await cart.remove(item);
        toast({
          type: 'info',
          title: t('cart.removed'),
          text: `${item.brand.name} — ${loc(item.name)}`,
          duration: 5000,
          action: { label: t('common.undo'), onClick: () => cart.restore(item).catch((err) => toast.error(err.message)) },
        });
      }
    } catch (err) {
      toast.error(t('cart.error'), err.message);
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && root.classList.contains('is-open')) closeMiniCart();
  });
  store.on('cart:change', (data) => render(data));
  // На странице корзины панель не нужна: изменения видны сразу в списке
  store.on('cart:added', () => document.body.dataset.page !== 'cart' && openMiniCart());
  onLangChange(() => cart.data && render(cart.data));
  onCurrencyChange(() => cart.data && render(cart.data));
}
