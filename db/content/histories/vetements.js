// История Vetements (этап 17). Марка основана в 2014 году, поэтому фактический материал короче, чем у старых домов:
// объём меньше 15 000 слов допускается правилом для молодых марок (см. PROGRESS.md). Все факты сверены с источниками
// (Wikipedia, WWD, Business of Fashion, FashionUnited, FashionNetwork, Highsnobiety, Hypebeast, W Magazine, Fantastic Man).
// Формат: абзацы через пустую строку, «### » — подзаголовок, «> » — врезка.
import * as p2 from './vetements/part2.js';

const base = {
  slug: 'vetements',
  timeline: [
    [2014, 'Основание', 'Founded', 'Демна и Гурам Гвасалия основывают Vetements; первая коллекция (осень–зима 2014/15) показана в парижской галерее.', 'Demna and Guram Gvasalia found Vetements; the first collection (Autumn–Winter 2014/15) is shown in a Paris gallery.'],
    [2015, 'Футболка DHL', 'The DHL T-shirt', 'Осенью показана коллекция весна–лето 2016 с футболкой DHL; Демна назначен художественным директором Balenciaga.', 'In the autumn Spring–Summer 2016 is shown with the DHL T-shirt; Demna is appointed artistic director of Balenciaga.'],
    [2016, 'Восемнадцать коллабораций', 'Eighteen collaborations', 'Коллекция весна–лето 2017 с 18 марками показана в Galeries Lafayette во время Недели высокой моды; Демна — международный дизайнер года на The Fashion Awards.', 'Spring–Summer 2017, made with 18 brands, is shown at Galeries Lafayette during couture week; Demna is named International Ready-to-Wear Designer at The Fashion Awards.'],
    [2017, 'Цюрих', 'Zurich', 'Штаб-квартира и дизайн-студия переезжают из Парижа в Цюрих; выходят коллаборации с Reebok и DHL.', 'The headquarters and design studio move from Paris to Zurich; collaborations with Reebok and DHL are released.'],
    [2018, 'NO SHOW и блошиный рынок', 'NO SHOW and the flea market', 'Весна–лето 2018 — «NO SHOW» на крыше парковки в Париже с фотографиями жителей Цюриха; осень–зима 2018 — показ вне официального календаря на антикварном рынке.', 'Spring–Summer 2018 is a “NO SHOW” on a Paris car-park roof with photographs of Zurich residents; Autumn–Winter 2018 is shown off-calendar at an antiques market.'],
    [2019, 'Уход Демны', 'Demna leaves', 'Демна покидает Vetements, чтобы сосредоточиться на Balenciaga.', 'Demna leaves Vetements to focus on Balenciaga.'],
    [2021, 'VTMNTS и новый креативный директор', 'VTMNTS and a new creative director', 'В июле запущена марка VTMNTS; в декабре Гурам Гвасалия официально становится креативным директором.', 'VTMNTS launches in July; in December Guram Gvasalia is officially named creative director.'],
    [2022, 'Первый показ Гурама', 'Guram’s first show', 'Весна–лето 2023 — первый показ Vetements под руководством Гурама Гвасалии.', 'Spring–Summer 2023 is the first Vetements runway show under Guram Gvasalia.'],
    [2024, 'Десять лет', 'Ten years', 'Март — юбилейный показ осень–зима 2024; сентябрь — «Time To Clean Up The Mess» в заброшенном торговом центре.', 'March — the anniversary Autumn–Winter 2024 show; September — “Time To Clean Up The Mess” in an abandoned mall.'],
    [2025, 'Весна–лето 2026', 'Spring–Summer 2026', 'Показ в Париже открывается антифашистским заявлением; среди моделей — Кара Делевинь и Анок Яи.', 'The Paris show opens with an anti-fascist statement; Cara Delevingne and Anok Yai are among the models.'],
  ],
  sections: [
    {
      period: '1981–2013',
      title_ru: 'Предыстория: братья Гвасалия',
      title_en: 'Before the brand: the Gvasalia brothers',
      content_ru: `История Vetements начинается не в Париже, а в Грузии, и не с моды, а с семьи. Демна Гвасалия родился в 1981 году. Когда ему было тринадцать, семья была вынуждена переезжать: сначала в Тбилиси, затем на Украину и, в конце концов, в Россию. Опыт переезда, жизни «с тем, что есть», привычка ценить вещь за то, что она служит долго, — всё это позже превратится в один из главных сюжетов марки: одежду, которая выглядит как обычная, но значит гораздо больше.

### Экономист, ставший дизайнером

Путь Демны в моду не был прямым. Сначала он четыре года изучал международную экономику — дисциплину, далёкую от ателье и подиума. Решение заняться модой пришло позже, и Демна выбрал одну из самых требовательных школ Европы — Королевскую академию изящных искусств в Антверпене, где в разное время учились «Антверпенская шестёрка» и Мартин Маржела. Академию он окончил в 2006 году.

Антверпенская школа дала ему главное — привычку думать конструкцией и концепцией одновременно. Здесь учили, что одежда — это не только силуэт и ткань, но и высказывание о том, кто её носит и зачем.

### Maison Margiela и Louis Vuitton

В 2009 году Демна начал работать дизайнером женской одежды в Maison Margiela. Дом, основанный Мартином Маржелой, был школой деконструкции, анонимности и иронии по отношению к самой моде: белые бирки без имени, вещи «наизнанку», переработанные предметы. Многие приёмы, которые позже прославят Vetements, — работа с готовыми вещами, игра с пропорциями, отказ от культа личности дизайнера — уходят корнями в эти годы.

Затем Демна перешёл в Louis Vuitton, где стал ведущим дизайнером женских коллекций. Источники расходятся в том, когда именно он занял эту должность, но это было в начале 2010-х. Работа в одном из крупнейших домов мира показала ему моду с другой стороны: как устроены производство, продажи и огромная машина люксового бизнеса.

### Гурам: второй голос

Младший брат Демны, Гурам Гвасалия, выбрал другую роль — бизнес. Именно он станет генеральным директором Vetements и будет отвечать за то, чтобы смелые идеи превращались в устойчивую компанию. Распределение ролей между братьями — один придумывает, другой выстраивает систему — стало одним из оснований будущего успеха.

> Vetements с самого начала был семейной компанией: творческое и деловое в ней принадлежали двум братьям.

К 2013 году у Демны был опыт двух великих домов, у Гурама — понимание бизнеса. Оставалось найти форму, в которой оба этих знания смогли бы работать вместе.`,
      content_en: `Demna Gvasalia was born in 1981. At thirteen he and his family had to move — first to Tbilisi, then to Ukraine and eventually to Russia — an experience of making do that later shaped the brand's love of ordinary clothes charged with meaning. He first studied international economics for four years, then turned to fashion and graduated from the Royal Academy of Fine Arts in Antwerp in 2006.

In 2009 he joined Maison Margiela as a womenswear designer, absorbing its deconstruction, anonymity and irony, and later became head womenswear designer at Louis Vuitton in the early 2010s (sources differ on the exact year). His younger brother Guram chose business: he would become the CEO of Vetements, turning bold ideas into a company.`,
      quote_ru: null,
      quote_en: null,
      quote_author: null,
    },
    {
      period: '2014',
      title_ru: 'Основание: коллектив без имени',
      title_en: 'Founding: a collective without a name',
      content_ru: `В 2014 году Демна и Гурам Гвасалия основали в Париже Vetements. Само название — французское слово, означающее просто «одежда», — было манифестом. Не фамилия основателя, не выдуманный бренд с родословной, а самое обыденное слово языка моды. Марка с первого дня заявляла: речь пойдёт не о звёздном дизайнере, а о вещах.

### Коллектив вместо «великого имени»

Vetements представлялся как дизайнерский коллектив. Это было сознательным отказом от модели, в которой дом держится на культе одного творца. В ранних интервью и материалах марки подчёркивалось, что над коллекциями работает группа людей с опытом в разных домах, а не один гений. Конечно, мир моды быстро понял, кто стоит в центре, но сама риторика коллектива стала частью образа: Vetements выглядел как сообщество друзей, которые делают одежду для себя и своего круга.

### Первая коллекция

Первая коллекция марки — осень–зима 2014/15 — была показана в одной из парижских галерей. Никакого подиума, никакой роскошной постановки: вещи, люди, пространство. Уже здесь наметились главные темы: гипертрофированные пропорции, переработанные классические предметы гардероба, вещи, будто взятые из шкафа обычного человека и доведённые до предельной выразительности.

### Стилист как соавтор

Важной фигурой раннего Vetements стала стилист Лотта Волкова — уроженка Владивостока, учившаяся в Central Saint Martins и переехавшая в Париж в 2008 году. Именно она стилизовала первые показы марки; журнал W писал о ней как о стилисте, сформировавшей образ «модного коллектива». Её эстетика — постсоветская улица, клубная культура, ироничное отношение к «хорошему вкусу» — совпала с языком Демны и во многом определила, как выглядел ранний Vetements.

> Марка называлась просто «Одежда» — и именно поэтому её запомнили.

### Быстрый взлёт

Успех пришёл стремительно. Уже после трёх коллекций Vetements оказался среди финалистов двух главных премий для молодых дизайнеров — премии LVMH и премии ANDAM. Для марки, существовавшей меньше двух лет, это было признанием того, что индустрия видит в ней не случайную вспышку, а новое явление.

Секрет был не только в одежде, но и в точном ощущении времени. Середина 2010-х — эпоха Instagram, культа уличной одежды и усталости от «вежливой» роскоши. Vetements предложил моду, которая выглядела знакомой, но была слишком большой, слишком смелой и слишком ироничной, чтобы её можно было спутать с обычной.`,
      content_en: `In 2014 Demna and Guram Gvasalia founded Vetements in Paris. The name — simply the French word for “clothes” — was a manifesto: not a founder's surname but the most ordinary word in fashion. The label presented itself as a design collective rather than a house built around one creative star.

The first collection, Autumn–Winter 2014/15, was shown in a Paris gallery. Stylist Lotta Volkova — born in Vladivostok, trained at Central Saint Martins, in Paris since 2008 — styled the early shows and helped define the label's look of post-Soviet street and club culture. After only three collections Vetements was a finalist for both the LVMH Prize and the ANDAM prize.`,
      quote_ru: null,
      quote_en: null,
      quote_author: null,
    },
    {
      period: '2015',
      title_ru: 'Первые показы: Le Dépôt',
      title_en: 'The first runway: Le Dépôt',
      content_ru: `Первый настоящий показ Vetements прошёл в парижском клубе Le Dépôt — заведении, которое никак не ассоциировалось с модными неделями. Vetements стал первой модной маркой, устроившей там показ, и впервые клуб пустил внутрь женщин. Сам выбор места был высказыванием: мода выходит из позолоченных салонов в тёмные пространства городской ночной жизни.

### Язык подиума

Показ в Le Dépôt задал интонацию, которой марка будет держаться несколько лет. Модели — часто не профессиональные манекенщицы, а друзья и люди с улицы. Одежда — огромные худи, пальто с плечами, уходящими далеко за линию тела, длинные рукава, закрывающие ладони, джинсы, собранные из частей других джинсов. Всё это выглядело вызывающе небрежно, но за этой небрежностью стояла точная работа с кроем.

### Деконструкция повседневного

Главный метод Vetements можно описать как деконструкцию повседневного. Марка брала вещи, которые есть у каждого, — толстовку, бомбер, джинсы, футболку с логотипом — и меняла их масштаб, пропорции и контекст. Худи становилось платьем, рукава вырастали до колен, старые джинсы распарывались и сшивались заново. Эта работа продолжала традицию Maison Margiela, но говорила на языке поколения, выросшего на интернете и уличной культуре.

> Vetements не придумывал новые вещи — он заново придумывал отношение к старым.

### Критика и восторг

Реакция была полярной. Одни видели в Vetements самое важное событие моды десятилетия, возвращение смысла и дерзости; другие — ловкую игру, в которой обычная одежда продаётся по ценам высокой моды. Именно эта полярность и сделала марку центральной темой разговоров о моде середины 2010-х: о Vetements спорили все, а значит, его видели все.`,
      content_en: `The first proper runway show took place at Le Dépôt, a Paris club far removed from fashion week. Vetements was the first fashion label to show there, and it was the first time the club let women in. The cast mixed friends and street-cast faces; the clothes — giant hoodies, coats with shoulders far beyond the body, sleeves covering the hands, jeans spliced from other jeans — looked careless but were precisely cut. The method was a deconstruction of the everyday, continuing Margiela's tradition in the language of the internet generation. Reactions split sharply, which made Vetements the fashion topic of the mid-2010s.`,
      quote_ru: null,
      quote_en: null,
      quote_author: null,
    },
    {
      period: '2015–2016',
      title_ru: 'Весна–лето 2016: DHL, «Титаник» и Antwerpen',
      title_en: 'Spring–Summer 2016: DHL, Titanic and Antwerpen',
      content_ru: `Коллекция весна–лето 2016, показанная в Париже осенью 2015 года, превратила Vetements из модного открытия в общекультурное явление. Её главным героем стала самая обыкновенная вещь — жёлтая футболка с красным логотипом службы доставки DHL.

### Футболка за 245 евро

Футболку DHL на подиуме показал Гоша Рубчинский — дизайнер, друг и соратник Демны. Вещь, почти неотличимая от рабочей формы курьера, продавалась примерно за 245 евро. Заголовки задавались вопросом: что это — подрывное высказывание о природе роскоши или способ продать футболку по цене дизайнерского платья? Именно этот вопрос и сделал футболку знаменитой. Она стала символом эпохи, когда ценность вещи определяется не материалом и трудом, а контекстом и идеей.

Пресса с удовольствием рассказывала и обратную сторону истории: один из руководителей самой DHL появился в фотографиях в этой футболке — круг иронии замкнулся.

### «Титаник», «Звёздные войны» и Antwerpen

В той же коллекции были толстовка с изображением Джека и Розы из фильма «Титаник», широкие брюки в духе 1990-х с принтом постера «Звёздных войн» и футболки с надписью Antwerpen — отсылкой к городу, где учился Демна. Всё это были образы массовой культуры, знакомые каждому, — и Vetements превращал их в предметы желания.

> Ирония Vetements работала только потому, что за ней стояла безупречная конструкция.

### Почему это сработало

Успех коллекции объясняли по-разному. Одни говорили о «моде для своих», понятной поколению, выросшему на поп-культуре 1990-х. Другие — о мастерском умении превращать спор в рекламу. Третьи — о реальном качестве вещей: под ироничными принтами скрывались выверенные лекала и хорошие ткани. Как бы то ни было, весна–лето 2016 стала коллекцией, после которой каждый крупный дом задумался, как говорить с новой аудиторией.`,
      content_en: `Spring–Summer 2016, shown in Paris in autumn 2015, turned Vetements into a cultural phenomenon. Its hero was a yellow T-shirt with the red DHL logo, walked by designer Gosha Rubchinskiy and sold for about €245. Headlines asked whether it was subversion or a scam — and that question made it famous. The press even reported a DHL executive wearing it. The collection also featured a hoodie with Jack and Rose from Titanic, wide trousers printed with a Star Wars poster and “Antwerpen” T-shirts — pop culture turned into objects of desire, with precise cutting underneath the irony.`,
      quote_ru: null,
      quote_en: null,
      quote_author: null,
    },
    {
      period: '2015–2019',
      title_ru: 'Демна: Vetements и Balenciaga',
      title_en: 'Demna: Vetements and Balenciaga',
      content_ru: `В 2015 году, когда Vetements было всего около года, Kering назначил Демну художественным директором Balenciaga. Решение было почти беспрецедентным: дизайнер молодой независимой марки получал один из самых знаменитых домов Парижа, основанный Кристобалем Баленсиагой.

### Две марки — один язык

Несколько лет Демна возглавлял обе марки одновременно. Многие приёмы, отработанные в Vetements, — гипертрофированные пропорции, работа с повседневными вещами, ирония по отношению к логотипам — перешли в Balenciaga и там, при поддержке большой корпорации, стали глобальным явлением. В 2016 году на церемонии The Fashion Awards в Лондоне Демна был назван международным дизайнером года в категории прет-а-порте.

### Разделение ролей

Для Vetements эта ситуация была одновременно силой и испытанием. Сила — в огромном внимании: каждый шаг Демны теперь обсуждали вдвойне. Испытание — в вопросе идентичности: если язык Vetements стал языком Balenciaga, что остаётся независимой марке? Ответ братья искали в постоянном изменении формата: коллаборации, отказ от традиционных показов, переезд.

> Vetements дал Демне язык, Balenciaga — масштаб.

### Уход в 2019 году

В 2019 году Демна покинул Vetements, чтобы сосредоточиться на работе в Balenciaga. Для марки, которую многие воспринимали как его личное высказывание, это стало поворотным моментом. Но Vetements не закрылся: компания осталась в руках Гурама Гвасалии, и началась новая, менее очевидная глава её истории.`,
      content_en: `In 2015, barely a year after founding Vetements, Demna was appointed artistic director of Balenciaga by Kering. For several years he led both labels, and many Vetements devices — exaggerated proportions, everyday garments, irony about logos — scaled up at Balenciaga into a global phenomenon. In 2016 he was named International Ready-to-Wear Designer at The Fashion Awards in London. In 2019 he left Vetements to focus on Balenciaga; the company remained with Guram Gvasalia.`,
      quote_ru: null,
      quote_en: null,
      quote_author: null,
    },
    {
      period: '2016',
      title_ru: 'Весна–лето 2017: восемнадцать коллабораций',
      title_en: 'Spring–Summer 2017: eighteen collaborations',
      content_ru: `Летом 2016 года Vetements сделал жест, который до сих пор обсуждают в бизнес-школах моды. Коллекция весна–лето 2017 была показана в парижском универмаге Galeries Lafayette во время Недели высокой моды — не в положенное для прет-а-порте время и не в привычном месте. Но главной новостью стал состав участников: коллекцию сделали вместе с 18 марками.

### Восемнадцать специалистов

Логика была простой и радикальной. Каждой марке поручили то, что она умеет лучше всего. Levi's делал джинсовые вещи. Manolo Blahnik вместе с Демной создал обувь: туфли-слингбэки на низком «котёночном» каблуке, туфли с завязками на щиколотке, ботильоны, ботфорты и эффектные сапоги-забродники до талии. Juicy Couture, символ велюровых костюмов 2000-х, тоже оказался в списке участников. В итоге это была не одна коллекция, а восемнадцать, которые поступали в продажу разными партиями в течение сезона.

### «Эффект Vetements»

Business of Fashion писал о «эффекте Vetements»: коллаборация перестала быть разовой акцией для привлечения внимания и стала способом производства. Марка не пыталась сама сделать идеальные джинсы, кроссовки или туфли — она приглашала тех, кто делает их лучше всех, и добавляла свой контекст. Для многих участников это было возвращением актуальности: старые, почти забытые модой имена снова оказывались в центре внимания.

> Коллаборация в руках Vetements стала не рекламой, а методом.

### Наследие идеи

После весны–лета 2017 коллаборации стали нормой индустрии. Люксовые дома начали работать со спортивными марками, производителями рабочей одежды, культовыми брендами массового рынка. Трудно найти другую коллекцию, которая так быстро изменила бы деловую практику моды.`,
      content_en: `In summer 2016 Vetements showed Spring–Summer 2017 at the Galeries Lafayette department store during couture week, made with 18 brands. Each partner did what it did best: Levi's made denim; with Manolo Blahnik, Demna developed kitten-heel slingbacks, ankle-tie courts, booties, thigh-highs and waist-high waders; Juicy Couture also took part. It was effectively eighteen collections delivered in drops. Business of Fashion wrote about the “Vetements effect”: collaboration became a method of production rather than a publicity stunt, and soon an industry norm.`,
      quote_ru: null,
      quote_en: null,
      quote_author: null,
    },
    {
      period: '2016–2018',
      title_ru: 'Коллаборации как метод',
      title_en: 'Collaboration as method',
      content_ru: `После весны–лета 2017 коллаборации стали для Vetements не исключением, а правилом. Марка продолжала работать с известными массовыми брендами, присваивая их логотипы и превращая их в предметы моды.

### Reebok и DHL

В 2017 году вышли совместные коллекции с Reebok и с DHL. Если футболка 2015 года была ироничной цитатой логотипа курьерской службы, то теперь сама компания стала официальным партнёром. Граница между пародией и сотрудничеством, между присвоением и лицензией размывалась — и именно это размывание было содержанием высказывания.

### Champion и толстовки

Толстовки, сделанные с использованием марки Champion, стали одной из самых узнаваемых вещей Vetements. Простая спортивная одежда американского производителя в контексте парижского коллектива превращалась в объект желания и продавалась по цене дизайнерской вещи.

### Присвоение как жанр

Исследователи моды, например авторы The Fashion Studies Journal, называли этот подход апроприацией: Vetements брал знакомые символы потребительской культуры и наделял их новым значением. Критики спорили, где проходит граница между остроумием и цинизмом. Но сам метод оказался невероятно влиятельным: логотип, вырванный из своего контекста, стал одним из главных инструментов моды конца 2010-х.

> Vetements доказал, что знакомый логотип в новом контексте — тоже форма авторства.`,
      content_en: `After Spring–Summer 2017 collaboration became the rule. In 2017 Vetements released collections with Reebok and with DHL — the courier company now an official partner rather than the subject of a parody. Hoodies made with Champion became signature pieces. Fashion scholars, for example in The Fashion Studies Journal, described the approach as appropriation: familiar consumer symbols recharged with new meaning, a method that became one of the defining tools of late-2010s fashion.`,
      quote_ru: null,
      quote_en: null,
      quote_author: null,
    },
    {
      period: '2017–2018',
      title_ru: 'Цюрих и «NO SHOW»',
      title_en: 'Zurich and the “NO SHOW”',
      content_ru: `В 2017 году Vetements перенёс штаб-квартиру и дизайн-студию из Парижа в Цюрих. Для марки, само название которой было французским, это выглядело почти провокацией.

### Почему Цюрих

Гурам Гвасалия объяснял решение по-деловому: в Швейцарии ниже налоги, а компания «переросла» Париж. Кроме того, он говорил о желании сделать Цюрих модным городом. При этом коллекции продолжали показывать в Париже: переезд касался работы компании, а не её присутствия в модном календаре. С тех пор Vetements описывают как швейцарско-французский модный дом.

### «NO SHOW»

Сезон весна–лето 2018 марка встретила жестом отказа. Вместо традиционного показа в Париже прошла презентация под названием «NO SHOW» на крыше автостоянки. Публике показали фотографии жителей Цюриха, найденных на улицах города, — кастинг без профессиональных моделей, мода, увиденная через обычных людей. Это была одновременно ирония над ритуалом Недели моды и продолжение главной темы марки: одежда принадлежит улице.

### Блошиный рынок в темноте

Для коллекции осень–зима 2018/19 Vetements вернулся к подиуму, но вне официального расписания. Показ прошёл на парижском антикварном рынке, почти в темноте. Старые вещи, накопленные десятилетиями, стали декорацией для коллекции, которая сама строилась на переосмыслении старого.

> Vetements показывал, что модный показ — это тоже материал, который можно деконструировать.`,
      content_en: `In 2017 Vetements moved its headquarters and design studio from Paris to Zurich. Guram Gvasalia cited lower taxes, said the company had outgrown Paris and spoke of making Zurich a fashion city; the collections were still shown in Paris. For Spring–Summer 2018 the label staged a “NO SHOW” on a Paris car-park roof, presenting photographs of street-cast Zurich residents. For Autumn–Winter 2018/19 it returned to the runway off-calendar, at a Paris antiques market, in near darkness.`,
      quote_ru: null,
      quote_en: null,
      quote_author: null,
    },
    {
      period: '2019–2021',
      title_ru: 'После Демны: пустое кресло',
      title_en: 'After Demna: the empty chair',
      content_ru: `Уход Демны в 2019 году поставил перед Vetements главный вопрос: может ли марка, которую воспринимали как авторское высказывание, существовать без автора?

### Пауза

После ухода Демны должность креативного директора Vetements оставалась незанятой больше двух лет. Марку вела команда во главе с Гурамом Гвасалией, совмещавшим роль генерального директора с общим руководством творческим процессом. Сама идея коллектива, заложенная в 2014 году, неожиданно оказалась практической: марка продолжала выпускать коллекции, не опираясь на одно имя.

### VTMNTS

В июле 2021 года появилась новая марка — VTMNTS. Её описывали как одежду для всех полов, глубоко укоренённую в традиционном мужском гардеробе. Проект был связан с Gvasalia Family Foundation, задуманной как экспериментальная и коллективная лаборатория для молодых талантов. Сокращённое название, будто из него «выпали» гласные, подчёркивало родство с Vetements — и одновременно отличие: VTMNTS был спокойнее, строже и ближе к повседневному гардеробу.

> Отсутствие звёздного имени, когда-то бывшее риторикой, стало для Vetements реальностью.`,
      content_en: `After Demna left in 2019 the creative director's post stayed vacant for more than two years, with a team led by Guram Gvasalia running the label — the founding idea of a collective became practical. In July 2021 a new label, VTMNTS, launched: all-gender clothing rooted in traditional menswear, linked to the Gvasalia Family Foundation, conceived as an experimental, collective laboratory for young talent.`,
      quote_ru: null,
      quote_en: null,
      quote_author: null,
    },
    {
      period: '2021 — н. в.',
      title_ru: 'Креативный директор Гурам Гвасалия',
      title_en: 'Creative director Guram Gvasalia',
      content_ru: `В декабре 2021 года Vetements официально объявил: Гурам Гвасалия, сооснователь и генеральный директор, становится креативным директором марки. Должность, пустовавшая с ухода Демны, вновь была занята, а Гурам теперь отвечал и за творческую, и за деловую сторону компании.

### Первые коллекции

Первой коллекцией Гурама в новой роли стала осень–зима 2022, представленная в конце ноября 2021 года. Источники по-разному определяют точку отсчёта: одни считают его креативным директором с этой коллекции, другие — с момента официального объявления в декабре. Первым физическим показом Vetements под его руководством стала коллекция весна–лето 2023, показанная в июле 2022 года.

### Стиль Гурама

Гурам сохранил главные коды марки — оверсайз, иронию, работу с массовыми символами, — но сместил акцент. Его Vetements больше говорит о политике и обществе, чем о внутренних шутках модного мира. Показы стали шумнее и прямее, а вещи с лозунгами — частью публичного высказывания.

### Весна–лето 2026

Показ коллекции весна–лето 2026 в Париже в октябре 2025 года стал одним из самых обсуждаемых в сезоне. Гвасалия открыл его антифашистским заявлением, а среди самых спорных вещей были футболки с перечёркнутыми знаками свастики — символ запрета, а не пропаганды. Пресса описывала показ как политически заряженный, хаотичный и бескомпромиссно бунтарский. Среди моделей были Кара Делевинь и Анок Яи, а также рэпер Йит.

> Под руководством Гурама Vetements превратился из моды об иронии в моду о позиции.`,
      content_en: `In December 2021 Vetements officially named co-founder and CEO Guram Gvasalia its creative director, overseeing both the creative and business sides. His first collection in the role was Autumn–Winter 2022, presented in late November 2021; his first physical show was Spring–Summer 2023 in July 2022. He kept the codes — oversize, irony, mass-culture symbols — while shifting toward politics and society. The Spring–Summer 2026 show in Paris (October 2025) opened with an anti-fascist statement; T-shirts with crossed-out swastikas were among its most debated pieces, and the cast included Cara Delevingne, Anok Yai and rapper Yeat.`,
      quote_ru: null,
      quote_en: null,
      quote_author: null,
    },
    {
      period: '2014 — н. в.',
      title_ru: 'Культовые вещи',
      title_en: 'Iconic pieces',
      content_ru: `За короткую историю Vetements создал несколько вещей, которые стали символами целой эпохи в моде.

### Футболка DHL

Жёлтая футболка с красным логотипом DHL из коллекции весна–лето 2016 — главная вещь марки. Цена около 245 евро за почти точную копию рабочей формы курьера превратила футболку в предмет спора о том, что такое ценность в моде. Позже, в 2017 году, DHL стала официальным партнёром Vetements.

### Толстовка «Титаник»

Худи с Джеком и Розой из «Титаника» (весна–лето 2016) — пример того, как Vetements работал с массовой культурой 1990-х: знакомый всем образ, неожиданный масштаб, ирония без насмешки над зрителем.

### Оверсайз-худи

Огромные толстовки с удлинёнными рукавами, в том числе сделанные с Champion, стали узнаваемым силуэтом марки. Именно они чаще всего ассоциируются с Vetements у широкой публики.

### Переработанные джинсы

Джинсы, собранные из частей других джинсов, а затем джинсовые вещи, сделанные вместе с Levi's для коллекции весна–лето 2017, показали, как марка работает с классикой: разобрать, переставить, собрать заново.

### Сапоги-забродники Manolo Blahnik

Сапоги до талии, созданные вместе с Manolo Blahnik для весны–лета 2017, стали одной из самых эффектных вещей коллаборационной коллекции и символом того, как далеко Vetements готов увести классическую обувную марку от её привычного образа.

> Культовые вещи Vetements почти всегда — переосмысленные обычные вещи.`,
      content_en: `Vetements' icons include the yellow DHL T-shirt (Spring–Summer 2016, about €245; DHL became an official partner in 2017), the Titanic hoodie with Jack and Rose, the oversized hoodies with extra-long sleeves (including pieces made with Champion), jeans spliced from other jeans and the denim made with Levi's for Spring–Summer 2017, and the waist-high waders created with Manolo Blahnik for the same season.`,
      quote_ru: null,
      quote_en: null,
      quote_author: null,
    },
    {
      period: '2015 — н. в.',
      title_ru: 'Споры и критика',
      title_en: 'Controversies and criticism',
      content_ru: `Vetements с самого начала существовал в режиме спора, и критика была неотъемлемой частью его истории.

### Цена

Главный и самый постоянный упрёк — цены. Футболка DHL за 245 евро стала символом вопроса: не продаёт ли марка обычные вещи по ценам высокой моды? Журнал Sleek позже посвятил марке материал с характерным названием о «возмутительно дорогом наследии» Vetements. Для одних эти цены были частью концептуального высказывания о природе роскоши, для других — доказательством того, что ирония стала бизнес-моделью.

### Присвоение

Работа с чужими логотипами и символами вызывала споры о границе между цитатой и копированием. Исследователи моды писали об апроприации как о центральном методе марки; критики спрашивали, кто на самом деле получает выгоду от этой игры — сам Vetements или бренды, логотипы которых он использует.

### Политические заявления

При Гураме Гвасалии марка стала открыто политической. Показ весна–лето 2026 с антифашистским заявлением и футболками с перечёркнутой свастикой вызвал острую дискуссию: часть зрителей увидела в нём смелое высказывание против ненависти, часть — недопустимое использование символа ради эпатажа.

> Vetements никогда не стремился понравиться всем — он стремился быть услышанным.`,
      content_en: `Price has been the most persistent criticism: the €245 DHL T-shirt became shorthand for selling ordinary clothes at luxury prices, and Sleek later wrote about the label's “outrageously expensive legacy”. Appropriation of other brands' logos raised questions about where quotation ends and copying begins. Under Guram Gvasalia the label became openly political: the Spring–Summer 2026 show, with its anti-fascist statement and crossed-out swastika T-shirts, divided audiences.`,
      quote_ru: null,
      quote_en: null,
      quote_author: null,
    },
    {
      period: '2014 — н. в.',
      title_ru: 'Владельцы и устройство компании',
      title_en: 'Ownership and structure',
      content_ru: `В отличие от большинства домов в каталоге Amfibia, Vetements не входит ни в Kering, ни в LVMH, ни в Prada Group. Это независимая компания, созданная братьями Гвасалия.

### Семейная модель

С момента основания генеральным директором был Гурам Гвасалия. После ухода Демны в 2019 году компания полностью осталась в его руках, а с декабря 2021 года он совмещает пост генерального директора с должностью креативного директора. Такая модель — редкость для современной моды, где творческое и деловое руководство обычно разделены между разными людьми и подчиняются крупной группе.

### Швейцарская штаб-квартира

С 2017 года компания базируется в Цюрихе, куда перенесла штаб-квартиру и дизайн-студию. При этом показы по-прежнему проходят в Париже, а сама марка воспринимается как часть парижской модной сцены. Это сочетание — швейцарская компания с парижским голосом — отражено в распространённом определении Vetements как швейцарско-французского дома.

### Семейный фонд

С запуском VTMNTS в 2021 году появилась и связанная с ним Gvasalia Family Foundation — лаборатория для молодых талантов. Она продолжает идею коллективной работы, с которой марка начиналась.

> Независимость позволила Vetements быть непредсказуемым — роскошь, недоступная большинству домов внутри больших групп.`,
      content_en: `Unlike most houses in the Amfibia catalogue, Vetements belongs to none of the big groups. It is an independent company founded by the Gvasalia brothers; Guram has been CEO from the start and, since December 2021, also creative director. Since 2017 it has been based in Zurich while showing in Paris — hence its description as a Swiss-French house. The Gvasalia Family Foundation, linked to VTMNTS, continues the collective idea.`,
      quote_ru: null,
      quote_en: null,
      quote_author: null,
    },
    {
      period: '2014 — н. в.',
      title_ru: 'Влияние на моду и культуру',
      title_en: 'Influence on fashion and culture',
      content_ru: `Немногие марки за столь короткое время изменили моду так заметно, как Vetements.

### Улица в люксе

Vetements стал одним из главных проводников уличной эстетики в мир высокой моды. Толстовки, футболки с логотипами и спортивные вещи, которые раньше считались противоположностью роскоши, вошли в коллекции крупнейших домов. Через Демну этот язык напрямую перешёл в Balenciaga и оттуда — в мейнстрим.

### Новая экономика коллабораций

Коллекция весна–лето 2017 с 18 партнёрами превратила коллаборацию из рекламного хода в производственную модель. После неё совместные проекты люксовых домов со спортивными, рабочими и массовыми марками стали нормой индустрии.

### Коллектив против культа

Риторика дизайнерского коллектива поставила под сомнение культ звёздного креативного директора, господствовавший в моде с 1990-х. Хотя в центре Vetements всегда стояли конкретные люди, сама идея моды как общего дела, а не авторского монолога, оказалась притягательной для нового поколения.

### Мода как разговор

Наконец, Vetements изменил то, как о моде говорят. Его вещи создавались для того, чтобы о них спорили — в прессе, в соцсетях, в разговорах. Футболка DHL доказала, что вещь может быть одновременно одеждой, мемом и манифестом.

> После Vetements мода окончательно перестала стесняться обычных вещей.`,
      content_en: `Vetements carried street aesthetics into high fashion: hoodies, logo T-shirts and sportswear entered the biggest houses, directly through Demna at Balenciaga. Its eighteen-partner Spring–Summer 2017 collection turned collaboration into a production model. Its collective rhetoric questioned the cult of the star creative director, and its clothes were made to be argued about — the DHL T-shirt proved a garment could be clothing, meme and manifesto at once.`,
      quote_ru: null,
      quote_en: null,
      quote_author: null,
    },
    {
      period: '2025–2026',
      title_ru: 'Vetements сегодня',
      title_en: 'Vetements today',
      content_ru: `Сегодня Vetements — независимый швейцарско-французский дом, которым руководит Гурам Гвасалия, одновременно генеральный и креативный директор. Компания базируется в Цюрихе, а коллекции показывает в Париже.

### Последние сезоны

Коллекция весна–лето 2026, показанная в Париже в октябре 2025 года, подтвердила новый курс марки: прямые политические высказывания, шумная постановка, смешанный кастинг из знаменитостей и неожиданных лиц. Показ открылся антифашистским заявлением и стал одним из самых обсуждаемых в сезоне.

### Две линии

Рядом с основной линией существует VTMNTS — более спокойная и строгая марка для всех полов, запущенная в 2021 году и связанная с Gvasalia Family Foundation. Вместе они отражают две стороны Vetements: громкое высказывание и повседневную одежду, которую носят годами.

### Наследие первых лет

Футболка DHL, худи «Титаник», сапоги-забродники Manolo Blahnik и коллекция восемнадцати коллабораций остаются в истории моды как символы середины 2010-х. Многие из этих вещей стали предметами коллекционирования и регулярно появляются на архивных площадках.

> Через десять лет после основания Vetements по-прежнему задаёт моде неудобные вопросы.`,
      content_en: `Today Vetements is an independent Swiss-French house led by Guram Gvasalia as CEO and creative director, based in Zurich and showing in Paris. Its Spring–Summer 2026 show (October 2025) confirmed a politically outspoken course. Alongside the main line runs VTMNTS, the calmer all-gender label launched in 2021. The DHL T-shirt, the Titanic hoodie, the Manolo Blahnik waders and the eighteen-collaboration collection remain symbols of mid-2010s fashion and sought-after archive pieces.`,
      quote_ru: null,
      quote_en: null,
      quote_author: null,
    },
    {
      period: 'Факты',
      title_ru: 'Интересные факты',
      title_en: 'Curious facts',
      content_ru: `### Название

Vetements по-французски значит просто «одежда». Марка выбрала самое обыденное слово модного словаря — и этим выделилась среди фамилий и вымышленных имён.

### Первые женщины в Le Dépôt

Первый показ Vetements прошёл в парижском клубе Le Dépôt, и это был первый раз, когда клуб пустил внутрь женщин.

### Ирония по кругу

Футболку DHL, пародирующую рабочую форму курьеров, в итоге надел один из руководителей самой DHL, а в 2017 году компания стала официальным партнёром марки.

### Экономист из Антверпена

Прежде чем поступить в Королевскую академию изящных искусств в Антверпене, Демна четыре года изучал международную экономику.

### Стилист из Владивостока

Лотта Волкова, стилизовавшая первые показы Vetements, родилась во Владивостоке, училась в Central Saint Martins и переехала в Париж в 2008 году.

### Восемнадцать в одной

Коллекция весна–лето 2017 фактически состояла из восемнадцати коллекций: каждая марка-партнёр делала вещи своей категории, и они поступали в продажу разными партиями.

### Два финала

Всего после трёх коллекций Vetements оказался в финале сразу двух главных премий для молодых дизайнеров — LVMH Prize и ANDAM.`,
      content_en: `“Vetements” simply means “clothes” in French. Its first runway show at Le Dépôt was the first time the club admitted women. A DHL executive was photographed wearing the parody DHL T-shirt, and DHL later became an official partner. Before Antwerp, Demna studied international economics for four years. Stylist Lotta Volkova was born in Vladivostok. Spring–Summer 2017 was effectively eighteen collections, and after only three seasons the label was a finalist for both the LVMH Prize and ANDAM.`,
      quote_ru: null,
      quote_en: null,
      quote_author: null,
    },
  ],
};

// Порядок разделов: исходные 16 разделов + дополнение из vetements/part2.js в хронологическом и тематическом порядке.
const S = base.sections;
export default {
  ...base,
  sections: [
    S[0], S[1], S[2], S[3], p2.fw16, S[4], S[5], p2.collabsDetail, S[6], p2.fw17, p2.windows, S[7], p2.fw18,
    p2.highsnobiety, p2.ss19, p2.ss20, S[8], S[9], p2.vtmnts, p2.anniversary, S[10], S[11], p2.business,
    S[12], S[13], S[14], S[15],
  ],
};
