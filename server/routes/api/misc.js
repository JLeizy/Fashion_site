// Прочие маршруты общих блоков: подписка на рассылку, сохранение настроек интерфейса.
import express from 'express';
import { body } from 'express-validator';
import { query } from '../../../db/pool.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';

const router = express.Router();

// POST /api/newsletter — подписка на рассылку (роль: любая, включая гостя)
// Таблицы: newsletter_subscribers (INSERT … ON CONFLICT DO NOTHING)
router.post(
  '/newsletter',
  validate([body('email').trim().isEmail().withMessage('validation.email').bail().isLength({ max: 255 }).normalizeEmail({ gmail_remove_dots: false })]),
  async (req, res) => {
    const email = String(req.body.email).toLowerCase();
    const { rowCount } = await query(
      'INSERT INTO newsletter_subscribers (email, lang) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING',
      [email, req.lang]
    );
    res.status(rowCount ? 201 : 200).json({ ok: true, already: rowCount === 0 });
  }
);

// PATCH /api/profile/preferences — язык, тема и валюта интерфейса (роль: любой авторизованный)
// Таблицы: users (UPDATE preferred_lang / preferred_theme / preferred_currency)
router.patch(
  '/profile/preferences',
  requireAuth,
  validate([
    body('lang').optional().isIn(['ru', 'en']).withMessage('validation.lang'),
    body('theme').optional().isIn(['amfibia', 'light', 'dark']).withMessage('validation.theme'),
    body('currency').optional().isIn(['BYN', 'USD', 'EUR']).withMessage('validation.currency'),
  ]),
  async (req, res) => {
    const { lang, theme, currency } = req.body;
    await query(
      `UPDATE users
          SET preferred_lang = COALESCE($2, preferred_lang),
              preferred_theme = COALESCE($3, preferred_theme),
              preferred_currency = COALESCE($4, preferred_currency)
        WHERE id = $1`,
      [req.user.id, lang || null, theme || null, currency || null]
    );
    res.json({ ok: true });
  }
);

export default router;
