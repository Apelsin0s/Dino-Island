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
    send(c, { t: 'welcome', sid: c.sid, name: c.acc.name, admin, plot: c.acc.plot, state: stateOf(c.acc), players: clients.size });
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
    if (raw[0] === '/' && c.admin) return admin(c, raw.slice(1).trim().split(/\s+/));
    if (raw[0] === '/') return sysChat(c, 'unknownCmd');
    const until = mutes[c.accId]; if (until && until > Date.now()) return sysChat(c, 'muted', [Math.ceil((until - Date.now()) / 60000)]);
    const lim = c.limiter(raw, Date.now()); if (lim) return sysChat(c, lim);
    const { text, hidden } = mod.clean(raw); if (!text.replace(/\*/g, '').trim()) return sysChat(c, 'hidden');
    appendLine('chat.log', { at: Date.now(), id: c.accId, name: c.acc.name, raw, text });
    if (hidden) { c.strikes = (c.strikes || 0) + 1; if (c.strikes >= 3) { mutes[c.accId] = Date.now() + 10 * 60000; writeJSON('mutes.json', mutes); c.strikes = 0; sysChat(c, 'autoMuted', [10]); } }
    const msg = JSON.stringify({ t: 'chat', from: c.sid, name: c.acc.name, text });
    // chat is heard by the players around (the same distance as you can see them) — no private messages
    for (const o of clients.values()) if (o.pos && c.pos && Math.hypot(o.pos[0] - c.pos[0], o.pos[1] - c.pos[1], o.pos[2] - c.pos[2]) < SEE_PLAYERS * 2 && o.ws.readyState === 1) o.ws.send(msg);
  },
  report(c, m) {
    const o = findTarget(String(m.who || '')); if (!o) return sysChat(c, 'noPlayer');
    appendLine('reports.log', { at: Date.now(), from: c.accId, fromName: c.acc.name, who: o.accId, whoName: o.acc.name, reason: String(m.reason || '').slice(0, 300) });
    sysChat(c, 'reported');
  },
  ping(c, m) { send(c, { t: 'pong', t0: m.t0 }); }
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
      for (const o of l) if (o !== c && Math.hypot(o.pos[0] - c.pos[0], o.pos[1] - c.pos[1], o.pos[2] - c.pos[2]) < G) list.push([o.sid, o.acc.name, +o.pos[0].toFixed(2), +o.pos[1].toFixed(2), +o.pos[2].toFixed(2), +o.f[0].toFixed(3), +o.f[1].toFixed(3), +o.f[2].toFixed(3), +o.pitch.toFixed(3), o.tool, o.drive]);
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
    if (c.accId && byAccount.get(c.accId) === c) byAccount.delete(c.accId);
    if (c.acc) { log('leave', c.sid, c.accId); for (const o of clients.values()) send(o, { t: 'left', sid: c.sid }); }
  });
  ws.on('error', () => {});
});
server.listen(PORT, () => log(`Endless Digging server on :${PORT} — steam sign-in ${steam.enabled() ? 'on' : 'OFF'}, guests ${ALLOW_GUESTS ? 'allowed' : 'off'}, ${holes.length} holes, ${Object.keys(accounts).length} accounts`));
const stop = () => { log('stopping'); if (dirtyAcc) writeJSON('accounts.json', accounts); holeOut.end(() => process.exit(0)); setTimeout(() => process.exit(0), 2000); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
module.exports = { server };
