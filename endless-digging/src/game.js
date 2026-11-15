// Endless Digging: walk on a 1:1 Earth in first person and dig; every stroke is paid at once, rarer ground pays more.
'use strict';
(function (root) {
  const W = root.World, T = root.THREE, S = root.Scene, MapV = root.MapView;
  const v3 = (x, y, z) => new T.Vector3(x, y, z);
  const $ = id => document.getElementById(id);

  // ---------- language ----------
  // ---------- language: English is the base, others override (src/lang/*.js); chosen in the menu, else from the system ----------
  const LANGS = root.Lang || {};
  const pickLang = () => {
    let saved = null; try { saved = localStorage.getItem('endlessdigging.lang'); } catch (e) {}
    if (saved && LANGS[saved]) return saved;
    for (const l of (navigator.languages || [navigator.language || 'en'])) { const k = String(l).toLowerCase(), base = k.split('-')[0];
      if (LANGS[k]) return k; if (k === 'zh-tw' || k === 'zh-hk') { if (LANGS['zh-TW']) return 'zh-TW'; } if (LANGS[base]) return base; if (base === 'zh' && LANGS['zh-CN']) return 'zh-CN'; if (base === 'pt' && LANGS['pt-BR']) return 'pt-BR'; }
    return 'en';
  };
  const LANG = pickLang();
  const deepMerge = (a, b) => { const o = Array.isArray(a) ? a.slice() : Object.assign({}, a); for (const k in b) o[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] ? deepMerge(a[k], b[k]) : b[k]; return o; };
  const L = deepMerge(LANGS.en || {}, LANG === 'en' ? {} : (LANGS[LANG] || {}));
  L.lang = LANG;
  document.documentElement.lang = LANG; if (L.rtl) document.documentElement.dir = 'rtl';
  const loc = L.locale || 'en-US';
  const nameOf = o => (o.n && (o.n[LANG] || o.n[LANG.split('-')[0]])) || o.en;   // a name in the player's language, English if missing
  const TOUCH = (root.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in root || /[?&]touch\b/.test(location.search);
  if (TOUCH) document.documentElement.classList.add('touch');

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
    { id: 'sharp', row: 0, col: 4, icon: 'sharp', p: 120, req: ['shovel'] },
    { id: 'longhandle', row: 0, col: 5, icon: 'longhandle', p: 200, req: ['sharp', 'boots1'] },
    { id: 'pick', row: 0, col: 6, icon: 'pick', soon: true, req: ['longhandle'] },
    { id: 'arms1', row: 1, col: 1, icon: 'arm', p: 8, req: ['scoop'] },
    { id: 'arms2', row: 1, col: 2, icon: 'arm2', p: 25, req: ['arms1'] },
    { id: 'arms3', row: 1, col: 3, icon: 'arm3', p: 70, req: ['arms2'] },
    { id: 'boots1', row: 1, col: 4, icon: 'boots', p: 35, req: ['arms2'] },
    { id: 'boots2', row: 1, col: 5, icon: 'boots2', p: 110, req: ['boots1'] },
    { id: 'arms4', row: 1, col: 6, icon: 'arm4', p: 220, req: ['arms3', 'boots2'] },
    { id: 'probe', row: 2, col: 1, icon: 'probe', p: 12, req: ['scoop'] },
    { id: 'detector', row: 2, col: 2, icon: 'detector', p: 40, req: ['probe'] },
    { id: 'detector2', row: 2, col: 3, icon: 'detector2', p: 90, req: ['detector', 'arms2'] },
    { id: 'probe2', row: 2, col: 4, icon: 'probe2', p: 60, req: ['detector2'] },
    { id: 'sorting', row: 2, col: 5, icon: 'sieve', p: 150, req: ['probe2'] },
    { id: 'radar', row: 2, col: 6, icon: 'radar', soon: true, req: ['sorting'] },
    { id: 'scales1', row: 3, col: 1, icon: 'scale', p: 20, req: ['scoop'] },
    { id: 'scales2', row: 3, col: 2, icon: 'scale2', p: 90, req: ['scales1'] },
    { id: 'orebuyer', row: 3, col: 3, icon: 'orebuyer', p: 140, req: ['scales2', 'probe'] },
    { id: 'scales3', row: 3, col: 4, icon: 'crates', p: 400, req: ['orebuyer'] },
    { id: 'bank', row: 3, col: 5, icon: 'bank', p: 600, req: ['scales3'] },
    { id: 'auto1', row: 4, col: 1, icon: 'rig', p: 30, req: ['trowel', 'scales1'] },
    { id: 'grease', row: 4, col: 2, icon: 'oilcan', p: 45, req: ['auto1'] },
    { id: 'auto2', row: 4, col: 3, icon: 'rig2', p: 90, req: ['auto1'] },
    { id: 'auger2', row: 4, col: 4, icon: 'auger', p: 160, req: ['auto2', 'grease'] },
    { id: 'auto3', row: 4, col: 5, icon: 'rig3', p: 250, req: ['auto2'] },
    { id: 'conveyor', row: 4, col: 6, icon: 'conveyor', p: 500, req: ['auto3', 'auger2'] },
    { id: 'exMini', row: 5, col: 1, icon: 'excavator', p: 1500, req: ['auto3'] },
    { id: 'truck', row: 5, col: 2, icon: 'truck', p: 4000, req: ['exMini'] },
    { id: 'exBig', row: 5, col: 3, icon: 'excavatorBig', p: 15000, req: ['truck', 'conveyor'] },
    { id: 'wheel', row: 5, col: 4, icon: 'wheel', p: 60000, req: ['exBig'] },
    { id: 'quarry', row: 5, col: 5, icon: 'quarry', soon: true, req: ['wheel'] },
    { id: 'bore', row: 6, col: 1, icon: 'borerig', p: 2500, req: ['auto3', 'detector2'] },
    { id: 'derrick', row: 6, col: 2, icon: 'derrick', p: 10000, req: ['bore'] },
    { id: 'shaft', row: 6, col: 3, icon: 'headframe', p: 40000, req: ['derrick', 'exBig'] },
    { id: 'superdeep', row: 6, col: 4, icon: 'superdeep', soon: true, req: ['shaft'] }
  ];
  const owned = new Set(NODES.filter(n => n.root).map(n => n.id));
  const has = id => owned.has(id);
  const lvl = id => id === 'tool' ? (has('shovel') ? 'shovel' : has('trowel') ? 'trowel' : has('scoop') ? 'scoop' : 'spoon')
    : id === 'speed' ? (has('arms4') ? 0.52 : has('arms3') ? 0.61 : has('arms2') ? 0.72 : has('arms1') ? 0.85 : 1)
    : id === 'scale' ? (has('scales3') ? 2 : has('scales2') ? 1.5 : has('scales1') ? 1.25 : 1) * (AD.incomeMul || 1)
    : id === 'ore' ? (has('sorting') ? 1.25 : 1) * (has('orebuyer') ? 1.5 : 1)
    : id === 'bite' ? (has('sharp') ? 0.62 : BITE)
    : id === 'reach' ? (has('longhandle') ? 0.7 : 0)
    : id === 'move' ? (has('boots2') ? 1.3 : has('boots1') ? 1.15 : 1)
    : id === 'probeD' ? (has('probe2') ? 8 : 4)
    : id === 'rigPeriod' ? (lvl('rigLevel') > 1 ? 1.5 : 3) * (has('grease') ? 0.7 : 1)
    : id === 'rigL' ? (has('auger2') ? 1.6 : 1)
    : id === 'rigPay' ? (has('conveyor') ? 1.5 : 1)
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
  const pl = { pos: v3(0, 0, 0), vel: v3(0, 0, 0), fwd: v3(0, 0, -1), pitch: 0, grounded: false, tool: 'spoon', dig: -1, dug: 0, money: 0, sold: 0, earned: [0, 0, 0, 0, 0], open: ['UKR'] };
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
    if (AD.fly) {   // admin: fly through everything; Space up, C down, Shift faster
      const d = lookDir(), wish = v3(0, 0, 0);
      let mx = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), mz = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0);
      if (stick.id !== null) { mx = stick.x; mz = -stick.y; }
      wish.addScaledVector(d, mz).addScaledVector(right, mx).addScaledVector(up, (k.Space ? 1 : 0) - (k.KeyC || k.ControlLeft ? 1 : 0));
      if (wish.lengthSq() > 1e-4) pl.pos.addScaledVector(wish.normalize(), 12 * AD.speed * (k.ShiftLeft || k.ShiftRight ? 4 : 1) * dt);
      pl.vel.set(0, 0, 0); pl.grounded = false; return 0;
    }
    let mx = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), mz = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), amt = 1;
    let run = k.ShiftLeft || k.ShiftRight;
    if (stick.id !== null) { mx = stick.x; mz = -stick.y; amt = Math.min(1, Math.hypot(mx, mz) * 1.25); run = amt >= 1 && Math.hypot(mx, mz) > 0.92; }
    const sp = (run ? RUN : WALK) * lvl('move') * AD.speed;
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
    // the scoop goes where you aim: dig into a fresh spot for a full bite, into an old hole for less (until you dig past it)
    const R = tool.r * (has('sharp') ? 1.08 : 1) * AD.digMul, c = hit.p.clone().addScaledVector(hit.d, R * 0.45);
    if (W.blocked(c.x, c.y, c.z, R + 0.05)) { notice(L.noDig); Sound.thud(); return false; }
    const per = [0, 0, 0, 0, 0], f = bite(c, R, per), solidN = per.reduce((a, b) => a + b, 0);
    const litres = f * 4 / 3 * Math.PI * Math.pow(R, 3) * 1000, k = solidN ? litres / solidN : 0;
    const depth = W.depthAt(hit.p.x, hit.p.y, hit.p.z);
    let main = 0; for (let i = 1; i < 5; i++) if (per[i] > per[main]) main = i;
    S.applyHole([c.x, c.y, c.z, R], W.addHole(c.x, c.y, c.z, R));
    S.burst(hit.p.x, hit.p.y, hit.p.z, S.matColor(main), tool.parts, hit.d.clone().negate(), tool.size);
    S.setSpoonFull(true);
    Sound.dig(pl.tool, depth);
    // paid on the spot
    let got = 0; for (let i = 0; i < 5; i++) { got += per[i] * k * MATS[i].p * (MATS[i].ore ? lvl('ore') : 1); pl.earned[i] += per[i] * k; }
    got *= lvl('scale'); pl.money += got; pl.dug += litres / 1000; pl.sold += litres;
    const oreL = (per[3] + per[4]) * k;
    if (oreL > 0.001) { floater('+$' + fmtMoney(got) + ' · ' + oreL.toFixed(2) + ' ' + L.l + ' ' + L.mat[per[4] > per[3] ? 4 : 3], 'ore'); if (!pl.foundOre) { pl.foundOre = true; notice(L.firstOre); } }
    else if (litres > 0.001) floater('+$' + fmtMoney(got) + ' · ' + litres.toFixed(2) + ' ' + L.l);
    S.setPile(Math.min(1, pl.sold / 400));
    dirty = true; return true;
  }

  // ---------- heavy machinery ----------
  // auto: an excavator nobody drives digs its own pit in front of it; virtual: machines that work underground (paid per second)
  const HEAVY = {
    exMini: { drive: true, r: 0.35, period: 2.6, pit: 3.6, spread: 1.6, speed: 4, turn: 0.9, reach: 5.2, stroke: 1.2, cam: 7 },
    exBig: { drive: true, r: 0.7, period: 3.2, pit: 9, spread: 3.5, speed: 2.6, turn: 0.5, reach: 13, stroke: 1.8, cam: 17 },
    truck: {}, wheel: { lps: 400, depth: 6 }, bore: { lps: 15, depth: 40 }, derrick: { lps: 60, depth: 200 }, shaft: { lps: 200, depth: 400, ore: true }
  };
  const HEAVY_IDS = ['exMini', 'truck', 'exBig', 'wheel', 'bore', 'derrick', 'shaft'];
  let drive = null, heavyT = {}, heavyPay = 0, heavyPayT = 0;
  const fwdOf = (pos, yaw) => { const u = pos.clone().normalize(), q = S.frameAt(pos, yaw); return v3(1, 0, 0).applyQuaternion(q).addScaledVector(u, 0); };
  // take a bite of ground with a sphere; pays for it; returns litres
  function takeBite(c, R, show) {
    const per = [0, 0, 0, 0, 0], f = bite(c, R, per), solidN = per.reduce((a, b) => a + b, 0);
    if (f <= 0.001) return 0;
    const litres = f * 4 / 3 * Math.PI * R * R * R * 1000, k = litres / solidN;
    let main = 0; for (let i = 1; i < 5; i++) if (per[i] > per[main]) main = i;
    S.applyHole([c.x, c.y, c.z, R], W.addHole(c.x, c.y, c.z, R));
    S.burst(c.x, c.y, c.z, S.matColor(main), show ? 12 : 6, null, R * 4);
    let got = 0; for (let i = 0; i < 5; i++) { got += per[i] * k * MATS[i].p * (MATS[i].ore ? lvl('ore') : 1); pl.earned[i] += per[i] * k; }
    got *= lvl('scale'); pl.dug += litres / 1000; pl.sold += litres; dirty = true;
    return { litres, got, main, oreL: (per[3] + per[4]) * k };
  }
  function updateHeavy(dt) {
    for (const id of HEAVY_IDS) {
      if (!has(id)) continue;
      const H = HEAVY[id], M = S.heavy(id); if (!M) continue;
      if (H.lps) {   // underground work: pay per second for what lies at its depth
        const u = M.pos.clone().normalize(), q = M.pos.clone().addScaledVector(u, -H.depth), m = H.ore ? 3 : W.materialAt(q.x, q.y, q.z);
        let price = MATS[m].p * (MATS[m].ore ? lvl('ore') : 1); if (H.ore) price = (MATS[3].p * 0.6 + MATS[4].p * 0.4) * lvl('ore');
        const got = H.lps * dt * price * lvl('scale'); pl.money += got; heavyPay += got; pl.dug += H.lps * dt / 1000; continue;
      }
      if (!H.drive || (drive && drive.id === id)) continue;
      if ((heavyT[id] = (heavyT[id] || 0) + dt) < H.period) continue;
      heavyT[id] = 0;
      const f = fwdOf(M.pos, M.yaw), u = M.pos.clone().normalize();
      const p = M.pos.clone().addScaledVector(f, H.pit * (0.8 + Math.random() * 0.4)).addScaledVector(new T.Vector3().crossVectors(f, u), (Math.random() - 0.5) * H.spread * 2);
      const g = S.groundBelow(p, 6), c = g.addScaledVector(u, -H.r * 0.35);
      if (W.blocked(c.x, c.y, c.z, H.r * 0.5)) continue;
      S.heavyDig(id);
      const res = takeBite(c, H.r, false); if (res) { const k = has('truck') ? 2 : 1; pl.money += res.got * k; heavyPay += res.got * k; }
    }
    if ((heavyPayT += dt) > 8) { if (heavyPay > 0.01) floater('+$' + fmtMoney(heavyPay) + ' · ' + L.machines, 'ore'); heavyPay = 0; heavyPayT = 0; }
  }
  function nearDrivable() {
    for (const id of ['exMini', 'exBig']) { const M = has(id) && S.heavy(id); if (M && M.pos.distanceTo(pl.pos) < 4 + 3 * M.scale) return id; }
    return null;
  }
  function toggleDrive() {
    if (drive) {   // get out beside the machine
      const M = drive.M; M.auto = true; if (M.block) M.block[3] = drive.blockR;
      const u = M.pos.clone().normalize(), side = new T.Vector3().crossVectors(fwdOf(M.pos, M.yaw), u).normalize();
      pl.pos.copy(S.groundBelow(M.pos.clone().addScaledVector(side, 2.6 * M.scale), 4)).addScaledVector(u, 0.05); pl.vel.set(0, 0, 0);
      drive = null; S.setDriving(false); pl.machines = machinePoses(); dirty = true; return;
    }
    const id = nearDrivable(); if (!id) return;
    const M = S.heavy(id); M.auto = false;
    drive = { id, M, H: HEAVY[id], camYaw: M.yaw, camPitch: -0.45, dig: -1, blockR: M.block ? M.block[3] : 0 };
    if (M.block) M.block[3] = 0;   // its own footprint must not stop its own bucket
    S.setDriving(true); notice(L.driveHint);
  }
  function machinePoses() { const o = {}; for (const id of HEAVY_IDS) { const M = S.heavy(id); if (M && HEAVY[id].drive) o[id] = { pos: M.pos.toArray(), yaw: M.yaw }; } return o; }
  // the driving camera: behind and above the machine, turned with the mouse
  function driveCam() {
    const M = drive.M, u = M.pos.clone().normalize(), f = fwdOf(M.pos, drive.camYaw), dir = f.clone().multiplyScalar(Math.cos(drive.camPitch)).addScaledVector(u, Math.sin(drive.camPitch)).normalize();
    const pivot = M.pos.clone().addScaledVector(u, 2.4 * M.scale), eye = pivot.clone().addScaledVector(dir, -drive.H.cam);
    const rt = new T.Vector3().crossVectors(dir, u).normalize(), upc = new T.Vector3().crossVectors(rt, dir);
    return { eye, dir, q: new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(rt, upc, dir.clone().negate())) };
  }
  function driveAim(cam) {   // where the bucket would dig: along the view, within the arm's reach of the machine
    const M = drive.M, H = drive.H, u = M.pos.clone().normalize();
    for (let t = H.cam * 0.6; t < H.cam + H.reach * 1.6; t += 0.15) {
      const p = cam.eye.clone().addScaledVector(cam.dir, t);
      if (W.solid(p.x, p.y, p.z) > 0) {
        const d = p.clone().sub(M.pos), along = d.dot(u), hd = d.addScaledVector(u, -along).length();
        return { p, ok: hd < H.reach * M.scale / (M.scale) && hd > 1.4 * M.scale && along > -H.reach };
      }
    }
    return null;
  }
  function driveStep(dt) {
    const M = drive.M, H = drive.H, k = keys, u = M.pos.clone().normalize();
    let mz = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), mx = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
    if (stick.id !== null) { mz = -stick.y; mx = stick.x; }
    M.yaw -= mx * H.turn * dt * (mz < 0 ? -1 : 1); drive.camYaw -= mx * H.turn * dt * (mz < 0 ? -1 : 1);
    if (Math.abs(mz) > 0.05) {
      const np = M.pos.clone().addScaledVector(fwdOf(M.pos, M.yaw), mz * H.speed * dt), g = S.groundBelow(np, 2.5);
      let hitB = false; for (const b of W.blockers) { if (b === M.block) continue; if (Math.hypot(g.x - b[0], g.y - b[1], g.z - b[2]) < b[4] + 1.6 * M.scale) { hitB = true; break; } }
      if (!hitB && W.obstacleAt(g.x, g.y, g.z, 1.2 * M.scale)) hitB = true;
      if (!hitB && Math.abs(g.clone().sub(M.pos).dot(u)) < 1.2 * M.scale) { S.moveHeavy(drive.id, g, M.yaw); pl.machines = machinePoses(); }
    }
    pl.pos.copy(M.pos);
    // the bucket
    const cam = driveCam(), aim = driveAim(cam);
    if (aim) { const lp = M.g.worldToLocal(aim.p.clone().sub(S.origin)); M.upperYaw = Math.atan2(-lp.z, lp.x); }
    $('cross').classList.toggle('hit', !!(aim && aim.ok));
    if (drive.dig < 0 && mouseDown && (locked || rmb || TOUCH)) { drive.dig = 0; drive.hit = false; S.heavyDig(drive.id, 1); }
    if (drive.dig >= 0) {
      const prev = drive.dig; drive.dig += dt / (H.stroke * lvl('speed'));
      if (prev < 0.5 && drive.dig >= 0.5 && !drive.hit) {
        drive.hit = true;
        if (aim && aim.ok) {
          const c = aim.p.clone().addScaledVector(cam.dir, H.r * 0.35);
          if (W.blocked(c.x, c.y, c.z, H.r * 0.4)) notice(L.noDig);
          else { const res = takeBite(c, H.r, true); if (res) { pl.money += res.got; floater('+$' + fmtMoney(res.got) + ' · ' + res.litres.toFixed(0) + ' ' + L.l + (res.oreL > 1 ? ' · ' + L.mat[3] : ''), res.oreL > 1 ? 'ore' : ''); Sound.dig('shovel', 0); S.setPile(Math.min(1, pl.sold / 400)); } }
        } else notice(L.outReach);
      }
      if (drive.dig >= 1) { drive.dig = mouseDown ? 0 : -1; if (mouseDown) S.heavyDig(drive.id, 1); }
    }
    return cam;
  }

  // ---------- shop (at the shack) ----------
  let shopOpen = false;
  function applyUpgrades() {
    pl.tool = lvl('tool'); S.setTool(pl.tool);
    for (let i = 0; i < lvl('rigs'); i++) S.addMachine(i, lvl('rigLevel'));
    for (const id of HEAVY_IDS) if (has(id)) S.addHeavy(id, pl.machines && pl.machines[id]);
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
      probe: [E.see, '—', E.probe], probe2: [E.probeDepth, '4 ' + L.m, '8 ' + L.m],
      sharp: [E.perStroke, sc(lvl('tool')), (Math.round(4 / 3 * Math.PI * Math.pow(t[lvl('tool')].r * 1.08, 3) * 1000 * BITE * 100) / 100) + ' ' + L.l], longhandle: [E.reach, (t[lvl('tool')].reach).toFixed(1) + ' ' + L.m, (t[lvl('tool')].reach + 0.7).toFixed(1) + ' ' + L.m],
      boots1: [E.move, '100 %', '115 %'], boots2: [E.move, '115 %', '130 %'], arms4: [E.stroke, '61 %', '52 %'],
      sorting: [E.orePrice, '×' + (has('orebuyer') ? 1.5 : 1), '×' + (has('orebuyer') ? 1.875 : 1.25)], orebuyer: [E.orePrice, '×' + (has('sorting') ? 1.25 : 1), '×' + (has('sorting') ? 1.875 : 1.5)],
      scales3: [E.price, '×1.5', '×2'], bank: [E.bank, '—', E.bankV],
      grease: [E.rigSpeed, '100 %', '143 %'], exMini: [E.drive, '—', E.bucket + ' 0.35 ' + L.m], exBig: [E.drive, '—', E.bucket + ' 0.7 ' + L.m], truck: [E.exIncome, '×1', '×2'],
      wheel: [E.perSec, '—', '400 ' + L.l], bore: [E.perSec, '—', '15 ' + L.l + ', 40 ' + L.m], derrick: [E.perSec, '—', '60 ' + L.l + ', 200 ' + L.m], shaft: [E.perSec, '—', '200 ' + L.l + ' ' + L.mat[3]], auger2: [E.rigTurn, '1 ' + L.l, '1.6 ' + L.l], conveyor: [E.rigIncome, '×1', '×1.5'], detector: [E.scanR, '—', '8 ' + L.m + ' / 4 ' + L.m], detector2: [E.scanR, '8 ' + L.m + ' / 4 ' + L.m, '15 ' + L.m + ' / 8 ' + L.m] }[id];
    return m ? `<div class="eff"><span>${m[0]}</span><b>${m[1]}</b><i>→</i><b class="new">${m[2]}</b></div>` : '';
  }
  function treeHTML() {
    const CW = 104, RH = 96, X = c => 112 + c * CW, Y = r => 46 + r * RH, W2 = X(7) + 70, H2 = Y(6) + 70;
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
    const n = lvl('rigs'), period = lvl('rigPeriod'), RL = RIG_L * lvl('rigL');
    for (let i = 0; i < n; i++) {
      const rg = rigs[i] || (rigs[i] = { t: 0.7 * i });
      if ((rg.t += dt) < period) continue;
      rg.t = 0;
      for (let tries = 0; tries < 3; tries++) {
        const p = S.machineSpot(i, (Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.25); if (!p) break;
        const u = p.clone().normalize(), q = p.clone().addScaledVector(u, 0.8);
        for (let k = 0; k < 400 && W.solid(q.x, q.y, q.z) <= 0; k++) q.addScaledVector(u, -0.02);   // down to the bottom of its pit
        if (W.blocked(q.x, q.y, q.z, -0.05)) continue;
        const c = q.clone().addScaledVector(u, -0.04), r = has('auger2') ? 0.095 : 0.08;
        S.applyHole([c.x, c.y, c.z, r], W.addHole(c.x, c.y, c.z, r));
        S.burst(q.x, q.y, q.z, S.matColor(W.materialAt(c.x, c.y, c.z)), 3, null, 0.35);
        const m = W.materialAt(c.x, c.y, c.z), got = RL * MATS[m].p * (MATS[m].ore ? lvl('ore') : 1) * lvl('scale') * lvl('rigPay');
        pl.money += got; pl.dug += RL / 1000; pl.earned[m] += RL; pl.rigEarned = (pl.rigEarned || 0) + got; dirty = true;
        S.machineHit(i, W.depthAt(c.x, c.y, c.z)); break;
      }
    }
  }

  // ---------- input ----------
  const keys = {}; let mouseDown = false, locked = false, playing = false, look = { x: 0, y: 0 }, rmb = false, mapOpen = false;
  addEventListener('keydown', e => {
    if (e.code === 'KeyM' && (playing || mapOpen) && !e.repeat) { toggleMap(); e.preventDefault(); return; }
    if (mapOpen) { if (e.code === 'Escape') toggleMap(); return; }
    if (AD.open) { if (e.code === 'Escape' || e.code === 'Backquote') toggleAdmin(false); return; }
    if (e.code === 'Backquote' && !e.repeat && !loading) { toggleAdmin(true); e.preventDefault(); return; }
    if (shopOpen) { if (e.code === 'Escape' || e.code === 'KeyF') toggleShop(false); return; }
    if (!playing) return;
    keys[e.code] = true;
    if (e.code === 'KeyF' && !e.repeat) toggleShop(true);
    if (e.code === 'KeyE' && !e.repeat) scan();
    if (e.code === 'KeyR' && !e.repeat) toggleDrive();
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
    if (drive) { drive.camYaw -= dx; drive.camPitch = Math.max(-1.2, Math.min(0.35, drive.camPitch - dy)); return; }
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
    if (!locked && playing && !pausedByUs && !mapOpen && !shopOpen && !AD.open) pause(true);
    pausedByUs = false;
    $('clickHint').hidden = locked || !playing || TOUCH;
  });
  addEventListener('keydown', e => { if (e.code === 'Escape' && playing && !locked && !mapOpen && !AD.open) pause(true); });
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
  function fmtInt(n) { return Math.round(n).toLocaleString(loc); }
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
    const near = !drive && nearDrivable(); $('bDrive').hidden = !(near || drive);
    if (!$('bDrive').hidden) $('bDrive').innerHTML = (TOUCH ? '' : '<b>R</b> ') + (drive ? L.getOut : L.getIn + ': ' + L.node[near][0]);
    $('bScan').hidden = !has('detector'); if (has('detector')) { $('bScan').innerHTML = (TOUCH ? '' : '<b>E</b> ') + L.scanB; $('bScan').classList.toggle('cool', scanCool > 0); }
    if (noticeT > 0 && (noticeT -= dt) <= 0) $('notice').hidden = true;
    geology(dt);
  }

  // ---------- geology: the probe reads the column under the crosshair, the detector looks for ore around ----------
  let geoT = 0, scanInfo = null, scanCool = 0;
  // the metal detector: press E (or the button) for one sweep; ore pockets in range get marks on the ground with their depth
  const scanRange = () => scanBig ? { r: 40, d: 30 } : has('detector2') ? { r: 15, d: 8 } : { r: 8, d: 4 };
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
    const el = $('geo'); if (!has('probe') || drive) { el.hidden = true; return; }
    if ((geoT -= dt) > 0) return; geoT = 0.25;
    let txt = '';
    const h = rayHit(TOOLS[pl.tool].reach + 1.5);
    if (h && !h.obstacle) {
      const u = h.p.clone().normalize(), parts = []; let cur = -1, from = 0;
      const PD = lvl('probeD');
      for (let d = 0; d <= PD + 0.001; d += 0.1) {
        const q = h.p.clone().addScaledVector(u, -d), m = W.solid(q.x, q.y, q.z) > 0 ? W.materialAt(q.x, q.y, q.z) : -1;
        if (m < 0) continue;   // the air of an earlier hole: skip it, layers either side join up
        if (m !== cur) { if (cur >= 0) parts.push([cur, from, d]); cur = m; from = d; }
      }
      if (cur >= 0) parts.push([cur, from, PD]);
      txt = `<b>${L.probeL}</b> ` + parts.slice(0, 4).map(([m, a, b]) => `<span class="m${m}">${L.mat[m]}</span> ${a.toFixed(1)}–${b.toFixed(1)} ${L.m}`).join(' · ');
    }
    if (has('detector') && scanInfo && t < scanInfo.until) txt += (txt ? '<br>' : '') + scanInfo.text;
    el.innerHTML = txt; el.hidden = !txt;
  }

  // ---------- admin panel (for testing): ` (Ё) or the button in the pause menu, then the code ----------
  // The code is checked by its hash only, so it is not written out here. This is a test tool, not real security:
  // anyone who reads the page source can find their way around it.
  const ADMIN_HASH = 0x0e69bf0f;   // FNV-1a of the code
  const fnv = s => { let h = 0x811c9dc5; for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h; };
  const AD = { open: false, tab: 'money', fly: false, speed: 1, digMul: 1, reach: 0, stats: false, hideHud: false, filter: '' };
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  Object.assign(AD, lsGet('endlessdigging.admincfg', {}), { open: false });
  let adminOK = lsGet('endlessdigging.admin', false);
  const adminSave = () => lsSet('endlessdigging.admincfg', { tab: AD.tab, fly: AD.fly, speed: AD.speed, digMul: AD.digMul, reach: AD.reach, stats: AD.stats, hideHud: AD.hideHud });
  function toggleAdmin(on) {
    if (on === undefined) on = !AD.open;
    if (on === AD.open) return;
    const el = $('admin');
    if (on) {
      if (loading) return;
      AD.open = true; AD.wasPlaying = playing; playing = false; mouseDown = false; for (const k in keys) keys[k] = false;
      if (locked) { pausedByUs = true; document.exitPointerLock(); }
      $('overlay').hidden = true; renderAdmin(); el.hidden = false;
    } else {
      AD.open = false; el.hidden = true; playing = true; $('hud').hidden = false; if (!TOUCH) lock();
    }
  }
  const A_ = L.adm;
  function adminTabs() {
    return ['money', 'research', 'countries', 'player', 'world', 'machines', 'save'].map(k => `<button class="atab${AD.tab === k ? ' on' : ''}" data-tab="${k}">${A_.tabs[k]}</button>`).join('');
  }
  function btn(act, text, cls) { return `<button class="abtn${cls ? ' ' + cls : ''}" data-act="${act}">${text}</button>`; }
  function chip(act, on, text) { return `<button class="achip${on ? ' on' : ''}" data-act="${act}">${text}</button>`; }
  function adminBody() {
    const C = root.Countries || [], open = new Set(pl.open);
    switch (AD.tab) {
      case 'money': return `<div class="arow big">$${pl.money.toLocaleString(loc, { maximumFractionDigits: 2 })}</div>
        <div class="arow">${btn('m:1e6', '+ $1 000 000', 'main')}${btn('m:1e3', '+ $1 000')}${btn('m:1e9', '+ $1 000 000 000')}${btn('m:x2', '× 2')}${btn('m:0', A_.zero, 'warn')}</div>
        <div class="arow"><label>${A_.setTo} $<input id="aMoney" type="number" min="0" step="1" value="${Math.round(pl.money)}"></label>${btn('m:set', A_.apply)}</div>
        <div class="arow">${chip('m:mul', AD.incomeMul > 1, A_.incomeX10)}</div>`;
      case 'research': return `<div class="arow">${btn('r:all', A_.unlockAll, 'main')}${btn('r:none', A_.resetAll, 'warn')}</div>
        <div class="agrid">${NODES.filter(n => !n.root).map(n => `<label class="acheck${n.soon ? ' dim' : ''}"><input type="checkbox" data-node="${n.id}"${has(n.id) ? ' checked' : ''}${n.soon ? ' disabled' : ''}>${L.node[n.id][0]}${n.soon ? ' · ' + L.soon : ''}</label>`).join('')}</div>`;
      case 'countries': {
        const f = AD.filter.trim().toLowerCase(), list = C.filter(c => !f || nameOf(c).toLowerCase().includes(f) || c.en.toLowerCase().includes(f));
        return `<div class="arow">${btn('c:all', A_.openAll, 'main')}${btn('c:ukr', A_.onlyUkr)}${btn('c:none', A_.closeAll, 'warn')}<span class="acount">${A_.opened}: ${open.size} / ${C.length}</span></div>
          <div class="arow"><input id="aFilter" type="search" placeholder="${A_.search}" value="${AD.filter.replace(/"/g, '&quot;')}"></div>
          <div class="alist">${list.map(c => `<div class="aitem"><label class="acheck"><input type="checkbox" data-country="${c.id}"${open.has(c.id) ? ' checked' : ''}>${nameOf(c)}</label><button class="abtn small" data-act="tp:${c.id}">${A_.teleport}</button></div>`).join('')}</div>`;
      }
      case 'player': return `<div class="arow">${chip('p:fly', AD.fly, A_.fly)}<span class="ahint">${A_.flyHint}</span></div>
        <div class="arow"><span class="alab">${A_.speed}</span>${[1, 3, 10, 30].map(v => chip('p:speed:' + v, AD.speed === v, '×' + v)).join('')}</div>
        <div class="arow"><span class="alab">${A_.digSize}</span>${[1, 2, 5, 10].map(v => chip('p:dig:' + v, AD.digMul === v, '×' + v)).join('')}</div>
        <div class="arow"><span class="alab">${A_.reach}</span>${[0, 5, 20].map(v => chip('p:reach:' + v, AD.reach === v, '+' + v + ' ' + L.m)).join('')}</div>
        <div class="arow">${btn('p:home', A_.toStart, 'main')}<label>${A_.lat} <input id="aLat" type="number" step="0.0001" value="${W.toLatLon(pl.pos.x, pl.pos.y, pl.pos.z)[0].toFixed(4)}"></label><label>${A_.lon} <input id="aLon" type="number" step="0.0001" value="${W.toLatLon(pl.pos.x, pl.pos.y, pl.pos.z)[1].toFixed(4)}"></label>${btn('p:go', A_.teleport)}</div>`;
      case 'world': return `<div class="arow">${btn('w:fill', A_.fillHoles, 'warn')}${btn('w:scan', A_.bigScan, 'main')}</div>
        <div class="arow">${chip('w:stats', AD.stats, A_.stats)}${chip('w:hud', AD.hideHud, A_.hideHud)}</div>
        <div class="arow"><span class="alab">${L.quality}</span>${chip('w:q:high', S.getQuality() === 'high', L.hi)}${chip('w:q:mid', S.getQuality() === 'mid', L.mid)}${chip('w:q:low', S.getQuality() === 'low', L.lo)}</div>`;
      case 'machines': return `<div class="arow">${btn('h:all', A_.allMachines, 'main')}${btn('h:everything', A_.everything)}</div>
        <div class="arow">${['exMini', 'exBig'].map(id => btn('h:here:' + id, A_.bringHere + ': ' + L.node[id][0])).join('')}</div>
`;
      case 'save': return `<div class="arow">${btn('s:export', A_.export, 'main')}${btn('s:import', A_.import)}${btn('s:wipe', A_.wipe, 'warn')}</div>
        <textarea id="aSave" spellcheck="false" placeholder="${A_.savePh}"></textarea><div class="ahint">${A_.saveHint}</div>`;
    }
    return '';
  }
  function renderAdmin() {
    const el = $('admin');
    if (!adminOK) {
      el.innerHTML = `<div class="adminCard login"><div class="aHead"><h2>${A_.title}</h2><button class="aClose" data-act="close" aria-label="${L.close}">✕</button></div>
        <label>${A_.code}<input id="aCode" type="password" autocomplete="off"></label><div class="arow">${btn('login', A_.enter, 'main')}</div><div class="ahint" id="aMsg"></div></div>`;
    } else {
      el.innerHTML = `<div class="adminCard"><div class="aHead"><h2>${A_.title}</h2><div class="atabs">${adminTabs()}</div><button class="aClose" data-act="close" aria-label="${L.close}">✕</button></div><div class="aBody">${adminBody()}</div></div>`;
    }
    for (const b of el.querySelectorAll('[data-tab]')) b.onclick = () => { AD.tab = b.dataset.tab; adminSave(); renderAdmin(); };
    for (const b of el.querySelectorAll('[data-act]')) b.onclick = () => adminAct(b.dataset.act);
    for (const c of el.querySelectorAll('[data-node]')) c.onchange = () => { if (c.checked) owned.add(c.dataset.node); else owned.delete(c.dataset.node); applyUpgrades(); dirty = true; };
    for (const c of el.querySelectorAll('[data-country]')) c.onchange = () => { const s2 = new Set(pl.open); if (c.checked) s2.add(c.dataset.country); else s2.delete(c.dataset.country); setOpen([...s2]); renderAdmin(); };
    const fi = $('aFilter'); if (fi) { fi.oninput = () => { AD.filter = fi.value; const pos = fi.selectionStart; renderAdmin(); const f2 = $('aFilter'); f2.focus(); f2.setSelectionRange(pos, pos); }; }
    const code = $('aCode'); if (code) { code.focus(); code.onkeydown = e => { if (e.key === 'Enter') adminAct('login'); }; }
  }
  function setOpen(ids) { pl.open = ids; MapV.setOpen(ids); dirty = true; updateOpenLabel(); }
  function updateOpenLabel() {
    const C = root.Countries || [], names = C.filter(c => pl.open.includes(c.id)).map(nameOf);
    $('mapOpen').textContent = L.openPrefix + ': ' + (names.length <= 3 ? names.join(', ') || '—' : names.length + ' ' + L.countriesN);
  }
  function teleport(lat, lon) {
    if (drive) toggleDrive();
    const d = W.fromLatLon(lat, lon), h = W.heightDir(d[0], d[1], d[2]);
    const p = v3(d[0], d[1], d[2]).multiplyScalar(W.R + h + 0.2);
    pl.pos.copy(S.groundBelow(p, 3)).addScaledVector(p.clone().normalize(), 0.05); pl.vel.set(0, 0, 0); frame();
    S.rebase(pl.pos); S.shadeAt(pl.pos, pl.fwd); dirty = true;
  }
  function adminAct(a) {
    const [k, v, w] = a.split(':');
    if (a === 'close') return toggleAdmin(false);
    if (a === 'login') {
      if (fnv(($('aCode').value || '').trim().toLowerCase()) === ADMIN_HASH) { adminOK = true; lsSet('endlessdigging.admin', true); renderAdmin(); }
      else $('aMsg').textContent = A_.wrong;
      return;
    }
    if (k === 'm') {
      if (v === 'set') pl.money = Math.max(0, +$('aMoney').value || 0);
      else if (v === 'x2') pl.money *= 2; else if (v === '0') pl.money = 0; else if (v === 'mul') AD.incomeMul = AD.incomeMul > 1 ? 1 : 10;
      else pl.money += +v;
      dirty = true;
    }
    if (k === 'r') { owned.clear(); for (const n of NODES) if (n.root || (v === 'all' && !n.soon)) owned.add(n.id); applyUpgrades(); dirty = true; }
    if (k === 'c') { setOpen(v === 'all' ? (root.Countries || []).map(c => c.id) : v === 'ukr' ? ['UKR'] : []); }
    if (k === 'tp') { const c = (root.Countries || []).find(x => x.id === v); if (c) { teleport(c.c[1], c.c[0]); return toggleAdmin(false); } }
    if (k === 'p') {
      if (v === 'fly') AD.fly = !AD.fly;
      if (v === 'speed') AD.speed = +w; if (v === 'dig') AD.digMul = +w; if (v === 'reach') AD.reach = +w;
      if (v === 'home') { teleport(SPAWN_LAT, SPAWN_LON); return toggleAdmin(false); }
      if (v === 'go') { const la = +$('aLat').value, lo = +$('aLon').value; if (isFinite(la) && isFinite(lo) && Math.abs(la) <= 90) { teleport(la, lo); return toggleAdmin(false); } }
      adminSave();
    }
    if (k === 'w') {
      if (v === 'fill') { W.clearHoles(); S.resetChunks(); S.updateDeco(pl.pos, true); dirty = true; }
      if (v === 'scan') { const had = owned.has('detector2'), had1 = owned.has('detector'); owned.add('detector'); owned.add('detector2'); scanCool = 0; playing = true; scanBig = true; scan(); scanBig = false; playing = false; if (!had) owned.delete('detector2'); if (!had1) owned.delete('detector'); return toggleAdmin(false); }
      if (v === 'stats') { AD.stats = !AD.stats; $('stats').hidden = !AD.stats; }
      if (v === 'hud') { AD.hideHud = !AD.hideHud; document.body.classList.toggle('noHud', AD.hideHud); }
      if (v === 'q') S.setQuality(w);
      adminSave();
    }
    if (k === 'h') {
      if (v === 'all' || v === 'everything') { for (const n of NODES) if (!n.soon) owned.add(n.id); if (v === 'everything') { pl.money += 1e9; setOpen((root.Countries || []).map(c => c.id)); } applyUpgrades(); dirty = true; }
      if (v === 'here') { if (!has(w)) { owned.add(w); applyUpgrades(); } const M = S.heavy(w); if (M) { const f = pl.fwd.clone(), g = S.groundBelow(pl.pos.clone().addScaledVector(f, 6 * M.scale), 4); S.moveHeavy(w, g, M.yaw); pl.machines = machinePoses(); dirty = true; } }
    }
    if (k === 's') {
      const ta = $('aSave');
      if (v === 'export') { save(); ta.value = localStorage.getItem(SAVE) || ''; ta.select(); try { navigator.clipboard.writeText(ta.value).catch(() => {}); } catch (e) {} return; }
      if (v === 'import') { try { const s2 = JSON.parse(ta.value); if (!s2 || typeof s2 !== 'object') throw 0; localStorage.setItem(SAVE, JSON.stringify(s2)); location.reload(); } catch (e) { ta.value = A_.badSave; } return; }
      if (v === 'wipe') { if (!AD.wipeArmed) { AD.wipeArmed = true; notice(A_.wipeAgain); return; } wipeSave(); return; }
    }
    renderAdmin();
  }
  function wipeSave() { try { localStorage.removeItem(SAVE); localStorage.removeItem(OLD_SAVE); } catch (e) {} skipSave = true; location.reload(); }
  let scanBig = false, skipSave = false, statT = 0, statN = 0;
  function updateStats(dt) {
    if (!AD.stats) return;
    statN++; if ((statT += dt) < 0.5) return;
    const info = S.renderer().info;
    $('stats').textContent = `FPS ${Math.round(statN / statT)} · ${A_.drawCalls} ${info.render.calls} · ${A_.tris} ${(info.render.triangles / 1e6).toFixed(2)}M · ${A_.chunks} ${S.chunkCount()} · ${A_.holes} ${W.holes.length} · ${A_.fineBoxes} ${W.fineSet.size}`;
    statT = 0; statN = 0;
  }

  // ---------- save ----------
  const SAVE = 'endlessdigging.v3', OLD_SAVE = 'endlessdigging.v2';   // v3: real relief (v2 holes no longer fit; money is kept)
  let dirty = false, saveT = 0;
  let saveWarned = false;
  function save() {
    if (skipSave) return;
    const sp = holeBase(), hr = [];
    for (const h of W.holes) hr.push(Math.round((h[0] - sp.x) * 1000), Math.round((h[1] - sp.y) * 1000), Math.round((h[2] - sp.z) * 1000), Math.round(h[3] * 1000));
    try { localStorage.setItem(SAVE, JSON.stringify({ hr, pos: pl.pos.toArray(), fwd: pl.fwd.toArray(), pitch: pl.pitch, dug: pl.dug, money: pl.money, open: pl.open, sold: pl.sold, earned: pl.earned, machines: machinePoses(), owned: [...owned], foundOre: !!pl.foundOre })); }
    catch (e) { if (!saveWarned) { saveWarned = true; notice(L.saveFull); } }
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
  // holes are saved relative to the start at sea level (does not depend on the relief data)
  function holeBase() { const d = W.fromLatLon(SPAWN_LAT, SPAWN_LON); return v3(d[0], d[1], d[2]).multiplyScalar(W.R); }
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
      const hb = holeBase(); if (saved.hr) for (let i = 0; i + 3 < saved.hr.length; i += 4) W.addHole(hb.x + saved.hr[i] / 1000, hb.y + saved.hr[i + 1] / 1000, hb.z + saved.hr[i + 2] / 1000, saved.hr[i + 3] / 1000);
      if (saved.open) pl.open = saved.open;
      pl.pos.fromArray(saved.pos); pl.fwd.fromArray(saved.fwd); pl.pitch = saved.pitch || 0; pl.dug = saved.dug || 0;
      pl.machines = saved.machines || null;
      pl.money = saved.money || 0; pl.sold = saved.sold || 0; pl.foundOre = !!saved.foundOre; pl.earned = saved.earned || [0, 0, 0, 0, 0];
      // whatever was still in the old bucket is paid out now
      if (saved.mix) pl.money += saved.mix.reduce((a, l, i) => a + l * MATS[i].p, 0);
      const renamed = { help1: 'auto1', help2: 'auto2', help3: 'auto3', excavator: 'exMini' };   // helpers became rigs
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
    MapV.init(S.renderer(), $('mapUI'), L); MapV.setOpen(pl.open);
    $('stats').hidden = !AD.stats; document.body.classList.toggle('noHud', !!AD.hideHud);
    addEventListener('resize', () => S.resize());
  }

  // ---------- touch controls ----------
  const stick = { id: null, x: 0, y: 0, ox: 0, oy: 0 }, lookT = { id: null, x: 0, y: 0 };
  function fullscreen() { try { const d = document.documentElement, f = d.requestFullscreen || d.webkitRequestFullscreen; if (f && !document.fullscreenElement) { const r = f.call(d); if (r && r.catch) r.catch(() => {}); } } catch (e) {} }
  function setupTouch() {
    const tapBtn = (el, fn) => el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); fn(); });
    tapBtn($('bShop'), () => toggleShop(true)); tapBtn($('bScan'), scan); tapBtn($('bDrive'), toggleDrive); tapBtn($('bMap'), () => { if (playing) toggleMap(); }); tapBtn($('mapClose'), () => { if (mapOpen) toggleMap(); });
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
          <div class="row"><span>${L.langLabel}</span><select id="langSel">${Object.keys(LANGS).map(k => `<option value="${k}"${k === LANG ? ' selected' : ''}>${LANGS[k].langName || k}</option>`).join('')}</select></div>
          ${kind === 'pause' ? `<div class="row"><button id="bAdmin" class="ghost">${L.adm.title}</button><button id="bReset" class="ghost">${L.reset}</button></div>` : ''}
          <p class="keys">${TOUCH ? L.tkeys : L.keys}</p></div>`;
    if (kind === 'loading') return;
    $('bPlay').onclick = () => { Sound.unlock(); o.hidden = true; playing = true; $('hud').hidden = false; if (TOUCH) fullscreen(); else lock(); };
    $('qHi').onclick = () => { S.setQuality('high'); overlay(kind); };
    $('qMid').onclick = () => { S.setQuality('mid'); overlay(kind); };
    $('qLo').onclick = () => { S.setQuality('low'); overlay(kind); };
    const r = $('bReset'); if (r) r.onclick = () => {
      if (!r.dataset.armed) { r.dataset.armed = '1'; r.textContent = L.resetAsk; r.classList.add('warn'); return; }   // second press confirms
      wipeSave();   // a clean start: machines, rigs and holes all go
    };
    const ab = $('bAdmin'); if (ab) ab.onclick = () => toggleAdmin(true);
    $('langSel').onchange = e => { try { localStorage.setItem('endlessdigging.lang', e.target.value); } catch (er) {} if (dirty) save(); location.reload(); };
  }
  function pause(on) { if (on) { playing = false; mouseDown = false; for (const k in keys) keys[k] = false; stick.id = lookT.id = null; stick.x = stick.y = 0; const sb = $('stick'); if (sb) sb.hidden = true; overlay('pause'); if (dirty) save(); } }

  // ---------- loop ----------
  let last = performance.now(), t = 0, loading = true, digT = 0, compiled = null, driveCamNow = null;
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
      if (drive) driveCamNow = driveStep(dt); else walk = step(dt);
      const tool = TOOLS[pl.tool];
      if (!drive && pl.dig < 0 && mouseDown && (locked || rmb || TOUCH)) { pl.dig = 0; pl.didHit = false; S.setSpoonFull(false); }
      if (pl.dig >= 0) {
        const prev = pl.dig; pl.dig += dt / (tool.time * lvl('speed'));
        if (prev < 0.45 && pl.dig >= 0.45 && !pl.didHit) { pl.didHit = true; const h = rayHit(tool.reach + lvl('reach') + AD.reach); if (h) doDig(h); }
        if (pl.dig >= 1) { pl.dig = mouseDown ? 0 : -1; pl.didHit = false; if (mouseDown) S.setSpoonFull(false); }
      }
      if (!drive && (digT += dt) > 0.08) { digT = 0; const ch = rayHit(tool.reach + lvl('reach') + AD.reach); $('cross').classList.toggle('hit', !!ch && !ch.obstacle); }
      S.updateChunks(pl.pos, 5); S.updateFar(pl.pos); S.updateDeco(pl.pos, false, 3);
      if ((saveT += dt) > 5 && dirty) { saveT = 0; save(); }
      updateMachines(dt); updateHeavy(dt); updateStats(dt); if (scanCool > 0) scanCool -= dt;
      if (has('bank') && (pl.bankT = (pl.bankT || 0) + dt) >= 60) { pl.bankT = 0; const g2 = Math.min(10, pl.money * 0.01); pl.money += g2; floater('+$' + fmtMoney(g2) + ' · ' + L.interest); dirty = true; }
      hud(dt);
    }
    S.setFrame(up);
    look.x *= 0.88; look.y *= 0.88;
    if (drive) { const c = driveCamNow || driveCam(); S.render(c.eye, c.q, { dig: -1, walk: 0, look }, dt, t); }
    else S.render(pl.pos.clone().addScaledVector(up, EYE), camQuat(), { dig: pl.dig, walk, look }, dt, t);
  }

  root.addEventListener('load', () => {
    $('clickHint').textContent = L.clickHint; $('leftLbl').textContent = L.left;
    $('resTitle').textContent = L.resTitle;
    $('mapTitle').textContent = L.map; $('mapHint').textContent = TOUCH ? L.mapTouch : L.mapHint; updateOpenLabel(); $('mapLocked').textContent = L.locked;
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
      root.__game = { pl, W, S, owned, scan, toggleAdmin, adminAct, teleport, toggleDrive, get drive() { return drive; },
        driveTest() {   // test helper: drive forward 2 s, turn the camera to the ground ahead, dig three strokes
          for (let i = 0; i < 40; i++) { keys.KeyW = true; driveStep(0.05); } keys.KeyW = false;
          drive.camPitch = -0.6; const m0 = pl.money; let n = 0; mouseDown = true; locked = true;
          for (let i = 0; i < 80; i++) { driveStep(0.05); } mouseDown = false; locked = false;
          return 'moved, money +' + (pl.money - m0).toFixed(2) + ', holes ' + W.holes.length;
        },
        snapDrive(adv) { const c = driveCam(); S.render(c.eye, c.q, { dig: -1, walk: 0, look }, adv || 0.016, t); return canvas.toDataURL('image/jpeg', 0.9); }, applyUpgrades, toggleShop, renderShop, digNow(pitch, yaw) { pl.pitch = pitch; if (yaw) turn(yaw, 0); const h = rayHit(TOOLS[pl.tool].reach + lvl('reach') + AD.reach); return h ? doDig(h) : false; }, toggleMap, setTool,
        snap(pitch, adv) { if (pitch !== undefined) pl.pitch = pitch; S.render(pl.pos.clone().addScaledVector(up, EYE), camQuat(), { dig: -1, walk: 0, look }, adv || 0.016, t); return canvas.toDataURL('image/jpeg', 0.9); },
        mapSnap(steps) { for (let i = 0; i < (steps || 1); i++) MapV.render(0.1); return canvas.toDataURL('image/jpeg', 0.9); } };
    }, 30));
  });
})(window);
