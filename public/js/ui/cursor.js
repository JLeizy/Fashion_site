// Кастомный курсор: кольцо с инерцией, увеличивается над ссылками, показывает «VIEW» над карточками
// ([data-cursor-view]) и «DRAG» над каруселями ([data-cursor-drag]). На сенсорных экранах отключён.
import { $, isTouch, reducedMotion, perfLow, onPerfLow } from '../core/dom.js';

export function initCursor() {
  const ring = $('[data-cursor]');
  const dot = $('[data-cursor-dot]');
  const label = $('[data-cursor-label]');
  if (!ring || !dot || isTouch() || reducedMotion() || perfLow()) return;
  document.documentElement.classList.add('has-cursor');
  let alive = true;
  onPerfLow(() => {
    alive = false;
    document.documentElement.classList.remove('has-cursor');
    ring.classList.add('is-hidden');
    dot.classList.add('is-hidden');
  });

  let mx = window.innerWidth / 2;
  let my = window.innerHeight / 2;
  let rx = mx;
  let ry = my;
  let visible = false;

  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      mx = e.clientX;
      my = e.clientY;
      dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
      if (!visible) {
        visible = true;
        rx = mx;
        ry = my;
        ring.classList.remove('is-hidden');
        dot.classList.remove('is-hidden');
      }
    },
    { passive: true }
  );

  const loop = () => {
    if (!alive) return;
    if (document.hidden) return requestAnimationFrame(loop);
    rx += (mx - rx) * 0.17;
    ry += (my - ry) * 0.17;
    ring.style.transform = `translate3d(${rx.toFixed(2)}px, ${ry.toFixed(2)}px, 0)`;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  document.addEventListener('pointerover', (e) => {
    const view = e.target.closest('[data-cursor-view]');
    const drag = e.target.closest('[data-cursor-drag]');
    const link = e.target.closest('a, button, [role="button"], label, summary, select, input[type="checkbox"], input[type="radio"], input[type="range"]');
    ring.classList.remove('is-link', 'is-view', 'is-drag');
    if (view) {
      ring.classList.add('is-view');
      label.textContent = view.dataset.cursorView || 'VIEW';
    } else if (drag) {
      ring.classList.add('is-drag');
      label.textContent = drag.dataset.cursorDrag || 'DRAG';
    } else if (link) {
      ring.classList.add('is-link');
    }
  });
  document.documentElement.addEventListener('pointerleave', () => {
    visible = false;
    ring.classList.add('is-hidden');
    dot.classList.add('is-hidden');
  });
  window.addEventListener('pointerdown', () => ring.animate([{ scale: 1 }, { scale: 0.8 }, { scale: 1 }], { duration: 380, easing: 'cubic-bezier(.34,1.56,.64,1)' }));
}
