// Pure game simulation, no DOM, no rendering.
// Split into a shared WORLD (pile, loot, upgrades, the watcher) and PLAYERS (position, look, light).
// For co-op the host runs step() and sends the world to clients; clients send their player input.
'use strict';
(function (root) {
  const D = root.DOLLS_DATA || (typeof require !== 'undefined' ? require('./data.js') : null);
  const { PILE, LOOT, NODES } = D;
  const N = Object.fromEntries(NODES.map(n => [n.id, n]));
  const ATTIC = { minX: -9, maxX: 9, minZ: -14, maxZ: 14 };   // metres
  const PILE_POS = { x: 0, z: -2 };
  const WATCH_HOME = { x: 7.5, z: 12 };

  function newWorld(seed) {
    const rnd = mulberry(seed || (Date.now() & 0xffff));
    const w = {
      v: 1, removed: 0, cur: {}, total: {}, lvl: {}, notes: [], wrongKeys: 0,
      keyAt: Math.floor(PILE * (0.86 + rnd() * 0.13)), keyFound: false, escaped: false,
      watcher: { x: WATCH_HOME.x, z: WATCH_HOME.z, active: false, wake: 0, moving: false, kills: 0, chainLeft: 0 },
      digAcc: 0, autoAcc: 0, time: 0, last: Date.now(), seed: seed || 0,
      settings: { lang: null, scares: true, blood: true, flashes: true, sens: 1, volume: 0.8, warned: false }
    };
    LOOT.forEach(l => { w.cur[l.id] = 0; w.total[l.id] = 0; });
    return w;
  }
  function newPlayer(id) { return { id: id || 'p1', x: 0, z: 9, yaw: Math.PI, pitch: 0, light: true, battery: 1, digging: false, stun: 0 }; }
  function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // ---------- stats from upgrades ----------
  const lv = (w, id) => w.lvl[id] || 0;
  function stats(w) {
    const s = { pullSpeed: 1.5, perPull: 1, perPullMult: 1, finds: 1, rare: 1, auto: 0, autoMult: 1, threat: 1, battery: 1, calm: 0, salt: 0,
      mirror: 0, bell: 0, chain: 0, whisper: 0, magnet: 0, light: 0 };
    for (const id in w.lvl) {
      const n = N[id], L = w.lvl[id]; if (!n || !L) continue; const e = n.effect;
      if (e.pullSpeed) s.pullSpeed *= 1 + e.pullSpeed * L;
      if (e.perPull) s.perPull += e.perPull * L;
      if (e.perPullMult) s.perPullMult *= Math.pow(e.perPullMult, L);
      if (e.finds) s.finds += e.finds * L;
      if (e.rare) s.rare += e.rare * L;
      if (e.auto) s.auto += e.auto * L;
      if (e.autoMult) s.autoMult += e.autoMult * L;
      if (e.threat) s.threat += e.threat * L;
      if (e.battery) s.battery += e.battery * L;
      if (e.calm) s.calm += e.calm * L;
      if (e.salt) s.salt += e.salt * L;
      ['mirror', 'bell', 'chain', 'whisper', 'magnet', 'light'].forEach(k => { if (e[k]) s[k] += e[k] * L; });
    }
    s.calm = Math.min(0.85, s.calm); s.salt = Math.min(0.8, s.salt);
    return s;
  }
  const depth = w => w.removed / PILE;
  const remaining = w => Math.max(0, PILE - w.removed);
  function digRate(w) { const s = stats(w); return s.pullSpeed * s.perPull * s.perPullMult; }   // dolls/s while holding
  function autoRate(w) { const s = stats(w); return s.auto * s.autoMult; }

  // ---------- upgrades ----------
  function nodeCost(w, id) { const n = N[id], L = lv(w, id), o = {}; for (const r in n.cost) o[r] = Math.ceil(n.cost[r] * Math.pow(n.growth, L)); return o; }
  const nodeVisible = (w, id) => (N[id].req || []).every(r => lv(w, r) > 0);
  const canAfford = (w, cost) => Object.keys(cost).every(r => w.cur[r] >= cost[r]);
  function buy(w, id) {
    const n = N[id]; if (!n || !nodeVisible(w, id) || lv(w, id) >= n.max) return false;
    const c = nodeCost(w, id); if (!canAfford(w, c)) return false;
    for (const r in c) w.cur[r] -= c[r]; w.lvl[id] = lv(w, id) + 1;
    if (id === 'chain') w.watcher.chainLeft = stats(w).chain;
    return true;
  }

  // ---------- pulling dolls ----------
  // returns { pulled, loot: {id: amount}, notes: [indices], key: bool }
  function pull(w, n) {
    n = Math.min(Math.floor(n), remaining(w)); if (n <= 0) return { pulled: 0, loot: {}, notes: [], key: false };
    const s = stats(w), d0 = depth(w); w.removed += n; const d1 = depth(w);
    const loot = {};
    LOOT.forEach(l => {
      if (d1 < l.from) return;
      const share = l.from > d0 ? (d1 - l.from) / Math.max(1e-9, d1 - d0) : 1;
      const rare = l.id === 'porcelain' || l.id === 'teeth' ? s.rare : 1;
      const amt = n * share * l.per * s.finds * rare * (1 + d1 * 0.5);      // deeper dolls hide more
      if (amt > 0) { w.cur[l.id] += amt; w.total[l.id] += amt; loot[l.id] = amt; }
    });
    const notes = [];
    D.NOTES.forEach((nt, i) => { if (!w.notes.includes(i) && d1 >= nt.at) { w.notes.push(i); notes.push(i); } });
    let key = false;
    if (!w.keyFound && (w.removed >= w.keyAt || (s.magnet && w.keyAt - w.removed < PILE * 0.02))) { w.keyFound = true; key = true; }
    if (Math.random() < n * 0.00002) w.wrongKeys++;
    return { pulled: n, loot, notes, key };
  }

  // ---------- the watcher ("Mother") ----------
  // watched: array of booleans, one per player — true when that player can currently see her (in view, lit, not blocked).
  // mirrorView: true when a player digs at the pile and the mirror upgrade is owned.
  function stepWatcher(w, players, watched, dt, litAtWatcher) {
    const W = w.watcher, s = stats(w);
    if (!W.active) { if (w.removed >= PILE * 0.006) { W.active = true; W.wake = 0; } else return null; }
    const seen = watched.some(Boolean);
    // she builds up "wake" while not seen, faster the deeper you are and the more noise you make
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
      if (W.chainLeft > 0) { W.chainLeft--; W.x = WATCH_HOME.x; W.z = WATCH_HOME.z; W.wake = 0; return { chained: target.id }; }
      return { kill: target.id };
    }
    const step = Math.min(d - 0.6, speed * dt); W.x += dx / d * step; W.z += dz / d * step;
    return null;
  }
  // penalty: she takes part of what you found and the lights go out for a while
  function killed(w, player) {
    const lost = {};
    LOOT.forEach(l => { const amt = w.cur[l.id] * 0.15; w.cur[l.id] -= amt; if (amt > 0) lost[l.id] = amt; });
    w.watcher.kills++; w.watcher.x = WATCH_HOME.x; w.watcher.z = WATCH_HOME.z; w.watcher.wake = 0; w.watcher.chainLeft = stats(w).chain;
    player.stun = 4; player.x = 0; player.z = 9; player.battery = Math.max(player.battery, 0.3);
    return lost;
  }

  // ---------- flashlight ----------
  function stepBattery(w, p, dt) {
    const cap = 60 * stats(w).battery;   // seconds of light
    if (p.light) { p.battery -= dt / cap; if (p.battery <= 0) { p.battery = 0; p.light = false; } }
    else p.battery = Math.min(1, p.battery + dt / (cap * 0.6));
  }

  // ---------- main step (host) ----------
  function step(w, players, dt, env) {
    w.time += dt; const out = { pulled: 0, loot: {}, notes: [], key: false, events: [] };
    const merge = r => { out.pulled += r.pulled; for (const k in r.loot) out.loot[k] = (out.loot[k] || 0) + r.loot[k]; out.notes.push(...r.notes); out.key = out.key || r.key; };
    // hand digging
    const dr = digRate(w);
    players.forEach(p => { if (p.digging && p.stun <= 0) w.digAcc += dr * dt; p.stun = Math.max(0, p.stun - dt); stepBattery(w, p, dt); });
    w.autoAcc += autoRate(w) * dt;
    const n = Math.floor(w.digAcc) + Math.floor(w.autoAcc); w.digAcc -= Math.floor(w.digAcc); w.autoAcc -= Math.floor(w.autoAcc);
    if (n > 0) merge(pull(w, n));
    // watcher
    const ev = stepWatcher(w, players, env.watched || players.map(() => false), dt, !!env.litAtWatcher);
    if (ev) out.events.push(ev);
    return out;
  }
  // idle progress while the game is closed: helpers keep pulling, she sleeps
  function offline(w, now) {
    const dt = Math.min(12 * 3600, Math.max(0, (now - (w.last || now)) / 1000)); w.last = now;
    if (dt < 30) return null;
    const n = Math.floor(autoRate(w) * dt * 0.5);
    const r = pull(w, n); return Object.assign({ dt }, r);
  }
  function keyHint(w) { // whisper upgrade: a band around the key, narrower each level
    const L = stats(w).whisper; if (!L || w.keyFound) return null;
    const half = [0, 0.12, 0.05, 0.015][Math.min(3, L)] * PILE;
    const c = w.keyAt + (((w.seed * 9301 + 49297) % 233280) / 233280 - 0.5) * half;
    return { from: Math.max(0, Math.round(c - half)), to: Math.min(PILE, Math.round(c + half)) };
  }

  const api = { PILE, ATTIC, PILE_POS, WATCH_HOME, N, newWorld, newPlayer, stats, depth, remaining, digRate, autoRate, nodeCost, nodeVisible, canAfford, buy, pull, step, killed, offline, keyHint, lv };
  root.Sim = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
