// Terrain: brings in the relief of the whole Earth around the player (dem/world/*.txt, see tools/build-world-dem.py).
// A block is 15° x 15°; the one under the player and any within the margin are fetched, unpacked in the browser
// (DecompressionStream) and handed to the world and the mesher threads.
'use strict';
(function (root) {
  const W = root.World, info = root.WorldDemInfo;
  const T = { loaded: new Set(), onBlock: null };
  if (!info) { T.ensure = () => Promise.resolve(); T.watch = () => {}; root.Terrain = T; return; }
  W.setWorldDem(info);
  const pending = new Map();
  async function unpack(txt) {
    const bin = atob(txt.trim()), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const ds = new DecompressionStream('deflate'), out = await new Response(new Blob([u]).stream().pipeThrough(ds)).arrayBuffer();
    return W.decodeBlock(new Int16Array(out));
  }
  function load(k) {
    if (T.loaded.has(k)) return Promise.resolve();
    if (pending.has(k)) return pending.get(k);
    const p = fetch(info.file.replace('{c}_{r}', k)).then(r => { if (!r.ok) throw new Error(k + ' ' + r.status); return r.text(); }).then(unpack)
      .then(e => { W.setWorldBlock(k, e); T.loaded.add(k); pending.delete(k); if (T.onBlock) T.onBlock(k); })
      .catch(err => { pending.delete(k); console.warn('relief block not loaded', k, err.message); });
    pending.set(k, p); return p;
  }
  // blocks within m degrees of a place
  function around(lat, lon, m) {
    const keys = new Set();
    for (const a of [-m, 0, m]) for (const b of [-m, 0, m]) keys.add(W.blockKey(Math.max(-89.9, Math.min(89.9, lat + a)), ((lon + b + 540) % 360) - 180));
    return [...keys];
  }
  // detailed patches (famous volcanoes, craters, mountains) within ~2° of a place
  const P = root.DemPatches || [];
  W.setPatches(P);
  const pPend = new Map();
  function loadPatch(p) {
    if (T.loaded.has('p:' + p.id)) return Promise.resolve();
    if (pPend.has(p.id)) return pPend.get(p.id);
    const pr = fetch(p.file).then(r => { if (!r.ok) throw new Error(p.id); return r.text(); }).then(async txt => {
      const bin = atob(txt.trim()), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const out = await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer();
      const d = W.decodePatch(new Int16Array(out), p.w, p.h);
      W.setPatchData(p.id, d); T.loaded.add('p:' + p.id); pPend.delete(p.id); if (T.onBlock) T.onBlock('p:' + p.id, p);
    }).catch(e => { pPend.delete(p.id); console.warn('relief patch not loaded', p.id, e.message); });
    pPend.set(p.id, pr); return pr;
  }
  const near = (lat, lon, m) => P.filter(p => lat > p.box[2] - m && lat < p.box[3] + m && lon > p.box[0] - m / Math.max(0.2, Math.cos(lat * Math.PI / 180)) && lon < p.box[1] + m / Math.max(0.2, Math.cos(lat * Math.PI / 180)));
  T.ensure = (lat, lon, m) => Promise.all(around(lat, lon, m === undefined ? 0.3 : m).map(load).concat(near(lat, lon, 0.5).map(loadPatch)));
  T.watch = (lat, lon) => {   // fetch ahead while walking or driving
    for (const k of around(lat, lon, 1.5)) if (!T.loaded.has(k) && !pending.has(k)) load(k);
    for (const p of near(lat, lon, 1.5)) loadPatch(p);
  };
  root.Terrain = T;
})(window);
