/* 3D weapon models. Hand space: grip at the origin, barrel/blade along +X, up is +Y.
 * Units are rig pixels (1px = 1cm before the character's scale), matching IF.art.GRIP muzzle data,
 * so the 3D hand attachment uses exactly the same grip/off-hand/muzzle points as the tested 2D rig.
 * Guns are assembled from parametric parts described by a model spec (see SPECS / def.model). */
'use strict';

IF.wep3d = {
  cache: {},
  mats() {
    const m = IF.mat; return this._m || (this._m = {
      gunmetal: m.metal('#2b2d31', 0.42, 0.85), blued: m.metal('#1c2026', 0.35, 0.9), parkerized: m.metal('#3a3c38', 0.6, 0.7), polymer: m.basic('#1d1e21', 0.62, 0.05),
      tan: m.basic('#8a7a5a', 0.7, 0.05), olive: m.basic('#4a5236', 0.7, 0.05), wood: m.wood('#8a5a34'), woodDark: m.wood('#5a3a20'), brass: m.metal('#c8a050', 0.35, 1),
      lens: m.basic('#3a6aa0', 0.05, 0.6), leather: m.leather('#3a2416'), steelBlade: m.metal('#c8cfd6', 0.22, 1), rubber: m.basic('#141414', 0.9),
    });
  },
  /* Model specs per class: receiver length/height, barrel, stock, magazine, furniture, optics. */
  SPECS: {
    pistol: { rcv: [-4, 28, 8], slide: true, bar: 4, mag: 'grip', grip: [0, -2, 6, 13, 0.25], stock: 'none' },
    revolver: { rcv: [-4, 14, 9], cyl: true, bar: 24, grip: [-2, -2, 6, 13, 0.4], stock: 'none', furn: 'wood' },
    handcannon: { rcv: [-4, 16, 10], cyl: true, bar: 30, barR: 1.6, grip: [-2, -2, 7, 14, 0.4], stock: 'none' },
    smg: { rcv: [-14, 40, 10], bar: 14, mag: 'straight', magX: 12, magL: 17, grip: [0, -2, 6, 12, 0.2], stock: 'fold', stockL: 14 },
    rifle: { rcv: [-8, 46, 11], bar: 28, mag: 'curved', magX: 14, magL: 19, grip: [-2, -2, 7, 13, 0.3], stock: 'fixed', stockL: 24, hand: 22, rails: true, optic: 'red' },
    shotgun: { rcv: [-6, 32, 11], bar: 46, tube: true, grip: [-2, -2, 7, 13, 0.3], stock: 'fixed', stockL: 26, hand: 18, pump: true },
    pump: { rcv: [-6, 32, 11], bar: 46, tube: true, grip: [-2, -2, 7, 13, 0.3], stock: 'wood', stockL: 28, hand: 18, pump: true, furn: 'wood' },
    dbshotgun: { rcv: [-2, 16, 11], bar: 46, dbl: true, stock: 'wood', stockL: 24, furn: 'wood', grip: null },
    sniper: { rcv: [-6, 48, 10], bar: 50, barR: 1.2, mag: 'box', magX: 12, magL: 9, grip: [-2, -2, 7, 13, 0.3], stock: 'precision', stockL: 32, optic: 'scope', bipod: true, hand: 24 },
    lmg: { rcv: [-6, 56, 14], bar: 36, mag: 'box', magX: 10, magL: 14, magW: 12, grip: [-2, -2, 7, 13, 0.3], stock: 'fixed', stockL: 24, hand: 18, bipod: true, carry: true },
    minigun: { minigun: true },
    gl: { rcv: [-4, 24, 14], drum: true, bar: 34, barR: 4, grip: [-2, -2, 7, 13, 0.3], stock: 'fold', stockL: 18 },
    rl: { tube: 'launcher' },
    // (WWII and other variants override these through def.model)
  },

  build(def, rarityIndex) {
    const key = def.id + ':' + rarityIndex; if (this.cache[key]) return this.cache[key].clone();
    const T = IF.r3.T, g = new T.Group();
    if (def.slot === 'melee') this.melee(g, def); else if (def.cls === 'bow') this.bow(g, def); else if (def.cls === 'crossbow') this.crossbow(g, def); else this.gun(g, def, Object.assign({}, this.SPECS[def.cls] || this.SPECS.rifle, def.model || {}));
    if (rarityIndex >= 3) { // rarity glow: emissive inlay along the weapon
      const col = (def.look && def.look.glow) || IF.RARITIES[rarityIndex].color, box = new T.Box3().setFromObject(g), L = box.max.x - Math.max(0, box.min.x);
      const inlay = new T.Mesh(new T.BoxGeometry(L * 0.7, 0.35, 0.2), IF.mat.glow(col, 2.2 + rarityIndex * 0.3)); inlay.position.set(Math.max(0, box.min.x) + L * 0.5, (box.max.y + box.min.y) / 2, (box.max.z) + 0.05); g.add(inlay);
    }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
    this.cache[key] = g; return g.clone();
  },
  M(geo, mat, x, y, z, p) { const m = new IF.r3.T.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); p.add(m); return m; },
  box(p, x0, x1, y0, y1, w, mat) { return this.M(new IF.r3.T.BoxGeometry(x1 - x0, y1 - y0, w), mat, (x0 + x1) / 2, (y0 + y1) / 2, 0, p); },
  rbox(p, x0, x1, y0, y1, w, r, mat) { // rounded, bevelled box via extruded rounded rectangle (reads as machined metal)
    const T = IF.r3.T, s = new T.Shape(), W = x1 - x0, H = y1 - y0; r = Math.min(r, W / 2, H / 2);
    s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.quadraticCurveTo(x1, y0, x1, y0 + r); s.lineTo(x1, y1 - r); s.quadraticCurveTo(x1, y1, x1 - r, y1); s.lineTo(x0 + r, y1); s.quadraticCurveTo(x0, y1, x0, y1 - r); s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
    const geo = new T.ExtrudeGeometry(s, { depth: w - 0.8, bevelEnabled: true, bevelThickness: 0.4, bevelSize: 0.4, bevelSegments: 2, curveSegments: 4 }); geo.translate(0, 0, -(w - 0.8) / 2);
    return this.M(geo, mat, 0, 0, 0, p);
  },
  shape(p, pts, w, mat, bevel = 0.3) { const T = IF.r3.T, s = new T.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath(); const geo = new T.ExtrudeGeometry(s, { depth: w - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1 }); geo.translate(0, 0, -(w - bevel * 2) / 2); return this.M(geo, mat, 0, 0, 0, p); },
  tubeX(p, x0, x1, y, r, mat, seg = 12) { const m = this.M(new IF.r3.T.CylinderGeometry(r, r, x1 - x0, seg), mat, (x0 + x1) / 2, y, 0, p); m.rotation.z = Math.PI / 2; return m; },

  /* ---------- firearms ---------- */
  gun(g, def, s) {
    const K = this.mats(), body = def.look && def.look.tan ? K.tan : K.polymer, metal = def.cls === 'pistol' || def.cls === 'smg' ? K.blued : K.gunmetal;
    const furn = s.furn === 'wood' || (def.look && def.look.body && /^#[5-8][0-9a-f]4/.test(def.look.body)) ? K.wood : body;
    if (s.minigun) return this.minigun(g, def);
    if (s.tube === 'launcher') return s.bazooka ? this.bazooka(g, def) : this.launcher(g, def);
    const [rx0, rx1, rh] = s.rcv, top = -6, bot = top - rh;   // receiver sits above the grip, barrel line at y = -7
    const by = top - 3.2;
    // receiver
    this.rbox(g, rx0, rx1, bot, top, s.slide ? 3.4 : 4.6, 1.2, metal);
    if (s.rails) { for (let x = rx0 + 4; x < rx1 + (s.hand || 0) - 2; x += 2.2) this.box(g, x, x + 1.4, top, top + 0.9, 3.0, K.blued); }
    if (s.slide) { for (let x = rx1 - 10; x < rx1 - 3; x += 1.4) this.box(g, x, x + 0.5, top - 1.2, top - 0.2, 3.6, K.blued); }
    // barrel + muzzle device
    const bx0 = rx1 + (s.hand || 0) - 4, bx1 = rx1 + (s.hand || 0) + s.bar;
    const br = s.barR || 0.9;
    if (s.dbl) { this.tubeX(g, rx1 - 2, bx1, by + 1.2, br * 1.3, K.blued); this.tubeX(g, rx1 - 2, bx1, by - 1.4, br * 1.3, K.blued); this.box(g, rx1 + 2, bx1 - 14, by - 4, by - 2.6, 3.2, K.wood); }
    else { this.tubeX(g, bx0, bx1, by, br, K.blued); this.tubeX(g, bx1 - 3, bx1 + 1, by, br * 1.5, K.gunmetal, 8); }
    if (s.tube) this.tubeX(g, rx1, bx1 - 6, by - 2.6, br * 1.2, K.blued); // under-barrel magazine tube
    // handguard / pump
    if (s.hand) { if (s.pump) { const pm = this.rbox(g, rx1 + 6, rx1 + 6 + s.hand, by - 4.4, by - 0.6, 4.2, 1.4, furn); pm.userData.pump = true; } else this.rbox(g, rx1 - 1, rx1 + s.hand, by - 2.8, by + 2.6, 4.2, 1.4, body); }
    // front sight
    if (!s.optic || s.optic === 'red' || s.optic === 'none') this.box(g, bx1 - 5, bx1 - 4, by + br, by + br + 2.6, 0.8, K.blued);
    // magazine
    if (s.mag === 'curved') { const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8, a = t * 0.5; pts.push([s.magX + Math.sin(a) * s.magL * 0.6 + t * 1.5, bot - t * s.magL]); } const back = pts.slice().reverse().map(([x, y]) => [x + 4.2, y]); this.shape(g, pts.concat(back), 3.2, K.parkerized, 0.25); }
    else if (s.mag === 'straight' || s.mag === 'box') this.rbox(g, s.magX, s.magX + (s.magW || 4), bot - s.magL, bot + 0.5, 3.0, 0.6, s.mag === 'box' && def.cls === 'lmg' ? K.olive : K.parkerized);
    else if (s.mag === 'grip') { /* pistol mag is inside the grip */ }
    if (s.drum) { const d = this.M(new IF.r3.T.CylinderGeometry(6.5, 6.5, 7, 16), K.olive, 6, top - 5, 0, g); d.rotation.x = Math.PI / 2; for (let i = 0; i < 6; i++) { const c = this.M(new IF.r3.T.CylinderGeometry(1.6, 1.6, 7.4, 8), K.gunmetal, 6 + Math.cos(i) * 4, top - 5 + Math.sin(i) * 4, 0, g); c.rotation.x = Math.PI / 2; } }
    if (s.cyl) { const c = this.M(new IF.r3.T.CylinderGeometry(4.2, 4.2, 6, 10), K.blued, 4, by - 0.5, 0, g); c.rotation.z = Math.PI / 2; for (let i = 0; i < 6; i++) { const f = this.M(new IF.r3.T.BoxGeometry(6.2, 0.7, 0.7), K.gunmetal, 4, by - 0.5 + Math.cos(i * 1.05) * 4.2, Math.sin(i * 1.05) * 4.2, g); } this.box(g, 0, 3, bot - 1, bot + 2, 1, K.blued); }
    // pistol grip (angled)
    if (s.grip) { const [gx, gy, gw, gl, ang] = s.grip; const pts = [[gx - gw / 2, gy], [gx + gw / 2, gy], [gx + gw / 2 - Math.sin(ang) * gl, gy - gl], [gx - gw / 2 - Math.sin(ang) * gl - 1, gy - gl + 1]]; this.shape(g, pts.map(([x, y]) => [x, y - 4]), 3.6, s.furn === 'wood' && def.cls === 'revolver' ? K.wood : K.polymer, 0.5); this.box(g, gx + 2, gx + 6, bot - 3, bot - 2.2, 0.6, K.blued); /* trigger guard */ }
    // stock
    if (s.stock === 'fixed' || s.stock === 'precision') { const L = s.stockL; this.shape(g, [[rx0 + 1, top - 0.5], [rx0 - L, top - 1.5], [rx0 - L, bot - 4.5], [rx0 - L + 4, bot - 4.5], [rx0 + 1, bot + 1]], 4, s.stock === 'precision' ? K.olive : furn, 0.6); this.box(g, rx0 - L - 1, rx0 - L + 0.2, bot - 4.5, top - 1.5, 4.2, K.rubber); }
    if (s.stock === 'wood') { const L = s.stockL; this.shape(g, [[rx0 + 2, top - 1], [rx0 - L, top - 3], [rx0 - L, bot - 6], [rx0 - 4, bot - 1], [rx0 + 2, bot]], 4.2, K.wood, 0.7); }
    if (s.stock === 'fold') { const L = s.stockL; this.box(g, rx0 - L, rx0, top - 2.2, top - 1.2, 1, K.blued); this.box(g, rx0 - L, rx0 - L + 1.2, bot - 2, top - 1.2, 1, K.blued); this.box(g, rx0 - L, rx0, bot - 2, bot - 1, 1, K.blued); }
    // optics
    if (s.optic === 'red') { this.rbox(g, rx0 + 10, rx0 + 18, top + 0.9, top + 5, 3.6, 1, K.polymer); this.M(new IF.r3.T.CircleGeometry(1.2, 12), K.lens, rx0 + 18.05, top + 3, 0, g).rotation.y = Math.PI / 2; }
    if (s.optic === 'scope') { this.tubeX(g, rx0 + 6, rx0 + 36, top + 4.5, 1.8, K.blued); this.tubeX(g, rx0 + 30, rx0 + 38, top + 4.5, 2.6, K.blued); this.tubeX(g, rx0 + 4, rx0 + 9, top + 4.5, 2.2, K.blued); for (const x of [rx0 + 14, rx0 + 26]) this.box(g, x, x + 2, top, top + 3, 2.4, K.blued); this.M(new IF.r3.T.CircleGeometry(2.4, 14), K.lens, rx0 + 38.05, top + 4.5, 0, g).rotation.y = Math.PI / 2; }
    if (s.carry) { this.box(g, rx0 + 12, rx0 + 30, top + 4, top + 5.2, 1.2, K.blued); for (const x of [rx0 + 12, rx0 + 29]) this.box(g, x, x + 1.2, top, top + 5, 1.2, K.blued); }
    if (s.bipod) for (const z of [-1.4, 1.4]) { const l = this.M(new IF.r3.T.CylinderGeometry(0.4, 0.4, 13, 5), K.blued, bx1 - 14, by - 6.5, z, g); l.rotation.z = 0.35; l.rotation.x = z * 0.08; }
    // ---- variant parts (period firearms) ----
    if (s.woodFore) this.rbox(g, rx1 - 4, rx1 + s.woodFore, by - 3.4, by + 1.6, 4.4, 1.2, K.wood); // full-length wooden forend
    if (s.jacket) { // perforated cooling jacket around the barrel
      const j0 = rx1 - 2, j1 = rx1 + (s.hand || 0) + s.bar - 4; this.tubeX(g, j0, j1, by, 2.4, K.parkerized, 10);
      for (let x = j0 + 3; x < j1 - 2; x += 3.2) for (const a of [0.9, -0.9]) { const h = this.M(new IF.r3.T.CylinderGeometry(0.7, 0.7, 0.4, 6), K.polymer, x, by + Math.sin(a) * 2.3, Math.cos(a) * 2.3, g); h.rotation.x = Math.PI / 2 - a; }
    }
    if (s.jacketFins) for (let x = rx1 + 1; x < rx1 + 12; x += 1.4) { const f = this.M(new IF.r3.T.CylinderGeometry(1.8, 1.8, 0.5, 10), K.blued, x, by, 0, g); f.rotation.z = Math.PI / 2; }
    if (s.fgrip) { const pts = [[rx1 + 4, by - 2], [rx1 + 9, by - 2], [rx1 + 8, by - 12], [rx1 + 4, by - 12]]; this.shape(g, pts, 3.6, K.wood, 0.6); }
    if (s.drumMag) { const d = this.M(new IF.r3.T.CylinderGeometry(6, 6, 4.2, 18), K.blued, (s.magX || 10) + 2, bot - 5.5, 0, g); d.rotation.x = Math.PI / 2; this.M(new IF.r3.T.CylinderGeometry(1.4, 1.4, 4.6, 8), K.gunmetal, (s.magX || 10) + 2, bot - 5.5, 0, g).rotation.x = Math.PI / 2; }
    if (s.mag === 'side') { const m = this.M(new IF.r3.T.BoxGeometry(4, 2.6, s.magL), K.parkerized, s.magX + 2, by, -s.magL / 2 - 2, g); }
    if (s.mag === 'drumSide') { const d = this.M(new IF.r3.T.CylinderGeometry(4.5, 4.5, 3.5, 14), K.olive, rx0 + 22, by - 1, -5.5, g); d.rotation.x = Math.PI / 2; this.box(g, rx0 + 18, rx0 + 30, top - 1, top + 1.6, 5, K.blued); /* feed cover */ }
    if (s.bolt) { const b = this.M(new IF.r3.T.CylinderGeometry(0.6, 0.6, 5, 6), K.blued, rx0 + 14, top - 2, 3.6, g); b.rotation.x = Math.PI / 2 - 0.5; this.M(new IF.r3.T.SphereGeometry(1.1, 8, 6), K.blued, rx0 + 14, top - 3.2, 6, g); }
    if (s.toggle) { this.box(g, rx0 + 2, rx0 + 10, top, top + 2.2, 2.6, K.blued); this.M(new IF.r3.T.SphereGeometry(1.3, 8, 6), K.blued, rx0 + 2, top + 1.6, 1.5, g); }
    if (s.stock === 'frame') { const L = s.stockL; this.tubeX(g, rx0 - L, rx0, top - 2, 0.6, K.blued, 6); this.box(g, rx0 - L - 1, rx0 - L + 1, bot - 6, top - 1, 1.2, K.blued); this.tubeX(g, rx0 - L, rx0 - 4, bot - 4, 0.5, K.blued, 6); }
    if (s.bayonet) { const bx = rx1 + (s.hand || 0) + s.bar; this.shape(g, [[bx - 6, by - 3.5], [bx + 22, by - 3.2], [bx + 26, by - 2.6], [bx + 22, by - 2], [bx - 6, by - 2.2]], 0.8, K.steelBlade || IF.mat.metal('#c8cfd6', 0.22, 1), 0.1); }
    if (s.furnGrip === 'wood' && s.grip) { const [gx, gy, gw, gl, ang] = s.grip; const pts = [[gx - gw / 2 + 0.8, gy - 1], [gx + gw / 2 - 0.8, gy - 1], [gx + gw / 2 - 0.8 - Math.sin(ang) * gl, gy - gl + 1], [gx - gw / 2 - Math.sin(ang) * gl, gy - gl + 2]]; this.shape(g, pts.map(([x, y]) => [x, y - 4]), 4.2, K.wood, 0.3); }
    if (def.look && def.look.glow && def.rarity !== 'x') { /* glow accents added by rarity */ }
    return g;
  },
  minigun(g, def) { const K = this.mats(); this.rbox(g, -14, 20, -20, 4, 13, 2, K.gunmetal); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const b = this.tubeX(g, 20, 80, -6 + Math.cos(a) * 3.2, 0.9, K.blued, 8); b.position.z = Math.sin(a) * 3.2; b.userData.spinIdx = i; } for (const x of [22, 50, 76]) { const r = this.M(new IF.r3.T.CylinderGeometry(4.6, 4.6, 1.6, 14), K.gunmetal, x, -6, 0, g); r.rotation.z = Math.PI / 2; } this.box(g, -6, 4, -32, -20, 8, K.olive); this.rbox(g, -4, 4, 2, 12, 2, 1, K.polymer); g.userData.spinner = true; return g; },
  launcher(g, def) { const K = this.mats(), mat = IF.mat.metal('#4b5a3f', 0.7, 0.3); this.tubeX(g, -44, 82, -8, 7.5, mat, 16); for (const x of [-46, 80]) this.tubeX(g, x, x + 6, -8, 8.6, K.polymer, 16); this.rbox(g, -4, 4, -18, -14, 4, 1, K.polymer); this.rbox(g, 16, 24, -18, -14, 4, 1, K.polymer); this.rbox(g, 6, 26, 0, 6, 4, 1, K.blued); this.M(new IF.r3.T.ConeGeometry(5, 12, 12), IF.mat.metal('#7a2a1a', 0.5, 0.4), 90, -8, 0, g).rotation.z = -Math.PI / 2; return g; },
  bazooka(g, def) { // M1-style: long open tube, wooden shoulder rest, twin grips, wire frame sight
    const K = this.mats(), tube = IF.mat.metal('#4a5236', 0.75, 0.3);
    this.tubeX(g, -50, 92, -8, 4.2, tube, 14); this.tubeX(g, 86, 94, -8, 5.2, K.gunmetal, 14); this.tubeX(g, -54, -46, -8, 4.8, K.gunmetal, 14);
    this.rbox(g, -30, -6, -16, -9, 4, 1.5, K.wood); // shoulder rest
    this.rbox(g, -4, 4, -20, -10, 3.5, 1, K.wood); this.rbox(g, 22, 30, -20, -10, 3.5, 1, K.wood);
    this.box(g, 40, 41, -4, 2, 3, K.blued); this.box(g, 40, 41, 2, 2.6, 6, K.blued); // frame sight
    this.M(new IF.r3.T.TorusGeometry(4.2, 0.5, 6, 16), K.gunmetal, 60, -8, 0, g).rotation.y = Math.PI / 2;
    return g;
  },
  bow(g, def) { const T = IF.r3.T, K = this.mats(), pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12 * 2 - 1; pts.push(new T.Vector3(4 + (1 - t * t) * 16, t * 46, 0)); } this.M(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 20, 1.4, 6), K.woodDark, 0, 0, 0, g); const str = this.M(new T.CylinderGeometry(0.25, 0.25, 92, 4), IF.mat.basic('#ddd5c0', 0.8), 4, 0, 0, g); str.userData.string = true; this.box(g, -1, 5, -6, 6, 3, K.leather); return g; },
  crossbow(g, def) { const T = IF.r3.T, K = this.mats(); this.rbox(g, -14, 52, -6, 0, 5, 1.5, K.wood); const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10 * 2 - 1; pts.push(new T.Vector3(44 + (1 - t * t) * 6, -3, t * 24)); } this.M(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 16, 1.2, 6), K.gunmetal, 0, 0, 0, g); this.box(g, 18, 50, -2, -1, 0.6, IF.mat.basic('#ddd', 0.8)); this.box(g, -4, 2, -16, -6, 3, K.wood); return g; },

  /* ---------- melee ---------- */
  melee(g, def) {
    const T = IF.r3.T, K = this.mats(), L = def.look || {}, len = def.len, cls = def.cls;
    const blade = IF.mat.metal(L.blade || '#b4bcc4', 0.22, 1), edge = IF.mat.metal(L.edge || '#eef3f7', 0.15, 1), guardM = IF.mat.metal(L.guard || '#7a6236', 0.4, 0.9);
    if (cls === 'sword' || cls === 'greatsword') {
      const w = cls === 'greatsword' ? 5.2 : 4, grip = cls === 'greatsword' ? 20 : 12;
      const s = new T.Shape(); s.moveTo(7, -w / 2); s.lineTo(len - 12, -w * 0.42); s.lineTo(len, 0); s.lineTo(len - 12, w * 0.42); s.lineTo(7, w / 2); s.closePath();
      const geo = new T.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.9, bevelSegments: 2 }); geo.translate(0, 0, -0.1);
      const bl = this.M(geo, blade, 0, 0, 0, g); bl.rotation.x = 0;
      this.box(g, 9, len * 0.7, -0.5, 0.5, 1.4, IF.mat.metal('#6a7076', 0.35, 1)); // fuller
      this.rbox(g, 3, 7, -11, 11, 3, 1.5, guardM); // crossguard
      const gr = this.tubeX(g, -grip, 3, 0, 1.6, K.leather, 8); for (let x = -grip + 1; x < 2; x += 2.2) this.tubeX(g, x, x + 0.6, 0, 1.8, guardM, 8);
      this.M(new T.SphereGeometry(2.6, 10, 8), guardM, -grip - 1.5, 0, 0, g);
    } else if (cls === 'axe' || cls === 'greataxe' || cls === 'halberd') {
      this.tubeX(g, -14, len + (cls === 'halberd' ? 6 : 0), 0, 1.5, K.woodDark, 8);
      const hx = len - (cls === 'halberd' ? 22 : 8), big = cls !== 'axe';
      const head = (dir) => { const s = new T.Shape(); s.moveTo(hx - 8, 0); s.lineTo(hx - 10, dir * 5); s.quadraticCurveTo(hx - 18, dir * (big ? 26 : 20), hx + 4, dir * (big ? 30 : 24)); s.quadraticCurveTo(hx + 10, dir * 12, hx + 6, 0); s.closePath(); const geo = new T.ExtrudeGeometry(s, { depth: 0.6, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.8, bevelSegments: 2 }); geo.translate(0, 0, -0.3); this.M(geo, blade, 0, 0, 0, g); };
      head(-1); if (cls === 'greataxe') head(1);
      if (cls === 'halberd') { this.shape(g, [[hx + 4, -2.5], [len + 22, 0], [hx + 4, 2.5]], 1.4, blade, 0.4); this.shape(g, [[hx - 4, 2], [hx - 2, 13], [hx + 4, 2]], 1.2, blade, 0.3); }
      this.rbox(g, hx - 10, hx + 6, -3, 3, 4, 1, guardM);
    } else if (cls === 'hammer' || cls === 'mace') {
      this.tubeX(g, -12, len - 4, 0, 1.5, K.woodDark, 8); const hx = len - 4;
      if (cls === 'hammer') { this.rbox(g, hx - 9, hx + 9, -18, 18, 14, 2, IF.mat.metal(L.blade || '#5d636a', 0.45, 1)); this.shape(g, [[hx - 9, -12], [hx - 22, 0], [hx - 9, 4]], 6, blade, 0.4); }
      else { this.M(new T.IcosahedronGeometry(9, 0), IF.mat.metal(L.blade || '#6e747a', 0.4, 1), hx, 0, 0, g); if (L.spikes) for (let i = 0; i < 14; i++) { const d = new T.Vector3().randomDirection(), c = this.M(new T.ConeGeometry(1.4, 8, 6), IF.mat.metal(L.edge || '#9ba2a8', 0.4, 1), hx + d.x * 10, d.y * 10, d.z * 10, g); c.lookAt(hx + d.x * 30, d.y * 30, d.z * 30); c.rotateX(Math.PI / 2); } else for (let i = 0; i < 6; i++) { const f = this.box(g, hx - 7, hx + 7, -1, 1, 22, blade); f.rotation.x = i * Math.PI / 6; } }
    } else if (cls === 'spear') { this.tubeX(g, -30, len, 0, 1.3, K.woodDark, 8); this.shape(g, [[len - 20, -5], [len + 24, 0], [len - 20, 5]], 1.6, blade, 0.5); this.rbox(g, len - 22, len - 16, -2.5, 2.5, 3.2, 1, guardM); }
    if (L.glow) { const gl = this.box(g, 8, len - 6, -0.3, 0.3, 2.6, IF.mat.glow(L.glow, 2.4)); }
    return g;
  },
};
