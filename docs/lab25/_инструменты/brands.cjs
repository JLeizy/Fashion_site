// Все 15 страниц брендов и 15 историй (у каждого дома своя микростилистика)
const path = require('path');
const L = require('./lib.cjs');
const OUT = '/home/user/Fashion_site/docs/lab25/3_Прототип';
const only = process.argv[2] ? new RegExp(process.argv[2], 'i') : null;
const trimTo = (sel, keep) => `document.querySelectorAll(${JSON.stringify(sel)}).forEach((e, i) => { if (i >= ${keep}) e.remove(); });`;
(async () => {
  const browser = await L.chromium.launch();
  const ctx = await L.newContext(browser);
  const p0 = await ctx.newPage();
  const res = await (await p0.request.get(L.B + '/api/brands')).json();
  const brands = (res.items || res.brands || res).map((b) => ({ slug: b.slug, name: b.name }));
  await p0.close();
  console.log('брендов:', brands.length);
  const shot = async (folder, file, url, prep) => {
    if (only && !only.test(file)) return;
    const page = await ctx.newPage();
    try {
      await page.goto(L.B + url, { waitUntil: 'domcontentloaded' });
      await L.settle(page);
      await L.capture(page, { frameName: file.replace('.svg', ''), outFile: path.join(OUT, folder, file), prep: prep ? new Function(prep) : null });
    } catch (e) { console.log('✗', file, e.message.split('\n')[0]); }
    await page.close();
  };
  for (const [i, b] of brands.entries()) {
    const n = String(i + 1).padStart(2, '0');
    const nm = b.name.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_|_$/g, '');
    await shot('10_Страницы_брендов', `${n}_Бренд_${nm}_1920.svg`, '/brand/' + b.slug);
    await shot('11_Истории_брендов', `${n}_История_${nm}_1920.svg`, '/history/' + b.slug, trimTo('.hs-article > .hs-sec', 3) + trimTo('.tl2__decade', 2) + trimTo('.hs-dir', 4));
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
