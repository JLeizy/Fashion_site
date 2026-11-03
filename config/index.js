// Единая конфигурация приложения: читает .env (dotenv) и отдаёт готовый объект настроек.
// Все остальные модули берут настройки только отсюда, а не из process.env напрямую.
import path from 'node:path';
import dotenv from 'dotenv';

const root = path.resolve(import.meta.dirname, '..');
dotenv.config({ path: path.join(root, '.env'), quiet: true });

const env = process.env.NODE_ENV || 'development';
const bool = (value, fallback = false) =>
  value === undefined ? fallback : ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());

export const config = {
  root,
  env,
  isDev: env !== 'production',
  port: Number(process.env.PORT) || 3000,
  sessionSecret: process.env.SESSION_SECRET || 'amfibia-dev-secret-change-me',

  // Подключение к PostgreSQL (используется в db/pool.js и скриптах db/*.js)
  db: {
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT) || 5432,
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'amfibia',
  },

  // Встроенный PostgreSQL из npm-пакета embedded-postgres (запускается, если USE_EMBEDDED_PG=true)
  embeddedPg: {
    enabled: bool(process.env.USE_EMBEDDED_PG, false),
    dataDir: path.join(root, '.pgdata'),
  },

  // Загрузка файлов (multer): аватары, фото товаров, фото к возвратам
  uploads: {
    dir: path.join(root, 'public', 'uploads'),
    maxFileSizeMb: Number(process.env.UPLOAD_MAX_MB) || 5,
  },

  // Безопасность
  auth: {
    bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 12,
    maxLoginAttempts: 5, // неудачных попыток подряд
    lockMinutes: 15, // на сколько блокируется вход
    codeTtlMinutes: 10, // срок жизни кодов email / 2FA / сброса
    codeResendSeconds: 60, // пауза перед повторной отправкой кода
    rememberDays: 30, // срок жизни сессии при «Запомнить меня»
  },

  // Бизнес-настройки магазина
  shop: {
    freeDeliveryFromByn: 3000, // бесплатная доставка от этой суммы (кроме самовывоза — он и так бесплатный)
    returnDays: 14, // срок на возврат после получения
    lowStockThreshold: 3, // «низкий остаток»: доступно меньше этого числа
    maxCompare: 4, // максимум товаров в сравнении
    demoStepDelayMs: 2500, // пауза между шагами в демо «Провести заказ по всем статусам»
  },
};

export default config;
