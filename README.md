# AMFIBIA — маркетплейс брендовой одежды

Многостраничный интернет-магазин 15 модных домов (Balenciaga, Vetements, Gucci, Prada, Enfants Riches Déprimés, AVAVAV, Supreme,
Chrome Hearts, Louis Vuitton, Chanel, Maison Margiela, Givenchy, Versace, Alexander McQueen, Loro Piana) в эстетике высокой моды и готики.

**Стек:** HTML5 + CSS3 + JavaScript (ES-модули, без фреймворков), Node.js + Express 5, PostgreSQL (драйвер `pg`, чистый SQL),
GSAP + ScrollTrigger, Lenis, SplitType, OGL (WebGL), Chart.js. Подробный журнал разработки и план — в [PROGRESS.md](PROGRESS.md).

## Запуск

Нужны Node.js 20+ и PostgreSQL 15+ (если PostgreSQL не установлен — см. «Встроенный PostgreSQL» ниже).

1. Установить зависимости:
   ```bash
   npm install
   ```
2. Создать `.env` из примера и указать данные своей БД (`PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`):
   ```bash
   cp .env.example .env
   ```
3. Создать базу (один раз), например:
   ```bash
   psql -U postgres -c "CREATE DATABASE amfibia;"
   ```
4. Схема + наполнение + SVG-заглушки картинок:
   ```bash
   npm run setup
   ```
5. Запуск → http://localhost:3000
   ```bash
   npm start
   ```

**Встроенный PostgreSQL** (если своего нет): в `.env` поставить `USE_EMBEDDED_PG=true` и `PGPORT=5433` — сервер сам поднимет
PostgreSQL из npm-пакета `embedded-postgres` (данные в папке `.pgdata/`).

Повторный `npm run setup` пересоздаёт базу с нуля (все тестовые данные вернутся в исходное состояние).

## Тестовые аккаунты

Пароль у всех: **`Amfibia2026`**. На странице `/auth` в режиме разработки есть блок быстрого входа под ролями.

| Роль | Email |
|---|---|
| Создатель магазина (owner) | owner@amfibia.by |
| Модератор | moderator@amfibia.by |
| Поддержка | support@amfibia.by |
| Кладовщик | warehouse@amfibia.by |
| Курьер | courier@amfibia.by, courier2@amfibia.by |
| Продавец | official@amfibia.by (Amfibia Official), seller1@amfibia.by, seller2@amfibia.by, seller3@amfibia.by |
| Покупатель | buyer@amfibia.by (заказы во всех статусах), anna.kovaleva@example.com (включена 2FA), ещё 19 покупателей *@example.com |
| Заблокированный | blocked.user@example.com |

Коды подтверждения email, сброса пароля и 2FA печатаются в консоль сервера. Тестовая карта для имитации оплаты: `4242 4242 4242 4242`.
Промокоды: `AMFIBIA10`, `GOTHIC15`, `WELCOME20`.

## Где что хранится

- `db/schema.sql` — все таблицы, индексы, триггеры, представления (с `COMMENT ON`); `db/seed.js` — наполнение.
- `db/pool.js` — единственная точка доступа к БД (`query`, `withTransaction`).
- `server/routes/api/*.js` — REST API; над каждым маршрутом комментарий: что делает, какие таблицы читает/меняет, какая роль.
- `server/services/orderService.js` — оформление заказа и смена статусов (транзакции, резерв и списание остатков).
- `views/*.html` — страницы, `public/css`, `public/js` — стили и клиентская логика, `public/i18n/ru.json`, `en.json` — тексты интерфейса.
- `public/images/brands/<бренд>/products/<sku>-1.svg` — заглушки фото; можно заменить своими файлами (и расширение в `product_images.url`).

Матрица прав по ролям будет добавлена сюда на финальном этапе (см. PROGRESS.md).
