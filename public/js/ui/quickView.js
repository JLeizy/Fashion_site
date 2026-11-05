// Быстрый просмотр товара в модалке (раздел 6.7 ТЗ): галерея, цвета модели, размеры с наличием,
// добавление в корзину с анимацией полёта, избранное, ссылка на полную страницу.
import { $, $$, esc, icon } from '../core/dom.js';
import { t, loc } from '../core/i18n.js';
import api from '../core/api.js';
import { formatPrice } from '../core/currency.js';
import { cart, wishlist } from '../core/store.js';
import { openModal } from './modal.js';
import { toast } from './toast.js';
import { flyToCart } from './flyToCart.js';
import { labelsHtml, colorVar } from './productCard.js';

export async function openQuickView(productId) {
  const holder = document.createElement('div');
  holder.className = 'qv';
  holder.innerHTML = `<div class="qv__loading">${esc(t('common.loading'))}</div>`;
  const modal = openModal({ size: 'wide', content: holder, className: 'modal--qv' });
  let product;
  try {
    ({ product } = await api.get(`/products/${productId}`));
  } catch (err) {
    holder.innerHTML = `<p class="notice notice--danger">${esc(err.message)}</p>`;
    return modal;
  }
  const p = { ...product, sizes: product.variants };
  let selected = p.variants.length === 1 && p.variants[0].available > 0 ? p.variants[0] : null;
  const inWish = () => wishlist.has(p.id);

  holder.innerHTML = `
    <div class="qv__gallery">
      <div class="qv__main"><img src="${esc(p.images[0])}" alt="${esc(`${p.brand.name} — ${loc(p.name)}`)}" width="800" height="1000" data-qv-main></div>
      <div class="qv__thumbs">${p.images.map((src, i) => `<button type="button" class="qv__thumb ${i === 0 ? 'is-active' : ''}" data-qv-thumb="${esc(src)}"><img src="${esc(src)}" alt="" width="800" height="1000" loading="lazy"></button>`).join('')}</div>
    </div>
    <div class="qv__info">
      <div class="qv__labels">${labelsHtml(p)}</div>
      <a class="qv__brand t-eyebrow link-u" href="/brand/${esc(p.brand.slug)}">${esc(p.brand.name)}</a>
      <h2 class="qv__name">${esc(loc(p.name))}</h2>
      <p class="qv__sku t-mono">${esc(t('product.sku'))}: ${esc(p.sku)}</p>
      <p class="qv__price p-card__price"><span class="${p.oldPrice ? 'is-sale' : ''}" data-price="${p.price}">${formatPrice(p.price)}</span>${p.oldPrice ? `<s data-price="${p.oldPrice}">${formatPrice(p.oldPrice)}</s>` : ''}</p>
      ${p.reviewsCount ? `<p class="qv__rating"><span class="stars" style="--value:${p.rating}"></span> <span class="t-mono">${p.rating.toFixed(1)} · ${p.reviewsCount}</span></p>` : ''}
      ${p.colors.length > 1 ? `<div class="qv__block"><p class="t-eyebrow">${esc(t('product.color'))}: ${esc(t(`colors.${p.color}`))}</p><div class="qv__colors">${p.colors.map((c) => `<a href="/product/${c.id}" class="qv__color ${c.current ? 'is-active' : ''}" title="${esc(t(`colors.${c.color}`))}"><span class="color-dot ${c.current ? 'is-active' : ''}" style="--dot:${colorVar(c.color)}"></span></a>`).join('')}</div></div>` : ''}
      <div class="qv__block">
        <p class="t-eyebrow">${esc(t('product.size'))}</p>
        <div class="size-grid" data-qv-sizes>${p.variants
          .map((v) => `<button type="button" class="size-btn" data-variant="${v.variantId}" ${v.available > 0 ? '' : 'disabled'} aria-pressed="${selected?.variantId === v.variantId}">${esc(v.label)}</button>`)
          .join('')}</div>
        <p class="qv__stock t-mono" data-qv-stock></p>
      </div>
      <div class="qv__actions">
        <button type="button" class="btn grow" data-qv-add ${p.inStock ? '' : 'disabled'}><span class="btn__label">${esc(p.inStock ? t('product.addToCart') : t('product.outOfStock'))}</span></button>
        <button type="button" class="icon-btn qv__wish ${inWish() ? 'is-active' : ''}" data-qv-wish aria-pressed="${inWish()}" aria-label="${esc(t('product.toWishlist'))}">${icon('i-heart', 'icon heart-icon')}</button>
      </div>
      <p class="qv__desc">${esc(loc(p.description))}</p>
      <a class="link-u t-mono qv__more" href="/product/${p.id}">${esc(t('product.fullPage'))} ${icon('i-arrow-right', 'icon icon--xs')}</a>
    </div>`;

  const stock = $('[data-qv-stock]', holder);
  const renderStock = () => {
    if (!selected) {
      stock.textContent = p.variants.length > 1 ? t('product.chooseSize') : '';
      return;
    }
    stock.textContent = selected.available <= 3 ? t('product.fewLeft', { n: selected.available }) : t('product.inStock');
  };
  renderStock();

  holder.addEventListener('click', async (e) => {
    const thumb = e.target.closest('[data-qv-thumb]');
    if (thumb) {
      $('[data-qv-main]', holder).src = thumb.dataset.qvThumb;
      $$('.qv__thumb', holder).forEach((b) => b.classList.toggle('is-active', b === thumb));
      return;
    }
    const sizeBtn = e.target.closest('[data-variant]');
    if (sizeBtn) {
      selected = p.variants.find((v) => v.variantId === Number(sizeBtn.dataset.variant));
      $$('[data-variant]', holder).forEach((b) => b.setAttribute('aria-pressed', String(b === sizeBtn)));
      renderStock();
      return;
    }
    if (e.target.closest('[data-qv-add]')) {
      if (!selected) {
        stock.textContent = t('product.chooseSize');
        $('[data-qv-sizes]', holder).animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], { duration: 300 });
        return;
      }
      const btn = e.target.closest('[data-qv-add]');
      btn.classList.add('is-loading');
      try {
        await flyToCart($('[data-qv-main]', holder));
        await cart.add(selected.variantId, 1);
        toast.success(t('cart.added'), `${p.brand.name} — ${loc(p.name)}, ${selected.label}`);
        modal.close();
      } catch (err) {
        toast.error(t('cart.error'), err.message);
      } finally {
        btn.classList.remove('is-loading');
      }
      return;
    }
    const wishBtn = e.target.closest('[data-qv-wish]');
    if (wishBtn) {
      try {
        const active = await wishlist.toggle(p.id);
        if (active === null) return;
        wishBtn.classList.toggle('is-active', active);
        wishBtn.setAttribute('aria-pressed', String(active));
        toast.success(t(active ? 'wishlist.added' : 'wishlist.removed'));
      } catch (err) {
        toast.error(err.message);
      }
    }
  });
  return modal;
}
