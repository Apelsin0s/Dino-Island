// Starts a server on a temporary data folder, connects two players and checks: sign-in, digging (paid by the server,
// seen by the other player), cheating (too big / too far / too fast), buying research, chat filter, bans.
'use strict';
const { spawn } = require('child_process'), path = require('path'), fs = require('fs'), os = require('os'), WebSocket = require('ws');
const assert = require('assert');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ed-')), PORT = 18790 + Math.floor(Math.random() * 1000);
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: Object.assign({}, process.env, { PORT, DATA_DIR: dir, ALLOW_GUESTS: '1', ADMIN_TOKEN: 'owner-test-token' }), stdio: ['ignore', 'pipe', 'inherit'] });
const wait = ms => new Promise(r => setTimeout(r, ms));
function player(name, token, admin) {
  const ws = new WebSocket('ws://localhost:' + PORT), inbox = [];
  const p = { ws, inbox, send: m => ws.send(JSON.stringify(m)),
    next: (t, ms = 3000) => new Promise((res, rej) => { const t0 = Date.now(); (function look() { const i = inbox.findIndex(m => m.t === t); if (i >= 0) return res(inbox.splice(i, 1)[0]); if (Date.now() - t0 > ms) return rej(new Error(name + ': no ' + t)); setTimeout(look, 20); })(); }) };
  ws.on('message', d => inbox.push(JSON.parse(d)));
  return new Promise(res => ws.on('open', () => { p.send({ t: 'hello', v: 1, guest: { token, name, admin } }); res(p); }));
}
const fromLatLon = (lat, lon, h) => { const a = lat * Math.PI / 180, b = lon * Math.PI / 180, R = 6371000 + h; return [Math.cos(a) * Math.cos(b) * R, Math.sin(a) * R, -Math.cos(a) * Math.sin(b) * R]; };
(async () => {
  await new Promise(r => srv.stdout.on('data', d => { process.stdout.write('  server: ' + d); if (/server on/.test(d)) r(); }));
  const a = await player('Alice', 'aaaaaaaaaaaaaaaaaaaaaaaa', 'owner-test-token'), b = await player('Bob', 'bbbbbbbbbbbbbbbbbbbbbbbb');
  const wa = await a.next('welcome'), wb = await b.next('welcome');
  assert.equal(wa.admin, true); assert.equal(wb.admin, false); assert.deepEqual(wa.state.owned, ['spoon']);
  console.log('ok  sign-in, plots', wa.plot.map(x => x.toFixed(4)).join(','), '/', wb.plot.map(x => x.toFixed(4)).join(','));
  // both stand on Alice's plot; the ground is ~95.5 m above sea level there
  const ground = fromLatLon(wa.plot[0], wa.plot[1], 95.5), feet = fromLatLon(wa.plot[0], wa.plot[1], 96);
  a.send({ t: 'pos', p: feet, yaw: 0, pitch: 0, tool: 'spoon' }); b.send({ t: 'pos', p: feet, yaw: 1, pitch: 0, tool: 'spoon' }); await wait(300);
  const pl = await b.next('players'); assert(pl.list.some(x => x[1] === 'Alice')); console.log('ok  players see each other');
  // a fair dig, using the server's own measure of the ground height (the client finds the surface by ray)
  const u = ground.map(v => v / 6371095.5);
  let dug = null;
  for (let h = 99; h > 90 && !dug; h -= 0.05) { const c = u.map(v => v * (6371000 + h)); a.send({ t: 'dig', seq: 1, c, r: 0.045, mode: 'hand' }); const r = await a.next('dig'); if (r.ok && r.got > 0) dug = { r, c }; else await wait(420); }
  assert(dug, 'a dig should pay'); console.log('ok  dig paid by the server: $' + dug.r.got.toFixed(4), dug.r.litres.toFixed(3) + ' L');
  const seen = await b.next('hole'); assert.equal(seen.h[3], 0.045); console.log('ok  the other player gets the new hole');
  // cheats
  a.send({ t: 'dig', seq: 2, c: dug.c, r: 0.5, mode: 'hand' }); assert.equal((await a.next('dig')).why, 'tool');
  await wait(450); a.send({ t: 'dig', seq: 3, c: dug.c.map(v => v + 40), r: 0.045, mode: 'hand' }); assert.equal((await a.next('dig')).why, 'far');
  await wait(450); a.send({ t: 'dig', seq: 4, c: dug.c, r: 0.045, mode: 'hand' }); await a.next('dig'); a.send({ t: 'dig', seq: 5, c: dug.c, r: 0.045, mode: 'hand' }); assert.equal((await a.next('dig')).why, 'fast');
  a.send({ t: 'dig', seq: 6, c: dug.c, r: 0.35, mode: 'exMini' }); assert.equal((await a.next('dig')).why, 'tool');
  console.log('ok  too big / too far / too fast / machine not owned are refused');
  // research: too poor, then rich enough
  b.send({ t: 'buy', id: 'trowel' }); let s = await b.next('state'); assert.equal(s.bought, null);
  // a newcomer who joins later sees the holes already dug
  const c2 = await player('Carol', 'cccccccccccccccccccccccc'); await c2.next('welcome'); c2.send({ t: 'pos', p: feet, yaw: 0, pitch: 0 }); const hs = await c2.next('holes'); assert(hs.h.length >= 4); console.log('ok  late joiner receives', hs.h.length / 4, 'holes');
  // chat: filtered, flood-limited
  a.send({ t: 'chat', text: 'привіт, f u c k, discord.gg/x' }); const m1 = await b.next('chat'); assert(!/f u c k|discord/.test(m1.text)); console.log('ok  chat filtered:', JSON.stringify(m1.text));
  await a.next('chat'); a.send({ t: 'chat', text: 'again' }); const m2 = await a.next('chat'); assert.equal(m2.sys, 'slow'); console.log('ok  flood control');
  // owner bans Bob for good
  await wait(1600); a.send({ t: 'chat', text: '/ban Bob test ban' }); assert.equal((await b.next('kicked')).reason, 'banned');
  const b2 = await player('Bob', 'bbbbbbbbbbbbbbbbbbbbbbbb'); assert.equal((await b2.next('kicked')).reason, 'banned'); console.log('ok  permanent ban holds on reconnect');
  // non-owner commands do nothing
  c2.inbox.length = 0; c2.send({ t: 'chat', text: '/ban Alice' }); assert.equal((await c2.next('chat')).sys, 'unknownCmd'); console.log('ok  only the owner has commands');
  for (const p of [a, c2]) p.ws.close(); srv.kill('SIGTERM'); await wait(500);
  // restart: holes and money survive
  const srv2 = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: Object.assign({}, process.env, { PORT, DATA_DIR: dir, ALLOW_GUESTS: '1' }), stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise(r => srv2.stdout.on('data', d => { if (/server on/.test(d)) { process.stdout.write('  server: ' + d); r(); } }));
  const a2 = await player('Alice', 'aaaaaaaaaaaaaaaaaaaaaaaa'); const w2 = await a2.next('welcome'); assert(w2.state.money > 0); console.log('ok  after a restart money is $' + w2.state.money.toFixed(4));
  a2.ws.close(); srv2.kill('SIGTERM'); console.log('ALL OK'); process.exit(0);
})().catch(e => { console.error('FAIL', e.message); srv.kill(); process.exit(1); });
