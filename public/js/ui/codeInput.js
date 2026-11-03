// Ввод 6-значного кода в 6 отдельных полей: автопереход, Backspace назад, стрелки, вставка всего кода.
export function createCodeInput(container, { length = 6, onComplete = null, label = 'Code' } = {}) {
  container.innerHTML = '';
  container.classList.remove('is-error', 'is-success');
  const inputs = Array.from({ length }, (_, i) => {
    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'numeric';
    input.autocomplete = i === 0 ? 'one-time-code' : 'off';
    input.maxLength = 1;
    input.pattern = '[0-9]*';
    input.setAttribute('aria-label', `${label} ${i + 1}/${length}`);
    container.appendChild(input);
    return input;
  });

  const value = () => inputs.map((i) => i.value).join('');
  const fill = (digits, start = 0) => {
    digits
      .replace(/\D/g, '')
      .slice(0, length - start)
      .split('')
      .forEach((d, k) => {
        inputs[start + k].value = d;
        inputs[start + k].classList.add('is-filled');
      });
    const next = inputs.find((i) => !i.value) || inputs[length - 1];
    next.focus();
    check();
  };
  const check = () => {
    container.classList.remove('is-error');
    if (value().length === length) onComplete?.(value());
  };

  inputs.forEach((input, i) => {
    input.addEventListener('input', () => {
      const digits = input.value.replace(/\D/g, '');
      if (digits.length > 1) {
        input.value = '';
        fill(digits, i);
        return;
      }
      input.value = digits;
      input.classList.toggle('is-filled', Boolean(digits));
      if (digits && i < length - 1) inputs[i + 1].focus();
      check();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && i > 0) {
        inputs[i - 1].value = '';
        inputs[i - 1].classList.remove('is-filled');
        inputs[i - 1].focus();
        e.preventDefault();
      } else if (e.key === 'ArrowLeft' && i > 0) inputs[i - 1].focus();
      else if (e.key === 'ArrowRight' && i < length - 1) inputs[i + 1].focus();
    });
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      fill((e.clipboardData || window.clipboardData).getData('text'), 0);
    });
    input.addEventListener('focus', () => input.select());
  });

  return {
    value,
    focus: () => (inputs.find((i) => !i.value) || inputs[0]).focus(),
    clear() {
      inputs.forEach((i) => {
        i.value = '';
        i.classList.remove('is-filled');
      });
      inputs[0].focus();
    },
    error() {
      container.classList.remove('is-error');
      void container.offsetWidth;
      container.classList.add('is-error');
    },
    success() {
      container.classList.add('is-success');
    },
  };
}
