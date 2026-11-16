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
  // lakes and rivers of a block (if it has any)
  const WI = root.WaterInfo; if (WI) W.setWaterInfo(WI);
  const wPend = new Map();
  const inflate = async u => new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer();
  const b64 = t => { const bin = atob(t), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
  function loadWater(k) {
    if (!WI || !WI.blocks.includes(k) || T.loaded.has('w:' + k)) return Promise.resolve();
    if (wPend.has(k)) return wPend.get(k);
    const pr = fetch(WI.file.replace('{c}_{r}', k)).then(r => { if (!r.ok) throw new Error(k); return r.text(); }).then(async txt => {
      const o = JSON.parse(new TextDecoder().decode(await inflate(b64(txt.trim()))));
      const lakes = o.lakes ? new Uint16Array(await inflate(b64(o.lakes))) : null, rivers = o.rivers ? new Float32Array(o.rivers) : null;
      W.setWaterBlock(k, { lakes, rivers }); T.loaded.add('w:' + k); wPend.delete(k); if (T.onBlock) T.onBlock(k);
    }).catch(e => { wPend.delete(k); console.warn('water not loaded', k, e.message); });
    wPend.set(k, pr); return pr;
  }
  // HD relief (~40 m Terrarium tiles at zoom 12): in the Steam build (it may use the internet), or with ?hd in the address
  const cfg = root.ED_CONFIG || {};
  T.hd = (cfg.steam && cfg.hd !== false) || /[?&]hd\b/.test(location.search);
  const HDURL = cfg.hdUrl || 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/12/{x}/{y}.png';
  const hdPend = new Map();
  function loadHD(x, y) {
    const k = 'h:' + x + '_' + y; if (T.loaded.has(k)) return Promise.resolve(); if (hdPend.has(k)) return hdPend.get(k);
    const pr = fetch(HDURL.replace('{x}', x).replace('{y}', y)).then(r => { if (!r.ok) throw new Error(k + ' ' + r.status); return r.blob(); }).then(createImageBitmap).then(bm => {
      const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(256, 256) : Object.assign(document.createElement('canvas'), { width: 256, height: 256 });
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bm, 0, 0);
      W.setHDTile(x, y, W.decodeTerrarium(g.getImageData(0, 0, 256, 256).data)); T.loaded.add(k); hdPend.delete(k); if (T.onBlock) T.onBlock(k, null, [x, y]);
    }).catch(e => { hdPend.delete(k); console.warn('HD relief tile not loaded', k, e.message); });
    hdPend.set(k, pr); return pr;
  }
  const hdAround = (lat, lon, r) => { const [x, y] = W.hdTileOf(lat, lon), out = []; for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) out.push(loadHD((x + i + 4096) % 4096, y + j)); return out; };
  // never wait more than a few seconds for the internet
  const capped = (ps, ms) => Promise.race([Promise.all(ps), new Promise(r => setTimeout(r, ms))]);
  T.ensure = (lat, lon, m) => { const ks = around(lat, lon, m === undefined ? 0.3 : m); return Promise.all(ks.map(load).concat(ks.map(loadWater), near(lat, lon, 0.5).map(loadPatch), T.hd ? [capped(hdAround(lat, lon, 2), 8000)] : [])); };
  T.watch = (lat, lon) => {   // fetch ahead while walking or driving
    for (const k of around(lat, lon, 1.5)) { if (!T.loaded.has(k) && !pending.has(k)) load(k); loadWater(k); }
    for (const p of near(lat, lon, 1.5)) loadPatch(p);
    if (T.hd) hdAround(lat, lon, 3);
  };
  root.Terrain = T;
})(window);
