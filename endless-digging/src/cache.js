// Model cache: the hand, tools, trees and buildings are sculpted in code (assets.js), which takes 1–5 s of CPU.
// The finished geometry is kept in the browser (IndexedDB) and reused on the next start. The key includes a hash
// of the asset code itself, so any change to a model rebuilds it. Without IndexedDB everything is simply built.
'use strict';
(function (root) {
  const T = root.THREE, A = root.Assets, DB = 'endlessdigging-models', ST = 'geo';
  const SKIP = new Set(['colorize', 'merge']);
  let mem = new Map(), fresh = new Map(), db = null;
  const fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(36); };
  const VER = fnv(Object.keys(A).map(k => k + (typeof A[k] === 'function' ? A[k].toString() : '')).join('|') + (root.SDF ? Object.values(root.SDF).map(String).join('|') : ''));

  // geometry <-> plain data (only BufferGeometry, arrays and plain objects of them; anything else is not cached)
  function pack(v) {
    if (v && v.isBufferGeometry) {
      const at = {}; for (const k in v.attributes) { const a = v.attributes[k]; if (a.isInterleavedBufferAttribute) return undefined; at[k] = [a.array.slice(), a.itemSize, a.normalized]; }
      return { $g: 1, at, idx: v.index ? v.index.array.slice() : null, groups: v.groups.length ? v.groups.map(q => Object.assign({}, q)) : null };
    }
    if (Array.isArray(v)) { const o = []; for (const x of v) { const p = pack(x); if (p === undefined) return undefined; o.push(p); } return o; }
    if (v && typeof v === 'object') { if (Object.getPrototypeOf(v) !== Object.prototype) return undefined; const o = {}; for (const k in v) { const p = pack(v[k]); if (p === undefined) return undefined; o[k] = p; } return o; }
    if (typeof v === 'function') return undefined;
    return v;
  }
  function unpack(v) {
    if (v && v.$g) {
      const g = new T.BufferGeometry();
      for (const k in v.at) { const [arr, size, norm] = v.at[k]; g.setAttribute(k, new T.BufferAttribute(arr.slice(), size, norm)); }
      if (v.idx) g.setIndex(new T.BufferAttribute(v.idx.slice(), 1));
      if (v.groups) for (const q of v.groups) g.addGroup(q.start, q.count, q.materialIndex);
      g.computeBoundingSphere(); g.computeBoundingBox(); return g;
    }
    if (Array.isArray(v)) return v.map(unpack);
    if (v && typeof v === 'object') { const o = {}; for (const k in v) o[k] = unpack(v[k]); return o; }
    return v;
  }
  // wrap every model maker: same arguments -> same model
  for (const k of Object.keys(A)) {
    const f = A[k]; if (typeof f !== 'function' || SKIP.has(k)) continue;
    A[k] = function () {
      let key; try { key = k + JSON.stringify(Array.from(arguments)); } catch (e) { return f.apply(this, arguments); }
      if (mem.has(key)) return unpack(mem.get(key));
      const r = f.apply(this, arguments), p = pack(r);
      if (p !== undefined) { mem.set(key, p); fresh.set(key, p); }
      return r;
    };
  }
  const open = () => new Promise((res, rej) => { const q = indexedDB.open(DB, 1); q.onupgradeneeded = () => q.result.createObjectStore(ST); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  const Cache = {
    // read what was saved for this version of the models (and forget older versions)
    load() {
      if (!root.indexedDB) return Promise.resolve(0);
      return Promise.race([
        open().then(d => new Promise(res => {
          db = d; const tx = d.transaction(ST, 'readonly').objectStore(ST).get(VER);
          tx.onsuccess = () => { if (tx.result) mem = new Map(Object.entries(tx.result)); res(mem.size); };
          tx.onerror = () => res(0);
        })),
        new Promise(res => setTimeout(() => res(0), 1500))
      ]).catch(() => 0);
    },
    // save newly built models (called once the game is up, so it never delays the start)
    save() {
      if (!db || !fresh.size) return;
      try {
        const st = db.transaction(ST, 'readwrite').objectStore(ST);
        st.clear(); st.put(Object.fromEntries(mem), VER); fresh.clear();
      } catch (e) {}
    },
    version: VER, stats: () => ({ cached: mem.size, built: fresh.size })
  };
  root.ModelCache = Cache;
})(window);
