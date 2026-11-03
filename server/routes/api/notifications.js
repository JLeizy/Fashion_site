// Уведомления (колокольчик в шапке и вкладка профиля).
import express from 'express';
import { param, query as q } from 'express-validator';
import { query } from '../../../db/pool.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';

const router = express.Router();
router.use(requireAuth);

// GET /api/notifications?page=&limit=&unread=1 — список уведомлений (роль: любой авторизованный, только свои)
// Таблицы: notifications (SELECT)
router.get(
  '/',
  validate([q('page').optional().isInt({ min: 1 }).toInt(), q('limit').optional().isInt({ min: 1, max: 50 }).toInt(), q('unread').optional().isIn(['0', '1'])]),
  async (req, res) => {
    const limit = Number(req.query.limit) || 10;
    const page = Number(req.query.page) || 1;
    const unreadOnly = req.query.unread === '1';
    const { rows } = await query(
      `SELECT id, type, title_ru, title_en, text_ru, text_en, link, is_read, created_at, COUNT(*) OVER () AS total
         FROM notifications
        WHERE user_id = $1 AND ($2::boolean = FALSE OR is_read = FALSE)
        ORDER BY created_at DESC, id DESC
        LIMIT $3 OFFSET $4`,
      [req.user.id, unreadOnly, limit, (page - 1) * limit]
    );
    res.json({
      total: rows[0]?.total || 0,
      page,
      limit,
      items: rows.map((n) => ({
        id: n.id,
        type: n.type,
        title: { ru: n.title_ru, en: n.title_en },
        text: { ru: n.text_ru, en: n.text_en },
        link: n.link,
        isRead: n.is_read,
        createdAt: n.created_at,
      })),
    });
  }
);

// GET /api/notifications/unread-count — число непрочитанных (роль: любой авторизованный). Таблицы: notifications (SELECT COUNT)
router.get('/unread-count', async (req, res) => {
  const { rows } = await query('SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND NOT is_read', [req.user.id]);
  res.json({ count: rows[0].n });
});

// POST /api/notifications/read-all — отметить все прочитанными (роль: любой авторизованный). Таблицы: notifications (UPDATE)
router.post('/read-all', async (req, res) => {
  await query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND NOT is_read', [req.user.id]);
  res.json({ ok: true, count: 0 });
});

// POST /api/notifications/:id/read — отметить одно прочитанным (роль: любой авторизованный, только своё). Таблицы: notifications (UPDATE)
router.post('/:id/read', validate([param('id').isInt({ min: 1 }).toInt()]), async (req, res) => {
  await query('UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  const { rows } = await query('SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND NOT is_read', [req.user.id]);
  res.json({ ok: true, count: rows[0].n });
});

export default router;
