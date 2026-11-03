-- =====================================================================
--  AMFIBIA — схема базы данных PostgreSQL 15+
--  Файл создаёт ВСЕ таблицы, ограничения, индексы, триггеры и представления.
--  Применение: npm run db:schema  (db/init.js выполняет этот файл целиком в одной транзакции)
--  ВНИМАНИЕ: скрипт пересоздаёт схему — существующие данные удаляются.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Очистка (порядок не важен благодаря CASCADE)
-- ---------------------------------------------------------------------
DROP VIEW IF EXISTS v_sales_by_brand, v_top_products, v_low_stock, v_variant_stock CASCADE;
DROP TABLE IF EXISTS
  audit_log, notifications, ticket_messages, support_tickets, reviews, return_requests,
  order_status_history, order_items, orders, payment_methods, delivery_methods,
  promo_codes, viewed_products, comparisons, wishlist, cart_items, carts,
  stock_movements, stock, warehouses, product_variants, sizes, product_images, products,
  categories, collections, creative_directors, brand_timeline_events, brand_history_sections,
  brands, seller_applications, addresses, "session", login_attempts, email_codes, users, roles,
  currency_rates, banners, newsletter_subscribers
CASCADE;
DROP SEQUENCE IF EXISTS order_number_seq CASCADE;
DROP FUNCTION IF EXISTS set_updated_at, next_order_number, check_comparisons_limit, refresh_product_rating CASCADE;

-- Триграммный поиск (ILIKE '%…%' по индексу) — расширение из стандартной поставки PostgreSQL
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Общая функция-триггер: автоматически обновляет столбец updated_at при UPDATE
CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 1. ПОЛЬЗОВАТЕЛИ И ДОСТУП
-- =====================================================================

CREATE TABLE roles (
  id      SERIAL PRIMARY KEY,
  code    VARCHAR(20) NOT NULL UNIQUE
          CHECK (code IN ('buyer', 'seller', 'warehouse', 'courier', 'support', 'moderator', 'owner')),
  name_ru VARCHAR(60) NOT NULL,
  name_en VARCHAR(60) NOT NULL
);
COMMENT ON TABLE roles IS 'Роли пользователей. Гость (неавторизованный посетитель) в БД не хранится';
COMMENT ON COLUMN roles.code IS 'Машинный код роли — по нему middleware checkRole проверяет доступ';

CREATE TABLE users (
  id                 SERIAL PRIMARY KEY,
  email              VARCHAR(255) NOT NULL UNIQUE,
  password_hash      VARCHAR(100) NOT NULL,
  first_name         VARCHAR(60)  NOT NULL,
  last_name          VARCHAR(60)  NOT NULL DEFAULT '',
  phone              VARCHAR(30),
  avatar             VARCHAR(500),
  role_id            INT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  status             VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'deleted')),
  email_verified     BOOLEAN NOT NULL DEFAULT FALSE,
  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  preferred_lang     VARCHAR(2)  NOT NULL DEFAULT 'ru'      CHECK (preferred_lang IN ('ru', 'en')),
  preferred_theme    VARCHAR(10) NOT NULL DEFAULT 'amfibia' CHECK (preferred_theme IN ('amfibia', 'light', 'dark')),
  preferred_currency VARCHAR(3)  NOT NULL DEFAULT 'BYN'     CHECK (preferred_currency IN ('BYN', 'USD', 'EUR')),
  last_login_at      TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (email = LOWER(email))
);
COMMENT ON TABLE users IS 'Пользователи всех ролей (покупатели, продавцы, сотрудники, владелец)';
COMMENT ON COLUMN users.email IS 'Логин; хранится в нижнем регистре, уникален';
COMMENT ON COLUMN users.password_hash IS 'Хеш пароля bcrypt (12 раундов); сам пароль не хранится';
COMMENT ON COLUMN users.status IS 'active — работает; blocked — вход запрещён, сессии удалены; deleted — мягкое удаление';
COMMENT ON COLUMN users.two_factor_enabled IS 'Если TRUE — после пароля требуется код 2FA (выводится в консоль сервера)';
COMMENT ON COLUMN users.preferred_lang IS 'Язык интерфейса, сохраняется из переключателя в шапке';
COMMENT ON COLUMN users.preferred_theme IS 'Тема: amfibia / light / dark';
COMMENT ON COLUMN users.preferred_currency IS 'Валюта отображения цен: BYN / USD / EUR';
CREATE INDEX idx_users_role ON users(role_id);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_created ON users(created_at);
CREATE INDEX idx_users_name_trgm ON users USING GIN ((first_name || ' ' || last_name || ' ' || email) gin_trgm_ops);
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE email_codes (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code       VARCHAR(6) NOT NULL CHECK (code ~ '^[0-9]{6}$'),
  type       VARCHAR(10) NOT NULL CHECK (type IN ('verify', 'reset', '2fa')),
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT FALSE,
  attempts   SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE email_codes IS 'Одноразовые 6-значные коды: подтверждение email, сброс пароля, 2FA. Реальные письма не отправляются — код печатается в консоль сервера';
COMMENT ON COLUMN email_codes.attempts IS 'Число неверных вводов; после 5 код аннулируется (защита от перебора)';
CREATE INDEX idx_email_codes_lookup ON email_codes(user_id, type, used, expires_at);

CREATE TABLE login_attempts (
  id         SERIAL PRIMARY KEY,
  email      VARCHAR(255) NOT NULL,
  ip         VARCHAR(64),
  success    BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE login_attempts IS 'Журнал попыток входа. 5 неудачных подряд за 15 минут → вход блокируется на 15 минут';
CREATE INDEX idx_login_attempts_email ON login_attempts(email, created_at DESC);
CREATE INDEX idx_login_attempts_ip ON login_attempts(ip, created_at DESC);

-- Таблица сессий в формате connect-pg-simple (первичный ключ — sid, так требует библиотека)
CREATE TABLE "session" (
  sid    VARCHAR NOT NULL COLLATE "default" PRIMARY KEY,
  sess   JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
COMMENT ON TABLE "session" IS 'Сессии express-session (connect-pg-simple). В sess хранятся userId, csrfToken, данные незавершённого входа 2FA';
CREATE INDEX idx_session_expire ON "session"(expire);

CREATE TABLE addresses (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  country     VARCHAR(2) NOT NULL,
  city        VARCHAR(80) NOT NULL,
  street      VARCHAR(120) NOT NULL,
  house       VARCHAR(20) NOT NULL,
  apartment   VARCHAR(20),
  postal_code VARCHAR(12),
  recipient   VARCHAR(120) NOT NULL,
  phone       VARCHAR(30) NOT NULL,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE addresses IS 'Адресная книга покупателя (CRUD в профиле)';
COMMENT ON COLUMN addresses.country IS 'Код страны ISO 3166-1 alpha-2 (BY, RU, KZ, AM, UZ, KG …); название выводится через Intl.DisplayNames';
COMMENT ON COLUMN addresses.is_default IS 'Адрес по умолчанию; у пользователя не больше одного (частичный уникальный индекс)';
CREATE INDEX idx_addresses_user ON addresses(user_id);
CREATE UNIQUE INDEX uq_addresses_default ON addresses(user_id) WHERE is_default;
CREATE TRIGGER trg_addresses_updated BEFORE UPDATE ON addresses FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE seller_applications (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shop_name   VARCHAR(120) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status      VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by INT REFERENCES users(id) ON DELETE SET NULL,
  comment     TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE seller_applications IS 'Заявки «Стать продавцом». При одобрении модератором роль пользователя меняется на seller';
COMMENT ON COLUMN seller_applications.shop_name IS 'Название магазина — показывается на странице товара в блоке «Продавец»';
COMMENT ON COLUMN seller_applications.comment IS 'Комментарий модератора (причина отказа)';
CREATE INDEX idx_seller_apps_status ON seller_applications(status);
CREATE UNIQUE INDEX uq_seller_apps_pending ON seller_applications(user_id) WHERE status = 'pending';

-- =====================================================================
-- 2. КАТАЛОГ
-- =====================================================================

CREATE TABLE brands (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(80) NOT NULL UNIQUE,
  slug          VARCHAR(80) NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  country       VARCHAR(2) NOT NULL,
  founded_year  SMALLINT NOT NULL CHECK (founded_year BETWEEN 1800 AND 2100),
  founder       VARCHAR(200) NOT NULL,
  short_desc_ru TEXT NOT NULL,
  short_desc_en TEXT NOT NULL,
  hero_image    VARCHAR(500),
  accent_color  VARCHAR(7) NOT NULL DEFAULT '#5A0F1C' CHECK (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order    SMALLINT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE brands IS '15 брендов площадки. Страница бренда /brand/:slug и история /history/:slug строятся по slug';
COMMENT ON COLUMN brands.slug IS 'Часть URL: /brand/balenciaga';
COMMENT ON COLUMN brands.country IS 'Страна бренда, ISO 3166-1 alpha-2';
COMMENT ON COLUMN brands.accent_color IS 'Акцентный цвет микростилистики бренда (раздел 10.5)';
CREATE INDEX idx_brands_sort ON brands(sort_order);
CREATE TRIGGER trg_brands_updated BEFORE UPDATE ON brands FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE brand_history_sections (
  id           SERIAL PRIMARY KEY,
  brand_id     INT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  sort_order   SMALLINT NOT NULL DEFAULT 0,
  period       VARCHAR(40),
  title_ru     VARCHAR(200) NOT NULL,
  title_en     VARCHAR(200) NOT NULL,
  content_ru   TEXT NOT NULL,
  content_en   TEXT NOT NULL DEFAULT '',
  quote_ru     TEXT,
  quote_en     TEXT,
  quote_author VARCHAR(120),
  image        VARCHAR(500),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE brand_history_sections IS 'Разделы полной истории бренда (страница /history/:slug). Тексты хранятся здесь, а не в HTML';
COMMENT ON COLUMN brand_history_sections.period IS 'Период раздела, например «1917–1937»';
COMMENT ON COLUMN brand_history_sections.content_ru IS 'Текст раздела; абзацы разделены пустой строкой, подзаголовки — строки, начинающиеся с «## »';
CREATE INDEX idx_history_sections_brand ON brand_history_sections(brand_id, sort_order);
CREATE TRIGGER trg_history_sections_updated BEFORE UPDATE ON brand_history_sections FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE brand_timeline_events (
  id             SERIAL PRIMARY KEY,
  brand_id       INT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  year           SMALLINT NOT NULL CHECK (year BETWEEN 1800 AND 2100),
  title_ru       VARCHAR(200) NOT NULL,
  title_en       VARCHAR(200) NOT NULL,
  description_ru TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT ''
);
COMMENT ON TABLE brand_timeline_events IS 'События интерактивной хронологии на странице истории бренда';
CREATE INDEX idx_timeline_brand_year ON brand_timeline_events(brand_id, year);

CREATE TABLE creative_directors (
  id                 SERIAL PRIMARY KEY,
  brand_id           INT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name               VARCHAR(120) NOT NULL,
  years_from         SMALLINT NOT NULL,
  years_to           SMALLINT,
  description_ru     TEXT NOT NULL DEFAULT '',
  description_en     TEXT NOT NULL DEFAULT '',
  key_collections_ru TEXT NOT NULL DEFAULT '',
  key_collections_en TEXT NOT NULL DEFAULT '',
  photo              VARCHAR(500),
  CHECK (years_to IS NULL OR years_to >= years_from)
);
COMMENT ON TABLE creative_directors IS 'Креативные директора бренда (карточки на странице истории)';
COMMENT ON COLUMN creative_directors.years_to IS 'NULL — работает по сей день';
CREATE INDEX idx_directors_brand ON creative_directors(brand_id, years_from);

CREATE TABLE collections (
  id             SERIAL PRIMARY KEY,
  brand_id       INT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name           VARCHAR(120) NOT NULL,
  season         VARCHAR(10) NOT NULL CHECK (season IN ('SS', 'FW', 'Resort', 'Pre-Fall')),
  year           SMALLINT NOT NULL CHECK (year BETWEEN 1900 AND 2100),
  is_new         BOOLEAN NOT NULL DEFAULT FALSE,
  cover_image    VARCHAR(500),
  description_ru TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (brand_id, name, season, year)
);
COMMENT ON TABLE collections IS 'Коллекции брендов (сезоны SS / FW / Resort / Pre-Fall). is_new — показывается в «Новых коллекциях» на главной';
CREATE INDEX idx_collections_brand ON collections(brand_id);
CREATE INDEX idx_collections_new ON collections(is_new) WHERE is_new;

CREATE TABLE categories (
  id         SERIAL PRIMARY KEY,
  parent_id  INT REFERENCES categories(id) ON DELETE RESTRICT,
  slug       VARCHAR(60) NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  name_ru    VARCHAR(80) NOT NULL,
  name_en    VARCHAR(80) NOT NULL,
  size_type  VARCHAR(10) CHECK (size_type IN ('clothing', 'shoes', 'ring', 'one_size', 'volume_ml')),
  sort_order SMALLINT NOT NULL DEFAULT 0,
  CHECK (parent_id IS NULL OR parent_id <> id)
);
COMMENT ON TABLE categories IS 'Дерево категорий: корневые (parent_id IS NULL) — Одежда, Обувь, Сумки, Аксессуары, Ювелирные изделия, Парфюмерия';
COMMENT ON COLUMN categories.size_type IS 'Какая размерная сетка у товаров категории (используется в редакторе товара продавца)';
CREATE INDEX idx_categories_parent ON categories(parent_id, sort_order);

CREATE TABLE products (
  id                SERIAL PRIMARY KEY,
  sku               VARCHAR(32) NOT NULL UNIQUE,
  model_code        VARCHAR(40),
  brand_id          INT NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  collection_id     INT REFERENCES collections(id) ON DELETE SET NULL,
  category_id       INT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  seller_id         INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name_ru           VARCHAR(200) NOT NULL,
  name_en           VARCHAR(200) NOT NULL,
  description_ru    TEXT NOT NULL DEFAULT '',
  description_en    TEXT NOT NULL DEFAULT '',
  composition_ru    VARCHAR(300) NOT NULL DEFAULT '',
  composition_en    VARCHAR(300) NOT NULL DEFAULT '',
  care_ru           TEXT NOT NULL DEFAULT '',
  care_en           TEXT NOT NULL DEFAULT '',
  price_byn         NUMERIC(12,2) NOT NULL CHECK (price_byn > 0),
  old_price_byn     NUMERIC(12,2) CHECK (old_price_byn IS NULL OR old_price_byn > price_byn),
  gender            VARCHAR(10) NOT NULL DEFAULT 'unisex' CHECK (gender IN ('men', 'women', 'unisex')),
  color             VARCHAR(30) NOT NULL,
  material          VARCHAR(40) NOT NULL,
  country_of_origin VARCHAR(2) NOT NULL,
  is_limited        BOOLEAN NOT NULL DEFAULT FALSE,
  is_new            BOOLEAN NOT NULL DEFAULT FALSE,
  is_iconic         BOOLEAN NOT NULL DEFAULT FALSE,
  moderation_status VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('draft', 'pending', 'approved', 'rejected')),
  rejection_reason  TEXT,
  is_authenticated  BOOLEAN NOT NULL DEFAULT FALSE,
  views_count       INT NOT NULL DEFAULT 0 CHECK (views_count >= 0),
  rating_avg        NUMERIC(3,2) NOT NULL DEFAULT 0 CHECK (rating_avg BETWEEN 0 AND 5),
  reviews_count     INT NOT NULL DEFAULT 0 CHECK (reviews_count >= 0),
  search_vector     TSVECTOR GENERATED ALWAYS AS (
                      setweight(to_tsvector('simple', coalesce(name_en, '')), 'A') ||
                      setweight(to_tsvector('simple', coalesce(name_ru, '')), 'A') ||
                      setweight(to_tsvector('simple', coalesce(sku, '') || ' ' || coalesce(model_code, '')), 'B') ||
                      setweight(to_tsvector('simple', coalesce(color, '') || ' ' || coalesce(material, '')), 'C')
                    ) STORED,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE products IS 'Товары. На сайте видны только moderation_status = approved';
COMMENT ON COLUMN products.sku IS 'Артикул, уникален; по нему названы файлы фото: <sku>-1.svg, <sku>-2.svg';
COMMENT ON COLUMN products.model_code IS 'Код модели: товары одной модели в разных цветах (переключатель цвета на странице товара)';
COMMENT ON COLUMN products.seller_id IS 'Продавец (users с ролью seller). Продавец видит и меняет только свои товары';
COMMENT ON COLUMN products.price_byn IS 'Цена в BYN — базовая валюта; USD/EUR пересчитываются по currency_rates';
COMMENT ON COLUMN products.old_price_byn IS 'Старая цена для отображения скидки (больше текущей)';
COMMENT ON COLUMN products.color IS 'Код цвета (black, white, burgundy…) — название и образец цвета на клиенте из i18n';
COMMENT ON COLUMN products.material IS 'Код основного материала (leather, cotton, silver925…)';
COMMENT ON COLUMN products.country_of_origin IS 'Страна производства, ISO 3166-1 alpha-2';
COMMENT ON COLUMN products.is_iconic IS 'Культовая модель бренда — блоки «Культовые вещи» и «Культовые модели бренда»';
COMMENT ON COLUMN products.moderation_status IS 'draft — черновик продавца; pending — на модерации; approved — опубликован; rejected — отклонён (причина в rejection_reason)';
COMMENT ON COLUMN products.is_authenticated IS 'Отметка модератора «Проверено на подлинность» (метка Verified by Amfibia)';
COMMENT ON COLUMN products.rating_avg IS 'Средняя оценка по одобренным отзывам — пересчитывается триггером trg_reviews_rating';
COMMENT ON COLUMN products.search_vector IS 'Полнотекстовый индекс названия/артикула (генерируемый столбец) для поиска';
CREATE INDEX idx_products_brand ON products(brand_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_collection ON products(collection_id);
CREATE INDEX idx_products_seller ON products(seller_id);
CREATE INDEX idx_products_price ON products(price_byn);
CREATE INDEX idx_products_gender ON products(gender);
CREATE INDEX idx_products_color ON products(color);
CREATE INDEX idx_products_material ON products(material);
CREATE INDEX idx_products_country ON products(country_of_origin);
CREATE INDEX idx_products_created ON products(created_at);
CREATE INDEX idx_products_rating ON products(rating_avg);
CREATE INDEX idx_products_moderation ON products(moderation_status);
CREATE INDEX idx_products_model ON products(model_code);
CREATE INDEX idx_products_flags ON products(is_new, is_limited, is_iconic) WHERE moderation_status = 'approved';
CREATE INDEX idx_products_search ON products USING GIN (search_vector);
CREATE INDEX idx_products_name_ru_trgm ON products USING GIN (name_ru gin_trgm_ops);
CREATE INDEX idx_products_name_en_trgm ON products USING GIN (name_en gin_trgm_ops);
CREATE INDEX idx_products_sku_trgm ON products USING GIN (sku gin_trgm_ops);
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE product_images (
  id         SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url        VARCHAR(500) NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  is_main    BOOLEAN NOT NULL DEFAULT FALSE
);
COMMENT ON TABLE product_images IS 'Фото товаров. По умолчанию — SVG-заглушки /images/brands/<бренд>/products/<sku>-1.svg; можно заменить на jpg/webp и обновить url';
COMMENT ON COLUMN product_images.is_main IS 'Главное фото; у товара ровно одно (частичный уникальный индекс)';
CREATE INDEX idx_product_images_product ON product_images(product_id, sort_order);
CREATE UNIQUE INDEX uq_product_images_main ON product_images(product_id) WHERE is_main;

CREATE TABLE sizes (
  id         SERIAL PRIMARY KEY,
  type       VARCHAR(10) NOT NULL CHECK (type IN ('clothing', 'shoes', 'ring', 'one_size', 'volume_ml')),
  value_eu   VARCHAR(12),
  value_it   VARCHAR(12),
  value_us   VARCHAR(12),
  value_int  VARCHAR(12) NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  UNIQUE (type, value_int)
);
COMMENT ON TABLE sizes IS 'Справочник размеров с соответствием EU / IT / US / INT (таблица размеров в модалке)';
COMMENT ON COLUMN sizes.value_int IS 'Основная подпись размера на кнопке: M, 42, 17, OS, 100 ml';

CREATE TABLE product_variants (
  id          SERIAL PRIMARY KEY,
  product_id  INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size_id     INT NOT NULL REFERENCES sizes(id) ON DELETE RESTRICT,
  sku_variant VARCHAR(48) NOT NULL UNIQUE,
  UNIQUE (product_id, size_id)
);
COMMENT ON TABLE product_variants IS 'Варианты товара по размерам. Остатки, корзина и заказы ссылаются на вариант';
CREATE INDEX idx_variants_size ON product_variants(size_id);

-- =====================================================================
-- 3. СКЛАД
-- =====================================================================

CREATE TABLE warehouses (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(120) NOT NULL UNIQUE,
  city       VARCHAR(80) NOT NULL,
  address    VARCHAR(200) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE warehouses IS 'Склады площадки (Минск, Москва, Алматы)';

CREATE TABLE stock (
  id           SERIAL PRIMARY KEY,
  variant_id   INT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  warehouse_id INT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  quantity     INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved     INT NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (variant_id, warehouse_id),
  CHECK (reserved <= quantity)
);
COMMENT ON TABLE stock IS 'Остатки варианта на складе. Доступно к продаже = quantity − reserved';
COMMENT ON COLUMN stock.quantity IS 'Фактически лежит на складе';
COMMENT ON COLUMN stock.reserved IS 'Зарезервировано под оформленные, но ещё не переданные в доставку заказы';
CREATE INDEX idx_stock_warehouse ON stock(warehouse_id);
CREATE TRIGGER trg_stock_updated BEFORE UPDATE ON stock FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE stock_movements (
  id           SERIAL PRIMARY KEY,
  variant_id   INT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  warehouse_id INT NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  type         VARCHAR(10) NOT NULL CHECK (type IN ('income', 'reserve', 'unreserve', 'outcome', 'return', 'writeoff')),
  quantity     INT NOT NULL CHECK (quantity > 0),
  order_id     INT,
  user_id      INT REFERENCES users(id) ON DELETE SET NULL,
  comment      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE stock_movements IS 'Журнал движения остатков. reserve — оформление заказа; outcome — передача в доставку; unreserve — отмена; return — принятый возврат; income — приёмка; writeoff — списание';
COMMENT ON COLUMN stock_movements.user_id IS 'Кто выполнил движение (кладовщик, покупатель при оформлении, система)';
CREATE INDEX idx_movements_variant ON stock_movements(variant_id);
CREATE INDEX idx_movements_warehouse ON stock_movements(warehouse_id, created_at DESC);
CREATE INDEX idx_movements_type ON stock_movements(type);
CREATE INDEX idx_movements_order ON stock_movements(order_id);
CREATE INDEX idx_movements_created ON stock_movements(created_at DESC);

-- =====================================================================
-- 4. ПОКУПКИ
-- =====================================================================

CREATE TABLE carts (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE carts IS 'Корзина авторизованного пользователя (одна на пользователя). Гостевая корзина живёт в localStorage и объединяется после входа';
CREATE TRIGGER trg_carts_updated BEFORE UPDATE ON carts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE cart_items (
  id         SERIAL PRIMARY KEY,
  cart_id    INT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  variant_id INT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity   INT NOT NULL CHECK (quantity BETWEEN 1 AND 20),
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cart_id, variant_id)
);
COMMENT ON TABLE cart_items IS 'Позиции корзины: вариант (товар + размер) и количество';
CREATE INDEX idx_cart_items_variant ON cart_items(variant_id);

CREATE TABLE wishlist (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, product_id)
);
COMMENT ON TABLE wishlist IS 'Избранное (только для авторизованных)';
CREATE INDEX idx_wishlist_product ON wishlist(product_id);

CREATE TABLE comparisons (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, product_id)
);
COMMENT ON TABLE comparisons IS 'Сравнение товаров: не больше 4 на пользователя (проверка в API и триггер trg_comparisons_limit)';

-- Триггер: не даёт добавить пятый товар в сравнение даже в обход API
CREATE FUNCTION check_comparisons_limit() RETURNS trigger AS $$
BEGIN
  IF (SELECT COUNT(*) FROM comparisons WHERE user_id = NEW.user_id) >= 4 THEN
    RAISE EXCEPTION 'AMF:compare.limit|max=4';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_comparisons_limit BEFORE INSERT ON comparisons FOR EACH ROW EXECUTE FUNCTION check_comparisons_limit();

CREATE TABLE viewed_products (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  viewed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, product_id)
);
COMMENT ON TABLE viewed_products IS 'Недавно просмотренные товары (блок «Вы смотрели»); при повторном просмотре обновляется viewed_at';
CREATE INDEX idx_viewed_user ON viewed_products(user_id, viewed_at DESC);

CREATE TABLE promo_codes (
  id               SERIAL PRIMARY KEY,
  code             VARCHAR(30) NOT NULL UNIQUE CHECK (code = UPPER(code)),
  discount_percent SMALLINT NOT NULL CHECK (discount_percent BETWEEN 1 AND 90),
  valid_from       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_to         TIMESTAMPTZ,
  usage_limit      INT CHECK (usage_limit IS NULL OR usage_limit > 0),
  used_count       INT NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (valid_to IS NULL OR valid_to > valid_from),
  CHECK (usage_limit IS NULL OR used_count <= usage_limit)
);
COMMENT ON TABLE promo_codes IS 'Промокоды. used_count увеличивается при оформлении заказа в той же транзакции';
COMMENT ON COLUMN promo_codes.usage_limit IS 'NULL — без ограничения числа использований';
CREATE TRIGGER trg_promo_updated BEFORE UPDATE ON promo_codes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================
-- 5. ЗАКАЗЫ, ДОСТАВКА, ВОЗВРАТЫ
-- =====================================================================

CREATE TABLE delivery_methods (
  id         SERIAL PRIMARY KEY,
  code       VARCHAR(20) NOT NULL UNIQUE,
  name_ru    VARCHAR(80) NOT NULL,
  name_en    VARCHAR(80) NOT NULL,
  price_byn  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price_byn >= 0),
  days_min   SMALLINT NOT NULL CHECK (days_min >= 0),
  days_max   SMALLINT NOT NULL,
  is_pickup  BOOLEAN NOT NULL DEFAULT FALSE,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  CHECK (days_max >= days_min)
);
COMMENT ON TABLE delivery_methods IS 'Способы доставки (курьер, Белпочта, Европочта, СДЭК, Boxberry, самовывоз)';
COMMENT ON COLUMN delivery_methods.is_pickup IS 'TRUE — выдача в пункте: в цепочке статусов есть шаг arrived («прибыл в пункт выдачи»)';

CREATE TABLE payment_methods (
  id         SERIAL PRIMARY KEY,
  code       VARCHAR(20) NOT NULL UNIQUE,
  name_ru    VARCHAR(80) NOT NULL,
  name_en    VARCHAR(80) NOT NULL,
  is_online  BOOLEAN NOT NULL DEFAULT FALSE,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order SMALLINT NOT NULL DEFAULT 0
);
COMMENT ON TABLE payment_methods IS 'Способы оплаты: карта (имитация), ЕРИП (имитация), наличными при получении';
COMMENT ON COLUMN payment_methods.is_online IS 'TRUE — оплата при оформлении: заказ сразу confirmed + paid; FALSE — paid ставится при delivered';

-- Номер заказа формата AMF-2026-000123
CREATE SEQUENCE order_number_seq START 1;
CREATE FUNCTION next_order_number() RETURNS TEXT AS $$
  SELECT 'AMF-' || to_char(NOW(), 'YYYY') || '-' || LPAD(nextval('order_number_seq')::TEXT, 6, '0');
$$ LANGUAGE sql;

CREATE TABLE orders (
  id                     SERIAL PRIMARY KEY,
  order_number           VARCHAR(20) NOT NULL UNIQUE DEFAULT next_order_number(),
  tracking_number        VARCHAR(20) NOT NULL UNIQUE,
  user_id                INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  contact_name           VARCHAR(120) NOT NULL,
  contact_phone          VARCHAR(30) NOT NULL,
  contact_email          VARCHAR(255) NOT NULL,
  address_id             INT REFERENCES addresses(id) ON DELETE SET NULL,
  address_snapshot       TEXT NOT NULL,
  delivery_method_id     INT NOT NULL REFERENCES delivery_methods(id) ON DELETE RESTRICT,
  payment_method_id      INT NOT NULL REFERENCES payment_methods(id) ON DELETE RESTRICT,
  subtotal_byn           NUMERIC(12,2) NOT NULL CHECK (subtotal_byn >= 0),
  delivery_price_byn     NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (delivery_price_byn >= 0),
  discount_byn           NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_byn >= 0),
  total_byn              NUMERIC(12,2) NOT NULL CHECK (total_byn >= 0),
  promo_code_id          INT REFERENCES promo_codes(id) ON DELETE SET NULL,
  currency               VARCHAR(3) NOT NULL DEFAULT 'BYN' CHECK (currency IN ('BYN', 'USD', 'EUR')),
  exchange_rate          NUMERIC(12,6) NOT NULL DEFAULT 1 CHECK (exchange_rate > 0),
  total_in_currency      NUMERIC(12,2) NOT NULL CHECK (total_in_currency >= 0),
  status                 VARCHAR(20) NOT NULL DEFAULT 'created' CHECK (status IN (
                           'created', 'confirmed', 'assembling', 'assembled', 'handed_to_delivery',
                           'in_transit', 'arrived', 'delivered', 'cancelled', 'returned')),
  payment_status         VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
  courier_id             INT REFERENCES users(id) ON DELETE SET NULL,
  comment                TEXT,
  expected_delivery_date DATE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE orders IS 'Заказы. Цены, валюта и курс фиксируются на момент оформления';
COMMENT ON COLUMN orders.order_number IS 'Номер заказа AMF-ГГГГ-NNNNNN (последовательность order_number_seq)';
COMMENT ON COLUMN orders.tracking_number IS 'Трек-номер в формате S10 (2 буквы + 8 цифр + контрольная цифра + BY) для публичного отслеживания /tracking';
COMMENT ON COLUMN orders.address_snapshot IS 'Копия адреса текстом на момент заказа — не меняется, даже если адрес удалят из адресной книги';
COMMENT ON COLUMN orders.exchange_rate IS 'Курс валюты заказа к BYN (сколько BYN за 1 единицу валюты) на момент оформления';
COMMENT ON COLUMN orders.total_in_currency IS 'Итог в валюте заказа = total_byn / exchange_rate';
COMMENT ON COLUMN orders.status IS 'created → confirmed → assembling → assembled → handed_to_delivery → in_transit → (arrived) → delivered; отдельно cancelled, returned';
COMMENT ON COLUMN orders.courier_id IS 'Курьер, назначенный владельцем площадки';
CREATE INDEX idx_orders_user ON orders(user_id, created_at DESC);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_courier ON orders(courier_id);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- stock_movements.order_id → orders: внешний ключ добавляется здесь, т.к. orders создаётся позже stock_movements
ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_order_fk FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

CREATE TABLE order_items (
  id              SERIAL PRIMARY KEY,
  order_id        INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id      INT REFERENCES product_variants(id) ON DELETE SET NULL,
  product_id      INT REFERENCES products(id) ON DELETE SET NULL,
  seller_id       INT REFERENCES users(id) ON DELETE SET NULL,
  warehouse_id    INT REFERENCES warehouses(id) ON DELETE SET NULL,
  product_name    VARCHAR(255) NOT NULL,
  product_name_en VARCHAR(255) NOT NULL DEFAULT '',
  size_label      VARCHAR(20),
  sku             VARCHAR(48),
  image_url       VARCHAR(500),
  price_byn       NUMERIC(12,2) NOT NULL CHECK (price_byn >= 0),
  quantity        INT NOT NULL CHECK (quantity > 0)
);
COMMENT ON TABLE order_items IS 'Состав заказа. Название, размер, артикул и цена — снимки на момент покупки';
COMMENT ON COLUMN order_items.warehouse_id IS 'Склад, с которого зарезервирован товар (если одного склада мало — позиция делится на строки по складам)';
COMMENT ON COLUMN order_items.seller_id IS 'Продавец товара — продавец видит заказы со своими позициями';
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_variant ON order_items(variant_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);
CREATE INDEX idx_order_items_seller ON order_items(seller_id);

CREATE TABLE order_status_history (
  id         SERIAL PRIMARY KEY,
  order_id   INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status     VARCHAR(20) NOT NULL,
  changed_by INT REFERENCES users(id) ON DELETE SET NULL,
  comment    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE order_status_history IS 'История статусов заказа (таймлайн отслеживания). Каждая смена статуса также создаёт уведомление покупателю';
CREATE INDEX idx_status_history_order ON order_status_history(order_id, created_at);

CREATE TABLE return_requests (
  id            SERIAL PRIMARY KEY,
  order_id      INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id INT NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  user_id       INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quantity      INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  reason_code   VARCHAR(20) NOT NULL DEFAULT 'other'
                CHECK (reason_code IN ('size', 'defect', 'not_as_described', 'changed_mind', 'wrong_item', 'other')),
  reason        TEXT NOT NULL,
  photo         VARCHAR(500),
  status        VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  resolved_by   INT REFERENCES users(id) ON DELETE SET NULL,
  comment       TEXT,
  resolved_at   TIMESTAMPTZ,
  received_by   INT REFERENCES users(id) ON DELETE SET NULL,
  received_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE return_requests IS 'Заявки на возврат: покупатель подаёт в течение 14 дней после получения; поддержка одобряет/отклоняет; кладовщик принимает товар на склад (движение return)';
COMMENT ON COLUMN return_requests.comment IS 'Комментарий сотрудника поддержки к решению';
COMMENT ON COLUMN return_requests.received_at IS 'Когда кладовщик принял возвращённый товар (quantity += N на складе)';
CREATE INDEX idx_returns_order ON return_requests(order_id);
CREATE INDEX idx_returns_user ON return_requests(user_id);
CREATE INDEX idx_returns_status ON return_requests(status);
CREATE UNIQUE INDEX uq_returns_item_active ON return_requests(order_item_id) WHERE status <> 'rejected';

-- =====================================================================
-- 6. ОТЗЫВЫ, ПОДДЕРЖКА, УВЕДОМЛЕНИЯ, ПРОЧЕЕ
-- =====================================================================

CREATE TABLE reviews (
  id            SERIAL PRIMARY KEY,
  product_id    INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id       INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_item_id INT REFERENCES order_items(id) ON DELETE SET NULL,
  rating        SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text          TEXT NOT NULL,
  status        VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  moderated_by  INT REFERENCES users(id) ON DELETE SET NULL,
  moderated_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, user_id)
);
COMMENT ON TABLE reviews IS 'Отзывы. Оставить можно только на купленный и доставленный товар; на сайте видны только approved';
COMMENT ON COLUMN reviews.order_item_id IS 'Позиция заказа, подтверждающая покупку';
CREATE INDEX idx_reviews_product ON reviews(product_id, status, created_at DESC);
CREATE INDEX idx_reviews_status ON reviews(status);
CREATE INDEX idx_reviews_user ON reviews(user_id);

-- Триггер: пересчитывает products.rating_avg и reviews_count по одобренным отзывам
CREATE FUNCTION refresh_product_rating() RETURNS trigger AS $$
DECLARE
  pid INT;
BEGIN
  IF TG_OP = 'DELETE' THEN pid := OLD.product_id; ELSE pid := NEW.product_id; END IF;
  UPDATE products p
     SET rating_avg = COALESCE((SELECT ROUND(AVG(r.rating)::NUMERIC, 2) FROM reviews r WHERE r.product_id = pid AND r.status = 'approved'), 0),
         reviews_count = (SELECT COUNT(*) FROM reviews r WHERE r.product_id = pid AND r.status = 'approved')
   WHERE p.id = pid;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_reviews_rating AFTER INSERT OR DELETE OR UPDATE OF rating, status ON reviews
  FOR EACH ROW EXECUTE FUNCTION refresh_product_rating();

CREATE TABLE support_tickets (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id    INT REFERENCES orders(id) ON DELETE SET NULL,
  subject     VARCHAR(200) NOT NULL,
  status      VARCHAR(10) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'closed')),
  assigned_to INT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE support_tickets IS 'Обращения в поддержку. open — ждёт ответа; answered — поддержка ответила; closed — закрыто';
CREATE INDEX idx_tickets_user ON support_tickets(user_id);
CREATE INDEX idx_tickets_status ON support_tickets(status, updated_at DESC);
CREATE TRIGGER trg_tickets_updated BEFORE UPDATE ON support_tickets FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE ticket_messages (
  id         SERIAL PRIMARY KEY,
  ticket_id  INT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id    INT REFERENCES users(id) ON DELETE SET NULL,
  message    TEXT NOT NULL,
  image      VARCHAR(500),
  is_staff   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE ticket_messages IS 'Сообщения переписки в обращении; is_staff = TRUE — ответ сотрудника';
CREATE INDEX idx_ticket_messages_ticket ON ticket_messages(ticket_id, created_at);

CREATE TABLE notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(30) NOT NULL,
  title_ru   VARCHAR(200) NOT NULL,
  title_en   VARCHAR(200) NOT NULL,
  text_ru    TEXT NOT NULL DEFAULT '',
  text_en    TEXT NOT NULL DEFAULT '',
  link       VARCHAR(300),
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE notifications IS 'Уведомления (колокольчик): смена статуса заказа, ответ поддержки, решения по товару, заявке, возврату';
COMMENT ON COLUMN notifications.type IS 'order_status / ticket_reply / product_moderation / seller_application / return_decision / system';
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

CREATE TABLE currency_rates (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(3) NOT NULL UNIQUE CHECK (code IN ('BYN', 'USD', 'EUR')),
  rate_to_byn NUMERIC(12,6) NOT NULL CHECK (rate_to_byn > 0),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  INT REFERENCES users(id) ON DELETE SET NULL
);
COMMENT ON TABLE currency_rates IS 'Курсы валют к BYN (редактирует owner). Цена в валюте = price_byn / rate_to_byn';
COMMENT ON COLUMN currency_rates.rate_to_byn IS 'Сколько BYN стоит 1 единица валюты (у BYN = 1)';

CREATE TABLE audit_log (
  id         SERIAL PRIMARY KEY,
  user_id    INT REFERENCES users(id) ON DELETE SET NULL,
  action     VARCHAR(60) NOT NULL,
  entity     VARCHAR(40) NOT NULL,
  entity_id  INT,
  old_data   JSONB,
  new_data   JSONB,
  ip         VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE audit_log IS 'Журнал действий сотрудников (модерация, роли, блокировки, справочники). old_data / new_data — «было / стало»';
CREATE INDEX idx_audit_user ON audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_entity ON audit_log(entity, entity_id);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

CREATE TABLE banners (
  id            SERIAL PRIMARY KEY,
  title_ru      VARCHAR(200) NOT NULL,
  title_en      VARCHAR(200) NOT NULL,
  subtitle_ru   VARCHAR(300) NOT NULL DEFAULT '',
  subtitle_en   VARCHAR(300) NOT NULL DEFAULT '',
  image         VARCHAR(500) NOT NULL,
  link          VARCHAR(300) NOT NULL DEFAULT '/',
  brand_id      INT REFERENCES brands(id) ON DELETE SET NULL,
  collection_id INT REFERENCES collections(id) ON DELETE SET NULL,
  sort_order    SMALLINT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE banners IS 'Слайды hero-слайдера главной (новые коллекции брендов)';
COMMENT ON COLUMN banners.brand_id IS 'Бренд слайда — задаёт акцентный цвет и подпись';
CREATE INDEX idx_banners_active ON banners(is_active, sort_order);
CREATE TRIGGER trg_banners_updated BEFORE UPDATE ON banners FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE newsletter_subscribers (
  id         SERIAL PRIMARY KEY,
  email      VARCHAR(255) NOT NULL UNIQUE CHECK (email = LOWER(email)),
  lang       VARCHAR(2) NOT NULL DEFAULT 'ru' CHECK (lang IN ('ru', 'en')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE newsletter_subscribers IS 'Подписчики рассылки (форма в подвале и на главной)';

-- =====================================================================
-- 7. ПРЕДСТАВЛЕНИЯ ДЛЯ АДМИНКИ И ЗАПРОСОВ
-- =====================================================================

-- Суммарные остатки варианта по всем складам
CREATE VIEW v_variant_stock AS
SELECT pv.id AS variant_id,
       pv.product_id,
       COALESCE(SUM(s.quantity), 0)::INT              AS quantity,
       COALESCE(SUM(s.reserved), 0)::INT              AS reserved,
       COALESCE(SUM(s.quantity - s.reserved), 0)::INT AS available
  FROM product_variants pv
  LEFT JOIN stock s ON s.variant_id = pv.id
 GROUP BY pv.id;
COMMENT ON VIEW v_variant_stock IS 'Остатки варианта по всем складам: quantity, reserved, available = quantity − reserved';

-- Продажи по брендам (отменённые и возвращённые заказы не учитываются)
CREATE VIEW v_sales_by_brand AS
WITH sold AS (
  SELECT p.brand_id, oi.order_id, oi.quantity, oi.price_byn
    FROM order_items oi
    JOIN orders o   ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
   WHERE o.status NOT IN ('cancelled', 'returned')
)
SELECT b.id AS brand_id,
       b.name AS brand_name,
       b.slug AS brand_slug,
       b.accent_color,
       COUNT(DISTINCT s.order_id)::INT                         AS orders_count,
       COALESCE(SUM(s.quantity), 0)::INT                       AS items_sold,
       COALESCE(SUM(s.quantity * s.price_byn), 0)::NUMERIC(14,2) AS revenue_byn
  FROM brands b
  LEFT JOIN sold s ON s.brand_id = b.id
 GROUP BY b.id;
COMMENT ON VIEW v_sales_by_brand IS 'Дашборд: выручка и продажи по брендам';

-- Топ товаров по проданным штукам
CREATE VIEW v_top_products AS
SELECT p.id AS product_id,
       p.sku,
       p.name_ru,
       p.name_en,
       b.name AS brand_name,
       SUM(oi.quantity)::INT                         AS units_sold,
       SUM(oi.quantity * oi.price_byn)::NUMERIC(14,2) AS revenue_byn,
       p.views_count,
       p.rating_avg,
       p.reviews_count,
       (SELECT pi.url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_main DESC, pi.sort_order LIMIT 1) AS image
  FROM order_items oi
  JOIN orders o   ON o.id = oi.order_id AND o.status NOT IN ('cancelled', 'returned')
  JOIN products p ON p.id = oi.product_id
  JOIN brands b   ON b.id = p.brand_id
 GROUP BY p.id, b.name;
COMMENT ON VIEW v_top_products IS 'Дашборд: топ товаров по продажам';

-- Низкие остатки: доступно меньше 3 штук
CREATE VIEW v_low_stock AS
SELECT s.id AS stock_id,
       s.variant_id,
       s.warehouse_id,
       w.name AS warehouse_name,
       w.city AS warehouse_city,
       p.id   AS product_id,
       p.sku,
       pv.sku_variant,
       p.name_ru,
       p.name_en,
       b.name AS brand_name,
       sz.value_int AS size_label,
       s.quantity,
       s.reserved,
       (s.quantity - s.reserved) AS available
  FROM stock s
  JOIN warehouses w        ON w.id = s.warehouse_id
  JOIN product_variants pv ON pv.id = s.variant_id
  JOIN products p          ON p.id = pv.product_id
  JOIN brands b            ON b.id = p.brand_id
  JOIN sizes sz            ON sz.id = pv.size_id
 WHERE s.quantity - s.reserved < 3;
COMMENT ON VIEW v_low_stock IS 'Склад и дашборд: позиции, где доступно к продаже меньше 3 шт.';
