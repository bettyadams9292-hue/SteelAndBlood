/* 3D effects & characters orchestration:
 *  - particles (GPU points, two blend modes) fed from the existing IF.fx simulation
 *  - decals, gibs, projectiles, pickups, hazards, shockwaves, boss telegraphs
 *  - the knight rig, the instanced horde, boss weapons */
'use strict';

IF.fx3d = {
  lightEmitters: [], MAXP: 1200,
  init() {
    const T = IF.r3.T;
    const mk = (blend) => {
      const geo = new T.BufferGeometry(), n = this.MAXP;
      geo.setAttribute('position', new T.BufferAttribute(new Float32Array(n * 3), 3).setUsage(T.DynamicDrawUsage));
      geo.setAttribute('pcolor', new T.BufferAttribute(new Float32Array(n * 4), 4).setUsage(T.DynamicDrawUsage));
      geo.setAttribute('size', new T.BufferAttribute(new Float32Array(n), 1).setUsage(T.DynamicDrawUsage));
      const mat = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: blend, uniforms: { scale: { value: 600 }, fogColor: { value: new T.Color() }, fogDensity: { value: 0 } },
        vertexShader: 'attribute float size; attribute vec4 pcolor; varying vec4 vC; varying float vD; uniform float scale; void main(){ vC = pcolor; vec4 mv = modelViewMatrix * vec4(position,1.0); vD = -mv.z; gl_PointSize = size * scale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'varying vec4 vC; varying float vD; uniform vec3 fogColor; uniform float fogDensity; void main(){ vec2 p = gl_PointCoord - 0.5; float d = length(p); if (d > 0.5) discard; float a = vC.a * smoothstep(0.5, 0.15, d); float f = 1.0 - exp(-fogDensity*fogDensity*vD*vD); gl_FragColor = vec4(mix(vC.rgb, fogColor, f*0.8), a); }' });
      const pts = new T.Points(geo, mat); pts.frustumCulled = false; IF.r3.scene.add(pts); return pts;
    };
    this.pNorm = mk(T.NormalBlending); this.pAdd = mk(T.AdditiveBlending); this.pAdd.renderOrder = 5; this.pNorm.renderOrder = 4;
    // decals (instanced quads on the ground)
    const dtex = IF.mat.canvasTex(128, (g, N) => { const gr = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.65, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283, r = N * (0.36 + Math.sin(i * 3.7) * 0.08); g.lineTo(N / 2 + Math.cos(a) * r, N / 2 + Math.sin(a) * r); } g.fill(); });
    this.decals = new T.InstancedMesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ map: dtex, transparent: true, depthWrite: false, roughness: 0.25, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2 }), 140);
    this.decals.count = 0; this.decals.setColorAt(0, new T.Color()); this.decals.frustumCulled = false; this.decals.receiveShadow = true; IF.r3.scene.add(this.decals);
    // tracers
    this.tracer = new T.LineSegments(new T.BufferGeometry(), new T.LineBasicMaterial({ vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
    this.tracer.geometry.setAttribute('position', new T.BufferAttribute(new Float32Array(600 * 6), 3).setUsage(T.DynamicDrawUsage)); this.tracer.geometry.setAttribute('color', new T.BufferAttribute(new Float32Array(600 * 6), 3).setUsage(T.DynamicDrawUsage)); this.tracer.frustumCulled = false; IF.r3.scene.add(this.tracer);
    // pooled meshes for projectiles, pickups, gibs, rings
    this.pools = {};
    const pool = (k, make, n) => { this.pools[k] = { list: [], make, n: 0 }; };
    const M = IF.kit.mats(), W = IF.wep3d.mats();
    pool('arrow', () => { const g = new T.Group(); const s = new T.Mesh(new T.CylinderGeometry(0.8, 0.8, 70, 5).rotateZ(Math.PI / 2), M.timber); s.position.x = -35; g.add(s); g.add(new T.Mesh(new T.ConeGeometry(1.8, 7, 6).rotateZ(-Math.PI / 2), M.steel)); return g; });
    pool('grenade', () => new T.Mesh(new T.SphereGeometry(5, 10, 8).scale(1, 1.3, 1), IF.mat.basic('#3a4a2a', 0.6, 0.3)));
    pool('rocket', () => { const g = new T.Group(); g.add(new T.Mesh(new T.CylinderGeometry(3.6, 3.6, 22, 10).rotateZ(Math.PI / 2), IF.mat.basic('#5a6a4a', 0.6, 0.4))); const c = new T.Mesh(new T.ConeGeometry(3.6, 9, 10).rotateZ(-Math.PI / 2), IF.mat.basic('#9a3a24', 0.6, 0.3)); c.position.x = 15; g.add(c); return g; });
    pool('spit', () => new T.Mesh(new T.SphereGeometry(6, 8, 6), IF.mat.glow('#9adf3a', 2)));
    pool('throwable', () => new T.Group());
    pool('health', () => { const g = new T.Group(); g.add(new T.Mesh(new T.BoxGeometry(22, 16, 14), M.white)); IF.kit.emblemMesh(g, 0, 0, 7.2, 12, '#c0141c'); return g; });
    pool('ammo', () => { const g = new T.Group(); g.add(new T.Mesh(new T.BoxGeometry(26, 14, 14), M.olive)); for (let i = 0; i < 4; i++) { const b = new T.Mesh(new T.CylinderGeometry(1.4, 1.4, 8, 6), W.brass); b.position.set(-8 + i * 5, 10, 0); g.add(b); } return g; });
    pool('gold', () => new T.Mesh(new T.CylinderGeometry(5, 5, 1.4, 14).rotateX(Math.PI / 2), IF.mat.metal('#e8b830', 0.25, 1)));
    pool('ring', () => new T.Mesh(new T.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: '#ffb070', transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })));
    pool('wave', () => new T.Mesh(new T.ConeGeometry(28, 46, 10, 1, true), new T.MeshBasicMaterial({ color: '#ffaa60', transparent: true, opacity: 0.5, blending: T.AdditiveBlending, depthWrite: false })));
    pool('tele', () => new T.Mesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: '#ff2a1a', transparent: true, depthWrite: false, opacity: 0.3 })));
    pool('laser', () => new T.Mesh(new T.CylinderGeometry(0.4, 0.4, 1, 4).rotateZ(Math.PI / 2), new T.MeshBasicMaterial({ color: '#ff2020', transparent: true, opacity: 0.7, blending: T.AdditiveBlending })));
    pool('hazard', () => new T.Mesh(new T.CircleGeometry(1, 20).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: '#8ad030', transparent: true, opacity: 0.4, depthWrite: false })));
    // gibs
    const sk = IF.mat.skin('#8a9a78');
    pool('g_arm', () => { const g = new T.Group(); g.add(new T.Mesh(new T.CapsuleGeometry(5.5, 40, 4, 8).rotateZ(Math.PI / 2), sk)); const s = new T.Mesh(new T.CylinderGeometry(6, 6, 2, 8).rotateZ(Math.PI / 2), IF.mat.blood()); s.position.x = -26; g.add(s); return g; });
    pool('g_leg', () => { const g = new T.Group(); g.add(new T.Mesh(new T.CapsuleGeometry(7, 52, 4, 8).rotateZ(Math.PI / 2), IF.mat.cloth('#3a3d45'))); const b = new T.Mesh(new T.BoxGeometry(10, 16, 10), IF.mat.basic('#1d1814')); b.position.x = 30; g.add(b); const s = new T.Mesh(new T.CylinderGeometry(7.5, 7.5, 2, 8).rotateZ(Math.PI / 2), IF.mat.blood()); s.position.x = -32; g.add(s); return g; });
    pool('g_head', () => { const g = new T.Group(); g.add(new T.Mesh(new T.SphereGeometry(12, 12, 10).scale(1, 1.1, 0.92), sk)); const s = new T.Mesh(new T.CylinderGeometry(6, 6, 2, 8), IF.mat.blood()); s.position.y = -12; g.add(s); for (const z of [-4, 4]) { const e = new T.Mesh(new T.SphereGeometry(1.7, 6, 5), IF.mat.glow('#d8d2a8', 0.6)); e.position.set(10, 3, z); g.add(e); } return g; });
    pool('g_skull', () => new T.Mesh(new T.SphereGeometry(7, 8, 6, 0, 3.6), IF.mat.bone()));
    pool('g_chunk', () => new T.Mesh(new T.DodecahedronGeometry(6, 0), IF.mat.get('meat', () => new T.MeshStandardMaterial({ color: '#8a1414', roughness: 0.35 }))));
    pool('g_rib', () => new T.Mesh(new T.TorusGeometry(10, 1.2, 4, 10, 2.2), IF.mat.bone()));
    pool('g_guts', () => { const pts = []; for (let i = 0; i < 7; i++) pts.push(new T.Vector3(i * 7, Math.sin(i * 1.7) * 6, Math.cos(i * 1.3) * 5)); return new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 20, 3.2, 6), IF.mat.get('guts', () => new T.MeshStandardMaterial({ color: '#b4566a', roughness: 0.25 }))); });
    pool('g_torso', () => { const g = new T.Group(); g.add(new T.Mesh(new T.CapsuleGeometry(14, 16, 4, 10).rotateZ(Math.PI / 2), IF.mat.cloth('#5a5246'))); const r = new T.Mesh(new T.CylinderGeometry(12, 12, 2, 10).rotateZ(Math.PI / 2), IF.mat.blood()); r.position.x = 22; g.add(r); return g; });
    IF.tac.pools3d(pool, T); IF.companions && IF.companions.pools3d && IF.companions.pools3d(pool, T);
    this.color = new T.Color(); this.v = new T.Vector3(); this.dummy = new T.Object3D();
  },
  take(k) { const p = this.pools[k]; let m = p.list[p.n]; if (!m) { m = p.make(); m.traverse((o) => { if (o.isMesh) { o.castShadow = !/ring|wave|tele|laser|hazard/.test(k); } }); IF.r3.scene.add(m); p.list.push(m); } m.visible = true; p.n++; return m; },
  beginPools() { for (const k in this.pools) this.pools[k].n = 0; },
  endPools() { for (const k in this.pools) { const p = this.pools[k]; for (let i = p.n; i < p.list.length; i++) p.list[i].visible = false; } },
  place(m, x, y, z, s) { IF.r3.toWorld(x, y, z || 0.3, m.position); m.scale.setScalar((s || 1) * IF.r3.S); return m; },

  update(run, dt) {
    const R = IF.r3, S = R.S;
    this.beginPools();
    this.particles(run);
    this.updateDecals(run);
    this.projectiles(run);
    this.gibs(run);
    this.misc(run);
    IF.tac.render3d(this, run);
    this.endPools();
    const fog = R.scene.fog; for (const p of [this.pNorm, this.pAdd]) { p.material.uniforms.fogColor.value.copy(fog.color); p.material.uniforms.fogDensity.value = fog.density; p.material.uniforms.scale.value = R.renderer.domElement.height * 0.9; }
  },
  /* convert the 2D particle pool into GPU points */
  particles(run) {
    const R = IF.r3, S = R.S, c = this.color;
    let nN = 0, nA = 0; const pn = this.pNorm.geometry.attributes, pa = this.pAdd.geometry.attributes;
    const put = (attrs, i, x, y, z, col, a, size) => { attrs.position.setXYZ(i, x * S, R.wy(x, y), z); c.set(col); attrs.pcolor.setXYZW(i, c.r, c.g, c.b, a); attrs.size.setX(i, size); };
    IF.fx.parts.forEachAlive((p) => {
      const k = p.life / p.max, z = p.z !== undefined ? p.z : 0.5 + ((p.x * 7) % 40) / 100;
      let col = p.color, a = 1, size = p.size * S * 2.2, add = p.add;
      if (typeof col === 'string' && col.startsWith('rgba')) { const m = col.match(/[\d.]+/g); col = 'rgb(' + m[0] + ',' + m[1] + ',' + m[2] + ')'; a = parseFloat(m[3]); }
      switch (p.type) {
        case 'smoke': a *= Math.min(1, k * 1.5); size = p.size * S * 2.4; break;
        case 'mist': a = k * 0.45; break;
        case 'spark': a = k; size = Math.max(0.03, p.size * S * 4); break;
        case 'flash': case 'glow': a = k; size = p.size * S * 2; break;
        case 'fire': case 'ember': a = k; break;
        case 'blood': size = Math.max(0.035, p.size * S * 1.6); break;
        case 'shell': case 'debris': size = Math.max(0.03, p.size * S * 1.8); break;
        case 'ring': return this.ringFx(p, k);
        case 'bolt': return this.boltFx(p, k);
        default: a = k;
      }
      if (add) { if (nA < this.MAXP) put(pa, nA++, p.x, p.y, z, col, a, size); } else if (nN < this.MAXP) put(pn, nN++, p.x, p.y, z, col, a, size);
      if (p.type === 'flash' || (p.type === 'glow' && p.size > 40)) this.lightEmitters.push({ x: p.x, y: p.y, i: 6 * k, c: '#ffb050', r: 8 });
      if (p.type === 'fire' && Math.random() < 0.05) this.lightEmitters.push({ x: p.x, y: p.y, i: 3 * k, c: '#ff7020', r: 7 });
    });
    for (const [pts, n] of [[this.pNorm, nN], [this.pAdd, nA]]) { const g = pts.geometry; g.setDrawRange(0, n); g.attributes.position.needsUpdate = g.attributes.pcolor.needsUpdate = g.attributes.size.needsUpdate = true; }
  },
  ringFx(p, k) { const m = this.take('ring'); IF.r3.toWorld(p.x, Math.min(p.y, IF.GROUND - 2), 0.3, m.position); m.position.y = Math.max(m.position.y, IF.r3.laneH(p.x) + 0.05); m.scale.set(p.size * IF.r3.S, 1, p.size * IF.r3.S * 0.6); m.material.opacity = k; m.material.color.set(p.color.startsWith('rgba') ? 'rgb(' + p.color.match(/[\d.]+/g).slice(0, 3).join(',') + ')' : p.color); },
  boltFx(p, k) { /* lightning: drawn as bright additive points along the path */ const pa = this.pAdd.geometry.attributes; for (const q of p.pts) IF.fx.spawn({ x: q[0], y: q[1], life: 0.06, size: 6, color: '#9ad8ff', type: 'glow', add: true }); },
  updateDecals(run) {
    const R = IF.r3, D = this.decals, d = this.dummy; let n = 0;
    for (const q of IF.fx.decals) {
      if (n >= 140) break; const s = q.kind === 'pool' ? q.size * 3.2 : q.kind === 'scorch' ? q.size * 2 : q.size * 2.2;
      d.position.set(q.x * R.S, R.laneH(q.x) + 0.012 + n * 0.0004, 0.2 + ((q.seed || 0.5) - 0.5) * 0.6); d.rotation.set(0, (q.seed || 0) * 6.28, 0); d.scale.set(s * R.S * 1.4, 1, s * R.S * (q.kind === 'pool' ? 1.1 : 0.9)); d.updateMatrix(); D.setMatrixAt(n, d.matrix);
      this.color.set(q.kind === 'scorch' ? '#0c0a08' : q.kind === 'toxic' ? '#5a8a20' : '#3a0404'); D.setColorAt(n, this.color); n++;
    }
    D.count = n; D.instanceMatrix.needsUpdate = true; if (D.instanceColor) D.instanceColor.needsUpdate = true;
  },
  projectiles(run) {
    const R = IF.r3, S = R.S, pos = this.tracer.geometry.attributes.position, col = this.tracer.geometry.attributes.color; let n = 0;
    IF.combat.proj.forEachAlive((p) => {
      if (p.kind === 'bullet' || p.kind === 'ebullet') { if (n >= 600) return; const tail = 0.03; const z = 0.3; pos.setXYZ(n * 2, p.x * S, R.wy(p.x, p.y), z); pos.setXYZ(n * 2 + 1, (p.x - p.vx * tail) * S, R.wy(p.x - p.vx * tail, p.y - p.vy * tail), z); const c = p.owner === 'player' ? [1.6, 1.3, 0.7] : [1.6, 0.4, 0.3]; col.setXYZ(n * 2, c[0], c[1], c[2]); col.setXYZ(n * 2 + 1, 0, 0, 0); n++; return; }
      const m = this.take(p.kind === 'egrenade' ? 'grenade' : p.kind); this.place(m, p.x, p.y, 0.3); m.rotation.set(0, 0, -Math.atan2(p.vy, p.vx));
      if (p.kind === 'rocket') this.lightEmitters.push({ x: p.x, y: p.y, i: 4, c: '#ffa040', r: 6 });
    });
    this.tracer.geometry.setDrawRange(0, n * 2); pos.needsUpdate = col.needsUpdate = true;
  },
  gibs(run) {
    for (const g of IF.gore.gibs) {
      const k = { arm: 'g_arm', leg: 'g_leg', head: 'g_head', skull: 'g_skull', chunk: 'g_chunk', rib: 'g_rib', guts: 'g_guts', torso: 'g_torso' }[g.kind]; if (!k) continue;
      const m = this.take(k); this.place(m, g.x, g.y, 0.4 + (g.seed - 0.5) * 0.6, g.s); m.rotation.set(g.seed * 3, g.seed * 5, -g.rot);
      if (g.life < 1.5) m.position.y -= (1.5 - g.life) * 0.05;
    }
  },
  misc(run) {
    const R = IF.r3, t = R.clock, W = run.world;
    for (const p of W.pickups) { if (!p.alive) continue; const m = this.take(p.kind); this.place(m, p.x, p.y + Math.sin(t * 4 + p.x) * 3 - 4, 0.3); m.rotation.y = t * 2 + p.x; if (p.kind !== 'gold') this.lightEmitters.push({ x: p.x, y: p.y - 10, i: 0.8, c: p.kind === 'health' ? '#60ff80' : '#ffc070', r: 2.5 }); }
    for (const h of run.hazards) { const m = this.take('hazard'); IF.r3.toWorld(h.x, IF.GROUND, 0.3, m.position); m.position.y += 0.02; m.scale.set(h.w / 2 * R.S, 1, 0.9); m.material.color.set(h.type === 'fire' ? '#ff6a1a' : '#8ad030'); m.material.opacity = Math.min(0.5, h.t * 0.25); if (h.type === 'fire') this.lightEmitters.push({ x: h.x, y: IF.GROUND - 30, i: 5, c: '#ff7020', r: 8 }); }
    for (const s of run.shockwaves) { const m = this.take('wave'); this.place(m, s.x, IF.GROUND - 23, 0.3); }
    // boss telegraphs: red danger zones on the ground, laser sight for barrages
    const B = run.boss;
    if (B && !B.dead && B.atk && B.stateT < B.atk.wind) {
      const a = B.atk, k = Math.min(1, B.stateT / a.wind), zone = (x0, x1) => { const m = this.take('tele'); const cx = (x0 + x1) / 2; IF.r3.toWorld(cx, IF.GROUND, 0.3, m.position); m.position.y += 0.03; m.scale.set(Math.abs(x1 - x0) * R.S, 1, 2.2); m.material.opacity = 0.18 + 0.25 * k + Math.sin(t * 20) * 0.05; };
      if (a.kind === 'sweep') zone(B.x, B.x + B.facing * 300); if (a.kind === 'slam') zone(B.x + B.facing * 90 - 130, B.x + B.facing * 90 + 130); if (a.kind === 'leap') zone(run.player.x - 175, run.player.x + 175); if (a.kind === 'charge') zone(B.x, B.x + B.facing * 1400);
      if (a.kind === 'barrage') { const m = this.take('laser'), y = B.y - B.h * 0.62; IF.r3.toWorld(B.x + B.facing * 750, y, 0.3, m.position); m.scale.set(1500 * R.S, R.S, R.S); }
    }
  },
};

/* Character orchestration */
IF.chars3d = {
  knight: null, bossW: {},
  update(run, dt) {
    const pl = run.player, R = IF.r3;
    if (!this.knight) this.knight = new IF.Knight3D();
    const P = pl.pose(); let roll = 0, rollZ = 0;
    if (pl.state === 'dodge') roll = Math.min(1, pl.stateT / 0.42) * Math.PI * 2;
    if (pl.dead) rollZ = Math.min(1, pl.deadT * 2.2) * (pl.facing > 0 ? 1.45 : -1.45);
    const flicker = pl.iframes > 0 && !pl.dead && pl.state !== 'dodge' && Math.floor(pl.t * 24) % 2 === 0;
    this.knight.update(P, pl.x, pl.y, pl.facing, pl.look, { roll, rollZ, flash: pl.flashT > 0 ? '#ff3a2a' : pl.buff('berserk') && Math.sin(pl.t * 10) > 0.6 ? '#ff2010' : null, visible: !flicker || pl.flashT > 0, spin: pl.gun && pl.gun.spin ? pl.t * pl.gun.spin * 30 : 0, z: 0.35 });
    // horde
    IF.crowd.begin(); this.seenBoss = {};
    const cx = run.camX + IF.VIEW_W / 2;
    for (const e of run.enemies) { if (e.gibbed || Math.abs(e.x - cx) > IF.VIEW_W * 1.1) continue; if (e.dead && e.deadT > 4.6) continue; IF.crowd.add(e); }
    IF.crowd.end();
    IF.companions.render3d(run);
    for (const id in this.bossW) if (!this.seenBoss[id]) this.bossW[id].visible = false;
    if (this.bossA) for (const id in this.bossA) if (!this.seenBoss[id]) { const A = this.bossA[id]; A.paulF.visible = A.paulB.visible = A.chest.visible = A.aura.visible = false; }
  },
  /* Bespoke armour for each boss so it never reads as an enlarged zombie: spiked pauldrons, a breastplate,
   * a crest (crown / horns / helmet plume) and a ground aura that marks it out from the horde. */
  bossArmour(e, J, rootMatrix) {
    const T = IF.r3.T, L = e.def.look, id = e.def.id; this.bossA = this.bossA || {};
    let A = this.bossA[id];
    if (!A) {
      const metalC = L.obsidian ? '#2a1f3a' : L.medals || L.helmet ? '#3a3f36' : '#3a3434', metal = IF.mat.metal(metalC, 0.4, 0.9, 'bossm' + id), trim = IF.mat.metal(L.obsidian ? '#b77bff' : '#a8843a', 0.3, 1, 'bosst' + id), glow = IF.mat.glow(L.eyes || '#ff4020', 2.2);
      const mk = () => { const g = new T.Group(); g.matrixAutoUpdate = false; IF.r3.scene.add(g); return g; }, M = (geo, m, g, x = 0, y = 0, z = 0) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
      A = this.bossA[id] = { paulF: mk(), paulB: mk(), chest: mk(), aura: null };
      for (const k of ['paulF', 'paulB']) { const g = A[k]; for (let i = 0; i < 3; i++) { const l = M(new T.SphereGeometry(15 - i * 2, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), metal, g, 0, -i * 5, 0); l.scale.set(1.1, 0.8, 1); } M(new T.TorusGeometry(14.5, 1, 5, 18), trim, g, 0, 0, 0).rotation.x = Math.PI / 2; for (let i = -1; i <= 1; i++) M(new T.ConeGeometry(2.6, 16, 6), metal, g, i * 7, 12, 0); }
      const c = A.chest; const pl = M(new T.SphereGeometry(20, 16, 12, 0, Math.PI * 2, 0.35, 1.9), metal, c, 0, 0, 0); pl.scale.set(0.85, 1.25, 1.0); M(new T.BoxGeometry(2, 34, 2), trim, c, 17.5, 0, 0);
      M(new T.TorusGeometry(10, 2, 6, 16), glow, c, 15, 6, 0).rotation.y = Math.PI / 2; // glowing sigil
      const ring = new T.Mesh(new T.RingGeometry(0.85, 1, 48).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: L.eyes || '#ff3020', transparent: true, opacity: 0.5, blending: T.AdditiveBlending, depthWrite: false })); IF.r3.scene.add(ring); A.aura = ring;
    }
    const v = !e.dead || e.deadT < 2.5, place = (g, x, y, z, rot, sc) => { g.visible = v; g.matrix.multiplyMatrices(rootMatrix, new T.Matrix4().compose(new T.Vector3(x, -y, z), new T.Quaternion().setFromEuler(new T.Euler(0, 0, rot)), new T.Vector3(sc, sc, sc))); };
    place(A.paulF, J.shF.x, J.shF.y - 3, 14, -0.2, 1.05); place(A.paulB, J.shB.x, J.shB.y - 3, -14, -0.2, 1.05);
    place(A.chest, J.hip.x + J.nx * J.torso * 0.55, J.hip.y + J.ny * J.torso * 0.55, 0, -P_lean(J), 1);
    const R = IF.r3; R.toWorld(e.x, IF.GROUND, 0, A.aura.position); A.aura.position.y += 0.04; const s = (e.w * 1.3 + 40) * R.S * (1 + Math.sin(R.clock * 3) * 0.05); A.aura.scale.set(s, 1, s * 0.6); A.aura.visible = !e.dead;
    function P_lean(J) { return Math.atan2(J.nx, -J.ny); }
  },
  bossExtras(e, P, J, rootMatrix) {
    this.bossArmour(e, J, rootMatrix); this.seenBoss[e.def.id] = 1;
    const T = IF.r3.T, L = e.def.look, W = { axe: 'great_axe', sword: 'steel_longsword', greatsword: 'greatsword', rifle: 'k47' }[L.weapon]; if (!W) return;
    let g = this.bossW[e.def.id];
    if (!g) { const def = Object.assign({}, IF.WEAPON[W]); if (L.weapon === 'greatsword') def.look = { blade: '#2a1f3a', edge: '#b77bff', guard: '#140f1b', glow: '#a36bff' }; if (L.weapon === 'axe') def.look = { blade: '#4a4642', edge: '#9a8a7a', guard: '#2a1a10' }; g = this.bossW[e.def.id] = IF.wep3d.build(def, L.weapon === 'greatsword' ? 4 : 0); g.matrixAutoUpdate = false; IF.r3.scene.add(g); }
    const local = new T.Matrix4().compose(new T.Vector3(J.hF.x, -J.hF.y, 9), new T.Quaternion().setFromEuler(new T.Euler(0, 0, -(P.wAngle ?? -0.8))), new T.Vector3(1.3, 1.3, 1.3));
    g.matrix.multiplyMatrices(rootMatrix, local); g.visible = !e.dead || e.deadT < 4; this.seenBoss[e.def.id] = 1;
  },
};
