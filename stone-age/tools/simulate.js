// Plays the game with a simple bot and prints when milestones happen.
// Usage: node tools/simulate.js [clicksPerSecond]
globalThis.window = globalThis;
require('../src/data.js');
const E = require('../src/engine.js');
const { TECHS, PARTS, BUILDINGS } = globalThis.GAME_DATA;
const CPS = parseFloat(process.argv[2] || '1');
const s = E.newState();
const fmt = t => { const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60; return `${h}h${String(m).padStart(2, '0')}m`; };
const log = (t, msg) => console.log(fmt(t).padStart(7), msg);
let t = 0, clickAcc = 0;
function goalCost() {
  const tech = TECHS.find(x => E.techVisible(s, x));
  const part = E.machineVisible(s) && E.nextPart(s);
  const cands = [tech && tech.cost, part && (!part.req || s.tech[part.req]) && part.cost].filter(Boolean);
  return cands[0] || { food: 1e9 };
}
while (t < 40 * 3600 && !s.parts.launch) {
  // click the most-missing resource of the current goal (only ones clickable)
  clickAcc += CPS;
  const g = goalCost(); let target = 'ideas', worst = -1;
  for (const r of ['food', 'wood', 'stone', 'ideas']) if (g[r]) { const miss = (g[r] - s.res[r]) / g[r]; if (miss > worst) { worst = miss; target = r; } }
  while (clickAcc >= 1) { E.click(s, target); clickAcc--; }
  // research / parts first
  for (const x of TECHS) if (E.research(s, x.id)) log(t, 'tech ' + x.id);
  for (const p of PARTS) if (E.buildPart(s, p.id)) log(t, 'PART ' + p.id);
  // buy buildings costing <= 25% of each resource held
  for (const b of BUILDINGS.slice().reverse()) {
    if (!E.buildingVisible(s, b)) continue;
    for (let k = 0; k < 20; k++) {
      const c = E.buildingCost(b, s.b[b.id] || 0, 1);
      if (Object.keys(c).every(r => c[r] <= s.res[r] * 0.25)) E.buyBuilding(s, b.id, 1); else break;
    }
  }
  E.tick(s, 1); t++;
}
log(t, s.parts.launch ? 'LAUNCHED' : 'not finished');
if (!s.parts.launch) process.exitCode = 1;
console.log('buildings', JSON.stringify(s.b));
console.log('echoes from loop', E.echoesFromLoop(s));
