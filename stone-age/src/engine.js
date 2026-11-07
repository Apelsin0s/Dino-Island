// Pure game logic, no DOM. Used by the game and by tools/simulate.js.
'use strict';
(function (root) {
  const D = root.GAME_DATA || (typeof require !== 'undefined' ? require('./data-node.js') : null);
  const { RES, BUILDINGS, TECHS, PARTS, STORY, ACH } = D;
  const COST_GROWTH = 1.15;
  const ECHO_BONUS = 0.10;
  const OFFLINE_CAP_S = 12 * 3600;
  const byId = list => Object.fromEntries(list.map(x => [x.id, x]));
  const B = byId(BUILDINGS), T = byId(TECHS), P = byId(PARTS);

  function newState(keep) {
    const s = {
      v: 1, res: {}, total: {}, b: {}, tech: {}, parts: {},
      clicks: 0, built: 0, echoes: 0, loops: 0, story: {}, ach: {},
      playTime: 0, loopTime: 0, last: Date.now(),
      settings: { lang: null, sound: true, buyMode: 1 }
    };
    RES.forEach(r => { s.res[r.id] = 0; s.total[r.id] = 0; });
    if (keep) Object.assign(s, keep);
    return s;
  }

  // ---------- costs ----------
  function buildingCost(b, owned, n) {
    const k = (Math.pow(COST_GROWTH, n) - 1) / (COST_GROWTH - 1);
    const out = {};
    for (const r in b.cost) out[r] = Math.ceil(b.cost[r] * Math.pow(COST_GROWTH, owned) * k);
    return out;
  }
  function canAfford(s, cost) { for (const r in cost) if ((s.res[r] || 0) < cost[r]) return false; return true; }
  function pay(s, cost) { for (const r in cost) s.res[r] -= cost[r]; }
  function maxAffordable(s, b) {
    let n = 0;
    while (n < 1000 && canAfford(s, buildingCost(b, s.b[b.id] || 0, n + 1))) n++;
    return n;
  }

  // ---------- unlocks ----------
  const hasReq = (s, x) => !x.req || !!s.tech[x.req];
  const buildingVisible = (s, b) => hasReq(s, b);
  const techVisible = (s, t) => !s.tech[t.id] && hasReq(s, t);
  function nextPart(s) { return PARTS.find(p => !s.parts[p.id]) || null; }
  function machineVisible(s) { return !!s.tech.wheel || Object.keys(s.parts).length > 0; }
  function resVisible(s, id) {
    if (id === 'food' || id === 'wood' || id === 'stone' || id === 'ideas') return true;
    return s.total[id] > 0 || rates(s)[id] > 0;
  }

  // ---------- multipliers ----------
  function multipliers(s) {
    let all = 1 + s.echoes * ECHO_BONUS, click = 1, clickPct = 0;
    const res = {}; RES.forEach(r => res[r.id] = 1);
    for (const id in s.tech) {
      const e = T[id] && T[id].effect; if (!e) continue;
      if (e.all) all *= e.all;
      if (e.click) click *= e.click;
      if (e.clickPct) clickPct += e.clickPct;
      if (e.res) for (const r in e.res) res[r] *= e.res[r];
    }
    let global = 1;
    BUILDINGS.forEach(b => { if (b.global) global += b.global * (s.b[b.id] || 0); });
    return { all: all * global, click: click * (1 + s.echoes * ECHO_BONUS), clickPct, res };
  }
  function rates(s) {
    const m = multipliers(s), out = {};
    RES.forEach(r => out[r.id] = 0);
    BUILDINGS.forEach(b => {
      const n = s.b[b.id] || 0; if (!n || !b.prod) return;
      for (const r in b.prod) out[r] += b.prod[r] * n;
    });
    for (const r in out) out[r] *= m.all * m.res[r];
    return out;
  }
  function clickGain(s, resId) {
    const m = multipliers(s);
    return m.click + rates(s)[resId] * m.clickPct;
  }

  // ---------- actions ----------
  function gain(s, r, amt) { s.res[r] += amt; s.total[r] += amt; }
  function click(s, resId) { const g = clickGain(s, resId); gain(s, resId, g); s.clicks++; return g; }
  function buyBuilding(s, id, n) {
    const b = B[id]; if (!b || !buildingVisible(s, b)) return 0;
    if (n === 'max') n = maxAffordable(s, b);
    if (!n) return 0;
    const cost = buildingCost(b, s.b[id] || 0, n);
    if (!canAfford(s, cost)) return 0;
    pay(s, cost); s.b[id] = (s.b[id] || 0) + n; s.built += n; return n;
  }
  function research(s, id) {
    const t = T[id]; if (!t || !techVisible(s, t) || !canAfford(s, t.cost)) return false;
    pay(s, t.cost); s.tech[id] = true; return true;
  }
  function buildPart(s, id) {
    const p = P[id]; if (!p || s.parts[id] || nextPart(s) !== p || !hasReq(s, p) || !canAfford(s, p.cost)) return false;
    pay(s, p.cost); s.parts[id] = true; return true;
  }
  function tick(s, dt) {
    const r = rates(s);
    for (const id in r) if (r[id]) gain(s, id, r[id] * dt);
    s.playTime += dt; s.loopTime += dt;
  }
  function offline(s, now) {
    const dt = Math.min(OFFLINE_CAP_S, Math.max(0, (now - (s.last || now)) / 1000));
    const before = Object.assign({}, s.res);
    if (dt > 5) tick(s, dt);
    s.last = now;
    const got = {}; for (const r in s.res) if (s.res[r] - before[r] > 0) got[r] = s.res[r] - before[r];
    return { dt, got };
  }

  // ---------- story / achievements ----------
  function newStory(s) { return STORY.filter(e => !s.story[e.id] && e.when(s)); }
  function newAch(s) { return ACH.filter(a => !s.ach[a.id] && a.when(s)); }

  // ---------- time loop (prestige) ----------
  function echoesFromLoop(s) { return Math.max(1, Math.floor(Math.sqrt(s.total.ideas / 200000))); }
  function finishLoop(s) {
    const gained = echoesFromLoop(s);
    const keep = {
      echoes: s.echoes + gained, loops: s.loops + 1, story: s.story, ach: s.ach,
      settings: s.settings, playTime: s.playTime, clicks: s.clicks, built: 0
    };
    const ns = newState(keep);
    ns.story = Object.assign({}, s.story); ns.ach = Object.assign({}, s.ach);
    return { state: ns, gained };
  }

  const api = { COST_GROWTH, ECHO_BONUS, newState, buildingCost, canAfford, maxAffordable, buildingVisible, techVisible,
    nextPart, machineVisible, resVisible, multipliers, rates, clickGain, click, buyBuilding, research, buildPart, tick,
    offline, newStory, newAch, echoesFromLoop, finishLoop, B, T, P };
  root.Engine = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
