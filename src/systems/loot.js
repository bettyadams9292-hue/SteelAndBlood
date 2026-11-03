/* Loot & item system — item creation, effective stats, reward generation, upgrades, forge & salvage. */
'use strict';

IF.loot = {
  /* ---------- creation ---------- */
  makeWeapon(id, rarity, rng = IF.rng) {
    const def = IF.WEAPON[id]; const r = IF.RARITY[rarity];
    const perks = (def.fixedPerks || []).slice();
    const pool = Object.keys(IF.PERKS).filter((p) => {
      const pd = IF.PERKS[p]; if (perks.includes(p)) return false;
      if (pd.minRarity && r.index < pd.minRarity) return false;
      if (pd.for === 'any') return true;
      return pd.for === (def.slot === 'melee' ? 'melee' : 'firearm');
    });
    let n = r.perks - (def.fixedPerks ? 1 : 0);
    while (n-- > 0 && pool.length) perks.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]);
    return { uid: IF.util.uid(), id, rarity, level: 1, perks, kind: 'weapon' };
  },
  makeArmour(setId, slot, rarity, rng = IF.rng, noAffix) {
    const set = IF.ARMOUR_SET[setId], r = IF.RARITY[rarity];
    const affixes = [];
    if (!noAffix) {
      const pool = IF.AFFIXES.slice(); let n = Math.max(r.perks, r.index >= 2 ? 2 : r.index);
      while (n-- > 0 && pool.length) {
        const a = pool.splice(Math.floor(rng.next() * pool.length), 1)[0];
        const v = (a.min + (a.max - a.min) * rng.next()) * (1 + set.tier * 0.15) * r.mult;
        affixes.push({ stat: a.stat, val: +v.toFixed(3) });
      }
    }
    return { uid: IF.util.uid(), set: setId, slot, rarity, level: 1, affixes, kind: 'armour' };
  },
  makeAccessory(id, rarity) { return { uid: IF.util.uid(), id, rarity, level: 1, kind: 'accessory', affixes: [] }; },

  /* ---------- names & descriptions ---------- */
  itemName(it) {
    if (it.kind === 'weapon') return IF.WEAPON[it.id].name;
    if (it.kind === 'armour') return IF.ARMOUR_SET[it.set].name + ' ' + IF.SLOT_NAMES[it.slot];
    return IF.ACCESSORY[it.id].name;
  },
  levelMult(it) { return 1 + 0.09 * (it.level - 1); },

  /* Effective weapon stats including rarity, level, perks and the knight's stat block. */
  weaponStats(it, st) {
    const def = IF.WEAPON[it.id], r = IF.RARITY[it.rarity], P = it.perks || [];
    const melee = def.slot === 'melee'; st = st || IF.prog.emptyStats();
    let dmg = def.dmg * r.mult * this.levelMult(it);
    dmg *= 1 + (melee ? st.meleeDmg : st.gunDmg) + st.allDmg;
    let rate = def.rate * (1 + (P.includes('swift') ? 0.15 : 0) + (melee ? st.attackSpeed : 0));
    let crit = (def.crit || 0) + (P.includes('crit') ? 0.1 : 0) + st.crit + (melee ? st.meleeCrit : st.gunCrit) + (r.index >= 3 ? 0.03 : 0);
    const out = {
      def, melee, dmg, rate, crit: Math.min(crit, 0.9), critMult: (def.critMult || 1.8) + st.critDmg,
      range: def.range * (P.includes('cleave') ? 1.12 : 1), knock: def.knock * (P.includes('heavy') ? 1.5 : 1),
      perks: P, pierce: (def.pierce || 0) + (P.includes('pierce') ? 1 : 0),
      armorPierce: def.armorPierce || (def.cls === 'sniper' ? 0.7 : 0) + (r.index >= 4 ? 0.2 : 0),
      cleave: P.includes('cleave') ? 1.35 : 1,
    };
    if (!melee) {
      out.mag = Math.max(1, Math.round(def.mag * (1 + (P.includes('extmag') ? 0.35 : 0) + st.magSize)));
      out.reload = def.reload * (1 - (P.includes('quickload') ? 0.25 : 0)) / (1 + st.reloadSpeed);
      out.spread = def.spread * Math.max(0.3, 1 - st.accuracy);
      out.recoil = def.recoil * Math.max(0.3, 1 - st.recoilCtl);
      out.pellets = def.pellets || 1;
      out.splash = def.splash || 0;
    }
    out.dps = (out.dmg * (out.pellets || 1) * rate * (1 + out.crit * (out.critMult - 1)));
    return out;
  },
  armourValue(it) { const set = IF.ARMOUR_SET[it.set]; return Math.round(set.armor * IF.SLOT_ARMOUR_WEIGHT[it.slot] * IF.RARITY[it.rarity].mult * (1 + 0.1 * (it.level - 1))); },
  affixText(a) { const d = IF.AFFIX[a.stat]; if (!d) return a.stat; const v = a.val; return (d.fmt ? d.fmt(v) : '+' + Math.round(v * 100) + '%') + ' ' + d.name; },
  accessoryStats(it) { const d = IF.ACCESSORY[it.id], m = IF.RARITY[it.rarity].mult * (1 + 0.08 * (it.level - 1)), o = {}; for (const k in d.stats) o[k] = d.stats[k] * m; return o; },
  statText(k, v) {
    const names = { maxHp: 'Max Health', armor: 'Armour', regen: 'Health Regen', stamina: 'Stamina', holyAll: 'Dmg vs Elites', critDmg: 'Crit Damage' };
    if (IF.AFFIX[k] && !names[k]) return this.affixText({ stat: k, val: v });
    if (['maxHp', 'armor', 'stamina'].includes(k)) return '+' + Math.round(v) + ' ' + names[k];
    if (k === 'regen') return '+' + v.toFixed(1) + '/s Health Regen';
    return '+' + Math.round(v * 100) + '% ' + (names[k] || k);
  },

  /* ---------- reward generation ---------- */
  rollRarity(depth, rng, luck = 0, minIndex = 0) {
    const entries = IF.RARITIES.map((r, i) => {
      let w = r.w * (1 + Math.max(0, depth) * [0, 0.05, 0.11, 0.16, 0.2, 0.22][i]) * (1 + luck * i * 0.5);
      if (i === 0) w = Math.max(5, w - depth * 4);
      if (i === 5 && depth < 8 && luck < 1) w = 0;
      if (i < minIndex) w = 0;
      return { w, v: r.id };
    });
    return rng.weighted(entries);
  },
  availableSets(depth) { return IF.ARMOUR_SETS.filter((s) => s.depth <= depth); },

  /* Builds 3 distinct reward options for the end of a section.
   * Considers what the player owns: duplicates become upgrades, and slot gaps are favoured. */
  rollRewards(run, rng) {
    const d = IF.save.data, depth = run.section, boss = run.lastWasBoss;
    const luck = (boss ? 1 : 0) + (run.mode.rewardMult - 1);
    const out = [], used = new Set();
    const firstFirearm = !d.weapons.some((w) => IF.WEAPON[w.id].slot !== 'melee');
    if (firstFirearm) { // the story beat: your first firearm
      for (const id of ['pistol', 'pump', 'crossbow']) out.push(this._weaponOffer(IF.WEAPON[id], 'common', rng));
      return out;
    }
    const kinds = [];
    for (let i = 0; i < 3; i++) {
      kinds.push(rng.weighted([
        { w: 34, v: 'weapon' }, { w: 34, v: 'armour' }, { w: 6, v: 'accessory' }, { w: 12, v: 'boon' },
        { w: 8, v: 'materials' }, { w: boss ? 4 : 3, v: 'skill' },
      ]));
    }
    if (!kinds.includes('weapon') && !kinds.includes('armour')) kinds[0] = rng.chance(0.5) ? 'weapon' : 'armour';
    for (const k of kinds) {
      let offer = null;
      for (let tries = 0; tries < 8 && !offer; tries++) {
        offer = this['_' + k + 'Roll'](depth, rng, luck, boss);
        if (offer && used.has(offer.key)) offer = null;
      }
      if (!offer) offer = this._materialsRoll(depth, rng, luck, boss);
      used.add(offer.key); out.push(offer);
    }
    return out;
  },
  _weaponRoll(depth, rng, luck, boss) {
    const rarity = this.rollRarity(depth, rng, luck, boss ? 2 : 0);
    const ri = IF.RARITY[rarity].index;
    let pool = IF.WEAPONS.filter((w) => w.depth <= depth + 1 && (!w.minRarity || (ri >= w.minRarity && rng.chance(0.45))));
    // favour weapons the player has never seen
    const unseen = pool.filter((w) => !IF.save.data.seen[w.id]);
    if (unseen.length && rng.chance(0.6)) pool = unseen;
    const def = rng.pick(pool); if (!def) return null;
    return this._weaponOffer(def, def.minRarity && ri < def.minRarity ? IF.RARITIES[def.minRarity].id : rarity, rng);
  },
  _weaponOffer(def, rarity, rng) {
    const owned = IF.save.data.weapons.filter((w) => w.id === def.id).sort((a, b) => IF.RARITY[b.rarity].index - IF.RARITY[a.rarity].index)[0];
    if (owned && IF.RARITY[owned.rarity].index >= IF.RARITY[rarity].index) {
      if (owned.level >= 10 || !this.worthUpgrading(owned)) return null;
      const lv = Math.min(10, owned.level + (IF.RARITY[rarity].index >= 2 ? 2 : 1));
      return { type: 'upgrade', key: 'up_' + owned.uid, target: owned.uid, levels: lv - owned.level, item: owned, rarity: owned.rarity };
    }
    const item = this.makeWeapon(def.id, rarity, rng);
    return { type: 'weapon', key: 'w_' + def.id, item, rarity, isNew: !IF.save.data.seen[def.id] };
  },
  _armourRoll(depth, rng, luck, boss) {
    const sets = this.availableSets(depth); if (!sets.length) return null;
    // newest sets are most likely; older sets still drop for set completion
    const set = rng.weighted(sets.map((s, i) => ({ w: 1 + i * 1.6, v: s })));
    const d = IF.save.data;
    const emptySlots = IF.ARMOUR_SLOTS.filter((s) => !d.equipped[s]);
    const slot = emptySlots.length && rng.chance(0.5) ? rng.pick(emptySlots) : rng.pick(IF.ARMOUR_SLOTS);
    const rarity = this.rollRarity(depth, rng, luck, boss ? 2 : 0);
    const owned = d.armour.filter((a) => a.set === set.id && a.slot === slot).sort((a, b) => IF.RARITY[b.rarity].index - IF.RARITY[a.rarity].index)[0];
    if (owned && IF.RARITY[owned.rarity].index >= IF.RARITY[rarity].index) {
      if (owned.level >= 10 || !this.worthUpgrading(owned)) return null;
      return { type: 'upgrade', key: 'up_' + owned.uid, target: owned.uid, levels: 1 + (IF.RARITY[rarity].index >= 2 ? 1 : 0), item: owned, rarity: owned.rarity };
    }
    const item = this.makeArmour(set.id, slot, rarity, rng);
    const cur = d.armour.find((a) => a.uid === d.equipped[slot]);
    if (cur && this.armourValue(item) < this.armourValue(cur) * 0.7 && set.id !== cur.set && rng.chance(0.8)) return null;
    return { type: 'armour', key: 'a_' + set.id + slot, item, rarity };
  },
  _accessoryRoll(depth, rng, luck, boss) {
    const pool = IF.ACCESSORIES.filter((a) => a.depth <= depth); if (!pool.length) return null;
    const def = rng.pick(pool); const rarity = this.rollRarity(depth, rng, luck, 1);
    const owned = IF.save.data.accessories.find((a) => a.id === def.id && IF.RARITY[a.rarity].index >= IF.RARITY[rarity].index);
    if (owned) { if (owned.level >= 10 || !this.worthUpgrading(owned)) return null; return { type: 'upgrade', key: 'up_' + owned.uid, target: owned.uid, levels: 1, item: owned, rarity: owned.rarity }; }
    return { type: 'accessory', key: 'acc_' + def.id, item: this.makeAccessory(def.id, rarity), rarity };
  },
  BOONS: [
    { id: 'blessed', name: 'Blessed Steel', desc: '+20% melee damage for this run', stats: { meleeDmg: 0.2 }, rarity: 'rare' },
    { id: 'powder', name: 'Black Powder', desc: '+20% firearm damage for this run', stats: { gunDmg: 0.2 }, rarity: 'rare' },
    { id: 'medic', name: "Field Surgeon's Kit", desc: 'Heal fully and +25 max health for this run', stats: { maxHp: 25 }, heal: 1, rarity: 'uncommon' },
    { id: 'cache', name: 'Ammunition Cache', desc: 'Refill all ammo, +30% ammo capacity for this run', stats: { ammoCap: 0.3 }, ammo: true, rarity: 'uncommon' },
    { id: 'mark', name: "Hunter's Mark", desc: '+10% critical chance for this run', stats: { crit: 0.1 }, rarity: 'rare' },
    { id: 'boots', name: 'Pilgrim\'s Stride', desc: '+12% movement speed for this run', stats: { moveSpeed: 0.12 }, rarity: 'uncommon' },
    { id: 'aegis', name: 'Shield of Faith', desc: '+10% damage reduction for this run', stats: { dmgReduce: 0.1 }, rarity: 'epic' },
    { id: 'zeal', name: 'Fervour', desc: '+12% attack speed & -25% ability cooldown this run', stats: { attackSpeed: 0.12, abilityCd: 0.25 }, rarity: 'epic' },
    { id: 'vamp', name: 'Crimson Chalice', desc: 'Every kill heals 3 HP for this run', stats: { killHeal: 3 }, rarity: 'epic' },
  ],
  _boonRoll(depth, rng) { const b = rng.pick(this.BOONS); return { type: 'boon', key: 'b_' + b.id, boon: b, rarity: b.rarity }; },
  _materialsRoll(depth, rng, luck, boss) {
    const m = { gold: Math.round((60 + depth * 22) * (0.8 + rng.next() * 0.5) * (1 + luck * 0.5)), parts: 3 + Math.floor(depth * 0.8 + rng.next() * 4), steel: 3 + Math.floor(depth * 0.8 + rng.next() * 4), shards: depth >= 5 && rng.chance(0.35 + luck * 0.2) ? 1 : 0, cores: depth >= 12 && rng.chance(0.08 + luck * 0.1) ? 1 : 0 };
    return { type: 'materials', key: 'mat' + rng.next(), mats: m, rarity: m.cores ? 'legendary' : m.shards ? 'epic' : 'uncommon' };
  },
  _skillRoll() { return { type: 'skill', key: 'skill', points: 1, rarity: 'epic' }; },

  /* Apply a chosen reward to the profile (and the live run where relevant). */
  claim(offer, run) {
    const d = IF.save.data;
    switch (offer.type) {
      case 'weapon': {
        const it = offer.item; d.weapons.push(it); d.seen[it.id] = true;
        const slot = IF.WEAPON[it.id].slot;
        const cur = d.weapons.find((w) => w.uid === d.equipped[slot]);
        if (!cur || this.weaponStats(it).dps >= this.weaponStats(cur).dps) { d.equipped[slot] = it.uid; if (run) run.player && run.player.equipWeapon(slot, it); }
        break;
      }
      case 'armour': {
        const it = offer.item; d.armour.push(it);
        const cur = d.armour.find((a) => a.uid === d.equipped[it.slot]);
        if (!cur || this.armourValue(it) + it.affixes.length * 4 >= this.armourValue(cur) + cur.affixes.length * 4) d.equipped[it.slot] = it.uid;
        break;
      }
      case 'accessory': { d.accessories.push(offer.item); if (!d.equipped.accessory) d.equipped.accessory = offer.item.uid; break; }
      case 'upgrade': { const it = this.findItem(offer.target); if (it) { it.level = Math.min(10, it.level + offer.levels); d.stats.upgrades++; } break; }
      case 'boon': if (run) { run.boons.push(offer.boon); if (offer.boon.ammo) run.refillAmmo = true; if (offer.boon.heal) run.healFull = true; } break;
      case 'materials': { const m = offer.mats; d.gold += m.gold; d.mats.parts += m.parts; d.mats.steel += m.steel; d.mats.shards += m.shards; d.mats.cores += m.cores; break; }
      case 'skill': d.skillPoints += offer.points; break;
    }
    const ri = IF.RARITY[offer.rarity] ? IF.RARITY[offer.rarity].index : 0;
    if (['weapon', 'armour', 'accessory'].includes(offer.type)) { if (ri === 4) d.stats.legendaries++; if (ri === 5) { d.stats.mythics++; d.stats.legendaries++; } }
    d.stats.weaponTypes = Object.keys(d.seen).length;
    IF.prog.refreshSetStats();
    IF.save.markDirty();
  },
  /* An owned item is worth upgrading if it's equipped, or at least competitive with what is. */
  worthUpgrading(it) {
    const d = IF.save.data, slot = it.kind === 'weapon' ? IF.WEAPON[it.id].slot : it.kind === 'armour' ? it.slot : 'accessory';
    if (d.equipped[slot] === it.uid) return true;
    const cur = this.findItem(d.equipped[slot]); if (!cur) return true;
    if (it.kind === 'weapon') return this.weaponStats(it).dps >= this.weaponStats(cur).dps * 0.85;
    if (it.kind === 'armour') return this.armourValue(it) >= this.armourValue(cur) * 0.85;
    return true;
  },
  findItem(uid) { const d = IF.save.data; return d.weapons.find((i) => i.uid === uid) || d.armour.find((i) => i.uid === uid) || d.accessories.find((i) => i.uid === uid); },

  /* ---------- blacksmith ---------- */
  upgradeCost(it) {
    const ri = IF.RARITY[it.rarity].index, L = it.level, f = 1 + ri * 0.45;
    const c = { gold: Math.round(35 * Math.pow(L, 1.55) * f) };
    if (it.kind === 'weapon') c.parts = Math.round(2 * L * f); else c.steel = Math.round(2 * L * f);
    return c;
  },
  ascendCost(it) { const ri = IF.RARITY[it.rarity].index; if (ri >= 5) return null; return ri <= 1 ? { gold: 250 * (ri + 1), shards: 1 } : ri === 2 ? { gold: 900, shards: 3 } : ri === 3 ? { gold: 2500, shards: 6 } : { gold: 6000, cores: 3 }; },
  canAfford(c) { const d = IF.save.data; return (c.gold || 0) <= d.gold && (c.parts || 0) <= d.mats.parts && (c.steel || 0) <= d.mats.steel && (c.shards || 0) <= d.mats.shards && (c.cores || 0) <= d.mats.cores; },
  pay(c) { const d = IF.save.data; d.gold -= c.gold || 0; d.mats.parts -= c.parts || 0; d.mats.steel -= c.steel || 0; d.mats.shards -= c.shards || 0; d.mats.cores -= c.cores || 0; },
  upgrade(it) { if (it.level >= 10) return false; const c = this.upgradeCost(it); if (!this.canAfford(c)) return false; this.pay(c); it.level++; IF.save.data.stats.upgrades++; IF.prog.refreshSetStats(); IF.save.write(); return true; },
  ascend(it) {
    const c = this.ascendCost(it); if (!c || !this.canAfford(c)) return false; this.pay(c);
    const next = IF.RARITIES[IF.RARITY[it.rarity].index + 1];
    if (it.kind === 'weapon') { const fresh = this.makeWeapon(it.id, next.id); for (const p of fresh.perks) if (!it.perks.includes(p) && it.perks.length < next.perks + (IF.WEAPON[it.id].fixedPerks ? 1 : 0)) it.perks.push(p); }
    else if (it.kind === 'armour') { const fresh = this.makeArmour(it.set, it.slot, next.id); const have = new Set(it.affixes.map((a) => a.stat)); for (const a of fresh.affixes) if (!have.has(a.stat) && it.affixes.length < Math.max(next.perks, 2)) it.affixes.push(a); }
    it.rarity = next.id; const d = IF.save.data; if (next.index === 4) d.stats.legendaries++; if (next.index === 5) d.stats.mythics++;
    IF.save.write(); return true;
  },
  salvageValue(it) { const ri = IF.RARITY[it.rarity].index; return { gold: 15 * (ri + 1) * it.level, parts: it.kind === 'weapon' ? 2 + ri * 2 : 0, steel: it.kind !== 'weapon' ? 2 + ri * 2 : 0, shards: ri >= 3 ? ri - 2 : 0 }; },
  salvage(it) {
    const d = IF.save.data; if (Object.values(d.equipped).includes(it.uid)) return false;
    const v = this.salvageValue(it); d.gold += v.gold; d.mats.parts += v.parts; d.mats.steel += v.steel; d.mats.shards += v.shards;
    for (const k of ['weapons', 'armour', 'accessories']) d[k] = d[k].filter((x) => x.uid !== it.uid);
    IF.save.write(); return true;
  },
  forgeCost(kind) { const b = Math.max(1, IF.save.data.stats.bestSection); return kind === 'weapon' ? { gold: 200 + b * 30, parts: 10 + b } : { gold: 200 + b * 30, steel: 10 + b }; },
  forge(kind, slot) {
    const c = this.forgeCost(kind); if (!this.canAfford(c)) return null; this.pay(c);
    const depth = Math.max(1, IF.save.data.stats.bestSection), rng = IF.rng; let item;
    if (kind === 'weapon') { const pool = IF.WEAPONS.filter((w) => w.depth <= depth && !w.minRarity); const def = rng.pick(pool); item = this.makeWeapon(def.id, this.rollRarity(depth, rng, 0.3)); IF.save.data.weapons.push(item); IF.save.data.seen[def.id] = true; }
    else { const sets = this.availableSets(depth); const set = sets[sets.length - 1 - Math.floor(rng.next() * Math.min(2, sets.length))]; item = this.makeArmour(set.id, slot || rng.pick(IF.ARMOUR_SLOTS), this.rollRarity(depth, rng, 0.3)); IF.save.data.armour.push(item); }
    const ri = IF.RARITY[item.rarity].index; if (ri === 4) IF.save.data.stats.legendaries++; if (ri === 5) IF.save.data.stats.mythics++;
    IF.save.data.stats.weaponTypes = Object.keys(IF.save.data.seen).length; IF.save.write(); return item;
  },
};
