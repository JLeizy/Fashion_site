// Таблица размеров в модалке (раздел 6.8 ТЗ): сетки EU / IT / US / INT для размеров выбранного товара
// и наличие каждого размера (данные — из /api/products/:id: product_variants + sizes + v_variant_stock).
import { esc } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { openModal } from './modal.js';

export function openSizeChart(product, { selectedVariantId = null } = {}) {
  const type = product.category?.sizeType || product.variants[0]?.type || 'one_size';
  const dash = esc(t('sizeChart.none'));
  const rows = product.variants
    .map(
      (v) => `<tr class="${v.variantId === selectedVariantId ? 'is-selected' : ''} ${v.available > 0 ? '' : 'is-out'}">
        <th scope="row">${esc(v.label)}</th>
        <td>${v.eu ? esc(v.eu) : dash}</td><td>${v.it ? esc(v.it) : dash}</td><td>${v.us ? esc(v.us) : dash}</td>
        <td>${v.available > 0 ? `<span class="status status--ok">${esc(t('sizeChart.inStockN', { n: v.available }))}</span>` : `<span class="status status--muted">${esc(t('product.outOfStock'))}</span>`}</td>
      </tr>`
    )
    .join('');
  const content = `
    <div class="size-chart">
      <p class="t-eyebrow">${esc(product.brand.name)} · ${esc(t(`sizeChart.types.${type}`))}</p>
      <p class="size-chart__intro">${esc(t('sizeChart.intro'))}</p>
      <div class="table-wrap">
        <table class="table size-chart__table">
          <thead><tr><th scope="col">INT</th><th scope="col">EU</th><th scope="col">IT</th><th scope="col">US</th><th scope="col">${esc(t('sizeChart.available'))}</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="size-chart__how">
        <p class="t-eyebrow">${esc(t('sizeChart.how'))}</p>
        <p>${esc(t('sizeChart.howText'))}</p>
        <a class="link-u t-mono" href="/sizes">${esc(t('product.sizeChart'))} →</a>
      </div>
    </div>`;
  return openModal({ title: t('sizeChart.title'), content, size: 'wide', className: 'modal--sizes' });
}

export default openSizeChart;
