// Админка → Бренды и их истории (раздел 8 ТЗ, роль owner): мозаика 15 домов в их акцентных цветах; страница бренда —
// данные бренда (редактирование, загрузка hero), редактор разделов истории (порядок, тексты RU/EN, цитаты),
// события хронологии, креативные директора и коллекции бренда.
// API: /api/admin/refs/brands|history|timeline|directors|collections (server/routes/api/adminRefs.js)
import { $, esc, icon } from '../core/dom.js';
import { t, countryName, fmtNumber } from '../core/i18n.js';
import api from '../core/api.js';
import { toast } from '../ui/toast.js';
import { loading } from '../account/common.js';
import { subtabs } from '../account/staff.js';
import { openForm } from './form.js';
import { refsTable } from './refs.js';

const brandFields = () => {
  const f = (name, type = 'text', extra = {}) => ({ name, type, label: t(`admin.f.${name}`), ...extra });
  return [
    f('name', 'text', { required: true }), f('slug', 'text', { required: true, hint: 'maison-margiela' }), f('country', 'text', { required: true, hint: 'FR, IT, US…' }), f('founded_year', 'number', { min: 1800, max: 2100, required: true }),
    f('founder', 'text', { required: true, wide: true }), f('short_desc_ru', 'textarea', { wide: true, required: true }), f('short_desc_en', 'textarea', { wide: true, required: true, lang: 'en' }),
    f('accent_color', 'color', { required: true }), f('sort_order', 'number', { min: 0, max: 999 }), f('hero_image', 'image', { wide: true }),
  ];
};

export async function render(view, ctx, params) {
  if (params[0]) return renderBrand(view, ctx, Number(params[0]), params[1] || '');
  view.innerHTML = loading();
  const { rows } = await api.get('/admin/refs/brands', { limit: 100 });
  view.innerHTML = `
    <div class="adm-toolbar"><p class="t-muted">${esc(t('admin.brands.lead'))}</p><button type="button" class="btn btn--sm" data-add>${icon('i-plus', 'icon icon--sm')} ${esc(t('admin.brands.add'))}</button></div>
    <ul class="bgrid">${rows
      .map(
        (b, i) => `<li data-reveal><a class="bt" href="/admin/brands/${b.id}" data-adm-link style="--b:${esc(b.accent_color)}" data-brand="${esc(b.slug)}">
          <span class="bt__n t-mono">${String(i + 1).padStart(2, '0')}</span>
          <span class="bt__name">${esc(b.name)}</span>
          <span class="bt__meta t-mono">${esc(countryName(b.country))} · ${b.founded_year}</span>
          <span class="bt__stats t-mono"><span>${fmtNumber(b.products_count)} ${esc(t('admin.f.products'))}</span><span class="${b.sections_count ? '' : 'is-empty'}">${b.sections_count ? `${b.sections_count} ${esc(t('admin.brands.sections'))}` : esc(t('admin.brands.noHistory'))}</span></span>
        </a></li>`
      )
      .join('')}</ul>`;
  view.addEventListener('click', (e) => {
    if (!e.target.closest('[data-add]')) return;
    openForm({
      title: t('admin.brands.add'),
      fields: brandFields(),
      values: { accent_color: '#5A0F1C', sort_order: rows.length + 1, founded_year: 2000 },
      onSubmit: async (v) => {
        const { item } = await api.post('/admin/refs/brands', v);
        toast.success(t('account.saved'));
        ctx.navigate(`/admin/brands/${item.id}`);
      },
    });
  });
}

async function renderBrand(view, ctx, id, tab) {
  view.innerHTML = loading();
  let { item: b } = await api.get(`/admin/refs/brands/${id}`);
  const tabs = [
    { id: '', label: t('admin.brands.tabInfo'), icon: 'i-info' },
    { id: 'history', label: t('admin.brands.tabHistory'), icon: 'i-book', count: b.sections_count },
    { id: 'timeline', label: t('admin.brands.tabTimeline'), icon: 'i-clock' },
    { id: 'directors', label: t('admin.brands.tabDirectors'), icon: 'i-user' },
    { id: 'collections', label: t('admin.brands.tabCollections'), icon: 'i-grid3' },
  ];
  const active = tabs.some((x) => x.id === tab) ? tab : '';
  function head() {
    ctx.setHead({ eyebrow: `${t('admin.nav.brands')} · ${countryName(b.country)} · ${b.founded_year}`, title: b.name });
  }
  head();
  view.innerHTML = `
    <a class="link-u t-mono acc-back" href="/admin/brands" data-adm-link>${esc(t('admin.brands.back'))}</a>
    ${subtabs(`/admin/brands/${id}`, tabs, active)}
    <div data-brand-body></div>`;
  const body = $('[data-brand-body]', view);
  if (active) {
    body.innerHTML = `<p class="t-muted acc-note">${esc(t(`admin.brands.lead_${active}`))}</p><div data-refs></div>`;
    await refsTable($('[data-refs]', body), active, { brand: id, urlSync: false });
    return;
  }
  function drawInfo() {
    body.innerHTML = `
      <section class="binfo" style="--b:${esc(b.accent_color)}" data-reveal>
        <div class="binfo__hero">${b.hero_image ? `<img src="${esc(b.hero_image)}" alt="">` : ''}<span class="binfo__name">${esc(b.name)}</span></div>
        <dl class="binfo__facts">
          <div><dt class="t-mono">${esc(t('admin.f.slug'))}</dt><dd class="t-mono">/brand/${esc(b.slug)}</dd></div>
          <div><dt class="t-mono">${esc(t('admin.f.founder'))}</dt><dd>${esc(b.founder)}</dd></div>
          <div><dt class="t-mono">${esc(t('admin.f.accent_color'))}</dt><dd class="t-mono"><span class="binfo__swatch"></span>${esc(b.accent_color)}</dd></div>
          <div><dt class="t-mono">${esc(t('admin.f.products'))}</dt><dd>${fmtNumber(b.products_count)}</dd></div>
        </dl>
        <p class="binfo__desc">${esc(b.short_desc_ru)}</p>
        <p class="binfo__desc t-muted" lang="en">${esc(b.short_desc_en)}</p>
        <div class="odetail__actions">
          <button type="button" class="btn btn--sm" data-edit>${icon('i-edit', 'icon icon--sm')} ${esc(t('common.edit'))}</button>
          <a class="btn btn--sm btn--ghost" href="/brand/${esc(b.slug)}" target="_blank" rel="noopener">${icon('i-arrow-ne', 'icon icon--sm')} ${esc(t('admin.brands.page'))}</a>
          <a class="btn btn--sm btn--ghost" href="/history/${esc(b.slug)}" target="_blank" rel="noopener">${icon('i-book', 'icon icon--sm')} ${esc(t('admin.brands.history'))}</a>
        </div>
      </section>`;
  }
  drawInfo();
  body.addEventListener('click', (e) => {
    if (!e.target.closest('[data-edit]')) return;
    openForm({
      title: b.name,
      fields: brandFields(),
      values: b,
      onSubmit: async (v) => {
        ({ item: b } = await api.put(`/admin/refs/brands/${id}`, v));
        ({ item: b } = await api.get(`/admin/refs/brands/${id}`));
        toast.success(t('account.saved'));
        head();
        drawInfo();
      },
    });
  });
}
