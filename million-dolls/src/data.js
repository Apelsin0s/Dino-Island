// Game content. Every player-facing string is { en, ru }.
'use strict';
(function (root) {
  const PILE = 3000000;

  // What falls out of the dolls. `per` = expected amount per doll pulled; `from` = depth (0..1) where it starts.
  const LOOT = [
    { id: 'buttons',   per: 0.28,   from: 0,    name: { en: 'Buttons', ru: 'Пуговицы' } },
    { id: 'eyes',      per: 0.03,   from: 0,    name: { en: 'Glass eyes', ru: 'Стеклянные глаза' } },
    { id: 'wax',       per: 0.02,   from: 0,    name: { en: 'Candle wax', ru: 'Воск' } },
    { id: 'porcelain', per: 0.009,  from: 0.03, name: { en: 'Porcelain', ru: 'Фарфор' } },
    { id: 'teeth',     per: 0.0035, from: 0.1,  name: { en: 'Teeth', ru: 'Зубы' } },
    { id: 'thread',    per: 0.004,  from: 0.3,  name: { en: 'Black thread', ru: 'Чёрные нитки' } },
    { id: 'hearts',    per: 0.0006, from: 0.62, name: { en: 'Doll hearts', ru: 'Кукольные сердца' } }
  ];

  // Three keys. Each one is somewhere in a depth range; each opens the next part of the attic.
  const KEYS = [
    { id: 'brass', range: [0.26, 0.32], opens: 'nursery', name: { en: 'Brass key', ru: 'Латунный ключ' },
      text: { en: 'A small brass key with a ribbon. A tag: "Nursery". Behind the boarded gate, something hums a lullaby.', ru: 'Маленький латунный ключ на ленточке. Бирка: «Детская». За заколоченной решёткой кто-то напевает колыбельную.' } },
    { id: 'iron', range: [0.58, 0.65], opens: 'workshop', name: { en: 'Iron key', ru: 'Железный ключ' },
      text: { en: 'A heavy iron key, warm as skin. A tag: "Workshop. Do not let her in."', ru: 'Тяжёлый железный ключ, тёплый, как кожа. Бирка: «Мастерская. Не впускать её».' } },
    { id: 'bone', range: [0.9, 0.985], opens: 'door', name: { en: 'Bone key', ru: 'Костяной ключ' },
      text: { en: 'A key carved from bone. Yours? The door is far behind you. So is she.', ru: 'Ключ, вырезанный из кости. Твоей? Дверь далеко позади. Как и она.' } }
  ];

  // Upgrade tree. pos = [column, row]. Each level costs cost × growth^level. key = how many keys you need before it shows.
  // effects: pullSpeed, perPull, perPullMult, finds, rare, auto, autoMult, threat, battery, calm, salt, mirror, bell, chain,
  // whisper, magnet, light, wide (flashlight angle), gloves (no grabs), nerves (shorter scares), burn (reward for burning eyes),
  // torch (the flashlight itself), music (Mother sleeps), coffin (she restarts further away), rooms (more candles).
  const NODES = [
    // --- hands ---
    { id: 'quickHands', pos: [0, 4], max: 20, cost: { buttons: 8 }, growth: 1.62, effect: { pullSpeed: 0.12 },
      name: { en: 'Quick hands', ru: 'Быстрые руки' }, desc: { en: 'Pull dolls 12% faster.', ru: 'Тянешь кукол на 12% быстрее.' } },
    { id: 'bothHands', pos: [1, 3], req: ['quickHands'], max: 6, cost: { buttons: 60, eyes: 4 }, growth: 2.4, effect: { perPull: 1 },
      name: { en: 'Both hands', ru: 'Обе руки' }, desc: { en: '+1 doll per pull.', ru: '+1 кукла за рывок.' } },
    { id: 'scissors', pos: [1, 5], req: ['quickHands'], max: 10, cost: { eyes: 8 }, growth: 1.85, effect: { finds: 0.12 },
      name: { en: 'Scissors', ru: 'Ножницы' }, desc: { en: 'Cut them open: +12% finds.', ru: 'Вспарывать кукол: +12% находок.' } },
    { id: 'hooks', pos: [3, 2], req: ['puppet'], max: 2, cost: { porcelain: 40, eyes: 120 }, growth: 3, effect: { perPullMult: 1.5 },
      name: { en: 'Meat hooks', ru: 'Крюки' }, desc: { en: 'Each pull drags 50% more.', ru: 'Каждый рывок тянет на 50% больше.' } },
    { id: 'gloves', pos: [2, 6], req: ['scissors'], max: 1, cost: { eyes: 150, wax: 80 }, growth: 1, effect: { gloves: 1 },
      name: { en: 'Thick gloves', ru: 'Толстые перчатки' }, desc: { en: 'Hands from the pile can no longer pull you in.', ru: 'Руки из кучи больше не могут затянуть тебя.' } },
    { id: 'cleaver', pos: [5, 1], req: ['hooks'], key: 1, max: 3, cost: { thread: 240, teeth: 160 }, growth: 2.95, effect: { perPullMult: 1.3 },
      name: { en: 'Butcher\'s cleaver', ru: 'Мясницкий тесак' }, desc: { en: 'Each pull drags 30% more. It was already bloody.', ru: 'Каждый рывок тянет на 30% больше. Он уже был в крови.' } },
    // --- helpers ---
    { id: 'puppet', pos: [2, 3], req: ['bothHands'], max: 25, cost: { buttons: 120, eyes: 10 }, growth: 1.55, effect: { auto: 0.15 },
      name: { en: 'Marionette', ru: 'Марионетка' }, desc: { en: 'Digs for you: +0.15 dolls/s. It does not blink.', ru: 'Копает за тебя: +0,15 куклы/с. Она не моргает.' } },
    { id: 'strings', pos: [3, 3], req: ['puppet'], max: 10, cost: { porcelain: 30 }, growth: 2.3, effect: { autoMult: 0.15 },
      name: { en: 'New strings', ru: 'Новые нитки' }, desc: { en: 'All helpers +15% faster.', ru: 'Все помощники на 15% быстрее.' } },
    { id: 'chute', pos: [4, 3], req: ['strings'], max: 15, cost: { wax: 150, porcelain: 25 }, growth: 1.75, effect: { auto: 1 },
      name: { en: 'Laundry chute', ru: 'Бельевой жёлоб' }, desc: { en: '+1 doll/s. Something down there pushes back.', ru: '+1 кукла/с. Снизу кто-то толкает обратно.' } },
    { id: 'furnace', pos: [5, 3], req: ['chute'], max: 12, cost: { porcelain: 1500, teeth: 80 }, growth: 1.9, effect: { auto: 4, threat: 0.08 },
      name: { en: 'Furnace', ru: 'Печь' }, desc: { en: '+4 dolls/s. They scream. She hears. Threat +8%.', ru: '+4 куклы/с. Они кричат. Она слышит. Угроза +8%.' } },
    { id: 'sewing', pos: [6, 2], req: ['furnace'], key: 1, max: 15, cost: { thread: 480, porcelain: 16000 }, growth: 2.05, effect: { auto: 6 },
      name: { en: 'Sewing machine', ru: 'Швейная машинка' }, desc: { en: 'It sews them shut and stacks them: +6 dolls/s.', ru: 'Зашивает их и складывает: +6 кукол/с.' } },
    { id: 'grinder', pos: [6, 3], req: ['furnace'], max: 12, cost: { teeth: 1500, porcelain: 15000 }, growth: 2.0, effect: { auto: 12, threat: 0.12 },
      name: { en: 'Meat grinder', ru: 'Мясорубка' }, desc: { en: '+12 dolls/s. Why do they bleed? Threat +12%.', ru: '+12 кукол/с. Почему они кровоточат? Угроза +12%.' } },
    { id: 'conveyor', pos: [7, 2], req: ['sewing'], key: 1, max: 10, cost: { thread: 1600, teeth: 1600 }, growth: 2.55, effect: { autoMult: 0.2 },
      name: { en: 'Belt of hair', ru: 'Лента из волос' }, desc: { en: 'A conveyor woven from doll hair. Helpers +20%.', ru: 'Транспортёр, сплетённый из кукольных волос. Помощники +20%.' } },
    { id: 'automaton', pos: [9, 2], req: ['conveyor'], key: 2, max: 15, cost: { hearts: 280, thread: 21000 }, growth: 2.20, effect: { auto: 18 },
      name: { en: 'Moll\'s automaton', ru: 'Автоматон Молль' }, desc: { en: 'A clockwork girl that never stops: +18 dolls/s.', ru: 'Заводная девочка, которая не останавливается: +18 кукол/с.' } },
    { id: 'heartPump', pos: [10, 2], req: ['automaton'], key: 2, max: 8, cost: { hearts: 1050 }, growth: 2.85, effect: { autoMult: 0.25 },
      name: { en: 'Heart pump', ru: 'Сердечный насос' }, desc: { en: 'Feed the hearts to the machines. Helpers +25%.', ru: 'Скормить сердца механизмам. Помощники +25%.' } },
    // --- light ---
    { id: 'torch', pos: [0, 7], max: 1, cost: { buttons: 45 }, growth: 1, effect: { torch: 1 },
      name: { en: 'Flashlight', ru: 'Фонарик' }, desc: { en: 'An old flashlight from the pile. F to switch it on. You can finally see her. She can see you too.', ru: 'Старый фонарик из кучи. F — включить. Теперь ты её видишь. Она тебя тоже.' } },
    { id: 'battery', pos: [1, 7], req: ['torch'], max: 10, cost: { wax: 6 }, growth: 1.5, effect: { battery: 0.35 },
      name: { en: 'Batteries', ru: 'Батарейки' }, desc: { en: 'Flashlight lasts 35% longer.', ru: 'Фонарик работает на 35% дольше.' } },
    { id: 'lens', pos: [2, 9], req: ['battery'], max: 5, cost: { eyes: 40, wax: 30 }, growth: 1.9, effect: { wide: 0.06 },
      name: { en: 'Wide lens', ru: 'Широкая линза' }, desc: { en: 'Wider flashlight beam: easier to keep her lit.', ru: 'Шире луч фонарика: её легче держать в свете.' } },
    { id: 'candles', pos: [2, 7], req: ['battery'], max: 10, cost: { wax: 25 }, growth: 1.55, effect: { calm: 0.07 },
      name: { en: 'Candles', ru: 'Свечи' }, desc: { en: 'Candles around the pile. In their light she moves 7% slower.', ru: 'Свечи вокруг кучи. В их свете она на 7% медленнее.' } },
    { id: 'lantern', pos: [3, 7], req: ['candles'], max: 1, cost: { wax: 600, porcelain: 60 }, growth: 1, effect: { calm: 0.2, light: 1 },
      name: { en: 'Oil lantern', ru: 'Керосиновая лампа' }, desc: { en: 'A lamp over the pile. She hates it.', ru: 'Лампа над кучей. Она её ненавидит.' } },
    { id: 'roomLamps', pos: [5, 7], req: ['lantern'], key: 1, max: 3, cost: { wax: 12000, thread: 400 }, growth: 3.15, effect: { rooms: 1, calm: 0.05 },
      name: { en: 'Lamps in every room', ru: 'Лампы в каждой комнате' }, desc: { en: 'Light the new rooms. Fewer things crawl in the light.', ru: 'Осветить новые комнаты. В свете меньше ползает.' } },
    { id: 'uv', pos: [8, 7], req: ['roomLamps'], key: 2, max: 3, cost: { hearts: 210, wax: 140000 }, growth: 3.15, effect: { finds: 0.3, wide: 0.05 },
      name: { en: 'UV lamp', ru: 'Ультрафиолетовая лампа' }, desc: { en: 'Shows the blood. And what is hidden in it: +30% finds.', ru: 'Показывает кровь. И то, что в ней спрятано: +30% находок.' } },
    // --- wards ---
    { id: 'salt', pos: [2, 8], req: ['battery'], max: 10, cost: { eyes: 20 }, growth: 1.6, effect: { salt: 0.06 },
      name: { en: 'Salt line', ru: 'Соляная черта' }, desc: { en: 'She wakes up 6% slower.', ru: 'Она просыпается на 6% медленнее.' } },
    { id: 'bell', pos: [3, 8], req: ['salt'], max: 1, cost: { buttons: 800, eyes: 60 }, growth: 1, effect: { bell: 1 },
      name: { en: 'Bell on a string', ru: 'Колокольчик на нитке' }, desc: { en: 'Rings when she moves. Shows where she is.', ru: 'Звенит, когда она двигается. Показывает, где она.' } },
    { id: 'mirror', pos: [4, 8], req: ['bell'], max: 1, cost: { eyes: 200, porcelain: 50 }, growth: 1, effect: { mirror: 1 },
      name: { en: 'Old mirror', ru: 'Старое зеркало' }, desc: { en: 'While you dig, the mirror half-watches her: she moves at half speed.', ru: 'Пока копаешь, зеркало наполовину следит за ней: она вдвое медленнее.' } },
    { id: 'chain', pos: [5, 8], req: ['mirror'], max: 3, cost: { porcelain: 300, teeth: 40 }, growth: 2.2, effect: { chain: 1 },
      name: { en: 'Chain', ru: 'Цепь' }, desc: { en: 'Once per encounter the chain holds her back. +1 save per level.', ru: 'Один раз за встречу цепь её удерживает. +1 спасение за уровень.' } },
    { id: 'holyWater', pos: [6, 8], req: ['chain'], key: 1, max: 8, cost: { thread: 320, wax: 8000 }, growth: 2.05, effect: { salt: 0.05 },
      name: { en: 'Holy water', ru: 'Святая вода' }, desc: { en: 'From a church that burned down. She wakes 5% slower.', ru: 'Из сгоревшей церкви. Она просыпается на 5% медленнее.' } },
    { id: 'musicBox', pos: [7, 8], req: ['holyWater'], key: 1, max: 3, cost: { thread: 2000, porcelain: 80000 }, growth: 2.65, effect: { music: 1 },
      name: { en: 'Music box', ru: 'Музыкальная шкатулка' }, desc: { en: 'Press M: her old lullaby. She stands still for 15 s per level. Recharges.', ru: 'Нажми M: её старая колыбельная. Она замирает на 15 с за уровень. Перезаряжается.' } },
    { id: 'coffins', pos: [9, 8], req: ['musicBox'], key: 2, max: 3, cost: { hearts: 420, teeth: 140000 }, growth: 2.65, effect: { coffin: 1 },
      name: { en: 'Little coffins', ru: 'Маленькие гробики' }, desc: { en: 'After she gets you, she has to walk back from further away.', ru: 'После встречи ей приходится возвращаться издалека.' } },
    // --- nerves: answers to the scares ---
    { id: 'nerves', pos: [1, 9], req: ['quickHands'], max: 5, cost: { buttons: 300, wax: 20 }, growth: 2, effect: { nerves: 0.15 },
      name: { en: 'Steady nerves', ru: 'Крепкие нервы' }, desc: { en: 'Scares stop you for 15% less time.', ru: 'Страхи останавливают тебя на 15% меньше.' } },
    { id: 'burn', pos: [3, 9], req: ['lens'], max: 5, cost: { eyes: 120, porcelain: 30 }, growth: 2.2, effect: { burn: 0.5 },
      name: { en: 'Burn the eyes', ru: 'Выжечь глаза' }, desc: { en: 'Dolls with glowing eyes you burn with the flashlight drop 50% more.', ru: 'Куклы со светящимися глазами, выжженные фонариком, дают на 50% больше.' } },
    { id: 'trophies', pos: [6, 9], req: ['burn'], key: 1, max: 5, cost: { thread: 600, teeth: 1200 }, growth: 2.35, effect: { burn: 1 },
      name: { en: 'Trophies', ru: 'Трофеи' }, desc: { en: 'Things you drive off (crawler, eyes) leave more behind.', ru: 'То, что ты прогнал (ползун, глаза), оставляет больше.' } },
    // --- luck and the keys ---
    { id: 'intuition', pos: [2, 5], req: ['scissors'], max: 10, cost: { eyes: 35 }, growth: 1.55, effect: { rare: 0.15 },
      name: { en: 'Intuition', ru: 'Чутьё' }, desc: { en: '+15% porcelain, teeth, thread and hearts.', ru: '+15% фарфора, зубов, ниток и сердец.' } },
    { id: 'tweezers', pos: [3, 5], req: ['intuition'], max: 10, cost: { porcelain: 80 }, growth: 2.0, effect: { finds: 0.2 },
      name: { en: 'Surgical tweezers', ru: 'Хирургический пинцет' }, desc: { en: '+20% finds. Some of them are still warm.', ru: '+20% находок. Некоторые ещё тёплые.' } },
    { id: 'whisper', pos: [5, 5], req: ['tweezers', 'mirror'], max: 3, cost: { teeth: 60 }, growth: 4, effect: { whisper: 1 },
      name: { en: 'The keys whisper', ru: 'Шёпот ключей' }, desc: { en: 'You hear the next key. Each level narrows where it is.', ru: 'Ты слышишь следующий ключ. Каждый уровень сужает, где он.' } },
    { id: 'needles', pos: [6, 5], req: ['whisper'], key: 1, max: 8, cost: { thread: 800, eyes: 20000 }, growth: 2.15, effect: { rare: 0.25 },
      name: { en: 'Moll\'s needles', ru: 'Иглы Молль' }, desc: { en: '+25% rare finds. The needles were never cleaned.', ru: '+25% редких находок. Иглы никогда не мыли.' } },
    { id: 'heartSense', pos: [9, 5], req: ['needles'], key: 2, max: 8, cost: { hearts: 175 }, growth: 2.25, effect: { rare: 0.3, finds: 0.15 },
      name: { en: 'Hear the hearts', ru: 'Слышать сердца' }, desc: { en: 'They still beat inside. +30% rare, +15% all finds.', ru: 'Они ещё бьются внутри. +30% редкого, +15% всего.' } },
    { id: 'magnet', pos: [11, 4], req: ['heartSense', 'heartPump'], key: 2, max: 1, cost: { hearts: 14000, teeth: 1400000 }, growth: 1.15, effect: { magnet: 1 },
      name: { en: 'Horseshoe magnet', ru: 'Подковообразный магнит' }, desc: { en: 'Pulls the last key out as soon as it is close.', ru: 'Вытягивает последний ключ, как только он рядом.' } }
  ];

  // Notes found in the pile, in order of depth. Three chapters: the hall, the nursery, the workshop.
  const NOTES = [
    { at: 0.0002, en: 'Note in a doll\'s mouth: "Don\'t look away from Mother. She only moves in the dark of your back."', ru: 'Записка во рту куклы: «Не отворачивайся от Мамы. Она ходит только у тебя за спиной».' },
    { at: 0.004, en: 'Diary, page torn: "Day 3. The door locked itself. The keys are in the pile. She was by the window. Now she is by the beam."', ru: 'Дневник, страница вырвана: «День 3. Дверь заперлась сама. Ключи в куче. Она была у окна. Теперь у балки».' },
    { at: 0.012, en: 'Shop tag: "Moll & Daughters, dollmakers since 1891. Every doll has a heart."', ru: 'Бирка: «Молль и дочери, кукольных дел мастера с 1891 года. У каждой куклы есть сердце».' },
    { at: 0.025, en: 'Scratched inside a porcelain head: "the stuffing is not cotton"', ru: 'Нацарапано внутри фарфоровой головы: «набивка — не вата»' },
    { at: 0.045, en: 'Diary: "Something walks on the ceiling at night. Too many elbows."', ru: 'Дневник: «Ночью по потолку кто-то ходит. Слишком много локтей».' },
    { at: 0.07, en: 'Police report, 1974: "Seven missing. The attic was searched. Only dolls found. Many dolls."', ru: 'Полицейский рапорт, 1974: «Пропали семеро. Чердак обыскан. Найдены только куклы. Очень много кукол».' },
    { at: 0.1, en: 'Child\'s drawing: a big doll holding a smaller one. Under it: "Mother counts us every night."', ru: 'Детский рисунок: большая кукла держит маленькую. Подпись: «Мама пересчитывает нас каждую ночь».' },
    { at: 0.14, en: 'A milk tooth wrapped in a note: "for the doll that has none".', ru: 'Молочный зуб, завёрнутый в записку: «для куклы, у которой их нет».' },
    { at: 0.18, en: 'Diary: "If a doll\'s eyes light up, do not go to it. Burn them with the light from far away."', ru: 'Дневник: «Если у куклы зажглись глаза, не подходи. Выжги их светом издалека».' },
    { at: 0.22, en: 'Receipt, 1931: "3 barrels of salt. 40 meters of black thread. 1 small coffin."', ru: 'Чек, 1931: «3 бочки соли. 40 метров чёрных ниток. 1 маленький гробик».' },
    { at: 0.26, en: 'Diary: "The brass key is close. I can hear the lullaby behind the boards."', ru: 'Дневник: «Латунный ключ рядом. Я слышу колыбельную за досками».' },
    // chapter 2: the nursery
    { at: 0.31, en: 'Nursery register: "Greta, 6. Ilse, 8. Mina, 5. Moved to the attic. Forever."', ru: 'Журнал детской: «Грета, 6. Ильза, 8. Мина, 5. Переведены на чердак. Навсегда».' },
    { at: 0.35, en: 'Letter from Greta: "Mama sews us new faces when we cry. I stopped crying."', ru: 'Письмо Греты: «Мама шьёт нам новые лица, когда мы плачем. Я перестала плакать».' },
    { at: 0.39, en: 'A doll\'s dress, child size. A name tag inside: "Ilse".', ru: 'Кукольное платье детского размера. Внутри бирка: «Ильза».' },
    { at: 0.43, en: 'Diary: "A hand came out of the pile and held my wrist. It was small. It was cold."', ru: 'Дневник: «Из кучи вылезла рука и держала меня за запястье. Маленькая. Холодная».' },
    { at: 0.47, en: 'Lullaby sheet, blood on the notes: "Sleep, my dolly, sleep / Mother sews you deep."', ru: 'Ноты колыбельной, на нотах кровь: «Спи, моя куколка, спи / Мама зашьёт тебя внутри».' },
    { at: 0.51, en: 'Diary, shaky: "They all turned their heads. All of them. At once."', ru: 'Дневник, дрожащий почерк: «Они все повернули головы. Все. Разом».' },
    { at: 0.55, en: 'Agatha Moll: "If you are reading this, you are deep enough to hear them breathe."', ru: 'Агата Молль: «Если ты это читаешь, ты достаточно глубоко, чтобы слышать, как они дышат».' },
    { at: 0.58, en: 'Workshop order: "One heart per doll. Fresh."', ru: 'Заказ в мастерскую: «Одно сердце на куклу. Свежее».' },
    // chapter 3: the workshop
    { at: 0.66, en: 'Agatha\'s diary, 1890: "My girls will never leave me. I will keep them pretty forever."', ru: 'Дневник Агаты, 1890: «Мои девочки никогда меня не оставят. Я сохраню их красивыми навсегда».' },
    { at: 0.7, en: 'Instruction, Agatha\'s hand: "Porcelain for the face. Hair for the thread. Heart for the clockwork."', ru: 'Инструкция, почерк Агаты: «Фарфор — для лица. Волосы — на нитки. Сердце — для заводного механизма».' },
    { at: 0.73, en: 'A doll in modern clothes. Your size. Your face.', ru: 'Кукла в современной одежде. Твоего роста. С твоим лицом.' },
    { at: 0.76, en: 'Agatha: "Every guest digs. Every guest finds the keys. Every guest becomes a doll. Mother needs more children."', ru: 'Агата: «Каждый гость копает. Каждый гость находит ключи. Каждый гость становится куклой. Маме нужно больше детей».' },
    { at: 0.8, en: 'Diary, your handwriting: "Day 1. The door locked itself." You do not remember writing it.', ru: 'Дневник, твой почерк: «День 1. Дверь заперлась сама». Ты не помнишь, как это писал.' },
    { at: 0.83, en: 'Mina\'s drawing: Mother with a pair of scissors standing behind you. It is dated tomorrow.', ru: 'Рисунок Мины: Мама с ножницами у тебя за спиной. Дата — завтрашняя.' },
    { at: 0.86, en: 'Agatha: "The thing on the ceiling was my husband. He did not want to be a doll. So he became something else."', ru: 'Агата: «То, что на потолке, — мой муж. Он не хотел быть куклой. Поэтому стал чем-то другим».' },
    { at: 0.89, en: 'A list of names. Seven crossed out. The eighth is yours, not crossed out yet.', ru: 'Список имён. Семь зачёркнуты. Восьмое — твоё, пока не зачёркнуто.' },
    { at: 0.93, en: 'Agatha: "The bone key opens the door. The door opens the attic. The attic is always full."', ru: 'Агата: «Костяной ключ открывает дверь. Дверь открывает чердак. Чердак всегда полон».' },
    { at: 0.97, en: 'The last page: "Mother, I am home."', ru: 'Последняя страница: «Мама, я дома».' }
  ];

  // Bloody writing that appears on walls during scares.
  const WRITINGS = {
    en: ['SHE IS BEHIND YOU', 'DON\'T BLINK', 'WE SEE YOU', 'STAY WITH US', 'MOTHER IS COUNTING', 'ONE MORE DOLL', 'YOU ARE IN THE PILE', 'TURN AROUND'],
    ru: ['ОНА ЗА ТОБОЙ', 'НЕ МОРГАЙ', 'МЫ ТЕБЯ ВИДИМ', 'ОСТАНЬСЯ С НАМИ', 'МАМА СЧИТАЕТ', 'ЕЩЁ ОДНА КУКЛА', 'ТЫ В КУЧЕ', 'ОБЕРНИСЬ']
  };

  const WARNING = {
    en: ['This game contains: intense horror, sudden loud jumpscares, blood and gore, flashing light, themes of death and missing children.',
         'Not recommended for people with heart conditions, epilepsy or photosensitivity, during pregnancy, or for anyone under 18.',
         'You can turn off jumpscares, blood and flashing in Settings at any time.'],
    ru: ['В игре есть: сильный хоррор, внезапные громкие скримеры, кровь и насилие, вспышки света, темы смерти и пропавших детей.',
         'Не рекомендуется людям с болезнями сердца, эпилепсией или светочувствительностью, во время беременности, а также младше 18 лет.',
         'Скримеры, кровь и вспышки можно выключить в настройках в любой момент.']
  };

  const ENDING = {
    en: ['The bone key turns. The door opens.', 'Behind it: stairs going up. Another attic.', 'Another pile. Three million dolls. One of them is wearing your clothes.', 'Mother is already standing in the corner. She is not facing the wall.'],
    ru: ['Костяной ключ поворачивается. Дверь открывается.', 'За ней лестница наверх. Ещё один чердак.', 'Ещё одна куча. Три миллиона кукол. На одной из них твоя одежда.', 'Мама уже стоит в углу. Она не смотрит в стену.']
  };

  const api = { PILE, LOOT, KEYS, NODES, NOTES, WRITINGS, WARNING, ENDING };
  root.DOLLS_DATA = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
