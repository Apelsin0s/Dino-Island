// Pixel art, drawn with rectangles on a 320×180 canvas that the page scales up with nearest-neighbour.
'use strict';
(function (root) {
  const W = 320, H = 180, GROUND = 132;
  let g = null;
  const r = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
  function disc(cx, cy, rad, c) {
    g.fillStyle = c;
    for (let dy = -rad; dy <= rad; dy++) { const w = Math.floor(Math.sqrt(rad * rad - dy * dy + rad * 0.6)); g.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2 + 1, 1); }
  }
  function tri(x, base, w, h, c) { // isosceles, apex up
    g.fillStyle = c;
    for (let i = 0; i < h; i++) { const ww = Math.round(w * (i + 1) / h); g.fillRect(Math.round(x + (w - ww) / 2), base - h + i, ww, 1); }
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  function mix(c1, c2, t) {
    const a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16);
    const ch = s => Math.round(lerp((a >> s) & 255, (b >> s) & 255, t));
    return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
  }

  // ---------- tiny 3×5 font for counters ----------
  const GLYPH = {
    '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001',
    '5': '111100111001111', '6': '111100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001111',
    'x': '000101010101000', 'K': '101110100110101', 'M': '101111111101101', '+': '000010111010000'
  };
  function text3(str, x, y, c, shadow) {
    str = String(str);
    for (let i = 0; i < str.length; i++) {
      const gl = GLYPH[str[i]]; if (!gl) continue;
      for (let p = 0; p < 15; p++) if (gl[p] === '1') {
        if (shadow) r(x + i * 4 + (p % 3) + 1, y + Math.floor(p / 3) + 1, 1, 1, shadow);
        r(x + i * 4 + (p % 3), y + Math.floor(p / 3), 1, 1, c);
      }
    }
  }
  const shortNum = n => n >= 1e6 ? Math.floor(n / 1e6) + 'M' : n >= 1e3 ? Math.floor(n / 1e3) + 'K' : String(n);

  // ---------- sky & landscape ----------
  function hash(n) { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); }
  const STARS = Array.from({ length: 60 }, (_, i) => [Math.floor(hash(i) * W), Math.floor(hash(i + 99) * 100), hash(i + 7)]);
  function sky(day, t) {
    const top = mix('#0b1633', '#5fb7f0', day), bot = mix('#2a2f5e', '#c4ecff', day);
    const sunset = Math.max(0, 1 - Math.abs(day - 0.45) * 4);
    for (let i = 0; i < 12; i++) {
      let c = mix(top, bot, i / 11);
      if (i > 6) c = mix(c, '#ff9a5a', sunset * (i - 6) / 6 * 0.7);
      r(0, i * 11, W, 11, c);
    }
    if (day < 0.5) {
      const a = (0.5 - day) * 2;
      STARS.forEach(([x, y, k]) => { if (Math.sin(t * 2 + k * 30) > -0.6) { g.globalAlpha = a * (0.4 + k * 0.6); r(x, y, 1, 1, '#ffffff'); } });
      g.globalAlpha = 1;
    }
  }
  function sunMoon(phase, day) {
    const a = phase * Math.PI * 2;
    const sx = 160 - Math.cos(a) * 140, sy = 112 - Math.sin(a) * 92;
    if (sy < 110) { disc(sx, sy, 8, '#fff2a8'); disc(sx, sy, 6, '#ffd84a'); }
    const mx = 160 + Math.cos(a) * 140, my = 112 + Math.sin(a) * 92;
    if (my < 110) { disc(mx, my, 6, '#e8ecff'); disc(mx + 3, my - 2, 5, mix('#0b1633', '#5fb7f0', day)); }
  }
  function clouds(t, day) {
    const c = mix('#4a5a8a', '#ffffff', day);
    for (let i = 0; i < 4; i++) {
      const x = ((i * 97 + t * (3 + i)) % (W + 60)) - 40, y = 14 + i * 13;
      r(x, y, 26, 5, c); r(x + 5, y - 3, 14, 3, c); r(x + 18, y - 2, 8, 2, c);
    }
  }
  const FAR = Array.from({ length: W }, (_, x) => 92 + Math.sin(x / 23) * 9 + Math.sin(x / 9 + 1) * 4 + Math.sin(x / 51) * 12);
  const MID = Array.from({ length: W }, (_, x) => 116 + Math.sin(x / 17 + 2) * 5 + Math.sin(x / 37) * 6);
  function landscape(day, t) {
    const far = mix('#1f2850', '#7f93c4', day), farTop = mix('#2b3566', '#a9b9e0', day);
    for (let x = 0; x < W; x++) { r(x, FAR[x], 1, GROUND - FAR[x], far); if (FAR[x] < 86) r(x, FAR[x], 1, 2, farTop); }
    // volcano far right-centre
    tri(186, 104, 46, 34, mix('#2a1e2a', '#7a5a62', day)); r(205, 70, 8, 2, '#ff6a2a');
    for (let i = 0; i < 3; i++) { const p = (t * 0.15 + i / 3) % 1; g.globalAlpha = 0.5 * (1 - p); disc(209 + Math.sin(t + i) * 3, 66 - p * 30, 2 + p * 4, mix('#3a3a4a', '#d8d8e0', day)); }
    g.globalAlpha = 1;
    const mid = mix('#183a2a', '#4f8f4c', day);
    for (let x = 0; x < W; x++) r(x, MID[x], 1, GROUND - MID[x], mid);
  }
  function ground(day) {
    r(0, GROUND, W, 3, mix('#2f5a2a', '#6cc04a', day));
    r(0, GROUND + 3, W, 2, mix('#244a22', '#4f9a3a', day));
    r(0, GROUND + 5, W, H - GROUND - 5, mix('#3a2a1e', '#8a6440', day));
    r(0, 141, W, 13, mix('#463424', '#a37a50', day)); // path
    const peb = mix('#2a2018', '#6d4e32', day);
    for (let i = 0; i < 50; i++) r(Math.floor(hash(i + 300) * W), 140 + Math.floor(hash(i + 400) * 38), 2, 1, peb);
    // river near the water wheel
    r(262, GROUND + 3, 58, 4, mix('#1a3d66', '#3aa0e0', day)); r(270, GROUND + 4, 6, 1, '#bfe9ff');
  }

  // ---------- clickable nodes ----------
  function tree(x, base, shake, day) {
    const d = shake ? Math.sin(shake * 40) : 0;
    r(x + 7, base - 12, 4, 12, '#6b4426'); r(x + 7, base - 12, 1, 12, '#8a5a32');
    const dk = mix('#1b4a22', '#2f8a3a', day), lt = mix('#245a2a', '#4fb04a', day);
    disc(x + 9 + d, base - 20, 8, dk); disc(x + 4 + d, base - 15, 5, dk); disc(x + 14 + d, base - 15, 5, dk);
    disc(x + 7 + d, base - 22, 4, lt); disc(x + 12 + d, base - 18, 2, lt);
  }
  function rocks(x, base, shake) {
    const d = shake ? Math.round(Math.sin(shake * 50)) : 0;
    disc(x + 7 + d, base - 5, 6, '#6d7278'); disc(x + 15 + d, base - 4, 5, '#83898f'); disc(x + 6 + d, base - 7, 3, '#a7adb3');
    r(x + 2 + d, base - 1, 20, 1, '#4d5258');
  }
  function bush(x, base, shake, day) {
    const d = shake ? Math.round(Math.sin(shake * 50)) : 0;
    disc(x + 9 + d, base - 6, 7, mix('#1d4d24', '#3a9a3e', day)); disc(x + 6 + d, base - 8, 3, mix('#2a6a30', '#58c058', day));
    [[5, -8], [10, -10], [13, -5], [7, -4], [11, -7]].forEach(([a, b]) => r(x + a + d, base + b, 2, 2, '#e0304a'));
  }

  // ---------- people & animals ----------
  function caveman(x, base, frame, skin, fur) {
    const leg = frame ? 1 : 0;
    r(x + 1, base - 10, 4, 2, '#2a1a10'); r(x + 1, base - 8, 4, 3, skin); r(x + 3, base - 7, 1, 1, '#1a1a1a');
    r(x, base - 5, 6, 3, fur); r(x + 1, base - 5, 1, 3, '#00000033');
    r(x + 1 + leg, base - 2, 1, 2, skin); r(x + 4 - leg, base - 2, 1, 2, skin);
  }
  function traveler(x, base, t) {
    r(x + 1, base - 13, 5, 2, '#5a3a22'); r(x + 1, base - 11, 5, 4, '#f0c8a0'); r(x + 1, base - 12, 5, 1, '#ffd84a'); r(x + 2, base - 12, 1, 1, '#4ac0ff'); r(x + 4, base - 12, 1, 1, '#4ac0ff');
    r(x, base - 7, 7, 5, '#2a8a9a'); r(x + 3, base - 7, 1, 5, '#e0e0e0');
    const wave = Math.sin(t * 3) > 0.7 ? -2 : 0; r(x + 7, base - 7 + wave, 1, 3, '#f0c8a0');
    r(x + 1, base - 2, 2, 2, '#1f5a66'); r(x + 4, base - 2, 2, 2, '#1f5a66');
  }
  function mammoth(x, base, frame, day) {
    const b = mix('#3a2414', '#7a4a2a', day), dk = mix('#2a180c', '#5a3418', day);
    r(x + 4, base - 12, 16, 8, b); r(x + 6, base - 14, 12, 2, b); r(x, base - 13, 7, 7, b); r(x + 2, base - 15, 4, 2, dk);
    r(x - 1, base - 7, 2, 6, dk); r(x + 1, base - 7, 3, 1, '#f4ecd8'); r(x + 3, base - 6, 1, 2, '#f4ecd8');
    r(x + 2, base - 11, 1, 1, '#000');
    const f = frame ? 1 : 0;
    r(x + 5 + f, base - 4, 3, 4, dk); r(x + 10 - f, base - 4, 3, 4, dk); r(x + 14 + f, base - 4, 3, 4, dk); r(x + 17 - f, base - 4, 2, 4, dk);
    r(x + 20, base - 11, 1, 4, dk);
  }

  // ---------- buildings (x = left, base = ground line) ----------
  const BUILD = {
    forager(x, b) { r(x + 2, b - 6, 12, 6, '#a8703c'); r(x + 2, b - 6, 12, 1, '#c99050'); [[4, -8], [7, -9], [10, -8], [6, -7], [9, -7]].forEach(([a, c]) => r(x + a, b + c, 2, 2, '#e0304a')); r(x + 3, b - 3, 10, 1, '#7a4a22'); },
    woodcutter(x, b) { r(x + 1, b - 4, 12, 4, '#8a5a32'); r(x + 3, b - 8, 10, 4, '#a8703c'); [[1, -4], [3, -8]].forEach(([a, c]) => { r(x + a, b + c, 2, 4, '#e0b080'); }); r(x + 14, b - 6, 1, 6, '#6b4426'); r(x + 13, b - 7, 3, 2, '#9aa0a6'); },
    quarry(x, b) { r(x + 1, b - 5, 7, 5, '#83898f'); r(x + 8, b - 5, 7, 5, '#6d7278'); r(x + 4, b - 10, 7, 5, '#a7adb3'); r(x + 1, b - 5, 7, 1, '#b8bec4'); r(x + 4, b - 10, 7, 1, '#d0d6dc'); },
    firepit(x, b, t) { r(x + 2, b - 2, 12, 2, '#6d7278'); r(x + 3, b - 3, 2, 1, '#83898f'); r(x + 11, b - 3, 2, 1, '#83898f'); const f = Math.floor(t * 8) % 3; r(x + 5, b - 6 - f, 6, 4 + f, '#ff6a1f'); r(x + 6, b - 8 - (f % 2), 4, 3, '#ffb347'); r(x + 7, b - 9 - f, 2, 2, '#fff2a8'); },
    hunter(x, b) { tri(x + 1, b, 14, 11, '#c08a52'); r(x + 7, b - 5, 2, 5, '#4a2a14'); r(x + 15, b - 14, 1, 14, '#6b4426'); r(x + 14, b - 15, 3, 2, '#d0d6dc'); },
    hut(x, b) { disc(x + 8, b - 3, 8, '#8a5a32'); r(x, b - 1, 18, 3, '#6b8a3a'); r(x + 2, b - 9, 12, 1, '#a8703c'); r(x + 6, b - 5, 4, 5, '#2a1a10'); r(x + 3, b - 12, 2, 2, '#a8703c'); },
    farm(x, b, t) { r(x, b - 5, 20, 5, '#6b4a2a'); for (let i = 0; i < 5; i++) { const s = Math.round(Math.sin(t * 2 + i) * 0.6); r(x + 1 + i * 4 + s, b - 9, 1, 5, '#7ab04a'); r(x + 1 + i * 4 + s, b - 10, 2, 2, '#f2d14b'); } },
    copperMine(x, b) { disc(x + 8, b - 2, 8, '#6d5a4a'); r(x + 5, b - 7, 6, 7, '#1a1410'); r(x + 4, b - 8, 8, 1, '#8a5a32'); r(x + 4, b - 8, 1, 8, '#8a5a32'); r(x + 11, b - 8, 1, 8, '#8a5a32'); r(x + 13, b - 3, 2, 2, '#d9814a'); r(x + 1, b - 4, 2, 2, '#d9814a'); },
    school(x, b) { r(x + 1, b - 9, 14, 9, '#c9a070'); r(x, b - 11, 16, 2, '#8a5a32'); r(x + 6, b - 5, 4, 5, '#4a2a14'); r(x + 2, b - 8, 3, 3, '#e6d2a8'); r(x + 3, b - 7, 1, 1, '#4a2a14'); },
    ironMine(x, b) { disc(x + 8, b - 2, 8, '#4d5258'); r(x + 5, b - 7, 6, 7, '#0e0e12'); r(x + 4, b - 8, 8, 1, '#7f8ea3'); r(x + 14, b - 3, 5, 3, '#7f8ea3'); r(x + 15, b - 1, 1, 1, '#222'); r(x + 18, b - 1, 1, 1, '#222'); },
    workshop(x, b, t) { r(x + 1, b - 9, 15, 9, '#8a5a32'); tri(x, b - 9, 17, 5, '#6b4426'); r(x + 6, b - 5, 4, 5, '#2a1a10'); gear(x + 13, b - 13, 3, t, '#c9b37a'); },
    waterwheel(x, b, t) { r(x + 7, b - 14, 2, 14, '#6b4426'); gear(x + 8, b - 9, 7, t * 0.8, '#a8703c'); r(x + 2, b - 1, 14, 2, '#3aa0e0'); },
    observatory(x, b, t) { r(x + 3, b - 14, 10, 14, '#9aa0a6'); disc(x + 8, b - 14, 5, '#b8bec4'); r(x + 3, b - 14, 10, 1, '#d0d6dc'); r(x + 10, b - 21, 2, 6, '#c9b37a'); r(x + 6, b - 5, 4, 5, '#2a2f3a'); },
    crater(x, b, t) { r(x, b - 3, 18, 3, '#3a2a40'); disc(x + 9, b - 2, 5, '#5a3a70'); const p = 0.5 + 0.5 * Math.sin(t * 3); r(x + 7, b - 6, 2, 3, p > 0.5 ? '#e0a8ff' : '#c77dff'); r(x + 10, b - 5, 2, 2, '#c77dff'); r(x + 5, b - 4, 1, 1, '#f0d0ff'); }
  };
  function gear(cx, cy, rad, t, c) {
    disc(cx, cy, rad, c); disc(cx, cy, Math.max(1, rad - 2), '#00000055'); disc(cx, cy, 1, c);
    for (let k = 0; k < 6; k++) { const a = t * 2 + k * Math.PI / 3; r(cx + Math.cos(a) * (rad + 1) - 1, cy + Math.sin(a) * (rad + 1) - 1, 2, 2, c); }
  }
  // building slots: back row on grass, front row along the path
  const SLOTS = {
    hut: [104, GROUND + 2], firepit: [124, GROUND + 2], school: [142, GROUND + 2], workshop: [160, GROUND + 2],
    observatory: [179, GROUND + 2], copperMine: [196, GROUND + 2], ironMine: [215, GROUND + 2],
    forager: [104, 172], woodcutter: [122, 172], quarry: [140, 172], hunter: [158, 172], farm: [176, 172],
    crater: [200, 173], waterwheel: [264, GROUND + 6]
  };

  // ---------- time machine ----------
  function machine(x, base, parts, t, shake) {
    const d = shake ? Math.round(Math.sin(shake * 50)) : 0; x += d;
    // legs
    if (parts.frame) { r(x + 3, base - 6, 2, 6, '#7f8ea3'); r(x + 19, base - 6, 2, 6, '#7f8ea3'); r(x + 11, base - 4, 2, 4, '#7f8ea3'); }
    else { r(x + 1, base - 7, 2, 7, '#6b4426'); r(x + 21, base - 5, 2, 5, '#6b4426'); }
    // shell
    const shell = parts.hull ? '#d0d6dc' : '#8a9096';
    disc(x + 12, base - 18, 11, shell); disc(x + 12, base - 25, 8, shell); r(x + 4, base - 22, 1, 10, '#ffffff55');
    if (!parts.hull) { r(x + 6, base - 18, 4, 3, '#2a2f3a'); r(x + 16, base - 12, 3, 3, '#2a2f3a'); r(x + 15, base - 28, 3, 2, '#2a2f3a'); }
    // ring
    r(x - 1, base - 17, 26, 2, parts.gearbox ? '#c9b37a' : '#6d7278');
    // porthole + core
    disc(x + 12, base - 24, 4, '#2a2f3a');
    if (parts.core) { const p = 0.5 + 0.5 * Math.sin(t * 4); disc(x + 12, base - 24, 3, p > 0.5 ? '#e0a8ff' : '#c77dff'); }
    else disc(x + 12, base - 24, 2, '#3a4250');
    if (parts.wiring) { r(x + 5, base - 14, 1, 6, '#d9814a'); r(x + 5, base - 9, 6, 1, '#d9814a'); r(x + 19, base - 15, 1, 5, '#d9814a'); }
    if (parts.gearbox) gear(x + 22, base - 12, 3, t, '#c9b37a');
    if (parts.battery) { r(x + 9, base - 9, 6, 4, '#1a3d66'); r(x + 10, base - 8, Math.floor(1 + (Math.sin(t * 2) * 0.5 + 0.5) * 4), 2, '#6fd3ff'); }
    // antenna + status light
    r(x + 12, base - 37, 1, 5, '#7f8ea3');
    const n = Object.keys(parts).length;
    r(x + 11, base - 38, 3, 2, (Math.floor(t * (1 + n)) % 2) ? (n >= 6 ? '#6fff8a' : '#ff4a4a') : '#40222a');
    // sparks when broken
    if (!parts.hull && Math.floor(t * 5) % 7 === 0) { r(x + 7, base - 20, 1, 1, '#fff2a8'); r(x + 9, base - 22, 1, 1, '#ffd84a'); }
  }

  // ---------- night overlay & lights ----------
  function night(day, lights) {
    const a = (1 - day) * 0.5; if (a < 0.02) return;
    g.fillStyle = `rgba(10,16,48,${a})`; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    lights.forEach(([x, y, rad, c]) => { g.globalAlpha = a * 0.9; disc(x, y, rad, c); g.globalAlpha = a * 0.5; disc(x, y, Math.round(rad * 1.8), c); });
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }

  // ---------- public draw ----------
  // hit areas (canvas pixels) → resource id
  const HITS = [
    { id: 'wood',  x: 0,   y: 96,  w: 56, h: 40 },
    { id: 'stone', x: 54,  y: 120, w: 26, h: 16 },
    { id: 'food',  x: 78,  y: 118, w: 22, h: 18 },
    { id: 'ideas', x: 276, y: 96,  w: 38, h: 46 }
  ];
  const VILLAGERS = Array.from({ length: 30 }, (_, i) => ({ seed: hash(i + 50), speed: 4 + hash(i + 60) * 6, skin: ['#f0c8a0', '#c89060', '#8a5a3a'][i % 3], fur: ['#8a5a32', '#a8703c', '#6b4426', '#c08a52'][i % 4] }));

  function draw(ctx, S, t, fx) {
    g = ctx; g.imageSmoothingEnabled = false;
    const phase = (t / 240) % 1;                // full day = 4 minutes
    const day = Math.max(0, Math.min(1, 0.5 + Math.sin(phase * Math.PI * 2) * 0.9));
    sky(day, t); sunMoon(phase, day); clouds(t, day); landscape(day, t);
    // mammoth wandering on the hill line
    const mxp = W + 30 - ((t * 6) % (W + 80));
    mammoth(mxp, MID[Math.max(0, Math.min(W - 1, Math.floor(mxp)))] + 4, Math.floor(t * 3) % 2, day);
    ground(day);
    // forest + nodes
    tree(-4, GROUND + 2, fx.wood, day); tree(14, GROUND + 3, fx.wood, day); tree(32, GROUND + 2, fx.wood, day);
    rocks(56, GROUND + 3, fx.stone); bush(80, GROUND + 3, fx.food, day);
    const lights = [];
    // buildings
    for (const id in SLOTS) {
      const n = S.b[id] || 0, [x, b] = SLOTS[id];
      if (n > 0) {
        BUILD[id](x, b, t);
        const lbl = 'x' + shortNum(n);
        text3(lbl, x + 1, b + 2, '#fff8e0', '#00000099');
        if (id === 'firepit') lights.push([x + 8, b - 5, 6, '#ff8a2a']);
        if (id === 'hut') lights.push([x + 8, b - 3, 4, '#ffb347']);
        if (id === 'crater') lights.push([x + 9, b - 4, 5, '#c77dff']);
      }
    }
    // villagers on the path
    const pop = Math.min(VILLAGERS.length, Math.ceil(S.built / 3));
    for (let i = 0; i < pop; i++) {
      const v = VILLAGERS[i], span = 150, p = (v.seed * span + t * v.speed) % (span * 2);
      const x = 100 + (p < span ? p : span * 2 - p);
      caveman(x, 149 + (i % 3) * 2, Math.floor(t * 4 + i) % 2, v.skin, v.fur);
    }
    // machine + traveller
    machine(282, GROUND + 6, S.parts, t, fx.ideas); traveler(266, GROUND + 4, t);
    if (S.parts.core) lights.push([294, GROUND - 18, 6, '#c77dff']);
    if (S.parts.battery) lights.push([294, GROUND - 1, 4, '#6fd3ff']);
    night(day, lights);
    return day;
  }

  // ---------- 8×8 resource icons ----------
  const ICONS = {
    food: ['........', '...oo...', '..oOOo..', '..oOOo..', '...oo...', '...ww...', '..w..w..', '........'],
    wood: ['........', '........', '.bbbbbb.', 'bBBBBBBy', 'bBBBBBBy', '.bbbbbb.', '........', '........'],
    stone: ['........', '...gg...', '..gGGg..', '.gGGGgg.', '.ggGggg.', '..dddd..', '........', '........'],
    ideas: ['...yy...', '..yYYy..', '.yYYYYy.', '.yYYYYy.', '..yYYy..', '...gg...', '...dd...', '........'],
    copper: ['........', '........', '..cccc..', '.cCCCCc.', 'cCCCCCCc', 'cccccccc', '........', '........'],
    iron: ['........', '........', '..iiii..', '.iIIIIi.', 'iIIIIIIi', 'iiiiiiii', '........', '........'],
    gears: ['...gg...', '.g.gg.g.', '..gGGg..', 'ggG..Ggg', 'ggG..Ggg', '..gGGg..', '.g.gg.g.', '...gg...'],
    power: ['....pp..', '...pp...', '..pp....', '.pppppp.', '....pp..', '...pp...', '..pp....', '........'],
    chronium: ['...vv...', '..vVVv..', '.vVVVVv.', 'vVVVVVVv', '.vVVVVv.', '..vVVv..', '...vv...', '........']
  };
  const IPAL = { o: '#b0502a', O: '#e0703a', w: '#f4ecd8', b: '#6b4426', B: '#a8703c', y: '#f2d14b', Y: '#fff2a8', g: '#83898f', G: '#c9b37a', d: '#4d5258',
    c: '#a85a2a', C: '#e8955a', i: '#4d5a6a', I: '#a8b4c4', p: '#6fd3ff', v: '#8a3ad0', V: '#d8a0ff' };
  IPAL.G = '#b8bec4';
  const iconCache = {};
  function icon(id) {
    if (iconCache[id]) return iconCache[id];
    const c = document.createElement('canvas'); c.width = 8; c.height = 8; const x = c.getContext('2d');
    const pal = Object.assign({}, IPAL); if (id === 'gears') pal.g = '#c9b37a', pal.G = '#e6d29a';
    ICONS[id].forEach((row, yy) => [...row].forEach((ch, xx) => { if (ch !== '.') { x.fillStyle = pal[ch]; x.fillRect(xx, yy, 1, 1); } }));
    return (iconCache[id] = c.toDataURL());
  }

  root.Art = { W, H, draw, HITS, icon };
})(window);
