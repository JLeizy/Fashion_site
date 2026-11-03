// Кабинет → Поддержка: список обращений, новое обращение (можно привязать к заказу), переписка с поддержкой
// (сообщения, фото), закрытие. API: /api/tickets (support_tickets, ticket_messages)
import { $, esc, icon } from '../core/dom.js';
import { t, fmtDateTime, fmtRelative } from '../core/i18n.js';
import api from '../core/api.js';
import { toast } from '../ui/toast.js';
import { confirmModal } from '../ui/modal.js';
import { withLoading, showApiError, clearErrors } from '../ui/forms.js';
import { statusBadge, empty, loading } from './common.js';

export async function render(view, ctx, params) {
  if (params[0]) return renderTicket(view, ctx, Number(params[0]));
  view.innerHTML = loading();
  const preOrder = Number(new URLSearchParams(location.search).get('order')) || null;
  const [{ tickets }, orders] = await Promise.all([api.get('/tickets'), api.get('/orders', { page: 1 })]);
  view.innerHTML = `
    <p class="t-muted acc-note">${esc(t('account.supportLead'))}</p>
    <div class="sup">
      <form class="acc-form sup__new" data-new-ticket novalidate>
        <h2 class="acc-h2">${esc(t('account.newTicket'))}</h2>
        <div class="field"><label class="field__label" for="tk-subject">${esc(t('account.subject'))}</label><input class="input" id="tk-subject" name="subject" maxlength="200" required><p class="field__error" data-error-for="subject"></p></div>
        <div class="field"><label class="field__label" for="tk-order">${esc(t('account.ticketOrder'))}</label>
          <select class="select" id="tk-order" name="orderId"><option value="">${esc(t('account.noOrder'))}</option>${orders.orders.map((o) => `<option value="${o.id}" ${o.id === preOrder ? 'selected' : ''}>${esc(o.orderNumber)} · ${esc(t(`statuses.${o.status}`))}</option>`).join('')}</select></div>
        <div class="field"><label class="field__label" for="tk-message">${esc(t('account.message'))}</label><textarea class="textarea" id="tk-message" name="message" rows="5" maxlength="4000" required></textarea><p class="field__error" data-error-for="message"></p></div>
        <p class="notice notice--danger" data-form-error hidden></p>
        <button type="submit" class="btn">${esc(t('account.send'))}</button>
      </form>
      <div class="sup__list">
        ${
          tickets.length
            ? `<ul class="tlist">${tickets
                .map(
                  (tk) => `<li data-reveal><a class="tkt" href="/account/support/${tk.id}" data-acc-link>
                    <span class="tkt__head"><span class="tkt__subject">${esc(tk.subject)}</span>${statusBadge(tk.status, t(`account.ticketStatus.${tk.status}`))}</span>
                    <span class="tkt__last">${esc(tk.lastMessage || '')}</span>
                    <span class="tkt__meta t-mono">#${tk.id}${tk.orderNumber ? ` · ${esc(tk.orderNumber)}` : ''} · ${esc(t('account.messages', { n: tk.messages }))} · ${esc(fmtRelative(tk.updatedAt))}</span>
                  </a></li>`
                )
                .join('')}</ul>`
            : empty({ ornament: 'orn-dagger', title: t('account.noTickets') })
        }
      </div>
    </div>`;
  const form = $('[data-new-ticket]', view);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    await withLoading($('[type=submit]', form), async () => {
      try {
        const { ticket } = await api.post('/tickets', { subject: form.elements.subject.value.trim(), message: form.elements.message.value.trim(), orderId: form.elements.orderId.value || null });
        toast.success(t('account.ticketCreated'));
        ctx.navigate(`/account/support/${ticket.id}`);
      } catch (err) {
        showApiError(form, err);
      }
    });
  });
}

async function renderTicket(view, ctx, id) {
  view.innerHTML = loading();
  let data;
  const load = async () => (data = await api.get(`/tickets/${id}`));
  await load();
  let timer = null;

  function draw() {
    const tk = data.ticket;
    ctx.setHead({ eyebrow: `#${tk.id} · ${t(`account.ticketStatus.${tk.status}`)}`, title: tk.subject, crumbs: [{ href: '/account/support', label: t('account.nav.support') }, { label: `#${tk.id}` }] });
    view.innerHTML = `
      <a class="link-u t-mono acc-back" href="/account/support" data-acc-link>${esc(t('account.backToTickets'))}</a>
      ${tk.orderNumber ? `<p class="t-mono t-muted">${esc(t('account.ticketOrder'))}: <a class="link-u" href="/account/orders/${tk.orderId}" data-acc-link>${esc(tk.orderNumber)}</a></p>` : ''}
      <ol class="chat" data-chat>${data.messages
        .map(
          (m) => `<li class="msg ${m.isStaff ? 'is-staff' : 'is-own'}">
            <p class="msg__author t-mono">${esc(m.isStaff ? `${t('account.staff')}${m.author ? ` · ${m.author}` : ''}` : t('account.you'))}</p>
            <div class="msg__bubble">${esc(m.message).replace(/\n/g, '<br>')}${m.image ? `<a href="${esc(m.image)}" target="_blank" rel="noopener"><img src="${esc(m.image)}" alt=""></a>` : ''}</div>
            <p class="msg__time t-mono">${esc(fmtDateTime(m.createdAt))}</p>
          </li>`
        )
        .join('')}</ol>
      ${
        tk.status === 'closed'
          ? `<p class="notice">${esc(t('account.ticketStatus.closed'))}</p>`
          : `<form class="chat-form" data-reply novalidate>
              <label class="sr-only" for="reply-text">${esc(t('account.reply'))}</label>
              <textarea class="textarea" id="reply-text" name="message" rows="3" maxlength="4000" placeholder="${esc(t('account.reply'))}…" required></textarea>
              <div class="chat-form__row">
                <label class="chat-form__attach link-u t-mono">${icon('i-upload', 'icon icon--xs')} <span data-file-name>${esc(t('account.attach'))}</span><input type="file" name="image" accept="image/jpeg,image/png,image/webp" hidden></label>
                <button type="button" class="link-u t-mono" data-close-ticket>${esc(t('account.closeTicket'))}</button>
                <button type="submit" class="btn btn--sm">${esc(t('account.send'))}</button>
              </div>
              <p class="notice notice--danger" data-form-error hidden></p>
            </form>`
      }`;
    const chat = $('[data-chat]', view);
    chat.scrollTop = chat.scrollHeight;
    ctx.reveal();
  }
  draw();

  view.addEventListener('change', (e) => {
    if (e.target.name === 'image') $('[data-file-name]', view).textContent = e.target.files[0]?.name || t('account.attach');
  });
  view.addEventListener('submit', async (e) => {
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
        await api.post(`/tickets/${id}/messages`, fd);
        await load();
        draw();
      } catch (err) {
        showApiError(form, err);
      }
    });
  });
  view.addEventListener('click', async (e) => {
    if (!e.target.closest('[data-close-ticket]')) return;
    if (!(await confirmModal({ title: t('account.closeTicket'), confirmLabel: t('account.closeTicket') }))) return;
    await api.post(`/tickets/${id}/close`);
    toast.success(t('account.ticketClosed'));
    await load();
    draw();
  });
  // Новые ответы поддержки подгружаются раз в 30 секунд
  timer = setInterval(async () => {
    const before = data.messages.length;
    await load().catch(() => {});
    if (data.messages.length !== before) draw();
  }, 30_000);
  return () => clearInterval(timer);
}
