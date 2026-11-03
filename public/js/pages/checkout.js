// Оформление заказа /checkout (раздел 6.11 ТЗ): 5 шагов с индикатором — контакты, адрес, доставка, оплата,
// подтверждение. Оплата картой — имитация: маска номера, проверка алгоритмом Луна и срока действия,
// анимация «обработки». Номер карты на сервер не отправляется (только последние 4 цифры).
// API: /api/checkout/options, /api/checkout/quote, /api/addresses, POST /api/orders (транзакция — orderService.createOrder).
import { initApp } from '../app.js';
import { $, $$, esc, icon, sleep, reducedMotion } from '../core/dom.js';
import { t, loc, onLangChange, countryName, fmtDate } from '../core/i18n.js';
import api from '../core/api.js';
import { formatPrice, formatMoney, convert, getCurrency, onCurrencyChange } from '../core/currency.js';
import { cart } from '../core/store.js';
import { renderBreadcrumbs } from '../ui/breadcrumbs.js';
import { initPhoneMask, PHONE_COUNTRIES } from '../ui/phoneMask.js';
import { validateForm, validateInput, liveValidation, setFieldError, clearErrors, showApiError } from '../ui/forms.js';
import { toast } from '../ui/toast.js';
import { scrollTo } from '../ui/motion.js';

const app = await initApp();
const user = app.user;
const CIS = ['BY', 'RU', 'KZ', 'AM', 'UZ', 'KG', 'AZ', 'TJ', 'MD', 'GE'];

const state = {
  step: 1,
  reached: 1,
  contact: null,
  addresses: [],
  addressId: null, // выбранный адрес из книги; null — новый
  newAddress: null,
  saveAddress: true,
  options: { delivery: [], payment: [] },
  deliveryId: null,
  paymentId: null,
  cardLast4: null,
  quote: null,
};
const forms = Object.fromEntries($$('[data-step]').map((f) => [Number(f.dataset.step), f]));

// ---------- Телефон: подстановка номера в маску ----------
function setPhone(root, mask, phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return;
  const country = [...PHONE_COUNTRIES].sort((a, b) => b.code.length - a.code.length).find((c) => digits.startsWith(c.code));
  if (!country) return;
  $('[data-phone-country]', root).value = country.iso;
  const input = $('[data-phone-input]', root);
  input.value = digits.slice(country.code.length);
  input.dispatchEvent(new Event('input'));
}
const contactPhone = initPhoneMask($('[data-phone]', forms[1]), { defaultIso: 'BY' });
const recipientPhone = initPhoneMask($('[data-phone]', forms[2]), { defaultIso: 'BY' });
Object.values(forms).forEach(liveValidation);

// ---------- Индикатор шагов и переходы ----------
function goTo(step, { force = false, scroll = true } = {}) {
  if (!force && step > state.reached) return;
  const dir = step > state.step ? 1 : -1;
  state.step = step;
  state.reached = Math.max(state.reached, step);
  Object.entries(forms).forEach(([n, f]) => {
    const active = Number(n) === step;
    f.classList.toggle('is-active', active);
    f.style.setProperty('--dir', String(dir));
    f.toggleAttribute('inert', !active);
  });
  $$('[data-step-tab]').forEach((li) => {
    const n = Number(li.dataset.stepTab);
    li.classList.toggle('is-current', n === step);
    li.classList.toggle('is-done', n < step || (n <= state.reached && n !== step));
    $('button', li).disabled = n > state.reached;
    if (n === step) $('button', li).setAttribute('aria-current', 'step');
    else $('button', li).removeAttribute('aria-current');
  });
  $('[data-steps-line]').style.transform = `scaleX(${(step - 1) / 4})`;
  if (step === 5) renderReview();
  if (!scroll) return;
  scrollTo($('[data-steps]'), { offset: -100 });
  setTimeout(() => $('input:not([type=hidden]):not([disabled]), select, textarea', forms[step])?.focus({ preventScroll: true }), 450);
}
$('[data-steps]').addEventListener('click', (e) => {
  const b = e.target.closest('[data-goto]');
  if (b && !b.disabled) goTo(Number(b.dataset.goto));
});
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-back]')) goTo(state.step - 1);
});

// ---------- 1 · Контакты ----------
function fillContacts() {
  const f = forms[1];
  f.elements.name.value = user ? `${user.firstName} ${user.lastName}`.trim() : '';
  f.elements.email.value = user?.email || '';
  setPhone($('[data-phone]', f), contactPhone, user?.phone);
}
forms[1].addEventListener('submit', (e) => {
  e.preventDefault();
  if (!validateForm(forms[1])) return;
  state.contact = { name: forms[1].elements.name.value.trim(), email: forms[1].elements.email.value.trim(), phone: contactPhone.value() };
  // Получатель нового адреса по умолчанию — тот же человек
  const f2 = forms[2];
  if (!f2.elements.recipient.value) f2.elements.recipient.value = state.contact.name;
  if (!recipientPhone.value()) setPhone($('[data-phone]', f2), recipientPhone, state.contact.phone);
  goTo(2, { force: true });
});

// ---------- 2 · Адрес ----------
const addressLine = (a) =>
  [`${a.postalCode ? `${a.postalCode}, ` : ''}${countryName(a.country)}, ${a.city}`, `${a.street}, ${t('checkout.house_short')} ${a.house}${a.apartment ? `, ${t('checkout.apt_short')} ${a.apartment}` : ''}`].join('<br>');

function renderAddresses() {
  const list = $('[data-addr-list]');
  const cards = state.addresses.map(
    (a) => `<label class="opt addr ${state.addressId === a.id ? 'is-selected' : ''}">
      <input type="radio" name="addr" value="${a.id}" ${state.addressId === a.id ? 'checked' : ''}>
      <span class="opt__mark" aria-hidden="true"></span>
      <span class="opt__body">
        <span class="opt__title">${esc(a.recipient)} ${a.isDefault ? `<span class="opt__badge t-mono">${esc(t('checkout.default'))}</span>` : ''}</span>
        <span class="opt__text">${addressLine({ ...a, country: a.country, city: esc(a.city), street: esc(a.street), house: esc(a.house), apartment: a.apartment && esc(a.apartment), postalCode: a.postalCode && esc(a.postalCode) })}</span>
        <span class="opt__meta t-mono">${esc(a.phone)}</span>
      </span>
    </label>`
  );
  cards.push(`<label class="opt addr addr--new ${state.addressId === null ? 'is-selected' : ''}">
      <input type="radio" name="addr" value="new" ${state.addressId === null ? 'checked' : ''}>
      <span class="opt__mark" aria-hidden="true"></span>
      <span class="opt__body"><span class="opt__title">${icon('i-plus', 'icon icon--sm')} ${esc(state.addresses.length ? t('checkout.addNew') : t('checkout.newAddress'))}</span></span>
    </label>`);
  list.innerHTML = cards.join('');
  const isNew = state.addressId === null;
  const fs = $('[data-addr-new]');
  fs.hidden = !isNew;
  fs.disabled = !isNew;
}
$('[data-addr-list]').addEventListener('change', (e) => {
  if (e.target.name !== 'addr') return;
  state.addressId = e.target.value === 'new' ? null : Number(e.target.value);
  renderAddresses();
});
$('[data-countries]').innerHTML = CIS.map((c) => `<option value="${c}">${esc(countryName(c))}</option>`).join('');

forms[2].addEventListener('submit', (e) => {
  e.preventDefault();
  const f = forms[2];
  if (state.addressId === null) {
    const errors = $$('[data-addr-new] [data-rule]', f).map((input) => validateInput(input)).filter(Boolean);
    if (errors.length) {
      $('.field.is-invalid input, .field.is-invalid select', f)?.focus();
      return;
    }
    state.newAddress = {
      country: f.elements.country.value,
      city: f.elements.city.value.trim(),
      street: f.elements.street.value.trim(),
      house: f.elements.house.value.trim(),
      apartment: f.elements.apartment.value.trim(),
      postalCode: f.elements.postalCode.value.trim(),
      recipient: f.elements.recipient.value.trim(),
      phone: recipientPhone.value(),
    };
    state.saveAddress = f.elements.save.checked;
  }
  goTo(3, { force: true });
});

// ---------- 3 · Доставка ----------
const FREE_FROM = app.me?.shop?.freeDeliveryFromByn ?? 3000;
function renderDelivery() {
  const subtotal = (state.quote?.subtotal || 0) - (state.quote?.discount || 0);
  $('[data-delivery-list]').innerHTML = state.options.delivery
    .map((d) => {
      const free = d.price === 0 || subtotal >= FREE_FROM;
      const days = d.daysMin === d.daysMax ? t('checkout.daysOne', { n: d.daysMin }) : t('checkout.days', { min: d.daysMin, max: d.daysMax });
      return `<label class="opt ${state.deliveryId === d.id ? 'is-selected' : ''}">
        <input type="radio" name="delivery" value="${d.id}" ${state.deliveryId === d.id ? 'checked' : ''}>
        <span class="opt__mark" aria-hidden="true"></span>
        <span class="opt__icon">${icon(d.code === 'showroom' ? 'i-pin' : d.code === 'courier' ? 'i-truck' : 'i-box', 'icon')}</span>
        <span class="opt__body">
          <span class="opt__title">${esc(loc(d.name))}</span>
          <span class="opt__text">${esc(days)}${d.code === 'courier' ? ` · ${esc(t('checkout.courierCity'))}` : ''}</span>
          ${d.isPickup && d.code !== 'showroom' ? `<span class="opt__meta">${esc(t('checkout.pickupNote'))}</span>` : ''}
        </span>
        <span class="opt__price t-mono">${free ? esc(t('checkout.free')) : `<span data-price="${d.price}">${formatPrice(d.price)}</span>`}${!free && d.price > 0 ? `<small>${esc(t('checkout.freeFrom', { sum: formatPrice(FREE_FROM) }))}</small>` : ''}</span>
      </label>`;
    })
    .join('');
}
$('[data-delivery-list]').addEventListener('change', async (e) => {
  if (e.target.name !== 'delivery') return;
  state.deliveryId = Number(e.target.value);
  setFieldError(forms[3], 'delivery', '');
  renderDelivery();
  await refreshQuote();
});
forms[3].addEventListener('submit', (e) => {
  e.preventDefault();
  if (!state.deliveryId) {
    $('[data-error-for="delivery"]', forms[3]).textContent = t('checkout.chooseDelivery');
    return;
  }
  goTo(4, { force: true });
});

// ---------- 4 · Оплата ----------
function renderPayment() {
  $('[data-payment-list]').innerHTML = state.options.payment
    .map(
      (p) => `<label class="opt ${state.paymentId === p.id ? 'is-selected' : ''}">
        <input type="radio" name="payment" value="${p.id}" data-code="${p.code}" ${state.paymentId === p.id ? 'checked' : ''}>
        <span class="opt__mark" aria-hidden="true"></span>
        <span class="opt__icon">${icon(p.code === 'card' ? 'i-card' : p.code === 'cash' ? 'i-cash' : 'i-globe', 'icon')}</span>
        <span class="opt__body"><span class="opt__title">${esc(loc(p.name))}</span><span class="opt__text">${esc(p.isOnline ? t('checkout.payOnline') : t('checkout.payOnDelivery'))}</span></span>
      </label>`
    )
    .join('');
  const code = state.options.payment.find((p) => p.id === state.paymentId)?.code;
  $('[data-card-pay]').hidden = code !== 'card';
  $('[data-erip]').hidden = code !== 'erip';
}
$('[data-payment-list]').addEventListener('change', (e) => {
  if (e.target.name !== 'payment') return;
  state.paymentId = Number(e.target.value);
  $('[data-error-for="payment"]', forms[4]).textContent = '';
  renderPayment();
});

// Алгоритм Луна (контрольная сумма номера карты)
export function luhn(number) {
  const digits = String(number).replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}
const cardBrand = (n) => (/^4/.test(n) ? 'VISA' : /^(5[1-5]|2[2-7])/.test(n) ? 'MASTERCARD' : /^(9112|9111)/.test(n) ? 'BELCARD' : /^220[0-4]/.test(n) ? 'МИР' : 'CARD');
const cc = { number: $('#cc-number'), exp: $('#cc-exp'), cvc: $('#cc-cvc'), name: $('#cc-name') };
const pcard = $('[data-pcard]');
cc.number.addEventListener('input', () => {
  const digits = cc.number.value.replace(/\D/g, '').slice(0, 19);
  cc.number.value = digits.replace(/(.{4})/g, '$1 ').trim();
  $('[data-pcard-number]').textContent = (digits + '•'.repeat(Math.max(0, 16 - digits.length))).replace(/(.{4})/g, '$1 ').trim();
  $('[data-pcard-brand]').textContent = cardBrand(digits);
});
cc.exp.addEventListener('input', () => {
  const d = cc.exp.value.replace(/\D/g, '').slice(0, 4);
  cc.exp.value = d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  $('[data-pcard-exp]').textContent = cc.exp.value || 'MM/YY';
});
cc.cvc.addEventListener('input', () => {
  cc.cvc.value = cc.cvc.value.replace(/\D/g, '').slice(0, 4);
  $('[data-pcard-cvc]').textContent = '•'.repeat(cc.cvc.value.length || 3);
});
cc.name.addEventListener('input', () => ($('[data-pcard-holder]').textContent = cc.name.value.toUpperCase() || 'CARDHOLDER'));
cc.cvc.addEventListener('focus', () => pcard.classList.add('is-flipped'));
cc.cvc.addEventListener('blur', () => pcard.classList.remove('is-flipped'));

function validateCard() {
  const f = forms[4];
  let ok = true;
  const digits = cc.number.value.replace(/\D/g, '');
  const set = (name, bad, key) => {
    setFieldError(f, name, bad ? t(key) : '');
    if (bad) ok = false;
  };
  set('ccnumber', !luhn(digits), 'checkout.cardInvalid');
  const [mm, yy] = cc.exp.value.split('/').map(Number);
  const now = new Date();
  const expired = !mm || mm > 12 || !yy || 2000 + yy < now.getFullYear() || (2000 + yy === now.getFullYear() && mm < now.getMonth() + 1);
  set('ccexp', expired, 'checkout.expInvalid');
  set('cccvc', !/^\d{3,4}$/.test(cc.cvc.value), 'checkout.cvcInvalid');
  set('ccname', !/^[A-Za-z][A-Za-z .'-]{1,40}$/.test(cc.name.value.trim()), 'checkout.holderInvalid');
  if (ok) state.cardLast4 = digits.slice(-4);
  else $('.field.is-invalid input', f)?.focus();
  return ok;
}

forms[4].addEventListener('submit', (e) => {
  e.preventDefault();
  if (!state.paymentId) {
    $('[data-error-for="payment"]', forms[4]).textContent = t('checkout.choosePayment');
    return;
  }
  const code = state.options.payment.find((p) => p.id === state.paymentId)?.code;
  if (code === 'card' && !validateCard()) return;
  if (code !== 'card') state.cardLast4 = null;
  goTo(5, { force: true });
});

// ---------- 5 · Подтверждение ----------
function renderReview() {
  const d = state.options.delivery.find((x) => x.id === state.deliveryId);
  const p = state.options.payment.find((x) => x.id === state.paymentId);
  const addr = state.addressId ? state.addresses.find((a) => a.id === state.addressId) : state.newAddress;
  const expected = d ? new Date(Date.now() + d.daysMax * 86400000) : null;
  const rows = [
    [1, t('checkout.rContacts'), `${esc(state.contact.name)}<br>${esc(state.contact.email)} · ${esc(state.contact.phone)}`],
    [2, t('checkout.rAddress'), addr ? `${esc(addr.recipient)}, ${esc(addr.phone)}<br>${addressLine({ ...addr, city: esc(addr.city), street: esc(addr.street), house: esc(addr.house), apartment: addr.apartment && esc(addr.apartment), postalCode: addr.postalCode && esc(addr.postalCode) })}` : '—'],
    [3, t('checkout.rDelivery'), d ? `${esc(loc(d.name))}${expected ? `<br><span class="t-muted">${esc(t('checkout.expected', { date: fmtDate(expected) }))}</span>` : ''}` : '—'],
    [4, t('checkout.rPayment'), p ? `${esc(loc(p.name))}${state.cardLast4 ? ` · •••• ${state.cardLast4}` : ''}` : '—'],
    [4, t('checkout.rCurrency'), esc(getCurrency())],
  ];
  $('[data-review]').innerHTML = rows
    .map(([step, k, v]) => `<div class="review-list__row"><dt class="t-mono">${esc(k)}</dt><dd>${v}</dd><button type="button" class="link-u t-mono" data-goto-step="${step}">${esc(t('checkout.edit'))}</button></div>`)
    .join('');
}
$('[data-review]').addEventListener('click', (e) => {
  const b = e.target.closest('[data-goto-step]');
  if (b) goTo(Number(b.dataset.gotoStep));
});

// Оверлей «обработки»: последовательность сообщений, затем галочка
const processing = $('[data-processing]');
async function showProcessing(code) {
  processing.hidden = false;
  void processing.offsetWidth;
  processing.classList.add('is-open');
  const steps = code === 'card' ? ['checkout.procBank', 'checkout.procSecure', 'checkout.procOrder'] : code === 'erip' ? ['checkout.procErip', 'checkout.procOrder'] : ['checkout.procOrder'];
  for (const key of steps) {
    $('[data-processing-text]').textContent = t(key);
    await sleep(reducedMotion() ? 150 : 900);
  }
}
async function finishProcessing(code) {
  processing.classList.add('is-done');
  $('[data-processing-text]').textContent = t(code === 'cash' ? 'checkout.procPlaced' : 'checkout.procDone');
  await sleep(reducedMotion() ? 200 : 1100);
}

forms[5].addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors(forms[5]);
  if (!validateForm(forms[5])) return;
  const btn = $('[data-place]');
  btn.disabled = true;
  const code = state.options.payment.find((p) => p.id === state.paymentId)?.code;
  const payload = {
    contact: state.contact,
    addressId: state.addressId,
    address: state.addressId ? null : state.newAddress,
    saveAddress: state.saveAddress,
    deliveryMethodId: state.deliveryId,
    paymentMethodId: state.paymentId,
    currency: getCurrency(),
    comment: forms[5].elements.comment.value.trim(),
    cardLast4: state.cardLast4,
  };
  try {
    const [res] = await Promise.all([api.post('/orders', payload), showProcessing(code)]);
    await finishProcessing(code);
    cart.data = null;
    location.href = `/checkout/success/${encodeURIComponent(res.order.orderNumber)}`;
  } catch (err) {
    processing.classList.remove('is-open', 'is-done');
    processing.hidden = true;
    btn.disabled = false;
    if (err.code === 'STOCK_CHANGED') {
      toast.error(t('checkout.stockChanged'));
      setTimeout(() => (location.href = '/cart'), 1800);
      return;
    }
    // Ошибки полей адреса/контактов возвращают на нужный шаг
    const field = err.details?.[0]?.field || '';
    if (field.startsWith('contact')) goTo(1);
    else if (field.startsWith('address')) goTo(2);
    showApiError(forms[state.step], err);
    toast.error(err.message);
  }
});

// ---------- Сводка справа ----------
async function refreshQuote() {
  try {
    state.quote = await api.get('/checkout/quote', state.deliveryId ? { delivery: state.deliveryId } : {});
    renderSummary();
  } catch (err) {
    toast.error(err.message);
  }
}
function renderSummary() {
  const q = state.quote;
  if (!q) return;
  $('[data-co-items]').innerHTML = q.items
    .map(
      (i) => `<li class="co-item ${i.ok ? '' : 'is-bad'}">
        <span class="co-item__img"><img src="${esc(i.image)}" alt="" loading="lazy"><b class="t-mono">${i.quantity}</b></span>
        <span class="co-item__body"><span class="co-item__brand t-mono">${esc(i.brand)}</span><span class="co-item__name">${esc(loc(i.name))}</span><span class="co-item__size t-mono">${esc(i.size)}</span></span>
        <span class="co-item__price t-mono" data-price="${i.price * i.quantity}">${formatPrice(i.price * i.quantity)}</span>
      </li>`
    )
    .join('');
  $('[data-co-subtotal]').innerHTML = `<span data-price="${q.subtotal}">${formatPrice(q.subtotal)}</span>`;
  $('[data-co-discount-row]').hidden = !q.promo;
  if (q.promo) {
    $('[data-co-discount-label]').textContent = `${t('cartPage.discount', { percent: q.promo.percent })} · ${q.promo.code}`;
    $('[data-co-discount]').innerHTML = `−<span data-price="${q.discount}">${formatPrice(q.discount)}</span>`;
  }
  $('[data-co-delivery]').innerHTML = state.deliveryId ? (q.deliveryPrice ? `<span data-price="${q.deliveryPrice}">${formatPrice(q.deliveryPrice)}</span>` : esc(t('checkout.free'))) : `<span class="t-muted">${esc(t('checkout.deliveryOnStep'))}</span>`;
  $('[data-co-total]').innerHTML = `<span data-price="${q.total}">${formatPrice(q.total)}</span>`;
  // Итог в валюте заказа и справочно в BYN
  $('[data-co-note]').textContent = getCurrency() !== 'BYN' ? `≈ ${formatMoney(q.total, 'BYN')}` : `≈ ${formatMoney(convert(q.total, 'USD'), 'USD')}`;
}

function renderAll() {
  renderBreadcrumbs($('[data-breadcrumbs]'), [{ href: '/', label: t('nav.home') }, { href: '/cart', label: t('cart.title') }, { label: t('checkout.title') }]);
  renderAddresses();
  renderDelivery();
  renderPayment();
  renderSummary();
  if (state.step === 5) renderReview();
}

async function main() {
  try {
    const [options, addr] = await Promise.all([api.get('/checkout/options'), api.get('/addresses'), refreshQuote()]);
    state.options = options;
    state.addresses = addr.addresses;
    state.addressId = state.addresses.find((a) => a.isDefault)?.id ?? state.addresses[0]?.id ?? null;
  } catch (err) {
    toast.error(err.message);
  }
  if (!state.quote?.items.length) {
    toast.info(t('checkout.emptyCart'));
    setTimeout(() => (location.href = '/cart'), 1200);
  }
  fillContacts();
  renderAll();
  goTo(1, { force: true, scroll: false });
  await app.reveal();
  onLangChange(renderAll);
  onCurrencyChange(renderAll);
}

main();
