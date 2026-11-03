// Хлебные крошки на внутренних страницах (раздел 6.1 ТЗ). items: [{ href, label }], последний — текущая страница.
import { esc } from '../core/dom.js';

export function renderBreadcrumbs(el, items) {
  if (!el) return;
  el.innerHTML = `<ol class="breadcrumbs__list breadcrumbs">${items
    .map((item, i) =>
      i === items.length - 1 || !item.href
        ? `<li><span aria-current="page">${esc(item.label)}</span></li>`
        : `<li><a href="${esc(item.href)}">${esc(item.label)}</a></li>`
    )
    .join('')}</ol>`;
}
