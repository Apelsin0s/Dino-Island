// First-person 3D: the attic (entrance, hall, nursery, workshop), the doll pile, Mother, the flashlight,
// lights, blood, post effects, and the visuals for every scare event.
'use strict';
(function (root) {
  const THREE = root.THREE, Sim = root.Sim, DD = root.DOLLS_DATA;
  const PILE_R = 6.6, PILE_H = 4.4, EYE = 1.62, RIDGE = 6.0, KNEE = 1.2, HALF = 11;
  const QUALITY = { low: { scale: 0.6, shadow: 512 }, medium: { scale: 0.8, shadow: 1024 }, high: { scale: 1, shadow: 2048 } };
  const roofY = x => KNEE + (HALF - Math.abs(x)) * (RIDGE - KNEE) / HALF;

  let renderer, scene, camera, host, rt, postScene, postCam, postMat, quality = 'medium';
  let flash, flashTarget, hemi, candleLights = [], roomLights = [], lantern, pileMass, headsIM, bodiesIM, dollSlots = [], discardHeads, discardBodies, discardCount = 0;
  let mother, motherHead, door, mirror, occluders = [], colliders = [], fliers = [], bloodPool = [], bloodIdx = 0, dust, gates = [], mobiles = [];
  let decorSpots = [], lastPileF = -1, poseT = 0, jump = null, settings = { blood: true, flashes: true, scares: true }, lookAtPlayer = 0;
  const FX = {};   // scare visuals
  const ray = new THREE.Raycaster();
  const rnd = (a, b) => a + Math.random() * (b - a);

  // ---------- canvas textures ----------
  function canvasTex(w, h, draw, repeat) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  }
  function woodTex(repeat, dark) {
    return canvasTex(512, 512, (g, w, h) => {
      const pw = 64;
      for (let x = 0; x < w; x += pw) {
        const base = dark ? rnd(28, 44) : rnd(48, 70);
        g.fillStyle = `rgb(${base + 18},${base + 6},${base - 8})`; g.fillRect(x, 0, pw, h);
        for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(${rnd(10, 40)},${rnd(5, 20)},0,${rnd(0.08, 0.3)})`; g.lineWidth = rnd(0.5, 2); g.beginPath(); const y = rnd(0, h); g.moveTo(x, y); g.bezierCurveTo(x + pw * 0.3, y + rnd(-8, 8), x + pw * 0.6, y + rnd(-8, 8), x + pw, y + rnd(-5, 5)); g.stroke(); }
        g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillRect(x, 0, 2, h); const cut = rnd(80, 440); g.fillRect(x, cut, pw, 2);
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
  const bloodTex = () => canvasTex(256, 256, (g) => {
    for (let i = 0; i < 60; i++) { const r = Math.pow(Math.random(), 2) * 60 + 3, a = rnd(0, 6.28), d = Math.pow(Math.random(), 1.6) * 100; g.fillStyle = `rgba(${rnd(70, 110)},0,${rnd(0, 8)},${rnd(0.6, 0.95)})`; g.beginPath(); g.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, r * (d > 60 ? 0.3 : 1), 0, 7); g.fill(); }
  });
  const dressTex = blood => canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#3a1a1c'; g.fillRect(0, 0, w, h); for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${rnd(60, 90)},${rnd(30, 40)},${rnd(30, 40)},.3)`; g.fillRect(rnd(0, w), rnd(0, h), rnd(1, 3), rnd(8, 30)); }
    g.strokeStyle = '#d8c8b8'; g.lineWidth = 3; for (let y = 20; y < h; y += 40) { g.beginPath(); for (let x = 0; x <= w; x += 16) g.lineTo(x, y + (x / 16 % 2) * 8); g.stroke(); }
    if (blood) for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(${rnd(60, 100)},0,0,.85)`; g.beginPath(); g.ellipse(rnd(0, w), rnd(h * 0.4, h), rnd(8, 30), rnd(10, 50), 0, 0, 7); g.fill(); }
  });
  const drawingTex = () => canvasTex(256, 192, (g, w, h) => {
    g.fillStyle = '#e8e0cc'; g.fillRect(0, 0, w, h); g.lineWidth = 4; g.strokeStyle = '#222';
    g.beginPath(); g.arc(80, 70, 22, 0, 7); g.moveTo(80, 92); g.lineTo(80, 150); g.moveTo(50, 110); g.lineTo(110, 110); g.stroke();
    g.strokeStyle = '#8a0a0a'; g.beginPath(); g.arc(180, 60, 34, 0, 7); g.moveTo(180, 94); g.lineTo(180, 180); g.moveTo(130, 120); g.lineTo(230, 110); g.stroke();
    g.fillStyle = '#000'; g.fillRect(166, 52, 8, 8); g.fillRect(188, 52, 8, 8); g.font = '20px serif'; g.fillStyle = '#8a0a0a'; g.fillText('MAMA', 150, 30);
  });
  // full-screen face for the jumpscare: cracked porcelain, empty sockets, a mouth split to the ears
  function horrorFace(blood) {
    const cv = document.createElement('canvas'); cv.width = 768; cv.height = 768; const g = cv.getContext('2d'), W = 768, C = 384;
    const vg = g.createRadialGradient(C, C, 120, C, C, 384); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,1)');
    const sk = g.createRadialGradient(C - 40, C - 80, 40, C, C, 330); sk.addColorStop(0, '#efe6da'); sk.addColorStop(0.55, '#c9b9a6'); sk.addColorStop(1, '#5a4c40');
    g.fillStyle = '#000'; g.fillRect(0, 0, W, W); g.fillStyle = sk; g.beginPath(); g.ellipse(C, C + 20, 300, 360, 0, 0, 7); g.fill();
    // grime
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${40 + Math.random() * 40},${25 + Math.random() * 20},20,${Math.random() * 0.12})`; g.fillRect(Math.random() * W, Math.random() * W, 2 + Math.random() * 5, 2 + Math.random() * 5); }
    // sunken sockets, wet edges, a pin-prick of light deep inside
    [[C - 120, C - 40, -0.15], [C + 120, C - 30, 0.2]].forEach(([x, y, r]) => {
      const sg = g.createRadialGradient(x, y, 10, x, y, 105); sg.addColorStop(0, '#000'); sg.addColorStop(0.6, '#0a0303'); sg.addColorStop(1, 'rgba(60,20,15,0)');
      g.fillStyle = sg; g.beginPath(); g.ellipse(x, y, 105, 80, r, 0, 7); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.ellipse(x, y, 66, 52, r, 0, 7); g.fill();
      g.fillStyle = '#ff2a10'; g.shadowColor = '#ff2010'; g.shadowBlur = 25; g.beginPath(); g.arc(x + 6, y + 4, 6, 0, 7); g.fill(); g.shadowBlur = 0;
    });
    // mouth torn ear to ear, stitches, too many teeth
    g.fillStyle = '#0b0202'; g.beginPath(); g.moveTo(C - 230, C + 120); g.quadraticCurveTo(C, C + 360, C + 230, C + 110); g.quadraticCurveTo(C, C + 170, C - 230, C + 120); g.fill();
    g.fillStyle = '#2a0505'; g.beginPath(); g.ellipse(C, C + 210, 120, 60, 0, 0, 7); g.fill();
    for (let i = 0; i < 26; i++) { const k = i / 25, x = C - 210 + k * 420, yTop = C + 125 + Math.sin(k * Math.PI) * 55, yBot = C + 118 + Math.sin(k * Math.PI) * 225;
      g.fillStyle = `rgb(${200 + Math.random() * 30},${185 + Math.random() * 30},${150 + Math.random() * 30})`;
      g.beginPath(); g.moveTo(x - 9, yTop); g.lineTo(x + 9, yTop); g.lineTo(x + rnd(-3, 3), yTop + rnd(22, 46)); g.fill();
      g.beginPath(); g.moveTo(x - 8, yBot); g.lineTo(x + 8, yBot); g.lineTo(x + rnd(-3, 3), yBot - rnd(18, 40)); g.fill(); }
    g.strokeStyle = '#1a0a08'; g.lineWidth = 3; for (let i = 0; i < 9; i++) { const x = C - 250 + i * 8, y = C + 115 - i * 3; g.beginPath(); g.moveTo(x, y - 12); g.lineTo(x + 6, y + 12); g.stroke(); g.beginPath(); g.moveTo(W - x, y - 12); g.lineTo(W - x - 6, y + 12); g.stroke(); }
    // cracks
    g.strokeStyle = 'rgba(25,15,12,.9)'; g.lineWidth = 3;
    const crack = (x, y, n, dx) => { g.beginPath(); g.moveTo(x, y); for (let i = 0; i < n; i++) { x += rnd(-30, 30) + dx; y += rnd(10, 40); g.lineTo(x, y); if (Math.random() < 0.3) { g.moveTo(x, y); } } g.stroke(); };
    crack(C + 60, 40, 12, 3); crack(C - 160, 90, 8, -4); crack(C + 200, C - 60, 7, 2); crack(C - 240, C + 40, 6, 0);
    if (blood) {
      g.fillStyle = 'rgba(110,0,0,.95)';
      // tears of blood: wavering runs that thin out and end in a bead
      const run = (x, y, len, w0) => { let px = x, py = y; for (let k = 0; k < len; k += 4) { const w = w0 * (1 - k / len * 0.6); px += rnd(-1.2, 1.2); g.beginPath(); g.ellipse(px, py + k, w, 3.5, 0, 0, 7); g.fill(); } g.beginPath(); g.ellipse(px, y + len, w0 * 0.9, w0 * 1.3, 0, 0, 7); g.fill(); };
      [[C - 120, C + 5], [C + 120, C + 15]].forEach(([x, y]) => { for (let j = 0; j < 3; j++) run(x + rnd(-30, 30), y, rnd(150, 330), rnd(4, 8)); });
      for (let i = 0; i < 40; i++) { g.globalAlpha = Math.random() * 0.8; g.beginPath(); g.arc(C + rnd(-250, 250), C + rnd(100, 380), rnd(2, 14), 0, 7); g.fill(); } g.globalAlpha = 1;
      run(C - 60, C + 250, 180, 6); run(C + 40, C + 240, 140, 5);
    }
    g.fillStyle = vg; g.fillRect(0, 0, W, W);
    return cv;
  }
  function writingTex(text, blood) {
    return canvasTex(1024, 256, (g, w, h) => {
      g.clearRect(0, 0, w, h); g.font = 'bold 120px "Wet Paint", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = blood ? '#a80a0a' : '#d8d0c4'; g.fillText(text, w / 2, h / 2, w - 40);
      if (blood) for (let i = 0; i < 26; i++) { const x = rnd(80, w - 80); g.fillRect(x, h / 2 + 30, rnd(3, 8), rnd(30, 110)); }
    });
  }

  const M = {};
  function std(color, rough, extra) { return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough == null ? 0.85 : rough, metalness: 0 }, extra || {})); }
  function mk(geo, mat, x, y, z, cast = true, recv = true) { const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.castShadow = cast; m.receiveShadow = recv; return m; }

  // ---------- attic ----------
  function profileShape(hole) {
    const s = new THREE.Shape(); s.moveTo(-HALF, 0); s.lineTo(HALF, 0); s.lineTo(HALF, KNEE); s.lineTo(0, RIDGE); s.lineTo(-HALF, KNEE); s.lineTo(-HALF, 0);
    if (hole === 'window') { const p = new THREE.Path(); p.absarc(0, 3.8, 0.8, 0, Math.PI * 2, true); s.holes.push(p); }
    else if (hole) { const [w, h] = hole; const p = new THREE.Path(); p.moveTo(-w / 2, 0); p.lineTo(-w / 2, h); p.lineTo(w / 2, h); p.lineTo(w / 2, 0); s.holes.push(p); }
    return s;
  }
  function buildAttic() {
    const A = Sim.ATTIC, L = A.maxZ - A.minZ;
    M.floor = std('#ffffff', 0.9, { map: woodTex([8, 20]) });
    M.wood = std('#ffffff', 0.85, { map: woodTex([1, 4], true) });
    M.roof = std('#ffffff', 0.95, { map: woodTex([10, 6], true) });
    M.wall = std('#ffffff', 0.9, { map: woodTex([4, 2], true), side: THREE.DoubleSide });
    const floor = mk(new THREE.PlaneGeometry(2 * HALF, L), M.floor, 0, 0, 0, false); floor.rotation.x = -Math.PI / 2; scene.add(floor);
    const slopeLen = Math.hypot(HALF, RIDGE - KNEE), ang = Math.atan2(RIDGE - KNEE, HALF);
    [-1, 1].forEach(sd => {
      const slab = mk(new THREE.BoxGeometry(slopeLen, 0.08, L), M.roof, sd * HALF / 2, (KNEE + RIDGE) / 2, 0); slab.rotation.z = -sd * ang; scene.add(slab); FX.roofSlabs = (FX.roofSlabs || []).concat(slab);
      const knee = mk(new THREE.BoxGeometry(0.1, KNEE, L), M.wood, sd * HALF, KNEE / 2, 0); scene.add(knee); FX.roofSlabs.push(knee);
      for (let z = A.minZ + 0.7; z < A.maxZ; z += 1.6) { const raf = mk(new THREE.BoxGeometry(slopeLen, 0.18, 0.12), M.wood, sd * HALF / 2, (KNEE + RIDGE) / 2 - 0.15, z); raf.rotation.z = -sd * ang; scene.add(raf); }
    });
    scene.add(mk(new THREE.BoxGeometry(0.25, 0.3, L), M.wood, 0, RIDGE - 0.15, 0));
    for (let z = A.minZ + 0.7; z < A.maxZ; z += 3.2) scene.add(mk(new THREE.BoxGeometry(14, 0.16, 0.14), M.wood, 0, 3.3, z));
    // gables: far window, near door
    const far = mk(new THREE.ShapeGeometry(profileShape('window')), M.wall, 0, 0, A.minZ); scene.add(far);
    const near = mk(new THREE.ShapeGeometry(profileShape([1.1, 2.1])), M.wall, 0, 0, A.maxZ); scene.add(near);
    scene.add(mk(new THREE.TorusGeometry(0.82, 0.06, 6, 24), M.wood, 0, 3.8, A.minZ + 0.03));
    scene.add(mk(new THREE.CircleGeometry(0.8, 24), new THREE.MeshBasicMaterial({ color: '#30405a', transparent: true, opacity: 0.35 }), 0, 3.8, A.minZ - 0.02, false, false));
    // partitions with doorways (gates added later)
    Sim.WALLS.forEach(z => { const p = mk(new THREE.ShapeGeometry(profileShape([3, 2.5])), M.wall, 0, 0, z); scene.add(p); occluders.push(p); });
    // moonbeams: through the far window and through a broken roof board over the hall
    const beamMat = new THREE.MeshBasicMaterial({ color: '#7f9fd0', transparent: true, opacity: 0.014, depthWrite: false, side: THREE.FrontSide, blending: THREE.AdditiveBlending, fog: true });
    const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 2.4, 8, 24, 1, true), beamMat); b1.position.set(0, 2.2, A.minZ + 3.4); b1.rotation.x = -Math.PI / 2 + 0.65; scene.add(b1);
    FX.moonPatches = [{ x: 0, z: A.minZ + 4, r: 2.8 }, { x: 2.9, z: 10, r: 1.7 }];
    // door
    door = new THREE.Group(); door.position.set(0, 0, A.maxZ - 0.05);
    door.add(mk(new THREE.BoxGeometry(1.08, 2.08, 0.08), std('#3a2a20', 0.7, { map: woodTex([1, 1], true) }), 0, 1.04, 0));
    door.add(mk(new THREE.SphereGeometry(0.05, 10, 8), std('#8a7a5a', 0.3, { metalness: 0.8 }), 0.42, 1.0, -0.08));
    [0.6, 1.0, 1.4].forEach(y => door.add(mk(new THREE.BoxGeometry(0.1, 0.14, 0.04), std('#2a2a2a', 0.4, { metalness: 0.7 }), 0.42, y - 0.2, -0.07)));
    door.userData.door = true; scene.add(door);
    // the save point: a breaker lever on a post by the door. It turns on every bulb in the attic for a second.
    const LV = Sim.LEVER, lev = new THREE.Group(); lev.position.set(LV.x, 0, LV.z);
    lev.add(mk(new THREE.BoxGeometry(0.14, 1.3, 0.14), M.wood, 0, 0.65, 0.05));
    lev.add(mk(new THREE.BoxGeometry(0.42, 0.56, 0.12), std('#3c3a36', 0.5, { metalness: 0.6 }), 0, 1.35, -0.04));
    const arm = new THREE.Group(); arm.position.set(0, 1.35, -0.12); arm.add(mk(new THREE.CylinderGeometry(0.022, 0.022, 0.34, 8), std('#7a7a70', 0.3, { metalness: 0.9 }), 0, 0.17, 0)); arm.add(mk(new THREE.SphereGeometry(0.05, 10, 8), std('#5a0a0a', 0.5), 0, 0.36, 0)); arm.rotation.x = -0.6; lev.add(arm);
    const lamp = mk(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: '#30ff40' }), 0.14, 1.56, -0.11, false, false); lev.add(lamp);
    lev.add(mk(new THREE.CylinderGeometry(0.012, 0.012, RIDGE - 1.6, 4), std('#111', 0.8), 0.12, 1.6 + (RIDGE - 1.6) / 2, 0.05, false));
    const lb = new THREE.PointLight('#ffb070', 1.6, 3.2, 2); lb.position.set(0, 2.3, -0.5); lev.add(lb, mk(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffcf90' }), 0, 2.35, -0.3, false, false));
    lev.userData = { lever: true, arm, lamp }; scene.add(lev); FX.lever = lev; colliders.push({ x: LV.x, z: LV.z, r: 0.45 });
    FX.bulbs = []; const bulbMat = new THREE.MeshBasicMaterial({ color: '#2a2418' });
    for (let z = A.minZ + 3; z < A.maxZ - 1; z += 6) { const b = mk(new THREE.SphereGeometry(0.07, 8, 6), bulbMat, 0, RIDGE - 0.75, z, false, false); scene.add(b, mk(new THREE.CylinderGeometry(0.006, 0.006, 0.6, 3), std('#111', 0.8), 0, RIDGE - 0.45, z, false, false)); FX.bulbs.push(b); }
    FX.bulbMat = bulbMat;
    // posts
    [[-4.5, -5], [4.5, -5], [-4.5, 11.5], [4.5, 11.5], [-4.5, 22], [4.5, 22], [-4.5, -14], [4.5, -14], [-4.5, -25], [4.5, -25], [-4.5, -36], [4.5, -36], [-4.5, -60], [4.5, -60], [-4.5, -73], [4.5, -73]].forEach(([x, z]) => { const p = mk(new THREE.BoxGeometry(0.28, 3.4, 0.28), M.wood, x, 1.7, z); scene.add(p); occluders.push(p); colliders.push({ x, z, r: 0.42 }); });
  }
  function buildGates() {
    Sim.WALLS.forEach((z, wi) => {
      if (wi === 0) return;   // hall ↔ entrance is always open
      const i = wi; const g = new THREE.Group(); g.position.set(0, 0, z);
      const plank = std('#4a3424', 0.85, { map: woodTex([1, 1], true) });
      [0.4, 0.95, 1.5, 2.05].forEach((y, k) => { const b = mk(new THREE.BoxGeometry(3.4, 0.24, 0.06), plank, 0, y, 0.08 * (k % 2 ? 1 : -1)); b.rotation.z = rnd(-0.12, 0.12); g.add(b); });
      g.add(mk(new THREE.CylinderGeometry(0.02, 0.02, 3.2, 6), std('#5a5a5a', 0.4, { metalness: 0.9 }), 0, 1.2, 0.12));
      g.children[g.children.length - 1].rotation.z = Math.PI / 2 + 0.3;
      g.add(mk(new THREE.BoxGeometry(0.16, 0.2, 0.08), std('#8a7040', 0.35, { metalness: 0.8 }), 0, 1.05, 0.16));
      g.userData.wall = wi; g.userData.open = false; gates.push(g); scene.add(g); occluders.push(...g.children);
    });
  }
  function gateOpen(wi) { const g = gates.find(g => g.userData.wall === wi); return !g || g.userData.open; }
  function openGate(g, instant) {
    if (!g || g.userData.open) return; g.userData.open = true;
    g.children.forEach(c => { const k = occluders.indexOf(c); if (k >= 0) occluders.splice(k, 1); });
    if (instant) { g.visible = false; return; }
    g.userData.fall = 0;
  }

  // ---------- props per room ----------
  function buildProps() {
    const sheet = std('#c8c0b0', 0.95), dark = std('#2a2018', 0.8, { map: woodTex([1, 1], true) }), metal = std('#5a5a5a', 0.4, { metalness: 0.8 });
    const solid = (m, x, z, w, d) => { scene.add(m); occluders.push(m); colliders.push({ box: true, x, z, w: w / 2 + 0.35, d: d / 2 + 0.35 }); return m; };
    // entrance
    solid(mk(new THREE.BoxGeometry(1.3, 0.75, 0.75), dark, 7, 0.38, 26, false), 7, 26, 1.3, 0.75);
    solid(mk(new THREE.CylinderGeometry(0.55, 0.8, 1.4, 7), sheet, -7, 0.7, 24), -7, 24, 1.5, 1.5);
    solid(mk(new THREE.BoxGeometry(1.1, 1.6, 0.6), sheet, -7.6, 0.8, 18, 0.3), -7.6, 18, 1.1, 0.6);
    const chair = new THREE.Group(); chair.position.set(4.2, 0, 27.5); chair.rotation.y = Math.PI + 0.3;
    chair.add(mk(new THREE.BoxGeometry(0.5, 0.05, 0.5), dark, 0, 0.45, 0), mk(new THREE.BoxGeometry(0.5, 0.65, 0.05), dark, 0, 0.8, -0.25));
    [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].forEach(([a, b]) => chair.add(mk(new THREE.BoxGeometry(0.05, 0.45, 0.05), dark, a, 0.22, b)));
    scene.add(chair); colliders.push({ x: 4.2, z: 27.5, r: 0.5 }); FX.chairDoll = { x: 4.2, y: 0.48, z: 27.5, ry: Math.PI + 0.3 };
    const rocker = new THREE.Group(); rocker.position.set(-5.5, 0, 16.5); rocker.rotation.y = 0.8;
    rocker.add(mk(new THREE.BoxGeometry(0.55, 0.05, 0.5), dark, 0, 0.45, 0), mk(new THREE.BoxGeometry(0.55, 0.7, 0.05), dark, 0, 0.82, -0.25), mk(new THREE.TorusGeometry(0.5, 0.025, 4, 16, 1.2), dark, 0, 0.5, 0));
    rocker.userData.rock = true; scene.add(rocker); colliders.push({ x: -5.5, z: 16.5, r: 0.6 }); FX.rocker = rocker;
    // hall: shelves along both knee walls
    [-1, 1].forEach(sd => { for (let z = -6.5; z < 13; z += 3.2) { [0.45, 1.0].forEach(y => scene.add(mk(new THREE.BoxGeometry(0.5, 0.05, 2.9), dark, sd * 10.4, y, z + 1.4))); } });
    // nursery
    const crib = (x, z, r) => { const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = r; for (let i = 0; i < 9; i++) c.add(mk(new THREE.BoxGeometry(0.04, 0.8, 0.04), dark, -0.6 + i * 0.15, 0.4, -0.35), mk(new THREE.BoxGeometry(0.04, 0.8, 0.04), dark, -0.6 + i * 0.15, 0.4, 0.35)); c.add(mk(new THREE.BoxGeometry(1.3, 0.05, 0.75), dark, 0, 0.8, 0), mk(new THREE.BoxGeometry(1.25, 0.12, 0.7), sheet, 0, 0.35, 0)); scene.add(c); colliders.push({ box: true, x, z, w: 1, d: 0.75 }); };
    crib(-7, -10.5, 0.1); crib(-7, -13.5, -0.05); crib(7, -11, 0); crib(7, -16.5, 0.2);
    const horse = new THREE.Group(); horse.position.set(3, 0, -12); horse.rotation.y = -0.7;
    horse.add(mk(new THREE.BoxGeometry(0.8, 0.3, 0.25), std('#e8e0cc', 0.6), 0, 0.75, 0), mk(new THREE.BoxGeometry(0.22, 0.45, 0.2), std('#e8e0cc', 0.6), 0.45, 0.98, 0), mk(new THREE.TorusGeometry(0.5, 0.03, 4, 16, 1.4), std('#8a2020', 0.6), 0, 0.42, 0));
    horse.userData.rock = true; scene.add(horse); colliders.push({ x: 3, z: -12, r: 0.6 }); FX.horse = horse;
    for (let i = 0; i < 4; i++) { const m = new THREE.Group(); m.position.set(-3 + i * 2.2, 3.1, -10 - (i % 2) * 5); m.add(mk(new THREE.CylinderGeometry(0.005, 0.005, 0.9, 3), dark, 0, -0.45, 0, false)); for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2; m.add(mk(new THREE.SphereGeometry(0.06, 6, 5), std(['#c8b8a8', '#8a2020', '#2a2a4a'][k % 3], 0.5), Math.cos(a) * 0.3, -1.0, Math.sin(a) * 0.3)); } scene.add(m); mobiles.push(m); }
    [[-10.9, 1.9, -12, Math.PI / 2], [10.9, 1.9, -15, -Math.PI / 2], [-10.9, 2.1, -16.5, Math.PI / 2]].forEach(([x, y, z, ry]) => { const d = mk(new THREE.PlaneGeometry(0.7, 0.52), std('#ffffff', 0.9, { map: drawingTex() }), x, y - 0.6, z, false); d.rotation.y = ry; scene.add(d); });
    // workshop
    solid(mk(new THREE.BoxGeometry(3, 0.9, 1), dark, -6.5, 0.45, -24), -6.5, -24, 3, 1);
    scene.add(mk(new THREE.BoxGeometry(0.5, 0.35, 0.3), std('#1a1a1a', 0.4, { metalness: 0.6 }), -7.2, 1.07, -24), mk(new THREE.CylinderGeometry(0.08, 0.08, 0.04, 12), metal, -6.9, 1.27, -24));
    const table = mk(new THREE.BoxGeometry(2, 0.12, 0.9), std('#9a9a9a', 0.3, { metalness: 0.6 }), 5, 0.9, -24); scene.add(table); colliders.push({ box: true, x: 5, z: -24, w: 1.4, d: 0.8 });
    [[-0.9, -0.4], [0.9, -0.4], [-0.9, 0.4], [0.9, 0.4]].forEach(([a, b]) => scene.add(mk(new THREE.BoxGeometry(0.06, 0.9, 0.06), metal, 5 + a, 0.45, -24 + b)));
    FX.tableBlood = { x: 5, z: -24 };
    for (let i = 0; i < 5; i++) { const j = mk(new THREE.CylinderGeometry(0.12, 0.12, 0.3, 10), std('#a8c0b0', 0.1, { transparent: true, opacity: 0.45 }), -8.3 + i * 0.35, 1.05, -22.6, false); scene.add(j); const h = mk(new THREE.SphereGeometry(0.07, 8, 6), std('#6a0a10', 0.4, { emissive: '#3a0005', emissiveIntensity: 0.6 }), -8.3 + i * 0.35, 1.02, -22.6, false); h.userData.beat = i; scene.add(h); FX.hearts = (FX.hearts || []).concat(h); }
    for (let i = 0; i < 6; i++) { const x = -3 + i * 1.3, z = -27 + (i % 2) * 2.5; const hb = new THREE.Group(); hb.position.set(x, roofY(x) - 0.3, z); hb.add(mk(new THREE.CylinderGeometry(0.01, 0.01, 1.3, 3), metal, 0, -0.65, 0, false)); const body = mk(new THREE.CylinderGeometry(0.12, 0.2, 0.7, 8), std(['#5a2a2a', '#3a3a4a', '#6a5a4a'][i % 3], 0.9), 0, -1.6, 0); const head = mk(new THREE.SphereGeometry(0.13, 10, 8), std('#d8d0c4', 0.4), 0, -1.15, 0); hb.add(body, head); scene.add(hb); FX.hanging = (FX.hanging || []).concat(hb); }
    // chapel: pews, altar, an upside-down cross, candles
    for (let r = 0; r < 4; r++) [-4.6, 3.0].forEach(x => { solid(mk(new THREE.BoxGeometry(3.8, 0.45, 0.5), dark, x + 0.6, 0.23, -33 - r * 1.8), x + 0.6, -33 - r * 1.8, 3.8, 0.5); scene.add(mk(new THREE.BoxGeometry(3.8, 0.6, 0.08), dark, x + 0.6, 0.75, -33.25 - r * 1.8)); });
    solid(mk(new THREE.BoxGeometry(2.4, 1.1, 0.9), std('#e8e0d0', 0.8), 0, 0.55, -40.6), 0, -40.6, 2.4, 0.9);
    const cross = new THREE.Group(); cross.position.set(0, 2.6, -41.85); cross.add(mk(new THREE.BoxGeometry(0.12, 1.4, 0.08), dark, 0, 0, 0), mk(new THREE.BoxGeometry(0.7, 0.12, 0.08), dark, 0, -0.35, 0)); scene.add(cross);
    for (let i = 0; i < 5; i++) { const x = -1 + i * 0.5; scene.add(mk(new THREE.CylinderGeometry(0.03, 0.035, 0.25 + (i % 2) * 0.1, 8), std('#e8dcc0', 0.6), x, 1.25, -40.8)); }
    FX.altarLight = new THREE.PointLight('#ffb050', 1.2, 5, 2); FX.altarLight.position.set(0, 1.8, -40.4); scene.add(FX.altarLight);
    // bathroom: a clawfoot tub full of dark water, a sink, a mirror with something written on it
    const tub = new THREE.Group(); tub.position.set(-5.2, 0, -48); tub.add(mk(new THREE.CapsuleGeometry(0.42, 1.3, 6, 14), std('#e8e4dc', 0.25), 0, 0.42, 0)); tub.children[0].rotation.x = Math.PI / 2; tub.children[0].scale.y = 0.75;
    const water = mk(new THREE.PlaneGeometry(0.62, 1.55), std(settings.blood ? '#2a0204' : '#10181a', 0.05, { metalness: 0.3 }), 0, 0.6, 0, false); water.rotation.x = -Math.PI / 2; tub.add(water); scene.add(tub); colliders.push({ box: true, x: -5.2, z: -48, w: 0.9, d: 1.4 });
    solid(mk(new THREE.BoxGeometry(0.7, 0.85, 0.5), std('#d8d4cc', 0.3), 7.8, 0.43, -45.5), 7.8, -45.5, 0.7, 0.5);
    const mir = mk(new THREE.PlaneGeometry(0.8, 1.0), std('#ffffff', 0.1, { metalness: 0.6, map: writingTex(settings.blood ? 'ЗА ТОБОЙ' : '...', settings.blood) }), 10.9, 1.9, -45.5, false); mir.rotation.y = -Math.PI / 2; scene.add(mir);
    // theatre: a stage with red curtains and a little puppet theatre on it
    solid(mk(new THREE.BoxGeometry(9, 0.6, 3.2), dark, 0, 0.3, -64.2), 0, -64.2, 9, 3.2);
    [-1, 1].forEach(sd => { const c = mk(new THREE.PlaneGeometry(2.6, 3.2), std('#5a0808', 0.9, { side: THREE.DoubleSide }), sd * 3.4, 2.2, -63.2, false); scene.add(c); });
    const booth = mk(new THREE.BoxGeometry(1.6, 1.4, 0.4), std('#6a1a1a', 0.8), 0, 1.3, -64.8); scene.add(booth);
    for (let r = 0; r < 5; r++) for (let k = 0; k < 14; k++) scene.add(mk(new THREE.BoxGeometry(0.42, 0.45, 0.42), dark, -6.5 + k, 0.22, -57 - r * 1.3, false));
    for (let r = 0; r < 5; r++) colliders.push({ box: true, x: 0, z: -57 - r * 1.3, w: 7.2, d: 0.35 });
    FX.stageLight = new THREE.SpotLight('#ffd0a0', 0, 14, 0.35, 0.6, 2); FX.stageLight.position.set(0, 5, -57); FX.stageLight.target.position.set(0, 0.6, -64.5); scene.add(FX.stageLight, FX.stageLight.target);
    // bedroom: the bed made for two, a wardrobe, her portrait
    solid(mk(new THREE.BoxGeometry(2.2, 0.55, 2.6), std('#d8ccc0', 0.9), 0, 0.28, -77.6), 0, -77.6, 2.2, 2.6);
    scene.add(mk(new THREE.BoxGeometry(2.3, 1.2, 0.12), dark, 0, 0.6, -78.95), mk(new THREE.BoxGeometry(0.7, 0.18, 0.4), std('#f0e8e0', 0.9), -0.5, 0.64, -78.4), mk(new THREE.BoxGeometry(0.7, 0.18, 0.4), std('#f0e8e0', 0.9), 0.5, 0.64, -78.4));
    solid(mk(new THREE.BoxGeometry(1.4, 2.2, 0.7), dark, -7.4, 1.1, -71), -7.4, -71, 1.4, 0.7);
    solid(mk(new THREE.BoxGeometry(1.2, 0.75, 0.5), dark, 6.4, 0.38, -77), 6.4, -77, 1.2, 0.5);
    const portrait = mk(new THREE.PlaneGeometry(0.9, 1.2), std('#ffffff', 0.8, { map: faceTex(settings.blood) }), -10.9, 2.0, -74, false); portrait.rotation.y = Math.PI / 2; scene.add(portrait);
    // dust
    const n = 2400, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { pos[i * 3] = rnd(-10, 10); pos[i * 3 + 1] = rnd(0.2, 5); pos[i * 3 + 2] = rnd(-79, 29); }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: '#d8d0c0', size: 0.012, transparent: true, opacity: 0.55, depthWrite: false })); scene.add(dust);
  }

  // ---------- dolls ----------
  let DOLL;
  function dollGeometries() {
    const skin = new THREE.Color('#dcd6ce'), black = new THREE.Color('#050404'), lip = new THREE.Color('#8a2a2a');
    const colorize = (g, c) => { g = g.index ? g.toNonIndexed() : g; const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); return g; };
    const at = (g, x, y, z, rx, rz) => { g.rotateX(rx || 0); g.rotateZ(rz || 0); g.translate(x, y, z); return g; };
    const heads = ['#2a1a10', '#8a6a3a', '#c8a050', '#1a1a1a'].map(hc => THREE.mergeGeometries([
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
  const HEAD_MAT = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45 });
  const BODY_MAT = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide });
  const DRESS = ['#6a2a2a', '#3a4a6a', '#7a6a5a', '#5a3a6a', '#8a8070', '#2e4a3a', '#a08a7a', '#5a4434', '#b8b0a0', '#4a2020'];
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();
  function buildPile() {
    const P = Sim.PILE_POS; DOLL = dollGeometries();
    M.mass = std('#ffffff', 0.95, { map: fabricTex() });
    pileMass = mk(new THREE.ConeGeometry(1, 1, 48, 6), M.mass, P.x, 0, P.z); pileMass.userData.pile = true; scene.add(pileMass); occluders.push(pileMass);
    const COUNT = 1600, { heads, body } = DOLL;
    headsIM = heads.map(h => { const im = new THREE.InstancedMesh(h, HEAD_MAT(), Math.ceil(COUNT / heads.length)); im.castShadow = im.receiveShadow = true; scene.add(im); return im; });
    bodiesIM = new THREE.InstancedMesh(body, BODY_MAT(), COUNT); bodiesIM.castShadow = bodiesIM.receiveShadow = true; scene.add(bodiesIM);
    const col = new THREE.Color();
    for (let i = 0; i < COUNT; i++) {
      dollSlots.push({ u: Math.random() * Math.PI * 2, v: Math.sqrt(Math.random()), lay: new THREE.Euler(rnd(-1.6, 1.6), rnd(0, 6.28), rnd(-1.6, 1.6)), s: rnd(0.9, 1.35), up: rnd(0, 0.08), head: i % heads.length, hi: Math.floor(i / heads.length) });
      bodiesIM.setColorAt(i, col.set(DRESS[i % DRESS.length]).offsetHSL(0, -0.1, rnd(-0.08, 0.04)));
    }
    bodiesIM.instanceColor.needsUpdate = true;
    discardHeads = new THREE.InstancedMesh(heads[0], HEAD_MAT(), 1500); discardBodies = new THREE.InstancedMesh(body, BODY_MAT(), 1500);
    [discardHeads, discardBodies].forEach(im => { im.count = 0; im.castShadow = im.receiveShadow = true; scene.add(im); });
    for (let i = 0; i < 1500; i++) discardBodies.setColorAt(i, col.set(DRESS[(i * 7) % DRESS.length]));
    for (let i = 0; i < 14; i++) { const g = dollGroup(i); g.visible = false; scene.add(g); fliers.push({ g, t: 0, on: false }); }
  }
  function dollGroup(i, scale) { const g = new THREE.Group(); g.add(new THREE.Mesh(DOLL.heads[i % 4], HEAD_MAT()), new THREE.Mesh(DOLL.body, new THREE.MeshStandardMaterial({ color: DRESS[i % DRESS.length], roughness: 0.95, side: THREE.DoubleSide, vertexColors: true }))); g.children.forEach(c => c.castShadow = true); if (scale) g.scale.setScalar(scale); return g; }
  // dolls sitting on shelves and in small heaps: they stare, and some of them wake up
  function buildDecorDolls() {
    const spots = [];
    [-1, 1].forEach(sd => { for (let z = -6; z < 13.5; z += 0.32) [0.48, 1.03].forEach(y => { if (Math.random() < 0.8) spots.push({ x: sd * 10.4, y, z, ry: -sd * Math.PI / 2 + rnd(-0.3, 0.3), s: rnd(0.9, 1.2) }); }); });
    for (let i = 0; i < 160; i++) { const a = rnd(0, 6.28), r = Math.sqrt(Math.random()) * 1.8; spots.push({ x: -5.5 + Math.cos(a) * r, y: Math.max(0, 0.9 * (1 - r / 1.8)) * Math.random(), z: -15.5 + Math.sin(a) * r, ry: rnd(0, 6.28), s: rnd(0.7, 1.0), lay: true }); }
    for (let i = 0; i < 40; i++) spots.push({ x: -8.2 + (i % 20) * 0.32, y: 1.75 + Math.floor(i / 20) * 0.5, z: -29.4, ry: 0, s: 1.1 });
    // chapel congregation on the pews, theatre audience in rows
    for (let r = 0; r < 4; r++) for (let k = 0; k < 9; k++) { const x = (k < 4 ? -6.6 : 1.6) + (k % 4) * 0.9 + rnd(-0.1, 0.1); if (Math.random() < 0.85) spots.push({ x, y: 0.5, z: -33 - r * 1.8, ry: Math.PI + rnd(-0.2, 0.2), s: rnd(1.0, 1.25) }); }
    for (let r = 0; r < 5; r++) for (let k = 0; k < 14; k++) { if (Math.random() < 0.8) spots.push({ x: -6.5 + k, y: 0.48, z: -57 - r * 1.3, ry: Math.PI + rnd(-0.15, 0.15), s: rnd(0.9, 1.15) }); }
    if (FX.chairDoll) spots.push({ x: FX.chairDoll.x, y: FX.chairDoll.y, z: FX.chairDoll.z, ry: FX.chairDoll.ry, s: 2.2, chair: true });
    const heads = new THREE.InstancedMesh(DOLL.heads[2], HEAD_MAT(), spots.length), bodies = new THREE.InstancedMesh(DOLL.body, BODY_MAT(), spots.length);
    const col = new THREE.Color();
    spots.forEach((sp, i) => {
      if (sp.lay) _q.setFromEuler(_e.set(rnd(-1.5, 1.5), sp.ry, rnd(-1.5, 1.5))); else _q.setFromEuler(_e.set(rnd(-0.1, 0.1), sp.ry, rnd(-0.15, 0.15)));
      _m.compose(_p.set(sp.x, sp.y, sp.z), _q, _s.setScalar(sp.s)); heads.setMatrixAt(i, _m); bodies.setMatrixAt(i, _m); bodies.setColorAt(i, col.set(DRESS[i % DRESS.length]));
      sp.head = new THREE.Vector3(0, 0.345, 0.073).applyMatrix4(_m); sp.room = (DD.ROOMS.find(r => sp.z <= r.z[1] && sp.z >= r.z[0]) || DD.ROOMS[1]).id;
    });
    [heads, bodies].forEach(im => { im.castShadow = im.receiveShadow = true; scene.add(im); });
    decorSpots = spots.filter(s => !s.lay || Math.random() < 0.3);
  }
  function layoutPile(f, faceTo) {
    const P = Sim.PILE_POS, k = Math.cbrt(Math.max(0.0005, f)), R = Math.max(0.5, PILE_R * k), H = Math.max(0.15, PILE_H * k);
    pileMass.scale.set(R, H, R); pileMass.position.y = H / 2;
    const show = Math.min(dollSlots.length, Math.floor(dollSlots.length * Math.min(1, 0.15 + f * 0.85)));
    dollSlots.forEach((d, i) => {
      const vis = i < show, v = d.v, r = R * v, y = H * (1 - v);
      _p.set(P.x + Math.cos(d.u) * r, y + d.up, P.z + Math.sin(d.u) * r);
      if (faceTo) { _q.setFromEuler(_e.set(0, Math.atan2(faceTo.x - _p.x, faceTo.z - _p.z), 0)); } else _q.setFromEuler(d.lay);
      _s.setScalar(vis ? d.s : 0.0001); _m.compose(_p, _q, _s); bodiesIM.setMatrixAt(i, _m); headsIM[d.head].setMatrixAt(d.hi, _m);
    });
    bodiesIM.instanceMatrix.needsUpdate = true; headsIM.forEach(im => { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); }); bodiesIM.computeBoundingSphere();
  }
  function addDiscard() {
    if (discardCount >= 1500) return;
    const i = discardCount++, a = Math.random() * 6.28, rr = Math.sqrt(Math.random()) * Math.min(2.6, 0.6 + discardCount / 500), h = Math.max(0, 1.2 * (1 - rr / 2.6)) * Math.min(1, discardCount / 900);
    _p.set(7.6 + Math.cos(a) * rr * 0.5, h * Math.random() + 0.05, 9.5 + Math.sin(a) * rr); _q.setFromEuler(_e.set(rnd(-1.6, 1.6), rnd(0, 6.28), rnd(-1.6, 1.6))); _s.setScalar(rnd(0.9, 1.3));
    _m.compose(_p, _q, _s); discardHeads.setMatrixAt(i, _m); discardBodies.setMatrixAt(i, _m);
    discardHeads.count = discardBodies.count = discardCount; discardHeads.instanceMatrix.needsUpdate = discardBodies.instanceMatrix.needsUpdate = true;
  }
  function launchDoll(auto) {
    if (auto && H.puppet && helperThrow()) return;
    const f = fliers.find(x => !x.on); if (!f) return; f.slide = false; f.sink = false;
    const P = Sim.PILE_POS, a = Math.atan2(camera.position.z - P.z, camera.position.x - P.x) + rnd(-0.5, 0.5);
    const R = pileMass.scale.x * 0.6, Hy = pileMass.scale.y * 0.4;
    f.from = new THREE.Vector3(P.x + Math.cos(a) * R, Hy, P.z + Math.sin(a) * R); f.to = new THREE.Vector3(7.6 + rnd(-0.6, 0.6), 0.3, 9.5 + rnd(-1.5, 1.5));
    f.t = 0; f.on = true; f.g.visible = true; f.spin = new THREE.Vector3(rnd(-8, 8), rnd(-8, 8), rnd(-8, 8));
    if (settings.blood && Math.random() < 0.18) addBlood(f.from.x + rnd(-0.6, 0.6), f.from.z + rnd(-0.6, 0.6), rnd(0.3, 0.8));
  }
  function addBlood(x, z, s) {
    if (!settings.blood) return null;
    let b = bloodPool[bloodIdx % 90]; bloodIdx++;
    if (!b) { b = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: M.blood, transparent: true, roughness: 0.25, metalness: 0.1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); b.rotation.x = -Math.PI / 2; b.receiveShadow = true; scene.add(b); bloodPool.push(b); }
    b.position.set(x, 0.006 + (bloodIdx % 7) * 0.0005, z); b.rotation.z = Math.random() * 6.28; b.scale.setScalar(s); b.visible = true; return b;
  }

  // ---------- Mother ----------
  function buildMother() {
    // mother (position + facing) → rig (pose: standing, crawling on the ceiling, on the wall, hanging, on the floor)
    mother = new THREE.Group(); const rig = new THREE.Group(); mother.add(rig);
    const porcelain = std('#e2d8cc', 0.35), dress = std('#ffffff', 0.9, { map: dressTex(settings.blood) }), stock = std('#151012', 0.8), hair = std('#0c0a0a', 0.7);
    M.face = std('#ffffff', 0.35, { map: faceTex(settings.blood), transparent: true, alphaTest: 0.05 }); M.porcelain = porcelain;
    const legs = [-0.1, 0.1].map(x => { const g = new THREE.Group(); g.position.set(x, 0.78, 0); g.add(mk(new THREE.CylinderGeometry(0.06, 0.05, 0.75, 8), stock, 0, -0.39, 0)); g.add(mk(new THREE.BoxGeometry(0.08, 0.05, 0.16), stock, 0, -0.76, 0.04)); rig.add(g); return g; });
    const skirt = mk(new THREE.CylinderGeometry(0.2, 0.44, 0.85, 14, 3, true), dress, 0, 1.0, 0); skirt.material.side = THREE.DoubleSide; rig.add(skirt);
    rig.add(mk(new THREE.CylinderGeometry(0.17, 0.2, 0.5, 12), dress, 0, 1.6, 0), mk(new THREE.CylinderGeometry(0.045, 0.05, 0.14, 8), porcelain, 0, 1.9, 0));
    motherHead = makeHead(porcelain, hair, 0.16); motherHead.position.set(0, 2.08, 0); rig.add(motherHead);
    const arm = sd => { const g = new THREE.Group(); g.position.set(sd * 0.22, 1.8, 0); g.add(mk(new THREE.CylinderGeometry(0.045, 0.035, 0.9, 8), dress, 0, -0.45, 0)); g.add(mk(new THREE.BoxGeometry(0.07, 0.16, 0.04), settings.blood ? std('#7a1010', 0.3) : porcelain, 0, -0.95, 0)); for (let i = 0; i < 4; i++) g.add(mk(new THREE.CylinderGeometry(0.008, 0.006, 0.2, 4), porcelain, -0.025 + i * 0.017, -1.12, 0)); rig.add(g); return g; };
    mother.userData = { rig, arms: [arm(-1), arm(1)], legs, mode: 'stand', unseen: 0, twitch: 0 };
    mother.traverse(o => { if (o.isMesh) o.castShadow = true; });
    scene.add(mother);
  }
  // where her body is for a pose (relative to her sim position), and how the rig is turned
  const MODES = {
    stand:   { y: () => 0, rot: [0, 0, 0], off: 0 },
    ceiling: { y: x => roofY(x) - 0.3, rot: [Math.PI / 2, Math.PI, 0], off: -1.0 },   // belly to the roof, face up, head twisted to look down
    wall:    { y: x => roofY(x) - 0.35, rot: [Math.PI / 2, Math.PI, 0], off: -1.0 },
    hang:    { y: x => roofY(x) - 0.05, rot: [0, 0, Math.PI], off: 0 },                // feet on the beam, head down
    floor:   { y: () => 0.32, rot: [Math.PI / 2, 0, 0], off: -1.0 }                     // face down on all fours, head up
  };
  function motherPose(mode, t, dt, moving, sees) {
    const U = mother.userData, rig = U.rig, m = MODES[mode] || MODES.stand, [l, r] = U.arms;
    if (mode === 'wall') mother.position.x = (Math.sign(mother.position.x) || 1) * 6.3;
    if (mode === 'ceiling') mother.position.x = Math.max(-3.5, Math.min(3.5, mother.position.x));
    mother.position.y = m.y(mother.position.x) - (mode === 'wall' ? 0.15 : 0);
    rig.rotation.set(m.rot[0], m.rot[1], m.rot[2]); rig.position.set(0, 0, m.off);
    if (moving) U.ph = (U.ph || 0) + dt * 9;   // limbs move only while she moves (and she moves only while unseen)
    const ph = U.ph || 0;
    if (mode === 'ceiling' || mode === 'wall' || mode === 'floor') {
      // spider-splayed: limbs out to the sides, bent toward the surface she clings to
      l.rotation.set(-0.8, 0, -(1.25 + Math.sin(ph) * 0.45)); r.rotation.set(-0.8, 0, 1.25 - Math.sin(ph) * 0.45);
      U.legs[0].rotation.set(-0.7, 0, -(0.95 + Math.cos(ph) * 0.4)); U.legs[1].rotation.set(-0.7, 0, 0.95 - Math.cos(ph) * 0.4);
      if (mode === 'floor') motherHead.rotation.set(-1.1, 0, Math.sin(ph * 0.5) * 0.3);
      else motherHead.rotation.set(0, Math.PI, Math.sin(ph * 0.5) * 0.4);   // head twisted all the way round to look down at you
    } else if (mode === 'hang') {
      l.rotation.set(0, 0, 0.25 + Math.sin(t * 0.7) * 0.05); r.rotation.set(0, 0, -0.25); U.legs.forEach(g => g.rotation.set(0, 0, 0));
      motherHead.rotation.set(0.3, 0, Math.sin(t * 0.5) * 0.15);
    } else { U.legs.forEach(g => g.rotation.set(0, 0, 0)); if (U.headBase) motherHead.rotation.copy(U.headBase); }
    // watched, she cannot move, but she twitches: a jerk of the head that cracks like a knuckle
    if (sees) {
      U.twitch -= dt; if (U.twitch <= 0) { U.twitch = 0.9 + Math.random() * 2.2; U.jerk = { a: rnd(-0.9, 0.9), b: rnd(-0.4, 0.4), t: 0 }; U.didTwitch = true; }
    }
    if (U.jerk) { U.jerk.t += dt; const k = Math.max(0, 1 - U.jerk.t * 3); motherHead.rotation.z += U.jerk.a * k; motherHead.rotation.x += U.jerk.b * k; if (k <= 0) U.jerk = null; }
  }
  function makeHead(porcelain, hair, r) {
    const h = new THREE.Group();
    const head = mk(new THREE.SphereGeometry(r, 24, 18), porcelain, 0, 0, 0); head.scale.set(1, 1.12, 1); h.add(head);
    const face = mk(new THREE.SphereGeometry(r * 1.02, 24, 18, Math.PI * 0.2, Math.PI * 0.6, Math.PI * 0.18, Math.PI * 0.62), M.face, 0, 0, 0, false, true); face.scale.set(1, 1.12, 1); face.userData.face = true; h.add(face);
    h.add(mk(new THREE.SphereGeometry(r * 1.06, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, r * 0.12, -r * 0.2));
    for (let i = 0; i < 9; i++) { const s = mk(new THREE.BoxGeometry(r * 0.3, rnd(3, 4.7) * r, r * 0.12), hair, -r * 0.9 + i * r * 0.22, -r * 1.9, -r * 0.6 - Math.abs(i - 4) * 0.05 * r); s.rotation.x = 0.12; h.add(s); }
    [-0.34, 0.34].forEach(x => h.add(mk(new THREE.SphereGeometry(r * 0.075, 6, 6), new THREE.MeshStandardMaterial({ color: '#300', emissive: '#ff2010', emissiveIntensity: 0.6 }), x * r, r * 0.12, r * 0.94, false, false)));
    return h;
  }
  function newPose() {
    const [l, r] = mother.userData.arms;
    l.rotation.set(rnd(-1.2, 0.2), 0, rnd(-0.1, 0.5)); r.rotation.set(rnd(-1.2, 0.2), 0, rnd(-0.5, 0.1));
    motherHead.rotation.set(rnd(-0.2, 0.35), rnd(-0.4, 0.4), rnd(-0.6, 0.6)); mother.userData.headBase = motherHead.rotation.clone();
  }

  // ---------- scare visuals ----------
  function buildScareFX() {
    // glowing eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: '#ff2a10' });
    FX.eyes = new THREE.Group(); [-0.03, 0.03].forEach(x => FX.eyes.add(mk(new THREE.SphereGeometry(0.018, 6, 6), eyeMat, x, 0, 0, false, false)));
    FX.eyesLight = new THREE.PointLight('#ff2010', 0, 2.2, 2); FX.eyes.add(FX.eyesLight); FX.eyes.visible = false; scene.add(FX.eyes);
    // ceiling crawler: pale, too many joints, a doll head on backwards
    const pale = std('#d8d0c8', 0.6), dark = std('#3a2a2a', 0.8);
    const c = new THREE.Group(), body = new THREE.Group(); c.add(body);
    body.add(mk(new THREE.CapsuleGeometry(0.14, 0.7, 4, 8), pale, 0, 0, 0)); body.children[0].rotation.x = Math.PI / 2;
    const ch = makeHead(pale, std('#0c0a0a', 0.7), 0.13); ch.position.set(0, -0.05, 0.55); ch.rotation.set(Math.PI, 0, Math.PI); body.add(ch); FX.crawlerHead = ch;
    FX.limbs = [];
    [[-1, 0.3], [1, 0.3], [-1, -0.3], [1, -0.3]].forEach(([sd, z]) => {
      const up = new THREE.Group(); up.position.set(sd * 0.12, 0, z); const u = mk(new THREE.CylinderGeometry(0.03, 0.025, 0.65, 6), pale, 0, -0.32, 0); up.add(u);
      const low = new THREE.Group(); low.position.y = -0.64; low.add(mk(new THREE.CylinderGeometry(0.025, 0.015, 0.7, 6), pale, 0, -0.35, 0)); low.add(mk(new THREE.BoxGeometry(0.06, 0.03, 0.12), dark, 0, -0.7, 0.03)); up.add(low);
      up.userData = { sd, z }; body.add(up); FX.limbs.push({ up, low, sd, z });
    });
    c.visible = false; c.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(c); FX.crawler = c;
    // a hand that comes out of the pile
    const arm = new THREE.Group(); const fore = mk(new THREE.CylinderGeometry(0.04, 0.05, 1.2, 8), std('#cfc4b8', 0.45), 0, 0.6, 0); arm.add(fore);
    const hand = new THREE.Group(); hand.position.y = 1.22; hand.add(mk(new THREE.BoxGeometry(0.09, 0.12, 0.04), std('#cfc4b8', 0.45), 0, 0.05, 0));
    for (let i = 0; i < 4; i++) { const f = new THREE.Group(); f.position.set(-0.033 + i * 0.022, 0.11, 0); f.add(mk(new THREE.CylinderGeometry(0.009, 0.007, 0.12, 4), std('#cfc4b8', 0.45), 0, 0.06, 0)); hand.add(f); }
    arm.add(hand); arm.visible = false; scene.add(arm); FX.hand = arm; FX.handHand = hand;
    // running child
    const child = new THREE.Group(); child.add(mk(new THREE.CylinderGeometry(0.12, 0.2, 0.55, 8), std('#e8e0d0', 0.9), 0, 0.55, 0)); const chh = makeHead(M.porcelain, std('#2a1a10', 0.7), 0.11); chh.position.y = 0.95; child.add(chh);
    [-0.06, 0.06].forEach(x => child.add(mk(new THREE.CylinderGeometry(0.03, 0.03, 0.32, 5), M.porcelain, x, 0.16, 0)));
    child.visible = false; scene.add(child); FX.child = child;
    // apparition: a silhouette that is there for a moment when the light comes back
    const app = new THREE.Group(); app.add(mk(new THREE.CylinderGeometry(0.22, 0.5, 1.8, 10), std('#050404', 1), 0, 0.9, 0)); const aph = makeHead(std('#1a1414', 0.9), std('#000', 1), 0.17); aph.position.y = 2.0; app.add(aph);
    app.visible = false; scene.add(app); FX.app = app;
    // blood drip
    FX.drops = []; for (let i = 0; i < 8; i++) { const d = mk(new THREE.SphereGeometry(0.018, 5, 5), std('#5a0000', 0.15), 0, 0, 0, false, false); d.scale.y = 2.2; d.visible = false; scene.add(d); FX.drops.push({ m: d, y: 0, v: 0 }); }
    // writing
    FX.writing = mk(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshStandardMaterial({ transparent: true, roughness: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }), 0, 0, 0, false, true); FX.writing.visible = false; scene.add(FX.writing);
    // falling doll
    FX.faller = dollGroup(3, 1.3); FX.faller.visible = false; scene.add(FX.faller);
  }
  // public scare controls -------------------------------------------------
  const S2 = {
    eyesOn(room) {
      const spots = decorSpots.filter(s => !room || room.includes(s.room)); if (!spots.length) return null;
      const sp = spots[Math.floor(Math.random() * spots.length)]; FX.eyes.position.copy(sp.head); FX.eyes.rotation.y = sp.ry; FX.eyes.visible = true; FX.eyesLight.intensity = 0.8; return { x: sp.head.x, y: sp.head.y, z: sp.head.z };
    },
    eyesOff() { FX.eyes.visible = false; FX.eyesLight.intensity = 0; },
    crawlerStart(z0, z1, side) { FX.crawler.visible = true; FX.crawl = { z: z0, z1, side, speed: 2.4, t: 0, freeze: 0 }; },
    crawlerSet(mode) { if (FX.crawl) { if (mode === 'freeze') FX.crawl.freeze = 0.7; if (mode === 'flee') { FX.crawl.speed = 7; FX.crawl.z1 = FX.crawl.z1 > FX.crawl.z ? 40 : -40; } } },
    crawlerPos() { return FX.crawl && FX.crawler.visible ? FX.crawler.position.clone() : null; },
    debug() { return { crawler: FX.crawler.visible ? FX.crawler.position.toArray().map(v => +v.toFixed(2)) : null, hand: FX.hand.visible ? { p: FX.hand.position.toArray().map(v => +v.toFixed(2)), tip: FX.handHand.getWorldPosition(new THREE.Vector3()).toArray().map(v => +v.toFixed(2)) } : null, writing: FX.writing.visible ? FX.writing.position.toArray().map(v => +v.toFixed(2)) : null }; },
    crawlerOff() { FX.crawler.visible = false; FX.crawl = null; },
    handStart(target) { const P = Sim.PILE_POS, a = Math.atan2(target.z - P.z, target.x - P.x), R = pileMass.scale.x, H = pileMass.scale.y, r = R * 0.9; FX.hand.position.set(P.x + Math.cos(a) * r, H * (1 - r / R) + 0.15, P.z + Math.sin(a) * r); FX.hand.lookAt(target.x, 1.25, target.z); FX.hand.rotateX(Math.PI / 2); FX.hand.visible = true; FX.handT = 0; FX.hand.scale.set(1.2, 0.01, 1.2); },
    handOff() { FX.hand.visible = false; FX.handT = null; },
    dripStart(x, z) { FX.drip = { x, z, t: 0, puddle: addBlood(x, z, 0.1) }; },
    dripOff() { FX.drip = null; FX.drops.forEach(d => d.m.visible = false); },
    fall(x, z) { FX.faller.position.set(x, roofY(x) - 0.3, z); FX.faller.visible = true; FX.fallV = 0; FX.faller.rotation.set(rnd(-1, 1), rnd(0, 6), rnd(-1, 1)); },
    lookStart() { lookAtPlayer = 1; layoutPile(Sim.remaining(FX.world) / Sim.PILE, camera.position); },
    lookStop() { lookAtPlayer = 0; layoutPile(Sim.remaining(FX.world) / Sim.PILE); },
    childRun(ax, az, bx, bz) { FX.child.visible = true; FX.run = { a: new THREE.Vector3(ax, 0, az), b: new THREE.Vector3(bx, 0, bz), t: 0 }; },
    apparition(on) { if (!on) { FX.app.visible = false; return; } camera.updateMatrixWorld(); const p = camera.localToWorld(new THREE.Vector3(0, 0, -2.6)); FX.app.position.set(p.x, 0, p.z); FX.app.rotation.y = Math.atan2(camera.position.x - p.x, camera.position.z - p.z); FX.app.visible = true; },
    writing(text) {
      camera.getWorldDirection(_p); ray.set(camera.position, _p); ray.far = 9;
      let hit = ray.intersectObjects(occluders.concat(FX.roofSlabs || []), false)[0];
      if (!hit || !hit.face) { const p = camera.position.clone().addScaledVector(new THREE.Vector3(_p.x, 0, _p.z).normalize(), 2.6); p.y = 0.01; hit = { point: p, face: { normal: new THREE.Vector3(0, 1, 0) }, object: { matrixWorld: new THREE.Matrix4() } }; }
      FX.writing.material.map = writingTex(text, settings.blood); FX.writing.material.needsUpdate = true;
      const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      FX.writing.position.copy(hit.point).addScaledVector(n, 0.02); FX.writing.lookAt(hit.point.clone().add(n)); FX.writing.visible = true; FX.writing.material.opacity = 0; FX.writeT = 0; return true;
    },
    writingOff() { FX.writing.visible = false; FX.writeT = null; },
    forceDark(sec) { FX.dark = sec; },
    flood(sec) { FX.flood = sec; FX.floodMax = sec; if (FX.lever) FX.lever.userData.pull = 0; },
    bloodLens() { if (!settings.blood) return; FX.bloodEl.style.transition = 'none'; FX.bloodEl.style.opacity = 0.75; FX.bloodEl.style.backgroundPosition = `${rnd(0, 100)}% ${rnd(0, 100)}%`; requestAnimationFrame(() => requestAnimationFrame(() => { FX.bloodEl.style.transition = 'opacity 8s ease-in'; FX.bloodEl.style.opacity = 0; })); },
    // Mother right behind you / over you, for the director
    motherAt(x, z, mode) { const W = FX.world.watcher; W.x = x; W.z = z; mother.userData.mode = mode || 'stand'; mother.userData.unseen = -8; if (mode === 'stand') newPose(); },
    motherMode() { return mother.userData.mode; },
    motherHead() { return mother.userData.headPos ? mother.userData.headPos.clone() : null; }
  };

  // ---------- post-processing ----------
  function setupPost() {
    rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    postMat = new THREE.ShaderMaterial({
      uniforms: { tColor: { value: rt.texture }, time: { value: 0 }, fear: { value: 0 }, hurt: { value: 0 }, black: { value: 0 }, flash: { value: 0 }, glitch: { value: 0 }, res: { value: new THREE.Vector2(1, 1) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D tColor; uniform float time, fear, hurt, black, flash, glitch; uniform vec2 res; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + time * 7.0) * 43758.5453); }
        void main(){
          vec2 uv = vUv;
          if (glitch > 0.0) { float band = step(0.92, fract(sin(floor(uv.y * 40.0) + floor(time * 20.0)) * 999.0)); uv.x += band * (h(vec2(floor(uv.y * 40.0), 1.0)) - 0.5) * 0.08 * glitch; }
          vec2 c = uv - 0.5; float ca = 0.0015 + fear * 0.006 + glitch * 0.01;
          vec3 col = vec3(texture2D(tColor, uv + c * ca).r, texture2D(tColor, uv).g, texture2D(tColor, uv - c * ca).b);
          float l = dot(col, vec3(0.299, 0.587, 0.114));
          col = mix(col, vec3(l), 0.25 + fear * 0.3);
          col *= vec3(0.95, 0.98, 1.05);
          float v = smoothstep(0.85, 0.2 - fear * 0.15, length(c * vec2(1.25, 1.0)));
          col *= mix(0.35, 1.0, v);
          col = mix(col, col * vec3(1.4, 0.25, 0.2) + vec3(0.12, 0.0, 0.0), hurt);
          col += (h(uv * res) - 0.5) * (0.022 + fear * 0.04 + glitch * 0.1);
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
  function setQuality(q) { quality = QUALITY[q] ? q : 'medium'; const s = QUALITY[quality].shadow; flash.shadow.mapSize.set(s, s); if (flash.shadow.map) { flash.shadow.map.dispose(); flash.shadow.map = null; } resize(); }

  // ---------- visibility: is a point in view, not blocked, and lit? ----------
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), frustum = new THREE.Frustum(), pm = new THREE.Matrix4();
  let lightsRef = null, flashWide = 0;
  function inView(pts, maxDist) {
    camera.updateMatrixWorld(); pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(pm);
    for (const p of pts) {
      if (!frustum.containsPoint(p) || p.distanceTo(camera.position) > maxDist) continue;
      _a.copy(camera.position); _b.copy(p).sub(_a); const len = _b.length(); ray.set(_a, _b.normalize()); ray.far = len - 0.3;
      if (!ray.intersectObjects(occluders, false).length) return true;
    }
    return false;
  }
  function litAt(p, player) {
    const d = p.distanceTo(camera.position);
    if (d < 2.0 || FX.flood > 0) return true;
    if (player.light && flash.intensity > 1) { camera.getWorldDirection(_a); _b.copy(p).sub(camera.position).normalize(); if (_a.angleTo(_b) < 0.42 + flashWide && d < 16) return true; }
    return lightsRef ? lightsRef.litAt(p.x, p.z) : false;
  }
  function visible(x, y, z, player) { const p = new THREE.Vector3(x, y, z); return inView([p], 20) && litAt(p, player); }

  // ---------- init / update ----------
  function init(container, opts) {
    host = container; Object.assign(settings, opts.settings || {}); quality = opts.quality || 'medium';
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
    host.prepend(renderer.domElement); renderer.domElement.id = 'view';
    FX.faceEl = horrorFace(settings.blood); FX.faceEl.id = 'scareFace'; host.appendChild(FX.faceEl);
    FX.bloodEl = document.createElement('div'); FX.bloodEl.id = 'bloodScreen'; host.appendChild(FX.bloodEl);
    scene = new THREE.Scene(); scene.background = new THREE.Color('#020203'); scene.fog = new THREE.FogExp2('#040406', 0.06);
    camera = new THREE.PerspectiveCamera(72, 1, 0.05, 90); camera.rotation.order = 'YXZ'; scene.add(camera);
    hemi = new THREE.HemisphereLight('#4a5470', '#1a120c', 0.3); hemi.userData.base = 0.3; scene.add(hemi);
    const moon1 = new THREE.DirectionalLight('#8aa8e0', 0.5); moon1.position.set(0, 4.5, Sim.ATTIC.minZ - 3); moon1.target.position.set(0, 0, Sim.ATTIC.minZ + 6); scene.add(moon1, moon1.target);
    const moon2 = new THREE.SpotLight('#8aa8e0', 6, 9, 0.35, 0.7, 1.5); moon2.position.set(1.4, 5.8, 10); moon2.target.position.set(2.9, 0, 10); scene.add(moon2, moon2.target);
    flash = new THREE.SpotLight('#eef2ff', 40, 18, 0.46, 0.55, 2); flash.castShadow = true; flash.shadow.camera.near = 0.2; flash.shadow.bias = -0.0005;
    flashTarget = new THREE.Object3D(); camera.add(flash, flashTarget); flash.position.set(0.18, -0.15, 0.05); flashTarget.position.set(0, 0, -5); flash.target = flashTarget;
    const P = Sim.PILE_POS;
    for (let i = 0; i < 8; i++) { const a = (i / 8 + 0.25) * Math.PI * 2, x = P.x + Math.cos(a) * 7.6, z = P.z + Math.sin(a) * 7.6; const pl = new THREE.PointLight('#ffb050', 0, 5, 2); pl.position.set(x, 0.5, z); const c = mk(new THREE.CylinderGeometry(0.04, 0.045, 0.22, 8), std('#e8dcc0', 0.6), x, 0.11, z); const fl = mk(new THREE.ConeGeometry(0.025, 0.06, 6), new THREE.MeshBasicMaterial({ color: '#ffd080' }), x, 0.26, z, false, false); c.visible = fl.visible = false; scene.add(pl, c, fl); candleLights.push({ pl, c, fl, x, z }); }
    lantern = new THREE.PointLight('#ffc070', 0, 13, 1.6); lantern.position.set(P.x, 4.9, P.z); scene.add(lantern);
    const lamp = mk(new THREE.CylinderGeometry(0.1, 0.13, 0.28, 10), std('#4a3a20', 0.4, { metalness: 0.6 }), P.x, 4.95, P.z); lamp.visible = false; scene.add(lamp); lantern.userData.mesh = lamp;
    [[0, 21], [0, -13.5], [0, -24.5], [0, -36], [0, -48], [0, -60], [0, -73]].forEach(([x, z]) => { const l = new THREE.PointLight('#ffc890', 0, 11, 1.6); l.position.set(x, 3.2, z); scene.add(l); roomLights.push({ l, x, z }); });
    M.blood = bloodTex();
    buildAttic(); buildGates(); buildProps(); buildPile(); buildItems(); buildDecorDolls(); buildMother(); newPose(); buildHelpers(); buildScareFX(); setupPost();
    mirror = mk(new THREE.PlaneGeometry(0.9, 1.3), std('#9aa8b0', 0.05, { metalness: 0.95 }), P.x - 2.6, 4.0, P.z + 4.6); mirror.rotation.x = -0.4; mirror.visible = false; scene.add(mirror);
    resize(); new ResizeObserver(resize).observe(host); setQuality(quality);
  }
  function setSettings(s) {
    const bloodChanged = s.blood !== settings.blood; Object.assign(settings, s);
    if (bloodChanged) { const nf = horrorFace(settings.blood); nf.id = 'scareFace'; FX.faceEl.replaceWith(nf); FX.faceEl = nf; M.face.map = faceTex(settings.blood); M.face.needsUpdate = true; bloodPool.forEach(b => b.visible = settings.blood && b.visible); }
  }

  function update(world, player, t, dt) {
    FX.world = world;
    const st = Sim.stats(world); flashWide = st.wide;
    camera.position.set(player.x, EYE + (player.bob || 0), player.z); camera.rotation.set(player.pitch, player.yaw, 0);
    const dark = FX.dark > 0; if (dark) FX.dark -= dt;
    const flood = FX.flood > 0 ? FX.flood / FX.floodMax : 0; if (FX.flood > 0) FX.flood -= dt;
    hemi.intensity = hemi.userData.base + flood * 9; FX.bulbMat.color.set(flood > 0 ? '#fff6d8' : '#2a2418');
    { const lv = FX.lever.userData; if (lv.pull != null) { lv.pull += dt; lv.arm.rotation.x = lv.pull < 0.15 ? -0.6 + lv.pull / 0.15 * 1.8 : 1.2 - Math.min(1, (lv.pull - 0.6) / 0.8) * 1.8 * (lv.pull > 0.6 ? 1 : 0); if (lv.pull > 1.4) { lv.pull = null; lv.arm.rotation.x = -0.6; } } lv.lamp.material.color.set(world.time < world.leverReady ? '#ff2a10' : '#30ff40'); }
    flash.visible = player.light && !dark; flash.angle = 0.46 + st.wide; flash.intensity = player.light && !dark ? 38 * (0.75 + 0.25 * Math.min(1, player.battery * 3)) * (world.watcher.lunge ? (Math.random() < 0.45 ? 0.05 : 1) : player.battery < 0.15 ? (Math.random() < 0.15 ? 0.2 : 1) : 1) : 0;
    moveAvatars(dt, t);
    stepItems(world, t);
    stepHelpers(world, t, dt);
    // gates follow progress
    FX.gatesInitT = (FX.gatesInitT || 0) + dt; if (FX.gatesInitT > 0.5) FX.gatesInit = true;
    gates.forEach((g, i) => { if (Sim.gateOpen(world, g.userData.wall) && !g.userData.open) openGate(g, world.time < 1 || !FX.gatesInit); if (g.userData.fall != null) { g.userData.fall += dt; g.children.forEach((c, k) => { c.position.y -= dt * (2 + k); c.rotation.z += dt * (k % 2 ? 2 : -2); }); if (g.userData.fall > 1.2) { g.visible = false; g.userData.fall = null; } } });
    const f = Sim.remaining(world) / Sim.PILE; if ((Math.abs(f - lastPileF) > 0.002 || lastPileF < 0) && !lookAtPlayer) { layoutPile(f); lastPileF = f; }
    const nc = Math.max(1, Math.min(8, Math.ceil(Sim.lv(world, 'candles') * 0.8)));   // one stub candle burns from the start
    candleLights.forEach((c, i) => { const on = i < nc && !dark; c.c.visible = i < nc; c.fl.visible = on; c.pl.intensity = on ? 2.4 * (0.85 + Math.sin(t * 13 + i * 3) * 0.1 + Math.random() * 0.05) : 0; c.fl.scale.y = 0.9 + Math.sin(t * 17 + i) * 0.2; });
    const hasLantern = Sim.lv(world, 'lantern') > 0; lantern.intensity = hasLantern && !dark ? 10 * (0.95 + Math.sin(t * 2.3) * 0.05) : 0; lantern.userData.mesh.visible = hasLantern;
    const nr = st.rooms ? 1 + st.rooms * 2 : 0; roomLights.forEach((r, i) => { r.l.intensity = i < nr && !dark ? 7 * (0.9 + Math.sin(t * 3 + i) * 0.05) : 0; });
    mirror.visible = Sim.lv(world, 'mirror') > 0;
    lightsRef = { litAt(x, z) {
      const d = Math.hypot(x - Sim.PILE_POS.x, z - Sim.PILE_POS.z);
      if (dark) return false;
      if (hasLantern && d < 10) return true;
      if (nc > 0 && d < 7.6 + 1.6) return true;
      if (roomLights.some((r, i) => i < nr && Math.hypot(x - r.x, z - r.z) < 7)) return true;
      return FX.moonPatches.some(m => Math.hypot(x - m.x, z - m.z) < m.r);
    } };
    // Mother: she goes where the sim says, but how she gets there is up to her: across the roof, down the wall, on all fours
    const W = world.watcher, U = mother.userData;
    const dist0 = Math.hypot(W.x - player.x, W.z - player.z);
    U.modeT = (U.modeT || 0) - dt;
    let want = U.mode;
    if (W.stun > 0 || W.broken > 0) want = 'floor';                 // the light knocked her down / she is in pieces
    else if (W.recoil > 0 || W.grab) want = 'stand';
    else if (W.moving) {
      if (dist0 < 2.2) want = 'stand'; else if (dist0 < 4.5) want = 'floor';
      else if (U.modeT <= 0 || U.mode === 'hang' || (W.chase && U.mode === 'stand')) { want = W.chase ? (Math.abs(W.x) > 5.5 ? 'wall' : Math.random() < 0.6 ? 'ceiling' : 'floor') : ['ceiling', 'ceiling', 'wall', 'wall', 'ceiling', 'floor', 'stand'][Math.floor(Math.random() * 7)]; U.modeT = 6 + Math.random() * 8; }
    } else if (!U.lastSees && U.modeT <= 0) { want = ['stand', 'hang', 'ceiling', 'hang'][Math.floor(Math.random() * 4)]; U.modeT = 8 + Math.random() * 8; }
    const forced = W.stun > 0 || W.broken > 0 || W.recoil > 0 || W.grab || dist0 < 4.5;
    if (want !== U.mode && (!U.lastSees || forced)) { U.mode = want; U.changed = true; if (want === 'stand') newPose(); }
    mother.position.set(W.x, 0, W.z);
    if (W.moving && U.mode === 'stand') { poseT += dt; if (poseT > 0.35) { newPose(); poseT = 0; } }
    const faceYaw = W.chase || dist0 < 5 || !W.moving || W.heading == null ? Math.atan2(player.x - W.x, player.z - W.z) : W.heading;
    mother.rotation.set(0, faceYaw, 0);
    motherPose(U.mode, t, dt, W.moving, U.lastSees || W.stun > 0);
    mother.updateMatrixWorld(true);
    const hp = motherHead.getWorldPosition(new THREE.Vector3()), bp = U.rig.localToWorld(new THREE.Vector3(0, 1.2, 0)), fp = U.rig.localToWorld(new THREE.Vector3(0, 0.4, 0));
    const mpts = [hp, bp, fp], inV = inView(mpts, 22);
    const sees = inV && (litAt(bp, player) || litAt(hp, player));
    let inBeam = false;
    if (inV && player.light && flash.intensity > 1) { camera.getWorldDirection(_a); for (const q of mpts) { _b.copy(q).sub(camera.position); if (_b.length() < 16 && _a.angleTo(_b.normalize()) < 0.42 + flashWide) { inBeam = true; break; } } }
    U.lastSees = sees; U.headPos = hp;
    // ambient props
    fliers.forEach(fl => { if (!fl.on) return; fl.t += dt * (fl.slide ? 0.9 : 1.6); const k = Math.min(1, fl.t); fl.g.position.lerpVectors(fl.from, fl.to, k); if (!fl.slide) fl.g.position.y += Math.sin(k * Math.PI) * 1.6; else fl.g.rotation.set(-0.6, Math.atan2(fl.to.x - fl.from.x, fl.to.z - fl.from.z), 0); fl.g.rotation.x += fl.spin.x * dt; fl.g.rotation.y += fl.spin.y * dt; if (k >= 1) { fl.on = false; fl.g.visible = false; if (!fl.sink) addDiscard(); } });
    const pos = dust.geometry.attributes.position; for (let i = 0; i < pos.count; i += 9) pos.setY(i, pos.getY(i) + Math.sin(t * 0.3 + i) * 0.0008); pos.needsUpdate = true;
    [FX.rocker, FX.horse].forEach(o => { o.rotation.x = W.moving || FX.crawl ? Math.sin(t * 2.2) * 0.1 : o.rotation.x * 0.98; });
    mobiles.forEach((m, i) => { m.rotation.y += dt * (0.2 + (W.moving ? 1.2 : 0)) * (i % 2 ? 1 : -1); });
    (FX.hanging || []).forEach((h, i) => { h.rotation.z = Math.sin(t * 0.7 + i) * 0.05 + (W.moving ? Math.sin(t * 5 + i) * 0.06 : 0); });
    (FX.hearts || []).forEach(h => { const b = (Math.sin(t * 6 + h.userData.beat) + 1) / 2; h.scale.setScalar(0.85 + b * 0.25); h.material.emissiveIntensity = 0.3 + b * 0.8; });
    // scare animations
    if (FX.crawl) {
      const c = FX.crawl; c.t += dt;
      if (c.freeze > 0) { c.freeze -= dt; FX.crawlerHead.rotation.z = Math.PI + Math.sin(t * 30) * 0.4; }
      else { const dir = Math.sign(c.z1 - c.z); c.z += dir * c.speed * dt; if ((c.z1 - c.z) * dir <= 0 || Math.abs(c.z) > 31) S2.crawlerOff(); }
      if (FX.crawl) {
        const x = c.side * 4.2, y = roofY(x) - 0.22; FX.crawler.position.set(x, y, c.z); FX.crawler.rotation.set(0, c.z1 > c.z ? 0 : Math.PI, Math.PI - c.side * Math.atan2(RIDGE - KNEE, HALF));
        FX.limbs.forEach((l, i) => { const ph = t * 12 * (c.freeze > 0 ? 0 : 1) + i * Math.PI / 2; l.up.rotation.set(Math.sin(ph) * 0.6, 0, l.sd * 1.1); l.low.rotation.set(0, 0, -l.sd * (1.6 + Math.cos(ph) * 0.4)); });
      }
    }
    if (FX.handT != null) {
      FX.handT += dt; const k = FX.handT;
      FX.hand.scale.y = k < 1.4 ? Math.min(0.55, k * 0.4) + Math.sin(t * 40) * 0.03 : Math.min(1.6, 0.55 + (k - 1.4) * 6);
      FX.handHand.children.slice(1).forEach((f, i) => f.rotation.x = k < 1.6 ? Math.sin(t * 8 + i) * 0.4 : -1.4);
    }
    if (FX.drip) {
      const dp = FX.drip; dp.t += dt; const top = roofY(dp.x) - 0.1;
      FX.drops.forEach((d, i) => { if (!d.m.visible && Math.random() < dt * 1.5) { d.m.visible = true; d.y = top; d.v = 0; d.m.position.set(dp.x + rnd(-0.03, 0.03), d.y, dp.z + rnd(-0.03, 0.03)); } if (d.m.visible) { d.v += 9.8 * dt; d.y -= d.v * dt; d.m.position.y = d.y; if (d.y < 0.02) { d.m.visible = false; if (dp.puddle) dp.puddle.scale.setScalar(Math.min(1.2, dp.puddle.scale.x + 0.02)); dp.splash = true; } } });
    }
    if (FX.faller.visible) { FX.fallV += 9.8 * dt; FX.faller.position.y -= FX.fallV * dt; if (FX.faller.position.y < 0.05) { FX.faller.position.y = 0.05; FX.fallV = 0; FX.landed = true; FX.faller.rotation.set(Math.PI / 2, FX.faller.rotation.y, 0); setTimeout(() => { FX.faller.visible = false; }, 9000); } }
    if (FX.run) { FX.run.t += dt * 0.45; const k = FX.run.t; FX.child.position.lerpVectors(FX.run.a, FX.run.b, k); FX.child.rotation.y = Math.atan2(FX.run.b.x - FX.run.a.x, FX.run.b.z - FX.run.a.z); FX.child.position.y = Math.abs(Math.sin(t * 14)) * 0.06; if (k >= 1) { FX.child.visible = false; FX.run = null; } }
    if (FX.writeT != null) { FX.writeT += dt; FX.writing.material.opacity = Math.min(0.95, FX.writeT * 0.6) * (FX.writeT > 14 ? Math.max(0, 1 - (FX.writeT - 14) / 3) : 1); if (FX.writeT > 17) S2.writingOff(); }
    if (lookAtPlayer) { lookAtPlayer += dt; if (lookAtPlayer > 0.5) { layoutPile(f, camera.position); lookAtPlayer = 1; } }
    // jumpscare animation
    let hurt = 0, black = 0, fl = 0, glitch = dark ? 0.6 : 0;
    if (jump) {
      jump.t += dt; const k = jump.t;
      if (jump.scare) {
        const head = jump.head; head.visible = k < 1.0;
        camera.updateMatrixWorld(); const d = Math.max(0.3, 1.4 - k * 4.5);
        head.position.copy(camera.localToWorld(new THREE.Vector3((Math.random() - 0.5) * 0.04 * k * 4, -0.04, -d))); head.quaternion.copy(camera.quaternion); head.rotateZ(Math.sin(k * 40) * 0.08);
        const shake = Math.max(0, 1 - k * 0.8); camera.rotation.z = (Math.random() - 0.5) * 0.22 * shake; camera.rotation.x += (Math.random() - 0.5) * 0.12 * shake; camera.rotation.y += (Math.random() - 0.5) * 0.12 * shake;
        const faceOn = k < 0.1 || (k > 0.42 && k < 0.47) || (k > 0.7 && k < 0.73) || (jump.fatal && k > 0.95 && k < 1.25);
        FX.faceEl.style.opacity = faceOn ? 1 : 0; FX.faceEl.style.transform = `translate(-50%,-50%) scale(${(1.1 + k * 0.9) * (faceOn ? 1 + Math.random() * 0.06 : 1)}) rotate(${(Math.random() - 0.5) * 6}deg)`;
        if (settings.blood && k > 0.05 && !jump.bled) { jump.bled = true; FX.bloodEl.style.transition = 'none'; FX.bloodEl.style.opacity = 1; FX.bloodEl.style.backgroundPosition = `${rnd(0, 100)}% ${rnd(0, 100)}%`; }
        hurt = Math.min(1, k * 2) * jump.hurt; fl = settings.flashes && k < 0.12 ? 0.6 : 0; glitch = Math.max(glitch, k < 0.8 ? 1 : 0);
        black = jump.fatal && k > 0.9 ? Math.min(1, (k - 0.9) * 2.5) : 0;
      } else black = jump.fatal ? Math.min(1, k * 1.5) : Math.sin(Math.min(1, k) * Math.PI) * 0.6;
      if (k > (jump.fatal ? 2.2 : 1.1)) { if (jump.head) scene.remove(jump.head); FX.faceEl.style.opacity = 0; if (jump.bled) { FX.bloodEl.style.transition = 'opacity 6s ease-in'; FX.bloodEl.style.opacity = 0; } const cb = jump.done; jump = null; cb && cb(); }
    }
    const dist = Math.hypot(W.x - player.x, W.z - player.z);
    const fear = Math.min(1, (W.active ? Math.max(0, 1 - dist / 10) * 0.8 + W.wake * 0.35 : 0) + (FX.crawl || FX.handT != null || FX.eyes.visible ? 0.25 : 0));
    postMat.uniforms.time.value = t; postMat.uniforms.fear.value = fear; postMat.uniforms.hurt.value = Math.max(hurt, player.stun > 0 ? 0.4 * player.stun / 4 : 0, player.daze > 0 ? 0.25 : 0);
    postMat.uniforms.black.value = Math.max(black, player.stun > 0 ? Math.min(1, player.stun / 2) * 0.85 : 0); postMat.uniforms.flash.value = Math.max(fl, flood > 0.6 ? (settings.flashes ? 0.55 : 0.15) * (flood - 0.6) / 0.4 : 0); postMat.uniforms.glitch.value = glitch;
    renderer.setRenderTarget(rt); renderer.render(scene, camera); renderer.setRenderTarget(null); renderer.render(postScene, postCam);
    camera.getWorldDirection(_a); ray.set(camera.position, _a); ray.far = 3.6;
    const hit = ray.intersectObjects([pileMass, door, FX.lever].concat(Object.values(items).filter(g => g.visible)), true)[0];
    let target = null; if (hit) { let o = hit.object; while (o && !o.userData.pile && !o.userData.door && !o.userData.lever && !o.userData.item) o = o.parent; if (o) target = o.userData.pile ? 'pile' : o.userData.lever ? 'lever' : o.userData.item ? 'item:' + o.userData.item : 'door'; }
    return { sees, inBeam, motherInView: inV, litAtWatcher: lightsRef.litAt(W.x, W.z), target, fear, dist, bellDir: Math.atan2(W.x - player.x, W.z - player.z) - player.yaw, dripSplash: FX.drip && FX.drip.splash ? (FX.drip.splash = false, true) : false, landed: FX.landed ? (FX.landed = false, true) : false, motherMode: U.mode, motherY: hp.y, twitched: U.didTwitch ? (U.didTwitch = false, true) : false, modeChanged: U.changed ? (U.changed = false, true) : false };
  }
  // kind: 'mother' | 'doll' | 'crawler'; fatal = Mother caught you
  function jumpscare(scare, done, kind, fatal) {
    let head = null;
    if (scare) {
      const src = kind === 'crawler' ? FX.crawlerHead : kind === 'doll' ? null : motherHead;
      if (src) head = src.clone(true); else { head = makeHead(M.porcelain, std('#2a1a10', 0.7), 0.16); }
      head.traverse(o => { if (o.isMesh && o.userData.face) { o.material = M.face.clone(); o.material.emissive = new THREE.Color('#ffffff'); o.material.emissiveMap = M.face.map; o.material.emissiveIntensity = 0.35; } });
      head.rotation.set(0, 0, 0); head.scale.setScalar(kind === 'crawler' ? 1.3 : 1); scene.add(head);
    }
    jump = { t: 0, scare, head, done, fatal: fatal !== false, hurt: fatal === false ? 0.6 : 1 };
  }
  // ---------- what you bought, standing in the attic and doing its job ----------
  const H = {};   // helper visuals by node id
  function line(a, b, mat) { const g = new THREE.BufferGeometry().setFromPoints([a, b]); return new THREE.Line(g, mat); }
  function buildHelpers() {
    const wood = M.wood, dark = std('#2a2018', 0.8, { map: woodTex([1, 1], true) }), iron = std('#2a2826', 0.5, { metalness: 0.7 }), brass = std('#8a7040', 0.35, { metalness: 0.8 }), pale = std('#d8d0c8', 0.6), red = std('#6a0a10', 0.4, { emissive: '#3a0005', emissiveIntensity: 0.6 });
    const strMat = new THREE.LineBasicMaterial({ color: '#c8c0b0', transparent: true, opacity: 0.5 });
    const add = (id, g, col) => { g.visible = false; scene.add(g); H[id] = g; if (col) colliders.push(Object.assign({ on: () => g.visible }, col)); return g; };
    // marionettes: up to 8 puppets on strings around the pile, pulling dolls off it
    const pup = new THREE.Group(); pup.userData.list = [];
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Group(), body = dollGroup(i, 1.9); m.add(body);
      const arms = [-1, 1].map(sd => { const a = mk(new THREE.CylinderGeometry(0.015, 0.012, 0.32, 5), pale, sd * 0.09, 0.42, 0.02); a.geometry.translate(0, -0.16, 0); m.add(a); return a; });
      const cross = new THREE.Group(); cross.add(mk(new THREE.BoxGeometry(0.5, 0.04, 0.04), wood, 0, 0, 0), mk(new THREE.BoxGeometry(0.04, 0.04, 0.4), wood, 0, 0, 0)); pup.add(cross);
      const strings = new THREE.Group(); pup.add(strings);
      pup.add(m); pup.userData.list.push({ m, arms, cross, strings, ph: i * 1.3, a: i / 8 * Math.PI * 2 + 0.3 });
    }
    add('puppet', pup);
    // meat hooks over the pile, on chains from the ridge
    const hooks = new THREE.Group(); hooks.userData.list = [];
    for (let i = 0; i < 4; i++) { const h = new THREE.Group(); h.position.set(-1.5 + i, RIDGE - 0.3, 3 + (i % 2 ? 1.2 : -1.2)); h.add(mk(new THREE.CylinderGeometry(0.012, 0.012, 2.0, 4), iron, 0, -1.0, 0, false)); const hk = mk(new THREE.TorusGeometry(0.1, 0.018, 6, 12, Math.PI * 1.4), iron, 0, -2.1, 0); hk.rotation.z = Math.PI * 0.8; h.add(hk); if (i % 2 === 0) { const d = dollGroup(i + 2, 1.3); d.position.set(0, -2.7, 0); d.rotation.z = 0.3; h.add(d); } hooks.add(h); hooks.userData.list.push(h); }
    add('hooks', hooks);
    // cleaver stuck in a stump
    const clv = new THREE.Group(); clv.position.set(-3.4, 0, 11.6); clv.add(mk(new THREE.CylinderGeometry(0.3, 0.34, 0.6, 12), dark, 0, 0.3, 0), mk(new THREE.BoxGeometry(0.03, 0.22, 0.32), std('#8a8a8a', 0.3, { metalness: 0.9 }), 0, 0.68, 0), mk(new THREE.BoxGeometry(0.035, 0.05, 0.2), dark, 0, 0.8, -0.24));
    if (settings.blood) clv.add(mk(new THREE.BoxGeometry(0.032, 0.1, 0.2), std('#5a0000', 0.2), 0, 0.64, 0.04));
    add('cleaver', clv, { x: -3.4, z: 11.6, r: 0.55 });
    // laundry chute: a slanted trough from the heap into a hole in the floor
    const chute = new THREE.Group(), cA = new THREE.Vector3(-3.6, 1.7, -1.2), cB = new THREE.Vector3(-7.2, 0.15, -6.0), cLen = cA.distanceTo(cB);
    const trough = new THREE.Group(); trough.add(mk(new THREE.BoxGeometry(0.7, 0.05, cLen), dark, 0, 0, 0), mk(new THREE.BoxGeometry(0.05, 0.25, cLen), dark, -0.35, 0.12, 0), mk(new THREE.BoxGeometry(0.05, 0.25, cLen), dark, 0.35, 0.12, 0));
    trough.position.copy(cA).add(cB).multiplyScalar(0.5); trough.lookAt(cB); chute.add(trough);
    [0.25, 0.55, 0.8].forEach(k => { const p = cA.clone().lerp(cB, k); chute.add(mk(new THREE.BoxGeometry(0.08, p.y, 0.08), dark, p.x, p.y / 2, p.z)); });
    const hole = mk(new THREE.CircleGeometry(0.6, 20), new THREE.MeshBasicMaterial({ color: '#000' }), cB.x - 0.4, 0.01, cB.z - 0.4, false, false); hole.rotation.x = -Math.PI / 2; chute.add(hole);
    chute.userData = { a: cA, b: cB.clone().add(new THREE.Vector3(-0.4, -0.6, -0.4)) }; add('chute', chute, { box: true, x: -6.3, z: -4.9, w: 1.2, d: 1.4 });
    // furnace with a glowing mouth and a pipe through the roof
    const fur = new THREE.Group(); fur.position.set(6.8, 0, -5.6);
    fur.add(mk(new THREE.BoxGeometry(1.3, 1.3, 1.1), iron, 0, 0.65, 0), mk(new THREE.CylinderGeometry(0.14, 0.14, roofY(6.8) - 1.3, 10), iron, 0.3, 1.3 + (roofY(6.8) - 1.3) / 2, -0.2));
    const mouth = mk(new THREE.PlaneGeometry(0.6, 0.45), new THREE.MeshBasicMaterial({ color: '#ff6a1a' }), 0, 0.6, 0.56, false, false); fur.add(mouth);
    const fl = new THREE.PointLight('#ff6a20', 0, 6, 1.8); fl.position.set(0, 0.7, 1.0); fur.add(fl);
    fur.userData = { mouth, fl, sink: new THREE.Vector3(6.8, 0.6, -5.0) }; add('furnace', fur, { box: true, x: 6.8, z: -5.6, w: 1.0, d: 0.9 });
    // conveyor of hair from the heap to the furnace
    const conv = new THREE.Group(), kA = new THREE.Vector3(2.8, 0.45, -3.9), kB = new THREE.Vector3(6.6, 0.45, -4.8), kLen = kA.distanceTo(kB);
    const beltTex = canvasTex(64, 256, (g, w, h) => { g.fillStyle = '#140c08'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(80,50,30,.8)'; for (let i = 0; i < 160; i++) { g.beginPath(); const x = Math.random() * w; g.moveTo(x, Math.random() * h); g.quadraticCurveTo(x + rnd(-10, 10), Math.random() * h, x + rnd(-6, 6), Math.random() * h); g.stroke(); } }, [1, 4]);
    const belt = mk(new THREE.BoxGeometry(0.6, 0.06, kLen), std('#ffffff', 0.95, { map: beltTex }), 0, 0, 0); const frame = new THREE.Group(); frame.add(belt, mk(new THREE.BoxGeometry(0.7, 0.3, kLen), iron, 0, -0.2, 0));
    frame.position.copy(kA).add(kB).multiplyScalar(0.5); frame.lookAt(kB.x, kB.y, kB.z); conv.add(frame);
    [-1, 1].forEach(e => conv.add(mk(new THREE.BoxGeometry(0.08, 0.3, 0.08), iron, (kA.x + kB.x) / 2 + e * 1.6, 0.15, (kA.z + kB.z) / 2 + e * 0.38)));
    conv.userData = { tex: beltTex, a: kA, b: kB }; add('conveyor', conv, { box: true, x: 4.7, z: -4.35, w: 1.9, d: 0.6 });
    // sewing machine at a table, a stack of finished dolls beside it
    const sew = new THREE.Group(); sew.position.set(-8.0, 0, 11.6);
    sew.add(mk(new THREE.BoxGeometry(1.2, 0.08, 0.7), dark, 0, 0.78, 0)); [[-0.5, -0.28], [0.5, -0.28], [-0.5, 0.28], [0.5, 0.28]].forEach(([a, b]) => sew.add(mk(new THREE.BoxGeometry(0.06, 0.78, 0.06), dark, a, 0.39, b)));
    sew.add(mk(new THREE.BoxGeometry(0.5, 0.12, 0.2), std('#141414', 0.3, { metalness: 0.5 }), 0, 0.88, 0), mk(new THREE.BoxGeometry(0.12, 0.3, 0.18), std('#141414', 0.3, { metalness: 0.5 }), 0.2, 1.05, 0), mk(new THREE.BoxGeometry(0.42, 0.1, 0.16), std('#141414', 0.3, { metalness: 0.5 }), 0.02, 1.22, 0));
    const needle = mk(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 4), brass, -0.15, 1.1, 0, false); sew.add(needle);
    const sdoll = dollGroup(5, 1.4); sdoll.position.set(-0.15, 0.82, 0.05); sdoll.rotation.set(-Math.PI / 2, 0, 0.4); sew.add(sdoll);
    const stack = new THREE.Group(); stack.position.set(0.9, 0, 0.1); for (let i = 0; i < 8; i++) { const d = dollGroup(i, 1.2); d.position.set(rnd(-0.1, 0.1), i * 0.1, rnd(-0.1, 0.1)); d.rotation.set(-Math.PI / 2, 0, rnd(0, 6)); d.visible = false; stack.add(d); } sew.add(stack);
    sew.userData = { needle, stack, sdoll }; add('sewing', sew, { box: true, x: -7.9, z: 11.6, w: 0.9, d: 0.6 });
    // meat grinder with a turning crank, dripping into a bucket
    const gr = new THREE.Group(); gr.position.set(-8.2, 0, 7.8);
    gr.add(mk(new THREE.BoxGeometry(0.9, 0.85, 0.7), dark, 0, 0.42, 0), mk(new THREE.CylinderGeometry(0.15, 0.12, 0.35, 12), std('#7a7a78', 0.3, { metalness: 0.8 }), 0, 1.03, 0), mk(new THREE.CylinderGeometry(0.1, 0.14, 0.2, 10), std('#7a7a78', 0.3, { metalness: 0.8 }), 0, 1.3, 0));
    const crank = new THREE.Group(); crank.position.set(0.2, 1.05, 0); crank.add(mk(new THREE.BoxGeometry(0.03, 0.3, 0.03), iron, 0, 0.15, 0), mk(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 6), dark, 0.06, 0.3, 0)); crank.children[1].rotation.z = Math.PI / 2; gr.add(crank);
    gr.add(mk(new THREE.CylinderGeometry(0.18, 0.15, 0.3, 12, 1, true), iron, 0.62, 0.15, 0.1));
    if (settings.blood) { const bl = mk(new THREE.CircleGeometry(0.16, 12), std('#3a0000', 0.1), 0.62, 0.28, 0.1, false); bl.rotation.x = -Math.PI / 2; gr.add(bl); }
    gr.userData = { crank, sink: new THREE.Vector3(-8.2, 1.4, 7.8) }; add('grinder', gr, { box: true, x: -8.2, z: 7.8, w: 0.8, d: 0.7 });
    // Moll's automaton: a clockwork girl digging at the edge of the heap, a key turning in her back
    const au = new THREE.Group(), auBody = new THREE.Group(); au.add(auBody);
    auBody.add(mk(new THREE.CylinderGeometry(0.16, 0.3, 0.8, 12), std('#d8c8b8', 0.5), 0, 0.85, 0), mk(new THREE.CylinderGeometry(0.12, 0.15, 0.4, 10), std('#d8c8b8', 0.5), 0, 1.4, 0));
    const auHead = makeHead(std('#e8dcd0', 0.3), std('#3a2010', 0.7), 0.13); auHead.position.set(0, 1.75, 0); auBody.add(auHead);
    const key = new THREE.Group(); key.position.set(0, 1.35, -0.18); key.add(mk(new THREE.CylinderGeometry(0.015, 0.015, 0.14, 6), brass, 0, 0, -0.07), mk(new THREE.TorusGeometry(0.06, 0.012, 6, 12), brass, 0, 0, -0.16)); key.children[0].rotation.x = Math.PI / 2; auBody.add(key);
    const auArms = [-1, 1].map(sd => { const a = new THREE.Group(); a.position.set(sd * 0.17, 1.5, 0); a.add(mk(new THREE.CylinderGeometry(0.03, 0.025, 0.55, 6), std('#d8c8b8', 0.5), 0, -0.27, 0)); auBody.add(a); return a; });
    [-0.08, 0.08].forEach(x => au.add(mk(new THREE.CylinderGeometry(0.04, 0.035, 0.45, 6), std('#d8c8b8', 0.5), x, 0.22, 0)));
    au.userData = { body: auBody, key, arms: auArms, ph: 0 }; add('automaton', au);
    // heart pump: a jar with a beating heart, tubes running into the floor
    const hp = new THREE.Group(); hp.position.set(-7.9, 0, 3.4);
    hp.add(mk(new THREE.BoxGeometry(0.8, 0.6, 0.8), iron, 0, 0.3, 0), mk(new THREE.CylinderGeometry(0.28, 0.28, 0.6, 16), std('#a8c0b0', 0.1, { transparent: true, opacity: 0.35 }), 0, 0.9, 0, false));
    const heart = mk(new THREE.SphereGeometry(0.16, 12, 10), red, 0, 0.88, 0); hp.add(heart);
    [-1, 1].forEach(sd => { const t = mk(new THREE.TorusGeometry(0.5, 0.03, 6, 16, Math.PI), std('#3a1010', 0.5), sd * 0.4, 0.6, 0); t.rotation.y = Math.PI / 2; hp.add(t); });
    hp.userData = { heart }; add('heartPump', hp, { box: true, x: -7.9, z: 3.4, w: 0.7, d: 0.7 });
    // a salt line around the heap
    const salt = new THREE.Group(); for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2, sg = mk(new THREE.BoxGeometry(0.06, 0.012, 1.2), std('#f0ece4', 0.9), Sim.PILE_POS.x + Math.cos(a) * 7.3, 0.006, Sim.PILE_POS.z + Math.sin(a) * 7.3, false); sg.rotation.y = -a; salt.add(sg); }
    add('salt', salt);
    // holy water font, music box on a crate, little coffins
    const font = new THREE.Group(); font.position.set(3.4, 0, 12.4); font.add(mk(new THREE.CylinderGeometry(0.1, 0.16, 0.9, 10), std('#b8b0a4', 0.8), 0, 0.45, 0), mk(new THREE.CylinderGeometry(0.32, 0.22, 0.16, 16), std('#b8b0a4', 0.8), 0, 0.98, 0));
    const fw = mk(new THREE.CircleGeometry(0.27, 16), std('#a0c8e0', 0.05, { emissive: '#203848', emissiveIntensity: 0.6 }), 0, 1.05, 0, false); fw.rotation.x = -Math.PI / 2; font.add(fw); add('holyWater', font, { x: 3.4, z: 12.4, r: 0.45 });
    const mb = new THREE.Group(); mb.position.set(-3.0, 0, 12.6); mb.add(mk(new THREE.BoxGeometry(0.7, 0.7, 0.7), dark, 0, 0.35, 0), mk(new THREE.BoxGeometry(0.3, 0.14, 0.22), std('#5a1a2a', 0.5), 0, 0.77, 0));
    const lid = new THREE.Group(); lid.position.set(0, 0.84, -0.11); lid.add(mk(new THREE.BoxGeometry(0.3, 0.02, 0.22), std('#5a1a2a', 0.5), 0, 0, 0.11)); mb.add(lid);
    const ball = new THREE.Group(); ball.position.set(0, 0.84, 0); ball.add(mk(new THREE.ConeGeometry(0.03, 0.06, 8), std('#f0e0e0', 0.5), 0, 0.03, 0), mk(new THREE.SphereGeometry(0.012, 6, 5), std('#f0e0e0', 0.5), 0, 0.075, 0)); ball.visible = false; mb.add(ball);
    mb.userData = { lid, ball }; add('musicBox', mb, { x: -3.0, z: 12.6, r: 0.55 });
    const cof = new THREE.Group(); cof.position.set(8.2, 0, -2.4); cof.userData.list = [];
    for (let i = 0; i < 3; i++) { const c = mk(new THREE.BoxGeometry(0.42, 0.16, 0.9), dark, rnd(-0.05, 0.05), 0.08 + i * 0.17, 0); c.rotation.y = rnd(-0.2, 0.2); cof.add(c); cof.userData.list.push(c); }
    add('coffins', cof, { box: true, x: 8.2, z: -2.4, w: 0.4, d: 0.6 });
    // a little table of tools: scissors, tweezers, gloves, spare batteries, charred trophies
    const tt = new THREE.Group(); tt.position.set(-3.3, 0, -6.4); tt.add(mk(new THREE.BoxGeometry(1.2, 0.06, 0.6), dark, 0, 0.75, 0)); [[-0.52, -0.24], [0.52, -0.24], [-0.52, 0.24], [0.52, 0.24]].forEach(([a, b]) => tt.add(mk(new THREE.BoxGeometry(0.05, 0.75, 0.05), dark, a, 0.375, b)));
    const tool = {};
    tool.scissors = new THREE.Group(); [-0.25, 0.25].forEach(r => { const b = mk(new THREE.BoxGeometry(0.02, 0.008, 0.2), std('#9a9a9a', 0.3, { metalness: 0.9 }), 0, 0, 0.05); b.rotation.y = r; tool.scissors.add(b); }); tool.scissors.position.set(-0.4, 0.79, 0);
    tool.tweezers = mk(new THREE.BoxGeometry(0.012, 0.006, 0.12), std('#c0c0c0', 0.3, { metalness: 0.9 }), -0.15, 0.785, 0.1);
    tool.gloves = mk(new THREE.BoxGeometry(0.16, 0.04, 0.24), std('#3a2a1a', 0.9), 0.15, 0.8, -0.05);
    tool.battery = new THREE.Group(); for (let i = 0; i < 3; i++) tool.battery.add(mk(new THREE.CylinderGeometry(0.018, 0.018, 0.07, 8), std('#b8a040', 0.4, { metalness: 0.5 }), 0.4 + i * 0.05, 0.815, 0.1));
    tool.trophies = new THREE.Group(); for (let i = 0; i < 5; i++) { const sp = new THREE.Group(); sp.position.set(-0.5 + i * 0.25, 0, -0.45); sp.add(mk(new THREE.CylinderGeometry(0.008, 0.008, 1.1, 4), iron, 0, 0.55, 0), mk(new THREE.SphereGeometry(0.075, 10, 8), std('#1a1410', 0.95), 0, 1.15, 0)); tool.trophies.add(sp); }
    Object.values(tool).forEach(o => { o.visible = false; tt.add(o); });
    tt.userData = { tool }; add('tools', tt, { box: true, x: -3.3, z: -6.4, w: 0.65, d: 0.35 });
    // UV lamp over the heap
    H.uvLight = new THREE.PointLight('#8a40ff', 0, 12, 1.5); H.uvLight.position.set(0, 4.5, 3); scene.add(H.uvLight);
    // the bell and the chain end up on her
    H.bell = mk(new THREE.ConeGeometry(0.045, 0.07, 10, 1, true), brass, 0, 1.84, 0.1); H.bell.visible = false; mother.userData.rig.add(H.bell);
    H.chain = new THREE.Group(); for (let i = 0; i < 9; i++) { const l = mk(new THREE.TorusGeometry(0.035, 0.009, 5, 10), iron, 0.1, 0.06, -0.06 - i * 0.06); l.rotation.y = i % 2 ? Math.PI / 2 : 0; H.chain.add(l); } H.chain.visible = false; mother.userData.rig.add(H.chain);
  }
  // auto pulls are carried off by whatever helper is working
  function helperThrow() {
    const P = Sim.PILE_POS, R = pileMass.scale.x, top = pileMass.scale.y, live = [];
    if (H.puppet.visible) live.push('puppet', 'puppet'); if (H.chute.visible) live.push('chute');
    if (H.furnace.visible) live.push('furnace'); if (H.conveyor.visible) live.push('conveyor'); if (H.sewing.visible) live.push('sewing');
    if (H.grinder.visible) live.push('grinder'); if (H.automaton.visible) live.push('automaton', 'automaton');
    if (!live.length) return false;
    const k = live[Math.floor(Math.random() * live.length)], f = fliers.find(x => !x.on); if (!f) return true;
    const edge = a => new THREE.Vector3(P.x + Math.cos(a) * R * 0.75, top * 0.3, P.z + Math.sin(a) * R * 0.75);
    let from, to;
    if (k === 'puppet') { const L = H.puppet.userData.list.filter(p => p.m.visible); const p = L[Math.floor(Math.random() * L.length)]; if (!p) return false; from = p.m.position.clone(); to = new THREE.Vector3(7.6 + rnd(-0.6, 0.6), 0.3, 9.5 + rnd(-1.5, 1.5)); p.jerk = 0.4; }
    else if (k === 'chute') { from = H.chute.userData.a.clone(); to = H.chute.userData.b.clone(); f.slide = true; }
    else if (k === 'furnace') { from = edge(-0.9); to = H.furnace.userData.sink.clone(); H.furnace.userData.flare = 0.6; }
    else if (k === 'conveyor') { from = H.conveyor.userData.a.clone().add(new THREE.Vector3(0, 0.1, 0)); to = H.conveyor.userData.b.clone().add(new THREE.Vector3(0, 0.1, 0)); f.slide = true; }
    else if (k === 'sewing') { from = edge(2.2); to = new THREE.Vector3(-7.1, 0.9, 11.7); H.sewing.userData.made = (H.sewing.userData.made || 0) + 1; }
    else if (k === 'grinder') { from = edge(2.9); to = H.grinder.userData.sink.clone(); }
    else { from = H.automaton.position.clone().add(new THREE.Vector3(0, 1.2, 0)); to = H.furnace.visible ? H.furnace.userData.sink.clone() : new THREE.Vector3(7.6 + rnd(-0.6, 0.6), 0.3, 9.5 + rnd(-1.5, 1.5)); H.automaton.userData.throwT = 0.5; }
    f.from = from; f.to = to; f.t = 0; f.on = true; f.g.visible = true; f.spin = f.slide ? new THREE.Vector3(0, 0, 0) : new THREE.Vector3(rnd(-8, 8), rnd(-8, 8), rnd(-8, 8)); f.sink = k !== 'puppet';
    return true;
  }
  function stepHelpers(world, t, dt) {
    const lv = id => Sim.lv(world, id), P = Sim.PILE_POS, R = pileMass.scale.x, top = pileMass.scale.y;
    ['puppet', 'hooks', 'cleaver', 'chute', 'furnace', 'conveyor', 'sewing', 'grinder', 'automaton', 'heartPump', 'salt', 'musicBox', 'coffins'].forEach(id => { H[id].visible = lv(id) > 0; });
    H.holyWater.visible = lv('holyWater') > 0;
    const work = Sim.autoRate(world) > 0;
    if (H.puppet.visible) { const n = Math.min(8, Math.ceil(lv('puppet') / 3)); H.puppet.userData.list.forEach((p, i) => {
      const on = i < n; p.m.visible = p.cross.visible = p.strings.visible = on; if (!on) return;
      const a = p.a, r = R * 0.8 + 0.5, x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r, y = Math.max(0.2, top * (1 - Math.min(1, (r - 0.4) / Math.max(0.5, R))) ) + 0.55 + Math.sin(t * 2 + p.ph) * 0.06;
      p.jerk = Math.max(0, (p.jerk || 0) - dt);
      p.m.position.set(x, y, z); p.m.rotation.set(0.25 + p.jerk * 0.6, -a - Math.PI / 2, Math.sin(t * 1.3 + p.ph) * 0.12);
      p.arms.forEach((ar, k) => { ar.rotation.x = -1.2 - Math.sin(t * 6 + p.ph + k * 2) * 0.5 * (work ? 1 : 0.2) - p.jerk * 2; });
      const cy = roofY(x) - 0.4; p.cross.position.set(x, cy, z); p.cross.rotation.y = Math.sin(t + p.ph) * 0.3;
      p.strings.clear(); const mat = p.strings.userData.mat || (p.strings.userData.mat = new THREE.LineBasicMaterial({ color: '#c8c0b0', transparent: true, opacity: 0.45 }));
      [[-0.22, 0], [0.22, 0], [0, 0.18]].forEach(([dx, dz], k) => p.strings.add(line(new THREE.Vector3(x + dx, cy, z + dz), p.m.localToWorld(new THREE.Vector3([-0.09, 0.09, 0][k], 0.42, 0)), mat)));
      p.strings.add(line(new THREE.Vector3(x, cy, z), new THREE.Vector3(x, roofY(x) - 0.02, z), mat));
    }); }
    if (H.hooks.visible) H.hooks.userData.list.forEach((h, i) => { h.visible = i < lv('hooks') * 2; h.rotation.z = Math.sin(t * 0.8 + i) * 0.08; h.rotation.x = Math.sin(t * 0.6 + i * 2) * 0.05; });
    if (H.furnace.visible) { const u = H.furnace.userData; u.flare = Math.max(0, (u.flare || 0) - dt); const k = 0.8 + Math.sin(t * 11) * 0.1 + Math.random() * 0.1 + u.flare; u.fl.intensity = 5 * k; u.mouth.material.color.setRGB(1, 0.35 + 0.15 * k, 0.08); }
    if (H.conveyor.visible) H.conveyor.userData.tex.offset.y -= dt * (work ? 0.5 : 0.05);
    if (H.sewing.visible) { const u = H.sewing.userData; u.needle.position.y = 1.1 + Math.sin(t * 30) * 0.03 * (work ? 1 : 0); u.stack.children.forEach((d, i) => d.visible = i < Math.min(8, Math.floor((u.made || 0) / 3) + 1)); }
    if (H.grinder.visible) H.grinder.userData.crank.rotation.x += dt * (work ? 5 : 0.3);
    if (H.automaton.visible) { const u = H.automaton.userData, a = -0.25, r = R + 0.55;
      H.automaton.position.set(P.x + Math.cos(a) * r, 0, P.z + Math.sin(a) * r); H.automaton.rotation.y = Math.atan2(P.x - H.automaton.position.x, P.z - H.automaton.position.z);
      u.ph += dt * (work ? 4 : 0.5); const tick = Math.floor(u.ph * 2) / 2;   // clockwork: it moves in jerks
      u.body.rotation.x = 0.35 + Math.sin(tick) * 0.3; u.arms.forEach((ar, k) => ar.rotation.x = -1.0 - Math.sin(tick + k) * 0.7); u.key.rotation.z = u.ph * 1.5; }
    if (H.heartPump.visible) { const b = (Math.sin(t * 7) + 1) / 2; H.heartPump.userData.heart.scale.setScalar(0.85 + b * 0.3); }
    if (H.salt.visible) { const n = Math.ceil(40 * Math.min(1, lv('salt') / 6)); H.salt.children.forEach((c, i) => c.visible = i < n); }
    if (H.musicBox.visible) { const playing = world.time < world.musicUntil; H.musicBox.userData.lid.rotation.x = playing ? -1.6 : 0; H.musicBox.userData.ball.visible = playing; H.musicBox.userData.ball.rotation.y += dt * 3; }
    if (H.coffins.visible) H.coffins.userData.list.forEach((c, i) => c.visible = i < lv('coffins'));
    const tool = H.tools.userData.tool, anyTool = ['scissors', 'tweezers', 'gloves', 'battery', 'trophies'].some(id => lv(id) > 0);
    H.tools.visible = anyTool; tool.scissors.visible = lv('scissors') > 0; tool.tweezers.visible = lv('tweezers') > 0; tool.gloves.visible = lv('gloves') > 0; tool.battery.visible = lv('battery') > 0;
    tool.trophies.visible = lv('trophies') > 0; tool.trophies.children.forEach((c, i) => c.visible = i < lv('trophies'));
    H.uvLight.intensity = lv('uv') ? 3 + lv('uv') * 1.5 : 0;
    H.bell.visible = lv('bell') > 0; H.chain.visible = lv('chain') > 0;
  }

  // ---------- things to pick up ----------
  const items = {};
  function buildItems() {
    const lying = dollGroup(1, 2.4); lying.position.set(0.5, 0.62, -77.6); lying.rotation.set(-Math.PI / 2, 0, 0); scene.add(lying);
    const metal = std('#3a3a3a', 0.35, { metalness: 0.9 }), glow = new THREE.MeshBasicMaterial({ color: '#ffe0a0', transparent: true, opacity: 0.0 });
    DD.ITEMS.forEach(it => {
      const g = new THREE.Group(); g.position.set(it.x, it.y, it.z);
      if (it.id === 'poker') { const m = mk(new THREE.CylinderGeometry(0.018, 0.018, 0.9, 6), metal, 0, 0.02, 0); m.rotation.z = Math.PI / 2; g.add(m, mk(new THREE.BoxGeometry(0.06, 0.12, 0.02), metal, 0.45, 0.05, 0)); }
      else if (it.id === 'camera') g.add(mk(new THREE.BoxGeometry(0.22, 0.13, 0.1), std('#1a1a1a', 0.5), 0, 0.07, 0), mk(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 12), metal, 0, 0.07, 0.07));
      else if (it.id === 'holy') g.add(mk(new THREE.CylinderGeometry(0.05, 0.06, 0.2, 10), std('#a8c8d8', 0.1, { transparent: true, opacity: 0.6 }), 0, 0.1, 0), mk(new THREE.BoxGeometry(0.03, 0.1, 0.01), std('#d8c060', 0.3), 0, 0.12, 0.062));
      else if (it.id === 'flare') g.add(mk(new THREE.CylinderGeometry(0.03, 0.03, 0.32, 8), std('#b01010', 0.6), 0, 0.03, 0)).children[0].rotation.set(0, 0, Math.PI / 2);
      else if (it.id === 'twin') { const d = dollGroup(0, 1.1); g.add(d); }
      else if (it.id === 'photo') g.add(mk(new THREE.BoxGeometry(0.18, 0.24, 0.02), std('#ffffff', 0.7, { map: drawingTex() }), 0, 0.12, 0));
      else if (it.id === 'drawing') { const m = mk(new THREE.PlaneGeometry(0.4, 0.3), std('#ffffff', 0.9, { map: drawingTex() }), 0, 0.01, 0, false); m.rotation.x = -Math.PI / 2; g.add(m); }
      else if (it.id === 'ring') g.add(mk(new THREE.TorusGeometry(0.03, 0.008, 6, 16), std('#d8b040', 0.2, { metalness: 1 }), 0, 0.02, 0));
      else if (it.id === 'prayer') g.add(mk(new THREE.BoxGeometry(0.16, 0.05, 0.22), std('#2a1010', 0.8), 0, 0.03, 0));
      else if (it.id === 'duck') g.add(mk(new THREE.SphereGeometry(0.07, 10, 8), std('#e8c020', 0.4), 0, 0.06, 0), mk(new THREE.SphereGeometry(0.045, 10, 8), std('#e8c020', 0.4), 0.06, 0.13, 0), mk(new THREE.ConeGeometry(0.02, 0.05, 6), std('#e06010', 0.4), 0.11, 0.13, 0));
      else if (it.id === 'program') { const m = mk(new THREE.PlaneGeometry(0.2, 0.28), std('#e8dcc0', 0.9, { map: writingTex('MOLL', false) }), 0, 0.01, 0, false); m.rotation.x = -Math.PI / 2; g.add(m); }
      else if (it.id === 'diary') g.add(mk(new THREE.BoxGeometry(0.2, 0.05, 0.26), std('#4a1a2a', 0.7), 0, 0.03, 0));
      const halo = mk(new THREE.SphereGeometry(0.22, 10, 8), glow.clone(), 0, 0.1, 0, false, false); g.add(halo);
      g.userData = { item: it.id, halo }; g.traverse(o => { if (o.isMesh) o.castShadow = false; }); scene.add(g); items[it.id] = g;
    });
  }
  function stepItems(world, t) {
    for (const id in items) { const g = items[id], found = world.found && world.found[id]; g.visible = !found; if (!found) { const d = Math.hypot(camera.position.x - g.position.x, camera.position.z - g.position.z); g.userData.halo.material.opacity = d < 4 ? 0.05 + Math.sin(t * 3) * 0.03 : 0; } }
    // flare
    const R = world.repel && world.time < world.repel.until ? world.repel : null;
    if (R) { if (!FX.flareL) { FX.flareL = new THREE.PointLight('#ff3010', 0, 12, 1.5); scene.add(FX.flareL); } FX.flareL.position.set(R.x, 0.4, R.z); FX.flareL.intensity = 9 * (0.8 + Math.random() * 0.3); } else if (FX.flareL) FX.flareL.intensity = 0;
  }

  // ---------- other players (co-op) ----------
  const avatars = {};
  function nameTag(text) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const g = cv.getContext('2d');
    g.font = '28px "IBM Plex Mono", monospace'; g.textAlign = 'center'; g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, 12, 256, 40); g.fillStyle = '#e8dcc8'; g.fillText(text, 128, 42);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false })); sp.scale.set(0.9, 0.225, 1); return sp;
  }
  function makeAvatar(nick) {
    const g = new THREE.Group(), coat = std('#2a2622', 0.9), skin = std('#c8b4a0', 0.6);
    g.add(mk(new THREE.CapsuleGeometry(0.22, 0.85, 4, 10), coat, 0, 0.75, 0), mk(new THREE.SphereGeometry(0.14, 14, 10), skin, 0, 1.52, 0));
    [-0.1, 0.1].forEach(x => g.add(mk(new THREE.CylinderGeometry(0.07, 0.06, 0.5, 8), std('#16120f', 0.9), x, 0.25, 0)));
    const beam = new THREE.Mesh(new THREE.ConeGeometry(1.6, 7, 20, 1, true), new THREE.MeshBasicMaterial({ color: '#eef2ff', transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    beam.geometry.translate(0, -3.5, 0); beam.geometry.rotateX(-Math.PI / 2); const head = new THREE.Group(); head.position.y = 1.45; head.add(beam); g.add(head);
    const lamp = new THREE.SpotLight('#eef2ff', 0, 12, 0.45, 0.6, 2); lamp.position.set(0, 0, 0); const tgt = new THREE.Object3D(); tgt.position.set(0, 0, -4); head.add(lamp, tgt); lamp.target = tgt;
    const tag = nameTag(nick); tag.position.y = 2.0; g.add(tag);
    g.userData = { head, beam, lamp, nick }; g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g); return g;
  }
  function others(list) {
    const seen = {};
    list.forEach(p => {
      seen[p.id] = true; let a = avatars[p.id];
      if (!a || a.userData.nick !== p.nick) { if (a) scene.remove(a); a = avatars[p.id] = makeAvatar(p.nick || '?'); a.position.set(p.x, 0, p.z); }
      a.userData.tx = p.x; a.userData.tz = p.z; a.userData.yaw = p.yaw; a.userData.pitch = p.pitch;
      a.userData.beam.visible = !!p.light; a.userData.lamp.intensity = p.light ? 14 : 0;
      a.userData.dig = !!p.digging;
    });
    for (const id in avatars) if (!seen[id]) { scene.remove(avatars[id]); delete avatars[id]; }
  }
  function moveAvatars(dt, t) {
    for (const id in avatars) { const a = avatars[id], u = a.userData; if (u.tx == null) continue; const k = Math.min(1, dt * 10); a.position.x += (u.tx - a.position.x) * k; a.position.z += (u.tz - a.position.z) * k; a.rotation.y = u.yaw; u.head.rotation.x = u.pitch; a.children[0].rotation.x = u.dig ? 0.35 + Math.sin(t * 9) * 0.1 : 0; }
  }
  function collide(p, world, prev) {
    const B = Sim.bounds(world); p.x = Math.max(B.minX, Math.min(B.maxX, p.x)); p.z = Math.max(B.minZ, Math.min(B.maxZ, p.z));
    Sim.WALLS.map((z, wi) => [z, gateOpen(wi)]).forEach(([z, open]) => {
      if (prev && (prev.z - z) * (p.z - z) < 0 && (!open || Math.abs(p.x) > 1.3)) p.z = prev.z;
      if (Math.abs(p.z - z) < 0.3 && Math.abs(p.x) > 1.3) p.z = z + Math.sign(p.z - z || 1) * 0.3;
    });
    const P = Sim.PILE_POS, pr = pileMass ? pileMass.scale.x + 0.45 : PILE_R, d = Math.hypot(p.x - P.x, p.z - P.z);
    if (d < pr) { p.x = P.x + (p.x - P.x) / d * pr; p.z = P.z + (p.z - P.z) / d * pr; }
    colliders.forEach(c => {
      if (c.on && !c.on()) return;
      if (c.box) { const dx = p.x - c.x, dz = p.z - c.z; if (Math.abs(dx) < c.w && Math.abs(dz) < c.d) { if (c.w - Math.abs(dx) < c.d - Math.abs(dz)) p.x = c.x + Math.sign(dx) * c.w; else p.z = c.z + Math.sign(dz) * c.d; } }
      else { const dx = p.x - c.x, dz = p.z - c.z, dd = Math.hypot(dx, dz); if (dd < c.r && dd > 0) { p.x = c.x + dx / dd * c.r; p.z = c.z + dz / dd * c.r; } }
    });
  }
  root.World3D = { init, update, others, setQuality, setSettings, launchDoll, addBlood, jumpscare, collide, visible, scare: S2, canvas: () => renderer.domElement, roofY };
})(window);
