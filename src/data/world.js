/* Data: enemies, bosses, biomes, skill trees, achievements, game modes. */
'use strict';

/* ---------------- ZOMBIES ----------------
 * reach: attack range px.  windup/active/recover: attack timings (s) — windup is the telegraph.
 * armor: fraction of damage negated unless the attack has armour-piercing.
 * depth: earliest section of appearance.  weight: spawn weight once available. */
IF.ENEMIES = [
  { id: 'walker', name: 'Walker', hp: 42, speed: 52, dmg: 9, reach: 58, windup: 0.55, active: 0.15, recover: 0.6, cooldown: 0.9, w: 44, h: 128, armor: 0, xp: 6, gold: 2, depth: 0, weight: 10, dmgType: 'bite',
    look: { skin: '#7d8a6a', skinDark: '#4f5a42', shirt: '#5a5246', pants: '#3a3d45', hair: '#2a2620', posture: 0.18 } },
  { id: 'runner', name: 'Runner', hp: 32, speed: 205, dmg: 7, reach: 54, windup: 0.32, active: 0.12, recover: 0.45, cooldown: 0.6, w: 40, h: 122, armor: 0, xp: 8, gold: 3, depth: 1, weight: 6, dmgType: 'bite',
    look: { skin: '#9a8f7a', skinDark: '#625947', shirt: '#7a2d2a', pants: '#2d3138', hair: '#1a1714', posture: 0.38 } },
  { id: 'crawler', name: 'Crawler', hp: 30, speed: 92, dmg: 8, reach: 50, windup: 0.4, active: 0.12, recover: 0.5, cooldown: 0.7, w: 70, h: 40, armor: 0, xp: 7, gold: 2, depth: 1, weight: 5, dmgType: 'bite', low: true,
    look: { skin: '#6d785b', skinDark: '#454d39', shirt: '#4a4438', pants: '#2b2e33', hair: '#221f1a', posture: 0 } },
  { id: 'brute', name: 'Brute', hp: 260, speed: 42, dmg: 26, reach: 92, windup: 0.95, active: 0.2, recover: 0.9, cooldown: 1.6, w: 78, h: 176, armor: 0.1, xp: 30, gold: 10, depth: 2, weight: 3, dmgType: 'smash', heavy: true, scale: 1.38,
    look: { skin: '#7a6d5e', skinDark: '#4a4036', shirt: '#3d3a33', pants: '#34302a', hair: '#1a1714', posture: 0.12 } },
  { id: 'exploder', name: 'Exploder', hp: 46, speed: 74, dmg: 38, reach: 70, windup: 0.9, active: 0.1, recover: 0, cooldown: 0, w: 56, h: 128, armor: 0, xp: 12, gold: 4, depth: 2, weight: 3, dmgType: 'blast', explode: 160,
    look: { skin: '#9fae5c', skinDark: '#5f6b30', shirt: '#6a7d34', pants: '#3b3a2c', hair: '#202018', posture: 0.1, bloated: true } },
  { id: 'armoured', name: 'Armoured Zombie', hp: 120, speed: 50, dmg: 13, reach: 64, windup: 0.6, active: 0.15, recover: 0.6, cooldown: 1.0, w: 48, h: 132, armor: 0.55, xp: 18, gold: 7, depth: 3, weight: 4, dmgType: 'bite',
    look: { skin: '#76806a', skinDark: '#4a5142', shirt: '#4f5359', pants: '#2c2f34', hair: '#000', posture: 0.12, riot: true } },
  { id: 'screamer', name: 'Screamer', hp: 55, speed: 70, dmg: 6, reach: 54, windup: 0.4, active: 0.1, recover: 0.5, cooldown: 0.8, w: 40, h: 130, armor: 0, xp: 16, gold: 5, depth: 4, weight: 2, dmgType: 'bite', screamer: true,
    look: { skin: '#a8a596', skinDark: '#6c6a5d', shirt: '#cfc7b2', pants: '#4a3f3a', hair: '#cfc7b2', posture: 0.05, gaunt: true } },
  { id: 'military', name: 'Military Zombie', hp: 95, speed: 64, dmg: 14, reach: 60, windup: 0.5, active: 0.15, recover: 0.55, cooldown: 0.9, w: 46, h: 130, armor: 0.3, xp: 18, gold: 8, depth: 5, weight: 4, dmgType: 'bite', military: true, dropsAmmo: 0.45,
    look: { skin: '#80866c', skinDark: '#4f5442', shirt: '#4a5233', pants: '#3e4530', hair: '#000', posture: 0.12, helmet: true } },
  { id: 'mutant', name: 'Mutant', hp: 150, speed: 120, dmg: 20, reach: 80, windup: 0.42, active: 0.18, recover: 0.6, cooldown: 0.8, w: 60, h: 150, armor: 0.1, xp: 32, gold: 12, depth: 7, weight: 2, dmgType: 'toxic', mutant: true, scale: 1.15,
    look: { skin: '#8a6f86', skinDark: '#4e3a4b', shirt: '#2e2a30', pants: '#252228', hair: '#000', posture: 0.3, tumours: true } },
  { id: 'elite', name: 'Elite Revenant', hp: 420, speed: 96, dmg: 28, reach: 88, windup: 0.5, active: 0.2, recover: 0.5, cooldown: 0.7, w: 58, h: 160, armor: 0.35, xp: 80, gold: 35, depth: 9, weight: 0.7, dmgType: 'bite', elite: true, scale: 1.22,
    look: { skin: '#5c5466', skinDark: '#332d3b', shirt: '#211d26', pants: '#1a171e', hair: '#000', posture: 0.15, eyes: '#ff3d4a', hood: true } },
];
IF.ENEMY = Object.fromEntries(IF.ENEMIES.map((e) => [e.id, e]));

/* ---------------- BOSSES ----------------
 * Phases trigger at HP thresholds; each phase has an attack rotation.
 * weak: damage-type multipliers.  vuln: seconds of 2x damage after the boss's signature attack. */
IF.BOSSES = [
  { id: 'executioner', name: 'The Castle Executioner', title: 'Headsman of the Ruined Keep', hp: 1700, speed: 80, dmg: 27, scale: 2.0, w: 110, h: 250, armor: 0.15, xp: 400, gold: 220,
    weak: { fire: 1.3 }, vulnAfter: 'slam', look: { skin: '#6f6a60', skinDark: '#3c3933', shirt: '#2a1c18', pants: '#231a17', hood: true, hoodColor: '#191312', weapon: 'axe', eyes: '#ff6a3a' },
    phases: [{ at: 1.0, attacks: ['sweep', 'slam', 'sweep', 'charge'] }, { at: 0.6, attacks: ['slam', 'charge', 'sweep', 'slam'] }, { at: 0.3, attacks: ['charge', 'slam', 'slam', 'roar', 'sweep'] }] },
  { id: 'commander', name: 'The Fallen Commander', title: 'Last Officer of the 3rd Battalion', hp: 2300, speed: 90, dmg: 24, scale: 1.75, w: 96, h: 220, armor: 0.3, xp: 550, gold: 300,
    weak: { melee: 1.35 }, vulnAfter: 'barrage', look: { skin: '#7c8268', skinDark: '#474b3a', shirt: '#3f4a2c', pants: '#36402a', helmet: true, weapon: 'rifle', eyes: '#ffd23a', medals: true },
    phases: [{ at: 1.0, attacks: ['barrage', 'grenade', 'sweep', 'barrage'] }, { at: 0.6, attacks: ['summon', 'barrage', 'grenade', 'charge'] }, { at: 0.3, attacks: ['barrage', 'grenade', 'grenade', 'summon', 'charge'] }] },
  { id: 'abomination', name: 'The Abomination', title: 'Stitched From the Fallen', hp: 3100, speed: 70, dmg: 36, scale: 2.4, w: 150, h: 270, armor: 0.1, xp: 750, gold: 380,
    weak: { fire: 1.5, explosive: 1.3 }, vulnAfter: 'leap', look: { skin: '#8a7c70', skinDark: '#4f443c', shirt: '#4b2d2a', pants: '#3a2622', stitches: true, eyes: '#c6ff3a', tumours: true },
    phases: [{ at: 1.0, attacks: ['sweep', 'leap', 'summon_crawlers', 'sweep'] }, { at: 0.6, attacks: ['leap', 'toxic', 'sweep', 'summon_crawlers'] }, { at: 0.3, attacks: ['leap', 'leap', 'toxic', 'roar', 'sweep'] }] },
  { id: 'plague_brute', name: 'The Plague Brute', title: 'Bearer of the Rot', hp: 3900, speed: 85, dmg: 40, scale: 2.2, w: 140, h: 265, armor: 0.2, xp: 950, gold: 460,
    weak: { fire: 1.6 }, vulnAfter: 'slam', look: { skin: '#90a05a', skinDark: '#566230', shirt: '#3e4a2a', pants: '#2f3524', bloated: true, eyes: '#e8ff3a', gasmask: true },
    phases: [{ at: 1.0, attacks: ['toxic', 'slam', 'sweep', 'toxic'] }, { at: 0.6, attacks: ['leap', 'toxic', 'slam', 'charge'] }, { at: 0.3, attacks: ['toxic', 'toxic', 'slam', 'leap', 'roar'] }] },
  { id: 'general', name: 'The Undead General', title: 'Marshal of the Endless Legion', hp: 4900, speed: 120, dmg: 42, scale: 1.85, w: 100, h: 235, armor: 0.4, xp: 1200, gold: 560,
    weak: { melee: 1.25, holy: 1.4 }, vulnAfter: 'charge', look: { skin: '#6c6e74', skinDark: '#3a3b40', shirt: '#2a2d36', pants: '#22252c', helmet: true, cape: '#5a1418', weapon: 'sword', eyes: '#5ad1ff', medals: true },
    phases: [{ at: 1.0, attacks: ['charge', 'sweep', 'barrage', 'summon'] }, { at: 0.6, attacks: ['charge', 'grenade', 'sweep', 'charge', 'summon'] }, { at: 0.3, attacks: ['charge', 'charge', 'barrage', 'slam', 'roar'] }] },
  { id: 'obsidian_king', name: 'The Obsidian King', title: 'Crowned in Black Glass', hp: 6600, speed: 105, dmg: 48, scale: 2.3, w: 130, h: 280, armor: 0.35, xp: 1800, gold: 800,
    weak: { holy: 1.6 }, vulnAfter: 'slam', look: { skin: '#3a3346', skinDark: '#1b1622', shirt: '#1a1424', pants: '#140f1b', crown: true, cape: '#2b1240', weapon: 'greatsword', eyes: '#b77bff', obsidian: true },
    phases: [{ at: 1.0, attacks: ['sweep', 'slam', 'barrage', 'charge'] }, { at: 0.6, attacks: ['leap', 'toxic', 'slam', 'summon', 'sweep'] }, { at: 0.3, attacks: ['slam', 'charge', 'barrage', 'leap', 'roar', 'slam'] }] },
];
IF.BOSS = Object.fromEntries(IF.BOSSES.map((b) => [b.id, b]));
IF.BOSS_EVERY = 5; // a boss guards every 5th section

/* ---------------- BIOMES ----------------
 * Each biome lasts several sections and is rendered procedurally from these parameters. */
IF.BIOMES = [
  { id: 'village', name: 'Abandoned Village', sky: ['#1a1d26', '#4b3e3a', '#a0644a'], fog: 'rgba(120,100,90,0.18)', ground: '#2b2622', groundTop: '#4a3f33', far: 'hills', mid: 'cottages', props: ['cart', 'barrel', 'fence', 'crate', 'well'], weather: 'embers', light: '#ff9a55', military: 0.0, music: 0 },
  { id: 'forest', name: 'The Dark Forest', sky: ['#0b1210', '#1d2a24', '#3e4a3c'], fog: 'rgba(90,120,100,0.22)', ground: '#1c1f18', groundTop: '#2f3a25', far: 'pines', mid: 'deadtrees', props: ['log', 'stump', 'rock', 'fence'], weather: 'spores', light: '#9ad1a0', military: 0.0, music: 1 },
  { id: 'castle', name: 'Ruined Castle', sky: ['#120f1a', '#2d2338', '#6a4a5a'], fog: 'rgba(110,90,120,0.2)', ground: '#26232a', groundTop: '#4b4650', far: 'castle', mid: 'ramparts', props: ['rubble', 'banner', 'barrel', 'crate', 'brazier'], weather: 'ash', light: '#ff7a3a', military: 0.0, music: 0 },
  { id: 'highway', name: 'Overgrown Highway', sky: ['#1b1d22', '#3c4148', '#8a7a62'], fog: 'rgba(130,125,110,0.18)', ground: '#23242a', groundTop: '#3a3c42', far: 'overpass', mid: 'billboards', props: ['car', 'barrier', 'tyres', 'cone', 'car'], weather: 'dust', light: '#ffc27a', military: 0.15, music: 2 },
  { id: 'checkpoint', name: 'Military Checkpoint', sky: ['#14171a', '#2e3539', '#5d5a4e'], fog: 'rgba(110,115,105,0.2)', ground: '#25261f', groundTop: '#3d3f31', far: 'hills', mid: 'watchtowers', props: ['sandbags', 'barrier', 'crate', 'jeep', 'wire'], weather: 'rain', light: '#d9e6ff', military: 0.45, music: 2 },
  { id: 'city', name: 'Destroyed City', sky: ['#0f1116', '#2a2b33', '#7a4a36'], fog: 'rgba(120,100,90,0.24)', ground: '#1f1f22', groundTop: '#38383d', far: 'skyline', mid: 'ruins', props: ['car', 'rubble', 'bus', 'barrel', 'hydrant'], weather: 'ash', light: '#ff8040', military: 0.15, music: 2 },
  { id: 'battlefield', name: 'War-Torn Battlefield', sky: ['#17120f', '#3a2a20', '#8a4a2a'], fog: 'rgba(140,100,70,0.25)', ground: '#2a2119', groundTop: '#43352a', far: 'smoke', mid: 'trenches', props: ['tank', 'wire', 'sandbags', 'crater', 'crate'], weather: 'embers', light: '#ff7030', military: 0.4, music: 3 },
  { id: 'base', name: 'Abandoned Military Base', sky: ['#111418', '#262d33', '#4a5257'], fog: 'rgba(100,110,115,0.2)', ground: '#22252a', groundTop: '#3a3f45', far: 'hangars', mid: 'fences', props: ['jeep', 'crate', 'barrels', 'sandbags', 'container'], weather: 'rain', light: '#c9d9ff', military: 0.55, music: 3 },
  { id: 'industrial', name: 'Infested Industrial Works', sky: ['#121010', '#2e2420', '#5a3a26'], fog: 'rgba(130,100,70,0.26)', ground: '#211d1a', groundTop: '#3b332c', far: 'chimneys', mid: 'pipes', props: ['barrels', 'container', 'crate', 'pallet', 'barrel'], weather: 'ash', light: '#ffa040', military: 0.2, music: 3 },
  { id: 'bunker', name: 'Underground Bunker', sky: ['#0b0c0d', '#16191b', '#1f2427'], fog: 'rgba(60,80,70,0.3)', ground: '#1a1c1e', groundTop: '#2f3337', far: 'bunkerwall', mid: 'bunkerpipes', props: ['crate', 'barrels', 'sandbags', 'locker', 'container'], weather: 'dust', light: '#7affb0', military: 0.5, indoor: true, music: 4 },
  { id: 'lab', name: 'Abandoned Laboratory', sky: ['#080c0e', '#11201f', '#1a2f2c'], fog: 'rgba(60,140,120,0.22)', ground: '#151a1b', groundTop: '#2a3536', far: 'labwall', mid: 'tanks', props: ['tank', 'crate', 'locker', 'barrels', 'gurney'], weather: 'spores', light: '#4affc8', military: 0.3, indoor: true, music: 4 },
  { id: 'settlement', name: 'Destroyed Settlement', sky: ['#130f12', '#30232a', '#6a3a3a'], fog: 'rgba(120,90,90,0.22)', ground: '#251f1f', groundTop: '#3e3333', far: 'hills', mid: 'shacks', props: ['barricade', 'barrel', 'cart', 'tyres', 'crate'], weather: 'rain', light: '#ff8a6a', military: 0.25, music: 1 },
];
IF.BIOME = Object.fromEntries(IF.BIOMES.map((b) => [b.id, b]));
IF.SECTIONS_PER_BIOME = 3;

/* ---------------- SKILL TREES ----------------
 * effect: stats added per rank.  req: [nodeId, rank] prerequisite.  ability: unlocks an active special. */
IF.SKILL_TREES = [
  { id: 'melee', name: 'Blade', color: '#d24a3a', nodes: [
    { id: 'm_edge', name: 'Honed Edge', desc: '+6% melee damage per rank', max: 5, effect: { meleeDmg: 0.06 } },
    { id: 'm_tempo', name: 'Battle Tempo', desc: '+5% attack speed per rank', max: 3, effect: { attackSpeed: 0.05 }, req: ['m_edge', 2] },
    { id: 'm_crit', name: 'Find the Gap', desc: '+3% melee crit chance per rank', max: 3, effect: { meleeCrit: 0.03 }, req: ['m_edge', 2] },
    { id: 'm_guard', name: 'Iron Guard', desc: '+10% block efficiency per rank', max: 3, effect: { blockEff: 0.1 }, req: ['m_tempo', 1] },
    { id: 'm_heavy', name: 'Crushing Blows', desc: '+15% heavy attack damage per rank', max: 3, effect: { heavyDmg: 0.15 }, req: ['m_crit', 1] },
    { id: 'm_combo', name: 'Flowing Steel', desc: 'Combo finisher deals +30% damage per rank', max: 2, effect: { comboDmg: 0.3 }, req: ['m_heavy', 2] },
  ] },
  { id: 'firearms', name: 'Firearms', color: '#e0a03a', nodes: [
    { id: 'f_cal', name: 'Heavy Calibre', desc: '+6% firearm damage per rank', max: 5, effect: { gunDmg: 0.06 } },
    { id: 'f_aim', name: 'Steady Aim', desc: '-12% spread per rank', max: 3, effect: { accuracy: 0.12 }, req: ['f_cal', 1] },
    { id: 'f_reload', name: 'Speed Loader', desc: '+10% reload speed per rank', max: 3, effect: { reloadSpeed: 0.1 }, req: ['f_cal', 2] },
    { id: 'f_mag', name: 'Deep Pockets', desc: '+15% magazine & ammo capacity per rank', max: 3, effect: { magSize: 0.15, ammoCap: 0.15 }, req: ['f_reload', 1] },
    { id: 'f_crit', name: 'Headhunter', desc: '+4% firearm crit, +15% crit damage per rank', max: 3, effect: { gunCrit: 0.04, critDmg: 0.15 }, req: ['f_aim', 2] },
    { id: 'f_recoil', name: 'Recoil Control', desc: '-20% recoil per rank', max: 2, effect: { recoilCtl: 0.2 }, req: ['f_crit', 1] },
  ] },
  { id: 'survival', name: 'Survival', color: '#4ab36a', nodes: [
    { id: 's_vigor', name: 'Vigour', desc: '+15 max health per rank', max: 5, effect: { maxHp: 15 } },
    { id: 's_plate', name: 'Thick Plate', desc: '+12 armour per rank', max: 3, effect: { armor: 12 }, req: ['s_vigor', 1] },
    { id: 's_regen', name: 'Second Wind', desc: '+0.4 health regen per rank', max: 3, effect: { regen: 0.4 }, req: ['s_vigor', 2] },
    { id: 's_stamina', name: 'Endurance', desc: '+15 stamina per rank', max: 3, effect: { stamina: 15 }, req: ['s_plate', 1] },
    { id: 's_dodge', name: 'Evasion', desc: 'Dodge invulnerability +40% longer, costs less stamina', max: 2, effect: { dodgeIframe: 0.4 }, req: ['s_stamina', 1] },
    { id: 's_stoic', name: 'Stoic', desc: '+4% damage reduction per rank', max: 3, effect: { dmgReduce: 0.04 }, req: ['s_regen', 2] },
  ] },
  { id: 'special', name: 'Valour', color: '#7a6bff', nodes: [
    { id: 'a_berserk', name: 'Berserker', desc: 'ABILITY: 8s of +50% damage, +30% speed and lifesteal', max: 1, ability: 'berserk' },
    { id: 'a_warcry', name: 'War Cry', desc: 'ABILITY: Heal 35% health and knock back nearby zombies', max: 1, ability: 'warcry', req: ['a_berserk', 1] },
    { id: 'a_nova', name: 'Holy Nova', desc: 'ABILITY: Explosive burst of radiant fire around the knight', max: 1, ability: 'nova', req: ['a_berserk', 1] },
    { id: 'a_charge', name: 'Crusader Charge', desc: 'ABILITY: Unstoppable armoured dash that tramples everything', max: 1, ability: 'charge', req: ['a_warcry', 1] },
    { id: 'a_cool', name: 'Zeal', desc: '-12% ability cooldown per rank', max: 3, effect: { abilityCd: 0.12 }, req: ['a_berserk', 1] },
    { id: 'a_power', name: 'Conviction', desc: '+20% ability power per rank', max: 3, effect: { abilityPow: 0.2 }, req: ['a_cool', 1] },
  ] },
];
IF.SKILL_NODE = {};
for (const t of IF.SKILL_TREES) for (const n of t.nodes) IF.SKILL_NODE[n.id] = Object.assign(n, { tree: t.id });

IF.ABILITIES = {
  berserk: { name: 'Berserker', cd: 30, icon: 'B', color: '#ff3d3d' },
  warcry: { name: 'War Cry', cd: 28, icon: 'W', color: '#4ab36a' },
  nova: { name: 'Holy Nova', cd: 22, icon: 'N', color: '#ffd36b' },
  charge: { name: 'Crusader Charge', cd: 14, icon: 'C', color: '#4a9cff' },
};

/* ---------------- ACHIEVEMENTS ---------------- */
IF.ACHIEVEMENTS = [
  { id: 'first_blood', name: 'First Blood', desc: 'Kill your first zombie', stat: 'kills', target: 1, reward: { gold: 25 } },
  { id: 'kill100', name: 'Centurion', desc: 'Kill 100 zombies', stat: 'kills', target: 100, reward: { gold: 150 } },
  { id: 'kill1000', name: 'Thousand Graves', desc: 'Kill 1,000 zombies', stat: 'kills', target: 1000, reward: { gold: 800, shards: 3 } },
  { id: 'kill10000', name: 'Extinction Event', desc: 'Kill 10,000 zombies', stat: 'kills', target: 10000, reward: { gold: 5000, cores: 3 } },
  { id: 'sections10', name: 'Long Road', desc: 'Complete 10 sections in total', stat: 'sections', target: 10, reward: { gold: 120 } },
  { id: 'sections100', name: 'The Endless March', desc: 'Complete 100 sections in total', stat: 'sections', target: 100, reward: { gold: 1500, shards: 5 } },
  { id: 'run10', name: 'Survivor', desc: 'Reach section 10 in a single run', stat: 'bestSection', target: 10, reward: { gold: 300, shards: 1 } },
  { id: 'run25', name: 'Last Light', desc: 'Reach section 25 in a single run', stat: 'bestSection', target: 25, reward: { gold: 1500, cores: 1 } },
  { id: 'boss1', name: 'Kingslayer Apprentice', desc: 'Defeat your first boss', stat: 'bosses', target: 1, reward: { gold: 200, shards: 1 } },
  { id: 'boss10', name: 'Tyrant\'s Bane', desc: 'Defeat 10 bosses', stat: 'bosses', target: 10, reward: { gold: 2000, cores: 2 } },
  { id: 'distance', name: 'Ten Leagues', desc: 'Travel 10,000 metres in total', stat: 'distance', target: 10000, reward: { gold: 400 } },
  { id: 'legendary', name: 'Legend Forged', desc: 'Obtain a Legendary item', stat: 'legendaries', target: 1, reward: { shards: 2 } },
  { id: 'mythic', name: 'Touched by Myth', desc: 'Obtain a Mythic item', stat: 'mythics', target: 1, reward: { cores: 2 } },
  { id: 'arsenal', name: 'Walking Arsenal', desc: 'Unlock 15 different weapons', stat: 'weaponTypes', target: 15, reward: { gold: 600, shards: 2 } },
  { id: 'allweapons', name: 'Master-at-Arms', desc: 'Unlock every weapon', stat: 'weaponTypes', target: IF.WEAPONS.length, reward: { gold: 5000, cores: 5 } },
  { id: 'fullset', name: 'Clad in Glory', desc: 'Equip a complete 6-piece armour set bonus', stat: 'fullSet', target: 1, reward: { gold: 500, shards: 2 } },
  { id: 'legendset', name: 'Obsidian Paladin', desc: 'Equip a 6-piece Legendary Obsidian or Mythic set', stat: 'legendSet', target: 1, reward: { cores: 3 } },
  { id: 'level10', name: 'Veteran', desc: 'Reach knight level 10', stat: 'level', target: 10, reward: { gold: 300 } },
  { id: 'level30', name: 'Paragon', desc: 'Reach knight level 30', stat: 'level', target: 30, reward: { gold: 3000, cores: 2 } },
  { id: 'upgrade', name: 'Blacksmith', desc: 'Upgrade equipment 25 times', stat: 'upgrades', target: 25, reward: { gold: 400, shards: 1 } },
  { id: 'survive600', name: 'Ten Minutes of Hell', desc: 'Survive 10 minutes in one run', stat: 'bestTime', target: 600, reward: { gold: 500, shards: 1 } },
];

/* ---------------- GAME MODES ----------------
 * Modes are data: they tweak generation & rules without touching systems. */
IF.MODES = {
  endless:  { id: 'endless', name: 'Endless Survival', desc: 'The main mode. Push as far as you can; every section brings a reward.', bossEvery: 5, enemyMult: 1, rewardMult: 1, regen: true },
  bossrush: { id: 'bossrush', name: 'Boss Rush', desc: 'Every section ends with a boss. Short sections, big rewards.', bossEvery: 1, enemyMult: 0.5, rewardMult: 1.5, regen: true, shortSections: true, unlock: { bosses: 1 } },
  horde:    { id: 'horde', name: 'Horde Survival', desc: 'Double the zombies, double the gold.', bossEvery: 5, enemyMult: 2, rewardMult: 1.6, regen: true, unlock: { bestSection: 5 } },
  hardcore: { id: 'hardcore', name: 'Hardcore', desc: 'No regeneration, tougher zombies, triple XP.', bossEvery: 5, enemyMult: 1.25, enemyHp: 1.4, xpMult: 3, rewardMult: 1.3, regen: false, unlock: { bestSection: 10 } },
  daily:    { id: 'daily', name: 'Daily Challenge', desc: 'Same world seed for everyone today, with a random modifier.', bossEvery: 4, enemyMult: 1.2, rewardMult: 1.4, regen: true, seeded: true },
};
IF.DAILY_MODIFIERS = [
  { id: 'glass', name: 'Glass Cannon', desc: 'You deal +60% damage but take +60% damage', apply: (m) => { m.playerDmg = 1.6; m.playerTaken = 1.6; } },
  { id: 'runners', name: 'Rush Hour', desc: 'Runners everywhere', apply: (m) => { m.forceEnemy = 'runner'; } },
  { id: 'brutes', name: 'Heavyweights', desc: 'Brutes and Armoured zombies are far more common', apply: (m) => { m.forceEnemy = 'brute'; } },
  { id: 'ammo', name: 'Scarcity', desc: 'Half ammo, double melee damage', apply: (m) => { m.ammoMult = 0.5; m.meleeMult = 2; } },
  { id: 'night', name: 'Long Night', desc: 'Dense fog, +50% rewards', apply: (m) => { m.fog = 1.8; m.rewardMult *= 1.5; } },
];
