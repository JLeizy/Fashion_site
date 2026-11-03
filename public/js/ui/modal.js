// Модальные окна: анимация с easing-кривой, фокус-ловушка, закрытие по Esc и клику по фону,
// остановка инерционной прокрутки на время показа.
import { $, icon, trapFocus } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { stopScroll, startScroll } from './motion.js';

const stack = [];

export function openModal({ title = '', content = '', size = '', className = '', onClose = null, labelledBy = null } = {}) {
  const root = $('#modal-root') || document.body;
  const lastFocus = document.activeElement;
  const wrapper = document.createElement('div');
  const titleId = `modal-title-${Date.now()}`;
  wrapper.className = `modal ${size ? `modal--${size}` : ''} ${className}`;
  wrapper.setAttribute('role', 'dialog');
  wrapper.setAttribute('aria-modal', 'true');
  wrapper.setAttribute('aria-labelledby', labelledBy || titleId);
  wrapper.innerHTML = `
    <div class="modal__backdrop" data-modal-close></div>
    <div class="modal__dialog" data-lenis-prevent>
      <svg class="modal__corner modal__corner--tl" aria-hidden="true"><use href="#orn-corner"/></svg>
      <svg class="modal__corner modal__corner--br" aria-hidden="true"><use href="#orn-corner"/></svg>
      <button type="button" class="icon-btn modal__close" data-modal-close aria-label="${t('common.close')}">${icon('i-close')}</button>
      ${title ? `<h2 class="modal__title" id="${titleId}"></h2>` : ''}
      <div class="modal__content"></div>
    </div>`;
  if (title) wrapper.querySelector('.modal__title').textContent = title;
  const contentEl = wrapper.querySelector('.modal__content');
  if (typeof content === 'string') contentEl.innerHTML = content;
  else if (content instanceof Node) contentEl.appendChild(content);
  root.appendChild(wrapper);

  const releaseTrap = trapFocus(wrapper);
  stopScroll();
  void wrapper.offsetWidth; // фиксируем начальное состояние, чтобы сработал CSS-переход
  wrapper.classList.add('is-open');

  let closed = false;
  const controller = {
    el: wrapper,
    content: contentEl,
    close() {
      if (closed) return;
      closed = true;
      wrapper.classList.remove('is-open');
      releaseTrap();
      document.removeEventListener('keydown', onKey);
      const index = stack.indexOf(controller);
      if (index >= 0) stack.splice(index, 1);
      if (!stack.length) startScroll();
      setTimeout(() => wrapper.remove(), 650);
      lastFocus?.focus?.();
      onClose?.();
    },
  };
  function onKey(e) {
    if (e.key === 'Escape' && stack[stack.length - 1] === controller) controller.close();
  }
  document.addEventListener('keydown', onKey);
  wrapper.addEventListener('click', (e) => {
    if (e.target.closest('[data-modal-close]')) controller.close();
  });
  stack.push(controller);
  setTimeout(() => (wrapper.querySelector('[autofocus]') || wrapper.querySelector('.modal__close'))?.focus(), 80);
  return controller;
}

// Модалка подтверждения (удаление, блокировка и т.д.) → Promise<boolean>
export function confirmModal({ title, text = '', confirmLabel, cancelLabel, danger = false } = {}) {
  return new Promise((resolve) => {
    const body = document.createElement('div');
    body.innerHTML = `
      <p class="lead"></p>
      <div class="modal__actions">
        <button type="button" class="btn btn--ghost btn--sm" data-cancel></button>
        <button type="button" class="btn btn--sm ${danger ? 'btn--danger' : ''}" data-confirm autofocus></button>
      </div>`;
    body.querySelector('.lead').textContent = text;
    body.querySelector('[data-cancel]').textContent = cancelLabel || t('common.cancel');
    body.querySelector('[data-confirm]').textContent = confirmLabel || t('common.confirm');
    let answered = false;
    const modal = openModal({
      title,
      content: body,
      onClose: () => {
        if (!answered) resolve(false);
      },
    });
    body.querySelector('[data-cancel]').addEventListener('click', () => modal.close());
    body.querySelector('[data-confirm]').addEventListener('click', () => {
      answered = true;
      resolve(true);
      modal.close();
    });
  });
}

export const closeAllModals = () => [...stack].forEach((m) => m.close());
