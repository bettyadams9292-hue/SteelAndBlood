/* Sound bank — physically-informed, fully synthesised sound effects (no external recordings, no licensing).
 *
 * Every effect is rendered ahead of time into several variations with an OfflineAudioContext while the
 * loading screen is up, so the expensive layers (waveshaping, modal resonators, convolution tails,
 * hundreds of debris grains) cost nothing at play time. Playback then picks a random variation, nudges
 * its pitch, pans it by the source's position on screen, attenuates it with distance, and sends a little
 * of it to the current space's reverb (open field, stone interior, timber house).
 *
 * Recipes, by family:
 *  - firearms: muzzle blast (clipped noise burst) + barrel body (swept low-pass noise) + chest thump
 *    (pitch-dropping sine) + supersonic crack for rifles + action clatter + outdoor slap-back echo tail
 *  - explosions: overpressure crack, roaring low-passed body, sub drop, then gravel/debris patter
 *  - metal: modal synthesis (inharmonic partials of a plate/blade, each with its own decay)
 *  - flesh: low thud + wet squelch (resonant band sweep) + bone snaps for crits
 *  - voices: glottal pulse with jitter/shimmer and creaky sub-harmonics through vowel formant filters
 *    (zombie moans, snarls, death gurgles, screams, boss roars, the knight's grunts, the dog's barks)
 *  - foley: footsteps per surface (dirt crunch grains, timber thud, stone click) with armour jingle,
 *    reloads (magazine, bolt, pump, shell), brass casings bouncing, coins, pouches, chains, stone
 *  - plucked strings: Karplus–Strong for bows and crossbows */
'use strict';

IF.sfx = {
  SR: 32000, bank: {}, ready: false, building: false, voices: {},
  rnd: Math.random,

  /* ---------------------------------------------------------------- toolkit (offline graph helpers) */
  noiseBuf: null,
  _noise() { if (this.noiseBuf) return this.noiseBuf; const n = this.SR * 3, b = new AudioBuffer({ length: n, numberOfChannels: 1, sampleRate: this.SR }), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return (this.noiseBuf = b); },
  _brown() { if (this.brownBuf) return this.brownBuf; const n = this.SR * 3, b = new AudioBuffer({ length: n, numberOfChannels: 1, sampleRate: this.SR }), d = b.getChannelData(0); let l = 0; for (let i = 0; i < n; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; } return (this.brownBuf = b); },
  src(c, t, dur, brown) { const s = c.createBufferSource(); s.buffer = brown ? this._brown() : this._noise(); s.start(t, Math.random() * 2); s.stop(t + dur + 0.02); return s; },
  filt(c, type, f, q = 0.7, gain = 0) { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.gain.value = gain; return b; },
  gain(c, v = 1) { const g = c.createGain(); g.gain.value = v; return g; },
  /* exponential envelope: attack to peak, then decay with time-constant tau (seconds) */
  env(g, t, peak, attack, tau, end) { const p = g.gain; p.setValueAtTime(0.00001, t); p.linearRampToValueAtTime(peak, t + attack); p.setTargetAtTime(0.00001, t + attack, tau); if (end) p.setValueAtTime(0, end); return g; },
  shaper(c, amt) { const ws = c.createWaveShaper(), n = 1024, cu = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; cu[i] = Math.tanh(x * amt) / Math.tanh(amt); } ws.curve = cu; ws.oversample = '2x'; return ws; },
  chain(...nodes) { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes[nodes.length - 1]; },
  osc(c, type, f, t, dur) { const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(Math.min(f, this.SR * 0.45), t); o.start(t); o.stop(t + dur + 0.02); return o; },
  /* modal resonator: a struck object = sum of inharmonic partials, each decaying at its own rate */
  modal(c, out, t, f0, ratios, decays, amps = [], vol = 1) { ratios.forEach((r, i) => { if (f0 * r > this.SR * 0.45) return; /* partials above Nyquist are inaudible anyway */ const o = this.osc(c, 'sine', f0 * r * (1 + (Math.random() - 0.5) * 0.004), t, decays[i] * 6); const g = this.env(this.gain(c, 0), t, vol * (amps[i] ?? 1 / (i + 1)), 0.001, decays[i]); o.connect(g); g.connect(out); }); },
  /* a single noise burst through a filter, with envelope */
  burst(c, out, t, { type = 'bandpass', f = 1000, f2, q = 0.8, vol = 0.5, attack = 0.001, tau = 0.05, dur, brown, sweep } = {}) {
    dur = dur || tau * 7; const s = this.src(c, t, dur, brown), fl = this.filt(c, type, f, q); if (f2) fl.frequency.setTargetAtTime(f2, t, sweep || tau * 1.5); const g = this.env(this.gain(c, 0), t, vol, attack, tau); s.connect(fl); fl.connect(g); g.connect(out); return g;
  },
  thump(c, out, t, f, f2, tau, vol) { const o = this.osc(c, 'sine', f, t, tau * 8); o.frequency.setTargetAtTime(f2, t, tau * 0.8); const g = this.env(this.gain(c, 0), t, vol, 0.002, tau); o.connect(g); g.connect(out); },
  /* impulse responses: outdoor (sparse early reflections off walls/hills + long low-passed tail), stone room, timber room */
  ir(kind) {
    this._irs = this._irs || {}; if (this._irs[kind]) return this._irs[kind];
    const SR = this.SR, L = kind === 'field' ? 1.8 : kind === 'stone' ? 1.3 : 0.8, n = Math.floor(SR * L), b = new AudioBuffer({ length: n, numberOfChannels: 2, sampleRate: SR });
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let lp = 0; const k = kind === 'field' ? 0.18 : kind === 'stone' ? 0.45 : 0.3;
      for (let i = 0; i < n; i++) { const tt = i / SR; lp += k * ((Math.random() * 2 - 1) - lp); d[i] = lp * Math.exp(-tt * (kind === 'field' ? 2.8 : kind === 'stone' ? 3.6 : 6.5)) * (kind === 'field' ? Math.min(1, tt / 0.06) : 1); }
      const refl = kind === 'field' ? [[0.09, 0.5], [0.21, 0.35], [0.38, 0.22], [0.62, 0.14]] : kind === 'stone' ? [[0.012, 0.6], [0.023, 0.45], [0.037, 0.35], [0.055, 0.25]] : [[0.007, 0.5], [0.015, 0.35], [0.024, 0.2]];
      for (const [dt, a] of refl) { const i0 = Math.floor((dt + ch * 0.003 + Math.random() * 0.004) * SR); for (let j = 0; j < 60 && i0 + j < n; j++) d[i0 + j] += a * Math.exp(-j / 12) * (j % 2 ? -1 : 1); } }
    return (this._irs[kind] = b);
  },
  tail(c, inp, out, kind, wet) { const cv = c.createConvolver(); cv.normalize = true; cv.buffer = this.ir(kind); const lp = this.filt(c, 'lowpass', kind === 'field' ? 2200 : kind === 'stone' ? 5000 : 3500, 0.5), g = this.gain(c, wet); inp.connect(cv); cv.connect(lp); lp.connect(g); g.connect(out); }, // echoes come back duller: air and soft surfaces eat the highs
  /* voice: glottal source with jitter, shimmer and creak, through vowel formants (+ breath) */
  voice(c, out, t, dur, o) {
    const { lp = 4200, f0 = 110, f1 = f0, jitter = 0.04, formants = [[600, 6, 1], [1100, 8, 0.6], [2400, 10, 0.3]], breath = 0.2, rough = 0, roughF = 30, vol = 0.5, attack = 0.08, sub = 0, dist = 0, vib = 0 } = o;
    const bus = this.gain(c, 1), src = this.osc(c, 'sawtooth', f0, t, dur); src.frequency.setValueAtTime(f0, t); src.frequency.linearRampToValueAtTime(f1, t + dur);
    const steps = Math.ceil(dur / 0.05); for (let i = 1; i < steps; i++) src.detune.setValueAtTime((Math.random() - 0.5) * jitter * 1200 + (vib ? Math.sin(i * 0.05 * vib * 6.28) * 40 : 0), t + i * 0.05); // jitter + vibrato
    const srcG = this.gain(c, 1); src.connect(srcG);
    if (sub) { const s2 = this.osc(c, 'sawtooth', f0 / 2, t, dur); s2.frequency.linearRampToValueAtTime(f1 / 2, t + dur); const sg = this.gain(c, sub); s2.connect(sg); sg.connect(srcG); } // creaky sub-harmonic
    if (rough) { const amp = this.gain(c, 1 - rough * 0.5), am = this.osc(c, 'square', roughF, t, dur), ag = this.gain(c, rough * 0.5); am.connect(ag); ag.connect(amp.gain); srcG.connect(amp); amp.connect(bus); } else srcG.connect(bus); // roughness = fast amplitude flutter
    const br = this.src(c, t, dur), brG = this.gain(c, breath); br.connect(brG); brG.connect(bus);
    let shaped = bus; if (dist) { const ws = this.shaper(c, dist); bus.connect(ws); shaped = ws; }
    const mix = this.gain(c, 0), mg = mix.gain; mg.setValueAtTime(0, t); mg.linearRampToValueAtTime(vol, t + attack); mg.setValueAtTime(vol, t + Math.max(attack, dur * 0.6)); mg.linearRampToValueAtTime(0, t + dur);
    for (const [ff, q, a] of formants) { const bp = this.filt(c, 'bandpass', ff, q), fg = this.gain(c, a * 2.2); shaped.connect(bp); bp.connect(fg); fg.connect(mix); if (o.glide) bp.frequency.linearRampToValueAtTime(ff * o.glide, t + dur); }
    const tone = this.filt(c, 'lowpass', lp, 0.6); mix.connect(tone); tone.connect(out); return mix; // throat and mouth roll off the top end
  },
  /* Karplus–Strong plucked string, computed directly */
  pluck(f, dur, damp = 0.996, bright = 0.5) {
    const SR = this.SR, n = Math.floor(SR * dur), N = Math.floor(SR / f), buf = new Float32Array(N), out = new Float32Array(n); for (let i = 0; i < N; i++) buf[i] = Math.random() * 2 - 1;
    let p = 0; for (let i = 0; i < n; i++) { const a = buf[p], b2 = buf[(p + 1) % N]; out[i] = a; buf[p] = damp * (bright * a + (1 - bright) * 0.5 * (a + b2)); p = (p + 1) % N; } return out;
  },
  bufFrom(arr) { const b = new AudioBuffer({ length: arr.length, numberOfChannels: 1, sampleRate: this.SR }); b.copyToChannel(arr, 0); return b; },
  playArr(c, out, t, arr, vol = 1) { const s = c.createBufferSource(); s.buffer = arr instanceof AudioBuffer ? arr : this.bufFrom(arr); const g = this.gain(c, vol); s.connect(g); g.connect(out); s.start(t); },

  /* ---------------------------------------------------------------- recipes: (c, out, v) => duration */
  GUNS: { // blast tau, body cutoff, thump Hz, crack (supersonic), loudness, tail wetness, action clatter
    pistol: { tau: 0.018, body: 2600, thump: 140, crack: 0, vol: 0.75, wet: 0.35, mech: 1 },
    revolver: { tau: 0.03, body: 1900, thump: 110, crack: 0, vol: 0.9, wet: 0.45, mech: 0 },
    handcannon: { tau: 0.045, body: 1500, thump: 85, crack: 0.4, vol: 1, wet: 0.55, mech: 0 },
    smg: { tau: 0.014, body: 2900, thump: 160, crack: 0, vol: 0.62, wet: 0.25, mech: 1 },
    rifle: { tau: 0.022, body: 2300, thump: 120, crack: 0.8, vol: 0.85, wet: 0.45, mech: 1 },
    shotgun: { tau: 0.05, body: 1300, thump: 78, crack: 0, vol: 1, wet: 0.5, mech: 0 },
    pump: { tau: 0.055, body: 1200, thump: 72, crack: 0, vol: 1, wet: 0.55, mech: 0 },
    dbshotgun: { tau: 0.06, body: 1100, thump: 66, crack: 0, vol: 1, wet: 0.55, mech: 0 },
    sniper: { tau: 0.04, body: 1800, thump: 70, crack: 1, vol: 1, wet: 0.75, mech: 0 },
    lmg: { tau: 0.02, body: 2100, thump: 105, crack: 0.7, vol: 0.8, wet: 0.35, mech: 1 },
    minigun: { tau: 0.01, body: 3200, thump: 150, crack: 0.5, vol: 0.55, wet: 0.2, mech: 0 },
  },
  gun(c, out, v, P) {
    const t = 0.002, dry = this.gain(c, 1), bus = this.gain(c, 1); dry.connect(bus); bus.connect(out);
    // muzzle blast: hard-clipped broadband burst
    const blast = this.burst(c, dry, t, { type: 'highpass', f: 500, vol: 1.2 * P.vol, tau: P.tau, attack: 0.0004 }); blast.disconnect(); const ws = this.shaper(c, 3); blast.connect(ws); const bg = this.gain(c, 0.55); ws.connect(bg); bg.connect(dry);
    // barrel body: swept low-pass noise, a little longer
    this.burst(c, dry, t, { type: 'lowpass', f: P.body * (0.9 + v * 0.1), f2: P.body * 0.25, q: 1.2, vol: 0.9 * P.vol, tau: P.tau * 3, attack: 0.0008, sweep: P.tau * 2 });
    // chest thump
    this.thump(c, dry, t, P.thump * 1.8, P.thump * 0.6, P.tau * 2.4, 0.9 * P.vol);
    // supersonic crack: an N-wave just ahead of the blast
    if (P.crack) { this.burst(c, dry, t, { type: 'highpass', f: 3500, vol: 0.9 * P.crack, tau: 0.0015, attack: 0.0002 }); }
    // action: bolt carrier / slide clatter (small metal partials)
    if (P.mech) { const mg = this.gain(c, 0.12); mg.connect(dry); this.modal(c, mg, t + 0.035 + v * 0.004, 1800 + v * 150, [1, 2.4, 3.9, 5.6], [0.012, 0.009, 0.007, 0.005], [1, 0.7, 0.5, 0.3]); }
    // the field answers: slap-back off buildings and hills
    this.tail(c, dry, bus, 'field', P.wet);
    return P.tau * 20 + P.wet * 1.8 + 0.15;
  },
  R: {
    explosion(c, out, v) { const bus = this.gain(c, 1), t = 0.002; bus.connect(out);
      const crack = this.burst(c, bus, t, { type: 'highpass', f: 900, vol: 1.1, tau: 0.012 }); const ws = this.shaper(c, 4); crack.disconnect(); crack.connect(ws); ws.connect(bus);
      this.burst(c, bus, t, { type: 'lowpass', f: 2400, f2: 120, q: 0.9, vol: 1.3, tau: 0.45 + v * 0.1, attack: 0.004, brown: true, sweep: 0.25 });
      this.burst(c, bus, t, { type: 'lowpass', f: 600, f2: 60, q: 0.7, vol: 1.0, tau: 0.9, attack: 0.01, brown: true });
      this.thump(c, bus, t, 90, 26, 0.35, 1.1);
      const deb = this.gain(c, 0.5); deb.connect(bus); for (let i = 0; i < 90; i++) { const tt = t + 0.15 + Math.pow(Math.random(), 1.6) * 1.6; this.burst(c, deb, tt, { type: 'bandpass', f: 1500 + Math.random() * 4500, q: 2, vol: 0.25 * Math.random() * (1 - (tt - 0.15) / 2), tau: 0.004 + Math.random() * 0.01 }); }
      this.tail(c, bus, out, 'field', 0.6); return 3.2; },
    flashbang(c, out, v) { const bus = this.gain(c, 1); bus.connect(out); const b = this.burst(c, bus, 0.002, { type: 'highpass', f: 300, vol: 1.4, tau: 0.03 }); const ws = this.shaper(c, 6); b.disconnect(); b.connect(ws); ws.connect(bus); this.thump(c, bus, 0.002, 140, 40, 0.12, 0.8); const ring = this.gain(c, 0.08); ring.connect(out); this.modal(c, ring, 0.05, 3800, [1, 1.003], [1.2, 1.1], [1, 0.8]); this.tail(c, bus, out, 'field', 0.5); return 2.2; },
    glass(c, out, v) { const bus = this.gain(c, 1); bus.connect(out); for (let i = 0; i < 14; i++) { const tt = 0.002 + Math.random() * 0.25; this.modal(c, bus, tt, 2500 + Math.random() * 5000, [1, 2.7, 5.1], [0.05, 0.03, 0.02], [0.3, 0.2, 0.1], 0.6 * Math.random()); } this.burst(c, bus, 0.002, { type: 'highpass', f: 3000, vol: 0.6, tau: 0.02 }); const fire = this.gain(c, 0.35); fire.connect(out); this.burst(c, fire, 0.05, { type: 'bandpass', f: 500, f2: 1600, q: 0.6, vol: 0.8, tau: 0.35, attack: 0.05, brown: true }); return 1.4; },
    // melee
    swingLight(c, out, v) { const s = this.src(c, 0, 0.4), bp = this.filt(c, 'bandpass', 500, 2.2), g = this.gain(c, 0); s.connect(bp); bp.connect(g); g.connect(out); const p = bp.frequency; p.setValueAtTime(420, 0); p.linearRampToValueAtTime(1500 + v * 200, 0.11); p.linearRampToValueAtTime(600, 0.24); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.7, 0.1); g.gain.linearRampToValueAtTime(0, 0.26); return 0.32; },
    swingHeavy(c, out, v) { const s = this.src(c, 0, 0.6), bp = this.filt(c, 'bandpass', 300, 1.6), g = this.gain(c, 0); s.connect(bp); bp.connect(g); g.connect(out); const p = bp.frequency; p.setValueAtTime(240, 0); p.linearRampToValueAtTime(900 + v * 100, 0.2); p.linearRampToValueAtTime(320, 0.42); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.85, 0.18); g.gain.linearRampToValueAtTime(0, 0.45); const lo = this.gain(c, 0.4); lo.connect(out); this.burst(c, lo, 0.12, { type: 'lowpass', f: 220, vol: 0.6, tau: 0.12, attack: 0.06, brown: true }); return 0.55; },
    metal(c, out, v) { const bus = this.gain(c, 1); bus.connect(out); const f0 = 620 + v * 140 + Math.random() * 120; this.burst(c, bus, 0.001, { type: 'highpass', f: 2500, vol: 0.9, tau: 0.004 });
      this.modal(c, bus, 0.001, f0, [1, 2.32, 4.25, 6.63, 9.38, 12.1], [0.55, 0.32, 0.2, 0.12, 0.08, 0.05], [0.9, 0.7, 0.5, 0.35, 0.25, 0.15], 0.5); this.tail(c, bus, out, 'stone', 0.25); return 2.2; },
    block(c, out, v) { const bus = this.gain(c, 1); bus.connect(out); this.thump(c, bus, 0.001, 220, 110, 0.03, 0.9); this.burst(c, bus, 0.001, { type: 'bandpass', f: 900, q: 1.2, vol: 0.9, tau: 0.03 }); this.modal(c, bus, 0.001, 420 + v * 60, [1, 2.1, 3.7, 5.2], [0.35, 0.22, 0.12, 0.08], [0.8, 0.5, 0.3, 0.2], 0.4); return 1.4; },
    flesh(c, out, v) { const bus = this.gain(c, 1); bus.connect(out); this.thump(c, bus, 0.001, 130 + v * 10, 55, 0.03, 1);
      const sq = this.burst(c, bus, 0.004, { type: 'bandpass', f: 1400, f2: 380, q: 4, vol: 1.1, tau: 0.05, sweep: 0.04 }); this.burst(c, bus, 0.001, { type: 'lowpass', f: 1200, vol: 0.7, tau: 0.02 });
      for (let i = 0; i < 4; i++) this.burst(c, bus, 0.02 + Math.random() * 0.08, { type: 'bandpass', f: 600 + Math.random() * 900, q: 9, vol: 0.25, tau: 0.012 }); return 0.4; },
    fleshHeavy(c, out, v) { const bus = this.gain(c, 1); bus.connect(out); this.R.flesh.call(this, c, bus, v); for (let i = 0; i < 3; i++) this.burst(c, bus, 0.01 + i * 0.012 + Math.random() * 0.01, { type: 'highpass', f: 2200, vol: 0.55, tau: 0.004 }); this.thump(c, bus, 0.001, 90, 40, 0.06, 0.8); return 0.55; },
    gore(c, out, v) { const bus = this.gain(c, 1); bus.connect(out); for (let i = 0; i < 9; i++) this.burst(c, bus, Math.random() * 0.3, { type: 'bandpass', f: 300 + Math.random() * 900, f2: 200, q: 6, vol: 0.4, tau: 0.03 + Math.random() * 0.04 }); this.burst(c, bus, 0.001, { type: 'highpass', f: 1800, vol: 0.6, tau: 0.006 }); this.thump(c, bus, 0.05, 110, 50, 0.05, 0.6); return 0.7; },
    // voices
    moan(c, out, v) { const f0 = 68 + v * 9 + Math.random() * 18, d = 0.9 + Math.random() * 0.9; this.voice(c, out, 0, d, { f0, f1: f0 * (0.72 + Math.random() * 0.2), jitter: 0.06, sub: 0.6, rough: 0.5, roughF: 22 + Math.random() * 14, breath: 0.22, dist: 2.2, vol: 0.6, attack: 0.18, glide: 0.85, lp: 2800, formants: [[540 + Math.random() * 120, 5, 1], [980 + Math.random() * 200, 7, 0.6], [2350, 9, 0.25]] }); return d + 0.3; },
    snarl(c, out, v) { const f0 = 140 + v * 20, d = 0.45; this.voice(c, out, 0, d, { f0, f1: f0 * 0.7, jitter: 0.1, sub: 0.4, rough: 0.8, roughF: 45, breath: 0.6, dist: 5, vol: 0.7, attack: 0.03, formants: [[780, 4, 1], [1250, 6, 0.7], [2600, 8, 0.35]] }); this.burst(c, out, d * 0.8, { type: 'highpass', f: 3000, vol: 0.4, tau: 0.004 }); /* teeth */ return d + 0.2; },
    death(c, out, v) { const f0 = 110 + v * 15, d = 1.1; this.voice(c, out, 0, d, { f0, f1: f0 * 0.45, jitter: 0.08, sub: 0.7, rough: 0.6, roughF: 18, breath: 0.3, dist: 2, vol: 0.55, attack: 0.04, glide: 0.7, lp: 3000, formants: [[620, 5, 1], [1050, 7, 0.6], [2400, 9, 0.25]] });
      for (let i = 0; i < 12; i++) this.burst(c, out, 0.35 + Math.random() * 0.7, { type: 'bandpass', f: 250 + Math.random() * 500, q: 12, vol: 0.18, tau: 0.02 }); /* gurgle */ return d + 0.3; },
    scream(c, out, v) { const f0 = 520 + v * 60, d = 1.4; this.voice(c, out, 0, d, { f0, f1: f0 * 1.35, jitter: 0.05, rough: 0.35, roughF: 60, breath: 0.5, dist: 6, vol: 0.55, attack: 0.08, vib: 7, formants: [[400, 5, 0.8], [2200, 6, 1], [3100, 8, 0.6]] }); return d + 0.3; },
    roar(c, out, v) { const bus = this.gain(c, 1); bus.connect(out); const d = 1.9; for (let i = 0; i < 3; i++) this.voice(c, bus, 0.01 * i, d, { f0: 52 + i * 7 + v * 4, f1: 40 + i * 5, jitter: 0.08, sub: 0.9, rough: 0.7, roughF: 26 + i * 4, breath: 0.35, dist: 6, vol: 0.45, attack: 0.15, lp: 2400, formants: [[480, 4, 1], [820, 5, 0.7], [2200, 8, 0.3]] });
      this.burst(c, bus, 0.05, { type: 'lowpass', f: 300, vol: 0.6, tau: 0.7, attack: 0.2, brown: true }); this.tail(c, bus, out, 'field', 0.55); return 3.6; },
    grunt(c, out, v) { const f0 = 105 + v * 12, d = 0.26; this.voice(c, out, 0, d, { f0, f1: f0 * 0.8, jitter: 0.04, sub: 0.2, rough: 0.2, breath: 0.5, dist: 1.5, vol: 0.6, attack: 0.02, formants: [[640, 6, 1], [1150, 8, 0.6], [2500, 10, 0.25]] }); const ar = this.gain(c, 0.12); ar.connect(out); this.modal(c, ar, 0.005, 1500 + v * 200, [1, 2.4, 4.1], [0.08, 0.05, 0.03]); return 0.5; },
    effort(c, out, v) { const f0 = 120 + v * 10, d = 0.18; this.voice(c, out, 0, d, { f0, f1: f0 * 1.1, jitter: 0.03, breath: 0.7, vol: 0.35, attack: 0.02, formants: [[700, 6, 1], [1200, 8, 0.5], [2600, 10, 0.2]] }); return 0.3; },
    bark(c, out, v) { const bus = this.gain(c, 1); bus.connect(out); const n = 1 + (v % 2); for (let k = 0; k < n; k++) { const t = k * 0.22, f0 = 380 + v * 30; this.voice(c, bus, t, 0.13, { f0, f1: f0 * 0.6, jitter: 0.05, rough: 0.3, roughF: 70, breath: 0.4, dist: 3, vol: 0.7, attack: 0.008, formants: [[900, 4, 1], [1700, 6, 0.6], [3000, 8, 0.3]] }); } this.tail(c, bus, out, 'field', 0.3); return 0.4 + n * 0.22 + 0.5; },
    growl(c, out, v) { this.voice(c, out, 0, 0.7, { f0: 95 + v * 8, f1: 85, jitter: 0.08, rough: 0.9, roughF: 32, breath: 0.6, dist: 3, vol: 0.5, attack: 0.08, formants: [[500, 4, 1], [1000, 6, 0.5], [2500, 8, 0.2]] }); return 0.9; },
    whine(c, out, v) { this.voice(c, out, 0, 0.6, { f0: 700 + v * 40, f1: 950, jitter: 0.02, breath: 0.3, vol: 0.3, attack: 0.05, vib: 9, formants: [[800, 3, 0.6], [2000, 5, 1], [3200, 8, 0.4]] }); return 0.8; },
    // foley: footsteps
    stepDirt(c, out, v) { const bus = this.gain(c, 1); bus.connect(out); this.burst(c, bus, 0.001, { type: 'lowpass', f: 260, vol: 0.8, tau: 0.018, brown: true }); for (let i = 0; i < 14; i++) this.burst(c, bus, 0.004 + Math.random() * 0.05, { type: 'bandpass', f: 1400 + Math.random() * 2600, q: 1.5, vol: 0.18 * Math.random(), tau: 0.003 }); return 0.18; },
    stepWood(c, out, v) { const bus = this.gain(c, 1); bus.connect(out); this.thump(c, bus, 0.001, 140, 90, 0.02, 0.8); const r = this.gain(c, 0.5); r.connect(bus); this.modal(c, r, 0.001, 190 + v * 25, [1, 2.3, 3.6], [0.06, 0.04, 0.025], [0.8, 0.4, 0.2]); this.burst(c, bus, 0.001, { type: 'bandpass', f: 1800, q: 1, vol: 0.25, tau: 0.005 }); if (v === 3) { const cr = this.osc(c, 'sawtooth', 160, 0.06, 0.25), bp = this.filt(c, 'bandpass', 900, 8), g = this.env(this.gain(c, 0), 0.06, 0.08, 0.04, 0.08); cr.frequency.linearRampToValueAtTime(110, 0.3); cr.connect(bp); bp.connect(g); g.connect(bus); } return 0.4; },
    stepStone(c, out, v) { const bus = this.gain(c, 1); bus.connect(out); this.burst(c, bus, 0.001, { type: 'lowpass', f: 400, vol: 0.6, tau: 0.012 }); this.burst(c, bus, 0.001, { type: 'highpass', f: 2500, vol: 0.35, tau: 0.006 }); for (let i = 0; i < 4; i++) this.burst(c, bus, 0.01 + Math.random() * 0.03, { type: 'bandpass', f: 3000 + Math.random() * 3000, q: 3, vol: 0.12, tau: 0.003 }); this.tail(c, bus, out, 'stone', 0.25); return 0.5; },
    armour(c, out, v) { const bus = this.gain(c, 1); bus.connect(out); for (let i = 0; i < 5; i++) this.modal(c, bus, 0.002 + Math.random() * 0.04, 2400 + Math.random() * 3000, [1, 2.6, 4.3], [0.04, 0.025, 0.015], [0.5, 0.3, 0.15], 0.35 * Math.random()); this.burst(c, bus, 0.001, { type: 'bandpass', f: 4000, q: 0.8, vol: 0.12, tau: 0.03 }); return 0.25; },
    land(c, out, v) { const bus = this.gain(c, 1); bus.connect(out); this.thump(c, bus, 0.001, 110, 45, 0.05, 1); this.burst(c, bus, 0.001, { type: 'lowpass', f: 700, vol: 0.9, tau: 0.04, brown: true }); this.R.armour.call(this, c, bus, v); for (let i = 0; i < 12; i++) this.burst(c, bus, 0.01 + Math.random() * 0.15, { type: 'bandpass', f: 1500 + Math.random() * 3000, q: 1.5, vol: 0.15 * Math.random(), tau: 0.004 }); return 0.5; },
    roll(c, out, v) { const bus = this.gain(c, 1); bus.connect(out); const s = this.src(c, 0, 0.5), bp = this.filt(c, 'bandpass', 600, 0.8), g = this.gain(c, 0); s.connect(bp); bp.connect(g); g.connect(bus); bp.frequency.setValueAtTime(400, 0); bp.frequency.linearRampToValueAtTime(1600, 0.2); bp.frequency.linearRampToValueAtTime(500, 0.4); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.5, 0.1); g.gain.linearRampToValueAtTime(0, 0.42); this.R.armour.call(this, c, bus, v); this.thump(c, bus, 0.25, 100, 50, 0.05, 0.6); return 0.6; },
    // weapons foley
    magOut(c, out, v) { this.modal(c, out, 0.001, 2100 + v * 100, [1, 2.2, 3.4], [0.02, 0.015, 0.01], [1, 0.6, 0.3], 0.5); this.burst(c, out, 0.01, { type: 'bandpass', f: 1600, q: 1, vol: 0.3, tau: 0.04 }); return 0.25; },
    magIn(c, out, v) { this.burst(c, out, 0.001, { type: 'bandpass', f: 1200, q: 1, vol: 0.25, tau: 0.03 }); this.modal(c, out, 0.06, 1500 + v * 100, [1, 2.5, 3.9, 6.1], [0.03, 0.02, 0.012, 0.008], [1, 0.7, 0.4, 0.2], 0.7); this.thump(c, out, 0.06, 300, 150, 0.01, 0.4); return 0.3; },
    charge(c, out, v) { const s = this.src(c, 0, 0.2), bp = this.filt(c, 'bandpass', 2800, 2), g = this.env(this.gain(c, 0), 0.0, 0.25, 0.02, 0.04); s.connect(bp); bp.connect(g); g.connect(out); this.modal(c, out, 0.13, 1700 + v * 80, [1, 2.3, 3.8, 5.5], [0.03, 0.02, 0.015, 0.01], [1, 0.8, 0.5, 0.3], 0.8); this.thump(c, out, 0.13, 380, 200, 0.01, 0.4); return 0.35; },
    pumpRack(c, out, v) { this.burst(c, out, 0.001, { type: 'bandpass', f: 1900, q: 1.5, vol: 0.4, tau: 0.04 }); this.modal(c, out, 0.06, 1100 + v * 60, [1, 2.2, 3.5], [0.03, 0.02, 0.012], [1, 0.6, 0.3], 0.8); this.burst(c, out, 0.16, { type: 'bandpass', f: 2100, q: 1.5, vol: 0.4, tau: 0.04 }); this.modal(c, out, 0.22, 1250 + v * 60, [1, 2.4, 3.9], [0.035, 0.02, 0.012], [1, 0.6, 0.3], 0.9); this.thump(c, out, 0.22, 260, 140, 0.015, 0.5); return 0.45; },
    shell(c, out, v) { this.burst(c, out, 0.001, { type: 'bandpass', f: 1500, q: 1, vol: 0.3, tau: 0.02 }); this.thump(c, out, 0.03, 420, 260, 0.01, 0.4); this.modal(c, out, 0.03, 900, [1, 2.7], [0.015, 0.01], [0.6, 0.3], 0.5); return 0.2; },
    boltCycle(c, out, v) { this.modal(c, out, 0.001, 1900, [1, 2.6, 4.1], [0.02, 0.015, 0.01], [1, 0.6, 0.3], 0.6); this.burst(c, out, 0.03, { type: 'bandpass', f: 3000, q: 2, vol: 0.3, tau: 0.05 }); this.burst(c, out, 0.16, { type: 'bandpass', f: 2600, q: 2, vol: 0.3, tau: 0.04 }); this.modal(c, out, 0.22, 1600, [1, 2.4, 3.7], [0.025, 0.02, 0.012], [1, 0.7, 0.4], 0.7); return 0.4; },
    dryFire(c, out, v) { this.modal(c, out, 0.001, 3100 + v * 200, [1, 2.4], [0.012, 0.008], [1, 0.5], 0.5); return 0.08; },
    ping(c, out, v) { this.modal(c, out, 0.001, 2620 + v * 20, [1, 2.76, 5.4, 8.9], [0.6, 0.35, 0.2, 0.1], [1, 0.5, 0.3, 0.1], 0.35); this.R.casing.call(this, c, out, v); return 1.0; },
    casing(c, out, v) { let tt = 0.05, a = 0.25; for (let i = 0; i < 4; i++) { this.modal(c, out, tt, 3800 + v * 400 + Math.random() * 300, [1, 2.76, 5.4], [0.05 * a * 4, 0.03, 0.015], [1, 0.5, 0.25], a); tt += 0.09 * Math.pow(0.6, i) + 0.02; a *= 0.55; } return 0.6; },
    // bows & launchers
    bow(c, out, v) { this.playArr(c, out, 0.001, this.pluck(98 + v * 6, 0.6, 0.996, 0.55), 1.3); const s = this.src(c, 0, 0.3), bp = this.filt(c, 'bandpass', 1200, 1.5), g = this.env(this.gain(c, 0), 0.0, 0.1, 0.03, 0.05); s.connect(bp); bp.connect(g); g.connect(out); this.thump(c, out, 0.001, 160, 80, 0.02, 0.4); return 0.5; },
    crossbow(c, out, v) { this.playArr(c, out, 0.001, this.pluck(140 + v * 8, 0.3, 0.985, 0.4), 0.7); this.thump(c, out, 0.001, 180, 70, 0.03, 0.8); this.modal(c, out, 0.001, 800, [1, 2.4, 3.9], [0.05, 0.03, 0.02], [0.6, 0.4, 0.2], 0.4); return 0.4; },
    launcherGL(c, out, v) { this.thump(c, out, 0.001, 140, 55, 0.05, 1); this.burst(c, out, 0.001, { type: 'lowpass', f: 900, vol: 0.8, tau: 0.04, brown: true }); this.modal(c, out, 0.001, 260, [1, 2.1], [0.08, 0.05], [0.5, 0.2], 0.4); return 0.6; },
    launcherRL(c, out, v) { const bus = this.gain(c, 1); bus.connect(out); this.thump(c, bus, 0.001, 120, 45, 0.06, 1); const s = this.src(c, 0, 1.2), bp = this.filt(c, 'bandpass', 500, 0.7), g = this.gain(c, 0); s.connect(bp); bp.connect(g); g.connect(bus); bp.frequency.linearRampToValueAtTime(2600, 0.6); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.8, 0.04); g.gain.setTargetAtTime(0.00001, 0.2, 0.3); this.tail(c, bus, out, 'field', 0.5); return 2.0; },
    // world
    coin(c, out, v) { for (let i = 0; i < 2 + v; i++) this.modal(c, out, i * (0.05 + Math.random() * 0.04), 3400 + Math.random() * 1400, [1, 2.76, 5.4, 8.9], [0.18, 0.1, 0.06, 0.03], [1, 0.6, 0.3, 0.15], 0.3); return 0.7; },
    pouch(c, out, v) { this.burst(c, out, 0.001, { type: 'bandpass', f: 1200, q: 0.7, vol: 0.4, tau: 0.05 }); for (let i = 0; i < 6; i++) this.modal(c, out, 0.02 + Math.random() * 0.12, 2200 + Math.random() * 1600, [1, 2.5], [0.03, 0.02], [1, 0.4], 0.2); return 0.35; },
    chains(c, out, v) { for (let i = 0; i < 26; i++) { const t = i * 0.085 + Math.random() * 0.02; this.modal(c, out, t, 1300 + Math.random() * 1200, [1, 2.3, 3.9], [0.03, 0.02, 0.01], [1, 0.5, 0.25], 0.22); } const s = this.src(c, 0, 2.4, true), lp = this.filt(c, 'lowpass', 160, 0.8), g = this.env(this.gain(c, 0), 0, 0.9, 0.3, 1.2); s.connect(lp); lp.connect(g); g.connect(out); this.modal(c, out, 2.2, 95, [1, 1.9, 2.8, 4.1], [0.8, 0.5, 0.3, 0.2], [1, 0.6, 0.4, 0.2], 0.7); this.thump(c, out, 2.2, 80, 35, 0.12, 1); return 3.6; },
    trapSnap(c, out, v) { this.modal(c, out, 0.001, 900, [1, 2.4, 3.9, 6.2], [0.25, 0.15, 0.1, 0.06], [1, 0.6, 0.4, 0.2], 0.7); this.burst(c, out, 0.001, { type: 'highpass', f: 2000, vol: 0.9, tau: 0.008 }); this.thump(c, out, 0.001, 200, 90, 0.02, 0.7); return 1.2; },
    fire(c, out, v) { const bus = this.gain(c, 1); bus.connect(out); const s = this.src(c, 0, 2.5, true), lp = this.filt(c, 'lowpass', 500, 0.6), g = this.gain(c, 0.5); s.connect(lp); lp.connect(g); g.connect(bus); for (let i = 0; i < 70; i++) this.burst(c, bus, Math.random() * 2.4, { type: 'bandpass', f: 1500 + Math.random() * 5000, q: 2, vol: Math.random() * 0.4, tau: 0.002 + Math.random() * 0.006 }); return 2.5; },
  },
  EST: { bow: 0.8, explosion: 2.8, roar: 3.0, chains: 3.4, moan: 2.2, death: 1.6, scream: 1.8, metal: 2.4, fire: 2.6, flashbang: 2.4, launcherRL: 2.2, block: 1.6, glass: 1.6, bark: 1.8, ping: 1.2, trapSnap: 1.4, growl: 1.0, whine: 0.9 },
  /* name -> [recipe, variations] */
  LIST() {
    const L = { explosion: ['explosion', 2], flashbang: ['flashbang', 2], glass: ['glass', 2], swingLight: ['swingLight', 3], swingHeavy: ['swingHeavy', 3], metal: ['metal', 3], block: ['block', 3], flesh: ['flesh', 4], fleshHeavy: ['fleshHeavy', 3], gore: ['gore', 3],
      moan: ['moan', 4], snarl: ['snarl', 3], death: ['death', 3], scream: ['scream', 2], roar: ['roar', 2], grunt: ['grunt', 3], effort: ['effort', 2], bark: ['bark', 3], growl: ['growl', 2], whine: ['whine', 1],
      stepDirt: ['stepDirt', 4], stepWood: ['stepWood', 4], stepStone: ['stepStone', 3], armour: ['armour', 3], land: ['land', 2], roll: ['roll', 2],
      magOut: ['magOut', 2], magIn: ['magIn', 2], charge: ['charge', 2], pumpRack: ['pumpRack', 2], shell: ['shell', 2], boltCycle: ['boltCycle', 2], dryFire: ['dryFire', 2], ping: ['ping', 1], casing: ['casing', 3],
      bow: ['bow', 2], crossbow: ['crossbow', 2], launcherGL: ['launcherGL', 2], launcherRL: ['launcherRL', 2], coin: ['coin', 3], pouch: ['pouch', 2], chains: ['chains', 1], trapSnap: ['trapSnap', 2], fire: ['fire', 1] };
    for (const k in this.GUNS) L['gun_' + k] = ['gun:' + k, k === 'minigun' || k === 'smg' || k === 'lmg' ? 3 : 2];
    return L;
  },

  /* ---------------------------------------------------------------- build the bank (async, during loading) */
  async build(progress) {
    if (this.ready || this.building || !window.OfflineAudioContext) return; this.building = true;
    const L = this.LIST(), keys = Object.keys(L); let done = 0;
    for (const name of keys) {
      const [rec, n] = L[name]; this.bank[name] = [];
      for (let v = 0; v < n; v++) {
        try {
          const est = rec.startsWith('gun:') ? 2.1 : (this.EST[rec] || 1.2), c = new OfflineAudioContext(1, Math.floor(this.SR * est), this.SR), out = this.gain(c, 1), lim = c.createDynamicsCompressor(); lim.threshold.value = -3; lim.ratio.value = 12; lim.attack.value = 0.001; lim.release.value = 0.1; out.connect(lim); lim.connect(c.destination);
          const dur = rec.startsWith('gun:') ? this.gun(c, out, v, this.GUNS[rec.slice(4)]) : this.R[rec].call(this, c, out, v);
          const buf = await c.startRendering(); this.bank[name].push(this.trim(buf, Math.min(est, dur + 0.3)));
        } catch (e) { console.warn('sfx', name, e); }
      }
      done++; if (progress) progress(done / keys.length); if (done % 6 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    this.ready = true; this.building = false;
  },
  /* cut silence off the end and normalise peak so each family sits at a consistent level */
  trim(buf, maxSec) {
    const d = buf.getChannelData(0); let end = Math.min(d.length, Math.floor(maxSec * this.SR)); while (end > 100 && Math.abs(d[end - 1]) < 0.0012) end--; let peak = 0; for (let i = 0; i < end; i++) peak = Math.max(peak, Math.abs(d[i]));
    const out = new AudioBuffer({ length: Math.max(1, end), numberOfChannels: 1, sampleRate: this.SR }), o = out.getChannelData(0), k = peak > 0 ? 0.9 / peak : 1, fade = Math.min(400, end);
    for (let i = 0; i < end; i++) o[i] = d[i] * k * (i > end - fade ? (end - i) / fade : 1); return out;
  },

  /* ---------------------------------------------------------------- playback */
  LIMITS: { moan: 4, snarl: 3, death: 4, flesh: 6, metal: 4, stepDirt: 2, stepWood: 2, stepStone: 2, armour: 2, casing: 3, explosion: 4 },
  has(name) { return this.ready && this.bank[name] && this.bank[name].length; },
  play(A, name, o = {}) {
    if (!this.has(name)) return null; const c = A.ctx, now = c.currentTime;
    const live = (this.voices[name] = (this.voices[name] || []).filter((s) => s.end > now)); if (live.length >= (this.LIMITS[name] || 8)) return null;
    const list = this.bank[name], buf = list[Math.floor(Math.random() * list.length)];
    const s = c.createBufferSource(); s.buffer = buf; s.playbackRate.value = (o.rate || 1) * (1 + (Math.random() - 0.5) * (o.vary ?? 0.07));
    // position: pan with screen offset, roll off with distance, darken distant sounds
    let vol = o.vol ?? 1, pan = 0, far = 0;
    if (o.x !== undefined && IF.game && IF.game.run) { const run = IF.game.run, cx = run.camX + (IF.VIEW_W || IF.W) / 2, dx = o.x - cx; pan = Math.max(-0.85, Math.min(0.85, dx / 800)); far = Math.min(1, Math.abs(dx) / 1600); vol *= 1 / (1 + Math.abs(dx) / 1100); }
    const g = c.createGain(); g.gain.value = vol; let node = s;
    if (far > 0.15) { const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 18000 - far * 14000; s.connect(lp); node = lp; }
    node.connect(g); let tail = g;
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); tail = p; }
    tail.connect(o.bus || A.sfxBus); if (A.space && (o.room ?? 0.25) > 0) { const sg = c.createGain(); sg.gain.value = o.room ?? 0.25; tail.connect(sg); sg.connect(A.space); }
    s.start(now + (o.delay || 0)); live.push({ end: now + (o.delay || 0) + buf.duration / s.playbackRate.value }); return s;
  },
};
