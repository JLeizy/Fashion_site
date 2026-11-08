// Страница бренда /brand/:slug (раздел 6.4 ТЗ). Один шаблон на 15 домов: микростилистика задаётся
// атрибутом data-brand на <body> (brands.css). Данные — GET /api/brands/:slug, каталог — GET /api/products
// с фиксированным фильтром brand (createCatalog). Коллекции — вкладки, режим «лукбук» — полноэкранная листалка.
import { initApp } from '../app.js';
import { $, $$, esc, icon, reducedMotion } from '../core/dom.js';
import { t, loc, onLangChange, countryName, fmtNumber } from '../core/i18n.js';
import api from '../core/api.js';
import { formatPrice, onCurrencyChange } from '../core/currency.js';
import { renderBreadcrumbs } from '../ui/breadcrumbs.js';
import { renderCard, bindCardActions } from '../ui/productCard.js';
import { openQuickView } from '../ui/quickView.js';
import { createCatalog } from '../ui/catalogView.js';
import { initRail } from '../ui/rail.js';
import { openModal } from '../ui/modal.js';
import { hasGsap, refreshScroll, scrollTo, splitAnimate, initReveals } from '../ui/motion.js';

const slug = document.body.dataset.brandPage;
const app = await initApp();
bindCardActions({ onQuickView: (id) => openQuickView(id) });

let data = null;
let catalog = null;
let rail = null;
const pad = (n) => String(n).padStart(2, '0');
const currentCollection = () => Number(new URLSearchParams(location.search).get('collection')) || 0;

// ---------- 01 · Hero ----------
function renderHero() {
  const b = data.brand;
  const s = data.stats;
  document.title = `${b.name} — AMFIBIA`;
  renderBreadcrumbs($('[data-breadcrumbs]'), [
    { href: '/', label: t('nav.home') },
    { href: '/catalog', label: t('nav.brands') },
    { label: b.name },
  ]);
  $('[data-bh-img]').src = b.heroImage;
  $('[data-bh-eyebrow]').textContent = `${t('brand.house')} · ${countryName(b.country)} · ${b.foundedYear}`;
  $('[data-bh-founder]').textContent = t('brand.founder', { name: b.founder });
  $('[data-bh-stats]').innerHTML = [
    [t('brand.statProducts'), fmtNumber(s.products)],
    [t('brand.statFrom'), `<span data-price="${s.minPrice}">${formatPrice(s.minPrice)}</span>`],
    [t('brand.statRating'), s.rating ? `${fmtNumber(s.rating, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ★` : '—'],
    [t('brand.statCategories'), fmtNumber(s.categories)],
  ]
    .map(([k, v]) => `<div><dt class="t-mono">${esc(k)}</dt><dd>${v}</dd></div>`)
    .join('');
  const history = $('[data-bh-history]');
  history.href = `/history/${b.slug}`;
  history.title = b.hasHistory ? '' : t('brand.historySoon');
  const prev = $('[data-bh-prev]');
  const next = $('[data-bh-next]');
  prev.href = `/brand/${data.prev.slug}`;
  $('span', prev).textContent = data.prev.name;
  next.href = `/brand/${data.next.slug}`;
  $('span', next).textContent = data.next.name;
  const bnext = $('[data-bnext]');
  bnext.href = `/brand/${data.next.slug}`;
  bnext.dataset.brand = data.next.slug;
  $('[data-bnext-name]').textContent = data.next.name;
  $('[data-bnext-name]').className = 'bnext__name b-title';
}

// «Подпись» дома в hero: круглая печать (город и год) + особые знаки отдельных брендов — только текстом и
// типографикой, без логотипов и фирменных принтов (раздел 10.5 ТЗ)
const CITY = {
  balenciaga: 'Paris', vetements: 'Paris', gucci: 'Firenze', prada: 'Milano', 'enfants-riches-deprimes': 'Los Angeles',
  avavav: 'Firenze', supreme: 'New York', 'chrome-hearts': 'Los Angeles', 'louis-vuitton': 'Paris', chanel: 'Paris',
  'maison-margiela': 'Paris', givenchy: 'Paris', versace: 'Milano', 'alexander-mcqueen': 'London', 'loro-piana': 'Quarona',
};
function renderSignature() {
  const b = data.brand;
  const text = `${b.name} • ${CITY[b.slug] || countryName(b.country)} • ${b.foundedYear} • Amfibia • `.toUpperCase();
  let special = '';
  if (b.slug === 'maison-margiela') {
    special = `<div class="bsig-nums t-mono" aria-hidden="true">${Array.from({ length: 24 }, (_, n) => `<span class="${n === 1 || n === 10 || n === 22 ? 'is-on' : ''}">${n}</span>`).join('')}</div>`;
  } else if (b.slug === 'vetements') {
    special = '<div class="bsig-tag" aria-hidden="true">VETEMENTS<br><small>Édition limitée — Paris</small></div>';
  } else if (b.slug === 'supreme') {
    special = `<div class="bsig-box" aria-hidden="true"><span class="b-box">${esc(b.name)}</span></div>`;
  } else if (b.slug === 'enfants-riches-deprimes') {
    special = '<div class="bsig-scrawl" aria-hidden="true">rich &amp; depressed —<br>since 2012</div>';
  }
  $('[data-bh-sig]').innerHTML = `
    <svg class="bsig-seal" viewBox="0 0 200 200" aria-hidden="true">
      <defs><path id="seal-path" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0"/></defs>
      <circle cx="100" cy="100" r="96" class="bsig-seal__ring"/><circle cx="100" cy="100" r="60" class="bsig-seal__ring"/>
      <text class="bsig-seal__text"><textPath href="#seal-path" startOffset="0">${esc(text)}</textPath></text>
      <text x="100" y="112" text-anchor="middle" class="bsig-seal__year">${b.foundedYear}</text>
    </svg>${special}`;
}

function animateHero() {
  if (!hasGsap() || reducedMotion()) return;
  const gsap = window.gsap;
  splitAnimate($('[data-bh-name]'), { scroll: false, delay: 0.2 });
  gsap.fromTo('[data-bh-media]', { clipPath: 'inset(18% 10% 18% 10%)', scale: 1.15 }, { clipPath: 'inset(0% 0% 0% 0%)', scale: 1, duration: 1.8, ease: 'expo.inOut' });
  gsap.fromTo('.bh__eyebrow, .bh__founder, .bh__stats > div, .bh__actions > *', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.06, delay: 0.6 });
  gsap.to('[data-bh-media] img', { yPercent: 18, ease: 'none', scrollTrigger: { trigger: '[data-bh]', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('[data-bh-name]', { yPercent: -40, ease: 'none', scrollTrigger: { trigger: '[data-bh]', start: 'top top', end: 'bottom top', scrub: true } });
}

// ---------- 02 · О доме + креативные директора ----------
function renderAbout() {
  const text = loc(data.brand.shortDesc);
  $('[data-babout-text]').innerHTML = text ? `<span class="babout__drop b-title" aria-hidden="true">${esc(text[0])}</span><span class="sr-only">${esc(text[0])}</span>${esc(text.slice(1))}` : '';
  $('[data-lineage-wrap]').hidden = !data.directors.length;
  $('[data-lineage]').innerHTML = data.directors
    .map(
      (d, i) => `<li class="lineage__item" data-reveal>
        <span class="lineage__years t-mono">${d.yearsFrom} — ${d.yearsTo || esc(t('brand.present'))}</span>
        <span class="lineage__dot" aria-hidden="true"></span>
        <span class="lineage__photo"><img src="${esc(d.photo || '')}" alt="" loading="lazy"></span>
        <span class="lineage__name">${esc(d.name)}</span>
        <span class="lineage__n t-mono" aria-hidden="true">${pad(i + 1)}</span>
      </li>`
    )
    .join('');
}

// ---------- 03 · Коллекции ----------
function renderTabs() {
  const active = currentCollection();
  const tabs = [{ id: 0, label: t('brand.allCollections'), isNew: false }, ...data.collections.map((c) => ({ id: c.id, label: c.name, isNew: c.isNew, count: c.productsCount }))];
  $('[data-col-tabs]').innerHTML = tabs
    .map(
      (tab) => `<button type="button" class="tab" role="tab" id="col-tab-${tab.id}" aria-controls="col-panel" aria-selected="${tab.id === active}" data-col="${tab.id}">
        ${esc(tab.label)}${tab.isNew ? ` <span class="bcols__new">${esc(t('brand.newBadge'))}</span>` : ''}${tab.count !== undefined ? ` <span class="t-muted">${tab.count}</span>` : ''}</button>`
    )
    .join('');
  renderPanel();
}

function renderPanel() {
  const id = currentCollection();
  const panel = $('[data-col-panel]');
  panel.id = 'col-panel';
  panel.setAttribute('role', 'tabpanel');
  panel.setAttribute('aria-labelledby', `col-tab-${id}`);
  const list = id ? data.collections.filter((c) => c.id === id) : data.collections;
  panel.innerHTML = `<div class="bcols__grid ${id ? 'is-single' : ''}">${list
    .map(
      (c, i) => `<article class="bcol" data-reveal>
        <button type="button" class="bcol__media" data-lookbook="${c.id}" aria-label="${esc(`${t('brand.openLookbook')}: ${c.name}`)}" data-cursor-view>
          <img src="${esc(c.cover)}" alt="" loading="lazy">
          <span class="bcol__badge t-mono">${esc(t('brand.lookbook'))} ${icon('i-expand', 'icon icon--xs')}</span>
        </button>
        <div class="bcol__info">
          <span class="bcol__n t-mono">${pad(i + 1)}</span>
          <h3 class="bcol__name b-title">${esc(c.name)}</h3>
          <p class="bcol__meta t-mono">${esc(t(`seasons.${c.season}`))} ${c.year} · ${esc(t('brand.collectionItems', { n: c.productsCount }))}</p>
          <div class="bcol__actions">
            <button type="button" class="btn btn--sm" data-lookbook="${c.id}">${esc(t('brand.openLookbook'))}</button>
            <button type="button" class="btn btn--sm btn--ghost" data-col-catalog="${c.id}">${esc(t('brand.showInCatalog'))}</button>
          </div>
        </div>
      </article>`
    )
    .join('')}</div>`;
  initReveals(panel);
  refreshScroll();
}

// Выбор коллекции: параметр ?collection= в URL; каталог перечитывает URL по событию popstate
function selectCollection(id, { scrollToCatalog = false } = {}) {
  const params = new URLSearchParams(location.search);
  if (id) params.set('collection', String(id));
  else params.delete('collection');
  params.delete('page');
  const qs = params.toString();
  history.pushState(null, '', `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
  $$('[data-col]').forEach((b) => b.setAttribute('aria-selected', String(Number(b.dataset.col) === id)));
  renderPanel();
  if (scrollToCatalog) scrollTo($('#brand-catalog'), { offset: -80 });
}

document.addEventListener('click', (e) => {
  const tab = e.target.closest('[data-col]');
  if (tab) return selectCollection(Number(tab.dataset.col));
  const look = e.target.closest('[data-lookbook]');
  if (look) return openLookbook(Number(look.dataset.lookbook));
  const toCat = e.target.closest('[data-col-catalog]');
  if (toCat) selectCollection(Number(toCat.dataset.colCatalog), { scrollToCatalog: true });
});
$('[data-col-tabs]').addEventListener('keydown', (e) => {
  if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  const tabs = $$('[data-col]');
  const i = tabs.indexOf(document.activeElement);
  const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
  next.focus();
  next.click();
});

// ---------- Лукбук: полноэкранная листалка образов коллекции ----------
function openLookbook(collectionId) {
  const col = data.collections.find((c) => c.id === collectionId);
  if (!col || !col.looks.length) return;
  const looks = col.looks;
  let index = 0;
  const holder = document.createElement('div');
  holder.className = 'lookbook';
  holder.dataset.brand = data.brand.slug;
  holder.innerHTML = `
    <header class="lookbook__head">
      <p class="t-eyebrow">${esc(data.brand.name)} · ${esc(t('brand.lookbook'))}</p>
      <h2 class="lookbook__title b-title" id="lookbook-title">${esc(col.name)}</h2>
    </header>
    <div class="lookbook__stage">
      <div class="lookbook__track" data-lb-track>${looks
        .map(
          (l, i) => `<figure class="look" data-look="${i}">
            <span class="look__img"><img src="${esc(l.image)}" alt="${esc(l.id ? loc(l.name) : `${col.name} — ${t('brand.runwayLook', { n: l.lookNumber })}`)}" ${i > 2 ? 'loading="lazy"' : ''}></span>
            <figcaption class="look__cap">
              <span class="look__n t-mono">${esc(t('brand.lookOf', { i: i + 1, n: looks.length }))}</span>
              ${
                l.id
                  ? `<a class="look__name link-u" href="/product/${l.id}">${esc(loc(l.name))}</a>
              <span class="look__price t-mono" data-price="${l.price}">${formatPrice(l.price)}</span>`
                  : `<span class="look__name">${esc(`${data.brand.name} — ${col.name}`)}</span>
              <span class="look__price t-mono">${esc(t('brand.runwayCredit', { n: l.lookNumber }))}</span>`
              }
            </figcaption>
          </figure>`
        )
        .join('')}</div>
    </div>
    <div class="lookbook__nav">
      <button type="button" class="icon-btn" data-lb-prev aria-label="${esc(t('product.prevImage'))}">${icon('i-arrow-left')}</button>
      <div class="lookbook__progress"><span data-lb-bar></span></div>
      <span class="lookbook__count t-mono" data-lb-count></span>
      <button type="button" class="icon-btn" data-lb-next aria-label="${esc(t('product.nextImage'))}">${icon('i-arrow-right')}</button>
    </div>`;
  const modal = openModal({ size: 'full', content: holder, className: 'modal--lookbook', labelledBy: 'lookbook-title' });
  const track = $('[data-lb-track]', holder);
  const show = (i) => {
    index = Math.max(0, Math.min(looks.length - 1, i));
    const target = $(`[data-look="${index}"]`, track);
    const offset = target.offsetLeft - (track.parentElement.clientWidth - target.offsetWidth) / 2;
    track.style.transform = `translate3d(${-offset}px, 0, 0)`;
    $$('.look', track).forEach((el, n) => el.classList.toggle('is-active', n === index));
    $('[data-lb-count]', holder).textContent = `${pad(index + 1)} / ${pad(looks.length)}`;
    $('[data-lb-bar]', holder).style.transform = `scaleX(${(index + 1) / looks.length})`;
    $('[data-lb-prev]', holder).disabled = index === 0;
    $('[data-lb-next]', holder).disabled = index === looks.length - 1;
  };
  holder.addEventListener('click', (e) => {
    if (e.target.closest('[data-lb-prev]')) show(index - 1);
    else if (e.target.closest('[data-lb-next]')) show(index + 1);
    else {
      const look = e.target.closest('[data-look]');
      if (look && !e.target.closest('a') && Number(look.dataset.look) !== index) show(Number(look.dataset.look));
    }
  });
  const onKey = (e) => {
    if (e.key === 'ArrowRight') show(index + 1);
    if (e.key === 'ArrowLeft') show(index - 1);
  };
  document.addEventListener('keydown', onKey);
  // Колесо и свайп листают образы
  let wheelLock = false;
  holder.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      if (wheelLock) return;
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(delta) < 8) return;
      wheelLock = true;
      show(index + (delta > 0 ? 1 : -1));
      setTimeout(() => (wheelLock = false), 650);
    },
    { passive: false }
  );
  let sx = null;
  holder.addEventListener('pointerdown', (e) => (sx = e.clientX));
  holder.addEventListener('pointerup', (e) => {
    if (sx === null) return;
    const dx = e.clientX - sx;
    sx = null;
    if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
  });
  const close = modal.close.bind(modal);
  modal.close = () => {
    document.removeEventListener('keydown', onKey);
    close();
  };
  window.addEventListener('resize', () => show(index), { passive: true });
  requestAnimationFrame(() => show(0));
}

// ---------- 04 · Культовые модели ----------
function renderIconic() {
  const section = $('[data-rail="iconic"]');
  section.hidden = !data.iconic.length;
  if (!data.iconic.length) return;
  $('[data-rail-track]', section).innerHTML = data.iconic.map((p) => `<div class="rail__item">${renderCard(p)}</div>`).join('');
  rail ||= initRail(section);
  rail?.update();
}

function renderAll() {
  renderHero();
  renderSignature();
  renderAbout();
  renderTabs();
  renderIconic();
}

async function main() {
  try {
    data = await api.get(`/brands/${slug}`);
  } catch (err) {
    $('[data-bh-name]').textContent = err.message;
    await app.reveal();
    return;
  }
  renderAll();
  // Каталог бренда: фильтр по бренду фиксирован, остальные фильтры — как в общем каталоге
  catalog = createCatalog($('[data-catalog]'), {
    fixed: { brand: [slug] },
    scrollOffset: -90,
    onResult: (_, state) => {
      const id = state.collection.length === 1 ? Number(state.collection[0]) : 0;
      $$('[data-col]').forEach((b) => b.setAttribute('aria-selected', String(Number(b.dataset.col) === id)));
    },
  });
  await catalog.init();
  await app.reveal();
  animateHero();
  window.addEventListener('popstate', () => renderPanel());
  if (location.hash === '#collections' || location.hash === '#brand-catalog') {
    setTimeout(() => scrollTo($(location.hash), { offset: -80 }), 300);
  }
  onLangChange(() => {
    renderAll();
    refreshScroll();
  });
  onCurrencyChange(() => renderHero());
}

main();
