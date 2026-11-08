// Общие шаги автотестов
import { expect } from '@playwright/test';

// Демо-покупатель из db/seed-data/users.js (пароль общий для всех тестовых аккаунтов)
export const BUYER = { email: 'buyer@amfibia.by', password: 'Amfibia2026', firstName: 'Ева' };

export async function login(page, email, password) {
  await page.goto('/auth');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.locator('[data-form="login"] [type="submit"]').click();
  // После входа страница уходит с /auth
  await expect(page).not.toHaveURL(/\/auth/, { timeout: 15_000 });
}

// Первый товар каталога, который есть в наличии (берётся из API — тест не зависит от конкретного артикула)
export async function inStockProduct(page) {
  const res = await page.request.get('/api/products?sort=popular&inStock=1&limit=24');
  const data = await res.json();
  const items = data.items || data.products || [];
  const product = items.find((p) => p.inStock !== false);
  expect(product, 'в каталоге есть товар в наличии').toBeTruthy();
  return product;
}
