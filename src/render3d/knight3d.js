/* 3D Knight rig. Geometry is authored in rig pixels (1px = 1cm) and the root is scaled to metres.
 * Joint positions come from the same IK pose solver as the 2D renderer (IF.rig.solveKnight), so every
 * animation, weapon grip and off-hand placement that was tested in 2D carries over exactly. */
'use strict';

/* ---------- shared rig maths ---------- */
IF.rig = {
  /* Knight joints in 2D local space (x forward, y down), mirroring IF.art.drawKnight. */
  solveKnight(P) {
    const A = IF.art, D = A.DIM, nx = Math.sin(P.lean), ny = -Math.cos(P.lean);
    const hip = { x: P.hipX, y: P.hipY }, neck = { x: P.hipX + nx * D.torso, y: P.hipY + ny * D.torso };
    const shX = P.hipX + nx * (D.torso - 9), shY = P.hipY + ny * (D.torso - 9);
    const shF = { x: shX + 5, y: shY + 1 }, shB = { x: shX - 6, y: shY - 1 };
    const kF = A.ik(P.hipX + 3, P.hipY, P.footF.x, P.footF.y - 5, D.thigh, D.shin, -1), kB = A.ik(P.hipX - 3, P.hipY, P.footB.x, P.footB.y - 5, D.thigh, D.shin, -1);
    const eF = A.ik(shF.x, shF.y, P.handF.x, P.handF.y, D.upper, D.fore, P.elbowF || 1), eB = A.ik(shB.x, shB.y, P.handB.x, P.handB.y, D.upper, D.fore, P.elbowB || 1);
    return { hip, neck, head: { x: neck.x + nx * 9 + 1, y: neck.y + ny * 9 }, shF, shB, eF, eB, hF: { x: eF.ex, y: eF.ey }, hB: { x: eB.ex, y: eB.ey },
      hipF: { x: P.hipX + 3, y: P.hipY }, hipB: { x: P.hipX - 3, y: P.hipY }, kF, kB, aF: { x: kF.ex, y: kF.ey }, aB: { x: kB.ex, y: kB.ey }, fF: P.footF, fB: P.footB, lean: P.lean };
  },
  _v: null,
  /* Orient an object so its local +Y runs from point a to point b (2D px coords -> 3D: y flipped). */
  span(o, a, b, z) {
    const T = IF.r3.T, v = this._v || (this._v = new T.Vector3()), up = this._up || (this._up = new T.Vector3(0, 1, 0));
    o.position.set(a.x, -a.y, z); v.set(b.x - a.x, -(b.y - a.y), 0); const L = v.length(); if (L > 0.001) { v.divideScalar(L); o.quaternion.setFromUnitVectors(up, v); }
    return L;
  },
};

IF.Knight3D = class Knight3D {
  constructor() {
    const T = IF.r3.T; this.T = T;
    this.root = new T.Group(); this.body = new T.Group(); this.root.add(this.body);
    this.lookKey = ''; this.parts = {}; this.weaponKey = '';
    IF.r3.world.add(this.root);
  }
  M(geo, mat, parent, x = 0, y = 0, z = 0) { const m = new this.T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
  lathe(pts, seg = 16) { return new this.T.LatheGeometry(pts.map(([r, y]) => new this.T.Vector2(r, y)), seg); }
  mats(look) {
    const m = IF.mat, pal = (p, fb) => p || fb, L = look;
    const metalOf = (p) => p ? m.metal(p.metal, p.rust ? 0.62 : p.gold ? 0.3 : 0.32, p.id === 'blackened' ? 0.75 : 0.92) : m.metal('#6c6e70', 0.55, 0.85);
    const chest = pal(L.chest, IF.art.MAIL), legs = pal(L.legs, IF.art.MAIL), boots = L.boots || IF.art.LEATHER, hands = L.gauntlets || IF.art.LEATHER, helm = L.helmet || IF.art.MAIL;
    return {
      chest: metalOf(L.chest), legs: metalOf(L.legs), arms: metalOf(L.chest), helm: metalOf(L.helmet),
      boots: L.boots ? metalOf(L.boots) : m.leather('#3e2c1e'), hands: L.gauntlets ? metalOf(L.gauntlets) : m.leather('#4a3424'),
      trim: m.metal((chest.trim && /^#[cdef]/i.test(chest.trim)) ? chest.trim : '#b8964a', 0.3, 1), mail: m.metal('#5a5c5e', 0.7, 0.85), leather: m.leather('#3a2818'), dark: m.basic('#060606', 0.9),
      tabard: IF.kit.heraldryMat(L.tabardOverride || chest.cloth || '#b3a68c', L.crossOverride || chest.cross || '#7e1a18', L.emblem), glow: (L.glow ? m.glow(L.glow, 1.6) : null),
      plume: helm.plume ? m.cloth(helm.plume) : null,
    };
  }
  /* (Re)build meshes when the equipment / heraldry changes. */
  build(look) {
    const T = this.T; while (this.body.children.length) this.body.remove(this.body.children[0]);
    const mt = this.mt = this.mats(look), P = (this.parts = {}), B = this.body;
    const limb = (r0, r1, L, mat, ridge) => { const g = new T.Group(); this.M(this.lathe([[r0 * 0.6, 0], [r0, 2], [r0 * 1.04, L * 0.35], [r1, L - 2], [r1 * 0.7, L]], 14), mat, g); if (ridge) this.M(new T.BoxGeometry(1.4, L * 0.8, 1.4), mat, g, 0, L * 0.5, r0 * 0.92); B.add(g); return g; };
    // legs
    for (const s of ['F', 'B']) {
      P['thigh' + s] = limb(9.5, 7.8, 33, mt.legs, true);
      P['shin' + s] = limb(7.2, 6, 32, mt.legs, true);
      const knee = (P['knee' + s] = new T.Group()); B.add(knee); this.M(new T.SphereGeometry(6.8, 14, 10), mt.legs, knee); const wing = this.M(new T.CylinderGeometry(7.5, 7.5, 1.2, 14, 1, false, 0, Math.PI), mt.legs, knee, 0, 0, 3); wing.rotation.x = Math.PI / 2;
      if (look.legs && look.legs.spikes) this.M(new T.ConeGeometry(2.2, 9, 6), mt.legs, knee, 6, 0, 0).rotation.z = -Math.PI / 2;
      const foot = (P['foot' + s] = new T.Group()); B.add(foot);
      this.M(this.lathe([[5.6, 0], [6.4, 3], [6.2, 8], [5.4, 10]], 14), mt.boots, foot, -1, 1.5, 0).scale.z = 0.95; // ankle cuff
      for (let i = 0; i < 5; i++) { const l = this.M(new T.CapsuleGeometry(4.6 - i * 0.35, 3.2, 4, 10).rotateZ(Math.PI / 2), mt.boots, foot, 2.5 + i * 3.6, 3.9 - i * 0.45, 0); l.scale.set(1, 0.72, 1.18 - i * 0.05); }
      const toe = this.M(new T.ConeGeometry(3.6, 7, 10), mt.boots, foot, 21, 2.2, 0); toe.rotation.z = -Math.PI / 2; toe.scale.set(1, 1, 0.8);
      this.M(new T.CapsuleGeometry(1.0, 1.2, 3, 6), mt.trim, foot, -1, 7, 6.2); // buckle
      this.M(new T.BoxGeometry(26, 1.6, 10), IF.mat.leather('#22180f'), foot, 7, 0.6, 0); // stitched leather sole
    }
    // arms
    for (const s of ['F', 'B']) {
      P['upper' + s] = limb(7.6, 6.6, 25, mt.arms, false); P['fore' + s] = limb(6.6, 5.6, 24, mt.arms, true);
      const el = (P['elbow' + s] = new T.Group()); B.add(el); this.M(new T.SphereGeometry(5.8, 12, 8), mt.arms, el); const fan = this.M(new T.CylinderGeometry(6.6, 6.6, 1, 12, 1, false, 0, Math.PI), mt.arms, el, 0, 0, 3); fan.rotation.x = Math.PI / 2;
      const hand = (P['hand' + s] = new T.Group()); B.add(hand);
      this.M(new T.BoxGeometry(8, 9, 7), mt.hands, hand, 0, 0, 0); for (let i = 0; i < 4; i++) this.M(new T.CapsuleGeometry(1.4, 4, 3, 6), mt.hands, hand, 3.5, 2.5 - i * 1.7, -2.6).rotation.x = Math.PI / 2;
      this.M(new T.CapsuleGeometry(1.6, 3.5, 3, 6), mt.hands, hand, 0, 4, 3).rotation.z = 0.6;
      this.M(this.lathe([[4.8, -6], [6.4, -1], [5.2, 2]], 12), mt.hands, hand, 0, 0, 0).rotation.z = Math.PI / 2;
    }
    // torso
    const torso = (P.torso = new T.Group()); B.add(torso);
    const plate = this.M(this.lathe([[13.5, -2], [15.5, 3], [17.2, 10], [18.8, 18], [19.8, 25], [20.2, 31], [19, 37], [16.4, 42], [12.5, 46], [10.5, 47.5]], 28), mt.chest, torso); plate.scale.z = 0.74;
    const ridge = this.M(this.lathe([[0.9, 4], [1.4, 20], [1.2, 36], [0.6, 44]], 6), mt.chest, torso, 0, 0, 0); ridge.position.x = 19.6 * 0.995; ridge.scale.set(1, 1, 1); // medial ridge
    const plackart = this.M(this.lathe([[16.2, 2], [18.3, 9], [19.2, 16], [17.4, 21], [14, 23]], 24, 0), mt.chest, torso); plackart.scale.set(1.035, 1, 0.77); // lower lame over the belly
    this.M(new T.TorusGeometry(11.5, 1.2, 6, 20), mt.chest, torso, 0, 46.6, 0).rotation.x = Math.PI / 2; // rolled neck edge
    for (const z of [-8, 8]) for (const y of [11, 20]) this.M(new T.SphereGeometry(0.9, 6, 4), mt.trim, torso, 18.4, y, z); // rivets
    for (let i = 0; i < 3; i++) { const f = this.M(this.lathe([[16.3 + i * 0.9, 1], [17.6 + i * 1.3, -4.2]], 22), mt.chest, torso, 0, -1 - i * 3.8, 0); f.scale.z = 0.78; if (i === 2) { const tr = this.M(new T.TorusGeometry(20.2, 0.4, 4, 22), mt.trim, torso, 0, -12.8, 0); tr.rotation.x = Math.PI / 2; tr.scale.y = 0.78; } } // faulds with gilt edges
    this.M(new T.CylinderGeometry(9, 12, 7, 14), mt.helm, torso, 0, 47, 0); // gorget
    // tabard: separate front and back panels of heavy cloth hanging from the shoulders (open at the sides, like the real thing),
    // folds baked into the geometry, a gilt hem, belted at the waist; the skirt panels sway with the stride
    const tabMat = mt.tabard.clone(); tabMat.map = mt.tabard.map.clone(); tabMat.map.repeat.set(1, 1); tabMat.map.offset.set(0, 0); tabMat.map.needsUpdate = true; tabMat.side = T.DoubleSide;
    const panel = (r0, r1, h, y, front, folds, depth) => {
      const g = new T.CylinderGeometry(r0, r1, h, 18, 6, true, (front ? Math.PI / 2 : Math.PI * 1.5) - 0.82, 1.64), pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i), yy = pos.getY(i), a = Math.atan2(x, z), k = (h / 2 - yy) / h, f = Math.sin(a * folds) * depth * (0.3 + k); const rr = Math.hypot(x, z) + f + 0.6; pos.setXYZ(i, Math.sin(a) * rr, yy, Math.cos(a) * rr); }
      g.computeVertexNormals(); const m = this.M(g, tabMat, torso, 0, y, 0); m.scale.z = 0.8; return m;
    };
    panel(21.2, 19, 37, 26, true, 9, 0.35); panel(21.2, 19, 37, 26, false, 9, 0.35);
    const skirt = (P.skirt = new T.Group()); torso.add(skirt); skirt.position.y = 6;
    for (const front of [true, false]) { const sp = panel(19.5, 24, 32, 0, front, 7, 1.3); torso.remove(sp); sp.position.y = -15; skirt.add(sp); }
    if (look.cape) { const capeM = IF.mat.cloth(look.cape.cloth || '#8e1218', 'mantle' + look.cape.cloth); const mantle = this.M(new T.TorusGeometry(13.5, 3.2, 8, 22), capeM, torso, -1, 44.5, 0); mantle.rotation.x = Math.PI / 2; mantle.scale.set(1, 0.82, 1); for (const z of [-10.5, 10.5]) { const c = this.M(new T.CylinderGeometry(2.4, 2.4, 1.2, 12), mt.trim, torso, 11.5, 43, z); c.rotation.z = Math.PI / 2; } } // cloak collar and clasps the cape hangs from
    this.M(new T.TorusGeometry(18.6, 1.6, 6, 24), mt.leather, torso, 0, 6, 0).rotation.x = Math.PI / 2; // belt
    this.M(new T.BoxGeometry(2.5, 6, 6), mt.trim, torso, 19, 6, 0);
    // pauldrons
    for (const s of ['F', 'B']) { const pd = (P['paul' + s] = new T.Group()); B.add(pd); for (let i = 0; i < 3; i++) { const l = this.M(new T.SphereGeometry(13 - i * 1.6, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), i ? mt.chest : mt.chest, pd, 0, -i * 4.2, 0); l.scale.set(1.05, 0.8, 0.95); } this.M(new T.TorusGeometry(12.6, 0.9, 5, 20, Math.PI), mt.trim, pd, 0, 4.5, 0).rotation.x = -Math.PI / 2;
      if (look.chest && look.chest.spikes) for (let i = -1; i <= 1; i++) this.M(new T.ConeGeometry(1.8, 10, 6), mt.chest, pd, i * 6, 10, 0); }
    // head
    const head = (P.head = new T.Group()); B.add(head); this.helmet(head, look.helmStyle, mt, look);
    if (look.halo) { const h = this.M(new T.TorusGeometry(15, 1.3, 8, 32), IF.mat.glow('#ffd66b', 3), head, 0, 30, 0); h.rotation.x = Math.PI / 2; h.castShadow = false; P.halo = h; }
    // shield
    if (look.shield) { const sh = (P.shield = new T.Group()); B.add(sh); const s = new T.Shape(); s.moveTo(-16, 24); s.lineTo(16, 24); s.lineTo(16, -2); s.quadraticCurveTo(14, -22, 0, -32); s.quadraticCurveTo(-14, -22, -16, -2); s.closePath();
      const geo = new T.ExtrudeGeometry(s, { depth: 2, bevelEnabled: true, bevelThickness: 1.2, bevelSize: 1.6, bevelSegments: 2 }); const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + 18) / 36, (uv.getY(i) + 34) / 60);
      const face = IF.kit.heraldryMat(look.shield.cloth, look.shield.cross || '#8a1a1a', look.shield.emblem || look.emblem); const face2 = face.clone(); face2.map = face.map.clone(); face2.map.repeat.set(1, 1); face2.map.needsUpdate = true;
      this.M(geo, [face2, IF.mat.metal(look.shield.metal || '#888', 0.4, 0.9)], sh); }
    // cape (vertices animated each frame)
    if (look.cape) { const geo = new T.PlaneGeometry(40, 104, 6, 12); geo.translate(0, -52, 0); const cape = (P.cape = this.M(geo, IF.kit.heraldryMat(look.cape.cloth, look.cape.cross || '#7e1a18', look.cape.emblem || look.emblem), this.root)); cape.userData.base = Float32Array.from(geo.attributes.position.array); cape.scale.setScalar(1); }
    if (look.glow) { const aura = this.M(new T.SphereGeometry(70, 16, 12), new T.MeshBasicMaterial({ color: look.glow, transparent: true, opacity: 0.06, depthWrite: false, blending: T.AdditiveBlending }), B, 0, -80, 0); aura.castShadow = false; P.aura = aura; }
    P.weapon = new T.Group(); B.add(P.weapon); this.weaponKey = '';
  }
  helmet(head, style, mt, look) {
    const T = this.T, M = (g, m, x, y, z) => this.M(g, m, head, x, y, z), dark = mt.dark, H = mt.helm;
    const slit = (y, len) => M(new T.BoxGeometry(len, 2.6, 16.2), dark, 6, y, 0);
    switch (style) {
      case 'mailcoif': M(new T.SphereGeometry(13.5, 16, 12), mt.mail, 0, 0, 0); M(new T.SphereGeometry(8, 12, 10), IF.mat.skin('#c9a07a'), 7, 0, 0).scale.set(0.6, 1, 0.9); break;
      case 'greathelm': { M(new T.CylinderGeometry(14, 14.5, 30, 20), H, 0, 0, 0); M(new T.CylinderGeometry(14.2, 14.2, 1, 20), H, 0, 15, 0); slit(4, 16); for (let i = 0; i < 6; i++) M(new T.CylinderGeometry(0.7, 0.7, 2, 6), dark, 13.5, -6 - (i % 3) * 2.4, -3 + Math.floor(i / 3) * 6).rotation.z = Math.PI / 2; M(new T.BoxGeometry(3.4, 30, 3.4), mt.trim, 13.8, 0, 0); M(new T.BoxGeometry(3, 2.6, 29), mt.trim, 13.6, 6, 0); break; }
      case 'sallet': { const s = M(this.lathe([[0, 16], [10, 14], [14, 6], [15, -4], [19, -10]], 18), H, 0, 0, 0); s.scale.z = 0.92; slit(2, 16); M(new T.SphereGeometry(13, 14, 8, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.3), H, 3, -4, 0).scale.set(1.1, 1, 0.9); break; }
      case 'armet': { M(new T.SphereGeometry(14.5, 18, 14), H, 0, 2, 0); const v = M(new T.SphereGeometry(13, 14, 10, -0.9, 1.8, 0.4, 2), H, 4, 0, 0); v.scale.set(1.2, 1, 1); slit(3, 18); M(new T.TorusGeometry(14.6, 1, 5, 24, Math.PI), mt.trim, 0, 2, 0).rotation.y = Math.PI / 2; break; }
      case 'spiked': { M(new T.CylinderGeometry(13, 15, 28, 16), H, 0, 0, 0); M(new T.SphereGeometry(13, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), H, 0, 14, 0); slit(3, 18); M(new T.BoxGeometry(5, 3, 16), IF.mat.glow('#8b2b23', 0.4), 12, -1, 0); for (let i = 0; i < 5; i++) { const a = -0.9 + i * 0.45; const c = M(new T.ConeGeometry(2.6, 13, 6), H, Math.sin(a) * 12, 18 + Math.cos(a) * 6, 0); c.rotation.z = -a; } break; }
      case 'crowned': { M(new T.CylinderGeometry(14, 14.5, 30, 20), H, 0, 0, 0); slit(4, 16); const gold = IF.mat.metal('#e2b23c', 0.25, 1); M(new T.CylinderGeometry(15, 15, 4, 20, 1, true), gold, 0, 15, 0); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; M(new T.ConeGeometry(2.2, 8, 4), gold, Math.cos(a) * 15, 21, Math.sin(a) * 15); } M(new T.SphereGeometry(2.2, 8, 6), IF.mat.glow('#c0141c', 1.2), 15.6, 15, 0); break; }
      case 'horned': { M(new T.SphereGeometry(14.5, 18, 14), H, 0, 1, 0); M(new T.BoxGeometry(16, 3, 17), mt.glow || IF.mat.glow('#a36bff', 2.2), 6, 0, 0); for (const s of [-1, 1]) { const pts = [new T.Vector3(0, 6, s * 10), new T.Vector3(-6, 16, s * 18), new T.Vector3(-14, 30, s * 16), new T.Vector3(-12, 42, s * 10)]; M(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 12, 2.6, 8), H, 0, 0, 0); } break; }
      case 'halo': { M(new T.SphereGeometry(14.5, 18, 14), H, 0, 1, 0); M(new T.BoxGeometry(16, 3, 17), IF.mat.glow('#ffe9a8', 2.5), 6, 0, 0); M(new T.TorusGeometry(14.7, 1, 5, 24), mt.trim, 0, 1, 0).rotation.x = Math.PI / 2; break; }
      // ---- companion head styles: faces visible ----
      case 'open': case 'combat': case 'hood': case 'medic': case 'hardhat': {
        const skinC = look.skin || '#c9a07a', skin = IF.mat.skin(skinC), hairM = IF.mat.cloth(look.hair || '#3a2416', 'hair' + (look.hair || ''));
        const face = M(new T.SphereGeometry(11, 16, 12), skin, 2, -1, 0); face.scale.set(1, 1.18, 0.92);
        for (const z of [-4, 4]) M(new T.SphereGeometry(1.3, 6, 5), IF.mat.basic('#1a1410', 0.4), 11.5, 1, z);
        M(new T.BoxGeometry(3, 1.2, 7), IF.mat.basic('#5a2a24', 0.7), 11, -7, 0); // mouth line
        M(new T.ConeGeometry(1.8, 4, 6), skin, 12.5, -2, 0).rotation.z = -Math.PI / 2; // nose
        if (style === 'open') { // long hair under a gilt circlet, braid down the back
          const hair = M(new T.SphereGeometry(12, 16, 12, Math.PI * 0.55, Math.PI * 1.1), hairM, 0, 2, 0); hair.scale.set(1.05, 1.15, 1.02);
          M(new T.TorusGeometry(11.6, 1.1, 5, 24), IF.mat.metal('#d8b25a', 0.3, 1), 1, 6, 0).rotation.x = Math.PI / 2;
          const pts = []; for (let i = 0; i < 6; i++) pts.push(new T.Vector3(-10 - i * 1.2, 0 - i * 7, Math.sin(i) * 1.5));
          M(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 12, 3, 6), hairM, 0, 0, 0);
        } else if (style === 'hood') { const hd = M(new T.SphereGeometry(14, 16, 12, Math.PI * 0.6, Math.PI * 1.25), IF.mat.cloth(look.hoodC || '#3e4430'), -1, 2, 0); hd.scale.set(1.05, 1.2, 1.05); M(new T.BoxGeometry(6, 3, 16), IF.mat.cloth(look.hoodC || '#3e4430'), 8, -10, 0); }
        else { // brimmed steel helmets
          const col = style === 'medic' ? '#c8c2b4' : style === 'hardhat' ? '#b8862a' : '#4a5236', hm = IF.mat.metal(col, 0.7, 0.3, 'hh' + col);
          const dome = M(new T.SphereGeometry(14, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), hm, 0, 2, 0); dome.scale.set(1.08, 0.95, 1.05);
          M(new T.CylinderGeometry(17, 17, 1.2, 20), hm, 0, 2, 0);
          if (style === 'medic') for (const z of [-15.1, 15.1]) { M(new T.BoxGeometry(6, 1.8, 0.4), IF.mat.basic('#b0141a'), 0, 8, z); M(new T.BoxGeometry(1.8, 6, 0.4), IF.mat.basic('#b0141a'), 0, 8, z); }
          if (style === 'hardhat') { const gg = M(new T.TorusGeometry(3, 1, 5, 12), IF.mat.basic('#2a2a2a'), 10, 5, -4); gg.rotation.y = Math.PI / 2; const g2 = M(new T.TorusGeometry(3, 1, 5, 12), IF.mat.basic('#2a2a2a'), 10, 5, 4); g2.rotation.y = Math.PI / 2; }
          M(new T.TorusGeometry(11, 0.4, 4, 16, Math.PI), IF.mat.leather('#3a2a1a'), 1, -4, 0).rotation.y = Math.PI / 2; // chin strap
        }
        break;
      }
      default: M(new T.SphereGeometry(14, 16, 12), H, 0, 0, 0);
    }
    if (mt.plume) { const pts = [new T.Vector3(-2, 15, 0), new T.Vector3(-8, 30, 0), new T.Vector3(-24, 30, 0), new T.Vector3(-36, 14, 0)]; const pl = this.M(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 16, 4, 8), mt.plume, head); pl.scale.z = 0.7; this.parts.plume = pl; }
  }
  attachWeapon(wi) {
    const key = wi ? wi.def.id + ':' + wi.item.rarity : ''; if (key === this.weaponKey) return; this.weaponKey = key;
    const W = this.parts.weapon; while (W.children.length) W.remove(W.children[0]);
    if (wi) W.add(IF.wep3d.build(wi.def, IF.RARITY[wi.item.rarity].index));
  }

  /* Pose the rig from a 2D pose (P) at lane position (x, y) facing f. */
  update(P, x, y, f, look, opts) {
    const key = JSON.stringify([look.helmStyle, look.chest && look.chest.metal, look.legs && look.legs.metal, look.boots && look.boots.metal, look.gauntlets && look.gauntlets.metal, look.helmet && look.helmet.metal, look.shield && look.shield.cloth, look.cape && look.cape.cloth, look.tabardOverride, look.crossOverride, look.emblem, look.helmet && look.helmet.plume, !!look.shield, !!look.cape, look.glow, look.halo]);
    if (key !== this.lookKey) { this.lookKey = key; this.build(look); }
    const R = IF.r3, S = R.S * IF.KNIGHT_SCALE, J = IF.rig.solveKnight(P), Pt = this.parts, span = (o, a, b, z) => IF.rig.span(o, a, b, z);
    this.root.position.set(x * R.S, R.wy(x, y), opts.z || 0.25);
    this.root.scale.setScalar(S);
    this.root.rotation.set(0, f > 0 ? -0.42 : Math.PI + 0.42, opts.rollZ || 0);
    this.body.rotation.set(0, 0, 0); this.body.position.set(0, 0, 0);
    if (opts.roll) { this.body.position.y = 38; this.body.rotation.z = -opts.roll; this.body.position.x = 0; this.body.translateY(-38); }
    const zF = 10, zB = -10;
    span(Pt.thighF, J.hipF, J.kF, zF * 0.6); span(Pt.shinF, J.kF, J.aF, zF * 0.6); span(Pt.thighB, J.hipB, J.kB, zB * 0.6); span(Pt.shinB, J.kB, J.aB, zB * 0.6);
    Pt.kneeF.position.set(J.kF.x, -J.kF.y, zF * 0.6); Pt.kneeB.position.set(J.kB.x, -J.kB.y, zB * 0.6);
    Pt.footF.position.set(J.fF.x - 4, -J.fF.y + 1, zF * 0.6); Pt.footB.position.set(J.fB.x - 4, -J.fB.y + 1, zB * 0.6);
    span(Pt.upperF, J.shF, J.eF, zF + 6); span(Pt.foreF, J.eF, J.hF, zF + 6); span(Pt.upperB, J.shB, J.eB, zB - 6); span(Pt.foreB, J.eB, J.hB, zB - 6);
    Pt.elbowF.position.set(J.eF.x, -J.eF.y, zF + 6); Pt.elbowB.position.set(J.eB.x, -J.eB.y, zB - 6);
    Pt.handF.position.set(J.hF.x, -J.hF.y, zF + 6); Pt.handB.position.set(J.hB.x, -J.hB.y, zB - 6);
    Pt.handF.rotation.z = -(P.wAngle || 0); Pt.handB.rotation.z = -(P.wAngle || 0) * (P.twoHand ? 1 : 0.3);
    Pt.torso.position.set(J.hip.x, -J.hip.y, 0); Pt.torso.rotation.set(0, 0, -J.lean);
    if (Pt.skirt) Pt.skirt.rotation.z = -(P.tabardSway || 0) * 0.15;
    Pt.paulF.position.set(J.shF.x, -J.shF.y + 2, zF + 4); Pt.paulF.rotation.z = -J.lean - 0.2; Pt.paulB.position.set(J.shB.x, -J.shB.y + 2, zB - 4); Pt.paulB.rotation.z = -J.lean + 0.2;
    Pt.head.position.set(J.head.x, -J.head.y, 0); Pt.head.rotation.set(0, 0, -(P.headTilt || 0) - J.lean * 0.3);
    if (Pt.halo) Pt.halo.position.y = 30 + Math.sin(R.clock * 2) * 1.5;
    // weapon in the leading hand, rotated by the pose's weapon angle
    Pt.weapon.position.set(J.hF.x, -J.hF.y, zF + 6); Pt.weapon.rotation.set(0, 0, -(P.wAngle || 0));
    Pt.weapon.visible = !!P.drawWeapon; if (P._weapon) this.attachWeapon(P._weapon);
    const w0 = Pt.weapon.children[0]; if (w0 && w0.userData.spinner) w0.children.forEach((c) => { if (c.userData.spinIdx !== undefined) { const a = c.userData.spinIdx / 6 * Math.PI * 2 + (opts.spin || 0); c.position.y = -6 + Math.cos(a) * 3.2; c.position.z = Math.sin(a) * 3.2; } });
    // shield: on the back, or raised on the off arm while blocking
    if (Pt.shield) { if (P.shieldMode === 'front') { Pt.shield.position.set(J.hB.x + 6, -J.hB.y + 2, zB + 2); Pt.shield.rotation.set(0, Math.PI / 2 - 0.55, 0.05); Pt.shield.scale.setScalar(1.05); } else { const nx = Math.sin(J.lean), ny = Math.cos(J.lean); Pt.shield.position.set(J.hip.x + nx * 24 - 16, -J.hip.y + ny * 24, -6); Pt.shield.rotation.set(0, -Math.PI / 2 + 0.7, J.lean * 0.6 + 0.15); Pt.shield.scale.setScalar(0.88); } }
    // cape: anchored behind the shoulders, swinging with motion
    if (Pt.cape) { const cape = Pt.cape, pos = cape.geometry.attributes.position, base = cape.userData.base, t = R.clock, w = P.capeWave || 0;
      const ax = (J.shB.x + J.shF.x) / 2 - 6, ay = -(J.shB.y + J.shF.y) / 2 + 4;
      cape.position.set(ax * S / 1, 0, 0); // placed in root space below
      cape.position.set(0, 0, 0); cape.scale.setScalar(1); cape.rotation.set(0, 0, 0); this.root.add(cape);
      for (let i = 0; i < pos.count; i++) { const bx = base[i * 3], by = base[i * 3 + 1], k = -by / 104; const wrap = (1 - k) * (1 - k); pos.setXYZ(i, ax - 13 - k * k * (16 + w * 30) - k * 5 + Math.abs(bx) * 0.32 * wrap + Math.sin(t * 4 + k * 5 + bx * 0.12) * 3.2 * k, ay + by * (1 - Math.abs(w) * 0.12), bx * (0.62 + 0.38 * k)); }
      pos.needsUpdate = true; cape.geometry.computeVertexNormals(); }
    if (Pt.aura) Pt.aura.material.opacity = 0.05 + Math.sin(R.clock * 3) * 0.02;
    // hit flash / iframe flicker via material swap
    this.flash(opts.flash);
    this.root.visible = opts.visible !== false;
  }
  flash(col) {
    const want = col || null; if (want === this._flashCol) return; this._flashCol = want;
    const fm = want ? IF.mat.get('flash' + want, () => new this.T.MeshStandardMaterial({ color: want, emissive: want, emissiveIntensity: 0.6, roughness: 0.5 })) : null;
    this.root.traverse((o) => { if (!o.isMesh) return; if (fm) { if (!o.userData.orig) o.userData.orig = o.material; o.material = fm; } else if (o.userData.orig) { o.material = o.userData.orig; o.userData.orig = null; } });
  }
  dispose() { IF.r3.world.remove(this.root); }
};
