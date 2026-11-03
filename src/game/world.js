/* Endless world — section generation, encounters, props/platforms, pickups, biome rendering.
 * Only the current section exists in memory; the next is generated at the gate, so the world is
 * unbounded with constant memory. Biome backdrops are pre-rendered once into cached layers. */
'use strict';

IF.world = {
  layerCache: {},

  biomeFor(section) { return IF.BIOMES[Math.floor((section - 1) / IF.SECTIONS_PER_BIOME) % IF.BIOMES.length]; },

  /* Build section `n` starting at world x `start`. */
  generate(run, n, start) {
    const rng = run.rng, mode = run.mode, biome = this.biomeFor(n);
    const isBoss = n % mode.bossEvery === 0;
    const len = isBoss ? 1700 : mode.shortSections ? 1800 : 2500 + Math.min(1800, n * 70);
    const W = { section: n, biome, isBoss, start, end: start + len, leftBound: start - 40, rightBound: start + len, gateX: start + len - 60, gateOpen: false,
      props: [], platforms: [], triggers: [], pickups: [], fg: [], gateWave: false, bossSpawned: false };
    // props & platforms
    let x = start + 500;
    while (x < W.end - 450) {
      const type = rng.pick(biome.props);
      const p = this.makeProp(type, x, rng);
      if (p) { W.props.push(p); if (p.platform) W.platforms.push({ x: p.x + 4, y: p.y + (p.platOff || 0), w: p.w - 8 }); }
      x += 260 + rng.next() * 520;
    }
    // explosive barrels
    const nb = rng.int(1, 3); for (let i = 0; i < nb; i++) W.props.push(this.makeProp('xbarrel', start + 600 + rng.next() * (len - 1100), rng));
    // foreground silhouettes for depth
    for (let fx = start - 200; fx < W.end + 400; fx += 300 + rng.next() * 500) W.fg.push({ x: fx, kind: rng.int(0, 2), s: 0.8 + rng.next() * 0.6 });
    // encounters
    if (!isBoss) {
      const waves = 3 + Math.min(4, Math.floor(n / 4));
      for (let i = 0; i < waves; i++) W.triggers.push({ x: start + 250 + (len - 900) * (i / waves), fired: false, size: this.waveSize(n, mode, rng) });
      W.gateTrigger = { x: W.gateX - 650, fired: false };
    }
    // a supply cache mid-section
    W.pickups.push(this.pickup('ammo', start + len * 0.5 + rng.next() * 200));
    if (rng.chance(0.5)) W.pickups.push(this.pickup('health', start + len * 0.65));
    return W;
  },
  waveSize(n, mode, rng) { return Math.round((3 + n * 0.55 + rng.next() * 2) * mode.enemyMult); },
  rollEnemy(run) {
    const n = run.section, biome = run.world.biome, rng = run.rng;
    const pool = IF.ENEMIES.filter((e) => e.depth <= n).map((e) => {
      let w = e.weight; if (e.id === 'military') w *= 1 + biome.military * 4; if (e.elite) w *= 1 + n * 0.04;
      if (run.mods.forceEnemy === e.id) w *= 6; if (run.mods.forceEnemy === 'brute' && e.id === 'armoured') w *= 4;
      if (e.id === 'walker') w *= Math.max(0.35, 1 - n * 0.03);
      return { w, v: e.id };
    });
    return rng.weighted(pool);
  },
  pickup(kind, x, extra) { return Object.assign({ kind, x, y: IF.GROUND - 14, vy: 0, t: 0, alive: true }, extra || {}); },

  makeProp(type, x, rng) {
    const G = IF.GROUND, d = { type, x, seed: rng.int(0, 9999), hp: 0 };
    const S = { // w, h, platform?, hp (destructible)
      cart: [120, 58, true], barrel: [34, 46, false, 30], crate: [62, 58, true, 60], fence: [140, 40], well: [70, 64, true], log: [130, 30, true],
      stump: [40, 30], rock: [70, 34, true], rubble: [110, 40, true], banner: [30, 160], brazier: [30, 70], car: [170, 62, true], barrier: [110, 44, true],
      tyres: [50, 34, true], cone: [20, 30], sandbags: [120, 42, true], jeep: [180, 74, true], wire: [130, 32], bus: [300, 110, true], hydrant: [20, 30],
      tank: [260, 96, true], crater: [140, 10], container: [240, 120, true], pallet: [80, 22, true], locker: [40, 90], gurney: [90, 44, true], barricade: [120, 70, true],
      barrels: [80, 46, true, 50], xbarrel: [34, 48, false, 20],
    }[type];
    if (!S) return null;
    d.w = S[0]; d.h = S[1]; d.y = G - d.h; d.platform = !!S[2]; d.hp = S[3] || 0; d.maxHp = d.hp; d.destructible = !!S[3];
    if (type === 'xbarrel') d.explosive = true;
    if (type === 'wire') d.slow = true;
    if (type === 'car' || type === 'jeep') d.platOff = 10;
    return d;
  },
  damageProp(run, p, dmg) {
    if (!p.destructible || p.hp <= 0) return;
    p.hp -= dmg; IF.fx.sparks(p.x + p.w / 2, p.y + p.h / 2, 1, 3, '#d0b080'); IF.audio.hit('metal');
    if (p.hp <= 0) {
      if (p.explosive) { setTimeout(() => IF.combat.explode(p.x + p.w / 2, p.y + p.h / 2, 170, 110 + run.section * 8, 'player', { noSelf: false, burn: true }), 60); }
      for (let i = 0; i < 10; i++) IF.fx.spawn({ x: p.x + p.w / 2, y: p.y + p.h / 2, vx: (Math.random() - 0.5) * 500, vy: -200 - Math.random() * 300, life: 1, size: 4 + Math.random() * 5, color: '#5a4128', type: 'debris', grav: 1400, vr: 8, bounce: 0.3 });
      if (p.platform) run.world.platforms = run.world.platforms.filter((q) => !(q.x === p.x + 4));
      if (!p.explosive && Math.random() < 0.5) run.world.pickups.push(this.pickup(Math.random() < 0.5 ? 'ammo' : 'gold', p.x + p.w / 2, { amount: 10 + run.section * 2 }));
    }
  },

  /* ---------------- rendering ---------------- */
  getLayers(biome) {
    if (this.layerCache[biome.id]) return this.layerCache[biome.id];
    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    const rng = new IF.RNG(IF.hashString(biome.id));
    const sky = mk(IF.W, IF.H), far = mk(2048, IF.H), mid = mk(2048, IF.H);
    this.paintSky(sky.getContext('2d'), biome, rng);
    this.paintLayer(far.getContext('2d'), biome.far, biome, rng, 0.45, 2048);
    this.paintLayer(mid.getContext('2d'), biome.mid, biome, rng, 0.62, 2048);
    const L = { sky, far, mid }; this.layerCache[biome.id] = L;
    // keep cache bounded
    const keys = Object.keys(this.layerCache); if (keys.length > 4) delete this.layerCache[keys[0]];
    return L;
  },
  paintSky(ctx, b, rng) {
    const g = ctx.createLinearGradient(0, 0, 0, IF.H); g.addColorStop(0, b.sky[0]); g.addColorStop(0.55, b.sky[1]); g.addColorStop(1, b.sky[2]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, IF.W, IF.H);
    if (!b.indoor) {
      // blood moon
      const mx = 860 + rng.next() * 200, my = 150 + rng.next() * 40, mr = 70 + rng.next() * 25;
      let mg = ctx.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 3.2); mg.addColorStop(0, 'rgba(200,40,30,0.45)'); mg.addColorStop(1, 'rgba(120,10,10,0)'); ctx.fillStyle = mg; ctx.fillRect(0, 0, IF.W, IF.H);
      mg = ctx.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.1, mx, my, mr); mg.addColorStop(0, '#e8704a'); mg.addColorStop(0.7, '#a8241c'); mg.addColorStop(1, '#6a1010');
      ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, mr, 0, 6.283); ctx.fill();
      ctx.fillStyle = 'rgba(80,10,10,0.35)'; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(mx + (rng.next() - 0.5) * mr * 1.3, my + (rng.next() - 0.5) * mr * 1.3, 4 + rng.next() * 12, 0, 6.283); ctx.fill(); }
      // cloud banks
      for (let i = 0; i < 26; i++) { const cx = rng.next() * IF.W, cy = 40 + rng.next() * 300, cw = 120 + rng.next() * 260; ctx.fillStyle = 'rgba(' + (i % 2 ? '30,14,14' : '70,24,20') + ',' + (0.12 + rng.next() * 0.2) + ')'; ctx.beginPath(); ctx.ellipse(cx, cy, cw, 18 + rng.next() * 26, 0, 0, 6.283); ctx.fill(); }
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 0; y < IF.H; y += 90) ctx.fillRect(0, y, IF.W, 3);
    }
  },
  /* Silhouette layers. `dark` = how much to darken toward black for depth. */
  paintLayer(ctx, kind, b, rng, dark, W) {
    const base = IF.art.shade(b.ground, -dark * 0.4), G = IF.GROUND;
    const col = (k) => IF.art.shade(b.groundTop, -dark - k);
    const top = kind === 'hills' || kind === 'pines' || kind === 'smoke' ? 0 : 0;
    ctx.fillStyle = col(0);
    const bumpy = (y0, amp, freq) => { ctx.beginPath(); ctx.moveTo(0, IF.H); for (let x = 0; x <= W; x += 16) ctx.lineTo(x, y0 + Math.sin(x * freq) * amp + Math.sin(x * freq * 2.7 + 1) * amp * 0.4); ctx.lineTo(W, IF.H); ctx.fill(); };
    const win = (x, y, w, h, lit) => { ctx.fillStyle = lit ? 'rgba(255,150,70,' + (0.3 + rng.next() * 0.4) + ')' : 'rgba(0,0,0,0.5)'; ctx.fillRect(x, y, w, h); };
    switch (kind) {
      case 'hills': bumpy(420, 30, 0.004); ctx.fillStyle = col(0.15); bumpy(470, 20, 0.007); break;
      case 'pines': ctx.fillStyle = col(0.05); for (let x = -40; x < W + 40; x += 22 + rng.next() * 28) { const h = 160 + rng.next() * 220, y = G - 60; ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x - h * 0.18, y); ctx.lineTo(x + h * 0.18, y); ctx.fill(); } ctx.fillRect(0, G - 70, W, 200); break;
      case 'castle': bumpy(470, 18, 0.005); for (let x = 60; x < W; x += 420 + rng.next() * 300) { const h = 170 + rng.next() * 120, w = 70; ctx.fillStyle = col(0.05); ctx.fillRect(x, G - 120 - h, w, h + 120); for (let i = 0; i < 4; i++) ctx.fillRect(x - 6 + i * 22, G - 132 - h, 14, 14); ctx.fillRect(x + w, G - 120 - h * 0.45, 200, h * 0.45 + 120); for (let i = 0; i < 9; i++) ctx.fillRect(x + w + i * 22, G - 132 - h * 0.45, 12, 14); ctx.beginPath(); ctx.moveTo(x - 10, G - 120 - h); ctx.lineTo(x + w / 2, G - 210 - h); ctx.lineTo(x + w + 10, G - 120 - h); ctx.fill(); win(x + 28, G - 60 - h, 10, 22, rng.chance(0.5)); } break;
      case 'overpass': bumpy(480, 10, 0.003); ctx.fillStyle = col(0.05); ctx.fillRect(0, 330, W, 34); for (let x = 100; x < W; x += 360) ctx.fillRect(x, 364, 40, 240); ctx.fillStyle = col(0.15); ctx.fillRect(0, 322, W, 8); for (let x = 0; x < W; x += 30) ctx.fillRect(x, 300, 4, 22); break;
      case 'skyline': for (let x = 0; x < W; x += 50 + rng.next() * 70) { const h = 150 + rng.next() * 300, w = 50 + rng.next() * 80; ctx.fillStyle = col(rng.next() * 0.1); ctx.beginPath(); ctx.moveTo(x, G); ctx.lineTo(x, G - h); ctx.lineTo(x + w * 0.4, G - h + rng.next() * 40); ctx.lineTo(x + w * 0.7, G - h - 10 + rng.next() * 60); ctx.lineTo(x + w, G - h + 30); ctx.lineTo(x + w, G); ctx.fill(); for (let wy = G - h + 40; wy < G - 60; wy += 26) for (let wx = x + 8; wx < x + w - 10; wx += 16) if (rng.chance(0.12)) win(wx, wy, 7, 10, rng.chance(0.4)); } break;
      case 'smoke': bumpy(450, 25, 0.005); for (let i = 0; i < 8; i++) { const sx = rng.next() * W; const g = ctx.createLinearGradient(sx, 120, sx, G); g.addColorStop(0, 'rgba(30,24,20,0)'); g.addColorStop(1, 'rgba(30,24,20,0.6)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(sx - 20, G); ctx.quadraticCurveTo(sx - 60, 300, sx - 140 + rng.next() * 60, 100); ctx.lineTo(sx + 60, 100); ctx.quadraticCurveTo(sx + 20, 300, sx + 30, G); ctx.fill(); } break;
      case 'hangars': bumpy(500, 6, 0.003); ctx.fillStyle = col(0.05); for (let x = 40; x < W; x += 380 + rng.next() * 200) { ctx.beginPath(); ctx.moveTo(x, G); ctx.lineTo(x, G - 140); ctx.quadraticCurveTo(x + 140, G - 260, x + 280, G - 140); ctx.lineTo(x + 280, G); ctx.fill(); } break;
      case 'chimneys': bumpy(490, 8, 0.004); for (let x = 30; x < W; x += 200 + rng.next() * 260) { ctx.fillStyle = col(0.05); const h = 200 + rng.next() * 200; ctx.fillRect(x, G - h, 36, h); ctx.fillRect(x - 60, G - 140, 160, 140); ctx.fillStyle = 'rgba(255,120,40,0.4)'; ctx.fillRect(x + 6, G - h + 10, 24, 4); } break;
      case 'bunkerwall': case 'labwall': ctx.fillStyle = col(0); ctx.fillRect(0, 60, W, IF.H); ctx.fillStyle = col(0.15); for (let x = 0; x < W; x += 160) { ctx.fillRect(x, 60, 8, IF.H); } for (let y = 120; y < G; y += 110) ctx.fillRect(0, y, W, 6); if (kind === 'labwall') for (let x = 40; x < W; x += 320) { ctx.fillStyle = 'rgba(80,255,200,0.12)'; ctx.fillRect(x, 200, 180, 120); ctx.strokeStyle = col(0.3); ctx.lineWidth = 6; ctx.strokeRect(x, 200, 180, 120); } else for (let x = 80; x < W; x += 400) { ctx.fillStyle = 'rgba(120,255,160,0.3)'; ctx.fillRect(x, 100, 60, 8); } break;
      // ---- mid layers ----
      case 'cottages': for (let x = 0; x < W; x += 260 + rng.next() * 240) { const w = 130 + rng.next() * 80, h = 90 + rng.next() * 50; ctx.fillStyle = col(0); ctx.fillRect(x, G - h, w, h); ctx.beginPath(); ctx.moveTo(x - 14, G - h); ctx.lineTo(x + w / 2, G - h - 70 - rng.next() * 30); ctx.lineTo(x + w + 14, G - h); ctx.fill(); if (rng.chance(0.4)) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.moveTo(x + w * 0.6, G - h - 30); ctx.lineTo(x + w * 0.9, G - h); ctx.lineTo(x + w * 0.5, G - h); ctx.fill(); } win(x + 20, G - h + 25, 18, 22, rng.chance(0.3)); win(x + w - 40, G - h + 25, 18, 22, rng.chance(0.2)); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x + w / 2 - 12, G - 46, 24, 46); } break;
      case 'deadtrees': for (let x = 0; x < W; x += 120 + rng.next() * 200) { const h = 200 + rng.next() * 160; ctx.strokeStyle = col(0); ctx.lineCap = 'round'; const branch = (bx, by, len, ang, wd) => { if (wd < 1 || len < 8) return; const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len; ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke(); branch(ex, ey, len * 0.72, ang - 0.4 - rng.next() * 0.3, wd * 0.62); branch(ex, ey, len * 0.68, ang + 0.35 + rng.next() * 0.3, wd * 0.6); }; branch(x, G, h * 0.42, -Math.PI / 2 + (rng.next() - 0.5) * 0.2, 14); } break;
      case 'ramparts': ctx.fillStyle = col(0); ctx.fillRect(0, G - 150, W, 150); for (let x = 0; x < W; x += 40) ctx.fillRect(x, G - 172, 24, 24); for (let x = 100; x < W; x += 500) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.moveTo(x, G); ctx.lineTo(x, G - 90); ctx.arc(x + 40, G - 90, 40, Math.PI, 0); ctx.lineTo(x + 80, G); ctx.fill(); ctx.fillStyle = col(0); } for (let x = 300; x < W; x += 700) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.moveTo(x, G - 172); ctx.lineTo(x + 120, G - 40); ctx.lineTo(x + 180, G - 172); ctx.fill(); } break;
      case 'billboards': for (let x = 60; x < W; x += 600 + rng.next() * 300) { ctx.fillStyle = col(0); ctx.fillRect(x + 50, G - 220, 10, 220); ctx.fillRect(x + 150, G - 220, 10, 220); ctx.fillRect(x, G - 320, 220, 110); ctx.fillStyle = 'rgba(160,40,30,0.25)'; ctx.fillRect(x + 10, G - 310, 200, 90); } for (let x = 0; x < W; x += 140) { ctx.fillStyle = col(0.1); ctx.fillRect(x, G - 180, 5, 180); ctx.fillRect(x - 20, G - 180, 40, 4); } break;
      case 'watchtowers': for (let x = 100; x < W; x += 700) { ctx.fillStyle = col(0); ctx.fillRect(x, G - 260, 10, 260); ctx.fillRect(x + 70, G - 260, 10, 260); ctx.fillRect(x - 15, G - 300, 110, 50); ctx.beginPath(); ctx.moveTo(x - 25, G - 300); ctx.lineTo(x + 40, G - 340); ctx.lineTo(x + 105, G - 300); ctx.fill(); ctx.fillStyle = 'rgba(255,255,200,0.15)'; ctx.beginPath(); ctx.moveTo(x + 40, G - 280); ctx.lineTo(x + 340, G); ctx.lineTo(x + 200, G); ctx.fill(); } ctx.fillStyle = col(0.1); ctx.fillRect(0, G - 90, W, 4); for (let x = 0; x < W; x += 60) ctx.fillRect(x, G - 100, 4, 100); break;
      case 'ruins': for (let x = 0; x < W; x += 180 + rng.next() * 200) { const h = 120 + rng.next() * 200, w = 90 + rng.next() * 80; ctx.fillStyle = col(0); ctx.beginPath(); ctx.moveTo(x, G); ctx.lineTo(x, G - h); for (let i = 1; i <= 5; i++) ctx.lineTo(x + w * i / 5, G - h + rng.next() * 60 * (i % 2)); ctx.lineTo(x + w, G); ctx.fill(); for (let wy = G - h + 30; wy < G - 30; wy += 34) for (let wx = x + 10; wx < x + w - 20; wx += 26) win(wx, wy, 12, 16, rng.chance(0.08)); } break;
      case 'trenches': ctx.fillStyle = col(0); bumpy(G - 50, 14, 0.01); for (let x = 0; x < W; x += 50 + rng.next() * 80) { ctx.strokeStyle = col(0.1); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, G - 40); ctx.lineTo(x + (rng.next() - 0.5) * 30, G - 110 - rng.next() * 40); ctx.stroke(); } break;
      case 'fences': for (let x = 0; x < W; x += 80) { ctx.fillStyle = col(0.05); ctx.fillRect(x, G - 150, 5, 150); } ctx.strokeStyle = col(0.1); ctx.lineWidth = 1; for (let y = G - 150; y < G; y += 12) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); } for (let x = 0; x < W; x += 12) { ctx.beginPath(); ctx.moveTo(x, G - 150); ctx.lineTo(x + 30, G); ctx.stroke(); } break;
      case 'pipes': ctx.fillStyle = col(0); for (let i = 0; i < 4; i++) { const y = 260 + i * 70; ctx.fillRect(0, y, W, 16); } for (let x = 0; x < W; x += 260) { ctx.fillRect(x, 240, 26, 400); ctx.fillStyle = 'rgba(255,120,40,0.35)'; ctx.fillRect(x + 4, 330, 18, 4); ctx.fillStyle = col(0); } break;
      case 'bunkerpipes': ctx.fillStyle = col(0); ctx.fillRect(0, 60, W, 30); for (let x = 0; x < W; x += 340) { ctx.fillRect(x, 90, 18, 500); ctx.fillStyle = 'rgba(120,255,160,0.5)'; ctx.fillRect(x + 40, 150, 24, 8); ctx.fillStyle = col(0); } break;
      case 'tanks': for (let x = 60; x < W; x += 300) { ctx.fillStyle = col(0); ctx.fillRect(x, G - 220, 90, 220); ctx.fillStyle = 'rgba(70,255,200,0.18)'; ctx.fillRect(x + 10, G - 210, 70, 170); ctx.fillStyle = 'rgba(40,60,50,0.7)'; ctx.beginPath(); ctx.ellipse(x + 45, G - 120, 18, 40, 0, 0, 6.283); ctx.fill(); } break;
      case 'shacks': for (let x = 0; x < W; x += 160 + rng.next() * 150) { const w = 100 + rng.next() * 60, h = 70 + rng.next() * 40; ctx.fillStyle = col(0); ctx.fillRect(x, G - h, w, h); ctx.beginPath(); ctx.moveTo(x - 8, G - h); ctx.lineTo(x + w + 8, G - h - 18); ctx.lineTo(x + w + 8, G - h + 4); ctx.fill(); win(x + 14, G - h + 18, 16, 14, rng.chance(0.25)); } break;
      default: bumpy(470, 20, 0.004);
    }
  },

  drawBackground(ctx, run, camX, t) {
    const b = run.world.biome, L = this.getLayers(b);
    ctx.drawImage(L.sky, 0, 0);
    const tile = (img, par, y) => { const off = -((camX * par) % 2048 + 2048) % 2048; ctx.drawImage(img, off, y); ctx.drawImage(img, off + 2048, y); };
    tile(L.far, 0.12, -40);
    // distant fog band (soft-edged)
    const fm = run.mods.fog || 1, fogCol = (a) => b.fog.replace(/[\d.]+\)$/, Math.min(0.85, a * fm) + ')');
    const fa = parseFloat(b.fog.match(/[\d.]+\)$/)[0]);
    let fg = ctx.createLinearGradient(0, 250, 0, 620); fg.addColorStop(0, fogCol(0)); fg.addColorStop(0.55, fogCol(fa * 1.4)); fg.addColorStop(1, fogCol(fa * 0.6));
    ctx.fillStyle = fg; ctx.fillRect(0, 250, IF.W, 370);
    tile(L.mid, 0.38, 0);
    fg = ctx.createLinearGradient(0, 400, 0, 620); fg.addColorStop(0, fogCol(0)); fg.addColorStop(1, fogCol(fa * 0.9));
    ctx.fillStyle = fg; ctx.fillRect(0, 400, IF.W, 220);
    // moving fog wisps
    ctx.save(); ctx.globalAlpha = 0.18 * fm; for (let i = 0; i < 5; i++) { const fx = ((i * 420 - camX * 0.6 + t * 12 * (i % 2 ? 1 : -1)) % 2100 + 2100) % 2100 - 400; const g = ctx.createRadialGradient(fx, 520, 10, fx, 520, 320); g.addColorStop(0, b.fog.replace(/[\d.]+\)$/, '0.9)')); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(fx - 320, 360, 640, 300); } ctx.restore();
  },
  drawGround(ctx, run, camX) {
    const b = run.world.biome, G = IF.GROUND;
    const g = ctx.createLinearGradient(0, G, 0, IF.H); g.addColorStop(0, b.groundTop); g.addColorStop(0.15, b.ground); g.addColorStop(1, IF.art.shade(b.ground, -0.5));
    ctx.fillStyle = g; ctx.fillRect(camX - 10, G, IF.W + 20, IF.H - G);
    // texture: deterministic stones / grass / cracks
    const s0 = Math.floor(camX / 40) - 1;
    for (let i = s0; i < s0 + IF.W / 40 + 3; i++) {
      const h = IF.hashString('g' + i), x = i * 40 + (h % 30);
      ctx.fillStyle = 'rgba(0,0,0,' + (0.15 + (h % 7) / 40) + ')'; ctx.fillRect(x, G + 6 + (h % 50), 10 + (h % 26), 3);
      if (!b.indoor && h % 3 === 0) { ctx.strokeStyle = IF.art.shade(b.groundTop, 0.08); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, G + 1); ctx.lineTo(x - 3, G - 6 - (h % 8)); ctx.moveTo(x + 3, G + 1); ctx.lineTo(x + 5, G - 5 - (h % 6)); ctx.stroke(); }
      if (b.indoor && h % 4 === 0) { ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(i * 40, G, 2, 120); }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(camX - 10, G, IF.W + 20, 2);
  },
  drawProps(ctx, run, camX, t) {
    for (const p of run.world.props) { if (p.x + p.w < camX - 50 || p.x > camX + IF.W + 50) continue; if (p.hp <= 0 && p.destructible) { this.drawWreck(ctx, p); continue; } this.drawProp(ctx, p, t); }
  },
  drawWreck(ctx, p) { ctx.fillStyle = 'rgba(30,24,20,0.8)'; ctx.beginPath(); ctx.ellipse(p.x + p.w / 2, IF.GROUND - 3, p.w * 0.6, 6, 0, 0, 6.283); ctx.fill(); },
  drawProp(ctx, p, t) {
    const A = IF.art, x = p.x, y = p.y, w = p.w, h = p.h, G = IF.GROUND;
    const metal = (c) => ({ metal: c, dark: A.shade(c, -0.5), light: A.shade(c, 0.35) });
    const box = (bx, by, bw, bh, c, edge) => { const g = ctx.createLinearGradient(bx, by, bx, by + bh); g.addColorStop(0, A.shade(c, 0.15)); g.addColorStop(1, A.shade(c, -0.35)); ctx.fillStyle = g; ctx.fillRect(bx, by, bw, bh); ctx.strokeStyle = edge || 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.5; ctx.strokeRect(bx, by, bw, bh); };
    const wheel = (cx, r) => { ctx.fillStyle = '#121212'; ctx.beginPath(); ctx.arc(cx, G - r, r, 0, 6.283); ctx.fill(); ctx.fillStyle = '#3a3a3a'; ctx.beginPath(); ctx.arc(cx, G - r, r * 0.45, 0, 6.283); ctx.fill(); };
    const rnd = (k) => ((p.seed * 9301 + k * 49297) % 233280) / 233280;
    switch (p.type) {
      case 'crate': box(x, y, w, h, '#6a4a2a'); ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y + h); ctx.moveTo(x + w, y); ctx.lineTo(x, y + h); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(x, y, w, 3); break;
      case 'barrel': case 'xbarrel': { const c = p.explosive ? '#8a1e14' : '#4a5a3a'; box(x, y, w, h, c); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x, y + 10, w, 3); ctx.fillRect(x, y + h - 13, w, 3); if (p.explosive) { ctx.fillStyle = '#f0c040'; ctx.beginPath(); ctx.moveTo(x + w / 2, y + 16); ctx.lineTo(x + w / 2 + 8, y + 30); ctx.lineTo(x + w / 2 - 8, y + 30); ctx.fill(); ctx.fillStyle = '#000'; ctx.fillRect(x + w / 2 - 1, y + 20, 2, 6); } break; }
      case 'barrels': for (let i = 0; i < 2; i++) { box(x + i * 40, y, 36, h, '#3a4a5a'); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x + i * 40, y + 12, 36, 3); } break;
      case 'cart': box(x + 6, y + 6, w - 12, 28, '#5a3e22'); wheel(x + 28, 20); wheel(x + w - 28, 20); ctx.fillStyle = '#3a2a18'; ctx.fillRect(x + w - 6, y + 20, 40, 5); ctx.fillStyle = 'rgba(120,100,70,0.6)'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + 6, w * 0.38, 12, 0, Math.PI, 0); ctx.fill(); break;
      case 'fence': ctx.fillStyle = '#4a3622'; for (let i = 0; i < 6; i++) { const fh = h - (i % 3) * 6 - rnd(i) * 10; ctx.fillRect(x + i * 26, G - fh, 7, fh); } ctx.fillRect(x, G - h + 10, w, 6); ctx.save(); ctx.translate(x + 80, G - 18); ctx.rotate(0.25); ctx.fillRect(0, 0, 70, 6); ctx.restore(); break;
      case 'well': box(x, y + 20, w, h - 20, '#5a5650'); ctx.fillStyle = '#3a2a18'; ctx.fillRect(x + 4, y - 40, 6, 60); ctx.fillRect(x + w - 10, y - 40, 6, 60); ctx.beginPath(); ctx.moveTo(x - 8, y - 38); ctx.lineTo(x + w / 2, y - 60); ctx.lineTo(x + w + 8, y - 38); ctx.fill(); break;
      case 'log': ctx.fillStyle = '#4a3420'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, 6.283); ctx.fill(); ctx.fillStyle = '#7a5a38'; ctx.beginPath(); ctx.ellipse(x + w - 6, y + h / 2, 6, h / 2, 0, 0, 6.283); ctx.fill(); break;
      case 'stump': ctx.fillStyle = '#3e2c1a'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#6a4e30'; ctx.beginPath(); ctx.ellipse(x + w / 2, y, w / 2, 5, 0, 0, 6.283); ctx.fill(); break;
      case 'rock': case 'rubble': { ctx.fillStyle = p.type === 'rock' ? '#4a4846' : '#55504a'; ctx.beginPath(); ctx.moveTo(x, G); for (let i = 0; i <= 6; i++) ctx.lineTo(x + w * i / 6, y + (i % 2 ? rnd(i) * 14 : 0) + (i === 0 || i === 6 ? h * 0.6 : 0)); ctx.lineTo(x + w, G); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(x + 10, y + 4, w - 20, 3); if (p.type === 'rubble') { ctx.strokeStyle = '#6a3a2a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 20, y + 4); ctx.lineTo(x + 34, y - 20); ctx.moveTo(x + 70, y + 2); ctx.lineTo(x + 90, y - 14); ctx.stroke(); } break; }
      case 'banner': ctx.fillStyle = '#2a2018'; ctx.fillRect(x + 12, y, 5, h); ctx.fillStyle = '#e6e0d2'; ctx.beginPath(); ctx.moveTo(x + 17, y + 6); ctx.lineTo(x + 60 + Math.sin(t * 2 + p.seed) * 4, y + 10); ctx.lineTo(x + 56 + Math.sin(t * 2.2 + p.seed) * 5, y + 80); ctx.lineTo(x + 38, y + 70); ctx.lineTo(x + 17, y + 84); ctx.closePath(); ctx.fill(); A.cross(ctx, x + 38, y + 40, 26, '#a3181e'); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill(); break;
      case 'brazier': { ctx.fillStyle = '#2a2622'; ctx.fillRect(x + 12, y + 20, 6, h - 20); ctx.fillRect(x, y + 10, 30, 14); const fl = Math.sin(t * 12 + p.seed) * 3; ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(x + 15, y, 2, x + 15, y, 120); g.addColorStop(0, 'rgba(255,150,50,0.45)'); g.addColorStop(1, 'rgba(255,80,20,0)'); ctx.fillStyle = g; ctx.fillRect(x - 110, y - 120, 250, 240); ctx.fillStyle = '#ffb040'; ctx.beginPath(); ctx.moveTo(x + 4, y + 10); ctx.quadraticCurveTo(x + 15, y - 30 + fl, x + 26, y + 10); ctx.fill(); ctx.restore(); if (Math.random() < 0.2) IF.fx.spawn({ x: x + 15, y: y - 5, vx: (Math.random() - 0.5) * 30, vy: -60 - Math.random() * 60, life: 1.2, size: 2, color: '#ffb040', type: 'ember', add: true, drag: 0.99 }); break; }
      case 'car': case 'jeep': case 'bus': {
        const c = p.type === 'jeep' ? '#3e4530' : p.type === 'bus' ? '#8a6a24' : ['#5a2a24', '#2a3a4a', '#4a4a48'][p.seed % 3];
        const bodyY = y + (p.type === 'bus' ? 0 : 22); box(x, bodyY, w, h - (bodyY - y) - 12, c);
        if (p.type === 'car') { ctx.fillStyle = A.shade(c, -0.15); ctx.beginPath(); ctx.moveTo(x + 30, bodyY); ctx.lineTo(x + 50, y + 2); ctx.lineTo(x + 120, y + 2); ctx.lineTo(x + 145, bodyY); ctx.fill(); ctx.fillStyle = 'rgba(30,40,50,0.8)'; ctx.fillRect(x + 54, y + 6, 30, 14); ctx.fillRect(x + 90, y + 6, 26, 14); }
        if (p.type === 'jeep') { ctx.fillStyle = '#2a2f20'; ctx.fillRect(x + 20, y, 6, 24); ctx.fillRect(x + 100, y, 6, 24); ctx.fillRect(x + 20, y, 86, 5); ctx.fillStyle = '#e8e2d0'; ctx.beginPath(); ctx.arc(x + 140, bodyY + 18, 9, 0, 6.283); ctx.fill(); ctx.fillStyle = '#a3181e'; A.cross(ctx, x + 140, bodyY + 18, 12, '#a3181e'); }
        if (p.type === 'bus') { for (let i = 0; i < 7; i++) { ctx.fillStyle = 'rgba(20,30,40,0.85)'; ctx.fillRect(x + 14 + i * 40, y + 12, 30, 32); } }
        wheel(x + 34, 16); wheel(x + w - 34, 16); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x, bodyY + 18, w, 3);
        ctx.fillStyle = 'rgba(90,40,20,0.5)'; ctx.beginPath(); ctx.ellipse(x + w * 0.3 + rnd(1) * 40, bodyY + 20, 12, 7, 0, 0, 6.283); ctx.fill(); break;
      }
      case 'barrier': ctx.fillStyle = '#7a7670'; ctx.beginPath(); ctx.moveTo(x, G); ctx.lineTo(x + 18, y); ctx.lineTo(x + w - 18, y); ctx.lineTo(x + w, G); ctx.fill(); ctx.fillStyle = '#a3181e'; for (let i = 0; i < 4; i++) ctx.fillRect(x + 22 + i * 20, y + 6, 10, 6); break;
      case 'tyres': for (let i = 0; i < 3; i++) { ctx.fillStyle = '#151515'; ctx.beginPath(); ctx.ellipse(x + w / 2, G - 6 - i * 11, w / 2, 7, 0, 0, 6.283); ctx.fill(); } break;
      case 'cone': ctx.fillStyle = '#d0601a'; ctx.beginPath(); ctx.moveTo(x, G); ctx.lineTo(x + w / 2, y); ctx.lineTo(x + w, G); ctx.fill(); ctx.fillStyle = '#eee'; ctx.fillRect(x + 6, y + 12, 8, 4); break;
      case 'sandbags': for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - (r === 2 ? 1 : 0); i++) { ctx.fillStyle = A.shade('#8a7a58', -0.1 * r - rnd(i + r) * 0.15); ctx.beginPath(); ctx.ellipse(x + 16 + i * 30 + (r % 2) * 14, G - 8 - r * 14, 17, 8, 0, 0, 6.283); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.stroke(); } break;
      case 'wire': ctx.strokeStyle = '#6a6a6a'; ctx.lineWidth = 1.4; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(x + 18 + i * 30, G - 16, 18, 15, 0, 0, 6.283); ctx.stroke(); } ctx.fillStyle = '#3a2a18'; ctx.fillRect(x, G - 34, 4, 34); ctx.fillRect(x + w - 4, G - 34, 4, 34); break;
      case 'hydrant': ctx.fillStyle = '#8a1a14'; ctx.fillRect(x + 4, y + 6, 12, h - 6); ctx.beginPath(); ctx.arc(x + 10, y + 6, 7, Math.PI, 0); ctx.fill(); break;
      case 'tank': box(x + 20, y + 30, w - 40, 40, '#3e4530'); box(x + 70, y, 110, 34, '#454d36'); ctx.fillStyle = '#2e3426'; ctx.fillRect(x + 180, y + 12, 120, 10); ctx.fillStyle = '#1c1c18'; ctx.beginPath(); ctx.ellipse(x + w / 2, G - 14, w / 2, 16, 0, 0, 6.283); ctx.fill(); for (let i = 0; i < 8; i++) { ctx.fillStyle = '#3a3a34'; ctx.beginPath(); ctx.arc(x + 22 + i * 31, G - 14, 9, 0, 6.283); ctx.fill(); } ctx.fillStyle = '#e8e2d0'; ctx.beginPath(); ctx.arc(x + 110, y + 50, 10, 0, 6.283); ctx.fill(); A.cross(ctx, x + 110, y + 50, 13, '#a3181e'); break;
      case 'crater': ctx.fillStyle = 'rgba(15,12,10,0.8)'; ctx.beginPath(); ctx.ellipse(x + w / 2, G + 4, w / 2, 10, 0, 0, 6.283); ctx.fill(); break;
      case 'container': box(x, y, w, h, ['#6a2a1e', '#2a4a5a', '#5a5a2a'][p.seed % 3]); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; for (let i = 1; i < 12; i++) { ctx.beginPath(); ctx.moveTo(x + i * w / 12, y + 4); ctx.lineTo(x + i * w / 12, y + h - 4); ctx.stroke(); } break;
      case 'pallet': box(x, y, w, h, '#7a6040'); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x + 8, y + 8, 14, h - 8); ctx.fillRect(x + w - 22, y + 8, 14, h - 8); break;
      case 'locker': box(x, y, w, h, '#4a5258'); ctx.fillStyle = 'rgba(0,0,0,0.5)'; for (let i = 0; i < 4; i++) ctx.fillRect(x + 8, y + 10 + i * 5, w - 16, 2); break;
      case 'gurney': ctx.fillStyle = '#8a9298'; ctx.fillRect(x, y, w, 8); ctx.fillRect(x + 8, y + 8, 4, h - 8); ctx.fillRect(x + w - 12, y + 8, 4, h - 8); ctx.fillStyle = '#c8c0b0'; ctx.fillRect(x + 4, y - 8, w - 8, 9); ctx.fillStyle = 'rgba(120,20,20,0.6)'; ctx.fillRect(x + 30, y - 8, 20, 9); break;
      case 'barricade': ctx.fillStyle = '#4a3622'; for (let i = 0; i < 5; i++) { ctx.save(); ctx.translate(x + w / 2, G - h / 2); ctx.rotate((i - 2) * 0.22); ctx.fillRect(-w / 2, -6 + (i - 2) * 10, w, 10); ctx.restore(); } box(x + 20, y + 10, 50, 40, '#5a3e22'); break;
    }
    if (p.destructible && p.hp < p.maxHp && p.hp > 0) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x, y - 8, w, 3); ctx.fillStyle = '#d0a040'; ctx.fillRect(x, y - 8, w * p.hp / p.maxHp, 3); }
  },
  drawGate(ctx, run, t) {
    const W = run.world, x = W.gateX, G = IF.GROUND;
    ctx.save();
    // stone archway
    ctx.fillStyle = '#2a2624'; ctx.fillRect(x - 20, G - 260, 34, 260); ctx.fillRect(x + 120, G - 260, 34, 260);
    ctx.beginPath(); ctx.moveTo(x - 30, G - 250); ctx.lineTo(x + 67, G - 330); ctx.lineTo(x + 164, G - 250); ctx.lineTo(x + 164, G - 230); ctx.lineTo(x - 30, G - 230); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(x - 20, G - 260, 6, 260);
    IF.art.cross(ctx, x + 67, G - 270, 34, '#a3181e');
    if (!W.gateOpen) { // portcullis
      ctx.fillStyle = '#1a1816'; for (let i = 0; i < 6; i++) ctx.fillRect(x + 18 + i * 18, G - 230, 5, 230); for (let j = 0; j < 7; j++) ctx.fillRect(x + 14, G - 220 + j * 32, 106, 4);
      ctx.fillStyle = '#ff5a3a'; ctx.font = '700 16px Cinzel, Georgia, serif'; ctx.textAlign = 'center'; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 4);
      ctx.fillText(W.isBoss ? 'SLAY THE GUARDIAN' : 'CLEAR THE HORDE', x + 67, G - 340); ctx.globalAlpha = 1;
    } else {
      const g = ctx.createLinearGradient(x, 0, x + 140, 0); g.addColorStop(0, 'rgba(255,220,140,0)'); g.addColorStop(0.5, 'rgba(255,220,140,' + (0.25 + 0.1 * Math.sin(t * 3)) + ')'); g.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.fillStyle = g; ctx.fillRect(x, G - 230, 140, 230);
      ctx.fillStyle = '#ffe2a0'; ctx.font = '700 16px Cinzel, Georgia, serif'; ctx.textAlign = 'center'; ctx.fillText('ONWARD ▸', x + 67, G - 340);
    }
    ctx.restore();
  },
  drawPickups(ctx, run, t) {
    for (const p of run.world.pickups) {
      if (!p.alive) continue; const bob = Math.sin(t * 4 + p.x) * 3, y = p.y + bob;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; const col = p.kind === 'health' ? 'rgba(90,255,120,0.35)' : p.kind === 'gold' ? 'rgba(255,210,80,0.35)' : 'rgba(255,170,80,0.3)';
      const g = ctx.createRadialGradient(p.x, y, 1, p.x, y, 26); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(p.x - 26, y - 26, 52, 52); ctx.restore();
      if (p.kind === 'health') { ctx.fillStyle = '#e8e0cc'; ctx.fillRect(p.x - 11, y - 9, 22, 18); IF.art.cross(ctx, p.x, y, 14, '#c0141c', 0.32); }
      else if (p.kind === 'ammo') { ctx.fillStyle = '#4a5a2a'; ctx.fillRect(p.x - 14, y - 9, 28, 18); ctx.fillStyle = '#d9b24c'; for (let i = 0; i < 4; i++) ctx.fillRect(p.x - 10 + i * 6, y - 14, 3, 7); }
      else { ctx.fillStyle = '#e8b830'; ctx.beginPath(); ctx.arc(p.x, y, 6, 0, 6.283); ctx.fill(); ctx.fillStyle = '#fff3b0'; ctx.fillRect(p.x - 1, y - 3, 2, 6); }
    }
  },
  drawForeground(ctx, run, camX) {
    ctx.fillStyle = 'rgba(5,4,4,0.85)';
    for (const f of run.world.fg) {
      const sx = f.x - camX * 0.3; const x = ((sx - camX * 0) % 4000); const px = f.x + (f.x - camX) * 0.35; if (px < camX - 300 || px > camX + IF.W + 300) continue;
      ctx.beginPath(); ctx.moveTo(px, IF.H);
      if (f.kind === 0) { for (let i = 0; i < 9; i++) { ctx.lineTo(px + i * 12 * f.s, IF.H - 50 * f.s - (i % 2) * 40 * f.s); ctx.lineTo(px + (i * 12 + 6) * f.s, IF.H - 10); } }
      else if (f.kind === 1) { ctx.lineTo(px, IF.H - 40 * f.s); ctx.lineTo(px + 60 * f.s, IF.H - 60 * f.s); ctx.lineTo(px + 120 * f.s, IF.H - 30 * f.s); ctx.lineTo(px + 160 * f.s, IF.H); }
      else { ctx.rect(px, IF.H - 110 * f.s, 8 * f.s, 110 * f.s); ctx.rect(px - 20 * f.s, IF.H - 100 * f.s, 48 * f.s, 5 * f.s); }
      ctx.fill();
    }
  },
};
