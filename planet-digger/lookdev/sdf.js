// Smooth modelling toolkit: shapes are described as signed distance fields (SDF) blended with soft unions,
// then turned into dense meshes with exact, smooth normals. This is what gives the rounded "vinyl toy" look:
// no facets, no hard seams between parts.
'use strict';
(function (root) {
  const S = {};
  const sqrt = Math.sqrt, abs = Math.abs, min = Math.min, max = Math.max;

  // ---------- noise (deterministic) ----------
  function ihash(x, y, z) {
    let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(z | 0, 0x1b873593) ^ 0x9e3779b9;
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); return (h ^ (h >>> 16)) >>> 0;
  }
  S.hash = (x, y, z) => ihash(x, y, z) / 4294967296;
  function g3(h, x, y, z) { h &= 15; const u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14 ? x : z); return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); }
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  S.noise = function (x, y, z) {   // gradient noise, about -1..1
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi, u = fade(xf), v = fade(yf), w = fade(zf);
    const a = ihash(xi, yi, zi), b = ihash(xi + 1, yi, zi), c = ihash(xi, yi + 1, zi), d = ihash(xi + 1, yi + 1, zi);
    const e = ihash(xi, yi, zi + 1), f = ihash(xi + 1, yi, zi + 1), g = ihash(xi, yi + 1, zi + 1), k = ihash(xi + 1, yi + 1, zi + 1);
    const x1 = g3(a, xf, yf, zf) + u * (g3(b, xf - 1, yf, zf) - g3(a, xf, yf, zf)), x2 = g3(c, xf, yf - 1, zf) + u * (g3(d, xf - 1, yf - 1, zf) - g3(c, xf, yf - 1, zf));
    const x3 = g3(e, xf, yf, zf - 1) + u * (g3(f, xf - 1, yf, zf - 1) - g3(e, xf, yf, zf - 1)), x4 = g3(g, xf, yf - 1, zf - 1) + u * (g3(k, xf - 1, yf - 1, zf - 1) - g3(g, xf, yf - 1, zf - 1));
    const y1 = x1 + v * (x2 - x1), y2 = x3 + v * (x4 - x3); return y1 + w * (y2 - y1);
  };
  S.fbm = function (x, y, z, oct) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < (oct || 4); i++) { s += a * S.noise(x * f + i * 17.3, y * f + i * 5.1, z * f - i * 9.7); a *= 0.5; f *= 2.03; } return s; };
  S.rng = function (seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  // ---------- primitives (scalar args, no allocations) ----------
  S.sphere = (x, y, z, cx, cy, cz, r) => sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy) + (z - cz) * (z - cz)) - r;
  // capsule whose radius changes linearly from r1 at A to r2 at B
  S.cone = function (x, y, z, ax, ay, az, bx, by, bz, r1, r2) {
    const pax = x - ax, pay = y - ay, paz = z - az, bax = bx - ax, bay = by - ay, baz = bz - az;
    let h = (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz); h = h < 0 ? 0 : h > 1 ? 1 : h;
    const dx = pax - bax * h, dy = pay - bay * h, dz = paz - baz * h; return sqrt(dx * dx + dy * dy + dz * dz) - (r1 + (r2 - r1) * h);
  };
  S.ellipsoid = function (x, y, z, cx, cy, cz, rx, ry, rz) {
    const px = x - cx, py = y - cy, pz = z - cz, ax = px / rx, ay = py / ry, az = pz / rz, bx = px / (rx * rx), by = py / (ry * ry), bz = pz / (rz * rz);
    const k0 = sqrt(ax * ax + ay * ay + az * az), k1 = sqrt(bx * bx + by * by + bz * bz); return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -min(rx, ry, rz);
  };
  // rounded box in its own local coordinates (centre at origin)
  S.box = function (px, py, pz, hx, hy, hz, r) {
    const qx = abs(px) - hx + r, qy = abs(py) - hy + r, qz = abs(pz) - hz + r, mx = max(qx, 0), my = max(qy, 0), mz = max(qz, 0);
    return sqrt(mx * mx + my * my + mz * mz) + min(max(qx, max(qy, qz)), 0) - r;
  };
  // torus around an arbitrary unit axis (ux,uy,uz) through centre c
  S.torus = function (x, y, z, cx, cy, cz, ux, uy, uz, R, r) {
    const px = x - cx, py = y - cy, pz = z - cz, t = px * ux + py * uy + pz * uz, rad = sqrt(max(0, px * px + py * py + pz * pz - t * t)) - R; return sqrt(rad * rad + t * t) - r;
  };
  // upright capped cone, base radius r1 at y0, top radius r2 at y0+h, centred on (cx, cz)
  S.cappedCone = function (x, y, z, cx, y0, cz, h, r1, r2) {
    const qx = sqrt((x - cx) * (x - cx) + (z - cz) * (z - cz)), hh = h * 0.5, qy = y - y0 - hh;
    const k2x = r2 - r1, k2y = 2 * hh, cax = qx - min(qx, qy < 0 ? r1 : r2), cay = abs(qy) - hh;
    let t = ((r2 - qx) * k2x + (hh - qy) * k2y) / (k2x * k2x + k2y * k2y); t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cbx = qx - r2 + k2x * t, cby = qy - hh + k2y * t, s = (cbx < 0 && cay < 0) ? -1 : 1;
    return s * sqrt(min(cax * cax + cay * cay, cbx * cbx + cby * cby));
  };
  S.smin = function (a, b, k) { const h = max(k - abs(a - b), 0) / k; return min(a, b) - h * h * k * 0.25; };
  S.smax = function (a, b, k) { const h = max(k - abs(a - b), 0) / k; return max(a, b) + h * h * k * 0.25; };
  S.mix = (a, b, t) => a + (b - a) * t;
  S.sstep = function (a, b, x) { const t = min(1, max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  // ---------- mesher: surface nets + projection onto the true surface + analytic normals ----------
  // f(x,y,z) -> signed distance (negative inside). Returns { position, normal, index, [color] } typed arrays.
  // opts: project (iterations, default 2), color(x,y,z,nx,ny,nz,out), ao (0..1 strength of baked crevice shading)
  const CORNERS = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  S.mesh = function (f, mn, mx, cell, opts) {
    opts = opts || {};
    const nx = Math.ceil((mx[0] - mn[0]) / cell), ny = Math.ceil((mx[1] - mn[1]) / cell), nz = Math.ceil((mx[2] - mn[2]) / cell);
    const sx = nx + 1, sy = ny + 1, sz = nz + 1, d = new Float32Array(sx * sy * sz);
    for (let k = 0; k < sz; k++) { const z = mn[2] + k * cell; for (let j = 0; j < sy; j++) { const y = mn[1] + j * cell; let o = sx * (j + sy * k); for (let i = 0; i < sx; i++) d[o++] = f(mn[0] + i * cell, y, z); } }
    const vidx = new Int32Array(nx * ny * nz).fill(-1), pos = [], val = new Float32Array(8);
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      let mask = 0;
      for (let q = 0; q < 8; q++) { const c = CORNERS[q], v = d[(i + c[0]) + sx * ((j + c[1]) + sy * (k + c[2]))]; val[q] = v; if (v < 0) mask |= 1 << q; }
      if (mask === 0 || mask === 255) continue;
      let ax = 0, ay = 0, az = 0, n = 0;
      for (let e = 0; e < 12; e++) { const a = EDGES[e][0], b = EDGES[e][1], va = val[a], vb = val[b]; if ((va < 0) === (vb < 0)) continue; const t = va / (va - vb), A = CORNERS[a], B = CORNERS[b]; ax += A[0] + t * (B[0] - A[0]); ay += A[1] + t * (B[1] - A[1]); az += A[2] + t * (B[2] - A[2]); n++; }
      vidx[i + nx * (j + ny * k)] = pos.length / 3;
      pos.push(mn[0] + (i + ax / n) * cell, mn[1] + (j + ay / n) * cell, mn[2] + (k + az / n) * cell);
    }
    const nv = pos.length / 3, P = new Float32Array(pos), N = new Float32Array(nv * 3), e = cell * 0.35, iters = opts.project === undefined ? 2 : opts.project, lim = cell * 0.8;
    for (let v = 0; v < nv; v++) {
      let x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
      for (let it = 0; it < iters; it++) {
        const s = f(x, y, z), gx = (f(x + e, y, z) - f(x - e, y, z)) / (2 * e), gy = (f(x, y + e, z) - f(x, y - e, z)) / (2 * e), gz = (f(x, y, z + e) - f(x, y, z - e)) / (2 * e), l2 = gx * gx + gy * gy + gz * gz;
        if (l2 < 1e-10) break;
        let k = s / l2; const st = abs(k) * sqrt(l2); if (st > lim) k *= lim / st;
        x -= gx * k; y -= gy * k; z -= gz * k;
      }
      const ne = opts.normalEps || cell * 0.6;
      let gx = f(x + ne, y, z) - f(x - ne, y, z), gy = f(x, y + ne, z) - f(x, y - ne, z), gz = f(x, y, z + ne) - f(x, y, z - ne); const l = sqrt(gx * gx + gy * gy + gz * gz) || 1;
      P[v * 3] = x; P[v * 3 + 1] = y; P[v * 3 + 2] = z; N[v * 3] = gx / l; N[v * 3 + 1] = gy / l; N[v * 3 + 2] = gz / l;
    }
    const idx = [], V = (i, j, k) => vidx[i + nx * (j + ny * k)];
    const quad = (a, b, c, dd, flip) => { if (a < 0 || b < 0 || c < 0 || dd < 0) return; if (flip) idx.push(a, c, b, a, dd, c); else idx.push(a, b, c, a, c, dd); };
    for (let k = 1; k < nz; k++) for (let j = 1; j < ny; j++) for (let i = 1; i < nx; i++) {
      const v0 = d[i + sx * (j + sy * k)] < 0;
      if (v0 !== (d[(i + 1) + sx * (j + sy * k)] < 0)) quad(V(i, j - 1, k - 1), V(i, j, k - 1), V(i, j, k), V(i, j - 1, k), !v0);
      if (v0 !== (d[i + sx * ((j + 1) + sy * k)] < 0)) quad(V(i - 1, j, k - 1), V(i - 1, j, k), V(i, j, k), V(i, j, k - 1), !v0);
      if (v0 !== (d[i + sx * (j + sy * (k + 1))] < 0)) quad(V(i - 1, j - 1, k), V(i, j - 1, k), V(i, j, k), V(i - 1, j, k), !v0);
    }
    const out = { position: P, normal: N, index: new Uint32Array(idx) };
    if (opts.color || opts.ao) {
      const C = new Float32Array(nv * 3), c = [1, 1, 1], aoK = opts.ao || 0, r1 = opts.aoRadius || cell * 4;
      for (let v = 0; v < nv; v++) {
        const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2], a = N[v * 3], b = N[v * 3 + 1], cc = N[v * 3 + 2];
        c[0] = c[1] = c[2] = 1; if (opts.color) opts.color(x, y, z, a, b, cc, c);
        let ao = 1;
        if (aoK > 0) {   // how open is the space in front of the surface (crevices get darker)
          const o1 = min(1, max(0, f(x + a * r1, y + b * r1, z + cc * r1) / r1)), o2 = min(1, max(0, f(x + a * r1 * 3, y + b * r1 * 3, z + cc * r1 * 3) / (r1 * 3)));
          ao = 1 - aoK * (1 - (o1 * 0.5 + o2 * 0.5));
        }
        C[v * 3] = c[0] * ao; C[v * 3 + 1] = c[1] * ao; C[v * 3 + 2] = c[2] * ao;
      }
      out.color = C;
    }
    return out;
  };
  // THREE.BufferGeometry from mesher output
  S.geometry = function (m) {
    const T = root.THREE, g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(m.position, 3)); g.setAttribute('normal', new T.BufferAttribute(m.normal, 3));
    if (m.color) g.setAttribute('color', new T.BufferAttribute(m.color, 3));
    g.setIndex(new T.BufferAttribute(m.index, 1)); g.computeBoundingSphere(); g.computeBoundingBox(); return g;
  };
  root.SDF = S;
})(typeof window !== 'undefined' ? window : globalThis);
