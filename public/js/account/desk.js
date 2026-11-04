// Кабинет → Поддержка клиентов (раздел 4 ТЗ, роль support): обращения (список + переписка, ответ с фото, закрытие),
// заявки на возврат (одобрить / отклонить с комментарием), все заказы (просмотр; из действий — только отмена
// по просьбе клиента). Подвкладки: /account/desk[/tickets/:id|/returns|/orders|/orders/:id].
// API: /api/support/* (server/routes/api/support.js)
import { $, esc, icon } from '../core/dom.js';
import { t, loc, fmtDate, fmtDateTime, fmtRelative, fmtNumber } from '../core/i18n.js';
import api from '../core/api.js';
import { formatMoney } from '../core/currency.js';
import { openModal, confirmModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { withLoading, showApiError, clearErrors } from '../ui/forms.js';
import { renderTimeline } from '../ui/timeline.js';
import { statusBadge, empty, loading, orderMoney } from './common.js';
import { createTable } from './table.js';
import { subtabs, kpis, money } from './staff.js';

const BASE = 'desk';

export async function render(view, ctx, params) {
  const tab = ['returns', 'orders'].includes(params[0]) ? params[0] : '';
  view.innerHTML = loading();
  if (params[0] === 'orders' && params[1]) return renderOrder(view, ctx, Number(params[1]));
  const summary = await api.get('/support/summary');
  ctx.setHead({ eyebrow: t('staff.desk.eyebrow'), title: t('account.nav.desk'), crumbs: [{ label: t('account.nav.desk') }] });
  view.innerHTML = `
    ${subtabs(BASE, [
      { id: '', label: t('staff.desk.tabs.tickets'), icon: 'i-chat', count: summary.open_tickets },
      { id: 'returns', label: t('staff.desk.tabs.returns'), icon: 'i-return', count: summary.pending_returns },
      { id: 'orders', label: t('staff.desk.tabs.orders'), icon: 'i-box', count: summary.active_orders },
    ], tab)}
    <div data-desk-body></div>`;
  const body = $('[data-desk-body]', view);
  if (tab === 'returns') return renderReturns(body, ctx);
  if (tab === 'orders') return renderOrders(body, ctx);
  return renderTickets(body, ctx, params[0] === 'tickets' ? Number(params[1]) : null, summary);
}

// ---------------------------------------------------------------------------------------------
// Обращения: слева список, справа переписка (на телефоне — по очереди)
// ---------------------------------------------------------------------------------------------
async function renderTickets(body, ctx, openId, summary) {
  let status = new URLSearchParams(location.search).get('status') || 'open';
  let q = '';
  let current = openId;
  let timer = null;
  body.innerHTML = `
    ${kpis([
      { label: t('staff.desk.open'), value: fmtNumber(summary.open_tickets), tone: summary.open_tickets ? 'warn' : '' },
      { label: t('staff.desk.answered'), value: fmtNumber(summary.answered_tickets) },
      { label: t('staff.desk.pendingReturns'), value: fmtNumber(summary.pending_returns), tone: summary.pending_returns ? 'accent' : '' },
      { label: t('staff.desk.ordersToday'), value: fmtNumber(summary.orders_today) },
    ])}
    <div class="desk ${current ? 'has-open' : ''}" data-desk>
      <aside class="desk__list">
        <div class="desk__filters">
          <div class="seg" role="group">${['open', 'answered', 'closed', 'all'].map((s) => `<button type="button" data-tstatus="${s}" aria-pressed="${s === status}">${esc(s === 'all' ? t('common.all') : t(`account.ticketStatus.${s}`))}</button>`).join('')}</div>
          <label class="dt__search">${icon('i-search', 'icon icon--sm')}<span class="sr-only">${esc(t('staff.table.search'))}</span><input class="input" type="search" data-tq placeholder="${esc(t('staff.desk.searchPh'))}"></label>
        </div>
        <ul class="desk__tickets" data-tlist></ul>
      </aside>
      <section class="desk__chat" data-chat-pane></section>
    </div>`;
  const desk = $('[data-desk]', body);

  async function drawList() {
    const data = await api.get('/support/tickets', { status, q, limit: 50 });
    $('[data-tlist]', body).innerHTML = data.rows.length
      ? data.rows
          .map(
            (tk) => `<li><a class="dtk ${tk.id === current ? 'is-active' : ''} ${tk.status === 'open' ? 'is-open' : ''}" href="/account/desk/tickets/${tk.id}" data-ticket="${tk.id}">
              <span class="dtk__head"><b>${esc(tk.customer)}</b><span class="t-mono t-muted">${esc(fmtRelative(tk.updatedAt))}</span></span>
              <span class="dtk__subject">${esc(tk.subject)}</span>
              <span class="dtk__last">${tk.lastIsStaff ? `<i class="t-mono">${esc(t('staff.desk.you'))}:</i> ` : ''}${esc(tk.lastMessage || '')}</span>
              <span class="dtk__meta t-mono">#${tk.id}${tk.orderNumber ? ` · ${esc(tk.orderNumber)}` : ''} · ${statusBadge(tk.status, t(`account.ticketStatus.${tk.status}`))}</span>
            </a></li>`
          )
          .join('')
      : `<li>${empty({ ornament: 'orn-dagger', title: t('staff.desk.noTickets') })}</li>`;
  }

  async function drawChat() {
    const pane = $('[data-chat-pane]', body);
    desk.classList.toggle('has-open', Boolean(current));
    if (!current) {
      pane.innerHTML = `<div class="desk__placeholder">${icon('orn-cross-filigree', 'icon--fill desk__orn')}<p>${esc(t('staff.desk.pick'))}</p></div>`;
      return;
    }
    const data = await api.get(`/support/tickets/${current}`);
    const tk = data.ticket;
    pane.innerHTML = `
      <header class="desk__chat-head">
        <button type="button" class="link-u t-mono desk__back" data-back>${esc(t('staff.desk.backToList'))}</button>
        <p class="t-mono t-muted">#${tk.id} · ${esc(fmtDateTime(tk.createdAt))}</p>
        <h2 class="desk__subject">${esc(tk.subject)}</h2>
        <p class="desk__who">${icon('i-user', 'icon icon--xs')} ${esc(tk.customer)} · <a class="link-u" href="mailto:${esc(tk.email)}">${esc(tk.email)}</a>${tk.phone ? ` · <span class="t-mono">${esc(tk.phone)}</span>` : ''}</p>
        ${tk.orderNumber ? `<p class="desk__who">${icon('i-box', 'icon icon--xs')} <a class="link-u t-mono" href="/account/desk/orders/${tk.orderId}" data-acc-link>${esc(tk.orderNumber)}</a> ${statusBadge(tk.orderStatus)}</p>` : ''}
        ${statusBadge(tk.status, t(`account.ticketStatus.${tk.status}`))}${tk.assignee ? ` <span class="t-mono t-muted">${esc(t('staff.desk.assignee', { name: tk.assignee }))}</span>` : ''}
      </header>
      <ol class="chat" data-chat>${data.messages
        .map(
          (m) => `<li class="msg ${m.isStaff ? 'is-own' : 'is-staff'}">
            <p class="msg__author t-mono">${esc(m.isStaff ? `${t('account.staff')} · ${m.author}` : m.author)}</p>
            <div class="msg__bubble">${esc(m.message).replace(/\n/g, '<br>')}${m.image ? `<a href="${esc(m.image)}" target="_blank" rel="noopener"><img src="${esc(m.image)}" alt=""></a>` : ''}</div>
            <p class="msg__time t-mono">${esc(fmtDateTime(m.createdAt))}</p>
          </li>`
        )
        .join('')}</ol>
      ${
        tk.status === 'closed'
          ? `<p class="notice">${esc(t('account.ticketStatus.closed'))}</p>`
          : `<form class="chat-form" data-reply novalidate>
              <div class="desk__templates">${['hello', 'size', 'delivery', 'refund'].map((k) => `<button type="button" class="chip" data-tpl="${k}">${esc(t(`staff.desk.tpl.${k}.label`))}</button>`).join('')}</div>
              <label class="sr-only" for="desk-reply">${esc(t('account.reply'))}</label>
              <textarea class="textarea" id="desk-reply" name="message" rows="3" maxlength="4000" placeholder="${esc(t('staff.desk.replyPh'))}" required></textarea>
              <div class="chat-form__row">
                <label class="chat-form__attach link-u t-mono">${icon('i-upload', 'icon icon--xs')} <span data-file-name>${esc(t('account.attach'))}</span><input type="file" name="image" accept="image/jpeg,image/png,image/webp" hidden></label>
                <button type="button" class="link-u t-mono" data-close-ticket>${esc(t('account.closeTicket'))}</button>
                <button type="submit" class="btn btn--sm">${esc(t('staff.desk.sendReply'))}</button>
              </div>
              <p class="notice notice--danger" data-form-error hidden></p>
            </form>`
      }`;
    const chat = $('[data-chat]', pane);
    chat.scrollTop = chat.scrollHeight;
  }

  await Promise.all([drawList(), drawChat()]);
  const go = (id) => {
    current = id;
    history.replaceState(null, '', id ? `/account/desk/tickets/${id}` : '/account/desk');
    drawList();
    drawChat();
  };
  body.addEventListener('click', async (e) => {
    const s = e.target.closest('[data-tstatus]');
    if (s) {
      status = s.dataset.tstatus;
      body.querySelectorAll('[data-tstatus]').forEach((b) => b.setAttribute('aria-pressed', String(b === s)));
      return drawList();
    }
    const a = e.target.closest('[data-ticket]');
    if (a) {
      e.preventDefault();
      return go(Number(a.dataset.ticket));
    }
    if (e.target.closest('[data-back]')) return go(null);
    const tpl = e.target.closest('[data-tpl]');
    if (tpl) {
      const area = $('#desk-reply', body);
      area.value = `${area.value ? `${area.value}\n` : ''}${t(`staff.desk.tpl.${tpl.dataset.tpl}.text`)}`;
      area.focus();
      return;
    }
    if (e.target.closest('[data-close-ticket]')) {
      if (!(await confirmModal({ title: t('account.closeTicket'), confirmLabel: t('account.closeTicket') }))) return;
      await api.post(`/support/tickets/${current}/close`);
      toast.success(t('account.ticketClosed'));
      drawList();
      drawChat();
    }
  });
  body.addEventListener('input', (e) => {
    if (!e.target.matches('[data-tq]')) return;
    clearTimeout(body._tq);
    body._tq = setTimeout(() => {
      q = e.target.value.trim();
      drawList();
    }, 300);
  });
  body.addEventListener('change', (e) => {
    if (e.target.name === 'image') $('[data-file-name]', body).textContent = e.target.files[0]?.name || t('account.attach');
  });
  body.addEventListener('submit', async (e) => {
    if (!e.target.matches('[data-reply]')) return;
    e.preventDefault();
    const form = e.target;
    const text = form.elements.message.value.trim();
    if (!text) return form.elements.message.focus();
    const fd = new FormData();
    fd.append('message', text);
    if (form.elements.image.files[0]) fd.append('image', form.elements.image.files[0]);
    await withLoading($('[type=submit]', form), async () => {
      try {
        await api.post(`/support/tickets/${current}/messages`, fd);
        toast.success(t('staff.desk.replied'));
        await Promise.all([drawList(), drawChat()]);
      } catch (err) {
        showApiError(form, err);
      }
    });
  });
  // Новые обращения и сообщения клиентов — опрос раз в 30 секунд (только если поле ответа пустое)
  timer = setInterval(() => {
    drawList().catch(() => {});
    const area = $('#desk-reply', body);
    if (current && (!area || !area.value)) drawChat().catch(() => {});
  }, 30_000);
  return () => clearInterval(timer);
}

// ---------------------------------------------------------------------------------------------
// Заявки на возврат
// ---------------------------------------------------------------------------------------------
async function renderReturns(body) {
  let status = 'pending';
  async function draw() {
    const data = await api.get('/support/returns', { status, limit: 50 });
    body.innerHTML = `
      <div class="seg acc-filter" role="tablist">${['pending', 'approved', 'rejected', 'all'].map((s) => `<button type="button" role="tab" data-rstatus="${s}" aria-selected="${s === status}" aria-pressed="${s === status}">${esc(s === 'all' ? t('common.all') : t(`account.returnStatus.${s}`))}</button>`).join('')}</div>
      ${
        data.rows.length
          ? `<ul class="rlist">${data.rows
              .map((r) => {
                const days = r.deliveredAt ? Math.floor((new Date(r.createdAt) - new Date(r.deliveredAt)) / 86400000) : null;
                return `<li class="ritem" data-reveal>
                  <img class="ritem__img" src="${esc(r.item.image)}" alt="" loading="lazy">
                  <div class="ritem__body">
                    <p class="ritem__name">${esc(loc(r.item.name))}</p>
                    <p class="t-mono t-muted"><a class="link-u" href="/account/desk/orders/${r.orderId}" data-acc-link>${esc(r.orderNumber)}</a> · ${esc(r.item.sku)} · ${esc(r.item.size)} × ${r.quantity} · ${esc(r.customer)} (${esc(r.email)})</p>
                    <p class="ritem__reason"><b>${esc(t(`account.returnReasons.${r.reasonCode}`))}.</b> ${esc(r.reason)}</p>
                    <p class="t-mono t-muted">${esc(t('staff.desk.retFiled', { date: fmtDateTime(r.createdAt) }))}${days !== null ? ` · ${esc(t('staff.desk.retDays', { n: days }))}` : ''}</p>
                    ${r.comment ? `<p class="ritem__comment">${icon('i-chat', 'icon icon--xs')} ${esc(r.comment)}${r.resolver ? ` — ${esc(r.resolver)}` : ''}</p>` : ''}
                    ${r.photo ? `<a class="ritem__photo" href="${esc(r.photo)}" target="_blank" rel="noopener"><img src="${esc(r.photo)}" alt="${esc(t('account.returnPhoto'))}"></a>` : ''}
                  </div>
                  <div class="ritem__side">
                    ${statusBadge(r.status, t(`account.returnStatus.${r.status}`))}
                    ${r.received ? `<span class="t-mono t-muted">${esc(t('account.returnReceived'))}</span>` : ''}
                    <p class="ritem__sum t-mono">${money(r.item.price * r.quantity)}</p>
                    ${r.status === 'pending' ? `<button type="button" class="btn btn--sm" data-resolve="approve" data-id="${r.id}">${icon('i-check', 'icon icon--sm')} ${esc(t('staff.desk.approve'))}</button>
                      <button type="button" class="btn btn--sm btn--ghost" data-resolve="reject" data-id="${r.id}">${esc(t('staff.desk.reject'))}</button>` : ''}
                  </div>
                </li>`;
              })
              .join('')}</ul>`
          : empty({ ornament: 'orn-fleur', title: t('staff.desk.noReturns') })
      }`;
  }
  await draw();
  body.addEventListener('click', (e) => {
    const s = e.target.closest('[data-rstatus]');
    if (s) {
      status = s.dataset.rstatus;
      return draw();
    }
    const b = e.target.closest('[data-resolve]');
    if (!b) return;
    const decision = b.dataset.resolve;
    const form = document.createElement('form');
    form.className = 'acc-form';
    form.noValidate = true;
    form.innerHTML = `
      <p class="lead">${esc(t(decision === 'approve' ? 'staff.desk.approveText' : 'staff.desk.rejectText'))}</p>
      <div class="field"><label class="field__label" for="res-comment">${esc(t(decision === 'approve' ? 'staff.desk.commentOptional' : 'staff.desk.commentRequired'))}</label>
        <textarea class="textarea" id="res-comment" name="comment" rows="3" maxlength="500" ${decision === 'reject' ? 'required' : ''} autofocus></textarea><p class="field__error" data-error-for="comment"></p></div>
      <p class="notice notice--danger" data-form-error hidden></p>
      <div class="modal__actions"><button type="button" class="btn btn--ghost btn--sm" data-modal-close>${esc(t('common.cancel'))}</button>
        <button type="submit" class="btn btn--sm ${decision === 'reject' ? 'btn--danger' : ''}">${esc(t(decision === 'approve' ? 'staff.desk.approve' : 'staff.desk.reject'))}</button></div>`;
    const modal = openModal({ title: t(decision === 'approve' ? 'staff.desk.approveTitle' : 'staff.desk.rejectTitle'), content: form });
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      clearErrors(form);
      await withLoading($('[type=submit]', form), async () => {
        try {
          await api.post(`/support/returns/${b.dataset.id}/resolve`, { decision, comment: form.elements.comment.value.trim() });
          modal.close();
          toast.success(t(decision === 'approve' ? 'staff.desk.approved' : 'staff.desk.rejected'));
          await draw();
        } catch (err) {
          showApiError(form, err);
        }
      });
    });
  });
}

// ---------------------------------------------------------------------------------------------
// Все заказы (поиск по номеру, трек-номеру, email, имени, телефону)
// ---------------------------------------------------------------------------------------------
function renderOrders(body, ctx) {
  const statuses = ['all', 'active', 'created', 'confirmed', 'assembling', 'assembled', 'handed_to_delivery', 'in_transit', 'arrived', 'delivered', 'cancelled', 'returned'];
  body.innerHTML = '<div data-table></div>';
  createTable($('[data-table]', body), {
    csv: 'amfibia-orders',
    sort: 'created',
    search: { placeholder: t('staff.desk.ordersSearchPh') },
    filters: [{ name: 'status', label: t('staff.col.status'), value: 'all', options: statuses.map((s) => ({ value: s, label: s === 'all' ? t('common.all') : s === 'active' ? t('account.filterActive') : t(`statuses.${s}`) })) }],
    load: (s) => api.get('/support/orders', s),
    onRow: (o) => ctx.navigate(`/account/desk/orders/${o.id}`),
    columns: [
      { key: 'orderNumber', label: t('staff.col.order'), sort: 'number', className: 't-mono', render: (o) => `<a href="/account/desk/orders/${o.id}" data-acc-link><b>${esc(o.orderNumber)}</b></a><span class="dt-sub">${esc(o.trackingNumber)}</span>`, csv: (o) => o.orderNumber },
      { key: 'createdAt', label: t('staff.col.date'), sort: 'created', className: 't-mono dt__hide-sm', render: (o) => esc(fmtDateTime(o.createdAt)), csv: (o) => o.createdAt },
      { key: 'customer', label: t('staff.col.buyer'), sort: 'customer', className: 'dt__wide', render: (o) => `${esc(o.customer.name)}<span class="dt-sub">${esc(o.customer.email)} · ${esc(o.customer.phone)}</span>`, csv: (o) => `${o.customer.name} <${o.customer.email}>` },
      { key: 'status', label: t('staff.col.status'), sort: 'status', render: (o) => `${statusBadge(o.status)}${o.tickets ? ` <span class="dt-tk t-mono" title="${esc(t('staff.desk.openTickets'))}">${icon('i-chat', 'icon icon--xs')}${o.tickets}</span>` : ''}`, csv: (o) => t(`statuses.${o.status}`) },
      { key: 'payment', label: t('account.payment'), className: 'dt__hide-sm', render: (o) => statusBadge(o.paymentStatus, t(`payment.${o.paymentStatus}`)), csv: (o) => t(`payment.${o.paymentStatus}`) },
      { key: 'total', label: t('staff.col.total'), sort: 'total', className: 't-mono', render: (o) => esc(formatMoney(o.totalInCurrency, o.currency)), csv: (o) => o.total },
    ],
  });
}

async function renderOrder(view, ctx, id) {
  let data = await api.get(`/support/orders/${id}`);
  function draw() {
    const { order, customer, tickets, history } = data;
    ctx.setHead({ eyebrow: t('account.from', { date: fmtDateTime(order.createdAt) }), title: t('account.order', { number: order.orderNumber }), crumbs: [{ href: '/account/desk', label: t('account.nav.desk') }, { href: '/account/desk/orders', label: t('staff.desk.tabs.orders') }, { label: order.orderNumber }] });
    const m = (byn) => esc(formatMoney(byn / order.exchangeRate, order.currency));
    view.innerHTML = `
      <a class="link-u t-mono acc-back" href="/account/desk/orders" data-acc-link>${esc(t('staff.desk.backToOrders'))}</a>
      <div class="odetail">
        <section class="odetail__main">
          <div class="odetail__status">${statusBadge(order.status)} ${statusBadge(order.paymentStatus, t(`payment.${order.paymentStatus}`))}</div>
          ${renderTimeline(order)}
          <h2 class="acc-h2">${esc(t('account.orderItems'))}</h2>
          <ul class="oitems">${order.items
            .map((i) => `<li class="oitem"><a class="oitem__img" href="/product/${i.productId}"><img src="${esc(i.image)}" alt="" loading="lazy"></a><div class="oitem__body"><a class="oitem__name" href="/product/${i.productId}">${esc(loc(i.name))}</a><p class="oitem__meta t-mono">${esc(i.sku)} · ${esc(i.size)} × ${i.quantity}</p>${i.returnStatus ? statusBadge(i.returnStatus, t(`account.returnStatus.${i.returnStatus}`)) : ''}</div><p class="oitem__price t-mono">${m(i.price * i.quantity)}</p></li>`)
            .join('')}</ul>
          <h2 class="acc-h2">${esc(t('staff.desk.historyTitle'))}</h2>
          <ol class="hist">${history.map((h) => `<li><span class="t-mono t-muted">${esc(fmtDateTime(h.at))}</span>${statusBadge(h.status)}<span>${esc(h.comment || '')}</span><span class="t-mono t-muted">${esc(h.author || t('staff.system'))}${h.role ? ` · ${esc(t(`roles.${h.role}`))}` : ''}</span></li>`).join('')}</ol>
        </section>
        <aside class="odetail__side">
          ${customer ? `<div class="cust"><p class="t-mono t-muted">${esc(t('staff.desk.customer'))}</p><p class="cust__name">${esc(customer.name)}</p>
            <p><a class="link-u" href="mailto:${esc(customer.email)}">${esc(customer.email)}</a></p><p class="t-mono">${esc(customer.phone || '')}</p>
            <p class="t-mono t-muted">${esc(t('staff.desk.customerSince', { date: fmtDate(customer.since), n: customer.orders }))}</p></div>` : ''}
          <dl class="odetail__info">
            <div><dt class="t-mono">${esc(t('account.trackingNumber'))}</dt><dd class="t-mono">${esc(order.trackingNumber)}</dd></div>
            <div><dt class="t-mono">${esc(t('account.delivery'))}</dt><dd>${esc(loc(order.delivery.name))}</dd></div>
            <div><dt class="t-mono">${esc(t('account.address'))}</dt><dd>${esc(order.address).replace(/\n/g, '<br>')}</dd></div>
            <div><dt class="t-mono">${esc(t('account.payment'))}</dt><dd>${esc(loc(order.payment.name))}</dd></div>
            ${order.courier ? `<div><dt class="t-mono">${esc(t('account.courier'))}</dt><dd>${esc(order.courier.name)}<br><span class="t-mono">${esc(order.courier.phone || '')}</span></dd></div>` : ''}
            ${order.comment ? `<div><dt class="t-mono">${esc(t('account.comment'))}</dt><dd>${esc(order.comment)}</dd></div>` : ''}
          </dl>
          <dl class="summary__rows">
            <div><dt>${esc(t('cart.subtotal'))}</dt><dd>${m(order.subtotal)}</dd></div>
            ${order.discount ? `<div><dt>${esc(t('account.promo'))} ${esc(order.promoCode || '')}</dt><dd class="summary__discount">−${m(order.discount)}</dd></div>` : ''}
            <div><dt>${esc(t('cartPage.delivery'))}</dt><dd>${order.deliveryPrice ? m(order.deliveryPrice) : esc(t('checkout.free'))}</dd></div>
            <div class="summary__total"><dt>${esc(t('cartPage.total'))}</dt><dd>${orderMoney(order)}</dd></div>
          </dl>
          ${tickets.length ? `<div class="cust"><p class="t-mono t-muted">${esc(t('staff.desk.orderTickets'))}</p>${tickets.map((tk) => `<p><a class="link-u" href="/account/desk/tickets/${tk.id}" data-acc-link>#${tk.id} ${esc(tk.subject)}</a> ${statusBadge(tk.status, t(`account.ticketStatus.${tk.status}`))}</p>`).join('')}</div>` : ''}
          <div class="odetail__actions">
            <a class="btn btn--sm btn--ghost" href="/tracking?number=${encodeURIComponent(order.trackingNumber)}">${icon('i-truck', 'icon icon--sm')} ${esc(t('account.track'))}</a>
            ${order.cancellable ? `<button type="button" class="btn btn--sm btn--danger" data-cancel>${esc(t('staff.desk.cancelOrder'))}</button>` : ''}
          </div>
          ${order.cancellable ? `<p class="t-mono t-muted acc-note">${esc(t('staff.desk.cancelNote'))}</p>` : ''}
        </aside>
      </div>`;
    ctx.reveal();
  }
  draw();
  view.addEventListener('click', (e) => {
    if (!e.target.closest('[data-cancel]')) return;
    const form = document.createElement('form');
    form.className = 'acc-form';
    form.noValidate = true;
    form.innerHTML = `
      <p class="lead">${esc(t('staff.desk.cancelText', { number: data.order.orderNumber }))}</p>
      <div class="field"><label class="field__label" for="sc-reason">${esc(t('staff.desk.cancelReason'))}</label><input class="input" id="sc-reason" name="reason" maxlength="300" required autofocus><p class="field__error" data-error-for="reason"></p></div>
      <p class="notice notice--danger" data-form-error hidden></p>
      <div class="modal__actions"><button type="button" class="btn btn--ghost btn--sm" data-modal-close>${esc(t('common.cancel'))}</button><button type="submit" class="btn btn--sm btn--danger">${esc(t('staff.desk.cancelOrder'))}</button></div>`;
    const modal = openModal({ title: t('staff.desk.cancelOrder'), content: form });
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      clearErrors(form);
      await withLoading($('[type=submit]', form), async () => {
        try {
          await api.post(`/support/orders/${id}/cancel`, { reason: form.elements.reason.value.trim() });
          modal.close();
          toast.success(t('account.cancelled'));
          data = await api.get(`/support/orders/${id}`);
          draw();
        } catch (err) {
          showApiError(form, err);
        }
      });
    });
  });
}
