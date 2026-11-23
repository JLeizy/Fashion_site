// Русские имена слоёв по классам сайта (BEM). '' — блок без собственной группы (содержимое поднимается выше).
(() => {
  const FULL = {
    // каркас
    page: '', 'home': '', container: '', row: '', 'span-2': '', 'hide-mobile': '', ch: '', 'link-u': null, 't-mono': null, 't-muted': null, 't-eyebrow': 'Надзаголовок', 'b-title': null, 'b-accent': null,
    vignette: '', curtain: '', edge: 'Боковая_надпись', 'to-top': 'Кнопка_Наверх',
    header: 'Шапка', header__inner: '', header__left: 'Левая_часть', header__nav: 'Навигация', header__actions: 'Иконки', header__prefs: 'Настройки',
    header__account: 'Кнопка_Профиль', header__burger: 'Кнопка_Меню',
    logo: 'Логотип', logo__text: 'Amfibia', logo__orn: 'Орнамент',
    'lang-switch': 'Язык', dropdown: 'Выпадающий_список', dropdown__toggle: 'Валюта', dropdown__menu: 'Меню_списка', swatch: 'Образец_темы',
    mega: 'Мега-меню', mega__inner: '', mega__col: 'Колонка', mega__brands: 'Список_брендов', mega__preview: 'Превью_бренда', 'mega__preview-media': 'Фото_бренда',
    'mega__preview-body': 'Описание_бренда', 'mega__preview-name': 'Название_бренда', 'mega__preview-desc': 'Описание', mega__cats: 'Категории', mega__promo: 'Подборки',
    'promo-tile': 'Плитка_подборки', 'promo-tile__title': 'Название',
    footer: 'Подвал', footer__ornament: 'Орнамент', footer__newsletter: 'Рассылка', 'footer__newsletter-text': 'Текст_рассылки', 'footer__newsletter-title': 'Заголовок_рассылки',
    footer__grid: 'Колонки_ссылок', footer__col: 'Колонка', footer__title: 'Заголовок_колонки', footer__list: 'Ссылки', footer__bottom: 'Нижняя_строка', 'footer__bottom-mid': 'Права', footer__watermark: 'Водяной_знак',
    newsletter: 'Форма_подписки', newsletter__input: 'Поле_Email', newsletter__btn: 'Кнопка_Подписаться', newsletter__note: 'Примечание',
    divider: 'Разделитель', badge: 'Счётчик', 'badge--accent': null,
    // главная
    hero: 'Первый_экран', hero__media: 'Слайд', hero__stage: 'Фото_слайда', hero__img: 'Фото', hero__shade: 'Затемнение', hero__content: 'Текст_слайда', hero__eyebrow: 'Надзаголовок',
    hero__title: 'Заголовок_слайда', hero__brand: 'Бренд', hero__subtitle: 'Описание', hero__actions: 'Кнопки', hero__controls: 'Управление_слайдером', hero__counter: 'Счётчик_слайдов',
    'hero__counter-sep': 'Шкала', hero__arrows: 'Стрелки', hero__index: 'Список_слайдов', 'hero__index-name': 'Название', hero__scroll: 'Листайте',
    marquee: 'Бегущая_строка', marquee__row: 'Ряд', marquee__track: 'Лента', marquee__item: 'Бренд',
    hcol: 'Новые_коллекции', hcol__pin: '', hcol__head: 'Заголовок_секции', hcol__count: 'Счётчик', hcol__viewport: 'Карусель', hcol__track: 'Лента', hcol__card: 'Карточка_коллекции',
    hcol__n: 'Номер', hcol__media: 'Фото', hcol__info: 'Подпись', hcol__brand: 'Бренд', hcol__name: 'Название', hcol__meta: 'Сезон',
    'home-section': 'Секция', 'home-num': 'Номер_секции', 'home-title': 'Заголовок', 'home-head': 'Заголовок_секции', 'home-head__link': 'Ссылка_Все', 'brands-grid-wrap': '',
    'brands-grid': 'Сетка_брендов', 'brand-tile': 'Плитка_бренда', 'brand-tile__media': 'Фото', 'brand-tile__veil': 'Затемнение', 'brand-tile__num': 'Номер', 'brand-tile__name': 'Название', 'brand-tile__meta': 'Подпись',
    'pp-rail': 'Карусель', 'pp-rail__head': 'Заголовок', 'pp-rail__nav': 'Стрелки', 'home-rail': 'Карусель_товаров', rail: 'Лента', rail__item: '',
    'p-card': 'Карточка_товара', 'p-card__media': 'Фото_товара', 'p-card__labels': 'Метки', 'p-card__actions': 'Действия', 'p-card__action': 'Кнопка', 'p-card__sizes': 'Размеры',
    'p-card__body': 'Описание', 'p-card__brand': 'Бренд', 'p-card__name': 'Название', 'p-card__price': 'Цена', 'p-card__meta': 'Рейтинг_и_цвета',
    label: 'Метка', label__text: 'Текст', 'mm-tag': 'Значок_подлинности', 'color-dot': 'Цвет', stars: 'Звёзды',
    iconic: 'Культовые_вещи', iconic__list: 'Список', iconic__item: 'Вещь', iconic__media: 'Фото', iconic__clip: '', iconic__text: 'Текст', iconic__n: 'Номер', iconic__brand: 'Бренд', iconic__name: 'Название', iconic__desc: 'Описание', iconic__meta: 'Подпись',
    manifest: 'Манифест', manifest__eyebrow: 'Надзаголовок', manifest__text: 'Текст', manifest__hint: 'Подсказка',
    stories: 'Истории_брендов', stories__list: 'Список', stories__float: 'Плавающее_фото', story: 'История', story__link: '', story__year: 'Год', story__name: 'Бренд', story__desc: 'Описание',
    story__founder: 'Основатель', story__go: 'Стрелка', story__n: 'Номер',
    selections: 'Подборки', selections__grid: 'Сетка', sel: 'Подборка', sel__media: 'Фото', sel__n: 'Номер', sel__title: 'Название', sel__text: 'Описание', sel__count: 'Количество',
    perks: 'Преимущества', perks__list: 'Список', perk: 'Преимущество', perk__num: 'Номер', perk__title: 'Заголовок', perk__text: 'Текст',
    // каталог
    'catalog-page': '', 'catalog-hero': 'Заголовок_каталога', 'catalog-hero__bg': 'Фоновая_надпись', 'catalog-hero__row': '', 'catalog-hero__title': 'Заголовок', 'catalog-hero__count': 'Найдено',
    breadcrumbs: 'Хлебные_крошки', breadcrumbs__list: '',
    catalog: 'Каталог', catalog__main: 'Выдача', catalog__toolbar: 'Панель_сортировки', catalog__tools: 'Инструменты', catalog__sort: 'Сортировка', catalog__view: 'Вид', catalog__grid: 'Сетка_товаров', catalog__foot: 'Низ_выдачи',
    filters: 'Фильтры', filters__head: 'Заголовок', filters__title: 'Фильтры', filters__body: '', filter: 'Фильтр', filter__head: 'Заголовок_фильтра', filter__chevron: 'Стрелка', filter__body: 'Варианты',
    filter__opt: 'Вариант', filter__label: 'Подпись', filter__search: 'Поиск_бренда', filter__list: 'Список', filter__sub: 'Подкатегории', filter__switch: 'Переключатель',
    tree: 'Дерево_категорий', tree__item: 'Категория', tree__row: '', tree__toggle: 'Раскрыть',
    check: 'Чекбокс', check__box: 'Квадрат', check__count: 'Количество', input: 'Поле', 'price-filter': 'Фильтр_цены', 'price-filter__inputs': 'Поля_от_до', range: 'Ползунок', range__fill: 'Заполнение',
    'size-grid': 'Сетка_размеров', 'size-btn__dot': 'Точка', swatches: 'Цвета', 'swatch-btn__n': 'Количество', chips: 'Чипы', switch: 'Переключатель', switch__track: 'Дорожка',
    select: 'Список', seg: 'Переключатель', status: 'Статус', pagination: 'Пагинация',
    // бренд
    'brand-page': '', bh: 'Первый_экран_бренда', bh__media: 'Фото', bh__texture: 'Текстура', bh__shade: 'Затемнение', bh__inner: '', bh__crumbs: 'Хлебные_крошки', bh__eyebrow: 'Надзаголовок',
    bh__name: 'Название_бренда', bh__founder: 'Основатель', bh__stats: 'Цифры', bh__actions: 'Кнопки', bh__sig: 'Подпись', bh__side: 'Боковая_колонка', 'b-texture': 'Текстура',
    bsec: 'Секция', bsec__num: 'Номер', bsec__head: 'Заголовок_секции', bsec__title: 'Заголовок', babout: 'О_бренде', babout__grid: '', babout__text: 'Текст', babout__drop: 'Буквица',
    lineage: 'Креативные_директора', lineage__title: 'Заголовок', lineage__list: 'Список', lineage__item: 'Директор', lineage__years: 'Годы', lineage__dot: 'Точка', lineage__photo: 'Фото',
    lineage__name: 'Имя', lineage__initials: 'Инициалы', bcols: 'Коллекции', bcols__tabs: 'Вкладки', bcols__new: 'Новое', bcols__panel: 'Панель', bcols__grid: 'Сетка',
    tabs: 'Вкладки', bcol: 'Коллекция', bcol__media: 'Фото', bcol__badge: 'Бейдж', bcol__info: 'Подпись', bcol__n: 'Номер', bcol__name: 'Название', bcol__meta: 'Сезон', bcol__actions: 'Кнопки',
    bcat: 'Категория', bcat__count: 'Количество', bnext: 'Следующий_бренд', bnext__name: 'Название',
    // товар
    'product-page': '', 'pp-bg': 'Фон_страницы', 'pp-top': 'Верх_страницы', pp: 'Товар', 'pp-gallery': 'Галерея', 'pp-gallery__thumbs': 'Миниатюры', 'pp-gallery__stage': 'Главное_фото',
    'pp-gallery__main': '', 'pp-gallery__track': '', 'pp-gallery__slide': 'Слайд', 'pp-gallery__labels': 'Метки', 'pp-gallery__expand': 'Кнопка_Увеличить', 'pp-gallery__hint': 'Подсказка',
    'pp-thumb': 'Миниатюра', 'pp-info': 'Информация', 'pp-info__inner': '', 'pp-brand': 'Бренд', 'pp-name': 'Название_товара', 'pp-meta': 'Артикул_и_рейтинг', 'pp-meta__rating': 'Рейтинг',
    'pp-price': 'Цена', 'pp-price__now': 'Цена_сейчас', 'pp-price__alt': 'В_другой_валюте', 'pp-block': 'Блок', 'pp-block__head': 'Заголовок_блока', 'pp-link': 'Ссылка',
    'pp-sizes': 'Размеры', 'pp-stock': 'Наличие', 'pp-stock__dot': 'Точка', 'pp-buy': 'Покупка', qty: 'Количество', 'pp-qty': 'Количество', 'pp-add': 'Кнопка_В_корзину',
    'pp-icon': null, 'pp-perks': 'Преимущества', 'pp-auth': 'Войдите', 'pp-auth__title': 'Заголовок', 'pp-auth__text': 'Текст', accordion: 'Аккордеон', accordion__item: 'Раздел',
    accordion__head: 'Заголовок_раздела', accordion__icon: 'Плюс', accordion__body: 'Содержимое', accordion__content: '', 'pp-acc': 'Подробности', 'pp-seller': 'Продавец', 'pp-seller__row': '',
    'pp-seller__avatar': 'Аватар', 'pp-seller__name': 'Имя_продавца', 'pp-seller__badge': 'Бейдж', 'pp-seller__meta': 'Подпись', avatar: 'Аватар', 'pp-section': 'Секция',
    'pp-section__head': 'Заголовок_секции', 'pp-section__num': 'Номер', 'pp-section__title': 'Заголовок', 'pp-specs-wrap': '', 'pp-specs': 'Характеристики', 'pp-specs__list': 'Список', 'pp-spec': 'Характеристика',
    'pp-tag': 'Бирка', 'pp-tag__face': 'Лицевая_сторона', 'pp-tag__deco': 'Декор', 'pp-tag__meander': 'Меандр', 'pp-tag__line': 'Линия', 'pp-tag__brand': 'Бренд', 'pp-tag__comp': 'Состав', 'pp-tag__sku': 'Артикул',
    'pp-tag__hint': 'Подсказка', 'pp-tag__plus': 'Плюс', 'pp-reviews': 'Отзывы', 'pp-reviews__grid': '', 'pp-reviews__summary': 'Сводка', 'pp-reviews__avg': 'Средняя_оценка', 'pp-reviews__main': 'Список_отзывов',
    'pp-reviews__toolbar': 'Сортировка', 'pp-reviews__list': '', rbars: 'Распределение_оценок', rbar: 'Строка', rbar__label: 'Звёзд', rbar__track: 'Шкала', rbar__fill: 'Заполнение', rbar__n: 'Количество',
    review: 'Отзыв', review__head: 'Шапка_отзыва', review__who: 'Автор', review__author: 'Имя', review__date: 'Дата', review__text: 'Текст', review__meta: 'Подпись', 'pp-review-form': 'Форма_отзыва', 'pp-review-form__note': 'Примечание',
    // истории
    'histories-page': '', 'hl-head': 'Заголовок_страницы', 'hl-head__title': 'Заголовок', 'hl-head__lead': 'Вводный_текст', 'hl-list': 'Список_историй', 'hl-item': 'История',
    'hl-link': '', 'hl-link__n': 'Номер', 'hl-link__year': 'Год', 'hl-link__name': 'Бренд', 'hl-link__meta': 'Подпись', 'hl-link__desc': 'Описание', 'hl-link__stats': 'Цифры', 'hl-link__img': 'Фото', 'hl-link__go': 'Стрелка',
    'history-page': '', 'hs-progress': 'Прогресс_чтения', 'hs-hero': 'Первый_экран', 'hs-hero__media': 'Фото', 'hs-hero__texture': 'Текстура', 'hs-hero__shade': 'Затемнение', 'hs-hero__inner': '',
    'hs-hero__eyebrow': 'Надзаголовок', 'hs-hero__name': 'Бренд', 'hs-hero__meta': 'Подпись', 'hs-hero__year': 'Год', 'hs-hero__facts': 'Факты', 'hs-hero__lead': 'Вводный_текст', 'hs-hero__down': 'Вниз',
    'hs-body': 'Текст_истории', 'hs-toc': 'Оглавление', 'hs-toc__time': 'Время_чтения', 'hs-toc__list': 'Пункты', 'hs-article': 'Статья', 'hs-sec': 'Раздел', 'hs-sec__head': 'Заголовок_раздела', 'hs-sec__n': 'Номер',
    'hs-sec__period': 'Период', 'hs-sec__title': 'Заголовок', 'hs-sec__img': 'Иллюстрация', 'hs-text': 'Абзац', 'hs-drop': 'Буквица', 'hs-sub': 'Подзаголовок', 'hs-aside': 'Врезка', 'hs-quote': 'Цитата',
    'hs-timeline': 'Хронология', tl2: 'Хронология', tl2__decade: 'Десятилетие', tl2__event: 'Событие', tl2__dot: 'Точка', tl2__year: 'Год', tl2__body: 'Текст', tl2__title: 'Заголовок',
    'hs-dirs': 'Креативные_директора', 'hs-dir': 'Директор', 'hs-dir__photo': 'Фото', 'hs-dir__n': 'Номер', 'hs-dir__years': 'Годы', 'hs-dir__name': 'Имя', 'hs-dir__text': 'Текст', 'hs-dir__cols': '', 'hs-dir__initials': 'Инициалы',
    'hs-iconic': 'Культовые_вещи', 'hs-end': 'Финал', 'hs-end__cat': 'Ссылка_Каталог', 'hs-end__title': 'Заголовок', 'hs-end__next': 'Следующая_история',
    // магазинные страницы
    'shop-page': '', 'compare-page': '', 'wishlist-page': '', 'cart-page': '', 'checkout-page': '', 'tracking-page': '', 'info-page': '', 'account-page': '',
    'shop-hero': 'Заголовок_страницы', 'shop-hero__bg': 'Фоновая_надпись', 'shop-hero__row': '', 'shop-hero__title': 'Заголовок', 'shop-hero__tools': 'Инструменты', 'shop-hero__count': 'Количество',
    'shop-body': 'Содержимое', cmp: 'Таблица_сравнения', 'empty-wide': 'Пустое_состояние', 'empty-wide__main': '', 'empty-wide__title': 'Заголовок', 'empty-wide__links': 'Ссылки', empty: 'Пустое_состояние', empty__text: 'Текст',
    'empty-recs': 'Рекомендации', 'empty-recs__head': 'Заголовок', 'empty-recs__title': 'Заголовок', 'empty-recs__grid': 'Сетка',
    trk: 'Отслеживание', trk__form: 'Форма', trk__lead: 'Вводный_текст', trk__row: '', trk__input: 'Поле_Трек-номер', trk__guide: 'Справка', 'trk-guide': 'Справка', 'trk-guide__example': 'Пример',
    'trk-guide__h': 'Заголовок', 'trk-guide__tl': 'Шкала', 'trk-guide__statuses': 'Статусы', 'trk-guide__list': 'Список', 'trk-guide__faq': 'Вопросы', tl: 'Шкала_статусов', tl__step: 'Статус', tl__dot: 'Точка',
    tl__body: '', tl__title: 'Название', tl__time: 'Время', 'trk-faq': 'Вопросы',
    'ip-head': 'Заголовок_страницы', 'ip-head__main': '', 'ip-head__title': 'Заголовок', 'ip-head__side': 'Боковая_часть', 'ip-head__lead': 'Вводный_текст', 'ip-layout': 'Содержимое', 'ip-aside': 'Боковая_колонка',
    'ip-toc': 'Оглавление', 'ip-help': 'Помощь', 'ip-help__text': 'Текст', 'ip-help__line': 'Телефон', 'ip-help__hours': 'Часы_работы', 'ip-body': 'Текст_страницы', 'ip-sec': 'Раздел', 'ip-sec__head': 'Заголовок_раздела',
    'ip-sec__n': 'Номер', 'ip-sec__h': 'Заголовок', 'ip-methods': 'Способы', 'ip-method': 'Способ', 'ip-method__icon': 'Иконка', notice: 'Уведомление', 'ip-blocks': 'Блоки', 'ip-block': 'Блок',
    'ip-block__n': 'Номер', 'ip-block__h': 'Заголовок', 'ip-block__body': 'Текст', 'ip-list': 'Список', 'ip-more': 'Ещё', 'ip-contacts': 'Контакты', 'ip-contact': 'Контакт', 'ip-contact__label': 'Подпись', 'ip-contact__value': 'Значение',
    'error-page': 'Ошибка', 'error-page__code': 'Код_ошибки', 'error-page__body': 'Текст', 'error-page__num': 'Номер', 'error-page__title': 'Заголовок', 'error-page__text': 'Описание', 'error-page__actions': 'Кнопки', 'error-page__links': 'Ссылки',
    // вход
    auth: 'Вход', auth__canvas: 'Фон_анимация', auth__art: 'Иллюстрация', auth__title: 'Заголовок', auth__lead: 'Вводный_текст', auth__perks: 'Преимущества', auth__vertical: 'Вертикальная_надпись',
    auth__panel: 'Панель_формы', auth__stage: '', auth__tabs: 'Вкладки', auth__tab: null, auth__heading: 'Заголовок_формы', auth__sub: 'Подзаголовок', auth__form: 'Форма', auth__small: 'Мелкий_текст',
    auth__switch: 'Переключение', auth__terms: 'Условия', 'auth-view': '', flip: 'Карточка_формы', flip__inner: '', flip__face: 'Сторона', field: 'Поле', field__label: 'Подпись', field__addon: 'Кнопка_в_поле',
    field__hint: 'Подсказка', field__error: 'Ошибка', 'form-grid': 'Поля', phone: 'Телефон', phone__country: 'Код_страны', phone__input: 'Поле_номера', strength: 'Надёжность_пароля', strength__bars: 'Шкала',
    strength__rules: 'Правила', 'auth-demo': 'Демо-аккаунты', 'auth-demo__note': 'Примечание', 'auth-demo__grid': 'Роли',
    'compare-bar': 'Панель_сравнения', 'compare-bar__items': 'Товары', 'compare-bar__count': 'Количество', notif: 'Уведомления', notif__panel: 'Панель_уведомлений', notif__head: 'Заголовок', notif__list: 'Список', notif__all: 'Ссылка_Все',
    // кабинет
    acc: 'Кабинет', acc__side: 'Боковое_меню', acc__main: 'Основная_часть', acc__head: 'Заголовок_раздела', acc__title: 'Заголовок', acc__view: 'Раздел', 'acc-profile': 'Профиль', 'acc-profile__avatar': 'Аватар',
    'acc-profile__avatar-edit': 'Сменить_фото', 'acc-profile__info': '', 'acc-profile__name': 'Имя', 'acc-profile__role': 'Роль', 'acc-profile__since': 'С_нами_с', 'acc-nav': 'Меню_кабинета',
    'acc-nav__link': null, 'acc-nav__badge': 'Счётчик', 'acc-nav__logout': 'Кнопка_Выйти', 'acc-stats': 'Статистика', 'acc-stats__n': 'Число', 'acc-stats__v': 'Значение', 'acc-stats__k': 'Подпись',
    'acc-block': 'Блок', 'acc-block__head': 'Заголовок_блока', olist: 'Список_заказов', orow: 'Заказ', orow__link: '', orow__thumbs: 'Миниатюры', orow__main: '', orow__num: 'Номер_заказа', orow__meta: 'Дата_и_состав',
    orow__status: 'Статус', orow__sum: 'Сумма', orow__go: 'Стрелка', 'acc-quick': 'Быстрые_действия', 'acc-filter': 'Фильтр', 'acc-pager': 'Пагинация', 'acc-note': 'Примечание',
    'wish-grid': 'Сетка_избранного',
    cart: 'Корзина', cart__list: 'Список_товаров', cart__free: 'Бесплатная_доставка', 'cart__free-text': 'Текст', 'cart__free-bar': 'Шкала', cart__items: '', cart__tools: 'Инструменты', cart__clear: 'Кнопка_Очистить',
    cart__summary: 'Итоги', citem: 'Товар_в_корзине', citem__media: 'Фото', citem__body: 'Описание', citem__brand: 'Бренд', citem__name: 'Название', citem__sku: 'Артикул', citem__opts: 'Параметры',
    'citem__size-one': 'Размер', citem__qty: 'Количество', citem__warn: 'Предупреждение', citem__side: 'Цена_и_удаление', citem__total: 'Сумма', citem__remove: 'Кнопка_Удалить', citem__size: 'Размер',
    summary: 'Итоги_заказа', summary__title: 'Заголовок', summary__rows: 'Строки', summary__total: 'Итого', summary__note: 'Примечание', summary__checkout: 'Кнопка_Оформить', summary__perks: 'Преимущества',
    promo: 'Промокод', promo__row: '', promo__input: 'Поле_промокода', 'shop-rail': 'Рекомендации',
    steps: 'Шаги', steps__item: 'Шаг', steps__n: 'Номер', co: 'Оформление', co__steps: 'Шаги_формы', co__summary: 'Ваш_заказ', 'co-step': 'Шаг', 'co-step__title': 'Заголовок_шага', 'co-step__lead': 'Подсказка',
    'co-step__nav': 'Кнопки', 'addr-list': 'Адреса', opt: 'Вариант', opt__mark: 'Отметка', opt__body: '', opt__title: 'Название', opt__badge: 'Бейдж', opt__text: 'Описание', opt__meta: 'Подпись',
    opt__icon: 'Иконка', opt__price: 'Цена', addr: 'Адрес', opts: 'Варианты', textarea: 'Поле_комментария', 'co-place': 'Оформить_заказ', 'co-items': 'Товары', 'co-item': 'Товар', 'co-item__img': 'Фото',
    'co-item__body': '', 'co-item__brand': 'Бренд', 'co-item__name': 'Название', 'co-item__size': 'Размер', 'co-item__price': 'Цена',
    // оверлеи
    search: 'Поиск', search__backdrop: 'Затемнение', search__panel: 'Панель_поиска', search__top: 'Строка_поиска', search__form: 'Форма', search__input: 'Поле_поиска', search__icon: 'Иконка_поиск',
    search__close: 'Кнопка_Закрыть', search__body: '', search__intro: 'Подсказки', search__block: 'Блок', search__results: 'Результаты', search__hint: 'Подсказка', search__spinner: 'Загрузка',
    drawer: 'Мини-корзина', drawer__backdrop: 'Затемнение', drawer__panel: 'Панель', drawer__head: 'Заголовок', drawer__title: 'Корзина', drawer__body: 'Товары', drawer__foot: 'Итог', drawer__note: 'Примечание', drawer__total: 'Итого',
    preloader: 'Заставка', preloader__logo: 'Логотип', preloader__word: 'Логотип_контур', preloader__line: 'Линия_загрузки', preloader__meta: 'Подпись', preloader__text: 'Текст',
    modal: 'Модальное_окно', modal__backdrop: 'Затемнение', modal__panel: 'Окно', modal__dialog: 'Окно', modal__head: 'Заголовок', modal__title: 'Заголовок', modal__body: 'Содержимое', modal__close: 'Кнопка_Закрыть', modal__foot: 'Кнопки',
    qv: 'Быстрый_просмотр', skeleton: 'Загрузка',
    // админка и сотрудники
    adm: 'Админ-панель', 'adm-side': 'Боковое_меню', 'adm-logo': 'Логотип', 'adm-logo__word': 'Amfibia', 'adm-logo__sub': 'Подпись', 'adm-nav': 'Меню', 'adm-me': 'Профиль', 'adm-main': 'Основная_часть',
    'adm-top': 'Верхняя_панель', 'adm-top__title': 'Заголовок', 'adm-top__h': 'Название_раздела', 'adm-top__tools': 'Инструменты', 'adm-cur': 'Валюта', 'adm-themes': 'Темы', 'adm-view': 'Раздел', 'adm-scrim': '',
    'ed-sec': 'Раздел_формы', 'ed-sec__head': 'Заголовок_раздела', 'ed-sec__n': 'Номер', 'ed-photos': 'Фото_товара', 'ed-sizes': 'Размеры',
  };

  // Общие окончания элементов BEM (если нет точного ключа)
  const ELEM = {
    inner: '', media: 'Фото', img: 'Фото', image: 'Фото', photo: 'Фото', body: 'Содержимое', title: 'Заголовок', name: 'Название', brand: 'Бренд', price: 'Цена', meta: 'Подпись',
    text: 'Текст', desc: 'Описание', actions: 'Кнопки', action: 'Кнопка', head: 'Заголовок_блока', list: 'Список', item: 'Пункт', link: 'Ссылка', n: 'Номер', num: 'Номер', count: 'Количество',
    label: 'Подпись', icon: 'Иконка', grid: 'Сетка', col: 'Колонка', row: 'Строка', eyebrow: 'Надзаголовок', subtitle: 'Подзаголовок', lead: 'Вводный_текст', note: 'Примечание', badge: 'Бейдж',
    labels: 'Метки', info: 'Описание', year: 'Год', years: 'Годы', go: 'Стрелка', dot: 'Точка', track: 'Лента', thumbs: 'Миниатюры', main: 'Основная_часть', side: 'Боковая_колонка',
    aside: 'Боковая_колонка', form: 'Форма', input: 'Поле', btn: 'Кнопка', bottom: 'Нижняя_строка', top: 'Верх', stats: 'Цифры', tabs: 'Вкладки', tab: 'Вкладка', panel: 'Панель', content: 'Содержимое',
    shade: 'Затемнение', veil: 'Затемнение', bg: 'Фон_блока', toggle: 'Переключатель', menu: 'Меню', nav: 'Навигация', controls: 'Управление', value: 'Значение', status: 'Статус', sum: 'Сумма', total: 'Итого',
    date: 'Дата', time: 'Время', hint: 'Подсказка', error: 'Ошибка', table: 'Таблица', chart: 'График', card: 'Карточка', cards: 'Карточки', filters: 'Фильтры', toolbar: 'Панель_инструментов', foot: 'Низ',
    kpi: 'Показатель', kpis: 'Показатели', tools: 'Инструменты', search: 'Поиск', select: 'Список', avatar: 'Аватар', role: 'Роль', email: 'Email', id: 'Номер', cell: 'Ячейка', th: 'Заголовок_колонки',
  };

  const clean = (s, max = 32) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, max).trim().replace(/[«»"'.,:;!?()\[\]{}·•→←↗⌄…\/\\|]+/g, '').trim().replace(/\s+/g, '_');
  const labelOf = (el) => clean(el.getAttribute('aria-label') || el.getAttribute('title') || el.innerText || el.value || '');

  function interactive(el) {
    const cl = el.classList;
    const tag = el.tagName.toLowerCase();
    if (cl.contains('icon-btn')) return 'Кнопка_' + (labelOf(el) || 'иконка');
    if (cl.contains('btn')) return 'Кнопка_' + (labelOf(el) || 'кнопка');
    if (cl.contains('nav-link')) return 'Пункт_' + labelOf(el);
    if (cl.contains('chip')) return 'Чип_' + labelOf(el);
    if (cl.contains('tab') || cl.contains('auth__tab')) return 'Вкладка_' + labelOf(el);
    if (cl.contains('size-btn')) return 'Размер_' + labelOf(el);
    if (cl.contains('check') && tag === 'label') { const t = [...el.childNodes].map((c) => (c.nodeType === 3 ? c.data : c.classList && c.classList.contains('check__count') ? '' : c.innerText || '')).join(' '); return 'Чекбокс_' + (clean(t, 26) || 'вариант'); }
    if (cl.contains('swatch-btn')) return 'Цвет_' + labelOf(el);
    if (cl.contains('acc-nav__link')) return 'Пункт_' + clean(el.innerText);
    if (cl.contains('pp-icon')) return 'Кнопка_' + (labelOf(el) || 'иконка');
    if (cl.contains('pagination') || cl.contains('seg')) return null;
    return null;
  }

  function fieldName(el) {
    const id = el.id;
    let lab = id && document.querySelector(`label[for="${CSS.escape(id)}"]`);
    let t = lab ? lab.innerText : el.getAttribute('aria-label') || el.placeholder || el.name || '';
    return 'Поле_' + (clean(t, 28) || 'ввода');
  }

  window.__autoName = function (el) {
    const tag = el.tagName.toLowerCase();
    const it = interactive(el);
    if (it) return it;
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      if (el.type === 'checkbox') return 'Чекбокс';
      if (el.type === 'radio') return 'Переключатель';
      if (el.type === 'range') return 'Ползунок';
      return fieldName(el);
    }
    for (const c of el.classList) {
      if (c.includes('--') || /^(is-|has-|js-)/.test(c)) continue;
      if (Object.prototype.hasOwnProperty.call(FULL, c)) {
        const v = FULL[c];
        if (v === null) continue;
        return v || null;
      }
    }
    for (const c of el.classList) {
      if (c.includes('--')) continue;
      const m = c.match(/__([\w-]+)$/);
      if (m && Object.prototype.hasOwnProperty.call(ELEM, m[1])) return ELEM[m[1]] || null;
    }
    if (tag === 'header') return 'Шапка_блока';
    if (tag === 'footer') return 'Низ_блока';
    if (tag === 'nav') return 'Навигация';
    if (tag === 'form') return 'Форма';
    if (tag === 'table') return 'Таблица';
    if (tag === 'thead') return 'Заголовки_таблицы';
    if (tag === 'tbody') return '';
    if (tag === 'tr') return 'Строка';
    if (tag === 'th') return 'Колонка';
    if (tag === 'fieldset') return 'Группа_полей';
    if (tag === 'label' && el.querySelector('input[type=checkbox],input[type=radio]')) return 'Вариант_' + clean(el.innerText, 24);
    if (tag === 'button') return 'Кнопка_' + (labelOf(el) || 'кнопка');
    if (tag === 'a' && el.innerText.trim() && el.innerText.trim().length < 40) return 'Ссылка_' + clean(el.innerText);
    if (tag === 'h1') return 'Заголовок_h1';
    if (tag === 'h2') return 'Заголовок_h2';
    if (tag === 'h3') return 'Заголовок_h3';
    if (tag === 'section') return 'Секция';
    if (tag === 'aside') return 'Боковая_колонка';
    if (tag === 'li' || tag === 'article') {
      const cs = getComputedStyle(el);
      if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || parseFloat(cs.borderBottomWidth) || el.children.length > 1) return tag === 'li' ? 'Пункт' : 'Карточка';
    }
    return null;
  };
})();
