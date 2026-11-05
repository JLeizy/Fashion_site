// Служебные страницы (раздел 6.15 ТЗ): /delivery, /returns, /size-guide, /about, /contacts, /privacy — один шаблон info.html.
// Тексты — словари i18n (info.<ключ>: title, eyebrow, lead, blocks[{ h, p[], list[] }]); «живые» данные подгружаются из API:
// способы доставки и оплаты (GET /api/checkout/options), порог бесплатной доставки (GET /api/auth/me → shop),
// размерные сетки EU / IT / US / INT (GET /api/sizes).
// Макет на всю ширину рабочей области (правка П7): заголовок слева и вводный текст справа; ниже — липкое оглавление
// с карточкой поддержки слева и разделы справа (блоки текста в сетке из двух колонок на широком экране).
import { initApp } from '../app.js';
import { $, $$, esc, icon } from '../core/dom.js';
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
const listHtml = (list, marks) =>
  `<ul class="ip-list">${list
    .map((li, i) => `<li>${marks ? `<span class="ip-list__mark t-mono">${marks[i]}</span>` : icon('orn-cross', 'icon icon--xs icon--fill')}<span>${esc(li)}</span></li>`)
    .join('')}</ul>`;

// Раздел страницы: номер, заголовок (попадает в оглавление), содержимое
const section = (id, n, title, body, cls = '') =>
  `<section class="ip-sec ${cls}" id="${id}" data-ip-sec data-reveal>
    <header class="ip-sec__head"><span class="ip-sec__n t-mono">${pad(n)}</span><h2 class="ip-sec__h">${esc(title)}</h2></header>
    ${body}
  </section>`;

// Блоки текста из словаря — в сетке из двух колонок
function blocksHtml(blocks = [], start = 1) {
  if (!blocks.length) return '';
  return `<div class="ip-blocks">${blocks
    .map(
      (b, i) => `<section class="ip-block" id="ip-b-${start + i}" data-ip-sec data-reveal>
        <span class="ip-block__n">${pad(start + i)}</span>
        <h2 class="ip-block__h">${esc(b.h)}</h2>
        <div class="ip-block__body">
          ${(b.p || []).map((p) => `<p>${esc(p)}</p>`).join('')}
          ${b.list ? listHtml(b.list) : ''}
        </div>
      </section>`
    )
    .join('')}</div>`;
}

// Схема «Как снять мерки»: силуэт с размерными линиями A–C и стопа D (подписи совпадают с пунктами списка)
function measureSvg() {
  return `<svg class="ip-measure__svg" viewBox="0 0 320 460" role="img" aria-label="${esc(t('info.sizes.figureAria'))}">
    <g class="ip-measure__body">
      <circle cx="120" cy="46" r="26"/>
      <path d="M108 72 h24 v14 l38 10 q14 4 16 20 l10 96 q2 14 -10 14 q-10 0 -12 -12 l-10 -78 l-4 50 q6 24 6 46 l-6 64 l-6 112 h-22 l-4 -104 l-4 -40 l-4 40 l-4 104 h-22 l-6 -112 l-6 -64 q0 -22 6 -46 l-4 -50 l-10 78 q-2 12 -12 12 q-12 0 -10 -14 l10 -96 q2 -16 16 -20 l38 -10 z"/>
    </g>
    <g class="ip-measure__lines">
      <line x1="66" y1="132" x2="174" y2="132"/><text x="190" y="136">A</text>
      <line x1="76" y1="182" x2="164" y2="182"/><text x="190" y="186">B</text>
      <line x1="70" y1="232" x2="170" y2="232"/><text x="190" y="236">C</text>
    </g>
    <g class="ip-measure__foot">
      <path d="M232 300 q22 -6 34 10 q12 18 10 64 q-2 40 -22 52 q-18 8 -26 -12 q-8 -22 -6 -60 q2 -44 10 -54 z"/>
      <line x1="300" y1="296" x2="300" y2="430"/><path d="M294 304 l6 -8 l6 8 M294 422 l6 8 l6 -8"/>
      <text x="290" y="452">D</text>
    </g>
  </svg>`;
}

// Живые разделы отдельных страниц (данные из API) → [{ id, title, html }]
function liveSections() {
  if (key === 'delivery' && live.options) {
    const free = app.me?.shop?.freeDeliveryFromByn;
    return [
      {
        id: 'ip-delivery',
        title: t('info.delivery.methods'),
        html: `<div class="ip-methods">${live.options.delivery
          .map((d) => `<article class="ip-method"><span class="ip-method__icon">${icon(d.isPickup ? 'i-box' : 'i-truck')}</span><h3>${esc(loc(d.name))}</h3>
            <p class="t-mono">${d.price ? price(d.price) : esc(t('checkout.free'))} · ${esc(t('info.delivery.days', { from: d.daysMin, to: d.daysMax }))}</p>
            <p class="t-muted">${esc(t(d.isPickup ? 'info.delivery.pickupNote' : 'info.delivery.doorNote'))}</p></article>`)
          .join('')}</div>
          ${free ? `<p class="notice notice--accent">${icon('i-sparkle', 'icon icon--sm')} ${esc(t('info.delivery.free', { sum: formatPrice(free) }))}</p>` : ''}`,
      },
      {
        id: 'ip-payment',
        title: t('info.delivery.payments'),
        html: `<div class="ip-methods">${live.options.payment
          .map((p) => `<article class="ip-method"><span class="ip-method__icon">${icon(p.isOnline ? 'i-card' : 'i-cash')}</span><h3>${esc(loc(p.name))}</h3><p class="t-muted">${esc(t(p.isOnline ? 'info.delivery.onlineNote' : 'info.delivery.cashNote'))}</p></article>`)
          .join('')}</div>`,
      },
    ];
  }
  if (key === 'sizes' && live.sizes) {
    const order = ['clothing', 'shoes', 'ring', 'volume_ml', 'one_size'];
    const tables = order
      .filter((type) => live.sizes[type])
      .map(
        (type) => `<figure class="ip-table">
          <figcaption class="ip-table__h">${esc(t(`info.sizes.types.${type}`))}</figcaption>
          <div class="table-wrap"><table class="table ip-sizes"><thead><tr><th>INT</th><th>EU</th><th>IT</th><th>US</th></tr></thead>
          <tbody>${live.sizes[type].map((s) => `<tr><td><b>${esc(s.int)}</b></td><td>${esc(s.eu || '—')}</td><td>${esc(s.it || '—')}</td><td>${esc(s.us || '—')}</td></tr>`).join('')}</tbody></table></div>
        </figure>`
      )
      .join('');
    const how = (tRaw('info.sizes.blocks') || [])[0] || { h: '', list: [] };
    return [
      { id: 'ip-tables', title: t('info.sizes.tablesTitle'), html: `<div class="ip-tables">${tables}</div>` },
      {
        id: 'ip-measure',
        title: how.h,
        html: `<div class="ip-measure">${measureSvg()}<div class="ip-measure__text">${listHtml(how.list || [], ['A', 'B', 'C', 'D'])}<p class="t-muted">${esc(t('sizeChart.howText'))}</p></div></div>`,
      },
    ];
  }
  if (key === 'contacts') {
    // Только телефон и почта (правка П9): крупная типографика на всю ширину рабочей области
    const c = tRaw('info.contacts') || {};
    return [
      {
        id: 'ip-contacts',
        title: '',
        html: `<div class="ip-contacts">
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
      </div>`,
      },
    ];
  }
  if (key === 'returns') {
    return [
      {
        id: 'ip-steps',
        title: t('info.returns.stepsTitle'),
        html: `<div class="ip-steps">${(tRaw('info.returns.steps') || [])
          .map((s, i) => `<div class="ip-step"><span class="ip-step__n">${pad(i + 1)}</span><p>${esc(s)}</p></div>`)
          .join('')}<a class="btn" href="/account/orders">${esc(t('info.returns.cta'))}</a></div>`,
      },
    ];
  }
  return [];
}

// Левая колонка: оглавление (подсветка текущего раздела) + карточка поддержки
function asideHtml(items) {
  const toc = items.length > 1
    ? `<nav class="ip-toc" aria-label="${esc(t('history.contents'))}">
        <p class="t-eyebrow">${esc(t('history.contents'))}</p>
        <ol>${items.map((it, i) => `<li><a href="#${it.id}" data-ip-toc="${it.id}"><span class="t-mono">${pad(i + 1)}</span>${esc(it.title)}</a></li>`).join('')}</ol>
      </nav>`
    : '';
  const c = tRaw('info.contacts') || {};
  const card = key === 'contacts'
    ? ''
    : `<div class="ip-help">
        <p class="t-eyebrow">${esc(t('info.helpTitle'))}</p>
        <p class="ip-help__text">${esc(t('info.helpText'))}</p>
        <a class="ip-help__line t-mono" href="tel:+375291234567">${icon('i-phone', 'icon icon--xs')} +375 29 123-45-67</a>
        <a class="ip-help__line t-mono" href="mailto:hello@amfibia.by">${icon('i-mail', 'icon icon--xs')} hello@amfibia.by</a>
        <p class="ip-help__hours t-mono">${esc(c.hoursValue || '')}</p>
      </div>`;
  return `${toc}${card}`;
}

let tocObserver = null;
function bindToc() {
  tocObserver?.disconnect();
  const links = new Map($$('[data-ip-toc]').map((a) => [a.dataset.ipToc, a]));
  if (!links.size) return;
  tocObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach((a) => a.classList.remove('is-active'));
        links.get(e.target.id)?.classList.add('is-active');
      });
    },
    { rootMargin: '-30% 0px -60% 0px' }
  );
  $$('[data-ip-sec]').forEach((el) => tocObserver.observe(el));
}

function render() {
  const page = tRaw(`info.${key}`) || {};
  document.title = `${page.title} — AMFIBIA`;
  $('[data-ip-eyebrow]').textContent = page.eyebrow || '';
  $('[data-ip-title]').textContent = page.title || '';
  $('[data-ip-lead]').textContent = page.lead || '';
  $('[data-ip-updated]').textContent = page.updated || '';
  renderBreadcrumbs($('[data-breadcrumbs]'), [{ href: '/', label: t('nav.home') }, { label: page.title }]);

  const lives = liveSections();
  // На странице размеров первый текстовый блок («Как снять мерки») уже показан на схеме
  const blocks = key === 'sizes' ? (page.blocks || []).slice(1) : page.blocks || [];
  const liveHtml = lives.map((s, i) => (s.title ? section(s.id, i + 1, s.title, s.html) : `<div id="${s.id}">${s.html}</div>`)).join('');
  const blocksStart = lives.filter((s) => s.title).length + 1;
  const toc = [
    ...lives.filter((s) => s.title).map((s) => ({ id: s.id, title: s.title })),
    ...blocks.map((b, i) => ({ id: `ip-b-${blocksStart + i}`, title: b.h })),
  ];
  $('[data-ip-aside]').innerHTML = asideHtml(toc);
  $('[data-ip-body]').innerHTML = `${liveHtml}${blocksHtml(blocks, blocksStart)}`;
  $('[data-ip-more]').innerHTML = Object.entries(PAGES)
    .filter(([k]) => k !== key)
    .map(([k, href]) => `<a href="${href}"><span class="t-mono">${esc(tRaw(`info.${k}`)?.eyebrow || '')}</span><b>${esc(tRaw(`info.${k}`)?.title || '')}</b>${icon('i-arrow-right', 'icon icon--sm')}</a>`)
    .join('');
  refreshPrices();
  initReveals();
  bindToc();
  refreshScroll();
}

render();
await app.reveal();
onLangChange(render);
