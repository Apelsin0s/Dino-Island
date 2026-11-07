// UI controller: full-screen island, icon rail, panels, trees, manual, island map, saves, story.
'use strict';
(() => {
  const D = window.GAME_DATA, E = window.Engine, A = window.Art, W = window.World;
  const { RES, REGIONS, CHAIN, EGGS, BUILDINGS, UPGRADES, RESEARCH, STORY, ENDING, ACH } = D;
  const $ = id => document.getElementById(id);
  const SAVE_KEY = 'stone-age-save-v2';

  // ---------- save / load ----------
  const store = {
    get() { try { return localStorage.getItem(SAVE_KEY); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(SAVE_KEY, v); } catch (e) {} },
    del() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
  };
  const encode = s => btoa(unescape(encodeURIComponent(JSON.stringify(s))));
  const decode = str => JSON.parse(decodeURIComponent(escape(atob(str.trim()))));
  function hydrate(raw) {
    if (!raw || typeof raw !== 'object' || !raw.res || raw.v !== 2) throw new Error('bad save');
    const s = E.newState();
    for (const k in s) if (raw[k] !== undefined) s[k] = Array.isArray(s[k]) ? raw[k].slice() : (s[k] && typeof s[k] === 'object') ? Object.assign(s[k], raw[k]) : raw[k];
    return s;
  }
  let S;
  try { const raw = store.get(); S = raw ? hydrate(JSON.parse(raw)) : E.newState(); } catch (e) { S = E.newState(); }
  function save() { S.last = Date.now(); store.set(JSON.stringify(S)); }

  // ---------- text & formatting ----------
  if (!S.settings.lang) S.settings.lang = (navigator.language || 'en').toLowerCase().startsWith('ru') ? 'ru' : 'en';
  const lang = () => S.settings.lang;
  const tr = (k, vars) => { let s = (window.I18N[lang()] || window.I18N.en)[k] || k; if (vars) for (const v in vars) s = s.replace('{' + v + '}', vars[v]); return s; };
  const L = o => (o && (o[lang()] || o.en)) || '';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];
  function fmt(n) {
    if (!isFinite(n)) return '∞';
    if (n < 10) return (Math.floor(n * 10) / 10).toString();
    if (n < 1000) return Math.floor(n).toString();
    const e = Math.min(SUF.length - 1, Math.floor(Math.log10(n) / 3)), v = n / Math.pow(1000, e);
    return (v < 100 ? v.toFixed(v < 10 ? 2 : 1) : Math.floor(v)) + SUF[e];
  }
  const rate = n => (n >= 100 ? fmt(n) : n >= 10 ? n.toFixed(1) : n.toFixed(2).replace(/0$/, ''));
  function fmtTime(sec) { sec = Math.floor(sec); const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60; return h ? `${h}${tr('h')} ${m}${tr('m')}` : m ? `${m}${tr('m')} ${s}${tr('s')}` : `${s}${tr('s')}`; }
  const RN = Object.fromEntries(RES.map(r => [r.id, r]));
  const REGN = Object.fromEntries(REGIONS.map(r => [r.id, r]));
  const icon = id => `<img class="ic" src="${A.icon(id)}" alt="${esc(L(RN[id].name))}">`;
  const costHtml = cost => '<div class="cost">' + Object.keys(cost).map(r => `<span class="${S.res[r] >= cost[r] ? '' : 'no'}">${icon(r)}${fmt(cost[r])}</span>`).join('') + '</div>';
  function prodText(type, lvl) {
    const def = E.B[type], m = E.multipliers(S);
    if (def.global) return `${tr('huts')} +${(def.global * 100 * lvl).toFixed(1)}%`;
    return Object.keys(def.prod).map(r => `+${rate(def.prod[r] * lvl * m.all * m.res[r])} ${L(RN[r].name)}${tr('perSec')}`).join(', ');
  }

  // ---------- sound ----------
  let ac = null;
  function blip(f, d = 0.06, type = 'square', v = 0.04) {
    if (!S.settings.sound) return;
    try {
      if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      const t = ac.currentTime, o = ac.createOscillator(), gn = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.5, t + d);
      gn.gain.setValueAtTime(v, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(gn).connect(ac.destination); o.start(t); o.stop(t + d);
    } catch (e) {}
  }
  const sfx = {
    click: () => blip(440 + Math.random() * 80, 0.05), buy: () => { blip(523, 0.07); setTimeout(() => blip(784, 0.08), 60); },
    big: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.09, 'triangle', 0.06), i * 70)), no: () => blip(160, 0.12, 'sawtooth', 0.03)
  };

  // ---------- toasts, floaters, modal ----------
  function toast(msg) { const box = $('toasts'); while (box.children.length >= 3) box.firstChild.remove(); const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; box.appendChild(t); setTimeout(() => t.remove(), 3500); }
  function floatAt(resId, g, x, y) {
    const f = document.createElement('div'); f.className = 'floater'; f.style.left = x + 'px'; f.style.top = y + 'px';
    f.innerHTML = `+${fmt(g)} <img src="${A.icon(resId)}" alt="">`; $('floaters').appendChild(f); setTimeout(() => f.remove(), 950);
  }
  const queue = []; let modalOpen = false;
  function showPages(title, pages, btnLast, onDone) {
    let i = 0; modalOpen = true;
    const draw = () => {
      $('modalBox').innerHTML = `<h2>${esc(title)}</h2>${pages[i]}${pages.length > 1 ? `<span class="pg">${i + 1}/${pages.length}</span>` : ''}<button class="btn" id="mNext">${i < pages.length - 1 ? tr('next') : btnLast}</button>`;
      $('mNext').onclick = () => { if (i < pages.length - 1) { i++; draw(); blip(660, 0.04); } else { $('modal').hidden = true; modalOpen = false; onDone && onDone(); pump(); } };
      $('mNext').focus();
    };
    $('modal').hidden = false; draw();
  }
  const P = t => `<p>${esc(t)}</p>`;
  function pump() { if (modalOpen || !queue.length) return; queue.shift()(); }

  // ---------- 3D world ----------
  const fx = { food: 0, wood: 0, stone: 0, ideas: 0 };
  const sceneBox = $('sceneBox');
  let selected = null, demolishArmed = false, has3d = true;
  const DECO_NAME = { wood: { en: 'Trees', ru: 'Деревья' }, stone: { en: 'Rocks', ru: 'Камни' }, food: { en: 'Edible plants', ru: 'Съедобные растения' } };
  function gatherAt(resId, cx, cy) {
    const g = E.click(S, resId); fx[resId] = 0.25; sfx.click();
    const r = sceneBox.getBoundingClientRect(); floatAt(resId, g, cx - r.left, cy - r.top);
  }
  function onFind(sp) {
    if (sp.type === 'clue' && E.findClue(S, sp.idx)) {
      const c = CHAIN[sp.idx], reg = REGN[c.region]; sfx.big(); save();
      queue.push(() => showPages(tr('clueFound'), [P(L(c.clueText)), `<p><b>${tr('newRegion')}: ${esc(L(reg.name))}</b></p>` + P(L(reg.desc))], tr('close'), () => Scene3D.focusOn(reg.seed[0], reg.seed[1])));
    } else if (sp.type === 'part' && E.findPart(S, sp.idx)) {
      const c = CHAIN[sp.idx]; sfx.big(); save();
      queue.push(() => showPages(tr('foundPart') + ': ' + L(c.partName), [P(L(c.partText)), P(tr('goalFix', { part: L(c.partName) }))], tr('close')));
    } else if (sp.type === 'egg' && E.findEgg(S, sp.idx)) {
      const e = EGGS[sp.idx]; sfx.big(); save();
      queue.push(() => showPages(tr('foundEgg') + ': ' + L(e.name), [P(L(e.text))], tr('close')));
    }
    pump(); refreshUI(true);
  }
  function onPlace(p, spot) {
    $('placeHint').hidden = true;
    if (p.moveId) { if (E.move(S, p.moveId, spot)) { selected = p.moveId; sfx.buy(); save(); } else toast(tr('cantPlace')); renderSel(); return; }
    const b = E.build(S, p.type, spot);
    if (!b) { sfx.no(); toast(E.canAfford(S, E.buildCost(S, p.type)) ? tr('cantPlace') : tr('notEnough')); return; }
    sfx.buy(); save(); refreshUI(true);
    if (window.__shift && E.canAfford(S, E.buildCost(S, p.type))) startBuild(p.type); // Shift = keep building
  }
  function startBuild(type) {
    if (!has3d) return;
    closePanels(); selected = null; renderSel();
    Scene3D.startPlacement(type, null);
    $('placeHint').hidden = false; $('placeHint').innerHTML = `<b>${esc(L(E.B[type].name))}</b> ${tr('placeHint')}`;
  }
  window.addEventListener('keydown', e => { if (e.key === 'Shift') window.__shift = true; });
  window.addEventListener('keyup', e => { if (e.key === 'Shift') window.__shift = false; });
  try {
    Scene3D.init({
      container: sceneBox, quality: S.settings.gfx,
      onGather: gatherAt, onFind, onPlace,
      onSelect: id => { selected = id; demolishArmed = false; renderSel(); },
      onCancelPlace: () => { $('placeHint').hidden = true; },
      onHover: (h, cx, cy) => {
        const tip = $('tip'); if (!h) { tip.hidden = true; return; }
        let html = '';
        if (h.machine) html = esc(tr('machineHover'));
        else if (h.building) { const b = S.buildings.find(x => x.id === h.building); if (b) html = `<b>${esc(L(E.B[b.type].name))}</b> ${tr('lvl')} ${b.lvl} <small>${esc(prodText(b.type, b.lvl))}</small>`; }
        else if (h.special) html = h.special.type === 'part' ? `<b>${esc(L(CHAIN[h.special.idx].partName))}</b>` : esc(tr('somethingGlints'));
        else if (h.res) html = `<b>${esc(L(DECO_NAME[h.res]))}</b> <small>${tr('gather')}</small> ${icon(h.res)}`;
        if (!html) { tip.hidden = true; return; }
        const r = sceneBox.getBoundingClientRect(); tip.innerHTML = html; tip.hidden = false;
        tip.style.transform = `translate(${Math.round(cx - r.left + 14)}px, ${Math.round(cy - r.top + 18)}px)`;
      }
    });
  } catch (err) { has3d = false; sceneBox.insertAdjacentHTML('afterbegin', `<div id="no3d">${tr('no3d')}</div>`); }
  $('camBtns').addEventListener('click', e => {
    const b = e.target.closest('[data-cam]'); if (!b || !has3d) return;
    const k = b.dataset.cam; if (k === 'l') Scene3D.rotateView(-1); else if (k === 'r') Scene3D.rotateView(1); else if (k === 'in') Scene3D.zoomBy(1.2); else Scene3D.zoomBy(1 / 1.2);
  });

  // ---------- selection popup ----------
  function renderSel() {
    const box = $('selPop'), b = selected != null && S.buildings.find(x => x.id === selected);
    if (!b) { box.hidden = true; return; }
    const cap = E.levelCap(S), cost = E.levelCost(S, b), ok = b.lvl < cap && E.canAfford(S, cost);
    box.hidden = false;
    const html = `<div class="hd"><b>${esc(L(E.B[b.type].name))}</b><span>${tr('lvl')} ${b.lvl}/${cap}</span><button class="x" data-sel="x" aria-label="${tr('close')}">✕</button></div>
      <div class="prod">${esc(prodText(b.type, b.lvl))}</div>
      ${b.lvl < cap ? costHtml(cost) : `<p class="note">${tr('maxLevel')}</p>`}
      <button class="btn" data-sel="up" ${ok ? '' : 'disabled'}>${tr('levelUp')} → ${b.lvl + 1}</button>
      <div class="row"><button class="btn ghost sm" data-sel="move">${tr('move')}</button><button class="btn danger sm" data-sel="del">${demolishArmed ? tr('demolishSure') : tr('demolish')}</button></div>`;
    if (box.innerHTML !== html) box.innerHTML = html;
  }
  $('selPop').addEventListener('click', e => {
    const b = e.target.closest('[data-sel]'); if (!b) return;
    const id = selected, k = b.dataset.sel;
    if (k === 'x') { selected = null; return renderSel(); }
    if (k === 'up') { if (E.levelUp(S, id)) { sfx.buy(); save(); } else sfx.no(); return renderSel(); }
    if (k === 'move') { const bd = S.buildings.find(x => x.id === id); selected = null; renderSel(); Scene3D.startPlacement(bd.type, id); $('placeHint').hidden = false; $('placeHint').innerHTML = `<b>${esc(L(E.B[bd.type].name))}</b> ${tr('moveHint')}`; return; }
    if (k === 'del') { if (!demolishArmed) { demolishArmed = true; return renderSel(); } E.demolish(S, id); selected = null; demolishArmed = false; save(); renderSel(); }
  });
  function positionSel() {
    const box = $('selPop'); if (box.hidden || selected == null) return;
    const p = Scene3D.screenOf(selected); if (!p) return;
    const r = sceneBox.getBoundingClientRect(), x = Math.max(140, Math.min(r.width - 140, p.x)), y = Math.max(box.offsetHeight + 70, p.y);
    box.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, calc(-100% - 12px))`;
  }

  // ---------- HUD ----------
  function renderRes() {
    const rt = E.rates(S);
    const html = RES.filter(r => ['food', 'wood', 'stone', 'ideas'].includes(r.id) || S.total[r.id] > 0 || rt[r.id] > 0).map(r =>
      `<div class="res pframe" title="${esc(L(r.name))}">${icon(r.id)}<span>${fmt(S.res[r.id])}</span><small>${rt[r.id] ? '+' + rate(rt[r.id]) + tr('perSec') : ''}</small></div>`).join('');
    if ($('resbar').innerHTML !== html) $('resbar').innerHTML = html;
  }
  function goalText() {
    if (!S.research.wreck) return tr('goalStudy');
    for (let i = 0; i < CHAIN.length; i++) {
      const c = CHAIN[i];
      if (!S.research['page' + (i + 1)]) return tr('goalPage', { n: i + 1 });
      if (!S.clues[i]) return tr('goalClue', { n: i + 1 });
      if (!S.parts[c.part.id]) return tr('goalPart', { part: L(c.partName), region: L(REGN[c.region].name) });
      if (!S.research['fix_' + c.part.id]) return tr('goalFix', { part: L(c.partName) });
    }
    return tr('goalLaunch');
  }
  $('goal').addEventListener('click', () => { const g = goalText(); openPanel(g.includes('📘') ? 'manual' : g.includes('🔬') ? 'research' : 'manual'); });

  // ---------- rail & panels ----------
  const RAIL = [['build', '🔨', 'railBuild'], ['upgrades', '🌳', 'railUpgrades'], ['research', '🔬', 'railResearch'], ['manual', '📘', 'railManual'], ['island', '🗺️', 'railIsland'], ['diary', '📖', 'railDiary'], ['settings', '⚙️', 'railSettings']];
  const FULL = new Set(['upgrades', 'research', 'island']);
  let panel = null, lastHtml = '', resetArmed = false;
  function dots() {
    return {
      build: BUILDINGS.some(d => E.buildingUnlocked(S, d) && E.buildingRegionOpen(S, d) && E.countOf(S, d.id) === 0 && E.canAfford(S, E.buildCost(S, d.id))),
      upgrades: UPGRADES.some(u => E.upgradeAvailable(S, u) && E.canAfford(S, u.cost)),
      research: RESEARCH.some(r => E.researchAvailable(S, r) && !E.researchBlocked(S, r) && E.canAfford(S, r.cost)),
      manual: CHAIN.some((c, i) => E.clueActive(S, i))
    };
  }
  function renderRail() {
    const d = dots();
    const html = RAIL.map(([id, ic, k]) => `<button class="rbtn ${panel === id ? 'on' : ''}" data-panel="${id}" aria-label="${tr(k)}">${ic}${d[id] ? '<span class="dot"></span>' : ''}<span class="lbl">${tr(k)}</span></button>`).join('');
    if ($('rail').innerHTML !== html) $('rail').innerHTML = html;
  }
  $('rail').addEventListener('click', e => { const b = e.target.closest('[data-panel]'); if (b) openPanel(panel === b.dataset.panel ? null : b.dataset.panel); });
  function openPanel(p) {
    panel = p; resetArmed = false; lastHtml = '';
    $('drawer').hidden = !p || FULL.has(p); $('full').hidden = !p || !FULL.has(p);
    if (p) { selected = null; renderSel(); }
    refreshUI(true);
  }
  function closePanels() { openPanel(null); }
  $('full').addEventListener('click', e => { if (e.target.id === 'full') closePanels(); });

  function buildPanel() {
    let h = `<h2 class="dh">🔨 ${tr('railBuild')}<button class="x" data-close>✕</button></h2>`;
    BUILDINGS.forEach(d => {
      const unlocked = E.buildingUnlocked(S, d), open = E.buildingRegionOpen(S, d), n = E.countOf(S, d.id);
      if (!unlocked) { const req = E.U[d.req] || E.R[d.req]; h += `<button class="card" disabled><span class="nm">${esc(L(d.name))}</span><span></span><span class="why">${tr('needs')}: ${esc(L(req.name))}</span></button>`; return; }
      const cost = E.buildCost(S, d.id), ok = open && E.canAfford(S, cost);
      const where = d.regions ? `${tr('onlyIn')}: ${d.regions.map(r => L(REGN[r].name)).join(', ')}` : '';
      h += `<button class="card ${ok ? 'ready' : ''}" data-build="${d.id}" ${ok ? '' : 'disabled'}><span class="nm">${esc(L(d.name))}</span><span class="cnt">${n ? n + ' ' + tr('owned') : ''}</span>
        <span class="ds">${esc(L(d.desc))}</span><span class="prod">${esc(prodText(d.id, 1))}</span>
        ${!open ? `<span class="why">${esc(where)} — ${tr('regionClosed')}</span>` : ''}${costHtml(cost)}</button>`;
    });
    return h;
  }
  function treeHtml(list, kind) {
    const NW = 176, NH = 132, GX = 204, GY = 152;
    const maxC = Math.max(...list.map(n => n.pos[0])), maxR = Math.max(...list.map(n => n.pos[1]));
    const X = n => 20 + n.pos[0] * GX, Y = n => 16 + n.pos[1] * GY;
    let lines = '', nodes = '';
    list.forEach(n => (n.req || []).forEach(rq => {
      const p = list.find(x => x.id === rq); if (!p) return;
      const own = kind === 'u' ? S.upgrades[rq] : S.research[rq];
      lines += `<path d="M${X(p) + NW} ${Y(p) + NH / 2} C ${X(p) + NW + 20} ${Y(p) + NH / 2}, ${X(n) - 20} ${Y(n) + NH / 2}, ${X(n)} ${Y(n) + NH / 2}" stroke="${own ? '#8fe07a' : '#5c4430'}" stroke-width="4" fill="none"/>`;
    }));
    list.forEach(n => {
      const own = kind === 'u' ? S.upgrades[n.id] : S.research[n.id];
      const avail = !own && (kind === 'u' ? E.upgradeAvailable(S, n) : E.researchAvailable(S, n));
      const blocked = kind === 'r' && avail && E.researchBlocked(S, n);
      const can = avail && !blocked && E.canAfford(S, n.cost);
      let name = L(n.name), desc = L(n.desc), st = '';
      if (n.kind === 'repair') {
        const c = CHAIN[n.chain]; name = L(n.name) + L(c.partName); desc = '';
        if (!own) st = `<span class="st" style="color:${S.parts[n.part] ? 'var(--good)' : 'var(--bad)'}">${S.parts[n.part] ? '✓ ' + tr('partFound') : '✗ ' + tr('partMissing') + ': ' + esc(L(REGN[c.region].name))}</span>`;
      }
      const cls = ['node', own ? 'own' : avail ? 'avail' : 'lock', can ? 'can' : '', n.kind || ''].join(' ');
      nodes += `<button class="${cls}" style="left:${X(n)}px;top:${Y(n)}px;height:${NH}px" data-node="${kind}:${n.id}">
        <span class="nm">${esc(name)}</span><span class="ds">${esc(desc)}</span>${st}${own ? `<span class="st" style="color:var(--good)">✓ ${tr('bought')}</span>` : costHtml(n.cost)}</button>`;
    });
    const w = 40 + (maxC + 1) * GX, h = 32 + (maxR + 1) * GY;
    return `<div class="tree" style="width:${w}px;height:${h}px"><svg width="${w}" height="${h}">${lines}</svg>${nodes}</div>`;
  }
  function upgradesPanel() { return `<div class="phead"><h2>🌳 ${tr('upgradeTitle')}</h2><p>${tr('upgradeHint')}</p><button class="x" data-close>✕</button></div><div class="treeWrap" id="treeWrap">${treeHtml(UPGRADES, 'u')}</div>`; }
  function researchPanel() {
    const fixed = RESEARCH.filter(r => r.kind === 'repair' && S.research[r.id]).length;
    return `<div class="phead"><h2>🔬 ${tr('researchTitle')}</h2><p>${tr('researchHint')} ${tr('machineParts')}: ${fixed}/${CHAIN.length}.</p><button class="x" data-close>✕</button></div><div class="treeWrap" id="treeWrap">${treeHtml(RESEARCH, 'r')}</div>`;
  }
  function manualPanel() {
    let h = `<h2 class="dh">📘 ${tr('manualTitle')}<button class="x" data-close>✕</button></h2>`;
    if (!S.research.wreck) return h + `<p class="note">${tr('manualEmpty')}</p>`;
    CHAIN.forEach((c, i) => {
      if (!S.research['page' + (i + 1)]) { h += `<div class="page blur"><h4>${tr('pageLocked')}</h4></div>`; return; }
      const reg = REGN[c.region], clue = S.clues[i], part = S.parts[c.part.id];
      h += `<div class="page"><p>${esc(L(c.page))}</p>
        <span class="stt ${clue ? '' : 'wait'}">${clue ? '✓ ' + tr('clueFound') + ' → ' + esc(L(reg.name)) : '… ' + tr('clueSearch') + ': ' + esc(L(REGN[c.clue.in].name))}</span>
        ${clue ? `<span class="stt ${part ? '' : 'wait'}">${part ? '✓ ' + esc(L(c.partName)) : '… ' + tr('partIn') + ' «' + esc(L(c.partName)) + '» — ' + esc(L(reg.name))}</span>` : ''}</div>`;
    });
    return h;
  }
  function diaryPanel() {
    let h = `<h2 class="dh">📖 ${tr('diaryTitle')}<button class="x" data-close>✕</button></h2>`;
    const items = [];
    STORY.filter(e => S.story[e.id]).forEach(e => items.push(L(e.text).map(P).join('')));
    CHAIN.forEach((c, i) => { if (S.clues[i]) items.push(`<b>${esc(L(REGN[c.region].name))}</b>` + P(L(c.clueText))); if (S.parts[c.part.id]) items.push(`<b>${esc(L(c.partName))}</b>` + P(L(c.partText))); });
    EGGS.forEach(e => { if (S.eggs[e.id]) items.push(`<b>${esc(L(e.name))}</b>` + P(L(e.text))); });
    return h + items.reverse().map(x => `<div class="entry">${x}</div>`).join('');
  }
  function settingsPanel() {
    const got = ACH.filter(a => S.ach[a.id]).length;
    return `<h2 class="dh">⚙️ ${tr('settingsTitle')}<button class="x" data-close>✕</button></h2>
      <div class="row"><span>${tr('language')}</span><div class="seg"><button data-lang="en" class="${lang() === 'en' ? 'on' : ''}">English</button><button data-lang="ru" class="${lang() === 'ru' ? 'on' : ''}">Русский</button></div></div>
      <div class="row"><span>${tr('sound')}</span><div class="seg"><button data-snd="1" class="${S.settings.sound ? 'on' : ''}">${tr('on')}</button><button data-snd="0" class="${S.settings.sound ? '' : 'on'}">${tr('off')}</button></div></div>
      <div class="row"><span>${tr('gfx')}</span><div class="seg">${['low', 'medium', 'high'].map(q => `<button data-gfx="${q}" class="${(S.settings.gfx || 'medium') === q ? 'on' : ''}">${tr('gfx_' + q)}</button>`).join('')}</div></div>
      <p class="note">${tr('controls')}</p>
      <h3 class="sub">${tr('statsTitle')}</h3>
      <div class="stats"><span>${tr('playTime')}</span><span>${fmtTime(S.playTime)}</span><span>${tr('clicks')}</span><span>${fmt(S.clicks)}</span>
        <span>${tr('buildings')}</span><span>${S.buildings.length}</span><span>${tr('regions')}</span><span>${S.regions.length}/${REGIONS.length}</span>
        <span>${tr('loops')}</span><span>${S.loops}</span><span>${tr('echo')}</span><span>${S.echoes} (+${S.echoes * 10}%)</span></div>
      <h3 class="sub">${tr('achievements')} · ${got}/${ACH.length}</h3>
      ${ACH.map(a => `<div class="ach ${S.ach[a.id] ? 'on' : ''}"><span>${S.ach[a.id] ? '★' : '☆'}</span><span>${esc(L(a.name))}</span><small>${esc(L(a.desc))}</small></div>`).join('')}
      <div class="row"><button class="btn ghost" id="expBtn">${tr('exportSave')}</button><button class="btn ghost" id="impBtn">${tr('importSave')}</button></div>
      <textarea id="saveBox" placeholder="${esc(tr('importPlaceholder'))}"></textarea>
      <button class="btn danger" id="resetBtn">${resetArmed ? tr('resetConfirm') : tr('reset')}</button>`;
  }
  const CELL_PX = 6;
  function islandPanel() {
    return `<div class="phead"><h2>🗺️ ${tr('islandTitle')}</h2><p>${tr('islandHint')}</p><button class="x" data-close>✕</button></div>
      <div class="islandWrap"><canvas id="islandCanvas" width="${80 * CELL_PX}" height="${80 * CELL_PX}"></canvas></div>
      <div class="legend">${REGIONS.map(r => `<span style="color:${S.regions.includes(r.id) ? r.ground : '#888'}">■ ${esc(L(r.name))}${S.regions.includes(r.id) ? '' : ' 🔒'}</span>`).join('')}</div>`;
  }
  function drawIsland() {
    const cv = $('islandCanvas'); if (!cv) return; const g = cv.getContext('2d');
    g.fillStyle = '#1f5f8a'; g.fillRect(0, 0, cv.width, cv.height);
    const px = (x, z) => [(x - W.MIN) * CELL_PX, (z - W.MIN) * CELL_PX];
    W.cells.forEach((reg, k) => {
      const [x, z] = k.split(',').map(Number), [a, b] = px(x, z), open = S.regions.includes(reg);
      g.fillStyle = W.isRiver(x, z) ? '#3a9ad9' : open ? REGN[reg].ground : ((x + z) & 1 ? '#8a9098' : '#7c828a');
      g.fillRect(a, b, CELL_PX, CELL_PX);
    });
    S.buildings.forEach(b => { const [w, d] = E.footprint(b.type, b.rot), [a, c] = px(b.x, b.z); g.fillStyle = '#3a2414'; g.fillRect(a, c, w * CELL_PX, d * CELL_PX); g.fillStyle = '#e8c890'; g.fillRect(a + 1, c + 1, w * CELL_PX - 2, d * CELL_PX - 2); });
    const [mx, mz] = px(W.MACHINE.x, W.MACHINE.z); g.fillStyle = '#d0d6dc'; g.fillRect(mx, mz, 3 * CELL_PX, 3 * CELL_PX); g.fillStyle = '#c77dff'; g.fillRect(mx + 6, mz + 6, 6, 6);
    const track = E.multipliers(S).search >= 2;
    W.SPECIAL.forEach(sp => {
      const active = sp.type === 'clue' ? E.clueActive(S, sp.idx) : sp.type === 'part' ? E.partActive(S, sp.idx) : false;
      const known = sp.type === 'clue' && S.known[sp.idx];
      if (!active || !(track || known)) return;
      const [a, b] = px(sp.at[0], sp.at[1]); g.fillStyle = sp.type === 'part' ? '#c77dff' : '#ffe14a'; g.fillRect(a - 3, b - 3, CELL_PX + 6, CELL_PX + 6); g.fillStyle = '#000'; g.fillRect(a, b, CELL_PX, CELL_PX);
    });
    g.font = '14px "Pixelify Sans", monospace'; g.textAlign = 'center';
    REGIONS.forEach(r => { const [a, b] = px(r.seed[0], r.seed[1]); const open = S.regions.includes(r.id), txt = open ? L(r.name) : '?'; g.fillStyle = '#000'; g.fillText(txt, a + 1, b + 1); g.fillStyle = '#fff'; g.fillText(txt, a, b); });
    const v = has3d ? Scene3D.getView() : { x: 0, z: 0, zoom: 1 }, [vx, vz] = px(v.x, v.z), half = 15 / v.zoom * CELL_PX;
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(vx - half * 1.6, vz - half, half * 3.2, half * 2);
  }
  $('fullBody').addEventListener('click', e => {
    const cv = e.target.closest('#islandCanvas');
    if (cv) { const r = cv.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width * 80 + W.MIN, z = (e.clientY - r.top) / r.height * 80 + W.MIN; if (has3d) Scene3D.focusOn(x, z); closePanels(); }
  });
  let treeDrag = null;
  $('fullBody').addEventListener('pointerdown', e => { const w = e.target.closest('#treeWrap'); if (w && !e.target.closest('.node')) treeDrag = { w, x: e.clientX, y: e.clientY, sl: w.scrollLeft, st: w.scrollTop }; });
  window.addEventListener('pointermove', e => { if (treeDrag) { treeDrag.w.scrollLeft = treeDrag.sl - (e.clientX - treeDrag.x); treeDrag.w.scrollTop = treeDrag.st - (e.clientY - treeDrag.y); } });
  window.addEventListener('pointerup', () => { treeDrag = null; });

  function panelClick(e) {
    const t = e.target;
    if (t.closest('[data-close]')) return closePanels();
    const bb = t.closest('[data-build]'); if (bb) { const id = bb.dataset.build; if (E.canAfford(S, E.buildCost(S, id))) startBuild(id); else sfx.no(); return; }
    const nd = t.closest('[data-node]');
    if (nd) {
      const [k, id] = nd.dataset.node.split(':');
      const ok = k === 'u' ? E.buyUpgrade(S, id) : E.buyResearch(S, id);
      if (ok) { sfx.big(); save(); toast('✓ ' + L((k === 'u' ? E.U : E.R)[id].name)); if (id === 'launch') { closePanels(); showEnding(); } refreshUI(true); } else sfx.no();
      return;
    }
    const bl = t.closest('[data-lang]'); if (bl) { S.settings.lang = bl.dataset.lang; save(); return applyLang(); }
    const bs = t.closest('[data-snd]'); if (bs) { S.settings.sound = bs.dataset.snd === '1'; save(); return refreshUI(true); }
    const bg = t.closest('[data-gfx]'); if (bg) { S.settings.gfx = bg.dataset.gfx; if (has3d) Scene3D.setQuality(S.settings.gfx); save(); return refreshUI(true); }
    if (t.id === 'expBtn') { const code = encode(S); $('saveBox').value = code; (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(() => toast(tr('copied')), () => { $('saveBox').select(); toast(tr('copyFail')); }); return; }
    if (t.id === 'impBtn') { try { S = hydrate(decode($('saveBox').value)); save(); toast(tr('importOk')); applyLang(); } catch (err) { toast(tr('importBad')); } return; }
    if (t.id === 'resetBtn') { if (!resetArmed) { resetArmed = true; return refreshUI(true); } const keep = { settings: S.settings }; store.del(); S = E.newState(keep); resetArmed = false; save(); closePanels(); applyLang(); }
  }
  $('drawerBody').addEventListener('click', panelClick);
  $('fullBody').addEventListener('click', panelClick);

  function refreshUI(force) {
    renderRes(); renderRail();
    const g = `<b>${tr('goal')}:</b>${esc(goalText())}`; if ($('goal').innerHTML !== g) $('goal').innerHTML = g;
    if (!panel) return;
    const html = panel === 'build' ? buildPanel() : panel === 'upgrades' ? upgradesPanel() : panel === 'research' ? researchPanel() : panel === 'manual' ? manualPanel()
      : panel === 'diary' ? diaryPanel() : panel === 'settings' ? settingsPanel() : islandPanel();
    if (!force && html === lastHtml) { if (panel === 'island') drawIsland(); return; }
    lastHtml = html;
    const box = FULL.has(panel) ? $('fullBody') : $('drawerBody');
    const tw = $('treeWrap'), sl = tw ? tw.scrollLeft : 0, st = tw ? tw.scrollTop : 0, top = box.scrollTop;
    const keepText = $('saveBox') ? $('saveBox').value : null;
    box.innerHTML = html; box.scrollTop = top;
    const tw2 = $('treeWrap'); if (tw2) { tw2.scrollLeft = sl; tw2.scrollTop = st; }
    if (keepText !== null && $('saveBox')) $('saveBox').value = keepText;
    if (panel === 'island') drawIsland();
  }
  function applyLang() { document.documentElement.lang = lang(); document.title = tr('title'); lastHtml = ''; refreshUI(true); renderSel(); }

  // ---------- story, achievements ----------
  function checkEvents() {
    E.newStory(S).forEach(st => { S.story[st.id] = true; queue.push(() => showPages(tr('diary'), L(st.text).map(P), tr('close'))); });
    E.newAch(S).forEach(a => { S.ach[a.id] = true; toast(`★ ${tr('achUnlocked')}: ${L(a.name)}`); });
    pump();
  }
  function showEnding() {
    save();
    showPages('2026', L(ENDING).map(P), tr('newLoop'), () => { const { state, gained } = E.finishLoop(S); S = state; selected = null; save(); applyLang(); toast(`${tr('echo')} +${gained}`); });
  }
  window.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (has3d && Scene3D.isPlacing()) { Scene3D.cancelPlacement(false); return; }
    if (panel) return closePanels();
    if (selected != null) { selected = null; renderSel(); }
  });

  // ---------- loop ----------
  let lastT = performance.now(), uiT = 0, saveT = 0;
  function frame(now) {
    const dt = Math.min(1, (now - lastT) / 1000); lastT = now;
    E.tick(S, dt); S.last = Date.now();
    for (const k in fx) if (fx[k] > 0) fx[k] = Math.max(0, fx[k] - dt);
    if (has3d) { Scene3D.update(S, now / 1000, dt, fx, selected); positionSel(); }
    uiT += dt; saveT += dt;
    if (uiT > 0.25) { uiT = 0; refreshUI(false); if (selected != null) renderSel(); checkEvents(); }
    if (saveT > 10) { saveT = 0; save(); }
    requestAnimationFrame(frame);
  }
  function welcomeBack() {
    const { dt, got } = E.offline(S, Date.now());
    if (dt < 60 || !Object.keys(got).length) return;
    queue.push(() => showPages(tr('welcomeBack'), [`<p>${tr('awayFor')}: ${fmtTime(dt)}</p><div class="list">${Object.keys(got).map(r => `<span>${icon(r)}+${fmt(got[r])}</span>`).join('')}</div>`], tr('close')));
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); else { welcomeBack(); lastT = performance.now(); pump(); } });
  window.addEventListener('beforeunload', save);

  welcomeBack(); applyLang(); checkEvents();
  requestAnimationFrame(frame);
  window.__game = { get state() { return S; }, save, openPanel };
})();
