// История Supreme (этап 22): разделы собираются из частей supreme/part1–7.js; хронология своя (заменяет стартовую
// из seed-data/brands.js). Все факты сверены через поиск; где источники расходятся — это сказано в тексте;
// оценки помечены как оценки.
import part1 from './supreme/part1.js';
import part2 from './supreme/part2.js';
import part3 from './supreme/part3.js';
import part4 from './supreme/part4.js';
import part5 from './supreme/part5.js';
import part6 from './supreme/part6.js';
import part7 from './supreme/part7.js';

export default {
  slug: 'supreme',
  timeline: [
    [1994, 'Лафайет-стрит', 'Lafayette Street', 'В апреле Джеймс Джеббиа открывает скейт-магазин Supreme на Лафайет-стрит, 274.', 'In April James Jebbia opens the Supreme skate shop at 274 Lafayette Street.'],
    [1995, '«Детки»', '“Kids”', 'Скейтеры первой команды Supreme Джастин Пирс и Гарольд Хантер снимаются в фильме Ларри Кларка.', 'Original Supreme riders Justin Pierce and Harold Hunter appear in Larry Clark’s film.'],
    [1998, 'Япония', 'Japan', 'Магазины в Токио (Дайканъяма), Осаке и Фукуоке.', 'Stores open in Tokyo (Daikanyama), Osaka and Fukuoka.'],
    [2000, 'Запрет Louis Vuitton', 'Louis Vuitton’s cease-and-desist', 'Louis Vuitton требует прекратить выпуск вещей с похожей монограммой.', 'Louis Vuitton demands an end to monogram-like products.'],
    [1996, 'Vans', 'Vans', 'Первая обувная коллаборация — Vans Old Skool (по некоторым источникам, 1997).', 'The first footwear collaboration — Vans Old Skool (some sources say 1997).'],
    [2002, 'Nike SB Dunk', 'Nike SB Dunk', 'Первая коллаборация с Nike — Dunk Low Pro SB с мотивами Air Jordan 3.', 'The first Nike collaboration — a Dunk Low Pro SB with Air Jordan 3 cues.'],
    [2004, 'Лос-Анджелес', 'Los Angeles', 'Магазин на Фэрфакс-авеню со скейт-чашей.', 'The Fairfax Avenue store with a skate bowl.'],
    [2007, 'The North Face', 'The North Face', 'Первая совместная куртка Summit Series.', 'The first joint Summit Series jacket.'],
    [2011, 'Лондон', 'London', 'В сентябре открывается магазин на Питер-стрит в Сохо.', 'In September the Peter Street store opens in Soho.'],
    [2012, 'Comme des Garçons SHIRT', 'Comme des Garçons SHIRT', 'В марте — первая коллаборация с зеркальным бокс-лого.', 'In March — the first collaboration, with a mirrored box logo.'],
    [2013, 'Товарный знак', 'Trademark', '6 марта подана заявка на регистрацию бокс-лого в США.', 'On 6 March the box logo is filed for US registration.'],
    [2014, '«cherry»', '“cherry”', 'Первое полнометражное скейт-видео Supreme почти за 20 лет, режиссёр — Уильям Стробек.', 'Supreme’s first full-length skate video in almost 20 years, by William Strobeck.'],
    [2016, 'Париж', 'Paris', '10 марта открывается магазин на улице Барбет.', 'On 10 March the rue Barbette store opens.'],
    [2017, 'Louis Vuitton и Carlyle', 'Louis Vuitton and Carlyle', 'Январь — коллекция с Louis Vuitton в Париже; Carlyle вкладывает около 500 млн долларов.', 'January — the Louis Vuitton collection in Paris; Carlyle invests about $500 million.'],
    [2018, 'CFDA', 'CFDA', '4 июня Джеббиа — дизайнер мужской одежды года.', 'On 4 June Jebbia is named Menswear Designer of the Year.'],
    [2018, 'Samsung и Supreme Italia', 'Samsung and Supreme Italia', '10 декабря Samsung объявляет о союзе с «легальной подделкой» и вскоре отказывается от него.', 'On 10 December Samsung announces a tie-up with the “legal fake”, soon cancelled.'],
    [2020, 'VF Corporation', 'VF Corporation', '9 ноября VF объявляет о покупке Supreme за 2,1 млрд долларов.', 'On 9 November VF announces it will buy Supreme for $2.1 billion.'],
    [2021, 'Tiffany & Co.', 'Tiffany & Co.', '11 ноября выходит совместная коллекция украшений.', 'On 11 November the joint jewellery collection is released.'],
    [2022, 'Тремейн Эмори', 'Tremaine Emory', 'Первый в истории Supreme креативный директор (ушёл в августе 2023).', 'Supreme’s first-ever creative director (left in August 2023).'],
    [2019, 'Sotheby’s', 'Sotheby’s', 'Архив из 248 досок Supreme продан на аукционе за 800 тысяч долларов.', 'An archive of 248 Supreme decks sells at auction for $800,000.'],
    [2023, 'Сеул и «Rammellzee»', 'Seoul and “Rammellzee”', 'Первый магазин в Южной Корее; кроссовки Nike SB Dunk с работами Раммеллзи.', 'The first South Korean store; Nike SB Dunks with Rammellzee’s art.'],
    [2024, '30 лет и EssilorLuxottica', '30 years and EssilorLuxottica', 'Книга о 30 годах футболок; 1 октября сделка с EssilorLuxottica закрыта за 1,5 млрд долларов.', 'A book on 30 years of tees; on 1 October the EssilorLuxottica deal closes for $1.5 billion.'],
    [2024, 'Ducati', 'Ducati', '30 мая выходит коллекция с мотоциклом Ducati Streetfighter V4 S.', 'On 30 May the Ducati Streetfighter V4 S collection is released.'],
  ],
  sections: [...part1, ...part2, ...part3.slice(0, -1), ...part4, ...part5, ...part6, ...part7, part3[part3.length - 1]],
};
