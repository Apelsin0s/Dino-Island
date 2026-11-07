// Pure game simulation, no DOM, no rendering.
// Split into a shared WORLD (pile, loot, upgrades, keys, the watcher) and PLAYERS (position, look, light).
// For co-op the host runs step() and sends the world to clients; clients send their player input.
'use strict';
(function (root) {
  const D = root.DOLLS_DATA || (typeof require !== 'undefined' ? require('./data.js') : null);
  const { PILE, LOOT, NODES, KEYS } = D;
  const N = Object.fromEntries(NODES.map(n => [n.id, n]));
  // The attic: entrance (door) → hall with the pile → nursery (brass key) → workshop (iron key). Metres.
  const ATTIC = { minX: -11, maxX: 11, minZ: -30, maxZ: 30, walk: 9.2 };
  const ROOMS = { entrance: [14, 30], hall: [-8, 14], nursery: [-19, -8], workshop: [-30, -19] };
  const PILE_POS = { x: 0, z: 3 };
  const SPAWN = { x: 0, z: 25 };
  const HOMES = [{ x: 8.2, z: -6.5 }, { x: -8, z: -17 }, { x: 7.5, z: -28 }];  // where Mother waits, per keys found

  function newWorld(seed) {
    const rnd = mulberry(seed || (Date.now() & 0xffff));
    const w = {
      v: 2, removed: 0, cur: {}, total: {}, lvl: {}, notes: [], wrongKeys: 0,
      keyAt: KEYS.map(k => Math.floor(PILE * (k.range[0] + rnd() * (k.range[1] - k.range[0])))), keys: 0, escaped: false,
      watcher: { x: HOMES[0].x, z: HOMES[0].z, active: false, wake: 0, moving: false, kills: 0, chainLeft: 0 },
      musicUntil: 0, musicReady: 0, digAcc: 0, autoAcc: 0, time: 0, last: Date.now(), seed: seed || 0, loops: 0, scares: 0,
      settings: { lang: null, scares: true, blood: true, flashes: true, sens: 1, volume: 0.8, warned: false, quality: 'medium' }
    };
    LOOT.forEach(l => { w.cur[l.id] = 0; w.total[l.id] = 0; });
    return w;
  }
  function newPlayer(id) { return { id: id || 'p1', x: SPAWN.x, z: SPAWN.z, yaw: 0, pitch: 0, light: true, battery: 1, digging: false, stun: 0, daze: 0 }; }
  function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // ---------- stats ----------
  const lv = (w, id) => w.lvl[id] || 0;
  function stats(w) {
    const s = { pullSpeed: 1.5, perPull: 1, perPullMult: 1, finds: 1, rare: 1, auto: 0, autoMult: 1, threat: 1, battery: 1, calm: 0, salt: 0,
      mirror: 0, bell: 0, chain: 0, whisper: 0, magnet: 0, light: 0, wide: 0, gloves: 0, nerves: 0, burn: 1, music: 0, coffin: 0, rooms: 0 };
    for (const id in w.lvl) {
      const n = N[id], L = w.lvl[id]; if (!n || !L) continue; const e = n.effect;
      if (e.pullSpeed) s.pullSpeed *= 1 + e.pullSpeed * L;
      if (e.perPull) s.perPull += e.perPull * L;
      if (e.perPullMult) s.perPullMult *= Math.pow(e.perPullMult, L);
      if (e.autoMult) s.autoMult += e.autoMult * L;
      ['finds', 'rare', 'auto', 'threat', 'battery', 'calm', 'salt', 'mirror', 'bell', 'chain', 'whisper', 'magnet', 'light', 'wide', 'gloves', 'nerves', 'burn', 'music', 'coffin', 'rooms']
        .forEach(k => { if (e[k] && k !== 'autoMult') s[k] += e[k] * L; });
    }
    s.calm = Math.min(0.85, s.calm); s.salt = Math.min(0.85, s.salt); s.nerves = Math.min(0.75, s.nerves);
    return s;
  }
  const depth = w => w.removed / PILE;
  const remaining = w => Math.max(0, PILE - w.removed);
  function digRate(w) { const s = stats(w); return s.pullSpeed * s.perPull * s.perPullMult; }
  function autoRate(w) { const s = stats(w); return s.auto * s.autoMult; }
  function roomsOpen(w) { return ['entrance', 'hall'].concat(w.keys >= 1 ? ['nursery'] : [], w.keys >= 2 ? ['workshop'] : []); }
  function bounds(w) { return { minX: -ATTIC.walk, maxX: ATTIC.walk, minZ: (w.keys >= 2 ? ROOMS.workshop[0] : w.keys >= 1 ? ROOMS.nursery[0] : ROOMS.hall[0]) + 0.6, maxZ: ATTIC.maxZ - 0.6 }; }

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
  function home(w) { const s = stats(w); return HOMES[Math.min(HOMES.length - 1, w.keys + (s.coffin ? 1 : 0))]; }
  function stepWatcher(w, players, watched, dt, litAtWatcher) {
    const W = w.watcher, s = stats(w);
    if (!W.active) { if (w.removed >= PILE * 0.002) { W.active = true; W.wake = 0; } else return null; }
    if (w.time < w.musicUntil) { W.moving = false; W.wake = Math.max(0, W.wake - dt * 0.3); return null; }
    const seen = watched.some(Boolean);
    W.wake = Math.min(1, W.wake + (seen ? -0.15 : 0.12 * (1 + depth(w) * 2) * s.threat * (1 - s.salt)) * dt);
    if (W.wake < 0) W.wake = 0;
    const alive = players.filter(p => p.stun <= 0);
    if (seen || !alive.length || W.wake < 0.35) { W.moving = false; return null; }
    let target = alive[0], bd = 1e9;
    alive.forEach(p => { const d = Math.hypot(p.x - W.x, p.z - W.z); if (d < bd) { bd = d; target = p; } });
    let speed = (0.9 + depth(w) * 2.2) * s.threat;
    if (litAtWatcher) speed *= 1 - s.calm;
    if (s.mirror && players.some(p => p.digging)) speed *= 0.5;
    const dx = target.x - W.x, dz = target.z - W.z, d = Math.hypot(dx, dz);
    W.moving = true;
    if (d < 0.7) {
      const H = home(w);
      if (W.chainLeft > 0) { W.chainLeft--; W.x = H.x; W.z = H.z; W.wake = 0; return { chained: target.id }; }
      return { kill: target.id };
    }
    const step = Math.min(d - 0.6, speed * dt); W.x += dx / d * step; W.z += dz / d * step;
    return null;
  }
  function killed(w, player) {
    const lost = {};
    LOOT.forEach(l => { const amt = w.cur[l.id] * 0.15; w.cur[l.id] -= amt; if (amt > 0) lost[l.id] = amt; });
    const H = home(w); w.watcher.kills++; w.watcher.x = H.x; w.watcher.z = H.z; w.watcher.wake = 0; w.watcher.chainLeft = stats(w).chain;
    player.stun = 4; player.x = SPAWN.x; player.z = SPAWN.z; player.battery = Math.max(player.battery, 0.3);
    return lost;
  }
  function playMusic(w) {
    const L = stats(w).music; if (!L || w.time < w.musicReady) return false;
    w.musicUntil = w.time + 15 * L; w.musicReady = w.time + 15 * L + 120; return true;
  }

  // ---------- flashlight ----------
  function stepBattery(w, p, dt) {
    const cap = 60 * stats(w).battery;
    if (p.light) { p.battery -= dt / cap; if (p.battery <= 0) { p.battery = 0; p.light = false; } }
    else p.battery = Math.min(1, p.battery + dt / (cap * 0.6));
  }

  // ---------- main step (host) ----------
  function step(w, players, dt, env) {
    w.time += dt; const out = { pulled: 0, loot: {}, notes: [], keys: [], events: [] };
    const merge = r => { out.pulled += r.pulled; for (const k in r.loot) out.loot[k] = (out.loot[k] || 0) + r.loot[k]; out.notes.push(...r.notes); out.keys.push(...r.keys); };
    const dr = digRate(w);
    players.forEach(p => { if (p.digging && p.stun <= 0 && p.daze <= 0) w.digAcc += dr * dt; p.stun = Math.max(0, p.stun - dt); p.daze = Math.max(0, p.daze - dt); stepBattery(w, p, dt); });
    w.autoAcc += autoRate(w) * dt;
    const n = Math.floor(w.digAcc) + Math.floor(w.autoAcc); w.digAcc -= Math.floor(w.digAcc); w.autoAcc -= Math.floor(w.autoAcc);
    if (n > 0) merge(pull(w, n));
    const ev = stepWatcher(w, players, env.watched || players.map(() => false), dt, !!env.litAtWatcher);
    if (ev) out.events.push(ev);
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
    nodeCost, nodeVisible, canAfford, buy, pull, bounty, step, killed, playMusic, offline, keyHint, lv };
  root.Sim = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
