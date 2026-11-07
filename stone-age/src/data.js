// Game content: resources, buildings, research, time machine parts, story, achievements.
// Every player-facing string is { en, ru }.
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

  // prod: amount per second for ONE building (before multipliers)
  // global: +X to the global multiplier per building
  const BUILDINGS = [
    { id: 'forager', prod: { food: 0.5 }, cost: { food: 12 },
      name: { en: 'Forager', ru: 'Собиратель' },
      desc: { en: 'Picks berries and roots all day long.', ru: 'Весь день собирает ягоды и коренья.' } },
    { id: 'woodcutter', req: 'stoneTools', prod: { wood: 0.5 }, cost: { food: 25, wood: 10 },
      name: { en: 'Woodcutter', ru: 'Лесоруб' },
      desc: { en: 'A sharp stone axe and a lot of patience.', ru: 'Острый каменный топор и много терпения.' } },
    { id: 'quarry', req: 'stoneTools', prod: { stone: 0.4 }, cost: { food: 40, wood: 25 },
      name: { en: 'Stone Quarry', ru: 'Каменоломня' },
      desc: { en: 'Breaks rocks into useful rocks.', ru: 'Раскалывает камни на полезные камни.' } },
    { id: 'firepit', req: 'fire', prod: { ideas: 0.3 }, cost: { wood: 40, stone: 20 },
      name: { en: 'Elder\'s Fire', ru: 'Костёр старейшины' },
      desc: { en: 'Stories by the fire turn into ideas.', ru: 'Истории у костра превращаются в идеи.' } },
    { id: 'hunter', req: 'hunting', prod: { food: 3 }, cost: { food: 150, wood: 80, stone: 40 },
      name: { en: 'Hunters\' Camp', ru: 'Лагерь охотников' },
      desc: { en: 'Mammoth for dinner. Again.', ru: 'На ужин мамонт. Опять.' } },
    { id: 'hut', req: 'shelter', global: 0.05, cost: { wood: 120, stone: 60 },
      name: { en: 'Hut', ru: 'Шалаш' },
      desc: { en: 'Happy tribe, faster work: +5% to all production.', ru: 'Довольное племя работает быстрее: +5% ко всей добыче.' } },
    { id: 'farm', req: 'agriculture', prod: { food: 12 }, cost: { food: 800, wood: 400 },
      name: { en: 'Field', ru: 'Поле' },
      desc: { en: 'The first wheat in history. You are welcome.', ru: 'Первая пшеница в истории. Не благодари.' } },
    { id: 'copperMine', req: 'metallurgy', prod: { copper: 0.4 }, cost: { wood: 1500, stone: 1200 },
      name: { en: 'Copper Mine', ru: 'Медный рудник' },
      desc: { en: 'Green rocks that melt. The tribe is amazed.', ru: 'Зелёные камни, которые плавятся. Племя в восторге.' } },
    { id: 'school', req: 'writing', prod: { ideas: 3 }, cost: { wood: 2500, stone: 1500, copper: 60 },
      name: { en: 'Scribe School', ru: 'Школа писцов' },
      desc: { en: 'Clay tablets remember ideas for you.', ru: 'Глиняные таблички помнят идеи за тебя.' } },
    { id: 'ironMine', req: 'ironworking', prod: { iron: 0.4 }, cost: { wood: 8000, stone: 8000, copper: 400 },
      name: { en: 'Iron Mine', ru: 'Железный рудник' },
      desc: { en: 'Two thousand years early, but who is counting.', ru: 'На пару тысяч лет раньше срока, но кто считает.' } },
    { id: 'workshop', req: 'mechanics', prod: { gears: 0.25 }, cost: { wood: 6000, copper: 300, iron: 300 },
      name: { en: 'Workshop', ru: 'Мастерская' },
      desc: { en: 'Gears, springs and very confused cavemen.', ru: 'Шестерни, пружины и очень удивлённые пещерные люди.' } },
    { id: 'waterwheel', req: 'mechanics', prod: { power: 1 }, cost: { wood: 12000, iron: 200, gears: 30 },
      name: { en: 'Water Wheel', ru: 'Водяное колесо' },
      desc: { en: 'The river finally gets a job.', ru: 'Река наконец-то нашла работу.' } },
    { id: 'observatory', req: 'astronomy', prod: { ideas: 20 }, cost: { stone: 30000, copper: 1500, gears: 80 },
      name: { en: 'Observatory', ru: 'Обсерватория' },
      desc: { en: 'Stars do not lie about what year it is.', ru: 'Звёзды не врут о том, какой сейчас год.' } },
    { id: 'crater', req: 'chronoTheory', prod: { chronium: 0.05 }, cost: { iron: 3000, gears: 300, power: 1500 },
      name: { en: 'Crater Dig', ru: 'Раскопки кратера' },
      desc: { en: 'The meteor that fell here was not a normal meteor.', ru: 'Метеорит, упавший здесь, был не простой.' } }
  ];

  // effect: { click: mult } | { res: {id: mult} } | { all: mult } | { clickPct: share of /s added per click }
  const TECHS = [
    { id: 'stoneTools', cost: { ideas: 5 }, effect: { click: 2 },
      name: { en: 'Stone Tools', ru: 'Каменные орудия' },
      desc: { en: 'Unlocks Woodcutter and Quarry. Clicks ×2.', ru: 'Открывает Лесоруба и Каменоломню. Клики ×2.' } },
    { id: 'fire', req: 'stoneTools', cost: { ideas: 15, wood: 20 },
      name: { en: 'Fire', ru: 'Огонь' },
      desc: { en: 'Unlocks the Elder\'s Fire, which makes ideas.', ru: 'Открывает Костёр старейшины, который даёт идеи.' } },
    { id: 'hunting', req: 'fire', cost: { ideas: 40, food: 60 },
      name: { en: 'Hunting', ru: 'Охота' },
      desc: { en: 'Unlocks the Hunters\' Camp.', ru: 'Открывает Лагерь охотников.' } },
    { id: 'storytelling', req: 'fire', cost: { ideas: 80, food: 150 }, effect: { res: { ideas: 2 } },
      name: { en: 'Storytelling', ru: 'Сказания' },
      desc: { en: 'Ideas ×2.', ru: 'Идеи ×2.' } },
    { id: 'shelter', req: 'hunting', cost: { ideas: 120, wood: 150 },
      name: { en: 'Shelter', ru: 'Жилища' },
      desc: { en: 'Unlocks Huts (+5% to everything each).', ru: 'Открывает Шалаши (+5% ко всему за каждый).' } },
    { id: 'pottery', req: 'shelter', cost: { ideas: 250, stone: 300 }, effect: { res: { food: 1.5 } },
      name: { en: 'Pottery', ru: 'Гончарство' },
      desc: { en: 'Food ×1.5. Nothing spoils in a pot.', ru: 'Еда ×1.5. В горшке ничего не портится.' } },
    { id: 'agriculture', req: 'pottery', cost: { ideas: 500, food: 1000 },
      name: { en: 'Agriculture', ru: 'Земледелие' },
      desc: { en: 'Unlocks Fields.', ru: 'Открывает Поля.' } },
    { id: 'trainedHands', req: 'pottery', cost: { ideas: 700, food: 2000 }, effect: { clickPct: 0.05 },
      name: { en: 'Trained Hands', ru: 'Ловкие руки' },
      desc: { en: 'Each click also gives 5% of that resource\'s per-second income.', ru: 'Каждый клик даёт ещё 5% от добычи этого ресурса в секунду.' } },
    { id: 'wheel', req: 'agriculture', cost: { ideas: 1200, wood: 2000 }, effect: { all: 1.25 },
      name: { en: 'The Wheel', ru: 'Колесо' },
      desc: { en: 'All production ×1.25.', ru: 'Вся добыча ×1.25.' } },
    { id: 'irrigation', req: 'agriculture', cost: { ideas: 2000, food: 8000 }, effect: { res: { food: 2 } },
      name: { en: 'Irrigation', ru: 'Орошение' },
      desc: { en: 'Food ×2.', ru: 'Еда ×2.' } },
    { id: 'metallurgy', req: 'wheel', cost: { ideas: 3000, stone: 4000 },
      name: { en: 'Copper Smelting', ru: 'Выплавка меди' },
      desc: { en: 'Unlocks the Copper Mine.', ru: 'Открывает Медный рудник.' } },
    { id: 'writing', req: 'metallurgy', cost: { ideas: 5000, copper: 80 },
      name: { en: 'Writing', ru: 'Письменность' },
      desc: { en: 'Unlocks the Scribe School.', ru: 'Открывает Школу писцов.' } },
    { id: 'bronzeTools', req: 'metallurgy', cost: { ideas: 8000, copper: 300 }, effect: { res: { wood: 2, stone: 2 }, click: 2 },
      name: { en: 'Bronze Tools', ru: 'Бронзовые орудия' },
      desc: { en: 'Wood and Stone ×2. Clicks ×2.', ru: 'Дерево и Камень ×2. Клики ×2.' } },
    { id: 'ironworking', req: 'writing', cost: { ideas: 20000, copper: 1000, stone: 20000 },
      name: { en: 'Ironworking', ru: 'Обработка железа' },
      desc: { en: 'Unlocks the Iron Mine.', ru: 'Открывает Железный рудник.' } },
    { id: 'deepMining', req: 'ironworking', cost: { ideas: 40000, iron: 800 }, effect: { res: { copper: 2, iron: 2, stone: 2 } },
      name: { en: 'Deep Mining', ru: 'Глубокие шахты' },
      desc: { en: 'Copper, Iron and Stone ×2.', ru: 'Медь, Железо и Камень ×2.' } },
    { id: 'mechanics', req: 'ironworking', cost: { ideas: 50000, iron: 1000 },
      name: { en: 'Mechanics', ru: 'Механика' },
      desc: { en: 'Unlocks the Workshop and Water Wheel.', ru: 'Открывает Мастерскую и Водяное колесо.' } },
    { id: 'astronomy', req: 'mechanics', cost: { ideas: 90000, gears: 100 },
      name: { en: 'Astronomy', ru: 'Астрономия' },
      desc: { en: 'Unlocks the Observatory.', ru: 'Открывает Обсерваторию.' } },
    { id: 'electricity', req: 'mechanics', cost: { ideas: 150000, copper: 8000, gears: 300 }, effect: { res: { power: 2 } },
      name: { en: 'Electricity', ru: 'Электричество' },
      desc: { en: 'Power ×2. Lightning in a jar!', ru: 'Энергия ×2. Молния в кувшине!' } },
    { id: 'automation', req: 'electricity', cost: { ideas: 300000, gears: 1500, power: 5000 }, effect: { all: 2 },
      name: { en: 'Automation', ru: 'Автоматизация' },
      desc: { en: 'All production ×2.', ru: 'Вся добыча ×2.' } },
    { id: 'chronoTheory', req: 'astronomy', cost: { ideas: 500000, power: 8000 },
      name: { en: 'Chrono Theory', ru: 'Теория времени' },
      desc: { en: 'Unlocks the Crater Dig for Chronium.', ru: 'Открывает Раскопки кратера ради Хрония.' } }
  ];

  // Time machine repair, in order. The last one is the launch.
  const PARTS = [
    { id: 'hull', req: 'wheel', cost: { wood: 5000, stone: 5000 },
      name: { en: 'Patch the Hull', ru: 'Залатать корпус' } },
    { id: 'wiring', req: 'metallurgy', cost: { copper: 2000 },
      name: { en: 'Copper Wiring', ru: 'Медная проводка' } },
    { id: 'frame', req: 'ironworking', cost: { iron: 3000 },
      name: { en: 'Iron Frame', ru: 'Железный каркас' } },
    { id: 'gearbox', req: 'mechanics', cost: { gears: 800 },
      name: { en: 'Gearbox', ru: 'Редуктор' } },
    { id: 'battery', req: 'electricity', cost: { power: 20000, copper: 10000 },
      name: { en: 'Battery', ru: 'Аккумулятор' } },
    { id: 'core', req: 'chronoTheory', cost: { chronium: 250 },
      name: { en: 'Chronium Core', ru: 'Хрониевое ядро' } },
    { id: 'launch', req: 'chronoTheory', cost: { power: 100000, ideas: 2000000 },
      name: { en: 'Launch to 2026', ru: 'Запуск в 2026' } }
  ];

  // Story beats. `when` is checked every tick; each fires once.
  const STORY = [
    { id: 'start', when: s => true, text: {
      en: ['Galway, 2026. My first time machine test. I pressed the big red button.',
           'Now I am in a forest. There is a mammoth looking at me. The display says: 10,000 BC.',
           'The machine is wrecked. I need food, tools and a lot of ideas to fix it. Clicking the berry bush, the rocks and the trees is a start.'],
      ru: ['Голуэй, 2026 год. Первый запуск моей машины времени. Я нажал большую красную кнопку.',
           'Теперь я в лесу, и на меня смотрит мамонт. На дисплее: 10 000 лет до н. э.',
           'Машина разбита. Чтобы её починить, нужны еда, инструменты и очень много идей. Начну с кликов по кусту, камням и деревьям.'] } },
    { id: 'ideas', when: s => s.total.ideas >= 1, text: {
      en: ['Studying the wreck gives me ideas. If I click the machine, I remember how it works.'],
      ru: ['Когда изучаю обломки, появляются идеи. Кликая по машине, я вспоминаю, как она работает.'] } },
    { id: 'tribe', when: s => (s.b.forager || 0) >= 1, text: {
      en: ['A local tribe found me. Their leader, Oga, gave me a stick. I think we are friends now.',
           'If I teach them, they will help. Research is in the Ideas tab.'],
      ru: ['Меня нашло местное племя. Их вождь Ога дал мне палку. Кажется, теперь мы друзья.',
           'Если я научу их, они будут помогать. Исследования во вкладке «Идеи».'] } },
    { id: 'fire', when: s => s.tech.fire, text: {
      en: ['I showed them fire with a lighter from my pocket. Now the elders tell stories every night, and the stories become ideas.'],
      ru: ['Я показал им огонь с помощью зажигалки из кармана. Теперь старейшины каждый вечер рассказывают истории, а истории становятся идеями.'] } },
    { id: 'wheel', when: s => s.tech.wheel, text: {
      en: ['They invented the wheel. Well, I invented it again. History will not notice. Hopefully.',
           'Now I can start fixing the machine. The Time Machine tab is open.'],
      ru: ['Они изобрели колесо. Ну, я изобрёл его ещё раз. История не заметит. Надеюсь.',
           'Теперь можно чинить машину. Вкладка «Машина времени» открыта.'] } },
    { id: 'hull', when: s => s.parts.hull, text: {
      en: ['The hull holds together. The onboard computer woke up for a second and said: "Core missing. Chronium required."'],
      ru: ['Корпус держится. Бортовой компьютер на секунду включился и сказал: «Нет ядра. Нужен хроний».'] } },
    { id: 'writing', when: s => s.tech.writing, text: {
      en: ['Oga learned to write. His first word was "mammoth". His second word was also "mammoth".'],
      ru: ['Ога научился писать. Его первое слово было «мамонт». Второе тоже.'] } },
    { id: 'iron', when: s => s.tech.ironworking, text: {
      en: ['Iron, thousands of years early. Somewhere a historian just felt a chill.'],
      ru: ['Железо, на тысячи лет раньше срока. Где-то вздрогнул один историк.'] } },
    { id: 'electric', when: s => s.tech.electricity, text: {
      en: ['Electric light in the Stone Age. The tribe now calls me "the one who stole lightning".'],
      ru: ['Электрический свет в каменном веке. Племя теперь зовёт меня «тот, кто украл молнию».'] } },
    { id: 'chrono', when: s => s.tech.chronoTheory, text: {
      en: ['The crater by the river glows at night. It is full of chronium, the same crystal my core was made of.',
           'Maybe I was not sent here by accident.'],
      ru: ['Кратер у реки светится по ночам. Он полон хрония, того самого кристалла, из которого было ядро.',
           'Возможно, я попал сюда не случайно.'] } },
    { id: 'core', when: s => s.parts.core, text: {
      en: ['The core hums. Oga brought the whole tribe to say goodbye. I am not sure I want to leave.'],
      ru: ['Ядро гудит. Ога привёл всё племя попрощаться. Я уже не уверен, что хочу улетать.'] } }
  ];

  const ENDING = {
    en: ['3… 2… 1… Light, noise, and the smell of burnt toast.',
         'Galway, 2026. My garage. My coffee is still warm.',
         'But on the wall there is a cave painting that was not there before: a man, a mammoth, and a time machine.',
         'And the machine display is blinking again: "Temporal echo detected. Loop unstable."',
         'I blink, and I am back in the forest. The mammoth looks familiar. This time I remember everything.'],
    ru: ['3… 2… 1… Свет, шум и запах подгоревшего тоста.',
         'Голуэй, 2026 год. Мой гараж. Кофе ещё тёплый.',
         'Но на стене наскальный рисунок, которого раньше не было: человек, мамонт и машина времени.',
         'А дисплей машины снова мигает: «Обнаружено эхо времени. Петля нестабильна».',
         'Моргаю, и я снова в лесу. Мамонт кажется знакомым. Но в этот раз я помню всё.']
  };

  // Steam achievement candidates (ids map 1:1 to Steamworks later)
  const ACH = [
    { id: 'click1', when: s => s.clicks >= 1, name: { en: 'First Contact', ru: 'Первый контакт' }, desc: { en: 'Gather something.', ru: 'Добыть что-нибудь.' } },
    { id: 'click500', when: s => s.clicks >= 500, name: { en: 'Busy Hands', ru: 'Занятые руки' }, desc: { en: 'Click 500 times.', ru: 'Кликнуть 500 раз.' } },
    { id: 'build10', when: s => s.built >= 10, name: { en: 'Village', ru: 'Деревня' }, desc: { en: 'Own 10 buildings.', ru: 'Построить 10 зданий.' } },
    { id: 'build100', when: s => s.built >= 100, name: { en: 'Town', ru: 'Городок' }, desc: { en: 'Own 100 buildings.', ru: 'Построить 100 зданий.' } },
    { id: 'tech5', when: s => Object.keys(s.tech).length >= 5, name: { en: 'Teacher', ru: 'Учитель' }, desc: { en: 'Research 5 technologies.', ru: 'Изучить 5 технологий.' } },
    { id: 'techAll', when: s => Object.keys(s.tech).length >= TECHS.length, name: { en: 'Renaissance Caveman', ru: 'Пещерный гений' }, desc: { en: 'Research everything.', ru: 'Изучить всё.' } },
    { id: 'food1m', when: s => s.total.food >= 1e6, name: { en: 'Mammoth Feast', ru: 'Пир на весь мамонт' }, desc: { en: 'Gather 1M food in total.', ru: 'Собрать 1 млн еды за всё время.' } },
    { id: 'part1', when: s => s.parts.hull, name: { en: 'Some Assembly Required', ru: 'Требуется сборка' }, desc: { en: 'Repair the first part.', ru: 'Починить первую деталь.' } },
    { id: 'home', when: s => s.loops >= 1, name: { en: 'Back to 2026', ru: 'Назад в 2026' }, desc: { en: 'Launch the time machine.', ru: 'Запустить машину времени.' } },
    { id: 'loop3', when: s => s.loops >= 3, name: { en: 'Groundhog Era', ru: 'Эпоха сурка' }, desc: { en: 'Complete 3 time loops.', ru: 'Пройти 3 временные петли.' } }
  ];

  return { RES, BUILDINGS, TECHS, PARTS, STORY, ENDING, ACH };
})();
