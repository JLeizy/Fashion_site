const { chromium } = require('playwright');
const B = 'http://localhost:3000';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, reducedMotion: 'reduce', locale: 'ru-RU' });
  const page = await ctx.newPage();
  // login buyer
  await page.goto(B + '/auth');
  await page.fill('#login-email', 'buyer@amfibia.by');
  await page.fill('#login-password', 'Amfibia2026');
  await page.click('[data-form="login"] [type="submit"]');
  await page.waitForURL(u => !String(u).includes('/auth'), { timeout: 15000 });
  const prods = await (await page.request.get(B + '/api/products?sort=popular&inStock=1&limit=24')).json();
  const items = prods.items || prods.products;
  console.log('first product', items[0].id, items[0].name);
  const urls = process.argv.slice(2);
  for (const u of urls) {
    const url = u.replace('{P}', items[0].id);
    await page.goto(B + url, { waitUntil: 'networkidle' }).catch(e => console.log('goto', e.message));
    await page.waitForTimeout(1500);
    // scroll to trigger lazy
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < h; y += 800) { await page.evaluate(y => window.scrollTo(0, y), y); await page.waitForTimeout(120); }
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(800);
    const name = url.replace(/[\/?=&]/g, '_') || 'home';
    await page.screenshot({ path: `shots/${name}.png`, fullPage: true, scale: 'css' });
    console.log('shot', url, h);
  }
  await browser.close();
})();
