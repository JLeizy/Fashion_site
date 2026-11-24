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
            if gid and re.match(r'^(Плитка_бренда|История|Карточка_коллекции|Вещь|Бренд|Экран|Заказ|Пункт|Строка|Карточка|Возврат)_?', gid):
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
def add(src, to, trigger=None, regex=None, anim='dissolve', label='', limit=None, action='NAVIGATE', trig='ON_CLICK', timeout=None):
    if src not in frames or (action != 'BACK' and (not to or to not in frames)) or src == to: return False
    ids = frames[src]['ids']
    if trigger == '__frame__': pass
    elif trigger is not None and trigger not in frames[src]['set']:
        alt = next((i for i in ids if i.lower() == trigger.lower()), None)
        if not alt: return False
        trigger = alt
    if regex is not None:
        if not any(re.search(regex, i, re.I) for i in ids): return False
    key = (src, trigger or regex, to, action, trig)
    if key in seen: return False
    seen.add(key)
    L = {'from': src, 'to': to, 'action': action, 'anim': anim, 'label': label}
    if trig != 'ON_CLICK': L['trig'] = trig
    if timeout: L['timeout'] = timeout
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
            if trig == 'Пункт_НОВИНКИ' and n == find('11_Главная_тема'): to = find('13_Каталог_тема')
            if trig == 'Пункт_НОВИНКИ' and n == find('12_Главная_тема'): to = find('14_Каталог_тема')
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
            tn = [(a, norm(a.split('_', 1)[1].rsplit('_1920', 1)[0])) for a in admin]
            for test in (lambda t: t == k, lambda t: t.startswith(k) or k.startswith(t), lambda t: len(k) > 4 and k[:5] in t[:12]):
                target = next((a for a, t in tn if k and test(t)), None)
                if target: break
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
        if not ok and to and src != to: missed.append((src, trig, to))
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
    fx(c, [('Чекбокс_Balenciaga', H['catf'], 'Фильтр Balenciaga'), ('Кнопка_Сравнить', H['cmp'])])
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
order_frames = [H['order'], find('19_Заказ_ожидает'), find('20_Заказ_доставлен')]
num_of = {}
for of in order_frames:
    m = re.search(r'AMF-\d{4}-\d{6}', ' '.join(frames[of]['ids']))
    if m: num_of[m.group(0)] = of
for src in [H['orders'], H['acc']]:
    for gid, text in frames[src]['texts'].items():
        if re.match(r'^Заказ_\d+$', gid):
            m = re.search(r'AMF-\d{4}-\d{6}', text)
            add(src, num_of.get(m.group(0) if m else '', H['order']), gid, label='Заказ ' + (m.group(0) if m else ''))
fx(find('19_Заказ_ожидает'), [('Кнопка_Отменить_заказ', H['cancelM']), ('Кнопка_Отследить', H['trk2']), ('Ссылка_Написать_в_поддержку', H['support']), ('Ссылка_Мои_заказы', H['orders'])])
for gid, text in frames[H['returns']]['texts'].items():
    for num, of in num_of.items():
        if num in text and re.match(r'^(Пункт|Строка|Карточка|Возврат)', gid): add(H['returns'], of, gid, label='Заказ ' + num)
fx(find('20_Заказ_доставлен'), [('Кнопка_Вернуть', H['returnM'], 'Вернуть товар'), ('Ссылка_Написать_в_поддержку', H['support']), ('Ссылка_Мои_заказы', H['orders'])])
fx(H['acc'], [('re:^Заказ_\\d+$', H['order'], 'Последний заказ'), ('Ссылка_Все_заказы', H['orders'])])
fx(H['order'], [('Кнопка_Отследить', H['trk2'])])
fx(H['addr'], [('Кнопка_Добавить_адрес', H['addrM']), ('Кнопка_Добавить', H['addrM']), ('Кнопка_Удалить', H['addrDel'])])
fx(H['support'], [('re:^Обращение', H['ticket'], 'Обращение')])
fx(H['wish0'], [('Кнопка_В_каталог', H['catalog'])])
add(H['login'], H['loginErr'], 'Кнопка_Войти', label='Войти (неверный пароль)')
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
for s_ in [H['shop'], H['shopOrders'], H['shopStats'], H['shopRev']]:
    fx(s_, [('re:^Вкладка_(\\d+_)?Товары', H['shop'], 'Товары'), ('re:^Вкладка_(\\d+_)?Заказы', H['shopOrders'], 'Заказы'), ('re:^Вкладка_(\\d+_)?Статистика', H['shopStats'], 'Статистика'), ('re:^Вкладка_(\\d+_)?Отзывы', H['shopRev'], 'Отзывы'), ('Ссылка_Все_товары', H['shop'])])
for s_ in [H['stock'], H['queue'], H['stockRet'], H['moves']]:
    fx(s_, [('re:^Вкладка_(\\d+_)?Остатки', H['stock'], 'Остатки'), ('re:^Вкладка_(\\d+_)?Очередь', H['queue'], 'Очередь сборки'), ('re:^Вкладка_(\\d+_)?Возвраты', H['stockRet'], 'Возвраты'), ('re:^Вкладка_(\\d+_)?Журнал', H['moves'], 'Журнал')])
fx(H['stock'], [('re:^Кнопка_Приёмка|^Кнопка_Принять', H['income'], 'Приёмка')])
for s_ in [H['courier'], H['done2']]:
    fx(s_, [('re:^Вкладка_(\\d+_)?В_доставке', H['courier'], 'В доставке'), ('re:^Вкладка_(\\d+_)?Доставлен', H['done2'], 'Доставленные')])
fx(H['courier'], [('re:^Ссылка_AMF|^Пункт_\\d+$', H['route'], 'Маршрутный лист')])
for s_ in [H['desk'], H['deskRet'], H['deskOrders'], H['deskTicket']]:
    fx(s_, [('re:^Вкладка_(\\d+_)?Обращения', H['desk'], 'Обращения'), ('re:^Вкладка_(\\d+_)?Возвраты', H['deskRet'], 'Возвраты'), ('re:^Вкладка_(\\d+_)?Заказы', H['deskOrders'], 'Заказы')])
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

fx(H['theme'], [('Кнопка_Светлая', find('11_Главная_тема')), ('Кнопка_Тёмная', find('12_Главная_тема')), ('Кнопка_Amfibia', H['home'])])
add(H['search'], H['searchR'], 'Строка_поиска', label='Ввод запроса')
add(H['searchR'], H['searchE'], 'Строка_поиска', label='Другой запрос')
add(H['searchE'], H['search'], 'Строка_поиска', label='Изменить запрос')
add(H['catalog'], H['empty'], 'Фильтр_цены', label='Цена без результатов')
add(H['wish'], H['wish0'], 'Заголовок_страницы', label='Убрать все вещи (пустое состояние)')
flows = [[H['pre'], 'Покупатель — с заставки'], [find('02_Ошибка_404'), 'Ошибка 404'], [find('01_Ошибка_403'), 'Ошибка 403'], [find('03_Ошибка_500'), 'Ошибка 500'], [H['login'], 'Вход и регистрация'], [H['acc'], 'Личный кабинет'], [H['shop'], 'Продавец'], [H['stock'], 'Склад'], [H['courier'], 'Курьер'], [H['desk'], 'Поддержка'], [H['dash'], 'Админ-панель']]
# Заставка: переход по задержке не поддерживается API — даём клик
add(H['pre'], H['home'], '__frame__', trig='AFTER_TIMEOUT', timeout=2.2, label='Через 2,2 с')
hov = find('Каталог_наведение')
for c in [H['catalog'], H['catf'], find('13_Каталог_тема'), find('14_Каталог_тема')]:
    add(c, hov, 'Карточка_товара_1', trig='MOUSE_ENTER', anim='fast', label='Наведение на карточку')
add(hov, H['catalog'], 'Карточка_товара_1', trig='MOUSE_LEAVE', anim='fast', label='Убрать курсор')
fx(hov, [('Кнопка_Быстрый_просмотр', H['quick']), ('Кнопка_Сравнить', H['cmpBar']), ('Кнопка_В_избранное', H['prompt'], 'Сердце (гость)')])
add(hov, H['product'], regex=r'^Карточка_товара_\d+$', label='Клик по карточке')
fx(find('06_Бренды_1920'), [('re:^Карточка_бренда_\\d+$', H['brandAdm'], 'Карточка бренда')])
for gid, text in frames[H['megaB']]['texts'].items():
    if re.match(r'^Бренд_\d+$', gid):
        b = brand_by_text(text, brands)
        if b: add(H['megaB'], b, gid, label=b.split('_', 2)[2].rsplit('_1920', 1)[0].replace('_', ' '))
fx(H['support'], [('re:^Как подобрать', H['ticket'], 'Обращение')])
for lg in [H['login'], H['loginErr'], H['code'], H['forgot'], H['reset'], H['reg']]:
    fx(lg, [('Чип_Создатель_магазина', H['dash'], 'Владелец'), ('Чип_Покупатель', H['acc']), ('Чип_Продавец', H['shop']), ('Чип_Кладовщик', H['stock']), ('Чип_Курьер', H['courier']), ('Чип_Поддержка', H['desk']), ('Чип_Модератор', H['dash'])])
fx(H['cart0'], [('Кнопка_Смотреть_новинки', H['catalog'])])
fx(H['wish0'], [('Кнопка_Каталог', H['catalog'])])
fx(H['prompt'], [('Кнопка_Зарегистрироваться', H['reg']), ('Ссылка_Забыли_пароль', H['forgot'])])
fx(H['order'], [('Ссылка_Написать_в_поддержку', H['support']), ('Ссылка_Мои_заказы', H['orders'])])
fx(H['done'], [('Ссылка_Продолжить_покупки', H['catalog'])])
fx(H['searchR'], [('re:^Кнопка_Все_результаты', H['catalog'], 'Все результаты')])
fx(H['catf'], [('re:^Чип_Сбросить', H['catalog'], 'Сбросить всё')])
fx(H['product'], [('Кнопка_Таблица_размеров', H['sizes']), ('Кнопка_В_избранное', H['prompt'], 'Сердце (гость)'), ('Кнопка_Сравнить', H['cmp']), ('Ссылка_Каталог', H['catalog'])])
fx(H['home'], [('re:^Ссылка_Все$', H['catalog'], 'Все'), ('Ссылка_Все_новинки', H['catalog'])])

# ---------- отчёт ----------
by_from = collections.Counter(L['from'] for L in links)
nolinks = [n for n in frames if n not in by_from]
print('переходов:', len(links), '«назад»:', sum(1 for L in links if L['action'] == 'BACK'), 'экранов с переходами:', len(by_from), 'из', len(frames))
print('без исходящих:', nolinks)
if '-m' in sys.argv:
    have = {(l['from'], l['to']) for l in links}
    for m in missed:
        if (m[0], m[2]) not in have: print('нет слоя:', m[0], '|', m[1], '→', m[2])
if '-v' in sys.argv:
    for L in links: print(L['from'], '|', L.get('trigger') or L.get('regex'), '→', L['to'] or 'НАЗАД')

os.makedirs(OUT, exist_ok=True)
tokens = json.load(open(os.path.join(OUT, 'Дизайн-токены.json'), encoding='utf-8'))

# ---------- тексты для шага «Тексты» плагина ----------
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from postfix import pick, KEEP, AVAILABLE
font_tab, font_idx = [], {}
style_tab = tokens['textStyles']
color_tab, color_idx = [], {}
def font_id(fam, w, it):
    st = 'Book' if fam == 'UnifrakturMaguntia' else 'Regular' if fam in KEEP or fam not in AVAILABLE else pick(fam, w, it)
    k = (fam, st)
    if k not in font_idx: font_idx[k] = len(font_tab); font_tab.append({'family': fam, 'style': st})
    return font_idx[k]
def theme_of(name, folder):
    if 'тема_Светлая' in name: return 'Светлая'
    if 'тема_Тёмная' in name or folder.startswith('06_'): return 'Тёмная'
    if folder in ('', 'Стили', 'Компоненты'): return None
    return 'Amfibia'
def color_id(theme, fill, op):
    if not theme or not fill or fill == 'none': return -1
    for nm, c in tokens['colors'][theme].items():
        if c['value'].lower() == fill.lower() and abs((c.get('opacity') or 1) - op) < 0.03:
            key = f'Тема {theme}/{nm.replace("_", " ")}'
            if key not in color_idx: color_idx[key] = len(color_tab); color_tab.append(key)
            return color_idx[key]
    return -1
def style_id(fam, size, w, it, ls):
    em = round((ls / size) / 0.04) * 0.04 if size else 0
    lspx = round(round(em, 2) * size * 100) / 100
    for i, t in enumerate(style_tab):
        if t['family'] == fam and t['size'] == round(size) and t['weight'] == w and t['italic'] == it and abs(t['letterSpacingPx'] - lspx) < 0.011: return i
    return -1
texts = {}
svgs = [(os.path.join(PROTO, d, f), d) for d in sorted(os.listdir(PROTO)) for f in sorted(os.listdir(os.path.join(PROTO, d))) if f.endswith('.svg')]
svgs += [(os.path.join(DOCS, d, f), '') for d in ('1_Стили', '2_Компоненты', '4_Обложка', '5_Карта_переходов') for f in os.listdir(os.path.join(DOCS, d)) if f.endswith('.svg')]
nt = nmulti = 0
for path, folder in svgs:
    fname = os.path.basename(path)[:-4]
    theme = theme_of(fname, folder)
    out = []
    for el in ET.parse(path).getroot().iter(NS + 'text'):
        tsp = el.findall(NS + 'tspan')
        lines = [(t.text or '') for t in tsp] if tsp else [el.text or '']
        if not ''.join(lines).strip(): continue
        fam = [x.strip().strip("'") for x in (el.get('font-family') or 'Inter').split(',')][-1]
        w = int(el.get('font-weight') or 400); it = el.get('font-style') == 'italic'
        size = float(el.get('font-size') or 16); ls = float(el.get('letter-spacing') or 0)
        ys = [float(t.get('y')) for t in tsp if t.get('y')]
        gap = round(ys[1] - ys[0], 2) if len(ys) > 1 else 0
        anc = {'middle': 1, 'end': 2}.get(el.get('text-anchor'), 0)
        op = float(el.get('fill-opacity') or 1)
        xs = [float(t.get('x')) for t in tsp if t.get('x')]
        rec = [el.get('id') or '', lines, font_id(fam, w, it), round(ls, 2), gap, anc, style_id(fam, size, w, it, ls), color_id(theme, el.get('fill'), op)]
        if len(lines) > 1 and xs and max(xs) - min(xs) > 1.5:
            # строки начинаются в разных местах (продолжение фразы) — не склеиваем, каждая строка отдельно
            for li, ln in enumerate(lines): out.append([rec[0] if li == 0 else '', [ln], rec[2], rec[3], 0, anc, rec[6], rec[7]])
        else:
            out.append(rec); nmulti += len(lines) > 1
        nt += 1
    texts[fname] = out
print('текстов:', nt, 'многострочных:', nmulti, 'шрифтов:', len(font_tab), 'цветовых привязок:', len(color_tab), 'со стилем:', sum(1 for v in texts.values() for e in v if e[6] >= 0))

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
manifest = {'name': 'Amfibia — стили, тексты, переходы', 'id': 'amfibia-lab25-prototype', 'api': '1.0.0', 'main': 'code.js', 'editorType': ['figma'], 'documentAccess': 'dynamic-page',
            'networkAccess': {'allowedDomains': ['none']},
            'menu': [{'name': 'Всё сразу: стили, тексты, переходы', 'command': 'all'}, {'name': '1. Только стили', 'command': 'styles'}, {'name': '2. Только тексты (склеить абзацы, шрифты, стили)', 'command': 'texts'}, {'name': '3. Только переходы', 'command': 'links'}]}
json.dump(manifest, open(os.path.join(pdir, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
code = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'plugin-code.js'), encoding='utf-8').read()
data = {'tokens': tokens, 'links': links, 'flows': flows, 'easing': tokens['motion']['easings']['Плавный_выход']['bezier'], 'fonts': font_tab, 'colors': color_tab, 'texts': texts}
code = code.replace('/*DATA*/ {}', json.dumps(data, ensure_ascii=False))
open(os.path.join(pdir, 'code.js'), 'w', encoding='utf-8').write(code)
print('плагин:', os.path.getsize(os.path.join(pdir, 'code.js')) // 1024, 'КБ')
