// Кабинет → Возвраты: мои заявки на возврат и их статусы (pending / approved / rejected, принят ли товар складом).
// API: GET /api/returns (return_requests JOIN order_items, orders)
import { esc, icon } from '../core/dom.js';
import { t, loc, fmtDate } from '../core/i18n.js';
import api from '../core/api.js';
import { formatPrice } from '../core/currency.js';
import { statusBadge, empty, loading } from './common.js';

export async function render(view) {
  view.innerHTML = loading();
  const { returns } = await api.get('/returns');
  if (!returns.length) {
    view.innerHTML = empty({ ornament: 'orn-fleur', title: t('account.noReturns'), text: t('account.noReturnsText'), action: `<a class="btn btn--ghost" href="/account/orders?status=done" data-acc-link>${esc(t('account.nav.orders'))}</a>` });
    return;
  }
  view.innerHTML = `<p class="t-muted acc-note">${esc(t('account.returnRule'))}</p>
    <ul class="rlist">${returns
      .map(
        (r) => `<li class="ritem" data-reveal>
          <img class="ritem__img" src="${esc(r.item.image)}" alt="" loading="lazy">
          <div class="ritem__body">
            <p class="ritem__name">${esc(loc(r.item.name))}</p>
            <p class="t-mono t-muted">${esc(r.orderNumber)} · ${esc(r.item.size)} × ${r.quantity} · ${formatPrice(r.item.price * r.quantity)}</p>
            <p class="ritem__reason"><b>${esc(t(`account.returnReasons.${r.reasonCode}`))}.</b> ${esc(r.reason)}</p>
            ${r.comment ? `<p class="ritem__comment">${icon('i-chat', 'icon icon--xs')} ${esc(r.comment)}</p>` : ''}
            ${r.received ? `<p class="t-mono ritem__received">${icon('i-check', 'icon icon--xs')} ${esc(t('account.returnReceived'))}</p>` : ''}
          </div>
          <div class="ritem__side">${statusBadge(r.status, t(`account.returnStatus.${r.status}`))}<span class="t-mono t-muted">${esc(fmtDate(r.createdAt))}</span>
            ${r.photo ? `<a href="${esc(r.photo)}" target="_blank" rel="noopener" class="ritem__photo"><img src="${esc(r.photo)}" alt=""></a>` : ''}</div>
        </li>`
      )
      .join('')}</ul>`;
}
