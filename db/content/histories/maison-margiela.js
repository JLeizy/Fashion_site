// История Maison Margiela (этап 26): разделы собираются из частей maison-margiela/part1–6.js; хронология своя
// (заменяет стартовую из seed-data/brands.js). Все факты сверены через поиск; где источники расходятся — это сказано
// в тексте; оценки помечены как оценки. Разделы части 6 встраиваются перед итоговыми разделами части 5.
import part1 from './maison-margiela/part1.js';
import part2 from './maison-margiela/part2.js';
import part3 from './maison-margiela/part3.js';
import part4 from './maison-margiela/part4.js';
import part5 from './maison-margiela/part5.js';
import part6 from './maison-margiela/part6.js';

export default {
  slug: 'maison-margiela',
  timeline: [
    [1957, 'Генк', 'Genk', '9 апреля родился Мартин Маржела; в детстве шьёт с бабушкой-портнихой одежду для кукол.', 'Martin Margiela is born on 9 April; as a child he sews doll clothes with his dressmaker grandmother.'],
    [1979, 'Антверпен', 'Antwerp', 'Окончание Королевской академии изящных искусств; «почётный седьмой» «Антверпенской шестёрки».', 'Graduates from the Royal Academy of Fine Arts; the “honorary seventh” of the Antwerp Six.'],
    [1984, 'У Готье', 'With Gaultier', 'Ассистент Жана-Поля Готье до 1987 года.', 'Assistant to Jean Paul Gaultier until 1987.'],
    [1988, 'Основание и Tabi', 'Founding and the Tabi', 'Дом основан с Дженни Мейренс; 23 октября — показ в Café de la Gare, красные следы Tabi на холсте.', 'Founded with Jenny Meirens; on 23 October the Café de la Gare show leaves red Tabi footprints on canvas.'],
    [1989, 'Детская площадка', 'The playground', '19 октября — показ на площадке в XX округе; приглашения рисуют дети.', 'On 19 October a show in a 20th-arrondissement playground; local children draw the invitations.'],
    [1991, 'Белая краска', 'White paint', 'Одежда и обувь, покрытые трескающейся белой краской.', 'Clothes and shoes covered in cracking white paint.'],
    [1993, 'Кладбище', 'The cemetery', 'Коллекция показана на двух концах кладбища — целиком её не увидеть.', 'The collection is shown at two ends of a cemetery, never visible whole.'],
    [1994, 'Куклы и Replica', 'Dolls and Replica', 'Кукольный гардероб в человеческий рост; линия копий винтажных вещей.', 'A doll’s wardrobe at human scale; a line of vintage reproductions.'],
    [1997, 'Stockman, Роттердам, Hermès', 'Stockman, Rotterdam, Hermès', 'Манекен как жакет; выставка с плесенью; цифры 0–23 на бирке; MM6; Маржела возглавляет женскую линию Hermès (до 2003).', 'The dummy as jacket; the mould show; the 0–23 numbers; MM6; Margiela leads Hermès womenswear (until 2003).'],
    [2000, 'Токио и размер 74', 'Tokyo and size 74', 'Первый магазин — в Токио; одежда увеличена до итальянского размера 74.', 'The first store opens in Tokyo; clothes enlarged to Italian size 74.'],
    [2002, 'OTB', 'OTB', 'Ренцо Россо покупает контрольный пакет; продажи — 15 млн евро.', 'Renzo Rosso buys a majority stake; sales are €15 million.'],
    [2006, 'Высокая мода', 'Haute couture', 'Artisanal впервые в официальном парижском расписании.', 'Artisanal joins the official Paris couture schedule.'],
    [2008, 'Двадцать лет', 'Twenty years', 'Выставка в MoMu; весна-лето 2009 — последняя коллекция Маржела.', 'A MoMu exhibition; Spring-Summer 2009 is Margiela’s last collection.'],
    [2009, 'Уход основателя', 'The founder leaves', 'В декабре объявлено, что Маржела ушёл; коллекции создаёт анонимная студия.', 'In December Margiela’s exit is announced; an anonymous studio designs.'],
    [2012, 'H&M', 'H&M', '15 ноября — переиздания архива с биркой сезона.', 'On 15 November, archive reissues tagged with their season.'],
    [2014, 'Джон Гальяно', 'John Galliano', 'Назначение 6 октября; в 2015 году — первый Artisanal в Лондоне и имя Maison Margiela.', 'Named on 6 October; in 2015 his first Artisanal in London and the name Maison Margiela.'],
    [2016, '5AC', '5AC', 'Первая сумка Гальяно для дома.', 'Galliano’s first bag for the house.'],
    [2020, 'Recicla и Reebok', 'Recicla and Reebok', 'Переделанный винтаж; Instapump Fury с носком Tabi.', 'Reworked vintage; the Instapump Fury with a Tabi toe.'],
    [2023, '«Похититель Tabi»', 'The “Tabi Swiper”', 'Вирусная история в TikTok; поиск Tabi на Depop растёт на 110 %.', 'A viral TikTok saga; Depop Tabi searches rise 110%.'],
    [2024, 'Мост Александра III', 'Pont Alexandre III', 'Artisanal под мостом с «фарфоровой кожей» Пэт Макграт; 11 декабря Гальяно уходит.', 'Artisanal beneath the bridge with Pat McGrath’s porcelain skin; Galliano leaves on 11 December.'],
    [2025, 'Гленн Мартенс', 'Glenn Martens', '29 января — назначение; 9 июля — первый Artisanal; показ с детским оркестром.', 'Named on 29 January; first Artisanal on 9 July; a show opened by a children’s orchestra.'],
    [2026, 'Шанхай и Кудан', 'Shanghai and Kudan', 'Показ на шанхайской верфи; выставка Маржела-художника в Токио; продажи 2025 года +8,4 %.', 'A show in a Shanghai shipyard; Margiela’s art show in Tokyo; 2025 sales up 8.4%.'],
  ],
  sections: [...part1, ...part2, ...part3, ...part4, ...part5.slice(0, 6), ...part6, ...part5.slice(6)],
};
