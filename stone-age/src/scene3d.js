// 3D world in "pixel 3D" style: low-poly scene rendered at low resolution, upscaled with hard pixels,
// with depth outlines and normal highlights. Top-down orthographic camera that can pan, zoom and rotate.
// Players place and move buildings on a grid.
'use strict';
(function (root) {
  const THREE = root.THREE;
  const CELL_MIN = -8, CELL_MAX = 7;          // buildable cells (inclusive)
  const DAY_S = 240;
  // footprint in cells [w, d] before rotation
  const FOOT = { forager: [1, 1], woodcutter: [2, 1], quarry: [2, 2], firepit: [1, 1], hunter: [2, 2], hut: [2, 2], farm: [3, 3],
    copperMine: [2, 2], school: [2, 2], ironMine: [2, 2], workshop: [2, 2], waterwheel: [2, 2], observatory: [2, 2], crater: [3, 3] };
  const MACHINE_CELLS = { x: 3, z: -1, w: 3, d: 3 };
  const QUALITY = {
    low: { pixel: 4, shadows: 0, outline: 1 },
    medium: { pixel: 3, shadows: 1024, outline: 1 },
    high: { pixel: 2, shadows: 2048, outline: 1 }
  };
  const tierOf = n => n >= 100 ? 5 : n >= 50 ? 4 : n >= 25 ? 3 : n >= 10 ? 2 : 1;
  const footOf = (id, rot) => { const [w, d] = FOOT[id]; return rot % 2 ? [d, w] : [w, d]; };

  // ---------- small helpers ----------
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
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, colorWrite: false, depthWrite: false });
  function hitBox(w, h, d, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), hitMat); m.position.set(x, y, z); return m; }
  const glow = (c, i) => ({ emissive: c, emissiveIntensity: i == null ? 1 : i });
  function rand(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  const R = rand(7);

  // ---------- building models (origin = footprint centre, y = ground) ----------
  const C = { wood: '#8a5a32', woodL: '#a8703c', woodD: '#5e3b1f', thatch: '#c9a25a', hide: '#c08a52', stone: '#8d939a', stoneL: '#aab0b6',
    stoneD: '#61666c', berry: '#d8283f', leaf: '#3f8f3c', leafD: '#2f6f30', soil: '#6b4a2a', wheat: '#e6c44a', copper: '#d9814a', iron: '#6f7c8f',
    clay: '#c9a070', water: '#3a9ad9', purple: '#b76cff', gold: '#c9b37a', skin: '#e0b48a', fire: '#ff7a2a', flame: '#ffd04a' };
  const MODELS = {
    forager(g, t) {
      const basket = (x, z) => { g.add(cyl(0.28, 0.2, 0.3, 7, C.woodL, x, 0, z)); for (let i = 0; i < 5; i++) g.add(ball(0.07, C.berry, x + (R() - .5) * .3, 0.33, z + (R() - .5) * .3)); };
      basket(-0.1, 0.05); if (t >= 2) basket(0.25, -0.25);
      if (t >= 3) { g.add(box(0.06, 0.6, 0.06, C.woodD, -0.38, 0, -0.38)); g.add(box(0.06, 0.6, 0.06, C.woodD, 0.38, 0, -0.38)); g.add(box(0.8, 0.05, 0.08, C.woodD, 0, 0.58, -0.38)); g.add(ball(0.1, C.leaf, -0.15, 0.48, -0.38)); g.add(ball(0.1, C.leaf, 0.15, 0.48, -0.38)); }
      if (t >= 4) g.add(ball(0.22, C.leafD, 0.3, 0.18, 0.3, 0));
    },
    woodcutter(g, t) {
      const logs = 3 + t * 2;
      for (let i = 0; i < logs; i++) { const row = Math.floor(i / 4), k = i % 4; const l = cyl(0.12, 0.12, 1.1, 7, k % 2 ? C.wood : C.woodL, -0.35, 0.12 + row * 0.22 - 0.55, -0.35 + k * 0.24); l.rotation.z = Math.PI / 2; l.position.y = 0.12 + row * 0.22; g.add(l); }
      g.add(cyl(0.2, 0.24, 0.3, 8, C.woodD, 0.6, 0, 0.1));
      const axe = box(0.05, 0.5, 0.05, C.woodL, 0.6, 0.3, 0.1); axe.rotation.z = 0.4; g.add(axe); g.add(box(0.18, 0.1, 0.05, C.stoneL, 0.7, 0.7, 0.1));
    },
    quarry(g, t) {
      const n = 3 + t * 2;
      for (let i = 0; i < n; i++) { const b = box(0.4 + R() * 0.2, 0.3, 0.4, i % 2 ? C.stone : C.stoneL, -0.5 + (i % 3) * 0.5, Math.floor(i / 3) * 0.3, -0.4 + ((i * 7) % 3) * 0.4); b.rotation.y = R() * 0.4; g.add(b); }
      g.add(ball(0.45, C.stoneD, 0.5, 0.25, 0.5, 0));
    },
    firepit(g, t) {
      for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; g.add(ball(0.09, C.stone, Math.cos(a) * 0.3, 0.06, Math.sin(a) * 0.3)); }
      const f1 = cone(0.18, 0.45, 6, C.fire, 0, 0, 0, glow(C.fire, 1.2)), f2 = cone(0.1, 0.3, 5, C.flame, 0, 0.05, 0, glow(C.flame, 1.5));
      f1.castShadow = f2.castShadow = false; f1.userData.flame = 1; f2.userData.flame = 2; g.add(f1, f2);
      g.userData.light = [0, 0.5, 0];
      if (t >= 2) { const s = cyl(0.12, 0.12, 0.7, 6, C.wood, 0, 0.12, 0.42); s.rotation.z = Math.PI / 2; s.position.y = 0.12; g.add(s); }
      if (t >= 3) { const s = cyl(0.12, 0.12, 0.7, 6, C.wood, 0, 0.12, -0.42); s.rotation.z = Math.PI / 2; s.position.y = 0.12; g.add(s); }
    },
    hunter(g, t) {
      const tent = (x, z, s) => { g.add(cone(0.5 * s, 1.1 * s, 6, C.hide, x, 0, z)); g.add(box(0.2 * s, 0.35 * s, 0.05, C.woodD, x, 0, z + 0.43 * s)); };
      tent(-0.3, -0.2, 1); if (t >= 2) tent(0.5, 0.45, 0.7); if (t >= 4) tent(-0.55, 0.6, 0.6);
      for (let i = 0; i < 3; i++) { const sp = cyl(0.02, 0.02, 1.2, 4, C.woodL, 0.55 + i * 0.12, 0, -0.55); sp.rotation.x = 0.15; g.add(sp); g.add(cone(0.04, 0.12, 4, C.stoneL, 0.55 + i * 0.12, 1.18, -0.47)); }
      if (t >= 3) g.add(box(0.6, 0.4, 0.04, C.hide, 0.4, 0.1, -0.2));
    },
    hut(g, t) {
      const hut = (x, z, s) => { g.add(cyl(0.45 * s, 0.5 * s, 0.5 * s, 8, C.clay, x, 0, z)); g.add(cone(0.65 * s, 0.6 * s, 8, C.thatch, x, 0.45 * s, z)); g.add(box(0.2 * s, 0.32 * s, 0.05, C.woodD, x, 0, z + 0.47 * s)); };
      if (t === 1) hut(0, 0, 1.3);
      else { hut(-0.35, -0.35, 0.9); hut(0.5, 0.45, 0.7); if (t >= 3) hut(0.5, -0.45, 0.6); if (t >= 4) hut(-0.5, 0.55, 0.6); }
    },
    farm(g, t) {
      g.add(box(2.8, 0.08, 2.8, C.soil, 0, 0, 0));
      const h = 0.25 + t * 0.07, col = t >= 3 ? C.wheat : '#9bc34a';
      for (let i = 0; i < 6; i++) g.add(box(0.18, h, 2.5, col, -1.1 + i * 0.44, 0.08, 0));
      if (t >= 3) { g.add(box(0.06, 0.9, 0.06, C.woodD, 1.15, 0, 1.15)); g.add(box(0.5, 0.06, 0.06, C.woodD, 1.15, 0.65, 1.15)); g.add(ball(0.1, C.wheat, 1.15, 0.95, 1.15)); }
      if (t >= 5) g.add(box(2.9, 0.12, 0.08, C.woodL, 0, 0, -1.42));
    },
    copperMine(g, t) {
      g.add(ball(0.95, '#7a6450', 0, 0.2, -0.1, 0)); g.add(box(0.5, 0.6, 0.3, '#1a1410', 0, 0, 0.62));
      g.add(box(0.08, 0.7, 0.08, C.wood, -0.3, 0, 0.75)); g.add(box(0.08, 0.7, 0.08, C.wood, 0.3, 0, 0.75)); g.add(box(0.7, 0.08, 0.1, C.wood, 0, 0.66, 0.75));
      for (let i = 0; i < 3 + t; i++) g.add(box(0.14, 0.14, 0.14, C.copper, -0.7 + R() * 1.4, 0.05 + R() * 0.6, -0.5 + R() * 0.6, glow(C.copper, 0.15)));
      if (t >= 3) { g.add(box(0.4, 0.25, 0.3, C.woodD, 0.65, 0.05, 0.55)); g.add(box(0.3, 0.1, 0.2, C.copper, 0.65, 0.3, 0.55)); }
    },
    school(g, t) {
      g.add(box(1.5, 0.8, 1.2, C.clay, 0, 0, 0)); g.add(box(1.7, 0.1, 1.4, C.woodD, 0, 0.8, 0)); g.add(box(0.3, 0.5, 0.05, C.woodD, 0, 0, 0.62));
      g.add(box(0.25, 0.32, 0.05, '#e6d2a8', -0.45, 0.25, 0.62)); g.add(box(0.25, 0.32, 0.05, '#e6d2a8', 0.45, 0.25, 0.62));
      if (t >= 3) { g.add(box(1.0, 0.55, 0.8, C.clay, 0, 0.9, -0.1)); g.add(box(1.2, 0.08, 1.0, C.woodD, 0, 1.45, -0.1)); }
    },
    ironMine(g, t) {
      g.add(ball(0.95, '#4f5560', 0, 0.2, -0.1, 0)); g.add(box(0.5, 0.6, 0.3, '#0c0c10', 0, 0, 0.62));
      g.add(box(0.7, 0.08, 0.1, C.iron, 0, 0.66, 0.75)); g.add(box(0.08, 0.7, 0.08, C.iron, -0.3, 0, 0.75)); g.add(box(0.08, 0.7, 0.08, C.iron, 0.3, 0, 0.75));
      g.add(box(0.05, 0.03, 1, C.iron, -0.12, 0, 1)); g.add(box(0.05, 0.03, 1, C.iron, 0.12, 0, 1)); g.add(box(0.35, 0.25, 0.4, C.iron, 0, 0.04, 1.1));
      if (t >= 3) { g.add(cyl(0.2, 0.25, 1.4, 6, C.stoneD, 0.75, 0, -0.6)); g.userData.smoke = [0.75, 1.5, -0.6]; }
    },
    workshop(g, t) {
      g.add(box(1.5, 0.75, 1.3, C.wood, 0, 0, 0));
      const roof = cyl(0.8, 0.8, 1.5, 3, C.woodD, 0, 0, 0); roof.rotation.z = Math.PI / 2; roof.rotation.x = Math.PI / 6; roof.position.y = 0.95; roof.scale.set(1, 1, 0.9); g.add(roof);
      g.add(box(0.35, 0.5, 0.05, '#2a1a10', 0, 0, 0.66));
      const gear = new THREE.Group(); gear.add(cyl(0.3, 0.3, 0.08, 10, C.gold, 0, -0.04, 0)); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; gear.add(box(0.1, 0.08, 0.1, C.gold, Math.cos(a) * 0.34, -0.04, Math.sin(a) * 0.34)); }
      gear.rotation.x = Math.PI / 2; gear.position.set(0.5, 0.75, 0.7); gear.userData.spin = 1.5; g.add(gear);
      if (t >= 3) g.add(box(0.5, 0.4, 0.5, C.iron, -0.95, 0, 0.3));
    },
    waterwheel(g, t) {
      g.add(box(1.9, 0.06, 0.9, C.water, 0, 0, 0.45, { transparent: true, opacity: 0.85 }));
      g.add(box(0.1, 1.1, 0.1, C.woodD, -0.3, 0, -0.4)); g.add(box(0.1, 1.1, 0.1, C.woodD, 0.3, 0, -0.4));
      const wheel = new THREE.Group();
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.06, 4, 12), mat(C.wood)); rim.castShadow = true; wheel.add(rim);
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const p = box(0.08, 0.32, 0.4, C.woodL, Math.cos(a) * 0.75, Math.sin(a) * 0.75 - 0.16, 0); p.rotation.z = a; wheel.add(p); }
      wheel.rotation.y = Math.PI / 2; wheel.position.set(0, 0.8, 0.1); wheel.userData.spinX = -1; g.add(wheel);
      if (t >= 3) g.add(box(0.4, 0.4, 0.4, C.clay, 0.7, 0, -0.5));
    },
    observatory(g, t) {
      g.add(cyl(0.6, 0.7, 1.6, 8, C.stone, 0, 0, 0));
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.62, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat(C.stoneL)); dome.position.y = 1.6; dome.castShadow = true; g.add(dome);
      const tel = cyl(0.08, 0.12, 0.9, 6, C.gold, 0.25, 1.8, 0); tel.rotation.z = -0.7; g.add(tel);
      g.add(box(0.3, 0.45, 0.05, '#2a2f3a', 0, 0, 0.66));
    },
    crater(g, t) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.3, 4, 10), mat('#3f2f48')); ring.rotation.x = Math.PI / 2; ring.position.y = 0.05; ring.castShadow = ring.receiveShadow = true; g.add(ring);
      g.add(cyl(1.0, 1.0, 0.04, 10, '#26182e', 0, 0, 0));
      for (let i = 0; i < 2 + t; i++) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.18 + R() * 0.12, 0), mat(C.purple, glow(C.purple, 0.9))); c.position.set((R() - .5) * 1.2, 0.2, (R() - .5) * 1.2); c.rotation.set(R(), R(), R()); c.userData.crystal = true; g.add(c); }
      g.userData.light = [0, 0.6, 0]; g.userData.lightColor = '#c77dff';
    }
  };

  // ---------- module state ----------
  let renderer, scene, camera, cvs, box3, opts, quality = 'medium';
  let rtColor, rtNormal, postScene, postCam, postMat, normalMat;
  let sun, hemi, ground, water, worldW = 1, worldH = 1;
  const clickables = [], buildings = {}, labels = {}, villagers = [], mammoths = [], smoke = [], pointLights = [];
  let machine, traveler, gridHelper, ghost = null, ghostPad = null, selPad = null, placing = null;
  const cam = { target: new THREE.Vector3(-1, 0, 2), yaw: Math.PI / 4, pitch: 0.95, zoom: 1.6, yawGoal: Math.PI / 4 };
  let lastState = null;

  function heightAt(x, z) {
    const ax = Math.abs(x), az = Math.abs(z);
    const edge = Math.max(ax, az);
    if (edge <= 9.5) return 0;
    if (z < -10.5 && z > -14.5 && ax < 30) return -0.9;          // river along the north
    const k = Math.min(1, (edge - 9.5) / 10);
    const n = Math.sin(x * 0.45) * Math.cos(z * 0.38) + Math.sin((x + z) * 0.21);
    return k * k * (2.5 + n * 1.6) + (z < -15 ? k * 2 : 0);
  }

  function buildTerrain() {
    const size = 72, seg = 72;
    let geo = new THREE.PlaneGeometry(size, size, seg, seg); geo.rotateX(-Math.PI / 2); geo = geo.toNonIndexed();
    const pos = geo.attributes.position, colors = [];
    for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
    const rnd = rand(11), c = new THREE.Color();
    for (let i = 0; i < pos.count; i += 3) {
      const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
      const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3, cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
      const inBuild = cx > -8 && cx < 8 && cz > -8 && cz < 8;
      if (y < -0.4) c.set('#7a6a48'); else if (y < -0.05) c.set('#d8c28a'); else if (y < 1.6) c.set(inBuild ? '#6fb04a' : '#5f9e40'); else if (y < 3.2) c.set('#4c7f36'); else c.set('#8a8478');
      c.offsetHSL(0, 0, (rnd() - 0.5) * 0.04);
      for (let k = 0; k < 3; k++) colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geo.computeVertexNormals();
    ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    ground.receiveShadow = true; ground.userData.ground = true; scene.add(ground);
    water = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshLambertMaterial({ color: '#3a9ad9', transparent: true, opacity: 0.8 }));
    water.rotation.x = -Math.PI / 2; water.position.y = -0.35; water.receiveShadow = true; scene.add(water);
    // dirt square showing the buildable area
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.MeshLambertMaterial({ color: '#7cba52', transparent: true, opacity: 0.25 }));
    pad.rotation.x = -Math.PI / 2; pad.position.set(0, 0.01, 0); pad.receiveShadow = true; scene.add(pad);
  }

  function tag(obj, click) { obj.traverse(o => { o.userData.click = click; }); clickables.push(obj); return obj; }

  function buildNature() {
    const rnd = rand(5);
    const pine = (x, z, s) => { const g = new THREE.Group(); g.add(cyl(0.12 * s, 0.16 * s, 0.6 * s, 5, C.woodD)); g.add(cone(0.7 * s, 1.2 * s, 6, C.leafD, 0, 0.45 * s)); g.add(cone(0.5 * s, 1.0 * s, 6, C.leaf, 0, 1.05 * s)); g.position.set(x, heightAt(x, z), z); g.userData.sway = rnd() * 6; return g; };
    const oak = (x, z, s) => { const g = new THREE.Group(); g.add(cyl(0.14 * s, 0.18 * s, 0.8 * s, 5, C.wood)); g.add(ball(0.7 * s, C.leaf, 0, 1.2 * s, 0, 0)); g.add(ball(0.45 * s, '#4fa64a', 0.3 * s, 1.5 * s, 0.2 * s, 0)); g.position.set(x, heightAt(x, z), z); g.userData.sway = rnd() * 6; return g; };
    // forest on the west: clickable for wood
    const forest = new THREE.Group();
    for (let i = 0; i < 24; i++) { const x = -9.8 - rnd() * 5, z = -8.5 + rnd() * 17; forest.add((i % 3 ? pine : oak)(x, z, 0.9 + rnd() * 0.5)); }
    forest.add(hitBox(6, 3, 18, -12.3, 1.5, 0));
    scene.add(tag(forest, { res: 'wood' }));
    // decorative trees around the rim
    for (let i = 0; i < 70; i++) {
      const a = rnd() * Math.PI * 2, d = 11.5 + rnd() * 20, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (x < -9 && Math.abs(z) < 9.5) continue; if (z < -10 && z > -15.5) continue; if (z > 8.5 && z < 11.5 && x > -10 && x < 4) continue; if (Math.abs(x) > 34 || Math.abs(z) > 34) continue;
      scene.add((i % 2 ? pine : oak)(x, z, 0.8 + rnd() * 0.7));
    }
    // rocks (stone) south-west
    const rocks = new THREE.Group();
    [[-7, 9.6, .7], [-5.6, 10.2, .5], [-8.3, 10.6, .55], [-6.4, 11.1, .4], [-4.6, 9.5, .35]].forEach(([x, z, s]) => {
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), mat(rnd() > .5 ? C.stone : C.stoneL)); r.position.set(x, s * 0.6, z); r.rotation.set(rnd(), rnd(), rnd()); r.castShadow = r.receiveShadow = true; rocks.add(r);
    });
    rocks.add(hitBox(5, 1.6, 2.8, -6.4, 0.8, 10.2));
    scene.add(tag(rocks, { res: 'stone' }));
    // berry bushes (food) south
    const bushes = new THREE.Group();
    [[-2, 9.5], [-0.6, 10.3], [0.8, 9.6], [2.2, 10.4]].forEach(([x, z]) => {
      const b = new THREE.Group(); b.add(ball(0.55, C.leaf, 0, 0.45, 0, 0)); b.add(ball(0.35, '#4fa64a', 0.25, 0.7, 0.1, 0));
      for (let i = 0; i < 6; i++) b.add(ball(0.08, C.berry, (rnd() - .5) * .9, 0.35 + rnd() * .5, (rnd() - .5) * .9 + 0.25));
      b.position.set(x, 0, z); bushes.add(b);
    });
    bushes.add(hitBox(5.6, 1.6, 2.4, 0.1, 0.8, 10));
    scene.add(tag(bushes, { res: 'food' }));
    // volcano in the distance
    const v = new THREE.Group();
    v.add(cone(9, 11, 9, '#5a4044')); v.add(cone(3.2, 1.2, 9, '#ff6a2a', 0, 10.2, 0, glow('#ff6a2a', 1.5)));
    v.position.set(18, heightAt(18, -24) - 0.5, -24); scene.add(v);
    v.children.forEach(m => m.castShadow = false);
    for (let i = 0; i < 24; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: '#cfcfd6', transparent: true, opacity: 0.6 })); s.userData.p = i / 24; s.userData.src = i < 14 ? 'volcano' : null; s.castShadow = false; smoke.push(s); scene.add(s); }
  }

  function buildMachine() {
    machine = new THREE.Group();
    const cx = MACHINE_CELLS.x + MACHINE_CELLS.w / 2, cz = MACHINE_CELLS.z + MACHINE_CELLS.d / 2;
    machine.position.set(cx, 0, cz);
    const parts = machine.userData.parts = {};
    const P = (name, obj) => { (parts[name] = parts[name] || []).push(obj); machine.add(obj); return obj; };
    P('woodLegs', cyl(0.08, 0.08, 0.7, 5, C.wood, -0.6, 0, 0.3)); P('woodLegs', cyl(0.08, 0.08, 0.5, 5, C.wood, 0.6, 0, -0.2));
    P('frame', cyl(0.07, 0.1, 0.7, 6, C.iron, -0.6, 0, 0.35)); P('frame', cyl(0.07, 0.1, 0.7, 6, C.iron, 0.6, 0, 0.35)); P('frame', cyl(0.07, 0.1, 0.7, 6, C.iron, 0, 0, -0.65));
    const body = P('body', new THREE.Mesh(new THREE.CapsuleGeometry(0.85, 0.9, 4, 10), mat('#c9d0d8'))); body.position.y = 1.55; body.castShadow = body.receiveShadow = true;
    const bodyBroken = P('broken', new THREE.Mesh(new THREE.CapsuleGeometry(0.86, 0.9, 4, 10), mat('#7c838a'))); bodyBroken.position.y = 1.55; bodyBroken.castShadow = true;
    [[0.5, 1.9, 0.6], [-0.4, 1.3, 0.7], [0.2, 2.3, -0.7]].forEach(([x, y, z]) => P('broken', box(0.28, 0.22, 0.1, '#20242c', x, y, z)));
    const ring = P('ring', new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.09, 5, 16), mat('#6d7278'))); ring.rotation.x = Math.PI / 2; ring.position.y = 1.35; ring.castShadow = true;
    const ringGold = P('gearbox', new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.1, 5, 16), mat(C.gold))); ringGold.rotation.x = Math.PI / 2; ringGold.position.y = 1.35;
    P('port', cyl(0.36, 0.36, 0.08, 10, '#2a2f3a', 0, 0, 0)).position.set(0, 2.1, 0.8); parts.port[0].rotation.x = Math.PI / 2;
    const core = P('core', ball(0.26, C.purple, 0, 2.1, 0.83, 1, glow(C.purple, 1.6)));
    P('wiring', box(0.05, 0.9, 0.05, C.copper, -0.8, 0.9, 0.3, glow(C.copper, 0.2))); P('wiring', box(0.05, 0.7, 0.05, C.copper, 0.82, 1.0, -0.2, glow(C.copper, 0.2)));
    const gear = new THREE.Group(); gear.add(cyl(0.25, 0.25, 0.08, 10, C.gold)); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; gear.add(box(0.08, 0.08, 0.08, C.gold, Math.cos(a) * 0.29, 0, Math.sin(a) * 0.29)); }
    gear.rotation.z = Math.PI / 2; gear.position.set(0.95, 1.6, 0.2); gear.userData.spin = 2; P('gearbox', gear);
    P('battery', box(0.5, 0.35, 0.3, '#1a3d66', 0, 0.55, 0.75)); P('battery', box(0.38, 0.12, 0.05, '#6fd3ff', 0, 0.7, 0.92, glow('#6fd3ff', 1.5)));
    P('antenna', cyl(0.03, 0.03, 0.6, 4, C.iron, 0, 2.75, 0));
    const lamp = P('lamp', ball(0.1, '#ff4a4a', 0, 3.4, 0, 0, glow('#ff4a4a', 1.5))); lamp.userData.lamp = true;
    machine.add(hitBox(2.6, 3.6, 2.6, 0, 1.8, 0));
    scene.add(tag(machine, { res: 'ideas' }));
    // the traveller
    traveler = new THREE.Group();
    traveler.add(cyl(0.16, 0.18, 0.45, 6, '#2a8a9a', 0, 0.25)); traveler.add(ball(0.15, C.skin, 0, 0.85, 0, 1)); traveler.add(box(0.3, 0.06, 0.06, '#ffd84a', 0, 0.92, 0.1));
    traveler.add(cyl(0.05, 0.05, 0.25, 4, '#1f5a66', -0.08, 0)); traveler.add(cyl(0.05, 0.05, 0.25, 4, '#1f5a66', 0.08, 0));
    traveler.position.set(cx - 1.9, 0, cz + 1.2); scene.add(traveler);
  }

  function makeVillager(i) {
    const rnd = rand(100 + i), g = new THREE.Group();
    const fur = [C.wood, C.woodL, C.hide, '#6b4426'][i % 4], skin = ['#e0b48a', '#c89060', '#8a5a3a'][i % 3];
    g.add(cyl(0.13, 0.16, 0.38, 6, fur, 0, 0.2)); g.add(ball(0.13, skin, 0, 0.7, 0, 1)); g.add(box(0.24, 0.08, 0.24, '#2a1a10', 0, 0.78, -0.02));
    const l1 = box(0.07, 0.22, 0.07, skin, -0.06, 0, 0), l2 = box(0.07, 0.22, 0.07, skin, 0.06, 0, 0); g.add(l1, l2); g.userData.legs = [l1, l2];
    g.userData.speed = 0.9 + rnd() * 0.6; g.userData.target = null; g.userData.wait = rnd() * 2;
    g.position.set((rnd() - .5) * 10, 0, (rnd() - .5) * 10); g.visible = false; scene.add(g); return g;
  }
  function makeMammoth(i) {
    const g = new THREE.Group(), b = '#7a4a2a', d = '#5a3418';
    g.add(box(1.4, 0.9, 0.8, b, 0, 0.5, 0)); g.add(box(0.7, 0.7, 0.7, b, 0.85, 0.75, 0)); g.add(box(0.15, 0.7, 0.15, d, 1.25, 0.2, 0));
    g.add(box(0.06, 0.06, 0.45, '#f4ecd8', 1.2, 0.55, 0.25)); g.add(box(0.06, 0.06, 0.45, '#f4ecd8', 1.2, 0.55, -0.25));
    const legs = [[-0.45, 0.25], [-0.45, -0.25], [0.45, 0.25], [0.45, -0.25]].map(([x, z]) => { const l = box(0.22, 0.5, 0.22, d, x, 0, z); g.add(l); return l; });
    g.userData.legs = legs; g.userData.a = i * Math.PI; g.userData.r = 14 + i * 4; g.scale.setScalar(0.9 + i * 0.2); scene.add(g); return g;
  }

  // ---------- post-processing: pixelate + outlines ----------
  function setupPost() {
    rtColor = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, type: THREE.HalfFloatType });
    rtColor.depthTexture = new THREE.DepthTexture(1, 1); rtColor.depthTexture.minFilter = rtColor.depthTexture.magFilter = THREE.NearestFilter;
    rtNormal = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    normalMat = new THREE.MeshNormalMaterial({ flatShading: true });
    postMat = new THREE.ShaderMaterial({
      uniforms: { tColor: { value: rtColor.texture }, tDepth: { value: rtColor.depthTexture }, tNormal: { value: rtNormal.texture }, texel: { value: new THREE.Vector2() }, outline: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D tColor; uniform sampler2D tDepth; uniform sampler2D tNormal; uniform vec2 texel; uniform float outline; varying vec2 vUv;
        float D(vec2 o){ return texture2D(tDepth, vUv + o * texel).r; }
        vec3 N(vec2 o){ return texture2D(tNormal, vUv + o * texel).rgb * 2.0 - 1.0; }
        void main(){
          vec4 col = texture2D(tColor, vUv);
          float d = D(vec2(0.0)); vec3 n = N(vec2(0.0));
          float de = 0.0, ne = 0.0;
          vec2 o[4]; o[0] = vec2(1.0, 0.0); o[1] = vec2(-1.0, 0.0); o[2] = vec2(0.0, 1.0); o[3] = vec2(0.0, -1.0);
          for (int i = 0; i < 4; i++) {
            float dd = D(o[i]);
            de += clamp((dd - d) * 500.0, 0.0, 1.0);
            if (dd > d - 0.0004) ne += smoothstep(0.2, 0.5, 1.0 - dot(n, N(o[i])));
          }
          de = step(0.6, de); ne = step(0.6, ne) * (1.0 - de);
          vec3 c = col.rgb;
          c = mix(c, c * 0.42, de * outline);
          c = mix(c, c * 1.3 + 0.015, ne * outline * 0.7);
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`
    });
    postScene = new THREE.Scene(); postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));
  }

  // ---------- camera ----------
  function updateCamera() {
    cam.yaw += (cam.yawGoal - cam.yaw) * 0.2;
    const fh = 26 / cam.zoom, aspect = worldW / worldH;
    camera.left = -fh * aspect / 2; camera.right = fh * aspect / 2; camera.top = fh / 2; camera.bottom = -fh / 2; camera.updateProjectionMatrix();
    const dir = new THREE.Vector3(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch));
    camera.position.copy(cam.target).addScaledVector(dir, 80); camera.lookAt(cam.target);
    // snap to the pixel grid so the image does not shimmer while panning
    camera.updateMatrixWorld();
    const wpp = fh / worldH, right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const pr = camera.position.dot(right), pu = camera.position.dot(up);
    camera.position.addScaledVector(right, Math.round(pr / wpp) * wpp - pr).addScaledVector(up, Math.round(pu / wpp) * wpp - pu);
    camera.updateMatrixWorld();
  }
  function clampTarget() { cam.target.x = Math.max(-14, Math.min(14, cam.target.x)); cam.target.z = Math.max(-14, Math.min(14, cam.target.z)); }

  // ---------- sizing / quality ----------
  function resize() {
    const r = box3.getBoundingClientRect(), q = QUALITY[quality];
    const px = q.pixel * Math.min(2, Math.max(1, (window.devicePixelRatio || 1) / 1.5));
    worldW = Math.max(64, Math.floor(r.width / q.pixel)); worldH = Math.max(48, Math.floor(r.height / q.pixel));
    renderer.setPixelRatio(1); renderer.setSize(worldW, worldH, false);
    rtColor.setSize(worldW, worldH); rtNormal.setSize(worldW, worldH); postMat.uniforms.texel.value.set(1 / worldW, 1 / worldH);
    void px;
  }
  function setQuality(q) {
    if (!QUALITY[q]) q = 'medium'; quality = q;
    const s = QUALITY[q].shadows;
    renderer.shadowMap.enabled = !!s; sun.castShadow = !!s;
    if (s) { sun.shadow.mapSize.set(s, s); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
    resize();
  }

  // ---------- grid & placement ----------
  function occupancy(S, except) {
    const occ = new Set();
    for (let i = 0; i < MACHINE_CELLS.w; i++) for (let j = 0; j < MACHINE_CELLS.d; j++) occ.add((MACHINE_CELLS.x + i) + ',' + (MACHINE_CELLS.z + j));
    for (const id in S.layout) {
      if (id === except || !(S.b[id] > 0)) continue;
      const L = S.layout[id], [w, d] = footOf(id, L.rot || 0);
      for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) occ.add((L.x + i) + ',' + (L.z + j));
    }
    return occ;
  }
  function fits(S, id, x, z, rot, except) {
    const [w, d] = footOf(id, rot), occ = occupancy(S, except);
    for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) {
      const cx = x + i, cz = z + j;
      if (cx < CELL_MIN || cx > CELL_MAX || cz < CELL_MIN || cz > CELL_MAX || occ.has(cx + ',' + cz)) return false;
    }
    return true;
  }
  function roomy(S, id, x, z, rot) { // one free cell around the footprint, so auto-placed buildings do not touch
    const [w, d] = footOf(id, rot), occ = occupancy(S, id);
    for (let i = -1; i <= w; i++) for (let j = -1; j <= d; j++) if (occ.has((x + i) + ',' + (z + j))) return false;
    return true;
  }
  function findFreeSpot(S, id) {
    return findSpot(S, id, true) || findSpot(S, id, false);
  }
  function findSpot(S, id, spaced) {
    let best = null, bd = 1e9;
    for (let rot = 0; rot < 2; rot++) for (let x = CELL_MIN; x <= CELL_MAX; x++) for (let z = CELL_MIN; z <= CELL_MAX; z++) {
      if (!fits(S, id, x, z, rot, id) || (spaced && !roomy(S, id, x, z, rot))) continue;
      const [w, d] = footOf(id, rot), dist = Math.hypot(x + w / 2 - 0.5, z + d / 2 - 1.5);
      if (dist < bd) { bd = dist; best = { x, z, rot }; }
    }
    return best;
  }
  function centerOf(id, L) { const [w, d] = footOf(id, L.rot || 0); return new THREE.Vector3(L.x + w / 2, 0, L.z + d / 2); }

  function makeModel(id, tier, withHit) {
    const g = new THREE.Group(); const inner = new THREE.Group(); MODELS[id](inner, tier); g.add(inner); g.userData.inner = inner;
    Object.assign(g.userData, inner.userData);
    if (withHit) { const [w, d] = FOOT[id]; const hb = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, d), hitMat); hb.position.y = 0.6; hb.userData.hitbox = true; g.add(hb); }
    return g;
  }
  function syncBuildings(S) {
    for (const id in FOOT) {
      const n = S.b[id] || 0, L = S.layout[id];
      let b = buildings[id];
      if (!n || !L || (placing && placing.id === id && placing.moving)) { if (b) b.visible = false; if (labels[id]) labels[id].hidden = true; continue; }
      const tier = tierOf(n);
      if (!b || b.userData.tier !== tier) {
        if (b) { scene.remove(b); const i = clickables.indexOf(b); if (i >= 0) clickables.splice(i, 1); }
        b = buildings[id] = makeModel(id, tier, true); b.userData.tier = tier; scene.add(tag(b, { building: id }));
      }
      b.visible = true;
      b.position.copy(centerOf(id, L)); b.rotation.y = -(L.rot || 0) * Math.PI / 2;
      if (!labels[id]) { const el = document.createElement('div'); el.className = 'blabel'; opts.labelBox.appendChild(el); labels[id] = el; }
      labels[id].hidden = false; labels[id].textContent = '×' + n;
    }
  }

  const ghostOk = new THREE.MeshLambertMaterial({ color: '#7dff7a', transparent: true, opacity: 0.55 });
  const ghostBad = new THREE.MeshLambertMaterial({ color: '#ff5a4a', transparent: true, opacity: 0.55 });
  function startPlacement(id, moving) {
    cancelPlacement(true);
    const S = lastState, L = S.layout[id];
    placing = { id, moving: !!moving, rot: L ? L.rot || 0 : 0, x: 0, z: 0, ok: false };
    ghost = makeModel(id, tierOf(Math.max(1, S.b[id] || 1)));
    ghost.traverse(o => { if (o.isMesh) { o.material = ghostOk; o.castShadow = false; } });
    scene.add(ghost);
    ghostPad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#7dff7a', transparent: true, opacity: 0.35 }));
    ghostPad.rotation.x = -Math.PI / 2; ghostPad.position.y = 0.03; scene.add(ghostPad);
    gridHelper.visible = true;
    const spot = L || findFreeSpot(S, id) || { x: 0, z: 0, rot: 0 };
    placing.x = spot.x; placing.z = spot.z; placing.rot = spot.rot || 0; updateGhost();
  }
  function updateGhost() {
    if (!placing) return;
    const S = lastState, { id, x, z, rot } = placing, [w, d] = footOf(id, rot);
    placing.ok = fits(S, id, x, z, rot, id);
    ghost.position.set(x + w / 2, 0, z + d / 2); ghost.rotation.y = -rot * Math.PI / 2;
    ghost.traverse(o => { if (o.isMesh) o.material = placing.ok ? ghostOk : ghostBad; });
    ghostPad.scale.set(w, d, 1); ghostPad.position.set(x + w / 2, 0.03, z + d / 2); ghostPad.material.color.set(placing.ok ? '#7dff7a' : '#ff5a4a');
  }
  function cancelPlacement(silent) {
    if (!placing) return null;
    const p = placing; placing = null;
    if (ghost) scene.remove(ghost); if (ghostPad) scene.remove(ghostPad); ghost = ghostPad = null; gridHelper.visible = false;
    if (!silent && opts.onCancelPlace) opts.onCancelPlace(p.id, p.moving);
    return p;
  }
  function confirmPlacement() {
    if (!placing || !placing.ok) return false;
    const p = cancelPlacement(true);
    opts.onPlace(p.id, { x: p.x, z: p.z, rot: p.rot });
    return true;
  }
  function rotatePlacement() { if (placing) { placing.rot = (placing.rot + 1) % 4; updateGhost(); } }

  // ---------- picking ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function setNdc(ev) { const r = cvs.getBoundingClientRect(); ndc.set((ev.clientX - r.left) / r.width * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); }
  function pick(ev) {
    setNdc(ev);
    const hit = ray.intersectObjects(clickables, true).find(h => h.object.visible && h.object.userData.click);
    return hit ? hit.object.userData.click : null;
  }
  function groundCell(ev) { setNdc(ev); const p = new THREE.Vector3(); if (!ray.ray.intersectPlane(plane, p)) return null; return p; }

  function bindInput() {
    let down = null; const pointers = new Map(); let pinch = 0;
    cvs.addEventListener('contextmenu', e => e.preventDefault());
    cvs.addEventListener('pointerdown', e => {
      cvs.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
      down = { x: e.clientX, y: e.clientY, t: performance.now(), btn: e.button, moved: false, lx: e.clientX, ly: e.clientY };
    });
    cvs.addEventListener('pointermove', e => {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) { const [a, b] = [...pointers.values()], dd = Math.hypot(a.x - b.x, a.y - b.y); if (pinch) zoomBy(dd / pinch); pinch = dd; if (down) down.moved = true; return; }
      if (placing) { const p = groundCell(e); if (p) { const [w, d] = footOf(placing.id, placing.rot); const nx = Math.round(p.x - w / 2), nz = Math.round(p.z - d / 2); if (nx !== placing.x || nz !== placing.z) { placing.x = nx; placing.z = nz; updateGhost(); } } }
      if (!down) { const c = pick(e); cvs.style.cursor = placing ? 'crosshair' : c ? 'pointer' : 'grab'; return; }
      const dx = e.clientX - down.lx, dy = e.clientY - down.ly; down.lx = e.clientX; down.ly = e.clientY;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) down.moved = true;
      if (!down.moved) return;
      if (down.btn === 2) { cam.yawGoal -= dx * 0.01; cam.yaw = cam.yawGoal; return; }
      if (placing && down.btn === 0) return;
      // pan: move target opposite to drag, in camera space
      const fh = 26 / cam.zoom, wpp = fh / box3.getBoundingClientRect().height;
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
      if (c && c.res) opts.onGather(c.res, e.clientX, e.clientY);
      else if (c && c.building) opts.onSelect(c.building, e.clientX, e.clientY);
      else opts.onSelect(null);
    };
    cvs.addEventListener('pointerup', up); cvs.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); down = null; });
    cvs.addEventListener('wheel', e => { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
    window.addEventListener('keydown', e => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const k = e.key.toLowerCase(), step = 1.2 / cam.zoom;
      const right = new THREE.Vector3(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)), fwd = new THREE.Vector3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw));
      if (k === 'q') rotateView(-1); else if (k === 'e') rotateView(1);
      else if (k === 'r') rotatePlacement();
      else if (k === 'escape') { if (placing) cancelPlacement(false); else opts.onSelect(null); }
      else if (k === 'w' || k === 'arrowup') cam.target.addScaledVector(fwd, step); else if (k === 's' || k === 'arrowdown') cam.target.addScaledVector(fwd, -step);
      else if (k === 'a' || k === 'arrowleft') cam.target.addScaledVector(right, -step); else if (k === 'd' || k === 'arrowright') cam.target.addScaledVector(right, step);
      else if (k === '=' || k === '+') zoomBy(1.15); else if (k === '-') zoomBy(1 / 1.15);
      else return;
      clampTarget();
    });
  }
  function zoomBy(f) { cam.zoom = Math.max(0.8, Math.min(4, cam.zoom * f)); }
  function rotateView(dir) { cam.yawGoal += dir * Math.PI / 4; }

  // ---------- per-frame ----------
  const _v = new THREE.Vector3();
  function project(v) {
    _v.copy(v).project(camera); const r = box3.getBoundingClientRect();
    return { x: (_v.x + 1) / 2 * r.width, y: (1 - _v.y) / 2 * r.height };
  }
  function screenOf(what) {
    let v = null;
    if (what === 'ideas') v = machine.position.clone().setY(2.2);
    else if (what === 'wood') v = new THREE.Vector3(-11, 2, 0);
    else if (what === 'stone') v = new THREE.Vector3(-6.5, 1, 10.2);
    else if (what === 'food') v = new THREE.Vector3(0, 1, 10);
    else if (buildings[what] && buildings[what].visible) v = buildings[what].position.clone().setY(1.5);
    return v ? project(v) : null;
  }

  function update(S, t, dt, fx, selected) {
    lastState = S;
    syncBuildings(S);
    // day / night
    const phase = (t / DAY_S + 0.3) % 1, a = phase * Math.PI * 2;
    const h = Math.sin(a), day = Math.max(0, Math.min(1, h * 1.6 + 0.35));
    const sunDir = h > -0.05 ? new THREE.Vector3(Math.cos(a) * 30, Math.max(8, h * 45), 18) : new THREE.Vector3(-Math.cos(a) * 30, 30, 12);
    sun.position.copy(sunDir); sun.target.position.set(0, 0, 0);
    sun.intensity = h > -0.05 ? 0.4 + 2.4 * day : 0.45;
    sun.color.set(h > -0.05 ? (day < 0.5 ? '#ffb27a' : '#fff4e0') : '#8fa8ff');
    hemi.intensity = 0.35 + 0.9 * day;
    const sky = new THREE.Color('#121a3a').lerp(new THREE.Color('#8fd0ff'), day);
    if (day > 0.15 && day < 0.6) sky.lerp(new THREE.Color('#ffb48a'), 0.35 * (1 - Math.abs(day - 0.38) / 0.23));
    scene.background = sky; scene.fog.color.copy(sky);
    // machine parts
    const P = machine.userData.parts, has = id => !!S.parts[id];
    const vis = (k, v) => (P[k] || []).forEach(o => o.visible = v);
    vis('body', has('hull')); vis('broken', !has('hull')); vis('frame', has('frame')); vis('woodLegs', !has('frame')); vis('wiring', has('wiring'));
    vis('gearbox', has('gearbox')); vis('ring', !has('gearbox')); vis('battery', has('battery')); vis('core', has('core'));
    const nParts = Object.keys(S.parts).length, lamp = P.lamp[0];
    lamp.material = mat(nParts >= 6 ? '#6fff8a' : '#ff4a4a', glow(nParts >= 6 ? '#6fff8a' : '#ff4a4a', Math.floor(t * (1 + nParts)) % 2 ? 1.8 : 0.1));
    // click feedback
    const shake = (obj, k) => { const v = fx[k] || 0; obj.scale.setScalar(1 + Math.sin(v * 40) * v * 0.25); };
    clickables.forEach(c => { if (c.userData.click && c.userData.click.res) shake(c, c.userData.click.res); });
    // animated bits
    scene.traverse(o => {
      if (o.userData.flame) { const s = 0.8 + Math.sin(t * 12 + o.userData.flame * 2) * 0.25; o.scale.set(1, s, 1); }
      if (o.userData.spin) o.rotation.y += dt * o.userData.spin;
      if (o.userData.spinX) o.rotation.x += dt * o.userData.spinX;
      if (o.userData.sway !== undefined) o.rotation.z = Math.sin(t * 1.2 + o.userData.sway) * 0.03;
      if (o.userData.crystal) o.rotation.y += dt;
    });
    // lights: fixed pool so shaders never recompile
    const lights = [];
    for (const id in buildings) { const b = buildings[id]; if (b.visible && b.userData.light) lights.push([b.localToWorld(new THREE.Vector3(...b.userData.light)), b.userData.lightColor || '#ff8a3a']); }
    if (S.parts.core) lights.push([machine.position.clone().setY(2.2), '#c77dff']);
    pointLights.forEach((pl, i) => {
      const L = lights[i]; if (!L) { pl.intensity = 0; return; }
      pl.position.copy(L[0]); pl.color.set(L[1]); pl.intensity = (3 + 9 * (1 - day)) * (0.9 + Math.sin(t * 9 + i) * 0.1);
    });
    // villagers walk between buildings
    const spots = Object.keys(buildings).filter(id => buildings[id].visible).map(id => buildings[id].position);
    spots.push(machine.position);
    const pop = Math.min(villagers.length, Math.ceil((S.built || 0) / 4));
    villagers.forEach((v, i) => {
      v.visible = i < pop; if (!v.visible) return;
      const u = v.userData;
      if (!u.target || v.position.distanceTo(u.target) < 0.4) { if ((u.wait -= dt) > 0) { u.legs.forEach(l => l.rotation.x = 0); return; } const s = spots[Math.floor(Math.random() * spots.length)]; u.target = s.clone().add(new THREE.Vector3((Math.random() - .5) * 3, 0, (Math.random() - .5) * 3 + 1.6)); u.wait = 1 + Math.random() * 3; }
      const dir = u.target.clone().sub(v.position); dir.y = 0; const d = dir.length(); dir.normalize();
      v.position.addScaledVector(dir, Math.min(d, u.speed * dt)); v.rotation.y = Math.atan2(dir.x, dir.z);
      const sw = Math.sin(t * 10 * u.speed) * 0.6; u.legs[0].rotation.x = sw; u.legs[1].rotation.x = -sw;
    });
    mammoths.forEach((m, i) => {
      const u = m.userData; u.a += dt * 0.03 * (i ? -1 : 1);
      const x = Math.cos(u.a) * u.r, z = Math.sin(u.a) * u.r; m.position.set(x, Math.max(0, heightAt(x, z)), z);
      m.rotation.y = Math.atan2(-Math.sin(u.a), Math.cos(u.a)) * (i ? -1 : 1) + (i ? Math.PI : 0) - Math.PI / 2;
      u.legs.forEach((l, k) => l.rotation.z = Math.sin(t * 4 + k * 1.6) * 0.3);
    });
    traveler.rotation.y = Math.sin(t * 0.5) * 0.4;
    // smoke from volcano and iron mine chimney
    const chim = buildings.ironMine && buildings.ironMine.visible && buildings.ironMine.userData.smoke ? buildings.ironMine.localToWorld(new THREE.Vector3(...buildings.ironMine.userData.smoke)) : null;
    smoke.forEach((s, i) => {
      const p = (s.userData.p + t * 0.05) % 1;
      if (s.userData.src === 'volcano') { s.position.set(18 + Math.sin(i * 3 + t * 0.3) * 1.5 + p * 3, heightAt(18, -24) + 11 + p * 9, -24 + Math.cos(i) * 1.5); s.scale.setScalar(0.8 + p * 2.4); s.material.opacity = 0.55 * (1 - p); s.visible = true; }
      else if (chim) { s.position.set(chim.x + p * 0.6, chim.y + p * 3, chim.z + Math.sin(i + t) * 0.2); s.scale.setScalar(0.15 + p * 0.6); s.material.opacity = 0.5 * (1 - p); s.visible = true; }
      else s.visible = false;
    });
    water.position.y = -0.35 + Math.sin(t * 0.8) * 0.03;
    // selection pad
    if (selected && S.layout[selected] && buildings[selected] && buildings[selected].visible) {
      const [w, d] = footOf(selected, S.layout[selected].rot || 0); selPad.visible = true; selPad.scale.set(w + 0.3, d + 0.3, 1);
      selPad.position.copy(buildings[selected].position).setY(0.025); selPad.material.opacity = 0.35 + Math.sin(t * 5) * 0.15;
    } else selPad.visible = false;
    // render: colour+depth, normals, then the pixel/outline pass to the screen
    updateCamera();
    renderer.setRenderTarget(rtColor); renderer.render(scene, camera);
    const fogWas = scene.fog, bgWas = scene.background; scene.fog = null; scene.background = null; scene.overrideMaterial = normalMat;
    const hidden = []; scene.traverse(o => { if (o.isMesh && o.material && o.material.transparent && o !== ground) { if (o.visible) { hidden.push(o); o.visible = false; } } });
    renderer.setRenderTarget(rtNormal); renderer.setClearColor(0x8080ff, 1); renderer.clear(); renderer.render(scene, camera);
    hidden.forEach(o => o.visible = true); scene.overrideMaterial = null; scene.fog = fogWas; scene.background = bgWas;
    postMat.uniforms.outline.value = QUALITY[quality].outline;
    renderer.setRenderTarget(null); renderer.render(postScene, postCam);
    // labels follow buildings
    for (const id in labels) {
      const el = labels[id]; if (el.hidden || !buildings[id]) continue;
      el.style.visibility = cam.zoom >= 1.6 || id === selected ? 'visible' : 'hidden';
      const b = buildings[id], bb = new THREE.Box3().setFromObject(b), p = project(new THREE.Vector3(b.position.x, bb.max.y + 0.3, b.position.z));
      el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -100%)`;
    }
  }

  function init(o) {
    opts = o; box3 = o.container; quality = o.quality || 'medium';
    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.shadowMap.type = THREE.PCFShadowMap;
    cvs = renderer.domElement; cvs.id = 'scene3d'; box3.prepend(cvs);
    scene = new THREE.Scene(); scene.fog = new THREE.Fog('#8fd0ff', 70, 140);
    camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 300);
    hemi = new THREE.HemisphereLight('#dff2ff', '#5a4a30', 1); scene.add(hemi);
    sun = new THREE.DirectionalLight('#fff4e0', 2.5); sun.shadow.camera.left = -26; sun.shadow.camera.right = 26; sun.shadow.camera.top = 26; sun.shadow.camera.bottom = -26;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 140; sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.02; scene.add(sun, sun.target);
    for (let i = 0; i < 4; i++) { const pl = new THREE.PointLight('#ff8a3a', 0, 7, 1.6); scene.add(pl); pointLights.push(pl); }
    setupPost(); buildTerrain(); buildNature(); buildMachine();
    gridHelper = new THREE.GridHelper(16, 16, '#ffffff', '#ffffff'); gridHelper.material.transparent = true; gridHelper.material.opacity = 0.25; gridHelper.position.y = 0.02; gridHelper.visible = false; scene.add(gridHelper);
    selPad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#f2d14b', transparent: true, opacity: 0.4 })); selPad.rotation.x = -Math.PI / 2; selPad.visible = false; scene.add(selPad);
    for (let i = 0; i < 24; i++) villagers.push(makeVillager(i));
    mammoths.push(makeMammoth(0), makeMammoth(1));
    bindInput(); setQuality(quality);
    new ResizeObserver(resize).observe(box3);
  }

  root.Scene3D = { init, update, startPlacement, cancelPlacement, rotatePlacement, confirmPlacement, isPlacing: () => placing ? placing.id : null,
    findFreeSpot, fits, setQuality, rotateView, zoomBy, screenOf, FOOT };
})(window);
