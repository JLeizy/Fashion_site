// История Prada (этап 19): разделы собираются из частей prada/part1–9.js в хронологическом и тематическом порядке;
// хронология — своя (заменяет стартовую из brands.js). Все факты сверены с источниками через поиск;
// где источники расходятся — это сказано в тексте; оценки помечены как оценки.
import part1 from './prada/part1.js';
import part2 from './prada/part2.js';
import part3 from './prada/part3.js';
import part4 from './prada/part4.js';
import part5 from './prada/part5.js';
import part6 from './prada/part6.js';
import part7 from './prada/part7.js';
import part8 from './prada/part8.js';
import part9 from './prada/part9.js';

const [galleria, royal, luisa, miuccia, bertelli] = part1;
const [nylon, firstCollection, year1993, lineaRossa] = part2;
const [epicenterNy, epicenterTokyo, marfa, devil, listing] = part3;
const [pradamalia, renylon, simons, management, today] = part4;
const [iconic, owners, influence, disputes, facts] = part5;
const [uglyChic, galleriaBag, lunaRossa, disposals, licences, transformer, cinema, barLuce] = part6;
const [lineaRossa2018, reEdition, timecapsule, conversations, frames, barcelona] = part8;
const [churchs, miuMiuParis, therapy] = part9;
const [venice, impossible, murals, marchesi, rongZhai, factories, greenLoan, pradaMode, adidas, spacesuit] = part7;

export default {
  slug: 'prada',
  timeline: [
    [1913, 'Галерея', 'The Galleria', 'Первый магазин Prada открывается в миланской Галерее Виктора Эммануила II.', 'Prada’s first store opens in Milan’s Galleria Vittorio Emanuele II.'],
    [1919, 'Королевский двор', 'Royal Household', 'Prada становится поставщиком итальянского королевского дома и получает право на герб Савойской династии в логотипе.', 'Prada becomes supplier to the Italian Royal Household and may use the Savoy crest in its logo.'],
    [1977, 'IPI и Бертелли', 'IPI and Bertelli', 'Компания Патрицио Бертелли IPI получает лицензию на кожаные изделия Prada.', 'Patrizio Bertelli’s IPI obtains the Prada leather-goods licence.'],
    [1978, 'Миучча Прада', 'Miuccia Prada', 'Миучча Прада сменяет мать во главе семейного дела.', 'Miuccia Prada succeeds her mother at the head of the family business.'],
    [1984, 'Нейлоновый рюкзак', 'The nylon backpack', 'Рюкзак из технического нейлона становится иконой (по ряду источников — 1985).', 'The technical-nylon backpack becomes an icon (some sources say 1985).'],
    [1988, 'Первая коллекция одежды', 'First clothing collection', 'В Милане представлена первая коллекция одежды Prada.', 'Prada presents its first clothing collection in Milan.'],
    [1993, 'Мужская линия, Miu Miu, Фонд', 'Menswear, Miu Miu, Foundation', 'Дебют мужской одежды, создание Miu Miu и Milano Prada Arte (позже Fondazione Prada).', 'Menswear debut, Miu Miu and Milano Prada Arte (later Fondazione Prada).'],
    [1996, '«Банальная эксцентричность»', '“Banal Eccentricity”', 'Показ весны-лета 1996 года, прозванный «уродливым шиком».', 'The Spring/Summer 1996 show nicknamed “ugly chic”.'],
    [1997, 'Linea Rossa', 'Linea Rossa', 'Запуск спортивной линии с красной полосой.', 'Launch of the red-stripe leisure line.'],
    [2000, 'Luna Rossa', 'Luna Rossa', '6 февраля Luna Rossa выигрывает Кубок Louis Vuitton с первой попытки.', 'On 6 February Luna Rossa wins the Louis Vuitton Cup on its first attempt.'],
    [2001, 'Эпицентр в Нью-Йорке', 'New York Epicenter', '15 декабря открывается магазин по проекту OMA на Бродвее, 575.', 'On 15 December the OMA-designed store opens at 575 Broadway.'],
    [2003, 'Эпицентр в Токио', 'Tokyo Epicenter', 'Завершено здание Herzog & de Meuron в районе Аояма.', 'Herzog & de Meuron’s Aoyama building is completed.'],
    [2003, 'Очки', 'Eyewear', '23 июля Prada и Luxottica объявляют о десятилетней лицензии на очки.', 'On 23 July Prada and Luxottica announce a ten-year eyewear licence.'],
    [2005, 'Prada Marfa', 'Prada Marfa', '1 октября в Техасе открыта инсталляция Эльмгрина и Драгсета.', 'On 1 October Elmgreen & Dragset’s installation opens in Texas.'],
    [2006, 'Miu Miu в Париже', 'Miu Miu in Paris', 'Miu Miu впервые показывает женскую коллекцию на Неделе моды в Париже.', 'Miu Miu first shows womenswear at Paris Fashion Week.'],
    [2007, 'Galleria', 'Galleria', 'Появляется сумка Galleria из кожи Saffiano.', 'The Saffiano Galleria bag is introduced.'],
    [2009, 'Prada Transformer', 'Prada Transformer', '25 апреля в Сеуле открывается вращающийся павильон OMA.', 'On 25 April OMA’s rotating pavilion opens in Seoul.'],
    [2011, 'Гонконг', 'Hong Kong', '24 июня акции Prada SpA размещены на Гонконгской бирже под тикером 1913.', 'On 24 June Prada SpA lists in Hong Kong under ticker 1913.'],
    [2012, 'Метрополитен-музей', 'The Met', '10 мая открывается выставка «Schiaparelli and Prada: Impossible Conversations».', 'On 10 May “Schiaparelli and Prada: Impossible Conversations” opens.'],
    [2014, 'Pasticceria Marchesi', 'Pasticceria Marchesi', '14 марта Prada договаривается о покупке 80 % кондитерской 1824 года.', 'On 14 March Prada agrees to buy 80% of the 1824 pastry shop.'],
    [2015, 'Fondazione Prada', 'Fondazione Prada', '9 мая в Милане открыт комплекс Фонда по проекту OMA.', 'On 9 May the OMA-designed Foundation complex opens in Milan.'],
    [2017, 'Rong Zhai', 'Rong Zhai', 'В октябре в Шанхае открыт отреставрированный особняк 1918 года.', 'In October the restored 1918 Shanghai mansion opens.'],
    [2018, 'Linea Rossa снова', 'Linea Rossa returns', 'Спортивная линия возвращается на показах осень-зима 2018.', 'The sport line returns at the Fall/Winter 2018 shows.'],
    [2019, 'Без меха и Re-Nylon', 'Fur-free and Re-Nylon', 'Отказ от меха во всех марках группы и запуск Re-Nylon.', 'Fur-free policy across the group and the launch of Re-Nylon.'],
    [2020, 'Раф Симонс', 'Raf Simons', 'Раф Симонс становится сокреативным директором вместе с Миуччей Прадой.', 'Raf Simons becomes co-creative director with Miuccia Prada.'],
    [2023, 'Андреа Герра', 'Andrea Guerra', 'Андреа Герра назначен генеральным директором группы.', 'Andrea Guerra is appointed group CEO.'],
    [2024, 'Скафандр AxEMU', 'AxEMU spacesuit', '16 октября Axiom Space и Prada представляют скафандр для миссии «Артемида III».', 'On 16 October Axiom Space and Prada unveil the Artemis III spacesuit.'],
    [2025, 'Versace', 'Versace', '2 декабря группа закрывает сделку по покупке Versace.', 'On 2 December the group closes the Versace acquisition.'],
    [2026, '«Дьявол носит Prada 2»', '“The Devil Wears Prada 2”', '1 мая выходит продолжение фильма 2006 года.', 'On 1 May the sequel to the 2006 film is released.'],
  ],
  sections: [
    // 1–3. Предыстория и основание, становление
    galleria, royal, luisa, miuccia, bertelli, nylon, firstCollection, year1993, uglyChic, lineaRossa, lunaRossa,
    disposals, churchs, licences, miuMiuParis,
    // 4–7. Креативное руководство, знаковые проекты, магазины и культура
    epicenterNy, epicenterTokyo, marfa, devil, galleriaBag, transformer, listing, venice, impossible, therapy, cinema,
    murals, marchesi, barLuce, rongZhai, factories, pradaMode, lineaRossa2018, renylon, greenLoan, timecapsule,
    adidas, reEdition, simons, conversations, frames, management, spacesuit, barcelona,
    // 8. Скандалы
    pradamalia,
    // 5–6. Культовые вещи; 9. Владельцы; 10. Влияние; 11. Сегодня; 12. Факты
    iconic, owners, influence, today, disputes, facts,
  ],
};
