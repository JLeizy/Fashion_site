// Кабинет → Адресная книга (CRUD): карточки адресов, добавление и изменение в модалке, адрес по умолчанию, удаление.
// API: GET/POST /api/addresses, PUT /api/addresses/:id, PATCH /api/addresses/:id/default, DELETE /api/addresses/:id
import { $, esc, icon } from '../core/dom.js';
import { t, countryName } from '../core/i18n.js';
import api from '../core/api.js';
import { openModal, confirmModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { initPhoneMask, PHONE_COUNTRIES } from '../ui/phoneMask.js';
import { validateForm, liveValidation, showApiError, clearErrors, withLoading } from '../ui/forms.js';
import { empty, loading } from './common.js';

const CIS = ['BY', 'RU', 'KZ', 'AM', 'UZ', 'KG', 'AZ', 'TJ', 'MD', 'GE'];

export async function render(view, ctx) {
  let addresses = [];
  async function load() {
    ({ addresses } = await api.get('/addresses'));
    draw();
  }
  function draw() {
    view.innerHTML = `
      <div class="acc-toolbar"><p class="t-muted">${esc(t('account.addressesLead'))}</p><button type="button" class="btn btn--sm" data-add>${icon('i-plus', 'icon icon--sm')} ${esc(t('account.addAddress'))}</button></div>
      ${
        addresses.length
          ? `<ul class="alist">${addresses
              .map(
                (a) => `<li class="acard ${a.isDefault ? 'is-default' : ''}" data-reveal>
                  <p class="acard__name">${esc(a.recipient)} ${a.isDefault ? `<span class="opt__badge t-mono">${esc(t('checkout.default'))}</span>` : ''}</p>
                  <p class="acard__text">${a.postalCode ? `${esc(a.postalCode)}, ` : ''}${esc(countryName(a.country))}, ${esc(a.city)}<br>${esc(a.street)}, ${esc(t('checkout.house_short'))} ${esc(a.house)}${a.apartment ? `, ${esc(t('checkout.apt_short'))} ${esc(a.apartment)}` : ''}</p>
                  <p class="acard__phone t-mono">${esc(a.phone)}</p>
                  <div class="acard__actions">
                    <button type="button" class="link-u t-mono" data-edit="${a.id}">${esc(t('common.edit'))}</button>
                    ${a.isDefault ? '' : `<button type="button" class="link-u t-mono" data-default="${a.id}">${esc(t('account.makeDefault'))}</button>`}
                    <button type="button" class="link-u t-mono acard__del" data-del="${a.id}">${esc(t('account.deleteAddress'))}</button>
                  </div>
                </li>`
              )
              .join('')}</ul>`
          : empty({ ornament: 'orn-arch', title: t('account.noAddresses'), text: t('account.addressesLead') })
      }`;
    ctx.reveal();
  }

  function openForm(address = null) {
    const form = document.createElement('form');
    form.className = 'acc-form';
    form.noValidate = true;
    const v = (k) => esc(address?.[k] || '');
    form.innerHTML = `
      <div class="form-grid form-grid--2">
        <div class="field"><label class="field__label" for="af-country">${esc(t('checkout.country'))}</label>
          <select class="select" id="af-country" name="country">${CIS.map((c) => `<option value="${c}" ${address?.country === c ? 'selected' : ''}>${esc(countryName(c))}</option>`).join('')}</select></div>
        <div class="field"><label class="field__label" for="af-city">${esc(t('checkout.city'))}</label><input class="input" id="af-city" name="city" value="${v('city')}" data-rule="required"><p class="field__error" data-error-for="city"></p></div>
        <div class="field field--wide"><label class="field__label" for="af-street">${esc(t('checkout.street'))}</label><input class="input" id="af-street" name="street" value="${v('street')}" data-rule="required"><p class="field__error" data-error-for="street"></p></div>
        <div class="field"><label class="field__label" for="af-house">${esc(t('checkout.house'))}</label><input class="input" id="af-house" name="house" value="${v('house')}" data-rule="required"><p class="field__error" data-error-for="house"></p></div>
        <div class="field"><label class="field__label" for="af-apt">${esc(t('checkout.apartment'))}</label><input class="input" id="af-apt" name="apartment" value="${v('apartment')}"></div>
        <div class="field"><label class="field__label" for="af-postal">${esc(t('checkout.postal'))}</label><input class="input t-mono" id="af-postal" name="postalCode" value="${v('postalCode')}"><p class="field__error" data-error-for="postalCode"></p></div>
        <div class="field"><label class="field__label" for="af-rec">${esc(t('checkout.recipient'))}</label><input class="input" id="af-rec" name="recipient" value="${v('recipient') || esc(`${ctx.user.firstName} ${ctx.user.lastName}`)}" data-rule="required"><p class="field__error" data-error-for="recipient"></p></div>
        <div class="field field--wide"><label class="field__label" for="af-phone">${esc(t('checkout.recipientPhone'))}</label>
          <div class="phone" data-phone><select class="select phone__country" data-phone-country aria-label="${esc(t('auth.country'))}"></select><input class="input phone__input" id="af-phone" type="tel" inputmode="tel" data-phone-input></div>
          <input type="hidden" name="phone" data-phone-value data-rule="phone"><p class="field__error" data-error-for="phone"></p></div>
      </div>
      <label class="check"><input type="checkbox" name="isDefault" ${address?.isDefault || !addresses.length ? 'checked' : ''}><span class="check__box"></span><span>${esc(t('account.makeDefault'))}</span></label>
      <p class="notice notice--danger" data-form-error hidden></p>
      <div class="modal__actions"><button type="button" class="btn btn--ghost btn--sm" data-modal-close>${esc(t('common.cancel'))}</button><button type="submit" class="btn btn--sm">${esc(t('common.save'))}</button></div>`;
    const modal = openModal({ title: t(address ? 'account.editAddress' : 'account.addAddress'), content: form, size: 'wide' });
    const phone = initPhoneMask($('[data-phone]', form), { defaultIso: 'BY' });
    const digits = String(address?.phone || ctx.user.phone || '').replace(/\D/g, '');
    const country = [...PHONE_COUNTRIES].sort((a, b) => b.code.length - a.code.length).find((c) => digits.startsWith(c.code));
    if (country) {
      $('[data-phone-country]', form).value = country.iso;
      $('[data-phone-input]', form).value = digits.slice(country.code.length);
      $('[data-phone-input]', form).dispatchEvent(new Event('input'));
    }
    liveValidation(form);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors(form);
      if (!validateForm(form)) return;
      const f = form.elements;
      const payload = { country: f.country.value, city: f.city.value.trim(), street: f.street.value.trim(), house: f.house.value.trim(), apartment: f.apartment.value.trim(), postalCode: f.postalCode.value.trim(), recipient: f.recipient.value.trim(), phone: phone.value(), isDefault: f.isDefault.checked };
      await withLoading($('[type=submit]', form), async () => {
        try {
          if (address) await api.put(`/addresses/${address.id}`, payload);
          else await api.post('/addresses', payload);
          modal.close();
          toast.success(t('account.addressSaved'));
          await load();
        } catch (err) {
          showApiError(form, err);
        }
      });
    });
  }

  view.addEventListener('click', async (e) => {
    if (e.target.closest('[data-add]')) return openForm();
    const ed = e.target.closest('[data-edit]');
    if (ed) return openForm(addresses.find((a) => a.id === Number(ed.dataset.edit)));
    const def = e.target.closest('[data-default]');
    if (def) {
      await api.patch(`/addresses/${def.dataset.default}/default`);
      return load();
    }
    const del = e.target.closest('[data-del]');
    if (del && (await confirmModal({ title: t('account.deleteAddress'), text: t('account.deleteAddressConfirm'), confirmLabel: t('common.delete'), danger: true }))) {
      await api.del(`/addresses/${del.dataset.del}`);
      toast.success(t('account.addressDeleted'));
      load();
    }
  });
  view.innerHTML = loading();
  await load();
}
