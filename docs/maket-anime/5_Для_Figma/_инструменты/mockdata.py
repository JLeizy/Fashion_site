# SVG макета → JSON-деревья для имитации Figma (как после импорта SVG)
import json, os, re
import xml.etree.ElementTree as ET
DOCS = '/home/user/Fashion_site/docs/maket-anime'
NS = '{http://www.w3.org/2000/svg}'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mock')

def num(v, d=0.0):
    try: return float(v)
    except: return d

def conv(path):
    root = ET.parse(path).getroot()
    grads = {}
    for g in root.iter(NS + 'linearGradient'):
        stops = [(num(s.get('offset'), 0), s.get('stop-color'), num(s.get('stop-opacity'), 1)) for s in g.iter(NS + 'stop')]
        horiz = abs(num(g.get('x2')) - num(g.get('x1'))) > abs(num(g.get('y2')) - num(g.get('y1')))
        grads[g.get('id')] = {'stops': stops, 'h': horiz}
    def paint(v, op):
        if not v or v == 'none': return None
        m = re.match(r'url\(#(.+)\)', v)
        if m:
            if m.group(1) in grads: return {'grad': grads[m.group(1)]}
            return {'image': True}
        return {'hex': v.upper(), 'op': num(op, 1)}
    def walk(e):
        tag = e.tag.replace(NS, '')
        if tag in ('defs', 'clipPath', 'mask', 'pattern', 'linearGradient', 'radialGradient', 'style'): return None
        if tag == 'text':
            lines = [{'t': t.text or '', 'x': num(t.get('x')), 'y': num(t.get('y'))} for t in e.iter(NS + 'tspan') if (t.text or '').strip()]
            return {'k': 'text', 'id': e.get('id') or 'text', 'fam': (e.get('font-family') or 'Inter').split(',')[0].strip(), 'w': int(e.get('font-weight') or 400),
                    'size': num(e.get('font-size'), 16), 'fill': paint(e.get('fill'), e.get('fill-opacity')), 'lines': lines}
        if tag == 'g' or tag == 'svg':
            kids = [c for c in (walk(x) for x in e) if c]
            return {'k': 'g', 'id': e.get('id') or 'g', 'kids': kids}
        if tag in ('rect', 'path', 'circle', 'ellipse', 'line', 'polygon'):
            x, y, w, h = num(e.get('x')), num(e.get('y')), num(e.get('width'), 10), num(e.get('height'), 10)
            if tag == 'circle': x, y, w, h = num(e.get('cx')) - num(e.get('r')), num(e.get('cy')) - num(e.get('r')), 2 * num(e.get('r')), 2 * num(e.get('r'))
            return {'k': 'shape', 'id': e.get('id') or tag, 'x': x, 'y': y, 'w': w, 'h': h, 'fill': paint(e.get('fill', '#000000'), e.get('fill-opacity')), 'stroke': paint(e.get('stroke'), e.get('stroke-opacity'))}
        return None
    tree = walk(root)
    return {'w': num(root.get('width')), 'h': num(root.get('height')), 'tree': tree}

os.makedirs(OUT, exist_ok=True)
files = {}
for r, _, fs in os.walk(DOCS):
    if '5_Для_Figma' in r: continue
    for f in fs:
        if f.endswith('.svg'): files[f[:-4]] = conv(os.path.join(r, f))
json.dump(files, open(os.path.join(OUT, 'frames.json'), 'w', encoding='utf8'), ensure_ascii=False)
print(len(files), 'кадров')
