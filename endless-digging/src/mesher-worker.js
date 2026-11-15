// Background thread: keeps its own copy of the world (relief + every dug hole, in the same order as the main thread)
// and turns boxes of it into meshes, so digging and walking never stall the frame.
'use strict';
if (typeof World === 'undefined') importScripts('world.js');
const W = self.World;
onmessage = e => {
  const m = e.data;
  if (m.t === 'dem') W.setDem(m.dem);
  else if (m.t === 'wdem') W.setWorldDem(m.info);
  else if (m.t === 'block') W.setWorldBlock(m.k, m.d);
  else if (m.t === 'patches') W.setPatches(m.list);
  else if (m.t === 'patch') W.setPatchData(m.id, m.d);
  else if (m.t === 'holes') { const h = m.h; for (let i = 0; i + 3 < h.length; i += 4) W.addHole(h[i], h[i + 1], h[i + 2], h[i + 3]); }
  else if (m.t === 'clear') W.clearHoles();
  else if (m.t === 'ping') postMessage({ t: 'pong' });
  else if (m.t === 'job') {
    const t0 = performance.now(), r = W.buildMesh(m.kind, m.a, m.b, m.c);
    postMessage({ t: 'mesh', id: m.id, k: m.k, kind: m.kind, ver: m.ver, pos: r.pos, nrm: r.nrm, depth: r.depth, idx: r.idx, mats: r.mats, base: r.base, ms: performance.now() - t0 },
      [r.pos.buffer, r.nrm.buffer, r.depth.buffer, r.idx.buffer, r.mats.buffer]);
  }
};
