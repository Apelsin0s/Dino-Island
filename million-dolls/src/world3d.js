// First-person 3D: the attic, the doll pile, Mother, the flashlight, lights, blood, post effects.
'use strict';
(function (root) {
  const THREE = root.THREE, Sim = root.Sim;
  const PILE_R = 5.6, PILE_H = 3.8, EYE = 1.62;
  const QUALITY = { low: { scale: 0.6, shadow: 512 }, medium: { scale: 0.8, shadow: 1024 }, high: { scale: 1, shadow: 2048 } };

  let renderer, scene, camera, host, rt, postScene, postCam, postMat, quality = 'medium';
  let flash, flashTarget, moon, hemi, candleLights = [], lantern, pileMass, headsIM, bodiesIM, dollSlots = [], discardHeads, discardBodies, discardCount = 0;
  let mother, motherHead, door, mirror, occluders = [], colliders = [], fliers = [], bloodPool = [], bloodIdx = 0, dust, bellMesh;
  let lastPileF = -1, poseT = 0, jump = null, settings = { blood: true, flashes: true, scares: true };
  const ray = new THREE.Raycaster();

  // ---------- canvas textures ----------
  function canvasTex(w, h, draw, repeat) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  }
  const rnd = (a, b) => a + Math.random() * (b - a);
  function woodTex(repeat, dark) {
    return canvasTex(512, 512, (g, w, h) => {
      const pw = 64;
      for (let x = 0; x < w; x += pw) {
        const base = dark ? rnd(28, 44) : rnd(48, 70);
        g.fillStyle = `rgb(${base + 18},${base + 6},${base - 8})`; g.fillRect(x, 0, pw, h);
        for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(${rnd(10, 40)},${rnd(5, 20)},0,${rnd(0.08, 0.3)})`; g.lineWidth = rnd(0.5, 2); g.beginPath(); const y = rnd(0, h); g.moveTo(x, y); g.bezierCurveTo(x + pw * 0.3, y + rnd(-8, 8), x + pw * 0.6, y + rnd(-8, 8), x + pw, y + rnd(-5, 5)); g.stroke(); }
        g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillRect(x, 0, 2, h);
        const cut = rnd(80, 440); g.fillRect(x, cut, pw, 2);
        g.fillStyle = 'rgba(20,20,20,0.9)'; [[6, cut - 10], [pw - 8, cut - 10], [6, cut + 12], [pw - 8, cut + 12]].forEach(([a, b]) => g.fillRect(x + a, b, 3, 3));
      }
      const img = g.getImageData(0, 0, w, h); for (let i = 0; i < img.data.length; i += 4) { const n = (Math.random() - 0.5) * 18; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; } g.putImageData(img, 0, 0);
      for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(10,5,0,${rnd(0.05, 0.18)})`; g.beginPath(); g.ellipse(rnd(0, w), rnd(0, h), rnd(10, 60), rnd(5, 30), rnd(0, 3), 0, 7); g.fill(); }
    }, repeat);
  }
  const fabricTex = () => canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#2a2224'; g.fillRect(0, 0, w, h);
    const cols = ['#5a2e2e', '#3e4a5e', '#6a5a4a', '#4a3a52', '#7a6a62', '#2e3e34', '#8a7a6a', '#5a4434'];
    for (let i = 0; i < 900; i++) { g.fillStyle = cols[i % cols.length]; g.globalAlpha = rnd(0.4, 0.9); g.beginPath(); g.ellipse(rnd(0, w), rnd(0, h), rnd(4, 22), rnd(3, 14), rnd(0, 3), 0, 7); g.fill(); }
    g.globalAlpha = 1; for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(232,220,200,${rnd(0.3, 0.8)})`; g.beginPath(); g.arc(rnd(0, w), rnd(0, h), rnd(2, 6), 0, 7); g.fill(); g.fillStyle = '#000'; g.fillRect(rnd(0, w), rnd(0, h), 2, 2); }
  }, [6, 3]);
  function faceTex(blood) {
    return canvasTex(512, 512, (g, w, h) => {
      g.clearRect(0, 0, w, h); const grd = g.createRadialGradient(256, 240, 30, 256, 256, 250); grd.addColorStop(0, '#e9e2d8'); grd.addColorStop(0.8, '#b8aa9c'); grd.addColorStop(1, 'rgba(168,154,140,0)'); g.fillStyle = grd; g.beginPath(); g.ellipse(256, 256, 240, 252, 0, 0, 7); g.fill();
      g.fillStyle = '#d8a8a0'; g.globalAlpha = 0.35; g.beginPath(); g.ellipse(170, 300, 40, 26, 0, 0, 7); g.ellipse(342, 300, 40, 26, 0, 0, 7); g.fill(); g.globalAlpha = 1;
      [[185, 230], [327, 230]].forEach(([x, y]) => { g.fillStyle = '#050304'; g.beginPath(); g.ellipse(x, y, 42, 30, 0, 0, 7); g.fill(); g.fillStyle = '#2a0a0a'; g.beginPath(); g.arc(x + 4, y + 2, 7, 0, 7); g.fill(); g.strokeStyle = '#3a2a28'; g.lineWidth = 4; g.beginPath(); g.ellipse(x, y, 46, 34, 0, 0, 7); g.stroke(); });
      g.strokeStyle = '#3a2a28'; g.lineWidth = 3; [[150, 180, 220, 170], [290, 172, 362, 182]].forEach(([a, b, c, d]) => { g.beginPath(); g.moveTo(a, b); g.quadraticCurveTo((a + c) / 2, b - 18, c, d); g.stroke(); });
      g.fillStyle = '#6a1a1a'; g.beginPath(); g.ellipse(256, 370, 34, 12, 0, 0, 7); g.fill(); g.fillStyle = '#1a0505'; g.fillRect(226, 368, 60, 4);
      g.strokeStyle = 'rgba(40,30,28,.85)'; g.lineWidth = 2;
      const crack = (x, y, n) => { g.beginPath(); g.moveTo(x, y); for (let i = 0; i < n; i++) { x += rnd(-22, 22); y += rnd(6, 26); g.lineTo(x, y); } g.stroke(); };
      crack(300, 60, 9); crack(200, 30, 6); crack(330, 250, 6); crack(140, 300, 5);
      if (blood) { g.fillStyle = '#5a0000'; [[185, 262], [327, 262]].forEach(([x, y]) => { g.fillRect(x - 5, y, 10, rnd(120, 200)); g.beginPath(); g.arc(x, y + 200, 9, 0, 7); g.fill(); }); g.fillStyle = 'rgba(90,0,0,.8)'; g.fillRect(240, 378, 8, 80); g.fillRect(268, 378, 6, 60); }
    });
  }
  const bloodTex = () => canvasTex(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) { const r = Math.pow(Math.random(), 2) * 60 + 3, a = rnd(0, 6.28), d = Math.pow(Math.random(), 1.6) * 100; g.fillStyle = `rgba(${rnd(70, 110)},0,${rnd(0, 8)},${rnd(0.6, 0.95)})`; g.beginPath(); g.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, r * (d > 60 ? 0.3 : 1), 0, 7); g.fill(); }
  });
  const dressTex = blood => canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#3a1a1c'; g.fillRect(0, 0, w, h); for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${rnd(60, 90)},${rnd(30, 40)},${rnd(30, 40)},.3)`; g.fillRect(rnd(0, w), rnd(0, h), rnd(1, 3), rnd(8, 30)); }
    g.strokeStyle = '#d8c8b8'; g.lineWidth = 3; for (let y = 20; y < h; y += 40) { g.beginPath(); for (let x = 0; x <= w; x += 16) g.lineTo(x, y + (x / 16 % 2) * 8); g.stroke(); }
    if (blood) for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(${rnd(60, 100)},0,0,.85)`; g.beginPath(); g.ellipse(rnd(0, w), rnd(h * 0.4, h), rnd(8, 30), rnd(10, 50), 0, 0, 7); g.fill(); }
  });

  // ---------- materials ----------
  const M = {};
  function std(color, rough, extra) { return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough == null ? 0.85 : rough, metalness: 0 }, extra || {})); }
  function mk(geo, mat, x, y, z, cast = true, recv = true) { const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.castShadow = cast; m.receiveShadow = recv; return m; }

  // ---------- attic ----------
  function buildAttic() {
    const A = Sim.ATTIC, W = A.maxX - A.minX, L = A.maxZ - A.minZ;
    M.floor = std('#ffffff', 0.9, { map: woodTex([6, 9]) });
    M.wood = std('#ffffff', 0.85, { map: woodTex([1, 4], true) });
    M.roof = std('#ffffff', 0.95, { map: woodTex([8, 3], true) });
    const floor = mk(new THREE.PlaneGeometry(W, L), M.floor, 0, 0, 0, false); floor.rotation.x = -Math.PI / 2; scene.add(floor);
    // roof: two slopes from the knee walls (h 1.2 at |x| = 9) to the ridge (h 5.2)
    const slopeLen = Math.hypot(9, 4), ang = Math.atan2(4, 9);
    [-1, 1].forEach(sd => {
      const slab = mk(new THREE.BoxGeometry(slopeLen, 0.08, L), M.roof, sd * 4.5, 3.2, 0); slab.rotation.z = -sd * ang; scene.add(slab);
      scene.add(mk(new THREE.BoxGeometry(0.1, 1.2, L), M.wood, sd * 9, 0.6, 0));
      for (let z = A.minZ + 0.6; z < A.maxZ; z += 1.6) { const raf = mk(new THREE.BoxGeometry(slopeLen, 0.18, 0.12), M.wood, sd * 4.5, 3.05, z); raf.rotation.z = -sd * ang; scene.add(raf); }
    });
    const ridge = mk(new THREE.BoxGeometry(0.25, 0.3, L), M.wood, 0, 5.05, 0); scene.add(ridge);
    for (let z = A.minZ + 0.6; z < A.maxZ; z += 3.2) { const tie = mk(new THREE.BoxGeometry(12, 0.16, 0.14), M.wood, 0, 3.0, z); scene.add(tie); }
    // gable walls with a round window (far) and the door (near)
    const gable = (z, holeWindow) => {
      const shape = new THREE.Shape(); shape.moveTo(-9, 0); shape.lineTo(9, 0); shape.lineTo(9, 1.2); shape.lineTo(0, 5.2); shape.lineTo(-9, 1.2); shape.lineTo(-9, 0);
      if (holeWindow) { const hole = new THREE.Path(); hole.absarc(0, 3.2, 0.7, 0, Math.PI * 2, true); shape.holes.push(hole); }
      else { const hole = new THREE.Path(); hole.moveTo(-0.55, 0); hole.lineTo(-0.55, 2.1); hole.lineTo(0.55, 2.1); hole.lineTo(0.55, 0); shape.holes.push(hole); }
      const m = mk(new THREE.ShapeGeometry(shape), M.wood, 0, 0, z); if (z > 0) m.rotation.y = Math.PI; m.material = M.wood.clone(); m.material.side = THREE.DoubleSide; scene.add(m);
    };
    gable(A.minZ, true); gable(A.maxZ, false);
    // window frame + glass
    const frame = mk(new THREE.TorusGeometry(0.72, 0.06, 6, 24), M.wood, 0, 3.2, A.minZ + 0.03); scene.add(frame);
    const bar1 = mk(new THREE.BoxGeometry(1.4, 0.05, 0.05), M.wood, 0, 3.2, A.minZ + 0.03), bar2 = mk(new THREE.BoxGeometry(0.05, 1.4, 0.05), M.wood, 0, 3.2, A.minZ + 0.03); scene.add(bar1, bar2);
    const glass = mk(new THREE.CircleGeometry(0.7, 24), new THREE.MeshBasicMaterial({ color: '#30405a', transparent: true, opacity: 0.35 }), 0, 3.2, A.minZ - 0.02, false, false); scene.add(glass);
    // moonbeam (fake volumetric)
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 2.2, 7, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#7f9fd0', transparent: true, opacity: 0.045, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    beam.position.set(0, 1.9, A.minZ + 3.2); beam.rotation.x = -Math.PI / 2 + 0.65; scene.add(beam);
    // door
    door = new THREE.Group(); door.position.set(0, 0, A.maxZ - 0.05);
    const leaf = mk(new THREE.BoxGeometry(1.08, 2.08, 0.08), std('#3a2a20', 0.7, { map: woodTex([1, 1], true) }), 0, 1.04, 0); door.add(leaf);
    door.add(mk(new THREE.SphereGeometry(0.05, 10, 8), std('#8a7a5a', 0.3, { metalness: 0.8 }), 0.42, 1.0, -0.08));
    door.add(mk(new THREE.BoxGeometry(0.08, 0.14, 0.03), std('#2a2a2a', 0.4, { metalness: 0.7 }), 0.42, 0.85, -0.06));
    door.userData.door = true; scene.add(door);
    // posts
    [[-3.6, -11], [3.6, -11], [-3.6, 5.5], [3.6, 5.5], [-3.6, 11.5], [3.6, 11.5]].forEach(([x, z]) => { const p = mk(new THREE.BoxGeometry(0.26, 3, 0.26), M.wood, x, 1.5, z); scene.add(p); occluders.push(p); colliders.push({ x, z, r: 0.4 }); });
    // clutter
    const sheet = std('#c8c0b0', 0.95), dark = std('#2a2018', 0.8, { map: woodTex([1, 1], true) });
    const clutter = (geo, mat, x, y, z, ry, w, d) => { const m = mk(geo, mat, x, y, z); m.rotation.y = ry || 0; scene.add(m); occluders.push(m); colliders.push({ box: true, x, z, w: w / 2 + 0.35, d: d / 2 + 0.35 }); return m; };
    clutter(new THREE.BoxGeometry(1.2, 0.7, 0.7), dark, 6.2, 0.35, 8.5, 0.1, 1.2, 0.7);
    clutter(new THREE.CylinderGeometry(0.5, 0.75, 1.3, 7), sheet, -6.2, 0.65, 6.5, 0, 1.4, 1.4);
    clutter(new THREE.BoxGeometry(1.0, 1.5, 0.6), sheet, -6.6, 0.75, -2.5, 0.3, 1, 0.6);
    const crib = new THREE.Group(); crib.position.set(-5.8, 0, -9.5); for (let i = 0; i < 9; i++) crib.add(mk(new THREE.BoxGeometry(0.04, 0.8, 0.04), dark, -0.6 + i * 0.15, 0.4, -0.35), mk(new THREE.BoxGeometry(0.04, 0.8, 0.04), dark, -0.6 + i * 0.15, 0.4, 0.35));
    crib.add(mk(new THREE.BoxGeometry(1.3, 0.05, 0.75), dark, 0, 0.8, 0), mk(new THREE.BoxGeometry(1.25, 0.12, 0.7), sheet, 0, 0.35, 0)); scene.add(crib); colliders.push({ box: true, x: -5.8, z: -9.5, w: 1, d: 0.7 });
    const rocker = new THREE.Group(); rocker.position.set(5.4, 0, -9.8); rocker.rotation.y = -0.6;
    rocker.add(mk(new THREE.BoxGeometry(0.55, 0.05, 0.5), dark, 0, 0.45, 0), mk(new THREE.BoxGeometry(0.55, 0.7, 0.05), dark, 0, 0.82, -0.25), mk(new THREE.TorusGeometry(0.5, 0.025, 4, 16, 1.2), dark, 0, 0.5, 0)); rocker.userData.rock = true; scene.add(rocker); colliders.push({ x: 5.4, z: -9.8, r: 0.6 });
    // dust in the air
    const n = 900, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { pos[i * 3] = rnd(-8, 8); pos[i * 3 + 1] = rnd(0.2, 4.5); pos[i * 3 + 2] = rnd(-13, 13); }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: '#d8d0c0', size: 0.012, transparent: true, opacity: 0.55, depthWrite: false })); scene.add(dust);
  }

  // ---------- dolls ----------
  function dollGeometries() {
    const skin = new THREE.Color('#dcd6ce'), black = new THREE.Color('#050404'), lip = new THREE.Color('#8a2a2a');
    const colorize = (g, c) => { g = g.index ? g.toNonIndexed() : g; const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); return g; };
    const at = (g, x, y, z, rx, rz) => { g.rotateX(rx || 0); g.rotateZ(rz || 0); g.translate(x, y, z); return g; };
    const hairCols = ['#2a1a10', '#8a6a3a', '#c8a050', '#1a1a1a'];
    const heads = hairCols.map(hc => THREE.mergeGeometries([
      colorize(at(new THREE.SphereGeometry(0.085, 8, 6), 0, 0.33, 0), skin),
      colorize(at(new THREE.SphereGeometry(0.02, 4, 3), -0.03, 0.345, 0.073), black), colorize(at(new THREE.SphereGeometry(0.02, 4, 3), 0.03, 0.345, 0.073), black),
      colorize(at(new THREE.SphereGeometry(0.012, 4, 3), 0, 0.3, 0.078), lip),
      colorize(at(new THREE.SphereGeometry(0.092, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.55), 0, 0.34, -0.012, -0.25), new THREE.Color(hc)),
      colorize(at(new THREE.CylinderGeometry(0.018, 0.014, 0.16, 4, 1, true), -0.085, 0.17, 0, 0, 0.35), skin), colorize(at(new THREE.CylinderGeometry(0.018, 0.014, 0.16, 4, 1, true), 0.085, 0.17, 0, 0, -0.35), skin),
      colorize(at(new THREE.CylinderGeometry(0.022, 0.018, 0.14, 4, 1, true), -0.035, 0.0, 0), skin), colorize(at(new THREE.CylinderGeometry(0.022, 0.018, 0.14, 4, 1, true), 0.035, 0.0, 0), skin)
    ]));
    const body = THREE.mergeGeometries([colorize(at(new THREE.ConeGeometry(0.11, 0.22, 7, 1, true), 0, 0.16, 0), new THREE.Color('#ffffff')), colorize(at(new THREE.CylinderGeometry(0.05, 0.06, 0.08, 6, 1, true), 0, 0.25, 0), new THREE.Color('#ffffff'))]);
    return { heads, body };
  }
  const HEAD_MAT = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0 });
  const BODY_MAT = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide, map: null });
  const DRESS = ['#6a2a2a', '#3a4a6a', '#7a6a5a', '#5a3a6a', '#8a8070', '#2e4a3a', '#a08a7a', '#5a4434', '#b8b0a0', '#4a2020'];
  function buildPile() {
    const P = Sim.PILE_POS;
    M.mass = std('#ffffff', 0.95, { map: fabricTex() });
    pileMass = mk(new THREE.ConeGeometry(1, 1, 40, 6), M.mass, P.x, 0, P.z); pileMass.userData.pile = true; scene.add(pileMass); occluders.push(pileMass);
    const { heads, body } = dollGeometries();
    const COUNT = 1700;
    headsIM = []; const perHead = Math.ceil(COUNT / heads.length);
    heads.forEach(h => { const im = new THREE.InstancedMesh(h, HEAD_MAT(), perHead); im.castShadow = im.receiveShadow = true; headsIM.push(im); scene.add(im); });
    bodiesIM = new THREE.InstancedMesh(body, BODY_MAT(), COUNT); bodiesIM.castShadow = bodiesIM.receiveShadow = true; scene.add(bodiesIM);
    const col = new THREE.Color();
    for (let i = 0; i < COUNT; i++) {
      dollSlots.push({ u: Math.random() * Math.PI * 2, v: Math.sqrt(Math.random()), lay: new THREE.Euler(rnd(-1.6, 1.6), rnd(0, 6.28), rnd(-1.6, 1.6)), s: rnd(0.9, 1.35), up: rnd(0, 0.08), head: i % heads.length, hi: Math.floor(i / heads.length) });
      bodiesIM.setColorAt(i, col.set(DRESS[i % DRESS.length]).offsetHSL(0, -0.1, rnd(-0.08, 0.04)));
    }
    bodiesIM.instanceColor.needsUpdate = true;
    // discarded dolls pile up by the right wall
    discardHeads = new THREE.InstancedMesh(heads[0], HEAD_MAT(), 1500); discardBodies = new THREE.InstancedMesh(body, BODY_MAT(), 1500);
    [discardHeads, discardBodies].forEach(im => { im.count = 0; im.castShadow = im.receiveShadow = true; scene.add(im); });
    for (let i = 0; i < 1500; i++) discardBodies.setColorAt(i, col.set(DRESS[(i * 7) % DRESS.length]));
    // flying dolls
    for (let i = 0; i < 14; i++) { const g = new THREE.Group(); g.add(new THREE.Mesh(heads[i % heads.length], HEAD_MAT()), new THREE.Mesh(body, new THREE.MeshStandardMaterial({ color: DRESS[i % DRESS.length], roughness: 0.95, side: THREE.DoubleSide, vertexColors: true }))); g.children.forEach(c => c.castShadow = true); g.visible = false; scene.add(g); fliers.push({ g, t: 0, on: false }); }
  }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  function layoutPile(f) {
    const P = Sim.PILE_POS, k = Math.cbrt(Math.max(0.0005, f)), R = Math.max(0.5, PILE_R * k), H = Math.max(0.15, PILE_H * k);
    pileMass.scale.set(R, H, R); pileMass.position.y = H / 2;
    const counters = headsIM.map(() => 0);
    const show = Math.min(dollSlots.length, Math.floor(dollSlots.length * Math.min(1, 0.15 + f * 0.85)));
    dollSlots.forEach((d, i) => {
      const vis = i < show, v = d.v, r = R * v, y = H * (1 - v);
      _p.set(P.x + Math.cos(d.u) * r, y + d.up, P.z + Math.sin(d.u) * r); _q.setFromEuler(d.lay); _s.setScalar(vis ? d.s : 0.0001);
      _m.compose(_p, _q, _s); bodiesIM.setMatrixAt(i, _m); headsIM[d.head].setMatrixAt(d.hi, _m); counters[d.head]++;
    });
    bodiesIM.instanceMatrix.needsUpdate = true; headsIM.forEach(im => { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); }); bodiesIM.computeBoundingSphere();
  }
  function addDiscard() {
    if (discardCount >= 1500) return;
    const i = discardCount++, a = Math.random() * 6.28, rr = Math.sqrt(Math.random()) * Math.min(2.6, 0.6 + discardCount / 500), h = Math.max(0, 1.2 * (1 - rr / 2.6)) * Math.min(1, discardCount / 900);
    _p.set(6.2 + Math.cos(a) * rr * 0.6, h * Math.random() + 0.05, 1.5 + Math.sin(a) * rr); _q.setFromEuler(new THREE.Euler(rnd(-1.6, 1.6), rnd(0, 6.28), rnd(-1.6, 1.6))); _s.setScalar(rnd(0.9, 1.3));
    _m.compose(_p, _q, _s); discardHeads.setMatrixAt(i, _m); discardBodies.setMatrixAt(i, _m);
    discardHeads.count = discardBodies.count = discardCount; discardHeads.instanceMatrix.needsUpdate = discardBodies.instanceMatrix.needsUpdate = true;
  }
  function launchDoll() {
    const f = fliers.find(x => !x.on); if (!f) return;
    const P = Sim.PILE_POS, a = Math.atan2(camera.position.z - P.z, camera.position.x - P.x) + rnd(-0.5, 0.5);
    const R = pileMass.scale.x * 0.6, H = pileMass.scale.y * 0.4;
    f.from = new THREE.Vector3(P.x + Math.cos(a) * R, H, P.z + Math.sin(a) * R); f.to = new THREE.Vector3(6.2 + rnd(-1, 1), 0.3, 1.5 + rnd(-1.5, 1.5));
    f.t = 0; f.on = true; f.g.visible = true; f.spin = new THREE.Vector3(rnd(-8, 8), rnd(-8, 8), rnd(-8, 8));
    if (settings.blood && Math.random() < 0.18) addBlood(f.from.x + rnd(-0.6, 0.6), f.from.z + rnd(-0.6, 0.6), rnd(0.3, 0.8));
  }
  function addBlood(x, z, s) {
    if (!settings.blood) return;
    let b = bloodPool[bloodIdx % 80]; bloodIdx++;
    if (!b) { b = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: M.blood, transparent: true, roughness: 0.25, metalness: 0.1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); b.rotation.x = -Math.PI / 2; b.receiveShadow = true; scene.add(b); bloodPool.push(b); }
    b.position.set(x, 0.006 + (bloodIdx % 7) * 0.0005, z); b.rotation.z = Math.random() * 6.28; b.scale.setScalar(s); b.visible = true;
  }

  // ---------- Mother ----------
  function buildMother() {
    mother = new THREE.Group();
    const porcelain = std('#e2d8cc', 0.35), dress = std('#ffffff', 0.9, { map: dressTex(settings.blood) }), stock = std('#151012', 0.8), hair = std('#0c0a0a', 0.7);
    M.face = std('#ffffff', 0.35, { map: faceTex(settings.blood) });
    const leg = (x) => mother.add(mk(new THREE.CylinderGeometry(0.06, 0.05, 0.75, 8), stock, x, 0.38, 0));
    leg(-0.1); leg(0.1);
    const skirt = mk(new THREE.CylinderGeometry(0.2, 0.52, 0.85, 14, 3, true), dress, 0, 1.0, 0); skirt.material.side = THREE.DoubleSide; mother.add(skirt);
    mother.add(mk(new THREE.CylinderGeometry(0.17, 0.2, 0.5, 12), dress, 0, 1.6, 0));
    mother.add(mk(new THREE.CylinderGeometry(0.045, 0.05, 0.14, 8), porcelain, 0, 1.9, 0));
    motherHead = new THREE.Group(); motherHead.position.set(0, 2.08, 0);
    const head = mk(new THREE.SphereGeometry(0.16, 24, 18), porcelain, 0, 0, 0); head.scale.set(1, 1.12, 1); motherHead.add(head);
    M.face.transparent = true; M.face.alphaTest = 0.05;
    const face = mk(new THREE.SphereGeometry(0.163, 24, 18, Math.PI * 0.2, Math.PI * 0.6, Math.PI * 0.18, Math.PI * 0.62), M.face, 0, 0, 0, false, true); face.scale.set(1, 1.12, 1); face.userData.face = true; motherHead.add(face);
    motherHead.add(mk(new THREE.SphereGeometry(0.17, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, 0.02, -0.03));
    for (let i = 0; i < 9; i++) { const s = mk(new THREE.BoxGeometry(0.05, rnd(0.5, 0.75), 0.02), hair, -0.14 + i * 0.035, -0.3, -0.1 - Math.abs(i - 4) * 0.008); s.rotation.x = 0.12; motherHead.add(s); }
    // eye glints that catch the flashlight
    [-0.055, 0.055].forEach(x => motherHead.add(mk(new THREE.SphereGeometry(0.012, 6, 6), new THREE.MeshStandardMaterial({ color: '#300', emissive: '#ff2010', emissiveIntensity: 0.6 }), x, 0.02, 0.15, false, false)));
    mother.add(motherHead);
    const arm = sd => { const g = new THREE.Group(); g.position.set(sd * 0.22, 1.8, 0); g.add(mk(new THREE.CylinderGeometry(0.045, 0.035, 0.9, 8), dress, 0, -0.45, 0)); const hand = mk(new THREE.BoxGeometry(0.07, 0.16, 0.04), settings.blood ? std('#7a1010', 0.3) : porcelain, 0, -0.95, 0); g.add(hand); for (let i = 0; i < 4; i++) g.add(mk(new THREE.CylinderGeometry(0.008, 0.006, 0.16, 4), porcelain, -0.025 + i * 0.017, -1.1, 0)); mother.add(g); return g; };
    mother.userData.arms = [arm(-1), arm(1)];
    mother.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(mother);
  }
  function newPose() {
    const [l, r] = mother.userData.arms;
    l.rotation.set(rnd(-1.2, 0.2), 0, rnd(-0.1, 0.5)); r.rotation.set(rnd(-1.2, 0.2), 0, rnd(-0.5, 0.1));
    motherHead.rotation.set(rnd(-0.2, 0.35), rnd(-0.4, 0.4), rnd(-0.6, 0.6));
    mother.rotation.x = rnd(-0.05, 0.12);
  }

  // ---------- post-processing ----------
  function setupPost() {
    rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 0 });
    postMat = new THREE.ShaderMaterial({
      uniforms: { tColor: { value: rt.texture }, time: { value: 0 }, fear: { value: 0 }, hurt: { value: 0 }, black: { value: 0 }, flash: { value: 0 }, res: { value: new THREE.Vector2(1, 1) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D tColor; uniform float time, fear, hurt, black, flash; uniform vec2 res; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + time * 7.0) * 43758.5453); }
        void main(){
          vec2 uv = vUv; vec2 c = uv - 0.5;
          float ca = 0.0015 + fear * 0.006;
          vec3 col = vec3(texture2D(tColor, uv + c * ca).r, texture2D(tColor, uv).g, texture2D(tColor, uv - c * ca).b);
          float l = dot(col, vec3(0.299, 0.587, 0.114));
          col = mix(col, vec3(l), 0.25 + fear * 0.3);
          col *= vec3(0.95, 0.98, 1.05);
          float v = smoothstep(0.85, 0.2 - fear * 0.15, length(c * vec2(1.25, 1.0)));
          col *= mix(0.35, 1.0, v);
          col = mix(col, col * vec3(1.4, 0.25, 0.2) + vec3(0.12, 0.0, 0.0), hurt);
          col += (h(uv * res) - 0.5) * (0.022 + fear * 0.04);
          col = mix(col, vec3(1.0, 0.95, 0.9), flash);
          col *= 1.0 - black;
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`
    });
    postScene = new THREE.Scene(); postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));
  }
  function resize() {
    const r = host.getBoundingClientRect(), q = QUALITY[quality], pr = Math.min(2, window.devicePixelRatio || 1) * q.scale;
    renderer.setPixelRatio(pr); renderer.setSize(r.width, r.height, false);
    rt.setSize(Math.floor(r.width * pr), Math.floor(r.height * pr)); postMat.uniforms.res.value.set(r.width * pr, r.height * pr);
    camera.aspect = r.width / r.height; camera.updateProjectionMatrix();
  }
  function setQuality(q) { quality = QUALITY[q] ? q : 'medium'; const s = QUALITY[quality].shadow; [flash].forEach(l => { l.shadow.mapSize.set(s, s); if (l.shadow.map) { l.shadow.map.dispose(); l.shadow.map = null; } }); resize(); }

  // ---------- visibility test: can this player see Mother? ----------
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), frustum = new THREE.Frustum(), pm = new THREE.Matrix4();
  function playerSees(player, s, lights) {
    const W = { x: mother.position.x, z: mother.position.z };
    const dist = Math.hypot(W.x - player.x, W.z - player.z);
    if (dist > 22) return false;
    camera.updateMatrixWorld(); pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(pm);
    const pts = [new THREE.Vector3(W.x, 1.95, W.z), new THREE.Vector3(W.x, 1.2, W.z), new THREE.Vector3(W.x, 0.5, W.z)];
    let visible = false;
    for (const p of pts) {
      if (!frustum.containsPoint(p)) continue;
      _a.copy(camera.position); _b.copy(p).sub(_a); const len = _b.length(); ray.set(_a, _b.normalize()); ray.far = len - 0.3;
      if (!ray.intersectObjects(occluders, false).length) { visible = true; break; }
    }
    if (!visible) return false;
    // lit? flashlight cone, candle/lantern zone, moon patch, or very close
    if (dist < 2.2) return true;
    if (player.light) { camera.getWorldDirection(_a); _b.set(W.x - camera.position.x, 1.4 - camera.position.y, W.z - camera.position.z).normalize(); if (_a.angleTo(_b) < 0.42 && dist < 16) return true; }
    if (lights.litAt(W.x, W.z)) return true;
    return false;
  }

  // ---------- init / update ----------
  function init(container, opts) {
    host = container; settings = Object.assign(settings, opts.settings || {}); quality = opts.quality || 'medium';
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
    host.prepend(renderer.domElement); renderer.domElement.id = 'view';
    scene = new THREE.Scene(); scene.background = new THREE.Color('#020203'); scene.fog = new THREE.FogExp2('#040406', 0.062);
    camera = new THREE.PerspectiveCamera(72, 1, 0.05, 80); camera.rotation.order = 'YXZ'; scene.add(camera);
    hemi = new THREE.HemisphereLight('#4a5470', '#1a120c', 0.18); scene.add(hemi);
    moon = new THREE.DirectionalLight('#8aa8e0', 0.55); moon.position.set(0, 4.2, Sim.ATTIC.minZ - 3); moon.target.position.set(0, 0, Sim.ATTIC.minZ + 6); moon.castShadow = false;
    moon.shadow.camera.left = -6; moon.shadow.camera.right = 6; moon.shadow.camera.top = 6; moon.shadow.camera.bottom = -6; moon.shadow.camera.far = 30; scene.add(moon, moon.target);
    flash = new THREE.SpotLight('#eef2ff', 40, 18, 0.46, 0.55, 2); flash.castShadow = true; flash.shadow.camera.near = 0.2; flash.shadow.bias = -0.0005;
    flashTarget = new THREE.Object3D(); camera.add(flash, flashTarget); flash.position.set(0.18, -0.15, 0.05); flashTarget.position.set(0, 0, -5); flash.target = flashTarget;
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, x = Sim.PILE_POS.x + Math.cos(a) * 6.6, z = Sim.PILE_POS.z + Math.sin(a) * 6.6; const pl = new THREE.PointLight('#ffb050', 0, 5, 2); pl.position.set(x, 0.5, z); const c = mk(new THREE.CylinderGeometry(0.04, 0.045, 0.22, 8), std('#e8dcc0', 0.6), x, 0.11, z); const fl = mk(new THREE.ConeGeometry(0.025, 0.06, 6), new THREE.MeshBasicMaterial({ color: '#ffd080' }), x, 0.26, z, false, false); c.visible = fl.visible = false; scene.add(pl, c, fl); candleLights.push({ pl, c, fl, x, z }); }
    lantern = new THREE.PointLight('#ffc070', 0, 12, 1.6); lantern.position.set(Sim.PILE_POS.x, 4.2, Sim.PILE_POS.z); lantern.castShadow = true; lantern.shadow.mapSize.set(512, 512); scene.add(lantern);
    const lamp = mk(new THREE.CylinderGeometry(0.1, 0.13, 0.28, 10), std('#4a3a20', 0.4, { metalness: 0.6 }), Sim.PILE_POS.x, 4.25, Sim.PILE_POS.z); lamp.visible = false; scene.add(lamp); lantern.userData.mesh = lamp;
    M.blood = bloodTex();
    buildAttic(); buildPile(); buildMother(); newPose(); setupPost();
    mirror = mk(new THREE.PlaneGeometry(0.9, 1.3), std('#9aa8b0', 0.05, { metalness: 0.95 }), Sim.PILE_POS.x - 2.2, 3.4, Sim.PILE_POS.z + 3.8); mirror.rotation.x = -0.4; mirror.visible = false; scene.add(mirror);
    bellMesh = mk(new THREE.ConeGeometry(0.05, 0.08, 8), std('#c8a040', 0.3, { metalness: 0.9 }), 0, 0.9, 0); bellMesh.visible = false; scene.add(bellMesh);
    resize(); new ResizeObserver(resize).observe(host);
    setQuality(quality);
  }

  function setSettings(s) {
    const bloodChanged = s.blood !== settings.blood; Object.assign(settings, s);
    if (bloodChanged) { M.face.map = faceTex(settings.blood); M.face.needsUpdate = true; bloodPool.forEach(b => b.visible = settings.blood && b.visible); }
  }

  // world: Sim world; player: local player; input: { move: {f, r}, run, look: {dx, dy} } — applied by caller; returns sensing for the sim
  function update(world, player, t, dt) {
    const s = Sim.stats(world);
    // camera from player
    camera.position.set(player.x, EYE + (player.bob || 0), player.z); camera.rotation.set(player.pitch, player.yaw, 0);
    flash.visible = player.light; flash.intensity = player.light ? 38 * (0.75 + 0.25 * Math.min(1, player.battery * 3)) * (player.battery < 0.15 ? (Math.random() < 0.15 ? 0.2 : 1) : 1) : 0;
    // pile shape follows progress
    const f = Sim.remaining(world) / Sim.PILE; if (Math.abs(f - lastPileF) > 0.002 || lastPileF < 0) { layoutPile(f); lastPileF = f; }
    // candles / lantern / mirror
    const nc = Math.min(6, Math.ceil(Sim.lv(world, 'candles') * 0.6));
    candleLights.forEach((c, i) => { const on = i < nc; c.c.visible = c.fl.visible = on; c.pl.intensity = on ? 2.4 * (0.85 + Math.sin(t * 13 + i * 3) * 0.1 + Math.random() * 0.05) : 0; c.fl.scale.y = 0.9 + Math.sin(t * 17 + i) * 0.2; });
    const hasLantern = Sim.lv(world, 'lantern') > 0; lantern.intensity = hasLantern ? 9 * (0.95 + Math.sin(t * 2.3) * 0.05) : 0; lantern.userData.mesh.visible = hasLantern;
    mirror.visible = Sim.lv(world, 'mirror') > 0;
    // lit zones
    const lights = { litAt(x, z) {
      const d = Math.hypot(x - Sim.PILE_POS.x, z - Sim.PILE_POS.z);
      if (hasLantern && d < 9) return true;
      if (nc > 0 && d < 6.6 + 1.6) return true;
      if (z < Sim.ATTIC.minZ + 5 && Math.abs(x) < 2.6) return true;  // moonlight patch
      return false;
    } };
    // Mother follows the sim position; change pose when she moved unseen
    const W = world.watcher;
    const moved = Math.hypot(mother.position.x - W.x, mother.position.z - W.z) > 0.01;
    mother.position.set(W.x, 0, W.z); mother.visible = W.active || true;
    if (moved) { poseT += dt; if (poseT > 0.35) { newPose(); poseT = 0; } }
    mother.rotation.y = Math.atan2(player.x - W.x, player.z - W.z);
    const sees = playerSees(player, s, lights);
    // fliers
    fliers.forEach(fl => { if (!fl.on) return; fl.t += dt * 1.6; const k = Math.min(1, fl.t); fl.g.position.lerpVectors(fl.from, fl.to, k); fl.g.position.y += Math.sin(k * Math.PI) * 1.6; fl.g.rotation.x += fl.spin.x * dt; fl.g.rotation.y += fl.spin.y * dt; if (k >= 1) { fl.on = false; fl.g.visible = false; addDiscard(); } });
    // dust drift
    const pos = dust.geometry.attributes.position; for (let i = 0; i < pos.count; i += 7) { pos.setY(i, pos.getY(i) + Math.sin(t * 0.3 + i) * 0.0008); } pos.needsUpdate = true;
    scene.traverse(o => { if (o.userData.rock) o.rotation.x = W.moving ? Math.sin(t * 2.2) * 0.08 : o.rotation.x * 0.98; });
    // jumpscare animation
    let hurt = 0, black = 0, fl = 0;
    if (jump) {
      jump.t += dt; const k = jump.t;
      if (jump.scare) {
        const head = jump.head; head.visible = k < 1.0;
        camera.updateMatrixWorld(); const d = Math.max(0.42, 1.6 - k * 3.2);
        head.position.copy(camera.localToWorld(new THREE.Vector3((Math.random() - 0.5) * 0.04 * k * 4, -0.04, -d))); head.quaternion.copy(camera.quaternion); head.rotateZ(Math.sin(k * 40) * 0.08);
        camera.rotation.z = (Math.random() - 0.5) * 0.08 * Math.min(1, k * 3);
        hurt = Math.min(1, k * 2); fl = settings.flashes && k < 0.12 ? 0.6 : 0;
        black = k > 0.9 ? Math.min(1, (k - 0.9) * 2.5) : 0;
      } else black = Math.min(1, k * 1.5);
      if (k > 2.2) { if (jump.head) { jump.head.visible = false; } const cb = jump.done; jump = null; cb && cb(); }
    }
    // fear: how close and awake she is
    const dist = Math.hypot(W.x - player.x, W.z - player.z);
    const fear = W.active ? Math.min(1, Math.max(0, (1 - dist / 10)) * 0.8 + W.wake * 0.35) : 0;
    postMat.uniforms.time.value = t; postMat.uniforms.fear.value = fear; postMat.uniforms.hurt.value = Math.max(hurt, player.stun > 0 ? 0.4 * player.stun / 4 : 0);
    postMat.uniforms.black.value = Math.max(black, player.stun > 0 ? Math.min(1, player.stun / 2) * 0.85 : 0); postMat.uniforms.flash.value = fl;
    renderer.setRenderTarget(rt); renderer.render(scene, camera); renderer.setRenderTarget(null); renderer.render(postScene, postCam);
    // what the player is looking at
    camera.getWorldDirection(_a); ray.set(camera.position, _a); ray.far = 3.4;
    const hit = ray.intersectObjects([pileMass, door], true)[0];
    let target = null; if (hit) { let o = hit.object; while (o && !o.userData.pile && !o.userData.door) o = o.parent; if (o) target = o.userData.pile ? 'pile' : 'door'; }
    return { sees, litAtWatcher: lights.litAt(W.x, W.z), target, fear, dist, bellDir: Math.atan2(W.x - player.x, W.z - player.z) - player.yaw };
  }
  function jumpscare(scare, done) {
    let head = null;
    if (scare) { head = motherHead.clone(true); head.traverse(o => { if (o.isMesh && o.userData.face) { o.material = M.face.clone(); o.material.emissive = new THREE.Color('#ffffff'); o.material.emissiveMap = M.face.map; o.material.emissiveIntensity = 0.35; } }); head.scale.setScalar(1.0); scene.add(head); }
    jump = { t: 0, scare, head, done };
  }
  function collide(p) {
    const A = Sim.ATTIC; p.x = Math.max(-7.2, Math.min(7.2, p.x)); p.z = Math.max(A.minZ + 0.5, Math.min(A.maxZ - 0.5, p.z));
    const P = Sim.PILE_POS, pr = pileMass ? pileMass.scale.x + 0.45 : PILE_R, d = Math.hypot(p.x - P.x, p.z - P.z);
    if (d < pr) { p.x = P.x + (p.x - P.x) / d * pr; p.z = P.z + (p.z - P.z) / d * pr; }
    colliders.forEach(c => {
      if (c.box) { const dx = p.x - c.x, dz = p.z - c.z; if (Math.abs(dx) < c.w && Math.abs(dz) < c.d) { if (c.w - Math.abs(dx) < c.d - Math.abs(dz)) p.x = c.x + Math.sign(dx) * c.w; else p.z = c.z + Math.sign(dz) * c.d; } }
      else { const dx = p.x - c.x, dz = p.z - c.z, dd = Math.hypot(dx, dz); if (dd < c.r && dd > 0) { p.x = c.x + dx / dd * c.r; p.z = c.z + dz / dd * c.r; } }
    });
  }
  root.World3D = { init, update, setQuality, setSettings, launchDoll, addBlood, jumpscare, collide, canvas: () => renderer.domElement };
})(window);
