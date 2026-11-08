// Вход в аккаунт: правильный пароль открывает личный кабинет, неверный — показывает ошибку и не пускает.
import { test, expect } from '@playwright/test';
import { BUYER, login } from './helpers.js';

test.describe('Вход', () => {
  test('покупатель входит по почте и паролю и видит личный кабинет', async ({ page }) => {
    await login(page, BUYER.email, BUYER.password);
    await page.goto('/account');
    await expect(page).toHaveURL(/\/account/);
    // Кабинет показывает имя покупателя из демо-данных
    await expect(page.getByText(BUYER.firstName).first()).toBeVisible();
  });

  test('неверный пароль — ошибка, вход не выполнен', async ({ page }) => {
    await page.goto('/auth');
    await page.locator('#login-email').fill(BUYER.email);
    await page.locator('#login-password').fill('wrong-password-123');
    await page.locator('[data-form="login"] [type="submit"]').click();
    // Общая ошибка формы («Неверный email или пароль») и по-прежнему страница входа
    const error = page.locator('[data-form="login"] [data-form-error]');
    await expect(error).toBeVisible();
    await expect(error).not.toBeEmpty();
    await expect(page).toHaveURL(/\/auth/);
    const me = await page.request.get('/api/auth/me');
    expect((await me.json()).user ?? null).toBeNull();
  });

  test('без входа корзина и оформление заказа требуют авторизации', async ({ page }) => {
    await page.goto('/checkout');
    await expect(page).toHaveURL(/\/auth/);
  });
});
