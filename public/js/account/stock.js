// Кабинет → Склад (раздел 4 ТЗ, роль warehouse): остатки по складам, размерам и товарам (поиск, фильтры, подсветка
// «доступно < 3»), приёмка и списание с комментарием, очередь сборки (канбан confirmed → assembling → assembled →
// «Передать в доставку»), приёмка одобренных возвратов, журнал движений с фильтрами и CSV.
// Подвкладки: /account/stock[/queue|/returns|/movements]. API: /api/warehouse/* (server/routes/api/warehouse.js)
import { $, $$, esc, icon, debounce } from '../core/dom.js';
import { t, loc, fmtDate, fmtDateTime, fmtNumber } from '../core/i18n.js';
import api from '../core/api.js';
import { openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { withLoading, showApiError, clearErrors } from '../ui/forms.js';
import { statusBadge, empty, loading } from './common.js';
import { createTable } from './table.js';
import { subtabs, kpis, money, since } from './staff.js';

const BASE = 'stock';

export async function render(view, ctx, params) {
  const tab = ['queue', 'returns', 'movements'].includes(params[0]) ? params[0] : '';
  view.innerHTML = loading();
  const [summary, { warehouses }] = await Promise.all([api.get('/warehouse/summary'), api.get('/warehouse/warehouses')]);
  ctx.setHead({ eyebrow: t('staff.stock.eyebrow'), title: t('account.nav.stock'), crumbs: [{ label: t('account.nav.stock') }] });
  const queueCount = summary.confirmed + summary.assembling + summary.assembled;
  view.innerHTML = `
    ${subtabs(BASE, [
      { id: '', label: t('staff.stock.tabs.stock'), icon: 'i-box', count: summary.low },
      { id: 'queue', label: t('staff.stock.tabs.queue'), icon: 'i-clock', count: queueCount },
      { id: 'returns', label: t('staff.stock.tabs.returns'), icon: 'i-return', count: summary.returns },
      { id: 'movements', label: t('staff.stock.tabs.movements'), icon: 'i-list' },
    ], tab)}
    <div data-stock-body></div>`;
  const body = $('[data-stock-body]', view);
  const c = { ctx, warehouses, summary };
  if (tab === 'queue') return renderQueue(body, c);
  if (tab === 'returns') return renderReturns(body, c);
  if (tab === 'movements') return renderMovements(body, c);
  return renderStock(body, c);
}

const whOptions = (warehouses, allLabel = t('staff.stock.allWarehouses')) => [{ value: '', label: allLabel }, ...warehouses.map((w) => ({ value: w.id, label: w.city }))];

// ---------------------------------------------------------------------------------------------
// Остатки
// ---------------------------------------------------------------------------------------------
function renderStock(body, { warehouses, summary }) {
  body.innerHTML = `
    <ul class="whs">${warehouses
      .map(
        (w, i) => `<li data-reveal><button type="button" class="wh" data-wh="${w.id}">
          <span class="wh__n t-mono">${String(i + 1).padStart(2, '0')}</span>
          <span class="wh__city">${esc(w.city)}</span>
          <span class="wh__name t-mono">${esc(w.name)}</span>
          <span class="wh__nums">
            <span><b class="t-mono">${fmtNumber(w.available)}</b><i class="t-mono">${esc(t('staff.stock.available'))}</i></span>
            <span><b class="t-mono">${fmtNumber(w.reserved)}</b><i class="t-mono">${esc(t('staff.stock.reserved'))}</i></span>
            <span class="${w.low ? 'is-low' : ''}"><b class="t-mono">${fmtNumber(w.low)}</b><i class="t-mono">${esc(t('staff.stock.low'))}</i></span>
          </span>
          <span class="wh__addr">${icon('i-pin', 'icon icon--xs')} ${esc(w.address)}</span>
        </button></li>`
      )
      .join('')}</ul>
    <div data-table></div>`;
  const table = createTable($('[data-table]', body), {
    csv: 'amfibia-stock',
    sort: 'available',
    dir: 'asc',
    pageSize: 25,
    search: { placeholder: t('staff.stock.searchPh') },
    filters: [
      { name: 'warehouse', label: t('staff.col.warehouse'), value: '', options: whOptions(warehouses) },
      { name: 'low', label: t('staff.stock.show'), value: '', options: [{ value: '', label: t('staff.stock.allRows') }, { value: '1', label: t('staff.stock.onlyLow') }] },
    ],
    toolbar: `<button type="button" class="btn btn--sm" data-income-new>${icon('i-plus', 'icon icon--sm')} ${esc(t('staff.stock.income'))}</button>`,
    load: (s) => api.get('/warehouse/stock', s),
    rowClass: (r) => (r.low ? 'is-low' : ''),
    columns: [
      { key: 'name', label: t('staff.col.product'), sort: 'name', className: 'dt__wide', render: (r) => `<span class="dt-prod"><img src="${esc(r.image)}" alt="" loading="lazy"><span><span class="dt-prod__name">${esc(loc(r.name))}</span><span class="dt-prod__meta t-mono">${esc(r.brand)}</span></span></span>`, csv: (r) => loc(r.name) },
      { key: 'sku', label: t('staff.col.sku'), sort: 'sku', className: 't-mono', render: (r) => esc(r.sku) },
      { key: 'size', label: t('staff.col.size'), className: 't-mono' },
      { key: 'warehouse', label: t('staff.col.warehouse'), sort: 'warehouse', className: 'dt__hide-sm', render: (r) => esc(r.city), csv: (r) => r.city },
      { key: 'quantity', label: t('staff.stock.quantity'), sort: 'quantity', className: 't-mono' },
      { key: 'reserved', label: t('staff.stock.reserved'), sort: 'reserved', className: 't-mono' },
      { key: 'available', label: t('staff.stock.available'), sort: 'available', className: 't-mono', render: (r) => `<b class="stock-av ${r.low ? 'is-low' : ''}">${r.available}</b>${r.low ? `<span class="stock-flag">${esc(t('staff.stock.lowFlag'))}</span>` : ''}` },
      {
        key: 'actions',
        label: '',
        csv: false,
        className: 'dt__actions',
        render: (r) => `<button type="button" class="icon-btn" data-income="${r.id}" title="${esc(t('staff.stock.income'))}" aria-label="${esc(t('staff.stock.income'))}">${icon('i-plus', 'icon icon--sm')}</button>
          <button type="button" class="icon-btn" data-writeoff="${r.id}" title="${esc(t('staff.stock.writeoff'))}" aria-label="${esc(t('staff.stock.writeoff'))}" ${r.available ? '' : 'disabled'}>${icon('i-minus', 'icon icon--sm')}</button>`,
      },
    ],
  });
  body.addEventListener('click', (e) => {
    const wh = e.target.closest('[data-wh]');
    if (wh) {
      $$('[data-wh]', body).forEach((b) => b.classList.toggle('is-active', b === wh && !b.classList.contains('is-active')));
      table.setFilter('warehouse', wh.classList.contains('is-active') ? wh.dataset.wh : '');
      return;
    }
    if (e.target.closest('[data-income-new]')) return movementModal({ type: 'income', warehouses, onDone: () => table.reload() });
    const inc = e.target.closest('[data-income]');
    if (inc) return movementModal({ type: 'income', warehouses, row: table.rows.find((r) => r.id === Number(inc.dataset.income)), onDone: () => table.reload({ keepSelection: true }) });
    const wo = e.target.closest('[data-writeoff]');
    if (wo) return movementModal({ type: 'writeoff', warehouses, row: table.rows.find((r) => r.id === Number(wo.dataset.writeoff)), onDone: () => table.reload({ keepSelection: true }) });
  });
  void summary;
}

// Модалка приёмки / списания. row — строка остатка (вариант + склад); без row — поиск варианта по артикулу
function movementModal({ type, warehouses, row = null, onDone }) {
  const form = document.createElement('form');
  form.className = 'acc-form mv-form';
  form.noValidate = true;
  let variant = row ? { id: row.variantId, sku: row.sku, size: row.size, name: row.name, brand: row.brand, image: row.image } : null;
  form.innerHTML = `
    ${row ? '' : `<div class="field"><label class="field__label" for="mv-q">${esc(t('staff.stock.findVariant'))}</label>
      <input class="input" id="mv-q" type="search" autocomplete="off" placeholder="${esc(t('staff.stock.findPh'))}" autofocus>
      <ul class="mv-results" data-results></ul><p class="field__error" data-error-for="variantId"></p></div>`}
    <div class="mv-variant" data-variant></div>
    <div class="form-grid form-grid--2">
      <div class="field"><label class="field__label" for="mv-wh">${esc(t('staff.col.warehouse'))}</label>
        <select class="select" id="mv-wh" name="warehouseId" ${row ? 'disabled' : ''}>${warehouses.map((w) => `<option value="${w.id}" ${row?.warehouseId === w.id ? 'selected' : ''}>${esc(w.city)} — ${esc(w.name)}</option>`).join('')}</select></div>
      <div class="field"><label class="field__label" for="mv-qty">${esc(t('staff.stock.qty'))}</label>
        <input class="input t-mono" id="mv-qty" name="quantity" type="number" min="1" ${type === 'writeoff' && row ? `max="${row.available}"` : ''} value="1" required><p class="field__error" data-error-for="quantity"></p>
        ${row ? `<p class="field__hint t-mono">${esc(t('staff.stock.now', { q: row.quantity, r: row.reserved, a: row.available }))}</p>` : ''}</div>
      <div class="field field--wide"><label class="field__label" for="mv-comment">${esc(t('staff.stock.comment'))}</label>
        <input class="input" id="mv-comment" name="comment" maxlength="300" placeholder="${esc(t(type === 'income' ? 'staff.stock.incomePh' : 'staff.stock.writeoffPh'))}" required><p class="field__error" data-error-for="comment"></p></div>
    </div>
    <p class="notice notice--danger" data-form-error hidden></p>
    <div class="modal__actions"><button type="button" class="btn btn--ghost btn--sm" data-modal-close>${esc(t('common.cancel'))}</button>
      <button type="submit" class="btn btn--sm ${type === 'writeoff' ? 'btn--danger' : ''}">${esc(t(type === 'income' ? 'staff.stock.doIncome' : 'staff.stock.doWriteoff'))}</button></div>`;
  const modal = openModal({ title: t(type === 'income' ? 'staff.stock.incomeTitle' : 'staff.stock.writeoffTitle'), content: form, size: 'wide' });
  const drawVariant = () => {
    $('[data-variant]', form).innerHTML = variant
      ? `<div class="ret-item"><img src="${esc(variant.image)}" alt=""><div><p>${esc(loc(variant.name))}</p><p class="t-mono t-muted">${esc(variant.brand)} · ${esc(variant.sku)} · ${esc(variant.size)}</p></div></div>`
      : '';
  };
  drawVariant();
  const q = $('#mv-q', form);
  if (q) {
    const search = debounce(async () => {
      const value = q.value.trim();
      const list = $('[data-results]', form);
      if (value.length < 2) return (list.innerHTML = '');
      const { variants } = await api.get('/warehouse/variants', { q: value });
      list.innerHTML = variants.length
        ? variants.map((v, i) => `<li><button type="button" data-pick="${i}"><img src="${esc(v.image)}" alt=""><span>${esc(loc(v.name))}<small class="t-mono">${esc(v.sku)} · ${esc(v.size)} · ${v.stock.map((s) => `${warehouses.find((w) => w.id === s.warehouseId)?.city || s.warehouseId}: ${s.quantity - s.reserved}`).join(' / ') || '—'}</small></span></button></li>`).join('')
        : `<li class="t-muted">${esc(t('staff.table.empty'))}</li>`;
      list.onclick = (e) => {
        const b = e.target.closest('[data-pick]');
        if (!b) return;
        variant = variants[Number(b.dataset.pick)];
        list.innerHTML = '';
        q.value = variant.sku;
        drawVariant();
      };
    }, 300);
    q.addEventListener('input', search);
  }
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    if (!variant) return showApiError(form, { status: 422, details: [{ field: 'variantId', message: t('staff.stock.pickVariant') }] });
    const payload = { variantId: variant.id, warehouseId: Number(form.elements.warehouseId.value), quantity: Number(form.elements.quantity.value), comment: form.elements.comment.value.trim() };
    await withLoading($('[type=submit]', form), async () => {
      try {
        const res = await api.post(`/warehouse/${type}`, payload);
        modal.close();
        toast.success(t(type === 'income' ? 'staff.stock.incomeDone' : 'staff.stock.writeoffDone', { n: payload.quantity }), t('staff.stock.nowAvailable', { n: res.stock.available }));
        onDone?.();
      } catch (err) {
        showApiError(form, err);
      }
    });
  });
}

// ---------------------------------------------------------------------------------------------
// Очередь сборки — канбан из трёх колонок; кнопка на карточке переводит заказ на следующий шаг
// ---------------------------------------------------------------------------------------------
async function renderQueue(body, { warehouses }) {
  const cols = [
    { status: 'confirmed', action: 'staff.stock.start', icon: 'i-play' },
    { status: 'assembling', action: 'staff.stock.assembled', icon: 'i-check' },
    { status: 'assembled', action: 'staff.stock.handOver', icon: 'i-truck' },
  ];
  let wh = '';
  let timer = null;
  async function draw() {
    const { orders } = await api.get('/warehouse/queue', { warehouse: wh });
    body.innerHTML = `
      <div class="queue-head">
        <p class="t-muted">${esc(t('staff.stock.queueLead'))}</p>
        <div class="seg" role="group">${whOptions(warehouses).map((w) => `<button type="button" data-qwh="${w.value}" aria-pressed="${String(w.value) === String(wh)}">${esc(w.label)}</button>`).join('')}</div>
      </div>
      <div class="kanban">${cols
        .map((col, ci) => {
          const list = orders.filter((o) => o.status === col.status);
          return `<section class="kanban__col" data-col="${col.status}">
            <header class="kanban__head"><span class="t-mono">${String(ci + 1).padStart(2, '0')}</span><h3>${esc(t(`statuses.${col.status}`))}</h3><b class="t-mono">${list.length}</b></header>
            ${list.length ? list.map((o) => card(o, col)).join('') : `<p class="kanban__empty t-mono">${esc(t('staff.stock.colEmpty'))}</p>`}
          </section>`;
        })
        .join('')}</div>`;
  }
  const card = (o, col) => {
    const byWh = {};
    o.items.forEach((i) => (byWh[i.warehouse || '—'] ||= []).push(i));
    const qty = o.items.reduce((s, i) => s + i.qty, 0);
    return `<article class="qcard" data-order="${o.id}">
      <header class="qcard__head"><b class="t-mono">${esc(o.orderNumber)}</b><span class="t-mono t-muted" title="${esc(fmtDateTime(o.statusAt))}">${esc(since(o.statusAt))}</span></header>
      <p class="qcard__meta">${icon(o.delivery.isPickup ? 'i-pin' : 'i-truck', 'icon icon--xs')} ${esc(loc(o.delivery.name))} · ${esc(o.city || '')}</p>
      ${Object.entries(byWh)
        .map(([w, items]) => `<div class="qcard__wh"><p class="t-mono">${esc(w)}</p><ul>${items.map((i) => `<li><img src="${esc(i.image)}" alt="" loading="lazy"><span>${esc(loc(i.name).split(' — ').pop())}<small class="t-mono">${esc(i.sku)} · ${esc(i.size)} × ${i.qty}</small></span></li>`).join('')}</ul></div>`)
        .join('')}
      ${o.comment ? `<p class="qcard__comment">${icon('i-chat', 'icon icon--xs')} ${esc(o.comment)}</p>` : ''}
      <footer class="qcard__foot"><span class="t-mono t-muted">${esc(t('account.items', { n: qty }))}${o.courier ? ` · ${esc(o.courier)}` : ''}</span>
        <button type="button" class="btn btn--xs ${col.status === 'assembled' ? 'btn--accent' : ''}" data-advance="${o.id}">${icon(col.icon, 'icon icon--xs')} ${esc(t(col.action))}</button></footer>
    </article>`;
  };
  await draw();
  body.addEventListener('click', async (e) => {
    const w = e.target.closest('[data-qwh]');
    if (w) {
      wh = w.dataset.qwh;
      return draw();
    }
    const adv = e.target.closest('[data-advance]');
    if (!adv) return;
    const cardEl = adv.closest('.qcard');
    await withLoading(adv, async () => {
      try {
        const { result } = await api.post(`/warehouse/orders/${adv.dataset.advance}/advance`, {});
        cardEl.classList.add('is-leaving');
        toast.success(t('staff.stock.advanced', { number: result.orderNumber }), t(`statuses.${result.to}`));
        setTimeout(draw, 420);
      } catch (err) {
        toast.error(err.message);
      }
    });
  });
  // Новые заказы попадают в очередь без перезагрузки — опрос раз в 30 секунд
  timer = setInterval(() => draw().catch(() => {}), 30_000);
  return () => clearInterval(timer);
}

// ---------------------------------------------------------------------------------------------
// Возвраты: одобренные поддержкой заявки ждут приёмки на склад
// ---------------------------------------------------------------------------------------------
async function renderReturns(body, { warehouses }) {
  let scope = 'awaiting';
  async function draw() {
    const { returns } = await api.get('/warehouse/returns', { scope });
    body.innerHTML = `
      <div class="seg acc-filter" role="tablist">${['awaiting', 'received'].map((s) => `<button type="button" role="tab" data-scope="${s}" aria-selected="${s === scope}" aria-pressed="${s === scope}">${esc(t(`staff.stock.ret.${s}`))}</button>`).join('')}</div>
      ${
        returns.length
          ? `<ul class="rlist">${returns
              .map(
                (r) => `<li class="ritem" data-reveal>
                  <img class="ritem__img" src="${esc(r.item.image)}" alt="" loading="lazy">
                  <div class="ritem__body">
                    <p class="ritem__name">${esc(loc(r.item.name))}</p>
                    <p class="t-mono t-muted">${esc(r.orderNumber)} · ${esc(r.item.sku)} · ${esc(r.item.size)} × ${r.quantity} · ${esc(r.buyer)}</p>
                    <p class="ritem__reason">${esc(t(`account.returnReasons.${r.reasonCode}`))}: ${esc(r.reason)}</p>
                    ${r.comment ? `<p class="ritem__comment">${icon('i-chat', 'icon icon--xs')} ${esc(r.comment)}</p>` : ''}
                    ${r.photo ? `<a class="ritem__photo" href="${esc(r.photo)}" target="_blank" rel="noopener"><img src="${esc(r.photo)}" alt=""></a>` : ''}
                  </div>
                  <div class="ritem__side">
                    ${
                      r.receivedAt
                        ? `${statusBadge('approved', t('staff.stock.ret.receivedBadge'))}<p class="t-mono t-muted">${esc(fmtDateTime(r.receivedAt))}<br>${esc(r.receivedBy || '')}</p>`
                        : `<p class="t-mono t-muted">${esc(t('staff.stock.ret.approvedAt', { date: fmtDate(r.resolvedAt) }))}</p>
                           ${r.item.restockable ? `<label class="sr-only" for="rw-${r.id}">${esc(t('staff.col.warehouse'))}</label><select class="select" id="rw-${r.id}" data-rwh="${r.id}">${warehouses.map((w) => `<option value="${w.id}" ${w.id === r.item.warehouseId ? 'selected' : ''}>${esc(w.city)}</option>`).join('')}</select>` : `<p class="t-mono t-muted">${esc(t('staff.stock.ret.noVariant'))}</p>`}
                           <button type="button" class="btn btn--sm" data-receive="${r.id}">${icon('i-download', 'icon icon--sm')} ${esc(t('staff.stock.ret.receive'))}</button>`
                    }
                    <p class="ritem__sum t-mono">${money(r.item.price * r.quantity)}</p>
                  </div>
                </li>`
              )
              .join('')}</ul>`
          : empty({ ornament: 'orn-fleur', title: t(scope === 'awaiting' ? 'staff.stock.ret.none' : 'staff.stock.ret.noneReceived') })
      }`;
  }
  await draw();
  body.addEventListener('click', async (e) => {
    const s = e.target.closest('[data-scope]');
    if (s) {
      scope = s.dataset.scope;
      return draw();
    }
    const b = e.target.closest('[data-receive]');
    if (!b) return;
    const whSelect = $(`[data-rwh="${b.dataset.receive}"]`, body);
    await withLoading(b, async () => {
      try {
        const r = await api.post(`/warehouse/returns/${b.dataset.receive}/receive`, { warehouseId: whSelect ? Number(whSelect.value) : null });
        toast.success(t('staff.stock.ret.receivedToast'), r.orderReturned ? t('staff.stock.ret.orderReturned') : '');
        await draw();
      } catch (err) {
        toast.error(err.message);
      }
    });
  });
}

// ---------------------------------------------------------------------------------------------
// Журнал движений остатков
// ---------------------------------------------------------------------------------------------
function renderMovements(body, { warehouses }) {
  const types = ['income', 'reserve', 'unreserve', 'outcome', 'return', 'writeoff'];
  const sign = { income: '+', return: '+', unreserve: '↺', reserve: '◷', outcome: '−', writeoff: '−' };
  body.innerHTML = `
    <form class="dt-dates" data-dates>
      <label class="dt__filter"><span class="dt__filter-label t-mono">${esc(t('staff.from'))}</span><input class="input" type="date" name="from"></label>
      <label class="dt__filter"><span class="dt__filter-label t-mono">${esc(t('staff.to'))}</span><input class="input" type="date" name="to"></label>
    </form>
    <div data-table></div>`;
  const dates = $('[data-dates]', body);
  const url = new URLSearchParams(location.search);
  dates.elements.from.value = url.get('from') || '';
  dates.elements.to.value = url.get('to') || '';
  const table = createTable($('[data-table]', body), {
    csv: 'amfibia-stock-movements',
    sort: 'created',
    pageSize: 30,
    search: { placeholder: t('staff.stock.movesSearchPh') },
    filters: [
      { name: 'type', label: t('staff.col.type'), value: 'all', options: [{ value: 'all', label: t('common.all') }, ...types.map((x) => ({ value: x, label: t(`staff.move.${x}`) }))] },
      { name: 'warehouse', label: t('staff.col.warehouse'), value: '', options: whOptions(warehouses) },
    ],
    load: (s) => {
      const from = dates.elements.from.value;
      const to = dates.elements.to.value;
      const next = new URLSearchParams(location.search);
      from ? next.set('from', from) : next.delete('from');
      to ? next.set('to', to) : next.delete('to');
      history.replaceState(null, '', `${location.pathname}?${next}`);
      return api.get('/warehouse/movements', { ...s, from, to });
    },
    columns: [
      { key: 'createdAt', label: t('staff.col.date'), sort: 'created', className: 't-mono', render: (m) => esc(fmtDateTime(m.createdAt)), csv: (m) => m.createdAt },
      { key: 'type', label: t('staff.col.type'), sort: 'type', render: (m) => `<span class="mv-type mv-type--${m.type}"><b>${sign[m.type]}</b>${esc(t(`staff.move.${m.type}`))}</span>`, csv: (m) => t(`staff.move.${m.type}`) },
      { key: 'quantity', label: t('staff.stock.qty'), sort: 'quantity', className: 't-mono' },
      { key: 'sku', label: t('staff.col.product'), className: 'dt__wide', render: (m) => `${esc(loc(m.name))}<span class="dt-sub t-mono">${esc(m.sku)}</span>`, csv: (m) => `${m.sku} ${loc(m.name)}` },
      { key: 'warehouse', label: t('staff.col.warehouse'), className: 'dt__hide-sm' },
      { key: 'orderNumber', label: t('staff.col.order'), className: 't-mono dt__hide-sm', render: (m) => esc(m.orderNumber || '—') },
      { key: 'author', label: t('staff.col.author'), className: 'dt__hide-sm', render: (m) => `${esc(m.author || t('staff.system'))}${m.authorRole ? `<span class="dt-sub t-mono">${esc(t(`roles.${m.authorRole}`))}</span>` : ''}`, csv: (m) => m.author || '' },
      { key: 'comment', label: t('staff.stock.comment'), className: 'dt__hide-sm dt__muted' },
    ],
  });
  dates.addEventListener('change', () => {
    table.state.page = 1;
    table.reload();
  });
}
