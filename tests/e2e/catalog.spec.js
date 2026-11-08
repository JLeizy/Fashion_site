// Каталог: у товаров только настоящие фото (никаких SVG-заглушек), смена цвета показывает снимок этого цвета.
import { test, expect } from '@playwright/test';

test.describe('Каталог и фото товаров', () => {
  test('в выдаче каталога у каждого товара реальное фото', async ({ page }) => {
    const res = await page.request.get('/api/products?limit=48');
    const data = await res.json();
    const items = data.items || data.products || [];
    expect(items.length).toBeGreaterThan(0);
    for (const p of items) {
      expect(p.images?.length, `у товара ${p.id} есть фото`).toBeGreaterThan(0);
      for (const url of p.images) expect(url, `фото товара ${p.id}`).toMatch(/\.webp$/);
    }
  });

  test('переключение цвета открывает тот же товар другого цвета со своим фото', async ({ page }) => {
    // Ищем модель, у которой больше одного цвета
    const list = await (await page.request.get('/api/products?limit=48&sort=popular')).json();
    let product = null;
    for (const p of list.items || list.products || []) {
      const full = await (await page.request.get(`/api/products/${p.id}`)).json();
      const item = full.product || full;
      if ((item.colors || []).length > 1) {
        product = item;
        break;
      }
    }
    test.skip(!product, 'в первой странице каталога нет моделей в нескольких цветах');
    await page.goto(`/product/${product.id}`);
    const mainImg = page.locator('[data-gallery-main] img').first();
    await expect(mainImg).toBeVisible();
    const before = await mainImg.getAttribute('src');
    const other = page.locator('[data-pp-colors] a.pp-color:not(.is-active)').first();
    const href = await other.getAttribute('href');
    await other.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    const after = await page.locator('[data-gallery-main] img').first().getAttribute('src');
    expect(after).not.toBe(before);
  });
});
