// Сборка Express-приложения: безопасность, сессии, статика, API и страницы.
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { config } from '../config/index.js';
import { pool } from '../db/pool.js';
import { i18nMiddleware } from './middleware/i18n.js';
import { csrfProtection } from './middleware/csrf.js';
import { loadUser } from './middleware/auth.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import apiRouter from './routes/api/index.js';
import pagesRouter from './routes/pages.js';

const PgSessionStore = connectPgSimple(session);

// Клиентские библиотеки отдаются прямо из node_modules (никаких CDN — сайт работает без интернета)
const VENDOR_MOUNTS = {
  '/vendor/gsap': 'gsap/dist',
  '/vendor/lenis': 'lenis/dist',
  '/vendor/split-type': 'split-type/umd',
  '/vendor/ogl': 'ogl/src',
  '/vendor/chart': 'chart.js/dist',
  '/vendor/fonts': '@fontsource',
};

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  // Заголовки безопасности (helmet) + Content-Security-Policy: скрипты только со своего домена
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:', 'blob:'],
          'font-src': ["'self'", 'data:'],
          'connect-src': ["'self'"],
          'media-src': ["'self'", 'blob:'],
          'worker-src': ["'self'", 'blob:'],
          'object-src': ["'none'"],
          'frame-ancestors': ["'self'"],
          'upgrade-insecure-requests': null, // локальный http://localhost — https-апгрейд не нужен
        },
      },
      crossOriginEmbedderPolicy: false,
      strictTransportSecurity: false,
    })
  );
  app.use(compression());

  // Статика: public/ (CSS, JS, i18n, изображения, загрузки) и vendor-библиотеки
  app.use(express.static(path.join(config.root, 'public'), { index: false, maxAge: config.isDev ? 0 : '7d' }));
  for (const [mount, dir] of Object.entries(VENDOR_MOUNTS)) {
    app.use(mount, express.static(path.join(config.root, 'node_modules', dir), { index: false, maxAge: '30d', immutable: true }));
  }

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // Сессии хранятся в PostgreSQL, таблица session (connect-pg-simple)
  app.use(
    session({
      store: new PgSessionStore({ pool, tableName: 'session', createTableIfMissing: true, pruneSessionInterval: 15 * 60 }),
      name: 'amf.sid',
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 24 * 60 * 60 * 1000 },
    })
  );
  app.use(i18nMiddleware);

  // Краткий лог API-запросов в режиме разработки
  if (config.isDev) {
    app.use('/api', (req, res, next) => {
      const started = Date.now();
      res.on('finish', () => {
        if (req.path === '/notifications/unread-count') return;
        console.log(`[api] ${req.method} ${req.originalUrl} → ${res.statusCode} (${Date.now() - started} мс)`);
      });
      next();
    });
  }

  app.use('/api', loadUser, csrfProtection, apiRouter);
  app.use(loadUser, pagesRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export default createApp;
