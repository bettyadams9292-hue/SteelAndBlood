/* The Knight — controller, combat actions and procedural animation.
 * Movement: acceleration/deceleration curves, coyote time, jump buffering, variable jump height.
 * Combat: 3-hit melee combos with input buffering, charged heavy attacks, firearms with
 * recoil/spread/reload/ammo, shield block with perfect-parry window, i-frame dodge roll, specials. */
'use strict';

IF.KNIGHT_SCALE = 1.18;
IF.TWO_HANDED = { greatsword: 1, greataxe: 1, hammer: 1, halberd: 1, spear: 1 };

IF.Player = class Player {
  constructor(run) {
    this.run = run; this.x = 200; this.y = IF.GROUND; this.vx = 0; this.vy = 0; this.facing = 1;
    this.w = 46; this.h = 150; this.onGround = true; this.coyote = 0; this.groundY = IF.GROUND;
    this.state = 'normal'; this.stateT = 0; this.crouch = false; this.blocking = false; this.blockT = 0;
    this.iframes = 0; this.hurtT = 0; this.flashT = 0; this.dead = false; this.deadT = 0;
    this.phase = 0; this.t = 0; this.stepAcc = 0; this.landT = 0;
    this.show = 'melee'; this.showT = 0; this.combo = 0; this.comboT = 0; this.atk = null; this.chargeT = 0;
    this.aimKick = 0; this.aimAng = 0; this.kickBack = 0; this.trail = []; this.abilityCd = 0; this.buffs = {}; this.staminaDelay = 0;
    this.aegisT = 0; this.revived = false; this.dist0 = this.x;
    this.weapons = { melee: null, primary: null, secondary: null }; this.gunSlot = 'primary';
    this.refreshStats(true);
    const d = IF.save.data;
    for (const s of ['melee', 'primary', 'secondary']) { const it = d.weapons.find((w) => w.uid === d.equipped[s]); if (it) this.equipWeapon(s, it); }
    this.gunSlot = this.weapons.primary ? 'primary' : 'secondary';
    this.look = IF.art.knightLook(IF.prog.equippedItems());
  }

  refreshStats(full) {
    const st = IF.prog.computeStats(this.run.boons);
    const m = this.run.mods; this.st = st;
    const oldMax = this.maxHp || st.maxHp;
    this.maxHp = Math.round(st.maxHp); this.maxStamina = 100 + st.stamina;
    if (full) { this.hp = this.maxHp; this.stamina = this.maxStamina; }
    else this.hp = Math.min(this.maxHp, this.hp + Math.max(0, this.maxHp - oldMax));
    for (const s in this.weapons) if (this.weapons[s]) this.weapons[s].ws = IF.loot.weaponStats(this.weapons[s].item, st);
    this.look = IF.art.knightLook(IF.prog.equippedItems());
  }
  equipWeapon(slot, item) {
    const ws = IF.loot.weaponStats(item, this.st);
    const prev = this.weapons[slot];
    this.weapons[slot] = { item, ws, def: ws.def, mag: prev && prev.item.uid === item.uid ? prev.mag : ws.mag || 0, cd: 0, reload: 0, spin: 0, draw: 0 };
    if (slot !== 'melee') { this.gunSlot = slot; this.run.ensureAmmo(ws.def.ammo); }
  }
  get gun() { return this.weapons[this.gunSlot] || this.weapons.primary || this.weapons.secondary; }
  get melee() { return this.weapons.melee; }
  get centerY() { return this.y - (this.crouch ? 50 : 80); }
  hitbox() { const h = this.state === 'dodge' ? 70 : this.crouch ? 92 : this.h; return { x: this.x - this.w / 2, y: this.y - h, w: this.w, h }; }
  buff(name) { return this.buffs[name] > 0; }

  /* ---------------- update ---------------- */
  update(dt) {
    const I = IF.input, st = this.st; this.t += dt; this.stateT += dt;
    for (const b in this.buffs) this.buffs[b] -= dt;
    this.iframes -= dt; this.flashT -= dt; this.abilityCd -= dt; this.aegisT -= dt; this.comboT -= dt; this.landT -= dt;
    this.aimKick *= Math.pow(0.002, dt); this.kickBack *= Math.pow(0.0005, dt); this.showT -= dt;
    if (this.dead) { this.deadT += dt; this.vx *= 0.9; this.applyPhysics(dt); return; }

    // regen & stamina
    if (this.run.mode.regen && st.regen > 0) this.heal(st.regen * dt, true);
    this.staminaDelay -= dt;
    if (this.staminaDelay <= 0 && !this.blocking) this.stamina = Math.min(this.maxStamina, this.stamina + 38 * dt);

    const gun = this.gun; if (gun) this.updateGun(gun, dt);
    this.updateAim();
    if (this.melee) this.melee.cd -= dt;

    switch (this.state) {
      case 'normal': this.updateNormal(dt); break;
      case 'attack': this.updateAttack(dt); break;
      case 'dodge': this.updateDodge(dt); break;
      case 'hurt': this.vx = IF.util.approach(this.vx, 0, 1800 * dt); if (this.stateT > 0.2) this.state = 'normal'; break;
      case 'charge': this.updateCharge(dt); break;
    }
    // special ability (usable from most states)
    if (I.pressed('special') && this.state !== 'dodge') this.useAbility();
    this.applyPhysics(dt);
    // distance tracking for stats
    const prog = this.x - this.dist0; if (prog > 0) { this.run.distance += prog / 50; this.dist0 = this.x; }
  }

  /* Aim solving: mouse pointer, right stick, or (touch) auto-target the nearest zombie.
   * aimAng is relative to the facing direction: 0 = straight ahead, negative = up. */
  aimTarget() {
    const I = IF.input, S = IF.KNIGHT_SCALE, sx = this.x, sy = this.y - (this.crouch ? 62 : 96) * S;
    if (I.mouseAim) {
      if (IF.r3.ok) { const w = IF.r3.screenToLane(I.mouse.x, I.mouse.y, 0.35); return { dx: w.x - sx, dy: w.y - sy, src: 'mouse' }; }
      const Z = IF.ZOOM, wx = I.mouse.x / Z + this.run.camX, wy = (I.mouse.y - IF.GROUND * (1 - Z)) / Z;
      return { dx: wx - sx, dy: wy - sy, src: 'mouse' };
    }
    if (I.padAim) return { dx: I.padAim.x, dy: I.padAim.y, src: 'pad' };
    if (I.lastDevice === 'touch' && this.gun) { // assisted aim for touch screens
      let best = null, bd = 1e9; const range = this.gun.ws.range;
      for (const e of this.run.enemies) { if (e.dead || e.state === 'rise') continue; const d = Math.abs(e.x - this.x); if (d < range && d < bd && Math.sign(e.x - this.x) === this.facing) { bd = d; best = e; } }
      if (best) return { dx: best.x - sx, dy: best.y - best.h * (best.isLow ? 0.4 : 0.6) - sy, src: 'auto' };
    }
    return null;
  }
  updateAim() {
    const tg = this.aimTarget(); this.aimSrc = tg ? tg.src : null;
    const gunUp = this.show === 'gun' && this.gun && (this.state === 'normal' || this.state === 'hurt');
    if (!tg) { this.aimAng = IF.util.approach(this.aimAng, IF.input.down('up') ? -0.45 : 0, 0.2); return; }
    if (gunUp && tg.src !== 'auto' && Math.abs(tg.dx) > 12) this.facing = Math.sign(tg.dx);
    this.aimAng = IF.util.clamp(Math.atan2(tg.dy, Math.max(1, Math.abs(tg.dx))), -1.25, 1.05);
  }

  moveSpeedMult() {
    let m = 1 + this.st.moveSpeed + (this.buff('berserk') ? 0.3 : 0);
    const g = this.gun; if (g && this.show === 'gun' && g.def.moveMult) m *= g.def.moveMult;
    if (g && g.def.cls === 'minigun' && g.spin > 0.3 && IF.input.down('shoot')) m *= 0.55;
    return m;
  }

  updateNormal(dt) {
    if (this.autoWalk) { // gate cinematic: the knight strides through on his own
      this.crouch = this.blocking = false; this.facing = 1; this.show = 'melee';
      this.vx = IF.util.approach(this.vx, 210, 1800 * dt); return;
    }
    const I = IF.input, ax = I.axisX;
    this.crouch = this.onGround && I.down('down');
    this.blocking = I.down('block') && this.onGround;
    if (this.blocking) { if (!this.wasBlocking) { this.blockT = 0; } this.blockT += dt; this.staminaDelay = 0.4; }
    this.wasBlocking = this.blocking;
    const sprint = I.down('sprint') && this.stamina > 5 && !this.crouch && !this.blocking && Math.abs(ax) > 0.1;
    let maxV = (Math.abs(ax) > 0.75 || sprint ? (sprint ? 360 : 265) : 150) * this.moveSpeedMult();
    if (this.crouch) maxV *= 0.32; if (this.blocking) maxV *= 0.38;
    if (sprint) { this.stamina -= 14 * dt; this.staminaDelay = 0.3; }
    const target = Math.abs(ax) > 0.1 ? Math.sign(ax) * maxV * Math.min(1, Math.abs(ax) * 1.3) : 0;
    const acc = this.onGround ? (target === 0 ? 2600 : 2100) : 1300;
    this.vx = IF.util.approach(this.vx, target, acc * dt);
    const pointerAiming = (IF.input.mouseAim || IF.input.padAim) && this.show === 'gun' && this.gun;
    if (pointerAiming) { /* facing follows the aim, legs backpedal */ }
    else if (Math.abs(ax) > 0.1 && !(I.down('shoot') && this.show === 'gun' && this.gun && this.gun.def.auto)) this.facing = Math.sign(ax);
    else if (I.pressed('left') || (ax < -0.1 && I.pressed('shoot'))) this.facing = -1; // fresh tap turns even while firing
    else if (I.pressed('right') || (ax > 0.1 && I.pressed('shoot'))) this.facing = 1;
    else if (IF.input.lastDevice !== 'keyboard' && Math.abs(ax) > 0.85) this.facing = Math.sign(ax); // stick/touch push turns

    // jump with coyote time + buffer
    if (I.buffered('jump', 140) && (this.onGround || this.coyote > 0) && !this.crouch) {
      I.consume('jump'); this.vy = -880; this.onGround = false; this.coyote = 0; IF.audio.jump();
      IF.fx.dust(this.x, this.y, 5);
    } else if (I.buffered('jump', 140) && this.crouch && this.groundY < IF.GROUND) { I.consume('jump'); this.dropThrough = 0.25; this.onGround = false; }
    if (!I.down('jump') && this.vy < -300) this.vy = -300; // variable jump height

    // dodge
    if (I.buffered('dodge', 120) && this.stamina >= 20) { I.consume('dodge'); this.startDodge(); return; }
    // melee
    if (I.buffered('attack', 160) && this.melee && !this.blocking) {
      if (this.melee.cd <= 0) { I.consume('attack'); this.startAttack(false); return; }
    }
    if (I.down('attack') && I.heldFor('attack') > 0.24 && this.melee && this.state === 'normal' && !this.blocking) { I.consume('attack'); this.startAttack(true); return; }
    // firearms
    if (I.pressed('switch')) this.switchGun();
    if (I.pressed('w2') && this.weapons.primary) { this.switchGun('primary'); }
    if (I.pressed('w3') && this.weapons.secondary) { this.switchGun('secondary'); }
    if (I.pressed('w1')) { this.show = 'melee'; this.showT = 3; }
    if (I.pressed('reload')) this.startReload();
    const bow = this.gun && this.gun.def.cls === 'bow';
    if (bow) { if (I.down('shoot')) { this.show = 'gun'; this.showT = 3; if (this.gun.mag <= 0) this.tryFire(); } if (I.released('shoot') && (this.gun.lastDraw || 0) >= 0.35) { this.gun.draw = this.gun.lastDraw; this.tryFire(true); this.gun.lastDraw = 0; } }
    else if ((I.down('shoot') || I.buffered('shoot', 100)) && !this.blocking) this.tryFire();
  }

  switchGun(to) {
    const other = to || (this.gunSlot === 'primary' ? 'secondary' : 'primary');
    if (!this.weapons[other]) return;
    const g = this.gun; if (g) g.reload = 0;
    this.gunSlot = other; this.show = 'gun'; this.showT = 3; IF.audio.reload('', 'start'); IF.events.emit('weaponSwitch');
  }

  /* ---------- melee ---------- */
  startAttack(heavy) {
    const m = this.melee; if (!m) return;
    const tg = (IF.input.mouseAim || IF.input.padAim) && this.aimTarget(); if (tg && Math.abs(tg.dx) > 12) this.facing = Math.sign(tg.dx);
    const two = IF.TWO_HANDED[m.def.cls], ws = m.ws;
    const rate = ws.rate * (this.buff('berserk') ? 1.25 : 1);
    if (!heavy) { this.combo = this.comboT > 0 ? (this.combo % 3) + 1 : 1; } else this.combo = 0;
    const dur = heavy ? 0.9 / Math.max(0.6, rate * 0.6) : 1 / rate * (this.combo === 3 ? 1.35 : 1);
    this.atk = { heavy, step: this.combo, dur, wind: dur * (heavy ? 0.5 : 0.28), act: dur * (heavy ? 0.18 : 0.25), hit: new Set(), two, charging: heavy, airborne: !this.onGround, swung: false, aim: this.meleeAim() };
    this.state = 'attack'; this.stateT = 0; this.show = 'melee'; this.showT = 4; this.trail.length = 0; this.blocking = false; this.crouch = false;
    if (heavy) this.chargeT = 0;
  }
  /* Melee aim relative to facing: pointer/stick if present, otherwise Up/Down keys (or a level swing). */
  meleeAim() {
    const I = IF.input;
    if ((I.mouseAim || I.padAim) && this.aimSrc && this.aimSrc !== 'auto') return IF.util.clamp(this.aimAng, -1.0, 0.95);
    return I.down('up') ? -0.6 : I.down('down') && !this.onGround ? 0.8 : 0;
  }
  updateAttack(dt) {
    const am = this.atk; if (am && am.charging) am.aim = this.meleeAim(); // heavy attacks can be re-aimed while charging
    const a = this.atk, I = IF.input, m = this.melee;
    if (a.charging) { // hold to charge heavy; release (or max) to swing
      this.chargeT += dt; this.vx = IF.util.approach(this.vx, 0, 2000 * dt);
      if (!I.down('attack') || this.chargeT > 0.85) { a.charging = false; this.stateT = a.wind * 0.6; }
      else { this.stateT = 0; if (Math.random() < 0.3) IF.fx.sparks(this.x - this.facing * 20, this.y - 120, -this.facing, 1, '#ffb05a'); return; }
    }
    const t = this.stateT;
    // forward lunge on swing start
    if (t < a.wind) this.vx = IF.util.approach(this.vx, 0, 1600 * dt);
    else if (!a.swung) { a.swung = true; this.vx = this.facing * (a.heavy ? 260 : a.step === 3 ? 220 : 140) * (m.def.thrust ? 1.4 : 1); IF.audio.swing(a.two ? 1.6 : 1); }
    else this.vx = IF.util.approach(this.vx, 0, 900 * dt);
    if (t >= a.wind && t <= a.wind + a.act) this.meleeHitCheck(a);
    if (t >= a.wind && t <= a.wind + a.act + 0.05) this.recordTrail(); else if (this.trail.length) this.trail.shift();
    // cancel windows: combo chain or dodge in recovery
    if (t > a.wind + a.act) {
      if (I.buffered('dodge', 140) && this.stamina >= 20) { I.consume('dodge'); this.state = 'normal'; this.startDodge(); return; }
      if (!a.heavy && I.buffered('attack', 220) && t > a.wind + a.act + 0.03) { I.consume('attack'); this.comboT = 0.4; this.state = 'normal'; this.startAttack(false); return; }
    }
    if (t >= a.dur) { this.state = 'normal'; this.comboT = a.step === 3 ? 0 : 0.35; this.melee.cd = a.step === 3 || a.heavy ? 0.12 : 0; this.trail.length = 0; }
  }
  meleeHitCheck(a) {
    const m = this.melee, ws = m.ws, reach = ws.range * (a.heavy ? 1.15 : 1) * (a.step === 3 ? 1.1 : 1) * ws.cleave;
    // the strike zone follows the aim: a box centred along the aim line from the shoulder
    const aim = a.aim || 0, S = IF.KNIGHT_SCALE, shY = this.y - 100 * S;
    let box;
    if (Math.abs(aim) < 0.2) box = { x: this.facing > 0 ? this.x - 20 : this.x - reach, y: this.y - 175, w: reach + 20, h: 178 };
    else {
      const fx = Math.max(0.45, Math.cos(aim)) * reach, cy = shY + Math.sin(aim) * reach * 0.62, hh = 150 + Math.abs(Math.sin(aim)) * 40;
      box = { x: this.facing > 0 ? this.x - 20 : this.x - fx, y: cy - hh / 2, w: fx + 20, h: hh };
      if (box.y + box.h > this.y + 6) box.h = this.y + 6 - box.y; // never below the ground
    }
    this.lastStrike = box;
    let mult = a.heavy ? 2.2 * (1 + this.st.heavyDmg) * (0.8 + Math.min(1, this.chargeT / 0.85) * 0.4) : a.step === 3 ? 1.5 * (1 + this.st.comboDmg) : a.step === 2 ? 1.1 : 1;
    mult *= this.run.mods.meleeMult || 1;
    let hits = 0; const maxHits = m.def.thrust ? 6 : a.heavy || a.two ? 8 : a.step === 3 ? 5 : 3 + (ws.cleave > 1 ? 2 : 0);
    for (const e of this.run.enemies) {
      if (e.dead || a.hit.has(e) || hits >= maxHits) continue;
      if (!IF.util.rectsOverlap(box, e.hitbox())) continue;
      a.hit.add(e); hits++;
      const hb = e.hitbox(), headY = hb.y + hb.h * 0.2, head = !e.isLow && aim < -0.3 && box.y < headY;
      IF.combat.hitEnemy(e, { ws, mult, melee: true, heavy: a.heavy || a.step === 3, dir: this.facing, x: e.x, y: head ? hb.y + hb.h * 0.12 : e.y - e.h * 0.6, head, stagger: a.heavy && this.st.stagger ? 2 : a.heavy ? 1.2 : 0.6 });
    }
    // destructible props
    for (const p of this.run.world.props) if (p.hp > 0 && !a.hit.has(p) && IF.util.rectsOverlap(box, p)) { a.hit.add(p); IF.world.damageProp(this.run, p, ws.dmg * mult); }
    if (hits) { IF.fx.hitstop = Math.max(IF.fx.hitstop, a.heavy ? 0.085 : 0.045); IF.fx.addShake(a.heavy ? 9 : a.step === 3 ? 6 : 3); }
  }
  recordTrail() {
    const p = this.pose(); const tip = this._bladeTip(p);
    this.trail.push({ x: this.x + tip.x * this.facing * IF.KNIGHT_SCALE, y: this.y + tip.y * IF.KNIGHT_SCALE, hx: this.x + p.handF.x * this.facing * IF.KNIGHT_SCALE, hy: this.y + p.handF.y * IF.KNIGHT_SCALE });
    if (this.trail.length > 7) this.trail.shift();
  }
  _bladeTip(p) { const L = (this.melee ? this.melee.def.len : 80) + 6; return { x: p.handF.x + Math.cos(p.wAngle) * L, y: p.handF.y + Math.sin(p.wAngle) * L }; }

  /* ---------- firearms ---------- */
  updateGun(g, dt) {
    g.cd -= dt;
    if (g.def.cls === 'minigun') g.spin = IF.input.down('shoot') && this.state === 'normal' ? Math.min(1, g.spin + dt / g.def.spinUp) : Math.max(0, g.spin - dt * 1.5);
    if (g.def.cls === 'bow') { if (g.draw > 0) g.lastDraw = g.draw; g.draw = IF.input.down('shoot') && g.mag > 0 && g.reload <= 0 && this.state === 'normal' ? Math.min(1, g.draw + dt * 3.2) : 0; }
    if (g.reload > 0) {
      g.reload -= dt;
      if (g.reload <= 0) {
        const res = this.run.ammo[g.def.ammo] || 0, need = g.ws.mag - g.mag, take = Math.min(need, res);
        g.mag += take; this.run.ammo[g.def.ammo] = res - take; IF.audio.reload(g.def.cls, 'end');
      }
    }
  }
  startReload() {
    const g = this.gun; if (!g || g.reload > 0 || g.mag >= g.ws.mag) return;
    if ((this.run.ammo[g.def.ammo] || 0) <= 0) { IF.audio.empty(); IF.events.emit('toast', { text: 'Out of ' + IF.AMMO[g.def.ammo].name + '!', bad: true }); return; }
    g.reload = g.ws.reload * (this.buff('berserk') ? 0.8 : 1); IF.audio.reload(g.def.cls, 'start'); this.show = 'gun'; this.showT = 3;
  }
  tryFire(release) {
    const g = this.gun; if (!g) return;
    this.show = 'gun'; this.showT = 3;
    if (g.reload > 0) return;
    if (g.mag <= 0) { if (IF.input.pressed('shoot')) { this.startReload(); if (g.reload <= 0) IF.audio.empty(); } return; }
    if (g.cd > 0) return;
    if (!g.def.auto && !release && !IF.input.pressed('shoot') && !IF.input.buffered('shoot', 90)) return;
    if (g.def.cls === 'minigun' && g.spin < 1) return;
    if (g.def.cls === 'bow' && !release) return;
    IF.input.consume('shoot');
    const ws = g.ws; g.cd = 1 / (ws.rate * (this.buff('berserk') ? 1.2 : 1)); g.mag--; if (g.mag === 0 && g.def.ping) IF.audio.ping && IF.audio.ping(); if (g.def.bolt) IF.audio.bolt && setTimeout(() => IF.audio.bolt(), 380);
    const pose = this.pose(); const grip = IF.art.GRIP[g.def.cls] || IF.art.GRIP.rifle;
    const ang = pose.wAngle, S = IF.KNIGHT_SCALE;
    const mx = pose.handF.x + Math.cos(ang) * grip.muzzle[0] - Math.sin(ang) * grip.muzzle[1];
    const my = pose.handF.y + Math.sin(ang) * grip.muzzle[0] + Math.cos(ang) * grip.muzzle[1];
    const wx = this.x + mx * this.facing * S, wy = this.y + my * S;
    const dirAng = this.facing > 0 ? ang : Math.PI - ang;
    IF.combat.fire(this, g, wx, wy, dirAng);
    // feedback
    const big = ['shotgun', 'pump', 'dbshotgun', 'sniper', 'rl', 'handcannon'].includes(g.def.cls);
    if (!['bow', 'crossbow'].includes(g.def.cls)) { IF.fx.muzzle(wx, wy, dirAng, big); if (!['gl', 'rl'].includes(g.def.cls)) IF.fx.shell(this.x + 10 * this.facing, wy + 6, this.facing, g.def.ammo === 'shell'); }
    IF.audio.shot(g.def.cls);
    this.aimKick = Math.min(0.5, this.aimKick + ws.recoil * 0.012); this.kickBack = Math.min(14, this.kickBack + ws.recoil * 0.8);
    if (ws.recoil > 8 && this.onGround) this.vx -= this.facing * ws.recoil * 9;
    IF.fx.addShake(Math.min(10, ws.recoil * 0.35));
    IF.save.data.stats.shots++;
    if (g.mag <= 0 && (this.run.ammo[g.def.ammo] || 0) > 0) setTimeout(() => this.startReload(), 120);
    g.draw = 0;
  }

  /* ---------- defence ---------- */
  startDodge() {
    const ax = IF.input.axisX; if (Math.abs(ax) > 0.2) this.facing = Math.sign(ax);
    this.state = 'dodge'; this.stateT = 0; this.stamina -= 22 * (1 - this.st.dodgeIframe * 0.3); this.staminaDelay = 0.5;
    this.iframes = 0.32 * (1 + this.st.dodgeIframe); this.vx = this.facing * 620 * (1 + this.st.moveSpeed * 0.5); this.blocking = false; this.crouch = false;
    IF.audio.dodge(); IF.fx.dust(this.x, this.y, 6);
  }
  updateDodge(dt) { this.vx = IF.util.approach(this.vx, 0, 900 * dt); if (this.stateT > 0.42) { this.state = 'normal'; } }

  /* Returns damage actually taken. src: {x, dmg, type, heavy, attacker, unblockable} */
  takeDamage(src) {
    if (this.dead || this.iframes > 0 || this.state === 'charge') return 0;
    let dmg = src.dmg * (this.run.mods.playerTaken || 1);
    const fromFront = Math.sign(src.x - this.x) === this.facing || Math.abs(src.x - this.x) < 8;
    if (this.blocking && fromFront && !src.unblockable && this.stamina > 0) {
      const perfect = this.blockT < 0.2;
      if (perfect) { // parry
        IF.audio.hit('block'); IF.fx.sparks(this.x + this.facing * 30, this.y - 90, this.facing, 14, '#fff2b0'); IF.fx.text(this.x + this.facing * 30, this.y - 160, 'PARRY!', '#ffe08a', 24, true);
        if (src.attacker && src.attacker.stagger) src.attacker.stagger(1.4, this.facing);
        IF.fx.hitstop = 0.08; this.stamina = Math.min(this.maxStamina, this.stamina + 10); return 0;
      }
      const eff = Math.min(0.92, (this.look.shield ? 0.7 : 0.4) + this.st.blockEff);
      const blocked = dmg * eff; dmg -= blocked; this.stamina -= blocked * 1.1; this.staminaDelay = 0.6;
      IF.audio.hit('block'); IF.fx.sparks(this.x + this.facing * 26, this.y - 90, this.facing, 6);
      this.vx = -this.facing * (src.heavy ? 380 : 160);
      if (this.stamina <= 0) { this.stamina = 0; this.blocking = false; this.state = 'hurt'; this.stateT = 0; IF.fx.text(this.x, this.y - 170, 'GUARD BROKEN', '#ff7a5a', 20); }
    }
    if (this.st.aegis && this.aegisT <= 0 && dmg > 0) { this.aegisT = this.st.aegis; IF.fx.ring(this.x, this.y - 80, 70, '#f0c64a'); IF.fx.text(this.x, this.y - 170, 'AEGIS', '#f0c64a', 20); return 0; }
    const res = src.type === 'blast' ? this.st.resBlast : src.type === 'toxic' ? this.st.resToxic : 0;
    dmg *= (1 - this.st.totalDR) * (1 - Math.min(0.75, res));
    dmg = Math.max(1, Math.round(dmg));
    this.hp -= dmg; this.iframes = 0.45; this.flashT = 0.15;
    IF.audio.hurt(); IF.fx.blood(this.x, this.y - 90, Math.sign(this.x - src.x) || 1, 8); IF.fx.addShake(src.heavy ? 14 : 6);
    IF.fx.text(this.x, this.y - 165, '-' + dmg, '#ff5a4a', 20); IF.fx.vignettePulse = 1;
    if (!this.blocking || src.heavy) { this.vx = Math.sign(this.x - src.x || -this.facing) * (src.heavy ? 520 : 220); if (src.heavy) this.vy = -280; if (this.state !== 'dodge') { this.state = 'hurt'; this.stateT = 0; } }
    if (this.hp <= 0) this.die();
    return dmg;
  }
  heal(n, quiet) { const before = this.hp; this.hp = Math.min(this.maxHp, this.hp + n); if (!quiet && this.hp - before >= 1) IF.fx.text(this.x, this.y - 170, '+' + Math.round(this.hp - before), '#6aff8a', 18); }
  die() {
    if (this.st.revive && !this.revived) {
      this.revived = true; this.hp = this.maxHp * 0.5; this.iframes = 2.5; IF.fx.ring(this.x, this.y - 80, 220, '#ffd66b', 0.8); IF.fx.text(this.x, this.y - 190, 'ASCENSION', '#ffd66b', 30, true);
      for (const e of this.run.enemies) if (Math.abs(e.x - this.x) < 300) IF.combat.knockback(e, Math.sign(e.x - this.x) * 800, 1.5); IF.audio.ability('nova'); return;
    }
    this.hp = 0; this.dead = true; this.deadT = 0; this.state = 'dead'; IF.audio.roar(); IF.fx.addShake(16);
  }

  /* ---------- specials ---------- */
  useAbility() {
    const ab = IF.save.data.ability; if (!ab) { IF.events.emit('toast', { text: 'No special ability — learn one in the Valour skill tree' }); return; }
    if (this.abilityCd > 0) { IF.audio.ui('error'); return; }
    const def = IF.ABILITIES[ab], pow = 1 + this.st.abilityPow;
    this.abilityCd = def.cd * Math.max(0.3, 1 - this.st.abilityCd);
    IF.audio.ability(ab); IF.events.emit('ability', ab);
    if (ab === 'berserk') { this.buffs.berserk = 8 * pow; IF.fx.ring(this.x, this.y - 80, 120, '#ff3d3d'); IF.fx.text(this.x, this.y - 190, 'BERSERK', '#ff3d3d', 30, true); }
    else if (ab === 'warcry') {
      this.heal(this.maxHp * 0.35 * pow); IF.fx.ring(this.x, this.y - 80, 260, '#6aff8a', 0.6);
      for (const e of this.run.enemies) if (!e.dead && Math.abs(e.x - this.x) < 280) { IF.combat.knockback(e, Math.sign(e.x - this.x) * 700, 1.6); }
    } else if (ab === 'nova') {
      IF.combat.explode(this.x, this.y - 70, 240, (90 + IF.save.data.level * 7) * pow, 'player', { burn: true, holy: true, noSelf: true });
      IF.fx.ring(this.x, this.y - 70, 260, '#ffd36b', 0.7);
    } else if (ab === 'charge') { this.state = 'charge'; this.stateT = 0; this.chargeHit = new Set(); this.iframes = 0.6; }
  }
  updateCharge(dt) {
    this.vx = this.facing * 980; const pow = 1 + this.st.abilityPow;
    if (Math.random() < 0.6) IF.fx.dust(this.x - this.facing * 20, this.y, 2);
    for (const e of this.run.enemies) {
      if (e.dead || this.chargeHit.has(e) || !IF.util.rectsOverlap(this.hitbox(), e.hitbox())) continue;
      this.chargeHit.add(e);
      IF.combat.hitEnemy(e, { ws: this.melee.ws, mult: 2.2 * pow, melee: true, heavy: true, dir: this.facing, x: e.x, y: e.y - e.h / 2, stagger: 2, knockOverride: 900 });
    }
    if (this.stateT > 0.5) { this.state = 'normal'; this.vx *= 0.3; }
  }

  /* ---------- physics ---------- */
  applyPhysics(dt) {
    const wasGround = this.onGround;
    this.vy = Math.min(1500, this.vy + 2500 * dt);
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.dropThrough = (this.dropThrough || 0) - dt;
    // world bounds: cannot walk back beyond the section start or past the locked gate
    const minX = this.run.world.leftBound + 30, maxX = (this.run.world.gateOpen ? this.run.world.rightBound : Math.min(this.run.world.rightBound, this.run.world.gateX)) - 30;
    if (this.x < minX) { this.x = minX; this.vx = Math.max(0, this.vx); }
    if (this.x > maxX) { this.x = maxX; this.vx = Math.min(0, this.vx); }
    // ground + one-way platforms
    let floor = IF.GROUND;
    if (this.dropThrough <= 0) for (const p of this.run.world.platforms) {
      if (this.x > p.x + 4 && this.x < p.x + p.w - 4 && this.y - this.vy * dt <= p.y + 2 && this.y >= p.y - 1 && this.vy >= 0) floor = Math.min(floor, p.y);
    }
    if (this.y >= floor) {
      if (!wasGround && this.vy > 600) { IF.audio.land(); IF.fx.dust(this.x, floor, 6); this.landT = 0.12; }
      this.y = floor; this.vy = 0; this.onGround = true; this.coyote = 0.1; this.groundY = floor;
    } else {
      // still supported by a platform?
      this.onGround = false; this.coyote -= dt;
    }
    if (this.onGround && this.groundY < IF.GROUND) { // walked off platform edge
      const on = this.run.world.platforms.some((p) => Math.abs(p.y - this.y) < 2 && this.x > p.x && this.x < p.x + p.w);
      if (!on && this.y < IF.GROUND) { this.onGround = false; this.groundY = IF.GROUND; }
    }
    // footsteps & walk phase
    { const acc = (this.vx - (this._pvx || 0)) / Math.max(dt, 1e-3) * this.facing; this._pvx = this.vx; this.accLean = IF.util.approach(this.accLean || 0, IF.util.clamp(acc * 0.00011, -0.16, 0.16), dt * 1.2); } // lean into starts, sit back into stops
    if (this.onGround && Math.abs(this.vx) > 20) {
      { const sp = Math.abs(this.vx), stride = 14 + 12 * Math.min(1, sp / 260); this.phase += sp * dt * Math.PI / (2 * stride * IF.KNIGHT_SCALE); } // feet plant: stride cycle matched to ground speed
      this.stepAcc += Math.abs(this.vx) * dt; if (this.stepAcc > 78) { this.stepAcc = 0; IF.audio.step(this.look.tier); if (Math.abs(this.vx) > 300) IF.fx.dust(this.x, this.y, 1); }
    }
  }

  /* ---------------- animation ----------------
   * Produces IK targets for the knight rig from the current state. */
  pose() {
    const t = this.t, P = { hipX: 0, hipY: -70, lean: 0.06, footF: { x: 9, y: 0 }, footB: { x: -9, y: 0 }, handF: { x: 18, y: -60 }, handB: { x: -6, y: -52 }, shieldMode: 'back', capeWave: 0, tabardSway: 0, headTilt: 0, wAngle: -1.1, elbowF: 1, elbowB: 1 };
    const speed = Math.abs(this.vx), running = this.onGround && speed > 30;
    const showGun = this.show === 'gun' && this.gun && this.state !== 'attack' && this.state !== 'charge';
    const m = this.melee, two = m && IF.TWO_HANDED[m.def.cls];
    // ---- legs ----
    if (!this.onGround && this.state !== 'dodge') {
      const up = this.vy < 0; P.hipY = -74; P.footF = { x: 14, y: up ? -26 : -14 }; P.footB = { x: -10, y: up ? -10 : -4 }; P.capeWave = up ? -0.6 : 0.6; P.lean = 0.12;
    } else if (running) {
      const ph = this.phase, k = Math.min(1, speed / 260), stride = 14 + 12 * k;
      P.footF = { x: Math.sin(ph) * stride, y: -Math.max(0, Math.cos(ph)) * (6 + 10 * k) };
      P.footB = { x: Math.sin(ph + Math.PI) * stride, y: -Math.max(0, Math.cos(ph + Math.PI)) * (6 + 10 * k) };
      P.hipY = -70 - Math.abs(Math.sin(ph)) * 3 * k + 2 * k; P.lean = 0.06 + 0.14 * k * Math.sign(this.vx) * this.facing;
      P.capeWave = 0.3 + 0.4 * k + Math.sin(ph * 2) * 0.1; P.tabardSway = Math.sin(ph) * 0.7;
    } else {
      P.hipY = -70 + Math.sin(t * 2.2) * 0.8; P.capeWave = Math.sin(t * 1.4) * 0.12; P.tabardSway = Math.sin(t * 1.3) * 0.15;
    }
    if (this.landT > 0) P.hipY += 8;
    if (this.onGround && this.state === 'normal') { P.lean += this.accLean || 0; if ((this.accLean || 0) < -0.06 && Math.abs(this.vx) < 120) { P.footF = { x: P.footF.x + 8, y: 0 }; P.hipY += 3; } } // braking: front foot plants, knees give
    if (this.crouch) { P.hipY = -44; P.footF = { x: 18, y: 0 }; P.footB = { x: -16, y: 0 }; P.lean = 0.28; P.tabardSway = 0.4; }
    // ---- upper body ----
    if (this.state === 'attack') this._attackPose(P);
    else if (this.state === 'charge') { P.lean = 0.45; P.handF = { x: 30, y: -66 }; P.wAngle = -0.15; P.shieldMode = this.look.shield ? 'front' : 'back'; P.handB = { x: 26, y: -78 }; P.capeWave = 1; }
    else if (showGun) this._gunPose(P);
    else {
      // idle/run melee carry
      const sw = running ? Math.sin(this.phase) * 6 : Math.sin(t * 2.2) * 1.2;
      if (two) { P.handF = { x: 18, y: -62 + sw * 0.3 }; P.wAngle = -1.25; P.twoHand = true; }
      else { P.handF = { x: 16 + sw, y: -58 }; P.wAngle = -1.05; P.handB = { x: -8 - sw, y: -50 }; }
    }
    if (this.blocking && this.state === 'normal') { P.shieldMode = this.look.shield ? 'front' : 'back'; P.handB = { x: 24, y: -82 }; P.lean = 0.15; if (!showGun) { P.handF = { x: 10, y: -60 }; P.wAngle = -1.4; } }
    if (P.twoHand) { const a = P.wAngle; P.handB = { x: P.handF.x - Math.cos(a) * 13, y: P.handF.y - Math.sin(a) * 13 }; }
    if (this.state === 'hurt') { P.lean = -0.25; P.headTilt = -0.25; }
    // weapon draw closure
    const S = this; const wi = showGun ? this.gun : m;
    if (wi) {
      const ri = IF.RARITY[wi.item.rarity].index, def = wi.def;
      const extra = { draw: wi.draw, loaded: wi.mag > 0 && wi.reload <= 0, spin: wi.spin ? this.t * wi.spin * 3 : 0 };
      P.weaponBehind = !showGun && this.state !== 'attack' && !two;
      P._weapon = wi;
      P.drawWeapon = (ctx) => { ctx.save(); ctx.translate(P.handF.x, P.handF.y); ctx.rotate(P.wAngle); IF.art.drawWeapon(ctx, def, ri, S.t, extra); ctx.restore(); };
    }
    return P;
  }
  _gunPose(P) {
    const g = this.gun, cls = g.def.cls, grip = IF.art.GRIP[cls] || IF.art.GRIP.rifle;
    let a = this.aimAng - this.aimKick, hx = 22 - this.kickBack * 0.6, hy = this.crouch ? -60 : -86;
    // pull the arms in a little when aiming steeply so the rig stays natural
    hx -= Math.abs(this.aimAng) * 8; hy += this.aimAng * 10;
    if (cls === 'pistol' || cls === 'revolver' || cls === 'handcannon') { hx = 34 - this.kickBack; }
    if (cls === 'rl') { hy -= 18; hx = 6; }
    if (cls === 'minigun') { hy += 18; hx = 16; }
    if (cls === 'bow') { hx = 30; a = this.aimAng; }
    if (g.reload > 0) { const k = Math.sin(Math.min(1, 1 - g.reload / g.ws.reload) * Math.PI); a += 0.55 * k; hy += 8 * k; }
    if (this.crouch) a -= 0; // crouched shots stay level (low line of fire)
    P.handF = { x: hx, y: hy }; P.wAngle = a; P.elbowF = 1;
    const off = cls === 'bow' ? [-10 - 14 * (g.draw || 0), 0] : grip.off;
    if (g.reload > 0 && cls !== 'bow') { const k = Math.sin(Math.min(1, 1 - g.reload / g.ws.reload) * Math.PI * 2); P.handB = { x: hx + 8, y: hy + 14 + k * 8 }; }
    else P.handB = { x: hx + Math.cos(a) * off[0] - Math.sin(a) * off[1], y: hy + Math.sin(a) * off[0] + Math.cos(a) * off[1] };
    if (cls === 'pistol' || cls === 'revolver' || cls === 'handcannon') P.handB = { x: hx - 4, y: hy + 6 };
    P.lean = (this.crouch ? 0.22 : 0.04) - this.kickBack * 0.008 + this.aimAng * 0.12; P.headTilt = this.aimAng * 0.45;
    if (Math.sign(this.vx) === -this.facing && Math.abs(this.vx) > 30) P.lean -= 0.12; // backpedalling
  }
  _attackPose(P) {
    const a = this.atk, m = this.melee, t = this.stateT, two = a.two, thrust = m.def.thrust;
    const p1 = a.charging ? 0 : IF.util.clamp(t / a.wind, 0, 1), p2 = IF.util.clamp((t - a.wind) / a.act, 0, 1), p3 = IF.util.clamp((t - a.wind - a.act) / (a.dur - a.wind - a.act), 0, 1);
    let from, to, rest = -1.1;
    if (thrust) { // spear: pull back then thrust straight
      const ext = a.charging ? -12 : t < a.wind ? -12 * IF.util.easeOut(p1) : t < a.wind + a.act ? -12 + 56 * IF.util.easeOut(p2) : 44 - 40 * p3;
      const aim = a.aim || 0, ca = Math.cos(aim), sa = Math.sin(aim);
      P.handF = { x: 6 + (8 + ext) * ca, y: -78 + (8 + ext) * sa + 6 }; P.wAngle = aim - 0.05; P.twoHand = true; P.lean = 0.1 + ext * 0.004 + aim * 0.2;
      if (a.heavy && a.charging) { P.lean = -0.1; P.handF.x = 0; }
      return;
    }
    if (a.heavy) { from = -2.9; to = 1.2; }
    else if (a.step === 1) { from = -2.4; to = 0.9; }
    else if (a.step === 2) { from = 1.0; to = -1.9; }
    else { from = -3.1; to = 1.35; }
    let ang;
    if (a.charging || t < a.wind) ang = IF.util.lerp(rest, from, IF.util.easeOut(a.charging ? Math.min(1, this.chargeT * 4) : p1));
    else if (t < a.wind + a.act) ang = IF.util.lerp(from, to, IF.util.easeInOut(p2));
    else ang = IF.util.lerp(to, rest, IF.util.easeInOut(p3));
    // hand on an arc in front of the shoulder
    ang += (a.aim || 0) * 0.8; // rotate the whole swing arc toward the aim
    const sx = 4, sy = -104, r = two ? 30 : 34;
    const ha = ang * 0.85 + 0.5;
    P.handF = { x: sx + Math.cos(ha) * r + 6, y: sy + Math.sin(ha) * r + 28 };
    P.wAngle = ang; P.twoHand = two;
    if (!two) P.handB = { x: -10, y: -56 + (a.step === 2 ? -6 : 0) };
    const swingPhase = t < a.wind ? -1 : t < a.wind + a.act ? 1 : 0.4;
    P.lean = (a.heavy ? 0.2 : 0.1) * swingPhase + (a.charging ? -0.18 : 0) + (a.aim || 0) * 0.22; P.headTilt = (a.aim || 0) * 0.4;
    if ((a.aim || 0) > 0.45) { P.hipY += 10 * Math.min(1, a.aim); P.footF.x += 6; P.footB.x -= 6; } // crouch into low sweeps
    if (a.heavy && t > a.wind && t < a.wind + a.act + 0.1) { P.hipY = -60; P.footF.x = 22; P.footB.x = -20; }
    P.tabardSway = swingPhase * 0.6; P.capeWave = swingPhase * 0.4;
  }

  draw(ctx) {
    const S = IF.KNIGHT_SCALE, P = this.pose();
    ctx.save(); ctx.translate(this.x, this.y);
    // ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, (this.groundY - this.y) + 2, 34, 7, 0, 0, 6.283); ctx.fill();
    ctx.scale(this.facing * S, S);
    if (this.dead) { const k = Math.min(1, this.deadT * 2.2); ctx.rotate(-k * 1.45); ctx.translate(-k * 10, 0); }
    if (this.state === 'dodge') { const k = Math.min(1, this.stateT / 0.42); ctx.translate(0, -38); ctx.rotate(k * Math.PI * 2); ctx.translate(0, 38); ctx.scale(0.86, 0.86); P.hipY = -56; P.footF = { x: 12, y: -22 }; P.footB = { x: -4, y: -14 }; P.handF = { x: 18, y: -70 }; P.handB = { x: 4, y: -60 }; P.wAngle = -0.3; }
    if (this.iframes > 0 && !this.dead && this.state !== 'dodge' && Math.floor(this.t * 24) % 2) ctx.globalAlpha = 0.55;
    const body = (c) => IF.art.drawKnight(c, P, this.look, this.t);
    if (this.flashT > 0) IF.art.tinted(ctx, body, '#ff2a1a', 0.5);
    else if (this.buff('berserk')) IF.art.tinted(ctx, body, '#ff1a10', 0.18 + 0.1 * Math.sin(this.t * 10));
    else body(ctx);
    if (this.state === 'attack' && this.atk.charging) { const k = Math.min(1, this.chargeT / 0.85); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25 * k; ctx.fillStyle = '#ffb04a'; ctx.beginPath(); ctx.arc(0, -80, 60 + 20 * k, 0, 6.283); ctx.fill(); }
    ctx.restore(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  /* weapon trail: a fading ribbon between hand and blade tip over recent frames */
  drawTrail(ctx) {
    const tr = this.trail; if (tr.length < 2 || !this.melee) return;
    const ri = IF.RARITY[this.melee.item.rarity].index, col = this.melee.def.look.glow || (ri >= 2 ? IF.RARITIES[ri].color : '#ffffff');
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 1; i < tr.length; i++) {
      const a = tr[i - 1], b = tr[i]; ctx.globalAlpha = (i / tr.length) * 0.32;
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.lineTo(b.hx * 0.2 + b.x * 0.8, b.hy * 0.2 + b.y * 0.8); ctx.lineTo(a.hx * 0.2 + a.x * 0.8, a.hy * 0.2 + a.y * 0.8); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
};
