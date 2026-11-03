// Кабинет → Мои заказы (раздел 4: buyer): список с фильтром и пагинацией, детали заказа с таймлайном,
// отмена (пока created / confirmed), повтор, отзыв на полученный товар, заявка на возврат (14 дней, причина, фото).
// API: GET /api/orders, GET /api/orders/:id, POST /api/orders/:id/cancel, POST /api/orders/:id/repeat, POST /api/returns
import { $, esc, icon } from '../core/dom.js';
import { t, loc, fmtDate, fmtDateTime } from '../core/i18n.js';
import api from '../core/api.js';
import { formatMoney } from '../core/currency.js';
import { cart } from '../core/store.js';
import { renderTimeline } from '../ui/timeline.js';
import { openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { withLoading, showApiError, clearErrors } from '../ui/forms.js';
import { statusBadge, empty, orderMoney, pager, loading } from './common.js';
import { orderRow } from './overview.js';

const RETURN_DAYS = 14;

export async function render(view, ctx, params) {
  if (params[0]) return renderDetail(view, ctx, Number(params[0]));
  return renderList(view, ctx);
}

// ---------- Список ----------
async function renderList(view, ctx) {
  const query = new URLSearchParams(location.search);
  let status = ['active', 'done'].includes(query.get('status')) ? query.get('status') : 'all';
  let page = Math.max(1, Number(query.get('page')) || 1);

  async function load() {
    view.querySelector('[data-olist]')?.classList.add('is-dim');
    const data = await api.get('/orders', { status, page });
    view.innerHTML = `
      <div class="seg acc-filter" role="tablist">
        ${['all', 'active', 'done'].map((s) => `<button type="button" role="tab" data-status="${s}" aria-selected="${s === status}" aria-pressed="${s === status}">${esc(t(`account.filter${s[0].toUpperCase()}${s.slice(1)}`))}</button>`).join('')}
      </div>
      ${
        data.orders.length
          ? `<ul class="olist" data-olist>${data.orders.map(orderRow).join('')}</ul>${pager(page, data.pages)}`
          : empty({ title: t('account.noOrders'), text: t('account.noOrdersText'), action: `<a class="btn" href="/catalog">${esc(t('account.toCatalog'))}</a>` })
      }`;
    ctx.reveal();
  }
  view.innerHTML = loading();
  await load();
  view.addEventListener('click', async (e) => {
    const s = e.target.closest('[data-status]');
    if (s) {
      status = s.dataset.status;
      page = 1;
      history.replaceState(null, '', `/account/orders${status !== 'all' ? `?status=${status}` : ''}`);
      await load();
      return;
    }
    const p = e.target.closest('[data-page-go]');
    if (p) {
      page = Number(p.dataset.pageGo);
      await load();
    }
  });
}

// ---------- Детали ----------
async function renderDetail(view, ctx, id) {
  view.innerHTML = loading();
  let order;
  let timer = null;
  const load = async () => ({ order } = await api.get(`/orders/${id}`));
  await load();

  function draw() {
    ctx.setHead({
      eyebrow: t('account.from', { date: fmtDateTime(order.createdAt) }),
      title: t('account.order', { number: order.orderNumber }),
      crumbs: [{ href: '/account/orders', label: t('account.nav.orders') }, { label: order.orderNumber }],
    });
    const delivered = order.status === 'delivered';
    const deliveredAt = order.history.filter((h) => h.status === 'delivered').pop()?.at;
    const canReturn = delivered && deliveredAt && (Date.now() - new Date(deliveredAt).getTime()) / 86400000 <= RETURN_DAYS;
    const canCancel = ['created', 'confirmed'].includes(order.status);
    const money = (byn) => esc(formatMoney(byn / order.exchangeRate, order.currency));
    view.innerHTML = `
      <a class="link-u t-mono acc-back" href="/account/orders" data-acc-link>${esc(t('account.backToOrders'))}</a>
      <div class="odetail">
        <section class="odetail__main">
          <div class="odetail__status">
            ${statusBadge(order.status)} ${statusBadge(order.paymentStatus, t(`payment.${order.paymentStatus}`))}
            ${order.expectedDeliveryDate && !['delivered', 'cancelled', 'returned'].includes(order.status) ? `<span class="t-mono t-muted">${esc(t('account.expected', { date: fmtDate(order.expectedDeliveryDate) }))}</span>` : ''}
          </div>
          ${renderTimeline(order)}
          <h2 class="acc-h2">${esc(t('account.orderItems'))}</h2>
          <ul class="oitems">${order.items
            .map(
              (i) => `<li class="oitem" data-reveal>
                <a class="oitem__img" href="/product/${i.productId}"><img src="${esc(i.image)}" alt="" loading="lazy"></a>
                <div class="oitem__body">
                  <a class="oitem__name" href="/product/${i.productId}">${esc(loc(i.name))}</a>
                  <p class="oitem__meta t-mono">${esc(i.sku)} · ${esc(i.size)} × ${i.quantity}</p>
                  <div class="oitem__actions">
                    ${delivered ? (i.reviewed ? `<span class="t-mono t-muted">${icon('i-check', 'icon icon--xs')} ${esc(t('account.reviewed'))}</span>` : `<a class="link-u t-mono" href="/product/${i.productId}#reviews">${esc(t('account.writeReview'))}</a>`) : ''}
                    ${i.returnStatus ? statusBadge(i.returnStatus, t(`account.returnStatus.${i.returnStatus}`)) : canReturn ? `<button type="button" class="link-u t-mono" data-return="${i.id}">${icon('i-return', 'icon icon--xs')} ${esc(t('account.returnItem'))}</button>` : ''}
                  </div>
                </div>
                <p class="oitem__price t-mono">${money(i.price * i.quantity)}</p>
              </li>`
            )
            .join('')}</ul>
        </section>
        <aside class="odetail__side">
          <dl class="odetail__info">
            <div><dt class="t-mono">${esc(t('account.trackingNumber'))}</dt><dd class="t-mono">${esc(order.trackingNumber)}</dd></div>
            <div><dt class="t-mono">${esc(t('account.delivery'))}</dt><dd>${esc(loc(order.delivery.name))}</dd></div>
            <div><dt class="t-mono">${esc(t('account.address'))}</dt><dd>${esc(order.address).replace(/\n/g, '<br>')}</dd></div>
            <div><dt class="t-mono">${esc(t('account.payment'))}</dt><dd>${esc(loc(order.payment.name))}</dd></div>
            ${order.courier ? `<div><dt class="t-mono">${esc(t('account.courier'))}</dt><dd>${esc(order.courier.name)}<br><span class="t-mono">${esc(order.courier.phone || '')}</span></dd></div>` : ''}
            ${order.comment ? `<div><dt class="t-mono">${esc(t('account.comment'))}</dt><dd>${esc(order.comment)}</dd></div>` : ''}
          </dl>
          <dl class="summary__rows">
            <div><dt>${esc(t('cart.subtotal'))}</dt><dd>${money(order.subtotal)}</dd></div>
            ${order.discount ? `<div><dt>${esc(t('account.promo'))} ${esc(order.promoCode || '')}</dt><dd class="summary__discount">−${money(order.discount)}</dd></div>` : ''}
            <div><dt>${esc(t('cartPage.delivery'))}</dt><dd>${order.deliveryPrice ? money(order.deliveryPrice) : esc(t('checkout.free'))}</dd></div>
            <div class="summary__total"><dt>${esc(t('cartPage.total'))}</dt><dd>${orderMoney(order)}</dd></div>
            ${order.currency !== 'BYN' ? `<div><dt class="t-muted">${esc(t('account.rate'))}</dt><dd class="t-muted">1 ${order.currency} = ${order.exchangeRate} BYN</dd></div>` : ''}
          </dl>
          <div class="odetail__actions">
            <a class="btn btn--sm" href="/tracking?number=${encodeURIComponent(order.trackingNumber)}">${icon('i-truck', 'icon icon--sm')} ${esc(t('account.track'))}</a>
            <button type="button" class="btn btn--sm btn--ghost" data-repeat>${icon('i-refresh', 'icon icon--sm')} ${esc(t('account.repeat'))}</button>
            ${canCancel ? `<button type="button" class="btn btn--sm btn--danger" data-cancel>${esc(t('account.cancel'))}</button>` : ''}
            <a class="link-u t-mono" href="/account/support?order=${order.id}" data-acc-link>${esc(t('account.quickSupport'))}</a>
          </div>
        </aside>
      </div>`;
    ctx.reveal();
  }
  draw();

  view.addEventListener('click', async (e) => {
    if (e.target.closest('[data-cancel]')) return cancelOrder();
    const rep = e.target.closest('[data-repeat]');
    if (rep) {
      await withLoading(rep, async () => {
        try {
          const r = await api.post(`/orders/${id}/repeat`);
          await cart.load();
          toast.success(t('account.repeated', { added: r.added }), r.skipped ? t('account.repeatSkipped', { skipped: r.skipped }) : '', { action: { label: t('cart.goToCart'), onClick: () => (location.href = '/cart') } });
        } catch (err) {
          toast.error(err.message);
        }
      });
      return;
    }
    const ret = e.target.closest('[data-return]');
    if (ret) openReturn(order.items.find((i) => i.id === Number(ret.dataset.return)));
  });

  async function cancelOrder() {
    const body = document.createElement('form');
    body.className = 'acc-form';
    body.innerHTML = `
      <p class="lead">${esc(t('account.cancelConfirm', { number: order.orderNumber }))}</p>
      <div class="field"><label class="field__label" for="cancel-reason">${esc(t('account.cancelReason'))}</label><input class="input" id="cancel-reason" name="reason" maxlength="300"></div>
      <div class="modal__actions"><button type="button" class="btn btn--ghost btn--sm" data-modal-close>${esc(t('common.cancel'))}</button><button type="submit" class="btn btn--sm btn--danger">${esc(t('account.cancel'))}</button></div>`;
    const modal = openModal({ title: t('account.cancel'), content: body });
    body.addEventListener('submit', async (e) => {
      e.preventDefault();
      await withLoading($('[type=submit]', body), async () => {
        try {
          ({ order } = await api.post(`/orders/${id}/cancel`, { reason: body.elements.reason.value.trim() }));
          modal.close();
          toast.success(t('account.cancelled'));
          draw();
        } catch (err) {
          toast.error(err.message);
        }
      });
    });
  }

  function openReturn(item) {
    const reasons = ['size', 'defect', 'not_as_described', 'changed_mind', 'wrong_item', 'other'];
    const form = document.createElement('form');
    form.className = 'acc-form';
    form.noValidate = true;
    form.innerHTML = `
      <div class="ret-item"><img src="${esc(item.image)}" alt=""><div><p>${esc(loc(item.name))}</p><p class="t-mono t-muted">${esc(item.size)} × ${item.quantity}</p></div></div>
      <p class="t-muted acc-note">${esc(t('account.returnRule'))}</p>
      <div class="form-grid form-grid--2">
        <div class="field"><label class="field__label" for="ret-reason">${esc(t('account.returnReason'))}</label>
          <select class="select" id="ret-reason" name="reasonCode">${reasons.map((r) => `<option value="${r}">${esc(t(`account.returnReasons.${r}`))}</option>`).join('')}</select></div>
        <div class="field"><label class="field__label" for="ret-qty">${esc(t('account.returnQty'))}</label>
          <input class="input" id="ret-qty" name="quantity" type="number" min="1" max="${item.quantity}" value="1"></div>
        <div class="field field--wide"><label class="field__label" for="ret-text">${esc(t('account.returnText'))}</label>
          <textarea class="textarea" id="ret-text" name="reason" rows="4" minlength="10" maxlength="1000" required></textarea><p class="field__error" data-error-for="reason"></p></div>
        <div class="field field--wide"><label class="field__label" for="ret-photo">${esc(t('account.returnPhoto'))}</label>
          <input class="input" id="ret-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp"><p class="field__error" data-error-for="photo"></p></div>
      </div>
      <p class="notice notice--danger" data-form-error hidden></p>
      <div class="modal__actions"><button type="button" class="btn btn--ghost btn--sm" data-modal-close>${esc(t('common.cancel'))}</button><button type="submit" class="btn btn--sm">${esc(t('account.returnSend'))}</button></div>`;
    const modal = openModal({ title: t('account.returnTitle'), content: form, size: 'wide' });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors(form);
      const fd = new FormData();
      fd.append('orderItemId', String(item.id));
      fd.append('quantity', form.elements.quantity.value);
      fd.append('reasonCode', form.elements.reasonCode.value);
      fd.append('reason', form.elements.reason.value.trim());
      if (form.elements.photo.files[0]) fd.append('photo', form.elements.photo.files[0]);
      await withLoading($('[type=submit]', form), async () => {
        try {
          await api.post('/returns', fd);
          modal.close();
          toast.success(t('account.returnSent'));
          await load();
          draw();
        } catch (err) {
          showApiError(form, err);
        }
      });
    });
  }

  // Автообновление статуса активного заказа раз в 30 секунд
  if (!['delivered', 'cancelled', 'returned'].includes(order.status)) {
    timer = setInterval(async () => {
      const prev = order.status;
      await load().catch(() => {});
      if (order.status !== prev) draw();
    }, 30_000);
  }
  return () => clearInterval(timer);
}
