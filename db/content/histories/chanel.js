// История Chanel (этап 25): разделы собираются из частей chanel/part1–5.js; хронология своя
// (заменяет стартовую из seed-data/brands.js). Все факты сверены через поиск; где источники расходятся — это сказано
// в тексте; оценки помечены как оценки.
import part1 from './chanel/part1.js';
import part2 from './chanel/part2.js';
import part3 from './chanel/part3.js';
import part4 from './chanel/part4.js';
import part5 from './chanel/part5.js';

export default {
  slug: 'chanel',
  timeline: [
    [1883, 'Сомюр', 'Saumur', '19 августа родилась Габриэль Шанель; детство прошло в приюте при монастыре в Обазине.', 'Gabrielle Chanel is born on 19 August; she grows up in the convent orphanage at Aubazine.'],
    [1910, 'Chanel Modes', 'Chanel Modes', 'Шляпный магазин на улице Камбон, 21; по данным источников, его финансирует Бой Кейпел.', 'A hat shop at 21 rue Cambon, financed per sources by Boy Capel.'],
    [1912, 'Довиль', 'Deauville', 'Первый бутик на курорте (по данным Chanel; другие источники называют 1913 год).', 'The first resort boutique (per Chanel; others say 1913).'],
    [1915, 'Биарриц', 'Biarritz', 'Первый дом высокой моды.', 'The first couture house.'],
    [1916, 'Джерси', 'Jersey', 'Ткань для мужского белья становится материалом элегантной одежды.', 'A men’s underwear fabric becomes elegant clothing.'],
    [1918, 'Рю Камбон, 31', '31 rue Cambon', 'Шанель покупает здание — главный адрес дома до сих пор.', 'Chanel buys the building — the house’s address to this day.'],
    [1921, 'N°5', 'N°5', '5 мая представлен аромат Эрнеста Бо — пятый образец.', 'On 5 May Ernest Beaux’s fifth sample is launched.'],
    [1924, 'Les Parfums Chanel', 'Les Parfums Chanel', 'Вертхаймеры — 70 %, Бадер — 20 %, Шанель — 10 %; «Голубой экспресс» с костюмами Шанель.', 'Wertheimers 70%, Bader 20%, Chanel 10%; “Le Train Bleu” in her costumes.'],
    [1926, '«Форд» от Шанель', 'Chanel’s “Ford”', 'Vogue называет маленькое чёрное платье «платьем, которое будет носить весь мир».', 'Vogue calls the little black dress “the frock that all the world will wear”.'],
    [1932, 'Bijoux de Diamants', 'Bijoux de Diamants', 'Выставка украшений из бриллиантов; колье «Комета».', 'A diamond jewellery show; the Comète necklace.'],
    [1939, 'Закрытие', 'Closure', 'С началом войны Шанель закрывает дом моды.', 'As war begins, Chanel closes the couture house.'],
    [1941, 'Попытка отнять духи', 'The perfume grab', 'Шанель пытается через немецкие власти получить контроль над Parfums Chanel.', 'Chanel petitions the German authorities for control of Parfums Chanel.'],
    [1947, 'Соглашение', 'Settlement', '17 мая: два процента от мировых продаж N°5.', '17 May: 2% of N°5’s worldwide sales.'],
    [1954, 'Возвращение', 'The comeback', '5 февраля 71-летняя Шанель снова показывает коллекцию.', 'On 5 February Chanel, 71, shows a collection again.'],
    [1955, 'Сумка 2.55', 'The 2.55 bag', 'Стёганая сумка на цепочке освобождает руки.', 'The quilted chain bag frees the hands.'],
    [1957, 'Двухцветные туфли', 'Two-tone shoes', 'Раймон Массаро создаёт бежевые туфли с чёрным мыском.', 'Raymond Massaro designs the beige shoe with a black toe.'],
    [1971, 'Смерть Шанель', 'Chanel dies', '10 января в отеле «Ритц»; похоронена в Лозанне.', 'On 10 January at the Ritz; buried in Lausanne.'],
    [1974, 'Ален Вертхаймер', 'Alain Wertheimer', 'Контроль над компанией получает 25-летний внук Пьера Вертхаймера.', 'Pierre Wertheimer’s 25-year-old grandson takes control.'],
    [1983, 'Карл Лагерфельд', 'Karl Lagerfeld', 'Начинается эпоха, продлившаяся тридцать шесть лет.', 'An era of thirty-six years begins.'],
    [1997, 'Paraffection', 'Paraffection', 'Дочерняя компания для сохранения ремесленных мастерских.', 'A subsidiary to preserve craft workshops.'],
    [2004, '«N°5. Фильм»', 'N°5 the Film', 'Баз Лурман и Николь Кидман; по данным Гиннесса, 33 миллиона долларов.', 'Baz Luhrmann and Nicole Kidman; $33 million, per Guinness.'],
    [2019, 'Вирджини Виар', 'Virginie Viard', 'Лагерфельд умирает 19 февраля; студию возглавляет его многолетняя соратница.', 'Lagerfeld dies on 19 February; his long-time collaborator leads the studio.'],
    [2022, 'le19M и Лина Наир', 'le19M and Leena Nair', 'Здание для одиннадцати домов ремёсел; новый глобальный генеральный директор.', 'A home for eleven craft houses; a new global CEO.'],
    [2024, 'Матьё Блази', 'Matthieu Blazy', 'Уход Виар в июне; 12 декабря назначен Блази.', 'Viard leaves in June; Blazy is named on 12 December.'],
    [2025, 'Планеты в Гран-Пале', 'Planets at the Grand Palais', '6 октября — дебют Блази; 2 декабря — Métiers d’Art в нью-йоркском метро.', 'Blazy debuts on 6 October; Métiers d’Art in the New York subway on 2 December.'],
    [2026, 'Биарриц и рост', 'Biarritz and growth', 'Круиз в Биаррице; выручка 2025 года — 19,3 миллиарда долларов (+2 %).', 'Cruise in Biarritz; 2025 revenue $19.3 billion (+2%).'],
  ],
  sections: [...part1, ...part2, ...part3, ...part4, ...part5],
};
