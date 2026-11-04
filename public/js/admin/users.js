// Админка → Пользователи (раздел 8 ТЗ): список (поиск, фильтры роли и статуса, сортировка, массовая блокировка, CSV),
// карточка пользователя (данные, активность, заказы, попытки входа), редактирование, блокировка / разблокировка /
// мягкое удаление (с подтверждением), сброс пароля, смена роли и создание сотрудников — только owner.
// API: /api/admin/users* (server/routes/api/admin.js)
import { $, esc, icon, initials } from '../core/dom.js';
import { t, fmtDate, fmtDateTime, fmtRelative, fmtNumber } from '../core/i18n.js';
import api from '../core/api.js';
import { confirmModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { statusBadge, loading } from '../account/common.js';
import { createTable } from '../account/table.js';
import { money } from '../account/staff.js';
import { openForm } from './form.js';

const ROLES = ['buyer', 'seller', 'warehouse', 'courier', 'support', 'moderator', 'owner'];
const STATUS_TONE = { active: 'approved', blocked: 'rejected', deleted: 'closed' };

export async function render(view, ctx, params) {
  if (params[0]) return renderUser(view, ctx, Number(params[0]));
  const isOwner = ctx.user.role === 'owner';
  view.innerHTML = '<div data-table></div>';
  const table = createTable($('[data-table]', view), {
    csv: 'amfibia-users',
    sort: 'created',
    search: { placeholder: t('admin.users.searchPh') },
    filters: [
      { name: 'role', label: t('admin.users.role'), value: 'all', options: [{ value: 'all', label: t('common.all') }, ...ROLES.map((r) => ({ value: r, label: t(`roles.${r}`) }))] },
      { name: 'status', label: t('staff.col.status'), value: 'all', options: ['all', 'active', 'blocked', 'deleted'].map((s) => ({ value: s, label: s === 'all' ? t('common.all') : t(`admin.users.st.${s}`) })) },
    ],
    toolbar: isOwner ? `<button type="button" class="btn btn--sm" data-create>${icon('i-plus', 'icon icon--sm')} ${esc(t('admin.users.create'))}</button>` : '',
    selectable: true,
    bulk: [
      { id: 'block', label: t('admin.users.block'), danger: true, confirm: (n) => t('admin.users.bulkBlockText', { n }), action: (ids) => api.post('/admin/users/bulk', { ids, action: 'block' }).then((r) => toast.success(t('admin.changed', { n: r.changed }))) },
      { id: 'unblock', label: t('admin.users.unblock'), action: (ids) => api.post('/admin/users/bulk', { ids, action: 'unblock' }).then((r) => toast.success(t('admin.changed', { n: r.changed }))) },
    ],
    load: (s) => api.get('/admin/users', s),
    onRow: (u) => ctx.navigate(`/admin/users/${u.id}`),
    rowClass: (u) => (u.status !== 'active' ? 'is-bad' : ''),
    columns: [
      { key: 'name', label: t('admin.users.user'), sort: 'name', className: 'dt__wide', render: (u) => `<span class="dt-user"><span class="avatar avatar--sm">${u.avatar ? `<img src="${esc(u.avatar)}" alt="">` : esc(initials(u.firstName, u.lastName))}</span><span><a href="/admin/users/${u.id}" data-adm-link>${esc(`${u.firstName} ${u.lastName}`)}</a><span class="dt-sub">${esc(u.email)}</span></span></span>`, csv: (u) => `${u.firstName} ${u.lastName}` },
      { key: 'email', label: 'Email', className: 'dt__hide-sm', render: (u) => `${esc(u.phone || '—')}${u.twoFactor ? ` <span class="dt-sub">${icon('i-lock', 'icon icon--xs')} 2FA</span>` : ''}`, csv: (u) => u.email },
      { key: 'role', label: t('admin.users.role'), sort: 'role', render: (u) => `<span class="role-chip role-chip--${u.role}">${esc(t(`roles.${u.role}`))}</span>`, csv: (u) => u.role },
      { key: 'status', label: t('staff.col.status'), sort: 'status', render: (u) => statusBadge(STATUS_TONE[u.status], t(`admin.users.st.${u.status}`)), csv: (u) => u.status },
      { key: 'orders', label: t('admin.users.orders'), sort: 'orders', className: 't-mono dt__hide-sm' },
      { key: 'spent', label: t('admin.users.spent'), sort: 'spent', className: 't-mono dt__hide-sm', render: (u) => money(u.spent), csv: (u) => u.spent },
      { key: 'lastLoginAt', label: t('admin.users.lastLogin'), sort: 'login', className: 't-mono dt__hide-sm', render: (u) => esc(u.lastLoginAt ? fmtRelative(u.lastLoginAt) : '—'), csv: (u) => u.lastLoginAt || '' },
      { key: 'createdAt', label: t('admin.users.since'), sort: 'created', className: 't-mono dt__hide-sm', render: (u) => esc(fmtDate(u.createdAt, { day: '2-digit', month: '2-digit', year: 'numeric' })), csv: (u) => u.createdAt },
    ],
  });
  view.addEventListener('click', (e) => {
    if (!e.target.closest('[data-create]')) return;
    openForm({
      title: t('admin.users.create'),
      intro: t('admin.users.createIntro'),
      fields: [
        { name: 'firstName', label: t('account.firstName'), required: true },
        { name: 'lastName', label: t('account.lastName'), required: true },
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'phone', label: t('admin.users.phone'), hint: '+375291234567' },
        { name: 'role', label: t('admin.users.role'), type: 'select', options: ROLES.filter((r) => r !== 'owner').map((r) => ({ value: r, label: t(`roles.${r}`) })) },
        { name: 'password', label: t('admin.users.password'), type: 'password', hint: t('admin.users.passwordHint') },
      ],
      values: { role: 'support' },
      submitLabel: t('admin.users.create'),
      onSubmit: async (data) => {
        const r = await api.post('/admin/users', data);
        toast.success(t('admin.users.created'), r.temporaryPassword ? t('admin.users.tempPassword') : '');
        table.reload();
      },
    });
  });
}

async function renderUser(view, ctx, id) {
  const isOwner = ctx.user.role === 'owner';
  let data;
  const load = async () => (data = await api.get(`/admin/users/${id}`));
  view.innerHTML = loading();
  await load();

  function draw() {
    const u = data.user;
    const s = data.stats;
    const self = u.id === ctx.user.id;
    const protectedOwner = u.role === 'owner' && !isOwner;
    ctx.setHead({ eyebrow: `${t('admin.nav.users')} · #${u.id}`, title: `${u.firstName} ${u.lastName}` });
    view.innerHTML = `
      <a class="link-u t-mono acc-back" href="/admin/users" data-adm-link>${esc(t('admin.users.back'))}</a>
      <div class="adm-user">
        <section class="adm-user__card" data-reveal>
          <span class="avatar avatar--lg">${u.avatar ? `<img src="${esc(u.avatar)}" alt="">` : esc(initials(u.firstName, u.lastName))}</span>
          <div class="adm-user__id">
            <p class="adm-user__name">${esc(`${u.firstName} ${u.lastName}`)}</p>
            <p class="t-mono">${esc(u.email)} ${u.emailVerified ? icon('i-check', 'icon icon--xs') : `<span class="t-muted">(${esc(t('admin.users.notVerified'))})</span>`}</p>
            <p class="t-mono t-muted">${esc(u.phone || '—')} · ${esc(u.lang.toUpperCase())} · ${esc(u.currency)} · ${esc(t(`header.themes.${u.theme}`))}${u.twoFactor ? ' · 2FA' : ''}</p>
            <p><span class="role-chip role-chip--${u.role}">${esc(t(`roles.${u.role}`))}</span> ${statusBadge(STATUS_TONE[u.status], t(`admin.users.st.${u.status}`))}</p>
          </div>
          <dl class="adm-user__facts">
            <div><dt class="t-mono">${esc(t('admin.users.since'))}</dt><dd>${esc(fmtDate(u.createdAt))}</dd></div>
            <div><dt class="t-mono">${esc(t('admin.users.lastLogin'))}</dt><dd>${esc(u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : '—')}</dd></div>
            <div><dt class="t-mono">${esc(t('admin.users.orders'))}</dt><dd>${fmtNumber(s.orders)}</dd></div>
            <div><dt class="t-mono">${esc(t('admin.users.spent'))}</dt><dd>${money(s.spent)}</dd></div>
            <div><dt class="t-mono">${esc(t('admin.users.reviews'))}</dt><dd>${fmtNumber(s.reviews)}</dd></div>
            <div><dt class="t-mono">${esc(t('admin.users.products'))}</dt><dd>${fmtNumber(s.products)}</dd></div>
          </dl>
          ${
            protectedOwner
              ? `<p class="notice">${esc(t('admin.users.ownerProtected'))}</p>`
              : `<div class="adm-user__actions">
                  <button type="button" class="btn btn--sm btn--ghost" data-edit>${icon('i-edit', 'icon icon--sm')} ${esc(t('common.edit'))}</button>
                  <button type="button" class="btn btn--sm btn--ghost" data-reset>${icon('i-lock', 'icon icon--sm')} ${esc(t('admin.users.resetPassword'))}</button>
                  ${self ? '' : u.status === 'active' ? `<button type="button" class="btn btn--sm btn--danger" data-status="blocked">${esc(t('admin.users.block'))}</button>` : `<button type="button" class="btn btn--sm" data-status="active">${esc(t('admin.users.unblock'))}</button>`}
                  ${self || u.status === 'deleted' ? '' : `<button type="button" class="link-u t-mono adm-user__del" data-status="deleted">${icon('i-trash', 'icon icon--xs')} ${esc(t('admin.users.softDelete'))}</button>`}
                </div>`
          }
          ${
            isOwner && !self
              ? `<form class="adm-user__role" data-role-form><label class="field__label" for="u-role">${esc(t('admin.users.changeRole'))}</label>
                  <div class="adm-inline"><select class="select" id="u-role" name="role">${ROLES.map((r) => `<option value="${r}" ${r === u.role ? 'selected' : ''}>${esc(t(`roles.${r}`))}</option>`).join('')}</select>
                  <button type="submit" class="btn btn--sm">${esc(t('common.save'))}</button></div></form>`
              : ''
          }
        </section>
        <section class="adm-user__orders" data-reveal>
          <h2 class="acc-h2">${esc(t('admin.users.lastOrders'))}</h2>
          ${data.orders.length ? `<ul class="adm-recent">${data.orders.map((o) => `<li><a href="${isOwner ? `/admin/orders/${o.id}` : `/account/desk/orders/${o.id}`}" ${isOwner ? 'data-adm-link' : ''}><b class="t-mono">${esc(o.orderNumber)}</b><span><i class="t-mono">${esc(fmtDateTime(o.createdAt))}</i></span>${statusBadge(o.status)}<span class="t-mono">${money(o.total)}</span></a></li>`).join('')}</ul>` : `<p class="t-muted">${esc(t('account.noOrders'))}</p>`}
          ${data.sellerApplication ? `<h2 class="acc-h2">${esc(t('admin.nav.sellers'))}</h2><p>${esc(data.sellerApplication.shop_name)} ${statusBadge(data.sellerApplication.status, t(`account.sellerStatus.${data.sellerApplication.status}`))}</p>` : ''}
          <h2 class="acc-h2">${esc(t('admin.users.logins'))}</h2>
          ${data.logins.length ? `<ul class="adm-logins">${data.logins.map((l) => `<li class="t-mono"><span class="${l.success ? 't-success' : 't-danger'}">${l.success ? '✓' : '✕'}</span> ${esc(fmtDateTime(l.at))} · ${esc(l.ip || '')}</li>`).join('')}</ul>` : '<p class="t-muted">—</p>'}
        </section>
      </div>`;
  }
  draw();

  view.addEventListener('click', async (e) => {
    const u = data.user;
    if (e.target.closest('[data-edit]')) {
      openForm({
        title: t('common.edit'),
        fields: [
          { name: 'firstName', label: t('account.firstName'), required: true },
          { name: 'lastName', label: t('account.lastName'), required: true },
          { name: 'email', label: 'Email', type: 'email', required: true },
          { name: 'phone', label: t('admin.users.phone') },
          { name: 'emailVerified', label: t('admin.users.emailVerified'), type: 'checkbox', wide: true },
        ],
        values: u,
        onSubmit: async (v) => {
          await api.put(`/admin/users/${u.id}`, v);
          toast.success(t('account.saved'));
          await load();
          draw();
        },
      });
      return;
    }
    if (e.target.closest('[data-reset]')) {
      if (!(await confirmModal({ title: t('admin.users.resetPassword'), text: t('admin.users.resetText'), confirmLabel: t('admin.users.resetPassword') }))) return;
      const r = await api.post(`/admin/users/${u.id}/reset-password`);
      toast.success(r.message);
      return;
    }
    const st = e.target.closest('[data-status]');
    if (st) {
      const status = st.dataset.status;
      if (status !== 'active' && !(await confirmModal({ title: t(status === 'blocked' ? 'admin.users.block' : 'admin.users.softDelete'), text: t(status === 'blocked' ? 'admin.users.blockText' : 'admin.users.deleteText', { name: `${u.firstName} ${u.lastName}` }), danger: true, confirmLabel: t(status === 'blocked' ? 'admin.users.block' : 'admin.users.softDelete') }))) return;
      try {
        await api.post(`/admin/users/${u.id}/status`, { status });
        toast.success(t(`admin.users.st.${status}`));
        await load();
        draw();
      } catch (err) {
        toast.error(err.message);
      }
    }
  });
  view.addEventListener('submit', async (e) => {
    if (!e.target.matches('[data-role-form]')) return;
    e.preventDefault();
    const role = e.target.elements.role.value;
    if (!(await confirmModal({ title: t('admin.users.changeRole'), text: t('admin.users.roleText', { role: t(`roles.${role}`) }), confirmLabel: t('common.save') }))) return;
    try {
      await api.patch(`/admin/users/${data.user.id}/role`, { role });
      toast.success(t('admin.users.roleChanged'));
      await load();
      draw();
    } catch (err) {
      toast.error(err.message);
    }
  });
}
