/* Gore system: wounds, dismemberment, decapitation, gibbing, arterial spurts, guts and blood pools.
 * Controlled by Settings > Gore (full / reduced / off). Bosses only take wounds; they are never dismembered. */
'use strict';

IF.gore = {
  gibs: [], MAX_GIBS: 70,
  BLADES: { sword: 1, greatsword: 1, axe: 1, greataxe: 1, halberd: 1, spear: 0.4 },
  BLUNT: { hammer: 1, mace: 1 },
  level() { return (IF.save.data.settings.gore || 'full'); },
  reset() { this.gibs.length = 0; },

  /* Called by the damage pipeline after damage is applied. `lethal` = this hit killed it. */
  onHit(e, o, dmg, lethal) {
    const lvl = this.level(); if (lvl === 'off') return;
    // wounds: stored in the zombie's local space so they move with it
    const lx = ((o.x - e.x) * e.facing) / (e.scale || 1), ly = (o.y - e.y) / (e.scale || 1);
    e.wounds = e.wounds || [];
    if (e.wounds.length < 7) e.wounds.push({ x: IF.util.clamp(lx, -16, 16), y: IF.util.clamp(ly, -130, -10), r: 3 + Math.min(6, dmg / 12), seed: Math.random() });
    e.bleedOut = Math.min(4, (e.bleedOut || 0) + 0.6);
    if (lvl !== 'full' || e.boss) return;
    const cls = o.ws && o.ws.def ? o.ws.def.cls : '', blade = this.BLADES[cls] || 0, blunt = this.BLUNT[cls];
    const big = dmg > e.maxHp * 0.3, heavy = o.heavy || o.explosive;
    if (lethal) {
      if (o.explosive) { e.gibOnDeath = true; return; }
      if (o.head && blunt) { e.headPop = true; return; }
      if (o.head || (blade && heavy && Math.random() < 0.35) || (cls === 'sniper' && o.head !== false && Math.random() < 0.5) || (cls === 'handcannon' && Math.random() < 0.3)) { if (!e.isLow) { e.decap = true; return; } }
      if (blade && heavy && Math.random() < 0.5) { e.gutted = true; }
      if ((blade || o.ws.pellets > 1) && Math.random() < (heavy ? 0.55 : 0.3)) this.severRandom(e, o, true);
      return;
    }
    // non-lethal dismemberment: the zombie keeps coming, maimed
    const chance = (blade ? 0.22 : 0.08) * (heavy ? 2 : 1) * (big ? 1.6 : 0.6) + (o.ws.pellets > 1 && Math.abs(o.x - IF.game.run.player.x) < 200 ? 0.12 : 0);
    if (Math.random() < chance) this.severRandom(e, o, false);
  },
  severRandom(e, o, lethal) {
    if (e.isLow || e.boss) return;
    e.lost = e.lost || {};
    const opts = [];
    if (!e.lost.armF) opts.push('armF'); if (!e.lost.armB) opts.push('armB');
    const lowHit = (o.y - e.y) > -e.h * 0.35;
    if (!e.lost.legs && (lowHit || Math.random() < 0.25)) opts.push('legs', 'legs');
    if (!opts.length) return;
    this.sever(e, opts[Math.floor(Math.random() * opts.length)], o.dir || -e.facing);
  },
  sever(e, part, dir) {
    e.lost = e.lost || {}; if (e.lost[part]) return; e.lost[part] = true;
    const S = e.scale || 1, f = e.facing;
    const at = part === 'legs' ? { x: e.x, y: e.y - 40 * S } : part === 'head' ? { x: e.x + f * 12 * S, y: e.y - e.h * 0.92 } : { x: e.x + f * (part === 'armF' ? 14 : 4) * S, y: e.y - e.h * 0.66 };
    this.spawnGib(part === 'legs' ? 'leg' : part === 'head' ? 'head' : 'arm', at.x, at.y, dir, e);
    if (part === 'legs') { this.spawnGib('leg', at.x - f * 8, at.y, dir * 0.6, e); e.legless = true; e.h = 46; e.w = 66; e.speed *= 0.45; e.vy = -120; }
    if (part === 'armF' || part === 'armB') e.dmg *= 0.7;
    e.spurts = e.spurts || []; e.spurts.push({ part, t: part === 'head' ? 2.4 : 1.6 });
    IF.fx.blood(at.x, at.y, dir, 22); IF.fx.decal(at.x + dir * 30, IF.GROUND, 'blood', 16);
    IF.audio.hit('flesh', true); IF.fx.addShake(3);
  },
  /* Death effects decided by onHit (gib / decap / head pop / guts). */
  onDeath(e, o) {
    const lvl = this.level(); if (lvl === 'off') return;
    // blood pool that spreads out under the corpse
    IF.fx.decals.push({ x: e.x, y: IF.GROUND, kind: 'pool', size: 4, grow: (e.boss ? 90 : 34) * (e.scale || 1), a: 1, seed: Math.random() });
    if (IF.fx.decals.length > IF.fx.MAX_DECALS) IF.fx.decals.shift();
    if (lvl !== 'full' || e.boss) return;
    const dir = (o && o.dir) || -e.facing || 1;
    if (e.gibOnDeath || (o && o.explosive) || e.def.explode) { this.gib(e, dir); return; }
    if (e.decap) this.sever(e, 'head', dir);
    if (e.headPop) { e.lost = e.lost || {}; e.lost.head = true; const hx = e.x + e.facing * 12, hy = e.y - e.h * 0.92; for (let i = 0; i < 6; i++) this.spawnGib(i < 2 ? 'skull' : 'chunk', hx, hy, dir + (Math.random() - 0.5) * 2, e); IF.fx.blood(hx, hy, dir, 30); e.spurts = (e.spurts || []).concat([{ part: 'head', t: 2 }]); }
    if (e.gutted) { e.gutsOut = true; for (let i = 0; i < 2; i++) this.spawnGib('guts', e.x, e.y - e.h * 0.45, dir * 0.5, e); IF.fx.blood(e.x, e.y - e.h * 0.45, dir, 18); }
  },
  /* Explode a zombie into pieces. */
  gib(e, dir) {
    e.gibbed = true; const S = e.scale || 1, cx = e.x, cy = e.y - e.h * 0.5;
    if (!e.isLow) { this.spawnGib('head', cx, e.y - e.h * 0.9, dir + (Math.random() - 0.5), e); this.spawnGib('arm', cx, cy - 20 * S, dir + 0.6, e); this.spawnGib('arm', cx, cy - 20 * S, -dir * 0.4, e); }
    this.spawnGib('leg', cx, e.y - 30 * S, dir * 0.5, e); if (!e.legless) this.spawnGib('leg', cx, e.y - 30 * S, -dir * 0.6, e);
    this.spawnGib('torso', cx, cy, dir * 0.4, e);
    for (let i = 0; i < 7; i++) this.spawnGib(['chunk', 'chunk', 'rib', 'guts', 'chunk'][i % 5], cx, cy, (Math.random() - 0.5) * 3, e);
    IF.fx.blood(cx, cy, dir, 40); IF.fx.blood(cx, cy, -dir, 20);
    for (let i = 0; i < 4; i++) IF.fx.decal(cx + (Math.random() - 0.5) * 220, IF.GROUND, 'blood', 10 + Math.random() * 14);
  },
  spawnGib(kind, x, y, dir, e) {
    if (this.gibs.length >= this.MAX_GIBS) this.gibs.shift();
    const sp = kind === 'chunk' || kind === 'skull' ? 1.3 : 1;
    this.gibs.push({ kind, x, y, vx: dir * (120 + Math.random() * 300) * sp + (Math.random() - 0.5) * 120, vy: -(260 + Math.random() * 380) * sp, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14, life: 14, e, look: e.def.look, s: (e.scale || 1) * (kind === 'chunk' ? 0.6 + Math.random() * 0.7 : 1), seed: Math.random(), ground: false, bleed: 1.2 });
  },

  update(run, dt) {
    for (let i = this.gibs.length - 1; i >= 0; i--) {
      const g = this.gibs[i]; g.life -= dt; if (g.life <= 0) { this.gibs.splice(i, 1); continue; }
      if (!g.ground) {
        g.vy += 1900 * dt; g.x += g.vx * dt; g.y += g.vy * dt; g.rot += g.vr * dt;
        if (g.bleed > 0 && Math.random() < 0.6) IF.fx.spawn({ x: g.x, y: g.y, vx: (Math.random() - 0.5) * 40, vy: 0, life: 0.6, size: 2 + Math.random() * 2, color: '#7a0c0c', type: 'blood', grav: 1200 });
        const floor = IF.GROUND - 4;
        if (g.y >= floor) { g.y = floor; if (Math.abs(g.vy) > 220) { g.vy *= -0.3; g.vx *= 0.55; g.vr *= 0.5; IF.fx.decal(g.x, IF.GROUND, 'blood', 6 + Math.random() * 8); } else { g.ground = true; g.vy = 0; g.rot = Math.round(g.rot / Math.PI) * Math.PI + (g.kind === 'arm' || g.kind === 'leg' ? 0.08 : g.rot % 0.5); IF.fx.decal(g.x, IF.GROUND, 'blood', 10); } }
      } else { g.bleed -= dt; if (g.bleed > 0 && Math.random() < 0.2) IF.fx.spawn({ x: g.x, y: g.y, vx: (Math.random() - 0.5) * 20, vy: -10, life: 0.4, size: 2, color: '#6a0a0a', type: 'blood', grav: 900 }); }
    }
    // arterial spurts from fresh stumps (alive or dead zombies)
    for (const e of run.enemies) {
      if (!e.spurts || !e.spurts.length) continue;
      for (let i = e.spurts.length - 1; i >= 0; i--) {
        const s = e.spurts[i]; s.t -= dt; if (s.t <= 0) { e.spurts.splice(i, 1); continue; }
        const pulse = Math.sin(s.t * 18) > 0.2 ? 1 : 0.25, S = e.scale || 1, f = e.facing;
        const p = e.dead ? { x: e.x - f * (e.deathDir === f ? -1 : 1) * e.h * 0.7, y: IF.GROUND - 12 } : s.part === 'head' ? { x: e.x + f * 10 * S, y: e.y - e.h * 0.84 } : s.part === 'legs' ? { x: e.x - f * 30, y: e.y - 14 } : { x: e.x + f * (s.part === 'armF' ? 12 : 2) * S, y: e.y - e.h * 0.68 };
        if (Math.random() < 0.8 * pulse * IF.fx.quality()) IF.fx.spawn({ x: p.x, y: p.y, vx: (s.part === 'head' ? f * 40 : -f * 120) * (0.5 + Math.random()) , vy: -(s.part === 'head' ? 320 : 160) * pulse * (0.6 + Math.random() * 0.6), life: 0.8, size: 2 + Math.random() * 3, color: Math.random() < 0.5 ? '#8a0e0e' : '#6a0808', type: 'blood', grav: 1300, drag: 0.995 });
      }
    }
    // pools spread
    for (const d of IF.fx.decals) if (d.grow && d.size < d.grow) d.size += dt * 14;
  },

  /* ---------- drawing ---------- */
  draw(ctx, camX) {
    const A = IF.art;
    for (const g of this.gibs) {
      if (g.x < camX - 100 || g.x > camX + IF.VIEW_W + 100) continue;
      const L = g.look, a = Math.min(1, g.life / 1.5);
      ctx.save(); ctx.globalAlpha = a; ctx.translate(g.x, g.y); ctx.rotate(g.rot); ctx.scale(g.s, g.s);
      const skin = { metal: L.skin, dark: L.skinDark, light: A.shade(L.skin, 0.2) };
      const stump = (x, y, r) => { ctx.fillStyle = '#7a0c0c'; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.8, 0, 0, 6.283); ctx.fill(); ctx.fillStyle = '#e8dcc0'; ctx.beginPath(); ctx.arc(x, y, r * 0.35, 0, 6.283); ctx.fill(); };
      switch (g.kind) {
        case 'arm': A.seg(ctx, -22, 0, 0, 2, 6, 5.5, L.shirt, 'rgba(0,0,0,.5)'); A.seg(ctx, 0, 2, 22, 0, 5.5, 4.5, A.metalGrad(ctx, 0, 2, 22, 0, 5, skin), 'rgba(0,0,0,.5)'); ctx.fillStyle = L.skin; ctx.beginPath(); ctx.arc(26, 0, 5, 0, 6.283); ctx.fill(); ctx.strokeStyle = '#2a2620'; ctx.lineWidth = 1.5; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(29, i * 3); ctx.lineTo(35, i * 4 + 2); ctx.stroke(); } stump(-24, 0, 6); break;
        case 'leg': A.seg(ctx, -28, 0, 0, 0, 8, 7, L.pants, 'rgba(0,0,0,.5)'); A.seg(ctx, 0, 0, 26, 0, 7, 6, A.shade(L.pants, -0.15), 'rgba(0,0,0,.5)'); ctx.fillStyle = '#1d1814'; ctx.fillRect(24, -6, 10, 16); stump(-30, 0, 8); break;
        case 'head': case 'skull':
          if (g.kind === 'head' && g.e) { g.e._head(ctx, 0, 0, L, { head: 0, jaw: 0.6 }, 1); ctx.fillStyle = '#7a0c0c'; ctx.beginPath(); ctx.ellipse(0, 13, 7, 4, 0, 0, 6.283); ctx.fill(); ctx.fillStyle = '#e8dcc0'; ctx.fillRect(-2, 11, 4, 4); }
          else { ctx.fillStyle = '#d8ccb0'; ctx.beginPath(); ctx.arc(0, 0, 7, Math.PI * 0.1, Math.PI * 1.3); ctx.lineTo(0, 0); ctx.fill(); ctx.fillStyle = '#7a0c0c'; ctx.beginPath(); ctx.arc(1, 1, 5, 0, 6.283); ctx.fill(); }
          break;
        case 'torso': ctx.fillStyle = L.shirt; ctx.beginPath(); ctx.ellipse(0, 0, 22, 14, 0, 0, 6.283); ctx.fill(); ctx.fillStyle = '#6a0a0a'; ctx.beginPath(); ctx.ellipse(-14, 0, 9, 11, 0, 0, 6.283); ctx.fill(); this.drawRibs(ctx, -8, -6, 0.8); stump(18, -4, 7); break;
        case 'chunk': ctx.fillStyle = g.seed < 0.5 ? '#8a1414' : '#a8505a'; ctx.beginPath(); for (let i = 0; i < 7; i++) { const an = i / 7 * 6.283, r = 5 + ((g.seed * 97 + i * 13) % 5); ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r * 0.75); } ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(255,220,220,0.25)'; ctx.beginPath(); ctx.arc(-2, -2, 2, 0, 6.283); ctx.fill(); break;
        case 'rib': ctx.strokeStyle = '#e2d6bc'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 8, 12, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); ctx.fillStyle = '#7a0c0c'; ctx.beginPath(); ctx.arc(-10, 2, 2.5, 0, 6.283); ctx.fill(); break;
        case 'guts': this.drawGuts(ctx, 0, 0, 1, g.seed); break;
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  },
  drawGuts(ctx, x, y, k, seed) {
    ctx.save(); ctx.translate(x, y); ctx.lineCap = 'round';
    const path = () => { ctx.beginPath(); ctx.moveTo(0, 0); for (let i = 1; i <= 6; i++) ctx.quadraticCurveTo(i * 7 * k - 5, (i % 2 ? 9 : -4) * k + seed * 4, i * 7 * k, (i % 2 ? 4 : 0) * k); };
    ctx.strokeStyle = '#5a1018'; ctx.lineWidth = 7 * k; path(); ctx.stroke();
    ctx.strokeStyle = '#b4566a'; ctx.lineWidth = 4.5 * k; path(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,200,210,0.35)'; ctx.lineWidth = 1.2 * k; path(); ctx.stroke();
    ctx.restore();
  },
  drawRibs(ctx, x, y, k) { ctx.strokeStyle = '#e2d6bc'; ctx.lineWidth = 1.8 * k; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x + 6 * k, y + i * 5 * k, 8 * k, Math.PI * 0.75, Math.PI * 1.25); ctx.stroke(); } },
  /* Wounds on a living/dead zombie, drawn in its local (unscaled) space. */
  drawWounds(ctx, e) {
    if (!e.wounds || this.level() === 'off') return;
    for (const w of e.wounds) {
      ctx.fillStyle = '#4a0606'; ctx.beginPath(); ctx.ellipse(w.x, w.y, w.r, w.r * 0.7, w.seed * 3, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#8e1212'; ctx.beginPath(); ctx.ellipse(w.x - 0.5, w.y - 0.5, w.r * 0.6, w.r * 0.4, w.seed * 3, 0, 6.283); ctx.fill();
      ctx.fillStyle = 'rgba(110,8,8,0.8)'; ctx.fillRect(w.x - 1, w.y, 2, w.r * 2 + w.seed * 10); // drip
    }
  },
};
