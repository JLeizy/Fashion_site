// Общая инициализация каждой страницы: i18n, пользователь и счётчики, курсы валют, шапка, поиск,
// мини-корзина, сравнение, курсор, инерционная прокрутка, анимации, переходы и прелоадер.
// Страница вызывает initApp(), строит свой контент и затем app.reveal().
import { $ } from './core/dom.js';
import api, { setCsrf } from './core/api.js';
import { initI18n } from './core/i18n.js';
import { setRates, refreshPrices } from './core/currency.js';
import { hydrate } from './core/store.js';
import { initTransitions, revealPage } from './ui/transitions.js';
import { initSmoothScroll, initReveals, initMagnetic, initRipple, initTilt, initScrollState, refreshScroll, scrollTo } from './ui/motion.js';
import { initCursor } from './ui/cursor.js';
import { initHeader } from './ui/header.js';
import { initSearch } from './ui/search.js';
import { initMiniCart } from './ui/minicart.js';
import { initCompareBar } from './ui/compareBar.js';
import { initAuthPrompt } from './ui/authPrompt.js';
import { initFooter } from './ui/footer.js';

let me = null;

function initToTop() {
  const btn = $('[data-to-top]');
  const ring = $('[data-to-top-progress]');
  const circumference = 2 * Math.PI * 22;
  btn?.addEventListener('click', () => scrollTo(0, { offset: 0 }));
  initScrollState((progress, y) => {
    if (btn) btn.classList.toggle('is-visible', y > window.innerHeight * 0.8);
    if (ring) ring.style.strokeDashoffset = String(circumference * (1 - progress));
  });
}

// Фолбэк изображений (правка П4): реальное фото (.webp/.jpg/.png) из /images/ не загрузилось —
// подставляем SVG-заглушку с тем же именем (её генерирует scripts/generate-placeholders.js)
function initImageFallback() {
  document.addEventListener(
    'error',
    (e) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement) || img.dataset.fallback) return;
      const src = img.getAttribute('src') || '';
      if (!/^\/images\/.+\.(webp|jpe?g|png)$/i.test(src)) return;
      img.dataset.fallback = '1';
      img.removeAttribute('srcset');
      img.src = src.replace(/\.(webp|jpe?g|png)$/i, '.svg');
    },
    true
  );
}

export async function initApp() {
  initImageFallback();
  initTransitions();
  const [, session] = await Promise.all([initI18n(), api.get('/auth/me').catch((err) => (console.error(err), null))]);
  me = session;
  if (me) {
    setCsrf(me.csrfToken);
    setRates(me.rates);
  }
  hydrate(me || { user: null });

  initHeader();
  initSearch();
  initMiniCart();
  initCompareBar();
  initAuthPrompt();
  initFooter();
  initToTop();
  initCursor();
  initRipple();
  initTilt();
  initSmoothScroll();
  refreshPrices();

  return {
    me,
    user: me?.user || null,
    // Вызывается страницей, когда основной контент построен: анимации появления + открытие страницы
    async reveal() {
      try {
        await Promise.race([document.fonts?.ready || Promise.resolve(), new Promise((r) => setTimeout(r, 1500))]);
      } catch {
        /* шрифты не критичны */
      }
      initReveals();
      initMagnetic();
      refreshScroll();
      await revealPage();
      refreshScroll();
    },
  };
}

export default initApp;
