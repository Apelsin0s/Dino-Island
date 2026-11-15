// Mesher: a small pool of background threads that build terrain meshes (mesher-worker.js).
// Every change to the world on the main thread (relief, holes, filling everything in) is mirrored to each thread in
// order, so a job always sees the world as it was when it was asked for. If threads are not available (old browser,
// a page policy), jobs run right here on the main thread instead — same results, just not in the background.
'use strict';
(function (root) {
  const W = root.World;
  const M = { done: 0, ms: 0, workers: [], ready: false, sync: true, inflight: 0, results: [], ver: new Map(), holeBuf: [], flushQ: false };
  const PER = 3;    // jobs in flight per thread: small, so a fresh dig is never stuck behind a long queue
  let seq = 0;

  function post(msg, tr) { for (const w of M.workers) w.postMessage(msg, tr); }
  function flush() { M.flushQ = false; if (M.holeBuf.length && !M.sync) { post({ t: 'holes', h: M.holeBuf }); } M.holeBuf = []; }
  // mirror world edits
  const addHole = W.addHole, clearHoles = W.clearHoles, setDem = W.setDem;
  W.addHole = function (x, y, z, r) {
    if (!M.sync) { M.holeBuf.push(x, y, z, r); if (!M.flushQ) { M.flushQ = true; queueMicrotask(flush); } }
    return addHole(x, y, z, r);
  };
  W.clearHoles = function () { flush(); if (!M.sync) post({ t: 'clear' }); return clearHoles(); };
  // relief blocks of the whole Earth go to every thread too
  const blocks = new Map(), setBlock = W.setWorldBlock;
  W.setWorldBlock = function (k, d) { blocks.set(k, d); if (!M.sync) post({ t: 'block', k, d }); return setBlock(k, d); };
  const pdata = new Map(), setPD = W.setPatchData;
  W.setPatchData = function (id, d) { pdata.set(id, d); if (!M.sync) post({ t: 'patch', id, d }); return setPD(id, d); };
  let demData = null;
  W.setDem = function (d) { demData = d; if (!M.sync) post({ t: 'dem', dem: d }); return setDem(d); };

  function onMsg(e) {
    const m = e.data;
    if (m.t === 'mesh') { M.inflight--; this.busy--; M.done++; M.ms += m.ms; M.lastAt = performance.now(); if (!M.firstAt) M.firstAt = M.lastAt; M.results.push(m); if (M.onResult) M.onResult(); }
  }
  // start the threads; resolves true when they answer, false (main-thread mode) otherwise
  M.start = function () {
    if (/[?&]sync\b/.test(location.search)) return Promise.resolve(false);   // test switch: main-thread mode
    const n = Math.max(1, Math.min(3, (navigator.hardwareConcurrency || 2) - 1));
    let blobUrl = null;
    const make = async blob => {
      if (!blob) return new Worker('mesher-worker.js');
      // some hosts only allow threads made from page content: build one from the scripts' text
      if (!blobUrl) { const src = await Promise.all(['world.js', 'mesher-worker.js'].map(f => fetch(f).then(r => r.text()))); blobUrl = URL.createObjectURL(new Blob([src.join('\n')], { type: 'text/javascript' })); }
      return new Worker(blobUrl);
    };
    const ping = w => new Promise(res => {
      const to = setTimeout(() => res(false), 2500);
      w.onmessage = e => { if (e.data.t === 'pong') { clearTimeout(to); res(true); } };
      w.onerror = () => { clearTimeout(to); res(false); };
      w.postMessage({ t: 'ping' });
    });
    const tryMake = async blob => { try { const w = await make(blob); if (await ping(w)) return w; w.terminate(); } catch (e) {} return null; };
    return (async () => {
      const ws = []; let blob = false;
      let first = await tryMake(false); if (!first) { blob = true; first = await tryMake(true); }
      if (first) { ws.push(first); for (let i = 1; i < n; i++) { const w = await tryMake(blob); if (w) ws.push(w); } }
      if (!ws.length) return false;
      for (const w of ws) { w.busy = 0; w.onmessage = onMsg; w.onerror = e => console.warn('mesher thread error', e.message); }
      M.workers = ws; M.sync = false;
      // bring the threads up to date: relief, then every hole dug so far
      if (demData) post({ t: 'dem', dem: demData });
      if (root.WorldDemInfo) post({ t: 'wdem', info: root.WorldDemInfo });
      for (const [k, d] of blocks) post({ t: 'block', k, d });
      if (root.DemPatches) post({ t: 'patches', list: root.DemPatches });
      for (const [id, d] of pdata) post({ t: 'patch', id, d });
      const h = []; for (const q of W.holes) h.push(q[0], q[1], q[2], q[3]);
      if (h.length) post({ t: 'holes', h });
      return true;
    })().catch(() => false);
  };
  M.canTake = () => M.sync || M.workers.some(w => w.busy < PER);
  // ask for a mesh of box k; the newest request for a key wins, older answers are thrown away
  M.request = function (kind, k, a, b, c) {
    const ver = (M.ver.get(k) || 0) + 1; M.ver.set(k, ver);
    if (M.sync) { const r = W.buildMesh(kind, a, b, c); r.k = k; r.kind = kind; r.ver = ver; M.results.push(r); return; }
    flush();
    let w = M.workers[0]; for (const x of M.workers) if (x.busy < w.busy) w = x;
    w.busy++; M.inflight++;
    w.postMessage({ t: 'job', id: ++seq, kind, k, a, b, c, ver });
  };
  M.isLatest = r => M.ver.get(r.k) === r.ver;
  M.forget = k => M.ver.delete(k);
  root.Mesher = M;
})(window);
