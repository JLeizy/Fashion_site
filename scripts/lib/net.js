// Сетевые помощники для скриптов загрузки фото (правка П4).
// 1) Встроенный fetch в Node не использует переменные HTTPS_PROXY/HTTP_PROXY. Если прокси задан, скрипт перезапускает
//    себя с NODE_USE_ENV_PROXY=1 — так одинаково работает и в Linux/облаке, и в Windows (без кросс-платформенных env в npm-скриптах).
// 2) Playwright может стоять в проекте или глобально (npm i -g playwright) — ищем в обоих местах.
import { spawnSync, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

export function ensureProxyAwareFetch() {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
  if (!proxy || process.env.NODE_USE_ENV_PROXY === '1') return;
  const res = spawnSync(process.execPath, ['--no-warnings', ...process.execArgv, ...process.argv.slice(1)], {
    stdio: 'inherit',
    env: { ...process.env, NODE_USE_ENV_PROXY: '1' },
  });
  process.exit(res.status ?? 1);
}

export async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    /* в проекте нет — ищем глобальную установку */
  }
  const require = createRequire(import.meta.url);
  const paths = [process.cwd()];
  try {
    paths.push(execSync('npm root -g', { encoding: 'utf8' }).trim());
  } catch {
    /* npm недоступен */
  }
  (process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean).forEach((p) => paths.push(p));
  try {
    return require(require.resolve('playwright', { paths }));
  } catch {
    throw new Error('Не найден Playwright: npm i -D playwright && npx playwright install chromium');
  }
}

// Браузерный User-Agent для магазинов и Vogue; для Wikimedia — описательный (их правило для автоматических клиентов)
export const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
export const WIKI_UA = 'AmfibiaImageFetcher/1.0 (local non-commercial demo project)';
export const uaFor = (url) => (/wiki(pedia|media)\.org/.test(url) ? WIKI_UA : BROWSER_UA);
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
