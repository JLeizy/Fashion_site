// Админка → Курсы валют (разделы 13 и 8 ТЗ, роль owner): курсы USD и EUR к BYN (базовая валюта), кто и когда менял,
// живой пример пересчёта. После сохранения сервер сбрасывает кэш курсов — цены на сайте пересчитываются сразу.
// В уже оформленных заказах курс зафиксирован (orders.exchange_rate). API: GET/PUT /api/admin/rates
import { $, esc, icon } from '../core/dom.js';
import { t, fmtDateTime, fmtNumber } from '../core/i18n.js';
import api from '../core/api.js';
import { setRates, formatMoney } from '../core/currency.js';
import { toast } from '../ui/toast.js';
import { withLoading, showApiError, clearErrors } from '../ui/forms.js';
import { loading } from '../account/common.js';

export async function render(view) {
  view.innerHTML = loading();
  let { rates } = await api.get('/admin/rates');
  const get = (code) => rates.find((r) => r.code === code);
  function draw() {
    view.innerHTML = `
      <form class="rates" data-rates novalidate>
        ${['USD', 'EUR']
          .map(
            (code, i) => `<div class="rate" data-reveal>
              <span class="rate__n t-mono">${String(i + 1).padStart(2, '0')}</span>
              <label class="rate__code" for="rate-${code}">1 ${code} =</label>
              <div class="field"><div class="ed-money"><input class="input t-mono rate__input" id="rate-${code}" name="${code}" type="number" step="0.0001" min="0.0001" value="${get(code).rate}" required><span class="t-mono">BYN</span></div><p class="field__error" data-error-for="${code}"></p></div>
              <p class="rate__inv t-mono" data-inv="${code}"></p>
              <p class="rate__meta t-mono t-muted">${esc(t('admin.rates.updated', { date: fmtDateTime(get(code).updatedAt), who: get(code).updatedBy || '—' }))}</p>
            </div>`
          )
          .join('')}
        <div class="rate rate--example" data-reveal>
          <span class="rate__n t-mono">03</span>
          <p class="rate__code">${esc(t('admin.rates.example'))}</p>
          <p class="rate__ex t-mono" data-example></p>
        </div>
        <p class="notice notice--accent">${icon('i-info', 'icon icon--sm')} ${esc(t('admin.rates.note'))}</p>
        <p class="notice notice--danger" data-form-error hidden></p>
        <button type="submit" class="btn">${esc(t('common.save'))}</button>
      </form>`;
    preview();
  }
  function preview() {
    const form = $('[data-rates]', view);
    const usd = Number(form.elements.USD.value) || 0;
    const eur = Number(form.elements.EUR.value) || 0;
    ['USD', 'EUR'].forEach((c) => {
      const v = Number(form.elements[c].value) || 0;
      $(`[data-inv="${c}"]`, view).textContent = v ? `1 BYN = ${fmtNumber(1 / v, { maximumFractionDigits: 4 })} ${c}` : '';
    });
    const byn = 1250;
    $('[data-example]', view).textContent = `${formatMoney(byn, 'BYN')} = ${usd ? formatMoney(byn / usd, 'USD') : '—'} = ${eur ? formatMoney(byn / eur, 'EUR') : '—'}`;
  }
  draw();
  view.addEventListener('input', preview);
  view.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    clearErrors(form);
    await withLoading($('[type=submit]', form), async () => {
      try {
        await api.put('/admin/rates', { USD: Number(form.elements.USD.value), EUR: Number(form.elements.EUR.value) });
        ({ rates } = await api.get('/admin/rates'));
        setRates(Object.fromEntries(rates.map((r) => [r.code, r.rate])));
        toast.success(t('admin.rates.saved'));
        draw();
      } catch (err) {
        showApiError(form, err);
      }
    });
  });
}
