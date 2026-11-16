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
  // Real relief: a ~20 m grid around the start and a ~2 km grid over Ukraine (tools/build-dem.py), smooth bicubic
  // interpolation, plus small bumps for the ground near the player. Outside the grids: invented gentle relief.
  let DEM = null;
  function setDem(d) { DEM = d; }   // { local: { box, w, h, data: Int16Array (dm) }, ukraine: {...} }
  const cr = (p0, p1, p2, p3, t) => p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
  function demAt(g, lat, lon) {   // metres, or NaN outside; also returns the edge fade in g.fade
    const b = g.box, fx = (lon - b[0]) / (b[1] - b[0]) * (g.w - 1), fy = (b[3] - lat) / (b[3] - b[2]) * (g.h - 1);
    if (fx < 1 || fy < 1 || fx > g.w - 3 || fy > g.h - 3) { g.fade = 0; return NaN; }
    const x = Math.floor(fx), y = Math.floor(fy), tx = fx - x, ty = fy - y, d = g.data, w = g.w;
    const row = j => { const o = j * w + x; return cr(d[o - 1], d[o], d[o + 1], d[o + 2], tx); };
    g.fade = Math.min(1, Math.min(fx, fy, g.w - 1 - fx, g.h - 1 - fy) / 25);
    return cr(row(y - 1), row(y), row(y + 1), row(y + 2), ty) * (g.unit || 0.1);
  }
  // ---------- the whole Earth: 15° blocks of a 1/30° grid (~3.7 km), dem/world/<col>_<row>.txt ----------
  // Blocks are loaded around the player (game), on first use (server, see setBlockLoader), and sent to the mesher threads.
  let WD = null, lastBlk = null, lastRough = 0;
  const blocks = new Map();
  let blockLoader = null;
  function setWorldDem(info) { WD = info; }
  function setWorldBlock(k, data) { blocks.set(k, data); lastBlk = null; }
  function setBlockLoader(f) { blockLoader = f; }
  // a block file after inflating: int16 deltas along each row, first column down -> elevations
  function decodeBlock(deltas) {
    const S = WD.size, e = new Int16Array(S * S);
    for (let j = 0; j < S; j++) { const o = j * S; e[o] = (j ? e[o - S] : 0) + deltas[o]; for (let i = 1; i < S; i++) e[o + i] = e[o + i - 1] + deltas[o + i]; }
    return e;
  }
  function blockOf(lat, lon) { const B = WD.block; return [Math.min(WD.cols - 1, Math.max(0, Math.floor((lon + 180) / B))), Math.min(WD.rows - 1, Math.max(0, Math.floor((90 - lat) / B)))]; }
  function blockKey(lat, lon) { const [c, r] = blockOf(lat, lon); return c + '_' + r; }
  function worldAt(lat, lon) {   // metres (sea floor negative), NaN while its block is not loaded
    if (!WD) return NaN;
    if (lon >= 180) lon -= 360; else if (lon < -180) lon += 360;
    const B = WD.block, S = WD.size;
    let L = lastBlk;
    if (!L || lon < L.lon0 || lon >= L.lon0 + B || lat > L.lat1 || lat <= L.lat1 - B) {
      const [c, r] = blockOf(lat, lon), k = c + '_' + r;
      let d = blocks.get(k);
      if (!d && blockLoader) { d = blockLoader(k); if (d) blocks.set(k, d); }
      if (!d) return NaN;
      L = lastBlk = { d, lon0: -180 + c * B, lat1: 90 - r * B };
    }
    const d = L.d, fx = (lon - L.lon0) / WD.step + 1, fy = (L.lat1 - lat) / WD.step + 1;
    const x = Math.min(S - 3, Math.max(1, Math.floor(fx))), y = Math.min(S - 3, Math.max(1, Math.floor(fy))), tx = fx - x, ty = fy - y;
    const row = j => { const o = j * S + x; return cr(d[o - 1], d[o], d[o + 1], d[o + 2], tx); };
    const o = y * S + x, a = d[o], b = d[o + 1], c2 = d[o + S], e = d[o + S + 1];
    lastRough = Math.max(a, b, c2, e) - Math.min(a, b, c2, e);
    return cr(row(y - 1), row(y), row(y + 1), row(y + 2), ty);
  }


  // ---------- HD relief: Terrarium tiles at zoom 12 (~40 m), streamed around the player ----------
  // Only where the game may reach the internet (Steam build) and on the server, which loads the same tiles around
  // every player, so both measure the same ground. Where a tile is missing the 3.7 km grid is used; next to a missing
  // neighbour the tile fades out over 32 pixels, so there is never a cliff at the edge of what is loaded.
  const HDZ = 12, HDN = 4096, HDP = HDN * 256, hdTiles = new Map();
  let hdCount = 0;
  function setHDTile(x, y, data) { hdTiles.set(x * 8192 + y, data); hdCount++; lastHD = null; }
  const hasHD = (x, y) => hdTiles.has((((x % HDN) + HDN) % HDN) * 8192 + y);
  const mercY = lat => { const sn = Math.sin(Math.max(-85.05, Math.min(85.05, lat)) * Math.PI / 180); return 0.5 - Math.log((1 + sn) / (1 - sn)) / (4 * Math.PI); };
  let lastHD = null;
  function hdPix(X, Y) {   // one pixel (metres) anywhere, NaN when its tile is not loaded
    const tx = ((Math.floor(X / 256) % HDN) + HDN) % HDN, ty = Math.floor(Y / 256), d = hdTiles.get(tx * 8192 + ty);
    return d ? d[(Y - ty * 256) * 256 + (((X % 256) + 256) % 256)] : NaN;
  }
  function hdAt(lat, lon) {   // bicubic height and the edge fade in hdFade
    if (!hdCount) return NaN;
    const fx = (lon + 180) / 360 * HDP - 0.5, fy = mercY(lat) * HDP - 0.5, x = Math.floor(fx), y = Math.floor(fy), tx = fx - x, ty = fy - y;
    const row = j => cr(hdPix(x - 1, j), hdPix(x, j), hdPix(x + 1, j), hdPix(x + 2, j), tx);
    const v = cr(row(y - 1), row(y), row(y + 1), row(y + 2), ty);
    if (v !== v) return NaN;
    const X = Math.floor(fx / 256), Y = Math.floor(fy / 256), px = fx - X * 256, py = fy - Y * 256;
    let f = 1;
    if (!hasHD(X - 1, Y)) f = Math.min(f, px / 32); if (!hasHD(X + 1, Y)) f = Math.min(f, (255 - px) / 32);
    if (!hasHD(X, Y - 1)) f = Math.min(f, py / 32); if (!hasHD(X, Y + 1)) f = Math.min(f, (255 - py) / 32);
    hdFade = Math.max(0, Math.min(1, f)); return v;
  }
  let hdFade = 0;
  // which tile a place is in (for loaders)
  function hdTileOf(lat, lon) { return [Math.floor((lon + 180) / 360 * HDN), Math.floor(mercY(lat) * HDN)]; }
  // a Terrarium PNG's pixels (RGBA bytes) -> metres
  function decodeTerrarium(rgba) { const out = new Float32Array(65536); for (let i = 0; i < 65536; i++) out[i] = rgba[i * 4] * 256 + rgba[i * 4 + 1] + rgba[i * 4 + 2] / 256 - 32768; return out; }

  // ---------- lakes and rivers (dem/water/*.txt, tools/build-water.py) ----------
  // Per 15° block: a 1/120° lake raster (lake id * 16 + cells inside the shore) and river segments
  // [lat0, lon0, lat1, lon1, level0, level1, width]. The ground is cut down to the lake bed / river bed here,
  // so the game, the mesher threads and the server all see the same banks.
  let WTR = null, waterLoader = null, lastW = null;
  const wblocks = new Map();
  function setWaterInfo(info) { WTR = info; WTR.has = new Set(info.blocks); }
  function setWaterLoader(f) { waterLoader = f; }
  function setWaterBlock(k, o) {   // o: { lakes: Uint16Array | null, rivers: Float32Array | null }
    const B = WTR.block, [c, r] = k.split('_').map(Number), lon0 = -180 + c * B, lat1 = 90 - r * B, grid = new Map(), G = 0.05;
    const R = o.rivers;
    if (R) for (let i = 0; i < R.length; i += 7) {   // index each segment in the 0.05° cells it can touch (with its half width)
      const pad = (R[i + 6] * 0.5 + 60) / 111200 + 0.002, a0 = Math.min(R[i], R[i + 2]) - pad, a1 = Math.max(R[i], R[i + 2]) + pad, cs = Math.max(0.2, Math.cos(R[i] * Math.PI / 180));
      const b0 = Math.min(R[i + 1], R[i + 3]) - pad / cs, b1 = Math.max(R[i + 1], R[i + 3]) + pad / cs;
      for (let y = Math.floor(a0 / G); y <= Math.floor(a1 / G); y++) for (let x = Math.floor(b0 / G); x <= Math.floor(b1 / G); x++) { const key = y * 100000 + x; let l = grid.get(key); if (!l) grid.set(key, l = []); l.push(i); }
    }
    wblocks.set(k, { lakes: o.lakes, rivers: R, grid, lon0, lat1 }); lastW = null;
  }
  // water at a place: out.lf (cells inside a lake, bilinear, 0 = dry), out.ll lake level, out.ld lake max depth;
  // out.rd distance to the nearest river centre (m), out.rw its width, out.rl its level (rd = Infinity when none near)
  function waterAt(lat, lon, out) {
    out.lf = 0; out.rd = Infinity;
    if (!WTR) return out;
    if (lon >= 180) lon -= 360; else if (lon < -180) lon += 360;
    const B = WTR.block;
    let L = lastW;
    if (!L || lon < L.lon0 || lon >= L.lon0 + B || lat > L.lat1 || lat <= L.lat1 - B) {
      const c = Math.min(23, Math.max(0, Math.floor((lon + 180) / B))), r = Math.min(11, Math.max(0, Math.floor((90 - lat) / B))), k = c + '_' + r;
      if (!WTR.has.has(k)) { lastW = { lon0: -180 + c * B, lat1: 90 - r * B, none: true }; return out; }
      L = wblocks.get(k);
      if (!L && waterLoader) { const o = waterLoader(k); if (o) { setWaterBlock(k, o); L = wblocks.get(k); } }
      if (!L) return out;
      lastW = L;
    }
    if (L.none) return out;
    if (L.lakes) {
      const S = WTR.size, fx = (lon - L.lon0) * WTR.res - 0.5, fy = (L.lat1 - lat) * WTR.res - 0.5;
      const x = Math.max(0, Math.min(S - 2, Math.floor(fx))), y = Math.max(0, Math.min(S - 2, Math.floor(fy))), tx = Math.max(0, Math.min(1, fx - x)), ty = Math.max(0, Math.min(1, fy - y)), d = L.lakes;
      const a = d[y * S + x], b = d[y * S + x + 1], c = d[(y + 1) * S + x], e = d[(y + 1) * S + x + 1];
      if (a | b | c | e) {
        const f = ((a & 15) * (1 - tx) + (b & 15) * tx) * (1 - ty) + ((c & 15) * (1 - tx) + (e & 15) * tx) * ty;
        const id = Math.max(a, b, c, e) >> 4, li = WTR.lakes[id - 1];
        if (li) { out.lf = f; out.ll = li[0]; out.ld = li[1]; }
      }
    }
    if (L.rivers) {
      const G = 0.05, list = L.grid.get(Math.floor(lat / G) * 100000 + Math.floor(lon / G));
      if (list) {
        const R = L.rivers, cs = Math.cos(lat * Math.PI / 180) * 111200; let best = Infinity;
        for (const i of list) {
          const ax = (R[i + 1] - lon) * cs, ay = (R[i] - lat) * 111200, bx = (R[i + 3] - lon) * cs, by = (R[i + 2] - lat) * 111200;
          const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy;
          let t = l2 > 0 ? -(ax * vx + ay * vy) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
          const dx = ax + vx * t, dy = ay + vy * t, dd = Math.sqrt(dx * dx + dy * dy) - R[i + 6] * 0.5;   // distance past the river's edge
          if (dd < best) { best = dd; out.rd = dd + R[i + 6] * 0.5; out.rw = R[i + 6]; out.rl = R[i + 4] + (R[i + 5] - R[i + 4]) * t; }
        }
      }
    }
    return out;
  }
  // river segments around a place (from loaded blocks): flat [lat0, lon0, lat1, lon1, level0, level1, width, ...]
  function riversNear(lat, lon, rad) {
    const out = [], G = 0.05, seen = new Set(), cs = Math.max(0.2, Math.cos(lat * Math.PI / 180));
    for (const [k, L] of wblocks) {
      if (!L.rivers) continue;
      for (let y = Math.floor((lat - rad) / G); y <= Math.floor((lat + rad) / G); y++) for (let x = Math.floor((lon - rad / cs) / G); x <= Math.floor((lon + rad / cs) / G); x++) {
        const l = L.grid.get(y * 100000 + x); if (!l) continue;
        for (const i of l) { const key = k + ':' + i; if (seen.has(key)) continue; seen.add(key); for (let q = 0; q < 7; q++) out.push(L.rivers[i + q]); }
      }
    }
    return out;
  }
  // the water table: groundwater stands this high under the ground (5-14 m down, shallow near rivers and lakes)
  const WT2 = {};
  function waterTable(x, y, z) {
    const l = Math.hypot(x, y, z), dx = x / l, dy = y / l, dz = z / l, h = heightDir(dx, dy, dz);
    let d = 5 + 9 * (noise(dx * R / 2500, dy * R / 2500, dz * R / 2500, 221) * 0.5 + 0.5);
    if (WTR) { waterAt(Math.asin(dy) * 57.29578, Math.atan2(-dz, dx) * 57.29578, WT2); if (WT2.lf > 0) d = Math.min(d, 0.8); else if (WT2.rd < 600) d = Math.min(d, 1.5 + WT2.rd / 600 * 3); }
    return h - d;
  }
  const WT = {};
  // cut the ground to the water: lake beds and shelving shores, river channels with low banks
  function carveWater(h, lat, lon) {
    waterAt(lat, lon, WT);
    if (WT.lf > 0) h = Math.min(h, Math.max(WT.ll - WT.ld, WT.ll + (0.6 - WT.lf) * 12));
    if (WT.rd < Infinity) {
      const half = WT.rw * 0.5, x = WT.rd / half, depth = 1.2 + WT.rw / 60;
      if (x < 1) h = Math.min(h, WT.rl - 0.35 - depth * (1 - x * x));
      else if (WT.rd < half + 40 + WT.rw * 0.3) h = Math.min(h, WT.rl + 0.3 + (WT.rd - half) * 0.15);
    }
    return h;
  }

  // ---------- ~40 m patches: famous volcanoes, craters, mountains, canyons (dem/patches/*.txt) ----------
  let PATCHES = [], patchLoader = null;
  function setPatches(list) { PATCHES = list.map(p => Object.assign({ data: null, unit: 0.5, tried: false }, p)); }
  function setPatchData(id, data) { const p = PATCHES.find(q => q.id === id); if (p) p.data = data; }
  function setPatchLoader(f) { patchLoader = f; }
  function decodePatch(deltas, w, h) {
    const e = new Int16Array(w * h);
    for (let j = 0; j < h; j++) { const o = j * w; e[o] = (j ? e[o - w] : 0) + deltas[o]; for (let i = 1; i < w; i++) e[o + i] = e[o + i - 1] + deltas[o + i]; }
    return e;
  }
  function patchBlend(h, lat, lon) {
    for (const p of PATCHES) {
      const b = p.box; if (lon < b[0] || lon > b[1] || lat < b[2] || lat > b[3]) continue;
      if (!p.data && patchLoader && !p.tried) { p.tried = true; p.data = patchLoader(p); }
      if (!p.data) continue;
      const v = demAt(p, lat, lon); if (v !== v) continue;
      const f = Math.min(1, p.fade * 2.5), k = f * f * (3 - 2 * f); h = h + (v - h) * k;
    }
    return h;
  }
  function height(qx, qy, qz) {
    const lat = Math.asin(Math.max(-1, Math.min(1, qy / R))) * 57.29577951308232, lon = Math.atan2(-qz, qx) * 57.29577951308232;
    let h = worldAt(lat, lon);
    if (h === h) {
      // between the 3.7 km samples: rocky detail where the land is rugged (mountains, volcanoes), almost none on plains
      const rough = Math.min(1500, lastRough);
      if (rough > 25) h += (noise(qx / 1100, qy / 1100, qz / 1100, 71) * 0.55 + noise(qx / 380, qy / 380, qz / 380, 73) * 0.3 + noise(qx / 120, qy / 120, qz / 120, 79) * 0.15) * (rough - 25) * 0.16;
      h += noise(qx / 700, qy / 700, qz / 700, 23) * 2.5;
    } else h = inventedHeight(qx, qy, qz);
    if (DEM) {   // finer real grids: Ukraine (~2 km)
      const hu = demAt(DEM.ukraine, lat, lon);
      if (hu === hu) h = h + (hu - h) * DEM.ukraine.fade;
    }
    if (PATCHES.length) h = patchBlend(h, lat, lon);   // famous places (~40 m)
    if (hdCount) { const v = hdAt(lat, lon); if (v === v) { const k = hdFade * hdFade * (3 - 2 * hdFade); h = h + (v - h) * k; } }   // HD tiles (~40 m), Steam build and server
    if (DEM) {   // the start (~20 m)
      const hl = demAt(DEM.local, lat, lon);
      if (hl === hl) { const f = DEM.local.fade, k = f * f * (3 - 2 * f); h = h + (hl - h) * k; }
    }
    h += noise(qx / 35, qy / 35, qz / 35, 41) * 0.35 + noise(qx / 9, qy / 9, qz / 9, 53) * 0.1;
    return WTR ? carveWater(h, lat, lon) : h;
  }
  function inventedHeight(qx, qy, qz) {
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
  const bigIndex = new Map();       // coarse chunk key -> big holes only
  const smallIndex = new Map();     // fine box key -> small holes that reach into it (keeps solid() fast with thousands of scoops)
  const fineByChunk = new Map();    // coarse chunk key -> [[a, b, c], ...] fine boxes inside it (fast culling of coarse quads)
  const push = (m, k, h) => { let l = m.get(k); if (!l) m.set(k, l = []); l.push(h); };
  function boxesTouching(L, x, y, z, pad) {
    const out = [], c = L.CH;
    const x0 = Math.floor((x - pad) / c), x1 = Math.floor((x + pad) / c), y0 = Math.floor((y - pad) / c), y1 = Math.floor((y + pad) / c), z0 = Math.floor((z - pad) / c), z1 = Math.floor((z + pad) / c);
    for (let a = x0; a <= x1; a++) for (let b = y0; b <= y1; b++) for (let k = z0; k <= z1; k++) out.push([a, b, k]);
    return out;
  }
  // Returns what has to be re-meshed: { coarse: [keys], fine: [keys] }
  function addHole(x, y, z, r) {
    const h = [x, y, z, r]; holes.push(h); const rk = r + holeK(r);
    for (const [a, b, c] of boxesTouching(LC, x, y, z, rk + VOX * 2)) { const k = key(a, b, c); push(holeIndex, k, h); if (r >= BIG) push(bigIndex, k, h); }
    if (r < BIG) for (const [a, b, c] of boxesTouching(LF, x, y, z, rk + LF.VOX * 2)) push(smallIndex, key(a, b, c), h);
    const coarse = new Set(), fine = [];
    if (r >= BIG) for (const [a, b, c] of boxesTouching(LC, x, y, z, rk + VOX * 1.5)) coarse.add(key(a, b, c));
    // big holes live on the coarse grid: only fine boxes that already exist there are re-meshed (no new ones —
    // a 3 m hole would otherwise make thousands of 0.8 m boxes)
    if (r >= BIG) {
      const seen = new Set();
      for (const [a, b, c] of boxesTouching(LC, x, y, z, rk + VOX * 2)) { const l = fineByChunk.get(key(a, b, c)); if (l) for (const [fa, fb, fc] of l) { const fk = key(fa, fb, fc); if (!seen.has(fk) && fineTouches(fa, fb, fc, h)) { seen.add(fk); fine.push(fk); } } }
      return { coarse: [...coarse], fine };
    }
    // small holes: fine boxes around the hole, with a margin so its edge never meets the coarse mesh
    for (const [a, b, c] of boxesTouching(LF, x, y, z, rk + 0.45)) {
      const k = key(a, b, c), wx = (a + 0.5) * LF.CH, wy = (b + 0.5) * LF.CH, wz = (c + 0.5) * LF.CH;
      if (Math.abs(depthAt(wx, wy, wz)) > LF.CH * 0.9 + 0.05 && !holeNear(wx, wy, wz, LF.CH)) continue;   // nowhere near the surface
      const isNew = !fineSet.has(k);
      if (isNew) { fineSet.add(k); const ck = key(Math.floor(a / FPC), Math.floor(b / FPC), Math.floor(c / FPC)); coarse.add(ck); push(fineByChunk, ck, [a, b, c]); }
      if (isNew || fineTouches(a, b, c, h)) fine.push(k);
    }
    return { coarse: [...coarse], fine };
  }
  function fineTouches(a, b, c, h) { const p = h[3] + holeK(h[3]) + LF.VOX * 2, c0 = LF.CH; return h[0] + p > a * c0 && h[0] - p < (a + 1) * c0 && h[1] + p > b * c0 && h[1] - p < (b + 1) * c0 && h[2] + p > c * c0 && h[2] - p < (c + 1) * c0; }
  function holeNear(x, y, z, pad) { const l = holeIndex.get(key(Math.floor(x / CH), Math.floor(y / CH), Math.floor(z / CH))); if (l) for (const h of l) if (Math.hypot(x - h[0], y - h[1], z - h[2]) < h[3] + holeK(h[3]) + pad) return true; return false; }
  function clearHoles() { holes.length = 0; holeIndex.clear(); bigIndex.clear(); smallIndex.clear(); fineSet.clear(); fineByChunk.clear(); }
  const isFineCell = (x, y, z) => fineSet.has(key(Math.floor(x / LF.CH), Math.floor(y / LF.CH), Math.floor(z / LF.CH)));

  // Holes are joined smoothly: where two holes (or a hole and the open air) come within k of each other the ground
  // between them goes too, so no paper-thin walls or lips are left (they cannot be drawn on a 0.4 m grid anyway).
  const holeK = r => Math.min(0.9, r * 0.45);
  const cut = (s, d, k) => { const h = Math.max(k - Math.abs(s - d), 0) / k; return Math.min(s, d) - h * h * k * 0.25; };
  // Solid-ness at any point (≈ signed distance to the surface, positive inside the ground).
  function solid(px, py, pz) {
    const l = Math.hypot(px, py, pz);
    let s = R + heightDir(px / l, py / l, pz / l) - l;
    const list = bigIndex.get(key(Math.floor(px / CH), Math.floor(py / CH), Math.floor(pz / CH)));
    if (list) for (const h of list) { const d = Math.hypot(px - h[0], py - h[1], pz - h[2]) - h[3]; if (d < s + 0.9) s = cut(s, d, holeK(h[3])); }
    const sl = smallIndex.get(key(Math.floor(px / LF.CH), Math.floor(py / LF.CH), Math.floor(pz / LF.CH)));
    if (sl) for (const h of sl) { const d = Math.hypot(px - h[0], py - h[1], pz - h[2]) - h[3]; if (d < s + 0.9) s = cut(s, d, holeK(h[3])); }
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
  const sampleChunk = (cx, cy, cz) => sampleBox(LC, cx, cy, cz, bigIndex.get(key(cx, cy, cz)));
  function sampleFine(a, b, c) {
    const list = (bigIndex.get(key(Math.floor(a / FPC), Math.floor(b / FPC), Math.floor(c / FPC))) || []).concat(smallIndex.get(key(a, b, c)) || []);
    return sampleBox(LF, a, b, c, list, h => fineTouches(a, b, c, h));
  }
  // Apply one hole to sampled density (only the samples in its box).
  function carve(c, h) {
    const { VOX: vox, S: s } = c.L, d = c.d, ox = c.ox, oy = c.oy, oz = c.oz, k = holeK(h[3]), r = h[3] + vox * 1.5 + k;
    const i0 = Math.max(0, Math.floor((h[0] - r - ox) / vox)), i1 = Math.min(s - 1, Math.ceil((h[0] + r - ox) / vox));
    const j0 = Math.max(0, Math.floor((h[1] - r - oy) / vox)), j1 = Math.min(s - 1, Math.ceil((h[1] + r - oy) / vox));
    const k0 = Math.max(0, Math.floor((h[2] - r - oz) / vox)), k1 = Math.min(s - 1, Math.ceil((h[2] + r - oz) / vox));
    for (let kk = k0; kk <= k1; kk++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const v = Math.hypot(ox + i * vox - h[0], oy + j * vox - h[1], oz + kk * vox - h[2]) - h[3];
      const n = i + s * (j + s * kk); if (v < d[n] + 0.9) d[n] = cut(d[n], v, k);
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
    if (coarse && fineSet.size) {   // which cells are covered by fine boxes (boxes of this chunk and its neighbours)
      let any = false; const F = LF.CH;
      for (let A = -1; A <= 1; A++) for (let B = -1; B <= 1; B++) for (let D = -1; D <= 1; D++) {
        const list = fineByChunk.get(key(c.cx + A, c.cy + B, c.cz + D)); if (!list) continue;
        for (const [a, b, e] of list) {
          // cells whose centres lie inside the box: centre = o + (i + 0.5) * vox
          const i0 = Math.max(0, Math.ceil((a * F - c.ox) / vox - 0.5)), i1 = Math.min(C - 1, Math.ceil(((a + 1) * F - c.ox) / vox - 0.5) - 1);
          const j0 = Math.max(0, Math.ceil((b * F - c.oy) / vox - 0.5)), j1 = Math.min(C - 1, Math.ceil(((b + 1) * F - c.oy) / vox - 0.5) - 1);
          const k0 = Math.max(0, Math.ceil((e * F - c.oz) / vox - 0.5)), k1 = Math.min(C - 1, Math.ceil(((e + 1) * F - c.oz) / vox - 0.5) - 1);
          if (i0 > i1 || j0 > j1 || k0 > k1) continue;
          if (!culled) culled = new Uint8Array(C * C * C);
          for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) culled[i + C * (j + C * k)] = 1;
          any = true;
        }
      }
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

  // kind 'c' = coarse chunk (a, b, c), 'f' = fine box. Result is plain typed arrays (can be sent between threads).
  function buildMesh(kind, a, b, c) {
    const fine = kind === 'f', L = fine ? LF : LC;
    const m = meshChunk(fine ? sampleFine(a, b, c) : sampleChunk(a, b, c));
    const bx = a * L.CH, by = b * L.CH, bz = c * L.CH, n = m.pos.length / 3, mats = new Int8Array(n);
    for (let i = 0; i < n; i++) mats[i] = m.depth[i] <= 0 ? -1 : materialAt(bx + m.pos[i * 3], by + m.pos[i * 3 + 1], bz + m.pos[i * 3 + 2]);
    m.mats = mats; m.base = [bx, by, bz]; return m;
  }

  // ---------- places that can't be dug (under buildings and fixed props) ----------
  // [x, y, z, r]: a vertical cylinder of radius r around the point (planet metres), any depth.
  const blockers = [];
  function blocked(x, y, z, pad) {
    for (const b of blockers) {
      const l = Math.hypot(b[0], b[1], b[2]), ux = b[0] / l, uy = b[1] / l, uz = b[2] / l;
      const dx = x - b[0], dy = y - b[1], dz = z - b[2], along = dx * ux + dy * uy + dz * uz;
      const hx = dx - ux * along, hy = dy - uy * along, hz = dz - uz * along;
      if (b[5] === 'rig' && pad < 0) continue;   // a rig may dig under itself (called with a negative pad)
      if (along < 6 && hx * hx + hy * hy + hz * hz < (b[3] + Math.abs(pad)) * (b[3] + Math.abs(pad))) return b;
    }
    return obstacleAt(x, y, z, Math.abs(pad));
  }

  // ---------- scenery obstacles: rocks, tree trunks, bushes ----------
  // { x, y, z: base point, ux, uy, uz: local up, r: radius, h: height } — vertical cylinders, refreshed by the scene
  // for what stands around the player. They stop the dig ray, protect the ground under them and stop the player.
  const obstacles = [];
  function setObstacles(list) { obstacles.length = 0; for (const o of list) obstacles.push(o); }
  // distance along the ray to the first obstacle, or Infinity
  function rayObstacle(ox, oy, oz, dx, dy, dz, maxT) {
    let best = Infinity;
    for (const o of obstacles) {
      const wx = ox - o.x, wy = oy - o.y, wz = oz - o.z, wu = wx * o.ux + wy * o.uy + wz * o.uz, du = dx * o.ux + dy * o.uy + dz * o.uz;
      const px = wx - o.ux * wu, py = wy - o.uy * wu, pz = wz - o.uz * wu, qx = dx - o.ux * du, qy = dy - o.uy * du, qz = dz - o.uz * du;
      const cc = px * px + py * py + pz * pz - o.r * o.r;
      if (cc > (maxT + o.r) * (maxT + o.r) * 4) continue;
      const a = qx * qx + qy * qy + qz * qz, b = 2 * (px * qx + py * qy + pz * qz);
      if (a > 1e-9) { const disc = b * b - 4 * a * cc; if (disc >= 0) { const t = (-b - Math.sqrt(disc)) / (2 * a); const hu = wu + t * du; if (t > 0 && t < best && hu >= 0 && hu <= o.h) best = t; } }
      if (du < -1e-6) { const t = (o.h - wu) / du; if (t > 0 && t < best) { const ex = px + qx * t, ey = py + qy * t, ez = pz + qz * t; if (ex * ex + ey * ey + ez * ez <= o.r * o.r) best = t; } }
    }
    return best <= maxT ? best : Infinity;
  }
  // an obstacle whose footprint (radius r + pad) covers this point, at any depth below its top
  function obstacleAt(x, y, z, pad) {
    for (const o of obstacles) {
      const dx = x - o.x, dy = y - o.y, dz = z - o.z, along = dx * o.ux + dy * o.uy + dz * o.uz;
      if (along > o.h + pad || along < -30) continue;
      const hx = dx - o.ux * along, hy = dy - o.uy * along, hz = dz - o.uz * along, r = o.r + pad;
      if (hx * hx + hy * hy + hz * hz < r * r) return o;
    }
    return null;
  }

  // ---------- what the ground is made of ----------
  // 0 topsoil (chernozem, 0-1.4 m), 1 loess clay (to 16 m), 2 granite/gneiss, 3 magnetite quartzite (iron ore, ~30 % Fe),
  // 4 rich hematite ore (~60 % Fe). The Kryvbas strip runs through the real open pits; inside it, ore pockets sit in the clay
  // from ~1.7 m and banded iron formation fills the rock below 16 m.
  const KRYVBAS = [[47.62, 33.20], [47.78, 33.26], [47.87, 33.31], [47.94, 33.36], [48.02, 33.42], [48.12, 33.47], [48.35, 33.50]].map(([la, lo]) => [lo * 74.6, la * 111.2]);
  function kryvbas(lat, lon) {   // signed distance (km) across the strip; + is east
    const px = lon * 74.6, py = lat * 111.2; let best = 1e9, side = 1;
    for (let i = 0; i < KRYVBAS.length - 1; i++) {
      const [ax, ay] = KRYVBAS[i], [bx, by] = KRYVBAS[i + 1], dx = bx - ax, dy = by - ay;
      let t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy); t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = px - ax - dx * t, ey = py - ay - dy * t, d = Math.hypot(ex, ey);
      if (d < best) { best = d; side = (dx * ey - dy * ex) < 0 ? 1 : -1; }
    }
    return best * side;
  }
  // What the ground is made of. 0 topsoil, 1 clay / loess, 2 granite (bedrock), 3 magnetite quartzite, 4 hematite,
  // 5 sand and gravel, 6 limestone, 7 basalt, 8 coal. Kryvbas keeps its own ore strip; elsewhere the layers are
  // soil -> clay with sand lenses (2-16 m) -> limestone with coal seams (0-50 m thick, where the region has it)
  // -> bedrock: granite, or basalt in volcanic provinces. Thicknesses change slowly from region to region.
  function materialAt(x, y, z) {
    const l = Math.hypot(x, y, z), d = R + heightDir(x / l, y / l, z / l) - l;
    if (d < 1.4 + noise(x / 7, y / 7, z / 7, 61) * 0.25) return 0;
    const lat = Math.asin(y / l) * 57.29577951308232, lon = Math.atan2(-z, x) * 57.29577951308232;
    const across = kryvbas(lat, lon), zone = 1 - Math.min(1, Math.max(0, (Math.abs(across) - 3.0) / 2.0));
    if (zone > 0) {
      if (d < 16) {
        if (d > 1.7) {
          const n = noise(x / 1.8, y / 1.8, z / 1.8, 101) * 0.8 + noise(x / 0.55, y / 0.55, z / 0.55, 103) * 0.25;
          if (n > 0.44 - 0.12 * zone) return n > 0.64 && d > 2.6 ? 4 : 3;
        }
        return 1;
      }
      const b = Math.sin(across * 1000 * 2 * Math.PI / 7 + d * 0.35 + noise(x / 9, y / 9, z / 9, 107) * 2.2);   // steeply dipping bands
      if (b > 0.25 - 0.3 * (1 - zone)) return noise(x / 4, y / 4, z / 4, 109) > 0.35 ? 4 : 3;
      return 2;
    }
    const clayB = 9 + noise(x / 3000, y / 3000, z / 3000, 201) * 7;
    if (d < clayB) return noise(x / 6, y / 6, z / 6, 203) > 0.42 ? 5 : 1;
    const limeB = clayB + Math.max(0, 18 + noise(x / 5000, y / 5000, z / 5000, 205) * 34);
    if (d < limeB) {
      const donbas = lat > 47.4 && lat < 49.2 && lon > 37 && lon < 40.3 ? 0.35 : 0;
      if (noise(x / 20000, y / 20000, z / 20000, 209) + donbas > 0.12 && Math.sin(d * 0.9 + noise(x / 400, y / 400, z / 400, 207) * 3) > 0.9) return 8;
      return 6;
    }
    return noise(x / 8000, y / 8000, z / 8000, 211) > 0.5 ? 7 : 2;
  }
  // how hard each material is to dig: from 3 up it takes a pickaxe
  const HARD = [1, 1, 6, 2.5, 2, 0.8, 3, 6, 2];

  // ---------- geography helpers ----------
  function fromLatLon(lat, lon) { const a = lat * Math.PI / 180, b = lon * Math.PI / 180; return [Math.cos(a) * Math.cos(b), Math.sin(a), -Math.cos(a) * Math.sin(b)]; }
  function toLatLon(x, y, z) { const l = Math.hypot(x, y, z); return [Math.asin(y / l) * 180 / Math.PI, Math.atan2(-z, x) * 180 / Math.PI]; }

  root.World = { R, VOX, N, CH, S, BIG, LC, LF, noise, hash01, ihash, height, heightDir, setDem, setWorldDem, setWorldBlock, setBlockLoader, decodeBlock, setPatches, setPatchData, setPatchLoader, decodePatch, patches: () => PATCHES, setWaterInfo, setWaterLoader, setWaterBlock, waterAt, riversNear, setHDTile, hdTileOf, hasHD, decodeTerrarium, HDZ, waterTable, blockKey, blockOf, worldAt, hasBlock: k => blocks.has(k), heightAt, solid, depthAt, addHole, clearHoles, holes, key,
    chunkMayHaveSurface, sampleChunk, sampleFine, carve, meshChunk, buildMesh, fineSet, blockers, blocked, materialAt, HARD, kryvbas, obstacles, setObstacles, rayObstacle, obstacleAt, fromLatLon, toLatLon };
})(typeof window !== 'undefined' ? window : globalThis);
