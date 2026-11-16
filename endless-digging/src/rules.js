// Game rules shared by the game and the multiplayer server: tools, the research tree, upgrade effects,
// what a scoop of ground is worth. Nothing here touches the screen, so the server can check every dig and purchase.
'use strict';
(function (root) {
  const TOOLS = {
    spoon: { r: 0.045, time: 0.5, reach: 2.3, parts: 4, size: 0.3 },
    scoop: { r: 0.065, time: 0.5, reach: 2.3, parts: 5, size: 0.4 },
    trowel: { r: 0.085, time: 0.55, reach: 2.4, parts: 6, size: 0.5 },
    shovel: { r: 0.12, time: 0.65, reach: 2.6, parts: 9, size: 0.75 },
    pick: { r: 0.08, time: 0.7, reach: 2.6, parts: 7, size: 0.5 }   // breaks rock (limestone, granite, basalt, ore)
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
    { id: 'pick', row: 0, col: 6, icon: 'pick', p: 350, req: ['longhandle'] },
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
    { id: 'pump', row: 4, col: 7, icon: 'pump', p: 160, req: ['auto1'] },   // keeps pits dry below the water table
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
  const RIG_L = 1.0;                                     // a rig brings up 1 L per turn: every 3 s by hand crank, every 1.5 s with a motor
  // every stroke takes about the same bite: the dig point moves into the ground until this share of the scoop sphere is solid
  const BITE = 0.5;
  // 96 fixed sample points inside a unit sphere (no randomness: the server gets the same answer as the game)
  const PTS = (() => { const a = [], n = 96, g = Math.PI * (3 - Math.sqrt(5)); for (let i = 0; i < n; i++) { const y = 1 - (i + 0.5) / n * 2, r = Math.sqrt(1 - y * y), rr = Math.cbrt((i * 0.618034 % 1) * 0.92 + 0.08); a.push([Math.cos(g * i) * r * rr, y * rr, Math.sin(g * i) * r * rr]); } return a; })();
  // what the ground is made of; price per litre follows rarity in the Earth's crust (deposits.js)
  // 0 topsoil, 1 clay, 2 granite, 3 magnetite quartzite (~30 % Fe), 4 rich hematite ore (~60 % Fe: twice the iron)
  const RESP = (root.DepositData && root.DepositData.res) || {}, FE = (RESP.fe && RESP.fe.price) || 0.29;
  // 5 sand and gravel, 6 limestone, 7 basalt, 8 coal
  const MATS = [{ p: 0.10 }, { p: 0.14 }, { p: (RESP.stone && RESP.stone.price) || 0.14 }, { p: FE, ore: true }, { p: FE * 2, ore: true },
    { p: 0.11 }, { p: 0.16 }, { p: 0.2 }, { p: (RESP.coal && RESP.coal.price) || 0.6, ore: true }];
  const NM = MATS.length, HARD = [1, 1, 6, 2.5, 2, 0.8, 3, 6, 2];
  // the share of a bite that needs a pickaxe
  function hardShare(per) { let h = 0, n = 0; for (let i = 0; i < per.length; i++) { n += per[i]; if (HARD[i] >= 3) h += per[i]; } return n ? h / n : 0; }
  // upgrade effects for a set of owned nodes: levels(has)(id)
  function levels(has, incomeMul) {
    const lvl = id => id === 'tool' ? (has('shovel') ? 'shovel' : has('trowel') ? 'trowel' : has('scoop') ? 'scoop' : 'spoon')
    : id === 'speed' ? (has('arms4') ? 0.52 : has('arms3') ? 0.61 : has('arms2') ? 0.72 : has('arms1') ? 0.85 : 1)
      : id === 'scale' ? (has('scales3') ? 2 : has('scales2') ? 1.5 : has('scales1') ? 1.25 : 1) * ((incomeMul && incomeMul()) || 1)
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
    return lvl;
  }
  // the share of a sphere that is solid ground, and what it is made of
  function bite(W, c, r, per) {
    let n = 0; if (per) per.fill(0);
    for (const q of PTS) { const x = c[0] + q[0] * r, y = c[1] + q[1] * r, z = c[2] + q[2] * r; if (W.solid(x, y, z) > 0) { n++; if (per) per[W.materialAt(x, y, z)]++; } }
    return n / PTS.length;
  }
  // a scoop of radius r at c (before it is dug): litres per material and the money it brings
  function scoop(W, c, r, lvl) {
    const per = new Array(NM).fill(0), f = bite(W, c, r, per), solidN = per.reduce((a, b) => a + b, 0);
    const litres = f * 4 / 3 * Math.PI * r * r * r * 1000, k = solidN ? litres / solidN : 0, by = per.map(v => v * k);
    let got = 0; for (let i = 0; i < NM; i++) got += by[i] * MATS[i].p * (MATS[i].ore ? lvl('ore') : 1);
    let main = 0; for (let i = 1; i < NM; i++) if (per[i] > per[main]) main = i;
    return { litres, by, got: got * lvl('scale'), main, per, k };
  }
  const canBuy = (id, has, money) => { const n = NODES.find(x => x.id === id); return !!n && !n.soon && !n.root && !has(id) && (n.req || []).every(has) && money >= n.p ? n : null; };
  // ---------- finds: what can turn up in the ground (shape and colour are for the museum icons) ----------
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
  // one roll for a bite of `litres` at a depth, in a main material, at a place; rnd: () => 0..1
  function rollFind(depth, main, lat, lon, litres, rnd) {
    for (const f of FINDS) {
      if (depth < f.d[0] || depth > f.d[1]) continue;
      if (f.mats && !f.mats.includes(main)) continue;
      if (f.where && (lat < f.where[0] || lat > f.where[1] || lon < f.where[2] || lon > f.where[3])) continue;
      if (rnd() < 1 - Math.pow(1 - f.per, litres)) return f;
    }
    return null;
  }
  root.Rules = { FINDS, rollFind, TOOLS, NODES, RIG_L, BITE, PTS, MATS, NM, HARD, hardShare, levels, bite, scoop, canBuy };
})(typeof window !== 'undefined' ? window : globalThis);
