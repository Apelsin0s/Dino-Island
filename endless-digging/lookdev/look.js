// Look-dev scene: one meadow in the Ore Mountains, three art directions, rendered with the game's own engine
// (Three.js: physically based materials, sky lighting, cascaded soft sun shadows, ambient occlusion, bloom).
// URL: ?v=1|2|3 (variant) &q=draft|final &shots=wide,close
'use strict';
(function () {
  const T = THREE, S = SDF, A = Assets;
  const qs = new URLSearchParams(location.search);
  const VAR = qs.get('v') || '1', FINAL = (qs.get('q') || 'draft') === 'final', SHOTS = (qs.get('shots') || 'wide').split(',');
  const W = +(qs.get('w') || (FINAL ? 1600 : 800)), H = Math.round(W * 9 / 16), DPR = +(qs.get('dpr') || (FINAL ? 2 : 1));
  const NO = (qs.get('no') || '').split(',');           // skip parts while iterating: grass,trees,far,ao,hand,props
  const C = h => new T.Color(h), V3 = (x, y, z) => new T.Vector3(x, y, z);
  const t0 = performance.now(), log = m => console.log('[look ' + ((performance.now() - t0) / 1000).toFixed(1) + 's] ' + m);
  const sm = S.sstep, lerp = (a, b, t) => a + (b - a) * t;

  // ---------------------------------------------------------------- variants
  const VARIANTS = {
    '1': {   // soft vinyl toy: the closest to the reference
      sun: [-0.74, 0.62, -0.26], sunColor: '#fff1dc', sunI: 3.0, envI: 1.0, exposure: 1.0,
      sky: { zen: '#3f86e6', hor: '#d4e9fb', ground: '#7d9a58' }, fog: ['#d6e9f8', 0.00038],
      lawn: ['#74b952', '#93cf66', '#b6d872'], soil: ['#5a3a24', '#80573a'], pathC: '#bfa07a', forestC: '#3d7d4c',
      grass: 'tufts', tuft: { root: '#62b04a', tip: '#b2e476', width: 0.017, blades: 17 }, tuftK: 1, carpet: { root: '#70b54f', tip: '#a9dc74' },
      lumpy: 0, sheen: 0.55, leafBump: 0.016, gloss: 0,
      leaf: ['#4c9c46', '#a6dc6e'], spruce: ['#2a6f4a', '#62ae66'],
      pal: { glove: '#f1dcb6', gloveCuff: '#3d434c', glovePad: '#ee7d2b', gloveStrap: '#dfe3e6', sleeve: '#3f6fb8', band: '#e9edf0', awning1: '#f08a24', awning2: '#fff4e0' },
      grade: { sat: 1.05, con: 1.03, vig: 0.2 }
    },
    '2': {   // modelling clay, stop-motion feel
      sun: [-0.62, 0.55, -0.20], sunColor: '#ffe9c8', sunI: 2.7, envI: 0.8, exposure: 1.02,
      sky: { zen: '#3a86e0', hor: '#d6ecfb', ground: '#7a8a45' }, fog: ['#d4e9f7', 0.00030],
      lawn: ['#6fb848', '#90cc56', '#bbd65e'], soil: ['#5c3519', '#8a5428'], pathC: '#c79a5c', forestC: '#3a8440',
      grass: 'tufts', tuft: { root: '#4aa42c', tip: '#b6e04a', width: 0.03, blades: 9, hMin: 0.07, hMax: 0.14 }, tuftK: 0.75,
      lumpy: 1, sheen: 0, leafBump: 0.03, gloss: 1, clay: 1, tilt: 1,
      leaf: ['#3f9a2f', '#a4d845'], spruce: ['#1f6f3a', '#5fb44c'],
      pal: { glove: '#f6d27c', gloveCuff: '#7a4a2c', glovePad: '#e9502c', gloveStrap: '#fff1cf', sleeve: '#2f7fd0', band: '#fff1cf', awning1: '#e9502c', awning2: '#fff1cf' },
      grade: { sat: 1.12, con: 1.06, vig: 0.26 }
    },
    '3': {   // living nature: dense soft grass, late light
      sun: [-0.62, 0.38, -0.60], sunColor: '#ffe2b8', sunI: 3.3, envI: 0.8, exposure: 1.0,
      sky: { zen: '#3f7fd6', hor: '#e9e4d6', ground: '#64784a' }, fog: ['#e3e1d6', 0.00036],
      lawn: ['#55893c', '#739f49', '#94a958'], soil: ['#4e3220', '#74502f'], pathC: '#a98a63', forestC: '#2f6140',
      grass: 'dense', tuft: { root: '#4c8036', tip: '#a8c764', width: 0.011 }, tuftK: 1, carpet: { root: '#55893c', tip: '#86b354' },
      lumpy: 0.35, sheen: 0.25, leafBump: 0.045, gloss: 0, skyClouds: 1, treeBlend: 0.3,
      leaf: ['#35792f', '#8ec652'], spruce: ['#1b5437', '#4f9552'],
      pal: { glove: '#d9b684', gloveCuff: '#4a4038', glovePad: '#b9753a', gloveStrap: '#c9c2b6', sleeve: '#35517a', band: '#d9dde0', awning1: '#d9772c', awning2: '#f6ead6' },
      grade: { sat: 1.08, con: 1.06, vig: 0.28 }
    },
    '4': {   // clean worksite: smooth plain ground, sparse stylised details, crisp long shadows, white-orange equipment
      sun: [0.30, 0.40, 0.87], sunColor: '#fff2dc', sunI: 3.1, envI: 1.15, exposure: 1.0,
      sky: { zen: '#4a80e6', hor: '#d3e4f8', ground: '#aac48f' }, fog: ['#d8e7f7', 0.00028], skyDesat: 0.3, moon: [-0.30, 0.19, -0.93],
      lawn: ['#a9d07e', '#b6da8b', '#c6df95'], soil: ['#8d6c4f', '#a58463'], pathC: '#e2ded3', forestC: '#6aa56f',
      grass: 'sparse', tuft: { root: '#93c56c', tip: '#c9e89d', width: 0.03, blades: 6, hMin: 0.05, hMax: 0.11 }, tuftK: 1, flowerK: 0.22,
      lumpy: 0, sheen: 0, leafBump: 0, gloss: 0, clean: 1, noClouds: 1, shadowRadius: 1.3, bodyShadow: 1, handShadow: 1,
      leaf: ['#6db56a', '#b4e09a'], spruce: ['#4a8c66', '#8cc892'],
      pal: { glove: '#f4f2ee', gloveCuff: '#4b5563', glovePad: '#f08a24', gloveStrap: '#f08a24', sleeve: '#f5f4f0', band: '#f08a24' },
      grade: { sat: 1.0, con: 1.03, vig: 0.12 }
    }
  };
  // the chosen look: the clean worksite of variant 4 with the saturated colours of variant 2
  VARIANTS['5'] = Object.assign({}, VARIANTS['4'], {
    sky: { zen: '#3a86e0', hor: '#d6ecfb', ground: '#8fb060' }, fog: ['#d4e9f7', 0.00028],
    lawn: ['#6fb848', '#90cc56', '#bbd65e'], soil: ['#6b3f1f', '#93602f'], forestC: '#3a8440',
    tuft: { root: '#62b23c', tip: '#b6e04a', width: 0.03, blades: 6, hMin: 0.05, hMax: 0.11 },
    leaf: ['#3f9a2f', '#a4d845'], spruce: ['#1f6f3a', '#5fb44c'], grade: { sat: 1.1, con: 1.05, vig: 0.14 }
  });
  const V = VARIANTS[VAR];
  const sunDir = V3(V.sun[0], V.sun[1], V.sun[2]).normalize();

  // ---------------------------------------------------------------- land
  const fbm2 = (x, z, o) => S.fbm(x, 0.37, z, o || 3);
  const HC = { x: -0.55, z: -2.75 };                         // the hole dug with the spoon
  const BUCKET = { x: HC.x + 0.46, z: HC.z - 0.16 };
  const PATH = [[-1.5, 4], [-2.3, -1], [-3.5, -6], [-5.7, -11.5], [-7.7, -15.2], [-11, -22], [-18, -40], [-31, -80], [-47, -140], [-72, -260]];
  const STALL = { x: -5.6, z: -17.6, yaw: 0.5 };
  const VILLAGE = { x: -150, z: -830 };
  function pathDist(x, z) {
    let best = 1e9;
    for (let i = 0; i < PATH.length - 1; i++) {
      const ax = PATH[i][0], az = PATH[i][1], bx = PATH[i + 1][0], bz = PATH[i + 1][1], dx = bx - ax, dz = bz - az;
      let t = ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz); t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = x - ax - dx * t, ez = z - az - dz * t, d = ex * ex + ez * ez; if (d < best) best = d;
    }
    return Math.sqrt(best);
  }
  const pathMask = (x, z) => { if (z < -300 || Math.abs(x) > 90) return 0; return 1 - sm(0.3, 0.8, pathDist(x, z)); };
  function baseHeight(x, z) {
    const f = -z, d = Math.sqrt(x * x + z * z);
    let h = -29 * sm(-80, 640, f) + (f < 0 ? 0.03 * -f : 0);
    const r1 = 165 * (0.72 + 0.5 * fbm2(x / 800, 3.3, 2)), r2 = 330 * (0.75 + 0.5 * fbm2(x / 1100, 9.1, 2)), r3 = 430 * (0.8 + 0.5 * fbm2(x / 1500, 15.7, 2));
    const e1 = (f - 1150 + 150 * fbm2(x / 900, 1.1, 2)) / 360, e2 = (f - 2300 + 260 * fbm2(x / 1300, 5.5, 2)) / 600, e3 = (f - 3900) / 900;
    h += r1 * Math.exp(-e1 * e1) + r2 * Math.exp(-e2 * e2) + r3 * Math.exp(-e3 * e3);
    h += 16 * fbm2(x / 450 + 5.1, z / 450, 3) * sm(120, 700, d);
    h += 2.4 * fbm2(x / 75 + 1.7, z / 75, 3) * sm(18, 140, d);
    h += 0.20 * fbm2(x / 8.5 + 4.2, z / 8.5, 2) + 0.03 * fbm2(x / 1.9 + 8.8, z / 1.9, 2);
    h += 0.045 * x * (1 - sm(40, 400, Math.abs(x)));
    return h;
  }
  // the hole: a union of spoon-sized scoops (exactly what digging in the game produces, only finer)
  const scoops = []; { const r = S.rng(77); for (let i = 0; i < 22; i++) { const a = r() * 6.283, rad = 0.155 * Math.sqrt(r()), k = rad / 0.155; scoops.push({ x: HC.x + Math.cos(a) * rad * 1.15, z: HC.z + Math.sin(a) * rad * 0.9, R: 0.07 + r() * 0.03, dep: lerp(0.125, 0.04, Math.pow(k, 1.4)) + r() * 0.012 }); } }
  function holeDepth(x, z) {
    const dx = x - HC.x, dz = z - HC.z; if (dx * dx + dz * dz > 0.16) return 0;
    let D = 0;
    for (const s of scoops) { const r2 = (x - s.x) * (x - s.x) + (z - s.z) * (z - s.z); if (r2 >= s.R * s.R) continue; const cap = s.dep - (s.R - Math.sqrt(s.R * s.R - r2)); if (cap <= 0) continue; D = D === 0 ? cap : S.smax(D, cap, 0.014 * Math.min(1, Math.min(D, cap) / 0.015)); }
    return D;
  }
  function terrainY(x, z) {
    let h = baseHeight(x, z);
    const d2 = (x - HC.x) * (x - HC.x) + (z - HC.z) * (z - HC.z);
    if (d2 < 0.25) { const D = holeDepth(x, z); if (D > 0) h -= D; else { const d = Math.sqrt(d2); h += 0.011 * Math.exp(-((d - 0.2) / 0.045) * ((d - 0.2) / 0.045)) * (0.6 + 0.6 * S.noise(x * 23, 1.1, z * 23)); } }
    const pm = pathMask(x, z); if (pm > 0) h -= 0.03 * pm;
    return h;
  }
  function forest(x, z) {
    const f = -z; let m = fbm2(x / 230 + 3.3, z / 230, 3) * 1.7 + 0.16;
    m -= 2.0 * (1 - sm(0.8, 1.6, Math.hypot(x / 46, (f - 40) / 150)));      // open meadow corridor in front of the player
    m -= 1.5 * (1 - sm(60, 150, Math.hypot(x - VILLAGE.x, z - VILLAGE.z)));  // village clearing
    m -= 1.2 * (1 - sm(0, 25, pathDist(x, z)));
    m += 0.45 * sm(1500, 2600, f);
    return m;
  }

  // ---------------------------------------------------------------- renderer
  const canvas = document.getElementById('c');
  const renderer = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.setPixelRatio(DPR); renderer.setSize(W, H, false);
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.NeutralToneMapping; renderer.toneMappingExposure = V.exposure;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap;
  const scene = new T.Scene();
  scene.fog = new T.FogExp2(C(V.fog[0]), V.fog[1]);
  const camera = new T.PerspectiveCamera(58, W / H, 0.08, 9500); scene.add(camera);

  // ---------------------------------------------------------------- procedural shading helpers
  const NOISE = `
    float pdH(vec3 p){ p = fract(p*vec3(0.1031,0.1030,0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.x+p.y)*p.z); }
    vec4 pdN(vec3 x){ vec3 p = floor(x); vec3 w = fract(x); vec3 u = w*w*w*(w*(w*6.0-15.0)+10.0); vec3 du = 30.0*w*w*(w*(w-2.0)+1.0);
      float a = pdH(p), b = pdH(p+vec3(1.0,0.0,0.0)), c = pdH(p+vec3(0.0,1.0,0.0)), d = pdH(p+vec3(1.0,1.0,0.0)), e = pdH(p+vec3(0.0,0.0,1.0)), f = pdH(p+vec3(1.0,0.0,1.0)), g = pdH(p+vec3(0.0,1.0,1.0)), h = pdH(p+vec3(1.0,1.0,1.0));
      float k0=a, k1=b-a, k2=c-a, k3=e-a, k4=a-b-c+d, k5=a-c-e+g, k6=a-b-e+f, k7=-a+b+c-d+e-f-g+h;
      return vec4(-1.0+2.0*(k0+k1*u.x+k2*u.y+k3*u.z+k4*u.x*u.y+k5*u.y*u.z+k6*u.z*u.x+k7*u.x*u.y*u.z),
        2.0*du*vec3(k1+k4*u.y+k6*u.z+k7*u.y*u.z, k2+k5*u.z+k4*u.x+k7*u.z*u.x, k3+k6*u.x+k5*u.y+k7*u.x*u.y)); }
    vec4 pdFbm(vec3 p, float f, int oct){ vec4 s = vec4(0.0); float a = 0.5; float ff = f; p *= f; for (int i = 0; i < 6; i++){ if (i >= oct) break; vec4 n = pdN(p); s.x += a*n.x; s.yzw += a*ff*n.yzw; a *= 0.5; p = p*2.03 + vec3(31.7,17.3,5.9); ff *= 2.03; } return s; }
    vec4 pdCell(vec3 p){ vec3 ip = floor(p), fp = fract(p); float md = 9.0; vec3 mr = vec3(0.0); float id = 0.0;
      for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){ vec3 g = vec3(float(i), float(j), float(k)); vec3 q = ip + g; vec3 o = vec3(pdH(q), pdH(q+17.1), pdH(q+41.7)); vec3 r = g + o - fp; float d = dot(r, r); if (d < md){ md = d; mr = r; id = o.x; } }
      return vec4(-mr, id); }
    float pdFade(float c){ return clamp(1.3 - c*2.0, 0.0, 1.0); }
  `;
  let matId = 0;
  function pd(mat, o) {
    const id = 'pd' + (matId++), world = o.space !== 'object';
    mat.onBeforeCompile = sh => {
      if (o.uniforms) Object.assign(sh.uniforms, o.uniforms);
      sh.vertexShader = 'varying vec3 vPd;\n' + (o.vdecl || '') + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + (o.vertex || '') + (world ? '\n{ vec4 pdW = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n pdW = instanceMatrix * pdW;\n#endif\n vPd = (modelMatrix * pdW).xyz; }\n' : '\n vPd = position;\n'));
      let fs = 'varying vec3 vPd;\n' + (world ? '#define PD_TOVIEW mat3(viewMatrix)\n' : 'uniform mat3 normalMatrix;\n#define PD_TOVIEW normalMatrix\n') + NOISE + (o.fdecl || '') + sh.fragmentShader;
      if (o.color) fs = fs.replace('#include <color_fragment>', '#include <color_fragment>\n{ vec3 P = vPd;\n' + o.color + '\n}');
      if (o.rough) fs = fs.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n{ vec3 P = vPd;\n' + o.rough + '\n}');
      const clay = V.clay ? (world ? 'vec4 ncl = pdFbm(P, 11.0, 2); G += ncl.yzw*0.008*pdFade(px*22.0); vec4 ncl2 = pdFbm(P + 3.1, 2.6, 2); G += ncl2.yzw*0.03*pdFade(px*5.2);' : 'vec4 ncl = pdFbm(P, 55.0, 2); G += ncl.yzw*0.0009;') : '';
      if (o.normal || clay) fs = fs.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n{ vec3 P = vPd; vec3 G = vec3(0.0); float px = length(fwidth(P));\n' + (o.normal || '') + clay + '\n vec3 gv = PD_TOVIEW * G; gv -= normal * dot(gv, normal); normal = normalize(normal - gv); }');
      if (o.noFlip) fs = fs.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n normal = normalize(vNormal); nonPerturbedNormal = normal;');
      if (o.post) fs = fs.replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n{ vec3 P = vPd;\n' + o.post + '\n}');
      sh.fragmentShader = fs;
    };
    mat.customProgramCacheKey = () => id;
    return mat;
  }
  const U = (v) => ({ value: v });
  const gloss = V.gloss;   // clay variant: waxy highlight on everything
  const std = (p) => new T.MeshPhysicalMaterial(Object.assign({ roughness: 0.8, metalness: 0, clearcoat: gloss ? 0.35 : 0, clearcoatRoughness: 0.45 }, p));

  // ---------------------------------------------------------------- materials
  const soilU = { uS1: U(C(V.soil[0])), uS2: U(C(V.soil[1])), uPeb: U(C('#b9ad9a')) };
  const soilColor = `
    vec3 soilc = mix(uS1, uS2, clamp(0.4 + pdFbm(P, 16.0, 3).x*0.9, 0.0, 1.0));
    vec4 cl = pdCell(P*44.0); { float pr = 0.12 + 0.2*fract(cl.w*7.3); soilc = mix(soilc, uPeb*(0.55+0.6*fract(cl.w*3.1)), smoothstep(pr + 0.06, pr, length(cl.xyz))*step(0.9, cl.w)); }
    diffuseColor.rgb = soilc;`;
  const soilNormal = `vec4 n3 = pdFbm(P, 62.0, 3); G += n3.yzw*0.0042*pdFade(px*250.0);`;
  const soilDecl = 'uniform vec3 uS1; uniform vec3 uS2; uniform vec3 uPeb;\n';
  const M = {};
  // variant 4: plain, softly painted ground; a dug place has a neat dark rim; the service track is pale with a yellow line
  const CLEAN_COLOR = `
      float patch1 = pdFbm(P, 0.16, 2).x, patch2 = pdFbm(P + 7.3, 0.035, 2).x;
      vec3 lawn = mix(uG1, uG2, clamp(0.5 + patch1*0.9, 0.0, 1.0));
      lawn = mix(lawn, uG3, clamp(patch2*1.4, 0.0, 1.0)*0.5);
      lawn = mix(lawn, uForestC, smoothstep(0.0, 0.35, vForest));
      { float pxc = length(fwidth(P)); lawn *= 1.0 + 0.045*pdFbm(P, 1.4, 2).x + 0.03*pdFbm(P, 9.0, 2).x*pdFade(pxc*18.0); vec4 fl = pdCell(P*vec3(70.0, 20.0, 70.0)); lawn *= 1.0 + (fl.w - 0.5)*0.09*smoothstep(0.45, 0.2, length(fl.xyz))*pdFade(pxc*70.0); }
      vec3 col = lawn;
      if (vDepth > 0.0003) {
        float dn = vDepth + pdFbm(P, 40.0, 2).x*0.0012;
        vec3 soilc = mix(uS1, uS2, clamp(0.5 + pdFbm(P, 5.0, 2).x*0.7, 0.0, 1.0));
        soilc *= mix(1.0, 0.82, smoothstep(0.03, 0.11, vDepth));
        vec3 edge = mix(uS1*0.5, soilc, smoothstep(0.005, 0.013, dn));
        col = mix(lawn, edge, smoothstep(0.0008, 0.0055, dn));
      }
      float pm = smoothstep(0.50, 0.56, vPathV);
      if (pm > 0.005) {
        vec3 pc = uPathC*(0.95 + 0.06*pdFbm(P, 1.2, 2).x);
        float line = smoothstep(0.585, 0.60, vPathV)*(1.0 - smoothstep(0.69, 0.705, vPathV));
        pc = mix(pc, vec3(0.93, 0.66, 0.16), line*0.92);
        col = mix(col, pc, pm);
      }
      diffuseColor.rgb = col;`;
  const CLEAN_NORMAL = `
      float soilK = smoothstep(0.0012, 0.004, vDepth), pmN = smoothstep(0.50, 0.56, vPathV);
      vec4 n1 = pdFbm(P, 2.2, 2); G += n1.yzw*0.012*(1.0 - soilK)*(1.0 - pmN)*pdFade(px*4.4);
      if (soilK > 0.0) { vec4 n3 = pdFbm(P, 26.0, 2); G += n3.yzw*0.0016*soilK*pdFade(px*52.0); vec4 n6 = pdFbm(P, 7.0, 2); G += n6.yzw*0.004*soilK; }`;
  M.terrain = pd(new T.MeshPhysicalMaterial({ roughness: 0.88, metalness: 0, sheen: V.sheen, sheenRoughness: 0.55, sheenColor: C(V.lawn[1]).multiplyScalar(0.9), clearcoat: gloss ? 0.2 : 0, clearcoatRoughness: 0.5 }), {
    uniforms: Object.assign({ uG1: U(C(V.lawn[0])), uG2: U(C(V.lawn[1])), uG3: U(C(V.lawn[2])), uPathC: U(C(V.pathC)), uForestC: U(C(V.forestC)) }, soilU),
    vdecl: 'attribute float aDepth; attribute float aPath; attribute float aForest; varying float vDepth; varying float vPathV; varying float vForest;\n',
    vertex: 'vDepth = aDepth; vPathV = aPath; vForest = aForest;',
    fdecl: 'varying float vDepth; varying float vPathV; varying float vForest; uniform vec3 uG1; uniform vec3 uG2; uniform vec3 uG3; uniform vec3 uPathC; uniform vec3 uForestC;\n' + soilDecl,
    color: V.clean ? CLEAN_COLOR : `
      float patch1 = pdFbm(P, 0.33, 3).x, patch2 = pdFbm(P + 7.3, 0.045, 2).x;
      vec3 lawn = mix(uG1, uG2, clamp(0.5 + patch1*1.1, 0.0, 1.0));
      lawn = mix(lawn, uG3, clamp(patch2*1.6 - 0.15, 0.0, 1.0)*0.55);
      lawn = mix(lawn, uForestC, smoothstep(0.0, 0.35, vForest));
      { float pxc = length(fwidth(P)); lawn *= 1.0 + 0.11*pdFbm(P*vec3(1.0, 0.3, 1.0), 48.0, 2).x*pdFade(pxc*96.0) + 0.07*pdFbm(P, 9.0, 2).x*pdFade(pxc*18.0); }
      vec3 col = lawn;
      if (vDepth > 0.0005) {
        float dn = vDepth + pdFbm(P, 60.0, 2).x*0.005;
        vec3 soilc = mix(uS1, uS2, clamp(0.38 + pdFbm(P, 16.0, 3).x*0.9 - vDepth*2.0, 0.0, 1.0));
        vec4 cl = pdCell(P*44.0); { float pr = 0.12 + 0.2*fract(cl.w*7.3); soilc = mix(soilc, uPeb*(0.55+0.6*fract(cl.w*3.1)), smoothstep(pr + 0.06, pr, length(cl.xyz))*step(0.9, cl.w)); }
        soilc *= mix(1.0, 0.72, smoothstep(0.03, 0.11, vDepth));
        vec3 edge = mix(mix(lawn*0.6, uS1, 0.65), soilc, smoothstep(0.006, 0.02, dn));
        col = mix(lawn, edge, smoothstep(0.002, 0.006, dn));
      }
      float pm = smoothstep(0.42, 0.62, vPathV + pdFbm(P, 2.6, 2).x*0.22);
      if (pm > 0.005) {
        vec3 pc = uPathC*(0.86 + 0.24*pdFbm(P, 7.0, 3).x);
        vec4 c2 = pdCell(P*24.0); pc = mix(pc, uPeb*(0.85+0.3*c2.w), smoothstep(0.27, 0.19, length(c2.xyz))*step(0.78, c2.w)*0.85);
        col = mix(col, pc, pm);
      }
      diffuseColor.rgb = col;`,
    rough: 'roughnessFactor = mix(0.88, 1.0, max(smoothstep(0.003, 0.012, vDepth), smoothstep(0.42, 0.62, vPathV)));',
    normal: V.clean ? CLEAN_NORMAL : `
      float soilK = smoothstep(0.003, 0.012, vDepth), pmN = smoothstep(0.42, 0.62, vPathV);
      vec4 n1 = pdFbm(P, 7.0, 3); G += n1.yzw*0.015*(1.0 - soilK)*(1.0 - pmN)*pdFade(px*28.0);
      vec4 n5 = pdFbm(P, 30.0, 2); G += n5.yzw*0.0026*(1.0 - soilK)*(1.0 - pmN)*pdFade(px*60.0);
      vec4 n2 = pdFbm(P, 95.0, 2); G += n2.yzw*0.0007*(1.0 - soilK)*pdFade(px*190.0);
      if (soilK > 0.0) { vec4 n3 = pdFbm(P, 62.0, 3); G += n3.yzw*0.0058*soilK*pdFade(px*250.0); vec4 n6 = pdFbm(P, 17.0, 2); G += n6.yzw*0.006*soilK; }
      if (pmN > 0.0) { vec4 n4 = pdFbm(P, 30.0, 3); G += n4.yzw*0.004*pmN*pdFade(px*120.0); }`,
    post: '#ifdef USE_SHEEN\n material.sheenColor *= (1.0 - smoothstep(0.003, 0.012, vDepth))*(1.0 - smoothstep(0.42, 0.62, vPathV));\n#endif'
  });
  M.soil = pd(std({ roughness: 1 }), { uniforms: soilU, fdecl: soilDecl, color: V.clean ? 'diffuseColor.rgb = mix(uS1, uS2, clamp(0.5 + pdFbm(P, 5.0, 2).x*0.7, 0.0, 1.0));' : soilColor, normal: V.clean ? 'vec4 n3 = pdFbm(P, 26.0, 2); G += n3.yzw*0.0016;' : soilNormal });
  M.soilObj = pd(std({ roughness: 1 }), { space: 'object', uniforms: soilU, fdecl: soilDecl, color: V.clean ? 'diffuseColor.rgb = mix(uS1, uS2, clamp(0.5 + pdFbm(P, 20.0, 2).x*0.7, 0.0, 1.0));' : soilColor.replace(/16\.0/, '60.0').replace(/44\.0/, '160.0'), normal: V.clean ? 'vec4 n3 = pdFbm(P, 90.0, 2); G += n3.yzw*0.0006;' : 'vec4 n3 = pdFbm(P, 220.0, 3); G += n3.yzw*0.0011;' });
  M.crown = pd(std({ vertexColors: true, roughness: 0.78, sheen: 0.35, sheenRoughness: 0.6, sheenColor: C(V.leaf[1]) }), {
    color: 'diffuseColor.rgb *= 0.92 + 0.18*pdFbm(P, 0.9, 2).x;',
    normal: `vec4 cl = pdCell(P*5.2); G += -2.0*cl.xyz*5.2*${V.leafBump.toFixed(4)}*pdFade(px*10.0); vec4 n = pdFbm(P, 26.0, 2); G += n.yzw*0.0018*pdFade(px*52.0);`
  });
  M.spruce = pd(std({ vertexColors: true, roughness: 0.82, sheen: 0.25, sheenRoughness: 0.6, sheenColor: C(V.spruce[1]) }), {
    color: 'diffuseColor.rgb *= 0.9 + 0.2*pdFbm(P, 0.7, 2).x;',
    normal: `vec4 n = pdFbm(P*vec3(1.0, 0.45, 1.0), 16.0, 3); G += n.yzw*vec3(1.0, 0.45, 1.0)*${(0.004 + V.leafBump * 0.12).toFixed(4)}*pdFade(px*64.0);`
  });
  M.spruceFar = std({ vertexColors: true, roughness: 0.9 });
  M.bark = pd(std({ color: C('#7a5638'), vertexColors: true, roughness: 0.9 }), {
    color: 'diffuseColor.rgb *= 0.85 + 0.25*pdFbm(P*vec3(9.0, 1.6, 9.0), 1.0, 3).x;',
    normal: 'vec4 n = pdFbm(P*vec3(13.0, 2.2, 13.0), 1.0, 3); G += n.yzw*vec3(13.0, 2.2, 13.0)*0.006*pdFade(px*52.0);'
  });
  M.rock = pd(std({ vertexColors: true, roughness: 0.85 }), {
    uniforms: { uRock: U(C(V.clean ? '#cfccd6' : '#b3aa9a')), uMoss: U(C(V.lawn[0]).multiplyScalar(0.85)) }, fdecl: 'uniform vec3 uRock; uniform vec3 uMoss;\n',
    color: `vec3 Nw = normalize((vec4(normalize(vNormal), 0.0)*viewMatrix).xyz); float sp = pdCell(P*110.0).w;
      vec3 rc = uRock*(0.84 + 0.3*pdFbm(P, 3.0, 3).x)*(0.9 + 0.2*sp)*diffuseColor.rgb;
      float moss = smoothstep(0.42, 0.72, Nw.y + pdFbm(P, 4.0, 3).x*0.4);
      diffuseColor.rgb = mix(rc, uMoss, moss*${V.clean ? '0.0' : '0.8'});`,
    normal: 'vec4 n = pdFbm(P, 13.0, 3); G += n.yzw*0.004*pdFade(px*52.0);'
  });
  M.tuft = pd(std({ vertexColors: true, roughness: 0.62, side: T.DoubleSide, sheen: 0.12, sheenRoughness: 0.5, sheenColor: C(V.tuft.tip) }), { noFlip: true, color: 'diffuseColor.rgb *= 0.9 + 0.2*pdFbm(P, 0.45, 2).x;' });
  M.flower = std({ vertexColors: true, roughness: 0.6, side: T.DoubleSide });
  M.glove = pd(std({ vertexColors: true, roughness: 0.55, sheen: 0.35, sheenRoughness: 0.4, sheenColor: C('#ffd9c4') }), {
    space: 'object', color: 'diffuseColor.rgb *= 0.97 + 0.04*pdFbm(P, 60.0, 2).x;', normal: 'vec4 n = pdFbm(P, 140.0, 2); G += n.yzw*0.00012;'
  });
  M.sleeve = pd(std({ vertexColors: true, roughness: 0.8, sheen: 0.6, sheenRoughness: 0.45, sheenColor: C('#ffd9b0') }), {
    space: 'object', color: 'diffuseColor.rgb *= 0.94 + 0.08*pdFbm(P, 30.0, 2).x;',
    normal: 'vec4 n = pdFbm(P, 420.0, 2); G += n.yzw*0.00008; vec4 n2 = pdFbm(P, 22.0, 2); G += n2.yzw*0.0011;'
  });
  M.steel = pd(new T.MeshPhysicalMaterial({ color: C('#dfe3e6'), metalness: 1, roughness: 0.2, envMapIntensity: 1.25 }), { space: 'object', rough: 'roughnessFactor = clamp(0.19 + 0.09*pdFbm(P, 240.0, 2).x, 0.06, 1.0);' });
  M.zinc = pd(new T.MeshPhysicalMaterial({ color: C('#c3cace'), metalness: 0.9, roughness: 0.42, side: T.DoubleSide }), { space: 'object', color: 'vec4 cl = pdCell(P*42.0); diffuseColor.rgb *= 0.9 + 0.13*cl.w;' });
  M.wood = pd(std({ vertexColors: true, roughness: 0.75, side: T.DoubleSide }), { color: 'diffuseColor.rgb *= 0.86 + 0.22*pdFbm(P*vec3(5.0, 26.0, 5.0), 1.0, 2).x;', normal: 'vec4 n = pdFbm(P*vec3(8.0, 40.0, 8.0), 1.0, 2); G += n.yzw*vec3(8.0, 40.0, 8.0)*0.0006*pdFade(px*80.0);' });
  M.house = std({ vertexColors: true, roughness: 0.85 });
  M.cloud = new T.MeshStandardMaterial({ color: C('#ffffff'), roughness: 1, emissive: C('#e6eef8'), emissiveIntensity: 0.62, fog: false, vertexColors: true });
  M.paint = new T.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, metalness: 0, clearcoat: 0.45, clearcoatRoughness: 0.25 });
  M.stone = new T.MeshStandardMaterial({ color: C('#d9d1c0'), roughness: 0.95, flatShading: true });
  M.silver = new T.MeshPhysicalMaterial({ color: C('#f1f1ee'), metalness: 1, roughness: 0.28, envMapIntensity: 1.6 });

  // ---------------------------------------------------------------- sky and image-based light
  function skyMaterial(disc) {
    return new T.ShaderMaterial({
      uniforms: { uZen: U(C(V.sky.zen)), uHor: U(C(V.sky.hor)), uGround: U(C(V.sky.ground)), uSun: U(sunDir), uSunCol: U(C(V.sunColor)), uDisc: U(disc ? 1 : 0), uDesat: U(disc ? 0 : (V.skyDesat === undefined ? 0.45 : V.skyDesat)), uClouds: U(V.skyClouds ? 1 : 0), uMoonOn: U(V.moon && disc ? 1 : 0), uMoon: U(V.moon ? V3(V.moon[0], V.moon[1], V.moon[2]).normalize() : V3(0, 1, 0)) },
      side: T.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 uZen; uniform vec3 uHor; uniform vec3 uGround; uniform vec3 uSun; uniform vec3 uSunCol; uniform float uDisc; uniform float uDesat; uniform float uClouds; uniform float uMoonOn; uniform vec3 uMoon; varying vec3 vDir;
        float h2(vec2 p){ p = fract(p*vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y)*p.x); }
        float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0 - 2.0*f); return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), f.x), f.y); }
        float fb(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a*n2(p); p = p*2.03 + vec2(17.1, 9.3); a *= 0.5; } return s; }
        void main(){ vec3 d = normalize(vDir); float h = d.y;
          vec3 c = mix(uHor, uZen, pow(clamp(h, 0.0, 1.0), 0.42));
          c = mix(c, uHor, exp(-max(h, 0.0)*11.0)*0.75);
          float s = max(dot(d, uSun), 0.0);
          c += uSunCol*(pow(s, 5.0)*0.10 + pow(s, 48.0)*0.30);
          c += uSunCol*uDisc*smoothstep(0.99935, 0.9997, s)*24.0;
          if (h < 0.0) c = mix(uHor, uGround, smoothstep(0.0, -0.10, h));
          if (uClouds > 0.5 && h > 0.0) {
            vec2 uv = d.xz/(h + 0.11)*0.55 + vec2(3.7, 1.9);
            float dn = fb(uv*0.8), cov = smoothstep(0.56, 0.72, dn + 0.05*fb(uv*4.0));
            float lit = clamp(0.55 + (dn - fb(uv*0.8 + normalize(uSun.xz + 1e-4)*0.2))*2.4, 0.0, 1.0);
            vec3 cc = mix(vec3(0.80, 0.83, 0.90), vec3(1.0, 0.97, 0.92)*1.1, lit);
            c = mix(c, cc, cov*smoothstep(0.015, 0.14, h)*0.93);
          }
          if (uMoonOn > 0.5) {
            float m = dot(d, uMoon); vec3 v = (d - uMoon*m)/0.030;                       // offset on the disc, radius about 1.7 degrees
            float r2 = dot(v, v), disc2 = 1.0 - smoothstep(0.92, 1.0, r2);
            vec3 s2 = normalize(uSun - uMoon*dot(uSun, uMoon));
            float lit = smoothstep(-0.06, 0.06, dot(v, s2) + 0.5*sqrt(max(0.0, 1.0 - r2)));
            vec3 mc = mix(vec3(0.96, 0.97, 1.0), vec3(0.80, 0.85, 0.95), smoothstep(0.42, 0.62, fb(v.xy*2.3 + v.z*1.7 + 4.0)));
            c = mix(c, mc, disc2*lit*0.62*step(0.0, m));
          }
          c = mix(c, vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), uDesat);
          gl_FragColor = vec4(c, 1.0); }`
    });
  }
  const sky = new T.Mesh(new T.SphereGeometry(8800, 48, 24), skyMaterial(true)); sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);
  { const es = new T.Scene(); es.add(new T.Mesh(new T.SphereGeometry(40, 32, 16), skyMaterial(false))); const pm = new T.PMREMGenerator(renderer); scene.environment = pm.fromScene(es, 0.01).texture; scene.environmentIntensity = V.envI; pm.dispose(); }
  const sun = new T.SunLight(C(V.sunColor), V.sunI); sun.position.copy(sunDir).multiplyScalar(100); sun.castShadow = true;
  sun.shadow.mapSize.set(FINAL ? 4096 : 2048, FINAL ? 4096 : 2048); sun.shadow.camera.far = 110; sun.shadow.radius = V.shadowRadius ? V.shadowRadius * (FINAL ? 1 : 0.7) : (FINAL ? 3.2 : 2.2); sun.shadow.bias = -0.00035; sun.shadow.normalBias = 0.02;
  scene.add(sun);
  log('renderer + sky ready');

  // ---------------------------------------------------------------- terrain meshes (nested levels, finest around the hole)
  function level(cx, cz, size, cell, inner, drop, eps, withForest) {
    const n = Math.round(size / cell) + 1, pos = new Float32Array(n * n * 3), nor = new Float32Array(n * n * 3), dep = new Float32Array(n * n), pth = new Float32Array(n * n), fr = new Float32Array(n * n), x0 = cx - size / 2, z0 = cz - size / 2;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = x0 + i * cell, z = z0 + j * cell, k = j * n + i; let y = terrainY(x, z);
      const hx = terrainY(x + eps, z) - terrainY(x - eps, z), hz = terrainY(x, z + eps) - terrainY(x, z - eps), l = Math.hypot(hx, 2 * eps, hz);
      nor[k * 3] = -hx / l; nor[k * 3 + 1] = 2 * eps / l; nor[k * 3 + 2] = -hz / l;
      dep[k] = holeDepth(x, z); pth[k] = pathMask(x, z); fr[k] = withForest ? forest(x, z) : -1;
      if (inner) { const m = Math.min(x - inner[0], inner[1] - x, z - inner[2], inner[3] - z); if (m > 0) y -= drop * sm(0, inner[4], m); }   // tuck under the finer level
      pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
    }
    const idx = new Uint32Array((n - 1) * (n - 1) * 6); let o = 0;
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) { const a = j * n + i, b = a + n; idx[o++] = a; idx[o++] = b; idx[o++] = a + 1; idx[o++] = a + 1; idx[o++] = b; idx[o++] = b + 1; }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(nor, 3));
    g.setAttribute('aDepth', new T.BufferAttribute(dep, 1)); g.setAttribute('aPath', new T.BufferAttribute(pth, 1)); g.setAttribute('aForest', new T.BufferAttribute(fr, 1)); g.setIndex(new T.BufferAttribute(idx, 1));
    const m = new T.Mesh(g, M.terrain); m.receiveShadow = true; m.castShadow = false; m.frustumCulled = false; scene.add(m); return m;
  }
  const L0 = { cx: HC.x, cz: HC.z, size: FINAL ? 3.2 : 2.0, cell: FINAL ? (V.clean ? 0.0075 : 0.01) : 0.02 }, L1 = { cx: 0, cz: -9, size: 30, cell: FINAL ? 0.08 : 0.16 }, L2 = { cx: 0, cz: -180, size: 520, cell: FINAL ? 1.3 : 2.6 }, L3 = { cx: 0, cz: -2600, size: 6400, cell: FINAL ? 20 : 32 };
  const rect = (L, pad) => [L.cx - L.size / 2 + pad, L.cx + L.size / 2 - pad, L.cz - L.size / 2 + pad, L.cz + L.size / 2 - pad];
  level(L0.cx, L0.cz, L0.size, L0.cell, null, 0, 0.004, false);
  level(L1.cx, L1.cz, L1.size, L1.cell, rect(L0, 0.02).concat(0.12), 0.03, 0.03, false);
  level(L2.cx, L2.cz, L2.size, L2.cell, rect(L1, 0.2).concat(2.5), 0.5, 0.5, true);
  if (!NO.includes('far')) level(L3.cx, L3.cz, L3.size, L3.cell, rect(L2, 4).concat(50), 9, 8, true);
  log('terrain built');

  // ---------------------------------------------------------------- scattering helpers
  const _m = new T.Matrix4(), _q = new T.Quaternion(), _q2 = new T.Quaternion(), _s = new T.Vector3(), _p = new T.Vector3(), YAX = V3(0, 1, 0), XAX = V3(1, 0, 0);
  function inst(geo, mat, list, o) {   // list of [x, y, z, yaw, scale, tilt, sy]
    o = o || {}; if (!list.length) return null;
    const m = new T.InstancedMesh(geo, mat, list.length);
    for (let i = 0; i < list.length; i++) { const t = list[i]; _q.setFromAxisAngle(YAX, t[3] || 0); if (t[5]) { _q2.setFromAxisAngle(XAX, t[5]); _q.multiply(_q2); } const s = t[4] === undefined ? 1 : t[4]; _m.compose(_p.set(t[0], t[1], t[2]), _q, _s.set(s, s * (t[6] || 1), s)); m.setMatrixAt(i, _m); }
    m.instanceMatrix.needsUpdate = true; m.castShadow = o.cast !== false; m.receiveShadow = o.receive !== false; m.frustumCulled = false; scene.add(m); return m;
  }
  const inView = (x, z, margin) => { const f = -z; if (f < -(margin || 1.5)) return false; return Math.abs(Math.atan2(x, Math.max(f, 0.01))) < 0.93 || Math.hypot(x, z) < (margin || 1.5) * 2.2; };
  const blocked = [];   // circles where nothing small should grow: [x, z, r]
  const isBlocked = (x, z, pad) => { for (const b of blocked) { const dx = x - b[0], dz = z - b[1], r = b[2] + (pad || 0); if (dx * dx + dz * dz < r * r) return true; } return false; };
  blocked.push([HC.x, HC.z, 0.27], [BUCKET.x, BUCKET.z, 0.15]);

  // ---------------------------------------------------------------- trees, bushes, rocks
  const bigTrees = [[7.0, -14.0, 1.25, 0.4], [-14.5, -26, 1.05, 2.1], [15, -33, 0.95, 4.0], [-27, -52, 1.15, 1.0], [30, -70, 1.2, 3.3], [-9, -58, 0.9, 5.2]];
  for (const t of bigTrees) blocked.push([t[0], t[1], 0.75 * t[2]]);
  if (!NO.includes('trees')) {
    const tA = A.tree(11, { lumpy: V.lumpy, blend: V.treeBlend, leafDark: V.leaf[0], leafLight: V.leaf[1], cell: FINAL ? 0.05 : 0.09 }), tB = A.tree(23, { lumpy: V.lumpy, blend: V.treeBlend, leafDark: V.leaf[0], leafLight: V.leaf[1], cell: FINAL ? 0.055 : 0.09 });
    log('tree sculpts: ' + tA.crown.index.count / 3 + ' tris');
    const la = [], lb = []; bigTrees.forEach((t, i) => (i % 2 ? lb : la).push([t[0], terrainY(t[0], t[1]) - 0.05, t[1], t[3], t[2]]));
    inst(tA.trunk, M.bark, la); inst(tA.crown, M.crown, la); inst(tB.trunk, M.bark, lb); inst(tB.crown, M.crown, lb);
    // spruces: sculpted ones near, lathe ones far
    const sp = A.spruce(5, { lumpy: V.lumpy, dark: V.spruce[0], light: V.spruce[1], cell: FINAL ? 0.05 : 0.09 }), spFar = A.spruceFar({ dark: V.spruce[0], light: V.spruce[1], seg: 10 }), spFar2 = A.spruceFar({ dark: V.spruce[0], light: V.spruce[1], seg: 6 });
    log('spruce sculpt: ' + sp.geo.index.count / 3 + ' tris');
    const near = [], mid = [], far = [], r = S.rng(3);
    for (const g of [[-19, -36, 5], [19, -44, 6], [-38, -30, 4], [36, -40, 4], [-24, -74, 5], [44, -84, 5]]) for (let i = 0; i < g[2]; i++) { const x = g[0] + (r() - 0.5) * 11, z = g[1] + (r() - 0.5) * 12; near.push([x, terrainY(x, z) - 0.05, z, r() * 6.28, 0.85 + r() * 0.55]); blocked.push([x, z, 0.9]); }
    const grid = (step, fmin, fmax, list, sc) => { for (let z = -fmin; z > -fmax; z -= step) { const span = -z * 1.15 + 30; for (let x = -span; x < span; x += step) { const jx = x + (r() - 0.5) * step * 0.9, jz = z + (r() - 0.5) * step * 0.9, fm = forest(jx, jz); if (fm < 0.05 || r() > Math.min(1, fm * 3 + 0.25)) continue; list.push([jx, terrainY(jx, jz) - 0.1, jz, r() * 6.28, sc * (0.8 + r() * 0.6)]); } } };
    grid(6.5, 55, 150, near, 1.05); grid(7.5, 150, 620, mid, 1.15); if (!NO.includes('far')) grid(15, 620, 3000, far, 2.1);
    log('spruces: ' + near.length + ' near, ' + mid.length + ' mid, ' + far.length + ' far');
    inst(sp.geo, M.spruce, near); inst(spFar, M.spruceFar, mid, { cast: true }); inst(spFar2, M.spruceFar, far, { cast: false });
    // bushes and rocks
    const bush = A.bush(4, { lumpy: V.lumpy, dark: V.leaf[0], light: V.leaf[1] }), bl = [[9.6, -15.5, 1.3], [5.0, -16.5, 1.0], [-12.2, -24.0, 1.2], [-3.4, -21, 0.9], [12, -27, 1.4], [-20, -40, 1.5], [3.5, -30, 1.1], [-8.2, -9.4, 0.8]];
    inst(bush, M.crown, bl.map(b => { blocked.push([b[0], b[1], 0.6 * b[2]]); return [b[0], terrainY(b[0], b[1]) - 0.04, b[1], b[0] * 3, b[2]]; }));
    const rocks = [A.rock(1, { lumpy: V.lumpy }), A.rock(2, { lumpy: V.lumpy }), A.rock(3, { lumpy: V.lumpy })];
    const rl = [[2.9, -6.2, 0.75, 0], [3.7, -6.0, 0.4, 1], [7.9, -12.9, 1.0, 2], [-3.4, -4.6, 0.5, 1], [6.1, -13.1, 0.55, 0], [-10.5, -13.5, 0.9, 2], [1.2, -11.5, 0.45, 0], [-1.9, -8.2, 0.3, 1], [11, -20, 1.2, 2], [-6, -30, 1.0, 0]];
    rocks.forEach((g, gi) => inst(g, M.rock, rl.filter(q => q[3] === gi).map(q => { blocked.push([q[0], q[1], 0.6 * q[2]]); return [q[0], terrainY(q[0], q[1]) - 0.05 * q[2], q[1], q[0] * 7 + q[1], q[2]]; })));
    for (const g of rocks) { const n = g.getAttribute('position').count, c = new Float32Array(n * 3).fill(1); if (!g.getAttribute('color')) g.setAttribute('color', new T.BufferAttribute(c, 3)); }
  }
  log('trees placed');

  // ---------------------------------------------------------------- props: bucket, stall, fence, village, clouds
  if (!NO.includes('props')) {
    const b = A.bucket(), by = terrainY(BUCKET.x, BUCKET.z) - 0.004, grp = new T.Group();
    const body = new T.Mesh(b.body, V.clean ? new T.MeshPhysicalMaterial({ color: C('#f08a24'), roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.3, side: T.DoubleSide }) : M.zinc), soil = new T.Mesh(b.soil, M.soilObj); body.castShadow = body.receiveShadow = soil.receiveShadow = true; grp.add(body, soil);
    grp.position.set(BUCKET.x, by, BUCKET.z); grp.rotation.set(0.03, 0.6, -0.04); scene.add(grp);
    if (V.clean) {
      const dp = new T.Mesh(A.depot(), M.paint), dx = -7.4, dz = -20.4; dp.position.set(dx, terrainY(dx, dz) - 0.04, dz); dp.rotation.y = 0.42; dp.castShadow = dp.receiveShadow = true; scene.add(dp); blocked.push([dx, dz, 3.4], [dx - 2.4, dz + 1.6, 1.4]);
      const van = A.van(), vg = new T.Group(), vx = -0.9, vz = -17.2; for (const g of [van.body, van.extras]) { const m = new T.Mesh(g, M.paint); m.castShadow = m.receiveShadow = true; vg.add(m); }
      vg.position.set(vx, terrainY(vx, vz) - 0.02, vz); vg.rotation.y = 2.25; scene.add(vg); blocked.push([vx, vz, 2.5]);
      // bollards along the track
      const bparts = [A.colorize(new T.CapsuleGeometry(0.07, 0.5, 6, 18).translate(0, 0.3, 0), C('#e9e8e4')), A.colorize(new T.CylinderGeometry(0.074, 0.074, 0.1, 18).translate(0, 0.52, 0), C('#f08a24')), A.colorize(new T.CylinderGeometry(0.1, 0.11, 0.05, 18).translate(0, 0.025, 0), C('#2b3442'))];
      const bl = []; for (let i = 0; i < 7; i++) { const t = i / 6, x = lerp(-3.55, -8.5, t) - 0.15 * Math.sin(t * 3.1), z = lerp(-3.4, -13.8, t); bl.push([x, terrainY(x, z), z, 0, 1]); blocked.push([x, z, 0.16]); }
      inst(A.merge(bparts), M.paint, bl);
    } else {
    // stall
    const st = new T.Mesh(A.stall(V.pal), M.wood); st.position.set(STALL.x, terrainY(STALL.x, STALL.z) - 0.03, STALL.z); st.rotation.y = STALL.yaw; st.castShadow = st.receiveShadow = true; scene.add(st); blocked.push([STALL.x, STALL.z, 1.9]);
    // fence along the path
    const posts = [], f0 = [-4.9, -5.4], f1 = [-9.4, -14.4], np = 6;
    for (let i = 0; i < np; i++) { const x = lerp(f0[0], f1[0], i / (np - 1)), z = lerp(f0[1], f1[1], i / (np - 1)); posts.push([x, terrainY(x, z), z]); blocked.push([x, z, 0.12]); }
    const pg = A.colorize(new T.CapsuleGeometry(0.06, 0.95, 6, 16), C('#b98d5c')); pg.translate(0, 0.42, 0); inst(pg, M.wood, posts.map(p => [p[0], p[1], p[2], p[0], 1]));
    for (let i = 0; i < np - 1; i++) for (const hh of [0.36, 0.74]) {
      const a = V3(posts[i][0], posts[i][1] + hh, posts[i][2]), b2 = V3(posts[i + 1][0], posts[i + 1][1] + hh, posts[i + 1][2]), len = a.distanceTo(b2);
      const g = A.colorize(new T.CapsuleGeometry(0.036, len + 0.16, 6, 12), C('#a67c4e')), mesh = new T.Mesh(g, M.wood);
      mesh.position.copy(a).add(b2).multiplyScalar(0.5); mesh.quaternion.setFromUnitVectors(YAX, b2.clone().sub(a).normalize()); mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh);
    }
    }
    // village on the far hillside
    const r = S.rng(9), houses = [];
    for (let i = 0; i < 16; i++) { const x = VILLAGE.x + (r() - 0.5) * 190, z = VILLAGE.z + (r() - 0.5) * 110, g = A.house(i + 1), m = new T.Mesh(g, M.house); m.position.set(x, terrainY(x, z) - 0.5, z); m.rotation.y = r() * 3; m.scale.setScalar(1.7); m.castShadow = false; scene.add(m); houses.push(m); }
    { const g = A.house(0, { church: true }), m = new T.Mesh(g, M.house); m.position.set(VILLAGE.x + 10, terrainY(VILLAGE.x + 10, VILLAGE.z) - 0.5, VILLAGE.z); m.scale.setScalar(1.8); m.rotation.y = 0.4; scene.add(m); }
    // clouds
    const cg = [A.cloud(1), A.cloud(2), A.cloud(3), A.cloud(4)];
    const cl = [[-2500, 1000, -6000, 0.2, 150], [1100, 1250, -6600, -0.1, 190], [3400, 900, -5600, 0.3, 140], [-700, 1700, -7000, 0.05, 170], [-4600, 1150, -5200, 0.5, 150], [2300, 1900, -7200, -0.2, 160], [5200, 1300, -5400, -0.5, 150], [150, 760, -6400, 0.1, 110], [-1900, 2100, -6900, 0, 140], [-3400, 620, -6300, 0.2, 100], [4100, 2000, -6500, -0.3, 130]];
    if (!V.skyClouds && !V.noClouds) cg.forEach((g, gi) => inst(g, M.cloud, cl.filter((q, i) => i % 4 === gi), { cast: false, receive: false }));
    for (const g of cg) if (!g.getAttribute('color')) g.setAttribute('color', new T.BufferAttribute(new Float32Array(g.getAttribute('position').count * 3).fill(1), 3));
  }
  log('props placed');

  // ---------------------------------------------------------------- grass, flowers, pebbles
  if (!NO.includes('grass')) {
    const r = S.rng(41), ok = (x, z, pad) => inView(x, z, 2) && !isBlocked(x, z, pad) && pathMask(x, z) < 0.25;
    if (V.grass === 'sparse') {
      // flat stylised stones in small groups + a few chunky tufts: the ground stays calm and readable
      const sg = [0, 1, 2].map(i => A.pebbleFlat(i + 1)), sl = [[], [], []], tg = [0, 1].map(i => A.tuft(400 + i, V.tuft)), tl = [[], []];
      const groups = FINAL ? 950 : 380;
      for (let i = 0; i < groups; i++) {
        const d = 0.8 + Math.pow(r(), 1.35) * 46, a = (r() - 0.5) * 1.8, cx = Math.sin(a) * d, cz = -Math.cos(a) * d, n = 1 + Math.floor(r() * r() * 5), big = 0.016 + r() * 0.034 + (r() < 0.03 ? 0.05 : 0);
        for (let k = 0; k < n; k++) { const x = cx + (r() - 0.5) * 0.4 * (k ? 1 : 0), z = cz + (r() - 0.5) * 0.4 * (k ? 1 : 0); if (!ok(x, z, 0.03) || holeDepth(x, z) > 0) continue; const sc = big * (k ? 0.35 + r() * 0.5 : 1); sl[Math.floor(r() * 3)].push([x, terrainY(x, z) + sc * 0.08, z, r() * 6.28, sc, (r() - 0.5) * 0.25]); }
      }
      sg.forEach((g, i) => inst(g, M.stone, sl[i]));
      const tn = FINAL ? 1500 : 600;
      for (let i = 0; i < tn; i++) { const d = 0.7 + Math.pow(r(), 1.5) * 42, a = (r() - 0.5) * 1.8, x = Math.sin(a) * d, z = -Math.cos(a) * d; if (!ok(x, z, 0.05) || fbm2(x / 4 + 9, z / 4, 2) < -0.05) continue; tl[r() < 0.5 ? 0 : 1].push([x, terrainY(x, z) - 0.004, z, r() * 6.28, (0.8 + r() * 0.7) * (1 + d / 40), (r() - 0.5) * 0.1]); }
      for (let i = 0; i < 70; i++) { const a = r() * 6.283, d = 0.3 + r() * 1.5, x = HC.x + Math.cos(a) * d, z = HC.z + Math.sin(a) * d; if (!ok(x, z, 0.05) || holeDepth(x, z) > 0) continue; tl[r() < 0.5 ? 0 : 1].push([x, terrainY(x, z) - 0.004, z, r() * 6.28, 0.6 + r() * 0.6, (r() - 0.5) * 0.1]); }
      tg.forEach((g, i) => inst(g, M.tuft, tl[i], { cast: true }));
      log('stones: ' + (sl[0].length + sl[1].length + sl[2].length) + ', tufts: ' + (tl[0].length + tl[1].length));
    } else if (V.grass === 'tufts') {
      const geos = [0, 1, 2].map(i => A.tuft(100 + i, V.tuft)), lists = [[], [], []];
      const band = (d0, d1, per, sc) => { const step = 1 / Math.sqrt(per * V.tuftK); for (let z = 2; z > -d1; z -= step) for (let x = -d1; x < d1; x += step) { const jx = x + (r() - 0.5) * step, jz = z + (r() - 0.5) * step, d = Math.hypot(jx, jz); if (d < d0 || d > d1 || !ok(jx, jz, 0.02)) continue; const n = fbm2(jx / 1.7, jz / 1.7, 2); if (n < -0.25 && r() < 0.6) continue; lists[Math.floor(r() * 3)].push([jx, terrainY(jx, jz) - 0.006, jz, r() * 6.28, sc * (0.75 + r() * 0.6) * (1 + n * 0.3), (r() - 0.5) * 0.12]); } };
      band(0, 7, FINAL ? 15 : 8, 1); band(7, 16, FINAL ? 7 : 3, 1.2); band(16, 34, FINAL ? 2.6 : 1, 1.6); if (FINAL) band(34, 60, 0.7, 2.3);
      geos.forEach((g, i) => inst(g, M.tuft, lists[i], { cast: true }));
      log('tufts: ' + (lists[0].length + lists[1].length + lists[2].length));
    } else {
      const geos = [0, 1, 2].map(i => A.blades(200 + i, V.tuft)), lists = [[], [], []];
      const band = (d0, d1, per, sc) => { const step = 1 / Math.sqrt(per); for (let z = 2; z > -d1; z -= step) for (let x = -d1; x < d1; x += step) { const jx = x + (r() - 0.5) * step * 1.4, jz = z + (r() - 0.5) * step * 1.4, d = Math.hypot(jx, jz); if (d < d0 || d > d1 || !ok(jx, jz, 0.01)) continue; const dh = Math.hypot(jx - HC.x, (jz - HC.z - 0.25) / 1.5); if (dh < 0.42 || (dh < 0.75 && r() < 0.75)) continue; const n = fbm2(jx / 2.3, jz / 2.3, 2); lists[Math.floor(r() * 3)].push([jx, terrainY(jx, jz) - 0.004, jz, r() * 6.28, sc * (0.7 + r() * 0.6) * (1 + n * 0.45), (r() - 0.5) * 0.2]); } };
      band(0, 6, FINAL ? 240 : 60, 1); band(6, 15, FINAL ? 70 : 16, 1.25); band(15, 34, FINAL ? 18 : 4, 1.9); if (FINAL) band(34, 70, 3.5, 3.0);
      geos.forEach((g, i) => inst(g, M.tuft, lists[i], { cast: true }));
      log('blade clumps: ' + (lists[0].length + lists[1].length + lists[2].length));
    }
    if (V.carpet) {
      const cg = [0, 1].map(i => A.blades(300 + i, Object.assign({ blades: 6, hMin: 0.028, hMax: 0.065, width: 0.0075 }, V.carpet))), cl = [[], []];
      const patch = (cx, cz, rad, per) => { const step = 1 / Math.sqrt(per); for (let z = cz - rad; z < cz + rad; z += step) for (let x = cx - rad; x < cx + rad; x += step) { const jx = x + (r() - 0.5) * step * 1.6, jz = z + (r() - 0.5) * step * 1.6, d = Math.hypot(jx - cx, jz - cz); if (d > rad || r() < sm(rad * 0.55, rad, d)) continue; if (holeDepth(jx, jz) > 0 || Math.hypot(jx - BUCKET.x, jz - BUCKET.z) < 0.1 || pathMask(jx, jz) > 0.35) continue; const rim = sm(0.2, 0.34, Math.hypot((jx - HC.x) / 1.15, (jz - HC.z) / 0.95)); if (r() > 0.25 + 0.75 * rim) continue; cl[r() < 0.5 ? 0 : 1].push([jx, terrainY(jx, jz) - 0.003, jz, r() * 6.28, (0.75 + r() * 0.7) * (0.55 + 0.45 * rim), (r() - 0.5) * 0.3]); } };
      patch(HC.x, HC.z, 2.3, FINAL ? 520 : 130); patch(0.4, -1.6, 4.4, FINAL ? 260 : 50);
      cg.forEach((g, i) => inst(g, M.tuft, cl[i], { cast: false })); log('carpet clumps: ' + (cl[0].length + cl[1].length));
    }
    // flowers in drifts
    const fk = V.flowerK === undefined ? 1 : V.flowerK, kinds = [[A.flower('#ffffff'), Math.round(150 * fk), 1.1], [A.flower('#ffd83a', { petals: 6, len: 0.011, wid: 0.008, h: 0.13, centre: '#f0a020' }), Math.round(90 * fk), 2.7], [A.flower('#b79cff', { petals: 5, len: 0.012, wid: 0.007, h: 0.11, centre: '#fff2a8' }), Math.round(55 * fk), 4.9]];
    for (const [g, n, seedOff] of kinds) { const l = []; let tries = 0; while (l.length < n && tries++ < n * 40) { const d = 0.6 + Math.pow(r(), 1.6) * 20, a = (r() - 0.5) * 1.7, x = Math.sin(a) * d, z = -Math.cos(a) * d; if (!ok(x, z, 0.06) || fbm2(x / 3 + seedOff, z / 3, 2) < 0.05) continue; l.push([x, terrainY(x, z) - 0.004, z, r() * 6.28, 0.85 + r() * 0.5, (r() - 0.5) * 0.25]); } inst(g, M.flower, l, { cast: true }); }
    // close to the hole: a few flowers and mushrooms for the close-up
    inst(kinds[0][0], M.flower, [[HC.x - 0.34, 0, HC.z + 0.12], [HC.x - 0.42, 0, HC.z - 0.1], [HC.x + 0.1, 0, HC.z - 0.4], [HC.x + 0.3, 0, HC.z + 0.33], [HC.x - 0.2, 0, HC.z - 0.42]].map((p, i) => [p[0], terrainY(p[0], p[2]) - 0.004, p[2], i * 1.7, 1 + i * 0.07, 0.1]));
    inst(A.mushroom(), M.flower, [[6.3, -13.2, 1.5], [6.55, -13.05, 1.0], [7.7, -13.5, 1.2], [HC.x - 0.55, HC.z - 0.33, 0.9], [HC.x - 0.63, HC.z - 0.27, 0.6]].map((p, i) => [p[0], terrainY(p[0], p[1]) - 0.004, p[1], i, p[2]]));
    // pebbles on the path and crumbs of soil around the hole
    const lump = A.lump(1), lump2 = A.lump(2, 0.5), pl = [], cr = [];
    for (let i = 0; i < (FINAL ? 420 : 150); i++) { const t = r(), seg = Math.min(PATH.length - 2, Math.floor(Math.pow(t, 1.5) * 5)), u = r(), x = lerp(PATH[seg][0], PATH[seg + 1][0], u) + (r() - 0.5) * 0.9, z = lerp(PATH[seg][1], PATH[seg + 1][1], u) + (r() - 0.5) * 0.9; if (pathMask(x, z) < 0.5) continue; pl.push([x, terrainY(x, z) + 0.002, z, r() * 6.28, 0.012 + r() * 0.03]); }
    if (!V.clean) inst(lump, std({ color: C('#c2b6a2'), roughness: 0.85 }), pl.map(q => q.concat([0, 0.6])));
    for (let i = 0; i < 110; i++) { const a = r() * 6.28, d = 0.17 + Math.pow(r(), 2.4) * 0.17, x = HC.x + Math.cos(a) * d * 1.15, z = HC.z + Math.sin(a) * d * 0.95; if (holeDepth(x, z) > 0.002) continue; cr.push([x, terrainY(x, z) + 0.0005, z, r() * 6.28, 0.0025 + Math.pow(r(), 2) * 0.008, r() * 3, 0.55 + r() * 0.3]); }
    for (let i = 0; i < 22; i++) { const a = r() * 6.28, d = Math.sqrt(r()) * 0.13, x = HC.x + Math.cos(a) * d, z = HC.z + Math.sin(a) * d; cr.push([x, terrainY(x, z) + 0.0005, z, r() * 6.28, 0.003 + r() * 0.007, r() * 3, 0.6]); }
    inst(lump2, M.soil, V.clean ? cr.filter((q, i) => i % 3 === 0) : cr);
    inst(lump, std({ color: C('#bdb19c'), roughness: 0.8 }), [[HC.x + 0.05, 0, HC.z + 0.04, 0.02], [HC.x - 0.08, 0, HC.z - 0.03, 0.014], [HC.x + 0.21, 0, HC.z + 0.2, 0.018], [HC.x - 0.24, 0, HC.z + 0.13, 0.025]].map((p, i) => [p[0], terrainY(p[0], p[2]) + 0.003, p[2], i, p[3]]));
    // something shiny in the hole: the first find
    const nug = new T.Mesh(A.lump(7, 0.35), M.silver); nug.scale.setScalar(0.013); nug.position.set(HC.x - 0.03, terrainY(HC.x - 0.03, HC.z + 0.05) + 0.006, HC.z + 0.05); nug.castShadow = true; scene.add(nug);
  }
  log('grass and flowers placed');

  // ---------------------------------------------------------------- first-person hand with the spoon
  const hand = new T.Group(), spoonSoil = new T.Group();
  if (!NO.includes('hand')) {
    const sp = A.spoon(); log('spoon sculpt: ' + sp.spoon.index.count / 3 + ' tris');
    const glove = new T.Mesh(A.glove(V.pal), M.glove), sleeve = new T.Mesh(A.sleeve(V.pal), M.sleeve), spoon = new T.Mesh(sp.spoon, M.steel), soil = new T.Mesh(sp.soil, M.soilObj);
    log('glove sculpt: ' + glove.geometry.index.count / 3 + ' tris');
    for (const m of [glove, sleeve, spoon, soil]) { m.castShadow = false; m.receiveShadow = true; m.frustumCulled = false; }
    spoonSoil.add(soil); hand.add(glove, sleeve, spoon, spoonSoil); camera.add(hand);
  }
  // the digger's own shadow: an unseen body under the camera that only casts a shadow
  const bodyProxy = new T.Group(); bodyProxy.visible = false; scene.add(bodyProxy);
  if (V.bodyShadow) {
    const mat = new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    const add = m => { m.castShadow = true; m.frustumCulled = false; bodyProxy.add(m); };
    const cap = (rad, a, b) => { const m = new T.Mesh(new T.CapsuleGeometry(rad, a.distanceTo(b), 4, 12), mat); m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(YAX, b.clone().sub(a).normalize()); add(m); };
    cap(0.09, V3(-0.11, 0.1, 0), V3(-0.1, 0.9, 0)); cap(0.09, V3(0.11, 0.1, 0), V3(0.1, 0.9, 0)); cap(0.2, V3(0, 1.02, 0), V3(0, 1.34, 0));
    cap(0.075, V3(-0.25, 1.42, 0), V3(-0.31, 0.98, 0.02)); cap(0.08, V3(0.25, 1.42, 0), V3(0.39, 1.16, 0.09));
    const head = new T.Mesh(new T.SphereGeometry(0.125, 16, 12), mat); head.position.set(0, 1.63, 0.03); add(head);
    const helmet = new T.Mesh(new T.SphereGeometry(0.165, 18, 12, 0, 6.2832, 0, 1.7), mat); helmet.position.set(0, 1.66, 0.03); add(helmet);
    const brim = new T.Mesh(new T.CylinderGeometry(0.215, 0.215, 0.03, 22), mat); brim.position.set(0, 1.665, -0.03); add(brim);
    const lamp = new T.Mesh(new T.SphereGeometry(0.05, 10, 8), mat); lamp.position.set(0, 1.75, -0.15); add(lamp);
  }
  function poseHand(pos, hdir, upHint) {
    const h = V3(hdir[0], hdir[1], hdir[2]).normalize(), up = V3(upHint[0], upHint[1], upHint[2]), u = up.clone().addScaledVector(h, -up.dot(h)).normalize(), s = new T.Vector3().crossVectors(h, u).normalize();
    hand.position.set(pos[0], pos[1], pos[2]); hand.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(s, u, h.clone().negate()));
  }

  // ---------------------------------------------------------------- post-processing
  const rt = new T.WebGLRenderTarget(W * DPR, H * DPR, { type: T.HalfFloatType, samples: 4 });
  const composer = new T.EffectComposer(renderer, rt); composer.setPixelRatio(DPR); composer.setSize(W, H);
  composer.addPass(new T.RenderPass(scene, camera));
  if (!NO.includes('ao')) { const g = new T.GTAOPass(scene, camera, W * DPR, H * DPR); g.updateGtaoMaterial({ radius: 0.32, distanceExponent: 1.5, thickness: 1.0, scale: 1.15, samples: FINAL ? 16 : 8 }); g.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 }); g.blendIntensity = 0.9; composer.addPass(g); }
  composer.addPass(V.clean ? new T.UnrealBloomPass(new T.Vector2(W, H), 0.07, 0.5, 1.2) : new T.UnrealBloomPass(new T.Vector2(W, H), 0.16, 0.6, 0.93));
  composer.addPass(new T.OutputPass());
  if (V.tilt) composer.addPass(new T.ShaderPass({
    uniforms: { tDiffuse: { value: null }, uPx: U(new T.Vector2(1 / (W * DPR), 1 / (H * DPR))), uR: U(7.0 * DPR * W / 1600) },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uPx; uniform float uR; varying vec2 vUv;
      void main(){ float k = smoothstep(0.16, 0.5, abs(vUv.y - 0.42)); float r = uR*k; vec3 acc = vec3(0.0); float wsum = 0.0;
        for (int i = 0; i < 24; i++){ float fi = float(i); float rad = sqrt((fi + 0.5)/24.0); float th = fi*2.399963; vec2 o = vec2(cos(th), sin(th))*rad*r*uPx; acc += texture2D(tDiffuse, vUv + o).rgb; wsum += 1.0; }
        gl_FragColor = vec4(acc/wsum, 1.0); }`
  }));
  composer.addPass(new T.ShaderPass({
    uniforms: { tDiffuse: { value: null }, uSat: U(V.grade.sat), uCon: U(V.grade.con), uVig: U(V.grade.vig) },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uSat; uniform float uCon; uniform float uVig; varying vec2 vUv;
      void main(){ vec4 c = texture2D(tDiffuse, vUv); float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722)); c.rgb = mix(vec3(l), c.rgb, uSat); c.rgb = (c.rgb - 0.5)*uCon + 0.5;
        vec2 q = vUv - 0.5; c.rgb *= 1.0 - uVig*smoothstep(0.35, 0.95, length(q*vec2(1.0, 0.82))*1.35); gl_FragColor = vec4(clamp(c.rgb, 0.0, 1.0), 1.0); }`
  }));

  // ---------------------------------------------------------------- shots
  const gy = terrainY(0, 0);
  const SHOT = {
    wide() {
      camera.position.set(0, baseHeight(0, 0) + 1.62, 0); camera.rotation.set(0, 0, 0, 'YXZ'); camera.rotation.x = -0.215; camera.rotation.y = 0.04;
      poseHand([0.185, -0.160, -0.45], [-0.25, 0.85, -0.46], [0, 0.3, 1]); spoonSoil.visible = false;
      bodyProxy.visible = !!V.bodyShadow; bodyProxy.position.set(0, baseHeight(0, 0), 0); hand.traverse(o => { if (o.isMesh) o.castShadow = !!V.handShadow; });
    },
    close() {
      camera.position.set(HC.x + 0.06, terrainY(HC.x, HC.z + 0.5) + 0.60, HC.z + 0.53); camera.rotation.set(0, 0, 0, 'YXZ'); camera.rotation.x = -0.92; camera.rotation.y = -0.06;
      poseHand([0.165, -0.185, -0.43], [-0.30, 0.80, -0.52], [0, 0.3, 1]); spoonSoil.visible = true;
      bodyProxy.visible = false; hand.traverse(o => { if (o.isMesh) o.castShadow = false; });
    }
  };
  SHOT.hand = () => { SHOT.wide(); camera.setViewOffset(W, H, W * 0.50, H * 0.46, W * 0.5, H * 0.5); };
  SHOT.hand2 = () => { SHOT.close(); camera.setViewOffset(W, H, W * 0.42, H * 0.44, W * 0.56, H * 0.56); };
  const out2d = document.createElement('canvas'); out2d.width = W; out2d.height = H; const ctx = out2d.getContext('2d'); ctx.imageSmoothingQuality = 'high';
  window.__shots = {};
  function shoot(name) {
    camera.clearViewOffset(); SHOT[name](); camera.updateMatrixWorld(true); sky.position.copy(camera.position);
    composer.render();
    ctx.drawImage(canvas, 0, 0, W, H); window.__shots[name] = out2d.toDataURL('image/jpeg', FINAL ? 0.93 : 0.85);
    log('shot ' + name + ' done');
  }
  let i = 0;
  function next() { if (i >= SHOTS.length) { window.__done = true; log('all done'); return; } const n = SHOTS[i++]; try { shoot(n); } catch (e) { console.error('shot failed: ' + e.message + '\n' + e.stack); window.__error = e.message; } setTimeout(next, 30); }
  setTimeout(next, 50);
})();
