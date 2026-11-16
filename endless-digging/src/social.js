// Social (co-op only): corporations with a shared treasury, the market for duplicate finds, and voice chat.
// The server checks everything; this file only shows it and sends requests.
// Voice: off by default; only with mutual friends or your corporation; push-to-talk (B); every voice can be muted.
(function (root) {
  'use strict';
  const Soc = { corp: null, invites: [], top: [], market: [], myFinds: {}, voice: false, muted: new Set() };
  let G = null, L = {};
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = v => Math.round(v).toLocaleString();
  const render = () => { if (root.Progress && Progress.isOpen()) Progress.render(); };
  const findName = id => (G.L.pg.finds && G.L.pg.finds[id]) || id;
  const offline = () => `<p class="bsub">${esc(L.coopOnly)}</p>`;

  // ---------- corporation page ----------
  function corpPage() {
    if (!G.online()) return offline();
    const k = Soc.corp;
    if (!k) {
      return `<p class="bsub">${esc(L.corpAbout)}</p>
        <div class="sform"><input id="cName" maxlength="32" placeholder="${esc(L.corpNamePh)}"><input id="cTag" maxlength="4" placeholder="${esc(L.corpTagPh)}" style="width:6em"><button id="cMake"${G.money() < 10000 ? ' disabled' : ''}>${esc(L.corpCreate)} · $10,000</button></div>`
        + (Soc.invites.length ? `<h3>${esc(L.invites)}</h3><div class="fl">${Soc.invites.map(i => `<div class="lrow"><b>[${esc(i.tag)}] ${esc(i.name)}</b><span>${esc(L.from.replace('{0}', i.from))}</span><button data-join="${esc(i.id)}">${esc(L.join)}</button></div>`).join('')}</div>` : '')
        + topHTML() + voiceHTML();
    }
    const near = G.peers().filter(p => !k.members.some(m => m.name === p.name));
    return `<div class="corpHead"><h3>[${esc(k.tag)}] ${esc(k.name)}</h3><span>${k.members.length} / ${k.max}</span></div>
      <table class="rec"><tr><td>${esc(L.treasury)}</td><td>$${fmt(k.treasury)}</td></tr></table>
      <div class="sform"><input id="cAmt" type="number" min="1" step="1" placeholder="$"><button id="cDep">${esc(L.deposit)}</button>${k.owner ? `<button id="cWd">${esc(L.withdraw)}</button>` : ''}</div>
      <p class="bsub">${esc(L.corpChat)}</p>
      <h3>${esc(L.members)}</h3><div class="fl">${k.members.map(m => `<div class="lrow"><b>${esc(m.name)}</b><span>${esc(L.rank[m.rank])} · ${m.online ? esc(G.L.cos.online) : esc(G.L.cos.offline)}</span>`
        + (k.owner && m.rank !== 'owner' ? `<button data-rank="${esc(m.id)}">${esc(m.rank === 'officer' ? L.demote : L.promote)}</button>` : '')
        + (k.officer && m.rank !== 'owner' && m.name !== G.name() ? `<button data-kick="${esc(m.id)}">${esc(L.kick)}</button>` : '') + '</div>').join('')}</div>`
      + (k.officer && near.length ? `<h3>${esc(L.invite)}</h3><div class="fl">${near.map(p => `<div class="lrow"><b>${esc(p.name)}</b><button data-inv="${p.sid}">${esc(L.invite)}</button></div>`).join('')}</div>` : '')
      + voiceHTML() + `<p><button id="cLeave" class="warn">${esc(L.leave)}</button></p>` + topHTML();
  }
  const topHTML = () => Soc.top.length ? `<h3>${esc(L.top)}</h3><table class="rec">${Soc.top.map((t, i) => `<tr><td>${i + 1}. [${esc(t.tag)}] ${esc(t.name)} · ${t.members}</td><td>$${fmt(t.treasury)}</td></tr>`).join('')}</table>` : '';

  // ---------- voice ----------
  function voiceHTML() {
    const talkers = [...Voice.peers.values()];
    return `<h3>${esc(L.voice)}</h3><p class="bsub">${esc(L.voiceAbout)}</p><div class="sform"><button id="vOn" class="${Soc.voice ? 'on' : ''}">${esc(Soc.voice ? L.voiceOn : L.voiceOff)}</button></div>`
      + (talkers.length ? `<div class="fl">${talkers.map(v => `<div class="lrow"><b>${esc(v.name)}</b><span>${v.talking ? '🔊' : ''}</span><button data-mute="${v.sid}">${esc(Soc.muted.has(v.name) ? L.unmute : L.mute)}</button><button data-rep="${v.sid}">${esc(L.report)}</button></div>`).join('')}</div>` : '');
  }
  const Voice = { peers: new Map(), stream: null, ptt: false };
  const ICE = () => ({ iceServers: (root.ED_CONFIG && ED_CONFIG.ice) || [{ urls: 'stun:stun.l.google.com:19302' }] });
  // who may we talk to: online friends and corporation members (the server checks it again)
  function mates() {
    const s = new Map();
    for (const f of (root.Cosmetics && Cosmetics.friendList) || []) if (f.online && f.sid) s.set(f.sid, f.name);
    if (Soc.corp) for (const m of Soc.corp.members) if (m.online && m.sid && m.name !== G.name()) s.set(m.sid, m.name);
    s.delete(G.sid()); return s;
  }
  async function voiceOn(on) {
    if (on) {
      try { Voice.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
      catch (e) { G.notice(L.noMic); Soc.voice = false; render(); return; }
      Voice.stream.getAudioTracks().forEach(t => { t.enabled = false; });   // push-to-talk: silent until B is held
    } else { for (const sid of [...Voice.peers.keys()]) hangUp(sid); if (Voice.stream) Voice.stream.getTracks().forEach(t => t.stop()); Voice.stream = null; }
    Soc.voice = on; G.send({ t: 'voice', on }); try { localStorage.setItem('endlessdigging.voice', on ? '1' : ''); } catch (e) {}
    syncCalls(); render();
  }
  function syncCalls() {
    if (!Soc.voice) return;
    const want = mates();
    for (const sid of [...Voice.peers.keys()]) if (!want.has(sid)) hangUp(sid);
    for (const [sid, name] of want) if (!Voice.peers.has(sid) && G.sid() < sid) call(sid, name, true);   // the lower id starts the call
  }
  function pcFor(sid, name) {
    let v = Voice.peers.get(sid); if (v) return v;
    const pc = new RTCPeerConnection(ICE()), audio = new Audio(); audio.autoplay = true;
    v = { sid, name, pc, audio, talking: false }; Voice.peers.set(sid, v);
    if (Voice.stream) for (const t of Voice.stream.getTracks()) pc.addTrack(t, Voice.stream);
    pc.onicecandidate = e => { if (e.candidate) G.send({ t: 'rtc', to: sid, data: { ice: e.candidate } }); };
    pc.ontrack = e => { audio.srcObject = e.streams[0]; audio.muted = Soc.muted.has(name); watchLevel(v, e.streams[0]); };
    pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed' || pc.connectionState === 'closed') hangUp(sid); };
    return v;
  }
  async function call(sid, name) { const v = pcFor(sid, name); const o = await v.pc.createOffer(); await v.pc.setLocalDescription(o); G.send({ t: 'rtc', to: sid, data: { sdp: v.pc.localDescription } }); }
  function hangUp(sid) { const v = Voice.peers.get(sid); if (!v) return; try { v.pc.close(); } catch (e) {} v.audio.srcObject = null; Voice.peers.delete(sid); render(); }
  async function onRtc(m) {
    if (!Soc.voice || !mates().has(m.from)) return;
    const v = pcFor(m.from, m.name), d = m.data || {};
    try {
      if (d.sdp) { await v.pc.setRemoteDescription(d.sdp); if (d.sdp.type === 'offer') { const a = await v.pc.createAnswer(); await v.pc.setLocalDescription(a); G.send({ t: 'rtc', to: m.from, data: { sdp: v.pc.localDescription } }); } render(); }
      else if (d.ice) await v.pc.addIceCandidate(d.ice);
    } catch (e) { console.warn('voice', e); }
  }
  let actx = null;
  function watchLevel(v, stream) {   // a speaker icon next to whoever is talking
    try { actx = actx || new AudioContext(); const an = actx.createAnalyser(); an.fftSize = 256; actx.createMediaStreamSource(stream).connect(an); const buf = new Uint8Array(an.fftSize);
      const tick = () => { if (!Voice.peers.has(v.sid)) return; an.getByteTimeDomainData(buf); let s = 0; for (const x of buf) s += (x - 128) * (x - 128); const t = Math.sqrt(s / buf.length) > 6; if (t !== v.talking) { v.talking = t; render(); G.talking([...Voice.peers.values()].filter(x => x.talking && !Soc.muted.has(x.name)).map(x => x.name)); } setTimeout(tick, 150); }; tick();
    } catch (e) {}
  }
  function ptt(on) { if (!Voice.stream || Voice.ptt === on) return; Voice.ptt = on; Voice.stream.getAudioTracks().forEach(t => { t.enabled = on; }); G.micOn(on); }

  // ---------- market page ----------
  function marketPage() {
    if (!G.online()) return offline();
    const dup = Object.keys(Soc.myFinds).filter(id => Soc.myFinds[id] > 1);
    return `<p class="bsub">${esc(L.marketAbout)}</p><h3>${esc(L.offers)}</h3>`
      + (Soc.market.length ? `<div class="fl">${Soc.market.map(o => `<div class="lrow"><b>${esc(findName(o.find))}</b><span>${esc(o.seller)}</span>${o.mine ? `<button data-cancel="${esc(o.id)}">${esc(L.cancel)}</button>` : `<button data-buyo="${esc(o.id)}"${G.money() < o.price ? ' disabled' : ''}>$${fmt(o.price)}</button>`}</div>`).join('')}</div>` : `<p class="bsub">${esc(L.noOffers)}</p>`)
      + `<h3>${esc(L.sell)}</h3>` + (dup.length ? `<div class="fl">${dup.map(id => { const f = Progress.FINDS.find(x => x.id === id); return `<div class="lrow"><b>${esc(findName(id))} ×${Soc.myFinds[id] - 1}</b><input type="number" min="1" step="1" value="${f ? f.v * 2 : 100}" data-price="${esc(id)}" style="width:7em"><button data-sell="${esc(id)}">${esc(L.sellBtn)}</button></div>`; }).join('')}</div>` : `<p class="bsub">${esc(L.noDup)}</p>`);
  }

  function bind(el) {
    const q = s => el.querySelector(s);
    if (q('#cMake')) q('#cMake').onclick = () => G.send({ t: 'corpCreate', name: q('#cName').value, tag: q('#cTag').value });
    for (const b of el.querySelectorAll('[data-join]')) b.onclick = () => { G.send({ t: 'corpJoin', id: b.dataset.join }); Soc.invites = Soc.invites.filter(i => i.id !== b.dataset.join); };
    const amt = () => Math.floor(+(q('#cAmt') || {}).value || 0);
    if (q('#cDep')) q('#cDep').onclick = () => { if (amt() > 0) G.send({ t: 'corpDeposit', amount: amt() }); };
    if (q('#cWd')) q('#cWd').onclick = () => { if (amt() > 0) G.send({ t: 'corpWithdraw', amount: amt() }); };
    if (q('#cLeave')) q('#cLeave').onclick = () => { const b = q('#cLeave'); if (b.dataset.armed) G.send({ t: 'corpLeave' }); else { b.dataset.armed = 1; b.textContent = L.leaveSure; } };
    for (const b of el.querySelectorAll('[data-kick]')) b.onclick = () => G.send({ t: 'corpKick', who: b.dataset.kick });
    for (const b of el.querySelectorAll('[data-rank]')) b.onclick = () => G.send({ t: 'corpRank', who: b.dataset.rank });
    for (const b of el.querySelectorAll('[data-inv]')) b.onclick = () => { G.send({ t: 'corpInvite', sid: +b.dataset.inv }); b.disabled = true; };
    if (q('#vOn')) q('#vOn').onclick = () => voiceOn(!Soc.voice);
    for (const b of el.querySelectorAll('[data-mute]')) b.onclick = () => { const v = Voice.peers.get(+b.dataset.mute); if (!v) return; if (Soc.muted.has(v.name)) Soc.muted.delete(v.name); else Soc.muted.add(v.name); v.audio.muted = Soc.muted.has(v.name); render(); };
    for (const b of el.querySelectorAll('[data-rep]')) b.onclick = () => { G.send({ t: 'report', sid: +b.dataset.rep, why: 'voice' }); b.disabled = true; };
    for (const b of el.querySelectorAll('[data-buyo]')) b.onclick = () => { b.disabled = true; G.send({ t: 'marketBuy', id: b.dataset.buyo }); };
    for (const b of el.querySelectorAll('[data-cancel]')) b.onclick = () => G.send({ t: 'marketCancel', id: b.dataset.cancel });
    for (const b of el.querySelectorAll('[data-sell]')) b.onclick = () => { const p = el.querySelector(`[data-price="${b.dataset.sell}"]`); G.send({ t: 'marketSell', find: b.dataset.sell, price: Math.round(+p.value || 0) }); };
  }

  Soc.init = function (api) {
    G = api; L = api.L.soc || {};
    Progress.addTab('corp', { label: () => L.corp, render: corpPage, bind, open: () => { if (G.online()) { G.send({ t: 'corpInfo' }); G.send({ t: 'corpTop' }); } } });
    Progress.addTab('market', { label: () => L.market, render: marketPage, bind, open: () => { if (G.online()) G.send({ t: 'marketList' }); } });
  };
  // called once the co-op connection is up
  Soc.online = function (Net, welcome) {
    Soc.myFinds = Object.assign({}, welcome.finds || {}); Progress.netFinds(Soc.myFinds);
    Net.on('find', m => { Soc.myFinds[m.id] = m.count; Progress.foundRemote(m.id, m.count, m.bought); render(); });
    Net.on('corp', m => { Soc.corp = m.corp; G.setCorp(m.corp); syncCalls(); render(); });
    Net.on('corpInvite', m => { if (!Soc.invites.some(i => i.id === m.id)) Soc.invites.push(m); G.notice(L.invited.replace('{0}', m.from).replace('{1}', m.name)); render(); });
    Net.on('corpTop', m => { Soc.top = m.list; render(); });
    Net.on('market', m => { Soc.market = m.list; Soc.myFinds = m.finds || Soc.myFinds; Progress.netFinds(Soc.myFinds); render(); });
    Net.on('rtc', onRtc);
    let wasOn = false; try { wasOn = localStorage.getItem('endlessdigging.voice') === '1'; } catch (e) {}
    if (wasOn) voiceOn(true);
    setInterval(syncCalls, 4000);
    addEventListener('keydown', e => { if (e.code === 'KeyB' && !e.repeat && G.playing()) ptt(true); });
    addEventListener('keyup', e => { if (e.code === 'KeyB') ptt(false); });
    addEventListener('blur', () => ptt(false));
  };
  Soc.ptt = ptt; Soc.state = () => ({ corp: Soc.corp, voice: Soc.voice, calls: Voice.peers.size, market: Soc.market.length });
  root.Social = Soc;
})(window);
