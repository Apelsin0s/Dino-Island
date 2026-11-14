// The planet: a 1:1 Earth-sized sphere (radius 6 371 km) of diggable ground.
// Ground is a density field in planet-centred metres (doubles): solid > 0, air < 0.
//   solid(p) = R + h(dir(p)) - |p|, minus every dug sphere (CSG subtraction).
// Two grids turn the field into smooth meshes (surface nets):
//   - coarse: 0.4 m cells in 9.6 m chunks, everywhere around the player (and big holes);
//   - fine: 2.5 cm cells in 0.8 m boxes, only where small holes were dug (spoon-sized). Coarse quads inside fine boxes
//     are left out, the fine mesh draws there instead.
'use strict';
(function (root) {
  const R = 6371000;            // planet radius, m
  const BIG = 0.15;             // holes at least this big are carved into the coarse grid too

  // ---------- noise ----------
  function ihash(x, y, z) {
    let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(z | 0, 0x1b873593) ^ 0x9e3779b9;
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); return (h ^ (h >>> 16)) >>> 0;
  }
  function hash01(x, y, z) { return ihash(x, y, z) / 4294967296; }
  function g3(h, x, y, z) { h &= 15; const u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14 ? x : z); return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); }
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  // Perlin gradient noise, roughly -1..1. Inputs can be large (planet metres / scale): still exact in doubles.
  function noise(x, y, z, seed) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
    const u = fade(xf), v = fade(yf), w = fade(zf), s = seed | 0;
    const a = ihash(xi + s, yi, zi), b = ihash(xi + 1 + s, yi, zi), c = ihash(xi + s, yi + 1, zi), d = ihash(xi + 1 + s, yi + 1, zi);
    const e = ihash(xi + s, yi, zi + 1), f = ihash(xi + 1 + s, yi, zi + 1), g = ihash(xi + s, yi + 1, zi + 1), k = ihash(xi + 1 + s, yi + 1, zi + 1);
    const x1 = g3(a, xf, yf, zf) + u * (g3(b, xf - 1, yf, zf) - g3(a, xf, yf, zf));
    const x2 = g3(c, xf, yf - 1, zf) + u * (g3(d, xf - 1, yf - 1, zf) - g3(c, xf, yf - 1, zf));
    const x3 = g3(e, xf, yf, zf - 1) + u * (g3(f, xf - 1, yf, zf - 1) - g3(e, xf, yf, zf - 1));
    const x4 = g3(g, xf, yf - 1, zf - 1) + u * (g3(k, xf - 1, yf - 1, zf - 1) - g3(g, xf, yf - 1, zf - 1));
    const y1 = x1 + v * (x2 - x1), y2 = x3 + v * (x4 - x3);
    return y1 + w * (y2 - y1);
  }

  // ---------- terrain height above sea level (sea level = R) ----------
  // Gentle steppe-like relief for now (real relief comes from elevation data later).
  function height(qx, qy, qz) {
    const m = noise(qx / 6000, qy / 6000, qz / 6000, 11);
    const mount = Math.max(0, m + 0.15) * 45;
    const hills = noise(qx / 700, qy / 700, qz / 700, 23) * 8 + noise(qx / 180, qy / 180, qz / 180, 37) * 2.5;
    const bumps = noise(qx / 35, qy / 35, qz / 35, 41) * 0.5 + noise(qx / 9, qy / 9, qz / 9, 53) * 0.12;
    return 90 + mount + hills + bumps;
  }
  function heightDir(dx, dy, dz) { return height(dx * R, dy * R, dz * R); }
  function heightAt(px, py, pz) { const l = Math.hypot(px, py, pz); return heightDir(px / l, py / l, pz / l); }

  // ---------- grid levels ----------
  function level(vox, n) { const L = { VOX: vox, N: n, CH: vox * n, S: n + 2, HL: 4 }; L.HS = Math.floor((L.S - 1) / L.HL) + 2; return L; }
  const LC = level(0.4, 24), LF = level(0.025, 32), FPC = 12;       // coarse 9.6 m chunks, fine 0.8 m boxes (12 per coarse chunk side)
  const VOX = LC.VOX, N = LC.N, CH = LC.CH, S = LC.S;
  const key = (cx, cy, cz) => cx + ',' + cy + ',' + cz;

  // ---------- dug holes ----------
  // Every dig is a sphere [x, y, z, r] in planet metres, indexed by coarse chunk so lookups stay cheap.
  const holes = [];
  const holeIndex = new Map();      // coarse chunk key -> [hole, ...]
  const fineSet = new Set();        // fine box keys that exist
  function boxesTouching(L, x, y, z, pad) {
    const out = [], c = L.CH;
    const x0 = Math.floor((x - pad) / c), x1 = Math.floor((x + pad) / c), y0 = Math.floor((y - pad) / c), y1 = Math.floor((y + pad) / c), z0 = Math.floor((z - pad) / c), z1 = Math.floor((z + pad) / c);
    for (let a = x0; a <= x1; a++) for (let b = y0; b <= y1; b++) for (let k = z0; k <= z1; k++) out.push([a, b, k]);
    return out;
  }
  // Returns what has to be re-meshed: { coarse: [keys], fine: [keys] }
  function addHole(x, y, z, r) {
    const h = [x, y, z, r]; holes.push(h);
    for (const [a, b, c] of boxesTouching(LC, x, y, z, r + VOX * 2)) { const k = key(a, b, c); let l = holeIndex.get(k); if (!l) holeIndex.set(k, l = []); l.push(h); }
    const coarse = new Set(), fine = [];
    if (r >= BIG) for (const [a, b, c] of boxesTouching(LC, x, y, z, r + VOX * 1.5)) coarse.add(key(a, b, c));
    // fine boxes around the hole, with a margin so its edge never meets the coarse mesh
    for (const [a, b, c] of boxesTouching(LF, x, y, z, r + 0.45)) {
      const k = key(a, b, c), wx = (a + 0.5) * LF.CH, wy = (b + 0.5) * LF.CH, wz = (c + 0.5) * LF.CH;
      if (Math.abs(depthAt(wx, wy, wz)) > LF.CH * 0.9 + 0.05 && !holeNear(wx, wy, wz, LF.CH)) continue;   // nowhere near the surface
      const isNew = !fineSet.has(k);
      if (isNew) { fineSet.add(k); coarse.add(key(Math.floor(a / FPC), Math.floor(b / FPC), Math.floor(c / FPC))); }
      if (isNew || fineTouches(a, b, c, h)) fine.push(k);
    }
    return { coarse: [...coarse], fine };
  }
  function fineTouches(a, b, c, h) { const p = h[3] + LF.VOX * 2, c0 = LF.CH; return h[0] + p > a * c0 && h[0] - p < (a + 1) * c0 && h[1] + p > b * c0 && h[1] - p < (b + 1) * c0 && h[2] + p > c * c0 && h[2] - p < (c + 1) * c0; }
  function holeNear(x, y, z, pad) { const l = holeIndex.get(key(Math.floor(x / CH), Math.floor(y / CH), Math.floor(z / CH))); if (l) for (const h of l) if (Math.hypot(x - h[0], y - h[1], z - h[2]) < h[3] + pad) return true; return false; }
  function clearHoles() { holes.length = 0; holeIndex.clear(); fineSet.clear(); }
  const isFineCell = (x, y, z) => fineSet.has(key(Math.floor(x / LF.CH), Math.floor(y / LF.CH), Math.floor(z / LF.CH)));

  // Solid-ness at any point (≈ signed distance to the surface, positive inside the ground).
  function solid(px, py, pz) {
    const l = Math.hypot(px, py, pz);
    let s = R + heightDir(px / l, py / l, pz / l) - l;
    const list = holeIndex.get(key(Math.floor(px / CH), Math.floor(py / CH), Math.floor(pz / CH)));
    if (list) for (const h of list) { const d = Math.hypot(px - h[0], py - h[1], pz - h[2]) - h[3]; if (d < s) s = d; }
    return s;
  }
  // How deep a point is under the untouched surface (m). Negative = above it.
  function depthAt(px, py, pz) { const l = Math.hypot(px, py, pz); return R + heightDir(px / l, py / l, pz / l) - l; }

  // ---------- sampling ----------
  function chunkMayHaveSurface(cx, cy, cz) {
    if (holeIndex.has(key(cx, cy, cz))) return true;
    const x = (cx + 0.5) * CH, y = (cy + 0.5) * CH, z = (cz + 0.5) * CH;
    return Math.abs(depthAt(x, y, z)) < CH * 0.87 + 3;
  }
  function sampleBox(L, cx, cy, cz, holeList, holeFilter) {
    const { VOX: vox, S: s, HL, HS } = L, ox = cx * L.CH - vox, oy = cy * L.CH - vox, oz = cz * L.CH - vox;
    const hl = new Float64Array(HS * HS * HS);
    for (let k = 0; k < HS; k++) for (let j = 0; j < HS; j++) for (let i = 0; i < HS; i++) {
      const x = ox + i * HL * vox, y = oy + j * HL * vox, z = oz + k * HL * vox, l = Math.hypot(x, y, z);
      hl[i + HS * (j + HS * k)] = heightDir(x / l, y / l, z / l);
    }
    const hAt = (fi, fj, fk) => {
      const a = fi / HL, b = fj / HL, c = fk / HL, i = Math.min(HS - 2, Math.floor(a)), j = Math.min(HS - 2, Math.floor(b)), k = Math.min(HS - 2, Math.floor(c));
      const u = a - i, v = b - j, w = c - k, I = (ii, jj, kk) => hl[ii + HS * (jj + HS * kk)];
      const x00 = I(i, j, k) + u * (I(i + 1, j, k) - I(i, j, k)), x10 = I(i, j + 1, k) + u * (I(i + 1, j + 1, k) - I(i, j + 1, k));
      const x01 = I(i, j, k + 1) + u * (I(i + 1, j, k + 1) - I(i, j, k + 1)), x11 = I(i, j + 1, k + 1) + u * (I(i + 1, j + 1, k + 1) - I(i, j + 1, k + 1));
      const y0 = x00 + v * (x10 - x00), y1 = x01 + v * (x11 - x01); return y0 + w * (y1 - y0);
    };
    const d = new Float32Array(s * s * s);
    for (let k = 0; k < s; k++) for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) d[i + s * (j + s * k)] = R + hAt(i, j, k) - Math.hypot(ox + i * vox, oy + j * vox, oz + k * vox);
    const base = d.slice(), c = { L, cx, cy, cz, ox, oy, oz, d, base, hAt };
    if (holeList) for (const h of holeList) if (!holeFilter || holeFilter(h)) carve(c, h);
    return c;
  }
  const sampleChunk = (cx, cy, cz) => sampleBox(LC, cx, cy, cz, holeIndex.get(key(cx, cy, cz)), h => h[3] >= BIG);
  function sampleFine(a, b, c) {
    const list = holeIndex.get(key(Math.floor(a / FPC), Math.floor(b / FPC), Math.floor(c / FPC)));
    return sampleBox(LF, a, b, c, list, h => fineTouches(a, b, c, h));
  }
  // Apply one hole to sampled density (only the samples in its box).
  function carve(c, h) {
    const { VOX: vox, S: s } = c.L, d = c.d, ox = c.ox, oy = c.oy, oz = c.oz, r = h[3] + vox * 1.5;
    const i0 = Math.max(0, Math.floor((h[0] - r - ox) / vox)), i1 = Math.min(s - 1, Math.ceil((h[0] + r - ox) / vox));
    const j0 = Math.max(0, Math.floor((h[1] - r - oy) / vox)), j1 = Math.min(s - 1, Math.ceil((h[1] + r - oy) / vox));
    const k0 = Math.max(0, Math.floor((h[2] - r - oz) / vox)), k1 = Math.min(s - 1, Math.ceil((h[2] + r - oz) / vox));
    for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const v = Math.hypot(ox + i * vox - h[0], oy + j * vox - h[1], oz + k * vox - h[2]) - h[3];
      const n = i + s * (j + s * k); if (v < d[n]) d[n] = v;
    }
  }

  // ---------- surface nets mesher ----------
  // Positions are relative to the box's own corner; for each vertex also the depth below the untouched surface
  // (0 exactly for untouched ground). Coarse boxes skip quads whose four cells all lie inside fine boxes.
  const CORNERS = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  function meshChunk(c) {
    const { VOX: vox, N: n0, S: s } = c.L, d = c.d, C = s - 1, coarse = c.L === LC;
    const vidx = new Int32Array(C * C * C).fill(-1);
    const pos = [], nrm = [], depth = [], idx = [];
    const val = new Float32Array(8);
    let culled = null;
    if (coarse && fineSet.size) {   // which cells are covered by fine boxes
      culled = new Uint8Array(C * C * C); let any = false;
      for (let k = 0; k < C; k++) for (let j = 0; j < C; j++) for (let i = 0; i < C; i++) if (isFineCell(c.ox + (i + 0.5) * vox, c.oy + (j + 0.5) * vox, c.oz + (k + 0.5) * vox)) { culled[i + C * (j + C * k)] = 1; any = true; }
      if (!any) culled = null;
    }
    for (let k = 0; k < C; k++) for (let j = 0; j < C; j++) for (let i = 0; i < C; i++) {
      let mask = 0, carved = false;
      for (let q = 0; q < 8; q++) { const o = CORNERS[q], m = (i + o[0]) + s * ((j + o[1]) + s * (k + o[2])), v = d[m]; val[q] = v; if (v > 0) mask |= 1 << q; if (v !== c.base[m]) carved = true; }
      if (mask === 0 || mask === 255) continue;
      let sx = 0, sy = 0, sz = 0, n = 0;
      for (const [a, b] of EDGES) {
        const va = val[a], vb = val[b]; if ((va > 0) === (vb > 0)) continue;
        const t = va / (va - vb), A = CORNERS[a], B = CORNERS[b];
        sx += A[0] + t * (B[0] - A[0]); sy += A[1] + t * (B[1] - A[1]); sz += A[2] + t * (B[2] - A[2]); n++;
      }
      const fx = i + sx / n, fy = j + sy / n, fz = k + sz / n;
      let gx = (val[1] - val[0]) + (val[3] - val[2]) + (val[5] - val[4]) + (val[7] - val[6]);
      let gy = (val[2] - val[0]) + (val[3] - val[1]) + (val[6] - val[4]) + (val[7] - val[5]);
      let gz = (val[4] - val[0]) + (val[5] - val[1]) + (val[6] - val[2]) + (val[7] - val[3]);
      const gl = Math.hypot(gx, gy, gz) || 1; gx = -gx / gl; gy = -gy / gl; gz = -gz / gl;
      vidx[i + C * (j + C * k)] = pos.length / 3;
      pos.push((fx - 1) * vox, (fy - 1) * vox, (fz - 1) * vox);
      nrm.push(gx, gy, gz);
      let bd = 0;
      if (carved) {   // depth from the untouched field itself at this vertex
        const u = sx / n, v = sy / n, w = sz / n, B = q => c.base[(i + CORNERS[q][0]) + s * ((j + CORNERS[q][1]) + s * (k + CORNERS[q][2]))];
        const x0 = B(0) + u * (B(1) - B(0)), x1 = B(2) + u * (B(3) - B(2)), x2 = B(4) + u * (B(5) - B(4)), x3 = B(6) + u * (B(7) - B(6));
        const y0 = x0 + v * (x1 - x0), y1 = x2 + v * (x3 - x2);
        bd = Math.max(0, y0 + w * (y1 - y0));
      }
      depth.push(bd);
    }
    const V = (i, j, k) => vidx[i + C * (j + C * k)];
    const cull = (a, b, e, f) => culled && culled[a] && culled[b] && culled[e] && culled[f];
    const ci = (i, j, k) => i + C * (j + C * k);
    const quad = (a, b, cc, dd, flip) => {
      if (a < 0 || b < 0 || cc < 0 || dd < 0) return;
      if (flip) idx.push(a, cc, b, a, dd, cc); else idx.push(a, b, cc, a, cc, dd);
    };
    for (let k = 1; k <= n0; k++) for (let j = 1; j <= n0; j++) for (let i = 1; i <= n0; i++) {
      const v0 = d[i + s * (j + s * k)] > 0;
      if (i < s - 1 && v0 !== (d[(i + 1) + s * (j + s * k)] > 0) && !cull(ci(i, j - 1, k - 1), ci(i, j, k - 1), ci(i, j, k), ci(i, j - 1, k)))
        quad(V(i, j - 1, k - 1), V(i, j, k - 1), V(i, j, k), V(i, j - 1, k), !v0);
      if (j < s - 1 && v0 !== (d[i + s * ((j + 1) + s * k)] > 0) && !cull(ci(i - 1, j, k - 1), ci(i - 1, j, k), ci(i, j, k), ci(i, j, k - 1)))
        quad(V(i - 1, j, k - 1), V(i - 1, j, k), V(i, j, k), V(i, j, k - 1), !v0);
      if (k < s - 1 && v0 !== (d[i + s * (j + s * (k + 1))] > 0) && !cull(ci(i - 1, j - 1, k), ci(i, j - 1, k), ci(i, j, k), ci(i - 1, j, k)))
        quad(V(i - 1, j - 1, k), V(i, j - 1, k), V(i, j, k), V(i - 1, j, k), !v0);
    }
    return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), depth: new Float32Array(depth), idx: pos.length / 3 > 65535 ? new Uint32Array(idx) : new Uint16Array(idx) };
  }

  // ---------- places that can't be dug (under buildings and fixed props) ----------
  // [x, y, z, r]: a vertical cylinder of radius r around the point (planet metres), any depth.
  const blockers = [];
  function blocked(x, y, z, pad) {
    for (const b of blockers) {
      const l = Math.hypot(b[0], b[1], b[2]), ux = b[0] / l, uy = b[1] / l, uz = b[2] / l;
      const dx = x - b[0], dy = y - b[1], dz = z - b[2], along = dx * ux + dy * uy + dz * uz;
      const hx = dx - ux * along, hy = dy - uy * along, hz = dz - uz * along;
      if (along < 6 && hx * hx + hy * hy + hz * hz < (b[3] + pad) * (b[3] + pad)) return b;
    }
    return null;
  }

  // ---------- geography helpers ----------
  function fromLatLon(lat, lon) { const a = lat * Math.PI / 180, b = lon * Math.PI / 180; return [Math.cos(a) * Math.cos(b), Math.sin(a), -Math.cos(a) * Math.sin(b)]; }
  function toLatLon(x, y, z) { const l = Math.hypot(x, y, z); return [Math.asin(y / l) * 180 / Math.PI, Math.atan2(-z, x) * 180 / Math.PI]; }

  root.World = { R, VOX, N, CH, S, BIG, LC, LF, noise, hash01, ihash, height, heightDir, heightAt, solid, depthAt, addHole, clearHoles, holes, key,
    chunkMayHaveSurface, sampleChunk, sampleFine, carve, meshChunk, fineSet, blockers, blocked, fromLatLon, toLatLon };
})(typeof window !== 'undefined' ? window : globalThis);
