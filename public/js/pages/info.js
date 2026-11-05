// Служебные страницы (раздел 6.15 ТЗ): /delivery, /returns, /size-guide, /about, /contacts, /privacy — один шаблон info.html.
// Тексты — словари i18n (info.<ключ>: title, eyebrow, lead, blocks[{ h, p[], list[] }]); «живые» данные подгружаются из API:
// способы доставки и оплаты (GET /api/checkout/options), порог бесплатной доставки (GET /api/auth/me → shop),
// размерные сетки EU / IT / US / INT (GET /api/sizes).
import { initApp } from '../app.js';
import { $, esc, icon } from '../core/dom.js';
import { t, tRaw, loc, onLangChange } from '../core/i18n.js';
import api from '../core/api.js';
import { formatPrice, refreshPrices } from '../core/currency.js';
import { renderBreadcrumbs } from '../ui/breadcrumbs.js';
import { initReveals, refreshScroll } from '../ui/motion.js';

const key = document.body.dataset.info;
const app = await initApp();
const PAGES = { delivery: '/delivery', returns: '/returns', sizes: '/size-guide', about: '/about', contacts: '/contacts', privacy: '/privacy' };
const live = {};
if (key === 'delivery') live.options = await api.get('/checkout/options');
if (key === 'sizes') live.sizes = (await api.get('/sizes')).sizes;
const pad = (n) => String(n).padStart(2, '0');
const price = (byn) => `<span data-price="${byn}">${esc(formatPrice(byn))}</span>`;

// Блоки текста из словаря
function blocksHtml(blocks = []) {
  return blocks
    .map(
      (b, i) => `<section class="ip-block" data-reveal>
        <span class="ip-block__n t-mono">${pad(i + 1)}</span>
        <div class="ip-block__body">
          <h2 class="ip-block__h">${esc(b.h)}</h2>
          ${(b.p || []).map((p) => `<p>${esc(p)}</p>`).join('')}
          ${b.list ? `<ul class="ip-list">${b.list.map((li) => `<li>${icon('orn-cross', 'icon icon--xs icon--fill')}<span>${esc(li)}</span></li>`).join('')}</ul>` : ''}
        </div>
      </section>`
    )
    .join('');
}

// Живые блоки отдельных страниц
function extraHtml() {
  if (key === 'delivery' && live.options) {
    const free = app.me?.shop?.freeDeliveryFromByn;
    return `<section class="ip-live" data-reveal>
        <h2 class="ip-live__h">${esc(t('info.delivery.methods'))}</h2>
        <div class="ip-methods">${live.options.delivery
          .map((d) => `<article class="ip-method"><span class="ip-method__icon">${icon(d.isPickup ? 'i-pin' : 'i-truck')}</span><h3>${esc(loc(d.name))}</h3>
            <p class="t-mono">${d.price ? price(d.price) : esc(t('checkout.free'))} · ${esc(t('info.delivery.days', { from: d.daysMin, to: d.daysMax }))}</p>
            <p class="t-muted">${esc(t(d.isPickup ? 'info.delivery.pickupNote' : 'info.delivery.doorNote'))}</p></article>`)
          .join('')}</div>
        ${free ? `<p class="notice notice--accent">${icon('i-sparkle', 'icon icon--sm')} ${esc(t('info.delivery.free', { sum: formatPrice(free) }))}</p>` : ''}
        <h2 class="ip-live__h">${esc(t('info.delivery.payments'))}</h2>
        <div class="ip-methods">${live.options.payment
          .map((p) => `<article class="ip-method"><span class="ip-method__icon">${icon(p.isOnline ? 'i-card' : 'i-cash')}</span><h3>${esc(loc(p.name))}</h3><p class="t-muted">${esc(t(p.isOnline ? 'info.delivery.onlineNote' : 'info.delivery.cashNote'))}</p></article>`)
          .join('')}</div>
      </section>`;
  }
  if (key === 'sizes' && live.sizes) {
    const order = ['clothing', 'shoes', 'ring', 'volume_ml', 'one_size'];
    return `<section class="ip-live" data-reveal>${order
      .filter((type) => live.sizes[type])
      .map(
        (type) => `<h2 class="ip-live__h">${esc(t(`info.sizes.types.${type}`))}</h2>
          <div class="table-wrap"><table class="table ip-sizes"><thead><tr><th>INT</th><th>EU</th><th>IT</th><th>US</th></tr></thead>
          <tbody>${live.sizes[type].map((s) => `<tr><td><b>${esc(s.int)}</b></td><td>${esc(s.eu || '—')}</td><td>${esc(s.it || '—')}</td><td>${esc(s.us || '—')}</td></tr>`).join('')}</tbody></table></div>`
      )
      .join('')}</section>`;
  }
  if (key === 'contacts') {
    // Только телефон и почта (правка П9): крупная типографика на всю ширину рабочей области
    const c = tRaw('info.contacts') || {};
    return `<section class="ip-contacts" data-reveal>
        <a class="ip-contact" href="tel:+375291234567">
          <span class="ip-contact__label t-mono">${icon('i-phone', 'icon icon--xs')} ${esc(c.phone)}</span>
          <span class="ip-contact__value">+375 29 123-45-67</span>
          ${icon('i-arrow-right', 'icon ip-contact__arrow')}
        </a>
        <a class="ip-contact" href="mailto:hello@amfibia.by">
          <span class="ip-contact__label t-mono">${icon('i-mail', 'icon icon--xs')} ${esc(c.email)}</span>
          <span class="ip-contact__value">hello@amfibia.by</span>
          ${icon('i-arrow-right', 'icon ip-contact__arrow')}
        </a>
        <div class="ip-contact ip-contact--static">
          <span class="ip-contact__label t-mono">${icon('i-clock', 'icon icon--xs')} ${esc(c.hours)}</span>
          <span class="ip-contact__value ip-contact__value--sm">${esc(c.hoursValue)}<small class="t-muted">${esc(c.hoursNote)}</small></span>
        </div>
      </section>`;
  }
  if (key === 'returns') {
    return `<section class="ip-steps" data-reveal>${(tRaw('info.returns.steps') || [])
      .map((s, i) => `<div class="ip-step"><span class="ip-step__n">${pad(i + 1)}</span><p>${esc(s)}</p></div>`)
      .join('')}<a class="btn" href="/account/orders">${esc(t('info.returns.cta'))}</a></section>`;
  }
  return '';
}

function render() {
  const page = tRaw(`info.${key}`) || {};
  document.title = `${page.title} — AMFIBIA`;
  $('[data-ip-eyebrow]').textContent = page.eyebrow || '';
  $('[data-ip-title]').textContent = page.title || '';
  $('[data-ip-lead]').textContent = page.lead || '';
  renderBreadcrumbs($('[data-breadcrumbs]'), [{ href: '/', label: t('nav.home') }, { label: page.title }]);
  const live = extraHtml();
  $('[data-ip-body]').innerHTML = `${key === 'sizes' || key === 'delivery' ? live + blocksHtml(page.blocks) : blocksHtml(page.blocks) + live}
    ${page.updated ? `<p class="ip-updated t-mono">${esc(page.updated)}</p>` : ''}`;
  $('[data-ip-more]').innerHTML = Object.entries(PAGES)
    .filter(([k]) => k !== key)
    .map(([k, href]) => `<a href="${href}"><span class="t-mono">${esc(tRaw(`info.${k}`)?.eyebrow || '')}</span><b>${esc(tRaw(`info.${k}`)?.title || '')}</b>${icon('i-arrow-right', 'icon icon--sm')}</a>`)
    .join('');
  refreshPrices();
  initReveals();
  refreshScroll();
}

render();
await app.reveal();
onLangChange(render);
