// Кабинет → Обзор: приветствие, статистика, последние заказы, быстрые действия.
// API: GET /api/account (orders, wishlist, reviews — COUNT), GET /api/orders?page=1
import { esc, icon } from '../core/dom.js';
import { t, fmtDate } from '../core/i18n.js';
import api from '../core/api.js';
import { formatPrice } from '../core/currency.js';
import { statusBadge, empty, orderMoney, loading } from './common.js';

export async function render(view, ctx) {
  view.innerHTML = loading();
  const [acc, orders] = await Promise.all([api.get('/account'), api.get('/orders', { page: 1 })]);
  const u = acc.user;
  ctx.setHead({ eyebrow: t('account.eyebrow'), title: t('account.greeting', { name: u.firstName }), crumbs: [{ label: t('account.nav.overview') }] });
  const s = acc.stats;
  const stats = [
    ['orders', s.orders, '/account/orders'],
    ['active', s.activeOrders, '/account/orders?status=active'],
    ['spent', `<span data-price="${s.spent}">${formatPrice(s.spent)}</span>`, '/account/orders?status=done'],
    ['wishlist', s.wishlist, '/wishlist'],
    ['reviews', s.reviews, '/account/reviews'],
  ];
  const recent = orders.orders.slice(0, 3);
  view.innerHTML = `
    <ul class="acc-stats">${stats
      .map(([k, v, href], i) => `<li data-reveal><a href="${href}" ${href.startsWith('/account') ? 'data-acc-link' : ''}><span class="acc-stats__n t-mono">${String(i + 1).padStart(2, '0')}</span><span class="acc-stats__v">${v}</span><span class="acc-stats__k t-mono">${esc(t(`account.stats.${k}`))}</span></a></li>`)
      .join('')}</ul>

    <section class="acc-block">
      <header class="acc-block__head"><h2>${esc(t('account.recentOrders'))}</h2>${recent.length ? `<a class="link-u t-mono" href="/account/orders" data-acc-link>${esc(t('account.allOrders'))}</a>` : ''}</header>
      ${
        recent.length
          ? `<ul class="olist">${recent.map(orderRow).join('')}</ul>`
          : empty({ title: t('account.noOrders'), text: t('account.noOrdersText'), action: `<a class="btn" href="/catalog">${esc(t('account.toCatalog'))}</a>` })
      }
    </section>

    <section class="acc-block">
      <header class="acc-block__head"><h2>${esc(t('account.quick'))}</h2></header>
      <div class="acc-quick">
        <a href="/tracking" data-reveal>${icon('i-truck')}<span>${esc(t('account.quickTrack'))}</span></a>
        <a href="/account/support" data-acc-link data-reveal>${icon('i-chat')}<span>${esc(t('account.quickSupport'))}</span></a>
        <a href="/account/addresses" data-acc-link data-reveal>${icon('i-pin')}<span>${esc(t('account.quickAddress'))}</span></a>
        ${u.role === 'buyer' ? `<a href="/account/seller" data-acc-link data-reveal>${icon('i-sparkle')}<span>${esc(t('account.quickSeller'))}</span></a>` : ''}
      </div>
    </section>`;
}

export function orderRow(o) {
  const thumbs = o.items.slice(0, 4).map((i) => `<img src="${esc(i.image)}" alt="" loading="lazy">`).join('');
  return `<li class="orow" data-reveal>
    <a class="orow__link" href="/account/orders/${o.id}" data-acc-link>
      <span class="orow__thumbs">${thumbs}${o.items.length > 4 ? `<b class="t-mono">+${o.items.length - 4}</b>` : ''}</span>
      <span class="orow__main">
        <span class="orow__num t-mono">${esc(o.orderNumber)}</span>
        <span class="orow__meta">${esc(t('account.from', { date: fmtDate(o.createdAt) }))} · ${esc(t('account.items', { n: o.count }))}</span>
      </span>
      <span class="orow__status">${statusBadge(o.status)}</span>
      <span class="orow__sum t-mono">${orderMoney(o)}</span>
      <span class="orow__go">${icon('i-arrow-right', 'icon icon--sm')}</span>
    </a>
  </li>`;
}
