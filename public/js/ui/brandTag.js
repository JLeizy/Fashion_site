// Бирка товара в блоке «02 · Характеристики» (правка П10).
// Свёрнутый вид — бирка с брендом, составом, артикулом и страной. По нажатию она «раскладывается»
// (секции разворачиваются по очереди, как сложенная бирка) и показывает подробное описание вещи.
// Оформление — своё для каждого из 15 домов: атрибут data-brand на бирке + стили в css/pages/product-tag.css
// (только типографика, цвет и орнамент, без логотипов и фирменных принтов — раздел 10.2 ТЗ).
// Анимация — только transform/opacity; при prefers-reduced-motion и html.perf-low — без анимации.
import { esc, icon } from '../core/dom.js';
import { t, loc, countryName } from '../core/i18n.js';
import { lineNumber } from './productCard.js';

// Город дома для «паспортной» строки бирки (те же значения, что и на печати страницы бренда)
const CITY = {
  balenciaga: 'Paris', vetements: 'Paris', gucci: 'Firenze', prada: 'Milano', 'enfants-riches-deprimes': 'Los Angeles',
  avavav: 'Firenze', supreme: 'New York', 'chrome-hearts': 'Los Angeles', 'louis-vuitton': 'Paris', chanel: 'Paris',
  'maison-margiela': 'Paris', givenchy: 'Paris', versace: 'Milano', 'alexander-mcqueen': 'London', 'loro-piana': 'Quarona',
};

// Декоративная «шапка» бирки — своя у каждого дома (только текст и SVG-орнаменты из спрайта)
function decoration(product) {
  const slug = product.brand.slug;
  const city = CITY[slug] || '';
  const year = product.brand.foundedYear || '';
  const orn = (id) => `<svg class="pp-tag__orn" aria-hidden="true"><use href="#${id}"/></svg>`;
  switch (slug) {
    case 'maison-margiela': {
      // Ряд цифр 0–23, обведён «номер линии» — как на белой бирке с четырьмя стежками
      const line = lineNumber(product);
      return `<span class="pp-tag__nums t-mono">${Array.from({ length: 24 }, (_, n) => `<span class="${n === line ? 'is-on' : ''}">${n}</span>`).join('')}</span>`;
    }
    case 'balenciaga':
      return `<span class="pp-tag__barcode" aria-hidden="true"></span><span class="pp-tag__ref t-mono">REF ${esc(product.sku)} — ${esc(city)}</span>`;
    case 'vetements':
      return `<span class="pp-tag__sticker">SIZE: OVERSIZED</span><span class="pp-tag__care t-mono">30° ⊠ △ ⊡ ◯</span>`;
    case 'gucci':
      return `<span class="pp-tag__crest">${orn('orn-fleur')}<span>${esc(city)} · ${year}</span>${orn('orn-fleur')}</span>`;
    case 'prada':
      return `<span class="pp-tag__line t-mono">${esc(city)} — ${year}</span>`;
    case 'enfants-riches-deprimes':
      return `<span class="pp-tag__poem">${esc(t('product.tag.poem'))}</span>`;
    case 'avavav':
      return `<span class="pp-tag__glitch" aria-hidden="true">AV—AV—AV</span>`;
    case 'supreme':
      return `<span class="pp-tag__ny t-mono">${esc(city)} · ${year}</span>`;
    case 'chrome-hearts':
      return `<span class="pp-tag__crosses">${orn('orn-cross')}${orn('orn-dagger')}${orn('orn-cross')}</span>`;
    case 'louis-vuitton':
      return `<span class="pp-tag__hole" aria-hidden="true"></span><span class="pp-tag__route t-mono">${esc(city)} → ${esc(t('product.tag.destination'))}</span>`;
    case 'chanel':
      return `<span class="pp-tag__pearls" aria-hidden="true"></span><span class="pp-tag__line">${esc(city)}</span>`;
    case 'givenchy':
      return `<span class="pp-tag__arch">${orn('orn-cross-filigree')}</span>`;
    case 'versace':
      return `<span class="pp-tag__meander" aria-hidden="true"></span><span class="pp-tag__line">${esc(city)} · ${year}</span>`;
    case 'alexander-mcqueen':
      return `<span class="pp-tag__flowers">${orn('orn-fleur')}${orn('orn-star')}${orn('orn-fleur')}</span>`;
    case 'loro-piana':
      return `<span class="pp-tag__line">${esc(city)} · ${year}</span>`;
    default:
      return '';
  }
}

// Первое предложение короткого описания бренда — «одна строка о доме»
const firstSentence = (text = '') => (String(text).match(/^.*?[.!?](?=\s|$)/) || [text])[0];

function factsHtml(rows) {
  return `<dl class="pp-tag__facts">${rows
    .filter(([, v]) => v)
    .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
    .join('')}</dl>`;
}

// Разметка бирки: кнопка (свёрнутый вид) + панель с подробностями (разворачивается секциями)
export function brandTagHtml(product, collectionLabel) {
  const description = loc(product.description);
  const about = firstSentence(loc(product.brand.about || {}));
  const folds = [
    `<h3 class="pp-tag__h">${esc(t('product.tag.description'))}</h3><p class="pp-tag__text">${esc(description)}</p>`,
    factsHtml([
      [t('product.tag.composition'), loc(product.composition)],
      [t('product.tag.care'), loc(product.care)],
      [t('product.specMaterial'), t(`materials.${product.material}`)],
      [t('product.specCountry'), countryName(product.country)],
    ]),
    factsHtml([
      [t('product.specCollection'), collectionLabel],
      [t('product.specGender'), t(`genders.${product.gender}`)],
      [t('product.specSku'), product.sku],
    ]) +
      (product.isAuthenticated
        ? `<p class="pp-tag__verified">${icon('i-check', 'icon icon--xs')}<span><b>Verified by Amfibia</b> — ${esc(t('product.tag.verifiedText'))}</span></p>`
        : ''),
    `<p class="pp-tag__about"><span class="pp-tag__about-name">${esc(product.brand.name)}</span> ${esc(about)}</p>
     <a class="pp-tag__link" href="/history/${esc(product.brand.slug)}">${esc(t('product.tag.history'))} ${icon('i-arrow-right', 'icon icon--xs')}</a>`,
  ];
  return `
    <button type="button" class="pp-tag__face" aria-expanded="false" aria-controls="pp-tag-panel" data-pp-tag-toggle>
      <span class="pp-tag__deco">${decoration(product)}</span>
      <span class="pp-tag__brand">${esc(product.brand.name)}</span>
      <span class="pp-tag__comp">${esc(loc(product.composition))}</span>
      <span class="pp-tag__sku t-mono">${esc(product.sku)} · ${esc(countryName(product.country))}</span>
      <span class="pp-tag__hint t-mono"><span data-pp-tag-label>${esc(t('product.tag.more'))}</span><span class="pp-tag__plus" aria-hidden="true"></span></span>
    </button>
    <div class="pp-tag__panel" id="pp-tag-panel" role="region" aria-label="${esc(t('product.tag.panel'))}" hidden data-pp-tag-panel>
      ${folds.map((html, i) => `<div class="pp-tag__fold" style="--i:${i}">${html}</div>`).join('')}
    </div>`;
}

const reduced = () =>
  document.documentElement.classList.contains('perf-low') || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Поведение: нажатие (или Enter/Space) — развернуть/свернуть, Esc — свернуть и вернуть фокус на бирку
export function initBrandTag(root) {
  const button = root.querySelector('[data-pp-tag-toggle]');
  const panel = root.querySelector('[data-pp-tag-panel]');
  const label = root.querySelector('[data-pp-tag-label]');
  if (!button || !panel) return () => {};
  let closeTimer = null;

  const setOpen = (open) => {
    clearTimeout(closeTimer);
    button.setAttribute('aria-expanded', String(open));
    label.textContent = t(open ? 'product.tag.less' : 'product.tag.more');
    if (open) {
      panel.hidden = false;
      // Принудительный reflow: стартовое (сложенное) состояние успевает примениться до класса is-open
      void panel.offsetWidth;
      root.classList.add('is-open');
    } else {
      root.classList.remove('is-open');
      // Ждём, пока секции «сложатся», затем убираем панель из потока и из дерева доступности
      closeTimer = setTimeout(() => (panel.hidden = true), reduced() ? 0 : 520);
    }
  };

  button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'));
  const onKey = (e) => {
    if (e.key !== 'Escape' || button.getAttribute('aria-expanded') !== 'true') return;
    if (document.querySelector('.modal.is-open, [data-search]:not([hidden])')) return; // Esc закрывает сначала модалки
    setOpen(false);
    button.focus();
  };
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}
