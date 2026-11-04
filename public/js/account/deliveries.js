// Кабинет → Доставки (раздел 4 ТЗ, роль courier): заказы, назначенные курьеру — «маршрутные листы» с адресом,
// телефоном получателя, составом и суммой к получению при оплате наличными; смена статусов
// handed_to_delivery → in_transit → arrived (только для пунктов выдачи) → delivered.
// Подвкладки: /account/deliveries[/done], детали — /account/deliveries/order/:id. API: /api/courier/* (server/routes/api/courier.js)
import { $, esc, icon } from '../core/dom.js';
import { t, loc, fmtDate, fmtDateTime, fmtNumber } from '../core/i18n.js';
import api from '../core/api.js';
import { confirmModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { withLoading } from '../ui/forms.js';
import { renderTimeline } from '../ui/timeline.js';
import { statusBadge, empty, loading } from './common.js';
import { subtabs, kpis, money, since, itemsStrip } from './staff.js';

const BASE = 'deliveries';
const NEXT_ACTION = { in_transit: ['staff.courier.pickUp', 'i-truck'], arrived: ['staff.courier.atPoint', 'i-pin'], delivered: ['staff.courier.handOver', 'i-check'] };

export async function render(view, ctx, params) {
  if (params[0] === 'order' && params[1]) return renderDetail(view, ctx, Number(params[1]));
  const scope = params[0] === 'done' ? 'done' : 'active';
  view.innerHTML = loading();
  ctx.setHead({ eyebrow: t('staff.courier.eyebrow'), title: t('account.nav.deliveries'), crumbs: [{ label: t('account.nav.deliveries') }] });
  let timer = null;

  async function draw() {
    const [{ orders }, done] = await Promise.all([api.get('/courier/orders', { scope }), scope === 'active' ? api.get('/courier/orders', { scope: 'done' }) : Promise.resolve(null)]);
    const today = new Date().toDateString();
    const deliveredToday = (done?.orders || []).filter((o) => o.status === 'delivered' && new Date(o.statusAt).toDateString() === today).length;
    const collect = orders.reduce((s, o) => s + o.toCollect, 0);
    view.innerHTML = `
      ${subtabs(BASE, [
        { id: '', label: t('staff.courier.active'), icon: 'i-truck', count: scope === 'active' ? orders.length : 0 },
        { id: 'done', label: t('staff.courier.done'), icon: 'i-check' },
      ], scope === 'done' ? 'done' : '')}
      ${
        scope === 'active'
          ? kpis([
              { label: t('staff.courier.inRoute'), value: fmtNumber(orders.length) },
              { label: t('staff.courier.toPickup'), value: fmtNumber(orders.filter((o) => o.status === 'handed_to_delivery').length), tone: 'warn' },
              { label: t('staff.courier.toCollect'), value: money(collect), tone: collect ? 'accent' : '' },
              { label: t('staff.courier.deliveredToday'), value: fmtNumber(deliveredToday), tone: 'ok' },
            ])
          : ''
      }
      ${
        orders.length
          ? `<ol class="routes">${orders.map((o, i) => routeCard(o, i, scope)).join('')}</ol>`
          : empty({ ornament: 'orn-cross', title: t(scope === 'active' ? 'staff.courier.none' : 'staff.courier.noneDone'), text: scope === 'active' ? t('staff.courier.noneText') : '' })
      }`;
    ctx.reveal();
  }

  await draw();
  view.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-advance]');
    if (!b) return;
    const card = b.closest('.route');
    const to = b.dataset.to;
    if (to === 'delivered' && Number(b.dataset.collect) > 0) {
      const ok = await confirmModal({ title: t('staff.courier.confirmTitle'), text: t('staff.courier.confirmCash', { sum: card.querySelector('[data-collect-sum]').textContent }), confirmLabel: t('staff.courier.handOver') });
      if (!ok) return;
    }
    await withLoading(b, async () => {
      try {
        const { result } = await api.post(`/courier/orders/${b.dataset.advance}/advance`, {});
        toast.success(t('staff.courier.updated', { number: result.orderNumber }), t(`statuses.${result.to}`));
        card.classList.add('is-leaving');
        setTimeout(draw, 380);
      } catch (err) {
        toast.error(err.message);
      }
    });
  });
  timer = setInterval(() => draw().catch(() => {}), 30_000);
  return () => clearInterval(timer);
}

function routeCard(o, i, scope) {
  const steps = ['handed_to_delivery', 'in_transit', ...(o.delivery.isPickup ? ['arrived'] : []), 'delivered'];
  const at = steps.indexOf(o.status);
  const [label, ic] = NEXT_ACTION[o.next] || [];
  const lines = String(o.address || '').split('\n');
  return `<li class="route" data-reveal>
    <div class="route__n t-mono">${String(i + 1).padStart(2, '0')}</div>
    <div class="route__main">
      <header class="route__head">
        <a class="route__num t-mono" href="/account/deliveries/order/${o.id}" data-acc-link>${esc(o.orderNumber)}</a>
        ${statusBadge(o.status)}
        <span class="t-mono t-muted">${esc(loc(o.delivery.name))}</span>
      </header>
      <ol class="route__steps" style="--at:${at};--n:${steps.length}" aria-label="${esc(t('staff.courier.progress'))}">${steps.map((s, k) => `<li class="${k < at ? 'is-done' : k === at ? 'is-current' : ''}"><span></span><i class="t-mono">${esc(t(`statuses.${s}`))}</i></li>`).join('')}</ol>
      <div class="route__grid">
        <div class="route__addr">
          <p class="route__label t-mono">${icon('i-pin', 'icon icon--xs')} ${esc(t(o.delivery.isPickup ? 'staff.courier.pickupPoint' : 'staff.courier.address'))}</p>
          <p class="route__addr-text">${lines.slice(1).map((l) => esc(l)).join('<br>')}</p>
          ${o.comment ? `<p class="route__comment">${icon('i-chat', 'icon icon--xs')} ${esc(o.comment)}</p>` : ''}
        </div>
        <div class="route__who">
          <p class="route__label t-mono">${icon('i-user', 'icon icon--xs')} ${esc(t('staff.courier.recipient'))}</p>
          <p>${esc(o.recipient.name)}</p>
          <a class="route__phone t-mono link-u" href="tel:${esc(o.recipient.phone.replace(/[^\d+]/g, ''))}">${icon('i-phone', 'icon icon--xs')} ${esc(o.recipient.phone)}</a>
        </div>
        <div class="route__items">
          <p class="route__label t-mono">${icon('i-box', 'icon icon--xs')} ${esc(t('account.items', { n: o.items.reduce((s, x) => s + x.qty, 0) }))}</p>
          ${itemsStrip(o.items, 4)}
        </div>
      </div>
    </div>
    <aside class="route__side">
      ${o.toCollect ? `<p class="route__cash"><span class="t-mono">${icon('i-cash', 'icon icon--xs')} ${esc(t('staff.courier.collect'))}</span><b data-collect-sum>${money(o.toCollect)}</b></p>` : `<p class="route__paid t-mono">${icon('i-check', 'icon icon--xs')} ${esc(t('staff.courier.prepaid'))}</p>`}
      ${o.expectedDeliveryDate && scope === 'active' ? `<p class="t-mono t-muted">${esc(t('staff.courier.until', { date: fmtDate(o.expectedDeliveryDate) }))}</p>` : ''}
      <p class="t-mono t-muted" title="${esc(fmtDateTime(o.statusAt))}">${esc(since(o.statusAt))}</p>
      ${o.next ? `<button type="button" class="btn btn--sm ${o.next === 'delivered' ? 'btn--accent' : ''}" data-advance="${o.id}" data-to="${o.next}" data-collect="${o.toCollect}">${icon(ic, 'icon icon--sm')} ${esc(t(label))}</button>` : ''}
    </aside>
  </li>`;
}

async function renderDetail(view, ctx, id) {
  view.innerHTML = loading();
  const { order } = await api.get(`/courier/orders/${id}`);
  ctx.setHead({ eyebrow: t('staff.courier.eyebrow'), title: order.orderNumber, crumbs: [{ href: '/account/deliveries', label: t('account.nav.deliveries') }, { label: order.orderNumber }] });
  view.innerHTML = `
    <a class="link-u t-mono acc-back" href="/account/deliveries" data-acc-link>${esc(t('staff.courier.back'))}</a>
    <div class="odetail">
      <section class="odetail__main">
        <div class="odetail__status">${statusBadge(order.status)} ${statusBadge(order.paymentStatus, t(`payment.${order.paymentStatus}`))}</div>
        ${renderTimeline(order)}
        <h2 class="acc-h2">${esc(t('account.orderItems'))}</h2>
        <ul class="oitems">${order.items.map((i) => `<li class="oitem"><span class="oitem__img"><img src="${esc(i.image)}" alt="" loading="lazy"></span><div class="oitem__body"><p class="oitem__name">${esc(loc(i.name))}</p><p class="oitem__meta t-mono">${esc(i.sku)} · ${esc(i.size)} × ${i.quantity}</p></div></li>`).join('')}</ul>
      </section>
      <aside class="odetail__side">
        <dl class="odetail__info">
          <div><dt class="t-mono">${esc(t('staff.courier.recipient'))}</dt><dd>${esc(order.contact.name)}<br><a class="t-mono link-u" href="tel:${esc(order.contact.phone.replace(/[^\d+]/g, ''))}">${esc(order.contact.phone)}</a></dd></div>
          <div><dt class="t-mono">${esc(t('account.address'))}</dt><dd>${esc(order.address).replace(/\n/g, '<br>')}</dd></div>
          <div><dt class="t-mono">${esc(t('account.delivery'))}</dt><dd>${esc(loc(order.delivery.name))}</dd></div>
          <div><dt class="t-mono">${esc(t('account.payment'))}</dt><dd>${esc(loc(order.payment.name))}</dd></div>
          <div><dt class="t-mono">${esc(t('account.trackingNumber'))}</dt><dd class="t-mono">${esc(order.trackingNumber)}</dd></div>
          ${order.comment ? `<div><dt class="t-mono">${esc(t('account.comment'))}</dt><dd>${esc(order.comment)}</dd></div>` : ''}
        </dl>
      </aside>
    </div>`;
}
