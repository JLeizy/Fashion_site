// Встроенный PostgreSQL (npm-пакет embedded-postgres).
// Нужен, только если PostgreSQL не установлен в систему: бинарники лежат в node_modules,
// данные — в папке .pgdata проекта, в систему ничего не устанавливается и служб не создаётся.
// Включается переменной USE_EMBEDDED_PG=true в .env.
//
// Запуск отдельно:  npm run db:embedded   (держит сервер БД, пока не нажмёте Ctrl+C)
// Сервер (server.js) и скрипты db:schema / db:seed поднимают его сами, если он ещё не запущен.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';
import { config } from '../config/index.js';

let instance = null;

// Проверка: слушает ли кто-то порт (то есть уже запущен ли PostgreSQL)
export function isPortOpen(host, port, timeoutMs = 700) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

// Поднимает встроенный PostgreSQL, если он включён в .env и ещё не запущен.
// Возвращает экземпляр EmbeddedPostgres (или null, если запуск не понадобился).
export async function ensureEmbeddedPostgres({ quiet = false } = {}) {
  if (!config.embeddedPg.enabled) return null;
  if (instance) return instance;
  if (await isPortOpen('127.0.0.1', config.db.port)) return null; // уже работает (например, запущен сервером)

  const dataDir = config.embeddedPg.dataDir;
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    authMethod: 'scram-sha-256',
    persistent: true,
    initdbFlags: ['--encoding=UTF8', '--locale-provider=icu', '--icu-locale=und', '--locale=C'],
    postgresFlags: ['-c', 'listen_addresses=127.0.0.1'],
    onLog: () => {},
    onError: (message) => {
      const text = String(message?.message || message || '').trim();
      if (text && /error|fatal|panic/i.test(text)) console.error('[embedded-pg]', text);
    },
  });

  const firstRun = !fs.existsSync(path.join(dataDir, 'PG_VERSION'));
  if (firstRun) {
    if (!quiet) console.log('[embedded-pg] Первый запуск: создаю кластер БД в', dataDir);
    await pg.initialise();
  }
  await pg.start();
  if (!quiet) console.log(`[embedded-pg] PostgreSQL запущен на 127.0.0.1:${config.db.port}`);

  // Создаём рабочую базу, если её ещё нет
  const client = pg.getPgClient();
  await client.connect();
  // SQL: проверяем наличие базы в системном каталоге pg_database (только чтение)
  const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [config.db.database]);
  if (exists.rowCount === 0) {
    // Имя базы берётся из .env; экранируем двойные кавычки, т.к. идентификатор нельзя передать параметром
    await client.query(`CREATE DATABASE "${config.db.database.replace(/"/g, '""')}"`);
    if (!quiet) console.log(`[embedded-pg] Создана база данных "${config.db.database}"`);
  }
  await client.end();

  instance = pg;
  return pg;
}

export async function stopEmbeddedPostgres() {
  if (!instance) return;
  const pg = instance;
  instance = null;
  await pg.stop();
}

// Запуск как отдельной команды: npm run db:embedded
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  if (!config.embeddedPg.enabled) {
    console.log('USE_EMBEDDED_PG=false в .env — встроенный PostgreSQL выключен, используется ваш сервер БД.');
    process.exit(0);
  }
  const pg = await ensureEmbeddedPostgres();
  if (!pg) {
    console.log(`PostgreSQL уже слушает порт ${config.db.port} — второй экземпляр не нужен.`);
    process.exit(0);
  }
  console.log('Нажмите Ctrl+C, чтобы остановить PostgreSQL.');
  const shutdown = async () => {
    await stopEmbeddedPostgres();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
