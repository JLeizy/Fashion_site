import sys, os, xml.etree.ElementTree as ET, collections
root = sys.argv[1]
bad = 0; n = 0; dup_total = 0
for d, _, fs in os.walk(root):
    for f in fs:
        if not f.endswith('.svg'): continue
        p = os.path.join(d, f); n += 1
        try:
            t = ET.parse(p)
            ids = [e.get('id') for e in t.iter() if e.get('id')]
            c = collections.Counter(ids)
            dups = sum(v - 1 for v in c.values() if v > 1)
            dup_total += dups
            refs = set()
            for e in t.iter():
                for k, v in e.attrib.items():
                    if 'url(#' in v: refs.add(v.split('url(#')[1].split(')')[0])
                    if k.endswith('href') and v.startswith('#'): refs.add(v[1:])
            missing = [r for r in refs if r not in c]
            dupref = [r for r in refs if c.get(r, 0) > 1]
            if missing or dupref: print('REF', p, missing[:3], dupref[:3]); bad += 1
        except Exception as ex:
            print('BAD', p, ex); bad += 1
print(f'файлов {n}, ошибок {bad}, повторов имён {dup_total}')
