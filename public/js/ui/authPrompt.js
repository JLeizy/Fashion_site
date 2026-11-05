// Модальное окно входа для гостя (избранное, оформление заказа, отзыв — раздел 4 ТЗ).
// Вход прямо в модалке; если нужен код подтверждения email или 2FA — он вводится здесь же.
import { esc } from '../core/dom.js';
import { t, getLang, setLang } from '../core/i18n.js';
import api, { setCsrf } from '../core/api.js';
import { store, mergeGuestData } from '../core/store.js';
import { setTheme } from '../core/theme.js';
import { setCurrency } from '../core/currency.js';
import { openModal } from './modal.js';
import { validateForm, liveValidation, clearErrors, showApiError, formData, withLoading, initPasswordToggles } from './forms.js';
import { createCodeInput } from './codeInput.js';
import { toast } from './toast.js';

let togglesBound = false;

export function showAuthPrompt({ reason = 'default', next = location.pathname + location.search } = {}) {
  const nextParam = encodeURIComponent(next);
  const reasonText = t(`authPrompt.${reason}`) !== `authPrompt.${reason}` ? t(`authPrompt.${reason}`) : t('authPrompt.default');
  const body = document.createElement('div');
  body.className = 'auth-prompt';
  body.innerHTML = `
    <svg class="auth-prompt__orn icon--fill" aria-hidden="true"><use href="#orn-fleur"/></svg>
    <p class="lead">${esc(reasonText)}</p>
    <form class="auth-prompt__form" novalidate data-prompt-login>
      <div class="field">
        <label class="field__label" for="prompt-email">${esc(t('auth.email'))}</label>
        <input class="input" id="prompt-email" name="email" type="email" autocomplete="username" data-rule="email" autofocus>
        <p class="field__error" data-error-for="email"></p>
      </div>
      <div class="field">
        <label class="field__label" for="prompt-password">${esc(t('auth.password'))}</label>
        <input class="input" id="prompt-password" name="password" type="password" autocomplete="current-password" data-rule="required">
        <button class="icon-btn field__addon" type="button" data-toggle-password aria-label="${esc(t('auth.showPassword'))}"><svg class="icon icon--sm"><use href="#i-eye"/></svg></button>
        <p class="field__error" data-error-for="password"></p>
      </div>
      <label class="check"><input type="checkbox" name="remember" checked><span class="check__box"></span><span>${esc(t('auth.remember'))}</span></label>
      <p class="notice notice--danger" data-form-error hidden></p>
      <button class="btn btn--block" type="submit"><span class="btn__label">${esc(t('auth.loginBtn'))}</span></button>
    </form>
    <form class="auth-prompt__form" novalidate data-prompt-code hidden>
      <p class="t-muted" data-prompt-code-sub></p>
      <div class="code" data-prompt-code-inputs></div>
      <p class="notice notice--danger" data-form-error hidden></p>
      <p class="t-muted auth-prompt__hint dev-only">${esc(t('auth.codeHint'))}</p>
    </form>
    <p class="auth-prompt__links">
      <a class="link-u" href="/auth?tab=register&next=${nextParam}">${esc(t('auth.createAccount'))}</a>
      <a class="link-u" href="/auth?step=forgot&next=${nextParam}">${esc(t('auth.forgot'))}</a>
    </p>`;

  const modal = openModal({ title: t('authPrompt.title'), content: body });
  if (!togglesBound) {
    initPasswordToggles(document);
    togglesBound = true;
  }
  const loginForm = body.querySelector('[data-prompt-login]');
  const codeForm = body.querySelector('[data-prompt-code]');
  liveValidation(loginForm);
  let pending = null;

  const finish = async (res) => {
    setCsrf(res.csrfToken);
    try {
      await mergeGuestData();
    } catch (err) {
      console.error(err);
    }
    const u = res.user;
    if (u.lang && u.lang !== getLang()) await setLang(u.lang);
    if (u.theme) setTheme(u.theme);
    if (u.currency) setCurrency(u.currency);
    toast.success(t('auth.welcome', { name: u.firstName }));
    modal.close();
    // Перезагружаем страницу, чтобы все блоки (избранное, корзина, роль) отрисовались для пользователя
    setTimeout(() => location.reload(), 500);
  };

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(loginForm);
    if (!validateForm(loginForm)) return;
    const data = formData(loginForm);
    await withLoading(loginForm.querySelector('[type="submit"]'), async () => {
      try {
        const res = await api.post('/auth/login', { email: data.email, password: data.password, remember: data.remember });
        if (res.needVerification || res.twoFactorRequired) {
          pending = { mode: res.needVerification ? 'verify' : '2fa', email: res.email, remember: data.remember };
          loginForm.hidden = true;
          codeForm.hidden = false;
          codeForm.querySelector('[data-prompt-code-sub]').textContent = t(pending.mode === 'verify' ? 'auth.verifySub' : 'auth.twoFactorSub', { email: res.email });
          const input = createCodeInput(codeForm.querySelector('[data-prompt-code-inputs]'), {
            label: t('auth.codeDigit'),
            onComplete: async (code) => {
              clearErrors(codeForm);
              try {
                const done =
                  pending.mode === 'verify'
                    ? await api.post('/auth/verify-email', { email: pending.email, code, remember: pending.remember })
                    : await api.post('/auth/login/2fa', { code });
                input.success();
                await finish(done);
              } catch (err) {
                input.error();
                showApiError(codeForm, err);
              }
            },
          });
          setTimeout(() => input.focus(), 100);
          return;
        }
        await finish(res);
      } catch (err) {
        showApiError(loginForm, err);
      }
    });
  });
  return modal;
}

export function initAuthPrompt() {
  store.on('auth:required', (detail) => showAuthPrompt(detail || {}));
}
