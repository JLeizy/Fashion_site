// DOM → дерево слоёв для SVG (выполняется в браузере). Возвращает JSON-дерево; SVG собирает Node-скрипт.
(() => {
  const SKIP_SEL = [
    '.skip-link', '.sr-only', '.vignette', '.visually-hidden', '[data-grain]', '.grain', '.cursor', '[data-cursor]', 'script', 'style', 'noscript',
    'template', 'link', 'meta', 'title', '[data-proto-skip]', '.toast-stack', '.toasts', '[data-toasts]',
  ].join(',');

  const num = (v) => parseFloat(v) || 0;
  function parseColor(str) {
    if (!str) return null;
    const m = str.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
    const a = p.length > 3 ? p[3] : 1;
    if (a <= 0.001) return null;
    return { r: p[0], g: p[1], b: p[2], a };
  }
  const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const R = (v) => Math.round(v * 100) / 100;

  // Шрифт: подъём и спуск (для базовой линии текста)
  const cnv = document.createElement('canvas').getContext('2d');
  const metricCache = new Map();
  function metrics(cs) {
    const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    if (metricCache.has(font)) return metricCache.get(font);
    cnv.font = font;
    const m = cnv.measureText('Hgйщ');
    const res = { asc: m.fontBoundingBoxAscent, desc: m.fontBoundingBoxDescent, ell: cnv.measureText('…').width };
    metricCache.set(font, res);
    return res;
  }
  const firstFamily = (ff) => ff.split(',')[0].trim().replace(/^["']|["']$/g, '');

  function inter(a, b) {
    const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
    const x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
    if (x2 - x <= 0.5 || y2 - y <= 0.5) return null;
    return { x, y, w: x2 - x, h: y2 - y };
  }

  function radii(cs, w, h) {
    const one = (v) => {
      const parts = v.split(' ');
      let r = parts[0].endsWith('%') ? (num(parts[0]) / 100) * Math.min(w, h) : num(parts[0]);
      return Math.min(r, w / 2, h / 2);
    };
    return [one(cs.borderTopLeftRadius), one(cs.borderTopRightRadius), one(cs.borderBottomRightRadius), one(cs.borderBottomLeftRadius)];
  }

  // Делим строку по запятым верхнего уровня
  function splitTop(s) {
    const out = [];
    let depth = 0, cur = '';
    for (const ch of s) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  function parseGradient(str, box) {
    const lin = str.match(/^(repeating-)?linear-gradient\((.*)\)$/s);
    const rad = str.match(/^(repeating-)?radial-gradient\((.*)\)$/s);
    if (!lin && !rad) return null;
    if ((lin && lin[1]) || (rad && rad[1])) return null;
    const args = splitTop((lin || rad)[2]);
    let angle = 180, first = args[0], stopsArgs = args;
    let center = { x: 0.5, y: 0.5 };
    if (lin) {
      if (/^-?[\d.]+(deg|turn|rad)$/.test(first)) {
        angle = first.endsWith('turn') ? num(first) * 360 : first.endsWith('rad') ? (num(first) * 180) / Math.PI : num(first);
        stopsArgs = args.slice(1);
      } else if (first.startsWith('to ')) {
        const d = first.slice(3);
        const map = { top: 0, right: 90, bottom: 180, left: 270, 'top right': 45, 'right top': 45, 'bottom right': 135, 'right bottom': 135, 'bottom left': 225, 'left bottom': 225, 'top left': 315, 'left top': 315 };
        angle = map[d] ?? 180;
        stopsArgs = args.slice(1);
      }
    } else {
      if (!/^rgba?\(|^#/.test(first)) {
        const at = first.match(/at\s+([\d.]+)%\s+([\d.]+)%/);
        if (at) center = { x: num(at[1]) / 100, y: num(at[2]) / 100 };
        stopsArgs = args.slice(1);
      }
    }
    const stops = [];
    for (const s of stopsArgs) {
      const m = s.match(/(rgba?\([^)]*\))\s*(.*)$/);
      if (!m) return null;
      const c = parseColor(m[1]) || { r: 0, g: 0, b: 0, a: 0 };
      const poss = m[2].trim().split(/\s+/).filter(Boolean);
      if (!poss.length) stops.push({ c, p: null });
      for (const p of poss) {
        let v = p.endsWith('%') ? num(p) / 100 : p.endsWith('px') ? num(p) / (lin ? 1 : 1) : null;
        if (p.endsWith('px') && lin) {
          const a = (angle * Math.PI) / 180;
          const L = Math.abs(box.w * Math.sin(a)) + Math.abs(box.h * Math.cos(a));
          v = num(p) / L;
        } else if (p.endsWith('px')) v = num(p) / Math.max(box.w, box.h);
        stops.push({ c, p: v });
      }
    }
    if (stops.length < 2) return null;
    // Недостающие позиции — равномерно
    if (stops[0].p == null) stops[0].p = 0;
    if (stops[stops.length - 1].p == null) stops[stops.length - 1].p = 1;
    for (let i = 1; i < stops.length - 1; i++) {
      if (stops[i].p == null) {
        let j = i;
        while (stops[j].p == null) j++;
        const a = stops[i - 1].p, b = stops[j].p;
        for (let k = i; k < j; k++) stops[k].p = a + ((b - a) * (k - i + 1)) / (j - i + 1);
      }
    }
    const st = stops.map((s) => ({ color: hex(s.c), opacity: R(s.c.a), offset: Math.max(0, Math.min(1, s.p)) }));
    if (lin) {
      const a = (angle * Math.PI) / 180;
      const L = Math.abs(box.w * Math.sin(a)) + Math.abs(box.h * Math.cos(a));
      const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
      const dx = Math.sin(a), dy = -Math.cos(a);
      return { type: 'linear', x1: R(cx - (dx * L) / 2), y1: R(cy - (dy * L) / 2), x2: R(cx + (dx * L) / 2), y2: R(cy + (dy * L) / 2), stops: st };
    }
    return { type: 'radial', cx: center.x, cy: center.y, stops: st };
  }

  // Порядок отрисовки соседей (упрощённо по правилам CSS)
  function tierOf(el, cs, parentCs) {
    const positioned = cs.position !== 'static';
    const flexItem = parentCs && /flex|grid/.test(parentCs.display);
    const z = cs.zIndex === 'auto' ? null : Number(cs.zIndex);
    if (z != null && (positioned || flexItem)) return z < 0 ? -1 + z / 1e6 : z === 0 ? 1 : 2 + z / 1e6;
    if (positioned) return 1;
    if (num(cs.opacity) < 1 || cs.transform !== 'none') return 1;
    return 0;
  }

  const TEXT_INPUT = /^(text|email|password|search|tel|number|url|date|)$/;

  let uid = 0;
  const rasters = [];

  function textLines(tn, cs, clip) {
    const data = tn.data;
    const pre = /pre/.test(cs.whiteSpace);
    const range = document.createRange();
    const pieces = [];
    const re = pre ? /[^\n]+/g : /\S+/g;
    let m;
    while ((m = re.exec(data))) {
      range.setStart(tn, m.index);
      range.setEnd(tn, m.index + m[0].length);
      let rects = [...range.getClientRects()].filter((r) => r.width > 0.1);
      if (!rects.length) continue;
      if (rects.length === 1) pieces.push({ s: m.index, e: m.index + m[0].length, r: rects[0] });
      else {
        // слово разорвано переносом — по символам
        for (let i = m.index; i < m.index + m[0].length; i++) {
          range.setStart(tn, i);
          range.setEnd(tn, i + 1);
          const rr = [...range.getClientRects()].filter((r) => r.width > 0.1);
          if (rr.length) pieces.push({ s: i, e: i + 1, r: rr[0] });
        }
      }
    }
    if (!pieces.length) return [];
    const lines = [];
    for (const p of pieces) {
      const last = lines[lines.length - 1];
      if (last && Math.abs(p.r.top - last.top) < p.r.height * 0.5) {
        last.e = p.e;
        last.x2 = Math.max(last.x2, p.r.right);
        last.x1 = Math.min(last.x1, p.r.left);
        last.pieces.push(p);
      } else lines.push({ s: p.s, e: p.e, top: p.r.top, h: p.r.height, x1: p.r.left, x2: p.r.right, pieces: [p] });
    }
    const sy = window.scrollY, sx = window.scrollX;
    const met = metrics(cs);
    const out = [];
    let dropped = false;
    for (const L of lines) {
      let text = data.slice(L.s, L.e);
      if (!pre) text = text.replace(/\s+/g, ' ');
      const box = { x: L.x1 + sx, y: L.top + sy, w: L.x2 - L.x1, h: L.h };
      if (clip) {
        const cy1 = Math.max(box.y, clip.y), cy2 = Math.min(box.y + box.h, clip.y + clip.h);
        if (cy2 - cy1 < box.h * 0.5) { dropped = true; continue; }
        if (box.x + box.w > clip.x + clip.w + 1) {
          // обрезка по ширине: оставляем помещающиеся символы + многоточие (если text-overflow: ellipsis)
          const limit = clip.x + clip.w - (cs.textOverflow === 'ellipsis' ? met.ell : 0) - sx;
          let cut = L.s;
          const rr = document.createRange();
          for (let i = L.s; i < L.e; i++) {
            rr.setStart(tn, i); rr.setEnd(tn, i + 1);
            const r = rr.getBoundingClientRect();
            if (r.width > 0 && r.right > limit) break;
            cut = i + 1;
          }
          text = data.slice(L.s, cut);
          if (!pre) text = text.replace(/\s+/g, ' ');
          text = text.replace(/\s+$/, '') + (cs.textOverflow === 'ellipsis' ? '…' : '');
          box.w = clip.x + clip.w - box.x;
          if (box.x >= clip.x + clip.w) continue;
        }
        if (box.x + box.w < clip.x) continue;
      }
      switch (cs.textTransform) {
        case 'uppercase': text = text.toUpperCase(); break;
        case 'lowercase': text = text.toLowerCase(); break;
        case 'capitalize': text = text.replace(/(^|\s)(\S)/g, (a, b, c) => b + c.toUpperCase()); break;
      }
      out.push({ text, x: R(box.x), x2: R(box.x + box.w), y: R(box.y + met.asc), top: box.y, h: box.h });
    }
    if (dropped && out.length && cs.webkitLineClamp && cs.webkitLineClamp !== 'none') {
      const l = out[out.length - 1];
      if (!l.text.endsWith('…')) l.text = l.text.replace(/[\s,.;:—-]+$/, '') + '…';
    }
    return out;
  }

  function textStyle(cs, opacity) {
    const c = parseColor(cs.color);
    const sw = num(cs.webkitTextStrokeWidth);
    const sc = sw > 0 ? parseColor(cs.webkitTextStrokeColor) : null;
    const ls = cs.letterSpacing === 'normal' ? 0 : num(cs.letterSpacing);
    return {
      family: firstFamily(cs.fontFamily), size: num(cs.fontSize), weight: Number(cs.fontWeight) || 400,
      italic: cs.fontStyle === 'italic', fill: c ? hex(c) : 'none', opacity: c ? R(c.a * opacity) : 1, ls: R(ls),
      stroke: sc ? hex(sc) : null, strokeW: sw, strokeOp: sc ? R(sc.a * opacity) : 1,
      align: cs.textAlign, underline: /underline/.test(cs.textDecorationLine), strike: /line-through/.test(cs.textDecorationLine),
    };
  }

  // Имя слоя
  function layerName(el) {
    if (el.dataset && el.dataset.layer) return el.dataset.layer;
    return window.__autoName ? window.__autoName(el) : null;
  }

  function svgIcon(svg, box, cs, opacity) {
    let vb = svg.getAttribute('viewBox');
    let content = [];
    const kids = [...svg.children];
    const uses = kids.filter((k) => k.tagName.toLowerCase() === 'use');
    let iconId = '';
    if (uses.length === 1 && kids.length === 1) {
      const href = uses[0].getAttribute('href') || uses[0].getAttribute('xlink:href');
      const sym = href && document.querySelector(href);
      iconId = (href || '').replace('#', '');
      if (sym) {
        vb = sym.getAttribute('viewBox') || vb;
        content = [...sym.children];
      }
    } else content = kids;
    if (!vb) vb = `0 0 ${box.w} ${box.h}`;
    const [vx, vy, vw, vh] = vb.split(/[\s,]+/).map(Number);
    const s = Math.min(box.w / vw, box.h / vh);
    const tx = box.x + (box.w - vw * s) / 2 - vx * s, ty = box.y + (box.h - vh * s) / 2 - vy * s;
    const color = parseColor(cs.color) || { r: 0, g: 0, b: 0, a: 1 };
    const colorHex = hex(color);
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#000';
    const ser = new XMLSerializer();
    let markup = content
      .filter((n) => !['title', 'desc'].includes(n.tagName.toLowerCase()))
      .map((n) => {
        const c = n.cloneNode(true);
        c.removeAttribute && c.removeAttribute('class');
        c.querySelectorAll && c.querySelectorAll('[class]').forEach((x) => x.removeAttribute('class'));
        return ser.serializeToString(c);
      })
      .join('')
      .replace(/ xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, '')
      .replace(/currentColor/g, colorHex)
      .replace(/var\(--bg,\s*[^)]+\)/g, bg)
      .replace(/var\(--[\w-]+,\s*([^)]+)\)/g, '$1');
    const fill = cs.fill === 'none' ? 'none' : cs.fill.startsWith('rgb') ? hex(parseColor(cs.fill) || color) : colorHex;
    const stroke = cs.stroke === 'none' ? 'none' : cs.stroke.startsWith('rgb') ? hex(parseColor(cs.stroke) || color) : colorHex;
    return {
      kind: 'icon', iconId, box, markup, transform: `translate(${R(tx)} ${R(ty)}) scale(${Math.round(s * 10000) / 10000})`,
      fill, stroke, sw: num(cs.strokeWidth) || 1, cap: cs.strokeLinecap, join: cs.strokeLinejoin, opacity: R(opacity * color.a),
    };
  }

  function walk(el, clip, opacity, parentCs, depth) {
    if (el.nodeType !== 1) return null;
    if (el.matches(SKIP_SEL)) return null;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.contentVisibility === 'hidden') return null;
    if (cs.backfaceVisibility === 'hidden') {
      let sign = 1;
      for (let e = el, k = 0; e && k < 6; e = e.parentElement, k++) {
        const m = getComputedStyle(e).transform.match(/^matrix3d\(([^)]+)\)/);
        if (m && Number(m[1].split(',')[0]) < 0) sign *= -1;
      }
      if (sign < 0) return null;
    }
    const op = opacity * num(cs.opacity);
    if (op < 0.02) return null;
    if (cs.position === 'absolute' && /rect\(0px,? 0px,? 0px,? 0px\)/.test(cs.clip)) return null;
    if (cs.clipPath && /inset\(50%\)/.test(cs.clipPath)) return null;
    const r = el.getBoundingClientRect();
    const sx = window.scrollX, sy = window.scrollY;
    const box = { x: r.left + sx, y: r.top + sy, w: r.width, h: r.height };
    const tag = el.tagName.toLowerCase();
    const vis = inter(box, clip);
    const clipsKids = cs.overflowX !== 'visible' || cs.overflowY !== 'visible' || (cs.clipPath && cs.clipPath !== 'none' && /inset/.test(cs.clipPath));
    if (!vis && (clipsKids || !el.children.length)) return null;
    if (box.w < 1 && box.h < 1 && clipsKids) return null;

    const name = layerName(el);
    const item = { kind: 'group', name, tier: tierOf(el, cs, parentCs), box, children: [], tag };

    // Растровый снимок: canvas, video, iframe, фильтры (blur), конические градиенты, маски
    const needsRaster =
      ['canvas', 'video', 'iframe'].includes(tag) || (tag === 'input' && el.type === 'range') ||
      (cs.filter && cs.filter !== 'none' && /blur|drop-shadow/.test(cs.filter)) ||
      /conic-gradient/.test(cs.backgroundImage) ||
      (cs.maskImage && cs.maskImage !== 'none') || (cs.webkitMaskImage && cs.webkitMaskImage !== 'none') ||
      el.hasAttribute('data-proto-raster') || (tag === 'svg' && el.querySelector('text, textPath, image, foreignObject')) ||
      (cs.writingMode && cs.writingMode !== 'horizontal-tb' && el.textContent.trim()) ||
      (() => { const m = cs.transform.match(/^matrix\(([^)]+)\)/); if (!m) return false; const v = m[1].split(',').map(Number); return Math.abs(v[1]) > 0.02 || Math.abs(v[2]) > 0.02; })();
    if (needsRaster && vis) {
      const id = 'r' + uid++;
      el.setAttribute('data-proto-rid', id);
      rasters.push({ id, box: vis });
      item.children.push({ kind: 'raster', id, box: vis, name: name ? 'Изображение' : null, opacity: R(op), radius: radii(cs, box.w, box.h) });
      return item;
    }

    if (tag === 'svg') {
      if (!vis) return null;
      const ic = svgIcon(el, box, cs, op);
      ic.name = name;
      ic.tier = item.tier;
      return ic;
    }

    // Фон
    const rad = radii(cs, box.w, box.h);
    const bgc = parseColor(cs.backgroundColor);
    const bgVis = vis || box;
    if (bgc) item.children.push({ kind: 'rect', role: 'bg', box: clipRect(box, clip), radius: rad, fill: hex(bgc), opacity: R(bgc.a * op) });
    if (cs.backgroundImage && cs.backgroundImage !== 'none') {
      const layers = splitTop(cs.backgroundImage).reverse();
      const sizes = splitTop(cs.backgroundSize).reverse();
      const poss = splitTop(cs.backgroundPosition).reverse();
      layers.forEach((layer, i) => {
        if (layer.startsWith('url(')) {
          const url = layer.slice(4, -1).replace(/^["']|["']$/g, '');
          item.children.push({ kind: 'image', role: 'bgimage', src: url, box, vis: bgVis, fit: sizes[i] || 'auto', pos: poss[i] || '0% 0%', radius: rad, opacity: R(op) });
        } else {
          const tb = tileBox(box, sizes[i] || 'auto', poss[i] || '0% 0%');
          const g = parseGradient(layer, tb);
          const small = tb.w < box.w - 0.5 || tb.h < box.h - 0.5;
          if (g) item.children.push({ kind: 'rect', role: 'gradient', name: small ? 'Стрелка' : null, box: clipRect(tb, clip), radius: small ? [0, 0, 0, 0] : rad, gradient: g, opacity: R(op) });
        }
      });
    }
    // Рамка
    const bw = [num(cs.borderTopWidth), num(cs.borderRightWidth), num(cs.borderBottomWidth), num(cs.borderLeftWidth)];
    const bs = [cs.borderTopStyle, cs.borderRightStyle, cs.borderBottomStyle, cs.borderLeftStyle];
    const bcol = [cs.borderTopColor, cs.borderRightColor, cs.borderBottomColor, cs.borderLeftColor].map(parseColor);
    const has = bw.map((w, i) => w > 0 && bs[i] !== 'none' && bs[i] !== 'hidden' && bcol[i]);
    if (has.every(Boolean) && bw.every((w) => w === bw[0]) && bcol.every((c) => hex(c) === hex(bcol[0]) && c.a === bcol[0].a) && bs.every((s) => s === bs[0])) {
      item.children.push({ kind: 'rect', role: 'border', box: clipRect(box, clip), radius: rad, stroke: hex(bcol[0]), sw: bw[0], dash: bs[0] === 'dashed' ? [bw[0] * 3, bw[0] * 2] : bs[0] === 'dotted' ? [bw[0], bw[0] * 1.5] : null, opacity: R(bcol[0].a * op) });
    } else {
      const sides = [
        [has[0], { x: box.x, y: box.y, w: box.w, h: bw[0] }, 'Линия_сверху'],
        [has[1], { x: box.x + box.w - bw[1], y: box.y, w: bw[1], h: box.h }, 'Линия_справа'],
        [has[2], { x: box.x, y: box.y + box.h - bw[2], w: box.w, h: bw[2] }, 'Линия_снизу'],
        [has[3], { x: box.x, y: box.y, w: bw[3], h: box.h }, 'Линия_слева'],
      ];
      sides.forEach(([ok, b, nm], i) => {
        const cb = ok && clipRect(b, clip);
        if (cb) item.children.push({ kind: 'rect', role: 'line', name: nm, box: cb, radius: [0, 0, 0, 0], fill: hex(bcol[i]), opacity: R(bcol[i].a * op) });
      });
    }
    // Контур (outline) — у активных полей
    if (cs.outlineStyle !== 'none' && num(cs.outlineWidth) > 0) {
      const oc = parseColor(cs.outlineColor), ow = num(cs.outlineWidth), oo = num(cs.outlineOffset);
      if (oc) item.children.push({ kind: 'rect', role: 'outline', box: { x: box.x - oo - ow / 2, y: box.y - oo - ow / 2, w: box.w + 2 * oo + ow, h: box.h + 2 * oo + ow }, radius: rad, stroke: hex(oc), sw: ow, opacity: R(oc.a * op) });
    }

    // Картинка
    if (tag === 'img') {
      const src = el.currentSrc || el.src;
      if (src && vis) item.children.push({ kind: 'image', role: 'img', src, box, vis, fit: cs.objectFit, pos: cs.objectPosition, radius: rad, opacity: R(op), alt: el.alt });
      return item;
    }

    // Поля ввода: значение или плейсхолдер
    if ((tag === 'input' && TEXT_INPUT.test(el.type)) || tag === 'textarea' || tag === 'select') {
      let text = tag === 'select' ? el.options[el.selectedIndex]?.text || '' : el.value;
      let st = textStyle(cs, op);
      if (!text && el.placeholder) {
        text = el.placeholder;
        const pcs = getComputedStyle(el, '::placeholder');
        st = textStyle(pcs, op);
        st.family = firstFamily(cs.fontFamily);
      }
      if (el.type === 'password' && el.value) text = '•'.repeat(el.value.length);
      if (text) {
        const met = metrics(cs);
        const pl = num(cs.paddingLeft) + num(cs.borderLeftWidth);
        const pt = num(cs.paddingTop) + num(cs.borderTopWidth), pb = num(cs.paddingBottom) + num(cs.borderBottomWidth);
        let baseline;
        if (tag === 'textarea') baseline = box.y + pt + (num(cs.lineHeight) || met.asc + met.desc) / 2 + (met.asc - met.desc) / 2;
        else baseline = box.y + pt + (box.h - pt - pb) / 2 + (met.asc - met.desc) / 2;
        let x = box.x + pl;
        let anchor = 'start';
        if (cs.textAlign === 'center') { x = box.x + box.w / 2; anchor = 'middle'; }
        let lines = [{ text, x: R(x), y: R(baseline) }];
        if (tag === 'textarea') {
          // перенос по ширине поля и обрезка по высоте
          cnv.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
          const maxW = box.w - pl - num(cs.paddingRight) - num(cs.borderRightWidth) - 2;
          const lh = num(cs.lineHeight) || num(cs.fontSize) * 1.3;
          const maxLines = Math.max(1, Math.floor((box.h - pt - pb) / lh));
          const out = [];
          for (const para of text.split('\n')) {
            let cur = '';
            for (const w of para.split(/\s+/)) {
              const t = cur ? cur + ' ' + w : w;
              if (cnv.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t;
            }
            out.push(cur);
          }
          if (out.length > maxLines) { out.length = maxLines; out[maxLines - 1] = out[maxLines - 1].replace(/\s*\S*$/, '') + '…'; }
          const top = box.y + pt + (lh - (met.asc + met.desc)) / 2 + met.asc;
          lines = out.map((t, i) => ({ text: t, x: R(x), y: R(top + i * lh) }));
        }
        item.children.push({ kind: 'text', name: el.value ? 'Значение' : 'Подсказка', style: st, lines, anchor, tier: 0 });
      }
      return item;
    }

    const kidClip = clipsKids ? inter(clip, box) || { x: box.x, y: box.y, w: 0, h: 0 } : clip;
    // Дети
    for (const n of el.childNodes) {
      if (n.nodeType === 3) {
        if (!n.data.trim()) continue;
        const lines = textLines(n, cs, kidClip);
        if (!lines.length) continue;
        const st = textStyle(cs, op);
        let anchor = 'start';
        if (lines.length > 1 && (cs.textAlign === 'center' || cs.textAlign === 'right' || cs.textAlign === 'end')) {
          anchor = cs.textAlign === 'center' ? 'middle' : 'end';
          for (const l of lines) l.x = anchor === 'middle' ? R((l.x + l.x2) / 2) : l.x2;
        }
        const tb = { x: Math.min(...lines.map((l) => (anchor === 'start' ? l.x : l.x - 10))), y: lines[0].top, w: 10, h: lines[lines.length - 1].top + lines[lines.length - 1].h - lines[0].top };
        item.children.push({ kind: 'text', style: st, lines, anchor, tier: 0, box: tb });
      } else if (n.nodeType === 1) {
        const c = walk(n, kidClip, op, cs, depth + 1);
        if (c) item.children.push(c);
      }
    }
    if (!item.children.length) return null;
    // Положительный z-index потомков поднимает блок, если он сам не создаёт контекст наложения
    const sc = (cs.zIndex !== 'auto' && (cs.position !== 'static' || (parentCs && /flex|grid/.test(parentCs.display)))) || num(cs.opacity) < 1 || cs.transform !== 'none' || cs.position === 'fixed';
    let ub = { ...box };
    for (const c of item.children) {
      if (!sc && (c.tier ?? 0) >= 2 && c.tier > item.tier) item.tier = c.tier;
      const b = c.ubox || c.box;
      if (b && b.w > 0 && b.h > 0) {
        const x2 = Math.max(ub.x + ub.w, b.x + b.w), y2 = Math.max(ub.y + ub.h, b.y + b.h);
        ub.x = Math.min(ub.x, b.x); ub.y = Math.min(ub.y, b.y); ub.w = x2 - ub.x; ub.h = y2 - ub.y;
      }
    }
    item.ubox = ub;
    return item;
  }

  function tileBox(box, size, pos) {
    let w = box.w, h = box.h;
    if (size && !/^(auto|auto auto|cover|contain)$/.test(size)) {
      const p = size.split(/\s+/);
      const L = (v, t) => (v === 'auto' ? null : v.endsWith('%') ? (num(v) / 100) * t : num(v));
      const pw = L(p[0], box.w), ph = p[1] ? L(p[1], box.h) : null;
      w = pw ?? box.w; h = ph ?? box.h;
    }
    const toks = pos.match(/calc\([^)]*\)|\S+/g) || [];
    const off = (v, free) => {
      if (!v) return 0;
      const c = v.match(/calc\(\s*([\d.]+)%\s*([+-])\s*([\d.]+)px\s*\)/);
      if (c) return (free * num(c[1])) / 100 + (c[2] === '-' ? -1 : 1) * num(c[3]);
      if (v.endsWith('%')) return (free * num(v)) / 100;
      return num(v);
    };
    return { x: box.x + off(toks[0], box.w - w), y: box.y + off(toks[1], box.h - h), w, h };
  }

  function clipRect(b, clip) {
    return inter(b, clip) || null;
  }

  // Буквы, разбитые на span для анимации, — обратно в один текст
  window.__protoUnsplit = function () {
    let n = 0;
    for (const el of document.querySelectorAll('body *')) {
      const kids = [...el.children];
      if (kids.length < 3 || el.closest('svg')) continue;
      if (kids.every((k) => k.tagName === 'SPAN' && !k.children.length && k.textContent.length <= 2) && [...el.childNodes].every((c) => c.nodeType === 1 || !c.data.trim())) {
        el.textContent = el.textContent;
        n++;
      }
    }
    return n;
  };

  // Длинные слова в крупных заголовках не должны рваться посередине — уменьшаем кегль
  window.__protoFitWords = function () {
    let n = 0;
    const sel = 'h1, h2, .bh__name, .hs-hero__name, .ip-head__title, .catalog-hero__title, .shop-hero__title, .pp-name';
    for (const el of document.querySelectorAll(sel)) {
      for (let k = 0; k < 14; k++) {
        let broken = false;
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        const range = document.createRange();
        let tn;
        while (!broken && (tn = walker.nextNode())) {
          const re = /\S+/g;
          let m;
          while ((m = re.exec(tn.data))) {
            range.setStart(tn, m.index); range.setEnd(tn, m.index + m[0].length);
            if ([...range.getClientRects()].filter((r) => r.width > 0.5).length > 1) { broken = true; break; }
          }
        }
        if (!broken) break;
        el.style.fontSize = parseFloat(getComputedStyle(el).fontSize) * 0.94 + 'px';
        n++;
      }
    }
    return n;
  };

  window.__protoCapture = function (rootSel, frame) {
    uid = 0;
    rasters.length = 0;
    const root = document.querySelector(rootSel || 'body');
    const clip = { x: 0, y: 0, w: frame.width, h: frame.height };
    const bodyBg = parseColor(getComputedStyle(document.body).backgroundColor) || parseColor(getComputedStyle(document.documentElement).backgroundColor) || { r: 11, g: 11, b: 12, a: 1 };
    const tree = walk(root, clip, 1, null, 0) || { kind: 'group', children: [] };
    return { tree, rasters: rasters.slice(), bg: hex(bodyBg) };
  };

  // Материализуем ::before/::after в реальные элементы, чтобы их можно было нарисовать
  window.__protoPseudos = function () {
    const st = document.createElement('style');
    st.textContent = '[data-np-before]::before{content:none!important;display:none!important}[data-np-after]::after{content:none!important;display:none!important}';
    document.head.appendChild(st);
    const els = [...document.querySelectorAll('body *')];
    let made = 0;
    const plan = [];
    for (const el of els) {
      if (el.closest('svg') || ['input', 'img', 'br', 'hr', 'select', 'textarea', 'iframe', 'canvas'].includes(el.tagName.toLowerCase())) continue;
      const ecs = getComputedStyle(el);
      if (ecs.display === 'none') continue;
      for (const which of ['before', 'after']) {
        const cs = getComputedStyle(el, '::' + which);
        if (!cs.content || cs.content === 'none' || cs.content === 'normal' || cs.display === 'none') continue;
        const hasVisual =
          parseColor(cs.backgroundColor) || (cs.backgroundImage && cs.backgroundImage !== 'none') ||
          num(cs.borderTopWidth) + num(cs.borderBottomWidth) + num(cs.borderLeftWidth) + num(cs.borderRightWidth) > 0 ||
          /^["'].+["']$/.test(cs.content);
        if (!hasVisual) continue;
        const props = {};
        for (let i = 0; i < cs.length; i++) props[cs[i]] = cs.getPropertyValue(cs[i]);
        plan.push({ el, which, props, content: cs.content });
      }
    }
    for (const { el, which, props, content } of plan) {
      const span = document.createElement('span');
      span.setAttribute('data-pseudo', which);
      let css = '';
      for (const [k, v] of Object.entries(props)) {
        if (/^(transition|animation|content|will-change)/.test(k)) continue;
        css += `${k}:${v};`;
      }
      span.style.cssText = css;
      const m = content.match(/^["'](.*)["']$/s);
      if (m) span.textContent = m[1].replace(/\\([0-9a-f]{1,6})\s?/gi, (a, h) => String.fromCodePoint(parseInt(h, 16)));
      if (which === 'before') el.insertBefore(span, el.firstChild);
      else el.appendChild(span);
      el.setAttribute('data-np-' + which, '');
      made++;
    }
    return made;
  };
})();
