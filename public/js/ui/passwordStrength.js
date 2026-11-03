// Индикатор надёжности пароля: 4 деления, подпись и список требований.
import { $$ } from '../core/dom.js';
import { t } from '../core/i18n.js';

export function scorePassword(value) {
  const checks = {
    length: value.length >= 8,
    letters: /\p{L}/u.test(value),
    digits: /\d/.test(value),
    mixed: /[A-ZА-ЯЁ]/.test(value) || /[^\p{L}\d]/u.test(value),
  };
  let score = 0;
  if (value) score = 1;
  if (checks.length && checks.letters && checks.digits) score = 2;
  if (score === 2 && (value.length >= 12 || checks.mixed)) score = 3;
  if (score === 3 && value.length >= 12 && checks.mixed) score = 4;
  return { score, checks };
}

export function initPasswordStrength(input, meter, rulesList) {
  const labels = ['', 'auth.strength1', 'auth.strength2', 'auth.strength3', 'auth.strength4'];
  const update = () => {
    const { score, checks } = scorePassword(input.value);
    meter.dataset.score = String(score);
    const label = meter.querySelector('[data-strength-label]');
    if (label) label.textContent = score ? t(labels[score]) : '';
    if (rulesList) $$('[data-rule-check]', rulesList).forEach((li) => li.classList.toggle('is-ok', Boolean(checks[li.dataset.ruleCheck])));
  };
  input.addEventListener('input', update);
  update();
  return { update };
}
