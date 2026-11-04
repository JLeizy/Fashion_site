// Кабинет → Мой магазин (раздел 4 ТЗ, роль seller): товары (список, создание, редактирование, фото, размеры, цена и скидка,
// статус модерации и причина отклонения), заказы со своими товарами (только просмотр), статистика с графиками Chart.js,
// отзывы на свои товары. Подвкладки: /account/shop[/orders|/stats|/reviews], редактор — /account/shop/products/new|:id.
// API: /api/seller/* (server/routes/api/seller.js) — сервер пропускает только роль seller (и owner) и только свои товары.
import { $, $$, esc, icon } from '../core/dom.js';
import { t, loc, fmtDate, fmtDateTime, fmtNumber, countryName, getLang } from '../core/i18n.js';
import api from '../core/api.js';
import { formatPrice, refreshPrices } from '../core/currency.js';
import { openModal, confirmModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { withLoading, showApiError, clearErrors } from '../ui/forms.js';
import { statusBadge, empty, loading } from './common.js';
import { createTable } from './table.js';
import { subtabs, kpis, money, delta, itemsStrip, loadChart, chartTheme, chartDefaults, seriesColors, pickImages } from './staff.js';

const BASE = 'shop';
let refsCache = null;
const refs = async () => (refsCache ||= await api.get('/seller/refs'));

export async function render(view, ctx, params) {
  const tab = params[0] || '';
  view.innerHTML = loading();
  if (tab === 'products' && params[1]) return renderEditor(view, ctx, params[1] === 'new' ? null : Number(params[1]));
  const summary = await api.get('/seller/summary');
  const head = `
    ${subtabs(BASE, [
      { id: '', label: t('staff.shop.tabs.products'), count: summary.counts.total, icon: 'i-catalog' },
      { id: 'orders', label: t('staff.shop.tabs.orders'), icon: 'i-box' },
      { id: 'stats', label: t('staff.shop.tabs.stats'), icon: 'i-sparkle' },
      { id: 'reviews', label: t('staff.shop.tabs.reviews'), icon: 'i-star' },
    ], ['orders', 'stats', 'reviews'].includes(tab) ? tab : '')}`;
  ctx.setHead({ eyebrow: t('staff.shop.eyebrow'), title: t('account.nav.shop'), crumbs: [{ label: t('account.nav.shop') }] });
  view.innerHTML = `${head}<div data-shop-body></div>`;
  const body = $('[data-shop-body]', view);
  if (tab === 'orders') return renderOrders(body, ctx);
  if (tab === 'stats') return renderStats(body, ctx);
  if (tab === 'reviews') return renderReviews(body, ctx);
  return renderProducts(body, ctx, summary);
}

// ---------------------------------------------------------------------------------------------
// Товары
// ---------------------------------------------------------------------------------------------
function renderProducts(body, ctx, summary) {
  const c = summary.counts;
  body.innerHTML = `
    ${kpis([
      { label: t('staff.shop.live'), value: fmtNumber(c.approved), tone: 'ok' },
      { label: t('staff.shop.pending'), value: fmtNumber(c.pending), tone: c.pending ? 'warn' : '' },
      { label: t('staff.shop.rejected'), value: fmtNumber(c.rejected), tone: c.rejected ? 'bad' : '' },
      { label: t('staff.shop.drafts'), value: fmtNumber(c.draft) },
      { label: t('staff.shop.revenue30'), value: money(summary.revenue30) },
    ])}
    ${ctx.user.role === 'owner' ? `<p class="notice acc-note">${esc(t('staff.shop.ownerNote'))}</p>` : ''}
    <div data-table></div>`;
  const table = createTable($('[data-table]', body), {
    csv: 'amfibia-products',
    sort: 'created',
    pageSize: 15,
    search: { placeholder: t('staff.shop.searchPh') },
    filters: [
      {
        name: 'status',
        label: t('staff.moderation'),
        value: 'all',
        options: ['all', 'approved', 'pending', 'rejected', 'draft'].map((s) => ({ value: s, label: s === 'all' ? t('common.all') : t(`staff.mod.${s}`) })),
      },
    ],
    toolbar: `<a class="btn btn--sm" href="/account/shop/products/new" data-acc-link>${icon('i-plus', 'icon icon--sm')} ${esc(t('staff.shop.add'))}</a>`,
    empty: { title: t('staff.shop.noProducts'), text: t('staff.shop.noProductsText') },
    load: (s) => api.get('/seller/products', s),
    rowClass: (p) => (p.status === 'rejected' ? 'is-bad' : ''),
    onRow: (p) => ctx.navigate(`/account/shop/products/${p.id}`),
    columns: [
      {
        key: 'name',
        label: t('staff.col.product'),
        sort: 'name',
        className: 'dt__wide',
        render: (p) => `<span class="dt-prod"><img src="${esc(p.image)}" alt="" loading="lazy"><span><a class="dt-prod__name" href="/account/shop/products/${p.id}" data-acc-link>${esc(loc(p.name))}</a><span class="dt-prod__meta t-mono">${esc(p.brand)} · ${esc(p.sku)}</span></span></span>`,
        csv: (p) => loc(p.name),
      },
      { key: 'sku', label: t('staff.col.sku'), sort: 'sku', className: 'dt__hide-sm t-mono', render: (p) => esc(p.sku), csv: (p) => p.sku },
      { key: 'price', label: t('staff.col.price'), sort: 'price', className: 't-mono', render: (p) => `${money(p.price)}${p.oldPrice ? `<s class="dt-old">${money(p.oldPrice)}</s>` : ''}`, csv: (p) => p.price },
      {
        key: 'status',
        label: t('staff.moderation'),
        sort: 'status',
        render: (p) => `${statusBadge(p.status, t(`staff.mod.${p.status}`))}${p.authenticated ? `<span class="dt-verified" title="${esc(t('labels.verified'))}">${icon('i-shield', 'icon icon--xs')}</span>` : ''}${p.rejectionReason ? `<span class="dt-reason">${esc(p.rejectionReason)}</span>` : ''}`,
        csv: (p) => t(`staff.mod.${p.status}`),
      },
      { key: 'stock', label: t('staff.col.stock'), sort: 'stock', className: 't-mono', render: (p) => `<span class="${p.stock < 3 ? 't-danger' : ''}">${p.stock}</span>` },
      { key: 'sold', label: t('staff.col.sold'), sort: 'sold', className: 't-mono dt__hide-sm' },
      { key: 'views', label: t('staff.col.views'), sort: 'views', className: 't-mono dt__hide-sm', render: (p) => fmtNumber(p.views), csv: (p) => p.views },
      {
        key: 'actions',
        label: '',
        csv: false,
        className: 'dt__actions',
        render: (p) => `<a class="icon-btn" href="/account/shop/products/${p.id}" data-acc-link aria-label="${esc(t('common.edit'))}" title="${esc(t('common.edit'))}">${icon('i-edit', 'icon icon--sm')}</a>
          <a class="icon-btn" href="/product/${p.id}" target="_blank" rel="noopener" aria-label="${esc(t('staff.shop.openPage'))}" title="${esc(t('staff.shop.openPage'))}">${icon('i-arrow-ne', 'icon icon--sm')}</a>
          <button type="button" class="icon-btn" data-del="${p.id}" aria-label="${esc(t('common.delete'))}" title="${esc(t('common.delete'))}">${icon('i-trash', 'icon icon--sm')}</button>`,
      },
    ],
  });
  body.addEventListener('click', async (e) => {
    const del = e.target.closest('[data-del]');
    if (!del) return;
    const p = table.rows.find((r) => r.id === Number(del.dataset.del));
    if (!(await confirmModal({ title: t('staff.shop.deleteTitle'), text: t('staff.shop.deleteText', { name: loc(p.name) }), danger: true, confirmLabel: t('common.delete') }))) return;
    try {
      const r = await api.del(`/seller/products/${p.id}`);
      if (r.deleted) toast.success(t('staff.shop.deleted'));
      else toast.info(t('staff.shop.unpublished'), r.message);
      table.reload();
    } catch (err) {
      toast.error(err.message);
    }
  });
}

// ---------------------------------------------------------------------------------------------
// Редактор товара (создание и изменение)
// ---------------------------------------------------------------------------------------------
async function renderEditor(view, ctx, id) {
  const [r, data] = await Promise.all([refs(), id ? api.get(`/seller/products/${id}`) : Promise.resolve({ product: null })]);
  let p = data.product;
  const isNew = !p;
  const queued = []; // фото, выбранные до первого сохранения нового товара
  const title = isNew ? t('staff.shop.newProduct') : loc({ ru: p.nameRu, en: p.nameEn });
  ctx.setHead({
    eyebrow: isNew ? t('staff.shop.eyebrow') : `${p.brand.name} · ${p.sku}`,
    title,
    crumbs: [{ href: '/account/shop', label: t('account.nav.shop') }, { label: isNew ? t('staff.shop.newProduct') : p.sku }],
  });
  const v = p || { brandId: r.brands[0].id, collectionId: null, categoryId: null, nameRu: '', nameEn: '', descriptionRu: '', descriptionEn: '', compositionRu: '', compositionEn: '', careRu: '', careEn: '', price: '', oldPrice: null, gender: 'unisex', color: 'black', material: r.materials[0], country: 'IT', isLimited: false, isNew: true, sizeIds: [], images: [] };

  const groups = {};
  r.categories.forEach((c) => (groups[loc(c.parent)] ||= []).push(c));
  const field = (name, label, input, hint = '') => `<div class="field" data-field="${name}"><label class="field__label" for="ed-${name}">${esc(label)}</label>${input}${hint ? `<p class="field__hint">${esc(hint)}</p>` : ''}<p class="field__error" data-error-for="${name}"></p></div>`;
  const text = (name, value, attrs = '') => `<input class="input" id="ed-${name}" name="${name}" value="${esc(value ?? '')}" ${attrs}>`;
  const area = (name, value, rows = 4, attrs = '') => `<textarea class="textarea" id="ed-${name}" name="${name}" rows="${rows}" ${attrs}>${esc(value ?? '')}</textarea>`;
  const section = (n, key, inner) => `<fieldset class="ed-sec" data-reveal><legend class="ed-sec__head"><span class="ed-sec__n t-mono">${n}</span><span>${esc(t(`staff.ed.${key}`))}</span></legend>${inner}</fieldset>`;

  view.innerHTML = `
    <a class="link-u t-mono acc-back" href="/account/shop" data-acc-link>${esc(t('staff.shop.back'))}</a>
    ${!isNew ? `<div class="ed-status">${statusBadge(p.status, t(`staff.mod.${p.status}`))}
        ${p.authenticated ? `<span class="label label--verified">${icon('i-shield', 'icon icon--xs')} Verified by Amfibia</span>` : ''}
        <span class="t-mono t-muted">${esc(t('staff.shop.updated', { date: fmtDateTime(p.updatedAt) }))}</span>
        ${p.status === 'approved' ? `<a class="link-u t-mono" href="/product/${p.id}" target="_blank" rel="noopener">${esc(t('staff.shop.openPage'))} ${icon('i-arrow-ne', 'icon icon--xs')}</a>` : ''}
      </div>
      ${p.rejectionReason ? `<p class="notice notice--danger ed-reject">${icon('i-warning', 'icon icon--sm')} <span><b>${esc(t('staff.shop.rejectedBecause'))}</b> ${esc(p.rejectionReason)}</span></p>` : ''}` : ''}
    <form class="ed" data-editor novalidate>
      <div class="ed__main">
        ${section('01', 'basics', `<div class="form-grid form-grid--2">
          ${field('brandId', t('staff.ed.brand'), `<select class="select" id="ed-brandId" name="brandId">${r.brands.map((b) => `<option value="${b.id}" ${b.id === v.brandId ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select>`)}
          ${field('collectionId', t('staff.ed.collection'), `<select class="select" id="ed-collectionId" name="collectionId"></select>`)}
          ${field('categoryId', t('staff.ed.category'), `<select class="select" id="ed-categoryId" name="categoryId"><option value="">—</option>${Object.entries(groups).map(([g, list]) => `<optgroup label="${esc(g)}">${list.map((c) => `<option value="${c.id}" ${c.id === v.categoryId ? 'selected' : ''}>${esc(loc(c.name))}</option>`).join('')}</optgroup>`).join('')}</select>`)}
          ${field('gender', t('staff.ed.gender'), `<div class="seg ed-seg" role="radiogroup">${r.genders.map((g) => `<label><input type="radio" name="gender" value="${g}" ${g === v.gender ? 'checked' : ''}><span>${esc(t(`genders.${g}`))}</span></label>`).join('')}</div>`)}
          ${field('nameRu', t('staff.ed.nameRu'), text('nameRu', v.nameRu, 'maxlength="200" required'))}
          ${field('nameEn', t('staff.ed.nameEn'), text('nameEn', v.nameEn, 'maxlength="200" required lang="en"'))}
        </div>`)}
        ${section('02', 'description', `<div class="form-grid form-grid--2">
          ${field('descriptionRu', t('staff.ed.descRu'), area('descriptionRu', v.descriptionRu, 5, 'maxlength="5000"'))}
          ${field('descriptionEn', t('staff.ed.descEn'), area('descriptionEn', v.descriptionEn, 5, 'maxlength="5000" lang="en"'))}
          ${field('compositionRu', t('staff.ed.compRu'), text('compositionRu', v.compositionRu, 'maxlength="300"'))}
          ${field('compositionEn', t('staff.ed.compEn'), text('compositionEn', v.compositionEn, 'maxlength="300" lang="en"'))}
          ${field('careRu', t('staff.ed.careRu'), area('careRu', v.careRu, 2, 'maxlength="2000"'))}
          ${field('careEn', t('staff.ed.careEn'), area('careEn', v.careEn, 2, 'maxlength="2000" lang="en"'))}
        </div>`)}
        ${section('03', 'priceSec', `<div class="form-grid form-grid--3">
          ${field('price', t('staff.ed.price'), `<div class="ed-money"><input class="input t-mono" id="ed-price" name="price" type="number" min="0.01" step="0.01" value="${esc(v.price)}" required><span class="t-mono">BYN</span></div>`)}
          ${field('oldPrice', t('staff.ed.oldPrice'), `<div class="ed-money"><input class="input t-mono" id="ed-oldPrice" name="oldPrice" type="number" min="0.01" step="0.01" value="${esc(v.oldPrice ?? '')}"><span class="t-mono">BYN</span></div>`, t('staff.ed.oldPriceHint'))}
          <div class="field"><span class="field__label">${esc(t('staff.ed.discount'))}</span><p class="ed-discount t-mono" data-discount>—</p></div>
        </div>
        <div class="ed-flags">
          <label class="switch"><input type="checkbox" name="isNew" ${v.isNew ? 'checked' : ''}><span class="switch__track"></span><span>NEW · ${esc(t('staff.ed.isNew'))}</span></label>
          <label class="switch"><input type="checkbox" name="isLimited" ${v.isLimited ? 'checked' : ''}><span class="switch__track"></span><span>LIMITED · ${esc(t('staff.ed.isLimited'))}</span></label>
        </div>`)}
        ${section('04', 'specs', `<div class="field" data-field="color"><span class="field__label">${esc(t('staff.ed.color'))} · <b data-color-name></b></span>
            <div class="ed-colors" role="radiogroup">${r.colors.map((c) => `<label class="ed-color" title="${esc(t(`colors.${c}`))}"><input type="radio" name="color" value="${esc(c)}" ${c === v.color ? 'checked' : ''}><span style="--sw:var(--c-${esc(c)}, #777)"></span><span class="sr-only">${esc(t(`colors.${c}`))}</span></label>`).join('')}</div><p class="field__error" data-error-for="color"></p></div>
          <div class="form-grid form-grid--2">
            ${field('material', t('staff.ed.material'), `<select class="select" id="ed-material" name="material">${r.materials.map((m) => `<option value="${esc(m)}" ${m === v.material ? 'selected' : ''}>${esc(t(`materials.${m}`))}</option>`).join('')}</select>`)}
            ${field('country', t('staff.ed.country'), `<select class="select" id="ed-country" name="country">${r.countries.map((c) => `<option value="${c}" ${c === v.country ? 'selected' : ''}>${esc(countryName(c))}</option>`).join('')}</select>`)}
          </div>`)}
        ${section('05', 'sizes', `<p class="t-muted acc-note" data-size-hint></p><div class="size-grid ed-sizes" data-sizes></div><p class="field__error" data-error-for="sizeIds"></p>
          ${!isNew ? `<p class="field__hint">${esc(t('staff.ed.sizesHint'))}</p>` : ''}`)}
        ${section('06', 'photos', `<div class="ed-photos" data-photos></div><p class="field__hint">${esc(t('staff.ed.photosHint'))}</p>`)}
      </div>

      <aside class="ed__side">
        <div class="ed-preview" data-preview></div>
        <p class="notice notice--accent ed-note">${icon('i-info', 'icon icon--sm')} <span>${esc(t('staff.ed.moderationNote'))}</span></p>
        <p class="notice notice--danger" data-form-error hidden></p>
        <div class="ed-actions">
          <button type="submit" class="btn btn--block" data-submit="1">${icon('i-check', 'icon icon--sm')} ${esc(t('staff.ed.submit'))}</button>
          <button type="submit" class="btn btn--ghost btn--block" data-submit="0">${esc(t('staff.ed.saveDraft'))}</button>
          ${!isNew ? `<button type="button" class="link-u t-mono ed-del" data-delete>${icon('i-trash', 'icon icon--xs')} ${esc(t('common.delete'))}</button>` : ''}
        </div>
      </aside>
    </form>`;

  const form = $('[data-editor]', view);
  const el = (name) => form.elements[name];
  const selectedSizes = new Set(v.sizeIds || []);

  function fillCollections() {
    const brandId = Number(el('brandId').value);
    const list = r.collections.filter((c) => c.brandId === brandId);
    el('collectionId').innerHTML = `<option value="">${esc(t('staff.ed.noCollection'))}</option>${list.map((c) => `<option value="${c.id}" ${c.id === v.collectionId ? 'selected' : ''}>${esc(c.name)} · ${esc(c.season)} ${c.year}</option>`).join('')}`;
  }
  function fillSizes() {
    const cat = r.categories.find((c) => c.id === Number(el('categoryId').value));
    const box = $('[data-sizes]', form);
    if (!cat) {
      box.innerHTML = '';
      $('[data-size-hint]', form).textContent = t('staff.ed.pickCategory');
      return;
    }
    const sizes = r.sizes.filter((s) => s.type === cat.sizeType);
    // Размеры другой сетки снимаются при смене категории
    [...selectedSizes].forEach((sid) => !sizes.some((s) => s.id === sid) && selectedSizes.delete(sid));
    if (sizes.length === 1 && !selectedSizes.size) selectedSizes.add(sizes[0].id);
    $('[data-size-hint]', form).textContent = t(`staff.ed.sizeType.${cat.sizeType}`);
    const stockBy = new Map((p?.variants || []).map((x) => [x.sizeId, x]));
    box.innerHTML = sizes
      .map((s) => {
        const st = stockBy.get(s.id);
        return `<button type="button" class="size-btn ${selectedSizes.has(s.id) ? 'is-active' : ''}" data-size="${s.id}" aria-pressed="${selectedSizes.has(s.id)}">${esc(s.label)}${st ? `<small class="t-mono">${st.available}</small>` : ''}</button>`;
      })
      .join('');
  }
  function preview() {
    const price = Number(el('price').value) || 0;
    const old = Number(el('oldPrice').value) || 0;
    const off = old > price && price > 0 ? Math.round((1 - price / old) * 100) : 0;
    $('[data-discount]', form).textContent = off ? `−${off} %` : '—';
    const brand = r.brands.find((b) => b.id === Number(el('brandId').value));
    const cat = r.categories.find((c) => c.id === Number(el('categoryId').value));
    const color = form.querySelector('[name=color]:checked')?.value;
    $('[data-color-name]', form).textContent = color ? t(`colors.${color}`) : '';
    const img = p?.images?.find((i) => i.isMain)?.url || (queued[0] ? URL.createObjectURL(queued[0]) : null);
    const name = getLang() === 'en' ? el('nameEn').value : el('nameRu').value;
    $('[data-preview]', form).innerHTML = `
      <p class="ed-preview__eyebrow t-mono">${esc(t('staff.ed.preview'))}</p>
      <div class="ed-preview__card" style="--b-accent:${esc(brand?.accent || '#5A0F1C')}">
        <div class="ed-preview__media">${img ? `<img src="${esc(img)}" alt="">` : `<svg class="ed-preview__orn" aria-hidden="true"><use href="#orn-cross-filigree"/></svg>`}
          <span class="ed-preview__labels">${el('isNew').checked ? '<span class="label label--new">NEW</span>' : ''}${el('isLimited').checked ? '<span class="label label--limited">LIMITED</span>' : ''}${off ? `<span class="label label--sale">−${off} %</span>` : ''}</span>
          <span class="ed-preview__tag t-mono" aria-hidden="true">${['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map((n) => `<i ${n === '1' ? 'class="is-on"' : ''}>${n}</i>`).join('')}</span>
        </div>
        <p class="ed-preview__brand">${esc(brand?.name || '')}</p>
        <p class="ed-preview__name">${esc(name || t('staff.ed.namePh'))}</p>
        <p class="ed-preview__meta t-mono">${esc(cat ? loc(cat.name) : '—')} · ${esc(color ? t(`colors.${color}`) : '')}</p>
        <p class="ed-preview__price t-mono">${price ? `<span data-price="${price}">${esc(formatPrice(price))}</span>` : '—'}${off ? ` <s data-price="${old}">${esc(formatPrice(old))}</s>` : ''}</p>
      </div>`;
  }
  function drawPhotos() {
    const box = $('[data-photos]', form);
    const list = p ? p.images : [];
    box.innerHTML = `
      ${list
        .map(
          (img) => `<figure class="ed-photo ${img.isMain ? 'is-main' : ''}">
            <img src="${esc(img.url)}" alt="" loading="lazy">
            <figcaption>${img.placeholder ? `<span class="t-mono">${esc(t('staff.ed.placeholder'))}</span>` : `
              ${img.isMain ? `<span class="t-mono">${esc(t('staff.ed.main'))}</span>` : `<button type="button" class="link-u t-mono" data-main="${img.id}">${esc(t('staff.ed.makeMain'))}</button>`}
              <button type="button" class="icon-btn" data-img-del="${img.id}" aria-label="${esc(t('common.delete'))}">${icon('i-trash', 'icon icon--xs')}</button>`}</figcaption>
          </figure>`
        )
        .join('')}
      ${queued.map((f, i) => `<figure class="ed-photo is-queued"><img src="${esc(URL.createObjectURL(f))}" alt=""><figcaption><span class="t-mono">${esc(t('staff.ed.queued'))}</span><button type="button" class="icon-btn" data-q-del="${i}" aria-label="${esc(t('common.delete'))}">${icon('i-trash', 'icon icon--xs')}</button></figcaption></figure>`).join('')}
      <button type="button" class="ed-photo ed-photo--add" data-add-photo>${icon('i-upload')}<span class="t-mono">${esc(t('staff.ed.addPhotos'))}</span></button>`;
  }
  fillCollections();
  fillSizes();
  drawPhotos();
  preview();
  ctx.reveal();

  form.addEventListener('input', preview);
  form.addEventListener('change', (e) => {
    if (e.target.name === 'brandId') fillCollections();
    if (e.target.name === 'categoryId') fillSizes();
    preview();
  });

  async function uploadFiles(files) {
    const fd = new FormData();
    files.forEach((f) => fd.append('images', f));
    ({ product: p } = await api.post(`/seller/products/${p.id}/images`, fd));
  }

  form.addEventListener('click', async (e) => {
    const sz = e.target.closest('[data-size]');
    if (sz) {
      const sid = Number(sz.dataset.size);
      selectedSizes.has(sid) ? selectedSizes.delete(sid) : selectedSizes.add(sid);
      sz.classList.toggle('is-active', selectedSizes.has(sid));
      sz.setAttribute('aria-pressed', String(selectedSizes.has(sid)));
      return;
    }
    if (e.target.closest('[data-add-photo]')) {
      const files = await pickImages();
      if (!files.length) return;
      if (!p) {
        queued.push(...files.slice(0, 8 - queued.length));
        drawPhotos();
        preview();
        return;
      }
      try {
        await uploadFiles(files);
        toast.success(t('staff.ed.photosUploaded'));
        drawPhotos();
        preview();
      } catch (err) {
        toast.error(err.message);
      }
      return;
    }
    const qd = e.target.closest('[data-q-del]');
    if (qd) {
      queued.splice(Number(qd.dataset.qDel), 1);
      drawPhotos();
      preview();
      return;
    }
    const main = e.target.closest('[data-main]');
    if (main) {
      ({ product: p } = await api.patch(`/seller/products/${p.id}/images/${main.dataset.main}/main`));
      drawPhotos();
      preview();
      return;
    }
    const del = e.target.closest('[data-img-del]');
    if (del) {
      if (!(await confirmModal({ title: t('staff.ed.deletePhoto'), danger: true, confirmLabel: t('common.delete') }))) return;
      ({ product: p } = await api.del(`/seller/products/${p.id}/images/${del.dataset.imgDel}`));
      drawPhotos();
      preview();
      return;
    }
    if (e.target.closest('[data-delete]')) {
      if (!(await confirmModal({ title: t('staff.shop.deleteTitle'), text: t('staff.shop.deleteText', { name: title }), danger: true, confirmLabel: t('common.delete') }))) return;
      try {
        const res = await api.del(`/seller/products/${p.id}`);
        if (res.deleted) toast.success(t('staff.shop.deleted'));
        else toast.info(t('staff.shop.unpublished'), res.message);
        ctx.navigate('/account/shop');
      } catch (err) {
        toast.error(err.message);
      }
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    const submitter = e.submitter || $('[data-submit="1"]', form);
    const num = (name) => (el(name).value === '' ? null : Number(el(name).value));
    const payload = {
      brandId: num('brandId'),
      collectionId: num('collectionId'),
      categoryId: num('categoryId'),
      nameRu: el('nameRu').value.trim(),
      nameEn: el('nameEn').value.trim(),
      descriptionRu: el('descriptionRu').value.trim(),
      descriptionEn: el('descriptionEn').value.trim(),
      compositionRu: el('compositionRu').value.trim(),
      compositionEn: el('compositionEn').value.trim(),
      careRu: el('careRu').value.trim(),
      careEn: el('careEn').value.trim(),
      price: num('price'),
      oldPrice: num('oldPrice'),
      gender: form.querySelector('[name=gender]:checked')?.value,
      color: form.querySelector('[name=color]:checked')?.value,
      material: el('material').value,
      country: el('country').value,
      isNew: el('isNew').checked,
      isLimited: el('isLimited').checked,
      sizeIds: [...selectedSizes],
      submit: submitter.dataset.submit === '1',
    };
    await withLoading(submitter, async () => {
      try {
        const res = isNew && !p ? await api.post('/seller/products', payload) : await api.put(`/seller/products/${p.id}`, payload);
        if (!p) ({ product: p } = await api.get(`/seller/products/${res.product.id}`));
        if (queued.length) {
          await uploadFiles(queued.splice(0));
        }
        toast.success(payload.submit ? t('staff.ed.sentToModeration') : t('staff.ed.draftSaved'), `${res.product.sku} · ${t(`staff.mod.${res.product.status}`)}`);
        ctx.navigate(`/account/shop/products/${p.id}`, { replace: true });
      } catch (err) {
        showApiError(form, err);
        if (err.status === 422) $('.field.is-invalid', form)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        else toast.error(err.message);
      }
    });
  });
}

// ---------------------------------------------------------------------------------------------
// Заказы со своими товарами (только просмотр)
// ---------------------------------------------------------------------------------------------
function renderOrders(body) {
  body.innerHTML = `<p class="t-muted acc-note">${esc(t('staff.shop.ordersLead'))}</p><div data-table></div>`;
  createTable($('[data-table]', body), {
    csv: 'amfibia-seller-orders',
    sort: 'created',
    search: { placeholder: t('staff.shop.ordersSearchPh') },
    filters: [{ name: 'status', label: t('staff.col.status'), value: 'all', options: ['all', 'active', 'delivered', 'cancelled', 'returned'].map((s) => ({ value: s, label: s === 'all' ? t('common.all') : s === 'active' ? t('account.filterActive') : t(`statuses.${s}`) })) }],
    load: (s) => api.get('/seller/orders', s),
    empty: { title: t('staff.shop.noOrders') },
    columns: [
      { key: 'orderNumber', label: t('staff.col.order'), sort: 'number', className: 't-mono', render: (o) => `<b>${esc(o.orderNumber)}</b><span class="dt-sub">${esc(fmtDate(o.createdAt))}</span>`, csv: (o) => o.orderNumber },
      { key: 'items', label: t('staff.col.items'), className: 'dt__wide', render: (o) => `<span class="dt-items">${itemsStrip(o.items, 4)}<span>${o.items.map((i) => `${esc(loc(i.name).split(' — ').pop())} <span class="t-mono t-muted">${esc(i.size)} × ${i.qty}</span>`).join('<br>')}</span></span>`, csv: (o) => o.items.map((i) => `${i.sku} ${i.size} x${i.qty}`).join(', ') },
      { key: 'buyer', label: t('staff.col.buyer'), className: 'dt__hide-sm', render: (o) => `${esc(o.buyer)}<span class="dt-sub">${esc(o.city)}</span>`, csv: (o) => `${o.buyer}, ${o.city}` },
      { key: 'status', label: t('staff.col.status'), sort: 'status', render: (o) => statusBadge(o.status), csv: (o) => t(`statuses.${o.status}`) },
      { key: 'total', label: t('staff.col.mySum'), sort: 'sum', className: 't-mono', render: (o) => money(o.total), csv: (o) => o.total },
    ],
  });
}

// ---------------------------------------------------------------------------------------------
// Статистика: KPI с изменением к прошлому периоду, выручка по дням (линия + штуки столбцами), категории, топ товаров
// ---------------------------------------------------------------------------------------------
async function renderStats(body) {
  let days = Number(new URLSearchParams(location.search).get('days')) || 30;
  const charts = [];
  async function draw() {
    charts.splice(0).forEach((c) => c.destroy());
    body.innerHTML = loading();
    const [s, Chart] = await Promise.all([api.get('/seller/stats', { days }), loadChart()]);
    const k = s.kpi;
    body.innerHTML = `
      <div class="stats-head">
        <p class="t-muted">${esc(t('staff.stats.period', { days }))}</p>
        <div class="seg" role="group" aria-label="${esc(t('staff.stats.periodLabel'))}">${[7, 30, 90, 365].map((d) => `<button type="button" data-days="${d}" aria-pressed="${d === days}">${d} ${esc(t('staff.stats.d'))}</button>`).join('')}</div>
      </div>
      ${kpis([
        { label: t('staff.stats.revenue'), value: money(k.revenue), delta: delta(k.revenue, k.revenuePrev) },
        { label: t('staff.stats.orders'), value: fmtNumber(k.orders), delta: delta(k.orders, k.ordersPrev) },
        { label: t('staff.stats.units'), value: fmtNumber(k.units) },
        { label: t('staff.stats.avg'), value: money(k.avg) },
        { label: t('staff.stats.views'), value: fmtNumber(k.views), hint: t('staff.stats.rating', { r: fmtNumber(k.rating, { maximumFractionDigits: 2 }), n: k.live }) },
      ])}
      <div class="charts">
        <figure class="chart chart--wide" data-reveal><figcaption class="chart__cap"><span class="t-mono">01</span>${esc(t('staff.stats.byDay'))}</figcaption><div class="chart__box"><canvas data-chart-daily aria-label="${esc(t('staff.stats.byDay'))}" role="img"></canvas></div></figure>
        <figure class="chart" data-reveal><figcaption class="chart__cap"><span class="t-mono">02</span>${esc(t('staff.stats.byCategory'))}</figcaption><div class="chart__box chart__box--sq">${s.categories.length ? `<canvas data-chart-cats role="img" aria-label="${esc(t('staff.stats.byCategory'))}"></canvas>` : empty({ title: t('staff.stats.noSales') })}</div></figure>
        <figure class="chart" data-reveal><figcaption class="chart__cap"><span class="t-mono">03</span>${esc(t('staff.stats.top'))}</figcaption>
          ${s.top.length ? `<ol class="toplist">${s.top
            .map(
              (p, i) => `<li><span class="toplist__n t-mono">${String(i + 1).padStart(2, '0')}</span><img src="${esc(p.image)}" alt="" loading="lazy">
                <span class="toplist__body"><a href="/product/${p.id}" target="_blank" rel="noopener">${esc(loc(p.name))}</a><span class="t-mono t-muted">${esc(p.brand)} · ${p.units} ${esc(t('common.pcs'))} · ${fmtNumber(p.views)} ${esc(t('staff.stats.viewsShort'))}</span>
                <span class="toplist__bar" style="--w:${Math.max(4, (p.revenue / s.top[0].revenue) * 100)}%"></span></span>
                <span class="toplist__sum t-mono">${money(p.revenue)}</span></li>`
            )
            .join('')}</ol>` : empty({ title: t('staff.stats.noSales') })}</figure>
      </div>`;
    const c = chartTheme();
    chartDefaults(Chart, c);
    const labels = s.daily.map((d) => fmtDate(d.day, days > 90 ? { month: 'short', day: 'numeric' } : { day: 'numeric', month: 'short' }));
    const ctx2d = $('[data-chart-daily]', body).getContext('2d');
    const grad = ctx2d.createLinearGradient(0, 0, 0, 320);
    grad.addColorStop(0, `${c.accent}55`);
    grad.addColorStop(1, `${c.accent}00`);
    charts.push(
      new Chart(ctx2d, {
        data: {
          labels,
          datasets: [
            { type: 'line', label: t('staff.stats.revenue'), data: s.daily.map((d) => d.revenue), borderColor: c.accent, backgroundColor: grad, fill: true, tension: 0.35, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2, yAxisID: 'y' },
            { type: 'bar', label: t('staff.stats.units'), data: s.daily.map((d) => d.units), backgroundColor: `${c.silver}40`, borderRadius: 1, yAxisID: 'y1', barPercentage: 0.6 },
          ],
        },
        options: {
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          scales: {
            x: { grid: { display: false }, ticks: { maxTicksLimit: 10 } },
            y: { grid: { color: c.line }, ticks: { callback: (val) => formatPrice(val).replace(/,00(?=\D*$)|\.00(?=\D*$)/, '') } },
            y1: { position: 'right', grid: { display: false }, ticks: { precision: 0 } },
          },
          plugins: { tooltip: { callbacks: { label: (it) => (it.datasetIndex === 0 ? ` ${formatPrice(it.raw)}` : ` ${it.raw} ${t('common.pcs')}`) } } },
        },
      })
    );
    const cats = $('[data-chart-cats]', body);
    if (cats) {
      charts.push(
        new Chart(cats, {
          type: 'doughnut',
          data: { labels: s.categories.map((x) => loc(x.name)), datasets: [{ data: s.categories.map((x) => x.revenue), backgroundColor: seriesColors(c), borderColor: c.surface, borderWidth: 2 }] },
          options: { maintainAspectRatio: false, cutout: '68%', plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: (it) => ` ${formatPrice(it.raw)}` } } } },
        })
      );
    }
    refreshPrices(body);
  }
  await draw();
  body.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-days]');
    if (!b) return;
    days = Number(b.dataset.days);
    history.replaceState(null, '', `/account/shop/stats?days=${days}`);
    await draw();
  });
  // Цвета графиков берутся из CSS-переменных — при смене темы перерисовываем
  const onTheme = () => setTimeout(() => draw().catch(() => {}), 650);
  document.addEventListener('amf:themechange', onTheme);
  return () => {
    document.removeEventListener('amf:themechange', onTheme);
    charts.forEach((c) => c.destroy());
  };
}

// ---------------------------------------------------------------------------------------------
// Отзывы на свои товары
// ---------------------------------------------------------------------------------------------
async function renderReviews(body) {
  let page = 1;
  let rating = '';
  async function draw() {
    const data = await api.get('/seller/reviews', { page, rating });
    const totalApproved = Object.values(data.distribution).reduce((a, b) => a + b, 0);
    const avg = totalApproved ? Object.entries(data.distribution).reduce((s, [r, n]) => s + r * n, 0) / totalApproved : 0;
    body.innerHTML = `
      <div class="rv-sum">
        <div class="rv-sum__avg"><span class="rv-sum__big">${fmtNumber(avg, { maximumFractionDigits: 2 })}</span><span class="stars" style="--value:${avg}" aria-hidden="true"></span><span class="t-mono t-muted">${esc(t('staff.shop.reviewsCount', { n: totalApproved }))}</span></div>
        <ul class="rv-sum__bars">${[5, 4, 3, 2, 1]
          .map((r) => `<li><button type="button" data-rating="${r}" class="${String(r) === String(rating) ? 'is-active' : ''}"><span class="t-mono">${r} ★</span><span class="rv-sum__bar" style="--w:${totalApproved ? (data.distribution[r] / totalApproved) * 100 : 0}%"></span><span class="t-mono">${data.distribution[r]}</span></button></li>`)
          .join('')}</ul>
      </div>
      ${rating ? `<button type="button" class="chip chip--active" data-rating="">${esc(t('staff.shop.ratingFilter', { r: rating }))} ${icon('i-close', 'icon icon--xs')}</button>` : ''}
      ${
        data.rows.length
          ? `<ul class="srv">${data.rows
              .map(
                (r) => `<li class="srv__item" data-reveal>
                  <a class="srv__img" href="/product/${r.product.id}" target="_blank" rel="noopener"><img src="${esc(r.product.image)}" alt="" loading="lazy"></a>
                  <div class="srv__body">
                    <p class="srv__head"><span class="stars" style="--value:${r.rating}" aria-label="${r.rating}/5"></span><b>${esc(r.author)}</b><span class="t-mono t-muted">${esc(fmtDate(r.createdAt))}</span>${r.status !== 'approved' ? statusBadge(r.status, t(`staff.mod.${r.status}`)) : ''}</p>
                    <p class="srv__text">${esc(r.text)}</p>
                    <p class="t-mono t-muted">${esc(loc(r.product.name))} · ${esc(r.product.sku)}</p>
                  </div>
                </li>`
              )
              .join('')}</ul>${data.pages > 1 ? `<nav class="pagination acc-pager">${Array.from({ length: Math.min(data.pages, 20) }, (_, i) => `<button type="button" data-rpage="${i + 1}" ${i + 1 === page ? 'aria-current="page"' : ''}>${i + 1}</button>`).join('')}</nav>` : ''}`
          : empty({ ornament: 'orn-star', title: t('staff.shop.noReviews') })
      }`;
  }
  await draw();
  body.addEventListener('click', async (e) => {
    const r = e.target.closest('[data-rating]');
    if (r) {
      rating = r.dataset.rating;
      page = 1;
      return draw();
    }
    const pg = e.target.closest('[data-rpage]');
    if (pg) {
      page = Number(pg.dataset.rpage);
      await draw();
    }
  });
}
