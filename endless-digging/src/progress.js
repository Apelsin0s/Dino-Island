// Progress: everything you collect and achieve besides money — finds and the museum, orders, achievements, records,
// licences for other countries, and starting over on a new planet. One book (J) shows it all.
// The game calls Progress.init(api) once, onDig() after every bite, tick() every frame.
'use strict';
(function (root) {
  const P = {};
  let G = null, S = null, L = null;   // game api, state, strings

  // ---------- finds ----------
  // shape: icon; mats: materials it hides in (any if empty); d: depth range (m); per: chance per litre; v: value ($);
  // where: [latMin, latMax, lonMin, lonMax] (anywhere if missing)
  const FINDS = [
    { id: 'horseshoe', shape: 'shoe', c: '#8a8f96', d: [0.2, 1.6], per: 1 / 260, v: 6 },
    { id: 'coin', shape: 'coin', c: '#c9a24a', d: [0.2, 3], per: 1 / 300, v: 12 },
    { id: 'shard', shape: 'pot', c: '#c0703a', d: [0.3, 4], per: 1 / 220, v: 4 },
    { id: 'pipe', shape: 'pipe', c: '#6b4a2a', d: [0.3, 2.2], per: 1 / 600, v: 40, where: [44, 53, 22, 41] },
    { id: 'arrow', shape: 'arrow', c: '#8f6a3a', d: [0.5, 3], per: 1 / 700, v: 25, where: [44, 53, 22, 41] },
    { id: 'figurine', shape: 'figure', c: '#d08a5a', d: [0.5, 3], per: 1 / 2500, v: 260, where: [47.5, 50.5, 28.5, 32.5] },
    { id: 'amphora', shape: 'amphora', c: '#b85f30', d: [1, 5], per: 1 / 1800, v: 90, where: [40, 47.6, 22, 42] },
    { id: 'romancoin', shape: 'coin', c: '#d8b860', d: [0.4, 3], per: 1 / 1600, v: 80, where: [36, 54, -10, 30] },
    { id: 'handaxe', shape: 'axe', c: '#7d7f86', d: [2, 12], mats: [1, 5], per: 1 / 2600, v: 200 },
    { id: 'tusk', shape: 'tusk', c: '#efe4c8', d: [3, 16], mats: [1, 5], per: 1 / 3000, v: 320 },
    { id: 'amber', shape: 'drop', c: '#f0a020', d: [1, 12], mats: [5, 1], per: 1 / 1400, v: 150, where: [50, 57, 18, 30] },
    { id: 'nugget', shape: 'nugget', c: '#ffc928', d: [1, 20], mats: [5], per: 1 / 4000, v: 420 },
    { id: 'ammonite', shape: 'shell', c: '#c9b58f', d: [4, 80], mats: [6], per: 1 / 500, v: 45 },
    { id: 'fish', shape: 'fish', c: '#9a8a70', d: [6, 80], mats: [6], per: 1 / 1800, v: 110 },
    { id: 'trilobite', shape: 'bug', c: '#6f6a62', d: [10, 120], mats: [6], per: 1 / 2600, v: 160 },
    { id: 'dino', shape: 'bone', c: '#e8dcc0', d: [5, 60], mats: [6, 1], per: 1 / 9000, v: 900 },
    { id: 'fern', shape: 'leaf', c: '#3b4a34', d: [8, 200], mats: [8], per: 1 / 300, v: 70 },
    { id: 'quartz', shape: 'crystal', c: '#e6eef6', d: [10, 999], mats: [2], per: 1 / 600, v: 50 },
    { id: 'garnet', shape: 'gem', c: '#a3203a', d: [12, 999], mats: [2], per: 1 / 2500, v: 140 },
    { id: 'geode', shape: 'geode', c: '#8a63c9', d: [10, 999], mats: [7], per: 1 / 1200, v: 95 },
    { id: 'obsidian', shape: 'gem', c: '#141416', d: [1, 999], mats: [7], per: 1 / 900, v: 60 },
    { id: 'magnetite', shape: 'crystal', c: '#2a2e36', d: [2, 999], mats: [3, 4], per: 1 / 700, v: 35 },
    { id: 'meteorite', shape: 'rock', c: '#4a3a34', d: [0.5, 12], per: 1 / 25000, v: 1500 },
    { id: 'diamond', shape: 'gem', c: '#cfefff', d: [30, 999], mats: [2, 7], per: 1 / 30000, v: 3000 }
  ];
  const SHAPES = {
    coin: '<circle cx="32" cy="32" r="20" fill="C" stroke="#0004" stroke-width="3"/><circle cx="32" cy="32" r="12" fill="none" stroke="#0003" stroke-width="3"/>',
    shoe: '<path d="M14 50 C10 20 54 20 50 50 L42 50 C44 30 20 30 22 50 Z" fill="C" stroke="#0004" stroke-width="3"/>',
    pot: '<path d="M12 22 L52 18 L46 46 L18 50 Z" fill="C" stroke="#0004" stroke-width="3"/><path d="M18 30 L46 27" stroke="#0003" stroke-width="3"/>',
    pipe: '<path d="M10 40 L36 34" stroke="C" stroke-width="7" stroke-linecap="round"/><path d="M36 24 L52 24 L50 46 L38 46 Z" fill="C" stroke="#0004" stroke-width="3"/>',
    arrow: '<path d="M32 8 L44 34 L32 30 L20 34 Z" fill="C" stroke="#0004" stroke-width="3"/><path d="M32 30 L32 56" stroke="#7a5a32" stroke-width="5"/>',
    figure: '<circle cx="32" cy="16" r="7" fill="C"/><path d="M22 26 C32 20 42 26 40 40 L44 56 L20 56 L24 40 C22 34 22 30 22 26 Z" fill="C" stroke="#0004" stroke-width="3"/>',
    amphora: '<path d="M26 8 L38 8 L38 16 C50 22 50 44 32 56 C14 44 14 22 26 16 Z" fill="C" stroke="#0004" stroke-width="3"/><path d="M26 16 C18 16 18 26 24 26 M38 16 C46 16 46 26 40 26" stroke="C" stroke-width="3" fill="none"/>',
    axe: '<path d="M32 6 C46 18 48 40 32 58 C16 40 18 18 32 6 Z" fill="C" stroke="#0004" stroke-width="3"/>',
    tusk: '<path d="M10 52 C20 20 44 10 56 14 C42 18 28 32 20 56 Z" fill="C" stroke="#0004" stroke-width="3"/>',
    drop: '<path d="M32 8 C44 26 50 34 50 42 C50 52 42 58 32 58 C22 58 14 52 14 42 C14 34 20 26 32 8 Z" fill="C" stroke="#0004" stroke-width="3"/>',
    nugget: '<path d="M14 36 L22 18 L40 14 L52 26 L48 46 L28 52 Z" fill="C" stroke="#0004" stroke-width="3"/>',
    shell: '<circle cx="32" cy="32" r="22" fill="C" stroke="#0004" stroke-width="3"/><path d="M32 32 C32 24 42 24 42 32 C42 42 26 44 24 32 C22 18 46 14 50 30" stroke="#0005" stroke-width="3" fill="none"/>',
    fish: '<path d="M8 32 C20 16 40 16 50 32 C40 48 20 48 8 32 Z M50 32 L58 22 L58 42 Z" fill="C" stroke="#0004" stroke-width="3"/>',
    bug: '<ellipse cx="32" cy="32" rx="16" ry="24" fill="C" stroke="#0004" stroke-width="3"/><path d="M18 24 L46 24 M18 32 L46 32 M18 40 L46 40" stroke="#0004" stroke-width="3"/>',
    bone: '<path d="M18 46 L46 18" stroke="C" stroke-width="10" stroke-linecap="round"/><circle cx="14" cy="44" r="7" fill="C"/><circle cx="20" cy="50" r="7" fill="C"/><circle cx="44" cy="14" r="7" fill="C"/><circle cx="50" cy="20" r="7" fill="C"/>',
    leaf: '<path d="M32 58 L32 10" stroke="C" stroke-width="3"/><path d="M32 18 L20 12 M32 18 L44 12 M32 28 L18 22 M32 28 L46 22 M32 38 L16 32 M32 38 L48 32 M32 48 L18 44 M32 48 L46 44" stroke="C" stroke-width="5" stroke-linecap="round"/>',
    crystal: '<path d="M32 6 L44 22 L40 56 L24 56 L20 22 Z" fill="C" stroke="#0004" stroke-width="3"/><path d="M32 6 L32 56" stroke="#fff6" stroke-width="2"/>',
    gem: '<path d="M14 24 L24 12 L40 12 L50 24 L32 54 Z" fill="C" stroke="#0004" stroke-width="3"/><path d="M14 24 L50 24 M24 12 L32 24 L40 12" stroke="#fff5" stroke-width="2" fill="none"/>',
    geode: '<circle cx="32" cy="32" r="22" fill="#8c8a86" stroke="#0004" stroke-width="3"/><circle cx="32" cy="32" r="14" fill="C"/><path d="M24 30 L32 22 L40 30 L32 40 Z" fill="#fff6"/>',
    rock: '<path d="M12 34 L20 16 L42 12 L54 28 L46 50 L22 52 Z" fill="C" stroke="#0004" stroke-width="3"/><circle cx="26" cy="30" r="3" fill="#0003"/><circle cx="40" cy="38" r="4" fill="#0003"/>'
  };
  const findIcon = (f, have) => `<svg viewBox="0 0 64 64" width="44" height="44">${SHAPES[f.shape].replace(/"C"/g, '"' + (have ? f.c : '#c9d0d6') + '"')}</svg>`;

  // ---------- achievements ----------
  // test(s, G) -> true when earned; stat shown in the records tab where it makes sense
  const ACH = [
    ['firstDig', s => s.st.strokes >= 1], ['litre', s => s.st.litres >= 1], ['bucket', s => s.st.litres >= 100], ['cube', s => s.st.litres >= 1000],
    ['cube10', s => s.st.litres >= 10000], ['cube100', s => s.st.litres >= 100000], ['deep2', s => s.st.maxDepth >= 2], ['deep5', s => s.st.maxDepth >= 5],
    ['deep10', s => s.st.maxDepth >= 10], ['deep20', s => s.st.maxDepth >= 20], ['deep50', s => s.st.maxDepth >= 50], ['deep100', s => s.st.maxDepth >= 100],
    ['ore', s => s.st.ore > 0], ['coal', s => (s.st.mat[8] || 0) > 0], ['rock', s => (s.st.mat[2] || 0) + (s.st.mat[6] || 0) + (s.st.mat[7] || 0) > 0],
    ['shovel', (s, g) => g.has('shovel')], ['pick', (s, g) => g.has('pick')], ['machine', (s, g) => g.has('exMini')], ['shaft', (s, g) => g.has('shaft')],
    ['find1', s => Object.keys(s.finds).length >= 1], ['find10', s => Object.keys(s.finds).length >= 10], ['findAll', s => Object.keys(s.finds).length >= FINDS.length],
    ['money100', s => s.st.earned >= 100], ['money10k', s => s.st.earned >= 1e4], ['money1m', s => s.st.earned >= 1e6],
    ['order1', s => s.st.orders >= 1], ['order10', s => s.st.orders >= 10], ['order50', s => s.st.orders >= 50],
    ['licence', s => s.st.licences >= 1], ['swim', s => s.st.swam], ['walk10', s => s.st.walked >= 10000], ['planet', s => s.planets >= 1]
  ].map(([id, test]) => ({ id, test }));

  // ---------- state ----------
  const KEY = 'endlessdigging.progress';   // kept apart from the world save: a new planet keeps the museum and achievements
  const fresh = () => ({ v: 1, finds: {}, sold: 0, ach: {}, orders: [], st: { strokes: 0, litres: 0, maxDepth: 0, ore: 0, earned: 0, orders: 0, licences: 0, swam: false, walked: 0, time: 0, mat: {} }, planets: 0, seed: Math.floor(Math.random() * 1e9) });
  function load() { try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.v === 1) { const f = fresh(); return Object.assign(f, s, { st: Object.assign(f.st, s.st) }); } } catch (e) {} return fresh(); }
  let dirty = false, saveT = 0;
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} dirty = false; }

  // ---------- country of a place (for licences) ----------
  let grid = null;
  function buildGrid() {
    grid = new Map();
    for (const c of root.Countries || []) {
      let x0 = 999, x1 = -999, y0 = 999, y1 = -999;
      for (const ring of c.r) for (const [lo, la] of ring) { x0 = Math.min(x0, lo); x1 = Math.max(x1, lo); y0 = Math.min(y0, la); y1 = Math.max(y1, la); }
      c.box = [x0, x1, y0, y1];
      for (let y = Math.floor(y0); y <= Math.floor(y1); y++) for (let x = Math.floor(x0); x <= Math.floor(x1); x++) { const k = y * 1000 + x; let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(c); }
    }
  }
  function inRing(ring, lo, la) { let ins = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = ring[i], b = ring[j]; if ((a[1] > la) !== (b[1] > la) && lo < (b[0] - a[0]) * (la - a[1]) / (b[1] - a[1]) + a[0]) ins = !ins; } return ins; }
  P.countryAt = function (lat, lon) {
    if (!grid) buildGrid();
    const l = grid.get(Math.floor(lat) * 1000 + Math.floor(lon)); if (!l) return null;
    for (const c of l) { if (lon < c.box[0] || lon > c.box[1] || lat < c.box[2] || lat > c.box[3]) continue; let n = 0; for (const ring of c.r) if (inRing(ring, lon, lat)) n++; if (n % 2) return c; }
    return null;
  };
  const NO_LICENCE = new Set(['RUS']);   // not for sale
  function countryArea(c) { const b = c.box; return Math.max(1000, (b[1] - b[0]) * (b[3] - b[2]) * 111 * 111 * Math.cos((b[2] + b[3]) / 2 * Math.PI / 180) * 0.55); }
  P.licencePrice = c => Math.round(4000 * Math.pow(countryArea(c) / 600000, 0.6) * Math.pow(1.7, G.pl.open.length - 1) / 10) * 10;

  // ---------- orders ----------
  function newOrder() {
    const r = Math.random(), lvl = Math.min(8, Math.floor(Math.log10(Math.max(10, S.st.earned)))), seen = Object.keys(S.st.mat).map(Number).filter(m => S.st.mat[m] > 0.5);
    if (r < 0.55 && seen.length) {
      const m = seen[Math.floor(Math.random() * seen.length)], amt = Math.round(Math.max(5, Math.pow(4, lvl - 1)) * (0.6 + Math.random()));
      return { kind: 'mat', m, need: amt, have: 0, pay: Math.max(2, Math.round(amt * G.MATS[m].p * 3 * 10) / 10) };
    }
    if (r < 0.75) { const d = Math.ceil(S.st.maxDepth + 1 + Math.random() * 3); return { kind: 'depth', need: d, have: S.st.maxDepth, pay: Math.round(4 + d * d * 1.5) }; }
    if (r < 0.88) return { kind: 'find', need: 1 + Math.floor(Math.random() * 2), have: 0, pay: 20 + lvl * 15 };
    const n = 20 + Math.floor(Math.random() * 40); return { kind: 'strokes', need: n, have: 0, pay: Math.round(n * 0.4 * (1 + lvl)) };
  }
  function fillOrders() { while (S.orders.length < 3) S.orders.push(newOrder()); }
  function progressOrders(kind, amount, m) {
    for (const o of S.orders) {
      if (o.kind !== kind || o.done) continue;
      if (kind === 'mat' && o.m !== m) continue;
      o.have = kind === 'depth' ? Math.max(o.have, amount) : o.have + amount;
      if (o.have >= o.need) { o.done = true; G.notice(L.orderDone + ' +$' + o.pay); }
    }
  }
  P.claim = function (i) {
    const o = S.orders[i]; if (!o || !o.done) return;
    if (!G.online()) G.pl.money += o.pay;   // in co-op the server keeps the money: orders give only the record there
    S.st.orders++; S.orders.splice(i, 1); fillOrders(); G.sound('coin'); dirty = true; check(); render();
  };

  // ---------- hooks ----------
  P.init = function (api) {
    G = api; L = api.L.pg || {}; S = load(); fillOrders();
    P.state = S;
    buildUI();
  };
  P.incomeMul = () => (1 + 0.5 * (S ? S.planets : 0)) * (1 + 0.01 * (S ? Object.keys(S.finds).length : 0));   // each planet +50 %, each museum piece +1 %
  P.mayDig = function (c) {
    const ll = G.W.toLatLon(c.x, c.y, c.z), country = P.countryAt(ll[0], ll[1]);
    if (!country || G.pl.open.includes(country.id) || G.admin()) return true;
    G.notice(L.needLicence.replace('{0}', G.nameOf(country))); G.sound('thud'); return false;
  };
  P.onDig = function (info) {
    if (!S) return;
    const st = S.st; st.strokes++; st.litres += info.litres; st.maxDepth = Math.max(st.maxDepth, info.depth); st.earned += info.got;
    for (let m = 0; m < info.per.length; m++) if (info.per[m]) { const l = info.per[m] * info.k; st.mat[m] = (st.mat[m] || 0) + l; progressOrders('mat', l, m); if (G.MATS[m].ore) st.ore += l; }
    progressOrders('depth', info.depth); progressOrders('strokes', 1);
    // a find? (by depth, the main material, the region)
    const ll = G.W.toLatLon(info.c.x, info.c.y, info.c.z);
    for (const f of FINDS) {
      if (info.depth < f.d[0] || info.depth > f.d[1]) continue;
      if (f.mats && !f.mats.includes(info.main)) continue;
      if (f.where && (ll[0] < f.where[0] || ll[0] > f.where[1] || ll[1] < f.where[2] || ll[1] > f.where[3])) continue;
      if (Math.random() < 1 - Math.pow(1 - f.per, info.litres)) { found(f); break; }
    }
    dirty = true; check();
  };
  function found(f) {
    const first = !S.finds[f.id];
    S.finds[f.id] = (S.finds[f.id] || 0) + 1;
    if (!first && !G.online()) { G.pl.money += f.v; S.sold += f.v; }   // a duplicate goes to the dealer
    progressOrders('find', 1);
    G.toast(findIcon(f, true), (first ? L.newFind : L.findAgain) + ': ' + (L.finds[f.id] || f.id), first ? L.toMuseum : '+$' + f.v);
    G.sound('coin');
  }
  P.tick = function (dt, info) {
    if (!S) return;
    S.st.time += dt; if (info.walked) S.st.walked += info.walked; if (info.swim && !S.st.swam) { S.st.swam = true; check(); }
    if ((saveT += dt) > 4 && dirty) { saveT = 0; save(); }
    if (Math.floor(S.st.time) % 3 === 0 && !P._t) { P._t = true; check(); } else if (Math.floor(S.st.time) % 3) P._t = false;
  };
  function check() {
    for (const a of ACH) if (!S.ach[a.id] && a.test(S, G)) { S.ach[a.id] = Date.now(); dirty = true; G.toast(achIcon(true), L.achGot, L.ach[a.id] ? L.ach[a.id][0] : a.id); if (root.Steam && root.Steam.achieve) root.Steam.achieve(a.id); }
  }
  const achIcon = on => `<svg viewBox="0 0 64 64" width="40" height="40"><path d="M20 8 L44 8 L44 26 C44 34 38 40 32 40 C26 40 20 34 20 26 Z" fill="${on ? '#f2b630' : '#c9d0d6'}" stroke="#0004" stroke-width="3"/><path d="M20 14 L10 14 C10 24 14 28 20 28 M44 14 L54 14 C54 24 50 28 44 28" stroke="${on ? '#f2b630' : '#c9d0d6'}" stroke-width="3" fill="none"/><path d="M26 54 L38 54 L36 40 L28 40 Z" fill="${on ? '#d99a1a' : '#b8c0c7'}"/></svg>`;
  P.licence = function (id) {
    const c = (root.Countries || []).find(x => x.id === id); if (!c || G.pl.open.includes(id) || NO_LICENCE.has(id)) return;
    const price = P.licencePrice(c); if (G.pl.money < price) return;
    G.pl.money -= price; G.openCountry(id); S.st.licences++; dirty = true; G.sound('coin'); check(); render();
  };
  // a new planet: start again from a spoon, keep the museum and the achievements, earn more for good
  P.canRestart = () => S.st.earned >= 1e6 || S.st.maxDepth >= 100;
  P.restart = function () { if (!P.canRestart() || G.online()) return; S.planets++; S.orders = []; S.st.maxDepth = 0; S.st.earned = 0; fillOrders(); save(); G.newPlanet(); };

  // ---------- the book (J) ----------
  let el = null, tab = 'orders', open = false;
  const TABS = ['orders', 'museum', 'ach', 'records', 'licences', 'planet'];
  // other modules add their own pages: P.addTab(id, { label(), render(), bind(el) })
  const EXT = {};
  P.addTab = (id, t, first) => { EXT[id] = t; if (first) TABS.unshift(id); else TABS.push(id); };
  function buildUI() {
    el = document.createElement('div'); el.id = 'book'; el.hidden = true; document.body.appendChild(el);
    const b = document.createElement('button'); b.id = 'bBook'; b.className = 'shopBtn bookBtn'; b.innerHTML = '<b>J</b>' + (L.book || 'Book');
    b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); G.toggleBook(true); }); document.getElementById('hud').appendChild(b);
    const t = document.createElement('div'); t.id = 'toasts'; document.body.appendChild(t);
  }
  P.toast = function (icon, title, sub) {
    const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = `<div class="ti">${icon}</div><div><b></b><span></span></div>`;
    t.querySelector('b').textContent = title; t.querySelector('span').textContent = sub || '';
    document.getElementById('toasts').appendChild(t); setTimeout(() => t.classList.add('out'), 4200); setTimeout(() => t.remove(), 5000);
  };
  P.show = function (on, which) { open = on; if (which) tab = which; el.hidden = !on; if (on) render(); else for (const k in EXT) if (EXT[k].close) EXT[k].close(); };
  P.isOpen = () => open;
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = v => v >= 1e6 ? (v / 1e6).toFixed(2) + "M" : v >= 1e4 ? Math.round(v).toLocaleString() : Number.isInteger(v) ? String(v) : v.toFixed(v < 10 ? 2 : 0);
  function body() {
    if (EXT[tab]) return EXT[tab].render();
    const st = S.st;
    if (tab === 'orders') return `<p class="bsub">${L.ordersSub}</p>` + S.orders.map((o, i) => {
      const what = o.kind === 'mat' ? L.oMat.replace('{0}', fmt(o.need)).replace('{1}', G.L.mat[o.m]) : o.kind === 'depth' ? L.oDepth.replace('{0}', o.need) : o.kind === 'find' ? L.oFind.replace('{0}', o.need) : L.oStrokes.replace('{0}', o.need);
      const k = Math.min(1, o.have / o.need);
      return `<div class="order${o.done ? ' done' : ''}"><div class="otext">${esc(what)}</div><div class="obar"><b style="width:${(k * 100).toFixed(0)}%"></b></div><div class="opay">$${o.pay}</div>${o.done ? `<button data-claim="${i}">${L.claim}</button>` : ''}</div>`;
    }).join('') + (G.online() ? `<p class="bsub">${L.coopNote}</p>` : '');
    if (tab === 'museum') { const n = Object.keys(S.finds).length; return `<p class="bsub">${L.museumSub.replace('{0}', n).replace('{1}', FINDS.length).replace('{2}', n)}</p><div class="mgrid">` + FINDS.map(f => { const have = S.finds[f.id]; return `<div class="mcard${have ? '' : ' off'}">${findIcon(f, have)}<b>${have ? esc(L.finds[f.id] || f.id) : '?'}</b><span>${have ? (have > 1 ? '×' + have + ' · ' : '') + '$' + f.v : esc(L.depthRange.replace('{0}', f.d[0]).replace('{1}', f.d[1] > 900 ? '∞' : f.d[1]))}</span></div>`; }).join('') + '</div>'; }
    if (tab === 'ach') { const n = Object.keys(S.ach).length; return `<p class="bsub">${L.achSub.replace('{0}', n).replace('{1}', ACH.length)}</p><div class="agrid">` + ACH.map(a => { const on = S.ach[a.id], t = L.ach[a.id] || [a.id, '']; return `<div class="acard${on ? '' : ' off'}">${achIcon(on)}<div><b>${esc(t[0])}</b><span>${esc(t[1])}</span></div></div>`; }).join('') + '</div>'; }
    if (tab === 'records') {
      const R = L.rec, rows = [[R.litres, fmt(st.litres) + ' ' + G.L.l], [R.depth, st.maxDepth.toFixed(1) + ' ' + G.L.m], [R.earned, '$' + fmt(st.earned)], [R.strokes, fmt(st.strokes)], [R.finds, Object.keys(S.finds).length + ' / ' + FINDS.length], [R.orders, st.orders], [R.walked, (st.walked / 1000).toFixed(1) + ' ' + G.L.km], [R.time, Math.floor(st.time / 3600) + ':' + String(Math.floor(st.time / 60) % 60).padStart(2, '0')], [R.planets, S.planets], [R.licences, G.pl.open.length]];
      const mats = Object.keys(st.mat).map(Number).sort((a, b) => a - b).map(m => [G.L.mat[m], fmt(st.mat[m]) + ' ' + G.L.l]);
      return `<table class="rec">${rows.concat(mats).map(r => `<tr><td>${esc(r[0])}</td><td>${esc(String(r[1]))}</td></tr>`).join('')}</table>`;
    }
    if (tab === 'licences') {
      const ll = G.W.toLatLon(G.pl.pos.x, G.pl.pos.y, G.pl.pos.z), d = c => Math.hypot(c.c[1] - ll[0], (c.c[0] - ll[1]) * Math.cos(ll[0] * Math.PI / 180));
      if (!grid) buildGrid();
      const list = (root.Countries || []).filter(c => !NO_LICENCE.has(c.id)).sort((a, b) => d(a) - d(b)).slice(0, 40);
      return `<p class="bsub">${L.licSub}</p><div class="lic">` + list.map(c => { const own = G.pl.open.includes(c.id), pr = own ? 0 : P.licencePrice(c); return `<div class="lrow${own ? ' own' : ''}"><b>${esc(G.nameOf(c))}</b><span>${Math.round(d(c) * 111)} ${G.L.km}</span>${own ? `<button data-go="${c.id}">${L.travel}</button>` : `<button data-lic="${c.id}"${G.pl.money < pr ? ' disabled' : ''}>$${fmt(pr)}</button>`}</div>`; }).join('') + '</div>';
    }
    if (tab === 'planet') return `<div class="planet"><p>${L.planetText.replace('{0}', S.planets).replace('{1}', Math.round((P.incomeMul() - 1) * 100))}</p><p class="bsub">${L.planetNeed}</p>${G.online() ? `<p class="bsub">${L.planetCoop}</p>` : `<button class="big" data-planet="1"${P.canRestart() ? '' : ' disabled'}>${L.planetGo}</button>`}</div>`;
    return '';
  }
  function render() {
    if (!el || !open) return;
    el.innerHTML = `<div class="bookCard"><div class="bookHead"><h2>${L.book || 'Book'}</h2><div class="btabs">${TABS.map(t => `<button class="btab${t === tab ? ' on' : ''}" data-tab="${t}">${EXT[t] ? EXT[t].label() : L.tabs[t]}</button>`).join('')}</div><div class="shopMoney">$${G.pl.money.toFixed(2)}</div><button class="bclose" aria-label="close">✕</button></div><div class="bookBody">${body()}</div></div>`;
    el.querySelector('.bclose').onclick = () => G.toggleBook(false);
    for (const b of el.querySelectorAll('[data-tab]')) b.onclick = () => { tab = b.dataset.tab; render(); };
    for (const b of el.querySelectorAll('[data-claim]')) b.onclick = () => P.claim(+b.dataset.claim);
    for (const b of el.querySelectorAll('[data-lic]')) b.onclick = () => P.licence(b.dataset.lic);
    for (const b of el.querySelectorAll('[data-go]')) b.onclick = () => { const c = root.Countries.find(x => x.id === b.dataset.go); G.toggleBook(false); G.travel(c.c[1], c.c[0]); };
    if (EXT[tab] && EXT[tab].bind) EXT[tab].bind(el);
    const pb = el.querySelector('[data-planet]'); if (pb) pb.onclick = () => { if (pb.dataset.armed) P.restart(); else { pb.dataset.armed = 1; pb.textContent = L.planetSure; } };
  }
  P.render = render; P.tab = () => tab;
  P.level = () => { const st = S.st, xp = st.strokes + Object.keys(S.ach).length * 200 + Object.keys(S.finds).length * 60 + st.orders * 120 + Math.log10(1 + st.earned) * 300; return { level: 1 + Math.floor(Math.sqrt(xp / 120)), xp }; };
  P.FINDS = FINDS; P.ACH = ACH;
  root.Progress = P;
})(window);
