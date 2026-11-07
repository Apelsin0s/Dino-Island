// 3D island in "pixel 3D" style: low-poly world rendered at a low resolution that depends on zoom
// (big pixels far away, small crisp pixels up close), with depth outlines and normal highlights.
// Orthographic top-down camera: pan, zoom, rotate. Player places, moves and levels buildings.
'use strict';
(function (root) {
  const THREE = root.THREE, W = root.World, D = root.GAME_DATA;
  const DAY_S = 300;
  const QUALITY = { low: { pixel: 4, shadows: 0 }, medium: { pixel: 3, shadows: 2048 }, high: { pixel: 2, shadows: 4096 } };
  const tierOf = l => l >= 60 ? 6 : l >= 40 ? 5 : l >= 25 ? 4 : l >= 10 ? 3 : l >= 5 ? 2 : 1;
  const REG = Object.fromEntries(D.REGIONS.map(r => [r.id, r]));
  const BDEF = Object.fromEntries(D.BUILDINGS.map(b => [b.id, b]));

  // ---------- helpers ----------
  const matCache = {};
  function mat(color, opts) {
    const key = color + JSON.stringify(opts || {});
    if (!matCache[key]) matCache[key] = new THREE.MeshLambertMaterial(Object.assign({ color, flatShading: true }, opts || {}));
    return matCache[key];
  }
  function mesh(geo, color, x, y, z, opts) {
    const m = new THREE.Mesh(geo, typeof color === 'string' ? mat(color, opts) : color);
    m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; m.receiveShadow = true; return m;
  }
  const box = (w, h, d, c, x, y, z, o) => mesh(new THREE.BoxGeometry(w, h, d), c, x, (y || 0) + h / 2, z, o);
  const cyl = (rt, rb, h, seg, c, x, y, z, o) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), c, x, (y || 0) + h / 2, z, o);
  const cone = (r, h, seg, c, x, y, z, o) => mesh(new THREE.ConeGeometry(r, h, seg), c, x, (y || 0) + h / 2, z, o);
  const ball = (r, c, x, y, z, detail, o) => mesh(new THREE.IcosahedronGeometry(r, detail || 0), c, x, y, z, o);
  const glow = (c, i) => ({ emissive: c, emissiveIntensity: i == null ? 1 : i });
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, colorWrite: false, depthWrite: false });
  function hitBox(w, h, d, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), hitMat); m.position.set(x, y, z); m.userData.hit = true; return m; }
  function hash(x, z, k) { const v = Math.sin(x * 127.1 + z * 311.7 + (k || 0) * 74.7) * 43758.5453; return v - Math.floor(v); }
  function rand(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

  // Merge every static, non-glowing mesh of a group into one vertex-coloured mesh (one draw call per building).
  const vcMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  function mergeStatic(group) {
    group.updateMatrixWorld(true);
    const geos = [], keep = [];
    const walk = o => {
      if (o !== group && (o.userData.spin || o.userData.spinX)) { keep.push(o); return; }
      o.children.slice().forEach(walk);
      if (!o.isMesh) return;
      const m = o.material, animated = o.userData.flame || o.userData.crystal || o.userData.lamp || o.userData.hit;
      if (animated || (m.emissive && m.emissive.getHex() !== 0) || m.transparent || !m.color) { keep.push(o); return; }
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      const n = g.attributes.position.count, col = new Float32Array(n * 3), c = m.color;
      for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k);
      geos.push(g);
    };
    walk(group);
    const out = new THREE.Group();
    if (geos.length) { const merged = new THREE.Mesh(THREE.mergeGeometries(geos), vcMat); merged.castShadow = merged.receiveShadow = true; out.add(merged); }
    // keep animated / glowing meshes as separate objects, with their world transform relative to the group
    const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
    keep.forEach(o => { const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld); o.parent && o.parent.remove(o); m.decompose(o.position, o.quaternion, o.scale); out.add(o); });
    Object.assign(out.userData, group.userData);
    return out;
  }

  // ---------- building models (origin = footprint centre on the ground) ----------
  const C = { wood: '#8a5a32', woodL: '#a8703c', woodD: '#5e3b1f', thatch: '#d4ac5e', hide: '#c08a52', stone: '#8d939a', stoneL: '#b4bac0',
    stoneD: '#61666c', berry: '#d8283f', leaf: '#3f8f3c', leafD: '#2f6f30', soil: '#6b4a2a', wheat: '#e6c44a', copper: '#d9814a', iron: '#6f7c8f',
    clay: '#d0a676', water: '#3a9ad9', purple: '#b76cff', gold: '#d9c27a', skin: '#e0b48a', fire: '#ff7a2a', flame: '#ffd04a', white: '#f2efe6', red: '#b8423a', blue: '#3a6ab8' };
  const R0 = rand(7), R = () => R0();
  const flag = (g, x, z, h, col) => { g.add(cyl(0.03, 0.03, h, 4, C.woodD, x, 0, z)); g.add(box(0.28, 0.16, 0.02, col, x + 0.15, h - 0.2, z)); };
  const MODELS = {
    forager(g, t) {
      g.add(box(0.8, 0.04, 0.8, '#7a5a34', 0, 0, 0));
      const basket = (x, z) => { g.add(cyl(0.2, 0.15, 0.22, 8, C.woodL, x, 0, z)); g.add(cyl(0.21, 0.21, 0.04, 8, C.wood, x, 0.2, z)); for (let i = 0; i < 6; i++) g.add(ball(0.055, i % 2 ? C.berry : '#5a2a8a', x + (R() - .5) * .22, 0.25, z + (R() - .5) * .22)); };
      basket(-0.15, 0.12); if (t >= 2) basket(0.2, -0.18);
      g.add(box(0.05, 0.55, 0.05, C.woodD, -0.32, 0, -0.32)); g.add(box(0.05, 0.55, 0.05, C.woodD, 0.32, 0, -0.32)); g.add(box(0.75, 0.04, 0.06, C.woodD, 0, 0.52, -0.32));
      if (t >= 3) { for (let i = 0; i < 3; i++) g.add(ball(0.07, C.leaf, -0.2 + i * 0.2, 0.42, -0.32)); }
      if (t >= 4) flag(g, 0.35, 0.3, 0.8, C.berry);
    },
    woodcutter(g, t) {
      g.add(box(1.8, 0.04, 0.8, '#7a5a34', 0, 0, 0));
      const logs = 4 + t * 2;
      for (let i = 0; i < logs; i++) { const row = Math.floor(i / 4), k = i % 4; const l = cyl(0.1, 0.1, 0.9, 7, k % 2 ? C.wood : C.woodL, -0.35, 0, -0.3 + k * 0.2); l.rotation.z = Math.PI / 2; l.position.y = 0.12 + row * 0.19; g.add(l); }
      g.add(cyl(0.17, 0.2, 0.26, 8, C.woodD, 0.55, 0, 0.05)); g.add(cyl(0.16, 0.16, 0.02, 8, '#d9b07a', 0.55, 0.26, 0.05));
      const axe = box(0.04, 0.42, 0.04, C.woodL, 0.6, 0.26, 0.05); axe.rotation.z = 0.4; g.add(axe); g.add(box(0.14, 0.08, 0.04, C.stoneL, 0.67, 0.62, 0.05));
      if (t >= 3) { g.add(box(0.5, 0.04, 0.5, C.woodD, 0.5, 0.65, -0.2)); g.add(box(0.04, 0.65, 0.04, C.woodD, 0.28, 0, -0.42)); g.add(box(0.04, 0.65, 0.04, C.woodD, 0.72, 0, -0.42)); }
    },
    quarry(g, t) {
      g.add(box(1.8, 0.04, 1.8, '#8a8070', 0, 0, 0));
      const n = 3 + t * 2;
      for (let i = 0; i < n; i++) { const b = box(0.38, 0.26, 0.38, i % 2 ? C.stone : C.stoneL, -0.5 + (i % 3) * 0.45, Math.floor(i / 3) * 0.26, -0.4 + ((i * 7) % 3) * 0.4); b.rotation.y = R() * 0.3; g.add(b); }
      g.add(ball(0.42, C.stoneD, 0.5, 0.25, 0.5, 0)); g.add(cyl(0.02, 0.02, 0.5, 4, C.woodL, 0.1, 0, 0.6)); g.add(box(0.12, 0.08, 0.05, C.iron, 0.1, 0.48, 0.6));
    },
    firepit(g, t) {
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.add(ball(0.08, C.stone, Math.cos(a) * 0.28, 0.05, Math.sin(a) * 0.28)); }
      const l1 = cyl(0.05, 0.05, 0.4, 5, C.woodD, 0, 0.05, 0); l1.rotation.z = Math.PI / 2.6; g.add(l1);
      const f1 = cone(0.16, 0.4, 6, C.fire, 0, 0.02, 0, glow(C.fire, 1.2)), f2 = cone(0.09, 0.26, 5, C.flame, 0, 0.06, 0, glow(C.flame, 1.5));
      f1.castShadow = f2.castShadow = false; f1.userData.flame = 1; f2.userData.flame = 2; g.add(f1, f2);
      g.userData.light = [0, 0.5, 0];
      if (t >= 2) { const s = cyl(0.09, 0.09, 0.6, 6, C.wood, 0, 0, 0.42); s.rotation.z = Math.PI / 2; s.position.y = 0.09; g.add(s); }
      if (t >= 3) { const s = cyl(0.09, 0.09, 0.6, 6, C.wood, 0, 0, -0.42); s.rotation.z = Math.PI / 2; s.position.y = 0.09; g.add(s); }
    },
    hunter(g, t) {
      g.add(box(1.8, 0.04, 1.8, '#7a6448', 0, 0, 0));
      const tent = (x, z, s) => { g.add(cone(0.5 * s, 1.0 * s, 7, C.hide, x, 0, z)); g.add(cyl(0.02, 0.02, 0.25 * s, 3, C.woodD, x, 0.95 * s, z)); g.add(box(0.2 * s, 0.32 * s, 0.03, '#3a2414', x, 0, z + 0.42 * s)); };
      tent(-0.3, -0.25, 1); if (t >= 2) tent(0.5, 0.45, 0.7); if (t >= 4) tent(-0.5, 0.55, 0.6);
      for (let i = 0; i < 3; i++) { g.add(cyl(0.02, 0.02, 1.1, 4, C.woodL, 0.45 + i * 0.12, 0, -0.6)); g.add(cone(0.035, 0.1, 4, C.stoneL, 0.45 + i * 0.12, 1.1, -0.6)); }
      if (t >= 3) { g.add(box(0.5, 0.36, 0.03, '#d8b48a', 0.45, 0.15, -0.15)); g.add(box(0.03, 0.55, 0.03, C.woodD, 0.2, 0, -0.15)); g.add(box(0.03, 0.55, 0.03, C.woodD, 0.7, 0, -0.15)); }
    },
    hut(g, t) {
      const hut = (x, z, s) => { g.add(cyl(0.42 * s, 0.46 * s, 0.45 * s, 9, C.clay, x, 0, z)); g.add(cone(0.62 * s, 0.6 * s, 9, C.thatch, x, 0.4 * s, z)); g.add(cyl(0.04 * s, 0.04 * s, 0.1 * s, 4, C.woodD, x, 0.98 * s, z)); g.add(box(0.18 * s, 0.3 * s, 0.03, '#3a2414', x, 0, z + 0.44 * s)); g.add(box(0.1 * s, 0.1 * s, 0.03, '#2a1a10', x + 0.25 * s, 0.22 * s, z + 0.37 * s)); };
      if (t === 1) hut(0, 0, 1.25); else { hut(-0.35, -0.35, 0.85); hut(0.5, 0.45, 0.68); if (t >= 3) hut(0.5, -0.45, 0.58); if (t >= 4) hut(-0.5, 0.55, 0.58); }
      if (t >= 5) for (let i = 0; i < 6; i++) g.add(box(0.04, 0.3, 0.04, C.woodD, -0.9 + i * 0.36, 0, 0.92));
    },
    fisher(g, t) {
      g.add(box(1.8, 0.04, 0.8, C.woodL, 0, 0.12, 0)); for (let i = 0; i < 4; i++) g.add(box(0.06, 0.16, 0.06, C.woodD, -0.8 + i * 0.53, 0, 0.35));
      g.add(box(0.7, 0.45, 0.55, C.wood, -0.4, 0.16, -0.05)); const fr = cone(0.55, 0.35, 4, C.thatch, -0.4, 0.61, -0.05); fr.rotation.y = Math.PI / 4; g.add(fr);
      g.add(box(0.5, 0.02, 0.4, '#d8d0b0', 0.45, 0.4, 0)); g.add(box(0.03, 0.4, 0.03, C.woodD, 0.22, 0.16, 0)); g.add(box(0.03, 0.4, 0.03, C.woodD, 0.68, 0.16, 0));
      if (t >= 2) { const boat = box(0.7, 0.12, 0.25, C.wood, 0.5, 0.05, 0.6); g.add(boat); }
      if (t >= 3) for (let i = 0; i < 3; i++) g.add(box(0.12, 0.05, 0.05, '#7ab0d0', 0.3 + i * 0.15, 0.36, -0.3));
    },
    farm(g, t) {
      g.add(box(2.8, 0.06, 2.8, C.soil, 0, 0, 0));
      const h = 0.2 + t * 0.06, col = t >= 3 ? C.wheat : '#9bc34a';
      for (let i = 0; i < 6; i++) { g.add(box(0.16, h, 2.4, col, -1.1 + i * 0.44, 0.06, 0)); g.add(box(0.12, 0.05, 2.4, '#5a3c22', -0.88 + i * 0.44, 0.06, 0)); }
      for (let i = 0; i < 4; i++) { g.add(box(2.9, 0.06, 0.06, C.woodD, 0, 0.3 + (i % 2) * 0.2, i < 2 ? -1.42 : 1.42)); }
      if (t >= 3) { g.add(box(0.06, 0.85, 0.06, C.woodD, 1.15, 0, 1.15)); g.add(box(0.45, 0.06, 0.06, C.woodD, 1.15, 0.62, 1.15)); g.add(ball(0.1, C.wheat, 1.15, 0.92, 1.15)); g.add(cone(0.14, 0.12, 6, C.thatch, 1.15, 0.98, 1.15)); }
    },
    copperMine(g, t) {
      g.add(ball(0.95, '#7a6450', 0, 0.2, -0.15, 0)); g.add(box(0.5, 0.6, 0.3, '#1a1410', 0, 0, 0.62));
      g.add(box(0.08, 0.7, 0.08, C.wood, -0.3, 0, 0.75)); g.add(box(0.08, 0.7, 0.08, C.wood, 0.3, 0, 0.75)); g.add(box(0.7, 0.08, 0.1, C.wood, 0, 0.66, 0.75));
      for (let i = 0; i < 3 + t; i++) g.add(box(0.13, 0.13, 0.13, C.copper, -0.7 + R() * 1.4, 0.05 + R() * 0.6, -0.5 + R() * 0.6, glow(C.copper, 0.25)));
      g.add(box(0.04, 0.02, 0.9, C.iron, -0.1, 0, 1.05)); g.add(box(0.04, 0.02, 0.9, C.iron, 0.1, 0, 1.05));
      if (t >= 2) { g.add(box(0.36, 0.22, 0.3, C.woodD, 0.0, 0.05, 1.1)); g.add(box(0.28, 0.1, 0.2, C.copper, 0.0, 0.27, 1.1)); }
    },
    school(g, t) {
      g.add(box(1.5, 0.8, 1.2, C.clay, 0, 0, 0)); g.add(box(1.7, 0.1, 1.4, C.woodD, 0, 0.8, 0)); g.add(box(0.3, 0.5, 0.03, '#3a2414', 0, 0, 0.62));
      [-0.45, 0.45].forEach(x => { g.add(box(0.26, 0.3, 0.03, '#efe0b8', x, 0.3, 0.62)); g.add(box(0.18, 0.02, 0.031, '#5a3c22', x, 0.42, 0.62)); g.add(box(0.18, 0.02, 0.031, '#5a3c22', x, 0.36, 0.62)); });
      if (t >= 3) { g.add(box(1.0, 0.55, 0.8, C.clay, 0, 0.9, -0.1)); g.add(box(1.2, 0.08, 1.0, C.woodD, 0, 1.45, -0.1)); }
      if (t >= 4) flag(g, 0.6, -0.5, 1.9, C.blue);
    },
    ironMine(g, t) {
      g.add(ball(0.95, '#5a4a48', 0, 0.2, -0.15, 0)); g.add(box(0.5, 0.6, 0.3, '#0c0c10', 0, 0, 0.62));
      g.add(box(0.7, 0.08, 0.1, C.iron, 0, 0.66, 0.75)); g.add(box(0.08, 0.7, 0.08, C.iron, -0.3, 0, 0.75)); g.add(box(0.08, 0.7, 0.08, C.iron, 0.3, 0, 0.75));
      g.add(box(0.04, 0.02, 0.9, C.iron, -0.1, 0, 1.05)); g.add(box(0.04, 0.02, 0.9, C.iron, 0.1, 0, 1.05)); g.add(box(0.32, 0.22, 0.36, C.iron, 0, 0.04, 1.1));
      if (t >= 2) { g.add(cyl(0.18, 0.24, 1.3, 7, C.stoneD, 0.72, 0, -0.6)); g.userData.smoke = [0.72, 1.4, -0.6]; }
    },
    workshop(g, t) {
      g.add(box(1.5, 0.75, 1.3, C.wood, 0, 0, 0)); g.add(box(1.52, 0.06, 1.32, C.woodD, 0, 0.36, 0));
      const roof = cyl(0.8, 0.8, 1.55, 3, '#7a3a2a', 0, 0, 0); roof.rotation.z = Math.PI / 2; roof.rotation.x = Math.PI / 6; roof.position.y = 0.92; roof.scale.set(1, 1, 0.9); g.add(roof);
      g.add(box(0.35, 0.5, 0.03, '#2a1a10', 0, 0, 0.66)); g.add(box(0.2, 0.2, 0.03, '#ffd884', -0.45, 0.35, 0.66, glow('#ffb84a', 0.4)));
      const gear = new THREE.Group(); gear.add(cyl(0.28, 0.28, 0.07, 10, C.gold, 0, -0.035, 0)); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; gear.add(box(0.09, 0.07, 0.09, C.gold, Math.cos(a) * 0.32, -0.035, Math.sin(a) * 0.32)); }
      gear.rotation.x = Math.PI / 2; gear.position.set(0.48, 0.72, 0.68); gear.userData.spin = 1.5; g.add(gear);
      if (t >= 3) g.add(box(0.45, 0.4, 0.45, C.iron, -0.95, 0, 0.3));
    },
    waterwheel(g, t) {
      g.add(box(1.9, 0.05, 0.9, C.water, 0, 0, 0.45, { transparent: true, opacity: 0.85 }));
      g.add(box(0.1, 1.1, 0.1, C.woodD, -0.3, 0, -0.4)); g.add(box(0.1, 1.1, 0.1, C.woodD, 0.3, 0, -0.4));
      g.add(box(0.8, 0.6, 0.6, C.wood, -0.6, 0, -0.55)); const wr = cone(0.6, 0.35, 4, C.thatch, -0.6, 0.6, -0.55); wr.rotation.y = Math.PI / 4; g.add(wr);
      const wheel = new THREE.Group();
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.06, 4, 14), mat(C.wood)); rim.castShadow = true; wheel.add(rim);
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const p = box(0.07, 0.3, 0.38, C.woodL, Math.cos(a) * 0.72, Math.sin(a) * 0.72 - 0.15, 0); p.rotation.z = a; wheel.add(p); }
      wheel.rotation.y = Math.PI / 2; wheel.position.set(0, 0.78, 0.1); wheel.userData.spinX = -1; g.add(wheel);
    },
    observatory(g, t) {
      g.add(cyl(0.6, 0.72, 1.5, 9, C.stone, 0, 0, 0)); g.add(cyl(0.64, 0.64, 0.08, 9, C.stoneD, 0, 1.5, 0));
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.6, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat('#c9d0d8')); dome.position.y = 1.58; dome.castShadow = true; g.add(dome);
      const tel = cyl(0.07, 0.11, 0.9, 6, C.gold, 0.25, 1.75, 0); tel.rotation.z = -0.7; g.add(tel);
      g.add(box(0.3, 0.45, 0.03, '#2a2f3a', 0, 0, 0.7));
      for (let i = 0; i < 3; i++) g.add(box(0.12, 0.18, 0.03, '#ffe6a0', Math.cos(i * 2.1) * 0.62, 0.9, Math.sin(i * 2.1) * 0.62, glow('#ffd070', 0.3)));
    },
    geyserPlant(g, t) {
      g.add(cyl(0.7, 0.8, 0.12, 10, '#6d7a7a', 0, 0, 0)); g.add(cyl(0.4, 0.45, 0.8, 8, C.iron, 0, 0.12, 0));
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat(C.copper)); dome.position.y = 0.92; dome.castShadow = true; g.add(dome);
      const pipe = cyl(0.08, 0.08, 1.1, 6, C.iron, 0.6, 0.4, 0); pipe.rotation.z = Math.PI / 2; g.add(pipe); g.add(box(0.3, 0.5, 0.3, C.stoneD, 0.95, 0, 0));
      g.add(box(0.2, 0.08, 0.03, '#6fd3ff', 0, 0.55, 0.43, glow('#6fd3ff', 1.2)));
      g.userData.smoke = [0, 1.3, 0];
    },
    crater(g, t) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.3, 4, 12), mat('#3f2f48')); ring.rotation.x = Math.PI / 2; ring.position.y = 0.05; ring.castShadow = ring.receiveShadow = true; g.add(ring);
      g.add(cyl(1.0, 1.0, 0.04, 12, '#26182e', 0, 0, 0));
      for (let i = 0; i < 2 + t; i++) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.18 + R() * 0.12, 0), mat(C.purple, glow(C.purple, 0.9))); c.position.set((R() - .5) * 1.2, 0.2, (R() - .5) * 1.2); c.rotation.set(R(), R(), R()); c.userData.crystal = true; c.castShadow = true; g.add(c); }
      g.add(box(0.06, 0.8, 0.06, C.woodD, 1.25, 0, 1.25)); g.add(box(0.5, 0.06, 0.06, C.woodD, 1.25, 0.7, 1.25));
      g.userData.light = [0, 0.6, 0]; g.userData.lightColor = '#c77dff';
    }
  };

  // ---------- module state ----------
  let renderer, scene, camera, cvs, host, opts, quality = 'medium', pixel = 3;
  let rtColor, rtNormal, postScene, postCam, postMat, normalMat;
  let sun, hemi, terrain, sea, river, worldW = 1, worldH = 1, lastRegions = '', lastBuildSig = '';
  const decoMeshes = [], decoList = [], buildings = new Map(), specials = [], villagers = [], critters = [], smoke = [], pointLights = [];
  let machine, traveler, ghost = null, ghostPad = null, allowOverlay = null, selPad, hoverPad, placing = null, fogClouds = null, cursorGrid;
  const cam = { target: new THREE.Vector3(2, 0, 3), yaw: Math.PI / 4, pitch: 0.95, zoom: 1.4, yawGoal: Math.PI / 4 };
  let lastState = null, hover = null, animDirty = true;
  const animated = [], clear = new Set();

  // ---------- terrain ----------
  const SAND = new THREE.Color('#e2cf8f'), FOGC = new THREE.Color('#9aa3ad');
  function cellTop(x, z) { return W.isSea(x, z) ? null : W.isRiver(x, z) ? -0.45 : 0; }
  function buildTerrain() {
    const pos = [], col = [], c = new THREE.Color();
    const pushQuad = (a, b, d, e, color) => { [a, b, d, a, d, e].forEach(p => { pos.push(p[0], p[1], p[2]); col.push(color.r, color.g, color.b); }); };
    for (let x = W.MIN; x <= W.MAX; x++) for (let z = W.MIN; z <= W.MAX; z++) {
      const h = cellTop(x, z); if (h === null) continue;
      const reg = W.regionAt(x, z);
      c.set(REG[reg].ground);
      if (reg !== 'beach' && reg !== 'tundra' && W.isCoast(x, z)) c.lerp(SAND, 0.75);
      if (W.isRiver(x, z)) c.set('#6a5a40');
      c.offsetHSL(0, 0, (hash(x, z) - 0.5) * 0.05);
      pushQuad([x, h, z], [x, h, z + 1], [x + 1, h, z + 1], [x + 1, h, z], c.clone());
      // walls down to lower neighbours (coast cliffs and river banks)
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dz]) => {
        const nh = cellTop(x + dx, z + dz), low = nh === null ? -1.2 : nh;
        if (low >= h) return;
        const wc = new THREE.Color(nh === null ? '#b8a06a' : '#7a5a3a').offsetHSL(0, 0, (hash(x, z, 3) - 0.5) * 0.06);
        let a, b;
        if (dx === 1) { a = [x + 1, h, z + 1]; b = [x + 1, h, z]; } else if (dx === -1) { a = [x, h, z]; b = [x, h, z + 1]; }
        else if (dz === 1) { a = [x, h, z + 1]; b = [x + 1, h, z + 1]; } else { a = [x + 1, h, z]; b = [x, h, z]; }
        pushQuad(a, [a[0], low, a[2]], [b[0], low, b[2]], b, wc);
      });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
    geo.userData.base = col.slice();
    terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    terrain.receiveShadow = true; scene.add(terrain);
    // sea floor + sea, river water
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), mat('#2a6a8a')); floor.rotation.x = -Math.PI / 2; floor.position.y = -1.2; floor.receiveShadow = true; scene.add(floor);
    sea = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshLambertMaterial({ color: '#2f8fd0', transparent: true, opacity: 0.72 }));
    sea.rotation.x = -Math.PI / 2; sea.position.y = -0.3; scene.add(sea);
    const rv = []; for (let x = W.MIN; x <= W.MAX; x++) for (let z = W.MIN; z <= W.MAX; z++) if (W.isRiver(x, z)) rv.push(x, z);
    const rgeo = new THREE.BufferGeometry(), rp = [];
    for (let i = 0; i < rv.length; i += 2) { const x = rv[i], z = rv[i + 1], y = -0.12; rp.push(x, y, z, x, y, z + 1, x + 1, y, z + 1, x, y, z, x + 1, y, z + 1, x + 1, y, z); }
    rgeo.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3)); rgeo.computeVertexNormals();
    river = new THREE.Mesh(rgeo, new THREE.MeshLambertMaterial({ color: '#3aa6e0', transparent: true, opacity: 0.8 })); scene.add(river);
  }
  // locked regions look grey and sit under clouds
  function paintRegions(S) {
    const geo = terrain.geometry, base = geo.userData.base, col = geo.attributes.color, pos = geo.attributes.position;
    for (let i = 0; i < col.count; i += 6) {
      const x = Math.floor((pos.getX(i) + pos.getX(i + 2)) / 2 - 0.001), z = Math.floor((pos.getZ(i) + pos.getZ(i + 2)) / 2 - 0.001);
      const reg = W.regionAt(Math.max(W.MIN, Math.min(W.MAX, x)), Math.max(W.MIN, Math.min(W.MAX, z)));
      const locked = reg && !S.regions.includes(reg);
      for (let k = i; k < i + 6; k++) {
        let r = base[k * 3], g = base[k * 3 + 1], b = base[k * 3 + 2];
        if (locked) { const l = (r + g + b) / 3; r = l * 0.5 + FOGC.r * 0.5; g = l * 0.5 + FOGC.g * 0.5; b = l * 0.5 + FOGC.b * 0.5; }
        col.setXYZ(k, r, g, b);
      }
    }
    col.needsUpdate = true;
    // clouds
    if (fogClouds) { scene.remove(fogClouds); fogClouds.geometry.dispose(); }
    const spots = [];
    const lockedAt = (x, z) => { const r = W.regionAt(x, z); return r ? !S.regions.includes(r) : true; };
    const deep = (x, z) => { for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) if (!lockedAt(x + i, z + j)) return false; return true; };
    for (let x = W.MIN; x <= W.MAX; x += 2) for (let z = W.MIN; z <= W.MAX; z += 2) { const reg = W.regionAt(x, z); if (reg && !S.regions.includes(reg) && deep(x, z)) spots.push([x + 0.5 + (hash(x, z) - 0.5), z + 0.5 + (hash(z, x) - 0.5), hash(x, z, 9)]); }
    fogClouds = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), mat('#dfe5ec'), Math.max(1, spots.length));
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    spots.forEach(([x, z, k], i) => { p.set(x, 0.9 + k * 0.7, z); s.set(1.5 + k * 0.6, 0.8 + k * 0.5, 1.5 + k * 0.6); q.setFromEuler(new THREE.Euler(0, k * 6, 0)); m.compose(p, q, s); fogClouds.setMatrixAt(i, m); });
    fogClouds.count = spots.length; fogClouds.castShadow = true; fogClouds.userData.fog = true; scene.add(fogClouds);
    decoMeshes.forEach(dm => refreshDeco(dm));
  }

  // ---------- nature (instanced) ----------
  function mergedProto(build) { const g = new THREE.Group(); build(g); const m = mergeStatic(g); return m.children[0].geometry; }
  const PROTOS = {
    oak: g => { g.add(cyl(0.12, 0.16, 0.7, 5, C.wood)); g.add(ball(0.6, C.leaf, 0, 1.05, 0, 0)); g.add(ball(0.4, '#4fa64a', 0.25, 1.35, 0.15, 0)); },
    pine: g => { g.add(cyl(0.1, 0.14, 0.5, 5, C.woodD)); g.add(cone(0.62, 1.0, 7, C.leafD, 0, 0.35)); g.add(cone(0.45, 0.85, 7, C.leaf, 0, 0.9)); },
    snowpine: g => { g.add(cyl(0.1, 0.14, 0.5, 5, C.woodD)); g.add(cone(0.62, 1.0, 7, '#3a6a5a', 0, 0.35)); g.add(cone(0.45, 0.85, 7, '#e8f0f4', 0, 0.9)); },
    palm: g => { const t = cyl(0.08, 0.12, 1.4, 5, '#9a7a4a'); t.rotation.z = 0.15; g.add(t); for (let i = 0; i < 5; i++) { const l = box(0.9, 0.04, 0.22, '#4fa64a', Math.cos(i * 1.26) * 0.4, 1.35, Math.sin(i * 1.26) * 0.4); l.rotation.y = -i * 1.26; l.rotation.z = -0.3; g.add(l); } },
    mangrove: g => { for (let i = 0; i < 4; i++) { const r = cyl(0.04, 0.04, 0.5, 4, '#5a4a3a', Math.cos(i * 1.57) * 0.25, 0, Math.sin(i * 1.57) * 0.25); r.rotation.z = (i % 2 ? 1 : -1) * 0.4; g.add(r); } g.add(cyl(0.1, 0.12, 0.6, 5, '#5a4a3a', 0, 0.4)); g.add(ball(0.65, '#3f6f3a', 0, 1.2, 0, 0)); },
    dead: g => { g.add(cyl(0.08, 0.12, 1.1, 5, '#6a5040')); const b = cyl(0.04, 0.05, 0.5, 4, '#6a5040', 0.15, 0.7); b.rotation.z = -0.8; g.add(b); },
    fern: g => { for (let i = 0; i < 6; i++) { const l = box(0.7, 0.03, 0.16, '#5fae4a', Math.cos(i) * 0.3, 0.25, Math.sin(i) * 0.3); l.rotation.y = -i; l.rotation.z = -0.5; g.add(l); } },
    giantfern: g => { g.add(cyl(0.1, 0.14, 1.4, 6, '#6a5a3a')); for (let i = 0; i < 7; i++) { const l = box(1.1, 0.04, 0.24, '#3f8f3c', Math.cos(i * 0.9) * 0.5, 1.4, Math.sin(i * 0.9) * 0.5); l.rotation.y = -i * 0.9; l.rotation.z = -0.35; g.add(l); } },
    bush: g => { g.add(ball(0.42, C.leaf, 0, 0.35, 0, 0)); g.add(ball(0.28, '#4fa64a', 0.2, 0.55, 0.1, 0)); for (let i = 0; i < 6; i++) g.add(ball(0.06, C.berry, Math.cos(i) * 0.36, 0.3 + (i % 3) * 0.12, Math.sin(i) * 0.36)); },
    reeds: g => { for (let i = 0; i < 6; i++) { g.add(cyl(0.02, 0.02, 0.7, 3, '#7a9a4a', (hash(i, 1) - .5) * 0.5, 0, (hash(1, i) - .5) * 0.5)); g.add(cyl(0.04, 0.04, 0.12, 4, '#6a4a2a', (hash(i, 1) - .5) * 0.5, 0.62, (hash(1, i) - .5) * 0.5)); } },
    rock: g => { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45, 0), mat(C.stone)); r.position.y = 0.25; r.rotation.set(0.4, 0.8, 0.2); g.add(r); g.add(ball(0.22, C.stoneL, 0.35, 0.15, 0.2, 0)); },
    bigrock: g => { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8, 0), mat('#7f858c')); r.position.y = 0.45; r.rotation.set(0.3, 0.5, 0.1); g.add(r); g.add(ball(0.35, C.stoneL, 0.6, 0.2, 0.3, 0)); },
    redrock: g => { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7, 0), mat('#a85a3a')); r.position.y = 0.4; r.rotation.set(0.2, 0.9, 0.3); g.add(r); g.add(box(0.5, 0.9, 0.4, '#8a4a32', 0.4, 0, -0.3)); },
    copperrock: g => { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6, 0), mat('#7a6a5a')); r.position.y = 0.35; g.add(r); g.add(box(0.15, 0.15, 0.15, C.copper, 0.3, 0.5, 0.2)); g.add(box(0.12, 0.12, 0.12, '#5ab08a', -0.25, 0.45, 0.2)); },
    ice: g => { g.add(box(0.7, 0.5, 0.6, '#cfe8f2')); g.add(box(0.4, 0.4, 0.4, '#e8f6fb', 0.25, 0.4, 0.1)); },
    crystal: g => { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), mat('#9a5ad0')); c.position.y = 0.4; c.scale.y = 1.6; g.add(c); g.add(ball(0.3, '#3a2a40', 0.2, 0.1, 0.1, 0)); },
    vent: g => { g.add(cyl(0.45, 0.55, 0.2, 8, '#c8c0a8')); g.add(cyl(0.2, 0.25, 0.22, 6, '#6a8a8a', 0, 0.02)); },
    flowers: g => { for (let i = 0; i < 5; i++) { const x = (hash(i, 3) - .5) * 0.6, z = (hash(3, i) - .5) * 0.6; g.add(cyl(0.015, 0.015, 0.25, 3, '#4a8a3a', x, 0, z)); g.add(ball(0.06, ['#f2d14b', '#e86a9a', '#ffffff'][i % 3], x, 0.27, z)); } }
  };
  const CLICK_OF = { oak: 'wood', pine: 'wood', snowpine: 'wood', palm: 'wood', mangrove: 'wood', dead: 'wood', giantfern: 'wood', bush: 'food', fern: 'food', reeds: 'food', flowers: 'food', rock: 'stone', bigrock: 'stone', redrock: 'stone', copperrock: 'stone', ice: 'stone' };
  const DECO_BY_REGION = {
    meadow: [['oak', 0.05], ['bush', 0.035], ['rock', 0.02], ['flowers', 0.05]],
    forest: [['pine', 0.28], ['oak', 0.1], ['fern', 0.12], ['bush', 0.02]],
    river: [['oak', 0.04], ['reeds', 0.08], ['bush', 0.03], ['flowers', 0.03]],
    hills: [['bigrock', 0.1], ['rock', 0.06], ['pine', 0.04]],
    beach: [['palm', 0.05], ['rock', 0.02]],
    swamp: [['mangrove', 0.14], ['reeds', 0.1], ['fern', 0.05]],
    copper: [['copperrock', 0.1], ['bigrock', 0.04]],
    tundra: [['snowpine', 0.08], ['ice', 0.05], ['rock', 0.03]],
    iron: [['redrock', 0.1], ['dead', 0.03]],
    geysers: [['vent', 0.03], ['rock', 0.06], ['dead', 0.02]],
    plateau: [['giantfern', 0.12], ['palm', 0.05], ['fern', 0.08]],
    crater: [['crystal', 0.05], ['bigrock', 0.06]]
  };
  function buildNature() {
    const near = (x, z) => Math.abs(x - 2) < 6 && Math.abs(z - 2.5) < 6; // keep the crash site clear
    const lists = {};
    for (let x = W.MIN; x <= W.MAX; x++) for (let z = W.MIN; z <= W.MAX; z++) {
      if (!W.buildable(x, z) || near(x, z)) continue;
      const reg = W.regionAt(x, z); let acc = 0; const h = hash(x, z, 5);
      for (const [kind, p] of DECO_BY_REGION[reg]) { acc += p; if (h < acc) { (lists[kind] = lists[kind] || []).push({ x, z, reg, s: 0.8 + hash(z, x, 2) * 0.5, r: hash(x, z, 7) * 6.28 }); break; } }
    }
    for (const kind in lists) {
      const items = lists[kind], im = new THREE.InstancedMesh(mergedProto(PROTOS[kind]), vcMat, items.length);
      im.castShadow = im.receiveShadow = true; im.userData.kind = kind; im.userData.items = items; im.userData.click = CLICK_OF[kind] ? { res: CLICK_OF[kind] } : null;
      items.forEach(it => { it.mesh = im; decoList.push(it); });
      decoMeshes.push(im); scene.add(im);
    }
  }
  function refreshDeco(im) {
    const S = lastState, occ = new Set();
    if (S) S.buildings.forEach(b => { const [w, d] = root.Engine.footprint(b.type, b.rot); for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) occ.add((b.x + i) + ',' + (b.z + j)); });
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    im.userData.items.forEach((it, i) => {
      const hidden = occ.has(it.x + ',' + it.z) || (S && !S.regions.includes(it.reg));
      p.set(it.x + 0.5, 0, it.z + 0.5); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.r); s.setScalar(hidden ? 0.0001 : it.s);
      m.compose(p, q, s); im.setMatrixAt(i, m);
    });
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
  }

  // ---------- special objects: clues, lost parts, eggs ----------
  const SPECIAL_MODEL = {
    carving: g => { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45, 0), mat('#9a9590')); r.position.y = 0.35; g.add(r); g.add(box(0.3, 0.05, 0.02, '#c0302a', 0, 0.45, 0.42, glow('#c0302a', 0.4))); g.add(box(0.05, 0.25, 0.02, '#c0302a', 0.13, 0.36, 0.42, glow('#c0302a', 0.4))); },
    glint: g => { g.add(box(0.25, 0.08, 0.18, '#c9d0d8', 0, 0.02, 0)); g.add(ball(0.06, '#fff2a8', 0, 0.15, 0, 0, glow('#fff2a8', 2))); },
    cairn: g => { for (let i = 0; i < 4; i++) g.add(ball(0.22 - i * 0.04, i % 2 ? C.stone : C.stoneL, 0, 0.15 + i * 0.22, 0, 0)); g.add(box(0.08, 0.04, 0.08, '#2a2a2a', 0, 0.98, 0)); },
    footprints: g => { for (let i = 0; i < 4; i++) { g.add(box(0.22, 0.02, 0.3, '#5a4028', (i % 2 ? 0.2 : -0.2), 0.01, -0.6 + i * 0.4)); g.add(box(0.06, 0.02, 0.1, '#5a4028', (i % 2 ? 0.2 : -0.2), 0.01, -0.42 + i * 0.4)); } },
    bottle: g => { const b = cyl(0.08, 0.1, 0.3, 6, '#5ab08a', 0, 0, 0, { transparent: true, opacity: 0.85 }); b.rotation.z = 1.3; b.position.y = 0.1; g.add(b); g.add(box(0.1, 0.06, 0.06, '#efe0b8', 0.12, 0.08, 0)); },
    skull: g => { g.add(ball(0.32, '#ece4d0', 0, 0.28, 0, 0)); g.add(box(0.06, 0.06, 0.5, '#f4ecd8', 0.18, 0.18, 0.3)); g.add(box(0.06, 0.06, 0.5, '#f4ecd8', -0.18, 0.18, 0.3)); },
    part: g => { g.add(box(0.6, 0.12, 0.45, '#c9d0d8', 0, 0.02, 0)); g.add(box(0.2, 0.3, 0.2, '#8a9096', 0.15, 0.1, 0)); g.add(ball(0.08, '#c77dff', -0.15, 0.25, 0, 0, glow('#c77dff', 1.8))); },
    phone: g => { g.add(box(0.18, 0.03, 0.32, '#1a1a1a', 0, 0.01, 0)); g.add(box(0.15, 0.01, 0.28, '#3a8ad0', 0, 0.045, 0, glow('#3a8ad0', 0.8))); },
    duck: g => { g.add(ball(0.18, '#ffd84a', 0, 0.15, 0, 1)); g.add(ball(0.11, '#ffd84a', 0.14, 0.33, 0, 1)); g.add(box(0.1, 0.04, 0.06, '#ff8a2a', 0.27, 0.32, 0)); },
    shell: g => { const s = cone(0.2, 0.35, 7, '#f0c0b0'); s.rotation.z = 1.4; s.position.y = 0.15; g.add(s); },
    dinoegg: g => { const e = ball(0.3, '#e8dcc0', 0, 0.35, 0, 1); e.scale.y = 1.3; g.add(e); g.add(ball(0.06, '#a08060', 0.18, 0.5, 0.15)); g.add(ball(0.05, '#a08060', -0.12, 0.35, 0.22)); },
    coin: g => { const c = cyl(0.15, 0.15, 0.03, 10, '#e0c040', 0, 0.01, 0, glow('#e0c040', 0.4)); g.add(c); },
    glasses: g => { g.add(box(0.12, 0.06, 0.02, '#111', -0.08, 0.05, 0)); g.add(box(0.12, 0.06, 0.02, '#111', 0.08, 0.05, 0)); g.add(box(0.05, 0.02, 0.02, '#111', 0, 0.07, 0)); }
  };
  function buildSpecials() {
    W.SPECIAL.forEach(sp => {
      const g = new THREE.Group(); SPECIAL_MODEL[sp.kind](g);
      g.add(hitBox(1, 1.2, 1, 0, 0.6, 0));
      const spark = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), mat('#fff6c0', glow('#fff6c0', 2.5))); spark.position.y = 1.2; spark.userData.spark = true; spark.castShadow = false; g.add(spark);
      g.position.set(sp.at[0] + 0.5, 0, sp.at[1] + 0.5); g.rotation.y = hash(sp.at[0], sp.at[1]) * 6;
      g.traverse(o => o.userData.click = { special: sp });
      g.userData.sp = sp; g.visible = false; specials.push(g); scene.add(g);
    });
  }
  function specialActive(S, sp) {
    const E = root.Engine;
    return sp.type === 'clue' ? E.clueActive(S, sp.idx) : sp.type === 'part' ? E.partActive(S, sp.idx) : E.eggActive(S, sp.idx);
  }

  // ---------- machine, traveller, critters ----------
  function buildMachine() {
    const M = W.MACHINE; machine = new THREE.Group(); machine.position.set(M.x + M.w / 2, 0, M.z + M.d / 2);
    const parts = machine.userData.parts = {};
    const P = (name, obj) => { (parts[name] = parts[name] || []).push(obj); machine.add(obj); return obj; };
    P('base', cyl(1.3, 1.45, 0.12, 12, '#5a4a3a', 0, 0, 0));
    P('woodLegs', cyl(0.08, 0.08, 0.7, 5, C.wood, -0.6, 0, 0.3)); P('woodLegs', cyl(0.08, 0.08, 0.5, 5, C.wood, 0.6, 0, -0.2));
    P('frame', cyl(0.07, 0.1, 0.7, 6, C.iron, -0.6, 0, 0.35)); P('frame', cyl(0.07, 0.1, 0.7, 6, C.iron, 0.6, 0, 0.35)); P('frame', cyl(0.07, 0.1, 0.7, 6, C.iron, 0, 0, -0.65));
    const body = P('body', new THREE.Mesh(new THREE.CapsuleGeometry(0.85, 0.9, 4, 12), mat('#d0d6dc'))); body.position.y = 1.55; body.castShadow = body.receiveShadow = true;
    const broken = P('broken', new THREE.Mesh(new THREE.CapsuleGeometry(0.86, 0.9, 4, 12), mat('#7c838a'))); broken.position.y = 1.55; broken.castShadow = true;
    [[0.5, 1.9, 0.6], [-0.4, 1.3, 0.7], [0.2, 2.3, -0.7], [-0.7, 1.8, -0.3]].forEach(([x, y, z]) => P('broken', box(0.28, 0.22, 0.1, '#20242c', x, y, z)));
    const ring = P('ring', new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.09, 5, 18), mat('#6d7278'))); ring.rotation.x = Math.PI / 2; ring.position.y = 1.35; ring.castShadow = true;
    const ringGold = P('gearbox', new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.1, 5, 18), mat(C.gold))); ringGold.rotation.x = Math.PI / 2; ringGold.position.y = 1.35;
    const port = P('port', cyl(0.36, 0.36, 0.08, 12, '#2a2f3a', 0, 0, 0)); port.position.set(0, 2.1, 0.82); port.rotation.x = Math.PI / 2;
    P('lens', cyl(0.3, 0.3, 0.04, 12, '#9ad8ff', 0, 0, 0, { transparent: true, opacity: 0.7 })).position.set(0, 2.1, 0.87); parts.lens[0].rotation.x = Math.PI / 2;
    P('core', ball(0.24, C.purple, 0, 2.1, 0.84, 1, glow(C.purple, 1.6)));
    P('cable', box(0.05, 0.9, 0.05, C.copper, -0.8, 0.9, 0.3, glow(C.copper, 0.2))); P('cable', box(0.05, 0.7, 0.05, C.copper, 0.82, 1.0, -0.2, glow(C.copper, 0.2)));
    P('console', box(0.6, 0.35, 0.3, '#3a3f4a', -1.3, 0, 0.6)); P('console', box(0.5, 0.2, 0.04, '#6fff8a', -1.3, 0.3, 0.76, glow('#6fff8a', 0.8)));
    P('nav', box(0.3, 0.3, 0.3, '#8a9096', 0.9, 2.2, 0)); P('nav', ball(0.07, '#6fd3ff', 0.9, 2.45, 0, 0, glow('#6fd3ff', 1.5)));
    P('coolant', cyl(0.18, 0.18, 0.6, 8, '#5ab0d0', 1.25, 0, -0.5));
    P('chronometer', cyl(0.2, 0.2, 0.06, 12, C.gold, 0, 2.9, 0));
    const gear = new THREE.Group(); gear.add(cyl(0.25, 0.25, 0.08, 10, C.gold)); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; gear.add(box(0.08, 0.08, 0.08, C.gold, Math.cos(a) * 0.29, 0, Math.sin(a) * 0.29)); }
    gear.rotation.z = Math.PI / 2; gear.position.set(0.95, 1.6, 0.2); gear.userData.spin = 2; P('gearbox', gear);
    P('battery', box(0.5, 0.35, 0.3, '#1a3d66', 0, 0.55, 0.75)); P('battery', box(0.38, 0.12, 0.05, '#6fd3ff', 0, 0.7, 0.92, glow('#6fd3ff', 1.5)));
    P('antenna', cyl(0.03, 0.03, 0.6, 4, C.iron, 0, 2.75, 0));
    const lamp = P('lamp', ball(0.1, '#ff4a4a', 0, 3.4, 0, 0, glow('#ff4a4a', 1.5))); lamp.userData.lamp = true;
    machine.add(hitBox(2.6, 3.6, 2.6, 0, 1.8, 0));
    machine.traverse(o => o.userData.click = { res: 'ideas', machine: true });
    scene.add(machine);
    traveler = person('#2a8a9a', C.skin, '#5a3a22'); traveler.add(box(0.26, 0.05, 0.05, '#ffd84a', 0, 0.9, 0.1));
    traveler.position.set(M.x - 0.6, 0, M.z + M.d + 0.4); scene.add(traveler);
  }
  function person(cloth, skin, hair) {
    const g = new THREE.Group();
    g.add(cyl(0.12, 0.15, 0.36, 6, cloth, 0, 0.2)); g.add(ball(0.12, skin, 0, 0.68, 0, 1)); g.add(box(0.22, 0.07, 0.22, hair, 0, 0.76, -0.02));
    const l1 = box(0.07, 0.2, 0.07, skin, -0.05, 0, 0), l2 = box(0.07, 0.2, 0.07, skin, 0.05, 0, 0); g.add(l1, l2); g.userData.legs = [l1, l2];
    return g;
  }
  function makeVillager(i) {
    const rnd = rand(100 + i);
    const g = person([C.wood, C.woodL, C.hide, '#6b4426'][i % 4], ['#e0b48a', '#c89060', '#8a5a3a'][i % 3], ['#2a1a10', '#5a3a22', '#8a6a3a'][i % 3]);
    if (i % 3 === 0) g.add(box(0.04, 0.4, 0.04, C.woodL, 0.14, 0.3, 0.05));
    g.userData.speed = 0.9 + rnd() * 0.6; g.userData.wait = rnd() * 2; g.visible = false; scene.add(g); return g;
  }
  function makeCritter(kind, region, i) {
    const g = new THREE.Group();
    if (kind === 'mammoth') { const b = '#7a4a2a', d = '#5a3418'; g.add(box(1.4, 0.9, 0.8, b, 0, 0.5, 0)); g.add(box(0.7, 0.7, 0.7, b, 0.85, 0.75, 0)); g.add(box(0.15, 0.7, 0.15, d, 1.25, 0.2, 0)); g.add(box(0.06, 0.06, 0.45, '#f4ecd8', 1.2, 0.55, 0.25)); g.add(box(0.06, 0.06, 0.45, '#f4ecd8', 1.2, 0.55, -0.25)); g.userData.legs = [[-0.45, 0.25], [-0.45, -0.25], [0.45, 0.25], [0.45, -0.25]].map(([x, z]) => { const l = box(0.22, 0.5, 0.22, d, x, 0, z); g.add(l); return l; }); }
    if (kind === 'turtle') { const sh = ball(0.5, '#5a7a3a', 0, 0.25, 0, 0); sh.scale.y = 0.6; g.add(sh); g.add(ball(0.18, '#8aaa5a', 0.55, 0.2, 0, 0)); g.userData.legs = []; g.scale.setScalar(1.2); }
    if (kind === 'frog') { g.add(ball(0.25, '#4a9a3a', 0, 0.2, 0, 0)); g.add(ball(0.08, '#f2d14b', 0.15, 0.38, 0.1)); g.add(ball(0.08, '#f2d14b', 0.15, 0.38, -0.1)); g.userData.legs = []; }
    if (kind === 'dino') { const c = '#4a8a5a'; g.add(box(1.6, 0.9, 0.8, c, 0, 0.9, 0)); g.add(box(0.5, 1.6, 0.5, c, 0.9, 1.3, 0)); g.add(box(0.7, 0.4, 0.45, c, 1.25, 2.7, 0)); g.add(box(1.4, 0.3, 0.3, c, -1.3, 1.1, 0)); g.userData.legs = [[-0.4, 0.3], [-0.4, -0.3], [0.4, 0.3], [0.4, -0.3]].map(([x, z]) => { const l = box(0.28, 0.9, 0.28, '#3a6a4a', x, 0, z); g.add(l); return l; }); g.scale.setScalar(1.3); }
    const cells = W.regionCells(region).filter(([x, z]) => W.buildable(x, z));
    const home = cells[Math.floor(hash(i, 7) * cells.length)] || [0, 0];
    g.position.set(home[0] + 0.5, 0, home[1] + 0.5);
    g.userData.region = region; g.userData.cells = cells; g.userData.speed = kind === 'dino' ? 0.9 : kind === 'frog' ? 0.7 : 0.5; g.userData.wait = 0;
    g.visible = false; critters.push(g); scene.add(g); return g;
  }

  // ---------- buildings ----------
  function makeBuilding(type, lvl, withHit) {
    const raw = new THREE.Group(); MODELS[type](raw, tierOf(lvl));
    const g = mergeStatic(raw);
    if (withHit) { const [w, d] = BDEF[type].foot; g.add(hitBox(w, 1.3, d, 0, 0.65, 0)); }
    return g;
  }
  function placeObj(obj, type, b) { const [w, d] = root.Engine.footprint(type, b.rot); obj.position.set(b.x + w / 2, 0, b.z + d / 2); obj.rotation.y = -b.rot * Math.PI / 2; }
  function syncBuildings(S) {
    const seen = new Set();
    S.buildings.forEach(b => {
      seen.add(b.id);
      if (placing && placing.moveId === b.id) { const e = buildings.get(b.id); if (e) e.obj.visible = false; return; }
      let e = buildings.get(b.id); const tier = tierOf(b.lvl);
      if (!e || e.tier !== tier || e.type !== b.type) {
        if (e) scene.remove(e.obj);
        const obj = makeBuilding(b.type, b.lvl, true); obj.traverse(o => o.userData.click = { building: b.id });
        e = { obj, tier, type: b.type }; buildings.set(b.id, e); scene.add(obj); animDirty = true;
      }
      e.obj.visible = true; placeObj(e.obj, b.type, b);
    });
    for (const [id, e] of buildings) if (!seen.has(id)) { scene.remove(e.obj); buildings.delete(id); animDirty = true; }
    const sig = S.buildings.map(b => b.id + ':' + b.x + ':' + b.z + ':' + b.rot).join('|') + '#' + S.regions.length;
    if (sig !== lastBuildSig) { lastBuildSig = sig; decoMeshes.forEach(refreshDeco); }
  }

  // ---------- post-processing ----------
  function setupPost() {
    rtColor = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, type: THREE.HalfFloatType });
    rtColor.depthTexture = new THREE.DepthTexture(1, 1); rtColor.depthTexture.minFilter = rtColor.depthTexture.magFilter = THREE.NearestFilter;
    rtNormal = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    normalMat = new THREE.MeshNormalMaterial({ flatShading: true });
    postMat = new THREE.ShaderMaterial({
      uniforms: { tColor: { value: rtColor.texture }, tDepth: { value: rtColor.depthTexture }, tNormal: { value: rtNormal.texture }, texel: { value: new THREE.Vector2() }, depthK: { value: 650 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D tColor; uniform sampler2D tDepth; uniform sampler2D tNormal; uniform vec2 texel; uniform float depthK; varying vec2 vUv;
        float D(vec2 o){ return texture2D(tDepth, vUv + o * texel).r; }
        vec3 N(vec2 o){ return texture2D(tNormal, vUv + o * texel).rgb * 2.0 - 1.0; }
        void main(){
          vec4 col = texture2D(tColor, vUv);
          float d = D(vec2(0.0)); vec3 n = N(vec2(0.0));
          float de = 0.0, ne = 0.0;
          vec2 o[4]; o[0] = vec2(1.0, 0.0); o[1] = vec2(-1.0, 0.0); o[2] = vec2(0.0, 1.0); o[3] = vec2(0.0, -1.0);
          for (int i = 0; i < 4; i++) {
            float dd = D(o[i]);
            de += clamp((dd - d) * depthK, 0.0, 1.0);
            if (dd > d - 0.0004) ne += smoothstep(0.2, 0.5, 1.0 - dot(n, N(o[i])));
          }
          de = step(0.6, de); ne = step(0.6, ne) * (1.0 - de);
          vec3 c = col.rgb;
          c = mix(c, c * 0.42, de);
          c = mix(c, c * 1.28 + 0.012, ne * 0.7);
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`
    });
    postScene = new THREE.Scene(); postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));
  }

  // ---------- camera & resolution ----------
  const frustumH = () => 30 / cam.zoom;
  function desiredPixel() { // finer pixels when zoomed in, so details stay readable
    const base = QUALITY[quality].pixel;
    return Math.max(1, Math.min(6, Math.round(base * 1.4 / cam.zoom)));
  }
  function resize() {
    const r = host.getBoundingClientRect();
    pixel = desiredPixel();
    worldW = Math.max(64, Math.floor(r.width / pixel)); worldH = Math.max(48, Math.floor(r.height / pixel));
    renderer.setPixelRatio(1); renderer.setSize(worldW, worldH, false);
    rtColor.setSize(worldW, worldH); rtNormal.setSize(worldW, worldH); postMat.uniforms.texel.value.set(1 / worldW, 1 / worldH);
  }
  function updateCamera() {
    cam.yaw += (cam.yawGoal - cam.yaw) * 0.2;
    if (desiredPixel() !== pixel) resize();
    const fh = frustumH(), aspect = worldW / worldH;
    camera.left = -fh * aspect / 2; camera.right = fh * aspect / 2; camera.top = fh / 2; camera.bottom = -fh / 2; camera.updateProjectionMatrix();
    const dir = new THREE.Vector3(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch));
    camera.position.copy(cam.target).addScaledVector(dir, 120); camera.lookAt(cam.target); camera.updateMatrixWorld();
    const wpp = fh / worldH, right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const pr = camera.position.dot(right), pu = camera.position.dot(up);
    camera.position.addScaledVector(right, Math.round(pr / wpp) * wpp - pr).addScaledVector(up, Math.round(pu / wpp) * wpp - pu);
    camera.updateMatrixWorld();
    // shadows follow the view
    const ext = fh * 0.9;
    sun.shadow.camera.left = -ext; sun.shadow.camera.right = ext; sun.shadow.camera.top = ext; sun.shadow.camera.bottom = -ext; sun.shadow.camera.updateProjectionMatrix();
  }
  function clampTarget() { cam.target.x = Math.max(-38, Math.min(38, cam.target.x)); cam.target.z = Math.max(-38, Math.min(38, cam.target.z)); }
  function zoomBy(f) { cam.zoom = Math.max(0.45, Math.min(5, cam.zoom * f)); }
  function rotateView(dir) { cam.yawGoal += dir * Math.PI / 4; }
  function focusOn(x, z, zoom) { cam.target.set(x, 0, z); clampTarget(); if (zoom) cam.zoom = zoom; }

  function setQuality(q) {
    if (!QUALITY[q]) q = 'medium'; quality = q;
    const s = QUALITY[q].shadows;
    renderer.shadowMap.enabled = !!s; sun.castShadow = !!s;
    if (s) { sun.shadow.mapSize.set(s, s); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
    resize();
  }

  // ---------- placement ----------
  const ghostOk = new THREE.MeshLambertMaterial({ color: '#7dff7a', transparent: true, opacity: 0.55 });
  const ghostBad = new THREE.MeshLambertMaterial({ color: '#ff5a4a', transparent: true, opacity: 0.55 });
  function startPlacement(type, moveId) {
    cancelPlacement(true);
    const S = lastState, E = root.Engine, existing = moveId ? S.buildings.find(b => b.id === moveId) : null;
    placing = { type, moveId: moveId || null, rot: existing ? existing.rot : 0, x: 0, z: 0, ok: false };
    ghost = makeBuilding(type, existing ? existing.lvl : 1, false);
    ghost.traverse(o => { if (o.isMesh) { o.material = ghostOk; o.castShadow = false; } });
    scene.add(ghost);
    ghostPad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#7dff7a', transparent: true, opacity: 0.35 }));
    ghostPad.rotation.x = -Math.PI / 2; scene.add(ghostPad);
    // highlight where this building is allowed
    const def = BDEF[type], cells = [];
    S.regions.forEach(r => { if (!def.regions || def.regions.includes(r)) W.regionCells(r).forEach(c => { if (W.buildable(c[0], c[1])) cells.push(c); }); });
    allowOverlay = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.96, 0.96).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: def.regions ? 0.16 : 0.07 }), Math.max(1, cells.length));
    const m = new THREE.Matrix4(); cells.forEach(([x, z], i) => { m.makeTranslation(x + 0.5, 0.025, z + 0.5); allowOverlay.setMatrixAt(i, m); }); allowOverlay.count = cells.length; scene.add(allowOverlay);
    const spot = existing || E.findSpot(S, type, [Math.round(cam.target.x), Math.round(cam.target.z)]) || { x: Math.round(cam.target.x), z: Math.round(cam.target.z), rot: 0 };
    placing.x = spot.x; placing.z = spot.z; placing.rot = spot.rot || 0; updateGhost();
    if (!existing && spot) focusOn(spot.x, spot.z);
  }
  function updateGhost() {
    if (!placing) return;
    const S = lastState, E = root.Engine, { type, x, z, rot } = placing, [w, d] = E.footprint(type, rot);
    placing.ok = E.canPlace(S, type, x, z, rot, placing.moveId);
    ghost.position.set(x + w / 2, 0, z + d / 2); ghost.rotation.y = -rot * Math.PI / 2;
    ghost.traverse(o => { if (o.isMesh) o.material = placing.ok ? ghostOk : ghostBad; });
    ghostPad.scale.set(w, d, 1); ghostPad.position.set(x + w / 2, 0.04, z + d / 2); ghostPad.material.color.set(placing.ok ? '#7dff7a' : '#ff5a4a');
  }
  function cancelPlacement(silent) {
    if (!placing) return null;
    const p = placing; placing = null;
    [ghost, ghostPad, allowOverlay].forEach(o => o && scene.remove(o)); ghost = ghostPad = allowOverlay = null;
    if (!silent && opts.onCancelPlace) opts.onCancelPlace(p);
    return p;
  }
  function confirmPlacement() { if (!placing || !placing.ok) return false; const p = cancelPlacement(true); opts.onPlace(p, { x: p.x, z: p.z, rot: p.rot }); return true; }
  function rotatePlacement() { if (placing) { placing.rot = (placing.rot + 1) % 4; updateGhost(); } }

  // ---------- picking ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function setNdc(ev) { const r = cvs.getBoundingClientRect(); ndc.set((ev.clientX - r.left) / r.width * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); }
  function pick(ev) {
    setNdc(ev);
    const targets = [machine, ...specials.filter(s => s.visible), ...[...buildings.values()].map(e => e.obj), ...decoMeshes.filter(m => m.userData.click)];
    const hits = ray.intersectObjects(targets, true);
    for (const h of hits) {
      const o = h.object; if (!o.visible) continue;
      if (o.isInstancedMesh) {
        const it = o.userData.items[h.instanceId]; if (!it || !lastState.regions.includes(it.reg)) continue;
        const [x, z] = [it.x, it.z]; let hidden = false; lastState.buildings.forEach(b => { const [w, d] = root.Engine.footprint(b.type, b.rot); if (x >= b.x && x < b.x + w && z >= b.z && z < b.z + d) hidden = true; });
        if (hidden) continue;
        return { res: o.userData.click.res, deco: o.userData.kind, point: h.point };
      }
      if (o.userData.click) return Object.assign({ point: h.point }, o.userData.click);
    }
    return null;
  }
  function groundPoint(ev) { setNdc(ev); const p = new THREE.Vector3(); return ray.ray.intersectPlane(plane, p) ? p : null; }

  function bindInput() {
    let down = null; const pointers = new Map(); let pinch = 0, hoverT = 0;
    cvs.addEventListener('contextmenu', e => e.preventDefault());
    cvs.addEventListener('pointerdown', e => {
      cvs.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
      down = { x: e.clientX, y: e.clientY, btn: e.button, moved: false, lx: e.clientX, ly: e.clientY };
    });
    cvs.addEventListener('pointermove', e => {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) { const [a, b] = [...pointers.values()], dd = Math.hypot(a.x - b.x, a.y - b.y); if (pinch) zoomBy(dd / pinch); pinch = dd; if (down) down.moved = true; return; }
      if (placing) { const p = groundPoint(e); if (p) { const [w, d] = root.Engine.footprint(placing.type, placing.rot); const nx = Math.round(p.x - w / 2), nz = Math.round(p.z - d / 2); if (nx !== placing.x || nz !== placing.z) { placing.x = nx; placing.z = nz; updateGhost(); } } }
      if (!down) {
        const now = performance.now(); if (now - hoverT < 60) return; hoverT = now;
        hover = placing ? null : pick(e); cvs.style.cursor = placing ? 'crosshair' : hover ? 'pointer' : 'grab';
        if (opts.onHover) opts.onHover(hover, e.clientX, e.clientY);
        return;
      }
      const dx = e.clientX - down.lx, dy = e.clientY - down.ly; down.lx = e.clientX; down.ly = e.clientY;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) down.moved = true;
      if (!down.moved) return;
      if (opts.onHover) opts.onHover(null);
      if (down.btn === 2) { cam.yawGoal -= dx * 0.01; cam.yaw = cam.yawGoal; return; }
      if (placing && down.btn === 0) return;
      const wpp = frustumH() / host.getBoundingClientRect().height;
      const right = new THREE.Vector3(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)), fwd = new THREE.Vector3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw));
      cam.target.addScaledVector(right, -dx * wpp).addScaledVector(fwd, dy * wpp / Math.sin(cam.pitch)); clampTarget();
      cvs.style.cursor = 'grabbing';
    });
    const up = e => {
      pointers.delete(e.pointerId); if (pointers.size < 2) pinch = 0;
      if (!down) return; const d = down; down = null;
      if (d.moved) return;
      if (d.btn === 2) { if (placing) cancelPlacement(false); return; }
      if (placing) { confirmPlacement(); return; }
      const c = pick(e);
      if (!c) return opts.onSelect(null);
      if (c.special) return opts.onFind(c.special, e.clientX, e.clientY);
      if (c.building) return opts.onSelect(c.building, e.clientX, e.clientY);
      if (c.res) return opts.onGather(c.res, e.clientX, e.clientY);
    };
    cvs.addEventListener('pointerup', up); cvs.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); down = null; });
    cvs.addEventListener('pointerleave', () => opts.onHover && opts.onHover(null));
    cvs.addEventListener('wheel', e => { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
    window.addEventListener('keydown', e => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const k = e.key.toLowerCase(), step = 2 / cam.zoom;
      const right = new THREE.Vector3(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)), fwd = new THREE.Vector3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw));
      if (k === 'q') rotateView(-1); else if (k === 'e') rotateView(1);
      else if (k === 'r') rotatePlacement();
      else if (k === 'w' || k === 'arrowup') cam.target.addScaledVector(fwd, step); else if (k === 's' || k === 'arrowdown') cam.target.addScaledVector(fwd, -step);
      else if (k === 'a' || k === 'arrowleft') cam.target.addScaledVector(right, -step); else if (k === 'd' || k === 'arrowright') cam.target.addScaledVector(right, step);
      else if (k === '=' || k === '+') zoomBy(1.15); else if (k === '-') zoomBy(1 / 1.15);
      else return;
      clampTarget();
    });
  }

  // ---------- per frame ----------
  const _v = new THREE.Vector3();
  function project(v) { _v.copy(v).project(camera); const r = host.getBoundingClientRect(); return { x: (_v.x + 1) / 2 * r.width, y: (1 - _v.y) / 2 * r.height }; }
  function screenOf(what) {
    if (what === 'ideas') return project(machine.position.clone().setY(2.2));
    if (typeof what === 'number') { const e = buildings.get(what); return e && e.obj.visible ? project(e.obj.position.clone().setY(1.4)) : null; }
    if (Array.isArray(what)) return project(new THREE.Vector3(what[0] + 0.5, 0.8, what[1] + 0.5));
    return project(cam.target.clone().setY(0.5));
  }

  function update(S, t, dt, fx, selectedId) {
    lastState = S;
    const regSig = S.regions.join(',');
    if (regSig !== lastRegions) { lastRegions = regSig; paintRegions(S); critters.forEach(c => c.visible = S.regions.includes(c.userData.region)); lastBuildSig = ''; }
    syncBuildings(S);
    // day / night
    const phase = (t / DAY_S + 0.3) % 1, a = phase * Math.PI * 2, h = Math.sin(a), day = Math.max(0, Math.min(1, h * 1.6 + 0.35));
    const off = h > -0.05 ? new THREE.Vector3(Math.cos(a) * 30, Math.max(10, h * 45), 18) : new THREE.Vector3(-Math.cos(a) * 30, 34, 14);
    sun.target.position.copy(cam.target); sun.position.copy(cam.target).add(off);
    sun.intensity = h > -0.05 ? 0.45 + 2.3 * day : 0.5; sun.color.set(h > -0.05 ? (day < 0.5 ? '#ffb27a' : '#fff4e0') : '#8fa8ff');
    hemi.intensity = 0.4 + 0.85 * day;
    const sky = new THREE.Color('#121a3a').lerp(new THREE.Color('#8fd0ff'), day);
    if (day > 0.15 && day < 0.6) sky.lerp(new THREE.Color('#ffb48a'), 0.35 * (1 - Math.abs(day - 0.38) / 0.23));
    scene.background = sky; scene.fog.color.copy(sky);
    // machine parts
    const P = machine.userData.parts, fixed = id => !!S.research['fix_' + id];
    const vis = (k, v) => (P[k] || []).forEach(o => o.visible = v);
    vis('body', fixed('plates')); vis('broken', !fixed('plates')); vis('nav', fixed('nav')); vis('console', fixed('console')); vis('lens', fixed('lens'));
    vis('coolant', fixed('coolant')); vis('cable', fixed('cable')); vis('chronometer', fixed('chronometer')); vis('frame', fixed('struts')); vis('woodLegs', !fixed('struts'));
    vis('battery', fixed('battery')); vis('gearbox', fixed('gearbox')); vis('ring', !fixed('gearbox')); vis('core', fixed('core'));
    const nFix = Object.keys(S.research).filter(k => k.startsWith('fix_')).length, lamp = P.lamp[0];
    lamp.material = mat(nFix >= 11 ? '#6fff8a' : '#ff4a4a', glow(nFix >= 11 ? '#6fff8a' : '#ff4a4a', Math.floor(t * (1 + nFix / 2)) % 2 ? 1.8 : 0.1));
    machine.scale.setScalar(1 + Math.sin((fx.ideas || 0) * 40) * (fx.ideas || 0) * 0.15);
    // specials
    const search = root.Engine.multipliers(S).search;
    specials.forEach(g => {
      const sp = g.userData.sp, on = specialActive(S, sp); g.visible = on; if (!on) return;
      const spark = g.children.find(c => c.userData.spark);
      const show = sp.type === 'part' || search >= 1 || cam.zoom >= 1.8;
      spark.visible = show && Math.sin(t * 3 + sp.idx) > -0.3; spark.rotation.y += dt * 3; spark.position.y = 1.1 + Math.sin(t * 2 + sp.idx) * 0.12;
      spark.scale.setScalar(search >= 1 ? 1.6 : 1);
    });
    // animated bits
    if (animDirty) { animated.length = 0; scene.traverse(o => { const u = o.userData; if (u.flame || u.spin || u.spinX || u.crystal) animated.push(o); if (o.isMesh && o.material && o.material.transparent) clear.add(o); }); animDirty = false; }
    animated.forEach(o => {
      const u = o.userData;
      if (u.flame) { const s = 0.8 + Math.sin(t * 12 + u.flame * 2) * 0.25; o.scale.set(1, s, 1); }
      if (u.spin) o.rotation.y += dt * u.spin;
      if (u.spinX) o.rotation.x += dt * u.spinX;
      if (u.crystal) o.rotation.y += dt;
    });
    // lights pool
    const lights = [];
    for (const [, e] of buildings) { const L = e.obj.userData.light; if (e.obj.visible && L && lights.length < 6) { const p = e.obj.localToWorld(new THREE.Vector3(...L)); if (Math.abs(p.x - cam.target.x) < 25 && Math.abs(p.z - cam.target.z) < 25) lights.push([p, e.obj.userData.lightColor || '#ff8a3a']); } }
    if (S.research.fix_core) lights.push([machine.position.clone().setY(2.2), '#c77dff']);
    pointLights.forEach((pl, i) => { const L = lights[i]; if (!L) { pl.intensity = 0; return; } pl.position.copy(L[0]); pl.color.set(L[1]); pl.intensity = (3 + 9 * (1 - day)) * (0.9 + Math.sin(t * 9 + i) * 0.1); });
    // villagers walk between buildings near them
    const spots = S.buildings.map(b => [b.x + 1, b.z + 1]); spots.push([W.MACHINE.x + 1, W.MACHINE.z + 4]);
    const pop = Math.min(villagers.length, Math.ceil(S.buildings.length * 0.6));
    villagers.forEach((v, i) => {
      v.visible = i < pop; if (!v.visible) return;
      const u = v.userData;
      if (!u.target || v.position.distanceTo(u.target) < 0.3) {
        if ((u.wait -= dt) > 0) { u.legs.forEach(l => l.rotation.x = 0); return; }
        const s = spots[(i * 7 + Math.floor(t / 20 + i)) % spots.length]; u.target = new THREE.Vector3(s[0] + (hash(i, t | 0) - .5) * 3, 0, s[1] + 1.2 + (hash(t | 0, i) - .5) * 2);
        if (!u.placed) { v.position.copy(u.target); u.placed = true; }
        u.wait = 1 + hash(i, 3) * 3;
      }
      const dir = u.target.clone().sub(v.position); dir.y = 0; const d = dir.length(); if (d > 15) { v.position.copy(u.target); return; }
      dir.normalize(); v.position.addScaledVector(dir, Math.min(d, u.speed * dt)); v.rotation.y = Math.atan2(dir.x, dir.z);
      const sw = Math.sin(t * 10 * u.speed) * 0.6; u.legs[0].rotation.x = sw; u.legs[1].rotation.x = -sw;
    });
    critters.forEach((c, i) => {
      if (!c.visible) return; const u = c.userData;
      if (!u.target || c.position.distanceTo(u.target) < 0.3) { if ((u.wait -= dt) > 0) return; const cell = u.cells[Math.floor(hash(i, t | 0) * u.cells.length)]; if (cell) u.target = new THREE.Vector3(cell[0] + 0.5, 0, cell[1] + 0.5); u.wait = 3 + hash(t | 0, i) * 6; return; }
      const dir = u.target.clone().sub(c.position); dir.y = 0; const d = dir.length(); if (d > 12) { u.target = null; return; }
      dir.normalize(); c.position.addScaledVector(dir, Math.min(d, u.speed * dt)); c.rotation.y = Math.atan2(dir.x, dir.z) - Math.PI / 2;
      (u.legs || []).forEach((l, k) => l.rotation.z = Math.sin(t * 6 + k * 1.6) * 0.3);
    });
    traveler.rotation.y = Math.sin(t * 0.5) * 0.4;
    // smoke: volcano, geysers, chimneys
    const chimneys = []; for (const [, e] of buildings) if (e.obj.visible && e.obj.userData.smoke) chimneys.push(e.obj.localToWorld(new THREE.Vector3(...e.obj.userData.smoke)));
    smoke.forEach((s, i) => {
      const p = (s.userData.p + t * 0.06) % 1;
      if (i < 16) { s.position.set(14 + Math.sin(i * 3 + t * 0.3) * 1.5 + p * 3, 8 + p * 9, -47 + Math.cos(i) * 1.5); s.scale.setScalar(0.8 + p * 2.4); s.material.opacity = 0.55 * (1 - p); s.visible = true; }
      else { const src = chimneys[(i - 16) % Math.max(1, chimneys.length)]; if (!src) { s.visible = false; return; } s.position.set(src.x + p * 0.5, src.y + p * 2.5, src.z + Math.sin(i + t) * 0.2); s.scale.setScalar(0.15 + p * 0.6); s.material.opacity = 0.5 * (1 - p); s.visible = true; }
    });
    sea.position.y = -0.3 + Math.sin(t * 0.7) * 0.03; river.position.y = Math.sin(t * 1.3) * 0.015;
    if (fogClouds) fogClouds.position.y = Math.sin(t * 0.4) * 0.15;
    // selection / hover pads
    const pad = (padMesh, id) => {
      const b = id != null && S.buildings.find(x => x.id === id), e = b && buildings.get(b.id);
      if (!e || !e.obj.visible) { padMesh.visible = false; return; }
      const [w, d] = root.Engine.footprint(b.type, b.rot); padMesh.visible = true; padMesh.scale.set(w + 0.3, d + 0.3, 1); padMesh.position.copy(e.obj.position).setY(0.03);
    };
    pad(selPad, selectedId); selPad.material.opacity = 0.35 + Math.sin(t * 5) * 0.15;
    pad(hoverPad, hover && hover.building !== selectedId ? hover.building : null);
    // render: colour+depth, normals, then the pixel/outline pass
    updateCamera();
    renderer.setRenderTarget(rtColor); renderer.render(scene, camera);
    const fogWas = scene.fog, bgWas = scene.background; scene.fog = null; scene.background = null; scene.overrideMaterial = normalMat;
    const hidden = []; clear.forEach(o => { if (!o.parent) { clear.delete(o); return; } if (o.visible) { hidden.push(o); o.visible = false; } });
    if (fogClouds && fogClouds.visible) { hidden.push(fogClouds); fogClouds.visible = false; }
    [ghost, ghostPad, allowOverlay].forEach(o => { if (o && o.visible) { hidden.push(o); o.visible = false; } });
    renderer.setRenderTarget(rtNormal); renderer.setClearColor(0x8080ff, 1); renderer.clear(); renderer.render(scene, camera);
    hidden.forEach(o => o.visible = true); scene.overrideMaterial = null; scene.fog = fogWas; scene.background = bgWas;
    renderer.setRenderTarget(null); renderer.render(postScene, postCam);
  }

  function init(o) {
    opts = o; host = o.container; quality = o.quality || 'medium';
    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.shadowMap.type = THREE.PCFShadowMap;
    cvs = renderer.domElement; cvs.id = 'scene3d'; host.prepend(cvs);
    scene = new THREE.Scene(); scene.fog = new THREE.Fog('#8fd0ff', 140, 260);
    camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 1, 400);
    hemi = new THREE.HemisphereLight('#dff2ff', '#5a4a30', 1); scene.add(hemi);
    sun = new THREE.DirectionalLight('#fff4e0', 2.5); sun.shadow.camera.near = 1; sun.shadow.camera.far = 160; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; scene.add(sun, sun.target);
    for (let i = 0; i < 6; i++) { const pl = new THREE.PointLight('#ff8a3a', 0, 7, 1.6); scene.add(pl); pointLights.push(pl); }
    setupPost(); buildTerrain(); buildNature(); buildSpecials(); buildMachine();
    selPad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#f2d14b', transparent: true, opacity: 0.4 })); selPad.rotation.x = -Math.PI / 2; selPad.visible = false; scene.add(selPad);
    hoverPad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.25 })); hoverPad.rotation.x = -Math.PI / 2; hoverPad.visible = false; scene.add(hoverPad);
    for (let i = 0; i < 60; i++) villagers.push(makeVillager(i));
    [['mammoth', 'tundra', 4], ['mammoth', 'meadow', 1], ['turtle', 'beach', 4], ['frog', 'swamp', 5], ['dino', 'plateau', 2]].forEach(([k, r, n]) => { for (let i = 0; i < n; i++) makeCritter(k, r, i + r.length); });
    for (let i = 0; i < 40; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: '#d8d8de', transparent: true, opacity: 0.6 })); s.userData.p = (i % 16) / 16; s.castShadow = false; smoke.push(s); scene.add(s); }
    const volcano = new THREE.Group(); volcano.add(cone(8, 9, 10, '#5a4044')); volcano.add(cone(2.6, 1, 10, '#ff6a2a', 0, 8.3, 0, glow('#ff6a2a', 1.6)));
    volcano.position.set(14, -1, -47); volcano.children.forEach(m => { m.castShadow = true; }); scene.add(volcano);
    bindInput(); setQuality(quality);
    new ResizeObserver(resize).observe(host);
  }

  root.Scene3D = { init, update, startPlacement, cancelPlacement, rotatePlacement, isPlacing: () => placing, setQuality, rotateView, zoomBy, focusOn, screenOf,
    getView: () => ({ x: cam.target.x, z: cam.target.z, zoom: cam.zoom }) };
})(window);
