/* Data definitions: rarity, weapon database, perks, armour sets, accessories.
 * All balancing lives here — systems read these tables, nothing is hardcoded elsewhere. */
'use strict';

IF.RARITIES = [
  { id: 'common',    name: 'Common',    color: '#b9b4a8', glow: 'rgba(185,180,168,0.0)', mult: 1.00, perks: 0, w: 100 },
  { id: 'uncommon',  name: 'Uncommon',  color: '#5fc46a', glow: 'rgba(95,196,106,0.35)',  mult: 1.15, perks: 1, w: 55 },
  { id: 'rare',      name: 'Rare',      color: '#4a9cff', glow: 'rgba(74,156,255,0.45)',  mult: 1.32, perks: 1, w: 24 },
  { id: 'epic',      name: 'Epic',      color: '#b25cff', glow: 'rgba(178,92,255,0.55)',  mult: 1.52, perks: 2, w: 9 },
  { id: 'legendary', name: 'Legendary', color: '#ffae2b', glow: 'rgba(255,174,43,0.65)',  mult: 1.78, perks: 2, w: 2.6 },
  { id: 'mythic',    name: 'Mythic',    color: '#ff3d4a', glow: 'rgba(255,61,74,0.75)',   mult: 2.10, perks: 3, w: 0.6 },
];
IF.RARITY = Object.fromEntries(IF.RARITIES.map((r, i) => [r.id, Object.assign(r, { index: i })]));

/* Ammunition types. Reserve ammo is per-run and refilled by pickups. */
IF.AMMO = {
  light:     { name: 'Light Rounds', color: '#d9b24c', base: 180, pickup: 36 },
  rifle:     { name: 'Rifle Rounds', color: '#c98b3a', base: 150, pickup: 30 },
  shell:     { name: 'Shells',       color: '#c43c2c', base: 40,  pickup: 10 },
  heavy:     { name: 'Heavy Rounds', color: '#8d9aa6', base: 120, pickup: 24 },
  bolt:      { name: 'Bolts & Arrows', color: '#a88a5c', base: 40, pickup: 10 },
  explosive: { name: 'Explosives',   color: '#e0602a', base: 10,  pickup: 3 },
};

/* Weapon perks. Rolled onto uncommon+ weapons. `for` restricts category. */
IF.PERKS = {
  bleed:     { name: 'Serrated',     desc: 'Hits cause bleeding (30% dmg over 3s)', for: 'melee' },
  burn:      { name: 'Incendiary',   desc: 'Hits ignite enemies (25% dmg over 3s)', for: 'any' },
  pierce:    { name: 'Penetrator',   desc: 'Projectiles pierce +1 enemy', for: 'firearm' },
  lifesteal: { name: 'Vampiric',     desc: 'Heal 3% of damage dealt', for: 'any' },
  crit:      { name: 'Keen',         desc: '+10% critical chance', for: 'any' },
  swift:     { name: 'Swift',        desc: '+15% attack speed', for: 'any' },
  heavy:     { name: 'Concussive',   desc: '+50% knockback & stagger', for: 'any' },
  execute:   { name: 'Executioner',  desc: '+50% damage to enemies below 30% health', for: 'any' },
  shock:     { name: 'Stormforged',  desc: '25% chance to chain lightning to a nearby enemy', for: 'any' },
  extmag:    { name: 'Extended Mag', desc: '+35% magazine capacity', for: 'firearm' },
  quickload: { name: 'Quickload',    desc: '-25% reload time', for: 'firearm' },
  holy:      { name: 'Consecrated',  desc: '+40% damage vs elites and bosses', for: 'any' },
  explosive: { name: 'Blast Rounds', desc: 'Hits trigger a small explosion', for: 'firearm', minRarity: 4 },
  cleave:    { name: 'Cleaving',     desc: 'Melee arc +35% wider, hits more foes', for: 'melee' },
};

/* Weapon database.
 * slot: melee | primary | secondary.  cls drives animation + rendering + sfx.
 * dmg per hit/pellet; rate = attacks per second; range in px; spread radians;
 * mag/reload for firearms; depth = earliest section it can drop. */
IF.WEAPONS = [
  // ---------------- MEDIEVAL MELEE ----------------
  { id: 'wooden_sword', name: 'Wooden Sword', slot: 'melee', cls: 'sword', dmg: 9, rate: 2.6, range: 92, crit: 0.05, knock: 140, len: 70, depth: 0, desc: 'A training blade. Better than bare gauntlets.', look: { blade: '#8a6a44', edge: '#a78457', guard: '#5a4128' } },
  { id: 'iron_sword', name: 'Iron Sword', slot: 'melee', cls: 'sword', dmg: 15, rate: 2.5, range: 100, crit: 0.06, knock: 170, len: 80, depth: 0, desc: 'Reliable pitted iron. Balanced and quick.', look: { blade: '#8c9196', edge: '#c9ced2', guard: '#4b4f55' } },
  { id: 'steel_longsword', name: 'Steel Longsword', slot: 'melee', cls: 'sword', dmg: 21, rate: 2.3, range: 116, crit: 0.08, knock: 190, len: 96, depth: 2, desc: 'A knight\'s true weapon. Long reach, clean cuts.', look: { blade: '#b4bcc4', edge: '#eef3f7', guard: '#7a6236' } },
  { id: 'claymore', name: 'Claymore', slot: 'melee', cls: 'greatsword', dmg: 34, rate: 1.55, range: 132, crit: 0.07, knock: 300, len: 118, depth: 4, desc: 'Two-handed highland blade. Sweeps through crowds.', look: { blade: '#a9b1b8', edge: '#e6ebef', guard: '#5d5f63' } },
  { id: 'greatsword', name: 'Greatsword', slot: 'melee', cls: 'greatsword', dmg: 44, rate: 1.3, range: 142, crit: 0.08, knock: 360, len: 132, depth: 7, desc: 'Massive and brutal. Each swing is a verdict.', look: { blade: '#9aa3ab', edge: '#dfe5ea', guard: '#3c3c40' } },
  { id: 'battle_axe', name: 'Battle Axe', slot: 'melee', cls: 'axe', dmg: 27, rate: 1.9, range: 98, crit: 0.12, knock: 230, len: 84, depth: 1, desc: 'Bites deep. High critical chance.', look: { blade: '#7f878e', edge: '#d0d6db', guard: '#5b3d22' } },
  { id: 'great_axe', name: 'Double-Handed Axe', slot: 'melee', cls: 'greataxe', dmg: 46, rate: 1.2, range: 126, crit: 0.14, knock: 340, len: 120, depth: 6, desc: 'Twin-bladed executioner\'s axe.', look: { blade: '#6f777e', edge: '#c8cfd4', guard: '#4a3019' } },
  { id: 'war_hammer', name: 'War Hammer', slot: 'melee', cls: 'hammer', dmg: 40, rate: 1.25, range: 108, crit: 0.05, knock: 460, len: 104, depth: 3, armorPierce: 0.6, desc: 'Crushes armour. Sends zombies flying.', look: { blade: '#5d636a', edge: '#9aa1a7', guard: '#3f2a18' } },
  { id: 'mace', name: 'Flanged Mace', slot: 'melee', cls: 'mace', dmg: 22, rate: 2.1, range: 90, crit: 0.06, knock: 280, len: 72, depth: 1, armorPierce: 0.4, desc: 'Flanged head ignores much of an enemy\'s armour.', look: { blade: '#6e747a', edge: '#b3b9be', guard: '#4b3420' } },
  { id: 'morning_star', name: 'Morning Star', slot: 'melee', cls: 'mace', dmg: 30, rate: 1.7, range: 98, crit: 0.1, knock: 300, len: 82, depth: 5, armorPierce: 0.35, bleedBase: true, desc: 'Spiked iron ball. Wounds keep bleeding.', look: { blade: '#4d5257', edge: '#9ba2a8', guard: '#3c2817', spikes: true } },
  { id: 'spear', name: 'Spear', slot: 'melee', cls: 'spear', dmg: 19, rate: 2.2, range: 150, crit: 0.08, knock: 150, len: 140, depth: 1, thrust: true, desc: 'Longest reach. Thrusts pierce a line of foes.', look: { blade: '#a7aeb5', edge: '#e1e6ea', guard: '#6a4b2b' } },
  { id: 'halberd', name: 'Halberd', slot: 'melee', cls: 'halberd', dmg: 36, rate: 1.35, range: 160, crit: 0.09, knock: 280, len: 150, depth: 5, desc: 'Axe, spike and hook on a long haft.', look: { blade: '#8e959c', edge: '#dbe0e4', guard: '#5a3e24' } },
  { id: 'dawnbreaker', name: 'Dawnbreaker', slot: 'melee', cls: 'sword', dmg: 38, rate: 2.2, range: 124, crit: 0.12, knock: 240, len: 104, depth: 8, minRarity: 4, fixedPerks: ['burn', 'holy'], desc: 'LEGENDARY. A blade that remembers the sun. Sets the dead alight.', look: { blade: '#ffd27a', edge: '#fff4cf', guard: '#b58a2e', glow: '#ffb02e' } },
  { id: 'grave_cleaver', name: 'Grave Cleaver', slot: 'melee', cls: 'greataxe', dmg: 62, rate: 1.15, range: 132, crit: 0.16, knock: 380, len: 124, depth: 10, minRarity: 4, fixedPerks: ['lifesteal', 'cleave'], desc: 'LEGENDARY. Forged from a gravedigger\'s bell. Drinks the life of the fallen.', look: { blade: '#3a3f4a', edge: '#9effc8', guard: '#1c1e24', glow: '#3dff9a' } },
  // ---------------- MEDIEVAL RANGED ----------------
  { id: 'crossbow', name: 'Crossbow', slot: 'primary', cls: 'crossbow', ammo: 'bolt', dmg: 46, rate: 1.4, range: 900, spread: 0.01, mag: 1, reload: 0.9, crit: 0.15, knock: 260, speed: 1500, pierce: 1, recoil: 2, depth: 1, desc: 'Heavy bolts pierce through two zombies.', look: { body: '#5a3d24', metal: '#8a8f95' } },
  { id: 'longbow', name: 'Longbow', slot: 'primary', cls: 'bow', ammo: 'bolt', dmg: 34, rate: 2.0, range: 1000, spread: 0.015, mag: 1, reload: 0.35, crit: 0.2, knock: 170, speed: 1350, pierce: 0, recoil: 1, depth: 2, arc: true, desc: 'Fast, silent and deadly accurate. Arrows arc.', look: { body: '#6b4a2a', metal: '#c9c2b4' } },
  // ---------------- MODERN SIDEARMS (secondary) ----------------
  { id: 'pistol', name: 'Semi-Auto Pistol', slot: 'secondary', cls: 'pistol', ammo: 'light', dmg: 14, rate: 5.5, range: 800, spread: 0.035, mag: 12, reload: 1.1, crit: 0.08, knock: 70, speed: 1800, recoil: 3, depth: 0, desc: 'Dependable 9mm sidearm.', look: { body: '#2a2c30', metal: '#55595f' } },
  { id: 'revolver', name: 'Revolver', slot: 'secondary', cls: 'revolver', ammo: 'light', dmg: 32, rate: 2.4, range: 900, spread: 0.02, mag: 6, reload: 1.7, crit: 0.18, knock: 180, speed: 2000, recoil: 7, depth: 1, desc: 'Six chambers of judgement.', look: { body: '#4d4f55', metal: '#a7abb0', grip: '#6a4529' } },
  { id: 'hand_cannon', name: 'Heavy Hand Cannon', slot: 'secondary', cls: 'handcannon', ammo: 'light', dmg: 58, rate: 1.5, range: 950, spread: 0.02, mag: 5, reload: 1.9, crit: 0.2, knock: 380, speed: 2100, pierce: 1, recoil: 13, depth: 5, desc: '.50 calibre. Knocks brutes off their feet.', look: { body: '#3b3d42', metal: '#c0c4c8', grip: '#222' } },
  { id: 'coach_gun', name: 'Double-Barrel Shotgun', slot: 'secondary', cls: 'dbshotgun', ammo: 'shell', dmg: 13, pellets: 9, rate: 3.0, range: 420, spread: 0.2, mag: 2, reload: 1.5, crit: 0.05, knock: 330, speed: 1500, recoil: 14, falloff: true, depth: 2, desc: 'Two barrels. Devastating up close.', look: { body: '#5b3a20', metal: '#3c3f44' } },
  // ---------------- MODERN PRIMARIES ----------------
  { id: 'smg', name: 'Submachine Gun', slot: 'primary', cls: 'smg', ammo: 'light', dmg: 9, rate: 12, auto: true, range: 700, spread: 0.07, mag: 30, reload: 1.4, crit: 0.05, knock: 45, speed: 1800, recoil: 2.5, depth: 1, desc: 'Sprays lead. Shreds walkers.', look: { body: '#2e3033', metal: '#4a4d52' } },
  { id: 'vk5', name: 'VK-5 Compact SMG', slot: 'primary', cls: 'smg', ammo: 'light', dmg: 11, rate: 13.3, auto: true, range: 720, spread: 0.05, mag: 30, reload: 1.3, crit: 0.07, knock: 50, speed: 1850, recoil: 2, depth: 3, desc: 'Roller-delayed precision SMG. Controllable and fast.', look: { body: '#202226', metal: '#3c4045' } },
  { id: 'u45', name: 'U-45 Tactical SMG', slot: 'primary', cls: 'smg', ammo: 'light', dmg: 15, rate: 10, auto: true, range: 740, spread: 0.055, mag: 25, reload: 1.5, crit: 0.07, knock: 80, speed: 1800, recoil: 3, depth: 4, desc: 'Heavier .45 rounds. Stops runners mid-stride.', look: { body: '#3a3a36', metal: '#57584f' } },
  { id: 'ar', name: 'Assault Rifle', slot: 'primary', cls: 'rifle', ammo: 'rifle', dmg: 16, rate: 9, auto: true, range: 1000, spread: 0.035, mag: 30, reload: 1.8, crit: 0.08, knock: 80, speed: 2400, recoil: 3, depth: 2, desc: 'All-rounder. Accurate at range.', look: { body: '#2b2d30', metal: '#4b4f54' } },
  { id: 'k47', name: 'K-47 Battle Rifle', slot: 'primary', cls: 'rifle', ammo: 'rifle', dmg: 22, rate: 7.5, auto: true, range: 1000, spread: 0.05, mag: 30, reload: 2.0, crit: 0.08, knock: 110, speed: 2300, recoil: 4.5, depth: 3, desc: 'Hits hard, kicks harder. Never jams.', look: { body: '#6a4426', metal: '#3a3b3d' } },
  { id: 'm4c', name: 'M-4C Carbine', slot: 'primary', cls: 'rifle', ammo: 'rifle', dmg: 17, rate: 10.5, auto: true, range: 1000, spread: 0.028, mag: 30, reload: 1.6, crit: 0.1, knock: 75, speed: 2500, recoil: 2.6, depth: 4, desc: 'Light, accurate, fast-handling carbine.', look: { body: '#25272a', metal: '#4d5156', tan: true } },
  { id: 'sk17', name: 'SK-17 Heavy Rifle', slot: 'primary', cls: 'rifle', ammo: 'rifle', dmg: 30, rate: 6.2, auto: true, range: 1100, spread: 0.025, mag: 20, reload: 2.0, crit: 0.12, knock: 140, speed: 2600, pierce: 1, recoil: 4.5, depth: 6, desc: '7.62 battle rifle. Punches through armour.', look: { body: '#a08a63', metal: '#2e3033' } },
  { id: 'shotgun', name: 'Combat Shotgun', slot: 'primary', cls: 'shotgun', ammo: 'shell', dmg: 11, pellets: 8, rate: 3.2, auto: true, range: 460, spread: 0.17, mag: 8, reload: 2.2, crit: 0.05, knock: 300, speed: 1500, recoil: 9, falloff: true, depth: 2, desc: 'Semi-automatic close-quarters devastation.', look: { body: '#26282b', metal: '#45484d' } },
  { id: 'pump', name: 'Pump-Action Shotgun', slot: 'primary', cls: 'pump', ammo: 'shell', dmg: 16, pellets: 9, rate: 1.4, range: 480, spread: 0.15, mag: 6, reload: 2.4, crit: 0.06, knock: 420, speed: 1500, recoil: 13, falloff: true, depth: 1, desc: 'Rack. Boom. Nothing left standing.', look: { body: '#5a3a20', metal: '#33363a' } },
  { id: 'sniper', name: 'Longshot Sniper Rifle', slot: 'primary', cls: 'sniper', ammo: 'heavy', dmg: 150, rate: 0.9, range: 1600, spread: 0.002, mag: 5, reload: 2.6, crit: 0.35, critMult: 2.5, knock: 420, speed: 4200, pierce: 4, recoil: 16, depth: 4, desc: 'One shot, a line of corpses. Huge critical damage.', look: { body: '#2f3a2c', metal: '#2a2b2e' } },
  { id: 'lmg', name: 'Saw-9 Light MG', slot: 'primary', cls: 'lmg', ammo: 'heavy', dmg: 17, rate: 11, auto: true, range: 1000, spread: 0.06, mag: 100, reload: 4.2, crit: 0.06, knock: 90, speed: 2300, recoil: 3, moveMult: 0.85, depth: 5, desc: 'Belt-fed suppression. Long reload.', look: { body: '#2c2e31', metal: '#4e5257' } },
  { id: 'hmg', name: 'Ironwall Heavy MG', slot: 'primary', cls: 'lmg', ammo: 'heavy', dmg: 28, rate: 8, auto: true, range: 1100, spread: 0.07, mag: 80, reload: 4.8, crit: 0.06, knock: 200, speed: 2300, pierce: 1, recoil: 5, moveMult: 0.72, depth: 7, desc: 'Fifty-calibre wall of fire. You will walk slowly.', look: { body: '#3e4136', metal: '#585b52' } },
  { id: 'minigun', name: 'Reaper Minigun', slot: 'primary', cls: 'minigun', ammo: 'heavy', dmg: 12, rate: 28, auto: true, spinUp: 0.7, range: 950, spread: 0.09, mag: 300, reload: 5.5, crit: 0.04, knock: 70, speed: 2300, recoil: 1.5, moveMult: 0.6, depth: 8, desc: 'Needs to spin up. Then it never stops.', look: { body: '#383b40', metal: '#6c7177' } },
  { id: 'gl', name: 'Thumper Grenade Launcher', slot: 'primary', cls: 'gl', ammo: 'explosive', dmg: 85, rate: 1.3, range: 800, spread: 0.03, mag: 6, reload: 3.0, crit: 0.0, knock: 500, speed: 950, recoil: 8, splash: 150, lob: true, depth: 5, desc: 'Lobbed grenades. Clears hordes.', look: { body: '#3a4a33', metal: '#2d2f31' } },
  { id: 'rl', name: 'Siegebreaker Rocket Launcher', slot: 'primary', cls: 'rl', ammo: 'explosive', dmg: 220, rate: 0.75, range: 1400, spread: 0.0, mag: 1, reload: 2.3, crit: 0.0, knock: 700, speed: 1100, recoil: 15, splash: 210, moveMult: 0.85, depth: 7, desc: 'Massive blast radius. Boss killer.', look: { body: '#4b5a3f', metal: '#2e3033' } },
  // ---------------- LEGENDARY MILITARY ----------------
  { id: 'crusader_rifle', name: 'The Crusader', slot: 'primary', cls: 'rifle', ammo: 'rifle', dmg: 34, rate: 9, auto: true, range: 1200, spread: 0.02, mag: 40, reload: 1.6, crit: 0.15, knock: 140, speed: 2800, pierce: 2, recoil: 3, depth: 9, minRarity: 4, fixedPerks: ['holy', 'burn'], desc: 'LEGENDARY. Gold-chased battle rifle firing consecrated rounds.', look: { body: '#d7c08a', metal: '#5a4a24', glow: '#ffd36b' } },
  { id: 'dragons_breath', name: "Dragon's Breath", slot: 'primary', cls: 'shotgun', ammo: 'shell', dmg: 18, pellets: 10, rate: 3.6, auto: true, range: 520, spread: 0.16, mag: 12, reload: 2.0, crit: 0.08, knock: 380, speed: 1500, recoil: 9, falloff: true, depth: 9, minRarity: 4, fixedPerks: ['burn', 'heavy'], desc: 'LEGENDARY. Incendiary shells turn the horde to ash.', look: { body: '#2a1a14', metal: '#8a2f1c', glow: '#ff5a1e' } },
];
IF.WEAPON = Object.fromEntries(IF.WEAPONS.map((w) => [w.id, w]));

/* ---------------- ARMOUR ----------------
 * Seven visual tiers (sets). Each set covers helmet/chest/gauntlets/legs/boots/shield/cape. */
IF.ARMOUR_SLOTS = ['helmet', 'chest', 'gauntlets', 'legs', 'boots', 'shield', 'cape'];
IF.SLOT_NAMES = { helmet: 'Helmet', chest: 'Chest Armour', gauntlets: 'Gauntlets', legs: 'Leg Armour', boots: 'Boots', shield: 'Shield', cape: 'Cape', accessory: 'Accessory' };
IF.SLOT_ARMOUR_WEIGHT = { helmet: 0.16, chest: 0.3, gauntlets: 0.1, legs: 0.18, boots: 0.1, shield: 0.12, cape: 0.04 };

IF.ARMOUR_SETS = [
  { id: 'worn_iron', name: 'Worn Iron', tier: 0, armor: 30, depth: 0,
    pal: { metal: '#7d7a73', dark: '#46443f', light: '#b3afa5', trim: '#6b5a3d', cloth: '#b3a68c', accent: '#8a3b2a', cross: '#7e1a18', plume: null, rust: 0.55 },
    helm: 'greathelm', bonus2: { maxHp: 20 }, bonus4: { dmgReduce: 0.04 }, bonus6: { regen: 0.6 },
    bonusText: ['+20 max health', '+4% damage reduction', 'Regenerate 0.6 HP/s'] },
  { id: 'reinforced_steel', name: 'Reinforced Steel', tier: 1, armor: 55, depth: 3,
    pal: { metal: '#a9b0b6', dark: '#5d646b', light: '#e3e8ec', trim: '#4d5359', cloth: '#cfc8b8', accent: '#9a1c1c', cross: '#9a1a1e', plume: null, rust: 0.1 },
    helm: 'sallet', bonus2: { blockEff: 0.15 }, bonus4: { resBlast: 0.25 }, bonus6: { maxHp: 60, armor: 20 },
    bonusText: ['+15% block efficiency', '+25% blast resistance', '+60 max health, +20 armour'] },
  { id: 'knight_commander', name: 'Knight Commander', tier: 2, armor: 85, depth: 6,
    pal: { metal: '#c4c9cd', dark: '#6a7076', light: '#f4f7f9', trim: '#c9a34a', cloth: '#e6e0d2', accent: '#d8b25a', cross: '#b3151d', plume: '#b3202a', rust: 0 },
    helm: 'armet', bonus2: { meleeDmg: 0.1 }, bonus4: { stagger: 0.5 }, bonus6: { meleeDmg: 0.15, attackSpeed: 0.1 },
    bonusText: ['+10% melee damage', 'Heavy attacks stagger everything', '+15% melee damage, +10% attack speed'] },
  { id: 'blackened_war', name: 'Blackened War', tier: 3, armor: 120, depth: 10,
    pal: { metal: '#3a3c40', dark: '#1d1e21', light: '#7a7f86', trim: '#8b2b23', cloth: '#2a2525', accent: '#c23a2b', cross: '#8e1414', plume: '#151515', rust: 0, spikes: true },
    helm: 'spiked', bonus2: { gunDmg: 0.12 }, bonus4: { killHeal: 2 }, bonus6: { gunDmg: 0.15, crit: 0.08 },
    bonusText: ['+12% firearm damage', 'Bloodlust: each kill heals 2 HP', '+15% firearm damage, +8% crit'] },
  { id: 'royal', name: 'Royal', tier: 4, armor: 160, depth: 14,
    pal: { metal: '#e6e1d3', dark: '#9c927a', light: '#ffffff', trim: '#e2b23c', cloth: '#f3efe5', accent: '#f0c64a', cross: '#c0141c', plume: '#f1f1f1', rust: 0, gold: true },
    helm: 'crowned', bonus2: { goldFind: 0.25 }, bonus4: { aegis: 12 }, bonus6: { dmgReduce: 0.1, maxHp: 100 },
    bonusText: ['+25% gold found', 'Royal Aegis: block one hit every 12s', '+10% damage reduction, +100 max health'] },
  { id: 'obsidian', name: 'Legendary Obsidian', tier: 5, armor: 210, depth: 18,
    pal: { metal: '#24202b', dark: '#0f0d13', light: '#5c4f78', trim: '#9b5cff', cloth: '#1a1424', accent: '#b77bff', cross: '#8a3cff', plume: null, rust: 0, glow: '#a36bff' },
    helm: 'horned', bonus2: { crit: 0.08 }, bonus4: { critExplode: 1 }, bonus6: { allDmg: 0.2, critDmg: 0.4 },
    bonusText: ['+8% critical chance', 'Obsidian Wrath: critical hits explode', '+20% all damage, +40% critical damage'] },
  { id: 'mythic', name: 'Ascendant Mythic', tier: 6, armor: 280, depth: 24,
    pal: { metal: '#f2efe6', dark: '#a69a7c', light: '#ffffff', trim: '#ff3d4a', cloth: '#f7f1e2', accent: '#ffcf5a', cross: '#e0101c', plume: '#ff3d4a', rust: 0, glow: '#ffd66b', halo: true },
    helm: 'halo', bonus2: { regen: 2 }, bonus4: { revive: 1 }, bonus6: { allDmg: 0.25, moveSpeed: 0.1, dmgReduce: 0.1 },
    bonusText: ['Regenerate 2 HP/s', 'Ascension: revive once per run', '+25% all damage, +10% speed, +10% damage reduction'] },
];
IF.ARMOUR_SET = Object.fromEntries(IF.ARMOUR_SETS.map((s) => [s.id, s]));

/* Random secondary attributes ("affixes") on armour pieces. */
IF.AFFIXES = [
  { stat: 'maxHp', name: 'Max Health', min: 8, max: 30, fmt: (v) => '+' + Math.round(v) },
  { stat: 'moveSpeed', name: 'Move Speed', min: 0.02, max: 0.06, pct: true },
  { stat: 'dmgReduce', name: 'Damage Reduction', min: 0.01, max: 0.04, pct: true },
  { stat: 'meleeDmg', name: 'Melee Damage', min: 0.03, max: 0.09, pct: true },
  { stat: 'gunDmg', name: 'Firearm Damage', min: 0.03, max: 0.09, pct: true },
  { stat: 'reloadSpeed', name: 'Reload Speed', min: 0.04, max: 0.1, pct: true },
  { stat: 'crit', name: 'Critical Chance', min: 0.01, max: 0.04, pct: true },
  { stat: 'regen', name: 'Health Regen', min: 0.2, max: 0.8, fmt: (v) => '+' + v.toFixed(1) + '/s' },
  { stat: 'ammoCap', name: 'Ammo Capacity', min: 0.05, max: 0.15, pct: true },
  { stat: 'resToxic', name: 'Toxic Resistance', min: 0.05, max: 0.15, pct: true },
  { stat: 'resBlast', name: 'Blast Resistance', min: 0.05, max: 0.15, pct: true },
  { stat: 'stamina', name: 'Max Stamina', min: 5, max: 15, fmt: (v) => '+' + Math.round(v) },
];
IF.AFFIX = Object.fromEntries(IF.AFFIXES.map((a) => [a.stat, a]));

/* Accessories: amulets & rings with signature effects (accessory slot). */
IF.ACCESSORIES = [
  { id: 'pilgrim_token', name: "Pilgrim's Token", depth: 0, stats: { maxHp: 15, regen: 0.3 }, desc: 'A battered tin badge. Hope endures.', color: '#b9a37a' },
  { id: 'dog_tags', name: 'Fallen Soldier\'s Tags', depth: 1, stats: { gunDmg: 0.08, reloadSpeed: 0.08 }, desc: 'Names of a squad that did not make it.', color: '#a8adb2' },
  { id: 'wolf_fang', name: 'Wolf Fang Charm', depth: 2, stats: { meleeDmg: 0.1, crit: 0.03 }, desc: 'Taken from the forest\'s last wolf.', color: '#e8e0cc' },
  { id: 'bandolier', name: 'Ammo Bandolier', depth: 2, stats: { ammoCap: 0.3 }, desc: 'More rounds, fewer worries.', color: '#8a5a2b' },
  { id: 'saints_relic', name: "Saint's Relic", depth: 5, stats: { holyAll: 0.2, dmgReduce: 0.04 }, desc: '+20% damage vs elites & bosses.', color: '#ffd36b' },
  { id: 'adrenal_injector', name: 'Adrenal Injector', depth: 6, stats: { moveSpeed: 0.08, stamina: 20 }, desc: 'Military stimulant. Do not ask what is in it.', color: '#4ad6c8' },
  { id: 'heart_of_iron', name: 'Heart of Iron', depth: 9, stats: { maxHp: 60, armor: 30 }, desc: 'Beats slow and heavy.', color: '#9a2c2c' },
  { id: 'obsidian_eye', name: 'Obsidian Eye', depth: 14, stats: { crit: 0.08, critDmg: 0.3 }, desc: 'Sees every weakness.', color: '#a36bff' },
];
IF.ACCESSORY = Object.fromEntries(IF.ACCESSORIES.map((a) => [a.id, a]));

/* ---------------- KNIGHT CUSTOMISATION (cosmetic only) ---------------- */
IF.HERALDRY = {
  colors: [
    { id: 'white', name: 'Templar White', c: '#ece6d8' }, { id: 'linen', name: 'Weathered Linen', c: '#bfb39a' }, { id: 'black', name: 'Sable', c: '#1f1b1b' },
    { id: 'crimson', name: 'Gules', c: '#8e1218' }, { id: 'scarlet', name: 'Scarlet', c: '#c4241e' }, { id: 'blue', name: 'Azure', c: '#24387a' },
    { id: 'navy', name: 'Midnight', c: '#141c36' }, { id: 'green', name: 'Vert', c: '#2c5a2c' }, { id: 'purple', name: 'Purpure', c: '#4e2470' },
    { id: 'gold', name: 'Or', c: '#d0a43a' }, { id: 'grey', name: 'Ash', c: '#62605c' }, { id: 'brown', name: 'Umber', c: '#5a3e22' },
  ],
  emblems: [
    { id: 'cross', name: 'Templar Cross' }, { id: 'pattee', name: 'Cross Pattée' }, { id: 'maltese', name: 'Maltese Cross' },
    { id: 'lorraine', name: 'Cross of Lorraine' }, { id: 'saltire', name: 'Saltire' }, { id: 'none', name: 'Plain' },
  ],
  finishes: [
    { id: 'auto', name: 'From armour' },
    { id: 'polished', name: 'Polished Steel', pal: { metal: '#c4c9cd', dark: '#666c72', light: '#f6f8fa' } },
    { id: 'blackened', name: 'Blackened', pal: { metal: '#3a3c40', dark: '#16171a', light: '#7a7f86' } },
    { id: 'gilded', name: 'Gilded', pal: { metal: '#c9a648', dark: '#6e5418', light: '#fff0b0' } },
    { id: 'bronze', name: 'Bronze', pal: { metal: '#9a6a3a', dark: '#4a2e16', light: '#e0b080' } },
    { id: 'battleworn', name: 'Battle-worn Iron', pal: { metal: '#7d7a73', dark: '#46443f', light: '#b3afa5' }, rust: 0.55 },
  ],
  presets: [
    { id: 'templar', name: 'Knights Templar', tabard: 'white', emblem: 'cross', cross: 'crimson', cape: 'white', plume: 'auto' },
    { id: 'hospitaller', name: 'Hospitaller', tabard: 'black', emblem: 'maltese', cross: 'white', cape: 'black', plume: 'none' },
    { id: 'teutonic', name: 'Teutonic Order', tabard: 'white', emblem: 'pattee', cross: 'black', cape: 'white', plume: 'black' },
    { id: 'lazarus', name: 'Order of St Lazarus', tabard: 'white', emblem: 'maltese', cross: 'green', cape: 'green', plume: 'none' },
    { id: 'lorraine', name: 'Duke of Lorraine', tabard: 'gold', emblem: 'lorraine', cross: 'crimson', cape: 'crimson', plume: 'gold' },
    { id: 'highland', name: 'Highland Guard', tabard: 'blue', emblem: 'saltire', cross: 'white', cape: 'navy', plume: 'white' },
    { id: 'black', name: 'The Black Knight', tabard: 'black', emblem: 'none', cross: 'grey', cape: 'black', plume: 'black', finish: 'blackened' },
  ],
  helms: [ // cosmetic helmet styles: unlocked by owning any piece of the set
    { id: 'auto', name: 'From armour' }, { id: 'greathelm', name: 'Great Helm', set: 'worn_iron' }, { id: 'sallet', name: 'Sallet', set: 'reinforced_steel' },
    { id: 'armet', name: 'Armet', set: 'knight_commander' }, { id: 'spiked', name: 'War Helm', set: 'blackened_war' }, { id: 'crowned', name: 'Crowned Helm', set: 'royal' },
    { id: 'horned', name: 'Horned Obsidian', set: 'obsidian' }, { id: 'halo', name: 'Ascendant', set: 'mythic' },
  ],
};
IF.HCOLOR = Object.fromEntries(IF.HERALDRY.colors.map((c) => [c.id, c.c]));
