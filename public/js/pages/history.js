// Страница истории бренда /history/:slug (раздел 7 ТЗ). Один шаблон на 15 домов, микростилистика — data-brand (brands.css).
// Тексты из БД: GET /api/history/:slug (brand_history_sections, brand_timeline_events, creative_directors).
// Hero с медленным зумом, боковое оглавление с подсветкой текущего раздела (IntersectionObserver), прогресс чтения
// и время чтения, буквица в начале разделов, цитаты с орнаментом, интерактивная хронология (годы с параллаксом),
// карточки креативных директоров, галерея культовых вещей, «Перейти в каталог бренда» и «Следующая история».
import { initApp } from '../app.js';
import { $, $$, esc, icon, initials } from '../core/dom.js';
import { t, loc, getLang, onLangChange, countryName, fmtNumber } from '../core/i18n.js';
import api from '../core/api.js';
import { renderBreadcrumbs } from '../ui/breadcrumbs.js';
import { renderCard, bindCardActions } from '../ui/productCard.js';
import { openQuickView } from '../ui/quickView.js';
import { initReveals, refreshScroll, scrollTo, splitAnimate } from '../ui/motion.js';

const slug = document.body.dataset.history;
const app = await initApp();
bindCardActions({ onQuickView: (id) => openQuickView(id) });
const data = await api.get(`/history/${slug}`);
const pad = (n) => String(n).padStart(2, '0');

// Текст раздела из БД → абзацы. Пустая строка разделяет абзацы; «### » — подзаголовок; «> » — врезка;
// пометка [проверить] (непроверенный факт, правило 7.1 ТЗ) подсвечивается.
function richText(text) {
  const mark = (s) => esc(s).replace(/\[(проверить|verify)\]/gi, (m) => `<mark class="hs-check" title="${esc(t('history.checkMark'))}">${m}</mark>`);
  let first = true;
  return String(text || '')
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      if (block.startsWith('### ')) return `<h3 class="hs-sub b-title">${mark(block.slice(4))}</h3>`;
      if (block.startsWith('> ')) return `<p class="hs-aside">${mark(block.replace(/^>\s?/gm, ''))}</p>`;
      const cls = first ? ' class="hs-drop"' : '';
      first = false;
      return `<p${cls}>${mark(block).replace(/\n/g, '<br>')}</p>`;
    })
    .join('');
}

// Текст на текущем языке; если английской версии раздела ещё нет — русский текст с пометкой
const textIn = (field) => {
  const en = getLang() === 'en';
  if (en && field.en) return { text: field.en, fallback: false };
  return { text: field.ru, fallback: en && !field.en };
};

function renderHero() {
  const b = data.brand;
  // Размер названия подбирается по самому длинному слову, чтобы оно не переносилось по буквам
  $('[data-hs-name]').style.setProperty('--len', String(Math.max(6, ...b.name.split(/\s+/).map((w) => w.length))));
  const img = $('[data-hs-hero]');
  if (b.hero) img.src = b.hero;
  img.alt = '';
  $('[data-hs-eyebrow]').textContent = t('history.eyebrow');
  $('[data-hs-year]').textContent = b.foundedYear;
  $('[data-hs-facts]').innerHTML = `${esc(countryName(b.country))} · ${esc(b.founder)}`;
  $('[data-hs-lead]').textContent = loc(b.shortDesc);
  const minutes = getLang() === 'en' ? data.readMinutes.en : data.readMinutes.ru;
  const words = getLang() === 'en' && data.words.en ? data.words.en : data.words.ru;
  $('[data-hs-time]').textContent = data.sections.length ? t('history.readTime', { n: minutes, words: fmtNumber(words) }) : '';
  renderBreadcrumbs($('[data-breadcrumbs]'), [{ href: '/', label: t('nav.home') }, { href: '/histories', label: t('nav.histories') }, { label: b.name }]);
}

function sectionHtml(s, i) {
  const { text, fallback } = textIn(s.content);
  const q = s.quote;
  const quoteText = q ? (getLang() === 'en' && q.en ? q.en : q.ru) : '';
  return `<section class="hs-sec" id="sec-${s.id}" data-toc="${esc(loc(s.title))}" data-toc-n="${pad(i + 1)}">
    <header class="hs-sec__head" data-reveal>
      <span class="hs-sec__n t-mono">${pad(i + 1)}</span>
      ${s.period ? `<span class="hs-sec__period t-mono">${esc(s.period)}</span>` : ''}
      <h2 class="hs-sec__title b-title">${esc(loc(s.title))}</h2>
      <svg class="hs-sec__orn" aria-hidden="true"><use href="#orn-divider"/></svg>
    </header>
    ${s.image ? `<figure class="hs-sec__img" data-clip-reveal><img src="${esc(s.image)}" alt="" loading="lazy"></figure>` : ''}
    ${fallback ? `<p class="hs-fallback t-mono">${esc(t('history.noTranslation'))}</p>` : ''}
    <div class="hs-text">${richText(text)}</div>
    ${quoteText ? `<blockquote class="hs-quote" data-reveal><svg class="hs-quote__orn" aria-hidden="true"><use href="#orn-fleur"/></svg><p>${esc(quoteText)}</p>${q.author ? `<cite class="t-mono">— ${esc(q.author)}</cite>` : ''}</blockquote>` : ''}
  </section>`;
}

function timelineHtml() {
  if (!data.timeline.length) return '';
  let lastDecade = null;
  const items = data.timeline
    .map((e) => {
      const decade = Math.floor(e.year / 10) * 10;
      const sep = decade !== lastDecade ? `<li class="tl2__decade" aria-hidden="true"><span data-parallax="0.25">${decade}</span></li>` : '';
      lastDecade = decade;
      return `${sep}<li class="tl2__event" data-reveal>
        <span class="tl2__dot" aria-hidden="true"></span>
        <time class="tl2__year b-title">${e.year}</time>
        <div class="tl2__body"><h3 class="tl2__title">${esc(loc(e.title))}</h3>${loc(e.description) ? `<p>${esc(loc(e.description))}</p>` : ''}</div>
      </li>`;
    })
    .join('');
  return `<section class="hs-sec hs-timeline" id="timeline" data-toc="${esc(t('history.timeline'))}" data-toc-n="◆">
    <header class="hs-sec__head" data-reveal><span class="hs-sec__n t-mono">◆</span><span class="hs-sec__period t-mono">${data.timeline[0].year}–${data.timeline[data.timeline.length - 1].year}</span><h2 class="hs-sec__title b-title">${esc(t('history.timeline'))}</h2></header>
    <ol class="tl2" data-tl2><li class="tl2__line" aria-hidden="true"><span data-tl2-fill></span></li>${items}</ol>
  </section>`;
}

function directorsHtml() {
  if (!data.directors.length) return '';
  return `<section class="hs-sec" id="directors" data-toc="${esc(t('history.directors'))}" data-toc-n="◆">
    <header class="hs-sec__head" data-reveal><span class="hs-sec__n t-mono">◆</span><h2 class="hs-sec__title b-title">${esc(t('history.directors'))}</h2></header>
    <ul class="hs-dirs">${data.directors
      .map(
        (d, i) => `<li class="hs-dir" data-reveal>
          <div class="hs-dir__photo">${d.photo ? `<img src="${esc(d.photo)}" alt="${esc(d.name)}" loading="lazy">` : `<span class="hs-dir__initials">${esc(initials(...d.name.split(' ')))}</span>`}<span class="hs-dir__n t-mono">${pad(i + 1)}</span></div>
          <p class="hs-dir__years t-mono">${d.from}–${d.to || t('history.present')}</p>
          <h3 class="hs-dir__name b-title">${esc(d.name)}</h3>
          ${loc(d.description) ? `<p class="hs-dir__text">${esc(loc(d.description))}</p>` : ''}
          ${loc(d.collections) ? `<p class="hs-dir__cols"><span class="t-mono">${esc(t('history.keyCollections'))}</span>${esc(loc(d.collections))}</p>` : ''}
        </li>`
      )
      .join('')}</ul>
  </section>`;
}

function iconicHtml() {
  if (!data.iconic.length) return '';
  return `<section class="hs-sec" id="iconic" data-toc="${esc(t('history.iconic'))}" data-toc-n="◆">
    <header class="hs-sec__head" data-reveal><span class="hs-sec__n t-mono">◆</span><h2 class="hs-sec__title b-title">${esc(t('history.iconic'))}</h2></header>
    <div class="hs-iconic">${data.iconic.map((p) => renderCard(p)).join('')}</div>
  </section>`;
}

function render() {
  renderHero();
  const b = data.brand;
  const article = $('[data-hs-article]');
  article.innerHTML = `
    ${data.sections.length ? data.sections.map(sectionHtml).join('') : `<section class="hs-sec hs-soon" id="soon" data-toc="${esc(t('history.soonToc'))}" data-toc-n="01">
        <svg class="hs-soon__orn" aria-hidden="true"><use href="#orn-cross-filigree"/></svg>
        <h2 class="hs-sec__title b-title">${esc(t('history.soonTitle'))}</h2>
        <div class="hs-text"><p class="hs-drop">${esc(loc(b.shortDesc))}</p><p>${esc(t('history.soonText'))}</p></div>
      </section>`}
    ${timelineHtml()}
    ${directorsHtml()}
    ${iconicHtml()}
    <section class="hs-end" data-reveal>
      <a class="hs-end__cat" href="/brand/${esc(b.slug)}#brand-catalog">
        <span class="t-eyebrow">${esc(t('history.toCatalogEyebrow'))}</span>
        <span class="hs-end__title b-title">${esc(t('history.toCatalog', { brand: b.name }))}</span>
        ${icon('i-arrow-right')}
      </a>
      <a class="hs-end__next" href="/history/${esc(data.next.slug)}" data-brand="${esc(data.next.slug)}" style="--next:${esc(data.next.accent)}">
        <span class="t-eyebrow">${esc(t('history.next'))}</span>
        <span class="hs-end__title b-title">${esc(data.next.name)}</span>
        ${icon('i-arrow-right')}
      </a>
    </section>`;

  // Оглавление
  const toc = $$('[data-toc]', article);
  $('[data-hs-toc]').innerHTML = toc.map((s) => `<li><a href="#${s.id}" data-toc-link="${s.id}"><span class="t-mono">${esc(s.dataset.tocN)}</span><span>${esc(s.dataset.toc)}</span></a></li>`).join('');
  initReveals(article);
  splitAnimate($('[data-hs-name]'), { scroll: false, delay: 0.15 });
  refreshScroll();
  observeToc(toc);
}

// Подсветка текущего раздела в оглавлении
let observer = null;
function observeToc(sections) {
  observer?.disconnect();
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        $$('[data-toc-link]').forEach((a) => {
          const on = a.dataset.tocLink === e.target.id;
          a.classList.toggle('is-active', on);
          if (on) a.setAttribute('aria-current', 'true');
          else a.removeAttribute('aria-current');
        });
      });
    },
    { rootMargin: '-35% 0px -60% 0px' }
  );
  sections.forEach((s) => observer.observe(s));
}

$('[data-hs-toc-wrap]').addEventListener('click', (e) => {
  const a = e.target.closest('[data-toc-link]');
  if (!a) return;
  e.preventDefault();
  scrollTo(document.getElementById(a.dataset.tocLink), { offset: -90 });
  history.replaceState(null, '', `#${a.dataset.tocLink}`);
});
document.querySelector('.hs-hero__down').addEventListener('click', (e) => {
  e.preventDefault();
  scrollTo(document.getElementById('hs-start'), { offset: -70 });
});

// Прогресс чтения статьи и заполнение линии хронологии (только transform)
const bar = $('[data-hs-progress]');
function onScroll() {
  const article = $('[data-hs-article]');
  const r = article.getBoundingClientRect();
  const total = r.height - window.innerHeight * 0.6;
  const p = Math.min(1, Math.max(0, -r.top / Math.max(1, total)));
  bar.style.transform = `scaleX(${p})`;
  const tl = $('[data-tl2]');
  if (tl) {
    const tr = tl.getBoundingClientRect();
    const tp = Math.min(1, Math.max(0, (window.innerHeight * 0.6 - tr.top) / tr.height));
    $('[data-tl2-fill]').style.transform = `scaleY(${tp})`;
  }
}
window.addEventListener('scroll', onScroll, { passive: true });

render();
await app.reveal();
onScroll();
if (location.hash) setTimeout(() => scrollTo(document.getElementById(decodeURIComponent(location.hash.slice(1))), { offset: -90 }), 300);
onLangChange(() => {
  render();
  onScroll();
});
