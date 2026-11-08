// План подбора реальных фотографий по брендам (правка П4) — читает scripts/collect-image-sources.js.
//   ssense   — слаг дизайнера на SSENSE (предметная съёмка товаров: ракурс _1 — основной, _2 — второй); null — марки там нет
//   vogue    — слаг дизайнера на Vogue Runway (образы показов: обложки коллекций, hero, баннер, иллюстрации истории)
//   history  — иллюстрации разделов истории по порядку (sort_order): { wiki: 'Статья Википедии' } — главное изображение статьи,
//              { vogue: 'сезон', look: N } — образ N показа; в массиве — запасные варианты, берётся первый найденный
//   directors — статья Википедии для портрета (если имя в БД отличается от названия статьи)
export const IMAGE_PLAN = {
  balenciaga: {
    shopFallback: true, // товарам без пары в магазине — другая вещь бренда той же группы, с пометкой в источнике
    ssense: 'balenciaga',
    vogue: 'balenciaga',
    fallbackSeasons: ["spring-2027-ready-to-wear", "fall-2026-ready-to-wear", "spring-2026-ready-to-wear", "fall-2025-ready-to-wear", "spring-2025-ready-to-wear", "fall-2024-ready-to-wear", "spring-2024-ready-to-wear", "fall-2023-ready-to-wear", "spring-2023-ready-to-wear"],
    directors: { Demna: 'Demna (designer)' },
    history: [
      [{ wiki: 'Getaria' }],
      [{ wiki: 'San Sebastián' }],
      [{ vogue: 'fall-2022-couture', look: 3 }],
      [{ wiki: 'Las Meninas' }],
      [{ wiki: 'Avenue George V' }, { vogue: 'fall-2021-couture', look: 2 }],
      [{ vogue: 'fall-2021-couture', look: 1 }],
      [{ vogue: 'fall-2021-couture', look: 10 }],
      [{ vogue: 'fall-2022-couture', look: 1 }],
      [{ vogue: 'fall-2022-couture', look: 12 }],
      [{ vogue: 'fall-2023-couture', look: 1 }],
      [{ wiki: 'Carmel Snow' }, { vogue: 'fall-2023-couture', look: 8 }],
      [{ wiki: 'Mona von Bismarck' }, { vogue: 'fall-2023-couture', look: 20 }],
      [{ vogue: 'fall-2023-couture', look: 15 }],
      [{ vogue: 'fall-2024-couture', look: 1 }],
      [{ wiki: 'Fabiola of Belgium' }, { vogue: 'fall-2024-couture', look: 30 }],
      [{ wiki: 'Hubert de Givenchy' }],
      [{ wiki: 'Jávea' }, { vogue: 'fall-2024-couture', look: 10 }],
      [{ vogue: 'spring-2002-ready-to-wear', look: 1 }, { vogue: 'fall-2002-ready-to-wear', look: 1 }],
      [{ vogue: 'fall-2024-couture', look: 20 }],
      [{ vogue: 'spring-2007-ready-to-wear', look: 1 }, { vogue: 'spring-2008-ready-to-wear', look: 1 }],
      [{ vogue: 'fall-2006-ready-to-wear', look: 1 }, { vogue: 'spring-2011-ready-to-wear', look: 1 }],
      [{ vogue: 'fall-2013-ready-to-wear', look: 1 }, { vogue: 'spring-2014-ready-to-wear', look: 1 }],
      [{ vogue: 'fall-2016-ready-to-wear', look: 1 }, { vogue: 'spring-2017-ready-to-wear', look: 1 }, { vogue: 'fall-2018-ready-to-wear', look: 1 }],
      [{ vogue: 'spring-2018-ready-to-wear', look: 1 }],
      [{ vogue: 'fall-2022-ready-to-wear', look: 1 }],
      [{ vogue: 'fall-2017-ready-to-wear', look: 1 }],
      [{ vogue: 'spring-2025-ready-to-wear', look: 5 }],
      [{ vogue: 'fall-2023-ready-to-wear', look: 1 }],
      [{ vogue: 'spring-2020-ready-to-wear', look: 1 }],
      [{ vogue: 'fall-2019-ready-to-wear', look: 1 }],
      [{ vogue: 'fall-2025-couture', look: 1 }],
      [{ wiki: 'Cristóbal Balenciaga Museum' }, { vogue: 'fall-2025-couture', look: 12 }],
      [{ wiki: 'Cristóbal Balenciaga (TV series)' }, { vogue: 'fall-2021-ready-to-wear', look: 1 }],
      [{ vogue: 'spring-2027-ready-to-wear', look: 1 }, { vogue: 'fall-2026-ready-to-wear', look: 1 }],
      [{ vogue: 'spring-2026-ready-to-wear', look: 5 }],
    ],
  },

  vetements: {
    shopFallback: true, // товарам без пары в магазине — другая вещь бренда той же группы, с пометкой в источнике
    ssense: 'vetements',
    vogue: 'vetements',
    // Показ весна–лето 2026: футболки с перечёркнутой свастикой (принт Antihate) — на сайте не используем ни один кадр
    excludeShows: ['spring-2026-ready-to-wear'],
    directors: { Demna: 'Demna (designer)' },
    fallbackSeasons: ["spring-2027-ready-to-wear", "fall-2026-ready-to-wear", "spring-2026-ready-to-wear", "fall-2025-ready-to-wear", "spring-2025-ready-to-wear", "fall-2024-ready-to-wear", "spring-2024-ready-to-wear", "fall-2023-ready-to-wear", "spring-2023-ready-to-wear"],
    history: [
      [{ wiki: 'Demna (designer)' }],
      [{ vogue: 'fall-2015-ready-to-wear', look: 1 }],
      [{ vogue: 'fall-2015-ready-to-wear', look: 6 }],
      [{ vogue: 'spring-2016-ready-to-wear', look: 1 }],
      [{ vogue: 'fall-2016-ready-to-wear', look: 1 }],
      [{ vogue: 'spring-2017-ready-to-wear', look: 1 }],
      [{ vogue: 'spring-2017-ready-to-wear', look: 12 }],
      [{ wiki: 'Zürich' }],
      [{ vogue: 'spring-2020-ready-to-wear', look: 1 }],
      [{ vogue: 'spring-2023-ready-to-wear', look: 1 }],
      [{ vogue: 'spring-2016-ready-to-wear', look: 10 }],
      [{ vogue: 'spring-2026-ready-to-wear', look: 5 }],
      [{ vogue: 'fall-2018-ready-to-wear', look: 1 }],
      [{ wiki: 'Lotta Volkova' }],
      [{ vogue: 'spring-2026-ready-to-wear', look: 1 }],
      [{ vogue: 'fall-2024-ready-to-wear', look: 1 }],
    ],
  },
  gucci: {
    shopFallback: true, // товарам без пары в магазине — другая вещь бренда той же группы, с пометкой в источнике
    ssense: 'gucci',
    vogue: 'gucci',
    directors: { Demna: 'Demna (designer)' },
    fallbackSeasons: ["spring-2027-ready-to-wear", "fall-2026-ready-to-wear", "spring-2026-ready-to-wear", "fall-2025-ready-to-wear", "spring-2025-ready-to-wear", "fall-2024-ready-to-wear", "spring-2024-ready-to-wear", "fall-2023-ready-to-wear", "spring-2023-ready-to-wear"],
    history: [
      [{ wiki: 'Guccio Gucci' }],
      [{ wiki: 'Ponte Vecchio' }],
      [{ wiki: 'Arno' }],
      [{ vogue: 'spring-2024-ready-to-wear', look: 1 }],
      [{ wiki: 'Via dei Condotti' }],
      [{ wiki: 'Jacqueline Kennedy Onassis' }],
      [{ vogue: 'spring-2016-ready-to-wear', look: 1 }],
      [{ wiki: 'Aldo Gucci' }],
      [{ wiki: 'Maurizio Gucci' }],
      [{ vogue: 'fall-1996-ready-to-wear', look: 1 }],
      [{ wiki: 'Tom Ford' }],
      [{ vogue: 'fall-2003-ready-to-wear', look: 1 }, { vogue: 'spring-2004-ready-to-wear', look: 1 }],
      [{ wiki: 'Domenico De Sole' }],
      [{ wiki: 'Patrizia Reggiani' }],
      [{ wiki: 'François Pinault' }],
      [{ vogue: 'spring-2003-ready-to-wear', look: 1 }],
      [{ vogue: 'fall-2004-ready-to-wear', look: 1 }],
      [{ wiki: 'Frida Giannini' }, { vogue: 'fall-2010-ready-to-wear', look: 1 }],
      [{ wiki: 'Alessandro Michele' }],
      [{ vogue: 'fall-2015-menswear', look: 1 }],
      [{ vogue: 'fall-2017-ready-to-wear', look: 1 }],
      [{ vogue: 'spring-2019-ready-to-wear', look: 1 }],
      [{ wiki: 'Dapper Dan (designer)' }],
      [{ vogue: 'fall-2019-ready-to-wear', look: 5 }],
      [{ vogue: 'spring-2023-ready-to-wear', look: 1 }],
      [{ wiki: 'Sabato De Sarno' }, { vogue: 'spring-2024-ready-to-wear', look: 2 }],
      [{ vogue: 'fall-2024-ready-to-wear', look: 1 }],
      [{ vogue: 'spring-2026-ready-to-wear', look: 1 }],
      [{ vogue: 'fall-2026-ready-to-wear', look: 1 }],
      [{ vogue: 'spring-2025-ready-to-wear', look: 3 }],
      [{ vogue: 'fall-2025-ready-to-wear', look: 5 }],
      [{ vogue: 'spring-2024-ready-to-wear', look: 10 }],
      [{ wiki: 'Grace Kelly' }],
      [{ vogue: 'spring-2017-ready-to-wear', look: 1 }],
      [{ vogue: 'fall-2016-ready-to-wear', look: 1 }],
      [{ wiki: 'House of Gucci' }],
      [{ wiki: 'Kate Moss' }],
      [{ wiki: 'Primavera (Botticelli)' }],
      [{ vogue: 'fall-2018-ready-to-wear', look: 1 }],
      [{ vogue: 'spring-2020-ready-to-wear', look: 1 }],
      [{ vogue: 'spring-2027-ready-to-wear', look: 1 }, { vogue: 'fall-2026-ready-to-wear', look: 5 }],
      [{ vogue: 'fall-2026-ready-to-wear', look: 10 }],
    ],
  },
  prada: {
    vogue: 'prada',
    productSeasons: ["spring-2027-ready-to-wear", "fall-2026-ready-to-wear", "spring-2026-ready-to-wear", "fall-2025-ready-to-wear", "spring-2025-ready-to-wear", "fall-2024-ready-to-wear", "spring-2024-ready-to-wear", "fall-2023-ready-to-wear", "spring-2023-ready-to-wear", "fall-2026-menswear", "spring-2026-menswear", "fall-2025-menswear", "spring-2025-menswear", "fall-2024-menswear", "spring-2024-menswear"],
    fallbackSeasons: ["spring-2027-ready-to-wear", "fall-2026-ready-to-wear", "spring-2026-ready-to-wear", "fall-2025-ready-to-wear", "spring-2025-ready-to-wear", "fall-2024-ready-to-wear", "spring-2024-ready-to-wear", "fall-2023-ready-to-wear", "spring-2023-ready-to-wear"],
    directors: { 'Mario Prada': 'Mario Prada', 'Luisa Prada': null },
  },
  'enfants-riches-deprimes': {
    vogue: 'enfants-riches-deprimes',
    productSeasons: ["spring-2027-ready-to-wear", "fall-2026-ready-to-wear", "spring-2026-ready-to-wear", "fall-2025-ready-to-wear", "spring-2025-ready-to-wear", "fall-2024-ready-to-wear", "spring-2024-ready-to-wear", "fall-2023-ready-to-wear", "spring-2023-ready-to-wear"],
    fallbackSeasons: ["spring-2027-ready-to-wear", "fall-2026-ready-to-wear", "spring-2026-ready-to-wear", "fall-2025-ready-to-wear", "spring-2025-ready-to-wear", "fall-2024-ready-to-wear", "spring-2024-ready-to-wear", "fall-2023-ready-to-wear", "spring-2023-ready-to-wear"],
  },
  avavav: {
    shopFallback: true, // товарам без пары в магазине — другая вещь бренда той же группы, с пометкой в источнике
    ssense: 'avavav',
    vogue: 'avavav',
    fallbackSeasons: ["spring-2027-ready-to-wear", "fall-2026-ready-to-wear", "spring-2026-ready-to-wear", "fall-2025-ready-to-wear", "spring-2025-ready-to-wear", "fall-2024-ready-to-wear", "spring-2024-ready-to-wear", "fall-2023-ready-to-wear", "spring-2023-ready-to-wear"],
  },
  supreme: {
    shopFallback: true, // нет показов на Vogue: история, коллекции и обложка — фото вещей из официального магазина
    shopify: { base: 'https://us.supreme.com', listings: ['/collections/all', '/collections/all?page=2', '/collections/all?page=3'] },
    vogue: [],
    directors: { 'James Jebbia': 'James Jebbia', 'Tremaine Emory': 'Tremaine Emory' },
  },
  'chrome-hearts': {
    // Официальный магазин chromehearts.com (Salesforce Commerce) открывается в браузере; Dover Street Market закрыт для ботов.
    sfcc: { base: 'https://www.chromehearts.com', listings: ['/scarf', '/slippers', '/socks', '/intimates', '/boxers-leggings', '/scents', '/baccarat'] },
    shopFallback: true,
    vogue: [],
    directors: { 'Richard Stark': 'Richard Stark (designer)', 'Laurie Lynn Stark': 'Laurie Lynn Stark' },
  },
  'louis-vuitton': {
    vogue: 'louis-vuitton',
    productSeasons: ["spring-2027-ready-to-wear", "fall-2026-ready-to-wear", "spring-2026-ready-to-wear", "fall-2025-ready-to-wear", "spring-2025-ready-to-wear", "fall-2024-ready-to-wear", "spring-2024-ready-to-wear", "fall-2023-ready-to-wear", "spring-2023-ready-to-wear", "fall-2026-menswear", "spring-2026-menswear", "fall-2025-menswear", "spring-2025-menswear", "fall-2024-menswear", "spring-2024-menswear"],
    fallbackSeasons: ["spring-2027-ready-to-wear", "fall-2026-ready-to-wear", "spring-2026-ready-to-wear", "fall-2025-ready-to-wear", "spring-2025-ready-to-wear", "fall-2024-ready-to-wear", "spring-2024-ready-to-wear", "fall-2023-ready-to-wear", "spring-2023-ready-to-wear"],
    directors: { 'Louis Vuitton': 'Louis Vuitton (designer)', 'Kim Jones': 'Kim Jones (designer)' },
  },
  chanel: {
    vogue: 'chanel',
    productSeasons: ["spring-2027-ready-to-wear", "fall-2026-ready-to-wear", "spring-2026-ready-to-wear", "fall-2025-ready-to-wear", "spring-2025-ready-to-wear", "fall-2024-ready-to-wear", "spring-2024-ready-to-wear", "fall-2023-ready-to-wear", "spring-2023-ready-to-wear"],
    fallbackSeasons: ["spring-2027-ready-to-wear", "fall-2026-ready-to-wear", "spring-2026-ready-to-wear", "fall-2025-ready-to-wear", "spring-2025-ready-to-wear", "fall-2024-ready-to-wear", "spring-2024-ready-to-wear", "fall-2023-ready-to-wear", "spring-2023-ready-to-wear"],
    directors: { 'Gabrielle Chanel': 'Coco Chanel' },
  },
  'maison-margiela': {
    shopFallback: true, // товарам без пары в магазине — другая вещь бренда той же группы, с пометкой в источнике
    ssense: 'maison-margiela',
    vogue: ['maison-martin-margiela', 'maison-margiela'],
    vogueFileKey: 'margiela', // страницы Vogue — maison-martin-margiela, имена файлов — …-margiela-…
    fallbackSeasons: ['spring-2026-ready-to-wear', 'fall-2025-couture', 'spring-2024-ready-to-wear', 'fall-2023-ready-to-wear', 'spring-2024-couture', 'fall-2023-couture', 'spring-2023-couture'],
    directors: { 'Design studio': null },
  },
  givenchy: {
    shopFallback: true, // товарам без пары в магазине — другая вещь бренда той же группы, с пометкой в источнике
    ssense: 'givenchy',
    vogue: 'givenchy',
    fallbackSeasons: ["spring-2027-ready-to-wear", "fall-2026-ready-to-wear", "spring-2026-ready-to-wear", "fall-2025-ready-to-wear", "spring-2025-ready-to-wear", "fall-2024-ready-to-wear", "spring-2024-ready-to-wear", "fall-2023-ready-to-wear", "spring-2023-ready-to-wear"],
    directors: { 'Alexander McQueen': 'Alexander McQueen (designer)', 'Matthew M. Williams': 'Matthew M. Williams', 'Sarah Burton': 'Sarah Burton (designer)' },
  },
  versace: {
    shopFallback: true, // товарам без пары в магазине — другая вещь бренда той же группы, с пометкой в источнике
    ssense: 'versace',
    vogue: 'versace',
    fallbackSeasons: ["spring-2027-ready-to-wear", "fall-2026-ready-to-wear", "spring-2026-ready-to-wear", "fall-2025-ready-to-wear", "spring-2025-ready-to-wear", "fall-2024-ready-to-wear", "spring-2024-ready-to-wear", "fall-2023-ready-to-wear", "spring-2023-ready-to-wear"],
  },
  'alexander-mcqueen': {
    shopFallback: true, // товарам без пары в магазине — другая вещь бренда той же группы, с пометкой в источнике
    ssense: 'alexander-mcqueen',
    vogue: 'alexander-mcqueen',
    fallbackSeasons: ["spring-2027-ready-to-wear", "fall-2026-ready-to-wear", "spring-2026-ready-to-wear", "fall-2025-ready-to-wear", "spring-2025-ready-to-wear", "fall-2024-ready-to-wear", "spring-2024-ready-to-wear", "fall-2023-ready-to-wear", "spring-2023-ready-to-wear"],
    directors: { 'Lee Alexander McQueen': 'Alexander McQueen (designer)', 'Sarah Burton': 'Sarah Burton (designer)' },
  },
  'loro-piana': {
    vogue: 'loro-piana',
    productSeasons: ["fall-2026-menswear", "spring-2026-menswear", "fall-2025-menswear", "spring-2025-menswear", "fall-2024-menswear", "spring-2024-menswear", "spring-2027-ready-to-wear", "fall-2026-ready-to-wear", "spring-2026-ready-to-wear", "fall-2025-ready-to-wear", "spring-2025-ready-to-wear", "fall-2024-ready-to-wear", "spring-2024-ready-to-wear", "fall-2023-ready-to-wear", "spring-2023-ready-to-wear"],
    fallbackSeasons: ["fall-2026-menswear", "spring-2026-menswear", "fall-2025-menswear", "spring-2025-menswear", "fall-2024-menswear", "spring-2024-menswear", "spring-2027-ready-to-wear", "fall-2026-ready-to-wear", "spring-2026-ready-to-wear", "fall-2025-ready-to-wear", "spring-2025-ready-to-wear", "fall-2024-ready-to-wear", "spring-2024-ready-to-wear", "fall-2023-ready-to-wear", "spring-2023-ready-to-wear"],
    directors: { 'Sergio & Pier Luigi Loro Piana': null },
  },
};

export default IMAGE_PLAN;

// ---------- Источники реального каталога товаров (scripts/build-catalog.js, npm run catalog) ----------
// Каждый товар сайта — конкретная вещь из источника; фото, цвет и название — из одной карточки.
const shopPhotos = [{ type: 'shopPhotos' }]; // уже скачанные фото конкретных вещей (SSENSE, Supreme)
const fashionphile = (collection, vendor, pages = 2) => ({ type: 'fashionphile', collections: [collection], vendor, pages });
const pradaListings = [
  'mens/bags/backpacks-and-belt-bags/c/10144US', 'mens/bags/messenger-bags/c/10147US', 'mens/shoes/sneakers/c/10155US', 'mens/shoes/loafers/c/10153US',
  'mens/shoes/boots/c/10150US', 'mens/ready-to-wear/t-shirts-and-polo-shirts/c/10142US', 'mens/ready-to-wear/knitwear/c/10134US',
  'mens/ready-to-wear/outerwear/c/10136US', 'mens/ready-to-wear/shirts/c/10138US', 'mens/ready-to-wear/trousers-and-bermudas/c/10141US',
  'mens/accessories/belts/c/10157US', 'mens/accessories/sunglasses/c/10163US', 'mens/accessories/hats-and-gloves/c/10160US',
  'mens/small-leather-goods/card-holders/c/10349US', 'womens/bags/shoulder-bags/c/10066US', 'womens/bags/top-handles/c/10067US',
  'womens/bags/totes/c/10068US', 'womens/shoes/pumps-and-ballerinas/c/10075US', 'womens/shoes/loafers-and-lace-ups/c/10074US',
  'womens/shoes/sandals-and-mules/c/10720US', 'womens/ready-to-wear/dresses/c/10050US', 'womens/ready-to-wear/skirts/c/10059US',
  'womens/ready-to-wear/knitwear/c/10054US', 'womens/accessories/silks-and-scarves/c/10085US', 'womens/accessories/jewels/c/10621US',
  'womens/accessories/sunglasses/c/10086US',
].map((x) => `/us/en/${x}`);
const CATALOG = {
  balenciaga: shopPhotos,
  givenchy: shopPhotos,
  'maison-margiela': shopPhotos,
  versace: shopPhotos,
  vetements: shopPhotos,
  'alexander-mcqueen': [...shopPhotos, fashionphile('alexander-mcqueen', 'Alexander McQueen', 1)],
  avavav: shopPhotos,
  supreme: shopPhotos,
  chanel: [{
    type: 'chanel', limit: 75,
    listings: ['/us/fashion/handbags/c/1x1x1/', '/us/fashion/shoes/c/1x1x5/', '/us/fashion/costume-jewelry/c/1x1x3/', '/us/fashion/small-leather-goods/c/1x1x2/',
      '/us/fashion/belts/c/1x1x6/', '/us/fashion/scarves/c/1x1x8/', '/us/fashion/headwear/c/1x1x11/', '/us/eyewear/sunglasses/c/2x1x1/'],
  }],
  prada: [{ type: 'prada', perListing: 4, listings: pradaListings }],
  'enfants-riches-deprimes': [{ type: 'erd', listings: ['/collections/new-arrivals-men', '/collections/new-arrivals-women', '/collections/archive', '/collections/all'] }],
  gucci: [fashionphile('gucci', 'Gucci')],
  'louis-vuitton': [fashionphile('louis-vuitton', 'Louis Vuitton')],
  'loro-piana': [fashionphile('loro-piana', 'Loro Piana')],
  'chrome-hearts': [
    { type: 'chromehearts', listings: ['/scents', '/baccarat', '/boxers-leggings', '/intimates', '/socks', '/scarf', '/slippers'] },
    fashionphile('chrome-hearts', 'Chrome Hearts'),
  ],
};
for (const [slug, sources] of Object.entries(CATALOG)) IMAGE_PLAN[slug].catalog = sources;
// Вещи, которые на сайте не показываем (принт с перечёркнутой свастикой — коллекция Antihate)
IMAGE_PLAN.vetements.catalogExclude = 'antihate|anti-hate|swastika';
