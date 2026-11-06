// История Louis Vuitton (этап 24): разделы собираются из частей louis-vuitton/part1–6.js; хронология своя
// (заменяет стартовую из seed-data/brands.js). Все факты сверены через поиск; где источники расходятся — это сказано
// в тексте; оценки помечены как оценки.
import part1 from './louis-vuitton/part1.js';
import part2 from './louis-vuitton/part2.js';
import part3 from './louis-vuitton/part3.js';
import part4 from './louis-vuitton/part4.js';
import part5 from './louis-vuitton/part5.js';
import part6 from './louis-vuitton/part6.js';

export default {
  slug: 'louis-vuitton',
  timeline: [
    [1821, 'Рождение в Анше', 'Born in Anchay', '4 августа в деревне Анше в Юре родился Луи Виттон.', 'Louis Vuitton is born on 4 August in Anchay, in the Jura.'],
    [1837, 'Париж', 'Paris', 'По одной из версий, юный Луи пешком приходит в Париж и поступает учеником к Ромену Марешалю.', 'By one account, young Louis reaches Paris on foot and is apprenticed to Romain Maréchal.'],
    [1853, 'Императрица Евгения', 'Empress Eugénie', 'Виттон становится личным упаковщиком императрицы.', 'Vuitton becomes the Empress’s personal packer.'],
    [1854, 'Улица Нёв-де-Капюсин, 4', '4 rue Neuve-des-Capucines', 'Собственная мастерская и магазин у Вандомской площади.', 'His own workshop and shop near Place Vendôme.'],
    [1858, 'Плоский сундук', 'The flat trunk', 'Сундук с плоской крышкой из серой канвы Trianon можно ставить штабелем.', 'A flat-topped trunk in grey Trianon canvas that can be stacked.'],
    [1859, 'Аньер', 'Asnières', 'Производство переезжает в Аньер-сюр-Сен, где работает до сих пор.', 'Production moves to Asnières-sur-Seine, where it still works.'],
    [1886, 'Замок Жоржа', 'Georges’s lock', 'По данным источников, Жорж Виттон патентует замок, который невозможно вскрыть отмычкой.', 'Per sources, Georges Vuitton patents a pick-proof lock.'],
    [1888, 'Damier', 'Damier', 'Клетчатая канва с надписью «marque L. Vuitton déposée».', 'The checked canvas marked “marque L. Vuitton déposée”.'],
    [1896, 'Monogram', 'Monogram', 'Через четыре года после смерти отца Жорж создаёт монограмму LV.', 'Four years after his father’s death, Georges creates the LV Monogram.'],
    [1900, 'Всемирная выставка', 'World’s Fair', 'Жорж курирует раздел «Путешествия и изделия из кожи».', 'Georges oversees the “Travel & Leather Goods” section.'],
    [1914, 'Елисейские Поля, 70', '70 Champs-Élysées', 'Открывается здание, которое называли крупнейшим магазином багажа своего времени.', 'A building billed as the largest luggage store of its time opens.'],
    [1930, 'Keepall и Speedy', 'Keepall and Speedy', 'Мягкие дорожные сумки; Speedy сначала называется Express.', 'Soft travel bags; the Speedy is first called the Express.'],
    [1965, 'Speedy 25', 'Speedy 25', 'По данным источников, уменьшенную Speedy просит Одри Хепбёрн.', 'Per sources, Audrey Hepburn asks for a smaller Speedy.'],
    [1977, 'Анри Ракамье', 'Henry Racamier', 'Начинается экспансия: за неполные десять лет выручка вырастет в 25 раз.', 'Expansion begins: revenue will grow 25-fold in under ten years.'],
    [1978, 'Токио', 'Tokyo', 'Первый магазин в Японии — в квартале Киойтё.', 'The first Japanese store, in Kioicho.'],
    [1983, 'Кубок Louis Vuitton', 'Louis Vuitton Cup', 'Первый розыгрыш; Australia II затем прерывает 132-летнюю серию в Кубке Америки.', 'The first edition; Australia II then ends a 132-year America’s Cup streak.'],
    [1987, 'LVMH', 'LVMH', 'Слияние с Moët Hennessy; в 1989 году контроль получает Бернар Арно.', 'Merger with Moët Hennessy; Bernard Arnault takes control in 1989.'],
    [1998, 'Первый показ', 'The first show', '9 марта Марк Джейкобс показывает первую коллекцию одежды дома.', 'On 9 March Marc Jacobs shows the house’s first ready-to-wear.'],
    [2001, 'Граффити Спрауса', 'Sprouse graffiti', 'Монограмма становится холстом для художников.', 'The Monogram becomes an artists’ canvas.'],
    [2003, 'Мураками', 'Murakami', 'Monogram Multicolore в 33 цветах; переиздание — в 2025 году.', 'Monogram Multicolore in 33 colours; re-edited in 2025.'],
    [2012, 'Яёи Кусама', 'Yayoi Kusama', 'Коллекция Infinitely Kusama; вторая, Creating Infinity, — в 2023 году.', 'Infinitely Kusama; a second collection, Creating Infinity, in 2023.'],
    [2014, 'Жескьер и фонд', 'Ghesquière and the Fondation', '5 марта — первый показ Жескьера в Лувре; 27 октября открывается Фонд Louis Vuitton.', 'On 5 March Ghesquière debuts at the Louvre; on 27 October the Fondation opens.'],
    [2017, 'Louis Vuitton × Supreme', 'Louis Vuitton × Supreme', 'Ким Джонс показывает коллаборацию с маркой, которой в 2000 году запретили монограмму.', 'Kim Jones shows a collaboration with the brand barred from the Monogram in 2000.'],
    [2018, 'Вирджил Абло', 'Virgil Abloh', 'Радужный подиум в Пале-Рояль; Абло ведёт мужскую линию до своей смерти в 2021 году.', 'A rainbow runway at the Palais-Royal; Abloh leads menswear until his death in 2021.'],
    [2021, 'Louis 200', 'Louis 200', '200 творцов переосмысляют сундук 1858 года к 200-летию основателя.', '200 creators reinterpret the 1858 trunk for the founder’s bicentenary.'],
    [2023, 'Фаррелл Уильямс', 'Pharrell Williams', 'Дебют на мосту Пон-Нёф; на Елисейских Полях появляется гигантский «сундук».', 'A debut on the Pont Neuf; a giant “trunk” appears on the Champs-Élysées.'],
    [2024, 'Олимпиада и Кубок Америки', 'Olympics and America’s Cup', 'Сундуки для олимпийского огня и медалей; титульный партнёр 37-го Кубка Америки.', 'Trunks for the Olympic torch and medals; title partner of the 37th America’s Cup.'],
    [2026, '130 лет монограммы', 'The Monogram turns 130', 'Год празднования с опорой на собственный архив; круиз 2027 — в Коллекции Фрика.', 'A year of celebration built on the archive; Cruise 2027 at The Frick Collection.'],
  ],
  sections: [...part1, ...part2, ...part3, ...part4, ...part5, ...part6],
};
