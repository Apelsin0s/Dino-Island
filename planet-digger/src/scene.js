// Rendering: soft stylised 3D (toy-like shapes, clean materials, bright sun, soft shadows, ambient occlusion, light bloom).
// Everything is drawn relative to a floating origin O near the player, so a 6 371 km planet stays precise on the GPU.
'use strict';
(function (root) {
  const W = root.World, T = root.THREE;
  const v3 = (x, y, z) => new T.Vector3(x, y, z);
  const col = h => new T.Color(h);

  const Scene = {};
  let renderer, composer, gtao, bloom, scene, camera, handScene, handCam, sun, hemi, sky, skyU, fog;
  const O = v3(0, 0, 0);                         // floating origin (planet metres)
  const up = v3(0, 1, 0), sunDir = v3(0, 1, 0), east = v3(1, 0, 0), north = v3(0, 0, 1);
  const timeU = { value: 0 };
  let quality = 'high';

  // ---------- palette ----------
  const P = {
    grass: col('#67b347'), grass2: col('#86c75a'), grassDry: col('#a7c264'),
    soil: col('#6e4529'), dirt: col('#8b5a33'), clay: col('#b9733f'), stone: col('#8e8f96'), stone2: col('#6f7079'),
    rock: col('#9b9a98'), snow: col('#f4f7fb'), trunk: col('#7a4f2e'), leaf: col('#4fa83b'), leaf2: col('#78c447'), pine: col('#2f7d3e'),
    bush: col('#58a63c'), pebble: col('#b5aea3')
  };
  const tmpC = new T.Color();
  // Colour of the ground at a given depth below the untouched surface.
  function groundColor(depth, upness, n, out) {
    out = out || new T.Color();
    if (depth < 0.3 && upness > 0.6) {
      out.copy(P.grass).lerp(P.grass2, Math.max(0, Math.min(1, 0.5 + n * 1.4)));
      return out;
    }
    const d = depth + n * 1.2;
    if (d < 1.4) out.copy(P.soil).lerp(P.dirt, Math.max(0, d / 1.4));
    else if (d < 6) out.copy(P.dirt).lerp(P.clay, Math.max(0, (d - 4) / 2));
    else if (d < 16) out.copy(P.clay).lerp(P.stone, Math.max(0, (d - 13) / 3));
    else out.copy(P.stone).lerp(P.stone2, Math.min(1, (d - 16) / 40));
    return out;
  }
  Scene.groundColor = groundColor;

  // ---------- setup ----------
  Scene.init = function (canvas) {
    renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap;

    scene = new T.Scene();
    fog = new T.Fog(col('#cfe6f7'), 120, 3200); scene.fog = fog;
    camera = new T.PerspectiveCamera(72, 1, 0.05, 30000);

    hemi = new T.HemisphereLight(col('#cfe9ff'), col('#7a9a55'), 1.35); scene.add(hemi);
    sun = new T.DirectionalLight(col('#fff0d8'), 2.8); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 260;
    sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.09; sun.shadow.radius = 3;
    scene.add(sun); scene.add(sun.target);

    // sky dome
    skyU = { up: { value: up }, sun: { value: sunDir } };
    sky = new T.Mesh(new T.SphereGeometry(20000, 48, 24), new T.ShaderMaterial({
      uniforms: skyU, side: T.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = (modelMatrix*vec4(position,1.0)).xyz - cameraPosition; gl_Position = projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.0); gl_Position.z = gl_Position.w; }',
      fragmentShader: `uniform vec3 up; uniform vec3 sun; varying vec3 vDir;
        void main(){ vec3 d = normalize(vDir); float h = dot(d, up);
          vec3 zen = vec3(0.10,0.33,0.85), hor = vec3(0.62,0.80,0.95), grd = vec3(0.45,0.58,0.62);
          vec3 c = h > 0.0 ? mix(hor, zen, pow(clamp(h,0.0,1.0), 0.55)) : mix(hor, grd, clamp(-h*5.0,0.0,1.0));
          float s = max(dot(d, sun), 0.0);
          c += vec3(1.0,0.82,0.55) * pow(s, 9.0) * 0.28 + vec3(1.0,0.9,0.7) * pow(s, 180.0) * 1.2;
          c += vec3(6.0,5.4,4.4) * smoothstep(0.99955, 0.9997, s);
          gl_FragColor = vec4(c, 1.0); }`
    }));
    sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky);

    // first-person hands live in their own scene, drawn on top
    handScene = new T.Scene();
    handCam = new T.PerspectiveCamera(58, 1, 0.01, 10);
    handScene.add(new T.HemisphereLight(col('#dceeff'), col('#6c6a55'), 1.6));
    const hl = new T.DirectionalLight(col('#fff0d8'), 2.4); hl.position.set(0.6, 1, 0.4); handScene.add(hl);
    const fill = new T.DirectionalLight(col('#bcd6ff'), 0.6); fill.position.set(-1, 0.2, 0.5); handScene.add(fill);

    // Terrain: vertex colour carries the soil layers; the grass cover is decided per pixel so its edge stays crisp.
    Scene.terrainMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, metalness: 0 });
    Scene.terrainMat.onBeforeCompile = sh => {
      sh.uniforms.gA = { value: P.grass }; sh.uniforms.gB = { value: P.grass2 }; sh.uniforms.gEdge = { value: col('#4f9a36') };
      sh.vertexShader = 'attribute float aDepth; attribute float aUp; attribute float aN; varying float vDepth; varying float vUp; varying float vN;\n' +
        sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vDepth = aDepth; vUp = aUp; vN = aN;');
      sh.fragmentShader = 'uniform vec3 gA; uniform vec3 gB; uniform vec3 gEdge; varying float vDepth; varying float vUp; varying float vN;\n' +
        sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
          float gk = (1.0 - smoothstep(0.22, 0.3, vDepth)) * smoothstep(0.52, 0.6, vUp);
          float edge = (1.0 - smoothstep(0.12, 0.22, vDepth)) * smoothstep(0.6, 0.75, vUp);
          vec3 gc = mix(gA, gB, clamp(0.5 + vN * 1.4, 0.0, 1.0));
          gc = mix(gEdge, gc, edge);
          diffuseColor.rgb = mix(diffuseColor.rgb, gc, gk);`);
    };
    Scene.farMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
    buildComposer();
    Hands.build();
    Particles.build();
    Deco.build();
    Scene.resize();
  };

  function buildComposer() {
    const rt = new T.WebGLRenderTarget(4, 4, { type: T.HalfFloatType, samples: 4 });
    composer = new T.EffectComposer(renderer, rt);
    composer.addPass(new T.RenderPass(scene, camera));
    gtao = new T.GTAOPass(scene, camera, 4, 4);
    gtao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.4, thickness: 0.8, scale: 1.0, samples: 12 });
    gtao.blendIntensity = 0.55;
    composer.addPass(gtao);
    bloom = new T.UnrealBloomPass(new T.Vector2(4, 4), 0.22, 0.55, 0.92); composer.addPass(bloom);
    composer.addPass(new T.OutputPass());
    applyQuality();
  }
  function applyQuality() {
    const hi = quality === 'high';
    if (gtao) gtao.enabled = hi;
    if (bloom) bloom.enabled = true;
    if (sun) { sun.shadow.mapSize.set(hi ? 2048 : 1024, hi ? 2048 : 1024); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    if (renderer) renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, hi ? 1.5 : 1));
    Scene.resize();
  }
  Scene.setQuality = q => { quality = q; applyQuality(); };
  Scene.getQuality = () => quality;

  Scene.resize = function () {
    if (!renderer) return;
    const w = root.innerWidth, h = root.innerHeight;
    renderer.setSize(w, h, false); composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    handCam.aspect = w / h; handCam.updateProjectionMatrix();
  };

  // ---------- floating origin & local frame ----------
  Scene.origin = O;
  Scene.setFrame = function (u) {     // local up at the player, sun fixed over the start region
    up.copy(u);
  };
  Scene.setSun = function (d) { sunDir.copy(d).normalize(); };
  Scene.setEastNorth = function (e, n) { east.copy(e); north.copy(n); };
  Scene.rel = (x, y, z, out) => (out || new T.Vector3()).set(x - O.x, y - O.y, z - O.z);

  // ---------- terrain chunks ----------
  const chunks = new Map();     // key -> { cx, cy, cz, data, mesh }
  let wanted = [], lastCenter = '', buildQueue = [];
  const LOAD_R = 54;
  function buildMesh(ch) {
    const m = W.meshChunk(ch.data);
    if (ch.mesh) { ch.mesh.geometry.dispose(); scene.remove(ch.mesh); ch.mesh = null; }
    if (!m.idx.length) return;
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(m.pos, 3));
    g.setAttribute('normal', new T.BufferAttribute(m.nrm, 3));
    const aN = new Float32Array(m.pos.length / 3);
    const cols = new Float32Array(m.pos.length), bx = ch.cx * W.CH, by = ch.cy * W.CH, bz = ch.cz * W.CH;
    for (let i = 0, n = m.pos.length / 3; i < n; i++) {
      const x = bx + m.pos[i * 3], y = by + m.pos[i * 3 + 1], z = bz + m.pos[i * 3 + 2];
      const nz = W.noise(x / 2.3, y / 2.3, z / 2.3, 7) * 0.6 + W.noise(x / 0.7, y / 0.7, z / 0.7, 9) * 0.25;
      groundColor(Math.max(0.39, m.depth[i]), 0, nz, tmpC);
      aN[i] = nz;
      // little light pebbles in the dirt
      if (m.depth[i] > 0.5 && W.hash01(Math.floor(x / 0.4), Math.floor(y / 0.4), Math.floor(z / 0.4)) < 0.05) tmpC.lerp(P.pebble, 0.55);
      cols[i * 3] = tmpC.r; cols[i * 3 + 1] = tmpC.g; cols[i * 3 + 2] = tmpC.b;
    }
    g.setAttribute('color', new T.BufferAttribute(cols, 3));
    g.setAttribute('aDepth', new T.BufferAttribute(m.depth, 1)); g.setAttribute('aUp', new T.BufferAttribute(m.upness, 1)); g.setAttribute('aN', new T.BufferAttribute(aN, 1));
    g.setIndex(new T.BufferAttribute(m.idx, 1));
    g.computeBoundingSphere();
    const mesh = new T.Mesh(g, Scene.terrainMat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.position.set(bx - O.x, by - O.y, bz - O.z);
    scene.add(mesh); ch.mesh = mesh;
  }
  // Decide which chunks should exist around the player; returns how many are still waiting to be built.
  Scene.updateChunks = function (p, budgetMs) {
    const cx = Math.floor(p.x / W.CH), cy = Math.floor(p.y / W.CH), cz = Math.floor(p.z / W.CH), ck = cx + ',' + cy + ',' + cz;
    if (ck !== lastCenter) {
      lastCenter = ck;
      const r = Math.ceil(LOAD_R / W.CH), want = new Set(); const list = [];
      for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) for (let c = -r; c <= r; c++) {
        const X = cx + a, Y = cy + b, Z = cz + c;
        const dx = (X + 0.5) * W.CH - p.x, dy = (Y + 0.5) * W.CH - p.y, dz = (Z + 0.5) * W.CH - p.z, dist = Math.hypot(dx, dy, dz);
        if (dist > LOAD_R + W.CH * 0.87) continue;
        if (!W.chunkMayHaveSurface(X, Y, Z)) continue;
        const k = W.key(X, Y, Z); want.add(k);
        if (!chunks.has(k)) list.push({ k, X, Y, Z, dist });
      }
      for (const [k, ch] of chunks) if (!want.has(k)) { if (ch.mesh) { ch.mesh.geometry.dispose(); scene.remove(ch.mesh); } chunks.delete(k); }
      list.sort((a, b) => a.dist - b.dist); buildQueue = list;
    }
    const t0 = performance.now();
    while (buildQueue.length && performance.now() - t0 < budgetMs) {
      const q = buildQueue.shift(); if (chunks.has(q.k)) continue;
      const ch = { cx: q.X, cy: q.Y, cz: q.Z, data: W.sampleChunk(q.X, q.Y, q.Z), mesh: null };
      chunks.set(q.k, ch); buildMesh(ch);
    }
    return buildQueue.length;
  };
  // A hole was dug: re-carve and re-mesh the touched chunks right away.
  Scene.applyHole = function (h, keys) {
    for (const k of keys) {
      const ch = chunks.get(k);
      if (ch) { W.carve(ch.data.d, ch.data.ox, ch.data.oy, ch.data.oz, h); buildMesh(ch); }
      else { const [X, Y, Z] = k.split(',').map(Number); const c = { cx: X, cy: Y, cz: Z, data: W.sampleChunk(X, Y, Z), mesh: null }; chunks.set(k, c); buildMesh(c); }
    }
    Deco.hole(h);
  };
  Scene.chunkCount = () => chunks.size;
  Scene.resetChunks = function () { for (const ch of chunks.values()) if (ch.mesh) { ch.mesh.geometry.dispose(); scene.remove(ch.mesh); } chunks.clear(); lastCenter = ''; buildQueue = []; };

  // ---------- far terrain (non-diggable ring out to the horizon) ----------
  let far = null, farAnchor = null;
  const FAR_IN = 44, FAR_OUT = 4200, NR = 56, NA = 120;
  function buildFar(p) {
    farAnchor = p.clone();
    const u = p.clone().normalize();
    const e1 = new T.Vector3().crossVectors(Math.abs(u.y) < 0.9 ? v3(0, 1, 0) : v3(1, 0, 0), u).normalize(), e2 = new T.Vector3().crossVectors(u, e1);
    const pos = new Float32Array(NR * NA * 3), cols = new Float32Array(NR * NA * 3);
    const base = u.clone().multiplyScalar(W.R);
    for (let i = 0; i < NR; i++) {
      const r = FAR_IN * Math.pow(FAR_OUT / FAR_IN, i / (NR - 1));
      for (let a = 0; a < NA; a++) {
        const t = a / NA * Math.PI * 2, x = base.x + (e1.x * Math.cos(t) + e2.x * Math.sin(t)) * r, y = base.y + (e1.y * Math.cos(t) + e2.y * Math.sin(t)) * r, z = base.z + (e1.z * Math.cos(t) + e2.z * Math.sin(t)) * r;
        const l = Math.hypot(x, y, z), dx = x / l, dy = y / l, dz = z / l, h = W.heightDir(dx, dy, dz), rr = W.R + h - (i === 0 ? 0.35 : 0.15);
        const n = (i * NA + a) * 3;
        pos[n] = dx * rr - O.x; pos[n + 1] = dy * rr - O.y; pos[n + 2] = dz * rr - O.z;
        const nz = W.noise(x / 60, y / 60, z / 60, 5);
        if (h > 320) tmpC.copy(P.snow); else if (h > 230) tmpC.copy(P.rock).lerp(P.snow, Math.max(0, (h - 300) / 20)); else tmpC.copy(P.grass).lerp(P.grass2, 0.5 + nz * 0.8).lerp(P.grassDry, Math.max(0, nz - 0.2));
        cols[n] = tmpC.r; cols[n + 1] = tmpC.g; cols[n + 2] = tmpC.b;
      }
    }
    const idx = [];
    for (let i = 0; i < NR - 1; i++) for (let a = 0; a < NA; a++) {
      const a2 = (a + 1) % NA, p0 = i * NA + a, p1 = i * NA + a2, p2 = (i + 1) * NA + a, p3 = (i + 1) * NA + a2;
      idx.push(p0, p2, p1, p1, p2, p3);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(cols, 3)); g.setIndex(idx);
    g.computeVertexNormals();
    // make sure the ring faces up (winding depends on e1/e2 handedness)
    const nn = g.getAttribute('normal'); const test = v3(nn.getX(NA * 5), nn.getY(NA * 5), nn.getZ(NA * 5));
    if (test.dot(u) < 0) { const ia = g.getIndex().array; for (let k = 0; k < ia.length; k += 3) { const s = ia[k + 1]; ia[k + 1] = ia[k + 2]; ia[k + 2] = s; } g.computeVertexNormals(); }
    if (far) { far.geometry.dispose(); far.geometry = g; } else { far = new T.Mesh(g, Scene.farMat); far.receiveShadow = true; scene.add(far); }
  }
  Scene.updateFar = function (p, force) { if (force || !farAnchor || farAnchor.distanceTo(p) > 8) buildFar(p); };

  // ---------- decorations: trees, bushes, rocks, grass tufts, flowers ----------
  const Deco = {
    types: {}, anchor: null, grassAnchor: null, items: [],
    build() {
      const lambert = (o) => new T.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.85, metalness: 0 }, o));
      const colorize = (geo, c) => { geo = geo.index ? geo.toNonIndexed() : geo; const n = geo.getAttribute('position').count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } geo.setAttribute('color', new T.BufferAttribute(a, 3)); if (geo.getAttribute('uv')) geo.deleteAttribute('uv'); return geo; };
      const merge = list => T.BufferGeometryUtils.mergeGeometries(list, false);
      const blob = (r, x, y, z, c, det = 2) => colorize(new T.IcosahedronGeometry(r, det).translate(x, y, z), c);
      // round tree
      const trunk = colorize(new T.CylinderGeometry(0.16, 0.26, 2.6, 9).translate(0, 1.3, 0), P.trunk);
      const roundTree = merge([trunk, blob(1.35, 0, 3.2, 0, P.leaf), blob(1.0, 0.85, 2.7, 0.3, P.leaf2), blob(0.95, -0.8, 2.8, -0.2, P.leaf), blob(0.9, 0.1, 3.9, -0.5, P.leaf2)]);
      // pine
      const pTrunk = colorize(new T.CylinderGeometry(0.13, 0.2, 1.4, 8).translate(0, 0.7, 0), P.trunk);
      const cone = (r, h, y) => colorize(new T.ConeGeometry(r, h, 12, 1).translate(0, y, 0), P.pine);
      const pine = merge([pTrunk, cone(1.4, 2.0, 2.0), cone(1.1, 1.7, 3.1), cone(0.75, 1.4, 4.1)]);
      // bush
      const bush = merge([blob(0.6, 0, 0.35, 0, P.bush), blob(0.48, 0.5, 0.28, 0.1, P.leaf2), blob(0.45, -0.45, 0.25, -0.1, P.leaf)]);
      // rock
      const rg = new T.IcosahedronGeometry(1, 2); const ra = rg.getAttribute('position');
      for (let i = 0; i < ra.count; i++) { const x = ra.getX(i), y = ra.getY(i), z = ra.getZ(i), f = 1 + W.noise(x * 1.7, y * 1.7, z * 1.7, 3) * 0.28; ra.setXYZ(i, x * f * 1.2, Math.max(-0.3, y * f * 0.7), z * f); }
      rg.computeVertexNormals(); const rock = colorize(rg, P.rock);
      // grass tuft
      const gp = [], gc = [];
      const cBase = col('#58a83a'), cTip = col('#b4e070');
      for (let b = 0; b < 11; b++) {
        const ang = b / 11 * Math.PI * 2 + Math.random() * 0.5, lean = 0.12 + Math.random() * 0.2, hgt = 0.13 + Math.random() * 0.16, w = 0.034;
        const rr0 = 0.03 + Math.random() * 0.09, ox = Math.cos(ang) * rr0, oz = Math.sin(ang) * rr0, dx = Math.cos(ang), dz = Math.sin(ang), px = -dz, pz = dx;
        const pts = [0, 0.5, 1].map(t => [ox + dx * lean * t * t * hgt * 3, hgt * t, oz + dz * lean * t * t * hgt * 3, w * (1 - t * 0.92)]);
        for (let s = 0; s < 2; s++) {
          const A = pts[s], B = pts[s + 1];
          const q = [[A[0] - px * A[3], A[1], A[2] - pz * A[3]], [A[0] + px * A[3], A[1], A[2] + pz * A[3]], [B[0] + px * B[3], B[1], B[2] + pz * B[3]], [B[0] - px * B[3], B[1], B[2] - pz * B[3]]];
          for (const k of [0, 1, 2, 0, 2, 3]) { gp.push(...q[k]); const t = q[k][1] / hgt; tmpC.copy(cBase).lerp(cTip, t); gc.push(tmpC.r, tmpC.g, tmpC.b); }
        }
      }
      const grass = new T.BufferGeometry(); grass.setAttribute('position', new T.Float32BufferAttribute(gp, 3)); grass.setAttribute('color', new T.Float32BufferAttribute(gc, 3));
      grass.computeVertexNormals();
      // tuft normals point up so the lighting matches the ground under it
      const gn = grass.getAttribute('normal'); for (let i = 0; i < gn.count; i++) gn.setXYZ(i, 0, 1, 0);
      // flower
      const flower = merge([colorize(new T.CylinderGeometry(0.012, 0.012, 0.3, 5).translate(0, 0.15, 0), col('#4a9a35')), blob(0.05, 0, 0.31, 0, col('#ffffff'), 1), blob(0.035, 0.05, 0.31, 0, col('#ffffff'), 1), blob(0.035, -0.05, 0.31, 0, col('#ffffff'), 1), blob(0.035, 0, 0.31, 0.05, col('#ffffff'), 1), blob(0.035, 0, 0.31, -0.05, col('#ffffff'), 1), blob(0.03, 0, 0.34, 0, col('#ffd23f'), 1)]);

      const grassMat = lambert({ side: T.DoubleSide, roughness: 1 });
      grassMat.onBeforeCompile = sh => {
        sh.uniforms.uTime = timeU;
        sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          float hh = max(position.y, 0.0);
          #ifdef USE_INSTANCING
            float ph = instanceMatrix[3].x * 0.9 + instanceMatrix[3].z * 1.3 + instanceMatrix[3].y * 0.7;
          #else
            float ph = 0.0;
          #endif
          transformed.x += sin(uTime * 2.1 + ph) * hh * hh * 0.8;
          transformed.z += cos(uTime * 1.7 + ph * 1.3) * hh * hh * 0.5;`);
        // both sides of a blade are lit like the ground under it (no dark back faces)
        sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n normal = normalize(vNormal); nonPerturbedNormal = normal;');
      };
      const mk = (geo, max, mat, shadow) => { const m = new T.InstancedMesh(geo, mat || lambert(), max); m.count = 0; m.castShadow = !!shadow; m.receiveShadow = true; m.frustumCulled = false; scene.add(m); return m; };
      this.types = {
        tree: mk(roundTree, 2500, null, true), pine: mk(pine, 2500, null, true), bush: mk(bush, 2500, null, true), rock: mk(rock, 1500, null, true),
        grass: mk(grass, 16000, grassMat, false), flower: mk(flower, 1500, null, false)
      };
      this.types.flower.instanceColor = null;
    },
    // place objects on a fixed 3D lattice sliced by the sea-level sphere, so they never move as you walk
    scatter(p, radius, cell, fn) {
      const u = p.clone().normalize(), e1 = new T.Vector3().crossVectors(Math.abs(u.y) < 0.9 ? v3(0, 1, 0) : v3(1, 0, 0), u).normalize(), e2 = new T.Vector3().crossVectors(u, e1);
      const seen = new Set(), step = cell * 0.5, n = Math.ceil(radius / step), b = u.clone().multiplyScalar(W.R);
      for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
        if (i * i + j * j > n * n) continue;
        const x = b.x + (e1.x * i + e2.x * j) * step, y = b.y + (e1.y * i + e2.y * j) * step, z = b.z + (e1.z * i + e2.z * j) * step;
        const l = Math.hypot(x, y, z), sx = x / l * W.R, sy = y / l * W.R, sz = z / l * W.R;
        const X = Math.floor(sx / cell), Y = Math.floor(sy / cell), Z = Math.floor(sz / cell), k = X + ',' + Y + ',' + Z;
        if (seen.has(k)) continue; seen.add(k); fn(X, Y, Z);
      }
    },
    put(mesh, i, x, y, z, s, yaw, tilt) {
      const l = Math.hypot(x, y, z), u = v3(x / l, y / l, z / l);
      const q = new T.Quaternion().setFromUnitVectors(v3(0, 1, 0), u).multiply(new T.Quaternion().setFromAxisAngle(v3(0, 1, 0), yaw));
      if (tilt) q.multiply(new T.Quaternion().setFromAxisAngle(v3(1, 0, 0), tilt));
      const m = new T.Matrix4().compose(v3(x - O.x, y - O.y, z - O.z), q, v3(s, s, s));
      mesh.setMatrixAt(i, m);
    },
    update(p, force) {
      if (force || !this.anchor || this.anchor.distanceTo(p) > 40) this.big(p);
      if (force || !this.grassAnchor || this.grassAnchor.distanceTo(p) > 6) this.small(p);
    },
    alive(x, y, z) {   // ground still there under this point (not dug away)?
      const l = Math.hypot(x, y, z);
      return W.solid(x - x / l * 0.15, y - y / l * 0.15, z - z / l * 0.15) > 0 && W.solid(x + x / l * 0.25, y + y / l * 0.25, z + z / l * 0.25) < 0;
    },
    big(p) {
      this.anchor = p.clone(); const t = this.types; t.tree.count = t.pine.count = t.bush.count = t.rock.count = 0; this.bigItems = [];
      const spawn = Scene.spawnPoint;
      this.scatter(p, 330, 9, (X, Y, Z) => {
        const r = W.hash01(X, Y, Z), jx = W.hash01(X, Y, Z + 7), jy = W.hash01(X + 3, Y, Z), jz = W.hash01(X, Y + 5, Z);
        let x = (X + jx) * 9, y = (Y + jy) * 9, z = (Z + jz) * 9; const l = Math.hypot(x, y, z);
        const forest = W.noise(x / 260, y / 260, z / 260, 77) + 0.05;
        const h = W.heightDir(x / l, y / l, z / l); if (h > 225) return;
        const rr = W.R + h - 0.1; x = x / l * rr; y = y / l * rr; z = z / l * rr;
        if (spawn && Math.hypot(x - spawn.x, y - spawn.y, z - spawn.z) < 12) return;
        if (!this.alive(x, y, z)) return;
        const yaw = r * 40, s = 0.8 + W.hash01(X + 1, Y + 1, Z + 1) * 0.6;
        let m = null;
        if (r < 0.06 + Math.max(0, forest) * 0.55) m = forest > 0.25 && r < 0.5 * forest ? t.pine : t.tree;
        else if (r > 0.93) m = t.bush; else if (r > 0.9) m = t.rock;
        if (!m || m.count >= m.instanceMatrix.count) return;
        const sc = m === t.rock ? 0.35 + s * 0.4 : s;
        this.put(m, m.count, x, y, z, sc, yaw, m === t.rock ? r * 3 : 0); this.bigItems.push([m, m.count, x, y, z, sc]); m.count++;
      });
      for (const k in t) if (k !== 'grass' && k !== 'flower') t[k].instanceMatrix.needsUpdate = true;
    },
    small(p) {
      this.grassAnchor = p.clone(); const g = this.types.grass, f = this.types.flower; g.count = f.count = 0; this.smallItems = [];
      const fc = [col('#ffffff'), col('#ffd23f'), col('#ff7aa8'), col('#a98bff'), col('#ff8a3d')];
      this.scatter(p, 28, 0.6, (X, Y, Z) => {
        const r = W.hash01(X, Y, Z); if (r > 0.9) return;
        let x = (X + W.hash01(X, Y, Z + 7)) * 0.6, y = (Y + W.hash01(X + 3, Y, Z)) * 0.6, z = (Z + W.hash01(X, Y + 5, Z)) * 0.6;
        const l = Math.hypot(x, y, z), h = W.heightDir(x / l, y / l, z / l); if (h > 215) return;
        const rr = W.R + h - 0.04; x = x / l * rr; y = y / l * rr; z = z / l * rr;
        if (!this.alive(x, y, z)) return;
        // keep tufts off steep slopes
        const ux = x / rr, uy = y / rr, uz = z / rr, e = 0.4;
        const gx = W.solid(x + e, y, z) - W.solid(x - e, y, z), gy = W.solid(x, y + e, z) - W.solid(x, y - e, z), gz = W.solid(x, y, z + e) - W.solid(x, y, z - e);
        const gl = Math.hypot(gx, gy, gz) || 1; if (-(gx * ux + gy * uy + gz * uz) / gl < 0.8) return;
        if (r < 0.02 && f.count < f.instanceMatrix.count) {
          this.put(f, f.count, x, y, z, 0.8 + r * 8, r * 90); f.setColorAt(f.count, fc[Math.floor(r * 1000) % fc.length]); this.smallItems.push([f, f.count, x, y, z, 1]); f.count++;
        } else if (g.count < g.instanceMatrix.count) {
          const s = 0.8 + W.hash01(X + 2, Y, Z) * 0.8; this.put(g, g.count, x, y, z, s, r * 60); this.smallItems.push([g, g.count, x, y, z, s]); g.count++;
        }
      });
      g.instanceMatrix.needsUpdate = true; f.instanceMatrix.needsUpdate = true; if (f.instanceColor) f.instanceColor.needsUpdate = true;
    },
    hole(h) {   // hide anything whose base was dug out
      const zero = new T.Matrix4().makeScale(0, 0, 0);
      for (const list of [this.smallItems || [], this.bigItems || []]) for (const it of list) {
        const [m, i, x, y, z] = it; if (it.gone) continue;
        if (Math.hypot(x - h[0], y - h[1], z - h[2]) < h[3] + (m === this.types.grass || m === this.types.flower ? 0.25 : 0.6)) {
          if (!this.alive(x, y, z)) { it.gone = true; m.setMatrixAt(i, zero); m.instanceMatrix.needsUpdate = true; }
        }
      }
    }
  };
  Scene.updateDeco = (p, force) => Deco.update(p, force);
  Scene._deco = Deco;

  // ---------- clouds: soft puffy blobs high above the start region ----------
  const Clouds = {
    build(center) {
      if (this.group) scene.remove(this.group);
      const g = new T.Group(), mat = new T.MeshStandardMaterial({ color: col('#ffffff'), emissive: col('#dfe9f5'), emissiveIntensity: 0.45, roughness: 1 });
      const u = center.clone().normalize(), e1 = new T.Vector3().crossVectors(Math.abs(u.y) < 0.9 ? v3(0, 1, 0) : v3(1, 0, 0), u).normalize(), e2 = new T.Vector3().crossVectors(u, e1);
      const parts = [];
      for (let i = 0; i < 46; i++) {
        const a = W.hash01(i, 1, 2) * Math.PI * 2, r = 250 + W.hash01(i, 3, 4) * 2600, alt = 380 + W.hash01(i, 5, 6) * 260, sz = 18 + W.hash01(i, 7, 8) * 34;
        const c = center.clone().addScaledVector(e1, Math.cos(a) * r).addScaledVector(e2, Math.sin(a) * r);
        const cu = c.clone().normalize(); c.copy(cu).multiplyScalar(W.R + W.heightDir(cu.x, cu.y, cu.z) * 0 + alt + 60);
        const n = 4 + Math.floor(W.hash01(i, 9, 9) * 4);
        for (let k = 0; k < n; k++) {
          const geo = new T.IcosahedronGeometry(sz * (0.55 + W.hash01(i, k, 11) * 0.5), 2);
          geo.scale(1, 0.62, 1);
          const off = e1.clone().multiplyScalar((k - n / 2) * sz * 0.7).addScaledVector(e2, (W.hash01(i, k, 12) - 0.5) * sz).addScaledVector(cu, W.hash01(i, k, 13) * sz * 0.35);
          const m = new T.Mesh(geo, mat); m.position.set(c.x + off.x - O.x, c.y + off.y - O.y, c.z + off.z - O.z);
          m.quaternion.setFromUnitVectors(v3(0, 1, 0), cu); g.add(m);
        }
      }
      this.group = g; scene.add(g); this.center = center.clone(); this.drift = e1.clone();
    },
    update(dt) { if (this.group) this.group.position.addScaledVector(this.drift, dt * 1.5); }
  };
  Scene.buildClouds = c => Clouds.build(c);

  // ---------- props near the start: signpost, crate ----------
  Scene.addProps = function (spawn, fwd, right) {
    const g = new T.Group();
    const wood = new T.MeshStandardMaterial({ color: col('#a8743f'), roughness: 0.8 });
    for (const px of [-0.68, 0.68]) { const post = new T.Mesh(new T.CylinderGeometry(0.06, 0.07, 2.1, 10), wood); post.position.set(px, 1.05, -0.06); post.castShadow = true; g.add(post); }
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 160; const c = cv.getContext('2d');
    c.fillStyle = '#d9a35f'; c.fillRect(0, 0, 512, 160); c.fillStyle = 'rgba(0,0,0,.08)'; for (let i = 0; i < 9; i++) c.fillRect(0, i * 18 + 4, 512, 3);
    c.fillStyle = '#4a2c14'; c.font = 'bold 54px "Nunito", sans-serif'; c.textAlign = 'center'; c.fillText(Scene.signText || '↓ CORE 6 371 km', 256, 98);
    const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
    const board = new T.Mesh(new T.RoundedBoxGeometry(1.7, 0.5, 0.08, 3, 0.04), [wood, wood, wood, wood, new T.MeshStandardMaterial({ map: tex, roughness: 0.8 }), wood]);
    board.position.y = 1.85; board.castShadow = true; g.add(board);
    // crate with a pickaxe leaning on it
    const crate = new T.Mesh(new T.RoundedBoxGeometry(0.7, 0.55, 0.55, 3, 0.05), new T.MeshStandardMaterial({ color: col('#b88447'), roughness: 0.75 }));
    crate.position.set(1.4, 0.27, 0.3); crate.rotation.y = 0.4; crate.castShadow = crate.receiveShadow = true; g.add(crate);
    const lantern = new T.Mesh(new T.SphereGeometry(0.11, 16, 12), new T.MeshStandardMaterial({ color: col('#ffd166'), emissive: col('#ffb030'), emissiveIntensity: 1.4 }));
    lantern.position.set(1.4, 0.68, 0.3); g.add(lantern);
    const base = W.R + W.heightDir(spawn.x / spawn.length(), spawn.y / spawn.length(), spawn.z / spawn.length());
    const at = spawn.clone().normalize().multiplyScalar(base).addScaledVector(fwd, 7).addScaledVector(right, 2.2);
    const u = at.clone().normalize(); const h2 = W.R + W.heightDir(u.x, u.y, u.z) - 0.05; at.copy(u).multiplyScalar(h2);
    Scene.propsAt = at.clone(); g.position.set(at.x - O.x, at.y - O.y, at.z - O.z);
    const m = new T.Matrix4().makeBasis(right, u, fwd.clone().negate()); g.quaternion.setFromRotationMatrix(m); g.rotateY(-0.5);
    scene.add(g); Scene.props = g;
  };

  // ---------- particles: dirt clods and dust ----------
  const Particles = {
    MAX: 500, list: [],
    build() {
      const geo = new T.IcosahedronGeometry(1, 0);
      this.mesh = new T.InstancedMesh(geo, new T.MeshStandardMaterial({ roughness: 0.95, flatShading: false }), this.MAX);
      this.mesh.count = 0; this.mesh.castShadow = true; this.mesh.frustumCulled = false; scene.add(this.mesh);
      for (let i = 0; i < this.MAX; i++) this.mesh.setColorAt(i, P.dirt);
      // dust puffs
      const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d');
      const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
      this.dustTex = new T.CanvasTexture(cv); this.dust = [];
    },
    burst(x, y, z, color, n, toward) {
      const u = v3(x, y, z).normalize();
      for (let i = 0; i < n; i++) {
        if (this.list.length >= this.MAX) this.list.shift();
        const d = v3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
        const vel = u.clone().multiplyScalar(2.2 + Math.random() * 2.5).addScaledVector(d, 1.6);
        if (toward) vel.addScaledVector(toward, 1.2);
        const c = color.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.08);
        this.list.push({ p: v3(x, y, z).addScaledVector(d, 0.1), v: vel, s: 0.035 + Math.random() * 0.06, life: 1.3 + Math.random() * 0.8, t: 0, rest: false, c, rot: Math.random() * 6 });
      }
      for (let i = 0; i < 3; i++) {
        const mat = new T.SpriteMaterial({ map: this.dustTex, color: color.clone().lerp(col('#e8dccb'), 0.5), transparent: true, opacity: 0.5, depthWrite: false });
        const sp = new T.Sprite(mat); const d = v3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.3);
        sp.userData = { p: v3(x, y, z).add(d).addScaledVector(u, 0.15), t: 0, life: 1.1 + Math.random() * 0.6, v: u.clone().multiplyScalar(0.4).add(d) };
        scene.add(sp); this.dust.push(sp);
      }
    },
    update(dt) {
      const m = new T.Matrix4(), q = new T.Quaternion();
      let n = 0;
      for (let i = this.list.length - 1; i >= 0; i--) {
        const p = this.list[i]; p.t += dt;
        if (p.t > p.life) { this.list.splice(i, 1); continue; }
        if (!p.rest) {
          const u = p.p.clone().normalize();
          p.v.addScaledVector(u, -16 * dt); p.p.addScaledVector(p.v, dt); p.rot += dt * 8;
          if (W.solid(p.p.x, p.p.y, p.p.z) > -p.s * 0.5) { p.p.addScaledVector(u, 0.03); p.v.multiplyScalar(-0.25); if (p.v.length() < 0.8) p.rest = true; }
        }
      }
      for (const p of this.list) {
        const k = Math.min(1, (p.life - p.t) / 0.4), s = p.s * k;
        q.setFromAxisAngle(v3(0.3, 1, 0.2).normalize(), p.rot);
        m.compose(v3(p.p.x - O.x, p.p.y - O.y, p.p.z - O.z), q, v3(s, s * 0.8, s));
        this.mesh.setMatrixAt(n, m); this.mesh.setColorAt(n, p.c); n++;
      }
      this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
      for (let i = this.dust.length - 1; i >= 0; i--) {
        const sp = this.dust[i], d = sp.userData; d.t += dt;
        if (d.t > d.life) { scene.remove(sp); sp.material.dispose(); this.dust.splice(i, 1); continue; }
        d.p.addScaledVector(d.v, dt); d.v.multiplyScalar(0.96);
        const k = d.t / d.life; sp.position.set(d.p.x - O.x, d.p.y - O.y, d.p.z - O.z); sp.scale.setScalar(0.35 + k * 1.1); sp.material.opacity = 0.45 * (1 - k);
      }
    }
  };
  Scene.burst = (x, y, z, c, n, toward) => Particles.burst(x, y, z, c, n, toward);

  // ---------- first-person hands (miner: hi-vis jacket, leather work gloves) and tools ----------
  const Hands = {
    tool: 'hands', swing: 0, swinging: false, bob: 0, groups: {},
    build() {
      const jacket = new T.MeshStandardMaterial({ color: col('#f08a24'), roughness: 0.7 });
      const stripe = new T.MeshStandardMaterial({ color: col('#e8eef2'), roughness: 0.3, metalness: 0.4, emissive: col('#555a5e'), emissiveIntensity: 0.3 });
      const glove = new T.MeshStandardMaterial({ color: col('#d7a65e'), roughness: 0.75 });
      const cuffM = new T.MeshStandardMaterial({ color: col('#b3854a'), roughness: 0.8 });
      const makeArm = (side) => {
        const arm = new T.Group();
        const sleeve = new T.Mesh(new T.CylinderGeometry(0.052, 0.062, 0.42, 18), jacket); sleeve.rotation.x = Math.PI / 2; sleeve.position.z = 0.2; arm.add(sleeve);
        const band = new T.Mesh(new T.CylinderGeometry(0.0545, 0.0555, 0.03, 18), stripe); band.rotation.x = Math.PI / 2; band.position.z = 0.12; arm.add(band);
        const cuff = new T.Mesh(new T.CylinderGeometry(0.047, 0.05, 0.05, 16), cuffM); cuff.rotation.x = Math.PI / 2; cuff.position.z = -0.02; arm.add(cuff);
        const hand = new T.Group(); hand.position.z = -0.07; arm.add(hand);
        const palm = new T.Mesh(new T.RoundedBoxGeometry(0.085, 0.038, 0.095, 3, 0.017), glove); hand.add(palm);
        const fingers = [];
        for (let f = 0; f < 4; f++) {
          const fg = new T.Group(); fg.position.set(-0.03 + f * 0.02, 0, -0.045); hand.add(fg);
          const seg = new T.Mesh(new T.CapsuleGeometry(0.0105, 0.035 - Math.abs(f - 1.5) * 0.004, 4, 8), glove); seg.rotation.x = Math.PI / 2; seg.position.z = -0.022; fg.add(seg);
          fingers.push(fg);
        }
        const th = new T.Group(); th.position.set(side * -0.045, 0.004, -0.01); hand.add(th);
        const ts = new T.Mesh(new T.CapsuleGeometry(0.012, 0.03, 4, 8), glove); ts.rotation.set(Math.PI / 2, 0, side * 0.9); ts.position.set(side * -0.012, 0, -0.016); th.add(ts);
        arm.userData = { hand, fingers, thumb: th };
        return arm;
      };
      // bare hands: two arms
      const gh = new T.Group();
      const L = makeArm(-1), Rr = makeArm(1); gh.add(L, Rr);
      gh.userData = { L, R: Rr }; gh.scale.setScalar(0.8); handScene.add(gh); this.groups.hands = gh;
      // shovel
      const gs = new T.Group();
      const woodM = new T.MeshStandardMaterial({ color: col('#c08a4e'), roughness: 0.6 });
      const steel = new T.MeshStandardMaterial({ color: col('#c9d2da'), roughness: 0.35, metalness: 0.3 });
      const paint = new T.MeshStandardMaterial({ color: col('#3d7fd6'), roughness: 0.45, metalness: 0.2 });
      const shovel = new T.Group();
      const shaft = new T.Mesh(new T.CylinderGeometry(0.017, 0.019, 0.95, 14), woodM); shaft.position.y = 0; shovel.add(shaft);
      const grip = new T.Mesh(new T.TorusGeometry(0.045, 0.012, 10, 20, Math.PI), paint); grip.position.y = 0.475; shovel.add(grip);
      const bar = new T.Mesh(new T.CylinderGeometry(0.013, 0.013, 0.09, 10), paint); bar.rotation.z = Math.PI / 2; bar.position.y = 0.52; shovel.add(bar);
      const collar = new T.Mesh(new T.CylinderGeometry(0.024, 0.03, 0.1, 14), steel); collar.position.y = -0.5; shovel.add(collar);
      const sh = new T.Shape(); sh.moveTo(-0.11, 0); sh.lineTo(0.11, 0); sh.lineTo(0.11, -0.2); sh.quadraticCurveTo(0.1, -0.29, 0, -0.33); sh.quadraticCurveTo(-0.1, -0.29, -0.11, -0.2); sh.lineTo(-0.11, 0);
      const blade = new T.Mesh(new T.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 3, curveSegments: 12 }), steel);
      blade.position.set(0, -0.54, -0.008); blade.rotation.x = -0.12; shovel.add(blade);
      const bladeTop = new T.Mesh(new T.RoundedBoxGeometry(0.23, 0.03, 0.03, 2, 0.01), paint); bladeTop.position.y = -0.545; shovel.add(bladeTop);
      // pose: blade forward at the bottom centre, face tilted toward the eye; shaft runs back to the lower right
      const B = v3(0.0, -0.3, -0.9), sDir = v3(-0.37, -0.04, -0.93).normalize();
      const toEye = B.clone().negate().normalize(), nF = toEye.clone().addScaledVector(sDir, -toEye.dot(sDir)).normalize();
      const Y = sDir.clone().negate(), Z = nF, X = new T.Vector3().crossVectors(Y, Z).normalize();
      shovel.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(X, Y, Z));
      shovel.position.copy(B).addScaledVector(Y, 0.54);
      gs.add(shovel);
      const along = d => shovel.position.clone().addScaledVector(Y, d);
      const SL = makeArm(-1), SR = makeArm(1);
      SL.position.copy(along(-0.16)).add(v3(-0.02, -0.035, 0)); SL.lookAt(SL.position.clone().add(v3(-0.45, -0.55, 1))); SL.rotateZ(-0.9);
      SR.position.copy(along(0.2)).add(v3(0.0, -0.035, 0)); SR.lookAt(SR.position.clone().add(v3(0.55, -0.45, 1))); SR.rotateZ(0.9);
      gs.add(SL, SR); gs.userData = { shovel, L: SL, R: SR }; gs.visible = false; handScene.add(gs); this.groups.shovel = gs;
      this.curl(gh.userData.L, 0.3); this.curl(gh.userData.R, 0.3); this.curl(SL, 1.4); this.curl(SR, 1.4);
    },
    curl(arm, a) { for (const f of arm.userData.fingers) f.rotation.x = -a; arm.userData.thumb.rotation.x = -a * 0.5; },
    set(tool) { this.tool = tool; this.groups.hands.visible = tool === 'hands'; this.groups.shovel.visible = tool === 'shovel'; },
    // k: 0..1 progress of the current dig stroke (or -1 when idle); walk: 0..1 speed; t: time
    update(k, walk, t, dt, look) {
      this.bob += dt * (4 + walk * 7) * (walk > 0.05 ? 1 : 0.3);
      const bx = Math.sin(this.bob) * 0.012 * (0.3 + walk), by = Math.abs(Math.cos(this.bob)) * 0.014 * (0.3 + walk) + Math.sin(t * 1.3) * 0.003;
      const sway = look || { x: 0, y: 0 };
      const s = k < 0 ? 0 : k;
      // stroke shape: wind up (0..0.3), strike (0.3..0.55), pull back (0.55..1)
      const strike = s < 0.3 ? -s / 0.3 * 0.4 : s < 0.55 ? -0.4 + (s - 0.3) / 0.25 * 1.4 : 1 - (s - 0.55) / 0.45;
      if (this.tool === 'hands') {
        const g = this.groups.hands, L = g.userData.L, Rr = g.userData.R;
        g.position.set(bx + sway.x, by + sway.y, 0);
        const reach = Math.max(0, strike);
        L.position.set(-0.2 + reach * 0.05, -0.155 - reach * 0.08 + Math.min(0, strike) * -0.05, -0.36 - reach * 0.2);
        Rr.position.set(0.2 - reach * 0.05, -0.155 - reach * 0.08 + Math.min(0, strike) * -0.05, -0.36 - reach * 0.2);
        L.rotation.set(0.22 - reach * 0.7 + Math.min(0, strike) * -0.4, 0.1, 0.25); Rr.rotation.set(0.22 - reach * 0.7 + Math.min(0, strike) * -0.4, -0.1, -0.25);
        const c = 0.3 + (s > 0.45 ? 1.1 : 0);
        this.curl(L, c); this.curl(Rr, c);
      } else {
        const g = this.groups.shovel, sv = g.userData.shovel;
        g.position.set(bx + sway.x, by + sway.y + Math.min(0, strike) * -0.06, Math.max(0, strike) * -0.22);
        g.rotation.x = -Math.max(0, strike) * 0.35 + Math.min(0, strike) * -0.25;
        g.rotation.z = -Math.max(0, strike) * 0.05;
      }
    }
  };
  Scene.setTool = t => Hands.set(t);
  Scene._hands = Hands; Scene._hc = () => handCam; Scene._sun = () => sun;

  // ---------- per frame ----------
  // eye: camera position (planet metres), q: camera orientation, info: { dig, walk, look }
  Scene.render = function (eye, q, info, dt, t) {
    timeU.value = t;
    // move the floating origin when the player wanders far from it
    if (eye.distanceTo(O) > 800) Scene.rebase(eye);
    camera.position.set(eye.x - O.x, eye.y - O.y, eye.z - O.z); camera.quaternion.copy(q);
    camera.updateMatrixWorld();
    sky.position.copy(camera.position);
    hemi.position.copy(up);
    sun.position.copy(camera.position).addScaledVector(sunDir, 120); sun.target.position.copy(camera.position);
    Particles.update(dt); Clouds.update(dt);
    Hands.update(info.dig, info.walk, t, dt, info.look);
    composer.render(dt);
    renderer.autoClear = false; renderer.clearDepth(); renderer.render(handScene, handCam); renderer.autoClear = true;
  };
  Scene.rebase = function (p) {
    O.set(Math.round(p.x), Math.round(p.y), Math.round(p.z));
    for (const ch of chunks.values()) if (ch.mesh) ch.mesh.position.set(ch.cx * W.CH - O.x, ch.cy * W.CH - O.y, ch.cz * W.CH - O.z);
    if (Scene.props) Scene.props.position.set(Scene.propsAt.x - O.x, Scene.propsAt.y - O.y, Scene.propsAt.z - O.z);
    Scene.updateFar(p, true); Deco.update(p, true); if (Clouds.center) Clouds.build(p);
  };
  Scene.setOrigin = function (p) { O.set(Math.round(p.x), Math.round(p.y), Math.round(p.z)); };
  Scene.renderer = () => renderer;

  root.Scene = Scene;
})(window);
