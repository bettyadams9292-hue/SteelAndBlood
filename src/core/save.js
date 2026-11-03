/* Persistence — versioned save with checksum, validation, migration and backup recovery.
 * Write procedure: serialise -> write to staging key -> read back & verify -> rotate
 * current save into the backup slot -> commit. A corrupt main save falls back to backup. */
'use strict';

IF.SAVE_KEY = 'steelblood_save';
IF.SAVE_VERSION = 1;

IF.save = {
  data: null, dirty: false, lastWrite: 0, storageOk: true, recovered: null,

  defaults() {
    return {
      version: IF.SAVE_VERSION, created: Date.now(),
      level: 1, xp: 0, skillPoints: 0, skills: {}, ability: null,
      gold: 0, mats: { parts: 0, steel: 0, shards: 0, cores: 0 },
      weapons: [], armour: [], accessories: [],
      equipped: { melee: null, primary: null, secondary: null, helmet: null, chest: null, gauntlets: null, legs: null, boots: null, shield: null, cape: null, accessory: null },
      achievements: {}, newAchievements: [],
      stats: { kills: 0, sections: 0, bosses: 0, distance: 0, time: 0, runs: 0, deaths: 0, bestSection: 0, bestDistance: 0, bestTime: 0, bestKills: 0, legendaries: 0, mythics: 0, upgrades: 0, weaponTypes: 0, fullSet: 0, legendSet: 0, level: 1, shots: 0, killsBy: {} },
      seen: {}, // weapon ids ever obtained
      tutorialDone: false, dailyBest: {},
      companions: { owned: { rex: { lvl: 1 } }, active: ['rex'], slots: 2, order: 'follow' },
      appearance: { name: 'Sir Aldric', tabard: 'auto', emblem: 'cross', cross: 'auto', cape: 'auto', plume: 'auto', helm: 'auto', finish: 'auto' },
      settings: { music: 0.55, sfx: 0.8, gore: 'full', shake: true, dmgNumbers: true, particles: 'high', touch: 'auto', touchSize: 1, touchOpacity: 0.5, keys: {}, pad: {}, showFps: false, mode: 'endless', graphics: 'auto' },
    };
  },

  checksum(str) { return IF.hashString(str).toString(36); },

  _read(key) {
    try {
      const raw = localStorage.getItem(key); if (!raw) return null;
      const wrap = JSON.parse(raw);
      if (!wrap || typeof wrap.body !== 'string' || wrap.sum !== this.checksum(wrap.body)) return { corrupt: true };
      return { data: JSON.parse(wrap.body) };
    } catch (e) { return { corrupt: true }; }
  },

  load() {
    let res = null;
    try { localStorage.setItem('__if_test', '1'); localStorage.removeItem('__if_test'); } catch (e) { this.storageOk = false; }
    if (this.storageOk) {
      res = this._read(IF.SAVE_KEY);
      if (!res || res.corrupt) {
        const bak = this._read(IF.SAVE_KEY + '_backup');
        if (bak && bak.data) { this.recovered = res && res.corrupt ? 'Save file was damaged — restored from backup.' : null; res = bak; }
        else if (res && res.corrupt) { this.recovered = 'Save file was damaged and no backup existed — starting fresh.'; res = null; }
      }
    }
    this.data = this.validate(res && res.data);
    if (!this.data.weapons.length) this.grantStarter();
    return this.data;
  },

  /* Deep-merge with defaults, coerce types, drop references to unknown items. Also migration point. */
  validate(d) {
    const def = this.defaults();
    if (!d || typeof d !== 'object') return def;
    const merge = (base, over) => {
      for (const k in base) {
        if (!(k in over) || over[k] === undefined) continue;
        if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) { if (over[k] && typeof over[k] === 'object') merge(base[k], over[k]); }
        else if (Array.isArray(base[k])) { if (Array.isArray(over[k])) base[k] = over[k]; }
        else if (typeof base[k] === typeof over[k] || base[k] === null) base[k] = over[k];
      }
      return base;
    };
    const out = merge(def, d);
    // carry over dynamic maps fully
    for (const k of ['skills', 'achievements', 'seen', 'dailyBest']) if (d[k] && typeof d[k] === 'object') out[k] = d[k];
    out.appearance.name = String(out.appearance.name || 'Sir Aldric').slice(0, 22);
    if (d.stats && d.stats.killsBy) out.stats.killsBy = d.stats.killsBy;
    if (d.settings) { if (d.settings.keys) out.settings.keys = d.settings.keys; if (d.settings.pad) out.settings.pad = d.settings.pad; }
    // sanitise items
    out.weapons = out.weapons.filter((w) => w && IF.WEAPON[w.id] && IF.RARITY[w.rarity]);
    out.armour = out.armour.filter((a) => a && IF.ARMOUR_SET[a.set] && IF.ARMOUR_SLOTS.includes(a.slot) && IF.RARITY[a.rarity]);
    out.accessories = out.accessories.filter((a) => a && IF.ACCESSORY[a.id] && IF.RARITY[a.rarity]);
    for (const list of [out.weapons, out.armour, out.accessories]) for (const it of list) { it.level = IF.util.clamp(it.level | 0, 1, 10); if (!it.uid) it.uid = IF.util.uid(); if (!Array.isArray(it.perks)) it.perks = []; if (!Array.isArray(it.affixes)) it.affixes = []; }
    const all = new Set([...out.weapons, ...out.armour, ...out.accessories].map((i) => i.uid));
    for (const k in out.equipped) if (out.equipped[k] && !all.has(out.equipped[k])) out.equipped[k] = null;
    for (const k in out.skills) if (!IF.SKILL_NODE[k]) delete out.skills[k];
    if (d.companions && typeof d.companions === 'object' && d.companions.owned) {
      const c = d.companions, owned = {}; for (const k in c.owned) if (IF.COMPANION && IF.COMPANION[k]) owned[k] = { lvl: IF.util.clamp(c.owned[k].lvl | 0, 1, 10) };
      if (!owned.rex) owned.rex = { lvl: 1 };
      out.companions = { owned, slots: IF.util.clamp(c.slots | 0, 2, 3), order: c.order === 'hold' ? 'hold' : 'follow', active: (Array.isArray(c.active) ? c.active : []).filter((k) => owned[k]).slice(0, 3) };
    }
    out.level = Math.max(1, out.level | 0); out.gold = Math.max(0, out.gold | 0);
    out.version = IF.SAVE_VERSION;
    return out;
  },

  grantStarter() {
    const d = this.data;
    const sword = IF.loot.makeWeapon('iron_sword', 'common');
    d.weapons.push(sword); d.equipped.melee = sword.uid; d.seen.iron_sword = true;
    for (const slot of ['helmet', 'chest', 'legs', 'boots', 'shield']) {
      const p = IF.loot.makeArmour('worn_iron', slot, 'common', IF.rng, true); d.armour.push(p); d.equipped[slot] = p.uid;
    }
    d.stats.weaponTypes = Object.keys(d.seen).length;
  },

  markDirty() { this.dirty = true; },
  /* Atomic-ish write with verification and backup rotation. */
  write() {
    if (!this.storageOk || !this.data) return false;
    try {
      const body = JSON.stringify(this.data);
      const wrap = JSON.stringify({ v: IF.SAVE_VERSION, sum: this.checksum(body), body, at: Date.now() });
      localStorage.setItem(IF.SAVE_KEY + '_staging', wrap);
      const check = this._read(IF.SAVE_KEY + '_staging');
      if (!check || !check.data) throw new Error('verify failed');
      const prev = localStorage.getItem(IF.SAVE_KEY);
      if (prev && this._read(IF.SAVE_KEY)?.data) localStorage.setItem(IF.SAVE_KEY + '_backup', prev);
      localStorage.setItem(IF.SAVE_KEY, wrap);
      localStorage.removeItem(IF.SAVE_KEY + '_staging');
      this.dirty = false; this.lastWrite = performance.now();
      return true;
    } catch (e) { console.warn('Save failed', e); IF.events.emit('toast', { text: 'Warning: progress could not be saved', bad: true }); return false; }
  },
  tick() { if (this.dirty && performance.now() - this.lastWrite > 4000) this.write(); },
  reset() { try { localStorage.removeItem(IF.SAVE_KEY); localStorage.removeItem(IF.SAVE_KEY + '_backup'); } catch (e) {} this.data = this.defaults(); this.grantStarter(); this.write(); },
  exportString() { return btoa(unescape(encodeURIComponent(JSON.stringify(this.data)))); },
  importString(s) { const d = JSON.parse(decodeURIComponent(escape(atob(s.trim())))); this.data = this.validate(d); this.write(); },
};
