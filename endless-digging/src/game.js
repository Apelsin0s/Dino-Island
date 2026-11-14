// Endless Digging: walk on a 1:1 Earth in first person, scoop soil with a spoon into a bucket, hand it in at the shack for money.
'use strict';
(function (root) {
  const W = root.World, T = root.THREE, S = root.Scene, MapV = root.MapView;
  const v3 = (x, y, z) => new T.Vector3(x, y, z);
  const $ = id => document.getElementById(id);

  // ---------- language ----------
  const RU = /^(ru|uk|be|kk)/i.test(navigator.language || '');
  const L = RU ? {
    title: 'Endless Digging', sub: 'Выкопай всю Землю. Начни с ложки.', play: 'Играть', cont: 'Продолжить',
    loading: 'Строим планету…', spoon: 'Ложка', height: 'Высота над морем', core: 'До ядра', dug: 'Выкопано', left: 'Осталось выкопать', m3: 'м³', m: 'м', km: 'км', l: 'л',
    keys: '<b>WASD</b> идти · <b>Shift</b> бег · <b>Пробел</b> прыжок · <b>ЛКМ</b> копать · <b>E</b> сдать грунт · <b>M</b> карта · <b>Esc</b> пауза',
    pause: 'Пауза', quality: 'Графика', hi: 'Высокая', mid: 'Средняя', lo: 'Быстрая', reset: 'Начать заново', far: 'Слишком далеко',
    clickHint: 'Кликни, чтобы управлять мышью', N: 'с. ш.', S: 'ю. ш.', E: 'в. д.', Wd: 'з. д.', planet: 'Планета Земля · радиус 6 371 км · окружность 40 030 км',
    sign: ['ПРИЁМ ГРУНТА', '$0.10 за литр'], bucket: 'Ведро', full: 'Ведро полное — неси в приёмку у лачуги', sell: 'сдать грунт', noDig: 'Здесь копать нельзя',
    map: 'Карта мира', mapHint: 'Тяни — вращать · колесо — масштаб · M — закрыть', mapTouch: 'Тяни — вращать · два пальца — масштаб', open: 'Открыто: Украина', locked: 'Остальной мир пока закрыт', here: 'Вы здесь',
    resetAsk: 'Точно начать заново? Ямы, деньги и ведро пропадут.'
  } : {
    title: 'Endless Digging', sub: 'Dig out the whole Earth. Start with a spoon.', play: 'Play', cont: 'Continue',
    loading: 'Building the planet…', spoon: 'Spoon', height: 'Above sea level', core: 'To the core', dug: 'Dug out', left: 'Left to dig', m3: 'm³', m: 'm', km: 'km', l: 'L',
    keys: '<b>WASD</b> walk · <b>Shift</b> run · <b>Space</b> jump · <b>LMB</b> dig · <b>E</b> hand in soil · <b>M</b> map · <b>Esc</b> pause',
    pause: 'Paused', quality: 'Graphics', hi: 'High', mid: 'Medium', lo: 'Fast', reset: 'Start over', far: 'Too far',
    clickHint: 'Click to control with the mouse', N: 'N', S: 'S', E: 'E', Wd: 'W', planet: 'Planet Earth · radius 6,371 km · circumference 40,030 km',
    sign: ['SOIL WANTED', '$0.10 per litre'], bucket: 'Bucket', full: 'Bucket is full — take it to the bin by the shack', sell: 'hand in soil', noDig: "Can't dig here",
    map: 'World map', mapHint: 'Drag to turn · wheel to zoom · M to close', mapTouch: 'Drag to turn · two fingers to zoom', open: 'Open: Ukraine', locked: 'The rest of the world is locked for now', here: 'You are here',
    resetAsk: 'Start over? Holes, money and the bucket will be lost.'
  };
  document.documentElement.lang = RU ? 'ru' : 'en';
  const TOUCH = (root.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in root || /[?&]touch\b/.test(location.search);
  if (TOUCH) document.documentElement.classList.add('touch');
  Object.assign(L, RU ? { tkeys: '<b>Левый палец</b> — идти (дальше от центра — бег) · <b>правый</b> — смотреть · <b>⛏</b> копать · <b>⤒</b> прыжок · <b>🗺</b> карта · <b>Ⅱ</b> пауза', dig: 'Копать', jumpB: 'Прыжок', turn: 'Поверни телефон боком — так удобнее' }
    : { tkeys: '<b>Left thumb</b> walk (push further to run) · <b>right</b> look · <b>⛏</b> dig · <b>⤒</b> jump · <b>🗺</b> map · <b>Ⅱ</b> pause', dig: 'Dig', jumpB: 'Jump', turn: 'Turn your phone sideways for a better view' });

  // ---------- tools and economy ----------
  const TOOLS = { spoon: { r: 0.045, time: 0.5, reach: 2.3, parts: 4, size: 0.3 } };
  const BUCKET_L = 5;                                    // litres
  const PRICE = d => d < 1.4 ? 0.10 : d < 6 ? 0.14 : d < 16 ? 0.2 : 0.35;   // $ per litre: topsoil, clay, deeper clay, rock
  const EARTH_VOL = 4 / 3 * Math.PI * Math.pow(W.R, 3);

  // ---------- player ----------
  const pl = { pos: v3(0, 0, 0), vel: v3(0, 0, 0), fwd: v3(0, 0, -1), pitch: 0, grounded: false, tool: 'spoon', dig: -1, dug: 0, money: 0, bucket: 0, bucketValue: 0, sold: 0 };
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
    return null;
  }
  function doDig(hit) {
    const tool = TOOLS[pl.tool];
    if (pl.bucket >= BUCKET_L - 1e-6) { notice(L.full); Sound.thud(); return false; }
    const c = hit.p.clone().addScaledVector(hit.d, tool.r * 0.45);
    if (W.blocked(c.x, c.y, c.z, tool.r + 0.05)) { notice(L.noDig); Sound.thud(); return false; }
    // how much solid ground the scoop removes (sampled)
    let solidN = 0; const NS = 48;
    for (let i = 0; i < NS; i++) {
      const a = v3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1); if (a.lengthSq() > 1) { i--; continue; }
      const q = c.clone().addScaledVector(a, tool.r); if (W.solid(q.x, q.y, q.z) > 0) solidN++;
    }
    let litres = solidN / NS * 4 / 3 * Math.PI * Math.pow(tool.r, 3) * 1000;
    litres = Math.min(litres, BUCKET_L - pl.bucket);
    const depth = W.depthAt(hit.p.x, hit.p.y, hit.p.z);
    const color = S.groundColor(Math.max(0.6, depth), 0, 0);
    const hole = [c.x, c.y, c.z, tool.r];
    S.applyHole(hole, W.addHole(c.x, c.y, c.z, tool.r));
    S.burst(hit.p.x, hit.p.y, hit.p.z, color, tool.parts, hit.d.clone().negate(), tool.size);
    S.setSpoonFull(true);
    Sound.dig(pl.tool, depth);
    pl.dug += litres / 1000; pl.bucket += litres; pl.bucketValue += litres * PRICE(depth);
    if (litres > 0.001) floater('+' + litres.toFixed(2) + ' ' + L.l);
    if (pl.bucket >= BUCKET_L - 1e-6) notice(L.full);
    dirty = true; return true;
  }
  // hand in the bucket at the bin
  let tipT = 0;
  function nearBin() { const d = S.drop; return d && pl.pos.distanceTo(d.point) < 2.7; }
  function sell() {
    if (!nearBin() || pl.bucket < 0.01 || tipT > 0) return;
    const got = Math.round(pl.bucketValue * 100) / 100, litres = pl.bucket;
    pl.money += got; pl.sold += litres; pl.bucket = 0; pl.bucketValue = 0; tipT = 0.9;
    const d = S.drop; S.burst(d.point.x, d.point.y, d.point.z, S.groundColor(0.6, 0, 0), 10, null, 0.5);
    S.setPile(Math.min(1, pl.sold / 400));
    floater('+$' + got.toFixed(2)); Sound.coin(); dirty = true;
  }

  // ---------- input ----------
  const keys = {}; let mouseDown = false, locked = false, playing = false, look = { x: 0, y: 0 }, rmb = false, mapOpen = false;
  addEventListener('keydown', e => {
    if (e.code === 'KeyM' && (playing || mapOpen) && !e.repeat) { toggleMap(); e.preventDefault(); return; }
    if (mapOpen) { if (e.code === 'Escape') toggleMap(); return; }
    if (!playing) return;
    keys[e.code] = true;
    if (e.code === 'KeyE' && !e.repeat) sell();
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
    if (!locked && playing && !pausedByUs && !mapOpen) pause(true);
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
      coin() { if (!ac) return; noise(0.5, 400, 0.8, 0.25); tone(1320, 0.12, 0.12, 0, 'triangle', 0.25); tone(1760, 0.25, 0.12, 0, 'triangle', 0.36); },
      step() { if (!ac) return; noise(0.12, 380 + Math.random() * 120, 1.2, 0.1); noise(0.08, 2800, 0.7, 0.02, 'highpass'); },
      jump() { if (!ac) return; noise(0.1, 600, 1, 0.06); },
      land(k) { if (!ac) return; noise(0.2, 260, 1, 0.12 + 0.2 * k); tone(70, 0.15, 0.15 * k, -20); }
    };
  })();

  // ---------- HUD ----------
  function fmtInt(n) { return Math.round(n).toLocaleString(RU ? 'ru-RU' : 'en-US'); }
  function floater(text) { const el = document.createElement('div'); el.className = 'floater'; el.textContent = text; $('floaters').appendChild(el); setTimeout(() => el.remove(), 1200); }
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
    const f = pl.bucket / BUCKET_L;
    $('bucketFill').style.width = (f * 100).toFixed(1) + '%'; $('bucketFill').classList.toggle('full', f > 0.999);
    $('bucketTxt').textContent = pl.bucket.toFixed(2) + ' / ' + BUCKET_L + ' ' + L.l;
    const canSell = nearBin() && pl.bucket > 0.01;
    $('bSell').hidden = !canSell; if (canSell) $('bSell').innerHTML = (TOUCH ? '' : '<b>E</b> ') + L.sell + ' · +$' + (Math.round(pl.bucketValue * 100) / 100).toFixed(2);
    if (noticeT > 0 && (noticeT -= dt) <= 0) $('notice').hidden = true;
    S.setBucket(f);
  }

  // ---------- save ----------
  const SAVE = 'endlessdigging.v2';
  let dirty = false, saveT = 0;
  function save() {
    try { localStorage.setItem(SAVE, JSON.stringify({ holes: W.holes.map(h => h.map(v => Math.round(v * 1000) / 1000)), pos: pl.pos.toArray(), fwd: pl.fwd.toArray(), pitch: pl.pitch, dug: pl.dug, money: pl.money, bucket: pl.bucket, bucketValue: pl.bucketValue, sold: pl.sold })); } catch (e) {}
    dirty = false;
  }
  function load() { try { return JSON.parse(localStorage.getItem(SAVE) || 'null'); } catch (e) { return null; } }

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
    if (saved) {
      for (const h of saved.holes || []) W.addHole(h[0], h[1], h[2], h[3]);
      pl.pos.fromArray(saved.pos); pl.fwd.fromArray(saved.fwd); pl.pitch = saved.pitch || 0; pl.dug = saved.dug || 0;
      pl.money = saved.money || 0; pl.bucket = saved.bucket || 0; pl.bucketValue = saved.bucketValue || 0; pl.sold = saved.sold || 0;
    } else { pl.pos.copy(sp); pl.fwd.copy(fwd0); pl.pitch = -0.12; }
    frame();
    S.setOrigin(pl.pos);
    S.setRegion(sp, fwd0);
    S.setFrame(up);
    S.addProps({ sign: L.sign });
    S.setPile(Math.min(1, pl.sold / 400));
    S.updateFar(pl.pos, true); S.updateDeco(pl.pos, true);
    MapV.init(S.renderer(), $('mapUI'), L);
    addEventListener('resize', () => S.resize());
  }

  // ---------- touch controls ----------
  const stick = { id: null, x: 0, y: 0, ox: 0, oy: 0 }, lookT = { id: null, x: 0, y: 0 };
  function fullscreen() { try { const d = document.documentElement, f = d.requestFullscreen || d.webkitRequestFullscreen; if (f && !document.fullscreenElement) { const r = f.call(d); if (r && r.catch) r.catch(() => {}); } } catch (e) {} }
  function setupTouch() {
    const tapBtn = (el, fn) => el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); fn(); });
    tapBtn($('bSell'), sell); tapBtn($('bMap'), () => { if (playing) toggleMap(); }); tapBtn($('mapClose'), () => { if (mapOpen) toggleMap(); });
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
    for (const ev of ['touchstart', 'touchmove', 'gesturestart']) document.addEventListener(ev, e => { if ((playing || mapOpen) && e.cancelable) e.preventDefault(); }, { passive: false });
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
      if (!confirm(L.resetAsk)) return;
      W.clearHoles(); Object.assign(pl, { dug: 0, money: 0, bucket: 0, bucketValue: 0, sold: 0 }); S.resetChunks(); S.updateDeco(pl.pos, true); S.setPile(0);
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
      if (pl.dig < 0 && mouseDown && (locked || rmb || TOUCH) && tipT <= 0) { pl.dig = 0; pl.didHit = false; S.setSpoonFull(false); }
      if (pl.dig >= 0) {
        const prev = pl.dig; pl.dig += dt / tool.time;
        if (prev < 0.45 && pl.dig >= 0.45 && !pl.didHit) { pl.didHit = true; const h = rayHit(tool.reach); if (h) doDig(h); }
        if (pl.dig >= 1) { pl.dig = mouseDown ? 0 : -1; pl.didHit = false; if (mouseDown) S.setSpoonFull(false); }
      }
      if (tipT > 0) { tipT = Math.max(0, tipT - dt); S.setTip(Math.sin((1 - tipT / 0.9) * Math.PI)); } else S.setTip(0);
      if ((digT += dt) > 0.08) { digT = 0; $('cross').classList.toggle('hit', !!rayHit(tool.reach)); }
      S.updateChunks(pl.pos, 5); S.updateFar(pl.pos); S.updateDeco(pl.pos, false, 3);
      if ((saveT += dt) > 5 && dirty) { saveT = 0; save(); }
      hud(dt);
    }
    S.setFrame(up);
    look.x *= 0.88; look.y *= 0.88;
    S.render(pl.pos.clone().addScaledVector(up, EYE), camQuat(), { dig: pl.dig, walk, look }, dt, t);
  }

  root.addEventListener('load', () => {
    $('clickHint').textContent = L.clickHint; $('leftLbl').textContent = L.left; $('bucketLbl').textContent = L.bucket;
    $('mapTitle').textContent = L.map; $('mapHint').textContent = TOUCH ? L.mapTouch : L.mapHint; $('mapOpen').textContent = L.open; $('mapLocked').textContent = L.locked;
    document.title = L.title;
    overlay('loading');
    // build the world after the loading screen has been painted
    setTimeout(() => {
      setup(); setupTouch();
      requestAnimationFrame(loop);
      addEventListener('beforeunload', () => { if (dirty) save(); });
      root.__game = { pl, W, S, digNow(pitch, yaw) { pl.pitch = pitch; if (yaw) turn(yaw, 0); const h = rayHit(TOOLS[pl.tool].reach); return h ? doDig(h) : false; }, sell, toggleMap, setTool,
        snap(pitch, adv) { if (pitch !== undefined) pl.pitch = pitch; S.render(pl.pos.clone().addScaledVector(up, EYE), camQuat(), { dig: -1, walk: 0, look }, adv || 0.016, t); return canvas.toDataURL('image/jpeg', 0.9); },
        mapSnap(steps) { for (let i = 0; i < (steps || 1); i++) MapV.render(0.1); return canvas.toDataURL('image/jpeg', 0.9); } };
    }, 30);
  });
})(window);
