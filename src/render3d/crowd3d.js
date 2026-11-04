/* The horde — every zombie (and boss body) rendered through shared InstancedMeshes, one per body part.
 * Poses come from the existing zombie pose code (Enemy._zPose) solved with the same IK as the 2D build. */
'use strict';

IF.crowd = {
  parts: {}, CAP: 96,
  init() {
    const T = IF.r3.T, m = IF.mat, sk = m.skinSet(), cl = m.clothSet();
    const skin = new T.MeshStandardMaterial({ color: '#ffffff', map: sk.map, normalMap: sk.normal, roughness: 0.7 });
    const cloth = new T.MeshStandardMaterial({ color: '#ffffff', normalMap: cl.normal, roughnessMap: cl.rough, roughness: 0.95 });
    const plain = new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, metalness: 0.2 });
    const metal = new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.45, metalness: 0.7, roughnessMap: m.metalSet().rough });
    const bone = m.bone(), blood = m.blood(), glowM = new T.MeshBasicMaterial({ color: '#ffffff' });
    const lathe = (pts, seg = 12) => new T.LatheGeometry(pts.map(([r, y]) => new T.Vector2(r, y)), seg);
    const merge = (gs) => BGU.mergeGeometries(gs.map((g) => (g.index ? g.toNonIndexed() : g)));
    const def = (k, geo, mat, cap, shadow = true) => { const im = new T.InstancedMesh(geo, mat, cap || this.CAP); im.count = 0; im.castShadow = shadow; im.receiveShadow = true; im.frustumCulled = false; im.instanceMatrix.setUsage(T.DynamicDrawUsage); im.setColorAt(0, new T.Color()); IF.r3.world.add(im); this.parts[k] = { im, n: 0 }; };
    def('thigh', lathe([[5, 0], [8, 3], [8, 26], [6.5, 31]]), cloth, this.CAP * 2);
    def('shin', lathe([[6.5, 0], [6.8, 4], [5.5, 28], [4.5, 32]]), cloth, this.CAP * 2);
    def('boot', merge([new T.BoxGeometry(17, 8, 9).translate(4, 4, 0), new T.CylinderGeometry(4.5, 4.5, 9, 8).rotateX(Math.PI / 2).translate(12, 4, 0)]), plain, this.CAP * 2);
    def('upper', lathe([[4, 0], [6.6, 2], [6.2, 22], [5, 25]]), cloth, this.CAP * 2);
    def('fore', lathe([[5.4, 0], [5.6, 4], [4.4, 23], [3.6, 26]]), skin, this.CAP * 2);
    def('hand', merge([new T.SphereGeometry(5, 8, 6).scale(1, 1.1, 0.8), ...[-2.5, 0, 2.5].map((z) => new T.CapsuleGeometry(1.1, 7, 2, 4).rotateZ(-0.5).translate(4, 5, z))]), skin, this.CAP * 2);
    def('torso', lathe([[13, -3], [16, 4], [17.5, 18], [17, 32], [14, 40], [9, 46]], 14), cloth);
    def('belly', new T.SphereGeometry(12, 12, 8, -0.9, 1.8, 0.7, 1.4), skin);
    def('ribs', merge([0, 1, 2, 3].map((i) => new T.TorusGeometry(10, 0.9, 4, 10, 1.6).rotateY(-0.8).translate(0, i * 4.6, 0))), bone);
    def('head', merge([new T.SphereGeometry(12.5, 14, 12).scale(1, 1.12, 0.92), new T.BoxGeometry(5, 3, 18).translate(7, 4, 0), new T.SphereGeometry(3, 6, 4).scale(0.5, 1, 1).translate(-1, 0, 11), new T.SphereGeometry(3, 6, 4).scale(0.5, 1, 1).translate(-1, 0, -11)]), skin);
    def('jaw', new T.BoxGeometry(12, 4.4, 14).translate(5, -2.2, 0), skin);
    def('teeth', merge([-4, -1.5, 1, 3.5].map((z) => new T.BoxGeometry(1.4, 2.2, 1.4).translate(10, 0.8, z))), bone);
    def('eyes', merge([-4, 4].map((z) => new T.SphereGeometry(1.7, 6, 5).translate(10.3, 3, z))), glowM, this.CAP, false);
    def('hair', new T.SphereGeometry(13, 12, 8, 0, Math.PI * 2, 0, 1.2).scale(1.02, 1.1, 0.96), cloth);
    def('helmet', merge([new T.SphereGeometry(14.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new T.CylinderGeometry(16, 16, 1.4, 16).translate(0, 0, 0)]), metal);
    def('visor', new T.SphereGeometry(14, 12, 8, -1.2, 2.4, 1.1, 0.9), new T.MeshStandardMaterial({ color: '#6a8aa0', transparent: true, opacity: 0.45, roughness: 0.1, metalness: 0.4 }), this.CAP, false);
    def('hood', merge([new T.SphereGeometry(15, 12, 10, Math.PI * 0.35, Math.PI * 1.3, 0, 2.2).scale(1.05, 1.15, 1.05), new T.ConeGeometry(9, 12, 8).rotateZ(Math.PI * 0.75).translate(-12, 12, 0)]), cloth);
    def('gasmask', merge([new T.CylinderGeometry(8, 9, 10, 10).rotateZ(Math.PI / 2).translate(8, -2, 0), new T.CylinderGeometry(4.6, 4.6, 6, 10).rotateZ(Math.PI / 2).translate(15, -5, 0)]), plain);
    def('vest', lathe([[18.5, 0], [19, 8], [19, 24], [16, 30]], 14), cloth);
    def('pustule', new T.SphereGeometry(2.8, 6, 5), glowM, this.CAP * 5, false);
    def('tumour', new T.SphereGeometry(8, 10, 8), skin, this.CAP * 3);
    def('stump', merge([new T.CylinderGeometry(6, 6, 2, 10), new T.CylinderGeometry(2.2, 2.2, 3, 6).translate(0, 1.5, 0)]), blood, this.CAP * 3);
    def('wound', new T.SphereGeometry(2.8, 6, 5).scale(1, 0.7, 0.5), blood, this.CAP * 7, false);
    def('crown', merge([new T.CylinderGeometry(14, 14, 3, 12, 1, true), ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => new T.ConeGeometry(2, 10, 4).translate(Math.cos(i * 0.785) * 14, 6, Math.sin(i * 0.785) * 14))]), new T.MeshStandardMaterial({ color: '#2a1f3a', emissive: '#6a2ab0', emissiveIntensity: 0.6, roughness: 0.2, metalness: 0.8 }));
    this.m4 = new T.Matrix4(); this.q = new T.Quaternion(); this.v = new T.Vector3(); this.s = new T.Vector3(); this.c = new T.Color(); this.up = new T.Vector3(0, 1, 0); this.root = new T.Matrix4(); this.tmp = new T.Matrix4();
  },
  begin() { for (const k in this.parts) this.parts[k].n = 0; },
  end() { for (const k in this.parts) { const p = this.parts[k]; p.im.count = p.n; p.im.instanceMatrix.needsUpdate = true; if (p.im.instanceColor) p.im.instanceColor.needsUpdate = true; } },
  /* push one part instance: local transform (pos, quat, scale) composed with the current zombie root matrix */
  push(k, px, py, pz, quat, sx, sy, sz, color) {
    const p = this.parts[k]; if (p.n >= p.im.count && p.n >= this.capOf(p)) return;
    this.v.set(px, py, pz); this.s.set(sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz);
    this.tmp.compose(this.v, quat || this.qid || (this.qid = new IF.r3.T.Quaternion()), this.s); this.m4.multiplyMatrices(this.root, this.tmp);
    p.im.setMatrixAt(p.n, this.m4); p.im.setColorAt(p.n, color || this.white || (this.white = new IF.r3.T.Color('#ffffff'))); p.n++;
  },
  capOf(p) { return p.im.instanceMatrix.count; },
  seg(k, a, b, z, w, color) { // limb segment from 2D point a to b
    this.v.set(b.x - a.x, -(b.y - a.y), 0); const L = this.v.length(); if (L < 0.01) return; this.v.divideScalar(L); this.q.setFromUnitVectors(this.up, this.v);
    this.push(k, a.x, -a.y, z, this.q, w, 1, w, color);
  },
  col(hex, k, flash) { const c = new IF.r3.T.Color(hex); if (k) c.multiplyScalar(k); if (flash) c.lerp(new IF.r3.T.Color(flash), flash === '#ffffff' ? 0.75 : 0.5); return c; },

  /* Add one zombie (or boss body) to the instanced buffers. */
  add(e) {
    const R = IF.r3, T = R.T, L = e.def.look, S = e.scale || 1, sc = R.S * S;
    // root transform: lane position, facing yaw, death fall, rise, stagger wobble
    const yaw = e.facing > 0 ? -0.35 : Math.PI + 0.35;
    const pos = this.v.set(e.x * R.S, R.wy(e.x, e.y), e.z3 || (e.z3 = (((e.seed * 37) % 100) / 100 - 0.6) * 1.1));
    let rise = 0; if (e.state === 'rise') rise = -(1 - Math.min(1, e.stateT / 0.9)) * e.h * R.S * 1.05;
    const rq = new T.Quaternion().setFromEuler(new T.Euler(0, yaw, 0));
    if (e.dead) { const k = IF.util.easeOut(Math.min(1, e.deadT * 2.6)), fb = e.deathDir === e.facing ? -1 : 1; rq.multiply(new T.Quaternion().setFromEuler(new T.Euler(0, 0, fb * k * (e.isLow ? 0 : 1.5)))); if (e.deadT > 3.5) rise = -Math.min(1, (e.deadT - 3.5)) * 0.4; }
    if (e.state === 'stagger') rq.multiply(new T.Quaternion().setFromEuler(new T.Euler(0, 0, 0.12 + Math.sin(e.stateT * 30) * 0.06)));
    this.root.compose(new T.Vector3(pos.x, pos.y + rise, pos.z), rq, new T.Vector3(sc, sc, sc));
    const flash = e.hitFlash > 0 ? '#ffffff' : e.boss && e.vuln > 0 ? '#ffd36b' : null;
    const skin = this.col(L.skin, 0.9 + ((e.seed % 7) / 7) * 0.25, flash), skinD = this.col(L.skinDark, 1, flash), shirt = this.col(L.shirt, 1, flash), pants = this.col(L.pants, 1, flash), boot = this.col(L.military || L.helmet ? '#2a2a22' : '#221d18', 1, flash);
    const lost = e.lost || {}, big = (e.boss || e.def.heavy) ? 1.22 : 1, gaunt = L.gaunt ? 0.78 : 1, wb = big * gaunt;
    if (e.isLow) return this.addCrawler(e, L, { skin, skinD, shirt, pants, boot }, lost);
    const P = e._zPose(), D = { thigh: 31, shin: 32, torso: 44, upper: 25, fore: 26 }, A = IF.art;
    const nx = Math.sin(P.lean), ny = -Math.cos(P.lean), hip = { x: 0, y: P.hipY };
    const shX = nx * (D.torso - 8), shY = P.hipY + ny * (D.torso - 8), shF = { x: shX + 4, y: shY }, shB = { x: shX - 5, y: shY - 1 };
    const kF = A.ik(3, P.hipY, P.footF.x, P.footF.y - 4, D.thigh, D.shin, -1), kB = A.ik(-3, P.hipY, P.footB.x, P.footB.y - 4, D.thigh, D.shin, -1);
    const eF = A.ik(shF.x, shF.y, P.handF.x, P.handF.y, D.upper, D.fore, 1), eB = A.ik(shB.x, shB.y, P.handB.x, P.handB.y, D.upper, D.fore, 1);
    const zF = 9 * wb, zB = -9 * wb;
    // legs
    this.seg('thigh', { x: 3, y: P.hipY }, kF, zF * 0.7, wb, pants); this.seg('shin', kF, { x: kF.ex, y: kF.ey }, zF * 0.7, wb, pants);
    this.seg('thigh', { x: -3, y: P.hipY }, kB, zB * 0.7, wb, this.col(L.pants, 0.75, flash)); this.seg('shin', kB, { x: kB.ex, y: kB.ey }, zB * 0.7, wb, this.col(L.pants, 0.7, flash));
    this.push('boot', P.footF.x - 4, -P.footF.y, zF * 0.7, null, wb, 1, wb, boot); this.push('boot', P.footB.x - 4, -P.footB.y, zB * 0.7, null, wb, 1, wb, boot);
    // torso
    const tq = new T.Quaternion().setFromEuler(new T.Euler(0, 0, -P.lean)), tw = (L.bloated ? 1.4 : 1) * wb;
    this.push('torso', 0, -P.hipY, 0, tq, tw, 1, tw * 0.8, shirt);
    if (L.bloated) this.push('belly', 0 + nx * 18, -P.hipY - ny * 18, 0, tq, 1.6 * wb, 1.5, 1.4, this.col('#9fae5c', 1, flash));
    if (!L.riot && !e.boss && e.seed % 2 === 0) { this.push('belly', nx * 26, -P.hipY - ny * 26, 1, tq, wb, 1, wb, skinD); this.push('ribs', nx * 18 + 4, -P.hipY - ny * 18, 2, tq, wb, 1, wb); }
    if (L.riot || L.helmet || e.def.military) this.push('vest', nx * 8, -P.hipY - ny * 8, 0, tq, tw, 1, tw * 0.82, this.col(L.riot ? '#2b2e33' : '#4a5233', 1, flash));
    if (L.bloated) for (let i = 0; i < 8; i++) { const a = i * 0.8 + e.seed; this.push('pustule', nx * (12 + i * 3) + Math.cos(a) * 18, -P.hipY - ny * (12 + i * 3), Math.sin(a) * 14 + 6, null, 1, 1, 1, this.col('#b8ff40', e.swell ? 1 + e.swell : 1)); }
    if (L.tumours) { this.push('tumour', shX + 6, -shY + 4, 8, null, 1.2 * wb, 1, 1, skin); this.push('tumour', nx * 14 - 8, -P.hipY - ny * 14, -6, null, 0.8 * wb, 1, 1, skin); }
    // arms (or stumps)
    if (lost.armB) this.push('stump', shB.x, -shB.y - 4, zB, null, wb, 1, wb); else { this.seg('upper', shB, eB, zB, wb, L.bare ? skinD : this.col(L.shirt, 0.75, flash)); this.seg('fore', eB, { x: eB.ex, y: eB.ey }, zB, wb, skinD); this.push('hand', eB.ex, -eB.ey, zB, null, wb, 1, wb, skinD); }
    if (lost.armF) this.push('stump', shF.x, -shF.y - 4, zF, null, wb, 1, wb); else { this.seg('upper', shF, eF, zF, wb, L.bare ? skin : shirt); this.seg('fore', eF, { x: eF.ex, y: eF.ey }, zF, wb, skin); this.push('hand', eF.ex, -eF.ey, zF, null, wb, 1, wb, skin); }
    if (lost.legs) { /* legless zombies render as crawlers (isLow) */ }
    // head
    const hx = shX + nx * 16 + 4, hy = shY + ny * 16 + 2;
    if (lost.head) this.push('stump', shX + nx * 6 + 3, -(shY + ny * 6), 0, tq, wb);
    else this.addHead(e, L, P, hx, hy, wb, skin, skinD, flash);
    // wounds
    if (e.wounds) for (const w of e.wounds) this.push('wound', w.x, -w.y, 10 * wb + 2, null, w.r / 3, 1, 1);
    if (e.boss) IF.chars3d.bossExtras(e, P, { shF, shB, eF, hF: { x: eF.ex, y: eF.ey }, hip: { x: 0, y: P.hipY }, nx, ny, torso: D.torso }, this.root);
  },
  addHead(e, L, P, hx, hy, wb, skin, skinD, flash) {
    const T = IF.r3.T, hq = new T.Quaternion().setFromEuler(new T.Euler(0, 0, -((P.head || 0) + Math.sin(e.t * 1.7 + e.seed) * 0.08 + 0.15))), k = wb;
    this.push('head', hx, -hy, 0, hq, k, 1, k, skin);
    const jq = hq.clone().multiply(new T.Quaternion().setFromEuler(new T.Euler(0, 0, -(P.jaw || 0.1) * 0.9)));
    this.push('jaw', hx + 1 * k, -hy - 5 * k, 0, jq, k, 1, k, skinD); this.push('teeth', hx, -hy - 5 * k, 0, hq, k);
    const eye = L.eyes || (e.elite ? '#ff3d4a' : e.boss ? '#ff4a2a' : '#d8d2a8'); this.push('eyes', hx, -hy, 0, hq, k, 1, k, this.col(eye, L.eyes || e.elite ? 2.2 : 0.7));
    if (L.hood) this.push('hood', hx - 1, -hy - 1, 0, hq, k, 1, k, this.col(L.hoodColor || '#1d1a20', 1, flash));
    else if (L.helmet) this.push('helmet', hx, -hy + 3 * k, 0, hq, k, 1, k, this.col('#3e4a2a', 1, flash));
    else if (L.riot) { this.push('helmet', hx, -hy + 2 * k, 0, hq, k * 1.05, 1.05, k * 1.05, this.col('#25282c', 1, flash)); this.push('visor', hx + 2, -hy, 0, hq, k); }
    else if (L.hair && L.hair !== '#000') this.push('hair', hx - 1, -hy + 1, 0, hq, k, 1, k, this.col(L.hair, 1, flash));
    if (L.gasmask) this.push('gasmask', hx, -hy, 0, hq, k, 1, k, this.col('#2a2a24', 1, flash));
    if (L.crown) this.push('crown', hx, -hy + 12 * k, 0, hq, k);
  },
  addCrawler(e, L, C, lost) {
    const t = e.t, ph = e.phase, reach = e.state === 'active' ? 18 : e.state === 'windup' ? -6 : 0, k = 1;
    const hip = { x: -24, y: -14 }, neck = { x: 14, y: -20 };
    this.seg('torso', hip, neck, 0, 1, C.shirt);
    this.seg('thigh', { x: -22, y: -14 }, { x: -44, y: -10 }, 6, 0.9, C.pants); this.push('stump', -46, 10, 6, new IF.r3.T.Quaternion().setFromEuler(new IF.r3.T.Euler(0, 0, Math.PI / 2)), 1.2);
    this.seg('thigh', { x: -22, y: -14 }, { x: -42, y: -8 }, -6, 0.9, C.pants);
    const a1 = Math.sin(ph) * 14, a2 = Math.sin(ph + Math.PI) * 14;
    for (const [a, z, col] of [[a2, -9, C.skinD], [a1, 9, C.skin]]) { const sh = { x: 10, y: -24 }, el = { x: 18 + a * 0.5, y: -30 + Math.abs(a) * 0.3 }, hd = { x: 38 + a + reach, y: -4 }; this.seg('upper', sh, el, z, 1, col); this.seg('fore', el, hd, z, 1, col); this.push('hand', hd.x, -hd.y, z, null, 1, 1, 1, col); }
    if (lost.head) this.push('stump', 24, 26, 0, null, 1); else this.addHead(e, L, { head: 0.3, jaw: e.state === 'active' ? 0.8 : 0.3 }, 28 + reach * 0.6, -28, 1, C.skin, C.skinD, null);
    if (e.wounds) for (const w of e.wounds) this.push('wound', w.x * 0.6 - 4, 18, 9, null, w.r / 3, 1, 1);
  },
};
