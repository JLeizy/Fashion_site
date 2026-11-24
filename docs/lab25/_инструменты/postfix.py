# Пост-обработка SVG для импорта в Figma (проверено на настоящем импорте Figma):
# 1) Figma при импорте SVG понимает только Regular/Bold по font-weight, но распознаёт имя вида «Inter-Medium».
#    Поэтому font-family = «<ИмяБезПробелов>-<Начертание>, <Имя>»: Figma берёт первое (точная насыщенность),
#    браузер — второе (превью). Начертание выбирается только из реально доступных в Figma.
# 2) Крошечные растровые ромбики в хлебных крошках получают имя «Разделитель».
import os, re, sys

ROOT = '/home/user/Fashion_site/docs/lab25'
AVAILABLE = {  # начертания шрифтов в Figma (список получен из figma.listAvailableFontsAsync)
    'Inter': 'Black, Black Italic, Bold, Bold Italic, Extra Bold, Extra Bold Italic, Extra Light, Extra Light Italic, Italic, Light, Light Italic, Medium, Medium Italic, Regular, Semi Bold, Semi Bold Italic, Thin, Thin Italic',
    'JetBrains Mono': 'Bold, Bold Italic, ExtraBold, ExtraBold Italic, ExtraLight, ExtraLight Italic, Italic, Light, Light Italic, Medium, Medium Italic, Regular, Thin, Thin Italic',
    'Cormorant Garamond': 'Bold, Bold Italic, Italic, Light, Light Italic, Medium, Medium Italic, Regular, SemiBold, SemiBold Italic',
    'Playfair Display': 'Black, Black Italic, Bold, Bold Italic, ExtraBold, ExtraBold Italic, Italic, Medium, Medium Italic, Regular, SemiBold, SemiBold Italic',
    'Unbounded': 'Black, Bold, ExtraBold, ExtraLight, Light, Medium, Regular, SemiBold',
    'Caveat': 'Bold, Regular',
    'Rubik Glitch': 'Regular',
}
KEEP = {'UnifrakturMaguntia', 'Forum'}  # у них одно начертание — Figma распознаёт по обычному имени
W = [(r'thin', 100), (r'extra ?light', 200), (r'light', 300), (r'semi ?bold', 600), (r'extra ?bold', 800), (r'black', 900), (r'bold', 700), (r'medium', 500)]
def weight_of(style):
    for rx, w in W:
        if re.search(rx, style, re.I): return w
    return 400
def pick(family, weight, italic):
    best, score = None, 1e9
    for st in [x.strip() for x in AVAILABLE[family].split(',')]:
        it = 'italic' in st.lower()
        sc = abs(weight_of(st) - weight) + (0 if it == italic else 1000)
        if sc < score: best, score = st, sc
    return best
def ps_name(family, style):
    s = style.replace(' ', '')
    if s.lower() == 'italic': s = 'Italic'
    return family.replace(' ', '') + '-' + s

def fix_text_tag(m):
    tag = m.group(0)
    fam = re.search(r'font-family="([^"]*)"', tag)
    if not fam: return tag
    families = [f.strip().strip("'") for f in fam.group(1).split(',')]
    base = families[-1]
    if base in KEEP or base not in AVAILABLE: return tag
    w = int((re.search(r'font-weight="(\d+)"', tag) or [0, '400'])[1])
    it = 'font-style="italic"' in tag
    st = pick(base, w, it)
    new = f'{ps_name(base, st)}, {base}'
    return tag.replace(fam.group(0), f'font-family="{new}"')

def fix_raster(m):
    tag = m.group(0)
    w = float((re.search(r'width="([\d.]+)"', tag) or [0, '99'])[1]); h = float((re.search(r'height="([\d.]+)"', tag) or [0, '99'])[1])
    if w <= 12 and h <= 12: return re.sub(r'id="Изображение_[^"]*"', 'id="Разделитель"', tag)
    return tag

def main():
    n = t = r = 0
    for d, dirs, files in os.walk(ROOT):
        if '_инструменты' in d: continue
        for f in files:
            if not f.endswith('.svg'): continue
            p = os.path.join(d, f)
            s = open(p, encoding='utf-8').read()
            s2 = re.sub(r'<text [^>]*>', fix_text_tag, s)
            s2 = re.sub(r'<(?:rect|path) id="Изображение_[^"]*"[^>]*>', fix_raster, s2)
            if s2 != s:
                t += len(re.findall(r'font-family="[A-Za-z]+-', s2)) - len(re.findall(r'font-family="[A-Za-z]+-', s))
                r += s2.count('id="Разделитель"') - s.count('id="Разделитель"')
                open(p, 'w', encoding='utf-8').write(s2); n += 1
    print('файлов изменено', n, 'текстов с точным начертанием', t, 'разделителей', r)


if __name__ == '__main__':
    main()
