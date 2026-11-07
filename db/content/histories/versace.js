// История Versace (этап 28): разделы собираются из частей versace/part1–6.js; хронология своя (заменяет стартовую
// из seed-data/brands.js). Все факты сверены через поиск; где источники расходятся — это сказано в тексте; оценки
// помечены как оценки. Разделы части 6 встраиваются по смыслу, итоговые разделы части 5 идут последними.
import part1 from './versace/part1.js';
import part2 from './versace/part2.js';
import part3 from './versace/part3.js';
import part4 from './versace/part4.js';
import part5 from './versace/part5.js';
import part6 from './versace/part6.js';

const [elton, allegra, hotels, books, naomi] = part6;

export default {
  slug: 'versace',
  timeline: [
    [1946, 'Реджо-Калабрия', 'Reggio Calabria', '2 декабря родился Джанни Версаче; детство в мастерской матери-портнихи.', 'Gianni Versace is born on 2 December; a childhood in his dressmaker mother’s workroom.'],
    [1972, 'Милан', 'Milan', 'Работа на Genny, Callaghan и Complice.', 'Designs for Genny, Callaghan and Complice.'],
    [1978, 'Первый показ', 'The first show', '28 марта — коллекция в Палаццо делла Перманенте; бутик на Виа делла Спига.', 'On 28 March, a collection at the Palazzo della Permanente; a boutique on Via della Spiga.'],
    [1979, 'Аведон', 'Avedon', 'Начало двадцатилетнего сотрудничества с Ричардом Аведоном.', 'A twenty-year partnership with Richard Avedon begins.'],
    [1982, 'Oroton и Ла Скала', 'Oroton and La Scala', 'Металлическая сетка; 19 марта — костюмы к «Легенде об Иосифе».', 'Metal mesh; on 19 March, costumes for Josephslegende.'],
    [1989, 'Atelier и Versus', 'Atelier and Versus', 'Высокая мода в Париже; линия Versus — подарок Донателле.', 'Couture in Paris; the Versus line, a gift to Donatella.'],
    [1991, 'Уорхол и супермодели', 'Warhol and supermodels', 'Принт «Мэрилин»; финал под «Freedom! ’90».', 'The Marilyn print; a finale to “Freedom! ’90”.'],
    [1992, '«Мисс S&M» и Майами', '“Miss S&M” and Miami', 'Бондаж на подиуме; покупка Каса Казуарины; Versace Home.', 'Bondage on the runway; Casa Casuarina bought; Versace Home.'],
    [1994, '«То самое платье»', '“That Dress”', 'Элизабет Херли в платье с золотыми булавками.', 'Elizabeth Hurley in the gold-pinned dress.'],
    [1995, 'Мадонна', 'Madonna', 'Кампании Стивена Мейзела и Марио Тестино.', 'Campaigns by Steven Meisel and Mario Testino.'],
    [1997, 'Гибель Джанни', 'Gianni’s death', '6 июля — последний показ в «Рице»; 15 июля — убийство в Майами-Бич; дом возглавляет Донателла.', 'Last Ritz show on 6 July; murdered in Miami Beach on 15 July; Donatella takes over.'],
    [2000, 'Платье джунглей', 'The jungle dress', 'Дженнифер Лопес на «Грэмми» — путь к Google Images.', 'Jennifer Lopez at the Grammys — the road to Google Images.'],
    [2004, 'Кризис', 'Crisis', 'Убыток 95 млн евро; Джанкарло Ди Ризио; Аллегре — 18 лет и 50 процентов.', 'A €95 million loss; Giancarlo Di Risio; Allegra turns 18 with 50%.'],
    [2011, 'H&M', 'H&M', 'Коллекция раскуплена меньше чем за полчаса.', 'The collection sells out in under half an hour.'],
    [2014, 'Blackstone и Леди Гага', 'Blackstone and Lady Gaga', '20 процентов за 210 млн евро; Гага — лицо кампании.', '20% for €210 million; Gaga fronts the campaign.'],
    [2017, 'Трибьют', 'Tribute', 'Архивные принты и супермодели в память о Джанни.', 'Archive prints and supermodels in Gianni’s memory.'],
    [2018, 'Capri', 'Capri', 'Michael Kors Holdings покупает Versace и становится Capri Holdings.', 'Michael Kors Holdings buys Versace and becomes Capri Holdings.'],
    [2021, '«Фендаче»', '“Fendace”', 'Обмен коллекциями с Fendi.', 'A collection swap with Fendi.'],
    [2024, 'Нет — Tapestry', 'No to Tapestry', 'Суд блокирует слияние Tapestry и Capri.', 'A court blocks the Tapestry–Capri merger.'],
    [2025, 'Prada и Витале', 'Prada and Vitale', 'Донателла уходит; сезон Дарио Витале; 2 декабря — сделка с Prada.', 'Donatella steps back; Dario Vitale’s season; Prada deal closes on 2 December.'],
    [2026, 'Питер Мюлье', 'Pieter Mulier', 'Новый креативный директор с 1 июля; возрождение Atelier Versace; выставка в Музее Майоля.', 'New chief creative officer from 1 July; Atelier Versace revived; the Musée Maillol show.'],
  ],
  sections: [
    ...part1, ...part2, elton, ...part3, allegra, hotels,
    ...part4, ...part5.slice(0, 3), naomi, books, ...part5.slice(3),
  ],
};
