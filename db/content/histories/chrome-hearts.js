// История Chrome Hearts (этап 23): разделы собираются из частей chrome-hearts/part1–6.js; хронология своя
// (заменяет стартовую из seed-data/brands.js). Все факты сверены через поиск; где источники расходятся — это сказано
// в тексте; оценки помечены как оценки.
import part1 from './chrome-hearts/part1.js';
import part2 from './chrome-hearts/part2.js';
import part3 from './chrome-hearts/part3.js';
import part4 from './chrome-hearts/part4.js';
import part5 from './chrome-hearts/part5.js';
import part6 from './chrome-hearts/part6.js';

export default {
  slug: 'chrome-hearts',
  timeline: [
    [1988, 'Гараж в Лос-Анджелесе', 'A Los Angeles garage', 'Ричард Старк, Джон Боуман и ювелир Леонард Камхаут основывают Chrome Hearts.', 'Richard Stark, John Bowman and jeweller Leonard Kamhout found Chrome Hearts.'],
    [1989, '«Chopper Chicks in Zombietown»', '“Chopper Chicks in Zombietown”', 'Костюмы для фильма — первый заказ; по распространённой версии, его рабочее название дало имя марке.', 'Costumes for the film — the first job; by the common account its working title named the brand.'],
    [1992, 'CFDA', 'CFDA', 'Награда лучшему дизайнеру аксессуаров года; вручает Шер.', 'Accessory Designer of the Year; presented by Cher.'],
    [1994, 'Семейная компания', 'A family company', 'Боуман и Камхаут уходят; с этого года марка принадлежит Ричарду и Лори Линн Старк.', 'Bowman and Kamhout leave; Richard and Laurie Lynn Stark co-own the brand from now on.'],
    [1996, 'Нью-Йорк', 'New York', 'Первый магазин в Манхэттене.', 'The first Manhattan store.'],
    [1999, 'Токио', 'Tokyo', 'В декабре открывается магазин в Минами-Аояме.', 'In December the Minami-Aoyama store opens.'],
    [2002, 'The Rolling Stones', 'The Rolling Stones', 'Коллаборация с логотипом губ и языка.', 'A collaboration on the lips-and-tongue logo.'],
    [2006, 'Париж и Baccarat', 'Paris and Baccarat', 'Магазин на авеню Монтень, 18, и коллекция с хрусталём Baccarat.', 'The 18 avenue Montaigne store and a Baccarat crystal collection.'],
    [2007, 'Comme des Garçons', 'Comme des Garçons', 'Серия подвесок и одежды.', 'A series of pendants and garments.'],
    [2003, 'Гонконг', 'Hong Kong', 'Бутик в Prince\u2019s Building в районе Сентрал.', 'A boutique in Prince\u2019s Building, Central.'],
    [2014, 'Майами, Китай, The Elder Statesman', 'Miami, China, The Elder Statesman', 'Миноритарная доля в The Elder Statesman; выход в Китай; пространство в Дизайн-дистрикте Майами.', 'A minority stake in The Elder Statesman; entry into China; a Miami Design District space.'],
    [2016, 'Белла Хадид', 'Bella Hadid', 'В декабре объявлена первая капсула с Беллой Хадид.', 'In December the first Bella Hadid capsule is announced.'],
    [2017, 'Вест-Виллидж', 'West Village', 'Второй магазин в Нью-Йорке — на Вашингтон-стрит, 755.', 'A second New York store at 755 Washington Street.'],
    [2019, '10 % за 150 млн', '10% for $150m', 'По данным WWD, 10 % компании проданы частной инвестиционной компании.', 'Per WWD, 10% is sold to a private-equity firm.'],
    [2019, 'Louis Vuitton у Chrome Hearts', 'Louis Vuitton at Chrome Hearts', 'Резиденция Louis Vuitton Вирджила Абло в нью-йоркском флагмане; скамья из эбенового дерева.', 'Virgil Abloh\u2019s Louis Vuitton residency at the New York flagship; the ebony bench.'],
    [2021, '«Certified Lover Boy»', '“Certified Lover Boy”', 'Первая официальная коллаборация с Дрейком.', 'The first official collaboration with Drake.'],
    [2022, 'CFDA за достижения всей жизни', 'CFDA lifetime award', '7 ноября Старки получают премию Джеффри Бина.', 'On 7 November the Starks receive the Geoffrey Beene award.'],
    [2025, 'NOCTA × Nike и иск к Нилу Янгу', 'NOCTA × Nike and the Neil Young suit', 'Сентябрь — иск к Нилу Янгу; декабрь — коллекция с NOCTA и Nike.', 'September — suit against Neil Young; December — the NOCTA and Nike collection.'],
    [2025, 'Отель Surfrider', 'The Surfrider hotel', 'В ноябре Chrome Hearts покупает 20-номерной отель в Малибу за 37,5 млн долларов.', 'In November Chrome Hearts buys a 20-room Malibu hotel for $37.5 million.'],
    [2026, 'Канны и Торонто', 'Cannes and Toronto', 'Май — отзыв иска к Янгу и бутик в Каннах; июль — покупка здания в Торонто.', 'May — Young suit dropped, Cannes boutique; July — a Toronto building bought.'],
  ],
  sections: [
    part1[0], part1[1], part1[2], part1[3], part4[0], part4[1], part1[4], part1[5], part1[6], part1[7], part1[8], part1[9],
    part2[0], part2[1], part6[0], part4[6], part2[2], part6[3], part2[3], part4[4], part2[4], part5[2], part2[5], part2[6], part4[3],
    part5[0], part4[2], part5[1], part2[7], part4[5], part2[8], part2[9], part4[7], part3[0], part4[8], part3[1],
    part3[2], part5[4], part3[3], part3[4], part6[2], part5[3], part6[1], part3[5], part3[6], part6[4], part5[5], part3[7], part3[8], part3[9],
  ],
};
