// Кабинет → Настройки: личные данные (users UPDATE), аватар, смена пароля, 2FA, язык / тема / валюта
// (сохраняются в localStorage и в профиле: PATCH /api/profile/preferences).
// API: PATCH /api/account/profile, DELETE /api/account/avatar, POST /api/auth/change-password, POST /api/auth/two-factor
import { $, esc } from '../core/dom.js';
import { t, getLang, setLang } from '../core/i18n.js';
import api from '../core/api.js';
import { getTheme, setTheme, THEMES } from '../core/theme.js';
import { getCurrency, setCurrency, CURRENCIES } from '../core/currency.js';
import { toast } from '../ui/toast.js';
import { initPhoneMask, PHONE_COUNTRIES } from '../ui/phoneMask.js';
import { initPasswordStrength } from '../ui/passwordStrength.js';
import { validateForm, liveValidation, showApiError, clearErrors, withLoading, initPasswordToggles } from '../ui/forms.js';

export async function render(view, ctx) {
  const u = ctx.user;
  view.innerHTML = `
    <div class="settings">
      <form class="acc-form set-card" data-profile-form novalidate>
        <h2 class="acc-h2">${esc(t('account.settingsPersonal'))}</h2>
        <div class="form-grid form-grid--2">
          <div class="field"><label class="field__label" for="st-first">${esc(t('account.firstName'))}</label><input class="input" id="st-first" name="firstName" value="${esc(u.firstName)}" data-rule="name" autocomplete="given-name"><p class="field__error" data-error-for="firstName"></p></div>
          <div class="field"><label class="field__label" for="st-last">${esc(t('account.lastName'))}</label><input class="input" id="st-last" name="lastName" value="${esc(u.lastName)}" data-rule="name" autocomplete="family-name"><p class="field__error" data-error-for="lastName"></p></div>
          <div class="field"><label class="field__label" for="st-email">${esc(t('auth.email'))}</label><input class="input" id="st-email" value="${esc(u.email)}" disabled><p class="field__hint">${esc(t('account.emailNote'))}</p></div>
          <div class="field"><label class="field__label" for="st-phone">${esc(t('auth.phone'))}</label>
            <div class="phone" data-phone><select class="select phone__country" data-phone-country aria-label="${esc(t('auth.country'))}"></select><input class="input phone__input" id="st-phone" type="tel" inputmode="tel" data-phone-input></div>
            <input type="hidden" name="phone" data-phone-value data-rule="phone"><p class="field__error" data-error-for="phone"></p></div>
        </div>
        <div class="set-card__foot">${u.avatar ? `<button type="button" class="link-u t-mono" data-remove-avatar>${esc(t('account.removeAvatar'))}</button>` : '<span></span>'}<button type="submit" class="btn btn--sm">${esc(t('common.save'))}</button></div>
      </form>

      <form class="acc-form set-card" data-password-form novalidate>
        <h2 class="acc-h2">${esc(t('account.settingsPassword'))}</h2>
        <div class="field"><label class="field__label" for="st-cur">${esc(t('account.currentPassword'))}</label>
          <input class="input" id="st-cur" name="currentPassword" type="password" autocomplete="current-password" data-rule="required">
          <button class="icon-btn field__addon" type="button" data-toggle-password aria-label="${esc(t('auth.showPassword'))}"><svg class="icon icon--sm"><use href="#i-eye"/></svg></button>
          <p class="field__error" data-error-for="currentPassword"></p></div>
        <div class="field"><label class="field__label" for="st-new">${esc(t('account.newPassword'))}</label>
          <input class="input" id="st-new" name="newPassword" type="password" autocomplete="new-password" data-rule="password">
          <button class="icon-btn field__addon field__addon--top" type="button" data-toggle-password aria-label="${esc(t('auth.showPassword'))}"><svg class="icon icon--sm"><use href="#i-eye"/></svg></button>
          <div class="strength" data-pw-meter aria-live="polite"><div class="strength__bars"><i></i><i></i><i></i><i></i></div><span class="strength__label t-mono" data-strength-label></span></div>
          <p class="field__error" data-error-for="newPassword"></p></div>
        <p class="notice notice--danger" data-form-error hidden></p>
        <div class="set-card__foot"><span></span><button type="submit" class="btn btn--sm">${esc(t('account.changePassword'))}</button></div>
      </form>

      <section class="set-card">
        <h2 class="acc-h2">${esc(t('account.settingsSecurity'))}</h2>
        <label class="switch set-switch"><input type="checkbox" data-2fa ${u.twoFactorEnabled ? 'checked' : ''}><span class="switch__track"></span><span><b>${esc(t('account.twoFactor'))}</b><br><span class="t-muted">${esc(t('account.twoFactorText'))}</span></span></label>
      </section>

      <section class="set-card">
        <h2 class="acc-h2">${esc(t('account.settingsInterface'))}</h2>
        <div class="set-prefs">
          <div><p class="field__label">${esc(t('account.language'))}</p><div class="seg" data-pref="lang">${['ru', 'en'].map((l) => `<button type="button" data-value="${l}" aria-pressed="${getLang() === l}">${l.toUpperCase()}</button>`).join('')}</div></div>
          <div><p class="field__label">${esc(t('account.theme'))}</p><div class="seg" data-pref="theme">${THEMES.map((th) => `<button type="button" data-value="${th}" aria-pressed="${getTheme() === th}"><span class="swatch swatch--${th}"></span>${esc(t(`header.themes.${th}`))}</button>`).join('')}</div></div>
          <div><p class="field__label">${esc(t('account.currency'))}</p><div class="seg" data-pref="currency">${CURRENCIES.map((c) => `<button type="button" data-value="${c}" aria-pressed="${getCurrency() === c}">${c}</button>`).join('')}</div></div>
        </div>
      </section>
    </div>`;

  // Личные данные
  const pf = $('[data-profile-form]', view);
  const phone = initPhoneMask($('[data-phone]', pf), { defaultIso: 'BY' });
  const digits = String(u.phone || '').replace(/\D/g, '');
  const country = [...PHONE_COUNTRIES].sort((a, b) => b.code.length - a.code.length).find((c) => digits.startsWith(c.code));
  if (country) {
    $('[data-phone-country]', pf).value = country.iso;
    $('[data-phone-input]', pf).value = digits.slice(country.code.length);
    $('[data-phone-input]', pf).dispatchEvent(new Event('input'));
  }
  liveValidation(pf);
  pf.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(pf);
    if (!validateForm(pf)) return;
    await withLoading($('[type=submit]', pf), async () => {
      try {
        const res = await api.patch('/account/profile', { firstName: pf.elements.firstName.value.trim(), lastName: pf.elements.lastName.value.trim(), phone: phone.value() });
        ctx.setUser(res.user);
        toast.success(t('account.saved'));
      } catch (err) {
        showApiError(pf, err);
      }
    });
  });
  $('[data-remove-avatar]', view)?.addEventListener('click', async () => {
    await api.del('/account/avatar');
    ctx.setUser({ avatar: null });
    toast.success(t('account.avatarRemoved'));
    render(view, ctx);
  });

  // Пароль
  const pw = $('[data-password-form]', view);
  initPasswordToggles(pw);
  initPasswordStrength(pw.elements.newPassword, $('[data-pw-meter]', pw), null);
  liveValidation(pw);
  pw.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(pw);
    if (!validateForm(pw)) return;
    await withLoading($('[type=submit]', pw), async () => {
      try {
        await api.post('/auth/change-password', { currentPassword: pw.elements.currentPassword.value, newPassword: pw.elements.newPassword.value, newPasswordConfirm: pw.elements.newPassword.value });
        pw.reset();
        toast.success(t('account.passwordChanged'));
      } catch (err) {
        showApiError(pw, err);
      }
    });
  });

  // 2FA
  $('[data-2fa]', view).addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    try {
      await api.post('/auth/two-factor', { enabled });
      ctx.setUser({ twoFactorEnabled: enabled });
      toast.success(t(enabled ? 'account.twoFactorOn' : 'account.twoFactorOff'));
    } catch (err) {
      e.target.checked = !enabled;
      toast.error(err.message);
    }
  });

  // Интерфейс: применяется сразу и сохраняется в профиле
  view.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-pref] [data-value]');
    if (!b) return;
    const kind = b.closest('[data-pref]').dataset.pref;
    const value = b.dataset.value;
    if (kind === 'lang') await setLang(value);
    if (kind === 'theme') setTheme(value, { x: e.clientX, y: e.clientY });
    if (kind === 'currency') setCurrency(value);
    b.parentElement.querySelectorAll('[data-value]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    try {
      await api.patch('/profile/preferences', { [kind]: value });
      toast.success(t('account.prefsSaved'));
    } catch (err) {
      toast.error(err.message);
    }
  });
}
