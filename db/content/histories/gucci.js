// История Gucci (этап 18). Факты сверены с источниками (Wikipedia, Biography.com, Irish Times, CBS News, numero.com,
// W Magazine, Grazia, nss magazine, fibre2fashion, The Fashion DB, Treccani, The Fashion Law). Спорные детали (точные даты
// отдельных назначений, легенды о юности основателя) изложены без утверждений, которые не удалось подтвердить.
// Формат: абзацы через пустую строку, «### » — подзаголовок, «> » — врезка.
import part1 from './gucci/part1.js';
import part2 from './gucci/part2.js';
import part3 from './gucci/part3.js';
import part4 from './gucci/part4.js';
import part5 from './gucci/part5.js';

const base = {
  slug: 'gucci',
  timeline: [
    [1921, 'Лавка во Флоренции', 'A shop in Florence', 'Гуччо Гуччи открывает во Флоренции небольшую лавку дорожных сумок и кожаных изделий.', 'Guccio Gucci opens a small luggage and leather goods shop in Florence.'],
    [1947, 'Bamboo', 'Bamboo', 'Из-за послевоенного дефицита материалов появляется сумка с ручкой из бамбука.', 'Post-war shortages lead to the bag with a bamboo handle.'],
    [1953, 'Лоферы Horsebit', 'Horsebit loafers', 'Лоферы с уменьшенной копией конской пряжки-трензеля; в том же году умирает основатель.', 'Loafers with a miniature horse-bit; the founder dies the same year.'],
    [1966, 'Flora', 'Flora', 'Цветочный принт Flora создан для платка Грейс Келли, принцессы Монако.', 'The Flora print is created for a scarf for Grace Kelly, Princess of Monaco.'],
    [1990, 'Приход Тома Форда', 'Tom Ford arrives', 'Том Форд приходит в Gucci дизайнером женской одежды.', 'Tom Ford joins Gucci as a womenswear designer.'],
    [1993, 'Конец семейной эпохи', 'End of the family era', 'Investcorp выкупает у Маурицио Гуччи оставшиеся 50 % компании.', 'Investcorp buys Maurizio Gucci’s remaining 50% of the company.'],
    [1994, 'Креативный директор Том Форд', 'Creative director Tom Ford', 'Том Форд становится креативным директором и возрождает дом.', 'Tom Ford becomes creative director and revives the house.'],
    [1995, 'Убийство Маурицио Гуччи', 'Maurizio Gucci killed', '27 марта Маурицио Гуччи застрелен в Милане; в 1998 году по делу осуждена его бывшая жена Патриция Реджани.', 'On 27 March Maurizio Gucci is shot dead in Milan; his ex-wife Patrizia Reggiani is convicted in 1998.'],
    [1999, 'PPR', 'PPR', 'Группа PPR (ныне Kering) покупает 42 % акций Gucci Group после борьбы с LVMH.', 'PPR (now Kering) buys 42% of Gucci Group after a battle with LVMH.'],
    [2004, 'Уход Форда', 'Ford leaves', 'Том Форд покидает Gucci.', 'Tom Ford leaves Gucci.'],
    [2015, 'Алессандро Микеле', 'Alessandro Michele', 'Начинается эпоха винтажного максимализма Микеле (до 2022 года).', 'Alessandro Michele’s era of vintage maximalism begins (until 2022).'],
    [2023, 'Сабато Де Сарно', 'Sabato De Sarno', 'Дебютная коллекция «Ancora» (весна–лето 2024).', 'The debut “Ancora” collection (Spring–Summer 2024).'],
    [2025, 'Демна', 'Demna', 'Демна назначен художественным директором; в сентябре выходит лукбук «La Famiglia».', 'Demna is appointed artistic director; the “La Famiglia” lookbook appears in September.'],
    [2026, '«Primavera»', '“Primavera”', '27 февраля Демна показывает в Милане свою первую коллекцию для Gucci на подиуме.', 'On 27 February Demna shows his first Gucci runway collection in Milan.'],
  ],
  sections: [
    {
      period: '1881–1921',
      title_ru: 'Предыстория: Гуччо Гуччи',
      title_en: 'Before the house: Guccio Gucci',
      content_ru: `История Gucci начинается во Флоренции — городе, где ремесло кожевников было частью городской культуры задолго до появления модных домов. Основатель, Гуччо Гуччи, вырос в этой среде и с юности знал, как ценится хорошо сделанная вещь.

### Путешествия юности

В конце XIX века молодой Гуччо побывал в Париже и Лондоне — двух столицах, где тогда формировались представления о роскошных путешествиях и аристократическом стиле. Европейская элита ездила с горами чемоданов, сундуков и дорожных сумок; качественный багаж был знаком статуса не меньше, чем одежда. Этот опыт, по общему мнению историков марки, подсказал Гуччо направление будущего дела: соединить флорентийское мастерство обработки кожи с английским вкусом к дорожным вещам и верховой езде.

### Флоренция как мастерская

Флоренция давала то, чего не было у Лондона и Парижа: мастеров. Городские ремесленники умели выделывать, кроить и прошивать кожу на уровне, который сделал итальянские изделия эталоном. Именно на этом соединении — международный вкус и местное ремесло — и будет построен дом.

> Gucci с первого дня был не модной идеей, а ремеслом, обращённым к вкусам путешествующей элиты.`,
      content_en: `Gucci's story begins in Florence, a city where leatherwork was part of civic culture long before fashion houses existed. As a young man at the end of the nineteenth century Guccio Gucci travelled to Paris and London, capitals of luxurious travel, where quality luggage signalled status. That experience pointed him toward combining Florentine leather craft with an English taste for travel goods and riding.`,
      quote_ru: null,
      quote_en: null,
      quote_author: null,
    },
    {
      period: '1921–1947',
      title_ru: 'Основание и первые десятилетия',
      title_en: 'Founding and the first decades',
      content_ru: `В 1921 году Гуччо Гуччи открыл во Флоренции небольшую лавку дорожных сумок и кожаных изделий. Так появился дом, который через сто лет станет одним из самых узнаваемых имён в мире моды.

### Чемоданы и седельное ремесло

Первые изделия Gucci — багаж, сумки, аксессуары — опирались на традиции седельного дела. Конный спорт и аристократический досуг стали для марки источником образов на десятилетия вперёд: пряжки-трензели, стремена, полосы конской попоны позже превратятся в фирменные мотивы дома.

### Семейное дело

С самого начала Gucci был семейной компанией. Сыновья основателя постепенно включались в работу, и дело росло вместе с семьёй: от мастерской к сети магазинов. Эта семейная природа долгое время была силой дома — и, как покажет вторая половина XX века, его главной уязвимостью.

### Bamboo: изобретение из дефицита

В 1947 году послевоенная Италия жила в условиях острой нехватки материалов. Кожа была дефицитом, и мастера Gucci нашли неожиданное решение — ручку из бамбука, которую нагревали и изгибали. Так появилась сумка Bamboo. Вынужденная мера стала одной из самых долговечных икон дома: прочный, лёгкий и экзотичный материал выделял вещь среди любых других сумок.

> Bamboo — пример того, как ограничение становится стилем.`,
      content_en: `In 1921 Guccio Gucci opened a small luggage and leather-goods shop in Florence. Early pieces drew on saddlery; equestrian motifs — horse-bits, stirrups, saddle-girth stripes — later became house codes. Gucci was a family company from the start. In 1947, facing post-war shortages of leather, the workshop used heated, curved bamboo for a handle: the Bamboo bag, a constraint turned into an icon.`,
      quote_ru: null,
      quote_en: null,
      quote_author: null,
    },
    {
      period: '1953–1970',
      title_ru: 'Становление: Horsebit, Flora и мировая известность',
      title_en: 'Rise: Horsebit, Flora and fame',
      content_ru: `1953 год стал для Gucci рубежом. Умер основатель, Гуччо Гуччи, но дом, созданный им, уже был готов к выходу на мировую сцену.

### Лоферы Horsebit

В 1953 году появились лоферы Horsebit — мягкие мокасины с уменьшенной металлической копией конской пряжки-трензеля. Конный мотив, связанный с истоками марки, превратился в деталь, которую узнают с первого взгляда. Лоферы стали одной из самых долгоживущих моделей в истории обуви и до сих пор остаются в коллекциях дома.

### Мир знаменитостей

В 1950–1960-е годы Gucci становится маркой международной элиты и кино. Сумки и обувь дома носили звёзды и члены королевских семей, а одна из моделей сумок позже получила имя Жаклин Кеннеди.

### Flora для Грейс Келли

В 1966 году появился принт Flora — цветочный рисунок художника Витторио Аккорнеро, созданный для платка Грейс Келли, принцессы Монако. Россыпь цветов, бабочек и насекомых на светлом фоне стала одним из главных образов дома и регулярно возвращается в коллекции разных креативных директоров.

### Код дома

К концу 1960-х сложился узнаваемый словарь Gucci: пряжка-трензель, бамбук, полосатая лента, цветочная Flora, переплетённые инициалы основателя. Этот словарь будут использовать — и переосмыслять — все последующие поколения дизайнеров.

> Каждый следующий креативный директор Gucci возвращался к одним и тем же кодам — и каждый раз находил в них новый смысл.`,
      content_en: `1953 was a turning point: the founder died, and the Horsebit loafer appeared — a soft moccasin with a miniature metal horse-bit, still in production. In the 1950s–60s Gucci became a label of film stars and royalty; one bag was later named after Jacqueline Kennedy. In 1966 artist Vittorio Accornero created the Flora print for a scarf for Grace Kelly, Princess of Monaco. By the end of the decade the house vocabulary — horse-bit, bamboo, striped ribbon, Flora, interlocking initials — was in place.`,
      quote_ru: null,
      quote_en: null,
      quote_author: null,
    },
    {
      period: '1970–1993',
      title_ru: 'Семейные конфликты и конец семейной эпохи',
      title_en: 'Family conflict and the end of the family era',
      content_ru: `Вторая половина XX века стала для Gucci временем стремительного роста — и тяжёлых внутренних конфликтов. Семейная компания, разросшаяся до международной империи, оказалась ареной борьбы наследников.

### Лицензии и размывание имени

Как и многие дома той эпохи, Gucci активно выдавал лицензии и расширял ассортимент. Логотип появлялся на всё большем количестве вещей, а вместе с ростом продаж росло и ощущение, что марка теряет эксклюзивность.

### Борьба наследников

Внутрисемейные конфликты 1970–1980-х годов привели к тому, что управление домом стало предметом споров между родственниками. В центре событий оказался Маурицио Гуччи, внук основателя, стремившийся вернуть марке прежний блеск.

### Investcorp

Финансовая группа Investcorp начала покупать доли в Gucci во второй половине 1980-х. В сентябре 1993 года она выкупила у Маурицио Гуччи оставшиеся 50 % компании. Семья основателя окончательно утратила контроль над домом, носившим её имя.

### Новые люди

Ещё до этого, в 1989 году, в Gucci пришла Дон Мелло — опытный руководитель, возглавившая творческое направление и начавшая собирать новую команду. В 1990 году в дом пришёл молодой американский дизайнер Том Форд — сначала дизайнером женской одежды. Именно ему предстояло изменить судьбу Gucci.

> Gucci перестал быть семейным делом — и именно это открыло дорогу его второму рождению.`,
      content_en: `The late twentieth century brought rapid growth and bitter family conflict. Licences multiplied and the name lost exclusivity. Maurizio Gucci, the founder's grandson, sought to restore the house's lustre. Investcorp began buying into Gucci in the late 1980s and in September 1993 bought Maurizio's remaining 50%, ending family control. Dawn Mello arrived in 1989 to lead the creative direction, and in 1990 the young American designer Tom Ford joined as a womenswear designer.`,
      quote_ru: null,
      quote_en: null,
      quote_author: null,
    },
    {
      period: '1995',
      title_ru: 'Убийство Маурицио Гуччи',
      title_en: 'The killing of Maurizio Gucci',
      content_ru: `27 марта 1995 года Маурицио Гуччи был застрелен в Милане у входа в свой офис. Убийство последнего представителя семьи, руководившего домом, потрясло Италию и мир моды.

### Следствие и суд

Расследование привело к бывшей жене Маурицио, Патриции Реджани. В ноябре 1998 года миланский суд признал её виновной в организации убийства и приговорил к 29 годам заключения; исполнитель, наёмный убийца Бенедетто Черауло, получил пожизненный срок. В 2000 году апелляционный суд оставил приговор Реджани в силе, сократив срок до 26 лет. Пресса прозвала её «чёрной вдовой». На свободу она вышла в 2016 году.

### История в культуре

Драма семьи Гуччи стала сюжетом книг и фильмов. В 2021 году вышел фильм Ридли Скотта «Дом Gucci», где Патрицию Реджани сыграла Леди Гага, — он вернул старую историю в центр внимания и привлёк к дому новое поколение зрителей.

> К моменту убийства семья уже не управляла компанией — Gucci продолжал жить под руководством новой команды.`,
      content_en: `On 27 March 1995 Maurizio Gucci was shot dead in Milan. In November 1998 his ex-wife Patrizia Reggiani was convicted of ordering the killing and sentenced to 29 years; the hitman, Benedetto Ceraulo, received life. In 2000 an appeals court upheld the conviction and cut her sentence to 26 years; the press called her the “Black Widow”, and she was released in 2016. Ridley Scott's 2021 film “House of Gucci”, with Lady Gaga as Reggiani, brought the story to a new generation.`,
      quote_ru: null,
      quote_en: null,
      quote_author: null,
    },
    {
      period: '1994–2004',
      title_ru: 'Том Форд: второе рождение',
      title_en: 'Tom Ford: the rebirth',
      content_ru: `В 1994 году Том Форд стал креативным директором Gucci. За десять лет он превратил дом, переживший кризисы и семейные войны, в один из самых желанных брендов мира.

### Чувственность 1990-х

Эстетика Форда — открытая сексуальность, блеск, минималистичная роскошь, отсылки к гламуру 1970-х. Бархатные костюмы, шёлковые рубашки, расстёгнутые почти до пояса, обтягивающие платья, высокие каблуки — его Gucci звучал как вызов сдержанной моде начала десятилетия. Показы Форда стали событиями, а рекламные кампании — одними из самых обсуждаемых в истории моды.

### Бизнес и бренд

Рядом с Фордом работал Доменико Де Соле, возглавивший компанию как генеральный директор. Их тандем стал образцом союза творческого директора и менеджера: Форд отвечал за образ, Де Соле — за систему, которая этот образ продавала. Дом сократил лицензии, вернул контроль над производством и магазинами и снова стал эксклюзивным.

### Битва за Gucci

В 1999 году за контроль над Gucci развернулась борьба между LVMH и группой Pinault-Printemps-Redoute (PPR). Итогом стала покупка PPR 42 % акций Gucci Group примерно за 3 миллиарда долларов; суд в Нидерландах в мае 1999 года подтвердил законность сделки. На основе Gucci Group PPR построила люксовый холдинг, позже переименованный в Kering.

### Уход

В 2004 году Том Форд и Доменико Де Соле покинули Gucci. Эпоха, начавшаяся с возрождения почти потерянной марки, завершилась на пике её успеха.

> Форд доказал, что старый дом можно вернуть к жизни, если говорить его кодами на языке своего времени.`,
      content_en: `Tom Ford became creative director in 1994 and in ten years turned Gucci into one of the world's most desirable brands: overt sensuality, gloss, 1970s glamour, velvet suits and shirts open to the waist. Alongside him CEO Domenico De Sole cut licences and regained control of production and stores. In 1999 LVMH and Pinault-Printemps-Redoute fought for control; PPR (later Kering) bought 42% of Gucci Group for about $3 billion, upheld by a Dutch court in May 1999. Ford and De Sole left in 2004.`,
      quote_ru: null,
      quote_en: null,
      quote_author: null,
    },
    {
      period: '2004–2014',
      title_ru: 'После Форда: Факкинетти и Джаннини',
      title_en: 'After Ford: Facchinetti and Giannini',
      content_ru: `Уход Форда оставил Gucci перед трудной задачей: найти преемника для одного из самых влиятельных дизайнеров эпохи.

### Алессандра Факкинетти

Первой женскую линию возглавила Алессандра Факкинетти (2004–2005). Её работа продолжалась недолго: дом искал направление, а давление ожиданий после Форда было огромным.

### Фрида Джаннини

С 2006 по 2014 год креативным директором Gucci была Фрида Джаннини. Она пришла в дом как дизайнер аксессуаров и сделала ставку на архив: переработала принт Flora, вернула внимание к бамбуку и пряжке-трензелю. При ней Gucci оставался коммерчески мощной маркой, хотя критики упрекали её коллекции в недостатке смелости. Эпоха Джаннини завершилась в конце 2014 года.

> Архив дома стал для Джаннини главным инструментом — и этим она подготовила почву для следующего поколения.`,
      content_en: `After Ford, Alessandra Facchinetti led womenswear (2004–2005). Frida Giannini, who had joined as an accessories designer, was creative director from 2006 to 2014. She mined the archive — reworking Flora, bamboo and the horse-bit — and kept Gucci commercially strong, though critics found her collections cautious.`,
      quote_ru: null,
      quote_en: null,
      quote_author: null,
    },
    {
      period: '2015–2022',
      title_ru: 'Алессандро Микеле: винтажный максимализм',
      title_en: 'Alessandro Michele: vintage maximalism',
      content_ru: `В 2015 году креативным директором Gucci стал Алессандро Микеле, много лет проработавший в дизайн-команде дома. Его назначение стало сюрпризом: малоизвестный широкой публике дизайнер за несколько сезонов изменил облик не только Gucci, но и всей моды.

### Эстетика Микеле

Микеле предложил мир, полный цвета, орнамента и эклектики: винтажные очки, рюши, цветочные вышивки, гендерно-свободные силуэты, смешение эпох — от Ренессанса до 1970-х. Его Gucci был похож на кабинет редкостей, в котором каждый предмет рассказывает историю. Мода снова заговорила языком избыточности после долгого периода минимализма.

### Коды в новом прочтении

Микеле активно работал с наследием: логотип с переплетёнными G, лента, Flora, лоферы Horsebit появлялись в новых сочетаниях. Лоферы-мюли без задника, сумки с вышивками, вещи с монограммой стали хитами продаж.

### Рекорды и уход

При Микеле Gucci пережил один из самых бурных периодов роста в истории. Однако к началу 2020-х рост замедлился, и в ноябре 2022 года Микеле покинул дом.

> Микеле доказал, что дом может начать новую жизнь без революции — просто открыв свой архив заново.`,
      content_en: `In 2015 Alessandro Michele, a long-time member of the design team, became creative director and changed fashion: colour, ornament and eclecticism, vintage glasses, ruffles, embroidery, gender-fluid silhouettes and a mix of eras. He reinvented the codes — the interlocking G, the stripe, Flora, backless Horsebit loafer-mules. Gucci grew spectacularly under him; as growth slowed, he left in November 2022.`,
      quote_ru: null,
      quote_en: null,
      quote_author: null,
    },
    {
      period: '2023–2025',
      title_ru: 'Сабато Де Сарно: «Ancora»',
      title_en: 'Sabato De Sarno: “Ancora”',
      content_ru: `После Микеле Gucci выбрал противоположное направление. Креативным директором стал Сабато Де Сарно, итальянский дизайнер, до этого много лет работавший в Valentino.

### «Ancora»

Его дебютная коллекция весна–лето 2024 получила название «Ancora» — «ещё». Де Сарно предложил более сдержанный, чистый и чувственный Gucci: простые силуэты, мини-юбки, лоферы, сумка Jackie в новом прочтении и насыщенный тёмно-красный цвет, получивший название Rosso Ancora.

### Короткая эпоха

Задача перезапуска оказалась сложной: продажи дома в эти годы снижались, а рынок роскоши в целом переживал спад. Де Сарно покинул Gucci в начале 2025 года, проработав в доме около двух лет.

> «Ancora» был попыткой вернуть Gucci простоту — после самого громкого десятилетия в его истории.`,
      content_en: `Sabato De Sarno, a long-time Valentino designer, followed Michele. His Spring–Summer 2024 debut, “Ancora”, proposed a cleaner, sensual Gucci — simple silhouettes, loafers, the Jackie bag reworked, and a deep red called Rosso Ancora. With sales declining and luxury in a downturn, he left in early 2025 after about two years.`,
      quote_ru: null,
      quote_en: null,
      quote_author: null,
    },
    {
      period: '2025 — н. в.',
      title_ru: 'Демна в Gucci',
      title_en: 'Demna at Gucci',
      content_ru: `В 2025 году художественным директором Gucci назначили Демну — дизайнера, десять лет возглавлявшего Balenciaga и до того основавшего Vetements. Назначение внутри одной группы Kering стало одним из главных кадровых событий моды десятилетия.

### «La Famiglia»

Первой работой Демны для Gucci стал лукбук «La Famiglia» из 38 образов, снятый фотографом Кэтрин Опи и опубликованный 23 сентября 2025 года, накануне запланированного показа дома в Милане. Образы складывались в портрет «семьи» Gucci — разных типажей, каждый из которых представляет одну из граней наследия марки.

### «Primavera»

27 февраля 2026 года во время Недели моды в Милане, в Palazzo delle Scintille, Демна показал свою первую коллекцию Gucci на подиуме — осень–зима 2026 под названием «Primavera», «Весна», с отсылкой к картине Сандро Боттичелли. Пресса отметила облегающие силуэты, театральный минимализм, чувственность 1990-х и отсылки к эпохе Тома Форда. Завершила показ Кейт Мосс. Коллекция была хорошо принята критикой.

> Демна вернул Gucci к телу и к девяностым — к эпохе, с которой началось второе рождение дома.`,
      content_en: `In 2025 Demna, who had led Balenciaga for a decade and co-founded Vetements, was named artistic director of Gucci. His first work was “La Famiglia”, a 38-look lookbook photographed by Catherine Opie and released on 23 September 2025. On 27 February 2026, at Milan's Palazzo delle Scintille, he showed his first runway collection, Fall–Winter 2026 “Primavera”, nodding to Botticelli: body-conscious silhouettes, theatrical minimalism and echoes of the Tom Ford era, closed by Kate Moss. It was well received.`,
      quote_ru: null,
      quote_en: null,
      quote_author: null,
    },
    {
      period: '1921 — н. в.',
      title_ru: 'Культовые вещи',
      title_en: 'Iconic pieces',
      content_ru: `### Сумка Bamboo (1947)

Ручка из нагретого и изогнутого бамбука появилась из-за послевоенного дефицита кожи — и стала одним из самых узнаваемых силуэтов дома.

### Лоферы Horsebit (1953)

Мягкие мокасины с металлической пряжкой-трензелем — самая долгоживущая обувь Gucci. При Алессандро Микеле появилась версия без задника, ставшая хитом 2010-х.

### Flora (1966)

Цветочный принт Витторио Аккорнеро, созданный для платка Грейс Келли, — один из главных образов дома, к которому возвращались Джаннини, Микеле и другие дизайнеры.

### Сумка Jackie

Сумка-хобо, позже получившая имя Жаклин Кеннеди, пережила несколько возрождений — в том числе в дебютной коллекции Сабато Де Сарно.

### Полосатая лента и двойная G

Лента в полоску, вдохновлённая конской подпругой, и переплетённые инициалы основателя стали визуальными подписями дома, которые узнают без названия марки.

> Почти все иконы Gucci родились из конного мира, дефицита материалов или дружбы с выдающимися клиентками.`,
      content_en: `Icons include the Bamboo bag (1947), born of a leather shortage; the Horsebit loafer (1953), reinvented by Michele as a backless mule; the Flora print (1966) by Vittorio Accornero for Grace Kelly; the Jackie hobo bag, revived among others by De Sarno; and the saddle-girth striped ribbon and interlocking G.`,
      quote_ru: null,
      quote_en: null,
      quote_author: null,
    },
    {
      period: '1999 — н. в.',
      title_ru: 'Владельцы и корпоративная история',
      title_en: 'Owners and corporate history',
      content_ru: `Корпоративная история Gucci делится на три эпохи: семейную, переходную и эпоху Kering.

### Семья (1921–1993)

Более семидесяти лет компанией владели и управляли потомки основателя. Конфликты между ними ослабили дом и в конце концов привели к продаже.

### Investcorp (конец 1980-х — 1990-е)

Финансовая группа Investcorp начала покупать доли во второй половине 1980-х и в сентябре 1993 года выкупила у Маурицио Гуччи оставшиеся 50 %. Новые владельцы сделали ставку на профессиональный менеджмент и творческую команду во главе с Томом Фордом.

### PPR и Kering (с 1999 года)

После борьбы 1999 года с LVMH группа Pinault-Printemps-Redoute купила 42 % акций Gucci Group примерно за 3 миллиарда долларов. Gucci стал основой люксового холдинга PPR, который позже был переименован в Kering. Сегодня Gucci — крупнейший дом группы, от успеха которого зависит состояние всего Kering.

> История владельцев Gucci — путь от семейной мастерской к главному активу одной из крупнейших люксовых групп мира.`,
      content_en: `Gucci's corporate history has three eras: the family (1921–1993), whose conflicts led to a sale; Investcorp, which bought in from the late 1980s and acquired Maurizio's remaining 50% in September 1993; and PPR/Kering, which after the 1999 battle with LVMH bought 42% of Gucci Group for about $3 billion. Gucci became the core of PPR's luxury business, later renamed Kering, and remains its largest house.`,
      quote_ru: null,
      quote_en: null,
      quote_author: null,
    },
    {
      period: '1921 — н. в.',
      title_ru: 'Влияние, сегодня и интересные факты',
      title_en: 'Influence, today and curious facts',
      content_ru: `### Влияние на моду

Gucci трижды менял моду: в 1950–1960-е — как символ итальянской роскоши для звёзд и королевских семей, в 1990-е — как образец возрождения старого дома через чувственность и маркетинг Тома Форда, в 2010-е — как лаборатория максимализма Алессандро Микеле. Каждая из этих эпох стала примером для всей индустрии: как работать с архивом, как перезапускать бренд, как говорить с новым поколением.

### Gucci сегодня

Сегодня Gucci — главный дом группы Kering и один из самых узнаваемых модных брендов мира. После периода снижения продаж середины 2020-х дом переживает новый перезапуск под руководством Демны: лукбук «La Famiglia» (сентябрь 2025) и первый показ «Primavera» в Милане (февраль 2026) были восприняты как начало новой главы, возвращающей Gucci к телесности и наследию эпохи Форда.

### Интересные факты

Сумка Bamboo появилась не из стремления к экзотике, а из-за нехватки кожи после войны.

Принт Flora создавался для одной клиентки — Грейс Келли — и стал одним из самых тиражируемых рисунков дома.

Том Форд пришёл в Gucci в 1990 году дизайнером женской одежды и лишь через четыре года стал креативным директором.

В 1999 году за Gucci боролись две крупнейшие люксовые группы — LVMH и будущий Kering; спор решал суд в Нидерландах.

История убийства Маурицио Гуччи легла в основу фильма Ридли Скотта «Дом Gucci» (2021) с Леди Гагой.

Первую коллекцию Демны для Gucci на подиуме закрывала Кейт Мосс.

> Сто лет Gucci — это история о том, как флорентийская мастерская пережила семейные войны и стала одним из символов современной роскоши.`,
      content_en: `Gucci has changed fashion three times: as Italian luxury for stars and royals in the 1950s–60s, as the model of a revived house under Tom Ford in the 1990s, and as Alessandro Michele's maximalist laboratory in the 2010s. Today it is Kering's largest house; after sales declines in the mid-2020s it is being relaunched by Demna, whose “La Famiglia” lookbook (September 2025) and “Primavera” show (February 2026) mark a new chapter. Curious facts: the Bamboo bag came from a leather shortage; Flora was made for one client, Grace Kelly; Ford joined in 1990 as a womenswear designer; a Dutch court settled the 1999 fight for Gucci; Kate Moss closed Demna's first Gucci show.`,
      quote_ru: null,
      quote_en: null,
      quote_author: null,
    },
  ],
};

// Порядок разделов: базовые разделы (gucci.js) + подробные части gucci/part1–5.js — в хронологическом и тематическом порядке
const [prehistory, founding, rise, familyEra, murder, ford, afterFord, michele, deSarno, demna, iconic, owners, influence] = base.sections;
const [workshop, sons, jackie, codes, empire] = part1;
const [fordBefore, fordMethod, deSole, battle, group, fordLeaves] = part2;
const [crisis, deSarnoDeep, demnaDeep, film, celebrity, relaunches] = part4;
const [horsebit, bamboo, flora, monogram, florence, today, facts] = part5;

export default {
  slug: base.slug,
  timeline: base.timeline,
  sections: [
    // 1–3. Предыстория, основание, становление
    prehistory, founding, workshop, rise, sons, jackie, codes,
    // 8–9. Семейные конфликты, владельцы
    familyEra, empire,
    // 4. Креативные директора и их эпохи
    fordBefore, ford, fordMethod, deSole, murder, battle, group, fordLeaves, afterFord,
    michele, ...part3, crisis, deSarno, deSarnoDeep, demna, demnaDeep,
    // 5–12. Культовые вещи, владельцы, влияние, сегодня, факты
    iconic, horsebit, bamboo, flora, monogram, owners, film, celebrity, florence, influence, relaunches, today, facts,
  ],
};
