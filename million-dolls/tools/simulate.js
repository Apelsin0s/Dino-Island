// Bot playthrough of the economy. Digs by hand part of the time, buys the cheapest useful upgrade,
// dies to Mother every few minutes (losing 15% of loot). Prints milestones and total time.
// Usage: node tools/simulate.js [activeShare=0.6] [deathEveryMin=6] [--quiet]
globalThis.window = globalThis;
require('../src/data.js');
const S = require('../src/sim.js');
const ACTIVE = parseFloat(process.argv[2] || '0.6'), DEATH_MIN = parseFloat(process.argv[3] || '6');
const QUIET = process.argv.includes('--quiet');
const w = S.newWorld(42), p = S.newPlayer();
const fmt = t => `${Math.floor(t / 3600)}h${String(Math.floor(t / 60) % 60).padStart(2, '0')}m`;
const log = (t, m) => { if (!QUIET) console.log(fmt(t).padStart(7), m); };
let t = 0, nextMark = 0.05, nextDeath = DEATH_MIN * 60;
const frac = c => Math.max(...Object.keys(c).map(r => c[r] / Math.max(1e-9, w.cur[r])));
while (t < 60 * 3600 && !w.keyFound) {
  p.digging = (t % 100) < ACTIVE * 100;
  S.step(w, [p], 1, { watched: [true] });
  // buy: cheapest affordable node
  for (let k = 0; k < 10; k++) {
    let best = null, bf = 1;
    for (const n of Object.values(S.N)) { if (!S.nodeVisible(w, n.id) || S.lv(w, n.id) >= n.max) continue; const f = frac(S.nodeCost(w, n.id)); if (f <= bf) { bf = f; best = n.id; } }
    if (!best || !S.buy(w, best)) break;
    if (S.lv(w, best) === 1) log(t, 'node ' + best);
  }
  if (w.watcher.active && t >= nextDeath) { S.killed(w, p); nextDeath = t + DEATH_MIN * 60; }
  if (S.depth(w) >= nextMark) { log(t, `${Math.round(S.depth(w) * 100)}% dug | dig ${S.digRate(w).toFixed(0)}/s auto ${S.autoRate(w).toFixed(0)}/s`); nextMark += 0.05; }
  t++;
}
console.log(`time ${fmt(t)} | key ${w.keyFound ? 'FOUND' : 'not found'} at ${(w.keyAt / S.PILE * 100).toFixed(1)}% | dug ${(S.depth(w) * 100).toFixed(1)}%`);
if (!w.keyFound) process.exitCode = 1;
