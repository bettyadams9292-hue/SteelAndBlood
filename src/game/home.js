/* The Crusader's Home — a walkable medieval residence reached from the main menu.
 * Ground floor (Entrance Hall, Sitting Room, Kitchen, Bathroom), a Basement below and an Attic above,
 * linked by staircases (stand on the stairs and press Up / Down). Display slots on walls and floors take
 * trophies, furniture and curiosities earned in the field: bosses, zones, achievements and hidden secrets.
 * Slots snap items into place, so nothing floats, overlaps or clips through walls. Everything is saved. */
'use strict';

IF.HOME_MODE = { id: 'home', name: 'Crusader Home', home: true, bossEvery: 1e9, enemyMult: 0, rewardMult: 0, regen: true };

/* ---------- catalogue of displayable things ---------- */
IF.HOME_ITEMS = [
  // furniture (floor)
  { id: 'oak_table', name: 'Oak Trestle Table', kind: 'floor', cat: 'Furniture', src: 'Starter furnishing' },
  { id: 'oak_chair', name: 'Carved Oak Chair', kind: 'floor', cat: 'Furniture', src: 'Starter furnishing' },
  { id: 'bookshelf', name: 'Bookshelf', kind: 'floor', cat: 'Furniture', src: 'Starter furnishing' },
  { id: 'iron_chest', name: 'Iron-Bound Chest', kind: 'floor', cat: 'Furniture', src: 'Starter furnishing' },
  { id: 'candelabra', name: 'Iron Candelabra', kind: 'floor', cat: 'Furniture', src: 'Starter furnishing' },
  { id: 'cot', name: 'Soldier\'s Cot', kind: 'floor', cat: 'Furniture', src: 'Starter furnishing' },
  { id: 'cabinet', name: 'Apothecary Cabinet', kind: 'floor', cat: 'Furniture', src: 'Reach section 5' },
  { id: 'four_poster', name: 'Four-Poster Bed', kind: 'floor', cat: 'Furniture', src: 'Reach section 15' },
  { id: 'throne', name: 'Crusader Throne', kind: 'floor', cat: 'Furniture', src: 'Defeat 3 bosses' },
  { id: 'weapon_rack', name: 'Weapon Rack', kind: 'floor', cat: 'Displays', src: 'Own 10 weapons' },
  { id: 'armour_stand', name: 'Armour Stand', kind: 'floor', cat: 'Displays', src: 'Complete a 6-piece armour set' },
  { id: 'knight_statue', name: 'Statue of the Order', kind: 'floor', cat: 'Displays', src: 'Unlock 10 achievements' },
  // wall
  { id: 'tapestry', name: 'Order Tapestry', kind: 'wall', cat: 'Furniture', src: 'Starter furnishing' },
  { id: 'painting', name: 'Portrait of the Founder', kind: 'wall', cat: 'Furniture', src: 'Reach section 10' },
  { id: 'shield_display', name: 'Crossed Shields', kind: 'wall', cat: 'Displays', src: 'Reach level 5' },
  { id: 'banner_gold', name: 'Gilded War Banner', kind: 'wall', cat: 'Displays', src: 'Reach section 30' },
  { id: 'plaque_10', name: 'Plaque: Ten Gates', kind: 'wall', cat: 'Achievements', src: 'Reach section 10' },
  { id: 'plaque_25', name: 'Plaque: Twenty-Five Gates', kind: 'wall', cat: 'Achievements', src: 'Reach section 25' },
  { id: 'plaque_50', name: 'Plaque: Fifty Gates', kind: 'wall', cat: 'Achievements', src: 'Reach section 50' },
  { id: 'plaque_ach', name: 'Roll of Honour', kind: 'wall', cat: 'Achievements', src: 'Unlock 5 achievements' },
];
// boss trophies are generated from the boss list: a mounted head and the boss's weapon on a plinth
IF.BOSSES && IF.BOSSES.forEach((b) => IF.HOME_ITEMS.push({ id: 'head_' + b.id, name: b.name + ' (Mounted Head)', kind: 'wall', cat: 'Boss Trophies', src: 'Defeat ' + b.name, boss: b.id }, { id: 'relic_' + b.id, name: b.name + '\'s Weapon', kind: 'floor', cat: 'Boss Trophies', src: 'Defeat ' + b.name, boss: b.id, relic: true }));
IF.HOME_ITEM = Object.fromEntries(IF.HOME_ITEMS.map((i) => [i.id, i]));
IF.HOME_STARTER = ['oak_table', 'oak_chair', 'bookshelf', 'iron_chest', 'candelabra', 'cot', 'tapestry'];

/* ---------- house layout (x in lane px; each floor is one strip of rooms) ---------- */
IF.HOME_FLOORS = {
  // walkable span [lb, rb]; each staircase's footprint lies outside it except at its two ends, so nobody walks through steps or over an opening
  ground: { name: 'Ground Floor', start: 0, end: 3720, lb: 950, rb: 3365, door: 1150, rooms: [
    { id: 'hall', name: 'Entrance Hall', x0: 0, x1: 1300, wall: '#5e5446', fixed: ['door'], slots: [{ id: 'h1', k: 'wall', x: 1010 }, { id: 'h2', k: 'floor', x: 1010 }, { id: 'h3', k: 'wall', x: 1240 }] },
    { id: 'sitting', name: 'Sitting Room', x0: 1300, x1: 2300, wall: '#6a4a3a', win: 1570, fixed: ['fireplace'], slots: [{ id: 's1', k: 'wall', x: 1400 }, { id: 's2', k: 'floor', x: 1560 }, { id: 's3', k: 'floor', x: 2000 }, { id: 's4', k: 'wall', x: 2100 }, { id: 's5', k: 'floor', x: 2210 }] },
    { id: 'kitchen', name: 'Kitchen', x0: 2300, x1: 3100, wall: '#5a5242', win: 2790, fixed: ['hearth'], slots: [{ id: 'k1', k: 'floor', x: 2780 }, { id: 'k2', k: 'wall', x: 2960 }, { id: 'k3', k: 'floor', x: 3030 }] },
    { id: 'bath', name: 'Bathroom', x0: 3100, x1: 3720, wall: '#4e5a58', win: 3500, fixed: ['tub'], slots: [{ id: 'b1', k: 'wall', x: 3330 }, { id: 'b2', k: 'floor', x: 3330 }] },
  ] },
  basement: { name: 'Basement', start: 3340, end: 6220, lb: 3690, rb: 6190, rooms: [
    { id: 'cellar', name: 'Wine Cellar', x0: 3340, x1: 4800, wall: '#3e3a34', fixed: ['casks'], slots: [{ id: 'c1', k: 'floor', x: 4150 }, { id: 'c2', k: 'wall', x: 4350 }, { id: 'c3', k: 'floor', x: 4600 }] },
    { id: 'vault', name: 'Trophy Vault', x0: 4800, x1: 6220, wall: '#34302c', fixed: ['torches'], slots: [{ id: 'v1', k: 'wall', x: 4950 }, { id: 'v2', k: 'floor', x: 5120 }, { id: 'v3', k: 'wall', x: 5320 }, { id: 'v4', k: 'floor', x: 5520 }, { id: 'v5', k: 'wall', x: 5720 }, { id: 'v6', k: 'floor', x: 5950 }] },
  ] },
  attic: { name: 'Attic', start: -2020, end: 1000, lb: -1990, rb: 640, rooms: [
    { id: 'curio', name: 'Cabinet of Curiosities', x0: -2020, x1: -900, wall: '#4a3a2a', win: -1460, fixed: [], slots: [{ id: 'q1', k: 'floor', x: -1080 }, { id: 'q2', k: 'wall', x: -1250 }, { id: 'q3', k: 'floor', x: -1450 }, { id: 'q4', k: 'wall', x: -1650 }, { id: 'q5', k: 'floor', x: -1850 }] },
    { id: 'loft', name: 'Attic Loft', x0: -900, x1: 1000, wall: '#5a4630', fixed: ['rafters'], slots: [{ id: 'a1', k: 'floor', x: 480 }, { id: 'a2', k: 'wall', x: 300 }, { id: 'a3', k: 'floor', x: 80 }, { id: 'a4', k: 'wall', x: -250 }, { id: 'a5', k: 'floor', x: -560 }] },
  ] },
};
IF.HOME_STAIR_RISE = 360;
/* Each flight lists, per floor, where it meets that floor (`at`) and where it meets the other floor (`to`), in lane px. */
IF.HOME_FLIGHTS = {
  ground: { down: { at: 3360, to: 3680, next: 'basement' }, up: { at: 960, to: 640, next: 'attic' } },
  basement: { up: { at: 3680, to: 3360, next: 'ground' } },
  attic: { down: { at: 640, to: 960, next: 'ground' } },
};

IF.home = {
  data() {
    const d = IF.save.data;
    if (!d.home || typeof d.home !== 'object') d.home = { owned: {}, slots: {}, seen: {} };
    for (const id of IF.HOME_STARTER) if (!d.home.owned[id]) d.home.owned[id] = true;
    if (!d.home.init) { d.home.init = true; Object.assign(d.home.slots, { h1: 'tapestry', s2: 'oak_table', s3: 'oak_chair', s5: 'bookshelf', k1: 'iron_chest', c1: 'candelabra', a1: 'cot' }); }
    return d.home;
  },
  /* grant an unlockable; announces it once */
  unlock(id, quiet) {
    const h = this.data(); if (h.owned[id] || !IF.HOME_ITEM[id] && !IF.EGG_ITEM[id]) return false;
    h.owned[id] = true; IF.save.markDirty && IF.save.markDirty();
    if (!quiet) { const it = IF.HOME_ITEM[id] || IF.EGG_ITEM[id]; IF.ui.toast('NEW FOR YOUR HOME', 'ach', it.name + ' — display it in your Crusader Home'); }
    return true;
  },
  /* progression hooks: called after saves, boss kills, achievements */
  checkUnlocks() {
    const d = IF.save.data, s = d.stats, nAch = Object.keys(d.achievements || {}).length;
    const rules = [['cabinet', s.bestSection >= 5], ['four_poster', s.bestSection >= 15], ['throne', s.bosses >= 3], ['weapon_rack', d.weapons.length >= 10], ['armour_stand', s.fullSet > 0],
      ['knight_statue', nAch >= 10], ['painting', s.bestSection >= 10], ['shield_display', d.level >= 5], ['banner_gold', s.bestSection >= 30], ['plaque_10', s.bestSection >= 10], ['plaque_25', s.bestSection >= 25], ['plaque_50', s.bestSection >= 50], ['plaque_ach', nAch >= 5]];
    for (const [id, ok] of rules) if (ok) this.unlock(id);
  },
  onBoss(def) { this.unlock('head_' + def.id); this.unlock('relic_' + def.id, true); },

  /* ---------- entering / leaving ---------- */
  enter() {
    if (!IF.r3.ok) { IF.ui.toast('The Crusader Home needs a 3D-capable browser (WebGL2).', 'bad'); return; }
    this.data(); this.checkUnlocks();
    IF.game.newRun('home');
  },
  makeWorld(run, floor) {
    const F = IF.HOME_FLOORS[floor], end = F.end;
    return { home: true, floor, section: 0, biome: { id: 'home', name: F.name, music: 0, light: '#ffb070', props: [], indoor: true, sky: ['#120c08', '#1e140e', '#2a1c12'], ground: '#2a1c12', fog: 'rgba(0,0,0,0)', weather: 'none' }, isBoss: false, start: F.start, end, leftBound: F.lb, rightBound: F.rb, gateX: 1e9, gateOpen: true,
      props: [], platforms: [], triggers: [], pickups: [], fg: [], gateWave: false, bossSpawned: true };
  },
  roomAt(W, x) { return IF.HOME_FLOORS[W.floor].rooms.find((r) => x >= r.x0 && x < r.x1) || IF.HOME_FLOORS[W.floor].rooms[0]; },
  slotNear(W, x) { let best = null, bd = 70; for (const r of IF.HOME_FLOORS[W.floor].rooms) for (const s of r.slots) { const d = Math.abs(s.x - x); if (d < bd) { bd = d; best = s; } } return best; },
  stairsNear(W, x) { const F = IF.HOME_FLIGHTS[W.floor]; for (const k in F) if (Math.abs(x - F[k].at) < 70) return k; return null; },

  update(run, dt) {
    const pl = run.player, I = IF.input, W = run.world;
    const slot0 = this.slotNear(W, pl.x), useKey = I.pressed('special') || I.pressed('tactical') || I.pressed('attack');
    if (!this.climb && useKey) { if (W.floor === 'ground' && Math.abs(pl.x - IF.HOME_FLOORS.ground.door) < 60) { IF.game.quitToMenu(); return; } if (slot0) { IF.ui.homeSlot(slot0); return; } }
    if (!this.climb) pl.update(dt);
    for (const a of run.allies) a.update && a.update(dt);
    if (this.climb) { this.stepClimb(run, dt); }
    else { const st = this.stairsNear(W, pl.x); if (st && I.pressed(st === 'up' ? 'up' : 'down')) this.startClimb(run, st); }
    // camera
    const look = pl.facing * 120, target = Math.max(W.leftBound - 60, Math.min(W.end - IF.VIEW_W + 60, pl.x - IF.VIEW_W * 0.45 + look));
    run.camX += (target - run.camX) * Math.min(1, dt * 4);
  },
  /* Walking the stairs: approach the foot/head, climb or descend the flight step by step (the knight's y follows
   * the treads), hand over to the next floor half-way through the opening, then finish the flight there. */
  startClimb(run, dir) {
    const f = IF.HOME_FLIGHTS[run.world.floor][dir];
    this.climb = { dir, at: f.at, to: f.to, next: f.next, phase: 'approach', switched: false };
  },
  stepClimb(run, dt) {
    const c = this.climb, pl = run.player, RISE = IF.HOME_STAIR_RISE, sp = 140, sgn = c.dir === 'up' ? -1 : 1;
    pl.onGround = true; pl.state = 'normal'; pl.crouch = pl.blocking = false; pl.show = 'melee';
    const walk = (tx) => { const d = tx - pl.x, s = Math.sign(d); if (s) pl.facing = s; const step = Math.min(Math.abs(d), sp * dt); pl.x += s * step; pl.vx = s * sp; pl.phase += step * Math.PI / (2 * 20 * IF.KNIGHT_SCALE); return Math.abs(d) < 1; };
    const k = () => IF.util.clamp((pl.x - c.at) / (c.to - c.at), 0, 1);
    const stepped = (q) => { const n = 12, i = Math.min(n - 1, Math.floor(q * n)); return (i + Math.min(1, (q * n - i) * 2.5)) / n; }; // feet land on each tread
    if (c.phase === 'approach') { pl.y = IF.GROUND; if (walk(c.at)) c.phase = 'flight'; return; }
    walk(c.to); const q = k(), h = stepped(q);
    if (c.phase === 'flight') {
      pl.y = IF.GROUND + sgn * RISE * h;
      if (q > 0.6) { this.switchFloor(run, c.next, pl.x, true); c.phase = 'arrive'; } // through the opening: carry on from the other floor
    }
    if (c.phase === 'arrive') { pl.y = IF.GROUND - sgn * RISE * (1 - h); if (q >= 1) { pl.y = IF.GROUND; pl.vx = 0; this.climb = null; } }
  },
  switchFloor(run, floor, x, keep) {
    run.world = this.makeWorld(run, floor); run.player.x = x; if (!keep) { run.player.vx = 0; run.camX = x - IF.VIEW_W * 0.45; IF.r3.snapCam = true; }
    for (const a of run.allies) a.x = x - 60;
    run.banner = { top: 'CRUSADER HOME', main: IF.HOME_FLOORS[floor].name }; run.bannerT = 1.6;
  },
  drawHud(ctx, run, F) {
    const pl = run.player, W = run.world, room = this.roomAt(W, pl.x);
    ctx.save(); ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(14,15,17,0.75)'; ctx.fillRect(20, 18, 360, 54); ctx.strokeStyle = 'rgba(201,162,74,0.6)'; ctx.strokeRect(20.5, 18.5, 359, 53);
    ctx.fillStyle = '#c9a24a'; ctx.font = F(11); ctx.fillText('CRUSADER HOME · ' + IF.HOME_FLOORS[W.floor].name.toUpperCase(), 34, 38);
    ctx.fillStyle = '#ece4d2'; ctx.font = F(20); ctx.fillText(room.name, 34, 62);
    const h = this.data(), owned = Object.keys(h.owned).length, total = IF.HOME_ITEMS.length + IF.EASTER_EGGS.length;
    ctx.textAlign = 'right'; ctx.fillStyle = '#c9a24a'; ctx.font = F(12); ctx.fillText('COLLECTION ' + owned + ' / ' + total, IF.W - 24, 36);
    // context prompt
    let msg = null; const st = this.stairsNear(W, pl.x), slot = this.slotNear(W, pl.x), keyE = IF.input.lastDevice === 'gamepad' ? 'Y' : IF.input.lastDevice === 'touch' ? '✠' : 'E';
    if (W.floor === 'ground' && Math.abs(pl.x - IF.HOME_FLOORS.ground.door) < 60) msg = keyE + ' · Leave the house';
    else if (st && !this.climb) { const nx = IF.HOME_FLIGHTS[W.floor][st].next; msg = (st === 'up' ? '▲ Up · climb the stairs to the ' : '▼ Down · go down to the ') + IF.HOME_FLOORS[nx].name; }
    else if (slot) { const it = h.slots[slot.id]; msg = keyE + ' · ' + (it ? 'Change ' + this.itemName(it) : 'Place something here (' + (slot.k === 'wall' ? 'wall mount' : 'floor space') + ')'); }
    if (msg) { ctx.textAlign = 'center'; ctx.font = F(15); const w = ctx.measureText(msg).width + 40; ctx.fillStyle = 'rgba(14,15,17,0.82)'; ctx.fillRect(IF.W / 2 - w / 2, IF.H - 92, w, 34); ctx.strokeStyle = '#c9a24a'; ctx.strokeRect(IF.W / 2 - w / 2 + 0.5, IF.H - 91.5, w - 1, 33); ctx.fillStyle = '#ece4d2'; ctx.fillText(msg, IF.W / 2, IF.H - 69); }
    ctx.restore();
  },
  itemName(id) { const it = IF.HOME_ITEM[id] || IF.EGG_ITEM[id]; return it ? it.name : id; },
  /* place `id` into slot (moving it if it was displayed elsewhere); null clears the slot */
  place(slotId, id) {
    const h = this.data();
    if (id) for (const k in h.slots) if (h.slots[k] === id) delete h.slots[k];
    if (id) h.slots[slotId] = id; else delete h.slots[slotId];
    IF.save.write(); this.dirty = true;
  },
  fits(id, kind) { const it = IF.HOME_ITEM[id] || IF.EGG_ITEM[id]; return it && it.kind === kind; },
};

/* ---------- 3D: rooms, fixed furnishings and display items ---------- */
IF.home3d = {
  /* ---------- materials (procedural, world-scaled) ---------- */
  plankMat() { return IF.mat.get('home_plank', () => { const T = IF.r3.T, tex = IF.mat.canvasTex(512, (c, n) => {
    const rows = 8, h = n / rows; for (let r = 0; r < rows; r++) { let x = -((r * 97) % 180); while (x < n) { const len = 180 + ((r * 31 + x) % 140); const l = 28 + ((r * 13 + x * 7) % 14); c.fillStyle = 'hsl(' + (24 + (r % 3)) + ',' + (38 + (x % 9)) + '%,' + l + '%)'; c.fillRect(x, r * h, len, h); for (let gl = 0; gl < 6; gl++) { c.strokeStyle = 'rgba(30,16,8,' + (0.08 + gl * 0.02) + ')'; c.beginPath(); const yy = r * h + 6 + gl * h / 7; c.moveTo(x, yy); c.bezierCurveTo(x + len / 3, yy + 3, x + len * 0.6, yy - 3, x + len, yy + 1); c.stroke(); } c.fillStyle = 'rgba(10,6,4,0.85)'; c.fillRect(x, r * h, 2, h); c.fillStyle = 'rgba(20,20,22,0.8)'; for (const ny of [8, h - 8]) { c.beginPath(); c.arc(x + 8, r * h + ny, 2, 0, 7); c.fill(); } x += len; } c.fillStyle = 'rgba(8,4,2,0.9)'; c.fillRect(0, r * h, n, 2); }
  }); const m = new T.MeshStandardMaterial({ map: tex, roughness: 0.78, metalness: 0 }); m.userData.worldUV = 3.2; return m; }); },
  plasterMat(col) { return IF.mat.get('home_plaster' + col, () => { const T = IF.r3.T, f = IF.mat.noiseField(256, 6, 4, 91), tex = IF.mat.fieldToTex(256, f, (v, i) => { const y = (i / 256) | 0, stain = Math.max(0, (y / 256 - 0.75)) * 0.6; const k = 0.86 + v * 0.22 - stain; return [255 * k, 246 * k, 228 * k]; }); const m = new T.MeshStandardMaterial({ color: col, map: tex, roughness: 0.95 }); m.userData.worldUV = 2.6; return m; }); },
  rugMat() { return IF.mat.get('home_rug', () => { const T = IF.r3.T, tex = IF.mat.canvasTex(256, (c, n) => { c.fillStyle = '#6a1016'; c.fillRect(0, 0, n, n); c.strokeStyle = '#c9a24a'; c.lineWidth = 10; c.strokeRect(14, 14, n - 28, n - 28); c.lineWidth = 3; c.strokeRect(30, 30, n - 60, n - 60); c.fillStyle = '#2a0a0c'; for (let i = 0; i < 4; i++) { c.save(); c.translate(n / 2, n / 2); c.rotate(i * Math.PI / 2); c.beginPath(); c.moveTo(0, -70); c.lineTo(22, -30); c.lineTo(0, 0); c.lineTo(-22, -30); c.closePath(); c.fill(); c.restore(); } c.fillStyle = '#c9a24a'; c.beginPath(); c.arc(n / 2, n / 2, 14, 0, 7); c.fill(); for (let i = 0; i < 2000; i++) { c.fillStyle = 'rgba(0,0,0,' + Math.random() * 0.15 + ')'; c.fillRect(Math.random() * n, Math.random() * n, 2, 2); } }); return new T.MeshStandardMaterial({ map: tex, roughness: 1 }); }); },

  build(run, W) {
    const T = IF.r3.T, K = IF.kit, M = K.mats(), S = IF.r3.S, group = new T.Group(), F = IF.HOME_FLOORS[W.floor];
    const chunk = { world: W, group, props: [], wavers: [], flames: [], lights: [], smokers: [], homeKey: JSON.stringify(IF.home.data().slots) };
    const X0 = W.start * S, X1 = W.end * S, L = X1 - X0, H = IF.HOME_STAIR_RISE / 100, back = -2.6, beam = M.timberDark, base = W.floor === 'basement';
    const floorMat = base ? M.stoneDark : this.plankMat();
    // stairwell openings: a descending flight cuts the floor, a rising one cuts the ceiling
    const fl = IF.HOME_FLIGHTS[W.floor], holesF = [], holesC = [];
    for (const k in fl) { const f = fl[k], a = Math.min(f.at, f.to) * S - 0.1, b = Math.max(f.at, f.to) * S + 0.1; (k === 'down' ? holesF : holesC).push([a, b]); }
    const slab = (y, th, mat, holes, zc, depth) => { // full-depth boards between openings; behind an opening only a back strip remains (the opening runs out to the cut-away front so the stairs stay visible)
      let x = X0 - 1; const cuts = holes.slice().sort((p, q) => p[0] - q[0]); const zb = zc - depth / 2, cut = -0.62;
      for (const [a, b] of cuts.concat([[X1 + 1, X1 + 1]])) { if (a > x) { const m = K.box(a - x, th, depth, mat, (a + x) / 2, y, zc, group); m.castShadow = y > 1; } x = Math.max(x, b); }
      for (const [a, b] of cuts) K.box(b - a, th, cut - zb, mat, (a + b) / 2, y, (zb + cut) / 2, group).castShadow = y > 1; };
    // floor (with the stairwell cut out along the lane; the back strip stays solid) and its joists seen at the cut
    slab(-0.1, 0.2, floorMat, holesF, 0.4, 6.5);
    for (const [a, b] of holesF) { K.box(b - a, 0.3, 0.12, beam, (a + b) / 2, -0.15, -0.62, group); for (const x of [a, b]) K.box(0.12, 0.3, 4.3, beam, x, -0.15, 1.5, group); K.box(b - a + 0.2, 3.6, 0.2, M.stoneDark, (a + b) / 2, -1.9, -0.75, group); } // trimmer joists and the shaft's back wall
    for (const r of F.rooms) {
      const a = r.x0 * S, b = r.x1 * S, w = b - a, cx = (a + b) / 2;
      const wallMat = base ? M.stone : this.plasterMat(r.wall);
      K.box(w, H, 0.3, wallMat, cx, H / 2, back, group);
      if (!base) {
        K.box(w, 0.16, 0.08, beam, cx, 0.08, back + 0.19, group); // skirting
        K.box(w, 0.08, 0.06, beam, cx, 1.05, back + 0.18, group); // dado rail
        for (let x = a + 0.6; x < b - 0.2; x += 1.6) K.box(0.18, H, 0.12, beam, x, H / 2, back + 0.2, group); // studs
        K.box(w, 0.18, 0.12, beam, cx, H - 0.5, back + 0.2, group); // wall plate
      } else for (let x = a + 1.2; x < b; x += 2.4) { const arch = K.box(0.5, H, 0.4, M.stoneDark, x, H / 2, back + 0.2, group); }
      if (r.x0 > 0) { // partition with a proper doorway: posts, lintel and a threshold
        const pm = base ? M.stone : this.plasterMat(r.wall);
        // only the back half of the partition is built: the house is shown as a cut-away, so nothing stands between the camera and the knight
        K.box(0.3, H, 0.9, pm, a, H / 2, back + 0.6, group); K.box(0.3, 0.8, 1.3, pm, a, H - 0.4, back + 1.7, group);
        K.box(0.36, H - 0.8, 0.18, beam, a, (H - 0.8) / 2, back + 1.05, group);
        K.box(0.4, 0.22, 1.5, beam, a, H - 0.9, back + 1.7, group); K.box(0.5, 0.04, 2.6, M.stoneDark, a, 0.02, back + 2.35, group);
      }
      if (r.win) this.window(r.win * S, H, back, group, chunk, W.floor === 'attic');
      this.fixed(r, a, b, H, back, group, chunk, W);
    }
    // ceiling: joists and boards with the opening for a rising flight
    slab(H + 0.12, 0.24, W.floor === 'attic' ? M.roofTile : M.timberDark, holesC, 0.4, 6.5);
    for (let x = X0 + 0.5; x < X1; x += 1.3) { if (holesC.some(([a, b]) => x > a - 0.1 && x < b + 0.1)) continue; K.box(0.2, 0.28, 6, beam, x, H - 0.14, 0.4, group).castShadow = false; }
    if (W.floor === 'attic') for (let x = X0 + 0.9; x < X1; x += 1.8) { const r1 = K.box(0.2, 0.2, 4.2, beam, x, H - 0.9, -0.9, group); r1.rotation.x = -0.55; r1.castShadow = false; }
    // facade above the cut-away, foundation below, and a dark void behind the back wall
    const fac = K.box(L + 4, 7, 0.3, M.timberDark, (X0 + X1) / 2, H + 3.6, 3.75, group); fac.castShadow = false;
    K.box(L + 4, 3.2, 0.3, M.stoneDark, (X0 + X1) / 2, -1.7, 3.75, group).castShadow = false;
    K.box(L + 4, 14, 0.3, IF.mat.basic('#0a0705', 1), (X0 + X1) / 2, 4, back - 0.4, group).castShadow = false;
    K.box(L + 4, 0.3, 6.5, IF.mat.basic('#050302', 1), (X0 + X1) / 2, -3.7, 0.4, group).castShadow = false; // floor of the stairwell shaft
    K.box(0.4, H, 6.5, M.stone, X0 - 0.2, H / 2, 0.4, group); K.box(0.4, H, 6.5, M.stone, X1 + 0.2, H / 2, 0.4, group);
    // staircases (both halves of every flight that touches this floor)
    for (const k in fl) this.flight(fl[k].at * S, fl[k].to * S, k === 'up' ? H : -H, group);
    // display spots
    for (const r of F.rooms) for (const sl of r.slots) {
      const id = IF.home.data().slots[sl.id], x = sl.x * S;
      if (!id) { if (sl.k === 'wall') { const hook = K.box(0.06, 0.12, 0.06, M.iron, x, 2.45, back + 0.2, group); K.box(0.4, 0.05, 0.03, IF.mat.wood('#4a3020'), x, 2.0, back + 0.17, group); } else { const rug = K.box(1.2, 0.015, 1.0, this.rugMat(), x, 0.01, -1.4, group); rug.castShadow = false; rug.material.transparent = false; } }
      else { const o = this.item(id); if (o) { if (sl.k === 'wall') o.position.set(x, 2.0, back + 0.22); else { o.position.set(x, 0, -1.4); const rug = K.box(1.4, 0.012, 1.15, this.rugMat(), x, 0.008, -1.4, group); rug.castShadow = false; } group.add(o); o.traverse((m) => { if (m.userData.flame) { m.userData.fid = Math.random() * 10; chunk.flames.push(m); } }); if (o.userData.light) chunk.lights.push({ x: sl.x, y: IF.GROUND - o.userData.light, z: -1, i: 3, c: '#ffb060', r: 7 }); } }
    }
    // hanging iron lanterns
    for (let x = W.start + 260; x < W.end; x += 520) this.lantern(x * S, H, group, chunk, x);
    IF.r3.world.add(group);
    return chunk;
  },
  /* A straight timber flight from (xa, floor) to (xb, floor + dy): treads and risers, two notched stringers,
   * newel posts and a handrail on the far side so the knight stays in view on the near side. */
  flight(xa, xb, dy, g) {
    const K = IF.kit, M = K.mats(), T = IF.r3.T, n = 12, tread = IF.mat.wood('#6a4628'), dark = M.timberDark, run = xb - xa, dir = Math.sign(run), stepL = Math.abs(run) / n, rise = dy / n;
    for (let i = 0; i < n; i++) {
      const x = xa + dir * stepL * (i + 0.5), top = dy > 0 ? rise * (i + 1) : rise * (i + 1);
      K.box(stepL + 0.04, 0.06, 1.35, tread, x, top - 0.03, 0.25, g); // tread with nosing
      K.box(0.04, Math.abs(rise), 1.3, dark, xa + dir * stepL * (dy > 0 ? i : i + 1), top - rise / 2 - (dy > 0 ? 0 : 0), 0.25, g); // riser
    }
    const len = Math.hypot(run, dy), ang = Math.atan2(dy, run), mx = (xa + xb) / 2, my = dy / 2;
    for (const z of [-0.47, 0.95]) { const s = K.box(len + 0.2, 0.3, 0.08, dark, mx, my - 0.12, z, g); s.rotation.z = ang; } // stringers
    const rail = K.box(len + 0.3, 0.07, 0.09, IF.mat.wood('#4a2e18'), mx, my + 0.92, -0.47, g); rail.rotation.z = ang;
    for (let i = 0; i <= n; i += 2) { const x = xa + dir * stepL * i, y = rise * i; K.box(0.045, 0.9, 0.045, dark, x, y + 0.45, -0.47, g); }
    for (const [x, y] of [[xa, 0], [xb, dy]]) { K.box(0.14, 1.15, 0.14, dark, x, y + 0.57, -0.47, g); K.mesh(new T.SphereGeometry(0.09, 8, 6), IF.mat.wood('#4a2e18'), x, y + 1.2, -0.47, g); }
  },
  lantern(x, H, g, chunk, laneX) {
    const K = IF.kit, M = K.mats(), T = IF.r3.T;
    K.cyl(0.008, 0.008, 0.45, M.iron, x, H - 0.25, 0.2, g, 4);
    K.box(0.22, 0.03, 0.22, M.iron, x, H - 0.5, 0.2, g); K.box(0.2, 0.03, 0.2, M.iron, x, H - 0.85, 0.2, g);
    const roof = K.mesh(new T.ConeGeometry(0.17, 0.14, 4), M.iron, x, H - 0.44, 0.2, g); roof.rotation.y = Math.PI / 4;
    for (const [dx, dz] of [[-0.09, -0.09], [0.09, -0.09], [-0.09, 0.09], [0.09, 0.09]]) K.box(0.02, 0.34, 0.02, M.iron, x + dx, H - 0.67, 0.2 + dz, g);
    const glass = K.box(0.16, 0.3, 0.16, IF.mat.get('lanternglass', () => new T.MeshStandardMaterial({ color: '#ffd090', emissive: '#ff9a40', emissiveIntensity: 0.9, transparent: true, opacity: 0.55, roughness: 0.2 })), x, H - 0.67, 0.2, g); glass.castShadow = false;
    this.fireSmall(x, H - 0.74, 0.2, g); g.children[g.children.length - 1].scale.setScalar(0.3); chunk.flames.push(g.children[g.children.length - 1]);
    chunk.lights.push({ x: laneX, y: IF.GROUND - (H - 0.7) * 100, z: 0.4, i: 3.4, c: '#ffb468', r: 9 });
  },
  window(x, H, back, g, chunk, small) {
    const K = IF.kit, M = K.mats(), T = IF.r3.T, w = small ? 0.8 : 1.2, h = small ? 0.8 : 1.4, y = small ? 2.0 : 2.05;
    const pane = K.box(w, h, 0.04, IF.mat.get('moonpane', () => new T.MeshStandardMaterial({ color: '#1a2438', emissive: '#3a4a7a', emissiveIntensity: 0.7, roughness: 0.15, metalness: 0.3 })), x, y, back + 0.16, g); pane.castShadow = false;
    for (let i = 1; i < 4; i++) K.box(0.015, h, 0.05, M.iron, x - w / 2 + i * w / 4, y, back + 0.19, g); for (let i = 1; i < 4; i++) K.box(w, 0.015, 0.05, M.iron, x, y - h / 2 + i * h / 4, back + 0.19, g); // leading
    K.box(w + 0.24, 0.1, 0.24, M.stoneDark, x, y - h / 2 - 0.05, back + 0.2, g); K.box(w + 0.2, 0.14, 0.14, M.timberDark, x, y + h / 2 + 0.07, back + 0.2, g); // sill & lintel
    for (const s of [-1, 1]) { const c = K.box(0.32, h + 0.3, 0.04, IF.mat.cloth('#5a1418', 'curtain'), x + s * (w / 2 + 0.12), y - 0.1, back + 0.25, g); c.castShadow = false; }
    K.cyl(0.015, 0.015, w + 0.9, M.iron, x, y + h / 2 + 0.2, back + 0.27, g, 4).rotation.z = Math.PI / 2;
  },
  fixed(r, a, b, H, back, g, chunk, W) {
    const K = IF.kit, M = K.mats(), T = IF.r3.T, S = IF.r3.S;
    for (const f of r.fixed) {
      if (f === 'door') { const dx = IF.HOME_FLOORS.ground.door * S; K.box(1.3, 2.4, 0.2, IF.mat.wood('#4a2e18'), dx, 1.2, back + 0.2, g); for (const y of [0.5, 1.9]) K.box(1.3, 0.1, 0.24, M.iron, dx, y, back + 0.22, g); K.mesh(new T.TorusGeometry(0.08, 0.02, 4, 10), M.iron, dx + 0.45, 1.2, back + 0.33, g); K.box(1.7, 0.3, 0.3, M.stone, dx, 2.55, back + 0.2, g); for (const s2 of [-1, 1]) K.box(0.2, 2.5, 0.3, M.stone, dx + s2 * 0.75, 1.25, back + 0.2, g); K.box(1.6, 0.05, 1.0, IF.mat.cloth('#3a2a1a', 'doormat'), dx, 0.01, -1.6, g).castShadow = false; }
      if (f === 'fireplace') { const x = (a + b) / 2; K.box(2.2, 1.6, 0.8, M.stone, x, 0.8, back + 0.4, g); K.box(1.3, 0.9, 0.82, IF.mat.basic('#0a0605', 1), x, 0.5, back + 0.42, g); K.box(2.6, 0.18, 1, M.timberDark, x, 1.65, back + 0.45, g); K.box(1.6, H - 1.7, 0.6, M.stone, x, 1.7 + (H - 1.7) / 2, back + 0.3, g); this.fire(x, 0.15, back + 0.6, 1.3, g, chunk, x / S, 70); for (let i = 0; i < 3; i++) K.cyl(0.07, 0.07, 0.8, IF.mat.wood('#3a2416'), x - 0.3 + i * 0.3, 0.12, back + 0.62, g, 6).rotation.z = Math.PI / 2; }
      if (f === 'hearth') { const x = a + 1.4; K.box(2, 1.0, 1.2, M.stone, x, 0.5, back + 0.7, g); K.cyl(0.35, 0.3, 0.45, M.iron, x, 1.25, back + 0.7, g, 12); this.fire(x, 0.95, back + 0.7, 0.6, g, chunk, x / S, 110); K.box(1.6, 0.06, 0.5, IF.mat.wood('#6a4a2a'), a + 3.0, 0.9, back + 0.45, g); for (let i = 0; i < 4; i++) K.cyl(0.08, 0.06, 0.18, IF.mat.basic(['#8a6a4a', '#5a7a5a', '#7a4a3a', '#aaa'][i], 0.6), a + 2.5 + i * 0.3, 1.02, back + 0.4, g, 8); for (let i = 0; i < 5; i++) { const pan = K.cyl(0.14, 0.12, 0.04, M.iron, a + 2.4 + i * 0.32, 2.1, back + 0.22, g, 10); pan.rotation.x = Math.PI / 2; } }
      if (f === 'tub') { const x = a + 0.95; const tub = K.cyl(0.6, 0.5, 0.6, IF.mat.wood('#6a4a2a'), x, 0.3, back + 0.9, g, 18); tub.scale.z = 0.7; for (const y of [0.12, 0.48]) K.mesh(new T.TorusGeometry(0.58, 0.03, 4, 18), M.iron, x, y, back + 0.9, g).rotation.x = Math.PI / 2; const w = K.cyl(0.55, 0.55, 0.02, IF.mat.get('water', () => new T.MeshStandardMaterial({ color: '#2a4a52', roughness: 0.05, metalness: 0.3 })), x, 0.5, back + 0.9, g, 18); w.scale.z = 0.7; K.box(0.6, 0.8, 0.04, IF.mat.metal('#b8b0a0', 0.15, 1), a + 1.95, 1.8, back + 0.18, g); K.box(0.5, 0.75, 0.4, IF.mat.wood('#5a3a22'), a + 1.95, 0.375, back + 0.35, g); K.cyl(0.2, 0.16, 0.12, IF.mat.basic('#d8d0c0', 0.3), a + 1.95, 0.8, back + 0.35, g, 12); }
      if (f === 'casks') for (let i = 0; i < 5; i++) { const c = K.cyl(0.42, 0.42, 0.9, IF.mat.wood('#5a3a20'), a + 4.4 + i * 0.95, 0.42, back + 0.5, g, 14); c.rotation.x = Math.PI / 2; for (const z of [-0.3, 0.3]) K.mesh(new T.TorusGeometry(0.43, 0.025, 4, 16), M.iron, a + 4.4 + i * 0.95, 0.42, back + 0.5 + z, g); }
      if (f === 'torches') for (let x = a + 0.8; x < b; x += 2.2) { K.box(0.06, 0.4, 0.12, M.iron, x, 2.5, back + 0.2, g); this.fire(x, 2.7, back + 0.25, 0.35, g, chunk, x / S, 270); }
      if (f === 'rafters') for (let x = a + 0.5; x < b; x += 1.8) { const r1 = K.box(0.18, 2.6, 0.2, M.timberDark, x, 2.2, back + 0.5, g); r1.rotation.x = 0.5; }
      if (f === 'window') { const x = (a + b) / 2; K.box(1.0, 1.1, 0.08, IF.mat.glow('#3a4a7a', 0.7), x, 2.0, back + 0.17, g); K.box(1.1, 0.06, 0.12, M.timberDark, x, 2.0, back + 0.2, g); K.box(0.06, 1.2, 0.12, M.timberDark, x, 2.0, back + 0.2, g); }
    }
  },
  fire(x, y, z, s, g, chunk, laneX, lightY) {
    const T = IF.r3.T, mk = (c, o) => IF.mat.get('flame' + c, () => new T.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: T.AdditiveBlending, depthWrite: false }));
    const geo = IF.kit._flameGeo || new T.ConeGeometry(0.16, 0.5, 8);
    [['#c8340a', 0.42, 1.15], ['#e8701a', 0.38, 0.82], ['#ffc860', 0.45, 0.45]].forEach(([c, o, k]) => { const f = new T.Mesh(geo, mk(c, o)); f.position.set(x, y, z); f.scale.setScalar(k * s); f.userData.flame = true; f.userData.fid = Math.random() * 10; f.castShadow = false; g.add(f); chunk.flames.push(f); });
    chunk.lights.push({ x: laneX, y: IF.GROUND - lightY, z: z + 0.6, i: 4 * s + 1, c: '#ff9a40', r: 7 });
  },
  /* one builder per displayable (metres; floor items stand at y=0, wall items centred on the mount) */
  item(id) {
    const T = IF.r3.T, K = IF.kit, M = K.mats(), g = new T.Group(), it = IF.HOME_ITEM[id] || IF.EGG_ITEM[id]; if (!it) return null;
    const wood = IF.mat.wood('#6a4a2a'), dark = M.timberDark, gold = IF.mat.metal('#c9a24a', 0.3, 1), red = IF.mat.cloth('#8e1218');
    const box = (w, h, d, m, x, y, z) => K.box(w, h, d, m, x, y, z, g), cyl = (r1, r2, h, m, x, y, z, seg) => K.cyl(r1, r2, h, m, x, y, z, g, seg);
    if (it.boss) {
      const B = IF.BOSSES.find((b) => b.id === it.boss), L = (B && B.look) || {}, skin = IF.mat.skin(L.skin || '#6a7a5a'), metal = IF.mat.metal(L.shirt || '#3a3a40', 0.5, 0.8);
      if (!it.relic) { // mounted head on a carved shield-shaped board
        const board = K.mesh(new T.CylinderGeometry(0.42, 0.42, 0.06, 6), wood, 0, 0, 0, g); board.rotation.x = Math.PI / 2;
        const head = K.mesh(new T.SphereGeometry(0.2, 14, 12), skin, 0, 0.02, 0.2, g); head.scale.set(1, 1.15, 0.95);
        K.mesh(new T.BoxGeometry(0.22, 0.08, 0.14), skin, 0, -0.14, 0.24, g);
        for (const s of [-1, 1]) { K.mesh(new T.SphereGeometry(0.035, 8, 6), IF.mat.glow(L.eyes || '#ff3a20', 2), s * 0.07, 0.05, 0.38, g); }
        if (L.crown) for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; K.mesh(new T.ConeGeometry(0.04, 0.14, 4), gold, Math.cos(a) * 0.16, 0.24, 0.2 + Math.sin(a) * 0.16, g); }
        else if (L.helmet) { const h = K.mesh(new T.SphereGeometry(0.22, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), metal, 0, 0.06, 0.2, g); h.scale.y = 0.8; }
        else if (L.hood) { const hd = K.mesh(new T.SphereGeometry(0.24, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), IF.mat.cloth(L.hoodColor || '#191312'), 0, 0.05, 0.18, g); }
        else if (L.gasmask) { K.mesh(new T.CylinderGeometry(0.06, 0.08, 0.12, 8), IF.mat.basic('#2a2a28'), 0, -0.08, 0.38, g).rotation.x = Math.PI / 2; }
        else for (const s of [-1, 1]) { const horn = K.mesh(new T.ConeGeometry(0.05, 0.28, 6), IF.mat.bone(), s * 0.18, 0.2, 0.18, g); horn.rotation.z = -s * 0.6; }
        K.box(0.5, 0.08, 0.04, gold, 0, -0.38, 0.05, g);
      } else { // the boss's weapon laid on a stone plinth
        box(0.7, 0.6, 0.5, M.stone, 0, 0.3, 0); box(0.78, 0.06, 0.58, M.stoneDark, 0, 0.62, 0);
        const W = { axe: 'great_axe', sword: 'steel_longsword', greatsword: 'greatsword', rifle: 'k47' }[L.weapon] || 'greatsword', w = IF.wep3d.build(IF.WEAPON[W], 4); w.scale.setScalar(0.011); w.rotation.z = 1.35; w.position.set(0, 0.7, 0); g.add(w);
      }
      return g;
    }
    switch (id) {
      case 'oak_table': box(1.4, 0.08, 0.7, wood, 0, 0.74, 0); for (const sx of [-0.6, 0.6]) box(0.1, 0.7, 0.55, dark, sx, 0.36, 0); box(1.2, 0.06, 0.06, dark, 0, 0.2, 0); cyl(0.05, 0.04, 0.12, gold, -0.3, 0.84, 0, 8); box(0.3, 0.04, 0.22, IF.mat.cloth('#d8ccb0'), 0.3, 0.8, 0); break;
      case 'oak_chair': box(0.5, 0.06, 0.48, wood, 0, 0.46, 0); for (const sx of [-0.2, 0.2]) for (const sz of [-0.2, 0.2]) box(0.05, 0.46, 0.05, dark, sx, 0.23, sz); box(0.5, 0.7, 0.06, wood, 0, 0.82, -0.22); box(0.36, 0.08, 0.07, red, 0, 0.92, -0.2); break;
      case 'bookshelf': box(1.1, 2.0, 0.4, dark, 0, 1.0, 0); for (let r = 0; r < 4; r++) { box(1.0, 0.04, 0.36, wood, 0, 0.3 + r * 0.45, 0.02); for (let i = 0; i < 8; i++) box(0.08, 0.3 + (i % 3) * 0.04, 0.26, IF.mat.cloth(['#6a1a14', '#2a3a5a', '#4a3a1a', '#2a4a2a'][(i + r) % 4]), -0.42 + i * 0.11, 0.48 + r * 0.45, 0.04); } break;
      case 'iron_chest': box(0.9, 0.5, 0.5, wood, 0, 0.25, 0); const lid = cyl(0.25, 0.25, 0.9, wood, 0, 0.5, 0, 12); lid.rotation.z = Math.PI / 2; lid.scale.set(1, 1, 1); for (const x of [-0.3, 0.3]) box(0.06, 0.78, 0.52, M.iron, x, 0.4, 0); box(0.1, 0.12, 0.04, gold, 0, 0.42, 0.26); break;
      case 'candelabra': cyl(0.03, 0.03, 1.4, M.iron, 0, 0.7, 0, 6); cyl(0.2, 0.25, 0.06, M.iron, 0, 0.03, 0, 10); for (const sx of [-0.25, 0, 0.25]) { cyl(0.035, 0.035, 0.2, IF.mat.basic('#efe6cc'), sx, 1.5, 0, 8); IF.home3d.fireSmall(sx, 1.62, 0, g); } box(0.6, 0.03, 0.03, M.iron, 0, 1.4, 0); g.userData.light = 150; break;
      case 'cot': box(1.9, 0.1, 0.8, wood, 0, 0.4, 0); for (const sx of [-0.85, 0.85]) for (const sz of [-0.33, 0.33]) box(0.06, 0.4, 0.06, dark, sx, 0.2, sz); box(1.8, 0.12, 0.72, IF.mat.cloth('#8a7a5a'), 0, 0.5, 0); box(0.4, 0.1, 0.5, IF.mat.cloth('#d8ccb0'), -0.65, 0.6, 0); break;
      case 'cabinet': box(0.9, 1.6, 0.45, dark, 0, 0.8, 0); for (let i = 0; i < 12; i++) box(0.18, 0.14, 0.02, wood, -0.3 + (i % 4) * 0.2, 0.3 + Math.floor(i / 4) * 0.4, 0.23); for (let i = 0; i < 4; i++) cyl(0.05, 0.05, 0.14, IF.mat.get('glassg', () => new T.MeshStandardMaterial({ color: ['#4a8a5a'][0], roughness: 0.1, transparent: true, opacity: 0.7 })), -0.3 + i * 0.2, 1.68, 0, 8); break;
      case 'four_poster': box(2.0, 0.4, 1.4, wood, 0, 0.35, 0); box(1.9, 0.18, 1.3, IF.mat.cloth('#6a1a20'), 0, 0.62, 0); for (const sx of [-0.95, 0.95]) for (const sz of [-0.65, 0.65]) cyl(0.05, 0.05, 2.2, dark, sx, 1.1, sz, 8); box(2.0, 0.08, 1.4, dark, 0, 2.2, 0); box(2.0, 0.6, 0.02, IF.mat.cloth('#8e1218'), 0, 1.9, -0.7); box(0.5, 0.12, 1.0, IF.mat.cloth('#e6e0d2'), -0.7, 0.76, 0); break;
      case 'throne': box(0.8, 0.5, 0.7, M.stone, 0, 0.25, 0); box(0.7, 0.1, 0.6, red, 0, 0.55, 0); box(0.8, 1.6, 0.14, wood, 0, 1.2, -0.3); for (const sx of [-0.38, 0.38]) box(0.1, 0.3, 0.6, wood, sx, 0.75, 0); for (const sx of [-0.38, 0, 0.38]) K.mesh(new T.ConeGeometry(0.06, 0.2, 6), gold, sx, 2.1, -0.3, g); K.emblemMesh && K.emblemMesh(g, 0, 1.5, -0.22, 0.4, '#c9a24a'); break;
      case 'weapon_rack': box(1.4, 0.1, 0.4, dark, 0, 0.05, 0); box(1.4, 0.08, 0.1, dark, 0, 1.4, -0.12); for (const sx of [-0.68, 0.68]) box(0.08, 1.5, 0.1, dark, sx, 0.75, -0.12); ['war_hammer', 'halberd', 'claymore', 'spear'].forEach((w, i) => { const m = IF.wep3d.build(IF.WEAPON[w], 2); m.scale.setScalar(0.0105); m.rotation.z = Math.PI / 2; m.position.set(-0.45 + i * 0.3, 0.1, -0.02); g.add(m); }); break;
      case 'armour_stand': { cyl(0.25, 0.3, 0.08, wood, 0, 0.04, 0, 12); cyl(0.03, 0.03, 1.4, dark, 0, 0.75, 0, 6); const k = new IF.Knight3D(); IF.r3.world.remove(k.root); const look = IF.art.knightLook(IF.prog.equippedItems()); const P = { hipX: 0, hipY: -70, lean: 0, footF: { x: 6, y: 0 }, footB: { x: -6, y: 0 }, handF: { x: 8, y: -40 }, handB: { x: -8, y: -40 }, shieldMode: 'back', capeWave: 0, tabardSway: 0, headTilt: 0, wAngle: 1.4, elbowF: 1, elbowB: 1 }; k.update(P, 0, IF.GROUND, 1, look, { z: 0, visible: true }); k.root.position.set(0, 0, 0); g.add(k.root); break; }
      case 'knight_statue': box(0.8, 0.5, 0.8, M.stone, 0, 0.25, 0); const st = IF.mat.metal('#8a8478', 0.6, 0.2, 'statue'); cyl(0.2, 0.24, 0.9, st, 0, 0.95, 0, 10); K.mesh(new T.SphereGeometry(0.16, 12, 10), st, 0, 1.55, 0, g); box(0.06, 1.2, 0.06, st, 0.25, 1.1, 0.1); box(0.3, 0.05, 0.05, st, 0.25, 1.4, 0.1); K.mesh(new T.CylinderGeometry(0.28, 0.28, 0.05, 3), st, -0.28, 1.05, 0.1, g).rotation.x = Math.PI / 2; break;
      case 'tapestry': { const c = K.mesh(new T.PlaneGeometry(0.8, 1.3, 2, 6), K.heraldryMat(), 0, -0.05, 0.02, g); box(0.95, 0.05, 0.05, gold, 0, 0.63, 0.04); break; }
      case 'painting': box(0.8, 0.95, 0.05, gold, 0, 0, 0); box(0.66, 0.8, 0.06, IF.mat.get('portrait', () => new T.MeshStandardMaterial({ map: IF.home3d.portraitTex(), roughness: 0.8 })), 0, 0, 0.01); break;
      case 'shield_display': for (const s of [-1, 1]) { const sh = K.mesh(new T.CylinderGeometry(0.32, 0.32, 0.05, 3), s < 0 ? IF.mat.cloth('#8e1218') : IF.mat.cloth('#e6e0d2'), s * 0.18, 0, 0.03, g); sh.rotation.x = Math.PI / 2; sh.rotation.y = s * 0.3; } for (const s of [-1, 1]) { const sw = box(0.04, 1.0, 0.03, M.steel, 0, 0, 0.08); sw.rotation.z = s * 0.7; } break;
      case 'banner_gold': { box(0.9, 0.05, 0.05, gold, 0, 0.6, 0.04); const c = K.mesh(new T.PlaneGeometry(0.75, 1.2, 2, 6), K.heraldryMat('#8e1218', '#e8c878'), 0, 0, 0.03, g); break; }
      case 'plaque_10': case 'plaque_25': case 'plaque_50': case 'plaque_ach': box(0.7, 0.45, 0.05, IF.mat.wood('#3a2416'), 0, 0, 0); box(0.6, 0.35, 0.02, IF.mat.get('plaq' + id, () => new T.MeshStandardMaterial({ map: IF.home3d.textTex(id === 'plaque_ach' ? 'ROLL OF HONOUR' : id.split('_')[1] + ' GATES', id === 'plaque_ach' ? Object.keys(IF.save.data.achievements).length + ' deeds' : 'Steel & Blood'), metalness: 0.6, roughness: 0.35 })), 0, 0, 0.035); break;
      default: if (IF.EGG_ITEM[id]) IF.eggs.build3d(id, g); else return null;
    }
    return g;
  },
  fireSmall(x, y, z, g) { const T = IF.r3.T, f = new T.Mesh(IF.kit._flameGeo || new T.ConeGeometry(0.16, 0.5, 8), IF.mat.get('flame#candle', () => new T.MeshBasicMaterial({ color: '#d86a18', transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false }))); f.scale.setScalar(0.25); f.position.set(x, y, z); f.userData.flame = true; f.castShadow = false; g.add(f); },
  textTex(a, b) { return IF.mat.canvasTex(256, (c, n) => { c.fillStyle = '#c9a24a'; c.fillRect(0, 0, n, n); c.fillStyle = '#5a3a10'; c.textAlign = 'center'; c.font = 'bold 34px Georgia'; c.fillText(a, n / 2, n * 0.45); c.font = '24px Georgia'; c.fillText(b, n / 2, n * 0.7); c.strokeStyle = '#7a5a20'; c.lineWidth = 8; c.strokeRect(8, 8, n - 16, n - 16); }); },
  portraitTex() { return IF.mat.canvasTex(256, (c, n) => { const gr = c.createLinearGradient(0, 0, 0, n); gr.addColorStop(0, '#2a1a12'); gr.addColorStop(1, '#5a3a22'); c.fillStyle = gr; c.fillRect(0, 0, n, n); c.fillStyle = '#c8a07a'; c.beginPath(); c.ellipse(n / 2, n * 0.38, 40, 52, 0, 0, 7); c.fill(); c.fillStyle = '#e6e0d2'; c.fillRect(n * 0.25, n * 0.6, n * 0.5, n * 0.4); c.fillStyle = '#a3181e'; c.fillRect(n * 0.46, n * 0.62, n * 0.08, n * 0.36); c.fillRect(n * 0.36, n * 0.72, n * 0.28, n * 0.06); c.fillStyle = '#6a6a70'; c.beginPath(); c.arc(n / 2, n * 0.3, 44, Math.PI, 0); c.fill(); }); },
};
