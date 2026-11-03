/* 3D engine — Three.js renderer for Steel & Blood.
 * Gameplay runs in "lane space" (x along the road in px, y down in px, ground baseline IF.GROUND).
 * The renderer lifts lane space onto real 3D terrain:  world = (x*S, laneHeight(x) + (GROUND - y)*S, z).
 * Everything at the same lane x shares the same terrain offset, so all tested gameplay
 * relationships (jumps, platforms, hit boxes) are preserved exactly while the world has true relief. */
'use strict';

IF.r3 = {
  ok: false, S: 0.01, renderer: null, scene: null, camera: null, world: null,
  sun: null, hemi: null, rim: null, pointLights: [], clock: 0,
  camPos: null, camLook: null, shake: { x: 0, y: 0 }, cine: null,

  init(canvas) {
    const T = window.THREE; if (!T) return false;
    try {
      const lowEnd = (navigator.hardwareConcurrency || 8) <= 4 || /Mobi|Android/i.test(navigator.userAgent);
      const r = new T.WebGLRenderer({ canvas, antialias: !lowEnd, powerPreference: 'high-performance' });
      if (lowEnd) this.autoTier = 'medium';
      if (!r.capabilities.isWebGL2) throw new Error('WebGL2 required');
      r.outputColorSpace = T.SRGBColorSpace; r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
      r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap;
      this.renderer = r; this.T = T;
      const sc = (this.scene = new T.Scene());
      this.camera = new T.PerspectiveCamera(34, IF.W / IF.H, 0.1, 400);
      this.camPos = new T.Vector3(0, 3, 12); this.camLook = new T.Vector3(0, 1, 0);
      this.hemi = new T.HemisphereLight('#8a7a90', '#2a2018', 0.9); sc.add(this.hemi);
      this.sun = new T.DirectionalLight('#ffb48a', 2.6); this.sun.castShadow = true;
      const sh = this.sun.shadow; sh.mapSize.set(2048, 1024); sh.camera.left = -16; sh.camera.right = 16; sh.camera.top = 9; sh.camera.bottom = -6; sh.camera.near = 1; sh.camera.far = 80; sh.bias = -0.0006; sh.normalBias = 0.02;
      sc.add(this.sun, this.sun.target);
      this.rim = new T.DirectionalLight('#9ab0ff', 0.7); sc.add(this.rim);
      for (let i = 0; i < 6; i++) { const p = new T.PointLight("#ff9a40", 0, 9, 1.6); sc.add(p); this.pointLights.push(p); }
      this.world = new T.Group(); sc.add(this.world);
      // image-based lighting from a simple procedural studio so PBR metal reads well
      const pm = new T.PMREMGenerator(r), es = new T.Scene();
      es.add(new T.Mesh(new T.SphereGeometry(10, 16, 8), new T.MeshBasicMaterial({ color: '#5a4a50', side: T.BackSide })));
      const add = (c, x, y, z, s) => { const m = new T.Mesh(new T.PlaneGeometry(s, s), new T.MeshBasicMaterial({ color: c })); m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m); };
      add('#fff0dc', 4, 6, 4, 7); add('#9ab0ff', -6, 3, -2, 6); add('#ff8050', 2, -2, -6, 5); add('#ffffff', 0, 8, 0, 6);
      sc.environment = pm.fromScene(es, 0.04).texture; sc.environmentIntensity = 1.0;
      IF.mat.init(T, r);
      IF.sky.init(sc);
      this.ok = true;
      this.applyQuality();
      return true;
    } catch (e) { console.warn('3D renderer unavailable, using 2D fallback:', e); this.ok = false; return false; }
  },
  /* Graphics tiers. 'auto' starts high and steps down while the measured frame time stays too long. */
  TIERS: {
    high: { shadows: true, soft: true, map: [2048, 1024], pr: 2, lights: 6, scale: 1 },
    medium: { shadows: true, soft: false, map: [1024, 512], pr: 1.25, lights: 4, scale: 1 },
    low: { shadows: false, soft: false, map: [512, 256], pr: 1, lights: 2, scale: 0.8 },
    potato: { shadows: false, soft: false, map: [512, 256], pr: 0.75, lights: 0, scale: 0.6 },
  },
  tierName() { const q = IF.save.data.settings.graphics || 'auto'; return q === 'auto' ? (this.autoTier || 'high') : q; },
  applyQuality() {
    if (!this.ok) return; const Q = this.TIERS[this.tierName()] || this.TIERS.high, T = this.T;
    this.tier = Q;
    this.renderer.shadowMap.enabled = Q.shadows; this.renderer.shadowMap.type = Q.soft ? T.PCFSoftShadowMap : T.PCFShadowMap;
    this.sun.shadow.mapSize.set(Q.map[0], Q.map[1]);
    if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    // the light count is part of every shader, so it only changes here (never per frame)
    this.pointLights.forEach((p, i) => { p.visible = i < Q.lights; });
    this.scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true)); });
    this.resize();
  },
  resize() {
    if (!this.ok) return; const c = this.renderer.domElement, Q = this.tier || this.TIERS.high;
    const w = c.clientWidth || IF.W, h = c.clientHeight || IF.H;
    const pr = Math.min(window.devicePixelRatio || 1, Q.pr) * Q.scale;
    this.renderer.setPixelRatio(pr); this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  },
  /* Called once per frame with the real frame time; drops a tier after ~3 s of sustained slow frames. */
  autoTune(dt) {
    if ((IF.save.data.settings.graphics || 'auto') !== 'auto' || !this.ok) return;
    const a = this._auto || (this._auto = { t: 0, acc: 0, n: 0, warm: 2.5 });
    if (a.warm > 0) { a.warm -= dt; return; } // ignore shader-compile hitches right after load
    a.t += dt; a.acc += Math.min(dt, 0.25); a.n++;
    if (a.t < 3) return;
    const avg = a.acc / a.n; a.t = a.acc = a.n = 0;
    const order = ['high', 'medium', 'low', 'potato'], i = order.indexOf(this.autoTier || 'high');
    if (avg > 1 / 45 && i < order.length - 1) { this.autoTier = order[i + 1]; a.warm = 2; this.applyQuality(); IF.ui && IF.ui.toast && IF.ui.toast('Graphics adjusted: ' + this.autoTier); }
  },

  /* ---------- lane <-> world ---------- */
  laneH(x) { return IF.terrain ? IF.terrain.laneHeight(x) : 0; },
  wx(x) { return x * this.S; },
  wy(x, y) { return this.laneH(x) + (IF.GROUND - y) * this.S; },
  toWorld(x, y, z, out) { out = out || new this.T.Vector3(); return out.set(x * this.S, this.wy(x, y), z || 0); },
  project(x, y, z) { // lane -> logical screen (1280x720) for the 2D HUD overlay
    const v = this._pv || (this._pv = new this.T.Vector3()); this.toWorld(x, y, z || 0, v).project(this.camera);
    return { x: (v.x + 1) / 2 * IF.W, y: (1 - v.y) / 2 * IF.H, vis: v.z < 1 };
  },
  /* Pointer (logical screen coords) -> lane coords on the plane z = zPlane. */
  screenToLane(sx, sy, zPlane) {
    const T = this.T, ndc = new T.Vector3(sx / IF.W * 2 - 1, -(sy / IF.H * 2 - 1), 0.5);
    ndc.unproject(this.camera); const o = this.camera.position, d = ndc.sub(o).normalize();
    const t = ((zPlane || 0) - o.z) / d.z; const X = o.x + d.x * t, Y = o.y + d.y * t;
    const x = X / this.S; return { x, y: IF.GROUND - (Y - this.laneH(x)) / this.S };
  },

  /* ---------- per-frame ---------- */
  render(run, dt) {
    const T = this.T, pl = run.player, cam = this.camera;
    this.clock += dt;
    // camera: side-on, slightly elevated, looking a little ahead; smooth follow; shake; cinematic overrides
    const cx = (run.camX + IF.VIEW_W / 2) * this.S, py = this.wy(pl.x, pl.y);
    const groundAhead = this.laneH(run.camX + IF.VIEW_W * 0.55);
    const footY = Math.min(py, groundAhead + 0.2);
    const tgtLook = new T.Vector3(cx, Math.max(footY, py - 1.2) + 1.95, 0);
    const tgtPos = new T.Vector3(cx - 1.2, tgtLook.y + 0.55, 11.8);
    if (this.cine) this.cine.apply(tgtPos, tgtLook, dt);
    const k = this.snapCam ? 1 : Math.min(1, dt * (this.cine ? 3 : 6)); this.snapCam = false;
    this.camPos.lerp(tgtPos, k); this.camLook.lerp(tgtLook, k);
    cam.position.copy(this.camPos); cam.position.x += IF.fx.shakeX * this.S * 1.4; cam.position.y += IF.fx.shakeY * this.S * 1.4;
    cam.lookAt(this.camLook);
    // key light follows the action so the shadow frustum stays tight
    const b = run.world.biome, L = IF.sky.lighting(b, run);
    this.sun.position.set(cx + L.sunDir[0] * 30, L.sunDir[1] * 30, L.sunDir[2] * 30); this.sun.target.position.set(cx, py, 0);
    this.rim.position.set(cx + 20, 10, -25);
    IF.sky.update(this, run, dt);
    IF.terrain.update(run, cx);
    IF.chars3d.update(run, dt);
    IF.fx3d.update(run, dt);
    this.updatePointLights(run);
    this.renderer.render(this.scene, cam);
  },
  /* Assign the pooled point lights to the brightest nearby emitters (fires, muzzle flashes, explosions). */
  updatePointLights(run) {
    const em = IF.fx3d.lightEmitters, cx = (run.camX + IF.VIEW_W / 2);
    em.sort((a, b) => Math.abs(a.x - cx) / a.i - Math.abs(b.x - cx) / b.i);
    for (let i = 0; i < this.pointLights.length; i++) {
      const p = this.pointLights[i], e = em[i];
      if (e && Math.abs(e.x - cx) < 1100) { p.color.set(e.c); p.intensity = e.i; p.distance = e.r || 9; this.toWorld(e.x, e.y, e.z || 0.6, p.position); }
      else p.intensity = 0; // never toggle visibility: changing the light count recompiles every shader
    }
    em.length = 0;
  },
};
