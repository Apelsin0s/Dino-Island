// Graphics test scene: walk on a 1:1 Earth-sized planet in first person and dig with bare hands or a shovel.
'use strict';
(function (root) {
  const W = root.World, T = root.THREE, S = root.Scene;
  const v3 = (x, y, z) => new T.Vector3(x, y, z);
  const $ = id => document.getElementById(id);

  // ---------- language ----------
  const RU = /^(ru|uk|be|kk)/i.test(navigator.language || '');
  const L = RU ? {
    title: 'Endless Digging', sub: 'Тестовая сцена графики · Земля в масштабе 1:1', play: 'Играть', cont: 'Продолжить',
    loading: 'Строим планету…', hands: 'Руки', shovel: 'Лопата', height: 'Высота над морем', core: 'До ядра', dug: 'Выкопано', left: 'Осталось выкопать', m3: 'м³', m: 'м', km: 'км',
    keys: '<b>WASD</b> идти · <b>Shift</b> бег · <b>Пробел</b> прыжок · <b>ЛКМ</b> копать · <b>1</b> руки · <b>2</b> лопата · <b>Esc</b> пауза',
    pause: 'Пауза', quality: 'Графика', hi: 'Высокая', lo: 'Быстрая', reset: 'Засыпать все ямы', far: 'Слишком далеко', sign: '↓ ЯДРО 6 371 км',
    clickHint: 'Кликни, чтобы управлять мышью', N: 'с. ш.', S: 'ю. ш.', E: 'в. д.', Wd: 'з. д.', planet: 'Планета Земля · радиус 6 371 км · окружность 40 030 км'
  } : {
    title: 'Endless Digging', sub: 'Graphics test scene · Earth at 1:1 scale', play: 'Play', cont: 'Continue',
    loading: 'Building the planet…', hands: 'Hands', shovel: 'Shovel', height: 'Above sea level', core: 'To the core', dug: 'Dug out', left: 'Left to dig', m3: 'm³', m: 'm', km: 'km',
    keys: '<b>WASD</b> walk · <b>Shift</b> run · <b>Space</b> jump · <b>LMB</b> dig · <b>1</b> hands · <b>2</b> shovel · <b>Esc</b> pause',
    pause: 'Paused', quality: 'Graphics', hi: 'High', lo: 'Fast', reset: 'Fill in all holes', far: 'Too far', sign: '↓ CORE 6,371 km',
    clickHint: 'Click to control with the mouse', N: 'N', S: 'S', E: 'E', Wd: 'W', planet: 'Planet Earth · radius 6,371 km · circumference 40,030 km'
  };
  document.documentElement.lang = RU ? 'ru' : 'en';
  // phones and tablets: on-screen stick, drag to look, dig and jump buttons, lighter graphics
  const TOUCH = (root.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in root || /[?&]touch\b/.test(location.search);
  if (TOUCH) document.documentElement.classList.add('touch');
  Object.assign(L, RU ? { tkeys: '<b>Левый палец</b> — идти (дальше от центра — бег) · <b>правый</b> — смотреть · <b>⛏</b> копать · <b>⤒</b> прыжок · <b>Ⅱ</b> пауза', dig: 'Копать', jumpB: 'Прыжок', turn: 'Поверни телефон боком — так удобнее' }
    : { tkeys: '<b>Left thumb</b> walk (push further to run) · <b>right</b> look · <b>⛏</b> dig · <b>⤒</b> jump · <b>Ⅱ</b> pause', dig: 'Dig', jumpB: 'Jump', turn: 'Turn your phone sideways for a better view' });

  // ---------- tools ----------
  const TOOLS = {
    hands: { r: 0.24, time: 0.45, reach: 2.6, parts: 7 },
    shovel: { r: 0.42, time: 0.62, reach: 3.0, parts: 14 }
  };
  const EARTH_VOL = 4 / 3 * Math.PI * Math.pow(W.R, 3);

  // ---------- player ----------
  const pl = { pos: v3(0, 0, 0), vel: v3(0, 0, 0), fwd: v3(0, 0, -1), pitch: 0, grounded: false, tool: 'hands', dig: -1, digHit: null, dug: 0 };
  const RAD = 0.32, EYE = 1.62, G = 15, JUMP = 6.1, WALK = 4.3, RUN = 7.2;
  const SPHERES = [0.33, 0.9, 1.42];
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
    const e = 0.04;
    out.set(W.solid(x + e, y, z) - W.solid(x - e, y, z), W.solid(x, y + e, z) - W.solid(x, y - e, z), W.solid(x, y, z + e) - W.solid(x, y, z - e));
    const l = out.length() || 1; return out.multiplyScalar(-1 / l);   // points out of the ground
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
        const push = RAD - dist;
        const nu = nrm.dot(up);
        if (o === SPHERES[0] && nu > 0.5) {
          // stand on slopes: push straight up instead of sliding sideways
          pl.pos.addScaledVector(up, push / Math.max(0.6, nu)); ground = true;
          const vu = pl.vel.dot(up); if (vu < 0) pl.vel.addScaledVector(up, -vu);
        } else {
          pl.pos.addScaledVector(nrm, push);
          const vn = pl.vel.dot(nrm); if (vn < 0) pl.vel.addScaledVector(nrm, -vn);
        }
      }
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
    const vu = pl.vel.dot(up), vt = pl.vel.clone().addScaledVector(up, -vu);
    const acc = pl.grounded ? 14 : 3;
    vt.lerp(wish, Math.min(1, acc * dt));
    let nvu = vu - G * dt;
    if (pl.grounded && (k.Space) && !pl.jumpHeld) { nvu = JUMP; pl.grounded = false; pl.jumpHeld = true; Sound.jump(); }
    if (!k.Space) pl.jumpHeld = false;
    pl.vel.copy(vt).addScaledVector(up, nvu);
    // substeps so fast falls do not tunnel
    const n = Math.max(1, Math.ceil(pl.vel.length() * dt / 0.12));
    let g = false;
    for (let i = 0; i < n; i++) { pl.pos.addScaledVector(pl.vel, dt / n); frame(); if (collide()) g = true; }
    if (!pl.grounded && g && vu < -7) Sound.land(Math.min(1, -vu / 14));
    pl.grounded = g;
    // footsteps
    const speed = vt.length();
    if (pl.grounded && speed > 0.5) { pl.stepT = (pl.stepT || 0) + dt * speed; if (pl.stepT > (run ? 2.0 : 1.6)) { pl.stepT = 0; Sound.step(); } }
    return speed / RUN;
  }

  // ---------- digging ----------
  function rayHit(reach) {
    const eye = pl.pos.clone().addScaledVector(up, EYE), d = lookDir();
    let prev = 0;
    for (let t = 0.05; t <= reach; t += 0.04) {
      const p = eye.clone().addScaledVector(d, t);
      if (W.solid(p.x, p.y, p.z) > 0) {
        let a = prev, b = t;
        for (let i = 0; i < 6; i++) { const m = (a + b) / 2, q = eye.clone().addScaledVector(d, m); if (W.solid(q.x, q.y, q.z) > 0) b = m; else a = m; }
        return { p: eye.clone().addScaledVector(d, b), d, t: b };
      }
      prev = t;
    }
    return null;
  }
  function doDig(hit) {
    const tool = TOOLS[pl.tool];
    const c = hit.p.clone().addScaledVector(hit.d, tool.r * 0.45);
    // how much solid ground the hole removes (sampled), for the counter
    let solidN = 0; const NS = 40;
    for (let i = 0; i < NS; i++) {
      const a = v3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1); if (a.lengthSq() > 1) { i--; continue; }
      const q = c.clone().addScaledVector(a, tool.r); if (W.solid(q.x, q.y, q.z) > 0) solidN++;
    }
    const vol = solidN / NS * 4 / 3 * Math.PI * Math.pow(tool.r, 3);
    const depth = W.depthAt(hit.p.x, hit.p.y, hit.p.z);
    const n = grad(hit.p.x, hit.p.y, hit.p.z, v3(0, 0, 0));
    const color = S.groundColor(Math.max(0.6, depth), 0, 0);
    const hole = [c.x, c.y, c.z, tool.r];
    const keysTouched = W.addHole(c.x, c.y, c.z, tool.r);
    S.applyHole(hole, keysTouched);
    S.burst(hit.p.x, hit.p.y, hit.p.z, color, tool.parts, hit.d.clone().negate());
    Sound.dig(pl.tool, depth);
    pl.dug += vol;
    if (vol > 0.0005) floater('+' + vol.toFixed(3) + ' ' + L.m3);
    dirty = true;
  }

  // ---------- input ----------
  const keys = {}; let mouseDown = false, locked = false, playing = false, look = { x: 0, y: 0 }, rmb = false;
  addEventListener('keydown', e => {
    if (!playing) return;
    keys[e.code] = true;
    if (e.code === 'Digit1') setTool('hands');
    if (e.code === 'Digit2') setTool('shovel');
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouseDown = false; });
  const canvas = $('view');
  canvas.addEventListener('mousedown', e => {
    if (!playing) return;
    if (!locked && e.button === 0) { lock(); }
    if (e.button === 0) mouseDown = true;
    if (e.button === 2) rmb = true;
  });
  addEventListener('mouseup', e => { if (e.button === 0) mouseDown = false; if (e.button === 2) rmb = false; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('mousemove', e => {
    if (!playing || (!locked && !rmb)) return;
    const s = 0.0022;
    turn(e.movementX * s, e.movementY * s);
  });
  addEventListener('wheel', e => { if (playing) setTool(pl.tool === 'hands' ? 'shovel' : 'hands'); }, { passive: true });
  function turn(dx, dy) {
    frame();
    const c = Math.cos(dx), s = Math.sin(dx);
    pl.fwd.multiplyScalar(c).addScaledVector(right, s).normalize();
    pl.pitch = Math.max(-1.45, Math.min(1.45, pl.pitch - dy));
    look.x = Math.max(-0.03, Math.min(0.03, look.x - dx * 0.25)); look.y = Math.max(-0.03, Math.min(0.03, look.y + dy * 0.25));
  }
  function lock() { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {} }
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
    if (!locked && playing && !pausedByUs) pause(true);
    pausedByUs = false;
    $('clickHint').hidden = locked || !playing;
  });
  let pausedByUs = false;
  addEventListener('keydown', e => { if (e.code === 'Escape' && playing && !locked) pause(true); });

  function setTool(t) { pl.tool = t; S.setTool(t); for (const el of document.querySelectorAll('.slot')) el.classList.toggle('on', el.dataset.t === t); }

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
      dig(tool, depth) { if (!ac) return; const hard = depth > 13 ? 1 : 0; noise(0.22, 500 + hard * 900, 0.8, 0.35); tone(tool === 'shovel' ? 120 : 90, 0.16, 0.25, -40); if (tool === 'shovel') tone(1400 + hard * 600, 0.08, 0.03, 0, 'triangle'); noise(0.35, 2400, 0.6, 0.05, 'highpass', 0.05); },
      step() { if (!ac) return; noise(0.12, 380 + Math.random() * 120, 1.2, 0.1); noise(0.08, 2800, 0.7, 0.02, 'highpass'); },
      jump() { if (!ac) return; noise(0.1, 600, 1, 0.06); },
      land(k) { if (!ac) return; noise(0.2, 260, 1, 0.12 + 0.2 * k); tone(70, 0.15, 0.15 * k, -20); }
    };
  })();

  // ---------- HUD ----------
  function fmtInt(n) { return Math.round(n).toLocaleString(RU ? 'ru-RU' : 'en-US'); }
  function floater(text) { const el = document.createElement('div'); el.className = 'floater'; el.textContent = text; $('floaters').appendChild(el); setTimeout(() => el.remove(), 1200); }
  function hud() {
    const [lat, lon] = W.toLatLon(pl.pos.x, pl.pos.y, pl.pos.z);
    $('coords').textContent = Math.abs(lat).toFixed(5) + '° ' + (lat >= 0 ? L.N : L.S) + ', ' + Math.abs(lon).toFixed(5) + '° ' + (lon >= 0 ? L.E : L.Wd);
    const alt = pl.pos.length() - W.R;
    $('alt').textContent = L.height + ': ' + alt.toFixed(1) + ' ' + L.m;
    $('core').textContent = L.core + ': ' + fmtInt(pl.pos.length()) + ' ' + L.m;
    $('dug').textContent = L.dug + ': ' + pl.dug.toFixed(2) + ' ' + L.m3;
    $('left').textContent = fmtInt(EARTH_VOL - pl.dug) + ' ' + L.m3;
    const pct = pl.dug / EARTH_VOL * 100;
    $('pct').textContent = pct === 0 ? '0 %' : pct.toExponential(2).replace('e', ' × 10^') + ' %';
  }

  // ---------- save ----------
  const SAVE = 'endlessdigging.test.v1';
  let dirty = false, saveT = 0;
  function save() {
    try { localStorage.setItem(SAVE, JSON.stringify({ holes: W.holes.map(h => h.map(v => Math.round(v * 1000) / 1000)), pos: pl.pos.toArray(), fwd: pl.fwd.toArray(), pitch: pl.pitch, dug: pl.dug, tool: pl.tool })); } catch (e) {}
    dirty = false;
  }
  function load() {
    try { const s = JSON.parse(localStorage.getItem(SAVE) || 'null'); if (!s) return null; return s; } catch (e) { return null; }
  }

  // ---------- start ----------
  const SPAWN_LAT = 47.9137, SPAWN_LON = 11.4192;
  function spawnPoint() {
    const d = W.fromLatLon(SPAWN_LAT, SPAWN_LON), h = W.heightDir(d[0], d[1], d[2]);
    return v3(d[0], d[1], d[2]).multiplyScalar(W.R + h + 0.05);
  }
  function setup() {
    if (TOUCH) S.setMobile(true);
    S.init(canvas);
    S.signText = L.sign;
    const sp = spawnPoint(); S.spawnPoint = sp;
    const saved = load();
    if (saved) {
      for (const h of saved.holes || []) W.addHole(h[0], h[1], h[2], h[3]);
      pl.pos.fromArray(saved.pos); pl.fwd.fromArray(saved.fwd); pl.pitch = saved.pitch || 0; pl.dug = saved.dug || 0;
    } else {
      pl.pos.copy(sp);
      const u = sp.clone().normalize(), northPole = v3(0, 1, 0);
      pl.fwd.copy(northPole).addScaledVector(u, -northPole.dot(u)).normalize();   // look north
      pl.fwd.applyAxisAngle(u, -0.6); pl.pitch = -0.12;
    }
    frame();
    // sun: fixed over the start region, mid-morning from the south-east
    const u0 = sp.clone().normalize(), n0 = v3(0, 1, 0).addScaledVector(u0, -u0.y).normalize(), e0 = new T.Vector3().crossVectors(n0, u0).normalize();
    S.setSun(u0.clone().multiplyScalar(0.62).addScaledVector(e0, 0.55).addScaledVector(n0, -0.45));
    S.setOrigin(pl.pos);
    S.setFrame(up);
    S.addProps(sp, n0.clone().applyAxisAngle(u0, -0.6), new T.Vector3().crossVectors(n0.clone().applyAxisAngle(u0, -0.6), u0).normalize());
    setTool(saved && saved.tool || 'hands');
    S.updateFar(pl.pos, true); S.updateDeco(pl.pos, true); S.buildClouds(pl.pos);
    addEventListener('resize', () => S.resize());
  }

  // ---------- touch controls ----------
  const stick = { id: null, x: 0, y: 0, ox: 0, oy: 0 }, lookT = { id: null, x: 0, y: 0 };
  function fullscreen() { try { const d = document.documentElement, f = d.requestFullscreen || d.webkitRequestFullscreen; if (f && !document.fullscreenElement) { const r = f.call(d); if (r && r.catch) r.catch(() => {}); } } catch (e) {} }
  function setupTouch() {
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
        const s = 0.0055; turn((e.clientX - lookT.x) * s, (e.clientY - lookT.y) * s); lookT.x = e.clientX; lookT.y = e.clientY;
      }
    });
    const end = e => {
      if (e.pointerId === stick.id) { stick.id = null; stick.x = stick.y = 0; base.hidden = true; }
      if (e.pointerId === lookT.id) lookT.id = null;
    };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
    const hold = (el, on, off) => {
      el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); el.classList.add('down'); on(); try { el.setPointerCapture(e.pointerId); } catch (er) {} });
      const up = e => { el.classList.remove('down'); off(); };
      el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
    };
    hold($('bDig'), () => { mouseDown = true; }, () => { mouseDown = false; });
    hold($('bJump'), () => { keys.Space = true; }, () => { keys.Space = false; });
    $('bPause').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); pause(true); });
    for (const el of document.querySelectorAll('.slot')) el.addEventListener('pointerdown', e => { e.stopPropagation(); setTool(el.dataset.t); });
    // keep the page from scrolling, zooming or selecting while playing
    for (const ev of ['touchstart', 'touchmove', 'gesturestart']) document.addEventListener(ev, e => { if (playing && e.cancelable) e.preventDefault(); }, { passive: false });
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
          <div class="row"><span>${L.quality}</span><button id="qHi" class="${q === 'high' ? 'on' : ''}">${L.hi}</button><button id="qLo" class="${q === 'low' ? 'on' : ''}">${L.lo}</button></div>
          ${kind === 'pause' ? `<button id="bReset" class="ghost">${L.reset}</button>` : ''}
          <p class="keys">${TOUCH ? L.tkeys : L.keys}</p></div>`;
    if (kind === 'loading') return;
    $('bPlay').onclick = () => { Sound.unlock(); o.hidden = true; playing = true; $('hud').hidden = false; if (TOUCH) fullscreen(); else lock(); };
    $('qHi').onclick = () => { S.setQuality('high'); overlay(kind); };
    $('qLo').onclick = () => { S.setQuality('low'); overlay(kind); };
    const r = $('bReset'); if (r) r.onclick = () => { W.clearHoles(); pl.dug = 0; S.resetChunks(); S.updateDeco(pl.pos, true); pl.pos.copy(spawnPoint()); pl.vel.set(0, 0, 0); save(); overlay(kind); };
  }
  function pause(on) { if (on) { playing = false; mouseDown = false; for (const k in keys) keys[k] = false; stick.id = lookT.id = null; stick.x = stick.y = 0; const sb = $('stick'); if (sb) sb.hidden = true; overlay('pause'); if (dirty) save(); } }

  // ---------- loop ----------
  let last = performance.now(), t = 0, loading = true, digT = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    if (loading) {
      const left = S.updateChunks(pl.pos, 40), total = S.chunkCount() + left;
      const b = $('loadBar'); if (b) b.style.width = Math.round(S.chunkCount() / Math.max(1, total) * 100) + '%';
      if (left === 0) { loading = false; overlay('start'); }
      S.render(pl.pos.clone().addScaledVector(up, EYE), camQuat(), { dig: -1, walk: 0, look }, dt, t);
      return;
    }
    let walk = 0;
    if (playing) {
      walk = step(dt);
      // digging stroke
      const tool = TOOLS[pl.tool];
      if (pl.dig < 0 && mouseDown && (locked || rmb || TOUCH)) { pl.dig = 0; pl.didHit = false; }
      if (pl.dig >= 0) {
        const prev = pl.dig; pl.dig += dt / tool.time;
        if (prev < 0.45 && pl.dig >= 0.45 && !pl.didHit) { pl.didHit = true; const h = rayHit(tool.reach); if (h) doDig(h); }
        if (pl.dig >= 1) pl.dig = mouseDown ? 0 : -1, pl.didHit = false;
      }
      // crosshair shows whether there is ground in reach
      if ((digT += dt) > 0.08) { digT = 0; $('cross').classList.toggle('hit', !!rayHit(tool.reach)); }
      // stream terrain and scenery
      S.updateChunks(pl.pos, 6); S.updateFar(pl.pos); S.updateDeco(pl.pos);
      if ((saveT += dt) > 5 && dirty) { saveT = 0; save(); }
      hud();
    }
    S.setFrame(up);
    look.x *= 0.88; look.y *= 0.88;
    S.render(pl.pos.clone().addScaledVector(up, EYE), camQuat(), { dig: pl.dig, walk, look }, dt, t);
  }

  root.addEventListener('load', () => {
    $('slotHands').textContent = (TOUCH ? '✋ ' : '1 · ') + L.hands; $('slotShovel').textContent = (TOUCH ? '⛏ ' : '2 · ') + L.shovel;
    $('clickHint').textContent = L.clickHint; $('leftLbl').textContent = L.left;
    document.title = L.title;
    for (const el of document.querySelectorAll('.slot')) el.onclick = () => setTool(el.dataset.t);
    setup();
    setupTouch();
    overlay('loading');
    requestAnimationFrame(loop);
    addEventListener('beforeunload', () => { if (dirty) save(); });
    root.__game = { pl, W, S, digNow(pitch, yaw) { pl.pitch = pitch; if (yaw) turn(yaw, 0); const h = rayHit(TOOLS[pl.tool].reach); if (h) doDig(h); return !!h; }, setTool, snap(pitch, adv) { if (pitch !== undefined) pl.pitch = pitch; S.render(pl.pos.clone().addScaledVector(up, EYE), camQuat(), { dig: -1, walk: 0, look }, adv || 0.016, t); return canvas.toDataURL('image/jpeg', 0.9); } };
  });
})(window);
