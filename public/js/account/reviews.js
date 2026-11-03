// Кабинет → Мои отзывы: оценка, текст и статус модерации. API: GET /api/account/reviews (reviews JOIN products)
import { esc } from '../core/dom.js';
import { t, loc, fmtDate } from '../core/i18n.js';
import api from '../core/api.js';
import { statusBadge, empty, loading } from './common.js';

export async function render(view) {
  view.innerHTML = loading();
  const { reviews } = await api.get('/account/reviews');
  view.innerHTML = reviews.length
    ? `<ul class="rvlist">${reviews
        .map(
          (r) => `<li class="rvitem" data-reveal>
            <a class="rvitem__img" href="/product/${r.product.id}"><img src="${esc(r.product.image)}" alt="" loading="lazy"></a>
            <div class="rvitem__body">
              <p class="t-mono t-muted">${esc(r.product.brand)}</p>
              <a class="rvitem__name" href="/product/${r.product.id}#reviews">${esc(loc(r.product.name))}</a>
              <span class="stars" style="--value:${r.rating}" role="img" aria-label="${esc(t('product.ratingAria', { rating: r.rating }))}"></span>
              <p class="rvitem__text">${esc(r.text)}</p>
            </div>
            <div class="rvitem__side">${statusBadge(r.status, t(`account.reviewStatus.${r.status}`))}<span class="t-mono t-muted">${esc(fmtDate(r.createdAt))}</span></div>
          </li>`
        )
        .join('')}</ul>`
    : empty({ ornament: 'orn-fleur', title: t('account.noReviews'), text: t('reviews.notBought') });
}
