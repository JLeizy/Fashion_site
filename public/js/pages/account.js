// Личный кабинет /account/* (раздел 6.13 ТЗ). Боковое меню — набор вкладок зависит от роли (раздел 4).
// Шапка профиля: аватар (загрузка — POST /api/account/avatar, multer), имя, роль, дата регистрации.
// Разделы — модули public/js/account/*.js, загружаются по требованию; навигация без перезагрузки (history API).
import { initApp } from '../app.js';
import { $, $$, esc, icon, initials } from '../core/dom.js';
import { t, onLangChange, fmtDate } from '../core/i18n.js';
import api from '../core/api.js';
import { store } from '../core/store.js';
import { renderBreadcrumbs } from '../ui/breadcrumbs.js';
import { toast } from '../ui/toast.js';
import { initReveals, refreshScroll, scrollTo } from '../ui/motion.js';

const app = await initApp();
let user = app.user;

// Разделы кабинета. roles: null — всем вошедшим; иначе — перечисленным ролям (owner видит всё).
// Кабинеты сотрудников (продавец, склад, курьер, поддержка) подключаются на этапе 13 тем же механизмом.
export const SECTIONS = [
  { id: 'overview', path: '', icon: 'i-home', module: 'overview' },
  { id: 'orders', path: 'orders', icon: 'i-box', module: 'orders' },
  { id: 'returns', path: 'returns', icon: 'i-return', module: 'returns' },
  { id: 'addresses', path: 'addresses', icon: 'i-pin', module: 'addresses' },
  { id: 'notifications', path: 'notifications', icon: 'i-bell', module: 'notifications', badge: 'notifications' },
  { id: 'wishlist', href: '/wishlist', icon: 'i-heart', badge: 'wishlist' },
  { id: 'viewed', path: 'viewed', icon: 'i-eye', module: 'viewed' },
  { id: 'reviews', path: 'reviews', icon: 'i-star', module: 'reviews' },
  { id: 'support', path: 'support', icon: 'i-chat', module: 'support' },
  { id: 'seller', path: 'seller', icon: 'i-sparkle', module: 'seller', roles: ['buyer'] },
  { id: 'settings', path: 'settings', icon: 'i-settings', module: 'settings' },
];
// Кабинеты сотрудников (этап 13). Сервер дополнительно проверяет роль в каждом API (checkRole) — здесь только меню.
const ROLE_SECTIONS = [
  { id: 'shop', path: 'shop', icon: 'i-catalog', module: 'shop', roles: ['seller'], staff: true },
  { id: 'stock', path: 'stock', icon: 'i-box', module: 'stock', roles: ['warehouse'], staff: true },
  { id: 'deliveries', path: 'deliveries', icon: 'i-truck', module: 'deliveries', roles: ['courier'], staff: true },
  { id: 'desk', path: 'desk', icon: 'i-chat', module: 'desk', roles: ['support'], staff: true },
];

const visible = (s) => !s.roles || s.roles.includes(user.role) || (user.role === 'owner' && !s.roles.includes('buyer'));
const allSections = () => [...SECTIONS.slice(0, 1), ...ROLE_SECTIONS.filter(visible), ...SECTIONS.slice(1)].filter(visible);

const els = { nav: $('[data-acc-nav]'), view: $('[data-acc-view]'), title: $('[data-acc-title]'), eyebrow: $('[data-acc-eyebrow]') };
let cleanup = null;
let renderSeq = 0;

// ---------- Шапка профиля ----------
function renderProfile() {
  const avatar = $('[data-avatar]');
  avatar.innerHTML = user.avatar ? `<img src="${esc(user.avatar)}" alt="">` : esc(initials(user.firstName, user.lastName));
  $('[data-profile-name]').textContent = `${user.firstName} ${user.lastName}`.trim();
  $('[data-profile-role]').textContent = t(`roles.${user.role}`);
  $('[data-profile-since]').textContent = t('account.since', { date: fmtDate(user.createdAt, { month: 'long', year: 'numeric' }) });
}

$('[data-avatar-btn]').addEventListener('click', () => $('[data-avatar-input]').click());
$('[data-avatar-input]').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const fd = new FormData();
  fd.append('avatar', file);
  const btn = $('[data-avatar-btn]');
  btn.classList.add('is-loading');
  try {
    const res = await api.post('/account/avatar', fd);
    user = { ...user, avatar: res.avatar };
    store.user = user;
    store.emit('user', user);
    renderProfile();
    toast.success(t('account.avatarUpdated'));
  } catch (err) {
    toast.error(err.message);
  } finally {
    btn.classList.remove('is-loading');
  }
});

$('[data-logout]').addEventListener('click', async () => {
  try {
    await api.post('/auth/logout');
  } finally {
    location.href = '/';
  }
});

// ---------- Меню ----------
function renderNav(activeId) {
  els.nav.innerHTML = `<ul>${allSections()
    .map((s) => {
      const href = s.href || `/account${s.path ? `/${s.path}` : ''}`;
      const count = s.badge ? store.counts[s.badge] : 0;
      return `<li class="${s.staff ? 'acc-nav__staff' : ''}"><a class="acc-nav__link ${s.id === activeId ? 'is-active' : ''}" href="${href}" ${s.href ? '' : 'data-acc-link'} ${s.id === activeId ? 'aria-current="page"' : ''}>
        ${icon(s.icon, 'icon icon--sm')}<span>${esc(t(`account.nav.${s.id}`))}</span>${count ? `<b class="acc-nav__badge t-mono">${count}</b>` : ''}</a></li>`;
    })
    .join('')}</ul>`;
}

// ---------- Роутер ----------
function resolve() {
  const parts = location.pathname.replace(/^\/account\/?/, '').split('/').filter(Boolean);
  const sections = allSections();
  const section = sections.find((s) => s.path === (parts[0] || '')) || sections[0];
  return { section, params: parts.slice(1) };
}

// Контекст для модулей разделов
const ctx = {
  app,
  get user() {
    return user;
  },
  setUser(next) {
    user = { ...user, ...next };
    store.user = user;
    renderProfile();
  },
  setHead({ eyebrow, title, crumbs = [] }) {
    els.eyebrow.textContent = eyebrow || t('account.eyebrow');
    els.title.textContent = title;
    document.title = `${title} — AMFIBIA`;
    renderBreadcrumbs($('[data-breadcrumbs]'), [{ href: '/', label: t('nav.home') }, { href: '/account', label: t('account.eyebrow') }, ...crumbs]);
  },
  navigate(path, { replace = false } = {}) {
    if (replace) history.replaceState(null, '', path);
    else history.pushState(null, '', path);
    render();
  },
  reveal() {
    initReveals(els.view);
    refreshScroll();
  },
};

async function render() {
  const seq = ++renderSeq;
  const { section, params } = resolve();
  renderNav(section.id);
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
  els.view.classList.add('is-leaving');
  try {
    const mod = await import(`../account/${section.module}.js`);
    if (seq !== renderSeq) return;
    ctx.setHead({ title: t(`account.nav.${section.id}`), crumbs: [{ label: t(`account.nav.${section.id}`) }] });
    // Свежий контейнер для каждого раздела: обработчики прошлого раздела не накапливаются
    const fresh = els.view.cloneNode(false);
    els.view.replaceWith(fresh);
    els.view = fresh;
    cleanup = await mod.render(els.view, ctx, params);
  } catch (err) {
    console.error(err);
    els.view.innerHTML = `<p class="notice notice--danger">${esc(err.message)}</p>`;
  }
  if (seq !== renderSeq) return;
  els.view.classList.remove('is-leaving');
  ctx.reveal();
}

// Внутренние ссылки кабинета — без перезагрузки (обработчик раньше, чем шторка переходов на document)
$('.acc').addEventListener('click', (e) => {
  const a = e.target.closest('a[data-acc-link]');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  if (a.getAttribute('href') === location.pathname + location.search) return;
  ctx.navigate(a.getAttribute('href'));
  scrollTo(0, { offset: 0 });
});
window.addEventListener('popstate', render);
store.on('counts', () => renderNav(resolve().section.id));

renderProfile();
await render();
await app.reveal();
onLangChange(() => {
  renderProfile();
  render();
});
