// План подбора реальных фотографий по брендам (правка П4) — читает scripts/collect-image-sources.js.
//   ssense   — слаг дизайнера на SSENSE (предметная съёмка товаров: ракурс _1 — основной, _2 — второй); null — марки там нет
//   vogue    — слаг дизайнера на Vogue Runway (образы показов: обложки коллекций, hero, баннер, иллюстрации истории)
//   history  — иллюстрации разделов истории по порядку (sort_order): { wiki: 'Статья Википедии' } — главное изображение статьи,
//              { vogue: 'сезон', look: N } — образ N показа; в массиве — запасные варианты, берётся первый найденный
//   directors — статья Википедии для портрета (если имя в БД отличается от названия статьи)
export const IMAGE_PLAN = {
  balenciaga: {
    ssense: 'balenciaga',
    vogue: 'balenciaga',
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
};

export default IMAGE_PLAN;
