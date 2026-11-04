// История Balenciaga (этап 16): разделы собираются из частей balenciaga/part*.js.
// seed.js (через db/content/index.js) записывает их в brand_history_sections; хронология и директора — из db/seed-data/brands.js.
import part1 from './balenciaga/part1.js';
import part2 from './balenciaga/part2.js';
import part3 from './balenciaga/part3.js';

export default {
  slug: 'balenciaga',
  sections: [...part1, ...part2, ...part3],
};
