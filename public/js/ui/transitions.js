// Переходы между страницами (раздел 10.4 ТЗ): шторка с логотипом AMFIBIA.
// В Chrome/Edge/Safari межстраничный View Transition (@view-transition в base.css) бесшовно склеивает
// кадр «шторка закрыта» старой страницы с таким же кадром новой; в Firefox работает чистый JS-fallback.
// Прелоадер: SVG-логотип прорисовывается линией (stroke-dashoffset), затем заливается; линия загрузки.
import { $, $$, sleep, reducedMotion } from '../core/dom.js';

const html = document.documentElement;
const LEAVE_MS = 650;

export function leaveTo(href) {
  try {
    sessionStorage.setItem('amf:transition', '1');
  } catch {
    /* не критично */
  }
  html.classList.add('is-leaving');
  setTimeout(() => {
    location.href = href;
  }, LEAVE_MS);
}

export function initTransitions() {
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href]');
    if (!a || reducedMotion()) return;
    if ((a.target && a.target !== '_self') || a.hasAttribute('download') || a.hasAttribute('data-no-transition')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.search === location.search) return; // якорь или та же страница
    if (url.pathname.startsWith('/api/') || /\.(svg|png|jpe?g|webp|gif|pdf|csv|json)$/i.test(url.pathname)) return;
    e.preventDefault();
    leaveTo(url.href);
  });
  // Возврат кнопкой «назад» из bfcache — шторка не должна остаться закрытой
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) html.classList.remove('is-leaving', 'is-entering', 'is-revealing');
  });
}

async function runPreloader() {
  const pre = $('[data-preloader]');
  const bar = $('[data-preloader-bar]');
  if (!pre) return;
  const started = performance.now();
  const MIN = 2700;
  const MAX = 6000;
  const images = $$('img').filter((img) => !img.complete).slice(0, 24);
  let loaded = 0;
  const total = images.length + 1;
  images.forEach((img) => {
    const done = () => (loaded += 1);
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
  });
  (document.fonts?.ready || Promise.resolve()).then(() => (loaded += 1));

  await new Promise((resolve) => {
    const tick = () => {
      const elapsed = performance.now() - started;
      const assets = loaded / total;
      const time = Math.min(1, elapsed / MIN);
      const progress = Math.min(assets, time);
      if (bar) bar.style.transform = `scaleX(${progress})`;
      if ((progress >= 1 && elapsed >= MIN) || elapsed > MAX) {
        if (bar) bar.style.transform = 'scaleX(1)';
        resolve();
      } else setTimeout(tick, 30); // setTimeout, а не rAF: в фоновой вкладке rAF замирает
    };
    tick();
  });
  pre.classList.add('is-leaving');
  await sleep(950);
  html.classList.remove('is-preloading');
  pre.classList.remove('is-leaving');
  try {
    sessionStorage.setItem('amf:preloaded', '1');
  } catch {
    /* не критично */
  }
}

// Открытие страницы: прелоадер (первый заход) или уезжающая шторка (переход по ссылке)
export async function revealPage() {
  if (html.classList.contains('is-preloading')) await runPreloader();
  if (html.classList.contains('is-entering')) {
    html.classList.add('is-revealing');
    html.classList.remove('is-entering');
    await sleep(900);
    html.classList.remove('is-revealing');
  }
  document.dispatchEvent(new CustomEvent('amf:revealed'));
}
