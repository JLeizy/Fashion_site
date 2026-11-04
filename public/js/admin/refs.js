// Админка → справочники (раздел 8 ТЗ, роль owner): коллекции, баннеры главной, склады, способы доставки и оплаты, промокоды,
// а также разделы историй брендов, события хронологии и креативные директора (внутри страницы бренда — admin/brands.js).
// Один модуль на все справочники: описание столбцов таблицы и полей формы — в ENTITY_UI; данные — /api/admin/refs/:entity
// (server/routes/api/adminRefs.js, белый список таблиц). Таблица: поиск, сортировка, пагинация, CSV; порядок — стрелками.
import { $, esc, icon } from '../core/dom.js';
import { t, fmtDate, fmtNumber } from '../core/i18n.js';
import api from '../core/api.js';
import { confirmModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { statusBadge } from '../account/common.js';
import { createTable } from '../account/table.js';
import { money } from '../account/staff.js';
import { openForm } from './form.js';

const f = (name, type = 'text', extra = {}) => ({ name, type, label: t(`admin.f.${name}`), ...extra });
const yesNo = (v) => (v ? `<span class="t-success">${icon('i-check', 'icon icon--xs')}</span>` : '<span class="t-muted">—</span>');
const thumb = (url) => (url ? `<img class="dt-thumb" src="${esc(url)}" alt="" loading="lazy">` : '<span class="dt-thumb dt-thumb--empty"></span>');
const brandOptions = (brands) => brands.map((b) => ({ value: b.id, label: b.name }));

// Описание каждого справочника: поля формы, столбцы таблицы, поиск, перестановка
export const ENTITY_UI = {
  collections: {
    csv: 'amfibia-collections', brandFilter: true,
    fields: (r) => [f('brand_id', 'select', { options: brandOptions(r.brands), required: true }), f('name', 'text', { required: true }), f('season', 'select', { options: ['SS', 'FW', 'Resort', 'Pre-Fall'].map((s) => ({ value: s, label: s })) }), f('year', 'number', { required: true, min: 1900, max: 2100 }), f('is_new', 'checkbox'), f('cover_image', 'image', { wide: true }), f('description_ru', 'textarea', { wide: true }), f('description_en', 'textarea', { wide: true, lang: 'en' })],
    defaults: () => ({ season: 'FW', year: new Date().getFullYear(), is_new: true }),
    columns: [
      { key: 'cover_image', label: '', csv: false, render: (x) => thumb(x.cover_image) },
      { key: 'name', label: t('admin.f.name'), sort: 'name', className: 'dt__wide', render: (x) => `<b>${esc(x.name)}</b><span class="dt-sub">${esc(x.brand_name)}</span>` },
      { key: 'season', label: t('admin.f.season'), className: 't-mono', render: (x) => `${esc(x.season)} ${x.year}`, csv: (x) => `${x.season} ${x.year}` },
      { key: 'is_new', label: 'NEW', render: (x) => yesNo(x.is_new) },
      { key: 'products_count', label: t('admin.f.products'), className: 't-mono' },
    ],
  },
  banners: {
    csv: 'amfibia-banners', reorder: true,
    fields: (r) => [f('title_ru', 'text', { required: true }), f('title_en', 'text', { required: true, lang: 'en' }), f('subtitle_ru'), f('subtitle_en', 'text', { lang: 'en' }), f('image', 'image', { required: true, wide: true }), f('link', 'text', { required: true, hint: '/brand/balenciaga' }), f('brand_id', 'select', { options: [{ value: '', label: '—' }, ...brandOptions(r.brands)] }), f('sort_order', 'number', { min: 0, max: 999 }), f('is_active', 'checkbox')],
    defaults: () => ({ link: '/', is_active: true, sort_order: 100 }),
    columns: [
      { key: 'image', label: '', csv: false, render: (x) => thumb(x.image) },
      { key: 'title_ru', label: t('admin.f.title_ru'), className: 'dt__wide', render: (x) => `<b>${esc(x.title_ru)}</b><span class="dt-sub">${esc(x.subtitle_ru || '')}</span>` },
      { key: 'brand_name', label: t('admin.f.brand_id'), render: (x) => esc(x.brand_name || '—') },
      { key: 'link', label: t('admin.f.link'), className: 't-mono dt__hide-sm' },
      { key: 'is_active', label: t('admin.f.is_active'), render: (x) => yesNo(x.is_active) },
    ],
  },
  warehouses: {
    csv: 'amfibia-warehouses',
    fields: () => [f('name', 'text', { required: true, wide: true }), f('city', 'text', { required: true }), f('address', 'text', { required: true })],
    columns: [
      { key: 'name', label: t('admin.f.name'), className: 'dt__wide', render: (x) => `<b>${esc(x.name)}</b>` },
      { key: 'city', label: t('admin.f.city') },
      { key: 'address', label: t('admin.f.address'), className: 'dt__hide-sm' },
      { key: 'quantity', label: t('staff.stock.quantity'), className: 't-mono', render: (x) => fmtNumber(x.quantity), csv: (x) => x.quantity },
    ],
  },
  delivery: {
    csv: 'amfibia-delivery', reorder: true,
    fields: () => [f('code', 'text', { required: true, hint: 'courier, cdek, pickup…' }), f('price_byn', 'number', { step: '0.01', min: 0, required: true }), f('name_ru', 'text', { required: true }), f('name_en', 'text', { required: true, lang: 'en' }), f('days_min', 'number', { min: 0, required: true }), f('days_max', 'number', { min: 0, required: true }), f('is_pickup', 'checkbox', { hint: t('admin.f.is_pickup_hint') }), f('is_active', 'checkbox'), f('sort_order', 'number', { min: 0, max: 999 })],
    defaults: () => ({ is_active: true, price_byn: 0, days_min: 1, days_max: 3, sort_order: 100 }),
    columns: [
      { key: 'name_ru', label: t('admin.f.name_ru'), className: 'dt__wide', render: (x) => `<b>${esc(x.name_ru)}</b><span class="dt-sub t-mono">${esc(x.code)} · ${esc(x.name_en)}</span>` },
      { key: 'price_byn', label: t('staff.col.price'), className: 't-mono', render: (x) => money(x.price_byn) },
      { key: 'days', label: t('admin.f.days'), className: 't-mono', render: (x) => `${x.days_min}–${x.days_max}`, csv: (x) => `${x.days_min}-${x.days_max}` },
      { key: 'is_pickup', label: t('admin.f.is_pickup'), render: (x) => yesNo(x.is_pickup) },
      { key: 'is_active', label: t('admin.f.is_active'), render: (x) => yesNo(x.is_active) },
      { key: 'orders_count', label: t('admin.users.orders'), className: 't-mono dt__hide-sm' },
    ],
  },
  payment: {
    csv: 'amfibia-payment', reorder: true,
    fields: () => [f('code', 'text', { required: true, hint: 'card, erip, cash…' }), f('sort_order', 'number', { min: 0, max: 999 }), f('name_ru', 'text', { required: true }), f('name_en', 'text', { required: true, lang: 'en' }), f('is_online', 'checkbox', { hint: t('admin.f.is_online_hint') }), f('is_active', 'checkbox')],
    defaults: () => ({ is_active: true, sort_order: 100 }),
    columns: [
      { key: 'name_ru', label: t('admin.f.name_ru'), className: 'dt__wide', render: (x) => `<b>${esc(x.name_ru)}</b><span class="dt-sub t-mono">${esc(x.code)} · ${esc(x.name_en)}</span>` },
      { key: 'is_online', label: t('admin.f.is_online'), render: (x) => yesNo(x.is_online) },
      { key: 'is_active', label: t('admin.f.is_active'), render: (x) => yesNo(x.is_active) },
      { key: 'orders_count', label: t('admin.users.orders'), className: 't-mono' },
    ],
  },
  promos: {
    csv: 'amfibia-promo-codes',
    fields: () => [f('code', 'text', { required: true, hint: 'AMFIBIA10' }), f('discount_percent', 'number', { min: 1, max: 90, required: true }), f('valid_from', 'date', { required: true }), f('valid_to', 'date'), f('usage_limit', 'number', { min: 1, hint: t('admin.f.usage_limit_hint') }), f('is_active', 'checkbox')],
    defaults: () => ({ discount_percent: 10, valid_from: new Date().toISOString(), is_active: true }),
    columns: [
      { key: 'code', label: t('admin.f.code'), sort: 'code', className: 't-mono', render: (x) => `<b class="promo-code">${esc(x.code)}</b>` },
      { key: 'discount_percent', label: t('admin.f.discount_percent'), sort: 'discount_percent', className: 't-mono', render: (x) => `−${x.discount_percent} %` },
      { key: 'period', label: t('admin.f.period'), className: 't-mono', render: (x) => `${esc(fmtDate(x.valid_from, { day: '2-digit', month: '2-digit', year: 'numeric' }))} — ${x.valid_to ? esc(fmtDate(x.valid_to, { day: '2-digit', month: '2-digit', year: 'numeric' })) : '∞'}`, csv: (x) => `${x.valid_from} — ${x.valid_to || ''}` },
      { key: 'used_count', label: t('admin.f.used'), sort: 'used_count', className: 't-mono', render: (x) => `${x.used_count}${x.usage_limit ? ` / ${x.usage_limit}` : ''}` },
      { key: 'is_active', label: t('staff.col.status'), render: (x) => { const expired = x.valid_to && new Date(x.valid_to) < new Date(); return statusBadge(!x.is_active ? 'closed' : expired ? 'rejected' : 'approved', t(!x.is_active ? 'admin.promo.off' : expired ? 'admin.promo.expired' : 'admin.promo.on')); }, csv: (x) => x.is_active },
    ],
  },
  history: {
    csv: 'amfibia-history-sections', reorder: true,
    fields: () => [f('title_ru', 'text', { required: true }), f('title_en', 'text', { required: true, lang: 'en' }), f('period', 'text', { hint: '1917–1937' }), f('sort_order', 'number', { min: 0, max: 999 }), f('content_ru', 'textarea', { rows: 14, wide: true, required: true, hint: t('admin.f.content_hint') }), f('content_en', 'textarea', { rows: 8, wide: true, lang: 'en' }), f('quote_ru', 'textarea', { rows: 2 }), f('quote_en', 'textarea', { rows: 2, lang: 'en' }), f('quote_author'), f('image', 'image')],
    defaults: () => ({ sort_order: 100 }),
    columns: [
      { key: 'sort_order', label: '№', className: 't-mono', render: (x) => String(x.sort_order).padStart(3, '0') },
      { key: 'title_ru', label: t('admin.f.title_ru'), className: 'dt__wide', render: (x) => `<b>${esc(x.title_ru)}</b><span class="dt-sub">${esc(x.period || '')} · ${esc(x.title_en)}</span>` },
      { key: 'length_ru', label: t('admin.f.words'), className: 't-mono', render: (x) => `${fmtNumber(Math.round(x.length_ru / 6.5))} / ${fmtNumber(Math.round(x.length_en / 6))}`, csv: (x) => x.length_ru },
      { key: 'quote', label: t('admin.f.quote_ru'), className: 'dt__hide-sm', render: (x) => yesNo(x.quote_ru) },
    ],
  },
  timeline: {
    csv: 'amfibia-timeline',
    fields: () => [f('year', 'number', { min: 1800, max: 2100, required: true }), f('title_ru', 'text', { required: true }), f('title_en', 'text', { required: true, lang: 'en' }), f('description_ru', 'textarea', { wide: true }), f('description_en', 'textarea', { wide: true, lang: 'en' })],
    defaults: () => ({ year: new Date().getFullYear() }),
    columns: [
      { key: 'year', label: t('admin.f.year'), className: 't-mono', render: (x) => `<b class="tl-year">${x.year}</b>` },
      { key: 'title_ru', label: t('admin.f.title_ru'), className: 'dt__wide', render: (x) => `<b>${esc(x.title_ru)}</b><span class="dt-sub">${esc(x.description_ru || '')}</span>` },
    ],
  },
  directors: {
    csv: 'amfibia-creative-directors',
    fields: () => [f('name', 'text', { required: true, wide: true }), f('years_from', 'number', { min: 1800, max: 2100, required: true }), f('years_to', 'number', { min: 1800, max: 2100, hint: t('admin.f.years_to_hint') }), f('description_ru', 'textarea', { wide: true, rows: 5 }), f('description_en', 'textarea', { wide: true, rows: 4, lang: 'en' }), f('key_collections_ru', 'textarea', { rows: 2 }), f('key_collections_en', 'textarea', { rows: 2, lang: 'en' }), f('photo', 'image', { wide: true })],
    columns: [
      { key: 'photo', label: '', csv: false, render: (x) => thumb(x.photo) },
      { key: 'name', label: t('admin.f.name'), className: 'dt__wide', render: (x) => `<b>${esc(x.name)}</b><span class="dt-sub">${esc(x.key_collections_ru || '')}</span>` },
      { key: 'years', label: t('admin.f.years'), className: 't-mono', render: (x) => `${x.years_from}–${x.years_to || t('admin.f.now')}`, csv: (x) => `${x.years_from}-${x.years_to || ''}` },
    ],
  },
};

let brandsCache = null;
const refsData = async () => ({ brands: (brandsCache ||= (await api.get('/admin/refs/brands', { limit: 100 })).rows) });

// Таблица справочника. options.brand — только записи бренда (истории, хронология, директора, коллекции бренда)
export async function refsTable(container, entity, { brand = null, urlSync = true } = {}) {
  const ui = ENTITY_UI[entity];
  const r = await refsData();
  container.innerHTML = '<div data-table></div>';
  const editForm = (item = null) =>
    openForm({
      title: item ? t('admin.editTitle') : t('admin.addTitle'),
      fields: ui.fields(r).filter((fl) => !(brand && fl.name === 'brand_id')),
      values: item || { ...(ui.defaults?.() || {}) },
      onSubmit: async (values) => {
        const payload = { ...(item || {}), ...values, ...(brand ? { brand_id: brand } : {}) };
        if (item) await api.put(`/admin/refs/${entity}/${item.id}`, payload);
        else await api.post(`/admin/refs/${entity}`, payload);
        toast.success(t('account.saved'));
        table.reload({ keepSelection: true });
      },
    });
  const table = createTable($('[data-table]', container), {
    csv: ui.csv,
    urlSync,
    pageSize: 50,
    dir: 'asc',
    search: { placeholder: t('staff.table.search') },
    filters: ui.brandFilter && !brand ? [{ name: 'brand', label: t('admin.f.brand_id'), value: '', options: [{ value: '', label: t('common.all') }, ...brandOptions(r.brands)] }] : [],
    toolbar: `<button type="button" class="btn btn--sm" data-add>${icon('i-plus', 'icon icon--sm')} ${esc(t('common.add'))}</button>`,
    load: (s) => api.get(`/admin/refs/${entity}`, { ...s, ...(brand ? { brand } : {}) }),
    onRow: (row) => editForm(row),
    columns: [
      ...ui.columns,
      {
        key: 'actions', label: '', csv: false, className: 'dt__actions',
        render: (x) => `${ui.reorder ? `<button type="button" class="icon-btn" data-move="-1" data-id="${x.id}" aria-label="↑" title="↑">${icon('i-arrow-up', 'icon icon--xs')}</button><button type="button" class="icon-btn dt-down" data-move="1" data-id="${x.id}" aria-label="↓" title="↓">${icon('i-arrow-up', 'icon icon--xs')}</button>` : ''}
          <button type="button" class="icon-btn" data-edit="${x.id}" aria-label="${esc(t('common.edit'))}" title="${esc(t('common.edit'))}">${icon('i-edit', 'icon icon--sm')}</button>
          <button type="button" class="icon-btn" data-del="${x.id}" aria-label="${esc(t('common.delete'))}" title="${esc(t('common.delete'))}">${icon('i-trash', 'icon icon--sm')}</button>`,
      },
    ],
  });
  container.addEventListener('click', async (e) => {
    if (e.target.closest('[data-add]')) return editForm();
    const ed = e.target.closest('[data-edit]');
    if (ed) return editForm(table.rows.find((x) => x.id === Number(ed.dataset.edit)));
    const mv = e.target.closest('[data-move]');
    if (mv) {
      const ids = table.rows.map((x) => x.id);
      const i = ids.indexOf(Number(mv.dataset.id));
      const j = i + Number(mv.dataset.move);
      if (j < 0 || j >= ids.length) return;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      await api.post(`/admin/refs/${entity}/reorder`, { ids });
      return table.reload({ keepSelection: true });
    }
    const del = e.target.closest('[data-del]');
    if (del && (await confirmModal({ title: t('admin.deleteTitle'), text: t('admin.deleteText'), danger: true, confirmLabel: t('common.delete') }))) {
      try {
        await api.del(`/admin/refs/${entity}/${del.dataset.del}`);
        toast.success(t('admin.deleted'));
        table.reload({ keepSelection: true });
      } catch (err) {
        toast.error(err.message);
      }
    }
  });
  return table;
}

export async function render(view, ctx) {
  await refsTable(view, ctx.section.entity);
}
