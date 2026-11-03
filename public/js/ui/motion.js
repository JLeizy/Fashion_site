// Анимации и прокрутка (раздел 10.4 ТЗ): Lenis (инерционная прокрутка), GSAP + ScrollTrigger
// (появление при прокрутке, параллакс, раскрытие clip-path), SplitType (разбивка текста),
// магнитные кнопки, ripple, лёгкий 3D-наклон карточек. При prefers-reduced-motion всё тяжёлое отключено.
import { $$, reducedMotion, isTouch } from '../core/dom.js';

let lenis = null;
const html = document.documentElement;

export const hasGsap = () => Boolean(window.gsap && window.ScrollTrigger);

export function initSmoothScroll() {
  if (window.gsap && window.ScrollTrigger) window.gsap.registerPlugin(window.ScrollTrigger);
  if (reducedMotion() || !window.Lenis) return null;
  lenis = new window.Lenis({
    duration: 1.15,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    wheelMultiplier: 0.95,
  });
  if (hasGsap()) {
    lenis.on('scroll', window.ScrollTrigger.update);
    window.gsap.ticker.add((time) => lenis.raf(time * 1000));
    window.gsap.ticker.lagSmoothing(0);
  } else {
    const raf = (time) => {
      lenis.raf(time);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }
  // Якорные ссылки — плавно через Lenis
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute('href').length < 2) return;
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    scrollTo(target);
  });
  return lenis;
}

export const getLenis = () => lenis;

export function stopScroll() {
  if (lenis) lenis.stop();
  html.style.overflow = 'hidden';
}
export function startScroll() {
  if (lenis) lenis.start();
  html.style.overflow = '';
}

export function scrollTo(target, options = {}) {
  const offset = options.offset ?? -110;
  if (lenis) {
    lenis.scrollTo(target, { offset, duration: 1.4, ...options });
    return;
  }
  if (typeof target === 'number') window.scrollTo({ top: target, behavior: reducedMotion() ? 'auto' : 'smooth' });
  else target?.scrollIntoView?.({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
}

// Разбивка текста на буквы / слова / строки + анимация появления
export function splitAnimate(el, { scroll = true, delay = 0 } = {}) {
  const gsap = window.gsap;
  el.classList.add('is-split');
  if (!gsap || !window.SplitType || reducedMotion()) {
    el.style.opacity = '';
    return null;
  }
  const mode = el.dataset.split || 'chars';
  const split = new window.SplitType(el, { types: mode === 'lines' ? 'lines,words' : mode === 'words' ? 'words' : 'words,chars', lineClass: 'split-line' });
  const targets = mode === 'chars' ? split.chars : split.words;
  const from = mode === 'chars' ? { yPercent: 110, opacity: 0, rotate: 6 } : { yPercent: 105, opacity: 0 };
  gsap.set(targets, from);
  const play = () =>
    gsap.to(targets, {
      yPercent: 0,
      opacity: 1,
      rotate: 0,
      duration: mode === 'chars' ? 1.1 : 1.2,
      ease: 'expo.out',
      stagger: mode === 'chars' ? 0.025 : 0.06,
      delay,
    });
  if (scroll && hasGsap()) {
    window.ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: play });
  } else {
    play();
  }
  return split;
}

// Появление элементов при прокрутке: [data-reveal], [data-clip-reveal], [data-parallax], [data-split]
export function initReveals(root = document) {
  const gsap = window.gsap;
  if (reducedMotion() || !hasGsap()) {
    $$('[data-reveal], [data-clip-reveal], [data-split]', root).forEach((el) => {
      el.style.opacity = '1';
      el.style.transform = 'none';
      el.style.clipPath = 'none';
      el.classList.add('is-split');
    });
    return;
  }
  const ST = window.ScrollTrigger;
  const pending = $$('[data-reveal]:not(.is-revealed)', root);
  pending.forEach((el) => el.classList.add('is-revealed'));
  if (pending.length) {
    ST.batch(pending, {
      start: 'top 92%',
      once: true,
      onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.07, overwrite: true }),
    });
  }
  $$('[data-clip-reveal]:not(.is-revealed)', root).forEach((el) => {
    el.classList.add('is-revealed');
    gsap.to(el, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: 'expo.inOut', scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
  });
  $$('[data-parallax]:not(.is-revealed)', root).forEach((el) => {
    el.classList.add('is-revealed');
    const amount = Number(el.dataset.parallax) || 0.12;
    gsap.fromTo(el, { yPercent: -amount * 100 }, { yPercent: amount * 100, ease: 'none', scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
  $$('[data-split]:not(.is-split)', root).forEach((el) => splitAnimate(el));
}

export function refreshScroll() {
  if (hasGsap()) window.ScrollTrigger.refresh();
  lenis?.resize?.();
}

// Магнитные кнопки: элемент тянется к курсору
export function initMagnetic(root = document) {
  if (isTouch() || reducedMotion() || !window.gsap) return;
  $$('[data-magnetic]:not([data-magnetic-bound])', root).forEach((el) => {
    el.setAttribute('data-magnetic-bound', '');
    const strength = Number(el.dataset.magnetic) || 0.3;
    const xTo = window.gsap.quickTo(el, 'x', { duration: 0.7, ease: 'elastic.out(1, 0.45)' });
    const yTo = window.gsap.quickTo(el, 'y', { duration: 0.7, ease: 'elastic.out(1, 0.45)' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - r.left - r.width / 2) * strength);
      yTo((e.clientY - r.top - r.height / 2) * strength);
    });
    el.addEventListener('pointerleave', () => {
      xTo(0);
      yTo(0);
    });
  });
}

// Ripple при нажатии на кнопки (делегирование событий)
export function initRipple() {
  document.addEventListener('pointerdown', (e) => {
    const host = e.target.closest('.btn, [data-ripple]');
    if (!host || reducedMotion()) return;
    const r = host.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2.2;
    const span = document.createElement('span');
    span.className = 'ripple';
    span.style.width = span.style.height = `${size}px`;
    span.style.left = `${e.clientX - r.left - size / 2}px`;
    span.style.top = `${e.clientY - r.top - size / 2}px`;
    host.appendChild(span);
    setTimeout(() => span.remove(), 750);
  });
}

// Лёгкий 3D-наклон карточек: [data-tilt] получает CSS-переменные --tilt-x / --tilt-y
export function initTilt() {
  if (isTouch() || reducedMotion()) return;
  let active = null;
  document.addEventListener(
    'pointermove',
    (e) => {
      const card = e.target.closest('[data-tilt]');
      if (active && active !== card) {
        active.style.setProperty('--tilt-x', '0deg');
        active.style.setProperty('--tilt-y', '0deg');
      }
      active = card;
      if (!card) return;
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty('--tilt-x', `${(-py * 6).toFixed(2)}deg`);
      card.style.setProperty('--tilt-y', `${(px * 7).toFixed(2)}deg`);
    },
    { passive: true }
  );
}

// Состояние прокрутки: уменьшение шапки, прогресс для кнопки «наверх» и края экрана
export function initScrollState(onProgress) {
  let ticking = false;
  const update = () => {
    ticking = false;
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    html.classList.toggle('is-scrolled', y > 40);
    onProgress?.(max > 0 ? Math.min(1, y / max) : 0, y);
  };
  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true }
  );
  update();
}
