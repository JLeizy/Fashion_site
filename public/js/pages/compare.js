// Сравнение /compare (раздел 6.9 ТЗ): до 4 товаров. Таблица — фото, бренд, название, цена, категория,
// коллекция, материал, состав, цвет, размеры в наличии, страна, рейтинг, отзывы. «Только различия»,
// подсветка лучшей цены и лучшего рейтинга, удаление столбца, «В корзину» прямо из таблицы.
// Данные: авторизованный — GET /api/compare (таблица comparisons), гость — GET /api/compare/products?ids=…
import { initApp } from '../app.js';
import { $, $$, esc, icon, storage } from '../core/dom.js';
import { t, loc, onLangChange, countryName } from '../core/i18n.js';
import api from '../core/api.js';
import { formatPrice, onCurrencyChange } from '../core/currency.js';
import { store, compare, cart, isAuth, MAX_COMPARE } from '../core/store.js';
import { renderBreadcrumbs } from '../ui/breadcrumbs.js';
import { labelsHtml, colorVar } from '../ui/productCard.js';
import { flyToCart } from '../ui/flyToCart.js';
import { toast } from '../ui/toast.js';
import { confirmModal } from '../ui/modal.js';
import { withLoading } from '../ui/forms.js';

const app = await initApp();
const root = $('[data-cmp-root]');
const diffToggle = $('[data-cmp-diff]');
let items = [];
diffToggle.checked = storage('amf:compare-diff') === true;

async function load() {
  if (isAuth()) items = (await api.get('/compare')).products;
  else {
    const ids = compare.ids();
    items = ids.length ? (await api.get('/compare/products', { ids: ids.join(',') })).products : [];
  }
}

// Строки таблицы: ключ, подпись, значение для сравнения (text) и HTML ячейки
function rows() {
  const minPrice = Math.min(...items.map((p) => p.price));
  const maxRating = Math.max(...items.map((p) => p.rating));
  const many = items.length > 1;
  return [
    {
      key: 'price',
      label: t('comparePage.rows.price'),
      value: (p) => p.price,
      cell: (p) => `<span class="cmp__price ${many && p.price === minPrice ? 'is-best' : ''}"><span data-price="${p.price}">${formatPrice(p.price)}</span>${p.oldPrice ? ` <s data-price="${p.oldPrice}">${formatPrice(p.oldPrice)}</s>` : ''}${many && p.price === minPrice ? `<em class="cmp__best">${esc(t('comparePage.bestPrice'))}</em>` : ''}</span>`,
    },
    { key: 'category', label: t('comparePage.rows.category'), value: (p) => p.category.slug, cell: (p) => esc(p.category[document.documentElement.lang === 'en' ? 'en' : 'ru']) },
    { key: 'collection', label: t('comparePage.rows.collection'), value: (p) => p.collection?.name || '', cell: (p) => (p.collection ? `${esc(p.collection.name)}<br><span class="t-muted t-mono">${esc(t(`seasons.${p.collection.season}`))} ${p.collection.year}</span>` : '—') },
    { key: 'material', label: t('comparePage.rows.material'), value: (p) => p.material, cell: (p) => esc(t(`materials.${p.material}`)) },
    { key: 'composition', label: t('comparePage.rows.composition'), value: (p) => loc(p.composition), cell: (p) => `<span class="cmp__small">${esc(loc(p.composition))}</span>` },
    { key: 'color', label: t('comparePage.rows.color'), value: (p) => p.color, cell: (p) => `<span class="cmp__color"><span class="color-dot" style="--dot:${colorVar(p.color)}"></span>${esc(t(`colors.${p.color}`))}</span>` },
    {
      key: 'sizes',
      label: t('comparePage.rows.sizes'),
      value: (p) => p.sizes.filter((s) => s.available > 0).map((s) => s.label).join(','),
      cell: (p) => {
        const list = p.sizes.filter((s) => s.available > 0);
        return list.length ? `<span class="cmp__sizes">${list.map((s) => `<span>${esc(s.label)}</span>`).join('')}</span>` : `<span class="t-muted">${esc(t('comparePage.noSizes'))}</span>`;
      },
    },
    { key: 'country', label: t('comparePage.rows.country'), value: (p) => p.country, cell: (p) => esc(countryName(p.country)) },
    {
      key: 'rating',
      label: t('comparePage.rows.rating'),
      value: (p) => p.rating,
      cell: (p) =>
        p.reviewsCount
          ? `<span class="cmp__rating ${many && p.rating === maxRating ? 'is-best' : ''}"><span class="stars" style="--value:${p.rating}"></span> <span class="t-mono">${p.rating.toFixed(1)}</span>${many && p.rating === maxRating ? `<em class="cmp__best">${esc(t('comparePage.bestRating'))}</em>` : ''}</span>`
          : '<span class="t-muted">—</span>',
    },
    { key: 'reviews', label: t('comparePage.rows.reviews'), value: (p) => p.reviewsCount, cell: (p) => `<span class="t-mono">${p.reviewsCount}</span>` },
  ];
}

function render() {
  renderBreadcrumbs($('[data-breadcrumbs]'), [{ href: '/', label: t('nav.home') }, { label: t('header.compare') }]);
  $('[data-cmp-tools]').hidden = !items.length;
  if (!items.length) {
    root.innerHTML = `<div class="empty">
      <svg class="empty__orn icon--fill" aria-hidden="true"><use href="#orn-cross"/></svg>
      <p class="empty__title">${esc(t('comparePage.emptyTitle'))}</p>
      <p class="empty__text">${esc(t('comparePage.emptyText'))}</p>
      <a class="btn" href="/catalog">${esc(t('nav.catalog'))}</a></div>`;
    return;
  }
  const onlyDiff = diffToggle.checked && items.length > 1;
  const allRows = rows();
  const visible = onlyDiff ? allRows.filter((r) => new Set(items.map((p) => JSON.stringify(r.value(p)))).size > 1) : allRows;
  const empty = MAX_COMPARE - items.length;
  const head = items
    .map(
      (p) => `<th scope="col" class="cmp__col" data-col="${p.id}">
        <div class="cmp__head">
          <button type="button" class="icon-btn cmp__remove" data-cmp-remove="${p.id}" aria-label="${esc(t('comparePage.remove'))}" title="${esc(t('comparePage.remove'))}">${icon('i-close', 'icon icon--sm')}</button>
          <a class="cmp__media" href="/product/${p.id}"><img src="${esc(p.images[0])}" alt="" loading="lazy"><span class="cmp__labels">${labelsHtml(p)}</span></a>
          <p class="cmp__brand t-mono">${esc(p.brand.name)}</p>
          <a class="cmp__name" href="/product/${p.id}">${esc(loc(p.name))}</a>
        </div>
      </th>`
    )
    .join('');
  const slots = Array.from({ length: empty }, () => `<th scope="col" class="cmp__col cmp__col--empty"><a class="cmp__slot" href="/catalog">${icon('i-plus')}<span>${esc(t('comparePage.addSlot'))}</span></a></th>`).join('');
  const body = visible
    .map((r) => `<tr data-row="${r.key}"><th scope="row" class="cmp__label t-mono">${esc(r.label)}</th>${items.map((p) => `<td>${r.cell(p)}</td>`).join('')}${'<td class="cmp__col--empty"></td>'.repeat(empty)}</tr>`)
    .join('');
  const cartRow = `<tr class="cmp__cart-row"><th scope="row" class="cmp__label t-mono">${esc(t('comparePage.rows.cart'))}</th>${items
    .map((p) => {
      const avail = p.sizes.filter((s) => s.available > 0);
      if (!avail.length) return `<td><span class="t-muted">${esc(t('product.outOfStock'))}</span></td>`;
      const select =
        avail.length > 1 || avail[0].type !== 'one_size'
          ? `<select class="select select--sm" data-cmp-size="${p.id}" aria-label="${esc(t('comparePage.chooseSize'))}">${avail.map((s) => `<option value="${s.variantId}">${esc(s.label)}</option>`).join('')}</select>`
          : `<input type="hidden" data-cmp-size="${p.id}" value="${avail[0].variantId}">`;
      return `<td><div class="cmp__buy">${select}<button type="button" class="btn btn--sm" data-cmp-add="${p.id}">${esc(t('comparePage.toCart'))}</button></div></td>`;
    })
    .join('')}${'<td class="cmp__col--empty"></td>'.repeat(empty)}</tr>`;
  root.innerHTML = `
    <div class="table-wrap cmp__wrap" data-lenis-prevent>
      <table class="cmp__table" style="--cols:${MAX_COMPARE}">
        <thead><tr><th scope="col" class="cmp__corner"><span class="t-mono">${items.length} / ${MAX_COMPARE}</span></th>${head}${slots}</tr></thead>
        <tbody>${body}${onlyDiff && !visible.length ? `<tr><td colspan="${MAX_COMPARE + 1}" class="t-muted">${esc(t('comparePage.noDiff'))}</td></tr>` : ''}${cartRow}</tbody>
      </table>
    </div>`;
}

root.addEventListener('click', async (e) => {
  const rm = e.target.closest('[data-cmp-remove]');
  if (rm) {
    const id = Number(rm.dataset.cmpRemove);
    $$(`[data-col="${id}"]`, root).forEach((c) => c.classList.add('is-leaving'));
    await compare.remove(id);
    return;
  }
  const add = e.target.closest('[data-cmp-add]');
  if (add) {
    const id = Number(add.dataset.cmpAdd);
    const variantId = Number($(`[data-cmp-size="${id}"]`, root)?.value);
    const p = items.find((x) => x.id === id);
    await withLoading(add, async () => {
      try {
        await Promise.all([flyToCart($(`[data-col="${id}"] img`, root)), cart.add(variantId, 1)]);
        toast.success(t('product.addedToCart'), `${p.brand.name} — ${loc(p.name)}`);
      } catch (err) {
        toast.error(t('cart.error'), err.message);
      }
    });
  }
});

diffToggle.addEventListener('change', () => {
  storage('amf:compare-diff', diffToggle.checked);
  render();
});
$('[data-cmp-clear]').addEventListener('click', async () => {
  const ok = await confirmModal({ title: t('compare.clear'), confirmLabel: t('common.delete'), danger: true });
  if (ok) await compare.clear();
});

// Любое изменение сравнения (здесь, в плавающей панели, на карточках) — перечитываем данные
store.on('compare:change', async () => {
  await load();
  setTimeout(render, 250);
});

try {
  await load();
} catch (err) {
  root.innerHTML = `<p class="notice notice--danger">${esc(err.message)}</p>`;
}
render();
await app.reveal();
onLangChange(render);
onCurrencyChange(render);
