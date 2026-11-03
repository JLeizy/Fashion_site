// Точка входа: npm start → http://localhost:3000
// 1) при USE_EMBEDDED_PG=true поднимает встроенный PostgreSQL;
// 2) проверяет подключение к БД и наличие схемы;
// 3) запускает Express-приложение (server/app.js).
import { config } from './config/index.js';
import { ensureEmbeddedPostgres, stopEmbeddedPostgres } from './db/embedded.js';
import { pool, checkConnection } from './db/pool.js';
import { createApp } from './server/app.js';

await ensureEmbeddedPostgres();

try {
  const info = await checkConnection();
  console.log(`[db] Подключено: ${info.database} @ ${config.db.host}:${config.db.port} (${info.version.split(' on ')[0]})`);
  // SQL: проверяем, что схема создана (to_regclass возвращает NULL, если таблицы нет)
  const { rows } = await pool.query("SELECT to_regclass('public.products') AS products");
  if (!rows[0].products) {
    console.warn('[db] Таблицы не найдены. Выполните: npm run setup  (схема + наполнение + SVG-заглушки)');
  }
} catch (err) {
  console.error(`[db] Нет подключения к PostgreSQL ${config.db.host}:${config.db.port} — ${err.message}`);
  console.error('     Проверьте настройки PG* в .env (или включите USE_EMBEDDED_PG=true).');
  await stopEmbeddedPostgres();
  process.exit(1);
}

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`\n  AMFIBIA запущен → http://localhost:${config.port}\n`);
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[server] ${signal}: остановка…`);
  server.close();
  await pool.end().catch(() => {});
  await stopEmbeddedPostgres().catch(() => {});
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
