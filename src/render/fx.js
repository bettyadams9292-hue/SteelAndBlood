/* Visual effects — pooled particles, ground decals, damage numbers, screen shake, hit-stop, flashes. */
'use strict';

IF.fx = {
  parts: null, texts: null, decals: [], shake: 0, shakeX: 0, shakeY: 0, hitstop: 0, flash: 0, flashColor: '#fff', vignettePulse: 0,
  MAX_DECALS: 90,
  init() {
    this.parts = new IF.Pool(() => ({}), 900);
    this.texts = new IF.Pool(() => ({}), 80);
  },
  reset() { this.parts.items.forEach((p) => this.parts.release(p)); this.texts.items.forEach((p) => this.texts.release(p)); this.decals.length = 0; this.shake = 0; this.hitstop = 0; this.flash = 0; },
  quality() { const q = IF.save.data.settings.particles; return q === 'low' ? 0.35 : q === 'medium' ? 0.65 : 1; },

  spawn(o) {
    if (this.parts.aliveCount > 850) return null;
    const p = this.parts.get();
    p.x = o.x; p.y = o.y; p.vx = o.vx || 0; p.vy = o.vy || 0; p.life = p.max = o.life || 0.6; p.size = o.size || 3; p.color = o.color || '#fff';
    p.type = o.type || 'dot'; p.grav = o.grav ?? 0; p.drag = o.drag ?? 0.98; p.rot = o.rot || 0; p.vr = o.vr || 0; p.add = !!o.add; p.grow = o.grow || 0; p.front = o.front ?? true; p.bounce = o.bounce || 0; p.z = o.z;
    return p;
  },
  blood(x, y, dir, amount, color) {
    const gl = IF.save.data.settings.gore || 'full'; if (gl === 'off') return;
    const n = Math.round(amount * this.quality() * (gl === 'reduced' ? 0.4 : 1.35));
    for (let i = 0; i < n; i++) this.spawn({ x, y, vx: dir * (60 + Math.random() * 320) + (Math.random() - 0.5) * 120, vy: -80 - Math.random() * 260, life: 0.5 + Math.random() * 0.6, size: 1.5 + Math.random() * 3.5, color: color || (Math.random() < 0.5 ? '#6a0d0d' : '#8e1212'), type: 'blood', grav: 1200, drag: 0.99 });
    if (Math.random() < 0.6) this.spawn({ x, y, vx: dir * 40, vy: -20, life: 0.35, size: 10 + amount, color: color || '#7a1010', type: 'mist', grow: 50, drag: 0.9 });
  },
  sparks(x, y, dir, n, color) {
    n = Math.round(n * this.quality());
    for (let i = 0; i < n; i++) { const a = (dir > 0 ? 0 : Math.PI) + (Math.random() - 0.5) * 1.8; const s = 200 + Math.random() * 500; this.spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 100, life: 0.15 + Math.random() * 0.25, size: 1.5, color: color || '#ffd27a', type: 'spark', grav: 900, add: true }); }
  },
  muzzle(x, y, angle, big) {
    const s = big ? 1.6 : 1;
    this.spawn({ x, y, life: 0.06, size: 22 * s, color: '#ffd27a', type: 'flash', add: true, rot: angle });
    this.spawn({ x, y, life: 0.08, size: 60 * s, color: 'rgba(255,170,60,0.5)', type: 'glow', add: true });
    for (let i = 0; i < 2 * this.quality(); i++) this.spawn({ x, y, vx: Math.cos(angle) * 60 + (Math.random() - 0.5) * 40, vy: -30 - Math.random() * 40, life: 0.6 + Math.random() * 0.5, size: 5 * s, color: 'rgba(160,160,160,0.35)', type: 'smoke', grow: 26, drag: 0.94 });
  },
  shell(x, y, dir, big) { if (this.quality() < 0.5) return; this.spawn({ x, y, vx: -dir * (80 + Math.random() * 90), vy: -220 - Math.random() * 120, life: 1.4, size: big ? 4 : 3, color: big ? '#b02a1a' : '#d9b24c', type: 'shell', grav: 1300, vr: (Math.random() - 0.5) * 30, bounce: 0.4, drag: 0.995 }); },
  explosion(x, y, r) {
    const q = this.quality();
    this.spawn({ x, y, life: 0.14, size: r * 1.3, color: '#fff3c0', type: 'glow', add: true });
    this.spawn({ x, y, life: 0.5, size: r * 0.4, color: 'rgba(255,200,120,0.9)', type: 'ring', grow: r * 3.2, add: true });
    for (let i = 0; i < 26 * q; i++) { const a = Math.random() * 6.283, s = 100 + Math.random() * r * 3; this.spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, life: 0.4 + Math.random() * 0.5, size: 6 + Math.random() * 10, color: Math.random() < 0.5 ? '#ff9a2a' : '#ffcf5a', type: 'fire', add: true, drag: 0.9, grow: -8 }); }
    for (let i = 0; i < 16 * q; i++) { const a = Math.random() * 6.283, s = 40 + Math.random() * r * 1.4; this.spawn({ x: x + Math.cos(a) * r * 0.3, y: y + Math.sin(a) * r * 0.3, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: 1.2 + Math.random() * 1.2, size: 14 + Math.random() * 18, color: 'rgba(40,36,34,0.6)', type: 'smoke', grow: 40, drag: 0.93 }); }
    for (let i = 0; i < 12 * q; i++) this.spawn({ x, y, vx: (Math.random() - 0.5) * 900, vy: -200 - Math.random() * 600, life: 1.2, size: 2 + Math.random() * 4, color: '#2a2420', type: 'debris', grav: 1400, vr: 10, bounce: 0.3 });
    this.sparks(x, y, 1, 10); this.sparks(x, y, -1, 10);
    this.decal(x, IF.GROUND, 'scorch', r * 0.9);
    this.addShake(Math.min(26, r / 7)); this.flash = 0.25; this.flashColor = '#ffd9a0';
  },
  ring(x, y, r, color, life = 0.45) { this.spawn({ x, y, life, size: 10, grow: r * 2.2, color, type: 'ring', add: true }); },
  dust(x, y, n, color) { n = Math.round(n * this.quality()); for (let i = 0; i < n; i++) this.spawn({ x: x + (Math.random() - 0.5) * 30, y, vx: (Math.random() - 0.5) * 160, vy: -20 - Math.random() * 50, life: 0.5 + Math.random() * 0.4, size: 5 + Math.random() * 6, color: color || 'rgba(120,105,90,0.35)', type: 'smoke', grow: 20, drag: 0.92 }); },
  toxic(x, y, n) { n = Math.round(n * this.quality()); for (let i = 0; i < n; i++) this.spawn({ x: x + (Math.random() - 0.5) * 40, y: y - Math.random() * 20, vx: (Math.random() - 0.5) * 60, vy: -30 - Math.random() * 60, life: 0.9 + Math.random() * 0.6, size: 6 + Math.random() * 8, color: 'rgba(150,220,60,0.3)', type: 'smoke', grow: 18, drag: 0.95, add: true }); },
  burnTick(x, y) { if (Math.random() < 0.5 * this.quality()) this.spawn({ x: x + (Math.random() - 0.5) * 20, y, vx: (Math.random() - 0.5) * 30, vy: -80 - Math.random() * 80, life: 0.4, size: 4 + Math.random() * 4, color: Math.random() < 0.5 ? '#ff7a1a' : '#ffc23a', type: 'fire', add: true, grow: -6, drag: 0.96 }); },
  lightning(x1, y1, x2, y2) {
    const pts = [[x1, y1]], n = 7; for (let i = 1; i < n; i++) pts.push([x1 + (x2 - x1) * i / n + (Math.random() - 0.5) * 20, y1 + (y2 - y1) * i / n + (Math.random() - 0.5) * 30]); pts.push([x2, y2]);
    const p = this.spawn({ x: x1, y: y1, life: 0.18, type: 'bolt', color: '#9ad8ff', add: true }); if (p) p.pts = pts;
  },
  decal(x, y, kind, size) {
    if (this.decals.length >= this.MAX_DECALS) this.decals.shift();
    this.decals.push({ x, y, kind, size: size || 8 + Math.random() * 10, rot: Math.random() * 6, a: 1, seed: Math.random() });
  },
  text(x, y, str, color, size, crit) {
    if (!IF.save.data.settings.dmgNumbers && !crit && typeof str === 'number') return;
    const t = this.texts.get(); t.x = x + (Math.random() - 0.5) * 16; t.y = y; t.vy = -90 - (crit ? 40 : 0); t.life = t.max = crit ? 0.95 : 0.7; t.str = String(str); t.color = color || '#fff'; t.size = size || 18; t.crit = crit;
  },
  addShake(v) { if (IF.save.data.settings.shake) this.shake = Math.min(30, Math.max(this.shake, v)); },

  update(dt) {
    this.shake *= Math.pow(0.0015, dt); if (this.shake < 0.3) this.shake = 0;
    this.shakeX = (Math.random() - 0.5) * this.shake * 2; this.shakeY = (Math.random() - 0.5) * this.shake * 2;
    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.parts.forEachAlive((p) => {
      p.life -= dt; if (p.life <= 0) { this.parts.release(p); return; }
      p.vy += p.grav * dt; const dr = Math.pow(p.drag, dt * 60); p.vx *= dr; p.vy *= dr;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.size = Math.max(0.5, p.size + p.grow * dt);
      if (p.grav && p.y > IF.GROUND - 2) {
        if (p.type === 'blood') { if (Math.random() < 0.25) this.decal(p.x, IF.GROUND, 'blood', 4 + Math.random() * 7); this.parts.release(p); return; }
        if (p.bounce) { p.y = IF.GROUND - 2; p.vy *= -p.bounce; p.vx *= 0.6; p.vr *= 0.6; if (p.type === 'shell' && Math.abs(p.vy) > 60) IF.audio.casing(); }
      }
    });
    this.texts.forEachAlive((t) => { t.life -= dt; if (t.life <= 0) { this.texts.release(t); return; } t.y += t.vy * dt; t.vy *= Math.pow(0.05, dt); });
  },
  drawDecals(ctx, camX) {
    for (const d of this.decals) {
      if (d.x < camX - 100 || d.x > camX + IF.W + 100) continue;
      if (d.kind === 'blood') { ctx.fillStyle = 'rgba(70,8,8,0.75)'; ctx.beginPath(); ctx.ellipse(d.x, d.y + 1, d.size * 1.6, d.size * 0.32, 0, 0, 6.283); ctx.fill(); }
      else if (d.kind === 'scorch') { const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.size); g.addColorStop(0, 'rgba(10,8,6,0.75)'); g.addColorStop(1, 'rgba(10,8,6,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(d.x, d.y + 2, d.size, d.size * 0.18, 0, 0, 6.283); ctx.fill(); }
      else if (d.kind === 'pool') { const g = ctx.createRadialGradient(d.x, d.y + 2, 0, d.x, d.y + 2, d.size * 1.8); g.addColorStop(0, 'rgba(70,4,4,0.92)'); g.addColorStop(0.7, 'rgba(60,4,4,0.85)'); g.addColorStop(1, 'rgba(50,4,4,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(d.x, d.y + 2, d.size * 1.8, d.size * 0.3, 0, 0, 6.283); ctx.fill(); ctx.fillStyle = 'rgba(255,120,120,0.12)'; ctx.beginPath(); ctx.ellipse(d.x - d.size * 0.4, d.y + 1, d.size * 0.5, d.size * 0.06, 0, 0, 6.283); ctx.fill(); }
      else if (d.kind === 'toxic') { ctx.fillStyle = 'rgba(120,190,40,0.35)'; ctx.beginPath(); ctx.ellipse(d.x, d.y + 1, d.size, d.size * 0.2, 0, 0, 6.283); ctx.fill(); }
    }
  },
  drawParts(ctx, front) {
    let addMode = false;
    const setAdd = (a) => { if (a !== addMode) { ctx.globalCompositeOperation = a ? 'lighter' : 'source-over'; addMode = a; } };
    this.parts.forEachAlive((p) => {
      if (p.front !== front) return;
      const k = p.life / p.max; setAdd(p.add);
      switch (p.type) {
        case 'blood': ctx.fillStyle = p.color; ctx.globalAlpha = 1; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); break;
        case 'mist': ctx.globalAlpha = k * 0.4; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.283); ctx.fill(); break;
        case 'spark': ctx.globalAlpha = k; ctx.strokeStyle = p.color; ctx.lineWidth = p.size; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02); ctx.stroke(); break;
        case 'flash': ctx.globalAlpha = k; ctx.fillStyle = p.color; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.beginPath(); ctx.moveTo(0, -p.size * 0.25); ctx.lineTo(p.size, 0); ctx.lineTo(0, p.size * 0.25); ctx.lineTo(p.size * 0.3, 0); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.arc(0, 0, p.size * 0.3, 0, 6.283); ctx.fill(); ctx.restore(); break;
        case 'glow': { ctx.globalAlpha = k; const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size); g.addColorStop(0, p.color); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2); break; }
        case 'smoke': ctx.globalAlpha = Math.min(1, k * 1.5); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.283); ctx.fill(); break;
        case 'fire': case 'ember': ctx.globalAlpha = k; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, 6.283); ctx.fill(); break;
        case 'ring': ctx.globalAlpha = k; ctx.strokeStyle = p.color; ctx.lineWidth = 3 + 6 * k; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.size, p.size * 0.45, 0, 0, 6.283); ctx.stroke(); break;
        case 'shell': case 'debris': ctx.globalAlpha = Math.min(1, k * 3); ctx.fillStyle = p.color; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.size, -p.size * 0.4, p.size * 2, p.size * 0.8); ctx.restore(); break;
        case 'bolt': ctx.globalAlpha = k; ctx.strokeStyle = p.color; ctx.lineWidth = 3; ctx.shadowColor = '#5af'; ctx.shadowBlur = 10; ctx.beginPath(); p.pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.stroke(); ctx.shadowBlur = 0; break;
        default: ctx.globalAlpha = k; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size);
      }
    });
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  },
  drawTexts(ctx) {
    ctx.textAlign = 'center';
    this.texts.forEachAlive((t) => {
      const k = t.life / t.max, pop = t.crit ? 1 + Math.max(0, (k - 0.75) * 3) : 1;
      ctx.globalAlpha = Math.min(1, k * 2.5);
      ctx.font = (t.crit ? '900 ' : '700 ') + Math.round(t.size * pop) + 'px Cinzel, Georgia, serif';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText(t.str, t.x, t.y); ctx.fillStyle = t.color; ctx.fillText(t.str, t.x, t.y);
    });
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
  },
};
