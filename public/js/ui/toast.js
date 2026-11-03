// Тосты (всплывающие уведомления) в стиле сайта: орнамент-иконка, линия таймера, действие («Отменить»).
import { $, esc, icon } from '../core/dom.js';

const ICONS = { success: 'i-check', error: 'i-warning', info: 'orn-cross' };

export function toast({ type = 'info', title = '', text = '', action = null, duration = 4200 } = {}) {
  const root = $('[data-toasts]');
  if (!root) return null;
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  const iconClass = ICONS[type] === 'orn-cross' ? 'toast__icon icon--fill' : 'toast__icon icon';
  el.innerHTML = `
    <svg class="${iconClass}" aria-hidden="true"><use href="#${ICONS[type] || 'orn-cross'}"/></svg>
    <div>
      ${title ? `<p class="toast__title">${esc(title)}</p>` : ''}
      ${text ? `<p class="toast__text">${esc(text)}</p>` : ''}
      ${action ? `<button type="button" class="toast__action" data-toast-action>${esc(action.label)}</button>` : ''}
    </div>
    <button type="button" class="icon-btn" data-toast-close aria-label="×">${icon('i-close', 'icon icon--sm')}</button>
    <span class="toast__progress" style="animation-duration:${duration}ms"></span>`;
  root.appendChild(el);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    el.classList.add('is-leaving');
    el.addEventListener('animationend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 600);
  };
  let timer = setTimeout(close, duration);
  el.addEventListener('mouseenter', () => {
    clearTimeout(timer);
    el.querySelector('.toast__progress').style.animationPlayState = 'paused';
  });
  el.addEventListener('mouseleave', () => {
    timer = setTimeout(close, 1800);
    el.querySelector('.toast__progress').style.animationPlayState = 'running';
  });
  el.querySelector('[data-toast-close]').addEventListener('click', close);
  el.querySelector('[data-toast-action]')?.addEventListener('click', () => {
    action.onClick?.();
    close();
  });
  return { close };
}

toast.success = (title, text, opts) => toast({ type: 'success', title, text, ...opts });
toast.error = (title, text, opts) => toast({ type: 'error', title, text, duration: 6000, ...opts });
toast.info = (title, text, opts) => toast({ type: 'info', title, text, ...opts });

// Ошибка API → тост с переведённым сервером текстом
export function toastError(err, fallbackTitle = '') {
  toast.error(fallbackTitle || err?.message || 'Error', fallbackTitle ? err?.message : '');
}

export default toast;
