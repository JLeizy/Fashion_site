// След из изображений за курсором (раздел 10.4 ТЗ, главная): при движении мыши по области каждые ~90 px
// появляется фото товара, которое увеличивается, а затем «проваливается» и гаснет. Пул из 14 элементов
// переиспользуется (без постоянного создания узлов), анимируются только transform и opacity.
// На сенсорных экранах и при prefers-reduced-motion отключён.
import { isTouch, reducedMotion, perfLow, onPerfLow } from '../core/dom.js';

export function initImageTrail(area, images, { step = 90, pool = 14 } = {}) {
  if (!area || !images.length || isTouch() || reducedMotion() || perfLow()) return null;
  const layer = document.createElement('div');
  layer.className = 'trail';
  layer.setAttribute('aria-hidden', 'true');
  const nodes = Array.from({ length: pool }, () => {
    const img = document.createElement('img');
    img.className = 'trail__img';
    img.alt = '';
    img.decoding = 'async';
    layer.appendChild(img);
    return img;
  });
  area.appendChild(layer);
  // Переход в perf-low во время работы страницы — убираем след
  onPerfLow(() => layer.remove());
  // Предзагрузка, чтобы первое появление не мигало
  images.slice(0, 24).forEach((src) => {
    const preload = new Image();
    preload.src = src;
  });

  let last = null;
  let n = 0;
  let z = 1;
  area.addEventListener('pointermove', (e) => {
    const r = area.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (last && Math.hypot(x - last.x, y - last.y) < step) return;
    const dx = last ? x - last.x : 0;
    const dy = last ? y - last.y : 0;
    last = { x, y };
    const img = nodes[n % pool];
    img.src = images[n % images.length];
    n += 1;
    z += 1;
    img.style.zIndex = String(z);
    img.getAnimations().forEach((a) => a.cancel());
    const rot = (Math.random() - 0.5) * 14;
    img.animate(
      [
        { transform: `translate(${x - dx * 0.4}px, ${y - dy * 0.4}px) translate(-50%, -50%) scale(0.4) rotate(${rot}deg)`, opacity: 0 },
        { transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(1) rotate(${rot / 2}deg)`, opacity: 1, offset: 0.18 },
        { transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(1) rotate(${rot / 2}deg)`, opacity: 1, offset: 0.62 },
        { transform: `translate(${x}px, ${y + 70}px) translate(-50%, -50%) scale(0.72) rotate(${rot}deg)`, opacity: 0 },
      ],
      { duration: 1500, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' }
    );
  });
  area.addEventListener('pointerleave', () => {
    last = null;
  });
  return { layer };
}

export default initImageTrail;
