/* Section gate — a ruined stone gatehouse with an animated iron portcullis, braziers and heraldry,
 * plus the cinematic that plays when it opens and when the knight walks through it.
 * The gate wall is turned towards the camera so the portcullis reads clearly from the side-on view. */
'use strict';

IF.gate3d = {
  ANGLE: 0.62, // how far the gate face is turned towards the camera (radians)
  cur: null,

  build(W, chunk) {
    const K = IF.kit, T = IF.r3.T, M = K.mats(), S = IF.r3.S;
    const b = W.biome.id, modern = /highway|checkpoint|city|battlefield|base|industrial|bunker|lab|settlement/.test(b);
    const root = new T.Group(), g = new T.Group(); root.add(g); g.rotation.y = this.ANGLE;
    const X = W.gateX * S, Y = IF.terrain.laneHeight(W.gateX);
    root.position.set(X, Y - 0.05, 0);
    const stone = modern ? M.concrete : M.stone, stoneDark = modern ? M.concreteDark : M.stoneDark;
    const OPEN = 1.75, H = 3.9; // half-width and height of the arch opening (metres, local z / y)

    // plinth and threshold
    K.box(2.4, 0.18, OPEN * 2 + 4, stoneDark, 0, 0.05, 0, g);
    // back tower (tall) and front tower (ruined stump so it never hides the knight)
    const tw = (z, h, ruined) => {
      const t = K.box(2.2, h, 2.0, stone, 0, h / 2, z, g);
      for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) if (!ruined || i < 2) K.box(0.5, 0.7, 0.45, stone, sx * 0.85, h + 0.35, z - 0.75 + i * 0.75, g);
      K.box(2.3, 0.22, 2.1, stoneDark, 0, h * 0.62, z, g);
      for (let i = 0; i < 2; i++) K.box(0.08, 0.7, 0.24, M.dark, -1.11, h * (0.4 + i * 0.25), z, g); // arrow slits
      return t;
    };
    tw(-(OPEN + 1.0), 8.4, false);
    // the near-side tower has collapsed: a low jamb and scattered blocks keep the knight in view
    K.box(1.3, H + 1.5, 0.75, stone, 0, (H + 1.5) / 2, OPEN + 0.45, g);
    K.box(1.4, 0.2, 0.85, stoneDark, 0, H * 0.62, OPEN + 0.45, g);
    for (let i = 0; i < 7; i++) { const r = K.box(0.35 + Math.random() * 0.35, 0.25 + Math.random() * 0.25, 0.45, stone, -0.8 + Math.random() * 2, 0.15, OPEN + 1.2 + Math.random() * 1.6, g); r.rotation.set(Math.random() * 0.6, Math.random() * 3, Math.random() * 0.6); }
    // lintel / gatehouse bridge over the opening
    K.box(2.0, 1.5, OPEN * 2 + 0.6, stone, 0, H + 0.75, -0.25, g);
    K.box(2.1, 0.2, OPEN * 2 + 0.8, stoneDark, 0, H + 0.05, -0.25, g);
    for (let i = 0; i < 5; i++) K.box(0.5, 0.6, 0.45, stone, -0.75, H + 1.8, -OPEN + 0.2 + i * 0.75, g);
    // curtain wall running back into the scene
    const wallLen = 12, wz = -(OPEN + 2.0) - wallLen / 2;
    K.box(1.4, 5.6, wallLen, stone, 0.2, 2.8, wz, g);
    for (let i = 0; i < wallLen / 1.1; i++) K.box(0.5, 0.7, 0.5, stone, -0.25, 5.95, wz - wallLen / 2 + 0.4 + i * 1.1, g);
    if (modern) { // razor wire and floodlight on the modern variant
      for (let i = 0; i < 8; i++) { const c = new T.Mesh(new T.TorusGeometry(0.28, 0.012, 4, 14), M.steel); c.position.set(0.2, 5.85, wz - wallLen / 2 + 0.7 + i * 1.4); c.rotation.y = Math.PI / 2; g.add(c); }
      const pole = K.cyl(0.06, 0.06, 2.4, M.steel, -0.6, H + 2.6, -OPEN - 0.6, g, 8);
      K.box(0.3, 0.25, 0.5, IF.mat.glow('#e8f0ff', 2.5), -0.75, H + 3.8, -OPEN - 0.6, g);
    }
    // heraldry: a long banner hanging from the gatehouse and a gold sigil over the arch
    const ban = K.mesh(new T.PlaneGeometry(1.1, 2.6, 3, 8), K.heraldryMat(), -1.02, H - 0.2, -OPEN - 0.9, g); ban.rotation.y = -Math.PI / 2; ban.userData.wave = true;
    const sig = K.mesh(new T.CircleGeometry(0.42, 24), IF.mat.metal('#c9a24a', 0.35, 1), -1.02, H + 0.8, -0.25, g); sig.rotation.y = -Math.PI / 2;
    const sigGlow = K.mesh(new T.RingGeometry(0.44, 0.52, 24), IF.mat.glow('#ffcc66', 0.2), -1.03, H + 0.8, -0.25, g); sigGlow.rotation.y = -Math.PI / 2; sigGlow.material = sigGlow.material.clone();
    // portcullis: iron grid with spiked feet, raised when the section is cleared
    const bars = [];
    const bw = OPEN * 2 - 0.1, bh = H - 0.05, nV = 9, nH = 6;
    for (let i = 0; i < nV; i++) {
      const z = -bw / 2 + (i + 0.5) * bw / nV;
      bars.push(new T.BoxGeometry(0.08, bh, 0.08).translate(0, bh / 2, z));
      bars.push(new T.ConeGeometry(0.06, 0.24, 6).rotateZ(Math.PI).translate(0, -0.1, z));
    }
    for (let j = 0; j < nH; j++) bars.push(new T.BoxGeometry(0.1, 0.07, bw).translate(0, 0.35 + j * (bh - 0.5) / (nH - 1), 0));
    const port = new T.Mesh(BGU.mergeGeometries(bars.map((x) => x.toNonIndexed())), IF.mat.metal('#3a3c40', 0.5, 0.9));
    port.castShadow = true; port.position.set(-0.4, 0, -0.25); g.add(port);
    // chains running up into the gatehouse
    for (const z of [-OPEN + 0.3, OPEN - 0.8]) K.cyl(0.025, 0.025, 1.6, M.iron, -0.9, H + 0.6, z, g, 4);
    // braziers either side of the approach
    const lights = [];
    for (const z of [-(OPEN + 0.4), OPEN + 0.2]) {
      const br = K.brazier(); br.scale.setScalar(1.25); br.position.set(-1.7, 0, z); g.add(br);
      br.traverse((o) => { if (o.userData.flame) { o.userData.fid = Math.random() * 10; chunk.flames.push(o); } });
      lights.push({ lx: -1.7, lz: z });
    }
    // world positions of the brazier fires for the point-light pool
    root.updateMatrixWorld(true);
    for (const L of lights) { const v = new T.Vector3(L.lx, 0, L.lz).applyMatrix4(g.matrixWorld); chunk.lights.push({ x: v.x / S, y: IF.GROUND - 125, z: v.z + 0.3, i: 5, c: '#ff8a3a', r: 10 }); }
    g.traverse((o) => { if (o.userData.wave && !o.userData.base) { o.userData.base = Float32Array.from(o.geometry.attributes.position.array); chunk.wavers.push(o); } });
    this.cur = { W, root, port, sig: sigGlow, lift: W.gateOpen ? 1 : 0, shake: 0, wasOpen: !!W.gateOpen };
    return root;
  },

  update(run, t) {
    const c = this.cur; if (!c || c.W !== run.world) return;
    const dt = run.lastDt || 1 / 60, open = c.W.gateOpen;
    if (open && !c.wasOpen) { c.wasOpen = true; c.shake = 1.4; IF.audio.ui && IF.audio.ui('gate'); }
    const tgt = open ? 1 : 0; c.lift += (tgt - c.lift) * Math.min(1, dt * 0.9) + (open ? dt * 0.08 : 0); c.lift = Math.min(1, c.lift);
    const jitter = c.shake > 0 ? Math.sin(t * 60) * 0.02 * c.shake : 0; c.shake = Math.max(0, c.shake - dt);
    c.port.position.y = c.lift * 3.6 + jitter;
    if (c.shake > 0 && Math.random() < 0.5) IF.fx.dust(c.W.gateX + (Math.random() - 0.5) * 60, IF.GROUND, 1, 'rgba(160,150,130,0.5)');
    c.sig.material.emissiveIntensity = open ? 1.6 + Math.sin(t * 3) * 0.5 : 0.15;
  },

  /* ---------- cinematics ---------- */
  /* Played when the gate opens: a short dolly that swings in towards the rising portcullis, then hands back. */
  openShot(run) {
    if (!IF.r3.ok) return;
    const W = run.world, S = IF.r3.S, X = W.gateX * S, Y = IF.terrain.laneHeight(W.gateX);
    let t = 0;
    IF.r3.cine = { apply(pos, look, dt) {
      t += dt; const k = Math.min(1, t / 2.2), e = k * k * (3 - 2 * k);
      look.set(X - 0.5, Y + 2.4, 0); pos.set(X - 9 + e * 3.5, Y + 3.2 - e * 0.6, 9 - e * 1.5);
      if (t > 2.6) IF.r3.cine = null;
    } };
  },
  /* Played as the knight walks through: the camera follows from behind the shoulder, then the screen fades. */
  startTransition(run) {
    run.transition = { t: 0, dur: 2.6 }; run.world.rightBound = run.world.end + 1200;
    if (!IF.r3.ok) return;
    const W = run.world, S = IF.r3.S;
    IF.r3.cine = { apply(pos, look, dt) { // pull back and rise over the gatehouse as the knight strides through
      const p = run.player, X = p.x * S, Y = IF.r3.wy(p.x, IF.GROUND), k = Math.min(1, run.transition ? run.transition.t / 2.2 : 1), e = k * k * (3 - 2 * k);
      look.set(X + 1.2 + e * 2, Y + 1.4 + e * 0.6, -e * 1.5); pos.set(X - 1.5 + e * 1.5, Y + 2.4 + e * 2.6, 10 - e * 1.5);
    } };
  },
  /* Drives the walk-through; returns true when the reward screen should open. */
  stepTransition(run, dt) {
    const tr = run.transition; tr.t += dt;
    return tr.t >= tr.dur;
  },
  endTransition(run) { run.transition = null; if (IF.r3.ok) { IF.r3.cine = null; IF.r3.snapCam = true; } },
  drawFade(ctx, run) {
    const tr = run.transition; if (!tr) return;
    const a = Math.max(0, Math.min(1, (tr.t - (tr.dur - 1.0)) / 0.9));
    if (a > 0) { ctx.fillStyle = 'rgba(6,4,4,' + a + ')'; ctx.fillRect(0, 0, IF.W, IF.H); }
    // letterbox bars for the cinematic
    const lb = Math.min(1, tr.t / 0.4) * 60; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, IF.W, lb); ctx.fillRect(0, IF.H - lb, IF.W, lb);
  },
};
