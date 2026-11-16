// Endless Digging — the shared-Earth server. One planet for every player: whatever anyone digs stays dug for everyone.
//
// What the server owns (players cannot cheat it): the holes, everybody's money and research, chat, bans.
// The game sends "I dig here with this tool"; the server checks the tool, the pace and the distance, measures the
// scoop with the game's own code (src/world.js + src/rules.js), digs it, pays for it and tells the players nearby.
//
// Scale: the planet is cut into 64 m cells; a player only hears about holes and players within a few cells.
// One process comfortably serves hundreds of players at once; for more, run several processes, each owning a part
// of the planet (see MULTIPLAYER.md) — the cell design is what makes that split possible.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { WebSocketServer } = require('ws');
const { W, Rules } = require('./world').load();
const mod = require('./moderation'), steam = require('./steam');
const toLL = (x, y, z) => { const l = Math.hypot(x, y, z); return [Math.asin(y / l) * 180 / Math.PI, Math.atan2(-z, x) * 180 / Math.PI]; };

const PORT = +process.env.PORT || 8790;
const DATA = process.env.DATA_DIR || path.join(__dirname, 'data');
const OWNERS = new Set((process.env.OWNER_STEAMIDS || '').split(',').map(s => s.trim()).filter(Boolean));
const ALLOW_GUESTS = process.env.ALLOW_GUESTS === '1';            // development / tests only: sign in without Steam
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';                // development: a guest with this token is the owner
const PROTOCOL = 1, MAX_PLAYERS = +process.env.MAX_PLAYERS || 1000;
const SPAWN = [47.9105, 33.3918];                                   // Kryvyi Rih
const CELL = 64, SEE_CELLS = 3, SEE_PLAYERS = 220;                 // holes within ±3 cells (≈200 m), players within 220 m
const log = (...a) => console.log(new Date().toISOString(), ...a);
fs.mkdirSync(DATA, { recursive: true });
const HD = require('./hd')(W, DATA);   // ~40 m relief tiles, like the Steam game

// ---------- storage (plain files; swap for a database when one process is not enough) ----------
const F = n => path.join(DATA, n);
const readJSON = (n, d) => { try { return JSON.parse(fs.readFileSync(F(n), 'utf8')); } catch (e) { return d; } };
const writeJSON = (n, v) => { const t = F(n) + '.tmp'; fs.writeFileSync(t, JSON.stringify(v)); fs.renameSync(t, F(n)); };
const appendLine = (n, v) => fs.appendFile(F(n), JSON.stringify(v) + '\n', () => {});
const accounts = readJSON('accounts.json', {});    // id -> { name, money, owned, dug, sold, earned, plot, created, seen, digs }
const bans = readJSON('bans.json', {});             // id -> { reason, at, by }
const mutes = readJSON('mutes.json', {});           // id -> until (ms)
const corps = readJSON('corps.json', {});           // corp id -> { name, tag, owner, members: [accId], officers: [accId], treasury, invites: [accId], created }
const market = readJSON('market.json', []);         // [{ id, seller, sellerName, find, price, at }]
let dirtySocial = false;
setInterval(() => { if (dirtySocial) { dirtySocial = false; writeJSON('corps.json', corps); writeJSON('market.json', market); } }, 5000).unref();
const CORP_MAX = 100, CORP_PRICE = 10000, MARKET_FEE = 0.05;
let dirtyAcc = false;
setInterval(() => { if (dirtyAcc) { dirtyAcc = false; writeJSON('accounts.json', accounts); } }, 5000).unref();

// holes: 4 doubles each, appended to holes.bin
const holes = [];                    // [x, y, z, r]
const cellHoles = new Map();         // cell key -> [hole index, ...]
const ck = (x, y, z) => Math.floor(x / CELL) + ',' + Math.floor(y / CELL) + ',' + Math.floor(z / CELL);
function indexHole(h, i) { const k = ck(h[0], h[1], h[2]); let l = cellHoles.get(k); if (!l) cellHoles.set(k, l = []); l.push(i); return k; }
(function loadHoles() {
  let buf; try { buf = fs.readFileSync(F('holes.bin')); } catch (e) { return; }
  const n = Math.floor(buf.length / 32), a = new Float64Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + n * 32));
  for (let i = 0; i < n; i++) { const h = [a[i * 4], a[i * 4 + 1], a[i * 4 + 2], a[i * 4 + 3]]; holes.push(h); indexHole(h, i); W.addHole(h[0], h[1], h[2], h[3]); }
  log('holes loaded:', n);
})();
const holeOut = fs.createWriteStream(F('holes.bin'), { flags: 'a' });
function addHole(h) { const i = holes.length; holes.push(h); W.addHole(h[0], h[1], h[2], h[3]); holeOut.write(Buffer.from(new Float64Array(h).buffer)); return indexHole(h, i); }

// ---------- accounts ----------
function plotFor(n) {   // every new player gets their own plot, on a spiral around the start (150 m apart)
  if (n === 0) return SPAWN.slice();
  const r = 150 * Math.sqrt(n), a = n * 2.399963, dy = Math.sin(a) * r, dx = Math.cos(a) * r;
  return [SPAWN[0] + dy / 111200, SPAWN[1] + dx / (111200 * Math.cos(SPAWN[0] * Math.PI / 180))];
}
function account(id, name) {
  let a = accounts[id];
  if (!a) { a = accounts[id] = { name, money: 0, owned: ['spoon'], dug: 0, sold: 0, earned: [0, 0, 0, 0, 0], plot: plotFor(Object.keys(accounts).length), created: Date.now(), digs: 0 }; dirtyAcc = true; }
  a.name = name || a.name; a.seen = Date.now(); return a;
}
const stateOf = a => ({ money: a.money, owned: a.owned, dug: a.dug, sold: a.sold, earned: a.earned });
const lookOf = a => ({ gold: a.gold || 0, skins: a.skins || [], wear: a.wear || null });
// cosmetics: ids look like c_<archetype>_<colourway>; legendary ones ("_gold") must be bought; gold packs (US cents)
const PACKS = { 1: { id: 1, gold: 100, cents: 99 }, 2: { id: 2, gold: 550, cents: 499 }, 3: { id: 3, gold: 1200, cents: 999 }, 4: { id: 4, gold: 3000, cents: 1999 } };
const SKIN_RE = /^(c|t|m)_[a-z]+_[a-zA-Z]+$/;
const LEGENDARY = id => /^c_[a-z]+_gold$/.test(id) || /^t_(gold|rose|galaxy|diamond)_/.test(id) || /^m_(gold|chrome)_/.test(id);
const PRICE = id => /^c_/.test(id) ? (LEGENDARY(id) ? 600 : 250) : /^t_/.test(id) ? ({ neon: 200, lava: 200, gold: 400, rose: 400, galaxy: 700, diamond: 900 }[id.split('_')[1]] || 0) : ({ desert: 300, forest: 300, pink: 300, gold: 800, chrome: 1000 }[id.split('_')[1]] || 0);

// ---------- connections ----------
const clients = new Map();          // session id -> client
const byAccount = new Map();        // account id -> client
const cellClients = new Map();      // cell key -> Set of clients that see this cell
let nextSid = 1;
const send = (c, m) => { if (c.ws.readyState === 1) c.ws.send(JSON.stringify(m)); };

function seeCells(c) {   // which cells this player should hear about: send holes of newly seen cells
  if (!c.pos) return;
  const cx = Math.floor(c.pos[0] / CELL), cy = Math.floor(c.pos[1] / CELL), cz = Math.floor(c.pos[2] / CELL), key = cx + ',' + cy + ',' + cz;
  if (key === c.cell) return; c.cell = key;
  const want = new Set();
  for (let a = -SEE_CELLS; a <= SEE_CELLS; a++) for (let b = -SEE_CELLS; b <= SEE_CELLS; b++) for (let d = -SEE_CELLS; d <= SEE_CELLS; d++) want.add((cx + a) + ',' + (cy + b) + ',' + (cz + d));
  const flat = [];
  for (const k of want) if (!c.cells.has(k)) { let s = cellClients.get(k); if (!s) cellClients.set(k, s = new Set()); s.add(c); const l = cellHoles.get(k); if (l) for (const i of l) flat.push(...holes[i]); }
  for (const k of c.cells) if (!want.has(k)) { const s = cellClients.get(k); if (s) { s.delete(c); if (!s.size) cellClients.delete(k); } }
  c.cells = want;
  if (flat.length) send(c, { t: 'holes', h: flat });
}
function leaveCells(c) { for (const k of c.cells) { const s = cellClients.get(k); if (s) { s.delete(c); if (!s.size) cellClients.delete(k); } } c.cells.clear(); }

const corpOf = c => c.acc && c.acc.corp ? corps[c.acc.corp] : null;
const canManage = (k, id) => k.owner === id || k.officers.includes(id);
const corpTag = a => a && a.corp && corps[a.corp] ? corps[a.corp].tag : null;
function corpTell(k, msg) { const j = JSON.stringify(msg); for (const id of k.members) { const o = byAccount.get(id); if (o && o.ws.readyState === 1) o.ws.send(j); } }
function corpRefresh(k) { for (const id of k.members) { const o = byAccount.get(id); if (o) corpInfo(o); } }
function corpInfo(c) {
  const k = corpOf(c); if (!k) return send(c, { t: 'corp', corp: null });
  send(c, { t: 'corp', corp: { id: c.acc.corp, name: k.name, tag: k.tag, owner: k.owner === c.accId, officer: canManage(k, c.accId), treasury: Math.round(k.treasury), max: CORP_MAX,
    members: k.members.map(id => ({ id, name: accounts[id] ? accounts[id].name : '?', online: byAccount.has(id), sid: byAccount.has(id) ? byAccount.get(id).sid : 0, rank: id === k.owner ? 'owner' : k.officers.includes(id) ? 'officer' : 'member' })) } });
}
function sysChat(c, key, args) { send(c, { t: 'chat', sys: key, args: args || [] }); }
function findTarget(q) {   // by session number, account id or exact name
  for (const c of clients.values()) if (String(c.sid) === q || c.accId === q || (c.acc && c.acc.name.toLowerCase() === String(q).toLowerCase())) return c;
  return null;
}

// ---------- messages ----------
const handlers = {
  async hello(c, m) {
    if (c.accId) return;
    if (m.v !== PROTOCOL) { send(c, { t: 'kicked', reason: 'version' }); return c.ws.close(); }
    let id, name, admin = false;
    try {
      if (m.ticket && steam.enabled()) { const s = await steam.verify(m.ticket); id = 's' + s.steamid; name = s.name; admin = OWNERS.has(s.steamid); c.avatar = s.avatar; }
      else if (ALLOW_GUESTS && m.guest && /^[a-zA-Z0-9]{16,64}$/.test(m.guest.token || '')) {
        id = 'g' + crypto.createHash('sha256').update(m.guest.token).digest('hex').slice(0, 20);
        name = mod.clean(String(m.guest.name || '').slice(0, 20)).text.replace(/\*+/g, '').trim() || 'Digger' + (nextSid % 1000);
        admin = !!ADMIN_TOKEN && m.guest.admin === ADMIN_TOKEN;
      } else throw new Error('sign-in');
    } catch (e) { send(c, { t: 'kicked', reason: e.message === 'banned' ? 'banned' : 'signin' }); return c.ws.close(); }
    if (bans[id]) { send(c, { t: 'kicked', reason: 'banned', why: bans[id].reason }); return c.ws.close(); }
    if (clients.size > MAX_PLAYERS) { send(c, { t: 'kicked', reason: 'full' }); return c.ws.close(); }
    const old = byAccount.get(id); if (old) { send(old, { t: 'kicked', reason: 'elsewhere' }); old.ws.close(); }
    c.accId = id; c.acc = account(id, name); c.admin = admin; byAccount.set(id, c);
    c.has = k => c.acc.owned.includes(k); c.lvl = Rules.levels(c.has);
    send(c, { t: 'welcome', sid: c.sid, name: c.acc.name, steam: id[0] === 's', admin, plot: c.acc.plot, state: stateOf(c.acc), look: lookOf(c.acc), finds: c.acc.finds || {}, players: clients.size }); setTimeout(() => { const k = corpOf(c); if (k) corpRefresh(k); else corpInfo(c); }, 50);
    log('join', c.sid, id, c.acc.name, admin ? '(owner)' : '');
  },
  pos(c, m) {
    const p = m.p; if (!Array.isArray(p) || p.length !== 3 || !p.every(Number.isFinite)) return;
    const l = Math.hypot(p[0], p[1], p[2]); if (l < W.R - 20000 || l > W.R + 10000) return;
    c.pos = p; c.f = Array.isArray(m.f) && m.f.length === 3 && m.f.every(Number.isFinite) ? m.f : (c.f || [1, 0, 0]); c.pitch = +m.pitch || 0; c.tool = String(m.tool || 'spoon').slice(0, 12); c.drive = m.drive ? String(m.drive).slice(0, 12) : null;
    seeCells(c);
    if (HD.on) { const ll = toLL(p[0], p[1], p[2]), t = W.hdTileOf(ll[0], ll[1]), tk = t.join('_'); if (tk !== c.hdTile) { c.hdTile = tk; HD.around(ll[0], ll[1], 2); } }
  },
  async dig(c, m) {
    const now = Date.now(), cc = m.c; if (!c.pos || !Array.isArray(cc) || cc.length !== 3 || !cc.every(Number.isFinite)) return;
    const T = Rules.TOOLS, mode = m.mode || 'hand';
    let maxR, reach, gap;
    if (mode === 'hand') { const tool = T[c.lvl('tool')]; maxR = Math.max(tool.r, c.has('pick') ? T.pick.r : 0) * (c.has('sharp') ? 1.08 : 1); reach = tool.r + tool.reach + c.lvl('reach') + 1.5; gap = Math.min(tool.time, T.pick.time) * c.lvl('speed') * 0.8 * 1000; }
    else if (mode === 'exMini' && c.has('exMini')) { maxR = 0.35; reach = 9; gap = 250; }
    else if (mode === 'exBig' && c.has('exBig')) { maxR = 0.7; reach = 20; gap = 250; }
    else return send(c, { t: 'dig', seq: m.seq, ok: false, why: 'tool' });
    if (c.admin && m.adminMul) maxR *= Math.min(20, Math.max(1, +m.adminMul || 1));
    const r = +m.r;
    if (!(r > 0) || r > maxR * 1.0001) return send(c, { t: 'dig', seq: m.seq, ok: false, why: 'tool' });
    if (now - (c.lastDig || 0) < gap) return send(c, { t: 'dig', seq: m.seq, ok: false, why: 'fast' });
    if (Math.hypot(cc[0] - c.pos[0], cc[1] - c.pos[1], cc[2] - c.pos[2]) > reach) return send(c, { t: 'dig', seq: m.seq, ok: false, why: 'far' });
    c.lastDig = now;
    if (HD.on) { const ll = toLL(cc[0], cc[1], cc[2]); await HD.around(ll[0], ll[1], 1); }   // the ground there is measured on the same relief as the game
    const s = Rules.scoop(W, cc, r, c.lvl);
    if (mode === 'hand' && Rules.hardShare(s.per) > 0.4 && !c.has('pick')) return send(c, { t: 'dig', seq: m.seq, ok: false, why: 'hard' });   // rock needs a pickaxe
    if (s.litres < 1e-6) return send(c, { t: 'dig', seq: m.seq, ok: true, got: 0 });
    const h = [cc[0], cc[1], cc[2], r], key = addHole(h);
    const a = c.acc; a.money += s.got; a.dug += s.litres / 1000; a.sold += s.litres; a.digs++; for (let i = 0; i < s.by.length; i++) a.earned[i] = (a.earned[i] || 0) + s.by[i]; dirtyAcc = true;
    { const ll = toLL(cc[0], cc[1], cc[2]), depth = W.depthAt(cc[0], cc[1], cc[2]), f = Rules.rollFind(depth, s.main, ll[0], ll[1], s.litres, Math.random);
      if (f) { a.finds = a.finds || {}; const first = !a.finds[f.id]; a.finds[f.id] = (a.finds[f.id] || 0) + 1; send(c, { t: 'find', id: f.id, first, count: a.finds[f.id] }); } }
    send(c, { t: 'dig', seq: m.seq, ok: true, got: s.got, litres: s.litres, main: s.main, oreL: s.by[3] + s.by[4] + (s.by[8] || 0), ore4: s.by[4] > s.by[3], money: a.money });
    const watchers = cellClients.get(key);
    if (watchers) { const msg = JSON.stringify({ t: 'hole', h, by: c.sid, main: s.main }); for (const o of watchers) if (o !== c && o.ws.readyState === 1) o.ws.send(msg); }
  },
  buy(c, m) {
    const n = Rules.canBuy(String(m.id), c.has, c.acc.money);
    if (n) { c.acc.money -= n.p; c.acc.owned.push(n.id); dirtyAcc = true; }
    send(c, { t: 'state', state: stateOf(c.acc), bought: n ? n.id : null });
  },
  chat(c, m) {
    const raw = String(m.text || ''); if (!raw.trim()) return;
    const toCorp = /^\/c\s/i.test(raw), k = toCorp ? corpOf(c) : null;
    if (raw[0] === '/' && c.admin && !toCorp) return admin(c, raw.slice(1).trim().split(/\s+/));
    if (raw[0] === '/' && !toCorp) return sysChat(c, 'unknownCmd');
    if (toCorp && !k) return sysChat(c, 'corpNone');
    const until = mutes[c.accId]; if (until && until > Date.now()) return sysChat(c, 'muted', [Math.ceil((until - Date.now()) / 60000)]);
    const lim = c.limiter(raw, Date.now()); if (lim) return sysChat(c, lim);
    const { text, hidden } = mod.clean(toCorp ? raw.slice(3) : raw); if (!text.replace(/\*/g, '').trim()) return sysChat(c, 'hidden');
    appendLine('chat.log', { at: Date.now(), id: c.accId, name: c.acc.name, raw, text });
    if (hidden) { c.strikes = (c.strikes || 0) + 1; if (c.strikes >= 3) { mutes[c.accId] = Date.now() + 10 * 60000; writeJSON('mutes.json', mutes); c.strikes = 0; sysChat(c, 'autoMuted', [10]); } }
    if (k) return corpTell(k, { t: 'chat', from: c.sid, name: c.acc.name, text, corp: k.tag });
    const msg = JSON.stringify({ t: 'chat', from: c.sid, name: c.acc.name, text, tag: corpTag(c.acc) });
    // chat is heard by the players around (the same distance as you can see them) — no private messages
    for (const o of clients.values()) if (o.pos && c.pos && Math.hypot(o.pos[0] - c.pos[0], o.pos[1] - c.pos[1], o.pos[2] - c.pos[2]) < SEE_PLAYERS * 2 && o.ws.readyState === 1) o.ws.send(msg);
  },
  report(c, m) {
    const o = findTarget(String(m.who || '')); if (!o) return sysChat(c, 'noPlayer');
    appendLine('reports.log', { at: Date.now(), from: c.accId, fromName: c.acc.name, who: o.accId, whoName: o.acc.name, reason: String(m.reason || '').slice(0, 300) });
    sysChat(c, 'reported');
  },
  ping(c, m) { send(c, { t: 'pong', t0: m.t0 }); },
  // ---------- corporations: up to 100 members, a shared treasury, their own chat ----------
  corpCreate(c, m) {
    const a = c.acc, name = mod.clean(String(m.name || '').slice(0, 32)).text.trim(), tag = mod.clean(String(m.tag || '').slice(0, 4)).text.replace(/[^\p{L}\p{N}]/gu, '').toUpperCase();
    if (a.corp && corps[a.corp]) return sysChat(c, 'corpHave');
    if (name.length < 3 || /\*/.test(name) || tag.length < 2 || /\*/.test(tag)) return sysChat(c, 'corpName');
    if (Object.values(corps).some(k => k.name.toLowerCase() === name.toLowerCase() || k.tag === tag)) return sysChat(c, 'corpTaken');
    if (a.money < CORP_PRICE) return sysChat(c, 'corpMoney');
    a.money -= CORP_PRICE; const id = 'k' + Date.now().toString(36);
    corps[id] = { name, tag, owner: c.accId, members: [c.accId], officers: [], treasury: 0, invites: [], created: Date.now() }; a.corp = id; dirtyAcc = dirtySocial = true;
    send(c, { t: 'state', state: stateOf(a) }); corpInfo(c);
  },
  corpInvite(c, m) {
    const k = corpOf(c), o = clients.get(m.sid | 0); if (!k || !o || !o.acc || !canManage(k, c.accId)) return;
    if (k.members.length >= CORP_MAX) return sysChat(c, 'corpFull');
    if (!k.invites.includes(o.accId)) k.invites.push(o.accId); dirtySocial = true;
    send(o, { t: 'corpInvite', id: c.acc.corp, name: k.name, tag: k.tag, from: c.acc.name }); sysChat(c, 'done');
  },
  corpJoin(c, m) {
    const id = String(m.id || ''), k = corps[id]; if (!k || c.acc.corp || !k.invites.includes(c.accId)) return;
    if (k.members.length >= CORP_MAX) return sysChat(c, 'corpFull');
    k.invites = k.invites.filter(x => x !== c.accId); k.members.push(c.accId); c.acc.corp = id; dirtyAcc = dirtySocial = true;
    corpTell(k, { t: 'chat', sys: 'corpJoined', args: [c.acc.name] }); corpRefresh(k);
  },
  corpLeave(c) {
    const k = corpOf(c); if (!k) return;
    k.members = k.members.filter(x => x !== c.accId); k.officers = k.officers.filter(x => x !== c.accId); c.acc.corp = null;
    if (k.owner === c.accId) { if (k.members.length) { k.owner = k.officers[0] || k.members[0]; } else { delete corps[Object.keys(corps).find(i => corps[i] === k)]; } }
    dirtyAcc = dirtySocial = true; send(c, { t: 'corp', corp: null }); if (k.members.length) corpRefresh(k);
  },
  corpKick(c, m) {
    const k = corpOf(c), who = String(m.who || ''); if (!k || !canManage(k, c.accId) || who === k.owner || !k.members.includes(who)) return;
    k.members = k.members.filter(x => x !== who); k.officers = k.officers.filter(x => x !== who); if (accounts[who]) accounts[who].corp = null;
    dirtyAcc = dirtySocial = true; const o = byAccount.get(who); if (o) send(o, { t: 'corp', corp: null }); corpRefresh(k);
  },
  corpRank(c, m) {   // the owner makes a member an officer (can invite and kick) or back
    const k = corpOf(c), who = String(m.who || ''); if (!k || k.owner !== c.accId || !k.members.includes(who) || who === k.owner) return;
    k.officers = k.officers.includes(who) ? k.officers.filter(x => x !== who) : k.officers.concat([who]); dirtySocial = true; corpRefresh(k);
  },
  corpDeposit(c, m) {
    const k = corpOf(c), v = Math.floor(+m.amount || 0); if (!k || !(v > 0) || c.acc.money < v) return;
    c.acc.money -= v; k.treasury += v; dirtyAcc = dirtySocial = true; send(c, { t: 'state', state: stateOf(c.acc) }); corpTell(k, { t: 'chat', sys: 'corpDeposit', args: [c.acc.name, v] }); corpRefresh(k);
  },
  corpWithdraw(c, m) {   // only the owner pays out of the treasury
    const k = corpOf(c), v = Math.floor(+m.amount || 0); if (!k || k.owner !== c.accId || !(v > 0) || k.treasury < v) return;
    k.treasury -= v; c.acc.money += v; dirtyAcc = dirtySocial = true; send(c, { t: 'state', state: stateOf(c.acc) }); corpRefresh(k);
  },
  corpInfo(c) { corpInfo(c); },
  corpTop(c) { send(c, { t: 'corpTop', list: Object.values(corps).sort((a, b) => b.treasury - a.treasury).slice(0, 20).map(k => ({ name: k.name, tag: k.tag, members: k.members.length, treasury: Math.round(k.treasury) })) }); },
  // ---------- the market: duplicate finds for money, between players ----------
  marketList(c) { send(c, { t: 'market', list: market.slice(-200).map(o => ({ id: o.id, find: o.find, price: o.price, seller: o.sellerName, mine: o.seller === c.accId })), finds: c.acc.finds || {} }); },
  marketSell(c, m) {
    const f = String(m.find || ''), price = Math.round(+m.price || 0), a = c.acc; a.finds = a.finds || {};
    if (!Rules.FINDS.some(x => x.id === f) || (a.finds[f] || 0) < 2 || !(price >= 1 && price <= 1e9)) return;   // the first one stays in your museum
    if (market.filter(o => o.seller === c.accId).length >= 20) return sysChat(c, 'marketMax');
    a.finds[f]--; market.push({ id: 'o' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), seller: c.accId, sellerName: a.name, find: f, price, at: Date.now() }); dirtyAcc = dirtySocial = true; handlers.marketList(c);
  },
  marketBuy(c, m) {
    const i = market.findIndex(o => o.id === m.id); if (i < 0) return; const o = market[i], a = c.acc;
    if (o.seller === c.accId || a.money < o.price) return;
    a.money -= o.price; a.finds = a.finds || {}; a.finds[o.find] = (a.finds[o.find] || 0) + 1;
    const sel = accounts[o.seller]; if (sel) sel.money += o.price * (1 - MARKET_FEE);
    market.splice(i, 1); dirtyAcc = dirtySocial = true; appendLine('market.log', { at: Date.now(), buyer: c.accId, seller: o.seller, find: o.find, price: o.price });
    send(c, { t: 'state', state: stateOf(a) }); send(c, { t: 'find', id: o.find, first: a.finds[o.find] === 1, count: a.finds[o.find], bought: true }); handlers.marketList(c);
    const sc = byAccount.get(o.seller); if (sc) { send(sc, { t: 'state', state: stateOf(sel) }); send(sc, { t: 'chat', sys: 'marketSold', args: [o.price] }); }
  },
  marketCancel(c, m) {
    const i = market.findIndex(o => o.id === m.id && o.seller === c.accId); if (i < 0) return;
    const o = market.splice(i, 1)[0]; c.acc.finds[o.find] = (c.acc.finds[o.find] || 0) + 1; dirtyAcc = dirtySocial = true; handlers.marketList(c);
  },
  // ---------- voice chat: the server only passes connection offers between two players who may talk ----------
  // (friends of each other, or the same corporation, and both have voice switched on)
  rtc(c, m) {
    const o = clients.get(m.to | 0); if (!o || !o.acc || !c.voice || !o.voice) return;
    const mates = (c.acc.corp && c.acc.corp === o.acc.corp) || ((c.acc.friends || []).includes(o.accId) && (o.acc.friends || []).includes(c.accId));
    if (!mates) return;
    send(o, { t: 'rtc', from: c.sid, name: c.acc.name, data: m.data });
  },
  voice(c, m) { c.voice = !!m.on; },
  // what you look like to others (costume, emblem, level); legendary costumes only if owned
  look(c, m) {
    const l = m.look || {}, cos = String(l.costume || '');
    c.look = { costume: SKIN_RE.test(cos) && (!LEGENDARY(cos) || (c.acc.skins || []).includes(cos)) ? cos : 'c_miner_classic', emblem: String(l.emblem || '').slice(0, 16), level: Math.max(1, Math.min(999, l.level | 0)) };
  },
  wear(c, m) { if (m.wear && typeof m.wear === 'object') { c.acc.wear = JSON.parse(JSON.stringify(m.wear).slice(0, 2000)); dirtyAcc = true; } },
  buySkin(c, m) {
    const id = String(m.id || ''), price = PRICE(id), a = c.acc; a.skins = a.skins || []; a.gold = a.gold || 0;
    if (SKIN_RE.test(id) && price > 0 && !a.skins.includes(id) && a.gold >= price) { a.gold -= price; a.skins.push(id); dirtyAcc = true; appendLine('purchases.log', { at: Date.now(), id: c.accId, skin: id, gold: price }); }
    send(c, { t: 'look', ...lookOf(a) });
  },
  // gold through Steam: start the order; the player approves it in the Steam overlay; then it is finalised and paid
  async goldBuy(c, m) {
    const pack = PACKS[m.pack | 0]; if (!pack || c.accId[0] !== 's' || !steam.enabled()) return send(c, { t: 'txn', ok: false });
    const orderid = Date.now() * 1000 + Math.floor(Math.random() * 1000);
    try { await steam.initTxn(orderid, c.accId.slice(1), pack, m.lang); } catch (e) { log('txn init', e.message); return send(c, { t: 'txn', ok: false }); }
    appendLine('purchases.log', { at: Date.now(), id: c.accId, order: orderid, pack: pack.id, state: 'init' });
    for (let i = 0; i < 60; i++) {   // up to 3 minutes for the player to approve
      await new Promise(r => setTimeout(r, 3000));
      const q = await steam.queryTxn(orderid).catch(() => null);
      if (!q) continue;
      if (q.status === 'Approved') {
        if (await steam.finalizeTxn(orderid).catch(() => false)) {
          const a = accounts[c.accId]; a.gold = (a.gold || 0) + pack.gold; dirtyAcc = true;
          appendLine('purchases.log', { at: Date.now(), id: c.accId, order: orderid, gold: pack.gold, state: 'paid' });
          const cl = byAccount.get(c.accId); if (cl) { send(cl, { t: 'look', ...lookOf(a) }); send(cl, { t: 'txn', ok: true, gold: pack.gold }); }
        }
        return;
      }
      if (q.status === 'Failed' || q.status === 'Refunded' || q.status === 'Init' && i > 50) return send(c, { t: 'txn', ok: false });
    }
  },
  friend(c, m) {
    const o = clients.get(m.sid | 0); if (!o || !o.acc || o === c) return;
    c.acc.friends = c.acc.friends || []; if (!c.acc.friends.includes(o.accId) && c.acc.friends.length < 200) { c.acc.friends.push(o.accId); dirtyAcc = true; }
    handlers.friends(c);
  },
  friends(c) { send(c, { t: 'friends', list: (c.acc.friends || []).map(id => ({ name: accounts[id] ? accounts[id].name : '?', online: byAccount.has(id), sid: byAccount.has(id) ? byAccount.get(id).sid : 0 })) }); }
};
// owner commands (typed in chat): /ban <player> <reason>, /unban <id>, /mute <player> <minutes>, /unmute <player>, /kick <player>, /say <text>, /who
function admin(c, a) {
  const cmd = (a[0] || '').toLowerCase(), o = a[1] ? findTarget(a[1]) : null, id = o ? o.accId : a[1];
  if (cmd === 'ban' && id) { bans[id] = { reason: a.slice(2).join(' ').slice(0, 200), at: Date.now(), by: c.accId }; writeJSON('bans.json', bans); if (o) { send(o, { t: 'kicked', reason: 'banned', why: bans[id].reason }); o.ws.close(); } log('ban', id); return sysChat(c, 'done'); }
  if (cmd === 'unban' && id) { delete bans[id]; writeJSON('bans.json', bans); return sysChat(c, 'done'); }
  if (cmd === 'mute' && id) { mutes[id] = Date.now() + Math.max(1, +a[2] || 60) * 60000; writeJSON('mutes.json', mutes); return sysChat(c, 'done'); }
  if (cmd === 'unmute' && id) { delete mutes[id]; writeJSON('mutes.json', mutes); return sysChat(c, 'done'); }
  if (cmd === 'kick' && o) { send(o, { t: 'kicked', reason: 'kicked' }); o.ws.close(); return sysChat(c, 'done'); }
  if (cmd === 'say') { const text = a.slice(1).join(' ').slice(0, 300); for (const x of clients.values()) send(x, { t: 'chat', sys: 'announce', args: [text] }); return; }
  if (cmd === 'who') return send(c, { t: 'chat', sys: 'who', args: [[...clients.values()].filter(x => x.acc).map(x => x.sid + ':' + x.acc.name + ':' + x.accId).join('  ')] });
  sysChat(c, 'unknownCmd');
}

// ---------- the world goes on ----------
// players around each player, 10 times a second
setInterval(() => {
  const grid = new Map(), G = SEE_PLAYERS;
  for (const c of clients.values()) if (c.pos && c.acc) { const k = Math.floor(c.pos[0] / G) + ',' + Math.floor(c.pos[1] / G) + ',' + Math.floor(c.pos[2] / G); let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(c); }
  for (const c of clients.values()) {
    if (!c.pos || !c.acc) continue;
    const gx = Math.floor(c.pos[0] / G), gy = Math.floor(c.pos[1] / G), gz = Math.floor(c.pos[2] / G), list = [];
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let d = -1; d <= 1; d++) {
      const l = grid.get((gx + a) + ',' + (gy + b) + ',' + (gz + d)); if (!l) continue;
      for (const o of l) if (o !== c && Math.hypot(o.pos[0] - c.pos[0], o.pos[1] - c.pos[1], o.pos[2] - c.pos[2]) < G) list.push([o.sid, o.acc.name, +o.pos[0].toFixed(2), +o.pos[1].toFixed(2), +o.pos[2].toFixed(2), +o.f[0].toFixed(3), +o.f[1].toFixed(3), +o.f[2].toFixed(3), +o.pitch.toFixed(3), o.tool, o.drive, o.look || null, corpTag(o.acc), o.acc.plot]);
    }
    if (list.length || c.sawOthers) { send(c, { t: 'players', list }); c.sawOthers = list.length > 0; }
  }
}, 100).unref();
// machines and rigs work while their owner is online: paid every second at their average rate
setInterval(() => {
  for (const c of clients.values()) {
    if (!c.acc) continue;
    const L = c.lvl, H = c.has, clay = Rules.MATS[1].p, ore = (Rules.MATS[3].p * 0.6 + Rules.MATS[4].p * 0.4) * L('ore');
    const sphere = r => 4 / 3 * Math.PI * r * r * r * 1000 * 0.5;
    let perSec = L('rigs') * Rules.RIG_L * L('rigL') / L('rigPeriod') * clay * L('rigPay');
    if (H('exMini')) perSec += sphere(0.35) / 2.6 * clay * (H('truck') ? 2 : 1);
    if (H('exBig')) perSec += sphere(0.7) / 3.2 * clay * (H('truck') ? 2 : 1);
    if (H('wheel')) perSec += 400 * clay; if (H('bore')) perSec += 15 * Rules.MATS[2].p; if (H('derrick')) perSec += 60 * Rules.MATS[2].p; if (H('shaft')) perSec += 200 * ore;
    if (H('bank')) { c.bankT = (c.bankT || 0) + 1; if (c.bankT >= 60) { c.bankT = 0; perSec += Math.min(10, c.acc.money * 0.01); } }
    perSec *= L('scale');
    if (perSec > 0) { c.acc.money += perSec; dirtyAcc = true; if ((c.tick = (c.tick || 0) + 1) % 2 === 0) send(c, { t: 'money', money: c.acc.money }); }
  }
}, 1000).unref();

// ---------- http: health, error reports from the game ----------
const errLimit = new Map();
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Headers', 'content-type'); res.end(); return; }
  if (req.url === '/health') {
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ ok: true, protocol: PROTOCOL, players: [...clients.values()].filter(c => c.acc).length, holes: holes.length, accounts: Object.keys(accounts).length, hdTiles: HD.count(), uptime: Math.round(process.uptime()), memMB: Math.round(process.memoryUsage().rss / 1048576) }));
  }
  if (req.url === '/api/error' && req.method === 'POST') {   // the game reports its own crashes here (no personal data)
    const ip = req.socket.remoteAddress, n = (errLimit.get(ip) || 0) + 1; errLimit.set(ip, n);
    let body = ''; req.on('data', d => { body += d; if (body.length > 8192) req.destroy(); });
    req.on('end', () => { if (n <= 20) { try { const e = JSON.parse(body); appendLine('errors.log', { at: Date.now(), msg: String(e.msg).slice(0, 500), stack: String(e.stack || '').slice(0, 3000), ver: String(e.ver || '').slice(0, 40), ua: String(req.headers['user-agent'] || '').slice(0, 200) }); } catch (x) {} } res.end('ok'); });
    return;
  }
  // for whoever maintains the game: recent crash reports, player reports, health (needs ADMIN_API_TOKEN)
  if (req.url.startsWith('/api/admin/') && process.env.ADMIN_API_TOKEN && req.headers.authorization === 'Bearer ' + process.env.ADMIN_API_TOKEN) {
    const what = req.url.slice(11).split('?')[0], files = { errors: 'errors.log', reports: 'reports.log', chat: 'chat.log' };
    if (files[what]) { res.setHeader('content-type', 'text/plain; charset=utf-8'); let t = ''; try { t = fs.readFileSync(F(files[what]), 'utf8'); } catch (e) {} return res.end(t.split('\n').slice(-300).join('\n')); }
  }
  res.statusCode = 404; res.end('Endless Digging server');
});
setInterval(() => errLimit.clear(), 3600000).unref();

const wss = new WebSocketServer({ server, maxPayload: 16 * 1024, perMessageDeflate: { threshold: 1024 } });
wss.on('connection', ws => {
  const c = { ws, sid: nextSid++, cells: new Set(), limiter: mod.makeLimiter(), msgs: 0, msgT: Date.now() };
  clients.set(c.sid, c);
  const timer = setTimeout(() => { if (!c.accId) ws.close(); }, 15000);
  ws.on('message', async data => {
    // a game sends ~12 messages a second; far more means a broken or hostile client
    const now = Date.now(); if (now - c.msgT > 1000) { c.msgT = now; c.msgs = 0; } if (++c.msgs > 60) return;
    let m; try { m = JSON.parse(data); } catch (e) { return; }
    const h = handlers[m && m.t]; if (!h || (m.t !== 'hello' && !c.accId)) return;
    try { await h(c, m); } catch (e) { log('handler error', m.t, e.stack); }
  });
  ws.on('close', () => {
    clearTimeout(timer); clients.delete(c.sid); leaveCells(c);
    if (c.accId && byAccount.get(c.accId) === c) { byAccount.delete(c.accId); const k = corpOf(c); if (k) corpRefresh(k); }
    if (c.acc) { log('leave', c.sid, c.accId); for (const o of clients.values()) send(o, { t: 'left', sid: c.sid }); }
  });
  ws.on('error', () => {});
});
server.listen(PORT, () => log(`Endless Digging server on :${PORT} — steam sign-in ${steam.enabled() ? 'on' : 'OFF'}, guests ${ALLOW_GUESTS ? 'allowed' : 'off'}, ${holes.length} holes, ${Object.keys(accounts).length} accounts`));
const stop = () => { log('stopping'); if (dirtyAcc) writeJSON('accounts.json', accounts); holeOut.end(() => process.exit(0)); setTimeout(() => process.exit(0), 2000); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
module.exports = { server };
