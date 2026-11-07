// Procedural horror sound: ambient drone and wind, creaks, heartbeat, whispers, dig sounds, bell, jumpscare scream.
'use strict';
(function (root) {
  let ac = null, master = null, amb = null, heart = null, volume = 0.8, started = false;
  function ctx() { if (!ac) { ac = new (root.AudioContext || root.webkitAudioContext)(); master = ac.createGain(); master.gain.value = volume; master.connect(ac.destination); } return ac; }
  function noiseBuffer(sec) { const c = ctx(), b = c.createBuffer(1, c.sampleRate * sec, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
  let NB = null;
  function noise(dur, { f = 800, q = 1, type = 'bandpass', gain = 0.2, pan = 0, attack = 0.01, delay = 0 } = {}) {
    const c = ctx(); NB = NB || noiseBuffer(2);
    const s = c.createBufferSource(); s.buffer = NB; s.loop = true;
    const flt = c.createBiquadFilter(); flt.type = type; flt.frequency.value = f; flt.Q.value = q;
    const g = c.createGain(), p = c.createStereoPanner(); p.pan.value = pan;
    const t = c.currentTime + delay; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(flt).connect(g).connect(p).connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
    return { flt, g };
  }
  function tone(f, dur, { type = 'sine', gain = 0.1, slide = 0, pan = 0, delay = 0 } = {}) {
    const c = ctx(), o = c.createOscillator(), g = c.createGain(), p = c.createStereoPanner(); p.pan.value = pan;
    const t = c.currentTime + delay; o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(p).connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  // harsh waveshaper for screams and her voice
  let CURVE = null;
  function curve() { if (CURVE) return CURVE; const n = 2048; CURVE = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / n * 2 - 1; CURVE[i] = Math.tanh(x * 6) * 0.9 + Math.sign(x) * 0.1 * Math.abs(x); } return CURVE; }
  function chain(gain, pan, delay) {   // output node: distortion → gain env → pan → master
    const c = ctx(), ws = c.createWaveShaper(), g = c.createGain(), p = c.createStereoPanner(); ws.curve = curve(); ws.oversample = '2x'; p.pan.value = pan || 0;
    ws.connect(g).connect(p).connect(master); return { ws, g, t: c.currentTime + (delay || 0) };
  }
  // a voice: buzzing source through vocal-tract formants, pitch wobble, distortion
  function voice(f0, dur, { gain = 0.2, pan = 0, delay = 0, slide = 0, formants = [[700, 8], [1150, 10], [2600, 12]], wobble = 6, jitter = 0.04, attack = 0.08 } = {}) {
    const c = ctx(), out = chain(gain, pan, delay), t = out.t;
    out.g.gain.setValueAtTime(0.0001, t); out.g.gain.exponentialRampToValueAtTime(gain, t + attack); out.g.gain.setValueAtTime(gain, t + dur * 0.7); out.g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const mix = c.createGain(); mix.gain.value = 1;
    formants.forEach(([f, q], i) => { const b = c.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q; const bg = c.createGain(); bg.gain.value = 1.6 / (i + 1); mix.connect(b).connect(bg).connect(out.ws); });
    [0, 1.7, -2.3].forEach(det => {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f0 + det, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f0 + slide + det), t + dur);
      const v = c.createOscillator(), vg = c.createGain(); v.frequency.value = wobble + Math.random() * 2; vg.gain.value = f0 * jitter; v.connect(vg).connect(o.frequency);
      o.connect(mix); o.start(t); v.start(t); o.stop(t + dur + 0.1); v.stop(t + dur + 0.1);
    });
    // breath in the voice
    NB = NB || noiseBuffer(2); const n = c.createBufferSource(); n.buffer = NB; n.loop = true; const ng = c.createGain(); ng.gain.value = 0.25; n.connect(ng).connect(mix); n.start(t, Math.random()); n.stop(t + dur + 0.1);
  }
  function startAmbient() {
    if (started) return; started = true; const c = ctx();
    amb = c.createGain(); amb.gain.value = 0.0; amb.connect(master); amb.gain.linearRampToValueAtTime(1, c.currentTime + 4);
    [[41, 0.05], [55.5, 0.035], [82.4, 0.015]].forEach(([f, g]) => { const o = c.createOscillator(), gn = c.createGain(), lfo = c.createOscillator(), lg = c.createGain(); o.type = 'sine'; o.frequency.value = f; gn.gain.value = g; lfo.frequency.value = 0.05 + Math.random() * 0.1; lg.gain.value = g * 0.6; lfo.connect(lg).connect(gn.gain); o.connect(gn).connect(amb); o.start(); lfo.start(); });
    NB = NB || noiseBuffer(2); const s = c.createBufferSource(); s.buffer = NB; s.loop = true; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400; const g = c.createGain(); g.gain.value = 0.05;
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.08; lg.gain.value = 250; lfo.connect(lg).connect(f.frequency); s.connect(f).connect(g).connect(amb); s.start(); lfo.start();
    heart = c.createGain(); heart.gain.value = 0; heart.connect(master);
  }
  let lastBeat = 0;
  const api = {
    unlock() { try { ctx(); if (ac.state === 'suspended') ac.resume(); startAmbient(); } catch (e) {} },
    setVolume(v) { volume = v; if (master) master.gain.value = v; },
    // called every frame with fear 0..1 and time
    update(fear, t) {
      if (!ac || !started) return;
      const rate = 0.9 - fear * 0.55;
      if (fear > 0.15 && t - lastBeat > rate) { lastBeat = t; tone(55, 0.12, { gain: 0.35 * fear }); tone(48, 0.14, { gain: 0.28 * fear, delay: 0.16 }); }
      if (Math.random() < 0.0015) api.creak((Math.random() - 0.5) * 2, 0.04);
      if (Math.random() < 0.0006) api.crawl((Math.random() - 0.5) * 2, 0.03);
      if (fear > 0.5 && Math.random() < 0.004 * fear) api.whisper((Math.random() - 0.5) * 2);
    },
    creak(pan = 0, gain = 0.08) { if (!ac) return; const n = noise(0.6 + Math.random() * 0.5, { f: 300 + Math.random() * 400, q: 18, gain, pan, attack: 0.1 }); n.flt.frequency.exponentialRampToValueAtTime(150 + Math.random() * 200, ac.currentTime + 0.8); },
    step(pan = 0, gain = 0.1) { if (!ac) return; noise(0.12, { f: 180, q: 2, gain, pan, type: 'lowpass' }); noise(0.25, { f: 420, q: 14, gain: gain * 0.6, pan, delay: 0.03 }); },
    whisper(pan = 0) { if (!ac) return; for (let i = 0; i < 4; i++) noise(0.25 + Math.random() * 0.3, { f: 2500 + Math.random() * 2500, q: 6, gain: 0.03, pan, delay: i * 0.18, attack: 0.08 }); },
    dig() { if (!ac) return; noise(0.18, { f: 1400 + Math.random() * 800, q: 1.5, gain: 0.07 }); if (Math.random() < 0.3) tone(1800 + Math.random() * 1200, 0.06, { type: 'triangle', gain: 0.03 }); },
    rip() { if (!ac) return; noise(0.35, { f: 2600, q: 0.8, gain: 0.08, type: 'highpass' }); },
    find(big) { if (!ac) return; tone(big ? 520 : 880, 0.3, { type: 'triangle', gain: 0.05 }); if (big) tone(415, 0.6, { type: 'sine', gain: 0.05, delay: 0.15 }); },
    bell(pan = 0) { if (!ac) return; [1320, 1980, 2640].forEach((f, i) => tone(f, 1.4, { type: 'sine', gain: 0.05 / (i + 1), pan })); },
    // Mother: crawling knocks on wood, joints cracking, a wet throat, breathing behind you
    crawl(pan = 0, gain = 0.12) { if (!ac) return; for (let i = 0; i < 4; i++) { const d = i * (0.07 + Math.random() * 0.06); noise(0.06, { f: 260 + Math.random() * 180, q: 4, gain: gain * (i % 2 ? 0.6 : 1), pan, delay: d, attack: 0.003 }); noise(0.05, { f: 2600 + Math.random() * 1500, q: 3, gain: gain * 0.25, pan, delay: d + 0.01, attack: 0.002 }); } },
    crack(pan = 0, gain = 0.18) { if (!ac) return; const n = 2 + Math.floor(Math.random() * 4); for (let i = 0; i < n; i++) noise(0.025, { f: 1800 + Math.random() * 2500, q: 2, gain: gain * (0.5 + Math.random() * 0.5), pan, delay: i * (0.03 + Math.random() * 0.05), attack: 0.001, type: 'highpass' }); },
    moan(pan = 0, gain = 0.09) { if (!ac) return; const f = 150 + Math.random() * 60; voice(f, 2.6 + Math.random(), { gain, pan, slide: -f * 0.45, wobble: 5, jitter: 0.06, attack: 0.5, formants: [[600, 7], [1000, 9], [2400, 10]] }); api.gurgle(pan, gain * 0.6, 0.8); },
    gurgle(pan = 0, gain = 0.08, delay = 0) { if (!ac) return; const c = ctx(), n = noise(1.4, { f: 380, q: 3, gain, pan, delay, attack: 0.2 }); const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 17 + Math.random() * 8; lg.gain.value = gain * 0.9; l.connect(lg).connect(n.g.gain); l.start(c.currentTime + delay); l.stop(c.currentTime + delay + 1.5); },
    breath(pan = 0, gain = 0.07) { if (!ac) return; [0, 1.15, 2.3].forEach((d, i) => noise(0.9, { f: i % 2 ? 900 : 650, q: 1.6, gain: gain * (i % 2 ? 0.7 : 1), pan, delay: d, attack: 0.35 })); },
    hiss(pan = 0, gain = 0.25) { if (!ac) return; voice(90, 1.2, { gain: gain * 0.5, pan, slide: 40, wobble: 23, jitter: 0.2, attack: 0.03, formants: [[400, 4], [1300, 6], [3200, 5]] }); noise(1.0, { f: 5000, q: 1, gain, pan, type: 'highpass', attack: 0.02 }); },
    knock(pan = 0, n = 3) { if (!ac) return; for (let i = 0; i < n; i++) { tone(85, 0.18, { gain: 0.35, slide: -30, pan, delay: i * 0.42 }); noise(0.1, { f: 500, q: 2, gain: 0.18, pan, delay: i * 0.42, type: 'lowpass', attack: 0.002 }); } },
    scream() {
      if (!ac) return;
      // a burst, then a shrieking, tearing female voice and a body-blow sub
      noise(0.3, { f: 2000, q: 0.4, gain: 0.9, type: 'highpass', attack: 0.002 });
      voice(620, 1.5, { gain: 0.55, slide: -260, wobble: 9, jitter: 0.09, attack: 0.01, formants: [[900, 6], [1700, 8], [3100, 9]] });
      voice(930, 1.3, { gain: 0.35, slide: -500, wobble: 13, jitter: 0.12, attack: 0.01, formants: [[1200, 5], [2600, 7]] });
      voice(160, 1.6, { gain: 0.35, slide: -90, wobble: 4, jitter: 0.05, attack: 0.01, formants: [[500, 4], [900, 6]] });
      tone(48, 0.9, { type: 'sine', gain: 0.9, slide: -18 }); tone(1240, 1.1, { type: 'square', gain: 0.12, slide: -900 });
      api.crack(0, 0.4);
    },
    sting() { if (!ac) return; tone(110, 2.5, { type: 'sawtooth', gain: 0.12, slide: -40 }); noise(2, { f: 200, q: 1, gain: 0.1, type: 'lowpass', attack: 0.3 }); },
    giggle(pan = 0) { if (!ac) return; [0, 0.12, 0.22, 0.34, 0.43].forEach((d, i) => tone(1100 + i * 60 + Math.random() * 80, 0.09, { type: 'triangle', gain: 0.05, pan, delay: d, slide: -200 })); },
    screech(pan = 0) { if (!ac) return; voice(1400, 0.8, { gain: 0.2, pan, slide: -900, wobble: 17, jitter: 0.15, attack: 0.01, formants: [[1800, 6], [3200, 8]] }); noise(0.6, { f: 4000, q: 2, gain: 0.15, pan }); api.crack(pan, 0.2); },
    drip() { if (!ac) return; tone(1400 + Math.random() * 300, 0.08, { type: 'sine', gain: 0.06, slide: -900 }); },
    thud() { if (!ac) return; tone(70, 0.3, { type: 'sine', gain: 0.4, slide: -30 }); noise(0.2, { f: 300, q: 1, gain: 0.25, type: 'lowpass' }); },
    lullaby() { if (!ac) return; [659, 587, 523, 587, 659, 659, 659, 587, 587, 587, 659, 784, 784].forEach((f, i) => tone(f * 2, 0.5, { type: 'sine', gain: 0.05, delay: i * 0.38 })); },
    door(open) { if (!ac) return; noise(open ? 2.2 : 0.4, { f: open ? 260 : 900, q: open ? 20 : 3, gain: 0.15, attack: 0.05 }); if (!open) tone(220, 0.1, { type: 'square', gain: 0.05 }); }
  };
  root.Sfx = api;
})(window);
