// Страница успеха /checkout/success/:number (раздел 6.11 ТЗ): номер заказа, трек-номер (копирование),
// итог в валюте заказа (курс зафиксирован в orders.exchange_rate), кнопка «Отследить» и текущий таймлайн.
// Данные: GET /api/orders/:id (только свой заказ).
import { initApp } from '../app.js';
import { $, esc } from '../core/dom.js';
import { t, onLangChange } from '../core/i18n.js';
import api from '../core/api.js';
import { formatMoney } from '../core/currency.js';
import { renderTimeline } from '../ui/timeline.js';
import { toast } from '../ui/toast.js';

const app = await initApp();
const id = Number(document.body.dataset.orderId);
let order = null;

function render() {
  if (!order) return;
  $('[data-success-text]').textContent = t('success.text', { email: order.contact.email });
  $('[data-success-number]').textContent = order.orderNumber;
  $('[data-success-track]').textContent = order.trackingNumber;
  $('[data-success-total-label]').textContent = t(order.paymentStatus === 'paid' ? 'success.paid' : 'success.toPay');
  // Сумма — в валюте, в которой оформлен заказ, по курсу на момент оформления
  $('[data-success-total]').innerHTML = esc(formatMoney(order.totalInCurrency, order.currency)) + (order.currency !== 'BYN' ? ` <span class="t-muted">(${esc(formatMoney(order.total, 'BYN'))})</span>` : '');
  $('[data-success-trackbtn]').href = `/tracking?number=${encodeURIComponent(order.trackingNumber)}`;
  $('[data-success-timeline]').innerHTML = renderTimeline(order, { vertical: false });
}

$('[data-copy]').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(order.trackingNumber);
    toast.success(t('success.copied'), order.trackingNumber);
  } catch {
    toast.info(order.trackingNumber);
  }
});

try {
  ({ order } = await api.get(`/orders/${id}`));
} catch (err) {
  toast.error(err.message);
}
render();
await app.reveal();
onLangChange(render);
