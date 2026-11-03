// Анимация «полёта» товара в иконку корзины (раздел 6.8 ТЗ): копия фото летит по дуге и растворяется.
import { $, reducedMotion } from '../core/dom.js';

export function flyToCart(sourceImg) {
  const target = $('.header [data-cart-open]') || $('[data-cart-open]');
  if (!sourceImg || !target || reducedMotion()) return Promise.resolve();
  const from = sourceImg.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  if (!from.width || !to.width) return Promise.resolve();
  const clone = sourceImg.cloneNode(false);
  Object.assign(clone.style, {
    position: 'fixed',
    left: `${from.left}px`,
    top: `${from.top}px`,
    width: `${from.width}px`,
    height: `${from.height}px`,
    objectFit: 'cover',
    zIndex: 'var(--z-cursor)',
    pointerEvents: 'none',
    borderRadius: '2px',
    boxShadow: '0 20px 60px rgba(0,0,0,.5)',
  });
  document.body.appendChild(clone);
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const animation = clone.animate(
    [
      { transform: 'translate(0, 0) scale(1) rotate(0deg)', opacity: 1, offset: 0 },
      { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 120}px) scale(0.45) rotate(-8deg)`, opacity: 0.95, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.06) rotate(12deg)`, opacity: 0.2, offset: 1 },
    ],
    { duration: 950, easing: 'cubic-bezier(0.77, 0, 0.175, 1)' }
  );
  return animation.finished.then(() => {
    clone.remove();
    target.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 450, easing: 'cubic-bezier(.34,1.56,.64,1)' });
  });
}
