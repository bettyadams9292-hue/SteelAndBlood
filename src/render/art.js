/* Procedural art — articulated knight renderer, weapon renderer, shared drawing primitives.
 * Characters are 2-bone IK rigs: animation produces target positions for hands/feet and the
 * renderer solves elbows/knees, so every weapon pose and gait looks physically grounded.
 * Local space: origin at the feet, facing +x, y negative is up. */
'use strict';

IF.art = {
  /* ---------- primitives ---------- */
  ik(ax, ay, bx, by, l1, l2, bend) {
    let dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy);
    const maxD = l1 + l2 - 0.01; if (d > maxD) { dx *= maxD / d; dy *= maxD / d; d = maxD; }
    if (d < 0.01) d = 0.01;
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const mx = ax + (dx * a) / d, my = ay + (dy * a) / d;
    return { x: mx + bend * (-dy * h) / d, y: my + bend * (dx * h) / d, ex: ax + dx, ey: ay + dy };
  },
  shade(hex, amt) { // amt -1..1 darken/lighten
    const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    if (amt < 0) { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; } else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  },
  /* Metal gradient perpendicular to a segment: dark rim, mid, specular strip, mid, dark rim. */
  metalGrad(ctx, x1, y1, x2, y2, w, pal) {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const g = ctx.createLinearGradient(mx - nx * w, my - ny * w, mx + nx * w, my + ny * w);
    g.addColorStop(0, pal.dark); g.addColorStop(0.3, pal.metal); g.addColorStop(0.42, pal.light); g.addColorStop(0.55, pal.metal); g.addColorStop(1, pal.dark);
    return g;
  },
  seg(ctx, x1, y1, x2, y2, w1, w2, fill, stroke) {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    ctx.beginPath();
    ctx.moveTo(x1 + nx * w1, y1 + ny * w1); ctx.lineTo(x2 + nx * w2, y2 + ny * w2);
    ctx.arc(x2, y2, w2, Math.atan2(ny, nx), Math.atan2(ny, nx) + Math.PI, true);
    ctx.lineTo(x1 - nx * w1, y1 - ny * w1);
    ctx.arc(x1, y1, w1, Math.atan2(-ny, -nx), Math.atan2(-ny, -nx) + Math.PI, true);
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.2; ctx.stroke(); }
  },
  armourSeg(ctx, x1, y1, x2, y2, w1, w2, pal) { this.seg(ctx, x1, y1, x2, y2, w1, w2, this.metalGrad(ctx, x1, y1, x2, y2, Math.max(w1, w2), pal), 'rgba(0,0,0,0.55)'); },
  disc(ctx, x, y, r, pal) {
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, pal.light); g.addColorStop(0.45, pal.metal); g.addColorStop(1, pal.dark);
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1; ctx.stroke();
  },
  cross(ctx, x, y, s, color, thick = 0.28) {
    ctx.fillStyle = color; const t = s * thick;
    ctx.fillRect(x - t / 2, y - s * 0.55, t, s * 1.1); ctx.fillRect(x - s * 0.4, y - s * 0.22 - t / 2, s * 0.8, t);
  },
  /* Heraldic emblems for surcoat, cape and shield. */
  emblem(ctx, x, y, s, color, shape) {
    if (!shape || shape === 'cross') return this.cross(ctx, x, y, s, color);
    if (shape === 'none') return;
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = color; const r = s * 0.5;
    if (shape === 'pattee' || shape === 'maltese') {
      for (let i = 0; i < 4; i++) { ctx.save(); ctx.rotate(i * Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, -r * 0.08);
        if (shape === 'pattee') { ctx.lineTo(-r * 0.42, -r); ctx.quadraticCurveTo(0, -r * 0.88, r * 0.42, -r); }
        else { ctx.lineTo(-r * 0.5, -r); ctx.lineTo(0, -r * 0.7); ctx.lineTo(r * 0.5, -r); }
        ctx.closePath(); ctx.fill(); ctx.restore(); }
    } else if (shape === 'lorraine') { const t = s * 0.16; ctx.fillRect(-t / 2, -r * 1.05, t, r * 2.1); ctx.fillRect(-r * 0.32, -r * 0.7, r * 0.64, t); ctx.fillRect(-r * 0.5, -r * 0.2, r, t); }
    else if (shape === 'saltire') { const t = s * 0.2; ctx.rotate(Math.PI / 4); ctx.fillRect(-t / 2, -r * 1.05, t, r * 2.1); ctx.fillRect(-r * 1.05, -t / 2, r * 2.1, t); }
    ctx.restore();
  },
  // deterministic wear marks so rust/scratches don't flicker
  wear(ctx, x, y, r, amount, seed) {
    if (amount <= 0) return; let s = seed;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    ctx.save(); ctx.globalAlpha = 0.5 * amount;
    for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? '#5a3a20' : '#3d2a1a'; ctx.beginPath(); ctx.ellipse(x + (rnd() - 0.5) * r, y + (rnd() - 0.5) * r, 1.5 + rnd() * 3, 1 + rnd() * 2, rnd() * 3, 0, 6.283); ctx.fill(); }
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(x - r * 0.3, y - r * 0.2); ctx.lineTo(x + r * 0.2, y + r * 0.1); ctx.stroke();
    ctx.restore();
  },

  /* Draw something with a colour tint (hit flash, vulnerability glow) via a shared offscreen buffer.
   * Far cheaper than ctx.filter or full-body shadowBlur, and only paid while an effect is active. */
  tinted(ctx, drawFn, color, alpha) {
    if (!this._off) { this._off = document.createElement('canvas'); this._off.width = 1000; this._off.height = 1000; this._offCtx = this._off.getContext('2d'); }
    const o = this._offCtx, m = ctx.getTransform(), OX = 500, OY = 900;
    o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(0, 0, 1000, 1000); o.globalCompositeOperation = 'source-over'; o.globalAlpha = 1;
    o.setTransform(m.a, m.b, m.c, m.d, OX, OY);
    drawFn(o);
    o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'source-atop'; o.globalAlpha = alpha; o.fillStyle = color; o.fillRect(0, 0, 1000, 1000);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(this._off, m.e - OX, m.f - OY); ctx.restore();
  },

  /* ---------- knight ---------- */
  DIM: { thigh: 33, shin: 33, torso: 46, upper: 25, fore: 24, head: 13 },
  LEATHER: { metal: '#5a4330', dark: '#2e2218', light: '#7d6146', trim: '#3a2a1c', cloth: '#4a3a2a', cross: '#7e1a18', rust: 0 },
  MAIL: { metal: '#6c6e70', dark: '#3a3b3d', light: '#a0a3a6', trim: '#444', cloth: '#555', cross: '#7e1a18', rust: 0.2 },

  /* look: { helmet, chest, gauntlets, legs, boots, shield, cape } -> set palette (or null); helmStyle */
  knightLook(equippedItems) {
    const L = { helmStyle: 'mailcoif', tier: 0, glow: null, halo: false };
    for (const s of IF.ARMOUR_SLOTS) {
      const it = equippedItems[s]; const set = it ? IF.ARMOUR_SET[it.set] : null;
      L[s] = set ? set.pal : null; if (set && s === 'helmet') L.helmStyle = set.helm;
      if (set && s === 'chest') { L.tier = set.tier; L.glow = set.pal.glow || null; L.halo = !!set.pal.halo; }
      if (it) L[s + 'Rarity'] = IF.RARITY[it.rarity].index;
    }
    return this.applyAppearance(L, (IF.save && IF.save.data && IF.save.data.appearance) || {});
  },
  /* Cosmetic overrides: heraldry colours/emblem, plume, helmet style and metal finish. */
  applyAppearance(L, A) {
    const col = (k) => (A[k] && A[k] !== 'auto' ? IF.HCOLOR[A[k]] : null);
    const fin = IF.HERALDRY.finishes.find((f) => f.id === A.finish);
    L.emblem = A.emblem || 'cross';
    for (const s of IF.ARMOUR_SLOTS) {
      if (!L[s]) continue; const p = Object.assign({}, L[s]);
      if (fin && fin.pal) { Object.assign(p, fin.pal); p.rust = fin.rust || 0; }
      if (s === 'chest' || s === 'shield') { if (col('tabard')) p.cloth = col('tabard'); if (col('cross')) p.cross = col('cross'); }
      if (s === 'cape') { if (col('cape')) p.cloth = col('cape'); else if (col('tabard')) p.cloth = col('tabard'); if (col('cross')) p.cross = col('cross'); }
      if (s === 'helmet') { if (A.plume === 'none') p.plume = null; else if (col('plume')) p.plume = col('plume'); }
      p.emblem = L.emblem; L[s] = p;
    }
    if (!L.chest && col('tabard')) L.tabardOverride = col('tabard');
    if (col('cross')) L.crossOverride = col('cross');
    if (A.helm && A.helm !== 'auto') L.helmStyle = A.helm;
    return L;
  },

  drawKnight(ctx, pose, look, t) {
    const D = this.DIM, P = pose;
    const chestPal = look.chest || this.MAIL, legPal = look.legs || this.MAIL, bootPal = look.boots || this.LEATHER;
    const handPal = look.gauntlets || this.LEATHER, helmPal = look.helmet || this.MAIL;
    const cloth = look.tabardOverride || (look.chest || look.helmet || this.LEATHER).cloth || '#b3a68c', crossC = look.crossOverride || (look.chest || look.helmet || this.LEATHER).cross || '#7e1a18';
    const hipX = P.hipX, hipY = P.hipY;
    const nx = Math.sin(P.lean), ny = -Math.cos(P.lean);
    const neckX = hipX + nx * D.torso, neckY = hipY + ny * D.torso;
    const shX = hipX + nx * (D.torso - 9), shY = hipY + ny * (D.torso - 9);
    const shF = { x: shX + 5, y: shY + 1 }, shB = { x: shX - 6, y: shY - 1 };
    const kneeF = this.ik(hipX + 3, hipY, P.footF.x, P.footF.y - 5, D.thigh, D.shin, -1);
    const kneeB = this.ik(hipX - 3, hipY, P.footB.x, P.footB.y - 5, D.thigh, D.shin, -1);
    const elbF = this.ik(shF.x, shF.y, P.handF.x, P.handF.y, D.upper, D.fore, P.elbowF || 1);
    const elbB = this.ik(shB.x, shB.y, P.handB.x, P.handB.y, D.upper, D.fore, P.elbowB || 1);

    // aura for legendary sets
    if (look.glow) { ctx.save(); ctx.globalAlpha = 0.18 + 0.08 * Math.sin(t * 3); const g = ctx.createRadialGradient(hipX, hipY - 20, 10, hipX, hipY - 20, 110); g.addColorStop(0, look.glow); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(hipX - 120, hipY - 140, 240, 240); ctx.restore(); }

    // ---- cape (behind everything) ----
    if (look.cape) {
      const cp = look.cape, w = P.capeWave || 0;
      ctx.beginPath(); ctx.moveTo(shB.x - 2, shB.y - 6); ctx.lineTo(shF.x - 2, shF.y - 6);
      ctx.bezierCurveTo(hipX - 4, hipY - 10, hipX - 10 + w * 8, hipY + 30, hipX - 18 + w * 16, -10 + Math.abs(w) * 8);
      ctx.lineTo(hipX - 30 + w * 22, -6 + Math.sin(t * 5) * 3);
      ctx.lineTo(hipX - 40 + w * 26, -12 + Math.sin(t * 5 + 1) * 4);
      ctx.bezierCurveTo(hipX - 34 + w * 10, hipY + 10, shB.x - 18, shB.y + 20, shB.x - 2, shB.y - 6); ctx.closePath();
      const g = ctx.createLinearGradient(hipX - 40, 0, hipX + 6, 0); g.addColorStop(0, this.shade(cp.cloth, -0.5)); g.addColorStop(0.6, this.shade(cp.cloth, -0.25)); g.addColorStop(1, this.shade(cp.cloth, -0.4));
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = cp.trim; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(shB.x - 8, shB.y + 10); ctx.quadraticCurveTo(hipX - 22, hipY + 20, hipX - 26 + w * 18, -10); ctx.stroke();
      this.emblem(ctx, hipX - 20 + w * 10, hipY + 6, 14, this.shade(cp.cross || '#7e1a18', -0.2), look.emblem);
    }
    // ---- shield on back ----
    if (look.shield && P.shieldMode === 'back') this.drawShield(ctx, shX - 14, shY + 22, 0.85, -0.2, look.shield, look.shieldRarity, t);

    // ---- back arm ----
    this.drawArm(ctx, shB, elbB, P.handB, chestPal, handPal, true);
    // ---- back leg ----
    this.drawLeg(ctx, hipX - 3, hipY, kneeB, P.footB, legPal, bootPal, true);

    // ---- torso ----
    ctx.save(); ctx.translate(hipX, hipY); ctx.rotate(P.lean);
    // hauberk skirt beneath tabard
    ctx.fillStyle = this.MAIL.dark; ctx.beginPath(); ctx.moveTo(-15, -4); ctx.lineTo(15, -4); ctx.lineTo(17, 16); ctx.lineTo(-17, 16); ctx.closePath(); ctx.fill();
    // breastplate
    const bp = ctx.createLinearGradient(-18, 0, 18, 0); bp.addColorStop(0, chestPal.dark); bp.addColorStop(0.35, chestPal.metal); bp.addColorStop(0.55, chestPal.light); bp.addColorStop(1, chestPal.dark);
    ctx.fillStyle = bp; ctx.beginPath(); ctx.moveTo(-17, 2); ctx.lineTo(-20, -D.torso + 8); ctx.quadraticCurveTo(0, -D.torso - 5, 21, -D.torso + 8); ctx.lineTo(18, 2); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.2; ctx.stroke();
    // tabard / surcoat
    const sway = P.tabardSway || 0;
    ctx.fillStyle = cloth; ctx.beginPath();
    ctx.moveTo(-15, -D.torso + 10); ctx.lineTo(16, -D.torso + 10); ctx.lineTo(17, 4);
    ctx.lineTo(16 + sway * 6, 32); ctx.lineTo(2 + sway * 3, 28); ctx.lineTo(-1 + sway * 3, 33); ctx.lineTo(-17 + sway * 6, 31); ctx.lineTo(-16, 4); ctx.closePath(); ctx.fill();
    const tg = ctx.createLinearGradient(-14, 0, 14, 0); tg.addColorStop(0, 'rgba(0,0,0,0.38)'); tg.addColorStop(0.5, 'rgba(255,255,255,0.06)'); tg.addColorStop(1, 'rgba(0,0,0,0.3)'); ctx.fillStyle = tg; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.stroke();
    if ((look.chest && look.chest.rust) || !look.chest) { ctx.fillStyle = 'rgba(70,40,20,0.35)'; ctx.beginPath(); ctx.ellipse(6, 18, 6, 4, 0.3, 0, 6.283); ctx.ellipse(-8, 24, 4, 3, 0, 0, 6.283); ctx.fill(); }
    this.emblem(ctx, 1, -D.torso + 27, 25, crossC, look.emblem);
    // belt
    ctx.fillStyle = '#3a2817'; ctx.fillRect(-14, -2, 29, 5); ctx.fillStyle = (look.chest && look.chest.trim) || '#8a7a50'; ctx.fillRect(-2, -2.5, 6, 6);
    if (look.chest && look.chest.gold) { ctx.strokeStyle = look.chest.trim; ctx.lineWidth = 2; ctx.strokeRect(-12, -D.torso + 10, 25, D.torso + 18); }
    // gorget
    ctx.fillStyle = this.metalGrad(ctx, -10, -D.torso, 10, -D.torso, 6, helmPal); ctx.beginPath(); ctx.ellipse(1, -D.torso + 6, 12, 6, 0, 0, 6.283); ctx.fill();
    ctx.restore();

    // ---- front leg ----
    this.drawLeg(ctx, hipX + 3, hipY, kneeF, P.footF, legPal, bootPal, false);

    // ---- head / helmet ----
    const hx = neckX + nx * 9 + 1, hy = neckY + ny * 9;
    this.drawHelmet(ctx, hx, hy, look.helmStyle, helmPal, P.headTilt || 0, look, t);

    // ---- pauldron (back) drawn under front arm ----
    if (look.chest) this.drawPauldron(ctx, shB.x, shB.y, chestPal, -0.3, 0.85);

    // ---- shield in front when blocking ----
    if (look.shield && P.shieldMode === 'front') this.drawShield(ctx, P.handB.x + 6, P.handB.y - 2, 1.05, 0.05, look.shield, look.shieldRarity, t);

    // ---- weapon & front arm ----
    if (P.weaponBehind && P.drawWeapon) P.drawWeapon(ctx);
    this.drawArm(ctx, shF, elbF, P.handF, chestPal, handPal, false);
    if (!P.weaponBehind && P.drawWeapon) P.drawWeapon(ctx);
    if (P.twoHand) this.drawGauntlet(ctx, P.handB.x, P.handB.y, handPal, 0.95);
    if (look.chest) this.drawPauldron(ctx, shF.x, shF.y, chestPal, 0.2, 1);
    if (look.halo) { ctx.save(); ctx.strokeStyle = '#ffe08a'; ctx.shadowColor = '#ffd66b'; ctx.shadowBlur = 14; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(hx, hy - 26 + Math.sin(t * 2) * 1.5, 14, 4, 0, 0, 6.283); ctx.stroke(); ctx.restore(); }
  },

  drawLeg(ctx, hx, hy, knee, foot, pal, bootPal, back) {
    const d = back ? -0.18 : 0;
    const p = d ? { metal: this.shade(pal.metal, d), dark: this.shade(pal.dark, d), light: this.shade(pal.light, d) } : pal;
    this.armourSeg(ctx, hx, hy, knee.x, knee.y, 9, 7.5, p);
    this.armourSeg(ctx, knee.x, knee.y, foot.x, foot.y - 6, 7, 6, p);
    this.disc(ctx, knee.x, knee.y, 6.5, p); // poleyn
    if (pal.spikes) { ctx.fillStyle = pal.dark; ctx.beginPath(); ctx.moveTo(knee.x + 4, knee.y - 3); ctx.lineTo(knee.x + 13, knee.y); ctx.lineTo(knee.x + 4, knee.y + 3); ctx.fill(); }
    // sabaton
    const bp = d ? { metal: this.shade(bootPal.metal, d), dark: this.shade(bootPal.dark, d), light: this.shade(bootPal.light, d) } : bootPal;
    ctx.fillStyle = this.metalGrad(ctx, foot.x - 6, foot.y - 4, foot.x + 14, foot.y - 4, 6, bp);
    ctx.beginPath(); ctx.moveTo(foot.x - 7, foot.y - 10); ctx.lineTo(foot.x + 5, foot.y - 10); ctx.quadraticCurveTo(foot.x + 17, foot.y - 6, foot.x + 17, foot.y); ctx.lineTo(foot.x - 8, foot.y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; ctx.stroke();
  },
  drawArm(ctx, sh, elb, hand, pal, handPal, back) {
    const d = back ? -0.2 : 0;
    const p = d ? { metal: this.shade(pal.metal, d), dark: this.shade(pal.dark, d), light: this.shade(pal.light, d) } : pal;
    this.armourSeg(ctx, sh.x, sh.y, elb.x, elb.y, 7.5, 6.5, p);
    this.armourSeg(ctx, elb.x, elb.y, hand.x, hand.y, 6.5, 5.5, p);
    this.disc(ctx, elb.x, elb.y, 5.5, p); // couter
    this.drawGauntlet(ctx, hand.x, hand.y, handPal, back ? 0.85 : 1);
  },
  drawGauntlet(ctx, x, y, pal, k) { const p = k < 1 ? { metal: this.shade(pal.metal, -0.15), dark: pal.dark, light: this.shade(pal.light, -0.15) } : pal; this.disc(ctx, x, y, 6.2, p); },
  drawPauldron(ctx, x, y, pal, rot, k) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    const g = ctx.createRadialGradient(-3, -5, 1, 0, 0, 14 * k); g.addColorStop(0, pal.light); g.addColorStop(0.5, pal.metal); g.addColorStop(1, pal.dark);
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 13 * k, 10 * k, 0, Math.PI * 1.05, Math.PI * 2.05); ctx.quadraticCurveTo(0, 8 * k, -13 * k, 1); ctx.fill();
    ctx.strokeStyle = pal.trim || 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(0, 3, 11 * k, 7 * k, 0, Math.PI * 1.1, Math.PI * 1.95); ctx.stroke();
    if (pal.spikes) { ctx.fillStyle = pal.dark; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 6 - 2, -8); ctx.lineTo(i * 7, -18); ctx.lineTo(i * 6 + 2, -8); ctx.fill(); } }
    ctx.restore();
  },
  drawHelmet(ctx, x, y, style, pal, tilt, look, t) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.scale(1.12, 1.12);
    const g = ctx.createLinearGradient(-14, 0, 14, 0); g.addColorStop(0, pal.dark); g.addColorStop(0.35, pal.metal); g.addColorStop(0.55, pal.light); g.addColorStop(1, pal.dark);
    ctx.fillStyle = g; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 1.3;
    const slit = (y0, len) => { ctx.fillStyle = '#060606'; ctx.fillRect(-2, y0, len, 3); };
    switch (style) {
      case 'mailcoif':
        ctx.beginPath(); ctx.arc(0, -2, 13, 0, 6.283); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#c9a07a'; ctx.beginPath(); ctx.ellipse(6, 0, 6, 8, 0, 0, 6.283); ctx.fill(); ctx.fillStyle = '#222'; ctx.fillRect(7, -3, 2, 2); break;
      case 'greathelm': // flat-topped templar great helm
        ctx.beginPath(); ctx.moveTo(-13, -16); ctx.lineTo(14, -16); ctx.lineTo(15, 12); ctx.lineTo(-13, 13); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-13, -16, 27, 4);
        slit(-5, 17); ctx.fillStyle = '#060606'; for (let i = 0; i < 3; i++) ctx.fillRect(6 + i * 3, 4, 1.6, 4);
        ctx.fillStyle = pal.trim || '#6b5a3d'; ctx.fillRect(2, -16, 3, 28); ctx.fillRect(-13, -6, 28, 2.5);
        break;
      case 'sallet':
        ctx.beginPath(); ctx.moveTo(-18, 6); ctx.quadraticCurveTo(-16, -18, 4, -17); ctx.quadraticCurveTo(15, -14, 14, 0); ctx.lineTo(15, 8); ctx.lineTo(-6, 9); ctx.lineTo(-18, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
        slit(-4, 16); ctx.fillStyle = this.shade(pal.metal, -0.1); ctx.beginPath(); ctx.moveTo(2, 4); ctx.lineTo(15, 3); ctx.lineTo(13, 13); ctx.lineTo(0, 12); ctx.fill(); ctx.stroke(); break;
      case 'armet':
        ctx.beginPath(); ctx.arc(0, -3, 14, Math.PI, 0); ctx.lineTo(15, 8); ctx.quadraticCurveTo(8, 15, -4, 13); ctx.lineTo(-14, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = this.shade(pal.metal, 0.1); ctx.beginPath(); ctx.moveTo(0, -8); ctx.quadraticCurveTo(20, -6, 15, 8); ctx.lineTo(2, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
        slit(-4, 17); ctx.strokeStyle = pal.trim; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -3, 14, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); break;
      case 'spiked':
        ctx.beginPath(); ctx.moveTo(-14, 12); ctx.lineTo(-14, -10); ctx.quadraticCurveTo(0, -22, 15, -10); ctx.lineTo(16, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
        slit(-4, 18); ctx.fillStyle = '#8b2b23'; ctx.fillRect(11, -3, 6, 3);
        ctx.fillStyle = pal.dark; for (let i = 0; i < 4; i++) { const a = -2.6 + i * 0.5; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 12 - 3, Math.sin(a) * 12 - 4); ctx.lineTo(Math.cos(a) * 26, Math.sin(a) * 24 - 4); ctx.lineTo(Math.cos(a) * 12 + 3, Math.sin(a) * 12 - 4); ctx.fill(); } break;
      case 'crowned':
        ctx.beginPath(); ctx.moveTo(-13, -14); ctx.lineTo(14, -14); ctx.lineTo(15, 12); ctx.lineTo(-13, 13); ctx.closePath(); ctx.fill(); ctx.stroke(); slit(-4, 17);
        ctx.fillStyle = '#e2b23c'; ctx.beginPath(); ctx.moveTo(-14, -13); for (let i = 0; i < 5; i++) { ctx.lineTo(-14 + i * 7, -24); ctx.lineTo(-10.5 + i * 7, -15); } ctx.lineTo(15, -13); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#7a5a10'; ctx.stroke();
        ctx.fillStyle = '#c0141c'; ctx.beginPath(); ctx.arc(0, -17, 2.2, 0, 6.283); ctx.fill(); ctx.fillStyle = '#e2b23c'; ctx.fillRect(2, -14, 3, 26); break;
      case 'horned':
        ctx.beginPath(); ctx.moveTo(-14, 12); ctx.lineTo(-14, -9); ctx.quadraticCurveTo(0, -21, 15, -9); ctx.lineTo(16, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.save(); ctx.shadowColor = pal.glow; ctx.shadowBlur = 10; ctx.fillStyle = pal.glow; ctx.fillRect(-1, -4, 17, 3); ctx.restore();
        ctx.fillStyle = pal.dark; ctx.beginPath(); ctx.moveTo(-10, -12); ctx.quadraticCurveTo(-30, -18, -26, -40); ctx.quadraticCurveTo(-20, -22, -4, -16); ctx.fill();
        ctx.beginPath(); ctx.moveTo(6, -14); ctx.quadraticCurveTo(22, -24, 18, -42); ctx.quadraticCurveTo(28, -22, 12, -10); ctx.fill(); break;
      case 'halo':
        ctx.beginPath(); ctx.arc(0, -3, 14, Math.PI, 0); ctx.lineTo(15, 10); ctx.lineTo(-14, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.save(); ctx.shadowColor = '#ffd66b'; ctx.shadowBlur = 12; ctx.fillStyle = '#ffe9a8'; ctx.fillRect(-1, -4, 17, 3); ctx.restore();
        ctx.fillStyle = pal.trim; ctx.beginPath(); ctx.moveTo(-6, -16); ctx.quadraticCurveTo(-22, -30, -34, -20); ctx.quadraticCurveTo(-20, -20, -8, -10); ctx.fill(); break;
    }
    if (look && look.helmet && look.helmet.plume) { // plume
      ctx.fillStyle = look.helmet.plume; ctx.beginPath(); ctx.moveTo(-4, -16); ctx.bezierCurveTo(-10, -34, -30, -30, -36 + Math.sin(t * 6) * 3, -12); ctx.bezierCurveTo(-24, -22, -14, -20, -6, -12); ctx.fill();
    }
    if (pal.rust) this.wear(ctx, 0, -2, 18, pal.rust, 7);
    ctx.restore();
  },
  drawShield(ctx, x, y, s, rot, pal, rarity, t) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    if (rarity >= 3 && pal.glow) { ctx.shadowColor = pal.glow; ctx.shadowBlur = 14; }
    ctx.beginPath(); ctx.moveTo(-16, -24); ctx.lineTo(16, -24); ctx.lineTo(16, 2); ctx.quadraticCurveTo(14, 22, 0, 32); ctx.quadraticCurveTo(-14, 22, -16, 2); ctx.closePath();
    const g = ctx.createLinearGradient(-16, -20, 16, 20); g.addColorStop(0, this.shade(pal.cloth, 0.08)); g.addColorStop(1, this.shade(pal.cloth, -0.35));
    ctx.fillStyle = g; ctx.fill(); ctx.shadowBlur = 0;
    ctx.lineWidth = 3.5; ctx.strokeStyle = this.metalGrad(ctx, -16, 0, 16, 0, 16, pal); ctx.stroke();
    if (!pal.emblem || pal.emblem === 'cross') this.cross(ctx, 0, 0, 30, pal.cross || '#8a1a1a', 0.26); else this.emblem(ctx, 0, 0, 30, pal.cross || '#8a1a1a', pal.emblem);
    if (pal.rust) this.wear(ctx, 0, 0, 26, pal.rust, 3);
    ctx.restore();
  },

  /* ---------- weapons ----------
   * Drawn in hand space: grip at (0,0), weapon pointing along +x. */
  drawWeapon(ctx, def, rarityIndex, t, extra) {
    const L = def.look || {}; const R = IF.RARITIES[rarityIndex];
    ctx.save();
    if (rarityIndex >= 3) { ctx.shadowColor = L.glow || R.color; ctx.shadowBlur = 8 + rarityIndex * 2 + Math.sin(t * 4) * 3; }
    const metal = { metal: L.blade || '#9aa', dark: this.shade(L.blade || '#99aaaa', -0.45), light: L.edge || '#fff' };
    switch (def.cls) {
      case 'sword': case 'greatsword': {
        const len = def.len, w = def.cls === 'greatsword' ? 5.5 : 4.2, grip = def.cls === 'greatsword' ? 20 : 12;
        ctx.fillStyle = '#3a2416'; ctx.fillRect(-grip, -2.5, grip + 4, 5); ctx.fillStyle = L.guard; ctx.beginPath(); ctx.arc(-grip - 2, 0, 3.5, 0, 6.283); ctx.fill();
        ctx.fillRect(3, -11, 4, 22);
        const g = ctx.createLinearGradient(0, -w, 0, w); g.addColorStop(0, metal.dark); g.addColorStop(0.45, metal.light); g.addColorStop(0.55, metal.metal); g.addColorStop(1, metal.dark);
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(7, -w); ctx.lineTo(len - 10, -w * 0.8); ctx.lineTo(len, 0); ctx.lineTo(len - 10, w * 0.8); ctx.lineTo(7, w); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.8; ctx.stroke(); ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(len * 0.7, 0); ctx.stroke();
        break;
      }
      case 'axe': case 'greataxe': case 'halberd': {
        const len = def.len, big = def.cls !== 'axe';
        ctx.fillStyle = L.guard; ctx.fillRect(-14, -2.5, len + 10, 5);
        const hx = len - (def.cls === 'halberd' ? 22 : 8);
        const g = ctx.createLinearGradient(0, -24, 0, 24); g.addColorStop(0, metal.light); g.addColorStop(0.5, metal.metal); g.addColorStop(1, metal.dark); ctx.fillStyle = g;
        const blade = (dir) => { ctx.beginPath(); ctx.moveTo(hx - 8, 0); ctx.lineTo(hx - 10, dir * 6); ctx.quadraticCurveTo(hx - 18, dir * (big ? 26 : 20), hx + 4, dir * (big ? 30 : 24)); ctx.quadraticCurveTo(hx + 10, dir * 12, hx + 6, 0); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.stroke(); };
        blade(-1); if (def.cls === 'greataxe') blade(1);
        if (def.cls === 'halberd') { ctx.beginPath(); ctx.moveTo(hx + 4, -3); ctx.lineTo(len + 18, 0); ctx.lineTo(hx + 4, 3); ctx.fill(); ctx.beginPath(); ctx.moveTo(hx - 4, 2); ctx.lineTo(hx - 2, 14); ctx.lineTo(hx + 4, 2); ctx.fill(); }
        break;
      }
      case 'hammer': case 'mace': {
        const len = def.len; ctx.fillStyle = L.guard; ctx.fillRect(-12, -2.5, len, 5);
        const hx = len - 4;
        if (def.cls === 'hammer') { ctx.fillStyle = this.metalGrad(ctx, hx, -16, hx, 16, 10, metal); ctx.fillRect(hx - 9, -18, 18, 36); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.strokeRect(hx - 9, -18, 18, 36); ctx.fillStyle = metal.dark; ctx.beginPath(); ctx.moveTo(hx - 9, -12); ctx.lineTo(hx - 20, 0); ctx.lineTo(hx - 9, 4); ctx.fill(); }
        else {
          if (L.spikes) { ctx.fillStyle = metal.dark; for (let i = 0; i < 8; i++) { const a = i * 0.785; ctx.beginPath(); ctx.moveTo(hx + Math.cos(a) * 7 - Math.sin(a) * 3, Math.sin(a) * 7 + Math.cos(a) * 3); ctx.lineTo(hx + Math.cos(a) * 17, Math.sin(a) * 17); ctx.lineTo(hx + Math.cos(a) * 7 + Math.sin(a) * 3, Math.sin(a) * 7 - Math.cos(a) * 3); ctx.fill(); } }
          this.disc(ctx, hx, 0, 10, metal);
          if (!L.spikes) { ctx.fillStyle = metal.dark; for (let i = 0; i < 4; i++) { ctx.save(); ctx.translate(hx, 0); ctx.rotate(i * 0.785); ctx.fillRect(-2, -14, 4, 28); ctx.restore(); } }
        }
        break;
      }
      case 'spear': { const len = def.len; ctx.fillStyle = L.guard; ctx.fillRect(-30, -2.2, len + 10, 4.4); ctx.fillStyle = this.metalGrad(ctx, len, 0, len + 26, 0, 5, metal); ctx.beginPath(); ctx.moveTo(len - 20, -5); ctx.lineTo(len + 24, 0); ctx.lineTo(len - 20, 5); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.stroke(); break; }
      case 'bow': {
        ctx.strokeStyle = L.body; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(4, -46); ctx.quadraticCurveTo(26, 0, 4, 46); ctx.stroke();
        ctx.strokeStyle = '#ddd5c0'; ctx.lineWidth = 1; const pull = extra && extra.draw ? -14 * extra.draw : 0; ctx.beginPath(); ctx.moveTo(4, -46); ctx.lineTo(pull, 0); ctx.lineTo(4, 46); ctx.stroke();
        if (extra && extra.draw > 0) { ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pull, 0); ctx.lineTo(pull + 64, 0); ctx.stroke(); ctx.fillStyle = '#ccc'; ctx.beginPath(); ctx.moveTo(pull + 64, -3); ctx.lineTo(pull + 72, 0); ctx.lineTo(pull + 64, 3); ctx.fill(); }
        break;
      }
      case 'crossbow': { ctx.fillStyle = L.body; ctx.fillRect(-14, -4, 66, 8); ctx.strokeStyle = L.metal; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(44, -24); ctx.quadraticCurveTo(54, 0, 44, 24); ctx.stroke(); ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(44, -24); ctx.lineTo(extra && extra.loaded ? 20 : 40, 0); ctx.lineTo(44, 24); ctx.stroke(); if (extra && extra.loaded) { ctx.fillStyle = '#7a5a34'; ctx.fillRect(20, -1.5, 40, 3); } break; }
      default: this.drawGun(ctx, def, L, extra);
    }
    ctx.restore();
  },
  drawGun(ctx, def, L, extra) {
    const body = L.body || '#2a2c30', mt = L.metal || '#555', c = def.cls;
    const rect = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
    const st = (x, y, w, h) => { ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h); };
    const hl = (x, y, w) => rect(x, y, w, 1.5, 'rgba(255,255,255,0.18)');
    ctx.save();
    switch (c) {
      case 'pistol': rect(-4, -10, 28, 8, mt); st(-4, -10, 28, 8); hl(-3, -10, 26); rect(-4, -3, 9, 14, body); rect(3, -2, 6, 4, '#111'); break;
      case 'revolver': case 'handcannon': { const big = c === 'handcannon'; rect(-2, -10, big ? 44 : 36, big ? 7 : 5, mt); st(-2, -10, big ? 44 : 36, big ? 7 : 5); rect(-4, -12, 14, 12, mt); this.disc(ctx, 4, -5, big ? 7 : 6, { metal: mt, dark: '#222', light: '#ddd' }); ctx.fillStyle = L.grip || '#5a3a20'; ctx.beginPath(); ctx.moveTo(-6, -2); ctx.lineTo(2, -2); ctx.lineTo(-2, 14); ctx.lineTo(-10, 12); ctx.fill(); hl(0, -10, 30); break; }
      case 'smg': rect(-14, -11, 52, 10, body); st(-14, -11, 52, 10); rect(38, -8, 12, 4, mt); rect(-2, -2, 7, 12, body); rect(12, -2, 6, 18, mt); rect(-26, -9, 14, 5, mt); hl(-12, -11, 48); break;
      case 'rifle': { const tan = L.tan; rect(-30, -8, 22, 9, tan ? '#7a6a4a' : body); rect(-8, -12, 50, 11, body); st(-8, -12, 50, 11); rect(42, -9, 26, 4, mt); rect(64, -11, 3, 8, mt); rect(-4, -1, 7, 13, body); rect(14, -1, 9, 19, mt); rect(8, -17, 18, 5, '#111'); rect(30, -14, 14, 3, mt); hl(-6, -12, 46); if (L.glow) { ctx.fillStyle = L.glow; ctx.fillRect(0, -9, 36, 2); } break; }
      case 'shotgun': case 'pump': rect(-30, -8, 24, 9, body); rect(-6, -12, 34, 11, mt); st(-6, -12, 34, 11); rect(26, -11, 46, 5, mt); rect(28, -6, 34, 5, c === 'pump' ? '#6a4a2a' : body); rect(-2, -1, 7, 12, body); hl(-4, -12, 74); if (L.glow) { ctx.fillStyle = L.glow; ctx.fillRect(30, -10, 40, 1.5); } break;
      case 'dbshotgun': rect(-24, -8, 24, 9, body); rect(-2, -11, 16, 11, mt); rect(12, -12, 46, 5, mt); rect(12, -7, 46, 5, mt); st(12, -12, 46, 10); rect(16, -2, 26, 4, body); break;
      case 'sniper': rect(-36, -8, 30, 10, body); rect(-6, -11, 48, 10, body); st(-6, -11, 48, 10); rect(42, -8, 52, 4, mt); rect(90, -10, 6, 7, mt); rect(2, -22, 36, 8, '#111'); this.disc(ctx, 38, -18, 4.5, { metal: '#334', dark: '#000', light: '#7af' }); rect(-2, -1, 7, 12, body); rect(48, -4, 2, 14, mt); rect(54, -4, 2, 14, mt); break;
      case 'lmg': rect(-30, -8, 24, 10, body); rect(-6, -14, 56, 14, body); st(-6, -14, 56, 14); rect(50, -10, 36, 5, mt); rect(8, 0, 26, 14, '#3c3a2c'); rect(-2, -1, 7, 12, body); rect(4, -20, 30, 6, mt); ctx.strokeStyle = '#c9a03a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(18, 12); ctx.quadraticCurveTo(10, 22, 0, 18); ctx.stroke(); hl(-4, -14, 52); break;
      case 'minigun': { const sp = (extra && extra.spin) || 0; rect(-14, -16, 34, 22, body); st(-14, -16, 34, 22); for (let i = 0; i < 3; i++) { const yy = -12 + ((i * 6 + sp * 18) % 18); rect(20, yy, 58, 4, i === 1 ? '#888' : mt); } rect(20, -14, 6, 20, '#222'); rect(70, -14, 5, 20, '#222'); rect(-4, 6, 10, 10, body); break; }
      case 'gl': rect(-22, -8, 20, 10, body); rect(-2, -14, 24, 14, body); this.disc(ctx, 12, -7, 11, { metal: mt, dark: '#111', light: '#888' }); rect(22, -12, 36, 10, mt); st(22, -12, 36, 10); rect(-2, 0, 7, 12, body); break;
      case 'rl': rect(-40, -16, 120, 16, body); st(-40, -16, 120, 16); rect(-46, -18, 8, 20, mt); rect(76, -18, 8, 20, mt); rect(0, 0, 8, 12, '#222'); rect(18, 0, 8, 14, '#222'); rect(10, -26, 20, 10, '#111'); if (extra && extra.loaded) { ctx.fillStyle = '#9a3a24'; ctx.beginPath(); ctx.moveTo(84, -14); ctx.lineTo(96, -8); ctx.lineTo(84, -2); ctx.fill(); } break;
    }
    ctx.restore();
  },
  /* Where the off hand goes on each weapon (hand space), and the muzzle offset. */
  GRIP: {
    pistol: { off: [2, 2], muzzle: [26, -6] }, revolver: { off: [0, 3], muzzle: [36, -7] }, handcannon: { off: [0, 3], muzzle: [44, -7] },
    smg: { off: [15, 6], muzzle: [52, -6] }, rifle: { off: [18, 8], muzzle: [70, -7] }, shotgun: { off: [40, -3], muzzle: [74, -8] }, pump: { off: [40, -3], muzzle: [74, -8] },
    dbshotgun: { off: [28, 0], muzzle: [60, -7] }, sniper: { off: [50, 2], muzzle: [96, -6] }, lmg: { off: [44, -4], muzzle: [88, -7] }, minigun: { off: [0, 10], muzzle: [80, -4] },
    gl: { off: [36, -2], muzzle: [58, -7] }, rl: { off: [22, 4], muzzle: [86, -8] }, crossbow: { off: [30, 4], muzzle: [60, 0] }, bow: { off: [0, 0], muzzle: [20, 0] },
  },
};
