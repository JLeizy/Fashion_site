// Подвал: список брендов (из кэша справочников) и подписка на рассылку (POST /api/newsletter).
import { $, esc } from '../core/dom.js';
import { t } from '../core/i18n.js';
import api from '../core/api.js';
import { getBrands } from './catalogCache.js';
import { toast } from './toast.js';

export async function initFooter() {
  const list = $('[data-footer-brands]');
  if (list) {
    getBrands()
      .then((brands) => {
        list.innerHTML = brands.map((b) => `<li><a class="link-u" href="/brand/${esc(b.slug)}">${esc(b.name)}</a></li>`).join('');
      })
      .catch(() => {});
  }
  const form = $('[data-newsletter-form]');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = form.querySelector('input[type="email"]');
    const email = input.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      toast.error(t('footer.emailInvalid'));
      input.focus();
      return;
    }
    const btn = form.querySelector('button');
    btn.disabled = true;
    try {
      const res = await api.post('/newsletter', { email });
      toast.success(res.already ? t('footer.already') : t('footer.subscribed'), res.already ? '' : t('footer.subscribedText'));
      form.reset();
    } catch (err) {
      toast.error(err.message);
    } finally {
      btn.disabled = false;
    }
  });
}
