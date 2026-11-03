/* Audio — fully synthesised with the Web Audio API (no external assets, no licensing issues).
 * Separate music/SFX buses with user volume. Each weapon class has its own synthesised voice.
 * Procedural adaptive music: dark ambient per biome, percussion-driven boss themes. */
'use strict';

IF.audio = {
  ctx: null, master: null, sfxBus: null, musicBus: null, comp: null,
  noiseBuf: null, ready: false, lastPlay: {},
  music: { mood: -1, boss: false, nextTime: 0, step: 0, bar: 0, prog: 0, timer: null, intensity: 0 },

  unlock() {
    if (this.ready) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      this.ctx = new AC();
      this.comp = this.ctx.createDynamicsCompressor();
      this.comp.threshold.value = -14; this.comp.ratio.value = 6; this.comp.attack.value = 0.003; this.comp.release.value = 0.2;
      this.master = this.ctx.createGain(); this.master.gain.value = 0.9;
      this.sfxBus = this.ctx.createGain(); this.musicBus = this.ctx.createGain();
      this.sfxBus.connect(this.comp); this.musicBus.connect(this.comp); this.comp.connect(this.master); this.master.connect(this.ctx.destination);
      // shared reverb for atmosphere
      this.verb = this.ctx.createConvolver(); this.verb.buffer = this._impulse(2.6, 2.2);
      this.verbSend = this.ctx.createGain(); this.verbSend.gain.value = 0.35;
      this.verbSend.connect(this.verb); this.verb.connect(this.comp);
      const len = this.ctx.sampleRate * 2; this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.ready = true; this.applyVolumes();
      this.music.timer = setInterval(() => this._schedule(), 50);
    } catch (e) { console.warn('Audio unavailable', e); }
  },
  _impulse(sec, decay) {
    const rate = this.ctx.sampleRate, len = rate * sec, buf = this.ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return buf;
  },
  applyVolumes() {
    if (!this.ready) return; const s = IF.save.data.settings;
    this.sfxBus.gain.value = s.sfx * 0.8; this.musicBus.gain.value = s.music * 0.42;
  },
  /* Throttle identical sounds so 30 zombies groaning don't clip. */
  _ok(key, ms) { const t = performance.now(); if (this.lastPlay[key] && t - this.lastPlay[key] < ms) return false; this.lastPlay[key] = t; return true; },

  /* ----- primitives ----- */
  _noise(t, dur, { type = 'bandpass', f = 1000, f2 = null, q = 1, vol = 0.5, attack = 0.002, out = null, verb = 0 } = {}) {
    const c = this.ctx, src = c.createBufferSource(); src.buffer = this.noiseBuf; src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur); fl.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl); fl.connect(g); g.connect(out || this.sfxBus); if (verb) { const s = c.createGain(); s.gain.value = verb; g.connect(s); s.connect(this.verbSend); }
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  },
  _tone(t, dur, { type = 'sine', f = 440, f2 = null, vol = 0.3, attack = 0.005, out = null, verb = 0, detune = 0 } = {}) {
    const c = this.ctx, o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur); o.detune.value = detune;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out || this.sfxBus); if (verb) { const s = c.createGain(); s.gain.value = verb; g.connect(s); s.connect(this.verbSend); }
    o.start(t); o.stop(t + dur + 0.05);
  },

  /* ----- weapons ----- */
  GUN_VOICE: {
    pistol: { crack: 2600, body: 900, thump: 140, dur: 0.16, vol: 0.55 },
    revolver: { crack: 2000, body: 650, thump: 110, dur: 0.32, vol: 0.7, verb: 0.3 },
    handcannon: { crack: 1500, body: 420, thump: 80, dur: 0.45, vol: 0.85, verb: 0.4 },
    smg: { crack: 3200, body: 1200, thump: 160, dur: 0.09, vol: 0.38 },
    rifle: { crack: 2800, body: 800, thump: 120, dur: 0.18, vol: 0.5, verb: 0.15 },
    shotgun: { crack: 1300, body: 380, thump: 75, dur: 0.38, vol: 0.85, verb: 0.3 },
    pump: { crack: 1200, body: 350, thump: 70, dur: 0.45, vol: 0.9, verb: 0.35 },
    dbshotgun: { crack: 1100, body: 320, thump: 65, dur: 0.5, vol: 0.95, verb: 0.35 },
    sniper: { crack: 3800, body: 700, thump: 70, dur: 0.9, vol: 0.9, verb: 0.6 },
    lmg: { crack: 2300, body: 700, thump: 100, dur: 0.14, vol: 0.5 },
    minigun: { crack: 3000, body: 1000, thump: 140, dur: 0.06, vol: 0.32 },
  },
  shot(cls) {
    if (!this.ready) return; const c = this.ctx, t = c.currentTime;
    if (cls === 'bow') { this._tone(t, 0.18, { type: 'triangle', f: 220, f2: 90, vol: 0.35 }); this._noise(t, 0.12, { f: 2400, f2: 600, vol: 0.2 }); return; }
    if (cls === 'crossbow') { this._tone(t, 0.12, { type: 'square', f: 160, f2: 60, vol: 0.25 }); this._noise(t, 0.1, { f: 1500, vol: 0.35, q: 3 }); return; }
    if (cls === 'gl') { this._tone(t, 0.25, { type: 'sine', f: 120, f2: 40, vol: 0.7 }); this._noise(t, 0.2, { type: 'lowpass', f: 900, vol: 0.4 }); return; }
    if (cls === 'rl') { this._noise(t, 0.9, { type: 'bandpass', f: 600, f2: 2400, q: 0.6, vol: 0.6, attack: 0.05 }); this._tone(t, 0.3, { f: 90, f2: 40, vol: 0.6 }); return; }
    const v = this.GUN_VOICE[cls] || this.GUN_VOICE.pistol;
    if (cls === 'minigun' && !this._ok('mini', 30)) return;
    this._noise(t, v.dur * 0.35, { type: 'highpass', f: v.crack, vol: v.vol * 0.9, attack: 0.001 });
    this._noise(t, v.dur, { type: 'lowpass', f: v.body * 2.2, f2: v.body * 0.4, vol: v.vol, attack: 0.001, verb: v.verb || 0.1 });
    this._tone(t, v.dur * 0.8, { type: 'sine', f: v.thump * 1.6, f2: v.thump * 0.5, vol: v.vol * 0.9, attack: 0.001 });
    if (cls === 'pump') { this._mech(t + 0.32, 2); }
  },
  _mech(t, n) { for (let i = 0; i < n; i++) { this._noise(t + i * 0.09, 0.05, { type: 'bandpass', f: 2600 + i * 500, q: 6, vol: 0.32 }); this._tone(t + i * 0.09, 0.04, { type: 'square', f: 900 + i * 200, f2: 500, vol: 0.06 }); } },
  reload(cls, phase) {
    if (!this.ready) return; const t = this.ctx.currentTime;
    if (phase === 'start') this._mech(t, cls === 'lmg' || cls === 'minigun' ? 3 : 1);
    else this._mech(t, 2);
  },
  casing() { if (!this.ready || !this._ok('casing', 45)) return; const t = this.ctx.currentTime + 0.25 + Math.random() * 0.15; this._tone(t, 0.08, { f: 4200 + Math.random() * 1500, vol: 0.05 }); this._tone(t + 0.07, 0.06, { f: 5200 + Math.random() * 900, vol: 0.03 }); },
  empty() { if (!this.ready || !this._ok('empty', 140)) return; this._mech(this.ctx.currentTime, 1); },
  swing(weight) {
    if (!this.ready) return; const t = this.ctx.currentTime, w = weight || 1;
    this._noise(t, 0.14 + 0.1 * w, { type: 'bandpass', f: 1800 / w, f2: 500 / w, q: 1.5, vol: 0.32, attack: 0.03 });
  },
  hit(kind, crit) {
    if (!this.ready || !this._ok('hit', 22)) return; const t = this.ctx.currentTime;
    if (kind === 'metal' || kind === 'block') {
      this._tone(t, 0.35, { type: 'triangle', f: 1300, vol: 0.18, verb: 0.3 }); this._tone(t, 0.3, { type: 'triangle', f: 1870, vol: 0.12 });
      this._noise(t, 0.08, { type: 'highpass', f: 3000, vol: 0.3 });
    } else {
      this._noise(t, 0.12, { type: 'lowpass', f: 900, f2: 200, vol: 0.5 }); this._tone(t, 0.1, { f: 160, f2: 60, vol: 0.4 });
      this._noise(t + 0.01, 0.07, { type: 'bandpass', f: 2200, q: 2, vol: 0.12 });
    }
    if (crit) this._tone(t, 0.25, { type: 'square', f: 1600, f2: 2600, vol: 0.06 });
  },
  explosion(size) {
    if (!this.ready || !this._ok('expl', 60)) return; const t = this.ctx.currentTime, s = size || 1;
    this._noise(t, 1.2 * s, { type: 'lowpass', f: 1600, f2: 80, vol: 0.95, attack: 0.002, verb: 0.5 });
    this._tone(t, 0.7 * s, { type: 'sine', f: 90, f2: 28, vol: 0.9 });
    this._noise(t, 0.2, { type: 'highpass', f: 2000, vol: 0.4 });
  },
  groan(pitch) {
    if (!this.ready || !this._ok('groan', 380)) return; const c = this.ctx, t = c.currentTime, dur = 0.7 + Math.random() * 0.8;
    const f0 = (70 + Math.random() * 50) * (pitch || 1);
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * (0.75 + Math.random() * 0.4), t + dur);
    const lfo = c.createOscillator(); lfo.frequency.value = 5 + Math.random() * 4; const lg = c.createGain(); lg.gain.value = f0 * 0.06; lfo.connect(lg); lg.connect(o.frequency);
    const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 500 + Math.random() * 300; f1.Q.value = 4;
    const f2 = c.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1100 + Math.random() * 400; f2.Q.value = 6;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(this.sfxBus); const s = c.createGain(); s.gain.value = 0.4; g.connect(s); s.connect(this.verbSend);
    o.start(t); lfo.start(t); o.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
  },
  zombieAttack() { if (!this.ready || !this._ok('zatk', 120)) return; const t = this.ctx.currentTime; this._noise(t, 0.3, { type: 'bandpass', f: 700, f2: 300, q: 3, vol: 0.4 }); this._tone(t, 0.25, { type: 'sawtooth', f: 180, f2: 90, vol: 0.12 }); },
  zombieDeath() { if (!this.ready || !this._ok('zdie', 70)) return; const t = this.ctx.currentTime; this._tone(t, 0.5, { type: 'sawtooth', f: 140, f2: 50, vol: 0.12 }); this._noise(t, 0.25, { type: 'lowpass', f: 600, vol: 0.35 }); },
  scream() { if (!this.ready) return; const t = this.ctx.currentTime; for (let i = 0; i < 3; i++) this._tone(t, 1.3, { type: 'sawtooth', f: 700 + i * 230, f2: 1400 + i * 300, vol: 0.07, verb: 0.6, detune: i * 15 }); this._noise(t, 1.2, { type: 'bandpass', f: 2500, q: 2, vol: 0.2 }); },
  roar() { if (!this.ready) return; const t = this.ctx.currentTime; this._tone(t, 1.6, { type: 'sawtooth', f: 70, f2: 45, vol: 0.4, verb: 0.6 }); this._noise(t, 1.5, { type: 'lowpass', f: 700, f2: 200, vol: 0.6, attack: 0.1, verb: 0.6 }); },
  step(armourTier) {
    if (!this.ready || !this._ok('step', 120)) return; const t = this.ctx.currentTime;
    this._noise(t, 0.07, { type: 'lowpass', f: 500, vol: 0.18 });
    this._tone(t, 0.09, { type: 'triangle', f: 2200 + Math.random() * 600, vol: 0.025 + armourTier * 0.004 });
  },
  land() { if (!this.ready) return; const t = this.ctx.currentTime; this._noise(t, 0.15, { type: 'lowpass', f: 400, vol: 0.4 }); this._tone(t, 0.15, { type: 'triangle', f: 1900, vol: 0.05 }); },
  jump() { if (!this.ready) return; const t = this.ctx.currentTime; this._noise(t, 0.12, { type: 'bandpass', f: 900, f2: 1600, vol: 0.12 }); },
  dodge() { if (!this.ready) return; const t = this.ctx.currentTime; this._noise(t, 0.3, { type: 'bandpass', f: 600, f2: 2000, q: 1, vol: 0.28, attack: 0.04 }); },
  hurt() { if (!this.ready || !this._ok('hurt', 150)) return; const t = this.ctx.currentTime; this._tone(t, 0.3, { type: 'sawtooth', f: 220, f2: 110, vol: 0.14 }); this._noise(t, 0.15, { type: 'lowpass', f: 700, vol: 0.35 }); this._tone(t, 0.25, { type: 'triangle', f: 1500, vol: 0.06 }); },
  pickup() { if (!this.ready || !this._ok('pick', 60)) return; const t = this.ctx.currentTime; this._tone(t, 0.12, { type: 'triangle', f: 880, vol: 0.12 }); this._tone(t + 0.06, 0.15, { type: 'triangle', f: 1320, vol: 0.1 }); },
  coin() { if (!this.ready || !this._ok('coin', 50)) return; const t = this.ctx.currentTime; this._tone(t, 0.1, { type: 'square', f: 1975, vol: 0.04 }); this._tone(t + 0.05, 0.18, { type: 'square', f: 2637, vol: 0.04 }); },
  ui(kind) {
    if (!this.ready) return; const t = this.ctx.currentTime;
    if (kind === 'hover') { if (this._ok('hover', 50)) this._tone(t, 0.05, { type: 'triangle', f: 1400, vol: 0.03 }); }
    else if (kind === 'back') this._tone(t, 0.1, { type: 'triangle', f: 500, f2: 350, vol: 0.08 });
    else if (kind === 'error') { this._tone(t, 0.15, { type: 'square', f: 180, vol: 0.06 }); }
    else if (kind === 'upgrade') { [523, 659, 784, 1047].forEach((f, i) => this._tone(t + i * 0.05, 0.3, { type: 'triangle', f, vol: 0.09, verb: 0.3 })); this._noise(t, 0.2, { type: 'highpass', f: 4000, vol: 0.1 }); }
    else this._tone(t, 0.07, { type: 'triangle', f: 900, f2: 1200, vol: 0.08 });
  },
  reward(rarityIndex) {
    if (!this.ready) return; const t = this.ctx.currentTime;
    const notes = [261.6, 329.6, 392, 523.3, 659.3, 784, 1046.5];
    const n = 3 + rarityIndex;
    for (let i = 0; i < n; i++) this._tone(t + i * 0.07, 0.6, { type: 'triangle', f: notes[i % notes.length] * (i >= 7 ? 2 : 1), vol: 0.09, verb: 0.5 });
    if (rarityIndex >= 4) { this._tone(t + n * 0.07, 1.6, { type: 'sawtooth', f: 130.8, vol: 0.08, verb: 0.8 }); this._noise(t, 1.5, { type: 'highpass', f: 5000, vol: 0.08, attack: 0.3, verb: 0.6 }); }
  },
  levelUp() { if (!this.ready) return; const t = this.ctx.currentTime; [392, 523, 659, 784, 1047].forEach((f, i) => this._tone(t + i * 0.09, 0.7, { type: 'triangle', f, vol: 0.1, verb: 0.5 })); },
  ability(kind) {
    if (!this.ready) return; const t = this.ctx.currentTime;
    if (kind === 'nova') { this.explosion(1.2); this._tone(t, 1.2, { type: 'sine', f: 880, f2: 1760, vol: 0.12, verb: 0.8 }); }
    else if (kind === 'warcry') { this._tone(t, 1.0, { type: 'sawtooth', f: 150, f2: 190, vol: 0.2, verb: 0.7 }); this._tone(t, 1.0, { type: 'sawtooth', f: 225, f2: 280, vol: 0.12, verb: 0.7 }); }
    else if (kind === 'berserk') { this._tone(t, 0.9, { type: 'sawtooth', f: 60, f2: 120, vol: 0.3, verb: 0.5 }); this._noise(t, 0.9, { type: 'lowpass', f: 300, f2: 1500, vol: 0.4 }); }
    else { this._noise(t, 0.6, { type: 'bandpass', f: 400, f2: 1800, vol: 0.5 }); this._tone(t, 0.5, { type: 'square', f: 110, f2: 220, vol: 0.12 }); }
  },

  /* ----- procedural music -----
   * Moods map to biome groups: 0 village/castle, 1 forest/settlement, 2 urban, 3 war, 4 underground.
   * A step sequencer schedules notes ahead of time; progression changes every 8 bars for variety. */
  MOODS: [
    { root: 98, scale: [0, 2, 3, 5, 7, 8, 10], tempo: 68, progs: [[0, 5, 3, 4], [0, 3, 5, 6], [0, 6, 5, 4]], drum: 0.4, bell: 0.6 },
    { root: 87.3, scale: [0, 2, 3, 5, 7, 8, 11], tempo: 60, progs: [[0, 5, 0, 4], [0, 3, 2, 4]], drum: 0.2, bell: 0.8 },
    { root: 82.4, scale: [0, 1, 3, 5, 7, 8, 10], tempo: 84, progs: [[0, 1, 0, 6], [0, 5, 1, 4]], drum: 0.7, bell: 0.3 },
    { root: 73.4, scale: [0, 2, 3, 5, 7, 8, 10], tempo: 92, progs: [[0, 6, 5, 6], [0, 3, 6, 4]], drum: 0.9, bell: 0.2 },
    { root: 65.4, scale: [0, 1, 3, 4, 7, 8, 10], tempo: 72, progs: [[0, 1, 4, 1], [0, 5, 1, 0]], drum: 0.5, bell: 0.5 },
  ],
  setMusic(mood, boss) {
    if (this.music.mood === mood && this.music.boss === !!boss) return;
    this.music.mood = mood; this.music.boss = !!boss; this.music.bar = 0; this.music.step = 0;
    this.music.prog = Math.floor(Math.random() * 3);
    if (this.ready) this.music.nextTime = this.ctx.currentTime + 0.1;
  },
  stopMusic() { this.music.mood = -1; },
  _schedule() {
    if (!this.ready || this.music.mood < 0 || this.ctx.state !== 'running') return;
    const m = this.MOODS[this.music.mood] || this.MOODS[0], boss = this.music.boss;
    const tempo = boss ? 138 : m.tempo, stepDur = 60 / tempo / 4;
    if (this.music.nextTime < this.ctx.currentTime - 0.2) this.music.nextTime = this.ctx.currentTime + 0.05;
    while (this.music.nextTime < this.ctx.currentTime + 0.25) {
      this._musicStep(m, boss, this.music.step, this.music.nextTime, stepDur);
      this.music.nextTime += stepDur; this.music.step++;
      if (this.music.step % 16 === 0) { this.music.bar++; if (this.music.bar % 8 === 0) this.music.prog = (this.music.prog + 1 + Math.floor(Math.random() * 2)) % m.progs.length; }
    }
  },
  _note(m, degree, oct) { const s = m.scale, n = s.length; const o = Math.floor(degree / n); const semis = s[((degree % n) + n) % n] + 12 * (o + oct); return m.root * Math.pow(2, semis / 12); },
  _musicStep(m, boss, step, t, sd) {
    const out = this.musicBus, s16 = step % 16, prog = m.progs[this.music.prog % m.progs.length], chord = prog[this.music.bar % prog.length];
    const inten = this.music.intensity;
    if (s16 === 0) { // pad chord, long
      const dur = sd * 16 * 1.05;
      [0, 2, 4].forEach((d, i) => {
        const f = this._note(m, chord + d, 1);
        this._tone(t, dur, { type: 'sawtooth', f, vol: boss ? 0.05 : 0.035, attack: boss ? 0.3 : 1.2, out: this._padFilter(t, dur, boss ? 1400 : 700), detune: -8 + i * 8, verb: 0.6 });
      });
      this._tone(t, dur, { type: 'sine', f: this._note(m, chord, 0), vol: 0.16, attack: 0.4, out });
    }
    if (boss) { // driving low ostinato + heavy drums
      if (s16 % 2 === 0) this._tone(t, sd * 1.6, { type: 'square', f: this._note(m, chord, -1) * (s16 % 8 === 6 ? 1.5 : 1), vol: 0.07, out: this._padFilter(t, sd * 2, 500) });
      if (s16 === 0 || s16 === 6 || s16 === 10) this._kick(t, 0.5);
      if (s16 === 4 || s16 === 12) this._snare(t, 0.3);
      if (s16 % 2 === 1) this._noise(t, 0.04, { type: 'highpass', f: 7000, vol: 0.05, out });
    } else {
      if ((s16 === 0 || (s16 === 10 && Math.random() < m.drum)) && (m.drum > 0.3 || this.music.bar % 2 === 0)) this._kick(t, 0.25 + inten * 0.15, true);
      if (s16 === 8 && m.drum > 0.6) this._snare(t, 0.12);
      if (Math.random() < 0.09 * m.bell && s16 % 4 === 0) { // sparse bell / choir motif
        const deg = chord + [0, 2, 4, 6, 7][Math.floor(Math.random() * 5)];
        this._tone(t, 2.4, { type: 'sine', f: this._note(m, deg, 3), vol: 0.035, attack: 0.01, out, verb: 0.9 });
        this._tone(t, 2.0, { type: 'sine', f: this._note(m, deg, 4) * 1.003, vol: 0.012, out, verb: 0.9 });
      }
      if (inten > 0.4 && s16 % 4 === 2) this._noise(t, 0.05, { type: 'bandpass', f: 3000, q: 4, vol: 0.03 * inten, out });
    }
  },
  _padFilter(t, dur, f) { const fl = this.ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(f * 0.6, t); fl.frequency.linearRampToValueAtTime(f, t + dur * 0.5); fl.frequency.linearRampToValueAtTime(f * 0.6, t + dur); fl.connect(this.musicBus); return fl; },
  _kick(t, v, tom) { this._tone(t, tom ? 0.6 : 0.35, { type: 'sine', f: tom ? 110 : 140, f2: tom ? 50 : 42, vol: v, out: this.musicBus, verb: tom ? 0.5 : 0.1 }); },
  _snare(t, v) { this._noise(t, 0.22, { type: 'bandpass', f: 1800, q: 0.8, vol: v, out: this.musicBus, verb: 0.3 }); this._tone(t, 0.1, { type: 'triangle', f: 220, f2: 140, vol: v * 0.6, out: this.musicBus }); },
};
