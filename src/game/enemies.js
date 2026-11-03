/* Zombies & bosses — AI state machines, telegraphed attacks, rendering.
 * States: rise -> chase -> windup (telegraph) -> active -> recover -> chase … with stagger/dead overrides. */
'use strict';

IF.Enemy = class Enemy {
  constructor(run, def, x, depth, opts = {}) {
    this.run = run; this.def = def; this.id = def.id; this.x = x; this.y = IF.GROUND; this.vx = 0; this.vy = 0;
    const m = run.mode, hpScale = (1 + depth * 0.13 + Math.pow(depth, 1.4) * 0.012) * (m.enemyHp || 1);
    this.maxHp = this.hp = Math.round(def.hp * hpScale * (opts.hpMult || 1));
    this.dmg = def.dmg * (1 + depth * 0.065) * (opts.dmgMult || 1);
    this.speed = def.speed * (1 + Math.min(0.35, depth * 0.012)) * (0.9 + Math.random() * 0.2);
    this.w = def.w; this.h = def.h; this.armor = def.armor; this.scale = def.scale || 1; this.elite = !!def.elite; this.boss = false;
    this.facing = -1; this.state = opts.rise ? 'rise' : 'chase'; this.stateT = 0; this.cd = 0.5 + Math.random(); this.t = Math.random() * 10;
    this.hitFlash = 0; this.dead = false; this.deadT = 0; this.staggerT = 0; this.groanT = 2 + Math.random() * 6; this.special = 3 + Math.random() * 4;
    this.seed = Math.floor(Math.random() * 1000); this.phase = Math.random() * 6; this.burn = 0; this.bleed = 0; this.vuln = 0;
    this.limp = Math.random() < 0.4 ? 0.5 + Math.random() * 0.5 : 0;
  }
  get isLow() { return this.def.low || this.legless; }
  hitbox() { return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h }; }
  stagger(power, dir) {
    if (this.dead || this.state === 'rise') return;
    const resist = this.boss ? 0.15 : this.elite ? 0.45 : this.def.heavy ? 0.6 : 1;
    if (this.boss && (power < 1.2 || this.state === 'battack' && this.atk && this.stateT > this.atk.wind)) return; // bosses only flinch to heavy blows, never mid-strike
    if (this.def.explode && this.state === 'windup') return; // exploders commit
    const t = 0.12 + power * 0.38 * resist;
    if (this.state === 'stagger' && this.staggerT - this.stateT >= t) return; // don't extend a longer stagger
    if (this.state === 'stagger' && this.stateT < 0.08) return; // rapid fire can't perma-stunlock
    if (this.boss) { this.atk = null; this.cd = Math.max(this.cd, 0.6); }
    this.state = 'stagger'; this.stateT = 0; this.staggerT = t;
  }
  die(o) {
    if (this.dead) return; this.dead = true; this.deadT = 0; this.state = 'dead'; this.hp = 0;
    this.deathDir = (o && o.dir) || -this.facing || 1; this.vx = this.deathDir * (o && o.heavy ? 380 : 160); this.vy = o && o.heavy ? -260 : -80;
    IF.audio.zombieDeath(); IF.fx.blood(this.x, this.y - this.h * 0.5, this.deathDir, this.boss ? 40 : 14, this.def.blood);
    this.run.onKill(this);
    IF.gore.onDeath(this, o || {});
    if (this.def.explode && !this.exploded) { this.exploded = true; IF.combat.explode(this.x, this.y - 50, this.def.explode, this.dmg * 0.6, 'enemy', { source: this }); this.gibbed = true; }
  }

  update(dt) {
    const pl = this.run.player; this.t += dt; this.stateT += dt; this.hitFlash -= dt; this.cd -= dt; this.vuln -= dt;
    // physics
    this.vy += 2400 * dt; this.y += this.vy * dt; if (this.y >= IF.GROUND) { this.y = IF.GROUND; this.vy = 0; }
    this.x += this.vx * dt;
    // stay inside the playable arena so nothing can hide behind the sealed gate
    const W = this.run.world; if (!this.dead && this.state !== 'rise') { const lo = W.leftBound + 30, hi = (W.gateOpen ? W.end + 300 : W.rightBound) - 30; if (this.x < lo) { this.x = lo; this.vx = Math.max(0, this.vx); } else if (this.x > hi) { this.x = hi; this.vx = Math.min(0, this.vx); } }
    if (this.dead) { this.deadT += dt; this.vx *= Math.pow(0.02, dt); return; }
    const dx = pl.x - this.x, adx = Math.abs(dx);
    // groans
    this.groanT -= dt; if (this.groanT <= 0) { this.groanT = 4 + Math.random() * 8; if (adx < 900) IF.audio.groan(this.def.heavy ? 0.7 : this.id === 'runner' ? 1.3 : 1); }
    if (this.state === 'rise') { this.vx = 0; if (this.stateT > 0.9) { this.state = 'chase'; this.stateT = 0; } return; }
    if (this.state === 'stagger') { this.vx = IF.util.approach(this.vx, 0, 1400 * dt); if (this.stateT > this.staggerT) { this.state = 'chase'; this.stateT = 0; this.cd = Math.max(this.cd, 0.3); } return; }
    this.vx = IF.util.approach(this.vx, 0, (this.boss ? 2600 : 1600) * dt); // friction on knockback
    if (this.boss) { this.bossUpdate(dt, dx, adx); return; }
    switch (this.state) {
      case 'chase': {
        if (!pl.dead) this.facing = Math.sign(dx) || this.facing;
        let target = this.speed * this.facing;
        if (this.def.screamer) { // keep distance; scream to summon
          if (adx < 320) target = -this.speed * this.facing * 0.8; else if (adx < 460) target = 0;
          this.special -= dt; if (this.special <= 0 && adx < 900) { this.special = 7 + Math.random() * 3; this.state = 'scream'; this.stateT = 0; IF.audio.scream(); return; }
        }
        if (this.def.military && adx > 260 && adx < 650) { this.special -= dt; if (this.special <= 0) { this.special = 6 + Math.random() * 4; this.state = 'throw'; this.stateT = 0; return; } }
        if (this.def.mutant && adx < 420 && adx > 140 && this.cd <= 0 && Math.random() < dt * 1.5) { this.state = 'leap'; this.stateT = 0; this.vy = -720; this.vx = this.facing * Math.min(650, adx * 2); this.cd = 1.5; return; }
        if (this.limp) target *= 0.75 + 0.25 * Math.sin(this.t * 6);
        if (this.legless) target *= 0.6 + 0.4 * Math.max(0, Math.sin(this.t * 5));
        // gentle separation so the horde doesn't stack into one sprite
        for (const o of this.run.enemies) if (o !== this && !o.dead && !o.boss && Math.abs(o.x - this.x) < 26 && o.isLow === this.isLow) target += (this.x < o.x ? -1 : 1) * 40;
        if (adx < this.def.reach * 0.85 && !pl.dead) target = 0;
        this.walkV = IF.util.approach(this.walkV || 0, target, 900 * dt);
        this.x += this.walkV * dt; this.phase += Math.abs(this.walkV) * dt * 0.05;
        const vertical = this.isLow ? pl.y > IF.GROUND - 70 : pl.y > this.y - this.h - 70;
        if (adx < this.def.reach && this.cd <= 0 && !pl.dead && vertical) { this.state = 'windup'; this.stateT = 0; this.walkV = 0; }
        break;
      }
      case 'windup': {
        const wu = this.def.windup;
        if (this.def.explode) { this.swell = this.stateT / wu; if (Math.floor(this.stateT * 10) % 2 === 0) IF.fx.spawn({ x: this.x, y: this.y - 80, life: 0.1, size: 40, color: 'rgba(160,255,60,0.4)', type: 'glow', add: true }); }
        if (this.stateT >= wu) {
          if (this.def.explode) { this.exploded = true; this.die({ dir: this.facing }); this.gibbed = true; IF.combat.explode(this.x, this.y - 50, this.def.explode, this.dmg, 'enemy', { source: this }); return; }
          this.state = 'active'; this.stateT = 0; IF.audio.zombieAttack(); this.didHit = false;
          if (this.id === 'runner' || this.elite) this.vx = this.facing * 420;
        }
        break;
      }
      case 'active': {
        if (!this.didHit && !pl.dead) {
          const reach = this.def.reach + 24, hdx = (pl.x - this.x) * this.facing;
          const vert = this.isLow ? pl.y > IF.GROUND - 60 : pl.y > this.y - this.h - 40;
          if (hdx > -20 && hdx < reach && vert) { this.didHit = true; pl.takeDamage({ x: this.x, dmg: this.dmg, type: this.def.dmgType, heavy: !!this.def.heavy, attacker: this }); if (this.def.heavy) { IF.fx.addShake(8); IF.fx.dust(this.x + this.facing * 60, IF.GROUND, 8); } }
        }
        if (this.stateT >= this.def.active) { this.state = 'recover'; this.stateT = 0; }
        break;
      }
      case 'recover': if (this.stateT >= this.def.recover) { this.state = 'chase'; this.stateT = 0; this.cd = this.def.cooldown * (0.8 + Math.random() * 0.4); if (this.elite && Math.random() < 0.5) { this.state = 'windup'; } } break;
      case 'scream': {
        if (this.stateT > 0.3 && !this.screamed) {
          this.screamed = true; IF.fx.ring(this.x, this.y - 110, 380, 'rgba(220,220,255,0.7)', 0.8); IF.fx.addShake(5);
          const n = 2 + Math.floor(this.run.section / 6);
          for (let i = 0; i < n; i++) this.run.spawnEnemy(Math.random() < 0.5 ? 'runner' : 'walker', this.x + (Math.random() < 0.5 ? -1 : 1) * (200 + Math.random() * 300), { rise: true });
          for (const o of this.run.enemies) if (!o.dead && Math.abs(o.x - this.x) < 500) o.speed *= 1.08;
        }
        if (this.stateT > 1.3) { this.state = 'chase'; this.stateT = 0; this.screamed = false; }
        break;
      }
      case 'throw': {
        if (this.stateT > 0.6 && !this.thrown) { this.thrown = true; const ang = this.facing > 0 ? -0.75 : Math.PI + 0.75; IF.combat.enemyShot(this.x + this.facing * 20, this.y - 120, ang, Math.min(820, adx * 1.2 + 120), this.dmg * 1.6, 'egrenade'); }
        if (this.stateT > 1.0) { this.state = 'chase'; this.stateT = 0; this.thrown = false; }
        break;
      }
      case 'leap': {
        if (this.y >= IF.GROUND && this.stateT > 0.15) { this.state = 'windup'; this.stateT = this.def.windup * 0.5; IF.fx.dust(this.x, IF.GROUND, 6); }
        break;
      }
    }
  }

  /* ---------------- BOSS AI ---------------- */
  bossUpdate(dt, dx, adx) {
    const pl = this.run.player, B = this.def;
    const phaseIdx = B.phases.reduce((acc, ph, i) => (this.hp / this.maxHp <= ph.at ? i : acc), 0);
    if (phaseIdx !== this.phaseIdx) { if (this.phaseIdx !== undefined) { this.queue = []; this.startBossAttack('roar'); IF.events.emit('bossPhase', phaseIdx); } this.phaseIdx = phaseIdx; }
    if (this.state === 'chase') {
      this.facing = Math.sign(dx) || this.facing;
      const want = adx > 150 ? this.speed * this.facing * (this.enraged ? 1.3 : 1) : 0;
      this.walkV = IF.util.approach(this.walkV || 0, want, 600 * dt); this.x += this.walkV * dt; this.phase += Math.abs(this.walkV) * dt * 0.03;
      if (this.cd <= 0 && !pl.dead) {
        if (!this.queue || !this.queue.length) this.queue = B.phases[this.phaseIdx].attacks.slice();
        let atk = this.queue.shift();
        if ((atk === 'sweep') && adx > 260) atk = this.queue.length ? this.queue.shift() : 'charge';
        this.startBossAttack(atk);
      }
      return;
    }
    const a = this.atk, t = this.stateT;
    switch (a.kind) {
      case 'sweep':
        if (t > a.wind && !a.done) { a.done = true; IF.audio.swing(2.2); this.vx = this.facing * 300; const hdx = (pl.x - this.x) * this.facing; if (hdx > -60 && hdx < 230 * this.scale / 2 + 60 && pl.y > this.y - this.h - 20) pl.takeDamage({ x: this.x, dmg: this.dmg, heavy: true, attacker: this }); IF.fx.addShake(6); }
        if (t > a.wind + 0.6) this.endAttack(0.6);
        break;
      case 'slam':
        if (t > a.wind && !a.done) {
          a.done = true; IF.fx.addShake(18); IF.audio.explosion(1.2); const sx = this.x + this.facing * 90;
          IF.fx.dust(sx, IF.GROUND, 20); IF.fx.ring(sx, IF.GROUND, 120, 'rgba(255,200,120,0.6)');
          if (Math.abs(pl.x - sx) < 130 && pl.y > IF.GROUND - 90) pl.takeDamage({ x: this.x, dmg: this.dmg * 1.4, heavy: true, attacker: this });
          this.run.shockwaves.push({ x: sx, dir: 1, speed: 620, t: 1.4, dmg: this.dmg * 0.6, hit: false }, { x: sx, dir: -1, speed: 620, t: 1.4, dmg: this.dmg * 0.6, hit: false });
          if (B.vulnAfter === 'slam') this.vuln = 2.2;
        }
        if (t > a.wind + (B.vulnAfter === 'slam' ? 2.0 : 0.8)) this.endAttack(0.4);
        break;
      case 'charge':
        if (t > a.wind && !a.go) { a.go = true; a.dir = this.facing; IF.audio.roar(); }
        if (a.go && !a.stop) {
          this.x += a.dir * 760 * dt; if (Math.random() < 0.6) IF.fx.dust(this.x, IF.GROUND, 2);
          if (!a.hit && Math.abs(pl.x - this.x) < this.w / 2 + 20 && pl.y > this.y - this.h) { a.hit = true; pl.takeDamage({ x: this.x - a.dir * 50, dmg: this.dmg * 1.2, heavy: true, attacker: this }); }
          const wall = a.dir > 0 ? this.run.world.rightBound - 80 : this.run.world.leftBound + 80;
          if ((a.dir > 0 && this.x >= wall) || (a.dir < 0 && this.x <= wall) || t > a.wind + 2.5) { a.stop = true; a.stopT = t; this.x = IF.util.clamp(this.x, this.run.world.leftBound + 80, this.run.world.rightBound - 80); IF.fx.addShake(14); IF.audio.explosion(0.7); IF.fx.dust(this.x + a.dir * 60, IF.GROUND - 60, 14); if (B.vulnAfter === 'charge') { this.vuln = 2.4; this.state = 'stagger'; this.stateT = 0; this.staggerT = 2.2; this.atk = null; return; } }
        }
        if (a.stop && t > a.stopT + 0.7) this.endAttack(0.4);
        break;
      case 'leap':
        if (t > a.wind && !a.go) { a.go = true; a.tx = pl.x; this.vy = -1100; a.vx = (a.tx - this.x) / 0.9; IF.audio.roar(); }
        if (a.go && !a.landed) { this.x += a.vx * dt; if (this.vy >= 0 && this.y >= IF.GROUND && t > a.wind + 0.2) { a.landed = true; a.landT = t; IF.fx.addShake(20); IF.audio.explosion(1.3); IF.fx.dust(this.x, IF.GROUND, 24); IF.fx.ring(this.x, IF.GROUND, 170, 'rgba(255,190,120,0.7)'); if (Math.abs(pl.x - this.x) < 175 && pl.y > IF.GROUND - 100) pl.takeDamage({ x: this.x, dmg: this.dmg * 1.5, heavy: true, attacker: this }); if (B.vulnAfter === 'leap') this.vuln = 2.4; } }
        if (a.landed && t > a.landT + (B.vulnAfter === 'leap' ? 2.0 : 0.6)) this.endAttack(0.4);
        break;
      case 'barrage':
        if (t > a.wind) { a.fireT = (a.fireT || 0) - dt; if (a.fireT <= 0 && a.shots < a.total) { a.fireT = 0.11; a.shots++; const my = this.y - this.h * 0.62; IF.combat.enemyShot(this.x + this.facing * 70, my, (this.facing > 0 ? 0 : Math.PI) + (Math.random() - 0.5) * 0.06, 1100, this.dmg * 0.32, 'ebullet'); IF.audio.shot('rifle'); IF.fx.muzzle(this.x + this.facing * 80, my, this.facing > 0 ? 0 : Math.PI); } }
        if (a.shots >= a.total && t > a.wind + a.total * 0.11 + 0.3) { if (B.vulnAfter === 'barrage') { this.vuln = 2; this.state = 'stagger'; this.stateT = 0; this.staggerT = 1.8; this.atk = null; return; } this.endAttack(0.5); }
        break;
      case 'grenade':
        if (t > a.wind && !a.done) { a.done = true; for (let i = 0; i < 3; i++) { const d = Math.max(150, Math.abs(pl.x - this.x)) + (i - 1) * 120; IF.combat.enemyShot(this.x, this.y - this.h * 0.7, this.facing > 0 ? -0.8 : Math.PI + 0.8, Math.min(1000, d * 1.05 + 100), this.dmg * 0.9, 'egrenade'); } }
        if (t > a.wind + 0.8) this.endAttack(0.5);
        break;
      case 'toxic':
        if (t > a.wind && !a.done) { a.done = true; for (let i = 0; i < 4; i++) { const d = Math.abs(pl.x - this.x) + (i - 1.5) * 140; IF.combat.enemyShot(this.x + this.facing * 40, this.y - this.h * 0.75, this.facing > 0 ? -0.7 : Math.PI + 0.7, Math.max(250, Math.min(1000, d * 1.05 + 60)), this.dmg * 0.5, 'spit'); } IF.audio.zombieAttack(); }
        if (t > a.wind + 0.8) this.endAttack(0.5);
        break;
      case 'summon': case 'summon_crawlers':
        if (t > a.wind && !a.done) { a.done = true; IF.audio.scream(); const kind = a.kind === 'summon_crawlers' ? 'crawler' : (B.id === 'commander' || B.id === 'general') ? 'military' : 'walker'; for (let i = 0; i < 3 + this.phaseIdx; i++) this.run.spawnEnemy(kind, this.x + (i % 2 ? 1 : -1) * (150 + i * 70), { rise: true, hpMult: 0.7 }); }
        if (t > a.wind + 1.0) this.endAttack(0.5);
        break;
      case 'roar':
        if (t > a.wind && !a.done) { a.done = true; IF.audio.roar(); IF.fx.ring(this.x, this.y - this.h * 0.6, 420, 'rgba(255,90,60,0.8)', 0.8); IF.fx.addShake(16); this.enraged = this.phaseIdx >= 2; if (Math.abs(pl.x - this.x) < 380) { pl.vx = Math.sign(pl.x - this.x) * 700; pl.vy = -300; } }
        if (t > a.wind + 1.0) this.endAttack(0.3);
        break;
      default: this.endAttack(0.3);
    }
  }
  startBossAttack(kind) {
    const W = { sweep: 0.75, slam: 1.05, charge: 0.85, leap: 0.7, barrage: 0.95, grenade: 0.6, toxic: 0.7, summon: 0.8, summon_crawlers: 0.8, roar: 0.6 };
    const speedUp = this.enraged ? 0.8 : 1;
    this.atk = { kind, wind: W[kind] * speedUp, shots: 0, total: 10 + this.phaseIdx * 4 };
    this.state = 'battack'; this.stateT = 0; this.walkV = 0; this.facing = Math.sign(this.run.player.x - this.x) || this.facing;
  }
  endAttack(cd) { this.state = 'chase'; this.stateT = 0; this.cd = cd * (this.enraged ? 0.6 : 1) + 0.3; this.atk = null; }

  /* ---------------- rendering ---------------- */
  draw(ctx) {
    if (this.dead && this.gibbed) return;
    const S = this.scale, L = this.def.look, fade = this.dead ? Math.max(0, 1 - Math.max(0, this.deadT - 3.5) / 1) : 1;
    if (fade <= 0) return;
    ctx.save(); ctx.translate(this.x, this.y); ctx.globalAlpha = fade;
    ctx.fillStyle = 'rgba(0,0,0,0.32)'; ctx.beginPath(); ctx.ellipse(0, 2, this.w * 0.75, 7, 0, 0, 6.283); ctx.fill();
    if (this.state === 'rise') { const k = Math.min(1, this.stateT / 0.9); ctx.beginPath(); ctx.rect(-200, -400, 400, 400); ctx.clip(); ctx.translate(0, (1 - k) * this.h * S * 0.9); if (Math.random() < 0.3) IF.fx.dust(this.x, IF.GROUND, 1, 'rgba(70,55,45,0.5)'); }
    ctx.scale(this.facing * S, S);
    if (this.dead && this.isLow) { const k = Math.min(1, this.deadT * 3); ctx.translate(0, k * 6); ctx.scale(1, 1 - k * 0.25); }
    else if (this.dead) { const k = IF.util.easeOut(Math.min(1, this.deadT * 2.6)); const fallBack = this.deathDir === this.facing ? -1 : 1; ctx.translate(-fallBack * k * 18, 0); ctx.rotate(-fallBack * k * 1.5); ctx.translate(0, -k * 8); }
    if (this.state === 'stagger') ctx.rotate(-0.15 * Math.sin(this.stateT * 30) * 0.5 - 0.12);
    const body = (c) => { if (this.isLow) this.drawCrawler(c, L); else this.drawZombie(c, L); IF.gore.drawWounds(c, this); };
    if (this.hitFlash > 0) IF.art.tinted(ctx, body, this.boss ? '#ffe6c8' : '#ffffff', this.boss ? 0.28 : 0.55);
    else if (this.boss && this.vuln > 0) IF.art.tinted(ctx, body, '#ffd36b', 0.25 + 0.15 * Math.sin(this.t * 14));
    else body(ctx);
    if (this.gutsOut && this.dead) { ctx.save(); ctx.translate(this.x - this.deathDir * 10, IF.GROUND - 6); ctx.scale(this.deathDir || 1, 1); IF.gore.drawGuts(ctx, 0, 0, 1.2, 0.3); IF.gore.drawGuts(ctx, 10, 4, 0.9, 0.7); ctx.restore(); }
    ctx.restore(); ctx.globalAlpha = 1;
    // telegraph marker
    if (!this.dead && (this.state === 'windup' || (this.state === 'battack' && this.atk && this.stateT < this.atk.wind))) {
      const wind = this.boss ? this.atk.wind : this.def.windup, k = Math.min(1, this.stateT / wind);
      ctx.save(); ctx.globalAlpha = 0.5 + 0.5 * Math.sin(this.t * 30); ctx.fillStyle = this.boss ? '#ff3a2a' : '#ffb03a';
      ctx.font = '900 ' + (this.boss ? 34 : 22) + 'px Cinzel, Georgia, serif'; ctx.textAlign = 'center'; ctx.fillText('!', this.x, this.y - this.h * this.scale - 14 - k * 6); ctx.restore();
      if (this.boss && this.atk) this.drawTelegraph(ctx, this.atk, k);
    }
  }
  drawTelegraph(ctx, a, k) {
    ctx.save(); ctx.globalAlpha = 0.25 + 0.3 * k; ctx.fillStyle = '#ff2a1a';
    const pl = this.run.player;
    if (a.kind === 'sweep') { ctx.beginPath(); ctx.ellipse(this.x + this.facing * 140, IF.GROUND, 170, 18, 0, 0, 6.283); ctx.fill(); }
    if (a.kind === 'slam') { ctx.fillRect(this.x + this.facing * 90 - 130, IF.GROUND - 6, 260, 10); }
    if (a.kind === 'leap') { ctx.beginPath(); ctx.ellipse(pl.x, IF.GROUND, 175, 20, 0, 0, 6.283); ctx.fill(); }
    if (a.kind === 'charge') { ctx.fillRect(Math.min(this.x, this.x + this.facing * 1400), IF.GROUND - 8, 1400, 12); }
    if (a.kind === 'barrage') { ctx.strokeStyle = '#ff2020'; ctx.globalAlpha = 0.8; ctx.lineWidth = 1.5; const y = this.y - this.h * 0.62; ctx.beginPath(); ctx.moveTo(this.x + this.facing * 70, y); ctx.lineTo(this.x + this.facing * 1500, y); ctx.stroke(); }
    ctx.restore();
  }
  _zPose() {
    const L = this.def.look, t = this.t, moving = this.state === 'chase' && Math.abs(this.walkV || 0) > 5;
    const ph = this.phase, P = { hipY: -70, lean: 0.1 + (L.posture || 0), footF: { x: 8, y: 0 }, footB: { x: -8, y: 0 }, handF: { x: 34, y: -88 }, handB: { x: 28, y: -84 }, head: 0, jaw: 0.1 };
    if (moving) { const st = this.id === 'runner' ? 22 : 12; P.footF = { x: Math.sin(ph) * st, y: -Math.max(0, Math.cos(ph)) * 8 }; P.footB = { x: Math.sin(ph + Math.PI) * st, y: -Math.max(0, Math.cos(ph + Math.PI)) * 8 }; P.hipY += Math.abs(Math.sin(ph)) * -2; }
    if (this.limp) P.footB.x -= 6;
    // shambling arms reaching forward
    const sway = Math.sin(t * 2.3 + this.seed) * 6;
    P.handF = { x: 32 + sway, y: -90 + Math.sin(t * 3) * 4 }; P.handB = { x: 26 - sway, y: -84 + Math.cos(t * 2.7) * 4 };
    if (this.id === 'runner' && moving) { P.lean = 0.5; P.handF = { x: 10 + Math.sin(ph) * 22, y: -78 }; P.handB = { x: 6 - Math.sin(ph) * 22, y: -76 }; }
    if (this.def.screamer) { P.handF = { x: 10, y: -64 }; P.handB = { x: 4, y: -62 }; P.lean = 0.05; }
    if (this.state === 'windup') { const k = Math.min(1, this.stateT / this.def.windup); P.lean -= 0.25 * k; P.handF = { x: 8, y: -126 * (1 - 0.1 * k) }; P.handB = { x: 2, y: -122 }; P.jaw = 0.4 * k; }
    if (this.state === 'active') { P.lean += 0.35; P.handF = { x: 52, y: -70 }; P.handB = { x: 46, y: -76 }; P.jaw = 0.5; }
    if (this.state === 'scream') { P.lean = -0.3; P.head = -0.5; P.jaw = 0.9; P.handF = { x: 20, y: -100 }; P.handB = { x: -6, y: -100 }; }
    if (this.state === 'throw') { const k = Math.min(1, this.stateT / 0.6); P.handF = { x: -20 + 50 * k, y: -130 + 30 * k }; }
    if (this.boss && this.atk) this._bossPose(P, this.atk);
    return P;
  }
  _bossPose(P, a) {
    const k = Math.min(1, this.stateT / a.wind), after = this.stateT > a.wind;
    if (a.kind === 'sweep' || a.kind === 'slam') { if (!after) { P.lean = -0.25 * k; P.handF = { x: -10, y: -140 }; P.handB = { x: -16, y: -134 }; P.wAngle = -2.6; } else { P.lean = 0.35; P.handF = { x: 50, y: -50 }; P.handB = { x: 40, y: -56 }; P.wAngle = a.kind === 'slam' ? 1.4 : 0.6; } }
    if (a.kind === 'charge') { P.lean = 0.55; P.handF = { x: 40, y: -80 }; P.wAngle = 0; }
    if (a.kind === 'barrage' || a.kind === 'grenade') { P.handF = { x: 40, y: -92 }; P.handB = { x: 56, y: -88 }; P.wAngle = 0; P.lean = 0.05; }
    if (a.kind === 'roar' || a.kind === 'summon' || a.kind === 'summon_crawlers') { P.lean = -0.3; P.head = -0.4; P.jaw = 1; P.handF = { x: 30, y: -130 }; P.handB = { x: -20, y: -128 }; }
    if (a.kind === 'leap' && !after) { P.hipY = -54; P.lean = 0.3; }
    if (a.kind === 'toxic') { P.jaw = after ? 1 : 0.3; P.head = after ? 0.2 : -0.3; }
  }
  drawZombie(ctx, L) {
    const A = IF.art, P = this._zPose(), D = { thigh: 31, shin: 32, torso: 44, upper: 25, fore: 26 };
    const nx = Math.sin(P.lean), ny = -Math.cos(P.lean), hipX = 0, hipY = P.hipY;
    const shX = hipX + nx * (D.torso - 8), shY = hipY + ny * (D.torso - 8);
    const shF = { x: shX + 4, y: shY }, shB = { x: shX - 5, y: shY - 1 };
    const kF = A.ik(3, hipY, P.footF.x, P.footF.y - 4, D.thigh, D.shin, -1), kB = A.ik(-3, hipY, P.footB.x, P.footB.y - 4, D.thigh, D.shin, -1);
    const eF = A.ik(shF.x, shF.y, P.handF.x, P.handF.y, D.upper, D.fore, 1), eB = A.ik(shB.x, shB.y, P.handB.x, P.handB.y, D.upper, D.fore, 1);
    const skinG = (x1, y1, x2, y2, w) => { const p = { metal: L.skin, dark: L.skinDark, light: A.shade(L.skin, 0.25) }; return A.metalGrad(ctx, x1, y1, x2, y2, w, p); };
    const big = this.boss || this.def.heavy ? 1.25 : 1, gaunt = L.gaunt ? 0.75 : 1;
    const limb = (x1, y1, x2, y2, w, col) => A.seg(ctx, x1, y1, x2, y2, w * big * gaunt, w * 0.85 * big * gaunt, col || skinG(x1, y1, x2, y2, w), 'rgba(0,0,0,0.5)');
    // cape (general / king)
    if (L.cape) { ctx.fillStyle = L.cape; ctx.beginPath(); ctx.moveTo(shB.x - 4, shB.y - 4); ctx.lineTo(shF.x, shF.y); ctx.quadraticCurveTo(-20, -30, -40 + Math.sin(this.t * 3) * 6, -6); ctx.lineTo(-56, -10); ctx.quadraticCurveTo(-40, -60, shB.x - 4, shB.y - 4); ctx.fill(); }
    // back limbs
    const lost = this.lost || {}, stump = (x, y, r) => { ctx.fillStyle = '#6a0a0a'; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill(); ctx.fillStyle = '#e8dcc0'; ctx.beginPath(); ctx.arc(x + 1, y, r * 0.38, 0, 6.283); ctx.fill(); ctx.fillStyle = 'rgba(140,10,10,0.9)'; ctx.fillRect(x - 1.5, y, 3, 6 + Math.sin(this.t * 4) * 2); };
    if (lost.armB) { limb(shB.x, shB.y, shB.x + 4, shB.y + 9, 6.5, A.shade(L.shirt, -0.25)); stump(shB.x + 4, shB.y + 11, 5.5); }
    else { limb(shB.x, shB.y, eB.x, eB.y, 6.5, L.shirt && !L.bare ? A.shade(L.shirt, -0.25) : null); limb(eB.x, eB.y, P.handB.x, P.handB.y, 5.5); this._hand(ctx, P.handB, L, true); }
    limb(-3, hipY, kB.x, kB.y, 8, A.shade(L.pants, -0.25)); limb(kB.x, kB.y, P.footB.x, P.footB.y - 4, 6.5, A.shade(L.pants, -0.3)); this._foot(ctx, P.footB, L, true);
    // torso
    ctx.save(); ctx.translate(hipX, hipY); ctx.rotate(P.lean);
    const tw = (L.bloated ? 24 : L.gaunt ? 13 : 17) * big;
    const tg = ctx.createLinearGradient(-tw, 0, tw, 0); tg.addColorStop(0, A.shade(L.shirt, -0.4)); tg.addColorStop(0.5, L.shirt); tg.addColorStop(1, A.shade(L.shirt, -0.45));
    ctx.fillStyle = tg; ctx.beginPath(); ctx.moveTo(-tw * 0.85, 6); ctx.quadraticCurveTo(-tw * (L.bloated ? 1.3 : 1.05), -D.torso * 0.5, -tw, -D.torso + 4); ctx.lineTo(tw, -D.torso + 4); ctx.quadraticCurveTo(tw * (L.bloated ? 1.5 : 1.05), -D.torso * 0.45, tw * 0.85, 6);
    // ragged hem
    for (let i = 4; i >= -4; i--) ctx.lineTo(i * tw / 4.5, 8 + ((i + this.seed) % 3) * 4); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.stroke();
    // exposed wounds / ribs
    ctx.fillStyle = L.skinDark; ctx.beginPath(); ctx.ellipse(tw * 0.3, -D.torso * 0.45, 5 * big, 8 * big, 0.3, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#5a0f0f'; ctx.beginPath(); ctx.ellipse(tw * 0.3, -D.torso * 0.45, 3 * big, 5 * big, 0.3, 0, 6.283); ctx.fill();
    ctx.fillStyle = 'rgba(60,10,10,0.55)'; ctx.beginPath(); ctx.ellipse(-tw * 0.3, -D.torso * 0.2, 6, 10, 0, 0, 6.283); ctx.fill();
    if (!L.riot && !this.boss && (this.seed % 2 === 0)) { // torn shirt: decayed skin and ribs showing through
      ctx.fillStyle = L.skinDark; ctx.beginPath(); ctx.moveTo(-tw * 0.15, -D.torso * 0.75); ctx.lineTo(tw * 0.55, -D.torso * 0.7); ctx.lineTo(tw * 0.35, -D.torso * 0.25); ctx.lineTo(-tw * 0.05, -D.torso * 0.32); ctx.closePath(); ctx.fill();
      IF.gore.drawRibs(ctx, tw * 0.02, -D.torso * 0.68, 0.75 * big);
    }
    const soak = this.dead ? 0.7 : Math.max(0.12, 1 - this.hp / this.maxHp) * 0.75;
    { const sg = ctx.createLinearGradient(0, -D.torso, 0, 10); sg.addColorStop(0, 'rgba(90,6,6,' + soak + ')'); sg.addColorStop(0.6, 'rgba(70,4,4,' + soak * 0.6 + ')'); sg.addColorStop(1, 'rgba(60,4,4,0)'); ctx.fillStyle = sg; ctx.fillRect(-tw, -D.torso + 4, tw * 2, D.torso + 6); }
    if (L.bloated) { ctx.fillStyle = 'rgba(170,230,60,0.8)'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(((i * 37 + this.seed) % 30) - 15, -((i * 23) % 36) - 4, 3 + (i % 3), 0, 6.283); ctx.fill(); } if (this.swell) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(160,255,60,' + this.swell * 0.5 + ')'; ctx.beginPath(); ctx.arc(0, -D.torso * 0.5, tw * (1 + this.swell * 0.4), 0, 6.283); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; } }
    if (L.riot || L.helmet || this.def.military) { ctx.fillStyle = L.riot ? '#2b2e33' : '#4a5233'; ctx.fillRect(-tw * 0.9, -D.torso + 6, tw * 1.8, D.torso * 0.75); ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.strokeRect(-tw * 0.9, -D.torso + 6, tw * 1.8, D.torso * 0.75); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(-tw * 0.8, -D.torso + 8, tw * 1.6, 3); if (!L.riot) { ctx.fillStyle = '#3a3f28'; for (let i = 0; i < 3; i++) ctx.fillRect(-tw * 0.7 + i * tw * 0.5, -D.torso * 0.35, tw * 0.4, 9); } }
    if (L.medals) { ctx.fillStyle = '#e2b23c'; for (let i = 0; i < 3; i++) ctx.fillRect(-tw * 0.6 + i * 6, -D.torso + 12, 4, 6); ctx.fillStyle = '#a3181e'; ctx.fillRect(-tw * 0.6, -D.torso + 10, 16, 2); }
    if (L.stitches) { ctx.strokeStyle = '#1a1010'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-tw * 0.8, -D.torso * 0.7); ctx.lineTo(tw * 0.7, -D.torso * 0.2); ctx.stroke(); for (let i = 0; i < 7; i++) { const x = -tw * 0.8 + i * tw * 0.25, y = -D.torso * 0.7 + i * D.torso * 0.07; ctx.beginPath(); ctx.moveTo(x - 2, y - 4); ctx.lineTo(x + 2, y + 4); ctx.stroke(); } }
    if (L.tumours) { ctx.fillStyle = A.shade(L.skin, -0.1); ctx.beginPath(); ctx.arc(tw * 0.7, -D.torso + 8, 10 * big, 0, 6.283); ctx.arc(-tw * 0.4, -D.torso * 0.3, 7 * big, 0, 6.283); ctx.fill(); ctx.fillStyle = 'rgba(120,20,60,0.4)'; ctx.beginPath(); ctx.arc(tw * 0.7, -D.torso + 8, 5, 0, 6.283); ctx.fill(); }
    if (L.obsidian) { ctx.fillStyle = '#3a2a55'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-tw + i * tw * 0.6, -D.torso + 6); ctx.lineTo(-tw + i * tw * 0.6 + 6, -D.torso - 14 - (i % 2) * 8); ctx.lineTo(-tw + i * tw * 0.6 + 12, -D.torso + 6); ctx.fill(); } ctx.strokeStyle = '#b77bff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-6, -D.torso + 10); ctx.lineTo(4, -D.torso * 0.5); ctx.lineTo(-3, -6); ctx.stroke(); }
    ctx.restore();
    // front leg
    limb(3, hipY, kF.x, kF.y, 8, L.pants); limb(kF.x, kF.y, P.footF.x, P.footF.y - 4, 6.5, A.shade(L.pants, -0.1));
    if ((this.seed % 3) === 0) { ctx.fillStyle = L.skin; ctx.beginPath(); ctx.ellipse(kF.x, kF.y + 6, 5, 8, 0, 0, 6.283); ctx.fill(); } // torn trousers
    this._foot(ctx, P.footF, L, false);
    // head (or a neck stump)
    const hx = shX + nx * 16 + 4, hy = shY + ny * 16 + 2;
    if (lost.head) { const nk = { x: shX + nx * 6 + 3, y: shY + ny * 6 }; limb(shX + 2, shY, nk.x, nk.y, 5.5); stump(nk.x, nk.y - 2, 6); }
    else this._head(ctx, hx, hy, L, P, big);
    // weapon (bosses)
    if (L.weapon) this._bossWeapon(ctx, L, P);
    // front arm
    if (lost.armF) { limb(shF.x, shF.y, shF.x + 5, shF.y + 9, 7, L.shirt); stump(shF.x + 5, shF.y + 11, 6); }
    else { limb(shF.x, shF.y, eF.x, eF.y, 7, L.shirt && !L.bare ? L.shirt : null); limb(eF.x, eF.y, P.handF.x, P.handF.y, 6); this._hand(ctx, P.handF, L, false); }
    if (L.tumours && this.def.mutant) { ctx.fillStyle = A.shade(L.skin, -0.05); ctx.beginPath(); ctx.arc(eF.x, eF.y, 11, 0, 6.283); ctx.fill(); }
  }
  _hand(ctx, h, L, back) { ctx.fillStyle = back ? L.skinDark : L.skin; ctx.beginPath(); ctx.arc(h.x, h.y, 5.5, 0, 6.283); ctx.fill(); ctx.strokeStyle = back ? '#1d1a14' : '#2a2620'; ctx.lineWidth = 1.5; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(h.x + 3, h.y + i * 3); ctx.lineTo(h.x + 10, h.y + i * 4 + 2); ctx.stroke(); } }
  _foot(ctx, f, L, back) { ctx.fillStyle = back ? '#14120f' : L.military || L.helmet ? '#2a2a22' : '#221d18'; ctx.beginPath(); ctx.moveTo(f.x - 7, f.y - 9); ctx.lineTo(f.x + 6, f.y - 9); ctx.quadraticCurveTo(f.x + 15, f.y - 5, f.x + 14, f.y); ctx.lineTo(f.x - 8, f.y); ctx.closePath(); ctx.fill(); }
  _head(ctx, x, y, L, P, big) {
    const A = IF.art; ctx.save(); ctx.translate(x, y); ctx.rotate((P.head || 0) + Math.sin(this.t * 1.7 + this.seed) * 0.08 + 0.15); ctx.scale(big, big);
    const g = ctx.createRadialGradient(-3, -4, 2, 0, 0, 14); g.addColorStop(0, A.shade(L.skin, 0.15)); g.addColorStop(1, L.skinDark);
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 12, 14, 0, 0, 6.283); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.stroke();
    // decay: mottled patches, veins, sunken eye socket, torn cheek
    ctx.fillStyle = 'rgba(40,30,25,0.35)'; ctx.beginPath(); ctx.ellipse(-5, -6, 4, 3, 0.5, 0, 6.283); ctx.ellipse(-2, 5, 3, 2, 0, 0, 6.283); ctx.fill();
    ctx.strokeStyle = 'rgba(80,40,90,0.45)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-9, -2); ctx.quadraticCurveTo(-4, -8, -1, -11); ctx.moveTo(-8, 3); ctx.lineTo(-3, 0); ctx.stroke();
    ctx.fillStyle = 'rgba(20,10,8,0.55)'; ctx.beginPath(); ctx.ellipse(6, -3, 5, 4.2, 0, 0, 6.283); ctx.fill();
    if (this.seed % 3 === 1) { ctx.fillStyle = '#5a0e0e'; ctx.beginPath(); ctx.ellipse(1, 3, 3, 2.2, 0.3, 0, 6.283); ctx.fill(); ctx.fillStyle = '#d8cfb0'; ctx.fillRect(0, 2, 1.2, 2); ctx.fillRect(2, 2, 1.2, 2); }
    // jaw
    const j = P.jaw || 0.1; ctx.fillStyle = L.skinDark; ctx.beginPath(); ctx.moveTo(-2, 6); ctx.lineTo(12, 5); ctx.lineTo(10, 10 + j * 10); ctx.lineTo(-2, 12 + j * 6); ctx.fill();
    ctx.fillStyle = '#1a0606'; ctx.beginPath(); ctx.moveTo(2, 6); ctx.lineTo(11, 5.5); ctx.lineTo(9, 7 + j * 9); ctx.lineTo(2, 8 + j * 5); ctx.fill();
    ctx.fillStyle = '#d8cfb0'; for (let i = 0; i < 3; i++) ctx.fillRect(4 + i * 2.4, 5.5, 1.4, 2);
    ctx.fillStyle = 'rgba(110,8,8,0.85)'; ctx.fillRect(7, 9 + j * 6, 1.6, 5 + j * 6); ctx.fillRect(3, 10 + j * 4, 1.2, 3); // blood from the mouth
    // eyes
    const eye = L.eyes || (this.boss ? '#ff4a2a' : '#e8e2c0');
    ctx.fillStyle = '#0d0a08'; ctx.beginPath(); ctx.ellipse(6, -3, 3.5, 3, 0, 0, 6.283); ctx.fill();
    ctx.save(); if (L.eyes || this.elite) { ctx.shadowColor = eye; ctx.shadowBlur = 10; } ctx.fillStyle = eye; ctx.beginPath(); ctx.arc(7, -3, 1.6, 0, 6.283); ctx.fill(); ctx.restore();
    // hair / headgear
    if (L.hood) { ctx.fillStyle = L.hoodColor || '#1d1a20'; ctx.beginPath(); ctx.moveTo(-15, 12); ctx.quadraticCurveTo(-18, -20, 2, -18); ctx.quadraticCurveTo(16, -16, 14, -6); ctx.lineTo(10, -8); ctx.quadraticCurveTo(0, -12, -4, 2); ctx.lineTo(-6, 14); ctx.fill(); }
    else if (L.helmet) { ctx.fillStyle = '#3e4a2a'; ctx.beginPath(); ctx.ellipse(0, -6, 15, 11, 0, Math.PI, 0); ctx.lineTo(16, -4); ctx.lineTo(-16, -4); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-16, -6, 32, 3); }
    else if (L.riot) { ctx.fillStyle = '#25282c'; ctx.beginPath(); ctx.ellipse(0, -3, 15, 15, 0, Math.PI * 0.95, Math.PI * 2.15); ctx.fill(); ctx.fillStyle = 'rgba(120,150,170,0.35)'; ctx.fillRect(3, -9, 12, 14); }
    else if (L.gasmask) { ctx.fillStyle = '#2a2a24'; ctx.beginPath(); ctx.ellipse(6, 2, 9, 9, 0, 0, 6.283); ctx.fill(); ctx.fillStyle = '#4a4a40'; ctx.beginPath(); ctx.arc(12, 6, 4.5, 0, 6.283); ctx.fill(); ctx.fillStyle = L.eyes; ctx.fillRect(4, -4, 6, 3); }
    else if (L.hair && L.hair !== '#000') { ctx.fillStyle = L.hair; ctx.beginPath(); ctx.ellipse(-3, -8, 12, 7, -0.2, Math.PI, 0); ctx.fill(); if (L.gaunt) { ctx.fillRect(-14, -8, 5, 26); ctx.fillRect(-10, -8, 4, 22); } }
    if (L.crown) { ctx.fillStyle = '#2a1a3a'; ctx.beginPath(); ctx.moveTo(-12, -10); for (let i = 0; i < 5; i++) { ctx.lineTo(-12 + i * 6, -28 - (i % 2) * 6); ctx.lineTo(-9 + i * 6, -12); } ctx.lineTo(13, -10); ctx.fill(); ctx.save(); ctx.shadowColor = '#b77bff'; ctx.shadowBlur = 10; ctx.fillStyle = '#b77bff'; ctx.beginPath(); ctx.arc(0, -16, 2.5, 0, 6.283); ctx.fill(); ctx.restore(); }
    ctx.restore();
  }
  _bossWeapon(ctx, L, P) {
    const ang = P.wAngle ?? -0.8, A = IF.art; ctx.save(); ctx.translate(P.handF.x, P.handF.y); ctx.rotate(ang); ctx.scale(1.3, 1.3);
    const W = { axe: 'great_axe', sword: 'steel_longsword', greatsword: 'greatsword', rifle: 'k47' }[L.weapon];
    const def = Object.assign({}, IF.WEAPON[W]);
    if (L.weapon === 'greatsword') def.look = { blade: '#2a1f3a', edge: '#b77bff', guard: '#140f1b', glow: '#a36bff' };
    if (L.weapon === 'axe') def.look = { blade: '#4a4642', edge: '#9a8a7a', guard: '#2a1a10' };
    A.drawWeapon(ctx, def, L.weapon === 'greatsword' ? 4 : 0, this.t); ctx.restore();
  }
  drawCrawler(ctx, L) {
    const A = IF.art, t = this.t, ph = this.phase, P = this._zPose();
    const reach = this.state === 'active' ? 18 : this.state === 'windup' ? -6 : 0;
    // body lying along ground
    const sk = { metal: L.skin, dark: L.skinDark, light: A.shade(L.skin, 0.2) };
    A.seg(ctx, -44, -10, -22, -14, 7, 7, A.shade(L.pants, -0.2)); // stump legs
    A.seg(ctx, -24, -14, 14, -20, 15, 13, A.metalGrad(ctx, -24, -14, 14, -20, 15, { metal: L.shirt, dark: A.shade(L.shirt, -0.5), light: A.shade(L.shirt, 0.15) }), 'rgba(0,0,0,0.5)');
    ctx.fillStyle = '#5a0f0f'; ctx.beginPath(); ctx.ellipse(-46, -10, 5, 7, 0, 0, 6.283); ctx.fill();
    // arms dragging forward
    const a1 = Math.sin(ph) * 14, a2 = Math.sin(ph + Math.PI) * 14;
    for (const [a, back] of [[a2, true], [a1, false]]) {
      const ex = 18 + a * 0.5, ey = -30 + Math.abs(a) * 0.3, hx = 38 + a + reach, hy = -4;
      A.seg(ctx, 10, -24, ex, ey, 6, 5.5, back ? L.skinDark : A.metalGrad(ctx, 10, -24, ex, ey, 6, sk), 'rgba(0,0,0,0.5)');
      A.seg(ctx, ex, ey, hx, hy, 5.5, 4.5, back ? L.skinDark : A.metalGrad(ctx, ex, ey, hx, hy, 5, sk), 'rgba(0,0,0,0.5)');
      this._hand(ctx, { x: hx, y: hy }, L, back);
    }
    this._head(ctx, 28 + reach * 0.6, -28, L, Object.assign(P, { head: 0.3, jaw: this.state === 'active' ? 0.8 : 0.3 }), 1);
  }
};

/* Boss factory — bosses reuse the zombie rig at large scale with unique look & AI. */
IF.makeBoss = function (run, def, x, depth) {
  const cycle = Math.floor((depth - 1) / (IF.BOSS_EVERY * IF.BOSSES.length));
  const e = new IF.Enemy(run, Object.assign({ reach: 160, windup: 0.8, active: 0.2, recover: 0.6, cooldown: 1, dmgType: 'smash', heavy: true }, def), x, depth * 0.5, { hpMult: 1 + cycle * 0.8, dmgMult: 1 + cycle * 0.3 });
  e.boss = true; e.armor = def.armor; e.scale = def.scale; e.w = def.w; e.h = def.h * 0.5 * 2 / def.scale * def.scale; e.state = 'chase'; e.cd = 1.5;
  e.h = def.h; e.speed = def.speed; return e;
};
