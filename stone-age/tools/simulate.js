// Plays the game with a simple bot and prints when milestones happen.
// Usage: node tools/simulate.js [clicksPerSecond] [searchSeconds]
//   searchSeconds = how long the bot needs to find a clue / part after it becomes findable.
globalThis.window = globalThis;
require('../src/data.js');
require('../src/world.js');
const E = require('../src/engine.js');
const { BUILDINGS, UPGRADES, RESEARCH, CHAIN, EGGS, REGIONS } = globalThis.GAME_DATA;
const CPS = parseFloat(process.argv[2] || '1');
const SEARCH = parseFloat(process.argv[3] || '90');
const QUIET = process.argv.includes('--quiet');
const s = E.newState();
const fmt = t => { const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60; return `${h}h${String(m).padStart(2, '0')}m`; };
const log = (t, msg) => { if (!QUIET) console.log(fmt(t).padStart(7), msg); };
const seed = id => REGIONS.find(r => r.id === id).seed;
let t = 0, clickAcc = 0;
const activeSince = {};

function goalCost() { // the closest thing to afford in either tree
  const opts = RESEARCH.filter(x => E.researchAvailable(s, x) && !E.researchBlocked(s, x)).concat(UPGRADES.filter(x => E.upgradeAvailable(s, x)));
  opts.sort((a, b) => frac(a.cost) - frac(b.cost));
  return opts.length ? opts[0].cost : { food: 1 };
}
const fmtN = n => n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : n.toFixed(1);
const sum = c => Object.values(c).reduce((a, b) => a + b, 0);
function frac(cost) { let f = 0; for (const r in cost) f = Math.max(f, cost[r] / Math.max(1e-9, s.res[r])); return f; }

while (t < 80 * 3600 && !s.research.launch) {
  // clicks go to the most-missing basic resource of the next goal
  clickAcc += CPS;
  const g = goalCost(); let target = 'ideas', worst = -1;
  for (const r of ['food', 'wood', 'stone', 'ideas']) if (g[r]) { const miss = (g[r] - s.res[r]) / g[r]; if (miss > worst) { worst = miss; target = r; } }
  while (clickAcc >= 1) { E.click(s, target); clickAcc--; }

  // exploration: the bot "finds" things SEARCH seconds after they become findable
  CHAIN.forEach((c, i) => {
    const kc = 'c' + i, kp = 'p' + i;
    if (E.clueActive(s, i)) { activeSince[kc] = activeSince[kc] ?? t; if (t - activeSince[kc] >= SEARCH) { E.findClue(s, i); const rt = E.rates(s); log(t, `REGION ${c.region} opened  | /s: ` + Object.keys(rt).filter(k => rt[k] > 0).map(k => k + ' ' + fmtN(rt[k])).join(', ')); } }
    if (E.partActive(s, i)) { activeSince[kp] = activeSince[kp] ?? t; if (t - activeSince[kp] >= SEARCH) { E.findPart(s, i); log(t, `part ${c.part.id} found`); } }
  });
  EGGS.forEach((e, i) => { const k = 'e' + i; if (E.eggActive(s, i)) { activeSince[k] = activeSince[k] ?? t; if (t - activeSince[k] >= SEARCH * 3) E.findEgg(s, i); } });

  // trees first
  for (const x of RESEARCH) if (E.researchAvailable(s, x) && frac(x.cost) <= 1 && E.buyResearch(s, x.id)) log(t, `research ${x.id}`);
  for (const x of UPGRADES) if (E.upgradeAvailable(s, x) && frac(x.cost) <= 1 && E.buyUpgrade(s, x.id)) log(t, `upgrade ${x.id}`);

  // buildings: cheapest affordable action that costs ≤ 30% of what we hold
  for (let k = 0; k < 40; k++) {
    let best = null, bf = s.buildings.length < 3 ? 1 : 0.3;
    for (const d of BUILDINGS) {
      if (!E.buildingUnlocked(s, d) || !E.buildingRegionOpen(s, d)) continue;
      const f = frac(E.buildCost(s, d.id)); if (f < bf) { bf = f; best = { type: 'new', d }; }
    }
    const cap = E.levelCap(s);
    for (const b of s.buildings) { if (b.lvl >= cap) continue; const f = frac(E.levelCost(s, b)) * 0.9; if (f < bf) { bf = f; best = { type: 'lvl', b }; } }
    if (!best) break;
    if (best.type === 'new') {
      const b = E.build(s, best.d.id, null);
      const home = best.d.bonusIn && E.isOpen(s, best.d.bonusIn) ? best.d.bonusIn : best.d.regions ? best.d.regions.find(r => E.isOpen(s, r)) : 'meadow';
      [b.x, b.z] = seed(home);
    } else E.levelUp(s, best.b.id);
  }
  E.tick(s, 1); t++;
}
log(t, s.research.launch ? 'LAUNCHED' : 'not finished');
if (!s.research.launch) process.exitCode = 1;
const byType = {}; s.buildings.forEach(b => { byType[b.type] = (byType[b.type] || '') + b.lvl + ' '; });
console.log('time', fmt(t), '| buildings', s.buildings.length, '| regions', s.regions.length, '| echoes', E.echoesFromLoop(s));
if (!QUIET) console.log(byType);
