// Анимированная готическая текстура на canvas (фон страницы входа, раздел 6.2 ТЗ):
// решётка крестов, мерцающих «волной свечи» по шуму; бордовое свечение за курсором; поднимающиеся искры.
// Крест рисуется в спрайт один раз, кадры — не чаще 30 fps; анимация останавливается вне экрана
// и в скрытой вкладке. При prefers-reduced-motion рисуется один статичный кадр.
import { reducedMotion } from '../core/dom.js';

// Гладкий шум (value noise) для «волны» мерцания
function hash(x, y) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function noise(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function crossSprite(size, color) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const s = size / 2;
  const p = (x, y) => [s + x * s, s + y * s];
  const pts = [[0, -1], [0.22, -0.78], [0.16, -0.2], [0.78, -0.22], [1, 0], [0.78, 0.22], [0.16, 0.2], [0.22, 0.78], [0, 1], [-0.22, 0.78], [-0.16, 0.2], [-0.78, 0.22], [-1, 0], [-0.78, -0.22], [-0.16, -0.2], [-0.22, -0.78]];
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(...p(x * 0.92, y * 0.92)) : g.moveTo(...p(x * 0.92, y * 0.92))));
  g.closePath();
  g.fillStyle = color;
  g.fill();
  return c;
}

export function initGothicCanvas(canvas) {
  if (!canvas) return () => {};
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0;
  let H = 0;
  let sprite = null;
  let colors = {};
  let mouse = { x: 0.3, y: 0.6, tx: 0.3, ty: 0.6 };
  let embers = [];
  let running = true;
  let visible = true;
  let last = 0;
  const SPACING = 64;

  const readColors = () => {
    const css = getComputedStyle(document.documentElement);
    colors = {
      text: css.getPropertyValue('--text').trim() || '#ede6da',
      glow: css.getPropertyValue('--accent-text').trim() || '#d9707f',
      accent: css.getPropertyValue('--accent').trim() || '#5a0f1c',
      light: document.documentElement.dataset.theme === 'light',
    };
    sprite = crossSprite(Math.round(26 * dpr), colors.text);
  };

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    W = r.width;
    H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    embers = Array.from({ length: Math.round((W * H) / 26000) }, () => spawn(true));
  };

  function spawn(anywhere = false) {
    return {
      x: Math.random() * W,
      y: anywhere ? Math.random() * H : H + 10,
      r: 0.6 + Math.random() * 1.8,
      vy: 0.15 + Math.random() * 0.45,
      phase: Math.random() * Math.PI * 2,
      life: 0.4 + Math.random() * 0.6,
    };
  }

  const draw = (time) => {
    const t = time / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Свечение за курсором
    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;
    const gx = mouse.x * W;
    const gy = mouse.y * H;
    const radius = Math.max(W, H) * 0.55;
    const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, radius);
    glow.addColorStop(0, colors.light ? 'rgba(0,0,0,0.06)' : `${colors.accent}aa`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Решётка крестов: прозрачность = шум(x, y, время) + близость к курсору
    const half = sprite.width / dpr / 2;
    for (let y = SPACING / 2; y < H; y += SPACING) {
      const row = Math.round(y / SPACING);
      for (let x = (row % 2 ? SPACING : SPACING / 2); x < W; x += SPACING) {
        const n = noise(x / 300 + t * 0.12, y / 300 - t * 0.08);
        const d = Math.hypot(x - gx, y - gy) / radius;
        // Видны только «гребни» шума — кресты вспыхивают волнами, а не стоят ровной сеткой
        const crest = Math.max(0, n - 0.52) / 0.48;
        const alpha = crest * crest * 0.85 + Math.max(0, 0.28 - d) * 0.9;
        if (alpha < 0.02) continue;
        ctx.globalAlpha = Math.min(colors.light ? 0.22 : 0.6, alpha);
        const scale = 0.45 + crest * 0.75 + Math.max(0, 0.28 - d);
        ctx.drawImage(sprite, x - half * scale, y - half * scale, half * 2 * scale, half * 2 * scale);
      }
    }

    // Искры
    ctx.globalAlpha = 1;
    ctx.fillStyle = colors.glow;
    for (const e of embers) {
      e.y -= e.vy;
      e.x += Math.sin(t * 1.3 + e.phase) * 0.25;
      if (e.y < -10) Object.assign(e, spawn());
      const fade = Math.min(1, e.y / H + 0.1) * e.life;
      ctx.globalAlpha = (colors.light ? 0.25 : 0.7) * fade * (0.6 + 0.4 * Math.sin(t * 4 + e.phase));
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  const loop = (time) => {
    if (!running) return;
    if (visible && !document.hidden && time - last > 33) {
      last = time;
      draw(time);
    }
    requestAnimationFrame(loop);
  };

  const onMove = (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.tx = (e.clientX - r.left) / r.width;
    mouse.ty = (e.clientY - r.top) / r.height;
  };

  readColors();
  resize();
  window.addEventListener('resize', resize);
  document.addEventListener('amf:themechange', () => setTimeout(readColors, 50));

  if (reducedMotion()) {
    draw(4000);
    return () => window.removeEventListener('resize', resize);
  }
  window.addEventListener('pointermove', onMove, { passive: true });
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  });
  io.observe(canvas);
  draw(0);
  requestAnimationFrame(loop);
  return () => {
    running = false;
    io.disconnect();
    window.removeEventListener('resize', resize);
    window.removeEventListener('pointermove', onMove);
  };
}
