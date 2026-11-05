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
- `public/images/brands/<бренд>/products/<sku>-1.svg` — SVG-заглушки фото (генерирует `npm run placeholders`).

## Фотографии

> Фотографии принадлежат их правообладателям; проект предназначен только для локальной демонстрации и не публикуется.

- Реальное фото лежит рядом с заглушкой под тем же именем, но в формате `.webp`: `/images/brands/<бренд>/products/<sku>-1.webp`,
  `-2.webp` (второй ракурс для смены при наведении), `directors/<n>.webp`, `history/<n>.webp`, `collections/<имя>.webp`, `hero.webp`,
  `/images/banners/<бренд>.webp`. При `npm run db:seed` в БД пишется путь к `.webp`, если файл есть (`db/imagePath.js`), иначе к `.svg`.
  Если фото не загрузится, страница сама подставит SVG-заглушку.
- **Скачать / перекачать фото:** заполнить `db/content/image-sources.json` (массив
  `{ "target": "/images/brands/gucci/products/GUC-LOF-0001-1.webp", "kind": "product", "page": "страница-источник", "url": "прямая ссылка на картинку", "note": "примечание" }`;
  `kind` — `product | collection | history | director | hero | banner`; без `url` страница откроется в Chromium и возьмётся `og:image`), затем:
  ```bash
  npm run images
  ```
  (`-- --brand gucci` — только один бренд, `-- --force` — перекачать, `-- --from-manifest` — перекачать всё по `db/content/images-manifest.json`),
  после чего `npm run db:seed && npm run placeholders`. Скрипт `scripts/fetch-images.js` идемпотентен, делает паузы и повторы, через `sharp`
  переводит в webp (≈80 %; hero/баннеры до 1600 px, товары/коллекции/история до 900 px, портреты до 600 px, товары ≤ 100 КБ)
  и записывает в манифест страницу-источник, URL, дату и примечание.
- **Заменить своими:** положить свой файл `.webp` с тем же именем (или `.jpg` и сконвертировать любым редактором в `.webp`)
  и выполнить `npm run db:seed && npm run placeholders`.

Матрица прав по ролям будет добавлена сюда на финальном этапе (см. PROGRESS.md).
