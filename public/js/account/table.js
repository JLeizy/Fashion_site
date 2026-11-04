// Универсальная таблица данных для кабинетов сотрудников и админ-панели (разделы 4 и 8 ТЗ):
// поиск (debounce 300 мс), фильтры, сортировка по столбцам, серверная пагинация, массовые действия, экспорт в CSV.
// Данные приходят с сервера (load → { rows, total, pages }); сортировка и фильтры передаются параметрами запроса.
// Состояние таблицы (страница, сортировка, фильтры, поиск) хранится в URL — ссылкой можно поделиться, «назад» работает.
//
// createTable(container, {
//   columns: [{ key, label, sort, render(row), csv(row), className, width }],
//   load: async (state) => ({ rows, total, pages }),   state: { page, limit, sort, dir, q, ...filters }
//   filters: [{ name, label, options: [{ value, label }], value }],
//   search: true | { placeholder }, pageSize, sort, dir,
//   selectable, bulk: [{ id, label, danger, confirm, action: async (ids, rows) => {} }],
//   csv: 'имя-файла', empty: { title, text }, rowClass(row), onRow(row, event), toolbar: 'доп. HTML', urlSync: true
// })
import { $, $$, esc, icon, debounce } from '../core/dom.js';
import { t, fmtNumber } from '../core/i18n.js';
import { refreshPrices } from '../core/currency.js';
import { confirmModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { empty as emptyState } from './common.js';

const CSV_LIMIT = 1000;

export function createTable(container, options) {
  const o = { search: true, pageSize: 20, dir: 'desc', selectable: false, bulk: [], urlSync: true, filters: [], ...options };
  const url = new URLSearchParams(location.search);
  const fromUrl = (key, fallback) => (o.urlSync && url.has(key) ? url.get(key) : fallback);
  const state = {
    page: Math.max(1, Number(fromUrl('page', 1)) || 1),
    limit: o.pageSize,
    sort: fromUrl('sort', o.sort || ''),
    dir: fromUrl('dir', o.dir) === 'asc' ? 'asc' : 'desc',
    q: fromUrl('q', ''),
  };
  o.filters.forEach((f) => (state[f.name] = fromUrl(f.name, f.value ?? '')));

  let data = { rows: [], total: 0, pages: 1 };
  const selected = new Set();
  let seq = 0;

  container.classList.add('dt');
  container.innerHTML = `
    <div class="dt__toolbar">
      ${o.search ? `<label class="dt__search">${icon('i-search', 'icon icon--sm')}<span class="sr-only">${esc(t('staff.table.search'))}</span>
        <input class="input" type="search" data-dt-search value="${esc(state.q)}" placeholder="${esc(o.search.placeholder || t('staff.table.search'))}" autocomplete="off"></label>` : ''}
      ${o.filters
        .map(
          (f) => `<label class="dt__filter"><span class="dt__filter-label t-mono">${esc(f.label)}</span>
            <select class="select" data-dt-filter="${esc(f.name)}">${f.options.map((op) => `<option value="${esc(op.value)}" ${String(op.value) === String(state[f.name]) ? 'selected' : ''}>${esc(op.label)}</option>`).join('')}</select></label>`
        )
        .join('')}
      <div class="dt__tools">
        ${o.toolbar || ''}
        ${o.csv ? `<button type="button" class="btn btn--ghost btn--sm" data-dt-csv>${icon('i-download', 'icon icon--sm')} CSV</button>` : ''}
      </div>
    </div>
    ${o.selectable && o.bulk.length ? `<div class="dt__bulk" data-dt-bulk hidden><span class="t-mono" data-dt-count></span>${o.bulk.map((b) => `<button type="button" class="btn btn--xs ${b.danger ? 'btn--danger' : 'btn--ghost'}" data-dt-bulk-action="${esc(b.id)}">${esc(b.label)}</button>`).join('')}</div>` : ''}
    <div class="dt__meta t-mono" data-dt-meta></div>
    <div class="dt__body" data-dt-body><div class="skeleton acc-skeleton"></div><div class="skeleton acc-skeleton"></div></div>
    <nav class="dt__pager pagination" data-dt-pager aria-label="${esc(t('staff.table.pages'))}"></nav>`;

  const body = $('[data-dt-body]', container);

  function syncUrl() {
    if (!o.urlSync) return;
    const next = new URLSearchParams(location.search);
    const put = (k, v, def) => (v && String(v) !== String(def ?? '') ? next.set(k, v) : next.delete(k));
    put('page', state.page > 1 ? state.page : '');
    put('sort', state.sort, o.sort);
    put('dir', state.dir, o.dir);
    put('q', state.q);
    o.filters.forEach((f) => put(f.name, state[f.name], f.value));
    const qs = next.toString();
    history.replaceState(history.state, '', `${location.pathname}${qs ? `?${qs}` : ''}`);
  }

  const headCell = (c) => {
    if (!c.sort) return `<th scope="col" class="${c.className || ''}" ${c.width ? `style="width:${c.width}"` : ''}>${esc(c.label || '')}</th>`;
    const active = state.sort === c.sort;
    const aria = active ? (state.dir === 'asc' ? 'ascending' : 'descending') : 'none';
    return `<th scope="col" class="${c.className || ''} is-sortable ${active ? 'is-sorted' : ''}" aria-sort="${aria}" ${c.width ? `style="width:${c.width}"` : ''}>
      <button type="button" data-dt-sort="${esc(c.sort)}">${esc(c.label)}<span class="dt__arrow" aria-hidden="true">${active ? (state.dir === 'asc' ? '↑' : '↓') : '↕'}</span></button></th>`;
  };

  function render() {
    const rows = data.rows;
    $('[data-dt-meta]', container).textContent = t('staff.table.found', { n: fmtNumber(data.total) });
    if (!rows.length) {
      body.innerHTML = emptyState({ title: o.empty?.title || t('staff.table.empty'), text: o.empty?.text || '' });
    } else {
      body.innerHTML = `<div class="table-wrap"><table class="table dt__table">
        <thead><tr>
          ${o.selectable ? `<th class="dt__check"><label class="check"><input type="checkbox" data-dt-all ${rows.every((r) => selected.has(r.id)) ? 'checked' : ''}><span class="check__box"></span><span class="sr-only">${esc(t('staff.table.selectAll'))}</span></label></th>` : ''}
          ${o.columns.map(headCell).join('')}
        </tr></thead>
        <tbody>${rows
          .map(
            (row, i) => `<tr class="${o.rowClass ? o.rowClass(row) : ''} ${o.onRow ? 'is-clickable' : ''}" data-dt-row="${i}">
              ${o.selectable ? `<td class="dt__check"><label class="check"><input type="checkbox" data-dt-select="${esc(row.id)}" ${selected.has(row.id) ? 'checked' : ''}><span class="check__box"></span><span class="sr-only">${esc(t('staff.table.select'))}</span></label></td>` : ''}
              ${o.columns.map((c) => `<td class="${c.className || ''}" data-label="${esc(c.label || '')}">${c.render ? c.render(row) : esc(row[c.key] ?? '')}</td>`).join('')}
            </tr>`
          )
          .join('')}</tbody></table></div>`;
    }
    const pager = $('[data-dt-pager]', container);
    pager.innerHTML = data.pages > 1 ? pagerHtml(state.page, data.pages) : '';
    updateBulk();
    refreshPrices(container);
    o.afterRender?.(container, rows);
  }

  function updateBulk() {
    const bar = $('[data-dt-bulk]', container);
    if (!bar) return;
    bar.hidden = selected.size === 0;
    $('[data-dt-count]', bar).textContent = t('staff.table.selected', { n: selected.size });
  }

  async function reload({ keepSelection = false } = {}) {
    const my = ++seq;
    if (!keepSelection) selected.clear();
    body.classList.add('is-dim');
    syncUrl();
    try {
      const res = await o.load({ ...state });
      if (my !== seq) return;
      data = { rows: res.rows || [], total: res.total ?? (res.rows || []).length, pages: res.pages || 1 };
      if (state.page > data.pages && data.pages >= 1 && data.total > 0) {
        state.page = data.pages;
        return reload();
      }
      render();
    } catch (err) {
      if (my !== seq) return;
      body.innerHTML = `<p class="notice notice--danger">${esc(err.message)}</p>`;
    } finally {
      if (my === seq) body.classList.remove('is-dim');
    }
  }

  // ---------- CSV ----------
  const csvCell = (v) => {
    const s = String(v ?? '').replace(/\r?\n/g, ' ');
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  async function exportCsv(button) {
    button.disabled = true;
    try {
      const res = await o.load({ ...state, page: 1, limit: CSV_LIMIT });
      const cols = o.columns.filter((c) => c.csv !== false && (c.csv || c.key));
      const lines = [cols.map((c) => csvCell(c.label)).join(';')];
      (res.rows || []).forEach((r) => lines.push(cols.map((c) => csvCell(typeof c.csv === 'function' ? c.csv(r) : r[c.key])).join(';')));
      // BOM — чтобы Excel открыл кириллицу в UTF-8; разделитель «;» — стандарт для русской локали Excel
      const blob = new Blob([`﻿${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${o.csv}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      if ((res.total || 0) > CSV_LIMIT) toast.info(t('staff.table.csvLimit', { n: CSV_LIMIT }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      button.disabled = false;
    }
  }

  // ---------- События ----------
  const onSearch = debounce(() => {
    state.q = $('[data-dt-search]', container).value.trim();
    state.page = 1;
    reload();
  }, 300);
  container.addEventListener('input', (e) => {
    if (e.target.matches('[data-dt-search]')) onSearch();
  });
  container.addEventListener('change', (e) => {
    const f = e.target.closest('[data-dt-filter]');
    if (f) {
      state[f.dataset.dtFilter] = f.value;
      state.page = 1;
      reload();
      return;
    }
    if (e.target.matches('[data-dt-all]')) {
      data.rows.forEach((r) => (e.target.checked ? selected.add(r.id) : selected.delete(r.id)));
      $$('[data-dt-select]', container).forEach((cb) => (cb.checked = e.target.checked));
      updateBulk();
      return;
    }
    const sel = e.target.closest('[data-dt-select]');
    if (sel) {
      const row = data.rows.find((r) => String(r.id) === sel.dataset.dtSelect);
      if (row) sel.checked ? selected.add(row.id) : selected.delete(row.id);
      updateBulk();
    }
  });
  container.addEventListener('click', async (e) => {
    const s = e.target.closest('[data-dt-sort]');
    if (s) {
      if (state.sort === s.dataset.dtSort) state.dir = state.dir === 'asc' ? 'desc' : 'asc';
      else {
        state.sort = s.dataset.dtSort;
        state.dir = 'asc';
      }
      state.page = 1;
      reload({ keepSelection: true });
      return;
    }
    const p = e.target.closest('[data-dt-page]');
    if (p) {
      state.page = Number(p.dataset.dtPage);
      await reload({ keepSelection: true });
      container.scrollIntoView({ block: 'start', behavior: 'smooth' });
      return;
    }
    const csv = e.target.closest('[data-dt-csv]');
    if (csv) return exportCsv(csv);
    const b = e.target.closest('[data-dt-bulk-action]');
    if (b) {
      const action = o.bulk.find((x) => x.id === b.dataset.dtBulkAction);
      const ids = [...selected];
      if (!action || !ids.length) return;
      if (action.confirm && !(await confirmModal({ title: action.label, text: action.confirm(ids.length), danger: action.danger, confirmLabel: action.label }))) return;
      b.disabled = true;
      try {
        await action.action(ids, data.rows.filter((r) => selected.has(r.id)));
        await reload();
      } catch (err) {
        toast.error(err.message);
      } finally {
        b.disabled = false;
      }
      return;
    }
    if (o.onRow && !e.target.closest('a, button, input, label, select, textarea')) {
      const tr = e.target.closest('[data-dt-row]');
      if (tr) o.onRow(data.rows[Number(tr.dataset.dtRow)], e);
    }
  });

  reload({ keepSelection: true });
  return {
    reload,
    state,
    get rows() {
      return data.rows;
    },
    setFilter(name, value) {
      state[name] = value;
      state.page = 1;
      const select = $(`[data-dt-filter="${name}"]`, container);
      if (select) select.value = value;
      return reload();
    },
  };
}

// Пагинация с сокращением: 1 … 4 5 [6] 7 8 … 20
function pagerHtml(page, pages) {
  const nums = new Set([1, pages, page - 1, page, page + 1, page - 2, page + 2].filter((n) => n >= 1 && n <= pages));
  const list = [...nums].sort((a, b) => a - b);
  let prev = 0;
  let out = `<button type="button" data-dt-page="${Math.max(1, page - 1)}" ${page === 1 ? 'disabled' : ''} aria-label="${esc(t('common.back'))}">${icon('i-chevron-left', 'icon icon--xs')}</button>`;
  list.forEach((n) => {
    if (n - prev > 1) out += '<span class="dt__gap" aria-hidden="true">…</span>';
    out += `<button type="button" data-dt-page="${n}" ${n === page ? 'aria-current="page"' : ''}>${n}</button>`;
    prev = n;
  });
  out += `<button type="button" data-dt-page="${Math.min(pages, page + 1)}" ${page === pages ? 'disabled' : ''} aria-label="${esc(t('common.next'))}">${icon('i-chevron-right', 'icon icon--xs')}</button>`;
  return out;
}

export default createTable;
