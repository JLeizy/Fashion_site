// Кабинет → Стать продавцом: заявка (название магазина, описание) и её статус. Рассматривает модератор;
// при одобрении роль меняется на seller. API: GET/POST /api/seller-application (таблица seller_applications)
import { $, esc, icon } from '../core/dom.js';
import { t, fmtDate } from '../core/i18n.js';
import api from '../core/api.js';
import { toast } from '../ui/toast.js';
import { withLoading, showApiError, clearErrors } from '../ui/forms.js';
import { statusBadge, loading } from './common.js';

export async function render(view, ctx) {
  view.innerHTML = loading();
  const { application: a } = await api.get('/seller-application');
  const perks = [1, 2, 3].map((n) => `<li>${icon('orn-cross', 'icon icon--xs icon--fill')} ${esc(t(`account.sellerPerk${n}`))}</li>`).join('');
  const canApply = ctx.user.role === 'buyer' && (!a || a.status === 'rejected');
  view.innerHTML = `
    <div class="seller">
      <div class="seller__intro">
        <p class="seller__lead">${esc(t('account.sellerLead'))}</p>
        <ul class="seller__perks">${perks}</ul>
        ${
          a
            ? `<div class="seller__status">${statusBadge(a.status, t(`account.sellerStatus.${a.status}`))}
                <p class="t-mono t-muted">${esc(a.shopName)} · ${esc(fmtDate(a.createdAt))}</p>${a.comment ? `<p>${esc(a.comment)}</p>` : ''}</div>`
            : ''
        }
        ${ctx.user.role !== 'buyer' ? `<p class="notice">${esc(t('account.sellerAlready', { role: t(`roles.${ctx.user.role}`) }))}</p>` : ''}
      </div>
      ${
        canApply
          ? `<form class="acc-form" data-seller-form novalidate>
              <div class="field"><label class="field__label" for="sl-name">${esc(t('account.shopName'))}</label><input class="input" id="sl-name" name="shopName" maxlength="120" required><p class="field__error" data-error-for="shopName"></p></div>
              <div class="field"><label class="field__label" for="sl-desc">${esc(t('account.shopDesc'))}</label><textarea class="textarea" id="sl-desc" name="description" rows="6" maxlength="2000" required></textarea><p class="field__error" data-error-for="description"></p></div>
              <p class="notice notice--danger" data-form-error hidden></p>
              <button type="submit" class="btn">${esc(t('account.apply'))}</button>
            </form>`
          : ''
      }
    </div>`;
  const form = $('[data-seller-form]', view);
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    await withLoading($('[type=submit]', form), async () => {
      try {
        await api.post('/seller-application', { shopName: form.elements.shopName.value.trim(), description: form.elements.description.value.trim() });
        toast.success(t('account.applied'));
        render(view, ctx);
      } catch (err) {
        showApiError(form, err);
      }
    });
  });
}
