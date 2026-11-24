# Сборка плагина Figma «Мультивселенная — стили и переходы»
# Берёт макет docs/maket-anime (SVG), строит таблицу «текст → стиль» и вшивает её в code.js.
import json, os, re, sys
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
DOCS = '/home/user/Fashion_site/docs/maket-anime'
OUT = os.path.join(DOCS, '5_Для_Figma', 'Плагин_Мультивселенная')
NS = '{http://www.w3.org/2000/svg}'

# ---------- дизайн-система (страница «Стили» макета) ----------
COLORS = [
    ('Фон/Основной', '#0F0F14', 1, 'Фон всех страниц'),
    ('Фон/Карточка', '#1B1B24', 1, 'Карточки, подвал, «Персонажи»'),
    ('Фон/Карточка_прозрачная', '#1B1B24', 0.7, 'Плашки фактов поверх картинки первого экрана (#1B1B24, 70%)'),
    ('Фон/Плейсхолдер', '#262632', 1, 'Места под картинки'),
    ('Текст/Основной', '#F5F5F7', 1, 'Заголовки, основной текст'),
    ('Текст/Вторичный', '#A3A3B5', 1, 'Описания, подписи, навигация'),
    ('Обводка/Основная', '#2E2E3B', 1, 'Рамки и разделители'),
    ('Акцент/Портал', '#8B5CF6', 1, 'Главная'),
    ('Акцент/Блич', '#FF6A1A', 1, 'Страница «Блич»'),
    ('Акцент/Ван-Пис', '#2F8CFF', 1, 'Страница «Ван-Пис»'),
    ('Акцент/Ангельские_ритмы', '#FF6FA8', 1, 'Страница «Ангельские ритмы»'),
]
# градиенты: направление и прозрачность в начале и в конце
GRADIENTS = [
    ('Фон/Затемнение_слева', '#0F0F14', 'h', 1, 0, 'Поверх картинки первого экрана (десктоп, планшет): #0F0F14 100% → 0% слева направо'),
    ('Фон/Затемнение_снизу', '#0F0F14', 'v', 0, 1, 'Поверх картинки первого экрана (телефон): #0F0F14 0% → 100% сверху вниз'),
]
# имя, семейство, начертание, кегль, интерлиньяж %, разрядка %, заглавные, назначение
TEXT_STYLES = [
    ('Десктоп/Заголовок_h1', 'Unbounded', 'Bold', 64, 115, 0, False, 'Заголовок h1, десктоп 1440'),
    ('Десктоп/Заголовок_h2', 'Unbounded', 'SemiBold', 40, 120, 0, False, 'Заголовок h2, десктоп 1440'),
    ('Десктоп/Заголовок_h3', 'Unbounded', 'Medium', 24, 130, 0, False, 'Заголовок h3, десктоп 1440'),
    ('Десктоп/Текст', 'Inter', 'Regular', 18, 150, 0, False, 'Основной текст, десктоп 1440'),
    ('Планшет/Заголовок_h1', 'Unbounded', 'Bold', 44, 115, 0, False, 'Заголовок h1, планшет 768'),
    ('Планшет/Заголовок_h2', 'Unbounded', 'SemiBold', 32, 120, 0, False, 'Заголовок h2, планшет 768'),
    ('Планшет/Заголовок_h3', 'Unbounded', 'Medium', 22, 130, 0, False, 'Заголовок h3, планшет 768'),
    ('Планшет/Текст', 'Inter', 'Regular', 16, 150, 0, False, 'Основной текст, планшет 768'),
    ('Мобильный/Заголовок_h1', 'Unbounded', 'Bold', 32, 115, 0, False, 'Заголовок h1, телефон 375'),
    ('Мобильный/Заголовок_h2', 'Unbounded', 'SemiBold', 26, 120, 0, False, 'Заголовок h2, телефон 375'),
    ('Мобильный/Заголовок_h3', 'Unbounded', 'Medium', 20, 130, 0, False, 'Заголовок h3, телефон 375'),
    ('Мобильный/Текст', 'Inter', 'Regular', 16, 150, 0, False, 'Основной текст, телефон 375'),
    ('Мобильный/Логотип', 'Unbounded', 'Bold', 16, 100, 0, False, 'Логотип в шапке и подвале на телефоне'),
    ('Общие/Оценка', 'Unbounded', 'Bold', 72, 100, 0, False, 'Итоговый балл в блоке «Моя оценка»'),
    ('Общие/Логотип', 'Unbounded', 'Bold', 18, 100, 0, False, 'Логотип «Мультивселенная»'),
    ('Общие/Тег', 'Inter', 'SemiBold', 13, 100, 8, True, 'Теги и подписи над заголовками, все заглавные'),
    ('Общие/Навигация', 'Inter', 'Medium', 16, 100, 0, False, 'Пункты меню, ссылки подвала, подписи'),
    ('Общие/Кнопка', 'Inter', 'SemiBold', 16, 100, 0, False, 'Текст кнопок'),
    ('Общие/Текст_малый', 'Inter', 'Regular', 14, 150, 0, False, 'Описания карточек, подписи, подвал'),
    ('Общие/Текст_малый_акцент', 'Inter', 'SemiBold', 14, 150, 0, False, 'Награда за голову в карточках «Ван-Пис»'),
    ('Обложка/Заголовок', 'Unbounded', 'Bold', 88, 100, 0, False, 'Название проекта на обложке'),
    ('Обложка/Подзаголовок', 'Inter', 'Regular', 24, 150, 0, False, 'Подзаголовок на обложке'),
]
GRIDS = [
    ('Сетка/Десктоп_12', 1440, 12, 120, 24, 'Columns 12 · Stretch · Margin 120 · Gutter 24 — фреймы 1440'),
    ('Сетка/Планшет_8', 768, 8, 32, 16, 'Columns 8 · Stretch · Margin 32 · Gutter 16 — фреймы 768'),
    ('Сетка/Мобильный_4', 375, 4, 16, 16, 'Columns 4 · Stretch · Margin 16 · Gutter 16 — фреймы 375'),
]


def role(fam, w, size, bp):
    """Стиль текста по шрифту макета (до импорта в Figma)."""
    w = int(w or 400)
    size = round(float(size))
    if fam == 'Unbounded':
        if size == 72: return 'Общие/Оценка'
        if size == 88: return 'Обложка/Заголовок'
        if size == 18: return 'Общие/Логотип'
        if size == 16: return 'Мобильный/Логотип'
        if w >= 700:
            return {64: 'Десктоп/Заголовок_h1', 44: 'Планшет/Заголовок_h1', 32: 'Мобильный/Заголовок_h1'}.get(size)
        if w == 600:
            return {40: 'Десктоп/Заголовок_h2', 32: 'Планшет/Заголовок_h2', 26: 'Мобильный/Заголовок_h2'}.get(size)
        return {24: 'Десктоп/Заголовок_h3', 22: 'Планшет/Заголовок_h3', 20: 'Мобильный/Заголовок_h3'}.get(size)
    if fam == 'Inter':
        if size == 13: return 'Общие/Тег'
        if size == 14: return 'Общие/Текст_малый_акцент' if w >= 600 else 'Общие/Текст_малый'
        if size == 16:
            if w >= 600: return 'Общие/Кнопка'
            if w == 500: return 'Общие/Навигация'
            return 'Планшет/Текст' if bp == 768 else 'Мобильный/Текст'
        if size == 18: return 'Десктоп/Текст'
        if size == 24: return 'Обложка/Подзаголовок'
    return None


def norm_text(s):
    return re.sub(r'\s+', ' ', (s or '').replace(' ', ' ')).strip()


def svgs():
    out = []
    for root, _, files in os.walk(DOCS):
        if '5_Для_Figma' in root:
            continue
        for f in files:
            if f.endswith('.svg'):
                out.append(os.path.join(root, f))
    return sorted(out)


lookup = {}
conflicts = 0
stats = {}
for path in svgs():
    base = os.path.basename(path)[:-4]
    m = re.search(r'_(1440|768|375)$', base)
    bp = int(m.group(1)) if m else None
    tree = ET.parse(path)
    table = lookup.setdefault(base, {})

    def walk(e, ids):
        global conflicts
        tag = e.tag.replace(NS, '')
        if tag == 'text':
            fam = (e.get('font-family') or '').split(',')[0].strip().strip("'\"")
            r = role(fam, e.get('font-weight'), e.get('font-size') or 16, bp)
            # образцы на странице «Стили»: стиль задан именем группы «Стиль_Раздел_Имя»
            for gid in ids:
                mm = re.match(r'^Стиль_(Десктоп|Планшет|Мобильный|Общие)_(.+)$', gid)
                if mm:
                    cand = mm.group(1) + '/' + mm.group(2)
                    spec = next((t for t in TEXT_STYLES if t[0] == cand), None)
                    W = {'Regular': 400, 'Medium': 500, 'SemiBold': 600, 'Bold': 700}
                    if spec and spec[1] == fam and spec[3] == round(float(e.get('font-size') or 0)) and W[spec[2]] == int(e.get('font-weight') or 400):
                        r = cand
            if r:
                lines = [t.text for t in e.iter(NS + 'tspan') if t.text and t.text.strip()] or [''.join(e.itertext())]
                size = round(float(e.get('font-size') or 16))
                for ln in lines + [' '.join(norm_text(x) for x in lines)]:
                    key = f'{norm_text(ln)}|{size}|{fam}'
                    if key in table and table[key] != r:
                        table[key] = '?'
                        conflicts += 1
                    else:
                        table[key] = r
                stats[r] = stats.get(r, 0) + 1
            return
        nid = e.get('id')
        for c in e:
            walk(c, ids + ([nid] if tag == 'g' and nid else []))

    walk(tree.getroot(), [])

# в Figma слой текста называется по строке, а кадр — по имени файла, поэтому ключ — «кадр → текст|кегль|семейство»
DATA = {
    'colors': [{'name': n, 'hex': h, 'opacity': o, 'desc': d} for n, h, o, d in COLORS],
    'gradients': [{'name': n, 'hex': h, 'dir': dr, 'a0': a0, 'a1': a1, 'desc': d} for n, h, dr, a0, a1, d in GRADIENTS],
    'textStyles': [{'name': n, 'family': f, 'style': s, 'size': sz, 'lh': lh, 'ls': ls, 'upper': up, 'desc': d}
                   for n, f, s, sz, lh, ls, up, d in TEXT_STYLES],
    'grids': [{'name': n, 'bp': bp, 'count': c, 'margin': m, 'gutter': g, 'desc': d} for n, bp, c, m, g, d in GRIDS],
    'lookup': lookup,
}
unknown = {r for r in stats if r not in {t[0] for t in TEXT_STYLES}}
assert not unknown, unknown

src = open(os.path.join(HERE, 'code.src.js'), encoding='utf8').read()
ui = open(os.path.join(HERE, 'ui.html'), encoding='utf8').read()
code = src.replace('/*DATA*/ {}', json.dumps(DATA, ensure_ascii=False, separators=(',', ':'))).replace('/*UI*/ \'\'', json.dumps(ui, ensure_ascii=False))
assert '/*DATA*/' not in code and '/*UI*/' not in code
os.makedirs(OUT, exist_ok=True)
open(os.path.join(OUT, 'code.js'), 'w', encoding='utf8').write(code)
manifest = {
    'name': 'Мультивселенная — стили и переходы',
    'id': 'multiverse-anime-styles-links',
    'api': '1.0.0',
    'main': 'code.js',
    'editorType': ['figma'],
    'documentAccess': 'dynamic-page',
    'networkAccess': {'allowedDomains': ['none']},
    'menu': [
        {'name': 'Всё сразу: стили и переходы', 'command': 'all'},
        {'name': 'Только стили', 'command': 'styles'},
        {'name': 'Только переходы', 'command': 'links'},
        {'separator': True},
        {'name': 'Проверка: что будет сделано (ничего не меняет)', 'command': 'check'},
    ],
}
open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf8').write(json.dumps(manifest, ensure_ascii=False, indent=2))
print('кадров в таблице:', len(lookup), 'строк:', sum(len(v) for v in lookup.values()), 'конфликтов:', conflicts)
print('тексты по стилям:', json.dumps(stats, ensure_ascii=False))
print('code.js', round(len(code.encode()) / 1024), 'КБ')
