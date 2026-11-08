// Правила разбора реальных карточек товаров (scripts/build-catalog.js):
// подкатегория сайта, цвет, материал и пол — по названию и описанию товара в магазине-источнике.

const has = (text, re) => re.test(text);

// Подкатегория по названию (и типу из магазина). Порядок важен: «wallet on chain» — сумка, «belt bag» — сумка,
// «earring» — не кольцо. null — вещь, для которой на сайте нет раздела (часы, брелоки, чехлы, пыльники…).
export function categoryOf(name, extra = '') {
  const t = ` ${String(name).toLowerCase()} ${String(extra).toLowerCase()} `;
  if (has(t, /watch|suitcase|luggage|trunk\b|rolling|cosmetic|toiletry|vanity case|bag charm|key ?ring|keychain|key holder|key pouch|strap\b|dust ?bag|\b(gift|storage|jewelry|jewellery|trinket|watch) box\b|box only|tie\b|bow tie|pet |dog |leash|collar\b|cleaning|repair|protector|insert|organizer|phone|airpods|ipad|laptop|agenda|notebook|pen\b|lighter|playing card|umbrella|towel|blanket|pillow|cushion|mask\b|brooch|hair ?clip|barrette|scrunchie|lanyard|patch\b|sticker|skateboard|deck\b|book\b/)) return null;
  if (has(t, /eau de|parfum|perfume|fragrance|cologne|\bscent|\bn°\s?5|no\.\s?5\b|body (oil|cream|lotion)|candle/)) return t.includes('candle') ? 'homeware' : 'fragrance';
  if (has(t, /baccarat|tumbler|decanter|\bvase|ashtray|\bglass(es)? set|old fashion|plate\b|bowl\b|\bcup\b|\btray\b|coaster/)) return 'homeware';
  if (has(t, /sunglass|eyewear|glasses|optical|frames?\b/)) return 'sunglasses';
  if (has(t, /backpack/)) return 'backpacks';
  if (has(t, /wallet on chain|\bwoc\b|belt bag|waist bag|bum bag|camera bag|messenger|crossbody|cross-body|shoulder bag|flap bag|saddle|satchel|baguette|\bhobo|vanity|evening bag|bowling|bucket bag|\bbag\b|handbag/) && !has(t, /bag charm/)) {
    if (has(t, /tote|shopper|shopping bag|neverfull|speedy|keepall|duffle|duffel|weekender|travel bag|basket|bucket bag|bowling|large/)) return 'totes';
    if (has(t, /clutch|minaudi|pouch|evening bag|wristlet/)) return 'clutches';
    return 'crossbody';
  }
  if (has(t, /tote|shopper|neverfull|speedy|keepall|duffle|duffel|weekender/)) return 'totes';
  if (has(t, /clutch|minaudi|\bpouch|pochette|wristlet/)) return 'clutches';
  if (has(t, /wallet|card ?holder|card case|coin (purse|case)|zippy|passport|billfold|money clip/)) return 'wallets';
  if (has(t, /earring|ear cuff|\bhoops?\b/) || (has(t, /\bstuds?\b/) && !has(t, /sandal|pump|boot|sneaker|loafer|bag|belt|slide|heel|shoe/))) return 'earrings';
  if (has(t, /bracelet|bangle/) || (has(t, /cuff\b/) && !has(t, /beanie|hat\b|cap\b|jeans|pant|shirt|sleeve/))) return 'bracelets';
  if (has(t, /sneaker|trainer|runner\b|running shoe/)) return 'sneakers';
  if (has(t, /\bboots?\b|bootie/)) return 'boots';
  if (has(t, /loafer|moccasin|derby|oxford|lace-up shoe|brogue/)) return 'loafers';
  if (has(t, /sandal|slide|mule|slipper|espadrille|flip[- ]flop|thong sandal/)) return 'sandals';
  if (has(t, /\bpumps?\b|\bheels?\b|slingback|ballerina|ballet|\bflats\b|mary jane/)) return 'heels';
  if (has(t, /scarf|stole|shawl|bandeau|twilly|foulard|carré|square\b/)) return 'scarves';
  if (has(t.replace(/\b[do][- ]ring|key ?ring|ring bag|ring strap/g, ''), /\bring\b|\brings\b|band ring/)) return 'rings';
  if (has(t, /pendant|charm\b/)) return 'pendants';
  if (has(t, /necklace|chain\b|choker|collier/)) return 'chains';
  if (has(t, /\bcross\b/) && has(t, /silver|gold|sterling|925/)) return 'pendants';
  if (has(t, /\bbelt\b/)) return 'belts';
  if (has(t, /\bhat\b|\bcap\b|beanie|beret|balaclava|headband|bucket hat|headwear/)) return 'headwear';
  if (has(t, /glove|mitten/)) return 'gloves';
  if (has(t, /\bsocks?\b/)) return 'socks';
  if (has(t, /boxer|\bbriefs?\b|\bbra\b|bralette|thong|panty|panties|underwear|legging|bodysuit|long johns/) && !has(t, /\btee\b|t-shirt|top\b/)) return 'underwear';
  if (has(t, /\bjacket|\bbomber|\bparka|\bcoat\b/) && !has(t, /sweatshirt/)) return has(t, /trench|\bcoat\b|parka/) ? 'coats' : 'jackets';
  if (has(t, /hoodie|hooded|sweatshirt|zip-up|zip up/)) return 'hoodies';
  if (has(t, /t-shirt|\btee\b|\bpolo\b|tank top|long ?sleeve|longsleeve|\btank\b/)) return 'tshirts';
  if (has(t, /sweater|cardigan|pullover|jumper|turtleneck|crewneck|knit\b|knitted/)) return 'sweaters';
  if (has(t, /\bjeans\b|denim trouser|denim pant/)) return 'jeans';
  if (has(t, /trench|\bcoat\b|parka|overcoat|\bcape\b|peacoat/)) return 'coats';
  if (has(t, /jacket|blazer|bomber|blouson|puffer|\bvest\b|gilet|windbreaker|overshirt|anorak|down jacket/)) return 'jackets';
  if (has(t, /shirt|blouse/)) return 'shirts';
  if (has(t, /\bshorts?\b|bermuda/)) return 'shorts';
  if (has(t, /trouser|\bpants?\b|jogger|sweatpant|track pant|chino|lounge pant/)) return 'trousers';
  if (has(t, /dress|gown/)) return 'dresses';
  if (has(t, /skirt/)) return 'skirts';
  if (has(t, /\bsuit\b/)) return 'suits';
  return null;
}

// Цвет: первое найденное в тексте название цвета → код цвета сайта
const COLOR_RULES = [
  ['multicolor', /multicolou?r|multi-colou?r|\bmulti\b|rainbow|print(ed)? multi/],
  ['lightblue', /light blue|sky blue|baby blue|pale blue|powder blue|light-blue|azur/],
  ['navy', /\bnavy|midnight|dark blue|marine\b|ink\b/],
  ['ivory', /ivory|\becru|cream|cr[eè]me|off-white|off white|chalk|bone\b|eggshell/],
  ['black', /\bblack|\bnoir|\bnero\b|jet\b|onyx|ebony/],
  ['white', /\bwhite|\bblanc|\bbianco|optic/],
  ['beige', /beige|\bsand\b|nude|taupe|stone\b|natural\b|oatmeal|greige|parchment|linen colou?r/],
  ['camel', /camel|\btan\b|cognac|caramel|honey|biscuit|toffee|ochre/],
  ['brown', /brown|marron|chocolate|\bebene|\bmoka|mocha|coffee|havana|tortoise|monogram|damier ebene|chestnut|cacao|cocoa|walnut/],
  ['grey', /\bgr[ae]y|anthracite|charcoal|slate|graphite|smoke|heather|ash\b|melange|silver gr/],
  ['silver', /silver|sterling|palladium|metallic\b|chrome\b|steel/],
  ['gold', /\bgold|brass\b|champagne/],
  ['burgundy', /burgundy|bordeaux|wine|maroon|oxblood|plum|cherry|merlot|grenade|amarante/],
  ['red', /\bred\b|scarlet|crimson|rouge|rosso|cardinal|coquelicot|cerise\b/],
  ['pink', /pink|\brose\b|fuchsia|blush|magenta|peach|coral pink|ballerina/],
  ['khaki', /khaki|olive|military|army/],
  ['green', /green|emerald|mint|sage|verde|forest|bottle\b|jade/],
  ['blue', /\bblue|cobalt|royal\b|denim|indigo|turquoise|teal|azure|bleu/],
  ['yellow', /yellow|mustard|lemon|\bgiallo/],
  ['purple', /purple|violet|lilac|lavender|mauve|amethyst/],
  ['orange', /orange|coral|tangerine|rust\b|terracotta/],
];
export function colorOf(...texts) {
  for (const text of texts) {
    // «22K Yellow Gold», «Rose Gold» — это золото, а не жёлтый / розовый
    const t = ` ${String(text || '').toLowerCase()} `.replace(/\b(yellow|rose|white|pink|beige)\s+gold\b/g, 'gold');
    let best = null;
    for (const [code, re] of COLOR_RULES) {
      const m = re.exec(t);
      if (m && (!best || m.index < best.index)) best = { code, index: m.index };
    }
    if (best) return best.code;
  }
  return null;
}

// Материал (коды из i18n «materials»)
const MATERIAL_RULES = [
  ['gold22k', /22k|22 k|22-karat|22kt/],
  ['gold18k', /18k|18 k|18-karat|18kt|750 gold|yellow gold|white gold|rose gold|beige gold/],
  ['silver925', /sterling|silver 925|925 silver|\.925/],
  ['acetate', /acetate|sunglass|eyewear/],
  ['vicuna', /vicu[nñ]a/],
  ['cashmere', /cashmere|baby cashmere/],
  ['mohair', /mohair/],
  ['tweed', /tweed|bouclé|boucle/],
  ['silk', /\bsilk/],
  ['suede', /suede|nubuck/],
  ['canvas', /canvas|toile|monogram|damier|raffia|straw|jacquard canvas/],
  ['denim', /denim|jeans/],
  ['leather', /leather|calfskin|lambskin|caviar|patent|goatskin|crocodile|python|grained|vachetta|epi\b|saffiano|spazzolato/],
  ['nylon', /nylon|re-nylon|technical fabric/],
  ['wool', /\bwool|merino|alpaca|flannel/],
  ['linen', /linen/],
  ['velvet', /velvet/],
  ['viscose', /viscose|rayon/],
  ['knit', /knit/],
  ['mesh', /mesh/],
  ['rubber', /rubber/],
  ['polyester', /polyester|fleece/],
  ['cotton', /cotton|jersey|poplin|terry|piqu/],
  ['brass', /metal|brass|gold-tone|silver-tone|enamel|resin|strass|pearl/],
];
const DEFAULT_MATERIAL = {
  sneakers: 'leather', boots: 'leather', heels: 'leather', loafers: 'leather', sandals: 'leather',
  totes: 'leather', crossbody: 'leather', backpacks: 'nylon', clutches: 'leather', wallets: 'leather', belts: 'leather',
  sunglasses: 'acetate', headwear: 'cotton', scarves: 'silk', gloves: 'leather', socks: 'cotton', underwear: 'cotton',
  rings: 'brass', chains: 'brass', bracelets: 'brass', earrings: 'brass', pendants: 'brass',
  fragrance: 'glass', homeware: 'glass', sweaters: 'wool', coats: 'wool', jackets: 'nylon', jeans: 'denim',
};
export function materialOf(category, name, ...texts) {
  // Сначала — материал из названия вещи («Grained Calfskin … Bag»), потом — из описания
  const fromName = materialOf2(category, String(name || '').toLowerCase(), false);
  if (fromName) return fromName;
  return materialOf2(category, texts.map((x) => String(x || '').toLowerCase()).join(' '), true);
}
function materialOf2(category, t, useDefault) {
  if (category === 'fragrance' || category === 'homeware') return 'glass';
  if (category === 'sunglasses') return /metal|titanium/.test(t) && !/acetate/.test(t) ? 'brass' : 'acetate';
  // Сумки, обувь, ремни и одежда — по основному материалу, а не по металлической фурнитуре
  const soft = !['rings', 'chains', 'bracelets', 'earrings', 'pendants'].includes(category);
  for (const [code, re] of MATERIAL_RULES) {
    if (soft && ['silver925', 'gold22k', 'gold18k', 'brass'].includes(code)) continue;
    if (re.test(t)) return code;
  }
  return useDefault ? DEFAULT_MATERIAL[category] || 'cotton' : null;
}

// Слова цвета, размеры и служебные хвосты убираются из названия модели (для объединения цветов одной модели)
export function modelKey(name) {
  let t = ` ${String(name).toLowerCase()} `;
  for (const [, re] of COLOR_RULES) t = t.replace(new RegExp(re.source, 'g'), ' ');
  return t.replace(/\b(and|&|tone|size|sz)\b/g, ' ').replace(/\b\d+(\.\d+)?\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
}

export const titleCase = (s) =>
  String(s)
    .toLowerCase()
    .replace(/(^|[\s(/-])([a-zà-ÿ])/g, (m, a, b) => a + b.toUpperCase())
    .replace(/\b(Of|And|In|With|On|The|A|De|Du|La|Le)\b/g, (w) => w.toLowerCase())
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/\bT-shirt\b/gi, 'T-Shirt')
    // Аббревиатуры и коды моделей — заглавными: 3XL, 5AC, 4G, XS, GV, CH, LV, GG
    .replace(/\b(\d+[a-z]{1,3}|xs|xl|xxl|gv|ch|lv|gg|bb|mm|pm|gm|nyc|usa|uk|uv|tv|ny|la)\b/gi, (w) => (/^\d+(mm|cm|ml)$|^\d{3,}g$/i.test(w) ? w.toLowerCase() : w.toUpperCase()));

// Последнее «существительное вещи» в названии (Fashionphile: «… Chain Wallet 85 34 Black» → после него — размер и цвет)
export const ITEM_NOUN = /\b(bag|bags|tote|hobo|backpack|pouch|wristlet|clutch|wallet|case|holder|duffle|duffel|keepall|speedy|neverfull|pochette|satchel|bucket|crossbody|messenger|alma|lockit|capucines|onthego|favorite|felicie|montsouris|noe|bumbag|dauphine|coussin|twist|cerise|polochon|boite|keepall|loafers?|sneakers?|trainers?|boots?|booties|loafers?|pumps?|heels|sandals?|slides?|mules?|slippers?|espadrilles|flats|belt|scarf|shawl|stole|hat|cap|beanie|gloves|bracelet|cuff|bangle|ring|necklace|pendant|chain|earrings?|studs|sunglasses|glasses|jacket|coat|sweater|cardigan|shirt|t-shirt|tee|hoodie|sweatshirt|pants|trousers|jeans|shorts|skirt|dress|blazer|vest|top)\b/gi;

// ---------- Русское название: тип вещи по-русски + название модели латиницей («Кроссовки Triple S») ----------
const RU_NOUNS = [
  [/wallet on chain|\bwoc\b/i, 'Сумка Wallet on Chain'], [/belt bag|waist bag|bum ?bag|bumbag/i, 'Поясная сумка'], [/backpack/i, 'Рюкзак'],
  [/card ?holder|card case/i, 'Кардхолдер'], [/coin purse|coin case/i, 'Монетница'], [/wallet/i, 'Кошелёк'], [/clutch|minaudi/i, 'Клатч'],
  [/crossbody/i, 'Сумка'], [/\bpouch|pochette|wristlet/i, 'Клатч'], [/tote|shopper|shopping bag/i, 'Сумка-тоут'], [/duffle|duffel|keepall|weekender|travel bag/i, 'Дорожная сумка'],
  [/bucket bag/i, 'Сумка-ведро'], [/messenger/i, 'Сумка-мессенджер'], [/\bbag\b|hobo|satchel|speedy|neverfull|alma|lockit|capucines|onthego|favorite|baguette|crossbody/i, 'Сумка'],
  [/sneaker|trainer/i, 'Кроссовки'], [/over[- ]the[- ]knee|knee[- ]high|thigh[- ]high|knee|riding|tall boot/i, 'Сапоги'], [/\bboots?\b|bootie/i, 'Ботинки'], [/loafer|moccasin/i, 'Лоферы'],
  [/derby|oxford|lace-up|brogue/i, 'Туфли'], [/slingback/i, 'Слингбэки'], [/ballerina|ballet|\bflats\b/i, 'Балетки'], [/mary jane/i, 'Туфли Мэри Джейн'],
  [/\bpumps?\b|\bheels?\b/i, 'Туфли'], [/\bslides?\b|flip[- ]flop/i, 'Шлёпанцы'], [/\bmules?\b/i, 'Мюли'], [/slipper/i, 'Тапочки'], [/espadrille/i, 'Эспадрильи'],
  [/sandal/i, 'Сандалии'], [/sunglass|glasses|eyewear/i, 'Солнцезащитные очки'], [/\bbelt\b/i, 'Ремень'], [/bandeau/i, 'Платок-бандо'],
  [/scarf|stole|shawl|foulard|twilly/i, 'Шарф'], [/beanie/i, 'Шапка'], [/\bcap\b/i, 'Кепка'], [/fedora|bucket hat|\bhat\b/i, 'Шляпа'], [/beret/i, 'Берет'],
  [/glove|mitten/i, 'Перчатки'], [/\bsocks?\b/i, 'Носки'], [/t-shirt|\btee\b/i, 'Футболка'], [/boxer/i, 'Боксеры'], [/\bbra\b|bralette/i, 'Бюстгальтер'], [/legging/i, 'Леггинсы'],
  [/long johns/i, 'Кальсоны'], [/thong|brief|panty|panties/i, 'Трусы'], [/earring|\bstuds?\b|hoops?\b/i, 'Серьги'], [/bracelet|bangle|cuff/i, 'Браслет'],
  [/pendant|charm/i, 'Подвеска'], [/choker/i, 'Чокер'], [/necklace/i, 'Колье'], [/\bchain\b/i, 'Цепь'], [/\bring\b/i, 'Кольцо'],
  [/extrait/i, 'Духи'], [/eau de parfum|parfum|perfume|roll-on/i, 'Парфюмерная вода'], [/eau de toilette/i, 'Туалетная вода'], [/soap/i, 'Мыло'], [/candle/i, 'Ароматическая свеча'],
  [/tumbler|old fashion|\bglass\b/i, 'Стакан'], [/decanter/i, 'Графин'], [/vase/i, 'Ваза'], [/ashtray/i, 'Пепельница'], [/tray/i, 'Поднос'],
  [/hoodie|hooded sweatshirt|hooded/i, 'Худи'], [/sweatshirt/i, 'Свитшот'], [/cardigan/i, 'Кардиган'], [/turtleneck/i, 'Водолазка'], [/sweater|pullover|jumper|knit/i, 'Свитер'],
  [/polo/i, 'Поло'], [/long ?sleeve/i, 'Лонгслив'], [/tank|vest top/i, 'Майка'], [/t-shirt|\btee\b/i, 'Футболка'], [/overshirt/i, 'Рубашка-куртка'],
  [/blouse/i, 'Блуза'], [/shirt/i, 'Рубашка'], [/trench/i, 'Тренч'], [/parka/i, 'Парка'], [/\bcoat\b|overcoat|peacoat/i, 'Пальто'], [/blazer/i, 'Блейзер'],
  [/bomber/i, 'Бомбер'], [/puffer|down jacket/i, 'Пуховик'], [/\bvest\b|gilet/i, 'Жилет'], [/jacket|blouson|anorak|windbreaker/i, 'Куртка'],
  [/\bjeans\b/i, 'Джинсы'], [/shorts?\b|bermuda/i, 'Шорты'], [/jogger|sweatpant|track pant/i, 'Джоггеры'], [/trouser|pants?\b/i, 'Брюки'],
  [/dress|gown/i, 'Платье'], [/skirt/i, 'Юбка'], [/\bsuit\b/i, 'Костюм'],
];
const CATEGORY_RU_ONE = {
  tshirts: 'Футболка', hoodies: 'Худи', sweaters: 'Свитер', shirts: 'Рубашка', jackets: 'Куртка', coats: 'Пальто', trousers: 'Брюки', jeans: 'Джинсы',
  shorts: 'Шорты', dresses: 'Платье', skirts: 'Юбка', suits: 'Костюм', underwear: 'Бельё', sneakers: 'Кроссовки', boots: 'Ботинки', heels: 'Туфли',
  loafers: 'Лоферы', sandals: 'Сандалии', totes: 'Сумка', crossbody: 'Сумка', backpacks: 'Рюкзак', clutches: 'Клатч', belts: 'Ремень',
  sunglasses: 'Солнцезащитные очки', headwear: 'Головной убор', scarves: 'Шарф', wallets: 'Кошелёк', gloves: 'Перчатки', socks: 'Носки',
  rings: 'Кольцо', chains: 'Цепь', bracelets: 'Браслет', earrings: 'Серьги', pendants: 'Подвеска', fragrance: 'Аромат', homeware: 'Предмет интерьера',
};
// Слова, которые не нужны в названии модели: тип вещи, материал (он указан отдельно), пол, служебные
const DROP = /(?<![\w-])(bags?|totes?|shopper|backpacks?|wallets?|card ?holders?|card case|clutch|pouch|sneakers?|trainers?|boots?|booties|loafers?|pumps?|heels?|sandals?|slides?|mules?|slippers?|flats?|sunglasses|glasses|belt|scarf|shawl|stole|cap|hat|beanie|gloves?|socks?|earrings?|bracelets?|necklace|pendant|chain|rings?|t-shirt|tee|shirt|hoodie|hooded|sweatshirt|sweater|cardigan|jacket|coat|trousers?|pants|jeans|shorts?|skirt|dress|blazer|bomber|vest|calfskin|lambskin|nappa|goatskin|leather|suede|nubuck|patent|grained|textured|glossy|shiny|smooth|canvas|nylon|cotton|wool|silk|jersey|knit|knitted|metal|brass|acetate|sterling|silver|resin|velvet|denim|mens|womens|men's|women's|unisex|brief|briefs|ankle|low-top|high-top|wristlet|crossbody|messenger|shoulder|top handle|eau de parfum|perfume|roll-on)(?![\w-])/gi;
// Материалы в названиях Chanel («Pumps, Suede Kidskin») → по-русски
const MATERIAL_RU = [
  [/turtle effect embossed/i, 'тиснение под черепаху'], [/crocodile embossed/i, 'тиснение под крокодила'], [/embroidered sequins/i, 'вышивка пайетками'],
  [/braided rattan/i, 'плетёный ротанг'], [/imitation pearls/i, 'искусственный жемчуг'], [/glass pearls/i, 'стеклянный жемчуг'], [/lacquered metal/i, 'лакированный металл'],
  [/gold-tone metal/i, 'золотистый металл'], [/silver-tone metal/i, 'серебристый металл'], [/ruthenium-finish metal/i, 'металл с рутением'],
  [/patent calfskin/i, 'лакированная телячья кожа'], [/grained calfskin/i, 'зернистая телячья кожа'], [/suede calfskin/i, 'замша'], [/suede kidskin/i, 'замша козлёнка'],
  [/lambskin/i, 'кожа ягнёнка'], [/calfskin/i, 'телячья кожа'], [/kidskin/i, 'кожа козлёнка'], [/goatskin/i, 'козья кожа'], [/suede/i, 'замша'], [/patent/i, 'лак'],
  [/raffia/i, 'рафия'], [/canvas/i, 'канва'], [/tweed/i, 'твид'], [/cotton/i, 'хлопок'], [/fabric/i, 'текстиль'], [/caoutchouc/i, 'каучук'], [/wood/i, 'дерево'],
  [/beads/i, 'бисер'], [/strass/i, 'стразы'], [/resin/i, 'смола'], [/enamel/i, 'эмаль'], [/fringed/i, 'бахрома'], [/metal/i, 'металл'], [/silk/i, 'шёлк'],
  [/wool/i, 'шерсть'], [/cashmere/i, 'кашемир'], [/acetate/i, 'ацетат'], [/crystal/i, 'кристаллы'], [/pearls?/i, 'жемчуг'], [/shell/i, 'перламутр'],
];
function materialsRu(text) {
  let rest = ` ${text} `;
  const out = [];
  for (const [re, ru] of MATERIAL_RU) {
    const m = new RegExp(re.source, 'i').exec(rest);
    if (m) {
      out.push([m.index, ru]);
      rest = rest.replace(new RegExp(re.source, 'gi'), (x) => ' '.repeat(x.length));
    }
  }
  return out.sort((a, b) => a[0] - b[0]).map((x) => x[1]).join(', ');
}
const SHOE_CATS = new Set(['sneakers', 'boots', 'heels', 'loafers', 'sandals']);
const SHOE_NOUNS = new Set(['Кроссовки', 'Сапоги', 'Ботинки', 'Лоферы', 'Туфли', 'Слингбэки', 'Балетки', 'Туфли Мэри Джейн', 'Шлёпанцы', 'Мюли', 'Тапочки', 'Эспадрильи', 'Сандалии']);
export function ruName(nameEn, category) {
  // Формат Chanel: «<вещь>, <материалы>» → «Туфли — замша козлёнка»
  const comma = String(nameEn).indexOf(', ');
  if (comma > 0 && !/\d/.test(String(nameEn).slice(comma))) {
    const mats = materialsRu(String(nameEn).slice(comma + 2));
    const head = ruName(String(nameEn).slice(0, comma), category);
    return mats ? `${head} — ${mats}` : head;
  }
  const name = String(nameEn);
  let hit = RU_NOUNS.find(([re]) => re.test(name));
  // Обувь называется только обувными словами («Thongs» у Chanel — вьетнамки, а не бельё)
  if (SHOE_CATS.has(category) && hit && !SHOE_NOUNS.has(hit[1])) hit = /thong/i.test(name) ? [/thongs?/i, 'Вьетнамки'] : null;
  const noun = hit ? hit[1] : CATEGORY_RU_ONE[category] || '';
  const model = (hit ? name.replace(new RegExp(`(?:${hit[0].source})[a-z]*`, 'gi'), ' ') : name).replace(DROP, ' ').replace(/(\s+\b(on|with|and|of|in|the)\b)+\s*$/i, '').replace(/^\s*(\b(with|and|of|in)\b\s+)+/i, '').replace(/\b\d+(\.\d+)?\s?mm\b/gi, (m) => m).replace(/\s*-\s*$/, '').replace(/\s{2,}/g, ' ').replace(/^[\s\-–,/]+|[\s\-–,/]+$/g, '').trim();
  return model ? `${noun} ${model}` : noun;
}
