// Формы: клиентская валидация с подсказками под полями (правила совпадают с серверными),
// показ ошибок сервера по полям, блокировка кнопки на время запроса.
import { $, $$ } from '../core/dom.js';
import { t } from '../core/i18n.js';

const RULES = {
  required: (v) => (String(v).trim() ? null : 'validation.required'),
  email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim()) ? null : 'validation.email'),
  name: (v) => (/^[\p{L}][\p{L}\s'’.-]{0,59}$/u.test(String(v).trim()) ? null : 'validation.name'),
  password: (v) => (String(v).length >= 8 && /\p{L}/u.test(v) && /\d/.test(v) ? null : 'validation.password'),
  phone: (v) => (/^\+\d{10,15}$/.test(String(v)) ? null : 'validation.phone'),
  code: (v) => (/^\d{6}$/.test(String(v)) ? null : 'validation.code'),
  terms: (_, input) => (input.checked ? null : 'validation.terms'),
};

// Текст ошибки на текущем языке (ключи validation.* лежат в словаре клиента)
const message = (key) => (t(key) !== key ? t(key) : key);

export function setFieldError(form, name, text) {
  const error = $(`[data-error-for="${name}"]`, form);
  const input = form.elements[name];
  const field = (input?.closest?.('.field')) || error?.closest('.field');
  if (error) error.textContent = text || '';
  field?.classList.toggle('is-invalid', Boolean(text));
  if (input && input.setAttribute) input.setAttribute('aria-invalid', text ? 'true' : 'false');
}

export function clearErrors(form) {
  $$('[data-error-for]', form).forEach((el) => {
    el.textContent = '';
  });
  $$('.field.is-invalid', form).forEach((el) => el.classList.remove('is-invalid'));
  const general = $('[data-form-error]', form);
  if (general) {
    general.hidden = true;
    general.textContent = '';
  }
}

export function validateInput(input) {
  const rule = input.dataset.rule;
  if (!rule) return null;
  let key = null;
  if (rule.startsWith('match:')) {
    const other = input.form.elements[rule.slice(6)];
    key = input.value === other?.value && input.value ? null : 'validation.passwordMatch';
  } else {
    key = RULES[rule]?.(input.type === 'checkbox' ? input.checked : input.value, input) ?? null;
  }
  setFieldError(input.form, input.name, key ? message(key) : '');
  return key;
}

export function validateForm(form) {
  const errors = $$('[data-rule]', form)
    .map((input) => validateInput(input))
    .filter(Boolean);
  if (errors.length) $('.field.is-invalid input, .field.is-invalid select', form)?.focus();
  return errors.length === 0;
}

// Живая проверка: после первого ухода с поля — при каждом вводе
export function liveValidation(form) {
  $$('[data-rule]', form).forEach((input) => {
    input.addEventListener('blur', () => {
      if (input.value || input.type === 'checkbox') {
        input.dataset.touched = '1';
        validateInput(input);
      }
    });
    input.addEventListener('input', () => {
      if (input.dataset.touched) validateInput(input);
    });
    input.addEventListener('change', () => {
      if (input.type === 'checkbox') validateInput(input);
    });
  });
}

// Ошибка сервера: поля из details подсвечиваются, общий текст — в блоке [data-form-error]
export function showApiError(form, err) {
  const details = Array.isArray(err?.details) ? err.details : [];
  details.forEach((d) => setFieldError(form, d.field, d.message));
  const general = $('[data-form-error]', form);
  if (general && (!details.length || err.status !== 422)) {
    general.textContent = err.message;
    general.hidden = false;
  }
}

export function formData(form) {
  const data = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    data[el.name] = el.type === 'checkbox' ? el.checked : el.value;
  }
  return data;
}

// Кнопка отправки на время запроса
export async function withLoading(button, fn) {
  button?.classList.add('is-loading');
  if (button) button.disabled = true;
  try {
    return await fn();
  } finally {
    button?.classList.remove('is-loading');
    if (button) button.disabled = false;
  }
}

// Кнопки «показать пароль»
export function initPasswordToggles(root = document) {
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-toggle-password]');
    if (!btn) return;
    const input = btn.closest('.field')?.querySelector('input[type="password"], input[data-was-password]');
    if (!input) return;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    input.toggleAttribute('data-was-password', show);
    btn.setAttribute('aria-pressed', String(show));
  });
}
