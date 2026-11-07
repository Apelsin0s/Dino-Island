// Bot playthrough of the economy. Digs by hand part of the time, buys the cheapest useful upgrade,
// walks to the lever when out of strength, dies to Mother every few minutes (back to the last save). Prints milestones and total time.
// Usage: node tools/simulate.js [activeShare=0.6] [deathEveryMin=6] [--quiet]
globalThis.window = globalThis;
require('../src/data.js');
const S = require('../src/sim.js');
const ARGS = process.argv.slice(2).filter(a => !a.startsWith('--'));
const ACTIVE = parseFloat(ARGS[0] || '0.6'), DEATH_MIN = parseFloat(ARGS[1] || '6');
const QUIET = process.argv.includes('--quiet');
const w = S.newWorld(42), p = S.newPlayer();
const fmt = t => `${Math.floor(t / 3600)}h${String(Math.floor(t / 60) % 60).padStart(2, '0')}m`;
const log = (t, m) => { if (!QUIET) console.log(fmt(t).padStart(7), m); };
let t = 0, nextMark = 0.05, nextDeath = DEATH_MIN * 60, trip = 0;
const frac = c => Math.max(...Object.keys(c).map(r => c[r] / Math.max(1e-9, w.cur[r])));
while (t < 80 * 3600 && w.keys < 3) {
  if (t % 45 === 0 && w.watcher.active) S.bounty(w, 40);   // scares dealt with now and then
  // out of strength: walk to the lever by the door and back (~30 s), then dig again
  if (trip > 0) { trip--; p.digging = false; if (trip === 0) S.pullLever(w, p); }
  else { p.digging = (t % 100) < ACTIVE * 100; if (p.energy <= 0.01) { trip = 30; p.digging = false; } }
  p.x = 0; p.z = 25; w.watcher.held = true;   // the bot's run is about the economy; she is modelled as deaths below
  S.step(w, [p], 1, {});
  // buy: cheapest affordable node
  for (let k = 0; k < 10; k++) {
    let best = null, bf = 1;
    for (const n of Object.values(S.N)) { if (!S.nodeVisible(w, n.id) || S.lv(w, n.id) >= n.max) continue; const f = frac(S.nodeCost(w, n.id)); if (f <= bf) { bf = f; best = n.id; } }
    if (!best || !S.buy(w, best)) break;
    if (S.lv(w, best) === 1) log(t, 'node ' + best);
  }
  // a death sends you back to the last lever save: about a minute of digging lost
  if (w.watcher.active && t >= nextDeath) { w.removed = Math.max(0, w.removed - S.digRate(w) * 60 * ACTIVE); for (const k in w.cur) w.cur[k] *= 0.95; nextDeath = t + DEATH_MIN * 60; }
  let kk = 0; if (w.keys > kk) { kk = w.keys; }
  if (S.depth(w) >= nextMark) { log(t, `${Math.round(S.depth(w) * 100)}% dug | dig ${S.digRate(w).toFixed(0)}/s auto ${S.autoRate(w).toFixed(0)}/s`); nextMark += 0.05; }
  t++;
}
console.log(`time ${fmt(t)} | keys ${w.keys}/3 at ${w.keyAt.map(k => (k / S.PILE * 100).toFixed(0) + '%').join(', ')} | dug ${(S.depth(w) * 100).toFixed(1)}%`);
if (w.keys < 3) process.exitCode = 1;
