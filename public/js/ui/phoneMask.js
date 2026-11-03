// Маска телефона для стран СНГ: выбор кода страны + форматирование номера при вводе.
// Итоговое значение — в международном формате +375291234567 (его проверяет и сервер).
export const PHONE_COUNTRIES = [
  { iso: 'BY', code: '375', mask: '(##) ###-##-##' },
  { iso: 'RU', code: '7', mask: '(###) ###-##-##' },
  { iso: 'KZ', code: '7', mask: '(###) ###-##-##' },
  { iso: 'AM', code: '374', mask: '(##) ###-###' },
  { iso: 'UZ', code: '998', mask: '(##) ###-##-##' },
  { iso: 'KG', code: '996', mask: '(###) ###-###' },
  { iso: 'AZ', code: '994', mask: '(##) ###-##-##' },
  { iso: 'TJ', code: '992', mask: '(##) ###-##-##' },
  { iso: 'MD', code: '373', mask: '(##) ###-###' },
  { iso: 'GE', code: '995', mask: '(###) ##-##-##' },
];

function applyMask(digits, mask) {
  let out = '';
  let k = 0;
  for (const ch of mask) {
    if (k >= digits.length) break;
    if (ch === '#') out += digits[k++];
    else out += ch;
  }
  return out;
}

export function initPhoneMask(root, { defaultIso = 'BY' } = {}) {
  const select = root.querySelector('[data-phone-country]');
  const input = root.querySelector('[data-phone-input]');
  const hidden = root.closest('form')?.querySelector('[data-phone-value]');
  select.innerHTML = PHONE_COUNTRIES.map((c) => `<option value="${c.iso}">${c.iso} +${c.code}</option>`).join('');
  select.value = defaultIso;
  const country = () => PHONE_COUNTRIES.find((c) => c.iso === select.value) || PHONE_COUNTRIES[0];
  const maxDigits = () => (country().mask.match(/#/g) || []).length;

  const update = () => {
    let digits = input.value.replace(/\D/g, '');
    // Если вставили номер вместе с кодом страны — отрезаем код
    const c = country();
    if (digits.length > maxDigits() && digits.startsWith(c.code)) digits = digits.slice(c.code.length);
    digits = digits.slice(0, maxDigits());
    input.value = applyMask(digits, c.mask);
    input.placeholder = c.mask.replace(/#/g, '0');
    if (hidden) hidden.value = digits.length === maxDigits() ? `+${c.code}${digits}` : digits ? `+${c.code}${digits}` : '';
    hidden?.dispatchEvent(new Event('input'));
  };
  input.addEventListener('input', update);
  select.addEventListener('change', () => {
    update();
    input.focus();
  });
  update();
  return {
    value: () => hidden?.value || '',
    isComplete: () => input.value.replace(/\D/g, '').length === maxDigits(),
  };
}
