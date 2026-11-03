// Горизонтальная лента карточек («Похожие товары», «Новинки» и т. п.): прокрутка со scroll-snap,
// кнопки «назад / вперёд» прокручивают на ширину видимой области и выключаются у краёв.
import { $, reducedMotion } from '../core/dom.js';

export function initRail(section) {
  const track = $('[data-rail-track]', section);
  const prev = $('[data-rail-prev]', section);
  const next = $('[data-rail-next]', section);
  if (!track) return null;
  const update = () => {
    const max = track.scrollWidth - track.clientWidth - 2;
    if (prev) prev.disabled = track.scrollLeft <= 2;
    if (next) next.disabled = track.scrollLeft >= max;
    section.classList.toggle('is-scrollable', max > 0);
  };
  const step = (dir) => track.scrollBy({ left: dir * track.clientWidth * 0.85, behavior: reducedMotion() ? 'auto' : 'smooth' });
  prev?.addEventListener('click', () => step(-1));
  next?.addEventListener('click', () => step(1));
  track.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update, { passive: true });

  // Перетаскивание мышью (на тач-экранах работает нативная прокрутка)
  let drag = null;
  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    drag = { x: e.clientX, left: track.scrollLeft, moved: false };
  });
  window.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 5) {
      drag.moved = true;
      track.classList.add('is-dragging');
    }
    track.scrollLeft = drag.left - dx;
  });
  window.addEventListener('pointerup', () => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    track.classList.remove('is-dragging');
    // После перетаскивания не открываем карточку случайным кликом
    if (moved) track.addEventListener('click', (ev) => ev.preventDefault(), { capture: true, once: true });
  });
  update();
  return { update };
}

export default initRail;
