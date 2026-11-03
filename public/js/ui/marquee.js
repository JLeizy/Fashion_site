// Бегущая строка (раздел 6.3 ТЗ): бесконечная лента названий брендов. Базовая скорость задаётся CSS-анимацией,
// а при прокрутке страницы лента ускоряется и слегка наклоняется пропорционально скорости (только transform).
import { $$, reducedMotion } from '../core/dom.js';

export function initMarquee(root) {
  if (!root || reducedMotion() || !window.gsap) return;
  const tracks = $$('[data-marquee-track]', root);
  let velocity = 0;
  let lastY = window.scrollY;
  let lastT = performance.now();
  window.gsap.ticker.add(() => {
    const now = performance.now();
    const dy = window.scrollY - lastY;
    const dt = Math.max(16, now - lastT);
    lastY = window.scrollY;
    lastT = now;
    velocity += ((dy / dt) * 16 - velocity) * 0.12;
    const speed = 1 + Math.min(4, Math.abs(velocity) * 0.25);
    const skew = Math.max(-8, Math.min(8, velocity * 0.6));
    tracks.forEach((track) => {
      track.getAnimations().forEach((a) => {
        a.playbackRate = speed;
      });
      track.style.setProperty('--skew', `${skew.toFixed(2)}deg`);
    });
  });
}

export default initMarquee;
