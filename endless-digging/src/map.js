// World map: a 3D Earth that pops out of the screen centre (M key). Real satellite colours, sea depth, relief,
// borders; a sharper patch over Ukraine. Only the open regions are in colour, everything else is dimmed and locked.
// Drag to turn the globe, wheel / pinch to zoom. Uses the game's renderer while the game itself is paused.
'use strict';
(function (root) {
  const T = root.THREE, D = root.MapData;
  const MapView = { open: false };
  let renderer, scene, camera, globe, atmo, bgScene, bgCam, bgMat, frameTex = null, ui, pin, mat;
  let state = 'closed', anim = 0, zoomAnim = 0, t = 0;
  const view = { lat: 48, lon: 33, dist: 3.2 }, target = { lat: 48, lon: 33, dist: 1.35 }, player = { lat: 48, lon: 33 };
  const MIN_D = 1.06, MAX_D = 4.5;
  const dir = (lat, lon) => { const a = lat * Math.PI / 180, b = lon * Math.PI / 180; return new T.Vector3(Math.cos(a) * Math.cos(b), Math.sin(a), -Math.cos(a) * Math.sin(b)); };
  const ease = x => x < 0 ? 0 : x > 1 ? 1 : 1 - Math.pow(1 - x, 3);
  const back = x => { x = Math.min(1, Math.max(0, x)); const c = 1.4; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };

  // mask canvas for a lon/lat box: red = open region, green = its outline
  function maskCanvas(box, w, h, line) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d');
    c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
    const P = (p) => [(p[0] - box[0]) / (box[1] - box[0]) * w, (box[3] - p[1]) / (box[3] - box[2]) * h];
    const path = () => { c.beginPath(); for (const name in D.open) for (const ring of D.open[name]) { ring.forEach((p, i) => { const q = P(p); i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.closePath(); } };
    path(); c.fillStyle = '#f00'; c.fill('evenodd');
    path(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = '#0f0'; c.lineWidth = line; c.lineJoin = 'round'; c.stroke();
    const tex = new T.CanvasTexture(cv); tex.colorSpace = T.NoColorSpace; return tex;
  }
  // textures keep their stored (display) values: the shader writes straight to the screen
  function loadTex(src) { const tx = new T.TextureLoader().load(src); tx.colorSpace = T.NoColorSpace; tx.anisotropy = 4; return tx; }

  MapView.init = function (r, uiRoot, labels) {
    renderer = r; ui = uiRoot; MapView.L = labels;
    scene = new T.Scene(); camera = new T.PerspectiveCamera(40, 1, 0.005, 50);
    const box = D.detail.box;
    mat = new T.ShaderMaterial({
      uniforms: {
        tEarth: { value: loadTex('map/earth.jpg') }, tDetail: { value: loadTex(D.detail.img) },
        tMask: { value: maskCanvas([-180, 180, -90, 90], 2048, 1024, 1.5) }, tMaskD: { value: maskCanvas(box, 2048, 1024, 3.5) },
        uBox: { value: new T.Vector4(box[0], box[1], box[2], box[3]) }, uLight: { value: new T.Vector3(0, 0, 1) }, uTime: { value: 0 }
      },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }',
      fragmentShader: `uniform sampler2D tEarth; uniform sampler2D tDetail; uniform sampler2D tMask; uniform sampler2D tMaskD; uniform vec4 uBox; uniform vec3 uLight; uniform float uTime; varying vec3 vP;
        const float PI = 3.14159265;
        void main(){
          vec3 d = normalize(vP); float lat = asin(clamp(d.y, -1.0, 1.0)), lon = atan(-d.z, d.x);
          vec2 uv = vec2(lon/(2.0*PI) + 0.5, lat/PI + 0.5);
          vec2 uvs = vec2(fract(uv.x + 0.5), uv.y);                        // seam-free copy for the mip level
          vec2 gx = dFdx(uvs), gy = dFdy(uvs);
          vec3 c = textureGrad(tEarth, uv, gx, gy).rgb;
          vec4 m = textureGrad(tMask, uv, gx, gy);
          float la = degrees(lat), lo = degrees(lon);
          vec2 bu = vec2((lo - uBox.x)/(uBox.y - uBox.x), (la - uBox.z)/(uBox.w - uBox.z));
          if (bu.x > 0.0 && bu.x < 1.0 && bu.y > 0.0 && bu.y < 1.0) {
            vec2 bx = vec2(dFdx(bu)), by = vec2(dFdy(bu));
            float edge = smoothstep(0.0, 0.03, min(min(bu.x, 1.0 - bu.x), min(bu.y, 1.0 - bu.y)));
            c = mix(c, textureGrad(tDetail, bu, bx, by).rgb, edge);
            m = mix(m, textureGrad(tMaskD, bu, bx, by), edge);
          }
          // locked land and sea: grey, dark, with faint diagonal hatching
          float g = dot(c, vec3(0.299, 0.587, 0.114));
          vec3 locked = mix(vec3(g), c, 0.22)*0.42;
          float hatch = step(0.5, fract((gl_FragCoord.x + gl_FragCoord.y)/14.0));
          locked *= 0.93 + 0.07*hatch;
          c = mix(locked, c*1.08, m.r);
          // glowing outline of the open region
          float pulse = 0.75 + 0.25*sin(uTime*2.4);
          c = mix(c, vec3(1.0, 0.62, 0.18), clamp(m.g*1.4, 0.0, 1.0)*pulse);
          float l = 0.42 + 0.7*max(dot(d, uLight), 0.0);
          gl_FragColor = vec4(c*l, 1.0);
        }`
    });
    globe = new T.Mesh(new T.SphereGeometry(1, 160, 80), mat); scene.add(globe);
    atmo = new T.Mesh(new T.SphereGeometry(1.03, 64, 32), new T.ShaderMaterial({
      uniforms: { uCam: { value: new T.Vector3() } }, transparent: true, depthWrite: false, side: T.BackSide, blending: T.AdditiveBlending,
      vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(position); vW = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 uCam; varying vec3 vN; varying vec3 vW;
        void main(){ vec3 v = normalize(uCam - vW); float f = pow(clamp(1.0 - abs(dot(vN, v)), 0.0, 1.0), 2.2);
          float rim = smoothstep(0.0, 0.5, f); gl_FragColor = vec4(vec3(0.35, 0.65, 1.0)*rim*0.9, 1.0); }`
    }));
    scene.add(atmo);
    // background: the last game frame, darkened
    bgScene = new T.Scene(); bgCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    bgMat = new T.ShaderMaterial({ uniforms: { tFrame: { value: null }, uDim: { value: 0 } }, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D tFrame; uniform float uDim; varying vec2 vUv;
        void main(){ vec3 c = texture2D(tFrame, vUv).rgb; vec2 q = vUv - 0.5; float v = 1.0 - 0.6*dot(q, q)*uDim*2.0;
          gl_FragColor = vec4(mix(c, vec3(0.02, 0.04, 0.08), uDim)*v, 1.0); }` });
    bgScene.add(new T.Mesh(new T.PlaneGeometry(2, 2), bgMat));
    pin = document.createElement('div'); pin.className = 'mapPin'; pin.innerHTML = '<i></i><span></span>'; ui.appendChild(pin);
    bindInput();
  };

  // ---------- input: drag to turn, wheel / pinch to zoom ----------
  const ptrs = new Map(); let pinch0 = 0, dist0 = 0;
  function bindInput() {
    const el = ui;
    el.addEventListener('pointerdown', e => { if (!MapView.open) return; ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); try { el.setPointerCapture(e.pointerId); } catch (er) {} if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); dist0 = target.dist; } zoomAnim = 1; });
    el.addEventListener('pointermove', e => {
      const p = ptrs.get(e.pointerId); if (!p || !MapView.open) return;
      if (ptrs.size === 1) {
        const k = (target.dist - 1) * 0.0042 * 57.3 / Math.max(1, innerHeight / 700);
        target.lon -= (e.clientX - p.x) * k / Math.max(0.2, Math.cos(target.lat * Math.PI / 180)); target.lat = Math.max(-80, Math.min(80, target.lat + (e.clientY - p.y) * k));
        view.lat = target.lat; view.lon = target.lon;
      }
      p.x = e.clientX; p.y = e.clientY;
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch0 > 0) target.dist = clampD(1 + (dist0 - 1) * pinch0 / d); }
    });
    const up = e => { ptrs.delete(e.pointerId); pinch0 = 0; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', e => { if (!MapView.open) return; e.preventDefault(); zoomAnim = 1; target.dist = clampD(1 + (target.dist - 1) * Math.exp(e.deltaY * 0.0016)); }, { passive: false });
  }
  const clampD = d => Math.max(MIN_D, Math.min(MAX_D, d));

  // ---------- open / close ----------
  MapView.toggle = function (lat, lon) { if (state === 'open' || state === 'opening') MapView.close(); else MapView.show(lat, lon); };
  MapView.show = function (lat, lon) {
    player.lat = lat; player.lon = lon;
    // keep the current game frame as the backdrop
    const w = renderer.domElement.width, h = renderer.domElement.height;
    if (!frameTex || frameTex.image.width !== w || frameTex.image.height !== h) { if (frameTex) frameTex.dispose(); frameTex = new T.FramebufferTexture(w, h); }
    renderer.setRenderTarget(null); renderer.copyFramebufferToTexture(frameTex); bgMat.uniforms.tFrame.value = frameTex;
    view.lat = lat - 8; view.lon = lon - 25; view.dist = 3.4; target.lat = lat; target.lon = lon; target.dist = 1.38;
    state = 'opening'; anim = 0; zoomAnim = 0; MapView.open = true; ui.hidden = false; ui.classList.add('on');
    ptrs.clear();
  };
  MapView.close = function () { if (state === 'closed') return; state = 'closing'; ui.classList.remove('on'); };

  // ---------- per frame (only while the map is shown) ----------
  MapView.render = function (dt) {
    t += dt; mat.uniforms.uTime.value = t;
    if (state === 'opening') { anim = Math.min(1, anim + dt / 0.65); if (anim >= 1) state = 'open'; }
    if (state === 'closing') { anim = Math.max(0, anim - dt / 0.35); if (anim <= 0) { state = 'closed'; MapView.open = false; ui.hidden = true; return false; } }
    // the auto zoom toward the player starts as the globe lands, then the player is free to look around
    if (zoomAnim < 1 && anim > 0.35) zoomAnim = Math.min(1, zoomAnim + dt / 1.6);
    const k = 1 - Math.exp(-dt * (zoomAnim < 1 ? 2.2 : 9));
    view.lat += (target.lat - view.lat) * k; view.lon += (target.lon - view.lon) * k; view.dist += (target.dist - view.dist) * k;
    const s = state === 'closing' ? ease(anim) : back(anim);
    globe.scale.setScalar(Math.max(0.001, s)); atmo.scale.setScalar(Math.max(0.001, s));
    const w = renderer.domElement.clientWidth || innerWidth, h = renderer.domElement.clientHeight || innerHeight;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    // on narrow screens step back so the whole globe fits
    const fit = Math.max(1, 1.25 / Math.max(0.5, camera.aspect));
    camera.position.copy(dir(view.lat, view.lon)).multiplyScalar(1 + (view.dist - 1) * fit);
    camera.up.set(0, 1, 0); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    mat.uniforms.uLight.value.copy(dir(view.lat + 18, view.lon - 30));
    atmo.material.uniforms.uCam.value.copy(camera.position);
    bgMat.uniforms.uDim.value = 0.82 * ease(anim);
    renderer.setRenderTarget(null); renderer.autoClear = true; renderer.render(bgScene, bgCam);
    renderer.autoClear = false; renderer.clearDepth(); renderer.render(scene, camera); renderer.autoClear = true;
    // the "you are here" pin
    const p = dir(player.lat, player.lon).multiplyScalar(s), facing = p.clone().normalize().dot(camera.position.clone().normalize()) > 0.15;
    const q = p.clone().project(camera);
    pin.style.display = facing && anim > 0.6 ? '' : 'none';
    pin.style.transform = `translate(${(q.x * 0.5 + 0.5) * w}px, ${(-q.y * 0.5 + 0.5) * h}px)`;
    pin.querySelector('span').textContent = MapView.L.here;
    return true;
  };
  MapView.isBusy = () => state !== 'closed';
  root.MapView = MapView;
})(window);
