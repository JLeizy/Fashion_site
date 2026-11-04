// Оглавление историй /histories (раздел 7 ТЗ): 15 домов — номер, год основания, название в микростилистике бренда,
// основатель, краткое описание, объём истории и время чтения; при наведении — превью hero бренда.
// Данные — GET /api/histories (brands + сводка по brand_history_sections, brand_timeline_events, creative_directors).
import { initApp } from '../app.js';
import { $, esc, icon } from '../core/dom.js';
import { t, loc, getLang, onLangChange, countryName, fmtNumber } from '../core/i18n.js';
import api from '../core/api.js';
import { renderBreadcrumbs } from '../ui/breadcrumbs.js';
import { initReveals, refreshScroll } from '../ui/motion.js';

const app = await initApp();
const { histories } = await api.get('/histories');

function render() {
  renderBreadcrumbs($('[data-breadcrumbs]'), [{ href: '/', label: t('nav.home') }, { label: t('nav.histories') }]);
  const en = getLang() === 'en';
  $('[data-hl-list]').innerHTML = histories
    .map(
      (h, i) => `<li class="hl-item" data-brand="${esc(h.slug)}" data-reveal>
        <a class="hl-link" href="/history/${esc(h.slug)}">
          <span class="hl-link__n t-mono">${String(i + 1).padStart(2, '0')}</span>
          <span class="hl-link__year b-accent">${h.foundedYear}</span>
          <span class="hl-link__name b-title">${esc(h.name)}</span>
          <span class="hl-link__meta">
            <span class="t-mono">${esc(countryName(h.country))} · ${esc(h.founder)}</span>
            <span class="hl-link__desc">${esc(loc(h.shortDesc))}</span>
            <span class="hl-link__stats t-mono">${
              h.sections
                ? esc(t('histories.stats', { sections: h.sections, minutes: en && h.words.en ? h.readMinutes.en : h.readMinutes.ru, words: fmtNumber(en && h.words.en ? h.words.en : h.words.ru) }))
                : esc(t('histories.soon'))
            } · ${esc(t('histories.events', { n: h.events }))}</span>
          </span>
          <span class="hl-link__img" aria-hidden="true">${h.hero ? `<img src="${esc(h.hero)}" alt="" loading="lazy">` : ''}</span>
          <span class="hl-link__go">${icon('i-arrow-right')}</span>
        </a>
      </li>`
    )
    .join('');
  initReveals();
  refreshScroll();
}

render();
await app.reveal();
onLangChange(render);
