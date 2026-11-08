// Автотесты главных сценариев (Playwright): npm test
// Перед запуском: npm run setup (база с демо-данными). Сервер стартует сам (npm start) или берётся уже запущенный.
// Браузер один раз: npx playwright install chromium
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT || 3000);

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'ru-RU',
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm start',
    url: `http://localhost:${PORT}/api/home`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
