// Co-op over WebRTC (PeerJS). Rooms are found by name + password: both are hashed into the host's peer id,
// so nobody can find a room without knowing both. The host runs the simulation (sim.js) for everyone;
// clients send their own position/look/flashlight and actions, the host sends the world back ~10 times a second.
// Up to 5 players per room (the host + 4).
'use strict';
(function (root) {
  const MAX = 5;
  const handlers = {};
  const Net = {
    mode: 'solo', me: 'p1', nick: '', room: '', peer: null, conn: null, conns: {}, players: {}, MAX,
    on(t, fn) { handlers[t] = fn; },
    emit(t, ...a) { if (handlers[t]) handlers[t](...a); },
    // ---- ids ----
    roomId(name, pass) {
      const s = name.trim().toLowerCase() + '\u0001' + pass;
      const h = seed => { let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909); return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0'); };
      return 'milliondolls-' + h(1) + h(2);
    },
    opts() { return Object.assign({ debug: 0 }, root.__peerServer || {}); },
    available() { return typeof root.Peer === 'function'; },
    // ---- host ----
    host(room, pass, nick, cb) {
      if (!Net.available()) return cb('offline');
      Net.leave(); Net.room = room; Net.nick = nick; Net.pass = pass;
      let done = false; const finish = e => { if (!done) { done = true; cb(e); } };
      const peer = new root.Peer(Net.roomId(room, pass), Net.opts()); Net.peer = peer;
      const timer = setTimeout(() => { finish('timeout'); Net.leave(); }, 15000);
      peer.on('open', () => { clearTimeout(timer); Net.mode = 'host'; Net.me = 'h'; Net.players = { h: { id: 'h', nick } }; finish(null); Net.emit('players'); });
      peer.on('error', e => { clearTimeout(timer); if (!done) { finish(e.type === 'unavailable-id' ? 'exists' : 'network'); Net.leave(); } });
      peer.on('disconnected', () => { if (Net.peer === peer && Net.mode === 'host' && !peer.destroyed) try { peer.reconnect(); } catch (e) {} });   // lost the signalling server, not leaving
      peer.on('connection', c => {
        c.on('data', m => {
          if (m.t === 'hello') {
            const ids = Object.keys(Net.conns);
            if (m.pass !== Net.pass) { c.send({ t: 'reject', why: 'pass' }); return setTimeout(() => c.close(), 300); }
            if (ids.length + 1 >= MAX) { c.send({ t: 'reject', why: 'full' }); return setTimeout(() => c.close(), 300); }
            const id = 'c' + Math.random().toString(36).slice(2, 8);
            c.pid = id; Net.conns[id] = c; Net.players[id] = { id, nick: String(m.nick || '?').slice(0, 16) };
            Net.emit('join', id, Net.players[id].nick, c, m);
            Net.emit('players');
            return;
          }
          if (c.pid) Net.emit('msg', c.pid, m);
        });
        const gone = () => { if (c.pid && Net.conns[c.pid]) { const id = c.pid; delete Net.conns[id]; const nk = Net.players[id] && Net.players[id].nick; delete Net.players[id]; Net.emit('leave', id, nk); Net.emit('players'); } };
        c.on('close', gone); c.on('error', gone);
      });
    },
    broadcast(m) { for (const id in Net.conns) { const c = Net.conns[id]; if (c.open) try { c.send(m); } catch (e) {} } },
    sendTo(id, m) { const c = Net.conns[id]; if (c && c.open) try { c.send(m); } catch (e) {} },
    // ---- client ----
    join(room, pass, nick, cb) {
      if (!Net.available()) return cb('offline');
      Net.leave(); Net.room = room; Net.nick = nick;
      let done = false; const finish = (e, w) => { if (!done) { done = true; cb(e, w); } };
      const peer = new root.Peer(Net.opts()); Net.peer = peer;
      const timer = setTimeout(() => { finish('notfound'); Net.leave(); }, 15000);
      peer.on('error', e => { clearTimeout(timer); if (!done) { finish(e.type === 'peer-unavailable' ? 'notfound' : 'network'); Net.leave(); } else Net.emit('lost'); });
      peer.on('open', () => {
        const c = peer.connect(Net.roomId(room, pass), { reliable: true }); Net.conn = c;
        c.on('open', () => c.send({ t: 'hello', nick, pass, savedAt: Net.savedAt || 0 }));
        c.on('data', m => {
          if (m.t === 'reject') { clearTimeout(timer); finish(m.why === 'full' ? 'full' : 'notfound'); Net.leave(); return; }
          if (m.t === 'welcome') { clearTimeout(timer); Net.mode = 'client'; Net.me = m.id; Net.players = m.players; finish(null, m); return; }
          if (m.t === 'players') { Net.players = m.players; Net.emit('players'); return; }
          Net.emit('msg', 'h', m);
        });
        c.on('close', () => { if (Net.mode === 'client') { Net.mode = 'solo'; Net.emit('lost'); } });
      });
    },
    send(m) { if (Net.conn && Net.conn.open) try { Net.conn.send(m); } catch (e) {} },
    leave() {
      const was = Net.mode; Net.mode = 'solo'; Net.me = 'p1'; Net.conns = {}; Net.conn = null; Net.players = {};
      if (Net.peer) { try { Net.peer.destroy(); } catch (e) {} Net.peer = null; }
      return was;
    },
    list() { return Object.values(Net.players); }
  };
  root.Net = Net;
})(window);
