/* Hidden discoveries — one secret per zone (biome). Each is found once per save, pays out gold/materials
 * and adds a curiosity to the Crusader Home. New eggs are just new entries in IF.EASTER_EGGS.
 * Kinds: 'stash' — an unremarkable destructible tucked *behind* the starting point (most players run right);
 *        'dancer' — a harmless zombie doing something absurd off to the side; it only fights if attacked;
 *        'shoot' — a small target high on the back of the zone you can only hit with a firearm. */
'use strict';

IF.EASTER_EGGS = [
  { id: 'egg_village', biome: 'village', kind: 'stash', prop: 'barrel', name: 'Grandmother\'s Biscuit Tin', desc: 'Still sealed. Still edible. Probably.', gold: 150, mats: { parts: 3 } },
  { id: 'egg_forest', biome: 'forest', kind: 'dancer', name: 'The Dancing Dead', desc: 'A zombie who simply refused to stop the jig. A music box was in its pocket.', gold: 180, mats: { steel: 2 } },
  { id: 'egg_castle', biome: 'castle', kind: 'shoot', name: 'The Jester\'s Bell', desc: 'Shot down from the battlements. It still jingles when nobody is near.', gold: 220, mats: { shards: 1 } },
  { id: 'egg_highway', biome: 'highway', kind: 'stash', prop: 'tyres', name: 'Fuzzy Dice', desc: 'Pink. Somebody loved that car.', gold: 240, mats: { parts: 5 } },
  { id: 'egg_checkpoint', biome: 'checkpoint', kind: 'dancer', name: 'The Saluting Sentry', desc: 'Still standing guard, still saluting. Took his whistle.', gold: 260, mats: { steel: 3 } },
  { id: 'egg_city', biome: 'city', kind: 'shoot', name: 'The Rooftop Garden Gnome', desc: 'Watched the city fall with a smile.', gold: 280, mats: { shards: 1, parts: 4 } },
  { id: 'egg_battlefield', biome: 'battlefield', kind: 'stash', prop: 'crate', name: 'A Sergeant\'s Teddy Bear', desc: 'Named "Major Fluff". Mentioned in dispatches.', gold: 320, mats: { steel: 4 } },
  { id: 'egg_base', biome: 'base', kind: 'dancer', name: 'The Mess Hall Chef', desc: 'Still stirring an empty pot. Here is his ladle.', gold: 340, mats: { parts: 6 } },
  { id: 'egg_industrial', biome: 'industrial', kind: 'shoot', name: 'The Golden Rivet', desc: 'The last rivet of the works. Pure brass, polished by superstition.', gold: 380, mats: { cores: 1 } },
  { id: 'egg_bunker', biome: 'bunker', kind: 'stash', prop: 'locker', name: 'The Bunker Rubber Duck', desc: 'Squeaks. Nobody knows why it was down here.', gold: 420, mats: { cores: 1, steel: 3 } },
  { id: 'egg_lab', biome: 'lab', kind: 'dancer', name: 'Specimen 0: The Lab Coat', desc: 'A zombie that still thinks it is the lead scientist. Its notes are illegible.', gold: 460, mats: { cores: 2 } },
  { id: 'egg_settlement', biome: 'settlement', kind: 'shoot', name: 'The Weathervane Cockerel', desc: 'Crowed at dawn every day of the apocalypse.', gold: 500, mats: { shards: 2 } },
];
IF.EGG_ITEM = Object.fromEntries(IF.EASTER_EGGS.map((e) => [e.id, { id: e.id, name: e.name, kind: 'floor', cat: 'Curiosities', src: 'A hidden secret in ' + e.biome, egg: true }]));

IF.eggs = {
  found(id) { const h = IF.home.data(); return !!(h.eggs && h.eggs[id]); },
  /* called after a combat section is generated: plant the zone's secret if it hasn't been found yet */
  plant(run, W) {
    if (run.mode.home || W.isBoss) return;
    const egg = IF.EASTER_EGGS.find((e) => e.biome === W.biome.id); if (!egg || this.found(egg.id)) return;
    if (W.section % IF.SECTIONS_PER_BIOME !== 1 && IF.SECTIONS_PER_BIOME > 1 && run.rng.next() < 0.5) return; // most often in the first section of a zone
    if (egg.kind === 'stash') { const p = IF.world.makeProp(egg.prop, W.start + 30, run.rng); if (!p) return; p.destructible = true; p.hp = p.maxHp = 90; p.egg = egg.id; W.props.push(p); }
    else if (egg.kind === 'dancer') W.eggDancer = { egg: egg.id, x: W.start + W.end * 0 + (W.end - W.start) * 0.42 };
    else if (egg.kind === 'shoot') W.eggTarget = { egg: egg.id, x: W.start + (W.end - W.start) * (0.3 + run.rng.next() * 0.3), y: IF.GROUND - 330, w: 26, h: 26, hit: false };
  },
  /* the dancer is spawned when the knight first gets near it */
  update(run) {
    const W = run.world, pl = run.player;
    if (W.eggDancer && !W.eggDancer.spawned && Math.abs(pl.x - W.eggDancer.x) < 900) {
      W.eggDancer.spawned = true; const e = run.spawnEnemy('walker', W.eggDancer.x, {}); if (e) { e.passive = true; e.egg = W.eggDancer.egg; e.maxHp = e.hp = 60; }
    }
  },
  /* shots that pass through the high target */
  checkShot(run, p) {
    const T = run.world.eggTarget; if (!T || T.hit) return;
    if (p.x > T.x - T.w && p.x < T.x + T.w && p.y > T.y - T.h && p.y < T.y + T.h) { T.hit = true; IF.fx.sparks(T.x, T.y, 0, 12, '#ffd36b'); this.reward(run, T.egg, T.x, T.y); }
  },
  reward(run, id, x, y) {
    const egg = IF.EASTER_EGGS.find((e) => e.id === id); if (!egg || this.found(id)) return;
    const h = IF.home.data(); h.eggs = h.eggs || {}; h.eggs[id] = true; h.owned[id] = true;
    const d = IF.save.data; d.gold += egg.gold; for (const k in egg.mats) d.mats[k] = (d.mats[k] || 0) + egg.mats[k];
    IF.fx.ring(x, y, 220, 'rgba(255,214,110,0.9)', 0.7); for (let i = 0; i < 30; i++) IF.fx.spawn({ x, y, vx: (Math.random() - 0.5) * 500, vy: -200 - Math.random() * 400, life: 1.4, size: 4, color: Math.random() < 0.5 ? '#ffd36b' : '#fff4c0', type: 'glow', add: true, grav: 600 });
    IF.audio.reward && IF.audio.reward(4);
    run.banner = { top: 'SECRET DISCOVERED', main: egg.name }; run.bannerT = 3;
    IF.ui.toast('SECRET · ' + egg.name, 'ach', egg.desc + '  (+' + egg.gold + ' gold · added to your Home)');
    IF.save.write();
  },
  /* 2D/3D drawing of the shooting target */
  draw2d(ctx, run) { const T = run.world.eggTarget; if (!T || T.hit) return; ctx.fillStyle = '#b8902a'; ctx.beginPath(); ctx.arc(T.x, T.y, 10, 0, 6.283); ctx.fill(); },
  build3d(id, g) {
    const T = IF.r3.T, K = IF.kit, gold = IF.mat.metal('#d8b25a', 0.3, 1), ped = K.mats().stone;
    K.box(0.4, 0.7, 0.4, ped, 0, 0.35, 0, g); K.box(0.46, 0.05, 0.46, K.mats().stoneDark, 0, 0.72, 0, g);
    const top = new T.Group(); top.position.y = 0.75; g.add(top);
    const M = (geo, m, x, y, z) => K.mesh(geo, m, x, y, z, top), c = (col) => IF.mat.basic(col, 0.5);
    switch (id) {
      case 'egg_village': M(new T.CylinderGeometry(0.12, 0.12, 0.1, 16), IF.mat.metal('#2a4a7a', 0.4, 0.8), 0, 0.05, 0); break;
      case 'egg_forest': M(new T.BoxGeometry(0.18, 0.12, 0.14), IF.mat.wood('#6a4a2a'), 0, 0.06, 0); M(new T.CylinderGeometry(0.01, 0.01, 0.06, 6), gold, 0.1, 0.1, 0); break;
      case 'egg_castle': M(new T.SphereGeometry(0.07, 10, 8), gold, 0, 0.07, 0); M(new T.TorusGeometry(0.03, 0.01, 4, 8), gold, 0, 0.15, 0); break;
      case 'egg_highway': for (const s of [-1, 1]) { const d = M(new T.BoxGeometry(0.08, 0.08, 0.08), c('#ff7ab0'), s * 0.05, 0.05 + (s > 0 ? 0.02 : 0), 0); d.rotation.set(0.4 * s, 0.6, 0.2); } break;
      case 'egg_checkpoint': M(new T.CylinderGeometry(0.02, 0.02, 0.12, 8).rotateZ(Math.PI / 2), IF.mat.metal('#c0c4c8', 0.3, 1), 0, 0.03, 0); break;
      case 'egg_city': M(new T.ConeGeometry(0.06, 0.12, 8), c('#c0201a'), 0, 0.22, 0); M(new T.SphereGeometry(0.06, 10, 8), c('#e8c8a8'), 0, 0.13, 0); M(new T.CylinderGeometry(0.06, 0.07, 0.1, 10), c('#2a5aa0'), 0, 0.05, 0); M(new T.ConeGeometry(0.04, 0.06, 8), c('#eeeeee'), 0, 0.1, 0.03); break;
      case 'egg_battlefield': M(new T.SphereGeometry(0.08, 10, 8), c('#8a6a4a'), 0, 0.08, 0); M(new T.SphereGeometry(0.06, 10, 8), c('#8a6a4a'), 0, 0.2, 0); for (const s of [-1, 1]) M(new T.SphereGeometry(0.025, 6, 5), c('#8a6a4a'), s * 0.045, 0.26, 0); break;
      case 'egg_base': { const l = M(new T.CylinderGeometry(0.01, 0.01, 0.3, 6), IF.mat.metal('#c0c4c8', 0.3, 1), 0, 0.12, 0); l.rotation.z = 0.5; M(new T.SphereGeometry(0.04, 8, 6, 0, 6.3, 0, 1.6), IF.mat.metal('#c0c4c8', 0.3, 1), -0.07, 0.01, 0); break; }
      case 'egg_industrial': M(new T.CylinderGeometry(0.05, 0.05, 0.03, 12), gold, 0, 0.015, 0); M(new T.CylinderGeometry(0.02, 0.02, 0.08, 8), gold, 0, 0.06, 0); break;
      case 'egg_bunker': M(new T.SphereGeometry(0.07, 10, 8), c('#f0d020'), 0, 0.06, 0); M(new T.SphereGeometry(0.045, 10, 8), c('#f0d020'), 0.05, 0.13, 0); M(new T.ConeGeometry(0.02, 0.04, 6).rotateZ(-Math.PI / 2), c('#f08020'), 0.1, 0.13, 0); break;
      case 'egg_lab': M(new T.CylinderGeometry(0.07, 0.07, 0.2, 12), IF.mat.get('labjar', () => new T.MeshStandardMaterial({ color: '#7affc8', emissive: '#1a6a4a', transparent: true, opacity: 0.6, roughness: 0.05 })), 0, 0.1, 0); break;
      case 'egg_settlement': M(new T.CylinderGeometry(0.008, 0.008, 0.3, 6), IF.mat.metal('#3a3a3a', 0.5, 0.8), 0, 0.15, 0); { const b = M(new T.ConeGeometry(0.05, 0.16, 6).rotateZ(Math.PI / 2), IF.mat.metal('#8a5a2a', 0.5, 0.8), 0, 0.28, 0); } break;
    }
    const plate = K.box(0.3, 0.06, 0.02, gold, 0, 0.5, 0.21, g);
  },
};
