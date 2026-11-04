/* Companions — war hounds and a roster of six human allies who follow the knight into each section.
 * Hire and upgrade them with gold (Companions screen); up to two (three with the extra slot) march with you.
 * They chase, flank, shoot, heal and build on their own; press C to order Hold / Follow.
 * Downed companions recover after a short time — nobody is lost permanently. */
'use strict';

IF.COMPANIONS = [
  { id: 'rex', name: 'Rex', kind: 'dog', role: 'German Shepherd', cost: 0, hp: 150, speed: 340, dmg: 15, rate: 1.3, reach: 60, coat: ['#7a5230', '#1e1610', '#b08050'], size: 1,
    ability: 'Pin', abilityDesc: 'Bites can drag a zombie down and pin it for 1.5 s. Fetches nearby gold.', desc: 'Loyal, fast and fearless. The first friend you made after the fall.' },
  { id: 'kira', name: 'Kira', kind: 'dog', role: 'Belgian Malinois', cost: 350, hp: 120, speed: 400, dmg: 13, rate: 1.7, reach: 56, coat: ['#a87a40', '#2a1c10', '#c89a60'], size: 0.92,
    ability: 'Frenzy', abilityDesc: 'Lightning-quick bites; every third bite tears for bleeding.', desc: 'A former military working dog. Relentless.' },
  { id: 'bran', name: 'Bran', kind: 'dog', role: 'Irish Wolfhound', cost: 550, hp: 230, speed: 310, dmg: 24, rate: 1.0, reach: 70, coat: ['#8a8478', '#4a463e', '#a8a296'], size: 1.18,
    ability: 'Bowl Over', abilityDesc: 'Charges knock zombies flat. Heavy enough to stagger brutes.', desc: 'Huge, shaggy and gentle — until the dead come close.' },
  { id: 'elspeth', name: 'Dame Elspeth', kind: 'human', role: 'Crusader', cost: 450, hp: 240, speed: 250, dmg: 24, rate: 1.4, reach: 110, weapon: 'steel_longsword', range: 0,
    look: { helmStyle: 'open', set: 'reinforced_steel', cloth: '#e6e0d2', cross: '#a3181e', skin: '#d8ae88', hair: '#8a4a22', shield: true },
    ability: 'Holy Strike', abilityDesc: 'Every 8 s: a blazing overhead blow that cleaves and burns.', desc: 'A sister of the order. Sword, shield and unshakable faith.' },
  { id: 'godric', name: 'Brother Godric', kind: 'human', role: 'Heavy Knight', cost: 750, hp: 420, speed: 190, dmg: 34, rate: 0.85, reach: 115, weapon: 'war_hammer', range: 0,
    look: { helmStyle: 'greathelm', set: 'knight_commander', cloth: '#2a2a2e', cross: '#c9a24a', shield: true },
    ability: 'Bulwark', abilityDesc: 'Taunts the horde towards him and shrugs off 40% of damage.', desc: 'A walking fortress in black plate.' },
  { id: 'hale', name: 'Sgt. Hale', kind: 'human', role: 'Marksman', cost: 700, hp: 170, speed: 230, dmg: 70, rate: 0.75, reach: 0, weapon: 'kar98', range: 900,
    look: { helmStyle: 'combat', set: 'worn_iron', cloth: '#5a5a3a', cross: '#3a3a28', skin: '#c08a68', metalTint: '#4a5236' },
    ability: 'Headhunter', abilityDesc: 'Aimed shots: 35% critical chance and they pierce three zombies.', desc: 'Never misses twice. Rarely misses once.' },
  { id: 'wren', name: 'Wren', kind: 'human', role: 'Scout', cost: 500, hp: 160, speed: 330, dmg: 10, rate: 8, reach: 0, weapon: 'sten', range: 600,
    look: { helmStyle: 'hood', set: 'worn_iron', cloth: '#3e4430', cross: '#2a2e22', skin: '#e0b896', hair: '#c8a060', hoodC: '#3e4430', metalTint: '#3a3a32' },
    ability: 'Flashbang', abilityDesc: 'Every 18 s: tosses a stun grenade into the thickest crowd.', desc: 'Quick, quiet, and always first to spot them.' },
  { id: 'moreau', name: 'Doc Moreau', kind: 'human', role: 'Medic', cost: 850, hp: 190, speed: 260, dmg: 20, rate: 3, reach: 0, weapon: 'm1911', range: 500,
    look: { helmStyle: 'medic', set: 'worn_iron', cloth: '#d8d2c2', cross: '#b0141a', skin: '#8a5a3a', metalTint: '#6a6a5a' },
    ability: 'Field Medicine', abilityDesc: 'Patches the knight up (8% health every 7 s when hurt) and revives downed allies fast.', desc: 'Keeps everyone breathing. Shoots when he has to.' },
  { id: 'pike', name: 'Tamsin Pike', kind: 'human', role: 'Engineer', cost: 950, hp: 210, speed: 250, dmg: 16, rate: 1.6, reach: 0, weapon: 'trench_gun', range: 380,
    look: { helmStyle: 'hardhat', set: 'worn_iron', cloth: '#6a5232', cross: '#3a2a1a', skin: '#e2b490', hair: '#2a1a10', metalTint: '#5a4a32' },
    ability: 'Field Turret', abilityDesc: 'Every 30 s: builds a light sentry turret. Repairs yours.', desc: 'Can fix anything. Can break anything faster.' },
];
IF.COMPANION = Object.fromEntries(IF.COMPANIONS.map((c) => [c.id, c]));

IF.companions = {
  levelMult(lvl) { return { hp: 1 + (lvl - 1) * 0.16, dmg: 1 + (lvl - 1) * 0.13 }; },
  upgradeCost(lvl) { return Math.round(140 * Math.pow(lvl, 1.55)); },
  slotCost: 1500,
  data() { return IF.save.data.companions; },
  live: [],
  cleanup() { for (const a of this.live) { if (a.k3) IF.r3.world.remove(a.k3.root); if (a.dog3) IF.r3.world.remove(a.dog3.root); } this.live = []; },
  newRun(run) {
    this.cleanup();
    const d = this.data(); run.allies = run.allies || [];
    d.active.forEach((id, i) => { const def = IF.COMPANION[id]; if (def) { const c = new IF.Companion(run, def, d.owned[id].lvl, i); run.allies.push(c); this.live.push(c); } });
  },
  onSection(run) { for (const a of run.allies) if (a.isCompanion) { a.x = run.player.x - 80 - a.slot * 60; a.hp = Math.min(a.maxHp, a.hp + a.maxHp * 0.35); if (a.down) { a.down = false; a.hp = a.maxHp * 0.5; } } },
  command(run) { const d = this.data(); d.order = d.order === 'hold' ? 'follow' : 'hold'; for (const a of run.allies) if (a.isCompanion) a.holdX = run.player.x - 40 - a.slot * 50; IF.fx.text(run.player.x, run.player.y - 190, d.order === 'hold' ? 'COMPANIONS: HOLD' : 'COMPANIONS: FOLLOW', '#d8b25a', 15); IF.audio.ui('hover'); },
  hire(id) { const d = IF.save.data, c = IF.COMPANION[id]; if (!c || d.companions.owned[id] || d.gold < c.cost) return false; d.gold -= c.cost; d.companions.owned[id] = { lvl: 1 }; if (d.companions.active.length < d.companions.slots) d.companions.active.push(id); IF.save.write(); return true; },
  upgrade(id) { const d = IF.save.data, o = d.companions.owned[id]; if (!o || o.lvl >= 10) return false; const cost = this.upgradeCost(o.lvl); if (d.gold < cost) return false; d.gold -= cost; o.lvl++; IF.save.write(); return true; },
  toggle(id) { const c = IF.save.data.companions; if (!c.owned[id]) return false; const i = c.active.indexOf(id); if (i >= 0) c.active.splice(i, 1); else if (c.active.length < c.slots) c.active.push(id); else return false; IF.save.write(); return true; },
  buySlot() { const d = IF.save.data; if (d.companions.slots >= 3 || d.gold < this.slotCost) return false; d.gold -= this.slotCost; d.companions.slots = 3; IF.save.write(); return true; },

  drawHud(ctx, run, F) {
    let i = 0;
    for (const a of run.allies) {
      if (!a.isCompanion) continue; const x = 300, y = 74 + i * 18; i++;
      ctx.fillStyle = 'rgba(10,8,8,0.7)'; ctx.fillRect(x, y, 150, 14);
      ctx.fillStyle = a.down ? '#5a5a5a' : '#6aa84a'; ctx.fillRect(x + 1, y + 1, 148 * Math.max(0, a.hp / a.maxHp), 12);
      ctx.fillStyle = '#e8e0cc'; ctx.font = F(9); ctx.textAlign = 'left'; ctx.fillText((a.down ? '✚ ' : '') + a.def.name.toUpperCase() + ' · L' + a.lvl + (a.down ? '  DOWN ' + Math.ceil(a.downT) : ''), x + 4, y + 10);
    }
    if (i && IF.save.data.companions.order === 'hold') { ctx.fillStyle = '#d8b25a'; ctx.font = F(9); ctx.fillText('HOLDING POSITION (C)', 300, 74 + i * 18 + 10); }
  },

  /* ---------- 3D ---------- */
  render3d(run) {
    for (const a of run.allies) if (a.isCompanion) a.render3d();
  },
};

/* ===================================================================== */
IF.Companion = class Companion {
  constructor(run, def, lvl, slot) {
    const m = IF.companions.levelMult(lvl), sec = 1 + run.section * 0.04;
    this.run = run; this.def = def; this.lvl = lvl; this.slot = slot; this.isAlly = true; this.isCompanion = true; this.kind = def.kind;
    this.maxHp = this.hp = Math.round(def.hp * m.hp); this.dmgBase = def.dmg * m.dmg; this.aggro = def.id === 'godric' ? 2.2 : def.kind === 'dog' ? 1 : 0.85;
    this.x = run.player.x - 80 - slot * 60; this.y = IF.GROUND; this.vx = 0; this.facing = 1; this.w = def.kind === 'dog' ? 60 : 44; this.h = def.kind === 'dog' ? 60 : 150;
    this.state = 'follow'; this.stateT = 0; this.cd = 0; this.abilT = 4 + slot * 2; this.phase = Math.random() * 6; this.t = 0; this.aim = 0; this.bites = 0;
    this.dead = false; this.down = false; this.downT = 0; this.flashT = 0; this.z = def.kind === 'dog' ? 0.75 : -0.35 - slot * 0.15; this.healT = 7;
    if (def.weapon) { const w = IF.WEAPON[def.weapon]; this.wi = { def: w, item: { rarity: lvl >= 7 ? 'epic' : lvl >= 4 ? 'rare' : 'uncommon', uid: 'c_' + def.id }, mag: 99, reload: 0 }; this.ranged = w.slot !== 'melee'; }
    this.ws = IF.tac.ws(run, this.dmgBase, { knock: def.kind === 'dog' ? 120 : 200, crit: def.id === 'hale' ? 0.35 : 0.08, pierce: 0.3, spread: def.id === 'wren' ? 0.06 : 0.02 });
    if (def.id === 'hale') this.ws.pierce = 3;
    if (this.ranged) { this.ws.def = Object.assign({}, this.wi.def); this.ws.pellets = this.wi.def.pellets || 1; this.ws.spread = this.wi.def.spread; }
    this.look = def.kind === 'human' ? this.buildLook() : null;
  }
  buildLook() {
    const L = this.def.look, set = IF.ARMOUR_SET[L.set] || IF.ARMOUR_SETS[0], pal = Object.assign({}, set.pal, { cloth: L.cloth, cross: L.cross, plume: null, emblem: 'cross' });
    if (L.metalTint) Object.assign(pal, { metal: L.metalTint, light: L.metalTint, dark: '#2a2a24', rust: 0.2 });
    const look = { helmStyle: L.helmStyle, tier: set.tier, glow: null, halo: false, emblem: 'cross', skin: L.skin, hair: L.hair, hoodC: L.hoodC };
    for (const s of ['helmet', 'chest', 'gauntlets', 'legs', 'boots']) look[s] = pal;
    if (L.shield) look.shield = pal; if (this.def.id === 'elspeth') look.cape = Object.assign({}, pal, { cloth: '#8e1218' });
    return look;
  }
  hitbox() { return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h }; }
  takeDamage(o) {
    if (this.down || this.dead) return;
    let dmg = o.dmg * (this.def.id === 'godric' ? 0.6 : 1); this.hp -= dmg; this.flashT = 0.12; this.vx += Math.sign(this.x - (o.x ?? this.x)) * 120;
    IF.fx.blood(this.x, this.y - this.h * 0.6, Math.sign(this.x - (o.x ?? this.x)), 3);
    if (this.hp <= 0) { this.hp = 0; this.down = true; this.downT = 12; this.state = 'down'; IF.fx.text(this.x, this.y - this.h - 20, this.def.name + ' is down!', '#ff8a6a', 14); if (this.kind === 'dog') IF.audio.hurt && IF.audio.hurt(); }
  }
  nearestEnemy(maxD) {
    let best = null, bd = maxD;
    for (const e of this.run.enemies) { if (e.dead || e.state === 'rise') continue; const d = Math.abs(e.x - this.x); if (d < bd && Math.abs(e.x - this.run.player.x) < 950) { bd = d; best = e; } }
    return best;
  }
  update(dt) {
    const run = this.run, pl = run.player, def = this.def;
    this.t += dt; this.stateT += dt; this.cd -= dt; this.abilT -= dt; this.flashT -= dt;
    this.x += this.vx * dt; this.vx *= Math.pow(0.02, dt);
    const W = run.world; this.x = IF.util.clamp(this.x, W.leftBound + 10, (W.gateOpen ? W.end + 1200 : Math.min(W.rightBound, W.gateX) - 30));
    if (this.down) { // knocked out: recover over time, faster if the medic or the knight is near
      const medic = run.allies.some((a) => a.def && a.def.id === 'moreau' && !a.down && Math.abs(a.x - this.x) < 200);
      this.downT -= dt * (medic ? 3 : 1) * (Math.abs(pl.x - this.x) < 90 ? 2 : 1);
      if (this.downT <= 0) { this.down = false; this.hp = this.maxHp * 0.4; this.state = 'follow'; IF.fx.text(this.x, this.y - this.h - 10, 'Back on their feet', '#9ad07a', 13); }
      return;
    }
    if (run.transition) { this.moveTo(pl.x - 70 - this.slot * 50, dt, 1.2); return; }
    const hold = IF.save.data.companions.order === 'hold';
    // abilities that don't depend on a target
    if (def.id === 'moreau' && (this.healT -= dt) <= 0) { this.healT = 7; if (pl.hp < pl.maxHp * 0.8 && !pl.dead && Math.abs(pl.x - this.x) < 600) { pl.heal(pl.maxHp * 0.08); IF.fx.ring(pl.x, pl.y - 70, 90, 'rgba(120,255,140,0.6)', 0.5); IF.fx.text(pl.x, pl.y - 170, '+ Field dressing', '#8af08a', 13); } }
    if (def.id === 'pike' && this.abilT <= 0) {
      this.abilT = 30; const own = run.allies.find((a) => a.kind === 'sentry' && !a.dead && a.owner === 'player');
      if (own) { own.hp = own.maxHp; own.ammo += 120; own.life += 15; IF.fx.text(own.x, own.y - 100, 'Repaired', '#9ad07a', 13); }
      run.allies.push(new IF.Sentry(run, this.x + this.facing * 40, 1 + run.section * 0.07, 'engineer')); IF.fx.text(this.x, this.y - this.h - 10, 'Turret up!', '#d8b25a', 13);
    }
    const engageR = def.kind === 'dog' ? 520 : this.ranged ? def.range : 460;
    const tgt = this.nearestEnemy(hold ? Math.min(engageR, 400) : engageR);
    if (!tgt) { // follow the knight, keep a loose formation
      const fx = hold ? (this.holdX ?? this.x) : pl.x - pl.facing * (def.kind === 'dog' ? 55 : 95 + this.slot * 45);
      this.moveTo(fx, dt, Math.abs(fx - this.x) > 300 ? 1.25 : 1); this.aim *= 0.9; return;
    }
    this.facing = Math.sign(tgt.x - this.x) || this.facing;
    const d = Math.abs(tgt.x - this.x);
    if (def.id === 'wren' && this.abilT <= 0) { this.abilT = 18; run.throws.push({ type: 'stun', x: this.x, y: this.y - 120, vx: Math.sign(tgt.x - this.x) * Math.min(700, d * 1.3 + 100), vy: -420, t: 0, fuse: 0.9, rot: 0, dmg: 0, owner: 'ally' }); }
    if (this.ranged) {
      // keep a firing distance; aim at the torso
      const want = def.id === 'pike' ? 220 : 300; if (d < want - 60 && !hold) this.moveTo(this.x - this.facing * 200, dt, 0.8, true); else if (d > def.range * 0.85 && !hold) this.moveTo(tgt.x - this.facing * want, dt, 1); else this.vxWalk = 0;
      const mx = this.x + this.facing * 30, my = this.y - 110, ty = tgt.y - tgt.h * (tgt.isLow ? 0.4 : def.id === 'hale' ? 0.85 : 0.6);
      this.aim += (Math.atan2(ty - my, Math.abs(tgt.x - mx)) - this.aim) * Math.min(1, dt * 8);
      if (this.cd <= 0) {
        this.cd = 1 / def.rate * (0.85 + Math.random() * 0.3); const ang = this.facing > 0 ? this.aim : Math.PI - this.aim;
        IF.combat.fire({ crouch: false, vx: 0 }, { ws: this.ws, def: this.ws.def }, mx + Math.cos(ang) * 40, my + Math.sin(ang) * 40, ang);
        IF.fx.muzzle(mx + Math.cos(ang) * 46, my + Math.sin(ang) * 46, ang, def.id === 'hale'); IF.audio.shot(this.wi.def.cls); this.kick = 1;
        if (def.id === 'hale') setTimeout(() => IF.audio.bolt(), 400);
      }
    } else {
      // melee: close in and strike; dogs lunge
      const reach = def.reach; if (d > reach * 0.8) this.moveTo(tgt.x - this.facing * reach * 0.6, dt, def.kind === 'dog' ? 1.15 : 1); else this.vxWalk = 0;
      if (this.state === 'attack') { if (this.stateT > 0.18 && !this.hit) { this.hit = true; this.strike(tgt); } if (this.stateT > 0.42) { this.state = 'follow'; this.stateT = 0; } }
      else if (d < reach && this.cd <= 0) { this.state = 'attack'; this.stateT = 0; this.hit = false; this.cd = 1 / def.rate; if (def.kind === 'dog') this.vx = this.facing * 260; this.heavyNext = (def.id === 'elspeth' && this.abilT <= 0); if (this.heavyNext) this.abilT = 8; }
    }
  }
  strike(e) {
    if (e.dead) return; const def = this.def, run = this.run;
    const heavy = this.heavyNext, mult = heavy ? 2.6 : 1;
    const ws = Object.assign({}, this.ws, { perks: heavy ? ['burn'] : [] });
    if (def.id === 'kira') { this.bites++; if (this.bites % 3 === 0) ws.def = Object.assign({}, ws.def, { bleedBase: true }); }
    IF.combat.hitEnemy(e, { ws, mult, dir: this.facing, x: e.x - this.facing * 10, y: e.y - e.h * (this.kind === 'dog' ? 0.35 : 0.6), melee: true, heavy: heavy || def.id === 'godric' || def.id === 'bran', stagger: def.id === 'bran' || def.id === 'godric' ? 1 : 0.3 });
    if (heavy) { IF.fx.ring(e.x, e.y - 60, 140, 'rgba(255,210,120,0.8)', 0.4); IF.fx.addShake(5); const other = run.enemies.find((o) => !o.dead && o !== e && Math.abs(o.x - e.x) < 120); if (other) IF.combat.hitEnemy(other, { ws, mult: 1.6, dir: this.facing, x: other.x, y: other.y - 80, melee: true, heavy: true }); }
    if (this.kind === 'dog') { IF.audio.hit('flesh'); if (def.id === 'rex' && !e.boss && !e.dead && Math.random() < 0.3) { e.trapped = 1.5; IF.fx.text(e.x, e.y - e.h - 10, 'PINNED', '#d8b25a', 12); } if (def.id === 'bran' && !e.boss) IF.combat.knockback(e, this.facing * 300, 1.2); }
    else IF.audio.swing && IF.audio.swing(1);
  }
  moveTo(tx, dt, k = 1, back) {
    const dx = tx - this.x, sp = this.def.speed * k;
    if (Math.abs(dx) < 12) { this.vxWalk = 0; return; }
    this.vxWalk = IF.util.approach(this.vxWalk || 0, Math.sign(dx) * sp, 1600 * dt);
    this.x += this.vxWalk * dt; if (!back) this.facing = Math.sign(dx);
    // dogs fetch gold that is lying around
    if (this.def.id === 'rex') for (const p of this.run.world.pickups) if (p.alive && p.kind === 'gold' && Math.abs(p.x - this.x) < 40) { p.x = this.run.player.x; p.y = this.run.player.y - 60; }
  }
  get speedNow() { return Math.abs(this.vxWalk || 0); }

  /* ---------- 2D pose for the human rig (same skeleton as the knight) ---------- */
  pose() {
    const t = this.t, sp = this.speedNow, run = sp > 20, P = { hipX: 0, hipY: -70, lean: 0.06, footF: { x: 9, y: 0 }, footB: { x: -9, y: 0 }, handF: { x: 18, y: -60 }, handB: { x: -6, y: -52 }, shieldMode: 'back', capeWave: 0, tabardSway: 0, headTilt: 0, wAngle: -1.1, elbowF: 1, elbowB: 1 };
    if (this.down) { P.hipY = -20; P.footF = { x: 40, y: 0 }; P.footB = { x: 34, y: 0 }; P.lean = -1.3; return P; }
    if (run) { this.phase += sp * (IF.game.lastDt || 0.016) * Math.PI / (2 * (14 + 12 * Math.min(1, sp / 260)) * IF.KNIGHT_SCALE); const ph = this.phase, k = Math.min(1, sp / 260), stride = 14 + 12 * k; P.footF = { x: Math.sin(ph) * stride, y: -Math.max(0, Math.cos(ph)) * (6 + 10 * k) }; P.footB = { x: Math.sin(ph + Math.PI) * stride, y: -Math.max(0, Math.cos(ph + Math.PI)) * (6 + 10 * k) }; P.hipY = -70 - Math.abs(Math.sin(ph)) * 3 * k; P.lean = 0.06 + 0.12 * k; P.capeWave = 0.4 * k; P.tabardSway = Math.sin(ph) * 0.6; }
    else { P.hipY = -70 + Math.sin(t * 2.2) * 0.8; P.tabardSway = Math.sin(t * 1.3) * 0.15; }
    if (this.ranged) {
      const cls = this.wi.def.cls, grip = IF.art.GRIP[cls] || IF.art.GRIP.rifle, pistol = cls === 'pistol'; this.kick = Math.max(0, (this.kick || 0) - 0.15);
      const a = this.aim, hx = (pistol ? 34 : 22) - this.kick * 4, hy = -86 + a * 10; P.handF = { x: hx, y: hy }; P.wAngle = a - this.kick * 0.08;
      P.handB = pistol ? { x: hx - 4, y: hy + 6 } : { x: hx + Math.cos(a) * grip.off[0] - Math.sin(a) * grip.off[1], y: hy + Math.sin(a) * grip.off[0] + Math.cos(a) * grip.off[1] }; P.headTilt = a * 0.4;
    } else if (this.state === 'attack') {
      const k = Math.min(1, this.stateT / 0.42), up = k < 0.4 ? k / 0.4 : 1, down = k < 0.4 ? 0 : (k - 0.4) / 0.6;
      P.wAngle = -2.4 * up * (1 - down) + (0.7) * down - 0.6 * (1 - up); P.handF = { x: 10 + 22 * down, y: -92 + 30 * down }; P.lean = 0.1 + 0.2 * down;
      if (this.def.id === 'godric') { P.twoHand = true; }
    } else { const sw = run ? Math.sin(this.phase) * 6 : 0; P.handF = { x: 16 + sw, y: -58 }; P.wAngle = -1.05; P.handB = { x: -8 - sw, y: -50 }; }
    if (this.def.look.shield && !this.ranged) { P.shieldMode = this.state === 'attack' ? 'back' : 'front'; if (P.shieldMode === 'front') P.handB = { x: 20, y: -78 }; }
    if (P.twoHand) { const a = P.wAngle; P.handB = { x: P.handF.x - Math.cos(a) * 13, y: P.handF.y - Math.sin(a) * 13 }; }
    if (this.wi) { P._weapon = this.wi; P.drawWeapon = (ctx) => { ctx.save(); ctx.translate(P.handF.x, P.handF.y); ctx.rotate(P.wAngle); IF.art.drawWeapon(ctx, this.wi.def, 2, this.t, {}); ctx.restore(); }; }
    return P;
  }

  /* ---------- rendering ---------- */
  render3d() {
    if (this.kind === 'human') {
      if (!this.k3) this.k3 = new IF.Knight3D();
      const P = this.pose();
      this.k3.update(P, this.x, this.y, this.facing, this.look, { roll: 0, rollZ: this.down ? (this.facing > 0 ? 1.4 : -1.4) : 0, flash: this.flashT > 0 ? '#ff3a2a' : null, visible: true, spin: 0, z: this.z });
    } else {
      if (!this.dog3) this.dog3 = new IF.Dog3D(this.def);
      this.dog3.update(this);
    }
  }
  draw2d(ctx) {
    ctx.save(); ctx.translate(this.x, this.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 2, this.kind === 'dog' ? 30 : 30, 6, 0, 0, 6.283); ctx.fill();
    if (this.kind === 'human') { ctx.scale(this.facing * IF.KNIGHT_SCALE * 0.97, IF.KNIGHT_SCALE * 0.97); if (this.down) ctx.rotate(-1.4); IF.art.drawKnight(ctx, this.pose(), this.look, this.t); }
    else IF.Dog3D.draw2d(ctx, this);
    ctx.restore();
  }
};

/* ===================================================================== */
/* Procedural quadruped: torso, deep chest, head with muzzle and ears, tail, four two-segment legs. Metres. */
IF.Dog3D = class Dog3D {
  /* Fur: fine directional strands over a mottled base, matte (roughness 1) with a soft sheen normal — never the
   * polished look of the skin material. One texture set is shared; the coat colour tints it. */
  static fur(col) {
    return IF.mat.get('fur' + col, () => {
      const T = IF.r3.T, set = IF.Dog3D._furSet || (IF.Dog3D._furSet = (() => {
        const N = 256, base = IF.mat.noiseField(N, 8, 4, 311), h = new Float32Array(N * N);
        for (let i = 0; i < 9000; i++) { const x = Math.random() * N, y = Math.random() * N, len = 5 + Math.random() * 7; for (let k = 0; k < len; k++) { const xx = ((x + k * 0.25) | 0) % N, yy = ((y + k) | 0) % N; h[yy * N + xx] = Math.min(1, h[yy * N + xx] + 0.22); } }
        const map = IF.mat.fieldToTex(N, base, (v, i) => { const c = 130 + v * 55 + h[i] * 28; return [c, c, c]; }), normal = IF.mat.normalFromHeight(N, h, 2.2);
        map.repeat.set(3, 3); normal.repeat.set(3, 3); return { map, normal };
      })());
      return new T.MeshStandardMaterial({ color: col, map: set.map, normalMap: set.normal, normalScale: new T.Vector2(0.7, 0.7), roughness: 1, metalness: 0 });
    });
  }
  /* Anatomy (metres, German Shepherd reference: 0.62 m at the withers, 1.0 m nose to rump):
   * one lofted torso with a deep chest and tucked waist, a forward-angled neck, wedge skull with a long muzzle,
   * erect ears, front legs (humerus + forearm + pastern) and hind legs with a real hock angle, a low bushy tail.
   * Parts overlap at joints by design (no gaps) and are tinted with the shared fur material. */
  constructor(def) {
    const T = IF.r3.T, s = def.size || 1, [c1, c2, c3] = def.coat;
    const tan = IF.Dog3D.fur(c1), black = IF.Dog3D.fur(c2), cream = IF.Dog3D.fur(c3), nose = IF.mat.basic('#0a0a0a', 0.35), eye = IF.mat.get('dogeye', () => new T.MeshStandardMaterial({ color: '#2a1606', roughness: 0.1, metalness: 0.2 }));
    const M = (geo, mat, p, x = 0, y = 0, z = 0) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; p.add(m); return m; };
    const seg = (p, mat, a, b, r0, r1) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), m = M(new T.CylinderGeometry(r1, r0, L, 10), mat, p, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, a[2] || 0); m.rotation.z = Math.atan2(dx, dy) * -1; M(new T.SphereGeometry(r1, 8, 6), mat, p, b[0], b[1], a[2] || 0); return m; };
    this.root = new T.Group(); this.body = new T.Group(); this.root.add(this.body); this.root.scale.setScalar(s);
    const B = this.body; B.position.y = 0.44;
    // torso: lathe along x, then deepen the chest / tuck the waist on the underside
    const prof = [[0.0, -0.40], [0.07, -0.385], [0.11, -0.33], [0.125, -0.22], [0.118, -0.08], [0.135, 0.06], [0.155, 0.18], [0.158, 0.27], [0.135, 0.34], [0.09, 0.38], [0.0, 0.395]];
    const tg = new T.LatheGeometry(prof.map(([r, y]) => new T.Vector2(r, y)), 18).rotateZ(-Math.PI / 2), tp = tg.attributes.position;
    for (let i = 0; i < tp.count; i++) { const x = tp.getX(i), y = tp.getY(i); if (y < 0) { const chest = Math.max(0, 1 - Math.abs(x - 0.2) / 0.22), waist = Math.max(0, 1 - Math.abs(x + 0.08) / 0.16); tp.setY(i, y * (1 + 0.38 * chest - 0.22 * waist)); } else tp.setY(i, y * 0.92); }
    tg.computeVertexNormals(); M(tg, tan, B).scale.z = 0.74;
    const saddle = M(new T.SphereGeometry(0.15, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), black, B, -0.04, 0.02, 0); saddle.scale.set(2.3, 0.75, 0.78); // black saddle over the back
    // neck and head
    const neck = new T.Group(); neck.position.set(0.3, 0.06, 0); B.add(neck); this.neck = neck;
    seg(neck, tan, [0, 0], [0.15, 0.12], 0.11, 0.08); // neck carried forward at ~40°, not upright M(new T.SphereGeometry(0.1, 10, 8), cream, neck, 0.04, -0.03, 0).scale.set(1, 1.1, 0.8); // throat ruff
    const head = new T.Group(); head.position.set(0.18, 0.15, 0); neck.add(head); this.head = head;
    const skull = M(new T.SphereGeometry(0.088, 14, 10), tan, head, 0, 0, 0); skull.scale.set(1.2, 0.92, 0.9);
    const muzzle = M(new T.CylinderGeometry(0.036, 0.062, 0.17, 10).rotateZ(-Math.PI / 2 - 0.1), black, head, 0.135, -0.03, 0); muzzle.scale.z = 0.88; // long wedge muzzle
    M(new T.SphereGeometry(0.025, 8, 6), nose, head, 0.222, -0.017, 0);
    for (const z of [-0.042, 0.042]) { M(new T.SphereGeometry(0.012, 8, 6), eye, head, 0.075, 0.025, z); const ear = M(new T.ConeGeometry(0.05, 0.13, 6), black, head, -0.02, 0.1, z * 1.2); ear.rotation.set(z > 0 ? 0.22 : -0.22, 0, -0.1); ear.scale.z = 0.42; /* big erect shepherd ears */ }
    const jaw = new T.Group(); jaw.position.set(0.07, -0.06, 0); head.add(jaw); this.jaw = jaw; M(new T.BoxGeometry(0.13, 0.022, 0.06), black, jaw, 0.065, 0, 0);
    // tail: low-set, bushy, hanging in a gentle curve
    const tail = new T.Group(); tail.position.set(-0.37, 0.03, 0); B.add(tail); this.tail = tail;
    const tc = new T.CatmullRomCurve3([new T.Vector3(0, 0, 0), new T.Vector3(-0.1, -0.1, 0), new T.Vector3(-0.15, -0.24, 0), new T.Vector3(-0.12, -0.34, 0)]);
    const tgeo = new T.TubeGeometry(tc, 12, 0.05, 8), tpos = tgeo.attributes.position; for (let i = 0; i < tpos.count; i++) { /* taper not needed for silhouette */ } M(tgeo, black, tail, 0, 0, 0).scale.z = 1.2;
    // legs: hip/shoulder group swings, knee group bends; lower legs carry pastern + paw
    this.legs = [];
    for (const [lx, lz] of [[0.25, 0.075], [0.25, -0.075], [-0.25, 0.07], [-0.25, -0.07]]) {
      const front = lx > 0, hip = new T.Group(); hip.position.set(lx, -0.04, lz); B.add(hip);
      if (front) seg(hip, tan, [0.02, 0.02], [-0.02, -0.17], 0.06, 0.042); else { const th = M(new T.SphereGeometry(0.075, 10, 8), tan, hip, 0.01, -0.03, 0); th.scale.set(1.15, 1.25, 0.62); /* haunch blends into the rump */ seg(hip, tan, [0.02, -0.04], [0.05, -0.17], 0.06, 0.04); }
      const knee = new T.Group(); knee.position.set(front ? -0.02 : 0.05, -0.17, 0); hip.add(knee);
      if (front) { seg(knee, cream, [0, 0], [0, -0.17], 0.036, 0.03); seg(knee, cream, [0, -0.17], [0.015, -0.205], 0.028, 0.025); }
      else { seg(knee, cream, [0, 0], [-0.06, -0.12], 0.036, 0.03); seg(knee, cream, [-0.06, -0.12], [-0.045, -0.2], 0.03, 0.026); } // hock angle
      const paw = M(new T.SphereGeometry(0.036, 10, 6), cream, knee, front ? 0.035 : -0.022, -0.212, 0); paw.scale.set(1.45, 0.55, 1.05);
      this.legs.push({ hip, knee, front, off: lz > 0 ? 0 : Math.PI });
    }
    IF.r3.world.add(this.root);
  }
  update(c) {
    const R = IF.r3, t = c.t, sp = c.speedNow, k = Math.min(1, sp / 300);
    this.root.position.set(c.x * R.S, R.wy(c.x, IF.GROUND), c.z); this.root.rotation.y = c.facing > 0 ? 0 : Math.PI;
    c.gaitPh = (c.gaitPh || 0) + (sp > 15 ? sp * (IF.game.lastDt || 0.016) * 0.078 : 0) + (IF.game.lastDt || 0.016) * 0.4; const gait = c.gaitPh;
    this.legs.forEach((L) => { const ph = gait + L.off + (L.front ? 0 : Math.PI * 0.5); L.hip.rotation.z = Math.sin(ph) * 0.65 * k; L.knee.rotation.z = (L.front ? 1 : -1) * Math.max(0, Math.cos(ph)) * 0.6 * k; });
    this.body.position.y = 0.44 + Math.abs(Math.sin(gait)) * 0.025 * k; this.body.rotation.z = Math.sin(gait * 2) * 0.03 * k;
    this.tail.rotation.z = 0.15 + Math.sin(t * (c.state === 'follow' ? 7 : 3)) * 0.12 + Math.min(0.5, sp / 600); this.tail.rotation.y = Math.sin(t * 9) * 0.4;
    // attack: lunge forward, jaws open; idle: head looks around
    const atk = c.state === 'attack' ? Math.sin(Math.min(1, c.stateT / 0.42) * Math.PI) : 0;
    this.body.rotation.z += atk * -0.25; this.neck.rotation.z = -atk * 0.4 + (sp < 20 ? Math.sin(t * 0.7) * 0.1 : 0); this.jaw.rotation.z = -0.1 - atk * 0.55;
    if (c.down) { this.root.rotation.x = 1.4; this.body.position.y = 0.2; this.legs.forEach((L) => { L.hip.rotation.z = 0.6; }); } else this.root.rotation.x = 0;
  }
  static draw2d(ctx, c) {
    const f = c.facing, [c1, c2] = c.def.coat, s = c.def.size || 1; ctx.scale(f * s, s); if (c.down) { ctx.rotate(0.2); }
    const t = c.t * (6 + c.speedNow * 0.04), k = Math.min(1, c.speedNow / 300);
    ctx.strokeStyle = c1; ctx.lineWidth = 7; ctx.lineCap = 'round';
    for (const [x, o] of [[22, 0], [16, Math.PI], [-20, 0.5 * Math.PI], [-26, 1.5 * Math.PI]]) { ctx.beginPath(); ctx.moveTo(x, -42); ctx.lineTo(x + Math.sin(t + o) * 12 * k, -2); ctx.stroke(); }
    ctx.fillStyle = c1; ctx.beginPath(); ctx.ellipse(0, -48, 34, 14, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = c2; ctx.beginPath(); ctx.ellipse(-6, -54, 24, 8, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = c1; ctx.beginPath(); ctx.ellipse(36, -66, 12, 10, -0.3, 0, 6.283); ctx.fill(); ctx.fillStyle = c2; ctx.fillRect(40, -66, 16, 7); ctx.beginPath(); ctx.moveTo(30, -74); ctx.lineTo(33, -88); ctx.lineTo(38, -74); ctx.fill();
    ctx.strokeStyle = c2; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-32, -50); ctx.quadraticCurveTo(-46, -56 + Math.sin(c.t * 9) * 6, -52, -40); ctx.stroke();
  }
};
