/* Combat resolution — projectiles, damage calculation, criticals, perks, status effects, explosions. */
'use strict';

IF.combat = {
  proj: null,
  init() { this.proj = new IF.Pool(() => ({}), 260); },
  reset() { this.proj.items.forEach((p) => this.proj.release(p)); },

  /* Player firearm discharge — spawns pellets/bullets/arrows/grenades/rockets. */
  fire(player, g, x, y, ang) {
    const ws = g.ws, def = g.def, n = ws.pellets || 1;
    for (let i = 0; i < n; i++) {
      const sp = (Math.random() - 0.5) * 2 * ws.spread * (player.crouch ? 0.6 : 1) * (Math.abs(player.vx) > 200 ? 1.4 : 1);
      const a = ang + sp, spd = def.speed * (n > 1 ? 0.85 + Math.random() * 0.3 : 1);
      const p = this.proj.get();
      p.x = x; p.y = y; p.px = x; p.py = y; p.vx = Math.cos(a) * spd; p.vy = Math.sin(a) * spd; p.owner = 'player';
      p.ws = ws; p.def = def; p.life = def.range / def.speed * (def.falloff ? 1 : 1.3); p.max = p.life; p.pierce = ws.pierce; p.hit = new Set();
      p.kind = def.cls === 'bow' || def.cls === 'crossbow' ? 'arrow' : def.cls === 'gl' ? 'grenade' : def.cls === 'rl' ? 'rocket' : 'bullet';
      p.grav = def.lob ? 1100 : def.arc ? 380 : 0; if (def.lob) p.vy -= 280;
      p.dmgMult = def.cls === 'bow' ? 0.6 + 0.4 * Math.min(1, (g.draw || 1)) : 1; p.size = n > 1 ? 1.6 : def.cls === 'sniper' ? 3 : 2.2;
    }
  },
  enemyShot(x, y, ang, speed, dmg, kind) {
    const p = this.proj.get(); p.x = x; p.y = y; p.px = x; p.py = y; p.vx = Math.cos(ang) * speed; p.vy = Math.sin(ang) * speed;
    p.owner = 'enemy'; p.dmg = dmg; p.kind = kind || 'ebullet'; p.life = 2.5; p.max = 2.5; p.grav = kind === 'spit' ? 900 : kind === 'egrenade' ? 1000 : 0; p.hit = new Set(); p.pierce = 0; p.size = kind === 'spit' ? 7 : 2.5;
  },

  update(run, dt) {
    const pl = run.player;
    this.proj.forEachAlive((p) => {
      p.life -= dt; p.px = p.x; p.py = p.y; p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'rocket') { p.vx *= 1.03; if (Math.random() < 0.8) IF.fx.spawn({ x: p.x, y: p.y, vx: -p.vx * 0.05, vy: (Math.random() - 0.5) * 30, life: 0.6, size: 6, color: 'rgba(150,150,150,0.4)', type: 'smoke', grow: 20, drag: 0.95 }); IF.fx.spawn({ x: p.x, y: p.y, life: 0.08, size: 14, color: '#ffb040', type: 'glow', add: true }); }
      if (p.kind === 'grenade' && Math.random() < 0.4) IF.fx.spawn({ x: p.x, y: p.y, life: 0.4, size: 4, color: 'rgba(140,140,140,0.4)', type: 'smoke', grow: 8 });
      if (p.kind === 'spit' && Math.random() < 0.5) IF.fx.toxic(p.x, p.y, 1);
      const explosive = p.kind === 'grenade' || p.kind === 'rocket' || p.kind === 'egrenade';
      if (p.life <= 0 || p.y >= IF.GROUND) {
        if (explosive) this.explode(p.x, Math.min(p.y, IF.GROUND - 10), p.owner === 'player' ? p.ws.splash : 110, p.owner === 'player' ? this.rollDamage(p.ws, 1).dmg : p.dmg, p.owner, { ws: p.ws });
        else if (p.y >= IF.GROUND) { if (p.kind === 'spit') { run.hazards.push({ type: 'toxic', x: p.x, w: 110, t: 4, dmg: p.dmg * 0.6 }); IF.fx.decal(p.x, IF.GROUND, 'toxic', 55); } else IF.fx.dust(p.x, IF.GROUND, 1, 'rgba(150,130,110,0.4)'); }
        this.proj.release(p); return;
      }
      if (p.owner === 'player') {
        if (run.world.eggTarget) IF.eggs.checkShot(run, p);
        for (const e of run.enemies) {
          if (e.dead || p.hit.has(e)) continue;
          const hb = e.hitbox();
          if (!this.segRect(p.px, p.py, p.x, p.y, hb)) continue;
          if (explosive) { this.explode(p.x, p.y, p.ws.splash, this.rollDamage(p.ws, 1).dmg, 'player', { ws: p.ws }); this.proj.release(p); return; }
          p.hit.add(e);
          const falloff = p.def.falloff ? Math.max(0.35, p.life / p.max) : 1;
          const head = !e.isLow && p.y < hb.y + hb.h * 0.2;
          this.hitEnemy(e, { ws: p.ws, mult: falloff * p.dmgMult * (run.mods.gunMult || 1), dir: Math.sign(p.vx), x: p.x, y: p.y, bullet: true, head, stagger: p.def.cls === 'sniper' ? 1 : 0.15 });
          if (p.pierce-- <= 0) { this.proj.release(p); return; }
        }
        for (const pr of run.world.props) if (pr.hp > 0 && this.segRect(p.px, p.py, p.x, p.y, pr)) { IF.world.damageProp(run, pr, p.ws.dmg); if (explosive) this.explode(p.x, p.y, p.ws.splash, p.ws.dmg, 'player', { ws: p.ws }); IF.fx.sparks(p.x, p.y, -Math.sign(p.vx), 3); this.proj.release(p); return; }
      } else if (!pl.dead) {
        if (this.segRect(p.px, p.py, p.x, p.y, pl.hitbox())) {
          if (p.kind === 'egrenade') { this.explode(p.x, p.y, 110, p.dmg, 'enemy'); this.proj.release(p); return; }
          pl.takeDamage({ x: p.x - p.vx * 0.1, dmg: p.dmg, type: p.kind === 'spit' ? 'toxic' : 'bullet' }); this.proj.release(p); return;
        }
      }
    });
    // status effects on enemies
    for (const e of run.enemies) {
      if (e.dead) continue;
      if (e.burn > 0) { e.burn -= dt; e.burnTick -= dt; IF.fx.burnTick(e.x, e.y - e.h * 0.5); if (e.burnTick <= 0) { e.burnTick = 0.5; this.applyDot(e, e.burnDmg, '#ff9a3a'); } }
      if (e.bleed > 0) { e.bleed -= dt; e.bleedTick -= dt; if (e.bleedTick <= 0) { e.bleedTick = 0.5; this.applyDot(e, e.bleedDmg, '#c02020'); IF.fx.blood(e.x, e.y - e.h * 0.5, 0, 2); } }
    }
    // ground hazards
    for (let i = run.hazards.length - 1; i >= 0; i--) {
      const h = run.hazards[i]; h.t -= dt; if (h.t <= 0) { run.hazards.splice(i, 1); continue; }
      if (h.type === 'fire') { IF.tac.updateFire(run, h, dt); continue; }
      if (h.type === 'toxic') { if (Math.random() < 0.3) IF.fx.toxic(h.x + (Math.random() - 0.5) * h.w, IF.GROUND, 1); if (Math.abs(pl.x - h.x) < h.w / 2 && pl.y > IF.GROUND - 20) { h.tick = (h.tick || 0) - dt; if (h.tick <= 0) { h.tick = 0.5; pl.takeDamage({ x: pl.x, dmg: h.dmg, type: 'toxic', unblockable: true }); } } }
    }
  },
  segRect(x1, y1, x2, y2, r) { // swept point vs rect (sampled)
    const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 18));
    for (let i = 0; i <= steps; i++) { const x = x1 + (x2 - x1) * i / steps, y = y1 + (y2 - y1) * i / steps; if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return true; }
    return false;
  },

  rollDamage(ws, mult, target) {
    let dmg = ws.dmg * mult; const crit = Math.random() < ws.crit;
    if (crit) dmg *= ws.critMult;
    return { dmg, crit };
  },

  /* Central damage pipeline for all player damage against enemies. */
  hitEnemy(e, o) {
    if (e.dead) return;
    const run = IF.game.run, pl = run.player, ws = o.ws, P = ws.perks;
    let { dmg, crit } = this.rollDamage(ws, o.mult || 1);
    if (pl.buff('berserk')) dmg *= 1.5;
    if (o.head) dmg *= e.boss ? 1.25 : 1.4; // headshot
    dmg *= run.mods.playerDmg || 1;
    const special = e.elite || e.boss;
    if (special) dmg *= 1 + (P.includes('holy') ? 0.4 : 0) + pl.st.holyAll;
    if (P.includes('execute') && e.hp < e.maxHp * 0.3) dmg *= 1.5;
    if (e.boss) { const w = e.def.weak || {}; if (o.melee && w.melee) dmg *= w.melee; if ((P.includes('burn') || o.fire) && w.fire) dmg *= w.fire; if (o.explosive && w.explosive) dmg *= w.explosive; if (P.includes('holy') && w.holy) dmg *= w.holy; if (e.vuln > 0) dmg *= 2; }
    const armor = (e.armor || 0) * (1 - Math.min(1, ws.armorPierce || 0));
    const deflect = armor > 0.4 && !o.heavy && !crit && !o.explosive;
    dmg *= 1 - armor;
    dmg = Math.max(1, Math.round(dmg));
    e.hp -= dmg; e.hitFlash = e.boss ? 0.05 : 0.1; e.lastHitDir = o.dir;
    if (!deflect) IF.gore.onHit(e, o, dmg, e.hp <= 0);
    // feedback
    if (deflect) { IF.fx.sparks(o.x, o.y, -o.dir, 5); IF.audio.from(o.x).hit('metal'); }
    else { IF.fx.blood(o.x, o.y, o.dir, o.melee ? (o.heavy ? 14 : 8) : 4, e.def.blood); IF.audio.from(o.x).hit('flesh', crit); }
    IF.fx.text(o.x, o.y - 20, crit ? dmg + '!' : dmg, crit ? '#ffcf3a' : o.head ? '#ff9a6a' : deflect ? '#9aa4ad' : '#ffffff', crit || o.head ? 24 : 17, crit || o.head);
    if (o.head && !e.headT) { e.headT = 1; IF.fx.text(o.x, o.y - 48, 'HEADSHOT', '#ff7a4a', 14); setTimeout(() => (e.headT = 0), 600); }
    if (crit && pl.st.critExplode && !o.explosive) this.explode(o.x, o.y, 70, dmg * 0.4, 'player', { ws, noChain: true, color: '#a36bff' });
    // perks
    if (P.includes('lifesteal') || pl.buff('berserk')) pl.heal(dmg * (P.includes('lifesteal') ? 0.03 : 0) + (pl.buff('berserk') ? dmg * 0.02 : 0), true);
    if (P.includes('burn') || o.burn) { e.burn = 3; e.burnTick = 0.5; e.burnDmg = Math.max(1, ws.dmg * 0.25 / 6 * (o.mult || 1)); }
    if (P.includes('bleed') || ws.def.bleedBase) { e.bleed = 3; e.bleedTick = 0.5; e.bleedDmg = Math.max(1, ws.dmg * 0.3 / 6 * (o.mult || 1)); }
    if (P.includes('shock') && !o.chained && Math.random() < 0.25) {
      const tgt = run.enemies.find((x) => !x.dead && x !== e && Math.abs(x.x - e.x) < 260);
      if (tgt) { IF.fx.lightning(e.x, e.y - e.h / 2, tgt.x, tgt.y - tgt.h / 2); this.hitEnemy(tgt, Object.assign({}, o, { mult: (o.mult || 1) * 0.6, chained: true, x: tgt.x, y: tgt.y - tgt.h / 2 })); }
    }
    if (P.includes('explosive') && o.bullet && !o.noChain && Math.random() < 0.35) this.explode(o.x, o.y, 60, dmg * 0.3, 'player', { ws, noChain: true });
    // knockback & stagger
    const kb = (o.knockOverride || ws.knock * (o.heavy ? 1.6 : 1)) / (e.def.heavy ? 2.5 : 1) / (e.boss ? 6 : 1);
    this.knockback(e, o.dir * kb, o.stagger || 0);
    if (e.hp <= 0) e.die(o);
  },
  applyDot(e, dmg, color) { if (e.dead) return; dmg = Math.max(1, Math.round(dmg)); e.hp -= dmg; IF.fx.text(e.x, e.y - e.h - 10, dmg, color, 13); if (e.hp <= 0) e.die({ dir: 0 }); },
  knockback(e, v, stagger) { if (e.boss && Math.abs(v) < 400) v *= 0.3; e.vx += v; if (stagger) e.stagger(stagger, Math.sign(v)); },

  /* Area damage; owner 'player' damages enemies, 'enemy' damages the knight. */
  explode(x, y, r, dmg, owner, o = {}) {
    IF.fx.explosion(x, y, r); IF.audio.from(x).explosion(r / 150);
    const run = IF.game.run;
    if (owner === 'player') {
      for (const e of run.enemies) {
        if (e.dead) continue; const d = IF.util.dist(x, y, e.x, e.y - e.h / 2); if (d > r + e.w / 2) continue;
        const ws = o.ws || run.player.melee.ws;
        this.hitEnemy(e, { ws: Object.assign({}, ws, { dmg: dmg * (1 - (d / (r + 40)) * 0.5), crit: 0, knock: 520, armorPierce: 0.8, perks: o.noChain ? [] : ws.perks }), mult: 1, dir: Math.sign(e.x - x) || 1, x: e.x, y: e.y - e.h / 2, explosive: true, heavy: true, noChain: true, stagger: 1, burn: o.burn });
      }
      for (const p of run.world.props) if (p.hp > 0 && IF.util.dist(x, y, p.x + p.w / 2, p.y + p.h / 2) < r + 30) IF.world.damageProp(run, p, dmg);
      if (!o.noSelf && IF.util.dist(x, y, run.player.x, run.player.y - 70) < r * 0.6) run.player.takeDamage({ x, dmg: dmg * 0.15, type: 'blast', heavy: true });
    } else {
      if (run.allies) for (const a of run.allies) if (!a.dead && !a.down && Math.abs(a.x - x) < r + 20) a.takeDamage({ x, dmg: dmg * 0.6, type: 'blast' });
      const pl = run.player; const d = IF.util.dist(x, y, pl.x, pl.y - 70);
      if (d < r + 20) pl.takeDamage({ x, dmg: dmg * (1 - d / (r + 60) * 0.5), type: 'blast', heavy: true });
      for (const e of run.enemies) if (!e.dead && !e.boss && e !== o.source && IF.util.dist(x, y, e.x, e.y - e.h / 2) < r) { e.hp -= dmg * 0.5; this.knockback(e, Math.sign(e.x - x) * 400, 1); if (e.hp <= 0) e.die({ dir: Math.sign(e.x - x), explosive: true }); }
    }
  },

  draw(ctx) {
    this.proj.forEachAlive((p) => {
      if (p.kind === 'bullet' || p.kind === 'ebullet') {
        ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = p.owner === 'player' ? 'rgba(255,220,140,0.9)' : 'rgba(255,90,60,0.9)'; ctx.lineWidth = p.size;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.022, p.y - p.vy * 0.022); ctx.stroke(); ctx.globalCompositeOperation = 'source-over';
      } else if (p.kind === 'arrow') {
        const a = Math.atan2(p.vy, p.vx); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a); ctx.fillStyle = '#7a5a34'; ctx.fillRect(-34, -1.2, 34, 2.4); ctx.fillStyle = '#ccc'; ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(8, 0); ctx.lineTo(0, 3); ctx.fill(); ctx.fillStyle = '#ddd'; ctx.fillRect(-34, -3, 7, 6); ctx.restore();
      } else if (p.kind === 'grenade' || p.kind === 'egrenade') { ctx.fillStyle = '#3a4a2a'; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, 6.283); ctx.fill(); ctx.fillStyle = '#ff4a2a'; ctx.fillRect(p.x - 1, p.y - 6, 2, 2); }
      else if (p.kind === 'rocket') { const a = Math.atan2(p.vy, p.vx); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a); ctx.fillStyle = '#5a6a4a'; ctx.fillRect(-18, -3.5, 18, 7); ctx.fillStyle = '#9a3a24'; ctx.beginPath(); ctx.moveTo(0, -3.5); ctx.lineTo(8, 0); ctx.lineTo(0, 3.5); ctx.fill(); ctx.restore(); }
      else if (p.kind === 'spit') { ctx.fillStyle = '#9adf3a'; ctx.shadowColor = '#9adf3a'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0; }
    });
  },
};
