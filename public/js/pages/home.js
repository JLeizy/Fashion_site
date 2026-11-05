// Главная страница (раздел 6.3 ТЗ). Данные — одним запросом GET /api/home (server/routes/api/home.js),
// список брендов — из кэша справочников (/api/brands).
// Блоки: hero-слайдер (WebGL), бегущая строка, горизонтальная лента коллекций (GSAP pin), сетка брендов,
// новинки, культовые вещи, манифест со следом изображений, истории брендов, подборки, преимущества, рассылка (подвал).
import { initApp } from '../app.js';
import { $, $$, esc, icon, isTouch, reducedMotion, perfLow, onPerfLow } from '../core/dom.js';
import { t, loc, onLangChange, countryName } from '../core/i18n.js';
import api from '../core/api.js';
import { formatPrice } from '../core/currency.js';
import { renderCard, bindCardActions } from '../ui/productCard.js';
import { openQuickView } from '../ui/quickView.js';
import { getBrands } from '../ui/catalogCache.js';
import { createHeroSlider } from '../ui/heroSlider.js';
import { initImageTrail } from '../ui/imageTrail.js';
import { initMarquee } from '../ui/marquee.js';
import { initRail } from '../ui/rail.js';
import { hasGsap, refreshScroll, initReveals } from '../ui/motion.js';

const app = await initApp();
bindCardActions({ onQuickView: (id) => openQuickView(id) });

const pad = (n) => String(n).padStart(2, '0');
const SEASONS = { FW: 'Fall — Winter', SS: 'Spring — Summer', Resort: 'Resort', 'Pre-Fall': 'Pre-Fall' };

let data = null;
let brands = [];
let slider = null;

// ---------- 01 · Hero ----------
function renderHeroText(i, animate = true) {
  const s = data.banners[i];
  if (!s) return;
  const title = $('[data-hero-title]');
  const brand = $('[data-hero-brand]');
  $('[data-hero-num]').textContent = pad(i + 1);
  $('[data-hero-current]').textContent = pad(i + 1);
  $('[data-hero-collection]').textContent = s.collection ? `${s.collection.name} · ${SEASONS[s.collection.season] || s.collection.season}` : 'Amfibia';
  brand.textContent = s.brand?.name || '';
  if (s.brand) brand.closest('.hero').dataset.brand = s.brand.slug;
  $('[data-hero-subtitle]').textContent = loc(s.subtitle);
  $('[data-hero-link]').href = s.link || '/catalog';
  $$('[data-hero-index] button').forEach((b, n) => b.setAttribute('aria-current', String(n === i)));
  title.textContent = loc(s.title);
  title.classList.remove('is-split');
  if (animate && !reducedMotion() && window.SplitType && window.gsap) {
    const split = new window.SplitType(title, { types: 'words,chars' });
    window.gsap.fromTo(split.chars, { yPercent: 115, opacity: 0, rotate: 8 }, { yPercent: 0, opacity: 1, rotate: 0, duration: 1.2, ease: 'expo.out', stagger: 0.022, delay: 0.25 });
    window.gsap.fromTo([brand, $('[data-hero-subtitle]')], { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'expo.out', stagger: 0.08, delay: 0.45 });
  }
}

async function initHero() {
  const root = $('[data-hero]');
  const slides = data.banners;
  $('[data-hero-total]').textContent = pad(slides.length);
  $('[data-hero-index]').innerHTML = slides
    .map((s, i) => `<li><button type="button" data-hero-go="${i}" aria-current="${i === 0}" aria-label="${esc(t('home.slideOf', { i: i + 1, n: slides.length }))}"><span class="t-mono">${pad(i + 1)}</span><span class="hero__index-name">${esc(s.brand?.name || loc(s.title))}</span></button></li>`)
    .join('');
  renderHeroText(0, false);
  slider = await createHeroSlider(root, { slides, onChange: (i) => renderHeroText(i) });
  $('[data-hero-next]').addEventListener('click', () => slider.next());
  $('[data-hero-prev]').addEventListener('click', () => slider.prev());
  $('[data-hero-index]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-hero-go]');
    if (b) slider.goTo(Number(b.dataset.heroGo));
  });

  // Параллакс: картинка уходит медленнее страницы и чуть увеличивается, контент — быстрее и гаснет
  if (hasGsap() && !reducedMotion()) {
    const gsap = window.gsap;
    gsap.to('[data-hero-media]', { yPercent: 22, scale: 1.08, ease: 'none', scrollTrigger: { trigger: root, start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero__content', { yPercent: -30, opacity: 0, ease: 'none', scrollTrigger: { trigger: root, start: 'top top', end: '80% top', scrub: true } });
    // Раскрытие изображения через clip-path при первом показе
    gsap.fromTo('[data-hero-media]', { clipPath: 'inset(12% 18% 12% 18%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.8, ease: 'expo.inOut', delay: 0.15 });
  }
}

// ---------- 02 · Бегущая строка ----------
function renderMarquee() {
  const items = brands.map((b) => `<span class="marquee__item" data-brand="${esc(b.slug)}"><a class="b-title" href="/brand/${esc(b.slug)}">${esc(b.name)}</a><svg class="marquee__sep icon--fill" aria-hidden="true"><use href="#orn-cross"/></svg></span>`).join('');
  // Две копии подряд — для бесшовного цикла translateX(-50%)
  $('[data-marquee-brands]').innerHTML = items + items.replace(/<a /g, '<a tabindex="-1" aria-hidden="true" ');
  const reversed = [...brands].reverse().map((b) => `<span class="marquee__item marquee__item--outline">${esc(b.name)}<svg class="marquee__sep icon--fill" aria-hidden="true"><use href="#orn-fleur"/></svg></span>`).join('');
  $('[data-marquee-brands-2]').innerHTML = reversed + reversed;
  $('[data-marquee-brands-2]').setAttribute('aria-hidden', 'true');
  initMarquee($('[data-marquee]'));
}

// ---------- 03 · Новые коллекции (горизонтальная прокрутка с закреплением) ----------
function renderCollections() {
  $('[data-hcol-count]').textContent = t('home.collectionsCount', { n: data.collections.length });
  $('[data-hcol-track]').innerHTML = data.collections
    .map(
      (c, i) => `<a class="hcol__card" href="/brand/${esc(c.brand.slug)}?collection=${c.id}#collections" data-brand="${esc(c.brand.slug)}" data-cursor-view>
        <span class="hcol__n t-mono">${pad(i + 1)}</span>
        <span class="hcol__media"><img src="${esc(c.cover)}" alt="${esc(`${c.brand.name} — ${c.name}`)}" loading="lazy" decoding="async"></span>
        <span class="hcol__info">
          <span class="hcol__brand b-title">${esc(c.brand.name)}</span>
          <span class="hcol__name">${esc(c.name)}</span>
          <span class="hcol__meta t-mono">${esc(t(`seasons.${c.season}`))} ${c.year} · ${esc(t('home.collectionItems', { n: c.productsCount }))}</span>
        </span>
      </a>`
    )
    .join('');
}

let hcolTrigger = null;
function initCollectionsScroll() {
  const section = $('[data-hcol]');
  const track = $('[data-hcol-track]');
  const bar = $('[data-hcol-progress]');
  hcolTrigger?.kill();
  hcolTrigger = null;
  // На телефонах, планшетах и при reduced-motion — обычная горизонтальная прокрутка пальцем
  if (!hasGsap() || reducedMotion() || perfLow() || window.innerWidth < 1024) {
    section.classList.add('is-native');
    track.style.transform = '';
    $('[data-hcol-viewport]').addEventListener(
      'scroll',
      (e) => {
        const el = e.currentTarget;
        bar.style.transform = `scaleX(${el.scrollLeft / Math.max(1, el.scrollWidth - el.clientWidth)})`;
      },
      { passive: true }
    );
    return;
  }
  section.classList.remove('is-native');
  const distance = () => Math.max(0, track.scrollWidth - window.innerWidth + 80);
  const tween = window.gsap.to(track, { x: () => -distance(), ease: 'none' });
  hcolTrigger = window.ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => `+=${distance()}`,
    pin: $('[data-hcol-pin]'),
    scrub: 0.8,
    animation: tween,
    invalidateOnRefresh: true,
    onUpdate: (self) => {
      bar.style.transform = `scaleX(${self.progress})`;
      // Лёгкий наклон карточек от скорости прокрутки
      const skew = Math.max(-6, Math.min(6, self.getVelocity() / -400));
      track.style.setProperty('--skew', `${skew}deg`);
    },
  });
}

// ---------- 04 · Сетка брендов ----------
function renderBrands() {
  $('[data-brands-grid]').innerHTML = brands
    .map(
      (b, i) => `<a class="brand-tile brand-tile" href="/brand/${esc(b.slug)}" data-brand="${esc(b.slug)}" data-reveal data-cursor-view>
        <span class="brand-tile__media"><img src="${esc(b.heroImage)}" alt="" loading="lazy" decoding="async"></span>
        <span class="brand-tile__veil" aria-hidden="true"></span>
        <span class="brand-tile__num t-mono">${pad(i + 1)}</span>
        <span class="brand-tile__name b-title">${esc(b.name)}</span>
        <span class="brand-tile__meta t-mono"><span>${esc(t('home.since', { year: b.foundedYear }))}</span><span>${esc(countryName(b.country))}</span><span>${esc(t('home.brandItems', { n: b.productsCount }))}</span></span>
      </a>`
    )
    .join('');
}

// ---------- 05 · Новинки ----------
let newRail = null;
function renderNew() {
  const section = $('[data-rail="new"]');
  $('[data-rail-track]', section).innerHTML = data.newProducts.map((p, i) => `<div class="rail__item">${renderCard(p, { eager: i < 4 })}</div>`).join('');
  newRail ||= initRail(section);
  newRail?.update();
}

// ---------- 06 · Культовые вещи ----------
function renderIconic() {
  $('[data-iconic]').innerHTML = data.iconic
    .map(
      (p, i) => `<li class="iconic__item ${i % 2 ? 'is-reverse' : ''}" data-brand="${esc(p.brand.slug)}">
        <a class="iconic__media" href="/product/${p.id}" data-cursor-view aria-label="${esc(`${p.brand.name} — ${loc(p.name)}`)}">
          <span class="iconic__clip" data-clip-reveal><img src="${esc(p.images[0])}" alt="" loading="lazy" decoding="async" data-parallax-img></span>
        </a>
        <div class="iconic__text" data-reveal>
          <span class="iconic__n t-mono">${pad(i + 1)} / ${pad(data.iconic.length)}</span>
          <p class="iconic__brand b-title">${esc(p.brand.name)}</p>
          <h3 class="iconic__name">${esc(loc(p.name))}</h3>
          <p class="iconic__desc">${esc(loc(p.description))}</p>
          <p class="iconic__meta t-mono">${esc(t('home.iconicHouse', { year: p.foundedYear }))} · <span data-price="${p.price}">${formatPrice(p.price)}</span></p>
          <a class="btn btn--ghost btn--sm" href="/product/${p.id}">${esc(t('home.iconicView'))} ${icon('i-arrow-right', 'icon icon--sm')}</a>
        </div>
      </li>`
    )
    .join('');
}

function initIconicParallax() {
  if (!hasGsap() || reducedMotion()) return;
  $$('[data-parallax-img]').forEach((img) => {
    window.gsap.fromTo(img, { yPercent: -8, scale: 1.15 }, { yPercent: 8, scale: 1.15, ease: 'none', scrollTrigger: { trigger: img.closest('.iconic__item'), start: 'top bottom', end: 'bottom top', scrub: true } });
  });
}

// ---------- 08 · Истории брендов ----------
function renderStories() {
  $('[data-stories]').innerHTML = data.stories
    .map(
      (b, i) => `<li class="story" data-brand="${esc(b.slug)}" data-reveal>
        <a class="story__link" href="/history/${esc(b.slug)}" data-story-img="${esc(b.image)}">
          <span class="story__year t-mono">${b.foundedYear}</span>
          <span class="story__name b-title">${esc(b.name)}</span>
          <span class="story__desc">${esc(loc(b.shortDesc))}</span>
          <span class="story__founder t-mono">${esc(t('home.founder', { name: b.founder }))} · ${esc(countryName(b.country))}</span>
          <span class="story__go">${icon('i-arrow-ne')}</span>
          <span class="story__n t-mono" aria-hidden="true">${pad(i + 1)}</span>
        </a>
      </li>`
    )
    .join('');
}

// Плавающее превью истории за курсором (только мышь)
function initStoriesFloat() {
  if (isTouch() || reducedMotion()) return;
  const list = $('[data-stories]');
  const float = $('[data-stories-float]');
  const img = $('[data-stories-float-img]');
  let x = 0;
  let y = 0;
  let cx = 0;
  let cy = 0;
  let active = false;
  const loop = () => {
    cx += (x - cx) * 0.14;
    cy += (y - cy) * 0.14;
    float.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%) rotate(${(x - cx) * 0.04}deg)`;
    if (active || Math.abs(x - cx) > 0.5) requestAnimationFrame(loop);
  };
  list.addEventListener('pointermove', (e) => {
    x = e.clientX;
    y = e.clientY;
    const link = e.target.closest('[data-story-img]');
    if (link && img.getAttribute('src') !== link.dataset.storyImg) img.src = link.dataset.storyImg;
    if (!active) {
      active = true;
      float.classList.add('is-visible');
      requestAnimationFrame(loop);
    }
  });
  list.addEventListener('pointerleave', () => {
    active = false;
    float.classList.remove('is-visible');
  });
}

// ---------- 09 · Подборки ----------
function renderSelections() {
  $('[data-selections]').innerHTML = data.selections
    .map(
      (s, i) => `<a class="sel sel--${s.key}" href="${esc(s.link)}" data-reveal data-cursor-view>
        <span class="sel__media"><img src="${esc(s.image)}" alt="" loading="lazy" decoding="async"></span>
        <span class="sel__n t-mono">${pad(i + 1)}</span>
        <span class="sel__title">${esc(t(`home.selections.${s.key}`))}</span>
        <span class="sel__text">${esc(t(`home.selectionsText.${s.key}`))}</span>
        <span class="sel__count t-mono">${esc(t('catalog.found', { n: s.count }))} ${icon('i-arrow-right', 'icon icon--sm')}</span>
      </a>`
    )
    .join('');
}

function renderAll() {
  renderCollections();
  renderBrands();
  renderNew();
  renderIconic();
  renderStories();
  renderSelections();
}

async function main() {
  try {
    [data, brands] = await Promise.all([api.get('/home'), getBrands()]);
  } catch (err) {
    console.error(err);
    await app.reveal();
    return;
  }
  renderMarquee();
  renderAll();
  await initHero();
  initImageTrail(
    $('[data-manifest]'),
    [...data.iconic, ...data.newProducts].flatMap((p) => p.images.slice(0, 1))
  );
  initStoriesFloat();
  await app.reveal();
  initCollectionsScroll();
  // Замер FPS показал слабое железо — снимаем GSAP pin, лента коллекций становится обычной прокруткой
  if (!perfLow()) onPerfLow(() => initCollectionsScroll());
  initIconicParallax();
  refreshScroll();

  let lastWide = window.innerWidth >= 1024;
  window.addEventListener('resize', () => {
    const wide = window.innerWidth >= 1024;
    if (wide !== lastWide) {
      lastWide = wide;
      initCollectionsScroll();
      refreshScroll();
    }
  });

  onLangChange(() => {
    renderAll();
    renderHeroText(slider?.index || 0, false);
    // Перевод заменил текст заголовков — разбиваем на буквы заново и показываем
    $$('[data-split]').forEach((el) => el.classList.remove('is-split'));
    initReveals();
    initCollectionsScroll();
    refreshScroll();
  });
}

main();
