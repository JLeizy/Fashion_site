// История Alexander McQueen (этап 29): разделы собираются из частей alexander-mcqueen/part1–6.js; хронология своя
// (заменяет стартовую из seed-data/brands.js). Все факты сверены через поиск; где источники расходятся — это сказано
// в тексте; оценки помечены как оценки. Разделы части 6 встраиваются по хронологии, итоговые разделы части 5 идут
// последними.
import part1 from './alexander-mcqueen/part1.js';
import part2 from './alexander-mcqueen/part2.js';
import part3 from './alexander-mcqueen/part3.js';
import part4 from './alexander-mcqueen/part4.js';
import part5 from './alexander-mcqueen/part5.js';
import part6 from './alexander-mcqueen/part6.js';

const [eshu, irereScanners, sarabandeSalem, stPauls, deliveranceGame, naturalSelection, mother] = part6;
const [gucci, voss, carousel, skull, widows, sarabandeFund, dameBleue, horn, plato, death, angels] = part3;

export default {
  slug: 'alexander-mcqueen',
  timeline: [
    [1969, 'Луишем', 'Lewisham', '17 марта родился Ли Александр Маккуин, младший из шести детей.', 'Lee Alexander McQueen is born on 17 March, the youngest of six.'],
    [1984, 'Сэвил-роу', 'Savile Row', 'Ученичество в Anderson & Sheppard (до 1988), затем Gieves & Hawkes.', 'Apprenticed at Anderson & Sheppard (to 1988), then Gieves & Hawkes.'],
    [1990, 'Милан', 'Milan', 'С марта по июль — в ателье Ромео Джильи.', 'March to July at Romeo Gigli’s atelier.'],
    [1992, '«Джек-потрошитель»', '“Jack the Ripper”', '16 марта — выпускной показ; Изабелла Блоу покупает коллекцию.', 'Graduate show on 16 March; Isabella Blow buys the collection.'],
    [1993, 'Бамстеры', 'Bumsters', '«Таксист» в «Рице»; в 1994 году — «Нигилизм».', '“Taxi Driver” at the Ritz; “Nihilism” in 1994.'],
    [1995, '«Изнасилование Хайленда»', '“Highland Rape”', 'Тартан и прорыв — и скандал.', 'Tartan, a breakthrough and a scandal.'],
    [1996, 'Givenchy и награды', 'Givenchy and awards', 'Главный дизайнер Givenchy (до 2001); первый «Британский дизайнер года».', 'Chief designer at Givenchy (to 2001); first British Designer of the Year.'],
    [1998, '«№ 13»', '“No. 13”', 'Роботы, Шалом Харлоу и Эйми Маллинс (показ весна-лето 1999).', 'Robots, Shalom Harlow and Aimee Mullins (Spring-Summer 1999).'],
    [2000, '«Восс» и Gucci', '“Voss” and Gucci', 'Стеклянный куб с мотыльками; Gucci Group покупает 51 процент.', 'The moth-filled glass cube; Gucci Group buys 51%.'],
    [2003, 'Череп и орден', 'Skull and honour', 'Шарф с черепами; орден Британской империи; награда CFDA.', 'The skull scarf; a CBE; the CFDA award.'],
    [2006, 'Кейт Мосс и McQ', 'Kate Moss and McQ', '«Вдовы Каллодена» и «призрак Пеппера»; линия McQ; фонд Sarabande.', '“The Widows of Culloden” and Pepper’s ghost; McQ; the Sarabande Foundation.'],
    [2007, '«Синяя дама»', '“La Dame Bleue”', 'Смерть Изабеллы Блоу; коллекция её памяти с Филипом Трейси.', 'Isabella Blow dies; a memorial collection with Philip Treacy.'],
    [2009, '«Атлантида Платона»', '“Plato’s Atlantis”', 'Первая онлайн-трансляция показа; туфли-«броненосцы».', 'The first livestreamed show; Armadillo shoes.'],
    [2010, 'Смерть Маккуина', 'McQueen’s death', '11 февраля; «Ангелы и демоны»; Сара Бёртон во главе дома.', '11 February; “Angels and Demons”; Sarah Burton takes over.'],
    [2011, 'Свадьба и музей', 'A wedding and a museum', 'Платье Кэтрин Миддлтон; «Дикая красота» в Метрополитен-музее.', 'Catherine Middleton’s dress; “Savage Beauty” at the Met.'],
    [2015, 'V&A', 'V&A', '«Дикая красота» в Лондоне — 493 043 посетителя.', '“Savage Beauty” in London — 493,043 visitors.'],
    [2023, 'Прощание Бёртон', 'Burton’s farewell', '«Анатомия II»; креативным директором становится Шон Макгирр.', '“Anatomy II”; Seán McGirr becomes creative director.'],
    [2024, 'McQueen', 'McQueen', 'Дебют Макгирра; марка убирает «Александра» из названия.', 'McGirr’s debut; the label drops “Alexander”.'],
    [2026, 'Лондон и перемены', 'London and change', 'Новый генеральный директор, показ в Линкольнс-Инн, уход Макгирра.', 'A new CEO, the Lincoln’s Inn show, McGirr’s exit.'],
  ],
  sections: [
    ...part1, ...part2, eshu, gucci, voss, carousel, irereScanners, deliveranceGame, skull, widows,
    sarabandeFund, sarabandeSalem, dameBleue, naturalSelection, horn, plato, mother, death, angels, stPauls,
    ...part4, ...part5,
  ],
};
