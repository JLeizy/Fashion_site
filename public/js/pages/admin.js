// Админ-панель /admin (раздел 8 ТЗ): собственный макет — боковое меню, верхняя панель, тёмная тема по умолчанию.
// Набор разделов зависит от роли: owner — все; moderator — пользователи, модерация товаров и отзывов, заявки продавцов.
// Разделы — модули public/js/admin/*.js (render(view, ctx, params) → функция очистки), навигация без перезагрузки.
// Права дополнительно проверяются на сервере в каждом API (/api/admin/*).
import { $, $$, esc, icon, initials } from '../core/dom.js';
import { t, initI18n, setLang, getLang, onLangChange, applyTranslations } from '../core/i18n.js';
import api, { setCsrf } from '../core/api.js';
import { setRates, setCurrency, getCurrency } from '../core/currency.js';
import { hydrate } from '../core/store.js';
import { toast } from '../ui/toast.js';

// Разделы меню. roles — кому виден пункт (owner видит всё). href — внешний раздел (кабинет сотрудника).
const GROUPS = [
  { id: 'overview', items: [{ id: 'dashboard', path: '', icon: 'i-home', module: 'dashboard', roles: [] }] },
  {
    id: 'moderation',
    items: [
      { id: 'products', path: 'products', icon: 'i-shield', module: 'products', roles: ['moderator'], badge: 'products' },
      { id: 'reviews', path: 'reviews', icon: 'i-star', module: 'reviews', roles: ['moderator'], badge: 'reviews' },
      { id: 'sellers', path: 'sellers', icon: 'i-sparkle', module: 'sellers', roles: ['moderator'], badge: 'applications' },
    ],
  },
  {
    id: 'sales',
    items: [
      { id: 'orders', path: 'orders', icon: 'i-box', module: 'orders', roles: [], badge: 'orders' },
      { id: 'returns', href: '/account/desk/returns', icon: 'i-return', roles: [], badge: 'returns' },
      { id: 'tickets', href: '/account/desk', icon: 'i-chat', roles: [], badge: 'tickets' },
      { id: 'stock', href: '/account/stock', icon: 'i-catalog', roles: [] },
    ],
  },
  {
    id: 'catalog',
    items: [
      { id: 'brands', path: 'brands', icon: 'i-book', module: 'brands', roles: [] },
      { id: 'collections', path: 'collections', icon: 'i-grid3', module: 'refs', entity: 'collections', roles: [] },
      { id: 'categories', path: 'categories', icon: 'i-list', module: 'categories', roles: [] },
      { id: 'banners', path: 'banners', icon: 'i-play', module: 'refs', entity: 'banners', roles: [] },
    ],
  },
  {
    id: 'settings',
    items: [
      { id: 'users', path: 'users', icon: 'i-user', module: 'users', roles: ['moderator'] },
      { id: 'warehouses', path: 'warehouses', icon: 'i-pin', module: 'refs', entity: 'warehouses', roles: [] },
      { id: 'delivery', path: 'delivery', icon: 'i-truck', module: 'refs', entity: 'delivery', roles: [] },
      { id: 'payment', path: 'payment', icon: 'i-card', module: 'refs', entity: 'payment', roles: [] },
      { id: 'promos', path: 'promos', icon: 'i-sparkle', module: 'refs', entity: 'promos', roles: [] },
      { id: 'rates', path: 'rates', icon: 'i-cash', module: 'rates', roles: [] },
      { id: 'audit', path: 'audit', icon: 'i-clock', module: 'audit', roles: [] },
    ],
  },
];

await initI18n();
const me = await api.get('/auth/me');
setCsrf(me.csrfToken);
setRates(me.rates);
hydrate(me);
const user = me.user;
const visible = (item) => user.role === 'owner' || item.roles.includes(user.role);
const sections = () => GROUPS.flatMap((g) => g.items).filter(visible).filter((s) => !s.href);

const els = { nav: $('[data-adm-nav]'), view: $('[data-adm-view]'), title: $('[data-adm-title]'), eyebrow: $('[data-adm-eyebrow]'), side: $('[data-adm-side]'), scrim: $('[data-adm-scrim]') };
let summary = {};
let cleanup = null;
let seq = 0;

function renderNav(activeId) {
  els.nav.innerHTML = GROUPS.map((g) => {
    const items = g.items.filter(visible);
    if (!items.length) return '';
    return `<p class="adm-nav__group t-mono">${esc(t(`admin.groups.${g.id}`))}</p><ul>${items
      .map((s) => {
        const href = s.href || `/admin${s.path ? `/${s.path}` : ''}`;
        const n = s.badge ? summary[s.badge] : 0;
        return `<li><a class="adm-nav__link ${s.id === activeId ? 'is-active' : ''}" href="${href}" ${s.href ? '' : 'data-adm-link'} ${s.id === activeId ? 'aria-current="page"' : ''}>
          ${icon(s.icon, 'icon icon--sm')}<span>${esc(t(`admin.nav.${s.id}`))}</span>${s.href ? icon('i-arrow-ne', 'icon icon--xs adm-nav__ext') : ''}${n ? `<b class="adm-nav__badge t-mono">${n}</b>` : ''}</a></li>`;
      })
      .join('')}</ul>`;
  }).join('');
}

function renderMe() {
  $('[data-adm-me]').innerHTML = `
    <span class="avatar avatar--sm">${user.avatar ? `<img src="${esc(user.avatar)}" alt="">` : esc(initials(user.firstName, user.lastName))}</span>
    <span class="adm-me__info"><b>${esc(`${user.firstName} ${user.lastName}`)}</b><i class="t-mono">${esc(t(`roles.${user.role}`))}</i></span>
    <a class="icon-btn" href="/account" title="${esc(t('admin.toAccount'))}" aria-label="${esc(t('admin.toAccount'))}">${icon('i-user', 'icon icon--sm')}</a>
    <button type="button" class="icon-btn" data-logout title="${esc(t('auth.logout'))}" aria-label="${esc(t('auth.logout'))}">${icon('i-logout', 'icon icon--sm')}</button>`;
}

async function loadSummary() {
  try {
    summary = await api.get('/admin/summary');
  } catch {
    summary = {};
  }
}

function resolve() {
  const parts = location.pathname.replace(/^\/admin\/?/, '').split('/').filter(Boolean);
  const list = sections();
  const section = list.find((s) => s.path === (parts[0] || '')) || list[0];
  return { section, params: section.path === (parts[0] || '') ? parts.slice(1) : [] };
}

const ctx = {
  user,
  get summary() {
    return summary;
  },
  setHead({ eyebrow = '', title }) {
    els.eyebrow.textContent = eyebrow || t('admin.eyebrow');
    els.title.textContent = title;
    document.title = `${title} — AMFIBIA Admin`;
  },
  navigate(path, { replace = false } = {}) {
    history[replace ? 'replaceState' : 'pushState'](null, '', path);
    render();
  },
  async refreshSummary() {
    await loadSummary();
    renderNav(resolve().section.id);
  },
};

async function render() {
  const my = ++seq;
  const { section, params } = resolve();
  // Раздел недоступен роли (или адрес неверный) — показываем первый доступный и исправляем адрес
  if ((location.pathname.split('/')[2] || '') !== section.path) history.replaceState(null, '', section.path ? `/admin/${section.path}` : '/admin');
  renderNav(section.id);
  closeSide();
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
  els.view.classList.add('is-leaving');
  try {
    const mod = await import(`../admin/${section.module}.js`);
    if (my !== seq) return;
    ctx.setHead({ title: t(`admin.nav.${section.id}`), eyebrow: t(`admin.groups.${GROUPS.find((g) => g.items.includes(section)).id}`) });
    const fresh = els.view.cloneNode(false);
    els.view.replaceWith(fresh);
    els.view = fresh;
    fresh.innerHTML = '<div class="skeleton" style="height:320px"></div>';
    cleanup = await mod.render(fresh, { ...ctx, section }, params);
  } catch (err) {
    console.error(err);
    els.view.innerHTML = `<p class="notice notice--danger">${esc(err.message)}</p>`;
  }
  if (my !== seq) return;
  els.view.classList.remove('is-leaving');
  els.view.querySelectorAll('[data-reveal]').forEach((el, i) => {
    el.style.setProperty('--d', `${Math.min(i, 12) * 40}ms`);
    el.classList.add('is-in');
  });
}

// ---------- Мобильное меню ----------
function closeSide() {
  els.side.classList.remove('is-open');
  els.scrim.hidden = true;
}
$('[data-adm-burger]').addEventListener('click', () => {
  els.side.classList.add('is-open');
  els.scrim.hidden = false;
});
els.scrim.addEventListener('click', closeSide);
document.addEventListener('keydown', (e) => e.key === 'Escape' && closeSide());

// ---------- Переключатели: язык, валюта, тема (тема админки хранится отдельно — amf:admin-theme) ----------
function syncTools() {
  $$('[data-adm-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.admLang === getLang())));
  $$('[data-adm-cur]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.admCur === getCurrency())));
  $$('[data-adm-theme]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.admTheme === document.documentElement.dataset.theme)));
}
document.addEventListener('click', async (e) => {
  const l = e.target.closest('[data-adm-lang]');
  if (l) {
    await setLang(l.dataset.admLang);
    api.patch('/profile/preferences', { lang: l.dataset.admLang }).catch(() => {});
    syncTools();
    return;
  }
  const c = e.target.closest('[data-adm-cur]');
  if (c) {
    setCurrency(c.dataset.admCur);
    api.patch('/profile/preferences', { currency: c.dataset.admCur }).catch(() => {});
    syncTools();
    return;
  }
  const th = e.target.closest('[data-adm-theme]');
  if (th) {
    document.documentElement.dataset.theme = th.dataset.admTheme;
    try {
      localStorage.setItem('amf:admin-theme', th.dataset.admTheme);
    } catch {
      /* не критично */
    }
    document.dispatchEvent(new CustomEvent('amf:themechange', { detail: { theme: th.dataset.admTheme } }));
    syncTools();
    return;
  }
  if (e.target.closest('[data-logout]')) {
    try {
      await api.post('/auth/logout');
    } finally {
      location.href = '/';
    }
    return;
  }
  const a = e.target.closest('a[data-adm-link]');
  if (a && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
    e.preventDefault();
    if (a.getAttribute('href') !== location.pathname + location.search) ctx.navigate(a.getAttribute('href'));
    window.scrollTo({ top: 0 });
  }
});
window.addEventListener('popstate', render);
onLangChange(() => {
  applyTranslations(document);
  renderMe();
  render();
});
window.addEventListener('unhandledrejection', (e) => {
  if (e.reason?.status) toast.error(e.reason.message);
});

await loadSummary();
renderMe();
syncTools();
applyTranslations(document);
await render();
// Счётчики очередей в меню обновляются раз в минуту
setInterval(() => ctx.refreshSummary(), 60_000);
