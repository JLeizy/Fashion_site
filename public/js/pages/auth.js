// Страница /auth: вход, регистрация, подтверждение email, 2FA, восстановление пароля (раздел 6.2 ТЗ).
import { initApp } from '../app.js';
import api, { setCsrf } from '../core/api.js';
import { $, $$, params, sleep } from '../core/dom.js';
import { t, getLang, setLang, onLangChange } from '../core/i18n.js';
import { setTheme } from '../core/theme.js';
import { setCurrency } from '../core/currency.js';
import { mergeGuestData } from '../core/store.js';
import { validateForm, liveValidation, clearErrors, showApiError, formData, withLoading, initPasswordToggles, setFieldError } from '../ui/forms.js';
import { createCodeInput } from '../ui/codeInput.js';
import { initPhoneMask } from '../ui/phoneMask.js';
import { initPasswordStrength } from '../ui/passwordStrength.js';
import { initGothicCanvas } from '../ui/gothicCanvas.js';
import { leaveTo } from '../ui/transitions.js';
import { toast } from '../ui/toast.js';

const app = await initApp();

const nextParam = params().get('next');
const next = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/account';
const state = { email: '', remember: true, codeMode: 'verify', resetEmail: '' };

initGothicCanvas($('[data-gothic-canvas]'));
initPasswordToggles();

// ---------- Переключение видов (главный / код / забыли / сброс) ----------
function showView(name) {
  $$('[data-view]').forEach((view) => {
    const on = view.dataset.view === name;
    if (on && view.hidden) {
      view.hidden = false;
      view.classList.remove('is-entering');
      void view.offsetWidth;
      view.classList.add('is-entering');
      setTimeout(() => view.querySelector('input:not([type="hidden"]):not([type="checkbox"])')?.focus(), 350);
    } else if (!on) view.hidden = true;
  });
  if (name === 'main') syncHeight();
}

// ---------- Вкладки «Вход / Регистрация»: карточка переворачивается ----------
const flip = $('[data-flip]');
const inner = $('[data-flip-inner]');
const tabsEl = $('.auth__tabs');
const faceLogin = $('[data-face="login"]');
const faceRegister = $('[data-face="register"]');

function syncHeight() {
  const face = flip.classList.contains('is-flipped') ? faceRegister : faceLogin;
  inner.style.height = `${face.offsetHeight}px`;
}
new ResizeObserver(syncHeight).observe(faceLogin);
new ResizeObserver(syncHeight).observe(faceRegister);

function setTab(name) {
  const register = name === 'register';
  flip.classList.toggle('is-flipped', register);
  tabsEl.classList.toggle('is-register', register);
  $$('[data-auth-tab][role="tab"]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.authTab === name)));
  faceLogin.setAttribute('aria-hidden', String(register));
  faceRegister.setAttribute('aria-hidden', String(!register));
  syncHeight();
  const url = new URL(location.href);
  if (register) url.searchParams.set('tab', 'register');
  else url.searchParams.delete('tab');
  history.replaceState(null, '', url);
  setTimeout(() => (register ? faceRegister : faceLogin).querySelector('input')?.focus({ preventScroll: true }), 650);
}

document.addEventListener('click', (e) => {
  const tab = e.target.closest('[data-auth-tab]');
  if (tab) setTab(tab.dataset.authTab);
  const go = e.target.closest('[data-go]');
  if (go) showView(go.dataset.go);
  const demo = e.target.closest('[data-demo-login]');
  if (demo) {
    showView('main');
    setTab('login');
    loginForm.elements.email.value = demo.dataset.demoLogin;
    loginForm.elements.password.value = 'Amfibia2026';
    clearErrors(loginForm);
    loginForm.querySelector('[type="submit"]').focus();
  }
});

// ---------- После успешного входа ----------
async function onLoggedIn(res) {
  setCsrf(res.csrfToken);
  try {
    await mergeGuestData();
  } catch (err) {
    console.error(err);
  }
  // Настройки интерфейса из профиля (раздел 11–13: выбор хранится и в профиле)
  const u = res.user;
  if (u.lang && u.lang !== getLang()) await setLang(u.lang);
  if (u.theme) setTheme(u.theme);
  if (u.currency) setCurrency(u.currency);
  toast.success(t('auth.welcome', { name: u.firstName }));
  await sleep(450);
  leaveTo(next);
}

// ---------- Вход ----------
const loginForm = $('[data-form="login"]');
liveValidation(loginForm);
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors(loginForm);
  if (!validateForm(loginForm)) return;
  const data = formData(loginForm);
  await withLoading(loginForm.querySelector('[type="submit"]'), async () => {
    try {
      const res = await api.post('/auth/login', { email: data.email, password: data.password, remember: data.remember });
      state.email = data.email.trim().toLowerCase();
      state.remember = data.remember;
      if (res.needVerification) return openCode('verify', res);
      if (res.twoFactorRequired) return openCode('2fa', res);
      await onLoggedIn(res);
    } catch (err) {
      showApiError(loginForm, err);
      syncHeight();
    }
  });
});

// ---------- Регистрация ----------
const registerForm = $('[data-form="register"]');
const phone = initPhoneMask($('[data-phone]', registerForm));
initPasswordStrength($('[data-strength-source]', registerForm), $('[data-strength]', registerForm), $('[data-strength-rules]', registerForm));
liveValidation(registerForm);
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors(registerForm);
  let ok = validateForm(registerForm);
  if (!phone.isComplete()) {
    setFieldError(registerForm, 'phone', t('validation.phone'));
    ok = false;
  }
  syncHeight();
  if (!ok) return;
  const data = formData(registerForm);
  data.phone = phone.value();
  await withLoading(registerForm.querySelector('[type="submit"]'), async () => {
    try {
      const res = await api.post('/auth/register', data);
      state.email = data.email.trim().toLowerCase();
      state.remember = true;
      openCode('verify', res);
    } catch (err) {
      showApiError(registerForm, err);
      syncHeight();
    }
  });
});

// ---------- Ввод кода (подтверждение email и 2FA) ----------
const codeForm = $('[data-form="code"]');
let codeInput = null;
let resendTimer = null;

function startResendTimer(button, timerEl, seconds) {
  clearInterval(resendTimer);
  let left = seconds;
  button.disabled = true;
  const tick = () => {
    timerEl.textContent = left > 0 ? `· ${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}` : '';
    if (left <= 0) {
      clearInterval(resendTimer);
      button.disabled = false;
    }
    left -= 1;
  };
  tick();
  resendTimer = setInterval(tick, 1000);
}

function openCode(mode, res) {
  state.codeMode = mode;
  $('[data-code-title]').textContent = t(mode === 'verify' ? 'auth.verifyTitle' : 'auth.twoFactorTitle');
  $('[data-code-sub]').textContent = t(mode === 'verify' ? 'auth.verifySub' : 'auth.twoFactorSub', { email: res.email || state.email });
  clearErrors(codeForm);
  codeInput = createCodeInput($('[data-code-inputs]'), { label: t('auth.codeDigit'), onComplete: (code) => submitCode(code) });
  showView('code');
  startResendTimer($('[data-resend]'), $('[data-resend-timer]'), res.resendIn || 60);
  setTimeout(() => codeInput.focus(), 400);
}

let codeBusy = false;
async function submitCode(code) {
  if (codeBusy) return;
  codeBusy = true;
  clearErrors(codeForm);
  try {
    const res =
      state.codeMode === 'verify'
        ? await api.post('/auth/verify-email', { email: state.email, code, remember: state.remember })
        : await api.post('/auth/login/2fa', { code });
    codeInput.success();
    await onLoggedIn(res);
  } catch (err) {
    codeInput.error();
    showApiError(codeForm, err);
  } finally {
    codeBusy = false;
  }
}
codeForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const code = codeInput?.value() || '';
  if (code.length !== 6) {
    codeInput?.error();
    return;
  }
  submitCode(code);
});
$('[data-resend]').addEventListener('click', async () => {
  try {
    const res = await api.post('/auth/resend-code', { email: state.email, type: state.codeMode });
    toast.info(res.message);
    startResendTimer($('[data-resend]'), $('[data-resend-timer]'), res.resendIn || 60);
    codeInput.clear();
  } catch (err) {
    showApiError(codeForm, err);
  }
});

// ---------- Восстановление пароля ----------
const forgotForm = $('[data-form="forgot"]');
liveValidation(forgotForm);
const resetForm = $('[data-form="reset"]');
liveValidation(resetForm);
let resetCode = null;
let resetTimer = null;

function startResetTimer(seconds) {
  clearInterval(resetTimer);
  const button = $('[data-resend-reset]');
  const timerEl = $('[data-resend-reset-timer]');
  let left = seconds;
  button.disabled = true;
  const tick = () => {
    timerEl.textContent = left > 0 ? `· 00:${String(left).padStart(2, '0')}` : '';
    if (left <= 0) {
      clearInterval(resetTimer);
      button.disabled = false;
    }
    left -= 1;
  };
  tick();
  resetTimer = setInterval(tick, 1000);
}

forgotForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors(forgotForm);
  if (!validateForm(forgotForm)) return;
  const email = forgotForm.elements.email.value.trim().toLowerCase();
  await withLoading(forgotForm.querySelector('[type="submit"]'), async () => {
    try {
      const res = await api.post('/auth/forgot', { email });
      state.resetEmail = email;
      $('[data-reset-sub]').textContent = t('auth.resetSub', { email });
      resetCode = createCodeInput($('[data-reset-code]'), { label: t('auth.codeDigit'), onComplete: () => resetForm.elements.password.focus() });
      clearErrors(resetForm);
      showView('reset');
      startResetTimer(res.resendIn || 60);
      setTimeout(() => resetCode.focus(), 400);
    } catch (err) {
      showApiError(forgotForm, err);
    }
  });
});

$('[data-resend-reset]').addEventListener('click', async () => {
  try {
    const res = await api.post('/auth/resend-code', { email: state.resetEmail, type: 'reset' });
    toast.info(res.message);
    startResetTimer(res.resendIn || 60);
  } catch (err) {
    showApiError(resetForm, err);
  }
});

resetForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors(resetForm);
  const code = resetCode?.value() || '';
  let ok = validateForm(resetForm);
  if (code.length !== 6) {
    resetCode?.error();
    ok = false;
  }
  if (!ok) return;
  const data = formData(resetForm);
  await withLoading(resetForm.querySelector('[type="submit"]'), async () => {
    try {
      const res = await api.post('/auth/reset', { email: state.resetEmail, code, password: data.password, passwordConfirm: data.passwordConfirm });
      toast.success(res.message);
      showView('main');
      setTab('login');
      loginForm.elements.email.value = state.resetEmail;
      loginForm.elements.password.value = '';
      loginForm.elements.password.focus();
    } catch (err) {
      if (err.code === 'CODE_INVALID' || err.code === 'CODE_EXPIRED') resetCode?.error();
      showApiError(resetForm, err);
    }
  });
});

// ---------- Начальное состояние из URL ----------
const initialTab = params().get('tab');
if (initialTab === 'register') setTab('register');
if (params().get('step') === 'forgot') showView('forgot');
syncHeight();
onLangChange(syncHeight);
await app.reveal();
syncHeight();
