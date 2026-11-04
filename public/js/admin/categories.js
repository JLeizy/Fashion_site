// Админка → Категории (раздел 8 ТЗ, роль owner): дерево категорий с перетаскиванием (HTML5 Drag and Drop):
// верхняя четверть строки — поставить перед, нижняя — после, середина — вложить внутрь. Для клавиатуры — кнопки ↑ ↓.
// Добавление, переименование, размерная сетка, удаление пустой категории.
// API: GET/POST/PUT/DELETE /api/admin/categories, POST /api/admin/categories/move (проверка цикла — WITH RECURSIVE)
import { $, $$, esc, icon } from '../core/dom.js';
import { t, loc } from '../core/i18n.js';
import api from '../core/api.js';
import { confirmModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { loading } from '../account/common.js';
import { openForm } from './form.js';

const SIZE_TYPES = ['clothing', 'shoes', 'ring', 'one_size', 'volume_ml'];

export async function render(view) {
  let cats = [];
  let dragId = null;
  const childrenOf = (pid) => cats.filter((c) => (c.parentId || null) === (pid || null)).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);

  const node = (c, depth) => {
    const kids = childrenOf(c.id);
    const total = c.products + kids.reduce((s, k) => s + k.products, 0);
    return `<li class="ctree__item" data-id="${c.id}">
      <div class="ctree__row" draggable="true" data-row="${c.id}" style="--depth:${depth}">
        <span class="ctree__grip" aria-hidden="true">⋮⋮</span>
        <span class="ctree__name">${esc(loc(c.name))}</span>
        <span class="ctree__slug t-mono">/${esc(c.slug)}</span>
        ${c.sizeType ? `<span class="ctree__size t-mono">${esc(t(`admin.cat.size.${c.sizeType}`))}</span>` : ''}
        <span class="ctree__count t-mono">${total}</span>
        <span class="ctree__tools">
          <button type="button" class="icon-btn" data-up="${c.id}" aria-label="↑" title="↑">${icon('i-arrow-up', 'icon icon--xs')}</button>
          <button type="button" class="icon-btn dt-down" data-down="${c.id}" aria-label="↓" title="↓">${icon('i-arrow-up', 'icon icon--xs')}</button>
          ${depth === 0 ? `<button type="button" class="icon-btn" data-add="${c.id}" aria-label="${esc(t('admin.cat.addSub'))}" title="${esc(t('admin.cat.addSub'))}">${icon('i-plus', 'icon icon--xs')}</button>` : ''}
          <button type="button" class="icon-btn" data-edit="${c.id}" aria-label="${esc(t('common.edit'))}" title="${esc(t('common.edit'))}">${icon('i-edit', 'icon icon--xs')}</button>
          <button type="button" class="icon-btn" data-del="${c.id}" aria-label="${esc(t('common.delete'))}" title="${esc(t('common.delete'))}" ${total || kids.length ? 'disabled' : ''}>${icon('i-trash', 'icon icon--xs')}</button>
        </span>
      </div>
      ${kids.length ? `<ul class="ctree__list">${kids.map((k) => node(k, depth + 1)).join('')}</ul>` : ''}
    </li>`;
  };

  async function draw() {
    ({ categories: cats } = await api.get('/admin/categories'));
    view.innerHTML = `
      <div class="adm-toolbar"><p class="t-muted">${esc(t('admin.cat.lead'))}</p><button type="button" class="btn btn--sm" data-add="">${icon('i-plus', 'icon icon--sm')} ${esc(t('admin.cat.addRoot'))}</button></div>
      <ul class="ctree" data-tree>${childrenOf(null).map((c) => node(c, 0)).join('')}</ul>`;
  }
  view.innerHTML = loading();
  await draw();

  async function move(id, parentId, ids) {
    try {
      await api.post('/admin/categories/move', { id, parentId, ids });
      toast.success(t('admin.cat.moved'));
    } catch (err) {
      toast.error(err.message);
    }
    await draw();
  }

  // ---------- Перетаскивание ----------
  const zone = (row, e) => {
    const r = row.getBoundingClientRect();
    const y = (e.clientY - r.top) / r.height;
    return y < 0.28 ? 'before' : y > 0.72 ? 'after' : 'inside';
  };
  view.addEventListener('dragstart', (e) => {
    const row = e.target.closest('[data-row]');
    if (!row) return;
    dragId = Number(row.dataset.row);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(dragId));
    row.classList.add('is-dragging');
  });
  view.addEventListener('dragend', () => {
    dragId = null;
    $$('.is-dragging, .drop-before, .drop-after, .drop-inside', view).forEach((el) => el.classList.remove('is-dragging', 'drop-before', 'drop-after', 'drop-inside'));
  });
  view.addEventListener('dragover', (e) => {
    const row = e.target.closest('[data-row]');
    if (!row || dragId === null || Number(row.dataset.row) === dragId) return;
    e.preventDefault();
    const z = zone(row, e);
    row.classList.remove('drop-before', 'drop-after', 'drop-inside');
    row.classList.add(`drop-${z}`);
  });
  view.addEventListener('dragleave', (e) => e.target.closest('[data-row]')?.classList.remove('drop-before', 'drop-after', 'drop-inside'));
  view.addEventListener('drop', async (e) => {
    const row = e.target.closest('[data-row]');
    if (!row || dragId === null) return;
    e.preventDefault();
    const targetId = Number(row.dataset.row);
    if (targetId === dragId) return;
    const target = cats.find((c) => c.id === targetId);
    const z = zone(row, e);
    const parentId = z === 'inside' ? target.id : target.parentId || null;
    const siblings = childrenOf(parentId).map((c) => c.id).filter((x) => x !== dragId);
    if (z === 'inside') siblings.push(dragId);
    else siblings.splice(siblings.indexOf(targetId) + (z === 'after' ? 1 : 0), 0, dragId);
    await move(dragId, parentId, siblings);
  });

  // ---------- Кнопки ----------
  const form = (c = null, parentId = null) =>
    openForm({
      title: c ? loc(c.name) : t(parentId ? 'admin.cat.addSub' : 'admin.cat.addRoot'),
      fields: [
        { name: 'nameRu', label: t('admin.f.name_ru'), required: true },
        { name: 'nameEn', label: t('admin.f.name_en'), required: true, lang: 'en' },
        { name: 'slug', label: t('admin.f.slug'), required: true, hint: 'sneakers' },
        { name: 'sizeType', label: t('admin.cat.sizeType'), type: 'select', options: [{ value: '', label: t('admin.cat.inherit') }, ...SIZE_TYPES.map((s) => ({ value: s, label: t(`admin.cat.size.${s}`) }))] },
      ],
      values: c ? { nameRu: c.name.ru, nameEn: c.name.en, slug: c.slug, sizeType: c.sizeType || '' } : {},
      onSubmit: async (v) => {
        if (c) await api.put(`/admin/categories/${c.id}`, v);
        else await api.post('/admin/categories', { ...v, parentId });
        toast.success(t('account.saved'));
        await draw();
      },
    });
  view.addEventListener('click', async (e) => {
    const add = e.target.closest('[data-add]');
    if (add) return form(null, add.dataset.add ? Number(add.dataset.add) : null);
    const ed = e.target.closest('[data-edit]');
    if (ed) return form(cats.find((c) => c.id === Number(ed.dataset.edit)));
    const up = e.target.closest('[data-up], [data-down]');
    if (up) {
      const id = Number(up.dataset.up || up.dataset.down);
      const c = cats.find((x) => x.id === id);
      const ids = childrenOf(c.parentId).map((x) => x.id);
      const i = ids.indexOf(id);
      const j = i + (up.dataset.up ? -1 : 1);
      if (j < 0 || j >= ids.length) return;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      return move(id, c.parentId || null, ids);
    }
    const del = e.target.closest('[data-del]');
    if (del && (await confirmModal({ title: t('admin.deleteTitle'), text: t('admin.deleteText'), danger: true, confirmLabel: t('common.delete') }))) {
      try {
        await api.del(`/admin/categories/${del.dataset.del}`);
        toast.success(t('admin.deleted'));
        await draw();
      } catch (err) {
        toast.error(err.message);
      }
    }
  });
}
