// Endless Digging: walk on a 1:1 Earth in first person and dig; every stroke is paid at once, rarer ground pays more.
'use strict';
(function (root) {
  const W = root.World, T = root.THREE, S = root.Scene, MapV = root.MapView;
  const v3 = (x, y, z) => new T.Vector3(x, y, z);
  const $ = id => document.getElementById(id);

  // ---------- language ----------
  const RU = /^(ru|uk|be|kk)/i.test(navigator.language || '');
  const L = RU ? {
    title: 'Endless Digging', sub: 'Выкопай всю Землю. Начни с ложки.', play: 'Играть', cont: 'Продолжить',
    loading: 'Строим планету…', spoon: 'Ложка',
    lang: 'ru', shop: 'Исследования', shopSub: 'Выбери узел дерева', buy: 'Купить', bought: 'Уже есть', soon: 'Скоро', need: 'Не хватает', openShop: 'исследования', close: 'Закрыть',
    soonLong: 'Появится в следующих обновлениях', needFirst: 'Сначала нужно',
    rows: ['Инструмент', 'Сила', 'Геология', 'Торговля', 'Автоматизация'],
    eff: { perStroke: 'За взмах', perTrip: 'За ходку', stroke: 'Время взмаха', price: 'Цена грунта', rigs: 'Установки', rig1: '1 ручная', rig2: '2 с мотором', rig3: '3 с мотором', see: 'Видно', scanR: 'Радиус / глубина скана', probe: 'породы под прицелом до 4 м', detector: 'руду вокруг до 12 м' },
    node: {
      spoon: ['Ложка', 'С неё всё начинается. Маленькая ямка за взмах.'], scoop: ['Совок', 'Металлический совок: вдвое больше земли за взмах.'],
      trowel: ['Садовая лопатка', 'Острая лопатка, легко входит в глину.'], shovel: ['Лопата', 'Настоящая штыковая лопата. Нужны сильные руки.'],
      pick: ['Кирка', 'Разбивает камень глубже 16 м.'], b5: ['Ведро 5 л', 'Оранжевое ведро в левой руке.'], b10: ['Ведро 10 л', 'Вдвое больше земли за ходку.'],
      b20: ['Большое ведро 20 л', 'Тяжёлое, но ходить к приёмке реже.'], sack: ['Мешок за спиной 50 л', 'Прочный мешок, руки свободны.'], barrow: ['Тачка 120 л', 'Возить грунт тачкой.'],
      arms1: ['Сильные руки I', 'Взмах на 15 % быстрее.'], arms2: ['Сильные руки II', 'Ещё быстрее.'], arms3: ['Сильные руки III', 'Копаешь как машина.'],
      probe: ['Щуп', 'Стальной щуп: показывает, какие породы под прицелом, до 4 м вглубь.'], detector: ['Металлоискатель', 'Нажми E: один скан вокруг — руда в радиусе 8 м и до 4 м вглубь отмечается на земле с глубиной.'], detector2: ['Мощный металлоискатель', 'Скан на 15 м вокруг и до 8 м вглубь.'],
      radar: ['Георадар', 'Карта руды под участком.'], scales1: ['Свой покупатель', 'Постоянный покупатель платит за всё на 25 % больше.'], scales2: ['Договор с заводом', 'Платят на 50 % больше.'],
      auto1: ['Ручная копалка', 'Тренога со шнеком у лачуги: сама бурит землю, деньги идут тебе.'], auto2: ['Мотобур', 'Мотор на копалке — вдвое быстрее, и вторая установка.'], auto3: ['Третья установка', 'Ещё один мотобур.'], excavator: ['Мини-экскаватор', 'Настоящая техника для котлована.']
    },
    mat: ['чернозём', 'глина', 'гранит', 'магнетитовый кварцит', 'гематитовая руда'], firstOre: 'Руда! Железная руда стоит дороже земли',
    oreSold: 'руда сдана:', probeL: 'Щуп', detL: 'Металлоискатель', noOre: 'руды не найдено', found: 'найдено гнёзд:', nearest: 'ближайшее', scanB: 'скан', ahead: 'впереди', behind: 'сзади', leftS: 'слева', rightS: 'справа', depthL: 'глубина',
    status: 'Статус', priceL: 'Цена за литр', rarity: 'в земной коре', ppm: 'г/т', wells: 'добывается скважинами',
    srcUA: 'Координаты приблизительные, статус на 2026 год', srcWorld: 'Данные USGS MRDS, статус на момент их обновления',
    st: { work: 'работает', idle: 'простаивает', closed: 'закрыто', occ14: 'оккупировано с 2014', occ22: 'оккупировано с 2022', front: 'у линии фронта', expl: 'разведано, не разрабатывается',
      usgs_prod: 'добывалось', usgs_past: 'отработано', known: 'известное месторождение' },
    resTitle: 'Ресурсы на карте', lmap: 'л',
    helperPay: 'помощники', height: 'Высота над морем', core: 'До ядра', dug: 'Выкопано', left: 'Осталось выкопать', m3: 'м³', m: 'м', km: 'км', l: 'л',
    keys: '<b>WASD</b> идти · <b>Shift</b> бег · <b>Пробел</b> прыжок · <b>ЛКМ</b> копать (деньги сразу) · <b>F</b> исследования · <b>E</b> скан металлоискателем · <b>M</b> карта · <b>Esc</b> пауза',
    pause: 'Пауза', quality: 'Графика', hi: 'Высокая', mid: 'Средняя', lo: 'Быстрая', reset: 'Начать заново', far: 'Слишком далеко',
    clickHint: 'Кликни, чтобы управлять мышью', N: 'с. ш.', S: 'ю. ш.', E: 'в. д.', Wd: 'з. д.', planet: 'Планета Земля · радиус 6 371 км · окружность 40 030 км',
    sign: ['ПРИЁМ ГРУНТА', '$0.10 за литр'], bucket: 'Ведро', full: 'Ведро полное — неси в приёмку у лачуги', sell: 'сдать грунт', noDig: 'Здесь копать нельзя', inWay: 'Мешает — камень или дерево',
    map: 'Карта мира', mapHint: 'Тяни — вращать · колесо — масштаб · M — закрыть', mapTouch: 'Тяни — вращать · два пальца — масштаб', open: 'Открыто: Украина', locked: 'Остальной мир пока закрыт', here: 'Вы здесь',
    resetAsk: 'Нажми ещё раз: ямы, деньги и покупки пропадут'
  } : {
    title: 'Endless Digging', sub: 'Dig out the whole Earth. Start with a spoon.', play: 'Play', cont: 'Continue',
    loading: 'Building the planet…', spoon: 'Spoon',
    lang: 'en', shop: 'Research', shopSub: 'Pick a node of the tree', buy: 'Buy', bought: 'Owned', soon: 'Soon', need: 'Need', openShop: 'research', close: 'Close',
    soonLong: 'Coming in a later update', needFirst: 'First you need',
    rows: ['Tool', 'Strength', 'Geology', 'Trade', 'Automation'],
    eff: { perStroke: 'Per stroke', perTrip: 'Per trip', stroke: 'Stroke time', price: 'Soil price', rigs: 'Rigs', rig1: '1 hand-crank', rig2: '2 motor', rig3: '3 motor', see: 'Shows', scanR: 'Sweep radius / depth', probe: 'the ground under the crosshair to 4 m', detector: 'ore around you to 12 m' },
    node: {
      spoon: ['Spoon', 'Where it all starts. A tiny hole per stroke.'], scoop: ['Hand scoop', 'A metal scoop: twice the soil per stroke.'],
      trowel: ['Garden trowel', 'A sharp trowel that cuts into clay.'], shovel: ['Shovel', 'A real spade. Needs strong arms.'],
      pick: ['Pickaxe', 'Breaks rock below 16 m.'], b5: ['Bucket 5 L', 'The orange bucket in your left hand.'], b10: ['Bucket 10 L', 'Twice the soil per trip.'],
      b20: ['Big bucket 20 L', 'Heavy, but fewer trips to the bin.'], sack: ['Back sack 50 L', 'A strong sack, hands free.'], barrow: ['Wheelbarrow 120 L', 'Move soil by barrow.'],
      arms1: ['Strong arms I', 'Strokes 15 % faster.'], arms2: ['Strong arms II', 'Faster still.'], arms3: ['Strong arms III', 'You dig like a machine.'],
      probe: ['Probe', 'A steel probe: shows the ground under the crosshair, 4 m down.'], detector: ['Metal detector', 'Press E: one sweep — ore within 8 m and 4 m down gets marks on the ground with its depth.'], detector2: ['Strong detector', 'Sweeps 15 m around and 8 m down.'],
      radar: ['Ground radar', 'A map of the ore under the site.'], scales1: ['Regular buyer', 'A regular buyer pays 25 % more for everything.'], scales2: ['Plant contract', 'Pays 50 % more.'],
      auto1: ['Hand-crank rig', 'A tripod auger by the shack bores by itself; the money is yours.'], auto2: ['Motor drill', 'A motor on the rig: twice as fast, plus a second rig.'], auto3: ['Third rig', 'One more motor drill.'], excavator: ['Mini excavator', 'Real machinery for a proper pit.']
    },
    mat: ['topsoil', 'clay', 'granite', 'magnetite quartzite', 'hematite ore'], firstOre: 'Ore! Iron ore is worth more than soil',
    oreSold: 'ore handed in:', probeL: 'Probe', detL: 'Detector', noOre: 'no ore found', found: 'pockets found:', nearest: 'nearest', scanB: 'scan', ahead: 'ahead', behind: 'behind', leftS: 'to the left', rightS: 'to the right', depthL: 'depth',
    status: 'Status', priceL: 'Price per litre', rarity: 'in the crust', ppm: 'ppm', wells: 'extracted by wells',
    srcUA: 'Approximate coordinates, status as of 2026', srcWorld: 'USGS MRDS data, status as of its last update',
    st: { work: 'working', idle: 'idle', closed: 'closed', occ14: 'occupied since 2014', occ22: 'occupied since 2022', front: 'near the front line', expl: 'explored, not mined',
      usgs_prod: 'producer', usgs_past: 'past producer', known: 'well-known deposit' },
    resTitle: 'Resources on the map', lmap: 'L',
    helperPay: 'helpers', height: 'Above sea level', core: 'To the core', dug: 'Dug out', left: 'Left to dig', m3: 'm³', m: 'm', km: 'km', l: 'L',
    keys: '<b>WASD</b> walk · <b>Shift</b> run · <b>Space</b> jump · <b>LMB</b> dig (paid at once) · <b>F</b> research · <b>E</b> detector sweep · <b>M</b> map · <b>Esc</b> pause',
    pause: 'Paused', quality: 'Graphics', hi: 'High', mid: 'Medium', lo: 'Fast', reset: 'Start over', far: 'Too far',
    clickHint: 'Click to control with the mouse', N: 'N', S: 'S', E: 'E', Wd: 'W', planet: 'Planet Earth · radius 6,371 km · circumference 40,030 km',
    sign: ['SOIL WANTED', '$0.10 per litre'], bucket: 'Bucket', full: 'Bucket is full — take it to the bin by the shack', sell: 'hand in soil', noDig: "Can't dig here", inWay: 'A rock or a tree is in the way',
    map: 'World map', mapHint: 'Drag to turn · wheel to zoom · M to close', mapTouch: 'Drag to turn · two fingers to zoom', open: 'Open: Ukraine', locked: 'The rest of the world is locked for now', here: 'You are here',
    resetAsk: 'Press again: holes, money and upgrades will be lost'
  };
  document.documentElement.lang = RU ? 'ru' : 'en';
  const TOUCH = (root.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in root || /[?&]touch\b/.test(location.search);
  if (TOUCH) document.documentElement.classList.add('touch');
  Object.assign(L, RU ? { tkeys: '<b>Левый палец</b> — идти (дальше от центра — бег) · <b>правый</b> — смотреть · <b>копать</b> · <b>прыжок</b> · <b>карта</b> · <b>Ⅱ</b> пауза', dig: 'Копать', jumpB: 'Прыжок', turn: 'Поверни телефон боком — так удобнее' }
    : { tkeys: '<b>Left thumb</b> walk (push further to run) · <b>right</b> look · <b>dig</b> · <b>jump</b> · <b>map</b> · <b>Ⅱ</b> pause', dig: 'Dig', jumpB: 'Jump', turn: 'Turn your phone sideways for a better view' });

  // ---------- tools and economy ----------
  // the tool ladder (variant 1 of the progression page): each step digs a bigger scoop
  const TOOLS = {
    spoon: { r: 0.045, time: 0.5, reach: 2.3, parts: 4, size: 0.3 },
    scoop: { r: 0.065, time: 0.5, reach: 2.3, parts: 5, size: 0.4 },
    trowel: { r: 0.085, time: 0.55, reach: 2.4, parts: 6, size: 0.5 },
    shovel: { r: 0.12, time: 0.65, reach: 2.6, parts: 9, size: 0.75 }
  };
  // ---------- research tree ----------
  // Bought at the shack. Each node needs the nodes in req; 'soon' nodes are shown but not for sale yet.
  const NODES = [
    { id: 'spoon', row: 0, col: 0, icon: 'spoon', root: true },
    { id: 'scoop', row: 0, col: 1, icon: 'scoop', p: 2, req: ['spoon'] },
    { id: 'trowel', row: 0, col: 2, icon: 'trowel', p: 15, req: ['scoop'] },
    { id: 'shovel', row: 0, col: 3, icon: 'shovel', p: 60, req: ['trowel', 'arms1'] },
    { id: 'pick', row: 0, col: 4, icon: 'pick', soon: true, req: ['shovel'] },
    { id: 'arms1', row: 1, col: 1, icon: 'arm', p: 8, req: ['scoop'] },
    { id: 'arms2', row: 1, col: 2, icon: 'arm2', p: 25, req: ['arms1'] },
    { id: 'arms3', row: 1, col: 3, icon: 'arm3', p: 70, req: ['arms2'] },
    { id: 'probe', row: 2, col: 1, icon: 'probe', p: 12, req: ['scoop'] },
    { id: 'detector', row: 2, col: 2, icon: 'detector', p: 40, req: ['probe'] },
    { id: 'detector2', row: 2, col: 3, icon: 'detector2', p: 90, req: ['detector', 'arms2'] },
    { id: 'radar', row: 2, col: 4, icon: 'radar', soon: true, req: ['detector2'] },
    { id: 'scales1', row: 3, col: 1, icon: 'scale', p: 20, req: ['scoop'] },
    { id: 'scales2', row: 3, col: 2, icon: 'scale2', p: 90, req: ['scales1'] },
    { id: 'auto1', row: 4, col: 2, icon: 'rig', p: 30, req: ['trowel', 'scales1'] },
    { id: 'auto2', row: 4, col: 3, icon: 'rig2', p: 90, req: ['auto1'] },
    { id: 'auto3', row: 4, col: 4, icon: 'rig3', p: 250, req: ['auto2'] },
    { id: 'excavator', row: 4, col: 5, icon: 'cabin', soon: true, req: ['auto3'] }
  ];
  const owned = new Set(NODES.filter(n => n.root).map(n => n.id));
  const has = id => owned.has(id);
  const lvl = id => id === 'tool' ? (has('shovel') ? 'shovel' : has('trowel') ? 'trowel' : has('scoop') ? 'scoop' : 'spoon')
    : id === 'speed' ? (has('arms3') ? 0.61 : has('arms2') ? 0.72 : has('arms1') ? 0.85 : 1)
    : id === 'scale' ? (has('scales2') ? 1.5 : has('scales1') ? 1.25 : 1)
    : id === 'rigs' ? (has('auto3') ? 3 : has('auto2') ? 2 : has('auto1') ? 1 : 0)
    : id === 'rigLevel' ? (has('auto2') ? 2 : 1) : 0;
  const RIG_L = 1.0;                                     // a rig brings up 1 L per turn: every 3 s by hand crank, every 1.5 s with a motor
  // every stroke takes about the same bite: the dig point moves into the ground until this share of the scoop sphere is solid
  const BITE = 0.5;
  const PTS = (() => { const a = [], n = 96, g = Math.PI * (3 - Math.sqrt(5)); for (let i = 0; i < n; i++) { const y = 1 - (i + 0.5) / n * 2, r = Math.sqrt(1 - y * y), rr = Math.cbrt((i * 0.618034 % 1) * 0.92 + 0.08); a.push([Math.cos(g * i) * r * rr, y * rr, Math.sin(g * i) * r * rr]); } return a; })();
  // ---------- what the ground is made of; price per litre follows rarity in the Earth's crust (deposits.js) ----------
  // 0 topsoil, 1 clay, 2 granite, 3 magnetite quartzite (~30 % Fe), 4 rich hematite ore (~60 % Fe: twice the iron)
  const RESP = (root.DepositData && root.DepositData.res) || {}, FE = (RESP.fe && RESP.fe.price) || 0.29;
  const MATS = [{ p: 0.10 }, { p: 0.14 }, { p: (RESP.stone && RESP.stone.price) || 0.14 }, { p: FE, ore: true }, { p: FE * 2, ore: true }];
  const EARTH_VOL = 4 / 3 * Math.PI * Math.pow(W.R, 3);

  // ---------- player ----------
  const pl = { pos: v3(0, 0, 0), vel: v3(0, 0, 0), fwd: v3(0, 0, -1), pitch: 0, grounded: false, tool: 'spoon', dig: -1, dug: 0, money: 0, sold: 0, earned: [0, 0, 0, 0, 0] };
  const fmtMoney = v => v < 0.1 ? v.toFixed(3) : v.toFixed(2);
  const RAD = 0.3, EYE = 1.62, G = 9.81, JUMP = 4.3, WALK = 4.2, RUN = 7.0;   // real gravity; a jump of about 0.9 m
  const SPHERES = [0.31, 0.9, 1.42];
  const up = v3(0, 1, 0), right = v3(1, 0, 0);
  function frame() {
    up.copy(pl.pos).normalize();
    pl.fwd.addScaledVector(up, -pl.fwd.dot(up)).normalize();
    right.crossVectors(pl.fwd, up).normalize();
  }
  function camQuat(out) {
    const m = new T.Matrix4().makeBasis(right, up, pl.fwd.clone().negate());
    return (out || new T.Quaternion()).setFromRotationMatrix(m).multiply(new T.Quaternion().setFromAxisAngle(v3(1, 0, 0), pl.pitch));
  }
  function lookDir() { return v3(0, 0, -1).applyQuaternion(camQuat()); }

  function grad(x, y, z, out) {
    const e = 0.02;
    out.set(W.solid(x + e, y, z) - W.solid(x - e, y, z), W.solid(x, y + e, z) - W.solid(x, y - e, z), W.solid(x, y, z + e) - W.solid(x, y, z - e));
    const l = out.length() || 1; return out.multiplyScalar(-1 / l);
  }
  const tmp = v3(0, 0, 0), nrm = v3(0, 0, 0);
  function collide() {
    let ground = false;
    for (let it = 0; it < 3; it++) {
      for (const o of SPHERES) {
        tmp.copy(pl.pos).addScaledVector(up, o);
        const s = W.solid(tmp.x, tmp.y, tmp.z), dist = -s;
        if (dist >= RAD) continue;
        grad(tmp.x, tmp.y, tmp.z, nrm);
        const push = RAD - dist, nu = nrm.dot(up);
        if (o === SPHERES[0] && nu > 0.5) {
          pl.pos.addScaledVector(up, push / Math.max(0.6, nu)); ground = true;
          const vu = pl.vel.dot(up); if (vu < 0) pl.vel.addScaledVector(up, -vu);
        } else {
          pl.pos.addScaledVector(nrm, push);
          const vn = pl.vel.dot(nrm); if (vn < 0) pl.vel.addScaledVector(nrm, -vn);
        }
      }
    }
    // buildings and fixed props are solid: push out sideways
    for (const b of W.blockers) {
      const dx = pl.pos.x - b[0], dy = pl.pos.y - b[1], dz = pl.pos.z - b[2], along = dx * up.x + dy * up.y + dz * up.z;
      if (along > 3.2 || along < -2) continue;
      tmp.set(dx, dy, dz).addScaledVector(up, -along); const d = tmp.length(), r = b[4] + RAD;
      if (d < r && d > 1e-4) { tmp.multiplyScalar(1 / d); pl.pos.addScaledVector(tmp, r - d); const vn = pl.vel.dot(tmp); if (vn < 0) pl.vel.addScaledVector(tmp, -vn); }
    }
    for (const o of W.obstacles) {
      const dx = pl.pos.x - o.x, dy = pl.pos.y - o.y, dz = pl.pos.z - o.z;
      if (dx * dx + dy * dy + dz * dz > (o.r + o.h + 3) * (o.r + o.h + 3)) continue;
      const along = dx * o.ux + dy * o.uy + dz * o.uz;
      if (along > o.h + 0.05 || along < -1.7) continue;
      tmp.set(dx - o.ux * along, dy - o.uy * along, dz - o.uz * along); const d = tmp.length(), r = o.r + RAD * 0.8;
      if (d >= r) continue;
      if (along > o.h - 0.4 && d < o.r + 0.1 && pl.vel.dot(up) <= 0.5) {   // low rock: step up onto it
        pl.pos.addScaledVector(up, o.h - along); ground = true; const vu = pl.vel.dot(up); if (vu < 0) pl.vel.addScaledVector(up, -vu);
      } else if (d > 1e-4) { tmp.multiplyScalar(1 / d); pl.pos.addScaledVector(tmp, r - d); const vn = pl.vel.dot(tmp); if (vn < 0) pl.vel.addScaledVector(tmp, -vn); }
    }
    return ground;
  }
  function step(dt) {
    frame();
    const k = keys;
    let mx = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), mz = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), amt = 1;
    let run = k.ShiftLeft || k.ShiftRight;
    if (stick.id !== null) { mx = stick.x; mz = -stick.y; amt = Math.min(1, Math.hypot(mx, mz) * 1.25); run = amt >= 1 && Math.hypot(mx, mz) > 0.92; }
    const sp = run ? RUN : WALK;
    const wish = v3(0, 0, 0).addScaledVector(pl.fwd, mz).addScaledVector(right, mx);
    if (wish.lengthSq() > 0.0001) wish.normalize().multiplyScalar(sp * amt);
    // fixed small physics steps: the same feel at any frame rate
    let speed = 0, landV = 0;
    const n = Math.max(1, Math.ceil(dt / (1 / 120)));
    for (let i = 0; i < n; i++) {
      const h = dt / n; frame();
      const vu = pl.vel.dot(up), vt = pl.vel.clone().addScaledVector(up, -vu);
      vt.lerp(wish, Math.min(1, (pl.grounded ? 14 : 2.5) * h));
      let nvu = vu - G * h;
      if (pl.grounded && k.Space && !pl.jumpHeld) { nvu = JUMP; pl.grounded = false; pl.jumpHeld = true; Sound.jump(); }
      pl.vel.copy(vt).addScaledVector(up, nvu);
      pl.pos.addScaledVector(pl.vel, h); frame();
      const gr = collide();
      if (gr && !pl.grounded && vu < -4) landV = Math.max(landV, -vu);
      pl.grounded = gr; speed = vt.length();
    }
    if (!k.Space) pl.jumpHeld = false;
    if (landV) Sound.land(Math.min(1, landV / 10));
    if (pl.grounded && speed > 0.5) { pl.stepT = (pl.stepT || 0) + dt * speed; if (pl.stepT > (run ? 2.0 : 1.6)) { pl.stepT = 0; Sound.step(); } }
    return speed / RUN;
  }

  // ---------- digging ----------
  function rayHit(reach) {
    const eye = pl.pos.clone().addScaledVector(up, EYE), d = lookDir();
    // rocks, trunks and bushes are in the way: the spoon hits them, not the ground behind
    const tob = W.rayObstacle(eye.x, eye.y, eye.z, d.x, d.y, d.z, reach);
    reach = Math.min(reach, tob);
    let prev = 0;
    for (let t = 0.05; t <= reach; t += 0.02) {
      const p = eye.clone().addScaledVector(d, t);
      if (W.solid(p.x, p.y, p.z) > 0) {
        let a = prev, b = t;
        for (let i = 0; i < 7; i++) { const m = (a + b) / 2, q = eye.clone().addScaledVector(d, m); if (W.solid(q.x, q.y, q.z) > 0) b = m; else a = m; }
        return { p: eye.clone().addScaledVector(d, b), d, t: b };
      }
      prev = t;
    }
    return tob < Infinity ? { p: eye.clone().addScaledVector(d, tob), d, t: tob, obstacle: true } : null;
  }
  // the share of a sphere that is solid ground, and what it is made of (fixed sample points: no randomness)
  function bite(c, r, per) {
    let n = 0; if (per) per.fill(0);
    for (const q of PTS) { const x = c.x + q[0] * r, y = c.y + q[1] * r, z = c.z + q[2] * r; if (W.solid(x, y, z) > 0) { n++; if (per) per[W.materialAt(x, y, z)]++; } }
    return n / PTS.length;
  }
  function doDig(hit) {
    const tool = TOOLS[pl.tool];
    if (hit.obstacle) { notice(L.inWay); Sound.thud(); return false; }
    // push the scoop into the ground until it takes a full bite, so every stroke brings up about the same amount
    const c = hit.p.clone().addScaledVector(hit.d, tool.r * 0.2);
    for (let k = 0; k < 12 && bite(c, tool.r) < BITE; k++) c.addScaledVector(hit.d, tool.r * 0.12);
    if (W.blocked(c.x, c.y, c.z, tool.r + 0.05)) { notice(L.noDig); Sound.thud(); return false; }
    const per = [0, 0, 0, 0, 0], f = bite(c, tool.r, per), solidN = per.reduce((a, b) => a + b, 0);
    const litres = f * 4 / 3 * Math.PI * Math.pow(tool.r, 3) * 1000, k = solidN ? litres / solidN : 0;
    const depth = W.depthAt(hit.p.x, hit.p.y, hit.p.z);
    let main = 0; for (let i = 1; i < 5; i++) if (per[i] > per[main]) main = i;
    S.applyHole([c.x, c.y, c.z, tool.r], W.addHole(c.x, c.y, c.z, tool.r));
    S.burst(hit.p.x, hit.p.y, hit.p.z, S.matColor(main), tool.parts, hit.d.clone().negate(), tool.size);
    S.setSpoonFull(true);
    Sound.dig(pl.tool, depth);
    // paid on the spot
    let got = 0; for (let i = 0; i < 5; i++) { got += per[i] * k * MATS[i].p; pl.earned[i] += per[i] * k; }
    got *= lvl('scale'); pl.money += got; pl.dug += litres / 1000; pl.sold += litres;
    const oreL = (per[3] + per[4]) * k;
    if (oreL > 0.001) { floater('+$' + fmtMoney(got) + ' · ' + oreL.toFixed(2) + ' ' + L.l + ' ' + L.mat[per[4] > per[3] ? 4 : 3], 'ore'); if (!pl.foundOre) { pl.foundOre = true; notice(L.firstOre); } }
    else if (litres > 0.001) floater('+$' + fmtMoney(got) + ' · ' + litres.toFixed(2) + ' ' + L.l);
    S.setPile(Math.min(1, pl.sold / 400));
    dirty = true; return true;
  }

  // ---------- shop (at the shack) ----------
  let shopOpen = false;
  function applyUpgrades() {
    pl.tool = lvl('tool'); S.setTool(pl.tool);
    for (let i = 0; i < lvl('rigs'); i++) S.addMachine(i, lvl('rigLevel'));
  }
  // the research tree: rows of branches, lines from each node to what it needs; a card on the side says what you buy
  const nodeState = n => has(n.id) ? 'own' : n.soon ? 'soon' : (n.req || []).every(has) ? (pl.money >= n.p ? 'buy' : 'poor') : 'lock';
  let selNode = 'scoop';
  function effectText(id) {   // "now -> after" in plain words
    const E = L.eff, t = TOOLS;
    const sc = x => (Math.round(4 / 3 * Math.PI * Math.pow(t[x].r, 3) * 1000 * BITE * 100) / 100) + ' ' + L.l;
    const m = { scoop: [E.perStroke, sc('spoon'), sc('scoop')], trowel: [E.perStroke, sc('scoop'), sc('trowel')], shovel: [E.perStroke, sc('trowel'), sc('shovel')],
      arms1: [E.stroke, '100 %', '85 %'], arms2: [E.stroke, '85 %', '72 %'], arms3: [E.stroke, '72 %', '61 %'],
      scales1: [E.price, '×1', '×1.25'], scales2: [E.price, '×1.25', '×1.5'], auto1: [E.rigs, '0', E.rig1], auto2: [E.rigs, E.rig1, E.rig2], auto3: [E.rigs, E.rig2, E.rig3],
      probe: [E.see, '—', E.probe], detector: [E.scanR, '—', '8 ' + L.m + ' / 4 ' + L.m], detector2: [E.scanR, '8 ' + L.m + ' / 4 ' + L.m, '15 ' + L.m + ' / 8 ' + L.m] }[id];
    return m ? `<div class="eff"><span>${m[0]}</span><b>${m[1]}</b><i>→</i><b class="new">${m[2]}</b></div>` : '';
  }
  function treeHTML() {
    const CW = 104, RH = 96, X = c => 112 + c * CW, Y = r => 46 + r * RH, W2 = X(5) + 70, H2 = Y(5) + 60;
    let lines = '';
    for (const n of NODES) for (const r of n.req || []) {
      const a = NODES.find(x => x.id === r), on = has(r);
      lines += `<path d="M${X(a.col) + 30} ${Y(a.row)} C${X(a.col) + 64} ${Y(a.row)} ${X(n.col) - 64} ${Y(n.row)} ${X(n.col) - 30} ${Y(n.row)}" class="ln${on ? ' on' : ''}${has(n.id) ? ' done' : ''}"/>`;
    }
    let nodes = '';
    for (const n of NODES) {
      const st = nodeState(n);
      nodes += `<button class="tn ${st}${selNode === n.id ? ' sel' : ''}" data-id="${n.id}" style="left:${X(n.col) - 30}px;top:${Y(n.row) - 30}px" aria-label="${L.node[n.id][0]}">${Icons.svg(n.icon)}`
        + (st === 'own' ? '<em class="ok">✓</em>' : st === 'soon' ? `<em>${L.soon}</em>` : st === 'lock' ? `<em class="lk">${Icons.svg('lock')}</em>` : `<em>$${n.p}</em>`) + '</button>';
    }
    const rows = L.rows.map((r, i) => `<div class="rowL" style="top:${Y(i) - 9}px">${r}</div>`).join('');
    return `<div class="tree" style="width:${W2}px;height:${H2}px"><svg class="lines" width="${W2}" height="${H2}">${lines}</svg>${rows}${nodes}</div>`;
  }
  function cardHTML() {
    const n = NODES.find(x => x.id === selNode), st = nodeState(n), t = L.node[n.id];
    const need = (n.req || []).filter(r => !has(r)).map(r => L.node[r][0]);
    let act = '';
    if (st === 'own') act = `<div class="cState ok">✓ ${L.bought}</div>`;
    else if (st === 'soon') act = `<div class="cState">${L.soonLong}</div>`;
    else if (st === 'lock') act = `<div class="cState">${L.needFirst}: <b>${need.join(', ')}</b></div><button class="cBuy" disabled>$${n.p}</button>`;
    else act = `<button class="cBuy" data-id="${n.id}"${st === 'buy' ? '' : ' disabled'}>${st === 'buy' ? L.buy : L.need + ' $' + (n.p - pl.money).toFixed(2)} · $${n.p}</button>`;
    return `<div class="cIcon">${Icons.svg(n.icon)}</div><h3>${t[0]}</h3><p>${t[1]}</p>${effectText(n.id)}${act}`;
  }
  function renderShop() {
    const el = $('shop'), tw = el.querySelector('.treeWrap'), keep = tw ? [tw.scrollLeft, tw.scrollTop] : [0, 0];
    el.innerHTML = `<div class="shopCard"><div class="shopHead"><div><h2>${L.shop}</h2><p>${L.shopSub}</p></div><div class="shopMoney">$${pl.money.toFixed(2)}</div><button id="shopClose" aria-label="${L.close}">✕</button></div>`
      + `<div class="shopBody"><div class="treeWrap">${treeHTML()}</div><div class="nodeCard">${cardHTML()}</div></div></div>`;
    const tw2 = el.querySelector('.treeWrap'); tw2.scrollLeft = keep[0]; tw2.scrollTop = keep[1];
    $('shopClose').addEventListener('click', () => toggleShop(false));
    for (const b of el.querySelectorAll('.tn')) b.addEventListener('click', () => { selNode = b.dataset.id; renderShop(); });
    const cb = el.querySelector('.cBuy[data-id]'); if (cb) cb.addEventListener('click', () => buy(cb.dataset.id));
  }
  function buy(id) {
    const n = NODES.find(x => x.id === id);
    if (!n || n.soon || has(id) || !(n.req || []).every(has) || pl.money < n.p) return;
    pl.money -= n.p; owned.add(id); applyUpgrades(); Sound.coin(); dirty = true; save();
    const nx = NODES.find(x => (x.req || []).includes(id) && !has(x.id) && !x.soon); if (nx) selNode = nx.id;   // point at what comes next
    renderShop();
  }
  function toggleShop(on) {
    if (on === shopOpen) return;
    if (on) {
      if (!playing) return;
      shopOpen = true; playing = false; mouseDown = false; for (const k in keys) keys[k] = false;
      if (locked) { pausedByUs = true; document.exitPointerLock(); }
      renderShop(); $('shop').hidden = false;
    } else {
      shopOpen = false; $('shop').hidden = true; playing = true; if (!TOUCH) lock();
    }
  }
  // automation: each rig bores under itself and the soil is paid for at once
  const rigs = [];
  function updateMachines(dt) {
    const n = lvl('rigs'), period = lvl('rigLevel') > 1 ? 1.5 : 3;
    for (let i = 0; i < n; i++) {
      const rg = rigs[i] || (rigs[i] = { t: 0.7 * i });
      if ((rg.t += dt) < period) continue;
      rg.t = 0;
      for (let tries = 0; tries < 3; tries++) {
        const p = S.machineSpot(i, (Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.25); if (!p) break;
        const u = p.clone().normalize(), q = p.clone().addScaledVector(u, 0.8);
        for (let k = 0; k < 400 && W.solid(q.x, q.y, q.z) <= 0; k++) q.addScaledVector(u, -0.02);   // down to the bottom of its pit
        if (W.blocked(q.x, q.y, q.z, -0.05)) continue;
        const c = q.clone().addScaledVector(u, -0.04), r = 0.08;
        S.applyHole([c.x, c.y, c.z, r], W.addHole(c.x, c.y, c.z, r));
        S.burst(q.x, q.y, q.z, S.matColor(W.materialAt(c.x, c.y, c.z)), 3, null, 0.35);
        const m = W.materialAt(c.x, c.y, c.z), got = RIG_L * MATS[m].p * lvl('scale');
        pl.money += got; pl.dug += RIG_L / 1000; pl.earned[m] += RIG_L; pl.rigEarned = (pl.rigEarned || 0) + got; dirty = true;
        S.machineHit(i, W.depthAt(c.x, c.y, c.z)); break;
      }
    }
  }

  // ---------- input ----------
  const keys = {}; let mouseDown = false, locked = false, playing = false, look = { x: 0, y: 0 }, rmb = false, mapOpen = false;
  addEventListener('keydown', e => {
    if (e.code === 'KeyM' && (playing || mapOpen) && !e.repeat) { toggleMap(); e.preventDefault(); return; }
    if (mapOpen) { if (e.code === 'Escape') toggleMap(); return; }
    if (shopOpen) { if (e.code === 'Escape' || e.code === 'KeyF') toggleShop(false); return; }
    if (!playing) return;
    keys[e.code] = true;
    if (e.code === 'KeyF' && !e.repeat) toggleShop(true);
    if (e.code === 'KeyE' && !e.repeat) scan();
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouseDown = false; });
  const canvas = $('view');
  canvas.addEventListener('mousedown', e => {
    if (!playing) return;
    if (!locked && e.button === 0) lock();
    if (e.button === 0) mouseDown = true;
    if (e.button === 2) rmb = true;
  });
  addEventListener('mouseup', e => { if (e.button === 0) mouseDown = false; if (e.button === 2) rmb = false; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('mousemove', e => { if (!playing || (!locked && !rmb)) return; turn(e.movementX * 0.0022, e.movementY * 0.0022); });
  function turn(dx, dy) {
    frame();
    const c = Math.cos(dx), s = Math.sin(dx);
    pl.fwd.multiplyScalar(c).addScaledVector(right, s).normalize();
    pl.pitch = Math.max(-1.45, Math.min(1.45, pl.pitch - dy));
    look.x = Math.max(-0.03, Math.min(0.03, look.x - dx * 0.25)); look.y = Math.max(-0.03, Math.min(0.03, look.y + dy * 0.25));
  }
  function lock() { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {} }
  let pausedByUs = false;
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
    if (!locked && playing && !pausedByUs && !mapOpen && !shopOpen) pause(true);
    pausedByUs = false;
    $('clickHint').hidden = locked || !playing || TOUCH;
  });
  addEventListener('keydown', e => { if (e.code === 'Escape' && playing && !locked && !mapOpen) pause(true); });
  function setTool(t) { pl.tool = t; }

  // ---------- the world map ----------
  function toggleMap() {
    if (!mapOpen) {
      if (!playing) return;
      mapOpen = true; playing = false; mouseDown = false; for (const k in keys) keys[k] = false;
      if (locked) { pausedByUs = true; document.exitPointerLock(); }
      const [lat, lon] = W.toLatLon(pl.pos.x, pl.pos.y, pl.pos.z);
      $('hud').hidden = true; MapV.show(lat, lon);
    } else {
      MapV.close(); mapOpen = false; playing = true; $('hud').hidden = false;
      if (!TOUCH) lock();
    }
  }

  // ---------- sound (all synthesised) ----------
  const Sound = (function () {
    let ac = null, master = null, NB = null;
    const ctx = () => { if (!ac) { ac = new (root.AudioContext || root.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.7; master.connect(ac.destination); const b = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; NB = b; } return ac; };
    function noise(dur, f, q, gain, type = 'lowpass', delay = 0) {
      const c = ctx(), s = c.createBufferSource(); s.buffer = NB; s.loop = true;
      const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = c.createGain(), t = c.currentTime + delay;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(fl).connect(g).connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
    }
    function tone(f, dur, gain, slide = 0, type = 'sine', delay = 0) {
      const c = ctx(), o = c.createOscillator(), g = c.createGain(), t = c.currentTime + delay; o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
    }
    return {
      unlock() { try { ctx(); if (ac.state === 'suspended') ac.resume(); } catch (e) {} },
      dig(tool, depth) { if (!ac) return; const hard = depth > 13 ? 1 : 0; noise(0.16, 700 + hard * 900, 0.8, 0.22); tone(1900 + hard * 600, 0.05, 0.02, 0, 'triangle'); noise(0.25, 2600, 0.6, 0.04, 'highpass', 0.04); },
      thud() { if (!ac) return; noise(0.1, 220, 1, 0.12); },
      scan(found) { if (!ac) return; tone(600, 0.5, 0.05, 900, 'sine'); if (found) { tone(1400, 0.08, 0.06, 0, 'square', 0.55); tone(1400, 0.08, 0.06, 0, 'square', 0.7); } },
      coin() { if (!ac) return; noise(0.5, 400, 0.8, 0.25); tone(1320, 0.12, 0.12, 0, 'triangle', 0.25); tone(1760, 0.25, 0.12, 0, 'triangle', 0.36); },
      step() { if (!ac) return; noise(0.12, 380 + Math.random() * 120, 1.2, 0.1); noise(0.08, 2800, 0.7, 0.02, 'highpass'); },
      jump() { if (!ac) return; noise(0.1, 600, 1, 0.06); },
      land(k) { if (!ac) return; noise(0.2, 260, 1, 0.12 + 0.2 * k); tone(70, 0.15, 0.15 * k, -20); }
    };
  })();

  // ---------- HUD ----------
  function fmtInt(n) { return Math.round(n).toLocaleString(RU ? 'ru-RU' : 'en-US'); }
  function floater(text, cls) { const el = document.createElement('div'); el.className = 'floater' + (cls ? ' ' + cls : ''); el.textContent = text; $('floaters').appendChild(el); setTimeout(() => el.remove(), 1200); }
  let noticeT = 0;
  function notice(text) { const el = $('notice'); el.textContent = text; el.hidden = false; noticeT = 2.2; }
  function hud(dt) {
    const [lat, lon] = W.toLatLon(pl.pos.x, pl.pos.y, pl.pos.z);
    $('coords').textContent = Math.abs(lat).toFixed(5) + '° ' + (lat >= 0 ? L.N : L.S) + ', ' + Math.abs(lon).toFixed(5) + '° ' + (lon >= 0 ? L.E : L.Wd);
    $('alt').textContent = L.height + ': ' + (pl.pos.length() - W.R).toFixed(1) + ' ' + L.m;
    $('core').textContent = L.core + ': ' + fmtInt(pl.pos.length()) + ' ' + L.m;
    $('dug').textContent = L.dug + ': ' + pl.dug.toFixed(3) + ' ' + L.m3;
    $('left').textContent = fmtInt(EARTH_VOL - pl.dug) + ' ' + L.m3;
    const pct = pl.dug / EARTH_VOL * 100;
    $('pct').textContent = pct === 0 ? '0 %' : pct.toExponential(2).replace('e', ' × 10^') + ' %';
    $('money').textContent = '$' + pl.money.toFixed(2);
    $('bShop').innerHTML = (TOUCH ? '' : '<b>F</b> ') + L.openShop;
    $('bScan').hidden = !has('detector'); if (has('detector')) { $('bScan').innerHTML = (TOUCH ? '' : '<b>E</b> ') + L.scanB; $('bScan').classList.toggle('cool', scanCool > 0); }
    if (noticeT > 0 && (noticeT -= dt) <= 0) $('notice').hidden = true;
    geology(dt);
  }

  // ---------- geology: the probe reads the column under the crosshair, the detector looks for ore around ----------
  let geoT = 0, scanInfo = null, scanCool = 0;
  // the metal detector: press E (or the button) for one sweep; ore pockets in range get marks on the ground with their depth
  const scanRange = () => has('detector2') ? { r: 15, d: 8 } : { r: 8, d: 4 };
  function scan() {
    if (!has('detector') || !playing || scanCool > 0) return;
    const { r, d } = scanRange(); scanCool = 2.5;
    frame();
    const cols = new Map(), step = 0.7;
    for (let a = -r; a <= r; a += step) for (let b = -r; b <= r; b += step) {
      if (a * a + b * b > r * r) continue;
      const p0 = pl.pos.clone().addScaledVector(right, a).addScaledVector(pl.fwd, b), u = p0.clone().normalize();
      const top = u.clone().multiplyScalar(W.R + W.heightDir(u.x, u.y, u.z));
      for (let z = 0.3; z <= d; z += 0.3) {
        const q = top.clone().addScaledVector(u, -z);
        if (W.solid(q.x, q.y, q.z) <= 0) continue;
        const m = W.materialAt(q.x, q.y, q.z);
        if (m >= 3) { cols.set(Math.round(a / step) + ',' + Math.round(b / step), { a, b, z, m, top }); break; }
      }
    }
    // join neighbouring columns into pockets; one mark per pocket at its shallowest point
    const seen = new Set(), finds = [];
    for (const [k, c] of cols) {
      if (seen.has(k)) continue;
      const stack = [k], pocket = []; seen.add(k);
      while (stack.length) { const kk = stack.pop(), cc = cols.get(kk); pocket.push(cc); const [x, y] = kk.split(',').map(Number);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nk = (x + dx) + ',' + (y + dy); if (cols.has(nk) && !seen.has(nk)) { seen.add(nk); stack.push(nk); } } }
      let best = pocket[0], hem = 0; for (const c2 of pocket) { if (c2.z < best.z) best = c2; if (c2.m === 4) hem++; }
      finds.push({ pos: best.top, depth: best.z, mat: hem > pocket.length / 2 ? 4 : 3, size: pocket.length * step * step, dist: Math.hypot(best.a, best.b) });
    }
    finds.sort((x, y) => x.dist - y.dist);
    S.showScan(pl.pos, r, finds.slice(0, 14), L.m);
    Sound.scan(finds.length > 0);
    const n = finds[0];
    scanInfo = { until: t + 12, text: `<b>${L.detL}</b> ` + (n ? `${L.found} ${finds.length} · ${L.nearest} ${n.dist.toFixed(0)} ${L.m}, ${L.depthL} ${n.depth.toFixed(1)} ${L.m} · <span class="m${n.mat}">${L.mat[n.mat]}</span>` : `${L.noOre} (${r} ${L.m}, ${L.depthL} ${d} ${L.m})`) };
    geoT = 0;
  }
  function geology(dt) {
    const el = $('geo'); if (!has('probe')) { el.hidden = true; return; }
    if ((geoT -= dt) > 0) return; geoT = 0.25;
    let txt = '';
    const h = rayHit(TOOLS[pl.tool].reach + 1.5);
    if (h && !h.obstacle) {
      const u = h.p.clone().normalize(), parts = []; let cur = -1, from = 0;
      for (let d = 0; d <= 4.001; d += 0.1) {
        const q = h.p.clone().addScaledVector(u, -d), m = W.solid(q.x, q.y, q.z) > 0 ? W.materialAt(q.x, q.y, q.z) : -1;
        if (m !== cur) { if (cur >= 0) parts.push([cur, from, d]); cur = m; from = d; }
      }
      if (cur >= 0) parts.push([cur, from, 4]);
      txt = `<b>${L.probeL}</b> ` + parts.slice(0, 4).map(([m, a, b]) => `<span class="m${m}">${L.mat[m]}</span> ${a.toFixed(1)}–${b.toFixed(1)} ${L.m}`).join(' · ');
    }
    if (has('detector') && scanInfo && t < scanInfo.until) txt += (txt ? '<br>' : '') + scanInfo.text;
    el.innerHTML = txt; el.hidden = !txt;
  }

  // ---------- save ----------
  const SAVE = 'endlessdigging.v3', OLD_SAVE = 'endlessdigging.v2';   // v3: real relief (v2 holes no longer fit; money is kept)
  let dirty = false, saveT = 0;
  function save() {
    try { localStorage.setItem(SAVE, JSON.stringify({ holes: W.holes.map(h => h.map(v => Math.round(v * 1000) / 1000)), pos: pl.pos.toArray(), fwd: pl.fwd.toArray(), pitch: pl.pitch, dug: pl.dug, money: pl.money, bucket: pl.bucket, sold: pl.sold, earned: pl.earned, owned: [...owned], foundOre: !!pl.foundOre })); } catch (e) {}
    dirty = false;
  }
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE) || 'null'); if (s) return s;
      const o = JSON.parse(localStorage.getItem(OLD_SAVE) || 'null'); if (o) return { money: o.money || 0, sold: o.sold || 0, fresh: true };
    } catch (e) {}
    return null;
  }

  // ---------- start: Kryvyi Rih, Ukraine ----------
  const SPAWN_LAT = 47.9105, SPAWN_LON = 33.3918;
  function spawnPoint() {
    const d = W.fromLatLon(SPAWN_LAT, SPAWN_LON), h = W.heightDir(d[0], d[1], d[2]);
    return v3(d[0], d[1], d[2]).multiplyScalar(W.R + h + 0.05);
  }
  function setup() {
    if (TOUCH) S.setMobile(true);
    S.init(canvas);
    const sp = spawnPoint(); S.spawnPoint = sp;
    const saved = load();
    const u0 = sp.clone().normalize(), n0 = v3(0, 1, 0).addScaledVector(u0, -u0.y).normalize(), fwd0 = n0.clone().applyAxisAngle(u0, -0.6);
    if (saved && saved.fresh) { pl.money = saved.money; pl.sold = saved.sold; }
    if (saved && !saved.fresh) {
      for (const h of saved.holes || []) W.addHole(h[0], h[1], h[2], h[3]);
      pl.pos.fromArray(saved.pos); pl.fwd.fromArray(saved.fwd); pl.pitch = saved.pitch || 0; pl.dug = saved.dug || 0;
      pl.money = saved.money || 0; pl.sold = saved.sold || 0; pl.foundOre = !!saved.foundOre; pl.earned = saved.earned || [0, 0, 0, 0, 0];
      // whatever was still in the old bucket is paid out now
      if (saved.mix) pl.money += saved.mix.reduce((a, l, i) => a + l * MATS[i].p, 0);
      const renamed = { help1: 'auto1', help2: 'auto2', help3: 'auto3' };   // helpers became rigs
      for (let id of saved.owned || []) { id = renamed[id] || id; if (NODES.some(n => n.id === id)) owned.add(id); }
      if (saved.up) {   // the earlier shop (levels per line) -> nodes of the tree
        const chains = { tool: ['scoop', 'trowel', 'shovel'], speed: ['arms1', 'arms2', 'arms3'], scale: ['scales1', 'scales2'], help: ['auto1', 'auto2', 'auto3'] };
        for (const k in chains) for (let i = 0; i < (saved.up[k] || 0); i++) owned.add(chains[k][i]);
      }
    } else { pl.pos.copy(sp); pl.fwd.copy(fwd0); pl.pitch = -0.12; }
    frame();
    S.setOrigin(pl.pos);
    S.setRegion(sp, fwd0);
    S.setFrame(up);
    S.addProps({ sign: L.sign });
    S.setPile(Math.min(1, pl.sold / 400));
    applyUpgrades();
    S.updateFar(pl.pos, true); S.updateDeco(pl.pos, true);
    MapV.init(S.renderer(), $('mapUI'), L);
    addEventListener('resize', () => S.resize());
  }

  // ---------- touch controls ----------
  const stick = { id: null, x: 0, y: 0, ox: 0, oy: 0 }, lookT = { id: null, x: 0, y: 0 };
  function fullscreen() { try { const d = document.documentElement, f = d.requestFullscreen || d.webkitRequestFullscreen; if (f && !document.fullscreenElement) { const r = f.call(d); if (r && r.catch) r.catch(() => {}); } } catch (e) {} }
  function setupTouch() {
    const tapBtn = (el, fn) => el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); fn(); });
    tapBtn($('bShop'), () => toggleShop(true)); tapBtn($('bScan'), scan); tapBtn($('bMap'), () => { if (playing) toggleMap(); }); tapBtn($('mapClose'), () => { if (mapOpen) toggleMap(); });
    if (!TOUCH) return;
    const base = $('stick'), knob = $('knob'), R = 56;
    canvas.addEventListener('pointerdown', e => {
      if (!playing) return; e.preventDefault();
      if (e.clientX < innerWidth * 0.45 && stick.id === null) {
        stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY; stick.x = stick.y = 0;
        base.style.left = e.clientX + 'px'; base.style.top = e.clientY + 'px'; base.hidden = false; knob.style.transform = 'translate(-50%,-50%)';
      } else if (lookT.id === null) { lookT.id = e.pointerId; lookT.x = e.clientX; lookT.y = e.clientY; }
      try { canvas.setPointerCapture(e.pointerId); } catch (er) {}
    });
    canvas.addEventListener('pointermove', e => {
      if (e.pointerId === stick.id) {
        let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy; const l = Math.hypot(dx, dy);
        if (l > R) { dx *= R / l; dy *= R / l; }
        stick.x = dx / R; stick.y = dy / R; knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      } else if (e.pointerId === lookT.id) {
        turn((e.clientX - lookT.x) * 0.0055, (e.clientY - lookT.y) * 0.0055); lookT.x = e.clientX; lookT.y = e.clientY;
      }
    });
    const end = e => {
      if (e.pointerId === stick.id) { stick.id = null; stick.x = stick.y = 0; base.hidden = true; }
      if (e.pointerId === lookT.id) lookT.id = null;
    };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
    const hold = (el, on, off) => {
      el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); el.classList.add('down'); on(); try { el.setPointerCapture(e.pointerId); } catch (er) {} });
      const up2 = () => { el.classList.remove('down'); off(); };
      el.addEventListener('pointerup', up2); el.addEventListener('pointercancel', up2); el.addEventListener('lostpointercapture', up2);
    };
    hold($('bDig'), () => { mouseDown = true; }, () => { mouseDown = false; });
    hold($('bJump'), () => { keys.Space = true; }, () => { keys.Space = false; });
    $('bPause').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); pause(true); });
    for (const ev of ['touchstart', 'touchmove', 'gesturestart']) document.addEventListener(ev, e => { if ((playing || mapOpen) && !shopOpen && e.cancelable) e.preventDefault(); }, { passive: false });
    $('bDig').querySelector('span').textContent = L.dig; $('bJump').querySelector('span').textContent = L.jumpB; $('turnHint').textContent = L.turn;
  }

  // ---------- menus ----------
  function overlay(kind) {
    const o = $('overlay'); o.hidden = false;
    const q = S.getQuality();
    o.innerHTML = kind === 'loading'
      ? `<div class="card"><h1>${L.title}</h1><p class="sub">${L.sub}</p><div class="bar"><b id="loadBar"></b></div><p class="sub" id="loadTxt">${L.loading}</p></div>`
      : `<div class="card"><h1>${kind === 'pause' ? L.pause : L.title}</h1><p class="sub">${kind === 'pause' ? L.planet : L.sub}</p>
          <button id="bPlay" class="big">${kind === 'pause' ? L.cont : L.play}</button>
          <div class="row"><span>${L.quality}</span><button id="qHi" class="${q === 'high' ? 'on' : ''}">${L.hi}</button><button id="qMid" class="${q === 'mid' ? 'on' : ''}">${L.mid}</button><button id="qLo" class="${q === 'low' ? 'on' : ''}">${L.lo}</button></div>
          ${kind === 'pause' ? `<button id="bReset" class="ghost">${L.reset}</button>` : ''}
          <p class="keys">${TOUCH ? L.tkeys : L.keys}</p></div>`;
    if (kind === 'loading') return;
    $('bPlay').onclick = () => { Sound.unlock(); o.hidden = true; playing = true; $('hud').hidden = false; if (TOUCH) fullscreen(); else lock(); };
    $('qHi').onclick = () => { S.setQuality('high'); overlay(kind); };
    $('qMid').onclick = () => { S.setQuality('mid'); overlay(kind); };
    $('qLo').onclick = () => { S.setQuality('low'); overlay(kind); };
    const r = $('bReset'); if (r) r.onclick = () => {
      if (!r.dataset.armed) { r.dataset.armed = '1'; r.textContent = L.resetAsk; r.classList.add('warn'); return; }   // second press confirms
      W.clearHoles(); Object.assign(pl, { dug: 0, money: 0, sold: 0, earned: [0, 0, 0, 0, 0], foundOre: false }); owned.clear(); for (const n of NODES) if (n.root) owned.add(n.id); applyUpgrades(); S.resetChunks(); S.updateDeco(pl.pos, true); S.setPile(0);
      pl.pos.copy(spawnPoint()); pl.vel.set(0, 0, 0); save(); overlay(kind);
    };
  }
  function pause(on) { if (on) { playing = false; mouseDown = false; for (const k in keys) keys[k] = false; stick.id = lookT.id = null; stick.x = stick.y = 0; const sb = $('stick'); if (sb) sb.hidden = true; overlay('pause'); if (dirty) save(); } }

  // ---------- loop ----------
  let last = performance.now(), t = 0, loading = true, digT = 0, compiled = null;
  function loop(now) {
    if (root.__stopLoop) return;   // test tools take still frames themselves
    requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - last) / 1000); last = now; t += dt;
    if (MapV.isBusy()) { if (MapV.render(dt)) return; }
    if (loading) {
      const left = S.updateChunks(pl.pos, 30), total = S.chunkCount() + left;
      const b = $('loadBar'); if (b) b.style.width = Math.round(S.chunkCount() / Math.max(1, total) * 90) + '%';
      // shaders are compiled while the loading screen is up, so the first frames do not stall
      if (left === 0 && !compiled) compiled = S.compile().then(() => { compiled = 'done'; }, () => { compiled = 'done'; });
      if (compiled === 'done') { loading = false; overlay('start'); }
      S.render(pl.pos.clone().addScaledVector(up, EYE), camQuat(), { dig: -1, walk: 0, look }, dt, t);
      return;
    }
    let walk = 0;
    if (playing) {
      walk = step(dt);
      const tool = TOOLS[pl.tool];
      if (pl.dig < 0 && mouseDown && (locked || rmb || TOUCH)) { pl.dig = 0; pl.didHit = false; S.setSpoonFull(false); }
      if (pl.dig >= 0) {
        const prev = pl.dig; pl.dig += dt / (tool.time * lvl('speed'));
        if (prev < 0.45 && pl.dig >= 0.45 && !pl.didHit) { pl.didHit = true; const h = rayHit(tool.reach); if (h) doDig(h); }
        if (pl.dig >= 1) { pl.dig = mouseDown ? 0 : -1; pl.didHit = false; if (mouseDown) S.setSpoonFull(false); }
      }
      if ((digT += dt) > 0.08) { digT = 0; const ch = rayHit(tool.reach); $('cross').classList.toggle('hit', !!ch && !ch.obstacle); }
      S.updateChunks(pl.pos, 5); S.updateFar(pl.pos); S.updateDeco(pl.pos, false, 3);
      if ((saveT += dt) > 5 && dirty) { saveT = 0; save(); }
      updateMachines(dt); if (scanCool > 0) scanCool -= dt;
      hud(dt);
    }
    S.setFrame(up);
    look.x *= 0.88; look.y *= 0.88;
    S.render(pl.pos.clone().addScaledVector(up, EYE), camQuat(), { dig: pl.dig, walk, look }, dt, t);
  }

  root.addEventListener('load', () => {
    $('clickHint').textContent = L.clickHint; $('leftLbl').textContent = L.left;
    $('resTitle').textContent = L.resTitle;
    $('mapTitle').textContent = L.map; $('mapHint').textContent = TOUCH ? L.mapTouch : L.mapHint; $('mapOpen').textContent = L.open; $('mapLocked').textContent = L.locked;
    document.title = L.title;
    for (const el of document.querySelectorAll('[data-icon]')) el.innerHTML = Icons.svg(el.dataset.icon);
    overlay('loading');
    // build the world after the loading screen has been painted
    // the real relief has to be loaded before the world is built
    const D = root.DemInfo, get = f => fetch(f).then(r => { if (!r.ok) throw new Error(f + ' ' + r.status); return r.text(); }).then(t => { const bin = atob(t.trim()), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; });   // base64 int16
    const dem = D ? Promise.all(['local', 'ukraine'].map(k => get(D[k].file).then(b => [k, Object.assign({}, D[k], { data: new Int16Array(b) })])))
      .then(list => W.setDem(Object.fromEntries(list))).catch(e => console.warn('relief not loaded, using invented ground:', e.message)) : Promise.resolve();
    dem.then(() => setTimeout(() => {
      setup(); setupTouch();
      requestAnimationFrame(loop);
      addEventListener('beforeunload', () => { if (dirty) save(); });
      root.__game = { pl, W, S, owned, scan, applyUpgrades, toggleShop, renderShop, digNow(pitch, yaw) { pl.pitch = pitch; if (yaw) turn(yaw, 0); const h = rayHit(TOOLS[pl.tool].reach); return h ? doDig(h) : false; }, toggleMap, setTool,
        snap(pitch, adv) { if (pitch !== undefined) pl.pitch = pitch; S.render(pl.pos.clone().addScaledVector(up, EYE), camQuat(), { dig: -1, walk: 0, look }, adv || 0.016, t); return canvas.toDataURL('image/jpeg', 0.9); },
        mapSnap(steps) { for (let i = 0; i < (steps || 1); i++) MapV.render(0.1); return canvas.toDataURL('image/jpeg', 0.9); } };
    }, 30));
  });
})(window);
