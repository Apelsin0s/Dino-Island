// Game controller: screens, input, HUD, notebook (upgrade tree, notes), settings, deaths, saving.
'use strict';
(() => {
  const D = window.DOLLS_DATA, S = window.Sim, V = window.World3D, A = window.Sfx;
  const $ = id => document.getElementById(id);
  const SAVE_KEY = 'million-dolls-v1';

  const T = {
    en: { title: 'Million Dolls', tagline: 'one of them has the key', warnTitle: 'Warning', iUnderstand: 'I understand, continue',
      cont: 'Continue', newGame: 'New game', newSure: 'Click again: your attic will be emptied… and refilled.', coop: 'Co-op', coopSoon: 'Coming with the Steam release: 2–4 players, one watches Mother while the others dig.',
      settings: 'Settings', quit: 'Quit', back: 'Back', resume: 'Resume', toMenu: 'Main menu',
      lang: 'Language', scares: 'Jumpscares', blood: 'Blood', flashes: 'Flashing light', sens: 'Mouse sensitivity', volume: 'Volume', quality: 'Graphics', low: 'Low', medium: 'Medium', high: 'High', on: 'On', off: 'Off',
      clickToPlay: 'Click to play', left: 'dolls left', perSec: '/s', holdDig: 'Hold left mouse — pull dolls', tryDoor: 'E — try the door', doorLocked: 'Locked. The key is somewhere in the pile.', openDoor: 'E — unlock the door',
      tabTree: 'Upgrades', tabNotes: 'Notes', tabStats: 'Record', close: 'Close  [Tab]', maxed: 'max', notFound: 'Not found yet…',
      died: 'MOTHER FOUND YOU', diedText: 'You wake up by the door. Some of your finds are gone.', lost: 'Lost', getUp: 'Get up',
      keyFound: 'THE KEY', keyText: 'Cold. Heavy. It was in a doll\'s mouth. The door is behind you.', chained: 'The chain holds her back… for now.',
      whisper: 'The key is somewhere between doll {a} and {b}', away: 'While you were away the marionettes kept pulling', noPointer: 'Hold the right mouse button to look around',
      statsDug: 'Dolls pulled', statsKills: 'Times she got you', statsTime: 'Time in the attic', statsKeys: 'Wrong keys found', again: 'Climb the stairs',
      controls: 'WASD — walk · Shift — run · Mouse — look · LMB — pull dolls · F — flashlight · Tab — notebook · Esc — pause' },
    ru: { title: 'Миллион кукол', tagline: 'у одной из них ключ', warnTitle: 'Предупреждение', iUnderstand: 'Я понимаю, продолжить',
      cont: 'Продолжить', newGame: 'Новая игра', newSure: 'Нажми ещё раз: чердак опустеет… и снова наполнится.', coop: 'Кооператив', coopSoon: 'Появится с выходом в Steam: 2–4 игрока, один держит Маму взглядом, остальные копают.',
      settings: 'Настройки', quit: 'Выйти', back: 'Назад', resume: 'Продолжить', toMenu: 'Главное меню',
      lang: 'Язык', scares: 'Скримеры', blood: 'Кровь', flashes: 'Вспышки', sens: 'Чувствительность мыши', volume: 'Громкость', quality: 'Графика', low: 'Низкая', medium: 'Средняя', high: 'Высокая', on: 'Вкл', off: 'Выкл',
      clickToPlay: 'Кликни, чтобы играть', left: 'кукол осталось', perSec: '/с', holdDig: 'Держи левую кнопку — вытаскивать кукол', tryDoor: 'E — дёрнуть дверь', doorLocked: 'Заперто. Ключ где-то в куче.', openDoor: 'E — отпереть дверь',
      tabTree: 'Улучшения', tabNotes: 'Записки', tabStats: 'Учёт', close: 'Закрыть  [Tab]', maxed: 'макс', notFound: 'Ещё не найдено…',
      died: 'МАМА НАШЛА ТЕБЯ', diedText: 'Ты приходишь в себя у двери. Часть находок пропала.', lost: 'Потеряно', getUp: 'Встать',
      keyFound: 'КЛЮЧ', keyText: 'Холодный. Тяжёлый. Он был у куклы во рту. Дверь у тебя за спиной.', chained: 'Цепь её удержала… пока что.',
      whisper: 'Ключ где-то между {a}-й и {b}-й куклой', away: 'Пока тебя не было, марионетки продолжали тянуть', noPointer: 'Зажми правую кнопку мыши, чтобы осматриваться',
      statsDug: 'Вытащено кукол', statsKills: 'Сколько раз она тебя поймала', statsTime: 'Времени на чердаке', statsKeys: 'Найдено чужих ключей', again: 'Подняться по лестнице',
      controls: 'WASD — идти · Shift — бежать · Мышь — смотреть · ЛКМ — тянуть кукол · F — фонарик · Tab — блокнот · Esc — пауза' }
  };

  // ---------- state ----------
  const store = { get() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { return null; } }, set(v) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(v)); } catch (e) {} } };
  let saved = store.get(), world, player;
  function fresh(keepSettings) { world = S.newWorld(Math.floor(Math.random() * 1e9)); if (keepSettings) world.settings = keepSettings; player = S.newPlayer('p1'); }
  if (saved && saved.world && saved.world.v === 1) { world = Object.assign(S.newWorld(saved.world.seed), saved.world); world.settings = Object.assign(S.newWorld().settings, saved.world.settings); player = Object.assign(S.newPlayer(), saved.player || {}); }
  else fresh();
  if (!world.settings.lang) world.settings.lang = (navigator.language || 'en').toLowerCase().startsWith('ru') ? 'ru' : 'en';
  const save = () => { world.last = Date.now(); store.set({ world, player }); };
  const tr = (k, v) => { let s = (T[world.settings.lang] || T.en)[k] || k; if (v) for (const x in v) s = s.replace('{' + x + '}', v[x]); return s; };
  const L = o => (o && (o[world.settings.lang] || o.en)) || '';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const big = n => Math.floor(n).toLocaleString(world.settings.lang === 'ru' ? 'ru-RU' : 'en-US');
  function short(n) { if (n < 1000) return n < 10 ? (Math.floor(n * 10) / 10).toString() : Math.floor(n).toString(); const u = ['K', 'M', 'B', 'T']; let i = -1; while (n >= 1000 && i < 3) { n /= 1000; i++; } return n.toFixed(n < 10 ? 2 : 1) + u[i]; }
  const LOOT = Object.fromEntries(D.LOOT.map(l => [l.id, l]));

  // ---------- 3D ----------
  V.init($('stage'), { quality: window.__testQuality || world.settings.quality || 'medium', settings: world.settings });
  A.setVolume(world.settings.volume);
  const canvas = V.canvas();

  // ---------- screens ----------
  let mode = 'menu';   // menu | play | pause | book | dead | ending | warn
  const screen = $('screen');
  function show(html) { screen.innerHTML = html; }
  function warnScreen() {
    mode = 'warn';
    show(`<div class="panel warn"><h2>⚠ ${tr('warnTitle')}</h2>${L(D.WARNING).map(p => `<p>${esc(p)}</p>`).join('')}<button class="mbtn" data-a="warned">${tr('iUnderstand')}</button></div>`);
  }
  function menuScreen(armed) {
    mode = 'menu'; $('hud').hidden = true;
    const started = world.removed > 0 || world.time > 5;
    show(`<div class="panel"><h1 class="title">${tr('title')}<small>${tr('tagline')}</small></h1>
      <div class="menu">
        ${started ? `<button class="mbtn" data-a="play">${tr('cont')}<small>${big(S.remaining(world))} ${tr('left')}</small></button>` : ''}
        <button class="mbtn" data-a="new">${armed ? tr('newSure') : tr('newGame')}</button>
        <button class="mbtn" disabled>${tr('coop')}<small>${tr('coopSoon')}</small></button>
        <button class="mbtn" data-a="settings">${tr('settings')}</button>
        <button class="mbtn" data-a="quit">${tr('quit')}</button>
      </div><p class="note">${tr('controls')}</p></div>`);
    newArmed = !!armed;
  }
  let newArmed = false, settingsFrom = 'menu';
  function settingsScreen(from) {
    settingsFrom = from; mode = 'settings'; const st = world.settings;
    const seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button data-set="${key}" data-v="${v}" class="${String(st[key]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    show(`<div class="panel"><h2 class="title" style="font-size:48px">${tr('settings')}</h2>
      <div class="set">
        <span>${tr('lang')}</span>${seg('lang', [['en', 'English'], ['ru', 'Русский']])}
        <span>${tr('scares')}</span>${seg('scares', [[true, tr('on')], [false, tr('off')]])}
        <span>${tr('blood')}</span>${seg('blood', [[true, tr('on')], [false, tr('off')]])}
        <span>${tr('flashes')}</span>${seg('flashes', [[true, tr('on')], [false, tr('off')]])}
        <span>${tr('quality')}</span>${seg('quality', [['low', tr('low')], ['medium', tr('medium')], ['high', tr('high')]])}
        <label for="sens">${tr('sens')}</label><input id="sens" type="range" min="0.3" max="2.5" step="0.05" value="${st.sens}">
        <label for="vol">${tr('volume')}</label><input id="vol" type="range" min="0" max="1" step="0.05" value="${st.volume}">
      </div><button class="mbtn back" data-a="back">${tr('back')}</button></div>`);
    $('sens').oninput = e => { st.sens = +e.target.value; save(); };
    $('vol').oninput = e => { st.volume = +e.target.value; A.setVolume(st.volume); save(); };
  }
  function pauseScreen() {
    mode = 'pause'; document.exitPointerLock && document.exitPointerLock();
    show(`<div class="panel"><h2 class="title" style="font-size:56px">${tr('title')}</h2><div class="menu">
      <button class="mbtn" data-a="play">${tr('resume')}</button><button class="mbtn" data-a="settingsP">${tr('settings')}</button><button class="mbtn" data-a="menu">${tr('toMenu')}</button></div>
      <p class="note">${tr('controls')}</p></div>`);
  }
  let bookTab = 'tree';
  function bookScreen() {
    mode = 'book'; document.exitPointerLock && document.exitPointerLock();
    const tabs = [['tree', tr('tabTree')], ['notes', tr('tabNotes')], ['stats', tr('tabStats')]];
    show(`<div class="book"><nav>${tabs.map(([k, l]) => `<button data-tab="${k}" class="${bookTab === k ? 'on' : ''}">${l}</button>`).join('')}<span class="sp"></span><button data-a="play">${tr('close')}</button></nav><div class="body" id="bookBody">${bookBody()}</div></div>`);
  }
  function bookBody() {
    if (bookTab === 'notes') return `<div class="notes">${D.NOTES.map((n, i) => world.notes.includes(i) ? `<div class="paper">${esc(L(n))}</div>` : `<div class="paper blank">${tr('notFound')}</div>`).join('')}</div>`;
    if (bookTab === 'stats') return `<div class="stats"><span>${tr('statsDug')}</span><span>${big(world.removed)}</span><span>${tr('statsKills')}</span><span>${world.watcher.kills}</span>
      <span>${tr('statsTime')}</span><span>${Math.floor(world.time / 3600)}:${String(Math.floor(world.time / 60) % 60).padStart(2, '0')}</span><span>${tr('statsKeys')}</span><span>${world.wrongKeys}</span></div>`;
    const CW = 230, CH = 150, minR = Math.min(...D.NODES.map(n => n.pos[1])), X = n => 30 + n.pos[0] * CW, Y = n => 30 + (n.pos[1] - minR) * CH;
    const maxC = Math.max(...D.NODES.map(n => n.pos[0])), maxR = Math.max(...D.NODES.map(n => n.pos[1]));
    let lines = '', cards = '';
    D.NODES.forEach(n => (n.req || []).forEach(r => { const p = S.N[r]; lines += `<line x1="${X(p) + 95}" y1="${Y(p) + 10}" x2="${X(n) + 95}" y2="${Y(n) + 10}" stroke="${S.lv(world, r) ? '#b01818' : '#5a2a22'}" stroke-width="2"/>`; }));
    D.NODES.forEach((n, i) => {
      const vis = S.nodeVisible(world, n.id), L0 = S.lv(world, n.id), max = L0 >= n.max, cost = S.nodeCost(world, n.id), can = vis && !max && S.canAfford(world, cost);
      const r = ((i * 37) % 7 - 3) * 0.6;
      cards += `<button class="card ${!vis ? 'lock' : ''} ${max ? 'max' : ''} ${can ? 'can' : ''}" style="left:${X(n)}px;top:${Y(n)}px;--r:${r}deg" data-node="${n.id}">
        <b>${esc(L(n.name))}</b><span class="lv">${L0}/${n.max}</span><span>${esc(L(n.desc))}</span>
        ${max ? `<span class="cost">${tr('maxed')}</span>` : `<span class="cost">${Object.keys(cost).map(k => `<span class="${world.cur[k] >= cost[k] ? '' : 'no'}">${short(cost[k])} ${esc(L(LOOT[k].name))}</span>`).join('')}</span>`}</button>`;
    });
    const w = 60 + (maxC + 1) * CW, h = 60 + (maxR - minR + 1) * CH;
    return `<div class="board" style="width:${w}px;height:${h}px"><svg width="${w}" height="${h}">${lines}</svg>${cards}</div>`;
  }
  function deathScreen(lost) {
    mode = 'dead'; document.exitPointerLock && document.exitPointerLock();
    show(`<div class="panel death"><h2>${tr('died')}</h2><p>${tr('diedText')}</p>
      <p class="note">${tr('lost')}: ${Object.keys(lost).map(k => `${short(lost[k])} ${esc(L(LOOT[k].name))}`).join(' · ')}</p>
      <button class="mbtn" data-a="play">${tr('getUp')}</button></div>`);
  }
  function endingScreen(i) {
    mode = 'ending'; document.exitPointerLock && document.exitPointerLock();
    const pages = L(D.ENDING);
    show(`<div class="panel death"><p class="big">${esc(pages[i])}</p><button class="mbtn" data-a="${i < pages.length - 1 ? 'endNext' : 'again'}" data-i="${i + 1}">${i < pages.length - 1 ? '…' : tr('again')}</button></div>`);
  }

  screen.addEventListener('click', e => {
    A.unlock();
    const b = e.target.closest('[data-a],[data-set],[data-tab],[data-node]'); if (!b) return;
    if (b.dataset.tab) { bookTab = b.dataset.tab; return bookScreen(); }
    if (b.dataset.node) { if (S.buy(world, b.dataset.node)) { A.find(true); save(); } else A.door(false); return bookScreen(); }
    if (b.dataset.set) {
      const k = b.dataset.set, raw = b.dataset.v, v = raw === 'true' ? true : raw === 'false' ? false : raw;
      world.settings[k] = v; if (k === 'quality') V.setQuality(v); V.setSettings(world.settings); save(); return settingsScreen(settingsFrom);
    }
    const a = b.dataset.a;
    if (a === 'warned') { world.settings.warned = true; save(); return menuScreen(); }
    if (a === 'play') return startPlay();
    if (a === 'new') { if (!newArmed) return menuScreen(true); const st = world.settings; fresh(st); save(); return startPlay(); }
    if (a === 'settings') return settingsScreen('menu');
    if (a === 'settingsP') return settingsScreen('pause');
    if (a === 'back') return settingsFrom === 'pause' ? pauseScreen() : menuScreen();
    if (a === 'menu') return menuScreen();
    if (a === 'quit') { save(); window.close(); return; }
    if (a === 'endNext') return endingScreen(+b.dataset.i);
    if (a === 'again') { const st = world.settings; fresh(st); save(); return startPlay(); }
  });

  // ---------- input ----------
  const keys = {}; let mouseDown = false, rmb = false, locked = false, lockFailed = false;
  function startPlay() {
    mode = 'play'; show(''); $('hud').hidden = false; A.unlock();
    try { const r = canvas.requestPointerLock && canvas.requestPointerLock(); if (r && r.catch) r.catch(() => { lockFailed = true; toast(tr('noPointer')); }); } catch (e) { lockFailed = true; }
  }
  document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvas; if (!locked && mode === 'play' && !lockFailed) pauseScreen(); });
  canvas.addEventListener('click', () => { if (mode === 'play' && !locked && !lockFailed) startPlay(); });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('mousedown', e => { if (mode !== 'play') return; if (e.button === 0) mouseDown = true; if (e.button === 2) rmb = true; });
  window.addEventListener('mouseup', e => { if (e.button === 0) mouseDown = false; if (e.button === 2) rmb = false; });
  window.addEventListener('mousemove', e => {
    if (mode !== 'play' || player.stun > 0) return;
    if (!locked && !(lockFailed && rmb)) return;
    const k = 0.0022 * world.settings.sens; player.yaw -= e.movementX * k; player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - e.movementY * k));
  });
  window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Tab') { e.preventDefault(); if (mode === 'play') bookScreen(); else if (mode === 'book') startPlay(); return; }
    if (e.code === 'Escape' && mode === 'book') return startPlay();
    if (mode !== 'play') return;
    if (e.code === 'KeyF') { if (player.battery > 0.02) player.light = !player.light; A.dig(); }
    if (e.code === 'KeyE' && sense && sense.target === 'door') tryDoor();
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouseDown = false; });

  function tryDoor() {
    if (world.keyFound) { A.door(true); world.escaped = true; save(); endingScreen(0); }
    else { A.door(false); toast(tr('doorLocked')); }
  }

  // ---------- HUD ----------
  function toast(msg) { const box = $('toasts'); while (box.children.length > 3) box.firstChild.remove(); const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; box.appendChild(t); setTimeout(() => t.remove(), 9000); }
  function floater(text) { const f = document.createElement('div'); f.className = 'fl'; f.textContent = text; f.style.setProperty('--dx', (Math.random() * 120 - 60) + 'px'); $('floaters').appendChild(f); setTimeout(() => f.remove(), 1100); }
  let hudT = 0;
  function renderHud() {
    $('countNum').textContent = big(S.remaining(world));
    const rate = (player.digging ? S.digRate(world) : 0) + S.autoRate(world);
    $('countSub').textContent = `${tr('left')} · −${rate < 10 ? rate.toFixed(1) : Math.round(rate)}${tr('perSec')}`;
    $('loot').innerHTML = D.LOOT.filter(l => world.total[l.id] > 0).map(l => `<div>${short(world.cur[l.id])} <span>${esc(L(l.name))}</span></div>`).join('');
    $('batFill').style.width = Math.round(player.battery * 100) + '%';
    const h = !sense ? '' : sense.target === 'pile' ? tr('holdDig') : sense.target === 'door' ? (world.keyFound ? tr('openDoor') : tr('tryDoor')) : '';
    $('hint').textContent = h;
    const kh = S.keyHint(world); $('whisper').hidden = !kh; if (kh) $('whisper').textContent = tr('whisper', { a: big(kh.from), b: big(kh.to) });
  }

  // ---------- loop ----------
  let last = performance.now(), saveT = 0, sense = null, bellT = 0, stepT = 0, visT = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; const t = now / 1000;
    if (mode === 'play') {
      // movement
      const run = keys.ShiftLeft || keys.ShiftRight, sp = (run ? 4.2 : 2.4) * (player.stun > 0 ? 0 : 1);
      let f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0), r = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
      if (lockFailed) { if (keys.KeyQ) player.yaw += dt * 2; if (keys.KeyE && !(sense && sense.target === 'door')) player.yaw -= dt * 2; }
      const len = Math.hypot(f, r) || 1; f /= len; r /= len;
      const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
      player.x += (-sy * f + cy * r) * sp * dt; player.z += (-cy * f - sy * r) * sp * dt; V.collide(player);
      const moving = Math.abs(f) + Math.abs(r) > 0;
      player.bob = moving ? Math.sin(t * (run ? 13 : 8)) * (run ? 0.045 : 0.025) : 0;
      if (moving) { stepT -= dt; if (stepT <= 0) { A.step((Math.random() - 0.5) * 0.3, run ? 0.07 : 0.035); stepT = run ? 0.32 : 0.5; } }
      player.digging = mouseDown && sense && sense.target === 'pile' && player.stun <= 0;
    } else player.digging = false;
    // render + sense, then simulate
    sense = V.update(world, player, t, dt);
    const paused = mode === 'menu' || mode === 'warn' || mode === 'settings' && settingsFrom === 'menu' || mode === 'ending';
    if (!paused) {
      const out = S.step(world, [player], dt, { watched: [sense.sees], litAtWatcher: sense.litAtWatcher });
      // visuals for pulled dolls
      if (out.pulled) { visT += Math.min(out.pulled, 6); while (visT >= 1) { V.launchDoll(); visT--; } if (player.digging) { A.dig(); if (Math.random() < 0.15) A.rip(); } }
      if (player.digging && out.pulled) { const k = Object.keys(out.loot); if (k.length && Math.random() < 0.35) { const id = k[Math.floor(Math.random() * k.length)]; floater(`+${short(out.loot[id])} ${L(LOOT[id].name)}`); } }
      out.notes.forEach(i => { toast(L(D.NOTES[i])); A.whisper(0); });
      if (out.key) { toast(`${tr('keyFound')}. ${tr('keyText')}`); A.find(true); A.sting(); save(); }
      out.events.forEach(ev => {
        if (ev.chained) { toast(tr('chained')); A.bell(0); }
        if (ev.kill) {
          const lost = S.killed(world, player); save();
          if (world.settings.scares) A.scream(); else A.sting();
          mode = 'dying'; document.exitPointerLock && document.exitPointerLock();
          V.jumpscare(world.settings.scares, () => deathScreen(lost));
        }
      });
      // Mother moving: footsteps/creaks behind you, bell if owned
      if (world.watcher.moving) {
        bellT -= dt;
        if (bellT <= 0) { const pan = Math.max(-1, Math.min(1, -Math.sin(sense.bellDir))); A.creak(pan, 0.05 + sense.fear * 0.08); if (S.stats(world).bell) A.bell(pan); bellT = 0.9 + Math.random() * 0.6; }
      }
      const bell = $('bell'); bell.hidden = !(S.stats(world).bell && world.watcher.moving && mode === 'play');
      if (!bell.hidden) { const a = -sense.bellDir; bell.style.transform = `translate(${Math.sin(a) * 110 - 11}px, ${-Math.cos(a) * 110 - 11}px)`; }
    }
    A.update(mode === 'play' ? sense.fear : 0, t);
    hudT += dt; if (hudT > 0.12 && mode === 'play') { hudT = 0; renderHud(); }
    saveT += dt; if (saveT > 10 && !paused) { saveT = 0; save(); }
    requestAnimationFrame(frame);
  }

  // ---------- boot ----------
  const off = S.offline(world, Date.now());
  if (off && off.pulled) setTimeout(() => toast(`${tr('away')}: −${big(off.pulled)}`), 1500);
  window.addEventListener('beforeunload', save);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { save(); if (mode === 'play') pauseScreen(); } });
  if (!world.settings.warned) warnScreen(); else menuScreen();
  requestAnimationFrame(frame);
  window.__dolls = { get world() { return world; }, get player() { return player; }, save, startPlay, bookScreen };
})();
