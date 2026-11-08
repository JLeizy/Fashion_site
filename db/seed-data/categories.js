// Дерево категорий (таблица categories). code — часть артикула товара (SKU).
export const CATEGORIES = [
  {
    slug: 'clothing', name_ru: 'Одежда', name_en: 'Clothing', size_type: 'clothing',
    children: [
      { slug: 'tshirts', code: 'TSH', name_ru: 'Футболки', name_en: 'T-shirts' },
      { slug: 'hoodies', code: 'HOD', name_ru: 'Худи', name_en: 'Hoodies' },
      { slug: 'sweaters', code: 'SWT', name_ru: 'Свитеры', name_en: 'Sweaters' },
      { slug: 'shirts', code: 'SHR', name_ru: 'Рубашки', name_en: 'Shirts' },
      { slug: 'jackets', code: 'JKT', name_ru: 'Куртки', name_en: 'Jackets' },
      { slug: 'coats', code: 'COT', name_ru: 'Пальто', name_en: 'Coats' },
      { slug: 'trousers', code: 'TRS', name_ru: 'Брюки', name_en: 'Trousers' },
      { slug: 'jeans', code: 'JNS', name_ru: 'Джинсы', name_en: 'Jeans' },
      { slug: 'shorts', code: 'SHT', name_ru: 'Шорты', name_en: 'Shorts' },
      { slug: 'dresses', code: 'DRS', name_ru: 'Платья', name_en: 'Dresses' },
      { slug: 'skirts', code: 'SKT', name_ru: 'Юбки', name_en: 'Skirts' },
      { slug: 'suits', code: 'SUI', name_ru: 'Костюмы', name_en: 'Suits' },
      { slug: 'underwear', code: 'UND', name_ru: 'Бельё', name_en: 'Underwear' },
    ],
  },
  {
    slug: 'shoes', name_ru: 'Обувь', name_en: 'Shoes', size_type: 'shoes',
    children: [
      { slug: 'sneakers', code: 'SNK', name_ru: 'Кроссовки', name_en: 'Sneakers' },
      { slug: 'boots', code: 'BOT', name_ru: 'Ботинки', name_en: 'Boots' },
      { slug: 'heels', code: 'HEL', name_ru: 'Туфли', name_en: 'Pumps & Flats' },
      { slug: 'loafers', code: 'LOF', name_ru: 'Лоферы', name_en: 'Loafers' },
      { slug: 'sandals', code: 'SND', name_ru: 'Сандалии', name_en: 'Sandals' },
    ],
  },
  {
    slug: 'bags', name_ru: 'Сумки', name_en: 'Bags', size_type: 'one_size',
    children: [
      { slug: 'totes', code: 'TOT', name_ru: 'Тоуты', name_en: 'Totes' },
      { slug: 'crossbody', code: 'CRB', name_ru: 'Кросс-боди', name_en: 'Crossbody' },
      { slug: 'backpacks', code: 'BPK', name_ru: 'Рюкзаки', name_en: 'Backpacks' },
      { slug: 'clutches', code: 'CLT', name_ru: 'Клатчи', name_en: 'Clutches' },
    ],
  },
  {
    slug: 'accessories', name_ru: 'Аксессуары', name_en: 'Accessories', size_type: 'one_size',
    children: [
      { slug: 'belts', code: 'BLT', name_ru: 'Ремни', name_en: 'Belts' },
      { slug: 'sunglasses', code: 'SUN', name_ru: 'Очки', name_en: 'Sunglasses' },
      { slug: 'headwear', code: 'HAT', name_ru: 'Головные уборы', name_en: 'Headwear' },
      { slug: 'scarves', code: 'SCF', name_ru: 'Шарфы', name_en: 'Scarves' },
      { slug: 'wallets', code: 'WAL', name_ru: 'Кошельки', name_en: 'Wallets' },
      { slug: 'gloves', code: 'GLV', name_ru: 'Перчатки', name_en: 'Gloves' },
      { slug: 'socks', code: 'SOK', name_ru: 'Носки', name_en: 'Socks' },
    ],
  },
  {
    slug: 'jewelry', name_ru: 'Ювелирные изделия', name_en: 'Jewelry', size_type: 'one_size',
    children: [
      { slug: 'rings', code: 'RNG', name_ru: 'Кольца', name_en: 'Rings', size_type: 'ring' },
      { slug: 'chains', code: 'CHN', name_ru: 'Цепи', name_en: 'Chains' },
      { slug: 'bracelets', code: 'BRC', name_ru: 'Браслеты', name_en: 'Bracelets' },
      { slug: 'earrings', code: 'EAR', name_ru: 'Серьги', name_en: 'Earrings' },
      { slug: 'pendants', code: 'PND', name_ru: 'Подвески', name_en: 'Pendants' },
    ],
  },
  {
    slug: 'fragrance', name_ru: 'Парфюмерия', name_en: 'Fragrance', size_type: 'volume_ml',
    children: [
      { slug: 'fragrance-men', code: 'PFM', name_ru: 'Мужская', name_en: 'For him' },
      { slug: 'fragrance-women', code: 'PFW', name_ru: 'Женская', name_en: 'For her' },
      { slug: 'fragrance-unisex', code: 'PFU', name_ru: 'Унисекс', name_en: 'Unisex' },
    ],
  },
  {
    slug: 'home', name_ru: 'Для дома', name_en: 'Home', size_type: 'one_size',
    children: [
      { slug: 'homeware', code: 'HOM', name_ru: 'Предметы интерьера', name_en: 'Homeware' },
    ],
  },
];

// Плоский список подкатегорий: slug → { code, parent, size_type }
export const SUBCATEGORY_INFO = Object.fromEntries(
  CATEGORIES.flatMap((root) =>
    root.children.map((child) => [child.slug, { code: child.code, parent: root.slug, size_type: child.size_type || root.size_type }])
  )
);
