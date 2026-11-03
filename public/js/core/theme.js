// Темы (раздел 11 ТЗ): атрибут data-theme на <html>, CSS-переменные в tokens.css.
// Переключение — круговое раскрытие от кнопки через View Transitions API (fallback — плавная смена цветов).
import { setCookie, reducedMotion } from './dom.js';

export const THEMES = ['amfibia', 'light', 'dark'];
const META_COLOR = { amfibia: '#0B0B0C', light: '#F7F5F2', dark: '#151517' };

export const getTheme = () => (THEMES.includes(document.documentElement.dataset.theme) ? document.documentElement.dataset.theme : 'amfibia');

function applyTheme(theme) {
  const html = document.documentElement;
  html.dataset.theme = theme;
  try {
    localStorage.setItem('amf:theme', theme);
  } catch {
    /* не критично */
  }
  setCookie('amf_theme', theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLOR[theme]);
  document.dispatchEvent(new CustomEvent('amf:themechange', { detail: { theme } }));
}

// origin — точка, откуда «раскрывается» новая тема (центр нажатой кнопки)
export function setTheme(theme, origin = null) {
  if (!THEMES.includes(theme) || theme === getTheme()) return;
  const html = document.documentElement;
  // В скрытой вкладке View Transition ждёт отрисовки, которой нет, — тогда меняем тему сразу
  if (document.startViewTransition && !reducedMotion() && document.visibilityState === 'visible') {
    const x = origin?.x ?? window.innerWidth / 2;
    const y = origin?.y ?? 0;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    html.classList.add('vt-theme');
    const transition = document.startViewTransition(() => applyTheme(theme));
    transition.ready
      .then(() => {
        html.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 820, easing: 'cubic-bezier(0.77, 0, 0.175, 1)', pseudoElement: '::view-transition-new(root)' }
        );
      })
      .catch(() => {});
    transition.finished.finally(() => html.classList.remove('vt-theme'));
  } else {
    html.classList.add('theme-animating');
    applyTheme(theme);
    setTimeout(() => html.classList.remove('theme-animating'), 650);
  }
}

export const onThemeChange = (fn) => document.addEventListener('amf:themechange', fn);
