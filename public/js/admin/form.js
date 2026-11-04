// Конструктор форм админ-панели в модальном окне: поля по описанию, загрузка изображений (POST /api/admin/upload),
// ошибки сервера под полями (422 → details), блокировка кнопки на время запроса.
// openForm({ title, fields: [{ name, label, type, options, required, wide, rows, hint, min, max, step }], values, submitLabel, onSubmit })
// Типы: text, email, password, textarea, number, select, checkbox, color, date, datetime, image.
import { $, esc, icon } from '../core/dom.js';
import { t } from '../core/i18n.js';
import api from '../core/api.js';
import { openModal } from '../ui/modal.js';
import { withLoading, showApiError, clearErrors } from '../ui/forms.js';
import { pickImages } from '../account/staff.js';

const toDateInput = (v, withTime = false) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return withTime ? `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}` : date;
};

function fieldHtml(f, value) {
  const id = `af-${f.name}`;
  const req = f.required ? 'required' : '';
  const attrs = `id="${id}" name="${esc(f.name)}" ${req} ${f.max !== undefined ? `max="${f.max}"` : ''} ${f.min !== undefined ? `min="${f.min}"` : ''} ${f.maxlength ? `maxlength="${f.maxlength}"` : ''} ${f.lang ? `lang="${f.lang}"` : ''}`;
  let control = '';
  switch (f.type) {
    case 'textarea':
      control = `<textarea class="textarea ${f.mono ? 't-mono' : ''}" ${attrs} rows="${f.rows || 4}">${esc(value ?? '')}</textarea>`;
      break;
    case 'select':
      control = `<select class="select" ${attrs}>${(f.options || []).map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(value ?? '') ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
      break;
    case 'checkbox':
      return `<div class="field ${f.wide ? 'field--wide' : ''}"><label class="switch"><input type="checkbox" ${attrs} ${value ? 'checked' : ''}><span class="switch__track"></span><span>${esc(f.label)}</span></label>${f.hint ? `<p class="field__hint">${esc(f.hint)}</p>` : ''}<p class="field__error" data-error-for="${esc(f.name)}"></p></div>`;
    case 'color':
      control = `<div class="af-color"><input type="color" value="${esc(value || '#5A0F1C')}" data-color-for="${esc(f.name)}" aria-label="${esc(f.label)}"><input class="input t-mono" ${attrs} value="${esc(value || '#5A0F1C')}" pattern="#[0-9A-Fa-f]{6}"></div>`;
      break;
    case 'image':
      control = `<div class="af-image"><span class="af-image__preview" data-preview-for="${esc(f.name)}">${value ? `<img src="${esc(value)}" alt="">` : icon('i-upload')}</span>
        <input class="input t-mono" ${attrs} value="${esc(value ?? '')}" placeholder="/images/… или /uploads/…">
        <button type="button" class="btn btn--ghost btn--xs" data-upload-for="${esc(f.name)}">${icon('i-upload', 'icon icon--xs')} ${esc(t('admin.upload'))}</button></div>`;
      break;
    case 'date':
      control = `<input class="input t-mono" type="date" ${attrs} value="${esc(toDateInput(value))}">`;
      break;
    case 'datetime':
      control = `<input class="input t-mono" type="datetime-local" ${attrs} value="${esc(toDateInput(value, true))}">`;
      break;
    case 'number':
      control = `<input class="input t-mono" type="number" step="${f.step || 1}" ${attrs} value="${esc(value ?? '')}">`;
      break;
    default:
      control = `<input class="input" type="${f.type || 'text'}" ${attrs} value="${esc(value ?? '')}" ${f.type === 'password' ? 'autocomplete="new-password"' : ''}>`;
  }
  return `<div class="field ${f.wide ? 'field--wide' : ''}"><label class="field__label" for="${id}">${esc(f.label)}${f.required ? ' *' : ''}</label>${control}${f.hint ? `<p class="field__hint">${esc(f.hint)}</p>` : ''}<p class="field__error" data-error-for="${esc(f.name)}"></p></div>`;
}

// Значения формы с приведением типов: checkbox → boolean, number → число или null, пустая строка → null (для select/date)
export function readForm(form, fields) {
  const data = {};
  fields.forEach((f) => {
    const el = form.elements[f.name];
    if (!el) return;
    if (f.type === 'checkbox') data[f.name] = el.checked;
    else if (f.type === 'number') data[f.name] = el.value === '' ? null : Number(el.value);
    else if (f.type === 'datetime' || f.type === 'date') data[f.name] = el.value ? new Date(el.value).toISOString() : null;
    else data[f.name] = el.value.trim() === '' && (f.type === 'select' || f.nullable) ? null : el.value.trim();
  });
  return data;
}

export function openForm({ title, fields, values = {}, submitLabel = t('common.save'), onSubmit, size = 'wide', intro = '' }) {
  const form = document.createElement('form');
  form.className = 'acc-form af';
  form.noValidate = true;
  form.innerHTML = `
    ${intro ? `<p class="t-muted acc-note">${esc(intro)}</p>` : ''}
    <div class="form-grid form-grid--2">${fields.map((f) => fieldHtml(f, values[f.name])).join('')}</div>
    <p class="notice notice--danger" data-form-error hidden></p>
    <div class="modal__actions"><button type="button" class="btn btn--ghost btn--sm" data-modal-close>${esc(t('common.cancel'))}</button>
      <button type="submit" class="btn btn--sm">${esc(submitLabel)}</button></div>`;
  const modal = openModal({ title, content: form, size });

  form.addEventListener('input', (e) => {
    const picker = e.target.closest('[data-color-for]');
    if (picker) form.elements[picker.dataset.colorFor].value = picker.value.toUpperCase();
    const f = fields.find((x) => x.name === e.target.name);
    if (f?.type === 'color' && /^#[0-9A-Fa-f]{6}$/.test(e.target.value)) $(`[data-color-for="${f.name}"]`, form).value = e.target.value;
    if (f?.type === 'image') $(`[data-preview-for="${f.name}"]`, form).innerHTML = e.target.value ? `<img src="${esc(e.target.value)}" alt="">` : icon('i-upload');
  });
  form.addEventListener('click', async (e) => {
    const up = e.target.closest('[data-upload-for]');
    if (!up) return;
    const [file] = await pickImages({ multiple: false });
    if (!file) return;
    const fd = new FormData();
    fd.append('image', file);
    await withLoading(up, async () => {
      try {
        const { url } = await api.post('/admin/upload', fd);
        const input = form.elements[up.dataset.uploadFor];
        input.value = url;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      } catch (err) {
        showApiError(form, err);
      }
    });
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    await withLoading($('[type=submit]', form), async () => {
      try {
        await onSubmit(readForm(form, fields));
        modal.close();
      } catch (err) {
        showApiError(form, err);
        if (err.status === 422 && !err.details?.some((d) => form.elements[d.field])) {
          const g = $('[data-form-error]', form);
          g.textContent = err.details?.map((d) => `${d.field}: ${d.message}`).join(' · ') || err.message;
          g.hidden = false;
        }
      }
    });
  });
  return modal;
}

export default openForm;
