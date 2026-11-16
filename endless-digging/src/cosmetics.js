// Cosmetics: how you, your tools and your machines look — 50 costumes, 50 tool skins, 50 machine skins — the gold
// currency, your profile (name, emblem, level, stats, friends, showcase, a mirror) and the store.
// Common and rare skins are earned by playing (level, achievements); epic ones by level or for gold; legendary ones
// only for gold. Gold is bought through Steam (Steam build + server); no random boxes: you see exactly what you get.
'use strict';
(function (root) {
  const C = {};
  let G = null, L = null, S = null;
  // ---------- the catalogue ----------
  // costume archetypes: hat shape, extra piece, base colours [shirt, pants, boots, hat, vest]
  const ARCH = [
    { id: 'miner', hat: 'helmet', extra: 'lamp', base: ['#3b5f8a', '#3b5f8a', '#3a2a20', '#f2b630', null] },
    { id: 'geologist', hat: 'wide', extra: 'backpack', base: ['#c9b48a', '#6b5a44', '#4a3424', '#8a6a3a', '#7d6a48'] },
    { id: 'explorer', hat: 'safari', extra: 'backpack', base: ['#d8c59a', '#8c7a5a', '#5a3a24', '#e8dcc0', null] },
    { id: 'builder', hat: 'helmet', extra: null, base: ['#4a6fa5', '#2f4a73', '#3b2a20', '#ffffff', '#ff8a1a'] },
    { id: 'farmer', hat: 'straw', extra: null, base: ['#c84a3a', '#3d5f9a', '#4a3020', '#e8c870', null] },
    { id: 'diver', hat: 'bubble', extra: 'tank', base: ['#2a3a48', '#2a3a48', '#1a1f24', '#c0c8d0', null] },
    { id: 'knight', hat: 'helm', extra: 'cape', base: ['#9aa4ae', '#7a848e', '#5a646e', '#b8c2cc', null] },
    { id: 'pirate', hat: 'tricorn', extra: null, base: ['#f0e8d8', '#3a2a24', '#1f1612', '#1f1a18', '#8a2a24'] },
    { id: 'scientist', hat: 'goggles', extra: null, base: ['#f4f6f8', '#3a4048', '#22262a', '#4a90d8', '#ffffff'] },
    { id: 'cosmonaut', hat: 'bubble', extra: 'backpack', base: ['#f2f4f6', '#f2f4f6', '#9aa4ae', '#e8f0f8', null] }
  ];
  // five colourways each: 0-1 common, 2 rare, 3 epic, 4 legendary
  const WAYS = [
    { id: 'classic', tint: null }, { id: 'forest', tint: '#3f8a4a' }, { id: 'ocean', tint: '#2a78c8' }, { id: 'midnight', tint: '#2a2440' }, { id: 'gold', tint: '#e8b420', shine: true }
  ];
  const RARITY = ['common', 'common', 'rare', 'epic', 'legendary'];
  const FINISH = [
    { id: 'copper', metal: '#c47a4a', wood: '#7a4a2a', r: 'common', unlock: { level: 3 } },
    { id: 'black', metal: '#2a2e34', wood: '#3a2a20', r: 'common', unlock: { level: 6 } },
    { id: 'ice', metal: '#bfe6ff', wood: '#e8f4ff', r: 'rare', unlock: { ach: 'deep20' } },
    { id: 'camo', metal: '#5a6a3a', wood: '#3a4a2a', r: 'rare', unlock: { ach: 'find10' } },
    { id: 'neon', metal: '#39ff9c', wood: '#1a1a2a', r: 'epic', unlock: { level: 12, gold: 200 }, glow: '#39ff9c' },
    { id: 'lava', metal: '#ff5a1a', wood: '#2a1a14', r: 'epic', unlock: { ach: 'coal', gold: 200 }, glow: '#ff5a1a' },
    { id: 'gold', metal: '#ffcc33', wood: '#5a3a1a', r: 'legendary', unlock: { gold: 400 } },
    { id: 'rose', metal: '#f2a8a0', wood: '#f8e8e4', r: 'legendary', unlock: { gold: 400 } },
    { id: 'galaxy', metal: '#5a3ac8', wood: '#120a30', r: 'legendary', unlock: { gold: 700 }, glow: '#8a6aff' },
    { id: 'diamond', metal: '#e8fbff', wood: '#bfe6ff', r: 'legendary', unlock: { gold: 900 }, glow: '#bff4ff' }
  ];
  const TOOLS = ['spoon', 'scoop', 'trowel', 'shovel', 'pick'];
  const PAINT = [
    { id: 'red', c: '#d83a2a', r: 'common', unlock: { level: 4 } }, { id: 'blue', c: '#2a68d8', r: 'common', unlock: { level: 8 } },
    { id: 'green', c: '#3aa04a', r: 'common', unlock: { level: 10 } }, { id: 'white', c: '#f2f4f6', r: 'rare', unlock: { ach: 'machine' } },
    { id: 'black', c: '#24282c', r: 'rare', unlock: { ach: 'shaft' } }, { id: 'desert', c: '#c8a46a', r: 'epic', unlock: { level: 18, gold: 300 } },
    { id: 'forest', c: '#4a6a3a', r: 'epic', unlock: { level: 22, gold: 300 } }, { id: 'pink', c: '#ff7ab8', r: 'epic', unlock: { gold: 300 } },
    { id: 'gold', c: '#ffcc33', r: 'legendary', unlock: { gold: 800 } }, { id: 'chrome', c: '#dfe6ec', r: 'legendary', unlock: { gold: 1000 } }
  ];
  const MACHINES = ['exMini', 'exBig', 'truck', 'wheel', 'bore'];
  const ITEMS = [];
  ARCH.forEach((a, ai) => WAYS.forEach((w, wi) => ITEMS.push({ kind: 'costume', id: 'c_' + a.id + '_' + w.id, arch: a, way: w, r: RARITY[wi],
    unlock: wi === 0 ? { level: 1 + ai } : wi === 1 ? { level: 5 + ai * 2 } : wi === 2 ? { ach: ['deep5', 'find1', 'walk10', 'shovel', 'order10', 'swim', 'deep50', 'money10k', 'find10', 'deep100'][ai] } : wi === 3 ? { level: 15 + ai * 2, gold: 250 } : { gold: 600 } })));
  FINISH.forEach(f => TOOLS.forEach(t => ITEMS.push({ kind: 'tool', id: 't_' + f.id + '_' + t, f, tool: t, r: f.r, unlock: f.unlock })));
  PAINT.forEach(p => MACHINES.forEach(m => ITEMS.push({ kind: 'machine', id: 'm_' + p.id + '_' + m, p, machine: m, r: p.r, unlock: p.unlock })));
  const BY = Object.fromEntries(ITEMS.map(i => [i.id, i]));
  C.ITEMS = ITEMS;
  // gold packs (prices in US cents; Steam converts)
  const PACKS = [{ id: 1, gold: 100, cents: 99 }, { id: 2, gold: 550, cents: 499 }, { id: 3, gold: 1200, cents: 999 }, { id: 4, gold: 3000, cents: 1999 }];
  const EMBLEMS = ['spoon', 'shovel', 'pick', 'excavator', 'headframe', 'globe', 'derrick', 'wheel', 'detector', 'sieve', 'bank', 'rig3'];

  // ---------- state (solo: this browser; co-op: the server keeps gold, bought skins and what you wear) ----------
  const KEY = 'endlessdigging.cosmetics';
  const fresh = () => ({ v: 1, gold: 0, bought: [], wear: { costume: 'c_miner_classic', tool: {}, machine: {} }, emblem: 'spoon', friends: [] });
  function load() { try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.v === 1) return Object.assign(fresh(), s); } catch (e) {} return fresh(); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

  // ---------- looks ----------
  const mix = (a, b, k) => { const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16), c = (s) => Math.round(((x >> s) & 255) * (1 - k) + ((y >> s) & 255) * k); return '#' + ((1 << 24) + (c(16) << 16) + (c(8) << 8) + c(0)).toString(16).slice(1); };
  // colours of a costume: { skin, shirt, pants, boots, hat, vest, hatType, extra, shine }
  C.look = function (id) {
    const it = BY[id] || BY.c_miner_classic, a = it.arch, w = it.way, t = w.tint, b = a.base;
    const tint = (c, k) => c && t ? mix(c, t, k) : c;
    return { skin: '#e0b08c', shirt: tint(b[0], 0.65), pants: tint(b[1], 0.35), boots: b[2], hat: w.shine ? '#ffcc33' : tint(b[3], 0.5), vest: b[4] ? tint(b[4], 0.5) : null, hatType: a.hat, extra: a.extra, shine: !!w.shine };
  };
  C.finish = id => { const it = BY[id]; return it && it.f; };
  C.paint = id => { const it = BY[id]; return it && it.p; };
  C.wear = () => S.wear;

  // ---------- owning ----------
  const ach = id => G.progress().ach[id];
  function earned(it) { const u = it.unlock; if (u.gold && !u.level && !u.ach) return false; if (u.level && G.level() >= u.level) return true; if (u.ach && ach(u.ach)) return true; return false; }
  C.owns = id => { const it = BY[id]; return !!it && (S.bought.includes(id) || earned(it)); };
  C.equip = function (id) {
    const it = BY[id]; if (!it || !C.owns(id)) return;
    if (it.kind === 'costume') S.wear.costume = id; else if (it.kind === 'tool') S.wear.tool[it.tool] = S.wear.tool[it.tool] === id ? null : id; else S.wear.machine[it.machine] = S.wear.machine[it.machine] === id ? null : id;
    save(); apply(); if (G.online()) G.send({ t: 'wear', wear: S.wear }); render();
  };
  C.buy = function (id) {
    const it = BY[id]; if (!it || C.owns(id) || !it.unlock.gold) return;
    if (G.online()) { G.send({ t: 'buySkin', id }); return; }   // the server checks and keeps it
    if (S.gold < it.unlock.gold) return;
    S.gold -= it.unlock.gold; S.bought.push(id); save(); G.sound('coin'); C.equip(id);
  };
  C.addGold = n => { S.gold += n; save(); render(); };   // admin / server
  C.serverState = function (st) { if (!st) return; if (typeof st.gold === 'number') S.gold = st.gold; if (st.skins) S.bought = st.skins.slice(); if (st.wear) S.wear = Object.assign(fresh().wear, st.wear); apply(); render(); };
  function apply() {
    const lk = C.look(S.wear.costume); G.S.setLook(lk);
    G.S.setToolSkins(TOOLS.reduce((o, t) => { o[t] = S.wear.tool[t] ? C.finish(S.wear.tool[t]) : null; return o; }, {}));
    for (const m of MACHINES) G.S.setMachineSkin(m, S.wear.machine[m] ? C.paint(S.wear.machine[m]).c : null);
  }
  C.apply = apply;
  // what to send to other players (ids only)
  C.publicLook = () => ({ costume: S.wear.costume, emblem: S.emblem, level: G.level() });

  // ---------- names ----------
  const q = (a, b) => (L.fmt || '{0} “{1}”').replace('{0}', a).replace('{1}', b);
  C.name = function (id) {
    const it = BY[id]; if (!it) return id;
    if (it.kind === 'costume') return q(L.arch[it.arch.id], L.way[it.way.id]);
    if (it.kind === 'tool') return q(G.L.node[it.tool][0], L.finish[it.f.id]);
    return q(G.L.node[it.machine][0], L.paint[it.p.id]);
  };

  // ---------- mirror: you, turning slowly, in your own little window ----------
  let mir = null;
  function buildAvatar(lk) {
    const T = root.THREE, g = new T.Group(), m = c => new T.MeshStandardMaterial({ color: c, roughness: 0.75, metalness: lk.shine && c === lk.hat ? 0.6 : 0 });
    const add = (geo, mat, x, y, z) => { const o = new T.Mesh(geo, mat); o.position.set(x, y, z); g.add(o); return o; };
    const skin = m(lk.skin), shirt = m(lk.shirt), pants = m(lk.pants), boots = m(lk.boots), hat = m(lk.hat);
    for (const s of [-1, 1]) { add(new T.CapsuleGeometry(0.075, 0.62, 4, 10), pants, s * 0.1, 0.46, 0); add(new T.BoxGeometry(0.13, 0.08, 0.26), boots, s * 0.1, 0.04, 0.04); add(new T.CapsuleGeometry(0.06, 0.5, 4, 8), shirt, s * 0.27, 1.12, 0); add(new T.SphereGeometry(0.065, 10, 8), skin, s * 0.27, 0.8, 0); }
    add(new T.CapsuleGeometry(0.2, 0.42, 4, 12), shirt, 0, 1.12, 0).scale.set(1, 1, 0.7);
    if (lk.vest) add(new T.CapsuleGeometry(0.21, 0.3, 4, 12), m(lk.vest), 0, 1.16, 0).scale.set(1, 1, 0.74);
    add(new T.SphereGeometry(0.13, 16, 12), skin, 0, 1.55, 0);
    hatMesh(lk.hatType, hat, g, 1.55);
    if (lk.extra === 'backpack' || lk.extra === 'tank') add(lk.extra === 'tank' ? new T.CylinderGeometry(0.09, 0.09, 0.5, 14) : new T.BoxGeometry(0.3, 0.38, 0.16), m(lk.extra === 'tank' ? '#d8dde2' : '#7a5a3a'), 0, 1.15, -0.2);
    if (lk.extra === 'cape') { const cp = add(new T.PlaneGeometry(0.5, 0.9), m(lk.hat), 0, 1.0, -0.17); cp.material.side = T.DoubleSide; cp.rotation.x = 0.12; }
    if (lk.extra === 'lamp') add(new T.CylinderGeometry(0.035, 0.035, 0.04, 12), m('#fff6c8'), 0, 1.66, 0.14).rotation.x = Math.PI / 2;
    return g;
  }
  function hatMesh(type, mat, g, y) {
    const T = root.THREE, add = (geo, yy, z) => { const o = new T.Mesh(geo, mat); o.position.set(0, yy, z || 0); g.add(o); return o; };
    if (type === 'helmet') { add(new T.SphereGeometry(0.15, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), y + 0.05); add(new T.CylinderGeometry(0.19, 0.19, 0.015, 20), y + 0.05, 0.03); }
    else if (type === 'wide' || type === 'straw') { add(new T.CylinderGeometry(0.1, 0.13, 0.12, 16), y + 0.14); add(new T.CylinderGeometry(type === 'straw' ? 0.3 : 0.24, type === 'straw' ? 0.3 : 0.24, 0.015, 24), y + 0.08); }
    else if (type === 'safari') { add(new T.SphereGeometry(0.15, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), y + 0.05); add(new T.CylinderGeometry(0.22, 0.22, 0.012, 22), y + 0.06); }
    else if (type === 'bubble') { const o = add(new T.SphereGeometry(0.21, 20, 14), y); o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.45; }
    else if (type === 'helm') { add(new T.CylinderGeometry(0.16, 0.15, 0.24, 16), y + 0.04); }
    else if (type === 'tricorn') { add(new T.ConeGeometry(0.25, 0.14, 3), y + 0.12).rotation.y = Math.PI / 6; }
    else if (type === 'goggles') { const o = add(new T.TorusGeometry(0.135, 0.02, 8, 24), y + 0.03); o.rotation.x = Math.PI / 2; }
  }
  C.buildAvatar = buildAvatar; C.hatMesh = hatMesh;
  function mirrorOn(canvas) {
    const T = root.THREE; mirrorOff();
    const r = new T.WebGLRenderer({ canvas, antialias: true, alpha: true }); r.setPixelRatio(Math.min(2, root.devicePixelRatio || 1)); r.setSize(canvas.clientWidth || 220, canvas.clientHeight || 300, false);
    r.outputColorSpace = T.SRGBColorSpace; r.toneMapping = T.NeutralToneMapping;
    const sc = new T.Scene(), cam = new T.PerspectiveCamera(32, (canvas.clientWidth || 220) / (canvas.clientHeight || 300), 0.1, 20); cam.position.set(0, 1.05, 4.2); cam.lookAt(0, 0.95, 0);
    sc.add(new T.HemisphereLight('#ffffff', '#8a7a6a', 1.6)); const d = new T.DirectionalLight('#fff4e0', 2.2); d.position.set(2, 3, 3); sc.add(d);
    const av = buildAvatar(C.look(S.wear.costume)); sc.add(av);
    const fl = new T.Mesh(new T.CircleGeometry(0.7, 32), new T.MeshStandardMaterial({ color: '#cfd8df' })); fl.rotation.x = -Math.PI / 2; sc.add(fl);
    let t0 = performance.now(), run = true;
    const tick = () => { if (!run) return; av.rotation.y = (performance.now() - t0) / 1600; r.render(sc, cam); requestAnimationFrame(tick); };
    tick(); mir = { r, stop: () => { run = false; sc.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); r.dispose(); } };
  }
  function mirrorOff() { if (mir) { mir.stop(); mir = null; } }

  // ---------- pages in the book ----------
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let storeKind = 'costume';
  const swatch = it => it.kind === 'costume' ? (() => { const lk = C.look(it.id); return `<i class="sw" style="background:linear-gradient(180deg, ${lk.hat} 0 22%, ${lk.skin} 22% 34%, ${lk.vest || lk.shirt} 34% 62%, ${lk.pants} 62% 90%, ${lk.boots} 90%)"></i>`; })()
    : it.kind === 'tool' ? `<i class="sw" style="background:linear-gradient(135deg, ${it.f.metal} 0 55%, ${it.f.wood} 55%)${it.f.glow ? ';box-shadow:0 0 12px ' + it.f.glow : ''}"></i>` : `<i class="sw" style="background:${it.p.c}"></i>`;
  function unlockText(it) {
    const u = it.unlock, parts = [];
    if (u.level) parts.push(L.atLevel.replace('{0}', u.level));
    if (u.ach) { const a = G.L.pg.ach[u.ach]; parts.push(L.forAch.replace('{0}', a ? a[0] : u.ach)); }
    if (u.gold) parts.push(L.orGold.replace('{0}', u.gold));
    return parts.join(' · ');
  }
  function profilePage() {
    const lv = G.levelInfo(), st = G.progress().st, nAch = Object.keys(G.progress().ach).length, nFind = Object.keys(G.progress().finds).length;
    const owned = ITEMS.filter(i => C.owns(i.id)).length, next = Math.pow(lv.level, 2) * 120, prev = Math.pow(lv.level - 1, 2) * 120;
    return `<div class="prof"><div class="pmirror"><canvas id="mirror"></canvas><p class="bsub">${esc(L.mirror)}</p></div><div class="pinfo">
      <div class="prow"><div class="pemb">${root.Icons ? Icons.svg(S.emblem) : ''}</div><div><input id="pname" maxlength="20" value="${esc(G.name())}" ${G.steamName() ? 'disabled' : ''}><div class="plevel">${esc(L.level)} ${lv.level}</div><div class="obar"><b style="width:${Math.max(2, Math.min(100, (lv.xp - prev) / (next - prev) * 100)).toFixed(0)}%"></b></div></div></div>
      <div class="pembs">${EMBLEMS.map(e => `<button class="pe${e === S.emblem ? ' on' : ''}" data-emb="${e}">${root.Icons ? Icons.svg(e) : e}</button>`).join('')}</div>
      <table class="rec"><tr><td>${esc(G.L.pg.rec.litres)}</td><td>${Math.round(st.litres).toLocaleString()} ${G.L.l}</td></tr><tr><td>${esc(G.L.pg.rec.depth)}</td><td>${st.maxDepth.toFixed(1)} ${G.L.m}</td></tr><tr><td>${esc(G.L.pg.tabs.ach)}</td><td>${nAch}</td></tr><tr><td>${esc(G.L.pg.rec.finds)}</td><td>${nFind}</td></tr><tr><td>${esc(L.skinsOwned)}</td><td>${owned} / ${ITEMS.length}</td></tr><tr><td>${esc(L.corp)}</td><td>${esc(G.corpName() || '—')}</td></tr></table>
      <h3>${esc(L.showcase)}</h3><div class="showc">${[S.wear.costume].concat(Object.values(S.wear.tool), Object.values(S.wear.machine)).filter(Boolean).map(id => `<div class="sitem r-${BY[id].r}">${swatch(BY[id])}<span>${esc(C.name(id))}</span></div>`).join('')}</div>
      <h3>${esc(L.friends)}</h3>${friendsHTML()}</div></div>`;
  }
  function friendsHTML() {
    if (!G.online()) return `<p class="bsub">${esc(L.friendsCoop)}</p>`;
    const near = G.peers().filter(p => !(C.friendList || []).some(f => f.name === p.name));
    return `<div class="fl">${(C.friendList || []).map(f => `<div class="lrow"><b>${esc(f.name)}</b><span>${f.online ? L.online : L.offline}</span></div>`).join('') || `<p class="bsub">${esc(L.noFriends)}</p>`}</div>`
      + (near.length ? `<p class="bsub">${esc(L.nearby)}</p><div class="fl">${near.map(p => `<div class="lrow"><b>${esc(p.name)}</b><button data-friend="${p.sid}">${esc(L.addFriend)}</button></div>`).join('')}</div>` : '');
  }
  function storePage() {
    const list = ITEMS.filter(i => i.kind === storeKind);
    return `<div class="stop"><div class="btabs">${['costume', 'tool', 'machine'].map(k => `<button class="btab${k === storeKind ? ' on' : ''}" data-kind="${k}">${esc(L.kinds[k])}</button>`).join('')}</div><div class="gold">${goldIcon()} ${S.gold}</div></div>
      <p class="bsub">${esc(L.storeSub)}</p><div class="sgrid">` + list.map(it => {
        const own = C.owns(it.id), worn = it.kind === 'costume' ? S.wear.costume === it.id : it.kind === 'tool' ? S.wear.tool[it.tool] === it.id : S.wear.machine[it.machine] === it.id;
        const btn = own ? `<button data-eq="${it.id}" class="${worn ? 'on' : ''}">${esc(worn ? L.worn : L.wear)}</button>` : it.unlock.gold ? `<button data-buy="${it.id}"${S.gold < it.unlock.gold ? ' disabled' : ''}>${goldIcon()} ${it.unlock.gold}</button>` : '';
        return `<div class="scard r-${it.r}">${swatch(it)}<b>${esc(C.name(it.id))}</b><span class="rr">${esc(L.rarity[it.r])}</span>${own ? '' : `<span class="un">${esc(unlockText(it))}</span>`}${btn}</div>`;
      }).join('') + `</div><h3>${esc(L.buyGold)}</h3><p class="bsub">${esc(G.steam() ? L.goldSteam : L.goldWeb)}</p><div class="packs">${PACKS.map(p => `<button data-pack="${p.id}"${G.steam() && G.online() ? '' : ' disabled'}>${goldIcon()} ${p.gold}<small>$${(p.cents / 100).toFixed(2)}</small></button>`).join('')}</div>`;
  }
  const goldIcon = () => '<svg viewBox="0 0 24 24" width="18" height="18" style="vertical-align:-3px"><circle cx="12" cy="12" r="10" fill="#ffcc33" stroke="#c8961a" stroke-width="2"/><path d="M8 12 L12 7 L16 12 L12 17 Z" fill="#fff3b0"/></svg>';
  function bind(el) {
    for (const b of el.querySelectorAll('[data-emb]')) b.onclick = () => { S.emblem = b.dataset.emb; save(); if (G.online()) G.send({ t: 'wear', wear: S.wear, emblem: S.emblem }); render(); };
    const pn = el.querySelector('#pname'); if (pn) pn.onchange = () => G.setName(pn.value);
    for (const b of el.querySelectorAll('[data-friend]')) b.onclick = () => G.send({ t: 'friend', sid: +b.dataset.friend });
    for (const b of el.querySelectorAll('[data-kind]')) b.onclick = () => { storeKind = b.dataset.kind; render(); };
    for (const b of el.querySelectorAll('[data-eq]')) b.onclick = () => C.equip(b.dataset.eq);
    for (const b of el.querySelectorAll('[data-buy]')) b.onclick = () => C.buy(b.dataset.buy);
    for (const b of el.querySelectorAll('[data-pack]')) b.onclick = () => G.send({ t: 'goldBuy', pack: +b.dataset.pack });
    const cv = el.querySelector('#mirror'); if (cv) mirrorOn(cv); else mirrorOff();
  }
  const render = () => { if (root.Progress && Progress.isOpen()) Progress.render(); };

  C.init = function (api) {
    G = api; L = api.L.cos || {}; S = load();
    Progress.addTab('profile', { label: () => L.profile, render: profilePage, bind, close: mirrorOff }, true);
    Progress.addTab('store', { label: () => L.store, render: storePage, bind, close: mirrorOff });
    apply();
  };
  C.state = () => S;
  C.setFriends = list => { C.friendList = list; render(); };
  root.Cosmetics = C;
})(window);
