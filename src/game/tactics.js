/* Tactical belt — throwables (frag, stun, Molotov) and deployables (bear trap, sentry gun).
 * Cycle with T / D-pad, use with G / Back. Counts are per run and topped up at every gate.
 * Deployed sentries (and companions) are "allies": zombies may choose them as targets. */
'use strict';

IF.TACTICAL = [
  { id: 'frag', name: 'Frag Grenade', icon: '●', max: 3, kind: 'throw', refill: 1, desc: 'Bounces, then bursts after 1.4 s. Heavy blast damage.' },
  { id: 'stun', name: 'Stun Grenade', icon: '✶', max: 2, kind: 'throw', refill: 1, desc: 'Blinding flash: zombies nearby are stunned for 3 s.' },
  { id: 'molotov', name: 'Molotov', icon: '♨', max: 2, kind: 'throw', refill: 1, desc: 'Shatters into a pool of fire that burns for 6 s.' },
  { id: 'beartrap', name: 'Bear Trap', icon: '⋈', max: 3, kind: 'place', refill: 1, desc: 'Snaps shut on the first zombie: heavy damage, bleeding, rooted.' },
  { id: 'sentry', name: 'Sentry Gun', icon: '⌖', max: 1, kind: 'place', refill: 0.34, desc: 'Auto-turret: 40 s or 260 rounds. Draws the horde\'s attention.' },
];
IF.TAC = Object.fromEntries(IF.TACTICAL.map((t) => [t.id, t]));

IF.tac = {
  newRun(run) {
    run.tac = { sel: 0, n: { frag: 2, stun: 1, molotov: 1, beartrap: 1, sentry: 1 }, part: {} };
    run.throws = []; run.traps = []; run.allies = run.allies || [];
  },
  /* topped up when a section is cleared (fractional refills accumulate, e.g. one sentry every 3 gates) */
  refill(run) {
    const bonus = run.player.st.tacticalCap || 0;
    for (const t of IF.TACTICAL) {
      const max = t.max + (t.kind === 'throw' ? bonus : 0);
      run.tac.part[t.id] = (run.tac.part[t.id] || 0) + t.refill;
      while (run.tac.part[t.id] >= 1) { run.tac.part[t.id] -= 1; run.tac.n[t.id] = Math.min(max, run.tac.n[t.id] + 1); }
    }
  },
  cur(run) { return IF.TACTICAL[run.tac.sel]; },
  cycle(run, dir = 1) { run.tac.sel = (run.tac.sel + dir + IF.TACTICAL.length) % IF.TACTICAL.length; IF.audio.ui('hover'); },

  use(run) {
    const pl = run.player, t = this.cur(run);
    if (pl.dead || run.transition) return;
    if (run.tac.n[t.id] <= 0) { IF.audio.ui('error'); IF.fx.text(pl.x, pl.y - 170, 'No ' + t.name + 's', '#ff8a6a', 14); return; }
    if (t.id === 'sentry' && run.allies.some((a) => a.kind === 'sentry' && !a.dead && a.owner === 'player')) { IF.audio.ui('error'); IF.fx.text(pl.x, pl.y - 170, 'Sentry already deployed', '#ff8a6a', 14); return; }
    run.tac.n[t.id]--;
    const dmgScale = 1 + run.section * 0.07 + (pl.st.explosiveDmg || 0);
    if (t.kind === 'throw') {
      // aim: pointer direction if aiming with the mouse/stick, otherwise a lob in the facing direction
      let ang = pl.facing > 0 ? -0.62 : Math.PI + 0.62;
      if (IF.input.mouseAim || IF.input.padAim) { const a = pl.aimAng || 0; ang = (pl.facing > 0 ? a : Math.PI - a) - 0.35 * pl.facing; }
      const sp = 760, hx = pl.x + pl.facing * 18, hy = pl.y - 120;
      run.throws.push({ type: t.id, x: hx, y: hy, vx: Math.cos(ang) * sp + pl.vx * 0.4, vy: Math.sin(ang) * sp, t: 0, fuse: t.id === 'frag' ? 1.4 : t.id === 'stun' ? 1.0 : 9, rot: 0, dmg: (t.id === 'frag' ? 130 : 16) * dmgScale, owner: 'player' });
      pl.throwT = 0.35; IF.audio.swing && IF.audio.swing(0.6);
    } else if (t.id === 'beartrap') {
      run.traps.push({ x: pl.x + pl.facing * 40, armed: true, shutT: 0, life: 90, dmg: 70 * dmgScale, owner: 'player' });
      IF.audio.hit && IF.audio.hit('metal'); IF.fx.dust(pl.x + pl.facing * 40, IF.GROUND, 3);
    } else if (t.id === 'sentry') {
      run.allies.push(new IF.Sentry(run, pl.x + pl.facing * 60, dmgScale, 'player'));
      IF.audio.ui('upgrade');
    }
  },

  update(run, dt) {
    const I = IF.input;
    if (I.pressed('tactical')) this.use(run);
    if (I.pressed('tacnext')) this.cycle(run, 1);
    if (I.pressed('companion') && IF.companions) IF.companions.command(run);
    if (run.player.throwT > 0) run.player.throwT -= dt;
    // thrown objects
    for (let i = run.throws.length - 1; i >= 0; i--) {
      const g = run.throws[i]; g.t += dt; g.vy += 1500 * dt; g.x += g.vx * dt; g.y += g.vy * dt; g.rot += g.vx * dt * 0.02;
      let landed = false; const Wg = run.world; if (!Wg.gateOpen && g.x > Wg.gateX - 10) { g.x = Wg.gateX - 10; g.vx = -Math.abs(g.vx) * 0.4; }
      if (g.y >= IF.GROUND - 6) { g.y = IF.GROUND - 6; landed = true; if (g.type !== 'molotov') { g.vy = -Math.abs(g.vy) * 0.32; g.vx *= 0.55; if (Math.abs(g.vy) < 60) g.vy = 0; if (Math.abs(g.vy) > 80) IF.audio.hit && IF.audio.hit('metal'); } }
      // Molotovs and stuns burst on a zombie; frags just bounce off them
      let hitE = null; if (g.type !== 'frag') for (const e of run.enemies) { if (e.dead) continue; const hb = e.hitbox(); if (g.x > hb.x && g.x < hb.x + hb.w && g.y > hb.y && g.y < hb.y + hb.h) { hitE = e; break; } }
      if (g.type === 'molotov') { if (Math.random() < 0.7) IF.fx.spawn({ x: g.x, y: g.y - 8, vx: (Math.random() - 0.5) * 20, vy: -40, life: 0.3, size: 4, color: '#ffa030', type: 'fire', add: true, grow: -6 }); }
      const boom = g.type === 'molotov' ? (landed || hitE) : g.t >= g.fuse || (g.type === 'stun' && hitE);
      if (boom) { this.detonate(run, g); run.throws.splice(i, 1); }
    }
    // bear traps
    for (let i = run.traps.length - 1; i >= 0; i--) {
      const tr = run.traps[i]; tr.life -= dt;
      if (tr.armed) {
        for (const e of run.enemies) {
          if (e.dead || e.state === 'rise' || e.y < IF.GROUND - 8 || Math.abs(e.x - tr.x) > 24 + e.w * 0.2) continue;
          tr.armed = false; tr.shutT = 0; tr.victim = e;
          IF.combat.hitEnemy(e, { ws: this.ws(run, tr.dmg, { bleed: true, knock: 0 }), dir: 0, x: tr.x, y: IF.GROUND - 30, heavy: true, stagger: 0.6 });
          if (!e.dead) e.trapped = e.boss ? 0.8 : 3.5;
          IF.fx.blood(tr.x, IF.GROUND - 20, 0, 10); IF.fx.sparks(tr.x, IF.GROUND - 10, 0, 6); IF.audio.from(tr.x).trap(); IF.fx.addShake(3);
          break;
        }
      } else tr.shutT += dt;
      if (tr.life <= 0 || tr.shutT > 6) run.traps.splice(i, 1);
    }
    // allies (sentries / companions)
    for (const a of run.allies) a.update(dt);
    run.allies = run.allies.filter((a) => !a.remove);
  },

  detonate(run, g) {
    if (g.type === 'frag') { IF.combat.explode(g.x, g.y - 10, 175, g.dmg, 'player', { ws: this.ws(run, g.dmg, {}) }); IF.fx.decal(g.x, IF.GROUND, 'scorch', 70); IF.fx.addShake(10); }
    else if (g.type === 'stun') {
      IF.fx.ring(g.x, g.y - 20, 300, 'rgba(255,255,255,0.9)', 0.5); IF.fx.spawn({ x: g.x, y: g.y - 30, life: 0.25, size: 260, color: 'rgba(255,255,240,0.9)', type: 'glow', add: true });
      IF.audio.from(g.x).flash(); run.flashT = 0.35; IF.fx.addShake(4);
      for (const e of run.enemies) { if (e.dead) continue; const d = Math.abs(e.x - g.x); if (d > 280) continue; if (e.boss) { e.stagger(1.6, Math.sign(e.x - g.x)); e.vuln = Math.max(e.vuln || 0, 2.5); } else e.stun(3); }
      if (Math.abs(run.player.x - g.x) < 140) run.player.flashT = 0.2;
    } else if (g.type === 'molotov') {
      run.hazards.push({ type: 'fire', x: g.x, w: 230, t: 6, dmg: g.dmg, owner: 'player' });
      for (let k = 0; k < 24; k++) IF.fx.spawn({ x: g.x + (Math.random() - 0.5) * 120, y: IF.GROUND - 10, vx: (Math.random() - 0.5) * 200, vy: -100 - Math.random() * 200, life: 0.6, size: 6 + Math.random() * 8, color: Math.random() < 0.5 ? '#ff8a20' : '#ffd040', type: 'fire', add: true, grow: -8, drag: 0.95 });
      IF.fx.sparks(g.x, g.y, 0, 6, '#cfe8ff'); IF.audio.from(g.x).molotov(); IF.fx.decal(g.x, IF.GROUND, 'scorch', 110);
    }
  },
  /* fire pools: burn every zombie standing in them; the knight takes a little if he wades in */
  updateFire(run, h, dt) {
    if (Math.random() < 0.9) IF.fx.spawn({ x: h.x + (Math.random() - 0.5) * h.w, y: IF.GROUND - 4, vx: (Math.random() - 0.5) * 30, vy: -90 - Math.random() * 120, life: 0.5 + Math.random() * 0.4, size: 7 + Math.random() * 9, color: Math.random() < 0.5 ? '#ff7a1a' : '#ffc23a', type: 'fire', add: true, grow: -10, drag: 0.97 });
    if (Math.random() < 0.15) IF.fx.spawn({ x: h.x + (Math.random() - 0.5) * h.w, y: IF.GROUND - 40, vx: 10, vy: -50, life: 2, size: 20, color: 'rgba(30,26,24,0.45)', type: 'smoke', grow: 30 });
    h.tick = (h.tick || 0) - dt; if (h.tick > 0) return; h.tick = 0.4;
    for (const e of run.enemies) if (!e.dead && Math.abs(e.x - h.x) < h.w / 2 && e.y > IF.GROUND - 40) { e.burn = 3; e.burnTick = Math.min(e.burnTick || 0.5, 0.5); e.burnDmg = Math.max(e.burnDmg || 0, h.dmg * 0.5); IF.combat.applyDot(e, h.dmg * 0.3, '#ff9a3a'); }
    const pl = run.player; if (Math.abs(pl.x - h.x) < h.w / 2 && pl.y > IF.GROUND - 20 && !pl.dead) pl.takeDamage({ x: h.x, dmg: 3, type: 'fire' });
  },

  /* a weapon-stats object for damage that isn't coming from the knight's own weapons */
  ws(run, dmg, o) {
    return { dmg, crit: o.crit || 0, critMult: 2, knock: o.knock ?? 300, perks: [], armorPierce: o.pierce || 0.3, spread: o.spread || 0, pellets: 1, pierce: 0, splash: 0, def: { cls: 'tactical', bleedBase: !!o.bleed, speed: 2200, range: 800 } };
  },

  /* ---------- 2D fallback drawing ---------- */
  draw2d(ctx, run) {
    for (const g of run.throws) { ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.rot); ctx.fillStyle = g.type === 'frag' ? '#3a4a2a' : g.type === 'stun' ? '#8a8e92' : '#3a6a3a'; if (g.type === 'molotov') { ctx.fillRect(-4, -10, 8, 16); ctx.fillStyle = '#ffa030'; ctx.fillRect(-2, -16, 4, 6); } else { ctx.beginPath(); ctx.arc(0, 0, 6, 0, 6.283); ctx.fill(); } ctx.restore(); }
    for (const tr of run.traps) { ctx.strokeStyle = '#8a8e94'; ctx.lineWidth = 3; ctx.beginPath(); if (tr.armed) { ctx.moveTo(tr.x - 22, IF.GROUND - 2); ctx.lineTo(tr.x + 22, IF.GROUND - 2); for (let i = -2; i <= 2; i++) { ctx.moveTo(tr.x + i * 8, IF.GROUND - 2); ctx.lineTo(tr.x + i * 8 + 3, IF.GROUND - 9); } } else { ctx.moveTo(tr.x - 10, IF.GROUND - 2); ctx.lineTo(tr.x, IF.GROUND - 20); ctx.lineTo(tr.x + 10, IF.GROUND - 2); } ctx.stroke(); }
    for (const a of run.allies) a.draw2d && a.draw2d(ctx);
    IF.eggs.draw2d(ctx, run);
  },
  /* HUD: the belt, bottom-left */
  drawHud(ctx, run, F) {
    const x0 = 84, y0 = 74, w = 38, h = 36;
    ctx.save(); ctx.textAlign = 'center';
    IF.TACTICAL.forEach((t, i) => {
      const x = x0 + i * (w + 4), sel = i === run.tac.sel, n = run.tac.n[t.id];
      ctx.fillStyle = sel ? 'rgba(120,16,20,0.85)' : 'rgba(14,14,16,0.68)'; ctx.fillRect(x, y0, w, h);
      ctx.strokeStyle = sel ? '#d8b25a' : 'rgba(170,170,176,0.35)'; ctx.lineWidth = sel ? 2 : 1; ctx.strokeRect(x + 0.5, y0 + 0.5, w - 1, h - 1);
      ctx.globalAlpha = n > 0 ? 1 : 0.35; ctx.fillStyle = '#e8e0cc'; ctx.font = F(17, 400); ctx.fillText(t.icon, x + w / 2 - 3, y0 + 23);
      ctx.font = F(10); ctx.fillStyle = n > 0 ? '#d8b25a' : '#888'; ctx.fillText(n, x + w - 6, y0 + h - 4); ctx.globalAlpha = 1;
    });
    const t = this.cur(run); ctx.textAlign = 'left'; ctx.font = F(10); ctx.fillStyle = 'rgba(232,224,204,0.85)';
    ctx.fillText(t.name.toUpperCase() + '  ·  ' + (IF.input.lastDevice === 'gamepad' ? 'R3 use · BACK cycle' : IF.input.lastDevice === 'touch' ? 'tap ⌖ to use, ⟳ to cycle' : 'G use · T cycle'), x0, y0 + h + 13);
    ctx.restore();
  },

  /* ---------- 3D ---------- */
  pools3d(pool, T) {
    const M = IF.kit.mats(), W = IF.wep3d.mats();
    pool('t_frag', () => { const g = new T.Group(); g.add(new T.Mesh(new T.SphereGeometry(5, 10, 8).scale(1, 1.25, 1), IF.mat.metal('#3e4a2c', 0.7, 0.4))); const s = new T.Mesh(new T.CylinderGeometry(1.6, 1.6, 4, 6), W.gunmetal); s.position.y = 6.5; g.add(s); const l = new T.Mesh(new T.BoxGeometry(1, 6, 1.5), W.gunmetal); l.position.set(2.5, 4, 0); g.add(l); return g; });
    pool('t_stun', () => { const g = new T.Group(); g.add(new T.Mesh(new T.CylinderGeometry(3.6, 3.6, 11, 10), IF.mat.metal('#8a8e92', 0.5, 0.7))); for (const y of [-3, 3]) { const r = new T.Mesh(new T.TorusGeometry(3.7, 0.5, 4, 12).rotateX(Math.PI / 2), W.gunmetal); r.position.y = y; g.add(r); } return g; });
    pool('t_molotov', () => { const g = new T.Group(); g.add(new T.Mesh(new T.CylinderGeometry(3, 4, 12, 10), IF.mat.get('bottle', () => new T.MeshStandardMaterial({ color: '#2a5a2a', roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.8 })))); const n = new T.Mesh(new T.CylinderGeometry(1.4, 2.4, 6, 8), IF.mat.get('bottle')); n.position.y = 8.5; g.add(n); const r = new T.Mesh(new T.ConeGeometry(2.4, 7, 6), IF.mat.glow('#ff9a2a', 3)); r.position.y = 14; g.add(r); return g; });
    pool('t_trap', () => {
      const g = new T.Group(), steel = IF.mat.metal('#6a6e74', 0.45, 0.9);
      g.add(new T.Mesh(new T.TorusGeometry(15, 1.2, 5, 24).rotateX(Math.PI / 2), steel)); g.add(new T.Mesh(new T.CylinderGeometry(5, 5, 1.6, 12), steel));
      const chain = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 26, 4).rotateZ(Math.PI / 2), M.iron); chain.position.set(-26, 0.5, 0); g.add(chain);
      for (const s of [-1, 1]) {
        const jaw = new T.Group(); jaw.userData.jaw = s;
        const arc = new T.Mesh(new T.TorusGeometry(15, 1, 4, 16, Math.PI), steel); arc.rotation.x = 0; jaw.add(arc);
        for (let i = 1; i < 8; i++) { const a = i / 8 * Math.PI, tooth = new T.Mesh(new T.ConeGeometry(1.4, 5, 4), steel); tooth.position.set(Math.cos(a) * 15, Math.sin(a) * 15 - 2.5, 0); tooth.rotation.z = a + Math.PI / 2; tooth.rotation.z += Math.PI; jaw.add(tooth); }
        g.add(jaw);
      }
      return g;
    });
    pool('t_eggt', () => { const g = new T.Group(); g.add(new T.Mesh(new T.SphereGeometry(9, 12, 10), IF.mat.metal('#d8b25a', 0.3, 1))); const r = new T.Mesh(new T.TorusGeometry(10, 1.4, 5, 14), IF.mat.metal('#8a6a2a', 0.4, 1)); g.add(r); return g; });
    pool('t_sentry', () => {
      const g = new T.Group(), olive = IF.mat.metal('#4a5236', 0.65, 0.4);
      for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.5, leg = new T.Mesh(new T.CylinderGeometry(1.2, 1.2, 46, 6), W.gunmetal); leg.position.set(Math.cos(a) * 12, 20, Math.sin(a) * 12); leg.lookAt(0, 44, 0); leg.rotateX(Math.PI / 2); g.add(leg); }
      const head = new T.Group(); head.position.y = 46; head.userData.head = true; g.add(head);
      const body = new T.Mesh(new T.BoxGeometry(30, 16, 18), olive); body.position.x = 2; head.add(body);
      const bar = new T.Mesh(new T.CylinderGeometry(1.4, 1.4, 34, 8).rotateZ(Math.PI / 2), W.blued); bar.position.set(32, 2, 0); head.add(bar);
      const shroud = new T.Mesh(new T.CylinderGeometry(3, 3, 14, 10).rotateZ(Math.PI / 2), W.gunmetal); shroud.position.set(22, 2, 0); head.add(shroud);
      const box = new T.Mesh(new T.BoxGeometry(12, 12, 10), olive); box.position.set(-4, -6, 13); head.add(box);
      const lens = new T.Mesh(new T.CircleGeometry(2.4, 12), IF.mat.glow('#ff3a2a', 2.5)); lens.position.set(17.1, 8, 0); lens.rotation.y = Math.PI / 2; head.add(lens);
      const shield = new T.Mesh(new T.BoxGeometry(2, 22, 26), olive); shield.position.set(14, 0, 0); head.add(shield);
      return g;
    });
  },
  render3d(fx, run) {
    const t = IF.r3.clock;
    for (const g of run.throws) { const m = fx.take('t_' + g.type); fx.place(m, g.x, g.y, 0.4); m.rotation.set(g.rot * 0.7, g.rot * 0.3, g.rot); if (g.type === 'molotov') fx.lightEmitters.push({ x: g.x, y: g.y - 10, i: 2.5, c: '#ff8a2a', r: 5 }); }
    const ET = run.world.eggTarget; if (ET && !ET.hit) { const m = fx.take('t_eggt'); fx.place(m, ET.x, ET.y, -2.0); m.rotation.y = t * 2; }
    for (const tr of run.traps) {
      const m = fx.take('t_trap'); fx.place(m, tr.x, IF.GROUND, 0.35); m.rotation.y = 0.4;
      const close = tr.armed ? 0 : Math.min(1, tr.shutT * 14); // jaws: flat open -> snapped upright
      for (const c of m.children) if (c.userData.jaw) { c.rotation.x = c.userData.jaw * (Math.PI / 2) * (1 - close) ; c.rotation.y = c.userData.jaw > 0 ? 0 : Math.PI; }
    }
    for (const a of run.allies) if (a.kind === 'sentry') {
      const m = fx.take('t_sentry'); fx.place(m, a.x, IF.GROUND, 0.2); m.visible = !a.dead || a.deadT < 1.5;
      const head = m.children.find((c) => c.userData.head); head.rotation.set(0, a.facing > 0 ? 0 : Math.PI, -a.aim);
      if (a.dead) m.rotation.z = Math.min(1, a.deadT * 3) * 0.9;
      else m.rotation.z = 0;
      if (a.flashT > 0) fx.lightEmitters.push({ x: a.x + a.facing * 40, y: IF.GROUND - 50, i: 4, c: '#ffc070', r: 6 });
    }
  },
};

/* ---------- Sentry gun (an "ally" the horde can attack) ---------- */
IF.Sentry = class Sentry {
  constructor(run, x, scale, owner) {
    this.run = run; this.kind = 'sentry'; this.owner = owner; this.isAlly = true; this.aggro = 0.8;
    this.x = x; this.y = IF.GROUND; this.w = 40; this.h = 70; this.maxHp = this.hp = Math.round(260 * (1 + run.section * 0.08) * (owner === 'engineer' ? 0.6 : 1));
    this.life = owner === 'engineer' ? 25 : 40; this.ammo = owner === 'engineer' ? 140 : 260; this.cd = 0; this.aim = 0; this.facing = run.player.facing; this.flashT = 0; this.dead = false; this.deadT = 0;
    this.ws = IF.tac.ws(run, 9 * scale, { knock: 40, spread: 0.04, crit: 0.05 });
  }
  hitbox() { return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h }; }
  takeDamage(o) { if (this.dead) return; this.hp -= o.dmg; IF.fx.sparks(this.x, this.y - 40, Math.sign(this.x - o.x) || 1, 4); IF.audio.hit && IF.audio.hit('metal'); if (this.hp <= 0) this.destroy(); }
  destroy() { this.dead = true; this.deadT = 0; IF.combat.explode(this.x, this.y - 40, 90, 40, 'player', { ws: this.ws, noSelf: true }); }
  update(dt) {
    if (this.dead) { this.deadT += dt; if (this.deadT > 2) this.remove = true; return; }
    this.life -= dt; this.cd -= dt; this.flashT -= dt;
    if (this.life <= 0 || this.ammo <= 0) { this.dead = true; this.deadT = 0.5; IF.fx.dust(this.x, IF.GROUND, 4); return; }
    let best = null, bd = 760;
    for (const e of this.run.enemies) { if (e.dead || e.state === 'rise') continue; const d = Math.abs(e.x - this.x); if (d < bd) { bd = d; best = e; } }
    if (!best) { this.aim += (0 - this.aim) * dt * 3; return; }
    this.facing = Math.sign(best.x - this.x) || this.facing;
    const tx = best.x, ty = best.y - best.h * (best.isLow ? 0.4 : 0.6), mx = this.x + this.facing * 20, my = this.y - 50;
    const want = Math.atan2(ty - my, Math.abs(tx - mx)); this.aim += (want - this.aim) * Math.min(1, dt * 10);
    if (this.cd <= 0) {
      this.cd = 1 / 7; this.ammo--; this.flashT = 0.05;
      const ang = this.facing > 0 ? this.aim : Math.PI - this.aim;
      IF.combat.fire({ crouch: false, vx: 0 }, { ws: this.ws, def: this.ws.def }, mx + Math.cos(ang) * 30, my + Math.sin(ang) * 30, ang);
      IF.fx.muzzle(mx + Math.cos(ang) * 34, my + Math.sin(ang) * 34, ang, false); if (Math.random() < 0.6) IF.audio.from(this.x).shot('smg');
    }
  }
  draw2d(ctx) {
    if (this.dead && this.deadT > 1) return;
    ctx.save(); ctx.translate(this.x, this.y); ctx.strokeStyle = '#2a2c30'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(0, -46); ctx.lineTo(14, 0); ctx.moveTo(0, -46); ctx.lineTo(0, 0); ctx.stroke();
    ctx.translate(0, -50); ctx.scale(this.facing, 1); ctx.rotate(this.aim); ctx.fillStyle = '#4a5236'; ctx.fillRect(-14, -8, 30, 16); ctx.fillStyle = '#222'; ctx.fillRect(16, -2, 30, 4); ctx.restore();
    if (this.hp < this.maxHp) { ctx.fillStyle = '#000'; ctx.fillRect(this.x - 20, this.y - 86, 40, 4); ctx.fillStyle = '#7ad07a'; ctx.fillRect(this.x - 20, this.y - 86, 40 * this.hp / this.maxHp, 4); }
  }
};
