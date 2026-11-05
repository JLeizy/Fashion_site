// Галерея товара (раздел 6.8 ТЗ): главное фото + миниатюры, увеличение при наведении (лупа),
// полноэкранный просмотр с листанием стрелками, клавиатурой и свайпом; на телефоне — свайп и точки.
import { $, $$, esc, icon, isTouch } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { openModal } from './modal.js';

export function createGallery(root, { images = [], alt = '' } = {}) {
  const main = $('[data-gallery-main]', root);
  const thumbs = $('[data-gallery-thumbs]', root);
  const dots = $('[data-gallery-dots]', root);
  const expand = $('[data-gallery-expand]', root);
  let index = 0;

  main.innerHTML = `<div class="pp-gallery__track" data-gallery-track>${images
    .map(
      (src, i) => `<div class="pp-gallery__slide" data-slide="${i}">
        <img src="${esc(src)}" alt="${esc(i === 0 ? alt : `${alt} — ${i + 1}`)}" width="1000" height="1250" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" draggable="false">
      </div>`
    )
    .join('')}</div>`;
  const track = $('[data-gallery-track]', main);
  thumbs.innerHTML = images
    .map(
      (src, i) => `<button type="button" class="pp-thumb ${i === 0 ? 'is-active' : ''}" role="tab" aria-selected="${i === 0}" data-thumb="${i}" aria-label="${esc(t('product.imageOf', { i: i + 1, n: images.length }))}">
        <img src="${esc(src)}" alt="" width="800" height="1000" loading="lazy" decoding="async"></button>`
    )
    .join('');
  if (dots) dots.innerHTML = images.map((_, i) => `<span class="${i === 0 ? 'is-active' : ''}"></span>`).join('');
  root.classList.toggle('is-single', images.length < 2);

  function go(i, { scroll = true } = {}) {
    index = (i + images.length) % images.length;
    $$('[data-thumb]', thumbs).forEach((b, n) => {
      b.classList.toggle('is-active', n === index);
      b.setAttribute('aria-selected', String(n === index));
    });
    if (dots) $$('span', dots).forEach((d, n) => d.classList.toggle('is-active', n === index));
    if (scroll) track.scrollTo({ left: track.clientWidth * index, behavior: 'smooth' });
  }

  thumbs.addEventListener('click', (e) => {
    const b = e.target.closest('[data-thumb]');
    if (b) go(Number(b.dataset.thumb));
  });
  thumbs.addEventListener('mouseover', (e) => {
    const b = e.target.closest('[data-thumb]');
    if (b && !isTouch()) go(Number(b.dataset.thumb));
  });
  // Свайп на телефоне: слайды на scroll-snap, индекс определяем по прокрутке
  track.addEventListener(
    'scroll',
    () => {
      const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
      if (i !== index) go(i, { scroll: false });
    },
    { passive: true }
  );

  // Лупа: фото увеличивается в 2,2 раза, точка увеличения следует за курсором (только transform)
  if (!isTouch()) {
    main.addEventListener('pointermove', (e) => {
      const slide = $(`[data-slide="${index}"] img`, track);
      if (!slide) return;
      const r = main.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 100;
      const y = ((e.clientY - r.top) / r.height) * 100;
      slide.style.transformOrigin = `${x}% ${y}%`;
      main.classList.add('is-zoomed');
    });
    main.addEventListener('pointerleave', () => main.classList.remove('is-zoomed'));
  }
  main.addEventListener('click', () => openLightbox(index));
  expand?.addEventListener('click', () => openLightbox(index));

  function openLightbox(start) {
    let current = start;
    const holder = document.createElement('div');
    holder.className = 'lightbox';
    holder.innerHTML = `
      <div class="lightbox__stage"><img data-lb-img alt=""></div>
      <button type="button" class="icon-btn lightbox__nav lightbox__nav--prev" data-lb-prev aria-label="${esc(t('product.prevImage'))}">${icon('i-arrow-left')}</button>
      <button type="button" class="icon-btn lightbox__nav lightbox__nav--next" data-lb-next aria-label="${esc(t('product.nextImage'))}">${icon('i-arrow-right')}</button>
      <p class="lightbox__counter t-mono" data-lb-counter></p>
      <div class="lightbox__thumbs">${images.map((src, i) => `<button type="button" data-lb-thumb="${i}" aria-label="${esc(t('product.imageOf', { i: i + 1, n: images.length }))}"><img src="${esc(src)}" alt=""></button>`).join('')}</div>`;
    const modal = openModal({ size: 'full', content: holder, className: 'modal--lightbox', labelledBy: 'lb-counter' });
    const img = $('[data-lb-img]', holder);
    const counter = $('[data-lb-counter]', holder);
    counter.id = 'lb-counter';
    const show = (i) => {
      current = (i + images.length) % images.length;
      img.classList.remove('is-in');
      void img.offsetWidth;
      img.src = images[current];
      img.alt = `${alt} — ${current + 1}`;
      img.classList.add('is-in');
      counter.textContent = t('product.imageOf', { i: current + 1, n: images.length });
      $$('[data-lb-thumb]', holder).forEach((b, n) => b.classList.toggle('is-active', n === current));
    };
    holder.addEventListener('click', (e) => {
      if (e.target.closest('[data-lb-prev]')) show(current - 1);
      else if (e.target.closest('[data-lb-next]')) show(current + 1);
      const th = e.target.closest('[data-lb-thumb]');
      if (th) show(Number(th.dataset.lbThumb));
    });
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') show(current - 1);
      if (e.key === 'ArrowRight') show(current + 1);
    };
    document.addEventListener('keydown', onKey);
    // Свайп в полноэкранном режиме
    let startX = null;
    holder.addEventListener('pointerdown', (e) => (startX = e.clientX));
    holder.addEventListener('pointerup', (e) => {
      if (startX === null) return;
      const dx = e.clientX - startX;
      startX = null;
      if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
    });
    const close = modal.close.bind(modal);
    modal.close = () => {
      document.removeEventListener('keydown', onKey);
      close();
      go(current);
    };
    show(start);
    if (images.length < 2) holder.classList.add('is-single');
  }

  return { go, open: openLightbox, get index() { return index; } };
}

export default createGallery;
