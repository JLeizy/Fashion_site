// Мелкие помощники для работы с DOM и данными.

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

// Экранирование пользовательского текста перед вставкой в HTML (защита от XSS)
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

// Тег-шаблон html`...` — экранирует все подставленные значения, кроме помеченных raw()
const RAW = Symbol('raw');
export const raw = (value) => ({ [RAW]: true, value: String(value ?? '') });
export function html(strings, ...values) {
  return strings.reduce((out, str, i) => {
    if (i >= values.length) return out + str;
    const v = values[i];
    if (Array.isArray(v)) return out + str + v.map((x) => (x && x[RAW] ? x.value : esc(x))).join('');
    if (v && v[RAW]) return out + str + v.value;
    if (v === false || v === null || v === undefined) return out + str;
    return out + str + esc(v);
  }, '');
}

export function debounce(fn, wait = 300) {
  let timer;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

export function throttle(fn, wait = 100) {
  let last = 0;
  let timer;
  return (...args) => {
    const now = Date.now();
    const rest = wait - (now - last);
    if (rest <= 0) {
      last = now;
      fn(...args);
    } else {
      clearTimeout(timer);
      timer = setTimeout(() => {
        last = Date.now();
        fn(...args);
      }, rest);
    }
  };
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Показать скрытый элемент и запустить CSS-переход: reflow фиксирует начальное состояние,
// поэтому переход стартует и без requestAnimationFrame (который замирает в фоновой вкладке)
export function showAnimated(el, cls = 'is-open') {
  if (!el) return;
  el.hidden = false;
  void el.offsetWidth;
  el.classList.add(cls);
}

// Скрыть после окончания перехода (если за это время элемент снова не открыли)
export function hideAnimated(el, delay = 700, cls = 'is-open') {
  if (!el) return;
  el.classList.remove(cls);
  setTimeout(() => {
    if (!el.classList.contains(cls)) el.hidden = true;
  }, delay);
}
export const reducedMotion = () => document.documentElement.classList.contains('reduced-motion');
export const isTouch = () => window.matchMedia('(hover: none), (pointer: coarse)').matches;

export function storage(key, value) {
  try {
    if (value === undefined) return JSON.parse(localStorage.getItem(key) ?? 'null');
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return null;
  }
  return value;
}

export function setCookie(name, value, days = 365) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${days * 86400}; samesite=lax`;
}

// Иконка из SVG-спрайта
export const icon = (id, cls = 'icon') => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;

// Подсветка совпадений в тексте поиска (значения экранируются)
export function highlight(text, query) {
  const safe = esc(text);
  const words = String(query || '')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0)
    .map((w) => esc(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!words.length) return safe;
  return safe.replace(new RegExp(`(${words.join('|')})`, 'gi'), '<mark>$1</mark>');
}

// Фокус-ловушка для модалок и панелей
export function trapFocus(container) {
  const selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  function onKey(e) {
    if (e.key !== 'Tab') return;
    const items = $$(selector, container).filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  container.addEventListener('keydown', onKey);
  return () => container.removeEventListener('keydown', onKey);
}

// Разбор/сборка параметров URL
export const params = () => new URLSearchParams(location.search);

export function initials(first = '', last = '') {
  return `${(first[0] || '').toUpperCase()}${(last[0] || '').toUpperCase()}` || 'A';
}
