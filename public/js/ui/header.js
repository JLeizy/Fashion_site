// Шапка сайта (раздел 6.1 ТЗ): логотип с анимацией, мега-меню брендов и категорий, переключатели
// языка / валюты / темы, счётчики избранного, сравнения и корзины, уведомления, мобильное меню.
import { $, $$, esc, initials, isTouch, showAnimated, hideAnimated } from '../core/dom.js';
import { t, loc, getLang, setLang, onLangChange, fmtRelative } from '../core/i18n.js';
import { getCurrency, setCurrency } from '../core/currency.js';
import { getTheme, setTheme } from '../core/theme.js';
import { store, isAuth, requireAuth } from '../core/store.js';
import api from '../core/api.js';
import { getBrands, getCategories } from './catalogCache.js';
import { stopScroll, startScroll } from './motion.js';
import { toast } from './toast.js';

let notifTimer = null;

export function initHeader() {
  splitLogo();
  initDropdowns();
  initPrefs();
  initMega();
  initMobileMenu();
  initCounters();
  initAccount();
  initNotifications();
  initAuthLinks();
  markActiveNav();
}

// Логотип: каждая буква — отдельный span для анимации при наведении
function splitLogo() {
  const el = $('[data-logo-text]');
  if (!el || el.dataset.logoSplit) return;
  el.dataset.logoSplit = '1';
  el.innerHTML = [...el.textContent.trim()].map((ch, i) => `<span class="ch" style="--i:${i}">${esc(ch)}</span>`).join('');
}

// ---------- Выпадающие меню (валюта, тема) ----------
function closeDropdowns(except = null) {
  $$('[data-dropdown].is-open').forEach((dd) => {
    if (dd === except) return;
    dd.classList.remove('is-open');
    dd.querySelector(':scope > button')?.setAttribute('aria-expanded', 'false');
  });
}
function initDropdowns() {
  $$('[data-dropdown]').forEach((dd) => {
    const toggle = dd.querySelector(':scope > button');
    toggle?.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = !dd.classList.contains('is-open');
      closeDropdowns(dd);
      dd.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    });
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-dropdown]')) closeDropdowns();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDropdowns();
  });
}

// ---------- Язык, валюта, тема ----------
function syncPrefs() {
  $$('[data-lang-set]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.langSet === getLang())));
  $$('[data-currency-set]').forEach((b) => b.setAttribute(b.getAttribute('role') ? 'aria-checked' : 'aria-pressed', String(b.dataset.currencySet === getCurrency())));
  $$('[data-currency-label]').forEach((el) => {
    el.textContent = getCurrency();
  });
  $$('[data-theme-set]').forEach((b) => b.setAttribute(b.getAttribute('role') ? 'aria-checked' : 'aria-pressed', String(b.dataset.themeSet === getTheme())));
}

// У авторизованного пользователя выбор сохраняется ещё и в профиле (users.preferred_*)
function savePreference(patch) {
  if (isAuth()) api.patch('/profile/preferences', patch).catch(() => {});
}

function initPrefs() {
  syncPrefs();
  document.addEventListener('click', async (e) => {
    const langBtn = e.target.closest('[data-lang-set]');
    if (langBtn) {
      await setLang(langBtn.dataset.langSet);
      savePreference({ lang: langBtn.dataset.langSet });
      syncPrefs();
      return;
    }
    const currencyBtn = e.target.closest('[data-currency-set]');
    if (currencyBtn) {
      setCurrency(currencyBtn.dataset.currencySet);
      savePreference({ currency: currencyBtn.dataset.currencySet });
      closeDropdowns();
      syncPrefs();
      return;
    }
    const themeBtn = e.target.closest('[data-theme-set]');
    if (themeBtn) {
      const r = themeBtn.getBoundingClientRect();
      setTheme(themeBtn.dataset.themeSet, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
      savePreference({ theme: themeBtn.dataset.themeSet });
      closeDropdowns();
      setTimeout(syncPrefs, 50);
    }
  });
  document.addEventListener('amf:themechange', syncPrefs);
  document.addEventListener('amf:currencychange', syncPrefs);
}

// ---------- Мега-меню ----------
async function renderMegaBrands() {
  const list = $('[data-mega-brands]');
  if (!list) return;
  const brands = await getBrands();
  list.innerHTML = brands
    .map(
      (b) => `<li><a class="mega__brand" href="/brand/${esc(b.slug)}" data-brand-slug="${esc(b.slug)}">
        <span>${esc(b.name)}</span><small>${b.foundedYear}</small></a></li>`
    )
    .join('');
  const preview = (slug) => {
    const b = brands.find((x) => x.slug === slug);
    if (!b) return;
    $$('.mega__brand', list).forEach((a) => a.classList.toggle('is-active', a.dataset.brandSlug === slug));
    const img = $('[data-mega-preview-img]');
    if (img && img.getAttribute('src') !== b.heroImage) {
      img.classList.remove('is-entering');
      img.src = b.heroImage;
      img.alt = b.name;
      void img.offsetWidth;
      img.classList.add('is-entering');
    }
    $('[data-mega-preview-name]').textContent = b.name;
    $('[data-mega-preview-meta]').textContent = `EST. ${b.foundedYear} · ${b.country}`;
    $('[data-mega-preview-desc]').textContent = loc(b.shortDesc);
    $('[data-mega-preview-catalog]').href = `/brand/${b.slug}`;
    $('[data-mega-preview-history]').href = `/history/${b.slug}`;
  };
  list.addEventListener('mouseover', (e) => {
    const a = e.target.closest('[data-brand-slug]');
    if (a) preview(a.dataset.brandSlug);
  });
  list.addEventListener('focusin', (e) => {
    const a = e.target.closest('[data-brand-slug]');
    if (a) preview(a.dataset.brandSlug);
  });
  preview(brands[0]?.slug);
}

async function renderMegaCategories() {
  const root = $('[data-mega-categories]');
  if (!root) return;
  const categories = await getCategories();
  root.innerHTML = categories
    .map(
      (c, i) => `<div class="mega__cat">
        <a class="mega__cat-title link-u" href="/catalog?category=${esc(c.slug)}"><span class="t-mono">0${i + 1}</span><span>${esc(loc(c.name))}</span></a>
        <ul class="mega__cat-list">${c.children
          .map((s) => `<li><a href="/catalog?category=${esc(s.slug)}">${esc(loc(s.name))} <span class="t-muted t-mono">${s.count}</span></a></li>`)
          .join('')}</ul></div>`
    )
    .join('');
}

function initMega() {
  const header = $('[data-header]');
  const toggles = $$('[data-mega-toggle]');
  const panels = $$('[data-mega-panel]');
  if (!header || !toggles.length) return;
  let current = null;
  let closeTimer = null;
  let openedAt = 0;
  const loaded = {};

  const open = (name) => {
    clearTimeout(closeTimer);
    if (current === name) return;
    current = name;
    openedAt = Date.now();
    if (!loaded[name]) {
      loaded[name] = true;
      (name === 'brands' ? renderMegaBrands() : renderMegaCategories()).catch((err) => console.error(err));
    }
    panels.forEach((p) => {
      if (p.dataset.megaPanel === name) showAnimated(p);
      else hideAnimated(p, 700);
    });
    toggles.forEach((tg) => tg.setAttribute('aria-expanded', String(tg.dataset.megaToggle === name)));
    header.classList.add('is-mega-open');
  };
  const close = () => {
    if (!current) return;
    current = null;
    panels.forEach((p) => hideAnimated(p, 700));
    toggles.forEach((tg) => tg.setAttribute('aria-expanded', 'false'));
    header.classList.remove('is-mega-open');
  };

  toggles.forEach((tg) => {
    // Клик сразу после открытия наведением не должен закрывать меню
    tg.addEventListener('click', () => {
      if (current === tg.dataset.megaToggle) {
        if (Date.now() - openedAt > 600) close();
      } else open(tg.dataset.megaToggle);
    });
    tg.addEventListener('mouseenter', () => {
      if (!isTouch()) open(tg.dataset.megaToggle);
    });
  });
  $$('.header__nav > a, .header__actions, .logo').forEach((el) => el.addEventListener('mouseenter', close));
  header.addEventListener('mouseleave', () => {
    closeTimer = setTimeout(close, 260);
  });
  header.addEventListener('mouseenter', () => clearTimeout(closeTimer));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
  document.addEventListener('click', (e) => {
    if (current && !e.target.closest('[data-header]')) close();
  });
  onLangChange(() => {
    if (loaded.brands) renderMegaBrands();
    if (loaded.categories || loaded.catalog) renderMegaCategories();
  });
}

// ---------- Мобильное меню ----------
function initMobileMenu() {
  const btn = $('[data-burger]');
  const menu = $('[data-mobile-menu]');
  if (!btn || !menu) return;
  let filled = false;
  const fill = async () => {
    if (filled) return;
    filled = true;
    const [brands, categories] = await Promise.all([getBrands(), getCategories()]);
    $('[data-mobile-brands]').innerHTML = brands.map((b) => `<li><a href="/brand/${esc(b.slug)}">${esc(b.name)}</a></li>`).join('');
    $('[data-mobile-categories]').innerHTML = categories
      .map((c) => `<li><a href="/catalog?category=${esc(c.slug)}">${esc(loc(c.name))}</a></li>`)
      .join('');
  };
  const setIcon = (name) => btn.querySelector('use')?.setAttribute('href', `#${name}`);
  const open = () => {
    fill().catch(console.error);
    showAnimated(menu);
    btn.setAttribute('aria-expanded', 'true');
    setIcon('i-close');
    stopScroll();
  };
  const close = () => {
    menu.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
    setIcon('i-menu');
    startScroll();
    setTimeout(() => {
      if (!menu.classList.contains('is-open')) menu.hidden = true;
    }, 900);
  };
  btn.addEventListener('click', () => (menu.classList.contains('is-open') ? close() : open()));
  menu.addEventListener('click', (e) => {
    if (e.target.closest('a')) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('is-open')) close();
  });
  onLangChange(() => {
    filled = false;
    if (menu.classList.contains('is-open')) fill();
  });
}

// ---------- Счётчики (избранное, сравнение, корзина, уведомления) ----------
function renderCounts(changed) {
  $$('[data-count]').forEach((el) => {
    const n = store.counts[el.dataset.count] || 0;
    const text = n > 99 ? '99+' : String(n);
    const prev = el.textContent;
    el.textContent = text;
    el.hidden = n === 0;
    if (changed && changed !== '*' && el.dataset.count === changed && prev !== text) {
      el.classList.remove('is-bump');
      void el.offsetWidth;
      el.classList.add('is-bump');
    }
  });
}
function initCounters() {
  renderCounts('*');
  store.on('counts', ({ name }) => renderCounts(name));
}

// ---------- Профиль ----------
function renderAccount(user) {
  $$('[data-account-link]').forEach((a) => {
    a.href = user ? '/account' : '/auth';
  });
  const avatar = $('[data-account-avatar]');
  const iconEl = $('[data-account-icon]');
  if (avatar && iconEl) {
    if (user) {
      avatar.hidden = false;
      iconEl.style.display = 'none';
      avatar.innerHTML = user.avatar ? `<img src="${esc(user.avatar)}" alt="">` : esc(initials(user.firstName, user.lastName));
      avatar.title = `${user.firstName} ${user.lastName}`.trim();
    } else {
      avatar.hidden = true;
      iconEl.style.display = '';
    }
  }
  const notif = $('[data-notifications]');
  if (notif) notif.hidden = !user;
}
function initAccount() {
  renderAccount(store.user);
  store.on('user', renderAccount);
}

// ---------- Уведомления ----------
function renderNotifications(items) {
  const list = $('[data-notif-list]');
  if (!list) return;
  if (!items.length) {
    list.innerHTML = `<li class="notif__empty">${esc(t('notifications.empty'))}</li>`;
    return;
  }
  list.innerHTML = items
    .map(
      (n) => `<li><a class="notif__item ${n.isRead ? '' : 'is-unread'}" href="${esc(n.link || '/account/notifications')}" data-notif-id="${n.id}">
        <time datetime="${esc(n.createdAt)}">${esc(fmtRelative(n.createdAt))}</time>
        <span class="notif__item-title">${esc(loc(n.title))}</span>
        <span class="notif__item-text">${esc(loc(n.text))}</span></a></li>`
    )
    .join('');
}
async function pollUnread() {
  if (!isAuth()) return;
  try {
    const { count } = await api.get('/notifications/unread-count');
    if (count > store.counts.notifications) toast.info(t('notifications.new'), '', { duration: 3000 });
    store.counts.notifications = count;
    store.emit('counts', { name: 'notifications' });
  } catch {
    /* сеть недоступна — попробуем позже */
  }
}
function initNotifications() {
  const root = $('[data-notifications]');
  if (!root) return;
  const toggle = $('[data-notif-toggle]', root);
  const panel = $('[data-notif-panel]', root);
  const close = () => {
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  };
  toggle.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!panel.hidden) return close();
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    $('[data-notif-list]', root).innerHTML = `<li class="notif__empty">${esc(t('common.loading'))}</li>`;
    try {
      const data = await api.get('/notifications', { limit: 8 });
      renderNotifications(data.items);
    } catch (err) {
      $('[data-notif-list]', root).innerHTML = `<li class="notif__empty">${esc(err.message)}</li>`;
    }
  });
  $('[data-notif-read-all]', root)?.addEventListener('click', async () => {
    await api.post('/notifications/read-all');
    store.counts.notifications = 0;
    store.emit('counts', { name: 'notifications' });
    $$('.notif__item.is-unread', root).forEach((el) => el.classList.remove('is-unread'));
  });
  panel.addEventListener('click', (e) => {
    const item = e.target.closest('[data-notif-id]');
    if (item && item.classList.contains('is-unread')) api.post(`/notifications/${item.dataset.notifId}/read`).catch(() => {});
  });
  document.addEventListener('click', (e) => {
    if (!panel.hidden && !e.target.closest('[data-notifications]')) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) close();
  });
  clearInterval(notifTimer);
  notifTimer = setInterval(pollUnread, 60_000);
}

// Ссылки, требующие входа (избранное): гостю — модальное окно входа
function initAuthLinks() {
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-requires-auth]');
    if (!link || isAuth()) return;
    e.preventDefault();
    requireAuth('wishlist');
  });
}

function markActiveNav() {
  const path = location.pathname;
  $$('[data-bottom-nav]').forEach((a) => {
    const href = a.getAttribute('href');
    const active = href === '/' ? path === '/' : path.startsWith(href);
    if (active) a.setAttribute('aria-current', 'page');
  });
  $$('.header__nav a').forEach((a) => {
    if (a.getAttribute('href') === path + location.search) a.setAttribute('aria-current', 'page');
  });
}
