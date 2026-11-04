// Админка → Товары и модерация (раздел 8 ТЗ, роль moderator / owner):
//   «Очередь» — карточки товаров на модерации: фото, описание, характеристики, продавец; одобрить (с отметкой
//   «Проверено на подлинность»), отклонить с причиной;
//   «Все товары» — таблица (фильтры статуса, бренда, подлинности; массовые одобрение / отклонение / отметка подлинности; CSV).
// API: GET /api/admin/products, POST /api/admin/products/:id/moderate, POST /api/admin/products/bulk
import { $, esc, icon } from '../core/dom.js';
import { t, loc, fmtDateTime, fmtNumber, countryName } from '../core/i18n.js';
import api from '../core/api.js';
import { toast } from '../ui/toast.js';
import { statusBadge, empty, loading } from '../account/common.js';
import { createTable } from '../account/table.js';
import { subtabs, money } from '../account/staff.js';
import { openForm } from './form.js';

export async function render(view, ctx, params) {
  const tab = params[0] === 'all' ? 'all' : '';
  const brands = (await api.get('/brands')).brands || [];
  view.innerHTML = `${subtabs('/admin/products', [
    { id: '', label: t('admin.products.queue'), icon: 'i-shield', count: ctx.summary.products },
    { id: 'all', label: t('admin.products.all'), icon: 'i-catalog' },
  ], tab)}<div data-body></div>`;
  const body = $('[data-body]', view);
  const reject = (ids, after) =>
    openForm({
      title: t('admin.products.rejectTitle', { n: ids.length }),
      fields: [{ name: 'reason', label: t('admin.products.reason'), type: 'textarea', rows: 4, required: true, wide: true, hint: t('admin.products.reasonHint') }],
      submitLabel: t('staff.desk.reject'),
      size: '',
      onSubmit: async ({ reason }) => {
        if (ids.length === 1) await api.post(`/admin/products/${ids[0]}/moderate`, { decision: 'reject', reason });
        else await api.post('/admin/products/bulk', { ids, decision: 'reject', reason });
        toast.success(t('admin.products.rejected'));
        await ctx.refreshSummary();
        after();
      },
    });

  if (tab === 'all') {
    const table = createTable(body, {
      csv: 'amfibia-all-products',
      sort: 'updated',
      search: { placeholder: t('staff.shop.searchPh') },
      filters: [
        { name: 'status', label: t('staff.moderation'), value: 'all', options: ['all', 'pending', 'approved', 'rejected', 'draft'].map((s) => ({ value: s, label: s === 'all' ? t('common.all') : t(`staff.mod.${s}`) })) },
        { name: 'brand', label: t('staff.ed.brand'), value: '', options: [{ value: '', label: t('common.all') }, ...brands.map((b) => ({ value: b.id, label: b.name }))] },
        { name: 'verified', label: 'Verified', value: '', options: [{ value: '', label: t('common.all') }, { value: '1', label: t('common.yes') }, { value: '0', label: t('common.no') }] },
      ],
      selectable: true,
      bulk: [
        { id: 'approve', label: t('staff.desk.approve'), action: (ids) => api.post('/admin/products/bulk', { ids, decision: 'approve', authenticated: true }).then(() => toast.success(t('admin.products.approved'))).then(() => ctx.refreshSummary()) },
        { id: 'auth', label: t('admin.products.markVerified'), action: (ids) => api.post('/admin/products/bulk', { ids, decision: 'authenticate', authenticated: true }).then(() => toast.success(t('admin.changed', { n: ids.length }))) },
        { id: 'reject', label: t('staff.desk.reject'), danger: true, action: (ids) => new Promise((resolve) => reject(ids, () => { table.reload(); resolve(); })) },
      ],
      load: (s) => api.get('/admin/products', s),
      rowClass: (p) => (p.status === 'rejected' ? 'is-bad' : p.status === 'pending' ? 'is-low' : ''),
      columns: [
        { key: 'name', label: t('staff.col.product'), sort: 'name', className: 'dt__wide', render: (p) => `<span class="dt-prod"><img src="${esc(p.image)}" alt="" loading="lazy"><span><a class="dt-prod__name" href="/product/${p.id}" target="_blank" rel="noopener">${esc(loc(p.name))}</a><span class="dt-prod__meta t-mono">${esc(p.brand)} · ${esc(p.sku)}</span></span></span>`, csv: (p) => loc(p.name) },
        { key: 'seller', label: t('admin.products.seller'), className: 'dt__hide-sm', render: (p) => esc(p.seller.name), csv: (p) => p.seller.name },
        { key: 'price', label: t('staff.col.price'), sort: 'price', className: 't-mono', render: (p) => money(p.price), csv: (p) => p.price },
        { key: 'status', label: t('staff.moderation'), sort: 'status', render: (p) => `${statusBadge(p.status, t(`staff.mod.${p.status}`))}${p.authenticated ? `<span class="dt-verified" title="Verified by Amfibia">${icon('i-shield', 'icon icon--xs')}</span>` : ''}`, csv: (p) => p.status },
        { key: 'views', label: t('staff.col.views'), sort: 'views', className: 't-mono dt__hide-sm', render: (p) => fmtNumber(p.views), csv: (p) => p.views },
        { key: 'updatedAt', label: t('admin.updated'), sort: 'updated', className: 't-mono dt__hide-sm', render: (p) => esc(fmtDateTime(p.updatedAt)), csv: (p) => p.updatedAt },
        {
          key: 'actions', label: '', csv: false, className: 'dt__actions',
          render: (p) => `${ctx.user.role === 'owner' ? `<a class="icon-btn" href="/account/shop/products/${p.id}" title="${esc(t('common.edit'))}" aria-label="${esc(t('common.edit'))}">${icon('i-edit', 'icon icon--sm')}</a>` : ''}
            ${p.status !== 'approved' ? `<button type="button" class="icon-btn" data-approve="${p.id}" title="${esc(t('staff.desk.approve'))}" aria-label="${esc(t('staff.desk.approve'))}">${icon('i-check', 'icon icon--sm')}</button>` : ''}
            ${p.status !== 'rejected' ? `<button type="button" class="icon-btn" data-reject="${p.id}" title="${esc(t('staff.desk.reject'))}" aria-label="${esc(t('staff.desk.reject'))}">${icon('i-close', 'icon icon--sm')}</button>` : ''}`,
        },
      ],
    });
    body.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-approve]');
      if (a) {
        await api.post(`/admin/products/${a.dataset.approve}/moderate`, { decision: 'approve', authenticated: true });
        toast.success(t('admin.products.approved'));
        ctx.refreshSummary();
        return table.reload({ keepSelection: true });
      }
      const r = e.target.closest('[data-reject]');
      if (r) reject([Number(r.dataset.reject)], () => table.reload({ keepSelection: true }));
    });
    return;
  }

  // ---------- Очередь модерации ----------
  async function drawQueue() {
    const data = await api.get('/admin/products', { status: 'pending', sort: 'updated', dir: 'asc', limit: 30 });
    body.innerHTML = data.rows.length
      ? `<p class="t-muted acc-note">${esc(t('admin.products.queueLead', { n: data.total }))}</p><div class="modq">${data.rows
          .map(
            (p) => `<article class="modq__card" data-reveal data-id="${p.id}">
              <div class="modq__gallery">${p.images.slice(0, 4).map((src, i) => `<img src="${esc(src)}" alt="" loading="lazy" class="${i ? '' : 'is-main'}">`).join('')}</div>
              <div class="modq__body">
                <p class="modq__brand t-mono">${esc(p.brand)} · ${esc(p.sku)}</p>
                <h3 class="modq__name">${esc(loc(p.name))}</h3>
                <p class="modq__price t-mono">${money(p.price)}${p.oldPrice ? ` <s>${money(p.oldPrice)}</s>` : ''}</p>
                <p class="modq__desc">${esc(p.description)}</p>
                <dl class="modq__facts">
                  <div><dt class="t-mono">${esc(t('staff.ed.category'))}</dt><dd>${esc(loc(p.category))}</dd></div>
                  <div><dt class="t-mono">${esc(t('staff.ed.color'))}</dt><dd>${esc(t(`colors.${p.color}`))}</dd></div>
                  <div><dt class="t-mono">${esc(t('staff.ed.material'))}</dt><dd>${esc(t(`materials.${p.material}`))}</dd></div>
                  <div><dt class="t-mono">${esc(t('staff.ed.country'))}</dt><dd>${esc(countryName(p.country))}</dd></div>
                  <div><dt class="t-mono">${esc(t('admin.products.seller'))}</dt><dd>${esc(p.seller.name)}</dd></div>
                  <div><dt class="t-mono">${esc(t('admin.updated'))}</dt><dd>${esc(fmtDateTime(p.updatedAt))}</dd></div>
                </dl>
                <div class="modq__actions">
                  <label class="switch"><input type="checkbox" data-auth checked><span class="switch__track"></span><span>Verified by Amfibia</span></label>
                  <a class="link-u t-mono" href="/product/${p.id}" target="_blank" rel="noopener">${esc(t('admin.products.preview'))} ${icon('i-arrow-ne', 'icon icon--xs')}</a>
                  <button type="button" class="btn btn--sm btn--ghost" data-q-reject>${esc(t('staff.desk.reject'))}</button>
                  <button type="button" class="btn btn--sm" data-q-approve>${icon('i-check', 'icon icon--sm')} ${esc(t('staff.desk.approve'))}</button>
                </div>
              </div>
            </article>`
          )
          .join('')}</div>`
      : empty({ ornament: 'orn-cross-filigree', title: t('admin.products.queueEmpty'), text: t('admin.products.queueEmptyText') });
  }
  body.innerHTML = loading();
  await drawQueue();
  body.addEventListener('click', async (e) => {
    const card = e.target.closest('.modq__card');
    if (!card) return;
    const id = Number(card.dataset.id);
    if (e.target.closest('[data-q-approve]')) {
      await api.post(`/admin/products/${id}/moderate`, { decision: 'approve', authenticated: $('[data-auth]', card).checked });
      toast.success(t('admin.products.approved'));
      card.classList.add('is-leaving');
      await ctx.refreshSummary();
      setTimeout(drawQueue, 400);
    }
    if (e.target.closest('[data-q-reject]')) reject([id], drawQueue);
  });
}
