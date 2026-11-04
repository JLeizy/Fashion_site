// История Balenciaga (этап 16): разделы собираются из частей balenciaga/part1–10.js в хронологическом и тематическом порядке.
// seed.js (через db/content/index.js) записывает их в brand_history_sections; хронология и директора — из db/seed-data/brands.js.
import part1 from './balenciaga/part1.js';
import part2 from './balenciaga/part2.js';
import part3 from './balenciaga/part3.js';
import part4 from './balenciaga/part4.js';
import part5 from './balenciaga/part5.js';
import part6 from './balenciaga/part6.js';
import part7 from './balenciaga/part7.js';
import part8 from './balenciaga/part8.js';
import part9 from './balenciaga/part9.js';
import part10 from './balenciaga/part10.js';

const [getaria, apprenticeship, georgeV, postwar] = part1;
const [goldenAge, closure, interregnum] = part2;
const [ghesquiere, wang, demna] = part3;
const [shows, iconic, collaborations] = part4;
const [scandals, owners, influence, today, facts] = part5;
const [spain, atelier, fabric] = part6;
const [clients, disciples, fragrances] = part7;
const [ghesquiereSeasons, demnaMethod, popCulture] = part8;
const [showRitual, press, silhouettes, weddings, formArt] = part9;
const [eisa, dayInHouse, museum] = part10;

export default {
  slug: 'balenciaga',
  sections: [
    // 1–3. Предыстория, основание, становление
    getaria, apprenticeship, eisa, spain, georgeV, atelier, dayInHouse, showRitual, fabric, postwar, press, clients, silhouettes, goldenAge, weddings, disciples, closure, interregnum,
    // 4. Креативные директора и их эпохи
    fragrances, ghesquiere, ghesquiereSeasons, wang, demna, demnaMethod,
    // 5–7. Показы, культовые вещи, коллаборации
    shows, iconic, collaborations,
    // 8–12. Кризисы, владельцы, влияние, сегодня, факты
    scandals, owners, influence, formArt, museum, popCulture, today, facts,
  ],
};
