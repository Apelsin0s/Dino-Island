// Look-dev assets, all built in code: smooth SDF sculpts for hero objects (hand, spoon, trees, rocks, clouds)
// and parametric meshes for thin things (grass blades, petals, bucket).
'use strict';
(function (root) {
  const T = root.THREE, S = root.SDF, A = {};
  const sqrt = Math.sqrt, abs = Math.abs, cos = Math.cos, sin = Math.sin, PI = Math.PI;
  const lerp = (a, b, t) => a + (b - a) * t, clamp01 = t => t < 0 ? 0 : t > 1 ? 1 : t;
  const C = h => new T.Color(h);
  const mixC = (a, b, t, out) => { out[0] = a.r + (b.r - a.r) * t; out[1] = a.g + (b.g - a.g) * t; out[2] = a.b + (b.b - a.b) * t; };

  function colorize(geo, color) {
    if (geo.index) geo = geo.toNonIndexed();
    const n = geo.getAttribute('position').count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = color.r; a[i * 3 + 1] = color.g; a[i * 3 + 2] = color.b; }
    geo.setAttribute('color', new T.BufferAttribute(a, 3)); if (geo.getAttribute('uv')) geo.deleteAttribute('uv'); return geo;
  }
  const merge = list => T.BufferGeometryUtils.mergeGeometries(list.map(g => { g = g.index ? g.toNonIndexed() : g; if (g.getAttribute('uv')) g.deleteAttribute('uv'); return g; }), false);
  A.colorize = colorize; A.merge = merge;

  // =====================================================================================
  // First-person right hand holding a spoon. Local frame: the spoon handle runs along -Z (bowl in front),
  // +Y is the thumb side, +X is the back of the hand. Units: metres.
  // =====================================================================================
  const HAND = { w: (() => { const v = [0.10, 0.60, 0.79], l = Math.hypot(v[0], v[1], v[2]); return v.map(c => c / l); })(), Wc: [0.012, 0.022, 0.048], G: 1.16, SP: 1.32 };
  A.HAND = HAND;
  A.glove = function (pal) {
    // fingers wrap around the handle as arcs that end in fingertips on the side facing the eye;
    // the thumb lies along the handle, the back of the hand is a separate coloured panel, the cuff is a dark band
    const fz = [-0.0335, -0.0112, 0.0108, 0.0312], fr = [0.0122, 0.0128, 0.0124, 0.0112], tip = [0.10, -0.04, 0.02, 0.16], R = 0.0200, w = HAND.w, W0 = HAND.Wc, G = HAND.G;
    const A0 = -250 * PI / 180, A1 = -18 * PI / 180;
    const c0 = [W0[0] + w[0] * 0.006, W0[1] + w[1] * 0.006, W0[2] + w[2] * 0.006], c1 = [W0[0] + w[0] * 0.088, W0[1] + w[1] * 0.088, W0[2] + w[2] * 0.088], cs = [W0[0] + w[0] * 0.04, W0[1] + w[1] * 0.04, W0[2] + w[2] * 0.04];
    const fingers = function (x, y, z) {
      let ph = Math.atan2(y, x); if (ph > 0.8) ph -= 6.2832;
      let d = 0;
      for (let i = 0; i < 4; i++) { const a0 = A0 + tip[i], pc = ph < a0 ? a0 : ph > A1 ? A1 : ph, dx = x - R * cos(pc), dy = y - R * sin(pc), dz = z - fz[i], di = sqrt(dx * dx + dy * dy + dz * dz) - fr[i]; d = i ? S.smin(d, di, 0.0028) : di; }
      return d;
    };
    const back = (x, y, z) => S.ellipsoid(x, y, z, 0.0225, 0.010, 0.004, 0.0195, 0.031, 0.045);
    const thumb = function (x, y, z) {
      let d = S.cone(x, y, z, 0.010, 0.030, 0.030, 0.002, 0.0375, -0.004, 0.0150, 0.0128);
      return S.smin(d, S.cone(x, y, z, 0.002, 0.0375, -0.004, -0.006, 0.0385, -0.040, 0.0128, 0.0112), 0.004);
    };
    const heel = (x, y, z) => S.smin(S.sphere(x, y, z, 0.006, 0.021, 0.030, 0.0215), S.sphere(x, y, z, 0.013, 0.003, 0.040, 0.0200), 0.012);
    const cuff = function (x, y, z) {
      let d = S.cone(x, y, z, c0[0], c0[1], c0[2], c1[0], c1[1], c1[2], 0.0335, 0.0485);
      d = S.smin(d, S.torus(x, y, z, c1[0], c1[1], c1[2], w[0], w[1], w[2], 0.0485, 0.0062), 0.004);
      return S.smin(d, S.torus(x, y, z, cs[0], cs[1], cs[2], w[0], w[1], w[2], 0.0405, 0.0048), 0.003);   // strap
    };
    const f0 = function (x, y, z) {
      let d = S.smin(fingers(x, y, z), back(x, y, z), 0.008);
      d = S.smin(d, heel(x, y, z), 0.010);
      d = S.smin(d, thumb(x, y, z), 0.0045);
      for (let i = 0; i < 4; i++) d = S.smin(d, S.sphere(x, y, z, 0.0215 * cos(A1) + 0.004, 0.0215 * sin(A1) - 0.001, fz[i], 0.0118), 0.005);   // knuckles
      return S.smin(d, cuff(x, y, z), 0.010);
    };
    const f = (x, y, z) => f0(x / G, y / G, z / G) * G;
    const main = C(pal.glove), cf = C(pal.gloveCuff), panel = C(pal.glovePad || pal.glove), strap = C(pal.gloveStrap || '#d9dde1');
    const m = S.mesh(f, [-0.06 * G, -0.055 * G, -0.062 * G], [0.10 * G, 0.15 * G, 0.19 * G], 0.0012 * G, {
      ao: 0.45, aoRadius: 0.005,
      color(x, y, z, nx, ny, nz, out) {
        x /= G; y /= G; z /= G;
        const t = (x - W0[0]) * w[0] + (y - W0[1]) * w[1] + (z - W0[2]) * w[2];
        const other = Math.min(fingers(x, y, z), thumb(x, y, z), heel(x, y, z)), kb = S.sstep(-0.0005, 0.0035, other - back(x, y, z)) * S.sstep(0.008, 0.014, x);
        mixC(main, panel, kb, out);
        const kc = S.sstep(0.012, 0.0165, t), ks = S.sstep(0.0325, 0.0345, t) * (1 - S.sstep(0.0455, 0.0475, t));
        out[0] = lerp(out[0], cf.r, kc); out[1] = lerp(out[1], cf.g, kc); out[2] = lerp(out[2], cf.b, kc);
        out[0] = lerp(out[0], strap.r, ks); out[1] = lerp(out[1], strap.g, ks); out[2] = lerp(out[2], strap.b, ks);
      }
    });
    return S.geometry(m);
  };
  A.sleeve = function (pal) {
    const w = HAND.w, W0 = HAND.Wc, G = HAND.G, at = t => [W0[0] + w[0] * t, W0[1] + w[1] * t, W0[2] + w[2] * t];
    const s0 = at(0.045), s1 = at(0.62), folds = [[0.108, 0.02, 0.0], [0.142, -0.03, 0.02], [0.186, 0.015, -0.03]].map(([t, tx, tz]) => {
      const c = at(t), ax = [w[0] + tx, w[1], w[2] + tz], l = Math.hypot(ax[0], ax[1], ax[2]); return { c, ax: ax.map(v => v / l), R: lerp(0.037, 0.060, (t - 0.045) / 0.575) + 0.001 };
    });
    const f0 = function (x, y, z) {
      let d = S.cone(x, y, z, s0[0], s0[1], s0[2], s1[0], s1[1], s1[2], 0.037, 0.060);
      for (const fo of folds) d = S.smin(d, S.torus(x, y, z, fo.c[0], fo.c[1], fo.c[2], fo.ax[0], fo.ax[1], fo.ax[2], fo.R, 0.0075), 0.016);
      return d;
    };
    const f = (x, y, z) => f0(x / G, y / G, z / G) * G, base = C(pal.sleeve), band = C(pal.band), e0 = at(0.03), e1 = at(0.66);
    const mn = [Math.min(e0[0], e1[0]) - 0.075, Math.min(e0[1], e1[1]) - 0.075, Math.min(e0[2], e1[2]) - 0.075].map(v => v * G), mx = [Math.max(e0[0], e1[0]) + 0.075, Math.max(e0[1], e1[1]) + 0.075, Math.max(e0[2], e1[2]) + 0.075].map(v => v * G);
    const m = S.mesh(f, mn, mx, 0.003 * G, {
      ao: 0.3, aoRadius: 0.012,
      color(x, y, z, nx, ny, nz, out) { x /= G; y /= G; z /= G; const t = (x - W0[0]) * w[0] + (y - W0[1]) * w[1] + (z - W0[2]) * w[2]; const k = S.sstep(0.262, 0.268, t) * (1 - S.sstep(0.312, 0.318, t)); mixC(base, band, k, out); }
    });
    return S.geometry(m);
  };
  // Table spoon (scaled up a little, cartoon-style). Returns { spoon, soil } geometries.
  A.spoon = function () {
    const SP = HAND.SP, a1 = -0.049, r1 = 0.0092, a2 = 0.082, r2 = 0.0036, th = 0.0017, a0 = 0.118, rz = 0.031, rx0 = 0.0212, ry = 0.0125, yr = -0.011;
    const f = function (X, Y, Z) {
      const x = X / SP, y = Y / SP, a = -Z / SP;
      const yc = -0.0125 * S.sstep(0.02, 0.09, a) + 0.0015;
      let h = (a - a1) / (a2 - a1); h = clamp01(h);
      const da = a - (a1 + h * (a2 - a1)), d2 = sqrt(x * x + da * da) - (r1 + (r2 - r1) * h);
      const dh = S.smax(d2, abs(y - yc) - th, 0.0012);
      const rx = rx0 * (1 - 0.14 * (a - a0) / rz), E = S.ellipsoid(x, y, a, 0, yr, a0, rx, ry, rz);
      const db = S.smax(abs(E) - 0.0011, y - yr, 0.0010);
      return S.smin(dh, db, 0.0045) * SP;
    };
    const spoon = S.geometry(S.mesh(f, [-0.0245 * SP, -0.0275 * SP, -0.153 * SP], [0.0245 * SP, 0.0065 * SP, 0.061 * SP], 0.00065 * SP, { project: 3 }));
    const fs = function (X, Y, Z) {
      const x = X / SP, y = Y / SP, a = -Z / SP;
      const E = S.ellipsoid(x, y, a, 0.001, yr - 0.0015, a0 + 0.001, 0.0165, 0.0095, 0.0245);
      return (E - 0.0016 * S.fbm(x * 260, y * 260, a * 260, 3)) * SP;
    };
    const soil = S.geometry(S.mesh(fs, [-0.022 * SP, -0.026 * SP, -0.150 * SP], [0.022 * SP, 0.004 * SP, -0.088 * SP], 0.0008 * SP, { project: 2 }));
    return { spoon, soil, bowl: [0, yr * SP, -a0 * SP] };
  };

  // =====================================================================================
  // Trees
  // =====================================================================================
  A.tree = function (seed, o) {
    o = o || {}; const r = S.rng(seed), lumpy = o.lumpy || 0, bend = (r() - 0.5) * 0.5, H = 2.7 + r() * 0.5;
    const br = []; for (let i = 0; i < 3; i++) { const a = i * 2.1 + r() * 0.8, y0 = H * (0.62 + i * 0.1), len = 1.0 + r() * 0.5; br.push([bend * (y0 / H), y0, 0, bend + cos(a) * len, y0 + len * 0.95, sin(a) * len, 0.11, 0.055]); }
    const trunkF = function (x, y, z) {
      let d = S.cone(x, y, z, 0, -0.3, 0, bend * 0.5, H * 0.55, 0.03, 0.27, 0.19);
      d = S.smin(d, S.cone(x, y, z, bend * 0.5, H * 0.55, 0.03, bend, H + 0.5, 0, 0.19, 0.12), 0.1);
      d = S.smin(d, S.ellipsoid(x, y, z, 0, 0.0, 0, 0.46, 0.2, 0.46), 0.2);
      for (const b of br) d = S.smin(d, S.cone(x, y, z, b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7]), 0.08);
      return d + lumpy * 0.012 * S.noise(x * 7, y * 2.5, z * 7);
    };
    const trunk = S.geometry(S.mesh(trunkF, [-1.9, -0.25, -1.9], [1.9, H + 1.9, 1.9], 0.03, { ao: 0.3, aoRadius: 0.1 }));
    const blobs = [[bend, H + 1.55, 0, 1.28]];
    for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2 + r() * 0.5, rad = 1.15 + r() * 0.25; blobs.push([bend + cos(a) * rad, H + 0.85 + r() * 0.75, sin(a) * rad, 0.82 + r() * 0.3]); }
    for (let i = 0; i < 3; i++) { const a = i / 3 * PI * 2 + r() * 1.0; blobs.push([bend + cos(a) * 0.62, H + 2.35 + r() * 0.3, sin(a) * 0.62, 0.72 + r() * 0.2]); }
    for (let i = 0; i < 2; i++) { const a = r() * PI * 2; blobs.push([bend + cos(a) * 1.75, H + 0.75 + r() * 0.4, sin(a) * 1.75, 0.6 + r() * 0.15]); }
    const k = o.blend || 0.42;
    const crownF = function (x, y, z) {
      let d = 0; for (let i = 0; i < blobs.length; i++) { const b = blobs[i], di = S.sphere(x, y, z, b[0], b[1], b[2], b[3]); d = i ? S.smin(d, di, k) : di; }
      return d + lumpy * 0.07 * S.noise(x * 1.4, y * 1.4, z * 1.4);
    };
    const dark = C(o.leafDark || '#3f8a3a'), light = C(o.leafLight || '#8ccb55');
    const crown = S.geometry(S.mesh(crownF, [-3.2, H - 0.6, -3.2], [3.2, H + 3.9, 3.2], o.cell || 0.055, {
      ao: 0.5, aoRadius: 0.22,
      color(x, y, z, nx, ny, nz, out) { const t = clamp01(S.sstep(H + 0.2, H + 3.0, y) * 0.55 + (ny * 0.5 + 0.5) * 0.45); mixC(dark, light, t, out); }
    }));
    return { trunk, crown, height: H + 3.3 };
  };
  A.spruce = function (seed, o) {
    o = o || {}; const r = S.rng(seed), lumpy = o.lumpy || 0, n = 6, tiers = [];
    let y = 0.95; for (let i = 0; i < n; i++) { const R = 1.66 * Math.pow(1 - i / (n + 0.55), 0.92) + 0.14, Hh = 1.85 - i * 0.11; tiers.push({ y, R, H: Hh, ph: r() * 6.28 }); y += Hh * 0.56; }
    const top = tiers[n - 1].y + tiers[n - 1].H;
    const f = function (x, y, z) {
      const th = Math.atan2(z, x);
      let d = S.cone(x, y, z, 0, -0.25, 0, 0, 1.8, 0, 0.19, 0.11);
      d = S.smin(d, S.ellipsoid(x, y, z, 0, 0, 0, 0.3, 0.14, 0.3), 0.12);
      for (const t of tiers) { const Ri = t.R * (1 + 0.065 * cos(7 * th + t.ph)); d = S.smin(d, S.cappedCone(x, y, z, 0, t.y, 0, t.H, Ri, 0.07) - 0.075, 0.13); }
      d = S.smin(d, S.sphere(x, y, z, 0, top + 0.02, 0, 0.11), 0.08);
      return d + lumpy * 0.05 * S.noise(x * 1.7, y * 1.7, z * 1.7);
    };
    const dark = C(o.dark || '#1f5e3a'), light = C(o.light || '#4f9a52'), bark = C(o.bark || '#6b4a32');
    const g = S.geometry(S.mesh(f, [-2.05, -0.2, -2.05], [2.05, top + 0.35, 2.05], o.cell || 0.05, {
      ao: 0.55, aoRadius: 0.18,
      color(x, y, z, nx, ny, nz, out) {
        const rr = sqrt(x * x + z * z); if (y < 1.02 && rr < 0.33) { out[0] = bark.r; out[1] = bark.g; out[2] = bark.b; return; }
        mixC(dark, light, clamp01((ny * 0.5 + 0.5) * 0.75 + S.sstep(1, top, y) * 0.25), out);
      }
    }));
    return { geo: g, height: top + 0.15 };
  };
  // cheap distant spruce (a smooth lathe silhouette)
  A.spruceFar = function (o) {
    o = o || {}; const pts = [], prof = [[0.001, 0], [0.12, 0], [0.12, 0.9], [1.5, 0.95], [1.05, 2.2], [1.25, 2.3], [0.8, 3.6], [0.98, 3.7], [0.55, 5.0], [0.7, 5.1], [0.28, 6.5], [0.001, 7.4]];
    for (const p of prof) pts.push(new T.Vector2(p[0], p[1]));
    const g = new T.LatheGeometry(pts, o.seg || 9); g.deleteAttribute('uv');
    const pos = g.getAttribute('position'), col = new Float32Array(pos.count * 3), dark = C(o.dark || '#1f5e3a'), light = C(o.light || '#4f9a52'), out = [0, 0, 0];
    for (let i = 0; i < pos.count; i++) { mixC(dark, light, clamp01(pos.getY(i) / 7.4 * 0.5 + 0.2 + (i % 2) * 0.1), out); col[i * 3] = out[0]; col[i * 3 + 1] = out[1]; col[i * 3 + 2] = out[2]; }
    g.setAttribute('color', new T.BufferAttribute(col, 3)); return g;
  };
  A.bush = function (seed, o) {
    o = o || {}; const r = S.rng(seed), bl = []; for (let i = 0; i < 5; i++) { const a = r() * 6.28, d = r() * 0.42; bl.push([cos(a) * d, 0.22 + r() * 0.25, sin(a) * d, 0.3 + r() * 0.18]); }
    const f = (x, y, z) => { let d = 0; for (let i = 0; i < bl.length; i++) { const b = bl[i], di = S.sphere(x, y, z, b[0], b[1], b[2], b[3]); d = i ? S.smin(d, di, 0.2) : di; } return d + (o.lumpy || 0) * 0.03 * S.noise(x * 3, y * 3, z * 3); };
    const dark = C(o.dark || '#3c8440'), light = C(o.light || '#86c85a');
    return S.geometry(S.mesh(f, [-1, -0.1, -1], [1, 1.1, 1], 0.03, { ao: 0.5, aoRadius: 0.1, color(x, y, z, nx, ny, nz, out) { mixC(dark, light, clamp01(y * 0.9 + ny * 0.3), out); } }));
  };
  A.rock = function (seed, o) {
    o = o || {}; const r = S.rng(seed), parts = []; for (let i = 0; i < 4; i++) parts.push([(r() - 0.5) * 0.5, 0.12 + r() * 0.22, (r() - 0.5) * 0.5, 0.3 + r() * 0.22, 0.22 + r() * 0.16, 0.28 + r() * 0.2]);
    const f = function (x, y, z) {
      let d = 0; for (let i = 0; i < parts.length; i++) { const p = parts[i], di = S.ellipsoid(x, y, z, p[0], p[1], p[2], p[3], p[4], p[5]); d = i ? S.smin(d, di, 0.16) : di; }
      return d + 0.035 * S.noise(x * 2.6 + seed, y * 2.6, z * 2.6) + 0.008 * S.noise(x * 9, y * 9, z * 9) * (0.5 + (o.lumpy || 0));
    };
    return S.geometry(S.mesh(f, [-0.95, -0.2, -0.95], [0.95, 0.8, 0.95], 0.022, { ao: 0.35, aoRadius: 0.08 }));
  };
  A.cloud = function (seed) {
    const r = S.rng(seed), bl = [], n = 6 + Math.floor(r() * 4); let x = -n * 0.42;
    for (let i = 0; i < n; i++) { const big = 0.75 + r() * 0.55 - Math.abs(i - (n - 1) / 2) * 0.09; bl.push([x, 0.35 + r() * 0.35 + big * 0.25, (r() - 0.5) * 0.9, big]); x += 0.7 + r() * 0.35; if (r() < 0.55) bl.push([x - 0.5, 0.2 + r() * 0.2, (r() - 0.5) * 1.6, 0.6 + r() * 0.3]); }
    const f = function (x, y, z) { let d = 0; for (let i = 0; i < bl.length; i++) { const b = bl[i], di = S.sphere(x, y, z, b[0], b[1], b[2], b[3]); d = i ? S.smin(d, di, 0.5) : di; } return S.smax(d, -(y + 0.12), 0.35); };
    return S.geometry(S.mesh(f, [-n * 0.42 - 1.8, -0.5, -2.4], [x + 1.6, 2.5, 2.4], 0.075, { ao: 0.25, aoRadius: 0.3 }));
  };
  // pebbles / nuggets: a smooth lumpy ball
  A.lump = function (seed, amp) {
    const g = new T.IcosahedronGeometry(1, 4), p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + (amp || 0.22) * S.fbm(x * 1.3 + seed * 3.1, y * 1.3, z * 1.3, 3); p.setXYZ(i, x * k, y * k * 0.72, z * k); }
    g.computeVertexNormals(); g.deleteAttribute('uv'); return g;
  };

  // =====================================================================================
  // Grass and flowers
  // =====================================================================================
  // blades are lit almost like the ground under them: no dark faces, a soft even look
  function softNormals(g, k) { const n = g.getAttribute('normal'); for (let i = 0; i < n.count; i++) { let x = n.getX(i) * (1 - k), y = Math.abs(n.getY(i)) * (1 - k) + k, z = n.getZ(i) * (1 - k); const l = Math.hypot(x, y, z); n.setXYZ(i, x / l, y / l, z / l); } return g; }
  // a rosette of thick, soft, rounded blades
  A.tuft = function (seed, o) {
    o = Object.assign({ blades: 13, hMin: 0.09, hMax: 0.19, width: 0.02, root: '#3f8f35', tip: '#a6d95f' }, o || {});
    const r = S.rng(seed), pos = [], col = [], idx = [], root = C(o.root), tip = C(o.tip), out = [0, 0, 0], segs = 7;
    for (let b = 0; b < o.blades; b++) {
      const ang = b / o.blades * PI * 2 + (r() - 0.5) * 0.9, inner = b % 3 === 0, h = lerp(o.hMin, o.hMax, r()) * (inner ? 1.15 : 0.88), lean = (inner ? 0.1 : 0.42) + r() * 0.3, w = o.width * (0.8 + r() * 0.5);
      const dx = cos(ang), dz = sin(ang), px = -dz, pz = dx, base = 0.008 + r() * 0.022, tint = 0.9 + r() * 0.2, start = pos.length / 3;
      for (let s = 0; s <= segs; s++) {
        const t = s / segs, outw = base + lean * h * t * t * 1.15, up = h * (t - 0.2 * t * t * lean * 2), wt = w * 0.5 * Math.pow(1 - t * t * t * t, 0.6) * (0.5 + 0.5 * Math.min(1, t * 4));
        const cx = dx * outw, cz = dz * outw, cup = wt * 0.45;
        pos.push(cx - px * wt, up, cz - pz * wt, cx - dx * cup, up - cup * 0.2, cz - dz * cup, cx + px * wt, up, cz + pz * wt);
        mixC(root, tip, Math.pow(t, 0.75), out);
        for (let q = 0; q < 3; q++) col.push(out[0] * tint * (q === 1 ? 0.93 : 1), out[1] * tint * (q === 1 ? 0.93 : 1), out[2] * tint * (q === 1 ? 0.93 : 1));
      }
      for (let s = 0; s < segs; s++) { const a = start + s * 3, c = a + 3; idx.push(a, a + 1, c + 1, a, c + 1, c, a + 1, a + 2, c + 2, a + 1, c + 2, c + 1); }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); return softNormals(g, o.up === undefined ? 0.68 : o.up);
  };
  // a few slim tall blades for dense fields
  A.blades = function (seed, o) {
    o = Object.assign({ blades: 4, hMin: 0.22, hMax: 0.42, width: 0.011, root: '#356f2c', tip: '#b5dc6a' }, o || {});
    const r = S.rng(seed), pos = [], col = [], idx = [], root = C(o.root), tip = C(o.tip), out = [0, 0, 0], segs = 5;
    for (let b = 0; b < o.blades; b++) {
      const ang = r() * PI * 2, h = lerp(o.hMin, o.hMax, r()), lean = 0.12 + r() * 0.4, w = o.width * (0.8 + r() * 0.5), ox = (r() - 0.5) * 0.07, oz = (r() - 0.5) * 0.07;
      const dx = cos(ang), dz = sin(ang), px = -dz, pz = dx, tint = 0.88 + r() * 0.24, start = pos.length / 3;
      for (let s = 0; s <= segs; s++) {
        const t = s / segs, outw = lean * h * t * t, up = h * (t - 0.16 * t * t * lean * 2), wt = w * 0.5 * (1 - t * t * 0.96);
        pos.push(ox + dx * outw - px * wt, up, oz + dz * outw - pz * wt, ox + dx * outw + px * wt, up, oz + dz * outw + pz * wt);
        mixC(root, tip, Math.pow(t, 0.8), out); for (let q = 0; q < 2; q++) col.push(out[0] * tint, out[1] * tint, out[2] * tint);
      }
      for (let s = 0; s < segs; s++) { const a = start + s * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); return softNormals(g, o.up === undefined ? 0.68 : o.up);
  };
  A.flower = function (petalColor, o) {
    o = Object.assign({ petals: 11, len: 0.014, wid: 0.0052, h: 0.16, centre: '#f5c531' }, o || {});
    const parts = [], curve = new T.QuadraticBezierCurve3(new T.Vector3(0, 0, 0), new T.Vector3(0.012, o.h * 0.55, 0.004), new T.Vector3(0.004, o.h, 0));
    parts.push(colorize(new T.TubeGeometry(curve, 8, 0.0028, 6, false), C('#4c9a3c')));
    const head = new T.Vector3(0.004, o.h, 0);
    for (let i = 0; i < o.petals; i++) {
      const a = i / o.petals * PI * 2, g = new T.SphereGeometry(1, 10, 8); g.scale(o.len, 0.0022, o.wid); g.translate(o.len * 1.15, 0, 0); g.rotateZ(0.22); g.rotateY(a); g.translate(head.x, head.y, head.z);
      parts.push(colorize(g, C(petalColor)));
    }
    const c = new T.SphereGeometry(1, 12, 10); c.scale(0.0075, 0.0048, 0.0075); c.translate(head.x, head.y + 0.002, head.z); parts.push(colorize(c, C(o.centre)));
    const leaf = new T.SphereGeometry(1, 8, 6); leaf.scale(0.022, 0.002, 0.008); leaf.translate(0.024, 0.03, 0); leaf.rotateZ(0.5); parts.push(colorize(leaf, C('#4c9a3c')));
    return merge(parts);
  };
  A.mushroom = function () {
    const cap = [], stem = [];
    for (const p of [[0.0001, 0.105], [0.02, 0.103], [0.04, 0.094], [0.055, 0.078], [0.061, 0.062], [0.058, 0.054], [0.05, 0.056], [0.02, 0.062], [0.0001, 0.064]]) cap.push(new T.Vector2(p[0], p[1]));
    for (const p of [[0.0001, 0], [0.02, 0], [0.022, 0.006], [0.016, 0.03], [0.014, 0.062], [0.0001, 0.064]]) stem.push(new T.Vector2(p[0], p[1]));
    const parts = [colorize(new T.LatheGeometry(cap, 28), C('#d8352a')), colorize(new T.LatheGeometry(stem, 20), C('#f3ecdc'))];
    const r = S.rng(5); for (let i = 0; i < 9; i++) { const a = r() * 6.28, d = 0.012 + r() * 0.034, y = 0.105 - d * d * 9.5, g = new T.SphereGeometry(1, 8, 6); g.scale(0.006, 0.0025, 0.006); g.rotateZ(-d * 9); g.rotateY(-a); g.translate(cos(a) * d, y, sin(a) * d); parts.push(colorize(g, C('#fbf6ea'))); }
    return merge(parts);
  };

  // =====================================================================================
  // Props
  // =====================================================================================
  A.bucket = function () {
    const pts = []; for (const p of [[0.0001, 0], [0.084, 0], [0.09, 0.004], [0.094, 0.066], [0.0965, 0.07], [0.0945, 0.074], [0.106, 0.146], [0.1085, 0.15], [0.1065, 0.154], [0.117, 0.212], [0.122, 0.216], [0.123, 0.221], [0.119, 0.224], [0.114, 0.221], [0.113, 0.214], [0.087, 0.014], [0.082, 0.01], [0.0001, 0.01]]) pts.push(new T.Vector2(p[0], p[1]));
    const body = new T.LatheGeometry(pts, 72); body.deleteAttribute('uv');
    const handle = new T.TorusGeometry(0.128, 0.0034, 8, 48, PI); handle.rotateX(PI / 2 + 1.05); handle.translate(0, 0.205, 0); handle.deleteAttribute('uv');
    const ears = [-1, 1].map(s => { const g = new T.RoundedBoxGeometry(0.012, 0.03, 0.022, 2, 0.004); g.translate(s * 0.124, 0.2, 0); g.deleteAttribute('uv'); return g; });
    // soil inside: a bumpy mound
    const R = 0.108, rings = 26, seg = 48, pos = [], idx = [];
    for (let i = 0; i <= rings; i++) for (let j = 0; j <= seg; j++) { const rr = R * i / rings, a = j / seg * PI * 2, x = cos(a) * rr, z = sin(a) * rr; pos.push(x, 0.158 + 0.028 * (1 - (rr / R) * (rr / R)) + 0.006 * S.fbm(x * 30, 1.3, z * 30, 3), z); }
    for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) { const a = i * (seg + 1) + j, b = a + seg + 1; idx.push(a, b + 1, b, a, a + 1, b + 1); }
    const soil = new T.BufferGeometry(); soil.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); soil.setIndex(idx); soil.computeVertexNormals();
    return { body: merge([body, handle].concat(ears)), soil };
  };
  A.fence = function (len, posts) {
    const parts = [], wood = C('#b98d5c'), wood2 = C('#a67c4e');
    for (let i = 0; i < posts; i++) { const g = new T.CapsuleGeometry(0.055, 0.95, 6, 14); g.translate(i * len / (posts - 1), 0.42, 0); parts.push(colorize(g, i % 2 ? wood : wood2)); }
    for (const y of [0.34, 0.72]) { const g = new T.CapsuleGeometry(0.034, len + 0.2, 6, 12); g.rotateZ(PI / 2); g.translate(len / 2, y, 0.045); parts.push(colorize(g, wood)); }
    return merge(parts);
  };
  // the buyer's stall: where the dug-up stuff gets sold
  A.stall = function (pal) {
    const parts = [], wood = C('#b98d5c'), woodD = C('#8f6a44'), a1 = C(pal.awning1 || '#f08a24'), a2 = C(pal.awning2 || '#fff4e0');
    const box = (w, h, d, x, y, z, c, r) => { const g = new T.RoundedBoxGeometry(w, h, d, 3, r || 0.03); g.translate(x, y, z); parts.push(colorize(g, c)); };
    box(1.9, 0.86, 0.75, 0, 0.43, 0, wood, 0.05); box(2.02, 0.07, 0.86, 0, 0.9, 0, woodD, 0.03);
    for (const sx of [-0.95, 0.95]) for (const sz of [-0.42, 0.42]) { const g = new T.CapsuleGeometry(0.045, 2.1, 6, 12); g.translate(sx, 1.05, sz); parts.push(colorize(g, woodD)); }
    // striped awning (a sagging sheet) with a scalloped front
    const nx = 14, nz = 8, pos = [], col = [], idx = [], W = 2.3, D = 1.5;
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const u = i / nx, v = j / nz, x = (u - 0.5) * W, z = (v - 0.5) * D, y = 2.2 - v * 0.42 - 0.06 * sin(u * PI) * sin(v * PI); pos.push(x, y, z); const c = Math.floor(u * 7 - 1e-6) % 2 ? a2 : a1; col.push(c.r, c.g, c.b); }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + nx + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const aw = new T.BufferGeometry(); aw.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); aw.setAttribute('color', new T.Float32BufferAttribute(col, 3)); aw.setIndex(idx); aw.computeVertexNormals(); parts.push(aw);
    for (let i = 0; i < 7; i++) { const g = new T.CircleGeometry(W / 14, 20, PI, PI); g.translate((i + 0.5) / 7 * W - W / 2, 1.78, D / 2); parts.push(colorize(g, i % 2 ? a2 : a1)); }
    box(0.5, 0.36, 0.4, -0.55, 1.11, 0.05, C('#c9a26d'), 0.03); box(0.42, 0.3, 0.36, 0.5, 1.08, -0.05, C('#c9a26d'), 0.03);
    const lamp = new T.SphereGeometry(0.085, 20, 14); lamp.translate(0.02, 1.03, 0.2); parts.push(colorize(lamp, C('#ffd76a')));
    for (const [x, z, s] of [[1.35, 0.3, 1], [1.5, -0.25, 0.8], [-1.4, 0.2, 0.9]]) { const g = new T.SphereGeometry(0.26 * s, 20, 16); g.scale(1, 1.15, 0.9); g.translate(x, 0.26 * s, z); parts.push(colorize(g, C('#cdb48a'))); }
    return merge(parts);
  };
  // toy houses for the village on the far hillside
  A.house = function (seed, o) {
    const r = S.rng(seed), parts = [], w = 6 + r() * 3, d = 5 + r() * 2, h = 3.2 + r() * 1.2, rh = 2.6 + r() * 1.2, wall = C(['#f4ead8', '#efe2c4', '#f6f1e7', '#e9d7b8'][Math.floor(r() * 4)]), roof = C(['#b5452f', '#a23c2a', '#8f4a3a', '#6b4a3a'][Math.floor(r() * 4)]);
    if (o && o.church) {
      const g = new T.BoxGeometry(5, 9, 5); g.translate(0, 4.5, 0); parts.push(colorize(g, C('#f6f1e7'))); const sp = new T.ConeGeometry(3.4, 10, 4); sp.rotateY(PI / 4); sp.translate(0, 14, 0); parts.push(colorize(sp, C('#5b4a44')));
      const nave = new T.BoxGeometry(6, 5, 12); nave.translate(0, 2.5, 8); parts.push(colorize(nave, C('#f6f1e7'))); const rf = new T.CylinderGeometry(0.01, 4.4, 3, 4, 1); rf.rotateY(PI / 4); rf.scale(1, 1, 2.0); rf.translate(0, 6.5, 8); parts.push(colorize(rf, C('#a23c2a')));
      return merge(parts);
    }
    const b = new T.BoxGeometry(w, h, d); b.translate(0, h / 2, 0); parts.push(colorize(b, wall));
    const sh = new T.Shape(); sh.moveTo(-d / 2 - 0.5, 0); sh.lineTo(d / 2 + 0.5, 0); sh.lineTo(0, rh); sh.lineTo(-d / 2 - 0.5, 0);
    const rf = new T.ExtrudeGeometry(sh, { depth: w + 0.8, bevelEnabled: false }); rf.rotateY(PI / 2); rf.translate(-(w + 0.8) / 2, h, 0); parts.push(colorize(rf, roof));
    return merge(parts);
  };

  // =====================================================================================
  // "Clean worksite" props (variant 4): stylised flat stones, a white-orange depot and a van
  // =====================================================================================
  // a flat faceted pebble: light top, shaded sides (drawn with flat shading)
  A.pebbleFlat = function (seed) {
    const g = new T.IcosahedronGeometry(1, 0), p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 0.7 + 0.6 * S.hash(Math.round(x * 10) + seed * 7, Math.round(y * 10), Math.round(z * 10)); p.setXYZ(i, x * k, Math.max(-0.12, y * k * 0.42), z * k); }
    g.computeVertexNormals(); g.deleteAttribute('uv'); return g;
  };
  // the depot where dug-up material is handed in: white modules, orange lines, blue glass
  A.depot = function () {
    const parts = [], white = C('#e9e8e4'), orange = C('#f08a24'), navy = C('#2b3442'), glass = C('#4d9fe8'), dark = C('#3a424d'), grey = C('#c9cdd1');
    const box = (w, h, d, x, y, z, c, r, seg) => { const g = new T.RoundedBoxGeometry(w, h, d, seg || 4, r === undefined ? 0.04 : r); g.translate(x, y, z); parts.push(colorize(g, c)); };
    box(4.5, 0.16, 3.3, 0, 0.08, 0, navy, 0.05);                       // plinth
    box(4.2, 2.6, 3.0, 0, 1.46, 0, white, 0.24, 6);                    // main module
    box(4.23, 0.075, 3.03, 0, 2.36, 0, orange, 0.03); box(4.23, 0.05, 3.03, 0, 0.62, 0, orange, 0.02);   // stripes
    for (const x of [-1.55, -1.05, 1.2]) box(0.3, 1.25, 0.06, x, 1.5, 1.5, glass, 0.03);                 // tall windows
    box(0.95, 1.9, 0.07, 0.15, 1.12, 1.5, grey, 0.04); box(0.8, 0.07, 0.08, 0.15, 2.1, 1.5, dark, 0.02); box(0.34, 0.2, 0.08, 0.15, 1.62, 1.51, glass, 0.03);   // door
    box(1.0, 0.26, 0.06, -1.3, 2.52, 1.5, dark, 0.03); box(1.0, 0.26, 0.06, 1.25, 2.52, 1.5, dark, 0.03); box(0.06, 0.3, 1.2, 2.1, 2.5, 0, dark, 0.02);         // vents
    box(1.7, 0.5, 1.3, -0.9, 3.0, -0.3, white, 0.12); box(1.73, 0.05, 1.33, -0.9, 3.1, -0.3, orange, 0.02);                                                       // roof unit
    { const g = new T.CylinderGeometry(0.02, 0.02, 1.3, 8); g.translate(1.3, 3.4, -0.8); parts.push(colorize(g, grey)); const b = new T.SphereGeometry(0.07, 14, 10); b.translate(1.3, 4.05, -0.8); parts.push(colorize(b, orange)); }
    // the hopper: tip your bucket in here
    { const g = new T.CylinderGeometry(0.75, 0.42, 0.7, 4, 1, true); g.rotateY(PI / 4); g.translate(-2.75, 1.05, 0.7); parts.push(colorize(g, orange));
      box(0.9, 0.7, 0.9, -2.75, 0.35, 0.7, navy, 0.06); box(0.7, 0.12, 2.2, -2.75, 0.5, -0.7, dark, 0.04); }
    box(0.5, 0.36, 0.4, 2.7, 0.18, 1.0, white, 0.05); box(0.52, 0.05, 0.42, 2.7, 0.3, 1.0, orange, 0.02);   // crate
    return merge(parts);
  };
  // a rounded work van (front is +Z)
  A.van = function () {
    const f = function (x, y, z) {
      let d = S.box(x, y - 1.06, z, 0.86, 0.66, 1.98, 0.30);
      d = S.smax(d, (z - 1.66) * 0.83 + (y - 1.2) * 0.55, 0.14);                       // windscreen slope
      d = S.smin(d, S.box(x, y - 0.74, z - 1.72, 0.80, 0.32, 0.30, 0.22), 0.14);       // nose
      for (const wz of [-1.25, 1.2]) for (const sx of [-1, 1]) { const cy = y - 0.40, cz = z - wz, cyl = Math.max(sqrt(cy * cy + cz * cz) - 0.47, 0.60 - sx * x); d = S.smax(d, -cyl, 0.04); }
      return d;
    };
    const white = C('#e9e8e4'), orange = C('#f08a24'), navy = C('#2b3442'), glass = C('#31465f');
    const body = S.geometry(S.mesh(f, [-0.95, 0.3, -2.1], [0.95, 1.85, 2.15], 0.025, {
      ao: 0.25, aoRadius: 0.08,
      color(x, y, z, nx, ny, nz, out) {
        let c = white; const st = S.sstep;
        mixC(navy, white, st(0.70, 0.73, y), out);
        const k1 = st(1.03, 1.045, y) * (1 - st(1.115, 1.13, y)); out[0] = lerp(out[0], orange.r, k1); out[1] = lerp(out[1], orange.g, k1); out[2] = lerp(out[2], orange.b, k1);
        const k2 = st(1.60, 1.615, y); out[0] = lerp(out[0], orange.r, k2); out[1] = lerp(out[1], orange.g, k2); out[2] = lerp(out[2], orange.b, k2);
        // glass: side windows with pillars, windscreen, rear window
        const band = st(1.2, 1.215, y) * (1 - st(1.52, 1.535, y));
        let zz = (z + 1.72) % 0.98; if (zz < 0) zz += 0.98;
        const side = st(0.6, 0.75, Math.abs(nx)) * st(-1.72, -1.70, z) * (1 - st(1.16, 1.18, z)) * st(0.11, 0.125, zz);
        const front = st(0.35, 0.5, nz) * st(1.3, 1.35, z) * (1 - st(0.66, 0.68, Math.abs(x)));
        const rear = st(0.5, 0.7, -nz) * (1 - st(0.6, 0.62, Math.abs(x)));
        const kg = Math.min(1, band * Math.max(side, front, rear));
        out[0] = lerp(out[0], glass.r, kg); out[1] = lerp(out[1], glass.g, kg); out[2] = lerp(out[2], glass.b, kg);
      }
    }));
    const parts = [];
    for (const wz of [-1.25, 1.2]) for (const sx of [-1, 1]) {
      const t = new T.CylinderGeometry(0.40, 0.40, 0.26, 32); t.rotateZ(PI / 2); t.translate(sx * 0.74, 0.40, wz); parts.push(colorize(t, C('#24272c')));
      const h = new T.CylinderGeometry(0.22, 0.22, 0.28, 24); h.rotateZ(PI / 2); h.translate(sx * 0.74, 0.40, wz); parts.push(colorize(h, C('#cfd3d6')));
      const c = new T.CylinderGeometry(0.07, 0.07, 0.30, 16); c.rotateZ(PI / 2); c.translate(sx * 0.74, 0.40, wz); parts.push(colorize(c, orange));
    }
    for (const sx of [-1, 1]) { const g = new T.SphereGeometry(0.095, 18, 12); g.scale(1, 1, 0.5); g.translate(sx * 0.52, 0.93, 2.03); parts.push(colorize(g, C('#fff6d8'))); }
    for (const z of [2.06, -2.0]) { const g = new T.RoundedBoxGeometry(1.66, 0.13, 0.14, 3, 0.05); g.translate(0, 0.52, z); parts.push(colorize(g, navy)); }
    return { body, extras: merge(parts) };
  };

  root.Assets = A;
})(window);
