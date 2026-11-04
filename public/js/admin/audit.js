// Админка → Журнал действий (раздел 8 ТЗ, роль owner): все изменения сотрудников из audit_log — фильтры по пользователю,
// действию, сущности и дате, поиск по данным, CSV; по клику — модалка «было / стало» с подсветкой изменённых полей.
// API: GET /api/admin/audit, GET /api/admin/audit/filters
import { $, esc } from '../core/dom.js';
import { t, fmtDateTime } from '../core/i18n.js';
import api from '../core/api.js';
import { openModal } from '../ui/modal.js';
import { createTable } from '../account/table.js';

const show = (v) => (v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));

function diffModal(row) {
  const oldD = row.oldData || {};
  const newD = row.newData || {};
  const keys = [...new Set([...Object.keys(oldD), ...Object.keys(newD)])];
  openModal({
    title: `${row.action} · #${row.entityId ?? '—'}`,
    size: 'wide',
    content: `
      <p class="t-mono t-muted">${esc(fmtDateTime(row.createdAt))} · ${esc(row.author || t('staff.system'))}${row.role ? ` (${esc(t(`roles.${row.role}`))})` : ''} · ${esc(row.entity)} · IP ${esc(row.ip || '—')}</p>
      ${
        keys.length
          ? `<div class="table-wrap"><table class="table diff"><thead><tr><th>${esc(t('admin.audit.field'))}</th><th>${esc(t('admin.audit.before'))}</th><th>${esc(t('admin.audit.after'))}</th></tr></thead>
              <tbody>${keys.map((k) => { const changed = show(oldD[k]) !== show(newD[k]); return `<tr class="${changed ? 'is-changed' : ''}"><td class="t-mono">${esc(k)}</td><td class="diff__old">${esc(show(oldD[k]))}</td><td class="diff__new">${esc(show(newD[k]))}</td></tr>`; }).join('')}</tbody></table></div>`
          : `<p class="t-muted">${esc(t('admin.audit.noData'))}</p>`
      }`,
  });
}

export async function render(view) {
  const filters = await api.get('/admin/audit/filters');
  view.innerHTML = `
    <form class="dt-dates" data-dates>
      <label class="dt__filter"><span class="dt__filter-label t-mono">${esc(t('staff.from'))}</span><input class="input" type="date" name="from"></label>
      <label class="dt__filter"><span class="dt__filter-label t-mono">${esc(t('staff.to'))}</span><input class="input" type="date" name="to"></label>
    </form>
    <div data-table></div>`;
  const dates = $('[data-dates]', view);
  const table = createTable($('[data-table]', view), {
    csv: 'amfibia-audit-log',
    sort: 'created',
    pageSize: 30,
    search: { placeholder: t('admin.audit.searchPh') },
    filters: [
      { name: 'user', label: t('admin.audit.user'), value: '', options: [{ value: '', label: t('common.all') }, ...filters.users.map((u) => ({ value: u.id, label: `${u.name} · ${t(`roles.${u.role}`)}` }))] },
      { name: 'action', label: t('admin.audit.action'), value: '', options: [{ value: '', label: t('common.all') }, ...filters.actions.map((a) => ({ value: a, label: a }))] },
      { name: 'entity', label: t('admin.audit.entity'), value: '', options: [{ value: '', label: t('common.all') }, ...filters.entities.map((a) => ({ value: a, label: a }))] },
    ],
    load: (s) => api.get('/admin/audit', { ...s, from: dates.elements.from.value, to: dates.elements.to.value }),
    onRow: diffModal,
    columns: [
      { key: 'createdAt', label: t('staff.col.date'), sort: 'created', className: 't-mono', render: (r) => esc(fmtDateTime(r.createdAt)), csv: (r) => r.createdAt },
      { key: 'author', label: t('admin.audit.user'), render: (r) => `${esc(r.author || t('staff.system'))}${r.role ? `<span class="dt-sub t-mono">${esc(t(`roles.${r.role}`))}</span>` : ''}`, csv: (r) => r.author || '' },
      { key: 'action', label: t('admin.audit.action'), sort: 'action', className: 't-mono', render: (r) => `<span class="audit-act audit-act--${esc(r.action.split('.').pop())}">${esc(r.action)}</span>` },
      { key: 'entity', label: t('admin.audit.entity'), sort: 'entity', className: 't-mono dt__hide-sm', render: (r) => `${esc(r.entity)}${r.entityId ? ` #${r.entityId}` : ''}`, csv: (r) => `${r.entity} ${r.entityId || ''}` },
      { key: 'changes', label: t('admin.audit.changes'), className: 'dt__wide dt__muted', render: (r) => esc(Object.keys({ ...(r.oldData || {}), ...(r.newData || {}) }).slice(0, 5).join(', ')), csv: (r) => JSON.stringify({ old: r.oldData, new: r.newData }) },
      { key: 'ip', label: 'IP', className: 't-mono dt__hide-sm' },
    ],
  });
  dates.addEventListener('change', () => {
    table.state.page = 1;
    table.reload();
  });
}
