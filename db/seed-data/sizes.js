// Справочник размеров (таблица sizes): соответствие EU / IT / US / INT.
// Одежда — мужская сетка; полная мужская и женская сетки — на странице «Таблица размеров».
export const SIZES = [
  // Одежда: INT → EU / IT / US
  { type: 'clothing', value_int: 'XS', value_eu: '44', value_it: '44', value_us: '34', sort_order: 1 },
  { type: 'clothing', value_int: 'S', value_eu: '46', value_it: '46', value_us: '36', sort_order: 2 },
  { type: 'clothing', value_int: 'M', value_eu: '48', value_it: '48', value_us: '38', sort_order: 3 },
  { type: 'clothing', value_int: 'L', value_eu: '50', value_it: '50', value_us: '40', sort_order: 4 },
  { type: 'clothing', value_int: 'XL', value_eu: '52', value_it: '52', value_us: '42', sort_order: 5 },
  { type: 'clothing', value_int: 'XXL', value_eu: '54', value_it: '54', value_us: '44', sort_order: 6 },
  // Обувь: EU = IT, US — мужская сетка
  ...[
    ['35', '4'], ['36', '4.5'], ['37', '5'], ['38', '6'], ['39', '6.5'], ['40', '7'],
    ['41', '8'], ['42', '9'], ['43', '10'], ['44', '10.5'], ['45', '11.5'], ['46', '12'],
  ].map(([eu, us], i) => ({ type: 'shoes', value_int: eu, value_eu: eu, value_it: eu, value_us: us, sort_order: 10 + i })),
  // Кольца: INT — внутренний диаметр в мм (размер СНГ), EU — длина окружности
  { type: 'ring', value_int: '16', value_eu: '50', value_it: '10', value_us: '5.5', sort_order: 30 },
  { type: 'ring', value_int: '16.5', value_eu: '52', value_it: '12', value_us: '6', sort_order: 31 },
  { type: 'ring', value_int: '17', value_eu: '53', value_it: '13', value_us: '6.5', sort_order: 32 },
  { type: 'ring', value_int: '17.5', value_eu: '55', value_it: '15', value_us: '7', sort_order: 33 },
  { type: 'ring', value_int: '18', value_eu: '57', value_it: '17', value_us: '8', sort_order: 34 },
  { type: 'ring', value_int: '19', value_eu: '60', value_it: '20', value_us: '9', sort_order: 35 },
  { type: 'ring', value_int: '20', value_eu: '63', value_it: '23', value_us: '10', sort_order: 36 },
  // Единый размер
  { type: 'one_size', value_int: 'OS', value_eu: 'OS', value_it: 'OS', value_us: 'OS', sort_order: 40 },
  // Объём флакона
  { type: 'volume_ml', value_int: '30 ml', value_eu: '30 ml', value_it: '30 ml', value_us: '1 fl oz', sort_order: 50 },
  { type: 'volume_ml', value_int: '50 ml', value_eu: '50 ml', value_it: '50 ml', value_us: '1.7 fl oz', sort_order: 51 },
  { type: 'volume_ml', value_int: '100 ml', value_eu: '100 ml', value_it: '100 ml', value_us: '3.4 fl oz', sort_order: 52 },
];

// Какие размеры получает товар в зависимости от типа сетки и пола
export function sizeLabelsFor(sizeType, gender, rand) {
  switch (sizeType) {
    case 'clothing':
      if (gender === 'women') return ['XS', 'S', 'M', 'L', 'XL'];
      if (gender === 'men') return ['S', 'M', 'L', 'XL', 'XXL'];
      return ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
    case 'shoes':
      if (gender === 'women') return ['35', '36', '37', '38', '39', '40', '41'];
      if (gender === 'men') return ['39', '40', '41', '42', '43', '44', '45', '46'];
      return ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45'];
    case 'ring':
      return ['16', '16.5', '17', '17.5', '18', '19', '20'];
    case 'volume_ml':
      return rand() < 0.35 ? ['30 ml', '50 ml', '100 ml'] : ['50 ml', '100 ml'];
    default:
      return ['OS'];
  }
}
