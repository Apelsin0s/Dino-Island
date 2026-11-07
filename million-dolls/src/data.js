// Game content. Every player-facing string is { en, ru }.
'use strict';
(function (root) {
  const PILE = 1000000;

  // What falls out of the dolls. `per` = expected amount per doll pulled; `from` = depth (0..1) where it starts.
  const LOOT = [
    { id: 'buttons',   per: 0.28,  from: 0,    color: '#c9b8a0', name: { en: 'Buttons', ru: 'Пуговицы' } },
    { id: 'eyes',      per: 0.03,  from: 0,    color: '#7fb2d8', name: { en: 'Glass eyes', ru: 'Стеклянные глаза' } },
    { id: 'wax',       per: 0.02,  from: 0,    color: '#e8d8a8', name: { en: 'Candle wax', ru: 'Воск' } },
    { id: 'porcelain', per: 0.009, from: 0.08, color: '#e8e4dc', name: { en: 'Porcelain', ru: 'Фарфор' } },
    { id: 'teeth',     per: 0.0035, from: 0.25, color: '#efe6c8', name: { en: 'Teeth', ru: 'Зубы' } }
  ];

  // Upgrade tree. pos = [column, row] in the notebook. Each level costs cost × growth^level.
  // effect keys: pullSpeed (+x per level), perPull (+n), finds (+x), rare (+x), auto (+dolls/s), autoMult, threat (+x),
  // battery (+x), calm (watcher speed −x when lit), salt (threat build −x), mirror, bell, chain (saves), whisper (key hint).
  const NODES = [
    { id: 'quickHands', pos: [0, 3], max: 20, cost: { buttons: 8 }, growth: 1.62, effect: { pullSpeed: 0.12 },
      name: { en: 'Quick hands', ru: 'Быстрые руки' }, desc: { en: 'Pull dolls 12% faster.', ru: 'Вытаскиваешь кукол на 12% быстрее.' } },
    { id: 'bothHands', pos: [1, 2], req: ['quickHands'], max: 6, cost: { buttons: 60, eyes: 4 }, growth: 2.4, effect: { perPull: 1 },
      name: { en: 'Both hands', ru: 'Обе руки' }, desc: { en: '+1 doll per pull.', ru: '+1 кукла за рывок.' } },
    { id: 'scissors', pos: [1, 4], req: ['quickHands'], max: 10, cost: { eyes: 8 }, growth: 1.85, effect: { finds: 0.12 },
      name: { en: 'Scissors', ru: 'Ножницы' }, desc: { en: 'Cut them open: +12% finds.', ru: 'Вспарывать кукол: +12% находок.' } },
    { id: 'puppet', pos: [2, 2], req: ['bothHands'], max: 25, cost: { buttons: 120, eyes: 10 }, growth: 1.55, effect: { auto: 0.15 },
      name: { en: 'Marionette', ru: 'Марионетка' }, desc: { en: 'A puppet on strings digs for you: +0.15 dolls/s. It does not blink.', ru: 'Марионетка на нитках копает за тебя: +0,15 куклы/с. Она не моргает.' } },
    { id: 'hooks', pos: [3, 1], req: ['puppet'], max: 2, cost: { porcelain: 40, eyes: 120 }, growth: 3, effect: { perPullMult: 1.5 },
      name: { en: 'Meat hooks', ru: 'Крюки' }, desc: { en: 'Each pull drags 50% more.', ru: 'Каждый рывок тянет на 50% больше.' } },
    { id: 'strings', pos: [3, 2], req: ['puppet'], max: 10, cost: { porcelain: 30 }, growth: 2.3, effect: { autoMult: 0.15 },
      name: { en: 'New strings', ru: 'Новые нитки' }, desc: { en: 'All helpers work 15% faster.', ru: 'Все помощники работают на 15% быстрее.' } },
    { id: 'chute', pos: [4, 2], req: ['strings'], max: 15, cost: { wax: 150, porcelain: 25 }, growth: 1.75, effect: { auto: 1 },
      name: { en: 'Laundry chute', ru: 'Бельевой жёлоб' }, desc: { en: 'Push them down the chute: +1 doll/s. Something down there pushes back.', ru: 'Сбрасывать их в жёлоб: +1 кукла/с. Снизу кто-то толкает обратно.' } },
    { id: 'furnace', pos: [5, 2], req: ['chute'], max: 12, cost: { porcelain: 1500, teeth: 80 }, growth: 1.9, effect: { auto: 4, threat: 0.08 },
      name: { en: 'Furnace', ru: 'Печь' }, desc: { en: 'Burn them: +4 dolls/s. They scream. She hears. Threat +8%.', ru: 'Сжигать их: +4 куклы/с. Они кричат. Она слышит. Угроза +8%.' } },
    { id: 'grinder', pos: [6, 2], req: ['furnace'], max: 12, cost: { teeth: 1500, porcelain: 15000 }, growth: 2.0, effect: { auto: 12, threat: 0.12 },
      name: { en: 'Meat grinder', ru: 'Мясорубка' }, desc: { en: '+12 dolls/s. Why do they bleed? Threat +12%.', ru: '+12 кукол/с. Почему они кровоточат? Угроза +12%.' } },
    { id: 'battery', pos: [1, 6], req: ['quickHands'], max: 10, cost: { wax: 6 }, growth: 1.5, effect: { battery: 0.35 },
      name: { en: 'Batteries', ru: 'Батарейки' }, desc: { en: 'Flashlight lasts 35% longer.', ru: 'Фонарик работает на 35% дольше.' } },
    { id: 'candles', pos: [2, 6], req: ['battery'], max: 10, cost: { wax: 25 }, growth: 1.55, effect: { calm: 0.07 },
      name: { en: 'Candles', ru: 'Свечи' }, desc: { en: 'Candles around the pile. In their light she moves 7% slower.', ru: 'Свечи вокруг кучи. В их свете она движется на 7% медленнее.' } },
    { id: 'lantern', pos: [3, 6], req: ['candles'], max: 1, cost: { wax: 600, porcelain: 60 }, growth: 1, effect: { calm: 0.2, light: 1 },
      name: { en: 'Oil lantern', ru: 'Керосиновая лампа' }, desc: { en: 'A lamp over the pile. She hates it.', ru: 'Лампа над кучей. Она её ненавидит.' } },
    { id: 'salt', pos: [2, 5], req: ['battery'], max: 10, cost: { eyes: 20 }, growth: 1.6, effect: { salt: 0.08 },
      name: { en: 'Salt line', ru: 'Соляная черта' }, desc: { en: 'She wakes up 8% slower.', ru: 'Она просыпается на 8% медленнее.' } },
    { id: 'bell', pos: [3, 5], req: ['salt'], max: 1, cost: { buttons: 800, eyes: 60 }, growth: 1, effect: { bell: 1 },
      name: { en: 'Bell on a string', ru: 'Колокольчик на нитке' }, desc: { en: 'Rings when she moves. Shows where she is.', ru: 'Звенит, когда она двигается. Показывает, где она.' } },
    { id: 'mirror', pos: [4, 5], req: ['bell'], max: 1, cost: { eyes: 200, porcelain: 50 }, growth: 1, effect: { mirror: 1 },
      name: { en: 'Old mirror', ru: 'Старое зеркало' }, desc: { en: 'Hang it over the pile: while you dig, the mirror half-watches her (she moves at half speed).', ru: 'Повесить над кучей: пока копаешь, зеркало наполовину следит за ней (она движется вдвое медленнее).' } },
    { id: 'chain', pos: [5, 5], req: ['mirror'], max: 3, cost: { porcelain: 300, teeth: 40 }, growth: 2.2, effect: { chain: 1 },
      name: { en: 'Chain', ru: 'Цепь' }, desc: { en: 'Once per encounter the chain holds her back. +1 save per level.', ru: 'Один раз за встречу цепь её удерживает. +1 спасение за уровень.' } },
    { id: 'intuition', pos: [2, 4], req: ['scissors'], max: 10, cost: { eyes: 35 }, growth: 1.55, effect: { rare: 0.15 },
      name: { en: 'Intuition', ru: 'Чутьё' }, desc: { en: '+15% porcelain and teeth.', ru: '+15% фарфора и зубов.' } },
    { id: 'tweezers', pos: [3, 4], req: ['intuition'], max: 10, cost: { porcelain: 80 }, growth: 2.0, effect: { finds: 0.2 },
      name: { en: 'Surgical tweezers', ru: 'Хирургический пинцет' }, desc: { en: '+20% finds. Some of them are still warm.', ru: '+20% находок. Некоторые ещё тёплые.' } },
    { id: 'whisper', pos: [5, 4], req: ['tweezers', 'mirror'], max: 3, cost: { teeth: 60 }, growth: 4, effect: { whisper: 1 },
      name: { en: 'The key whispers', ru: 'Шёпот ключа' }, desc: { en: 'You hear the key. Each level narrows where it is.', ru: 'Ты слышишь ключ. Каждый уровень сужает, где он.' } },
    { id: 'magnet', pos: [7, 3], req: ['whisper', 'grinder'], max: 1, cost: { teeth: 20000, porcelain: 120000 }, growth: 1, effect: { magnet: 1 },
      name: { en: 'Horseshoe magnet', ru: 'Подковообразный магнит' }, desc: { en: 'Pulls the key out the moment it is within reach.', ru: 'Вытягивает ключ, как только он рядом.' } }
  ];

  // Notes found in the pile at given depths (the story).
  const NOTES = [
    { at: 0.0005, en: 'Note in a doll\'s mouth: "Don\'t look away from Mother. She only moves in the dark of your back."', ru: 'Записка во рту куклы: «Не отворачивайся от Мамы. Она ходит только у тебя за спиной».' },
    { at: 0.01, en: 'Diary, page torn: "Day 3. The door locked itself. The key is in the pile. She was by the window. Now she is by the beam."', ru: 'Дневник, страница вырвана: «День 3. Дверь заперлась сама. Ключ в куче. Она была у окна. Теперь у балки».' },
    { at: 0.03, en: 'Shop tag: "Moll & Daughters, dollmakers since 1891. Every doll has a heart."', ru: 'Бирка: «Молль и дочери, кукольных дел мастера с 1891 года. У каждой куклы есть сердце».' },
    { at: 0.07, en: 'Scratched inside a porcelain head: "the stuffing is not cotton"', ru: 'Нацарапано внутри фарфоровой головы: «набивка — не вата»' },
    { at: 0.12, en: 'Police report, 1974: "Seven missing. The attic was searched. Only dolls found. Many dolls."', ru: 'Полицейский рапорт, 1974: «Пропали семеро. Чердак обыскан. Найдены только куклы. Очень много кукол».' },
    { at: 0.2, en: 'Child\'s drawing: a big doll holding a smaller one. Under it: "Mother counts us every night."', ru: 'Детский рисунок: большая кукла держит маленькую. Подпись: «Мама пересчитывает нас каждую ночь».' },
    { at: 0.3, en: 'A milk tooth wrapped in a note: "for the doll that has none".', ru: 'Молочный зуб, завёрнутый в записку: «для куклы, у которой их нет».' },
    { at: 0.42, en: 'Diary: "Day 40. I stopped counting days. I count dolls. 600,000 left. She smiled at me."', ru: 'Дневник: «День 40. Перестал считать дни. Считаю кукол. Осталось 600 000. Она мне улыбнулась».' },
    { at: 0.55, en: 'Letter from Agatha Moll: "If you are reading this, you are deep enough to hear them breathe."', ru: 'Письмо Агаты Молль: «Если ты это читаешь, ты достаточно глубоко, чтобы слышать, как они дышат».' },
    { at: 0.68, en: 'A doll in modern clothes. Your size. Your face.', ru: 'Кукла в современной одежде. Твоего роста. С твоим лицом.' },
    { at: 0.8, en: 'Diary, your handwriting: "Day 1. The door locked itself." You do not remember writing it.', ru: 'Дневник, твой почерк: «День 1. Дверь заперлась сама». Ты не помнишь, как это писал.' },
    { at: 0.9, en: 'Agatha Moll: "The key opens the door. The door opens the attic. The attic is always full."', ru: 'Агата Молль: «Ключ открывает дверь. Дверь открывает чердак. Чердак всегда полон».' }
  ];

  const WARNING = {
    en: ['This game contains: intense horror, sudden loud jumpscares, blood and gore, flashing light, themes of death and missing children.',
         'Not recommended for people with heart conditions, epilepsy or photosensitivity, during pregnancy, or for anyone under 18.',
         'You can turn off jumpscares, blood and flashing in Settings at any time.'],
    ru: ['В игре есть: сильный хоррор, внезапные громкие скримеры, кровь и насилие, вспышки света, темы смерти и пропавших детей.',
         'Не рекомендуется людям с болезнями сердца, эпилепсией или светочувствительностью, во время беременности, а также младше 18 лет.',
         'Скримеры, кровь и вспышки можно выключить в настройках в любой момент.']
  };

  const ENDING = {
    en: ['The key turns. The door opens.', 'Behind it: stairs going up. Another attic.', 'Another pile. One million dolls. One of them is wearing your clothes.', 'Mother is already standing in the corner. She is not facing the wall.'],
    ru: ['Ключ поворачивается. Дверь открывается.', 'За ней лестница наверх. Ещё один чердак.', 'Ещё одна куча. Миллион кукол. На одной из них твоя одежда.', 'Мама уже стоит в углу. Она не смотрит в стену.']
  };

  const api = { PILE, LOOT, NODES, NOTES, WARNING, ENDING };
  root.DOLLS_DATA = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
