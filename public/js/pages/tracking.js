// Публичное отслеживание /tracking (раздел 6.12 ТЗ): ввод трек-номера (проверка формата и контрольной цифры
// на сервере), таймлайн статусов, состав, куда, способ доставки, ожидаемая дата. Автообновление раз в 30 секунд.
// Номер хранится в URL (?number=…) — ссылкой можно поделиться. Данные: GET /api/tracking/:number.
import { initApp } from '../app.js';
import { $, esc, icon } from '../core/dom.js';
import { t, tRaw, loc, onLangChange, fmtDate, fmtDateTime } from '../core/i18n.js';
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

const guide = $('[data-trk-guide]');
const DAY = 86_400_000;
const FLOW = ['created', 'confirmed', 'assembling', 'assembled', 'handed_to_delivery', 'in_transit', 'arrived', 'delivered'];

// Пример таймлайна (не реальный заказ — подпись «Пример»), расшифровка статусов и частые вопросы
function renderGuide() {
  const base = Date.now() - 3 * DAY;
  const sample = {
    status: 'in_transit',
    flow: FLOW,
    history: FLOW.slice(0, 6).map((status, i) => ({ status, at: new Date(base + i * 9 * 3_600_000).toISOString() })),
  };
  const faq = tRaw('tracking.faq') || [];
  guide.innerHTML = `
    <section class="trk-guide__example">
      <p class="t-eyebrow">${esc(t('tracking.exampleEyebrow'))}</p>
      <h2 class="trk-guide__h">${esc(t('tracking.exampleTitle'))}</h2>
      <p class="t-muted">${esc(t('tracking.exampleText'))}</p>
      <div class="trk-guide__tl" aria-hidden="true">${renderTimeline(sample)}</div>
    </section>
    <section class="trk-guide__statuses">
      <p class="t-eyebrow">${esc(t('tracking.guideEyebrow'))}</p>
      <h2 class="trk-guide__h">${esc(t('tracking.guideTitle'))}</h2>
      <dl class="trk-guide__list">${[...FLOW, 'cancelled', 'returned']
        .map((s, i) => `<div><dt><span class="t-mono">${String(i + 1).padStart(2, '0')}</span>${esc(t(`statuses.${s}`))}</dt><dd>${esc(t(`tracking.statusHelp.${s}`))}</dd></div>`)
        .join('')}</dl>
    </section>
    <section class="trk-guide__faq">
      <p class="t-eyebrow">${esc(t('tracking.faqEyebrow'))}</p>
      <h2 class="trk-guide__h">${esc(t('tracking.faqTitle'))}</h2>
      ${faq.map((f) => `<details class="trk-faq"><summary>${esc(f.q)}${icon('i-plus', 'icon icon--sm')}</summary><p>${esc(f.a)}</p></details>`).join('')}
    </section>`;
}

function render() {
  renderBreadcrumbs($('[data-breadcrumbs]'), [{ href: '/', label: t('nav.home') }, { label: t('tracking.title') }]);
  renderGuide();
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
