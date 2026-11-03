// Кабинет → Уведомления: смена статуса заказа, ответы поддержки, решения по возвратам и заявкам.
// Клик по уведомлению отмечает его прочитанным и открывает ссылку. API: /api/notifications (таблица notifications)
import { esc, icon } from '../core/dom.js';
import { t, loc, fmtRelative } from '../core/i18n.js';
import api from '../core/api.js';
import { setCount } from '../core/store.js';
import { empty, pager, loading } from './common.js';

const ICON = { order_status: 'i-box', ticket_reply: 'i-chat', return_decision: 'i-return', seller_application: 'i-sparkle', product_moderation: 'i-shield', system: 'i-info' };

export async function render(view, ctx) {
  let page = 1;
  let unread = false;
  async function load() {
    const data = await api.get('/notifications', { page, limit: 15, unread: unread ? '1' : '' });
    const items = data.items || data.notifications || [];
    view.innerHTML = `
      <div class="acc-toolbar">
        <label class="switch"><input type="checkbox" data-unread ${unread ? 'checked' : ''}><span class="switch__track"></span><span>${esc(t('account.unreadOnly'))}</span></label>
        <button type="button" class="btn btn--sm btn--ghost" data-read-all>${icon('i-check', 'icon icon--sm')} ${esc(t('account.markAllRead'))}</button>
      </div>
      ${
        items.length
          ? `<ul class="nlist">${items
              .map(
                (n) => `<li class="nitem ${n.isRead ? '' : 'is-unread'}" data-reveal>
                  <a class="nitem__link" href="${esc(n.link || '#')}" data-notif="${n.id}" ${n.link && n.link.startsWith('/account') ? 'data-acc-link' : ''}>
                    <span class="nitem__icon">${icon(ICON[n.type] || 'i-bell', 'icon icon--sm')}</span>
                    <span class="nitem__body"><span class="nitem__title">${esc(loc(n.title))}</span>${loc(n.text) ? `<span class="nitem__text">${esc(loc(n.text))}</span>` : ''}</span>
                    <span class="nitem__time t-mono">${esc(fmtRelative(n.createdAt))}</span>
                  </a>
                </li>`
              )
              .join('')}</ul>${pager(page, Math.max(1, Math.ceil(data.total / 15)))}`
          : empty({ ornament: 'orn-star', title: t('account.noNotifications') })
      }`;
    ctx.reveal();
  }
  view.addEventListener('change', (e) => {
    if (e.target.matches('[data-unread]')) {
      unread = e.target.checked;
      page = 1;
      load();
    }
  });
  view.addEventListener('click', async (e) => {
    if (e.target.closest('[data-read-all]')) {
      await api.post('/notifications/read-all');
      setCount('notifications', 0);
      return load();
    }
    const p = e.target.closest('[data-page-go]');
    if (p) {
      page = Number(p.dataset.pageGo);
      return load();
    }
    const n = e.target.closest('[data-notif]');
    if (n) {
      n.closest('.nitem').classList.remove('is-unread');
      api.post(`/notifications/${n.dataset.notif}/read`).then((r) => r && typeof r.count === 'number' && setCount('notifications', r.count)).catch(() => {});
      if (n.getAttribute('href') === '#') e.preventDefault();
    }
  });
  view.innerHTML = loading();
  await load();
}
