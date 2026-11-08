// Pure game simulation, no DOM, no rendering.
// Split into a shared WORLD (pile, loot, upgrades, keys, the watcher) and PLAYERS (position, look, light).
// For co-op the host runs step() and sends the world to clients; clients send their player input.
'use strict';
(function (root) {
  const D = root.DOLLS_DATA || (typeof require !== 'undefined' ? require('./data.js') : null);
  const { PILE, LOOT, NODES, KEYS } = D;
  const N = Object.fromEntries(NODES.map(n => [n.id, n]));
  // The attic: entrance (door) → hall with the pile → nursery (brass key) → workshop (iron key). Metres.
  const ATTIC = { minX: -11, maxX: 11, minZ: -80, maxZ: 30, walk: 9.2 };
  const ROOMS = Object.fromEntries(D.ROOMS.map(r => [r.id, r.z]));
  const WALLS = D.ROOMS.slice(1).map(r => r.z[1]);            // partition z between each room and the next (doorway at |x| < 1.3)
  const GATED = D.ROOMS.map((r, i) => ({ i, r })).filter(o => o.r.gate);
  const PILE_POS = { x: 0, z: 3 };
  const SPAWN = { x: 0, z: 25 };
  const HOMES = [{ x: 8.2, z: -6.5 }];   // where Mother starts

  function newWorld(seed) {
    const rnd = mulberry(seed || (Date.now() & 0xffff));
    const w = {
      v: 2, removed: 0, cur: {}, total: {}, lvl: {}, notes: [], wrongKeys: 0, found: {}, votes: {}, savedAt: 0, gatesOpen: 0, repel: null,
      keyAt: KEYS.map(k => Math.floor(PILE * (k.range[0] + rnd() * (k.range[1] - k.range[0])))), keys: 0, escaped: false,
      watcher: { x: HOMES[0].x, z: HOMES[0].z, active: false, wake: 0, moving: false, kills: 0, chainLeft: 0, stun: 0, recoil: 0, chase: false, wp: null, wpT: 0, hp: 1, broken: 0, grab: null, flee: 0 },
      musicUntil: 0, musicReady: 0, leverReady: 0, digAcc: 0, autoAcc: 0, time: 0, last: Date.now(), seed: seed || 0, loops: 0, scares: 0,
      settings: { lang: null, scares: true, blood: true, flashes: true, sens: 1, volume: 0.8, warned: false, quality: 'medium' }
    };
    LOOT.forEach(l => { w.cur[l.id] = 0; w.total[l.id] = 0; });
    return w;
  }
  function newPlayer(id) { return { id: id || 'p1', x: SPAWN.x, z: SPAWN.z, yaw: 0, pitch: 0, light: false, battery: 1, digging: false, stun: 0, daze: 0, hp: 1, energy: 1 }; }
  function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // ---------- stats ----------
  const lv = (w, id) => w.lvl[id] || 0;
  function stats(w) {
    const s = { pullSpeed: 1.5, perPull: 1, perPullMult: 1, finds: 1, rare: 1, auto: 0, autoMult: 1, threat: 1, battery: 1, calm: 0, salt: 0,
      mirror: 0, bell: 0, chain: 0, whisper: 0, magnet: 0, light: 0, wide: 0, gloves: 0, nerves: 0, burn: 1, music: 0, coffin: 0, rooms: 0, torch: 0, stamina: 1, armor: 0 };
    for (const id in w.lvl) {
      const n = N[id], L = w.lvl[id]; if (!n || !L) continue; const e = n.effect;
      if (e.pullSpeed) s.pullSpeed *= 1 + e.pullSpeed * L;
      if (e.perPull) s.perPull += e.perPull * L;
      if (e.perPullMult) s.perPullMult *= Math.pow(e.perPullMult, L);
      if (e.autoMult) s.autoMult += e.autoMult * L;
      ['finds', 'rare', 'auto', 'threat', 'battery', 'calm', 'salt', 'mirror', 'bell', 'chain', 'whisper', 'magnet', 'light', 'wide', 'gloves', 'nerves', 'burn', 'music', 'coffin', 'rooms', 'torch', 'stamina', 'armor']
        .forEach(k => { if (e[k] && k !== 'autoMult') s[k] += e[k] * L; });
    }
    s.calm = Math.min(0.85, s.calm); s.salt = Math.min(0.85, s.salt); s.nerves = Math.min(0.75, s.nerves); s.armor = Math.min(0.6, s.armor);
    return s;
  }
  const depth = w => w.removed / PILE;
  const remaining = w => Math.max(0, PILE - w.removed);
  function digRate(w) { const s = stats(w); return s.pullSpeed * s.perPull * s.perPullMult; }
  function autoRate(w) { const s = stats(w); return s.auto * s.autoMult; }
  // gates open in order; how many rooms past the hall are open
  function gateReady(w, r) { return r.gate.key ? w.keys >= r.gate.key : depth(w) >= r.gate.depth; }
  function openRooms(w) { let n = 2; for (const { r } of GATED) { if (gateReady(w, r)) n++; else break; } return Math.max(n, 2 + (w.gatesOpen || 0)); }
  function roomsOpen(w) { return D.ROOMS.slice(0, openRooms(w)).map(r => r.id); }
  function bounds(w) { const last = D.ROOMS[openRooms(w) - 1]; return { minX: -ATTIC.walk, maxX: ATTIC.walk, minZ: last.z[0] + 0.6, maxZ: ATTIC.maxZ - 0.6 }; }
  function gateOpen(w, wallIdx) { return wallIdx + 1 < openRooms(w); }   // wall i separates room i and i+1

  // ---------- upgrades ----------
  function nodeCost(w, id) { const n = N[id], L = lv(w, id), o = {}; for (const r in n.cost) o[r] = Math.ceil(n.cost[r] * Math.pow(n.growth, L)); return o; }
  const nodeVisible = (w, id) => (N[id].req || []).every(r => lv(w, r) > 0) && w.keys >= (N[id].key || 0);
  const canAfford = (w, cost) => Object.keys(cost).every(r => w.cur[r] >= cost[r]);
  function buy(w, id) {
    const n = N[id]; if (!n || !nodeVisible(w, id) || lv(w, id) >= n.max) return false;
    const c = nodeCost(w, id); if (!canAfford(w, c)) return false;
    for (const r in c) w.cur[r] -= c[r]; w.lvl[id] = lv(w, id) + 1;
    if (id === 'chain') w.watcher.chainLeft = stats(w).chain;
    return true;
  }

  // ---------- loot ----------
  function lootFor(w, n, d0, d1) {
    const s = stats(w), out = {};
    LOOT.forEach(l => {
      if (d1 < l.from) return;
      const share = l.from > d0 ? (d1 - l.from) / Math.max(1e-9, d1 - d0) : 1;
      const rare = ['porcelain', 'teeth', 'thread', 'hearts'].includes(l.id) ? s.rare : 1;
      const amt = n * share * l.per * s.finds * rare * (1 + d1 * 0.5);
      if (amt > 0) out[l.id] = amt;
    });
    return out;
  }
  function give(w, loot) { for (const k in loot) { w.cur[k] += loot[k]; w.total[k] += loot[k]; } }
  // reward for scares you dealt with (burning glowing eyes, driving off the crawler): worth `dolls` pulled dolls
  function bounty(w, dolls) { const d = depth(w), loot = lootFor(w, dolls * stats(w).burn, d, d); give(w, loot); return loot; }

  function pull(w, n) {
    n = Math.min(Math.floor(n), remaining(w)); if (n <= 0) return { pulled: 0, loot: {}, notes: [], keys: [] };
    const s = stats(w), d0 = depth(w); w.removed += n; const d1 = depth(w);
    const loot = lootFor(w, n, d0, d1); give(w, loot);
    const notes = [];
    D.NOTES.forEach((nt, i) => { if (!w.notes.includes(i) && d1 >= nt.at) { w.notes.push(i); notes.push(i); } });
    const keys = [];
    while (w.keys < KEYS.length) {
      const at = w.keyAt[w.keys], last = w.keys === KEYS.length - 1;
      if (w.removed >= at || (last && s.magnet && at - w.removed < PILE * 0.02)) { keys.push(w.keys); w.keys++; } else break;
    }
    if (Math.random() < n * 0.00002) w.wrongKeys++;
    return { pulled: n, loot, notes, keys };
  }

  // ---------- the watcher ("Mother") ----------
  // She never stops: she crawls around the open part of the attic, and when she notices you she comes for you.
  // Touching her costs health and strength. Light slows her; the lever's flood of light stuns her.
  const LEVER = { x: -4.2, z: 27.6 };
  function home(w) { const r = D.ROOMS[openRooms(w) - 1]; return { x: 7.5, z: (r.z[0] + r.z[1]) / 2 }; }   // the deepest open room
  function pileR(w) { return Math.max(0.5, 6.6 * Math.cbrt(Math.max(0.0005, remaining(w) / PILE))) + 0.6; }   // matches the 3D heap
  function pickWaypoint(w, W) {
    const B = bounds(w);
    for (let i = 0; i < 20; i++) {
      const x = B.minX + 0.8 + Math.random() * (B.maxX - B.minX - 1.6), z = B.minZ + 0.8 + Math.random() * (B.maxZ - B.minZ - 1.6);
      if (Math.hypot(x - PILE_POS.x, z - PILE_POS.z) > pileR(w) + 0.8 && Math.hypot(x - W.x, z - W.z) > 5) return { x, z };
    }
    return { x: 0, z: (B.minZ + B.maxZ) / 2 };
  }
  // one step toward (tx, tz): through doorways, around the pile
  function steer(w, W, tx, tz, step) {
    for (const z of WALLS) if ((W.z - z) * (tz - z) < 0) { const side = Math.sign(W.z - z); if (Math.abs(W.x) > 0.7 || Math.abs(W.z - z) > 1.2) { tx = 0; tz = z + side * 0.9; } else { tx = 0; tz = z - side * 1.2; } break; }
    const R = pileR(w), px = PILE_POS.x, pz = PILE_POS.z;
    let dx = tx - W.x, dz = tz - W.z; const d = Math.hypot(dx, dz) || 1;
    // if the straight line clips the pile, aim for a tangent point instead
    const t = Math.max(0, Math.min(1, ((px - W.x) * dx + (pz - W.z) * dz) / (d * d))), cx = W.x + dx * t, cz = W.z + dz * t;
    if (Math.hypot(cx - px, cz - pz) < R + 0.3 && Math.hypot(tx - px, tz - pz) > R && (W.x - px) * dx + (W.z - pz) * dz < 0) {   // only if heading into it
      // go round the pile, and stick to the side she picked so she does not dither in front of it
      if (!W.side) { const cross = (W.x - px) * dz - (W.z - pz) * dx; W.side = Math.abs(cross) > 0.5 ? (cross > 0 ? -1 : 1) : (Math.random() < 0.5 ? -1 : 1); }
      const a = Math.atan2(W.z - pz, W.x - px), a2 = a + W.side * 0.5;
      dx = px + Math.cos(a2) * (R + 0.7) - W.x; dz = pz + Math.sin(a2) * (R + 0.7) - W.z;
    } else W.side = 0;
    const dd = Math.hypot(dx, dz) || 1, st = Math.min(step, dd);
    W.x += dx / dd * st; W.z += dz / dd * st;
    const pd = Math.hypot(W.x - px, W.z - pz); if (pd < R) { W.x = px + (W.x - px) / (pd || 1) * R; W.z = pz + (W.z - pz) / (pd || 1) * R; }
    const B = bounds(w); W.x = Math.max(B.minX, Math.min(B.maxX, W.x)); W.z = Math.max(B.minZ, Math.min(B.maxZ, W.z));
    W.heading = Math.atan2(dx, dz);
  }
  function farWaypoint(w, W, from) { let best = null, bd = -1; for (let i = 0; i < 6; i++) { const p = pickWaypoint(w, W), d = Math.hypot(p.x - from.x, p.z - from.z); if (d > bd) { bd = d; best = p; } } return best; }
  function hurtMother(w, amt, ev) {
    const W = w.watcher; if (W.broken > 0) return;
    W.hp = Math.max(0, W.hp - amt);
    if (W.hp <= 0) { W.broken = 45; W.grab = null; W.chase = false; ev.push({ broke: true, loot: bounty(w, 3000 + depth(w) * 25000) }); }
  }
  // env.inBeam[i]: player i's flashlight is on her; env.watched[i]: player i can see her (in view and lit)
  // She cannot hurt anyone while at least one player is watching her. When she reaches someone nobody is watching
  // over, she grabs them: they must type a word in time, or she hurts them.
  function stepWatcher(w, players, dt, env) {
    const W = w.watcher, s = stats(w), ev = [];
    if (!W.active) { if (w.removed >= 100) { W.active = true; ev.push({ woke: true }); } else return ev; }   // she wakes after the first 100 dolls
    W.moving = false;
    if (W.held) return ev;                                     // a scare has her somewhere else for a moment
    if (W.broken > 0) { W.broken -= dt; if (W.broken <= 0) { W.hp = 1; W.broken = 0; ev.push({ mended: true }); } return ev; }
    if (w.time < w.musicUntil) return ev;
    if (W.stun > 0) { W.stun -= dt; return ev; }
    const watchers = players.filter((p, i) => (env.watched || [])[i]).map(p => p.id), watched = watchers.length > 0;
    // she has someone
    if (W.grab) {
      const G = W.grab, p = players.find(q => q.id === G.id);
      if (!p || p.stun > 0) { W.grab = null; return ev; }
      if (watchers.some(id => id !== G.id)) { W.grab = null; W.recoil = 2; W.wp = farWaypoint(w, W, p); ev.push({ grabFree: p.id }); return ev; }
      G.t += dt;
      if (G.t > G.limit) {
        W.grab = null; W.recoil = 2.6; W.chase = false; W.wp = farWaypoint(w, W, p); p.grabCd = 4;
        if (W.chainLeft > 0) { W.chainLeft--; ev.push({ chained: p.id }); return ev; }
        const dmg = 0.34 * (1 - s.armor) * (1 + depth(w) * 0.3);
        p.hp = Math.max(0, p.hp - dmg); p.energy = Math.max(0, p.energy - 0.3 * (1 - s.armor)); W.kills++;
        ev.push(p.hp <= 0 ? { kill: p.id } : { hit: p.id, dmg });
      }
      return ev;
    }
    // the flashlight is dying: she rushes at you out of the dark, stops a step away, and backs off again. No touch.
    if (W.lunge) {
      const L = W.lunge, p = players.find(q => q.id === L.id) || players[0]; L.t += dt; W.moving = true;
      if (L.phase === 'in') { const d = Math.hypot(p.x - W.x, p.z - W.z); if (d > 1.5 && L.t < 4) steer(w, W, p.x, p.z, Math.min(d - 1.4, 7 * dt)); else { L.phase = 'hold'; L.t = 0; ev.push({ lungeHold: p.id }); } }
      else if (L.phase === 'hold') { W.moving = false; if (L.t > 0.9) { L.phase = 'out'; L.t = 0; ev.push({ lungeBack: p.id }); } }
      else { const d = Math.hypot(L.ox - W.x, L.oz - W.z); if (d > 0.3 && L.t < 5) steer(w, W, L.ox, L.oz, 6 * dt); else { W.lunge = null; W.recoil = 1.5; } }
      return ev;
    }
    if (W.recoil > 0) { W.recoil -= dt; return ev; }
    const dying = players.find(p => p.light && p.battery < 0.12 && !p.lunged && p.stun <= 0);
    if (dying) { dying.lunged = true; W.lunge = { id: dying.id, phase: 'in', t: 0, ox: W.x, oz: W.z }; W.chase = false; ev.push({ lunge: dying.id }); return ev; }
    players.forEach(p => { if (p.battery > 0.4) p.lunged = false; p.grabCd = Math.max(0, (p.grabCd || 0) - dt); });
    const rep = w.repel && w.time < w.repel.until ? w.repel : null;
    const safe = p => rep && Math.hypot(p.x - rep.x, p.z - rep.z) < 6;
    const alive = players.filter(p => p.stun <= 0 && p.hp > 0 && !safe(p));
    let target = null, bd = 1e9; alive.forEach(p => { const d = Math.hypot(p.x - W.x, p.z - W.z); if (d < bd) { bd = d; target = p; } });
    const notice = (5.5 + depth(w) * 6) * (1 - s.salt) * (target && target.digging ? 1.3 : 1);
    if (target && !W.chase && bd < notice && !(W.flee > 0)) { W.chase = true; ev.push({ noticed: target.id }); }
    if (W.chase && (!target || bd > notice * 2)) { W.chase = false; W.wp = null; }
    let speed = (W.chase ? 1.45 + depth(w) * 1.6 : 0.8 + depth(w) * 0.6) * s.threat;
    if ((env.inBeam || []).some(Boolean)) speed *= Math.max(0.15, 0.35 - s.wide);
    else if (watched) speed *= 0.6;
    if (env.litAtWatcher) speed *= 1 - s.calm;
    if (s.mirror && players.some(p => p.digging)) speed *= 0.6;
    if (W.flee > 0) { W.flee -= dt; speed = 3.2; W.chase = false; }
    W.moving = true;
    if (rep && Math.hypot(W.x - rep.x, W.z - rep.z) < 7) { const a = Math.atan2(W.z - rep.z, W.x - rep.x); steer(w, W, rep.x + Math.cos(a) * 9, rep.z + Math.sin(a) * 9, 2.5 * dt); W.chase = false; return ev; }
    if (W.chase && target) steer(w, W, target.x, target.z, speed * dt);
    else {
      W.wpT -= dt; if (!W.wp || W.wpT <= 0 || Math.hypot(W.wp.x - W.x, W.wp.z - W.z) < 0.6) { W.wp = pickWaypoint(w, W); W.wpT = 50; }
      steer(w, W, W.wp.x, W.wp.z, speed * dt);
    }
    // she reaches someone: if anyone is watching her she cannot touch them; otherwise she grabs
    alive.forEach(p => {
      if (W.grab || p.grabCd > 0 || Math.hypot(p.x - W.x, p.z - W.z) > 1.3) return;
      if (watched) { W.recoil = 1.2; W.chase = false; W.wp = farWaypoint(w, W, p); ev.push({ repelled: p.id }); return; }
      const word = Math.floor(Math.random() * D.WORDS.en.length), limit = Math.max(3.2, 5.2 - depth(w) * 1.6) * (1 + s.nerves);
      W.grab = { id: p.id, t: 0, limit, word }; W.moving = false; ev.push({ grab: p.id, word, limit });
    });
    return ev;
  }
  // the player typed the word in time
  function typed(w, id) {
    const W = w.watcher; if (!W.grab || W.grab.id !== id) return null;
    W.grab = null; W.recoil = 1; W.chase = false; W.wp = farWaypoint(w, W, W); W.flee = 3;
    return { grabOk: id };
  }
  // weapons: aim = { inView, dist } as seen by that player
  function useWeapon(w, p, kind, aim) {
    const Wd = D.WEAPONS[kind], W = w.watcher, ev = [];
    if (!Wd || !w.found[kind]) return { ok: false, why: 'none', ev };
    p.cd = p.cd || {}; if ((p.cd[kind] || 0) > w.time) return { ok: false, why: 'cd', wait: Math.ceil(p.cd[kind] - w.time), ev };
    if (kind === 'flare') { w.repel = { x: p.x, z: p.z, until: w.time + Wd.repel }; p.cd[kind] = w.time + Wd.cd; if (W.grab && W.grab.id === p.id) { W.grab = null; W.recoil = 2; } ev.push({ flare: p.id, x: p.x, z: p.z }); return { ok: true, ev }; }
    const d = Math.hypot(W.x - p.x, W.z - p.z);
    if (!aim || !aim.inView || d > Wd.range || W.broken > 0) { p.cd[kind] = w.time + Math.min(2, Wd.cd); return { ok: false, why: 'miss', ev }; }
    p.cd[kind] = w.time + Wd.cd;
    if (W.grab) W.grab = null;
    hurtMother(w, Wd.dmg * (1 + stats(w).burn * 0.1 - 0.1), ev);
    if (kind === 'poker') { W.recoil = 3; W.chase = false; W.wp = farWaypoint(w, W, p); }
    if (kind === 'camera') { W.stun = Math.max(W.stun, Wd.stun); }
    if (kind === 'holy') { W.recoil = 0.6; W.flee = 6; W.wp = farWaypoint(w, W, p); }
    ev.push({ weapon: kind, by: p.id, hit: true });
    return { ok: true, ev };
  }
  function pickItem(w, id) {
    const it = D.ITEMS.find(i => i.id === id); if (!it || w.found[id]) return null;
    if (!roomsOpen(w).includes(it.room)) return null;
    w.found[id] = true; const loot = it.kind === 'egg' ? bounty(w, 1500 + depth(w) * 9000) : {};
    return { item: id, loot };
  }
  // co-op upgrades: a node is bought when more than half of the players vote for it and it is affordable
  function vote(w, pid, id) { if (!N[id]) return; const v = w.votes[id] = w.votes[id] || []; const i = v.indexOf(pid); if (i >= 0) v.splice(i, 1); else v.push(pid); if (!v.length) delete w.votes[id]; }
  function settleVotes(w, ids) {
    const need = Math.floor(ids.length / 2) + 1, bought = [];
    for (const id in w.votes) { w.votes[id] = w.votes[id].filter(p => ids.includes(p)); if (!w.votes[id].length) { delete w.votes[id]; continue; } if (w.votes[id].length >= need && buy(w, id)) { delete w.votes[id]; bought.push(id); } }
    return bought;
  }
  // the lever by the door: save point, strength back, and a second of light everywhere that stuns her
  function pullLever(w, p) {
    const s = stats(w); p.hp = 1; p.energy = 1; w.watcher.chainLeft = s.chain;
    if (w.time < w.leverReady) return { stunned: false, wait: Math.ceil(w.leverReady - w.time) };
    w.watcher.stun = 20 + depth(w) * 10; w.watcher.chase = false; w.watcher.wp = null; w.leverReady = w.time + 60;
    return { stunned: true };
  }
  function playMusic(w) {
    const L = stats(w).music; if (!L || w.time < w.musicReady) return false;
    w.musicUntil = w.time + 15 * L; w.musicReady = w.time + 15 * L + 120; return true;
  }

  // ---------- flashlight ----------
  function stepBattery(w, p, dt) {
    const st = stats(w); if (!st.torch) { p.light = false; return; }
    const cap = 60 * st.battery;
    if (p.light) { p.battery -= dt / cap; if (p.battery <= 0) { p.battery = 0; p.light = false; } }
    else p.battery = Math.min(1, p.battery + dt / (cap * 0.6));
  }

  // ---------- main step (host) ----------
  function step(w, players, dt, env) {
    w.time += dt; const out = { pulled: 0, loot: {}, notes: [], keys: [], events: [] };
    const merge = r => { out.pulled += r.pulled; for (const k in r.loot) out.loot[k] = (out.loot[k] || 0) + r.loot[k]; out.notes.push(...r.notes); out.keys.push(...r.keys); };
    const dr = digRate(w);
    players.forEach(p => { if (p.digging && p.energy <= 0) p.digging = false; if (p.digging && p.stun <= 0 && p.daze <= 0) { w.digAcc += dr * dt; p.energy = Math.max(0, p.energy - dt / (100 * stats(w).stamina)); } p.stun = Math.max(0, p.stun - dt); p.daze = Math.max(0, p.daze - dt); stepBattery(w, p, dt); });
    w.autoAcc += autoRate(w) * dt;
    const n = Math.floor(w.digAcc) + Math.floor(w.autoAcc); w.digAcc -= Math.floor(w.digAcc); w.autoAcc -= Math.floor(w.autoAcc);
    if (n > 0) merge(pull(w, n));
    out.events.push(...stepWatcher(w, players, dt, env || {}));
    const open = openRooms(w) - 2; if (open > (w.gatesOpen || 0)) { for (let i = (w.gatesOpen || 0); i < open; i++) out.events.push({ gate: D.ROOMS[i + 2].id }); w.gatesOpen = open; }
    return out;
  }
  function offline(w, now) {
    const dt = Math.min(12 * 3600, Math.max(0, (now - (w.last || now)) / 1000)); w.last = now;
    if (dt < 30) return null;
    const r = pull(w, Math.floor(autoRate(w) * dt * 0.5)); return Object.assign({ dt }, r);
  }
  function keyHint(w) {
    const L = stats(w).whisper; if (!L || w.keys >= KEYS.length) return null;
    const half = [0, 0.04, 0.015, 0.005][Math.min(3, L)] * PILE, at = w.keyAt[w.keys];
    const c = at + (((w.seed * 9301 + 49297) % 233280) / 233280 - 0.5) * half;
    return { from: Math.max(0, Math.round(c - half)), to: Math.min(PILE, Math.round(c + half)) };
  }

  const api = { PILE, ATTIC, ROOMS, PILE_POS, SPAWN, HOMES, N, newWorld, newPlayer, stats, depth, remaining, digRate, autoRate, roomsOpen, bounds,
    nodeCost, nodeVisible, canAfford, buy, pull, bounty, step, pullLever, LEVER, playMusic, battery: stepBattery, WALLS, gateOpen, openRooms, typed, useWeapon, pickItem, vote, settleVotes, offline, keyHint, lv };
  root.Sim = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
