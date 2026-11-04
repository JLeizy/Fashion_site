// Админка → Заявки «Стать продавцом» (раздел 4 ТЗ, роль moderator / owner): карточки заявок с описанием магазина
// и данными пользователя; одобрение (в одной транзакции роль пользователя меняется на seller) или отказ с комментарием.
// API: GET /api/admin/seller-applications, POST /api/admin/seller-applications/:id/resolve
import { esc, icon, initials } from '../core/dom.js';
import { t, fmtDate, fmtDateTime } from '../core/i18n.js';
import api from '../core/api.js';
import { toast } from '../ui/toast.js';
import { statusBadge, empty, loading } from '../account/common.js';
import { openForm } from './form.js';

export async function render(view, ctx) {
  let status = 'pending';
  async function draw() {
    const { applications } = await api.get('/admin/seller-applications', { status });
    view.innerHTML = `
      <div class="seg acc-filter" role="tablist">${['pending', 'approved', 'rejected', 'all'].map((s) => `<button type="button" role="tab" data-st="${s}" aria-selected="${s === status}" aria-pressed="${s === status}">${esc(s === 'all' ? t('common.all') : t(`account.sellerStatus.${s}`))}</button>`).join('')}</div>
      ${
        applications.length
          ? `<div class="apps">${applications
              .map(
                (a) => `<article class="app" data-reveal>
                  <header class="app__head"><span class="avatar">${esc(initials(...a.name.split(' ')))}</span>
                    <div><p class="app__shop">${esc(a.shopName)}</p><p class="t-mono t-muted">${esc(a.name)} · ${esc(a.email)}</p></div>
                    ${statusBadge(a.status, t(`account.sellerStatus.${a.status}`))}</header>
                  <p class="app__desc">${esc(a.description)}</p>
                  <dl class="app__facts">
                    <div><dt class="t-mono">${esc(t('admin.sellers.filed'))}</dt><dd>${esc(fmtDateTime(a.createdAt))}</dd></div>
                    <div><dt class="t-mono">${esc(t('admin.users.since'))}</dt><dd>${esc(fmtDate(a.userSince))}</dd></div>
                    <div><dt class="t-mono">${esc(t('admin.users.orders'))}</dt><dd>${a.orders}</dd></div>
                    <div><dt class="t-mono">${esc(t('admin.users.role'))}</dt><dd>${esc(t(`roles.${a.role}`))}</dd></div>
                  </dl>
                  ${a.comment ? `<p class="ritem__comment">${icon('i-chat', 'icon icon--xs')} ${esc(a.comment)}${a.reviewer ? ` — ${esc(a.reviewer)}` : ''}</p>` : ''}
                  ${a.status === 'pending' ? `<footer class="app__actions"><a class="link-u t-mono" href="/admin/users/${a.userId}" data-adm-link>${esc(t('admin.sellers.profile'))}</a>
                    <button type="button" class="btn btn--sm btn--ghost" data-reject="${a.id}">${esc(t('staff.desk.reject'))}</button>
                    <button type="button" class="btn btn--sm" data-approve="${a.id}">${icon('i-check', 'icon icon--sm')} ${esc(t('admin.sellers.approve'))}</button></footer>` : ''}
                </article>`
              )
              .join('')}</div>`
          : empty({ ornament: 'orn-fleur', title: t('admin.sellers.empty') })
      }`;
  }
  view.innerHTML = loading();
  await draw();
  const resolve = (id, decision, comment = '') => api.post(`/admin/seller-applications/${id}/resolve`, { decision, comment });
  view.addEventListener('click', async (e) => {
    const s = e.target.closest('[data-st]');
    if (s) {
      status = s.dataset.st;
      return draw();
    }
    const a = e.target.closest('[data-approve]');
    if (a) {
      try {
        await resolve(a.dataset.approve, 'approve');
        toast.success(t('admin.sellers.approved'));
        await ctx.refreshSummary();
        await draw();
      } catch (err) {
        toast.error(err.message);
      }
      return;
    }
    const r = e.target.closest('[data-reject]');
    if (r) {
      openForm({
        title: t('admin.sellers.rejectTitle'),
        size: '',
        fields: [{ name: 'comment', label: t('staff.desk.commentRequired'), type: 'textarea', rows: 3, required: true, wide: true }],
        submitLabel: t('staff.desk.reject'),
        onSubmit: async ({ comment }) => {
          await resolve(r.dataset.reject, 'reject', comment);
          toast.success(t('admin.sellers.rejected'));
          await ctx.refreshSummary();
          await draw();
        },
      });
    }
  });
}
