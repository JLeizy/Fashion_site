// Маршруты HTML-страниц. Каждая страница — файл из views/, данные подгружаются на клиенте через /api.
import express from 'express';
import { config } from '../../config/index.js';
import { renderPage } from '../lib/render.js';

const router = express.Router();

// Блок быстрого входа под тестовыми ролями — только в режиме разработки (для демонстрации проекта)
const DEMO_ACCOUNTS = [
  ['buyer', 'buyer@amfibia.by'],
  ['seller', 'official@amfibia.by'],
  ['warehouse', 'warehouse@amfibia.by'],
  ['courier', 'courier@amfibia.by'],
  ['support', 'support@amfibia.by'],
  ['moderator', 'moderator@amfibia.by'],
  ['owner', 'owner@amfibia.by'],
];
const demoAccountsHtml = () =>
  config.isDev
    ? `<details class="auth-demo">
        <summary class="t-mono" data-i18n="auth.demoTitle">Демо-аккаунты (режим разработки)</summary>
        <p class="t-muted auth-demo__note" data-i18n="auth.demoNote">Пароль у всех: Amfibia2026. Нажмите роль — поля заполнятся.</p>
        <div class="auth-demo__grid">${DEMO_ACCOUNTS.map(([role, email]) => `<button type="button" class="chip" data-demo-login="${email}"><span data-i18n="roles.${role}">${role}</span></button>`).join('')}</div>
      </details>`
    : '';

// GET / — главная (роль: любая)
router.get('/', (req, res) => renderPage(req, res, 'index.html', { page: 'home' }));

// GET /auth — вход, регистрация, подтверждение email, 2FA, восстановление пароля (роль: гость).
// Авторизованного пользователя перенаправляем в профиль (или на next).
router.get('/auth', (req, res) => {
  const next = typeof req.query.next === 'string' && req.query.next.startsWith('/') && !req.query.next.startsWith('//') ? req.query.next : '/account';
  if (req.user) return res.redirect(next);
  renderPage(req, res, 'auth.html', { page: 'auth', demoAccounts: demoAccountsHtml() });
});

// GET /catalog — общий каталог с фильтрами; все параметры фильтра в URL (роль: любая)
router.get('/catalog', (req, res) => renderPage(req, res, 'catalog.html', { page: 'catalog' }));

// Просмотр оформленных страниц ошибок напрямую (роль: любая)
router.get('/403', (req, res) => renderPage(req, res, '403.html', { page: 'error-403' }, 403));
router.get('/404', (req, res) => renderPage(req, res, '404.html', { page: 'error-404' }, 404));
router.get('/500', (req, res) => renderPage(req, res, '500.html', { page: 'error-500' }, 500));

export default router;
