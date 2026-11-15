// Net: the game's link to the shared-Earth server (server/server.js). Used only in co-op mode.
// Where the server is: window.ED_CONFIG.server (set by the Steam build) or ?server=ws://host:port in the address.
// Sign-in: a Steam session ticket in the Steam build; a guest token in development (if the server allows guests).
'use strict';
(function (root) {
  const cfg = root.ED_CONFIG || {};
  const q = new URLSearchParams(location.search);
  const URL_ = q.get('server') || cfg.server || '';
  const Net = { url: URL_, available: !!URL_, online: false, sid: 0, admin: false, ping: 0, handlers: {}, ws: null, seq: 0, pending: new Map() };
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  // which mode the player chose last time (co-op only when a server is configured)
  Net.mode = () => Net.available && (q.get('mode') || lsGet('endlessdigging.mode')) === 'coop' ? 'coop' : 'solo';
  Net.setMode = m => lsSet('endlessdigging.mode', m);
  function guestToken() {
    let t = lsGet('endlessdigging.guest');
    if (!t || !/^[a-zA-Z0-9]{16,64}$/.test(t)) { const a = new Uint8Array(16); crypto.getRandomValues(a); t = [...a].map(b => b.toString(16).padStart(2, '0')).join(''); lsSet('endlessdigging.guest', t); }
    return t;
  }
  Net.guestName = () => lsGet('endlessdigging.name') || '';
  Net.setGuestName = n => lsSet('endlessdigging.name', String(n || '').slice(0, 20));
  Net.on = (t, f) => { Net.handlers[t] = f; };
  Net.send = m => { if (Net.ws && Net.ws.readyState === 1) Net.ws.send(JSON.stringify(m)); };
  const emit = m => { const h = Net.handlers[m.t]; if (h) h(m); };

  // connect and sign in; resolves with the 'welcome' message, rejects with a reason
  Net.connect = function () {
    return new Promise(async (res, rej) => {
      let ticket = null;
      try { if (root.Steam && root.Steam.ticket) ticket = await root.Steam.ticket(); } catch (e) {}
      let ws; try { ws = new WebSocket(URL_); } catch (e) { return rej('offline'); }
      Net.ws = ws; let welcomed = false;
      const to = setTimeout(() => { if (!welcomed) { try { ws.close(); } catch (e) {} rej('offline'); } }, 9000);
      ws.onopen = () => Net.send({ t: 'hello', v: 1, ticket, guest: ticket ? null : { token: guestToken(), name: Net.guestName(), admin: q.get('admin') || undefined } });
      ws.onmessage = e => {
        let m; try { m = JSON.parse(e.data); } catch (x) { return; }
        if (m.t === 'welcome') { welcomed = true; clearTimeout(to); Net.online = true; Net.sid = m.sid; Net.admin = m.admin; res(m); return; }
        if (m.t === 'kicked' && !welcomed) { clearTimeout(to); rej(m.reason || 'signin'); return; }
        if (m.t === 'pong') { Net.ping = performance.now() - m.t0; return; }
        if (m.t === 'dig') { const p = Net.pending.get(m.seq); Net.pending.delete(m.seq); if (p) p(m); }
        emit(m);
      };
      ws.onclose = () => { clearTimeout(to); const was = Net.online; Net.online = false; if (!welcomed) rej('offline'); else if (was) emit({ t: 'lost' }); };
      ws.onerror = () => {};
    });
  };
  // a dig: the game shows it at once; the server's answer brings the real payout
  Net.dig = (c, r, mode, extra) => new Promise(res => { const seq = ++Net.seq; Net.pending.set(seq, res); Net.send(Object.assign({ t: 'dig', seq, c, r, mode }, extra || {})); setTimeout(() => { if (Net.pending.delete(seq)) res({ ok: false, why: 'timeout' }); }, 8000); });
  setInterval(() => { if (Net.online) Net.send({ t: 'ping', t0: performance.now() }); }, 5000);

  // crashes are reported to the server so they can be fixed (message and stack only, nothing personal)
  if (URL_) {
    const http = URL_.replace(/^ws/, 'http').replace(/\/$/, '') + '/api/error'; let sent = 0;
    const report = (msg, stack) => { if (sent++ > 5) return; try { fetch(http, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ msg: String(msg), stack: String(stack || ''), ver: cfg.version || 'web' }) }).catch(() => {}); } catch (e) {} };
    addEventListener('error', e => report(e.message, e.error && e.error.stack));
    addEventListener('unhandledrejection', e => report('promise: ' + (e.reason && e.reason.message || e.reason), e.reason && e.reason.stack));
  }
  root.Net = Net;
})(window);
