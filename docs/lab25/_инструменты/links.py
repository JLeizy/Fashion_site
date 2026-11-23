# Переходы прототипа: для каждого экрана — какие слои (кнопки, ссылки, карточки) куда ведут.
# Читает все SVG, проверяет, что слой-триггер действительно есть в экране, пишет:
#   6_Для_Figma/Переходы.json, Переходы.csv и собирает плагин Figma (manifest.json + code.js)
import json, os, re, sys, xml.etree.ElementTree as ET, collections

DOCS = '/home/user/Fashion_site/docs/lab25'
PROTO = os.path.join(DOCS, '3_Прототип')
OUT = os.path.join(DOCS, '6_Для_Figma')
NS = '{http://www.w3.org/2000/svg}'

frames = {}  # имя → {folder, ids:list, texts:{id: текст внутри группы}}
for folder in sorted(os.listdir(PROTO)):
    for f in sorted(os.listdir(os.path.join(PROTO, folder))):
        if not f.endswith('.svg'): continue
        name = f[:-4]
        root = ET.parse(os.path.join(PROTO, folder, f)).getroot()
        ids, texts = [], {}
        def walk(el, path):
            i = el.get('id')
            if i: ids.append(i)
            for ch in el:
                walk(ch, path)
        walk(root, [])
        # текст внутри именованных групп (для карточек брендов, историй, коллекций)
        for g in root.iter(NS + 'g'):
            gid = g.get('id')
            if gid and re.match(r'^(Плитка_бренда|История|Карточка_коллекции|Вещь|Бренд|Экран)_?', gid):
                texts[gid] = ' '.join(t.strip() for t in g.itertext() if t.strip())[:200]
        frames[name] = {'folder': folder, 'ids': ids, 'set': set(ids), 'texts': texts}

def find(part):
    c = [n for n in frames if part in n]
    if len(c) != 1:
        raise SystemExit(f'кадр «{part}»: найдено {c}')
    return c[0]
def opt(part):
    c = [n for n in frames if part in n]
    return c[0] if len(c) == 1 else None

H = dict(home='01_Главная_1920', catalog='02_Каталог_1920', catf=find('Каталог_фильтр'), product=find('04_Товар'), hist=find('05_Истории_брендов'),
         cmp0=find('Сравнение_пустое'), cmp=find('07_Сравнение_1920'), empty=find('Каталог_ничего'),
         cart=find('01_Корзина_1920'), cart0=find('Корзина_пустая'), co1=find('шаг1'), co2=find('шаг2'), co3=find('шаг3'), co4=find('шаг4'), co5=find('шаг5'),
         done=find('Заказ_оформлен'), trk=find('Отслеживание_заказа'), trk2=find('Отслеживание_результат'),
         login=find('01_Вход_1920'), loginErr=find('Вход_ошибка'), reg=find('03_Регистрация'), code=find('Подтверждение_почты'), forgot=find('Восстановление_пароля'), reset=find('Новый_пароль'),
         acc=find('01_Обзор'), orders=find('02_Мои_заказы'), order=find('03_Заказ_подробно'), returns=find('04_Возвраты'), addr=find('05_Адреса'), notif=find('06_Уведомления'),
         wish=find('07_Избранное'), viewed=find('08_Просмотренные'), reviews=find('09_Мои_отзывы'), support=find('10_Поддержка_1920'), seller=find('11_Стать_продавцом'), settings=find('12_Настройки'),
         cancelM=find('Отмена_заказа_окно'), returnM=find('Оформление_возврата_окно'), addrM=find('Новый_адрес_окно'), addrDel=find('Удаление_адреса'), ticket=find('17_Обращение_переписка'), wish0=find('Избранное_пустое'),
         shop=find('01_Продавец_Мой_магазин'), shopOrders=find('02_Продавец_Заказы'), shopStats=find('03_Продавец_Статистика'), shopNew=find('04_Продавец_Новый_товар'), shopEdit=find('05_Продавец_Редактирование'),
         stock=find('06_Склад_Остатки'), courier=find('07_Курьер_Доставки'), desk=find('08_Поддержка_Обращения'), deskRet=find('09_Поддержка_Возвраты'), shopRev=find('10_Продавец_Отзывы'), shopDel=find('11_Продавец_Удаление'),
         queue=find('12_Склад_Очередь'), stockRet=find('13_Склад_Приёмка_возвратов'), moves=find('14_Склад_Журнал'), income=find('15_Склад_Приёмка_товара'), done2=find('16_Курьер_Доставленные'), route=find('17_Курьер_Маршрутный'),
         deskTicket=find('18_Поддержка_Обращение'), deskOrders=find('19_Поддержка_Заказы'), deskOrder=find('20_Поддержка_Заказ_клиента'), deskDecide=find('21_Поддержка_Решение'),
         dash=find('01_Дашборд'), brandAdm=find('17_Бренд_подробно'), brandEdit=find('18_Бренд_редактирование'), userAdm=find('19_Пользователь_подробно'), userEdit=find('20_Пользователь_редактирование'),
         promoNew=find('21_Промокод_новый'), delConfirm=find('22_Удаление_подтверждение'),
         pre=find('Заставка'), megaB=find('Мега-меню_Бренды'), megaC=find('Мега-меню_Каталог'), search=find('Поиск_подсказки'), searchR=find('Поиск_результаты'), searchE=find('Поиск_ничего'),
         theme=find('Выбор_темы'), cur=find('Выбор_валюты'), quick=find('Быстрый_просмотр'), sizes=find('09_Таблица_размеров'), cmpBar=find('Сравнение_панель'),
         mini=find('Мини-корзина'), notifP=find('16_Уведомления'), added=find('Товар_добавлен'), gallery=find('Галерея_на_весь'), prompt=find('Окно_Войдите'), look=find('Лукбук'),
         cartClear=find('Очистить_корзину'), cmpClear=find('Очистить_сравнение'),
         i_del=find('Доставка_и_оплата'), i_ret=find('02_Возврат_и_обмен'), i_size=find('07_Информационные_страницы') if False else find('03_Таблица_размеров'), i_about=find('04_О_нас'), i_cont=find('05_Контакты'), i_priv=find('06_Политика'))
brands = sorted(n for n in frames if frames[n]['folder'].startswith('10_'))
stories = sorted(n for n in frames if frames[n]['folder'].startswith('11_'))
admin = sorted(n for n in frames if frames[n]['folder'].startswith('06_'))
norm = lambda s: re.sub(r'[^a-zа-яё0-9]', '', s.lower().replace('é', 'e'))
def brand_by_text(text, pool):
    t = norm(text)
    best = None
    for n in pool:
        b = n.split('_', 2)[2].rsplit('_1920', 1)[0]
        if norm(b) and norm(b) in t:
            if not best or len(b) > len(best[1]): best = (n, b)
    return best[0] if best else None

links = []
seen = set()
def add(src, to, trigger=None, regex=None, anim='dissolve', label='', limit=None, action='NAVIGATE'):
    if src not in frames or (action != 'BACK' and (not to or to not in frames)) or src == to: return False
    ids = frames[src]['ids']
    if trigger is not None and trigger not in frames[src]['set']:
        alt = next((i for i in ids if i.lower() == trigger.lower()), None)
        if not alt: return False
        trigger = alt
    if regex is not None:
        if not any(re.search(regex, i, re.I) for i in ids): return False
    key = (src, trigger or regex, to, action)
    if key in seen: return False
    seen.add(key)
    L = {'from': src, 'to': to, 'action': action, 'anim': anim, 'label': label}
    if trigger is not None: L['trigger'] = trigger
    else: L['regex'] = regex; L['limit'] = limit or 60
    links.append(L)
    return True

overlay = lambda n: frames[n]['folder'].startswith('09_') or re.search(r'окно|подтверждение|Галерея|Лукбук|Мини-корзина|Поиск|Мега-меню|Уведомления_1920|Выбор_|Быстрый|Таблица_размеров_1920|добавлен', n)

for n, fr in frames.items():
    s = fr['set']
    logged = 'Кнопка_Уведомления' in s or fr['folder'][:2] in ('04', '05', '06')
    # 1. Шапка — с любой страницы
    if 'Шапка' in s:
        for trig, to, lab in [('Логотип', H['home'], 'Логотип'), ('Пункт_БРЕНДЫ', H['megaB'], 'Бренды'), ('Пункт_КАТАЛОГ', H['megaC'], 'Каталог'), ('Пункт_НОВИНКИ', H['catalog'], 'Новинки'),
                              ('Пункт_ИСТОРИИ', H['hist'], 'Истории'), ('Кнопка_Поиск', H['search'], 'Поиск'), ('Кнопка_Тема', H['theme'], 'Тема'), ('Валюта', H['cur'], 'Валюта'),
                              ('Кнопка_Избранное', H['wish'] if logged else H['prompt'], 'Избранное'), ('Кнопка_Сравнение', H['cmp'], 'Сравнение'), ('Кнопка_Корзина', H['mini'], 'Корзина'),
                              ('Кнопка_Профиль', H['acc'] if logged else H['login'], 'Профиль'), ('Кнопка_Уведомления', H['notifP'], 'Уведомления')]:
            add(n, to, trig, label=lab, anim='fast' if to in (H['megaB'], H['megaC'], H['theme'], H['cur'], H['notifP']) else 'dissolve')
    # 2. Подвал
    if 'Подвал' in s:
        for trig, to in [('Ссылка_Доставка_и_оплата', H['i_del']), ('Ссылка_Возврат', H['i_ret']), ('Ссылка_Таблица_размеров', H['i_size']), ('Ссылка_О_нас', H['i_about']),
                         ('Ссылка_Контакты', H['i_cont']), ('Ссылка_Политика_конфиденциальности', H['i_priv']), ('Ссылка_Отследить_заказ', H['trk']), ('Ссылка_Поддержка', H['support'] if logged else H['i_cont']),
                         ('Ссылка_Истории_брендов', H['hist']), ('Ссылка_Стать_продавцом', H['seller'] if logged else H['login'])]:
            add(n, to, trig, label=trig.replace('Ссылка_', '').replace('_', ' '))
        for b in brands:
            bn = b.split('_', 2)[2].rsplit('_1920', 1)[0]
            add(n, b, 'Ссылка_' + bn, label=bn.replace('_', ' '))
    # 3. Меню кабинета (покупатель и сотрудники)
    for i in fr['ids']:
        m = re.match(r'^Пункт_(.+)$', i)
        if not m: continue
        key = m.group(1)
        table = {'Обзор': H['acc'], 'Мои_заказы': H['orders'], 'Возвраты': H['returns'], 'Адресная_книга': H['addr'], 'Уведомления': H['notif'], 'Избранное': H['wish'],
                 'Вы_смотрели': H['viewed'], 'Мои_отзывы': H['reviews'], 'Поддержка': H['support'], 'Стать_продавцом': H['seller'], 'Настройки': H['settings'],
                 'Мой_магазин': H['shop'], 'Склад': H['stock'], 'Доставки': H['courier'], 'Поддержка_клиентов': H['desk'], 'Админ-панель': H['dash']}
        if fr['folder'][:2] in ('04', '05') and key in table: add(n, table[key], i, label=key.replace('_', ' '))
    if 'Кнопка_Выйти' in s: add(n, H['login'], 'Кнопка_Выйти', label='Выйти')
    # 4. Меню админ-панели
    if fr['folder'].startswith('06_'):
        for i in fr['ids']:
            m = re.match(r'^Пункт_(.+)$', i)
            if not m: continue
            k = norm(m.group(1))
            target = None
            for a in admin:
                t = norm(a.split('_', 1)[1].rsplit('_1920', 1)[0])
                if k and (t == k or t.startswith(k) or k.startswith(t) or (len(k) > 4 and k[:5] in t[:12])):
                    target = a; break
            if not target:
                extra = {'возвраты': H['deskRet'], 'обращения': H['desk'], 'склад': H['stock'], 'товары': admin[1], 'отзывы': admin[2], 'заявки': admin[3]}
                target = next((v for kk, v in extra.items() if k.startswith(kk)), None)
            if target: add(n, target, i, label=m.group(1).replace('_', ' '))
        add(n, H['home'], 'Кнопка_На_сайт', label='На сайт')
    # 5. Карточки товаров → страница товара
    if not overlay(n) and fr['folder'][:2] in ('01', '04', '10', '02'):
        add(n, H['product'], regex=r'^Карточка_товара_\d+$', label='Клик по карточке')
    # 6. Окна: закрыть = назад
    if overlay(n) and n != H['pre']:
        for trig in ['Кнопка_Закрыть', 'Кнопка_Отмена', 'Кнопка_Отменить']:
            add(n, None, trig, action='BACK', label=trig.replace('Кнопка_', ''))

# 7. Сценарии
missed = []
def fx(src, pairs):
    for trig, to, *rest in pairs:
        lab = rest[0] if rest else trig.replace('Кнопка_', '').replace('_', ' ')
        ok = add(src, to, regex=trig[3:], label=lab) if trig.startswith('re:') else add(src, to, trig, label=lab)
        if not ok and to and (src, trig if not trig.startswith('re:') else trig[3:], to, 'NAVIGATE') not in seen: missed.append((src, trig, to))
fx(H['home'], [('Кнопка_Смотреть_коллекцию', brands[0]), ('Кнопка_Весь_каталог', H['catalog']), ('Ссылка_Все_товары', H['catalog']), ('Ссылка_Все_новинки', H['catalog'])])
# плитки брендов, коллекции, истории на главной — по тексту внутри
for src in [H['home']]:
    for gid, text in frames[src]['texts'].items():
        if re.match(r'^(Плитка_бренда|Карточка_коллекции)', gid):
            b = brand_by_text(text, brands)
            if b: add(src, b, gid, label=gid.split('_')[0] + ' ' + b.split('_', 2)[2].rsplit('_1920', 1)[0].replace('_', ' '))
        if re.match(r'^История', gid):
            st = brand_by_text(text, stories)
            if st: add(src, st, gid, label='История')
        if re.match(r'^Вещь', gid): add(src, H['product'], gid, label='Культовая вещь')
for gid, text in frames[H['hist']]['texts'].items():
    if gid.startswith('История'):
        st = brand_by_text(text, stories)
        if st: add(H['hist'], st, gid, label='История ' + st.split('_', 2)[2].rsplit('_1920', 1)[0].replace('_', ' '))
for c in [H['catalog'], H['catf'], find('13_Каталог_тема'), find('14_Каталог_тема'), H['cmpBar']]:
    fx(c, [('Кнопка_Быстрый_просмотр', H['quick']), ('Кнопка_Добавить_к_сравнению', H['cmpBar']), ('Кнопка_Сравнить', H['cmp']), ('Чекбокс_Balenciaga', H['catf'], 'Фильтр Balenciaga')])
fx(H['catf'], [('re:^Чип_Balenciaga', H['catalog'], 'Убрать фильтр'), ('Кнопка_Сбросить_всё', H['catalog'])])
fx(H['empty'], [('Кнопка_Сбросить_всё', H['catalog']), ('re:^Чип_Supreme', H['catalog'], 'Убрать фильтр')])
fx(H['product'], [('Кнопка_В_корзину', H['added']), ('Кнопка_Таблица_размеров', H['sizes']), ('Кнопка_Полноэкранный_просмотр', H['gallery']), ('Кнопка_Добавить_в_избранное', H['prompt'])])
for b in brands:
    bn = b.split('_', 2)[2].rsplit('_1920', 1)[0]
    st = next((x for x in stories if x.split('_', 2)[2].rsplit('_1920', 1)[0] == bn), None)
    fx(b, [('Кнопка_Читать_историю_бренда', st), ('Кнопка_Каталог_бренда', H['catf']), ('re:^Кнопка_Смотреть_лукбук|^Кнопка_Лукбук', H['look'], 'Лукбук')])
for i, st in enumerate(stories):
    nxt = stories[(i + 1) % len(stories)]
    bn = st.split('_', 2)[2].rsplit('_1920', 1)[0]
    b = next((x for x in brands if x.split('_', 2)[2].rsplit('_1920', 1)[0] == bn), None)
    fx(st, [('Следующая_история', nxt, 'Следующая история'), ('Ссылка_Каталог', b, 'Каталог бренда'), ('re:^Кнопка_Каталог', b, 'Каталог бренда')])
for m in [H['mini'], H['added']]:
    fx(m, [('Кнопка_Оформить_заказ', H['co1']), ('Кнопка_Перейти_в_корзину', H['cart']), ('re:^Кнопка_В_корзину$', H['cart'])])
fx(H['quick'], [('Кнопка_В_корзину', H['added']), ('Ссылка_Подробнее_о_товаре', H['product'], 'Подробнее о товаре')])
fx(H['prompt'], [('Кнопка_Войти', H['login']), ('Кнопка_Создать_аккаунт', H['reg'])])
fx(H['search'], [('Чип_Balenciaga', H['searchR'], 'Подсказка'), ('re:^Чип', H['searchR'], 'Подсказка')])
fx(H['searchR'], [('re:^Ссылка_', H['product'], 'Результат'), ('Кнопка_Все_результаты', H['catalog'])])
fx(H['megaB'], [('re:^Ссылка_Balenciaga|^Пункт_Balenciaga', brands[0], 'Balenciaga'), ('Кнопка_Каталог_бренда', H['catf']), ('Кнопка_История', stories[0])])
for b in brands:
    bn = b.split('_', 2)[2].rsplit('_1920', 1)[0]
    add(H['megaB'], b, 'Ссылка_' + bn, label=bn.replace('_', ' '))
fx(H['megaC'], [('re:^Ссылка_', H['catalog'], 'Категория'), ('re:^Плитка_подборки', H['catalog'], 'Подборка')])
fx(H['cart'], [('Кнопка_Оформить', H['co1']), ('Кнопка_Оформить_заказ', H['co1']), ('Кнопка_Очистить', H['cartClear']), ('re:^Товар_в_корзине', H['product'], 'Товар')])
fx(H['cart0'], [('Кнопка_Перейти_в_каталог', H['catalog']), ('Кнопка_В_каталог', H['catalog']), ('Кнопка_Начать_покупки', H['catalog'])])
fx(H['cartClear'], [('Кнопка_Удалить', H['cart0'])])
fx(H['cmp'], [('Кнопка_Очистить_сравнение', H['cmpClear']), ('Кнопка_Очистить', H['cmpClear'])])
fx(H['cmpClear'], [('Кнопка_Удалить', H['cmp0'])])
for a, b in [(H['co1'], H['co2']), (H['co2'], H['co3']), (H['co3'], H['co4']), (H['co4'], H['co5'])]:
    fx(a, [('Кнопка_Далее', b, 'Далее')])
    add(b, a, 'Кнопка_Назад', label='Назад')
fx(H['co5'], [('Кнопка_Оформить_заказ', H['done'])])
fx(H['done'], [('Кнопка_Отследить_заказ', H['trk2']), ('Кнопка_Отследить', H['trk2']), ('Кнопка_Мои_заказы', H['orders']), ('Кнопка_Продолжить_покупки', H['catalog'])])
fx(H['trk'], [('Кнопка_Найти', H['trk2'])])
fx(H['orders'], [('re:^Заказ_\\d+$', H['order'], 'Клик по заказу')])
fx(H['acc'], [('re:^Заказ_\\d+$', H['order'], 'Последний заказ'), ('Ссылка_Все_заказы', H['orders'])])
fx(H['order'], [('Кнопка_Отменить_заказ', H['cancelM']), ('re:^Кнопка_Оформить_возврат|^Кнопка_Вернуть', H['returnM'], 'Возврат'), ('Кнопка_Отследить', H['trk2']), ('Ссылка_Вопрос_по_заказу', H['support'])])
fx(H['addr'], [('Кнопка_Добавить_адрес', H['addrM']), ('Кнопка_Добавить', H['addrM']), ('Кнопка_Удалить', H['addrDel'])])
fx(H['support'], [('re:^Обращение', H['ticket'], 'Обращение')])
fx(H['wish0'], [('Кнопка_В_каталог', H['catalog'])])
for lg in [H['login'], H['loginErr']]:
    fx(lg, [('Вкладка_РЕГИСТРАЦИЯ', H['reg']), ('Кнопка_ВОЙТИ', H['acc']), ('Кнопка_Войти', H['acc']), ('Ссылка_Забыли_пароль', H['forgot']), ('Кнопка_Забыли_пароль', H['forgot']),
            ('Чип_Покупатель', H['acc']), ('Чип_Продавец', H['shop']), ('Чип_Кладовщик', H['stock']), ('Чип_Курьер', H['courier']), ('Чип_Поддержка', H['desk']), ('Чип_Модератор', H['dash']), ('Чип_Владелец', H['dash'])])
fx(H['reg'], [('Вкладка_ВХОД', H['login']), ('Кнопка_СОЗДАТЬ_АККАУНТ', H['code']), ('Кнопка_Создать_аккаунт', H['code'])])
fx(H['code'], [('Кнопка_Подтвердить', H['acc']), ('Кнопка_ПОДТВЕРДИТЬ', H['acc']), ('Кнопка_Назад', H['login'])])
fx(H['forgot'], [('Кнопка_Получить_код', H['reset']), ('Кнопка_Отправить_код', H['reset']), ('Кнопка_Назад', H['login'])])
fx(H['reset'], [('Кнопка_Сохранить_пароль', H['login']), ('Кнопка_Назад', H['login'])])
for e in [n for n in frames if frames[n]['folder'].startswith('08_')]:
    fx(e, [('Кнопка_На_главную', H['home']), ('Кнопка_В_каталог', H['catalog']), ('Кнопка_Войти', H['login'])])
fx(H['shop'], [('Кнопка_Добавить_товар', H['shopNew']), ('re:^Кнопка_Редактировать|^Кнопка_Изменить', H['shopEdit'], 'Изменить'), ('Кнопка_Удалить', H['shopDel'])])
for s_ in [H['shop'], H['shopOrders'], H['shopStats'], H['shopRev'], H['shopNew'], H['shopEdit']]:
    fx(s_, [('re:^Вкладка_Товары', H['shop'], 'Товары'), ('re:^Вкладка_Заказы', H['shopOrders'], 'Заказы'), ('re:^Вкладка_Статистика', H['shopStats'], 'Статистика'), ('re:^Вкладка_Отзывы', H['shopRev'], 'Отзывы'), ('Ссылка_Все_товары', H['shop'])])
for s_ in [H['stock'], H['queue'], H['stockRet'], H['moves']]:
    fx(s_, [('re:^Вкладка_Остатки', H['stock'], 'Остатки'), ('re:^Вкладка_Очередь', H['queue'], 'Очередь сборки'), ('re:^Вкладка_Возвраты', H['stockRet'], 'Возвраты'), ('re:^Вкладка_Журнал', H['moves'], 'Журнал')])
fx(H['stock'], [('re:^Кнопка_Приёмка|^Кнопка_Принять', H['income'], 'Приёмка')])
for s_ in [H['courier'], H['done2']]:
    fx(s_, [('re:^Вкладка_В_доставке', H['courier'], 'В доставке'), ('re:^Вкладка_Доставлен', H['done2'], 'Доставленные')])
fx(H['courier'], [('re:^Ссылка_AMF|^Пункт_\\d+$', H['route'], 'Маршрутный лист')])
for s_ in [H['desk'], H['deskRet'], H['deskOrders'], H['deskTicket']]:
    fx(s_, [('re:^Вкладка_Обращения', H['desk'], 'Обращения'), ('re:^Вкладка_Возвраты', H['deskRet'], 'Возвраты'), ('re:^Вкладка_Заказы', H['deskOrders'], 'Заказы')])
fx(H['desk'], [('re:^Обращение|^Пункт_Как', H['deskTicket'], 'Обращение')])
fx(H['deskRet'], [('re:^Кнопка_Одобрить', H['deskDecide'], 'Одобрить')])
fx(H['desk'], [('re:^Пункт_\\d+$', H['deskTicket'], 'Обращение')])
fx(H['deskOrders'], [('re:^Строка_\\d+$', H['deskOrder'], 'Заказ')])
fx(find('06_Бренды_1920'), [('re:^Бренд', H['brandAdm'], 'Бренд'), ('re:^Карточка', H['brandAdm'], 'Бренд'), ('re:^Пункт_\\d+$', H['brandAdm'], 'Бренд'), ('re:^Кнопка_Изменить', H['brandAdm'], 'Бренд')])
fx(H['brandAdm'], [('Кнопка_Изменить', H['brandEdit'])])
fx(find('10_Пользователи'), [('re:^Строка_\\d+$', H['userAdm'], 'Пользователь')])
fx(H['userAdm'], [('Кнопка_Изменить', H['userEdit'])])
fx(find('14_Промокоды'), [('re:^Кнопка_Добавить', H['promoNew'], 'Добавить')])
fx(find('11_Склады'), [('Кнопка_Удалить', H['delConfirm'])])
fx(H['pre'], [])

flows = [[H['home'], 'Покупатель — главная'], [H['login'], 'Вход и регистрация'], [H['acc'], 'Личный кабинет'], [H['shop'], 'Продавец'], [H['stock'], 'Склад'], [H['courier'], 'Курьер'], [H['desk'], 'Поддержка'], [H['dash'], 'Админ-панель']]
# Заставка: переход по задержке не поддерживается API — даём клик
add(H['pre'], H['home'], regex=r'^Заставка|^Логотип', label='Клик / через 2,2 с')

# ---------- отчёт ----------
by_from = collections.Counter(L['from'] for L in links)
nolinks = [n for n in frames if n not in by_from]
print('переходов:', len(links), '«назад»:', sum(1 for L in links if L['action'] == 'BACK'), 'экранов с переходами:', len(by_from), 'из', len(frames))
print('без исходящих:', nolinks)
if '-m' in sys.argv:
    for m in missed: print('нет слоя:', m[0], '|', m[1])
if '-v' in sys.argv:
    for L in links: print(L['from'], '|', L.get('trigger') or L.get('regex'), '→', L['to'] or 'НАЗАД')

os.makedirs(OUT, exist_ok=True)
tokens = json.load(open(os.path.join(OUT, 'Дизайн-токены.json'), encoding='utf-8'))
json.dump({'links': links, 'flows': flows}, open(os.path.join(OUT, 'Переходы.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
anim_ru = {'dissolve': 'Dissolve 320 мс', 'fast': 'Dissolve 160 мс', 'slide': 'Move in 640 мс', 'smart': 'Smart animate 640 мс', 'instant': 'Instant'}
with open(os.path.join(OUT, 'Переходы.csv'), 'w', encoding='utf-8-sig') as f:
    f.write('Экран;Слой (что нажать);Действие;Куда;Анимация\n')
    for L in links:
        trig = L.get('trigger') or ('все слои: ' + L['regex'].replace('^', '').replace('$', '').replace('\\d+', 'N'))
        f.write(f"{L['from']};{trig};{'On click → Back' if L['action']=='BACK' else 'On click → Navigate to'};{L['to'] or '(предыдущий экран)'};{anim_ru.get(L['anim'], L['anim'])} · кривая сайта\n")
# плагин
pdir = os.path.join(OUT, 'Плагин_Amfibia')
os.makedirs(pdir, exist_ok=True)
manifest = {'name': 'Amfibia — стили и переходы', 'id': 'amfibia-lab25-prototype', 'api': '1.0.0', 'main': 'code.js', 'editorType': ['figma'], 'documentAccess': 'dynamic-page',
            'networkAccess': {'allowedDomains': ['none']},
            'menu': [{'name': 'Всё сразу: стили + переходы', 'command': 'all'}, {'name': 'Только стили', 'command': 'styles'}, {'name': 'Только переходы', 'command': 'links'}]}
json.dump(manifest, open(os.path.join(pdir, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
code = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'plugin-code.js'), encoding='utf-8').read()
data = {'tokens': tokens, 'links': links, 'flows': flows, 'easing': tokens['motion']['easings']['Плавный_выход']['bezier']}
code = code.replace('/*DATA*/ {}', json.dumps(data, ensure_ascii=False))
open(os.path.join(pdir, 'code.js'), 'w', encoding='utf-8').write(code)
print('плагин:', os.path.getsize(os.path.join(pdir, 'code.js')) // 1024, 'КБ')
