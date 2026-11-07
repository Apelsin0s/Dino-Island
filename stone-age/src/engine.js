// Pure game logic, no DOM. Used by the game and by tools/simulate.js.
'use strict';
(function (root) {
  const D = root.GAME_DATA, W = root.World;
  const { RES, REGIONS, CHAIN, EGGS, BUILDINGS, UPGRADES, RESEARCH, STORY, ACH } = D;
  const BUILD_GROWTH = 2.1;      // each extra building of the same type
  const LEVEL_GROWTH = 1.45;     // each level of one building
  const LEVEL_BASE = 0.55;       // level 1→2 costs 55% of the building price
  const ECHO_BONUS = 0.10;
  const OFFLINE_CAP_S = 12 * 3600;
  const byId = list => Object.fromEntries(list.map(x => [x.id, x]));
  const B = byId(BUILDINGS), U = byId(UPGRADES), R = byId(RESEARCH), REG = byId(REGIONS), EG = byId(EGGS);
  const PART_CHAIN = Object.fromEntries(CHAIN.map((c, i) => [c.part.id, i]));

  function newState(keep) {
    const s = {
      v: 2, res: {}, total: {}, buildings: [], nextId: 1, upgrades: { tribe: true }, research: {},
      regions: ['meadow'], clues: {}, parts: {}, eggs: {}, known: {},
      clicks: 0, built: 0, maxLevel: 0, echoes: 0, loops: 0, story: {}, ach: {},
      playTime: 0, loopTime: 0, last: Date.now(),
      settings: { lang: null, sound: true, gfx: 'medium' }
    };
    RES.forEach(r => { s.res[r.id] = 0; s.total[r.id] = 0; });
    if (keep) Object.assign(s, keep);
    return s;
  }

  // ---------- helpers ----------
  const canAfford = (s, cost) => { for (const r in cost) if ((s.res[r] || 0) < cost[r]) return false; return true; };
  const pay = (s, cost) => { for (const r in cost) s.res[r] -= cost[r]; };
  const scale = (cost, k) => { const o = {}; for (const r in cost) o[r] = Math.ceil(cost[r] * k); return o; };
  const countOf = (s, type) => s.buildings.reduce((n, b) => n + (b.type === type), 0);
  const isOpen = (s, region) => s.regions.includes(region);

  // ---------- caps & multipliers ----------
  function levelCap(s) { let c = 1; for (const id in s.upgrades) { const e = U[id] && U[id].effect; if (e && e.cap) c = Math.max(c, e.cap); } return c; }
  function multipliers(s) {
    let all = 1 + s.echoes * ECHO_BONUS, click = 1, clickPct = 0, search = 0;
    const res = {}; RES.forEach(r => res[r.id] = 1);
    const apply = e => {
      if (!e) return;
      if (e.all) all *= e.all; if (e.click) click *= e.click; if (e.clickPct) clickPct += e.clickPct; if (e.search) search = Math.max(search, e.search);
      if (e.res) for (const r in e.res) res[r] *= e.res[r];
    };
    for (const id in s.upgrades) apply(U[id] && U[id].effect);
    for (const id in s.research) apply(R[id] && R[id].effect);
    for (const id in s.eggs) { const b = EG[id] && EG[id].bonus; if (!b) continue; if (b.all) all *= b.all; if (b.res) res[b.res] *= b.mult; }
    let huts = 0; s.buildings.forEach(b => { if (B[b.type].global) huts += b.lvl; });
    return { all: all * (1 + 0.005 * huts), click: click * (1 + s.echoes * ECHO_BONUS), clickPct, search, res };
  }
  function buildingRate(s, b, m) {
    const def = B[b.type]; if (!def.prod) return {};
    m = m || multipliers(s);
    const region = W.regionAt(b.x, b.z), k = b.lvl * (def.bonusIn && region === def.bonusIn ? 2 : 1), out = {};
    for (const r in def.prod) out[r] = def.prod[r] * k * m.all * m.res[r];
    return out;
  }
  function rates(s) {
    const m = multipliers(s), out = {}; RES.forEach(r => out[r.id] = 0);
    s.buildings.forEach(b => { const br = buildingRate(s, b, m); for (const r in br) out[r] += br[r]; });
    return out;
  }
  function clickGain(s, resId) { const m = multipliers(s); return m.click + rates(s)[resId] * m.clickPct; }

  // ---------- availability ----------
  const upgradeAvailable = (s, u) => !s.upgrades[u.id] && (u.req || []).every(r => s.upgrades[r]);
  const researchAvailable = (s, r) => !s.research[r.id] && (r.req || []).every(q => s.research[q]);
  function researchBlocked(s, r) { // why it can't be bought even if affordable
    if (r.kind === 'repair' && !s.parts[r.part]) return 'part';
    return null;
  }
  function buildingUnlocked(s, def) { return !def.req || !!s.upgrades[def.req] || !!s.research[def.req]; }
  function buildingRegionOpen(s, def) { return !def.regions || def.regions.some(r => isOpen(s, r)); }
  function buildCost(s, type) { const def = B[type]; return scale(def.cost, Math.pow(BUILD_GROWTH, countOf(s, type))); }
  function levelCost(s, b) { return scale(B[b.type].cost, LEVEL_BASE * Math.pow(LEVEL_GROWTH, b.lvl - 1)); }

  // ---------- placement ----------
  function footprint(type, rot) { const [w, d] = B[type].foot; return rot % 2 ? [d, w] : [w, d]; }
  function occupied(s, exceptId) {
    const occ = new Set();
    s.buildings.forEach(b => { if (b.id === exceptId) return; const [w, d] = footprint(b.type, b.rot); for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) occ.add((b.x + i) + ',' + (b.z + j)); });
    return occ;
  }
  function canPlace(s, type, x, z, rot, exceptId) {
    const def = B[type], [w, d] = footprint(type, rot), occ = occupied(s, exceptId);
    for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) {
      const cx = x + i, cz = z + j, reg = W.regionAt(cx, cz);
      if (!reg || !isOpen(s, reg) || !W.buildable(cx, cz) || occ.has(cx + ',' + cz)) return false;
      if (def.regions && !def.regions.includes(reg)) return false;
    }
    return true;
  }
  function findSpot(s, type, near) {
    const def = B[type]; let best = null, bd = 1e9;
    const regs = def.regions ? def.regions.filter(r => isOpen(s, r)) : s.regions;
    const c = near || (def.regions ? REG[regs[0]].seed : [2, 5]);
    for (let r = 0; r < 40 && !best; r += 2) {
      for (let x = c[0] - r; x <= c[0] + r; x++) for (let z = c[1] - r; z <= c[1] + r; z++) for (let rot = 0; rot < 2; rot++) {
        if (!canPlace(s, type, x, z, rot)) continue;
        const d = Math.hypot(x - c[0], z - c[1]); if (d < bd) { bd = d; best = { x, z, rot }; }
      }
    }
    return best;
  }

  // ---------- actions ----------
  function gain(s, r, amt) { s.res[r] += amt; s.total[r] += amt; }
  function click(s, resId) { const g = clickGain(s, resId); gain(s, resId, g); s.clicks++; return g; }
  function build(s, type, spot) {
    const def = B[type]; if (!def || !buildingUnlocked(s, def) || !buildingRegionOpen(s, def)) return null;
    const cost = buildCost(s, type); if (!canAfford(s, cost)) return null;
    if (spot && !canPlace(s, type, spot.x, spot.z, spot.rot)) return null;
    pay(s, cost);
    const b = { id: s.nextId++, type, x: spot ? spot.x : 0, z: spot ? spot.z : 0, rot: spot ? spot.rot : 0, lvl: 1, placed: !!spot };
    s.buildings.push(b); s.built = s.buildings.length; s.maxLevel = Math.max(s.maxLevel, 1);
    return b;
  }
  function levelUp(s, id) {
    const b = s.buildings.find(x => x.id === id); if (!b || b.lvl >= levelCap(s)) return false;
    const cost = levelCost(s, b); if (!canAfford(s, cost)) return false;
    pay(s, cost); b.lvl++; s.maxLevel = Math.max(s.maxLevel, b.lvl); return true;
  }
  function move(s, id, spot) { const b = s.buildings.find(x => x.id === id); if (!b || !canPlace(s, b.type, spot.x, spot.z, spot.rot, id)) return false; Object.assign(b, spot, { placed: true }); return true; }
  function demolish(s, id) { // refund half of the building price
    const i = s.buildings.findIndex(x => x.id === id); if (i < 0) return false;
    const b = s.buildings[i]; s.buildings.splice(i, 1); s.built = s.buildings.length;
    const refund = scale(B[b.type].cost, 0.5 * Math.pow(BUILD_GROWTH, countOf(s, b.type))); for (const r in refund) s.res[r] += refund[r];
    return true;
  }
  function buyUpgrade(s, id) { const u = U[id]; if (!u || !upgradeAvailable(s, u) || !canAfford(s, u.cost)) return false; pay(s, u.cost); s.upgrades[id] = true; return true; }
  function buyResearch(s, id) {
    const r = R[id]; if (!r || !researchAvailable(s, r) || researchBlocked(s, r) || !canAfford(s, r.cost)) return false;
    pay(s, r.cost); s.research[id] = true; return true;
  }

  // ---------- exploration ----------
  // what can be found right now (objects exist in the world and react to clicks)
  function clueActive(s, i) { return !s.clues[i] && !!s.research['page' + (i + 1)] && isOpen(s, CHAIN[i].clue.in); }
  function partActive(s, i) { return !s.parts[CHAIN[i].part.id] && isOpen(s, CHAIN[i].region); }
  function eggActive(s, i) { return !s.eggs[EGGS[i].id] && isOpen(s, EGGS[i].in); }
  function findClue(s, i) { if (!clueActive(s, i)) return false; s.clues[i] = true; s.known[i] = true; const reg = CHAIN[i].region; if (!isOpen(s, reg)) s.regions.push(reg); return true; }
  function findPart(s, i) { if (!partActive(s, i)) return false; s.parts[CHAIN[i].part.id] = true; return true; }
  function findEgg(s, i) { if (!eggActive(s, i)) return false; s.eggs[EGGS[i].id] = true; return true; }

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

  // ---------- time loop ----------
  function echoesFromLoop(s) { return Math.max(1, Math.floor(Math.sqrt(s.total.ideas / 5e7))); }
  function finishLoop(s) {
    const gained = echoesFromLoop(s);
    const ns = newState({ echoes: s.echoes + gained, loops: s.loops + 1, settings: s.settings, playTime: s.playTime, clicks: s.clicks });
    ns.story = Object.assign({}, s.story); ns.ach = Object.assign({}, s.ach); ns.eggs = Object.assign({}, s.eggs); ns.known = Object.assign({}, s.known);
    return { state: ns, gained };
  }

  const api = { BUILD_GROWTH, LEVEL_GROWTH, ECHO_BONUS, newState, canAfford, countOf, isOpen, levelCap, multipliers, buildingRate, rates, clickGain,
    upgradeAvailable, researchAvailable, researchBlocked, buildingUnlocked, buildingRegionOpen, buildCost, levelCost,
    footprint, canPlace, findSpot, click, build, levelUp, move, demolish, buyUpgrade, buyResearch,
    clueActive, partActive, eggActive, findClue, findPart, findEgg, tick, offline, newStory, newAch, echoesFromLoop, finishLoop,
    B, U, R, REG, EG, PART_CHAIN };
  root.Engine = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
