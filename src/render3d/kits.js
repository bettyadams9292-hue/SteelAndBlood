/* Environment kit — procedural 3D builders for props, structures and vegetation (units: metres, base at y=0).
 * Builders return THREE.Groups; static set-dressing is later merged per material by the terrain module. */
'use strict';

IF.kit = {
  T: null,
  init() { this.T = IF.r3.T; },
  g() { return new this.T.Group(); },
  mesh(geo, mat, x = 0, y = 0, z = 0, parent) { const m = new this.T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; if (parent) parent.add(m); return m; },
  box(w, h, d, mat, x, y, z, p) { const geo = new this.T.BoxGeometry(w, h, d); if (mat.userData && mat.userData.worldUV) this.worldUV(geo, w, h, d, mat.userData.worldUV); return this.mesh(geo, mat, x, y, z, p); },
  /* Scale a box's per-face UVs by its real size so tiling textures (masonry) keep a constant world scale. */
  worldUV(geo, w, h, d, tile) {
    const uv = geo.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile); }
    uv.needsUpdate = true;
  },
  cyl(rt, rb, h, mat, x, y, z, p, seg = 12) { return this.mesh(new this.T.CylinderGeometry(rt, rb, h, seg), mat, x, y, z, p); },
  M() { const m = IF.mat; return {
    stone: m.stone('#8a847c'), stoneDark: m.stone('#5e5952', 'stDark'), plaster: m.plaster('#a89a84'), timber: m.wood('#7a6048'), timberDark: m.wood('#4a3a2c'),
    thatch: m.thatch('#8a7448'), roofTile: m.basic('#5a3028', 0.9), iron: m.metal('#4a4c50', 0.55, 0.85), rust: m.metal('#6a3a22', 0.85, 0.5), steel: m.metal('#8a9096', 0.4, 0.9),
    olive: m.metal('#4a5233', 0.7, 0.35), concrete: m.concrete('#8a8680'), concreteDark: m.concrete('#5e5c58'), sand: m.cloth('#9a8a62'), tyre: m.basic('#151515', 0.9),
    glass: m.basic('#1c2630', 0.15, 0.5), red: m.metal('#8a1e14', 0.55, 0.4), canvas: m.cloth('#6a6448'), white: m.cloth('#e6e0d2'), crimson: m.cloth('#8e1218'), dark: m.basic('#121212', 0.9),
    bark: m.wood('#3e2e22'), leaves: m.basic('#1e2a1c', 1), leavesDead: m.basic('#3a3424', 1), rock: m.basic('#5c5852', 0.95),
  }; },
  mats() { return this._m || (this._m = this.M()); },
  /* World-scale standards (metres) checked by audit(): the knight is 1.8 m tall; everything is sized against him. */
  STANDARDS: { crate: [0.5, 0.75], barrel: [0.8, 1.0], barricade: [0.9, 1.4], fence: [0.95, 1.15], well: [2.0, 2.6], brazier: [1.0, 1.5], banner: [1.6, 2.2], cart: [0.9, 1.6], car: [1.2, 1.6], jeep: [1.4, 2.0], bus: [2.0, 2.4], tank: [2.0, 2.8], cone: [0.3, 0.8], tyres: [0.3, 0.8], hydrant: [0.35, 0.8], locker: [0.8, 2.0], sandbags: [0.3, 0.9], log: [0.25, 0.7], stump: [0.2, 0.7] },
  audit() { // returns [prop, height, [min,max]] for every builder whose real height breaks its standard
    const T = this.T, out = []; for (const k in this.STANDARDS) { const g = this.prop(k); if (!g) continue; const b = new T.Box3().setFromObject(g), h = b.max.y - b.min.y, [lo, hi] = this.STANDARDS[k]; if (h < lo || h > hi) out.push([k, +h.toFixed(2), [lo, hi]]); if (b.min.y < -0.05) out.push([k + ' (below ground)', +b.min.y.toFixed(2)]); }
    return out; },

  /* ---------- props (gameplay lane objects) ---------- */
  /* side-profile extrusion helper: pts in (x, y) metres, extruded across z (width), centred, softly bevelled */
  profile(pts, width, mat, g, bevel = 0.03) { const T = this.T, sh = new T.Shape(); sh.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]); sh.closePath(); const geo = new T.ExtrudeGeometry(sh, { depth: width - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 4 }); geo.translate(0, 0, -(width - bevel * 2) / 2); return this.mesh(geo, mat, 0, 0, 0, g); },
  wheel(g, x, y, z, r, w, tyre, rim, spokes) { const T = this.T, t = this.mesh(new T.TorusGeometry(r * 0.78, r * 0.24, 8, 18), tyre, x, y, z, g); const hub = this.cyl(r * 0.5, r * 0.5, w * 0.9, rim, x, y, z, g, 12); hub.rotation.x = Math.PI / 2; if (spokes) for (let i = 0; i < spokes; i++) { const sp = this.box(0.03, r * 1.5, 0.03, rim, x, y, z, g); sp.rotation.z = i / spokes * Math.PI; } this.cyl(r * 0.18, r * 0.18, w, IF.mat.metal('#6a6a66', 0.5, 0.8), x, y, z, g, 8).rotation.x = Math.PI / 2; return t; },
  crate(w = 0.62, h = 0.58) { // plank crate: boarded faces with gaps, frame battens on every edge, diagonal braces, nail heads, stencil
    const M = this.mats(), g = this.g(), n = 4, pw = w / n;
    this.box(w - 0.04, h - 0.04, w - 0.04, M.timberDark, 0, h / 2, 0, g); // inner shadow body (shows through the plank gaps)
    for (const s of [-1, 1]) for (let i = 0; i < n; i++) { this.box(pw - 0.012, h - 0.02, 0.025, M.timber, -w / 2 + pw * (i + 0.5), h / 2, s * (w / 2 - 0.0125), g); this.box(0.025, h - 0.02, pw - 0.012, M.timber, s * (w / 2 - 0.0125), h / 2, -w / 2 + pw * (i + 0.5), g); }
    for (let i = 0; i < n; i++) this.box(pw - 0.012, 0.025, w - 0.02, M.timber, -w / 2 + pw * (i + 0.5), h - 0.0125, 0, g);
    for (const sy of [0.03, h - 0.03]) for (const s of [-1, 1]) { this.box(w + 0.01, 0.06, 0.03, M.timberDark, 0, sy, s * (w / 2 + 0.005), g); this.box(0.03, 0.06, w + 0.01, M.timberDark, s * (w / 2 + 0.005), sy, 0, g); }
    for (const s of [-1, 1]) { const br = this.box(Math.hypot(w, h) - 0.12, 0.06, 0.02, M.timberDark, 0, h / 2, s * (w / 2 + 0.02), g); br.rotation.z = Math.atan2(h, w) * s; }
    for (const s of [-1, 1]) for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) for (const y of [0.03, h - 0.03]) this.mesh(new this.T.SphereGeometry(0.008, 4, 3), M.iron, x, y, s * (w / 2 + 0.022), g);
    return g; },
  barrel(explosive) { // 200-litre steel drum: rolling hoops, rolled rims, lid with bungs, dents; fuel drums get hazard band and diamond
    const M = this.mats(), g = this.g(), T = this.T, mat = explosive ? M.red : IF.mat.metal('#3e4a32', 0.6, 0.6), R = 0.29, H = 0.88;
    const pr = [[R - 0.01, 0], [R, 0.02], [R, 0.27], [R + 0.012, 0.29], [R, 0.31], [R, 0.57], [R + 0.012, 0.59], [R, 0.61], [R, H - 0.02], [R - 0.01, H]].map(([a, b]) => new T.Vector2(a, b));
    this.mesh(new T.LatheGeometry(pr, 24), mat, 0, 0, 0, g); for (const y of [0.005, H - 0.005]) this.mesh(new T.TorusGeometry(R - 0.004, 0.012, 5, 24), M.iron, 0, y, 0, g).rotation.x = Math.PI / 2;
    this.mesh(new T.CircleGeometry(R - 0.01, 24), mat, 0, H - 0.012, 0, g).rotation.x = -Math.PI / 2; for (const [bx, bz, br] of [[0.15, 0.1, 0.035], [-0.16, -0.08, 0.025]]) this.cyl(br, br, 0.02, M.iron, bx, H - 0.005, bz, g, 8);
    if (explosive) { this.mesh(new T.CylinderGeometry(R + 0.002, R + 0.002, 0.08, 24, 1, true), IF.mat.basic('#f0c040', 0.6), 0, 0.44, 0, g); const lab = this.box(0.16, 0.16, 0.01, IF.mat.basic('#f0c040', 0.6), 0, 0.72, R + 0.004, g); lab.rotation.z = Math.PI / 4; }
    return g; },
  barrels() { const g = this.g(); for (let i = 0; i < 2; i++) { const b = this.barrel(false); b.position.x = -0.24 + i * 0.48; g.add(b); } const t = this.barrel(false); t.rotation.z = Math.PI / 2; t.position.set(0, 0.86 + 0.22, 0); t.position.x = 0.43; g.add(t); return g; },
  sandbags(len = 1.2, rows = 3) { const M = this.mats(), g = this.g(), geo = new this.T.CapsuleGeometry(0.1, 0.2, 4, 8); for (let r = 0; r < rows; r++) for (let i = 0; i < Math.round(len / 0.32) - (r === rows - 1 ? 1 : 0); i++) { const m = this.mesh(geo, M.sand, -len / 2 + 0.16 + i * 0.32 + (r % 2) * 0.16, 0.1 + r * 0.17, (Math.random() - 0.5) * 0.04, g); m.rotation.z = Math.PI / 2; m.scale.set(1, 1.35, 0.8); } return g; },
  cart() { // two-wheeled hand cart: plank bed on a frame, slatted sides, spoked iron-shod wheels on an axle, long shafts with grips, sacks and a spade
    const M = this.mats(), g = this.g(), L = 1.5, Wd = 0.95, by = 0.62;
    this.box(L, 0.06, Wd, M.timber, 0, by, 0, g); for (const s of [-1, 1]) this.box(L + 0.1, 0.1, 0.08, M.timberDark, 0.05, by - 0.08, s * (Wd / 2 - 0.04), g);
    for (const s of [-1, 1]) { for (const y of [0.16, 0.34]) this.box(L, 0.08, 0.04, M.timber, 0, by + y, s * (Wd / 2), g); for (const x of [-L / 2 + 0.05, 0, L / 2 - 0.05]) this.box(0.05, 0.42, 0.05, M.timberDark, x, by + 0.2, s * (Wd / 2), g); }
    for (const y of [0.16, 0.34]) this.box(0.04, 0.08, Wd, M.timber, -L / 2, by + y, 0, g);
    const ax = this.cyl(0.04, 0.04, Wd + 0.3, M.iron, -0.1, 0.42, 0, g, 8); ax.rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) this.wheel(g, -0.1, 0.42, s * (Wd / 2 + 0.12), 0.42, 0.08, M.iron, M.timberDark, 8);
    for (const s of [-1, 1]) { const sh = this.box(1.3, 0.06, 0.06, M.timberDark, L / 2 + 0.55, by - 0.18, s * 0.32, g); sh.rotation.z = -0.25; this.cyl(0.03, 0.03, 0.18, M.leather, L / 2 + 1.15, by - 0.35, s * 0.32, g, 6).rotation.x = Math.PI / 2; } this.box(0.05, 0.05, 0.7, M.timberDark, L / 2 + 0.3, by - 0.12, 0, g);
    for (const [x, z] of [[-0.35, -0.2], [0.05, 0.15], [-0.15, 0.25]]) { const sk = this.mesh(new this.T.CapsuleGeometry(0.16, 0.25, 4, 8), M.sand, x, by + 0.2, z, g); sk.rotation.z = Math.PI / 2; sk.scale.set(1, 1, 0.8); }
    const sp = this.box(0.04, 1.1, 0.04, M.timber, 0.45, by + 0.45, -0.25, g); sp.rotation.z = -0.7; return g; },
  car(color) { // abandoned saloon: extruded body with wheel arches, glasshouse with pillars, bumpers, lamps, flat tyres on steel wheels, rust and grime
    const M = this.mats(), g = this.g(), paint = IF.mat.metal(color || '#5a2a24', 0.7, 0.4), L = 3.6, Wd = 1.62;
    const body = [[-1.8, 0.28], [-1.82, 0.62], [-1.72, 0.78], [-1.0, 0.82], [1.05, 0.8], [1.78, 0.68], [1.82, 0.42], [1.78, 0.28], [1.45, 0.28], [1.42, 0.52], [1.22, 0.7], [0.92, 0.72], [0.72, 0.52], [0.7, 0.28], [-0.7, 0.28], [-0.72, 0.52], [-0.92, 0.72], [-1.22, 0.7], [-1.42, 0.52], [-1.45, 0.28]];
    this.profile(body, Wd, paint, g, 0.05);
    this.profile([[-1.0, 0.8], [-0.62, 1.28], [0.42, 1.3], [0.9, 0.82]], Wd - 0.16, paint, g, 0.04);
    for (const s of [-1, 1]) { this.profile([[-0.9, 0.84], [-0.58, 1.22], [0.38, 1.24], [0.78, 0.84]], 0.02, M.glass, g, 0).position.z = s * (Wd / 2 - 0.07); }
    const ws = this.box(0.02, 0.56, Wd - 0.3, M.glass, 0.66, 1.05, 0, g); ws.rotation.z = 0.83; const rw = this.box(0.02, 0.5, Wd - 0.3, M.glass, -0.82, 1.05, 0, g); rw.rotation.z = -0.9;
    for (const s of [-1, 1]) this.box(0.08, 0.46, 0.06, paint, -0.12, 1.05, s * (Wd / 2 - 0.08), g); // B-pillars
    for (const x of [-1.86, 1.86]) this.box(0.08, 0.12, Wd + 0.04, IF.mat.metal('#8a8a88', 0.35, 0.9), x, 0.36, 0, g); // bumpers
    for (const s of [-1, 1]) { this.cyl(0.08, 0.08, 0.04, IF.mat.basic('#d8d2b8', 0.2, 0.3), 1.83, 0.6, s * 0.55, g, 12).rotation.z = Math.PI / 2; this.box(0.03, 0.08, 0.2, IF.mat.basic('#6a0a08', 0.3), -1.83, 0.62, s * 0.6, g); }
    for (const sx of [-1.07, 1.07]) for (const s of [-1, 1]) this.wheel(g, sx, 0.34, s * (Wd / 2 - 0.12), 0.33, 0.2, M.tyre, IF.mat.metal('#5a5a58', 0.6, 0.7), 0);
    const grime = this.box(L - 0.2, 0.18, Wd + 0.01, M.rust, 0, 0.36, 0, g); grime.scale.set(1, 1, 1); g.rotation.z = (Math.random() - 0.5) * 0.04; return g; },
  jeep() { // WWII utility jeep: slab body with flat hood, slotted grille, cut-down sides, flat fenders, folding windscreen, canvas top on bows, spare wheel, star
    const M = this.mats(), g = this.g(), L = 3.3, Wd = 1.5, o = M.olive;
    this.profile([[-1.55, 0.42], [-1.6, 0.95], [0.35, 0.95], [0.4, 1.05], [1.55, 1.02], [1.62, 0.6], [1.6, 0.42]], Wd, o, g, 0.03);
    for (const s of [-1, 1]) this.box(1.0, 0.04, 0.3, o, 1.05, 0.82, s * (Wd / 2 + 0.1), g); for (const s of [-1, 1]) this.box(0.9, 0.04, 0.28, o, -1.05, 0.8, s * (Wd / 2 + 0.08), g); // fenders
    for (let i = 0; i < 9; i++) this.box(0.02, 0.36, 0.05, M.dark, 1.63, 0.72, -0.4 + i * 0.1, g); for (const s of [-1, 1]) this.cyl(0.08, 0.08, 0.05, IF.mat.basic('#c8c2a8', 0.2, 0.3), 1.64, 0.88, s * 0.5, g, 12).rotation.z = Math.PI / 2;
    const fr = this.box(0.04, 0.5, Wd - 0.1, o, 0.35, 1.3, 0, g); fr.rotation.z = -0.2; this.box(0.02, 0.4, Wd - 0.2, M.glass, 0.37, 1.3, 0, g).rotation.z = -0.2;
    for (const x of [-1.2, -0.4]) { const bow = this.mesh(new this.T.TorusGeometry(Wd / 2 - 0.05, 0.02, 4, 12, Math.PI), M.iron, x, 1.05, 0, g); bow.rotation.y = Math.PI / 2; bow.scale.set(1, 0.9, 1); }
    const top = this.box(0.95, 0.04, Wd - 0.04, M.canvas, -0.8, 1.72, 0, g);
    for (const sx of [-1.0, 1.05]) for (const s of [-1, 1]) this.wheel(g, sx, 0.41, s * (Wd / 2 - 0.05), 0.4, 0.22, M.tyre, o, 0);
    this.wheel(g, -1.72, 0.85, 0, 0.36, 0.2, M.tyre, o, 0).rotation.y = Math.PI / 2;
    this.mesh(new this.T.CircleGeometry(0.2, 20), M.white, 0.9, 1.06, 0, g).rotation.x = -Math.PI / 2; IF.kit.emblemMesh(g, 0.9, 1.065, 0, 0.2, '#a3181e'); return g; },
  bus() { // burnt-out delivery van: boxy body with cab, windscreen, side door and window, roof rack, smashed lamp, flat tyres
    const M = this.mats(), g = this.g(), p = IF.mat.metal('#8a6a24', 0.75, 0.35), Wd = 1.9;
    this.profile([[-2.3, 0.4], [-2.32, 2.1], [0.9, 2.12], [1.25, 1.95], [1.75, 1.25], [2.3, 1.15], [2.32, 0.45], [2.25, 0.4], [1.95, 0.4], [1.9, 0.62], [1.68, 0.8], [1.35, 0.8], [1.15, 0.62], [1.1, 0.4], [-1.1, 0.4], [-1.15, 0.62], [-1.35, 0.8], [-1.68, 0.8], [-1.9, 0.62], [-1.95, 0.4]], Wd, p, g, 0.04);
    const ws = this.box(0.02, 0.8, Wd - 0.2, M.glass, 1.52, 1.58, 0, g); ws.rotation.z = 0.68;
    for (const s of [-1, 1]) { this.box(0.7, 0.55, 0.02, M.glass, 1.1, 1.55, s * (Wd / 2 + 0.005), g); this.box(1.0, 1.5, 0.02, IF.mat.metal('#6a5020', 0.8, 0.3), -0.2, 1.15, s * (Wd / 2 + 0.006), g); }
    for (let i = 0; i < 6; i++) this.box(0.04, 0.06, Wd - 0.1, M.iron, -2 + i * 0.55, 2.2, 0, g); for (const s of [-1, 1]) this.box(3.2, 0.05, 0.04, M.iron, -0.65, 2.25, s * (Wd / 2 - 0.08), g);
    this.box(0.1, 0.16, Wd + 0.04, IF.mat.metal('#5a5a58', 0.5, 0.8), 2.35, 0.55, 0, g); this.box(0.1, 0.16, Wd + 0.04, IF.mat.metal('#5a5a58', 0.5, 0.8), -2.37, 0.55, 0, g);
    for (const sx of [-1.52, 1.52]) for (const s of [-1, 1]) this.wheel(g, sx, 0.37, s * (Wd / 2 - 0.12), 0.36, 0.24, M.tyre, IF.mat.metal('#4a4a48', 0.7, 0.6), 0);
    const soot = this.box(2.4, 0.9, Wd + 0.02, IF.mat.basic('#120c08', 1), -0.9, 1.65, 0, g); soot.scale.set(1, 1, 1); soot.material = IF.mat.get('sootT', () => new this.T.MeshStandardMaterial({ color: '#0a0604', transparent: true, opacity: 0.45, roughness: 1 })); soot.castShadow = false;
    g.rotation.z = 0.02; return g; },
  tank() { // knocked-out light tank: sloped hull, tracks on road wheels with skirts, turret with mantlet and gun, hatch, spare track links
    const M = this.mats(), g = this.g(), o = M.olive, Wd = 2.4;
    this.profile([[-2.3, 0.55], [-2.4, 1.15], [-1.9, 1.35], [1.6, 1.35], [2.4, 1.0], [2.35, 0.55]], Wd - 0.7, o, g, 0.04);
    for (const s of [-1, 1]) { const z = s * (Wd / 2 - 0.3); this.profile([[-2.45, 0.25], [-2.6, 0.55], [-2.35, 0.82], [2.35, 0.82], [2.6, 0.55], [2.45, 0.25], [2.2, 0.05], [-2.2, 0.05]], 0.5, M.dark, g, 0.02).position.z = z; for (let i = 0; i < 6; i++) { const rw = this.cyl(0.26, 0.26, 0.52, M.iron, -1.75 + i * 0.7, 0.32, z, g, 14); rw.rotation.x = Math.PI / 2; } this.box(4.6, 0.3, 0.04, o, 0, 0.92, s * (Wd / 2 + 0.0), g); }
    const tur = this.profile([[-0.95, 1.35], [-1.05, 1.75], [-0.7, 2.0], [0.7, 2.0], [1.0, 1.75], [0.9, 1.35]], 1.6, o, g, 0.05); tur.position.x = -0.2;
    this.box(0.3, 0.4, 0.5, o, 0.85, 1.7, 0, g); const gun = this.cyl(0.07, 0.08, 2.3, o, 2.1, 1.72, 0, g, 10); gun.rotation.z = Math.PI / 2 - 0.12; this.cyl(0.1, 0.1, 0.25, o, 3.22, 1.86, 0, g, 10).rotation.z = Math.PI / 2 - 0.12;
    this.cyl(0.3, 0.3, 0.1, o, -0.4, 2.05, 0.3, g, 12); const hatch = this.cyl(0.3, 0.3, 0.05, o, -0.65, 2.3, 0.3, g, 12); hatch.rotation.z = 1.1;
    for (let i = 0; i < 5; i++) this.box(0.18, 0.04, 0.45, M.dark, -1.5 + i * 0.2, 1.37, -0.6, g);
    const burn = this.box(1.2, 0.02, 1.0, IF.mat.basic('#0e0a08', 1), 0.9, 1.36, 0.2, g); burn.castShadow = false; g.rotation.z = -0.03; return g; },
  container(color) { const M = this.mats(), g = this.g(), p = IF.mat.metal(color || '#6a2a1e', 0.75, 0.5); this.box(2.4, 1.2, 1.2, p, 0, 0.6, 0, g); for (let i = 0; i < 12; i++) this.box(0.03, 1.1, 1.22, p, -1.1 + i * 0.2, 0.6, 0, g); return g; },
  barricade() { // survivor barricade: knife-rest frame (crossed timbers + rail) faced with salvaged planks and a door, sandbags at the foot, a hand-painted sign
    const M = this.mats(), g = this.g(), L = 1.6;
    for (const x of [-L / 2 + 0.1, L / 2 - 0.1]) for (const s of [-1, 1]) { const leg = this.box(0.08, 1.1, 0.08, M.timberDark, x, 0.5, 0, g); leg.rotation.x = s * 0.45; }
    this.box(L, 0.08, 0.08, M.timberDark, 0, 0.92, 0, g);
    for (let i = 0; i < 5; i++) { const b = this.box(L * (0.8 + (i % 3) * 0.08), 0.14, 0.04, i === 2 ? IF.mat.wood('#6a5040') : M.timber, (i % 2 ? 0.06 : -0.05), 0.2 + i * 0.16, 0.22, g); b.rotation.z = ((i * 37) % 7 - 3) * 0.025; }
    this.box(0.6, 0.85, 0.04, IF.mat.wood('#4a3a2a'), 0.35, 0.5, 0.25, g); this.mesh(new this.T.TorusGeometry(0.03, 0.008, 4, 8), M.iron, 0.55, 0.5, 0.28, g);
    const sign = this.box(0.5, 0.25, 0.02, IF.mat.wood('#8a7a5a'), -0.4, 1.05, 0.26, g); sign.rotation.z = 0.08; this.box(0.36, 0.05, 0.005, IF.mat.basic('#7a0e0a', 0.8), -0.4, 1.06, 0.272, g).rotation.z = 0.08;
    const sb = this.sandbags(1.3, 2); sb.position.set(0, 0, 0.5); g.add(sb); return g; },
  rubble(n = 9) { const M = this.mats(), g = this.g(); for (let i = 0; i < n; i++) { const r = 0.12 + Math.random() * 0.25; const m = this.mesh(new this.T.DodecahedronGeometry(r, 0), Math.random() < 0.5 ? M.stone : M.concrete, (Math.random() - 0.5) * 1.1, r * 0.6, (Math.random() - 0.5) * 0.6, g); m.rotation.set(Math.random() * 3, Math.random() * 3, 0); } if (Math.random() < 0.6) { const rb = this.cyl(0.015, 0.015, 0.9, M.rust, 0.2, 0.4, 0, g, 5); rb.rotation.z = 0.7; } return g; },
  fence(len = 1.4) { // split-rail fence at a real 1.05 m: posts with a little weathered lean, two rails, a bracing slat
    const M = this.mats(), g = this.g(), n = Math.max(2, Math.round(len / 0.9));
    for (let i = 0; i <= n; i++) { const p = this.box(0.08, 1.05, 0.08, M.timberDark, -len / 2 + i * len / n, 0.5, 0, g); p.rotation.z = (Math.random() - 0.5) * 0.08; this.box(0.1, 0.05, 0.1, M.timberDark, p.position.x, 1.03, 0, g); }
    for (const y of [0.45, 0.88]) this.box(len + 0.08, 0.07, 0.05, M.timber, 0, y, 0.06, g);
    const br = this.box(Math.hypot(len / n, 0.43), 0.05, 0.04, M.timber, -len / 2 + len / n / 2, 0.665, 0.09, g); br.rotation.z = Math.atan2(0.43, len / n);
    return g; },
  well() { // stone well: 1.3 m ring at waist height, timber posts, windlass with rope and bucket, shingled hood at ~2.3 m
    const M = this.mats(), g = this.g(), T = this.T;
    const ring = this.mesh(new T.CylinderGeometry(0.65, 0.7, 0.78, 20, 1, true), M.stone, 0, 0.39, 0, g); ring.material = M.stone;
    this.mesh(new T.CylinderGeometry(0.52, 0.52, 0.76, 20, 1, true), M.stoneDark, 0, 0.4, 0, g).material.side = T.DoubleSide;
    this.mesh(new T.TorusGeometry(0.6, 0.09, 6, 20), M.stoneDark, 0, 0.8, 0, g).rotation.x = Math.PI / 2; // capstones
    this.mesh(new T.CircleGeometry(0.52, 18), IF.mat.basic('#050607', 0.2, 0.3), 0, 0.15, 0, g).rotation.x = -Math.PI / 2; // dark water far below
    for (const s of [-1, 1]) this.box(0.12, 1.75, 0.12, M.timberDark, s * 0.62, 1.2, 0, g);
    const axle = this.cyl(0.06, 0.06, 1.3, M.timber, 0, 1.55, 0, g, 8); axle.rotation.z = Math.PI / 2;
    const crank = this.box(0.04, 0.3, 0.04, M.iron, 0.72, 1.45, 0.08, g);
    this.cyl(0.008, 0.008, 0.55, IF.mat.basic('#8a7a5a', 0.9), 0, 1.25, 0, g, 4);
    const bucket = this.cyl(0.13, 0.11, 0.2, IF.mat.wood('#6a4a2a'), 0, 0.92, 0, g, 10); this.mesh(new T.TorusGeometry(0.13, 0.012, 4, 12), M.iron, 0, 0.98, 0, g).rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) { const r = this.box(1.55, 0.06, 0.95, this.roofMat(), 0, 2.08, s * 0.4, g); r.rotation.x = s * 0.62; }
    this.box(1.6, 0.1, 0.1, M.timberDark, 0, 2.38, 0, g);
    return g; },
  log() { const M = this.mats(), g = this.g(); const l = this.cyl(0.16, 0.18, 1.3, M.bark, 0, 0.16, 0, g); l.rotation.z = Math.PI / 2; return g; },
  stump() { const M = this.mats(), g = this.g(); this.cyl(0.2, 0.26, 0.32, M.bark, 0, 0.16, 0, g); return g; },
  rockProp(w = 0.7) { const M = this.mats(), g = this.g(); const m = this.mesh(new this.T.DodecahedronGeometry(w / 2, 1), M.rock, 0, w * 0.22, 0, g); m.scale.set(1, 0.6, 0.8); this.jitter(m.geometry, 0.08); return g; },
  banner(clothMat) { const M = this.mats(), g = this.g(); this.cyl(0.03, 0.035, 1.8, M.timberDark, 0, 0.9, 0, g, 6); const cloth = this.mesh(new this.T.PlaneGeometry(0.45, 0.85, 4, 8), clothMat || this.heraldryMat(), 0.24, 1.35, 0, g); cloth.userData.wave = true; this.box(0.6, 0.03, 0.03, M.timberDark, 0.24, 1.78, 0, g); g.userData.cloth = cloth; return g; },
  brazier() { const M = this.mats(), g = this.g(); this.cyl(0.03, 0.03, 0.7, M.iron, 0, 0.35, 0, g); this.cyl(0.24, 0.12, 0.2, M.iron, 0, 0.78, 0, g, 10); const T = this.T, fm = (c, o) => IF.mat.get('flame' + c, () => new T.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: T.AdditiveBlending, depthWrite: false }));
    const flameGeo = this._flameGeo || (this._flameGeo = (() => { const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new T.Vector2(Math.sin(Math.PI * Math.pow(t, 0.7)) * 0.16 * (1 - t * 0.4), t * 0.5)); } return new T.LatheGeometry(pts, 10); })());
    [['#c8340a', 0.42, 1.15], ['#e8701a', 0.38, 0.82], ['#ffc860', 0.45, 0.45]].forEach(([c, o, k], i) => { const f = new T.Mesh(flameGeo, fm(c, o)); f.position.set(0, 0.86, 0); f.scale.set(k, k * (1.1 - i * 0.1), k); f.castShadow = false; f.renderOrder = 2 + i; f.userData.flame = true; g.add(f); }); g.userData.light = { y: -95, i: 4, c: '#ff8a3a' }; return g; },
  barrier() { const M = this.mats(), g = this.g(); const sh = new this.T.Shape(); sh.moveTo(-0.32, 0); sh.lineTo(0.32, 0); sh.lineTo(0.12, 0.2); sh.lineTo(0.08, 0.44); sh.lineTo(-0.08, 0.44); sh.lineTo(-0.12, 0.2); sh.closePath(); const geo = new this.T.ExtrudeGeometry(sh, { depth: 1.1, bevelEnabled: false }); const m = this.mesh(geo, M.concrete, 0.55, 0, 0, g); m.rotation.y = -Math.PI / 2; for (let i = 0; i < 3; i++) this.box(0.18, 0.06, 0.01, IF.mat.basic('#a3181e', 0.7), -0.3 + i * 0.3, 0.36, 0.1, g); return g; },
  tyres() { const M = this.mats(), g = this.g(); for (let i = 0; i < 3; i++) { const t = this.mesh(new this.T.TorusGeometry(0.24, 0.09, 8, 18), M.tyre, (Math.random() - 0.5) * 0.06, 0.09 + i * 0.17, 0, g); t.rotation.x = Math.PI / 2; } return g; },
  cone() { const g = this.g(); this.mesh(new this.T.ConeGeometry(0.11, 0.32, 12), IF.mat.basic('#d0601a', 0.6), 0, 0.16, 0, g); return g; },
  hydrant() { const g = this.g(), m = IF.mat.metal('#8a1a14', 0.5, 0.5); this.cyl(0.08, 0.1, 0.32, m, 0, 0.16, 0, g); this.mesh(new this.T.SphereGeometry(0.08, 10, 6, 0, 6.3, 0, 1.6), m, 0, 0.32, 0, g); return g; },
  wire(len = 1.3) { const M = this.mats(), g = this.g(); for (let i = 0; i < 4; i++) { const t = this.mesh(new this.T.TorusGeometry(0.17, 0.006, 4, 24), M.steel, -len / 2 + 0.17 + i * 0.32, 0.17, 0, g); t.rotation.y = Math.PI / 2 + (Math.random() - 0.5) * 0.4; } for (const s of [-1, 1]) this.box(0.04, 0.4, 0.04, M.timberDark, s * len / 2, 0.2, 0, g); return g; },
  crater(r = 0.7) { const g = this.g(); const m = this.mesh(new this.T.RingGeometry(r * 0.3, r, 20), IF.mat.basic('#1e1814', 1), 0, 0.02, 0, g); m.rotation.x = -Math.PI / 2; m.castShadow = false; return g; },
  pallet() { const M = this.mats(), g = this.g(); for (let i = 0; i < 5; i++) this.box(0.8, 0.03, 0.12, M.timber, 0, 0.2, -0.4 + i * 0.2, g); for (const x of [-0.35, 0, 0.35]) this.box(0.1, 0.17, 0.95, M.timberDark, x, 0.09, 0, g); return g; },
  locker() { const g = this.g(), m = IF.mat.metal('#4a5258', 0.6, 0.6); this.box(0.4, 0.9, 0.35, m, 0, 0.45, 0, g); for (let i = 0; i < 4; i++) this.box(0.25, 0.015, 0.01, IF.mat.basic('#111'), 0, 0.75 - i * 0.03, 0.18, g); return g; },
  gurney() { const M = this.mats(), g = this.g(); this.box(0.9, 0.05, 0.5, M.steel, 0, 0.42, 0, g); for (const x of [-0.38, 0.38]) for (const z of [-0.2, 0.2]) this.cyl(0.015, 0.015, 0.42, M.steel, x, 0.21, z, g, 6); this.box(0.85, 0.08, 0.45, M.white, 0, 0.48, 0, g); this.box(0.2, 0.09, 0.3, IF.mat.blood(), 0.1, 0.49, 0, g); return g; },
  prop(type, explosive) {
    const map = { crate: () => this.crate(), barrel: () => this.barrel(false), xbarrel: () => this.barrel(true), barrels: () => this.barrels(), sandbags: () => this.sandbags(1.2), cart: () => this.cart(),
      car: () => this.car(['#5a2a24', '#2a3a4a', '#4a4a48', '#6a6a60'][Math.floor(Math.random() * 4)]), jeep: () => this.jeep(), bus: () => this.bus(), tank: () => this.tank(), container: () => this.container(['#6a2a1e', '#2a4a5a', '#5a5a2a'][Math.floor(Math.random() * 3)]),
      barricade: () => this.barricade(), rubble: () => this.rubble(), fence: () => this.fence(), well: () => this.well(), log: () => this.log(), stump: () => this.stump(), rock: () => this.rockProp(), banner: () => this.banner(), brazier: () => this.brazier(),
      barrier: () => this.barrier(), tyres: () => this.tyres(), cone: () => this.cone(), hydrant: () => this.hydrant(), wire: () => this.wire(), crater: () => this.crater(), pallet: () => this.pallet(), locker: () => this.locker(), gurney: () => this.gurney() };
    return (map[type] || map.crate)();
  },

  /* ---------- structures (set dressing) ---------- */
  cottage(rng, ruined) {
    const M = this.mats(), g = this.g(), w = 3 + rng.next() * 2, d = 2.6 + rng.next(), h = 2.2 + rng.next() * 0.8;
    const wall = rng.chance(0.5) ? M.stone : M.plaster;
    this.box(w, h, d, wall, 0, h / 2, 0, g);
    // timber framing
    for (let i = 0; i <= 3; i++) this.box(0.12, h, 0.05, M.timberDark, -w / 2 + i * w / 3, h / 2, d / 2 + 0.02, g);
    this.box(w, 0.12, 0.05, M.timberDark, 0, h * 0.55, d / 2 + 0.02, g);
    // windows (dark or lit)
    for (const wx of [-w * 0.28, w * 0.28]) { const lit = rng.chance(0.25); this.box(0.45, 0.55, 0.06, lit ? IF.mat.glow('#ff9a40', 1.4) : M.dark, wx, h * 0.62, d / 2 + 0.03, g); this.box(0.55, 0.06, 0.08, M.timberDark, wx, h * 0.62 - 0.32, d / 2 + 0.05, g); if (lit) g.userData.lit = (g.userData.lit || 0) + 1; }
    this.door(g, 0, d, rng, wall === M.stone);
    const rh = 1.2 + rng.next() * 0.5;
    this.gabledRoof(g, w, d, h, rh, rng.chance(0.5) ? M.thatch : this.roofMat(), wall, ruined, rng);
    this.foundation(g, w, d); if (wall !== M.stone) this.corners(g, w, d, h);
    if (rng.chance(0.6)) { const cx = w * 0.3, cz = -d * 0.22, ch = h + rh * (1 - Math.abs(cz) / (d / 2)) + 0.7; this.box(0.5, ch, 0.5, M.stoneDark, cx, ch / 2, cz, g); this.box(0.62, 0.1, 0.62, M.stone, cx, ch + 0.05, cz, g); } // chimney rises from the ground through the roof, with a cap
    return g;
  },
  /* Settlement architecture: picks a distinct building type so streets never repeat one model. */
  house(rng, ruined) {
    const k = rng.next();
    return k < 0.3 ? this.cottage(rng, ruined) : k < 0.55 ? this.townhouse(rng, ruined) : k < 0.8 ? this.longhouse(rng, ruined) : this.forge(rng, ruined);
  },
  roofMat() { return IF.mat.get('shingle', () => { const T = this.T, tex = IF.mat.canvasTex(256, (c, n) => { c.fillStyle = '#3a221a'; c.fillRect(0, 0, n, n); for (let r = 0; r < 8; r++) for (let i = 0; i < 9; i++) { const x = i * 32 + (r % 2) * 16 - 16, y = r * 32; c.fillStyle = 'hsl(' + (8 + Math.random() * 12) + ',' + (25 + Math.random() * 15) + '%,' + (20 + Math.random() * 12) + '%)'; c.beginPath(); c.moveTo(x + 1, y); c.lineTo(x + 31, y); c.lineTo(x + 31, y + 24); c.quadraticCurveTo(x + 16, y + 32, x + 1, y + 24); c.closePath(); c.fill(); c.strokeStyle = 'rgba(0,0,0,0.5)'; c.stroke(); } }); tex.repeat.set(1, 1); const m = new T.MeshStandardMaterial({ map: tex, roughness: 0.9 }); m.userData.worldUV = 1.6; return m; }); },
  /* Roof that actually sits on its walls: each pitch is a slab whose underside runs from the ridge to past the
   * wall-plate (0.35 m eave overhang), wall plates and a ridge beam close every joint, gables are solid. */
  gabledRoof(g, w, d, h, rh, mat, wallMat, ruined, rng) {
    const M = this.mats(), a = Math.atan2(rh, d / 2), Lr = Math.hypot(rh, d / 2), ov = 0.35, th = 0.14, L = Lr + ov + 0.06;
    for (const s of [-1, 1]) {
      const dz = s * Math.cos(a), dy = -Math.sin(a), cz = dz * (L / 2 - 0.06), cy = h + rh + dy * (L / 2 - 0.06), nz = s * Math.sin(a) * th / 2, ny = Math.cos(a) * th / 2;
      if (ruined && s > 0 && rng.chance(0.6)) { for (let i = 0; i < 7; i++) { const r = this.box(0.09, 0.09, L, M.timberDark, -w / 2 + 0.3 + i * (w - 0.6) / 6, cy, cz, g); r.rotation.x = s * a; } continue; }
      const slab = this.box(w + 0.5, th, L, mat, 0, cy + ny, cz + nz, g); slab.rotation.x = s * a;
      const fascia = this.box(w + 0.52, 0.18, 0.05, M.timberDark, 0, h + rh + dy * (L - 0.06) - 0.02, dz * (L - 0.06), g); // eave board
    }
    for (const s of [-1, 1]) this.box(w + 0.1, 0.16, 0.2, M.timberDark, 0, h + 0.08, s * (d / 2 - 0.08), g); // wall plates
    const ridge = this.box(w + 0.55, 0.14, 0.14, M.timberDark, 0, h + rh + 0.09, 0, g); ridge.rotation.x = Math.PI / 4;
    for (const s of [-1, 1]) { const gable = new this.T.Shape(); gable.moveTo(-d / 2, 0); gable.lineTo(d / 2, 0); gable.lineTo(0, rh); gable.closePath(); const m = this.mesh(new this.T.ExtrudeGeometry(gable, { depth: 0.2, bevelEnabled: false }), wallMat, 0, h, 0, g); m.rotation.y = Math.PI / 2; m.position.x = s * w / 2 + (s < 0 ? 0.0 : -0.2); }
    for (const s of [-1, 1]) { const barge = this.box(0.06, 0.16, Lr + 0.1, M.timberDark, s * (w / 2 + 0.22), h + rh / 2 + 0.06, 0.0, g); barge.visible = false; }
  },
  foundation(g, w, d) { const M = this.mats(); this.box(w + 0.16, 0.32, d + 0.16, M.stoneDark, 0, 0.12, 0, g); }, // stone plinth: buildings sit on the ground, never float
  corners(g, w, d, h) { const M = this.mats(); for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.box(0.16, h, 0.16, M.timberDark, sx * (w / 2 - 0.02), h / 2, sz * (d / 2 - 0.02), g); },
  frontWindows(g, w, h, d, y, n, rng, shutters) {
    const M = this.mats();
    for (let i = 0; i < n; i++) { const x = -w / 2 + (i + 0.5) * w / n; if (Math.abs(x) < 0.5 && y < 1.5) continue; const lit = rng.chance(0.2), broken = rng.chance(0.3);
      this.box(0.5, 0.65, 0.08, lit ? IF.mat.glow('#ff9a40', 1.4) : M.dark, x, y, d / 2 + 0.03, g); this.box(0.62, 0.08, 0.14, M.timberDark, x, y - 0.37, d / 2 + 0.06, g); this.box(0.06, 0.65, 0.1, M.timberDark, x, y, d / 2 + 0.06, g);
      if (shutters) for (const s of [-1, 1]) { if (broken && s > 0) continue; const sh = this.box(0.26, 0.66, 0.04, IF.mat.wood('#4a3a2a'), x + s * 0.4, y, d / 2 + 0.06, g); if (broken) sh.rotation.z = 0.4; }
      if (lit) g.userData.lit = (g.userData.lit || 0) + 1; }
  },
  door(g, x, d, rng, arch) { const M = this.mats(); this.box(0.95, 1.95, 0.1, IF.mat.wood('#4a2e18'), x, 0.975 + 0.2, d / 2 + 0.04, g); for (const y of [0.6, 1.7]) this.box(0.95, 0.07, 0.13, M.iron, x, y, d / 2 + 0.06, g); this.box(1.2, 0.16, 0.2, arch ? M.stone : M.timberDark, x, 2.25, d / 2 + 0.06, g); this.box(1.2, 0.18, 0.4, M.stoneDark, x, 0.09, d / 2 + 0.2, g); /* threshold step */ if (rng.chance(0.3)) { const plank = this.box(1.1, 0.12, 0.08, M.timber, x, 1.0, d / 2 + 0.14, g); plank.rotation.z = 0.5; } },
  damage(g, w, h, d, rng) { // blackened scorch, a broken corner and fallen stones
    const M = this.mats(); this.box(w * (0.3 + rng.next() * 0.3), h * 0.5, 0.02, IF.mat.basic('#0e0a08', 1), (rng.next() - 0.5) * w * 0.5, h * 0.7, d / 2 + 0.08, g);
    for (let i = 0; i < 6; i++) { const r = this.box(0.25 + rng.next() * 0.3, 0.2, 0.3, M.stone, w / 2 + rng.next() * 1.2, 0.1, d / 2 + rng.next() * 0.8, g); r.rotation.y = rng.next() * 3; }
  },
  townhouse(rng, ruined) { // two storeys: stone ground floor, jettied timber-framed upper floor, steep tiled roof
    const M = this.mats(), g = this.g(), w = 3.2 + rng.next() * 1.4, d = 3, h1 = 2.4, h2 = 2.2;
    this.box(w, h1, d, M.stone, 0, h1 / 2, 0, g); this.foundation(g, w, d);
    this.box(w + 0.3, h2, d + 0.5, M.plaster, 0, h1 + h2 / 2, 0.15, g); // jetty overhang
    this.box(w + 0.4, 0.16, d + 0.6, M.timberDark, 0, h1, 0.15, g);
    for (let i = 0; i <= 4; i++) this.box(0.13, h2, 0.06, M.timberDark, -w / 2 - 0.15 + i * (w + 0.3) / 4, h1 + h2 / 2, d / 2 + 0.42, g);
    for (let i = 0; i < 4; i++) { const br = this.box(0.1, Math.hypot(h2, (w + 0.3) / 4), 0.05, M.timberDark, -w / 2 - 0.15 + (i + 0.5) * (w + 0.3) / 4, h1 + h2 / 2, d / 2 + 0.43, g); br.rotation.z = (i % 2 ? 1 : -1) * Math.atan2((w + 0.3) / 4, h2); }
    this.door(g, -w * 0.25, d, rng, true); this.frontWindows(g, w, h1, d, 1.5, 2, rng, true);
    const up = this.g(); up.position.z = 0.4; g.add(up); this.frontWindows(up, w, h2, d, h1 + h2 * 0.55, 3, rng, true);
    this.gabledRoof(g, w + 0.3, d + 0.6, h1 + h2, 1.8 + rng.next() * 0.6, this.roofMat(), M.plaster, ruined, rng);
    { const ch = h1 + h2 + 2.2; this.box(0.55, ch, 0.55, M.stoneDark, w * 0.32, ch / 2, -0.7, g); this.box(0.68, 0.1, 0.68, M.stone, w * 0.32, ch + 0.05, -0.7, g); }
    if (ruined) this.damage(g, w, h1, d, rng);
    return g;
  },
  longhouse(rng, ruined) { // long, low, thick thatch hipped almost to the ground, wattle walls and a smoke hole
    const M = this.mats(), g = this.g(), w = 6 + rng.next() * 2, d = 3.2, h = 2.3;
    this.box(w, h, d, IF.mat.plaster('#8a7a5c'), 0, h / 2, 0, g); this.foundation(g, w, d);
    for (let x = -w / 2; x <= w / 2; x += 0.8) this.box(0.14, h, 0.1, M.timberDark, x, h / 2, d / 2 + 0.03, g);
    this.door(g, w * 0.15, d, rng, false); this.frontWindows(g, w, h, d, 1.0, 3, rng, false);
    const rh = 2.2, thatch = M.thatch;
    const roof = this.mesh(new this.T.CylinderGeometry(0.4, 1, rh, 4, 1), thatch, 0, h + rh / 2 - 0.1, 0, g); roof.rotation.y = Math.PI / 4; roof.scale.set((w + 0.9) / 1.41, 1, (d + 1.2) / 1.41);
    if (ruined) { const hole = this.box(1.4, 0.3, 1, M.dark, -w * 0.2, h + rh * 0.55, d * 0.25, g); hole.rotation.x = 0.7; this.damage(g, w, h, d, rng); }
    return g;
  },
  forge(rng, ruined) { // smithy: stone base, open timber lean-to over an anvil, big chimney
    const M = this.mats(), g = this.g(), w = 4, d = 3, h = 2.3;
    this.box(w * 0.55, h, d, M.stone, -w * 0.22, h / 2, 0, g); this.door(g, -w * 0.3, d, rng, true);
    for (const x of [w * 0.15, w * 0.48]) for (const z of [-d / 2 + 0.1, d / 2 - 0.1]) this.box(0.18, h, 0.18, M.timberDark, x, h / 2, z, g);
    const lean = this.box(w * 0.5, 0.12, d + 0.4, this.roofMat(), w * 0.3, h + 0.15, 0, g); lean.rotation.z = -0.25;
    this.box(0.5, 0.35, 0.3, M.iron, w * 0.32, 0.65, 0.4, g); this.box(0.3, 0.45, 0.25, M.stoneDark, w * 0.32, 0.25, 0.4, g); // anvil
    this.box(1.0, h + 2.2, 1.0, M.stoneDark, -w * 0.45, (h + 2.2) / 2, -0.6, g); const coals = this.box(0.6, 0.2, 0.3, IF.mat.glow('#ff5a1a', 2.2), -w * 0.45, 0.6, -0.08, g); coals.castShadow = false;
    g.userData.light = { y: -70, i: 2.5, c: '#ff7a2a', r: 6 }; g.userData.smoke = { y: -(h + 2.4) * 100 };
    const rg = this.g(); rg.position.x = -w * 0.22; g.add(rg); this.gabledRoof(rg, w * 0.55, d, h, 1.3, this.roofMat(), M.stone, ruined, rng);
    if (ruined) this.damage(g, w * 0.55, h, d, rng);
    return g;
  },
  church(rng) {
    const M = this.mats(), g = this.g(), L = 9, W = 4.5, H = 5.5;
    // nave walls with pointed windows (ruined: broken top edge)
    for (const s of [-1, 1]) { const wall = this.box(L, H, 0.5, M.stone, 0, H / 2, s * W / 2, g); }
    for (let i = 0; i < 4; i++) { const x = -L / 2 + 1.4 + i * 2.1; const win = new this.T.Shape(); win.moveTo(-0.4, 0); win.lineTo(0.4, 0); win.lineTo(0.4, 1.4); win.quadraticCurveTo(0.4, 2.1, 0, 2.4); win.quadraticCurveTo(-0.4, 2.1, -0.4, 1.4); win.closePath(); const m = this.mesh(new this.T.ShapeGeometry(win), M.dark, x, 1.8, W / 2 + 0.26, g); }
    // gable front with rose window
    const gb = new this.T.Shape(); gb.moveTo(-W / 2, 0); gb.lineTo(W / 2, 0); gb.lineTo(W / 2, H); gb.lineTo(0, H + 2.2); gb.lineTo(-W / 2, H); gb.closePath();
    const front = this.mesh(new this.T.ExtrudeGeometry(gb, { depth: 0.5, bevelEnabled: false }), M.stone, L / 2, 0, 0, g); front.rotation.y = Math.PI / 2;
    this.mesh(new this.T.CircleGeometry(0.8, 16), IF.mat.glow('#a03020', 0.6), L / 2 + 0.52, H - 0.3, 0, g).rotation.y = Math.PI / 2;
    // broken bell tower
    this.box(2, H + 4.5, 2, M.stoneDark, -L / 2 - 0.5, (H + 4.5) / 2, 0, g);
    for (let i = 0; i < 4; i++) this.box(0.5, 0.6, 0.5, M.stoneDark, -L / 2 - 1.2 + (i % 2) * 1.4, H + 4.8, -0.7 + (i > 1 ? 1.4 : 0), g);
    const cross = this.g(); this.box(0.12, 1.1, 0.12, M.iron, 0, 0.55, 0, cross); this.box(0.6, 0.12, 0.12, M.iron, 0, 0.75, 0, cross); cross.position.set(L / 2 + 0.2, H + 2.2, 0); cross.rotation.z = 0.35; g.add(cross);
    // fallen roof beams
    for (let i = 0; i < 5; i++) { const b = this.box(0.18, 0.18, W + 0.4, M.timberDark, -L / 2 + 1 + i * 1.9, H - 0.3 - (i % 2) * 1.2, 0, g); b.rotation.x = (i % 2 ? 0.35 : -0.1); }
    return g;
  },
  castleWall(len, rng) {
    const M = this.mats(), g = this.g(), H = 6 + rng.next() * 2;
    this.box(len, H, 2.2, M.stone, 0, H / 2, 0, g);
    for (let i = 0; i < len / 1.1; i++) if (rng.chance(0.85)) this.box(0.6, 0.8, 2.3, M.stone, -len / 2 + 0.3 + i * 1.1, H + 0.4, 0, g);
    this.box(len, 0.25, 2.4, M.stoneDark, 0, H * 0.75, 0.02, g);
    if (rng.chance(0.6)) { const breach = this.box(len * 0.18, H * 0.45, 2.4, M.dark, len * (rng.next() - 0.5) * 0.6, H, 0, g); breach.visible = false; }
    return g;
  },
  tower(rng) {
    const M = this.mats(), g = this.g(), H = 9 + rng.next() * 5, R = 2 + rng.next();
    this.cyl(R, R * 1.12, H, M.stone, 0, H / 2, 0, g, 16);
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; this.box(0.6, 0.9, 0.6, M.stone, Math.cos(a) * R, H + 0.45, Math.sin(a) * R, g); }
    if (rng.chance(0.6)) { const roof = this.mesh(new this.T.ConeGeometry(R * 1.2, R * 1.8, 16), M.roofTile, 0, H + R * 0.9 + 0.5, 0, g); }
    for (let i = 0; i < 3; i++) this.box(0.25, 0.8, 0.3, M.dark, Math.cos(i * 2) * R, H * (0.3 + i * 0.2), Math.sin(i * 2) * R + 0.1, g);
    const ban = this.mesh(new this.T.PlaneGeometry(1, 2.4, 2, 6), this.heraldryMat(), 0, H * 0.6, R + 0.05, g); ban.userData.wave = true;
    return g;
  },
  cityBlock(rng) { // ruined tenement: concrete frame with floor cornices, framed windows (some lit, some blown out), shopfront, parapet and exposed rebar
    const M = this.mats(), g = this.g(), w = 4 + rng.next() * 4, d = 4, floors = 2 + Math.floor(rng.next() * 6), fh = 3, h = floors * fh;
    const mat = rng.chance(0.5) ? M.concrete : M.concreteDark;
    this.box(w, h, d, mat, 0, h / 2, 0, g);
    for (let f = 1; f <= floors; f++) this.box(w + 0.16, 0.18, d + 0.16, M.concreteDark, 0, f * fh, 0, g); // floor cornices
    const cols = Math.max(2, Math.floor(w / 1.25));
    for (let f = 1; f < floors; f++) for (let c = 0; c < cols; c++) { const x = -w / 2 + (c + 0.5) * w / cols, y = f * fh + 1.5; if (rng.chance(0.08)) continue; const lit = rng.chance(0.07), blown = rng.chance(0.25);
      this.box(0.8, 1.2, 0.06, lit ? IF.mat.glow('#ff8a3a', 1.4) : M.dark, x, y, d / 2 + 0.02, g); this.box(0.95, 0.1, 0.16, M.concrete, x, y - 0.65, d / 2 + 0.06, g); this.box(0.92, 0.08, 0.1, M.concreteDark, x, y + 0.64, d / 2 + 0.04, g);
      if (blown) { const s2 = this.box(1.0, 0.6, 0.02, IF.mat.basic('#0a0806', 1), x, y + 0.9, d / 2 + 0.03, g); s2.castShadow = false; } } // soot above blown-out windows
    this.box(w * 0.6, 2.2, 0.06, M.dark, -w * 0.15, 1.2, d / 2 + 0.03, g); this.box(w * 0.66, 0.5, 0.2, IF.mat.metal('#5a2a24', 0.7, 0.4), -w * 0.15, 2.55, d / 2 + 0.1, g); // shopfront & fascia
    this.box(1.0, 2.2, 0.08, M.rust, w * 0.32, 1.1, d / 2 + 0.04, g);
    for (let i = 0; i < 4; i++) { const seg = this.box(w / 4, 0.6 + rng.next() * 0.9, 0.25, mat, -w / 2 + w / 8 + i * w / 4, h + 0.35, d / 2 - 0.12, g); if (rng.chance(0.35)) seg.visible = false; } // broken parapet
    for (let i = 0; i < 7; i++) { const rb = this.cyl(0.02, 0.02, 0.6 + rng.next() * 1.2, M.rust, -w / 2 + rng.next() * w, h + 0.5, (rng.next() - 0.5) * d, g, 4); rb.rotation.z = (rng.next() - 0.5) * 0.8; }
    return g;
  },
  /* Corrugated sheet: ribbed normal map + rust streaks running down from the fixings. */
  corrugated(tint = '#8a8478') { return IF.mat.get('corr' + tint, () => { const T = this.T, N = 256, h = new Float32Array(N * N); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) h[y * N + x] = 0.5 + 0.5 * Math.sin(x / N * Math.PI * 2 * 16);
    const map = IF.mat.canvasTex(N, (c, n) => { c.fillStyle = '#9a948a'; c.fillRect(0, 0, n, n); for (let i = 0; i < 40; i++) { const x = Math.random() * n, w = 2 + Math.random() * 6, l = 30 + Math.random() * 200; const gr = c.createLinearGradient(0, 0, 0, l); gr.addColorStop(0, 'rgba(110,50,20,0.55)'); gr.addColorStop(1, 'rgba(110,50,20,0)'); c.fillStyle = gr; c.fillRect(x, Math.random() * 40, w, l); } for (let i = 0; i < 16; i++) for (const y of [8, n - 8]) { c.fillStyle = '#3a2a20'; c.fillRect(i * n / 16 + 6, y, 3, 3); } });
    const m = new T.MeshStandardMaterial({ color: tint, map, normalMap: IF.mat.normalFromHeight(N, h, 4), roughness: 0.7, metalness: 0.55, side: T.DoubleSide }); m.userData.worldUV = 2; return m; }); },
  shack(rng) { // survivor shack: timber frame skinned in corrugated sheet, raised on blocks, lean-to roof with overhang, boarded window, plank door
    const M = this.mats(), g = this.g(), w = 2.6 + rng.next(), h = 2.3, d = 2.2, sheet = this.corrugated(rng.chance(0.5) ? '#8a8478' : '#7a6a5a');
    for (const x of [-w / 2 + 0.2, 0, w / 2 - 0.2]) for (const z of [-d / 2 + 0.2, d / 2 - 0.2]) this.box(0.3, 0.22, 0.3, M.concreteDark, x, 0.11, z, g); // footing blocks
    this.box(w, 0.1, d, M.timber, 0, 0.27, 0, g); // floor deck
    this.box(w, h, d, sheet, 0, 0.32 + h / 2, 0, g);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.box(0.1, h + 0.1, 0.1, M.timberDark, sx * (w / 2 + 0.02), 0.32 + h / 2, sz * (d / 2 + 0.02), g);
    const pitch = 0.18, rl = d + 0.7, roof = this.box(w + 0.6, 0.06, rl, sheet, 0, 0.32 + h + 0.12, 0.1, g); roof.rotation.x = pitch; // single slope, overhang front and sides
    this.box(w + 0.6, 0.12, 0.1, M.timberDark, 0, 0.32 + h + 0.12 - Math.sin(pitch) * rl / 2, 0.1 + Math.cos(pitch) * rl / 2, g);
    this.box(0.85, 1.9, 0.06, IF.mat.wood('#5a4a38'), -w * 0.22, 0.32 + 0.95, d / 2 + 0.03, g); for (const y of [0.7, 1.7]) this.box(0.85, 0.08, 0.08, M.timberDark, -w * 0.22, 0.32 + y, d / 2 + 0.06, g);
    this.box(0.7, 0.55, 0.05, rng.chance(0.3) ? IF.mat.glow('#ff9a40', 1.2) : M.dark, w * 0.22, 0.32 + 1.4, d / 2 + 0.03, g);
    for (let i = 0; i < 3; i++) { const b = this.box(0.82, 0.1, 0.04, M.timber, w * 0.22, 0.32 + 1.25 + i * 0.15, d / 2 + 0.07, g); b.rotation.z = (rng.next() - 0.5) * 0.3; } // boards over the window
    this.box(0.3, 0.3, 0.3, M.rust, w / 2 - 0.2, 0.32 + h + 0.35, -0.3, g); this.cyl(0.08, 0.08, 0.9, M.iron, w / 2 - 0.2, 0.32 + h + 0.8, -0.3, g, 8); // stove pipe
    return g; },
  watchtower() { // 5 m timber tower: splayed legs with X-bracing on all faces, ladder, planked cabin with railings, hipped roof with overhang, floodlight
    const M = this.mats(), g = this.g(), H = 5, top = 1.0, bot = 1.35;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = this.box(0.18, H + 0.15, 0.18, M.timberDark, sx * (top + bot) / 2, H / 2, sz * (top + bot) / 2, g); l.rotation.z = -sx * Math.atan2(bot - top, H); l.rotation.x = sz * Math.atan2(bot - top, H); this.box(0.4, 0.25, 0.4, M.concreteDark, sx * bot, 0.12, sz * bot, g); }
    for (let j = 0; j < 2; j++) { const y0 = j * 2.4 + 0.5, y1 = y0 + 2.2, wb = bot - (bot - top) * (y0 + y1) / 2 / H; for (const face of [0, 1]) for (const s of [-1, 1]) for (const k of [-1, 1]) { const len = Math.hypot(2 * wb, 2.2), br = this.box(0.08, len, 0.08, M.timber, face ? s * wb : 0, (y0 + y1) / 2, face ? 0 : s * wb, g); if (face) br.rotation.x = k * Math.atan2(2 * wb, 2.2); else br.rotation.z = k * Math.atan2(2 * wb, 2.2); } }
    for (let i = 0; i < 12; i++) this.box(0.5, 0.05, 0.05, M.timber, 0, 0.4 + i * 0.4, bot + 0.05 - i * 0.012, g); for (const s of [-1, 1]) this.box(0.06, H, 0.06, M.timberDark, s * 0.25, H / 2, bot - 0.08, g); // ladder
    this.box(2.4, 0.15, 2.4, M.timber, 0, H, 0, g);
    for (const [x, z, w, d] of [[0, -1.15, 2.4, 0.08], [0, 1.15, 2.4, 0.08], [-1.15, 0, 0.08, 2.4], [1.15, 0, 0.08, 2.4]]) { this.box(w, 1.0, d, M.timber, x, H + 0.55, z, g); this.box(w + 0.05, 0.08, d + 0.05, M.timberDark, x, H + 1.08, z, g); }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.box(0.12, 1.9, 0.12, M.timberDark, sx * 1.1, H + 1.0, sz * 1.1, g);
    const roof = this.mesh(new this.T.ConeGeometry(2.05, 0.9, 4), this.corrugated('#6a5a48'), 0, H + 2.4, 0, g); roof.rotation.y = Math.PI / 4;
    const lamp = this.box(0.35, 0.3, 0.35, M.iron, 0.9, H + 1.75, 0.9, g); this.box(0.28, 0.22, 0.02, IF.mat.glow('#e0e8ff', 2.2), 0.9, H + 1.75, 1.08, g).castShadow = false;
    g.userData.light = { y: -(H + 1.7) * 100, i: 3, c: '#e0e8ff', r: 14 }; return g; },
  hangar(rng) { // Quonset hangar: corrugated half-barrel on a concrete apron, ribbed, closed end wall with sliding doors and a lit side door
    const M = this.mats(), g = this.g(), L = 10, R = 4, sheet = this.corrugated('#6a7068');
    const shell = this.mesh(new this.T.CylinderGeometry(R, R, L, 24, 1, true, 0, Math.PI), sheet, 0, 0, 0, g); shell.rotation.set(0, 0, Math.PI / 2); /* arch spans along x */
    for (let i = 0; i <= 5; i++) { const rib = this.mesh(new this.T.TorusGeometry(R + 0.03, 0.06, 4, 24, Math.PI), M.iron, -L / 2 + i * L / 5, 0, 0, g); rib.rotation.y = Math.PI / 2; }
    this.box(L + 1.5, 0.2, 2 * R + 1.5, M.concrete, 0, 0.1, 0, g); // apron
    for (const ex of [-L / 2, L / 2]) { const sh = new this.T.Shape(); sh.absarc(0, 0, R, 0, Math.PI, false); sh.closePath(); const wall = this.mesh(new this.T.ShapeGeometry(sh, 24), sheet, ex, 0.2, 0, g); wall.rotation.y = Math.PI / 2; }
    for (const s of [-1, 1]) this.box(0.08, 3.2, 2.3, M.olive, L / 2 + 0.05, 1.8, s * 1.15, g); this.box(0.1, 0.12, 5, M.iron, L / 2 + 0.06, 3.45, 0, g); // sliding doors on their rail
    this.box(0.06, 2, 0.9, M.dark, -L / 2 - 0.03, 1.2, 2.4, g); this.box(0.04, 0.2, 0.3, IF.mat.glow('#ffd080', 1.4), -L / 2 - 0.06, 2.4, 2.4, g);
    return g; },
  chimney(rng) { const M = this.mats(), g = this.g(), H = 14 + rng.next() * 8; this.cyl(0.9, 1.3, H, IF.mat.basic('#5a3a2c', 0.9), 0, H / 2, 0, g, 12); for (let i = 0; i < 3; i++) this.mesh(new this.T.TorusGeometry(1.0 - i * 0.05, 0.06, 6, 16), M.iron, 0, H * (0.4 + i * 0.2), 0, g).rotation.x = Math.PI / 2; this.box(6, 5, 5, M.concreteDark, 3, 2.5, 0, g); g.userData.smoke = { y: -H * 100 - 50 }; return g; },
  pipes(len) { const M = this.mats(), g = this.g(); for (let i = 0; i < 3; i++) { const p = this.cyl(0.25 - i * 0.05, 0.25 - i * 0.05, len, i ? M.rust : M.iron, 0, 2 + i * 0.7, 0, g, 10); p.rotation.z = Math.PI / 2; } for (let x = -len / 2; x < len / 2; x += 3) this.box(0.2, 3.5, 0.2, M.iron, x, 1.75, 0, g); return g; },
  labTank() { const M = this.mats(), g = this.g(); this.cyl(0.7, 0.7, 0.3, M.steel, 0, 0.15, 0, g, 16); const glass = this.cyl(0.6, 0.6, 2.2, IF.mat.get('labglass', () => new this.T.MeshStandardMaterial({ color: '#4affc8', emissive: '#0a6a50', emissiveIntensity: 0.9, transparent: true, opacity: 0.45, roughness: 0.1 })), 0, 1.4, 0, g, 16); glass.castShadow = false; this.cyl(0.7, 0.7, 0.3, M.steel, 0, 2.6, 0, g, 16); const body = this.mesh(new this.T.CapsuleGeometry(0.2, 0.7, 4, 8), IF.mat.skin('#4a5a50'), 0, 1.4, 0, g); g.userData.light = { y: -140, i: 2, c: '#4affc8', r: 6 }; return g; },
  overpass(len) { const M = this.mats(), g = this.g(); this.box(len, 0.8, 6, M.concrete, 0, 5.5, 0, g); for (let x = -len / 2 + 2; x < len / 2; x += 6) this.box(0.9, 5.2, 0.9, M.concreteDark, x, 2.6, 0, g); this.box(len, 0.5, 0.15, M.concreteDark, 0, 6.15, 3, g); return g; },
  billboard(rng) { const M = this.mats(), g = this.g(); for (const x of [-1.2, 1.2]) this.box(0.15, 4, 0.15, M.iron, x, 2, 0, g); const t = IF.mat.canvasTex(128, (c, N) => { c.fillStyle = '#3a1c18'; c.fillRect(0, 0, N, N); c.fillStyle = '#c4241e'; c.font = 'bold 22px serif'; c.fillText('EVACUATE', 8, 50); c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(0, 70, N, 58); }); this.mesh(new this.T.BoxGeometry(4, 2.2, 0.1), new this.T.MeshStandardMaterial({ map: t, roughness: 0.9 }), 0, 4.8, 0, g); return g; },
  trench(len) { const M = this.mats(), g = this.g(); for (let x = -len / 2; x < len / 2; x += 0.6) { this.box(0.08, 0.9, 0.08, M.timberDark, x, 0.2, 0.9, g); } this.box(len, 0.6, 0.08, M.timber, 0, 0.1, 0.92, g); for (let i = 0; i < len / 1.3; i++) { const s = this.sandbags(1.2, 2); s.position.set(-len / 2 + i * 1.3, 0.4, 1.3); g.add(s); } return g; },
  deadTreeGeo(h) { const parts = [], T = this.T, add = (x1, y1, x2, y2, r1, r2) => { const L = Math.hypot(x2 - x1, y2 - y1), c = new T.CylinderGeometry(r2, r1, L, 6); c.translate(0, L / 2, 0); c.rotateZ(-Math.atan2(x2 - x1, y2 - y1)); c.translate(x1, y1, 0); parts.push(c); };
    const br = (x, y, L, a, r, d) => { if (d > 4 || r < 0.015) return; const ex = x + Math.sin(a) * L, ey = y + Math.cos(a) * L; add(x, y, ex, ey, r, r * 0.65); br(ex, ey, L * 0.7, a - 0.5 - Math.random() * 0.3, r * 0.62, d + 1); br(ex, ey, L * 0.68, a + 0.45 + Math.random() * 0.3, r * 0.6, d + 1); };
    br(0, 0, h * 0.4, (Math.random() - 0.5) * 0.15, h * 0.035, 0); return BGU.mergeGeometries(parts); },
  pineGeo(h) { const T = this.T, parts = [new T.CylinderGeometry(h * 0.02, h * 0.035, h * 0.4, 6).translate(0, h * 0.2, 0)]; for (let i = 0; i < 5; i++) parts.push(new T.ConeGeometry(h * (0.28 - i * 0.045), h * 0.3, 7).translate(0, h * (0.32 + i * 0.13), 0)); const merged = BGU.mergeGeometries(parts.map((p) => p.toNonIndexed())); return merged; },

  /* ---------- heraldry ---------- */
  heraldryTex(cloth, cross, emblem) {
    const key = 'her' + cloth + cross + emblem; if (IF.mat.tex[key]) return IF.mat.tex[key];
    return (IF.mat.tex[key] = IF.mat.canvasTex(256, (g, N) => {
      g.fillStyle = cloth; g.fillRect(0, 0, N, N);
      const f = IF.mat.noiseField(64, 4, 3, 5); for (let i = 0; i < 64 * 64; i++) { g.fillStyle = 'rgba(0,0,0,' + f[i] * 0.18 + ')'; g.fillRect((i % 64) * 4, ((i / 64) | 0) * 4, 4, 4); }
      g.strokeStyle = 'rgba(0,0,0,0.06)'; for (let y = 0; y < N; y += 3) { g.beginPath(); g.moveTo(0, y); g.lineTo(N, y); g.stroke(); }
      IF.art.emblem(g, N / 2, N * 0.42, N * 0.62, cross, emblem || 'cross');
      const gr = g.createLinearGradient(0, N * 0.7, 0, N); gr.addColorStop(0, 'rgba(60,30,10,0)'); gr.addColorStop(1, 'rgba(60,30,10,0.45)'); g.fillStyle = gr; g.fillRect(0, 0, N, N); // grime at the hem
    }));
  },
  heraldryMat(cloth = '#e6e0d2', cross = '#a3181e', emblem = 'cross') { return IF.mat.get('herm' + cloth + cross + emblem, () => new this.T.MeshStandardMaterial({ map: this.heraldryTex(cloth, cross, emblem), roughness: 0.95, side: this.T.DoubleSide, normalMap: IF.mat.clothSet().normal })); },
  emblemMesh(parent, x, y, z, s, color) { const T = this.T, m = IF.mat.basic(color, 0.7); this.box(s * 0.25, s, 0.01, m, x, y, z, parent).castShadow = false; this.box(s * 0.75, s * 0.25, 0.01, m, x, y + s * 0.18, z, parent).castShadow = false; },
  jitter(geo, amt) { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + (Math.sin(i * 12.9898) * 43758.5453 % 1) * amt; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); } geo.computeVertexNormals(); },
};
