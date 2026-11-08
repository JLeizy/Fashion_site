// История Loro Piana (этап 30): разделы собираются из частей loro-piana/part1–N.js; хронология своя (заменяет стартовую
// из seed-data/brands.js). Все факты сверены через поиск (заметки — docs/research/loro-piana-notes.md); где источники
// расходятся — это сказано в тексте; оценки помечены как оценки.
import part1 from './loro-piana/part1.js';
import part2 from './loro-piana/part2.js';
import part3 from './loro-piana/part3.js';
import part4 from './loro-piana/part4.js';
import part5 from './loro-piana/part5.js';
import part6 from './loro-piana/part6.js';
import part7 from './loro-piana/part7.js';
import part8 from './loro-piana/part8.js';
import part9 from './loro-piana/part9.js';
import part10 from './loro-piana/part10.js';
import part11 from './loro-piana/part11.js';
import part12 from './loro-piana/part12.js';
import part13 from './loro-piana/part13.js';
import part14 from './loro-piana/part14.js';

export default {
  slug: 'loro-piana',
  timeline: [
    [1924, 'Кварòна', 'Quarona', 'Инженер Пьетро Лоро Пьяна основывает компанию.', 'Engineer Pietro Loro Piana founds the company.'],
    [1941, 'Франко', 'Franco', 'Племянник основателя выводит ткани на рынки Европы, Америки и Японии.', 'The founder’s nephew takes the cloth to Europe, America and Japan.'],
    [1985, 'Готовая одежда', 'Ready-to-wear', 'Первая коллекция одежды (по одному источнику).', 'The first clothing collection (per one source).'],
    [1994, 'Викунья и Storm System', 'Vicuña and Storm System', 'Исключительное право на волокно викуньи в Перу; водонепроницаемый кашемир.', 'Exclusive vicuña rights in Peru; waterproof cashmere.'],
    [2003, 'Pecora Nera', 'Pecora Nera', 'Вся тёмная шерсть фермы Фионы Гарднер.', 'All of Fiona Gardner’s dark wool.'],
    [2005, 'Summer Walk', 'Summer Walk', 'Лофер, рождённый страстью к парусу.', 'A loafer born of a love of sailing.'],
    [2008, 'Baby cashmere и заповедник', 'Baby cashmere and a reserve', 'Новое волокно и первый частный заповедник Перу.', 'A new fibre and Peru’s first private reserve.'],
    [2010, 'Лотос', 'Lotus', 'Ткань из лотоса с озера Инле.', 'Cloth from Inle Lake lotus.'],
    [2013, 'LVMH', 'LVMH', '80 процентов за около 2 млрд евро; 19 декабря умирает Серджо.', '80% for about €2 billion; Sergio dies on 19 December.'],
    [2023, '«Тихая роскошь»', '“Quiet luxury”', 'Бейсболка Кендалла Роя и мировая слава.', 'Kendall Roy’s cap and global fame.'],
    [2024, 'Сто лет', 'A hundred years', 'Столетие марки; расследование Bloomberg о викунье.', 'The centenary; Bloomberg’s vicuña report.'],
    [2025, 'Суд и Фредерик Арно', 'Court and Frédéric Arnault', 'Выставка в Шанхае; новый генеральный директор; судебное управление.', 'The Shanghai show; a new CEO; judicial administration.'],
    [2026, 'Решение суда', 'The court’s decision', '17 апреля судебное управление снято досрочно.', 'Judicial administration lifted early on 17 April.'],
  ],
  // Дополнительные главы встраиваются после основных глав части 3, перед тремя итоговыми разделами.
  sections: [...part1, ...part2, ...part4, ...part5, ...part6, ...part7, ...part8, ...part3.slice(0, -3), part9[0], part9[1], ...part10, ...part11, ...part12, ...part13, ...part14, ...part3.slice(-3, -1), part9[2], ...part3.slice(-1)],
};
