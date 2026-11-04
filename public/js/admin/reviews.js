// Админка → Отзывы (раздел 8 ТЗ, роль moderator / owner): модерация отзывов — одобрить / отклонить по одному и массово,
// удаление с подтверждением, фильтры статуса и оценки, поиск по тексту, товару, email; CSV.
// На сайте видны только одобренные отзывы; рейтинг товара пересчитывает триггер trg_reviews_rating.
// API: GET /api/admin/reviews, POST /api/admin/reviews/:id/moderate, POST /api/admin/reviews/bulk, DELETE /api/admin/reviews/:id
import { $, esc, icon } from '../core/dom.js';
import { t, loc, fmtDateTime } from '../core/i18n.js';
import api from '../core/api.js';
import { confirmModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { statusBadge } from '../account/common.js';
import { createTable } from '../account/table.js';

export async function render(view, ctx) {
  view.innerHTML = '<div data-table></div>';
  const done = async (msgKey) => {
    toast.success(t(msgKey));
    await ctx.refreshSummary();
  };
  const table = createTable($('[data-table]', view), {
    csv: 'amfibia-reviews',
    sort: 'created',
    pageSize: 15,
    search: { placeholder: t('admin.reviews.searchPh') },
    filters: [
      { name: 'status', label: t('staff.moderation'), value: 'pending', options: ['pending', 'approved', 'rejected', 'all'].map((s) => ({ value: s, label: s === 'all' ? t('common.all') : t(`admin.reviews.st.${s}`) })) },
      { name: 'rating', label: t('admin.reviews.rating'), value: '', options: [{ value: '', label: t('common.all') }, ...[5, 4, 3, 2, 1].map((r) => ({ value: r, label: `${r} ★` }))] },
    ],
    selectable: true,
    bulk: [
      { id: 'approve', label: t('staff.desk.approve'), action: (ids) => api.post('/admin/reviews/bulk', { ids, status: 'approved' }).then(() => done('admin.reviews.approved')) },
      { id: 'reject', label: t('staff.desk.reject'), danger: true, confirm: (n) => t('admin.reviews.bulkReject', { n }), action: (ids) => api.post('/admin/reviews/bulk', { ids, status: 'rejected' }).then(() => done('admin.reviews.rejected')) },
    ],
    load: (s) => api.get('/admin/reviews', s),
    empty: { title: t('admin.reviews.empty') },
    columns: [
      { key: 'product', label: t('staff.col.product'), className: 'dt__hide-sm', render: (r) => `<span class="dt-prod"><img src="${esc(r.product.image)}" alt="" loading="lazy"><span><a class="dt-prod__name" href="/product/${r.product.id}#reviews" target="_blank" rel="noopener">${esc(loc(r.product.name))}</a><span class="dt-prod__meta t-mono">${esc(r.product.brand)} · ${esc(r.product.sku)}</span></span></span>`, csv: (r) => r.product.sku },
      { key: 'text', label: t('admin.reviews.text'), className: 'dt__wide', render: (r) => `<span class="dt-review"><span class="stars" style="--value:${r.rating}" aria-label="${r.rating}/5"></span><span class="dt-review__text">${esc(r.text)}</span><span class="dt-sub">${esc(r.author)} · ${esc(r.email)}${r.verifiedPurchase ? ` · ${icon('i-check', 'icon icon--xs')} ${esc(t('admin.reviews.verified'))}` : ''}</span></span>`, csv: (r) => r.text },
      { key: 'rating', label: t('admin.reviews.rating'), sort: 'rating', className: 't-mono', render: (r) => `${r.rating} ★`, csv: (r) => r.rating },
      { key: 'status', label: t('staff.col.status'), sort: 'status', render: (r) => statusBadge(r.status, t(`admin.reviews.st.${r.status}`)), csv: (r) => r.status },
      { key: 'createdAt', label: t('staff.col.date'), sort: 'created', className: 't-mono dt__hide-sm', render: (r) => esc(fmtDateTime(r.createdAt)), csv: (r) => r.createdAt },
      {
        key: 'actions', label: '', csv: false, className: 'dt__actions',
        render: (r) => `${r.status !== 'approved' ? `<button type="button" class="icon-btn" data-mod="approved" data-id="${r.id}" title="${esc(t('staff.desk.approve'))}" aria-label="${esc(t('staff.desk.approve'))}">${icon('i-check', 'icon icon--sm')}</button>` : ''}
          ${r.status !== 'rejected' ? `<button type="button" class="icon-btn" data-mod="rejected" data-id="${r.id}" title="${esc(t('staff.desk.reject'))}" aria-label="${esc(t('staff.desk.reject'))}">${icon('i-close', 'icon icon--sm')}</button>` : ''}
          <button type="button" class="icon-btn" data-del="${r.id}" title="${esc(t('common.delete'))}" aria-label="${esc(t('common.delete'))}">${icon('i-trash', 'icon icon--sm')}</button>`,
      },
    ],
  });
  view.addEventListener('click', async (e) => {
    const m = e.target.closest('[data-mod]');
    if (m) {
      await api.post(`/admin/reviews/${m.dataset.id}/moderate`, { status: m.dataset.mod });
      await done(m.dataset.mod === 'approved' ? 'admin.reviews.approved' : 'admin.reviews.rejected');
      return table.reload({ keepSelection: true });
    }
    const d = e.target.closest('[data-del]');
    if (d && (await confirmModal({ title: t('admin.reviews.deleteTitle'), text: t('admin.reviews.deleteText'), danger: true, confirmLabel: t('common.delete') }))) {
      await api.del(`/admin/reviews/${d.dataset.del}`);
      await done('admin.reviews.deleted');
      table.reload({ keepSelection: true });
    }
  });
}
