# Архив для Windows: имена в UTF-8 с флагом (Проводник показывает русские имена правильно)
import zipfile, os, sys
src = '/home/user/Fashion_site/docs/lab25'
out = sys.argv[1]
top = 'Amfibia_ЛР25_прототип'
n = 0
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for root, dirs, files in os.walk(src):
        dirs[:] = sorted(d for d in dirs if d != '_инструменты')
        for f in sorted(files):
            p = os.path.join(root, f)
            z.write(p, os.path.join(top, os.path.relpath(p, src)))
            n += 1
with zipfile.ZipFile(out) as z:
    bad = [i.filename for i in z.infolist() if any(ord(c) > 127 for c in i.filename) and not i.flag_bits & 0x800]
print('файлов', n, 'без флага UTF-8:', len(bad), 'размер МБ', round(os.path.getsize(out) / 1048576, 1))
