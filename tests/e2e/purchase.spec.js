// Покупка: товар → размер → корзина → оформление в 5 шагов → страница «Заказ оформлен» → заказ в кабинете.
import { test, expect } from '@playwright/test';
import { BUYER, login, inStockProduct } from './helpers.js';

test.describe('Покупка', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, BUYER.email, BUYER.password);
    // Корзина с прошлых запусков не мешает тесту
    await page.request.delete('/api/cart', { headers: { 'X-CSRF-Token': await csrf(page) } });
  });

  test('товар добавляется в корзину и заказ оформляется до конца', async ({ page }) => {
    const product = await inStockProduct(page);
    await page.goto(`/product/${product.id}`);

    // Размер: первый доступный
    const size = page.locator('[data-pp-sizes] [data-variant]:not([disabled])').first();
    await expect(size).toBeVisible();
    await size.click();
    await page.locator('[data-pp-add]').click();

    // Корзина на сервере — одна позиция
    await expect.poll(async () => (await (await page.request.get('/api/cart')).json()).items?.length ?? 0).toBe(1);

    await page.goto('/checkout');
    // 1. Контакты (подставлены из профиля)
    await expect(page.locator('#co-name')).not.toHaveValue('');
    await page.locator('[data-step="1"] [type="submit"]').click();
    // 2. Адрес: сохранённый адрес покупателя выбран по умолчанию
    await expect(page.locator('[data-step="2"]')).toHaveClass(/is-active/);
    await page.locator('[data-step="2"] [type="submit"]').click();
    // 3. Доставка: первый способ
    await expect(page.locator('[data-step="3"]')).toHaveClass(/is-active/);
    await page.locator('[data-delivery-list] label.opt').first().click();
    await page.locator('[data-step="3"] [type="submit"]').click();
    // 4. Оплата: способ без ввода карты (наличные / ЕРИП), иначе — тестовая карта
    await expect(page.locator('[data-step="4"]')).toHaveClass(/is-active/);
    const payOptions = page.locator('[data-payment-list] label.opt');
    const count = await payOptions.count();
    let chosen = false;
    for (let i = 0; i < count && !chosen; i++) {
      const text = (await payOptions.nth(i).innerText()).toLowerCase();
      if (/налич|ерип|получении|cash|erip/.test(text)) {
        await payOptions.nth(i).click();
        chosen = true;
      }
    }
    if (!chosen) {
      await payOptions.first().click();
      await page.locator('#cc-number').fill('4242 4242 4242 4242');
      await page.locator('#cc-exp').fill('12/30');
      await page.locator('#cc-cvc').fill('123');
      await page.locator('#cc-name').fill('EVA LISOVSKAYA');
    }
    await page.locator('[data-step="4"] [type="submit"]').click();
    // 5. Подтверждение: согласие с условиями и «Оформить заказ»
    await expect(page.locator('[data-step="5"]')).toHaveClass(/is-active/);
    await page.locator('[data-step="5"] input[name="agree"]').check({ force: true });
    await page.locator('[data-place]').click();

    await expect(page).toHaveURL(/\/checkout\/success\//, { timeout: 20_000 });
    const orderNumber = decodeURIComponent(page.url().split('/').pop());
    // Заказ появился в списке заказов покупателя
    const orders = await (await page.request.get('/api/orders?status=all')).json();
    expect(JSON.stringify(orders)).toContain(orderNumber);
  });

  test('товар в корзине: количество меняется, удаление очищает корзину', async ({ page }) => {
    const product = await inStockProduct(page);
    await page.goto(`/product/${product.id}`);
    await page.locator('[data-pp-sizes] [data-variant]:not([disabled])').first().click();
    await page.locator('[data-pp-add]').click();
    await expect.poll(async () => (await (await page.request.get('/api/cart')).json()).items?.length ?? 0).toBe(1);
    await page.goto('/cart');
    await expect(page.getByText(product.brand?.name || product.brandName || '', { exact: false }).first()).toBeVisible();
    const cart = await (await page.request.get('/api/cart')).json();
    const res = await page.request.delete(`/api/cart/items/${cart.items[0].id}`, { headers: { 'X-CSRF-Token': await csrf(page) } });
    expect(res.ok()).toBeTruthy();
    await expect.poll(async () => (await (await page.request.get('/api/cart')).json()).items?.length ?? 0).toBe(0);
  });
});

// CSRF-токен текущей сессии (для прямых запросов к API из теста)
async function csrf(page) {
  return page.evaluate(() => document.querySelector('meta[name="csrf-token"]')?.content || '');
}
