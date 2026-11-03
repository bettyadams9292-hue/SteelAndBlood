/* Character progression — XP & levels, skill trees, stat aggregation, set bonuses, achievements. */
'use strict';

IF.prog = {
  STAT_KEYS: ['maxHp', 'armor', 'dmgReduce', 'moveSpeed', 'meleeDmg', 'gunDmg', 'allDmg', 'reloadSpeed', 'crit', 'critDmg', 'meleeCrit', 'gunCrit', 'regen', 'ammoCap', 'magSize', 'stamina', 'blockEff', 'resBlast', 'resToxic', 'attackSpeed', 'heavyDmg', 'comboDmg', 'accuracy', 'recoilCtl', 'dodgeIframe', 'abilityCd', 'abilityPow', 'goldFind', 'killHeal', 'aegis', 'critExplode', 'revive', 'stagger', 'holyAll'],
  emptyStats() { const o = {}; for (const k of this.STAT_KEYS) o[k] = 0; return o; },

  xpToNext(level) { return Math.round(90 * Math.pow(level, 1.45)); },
  addXp(amount) {
    const d = IF.save.data; d.xp += Math.round(amount); let ups = 0;
    while (d.xp >= this.xpToNext(d.level)) { d.xp -= this.xpToNext(d.level); d.level++; d.skillPoints += d.level % 5 === 0 ? 2 : 1; ups++; }
    if (ups) { d.stats.level = d.level; IF.events.emit('levelup', d.level); }
    IF.save.markDirty();
  },

  equippedItems() {
    const d = IF.save.data, out = {};
    for (const k in d.equipped) { const uid = d.equipped[k]; if (uid) out[k] = IF.loot.findItem(uid); }
    return out;
  },
  setCounts() {
    const eq = this.equippedItems(), c = {};
    for (const s of IF.ARMOUR_SLOTS) if (eq[s]) c[eq[s].set] = (c[eq[s].set] || 0) + 1;
    return c;
  },
  refreshSetStats() {
    const c = this.setCounts(), d = IF.save.data;
    for (const id in c) if (c[id] >= 6) { d.stats.fullSet = 1; if (id === 'obsidian' || id === 'mythic') d.stats.legendSet = 1; }
  },

  /* Aggregate the knight's complete stat block from every source. `boons` are run-only. */
  computeStats(boons) {
    const d = IF.save.data, st = this.emptyStats();
    const add = (obj, mult = 1) => { for (const k in obj) if (k in st) st[k] += obj[k] * mult; };
    st.maxHp = 100 + (d.level - 1) * 4; st.stamina = 100;
    const eq = this.equippedItems();
    for (const s of IF.ARMOUR_SLOTS) { const it = eq[s]; if (!it) continue; st.armor += IF.loot.armourValue(it); for (const a of it.affixes) if (a.stat in st) st[a.stat] += a.val; }
    if (eq.accessory) add(IF.loot.accessoryStats(eq.accessory));
    const counts = this.setCounts();
    for (const id in counts) { const set = IF.ARMOUR_SET[id], n = counts[id]; if (n >= 2) add(set.bonus2); if (n >= 4) add(set.bonus4); if (n >= 6) add(set.bonus6); }
    for (const id in d.skills) { const node = IF.SKILL_NODE[id]; if (node && node.effect) add(node.effect, d.skills[id]); }
    if (boons) for (const b of boons) add(b.stats);
    st.dmgReduce = Math.min(st.dmgReduce, 0.5);
    st.armorDR = st.armor / (st.armor + 260);
    st.totalDR = Math.min(0.8, 1 - (1 - st.armorDR) * (1 - st.dmgReduce));
    return st;
  },

  /* ---------- skills ---------- */
  skillRank(id) { return IF.save.data.skills[id] || 0; },
  canLearn(id) {
    const n = IF.SKILL_NODE[id], d = IF.save.data;
    if (!n || this.skillRank(id) >= n.max || d.skillPoints < 1) return false;
    if (n.req && this.skillRank(n.req[0]) < n.req[1]) return false;
    return true;
  },
  learn(id) {
    if (!this.canLearn(id)) return false; const d = IF.save.data, n = IF.SKILL_NODE[id];
    d.skills[id] = this.skillRank(id) + 1; d.skillPoints--;
    if (n.ability && !d.ability) d.ability = n.ability;
    IF.save.write(); return true;
  },
  respecCost() { return 100 + IF.save.data.level * 40; },
  respec() {
    const d = IF.save.data, c = this.respecCost(); if (d.gold < c) return false;
    let pts = 0; for (const k in d.skills) pts += d.skills[k];
    d.gold -= c; d.skills = {}; d.skillPoints += pts; d.ability = null; IF.save.write(); return true;
  },
  unlockedAbilities() { return Object.keys(IF.SKILL_NODE).filter((id) => IF.SKILL_NODE[id].ability && this.skillRank(id) > 0).map((id) => IF.SKILL_NODE[id].ability); },

  /* ---------- achievements ---------- */
  checkAchievements() {
    const d = IF.save.data;
    for (const a of IF.ACHIEVEMENTS) {
      if (d.achievements[a.id]) continue;
      if ((d.stats[a.stat] || 0) >= a.target) {
        d.achievements[a.id] = Date.now();
        const r = a.reward; d.gold += r.gold || 0; d.mats.shards += r.shards || 0; d.mats.cores += r.cores || 0;
        IF.events.emit('achievement', a); IF.save.markDirty();
      }
    }
  },
  modeUnlocked(mode) {
    const u = IF.MODES[mode].unlock; if (!u) return true; const s = IF.save.data.stats;
    for (const k in u) if ((s[k] || 0) < u[k]) return false; return true;
  },
};
