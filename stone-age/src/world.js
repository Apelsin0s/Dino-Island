// Island layout shared by the engine and the 3D scene: which region every cell belongs to,
// where the sea and the river are, and which cells are reserved for the machine, clues, parts and eggs.
'use strict';
(function (root) {
  const D = root.GAME_DATA;
  const SIZE = 80, MIN = -40, MAX = 39;
  const MACHINE = { x: 1, z: 1, w: 3, d: 3 };

  const regionIndex = Object.fromEntries(D.REGIONS.map((r, i) => [r.id, i]));
  function islandRadius(x, z) { const a = Math.atan2(z, x); return 36.5 + 2.6 * Math.sin(3 * a + 0.6) + 1.8 * Math.cos(5 * a + 1.3) + 1.1 * Math.sin(9 * a); }
  function wobble(x, z) { return Math.sin(x * 0.31 + z * 0.17) * 2.2 + Math.cos(z * 0.27 - x * 0.11) * 2.0; }
  function riverZ(x) { return -15.5 + Math.sin(x / 6) * 2.4; }

  // cell → region id (null = sea)
  const cells = new Map();
  for (let x = MIN; x <= MAX; x++) for (let z = MIN; z <= MAX; z++) {
    const cx = x + 0.5, cz = z + 0.5;
    if (Math.hypot(cx, cz) > islandRadius(cx, cz)) continue;
    let best = null, bd = 1e9;
    D.REGIONS.forEach(r => { const d = Math.hypot(cx - r.seed[0], cz - r.seed[1]) + wobble(cx + r.seed[0], cz - r.seed[1]) * 0.5; if (d < bd) { bd = d; best = r.id; } });
    cells.set(x + ',' + z, best);
  }
  const regionAt = (x, z) => cells.get(x + ',' + z) || null;
  const isSea = (x, z) => !cells.has(x + ',' + z);
  // river runs west→east through the valley and the forest edge
  function isRiver(x, z) { const r = regionAt(x, z); return (r === 'river' || r === 'forest' || r === 'hills') && Math.abs(z + 0.5 - riverZ(x + 0.5)) < 1.1; }
  function isCoast(x, z) { for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) if (isSea(x + i, z + j)) return true; return false; }

  // special objects that sit on single cells
  const SPECIAL = [];
  D.CHAIN.forEach((c, i) => { SPECIAL.push({ type: 'clue', idx: i, at: c.clue.at, region: c.clue.in, kind: c.clue.kind }); SPECIAL.push({ type: 'part', idx: i, at: c.part.at, region: c.region, kind: 'part' }); });
  D.EGGS.forEach((e, i) => SPECIAL.push({ type: 'egg', idx: i, at: e.at, region: e.in, kind: e.kind }));
  const reserved = new Set(SPECIAL.map(s => s.at[0] + ',' + s.at[1]));
  for (let i = 0; i < MACHINE.w; i++) for (let j = 0; j < MACHINE.d; j++) reserved.add((MACHINE.x + i) + ',' + (MACHINE.z + j));

  function buildable(x, z) { return !isSea(x, z) && !isRiver(x, z) && !reserved.has(x + ',' + z); }
  function regionCells(id) { const out = []; cells.forEach((r, k) => { if (r === id) { const [x, z] = k.split(',').map(Number); out.push([x, z]); } }); return out; }

  const api = { SIZE, MIN, MAX, MACHINE, SPECIAL, regionIndex, regionAt, isSea, isRiver, isCoast, buildable, regionCells, riverZ, islandRadius, cells };
  root.World = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
