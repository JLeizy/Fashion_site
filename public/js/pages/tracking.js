// Публичное отслеживание /tracking (раздел 6.12 ТЗ): ввод трек-номера (проверка формата и контрольной цифры
// на сервере), таймлайн статусов, состав, куда, способ доставки, ожидаемая дата. Автообновление раз в 30 секунд.
// Номер хранится в URL (?number=…) — ссылкой можно поделиться. Данные: GET /api/tracking/:number.
import { initApp } from '../app.js';
import { $, esc } from '../core/dom.js';
import { t, loc, onLangChange, fmtDate, fmtDateTime } from '../core/i18n.js';
import api from '../core/api.js';
import { renderBreadcrumbs } from '../ui/breadcrumbs.js';
import { renderTimeline } from '../ui/timeline.js';
import { refreshScroll } from '../ui/motion.js';

const app = await initApp();
const form = $('[data-trk-form]');
const input = $('#trk-number');
const errorEl = $('[data-trk-error]');
const result = $('[data-trk-result]');
const FORMAT = /^AF\d{9}BY$/;
let order = null;
let loadedAt = null;
let timer = null;

function render() {
  renderBreadcrumbs($('[data-breadcrumbs]'), [{ href: '/', label: t('nav.home') }, { label: t('tracking.title') }]);
  if (!order) {
    result.innerHTML = '';
    return;
  }
  const final = ['delivered', 'cancelled', 'returned'].includes(order.status);
  result.innerHTML = `
    <article class="trk-card">
      <header class="trk-card__head">
        <div>
          <p class="t-eyebrow">${esc(t('tracking.order', { number: order.orderNumber }))}</p>
          <h2 class="trk-card__status">${esc(t(`statuses.${order.status}`))}</h2>
        </div>
        <p class="trk-card__num t-mono">${esc(order.trackingNumber)}</p>
      </header>
      ${renderTimeline(order)}
      <dl class="trk-card__facts">
        ${order.expectedDeliveryDate && !final ? `<div><dt class="t-mono">${esc(t('tracking.expected'))}</dt><dd>${esc(fmtDate(order.expectedDeliveryDate))}</dd></div>` : ''}
        <div><dt class="t-mono">${esc(t('tracking.destination'))}</dt><dd>${esc(order.destination).replace(/\n/g, '<br>')}</dd></div>
        <div><dt class="t-mono">${esc(t('tracking.delivery'))}</dt><dd>${esc(loc(order.delivery.name))}</dd></div>
      </dl>
      <div class="trk-card__items">
        <p class="t-eyebrow">${esc(t('tracking.items'))}</p>
        <ul>${order.items
          .map((i) => `<li><a href="/product/${i.productId}"><img src="${esc(i.image)}" alt="" loading="lazy"></a><span>${esc(loc(i.name))}<br><span class="t-mono t-muted">${esc(i.size)} × ${i.quantity}</span></span></li>`)
          .join('')}</ul>
      </div>
      <p class="trk-card__refresh t-mono">${final ? '' : `<span class="trk-card__live" aria-hidden="true"></span>${esc(t('tracking.autoRefresh'))} · `}${esc(t('tracking.updated', { time: fmtDateTime(loadedAt) }))}</p>
    </article>`;
  refreshScroll();
}

async function load(number, { silent = false } = {}) {
  errorEl.hidden = true;
  if (!FORMAT.test(number)) {
    errorEl.textContent = t('tracking.invalid');
    errorEl.hidden = false;
    return;
  }
  if (!silent) result.classList.add('is-loading');
  try {
    ({ order } = await api.get(`/tracking/${number}`));
    loadedAt = new Date();
    render();
    // Автообновление статуса раз в 30 секунд (пока заказ не в финальном статусе)
    clearInterval(timer);
    if (!['delivered', 'cancelled', 'returned'].includes(order.status)) timer = setInterval(() => load(number, { silent: true }), 30_000);
  } catch (err) {
    if (!silent) {
      order = null;
      render();
      errorEl.textContent = err.status === 404 ? t('tracking.notFound') : err.message;
      errorEl.hidden = false;
    }
  } finally {
    result.classList.remove('is-loading');
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const number = input.value.trim().toUpperCase();
  input.value = number;
  history.replaceState(null, '', `/tracking?number=${encodeURIComponent(number)}`);
  load(number);
});
input.addEventListener('input', () => {
  input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
});

const initial = new URLSearchParams(location.search).get('number');
render();
if (initial) {
  input.value = initial.toUpperCase();
  await load(input.value);
}
await app.reveal();
onLangChange(render);
