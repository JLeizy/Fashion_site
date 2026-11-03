// Графика SVG-заглушек: силуэты вещей (line-art), рамки в микростилистике брендов, цвета товаров.
// Все силуэты нарисованы в локальной системе координат 200×200.

// Цвета товаров (products.color) → заливка силуэта
export const COLOR_HEX = {
  black: '#161616', white: '#F4F2EE', ivory: '#EFE8D8', beige: '#D9C7A7', camel: '#B8915C', brown: '#6B4630',
  grey: '#8C8C8C', silver: '#C9CCD1', gold: '#C9A227', red: '#B3122E', burgundy: '#6E1A2B', pink: '#E8A0B6',
  green: '#2F5D46', khaki: '#8A8456', navy: '#1F2A44', blue: '#3557A0', lightblue: '#9EC1E3', yellow: '#F2D21B',
  purple: '#6B3FA0', orange: '#E07B2A', multicolor: 'url(#multi)',
};

// Относительная яркость цвета #RRGGBB (0…1) — для выбора контрастной обводки
export function luminance(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return 0.45;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Обводка и детали силуэта должны контрастировать с цветом самой вещи
export function inkFor(fillHex, palette) {
  const light = luminance(palette.fg) > 0.4 ? palette.fg : '#EDEAE4';
  const dark = luminance(palette.fg) <= 0.4 ? palette.fg : '#1B1B1B';
  return luminance(fillHex) > 0.3 ? dark : light;
}

// Шрифтовые стеки (внутри <img> веб-шрифты недоступны — только системные)
export const FONTS = {
  grotesk: { family: "Arial, Helvetica, sans-serif", weight: 700, spacing: 7, upper: true },
  'grotesk-heavy': { family: "'Arial Black', Arial, sans-serif", weight: 900, spacing: 2, upper: true, skew: -10 },
  serif: { family: "Georgia, 'Times New Roman', serif", weight: 400, spacing: 6, upper: true },
  'sans-light': { family: "'Helvetica Neue', Arial, sans-serif", weight: 300, spacing: 10, upper: true },
  hand: { family: "'Segoe Script', 'Brush Script MT', 'Comic Sans MS', cursive", weight: 400, spacing: 1, upper: false },
  futura: { family: "'Futura', 'Century Gothic', 'Arial Black', sans-serif", weight: 900, spacing: 0, upper: false, italic: true },
  gothic: { family: "'Old English Text MT', 'UnifrakturMaguntia', 'Times New Roman', serif", weight: 400, spacing: 2, upper: false },
  geometric: { family: "'Century Gothic', 'Futura', Arial, sans-serif", weight: 400, spacing: 9, upper: true },
  didone: { family: "'Didot', 'Bodoni MT', 'Times New Roman', serif", weight: 400, spacing: 8, upper: true },
  mono: { family: "'Courier New', Courier, monospace", weight: 400, spacing: 3, upper: false },
  roman: { family: "'Trajan Pro', 'Times New Roman', serif", weight: 400, spacing: 8, upper: true },
  'serif-italic': { family: "Georgia, 'Times New Roman', serif", weight: 400, spacing: 3, upper: false, italic: true },
  'serif-light': { family: "Georgia, 'Times New Roman', serif", weight: 400, spacing: 9, upper: true },
};

// Каждый силуэт — список фигур: { d, f: заливать ли цветом товара, rule: evenodd, dash: пунктир, w: толщина }
const S = {
  tshirts: [
    { d: 'M60 30 L82 22 Q100 38 118 22 L140 30 L178 60 L160 84 L142 74 L142 182 L58 182 L58 74 L40 84 L22 60 Z', f: 1 },
    { d: 'M82 22 Q100 46 118 22' },
    { d: 'M60 172 L140 172', dash: 1 },
    { d: 'M44 78 L58 70 M156 78 L142 70', w: 0.8 },
  ],
  hoodies: [
    { d: 'M58 54 L36 66 L16 152 L34 158 L50 98 L50 186 L150 186 L150 98 L166 158 L184 152 L164 66 L142 54 Q122 72 100 72 Q78 72 58 54 Z', f: 1 },
    { d: 'M58 54 Q54 12 100 10 Q146 12 142 54 Q122 72 100 72 Q78 72 58 54 Z', f: 1 },
    { d: 'M74 50 Q74 26 100 24 Q126 26 126 50 Q114 60 100 60 Q86 60 74 50 Z', w: 0.9 },
    { d: 'M70 136 L130 136 L138 170 L62 170 Z' },
    { d: 'M92 72 L90 104 M108 72 L110 104' },
    { d: 'M50 176 L150 176 M16 146 L34 152 M184 146 L166 152', dash: 1 },
  ],
  sweaters: [
    { d: 'M62 28 L84 20 Q100 32 116 20 L138 28 L170 52 L186 152 L166 157 L150 86 L150 182 L50 182 L50 86 L34 157 L14 152 L30 52 Z', f: 1 },
    { d: 'M84 20 Q100 40 116 20' },
    { d: 'M50 170 L150 170 M16 142 L35 146 M184 142 L165 146' },
    { d: 'M58 172 L58 182 M66 172 L66 182 M74 172 L74 182 M82 172 L82 182 M90 172 L90 182 M98 172 L98 182 M106 172 L106 182 M114 172 L114 182 M122 172 L122 182 M130 172 L130 182 M138 172 L138 182', w: 0.6 },
    { d: 'M70 70 Q100 82 130 70 M66 100 Q100 112 134 100 M66 130 Q100 142 134 130', w: 0.5, dash: 1 },
  ],
  shirts: [
    { d: 'M64 26 L86 18 L100 36 L114 18 L136 26 L170 48 L186 150 L168 154 L152 84 L152 184 L48 184 L48 84 L32 154 L14 150 L30 48 Z', f: 1 },
    { d: 'M86 18 L100 36 L114 18 L108 10 L100 22 L92 10 Z', f: 1 },
    { d: 'M100 36 L100 184' },
    { d: 'M114 60 L136 60 L136 84 L114 84 Z' },
    { d: 'M100 54 m-2.6 0 a2.6 2.6 0 1 0 5.2 0 a2.6 2.6 0 1 0 -5.2 0 M100 82 m-2.6 0 a2.6 2.6 0 1 0 5.2 0 a2.6 2.6 0 1 0 -5.2 0 M100 110 m-2.6 0 a2.6 2.6 0 1 0 5.2 0 a2.6 2.6 0 1 0 -5.2 0 M100 138 m-2.6 0 a2.6 2.6 0 1 0 5.2 0 a2.6 2.6 0 1 0 -5.2 0 M100 166 m-2.6 0 a2.6 2.6 0 1 0 5.2 0 a2.6 2.6 0 1 0 -5.2 0', w: 0.8 },
  ],
  jackets: [
    { d: 'M60 24 L84 16 L100 72 L116 16 L140 24 L172 46 L186 150 L168 154 L154 88 L154 178 L46 178 L46 88 L32 154 L14 150 L28 46 Z', f: 1 },
    { d: 'M84 16 L72 52 L100 98 L128 52 L116 16' },
    { d: 'M100 98 L100 178' },
    { d: 'M58 132 L84 132 M116 132 L142 132' },
    { d: 'M100 112 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 M100 140 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0' },
    { d: 'M14 144 L32 148 M186 144 L168 148 M46 170 L154 170', dash: 1 },
  ],
  coats: [
    { d: 'M62 20 L86 12 L100 62 L114 12 L138 20 L168 40 L182 160 L164 164 L152 92 L158 196 L42 196 L48 92 L36 164 L18 160 L32 40 Z', f: 1 },
    { d: 'M86 12 L70 46 L100 88 L130 46 L114 12' },
    { d: 'M48 118 L152 118 L152 129 L48 129 Z', f: 1 },
    { d: 'M94 114 L106 114 L106 133 L94 133 Z' },
    { d: 'M86 102 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 M114 102 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 M86 150 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 M114 150 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0' },
    { d: 'M100 129 L100 196', dash: 1 },
  ],
  trousers: [
    { d: 'M56 14 L144 14 L152 192 L112 192 L100 72 L88 192 L48 192 Z', f: 1 },
    { d: 'M56 14 L144 14 L145 28 L55 28 Z', f: 1 },
    { d: 'M76 34 L70 188 M124 34 L130 188', w: 0.8 },
    { d: 'M58 30 Q70 48 82 30 M142 30 Q130 48 118 30' },
    { d: 'M100 28 L100 60', dash: 1 },
  ],
  jeans: [
    { d: 'M54 14 L146 14 L154 192 L112 192 L100 72 L88 192 L46 192 Z', f: 1 },
    { d: 'M54 14 L146 14 L147 28 L53 28 Z', f: 1 },
    { d: 'M56 30 Q72 54 88 30 M144 30 Q128 54 112 30' },
    { d: 'M120 32 L134 32 L134 44 L120 44 Z', w: 0.8 },
    { d: 'M50 70 L60 188 M150 70 L140 188 M100 28 L100 66', dash: 1 },
    { d: 'M64 30 m-1.8 0 a1.8 1.8 0 1 0 3.6 0 a1.8 1.8 0 1 0 -3.6 0 M136 30 m-1.8 0 a1.8 1.8 0 1 0 3.6 0 a1.8 1.8 0 1 0 -3.6 0', w: 0.8 },
  ],
  shorts: [
    { d: 'M54 30 L146 30 L158 126 L112 134 L100 78 L88 134 L42 126 Z', f: 1 },
    { d: 'M54 30 L146 30 L147 44 L53 44 Z', f: 1 },
    { d: 'M58 46 Q70 62 82 46 M142 46 Q130 62 118 46' },
    { d: 'M46 116 L88 122 M154 116 L112 122', dash: 1 },
  ],
  dresses: [
    { d: 'M78 14 L88 14 Q100 32 112 14 L122 14 L128 40 Q120 66 124 84 L172 188 L28 188 L76 84 Q80 66 72 40 Z', f: 1 },
    { d: 'M76 84 Q100 94 124 84' },
    { d: 'M100 94 L96 188 M86 92 L62 188 M114 92 L138 188', w: 0.6 },
    { d: 'M78 14 L72 6 M122 14 L128 6', w: 0.8 },
  ],
  skirts: [
    { d: 'M64 36 L136 36 L174 182 L26 182 Z', f: 1 },
    { d: 'M64 36 L136 36 L137 50 L63 50 Z', f: 1 },
    { d: 'M78 50 L58 182 M92 50 L86 182 M108 50 L114 182 M122 50 L142 182', w: 0.6 },
  ],
  suits: [
    { d: 'M58 22 L84 14 L100 84 L116 14 L142 22 L174 44 L188 152 L170 156 L156 90 L156 184 L44 184 L44 90 L30 156 L12 152 L26 44 Z', f: 1 },
    { d: 'M84 14 L68 50 L84 56 L100 104 L116 56 L132 50 L116 14' },
    { d: 'M100 30 L93 44 L100 98 L107 44 Z', f: 1 },
    { d: 'M122 92 L136 86 L140 96 Z', f: 1 },
    { d: 'M100 120 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 M100 146 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0' },
    { d: 'M56 138 L84 138 M116 138 L144 138' },
  ],
  sneakers: [
    { d: 'M20 136 Q12 116 34 108 L70 100 L100 84 L110 64 Q118 56 128 62 L131 76 Q146 86 160 74 Q176 64 184 80 L189 112 Q191 130 184 136 Z', f: 1 },
    { d: 'M14 136 L192 136 Q199 136 197 148 L195 158 Q193 167 182 167 L28 167 Q13 167 11 154 Q9 140 14 136 Z', f: 1 },
    { d: 'M14 149 L195 149', w: 0.8 },
    { d: 'M28 161 L28 167 M42 161 L42 167 M56 161 L56 167 M70 161 L70 167 M84 161 L84 167 M98 161 L98 167 M112 161 L112 167 M126 161 L126 167 M140 161 L140 167 M154 161 L154 167 M168 161 L168 167', w: 0.6 },
    { d: 'M72 102 Q92 92 108 68', w: 0.9 },
    { d: 'M78 106 L92 94 M86 100 L99 88 M94 94 L106 80 M101 86 L111 72', w: 0.9 },
    { d: 'M40 128 Q92 114 150 120 Q172 120 184 102', w: 1 },
    { d: 'M22 130 Q30 112 56 108', w: 0.8 },
    { d: 'M184 80 L192 70 L196 76 L188 88', w: 0.8 },
  ],
  boots: [
    { d: 'M64 18 L114 18 L116 112 Q142 116 164 128 Q180 136 180 150 L180 158 L52 158 L52 138 L60 130 Z', f: 1 },
    { d: 'M48 158 L184 158 Q188 158 188 164 L188 170 L86 170 L84 188 L52 188 L50 170 Z', f: 1 },
    { d: 'M70 58 Q80 90 70 122 L102 122 Q92 90 102 58 Z', w: 0.8 },
    { d: 'M64 18 L58 6 L74 6 L76 18', w: 0.8 },
    { d: 'M52 150 L184 150', dash: 1 },
  ],
  heels: [
    { d: 'M26 152 Q22 138 40 132 Q80 120 108 100 Q124 88 146 84 Q168 82 174 94 L171 106 L167 188 L160 188 L152 122 Q110 134 60 152 Z', f: 1 },
    { d: 'M108 100 Q132 108 154 96' },
    { d: 'M40 140 Q90 130 150 118', dash: 1, w: 0.7 },
  ],
  loafers: [
    { d: 'M18 146 Q14 126 36 120 Q66 112 96 108 Q108 96 122 96 Q150 100 176 100 Q187 102 187 116 L187 146 Z', f: 1 },
    { d: 'M100 107 Q140 101 182 104', w: 1.1 },
    { d: 'M15 146 L189 146 L189 156 L15 156 Q11 156 11 151 Q11 146 15 146 Z', f: 1 },
    { d: 'M156 156 L189 156 L189 168 L158 168 Z', f: 1 },
    { d: 'M30 130 Q56 114 92 112', dash: 1, w: 0.8 },
    { d: 'M74 114 Q98 104 122 106', w: 1.4 },
    { d: 'M88 109 L110 107 M86 110 m-3.4 0 a3.4 3.4 0 1 0 6.8 0 a3.4 3.4 0 1 0 -6.8 0 M112 107 m-3.4 0 a3.4 3.4 0 1 0 6.8 0 a3.4 3.4 0 1 0 -6.8 0', w: 0.9 },
    { d: 'M150 102 Q166 110 182 106', w: 0.6, dash: 1 },
  ],
  sandals: [
    { d: 'M18 160 Q18 148 34 146 L172 140 Q188 140 188 152 Q188 164 172 164 L34 168 Q18 168 18 160 Z', f: 1 },
    { d: 'M50 146 Q70 106 104 102 Q138 102 150 140', w: 3 },
    { d: 'M118 142 Q130 114 162 110 Q174 114 174 140', w: 3 },
    { d: 'M150 140 Q164 88 178 90', w: 2.4 },
    { d: 'M30 168 L174 162 L174 172 L30 178 Z', f: 1 },
  ],
  totes: [
    { d: 'M38 74 L162 74 L174 188 L26 188 Z', f: 1 },
    { d: 'M70 74 Q70 22 100 22 Q130 22 130 74', w: 2.2 },
    { d: 'M80 74 Q80 34 100 34 Q120 34 120 74', w: 1.2 },
    { d: 'M38 86 L162 86', dash: 1 },
    { d: 'M64 74 L64 86 M136 74 L136 86' },
    { d: 'M100 96 L100 120 M92 120 L108 120', w: 0.8 },
  ],
  crossbody: [
    { d: 'M46 98 Q40 18 100 12 Q160 18 154 98', dash: 1, w: 1.6 },
    { d: 'M40 96 L160 96 Q168 96 168 104 L168 172 Q168 182 158 182 L42 182 Q32 182 32 172 L32 104 Q32 96 40 96 Z', f: 1 },
    { d: 'M32 104 L168 104 L168 140 Q100 156 32 140 Z', f: 1 },
    { d: 'M92 138 L108 138 L108 152 L92 152 Z', w: 1.2 },
  ],
  backpacks: [
    { d: 'M50 40 Q50 22 70 22 L130 22 Q150 22 150 40 L156 182 Q156 192 146 192 L54 192 Q44 192 44 182 Z', f: 1 },
    { d: 'M88 22 Q88 6 100 6 Q112 6 112 22', w: 2 },
    { d: 'M64 112 L136 112 L138 174 L62 174 Z', f: 1 },
    { d: 'M64 122 L136 122', dash: 1 },
    { d: 'M50 52 Q34 100 44 164 M150 52 Q166 100 156 164', w: 1.4 },
    { d: 'M56 56 L144 56', dash: 1 },
  ],
  clutches: [
    { d: 'M22 68 L178 68 Q184 68 184 74 L184 148 Q184 154 178 154 L22 154 Q16 154 16 148 L16 74 Q16 68 22 68 Z', f: 1 },
    { d: 'M16 72 L100 120 L184 72', f: 0 },
    { d: 'M100 120 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0', w: 1.2 },
  ],
  belts: [
    { d: 'M18 104 A82 46 0 1 0 182 104 A82 46 0 1 0 18 104 Z M34 104 A66 32 0 1 1 166 104 A66 32 0 1 1 34 104 Z', f: 1, rule: 1 },
    { d: 'M6 82 L52 82 Q58 82 58 88 L58 120 Q58 126 52 126 L6 126 Q0 126 0 120 L0 88 Q0 82 6 82 Z M10 92 L48 92 L48 116 L10 116 Z', f: 1, rule: 1 },
    { d: 'M30 104 L66 104', w: 1.6 },
    { d: 'M128 142 m-2 0 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0 M142 138 m-2 0 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0 M156 132 m-2 0 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0', w: 0.8 },
  ],
  sunglasses: [
    { d: 'M20 86 Q20 70 38 70 L84 70 Q96 70 96 84 L94 104 Q90 130 62 130 Q28 130 22 106 Z', f: 1 },
    { d: 'M180 86 Q180 70 162 70 L116 70 Q104 70 104 84 L106 104 Q110 130 138 130 Q172 130 178 106 Z', f: 1 },
    { d: 'M96 82 Q100 74 104 82', w: 2 },
    { d: 'M20 80 L4 74 M180 80 L196 74', w: 2.2 },
    { d: 'M34 84 L62 80 M118 80 L146 84', w: 0.8 },
  ],
  headwear: [
    { d: 'M28 124 Q28 52 100 46 Q162 44 170 112 L172 126 Z', f: 1 },
    { d: 'M150 118 Q188 120 198 134 Q172 142 128 134 Z', f: 1 },
    { d: 'M100 46 Q94 86 100 126 M64 56 Q56 92 62 124 M136 54 Q142 90 138 126', w: 0.8 },
    { d: 'M100 46 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0', f: 1 },
    { d: 'M28 124 L172 126', dash: 1 },
  ],
  beanie: [
    { d: 'M42 142 Q38 58 100 50 Q162 58 158 142 Z', f: 1 },
    { d: 'M38 118 L162 118 L162 152 L38 152 Z', f: 1 },
    { d: 'M48 118 L48 152 M58 118 L58 152 M68 118 L68 152 M78 118 L78 152 M88 118 L88 152 M98 118 L98 152 M108 118 L108 152 M118 118 L118 152 M128 118 L128 152 M138 118 L138 152 M148 118 L148 152', w: 0.6 },
    { d: 'M100 50 m-9 -6 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0', f: 1 },
  ],
  scarves: [
    { d: 'M66 20 L104 20 L98 182 L60 182 Z', f: 1 },
    { d: 'M96 44 L134 44 L142 192 L104 192 Z', f: 1 },
    { d: 'M66 20 Q100 2 134 44', w: 2 },
    { d: 'M64 60 L102 60 M64 100 L100 100 M62 140 L99 140 M98 80 L136 80 M100 120 L138 120 M102 160 L140 160', w: 0.7 },
    { d: 'M62 182 L60 194 M70 182 L69 194 M78 182 L78 194 M86 182 L87 194 M94 182 L96 194 M106 192 L105 200 M114 192 L114 200 M122 192 L123 200 M130 192 L132 200 M138 192 L141 200', w: 0.8 },
  ],
  wallets: [
    { d: 'M30 60 L170 60 Q178 60 178 68 L178 150 Q178 158 170 158 L30 158 Q22 158 22 150 L22 68 Q22 60 30 60 Z', f: 1 },
    { d: 'M100 60 L100 158' },
    { d: 'M30 80 L92 80 M30 96 L92 96 M30 112 L92 112 M108 80 L170 80', w: 0.8 },
    { d: 'M28 66 L172 66 L172 152 L28 152 Z', dash: 1, w: 0.6 },
  ],
  gloves: [
    { d: 'M70 188 L70 122 Q60 114 54 98 L40 72 Q36 60 44 58 Q50 56 56 66 L68 90 L66 30 Q66 20 74 20 Q82 20 82 30 L84 82 L88 22 Q88 12 96 12 Q104 12 104 22 L104 82 L110 28 Q110 18 118 18 Q126 18 126 28 L124 88 L132 46 Q134 36 142 36 Q148 38 148 46 L140 114 Q136 132 132 142 L132 188 Z', f: 1 },
    { d: 'M70 166 L132 166' },
    { d: 'M84 82 L84 120 M104 82 L104 120 M124 88 L122 122', w: 0.6, dash: 1 },
  ],
  rings: [
    { d: 'M38 116 A62 40 0 1 0 162 116 A62 40 0 1 0 38 116 Z M54 116 A46 27 0 1 1 146 116 A46 27 0 1 1 54 116 Z', f: 1, rule: 1 },
    { d: 'M74 60 L126 60 L134 82 L66 82 Z', f: 1 },
    { d: 'M96 64 L104 64 L104 68 L110 68 L110 74 L104 74 L104 80 L96 80 L96 74 L90 74 L90 68 L96 68 Z', w: 0.8 },
    { d: 'M48 104 Q60 90 80 86', w: 0.7 },
  ],
  chains: 'CHAIN',
  bracelets: 'BRACELET',
  earrings: [
    { d: 'M64 24 Q54 24 54 36 Q54 48 64 48 L64 70', w: 1.6 },
    { d: 'M64 70 Q46 102 64 126 Q82 102 64 70 Z', f: 1 },
    { d: 'M136 24 Q146 24 146 36 Q146 48 136 48 L136 70', w: 1.6 },
    { d: 'M136 70 Q118 102 136 126 Q154 102 136 70 Z', f: 1 },
    { d: 'M64 136 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0 M136 136 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0', f: 1 },
  ],
  pendants: [
    { d: 'M34 6 Q100 96 166 6', dash: 1, w: 1.4 },
    { d: 'M100 64 m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0', w: 1.4 },
    { d: 'M100 70 L109 80 L106 98 L124 95 L134 103 L124 111 L106 108 L109 156 L100 168 L91 156 L94 108 L76 111 L66 103 L76 95 L94 98 L91 80 Z', f: 1 },
    { d: 'M100 86 L100 150 M80 103 L120 103', w: 0.6 },
  ],
  'fragrance-men': [
    { d: 'M78 16 L122 16 L122 54 L78 54 Z', f: 1 },
    { d: 'M86 54 L114 54 L114 70 L86 70 Z' },
    { d: 'M54 70 L146 70 Q154 70 154 78 L154 182 Q154 190 146 190 L54 190 Q46 190 46 182 L46 78 Q46 70 54 70 Z', f: 1 },
    { d: 'M68 112 L132 112 L132 152 L68 152 Z', w: 0.8 },
    { d: 'M58 84 L58 176', w: 0.7 },
  ],
  'fragrance-women': [
    { d: 'M100 18 m-20 0 a20 20 0 1 0 40 0 a20 20 0 1 0 -40 0', f: 1 },
    { d: 'M90 38 L110 38 L110 62 L90 62 Z' },
    { d: 'M100 62 Q162 68 162 128 Q162 190 100 190 Q38 190 38 128 Q38 68 100 62 Z', f: 1 },
    { d: 'M74 122 L126 122 L126 150 L74 150 Z', w: 0.8 },
    { d: 'M58 104 Q62 84 80 76', w: 0.7 },
  ],
  'fragrance-unisex': [
    { d: 'M84 14 L116 14 L116 62 L84 62 Z', f: 1 },
    { d: 'M60 62 L140 62 L140 190 L60 190 Z', f: 1 },
    { d: 'M60 62 Q100 74 140 62 M60 190 Q100 202 140 190', w: 0.8 },
    { d: 'M72 112 L128 112 L128 146 L72 146 Z', w: 0.8 },
    { d: 'M70 74 L70 182', w: 0.7 },
  ],
};

// Цепь: звенья вдоль U-образной кривой
function chainShapes(withPendant = false) {
  const shapes = [];
  const n = 19;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x = 26 + 148 * t;
    const y = 30 + 128 * (1 - (2 * t - 1) ** 2);
    const angle = (Math.atan2(128 * -4 * (2 * t - 1) * 2 / 148, 1) * 180) / Math.PI;
    const rx = 8.5;
    const ry = i % 2 ? 3.4 : 5;
    shapes.push({ d: `M${(x - rx).toFixed(1)} ${y.toFixed(1)} a${rx} ${ry} ${angle.toFixed(0)} 1 0 ${(2 * rx).toFixed(1)} 0 a${rx} ${ry} ${angle.toFixed(0)} 1 0 ${(-2 * rx).toFixed(1)} 0`, f: i % 2 ? 0 : 1, w: 1.2 });
  }
  if (withPendant) shapes.push({ d: 'M100 158 L106 166 L104 176 L114 174 L120 180 L114 186 L104 184 L106 196 L100 202 L94 196 L96 184 L86 186 L80 180 L86 174 L96 176 L94 166 Z', f: 1 });
  return shapes;
}

// Браслет: звенья по эллипсу в перспективе
function braceletShapes() {
  const shapes = [{ d: 'M24 110 A76 38 0 1 0 176 110 A76 38 0 1 0 24 110 Z', w: 0.6, dash: 1 }];
  const n = 16;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = 100 + 76 * Math.cos(a);
    const y = 110 + 38 * Math.sin(a);
    const r = 6 + 2.5 * Math.sin(a);
    shapes.push({ d: `M${(x - r).toFixed(1)} ${y.toFixed(1)} a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(2 * r).toFixed(1)} 0 a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(-2 * r).toFixed(1)} 0`, f: i % 2 ? 1 : 0, w: 1.1 });
  }
  return shapes;
}

// Выбор силуэта по подкатегории (и уточнение по названию модели)
export function silhouetteFor(category, nameEn = '') {
  const name = nameEn.toLowerCase();
  if (category === 'headwear' && /(beanie|beret)/.test(name)) return S.beanie;
  if (category === 'chains') return chainShapes(/pendant|cross/.test(name));
  if (category === 'bracelets') return braceletShapes();
  return S[category] || S.tshirts;
}

// ---------------------------------------------------------------------
// Рамки и орнаменты в микростилистике брендов (холст W×H)
// ---------------------------------------------------------------------
const cross = (cx, cy, s, color, op = 1) =>
  `<path d="M${cx} ${cy - s} L${cx + s * 0.22} ${cy - s * 0.78} L${cx + s * 0.16} ${cy - s * 0.2} L${cx + s * 0.78} ${cy - s * 0.22} L${cx + s} ${cy} L${cx + s * 0.78} ${cy + s * 0.22} L${cx + s * 0.16} ${cy + s * 0.2} L${cx + s * 0.22} ${cy + s * 0.78} L${cx} ${cy + s} L${cx - s * 0.22} ${cy + s * 0.78} L${cx - s * 0.16} ${cy + s * 0.2} L${cx - s * 0.78} ${cy + s * 0.22} L${cx - s} ${cy} L${cx - s * 0.78} ${cy - s * 0.22} L${cx - s * 0.16} ${cy - s * 0.2} L${cx - s * 0.22} ${cy - s * 0.78} Z" fill="${color}" opacity="${op}"/>`;

const leaf = (x, y, s, rot, color) =>
  `<path transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" d="M0 0 Q12 -14 30 -6 Q14 2 0 0 Z M0 0 Q14 10 26 22 Q10 18 0 0 Z M0 0 L34 -2" fill="none" stroke="${color}" stroke-width="1.2" vector-effect="non-scaling-stroke"/>`;

function greca(x, y, w, unit, color) {
  let d = '';
  for (let i = x; i + unit * 2 <= x + w; i += unit * 2) {
    d += `M${i} ${y + unit} L${i} ${y} L${i + unit * 1.5} ${y} L${i + unit * 1.5} ${y + unit * 0.75} L${i + unit * 0.5} ${y + unit * 0.75} L${i + unit * 0.5} ${y + unit * 0.25} L${i + unit} ${y + unit * 0.25} `;
  }
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.6" vector-effect="non-scaling-stroke"/>`;
}

export function frameFor(style, W, H, p, rng) {
  const fg = p.fg;
  const ac = p.accent;
  const m = Math.round(W * 0.045);
  const parts = [];
  switch (style) {
    case 'grid': {
      let d = '';
      for (let x = m; x <= W - m; x += Math.round(W / 8)) d += `M${x} ${m} L${x} ${H - m} `;
      for (let y = m; y <= H - m; y += Math.round(W / 8)) d += `M${m} ${y} L${W - m} ${y} `;
      parts.push(`<path d="${d}" stroke="${fg}" stroke-width="0.5" opacity="0.07"/>`);
      parts.push(`<rect x="${m}" y="${m}" width="${W - 2 * m}" height="${H - 2 * m}" fill="none" stroke="${fg}" stroke-width="2" opacity="0.5"/>`);
      break;
    }
    case 'tag':
      parts.push(`<rect x="${m}" y="${m}" width="${W - 2 * m}" height="${H - 2 * m}" fill="none" stroke="${fg}" stroke-width="1" opacity="0.35"/>`);
      parts.push(`<g transform="translate(${W - m - W * 0.32} ${H - m - W * 0.16}) rotate(-4)"><rect width="${W * 0.3}" height="${W * 0.12}" fill="${ac}"/><text x="${W * 0.15}" y="${W * 0.078}" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="${W * 0.034}" fill="#111">LIMITED EDITION</text></g>`);
      break;
    case 'botanical':
      parts.push(`<rect x="${m}" y="${m}" width="${W - 2 * m}" height="${H - 2 * m}" fill="none" stroke="${ac}" stroke-width="1.4" opacity="0.8"/>`);
      parts.push(`<rect x="${m + 7}" y="${m + 7}" width="${W - 2 * m - 14}" height="${H - 2 * m - 14}" fill="none" stroke="#C9A45C" stroke-width="0.8" opacity="0.7"/>`);
      [[m + 10, m + 10, 45], [W - m - 10, m + 10, 135], [m + 10, H - m - 10, -45], [W - m - 10, H - m - 10, -135]].forEach(([x, y, r]) => parts.push(leaf(x, y, W / 400, r, '#C9A45C')));
      break;
    case 'minimal':
      parts.push(`<rect x="${m * 1.4}" y="${m * 1.4}" width="${W - 2.8 * m}" height="${H - 2.8 * m}" fill="none" stroke="${fg}" stroke-width="0.6" opacity="0.4"/>`);
      break;
    case 'scratch': {
      const jitter = (v) => v + (rng() - 0.5) * 6;
      let d = `M${jitter(m)} ${jitter(m)}`;
      [[W - m, m], [W - m, H - m], [m, H - m], [m, m]].forEach(([x, y]) => { d += ` L${jitter(x)} ${jitter(y)}`; });
      parts.push(`<path d="${d}" fill="none" stroke="${fg}" stroke-width="1.6" opacity="0.6"/>`);
      for (let i = 0; i < 7; i++) {
        const x = rng() * W;
        const y = rng() * H;
        parts.push(`<path d="M${x} ${y} l${(rng() - 0.5) * 60} ${(rng() - 0.5) * 30}" stroke="${ac}" stroke-width="1" opacity="0.45"/>`);
      }
      break;
    }
    case 'warp':
      parts.push(`<rect x="${m}" y="${m}" width="${W - 2 * m}" height="${H - 2 * m}" fill="none" stroke="${fg}" stroke-width="2.4" transform="rotate(2.4 ${W / 2} ${H / 2}) skewX(-3)"/>`);
      parts.push(`<circle cx="${W * 0.82}" cy="${H * 0.2}" r="${W * 0.09}" fill="${ac}" opacity="0.85"/>`);
      parts.push(`<path d="M${W * 0.1} ${H * 0.78} q${W * 0.08} -${W * 0.12} ${W * 0.18} 0 t${W * 0.18} 0" fill="none" stroke="${ac}" stroke-width="5" stroke-linecap="round"/>`);
      break;
    case 'box':
      parts.push(`<rect x="${m}" y="${m}" width="${W - 2 * m}" height="${H - 2 * m}" fill="none" stroke="${fg}" stroke-width="0.8" opacity="0.18"/>`);
      break;
    case 'cross':
      parts.push(`<rect x="${m}" y="${m}" width="${W - 2 * m}" height="${H - 2 * m}" fill="none" stroke="${ac}" stroke-width="1"/>`);
      parts.push(`<rect x="${m + 6}" y="${m + 6}" width="${W - 2 * m - 12}" height="${H - 2 * m - 12}" fill="none" stroke="${ac}" stroke-width="0.6" stroke-dasharray="2 4"/>`);
      [[m + 6, m + 6], [W - m - 6, m + 6], [m + 6, H - m - 6], [W - m - 6, H - m - 6]].forEach(([x, y]) => parts.push(cross(x, y, W * 0.035, fg)));
      parts.push(cross(W / 2, H - m - W * 0.06, W * 0.022, ac, 0.7));
      break;
    case 'trunk': {
      const c = W * 0.09;
      [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([x, y, sx, sy]) => {
        parts.push(`<path d="M${x} ${y + sy * c} L${x} ${y} L${x + sx * c} ${y}" fill="none" stroke="${ac}" stroke-width="4"/>`);
        parts.push(`<circle cx="${x + sx * c * 0.45}" cy="${y + sy * c * 0.45}" r="2.6" fill="${ac}"/>`);
      });
      parts.push(`<path d="M${m} ${H * 0.3} L${W - m} ${H * 0.3} M${m} ${H * 0.72} L${W - m} ${H * 0.72}" stroke="${ac}" stroke-width="0.8" opacity="0.25"/>`);
      break;
    }
    case 'pearl': {
      let dots = '';
      const step = W / 22;
      for (let x = m; x <= W - m; x += step) dots += `<circle cx="${x}" cy="${m}" r="2.4"/><circle cx="${x}" cy="${H - m}" r="2.4"/>`;
      for (let y = m + step; y < H - m; y += step) dots += `<circle cx="${m}" cy="${y}" r="2.4"/><circle cx="${W - m}" cy="${y}" r="2.4"/>`;
      parts.push(`<g fill="${ac}" opacity="0.85">${dots}</g>`);
      break;
    }
    case 'stitch': {
      const s = W * 0.05;
      [[m, m], [W - m - s, m], [m, H - m], [W - m - s, H - m]].forEach(([x, y]) => parts.push(`<path d="M${x} ${y} l${s} 0" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/><path d="M${x} ${y} l${s} 0" stroke="#999" stroke-width="0.6" stroke-dasharray="2 2"/>`));
      const tw = W * 0.36;
      const th = W * 0.1;
      let nums = '';
      for (let i = 0; i <= 23; i++) {
        const nx = (i % 12) * (tw / 12) + tw / 24;
        const ny = i < 12 ? th * 0.38 : th * 0.78;
        nums += `<text x="${nx}" y="${ny}" text-anchor="middle">${i}</text>`;
      }
      parts.push(`<g transform="translate(${W - m - tw - 6} ${m + 10})"><rect width="${tw}" height="${th}" fill="#FFFFFF" stroke="#D6D3CC"/><g font-family="'Courier New', monospace" font-size="${th * 0.26}" fill="#555">${nums}</g><circle cx="${10 * (tw / 12) + tw / 24}" cy="${th * 0.3}" r="${th * 0.2}" fill="none" stroke="#222" stroke-width="0.8"/></g>`);
      break;
    }
    case 'arch':
      parts.push(`<path d="M${m} ${H - m} L${m} ${H * 0.3} Q${m} ${m} ${W / 2} ${m} Q${W - m} ${m} ${W - m} ${H * 0.3} L${W - m} ${H - m} Z" fill="none" stroke="${fg}" stroke-width="1.2" opacity="0.55"/>`);
      parts.push(`<path d="M${m + 8} ${H - m - 8} L${m + 8} ${H * 0.31} Q${m + 8} ${m + 8} ${W / 2} ${m + 8} Q${W - m - 8} ${m + 8} ${W - m - 8} ${H * 0.31} L${W - m - 8} ${H - m - 8} Z" fill="none" stroke="${ac}" stroke-width="0.6"/>`);
      break;
    case 'greca':
      parts.push(`<rect x="${m}" y="${m}" width="${W - 2 * m}" height="${H - 2 * m}" fill="none" stroke="${ac}" stroke-width="1.2"/>`);
      parts.push(greca(m + 10, m + 8, W - 2 * m - 20, W * 0.028, ac));
      parts.push(greca(m + 10, H - m - 8 - W * 0.028, W - 2 * m - 20, W * 0.028, ac));
      break;
    case 'thorn': {
      let d = `M${m} ${H - m} C ${W * 0.2} ${H * 0.6}, ${W * 0.05} ${H * 0.3}, ${W * 0.25} ${m}`;
      d += ` M${W - m} ${m} C ${W * 0.8} ${H * 0.4}, ${W * 0.95} ${H * 0.7}, ${W * 0.75} ${H - m}`;
      parts.push(`<path d="${d}" fill="none" stroke="${ac}" stroke-width="1.6" opacity="0.8"/>`);
      for (let i = 0; i < 10; i++) {
        const t = i / 9;
        const x = m + (W * 0.25 - m) * t + Math.sin(t * 3) * W * 0.05;
        const y = H - m - (H - 2 * m) * t;
        parts.push(`<path d="M${x} ${y} l6 -3 l-2 7 Z" fill="${ac}" opacity="0.8"/>`);
        parts.push(`<path d="M${W - x} ${H - y} l-6 3 l2 -7 Z" fill="${ac}" opacity="0.8"/>`);
      }
      parts.push(`<circle cx="${W - m - 20}" cy="${m + 20}" r="9" fill="none" stroke="${ac}" stroke-width="1.4"/><circle cx="${W - m - 20}" cy="${m + 20}" r="4" fill="${ac}"/>`);
      break;
    }
    case 'soft':
      parts.push(`<rect x="${m}" y="${m}" width="${W - 2 * m}" height="${H - 2 * m}" rx="${W * 0.06}" fill="none" stroke="${fg}" stroke-width="0.8" opacity="0.35"/>`);
      break;
    default:
      parts.push(`<rect x="${m}" y="${m}" width="${W - 2 * m}" height="${H - 2 * m}" fill="none" stroke="${fg}" stroke-width="1" opacity="0.4"/>`);
  }
  return parts.join('');
}

// Силуэт в виде SVG-разметки: заливка цветом товара, обводка цветом бренда, блик
export function renderSilhouette(shapes, { fill, stroke, strokeWidth = 1.6, sheen = true }) {
  return shapes
    .map((s) => {
      const w = (s.w || 1) * strokeWidth;
      const dash = s.dash ? ' stroke-dasharray="3 3"' : '';
      const rule = s.rule ? ' fill-rule="evenodd"' : '';
      const base = `<path d="${s.d}"${rule} fill="${s.f ? fill : 'none'}" stroke="${stroke}" stroke-width="${w}"${dash} stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
      return s.f && sheen ? `${base}<path d="${s.d}"${rule} fill="url(#sheen)" stroke="none"/>` : base;
    })
    .join('');
}

// Силуэт человека для портретов креативных директоров
export const BUST = [
  { d: 'M100 30 m-30 0 a30 34 0 1 0 60 0 a30 34 0 1 0 -60 0', f: 1 },
  { d: 'M88 62 L88 80 Q50 86 34 110 Q24 128 22 170 L178 170 Q176 128 166 110 Q150 86 112 80 L112 62 Z', f: 1 },
  { d: 'M88 80 L100 108 L112 80', w: 0.8 },
];
