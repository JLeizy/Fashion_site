// Страница общего каталога /catalog (раздел 6.6 ТЗ).
import { initApp } from '../app.js';
import { $ } from '../core/dom.js';
import { t, loc, onLangChange } from '../core/i18n.js';
import { createCatalog } from '../ui/catalogView.js';
import { renderBreadcrumbs } from '../ui/breadcrumbs.js';
import { getCategories, getBrands } from '../ui/catalogCache.js';

const app = await initApp();
const [categories, brands] = await Promise.all([getCategories(), getBrands()]);
let lastState = null;

// Заголовок, подпись и крошки зависят от текущих фильтров
function describe(state) {
  const crumbs = [
    { href: '/', label: t('nav.home') },
    { href: '/catalog', label: t('nav.catalog') },
  ];
  let title = t('catalog.title');
  let eyebrow = t('catalog.eyebrow');
  let bg = 'Catalogue';
  const findCategory = (slug) => {
    for (const root of categories) {
      if (root.slug === slug) return { node: root, parent: null };
      const child = root.children.find((c) => c.slug === slug);
      if (child) return { node: child, parent: root };
    }
    return null;
  };
  if (state.q) {
    title = t('catalog.searchTitle', { q: state.q });
    eyebrow = t('catalog.search');
    crumbs.push({ label: t('catalog.search') });
    bg = state.q;
  } else if (state.category.length === 1 && findCategory(state.category[0])) {
    const { node, parent } = findCategory(state.category[0]);
    if (parent) crumbs.push({ href: `/catalog?category=${parent.slug}`, label: loc(parent.name) });
    title = loc(node.name);
    eyebrow = parent ? loc(parent.name) : t('catalog.eyebrow');
    crumbs.push({ label: title });
    bg = node.name.en;
  } else if (state.brand.length === 1) {
    const brand = brands.find((b) => b.slug === state.brand[0]);
    title = brand?.name || state.brand[0];
    crumbs.push({ label: title });
    bg = title;
  } else if (state.new) {
    title = t('catalog.newTitle');
    crumbs.push({ label: title });
    bg = 'Nouveautés';
  } else if (state.sale) {
    title = t('catalog.saleTitle');
    crumbs.push({ label: title });
    bg = 'Soldes';
  } else if (state.limited) {
    title = t('catalog.limitedTitle');
    crumbs.push({ label: title });
    bg = 'Limited';
  } else if (state.iconic) {
    title = t('catalog.iconicTitle');
    crumbs.push({ label: title });
    bg = 'Icônes';
  }
  return { crumbs, title, eyebrow, bg };
}

function updateHero(state) {
  const { crumbs, title, eyebrow, bg } = describe(state);
  renderBreadcrumbs($('[data-breadcrumbs]'), crumbs);
  $('[data-catalog-title]').textContent = title;
  $('[data-catalog-eyebrow]').textContent = eyebrow;
  $('[data-catalog-bg]').textContent = bg;
  document.title = `${title} — AMFIBIA`;
}

const catalog = createCatalog($('[data-catalog]'), {
  onResult: (data, state) => {
    lastState = state;
    updateHero(state);
  },
});
updateHero(catalog.state());
await catalog.init();
onLangChange(() => lastState && updateHero(lastState));
await app.reveal();
