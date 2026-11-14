require('../src/world.js'); const W = globalThis.World;
const d = W.fromLatLon(48, 12); const h = W.heightDir(...d); const P = d.map(v => v * (W.R + h));
console.log('spawn height', h.toFixed(2));
const cx = Math.floor(P[0] / W.CH), cy = Math.floor(P[1] / W.CH), cz = Math.floor(P[2] / W.CH);
let t = performance.now(), tot = 0, bad = 0, good = 0, chunks = 0;
for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) for (let c = -2; c <= 2; c++) {
  if (!W.chunkMayHaveSurface(cx + a, cy + b, cz + c)) continue;
  const s = W.sampleChunk(cx + a, cy + b, cz + c), m = W.meshChunk(s); chunks++; tot += m.idx.length / 3;
  for (let i = 0; i < m.idx.length; i += 3) {
    const [A, B, C] = [m.idx[i], m.idx[i + 1], m.idx[i + 2]].map(v => [m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]]);
    const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const vn = m.idx[i] * 3; const dot = n[0] * m.nrm[vn] + n[1] * m.nrm[vn + 1] + n[2] * m.nrm[vn + 2];
    if (dot < 0) bad++; else good++;
  }
}
console.log('chunks', chunks, 'tris', tot, 'ms/chunk', ((performance.now() - t) / chunks).toFixed(1), 'good', good, 'bad', bad);
W.addHole(P[0], P[1], P[2], 0.5); console.log('solid at hole', W.solid(...P).toFixed(2), 'below', W.solid(...d.map(v => v * (W.R + h - 2))).toFixed(2));
// fine grid: a few spoon scoops, then mesh the fine boxes and the coarse chunk around them
W.clearHoles();
const Q = W.fromLatLon(47.9105, 33.3918), hq = W.heightDir(...Q), S0 = Q.map(v => v * (W.R + hq - 0.02));
let res = { coarse: new Set(), fine: new Set() };
for (let i = 0; i < 20; i++) { const r = W.addHole(S0[0] + (i % 5) * 0.03, S0[1] - Math.floor(i / 5) * 0.03, S0[2], 0.045); r.coarse.forEach(k => res.coarse.add(k)); r.fine.forEach(k => res.fine.add(k)); }
t = performance.now(); let ft = 0;
for (const k of res.fine) { const [a, b, c] = k.split(',').map(Number); ft += W.meshChunk(W.sampleFine(a, b, c)).idx.length / 3; }
console.log('fine boxes', W.fineSet.size, 'remeshed', res.fine.size, 'tris', ft, 'ms/box', ((performance.now() - t) / res.fine.size).toFixed(1));
t = performance.now(); let ct = 0;
for (const k of res.coarse) { const [a, b, c] = k.split(',').map(Number); ct += W.meshChunk(W.sampleChunk(a, b, c)).idx.length / 3; }
console.log('coarse chunks to remesh', res.coarse.size, 'tris', ct, 'ms', (performance.now() - t).toFixed(0), 'solid in hole', W.solid(...S0).toFixed(3));
