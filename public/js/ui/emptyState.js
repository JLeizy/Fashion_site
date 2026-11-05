// Оформленное пустое состояние на всю ширину рабочей области (правка П7): корзина, избранное, сравнение.
// Слева — орнамент, заголовок, пояснение и кнопка; справа — быстрые ссылки по каталогу;
// ниже — сетка рекомендаций (новинки сезона) из GET /api/products (таблицы products, brands, product_images — SELECT).
import { esc, icon } from '../core/dom.js';
import { t } from '../core/i18n.js';
import api from '../core/api.js';
import { renderCard } from './productCard.js';
import { initReveals, refreshScroll } from './motion.js';
import { refreshPrices } from '../core/currency.js';

const LINKS = [
  ['/catalog?new=1&sort=new', 'nav.promoNew'],
  ['/catalog?iconic=1', 'nav.promoIconic'],
  ['/catalog?sale=1&sort=discount', 'nav.promoSale'],
  ['/histories', 'footer.histories'],
];

export function emptyStateHtml({ orn = 'orn-cross-filigree', title, text, cta }) {
  return `<div class="empty-wide">
    <div class="empty-wide__main">
      <svg class="empty__orn icon--fill" aria-hidden="true"><use href="#${orn}"/></svg>
      <p class="empty-wide__title">${esc(title)}</p>
      <p class="empty__text">${esc(text)}</p>
      ${cta ? `<a class="btn" href="${esc(cta.href)}">${esc(cta.label)}</a>` : ''}
    </div>
    <nav class="empty-wide__links" aria-label="${esc(t('empty.linksAria'))}">
      ${LINKS.map(([href, key], i) => `<a href="${href}"><span class="t-mono">${String(i + 1).padStart(2, '0')}</span><b>${esc(t(key))}</b>${icon('i-arrow-right', 'icon icon--sm')}</a>`).join('')}
    </nav>
  </div>`;
}

// Сетка рекомендаций под пустым состоянием; exclude — id товаров, которые не нужно предлагать
export async function renderEmptyRecs(container, { exclude = [] } = {}) {
  if (!container) return;
  try {
    const res = await api.get('/products', { new: '1', sort: 'new', limit: 14, in_stock: '1' });
    const skip = new Set(exclude);
    const items = res.items.filter((p) => !skip.has(p.id)).slice(0, 10);
    if (!items.length) {
      container.innerHTML = '';
      return;
    }
    container.innerHTML = `<section class="empty-recs">
      <header class="empty-recs__head">
        <div><p class="t-eyebrow">${esc(t('empty.recsEyebrow'))}</p><h2 class="empty-recs__title">${esc(t('empty.recsTitle'))}</h2></div>
        <a class="link-u t-mono" href="/catalog?new=1&sort=new">${esc(t('home.allNew'))}</a>
      </header>
      <div class="empty-recs__grid">${items.map((p) => renderCard(p)).join('')}</div>
    </section>`;
    refreshPrices();
    initReveals(container);
    refreshScroll();
  } catch (err) {
    console.error(err);
  }
}
