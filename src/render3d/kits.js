/* Environment kit — procedural 3D builders for props, structures and vegetation (units: metres, base at y=0).
 * Builders return THREE.Groups; static set-dressing is later merged per material by the terrain module. */
'use strict';

IF.kit = {
  T: null,
  init() { this.T = IF.r3.T; },
  g() { return new this.T.Group(); },
  mesh(geo, mat, x = 0, y = 0, z = 0, parent) { const m = new this.T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; if (parent) parent.add(m); return m; },
  box(w, h, d, mat, x, y, z, p) { return this.mesh(new this.T.BoxGeometry(w, h, d), mat, x, y, z, p); },
  cyl(rt, rb, h, mat, x, y, z, p, seg = 12) { return this.mesh(new this.T.CylinderGeometry(rt, rb, h, seg), mat, x, y, z, p); },
  M() { const m = IF.mat; return {
    stone: m.basic('#6e675e', 0.92), stoneDark: m.basic('#4a453f', 0.95), plaster: m.basic('#8a7d6a', 0.95), timber: m.wood('#7a6048'), timberDark: m.wood('#4a3a2c'),
    thatch: m.basic('#5a4a30', 1), roofTile: m.basic('#5a3028', 0.9), iron: m.metal('#4a4c50', 0.55, 0.85), rust: m.metal('#6a3a22', 0.85, 0.5), steel: m.metal('#8a9096', 0.4, 0.9),
    olive: m.metal('#4a5233', 0.7, 0.35), concrete: m.basic('#7a7872', 0.95), concreteDark: m.basic('#55534e', 0.95), sand: m.cloth('#9a8a62'), tyre: m.basic('#151515', 0.9),
    glass: m.basic('#1c2630', 0.15, 0.5), red: m.metal('#8a1e14', 0.55, 0.4), canvas: m.cloth('#6a6448'), white: m.cloth('#e6e0d2'), crimson: m.cloth('#8e1218'), dark: m.basic('#121212', 0.9),
    bark: m.wood('#3e2e22'), leaves: m.basic('#1e2a1c', 1), leavesDead: m.basic('#3a3424', 1), rock: m.basic('#5c5852', 0.95),
  }; },
  mats() { return this._m || (this._m = this.M()); },

  /* ---------- props (gameplay lane objects) ---------- */
  crate(w = 0.62, h = 0.58) { const M = this.mats(), g = this.g(); this.box(w, h, w, M.timber, 0, h / 2, 0, g); for (const s of [-1, 1]) { this.box(w + 0.02, 0.06, 0.06, M.timberDark, 0, h / 2, s * w / 2, g).rotation.z = Math.atan2(h, w); this.box(0.06, h, 0.04, M.timberDark, s * w / 2, h / 2, w / 2 + 0.01, g); } this.box(w + 0.02, 0.05, w + 0.02, M.timberDark, 0, h - 0.025, 0, g); return g; },
  barrel(explosive) { const M = this.mats(), g = this.g(), mat = explosive ? M.red : IF.mat.metal('#3e4a32', 0.6, 0.6); this.cyl(0.22, 0.22, 0.86, mat, 0, 0.43, 0, g, 18); for (const y of [0.18, 0.68]) this.mesh(new this.T.TorusGeometry(0.222, 0.015, 6, 20), M.iron, 0, y, 0, g).rotation.x = Math.PI / 2; if (explosive) { const lab = this.box(0.18, 0.18, 0.01, IF.mat.basic('#f0c040', 0.6), 0, 0.45, 0.222, g); lab.rotation.z = Math.PI / 4; } return g; },
  barrels() { const g = this.g(); for (let i = 0; i < 2; i++) { const b = this.barrel(false); b.position.x = -0.24 + i * 0.48; g.add(b); } const t = this.barrel(false); t.rotation.z = Math.PI / 2; t.position.set(0, 0.86 + 0.22, 0); t.position.x = 0.43; g.add(t); return g; },
  sandbags(len = 1.2, rows = 3) { const M = this.mats(), g = this.g(), geo = new this.T.CapsuleGeometry(0.1, 0.2, 4, 8); for (let r = 0; r < rows; r++) for (let i = 0; i < Math.round(len / 0.32) - (r === rows - 1 ? 1 : 0); i++) { const m = this.mesh(geo, M.sand, -len / 2 + 0.16 + i * 0.32 + (r % 2) * 0.16, 0.1 + r * 0.17, (Math.random() - 0.5) * 0.04, g); m.rotation.z = Math.PI / 2; m.scale.set(1, 1.35, 0.8); } return g; },
  cart() { const M = this.mats(), g = this.g(); this.box(1.1, 0.08, 0.7, M.timber, 0, 0.42, 0, g); for (const s of [-1, 1]) this.box(1.1, 0.25, 0.04, M.timber, 0, 0.58, s * 0.35, g); for (const s of [-1, 1]) { const w = this.mesh(new this.T.TorusGeometry(0.26, 0.04, 6, 16), M.timberDark, 0.1, 0.27, s * 0.42, g); this.cyl(0.03, 0.03, 0.5, M.timberDark, 0.1, 0.27, s * 0.42, g).rotation.x = Math.PI / 2; } this.box(0.9, 0.04, 0.04, M.timberDark, 0.95, 0.4, 0, g); this.box(0.7, 0.2, 0.5, IF.mat.cloth('#6a5a3a'), -0.1, 0.62, 0, g); return g; },
  car(color) { const M = this.mats(), g = this.g(), paint = IF.mat.metal(color || '#5a2a24', 0.65, 0.45); const body = this.box(1.7, 0.42, 0.85, paint, 0, 0.45, 0, g); this.box(0.95, 0.36, 0.78, paint, -0.08, 0.84, 0, g); this.box(0.5, 0.3, 0.8, M.glass, 0.28, 0.83, 0, g).rotation.z = -0.5; this.box(0.4, 0.28, 0.8, M.glass, -0.47, 0.83, 0, g).rotation.z = 0.5; for (const sx of [-0.55, 0.55]) for (const sz of [-0.42, 0.42]) { const w = this.cyl(0.19, 0.19, 0.14, M.tyre, sx, 0.19, sz, g, 14); w.rotation.x = Math.PI / 2; } this.box(1.72, 0.06, 0.87, M.rust, 0, 0.24, 0, g); g.rotation.z = (Math.random() - 0.5) * 0.06; return g; },
  jeep() { const M = this.mats(), g = this.g(); this.box(1.8, 0.5, 0.9, M.olive, 0, 0.55, 0, g); this.box(0.6, 0.3, 0.9, M.olive, 0.6, 0.9, 0, g); for (const x of [-0.75, 0.1]) this.box(0.04, 0.5, 0.86, M.iron, x, 1.05, 0, g); this.box(0.9, 0.04, 0.9, M.canvas, -0.32, 1.3, 0, g); for (const sx of [-0.6, 0.6]) for (const sz of [-0.46, 0.46]) this.cyl(0.24, 0.24, 0.18, M.tyre, sx, 0.24, sz, g, 14).rotation.x = Math.PI / 2; const st = this.mesh(new this.T.CircleGeometry(0.16, 20), M.white, 0.2, 0.62, 0.452, g); IF.kit.emblemMesh(g, 0.2, 0.62, 0.455, 0.18, '#a3181e'); return g; },
  bus() { const M = this.mats(), g = this.g(), p = IF.mat.metal('#8a6a24', 0.7, 0.3); this.box(3, 1.05, 1.0, p, 0, 0.75, 0, g); for (let i = 0; i < 7; i++) this.box(0.32, 0.36, 1.02, M.glass, -1.3 + i * 0.42, 1.0, 0, g); for (const sx of [-1, 1]) for (const sz of [-0.5, 0.5]) this.cyl(0.24, 0.24, 0.16, M.tyre, sx, 0.24, sz, g, 14).rotation.x = Math.PI / 2; g.rotation.z = 0.04; return g; },
  tank() { const M = this.mats(), g = this.g(); this.box(2.6, 0.5, 1.4, M.olive, 0, 0.55, 0, g); this.box(1.3, 0.38, 1.0, M.olive, -0.1, 0.99, 0, g); const gun = this.cyl(0.06, 0.07, 1.6, M.olive, 1.1, 1.0, 0, g); gun.rotation.z = Math.PI / 2 - 0.08; for (const s of [-1, 1]) { this.box(2.7, 0.38, 0.32, M.dark, 0, 0.22, s * 0.62, g); for (let i = 0; i < 6; i++) this.cyl(0.13, 0.13, 0.34, M.iron, -1.05 + i * 0.42, 0.18, s * 0.62, g).rotation.x = Math.PI / 2; } g.rotation.z = -0.05; return g; },
  container(color) { const M = this.mats(), g = this.g(), p = IF.mat.metal(color || '#6a2a1e', 0.75, 0.5); this.box(2.4, 1.2, 1.2, p, 0, 0.6, 0, g); for (let i = 0; i < 12; i++) this.box(0.03, 1.1, 1.22, p, -1.1 + i * 0.2, 0.6, 0, g); return g; },
  barricade() { const M = this.mats(), g = this.g(); for (let i = 0; i < 5; i++) { const b = this.box(1.3, 0.14, 0.06, M.timber, 0, 0.18 + i * 0.13, (i % 2) * 0.05, g); b.rotation.z = (i - 2) * 0.12; } this.crate(0.5, 0.45).children.forEach(() => {}); const c = this.crate(0.5, 0.45); c.position.set(0.2, 0, -0.35); g.add(c); return g; },
  rubble(n = 9) { const M = this.mats(), g = this.g(); for (let i = 0; i < n; i++) { const r = 0.12 + Math.random() * 0.25; const m = this.mesh(new this.T.DodecahedronGeometry(r, 0), Math.random() < 0.5 ? M.stone : M.concrete, (Math.random() - 0.5) * 1.1, r * 0.6, (Math.random() - 0.5) * 0.6, g); m.rotation.set(Math.random() * 3, Math.random() * 3, 0); } if (Math.random() < 0.6) { const rb = this.cyl(0.015, 0.015, 0.9, M.rust, 0.2, 0.4, 0, g, 5); rb.rotation.z = 0.7; } return g; },
  fence(len = 1.4) { const M = this.mats(), g = this.g(); for (let i = 0; i <= 5; i++) { const h = 0.35 + Math.random() * 0.15; this.box(0.06, h, 0.06, M.timberDark, -len / 2 + i * len / 5, h / 2, 0, g).rotation.z = (Math.random() - 0.5) * 0.15; } this.box(len, 0.05, 0.03, M.timber, 0, 0.3, 0.03, g); const br = this.box(len * 0.5, 0.05, 0.03, M.timber, len * 0.2, 0.15, 0.05, g); br.rotation.z = 0.3; return g; },
  well() { const M = this.mats(), g = this.g(); const r = this.cyl(0.42, 0.45, 0.62, M.stone, 0, 0.31, 0, g, 16); for (const s of [-1, 1]) this.box(0.08, 1.0, 0.08, M.timberDark, s * 0.38, 1.0, 0, g); const roof = this.mesh(new this.T.ConeGeometry(0.6, 0.4, 4), M.roofTile, 0, 1.6, 0, g); roof.rotation.y = Math.PI / 4; this.cyl(0.05, 0.05, 0.8, M.timber, 0, 1.25, 0, g).rotation.z = Math.PI / 2; return g; },
  log() { const M = this.mats(), g = this.g(); const l = this.cyl(0.16, 0.18, 1.3, M.bark, 0, 0.16, 0, g); l.rotation.z = Math.PI / 2; return g; },
  stump() { const M = this.mats(), g = this.g(); this.cyl(0.2, 0.26, 0.32, M.bark, 0, 0.16, 0, g); return g; },
  rockProp(w = 0.7) { const M = this.mats(), g = this.g(); const m = this.mesh(new this.T.DodecahedronGeometry(w / 2, 1), M.rock, 0, w * 0.22, 0, g); m.scale.set(1, 0.6, 0.8); this.jitter(m.geometry, 0.08); return g; },
  banner(clothMat) { const M = this.mats(), g = this.g(); this.cyl(0.03, 0.035, 1.8, M.timberDark, 0, 0.9, 0, g, 6); const cloth = this.mesh(new this.T.PlaneGeometry(0.45, 0.85, 4, 8), clothMat || this.heraldryMat(), 0.24, 1.35, 0, g); cloth.userData.wave = true; this.box(0.6, 0.03, 0.03, M.timberDark, 0.24, 1.78, 0, g); g.userData.cloth = cloth; return g; },
  brazier() { const M = this.mats(), g = this.g(); this.cyl(0.03, 0.03, 0.7, M.iron, 0, 0.35, 0, g); this.cyl(0.24, 0.12, 0.2, M.iron, 0, 0.78, 0, g, 10); const fire = this.mesh(new this.T.ConeGeometry(0.16, 0.42, 8), IF.mat.glow('#ff8a2a', 3), 0, 1.05, 0, g); fire.castShadow = false; fire.userData.flame = true; g.userData.light = { y: -95, i: 4, c: '#ff8a3a' }; return g; },
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
    this.box(0.7, 1.3, 0.06, M.timberDark, 0, 0.65, d / 2 + 0.03, g);
    // roof: two slabs; ruined roofs lose a slab and show rafters
    const rh = 1.2 + rng.next() * 0.5, slope = Math.atan2(rh, d / 2), rl = Math.hypot(rh, d / 2) + 0.2;
    for (const s of [-1, 1]) {
      if (ruined && s > 0 && rng.chance(0.7)) { for (let i = 0; i < 6; i++) { const r = this.box(0.07, 0.07, rl, M.timberDark, -w / 2 + 0.3 + i * (w - 0.6) / 5, h + rh / 2, s * d / 4, g); r.rotation.x = s * slope; } continue; }
      const slab = this.box(w + 0.3, 0.12, rl, rng.chance(0.5) ? M.thatch : M.roofTile, 0, h + rh / 2, s * d / 4, g); slab.rotation.x = s * slope;
    }
    for (const s of [-1, 1]) { const gable = new this.T.Shape(); gable.moveTo(-d / 2, 0); gable.lineTo(d / 2, 0); gable.lineTo(0, rh); gable.closePath(); const m = this.mesh(new this.T.ShapeGeometry(gable), wall, s * w / 2, h, 0, g); m.rotation.y = s * Math.PI / 2; }
    if (rng.chance(0.6)) this.cyl(0.22, 0.25, 1.3, M.stoneDark, w * 0.3, h + rh * 0.7, -d * 0.2, g, 8);
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
  cityBlock(rng) {
    const M = this.mats(), g = this.g(), w = 4 + rng.next() * 4, d = 4, h = 6 + rng.next() * 14;
    const mat = rng.chance(0.5) ? M.concrete : M.concreteDark;
    this.box(w, h, d, mat, 0, h / 2, 0, g);
    // broken top
    for (let i = 0; i < 4; i++) { const p = this.box(w / 4, 0.5 + rng.next() * 2.5, d, mat, -w / 2 + w / 8 + i * w / 4, h + 0.5, 0, g); if (rng.chance(0.4)) p.visible = false; }
    // window grid: dark recesses, a few burning
    const cols = Math.floor(w / 1.1), rows = Math.floor(h / 1.6);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const lit = rng.chance(0.06); if (rng.chance(0.85)) this.box(0.6, 0.8, 0.05, lit ? IF.mat.glow('#ff7a2a', 1.6) : M.dark, -w / 2 + 0.55 + c * 1.1, 1.2 + r * 1.6, d / 2 + 0.02, g); }
    for (let i = 0; i < 6; i++) { const rb = this.cyl(0.02, 0.02, 1 + rng.next(), M.rust, -w / 2 + rng.next() * w, h + 0.4, 0, g, 4); rb.rotation.z = rng.next() - 0.5; }
    return g;
  },
  shack(rng) { const M = this.mats(), g = this.g(), w = 2.4 + rng.next(), h = 1.9; this.box(w, h, 2, rng.chance(0.5) ? M.timber : M.rust, 0, h / 2, 0, g); const roof = this.box(w + 0.4, 0.06, 2.4, M.rust, 0, h + 0.2, 0, g); roof.rotation.z = 0.12; this.box(0.6, 0.5, 0.05, rng.chance(0.3) ? IF.mat.glow('#ff9a40', 1.2) : M.dark, w * 0.2, 1.1, 1.02, g); return g; },
  watchtower() { const M = this.mats(), g = this.g(); for (const x of [-0.8, 0.8]) for (const z of [-0.8, 0.8]) { const l = this.box(0.15, 5, 0.15, M.timberDark, x, 2.5, z, g); } this.box(2.2, 0.15, 2.2, M.timber, 0, 5, 0, g); for (const s of [-1, 1]) this.box(2.2, 0.8, 0.08, M.timber, 0, 5.45, s * 1.05, g); const roof = this.mesh(new this.T.ConeGeometry(1.8, 1, 4), M.rust, 0, 6.6, 0, g); roof.rotation.y = Math.PI / 4; for (let i = 0; i < 4; i++) this.box(1.8, 0.08, 0.08, M.timberDark, 0, 1.2 + i * 1.1, 0.82, g).rotation.z = i % 2 ? 0.5 : -0.5; g.userData.light = { y: -520, i: 3, c: '#e0e8ff', r: 14 }; return g; },
  hangar(rng) { const M = this.mats(), g = this.g(), L = 10, R = 4; const geo = new this.T.CylinderGeometry(R, R, L, 18, 1, true, 0, Math.PI); const m = this.mesh(geo, IF.mat.metal('#4a5050', 0.7, 0.6), 0, 0, 0, g); m.rotation.z = Math.PI / 2; m.rotation.y = Math.PI / 2; m.material.side = this.T.DoubleSide; this.box(L * 0.05, R, 0.1, M.dark, 0, R / 2, 0, g); return g; },
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
