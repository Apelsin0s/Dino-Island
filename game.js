// Game controller: screens, input, HUD, notebook (upgrade tree, notes), settings, deaths, saving.
'use strict';
(() => {
  const D = window.DOLLS_DATA, S = window.Sim, V = window.World3D, A = window.Sfx, Net = window.Net;
  const $ = id => document.getElementById(id);
  const SAVE_KEY = 'million-dolls-v3', SETTINGS_KEY = 'million-dolls-settings';

  const T = {
    en: { title: 'Million Dolls', tagline: 'one of them has the key', warnTitle: 'Warning', iUnderstand: 'I understand, continue',
      cont: 'Continue', newGame: 'New game', newSure: 'Click again: your attic will be emptied… and refilled.', coop: 'Co-op', coopSoon: 'Up to 5 players, a room with a password',
      settings: 'Settings', quit: 'Quit', back: 'Back', resume: 'Resume', toMenu: 'Main menu',
      lang: 'Language', scares: 'Jumpscares', blood: 'Blood', flashes: 'Flashing light', sens: 'Mouse sensitivity', volume: 'Volume', quality: 'Graphics', low: 'Low', medium: 'Medium', high: 'High', on: 'On', off: 'Off',
      clickToPlay: 'Click to play', left: 'dolls left', perSec: '/s', holdDig: 'Hold left mouse — pull dolls', tryDoor: 'E — try the door', doorLocked: 'Locked. Three locks. The bone key is somewhere deep in the pile.', openDoor: 'E — unlock the door',
      tabTree: 'Upgrades', tabNotes: 'Notes', tabStats: 'Record', close: 'Close  [Tab]', maxed: 'max', notFound: 'Not found yet…',
      died: 'MOTHER FOUND YOU', diedText: 'You wake up by the door. Some of your finds are gone.', lost: 'Lost', getUp: 'Get up',
      keyFound: 'THE KEY', keyText: 'Cold. Heavy. It was in a doll\'s mouth. The door is behind you.', chained: 'The chain holds her back… for now.',
      whisper: 'The key is somewhere between doll {a} and {b}', away: 'While you were away the marionettes kept pulling', noPointer: 'Hold the right mouse button to look around',
      statsDug: 'Dolls pulled', statsKills: 'Times she got you', statsTime: 'Time in the attic', statsKeys: 'Wrong keys found', again: 'Climb the stairs', keys: 'Keys', burned: 'Burned out. It left something behind', grabbed: 'It pulled your hand into the pile', escaped: 'You pulled away in time', music: 'The music box plays. She stands still and listens.', musicWait: 'The music box needs to rewind', chased: 'You drove it off. It dropped something', lootTitle: 'What the dolls hide', lootNow: 'from the start', lootFrom: 'from doll {n}', lootLeft: '{n} to go', grabbed2: 'SHE HAS YOU — TYPE', grabOther: 'She has {n}! Look at her, shine on her!', grabOk: 'She let go and crawled away', repelled: 'She sees you watching. She backs off', take: 'E — take: {n}', found: 'Found: {n}', weaponGot: '{n} — press {k} to use', weaponMiss: 'Missed. She has to be in front of you, close enough', weaponCd: 'Not ready yet: {s} s', weaponHit: '{w}: she shrieks', flared: 'The flare burns red. She will not come near it', broke: 'She falls apart. Porcelain everywhere. It will not last', mended: 'Somewhere in the dark, porcelain clicks back together', votes: 'votes', voteHint: 'Click to vote. Bought when most of the room agrees', bought: 'The room agreed: {n}', roomLoaded: 'Loaded the room\'s latest save from {n}', roomNew: 'A new attic for this room', createdInstead: 'Nobody is in this room right now (or the password is different), so you opened it. Friends can join you now.', roomSaved: 'Room saved for everyone', eggs: 'Easter eggs', motherHp: 'Mother', lever: 'E / click — pull the lever (save)', coopTitle: 'Co-op', coopIntro: 'Up to 5 players in one attic. The room has its own save: whoever creates the room next time, you continue where you stopped. Upgrades are chosen by vote. Keep someone watching her: she can only hurt you when nobody is.', nick: 'Your name', roomName: 'Room name', roomPass: 'Room password', create: 'Create room', joinRoom: 'Join room', connecting: 'Connecting…', errExists: 'A room with this name and password already exists. Choose another name.', errNotFound: 'Room not found, or the password is wrong.', errFull: 'The room is full (5 players).', errNetwork: 'Could not reach the co-op server. Check the internet connection.', errOffline: 'Co-op is not available here (no network library).', errFill: 'Enter a name, a room name and a password.', joined: '{n} came into the attic', leftRoom: '{n} left the attic', hostLeft: 'The host left. You are back in your own attic.', inRoom: 'Room', leaveRoom: 'Leave room', diedCoop: 'You wake up at the lever. The team lost some of its finds.', fellNamed: 'She got {n}', hostNote: 'Keep this window open: your game runs the attic for everyone.', saved: 'Saved. Every bulb flares: she is blinded for a while', savedWait: 'Saved. The bulbs need {s} s to cool before they can blind her again', hit: 'She touched you. Health and strength drain away', noEnergy: 'No strength left to dig. Pull the lever by the door to recover', diedCp: 'You wake up at the lever. Everything since your last save is gone.', noticed: 'She has seen you', noTorch: 'You have no flashlight. Find buttons in the pile and buy it in the notebook [Tab].', firstHint: 'Dig by the candle. Buy a flashlight for 45 buttons [Tab]. Digging takes strength; the lever by the door saves, heals and blinds her. Keep away from her.', didntTurn: 'You did not turn around. The breathing stopped. Something fell at your feet', stayedDown: 'You did not look up. It crawled away and dropped something',
      controls: 'WASD — walk · Shift — run · Mouse — look · LMB — pull dolls · E — lever / door / take · 1–4 — weapons · F — flashlight · M — music box · Tab — notebook · Esc — pause' },
    ru: { title: 'Миллион кукол', tagline: 'у одной из них ключ', warnTitle: 'Предупреждение', iUnderstand: 'Я понимаю, продолжить',
      cont: 'Продолжить', newGame: 'Новая игра', newSure: 'Нажми ещё раз: чердак опустеет… и снова наполнится.', coop: 'Кооператив', coopSoon: 'До 5 игроков, комната с паролем', coopSoonOld: 'Появится с выходом в Steam: 2–4 игрока, один держит Маму взглядом, остальные копают.',
      settings: 'Настройки', quit: 'Выйти', back: 'Назад', resume: 'Продолжить', toMenu: 'Главное меню',
      lang: 'Язык', scares: 'Скримеры', blood: 'Кровь', flashes: 'Вспышки', sens: 'Чувствительность мыши', volume: 'Громкость', quality: 'Графика', low: 'Низкая', medium: 'Средняя', high: 'Высокая', on: 'Вкл', off: 'Выкл',
      clickToPlay: 'Кликни, чтобы играть', left: 'кукол осталось', perSec: '/с', holdDig: 'Держи левую кнопку — вытаскивать кукол', tryDoor: 'E — дёрнуть дверь', doorLocked: 'Заперто. Три замка. Костяной ключ где-то глубоко в куче.', openDoor: 'E — отпереть дверь',
      tabTree: 'Улучшения', tabNotes: 'Записки', tabStats: 'Учёт', close: 'Закрыть  [Tab]', maxed: 'макс', notFound: 'Ещё не найдено…',
      died: 'МАМА НАШЛА ТЕБЯ', diedText: 'Ты приходишь в себя у двери. Часть находок пропала.', lost: 'Потеряно', getUp: 'Встать',
      keyFound: 'КЛЮЧ', keyText: 'Холодный. Тяжёлый. Он был у куклы во рту. Дверь у тебя за спиной.', chained: 'Цепь её удержала… пока что.',
      whisper: 'Ключ где-то между {a}-й и {b}-й куклой', away: 'Пока тебя не было, марионетки продолжали тянуть', noPointer: 'Зажми правую кнопку мыши, чтобы осматриваться',
      statsDug: 'Вытащено кукол', statsKills: 'Сколько раз она тебя поймала', statsTime: 'Времени на чердаке', statsKeys: 'Найдено чужих ключей', again: 'Подняться по лестнице', keys: 'Ключи', burned: 'Глаза выжжены. Кукла что-то оставила', grabbed: 'Рука затянула тебя в кучу', escaped: 'Ты успел отдёрнуть руку', music: 'Играет шкатулка. Она замерла и слушает.', musicWait: 'Шкатулку нужно завести', chased: 'Ты его спугнул. Оно что-то уронило', lootTitle: 'Что прячут куклы', lootNow: 'сразу', lootFrom: 'с {n}-й куклы', lootLeft: 'ещё {n}', grabbed2: 'ОНА СХВАТИЛА ТЕБЯ — НАБЕРИ', grabOther: 'Она схватила {n}! Посмотрите на неё, посветите!', grabOk: 'Она отпустила и уползла', repelled: 'Она видит, что на неё смотрят. Отступает', take: 'E — взять: {n}', found: 'Найдено: {n}', weaponGot: '{n} — клавиша {k}', weaponMiss: 'Мимо. Она должна быть перед тобой и достаточно близко', weaponCd: 'Ещё не готово: {s} с', weaponHit: '{w}: она визжит', flared: 'Фальшфейер горит красным. К нему она не подойдёт', broke: 'Она рассыпалась. Фарфор повсюду. Это ненадолго', mended: 'Где-то в темноте фарфор со щелчками собирается обратно', votes: 'голоса', voteHint: 'Клик — голос. Покупается, когда согласно большинство', bought: 'Комната решила: {n}', roomLoaded: 'Загружено последнее сохранение комнаты от {n}', roomNew: 'Новый чердак для этой комнаты', createdInstead: 'В этой комнате сейчас никого нет (или пароль другой), поэтому ты её открыл. Друзья могут заходить.', roomSaved: 'Комната сохранена для всех', eggs: 'Пасхалки', motherHp: 'Мать', lever: 'E / клик — дёрнуть рычаг (сохранение)', coopTitle: 'Кооператив', coopIntro: 'До 5 игроков на одном чердаке. У комнаты своё сохранение: кто бы ни создал её в следующий раз, вы продолжите с того места, где остановились. Улучшения выбираются голосованием. Пусть кто-то всегда следит за ней: она ранит, только когда на неё никто не смотрит.', nick: 'Твоё имя', roomName: 'Название комнаты', roomPass: 'Пароль комнаты', create: 'Создать комнату', joinRoom: 'Войти в комнату', connecting: 'Подключение…', errExists: 'Комната с таким названием и паролем уже есть. Выбери другое название.', errNotFound: 'Комната не найдена или пароль неверный.', errFull: 'Комната заполнена (5 игроков).', errNetwork: 'Не удалось связаться с сервером кооператива. Проверь интернет.', errOffline: 'Кооператив здесь недоступен (нет сетевой библиотеки).', errFill: 'Введи имя, название комнаты и пароль.', joined: '{n} поднимается на чердак', leftRoom: '{n} ушёл с чердака', hostLeft: 'Хозяин комнаты вышел. Ты снова на своём чердаке.', inRoom: 'Комната', leaveRoom: 'Выйти из комнаты', diedCoop: 'Ты приходишь в себя у рычага. Команда потеряла часть находок.', fellNamed: 'Она схватила игрока {n}', hostNote: 'Не закрывай это окно: твоя игра ведёт чердак для всех.', saved: 'Сохранено. Все лампы вспыхнули: она ослеплена на время', savedWait: 'Сохранено. Лампам нужно {s} с, чтобы снова ослепить её', hit: 'Она коснулась тебя. Уходят здоровье и силы', noEnergy: 'Нет сил копать. Дёрни рычаг у двери, чтобы восстановиться', diedCp: 'Ты приходишь в себя у рычага. Всё, что было после сохранения, пропало.', noticed: 'Она тебя увидела', noTorch: 'У тебя нет фонарика. Собери пуговицы в куче и купи его в блокноте [Tab].', firstHint: 'Копай у свечи. Фонарик — 45 пуговиц [Tab]. Копание тратит силы; рычаг у двери сохраняет, лечит и ослепляет её. Не подходи к ней.', didntTurn: 'Ты не обернулся. Дыхание стихло. У твоих ног что-то упало', stayedDown: 'Ты не поднял голову. Оно уползло и что-то уронило',
      controls: 'WASD — идти · Shift — бежать · Мышь — смотреть · ЛКМ — тянуть кукол · E — рычаг / дверь / взять · 1–4 — оружие · F — фонарик · M — шкатулка · Tab — блокнот · Esc — пауза' }
  };

  // ---------- state ----------
  // older saves: fill in fields added later (the watcher is replaced whole by Object.assign)
  function fixWorld(base, saved) { const w = Object.assign(base, saved); w.watcher = Object.assign(S.newWorld(1).watcher, saved && saved.watcher); w.found = w.found || {}; w.votes = w.votes || {}; return w; }
  const store = { get() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { return null; } }, set(v) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(v)); } catch (e) {} } };
  const setStore = { get() { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null'); } catch (e) { return null; } }, set(v) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(v)); } catch (e) {} } };
  let saved = store.get(), world, player;
  function fresh(keepSettings) { world = S.newWorld(Math.floor(Math.random() * 1e9)); if (keepSettings) world.settings = keepSettings; player = S.newPlayer('p1'); }
  if (saved && saved.world && saved.world.v === 2 && saved.player && saved.player.hp != null) { world = fixWorld(S.newWorld(saved.world.seed), saved.world); world.settings = fixWorld(S.newWorld().settings, saved.world.settings); player = Object.assign(S.newPlayer(), saved.player || {}); if (world.removed > 0 && !world.lvl.torch) world.lvl.torch = 1; }
  else fresh();
  if (!world.settings.lang) world.settings.lang = (navigator.language || 'en').toLowerCase().startsWith('ru') ? 'ru' : 'en';
  { const st = setStore.get(); if (st) world.settings = Object.assign(world.settings, st); }
  // the attic is saved only at the lever (a checkpoint); settings are saved on their own whenever they change
  const saveSettings = () => setStore.set(world.settings);
  const roomKey = () => 'million-dolls-room-' + Net.roomId(Net.room, Net.pass || coopPass);
  let coopPass = '';
  const roomStore = { get() { try { return JSON.parse(localStorage.getItem(roomKey()) || 'null'); } catch (e) { return null; } }, set(w) { try { localStorage.setItem(roomKey(), JSON.stringify(w)); } catch (e) {} } };
  function roomWorld(w) { const o = Object.assign({}, w); delete o.settings; return o; }
  const checkpoint = () => {
    if (Net.mode === 'client') return;
    if (Net.mode === 'host') { world.savedAt = Date.now(); world.last = Date.now(); const rw = roomWorld(world); roomStore.set(rw); Net.broadcast({ t: 'save', w: rw }); return; }
    world.last = Date.now(); player.x = S.LEVER.x; player.z = S.LEVER.z - 1.2; store.set({ world, player }); saveSettings(); };
  const save = saveSettings;
  function loadCheckpoint() {
    const cp = store.get(), st = world.settings; if (!cp) { fresh(st); return; }
    world = fixWorld(S.newWorld(cp.world.seed), cp.world); world.settings = st; player = Object.assign(S.newPlayer(), cp.player);
  }
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
        <button class="mbtn" data-a="coop">${tr('coop')}<small>${tr('coopSoon')}</small></button>
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
  function coopScreen(status) {
    mode = 'coop'; const st = world.settings;
    show(`<div class="panel coop"><h2 class="title" style="font-size:48px">${tr('coopTitle')}</h2><p class="note">${tr('coopIntro')}</p>
      <div class="set">
        <label for="cNick">${tr('nick')}</label><input id="cNick" maxlength="16" value="${esc(st.nick || '')}">
        <label for="cRoom">${tr('roomName')}</label><input id="cRoom" maxlength="32" value="${esc(st.room || '')}">
        <label for="cPass">${tr('roomPass')}</label><input id="cPass" type="password" maxlength="32">
      </div>
      <div class="menu row"><button class="mbtn" data-a="host">${tr('create')}</button><button class="mbtn" data-a="join">${tr('joinRoom')}</button></div>
      <p class="note err" id="cStatus">${status ? esc(status) : ''}</p>
      <button class="mbtn back" data-a="menu">${tr('back')}</button></div>`);
  }
  function coopGo(kind) {
    const nick = $('cNick').value.trim(), room = $('cRoom').value.trim(), pass = $('cPass').value;
    if (!nick || !room || !pass) { $('cStatus').textContent = tr('errFill'); return; }
    world.settings.nick = nick; world.settings.room = room; saveSettings(); $('cStatus').textContent = tr('connecting'); coopPass = pass;
    { Net.room = room; Net.pass = pass; const rs = roomStore.get(); Net.savedAt = rs ? rs.savedAt || 0 : 0; }
    const err = e => ({ exists: tr('errExists'), notfound: tr('errNotFound'), full: tr('errFull'), offline: tr('errOffline') }[e] || tr('errNetwork'));
    // Create and join fall back on each other: a room whose host just left is still "taken" for a few seconds,
    // and a room nobody is hosting right now is simply created (its shared save is loaded from this computer).
    const attempt = (k, n) => {
      if (mode !== 'coop') return;
      if (k === 'host') Net.host(room, pass, nick, e => {
        if (e === 'exists' && n < 8) return setTimeout(() => attempt('join', n + 1), 1200);
        if (e) return mode === 'coop' && coopScreen(err(e));
        onHosted(kind === 'join');
      });
      else Net.join(room, pass, nick, (e, m) => {
        if (e === 'notfound' && n < 8) return setTimeout(() => attempt('host', n + 1), n ? 2500 : 0);
        if (e) return mode === 'coop' && coopScreen(err(e));
        onJoined(m);
      });
    };
    attempt(kind, 0);
  }
  function onHosted(fromJoin) {
      if (fromJoin) toast(tr('createdInstead'));
      const rs = roomStore.get(), st = world.settings;
      world = rs ? fixWorld(S.newWorld(rs.seed), rs) : S.newWorld(Math.floor(Math.random() * 1e9)); world.settings = st;
      player = S.newPlayer('h'); player.x = S.LEVER.x + 1; player.z = S.LEVER.z - 1.5; remote = {};
      toast(rs ? tr('roomLoaded', { n: new Date(rs.savedAt || Date.now()).toLocaleString() }) : tr('roomNew')); toast(tr('hostNote')); startPlay();
  }
  function onJoined(m) {
      const st = world.settings; world = fixWorld(S.newWorld(m.w.seed), m.w); world.settings = st;
      player = S.newPlayer(m.id); player.x = S.LEVER.x + 1; player.z = S.LEVER.z - 1.5; player.yaw = 0.3; remote = {}; others = [];
      V.scare.reset && V.scare.reset(); startPlay();
  }
  function leaveRoom() {
    const was = Net.leave(); remote = {}; others = []; V.others([]); endTyping();
    if (was !== 'solo') loadCheckpoint();
    player.id = 'p1';
  }
  function pauseScreen() {
    mode = 'pause'; document.exitPointerLock && document.exitPointerLock();
    show(`<div class="panel"><h2 class="title" style="font-size:56px">${tr('title')}</h2><div class="menu">
      <button class="mbtn" data-a="play">${tr('resume')}</button><button class="mbtn" data-a="settingsP">${tr('settings')}</button>${Net.mode !== 'solo' ? `<button class="mbtn" data-a="leaveRoom">${tr('leaveRoom')}<small>${tr('inRoom')}: ${esc(Net.room)}</small></button>` : ''}<button class="mbtn" data-a="menu">${tr('toMenu')}</button></div>
      <p class="note">${tr('controls')}</p></div>`);
  }
  let bookTab = 'tree';
  function bookScreen() {
    mode = 'book'; document.exitPointerLock && document.exitPointerLock();
    const tabs = [['tree', tr('tabTree')], ['notes', tr('tabNotes')], ['stats', tr('tabStats')]];
    show(`<div class="book"><nav>${tabs.map(([k, l]) => `<button data-tab="${k}" class="${bookTab === k ? 'on' : ''}">${l}</button>`).join('')}<span class="sp"></span><button data-a="play">${tr('close')}</button></nav><div class="body" id="bookBody">${bookBody()}</div></div>`);
  }
  function lootDepths() {
    return `<p class="note loot-depth"><b>${tr('lootTitle')}:</b> ` + D.LOOT.map(l => { const at = Math.round(l.from * D.PILE), nm = esc(L(l.name));
      return !at ? `${nm} — ${tr('lootNow')}` : world.removed >= at ? `${nm} ✓` : `${nm} — ${tr('lootFrom', { n: big(at) })} (${tr('lootLeft', { n: big(at - world.removed) })})`; }).join(' · ') + '</p>';
  }
  function bookBody() {
    if (bookTab === 'notes') return `<div class="notes">${D.NOTES.map((n, i) => world.notes.includes(i) ? `<div class="paper">${esc(L(n))}</div>` : `<div class="paper blank">${tr('notFound')}</div>`).join('')}</div>`;
    if (bookTab === 'stats') return `<div class="stats"><span>${tr('statsDug')}</span><span>${big(world.removed)}</span><span>${tr('statsKills')}</span><span>${world.watcher.kills}</span>
      <span>${tr('statsTime')}</span><span>${Math.floor(world.time / 3600)}:${String(Math.floor(world.time / 60) % 60).padStart(2, '0')}</span><span>${tr('statsKeys')}</span><span>${world.wrongKeys}</span><span>${tr('eggs')}</span><span>${D.ITEMS.filter(i => i.kind === 'egg' && world.found && world.found[i.id]).length}/${D.ITEMS.filter(i => i.kind === 'egg').length}</span></div>${D.ITEMS.filter(i => i.kind === 'egg' && world.found && world.found[i.id]).map(i => `<div class="paper"><b>${esc(L(i.name))}</b><br>${esc(L(i.text))}</div>`).join('')}`;
    const CW = 230, CH = 150, minR = Math.min(...D.NODES.map(n => n.pos[1])), X = n => 30 + n.pos[0] * CW, Y = n => 30 + (n.pos[1] - minR) * CH;
    const maxC = Math.max(...D.NODES.map(n => n.pos[0])), maxR = Math.max(...D.NODES.map(n => n.pos[1]));
    let lines = '', cards = '';
    D.NODES.forEach(n => (n.req || []).forEach(r => { const p = S.N[r]; lines += `<line x1="${X(p) + 95}" y1="${Y(p) + 10}" x2="${X(n) + 95}" y2="${Y(n) + 10}" stroke="${S.lv(world, r) ? '#b01818' : '#5a2a22'}" stroke-width="2"/>`; }));
    D.NODES.forEach((n, i) => {
      const vis = S.nodeVisible(world, n.id), L0 = S.lv(world, n.id), max = L0 >= n.max, cost = S.nodeCost(world, n.id), can = vis && !max && S.canAfford(world, cost);
      const r = ((i * 37) % 7 - 3) * 0.6;
      cards += `<button class="card ${!vis ? 'lock' : ''} ${max ? 'max' : ''} ${can ? 'can' : ''}" style="left:${X(n)}px;top:${Y(n)}px;--r:${r}deg" data-node="${n.id}">
        <b>${esc(L(n.name))}</b><span class="lv">${L0}/${n.max}</span><span>${esc(L(n.desc))}</span>${Net.mode !== 'solo' && world.votes && world.votes[n.id] ? `<span class="votes">${tr('votes')} ${world.votes[n.id].length}/${Math.floor(partyIds().length / 2) + 1}: ${world.votes[n.id].map(id => esc(nickOf(id))).join(', ')}</span>` : ''}
        ${max ? `<span class="cost">${tr('maxed')}</span>` : `<span class="cost">${Object.keys(cost).map(k => `<span class="${world.cur[k] >= cost[k] ? '' : 'no'}">${short(cost[k])} ${esc(L(LOOT[k].name))}</span>`).join('')}</span>`}</button>`;
    });
    const w = 60 + (maxC + 1) * CW, h = 60 + (maxR - minR + 1) * CH;
    return lootDepths() + (Net.mode !== 'solo' ? `<p class="note">${tr('voteHint')}</p>` : '') + `<div class="board" style="width:${w}px;height:${h}px"><svg width="${w}" height="${h}">${lines}</svg>${cards}</div>`;
  }
  function deathScreen(lost) {
    mode = 'dead'; document.exitPointerLock && document.exitPointerLock();
    const coop = Net.mode !== 'solo';
    show(`<div class="panel death"><h2>${tr('died')}</h2><p>${coop ? tr('diedCoop') : tr('diedCp')}</p>
      <button class="mbtn" data-a="${coop ? 'play' : 'respawn'}">${tr('getUp')}</button></div>`);
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
    if (b.dataset.node) { if (Net.mode === 'client') { Net.send({ t: 'vote', id: b.dataset.node }); A.find(false); setTimeout(() => mode === 'book' && bookScreen(), 400); return; } if (Net.mode === 'host') { S.vote(world, player.id, b.dataset.node); settle(); A.find(false); return bookScreen(); } if (S.buy(world, b.dataset.node)) { A.find(true); save(); } else A.door(false); return bookScreen(); }
    if (b.dataset.set) {
      const k = b.dataset.set, raw = b.dataset.v, v = raw === 'true' ? true : raw === 'false' ? false : raw;
      world.settings[k] = v; if (k === 'quality') V.setQuality(v); V.setSettings(world.settings); save(); return settingsScreen(settingsFrom);
    }
    const a = b.dataset.a;
    if (a === 'warned') { world.settings.warned = true; save(); return menuScreen(); }
    if (a === 'play') return startPlay();
    if (a === 'respawn') { loadCheckpoint(); player.stun = 2; return startPlay(); }
    if (a === 'new') { if (!newArmed) return menuScreen(true); const st = world.settings; fresh(st); store.set({ world, player }); return startPlay(); }
    if (a === 'coop') return coopScreen();
    if (a === 'host' || a === 'join') return coopGo(a);
    if (a === 'leaveRoom') { leaveRoom(); return menuScreen(); }
    if (a === 'settings') return settingsScreen('menu');
    if (a === 'settingsP') return settingsScreen('pause');
    if (a === 'back') return settingsFrom === 'pause' ? pauseScreen() : menuScreen();
    if (a === 'menu') { if (Net.mode !== 'solo') leaveRoom(); return menuScreen(); }
    if (a === 'quit') { save(); window.close(); return; }
    if (a === 'endNext') return endingScreen(+b.dataset.i);
    if (a === 'again') { const st = world.settings; fresh(st); store.set({ world, player }); return startPlay(); }
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
  window.addEventListener('mousedown', e => { if (mode !== 'play') return; if (e.button === 0 && sense && sense.target === 'lever' && (locked || lockFailed)) return pull(); if (e.button === 0) mouseDown = true; if (e.button === 2) rmb = true; });
  window.addEventListener('mouseup', e => { if (e.button === 0) mouseDown = false; if (e.button === 2) rmb = false; });
  window.addEventListener('mousemove', e => {
    if (mode !== 'play' || player.stun > 0) return;
    if (!locked && !(lockFailed && rmb)) return;
    const k = 0.0022 * world.settings.sens; player.yaw -= e.movementX * k; player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - e.movementY * k));
  });
  window.addEventListener('keydown', e => {
    if (typing && mode === 'play') { e.preventDefault(); typeKey(e); return; }
    keys[e.code] = true;
    if (e.code === 'Tab') { e.preventDefault(); if (mode === 'play') bookScreen(); else if (mode === 'book') startPlay(); return; }
    if (e.code === 'Escape' && mode === 'book') return startPlay();
    if (mode !== 'play') return;
    if (e.code === 'KeyF') { if (!S.stats(world).torch) { toast(tr('noTorch')); return; } if (player.battery > 0.02) player.light = !player.light; A.dig(); }
    if (e.code === 'KeyM' && S.stats(world).music) { if (Net.mode === 'client') Net.send({ t: 'music' }); else if (S.playMusic(world)) { toast(tr('music')); A.lullaby(); Net.mode === 'host' && Net.broadcast({ t: 'ev', ev: [{ music: true }] }); } else toast(tr('musicWait')); }
    if (e.code === 'KeyE' && sense && sense.target === 'door') tryDoor();
    if (e.code === 'KeyE' && sense && sense.target === 'lever') pull();
    if (e.code === 'KeyE' && sense && sense.target && sense.target.startsWith('item:')) take(sense.target.slice(5));
    const wk = Object.keys(D.WEAPONS).find(k => 'Digit' + D.WEAPONS[k].key === e.code); if (wk) useWeapon(wk);
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouseDown = false; });

  function pull() {
    if (Net.mode === 'client') { Net.send({ t: 'lever' }); return; }
    leverBy(player);
  }
  function leverBy(p) {
    const r = S.pullLever(world, p);
    if (Net.mode === 'host') Net.broadcast({ t: 'ev', ev: [{ flood: r.stunned, by: p.id, wait: r.wait || 0 }] });
    if (p !== player) { V.scare.flood(r.stunned ? 1.3 : 0.25); A.thud(); if (r.stunned) setTimeout(() => A.hiss(0, 0.25), 250); checkpoint(); return; } V.scare.flood(r.stunned ? 1.3 : 0.25); A.door(false); A.thud();
    if (r.stunned) { setTimeout(() => { A.hiss(0, 0.25); A.moan(0, 0.12); }, 250); toast(tr('saved')); } else toast(tr('savedWait', { s: r.wait }));
    endScare(); checkpoint();
  }
  function tryDoor() {
    if (Net.mode === 'client') { Net.send({ t: 'door' }); if (world.keys < 3) { A.door(false); toast(tr('doorLocked')); } return; }
    if (world.keys >= 3 && Net.mode === 'host') Net.broadcast({ t: 'ev', ev: [{ escaped: true }] });
    if (world.keys >= 3) { A.door(true); world.escaped = true; checkpoint(); endingScreen(0); }
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
    $('batFill').style.width = Math.round(player.battery * 100) + '%'; $('battery').style.visibility = S.stats(world).torch ? 'visible' : 'hidden';
    $('hpFill').style.width = Math.round(player.hp * 100) + '%'; $('enFill').style.width = Math.round(player.energy * 100) + '%'; $('vitals').classList.toggle('low', player.hp < 0.35);
    const it = sense && sense.target && sense.target.startsWith('item:') ? D.ITEMS.find(i => i.id === sense.target.slice(5)) : null;
    const h = !sense ? '' : it ? tr('take', { n: it.kind === 'weapon' ? L(D.WEAPONS[it.id].name) : L(it.name) }) : sense.target === 'lever' ? tr('lever') : sense.target === 'pile' ? (player.energy <= 0.01 ? tr('noEnergy') : tr('holdDig')) : sense.target === 'door' ? (world.keys >= 3 ? tr('openDoor') : tr('tryDoor')) : '';
    $('hint').textContent = h;
    $('weapons').innerHTML = Object.keys(D.WEAPONS).filter(k => world.found && world.found[k]).map(k => { const c = Math.max(0, Math.ceil((myCd[k] || 0) - world.time)); return `<div class="${c ? 'cd' : ''}"><kbd>${D.WEAPONS[k].key}</kbd>${esc(L(D.WEAPONS[k].name))}${c ? ` · ${c}` : ''}</div>`; }).join('');
    const MW = world.watcher, mh = $('mhp'); mh.hidden = !(MW.hp < 1 || MW.broken > 0); if (!mh.hidden) { mh.querySelector('span').textContent = tr('motherHp'); mh.querySelector('b').style.width = Math.round((MW.broken > 0 ? 0 : MW.hp) * 100) + '%'; }
    const party = $('party'); party.hidden = Net.mode === 'solo';
    if (!party.hidden) { const ps = Net.mode === 'host' ? [player].concat(Object.values(remote)) : [player].concat(others); party.innerHTML = `<b>${esc(Net.room)}</b>` + ps.map(p => `<div><span>${esc(nickOf(p.id))}${p.id === player.id ? ' ◂' : ''}</span><i><b style="width:${Math.round((p.hp == null ? 1 : p.hp) * 100)}%"></b></i></div>`).join(''); }
    const kh = S.keyHint(world); $('whisper').hidden = !kh; if (kh) $('whisper').textContent = tr('whisper', { a: big(kh.from), b: big(kh.to) });
  }

  // ---------- scare director ----------
  // Something horrible happens every 20–50 s. Scares never take progress, but they interrupt, and the brave get paid.
  const rr = (a, b) => a + Math.random() * (b - a);
  let scare = null, nextScare = 22, hinted = false;
  const scared = () => world.settings.scares;
  function daze(sec) { player.daze = Math.max(player.daze, sec * (1 - S.stats(world).nerves)); }
  function nonFatal(kind, sec) { if (scared()) A.scream(); else A.sting(); daze(sec); V.jumpscare(scared(), null, kind, false); world.scares++; }
  function pay(dolls, msg) { const loot = S.bounty(world, dolls); const k = Object.keys(loot); toast(`${tr(msg)}: ` + k.map(id => `+${short(loot[id])} ${L(LOOT[id].name)}`).join(', ')); A.find(true); }
  function endScare() {
    if (!scare) return; const k = scare.kind;
    if (k === 'eyes') V.scare.eyesOff(); if (k === 'crawler') V.scare.crawlerOff(); if (k === 'hand') V.scare.handOff(); if (k === 'drip') V.scare.dripOff();
    if (k === 'look') V.scare.lookStop(); if (k === 'blackout') V.scare.apparition(false); if (k === 'writing') {}
    if (k === 'behind' || k === 'above') { const W = world.watcher; W.x = scare.wx; W.z = scare.wz; W.held = false; W.wake = 0; }
    scare = null; nextScare = rr(9, 22) * (1 - S.depth(world) * 0.4);
  }
  function pickScare() {
    const d = S.depth(world), pileDist = Math.hypot(player.x - S.PILE_POS.x, player.z - S.PILE_POS.z);
    const pool = [['eyes', 3], ['drip', world.settings.blood ? 2 : 0], ['fall', 1.5], ['child', 1.5], ['writing', 1.5], ['look', pileDist < 13 ? 2 : 0],
      ['crawler', d > 0.02 ? 2.5 : 0], ['blackout', d > 0.04 ? 1.5 : 0], ['hand', player.digging && d > 0.05 ? 3 : 0],
      ['behind', world.time > 60 && Net.mode === 'solo' ? 2.5 : 0], ['above', world.time > 90 && Net.mode === 'solo' ? 2 : 0], ['knock', 2]];
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
    if (kind === 'behind' || kind === 'above') {
      // Mother leaves wherever she was and is suddenly right behind you / on the roof over your head
      const W = world.watcher; scare.wx = W.x; scare.wz = W.z; W.held = true; W.moving = false;
      if (kind === 'behind') { const bx = player.x + Math.sin(yaw) * 1.1, bz = player.z + Math.cos(yaw) * 1.1; if (bx < B.minX || bx > B.maxX || bz < B.minZ || bz > B.maxZ || Math.hypot(bx - S.PILE_POS.x, bz - S.PILE_POS.z) < 7.2) { W.held = false; scare = null; return startScare('knock'); } V.scare.motherAt(bx, bz, 'stand'); scare.yaw0 = yaw; A.breath(0, 0.09); }
      else { V.scare.motherAt(player.x, player.z - fz * 0.4, 'ceiling'); A.gurgle(0, 0.07); setTimeout(() => { if (scare && scare.kind === 'above') { V.scare.bloodLens(); A.drip(); } }, 1200); }
    }
    if (kind === 'knock') { A.knock(rr(-0.4, 0.4), 3); setTimeout(() => A.crawl(rr(-0.6, 0.6), 0.12), 1600); setTimeout(() => A.crawl(rr(-0.6, 0.6), 0.08), 2300); }
  }
  function director(dt, out) {
    if (mode !== 'play' || player.stun > 0) return;
    if (!hinted && !S.stats(world).torch && world.time > 2) { hinted = true; toast(tr('firstHint')); }
    if (!scare) { if (world.time < 15) return; nextScare -= dt; if (nextScare <= 0) startScare(pickScare()); return; }
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
    else if (k === 'behind') {
      let turn = Math.abs(((player.yaw - scare.yaw0) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
      if (turn > 2.2) { V.scare.motherAt(player.x - Math.sin(player.yaw) * 0.9, player.z - Math.cos(player.yaw) * 0.9, 'stand'); endScare(); return nonFatal('mother', 1.8); }
      if (Math.random() < dt * 0.6) A.whisper(rr(-0.3, 0.3));
      if (t > 5.5) { endScare(); pay(450 + S.depth(world) * 3500, 'didntTurn'); }
    } else if (k === 'above') {
      if (player.pitch > 0.7) { A.hiss(0, 0.3); endScare(); return nonFatal('mother', 1.5); }
      if (Math.random() < dt * 1.5) A.crawl(rr(-0.2, 0.2), 0.05);
      if (t > 7) { A.crawl(0.5, 0.12); endScare(); pay(380 + S.depth(world) * 3000, 'stayedDown'); }
    } else if (k === 'knock') { if (t > 3) endScare(); }
    else if (k === 'hand') {
      if (t > 1.5 && !scare.done) {
        scare.done = true; const near = Math.hypot(player.x - S.PILE_POS.x, player.z - S.PILE_POS.z) < S.PILE_POS.x + 9;
        if (player.digging && near && !S.stats(world).gloves) { toast(tr('grabbed')); if (world.settings.blood) V.addBlood(player.x, player.z, 0.5); nonFatal('doll', 2.2); }
        else pay(200 + S.depth(world) * 2000, 'escaped');
      }
      if (t > 2.4) endScare();
    }
  }

  // ---------- simulation: solo / host runs it, client mirrors the host ----------
  let remote = {}, others = [], netT = 0, snap = null, evQueue = [];
  const nickOf = id => (Net.players[id] && Net.players[id].nick) || (id === player.id ? (world.settings.nick || 'you') : '?');
  const panTo = () => Math.max(-1, Math.min(1, -Math.sin(sense.bellDir)));
  function showPulled(n, loot) {
    if (n > 0) { visT += Math.min(n, 6); while (visT >= 1) { V.launchDoll(!player.digging || Math.random() < 0.35); visT--; } if (player.digging) { A.dig(); if (Math.random() < 0.15) A.rip(); } }
    if (player.digging && n > 0 && loot) { const k = Object.keys(loot).filter(id => loot[id] > 0); if (k.length && Math.random() < 0.35) { const id = k[Math.floor(Math.random() * k.length)]; floater(`+${short(loot[id])} ${L(LOOT[id].name)}`); } }
  }
  function showFinds(notes, ks) {
    (notes || []).forEach(i => { toast(L(D.NOTES[i])); A.whisper(0); });
    (ks || []).forEach(k => { const K = D.KEYS[k]; toast(`${L(K.name)}. ${L(K.text)}`); A.find(true); A.sting(); setTimeout(() => A.creak(0, 0.2), 1500); });
  }
  function coopFall(p) {   // co-op death: no rollback, the team loses 15% of what it holds, the player wakes at the lever
    for (const k in world.cur) world.cur[k] *= 0.85;
    p.hp = 1; p.energy = 1; p.stun = 3; p.x = S.LEVER.x + 1; p.z = S.LEVER.z - 1.5;
  }
  function handleEvents(list) {
    const me = player.id;
    list.forEach(ev => {
      if (ev.chained === me) { toast(tr('chained')); A.bell(0); }
      if (ev.lunge === me) { const pan = panTo(); A.crawl(pan, 0.25); A.moan(pan, 0.12); setTimeout(() => A.crawl(pan * 0.5, 0.3), 250); setTimeout(() => A.crawl(0, 0.35), 550); }
      if (ev.lungeHold === me) { A.hiss(0, 0.35); A.breath(0, 0.12); if (scared()) A.sting(); daze(0.8); }
      if (ev.lungeBack === me) { const pan = panTo(); A.crawl(pan, 0.2); setTimeout(() => A.crawl(pan, 0.12), 300); setTimeout(() => A.giggle(pan), 700); }
      if (ev.noticed === me) { toast(tr('noticed')); A.screech(panTo()); }
      if (ev.hit === me) { toast(tr('hit')); if (world.settings.blood) { V.addBlood(player.x, player.z, 0.6); V.scare.bloodLens(); } endScare(); nonFatal('mother', 1.2); }
      if (ev.kill) {
        if (Net.mode === 'host' && ev.kill !== me && remote[ev.kill]) { coopFall(remote[ev.kill]); A.moan(panTo(), 0.15); toast(tr('fellNamed', { n: nickOf(ev.kill) })); }
        if (ev.kill === me) {
          if (Net.mode === 'host') coopFall(player);
          if (Net.mode === 'client') { player.stun = 3; player.x = S.LEVER.x + 1; player.z = S.LEVER.z - 1.5; }
          if (world.settings.scares) A.scream(); else A.sting();
          mode = 'dying'; document.exitPointerLock && document.exitPointerLock();
          endScare(); V.jumpscare(world.settings.scares, () => deathScreen(), 'mother', true);
        } else if (Net.mode === 'client') toast(tr('fellNamed', { n: nickOf(ev.kill) }));
      }
      if (ev.flood != null && Net.mode === 'client') { V.scare.flood(ev.flood ? 1.3 : 0.25); A.thud(); if (ev.flood) setTimeout(() => A.hiss(0, 0.25), 250); if (ev.by === me) toast(ev.flood ? tr('saved') : tr('savedWait', { s: ev.wait })); }
      if (ev.music && Net.mode === 'client') { toast(tr('music')); A.lullaby(); }
      if (ev.grab) { if (ev.grab === me) startTyping(ev.word, ev.limit); else { toast(tr('grabOther', { n: nickOf(ev.grab) })); A.screech(panTo()); } }
      if (ev.grabOk || ev.grabFree || ev.hit === me || ev.kill === me) { if ((ev.grabOk || ev.grabFree) === me) { toast(tr('grabOk')); A.hiss(panTo(), 0.2); } if ([ev.grabOk, ev.grabFree, ev.hit, ev.kill].includes(me)) endTyping(); }
      if (ev.repelled === me) toast(tr('repelled'));
      if (ev.weapon) { A.thud(); A.screech(panTo()); if (ev.by === me) toast(tr('weaponHit', { w: L(D.WEAPONS[ev.weapon].name) })); if (ev.weapon === 'camera') V.scare.flood(0.15); }
      if (ev.flare) { A.rip(); A.hiss(0, 0.15); if (ev.flare === me) toast(tr('flared')); }
      if (ev.broke) { toast(tr('broke')); A.scream(); A.crack(0, 0.5); if (ev.loot) pay0(ev.loot); }
      if (ev.mended) { toast(tr('mended')); A.crack(panTo(), 0.3); A.moan(panTo(), 0.15); }
      if (ev.gate) { const r = D.ROOMS.find(r => r.id === ev.gate); if (r && r.opened && world.time > 3) { toast(L(r.opened)); A.door(true); } }
      if (ev.item) { const it = D.ITEMS.find(i => i.id === ev.item); A.find(true); if (it.kind === 'weapon') toast(tr('weaponGot', { n: L(D.WEAPONS[it.id].name), k: D.WEAPONS[it.id].key })); else { toast(`${tr('found')}: ${L(it.name)}. ${L(it.text)}`); if (it.id === 'duck') A.giggle(0); } if (ev.loot) pay0(ev.loot); }
      if (ev.bought) { toast(tr('bought', { n: L(S.N[ev.bought].name) })); A.find(true); if (mode === 'book') bookScreen(); }
      if (ev.escaped && Net.mode === 'client') { A.door(true); endingScreen(0); }
    });
  }
  // ---- her grip: type the word ----
  let typing = null; const myCd = {};
  function startTyping(idx, limit) {
    const list = D.WORDS[world.settings.lang] || D.WORDS.en; typing = { word: list[idx % list.length], buf: '', limit, t: 0 };
    mouseDown = false; if (scared()) A.scream(); else A.sting(); $('typing').hidden = false; drawTyping();
  }
  function endTyping() { typing = null; $('typing').hidden = true; }
  function drawTyping() {
    if (!typing) return; const w = typing.word, n = typing.buf.length;
    $('typing').querySelector('small').textContent = tr('grabbed2');
    $('typing').querySelector('.word').innerHTML = `<b>${esc(w.slice(0, n))}</b><u>${esc(w.slice(n))}</u>`;
    $('typing').querySelector('i b').style.width = Math.max(0, 100 - typing.t / typing.limit * 100) + '%';
  }
  function typeKey(e) {
    const w = typing.word; if (e.key === 'Backspace') { typing.buf = typing.buf.slice(0, -1); return drawTyping(); }
    if (e.key.length !== 1) return;
    const next = typing.buf + e.key.toLowerCase().replace('ё', 'е');
    if (w.replace('ё', 'е').startsWith(next)) { typing.buf = next; A.dig(); } else { const el = $('typing'); el.classList.remove('bad'); void el.offsetWidth; el.classList.add('bad'); A.door(false); }
    drawTyping();
    if (typing.buf.length >= w.length) { if (Net.mode === 'client') Net.send({ t: 'typed' }); else { const r = S.typed(world, player.id); if (r) { player.grabCd = 4; hostEvents([r]); } } endTyping(); }
  }
  // ---- weapons and pickups ----
  function useWeapon(kind) {
    if (!world.found || !world.found[kind]) return;
    if ((myCd[kind] || 0) > world.time) return toast(tr('weaponCd', { s: Math.ceil(myCd[kind] - world.time) }));
    const aim = { inView: !!sense.motherInView }, Wd = D.WEAPONS[kind];
    if (Net.mode === 'client') { Net.send({ t: 'weapon', kind, inView: aim.inView }); myCd[kind] = world.time + Wd.cd; A.rip(); return; }
    const r = S.useWeapon(world, player, kind, aim); myCd[kind] = player.cd ? player.cd[kind] : 0;
    if (!r.ok && r.why === 'miss') toast(tr('weaponMiss')); A.rip(); hostEvents(r.ev);
  }
  function take(id) { if (Net.mode === 'client') return Net.send({ t: 'pick', id }); const r = S.pickItem(world, id); if (r) hostEvents([Object.assign({ by: player.id }, r)]); }
  function pay0(loot) { const k = Object.keys(loot).filter(id => loot[id] >= 1); if (k.length) toast(k.map(id => `+${short(loot[id])} ${L(LOOT[id].name)}`).join(', ')); }
  const partyIds = () => [player.id].concat(Net.mode === 'host' ? Object.keys(remote) : others.map(p => p.id));
  function settle() { if (Net.mode !== 'host') return; S.settleVotes(world, partyIds()).forEach(id => hostEvents([{ bought: id }])); }
  // events made outside the sim step (typing, weapons, pickups, votes): handle here, tell the room
  function hostEvents(list) { if (!list || !list.length) return; handleEvents(list); if (Net.mode === 'host') Net.broadcast({ t: 'ev', ev: list }); }
  let voteT = 0;
  function hostStep(dt) {
    const ps = [player].concat(Object.values(remote));
    const out = S.step(world, ps, dt, { inBeam: ps.map(p => p === player ? sense.inBeam : !!p.inBeam), watched: ps.map(p => p === player ? sense.sees : !!p.sees), litAtWatcher: sense.litAtWatcher });
    showPulled(player.digging ? out.pulled : Math.min(out.pulled, 1), out.loot);
    showFinds(out.notes, out.keys);
    handleEvents(out.events);
    if (Net.mode === 'host') {
      voteT += dt; if (voteT > 1) { voteT = 0; settle(); }
      if (out.events.length || out.notes.length || out.keys.length) Net.broadcast({ t: 'ev', ev: out.events, notes: out.notes, keys: out.keys });
      netT += dt; if (netT > 0.1) { netT = 0; Net.broadcast(snapshot()); }
      V.others(Object.values(remote).map(p => Object.assign({ nick: nickOf(p.id) }, p)));
    }
    return out;
  }
  function worldNet() { const o = Object.assign({}, world); delete o.settings; return o; }
  function snapshot() { return { t: 'w', w: worldNet(), ps: [player].concat(Object.values(remote)).map(p => ({ id: p.id, x: p.x, z: p.z, yaw: p.yaw, pitch: p.pitch, light: p.light, digging: p.digging, hp: p.hp, energy: p.energy })) }; }
  function clientStep(dt) {
    S.battery(world, player, dt);
    netT += dt; if (netT > 0.066) { netT = 0; Net.send({ t: 'p', x: player.x, z: player.z, yaw: player.yaw, pitch: player.pitch, light: player.light, battery: player.battery, digging: player.digging, inBeam: !!sense.inBeam, sees: !!sense.sees }); }
    let pulled = 0, loot = null;
    if (snap) {
      const before = world.removed, tot = Object.assign({}, world.total);
      Object.assign(world, snap.w); pulled = world.removed - before; loot = {}; for (const k in world.total) loot[k] = world.total[k] - (tot[k] || 0);
      const me = snap.ps.find(p => p.id === player.id); if (me) { player.hp = me.hp; player.energy = me.energy; }
      others = snap.ps.filter(p => p.id !== player.id); V.others(others.map(p => Object.assign({ nick: nickOf(p.id) }, p)));
      snap = null;
    }
    showPulled(pulled, loot);
    const evs = evQueue; evQueue = [];
    evs.forEach(m => { showFinds(m.notes, m.keys); handleEvents(m.ev || []); });
    return {};
  }
  // network messages
  Net.on('join', (id, nick, c, hello) => {
    if (hello && (hello.savedAt || 0) > (world.savedAt || 0)) setTimeout(() => c.send({ t: 'needSave' }), 500);
    const p = S.newPlayer(id); p.x = S.LEVER.x + 1; p.z = S.LEVER.z - 1.5; remote[id] = p;
    c.send({ t: 'welcome', id, players: Net.players, w: worldNet() });
    toast(tr('joined', { n: nick })); A.door(true);
  });
  Net.on('leave', (id, nick) => { delete remote[id]; toast(tr('leftRoom', { n: nick || '?' })); });
  Net.on('players', () => { if (Net.mode === 'host') Net.broadcast({ t: 'players', players: Net.players }); });
  Net.on('lost', () => { if (mode === 'play' || mode === 'pause' || mode === 'book' || mode === 'dead' || mode === 'dying') { leaveRoom(); toast(tr('hostLeft')); menuScreen(); } else leaveRoom(); });
  Net.on('msg', (id, m) => {
    if (Net.mode === 'client') { if (m.t === 'w') snap = m; else if (m.t === 'ev') evQueue.push(m); else if (m.t === 'save' && m.w) { roomStore.set(m.w); toast(tr('roomSaved')); } else if (m.t === 'needSave') { const rs = roomStore.get(); if (rs) Net.send({ t: 'save', w: rs }); } return; }
    const p = remote[id]; if (!p) return;
    if (m.t === 'p') { p.x = +m.x || 0; p.z = +m.z || 0; p.yaw = +m.yaw || 0; p.pitch = +m.pitch || 0; p.light = !!m.light; p.battery = Math.max(0, Math.min(1, +m.battery || 0)); p.digging = !!m.digging && p.energy > 0.01; p.inBeam = !!m.inBeam; p.sees = !!m.sees; }
    else if (m.t === 'vote') { S.vote(world, id, String(m.id)); settle(); }
    else if (m.t === 'typed') { const r = S.typed(world, id); if (r) { p.grabCd = 4; hostEvents([r]); } }
    else if (m.t === 'weapon') { const r = S.useWeapon(world, p, String(m.kind), { inView: !!m.inView }); hostEvents(r.ev); }
    else if (m.t === 'pick') { const r = S.pickItem(world, String(m.id)); if (r) hostEvents([Object.assign({ by: id }, r)]); }
    else if (m.t === 'save' && m.w && (m.w.savedAt || 0) > (world.savedAt || 0)) { const st = world.settings; world = fixWorld(S.newWorld(m.w.seed), m.w); world.settings = st; roomStore.set(roomWorld(world)); toast(tr('roomLoaded', { n: nickOf(id) })); }
    else if (m.t === 'lever') leverBy(p);
    else if (m.t === 'music') { if (S.playMusic(world)) { toast(tr('music')); A.lullaby(); Net.broadcast({ t: 'ev', ev: [{ music: true }] }); } }
    else if (m.t === 'door') { if (world.keys >= 3) tryDoor(); }
  });
  // a host whose window is hidden keeps the attic running (browsers stop drawing hidden tabs)
  setInterval(() => { if (document.hidden && Net.mode === 'host') { const ps = [player].concat(Object.values(remote)); ps.forEach(p => { if (p === player) p.digging = false; }); const out = S.step(world, ps, 0.25, { inBeam: ps.map(p => !!p.inBeam), litAtWatcher: false }); Net.broadcast({ t: 'ev', ev: out.events, notes: out.notes, keys: out.keys }); out.events.forEach(ev => { if (ev.kill && remote[ev.kill]) coopFall(remote[ev.kill]); }); Net.broadcast(snapshot()); } }, 250);

  // ---------- loop ----------
  let warnedEnergy = false, last = performance.now(), saveT = 0, sense = null, bellT = 0, stepT = 0, visT = 0, prevMoving = false;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; const t = now / 1000;
    if (mode === 'play') {
      // movement
      const run = keys.ShiftLeft || keys.ShiftRight, sp = (run ? 4.2 : 2.4) * (player.stun > 0 || typing ? 0 : 1);
      let f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0), r = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
      if (lockFailed) { if (keys.KeyQ) player.yaw += dt * 2; if (keys.KeyE && !(sense && sense.target === 'door')) player.yaw -= dt * 2; }
      const len = Math.hypot(f, r) || 1; f /= len; r /= len;
      const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
      const prev = { x: player.x, z: player.z }; player.x += (-sy * f + cy * r) * sp * dt; player.z += (-cy * f - sy * r) * sp * dt; V.collide(player, world, prev);
      const moving = Math.abs(f) + Math.abs(r) > 0;
      player.bob = moving ? Math.sin(t * (run ? 13 : 8)) * (run ? 0.045 : 0.025) : 0;
      if (moving) { stepT -= dt; if (stepT <= 0) { A.step((Math.random() - 0.5) * 0.3, run ? 0.07 : 0.035); stepT = run ? 0.32 : 0.5; } }
      player.digging = mouseDown && sense && sense.target === 'pile' && player.stun <= 0 && player.daze <= 0 && player.energy > 0.01;
      if (mouseDown && sense && sense.target === 'pile' && player.energy <= 0.01 && !warnedEnergy) { warnedEnergy = true; toast(tr('noEnergy')); } if (player.energy > 0.2) warnedEnergy = false;
    } else player.digging = false;
    // render + sense, then simulate
    sense = V.update(world, player, t, dt);
    const paused = mode === 'menu' || mode === 'coop' || mode === 'warn' || mode === 'settings' && settingsFrom === 'menu' || mode === 'ending';
    if (!paused) {
      const out = Net.mode === 'client' ? clientStep(dt) : hostStep(dt);
      director(dt, out);
      // Mother moving: footsteps/creaks behind you, bell if owned
      // Mother: knocks and scratching as she crawls over the roof, joints cracking, a throat full of something
      const W = world.watcher, mpan = Math.max(-1, Math.min(1, -Math.sin(sense.bellDir)));
      if (W.moving) {
        bellT -= dt;
        if (bellT <= 0) { const m = sense.motherMode, g = 0.05 + sense.fear * 0.12; if (m === 'stand') { A.creak(mpan, g); bellT = 0.9 + Math.random() * 0.6; } else { A.crawl(mpan, g * 1.3); bellT = 0.28 + Math.random() * 0.25; } if (S.stats(world).bell) A.bell(mpan); }
        if (Math.random() < dt * (W.chase ? 0.18 : 0.05)) A.moan(mpan, 0.05 + sense.fear * 0.1);
        if (Math.random() < dt * (W.chase ? 0.4 : 0.12)) A.crack(mpan, 0.08 + sense.fear * 0.1);
      } else if (W.active && !sense.sees && Math.random() < dt * 0.035) (Math.random() < 0.5 ? A.moan : A.crack)(mpan, 0.04);
      if (sense.inBeam && prevMoving) A.hiss(mpan, 0.18);        // caught her in the beam
      if (sense.twitched) A.crack(mpan, 0.22);
      if (sense.modeChanged && !sense.sees && W.active) A.thud();
      prevMoving = W.moving && !sense.inBeam;
      const bell = $('bell'); bell.hidden = !(S.stats(world).bell && world.watcher.moving && mode === 'play');
      if (!bell.hidden) { const a = -sense.bellDir; bell.style.transform = `translate(${Math.sin(a) * 110 - 11}px, ${-Math.cos(a) * 110 - 11}px)`; }
    }
    if (typing) { typing.t += dt; drawTyping(); if (typing.t > typing.limit + 1.5) endTyping(); }
    A.update(mode === 'play' ? sense.fear : 0, t);
    hudT += dt; if (hudT > 0.12 && mode === 'play') { hudT = 0; renderHud(); }
    
    requestAnimationFrame(frame);
  }

  // ---------- boot ----------
  const off = S.offline(world, Date.now());
  if (off && off.pulled) setTimeout(() => toast(`${tr('away')}: −${big(off.pulled)}`), 1500);
  window.addEventListener('beforeunload', saveSettings);
  document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') pauseScreen(); });
  if (!world.settings.warned) warnScreen(); else menuScreen();
  requestAnimationFrame(frame);
  window.__dolls = { get world() { return world; }, get player() { return player; }, get remote() { return remote; }, get others() { return others; }, save, startPlay, bookScreen, force: k => startScare(k), endForce: () => endScare(), scareState: () => scare };
})();
