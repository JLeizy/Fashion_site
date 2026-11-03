// Авторизация: одноразовые коды (email / сброс / 2FA), учёт попыток входа, установка сессии.
// Реальные письма не отправляются — коды печатаются в консоль сервера (раздел 5 ТЗ).
import crypto from 'node:crypto';
import { query } from '../../db/pool.js';
import { config } from '../../config/index.js';
import { ApiError } from '../lib/errors.js';
import { ensureCsrfToken } from '../middleware/csrf.js';

const CODE_TITLES = {
  verify: 'подтверждение email',
  reset: 'сброс пароля',
  '2fa': 'двухфакторная аутентификация',
};

function printCode(email, type, code) {
  const lines = [`AMFIBIA · ${CODE_TITLES[type]}`, `Кому: ${email}`, `Код:  ${code}   (действует ${config.auth.codeTtlMinutes} мин.)`];
  const width = Math.max(...lines.map((l) => l.length)) + 2;
  console.log(`\n┌${'─'.repeat(width)}┐`);
  lines.forEach((l) => console.log(`│ ${l.padEnd(width - 1)}│`));
  console.log(`└${'─'.repeat(width)}┘\n`);
}

// Выпуск нового кода: прежние неиспользованные коды того же типа аннулируются
// Таблицы: email_codes (SELECT — пауза перед повторной отправкой; UPDATE used; INSERT)
export async function issueCode(user, type, { force = false } = {}) {
  if (!force) {
    const { rows } = await query(
      `SELECT EXTRACT(EPOCH FROM (NOW() - created_at))::int AS age
         FROM email_codes WHERE user_id = $1 AND type = $2 ORDER BY created_at DESC LIMIT 1`,
      [user.id, type]
    );
    if (rows[0] && rows[0].age < config.auth.codeResendSeconds) {
      throw new ApiError(429, 'auth.resendWait', { params: { seconds: config.auth.codeResendSeconds - rows[0].age }, code: 'RESEND_WAIT' });
    }
  }
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await query('UPDATE email_codes SET used = TRUE WHERE user_id = $1 AND type = $2 AND used = FALSE', [user.id, type]);
  await query(
    `INSERT INTO email_codes (user_id, code, type, expires_at)
     VALUES ($1, $2, $3, NOW() + make_interval(mins => $4))`,
    [user.id, code, type, config.auth.codeTtlMinutes]
  );
  printCode(user.email, type, code);
  return { resendIn: config.auth.codeResendSeconds };
}

// Проверка кода: не больше 5 попыток на код, затем код аннулируется
// Таблицы: email_codes (SELECT … FOR UPDATE не нужен — проверка в одном запросе; UPDATE attempts / used)
export async function consumeCode(userId, type, code) {
  const { rows } = await query(
    `SELECT id, code, attempts, expires_at < NOW() AS expired
       FROM email_codes
      WHERE user_id = $1 AND type = $2 AND used = FALSE
      ORDER BY created_at DESC LIMIT 1`,
    [userId, type]
  );
  const row = rows[0];
  if (!row) throw new ApiError(400, 'auth.codeExpired', { code: 'CODE_EXPIRED' });
  if (row.expired) {
    await query('UPDATE email_codes SET used = TRUE WHERE id = $1', [row.id]);
    throw new ApiError(400, 'auth.codeExpired', { code: 'CODE_EXPIRED' });
  }
  const ok = crypto.timingSafeEqual(Buffer.from(String(code).padEnd(6)), Buffer.from(row.code));
  if (!ok) {
    const attempts = row.attempts + 1;
    await query('UPDATE email_codes SET attempts = $2, used = $3 WHERE id = $1', [row.id, attempts, attempts >= 5]);
    throw new ApiError(400, attempts >= 5 ? 'auth.codeAttempts' : 'auth.codeInvalid', { code: 'CODE_INVALID' });
  }
  await query('UPDATE email_codes SET used = TRUE WHERE id = $1', [row.id]);
}

// Блокировка входа: 5 неудачных попыток подряд (после последнего успешного входа) за 15 минут
// Таблицы: login_attempts (SELECT)
export async function loginLockState(email) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS fails, MAX(created_at) AS last_fail
       FROM login_attempts
      WHERE email = $1 AND success = FALSE
        AND created_at > NOW() - make_interval(mins => $2)
        AND created_at > COALESCE((SELECT MAX(created_at) FROM login_attempts WHERE email = $1 AND success), 'epoch')`,
    [email, config.auth.lockMinutes]
  );
  const { fails, last_fail: lastFail } = rows[0];
  if (fails >= config.auth.maxLoginAttempts) {
    const unlockAt = new Date(new Date(lastFail).getTime() + config.auth.lockMinutes * 60_000);
    return { locked: true, fails, minutesLeft: Math.max(1, Math.ceil((unlockAt - Date.now()) / 60_000)) };
  }
  return { locked: false, fails };
}

// Таблицы: login_attempts (INSERT)
export async function recordAttempt(email, ip, success) {
  await query('INSERT INTO login_attempts (email, ip, success) VALUES ($1, $2, $3)', [email, ip, success]);
}

// Пользователь по email с ролью. Таблицы: users JOIN roles (SELECT)
export async function findUserByEmail(email) {
  const { rows } = await query(
    `SELECT u.*, r.code AS role, r.name_ru AS role_name_ru, r.name_en AS role_name_en
       FROM users u JOIN roles r ON r.id = u.role_id
      WHERE u.email = $1`,
    [String(email).toLowerCase()]
  );
  return rows[0] || null;
}

// Новая сессия после входа (regenerate — защита от фиксации сессии); «Запомнить меня» — cookie на 30 дней
export function establishSession(req, userId, remember) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = userId;
      if (remember) req.session.cookie.maxAge = config.auth.rememberDays * 24 * 60 * 60 * 1000;
      else req.session.cookie.expires = false; // cookie живёт до закрытия браузера
      ensureCsrfToken(req);
      req.session.save((saveErr) => (saveErr ? reject(saveErr) : resolve(req.session.csrfToken)));
    });
  });
}

// Завершить все сессии пользователя (блокировка, сброс пароля). Таблицы: session (DELETE по sess->>'userId')
export async function destroyUserSessions(userId, exceptSid = null) {
  await query(`DELETE FROM "session" WHERE (sess->>'userId')::int = $1 AND ($2::text IS NULL OR sid <> $2)`, [userId, exceptSid]);
}

export default { issueCode, consumeCode, loginLockState, recordAttempt, findUserByEmail, establishSession, destroyUserSessions };
