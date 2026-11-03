// Тестовые пользователи (таблица users). Пароль у всех одинаковый — см. README.md.
export const TEST_PASSWORD = 'Amfibia2026';

// Сотрудники, продавцы и основной тестовый покупатель
export const STAFF = [
  { email: 'owner@amfibia.by', first_name: 'Александра', last_name: 'Вершинина', role: 'owner', phone: '+375291110001' },
  { email: 'moderator@amfibia.by', first_name: 'Олег', last_name: 'Савицкий', role: 'moderator', phone: '+375291110002' },
  { email: 'support@amfibia.by', first_name: 'Марина', last_name: 'Ветрова', role: 'support', phone: '+375291110003' },
  { email: 'warehouse@amfibia.by', first_name: 'Павел', last_name: 'Кротов', role: 'warehouse', phone: '+375291110004' },
  { email: 'courier@amfibia.by', first_name: 'Денис', last_name: 'Быков', role: 'courier', phone: '+375291110005' },
  { email: 'courier2@amfibia.by', first_name: 'Сергей', last_name: 'Ляхов', role: 'courier', phone: '+375291110006' },
  { email: 'official@amfibia.by', first_name: 'Amfibia', last_name: 'Official', role: 'seller', phone: '+375291110010', shop: 'Amfibia Official', shopDesc: 'Официальный магазин площадки: товары напрямую от брендов и их дистрибьюторов, каждая вещь проходит проверку подлинности.' },
  { email: 'seller1@amfibia.by', first_name: 'Илья', last_name: 'Шевчук', role: 'seller', phone: '+375291110011', shop: 'Archive Room Minsk', shopDesc: 'Архивные вещи Balenciaga, Vetements и Enfants Riches Déprimés из коллекций разных лет.' },
  { email: 'seller2@amfibia.by', first_name: 'Кира', last_name: 'Белова', role: 'seller', phone: '+375291110012', shop: 'Silver Cross Atelier', shopDesc: 'Серебро и аксессуары: Chrome Hearts, Alexander McQueen, Givenchy.' },
  { email: 'seller3@amfibia.by', first_name: 'Андрей', last_name: 'Ремизов', role: 'seller', phone: '+375291110013', shop: 'Maison Noire Vintage', shopDesc: 'Винтаж и классика: Chanel, Louis Vuitton, Maison Margiela.' },
  { email: 'buyer@amfibia.by', first_name: 'Ева', last_name: 'Лисовская', role: 'buyer', phone: '+375291234567', country: 'BY', city: 'Минск', street: 'пр. Независимости', house: '58', apartment: '12', postal: '220005' },
];

// 20 покупателей из разных стран СНГ
export const BUYERS = [
  { email: 'anna.kovaleva@example.com', first_name: 'Анна', last_name: 'Ковалёва', phone: '+375297001001', country: 'BY', city: 'Минск', street: 'ул. Немига', house: '12', apartment: '45', postal: '220030' },
  { email: 'dmitry.sokolov@example.com', first_name: 'Дмитрий', last_name: 'Соколов', phone: '+79161002002', country: 'RU', city: 'Москва', street: 'ул. Тверская', house: '18', apartment: '7', postal: '125009' },
  { email: 'aliya.nurlanova@example.com', first_name: 'Алия', last_name: 'Нурланова', phone: '+77011003003', country: 'KZ', city: 'Алматы', street: 'пр. Абая', house: '44', apartment: '19', postal: '050000' },
  { email: 'arman.petrosyan@example.com', first_name: 'Арман', last_name: 'Петросян', phone: '+37491004004', country: 'AM', city: 'Ереван', street: 'ул. Абовяна', house: '9', apartment: '3', postal: '0001' },
  { email: 'maria.lebedeva@example.com', first_name: 'Мария', last_name: 'Лебедева', phone: '+79211005005', country: 'RU', city: 'Санкт-Петербург', street: 'Невский пр.', house: '102', apartment: '56', postal: '191025' },
  { email: 'timur.karimov@example.com', first_name: 'Тимур', last_name: 'Каримов', phone: '+998901006006', country: 'UZ', city: 'Ташкент', street: 'ул. Амира Темура', house: '25', apartment: '8', postal: '100000' },
  { email: 'ekaterina.novik@example.com', first_name: 'Екатерина', last_name: 'Новик', phone: '+375291007007', country: 'BY', city: 'Минск', street: 'ул. Сурганова', house: '27', apartment: '101', postal: '220012' },
  { email: 'igor.vasilevsky@example.com', first_name: 'Игорь', last_name: 'Василевский', phone: '+375331008008', country: 'BY', city: 'Гродно', street: 'ул. Советская', house: '5', apartment: '14', postal: '230025' },
  { email: 'sofia.morozova@example.com', first_name: 'Софья', last_name: 'Морозова', phone: '+79871009009', country: 'RU', city: 'Казань', street: 'ул. Баумана', house: '33', apartment: '21', postal: '420111' },
  { email: 'aibek.zhumabaev@example.com', first_name: 'Айбек', last_name: 'Жумабаев', phone: '+996555010010', country: 'KG', city: 'Бишкек', street: 'пр. Чуй', house: '120', apartment: '5', postal: '720001' },
  { email: 'polina.grin@example.com', first_name: 'Полина', last_name: 'Гринь', phone: '+375291011011', country: 'BY', city: 'Брест', street: 'ул. Гоголя', house: '41', apartment: '9', postal: '224030' },
  { email: 'nikita.orlov@example.com', first_name: 'Никита', last_name: 'Орлов', phone: '+79031012012', country: 'RU', city: 'Москва', street: 'ул. Арбат', house: '24', apartment: '17', postal: '119002' },
  { email: 'dana.seitkali@example.com', first_name: 'Дана', last_name: 'Сейткали', phone: '+77021013013', country: 'KZ', city: 'Астана', street: 'пр. Мангилик Ел', house: '8', apartment: '64', postal: '010000' },
  { email: 'lilit.akopyan@example.com', first_name: 'Лилит', last_name: 'Акопян', phone: '+37477014014', country: 'AM', city: 'Ереван', street: 'пр. Маштоца', house: '31', apartment: '12', postal: '0002' },
  { email: 'maxim.zhuk@example.com', first_name: 'Максим', last_name: 'Жук', phone: '+375441015015', country: 'BY', city: 'Гомель', street: 'ул. Советская', house: '67', apartment: '30', postal: '246050' },
  { email: 'victoria.romanova@example.com', first_name: 'Виктория', last_name: 'Романова', phone: '+79121016016', country: 'RU', city: 'Екатеринбург', street: 'ул. Малышева', house: '51', apartment: '88', postal: '620014' },
  { email: 'ruslan.aliev@example.com', first_name: 'Руслан', last_name: 'Алиев', phone: '+994501017017', country: 'AZ', city: 'Баку', street: 'ул. Низами', house: '15', apartment: '6', postal: 'AZ1000' },
  { email: 'ksenia.bondarenko@example.com', first_name: 'Ксения', last_name: 'Бондаренко', phone: '+79131018018', country: 'RU', city: 'Новосибирск', street: 'Красный пр.', house: '28', apartment: '40', postal: '630099' },
  { email: 'artem.klimovich@example.com', first_name: 'Артём', last_name: 'Климович', phone: '+375291019019', country: 'BY', city: 'Витебск', street: 'ул. Ленина', house: '19', apartment: '23', postal: '210015' },
  { email: 'elizaveta.kim@example.com', first_name: 'Елизавета', last_name: 'Ким', phone: '+998931020020', country: 'UZ', city: 'Ташкент', street: 'ул. Шота Руставели', house: '7', apartment: '11', postal: '100070' },
];

export const ROLES = [
  { code: 'buyer', name_ru: 'Покупатель', name_en: 'Buyer' },
  { code: 'seller', name_ru: 'Продавец', name_en: 'Seller' },
  { code: 'warehouse', name_ru: 'Кладовщик', name_en: 'Warehouse clerk' },
  { code: 'courier', name_ru: 'Курьер', name_en: 'Courier' },
  { code: 'support', name_ru: 'Поддержка', name_en: 'Support' },
  { code: 'moderator', name_ru: 'Модератор', name_en: 'Moderator' },
  { code: 'owner', name_ru: 'Создатель магазина', name_en: 'Store owner' },
];
