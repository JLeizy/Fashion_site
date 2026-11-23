// Общие шаги: браузер, вход, захват страницы в SVG, превью
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const sharp = require('/home/user/Fashion_site/node_modules/sharp');
const { buildSVG } = require('./build.cjs');

const B = 'http://localhost:3000';
const HERE = __dirname;
const CAPTURE_JS = fs.readFileSync(path.join(HERE, 'capture.js'), 'utf8');
const NAMES_JS = fs.existsSync(path.join(HERE, 'names.js')) ? fs.readFileSync(path.join(HERE, 'names.js'), 'utf8') : '';

async function newContext(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: opts.vh || 1080 }, reducedMotion: 'reduce', locale: 'ru-RU', bypassCSP: true, ...opts.ctx });
  return ctx;
}

async function login(page, email) {
  await page.goto(B + '/auth', { waitUntil: 'domcontentloaded' });
  await page.fill('#login-email', email);
  await page.fill('#login-password', 'Amfibia2026');
  await page.click('[data-form="login"] [type="submit"]');
  await page.waitForURL((u) => !String(u).includes('/auth'), { timeout: 20000 });
}

async function csrf(page) {
  const r = await page.request.get(B + '/api/csrf').catch(() => null);
  if (r && r.ok()) {
    const j = await r.json().catch(() => ({}));
    if (j.token || j.csrfToken) return j.token || j.csrfToken;
  }
  return page.evaluate(() => document.querySelector('meta[name="csrf-token"]')?.content || (document.cookie.match(/csrf[^=]*=([^;]+)/) || [])[1] || '');
}

// Прокрутка вниз-вверх: ленивые картинки и появление блоков
async function settle(page, { scroll = true } = {}) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(600);
  if (scroll) {
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < h; y += 700) {
      await page.evaluate((y) => window.scrollTo(0, y), y);
      await page.waitForTimeout(90);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.evaluate(async () => {
    const imgs = [...document.images];
    imgs.forEach((i) => { i.loading = 'eager'; i.decoding = 'sync'; });
    await Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 4000); }))));
    await document.fonts.ready;
  });
  await page.waitForTimeout(400);
}

// Общая подготовка страницы перед захватом
async function commonPrep(page) {
  await page.addStyleTag({
    content: `
      *,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}
      [data-reveal],[data-split],.reveal{opacity:1!important;transform:none!important}
      .preloader,[data-preloader],.curtain,[data-curtain],.cursor,[data-cursor],.grain,[data-grain],.page-transition{display:none!important}
      html{scroll-behavior:auto!important}
    `,
  });
}

async function capture(page, { frameName, outFile, rootSel = 'body', height, prep, keepCompareBar = false, viewportOnly = false }) {
  await commonPrep(page);
  if (!keepCompareBar) await page.evaluate(() => document.querySelectorAll('.compare-bar,[data-compare-bar]').forEach((e) => e.setAttribute('data-proto-skip', '')));
  if (prep) await page.evaluate(prep);
  await page.waitForTimeout(300);
  await page.addScriptTag({ content: NAMES_JS + '\n' + CAPTURE_JS });
  await page.evaluate(() => window.__protoUnsplit());
  await page.evaluate(() => window.__protoFitWords());
  await page.evaluate(() => window.__protoPseudos());
  if (!viewportOnly) await page.evaluate(() => window.scrollTo(0, 0));
  const H = height || (viewportOnly ? 1080 : await page.evaluate(() => Math.max(1080, Math.ceil(document.documentElement.scrollHeight))));
  const { tree, rasters, bg } = await page.evaluate(({ rootSel, H }) => window.__protoCapture(rootSel, { width: 1920, height: H }), { rootSel, H });
  // Растровые снимки: показываем только нужный элемент
  const rasterMap = {};
  for (const r of rasters) {
    await page.evaluate((id) => {
      const st = document.createElement('style');
      st.id = '__iso';
      st.textContent = `html,body{background:transparent!important} *{visibility:hidden!important} [data-proto-rid="${id}"],[data-proto-rid="${id}"] *{visibility:visible!important}`;
      document.head.appendChild(st);
    }, r.id);
    const clip = { x: Math.max(0, r.box.x), y: Math.max(0, r.box.y), width: Math.min(1920, r.box.w), height: r.box.h };
    let buf;
    try {
      buf = await page.screenshot({ clip, fullPage: !viewportOnly, omitBackground: true, animations: 'disabled' });
    } catch (e) {
      console.log('  raster fail', e.message.slice(0, 80));
    }
    await page.evaluate(() => document.getElementById('__iso')?.remove());
    if (!buf) continue;
    const st = await sharp(buf).stats();
    const outW = Math.round(clip.width * 1.25);
    const pipe = sharp(buf).resize({ width: outW });
    const data = st.isOpaque ? await pipe.jpeg({ quality: 80, mozjpeg: true }).toBuffer() : await pipe.png({ compressionLevel: 9 }).toBuffer();
    const meta = await sharp(data).metadata();
    rasterMap[r.id] = { href: `data:image/${st.isOpaque ? 'jpeg' : 'png'};base64,${data.toString('base64')}`, pw: meta.width, ph: meta.height };
  }
  const { svg, stats } = await buildSVG({ tree, rasterMap, frameName, width: 1920, height: H, bg });
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, svg);
  console.log(`✓ ${frameName}: 1920×${H}, ${(svg.length / 1048576).toFixed(2)} МБ, тексты ${stats.texts}, фото ${stats.images}, иконки ${stats.icons}, группы ${stats.groups}`);
  return { H, stats };
}

// Превью: SVG рисуется в браузере со шрифтами сайта
async function preview(browser, svgFile, jpgFile, scale = 0.5) {
  const svg = fs.readFileSync(svgFile, 'utf8');
  const m = svg.match(/width="(\d+)" height="(\d+)"/);
  const w = Number(m[1]), h = Number(m[2]);
  const page = await browser.newPage({ viewport: { width: w, height: Math.min(h, 4000) }, deviceScaleFactor: scale });
  await page.goto(B + '/api/home');
  await page.setContent(`<!doctype html><html><head><base href="${B}/"><link rel="stylesheet" href="${B}/css/fonts.css"><style>html,body{margin:0;background:#000}svg{display:block}</style></head><body>${svg}</body></html>`, { waitUntil: 'load' });
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.waitForTimeout(300);
  const buf = await page.screenshot({ fullPage: true, type: 'png' });
  await page.close();
  fs.mkdirSync(path.dirname(jpgFile), { recursive: true });
  await sharp(buf).jpeg({ quality: 78, mozjpeg: true }).toFile(jpgFile);
}

module.exports = { B, newContext, login, csrf, settle, capture, preview, chromium };
