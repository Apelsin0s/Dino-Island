// The planet: a 1:1 Earth-sized sphere (radius 6 371 km) of diggable ground.
// Ground is a density field in planet-centred metres (doubles): solid > 0, air < 0.
//   solid(p) = R + h(dir(p)) - |p|, minus every dug sphere (CSG subtraction).
// Near the player the field is sampled on a 0.4 m grid in chunks and turned into a smooth mesh (surface nets),
// so digging leaves round holes, not cubes. Works anywhere on the sphere: chunks are axis-aligned in planet space.
'use strict';
(function (root) {
  const R = 6371000;            // planet radius, m
  const VOX = 0.4;              // voxel size, m
  const N = 24;                 // voxels per chunk side
  const CH = VOX * N;           // chunk size, m (9.6)
  const S = N + 2;              // samples per side (one extra each way for seamless edges)
  const HL = 4;                 // height lattice step, in voxels (height is interpolated between lattice points)
  const HS = Math.floor((S - 1) / HL) + 2;

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
  // q = point on the sea-level sphere (metres). Rolling meadows, hills and far mountains.
  function height(qx, qy, qz) {
    const m = noise(qx / 6000, qy / 6000, qz / 6000, 11);                       // where the mountains are
    const mount = Math.max(0, m + 0.15) * 260;
    const hills = noise(qx / 700, qy / 700, qz / 700, 23) * 22 + noise(qx / 180, qy / 180, qz / 180, 37) * 5;
    const bumps = noise(qx / 35, qy / 35, qz / 35, 41) * 0.9 + noise(qx / 9, qy / 9, qz / 9, 53) * 0.18;
    return 60 + mount + hills + bumps;
  }
  function heightDir(dx, dy, dz) { return height(dx * R, dy * R, dz * R); }
  function heightAt(px, py, pz) { const l = Math.hypot(px, py, pz); return heightDir(px / l, py / l, pz / l); }

  // ---------- dug holes ----------
  // Every dig is a sphere [x, y, z, r] in planet metres. Indexed by chunk so lookups stay cheap.
  const holes = [];                 // all holes in order (for saving)
  const holeIndex = new Map();      // chunkKey -> [hole, ...]
  const key = (cx, cy, cz) => cx + ',' + cy + ',' + cz;
  function chunksTouching(x, y, z, r) {
    const pad = r + VOX * 2, out = [];
    const x0 = Math.floor((x - pad) / CH), x1 = Math.floor((x + pad) / CH);
    const y0 = Math.floor((y - pad) / CH), y1 = Math.floor((y + pad) / CH);
    const z0 = Math.floor((z - pad) / CH), z1 = Math.floor((z + pad) / CH);
    for (let a = x0; a <= x1; a++) for (let b = y0; b <= y1; b++) for (let c = z0; c <= z1; c++) out.push([a, b, c]);
    return out;
  }
  function addHole(x, y, z, r) {
    const h = [x, y, z, r]; holes.push(h);
    const touched = chunksTouching(x, y, z, r);
    for (const [a, b, c] of touched) { const k = key(a, b, c); let l = holeIndex.get(k); if (!l) holeIndex.set(k, l = []); l.push(h); }
    return touched.map(t => key(t[0], t[1], t[2]));
  }
  function clearHoles() { holes.length = 0; holeIndex.clear(); }

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

  // ---------- chunk sampling ----------
  // Cheap test: can this chunk contain any surface at all?
  function chunkMayHaveSurface(cx, cy, cz) {
    if (holeIndex.has(key(cx, cy, cz))) return true;
    const x = (cx + 0.5) * CH, y = (cy + 0.5) * CH, z = (cz + 0.5) * CH;
    const d = Math.abs(depthAt(x, y, z));
    return d < CH * 0.87 + 3;
  }

  // Sample the field for a chunk: density (S³) and surface height lattice (for colouring and the field itself).
  function sampleChunk(cx, cy, cz) {
    const ox = cx * CH - VOX, oy = cy * CH - VOX, oz = cz * CH - VOX;     // world position of sample (0,0,0)
    // height on a coarse lattice, interpolated per sample
    const hl = new Float64Array(HS * HS * HS);
    for (let k = 0; k < HS; k++) for (let j = 0; j < HS; j++) for (let i = 0; i < HS; i++) {
      const x = ox + i * HL * VOX, y = oy + j * HL * VOX, z = oz + k * HL * VOX, l = Math.hypot(x, y, z);
      hl[i + HS * (j + HS * k)] = heightDir(x / l, y / l, z / l);
    }
    const hAt = (fi, fj, fk) => {   // fi.. in sample units
      const a = fi / HL, b = fj / HL, c = fk / HL, i = Math.min(HS - 2, Math.floor(a)), j = Math.min(HS - 2, Math.floor(b)), k = Math.min(HS - 2, Math.floor(c));
      const u = a - i, v = b - j, w = c - k, I = (ii, jj, kk) => hl[ii + HS * (jj + HS * kk)];
      const x00 = I(i, j, k) + u * (I(i + 1, j, k) - I(i, j, k)), x10 = I(i, j + 1, k) + u * (I(i + 1, j + 1, k) - I(i, j + 1, k));
      const x01 = I(i, j, k + 1) + u * (I(i + 1, j, k + 1) - I(i, j, k + 1)), x11 = I(i, j + 1, k + 1) + u * (I(i + 1, j + 1, k + 1) - I(i, j + 1, k + 1));
      const y0 = x00 + v * (x10 - x00), y1 = x01 + v * (x11 - x01); return y0 + w * (y1 - y0);
    };
    const d = new Float32Array(S * S * S);
    for (let k = 0; k < S; k++) for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const x = ox + i * VOX, y = oy + j * VOX, z = oz + k * VOX;
      d[i + S * (j + S * k)] = R + hAt(i, j, k) - Math.hypot(x, y, z);
    }
    const base = d.slice();
    const list = holeIndex.get(key(cx, cy, cz));
    if (list) for (const h of list) carve(d, ox, oy, oz, h);
    return { cx, cy, cz, ox, oy, oz, d, base, hAt };
  }
  // Apply one hole to sampled density (only the samples in its box).
  function carve(d, ox, oy, oz, h) {
    const r = h[3] + VOX * 1.5;
    const i0 = Math.max(0, Math.floor((h[0] - r - ox) / VOX)), i1 = Math.min(S - 1, Math.ceil((h[0] + r - ox) / VOX));
    const j0 = Math.max(0, Math.floor((h[1] - r - oy) / VOX)), j1 = Math.min(S - 1, Math.ceil((h[1] + r - oy) / VOX));
    const k0 = Math.max(0, Math.floor((h[2] - r - oz) / VOX)), k1 = Math.min(S - 1, Math.ceil((h[2] + r - oz) / VOX));
    for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const v = Math.hypot(ox + i * VOX - h[0], oy + j * VOX - h[1], oz + k * VOX - h[2]) - h[3];
      const n = i + S * (j + S * k); if (v < d[n]) d[n] = v;
    }
  }

  // ---------- surface nets mesher ----------
  // Returns positions relative to the chunk's own corner (cx*CH, ...), normals, and for each vertex the
  // depth below the untouched surface (for colouring by layer) plus its up-facing amount.
  const CORNERS = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  function meshChunk(c) {
    const d = c.d, C = S - 1;                 // cells per side
    const vidx = new Int32Array(C * C * C).fill(-1);
    const pos = [], nrm = [], depth = [], upness = [], idx = [];
    const ccx = (c.cx + 0.5) * CH, ccy = (c.cy + 0.5) * CH, ccz = (c.cz + 0.5) * CH, cl = Math.hypot(ccx, ccy, ccz);
    const upx = ccx / cl, upy = ccy / cl, upz = ccz / cl;      // local "up" (constant enough across one chunk)
    const val = new Float32Array(8);
    for (let k = 0; k < C; k++) for (let j = 0; j < C; j++) for (let i = 0; i < C; i++) {
      let mask = 0;
      for (let q = 0; q < 8; q++) { const o = CORNERS[q]; const v = d[(i + o[0]) + S * ((j + o[1]) + S * (k + o[2]))]; val[q] = v; if (v > 0) mask |= 1 << q; }
      if (mask === 0 || mask === 255) continue;
      let sx = 0, sy = 0, sz = 0, n = 0;
      for (const [a, b] of EDGES) {
        const va = val[a], vb = val[b]; if ((va > 0) === (vb > 0)) continue;
        const t = va / (va - vb), A = CORNERS[a], B = CORNERS[b];
        sx += A[0] + t * (B[0] - A[0]); sy += A[1] + t * (B[1] - A[1]); sz += A[2] + t * (B[2] - A[2]); n++;
      }
      const fx = i + sx / n, fy = j + sy / n, fz = k + sz / n;
      // gradient of solid-ness (points into the ground) → normal points out
      let gx = (val[1] - val[0]) + (val[3] - val[2]) + (val[5] - val[4]) + (val[7] - val[6]);
      let gy = (val[2] - val[0]) + (val[3] - val[1]) + (val[6] - val[4]) + (val[7] - val[5]);
      let gz = (val[4] - val[0]) + (val[5] - val[1]) + (val[6] - val[2]) + (val[7] - val[3]);
      const gl = Math.hypot(gx, gy, gz) || 1; gx = -gx / gl; gy = -gy / gl; gz = -gz / gl;
      vidx[i + C * (j + C * k)] = pos.length / 3;
      pos.push((fx - 1) * VOX, (fy - 1) * VOX, (fz - 1) * VOX);
      nrm.push(gx, gy, gz);
      // depth below the untouched surface at this vertex
      const wx = c.ox + fx * VOX, wy = c.oy + fy * VOX, wz = c.oz + fz * VOX;
      depth.push(R + c.hAt(fx, fy, fz) - Math.hypot(wx, wy, wz));
      upness.push(gx * upx + gy * upy + gz * upz);
    }
    // quads: one per sign-changing grid edge owned by this chunk (start sample index 1..N on all axes)
    const V = (i, j, k) => vidx[i + C * (j + C * k)];
    const quad = (a, b, cc, dd, flip) => {
      if (a < 0 || b < 0 || cc < 0 || dd < 0) return;
      if (flip) idx.push(a, cc, b, a, dd, cc); else idx.push(a, b, cc, a, cc, dd);
    };
    for (let k = 1; k <= N; k++) for (let j = 1; j <= N; j++) for (let i = 1; i <= N; i++) {
      const v0 = d[i + S * (j + S * k)] > 0;
      if (i < S - 1 && v0 !== (d[(i + 1) + S * (j + S * k)] > 0))   // x edge: cells (i, j-1..j, k-1..k)
        quad(V(i, j - 1, k - 1), V(i, j, k - 1), V(i, j, k), V(i, j - 1, k), !v0);
      if (j < S - 1 && v0 !== (d[i + S * ((j + 1) + S * k)] > 0))   // y edge
        quad(V(i - 1, j, k - 1), V(i - 1, j, k), V(i, j, k), V(i, j, k - 1), !v0);
      if (k < S - 1 && v0 !== (d[i + S * (j + S * (k + 1))] > 0))   // z edge
        quad(V(i - 1, j - 1, k), V(i, j - 1, k), V(i, j, k), V(i - 1, j, k), !v0);
    }
    return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), depth: new Float32Array(depth), upness: new Float32Array(upness), idx: pos.length / 3 > 65535 ? new Uint32Array(idx) : new Uint16Array(idx) };
  }

  // ---------- geography helpers ----------
  function fromLatLon(lat, lon) { const a = lat * Math.PI / 180, b = lon * Math.PI / 180; return [Math.cos(a) * Math.cos(b), Math.sin(a), -Math.cos(a) * Math.sin(b)]; }
  function toLatLon(x, y, z) { const l = Math.hypot(x, y, z); return [Math.asin(y / l) * 180 / Math.PI, Math.atan2(-z, x) * 180 / Math.PI]; }

  root.World = { R, VOX, N, CH, S, noise, hash01, ihash, height, heightDir, heightAt, solid, depthAt, addHole, clearHoles, holes, key,
    chunkMayHaveSurface, sampleChunk, carve, meshChunk, fromLatLon, toLatLon };
})(typeof window !== 'undefined' ? window : globalThis);
