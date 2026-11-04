// Админка → Заказы (раздел 8 ТЗ, роль owner): таблица всех заказов (фильтры статуса и курьера, поиск, сортировка, CSV)
// и карточка заказа: таймлайн, состав, история с авторами, смена статуса (следующий шаг / отмена), назначение курьера,
// демонстрация (раздел 5 ТЗ): «Продвинуть заказ на следующий статус» и «Провести заказ по всем статусам» (пауза 2,5 с —
// шаги выполняет сервер, страница опрашивает заказ раз в секунду и анимирует таймлайн).
// API: /api/admin/orders*, /api/admin/couriers (server/routes/api/admin.js)
import { $, esc, icon } from '../core/dom.js';
import { t, loc, fmtDateTime, fmtNumber } from '../core/i18n.js';
import api from '../core/api.js';
import { formatMoney } from '../core/currency.js';
import { confirmModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { withLoading } from '../ui/forms.js';
import { renderTimeline } from '../ui/timeline.js';
import { statusBadge, loading, orderMoney } from '../account/common.js';
import { createTable } from '../account/table.js';
import { openForm } from './form.js';

const STATUSES = ['created', 'confirmed', 'assembling', 'assembled', 'handed_to_delivery', 'in_transit', 'arrived', 'delivered', 'cancelled', 'returned'];
const CANCELLABLE = ['created', 'confirmed', 'assembling', 'assembled'];

export async function render(view, ctx, params) {
  if (params[0]) return renderOrder(view, ctx, Number(params[0]));
  const { couriers } = await api.get('/admin/couriers');
  view.innerHTML = '<div data-table></div>';
  createTable($('[data-table]', view), {
    csv: 'amfibia-admin-orders',
    sort: 'created',
    search: { placeholder: t('staff.desk.ordersSearchPh') },
    filters: [
      { name: 'status', label: t('staff.col.status'), value: 'all', options: [{ value: 'all', label: t('common.all') }, { value: 'active', label: t('account.filterActive') }, ...STATUSES.map((s) => ({ value: s, label: t(`statuses.${s}`) }))] },
      { name: 'courier', label: t('account.courier'), value: '', options: [{ value: '', label: t('common.all') }, { value: 'none', label: t('admin.orders.noCourier') }, ...couriers.map((c) => ({ value: c.id, label: `${c.name} (${c.active})` }))] },
    ],
    load: (s) => api.get('/admin/orders', s),
    onRow: (o) => ctx.navigate(`/admin/orders/${o.id}`),
    columns: [
      { key: 'orderNumber', label: t('staff.col.order'), sort: 'number', className: 't-mono', render: (o) => `<a href="/admin/orders/${o.id}" data-adm-link><b>${esc(o.orderNumber)}</b></a><span class="dt-sub">${esc(o.trackingNumber)}</span>`, csv: (o) => o.orderNumber },
      { key: 'createdAt', label: t('staff.col.date'), sort: 'created', className: 't-mono dt__hide-sm', render: (o) => esc(fmtDateTime(o.createdAt)), csv: (o) => o.createdAt },
      { key: 'customer', label: t('staff.col.buyer'), sort: 'customer', className: 'dt__wide', render: (o) => `${esc(o.customer.name)}<span class="dt-sub">${esc(o.customer.email)} · ${esc(loc(o.delivery))}</span>`, csv: (o) => `${o.customer.name} <${o.customer.email}>` },
      { key: 'status', label: t('staff.col.status'), sort: 'status', render: (o) => statusBadge(o.status), csv: (o) => t(`statuses.${o.status}`) },
      { key: 'courier', label: t('account.courier'), className: 'dt__hide-sm', render: (o) => esc(o.courier || '—'), csv: (o) => o.courier || '' },
      { key: 'total', label: t('staff.col.total'), sort: 'total', className: 't-mono', render: (o) => esc(formatMoney(o.totalInCurrency, o.currency)), csv: (o) => o.total },
      { key: 'next', label: '', csv: false, className: 'dt__actions', render: (o) => (o.next ? `<button type="button" class="btn btn--xs btn--ghost" data-quick="${o.id}" title="${esc(t('admin.orders.advance'))}">${icon('i-arrow-right', 'icon icon--xs')} ${esc(t(`statuses.${o.next}`))}</button>` : '') },
    ],
  });
  view.addEventListener('click', async (e) => {
    const q = e.target.closest('[data-quick]');
    if (!q) return;
    await withLoading(q, async () => {
      try {
        const { result } = await api.post(`/admin/orders/${q.dataset.quick}/advance`);
        toast.success(t('staff.stock.advanced', { number: result.orderNumber }), t(`statuses.${result.to}`));
        q.closest('tr').querySelector('.status').outerHTML = statusBadge(result.to);
        q.remove();
        ctx.refreshSummary();
      } catch (err) {
        toast.error(err.message);
      }
    });
  });
}

async function renderOrder(view, ctx, id) {
  view.innerHTML = loading();
  let data;
  let couriers = [];
  let poll = null;
  const load = async () => (data = await api.get(`/admin/orders/${id}`));
  [, { couriers }] = await Promise.all([load(), api.get('/admin/couriers')]);

  function draw() {
    const o = data.order;
    const m = (byn) => esc(formatMoney(byn / o.exchangeRate, o.currency));
    const running = o.demoRunning;
    const stepIndex = o.flow.indexOf(o.status);
    ctx.setHead({ eyebrow: `${t('admin.nav.orders')} · ${fmtDateTime(o.createdAt)}`, title: o.orderNumber });
    view.innerHTML = `
      <a class="link-u t-mono acc-back" href="/admin/orders" data-adm-link>${esc(t('staff.desk.backToOrders'))}</a>
      <section class="demo ${running ? 'is-running' : ''}" data-reveal>
        <div class="demo__head">
          <p class="t-eyebrow">${esc(t('admin.orders.demoEyebrow'))}</p>
          <h2 class="demo__title">${esc(t('admin.orders.demoTitle'))}</h2>
          <p class="t-muted">${esc(t('admin.orders.demoText'))}</p>
        </div>
        <ol class="demo__flow" style="--n:${o.flow.length}">${o.flow
          .map((s, i) => `<li class="${o.status === 'cancelled' || o.status === 'returned' ? (data.history.some((h) => h.status === s) ? 'is-done' : '') : i < stepIndex ? 'is-done' : i === stepIndex ? 'is-current' : ''}"><span class="demo__dot">${i < stepIndex ? icon('i-check', 'icon icon--xs') : String(i + 1).padStart(2, '0')}</span><i class="t-mono">${esc(t(`statuses.${s}`))}</i></li>`)
          .join('')}</ol>
        <div class="demo__actions">
          ${o.next ? `<button type="button" class="btn" data-advance ${running ? 'disabled' : ''}>${icon('i-arrow-right', 'icon icon--sm')} ${esc(t('admin.orders.advance'))} → ${esc(t(`statuses.${o.next}`))}</button>
            <button type="button" class="btn btn--accent" data-run ${running ? 'disabled' : ''}>${icon('i-play', 'icon icon--sm')} ${esc(t(running ? 'admin.orders.running' : 'admin.orders.runAll'))}</button>` : `<p class="t-mono">${statusBadge(o.status)} ${esc(t('admin.orders.final'))}</p>`}
          ${running ? '<span class="demo__pulse" aria-hidden="true"></span>' : ''}
        </div>
      </section>
      <div class="odetail">
        <section class="odetail__main">
          <div class="odetail__status">${statusBadge(o.status)} ${statusBadge(o.paymentStatus, t(`payment.${o.paymentStatus}`))}</div>
          ${renderTimeline(o)}
          <h2 class="acc-h2">${esc(t('account.orderItems'))}</h2>
          <ul class="oitems">${o.items.map((i) => `<li class="oitem"><a class="oitem__img" href="/product/${i.productId}"><img src="${esc(i.image)}" alt="" loading="lazy"></a><div class="oitem__body"><a class="oitem__name" href="/product/${i.productId}">${esc(loc(i.name))}</a><p class="oitem__meta t-mono">${esc(i.sku)} · ${esc(i.size)} × ${i.quantity}</p>${i.returnStatus ? statusBadge(i.returnStatus, t(`account.returnStatus.${i.returnStatus}`)) : ''}</div><p class="oitem__price t-mono">${m(i.price * i.quantity)}</p></li>`).join('')}</ul>
          <h2 class="acc-h2">${esc(t('staff.desk.historyTitle'))}</h2>
          <ol class="hist">${data.history.map((h) => `<li><span class="t-mono t-muted">${esc(fmtDateTime(h.at))}</span>${statusBadge(h.status)}<span>${esc(h.comment || '')}</span><span class="t-mono t-muted">${esc(h.author || t('staff.system'))}${h.role ? ` · ${esc(t(`roles.${h.role}`))}` : ''}</span></li>`).join('')}</ol>
        </section>
        <aside class="odetail__side">
          <form class="cust" data-courier-form>
            <p class="t-mono t-muted">${esc(t('account.courier'))}</p>
            <div class="adm-inline"><label class="sr-only" for="o-courier">${esc(t('account.courier'))}</label>
              <select class="select" id="o-courier" name="courierId" ${['delivered', 'cancelled', 'returned'].includes(o.status) ? 'disabled' : ''}><option value="">${esc(t('admin.orders.noCourier'))}</option>${couriers.map((c) => `<option value="${c.id}" ${c.id === o.courierId ? 'selected' : ''}>${esc(c.name)} · ${c.active}</option>`).join('')}</select>
              <button type="submit" class="btn btn--sm" ${['delivered', 'cancelled', 'returned'].includes(o.status) ? 'disabled' : ''}>${esc(t('admin.orders.assign'))}</button></div>
            <p class="field__hint">${esc(t('admin.orders.courierHint'))}</p>
          </form>
          <dl class="odetail__info">
            <div><dt class="t-mono">${esc(t('staff.desk.customer'))}</dt><dd>${esc(o.contact.name)}<br><span class="t-mono">${esc(o.contact.phone)}</span><br><a class="link-u" href="mailto:${esc(o.contact.email)}">${esc(o.contact.email)}</a><br><a class="link-u t-mono" href="/admin/users/${o.userId}" data-adm-link>${esc(t('admin.sellers.profile'))}</a></dd></div>
            <div><dt class="t-mono">${esc(t('account.trackingNumber'))}</dt><dd class="t-mono"><a class="link-u" href="/tracking?number=${encodeURIComponent(o.trackingNumber)}" target="_blank" rel="noopener">${esc(o.trackingNumber)}</a></dd></div>
            <div><dt class="t-mono">${esc(t('account.delivery'))}</dt><dd>${esc(loc(o.delivery.name))}</dd></div>
            <div><dt class="t-mono">${esc(t('account.address'))}</dt><dd>${esc(o.address).replace(/\n/g, '<br>')}</dd></div>
            <div><dt class="t-mono">${esc(t('account.payment'))}</dt><dd>${esc(loc(o.payment.name))}</dd></div>
            ${o.comment ? `<div><dt class="t-mono">${esc(t('account.comment'))}</dt><dd>${esc(o.comment)}</dd></div>` : ''}
          </dl>
          <dl class="summary__rows">
            <div><dt>${esc(t('cart.subtotal'))}</dt><dd>${m(o.subtotal)}</dd></div>
            ${o.discount ? `<div><dt>${esc(t('account.promo'))} ${esc(o.promoCode || '')}</dt><dd class="summary__discount">−${m(o.discount)}</dd></div>` : ''}
            <div><dt>${esc(t('cartPage.delivery'))}</dt><dd>${o.deliveryPrice ? m(o.deliveryPrice) : esc(t('checkout.free'))}</dd></div>
            <div class="summary__total"><dt>${esc(t('cartPage.total'))}</dt><dd>${orderMoney(o)}</dd></div>
            ${o.currency !== 'BYN' ? `<div><dt class="t-muted">${esc(t('account.rate'))}</dt><dd class="t-muted">1 ${o.currency} = ${fmtNumber(o.exchangeRate, { maximumFractionDigits: 4 })} BYN</dd></div>` : ''}
          </dl>
          ${CANCELLABLE.includes(o.status) && !running ? `<button type="button" class="btn btn--sm btn--danger btn--block" data-cancel>${esc(t('staff.desk.cancelOrder'))}</button>` : ''}
        </aside>
      </div>`;
  }

  const refresh = async () => {
    await load();
    draw();
  };
  function startPolling() {
    clearInterval(poll);
    poll = setInterval(async () => {
      const prev = data.order.status;
      await load().catch(() => {});
      if (data.order.status !== prev || !data.order.demoRunning) draw();
      if (!data.order.demoRunning) {
        clearInterval(poll);
        toast.success(t('admin.orders.demoDone', { number: data.order.orderNumber }), t(`statuses.${data.order.status}`));
        ctx.refreshSummary();
      }
    }, 1000);
  }

  draw();
  if (data.order.demoRunning) startPolling();

  view.addEventListener('click', async (e) => {
    const adv = e.target.closest('[data-advance]');
    if (adv) {
      await withLoading(adv, async () => {
        try {
          const { result } = await api.post(`/admin/orders/${id}/advance`);
          toast.success(t(`statuses.${result.to}`), result.orderNumber);
          await refresh();
          ctx.refreshSummary();
        } catch (err) {
          toast.error(err.message);
        }
      });
      return;
    }
    const run = e.target.closest('[data-run]');
    if (run) {
      try {
        await api.post(`/admin/orders/${id}/run-all`);
        toast.info(t('admin.orders.demoStarted'));
        await refresh();
        startPolling();
      } catch (err) {
        toast.error(err.message);
      }
      return;
    }
    if (e.target.closest('[data-cancel]')) {
      openForm({
        title: t('staff.desk.cancelOrder'),
        size: '',
        fields: [{ name: 'comment', label: t('account.cancelReason'), wide: true, required: true }],
        submitLabel: t('staff.desk.cancelOrder'),
        onSubmit: async ({ comment }) => {
          await api.post(`/admin/orders/${id}/status`, { status: 'cancelled', comment });
          toast.success(t('account.cancelled'));
          await refresh();
        },
      });
    }
  });
  view.addEventListener('submit', async (e) => {
    if (!e.target.matches('[data-courier-form]')) return;
    e.preventDefault();
    const courierId = Number(e.target.elements.courierId.value);
    if (!courierId) return;
    if (!(await confirmModal({ title: t('admin.orders.assign'), text: t('admin.orders.assignText', { name: couriers.find((c) => c.id === courierId)?.name || '' }), confirmLabel: t('admin.orders.assign') }))) return;
    try {
      await api.post(`/admin/orders/${id}/courier`, { courierId });
      toast.success(t('admin.orders.assigned'));
      await refresh();
    } catch (err) {
      toast.error(err.message);
    }
  });
  return () => clearInterval(poll);
}
