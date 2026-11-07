// Game controller: screens, input, HUD, notebook (upgrade tree, notes), settings, deaths, saving.
'use strict';
(() => {
  const D = window.DOLLS_DATA, S = window.Sim, V = window.World3D, A = window.Sfx;
  const $ = id => document.getElementById(id);
  const SAVE_KEY = 'million-dolls-v2';

  const T = {
    en: { title: 'Million Dolls', tagline: 'one of them has the key', warnTitle: 'Warning', iUnderstand: 'I understand, continue',
      cont: 'Continue', newGame: 'New game', newSure: 'Click again: your attic will be emptied… and refilled.', coop: 'Co-op', coopSoon: 'Coming with the Steam release: 2–4 players, one watches Mother while the others dig.',
      settings: 'Settings', quit: 'Quit', back: 'Back', resume: 'Resume', toMenu: 'Main menu',
      lang: 'Language', scares: 'Jumpscares', blood: 'Blood', flashes: 'Flashing light', sens: 'Mouse sensitivity', volume: 'Volume', quality: 'Graphics', low: 'Low', medium: 'Medium', high: 'High', on: 'On', off: 'Off',
      clickToPlay: 'Click to play', left: 'dolls left', perSec: '/s', holdDig: 'Hold left mouse — pull dolls', tryDoor: 'E — try the door', doorLocked: 'Locked. Three locks. The bone key is somewhere deep in the pile.', openDoor: 'E — unlock the door',
      tabTree: 'Upgrades', tabNotes: 'Notes', tabStats: 'Record', close: 'Close  [Tab]', maxed: 'max', notFound: 'Not found yet…',
      died: 'MOTHER FOUND YOU', diedText: 'You wake up by the door. Some of your finds are gone.', lost: 'Lost', getUp: 'Get up',
      keyFound: 'THE KEY', keyText: 'Cold. Heavy. It was in a doll\'s mouth. The door is behind you.', chained: 'The chain holds her back… for now.',
      whisper: 'The key is somewhere between doll {a} and {b}', away: 'While you were away the marionettes kept pulling', noPointer: 'Hold the right mouse button to look around',
      statsDug: 'Dolls pulled', statsKills: 'Times she got you', statsTime: 'Time in the attic', statsKeys: 'Wrong keys found', again: 'Climb the stairs', keys: 'Keys', burned: 'Burned out. It left something behind', grabbed: 'It pulled your hand into the pile', escaped: 'You pulled away in time', music: 'The music box plays. She stands still and listens.', musicWait: 'The music box needs to rewind', chased: 'You drove it off. It dropped something',
      controls: 'WASD — walk · Shift — run · Mouse — look · LMB — pull dolls · F — flashlight · M — music box · Tab — notebook · Esc — pause' },
    ru: { title: 'Миллион кукол', tagline: 'у одной из них ключ', warnTitle: 'Предупреждение', iUnderstand: 'Я понимаю, продолжить',
      cont: 'Продолжить', newGame: 'Новая игра', newSure: 'Нажми ещё раз: чердак опустеет… и снова наполнится.', coop: 'Кооператив', coopSoon: 'Появится с выходом в Steam: 2–4 игрока, один держит Маму взглядом, остальные копают.',
      settings: 'Настройки', quit: 'Выйти', back: 'Назад', resume: 'Продолжить', toMenu: 'Главное меню',
      lang: 'Язык', scares: 'Скримеры', blood: 'Кровь', flashes: 'Вспышки', sens: 'Чувствительность мыши', volume: 'Громкость', quality: 'Графика', low: 'Низкая', medium: 'Средняя', high: 'Высокая', on: 'Вкл', off: 'Выкл',
      clickToPlay: 'Кликни, чтобы играть', left: 'кукол осталось', perSec: '/с', holdDig: 'Держи левую кнопку — вытаскивать кукол', tryDoor: 'E — дёрнуть дверь', doorLocked: 'Заперто. Три замка. Костяной ключ где-то глубоко в куче.', openDoor: 'E — отпереть дверь',
      tabTree: 'Улучшения', tabNotes: 'Записки', tabStats: 'Учёт', close: 'Закрыть  [Tab]', maxed: 'макс', notFound: 'Ещё не найдено…',
      died: 'МАМА НАШЛА ТЕБЯ', diedText: 'Ты приходишь в себя у двери. Часть находок пропала.', lost: 'Потеряно', getUp: 'Встать',
      keyFound: 'КЛЮЧ', keyText: 'Холодный. Тяжёлый. Он был у куклы во рту. Дверь у тебя за спиной.', chained: 'Цепь её удержала… пока что.',
      whisper: 'Ключ где-то между {a}-й и {b}-й куклой', away: 'Пока тебя не было, марионетки продолжали тянуть', noPointer: 'Зажми правую кнопку мыши, чтобы осматриваться',
      statsDug: 'Вытащено кукол', statsKills: 'Сколько раз она тебя поймала', statsTime: 'Времени на чердаке', statsKeys: 'Найдено чужих ключей', again: 'Подняться по лестнице', keys: 'Ключи', burned: 'Глаза выжжены. Кукла что-то оставила', grabbed: 'Рука затянула тебя в кучу', escaped: 'Ты успел отдёрнуть руку', music: 'Играет шкатулка. Она замерла и слушает.', musicWait: 'Шкатулку нужно завести', chased: 'Ты его спугнул. Оно что-то уронило',
      controls: 'WASD — идти · Shift — бежать · Мышь — смотреть · ЛКМ — тянуть кукол · F — фонарик · M — шкатулка · Tab — блокнот · Esc — пауза' }
  };

  // ---------- state ----------
  const store = { get() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { return null; } }, set(v) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(v)); } catch (e) {} } };
  let saved = store.get(), world, player;
  function fresh(keepSettings) { world = S.newWorld(Math.floor(Math.random() * 1e9)); if (keepSettings) world.settings = keepSettings; player = S.newPlayer('p1'); }
  if (saved && saved.world && saved.world.v === 2) { world = Object.assign(S.newWorld(saved.world.seed), saved.world); world.settings = Object.assign(S.newWorld().settings, saved.world.settings); player = Object.assign(S.newPlayer(), saved.player || {}); }
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
    if (e.code === 'KeyM' && S.stats(world).music) { if (S.playMusic(world)) { toast(tr('music')); A.lullaby(); } else toast(tr('musicWait')); }
    if (e.code === 'KeyE' && sense && sense.target === 'door') tryDoor();
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouseDown = false; });

  function tryDoor() {
    if (world.keys >= 3) { A.door(true); world.escaped = true; save(); endingScreen(0); }
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
    $('loot').innerHTML = `<div>${world.keys}/3 <span>${tr('keys')}</span></div>` + D.LOOT.filter(l => world.total[l.id] > 0).map(l => `<div>${short(world.cur[l.id])} <span>${esc(L(l.name))}</span></div>`).join('');
    $('batFill').style.width = Math.round(player.battery * 100) + '%';
    const h = !sense ? '' : sense.target === 'pile' ? tr('holdDig') : sense.target === 'door' ? (world.keys >= 3 ? tr('openDoor') : tr('tryDoor')) : '';
    $('hint').textContent = h;
    const kh = S.keyHint(world); $('whisper').hidden = !kh; if (kh) $('whisper').textContent = tr('whisper', { a: big(kh.from), b: big(kh.to) });
  }

  // ---------- scare director ----------
  // Something horrible happens every 20–50 s. Scares never take progress, but they interrupt, and the brave get paid.
  const rr = (a, b) => a + Math.random() * (b - a);
  let scare = null, nextScare = 40;
  const scared = () => world.settings.scares;
  function daze(sec) { player.daze = Math.max(player.daze, sec * (1 - S.stats(world).nerves)); }
  function nonFatal(kind, sec) { if (scared()) A.scream(); else A.sting(); daze(sec); V.jumpscare(scared(), null, kind, false); world.scares++; }
  function pay(dolls, msg) { const loot = S.bounty(world, dolls); const k = Object.keys(loot); toast(`${tr(msg)}: ` + k.map(id => `+${short(loot[id])} ${L(LOOT[id].name)}`).join(', ')); A.find(true); }
  function endScare() {
    if (!scare) return; const k = scare.kind;
    if (k === 'eyes') V.scare.eyesOff(); if (k === 'crawler') V.scare.crawlerOff(); if (k === 'hand') V.scare.handOff(); if (k === 'drip') V.scare.dripOff();
    if (k === 'look') V.scare.lookStop(); if (k === 'blackout') V.scare.apparition(false); if (k === 'writing') {}
    scare = null; nextScare = rr(20, 48) * (1 - S.depth(world) * 0.35);
  }
  function pickScare() {
    const d = S.depth(world), pileDist = Math.hypot(player.x - S.PILE_POS.x, player.z - S.PILE_POS.z);
    const pool = [['eyes', 3], ['drip', world.settings.blood ? 2 : 0], ['fall', 1.5], ['child', 1.5], ['writing', 1.5], ['look', pileDist < 13 ? 2 : 0],
      ['crawler', d > 0.03 ? 2.5 : 0], ['blackout', d > 0.06 ? 1.5 : 0], ['hand', player.digging && d > 0.1 ? 3 : 0]];
    let sum = pool.reduce((a, p) => a + p[1], 0), x = Math.random() * sum;
    for (const [k, w] of pool) { x -= w; if (x <= 0) return k; } return 'eyes';
  }
  function startScare(kind) {
    const B = S.bounds(world), yaw = player.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    scare = { kind, t: 0 };
    if (kind === 'eyes') { const p = V.scare.eyesOn(S.roomsOpen(world)); if (!p) return endScare(); scare.p = p; scare.burn = 0; A.whisper(0); }
    if (kind === 'crawler') { const side = Math.random() < 0.5 ? -1 : 1, dir = Math.random() < 0.5 ? 1 : -1; const z0 = Math.max(B.minZ, Math.min(B.maxZ, player.z - dir * 14)), z1 = player.z + dir * 14; V.scare.crawlerStart(z0, z1, side); scare.seen = false; scare.over = false; }
    if (kind === 'drip') { const x = Math.max(B.minX + 1, Math.min(B.maxX - 1, player.x + fx * 1.6 + rr(-0.6, 0.6))), z = Math.max(B.minZ + 1, Math.min(B.maxZ - 1, player.z + fz * 1.6)); V.scare.dripStart(x, z); if (Math.random() < 0.5) V.scare.writing(L(D.WRITINGS)[Math.floor(Math.random() * 8)]); }
    if (kind === 'fall') { const x = Math.max(B.minX + 0.5, Math.min(B.maxX - 0.5, player.x + fx * 1.3)), z = Math.max(B.minZ + 0.5, Math.min(B.maxZ - 0.5, player.z + fz * 1.3)); V.scare.fall(x, z); }
    if (kind === 'child') { const px = player.x + fx * 8, pz = player.z + fz * 8, sx = -fz, sz = fx; V.scare.childRun(px - sx * 6, pz - sz * 6, px + sx * 6, pz + sz * 6); A.giggle(0); }
    if (kind === 'writing') { if (!V.scare.writing(L(D.WRITINGS)[Math.floor(Math.random() * 8)])) return endScare(); A.whisper(0); }
    if (kind === 'look') { V.scare.lookStart(); A.whisper(-0.5); A.whisper(0.5); }
    if (kind === 'blackout') { V.scare.forceDark(2.6); A.creak(0, 0.12); }
    if (kind === 'hand') { V.scare.handStart(player); A.rip(); }
  }
  function director(dt, out) {
    if (mode !== 'play' || player.stun > 0) return;
    if (!scare) { if (world.time < 35) return; nextScare -= dt; if (nextScare <= 0) startScare(pickScare()); return; }
    scare.t += dt; const k = scare.kind, t = scare.t;
    if (k === 'eyes') {
      const d = Math.hypot(player.x - scare.p.x, player.z - scare.p.z);
      if (d < 2.0) { endScare(); return nonFatal('doll', 1.4); }
      if (V.visible(scare.p.x, scare.p.y, scare.p.z, player) && player.light) { scare.burn += dt; if (scare.burn > 2) { endScare(); return pay(500 + S.depth(world) * 4000, 'burned'); } }
      if (Math.random() < dt * 0.4) A.whisper((scare.p.x - player.x) > 0 ? 0.6 : -0.6);
      if (t > 40) endScare();
    } else if (k === 'crawler') {
      const p = V.scare.crawlerPos(); if (!p) return endScare();
      if (!scare.seen && V.visible(p.x, p.y, p.z, player)) { scare.seen = true; V.scare.crawlerSet('freeze'); A.screech(); setTimeout(() => V.scare.crawlerSet('flee'), 700); pay(350 + S.depth(world) * 3000, 'chased'); }
      if (!scare.seen && !scare.over && Math.abs(p.z - player.z) < 1.2) { scare.over = true; A.creak(0, 0.15); if (Math.random() < 0.4) { V.scare.crawlerOff(); endScare(); return nonFatal('crawler', 1.2); } }
      if (Math.random() < dt * 3) A.step(Math.max(-1, Math.min(1, (p.x - player.x) / 5)), 0.03);
    } else if (k === 'drip') { if (out && sense.dripSplash) A.drip(); if (t > 18) endScare(); }
    else if (k === 'fall') { if (sense.landed) { A.thud(); if (scared()) A.sting(); daze(0.5); endScare(); } if (t > 4) endScare(); }
    else if (k === 'child') { if (Math.random() < dt * 5) A.step(0, 0.02); if (t > 2.5) endScare(); }
    else if (k === 'writing') { if (t > 17) endScare(); }
    else if (k === 'look') { if (t > 7) endScare(); }
    else if (k === 'blackout') { if (t > 2.6 && !scare.app) { scare.app = true; V.scare.apparition(true); if (scared()) A.scream(); else A.sting(); } if (t > 3.0) endScare(); }
    else if (k === 'hand') {
      if (t > 1.5 && !scare.done) {
        scare.done = true; const near = Math.hypot(player.x - S.PILE_POS.x, player.z - S.PILE_POS.z) < S.PILE_POS.x + 9;
        if (player.digging && near && !S.stats(world).gloves) { toast(tr('grabbed')); if (world.settings.blood) V.addBlood(player.x, player.z, 0.5); nonFatal('doll', 2.2); }
        else pay(200 + S.depth(world) * 2000, 'escaped');
      }
      if (t > 2.4) endScare();
    }
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
      const prev = { x: player.x, z: player.z }; player.x += (-sy * f + cy * r) * sp * dt; player.z += (-cy * f - sy * r) * sp * dt; V.collide(player, world, prev);
      const moving = Math.abs(f) + Math.abs(r) > 0;
      player.bob = moving ? Math.sin(t * (run ? 13 : 8)) * (run ? 0.045 : 0.025) : 0;
      if (moving) { stepT -= dt; if (stepT <= 0) { A.step((Math.random() - 0.5) * 0.3, run ? 0.07 : 0.035); stepT = run ? 0.32 : 0.5; } }
      player.digging = mouseDown && sense && sense.target === 'pile' && player.stun <= 0 && player.daze <= 0;
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
      out.keys.forEach(k => { const K = D.KEYS[k]; toast(`${L(K.name)}. ${L(K.text)}`); A.find(true); A.sting(); setTimeout(() => A.creak(0, 0.2), 1500); save(); });
      director(dt, out);
      out.events.forEach(ev => {
        if (ev.chained) { toast(tr('chained')); A.bell(0); }
        if (ev.kill) {
          const lost = S.killed(world, player); save();
          if (world.settings.scares) A.scream(); else A.sting();
          mode = 'dying'; document.exitPointerLock && document.exitPointerLock();
          endScare(); V.jumpscare(world.settings.scares, () => deathScreen(lost), 'mother', true);
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
  window.__dolls = { get world() { return world; }, get player() { return player; }, save, startPlay, bookScreen, force: k => startScare(k), endForce: () => endScare(), scareState: () => scare };
})();
