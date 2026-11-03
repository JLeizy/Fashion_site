// Слайдер hero на главной (раздел 6.3, 10.4 ТЗ): «жидкий» WebGL-переход между слайдами (OGL, фрагментный шейдер
// с шумовым смещением и RGB-сдвигом), лёгкое искажение под курсором, автопрокрутка с индикатором,
// свайп, стрелки клавиатуры. Без WebGL или при prefers-reduced-motion — переход раскрытием clip-path на DOM-картинках.
import { $, $$, reducedMotion, isTouch } from '../core/dom.js';

const VERTEX = /* glsl */ `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D tFrom;
uniform sampler2D tTo;
uniform float uProgress;
uniform float uTime;
uniform float uDir;
uniform vec2 uRes;
uniform vec2 uFromSize;
uniform vec2 uToSize;
uniform vec2 uMouse;
uniform float uHover;
varying vec2 vUv;

// object-fit: cover для текстуры
vec2 cover(vec2 uv, vec2 res, vec2 size) {
  float rs = res.x / res.y;
  float ri = size.x / size.y;
  vec2 scale = rs < ri ? vec2(rs / ri, 1.0) : vec2(1.0, ri / rs);
  return (uv - 0.5) * scale + 0.5;
}

// Шум Перлина-подобный (value noise + fbm) — для «жидкой» границы перехода
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = vUv;
  // Лёгкая «волна» вокруг курсора
  vec2 m = uMouse;
  float aspect = uRes.x / uRes.y;
  float dist = distance(vec2(uv.x * aspect, uv.y), vec2(m.x * aspect, m.y));
  float ripple = smoothstep(0.35, 0.0, dist) * uHover;
  uv += (uv - m) * ripple * 0.035 * sin(dist * 40.0 - uTime * 3.0);

  float n = fbm(uv * 3.2 + vec2(uTime * 0.04, 0.0));
  // Граница перехода идёт по направлению листания и «рвётся» шумом
  float edge = (uDir > 0.0 ? uv.x : 1.0 - uv.x) * 0.55 + n * 0.45;
  float p = uProgress * 1.5 - 0.25;
  float mask = smoothstep(p - 0.12, p + 0.12, edge);
  mask = 1.0 - mask;

  float push = sin(uProgress * 3.14159);
  vec2 dispFrom = vec2((n - 0.5) * 0.25 * uProgress * uDir, (n - 0.5) * 0.08 * push);
  vec2 dispTo = vec2(-(n - 0.5) * 0.25 * (1.0 - uProgress) * uDir, -(n - 0.5) * 0.08 * push);

  vec2 uvFrom = cover(uv + dispFrom, uRes, uFromSize);
  vec2 uvTo = cover(uv + dispTo, uRes, uToSize);

  // RGB-сдвиг на пике перехода
  float shift = 0.012 * push;
  vec4 from = vec4(texture2D(tFrom, uvFrom + vec2(shift, 0.0)).r, texture2D(tFrom, uvFrom).g, texture2D(tFrom, uvFrom - vec2(shift, 0.0)).b, 1.0);
  vec4 to = vec4(texture2D(tTo, uvTo - vec2(shift, 0.0)).r, texture2D(tTo, uvTo).g, texture2D(tTo, uvTo + vec2(shift, 0.0)).b, 1.0);

  vec4 color = mix(from, to, mask);
  // Светящаяся кромка «разрыва»
  float glow = smoothstep(0.0, 0.5, mask) * smoothstep(1.0, 0.5, mask) * push;
  color.rgb += glow * vec3(0.35, 0.08, 0.12);
  gl_FragColor = color;
}`;

// SVG-заглушки растеризуем в canvas: так текстура не зависит от поддержки SVG в WebGL и имеет нужный размер
function rasterize(src, width) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      const ratio = (img.naturalHeight || 1080) / (img.naturalWidth || 1920);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = Math.round(width * ratio);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function createHeroSlider(root, { slides, interval = 7000, onChange = null } = {}) {
  const stage = $('[data-hero-stage]', root);
  const progress = $('[data-hero-progress]', root);
  let index = 0;
  let busy = false;
  let timer = null;
  let started = 0;
  let paused = false;
  let gl = null;

  // DOM-слои (fallback и для мгновенного первого кадра)
  stage.innerHTML = slides
    .map((s, i) => `<div class="hero__img ${i === 0 ? 'is-active' : ''}" data-hero-img="${i}"><img src="${s.image}" alt="" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></div>`)
    .join('');

  // ---------- WebGL ----------
  async function initWebGL() {
    if (reducedMotion()) return null;
    let OGL;
    try {
      OGL = await import('/vendor/ogl/index.js');
    } catch {
      return null;
    }
    const { Renderer, Program, Mesh, Triangle, Texture } = OGL;
    let renderer;
    try {
      renderer = new Renderer({ dpr: Math.min(window.devicePixelRatio, 1.75), alpha: false, antialias: false });
    } catch {
      return null;
    }
    const ctx = renderer.gl;
    if (!ctx) return null;
    const width = Math.min(2048, Math.round(window.innerWidth * Math.min(window.devicePixelRatio, 1.5)));
    const canvases = await Promise.all(slides.map((s) => rasterize(s.image, width)));
    if (canvases.some((c) => !c)) return null;
    const textures = canvases.map((image) => new Texture(ctx, { image, generateMipmaps: false, minFilter: ctx.LINEAR }));
    const size = (i) => [canvases[i].width, canvases[i].height];
    const program = new Program(ctx, {
      vertex: VERTEX,
      fragment: FRAGMENT,
      uniforms: {
        tFrom: { value: textures[0] },
        tTo: { value: textures[0] },
        uProgress: { value: 0 },
        uTime: { value: 0 },
        uDir: { value: 1 },
        uRes: { value: [1, 1] },
        uFromSize: { value: size(0) },
        uToSize: { value: size(0) },
        uMouse: { value: [0.5, 0.5] },
        uHover: { value: 0 },
      },
    });
    const mesh = new Mesh(ctx, { geometry: new Triangle(ctx), program });
    ctx.canvas.className = 'hero__canvas';
    ctx.canvas.setAttribute('aria-hidden', 'true');
    stage.appendChild(ctx.canvas);

    const resize = () => {
      const r = stage.getBoundingClientRect();
      renderer.setSize(r.width, r.height);
      program.uniforms.uRes.value = [r.width, r.height];
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });

    // Курсор: плавное следование (lerp) и сила волны
    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, hover: 0, th: 0 };
    if (!isTouch()) {
      root.addEventListener('pointermove', (e) => {
        const r = stage.getBoundingClientRect();
        mouse.tx = (e.clientX - r.left) / r.width;
        mouse.ty = 1 - (e.clientY - r.top) / r.height;
        mouse.th = 1;
      });
      root.addEventListener('pointerleave', () => (mouse.th = 0));
    }

    let visible = true;
    new IntersectionObserver(([entry]) => (visible = entry.isIntersecting)).observe(root);
    const loop = (t) => {
      requestAnimationFrame(loop);
      if (!visible || document.hidden) return;
      mouse.x += (mouse.tx - mouse.x) * 0.08;
      mouse.y += (mouse.ty - mouse.y) * 0.08;
      mouse.hover += (mouse.th - mouse.hover) * 0.05;
      program.uniforms.uMouse.value = [mouse.x, mouse.y];
      program.uniforms.uHover.value = mouse.hover;
      program.uniforms.uTime.value = t / 1000;
      renderer.render({ scene: mesh });
    };
    requestAnimationFrame(loop);
    root.classList.add('is-webgl');

    return {
      transition(from, to, dir) {
        return new Promise((resolve) => {
          const u = program.uniforms;
          u.tFrom.value = textures[from];
          u.tTo.value = textures[to];
          u.uFromSize.value = size(from);
          u.uToSize.value = size(to);
          u.uDir.value = dir;
          u.uProgress.value = 0;
          if (window.gsap) {
            window.gsap.to(u.uProgress, { value: 1, duration: 1.6, ease: 'power3.inOut', onComplete: resolve });
          } else {
            const start = performance.now();
            const step = (now) => {
              const k = Math.min(1, (now - start) / 1600);
              u.uProgress.value = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
              if (k < 1) requestAnimationFrame(step);
              else resolve();
            };
            requestAnimationFrame(step);
          }
        });
      },
    };
  }

  gl = await initWebGL();

  // ---------- Переход без WebGL: новый слой раскрывается clip-path ----------
  function domTransition(from, to, dir) {
    const imgs = $$('[data-hero-img]', stage);
    imgs.forEach((el, i) => el.classList.toggle('is-active', i === to));
    imgs[to].style.setProperty('--dir', dir > 0 ? '1' : '-1');
    imgs[to].classList.remove('is-entering');
    void imgs[to].offsetWidth;
    imgs[to].classList.add('is-entering');
    return new Promise((r) => setTimeout(r, reducedMotion() ? 0 : 1300));
  }

  async function go(next, dir = 1) {
    if (busy || next === index) return;
    busy = true;
    const from = index;
    index = (next + slides.length) % slides.length;
    onChange?.(index, from, dir);
    restartProgress();
    if (gl) {
      $$('[data-hero-img]', stage).forEach((el, i) => el.classList.toggle('is-active', i === index));
      await gl.transition(from, index, dir);
    } else {
      await domTransition(from, index, dir);
    }
    busy = false;
  }

  // ---------- Автопрокрутка с индикатором ----------
  function restartProgress() {
    started = performance.now();
    if (progress) progress.style.transform = 'scaleX(0)';
  }
  function tick(now) {
    timer = requestAnimationFrame(tick);
    if (paused || document.hidden || busy) {
      started += 16;
      return;
    }
    const k = Math.min(1, (now - started) / interval);
    if (progress) progress.style.transform = `scaleX(${k})`;
    if (k >= 1) go(index + 1, 1);
  }
  restartProgress();
  if (slides.length > 1) timer = requestAnimationFrame(tick);
  root.addEventListener('pointerenter', () => (paused = true));
  root.addEventListener('pointerleave', () => (paused = false));
  root.addEventListener('focusin', () => (paused = true));
  root.addEventListener('focusout', () => (paused = false));

  // Свайп
  let sx = null;
  root.addEventListener('touchstart', (e) => (sx = e.touches[0].clientX), { passive: true });
  root.addEventListener('touchend', (e) => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx;
    sx = null;
    if (Math.abs(dx) > 50) go(index + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
  });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') go(index + 1, 1);
    if (e.key === 'ArrowLeft') go(index - 1, -1);
  });

  return {
    next: () => go(index + 1, 1),
    prev: () => go(index - 1, -1),
    goTo: (i) => go(i, i > index ? 1 : -1),
    get index() {
      return index;
    },
    isWebGL: Boolean(gl),
    destroy() {
      cancelAnimationFrame(timer);
    },
  };
}

export default createHeroSlider;
