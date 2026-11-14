// Rendering in the chosen look ("clean worksite", look-dev variant 5): smooth plain ground with a crisp dark rim
// where it was dug, sparse faceted pebbles and chunky grass tufts, long sharp shadows (the digger's own included),
// sculpted trees, white-and-orange equipment, light from the sky itself.
// Everything is drawn relative to a floating origin O near the player, so a 6 371 km planet stays precise on the GPU.
// Shading noise runs in a fixed local frame of the start region (x east-ish, y up, z back), so patterns never jump.
'use strict';
(function (root) {
  const W = root.World, T = root.THREE, A = root.Assets;
  const v3 = (x, y, z) => new T.Vector3(x, y, z);
  const col = h => new T.Color(h);

  const Scene = {};
  let renderer, composer, gtao, bloom, scene, camera, handScene, handCam, handSun, sun, sky, envTex = null;
  const O = v3(0, 0, 0);                         // floating origin (planet metres)
  const up = v3(0, 1, 0), sunDir = v3(0, 1, 0);
  const timeU = { value: 0 };
  let quality = 'mid';     // high: + ambient occlusion; mid: default on computers; low: phones
  // phone: smaller streaming radius, coarser sculpts, no ambient occlusion, no shadows from grass, smaller shadow map
  const M = { load: 54, farIn: 44, grassR: 26, treeR: 330, nearR: 55, samples: 4, maxDpr: 1.5, detail: 1, smallShadow: true, shadow: 2048, rich: false };   // rich: extra shading noise (subtle, heavy on weak GPUs)
  Scene.setMobile = on => { if (on) Object.assign(M, { load: 40, farIn: 32, grassR: 16, treeR: 210, nearR: 30, samples: 0, maxDpr: 1.25, detail: 2, smallShadow: false, shadow: 1024, rich: false }); quality = on ? 'low' : 'mid'; };

  { const q = new URLSearchParams(root.location ? location.search : ''); for (const k of ['samples', 'detail', 'shadow', 'load', 'nearR', 'grassR']) if (q.has(k)) M[k] = +q.get(k); if (q.has('small')) M.smallShadow = q.get('small') === '1'; }   // debug overrides
  // ---------- the look (variant 5) ----------
  const V = {
    sun: [0.30, 0.40, 0.87], moon: [-0.30, 0.19, -0.93], sunColor: '#fff2dc', sunI: 3.1, envI: 1.15, exposure: 1.0,
    sky: { zen: '#3a86e0', hor: '#d6ecfb', ground: '#8fb060' }, skyDesat: 0.3, fog: ['#d4e9f7', 0.00028],
    lawn: ['#6fb848', '#90cc56', '#bbd65e'], soil: ['#6b3f1f', '#93602f'], forestC: '#3a8440',
    tuft: { root: '#62b23c', tip: '#b6e04a', width: 0.03, blades: 6, hMin: 0.05, hMax: 0.11 },
    leaf: ['#3f9a2f', '#a4d845'], spruce: ['#1f6f3a', '#5fb44c'],
    pal: { sleeve: '#f5f4f0', band: '#f08a24' }, shadowRadius: 1.3,
    grade: { sat: 1.1, con: 1.05, vig: 0.14 }
  };
  // soil layers below the topsoil (vertex colour of the dug walls)
  const P = {
    grass: col(V.lawn[0]), grass2: col(V.lawn[1]), grassDry: col(V.lawn[2]), forest: col(V.forestC),
    soil: col(V.soil[0]), dirt: col(V.soil[1]), clay: col('#b9733f'), stone: col('#8e8f96'), stone2: col('#6f7079'),
    rock: col('#a9a6ad'), snow: col('#f4f7fb')
  };
  const tmpC = new T.Color();
  function groundColor(depth, upness, n, out) {
    out = out || new T.Color();
    const d = depth + n * 1.2;
    if (d < 1.4) out.copy(P.soil).lerp(P.dirt, Math.max(0, d / 1.4));
    else if (d < 6) out.copy(P.dirt).lerp(P.clay, Math.max(0, (d - 4) / 2));
    else if (d < 16) out.copy(P.clay).lerp(P.stone, Math.max(0, (d - 13) / 3));
    else out.copy(P.stone).lerp(P.stone2, Math.min(1, (d - 16) / 40));
    return out;
  }
  Scene.groundColor = groundColor;

  // ---------- local frame of the region ----------
  // Shading noise and the sky use local coordinates: x = right, y = up, z = back (as the player first stands).
  const LF = new T.Matrix3(), LX = v3(1, 0, 0), LY = v3(0, 1, 0), LZ = v3(0, 0, 1), anchor = v3(0, 0, 0);
  const uLF = { value: LF }, uOff = { value: v3(0, 0, 0) };
  const toWorld = (x, y, z) => v3(0, 0, 0).addScaledVector(LX, x).addScaledVector(LY, y).addScaledVector(LZ, z);
  // spawn: point on the planet, fwd: the direction the player faces at the start
  Scene.setRegion = function (spawn, fwd) {
    anchor.copy(spawn).normalize().multiplyScalar(W.R);
    LY.copy(spawn).normalize(); LZ.copy(fwd).addScaledVector(LY, -fwd.dot(LY)).normalize().negate(); LX.crossVectors(LY, LZ).normalize();
    LF.set(LX.x, LX.y, LX.z, LY.x, LY.y, LY.z, LZ.x, LZ.y, LZ.z);
    sunDir.copy(toWorld(V.sun[0], V.sun[1], V.sun[2])).normalize();
    uOff.value.copy(O).sub(anchor);
    if (sun) sun.position.copy(sunDir).multiplyScalar(100);
    if (handSun) handSun.position.copy(sunDir);
    if (renderer) buildEnv();
  };

  // ---------- procedural shading (same helpers as the look-dev scene) ----------
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
  // o: { space: 'object' | world (default), uniforms, vdecl, vertex, fdecl, color, rough, normal, noFlip }
  function pd(mat, o) {
    const id = 'pd' + (matId++), world = o.space !== 'object';
    mat.onBeforeCompile = sh => {
      sh.uniforms.uLF = uLF; sh.uniforms.uOff = uOff; sh.uniforms.uTime = timeU;
      if (o.uniforms) Object.assign(sh.uniforms, o.uniforms);
      sh.vertexShader = 'varying vec3 vPd; uniform mat3 uLF; uniform vec3 uOff; uniform float uTime;\n' + (o.vdecl || '') + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + (o.vertex || '') +
        (world ? '\n{ vec4 pdW = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n pdW = instanceMatrix * pdW;\n#endif\n vPd = uLF * ((modelMatrix * pdW).xyz + uOff); }\n' : '\n vPd = position;\n'));
      let fs = (M.rich ? '#define PD_RICH\n' : '') + 'varying vec3 vPd; uniform mat3 uLF;\n' + (world ? '#define PD_TOVIEW (mat3(viewMatrix) * transpose(uLF))\n' : 'uniform mat3 normalMatrix;\n#define PD_TOVIEW normalMatrix\n') + NOISE + (o.fdecl || '') + sh.fragmentShader;
      if (o.color) fs = fs.replace('#include <color_fragment>', '#include <color_fragment>\n{ vec3 P = vPd;\n' + o.color + '\n}');
      if (o.rough) fs = fs.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n{ vec3 P = vPd;\n' + o.rough + '\n}');
      if (o.normal) fs = fs.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n{ vec3 P = vPd; vec3 G = vec3(0.0); float px = length(fwidth(P));\n' + o.normal + '\n vec3 gv = PD_TOVIEW * G; gv -= normal * dot(gv, normal); normal = normalize(normal - gv); }');
      if (o.noFlip) fs = fs.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n normal = normalize(vNormal); nonPerturbedNormal = normal;');
      sh.fragmentShader = fs;
    };
    mat.customProgramCacheKey = () => id;
    return mat;
  }
  const U = v => ({ value: v });
  const std = p => new T.MeshStandardMaterial(Object.assign({ roughness: 0.8, metalness: 0 }, p));
  const MAT = {};
  function makeTerrain(soilU, rim, back) {
    const m = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 });
    if (back) { m.polygonOffset = true; m.polygonOffsetFactor = 1; m.polygonOffsetUnits = 2; }
    return pd(m, {
      uniforms: Object.assign({ uG1: U(col(V.lawn[0])), uG2: U(col(V.lawn[1])), uG3: U(col(V.lawn[2])), uRim: U(rim) }, soilU),
      vdecl: 'attribute float aDepth; varying float vDepth;\n', vertex: 'vDepth = aDepth;',
      fdecl: 'varying float vDepth; uniform float uRim; uniform vec3 uG1; uniform vec3 uG2; uniform vec3 uG3; uniform vec3 uS1; uniform vec3 uS2;\n',
      color: `
        float patch1 = pdFbm(P, 0.16, 2).x, patch2 = pdFbm(P + 7.3, 0.035, 2).x;
        vec3 lawn = mix(uG1, uG2, clamp(0.5 + patch1*0.9, 0.0, 1.0));
        lawn = mix(lawn, uG3, clamp(patch2*1.4, 0.0, 1.0)*0.5);
        { float pxc = length(fwidth(P)); lawn *= 1.0 + 0.045*pdFbm(P, 1.4, 2).x + 0.03*pdFbm(P, 9.0, 2).x*pdFade(pxc*18.0);
          #ifdef PD_RICH
          vec4 fl = pdCell(P*vec3(70.0, 20.0, 70.0)); lawn *= 1.0 + (fl.w - 0.5)*0.09*smoothstep(0.45, 0.2, length(fl.xyz))*pdFade(pxc*70.0);
          #endif
        }
        vec3 col = lawn;
        // uRim widens the soil edge to match the ground grid: depth is only known at the grid's vertices
        if (vDepth > 0.0003*uRim) {
          float dn = vDepth/uRim + pdFbm(P, 40.0, 2).x*0.0012;
          vec3 soilc = mix(uS1, uS2, clamp(0.5 + pdFbm(P, 5.0, 2).x*0.7, 0.0, 1.0));
          soilc *= mix(1.0, 0.82, smoothstep(0.03, 0.11, vDepth));
          soilc = mix(soilc, vColor.rgb, smoothstep(1.0, 2.5, vDepth));
          vec3 edge = mix(uS1*0.5, soilc, smoothstep(0.005, 0.013, dn));
          col = mix(lawn, edge, smoothstep(0.0008, 0.0055, dn));
        }
        diffuseColor.rgb = col;`,
      rough: 'roughnessFactor = mix(0.88, 1.0, smoothstep(0.003, 0.012, vDepth));',
      normal: M.rich ? `
        float soilK = smoothstep(0.0012, 0.004, vDepth);
        vec4 n1 = pdFbm(P, 2.2, 2); G += n1.yzw*0.012*(1.0 - soilK)*pdFade(px*4.4);
        if (soilK > 0.0) { vec4 n3 = pdFbm(P, 26.0, 2); G += n3.yzw*0.0016*soilK*pdFade(px*52.0); vec4 n6 = pdFbm(P, 7.0, 2); G += n6.yzw*0.004*soilK; }` : null
    });
  }
  function buildMaterials() {
    const soilU = { uS1: U(col(V.soil[0])), uS2: U(col(V.soil[1])) };
    // ground: plain softly painted lawn; a dug place shows soil with a neat dark rim; deeper down the layer colours
    // coarse ground is pushed back in depth so the fine boxes (2.5 cm grid, where it was dug) always draw on top of it
    MAT.terrain = makeTerrain(soilU, Math.max(1, W.LC.VOX / 0.03), true);
    MAT.terrainFine = makeTerrain(soilU, 1, false);
    MAT.far = std({ vertexColors: true, roughness: 0.95 });
    MAT.soil = pd(std({ roughness: 1 }), { uniforms: soilU, fdecl: 'uniform vec3 uS1; uniform vec3 uS2;\n', color: 'diffuseColor.rgb = mix(uS1, uS2, clamp(0.5 + pdFbm(P, 5.0, 2).x*0.7, 0.0, 1.0));' });
    MAT.soilObj = pd(std({ roughness: 1 }), { space: 'object', uniforms: soilU, fdecl: 'uniform vec3 uS1; uniform vec3 uS2;\n', color: 'diffuseColor.rgb = mix(uS1, uS2, clamp(0.5 + pdFbm(P, 20.0, 2).x*0.7, 0.0, 1.0));', normal: 'vec4 n3 = pdFbm(P, 90.0, 2); G += n3.yzw*0.0006;' });
    MAT.crown = pd(std({ vertexColors: true, roughness: 0.78 }), { color: 'diffuseColor.rgb *= 0.92 + 0.18*pdFbm(P, 0.9, 2).x;', normal: M.rich ? 'vec4 n = pdFbm(P, 26.0, 2); G += n.yzw*0.0018*pdFade(px*52.0);' : null });
    MAT.spruce = pd(std({ vertexColors: true, roughness: 0.82 }), { color: 'diffuseColor.rgb *= 0.9 + 0.2*pdFbm(P, 0.7, 2).x;', normal: M.rich ? 'vec4 n = pdFbm(P*vec3(1.0, 0.45, 1.0), 16.0, 3); G += n.yzw*vec3(1.0, 0.45, 1.0)*0.004*pdFade(px*64.0);' : null });
    MAT.spruceFar = std({ vertexColors: true, roughness: 0.9 });
    MAT.bark = pd(std({ color: col('#7a5638'), vertexColors: true, roughness: 0.9 }), { color: 'diffuseColor.rgb *= 0.85 + 0.25*pdFbm(P*vec3(9.0, 1.6, 9.0), 1.0, 3).x;' });
    MAT.rock = pd(std({ vertexColors: true, roughness: 0.85 }), { uniforms: { uRock: U(col('#cfccd6')) }, fdecl: 'uniform vec3 uRock;\n', color: 'diffuseColor.rgb = uRock*(0.84 + 0.3*pdFbm(P, 3.0, 3).x)*diffuseColor.rgb;', normal: 'vec4 n = pdFbm(P, 13.0, 3); G += n.yzw*0.004*pdFade(px*52.0);' });
    // tufts sway a little in the wind; both sides of a blade are lit like the ground under it
    MAT.tuft = pd(std({ vertexColors: true, roughness: 0.62, side: T.DoubleSide }), {
      noFlip: true, color: 'diffuseColor.rgb *= 0.9 + 0.2*pdFbm(P, 0.45, 2).x;',
      vertex: `{ float hh = max(position.y, 0.0);
        #ifdef USE_INSTANCING
          float ph = instanceMatrix[3].x * 0.9 + instanceMatrix[3].z * 1.3 + instanceMatrix[3].y * 0.7;
        #else
          float ph = 0.0;
        #endif
        transformed.x += sin(uTime * 2.1 + ph) * hh * hh * 1.6; transformed.z += cos(uTime * 1.7 + ph * 1.3) * hh * hh * 1.0; }`
    });
    MAT.flower = std({ vertexColors: true, roughness: 0.6, side: T.DoubleSide });
    MAT.stone = new T.MeshStandardMaterial({ color: col('#d9d1c0'), roughness: 0.95, flatShading: true });
    MAT.paint = new T.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, metalness: 0, clearcoat: 0.45, clearcoatRoughness: 0.25 });
    MAT.bucket = new T.MeshPhysicalMaterial({ color: col('#f08a24'), roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.3, side: T.DoubleSide });
    MAT.skin = pd(std({ vertexColors: true, roughness: 0.55 }), { space: 'object', color: 'diffuseColor.rgb *= 0.97 + 0.04*pdFbm(P, 60.0, 2).x;' });
    MAT.sleeve = pd(std({ vertexColors: true, roughness: 0.8 }), { space: 'object', color: 'diffuseColor.rgb *= 0.94 + 0.08*pdFbm(P, 30.0, 2).x;', normal: 'vec4 n2 = pdFbm(P, 22.0, 2); G += n2.yzw*0.0011;' });
    MAT.steel = new T.MeshPhysicalMaterial({ color: col('#dfe3e6'), metalness: 1, roughness: 0.2, envMapIntensity: 1.25 });
    MAT.shadowOnly = new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  }

  // ---------- sky ----------
  function skyMaterial(disc) {
    return new T.ShaderMaterial({
      uniforms: { uLF, uZen: U(col(V.sky.zen)), uHor: U(col(V.sky.hor)), uGround: U(col(V.sky.ground)), uSun: U(v3(V.sun[0], V.sun[1], V.sun[2]).normalize()), uSunCol: U(col(V.sunColor)), uDisc: U(disc ? 1 : 0), uDesat: U(disc ? 0 : V.skyDesat), uMoonOn: U(disc ? 1 : 0), uMoon: U(v3(V.moon[0], V.moon[1], V.moon[2]).normalize()) },
      side: T.BackSide, depthWrite: false, fog: false,
      vertexShader: 'uniform mat3 uLF; varying vec3 vDir; void main(){ vDir = uLF * position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); gl_Position.z = gl_Position.w; }',
      fragmentShader: `uniform vec3 uZen; uniform vec3 uHor; uniform vec3 uGround; uniform vec3 uSun; uniform vec3 uSunCol; uniform float uDisc; uniform float uDesat; uniform float uMoonOn; uniform vec3 uMoon; varying vec3 vDir;
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
          if (uMoonOn > 0.5) {
            float m = dot(d, uMoon); vec3 v = (d - uMoon*m)/0.030;
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
  // image-based light: the sky (without sun disc) rendered into an environment map
  function buildEnv() {
    const es = new T.Scene(); es.add(new T.Mesh(new T.SphereGeometry(40, 32, 16), skyMaterial(false)));
    const pm = new T.PMREMGenerator(renderer), rt = pm.fromScene(es, 0.01); pm.dispose();
    if (envTex) envTex.dispose(); envTex = rt.texture;
    scene.environment = envTex; scene.environmentIntensity = V.envI;
    handScene.environment = envTex; handScene.environmentIntensity = V.envI;
  }

  // ---------- setup ----------
  Scene.init = function (canvas) {
    renderer = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, M.maxDpr));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.NeutralToneMapping; renderer.toneMappingExposure = V.exposure;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap;

    scene = new T.Scene();
    scene.fog = new T.FogExp2(col(V.fog[0]), V.fog[1]);
    camera = new T.PerspectiveCamera(72, 1, 0.05, 30000); scene.add(camera);
    buildMaterials();

    // the sun: two shadow cascades fitted to the view, sharp but slightly soft edges
    sun = new T.SunLight(col(V.sunColor), V.sunI); sun.castShadow = true;
    sun.shadow.mapSize.set(M.shadow, M.shadow); sun.shadow.camera.far = 110; sun.shadow.radius = V.shadowRadius * 0.8;
    sun.shadow.bias = -0.00035; sun.shadow.normalBias = 0.02;
    sun.position.copy(sunDir).multiplyScalar(100); scene.add(sun);

    sky = new T.Mesh(new T.SphereGeometry(20000, 48, 24), skyMaterial(true));
    sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky);

    // first-person hand lives in its own scene (never clips into walls), lit by the same sun and sky
    handScene = new T.Scene();
    handCam = new T.PerspectiveCamera(58, 1, 0.01, 10); handScene.add(handCam);
    handSun = new T.DirectionalLight(col(V.sunColor), V.sunI); handSun.position.copy(sunDir); handScene.add(handSun);
    buildEnv();

    buildComposer();
    Hand.build();
    Particles.build();
    Deco.build();
    Scene.resize();
  };

  function buildComposer() {
    const rt = new T.WebGLRenderTarget(4, 4, { type: T.HalfFloatType, samples: M.samples });
    composer = new T.EffectComposer(renderer, rt);
    composer.addPass(new T.RenderPass(scene, camera));
    gtao = new T.GTAOPass(scene, camera, 4, 4);
    gtao.updateGtaoMaterial({ radius: 0.32, distanceExponent: 1.5, thickness: 1.0, scale: 1.15, samples: 12 });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    gtao.blendIntensity = 0.9;
    // the digger's invisible shadow-casting body must not show up in ambient occlusion
    const gr = gtao.render.bind(gtao); gtao.render = function () { Shadow.group.visible = Shadow.hold.visible = false; gr.apply(null, arguments); Shadow.group.visible = Shadow.hold.visible = true; };
    composer.addPass(gtao);
    const hp = new T.RenderPass(handScene, handCam); hp.clear = false; hp.clearDepth = true; composer.addPass(hp);
    bloom = new T.UnrealBloomPass(new T.Vector2(4, 4), 0.07, 0.5, 1.2); composer.addPass(bloom);
    composer.addPass(new T.OutputPass());
    composer.addPass(new T.ShaderPass({
      uniforms: { tDiffuse: { value: null }, uSat: U(V.grade.sat), uCon: U(V.grade.con), uVig: U(V.grade.vig) },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }',
      fragmentShader: `uniform sampler2D tDiffuse; uniform float uSat; uniform float uCon; uniform float uVig; varying vec2 vUv;
        void main(){ vec4 c = texture2D(tDiffuse, vUv); float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722)); c.rgb = mix(vec3(l), c.rgb, uSat); c.rgb = (c.rgb - 0.5)*uCon + 0.5;
          vec2 q = vUv - 0.5; c.rgb *= 1.0 - uVig*smoothstep(0.35, 0.95, length(q*vec2(1.0, 0.82))*1.35); gl_FragColor = vec4(clamp(c.rgb, 0.0, 1.0), 1.0); }`
    }));
    applyQuality();
  }
  function applyQuality() {
    if (gtao) gtao.enabled = quality === 'high';
    // multisampling: x4 on high, x2 on medium, none on fast (phones)
    if (composer) { const n = Math.min(M.samples, quality === 'high' ? 4 : quality === 'mid' ? 2 : 0); for (const rt of [composer.renderTarget1, composer.renderTarget2]) if (rt.samples !== n) { rt.samples = n; rt.dispose(); } }
    if (renderer) renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, quality === 'high' ? M.maxDpr : quality === 'mid' ? Math.min(M.maxDpr, 1.25) : 1));
    Scene.resize();
  }
  Scene.setQuality = q => { quality = q; applyQuality(); };
  Scene.getQuality = () => quality;

  Scene.resize = function () {
    if (!renderer) return;
    const w = root.innerWidth, h = root.innerHeight;
    renderer.setSize(w, h, false); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    handCam.aspect = w / h; handCam.updateProjectionMatrix();
  };

  // ---------- floating origin ----------
  Scene.origin = O;
  Scene.setFrame = function (u) { up.copy(u); };
  Scene.setSun = function () {};          // the sun is fixed by the region (setRegion)
  Scene.rel = (x, y, z, out) => (out || new T.Vector3()).set(x - O.x, y - O.y, z - O.z);

  // ---------- terrain: coarse chunks (0.4 m grid) and fine boxes (2.5 cm grid where it was dug) ----------
  const chunks = new Map();     // key -> { cx, cy, cz, data, mesh }
  const fines = new Map();      // key -> mesh
  let lastCenter = '', buildQueue = [], fineScan = 0;
  function makeMesh(m, bx, by, bz, mat, cast) {
    if (!m.idx.length) return null;
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(m.pos, 3));
    g.setAttribute('normal', new T.BufferAttribute(m.nrm, 3));
    const cols = new Float32Array(m.pos.length);
    for (let i = 0, n = m.pos.length / 3; i < n; i++) {
      if (m.depth[i] < 0.9) { cols[i * 3] = P.soil.r; cols[i * 3 + 1] = P.soil.g; cols[i * 3 + 2] = P.soil.b; continue; }
      const x = bx + m.pos[i * 3], y = by + m.pos[i * 3 + 1], z = bz + m.pos[i * 3 + 2];
      const nz = W.noise(x / 2.3, y / 2.3, z / 2.3, 7) * 0.6 + W.noise(x / 0.7, y / 0.7, z / 0.7, 9) * 0.25;
      groundColor(m.depth[i], 0, nz, tmpC);
      cols[i * 3] = tmpC.r; cols[i * 3 + 1] = tmpC.g; cols[i * 3 + 2] = tmpC.b;
    }
    g.setAttribute('color', new T.BufferAttribute(cols, 3));
    g.setAttribute('aDepth', new T.BufferAttribute(m.depth, 1));
    g.setIndex(new T.BufferAttribute(m.idx, 1));
    g.computeBoundingSphere();
    const mesh = new T.Mesh(g, mat);
    mesh.castShadow = cast; mesh.receiveShadow = true; mesh.userData.base = [bx, by, bz];
    mesh.position.set(bx - O.x, by - O.y, bz - O.z);
    scene.add(mesh); return mesh;
  }
  function drop(mesh) { if (mesh) { mesh.geometry.dispose(); scene.remove(mesh); } }
  function buildMesh(ch) {
    drop(ch.mesh);
    ch.mesh = makeMesh(W.meshChunk(ch.data), ch.cx * W.CH, ch.cy * W.CH, ch.cz * W.CH, MAT.terrain, false);
  }
  function buildFine(k) {
    const [a, b, c] = k.split(',').map(Number), F = W.LF.CH;
    drop(fines.get(k));
    fines.set(k, makeMesh(W.meshChunk(W.sampleFine(a, b, c)), a * F, b * F, c * F, MAT.terrainFine, true));
  }
  // Decide which chunks should exist around the player; returns how many are still waiting to be built.
  Scene.updateChunks = function (p, budgetMs) {
    const cx = Math.floor(p.x / W.CH), cy = Math.floor(p.y / W.CH), cz = Math.floor(p.z / W.CH), ck = cx + ',' + cy + ',' + cz;
    if (ck !== lastCenter) {
      lastCenter = ck;
      const r = Math.ceil(M.load / W.CH), want = new Set(); const list = [];
      for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) for (let c = -r; c <= r; c++) {
        const X = cx + a, Y = cy + b, Z = cz + c;
        const dx = (X + 0.5) * W.CH - p.x, dy = (Y + 0.5) * W.CH - p.y, dz = (Z + 0.5) * W.CH - p.z, dist = Math.hypot(dx, dy, dz);
        if (dist > M.load + W.CH * 0.87) continue;
        if (!W.chunkMayHaveSurface(X, Y, Z)) continue;
        const k = W.key(X, Y, Z); want.add(k);
        if (!chunks.has(k)) list.push({ k, X, Y, Z, dist });
      }
      for (const [k, ch] of chunks) if (!want.has(k)) { drop(ch.mesh); chunks.delete(k); }
      // fine boxes: keep those in range, queue the missing ones
      const F = W.LF.CH, lim = M.load + 4;
      for (const [k, m] of fines) { const [a, b, c] = k.split(',').map(Number); if (Math.hypot((a + 0.5) * F - p.x, (b + 0.5) * F - p.y, (c + 0.5) * F - p.z) > lim + 6) { drop(m); fines.delete(k); } }
      for (const k of W.fineSet) if (!fines.has(k)) { const [a, b, c] = k.split(',').map(Number), dist = Math.hypot((a + 0.5) * F - p.x, (b + 0.5) * F - p.y, (c + 0.5) * F - p.z); if (dist < lim) list.push({ k, fine: true, dist: dist * 0.5 }); }
      list.sort((a, b) => a.dist - b.dist); buildQueue = list;
    }
    const t0 = performance.now();
    while (buildQueue.length && performance.now() - t0 < budgetMs) {
      const q = buildQueue.shift();
      if (q.fine) { if (!fines.has(q.k)) buildFine(q.k); continue; }
      if (chunks.has(q.k)) continue;
      const ch = { cx: q.X, cy: q.Y, cz: q.Z, data: W.sampleChunk(q.X, q.Y, q.Z), mesh: null };
      chunks.set(q.k, ch); buildMesh(ch);
    }
    return buildQueue.length;
  };
  // A hole was dug: re-mesh what it touched right away. res = { coarse: [keys], fine: [keys] } from World.addHole.
  Scene.applyHole = function (h, res) {
    for (const k of res.fine) buildFine(k);
    for (const k of res.coarse) {
      const ch = chunks.get(k);
      if (ch) { if (h[3] >= W.BIG) W.carve(ch.data, h); buildMesh(ch); }
      else if (h[3] >= W.BIG) { const [X, Y, Z] = k.split(',').map(Number); const c = { cx: X, cy: Y, cz: Z, data: W.sampleChunk(X, Y, Z), mesh: null }; chunks.set(k, c); buildMesh(c); }
    }
    Deco.hole(h);
  };
  Scene.chunkCount = () => chunks.size;
  Scene.resetChunks = function () { for (const ch of chunks.values()) drop(ch.mesh); chunks.clear(); for (const m of fines.values()) drop(m); fines.clear(); lastCenter = ''; buildQueue = []; };

  // ---------- far terrain (non-diggable ring out to the horizon) ----------
  let far = null, farAnchor = null;
  const FAR_OUT = 4200, NR = 56, NA = 120;
  const lawnMid = col(V.lawn[0]).lerp(col(V.lawn[1]), 0.55);
  function buildFar(p) {
    farAnchor = p.clone();
    const u = p.clone().normalize();
    const e1 = new T.Vector3().crossVectors(Math.abs(u.y) < 0.9 ? v3(0, 1, 0) : v3(1, 0, 0), u).normalize(), e2 = new T.Vector3().crossVectors(u, e1);
    const pos = new Float32Array(NR * NA * 3), cols = new Float32Array(NR * NA * 3);
    const base = u.clone().multiplyScalar(W.R);
    for (let i = 0; i < NR; i++) {
      const r = M.farIn * Math.pow(FAR_OUT / M.farIn, i / (NR - 1));
      for (let a = 0; a < NA; a++) {
        const t = a / NA * Math.PI * 2, x = base.x + (e1.x * Math.cos(t) + e2.x * Math.sin(t)) * r, y = base.y + (e1.y * Math.cos(t) + e2.y * Math.sin(t)) * r, z = base.z + (e1.z * Math.cos(t) + e2.z * Math.sin(t)) * r;
        const l = Math.hypot(x, y, z), dx = x / l, dy = y / l, dz = z / l, h = W.heightDir(dx, dy, dz), rr = W.R + h - (i === 0 ? 0.35 : 0.15);
        const n = (i * NA + a) * 3;
        pos[n] = dx * rr - O.x; pos[n + 1] = dy * rr - O.y; pos[n + 2] = dz * rr - O.z;
        const nz = W.noise(x / 60, y / 60, z / 60, 5), forest = W.noise(x / 260, y / 260, z / 260, 77) + 0.05;
        if (h > 320) tmpC.copy(P.snow); else if (h > 230) tmpC.copy(P.rock).lerp(P.snow, Math.max(0, (h - 300) / 20));
        else tmpC.copy(lawnMid).lerp(P.grassDry, Math.max(0, nz * 0.6)).lerp(P.forest, Math.min(1, Math.max(0, forest * 2.2)) * Math.min(1, r / 400));
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
    const nn = g.getAttribute('normal'); const test = v3(nn.getX(NA * 5), nn.getY(NA * 5), nn.getZ(NA * 5));
    if (test.dot(u) < 0) { const ia = g.getIndex().array; for (let k = 0; k < ia.length; k += 3) { const s = ia[k + 1]; ia[k + 1] = ia[k + 2]; ia[k + 2] = s; } g.computeVertexNormals(); }
    if (far) { far.geometry.dispose(); far.geometry = g; } else { far = new T.Mesh(g, MAT.far); far.receiveShadow = true; scene.add(far); }
  }
  Scene.updateFar = function (p, force) { if (force || !farAnchor || farAnchor.distanceTo(p) > 8) buildFar(p); };

  // ---------- places where nothing grows (props, the start spot) ----------
  const blocked = [];   // [x, y, z, r] in planet metres
  const isBlocked = (x, y, z, pad) => { for (const b of blocked) { const r = b[3] + pad; if ((x - b[0]) * (x - b[0]) + (y - b[1]) * (y - b[1]) + (z - b[2]) * (z - b[2]) < r * r) return true; } return false; };

  // ---------- decorations: sculpted trees, bushes, rocks, grass tufts, flat pebbles, flowers ----------
  const Deco = {
    kinds: {}, anchor: null, grassAnchor: null, bigItems: [], smallItems: [],
    build() {
      const t0 = performance.now(), d = M.detail;
      const mk = (geos, mats, max, cast) => {
        const list = geos.map((g, i) => { if (!g.getAttribute('color')) g.setAttribute('color', new T.BufferAttribute(new Float32Array(g.getAttribute('position').count * 3).fill(1), 3)); const m = new T.InstancedMesh(g, mats[i], max); m.count = 0; m.castShadow = cast; m.receiveShadow = true; m.frustumCulled = false; scene.add(m); return m; });
        return { meshes: list, n: 0, max, stage: new Float32Array(max * 16), sn: 0 };
      };
      const treeO = (cell, trunkCell) => ({ leafDark: V.leaf[0], leafLight: V.leaf[1], cell, trunkCell });
      // near: smooth sculpts; far: the same shapes sculpted coarsely (a few hundred triangles)
      const tA = A.tree(11, treeO(0.1 * d, 0.06 * d)), tB = A.tree(23, treeO(0.1 * d, 0.06 * d));
      const fA = A.tree(11, treeO(0.4, 0.2)), fB = A.tree(23, treeO(0.4, 0.2));
      const sp = A.spruce(5, { dark: V.spruce[0], light: V.spruce[1], cell: 0.11 * d });
      const spFar = A.spruceFar({ dark: V.spruce[0], light: V.spruce[1], seg: 9 });
      const bo = c => ({ dark: V.leaf[0], light: V.leaf[1], cell: c });
      const bush = A.bush(4, bo(0.05 * d)), bushF = A.bush(4, bo(0.14)), rock1 = A.rock(1, { cell: 0.045 * d }), rock2 = A.rock(2, { cell: 0.045 * d }), rockF = A.rock(1, { cell: 0.13 });
      this.kinds = {
        treeA: mk([tA.trunk, tA.crown], [MAT.bark, MAT.crown], 400, true), treeB: mk([tB.trunk, tB.crown], [MAT.bark, MAT.crown], 400, true),
        treeAfar: mk([fA.trunk, fA.crown], [MAT.bark, MAT.crown], 2000, false), treeBfar: mk([fB.trunk, fB.crown], [MAT.bark, MAT.crown], 2000, false),
        spruce: mk([sp.geo], [MAT.spruce], 400, true), spruceFar: mk([spFar], [MAT.spruceFar], 2500, false),
        bush: mk([bush], [MAT.crown], 400, true), bushfar: mk([bushF], [MAT.crown], 1500, false),
        rock1: mk([rock1], [MAT.rock], 300, true), rock2: mk([rock2], [MAT.rock], 300, true), rockfar: mk([rockF], [MAT.rock], 1000, false),
        tuft0: mk([A.tuft(400, V.tuft)], [MAT.tuft], 5000, M.smallShadow), tuft1: mk([A.tuft(401, V.tuft)], [MAT.tuft], 5000, M.smallShadow),
        peb0: mk([A.pebbleFlat(1)], [MAT.stone], 3000, true), peb1: mk([A.pebbleFlat(2)], [MAT.stone], 3000, true), peb2: mk([A.pebbleFlat(3)], [MAT.stone], 3000, true),
        flW: mk([A.flower('#ffffff')], [MAT.flower], 600, M.smallShadow),
        flY: mk([A.flower('#ffd83a', { petals: 6, len: 0.011, wid: 0.008, h: 0.13, centre: '#f0a020' })], [MAT.flower], 400, M.smallShadow),
        flV: mk([A.flower('#b79cff', { petals: 5, len: 0.012, wid: 0.007, h: 0.11, centre: '#fff2a8' })], [MAT.flower], 400, M.smallShadow)
      };
      this.big = ['treeA', 'treeB', 'treeAfar', 'treeBfar', 'spruce', 'spruceFar', 'bush', 'bushfar', 'rock1', 'rock2', 'rockfar'];
      this.small = ['tuft0', 'tuft1', 'peb0', 'peb1', 'peb2', 'flW', 'flY', 'flV'];
      console.log('[scene] sculpts built in ' + Math.round(performance.now() - t0) + ' ms');
    },
    // place objects on a fixed 3D lattice sliced by the sea-level sphere, so they never move as you walk
    *scatter(p, radius, cell, fn) {
      const u = p.clone().normalize(), e1 = new T.Vector3().crossVectors(Math.abs(u.y) < 0.9 ? v3(0, 1, 0) : v3(1, 0, 0), u).normalize(), e2 = new T.Vector3().crossVectors(u, e1);
      const seen = new Set(), step = cell * 0.5, n = Math.ceil(radius / step), b = u.clone().multiplyScalar(W.R);
      for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
        if (i * i + j * j > n * n) continue;
        const x = b.x + (e1.x * i + e2.x * j) * step, y = b.y + (e1.y * i + e2.y * j) * step, z = b.z + (e1.z * i + e2.z * j) * step;
        const l = Math.hypot(x, y, z), sx = x / l * W.R, sy = y / l * W.R, sz = z / l * W.R;
        const X = Math.floor(sx / cell), Y = Math.floor(sy / cell), Z = Math.floor(sz / cell), k = X + ',' + Y + ',' + Z;
        if (seen.has(k)) continue; seen.add(k); fn(X, Y, Z);
        if ((j & 7) === 0) yield;
      }
    },
    _m: new T.Matrix4(), _q: new T.Quaternion(), _q2: new T.Quaternion(), _u: v3(0, 0, 0),
    add(kind, x, y, z, s, yaw, tilt, list) {
      const K = this.kinds[kind]; if (K.sn >= K.max) return;
      const l = Math.hypot(x, y, z); this._u.set(x / l, y / l, z / l);
      const q = this._q.setFromUnitVectors(Y_AX, this._u).multiply(this._q2.setFromAxisAngle(Y_AX, yaw));
      if (tilt) q.multiply(this._q2.setFromAxisAngle(X_AX, tilt));
      this._m.compose(v3(x - O.x, y - O.y, z - O.z), q, v3(s, s, s));
      this._m.toArray(K.stage, K.sn * 16);
      list.push([K, K.sn, x, y, z]); K.sn++;
    },
    // placement runs a little every frame (no hitches); the new layout replaces the old one when it is complete
    finish(names) { for (const k of names) { const K = this.kinds[k]; K.n = K.sn; for (const m of K.meshes) { m.instanceMatrix.array.set(K.stage.subarray(0, K.sn * 16)); m.count = K.n; m.instanceMatrix.needsUpdate = true; } } },
    jobs: {},
    update(p, force, budgetMs) {
      if (force || (!this.jobs.big && (!this.anchor || this.anchor.distanceTo(p) > 30))) { this.anchor = p.clone(); this.jobs.big = this.placeBig(p.clone()); }
      if (force || (!this.jobs.small && (!this.grassAnchor || this.grassAnchor.distanceTo(p) > M.grassR * 0.22))) { this.grassAnchor = p.clone(); this.jobs.small = this.placeSmall(p.clone()); }
      const t0 = performance.now(), budget = force ? 1e9 : (budgetMs || 3);
      for (const name of ['small', 'big']) { const j = this.jobs[name]; if (!j) continue; while (performance.now() - t0 < budget) { if (j.next().done) { this.jobs[name] = null; break; } } }
    },
    alive(x, y, z) {   // ground still there under this point (not dug away)?
      const l = Math.hypot(x, y, z);
      return W.solid(x - x / l * 0.15, y - y / l * 0.15, z - z / l * 0.15) > 0 && W.solid(x + x / l * 0.25, y + y / l * 0.25, z + z / l * 0.25) < 0;
    },
    *placeBig(p) {
      for (const k of this.big) this.kinds[k].sn = 0; const items = [];
      const spawn = Scene.spawnPoint, near2 = M.nearR * M.nearR;
      yield* this.scatter(p, M.treeR, 9, (X, Y, Z) => {
        const r = W.hash01(X, Y, Z), jx = W.hash01(X, Y, Z + 7), jy = W.hash01(X + 3, Y, Z), jz = W.hash01(X, Y + 5, Z);
        let x = (X + jx) * 9, y = (Y + jy) * 9, z = (Z + jz) * 9; const l = Math.hypot(x, y, z);
        const forest = W.noise(x / 260, y / 260, z / 260, 77) + 0.05;
        const h = W.heightDir(x / l, y / l, z / l); if (h > 225) return;
        const rr = W.R + h - 0.08; x = x / l * rr; y = y / l * rr; z = z / l * rr;
        if (spawn && Math.hypot(x - spawn.x, y - spawn.y, z - spawn.z) < 12) return;
        if (isBlocked(x, y, z, 1.5) || !this.alive(x, y, z)) return;
        const yaw = r * 40, s = 0.85 + W.hash01(X + 1, Y + 1, Z + 1) * 0.5, near = (x - p.x) * (x - p.x) + (y - p.y) * (y - p.y) + (z - p.z) * (z - p.z) < near2;
        let kind = null, sc = s;
        if (r < 0.06 + Math.max(0, forest) * 0.55) {
          if (forest > 0.25 && r < 0.5 * forest) kind = near ? 'spruce' : 'spruceFar';
          else kind = (W.hash01(X, Z, Y) < 0.5 ? 'treeA' : 'treeB') + (near ? '' : 'far');
          if (kind === 'spruceFar') sc *= 0.75;
        } else if (r > 0.935) { kind = near ? 'bush' : 'bushfar'; sc = 0.9 + s * 0.4; }
        else if (r > 0.91) { kind = near ? (r > 0.922 ? 'rock1' : 'rock2') : 'rockfar'; sc = 0.4 + s * 0.6; }
        if (!kind) return;
        this.add(kind, x, y, z, sc, yaw, 0, items);
      });
      this.finish(this.big); this.bigItems = items;
    },
    *placeSmall(p) {
      for (const k of this.small) this.kinds[k].sn = 0; const items = [];
      const fl = ['flW', 'flW', 'flY', 'flV'];
      yield* this.scatter(p, M.grassR, 0.6, (X, Y, Z) => {
        const r = W.hash01(X, Y, Z); if (r > 0.42) return;
        let x = (X + W.hash01(X, Y, Z + 7)) * 0.6, y = (Y + W.hash01(X + 3, Y, Z)) * 0.6, z = (Z + W.hash01(X, Y + 5, Z)) * 0.6;
        const l = Math.hypot(x, y, z), h = W.heightDir(x / l, y / l, z / l); if (h > 215) return;
        const rr = W.R + h; x = x / l * rr; y = y / l * rr; z = z / l * rr;
        if (isBlocked(x, y, z, 0.1) || !this.alive(x, y, z)) return;
        // keep things off steep slopes
        const ux = x / rr, uy = y / rr, uz = z / rr, e = 0.4;
        const gx = W.solid(x + e, y, z) - W.solid(x - e, y, z), gy = W.solid(x, y + e, z) - W.solid(x, y - e, z), gz = W.solid(x, y, z + e) - W.solid(x, y, z - e);
        const gl = Math.hypot(gx, gy, gz) || 1; if (-(gx * ux + gy * uy + gz * uz) / gl < 0.8) return;
        const r2 = W.hash01(X + 2, Y, Z), r3 = W.hash01(X, Y + 2, Z), yaw = r2 * 40;
        const patch = W.noise(x / 4, y / 4, z / 4, 19);
        if (r < 0.16) {   // a chunky tuft (in loose patches)
          if (patch < -0.05) return;
          this.add(r2 < 0.5 ? 'tuft0' : 'tuft1', x - ux * 0.004, y - uy * 0.004, z - uz * 0.004, 0.8 + r3 * 0.7, yaw, (r2 - 0.5) * 0.1, items);
        } else if (r < 0.36) {   // a flat faceted pebble, sometimes with a smaller one next to it
          const big = 0.016 + r3 * 0.034 + (r2 < 0.03 ? 0.05 : 0), k = 'peb' + (Math.floor(r2 * 3) % 3);
          this.add(k, x + ux * big * 0.08, y + uy * big * 0.08, z + uz * big * 0.08, big, yaw, (r3 - 0.5) * 0.25, items);
          if (r3 < 0.4) { const o = 0.12, sx = x + (r2 - 0.5) * o, sz = z + (r3 - 0.2) * o; this.add('peb' + ((Math.floor(r2 * 3) + 1) % 3), sx, y, sz, big * 0.5, yaw * 1.7, 0, items); }
        } else if (r > 0.405 && patch > 0.1) {   // a few flowers in drifts
          this.add(fl[Math.floor(r3 * 4)], x - ux * 0.004, y - uy * 0.004, z - uz * 0.004, 0.85 + r2 * 0.5, yaw, (r3 - 0.5) * 0.25, items);
        }
      });
      this.finish(this.small); this.smallItems = items;
    },
    hole(h) {   // hide anything whose base was dug out
      const zero = new T.Matrix4().makeScale(0, 0, 0);
      for (const list of [this.smallItems, this.bigItems]) for (const it of list) {
        const [K, i, x, y, z] = it; if (it.gone) continue;
        if (Math.hypot(x - h[0], y - h[1], z - h[2]) < h[3] + (list === this.smallItems ? 0.25 : 0.6)) {
          if (!this.alive(x, y, z)) { it.gone = true; for (const m of K.meshes) { m.setMatrixAt(i, zero); m.instanceMatrix.needsUpdate = true; } }
        }
      }
    }
  };
  const Y_AX = v3(0, 1, 0), X_AX = v3(1, 0, 0);
  Scene.updateDeco = (p, force, budget) => Deco.update(p, force, budget);
  Scene._deco = Deco;
  Scene.buildClouds = function () {};     // the chosen look has a clear sky with the moon instead of clouds

  // ---------- the first base at the start: a wooden shack and the bin where soil is handed in ----------
  // Positions are in the local frame: x right, z back (the player first looks toward -z).
  // Nothing can be dug under them (World.blockers) and the player can't walk through them.
  function signTexture(lines) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const c = cv.getContext('2d');
    c.fillStyle = '#f3e7cf'; c.fillRect(0, 0, 512, 256); c.fillStyle = 'rgba(120,80,40,.08)'; for (let i = 0; i < 8; i++) c.fillRect(0, i * 32 + 6, 512, 4);
    c.strokeStyle = '#7a5234'; c.lineWidth = 14; c.strokeRect(7, 7, 498, 242);
    c.textAlign = 'center'; c.fillStyle = '#c4561a'; c.font = 'bold 66px "Nunito", "Arial Rounded MT Bold", sans-serif'; c.fillText(lines[0], 256, 112);
    c.fillStyle = '#4a2c14'; c.font = 'bold 42px "Nunito", sans-serif'; c.fillText(lines[1], 256, 186);
    const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4; return tex;
  }
  Scene.addProps = function (labels) {
    const g = new T.Group(); g.position.set(anchor.x - O.x, anchor.y - O.y, anchor.z - O.z);
    g.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(LX, LY, LZ));
    const groundAt = (lx, lz) => { const w = anchor.clone().addScaledVector(LX, lx).addScaledVector(LZ, lz), l = w.length(); return W.heightDir(w.x / l, w.y / l, w.z / l); };
    const worldAt = (lx, ly, lz) => anchor.clone().addScaledVector(LX, lx).addScaledVector(LZ, lz).addScaledVector(LY, ly);
    const block = (lx, lz, r, solidR) => { const w = worldAt(lx, groundAt(lx, lz), lz); W.blockers.push([w.x, w.y, w.z, r, solidR === undefined ? r : solidR]); blocked.push([w.x, w.y, w.z, r + 0.3]); };
    const place = (obj, lx, lz, yaw, sink) => {
      // sit on the lowest ground under the footprint so nothing floats
      obj.position.set(lx, groundAt(lx, lz) - (sink || 0), lz); obj.rotation.y = yaw || 0; g.add(obj);
      obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      return obj;
    };
    const wood = pd(std({ vertexColors: true, roughness: 0.82 }), { space: 'object', color: 'diffuseColor.rgb *= 0.88 + 0.2*pdFbm(P*vec3(1.0, 9.0, 1.0), 6.0, 2).x;' });
    const metal = std({ vertexColors: true, roughness: 0.45, metalness: 0.55 }), glass = new T.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.08, metalness: 0, clearcoat: 1 });
    // the shack, a little to the left, its door toward the start point
    const sh = A.shack(), shg = new T.Group(); shg.add(new T.Mesh(sh.wood, wood), new T.Mesh(sh.metal, metal), new T.Mesh(sh.glass, glass));
    const SX = -4.2, SZ = -7.5, SY = 0.55;
    const c0 = Math.cos(SY), s0 = Math.sin(SY), sink = Math.max(...[[-1.6, -1.3], [1.6, -1.3], [-1.6, 1.3], [1.6, 1.3]].map(([a, b2]) => groundAt(SX, SZ) - groundAt(SX + a * c0 + b2 * s0, SZ - a * s0 + b2 * c0)));
    place(shg, SX, SZ, SY, Math.max(0.05, sink + 0.05));
    // a sign over the door
    const signM = new T.MeshStandardMaterial({ map: signTexture(labels.sign), roughness: 0.8 });
    const sign = new T.Mesh(new T.PlaneGeometry(1.0, 0.5), signM); sign.position.set(0.92, 2.06, 1.27); shg.add(sign);
    block(SX, SZ, 1.75, 1.6);
    // the soil bin next to the door, with a pile that grows as soil is handed in
    const bin = new T.Group(); bin.add(new T.Mesh(A.bin(), wood));
    const pile = new T.Mesh(new T.SphereGeometry(0.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), MAT.soil); pile.scale.set(0.98, 0.05, 0.6); pile.position.y = 0.1; bin.add(pile);
    const BX = SX + 2.1, BZ = SZ + 1.3; place(bin, BX, BZ, SY, 0.03);
    block(BX, BZ, 0.75, 0.65);
    Scene.drop = { point: worldAt(BX, groundAt(BX, BZ) + 0.5, BZ), pile, fill: 0 };
    scene.add(g); Scene.props = g;
  };
  Scene.setPile = function (k) { const d = Scene.drop; if (!d) return; d.fill = Math.min(1, k); d.pile.scale.y = 0.05 + d.fill * 0.9; d.pile.position.y = 0.1 + d.fill * 0.25; };

  // ---------- particles: dirt clods and dust ----------
  const Particles = {
    MAX: 500, list: [],
    build() {
      const geo = new T.IcosahedronGeometry(1, 1);
      this.mesh = new T.InstancedMesh(geo, new T.MeshStandardMaterial({ roughness: 1 }), this.MAX);
      this.mesh.count = 0; this.mesh.castShadow = true; this.mesh.frustumCulled = false; scene.add(this.mesh);
      for (let i = 0; i < this.MAX; i++) this.mesh.setColorAt(i, P.soil);
      const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d');
      const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
      this.dustTex = new T.CanvasTexture(cv); this.dust = [];
    },
    burst(x, y, z, color, n, toward, size) {
      const u = v3(x, y, z).normalize(), k = size || 1;
      for (let i = 0; i < n; i++) {
        if (this.list.length >= this.MAX) this.list.shift();
        const d = v3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
        const vel = u.clone().multiplyScalar((2.2 + Math.random() * 2.5) * Math.sqrt(k)).addScaledVector(d, 1.6 * Math.sqrt(k));
        if (toward) vel.addScaledVector(toward, 1.2);
        const c = color.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.08);
        this.list.push({ p: v3(x, y, z).addScaledVector(d, 0.1 * k), v: vel, s: (0.035 + Math.random() * 0.06) * k, life: 1.3 + Math.random() * 0.8, t: 0, rest: false, c, rot: Math.random() * 6 });
      }
      for (let i = 0; i < 3; i++) {
        const mat = new T.SpriteMaterial({ map: this.dustTex, color: color.clone().lerp(col('#e8dccb'), 0.5), transparent: true, opacity: 0.5, depthWrite: false });
        const sp = new T.Sprite(mat); const d = v3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.3 * k);
        sp.userData = { p: v3(x, y, z).add(d).addScaledVector(u, 0.15 * k), t: 0, life: 1.1 + Math.random() * 0.6, v: u.clone().multiplyScalar(0.4 * k).add(d), k };
        scene.add(sp); this.dust.push(sp);
      }
    },
    update(dt) {
      const m = new T.Matrix4(), q = new T.Quaternion();
      for (let i = this.list.length - 1; i >= 0; i--) {
        const p = this.list[i]; p.t += dt;
        if (p.t > p.life) { this.list.splice(i, 1); continue; }
        if (!p.rest) {
          const u = p.p.clone().normalize();
          p.v.addScaledVector(u, -16 * dt); p.p.addScaledVector(p.v, dt); p.rot += dt * 8;
          if (W.solid(p.p.x, p.p.y, p.p.z) > -p.s * 0.5) { p.p.addScaledVector(u, 0.03 * p.s / 0.06); p.v.multiplyScalar(-0.25); if (p.v.length() < 0.8) p.rest = true; }
        }
      }
      let n = 0;
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
        const k = d.t / d.life; sp.position.set(d.p.x - O.x, d.p.y - O.y, d.p.z - O.z); sp.scale.setScalar((0.35 + k * 1.1) * d.k); sp.material.opacity = 0.45 * (1 - k);
      }
    }
  };
  Scene.burst = (x, y, z, c, n, toward, size) => Particles.burst(x, y, z, c, n, toward, size);

  // ---------- first-person bare hand gripping a spoon ----------
  // hold: pivot in camera space (moves for the scoop stroke); hand: the sculpt in its approved look-dev pose
  const Hand = {
    full: false, bob: 0, tip: 0,
    build() {
      const t0 = performance.now(), sp = A.spoon(M.detail), pal = V.pal;
      const skin = new T.Mesh(A.glove(pal, M.detail), MAT.skin), sleeve = new T.Mesh(A.sleeve(pal), MAT.sleeve), spoon = new T.Mesh(sp.spoon, MAT.steel), soil = new T.Mesh(sp.soil, MAT.soilObj);
      this.hold = new T.Group(); this.hand = new T.Group(); this.soil = soil; soil.visible = false;
      this.hand.add(skin, sleeve, spoon, soil); this.hold.add(this.hand); handCam.add(this.hold);
      for (const m of [skin, sleeve, spoon, soil]) m.frustumCulled = false;
      // the base pose from the approved frame
      const h = v3(-0.25, 0.85, -0.46).normalize(), hint = v3(0, 0.3, 1), u = hint.clone().addScaledVector(h, -hint.dot(h)).normalize(), s = new T.Vector3().crossVectors(h, u).normalize();
      this.hand.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(s, u, h.clone().negate()));
      this.base = v3(0.185, -0.160, -0.45);
      Shadow.build(skin.geometry, spoon.geometry, this.hand.quaternion);
      // the bucket, held low on the left; its soil rises as it fills
      const b = A.bucket(); this.bucket = new T.Group();
      const bb = new T.Mesh(b.body, MAT.bucket), bs = new T.Mesh(b.soil, MAT.soilObj); bs.position.y = -0.158; this.bucketSoil = bs;
      this.bucket.add(bb, bs); this.bucket.position.set(-0.36, -0.40, -0.62); this.bucket.rotation.set(0.42, 0.5, 0.1); this.bucket.scale.setScalar(0.95);
      for (const m of [bb, bs]) m.frustumCulled = false;
      handCam.add(this.bucket); this.setFill(0);
      console.log('[scene] hand built in ' + Math.round(performance.now() - t0) + ' ms');
    },
    setFill(k) { this.fill = k; this.bucketSoil.visible = k > 0.01; this.bucketSoil.position.y = -0.155 + k * 0.155; this.bucketSoil.scale.setScalar(0.86 + 0.14 * k); },
    // the scoop stroke as keyframes over its progress k: [k, dx, dy, dz, rotation about camera x]
    KEYS: [[0, 0, 0, 0, 0], [0.3, 0.005, 0.035, 0.02, 0.32], [0.48, -0.02, -0.09, -0.15, -0.75], [0.62, -0.015, -0.07, -0.12, -0.55], [0.8, -0.005, -0.02, -0.04, 0.3], [1, 0, 0, 0, 0]],
    update(k, walk, t, dt, look) {
      this.bob += dt * (4 + walk * 7) * (walk > 0.05 ? 1 : 0.3);
      const bx = Math.sin(this.bob) * 0.010 * (0.3 + walk), by = Math.abs(Math.cos(this.bob)) * 0.012 * (0.3 + walk) + Math.sin(t * 1.3) * 0.003;
      const sw = look || { x: 0, y: 0 };
      let dx = 0, dy = 0, dz = 0, rx = 0;
      if (k >= 0) {
        const K = this.KEYS; let i = 0; while (i < K.length - 2 && k > K[i + 1][0]) i++;
        const a = K[i], b = K[i + 1], f = Math.min(1, Math.max(0, (k - a[0]) / (b[0] - a[0]))), e = f * f * (3 - 2 * f);
        dx = a[1] + (b[1] - a[1]) * e; dy = a[2] + (b[2] - a[2]) * e; dz = a[3] + (b[3] - a[3]) * e; rx = a[4] + (b[4] - a[4]) * e;
      }
      this.hold.position.set(this.base.x + bx + sw.x + dx, this.base.y + by + sw.y + dy, this.base.z + dz);
      this.hold.rotation.set(rx, 0, 0);
      this.soil.visible = this.full;
      this.bucket.position.set(-0.36 + bx * 0.6 + sw.x, -0.40 + by * 1.2 + sw.y + this.tip * 0.08, -0.62 - this.tip * 0.05); this.bucket.rotation.z = 0.12 - this.tip * 0.9;
    }
  };
  Scene.setSpoonFull = on => { Hand.full = !!on; };
  Scene.setBucket = k => Hand.setFill(Math.max(0, Math.min(1, k)));
  Scene.setTip = k => { Hand.tip = k; };   // 0..1: tipping the bucket out at the bin
  Scene.setTool = function () {};
  Scene._hand = Hand;

  // ---------- the digger's shadow: an unseen body and hand that only cast shadows ----------
  const Shadow = {
    group: new T.Group(), body: new T.Group(), hold: new T.Group(),
    build(handGeo, spoonGeo, handQ) {
      const mat = MAT.shadowOnly, add = (parent, m) => { m.castShadow = true; m.frustumCulled = false; parent.add(m); };
      const cap = (rad, a, b) => { const m = new T.Mesh(new T.CapsuleGeometry(rad, a.distanceTo(b), 4, 12), mat); m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(Y_AX, b.clone().sub(a).normalize()); add(this.body, m); };
      // an ordinary person in work clothes: legs, hips, torso, shoulders, arms (right one reaching forward with the spoon,
      // left one down holding the bucket), neck and head
      cap(0.07, v3(-0.1, 0.08, 0), v3(-0.1, 0.86, 0)); cap(0.07, v3(0.1, 0.08, 0), v3(0.1, 0.86, 0));
      cap(0.15, v3(0, 0.98, 0), v3(0, 1.12, 0)); cap(0.165, v3(0, 1.16, 0), v3(0, 1.3, 0));
      cap(0.075, v3(-0.17, 1.4, 0), v3(0.17, 1.4, 0));
      cap(0.05, v3(-0.23, 1.38, 0), v3(-0.27, 0.88, 0.02)); cap(0.05, v3(0.23, 1.38, 0), v3(0.33, 1.12, -0.2));
      cap(0.045, v3(0, 1.45, 0), v3(0, 1.53, 0));
      const head = new T.Mesh(new T.SphereGeometry(1, 16, 12), mat); head.scale.set(0.095, 0.12, 0.105); head.position.set(0, 1.64, 0); add(this.body, head);
      const bucket = new T.Mesh(new T.CylinderGeometry(0.12, 0.09, 0.22, 16), mat); bucket.position.set(-0.29, 0.72, 0.03); add(this.body, bucket);
      const hd = new T.Group(); hd.quaternion.copy(handQ); add(hd, new T.Mesh(handGeo, mat)); add(hd, new T.Mesh(spoonGeo, mat)); this.hold.add(hd);
      this.group.add(this.body); scene.add(this.group); camera.add(this.hold);
    },
    update(eye, q) {
      // body stands under the eye, facing where the camera looks (projected on the ground)
      const fwd = v3(0, 0, -1).applyQuaternion(q); fwd.addScaledVector(up, -fwd.dot(up)); if (fwd.lengthSq() < 1e-6) fwd.set(1, 0, 0).addScaledVector(up, -up.x); fwd.normalize();
      const right = new T.Vector3().crossVectors(fwd, up).normalize();
      this.body.position.set(eye.x - O.x, eye.y - O.y, eye.z - O.z).addScaledVector(up, -1.62);
      this.body.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(right, up, fwd.clone().negate()));
      this.hold.position.copy(Hand.hold.position); this.hold.quaternion.copy(Hand.hold.quaternion);
    }
  };

  // ---------- per frame ----------
  // eye: camera position (planet metres), q: camera orientation, info: { dig, walk, look }
  Scene.render = function (eye, q, info, dt, t) {
    timeU.value = t;
    if (eye.distanceTo(O) > 800) Scene.rebase(eye);   // move the floating origin when the player wanders far from it
    camera.position.set(eye.x - O.x, eye.y - O.y, eye.z - O.z); camera.quaternion.copy(q);
    camera.updateMatrixWorld();
    handCam.quaternion.copy(q); handCam.updateMatrixWorld();
    sky.position.copy(camera.position);
    Particles.update(dt);
    Hand.update(info.dig, info.walk, t, dt, info.look);
    Shadow.update(eye, q);
    composer.render(dt);
  };
  Scene.rebase = function (p) {
    O.set(Math.round(p.x), Math.round(p.y), Math.round(p.z));
    uOff.value.copy(O).sub(anchor);
    for (const ch of chunks.values()) if (ch.mesh) ch.mesh.position.set(ch.cx * W.CH - O.x, ch.cy * W.CH - O.y, ch.cz * W.CH - O.z);
    for (const m of fines.values()) if (m) { const b = m.userData.base; m.position.set(b[0] - O.x, b[1] - O.y, b[2] - O.z); }
    if (Scene.props) Scene.props.position.set(anchor.x - O.x, anchor.y - O.y, anchor.z - O.z);
    Scene.updateFar(p, true); Deco.update(p, true);
  };
  Scene.setOrigin = function (p) { O.set(Math.round(p.x), Math.round(p.y), Math.round(p.z)); uOff.value.copy(O).sub(anchor); };
  Scene.renderer = () => renderer;
  // compile every shader up front (in parallel where the browser can), so the first frames don't stall
  Scene.compile = function () {
    if (!renderer.compileAsync) return Promise.resolve();
    return Promise.all([renderer.compileAsync(scene, camera), renderer.compileAsync(handScene, handCam)]);
  };

  root.Scene = Scene;
})(window);
