// Social features on a temporary server: corporations (found, invite, join, treasury, corp chat, kick, leave),
// the market for duplicate finds (sell, buy with the fee, cancel, no selling the last one), voice signalling rules.
'use strict';
const { spawn } = require('child_process'), path = require('path'), fs = require('fs'), os = require('os'), crypto = require('crypto'), WebSocket = require('ws');
const assert = require('assert');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eds-')), PORT = 19790 + Math.floor(Math.random() * 1000);
const idOf = t => 'g' + crypto.createHash('sha256').update(t).digest('hex').slice(0, 20);
const T = { a: 'aaaaaaaaaaaaaaaaaaaaaaaa', b: 'bbbbbbbbbbbbbbbbbbbbbbbb', c: 'cccccccccccccccccccccccc' };
const acc = (name, money, finds, plot) => ({ name, money, owned: ['spoon'], dug: 0, sold: 0, earned: [0, 0, 0, 0, 0], plot, created: Date.now(), digs: 0, finds });
fs.writeFileSync(path.join(dir, 'accounts.json'), JSON.stringify({
  [idOf(T.a)]: acc('Alice', 50000, { coin: 3, amber: 1 }, [47.91, 33.39]),
  [idOf(T.b)]: acc('Bob', 2000, {}, [47.912, 33.392]),
  [idOf(T.c)]: acc('Carol', 100, {}, [47.914, 33.394]) }));
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: Object.assign({}, process.env, { PORT, DATA_DIR: dir, ALLOW_GUESTS: '1', HD_TILES: '0' }), stdio: ['ignore', 'pipe', 'inherit'] });
const fromLatLon = (lat, lon, h) => { const a = lat * Math.PI / 180, b = lon * Math.PI / 180, R = 6371000 + h; return [Math.cos(a) * Math.cos(b) * R, Math.sin(a) * R, -Math.cos(a) * Math.sin(b) * R]; };
const wait = ms => new Promise(r => setTimeout(r, ms));
function player(name, token) {
  const ws = new WebSocket('ws://localhost:' + PORT), inbox = [];
  const p = { ws, inbox, send: m => ws.send(JSON.stringify(m)),
    next: (t, ms = 3000, f) => new Promise((res, rej) => { const t0 = Date.now(); (function look() { const i = inbox.findIndex(m => m.t === t && (!f || f(m))); if (i >= 0) return res(inbox.splice(i, 1)[0]); if (Date.now() - t0 > ms) return rej(new Error(name + ': no ' + t)); setTimeout(look, 20); })(); }) };
  ws.on('message', d => inbox.push(JSON.parse(d)));
  return new Promise(res => ws.on('open', () => { p.send({ t: 'hello', v: 1, guest: { token, name } }); res(p); }));
}
(async () => {
  await new Promise(r => srv.stdout.on('data', d => { if (/server on/.test(d)) r(); }));
  const a = await player('Alice', T.a), b = await player('Bob', T.b), c = await player('Carol', T.c);
  const wa = await a.next('welcome'), wb = await b.next('welcome'), wc = await c.next('welcome');
  assert.equal(wa.finds.coin, 3); console.log('ok  finds come with the welcome');
  // found a corporation
  b.send({ t: 'corpCreate', name: 'Poor Co', tag: 'PC' }); assert.equal((await b.next('chat', 3000, m => m.sys)).sys, 'corpMoney');
  a.send({ t: 'corpCreate', name: 'Deep Diggers', tag: 'dd!' }); let k = (await a.next('corp', 3000, m => m.corp)).corp;
  assert.equal(k.tag, 'DD'); assert.equal(k.owner, true); assert.equal(k.members.length, 1);
  assert.equal((await a.next('state')).state.money, 40000); console.log('ok  corporation founded for $10,000, tag cleaned:', k.tag);
  b.send({ t: 'corpCreate', name: 'deep diggers', tag: 'XY' }); assert.equal((await b.next('chat', 3000, m => m.sys)).sys, 'corpTaken');
  // invite + join
  c.send({ t: 'corpJoin', id: k.id }); await wait(200); assert(!c.inbox.some(m => m.t === 'corp' && m.corp)); console.log('ok  no joining without an invitation');
  a.send({ t: 'corpInvite', sid: wb.sid }); const inv = await b.next('corpInvite'); assert.equal(inv.tag, 'DD');
  b.send({ t: 'corpJoin', id: inv.id }); k = (await b.next('corp', 3000, m => m.corp)).corp; assert.equal(k.members.length, 2); assert.equal(k.officer, false);
  assert.equal((await a.next('chat', 3000, m => m.sys === 'corpJoined')).args[0], 'Bob'); console.log('ok  invite and join');
  // treasury: members put in, only the head takes out
  b.send({ t: 'corpDeposit', amount: 500 }); assert.equal((await b.next('state')).state.money, 1500);
  assert.deepEqual((await a.next('chat', 3000, m => m.sys === 'corpDeposit')).args, ['Bob', 500]);
  b.send({ t: 'corpWithdraw', amount: 100 }); await wait(200); assert(!b.inbox.some(m => m.t === 'state'));
  a.send({ t: 'corpWithdraw', amount: 200 }); assert.equal((await a.next('state')).state.money, 40200); console.log('ok  treasury: deposit by a member, withdraw only by the head');
  b.send({ t: 'corpDeposit', amount: 1e9 }); await wait(200); assert(!b.inbox.some(m => m.t === 'state')); console.log('ok  no depositing money you do not have');
  // corporation chat reaches members only
  await wait(1100); c.inbox.length = 0; b.send({ t: 'chat', text: '/c hello team' });
  const cm = await a.next('chat', 3000, m => m.corp); assert.equal(cm.text, 'hello team'); assert.equal(cm.corp, 'DD');
  await wait(300); assert(!c.inbox.some(m => m.t === 'chat' && m.corp)); console.log('ok  /c corporation chat goes to members only');
  await wait(1100); c.send({ t: 'chat', text: '/c hi' }); assert.equal((await c.next('chat', 3000, m => m.sys)).sys, 'corpNone');
  // tag over the name in the players list
  for (const p of [a, b, c]) p.send({ t: 'pos', p: fromLatLon(47.91, 33.39, 96), yaw: 0, pitch: 0 });
  const pl = await c.next('players', 3000, m => m.list.some(e => e[1] === 'Alice')); const ae = pl.list.find(e => e[1] === 'Alice');
  assert.equal(ae[12], 'DD'); assert(Array.isArray(ae[13])); console.log('ok  others see the tag and the plot (for the base)');
  // ranks and kicking
  a.send({ t: 'corpRank', who: idOf(T.b) }); k = (await a.next('corp', 3000, m => m.corp && m.corp.members.some(x => x.rank === 'officer'))).corp; console.log('ok  head makes an officer');
  a.send({ t: 'corpKick', who: idOf(T.b) }); assert.equal((await b.next('corp', 3000, m => !m.corp)).corp, null); console.log('ok  kick');
  // market
  a.send({ t: 'marketSell', find: 'amber', price: 50 }); a.send({ t: 'marketList' }); let mk = await a.next('market'); assert.equal(mk.list.length, 0); console.log('ok  the only one of a kind cannot be sold');
  a.send({ t: 'marketSell', find: 'coin', price: 1000 }); mk = await a.next('market'); assert.equal(mk.list.length, 1); assert.equal(mk.finds.coin, 2);
  c.send({ t: 'marketList' }); mk = await c.next('market'); const off = mk.list[0]; assert.equal(off.mine, false);
  c.send({ t: 'marketBuy', id: off.id }); await wait(300); assert(!c.inbox.some(m => m.t === 'find')); console.log('ok  cannot buy without the money');
  b.send({ t: 'marketBuy', id: off.id }); const bf = await b.next('find'); assert.equal(bf.id, 'coin'); assert.equal(bf.first, true);
  assert.equal((await b.next('state')).state.money, 500); const sold = await a.next('chat', 3000, m => m.sys === 'marketSold'); assert.equal(sold.args[0], 1000);
  const as = await a.next('state', 3000, m => m.state.money > 40200); assert.equal(as.state.money, 40200 + 950); console.log('ok  bought; seller gets $950 (5 % fee)');
  a.send({ t: 'marketSell', find: 'coin', price: 10 }); mk = await a.next('market'); const mine = mk.list.find(o => o.mine); a.send({ t: 'marketCancel', id: mine.id }); mk = await a.next('market'); assert.equal(mk.list.length, 0); assert.equal(mk.finds.coin, 2); console.log('ok  cancel gives the find back');
  // voice: signalling only between corporation mates or mutual friends who switched voice on
  a.send({ t: 'voice', on: true }); c.send({ t: 'voice', on: true }); await wait(100);
  a.send({ t: 'rtc', to: wc.sid, data: { sdp: 'x' } }); await wait(300); assert(!c.inbox.some(m => m.t === 'rtc')); console.log('ok  no voice with strangers');
  a.send({ t: 'friend', sid: wc.sid }); c.send({ t: 'friend', sid: wa.sid }); await wait(200);
  a.send({ t: 'rtc', to: wc.sid, data: { sdp: 'x' } }); assert.equal((await c.next('rtc')).from, wa.sid); console.log('ok  voice offer passes between mutual friends');
  c.send({ t: 'voice', on: false }); await wait(100); a.send({ t: 'rtc', to: wc.sid, data: { sdp: 'y' } }); await wait(300); assert(!c.inbox.some(m => m.t === 'rtc')); console.log('ok  nothing reaches a player with voice off');
  // leaving: the last member leaving closes the corporation
  a.send({ t: 'corpLeave' }); assert.equal((await a.next('corp', 3000, m => !m.corp)).corp, null);
  a.send({ t: 'corpTop' }); assert.equal((await a.next('corpTop')).list.length, 0); console.log('ok  last one out closes the corporation');
  await wait(5500); const saved = JSON.parse(fs.readFileSync(path.join(dir, 'market.json'), 'utf8')); assert(Array.isArray(saved)); console.log('ok  saved to disk');
  for (const p of [a, b, c]) p.ws.close(); srv.kill('SIGTERM'); console.log('ALL OK'); process.exit(0);
})().catch(e => { console.error('FAIL', e.stack || e.message); srv.kill(); process.exit(1); });
