// npm run db:schema — создаёт базу (если её нет) и применяет db/schema.sql целиком в одной транзакции.
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { config } from '../config/index.js';
import { ensureEmbeddedPostgres, stopEmbeddedPostgres } from './embedded.js';

// Создаёт базу config.db.database, если её ещё нет (подключение к служебной базе postgres)
export async function ensureDatabaseExists() {
  const admin = new pg.Client({ ...config.db, database: 'postgres' });
  await admin.connect();
  try {
    // SQL: системный каталог pg_database (только чтение)
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [config.db.database]);
    if (rowCount === 0) {
      await admin.query(`CREATE DATABASE "${config.db.database.replace(/"/g, '""')}" ENCODING 'UTF8' TEMPLATE template0`);
      console.log(`[db] Создана база данных "${config.db.database}"`);
    }
  } finally {
    await admin.end();
  }
}

export async function applySchema() {
  const sql = fs.readFileSync(path.join(import.meta.dirname, 'schema.sql'), 'utf8');
  const client = new pg.Client(config.db);
  await client.connect();
  try {
    await client.query('SET client_min_messages TO WARNING');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    // SQL: проверка результата по системным каталогам
    const { rows } = await client.query(
      `SELECT (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS tables,
              (SELECT COUNT(*) FROM information_schema.views  WHERE table_schema = 'public') AS views,
              (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public') AS indexes`
    );
    console.log(`[db] Схема применена: таблиц — ${rows[0].tables}, представлений — ${rows[0].views}, индексов — ${rows[0].indexes}`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

// Запуск из командной строки
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  try {
    await ensureEmbeddedPostgres();
    await ensureDatabaseExists();
    await applySchema();
  } catch (err) {
    // У ошибки подключения (ECONNREFUSED) текст бывает пустым — показываем код и подсказку
    console.error('[db] Ошибка применения схемы:', err?.message || err?.code || err?.errors?.[0]?.code || String(err));
    if ((err?.code || err?.errors?.[0]?.code) === 'ECONNREFUSED') {
      console.error('     PostgreSQL не отвечает. Если он не установлен — в .env поставьте USE_EMBEDDED_PG=true и PGPORT=5433.');
    }
    if (err.position) console.error('     позиция в SQL:', err.position);
    process.exitCode = 1;
  } finally {
    await stopEmbeddedPostgres();
  }
}
