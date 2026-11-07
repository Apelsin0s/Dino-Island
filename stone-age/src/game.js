// UI controller: scene, clicks, panels, story, saving, offline progress.
'use strict';
(() => {
  const { RES, BUILDINGS, TECHS, PARTS, STORY, ENDING, ACH } = window.GAME_DATA;
  const E = window.Engine, A = window.Art;
  const $ = id => document.getElementById(id);
  const SAVE_KEY = 'stone-age-save-v1';

  // ---------- save / load ----------
  const store = {
    get() { try { return localStorage.getItem(SAVE_KEY); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(SAVE_KEY, v); return true; } catch (e) { return false; } },
    del() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
  };
  const encode = s => btoa(unescape(encodeURIComponent(JSON.stringify(s))));
  const decode = str => JSON.parse(decodeURIComponent(escape(atob(str.trim()))));
  function hydrate(raw) {
    const s = E.newState();
    if (!raw || typeof raw !== 'object' || !raw.res) throw new Error('bad save');
    for (const k in s) if (raw[k] !== undefined) s[k] = (typeof s[k] === 'object' && s[k] && !Array.isArray(s[k])) ? Object.assign(s[k], raw[k]) : raw[k];
    return s;
  }
  let S;
  try { const raw = store.get(); S = raw ? hydrate(JSON.parse(raw)) : E.newState(); } catch (e) { S = E.newState(); }
  function save() { S.last = Date.now(); store.set(JSON.stringify(S)); }

  // ---------- language & formatting ----------
  if (!S.settings.lang) S.settings.lang = (navigator.language || 'en').toLowerCase().startsWith('ru') ? 'ru' : 'en';
  const lang = () => S.settings.lang;
  const tr = k => (window.I18N[lang()] || window.I18N.en)[k] || k;
  const L = o => (o && (o[lang()] || o.en)) || '';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx'];
  function fmt(n) {
    if (!isFinite(n)) return '∞';
    if (n < 10) return (Math.floor(n * 10) / 10).toString();
    if (n < 1000) return Math.floor(n).toString();
    const e = Math.min(SUF.length - 1, Math.floor(Math.log10(n) / 3));
    const v = n / Math.pow(1000, e);
    return (v < 100 ? v.toFixed(v < 10 ? 2 : 1) : Math.floor(v)) + SUF[e];
  }
  const rate = n => (n >= 100 ? fmt(n) : n >= 10 ? n.toFixed(1) : n.toFixed(2).replace(/0$/, ''));
  function fmtTime(sec) {
    sec = Math.floor(sec); const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
    return h ? `${h}${tr('h')} ${m}${tr('m')}` : m ? `${m}${tr('m')} ${s}${tr('s')}` : `${s}${tr('s')}`;
  }
  const RNAME = Object.fromEntries(RES.map(r => [r.id, r]));
  const icon = id => `<img class="ic" src="${A.icon(id)}" alt="${esc(L(RNAME[id].name))}">`;
  function costHtml(cost) {
    return '<div class="cost">' + Object.keys(cost).map(r => `<span class="${S.res[r] >= cost[r] ? '' : 'no'}">${icon(r)}${fmt(cost[r])}</span>`).join('') + '</div>';
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
    click: () => blip(440 + Math.random() * 80, 0.05),
    buy: () => { blip(523, 0.07); setTimeout(() => blip(784, 0.08), 60); },
    tech: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.09, 'triangle', 0.06), i * 70)),
    no: () => blip(160, 0.12, 'sawtooth', 0.03)
  };

  // ---------- scene ----------
  const cvs = $('scene'), ctx = cvs.getContext('2d');
  const fx = { food: 0, wood: 0, stone: 0, ideas: 0 };
  function gatherAt(resId, px, py) {
    const g = E.click(S, resId); fx[resId] = 0.25; sfx.click();
    const f = document.createElement('div'); f.className = 'floater';
    f.style.left = (px / A.W * 100) + '%'; f.style.top = (py / A.H * 100) + '%';
    f.innerHTML = `+${fmt(g)} <img src="${A.icon(resId)}" alt="">`;
    $('floaters').appendChild(f); setTimeout(() => f.remove(), 950);
  }
  cvs.addEventListener('pointerdown', e => {
    const rc = cvs.getBoundingClientRect();
    const x = (e.clientX - rc.left) / rc.width * A.W, y = (e.clientY - rc.top) / rc.height * A.H;
    const hit = A.HITS.find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h);
    if (hit) gatherAt(hit.id, x, y);
  });
  cvs.addEventListener('pointermove', e => {
    const rc = cvs.getBoundingClientRect();
    const x = (e.clientX - rc.left) / rc.width * A.W, y = (e.clientY - rc.top) / rc.height * A.H;
    cvs.style.cursor = A.HITS.some(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) ? 'pointer' : 'default';
  });
  const GATHER_POS = { food: [89, 120], wood: [26, 104], stone: [66, 124], ideas: [294, 104] };
  function renderGather() {
    $('gather').innerHTML = [['food', 'gatherFood'], ['wood', 'gatherWood'], ['stone', 'gatherStone'], ['ideas', 'gatherIdeas']]
      .map(([r, k]) => `<button class="gbtn" data-g="${r}">${icon(r)}<span>${tr(k)}</span><small>+${fmt(E.clickGain(S, r))}</small></button>`).join('');
  }
  $('gather').addEventListener('click', e => { const b = e.target.closest('[data-g]'); if (b) { gatherAt(b.dataset.g, ...GATHER_POS[b.dataset.g]); } });

  // ---------- header ----------
  function renderRes() {
    const rt = E.rates(S);
    $('resbar').innerHTML = RES.filter(r => E.resVisible(S, r.id)).map(r =>
      `<div class="res pframe" title="${esc(L(r.name))}">${icon(r.id)}<b>${fmt(S.res[r.id])}</b><small>${rt[r.id] ? '+' + rate(rt[r.id]) + tr('perSec') : ''}</small></div>`).join('');
  }

  // ---------- tabs ----------
  let tab = 'build', lastTabHtml = '', resetArmed = false;
  function tabsHtml() {
    const anyTech = TECHS.some(t => E.techVisible(S, t) && E.canAfford(S, t.cost));
    const np = E.nextPart(S), partReady = np && E.machineVisible(S) && (!np.req || S.tech[np.req]) && E.canAfford(S, np.cost);
    const list = [['build', 'tabBuild', false], ['ideas', 'tabIdeas', anyTech]];
    if (E.machineVisible(S)) list.push(['machine', 'tabMachine', partReady]);
    list.push(['journal', 'tabJournal', false], ['more', 'tabMore', false]);
    return list.map(([id, k, dot]) => `<button class="tab ${tab === id ? 'on' : ''}" role="tab" data-tab="${id}">${tr(k)}${dot ? '<span class="dot"></span>' : ''}</button>`).join('');
  }
  $('tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) { tab = b.dataset.tab; resetArmed = false; refreshUI(true); $('tabBody').scrollTop = 0; } });

  function buildTab() {
    const rt = E.rates(S), m = E.multipliers(S);
    const mode = S.settings.buyMode;
    let h = `<div class="row seg">${[1, 10, 'max'].map(v => `<button data-mode="${v}" class="${mode === v ? 'on' : ''}">${v === 'max' ? tr('max') : 'x' + v}</button>`).join('')}</div>`;
    BUILDINGS.filter(b => E.buildingVisible(S, b)).forEach(b => {
      const owned = S.b[b.id] || 0;
      let n = mode === 'max' ? Math.max(1, E.maxAffordable(S, b)) : mode;
      const cost = E.buildingCost(b, owned, n), ok = E.canAfford(S, cost);
      let prod = '';
      if (b.prod) prod = Object.keys(b.prod).map(r => `+${rate(b.prod[r] * m.all * m.res[r])} ${esc(L(RNAME[r].name))}${tr('perSec')} ${tr('each')}`).join(', ');
      if (b.global) prod = `+${Math.round(b.global * 100)}% ×${owned}`;
      h += `<button class="card ${ok ? 'ready' : ''}" data-b="${b.id}" ${ok ? '' : 'disabled'}>
        <span class="nm">${esc(L(b.name))}${n > 1 ? ` <small>x${n}</small>` : ''}</span><span class="cnt">${owned}</span>
        <span class="ds">${esc(L(b.desc))}</span><span class="prod">${prod}</span>${costHtml(cost)}</button>`;
    });
    const nextLocked = BUILDINGS.find(b => !E.buildingVisible(S, b));
    if (nextLocked) h += `<p class="note">${tr('lockedBehind')}: ${esc(L(E.T[nextLocked.req].name))}</p>`;
    return h;
  }
  function ideasTab() {
    const vis = TECHS.filter(t => E.techVisible(S, t));
    let h = vis.length ? '' : `<p class="note">${tr('nothingToResearch')}</p>`;
    vis.forEach(t => {
      const ok = E.canAfford(S, t.cost);
      h += `<button class="card ${ok ? 'ready' : ''}" data-t="${t.id}" ${ok ? '' : 'disabled'}><span class="nm">${esc(L(t.name))}</span><span></span>
        <span class="ds">${esc(L(t.desc))}</span>${costHtml(t.cost)}</button>`;
    });
    const done = TECHS.filter(t => S.tech[t.id]);
    if (done.length) h += `<h3 class="sub">${tr('researched')} · ${done.length}/${TECHS.length}</h3><div class="chips">${done.map(t => `<span class="chip">${esc(L(t.name))}</span>`).join('')}</div>`;
    return h;
  }
  function machineTab() {
    if (!E.machineVisible(S)) return `<p class="note">${tr('machineLocked')}</p>`;
    const np = E.nextPart(S);
    let h = `<h3 class="sub">${tr('repairs')}</h3>`;
    PARTS.forEach(p => {
      const st = S.parts[p.id] ? 'ok' : p === np ? 'cur' : '';
      const reqTxt = !S.parts[p.id] && p.req && !S.tech[p.req] ? `${tr('lockedBehind')}: ${esc(L(E.T[p.req].name))}` : S.parts[p.id] ? tr('done') : '';
      h += `<div class="part ${st} ${p.id === 'launch' ? 'launch' : ''}">${S.parts[p.id] ? '■' : '□'} ${esc(L(p.name))}<span class="st">${reqTxt}</span></div>`;
    });
    if (np) {
      const reqOk = !np.req || S.tech[np.req], ok = reqOk && E.canAfford(S, np.cost);
      if (np.id === 'launch') {
        h += `<h3 class="sub">${tr('echo')}</h3><p class="note">${tr('echoInfo')} ${tr('echoGain')}: <b style="color:var(--chrono)">+${E.echoesFromLoop(S)}</b></p>`;
        h += `${costHtml(np.cost)}<button class="btn chrono" data-p="launch" ${ok ? '' : 'disabled'}>${tr('launch')}</button>`;
      } else {
        h += `<h3 class="sub">${tr('nextPart')}</h3><button class="card ${ok ? 'ready' : ''}" data-p="${np.id}" ${ok ? '' : 'disabled'}><span class="nm">${esc(L(np.name))}</span><span></span>${reqOk ? '' : `<span class="ds">${tr('lockedBehind')}: ${esc(L(E.T[np.req].name))}</span>`}${costHtml(np.cost)}</button>`;
      }
    }
    if (S.echoes) h += `<p class="note">${tr('echo')}: ${S.echoes} (+${S.echoes * 10}%)</p>`;
    return h;
  }
  function journalTab() {
    const seen = STORY.filter(e => S.story[e.id]).reverse();
    if (!seen.length) return `<p class="note">${tr('journalEmpty')}</p>`;
    return seen.map(e => `<div class="entry">${L(e.text).map(p => `<p>${esc(p)}</p>`).join('')}</div>`).join('');
  }
  function moreTab() {
    const got = ACH.filter(a => S.ach[a.id]).length;
    return `<h3 class="sub">${tr('statsTitle')}</h3>
      <div class="stats"><span>${tr('playTime')}</span><span>${fmtTime(S.playTime)}</span><span>${tr('clicks')}</span><span>${fmt(S.clicks)}</span>
      <span>${tr('buildings')}</span><span>${fmt(Object.values(S.b).reduce((a, b) => a + b, 0))}</span><span>${tr('loops')}</span><span>${S.loops}</span>
      <span>${tr('echo')}</span><span>${S.echoes} (+${S.echoes * 10}%)</span></div>
      <h3 class="sub">${tr('achievements')} · ${got}/${ACH.length}</h3>
      ${ACH.map(a => `<div class="ach ${S.ach[a.id] ? 'on' : ''}"><span>${S.ach[a.id] ? '★' : '☆'}</span><span>${esc(L(a.name))}</span><small>${esc(L(a.desc))}</small></div>`).join('')}
      <h3 class="sub">${tr('settings')}</h3>
      <div class="row"><span>${tr('language')}</span><div class="seg"><button data-lang="en" class="${lang() === 'en' ? 'on' : ''}">English</button><button data-lang="ru" class="${lang() === 'ru' ? 'on' : ''}">Русский</button></div></div>
      <div class="row"><span>${tr('sound')}</span><div class="seg"><button data-snd="1" class="${S.settings.sound ? 'on' : ''}">${tr('on')}</button><button data-snd="0" class="${S.settings.sound ? '' : 'on'}">${tr('off')}</button></div></div>
      <div class="row"><button class="btn ghost" id="expBtn">${tr('exportSave')}</button><button class="btn ghost" id="impBtn">${tr('importSave')}</button></div>
      <textarea id="saveBox" placeholder="${esc(tr('importPlaceholder'))}"></textarea>
      <button class="btn danger" id="resetBtn">${resetArmed ? tr('resetConfirm') : tr('reset')}</button>`;
  }
  $('tabBody').addEventListener('click', e => {
    const t = e.target;
    const bm = t.closest('[data-mode]'); if (bm) { const v = bm.dataset.mode; S.settings.buyMode = v === 'max' ? 'max' : +v; return refreshUI(true); }
    const bb = t.closest('[data-b]'); if (bb) { if (E.buyBuilding(S, bb.dataset.b, S.settings.buyMode)) { sfx.buy(); afterAction(); } else sfx.no(); return; }
    const bt = t.closest('[data-t]'); if (bt) { if (E.research(S, bt.dataset.t)) { sfx.tech(); toast(L(E.T[bt.dataset.t].name)); afterAction(); } else sfx.no(); return; }
    const bp = t.closest('[data-p]'); if (bp) {
      const id = bp.dataset.p;
      if (E.buildPart(S, id)) { sfx.tech(); if (id === 'launch') showEnding(); else { toast(L(E.P[id].name)); afterAction(); } } else sfx.no();
      return;
    }
    const bl = t.closest('[data-lang]'); if (bl) { S.settings.lang = bl.dataset.lang; applyLang(); save(); return; }
    const bs = t.closest('[data-snd]'); if (bs) { S.settings.sound = bs.dataset.snd === '1'; save(); return refreshUI(true); }
    if (t.id === 'expBtn') {
      const code = encode(S); $('saveBox').value = code;
      (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(() => toast(tr('copied')), () => { $('saveBox').select(); toast(tr('copyFail')); });
      return;
    }
    if (t.id === 'impBtn') {
      try { S = hydrate(decode($('saveBox').value)); save(); toast(tr('importOk')); applyLang(); } catch (err) { toast(tr('importBad')); }
      return;
    }
    if (t.id === 'resetBtn') {
      if (!resetArmed) { resetArmed = true; return refreshUI(true); }
      const keep = { settings: S.settings }; store.del(); S = E.newState(keep); resetArmed = false; save(); applyLang(); return;
    }
  });
  function afterAction() { save(); refreshUI(true); renderGather(); }

  // ---------- story, achievements, toasts ----------
  const queue = []; let modalOpen = false;
  function showPages(title, pages, btnLast, onDone) {
    let i = 0; modalOpen = true;
    const draw = () => {
      $('modalBox').innerHTML = `<h2>${esc(title)}</h2><p>${esc(pages[i])}</p>${pages.length > 1 ? `<span class="pg">${i + 1}/${pages.length}</span>` : ''}<button class="btn" id="mNext">${i < pages.length - 1 ? tr('next') : btnLast}</button>`;
      $('mNext').onclick = () => { if (i < pages.length - 1) { i++; draw(); blip(660, 0.04); } else { $('modal').hidden = true; modalOpen = false; onDone && onDone(); pump(); } };
      $('mNext').focus();
    };
    $('modal').hidden = false; draw();
  }
  function pump() { if (modalOpen || !queue.length) return; const job = queue.shift(); job(); }
  function checkEvents() {
    E.newStory(S).forEach(st => { S.story[st.id] = true; queue.push(() => showPages(tr('diary'), L(st.text), tr('close'), () => { renderDiary(); refreshUI(true); })); });
    E.newAch(S).forEach(a => { S.ach[a.id] = true; toast(`★ ${tr('achUnlocked')}: ${L(a.name)}`); });
    pump();
  }
  function renderDiary() {
    const last = STORY.filter(e => S.story[e.id]).pop();
    $('diaryLine').className = 'pframe';
    $('diaryLine').innerHTML = last ? `<b>${tr('diary')}:</b>${esc(L(last.text)[L(last.text).length - 1])}` : `<b>${tr('diary')}:</b>${tr('clickHint')}`;
  }
  $('diaryLine').addEventListener('click', () => { tab = 'journal'; refreshUI(true); });
  function toast(msg) {
    const box = $('toasts'); while (box.children.length >= 3) box.firstChild.remove();
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
    $('toasts').appendChild(t); setTimeout(() => t.remove(), 3200);
  }
  function showEnding() {
    save();
    showPages('2026', L(ENDING), tr('newLoop'), () => {
      const { state, gained } = E.finishLoop(S);
      S = state; save(); applyLang();
      toast(`${tr('echo')} +${gained}`);
    });
  }

  // ---------- refresh ----------
  function refreshUI(force) {
    renderRes();
    const th = tabsHtml(); if (force || $('tabs').innerHTML !== th) $('tabs').innerHTML = th;
    if (tab === 'machine' && !E.machineVisible(S)) tab = 'build';
    const html = tab === 'build' ? buildTab() : tab === 'ideas' ? ideasTab() : tab === 'machine' ? machineTab() : tab === 'journal' ? journalTab() : moreTab();
    if (force || html !== lastTabHtml) {
      const box = $('tabBody'), top = box.scrollTop;
      const keepText = tab === 'more' && $('saveBox') ? $('saveBox').value : null;
      box.innerHTML = html; box.scrollTop = top; lastTabHtml = html;
      if (keepText !== null && $('saveBox')) $('saveBox').value = keepText;
    }
  }
  function applyLang() {
    document.documentElement.lang = lang(); document.title = tr('title'); $('gameTitle').textContent = tr('title');
    renderGather(); renderDiary(); refreshUI(true);
  }

  // ---------- main loop ----------
  let lastT = performance.now(), uiT = 0, saveT = 0, gatherT = 0;
  function frame(now) {
    const dt = Math.min(1, (now - lastT) / 1000); lastT = now;
    E.tick(S, dt);
    S.last = Date.now();
    for (const k in fx) if (fx[k] > 0) fx[k] = Math.max(0, fx[k] - dt);
    A.draw(ctx, S, now / 1000, fx);
    uiT += dt; saveT += dt; gatherT += dt;
    if (uiT > 0.25) { uiT = 0; refreshUI(false); checkEvents(); }
    if (gatherT > 2) { gatherT = 0; renderGather(); }
    if (saveT > 10) { saveT = 0; save(); }
    requestAnimationFrame(frame);
  }
  function welcomeBack() {
    const { dt, got } = E.offline(S, Date.now());
    if (dt < 60 || !Object.keys(got).length) return;
    queue.push(() => {
      modalOpen = true;
      $('modalBox').innerHTML = `<h2>${tr('welcomeBack')}</h2><p>${tr('awayFor')}: ${fmtTime(dt)}</p>
        <div class="list">${Object.keys(got).map(r => `<span>${icon(r)}+${fmt(got[r])}</span>`).join('')}</div><button class="btn" id="mNext">${tr('close')}</button>`;
      $('modal').hidden = false;
      $('mNext').onclick = () => { $('modal').hidden = true; modalOpen = false; pump(); };
    });
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); else { welcomeBack(); lastT = performance.now(); pump(); } });
  window.addEventListener('beforeunload', save);

  welcomeBack();
  applyLang();
  checkEvents();
  requestAnimationFrame(frame);
  window.__game = { get state() { return S; }, save };
})();
