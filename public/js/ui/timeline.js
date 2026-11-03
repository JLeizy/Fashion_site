// Таймлайн статусов заказа (раздел 6.12 ТЗ): пройденные шаги закрашены, текущий пульсирует, у каждого —
// дата, время и комментарий. Шаг arrived показывается только для доставки в пункт выдачи (order.flow с сервера).
// Отменённый заказ / возврат — отдельный финальный шаг. Используется в /tracking, на странице успеха и в профиле.
import { esc, icon } from '../core/dom.js';
import { t, fmtDateTime } from '../core/i18n.js';

export function renderTimeline(order, { vertical = true } = {}) {
  const byStatus = new Map();
  order.history.forEach((h) => byStatus.set(h.status, h)); // последняя запись каждого статуса
  const terminal = ['cancelled', 'returned'].includes(order.status) ? order.status : null;
  let steps = order.flow;
  if (terminal) {
    // Показываем пройденные шаги основной цепочки и финальный «отменён / возврат»
    steps = order.flow.filter((s) => byStatus.has(s)).concat(terminal);
  }
  const currentIndex = steps.indexOf(order.status);
  const items = steps
    .map((status, i) => {
      const h = byStatus.get(status);
      const state = i < currentIndex ? 'is-done' : i === currentIndex ? (terminal || status === 'delivered' ? 'is-done is-last' : 'is-current') : 'is-todo';
      const bad = status === 'cancelled' || status === 'returned';
      return `<li class="tl__step ${state} ${bad ? 'is-bad' : ''}" ${i === currentIndex ? 'aria-current="step"' : ''}>
        <span class="tl__dot" aria-hidden="true">${state.includes('is-done') ? icon(bad ? 'i-close' : 'i-check', 'icon icon--xs') : ''}</span>
        <div class="tl__body">
          <p class="tl__title">${esc(t(`statuses.${status}`))}</p>
          <p class="tl__time t-mono">${h ? esc(fmtDateTime(h.at)) : esc(t('tracking.pending'))}</p>
          ${h?.comment ? `<p class="tl__comment">${esc(h.comment)}</p>` : ''}
        </div>
      </li>`;
    })
    .join('');
  const progress = steps.length > 1 ? Math.max(0, currentIndex) / (steps.length - 1) : 1;
  return `<ol class="tl ${vertical ? 'tl--vertical' : 'tl--horizontal'}" style="--progress:${progress};--n:${steps.length}">${items}<li class="tl__rail" aria-hidden="true"><span></span></li></ol>`;
}

export default renderTimeline;
