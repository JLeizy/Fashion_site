// История Givenchy (этап 27): разделы собираются из частей givenchy/part1–7.js; хронология своя (заменяет стартовую
// из seed-data/brands.js). Все факты сверены через поиск; где источники расходятся — это сказано в тексте; оценки
// помечены как оценки. Разделы части 7 встраиваются по хронологии, итоговые разделы части 6 идут последними.
import part1 from './givenchy/part1.js';
import part2 from './givenchy/part2.js';
import part3 from './givenchy/part3.js';
import part4 from './givenchy/part4.js';
import part5 from './givenchy/part5.js';
import part6 from './givenchy/part6.js';
import part7 from './givenchy/part7.js';

const [venet, homes, prisme, grace, farewell] = part7;

export default {
  slug: 'givenchy',
  timeline: [
    [1927, 'Бове', 'Beauvais', '21 февраля (по Britannica — 20-го) родился Юбер де Живанши; его воспитывает дед, знаток гобеленов.', 'Hubert de Givenchy is born on 21 February (20th per Britannica); raised by his grandfather, a tapestry expert.'],
    [1937, 'Всемирная выставка', 'The World’s Fair', 'Парижская выставка подталкивает мальчика к моде.', 'The Paris fair turns the boy towards fashion.'],
    [1945, 'У Жака Фата', 'With Jacques Fath', 'Первые эскизы в доме Фата; учёба в Школе изящных искусств.', 'First sketches at Fath; studies at the École des Beaux-Arts.'],
    [1947, 'Скиапарелли', 'Schiaparelli', 'Работа у Эльзы Скиапарелли до 1951 года.', 'Works for Elsa Schiaparelli until 1951.'],
    [1952, 'Дом и «Беттина»', 'The house and the Bettina', '2 февраля — открытие на улице Альфреда де Виньи, 8; блуза «Беттина».', 'On 2 February the house opens at 8 rue Alfred de Vigny; the Bettina blouse.'],
    [1953, 'Одри и Баленсиага', 'Audrey and Balenciaga', 'Встреча с Хепбёрн («Сабрина») и с Баленсиагой в Нью-Йорке.', 'Meets Hepburn (Sabrina) and Balenciaga in New York.'],
    [1957, 'L’Interdit и «Забавная мордашка»', 'L’Interdit and Funny Face', 'Первый аромат; первое упоминание в титрах; Dior повторяет платье-мешок.', 'The first perfume; a first screen credit; Dior copies the sack dress.'],
    [1959, 'Авеню Георга V', 'Avenue George V', 'Переезд напротив Баленсиаги (по одному источнику — 1955).', 'Moves opposite Balenciaga (1955 per one source).'],
    [1961, 'Тиффани и Версаль', 'Tiffany’s and Versailles', 'Маленькое чёрное платье Холли Голайтли; Жаклин Кеннеди в Givenchy в Версале.', 'Holly Golightly’s little black dress; Jackie Kennedy in Givenchy at Versailles.'],
    [1968, 'Наследство Баленсиаги', 'Balenciaga’s legacy', 'Баленсиага закрывает дом; часть клиенток переходит к Живанши.', 'Balenciaga closes; some clients move to Givenchy.'],
    [1988, 'LVMH', 'LVMH', 'Продажа дома LVMH (по некоторым данным — 1989).', 'The house is sold to LVMH (1989 per some).'],
    [1993, 'Прощание с Одри', 'Farewell to Audrey', 'Живанши несёт гроб Хепбёрн; коллекция её памяти для Barneys.', 'Givenchy is Hepburn’s pallbearer; a memorial collection for Barneys.'],
    [1995, 'Уход основателя и Гальяно', 'The founder leaves; Galliano', 'Последний показ в июле; Джон Гальяно назначен преемником.', 'Last show in July; John Galliano named successor.'],
    [1997, 'Маккуин', 'McQueen', '19 января — «В поисках золотого руна»; основатель возглавляет совет Christie’s France.', 'On 19 January, “The Search for the Golden Fleece”; the founder chairs Christie’s France’s board.'],
    [2001, 'Жюльен Макдональд', 'Julien Macdonald', 'После ухода Маккуина — три года Макдональда.', 'After McQueen, three years of Macdonald.'],
    [2005, 'Риккардо Тиши', 'Riccardo Tisci', 'Назначение 28 февраля; двенадцать лет готики и стритвира.', 'Named on 28 February; twelve years of gothic and streetwear.'],
    [2006, 'Christie’s', 'Christie’s', 'Платье из «Завтрака у Тиффани» продано за 467 200 фунтов.', 'The Breakfast at Tiffany’s dress sells for £467,200.'],
    [2015, 'Нью-Йорк, 11 сентября', 'New York, 11 September', 'Открытый для публики показ с Мариной Абрамович.', 'A public show co-directed with Marina Abramović.'],
    [2017, 'Клэр Уэйт Келлер', 'Clare Waight Keller', 'Первая женщина — артистический директор дома.', 'The first woman artistic director.'],
    [2018, 'Свадьба и смерть', 'A wedding and a death', 'Платье Меган Маркл; 10 марта умирает Юбер де Живанши.', 'Meghan Markle’s dress; Hubert de Givenchy dies on 10 March.'],
    [2020, 'Мэтью Уильямс', 'Matthew Williams', 'Замок и сумка 4G; уход 1 января 2024 года.', 'The 4G lock and bag; leaves on 1 January 2024.'],
    [2022, 'Коллекционер', 'The collector', 'Christie’s продаёт собрание за 118,1 млн евро.', 'Christie’s sells his collection for €118.1 million.'],
    [2025, 'Сара Бёртон', 'Sarah Burton', '7 марта — дебют на выкройках 1952 года.', 'On 7 March, a debut built on the 1952 patterns.'],
    [2026, 'Гетария и мужская линия', 'Getaria and menswear', '«Семья Живанчага»; 25 июня — мужской дебют Бёртон.', '“The Givenchiaga Family”; Burton’s menswear debut on 25 June.'],
  ],
  sections: [
    ...part1, ...part2, grace, venet, part3[0], prisme, farewell, ...part3.slice(1),
    ...part4.slice(0, -1), homes, part4[part4.length - 1], ...part5, ...part6,
  ],
};
