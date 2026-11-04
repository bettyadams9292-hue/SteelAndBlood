/* Terrain & world building — real elevation, biome set dressing, instanced vegetation, static batching.
 * One chunk per section (plus the previous while it is still on screen) keeps memory constant. */
'use strict';

IF.terrain = {
  chunks: [], S: 0.01, ZN: -70, ZF: 9,
  BIOME3D: {
    village: { hills: 3.5, rough: 0.8, grass: '#3e4a2c', dirt: '#5a4632', path: '#4a3a2a', rock: '#5c574e', veg: 'mixed', grassDensity: 1 },
    forest: { hills: 5, rough: 1, grass: '#2c3a22', dirt: '#3a3020', path: '#3a2e20', rock: '#4a4a44', veg: 'pine', grassDensity: 1.3 },
    castle: { hills: 7, rough: 1.4, grass: '#3a3c2c', dirt: '#4a4236', path: '#5a544a', rock: '#6a6660', veg: 'dead', cliffs: true, grassDensity: 0.6 },
    highway: { hills: 2.5, rough: 0.5, grass: '#4a4a30', dirt: '#55503e', path: '#2e2e30', rock: '#5a5852', veg: 'dead', road: true, grassDensity: 0.8 },
    checkpoint: { hills: 3, rough: 0.6, grass: '#3e4430', dirt: '#4e4a3a', path: '#3a3a34', rock: '#5a5852', veg: 'dead', road: true, grassDensity: 0.6 },
    city: { hills: 1, rough: 0.3, grass: '#3a3a32', dirt: '#3e3c38', path: '#2a2a2c', rock: '#5a5852', veg: 'none', road: true, grassDensity: 0.15 },
    battlefield: { hills: 2.5, rough: 1.2, grass: '#3a3424', dirt: '#4a3a28', path: '#3e3022', rock: '#4a4440', veg: 'dead', craters: true, grassDensity: 0.3 },
    base: { hills: 2, rough: 0.4, grass: '#3a4030', dirt: '#4a4a40', path: '#3a3c3e', rock: '#5a5852', veg: 'none', road: true, grassDensity: 0.4 },
    industrial: { hills: 1.5, rough: 0.5, grass: '#3a3428', dirt: '#3e3428', path: '#2e2a26', rock: '#4a4440', veg: 'none', road: true, grassDensity: 0.2 },
    bunker: { hills: 0, rough: 0.1, grass: '#2a2e30', dirt: '#2e3236', path: '#3a3e42', rock: '#3a3e42', veg: 'none', indoor: true, grassDensity: 0 },
    lab: { hills: 0, rough: 0.1, grass: '#2a3434', dirt: '#2e3838', path: '#4a5656', rock: '#3a4444', veg: 'none', indoor: true, grassDensity: 0 },
    settlement: { hills: 3, rough: 0.8, grass: '#3a3a28', dirt: '#4a3e30', path: '#40342a', rock: '#55504a', veg: 'mixed', grassDensity: 0.9 },
  },

  /* Ground height under the play lane (metres). Global and continuous across sections. */
  laneHeight(x) { if (this.flat) return 0; const u = x * this.S; return 0.55 * Math.sin(u / 9.3) + 0.32 * Math.sin(u / 4.1 + 1.3) + 0.14 * Math.sin(u / 2.3 + 0.7); },
  /* Full terrain height at (X metres, Z metres). The lane band (|z| < 2.4) follows laneHeight exactly. */
  height(X, Z, cfg, seed) {
    const lane = this.laneHeight(X / this.S);
    const n = (a, b) => Math.sin(X * a + seed) * Math.cos(Z * b + seed * 0.7);
    let h = lane;
    if (Z < -2.4) { // rising backdrop: hills, cliffs, valleys
      const k = Math.min(1, Math.max(0, (-Z - 6) / 22));
      h += k * k * cfg.hills * (0.55 + 0.45 * n(0.09, 0.07)) + Math.min(1, (-Z - 2.4) / 8) * cfg.rough * (0.4 * n(0.31, 0.27) + 0.2 * n(0.73, 0.61));
      if (cfg.cliffs && Z < -14) h += Math.max(0, n(0.05, 0.02)) * 6;
      if (Z < -40) h += (-Z - 40) * 0.25 * cfg.hills / 4; // distant ridge
    } else if (Z > 2.4) { // foreground: gentle dip then mounds near the camera
      const k = Math.min(1, (Z - 2.4) / 4); h += -0.35 * k + k * 0.4 * Math.max(0, n(0.5, 0.9)) * cfg.rough;
    } else h += 0.04 * n(2.1, 1.7) * cfg.rough; // tiny lane surface noise (visual only, < 4cm)
    if (cfg.indoor && Z < -6) h += 0;
    return h;
  },

  /* ---------- per-frame management ---------- */
  update(run, cx) {
    const W = run.world;
    if (W.home && IF.home.dirty) { IF.home.dirty = false; while (this.chunks.length) this.dispose(this.chunks.shift()); }
    if (!this.chunks.length || this.chunks[this.chunks.length - 1].world !== W) { if (W.home) { while (this.chunks.length) this.dispose(this.chunks.shift()); this.chunks.push(IF.home3d.build(run, W)); } else this.build(run, W); }
    // drop chunks well behind the camera
    while (this.chunks.length > 2 || (this.chunks.length > 1 && cx - this.chunks[0].world.end * this.S > 40)) this.dispose(this.chunks.shift());
    const t = IF.r3.clock;
    for (const c of this.chunks) {
      for (const p of c.props) { // destructibles
        const alive = !(p.src.destructible && p.src.hp <= 0); if (p.mesh.visible !== alive) { p.mesh.visible = alive; if (p.wreck) p.wreck.visible = !alive; }
        if (alive && p.src.hp < p.src.maxHp) p.mesh.rotation.z = Math.sin(t * 40) * 0.01 * (1 - p.src.hp / p.src.maxHp);
      }
      for (const w of c.wavers) { const pos = w.geometry.attributes.position, base = w.userData.base; for (let i = 0; i < pos.count; i++) { const x = base[i * 3], y = base[i * 3 + 1]; const amp = (x + 0.3) * 0.12; pos.setZ(i, base[i * 3 + 2] + Math.sin(t * 3 + x * 6 + y * 2) * amp); } pos.needsUpdate = true; }
      for (const f of c.flames) { f.scale.set(1 + Math.sin(t * 17 + f.userData.fid) * 0.12, 1 + Math.sin(t * 13 + f.userData.fid) * 0.25, 1); }
      for (const L of c.lights) IF.fx3d.lightEmitters.push({ x: L.x, y: L.y, z: L.z, i: L.i * (0.85 + Math.sin(t * 15 + L.x) * 0.15), c: L.c, r: L.r });
      for (const s of c.smokers) if (Math.random() < 0.25) IF.fx.spawn({ x: s.x + (Math.random() - 0.5) * 60, y: s.y, vx: 20 + Math.random() * 20, vy: -60 - Math.random() * 40, life: 6, size: 40, color: 'rgba(40,36,34,0.5)', type: 'smoke', grow: 30, drag: 0.995, z: s.z });
    }
    IF.gate3d && IF.gate3d.update(run, t);
  },
  dispose(c) {
    IF.r3.world.remove(c.group);
    c.group.traverse((o) => { if (o.geometry && !o.userData.shared) o.geometry.dispose(); });
  },

  /* ---------- section build ---------- */
  build(run, W) {
    const T = IF.r3.T, S = this.S, b = W.biome, cfg = this.BIOME3D[b.id] || this.BIOME3D.village, rng = new IF.RNG(IF.hashString(b.id + W.section));
    const seed = W.section * 1.7, x0 = (W.start - 1600) * S, x1 = (W.end + 1600) * S, group = new T.Group();
    const chunk = { world: W, group, props: [], wavers: [], flames: [], lights: [], smokers: [] };
    group.add(this.terrainMesh(x0, x1, cfg, seed, b));
    const statics = []; // groups to batch
    // lane props (gameplay objects)
    for (const p of W.props) {
      const g = IF.kit.prop(p.type); const cx = p.x + p.w / 2;
      g.position.set(cx * S, this.laneHeight(cx), (p.platform ? 0 : 0.15)); g.rotation.y = (rng.next() - 0.5) * 0.25;
      this.fitToWidth(g, p); group.add(g); chunk.props.push({ src: p, mesh: g, wreck: p.destructible ? this.wreckMesh(group, cx, p) : null });
      this.harvest(g, chunk, cx, p.y + p.h * 0.0);
    }
    // gate
    IF.gate3d && group.add(IF.gate3d.build(W, chunk));
    // biome set dressing, placed in depth bands behind and in front of the lane
    this._occ = [];
    this.dress(b, cfg, W, rng, group, statics, chunk, x0, x1, seed);
    this.vegetation(cfg, rng, group, x0, x1, seed);
    group.add(this.batch(statics));
    if (cfg.indoor) group.add(this.interior(x0, x1, b));
    IF.r3.world.add(group); this.chunks.push(chunk);
    return chunk;
  },
  fitToWidth(g, p) { // scale lane props to the gameplay footprint so platforms line up with physics
    const box = new IF.r3.T.Box3().setFromObject(g), w = (box.max.x - box.min.x) / this.S;
    if (w > 0.3 && p.platform) { const k = Math.max(0.75, Math.min(1.35, p.w / w)), tall = { well: 1, cart: 1, car: 1, jeep: 1, bus: 1, tank: 1 }[p.type]; /* structures with a roof/cab keep their proportions; flat-topped platforms match the physics height (within ±20%) */ g.scale.set(k, tall ? k : Math.max(0.8, Math.min(1.2, p.h / ((box.max.y - box.min.y) / this.S))), Math.min(1.4, Math.max(0.8, k))); }
  },
  wreckMesh(group, cx, p) { const g = IF.kit.rubble(6); g.position.set(cx * this.S, this.laneHeight(cx), 0.1); g.visible = false; group.add(g); return g; },
  harvest(g, chunk, lx, ly) { // collect animated parts and light emitters from a built kit object
    g.traverse((o) => {
      if (o.userData.wave) { o.userData.base = Float32Array.from(o.geometry.attributes.position.array); chunk.wavers.push(o); }
      if (o.userData.flame) { o.userData.fid = Math.random() * 10; chunk.flames.push(o); }
    });
    if (g.userData.light) { const L = g.userData.light; const wp = g.getWorldPosition(new IF.r3.T.Vector3()); chunk.lights.push({ x: wp.x / this.S, y: IF.GROUND + (L.y || -100), z: wp.z + 0.4, i: L.i, c: L.c, r: L.r }); }
    if (g.userData.smoke) { const wp = g.getWorldPosition(new IF.r3.T.Vector3()); chunk.smokers.push({ x: wp.x / this.S, y: IF.GROUND + g.userData.smoke.y, z: wp.z }); }
  },

  terrainMesh(x0, x1, cfg, seed, b) {
    const T = IF.r3.T, nx = Math.ceil((x1 - x0) / 0.5), zs = [];
    for (let z = this.ZN; z < -12; z += 3) zs.push(z); for (let z = -12; z < -2.6; z += 0.8) zs.push(z); for (let z = -2.6; z <= 2.6; z += 0.4) zs.push(z); for (let z = 3; z <= this.ZF; z += 0.6) zs.push(z);
    const nz = zs.length, pos = new Float32Array((nx + 1) * nz * 3), col = new Float32Array((nx + 1) * nz * 3), uv = new Float32Array((nx + 1) * nz * 2), idx = [];
    const C = (h) => new T.Color(h), grass = C(cfg.grass), dirt = C(cfg.dirt), path = C(cfg.path), rock = C(cfg.rock), mud = C(cfg.path).multiplyScalar(0.6), tmp = new T.Color();
    const hn = (X, Z) => Math.sin(X * 0.37 + seed) * Math.sin(Z * 0.53) * 0.5 + Math.sin(X * 1.7) * Math.cos(Z * 1.3 + seed) * 0.3 + 0.5;
    for (let i = 0; i <= nx; i++) for (let j = 0; j < nz; j++) {
      const X = x0 + i * (x1 - x0) / nx, Z = zs[j], k = i * nz + j, h = this.height(X, Z, cfg, seed);
      pos[k * 3] = X; pos[k * 3 + 1] = h; pos[k * 3 + 2] = Z; uv[k * 2] = X / 2.2; uv[k * 2 + 1] = Z / 2.2;
      // macro colour: path along the lane, grass/dirt patches elsewhere, rock on steep backdrop
      const m = hn(X, Z), pathK = Math.max(0, 1 - Math.abs(Z) / (cfg.road ? 2.0 : 1.6));
      tmp.copy(grass).lerp(dirt, Math.min(1, m * 0.9)).lerp(path, Math.min(1, pathK * (cfg.road ? 1.4 : 1.1)));
      if (pathK > 0.2 && m > 0.72) tmp.lerp(mud, 0.6); // puddles / mud ruts
      if (Z < -10) tmp.lerp(rock, Math.min(0.7, (h - this.laneHeight(X / this.S)) / 12));
      if (cfg.road && Math.abs(Z) < 1.6 && Math.abs(Z - 0.05) < 0.05 && Math.floor(X / 1.5) % 2 === 0) tmp.set('#8a8270');
      const v = 0.88 + m * 0.24; col[k * 3] = tmp.r * v; col[k * 3 + 1] = tmp.g * v; col[k * 3 + 2] = tmp.b * v;
    }
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz - 1; j++) { const a = i * nz + j, b2 = (i + 1) * nz + j; idx.push(a, a + 1, b2, b2, a + 1, b2 + 1); }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('color', new T.BufferAttribute(col, 3)); geo.setAttribute('uv', new T.BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    const d = IF.mat.groundDetail();
    const mat = IF.mat.get('terrain', () => new T.MeshStandardMaterial({ vertexColors: true, map: d.map, roughnessMap: d.rough, normalMap: d.normal, normalScale: new T.Vector2(1.2, 1.2), roughness: 1, metalness: 0 }));
    const mesh = new T.Mesh(geo, mat); mesh.receiveShadow = true; return mesh;
  },
  interior(x0, x1, b) { // bunker / lab: ceiling, back wall with ribs, overhead lamps
    const T = IF.r3.T, g = new T.Group(), M = IF.kit.mats(), L = x1 - x0, cx = (x0 + x1) / 2;
    const wall = IF.kit.box(L, 9, 0.6, b.id === 'lab' ? IF.mat.basic('#3a4a4a', 0.6, 0.2) : M.concreteDark, cx, 4, -7, g);
    IF.kit.box(L, 0.6, 16, M.concreteDark, cx, 5.2, -1, g);
    for (let x = x0; x < x1; x += 4) { IF.kit.box(0.5, 9, 0.8, M.concrete, x, 4, -6.6, g); IF.kit.box(0.4, 0.5, 16, M.iron, x, 4.7, -1, g); const lamp = IF.kit.box(0.8, 0.12, 0.3, IF.mat.glow(b.id === 'lab' ? '#8affe0' : '#a0ffb0', 2.5), x + 2, 4.75, 0, g); lamp.castShadow = false; }
    for (let x = x0 + 3; x < x1; x += 7) { const p = IF.kit.pipes(6); p.position.set(x, 0.3, -5.8); g.add(p); }
    // set pieces so the two underground zones read as distinct places
    const K = IF.kit;
    for (let x = x0 + 6; x < x1; x += 13) {
      if (b.id === 'bunker') { // blast door with hazard stripes and a red warning lamp; stencilled bay number
        K.box(3.2, 3.4, 0.3, M.steel, x, 1.7, -6.5, g); for (let i = 0; i < 8; i++) K.box(0.4, 0.3, 0.05, IF.mat.basic(i % 2 ? '#d8b020' : '#151515', 0.7), x - 1.4 + i * 0.4, 3.65, -6.3, g);
        K.box(0.25, 0.25, 0.2, IF.mat.glow('#ff2a1a', 2.5), x + 2, 3.2, -6.3, g).castShadow = false; K.box(3.4, 0.3, 0.5, M.iron, x, 3.5, -6.4, g);
        for (let i = 0; i < 4; i++) K.box(0.7, 0.35, 0.5, M.sand, x - 3 + (i % 2) * 0.4, 0.2 + Math.floor(i / 2) * 0.35, -6, g);
      } else { // observation window onto a glowing specimen hall, biohazard placard, flickering strip light
        K.box(4, 1.8, 0.1, IF.mat.get('labwin', () => new T.MeshStandardMaterial({ color: '#0a2a24', emissive: '#1a8a6a', emissiveIntensity: 0.8, roughness: 0.05, metalness: 0.5 })), x, 2.4, -6.55, g);
        K.box(4.2, 0.12, 0.2, M.steel, x, 3.35, -6.5, g); K.box(4.2, 0.12, 0.2, M.steel, x, 1.45, -6.5, g); for (const d of [-2.05, 2.05]) K.box(0.12, 2, 0.2, M.steel, x + d, 2.4, -6.5, g);
        for (let i = 0; i < 3; i++) { const tank = K.cyl(0.35, 0.35, 1.2, IF.mat.glow('#3affb0', 0.5), x - 1.2 + i * 1.2, 2.2, -7.2, g, 10); tank.castShadow = false; }
        K.box(0.6, 0.6, 0.05, IF.mat.basic('#d8b020', 0.6), x + 2.8, 2.2, -6.5, g);
      }
    }
    return g;
  },

  /* Biome recipes: what stands behind the lane. */
  dress(b, cfg, W, rng, group, statics, chunk, x0, x1, seed) {
    const K = IF.kit, S = this.S, place = (obj, X, Z, rotY, batch = true) => { { const bx = new IF.r3.T.Box3().setFromObject(obj); const r = Math.max(bx.max.x - bx.min.x, bx.max.z - bx.min.z) / 2; if (r > 0.8) this._occ.push([X, Z, r + 1.2]); } obj.position.set(X, this.height(X, Z, cfg, seed) - 0.05, Z); obj.rotation.y = rotY || 0; if (batch) statics.push(obj); else group.add(obj); this.harvest(obj, chunk); return obj; };
    const span = (step, fn) => { for (let X = x0 + rng.next() * step; X < x1; X += step * (0.6 + rng.next() * 0.8)) fn(X); };
    switch (b.id) {
      case 'village': case 'settlement':
        span(9, (X) => place(b.id === 'village' ? K.house(rng, rng.chance(0.45)) : K.shack(rng), X, -9 - rng.next() * 12, (rng.next() - 0.5) * 0.5));
        if (b.id === 'village') span(55, (X) => place(K.church(rng), X, -22 - rng.next() * 6, -0.2 + rng.next() * 0.4));
        span(6, (X) => place(K.fence(1.4), X, -3.2 - rng.next(), rng.next() * 0.4));
        span(14, (X) => place(K.brazier(), X, -2.9, 0, false));
        span(18, (X) => { const bn = K.banner(); place(bn, X, -3.4, 0, false); });
        break;
      case 'forest': span(25, (X) => place(K.house(rng, true), X, -14 - rng.next() * 8, rng.next())); span(20, (X) => place(K.log(), X, -3.5, rng.next() * 3)); break;
      case 'castle':
        span(16, (X) => place(K.castleWall(14, rng), X, -12 - rng.next() * 3, 0));
        span(22, (X) => place(K.tower(rng), X, -13 - rng.next() * 4, 0));
        span(10, (X) => place(K.rubble(10), X, -3.5, rng.next() * 3));
        span(12, (X) => place(K.brazier(), X, -2.9, 0, false)); span(14, (X) => place(K.banner(), X, -3.2, 0, false));
        break;
      case 'highway': case 'checkpoint':
        if (b.id === 'highway') span(34, (X) => place(K.overpass(24), X, -9, 0));
        span(8, (X) => place(K.car(['#5a2a24', '#2a3a4a', '#4a4a48'][rng.int(0, 2)]), X, -4.5 - rng.next() * 3, rng.next() * 3));
        span(16, (X) => place(K.billboard(rng), X, -12 - rng.next() * 5, 0));
        if (b.id === 'checkpoint') { span(20, (X) => place(K.watchtower(), X, -7 - rng.next() * 3, 0, false)); span(7, (X) => place(K.sandbags(2.2), X, -3.2, 0)); span(9, (X) => place(K.wire(2), X, -4.2, 0)); }
        break;
      case 'city': span(8, (X) => place(K.cityBlock(rng), X, -15 - rng.next() * 16, 0)); span(9, (X) => place(K.car(), X, -4 - rng.next() * 2, rng.next() * 3)); span(6, (X) => place(K.rubble(12), X, -3.4 - rng.next() * 2, rng.next() * 3)); break;
      case 'battlefield':
        span(18, (X) => place(K.tank(), X, -7 - rng.next() * 8, rng.next() * 3)); span(12, (X) => place(K.trench(8), X, -4.5, 0));
        span(5, (X) => place(K.crater(0.8 + rng.next()), X, -3 - rng.next() * 6, 0)); span(8, (X) => place(K.wire(2), X, -3.6, 0));
        span(30, (X) => place(K.church(rng), X, -26, 0));
        break;
      case 'base': span(26, (X) => place(K.hangar(rng), X, -14 - rng.next() * 4, 0)); span(18, (X) => place(K.watchtower(), X, -6.5, 0, false)); span(6, (X) => place(K.container(), X, -6 - rng.next() * 3, rng.next() * 0.3)); span(8, (X) => place(K.sandbags(2), X, -3.3, 0)); break;
      case 'industrial': span(20, (X) => place(K.chimney(rng), X, -18 - rng.next() * 8, 0, false)); span(14, (X) => place(K.pipes(10), X, -6.5, 0)); span(7, (X) => place(K.container(), X, -9 - rng.next() * 5, rng.next() * 0.3)); break;
      case 'bunker': span(5, (X) => place(K.sandbags(2), X, -3.6, 0)); span(6, (X) => place(K.locker(), X, -5.5, 0)); break;
      case 'lab': span(5, (X) => place(K.labTank(), X, -5 - rng.next() * 1.2, 0, false)); span(6, (X) => place(K.gurney(), X, -3.6, rng.next() * 0.4)); break;
    }
    // ruined debris scattered close to the lane everywhere outdoors
    if (!cfg.indoor) span(4, (X) => place(K.rubble(4), X, -2.8 - rng.next() * 1.5, rng.next() * 3));
    if (!cfg.indoor) this.landmarks(b, W, rng, group, place, x0, x1);
  },
  /* Distant landmarks give every zone its own skyline: big silhouettes far behind, half-lost in fog. */
  landmarks(b, W, rng, group, place, x0, x1) {
    const K = IF.kit, big = (o, s) => { o.scale.setScalar(s); return o; }, Z = () => -62 - rng.next() * 18;
    const at = (n, f) => { for (let i = 0; i < n; i++) { const X = x0 + (x1 - x0) * (i + 0.3 + rng.next() * 0.4) / n; const o = f(X); if (o) place(o, X, o.userData.z || Z(), rng.next() * 0.6 - 0.3, false); } };
    const fire = (o, y) => { o.userData.light = { y: -y * 100, i: 6, c: '#ff6a20', r: 30 }; o.userData.smoke = { y: -y * 100 }; return o; };
    switch (b.id) {
      case 'village': at(1, () => big(K.church(rng), 2.2)); at(2, () => big(K.house(rng, true), 2.4)); break; // hilltop abbey and the burning manor
      case 'forest': at(2, () => big(K.tower(rng), 1.8)); break; // ruined watchtowers above the canopy
      case 'castle': at(1, () => { const g = K.g(); for (let i = 0; i < 3; i++) { const t = big(K.tower(rng), 2.4 - i * 0.3); t.position.set(-16 + i * 16, 0, -i * 4); g.add(t); } const w = big(K.castleWall(30, rng), 1.6); g.add(w); return g; }); break; // the keep
      case 'highway': at(2, () => big(K.overpass(30), 1.5)); at(1, () => big(K.billboard ? K.billboard(rng) : K.cityBlock(rng), 2)); break;
      case 'checkpoint': at(3, () => big(K.watchtower(), 2)); break;
      case 'city': at(5, () => big(K.cityBlock(rng), 2.2 + rng.next())); break; // the dead skyline
      case 'battlefield': at(3, () => fire(big(K.tank(), 3), 2)); break; // burning armour on the ridge
      case 'base': at(2, () => big(K.hangar(rng), 1.8)); at(2, () => big(K.watchtower(), 2.2)); break;
      case 'industrial': at(4, () => fire(big(K.chimney(rng), 2), 12)); break;
      case 'settlement': at(1, () => fire(big(K.church(rng), 2), 4)); at(3, () => big(K.shack(rng), 2.6)); break;
    }
  },
  /* Instanced vegetation & rocks: thousands of items in a handful of draw calls. */
  vegetation(cfg, rng, group, x0, x1, seed) {
    const T = IF.r3.T, M = IF.kit.mats(), dummy = new T.Object3D();
    const inst = (geo, mat, list, shadow) => { if (!list.length) return; const im = new T.InstancedMesh(geo, mat, list.length); list.forEach((t, i) => { dummy.position.set(t[0], t[1], t[2]); dummy.rotation.set(t[5] || 0, t[3], 0); dummy.scale.setScalar(t[4]); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); }); im.castShadow = !!shadow; im.receiveShadow = true; group.add(im); };
    const trees = [], dead = [], rocks = [], grass = [];
    const occ = this._occ || [], free = (X, Z, s) => !occ.some(([ox, oz, r]) => Math.hypot(X - ox, Z - oz) < r + 1.5 * s);
    const put = (arr, X, Z, s, tilt) => free(X, Z, s) && arr.push([X, this.height(X, Z, cfg, seed) - 0.05, Z, rng.next() * 6.28, s, tilt || 0]);
    const dens = cfg.veg === 'pine' ? 2.4 : cfg.veg === 'mixed' ? 0.9 : cfg.veg === 'dead' ? 0.5 : 0;
    for (let X = x0; X < x1; X += 1 / Math.max(0.01, dens)) {
      if (!dens) break; const Z = -10 - rng.next() * 50;
      if (cfg.veg === 'dead' || (cfg.veg === 'mixed' && rng.chance(0.4))) put(dead, X, Z, 0.7 + rng.next() * 0.8, (rng.next() - 0.5) * 0.2); else put(trees, X, Z, 0.6 + rng.next() * 0.9);
    }
    for (let X = x0; X < x1; X += 0.9) { const Z = rng.chance(0.5) ? -2.6 - rng.next() * 20 : 2.8 + rng.next() * 5; if (rng.chance(0.55)) put(rocks, X, Z, 0.15 + rng.next() * (Z < -8 ? 1.4 : 0.45), rng.next()); }
    if (cfg.grassDensity) for (let X = x0; X < x1; X += 0.18 / cfg.grassDensity) { const Z = (rng.chance(0.7) ? -2.3 - rng.next() * 9 : 2.2 + rng.next() * 6); put(grass, X, Z, 0.5 + rng.next() * 0.7); }
    if (trees.length) inst(this.shared('pine', () => IF.kit.pineGeo(9)), IF.mat.basic(cfg.veg === 'pine' ? '#1c2a1e' : '#26301e', 1), trees, true);
    if (dead.length) inst(this.shared('dead', () => IF.kit.deadTreeGeo(8)), M.bark, dead, true);
    inst(this.shared('rock', () => { const g = new T.DodecahedronGeometry(0.6, 1); IF.kit.jitter(g, 0.25); g.scale(1, 0.6, 0.85); return g; }), M.rock, rocks, true);
    if (grass.length) inst(this.shared('grass', () => this.grassGeo()), this.grassMat(cfg), grass, false);
  },
  shared(k, make) { this._sh = this._sh || {}; if (!this._sh[k]) { this._sh[k] = make(); this._sh[k].userData = { shared: true }; } return this._sh[k]; },
  grassGeo() { const T = IF.r3.T, parts = []; for (let i = 0; i < 3; i++) { const p = new T.PlaneGeometry(0.5, 0.42, 1, 2); p.translate(0, 0.21, 0); p.rotateY(i * Math.PI / 3); parts.push(p); } return BGU.mergeGeometries(parts); },
  grassMat(cfg) {
    return IF.mat.get('grass' + cfg.grass, () => { const tex = IF.mat.canvasTex(128, (g, N) => { g.clearRect(0, 0, N, N); const r = new IF.RNG(3); for (let i = 0; i < 40; i++) { const x = r.next() * N, h = N * (0.4 + r.next() * 0.6); g.strokeStyle = 'rgba(' + (180 + r.next() * 60) + ',' + (190 + r.next() * 50) + ',' + (120 + r.next() * 40) + ',1)'; g.lineWidth = 2 + r.next() * 2; g.beginPath(); g.moveTo(x, N); g.quadraticCurveTo(x + (r.next() - 0.5) * 20, N - h * 0.6, x + (r.next() - 0.5) * 30, N - h); g.stroke(); } });
      return new IF.r3.T.MeshStandardMaterial({ color: cfg.grass, map: tex, alphaTest: 0.4, side: IF.r3.T.DoubleSide, roughness: 1 }); });
  },
  /* Merge static set dressing per material (one draw call per material per section). */
  batch(groups) {
    const T = IF.r3.T, byMat = new Map(), out = new T.Group();
    for (const g of groups) { g.updateMatrixWorld(true); g.traverse((o) => { if (!o.isMesh || !o.visible) return; let geo = o.geometry.clone().applyMatrix4(o.matrixWorld); if (geo.index) geo = geo.toNonIndexed(); for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k); if (!geo.attributes.uv) geo.setAttribute('uv', new T.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2)); const k = o.material.uuid; if (!byMat.has(k)) byMat.set(k, { mat: o.material, geos: [] }); byMat.get(k).geos.push(geo); }); }
    for (const { mat, geos } of byMat.values()) { const merged = BGU.mergeGeometries(geos); if (!merged) continue; const m = new T.Mesh(merged, mat); m.castShadow = true; m.receiveShadow = true; out.add(m); geos.forEach((gg) => gg.dispose()); }
    return out;
  },
};
