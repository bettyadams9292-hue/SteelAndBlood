/* Game director — app state, the Run (one endless-survival attempt), camera, render pipeline, HUD. */
'use strict';

IF.Run = class Run {
  constructor(modeId) {
    const mode = IF.MODES[modeId] || IF.MODES.endless; this.mode = mode;
    this.mods = { rewardMult: mode.rewardMult };
    let seed = Date.now();
    if (mode.seeded) { const day = new Date().toISOString().slice(0, 10); seed = IF.hashString('daily' + day); const mod = IF.DAILY_MODIFIERS[seed % IF.DAILY_MODIFIERS.length]; mod.apply(this.mods); this.dailyMod = mod; this.day = day; }
    this.mode = Object.assign({}, mode, { rewardMult: this.mods.rewardMult });
    this.rng = new IF.RNG(seed);
    this.section = 1; this.boons = []; this.enemies = []; this.hazards = []; this.shockwaves = [];
    this.kills = 0; this.distance = 0; this.time = 0; this.goldEarned = 0; this.xpEarned = 0; this.bossesKilled = 0; this.rewardsTaken = 0; this.lastWasBoss = false;
    this.ammo = {}; this.combo = 0; this.comboT = 0; this.maxCombo = 0;
    this.world = IF.world.generate(this, 1, 0);
    this.player = new IF.Player(this);
    for (const k of ['primary', 'secondary']) if (this.player.weapons[k]) this.ensureAmmo(this.player.weapons[k].def.ammo);
    this.camX = 0; this.bannerT = 3.2; this.banner = this.sectionTitle();
    IF.save.data.stats.runs++;
  }
  sectionTitle() { return { top: this.world.isBoss ? 'GUARDIAN · SECTION ' + this.section : 'SECTION ' + this.section, main: this.world.biome.name }; }
  ammoMax(type) { return Math.round(IF.AMMO[type].base * (1 + this.player.st.ammoCap) * (this.mods.ammoMult || 1)); }
  ensureAmmo(type) { if (type && this.ammo[type] === undefined) this.ammo[type] = this.player ? this.ammoMax(type) : Math.round(IF.AMMO[type].base * (this.mods.ammoMult || 1)); }
  aliveCount() { let n = 0; for (const e of this.enemies) if (!e.dead) n++; return n; }

  spawnEnemy(id, x, opts = {}) {
    if (this.aliveCount() >= 28 && !opts.force) return null;
    const def = IF.ENEMY[id]; const e = new IF.Enemy(this, def, x, this.section, opts);
    this.enemies.push(e); return e;
  }
  spawnWave(size, nearX) {
    const pl = this.player;
    for (let i = 0; i < size; i++) {
      const id = IF.world.rollEnemy(this);
      const rise = this.rng.chance(0.35);
      const x = rise ? pl.x + (this.rng.chance(0.75) ? 1 : -1) * (300 + this.rng.next() * 400) : this.camX + IF.VIEW_W + 60 + i * 70 + this.rng.next() * 120;
      const cx = IF.util.clamp(x, this.world.leftBound + 60, this.world.rightBound - 60);
      this.spawnEnemy(id, cx, { rise });
    }
  }
  onKill(e) {
    const d = IF.save.data, pl = this.player;
    this.kills++; d.stats.kills++; d.stats.killsBy[e.id] = (d.stats.killsBy[e.id] || 0) + 1;
    this.combo++; this.comboT = 3; this.maxCombo = Math.max(this.maxCombo, this.combo);
    const xp = e.def.xp * (1 + this.section * 0.05) * (this.mode.xpMult || 1) * (e.boss ? 1 : 1);
    IF.prog.addXp(xp); this.xpEarned += xp;
    const gold = Math.round(e.def.gold * (1 + this.section * 0.04) * (1 + pl.st.goldFind) * this.mode.rewardMult);
    const n = Math.min(6, Math.max(1, Math.round(gold / 4)));
    for (let i = 0; i < n; i++) this.world.pickups.push(IF.world.pickup('gold', e.x + (Math.random() - 0.5) * 40, { amount: Math.ceil(gold / n), vy: -300 - Math.random() * 200, vx: (Math.random() - 0.5) * 300, y: e.y - 60 }));
    if ((e.def.dropsAmmo && Math.random() < e.def.dropsAmmo) || Math.random() < 0.06) this.world.pickups.push(IF.world.pickup('ammo', e.x, { vy: -250, y: e.y - 50 }));
    if (Math.random() < 0.035 + (e.elite ? 0.5 : 0)) this.world.pickups.push(IF.world.pickup('health', e.x, { vy: -250, y: e.y - 50 }));
    if (pl.st.killHeal) pl.heal(pl.st.killHeal, true);
    if (e.elite) { d.mats.parts += 2; d.mats.steel += 2; IF.fx.text(e.x, e.y - 200, 'ELITE SLAIN', '#ff5a6a', 22, true); }
    if (e.boss) this.onBossKilled(e);
    IF.save.markDirty();
  }
  onBossKilled(e) {
    const d = IF.save.data; this.bossesKilled++; d.stats.bosses++;
    d.mats.shards += 1 + Math.floor(this.section / 15); d.gold += e.def.gold; this.goldEarned += e.def.gold;
    IF.fx.flash = 0.6; IF.fx.addShake(25); IF.fx.hitstop = 0.35;
    this.banner = { top: 'GUARDIAN DEFEATED', main: e.def.name, sub: '+' + e.def.gold + ' gold · Obsidian shard' }; this.bannerT = 3.5;
    for (const o of this.enemies) if (!o.dead && o !== e) o.die({ dir: Math.sign(o.x - e.x) || 1 });
    IF.audio.setMusic(this.world.biome.music, false); IF.audio.reward(4);
  }

  update(dt) {
    const pl = this.player, W = this.world;
    this.time += dt; this.comboT -= dt; if (this.comboT <= 0) this.combo = 0;
    if (this.refillAmmo) { this.refillAmmo = false; for (const k in this.ammo) this.ammo[k] = this.ammoMax(k); }
    if (this.healFull) { this.healFull = false; pl.refreshStats(); pl.hp = pl.maxHp; }
    pl.update(dt);
    // encounter triggers
    for (const tr of W.triggers) if (!tr.fired && pl.x > tr.x) { tr.fired = true; this.spawnWave(tr.size); }
    if (W.gateTrigger && !W.gateTrigger.fired && pl.x > W.gateTrigger.x) { W.gateTrigger.fired = true; W.gateWave = true; this.spawnWave(Math.round(this.waveBonus())); this.banner = { top: 'THE GATE IS SEALED', main: 'Hold the line' }; this.bannerT = 2; IF.audio.scream(); }
    // boss arena
    if (W.isBoss && !W.bossSpawned && pl.x > W.start + 350) {
      W.bossSpawned = true; const n = Math.floor(this.section / this.mode.bossEvery) - 1;
      const def = IF.BOSSES[n % IF.BOSSES.length]; this.boss = IF.makeBoss(this, def, W.end - 200, this.section); this.enemies.push(this.boss);
      W.leftBound = W.start + 150; this.bossIntroT = 2.6; IF.audio.setMusic(W.biome.music, true); IF.audio.roar(); IF.fx.addShake(12);
      this.banner = { top: def.title.toUpperCase(), main: def.name, boss: true }; this.bannerT = 2.8;
    }
    // gate opens once the gate horde (or the boss) is dead
    if (!W.gateOpen) {
      const clear = W.isBoss ? (W.bossSpawned && this.boss && this.boss.dead) : (W.gateWave && this.aliveCount() === 0);
      if (clear) { W.gateOpen = true; W.rightBound = W.end + 200; IF.audio.ui('upgrade'); if (!W.isBoss) { this.banner = { top: 'SECTION CLEARED', main: 'The gate opens' }; this.bannerT = 1.8; } }
    }
    if (W.gateOpen && pl.x > W.gateX + 70 && !pl.dead) { IF.game.openReward(); return; }
    // enemies
    for (const e of this.enemies) e.update(dt);
    if (this.enemies.length > 60 || this.enemies.some((e) => e.dead && e.deadT > 5)) this.enemies = this.enemies.filter((e) => !(e.dead && e.deadT > 5));
    // straggler catch-up: zombies left far behind teleport-rise near the player so the gate wave can't soft-lock
    for (const e of this.enemies) if (!e.dead && !e.boss && pl.x - e.x > 1400) { e.x = pl.x + 500; e.state = 'rise'; e.stateT = 0; }
    // shockwaves (boss slams) — jump over them
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i]; s.t -= dt; s.x += s.dir * s.speed * dt; if (s.t <= 0) { this.shockwaves.splice(i, 1); continue; }
      if (Math.random() < 0.7) IF.fx.dust(s.x, IF.GROUND, 1, 'rgba(200,150,100,0.5)');
      if (!s.hit && Math.abs(pl.x - s.x) < 30 && pl.y > IF.GROUND - 30) { s.hit = true; pl.takeDamage({ x: s.x - s.dir * 50, dmg: s.dmg, heavy: true, unblockable: false }); }
    }
    IF.combat.update(this, dt);
    IF.gore.update(this, dt);
    // pickups
    for (const p of W.pickups) {
      if (!p.alive) continue; p.t += dt;
      if (p.vy || p.vx) { p.vy += 1600 * dt; p.y += p.vy * dt; p.x += (p.vx || 0) * dt; if (p.y >= IF.GROUND - 14) { p.y = IF.GROUND - 14; p.vy = 0; p.vx = 0; } }
      const dx = pl.x - p.x, dy = (pl.y - 60) - p.y, dist = Math.hypot(dx, dy);
      if (p.kind === 'gold' && dist < 160 && p.t > 0.4) { p.x += dx * dt * 8; p.y += dy * dt * 8; }
      if (dist < 50 && p.t > 0.25) this.collect(p);
    }
    if (W.pickups.length > 120) W.pickups = W.pickups.filter((p) => p.alive);
    // camera with look-ahead
    const look = pl.facing * 170 + pl.vx * 0.25;
    let target = pl.x - IF.VIEW_W * 0.42 + look;
    if (W.isBoss && W.bossSpawned) target = IF.util.clamp(target, W.start + 100, W.end - IF.VIEW_W + 120);
    target = Math.max(target, W.leftBound - 60);
    this.camX += (target - this.camX) * Math.min(1, dt * 4.5);
    this.bannerT -= dt; if (this.bossIntroT) this.bossIntroT -= dt;
    IF.audio.music.intensity = Math.min(1, this.aliveCount() / 14);
    // stats
    const d = IF.save.data; d.stats.time += dt;
    if (pl.dead && pl.deadT > 2.2) IF.game.endRun();
  }
  waveBonus() { return this.world.triggers.length ? this.world.triggers[0].size * 1.4 + 2 : 6; }
  collect(p) {
    const pl = this.player, d = IF.save.data; p.alive = false;
    if (p.kind === 'gold') { const a = p.amount || 3; d.gold += a; this.goldEarned += a; IF.audio.coin(); }
    else if (p.kind === 'health') { const h = 18 + pl.maxHp * 0.18; pl.heal(h); IF.audio.pickup(); }
    else if (p.kind === 'ammo') {
      IF.audio.pickup(); let any = false;
      for (const k in this.ammo) { const add = Math.round(IF.AMMO[k].pickup * (1 + pl.st.ammoCap)); const before = this.ammo[k]; this.ammo[k] = Math.min(this.ammoMax(k), this.ammo[k] + add); if (this.ammo[k] > before) any = true; }
      IF.fx.text(pl.x, pl.y - 170, any ? 'AMMO' : 'AMMO FULL', '#ffc070', 16);
    }
  }
  /* QA hook: regenerate the world at section n (used by automated tests & the debug console). */
  jumpTo(n) {
    this.section = n; this.enemies = []; this.boss = null; this.shockwaves.length = 0; this.hazards.length = 0;
    this.world = IF.world.generate(this, n, Math.round(this.player.x - 200)); this.player.dist0 = this.player.x;
    this.banner = this.sectionTitle(); this.bannerT = 2; IF.audio.setMusic(this.world.biome.music, false);
  }
  nextSection() {
    const W = this.world, d = IF.save.data;
    d.stats.sections++; this.section++;
    if (this.section - 1 > d.stats.bestSection) d.stats.bestSection = this.section - 1;
    this.lastWasBoss = false;
    const start = W.end + 120;
    this.world = IF.world.generate(this, this.section, start);
    this.enemies = this.enemies.filter((e) => !e.dead); this.hazards.length = 0; this.shockwaves.length = 0; this.boss = null;
    this.player.dist0 = this.player.x;
    this.banner = this.sectionTitle(); this.bannerT = 3;
    IF.audio.setMusic(this.world.biome.music, false);
    // small heal between sections
    this.player.heal(this.player.maxHp * 0.15);
  }
};

IF.game = {
  state: 'splash', run: null, t: 0, last: 0, fps: 60, fpsAcc: 0, fpsN: 0, canvas: null, ctx: null, weather: [], perf: { frame: 0, worst: 0 },

  init() {
    this.canvas = document.getElementById('game'); this.ctx = this.canvas.getContext('2d');
    this.resize(); window.addEventListener('resize', () => this.resize());
    IF.fx.init(); IF.combat.init(); IF.input.init(this.canvas);
    IF.save.load();
    IF.ui.init();
    for (let i = 0; i < 90; i++) this.weather.push({ x: Math.random() * IF.W, y: Math.random() * IF.H, s: Math.random() });
    IF.events.on('levelup', (lv) => { IF.audio.levelUp(); IF.ui.toast('LEVEL ' + lv + ' — skill point earned', 'level'); if (this.run) { this.run.player.refreshStats(); IF.fx.ring(this.run.player.x, this.run.player.y - 80, 160, '#ffd36b'); } });
    IF.events.on('achievement', (a) => IF.ui.toast('ACHIEVEMENT · ' + a.name, 'ach', a.desc));
    IF.events.on('toast', (o) => IF.ui.toast(o.text, o.bad ? 'bad' : ''));
    requestAnimationFrame((t) => this.loop(t));
  },
  resize() {
    const r = window.devicePixelRatio || 1, vw = window.innerWidth, vh = window.innerHeight;
    const scale = Math.min(vw / IF.W, vh / IF.H);
    this.canvas.style.width = Math.floor(IF.W * scale) + 'px'; this.canvas.style.height = Math.floor(IF.H * scale) + 'px';
    const q = Math.min(2, r * scale); this.canvas.width = Math.round(IF.W * q); this.canvas.height = Math.round(IF.H * q); this.pxScale = q;
    document.documentElement.style.setProperty('--ui-scale', scale);
    const wrap = document.getElementById('wrap'); if (wrap) { wrap.style.width = this.canvas.style.width; wrap.style.height = this.canvas.style.height; }
  },

  newRun(modeId) {
    IF.fx.reset(); IF.combat.reset(); IF.gore.reset();
    this.run = new IF.Run(modeId || 'endless'); this.state = 'playing';
    IF.audio.unlock(); IF.audio.setMusic(this.run.world.biome.music, false);
    IF.ui.show(null); IF.ui.hud(true);
  },
  pause() { if (this.state !== 'playing') return; this.state = 'paused'; IF.ui.show('pause'); IF.save.write(); },
  resume() { if (this.state !== 'paused') return; this.state = 'playing'; IF.ui.show(null); },
  openReward() {
    const run = this.run; run.lastWasBoss = run.world.isBoss;
    const offers = IF.loot.rollRewards(run, run.rng);
    this.state = 'reward'; IF.ui.showReward(offers);
  },
  claimReward(offer) {
    const run = this.run; IF.loot.claim(offer, run); run.rewardsTaken++;
    run.player.refreshStats();
    for (const k of ['melee', 'primary', 'secondary']) { const it = IF.loot.findItem(IF.save.data.equipped[k]); if (it && (!run.player.weapons[k] || run.player.weapons[k].item.uid !== it.uid)) run.player.equipWeapon(k, it); else if (it) run.player.weapons[k].ws = IF.loot.weaponStats(it, run.player.st); }
    if (offer.type === 'weapon' && IF.WEAPON[offer.item.id].slot !== 'melee') { run.player.show = 'gun'; run.player.showT = 4; }
    IF.prog.checkAchievements(); IF.save.write();
    run.nextSection(); this.state = 'playing'; IF.ui.show(null);
  },
  endRun() {
    const run = this.run, d = IF.save.data; if (this.state === 'dead') return;
    this.state = 'dead';
    d.stats.deaths++;
    d.stats.distance += run.distance;
    d.stats.bestSection = Math.max(d.stats.bestSection, run.section);
    d.stats.bestDistance = Math.max(d.stats.bestDistance, Math.round(run.distance));
    d.stats.bestTime = Math.max(d.stats.bestTime, Math.round(run.time));
    d.stats.bestKills = Math.max(d.stats.bestKills, run.kills);
    if (run.day) d.dailyBest[run.day] = Math.max(d.dailyBest[run.day] || 0, run.section);
    IF.prog.checkAchievements(); IF.save.write();
    IF.audio.setMusic(1, false);
    IF.ui.showDeath(run);
  },
  quitToMenu() { if (this.run && this.state !== 'dead') { const r = this.run; IF.save.data.stats.distance += r.distance; IF.save.data.stats.bestSection = Math.max(IF.save.data.stats.bestSection, r.section); } this.run = null; this.state = 'menu'; IF.save.write(); IF.ui.hud(false); IF.ui.show('menu'); IF.audio.setMusic(0, false); },

  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    let dt = Math.min(0.05, (now - (this.last || now)) / 1000); this.last = now;
    this.fpsAcc += dt; this.fpsN++; if (this.fpsAcc > 0.5) { this.fps = this.fpsN / this.fpsAcc; this.fpsAcc = 0; this.fpsN = 0; }
    const t0 = performance.now();
    IF.input.update(now);
    this.step(dt);
    this.render();
    IF.save.tick();
    const ft = performance.now() - t0; this.perf.frame = ft; this.perf.worst = Math.max(this.perf.worst * 0.995, ft);
  },
  step(dt) {
    this.t += dt;
    if (IF.input.pressed('pause')) { if (this.state === 'playing') this.pause(); else if (this.state === 'paused') this.resume(); else IF.ui.back(); }
    if (this.state === 'playing') {
      if (IF.fx.hitstop > 0) { IF.fx.hitstop -= dt; dt *= 0.08; }
      this.run.update(dt);
      IF.prog.checkAchievements();
      IF.ui.updateHud(this.run);
    }
    if (this.state !== 'paused') IF.fx.update(dt);
  },

  /* ---------------- rendering ---------------- */
  render() {
    const ctx = this.ctx, q = this.pxScale; ctx.setTransform(q, 0, 0, q, 0, 0);
    if (!this.run) { this.canvas.style.cursor = 'default'; this.renderMenuBackdrop(ctx); return; }
    const run = this.run, camX = Math.round(run.camX + IF.fx.shakeX), shY = IF.fx.shakeY, t = this.t;
    IF.world.drawBackground(ctx, run, camX, t);
    const Z = IF.ZOOM; ctx.save(); ctx.translate(0, IF.GROUND * (1 - Z) + shY); ctx.scale(Z, Z); ctx.translate(-camX, 0);
    IF.world.drawGround(ctx, run, camX);
    IF.fx.drawDecals(ctx, camX);
    // hazards
    for (const h of run.hazards) if (h.type === 'toxic') { ctx.fillStyle = 'rgba(130,200,40,' + Math.min(0.45, h.t * 0.2) + ')'; ctx.beginPath(); ctx.ellipse(h.x, IF.GROUND + 2, h.w / 2, 9, 0, 0, 6.283); ctx.fill(); }
    IF.world.drawProps(ctx, run, camX, t);
    IF.world.drawGate(ctx, run, t);
    IF.fx.drawParts(ctx, false);
    IF.world.drawPickups(ctx, run, t);
    for (const e of run.enemies) if (e.dead) e.draw(ctx);
    IF.gore.draw(ctx, camX);
    for (const e of run.enemies) if (!e.dead && e.x > camX - 300 && e.x < camX + IF.VIEW_W + 300) e.draw(ctx);
    for (const s of run.shockwaves) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,170,90,0.6)'; ctx.beginPath(); ctx.moveTo(s.x - 26, IF.GROUND); ctx.quadraticCurveTo(s.x, IF.GROUND - 46, s.x + 26, IF.GROUND); ctx.fill(); ctx.restore(); }
    run.player.draw(ctx); run.player.drawTrail(ctx);
    IF.combat.draw(ctx);
    IF.fx.drawParts(ctx, true);
    IF.fx.drawTexts(ctx);
    // enemy health bars for damaged non-boss enemies
    for (const e of run.enemies) if (!e.dead && !e.boss && e.hp < e.maxHp && e.state !== 'rise') { const w = 46 * (e.scale || 1), y = e.y - e.h - 18; ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(e.x - w / 2 - 1, y - 1, w + 2, 6); ctx.fillStyle = e.elite ? '#ff3d4a' : '#c0302a'; ctx.fillRect(e.x - w / 2, y, w * Math.max(0, e.hp / e.maxHp), 4); if (e.armor > 0.3) { ctx.fillStyle = '#9aa4ad'; ctx.fillRect(e.x - w / 2, y - 3, w, 2); } }
    IF.world.drawForeground(ctx, run, camX);
    ctx.restore();
    this.renderWeather(ctx, run, t);
    this.renderLighting(ctx, run);
    this.renderHud(ctx, run, t);
  },
  renderWeather(ctx, run, t) {
    const w = run.world.biome.weather, q = IF.fx.quality(); if (w === 'none') return;
    const n = Math.floor(this.weather.length * q); ctx.save();
    for (let i = 0; i < n; i++) {
      const p = this.weather[i];
      if (w === 'rain') { p.y += 900 * (0.7 + p.s * 0.6) / 60; p.x -= 3; if (p.y > IF.H) { p.y = -20; p.x = Math.random() * (IF.W + 200); } ctx.strokeStyle = 'rgba(170,190,220,' + (0.15 + p.s * 0.25) + ')'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 4, p.y + 18); ctx.stroke(); }
      else if (w === 'embers') { p.y -= (0.5 + p.s) * 1.2; p.x += Math.sin(t * 2 + i) * 0.6 - 0.4; if (p.y < -10) { p.y = IF.H + 10; p.x = Math.random() * IF.W; } ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,' + (100 + p.s * 80 | 0) + ',40,' + (0.4 + 0.4 * Math.sin(t * 5 + i)) + ')'; ctx.fillRect(p.x, p.y, 2 + p.s * 2, 2 + p.s * 2); }
      else if (w === 'ash') { p.y += (0.4 + p.s) * 0.8; p.x += Math.sin(t + i) * 0.5 - 0.3; if (p.y > IF.H) { p.y = -10; p.x = Math.random() * IF.W; } ctx.fillStyle = 'rgba(200,190,180,' + (0.2 + p.s * 0.3) + ')'; ctx.fillRect(p.x, p.y, 2 + p.s * 2, 2); }
      else if (w === 'spores') { p.y -= 0.3 + p.s * 0.3; p.x += Math.sin(t * 0.7 + i) * 0.4; if (p.y < -10) { p.y = IF.H; p.x = Math.random() * IF.W; } ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(140,255,180,' + (0.15 + 0.2 * Math.sin(t * 2 + i)) + ')'; ctx.beginPath(); ctx.arc(p.x, p.y, 1.5 + p.s * 2, 0, 6.283); ctx.fill(); }
      else if (w === 'dust') { p.x -= 0.6 + p.s; if (p.x < -10) { p.x = IF.W + 10; p.y = Math.random() * IF.H; } ctx.fillStyle = 'rgba(200,180,150,' + (0.08 + p.s * 0.12) + ')'; ctx.fillRect(p.x, p.y, 3, 1.5); }
    }
    ctx.restore();
  },
  renderLighting(ctx, run) {
    const pl = run.player, b = run.world.biome, sx = (pl.x - run.camX) * IF.ZOOM, sy = IF.GROUND - (IF.GROUND - pl.y + 80) * IF.ZOOM;
    // vignette + coloured key light
    const g = ctx.createRadialGradient(sx, sy, 120, IF.W / 2, IF.H / 2, IF.W * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,' + (b.indoor ? 0.72 : 0.55) * (run.mods.fog ? 1.2 : 1) + ')');
    ctx.fillStyle = g; ctx.fillRect(0, 0, IF.W, IF.H);
    ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = b.light; ctx.globalAlpha = 0.22; ctx.fillRect(0, 0, IF.W, IF.H); ctx.restore();
    // low health pulse
    const hpk = pl.hp / pl.maxHp; IF.fx.vignettePulse *= 0.93;
    const danger = Math.max(IF.fx.vignettePulse * 0.6, hpk < 0.3 ? (0.3 - hpk) * 2 * (0.6 + 0.4 * Math.sin(this.t * 6)) : 0);
    if (danger > 0.02) { const r = ctx.createRadialGradient(IF.W / 2, IF.H / 2, IF.H * 0.35, IF.W / 2, IF.H / 2, IF.W * 0.7); r.addColorStop(0, 'rgba(120,0,0,0)'); r.addColorStop(1, 'rgba(160,0,0,' + danger * 0.7 + ')'); ctx.fillStyle = r; ctx.fillRect(0, 0, IF.W, IF.H); }
    if (IF.fx.flash > 0) { ctx.globalAlpha = IF.fx.flash; ctx.fillStyle = IF.fx.flashColor; ctx.fillRect(0, 0, IF.W, IF.H); ctx.globalAlpha = 1; }
    if (pl.buff('berserk')) { ctx.fillStyle = 'rgba(160,0,0,0.12)'; ctx.fillRect(0, 0, IF.W, IF.H); }
  },
  renderHud(ctx, run, t) {
    const pl = run.player, d = IF.save.data, F = (s, w = 700) => w + ' ' + s + 'px Cinzel, Georgia, serif';
    ctx.save();
    // --- vitals ---
    const bar = (x, y, w, h, k, c1, c2, label) => { ctx.fillStyle = 'rgba(10,6,6,0.75)'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4); ctx.strokeStyle = '#5a4a3a'; ctx.lineWidth = 1; ctx.strokeRect(x - 2.5, y - 2.5, w + 5, h + 5); const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, c1); g.addColorStop(1, c2); ctx.fillStyle = g; ctx.fillRect(x, y, w * IF.util.clamp(k, 0, 1), h); ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(x, y, w * IF.util.clamp(k, 0, 1), h * 0.35); if (label) { ctx.font = F(11); ctx.fillStyle = '#f2e8d8'; ctx.fillText(label, x + 6, y + h - 3); } };
    // crest
    ctx.fillStyle = 'rgba(10,6,6,0.8)'; ctx.beginPath(); ctx.moveTo(18, 16); ctx.lineTo(70, 16); ctx.lineTo(70, 60); ctx.quadraticCurveTo(70, 80, 44, 92); ctx.quadraticCurveTo(18, 80, 18, 60); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#b8964a'; ctx.lineWidth = 2; ctx.stroke();
    IF.art.cross(ctx, 44, 50, 38, '#b3151d'); ctx.font = F(15, 900); ctx.fillStyle = '#f2e8d8'; ctx.textAlign = 'center'; ctx.fillText(d.level, 44, 108); ctx.textAlign = 'left';
    ctx.font = F(11); ctx.fillStyle = '#c9b48a'; ctx.fillText(d.appearance.name.toUpperCase(), 312, 53);
    bar(84, 20, 300, 18, pl.hp / pl.maxHp, '#d0302a', '#6a0d0d', Math.ceil(pl.hp) + ' / ' + pl.maxHp);
    bar(84, 44, 220, 8, pl.stamina / pl.maxStamina, '#e0c060', '#8a6a20');
    bar(84, 58, 220, 5, d.xp / IF.prog.xpToNext(d.level), '#7aa8ff', '#3a5aa8');
    // boons
    run.boons.forEach((b, i) => { ctx.fillStyle = IF.RARITY[b.rarity].color; ctx.globalAlpha = 0.85; ctx.fillRect(84 + i * 18, 70, 14, 14); ctx.globalAlpha = 1; ctx.fillStyle = '#000'; ctx.font = F(10, 900); ctx.fillText(b.name[0], 88 + i * 18, 81); });
    // --- section info ---
    ctx.textAlign = 'center'; ctx.font = F(13); ctx.fillStyle = '#c9b48a'; ctx.fillText((run.world.isBoss ? 'GUARDIAN · ' : 'SECTION ') + run.section + '  ·  ' + run.world.biome.name.toUpperCase(), IF.W / 2, 28);
    ctx.font = F(12, 400); ctx.fillStyle = '#e8dcc8'; ctx.fillText(Math.floor(run.distance) + ' m   ·   ' + IF.util.fmtTime(run.time) + '   ·   ' + run.kills + ' kills', IF.W / 2, 46);
    const prog = IF.util.clamp((pl.x - run.world.start) / (run.world.gateX - run.world.start), 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(IF.W / 2 - 120, 54, 240, 4); ctx.fillStyle = '#b3151d'; ctx.fillRect(IF.W / 2 - 120, 54, 240 * prog, 4);
    if (run.world.gateWave && !run.world.gateOpen) { ctx.fillStyle = '#ff7a5a'; ctx.font = F(12); ctx.fillText('ZOMBIES REMAINING: ' + run.aliveCount(), IF.W / 2, 74); }
    if (run.mode.id !== 'endless') { ctx.fillStyle = '#9a8a6a'; ctx.font = F(11, 400); ctx.fillText(run.mode.name.toUpperCase() + (run.dailyMod ? ' · ' + run.dailyMod.name : ''), IF.W / 2, run.world.gateWave && !run.world.gateOpen ? 90 : 74); }
    // --- currency ---
    ctx.textAlign = 'right'; ctx.font = F(15); ctx.fillStyle = '#ffd060'; ctx.fillText(IF.util.fmt(d.gold) + ' ⦿', IF.W - 22, 32);
    if (run.combo >= 5) { ctx.font = F(20 + Math.min(14, run.combo / 3), 900); ctx.fillStyle = '#ff5a3a'; ctx.globalAlpha = Math.min(1, run.comboT); ctx.fillText(run.combo + ' KILL STREAK', IF.W - 22, 62); ctx.globalAlpha = 1; }
    // --- weapons panel ---
    const touchUI = IF.ui.touchEnabled(), g = pl.gun, mel = pl.melee, px = touchUI ? IF.W - 380 : IF.W - 300, py = touchUI ? 46 : IF.H - 108;
    ctx.fillStyle = 'rgba(10,6,6,0.72)'; ctx.fillRect(px, py, 280, 88); ctx.strokeStyle = '#5a4a3a'; ctx.strokeRect(px + 0.5, py + 0.5, 280, 88);
    ctx.textAlign = 'left';
    if (g) {
      const rc = IF.RARITY[g.item.rarity].color; ctx.fillStyle = rc; ctx.fillRect(px, py, 4, 50);
      ctx.font = F(13); ctx.fillStyle = rc; ctx.fillText(g.def.name + (g.item.level > 1 ? ' +' + (g.item.level - 1) : ''), px + 12, py + 20);
      ctx.font = F(26, 900); ctx.fillStyle = g.mag === 0 ? '#ff5a4a' : '#f2e8d8'; ctx.fillText(g.reload > 0 ? '...' : g.mag, px + 12, py + 48);
      ctx.font = F(13, 400); ctx.fillStyle = '#a89a80'; ctx.fillText('/ ' + (run.ammo[g.def.ammo] ?? 0) + '  ' + IF.AMMO[g.def.ammo].name, px + 12 + ctx.measureText(String(g.reload > 0 ? '...' : g.mag)).width * 2.1, py + 48);
      if (g.reload > 0) { ctx.fillStyle = '#e0c060'; ctx.fillRect(px + 12, py + 54, 160 * (1 - g.reload / g.ws.reload), 3); }
      const other = pl.weapons[pl.gunSlot === 'primary' ? 'secondary' : 'primary'];
      if (other) { ctx.font = F(10, 400); ctx.fillStyle = '#8a7c66'; ctx.fillText('[' + IF.input.keyLabel('switch') + '] ' + other.def.name + ' · ' + other.mag, px + 12, py + 72); }
    } else { ctx.font = F(12, 400); ctx.fillStyle = '#8a7c66'; ctx.fillText('No firearm yet — clear sections', px + 12, py + 30); ctx.fillText('to earn weapon rewards', px + 12, py + 48); }
    if (mel) { ctx.font = F(10, 400); ctx.fillStyle = IF.RARITY[mel.item.rarity].color; ctx.textAlign = 'right'; ctx.fillText(mel.def.name, px + 272, py + 84); }
    // --- ability ---
    const ab = d.ability; ctx.textAlign = 'center';
    if (ab) {
      const A = IF.ABILITIES[ab], ax = touchUI ? IF.W - 412 : IF.W - 340, ay = touchUI ? 80 : IF.H - 64, k = pl.abilityCd > 0 ? pl.abilityCd / (A.cd * Math.max(0.3, 1 - pl.st.abilityCd)) : 0;
      ctx.fillStyle = 'rgba(10,6,6,0.8)'; ctx.beginPath(); ctx.arc(ax, ay, 26, 0, 6.283); ctx.fill(); ctx.strokeStyle = k > 0 ? '#5a4a3a' : A.color; ctx.lineWidth = 3; ctx.stroke();
      if (k > 0) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.arc(ax, ay, 24, -Math.PI / 2, -Math.PI / 2 + k * 6.283); ctx.fill(); }
      ctx.font = F(18, 900); ctx.fillStyle = k > 0 ? '#6a5a4a' : A.color; ctx.fillText(A.icon, ax, ay + 6);
      ctx.font = F(9, 400); ctx.fillStyle = '#a89a80'; ctx.fillText(IF.input.keyLabel('special'), ax, ay + 40);
    }
    // --- boss bar ---
    const boss = run.boss;
    if (boss && !boss.dead) {
      const bw = 640, bx = IF.W / 2 - bw / 2, by = IF.H - 54;
      ctx.font = F(16, 900); ctx.fillStyle = '#f2e8d8'; ctx.fillText(boss.def.name.toUpperCase(), IF.W / 2, by - 10);
      bar(bx, by, bw, 14, boss.hp / boss.maxHp, '#b3151d', '#4a0606');
      for (const ph of boss.def.phases) if (ph.at < 1) { ctx.fillStyle = '#f2e8d8'; ctx.fillRect(bx + bw * ph.at - 1, by - 2, 2, 18); }
      if (boss.vuln > 0) { ctx.font = F(13, 900); ctx.fillStyle = '#ffe08a'; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 10); ctx.fillText('VULNERABLE — STRIKE NOW!', IF.W / 2, by + 34); ctx.globalAlpha = 1; }
    }
    // --- banner ---
    if (run.bannerT > 0 && run.banner && this.state === 'playing') {
      const k = Math.min(1, run.bannerT, (3.2 - run.bannerT) * 3); ctx.globalAlpha = Math.max(0, k);
      const by = run.banner.boss ? 250 : 200;
      const grd = ctx.createLinearGradient(0, by - 50, 0, by + 30); grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(0.5, 'rgba(0,0,0,0.6)'); grd.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = grd; ctx.fillRect(0, by - 60, IF.W, 110);
      ctx.font = F(14); ctx.fillStyle = run.banner.boss ? '#ff5a4a' : '#c9a35a'; ctx.fillText(run.banner.top, IF.W / 2, by - 24);
      ctx.font = F(run.banner.boss ? 48 : 40, 900); ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.strokeText(run.banner.main, IF.W / 2, by + 18);
      const tg = ctx.createLinearGradient(0, by - 20, 0, by + 20); tg.addColorStop(0, '#ffffff'); tg.addColorStop(0.5, '#c8c0b4'); tg.addColorStop(1, '#8a8278'); ctx.fillStyle = run.banner.boss ? '#e8302a' : tg; ctx.fillText(run.banner.main, IF.W / 2, by + 18);
      if (run.banner.sub) { ctx.font = F(14, 400); ctx.fillStyle = '#ffd36b'; ctx.fillText(run.banner.sub, IF.W / 2, by + 44); }
      ctx.globalAlpha = 1;
    }
    // tutorial hints for first runs
    if (!d.tutorialDone && run.section === 1 && run.time < 40 && !IF.ui.touchEnabled()) {
      const tips = [['Move', 'left', 'right'], ['Jump', 'jump'], ['Attack (hold = heavy)', 'attack'], ['Block / Parry', 'block'], ['Dodge', 'dodge']];
      ctx.textAlign = 'left'; ctx.font = F(12, 400); ctx.globalAlpha = Math.min(1, (40 - run.time) / 3);
      tips.forEach((tp, i) => { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(18, 130 + i * 24, 230, 20); ctx.fillStyle = '#e8dcc8'; ctx.fillText(tp.slice(1).map((a) => IF.input.keyLabel(a)).join(' / ') + '  —  ' + tp[0], 26, 145 + i * 24); });
      ctx.globalAlpha = 1;
    }
    // crosshair at the pointer (mouse) or along the aim line (stick)
    if (IF.input.mouseAim && pl.gun && !pl.dead) {
      const m = IF.input.mouse, ready = pl.gun.reload <= 0 && pl.gun.mag > 0, sp = 8 + pl.aimKick * 40;
      ctx.strokeStyle = ready ? 'rgba(255,230,200,0.95)' : 'rgba(255,90,70,0.95)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(m.x, m.y, 4 + sp * 0.4, 0, 6.283); ctx.stroke();
      ctx.beginPath(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.moveTo(m.x + dx * sp, m.y + dy * sp); ctx.lineTo(m.x + dx * (sp + 9), m.y + dy * (sp + 9)); } ctx.stroke();
      ctx.fillStyle = '#b3151d'; ctx.fillRect(m.x - 1.5, m.y - 1.5, 3, 3);
    } else if (IF.input.mouseAim) { const m = IF.input.mouse; ctx.strokeStyle = 'rgba(255,230,200,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(m.x, m.y, 6, 0, 6.283); ctx.stroke(); }
    this.canvas.style.cursor = this.state === 'playing' ? 'none' : 'default';
    if (d.settings.showFps) { ctx.textAlign = 'left'; ctx.font = '12px monospace'; ctx.fillStyle = '#7f7'; ctx.fillText(Math.round(this.fps) + ' fps  ' + this.perf.frame.toFixed(1) + 'ms  e:' + run.aliveCount() + ' p:' + IF.fx.parts.aliveCount, 10, IF.H - 10); }
    ctx.restore();
  },
  renderMenuBackdrop(ctx) {
    ctx.fillStyle = '#0a0606'; ctx.fillRect(0, 0, IF.W, IF.H);
  },
};
