// Пул подключений к PostgreSQL (node-postgres, чистый SQL).
// ВСЕ запросы приложения идут через функции этого файла:
//   query(sql, params)        — один запрос (параметры только через $1, $2… — защита от SQL-инъекций);
//   withTransaction(fn)       — BEGIN → fn(client) → COMMIT, при любой ошибке ROLLBACK.
import pg from 'pg';
import { config } from '../config/index.js';

const { Pool, types } = pg;

// NUMERIC (OID 1700) по умолчанию приходит строкой — превращаем в число (цены NUMERIC(12,2))
types.setTypeParser(1700, (value) => (value === null ? null : Number(value)));
// BIGINT (OID 20) — результат COUNT(*), SUM(int) — тоже в число
types.setTypeParser(20, (value) => (value === null ? null : Number(value)));
// DATE (OID 1082) оставляем строкой 'YYYY-MM-DD', чтобы не было сдвигов из-за часового пояса
types.setTypeParser(1082, (value) => value);

export const pool = new Pool({
  ...config.db,
  max: 15,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  application_name: 'amfibia',
});

pool.on('error', (err) => {
  console.error('[pg] Ошибка простаивающего подключения:', err.message);
});

// Выполняет один параметризованный запрос через пул
export async function query(text, params = []) {
  try {
    return await pool.query(text, params);
  } catch (err) {
    err.sql = text;
    throw err;
  }
}

// Транзакция. Пример:
//   await withTransaction(async (client) => {
//     await client.query('UPDATE stock SET reserved = reserved + $1 WHERE id = $2', [n, id]);
//   });
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Проверка доступности БД (используется в /api/health и при старте сервера)
export async function checkConnection() {
  // SQL: служебный запрос без таблиц — версия сервера и текущая база
  const { rows } = await pool.query('SELECT version() AS version, current_database() AS database');
  return rows[0];
}

export default { pool, query, withTransaction, checkConnection };
