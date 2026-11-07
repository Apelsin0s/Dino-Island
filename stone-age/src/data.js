// Game content. Every player-facing string is { en, ru }.
// Structure:
//   REGIONS  — 12 parts of the island, opened one by one (start: meadow).
//   BUILDINGS — every purchase is a separate building on the map, levelled up individually.
//   UPGRADES — the upgrade tree: everything about the settlement, paid with resources.
//   RESEARCH — the research tree: the road home, paid with ideas; repairs need lost machine parts.
//   Flow per region: decode a manual page (research) → its riddle points to a clue hidden in an open
//   region → finding the clue opens the next region at once → that region holds a lost machine part →
//   the part allows the matching repair in the research tree → the repair allows the next manual page.
'use strict';
window.GAME_DATA = (() => {
  const RES = [
    { id: 'food',     color: '#e0703a', name: { en: 'Food',     ru: 'Еда' } },
    { id: 'wood',     color: '#a8703c', name: { en: 'Wood',     ru: 'Дерево' } },
    { id: 'stone',    color: '#9aa0a6', name: { en: 'Stone',    ru: 'Камень' } },
    { id: 'ideas',    color: '#f2d14b', name: { en: 'Ideas',    ru: 'Идеи' } },
    { id: 'copper',   color: '#d9814a', name: { en: 'Copper',   ru: 'Медь' } },
    { id: 'iron',     color: '#7f8ea3', name: { en: 'Iron',     ru: 'Железо' } },
    { id: 'gears',    color: '#c9b37a', name: { en: 'Gears',    ru: 'Шестерни' } },
    { id: 'power',    color: '#6fd3ff', name: { en: 'Power',    ru: 'Энергия' } },
    { id: 'chronium', color: '#c77dff', name: { en: 'Chronium', ru: 'Хроний' } }
  ];

  // ---------- island ----------
  // seed = centre of the region on the 80×80 cell grid (x, z from -40 to 39). Order = opening order.
  const REGIONS = [
    { id: 'meadow', seed: [0, 2], ground: '#6fb04a', deco: 'meadow', name: { en: 'Crash Meadow', ru: 'Луг крушения' },
      desc: { en: 'Where the machine fell. Soft grass, berry bushes, a few rocks.', ru: 'Здесь упала машина. Мягкая трава, ягодные кусты, немного камней.' } },
    { id: 'forest', seed: [-17, -2], ground: '#4f8f3c', deco: 'forest', name: { en: 'Fern Forest', ru: 'Папоротниковый лес' },
      desc: { en: 'Old trees and giant ferns. Woodcutters work twice as fast here.', ru: 'Старые деревья и гигантские папоротники. Лесорубы работают здесь вдвое быстрее.' } },
    { id: 'river', seed: [2, -17], ground: '#6aa84f', deco: 'river', name: { en: 'River Valley', ru: 'Речная долина' },
      desc: { en: 'A wide river. Water wheels and fishermen need it.', ru: 'Широкая река. Она нужна водяным колёсам и рыбакам.' } },
    { id: 'hills', seed: [17, -4], ground: '#8a9a5a', deco: 'hills', name: { en: 'Stone Hills', ru: 'Каменные холмы' },
      desc: { en: 'Rocky hills with green veins of copper ore.', ru: 'Скалистые холмы с зелёными прожилками медной руды.' } },
    { id: 'beach', seed: [6, 19], ground: '#e2cf8f', deco: 'beach', name: { en: 'Turtle Beach', ru: 'Черепаший пляж' },
      desc: { en: 'Warm sand and huge turtles. Great for fishing.', ru: 'Тёплый песок и огромные черепахи. Отличная рыбалка.' } },
    { id: 'swamp', seed: [-17, 17], ground: '#5a7a4a', deco: 'swamp', name: { en: 'Mangrove Swamp', ru: 'Мангровое болото' },
      desc: { en: 'Twisted roots, fog and frogs the size of a dog.', ru: 'Кривые корни, туман и лягушки размером с собаку.' } },
    { id: 'copper', seed: [30, 9], ground: '#9a8a62', deco: 'copper', name: { en: 'Copper Caves', ru: 'Медные пещеры' },
      desc: { en: 'The cave walls shine green and orange. The richest copper on the island.', ru: 'Стены пещер блестят зелёным и рыжим. Самая богатая медь на острове.' } },
    { id: 'tundra', seed: [-14, -30], ground: '#c9d6d8', deco: 'tundra', name: { en: 'Mammoth Tundra', ru: 'Тундра мамонтов' },
      desc: { en: 'Cold wind, frozen ground and whole herds of mammoths.', ru: 'Холодный ветер, мёрзлая земля и целые стада мамонтов.' } },
    { id: 'iron', seed: [24, -24], ground: '#9a6a52', deco: 'iron', name: { en: 'Rust Canyon', ru: 'Ржавый каньон' },
      desc: { en: 'Red cliffs full of iron.', ru: 'Красные скалы, полные железа.' } },
    { id: 'geysers', seed: [-31, 1], ground: '#8aa0a0', deco: 'geysers', name: { en: 'Geyser Valley', ru: 'Долина гейзеров' },
      desc: { en: 'Hot steam bursts from the ground. Free power, if you can catch it.', ru: 'Из земли бьёт горячий пар. Бесплатная энергия, если её поймать.' } },
    { id: 'plateau', seed: [-6, 32], ground: '#3f7a3a', deco: 'plateau', name: { en: 'Lost Plateau', ru: 'Затерянное плато' },
      desc: { en: 'A plateau where time seems to have stopped. Something big walks here.', ru: 'Плато, где время будто остановилось. Здесь бродит что-то огромное.' } },
    { id: 'crater', seed: [6, -33], ground: '#4a3a44', deco: 'crater', name: { en: 'Volcano Crater', ru: 'Кратер вулкана' },
      desc: { en: 'Where the strange meteor fell. The ground glows purple.', ru: 'Сюда упал странный метеорит. Земля светится фиолетовым.' } }
  ];

  // Lost machine parts: one per region after the meadow. `at` = cell in that region.
  // Clues: hidden in an already open region (`in`), they lead to the next region.
  // Manual pages are the riddles that point to the clues.
  const CHAIN = [
    { region: 'forest', clue: { in: 'meadow', at: [-6, 0], kind: 'carving' }, part: { id: 'plates', at: [-19, -5] },
      page: { en: 'Page 1. "If the hull is damaged, its plates fly off towards the setting sun." A drawing next to it: a rock with the same arrow scratched on it. Look for a marked rock on the west side of the meadow.',
              ru: 'Страница 1. «При повреждении корпуса пластины обшивки отлетают в сторону заката». Рядом рисунок: камень с такой же стрелкой. Ищи помеченный камень на западной стороне луга.' },
      clueText: { en: 'A rock with an arrow scratched on it. Fresh marks. Someone pointed into the forest… or something flew past and scratched it.', ru: 'Камень с нацарапанной стрелкой. Царапины свежие. Кто-то указал в лес… или что-то пролетело мимо и задело его.' },
      partName: { en: 'Hull plates', ru: 'Пластины обшивки' },
      partText: { en: 'Hull plates, stuck in a fern like giant leaves. Oga thinks they are shields.', ru: 'Пластины обшивки торчат из папоротника, как огромные листья. Ога думает, что это щиты.' } },
    { region: 'river', clue: { in: 'forest', at: [-12, -8], kind: 'glint' }, part: { id: 'nav', at: [4, -20] },
      page: { en: 'Page 2. "The navigation module floats. Do not panic." Next to it someone (me?) drew a fish. Search the forest edge closest to running water.',
              ru: 'Страница 2. «Навигационный модуль плавает. Не паникуйте». Рядом кто-то (я?) нарисовал рыбу. Ищи на краю леса, ближе всего к текущей воде.' },
      clueText: { en: 'A blinking diode stuck in a tree. The cable leads down to the river.', ru: 'В дереве застрял мигающий диод. Провод от него уходит вниз, к реке.' },
      partName: { en: 'Navigation module', ru: 'Навигационный модуль' },
      partText: { en: 'The navigation module, caught in a beaver dam. Prehistoric beavers are very big.', ru: 'Навигационный модуль застрял в бобровой плотине. Доисторические бобры очень большие.' } },
    { region: 'hills', clue: { in: 'river', at: [9, -11], kind: 'cairn' }, part: { id: 'console', at: [19, -7] },
      page: { en: 'Page 3. "The control console is heavy and rolls downhill." So it went up first? Look for a pile of stones on the east bank of the river.',
              ru: 'Страница 3. «Пульт управления тяжёлый и скатывается вниз». Значит, сначала он улетел наверх? Ищи кучу камней на восточном берегу реки.' },
      clueText: { en: 'A cairn of stones, built by someone. On top: a key from my keyboard, the letter E. East.', ru: 'Пирамидка из камней, кто-то её сложил. Сверху клавиша с моей клавиатуры, буква E. East, восток.' },
      partName: { en: 'Control console', ru: 'Пульт управления' },
      partText: { en: 'The control console, wedged between two boulders. The screen still says "Do you want to save changes?"', ru: 'Пульт управления зажат между двумя валунами. На экране всё ещё «Сохранить изменения?»' } },
    { region: 'beach', clue: { in: 'meadow', at: [3, 8], kind: 'footprints' }, part: { id: 'lens', at: [9, 22] },
      page: { en: 'Page 4. "The chronograph lens is fragile. Keep away from sand." Of course it landed in sand. Follow the turtle tracks from the south of the meadow.',
              ru: 'Страница 4. «Линза хронографа хрупкая. Беречь от песка». Конечно же, она упала в песок. Иди по следам черепах с юга луга.' },
      clueText: { en: 'Giant turtle tracks going south. Between them, a perfectly round print, like a lens.', ru: 'Следы гигантской черепахи уходят на юг. Между ними идеально круглый отпечаток, как от линзы.' },
      partName: { en: 'Chronograph lens', ru: 'Линза хронографа' },
      partText: { en: 'The lens, on the shell of a sleeping turtle. It took an hour to ask politely.', ru: 'Линза лежала на панцире спящей черепахи. Час ушёл на то, чтобы вежливо попросить.' } },
    { region: 'swamp', clue: { in: 'beach', at: [1, 22], kind: 'bottle' }, part: { id: 'coolant', at: [-19, 20] },
      page: { en: 'Page 5. "Coolant leaks smell like mint." A mint smell on the west side of the beach?',
              ru: 'Страница 5. «Утечка охладителя пахнет мятой». Мятный запах на западе пляжа?' },
      clueText: { en: 'A trail of blue drops that smell of mint. They lead into the swamp fog.', ru: 'Дорожка синих капель с запахом мяты. Она уходит в туман болота.' },
      partName: { en: 'Coolant tank', ru: 'Бак охладителя' },
      partText: { en: 'The coolant tank. Frogs sit around it like it is a fireplace. A cold fireplace.', ru: 'Бак охладителя. Лягушки сидят вокруг него, как у камина. Холодного камина.' } },
    { region: 'copper', clue: { in: 'hills', at: [23, 2], kind: 'carving' }, part: { id: 'cable', at: [31, 12] },
      page: { en: 'Page 6. "The cable reel unrolls when dropped." Look for a copper wire in the eastern hills.',
              ru: 'Страница 6. «При падении катушка кабеля разматывается». Ищи медный провод в восточных холмах.' },
      clueText: { en: 'A wall painting: people following a shiny snake into a cave. The snake is my cable.', ru: 'Наскальный рисунок: люди идут за блестящей змеёй в пещеру. Змея — это мой кабель.' },
      partName: { en: 'Cable reel', ru: 'Катушка кабеля' },
      partText: { en: 'The cable reel, and the local tribe using the cable as a necklace. We traded for berries.', ru: 'Катушка кабеля, а кабель местное племя носит как ожерелье. Обменял на ягоды.' } },
    { region: 'tundra', clue: { in: 'river', at: [-5, -24], kind: 'skull' }, part: { id: 'chronometer', at: [-12, -33] },
      page: { en: 'Page 7. "The chronometer must be kept cold." It went north, then. A mammoth skull marks the path from the river.',
              ru: 'Страница 7. «Хронометр нужно хранить в холоде». Значит, он улетел на север. Череп мамонта отмечает путь от реки.' },
      clueText: { en: 'A mammoth skull. Inside it ticks something. The ticking moves north.', ru: 'Череп мамонта. Внутри что-то тикает. Тиканье уходит на север.' },
      partName: { en: 'Chronometer', ru: 'Хронометр' },
      partText: { en: 'The chronometer, frozen in a block of ice. It shows the right time. For 2026.', ru: 'Хронометр вмёрз в глыбу льда. Показывает точное время. Для 2026 года.' } },
    { region: 'iron', clue: { in: 'hills', at: [20, -12], kind: 'glint' }, part: { id: 'struts', at: [23, -20] },
      page: { en: 'Page 8. "Frame struts are magnetic." Something on the south-east of the hills pulls metal towards it.',
              ru: 'Страница 8. «Стойки каркаса намагничены». Что-то на юго-востоке холмов притягивает к себе металл.' },
      clueText: { en: 'My knife jumped out of my hand and stuck to a rock. The rock points to the red canyon.', ru: 'Нож выпрыгнул из руки и прилип к камню. Камень указывает на красный каньон.' },
      partName: { en: 'Frame struts', ru: 'Стойки каркаса' },
      partText: { en: 'The frame struts, covered in iron dust. The whole canyon is a magnet now. My fault.', ru: 'Стойки каркаса облеплены железной пылью. Теперь весь каньон — магнит. Моя вина.' } },
    { region: 'geysers', clue: { in: 'forest', at: [-23, 3], kind: 'bottle' }, part: { id: 'battery', at: [-33, -2] },
      page: { en: 'Page 9. "The battery heats up when damaged. Do not touch." Look where the forest is warm in winter.',
              ru: 'Страница 9. «При повреждении аккумулятор нагревается. Не трогать». Ищи место, где в лесу тепло даже зимой.' },
      clueText: { en: 'A patch of snowless ground in the west forest, and a burnt warning sticker: "DO NOT TOUCH".', ru: 'Пятно земли без снега в западном лесу и обгоревшая наклейка: «НЕ ТРОГАТЬ».' },
      partName: { en: 'Battery', ru: 'Аккумулятор' },
      partText: { en: 'The battery, sitting in a geyser and charging itself. Smarter than me.', ru: 'Аккумулятор сидит в гейзере и сам заряжается. Умнее меня.' } },
    { region: 'plateau', clue: { in: 'swamp', at: [-11, 24], kind: 'footprints' }, part: { id: 'gearbox', at: [-4, 31] },
      page: { en: 'Page 10. "The gearbox is the heaviest part." Only something huge could carry it. Huge footprints in the swamp?',
              ru: 'Страница 10. «Редуктор — самая тяжёлая деталь». Унести его могло только что-то огромное. Огромные следы на болоте?' },
      clueText: { en: 'Footprints with three toes. Bigger than a mammoth. They climb towards the plateau.', ru: 'Следы с тремя пальцами. Больше, чем у мамонта. Они поднимаются к плато.' },
      partName: { en: 'Gearbox', ru: 'Редуктор' },
      partText: { en: 'The gearbox, in a nest. A dinosaur nest. Dinosaurs died out long before cavemen. Somebody here messed with time before me.', ru: 'Редуктор лежал в гнезде. В гнезде динозавра. Динозавры вымерли задолго до людей. Кто-то здесь возился со временем до меня.' } },
    { region: 'crater', clue: { in: 'tundra', at: [-6, -33], kind: 'glint' }, part: { id: 'core', at: [8, -35] },
      page: { en: 'Page 11. "The chronium core resonates with chronium." The meteor! Look on the east of the tundra, where the snow glows purple.',
              ru: 'Страница 11. «Хрониевое ядро резонирует с хронием». Метеорит! Ищи на востоке тундры, где снег светится фиолетовым.' },
      clueText: { en: 'Purple snow. It hums, just like my machine. The volcano is calling.', ru: 'Фиолетовый снег. Он гудит, как моя машина. Вулкан зовёт.' },
      partName: { en: 'Core shell', ru: 'Оболочка ядра' },
      partText: { en: 'The core shell, lying next to a chronium meteor. The meteor has my company logo on it.', ru: 'Оболочка ядра лежала рядом с хрониевым метеоритом. На метеорите логотип моей компании.' } }
  ];

  // Optional easter eggs: a small permanent bonus and a diary line.
  const EGGS = [
    { id: 'phone', in: 'meadow', at: [6, -5], kind: 'phone', bonus: { res: 'ideas', mult: 1.05 },
      name: { en: 'My phone', ru: 'Мой телефон' }, text: { en: '1% battery, no signal, 4,000 unread emails. I took a selfie with Oga. +5% ideas.', ru: '1% заряда, нет сети, 4000 непрочитанных писем. Сделал селфи с Огой. +5% идей.' } },
    { id: 'painting', in: 'forest', at: [-25, -8], kind: 'carving', bonus: { res: 'food', mult: 1.05 },
      name: { en: 'Cave painting', ru: 'Наскальный рисунок' }, text: { en: 'A painting of a man in a jumpsuit next to a capsule. It is older than me. +5% food.', ru: 'Рисунок человека в комбинезоне рядом с капсулой. Он старше меня. +5% еды.' } },
    { id: 'duck', in: 'river', at: [-3, -12], kind: 'duck', bonus: { res: 'wood', mult: 1.05 },
      name: { en: 'Rubber duck', ru: 'Резиновая уточка' }, text: { en: 'A yellow rubber duck floating down the river. Not mine. Whose? +5% wood.', ru: 'По реке плывёт жёлтая резиновая уточка. Не моя. Чья? +5% дерева.' } },
    { id: 'shell', in: 'beach', at: [13, 24], kind: 'shell', bonus: { all: 1.03 },
      name: { en: 'Singing shell', ru: 'Поющая ракушка' }, text: { en: 'A shell that plays a ringtone when you hold it to your ear. Mine. +3% to everything.', ru: 'Ракушка, которая играет рингтон, если приложить к уху. Мой рингтон. +3% ко всему.' } },
    { id: 'egg', in: 'swamp', at: [-24, 13], kind: 'dinoegg', bonus: { res: 'food', mult: 1.1 },
      name: { en: 'Frozen egg', ru: 'Замёрзшее яйцо' }, text: { en: 'A huge speckled egg, warm inside. I will keep it by the fire. +10% food.', ru: 'Огромное пятнистое яйцо, внутри тёплое. Положу его у костра. +10% еды.' } },
    { id: 'coin', in: 'copper', at: [35, 4], kind: 'coin', bonus: { res: 'copper', mult: 1.1 },
      name: { en: 'Coin from 2031', ru: 'Монета 2031 года' }, text: { en: 'A coin from 2031. Five years after my time. I am not the last traveller here. +10% copper.', ru: 'Монета 2031 года. На пять лет позже моего времени. Я здесь не последний путешественник. +10% меди.' } },
    { id: 'sunglasses', in: 'tundra', at: [-20, -27], kind: 'glasses', bonus: { res: 'stone', mult: 1.1 },
      name: { en: 'Sunglasses', ru: 'Солнечные очки' }, text: { en: 'Sunglasses on a frozen mammoth. It looks very cool. +10% stone.', ru: 'Солнечные очки на замёрзшем мамонте. Выглядит очень круто. +10% камня.' } },
    { id: 'note', in: 'plateau', at: [-9, 30], kind: 'bottle', bonus: { all: 1.05 },
      name: { en: 'Note in a bottle', ru: 'Записка в бутылке' }, text: { en: '"If you read this, you are me. Do not press the big red button." Too late. +5% to everything.', ru: '«Если ты это читаешь, ты — это я. Не нажимай большую красную кнопку». Поздно. +5% ко всему.' } }
  ];

  // ---------- buildings ----------
  // prod: per second at level 1; production grows with level. regions: where it can be built (null = any open).
  // bonusIn: region where it works ×2.
  const BUILDINGS = [
    { id: 'forager', prod: { food: 0.6 }, cost: { food: 15 }, foot: [1, 1],
      name: { en: 'Forager', ru: 'Собиратель' }, desc: { en: 'Picks berries and roots.', ru: 'Собирает ягоды и коренья.' } },
    { id: 'woodcutter', req: 'stoneTools', prod: { wood: 0.6 }, cost: { food: 30, wood: 10 }, foot: [2, 1], bonusIn: 'forest',
      name: { en: 'Woodcutter', ru: 'Лесоруб' }, desc: { en: 'Twice as fast in the Fern Forest.', ru: 'В Папоротниковом лесу работает вдвое быстрее.' } },
    { id: 'quarry', req: 'stoneTools', prod: { stone: 0.5 }, cost: { food: 40, wood: 30 }, foot: [2, 2], bonusIn: 'hills',
      name: { en: 'Quarry', ru: 'Каменоломня' }, desc: { en: 'Twice as fast in the Stone Hills.', ru: 'В Каменных холмах работает вдвое быстрее.' } },
    { id: 'firepit', req: 'fire', prod: { ideas: 0.35 }, cost: { wood: 50, stone: 25 }, foot: [1, 1],
      name: { en: 'Elder\'s Fire', ru: 'Костёр старейшины' }, desc: { en: 'Stories by the fire become ideas.', ru: 'Истории у костра становятся идеями.' } },
    { id: 'hunter', req: 'hunting', prod: { food: 3 }, cost: { food: 150, wood: 90, stone: 40 }, foot: [2, 2], bonusIn: 'tundra',
      name: { en: 'Hunters\' Camp', ru: 'Лагерь охотников' }, desc: { en: 'Twice as fast in the Mammoth Tundra.', ru: 'В Тундре мамонтов работает вдвое быстрее.' } },
    { id: 'hut', req: 'shelter', global: 0.005, cost: { wood: 150, stone: 80 }, foot: [2, 2],
      name: { en: 'Hut', ru: 'Шалаш' }, desc: { en: '+0.5% to all production per level.', ru: '+0,5% ко всей добыче за каждый уровень.' } },
    { id: 'fisher', req: 'fishing', prod: { food: 8 }, cost: { food: 600, wood: 400 }, foot: [2, 1], regions: ['river', 'beach', 'swamp'],
      name: { en: 'Fishing Hut', ru: 'Хижина рыбака' }, desc: { en: 'Only by water: river, beach or swamp.', ru: 'Только у воды: река, пляж или болото.' } },
    { id: 'farm', req: 'agriculture', prod: { food: 14 }, cost: { food: 1200, wood: 600 }, foot: [3, 3], regions: ['meadow', 'river', 'swamp'],
      name: { en: 'Field', ru: 'Поле' }, desc: { en: 'Needs soft soil: meadow, river valley or swamp.', ru: 'Нужна мягкая земля: луг, речная долина или болото.' } },
    { id: 'copperMine', req: 'bronze', prod: { copper: 0.5 }, cost: { wood: 2500, stone: 2000 }, foot: [2, 2], regions: ['hills', 'copper'], bonusIn: 'copper',
      name: { en: 'Copper Mine', ru: 'Медный рудник' }, desc: { en: 'Hills or Copper Caves (×2 in the caves).', ru: 'Холмы или Медные пещеры (в пещерах ×2).' } },
    { id: 'school', req: 'writing', prod: { ideas: 4 }, cost: { wood: 4000, stone: 2500, copper: 100 }, foot: [2, 2],
      name: { en: 'Scribe School', ru: 'Школа писцов' }, desc: { en: 'Clay tablets remember ideas.', ru: 'Глиняные таблички помнят идеи.' } },
    { id: 'ironMine', req: 'ironworking', prod: { iron: 0.5 }, cost: { wood: 15000, stone: 12000, copper: 800 }, foot: [2, 2], regions: ['iron'],
      name: { en: 'Iron Mine', ru: 'Железный рудник' }, desc: { en: 'Only in the Rust Canyon.', ru: 'Только в Ржавом каньоне.' } },
    { id: 'workshop', req: 'mechanics', prod: { gears: 0.3 }, cost: { wood: 20000, copper: 1500, iron: 600 }, foot: [2, 2],
      name: { en: 'Workshop', ru: 'Мастерская' }, desc: { en: 'Turns metal into gears.', ru: 'Превращает металл в шестерни.' } },
    { id: 'waterwheel', req: 'mechanics', prod: { power: 1.5 }, cost: { wood: 25000, iron: 500, gears: 40 }, foot: [2, 2], regions: ['river'],
      name: { en: 'Water Wheel', ru: 'Водяное колесо' }, desc: { en: 'Only in the River Valley.', ru: 'Только в Речной долине.' } },
    { id: 'observatory', req: 'stargazing', prod: { ideas: 25 }, cost: { stone: 60000, copper: 4000, gears: 120 }, foot: [2, 2],
      name: { en: 'Observatory', ru: 'Обсерватория' }, desc: { en: 'Stars do not lie about the year.', ru: 'Звёзды не врут о том, какой сейчас год.' } },
    { id: 'geyserPlant', req: 'steam', prod: { power: 8 }, cost: { stone: 80000, iron: 3000, gears: 400 }, foot: [2, 2], regions: ['geysers'],
      name: { en: 'Geyser Plant', ru: 'Гейзерная станция' }, desc: { en: 'Only in the Geyser Valley.', ru: 'Только в Долине гейзеров.' } },
    { id: 'crater', req: 'chronoTheory', prod: { chronium: 0.08 }, cost: { iron: 10000, gears: 1500, power: 8000 }, foot: [3, 3], regions: ['crater'],
      name: { en: 'Chronium Dig', ru: 'Раскопки хрония' }, desc: { en: 'Only in the Volcano Crater.', ru: 'Только в Кратере вулкана.' } }
  ];

  // ---------- upgrade tree (resources) ----------
  // pos: [column, row] in the tree view. effect: unlock building, multipliers, level cap, click power, clue search.
  const UPGRADES = [
    { id: 'tribe', pos: [0, 3], cost: {}, effect: { cap: 5 }, name: { en: 'Tribe', ru: 'Племя' }, desc: { en: 'Oga\'s tribe. Buildings up to level 5.', ru: 'Племя Оги. Здания до 5 уровня.' } },
    { id: 'stoneTools', pos: [1, 3], req: ['tribe'], cost: { food: 30, wood: 10 }, effect: { click: 2, cap: 10 },
      name: { en: 'Stone Tools', ru: 'Каменные орудия' }, desc: { en: 'Woodcutter and Quarry. Clicks ×2. Levels up to 10.', ru: 'Лесоруб и Каменоломня. Клики ×2. Уровни до 10.' } },
    { id: 'fire', pos: [2, 2], req: ['stoneTools'], cost: { wood: 40, stone: 20 },
      name: { en: 'Fire', ru: 'Огонь' }, desc: { en: 'Elder\'s Fire: makes ideas.', ru: 'Костёр старейшины: даёт идеи.' } },
    { id: 'hunting', pos: [2, 4], req: ['stoneTools'], cost: { food: 120, wood: 60 },
      name: { en: 'Hunting', ru: 'Охота' }, desc: { en: 'Hunters\' Camp.', ru: 'Лагерь охотников.' } },
    { id: 'nimbleHands', pos: [2, 6], req: ['stoneTools'], cost: { food: 200, stone: 80 }, effect: { click: 2 },
      name: { en: 'Nimble Hands', ru: 'Ловкие руки' }, desc: { en: 'Clicks ×2.', ru: 'Клики ×2.' } },
    { id: 'scouts', pos: [3, 0], req: ['fire'], cost: { food: 300, wood: 200 }, effect: { search: 1 },
      name: { en: 'Scouts', ru: 'Разведчики' }, desc: { en: 'Clues glint brighter and can be seen from further away.', ru: 'Находки блестят ярче и видны издалека.' } },
    { id: 'shelter', pos: [3, 2], req: ['fire'], cost: { wood: 250, stone: 120 },
      name: { en: 'Shelter', ru: 'Жилища' }, desc: { en: 'Huts: +0.5% to everything per level.', ru: 'Шалаши: +0,5% ко всему за уровень.' } },
    { id: 'fishing', pos: [3, 4], req: ['hunting'], cost: { food: 500, wood: 300 },
      name: { en: 'Fishing', ru: 'Рыболовство' }, desc: { en: 'Fishing Huts by the water.', ru: 'Хижины рыбаков у воды.' } },
    { id: 'trainedHands', pos: [3, 6], req: ['nimbleHands'], cost: { food: 1500, wood: 800 }, effect: { clickPct: 0.05 },
      name: { en: 'Trained Hands', ru: 'Умелые руки' }, desc: { en: 'Each click adds 5% of that resource\'s income per second.', ru: 'Каждый клик даёт ещё 5% от дохода этого ресурса в секунду.' } },
    { id: 'tracking', pos: [4, 0], req: ['scouts'], cost: { food: 3000, wood: 2000 }, effect: { search: 2 },
      name: { en: 'Tracking', ru: 'Следопыты' }, desc: { en: 'Clues are marked on the island map.', ru: 'Находки отмечаются на карте острова.' } },
    { id: 'pottery', pos: [4, 2], req: ['shelter'], cost: { stone: 600, wood: 400 }, effect: { res: { food: 1.5 } },
      name: { en: 'Pottery', ru: 'Гончарство' }, desc: { en: 'Food ×1.5.', ru: 'Еда ×1.5.' } },
    { id: 'agriculture', pos: [5, 4], req: ['fishing', 'pottery'], cost: { food: 2000, wood: 1000 },
      name: { en: 'Agriculture', ru: 'Земледелие' }, desc: { en: 'Fields.', ru: 'Поля.' } },
    { id: 'wheel', pos: [6, 3], req: ['agriculture'], cost: { wood: 5000, stone: 3000 }, effect: { all: 1.25, cap: 15 },
      name: { en: 'The Wheel', ru: 'Колесо' }, desc: { en: 'Everything ×1.25. Levels up to 15.', ru: 'Всё ×1.25. Уровни до 15.' } },
    { id: 'irrigation', pos: [6, 5], req: ['agriculture'], cost: { food: 12000, wood: 4000 }, effect: { res: { food: 2 } },
      name: { en: 'Irrigation', ru: 'Орошение' }, desc: { en: 'Food ×2.', ru: 'Еда ×2.' } },
    { id: 'bronze', pos: [7, 2], req: ['wheel'], cost: { wood: 12000, stone: 10000 }, effect: { res: { wood: 2, stone: 2 }, cap: 25 },
      name: { en: 'Bronze', ru: 'Бронза' }, desc: { en: 'Copper Mines. Wood and Stone ×2. Levels up to 25.', ru: 'Медные рудники. Дерево и Камень ×2. Уровни до 25.' } },
    { id: 'roads', pos: [7, 4], req: ['wheel'], cost: { wood: 20000, stone: 20000 }, effect: { all: 1.2 },
      name: { en: 'Roads', ru: 'Дороги' }, desc: { en: 'Everything ×1.2.', ru: 'Всё ×1.2.' } },
    { id: 'masterHands', pos: [7, 6], req: ['trainedHands', 'irrigation'], cost: { food: 60000, wood: 20000 }, effect: { clickPct: 0.1, click: 3 },
      name: { en: 'Master Hands', ru: 'Руки мастера' }, desc: { en: 'Clicks ×3 and +10% of income per click.', ru: 'Клики ×3 и ещё +10% от дохода за клик.' } },
    { id: 'writing', pos: [8, 1], req: ['bronze'], cost: { wood: 30000, copper: 300 },
      name: { en: 'Writing', ru: 'Письменность' }, desc: { en: 'Scribe Schools.', ru: 'Школы писцов.' } },
    { id: 'masonry', pos: [8, 3], req: ['bronze'], cost: { stone: 60000, copper: 800 }, effect: { res: { stone: 2 } },
      name: { en: 'Masonry', ru: 'Каменная кладка' }, desc: { en: 'Stone ×2.', ru: 'Камень ×2.' } },
    { id: 'ironworking', pos: [9, 2], req: ['writing', 'masonry'], cost: { stone: 150000, copper: 4000 }, effect: { cap: 40 },
      name: { en: 'Ironworking', ru: 'Обработка железа' }, desc: { en: 'Iron Mines. Levels up to 40.', ru: 'Железные рудники. Уровни до 40.' } },
    { id: 'stargazing', pos: [9, 0], req: ['writing'], cost: { stone: 80000, copper: 3000 },
      name: { en: 'Stargazing', ru: 'Звездочёты' }, desc: { en: 'Observatories.', ru: 'Обсерватории.' } },
    { id: 'deepMining', pos: [10, 3], req: ['ironworking'], cost: { iron: 4000, copper: 10000 }, effect: { res: { copper: 2, iron: 2 } },
      name: { en: 'Deep Mining', ru: 'Глубокие шахты' }, desc: { en: 'Copper and Iron ×2.', ru: 'Медь и Железо ×2.' } },
    { id: 'mechanics', pos: [10, 1], req: ['ironworking'], cost: { iron: 3000, wood: 200000 },
      name: { en: 'Mechanics', ru: 'Механика' }, desc: { en: 'Workshops and Water Wheels.', ru: 'Мастерские и Водяные колёса.' } },
    { id: 'steam', pos: [11, 1], req: ['mechanics'], cost: { iron: 15000, gears: 600 }, effect: { res: { power: 1.5 } },
      name: { en: 'Steam', ru: 'Пар' }, desc: { en: 'Geyser Plants. Power ×1.5.', ru: 'Гейзерные станции. Энергия ×1.5.' } },
    { id: 'automation', pos: [12, 2], req: ['steam', 'deepMining'], cost: { iron: 60000, gears: 4000, power: 30000 }, effect: { all: 2, cap: 60 },
      name: { en: 'Automation', ru: 'Автоматизация' }, desc: { en: 'Everything ×2. Levels up to 60.', ru: 'Всё ×2. Уровни до 60.' } }
  ];

  // ---------- research tree (ideas) ----------
  // kind: 'page' decodes a manual page (makes its clue findable), 'repair' needs the lost part, 'science' gives a bonus.
  const RESEARCH = [
    { id: 'wreck', kind: 'science', pos: [0, 1], cost: { ideas: 5 }, name: { en: 'Study the Wreck', ru: 'Изучить обломки' }, desc: { en: 'You find the machine\'s instruction manual. Most pages are unreadable.', ru: 'Ты находишь инструкцию к машине. Большинство страниц не прочитать.' } }
  ];
  const REPAIR_COST = [
    { wood: 600, stone: 400 }, { stone: 3000, ideas: 800 }, { stone: 15000, copper: 150 }, { stone: 150000, ideas: 40000 },
    { wood: 150000, copper: 350 }, { copper: 300000 }, { ideas: 8000000, copper: 400000 }, { iron: 120000 },
    { power: 3000000, copper: 2000000 }, { gears: 60000, iron: 1500000 }, { chronium: 40000 }
  ];
  const PAGE_COST = [15, 300, 3000, 20000, 100000, 500000, 2500000, 10000000, 40000000, 150000000, 500000000];
  CHAIN.forEach((c, i) => {
    const prev = i === 0 ? 'wreck' : 'fix_' + CHAIN[i - 1].part.id;
    RESEARCH.push({ id: 'page' + (i + 1), kind: 'page', chain: i, pos: [2 * i + 1, 1], req: [prev], cost: { ideas: PAGE_COST[i] },
      name: { en: 'Manual, page ' + (i + 1), ru: 'Инструкция, стр. ' + (i + 1) }, desc: { en: 'Decode the next page. It hints where to search.', ru: 'Расшифровать следующую страницу. Она подскажет, где искать.' } });
    RESEARCH.push({ id: 'fix_' + c.part.id, kind: 'repair', chain: i, part: c.part.id, pos: [2 * i + 2, 1], req: ['page' + (i + 1)], cost: REPAIR_COST[i],
      name: { en: 'Install: ', ru: 'Установить: ' }, desc: { en: 'Needs the lost part from: ', ru: 'Нужна потерянная деталь из области: ' } });
  });
  // science side branch (bonuses and the tools the repairs need)
  RESEARCH.push(
    { id: 'physics', kind: 'science', pos: [2, 2], req: ['page1'], cost: { ideas: 300 }, effect: { res: { ideas: 1.5 } }, name: { en: 'Basic Physics', ru: 'Основы физики' }, desc: { en: 'Ideas ×1.5.', ru: 'Идеи ×1.5.' } },
    { id: 'optics', kind: 'science', pos: [5, 2], req: ['fix_nav'], cost: { ideas: 4000 }, effect: { res: { ideas: 1.5 } }, name: { en: 'Optics', ru: 'Оптика' }, desc: { en: 'Ideas ×1.5.', ru: 'Идеи ×1.5.' } },
    { id: 'thermo', kind: 'science', pos: [11, 2], req: ['fix_coolant'], cost: { ideas: 800000 }, effect: { all: 1.3 }, name: { en: 'Thermodynamics', ru: 'Термодинамика' }, desc: { en: 'Everything ×1.3.', ru: 'Всё ×1.3.' } },
    { id: 'electricity', kind: 'science', pos: [13, 2], req: ['fix_cable'], cost: { ideas: 5000000 }, effect: { res: { power: 2 } }, name: { en: 'Electricity', ru: 'Электричество' }, desc: { en: 'Power ×2.', ru: 'Энергия ×2.' } },
    { id: 'chronoTheory', kind: 'science', pos: [17, 2], req: ['fix_struts', 'electricity'], cost: { ideas: 60000000 }, name: { en: 'Chrono Theory', ru: 'Теория времени' }, desc: { en: 'Chronium Digs in the crater.', ru: 'Раскопки хрония в кратере.' } },
    { id: 'launch', kind: 'launch', pos: [23, 1], req: ['fix_core'], cost: { power: 200000000, ideas: 1000000000 }, name: { en: 'LAUNCH TO 2026', ru: 'ЗАПУСК В 2026' }, desc: { en: 'Go home. Probably.', ru: 'Домой. Наверное.' } }
  );

  // ---------- story ----------
  const STORY = [
    { id: 'start', when: s => true, text: {
      en: ['Galway, 2026. The first test of my time machine. I pressed the big red button.',
           'Now I am in a meadow. A mammoth is looking at me. The display says: 10,000 BC.',
           'The machine is wrecked and half of its parts are gone, scattered over an island I do not know. Click the bushes, rocks and trees to gather. Click the machine to study it.'],
      ru: ['Голуэй, 2026 год. Первый запуск моей машины времени. Я нажал большую красную кнопку.',
           'Теперь я на лугу, и на меня смотрит мамонт. На дисплее: 10 000 лет до н. э.',
           'Машина разбита, половина деталей пропала: они разлетелись по незнакомому острову. Кликай по кустам, камням и деревьям, чтобы добывать ресурсы. Кликай по машине, чтобы её изучать.'] } },
    { id: 'tribe', when: s => s.built >= 1, text: {
      en: ['A local tribe found me. Their leader, Oga, gave me a stick. I think we are friends.', 'The 🌳 icon on the left is the upgrade tree: teach the tribe new things.'],
      ru: ['Меня нашло местное племя. Их вождь Ога дал мне палку. Кажется, мы друзья.', 'Иконка 🌳 слева — дерево улучшений: учи племя новому.'] } },
    { id: 'manual', when: s => s.research.wreck, text: {
      en: ['Under the seat: the instruction manual! Most of it is soaked and smudged. I can decode it page by page in the 🔬 research tree.', 'Each page should tell me where a lost part went.'],
      ru: ['Под сиденьем нашлась инструкция! Почти вся промокла и размазалась. Её можно расшифровывать по странице в дереве исследований 🔬.', 'Каждая страница должна подсказать, куда улетела потерянная деталь.'] } }
  ];
  const ENDING = {
    en: ['3… 2… 1… Light, noise, and the smell of burnt toast.', 'Galway, 2026. My garage. My coffee is still warm.',
         'But on the wall there is a cave painting that was not there before: a man, a mammoth and a time machine.',
         'The display blinks: "Temporal echo detected. Loop unstable." I blink, and I am back in the meadow. This time I remember everything.'],
    ru: ['3… 2… 1… Свет, шум и запах подгоревшего тоста.', 'Голуэй, 2026 год. Мой гараж. Кофе ещё тёплый.',
         'Но на стене наскальный рисунок, которого раньше не было: человек, мамонт и машина времени.',
         'Дисплей мигает: «Обнаружено эхо времени. Петля нестабильна». Моргаю, и я снова на лугу. Но в этот раз я помню всё.']
  };

  const ACH = [
    { id: 'click1', when: s => s.clicks >= 1, name: { en: 'First Contact', ru: 'Первый контакт' }, desc: { en: 'Gather something.', ru: 'Добыть что-нибудь.' } },
    { id: 'build10', when: s => s.built >= 10, name: { en: 'Village', ru: 'Деревня' }, desc: { en: 'Build 10 buildings.', ru: 'Построить 10 зданий.' } },
    { id: 'level25', when: s => s.maxLevel >= 25, name: { en: 'Skyscraper', ru: 'Небоскрёб' }, desc: { en: 'Get a building to level 25.', ru: 'Прокачать здание до 25 уровня.' } },
    { id: 'region3', when: s => s.regions.length >= 3, name: { en: 'Explorer', ru: 'Исследователь' }, desc: { en: 'Open 3 regions.', ru: 'Открыть 3 области.' } },
    { id: 'regionAll', when: s => s.regions.length >= 12, name: { en: 'Cartographer', ru: 'Картограф' }, desc: { en: 'Open the whole island.', ru: 'Открыть весь остров.' } },
    { id: 'part1', when: s => Object.keys(s.parts).length >= 1, name: { en: 'Lost and Found', ru: 'Бюро находок' }, desc: { en: 'Find a lost machine part.', ru: 'Найти потерянную деталь.' } },
    { id: 'eggs4', when: s => Object.keys(s.eggs).length >= 4, name: { en: 'Curious', ru: 'Любопытный' }, desc: { en: 'Find 4 easter eggs.', ru: 'Найти 4 пасхалки.' } },
    { id: 'eggsAll', when: s => Object.keys(s.eggs).length >= EGGS.length, name: { en: 'Nothing Escapes Me', ru: 'От меня не спрячешься' }, desc: { en: 'Find every easter egg.', ru: 'Найти все пасхалки.' } },
    { id: 'treeAll', when: s => Object.keys(s.upgrades).length >= UPGRADES.length, name: { en: 'Renaissance Caveman', ru: 'Пещерный гений' }, desc: { en: 'Buy the whole upgrade tree.', ru: 'Купить всё дерево улучшений.' } },
    { id: 'home', when: s => s.loops >= 1, name: { en: 'Back to 2026', ru: 'Назад в 2026' }, desc: { en: 'Launch the time machine.', ru: 'Запустить машину времени.' } }
  ];

  return { RES, REGIONS, CHAIN, EGGS, BUILDINGS, UPGRADES, RESEARCH, STORY, ENDING, ACH };
})();
