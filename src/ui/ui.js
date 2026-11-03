/* User interface — DOM-based menus layered over the canvas.
 * Every screen is a render function returning HTML; buttons use data-act attributes.
 * Gamepad/keyboard navigation: spatial focus movement across [data-nav] elements. */
'use strict';

IF.ui = {
  root: null, screen: null, stack: [], sel: {}, focusIdx: 0, navCooldown: 0,

  init() {
    this.root = document.getElementById('ui');
    this.toastEl = document.getElementById('toasts');
    this.root.addEventListener('click', (e) => { const el = e.target.closest('[data-act]'); if (el && !el.disabled) { this.act(el.dataset.act, el.dataset, el); } });
    this.root.addEventListener('mouseover', (e) => { const el = e.target.closest('[data-act]'); if (el && el !== this._hover) { this._hover = el; IF.audio.ui('hover'); } });
    this.root.addEventListener('input', (e) => { const el = e.target; if (el.dataset.app === 'name') { IF.save.data.appearance.name = el.value.slice(0, 22) || 'Sir Aldric'; IF.save.markDirty(); return; } if (el.dataset.setting) this.setSetting(el.dataset.setting, el.type === 'range' ? parseFloat(el.value) : el.value); });
    setInterval(() => this.navPoll(), 16);
    this.show('splash');
    if (IF.save.recovered) setTimeout(() => this.toast(IF.save.recovered, 'bad'), 800);
  },
  esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); },

  show(name, push) {
    if (push && this.screen) this.stack.push(this.screen); else if (!push) this.stack = [];
    this.screen = name; this.render();
  },
  back() {
    IF.audio.ui('back');
    if (this.screen === 'reward' || this.screen === 'death' || this.screen === 'splash') return;
    if (this.stack.length) { this.screen = this.stack.pop(); this.render(); return; }
    if (IF.game.state === 'paused') { IF.game.resume(); return; }
    if (this.screen && this.screen !== 'menu' && !IF.game.run) this.show('menu');
  },
  render() {
    const s = this.screen; this.root.className = s ? 'scr-' + s : '';
    if (!s) { this.root.innerHTML = ''; return; }
    const fn = this['r_' + s], panel = !['splash', 'menu', 'pause', 'death', 'reward'].includes(s);
    this.root.innerHTML = '<div class="scr' + (panel ? ' panel' : '') + '">' + (fn ? fn.call(this) : '') + '</div>';
    this.afterRender && this.afterRender(); this.afterRender = null;
    this.focusIdx = 0; this.applyFocus(true);
  },
  hud(on) { document.getElementById('touch').style.display = on && this.touchEnabled() ? 'block' : 'none'; },
  updateHud() {},
  touchEnabled() { const m = IF.save.data.settings.touch; return m === 'on' || (m === 'auto' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)); },

  toast(text, kind, sub) {
    const el = document.createElement('div'); el.className = 'toast ' + (kind || '');
    el.innerHTML = '<b>' + this.esc(text) + '</b>' + (sub ? '<span>' + this.esc(sub) + '</span>' : '');
    while (this.toastEl.children.length >= 4) this.toastEl.firstChild.remove();
    this.toastEl.appendChild(el); setTimeout(() => el.classList.add('out'), 3200); setTimeout(() => el.remove(), 3800);
    if (kind === 'ach') IF.audio.reward(3);
  },

  /* ---------- shared fragments ---------- */
  currency() {
    const d = IF.save.data, m = d.mats;
    return '<div class="cur"><span class="g">⦿ ' + IF.util.fmt(d.gold) + '</span><span title="Weapon Parts">⚙ ' + m.parts + '</span><span title="Armour Steel">⛨ ' + m.steel + '</span><span class="sh" title="Obsidian Shards">◆ ' + m.shards + '</span><span class="co" title="Relic Cores">✦ ' + m.cores + '</span></div>';
  },
  header(title, sub) { return '<div class="hdr"><button class="btn back" data-act="back" data-nav>‹ Back</button><div><h2>' + title + '</h2>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' + this.currency() + '</div>'; },
  costHtml(c) { if (!c) return ''; const p = []; if (c.gold) p.push('⦿ ' + c.gold); if (c.parts) p.push('⚙ ' + c.parts); if (c.steel) p.push('⛨ ' + c.steel); if (c.shards) p.push('◆ ' + c.shards); if (c.cores) p.push('✦ ' + c.cores); return p.join(' · '); },
  rar(r) { return IF.RARITY[r]; },
  pct(v) { return Math.round(v * 100) + '%'; },

  /* ---------- SPLASH ---------- */
  r_splash() {
    const ready = IF.game.loaded;
    return '<div class="splash" data-act="start"><img src="' + IF.ASSETS.splash + '" alt="Steel & Blood: Knights of the Apocalypse">' +
      (ready ? '<div class="press">' + ('ontouchstart' in window ? 'TAP TO BEGIN' : 'PRESS ANY KEY') + '</div>'
        : '<div class="loading"><div class="lbar"><i id="lfill" style="width:0%"></i></div><div class="ltext" id="ltext">Loading…</div></div>') +
      '<div class="ver">v' + IF.VERSION + '</div></div>';
  },
  setLoading(label, k) {
    if (label === null) { if (this.screen === 'splash') this.render(); return; }
    const f = document.getElementById('lfill'), t = document.getElementById('ltext');
    if (f) f.style.width = Math.round(k * 100) + '%'; if (t) t.textContent = label + '…  ' + Math.round(k * 100) + '%';
  },
  /* ---------- MAIN MENU ---------- */
  r_menu() {
    const d = IF.save.data, played = d.stats.runs > 0;
    const btn = (act, label, sub) => '<button class="mbtn" data-act="' + act + '" data-nav><span>' + label + '</span>' + (sub ? '<small>' + sub + '</small>' : '') + '</button>';
    const pts = d.skillPoints ? ' <em class="badge">' + d.skillPoints + '</em>' : '';
    return '<div class="menu"><div class="menu-bg" style="background-image:url(' + IF.ASSETS.menu + ')"></div><div class="menu-shade"></div>' +
      '<img class="logo" src="' + IF.ASSETS.logo + '" alt="Steel & Blood">' +
      '<div class="mcol">' +
      btn('play', played ? 'Continue the Crusade' : 'Begin the Crusade', 'Endless Survival · Best: Section ' + d.stats.bestSection) +
      btn('modes', 'Game Modes', 'Boss Rush · Horde · Hardcore · Daily') +
      btn('armoury', 'Armoury', d.weapons.length + ' weapons') + '<div class="mrow">' + btn('equipment', 'Equipment', 'Armour & loadout') + btn('customise', 'Customise Knight', this.esc(d.appearance.name)) + '</div>' +
      '<div class="mrow">' + btn('skills', 'Skill Tree' + pts) + btn('companions', 'Companions', d.companions.active.length + ' / ' + d.companions.slots + ' marching') + '</div>' + btn('forge', 'Blacksmith & Forge') +
      '<div class="mrow">' + btn('stats', 'Statistics') + btn('achievements', 'Achievements') + '</div>' +
      '<div class="mrow">' + btn('settings', 'Settings') + btn('howto', 'How to Play') + '</div>' +
      btn('newgame', 'New Game', 'Erase all progress') +
      '</div><div class="mfoot">Lv ' + d.level + ' Knight · ' + this.currency() + '</div></div>';
  },
  r_modes() {
    let h = this.header('Game Modes', 'Choose your trial') + '<div class="modes">';
    for (const id in IF.MODES) {
      const m = IF.MODES[id], ok = IF.prog.modeUnlocked(id), u = m.unlock;
      let req = ''; if (!ok) for (const k in u) req = k === 'bosses' ? 'Defeat ' + u[k] + ' boss' : 'Reach section ' + u[k];
      let extra = ''; if (id === 'daily') { const day = new Date().toISOString().slice(0, 10), mod = IF.DAILY_MODIFIERS[IF.hashString('daily' + day) % IF.DAILY_MODIFIERS.length]; extra = '<div class="mod">Today: <b>' + mod.name + '</b> — ' + mod.desc + '</div><div class="mod">Your best today: Section ' + (IF.save.data.dailyBest[day] || 0) + '</div>'; }
      h += '<button class="mode ' + (ok ? '' : 'locked') + '" data-act="startmode" data-id="' + id + '" data-nav ' + (ok ? '' : 'disabled') + '><h3>' + m.name + '</h3><p>' + m.desc + '</p>' + extra + (ok ? '' : '<div class="req">🔒 ' + req + '</div>') + '</button>';
    }
    return h + '</div>';
  },
  r_howto() {
    const k = (a) => '<kbd>' + IF.input.keyLabel(a) + '</kbd>';
    return this.header('How to Play', 'The world has fallen. The knight remains.') + '<div class="howto"><div class="col">' +
      '<h3>The Crusade</h3><p>Fight east through an endless, zombie-infested world. Each <b>section</b> ends at a sealed gate — clear the horde guarding it, then choose one of <b>three rewards</b>: new weapons, armour, upgrades, run boons or skill points. Every 5th section a <b>Guardian</b> boss blocks the road.</p>' +
      '<p>Gold, materials, XP and items are kept when you fall. Spend them in the <b>Armoury</b>, <b>Blacksmith</b> and <b>Skill Tree</b>, then rise again stronger.</p>' +
      '<h3>Combat tips</h3><ul><li><b>Aim</b> guns and blades with the pointer (or right stick). Aim low to hit Crawlers; aim high for <b>headshots</b> (+40% damage). Without a pointer, hold Up/Crouch to strike high or fire low. Jump over Crawlers and boss shockwaves.</li><li><b>Block</b> just as a blow lands to <b>Parry</b>: no damage and the attacker is staggered.</li><li>Armoured zombies deflect light hits — use heavy attacks, hammers, maces or piercing rounds.</li><li>Kill <b>Screamers</b> first; they summon more of the dead. Shoot red barrels to blast crowds.</li><li>Bosses flash gold when <b>VULNERABLE</b> after their signature attack — punish them for double damage.</li></ul></div>' +
      '<div class="col"><h3>Controls</h3><table class="keys">' +
      [['Move', 'left', 'right'], ['Jump', 'jump'], ['Crouch', 'down'], ['Sprint', 'sprint'], ['Melee (hold = heavy)', 'attack'], ['Shoot', 'shoot'], ['Reload', 'reload'], ['Switch firearm', 'switch'], ['Block / Parry', 'block'], ['Dodge roll', 'dodge'], ['Special ability', 'special'], ['Aim up', 'up'], ['Pause', 'pause']].map((r) => '<tr><td>' + r[0] + '</td><td>' + r.slice(1).map(k).join(' ') + '</td></tr>').join('') +
      '</table><p class="dim">Mouse: Left = melee, Right = shoot, Wheel = switch. Controllers are supported (X attack, RT shoot, LT block, B dodge, A jump, Y special). All bindings can be changed in Settings.</p></div></div>';
  },

  /* ---------- ARMOURY ---------- */
  r_armoury() {
    const d = IF.save.data, sel = this.sel.weapon && IF.loot.findItem(this.sel.weapon);
    let grid = '';
    for (const slot of ['melee', 'primary', 'secondary']) {
      grid += '<h4>' + { melee: 'Melee Weapons', primary: 'Primary Firearms & Bows', secondary: 'Sidearms' }[slot] + '</h4><div class="grid">';
      for (const def of IF.WEAPONS.filter((w) => w.slot === slot)) {
        const owned = d.weapons.filter((w) => w.id === def.id).sort((a, b) => this.rar(b.rarity).index - this.rar(a.rarity).index);
        if (!owned.length) { grid += '<div class="cell locked" title="' + this.esc(def.name) + '"><canvas data-wpn="' + def.id + '" data-r="0" data-sil="1" width="150" height="70"></canvas><span>' + this.esc(def.name) + '</span><small>🔒 Section ' + Math.max(1, def.depth) + '+' + (def.minRarity ? ' · Legendary' : '') + '</small></div>'; continue; }
        for (const it of owned) {
          const r = this.rar(it.rarity), eq = Object.values(d.equipped).includes(it.uid);
          grid += '<button class="cell ' + (sel && sel.uid === it.uid ? 'sel' : '') + '" style="--rc:' + r.color + '" data-act="selw" data-uid="' + it.uid + '" data-nav><canvas data-wpn="' + def.id + '" data-r="' + r.index + '" width="150" height="70"></canvas><span>' + this.esc(def.name) + (it.level > 1 ? ' +' + (it.level - 1) : '') + '</span><small style="color:' + r.color + '">' + r.name + (eq ? ' · EQUIPPED' : '') + '</small></button>';
        }
      }
      grid += '</div>';
    }
    this.afterRender = () => this.paintCanvases();
    return this.header('Armoury', d.weapons.length + ' weapons owned · ' + Object.keys(d.seen).length + ' / ' + IF.WEAPONS.length + ' discovered') + '<div class="split"><div class="scroll">' + grid + '</div><div class="detail">' + (sel ? this.weaponDetail(sel) : '<p class="dim">Select a weapon to inspect, compare, equip and upgrade it.</p>') + '</div></div>';
  },
  weaponDetail(it) {
    const d = IF.save.data, def = IF.WEAPON[it.id], r = this.rar(it.rarity), st = IF.prog.computeStats(), ws = IF.loot.weaponStats(it, st);
    const eqUid = d.equipped[def.slot], eqIt = eqUid && eqUid !== it.uid ? IF.loot.findItem(eqUid) : null, cmp = eqIt ? IF.loot.weaponStats(eqIt, st) : null;
    const row = (label, v, cv, fmt, lowerBetter) => { let diff = ''; if (cmp && cv !== undefined) { const dv = v - cv; if (Math.abs(dv) > 0.001) diff = '<i class="' + ((dv > 0) !== !!lowerBetter ? 'up' : 'dn') + '">' + (dv > 0 ? '▲' : '▼') + '</i>'; } return '<tr><td>' + label + '</td><td>' + fmt(v) + ' ' + diff + '</td></tr>'; };
    const n1 = (v) => v.toFixed(1), n0 = (v) => Math.round(v);
    let rows = row('Damage', ws.dmg, cmp && cmp.dmg, n0) + (ws.pellets > 1 ? '<tr><td>Pellets</td><td>×' + ws.pellets + '</td></tr>' : '') + row('Attack speed', ws.rate, cmp && cmp.rate, n1) + row('DPS (est.)', ws.dps, cmp && cmp.dps, n0) + row('Critical', ws.crit, cmp && cmp.crit, this.pct) + row('Range', ws.range, cmp && cmp.range, n0) + row('Knockback', ws.knock, cmp && cmp.knock, n0);
    if (!ws.melee) rows += row('Magazine', ws.mag, cmp && cmp.mag, n0) + row('Reload', ws.reload, cmp && cmp.reload, (v) => v.toFixed(2) + 's', true) + row('Accuracy', 1 - ws.spread * 5, cmp && 1 - cmp.spread * 5, this.pct) + row('Recoil', ws.recoil, cmp && cmp.recoil, n1, true) + '<tr><td>Ammo</td><td>' + IF.AMMO[def.ammo].name + '</td></tr>';
    if (ws.pierce) rows += '<tr><td>Pierce</td><td>' + ws.pierce + ' targets</td></tr>';
    if (ws.armorPierce) rows += '<tr><td>Armour pierce</td><td>' + this.pct(ws.armorPierce) + '</td></tr>';
    const perks = it.perks.map((p) => '<li><b>' + IF.PERKS[p].name + '</b> — ' + IF.PERKS[p].desc + '</li>').join('');
    const uc = IF.loot.upgradeCost(it), ac = IF.loot.ascendCost(it), eq = Object.values(d.equipped).includes(it.uid);
    this.afterRender = () => this.paintCanvases();
    return '<div class="dcard" style="--rc:' + r.color + '"><canvas data-wpn="' + it.id + '" data-r="' + r.index + '" width="380" height="140"></canvas><h3>' + this.esc(def.name) + '</h3><div class="rtag" style="color:' + r.color + '">' + r.name + ' · Level ' + it.level + '/10 · ' + { melee: 'Melee', primary: 'Primary', secondary: 'Sidearm' }[def.slot] + '</div><p class="desc">' + this.esc(def.desc) + '</p>' +
      (cmp ? '<p class="cmp">Compared with equipped: ' + this.esc(IF.WEAPON[eqIt.id].name) + '</p>' : '') + '<table class="stats">' + rows + '</table>' + (perks ? '<ul class="perks">' + perks + '</ul>' : '') +
      '<div class="acts">' + (eq ? '<button class="btn" disabled>Equipped</button>' : '<button class="btn pri" data-act="equip" data-uid="' + it.uid + '" data-slot="' + def.slot + '" data-nav>Equip</button>') +
      (it.level < 10 ? '<button class="btn" data-act="upgrade" data-uid="' + it.uid + '" data-nav ' + (IF.loot.canAfford(uc) ? '' : 'disabled') + '>Upgrade <small>' + this.costHtml(uc) + '</small></button>' : '<button class="btn" disabled>Max level</button>') +
      (ac ? '<button class="btn" data-act="ascend" data-uid="' + it.uid + '" data-nav ' + (IF.loot.canAfford(ac) ? '' : 'disabled') + '>Ascend to ' + IF.RARITIES[r.index + 1].name + ' <small>' + this.costHtml(ac) + '</small></button>' : '') +
      (eq ? '' : '<button class="btn dang" data-act="salvage" data-uid="' + it.uid + '" data-nav>Salvage <small>' + this.costHtml(IF.loot.salvageValue(it)) + '</small></button>') + '</div></div>';
  },
  paintCanvases() {
    this.root.querySelectorAll('canvas[data-wpn]').forEach((c) => {
      const def = IF.WEAPON[c.dataset.wpn], ctx = c.getContext('2d'), sil = c.dataset.sil;
      ctx.clearRect(0, 0, c.width, c.height);
      const len = def.slot === 'melee' ? def.len + 30 : { pistol: 50, revolver: 56, handcannon: 64, smg: 76, rifle: 110, shotgun: 112, pump: 112, dbshotgun: 90, sniper: 140, lmg: 120, minigun: 100, gl: 90, rl: 150, bow: 60, crossbow: 80 }[def.cls] || 100;
      const s = Math.min((c.width - 20) / len, (c.height - 10) / (def.cls === 'bow' ? 100 : 50)) * 0.92;
      ctx.save(); ctx.translate(c.width / 2 - (len * s) / 2 + (def.slot === 'melee' ? 20 * s : def.cls === 'bow' ? len * s / 2 : 30 * s), c.height / 2); ctx.scale(s, s);
      if (def.slot === 'melee') ctx.rotate(0);
      IF.art.drawWeapon(ctx, def, parseInt(c.dataset.r), performance.now() / 1000, { loaded: true });
      ctx.restore();
      if (sil) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = '#4a3a30'; ctx.fillRect(0, 0, c.width, c.height); ctx.globalCompositeOperation = 'source-over'; }
    });
    this.root.querySelectorAll('canvas[data-knight]').forEach((c) => this.paintKnight(c));
  },

  /* ---------- EQUIPMENT ---------- */
  r_equipment() {
    const d = IF.save.data, slot = this.sel.slot || 'chest', eq = IF.prog.equippedItems(), st = IF.prog.computeStats();
    const counts = IF.prog.setCounts();
    let slots = '';
    for (const s of [...IF.ARMOUR_SLOTS, 'accessory']) {
      const it = eq[s]; const r = it ? this.rar(it.rarity) : null;
      slots += '<button class="slot ' + (slot === s ? 'sel' : '') + '" style="--rc:' + (r ? r.color : '#3a2e26') + '" data-act="selslot" data-slot="' + s + '" data-nav><small>' + IF.SLOT_NAMES[s] + '</small><span>' + (it ? this.esc(IF.loot.itemName(it)) + (it.level > 1 ? ' +' + (it.level - 1) : '') : '— empty —') + '</span></button>';
    }
    const list = (slot === 'accessory' ? d.accessories : d.armour.filter((a) => a.slot === slot)).slice().sort((a, b) => this.rar(b.rarity).index - this.rar(a.rarity).index || (IF.ARMOUR_SET[b.set]?.tier || 0) - (IF.ARMOUR_SET[a.set]?.tier || 0));
    let inv = list.map((it) => { const r = this.rar(it.rarity), isEq = d.equipped[slot] === it.uid; return '<button class="irow ' + (this.sel.item === it.uid ? 'sel' : '') + '" style="--rc:' + r.color + '" data-act="selitem" data-uid="' + it.uid + '" data-nav><span>' + this.esc(IF.loot.itemName(it)) + (it.level > 1 ? ' +' + (it.level - 1) : '') + '</span><small style="color:' + r.color + '">' + r.name + (isEq ? ' · EQUIPPED' : '') + (it.kind === 'armour' ? ' · ' + IF.loot.armourValue(it) + ' armour' : '') + '</small></button>'; }).join('');
    if (!inv) inv = '<p class="dim">No ' + IF.SLOT_NAMES[slot].toLowerCase() + ' collected yet. Earn them as section rewards or craft them at the Forge.</p>';
    const selIt = this.sel.item && IF.loot.findItem(this.sel.item);
    let sets = '';
    for (const id in counts) { const set = IF.ARMOUR_SET[id], n = counts[id]; sets += '<div class="setb"><b style="color:' + set.pal.trim + '">' + set.name + ' (' + n + '/7)</b>' + [2, 4, 6].map((k, i) => '<div class="' + (n >= k ? 'on' : '') + '">' + k + 'pc: ' + set.bonusText[i] + '</div>').join('') + '</div>'; }
    const statRow = (k, v) => '<tr><td>' + k + '</td><td>' + v + '</td></tr>';
    const stats = statRow('Max Health', Math.round(st.maxHp)) + statRow('Armour', Math.round(st.armor) + ' (' + this.pct(st.totalDR) + ' reduction)') + statRow('Melee / Firearm dmg', '+' + this.pct(st.meleeDmg + st.allDmg) + ' / +' + this.pct(st.gunDmg + st.allDmg)) + statRow('Critical', this.pct(st.crit)) + statRow('Move speed', '+' + this.pct(st.moveSpeed)) + statRow('Regen', st.regen.toFixed(1) + '/s') + statRow('Reload speed', '+' + this.pct(st.reloadSpeed)) + statRow('Ammo capacity', '+' + this.pct(st.ammoCap));
    this.afterRender = () => { this.paintCanvases(); this.animKnight(); };
    return this.header('Equipment', 'Every piece changes how your knight looks · <button class="btn" data-act="customise" data-nav>Customise heraldry ›</button>') + '<div class="equip"><div class="eqleft"><canvas data-knight="1" data-preview="' + (selIt && selIt.kind === 'armour' ? selIt.uid : '') + '" width="360" height="400"></canvas><div class="slots">' + slots + '</div></div>' +
      '<div class="eqmid"><h4>' + IF.SLOT_NAMES[slot] + ' collection</h4><div class="scroll inv">' + inv + '</div></div>' +
      '<div class="detail">' + (selIt ? this.armourDetail(selIt, slot) : '<h4>Knight</h4><table class="stats">' + stats + '</table>' + (sets ? '<h4>Set bonuses</h4>' + sets : '<p class="dim">Wear 2, 4 and 6 pieces of the same set to unlock set bonuses.</p>')) + '</div></div>';
  },
  armourDetail(it, slot) {
    const d = IF.save.data, r = this.rar(it.rarity), isEq = d.equipped[slot] === it.uid, cur = d.equipped[slot] && !isEq ? IF.loot.findItem(d.equipped[slot]) : null;
    let body = '';
    if (it.kind === 'armour') {
      const set = IF.ARMOUR_SET[it.set], av = IF.loot.armourValue(it), cv = cur ? IF.loot.armourValue(cur) : null;
      body += '<table class="stats"><tr><td>Armour</td><td>' + av + (cv !== null ? ' <i class="' + (av >= cv ? 'up' : 'dn') + '">' + (av >= cv ? '▲' : '▼') + ' vs ' + cv + '</i>' : '') + '</td></tr>' + it.affixes.map((a) => '<tr><td colspan=2>' + IF.loot.affixText(a) + '</td></tr>').join('') + '</table>';
      body += '<div class="setb"><b style="color:' + set.pal.trim + '">' + set.name + ' set</b>' + [2, 4, 6].map((k, i) => '<div>' + k + 'pc: ' + set.bonusText[i] + '</div>').join('') + '</div>';
    } else { const s = IF.loot.accessoryStats(it); body += '<p class="desc">' + this.esc(IF.ACCESSORY[it.id].desc) + '</p><table class="stats">' + Object.keys(s).map((k) => '<tr><td colspan=2>' + IF.loot.statText(k, s[k]) + '</td></tr>').join('') + '</table>'; }
    const uc = IF.loot.upgradeCost(it), ac = IF.loot.ascendCost(it);
    return '<div class="dcard" style="--rc:' + r.color + '"><h3>' + this.esc(IF.loot.itemName(it)) + '</h3><div class="rtag" style="color:' + r.color + '">' + r.name + ' · Level ' + it.level + '/10</div>' + body +
      '<div class="acts">' + (isEq ? '<button class="btn" data-act="unequip" data-slot="' + slot + '" data-nav>Unequip</button>' : '<button class="btn pri" data-act="equip" data-uid="' + it.uid + '" data-slot="' + slot + '" data-nav>Equip</button>') +
      (it.level < 10 ? '<button class="btn" data-act="upgrade" data-uid="' + it.uid + '" data-nav ' + (IF.loot.canAfford(uc) ? '' : 'disabled') + '>Upgrade <small>' + this.costHtml(uc) + '</small></button>' : '') +
      (ac ? '<button class="btn" data-act="ascend" data-uid="' + it.uid + '" data-nav ' + (IF.loot.canAfford(ac) ? '' : 'disabled') + '>Ascend <small>' + this.costHtml(ac) + '</small></button>' : '') +
      (isEq ? '' : '<button class="btn dang" data-act="salvage" data-uid="' + it.uid + '" data-nav>Salvage <small>' + this.costHtml(IF.loot.salvageValue(it)) + '</small></button>') + '</div></div>';
  },
  /* Knight preview with an optional piece swapped in to visualise the change before equipping. */
  paintKnight(c, t = performance.now() / 1000) {
    const ctx = c.getContext('2d'), eq = IF.prog.equippedItems(); const prev = c.dataset.preview && IF.loot.findItem(c.dataset.preview);
    if (prev) eq[prev.slot] = prev;
    const look = IF.art.knightLook(eq);
    ctx.clearRect(0, 0, c.width, c.height);
    const g = ctx.createRadialGradient(c.width / 2, c.height * 0.55, 20, c.width / 2, c.height * 0.55, c.width * 0.7); g.addColorStop(0, 'rgba(120,30,25,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(c.width / 2, c.height - 34 * c.height / 400, 80 * c.height / 400, 12 * c.height / 400, 0, 0, 6.283); ctx.fill();
    const ks = (c.height - 44) / 168; ctx.save(); ctx.translate(c.width / 2 - 6 * ks / 2.15, c.height - 34 * ks / 2.15); ctx.scale(ks, ks);
    const mel = eq.melee && IF.WEAPON[eq.melee.id], two = mel && IF.TWO_HANDED[mel.cls];
    const P = { hipX: 0, hipY: -70 + Math.sin(t * 2) * 0.8, lean: 0.05, footF: { x: 11, y: 0 }, footB: { x: -11, y: 0 }, handF: { x: 18, y: -60 }, handB: { x: two ? 8 : -8, y: two ? -56 : -50 }, shieldMode: two ? 'back' : 'front', capeWave: 0.25 + Math.sin(t * 1.3) * 0.12, tabardSway: Math.sin(t) * 0.2, twoHand: two, wAngle: -1.2 };
    if (!two && look.shield) P.handB = { x: 14, y: -70 };
    if (mel) { const ri = this.rar(eq.melee.rarity).index; P.drawWeapon = (cx) => { cx.save(); cx.translate(P.handF.x, P.handF.y); cx.rotate(P.wAngle); IF.art.drawWeapon(cx, mel, ri, t); cx.restore(); }; }
    IF.art.drawKnight(ctx, P, look, t); ctx.restore();
  },
  animKnight() {
    const c = this.root.querySelector('canvas[data-knight]'); if (!c) return;
    const tick = () => { if (!c.isConnected) return; this.paintKnight(c); requestAnimationFrame(tick); }; tick();
  },

  /* ---------- CUSTOMISE KNIGHT ---------- */
  helmUnlocked(h) { if (!h.set) return true; const d = IF.save.data; return h.set === 'worn_iron' || d.armour.some((a) => a.set === h.set); },
  r_customise() {
    const A = IF.save.data.appearance, H = IF.HERALDRY;
    const sw = (key, allowAuto, extra) => '<div class="swatches">' + (allowAuto ? '<button class="sw auto ' + (A[key] === 'auto' ? 'on' : '') + '" data-act="app" data-k="' + key + '" data-v="auto" data-nav title="From armour">A</button>' : '') + (extra || '') +
      H.colors.map((c) => '<button class="sw ' + (A[key] === c.id ? 'on' : '') + '" style="background:' + c.c + '" data-act="app" data-k="' + key + '" data-v="' + c.id + '" data-nav title="' + c.name + '"></button>').join('') + '</div>';
    const opt = (key, list, isLocked) => '<div class="opts wrap">' + list.map((o) => { const lock = isLocked && !isLocked(o); return '<button class="btn ' + (A[key] === o.id ? 'pri' : '') + '" data-act="app" data-k="' + key + '" data-v="' + o.id + '" data-nav ' + (lock ? 'disabled title="Collect any ' + IF.ARMOUR_SET[o.set].name + ' piece to unlock"' : '') + '>' + (lock ? '🔒 ' : '') + o.name + '</button>'; }).join('') + '</div>';
    this.afterRender = () => { this.animKnight(); this.paintEmblems(); };
    return this.header('Customise Knight', 'Cosmetic only — your armour\'s stats are unchanged') + '<div class="custom"><div class="cleft"><canvas data-knight="1" width="380" height="420"></canvas>' +
      '<label class="namef"><span>Name</span><input type="text" maxlength="22" value="' + this.esc(A.name) + '" data-app="name" spellcheck="false"></label></div>' +
      '<div class="cright scroll"><h4>Heraldic orders</h4><div class="opts wrap">' + H.presets.map((p) => '<button class="btn" data-act="preset" data-id="' + p.id + '" data-nav>' + p.name + '</button>').join('') + '</div>' +
      '<h4>Surcoat</h4>' + sw('tabard', true) +
      '<h4>Emblem</h4><div class="opts wrap">' + H.emblems.map((e) => '<button class="btn emb ' + (A.emblem === e.id ? 'pri' : '') + '" data-act="app" data-k="emblem" data-v="' + e.id + '" data-nav><canvas data-emb="' + e.id + '" width="26" height="26"></canvas>' + e.name + '</button>').join('') + '</div>' +
      '<h4>Emblem colour</h4>' + sw('cross', true) + '<h4>Cape</h4>' + sw('cape', true) +
      '<h4>Plume</h4>' + sw('plume', true, '<button class="sw none ' + (A.plume === 'none' ? 'on' : '') + '" data-act="app" data-k="plume" data-v="none" data-nav title="No plume">✕</button>') +
      '<h4>Helmet style</h4>' + opt('helm', H.helms, (h) => this.helmUnlocked(h)) +
      '<h4>Armour finish</h4>' + opt('finish', H.finishes) +
      '<div class="acts"><button class="btn dang" data-act="appreset" data-nav>Reset to defaults</button></div></div></div>';
  },
  paintEmblems() {
    const A = IF.save.data.appearance, col = A.cross !== 'auto' ? IF.HCOLOR[A.cross] : '#b3151d';
    this.root.querySelectorAll('canvas[data-emb]').forEach((c) => { const x = c.getContext('2d'); x.clearRect(0, 0, 26, 26); x.fillStyle = A.tabard !== 'auto' ? IF.HCOLOR[A.tabard] : '#ece6d8'; x.fillRect(1, 1, 24, 24); IF.art.emblem(x, 13, 13, 20, col, c.dataset.emb); });
  },

  /* ---------- SKILLS ---------- */
  r_skills() {
    const d = IF.save.data;
    let h = this.header('Skill Tree', '<b class="pts">' + d.skillPoints + '</b> skill point' + (d.skillPoints === 1 ? '' : 's') + ' available · Knight level ' + d.level) + '<div class="trees">';
    for (const tree of IF.SKILL_TREES) {
      h += '<div class="tree" style="--tc:' + tree.color + '"><h3>' + tree.name + '</h3>';
      for (const n of tree.nodes) {
        const rank = IF.prog.skillRank(n.id), can = IF.prog.canLearn(n.id), locked = n.req && IF.prog.skillRank(n.req[0]) < n.req[1];
        h += '<button class="node ' + (rank ? 'has ' : '') + (rank >= n.max ? 'max ' : '') + (locked ? 'locked' : '') + '" data-act="learn" data-id="' + n.id + '" data-nav ' + (can ? '' : 'aria-disabled="true"') + '><div class="nt"><b>' + n.name + '</b><span>' + rank + '/' + n.max + '</span></div><p>' + n.desc + '</p>' + (locked ? '<small>Requires ' + IF.SKILL_NODE[n.req[0]].name + ' ' + n.req[1] + '</small>' : '') + '</button>';
      }
      h += '</div>';
    }
    h += '</div><div class="abil"><b>Active special:</b> ';
    const ab = IF.prog.unlockedAbilities();
    if (!ab.length) h += '<span class="dim">Learn Berserker in the Valour tree to unlock specials.</span>';
    for (const a of ab) h += '<button class="btn ' + (d.ability === a ? 'pri' : '') + '" data-act="setab" data-id="' + a + '" data-nav>' + IF.ABILITIES[a].name + '</button>';
    h += '<button class="btn dang" data-act="respec" data-nav>Reset skills <small>⦿ ' + IF.prog.respecCost() + '</small></button></div>';
    return h;
  },
  /* ---------- FORGE ---------- */
  r_forge() {
    const cw = IF.loot.forgeCost('weapon'), ca = IF.loot.forgeCost('armour'), last = this.sel.forged && IF.loot.findItem(this.sel.forged);
    let h = this.header('Blacksmith & Forge', 'Craft new equipment. Quality scales with your best section reached.') + '<div class="forge"><div class="fcol"><h3>Forge a Weapon</h3><p>A random weapon from every type you could find up to section ' + Math.max(1, IF.save.data.stats.bestSection) + '.</p><button class="btn pri" data-act="forge" data-kind="weapon" data-nav ' + (IF.loot.canAfford(cw) ? '' : 'disabled') + '>Forge weapon <small>' + this.costHtml(cw) + '</small></button>';
    h += '<h3>Forge Armour</h3><p>Choose the slot. Pieces come from the strongest armour sets you have reached.</p><div class="fslots">';
    for (const s of IF.ARMOUR_SLOTS) h += '<button class="btn" data-act="forge" data-kind="armour" data-slot="' + s + '" data-nav ' + (IF.loot.canAfford(ca) ? '' : 'disabled') + '>' + IF.SLOT_NAMES[s] + '</button>';
    h += '</div><p class="dim">Cost per armour piece: ' + this.costHtml(ca) + '</p><p class="dim">Upgrade and Ascend individual items from the Armoury and Equipment screens. Salvage unwanted gear for materials.</p></div><div class="fcol">';
    if (last) { const r = this.rar(last.rarity); h += '<div class="forged" style="--rc:' + r.color + '"><div class="rtag" style="color:' + r.color + '">FORGED · ' + r.name.toUpperCase() + '</div><h3>' + this.esc(IF.loot.itemName(last)) + '</h3>' + (last.kind === 'weapon' ? '<canvas data-wpn="' + last.id + '" data-r="' + r.index + '" width="360" height="130"></canvas>' : '<p>' + IF.loot.armourValue(last) + ' armour · ' + last.affixes.map((a) => IF.loot.affixText(a)).join(' · ') + '</p>') + '<button class="btn" data-act="' + (last.kind === 'weapon' ? 'gowpn' : 'goarm') + '" data-uid="' + last.uid + '" data-nav>Inspect</button></div>'; }
    else h += '<div class="anvil">⚒</div>';
    this.afterRender = () => this.paintCanvases();
    return h + '</div></div>';
  },
  /* ---------- STATS / ACHIEVEMENTS ---------- */
  r_stats() {
    const s = IF.save.data.stats, d = IF.save.data;
    const rows = [['Knight level', d.level], ['Runs started', s.runs], ['Zombies slain', s.kills], ['Guardians defeated', s.bosses], ['Sections cleared', s.sections], ['Distance travelled', Math.round(s.distance) + ' m'], ['Time in battle', IF.util.fmtTime(s.time)], ['Deaths', s.deaths], ['Best section', s.bestSection], ['Best distance', s.bestDistance + ' m'], ['Longest survival', IF.util.fmtTime(s.bestTime)], ['Most kills in a run', s.bestKills], ['Shots fired', s.shots], ['Upgrades performed', s.upgrades], ['Legendary items found', s.legendaries], ['Mythic items found', s.mythics], ['Weapons discovered', Object.keys(d.seen).length + ' / ' + IF.WEAPONS.length]];
    const kb = Object.keys(s.killsBy).map((k) => '<tr><td>' + (IF.ENEMY[k] ? IF.ENEMY[k].name : IF.BOSS[k] ? IF.BOSS[k].name : k) + '</td><td>' + s.killsBy[k] + '</td></tr>').join('');
    return this.header('Statistics') + '<div class="statsg"><table class="stats big">' + rows.map((r) => '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>').join('') + '</table><div><h4>Kills by type</h4><table class="stats">' + (kb || '<tr><td class="dim">None yet</td></tr>') + '</table></div></div>';
  },
  r_achievements() {
    const d = IF.save.data; let n = 0;
    const list = IF.ACHIEVEMENTS.map((a) => { const got = d.achievements[a.id]; if (got) n++; const v = Math.min(a.target, d.stats[a.stat] || 0); const rw = a.reward; return '<div class="ach ' + (got ? 'got' : '') + '"><div class="ai">' + (got ? '✠' : '✧') + '</div><div><b>' + a.name + '</b><p>' + a.desc + '</p><div class="pb"><i style="width:' + (v / a.target * 100) + '%"></i></div><small>' + IF.util.fmt(v) + ' / ' + IF.util.fmt(a.target) + ' · Reward: ' + this.costHtml(rw) + '</small></div></div>'; }).join('');
    return this.header('Achievements', n + ' / ' + IF.ACHIEVEMENTS.length + ' unlocked') + '<div class="scroll achs">' + list + '</div>';
  },
  /* ---------- COMPANIONS ---------- */
  r_companions() {
    const d = IF.save.data, C = d.companions;
    const card = (c) => {
      const own = C.owned[c.id], on = C.active.includes(c.id), lvl = own ? own.lvl : 1, m = IF.companions.levelMult(lvl);
      const icon = c.kind === 'dog' ? '🐕' : { Crusader: '✠', 'Heavy Knight': '⛨', Marksman: '⌖', Scout: '➶', Medic: '✚', Engineer: '⚙' }[c.role] || '✠';
      const w = c.weapon ? IF.WEAPON[c.weapon].name : 'Teeth & claws';
      const actions = !own ? '<button class="btn pri" data-act="chire" data-id="' + c.id + '" data-nav ' + (d.gold < c.cost ? 'disabled' : '') + '>Hire · ' + c.cost + ' gold</button>'
        : '<button class="btn ' + (on ? 'pri' : '') + '" data-act="ctog" data-id="' + c.id + '" data-nav>' + (on ? 'Marching ✓' : 'Bring along') + '</button>' +
          (lvl < 10 ? '<button class="btn" data-act="cup" data-id="' + c.id + '" data-nav ' + (d.gold < IF.companions.upgradeCost(lvl) ? 'disabled' : '') + '>Train → L' + (lvl + 1) + ' · ' + IF.companions.upgradeCost(lvl) + 'g</button>' : '<span class="dim">Max level</span>');
      return '<div class="comp ' + (on ? 'on' : '') + (own ? '' : ' locked') + '"><div class="cicon">' + icon + '</div><div class="cbody"><b>' + c.name + '</b> <small>' + c.role + (own ? ' · Level ' + lvl : '') + '</small><p>' + c.desc + '</p>' +
        '<div class="cstats"><span>❤ ' + Math.round(c.hp * m.hp) + '</span><span>⚔ ' + Math.round(c.dmg * m.dmg) + '</span><span>' + this.esc(w) + '</span></div>' +
        '<p class="cab"><em>' + c.ability + ':</em> ' + c.abilityDesc + '</p><div class="acts">' + actions + '</div></div></div>';
    };
    const slot = C.slots < 3 ? '<button class="btn" data-act="cslot" data-nav ' + (d.gold < IF.companions.slotCost ? 'disabled' : '') + '>Unlock 3rd slot · ' + IF.companions.slotCost + ' gold</button>' : '';
    return this.header('Companions', C.active.length + ' of ' + C.slots + ' slots marching · press C in battle to order Hold / Follow') + '<div class="scroll comps">' + IF.COMPANIONS.map(card).join('') + '</div><div class="acts center">' + slot + '</div>';
  },
  /* ---------- SETTINGS ---------- */
  r_settings() {
    const s = IF.save.data.settings, b = IF.input.bindings();
    const range = (k, label) => '<label class="set"><span>' + label + '</span><input type="range" min="0" max="1" step="0.05" value="' + s[k] + '" data-setting="' + k + '" data-nav></label>';
    const tog = (k, label) => '<label class="set"><span>' + label + '</span><button class="btn tog ' + (s[k] ? 'on' : '') + '" data-act="toggle" data-k="' + k + '" data-nav>' + (s[k] ? 'On' : 'Off') + '</button></label>';
    const sel = (k, label, opts) => '<label class="set"><span>' + label + '</span><span class="opts">' + opts.map((o) => '<button class="btn ' + (s[k] === o ? 'pri' : '') + '" data-act="opt" data-k="' + k + '" data-v="' + o + '" data-nav>' + o + '</button>').join('') + '</span></label>';
    const keyRows = IF.ACTIONS.map((a) => '<tr><td>' + IF.ACTION_LABELS[a] + '</td><td><button class="btn key" data-act="rebind" data-a="' + a + '" data-kind="key" data-nav>' + this.esc((b.keys[a] || []).map((c) => this.keyName(c)).join(' / ') || '—') + '</button></td><td><button class="btn key" data-act="rebind" data-a="' + a + '" data-kind="pad" data-nav>' + ((b.pad[a] || []).map((i) => IF.PAD_NAMES[i] || 'B' + i).join(' / ') || '—') + '</button></td></tr>').join('');
    return this.header('Settings') + '<div class="settings"><div class="col"><h4>Audio</h4>' + range('music', 'Music volume') + range('sfx', 'Effects volume') +
      '<h4>Display</h4>' + sel('gore', 'Gore & dismemberment', ['full', 'reduced', 'off']) + tog('shake', 'Screen shake') + tog('dmgNumbers', 'Damage numbers') + tog('showFps', 'Show FPS') + sel('particles', 'Effects quality', ['low', 'medium', 'high']) + (IF.r3.ok ? sel('graphics', '3D graphics', ['auto', 'high', 'medium', 'low', 'potato']) : '') +
      '<h4>Touch controls</h4>' + sel('touch', 'On-screen controls', ['auto', 'on', 'off']) + '<label class="set"><span>Button size</span><input type="range" min="0.7" max="1.5" step="0.05" value="' + s.touchSize + '" data-setting="touchSize" data-nav></label><label class="set"><span>Button opacity</span><input type="range" min="0.2" max="1" step="0.05" value="' + s.touchOpacity + '" data-setting="touchOpacity" data-nav></label>' +
      '<h4>Save data</h4><div class="acts"><button class="btn" data-act="export" data-nav>Export save</button><button class="btn" data-act="import" data-nav>Import save</button><button class="btn" data-act="resetkeys" data-nav>Reset controls</button></div><p class="dim">Progress saves automatically with a verified backup copy.</p></div>' +
      '<div class="col"><h4>Controls <small class="dim">(click a binding, then press a key or controller button)</small></h4><div class="scroll"><table class="keys rebind"><tr><th>Action</th><th>Keyboard / Mouse</th><th>Controller</th></tr>' + keyRows + '</table></div></div></div>';
  },
  keyName(c) { const m = { Mouse0: 'Left Click', Mouse2: 'Right Click', Wheel: 'Mouse Wheel', Space: 'Space', ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', Escape: 'Esc', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' }; return m[c] || c.replace('Key', '').replace('Digit', ''); },
  setSetting(k, v) { const s = IF.save.data.settings; s[k] = v; IF.audio.applyVolumes(); IF.touch && IF.touch.applySettings(); if (k === 'graphics') { IF.r3.autoTier = null; IF.r3._auto = null; IF.r3.applyQuality(); } IF.save.markDirty(); },

  /* ---------- PAUSE / DEATH / REWARD ---------- */
  r_pause() {
    const run = IF.game.run;
    return '<div class="overlay"><div class="ovbox"><h2>Paused</h2><p class="dim">' + this.esc(IF.save.data.appearance.name) + ' · Section ' + run.section + ' · ' + run.world.biome.name + ' · ' + run.kills + ' kills</p>' +
      '<button class="mbtn" data-act="resume" data-nav><span>Resume</span></button><button class="mbtn" data-act="equipment" data-nav><span>Equipment</span></button><button class="mbtn" data-act="customise" data-nav><span>Customise Knight</span></button><button class="mbtn" data-act="skills" data-nav><span>Skill Tree</span></button><button class="mbtn" data-act="settings" data-nav><span>Settings</span></button><button class="mbtn" data-act="howto" data-nav><span>How to Play</span></button><button class="mbtn" data-act="quit" data-nav><span>Abandon run</span><small>Rewards, XP and gold are kept</small></button></div></div>';
  },
  showDeath(run) { this.deathRun = run; this.show('death'); },
  r_death() {
    const r = this.deathRun, s = IF.save.data.stats;
    const rec = (v, best) => v >= best && v > 0 ? ' <em class="rec">NEW BEST</em>' : '';
    return '<div class="overlay death"><div class="ovbox"><div class="fallen">' + this.esc(IF.save.data.appearance.name).toUpperCase() + ' HAS FALLEN</div><h2>Section ' + r.section + '</h2><p class="dim">' + r.world.biome.name + (r.mode.id !== 'endless' ? ' · ' + r.mode.name : '') + '</p>' +
      '<table class="stats big"><tr><td>Distance</td><td>' + Math.round(r.distance) + ' m' + rec(Math.round(r.distance), s.bestDistance) + '</td></tr><tr><td>Survived</td><td>' + IF.util.fmtTime(r.time) + rec(Math.round(r.time), s.bestTime) + '</td></tr><tr><td>Zombies slain</td><td>' + r.kills + rec(r.kills, s.bestKills) + '</td></tr><tr><td>Guardians defeated</td><td>' + r.bossesKilled + '</td></tr><tr><td>Best kill streak</td><td>' + r.maxCombo + '</td></tr><tr><td>Gold earned</td><td>⦿ ' + r.goldEarned + '</td></tr><tr><td>XP earned</td><td>' + Math.round(r.xpEarned) + '</td></tr><tr><td>Rewards claimed</td><td>' + r.rewardsTaken + '</td></tr></table>' +
      (IF.save.data.skillPoints ? '<p class="hint">You have ' + IF.save.data.skillPoints + ' unspent skill point(s).</p>' : '') +
      '<button class="mbtn pri" data-act="again" data-nav><span>Rise Again</span></button><div class="mrow"><button class="mbtn" data-act="equipment" data-nav><span>Equipment</span></button><button class="mbtn" data-act="skills" data-nav><span>Skills</span></button><button class="mbtn" data-act="forge" data-nav><span>Forge</span></button></div><button class="mbtn" data-act="tomenu" data-nav><span>Main Menu</span></button></div></div>';
  },
  showReward(offers) { this.offers = offers; this.rewardT = performance.now(); this.show('reward'); IF.audio.reward(Math.max(...offers.map((o) => (IF.RARITY[o.rarity] || IF.RARITY.common).index))); },
  r_reward() {
    const run = IF.game.run, st = IF.prog.computeStats(run.boons);
    const cards = this.offers.map((o, i) => {
      const r = IF.RARITY[o.rarity] || IF.RARITY.common; let title = '', type = '', body = '', art = '';
      if (o.type === 'weapon' || (o.type === 'upgrade' && o.item.kind === 'weapon')) {
        const it = o.item, def = IF.WEAPON[it.id], ws = IF.loot.weaponStats(o.type === 'upgrade' ? Object.assign({}, it, { level: it.level + o.levels }) : it, st);
        title = def.name; type = o.type === 'upgrade' ? 'WEAPON UPGRADE · +' + o.levels + ' level' + (o.levels > 1 ? 's' : '') : { melee: 'MELEE WEAPON', primary: 'PRIMARY WEAPON', secondary: 'SIDEARM' }[def.slot];
        art = '<canvas data-wpn="' + def.id + '" data-r="' + r.index + '" width="300" height="110"></canvas>';
        const cur = IF.loot.findItem(IF.save.data.equipped[def.slot]); const cws = cur && cur.uid !== it.uid ? IF.loot.weaponStats(cur, st) : null;
        body = '<div class="kv"><span>Damage</span><b>' + Math.round(ws.dmg) + (ws.pellets > 1 ? '×' + ws.pellets : '') + '</b></div><div class="kv"><span>DPS</span><b>' + Math.round(ws.dps) + (cws ? ' <i class="' + (ws.dps >= cws.dps ? 'up' : 'dn') + '">' + (ws.dps >= cws.dps ? '▲' : '▼') + Math.abs(Math.round(ws.dps - cws.dps)) + '</i>' : '') + '</b></div>' + (ws.mag ? '<div class="kv"><span>Magazine</span><b>' + ws.mag + '</b></div>' : '<div class="kv"><span>Reach</span><b>' + Math.round(ws.range) + '</b></div>') + '<div class="kv"><span>Critical</span><b>' + this.pct(ws.crit) + '</b></div>';
        body += (it.perks || []).map((p) => '<div class="perk">✦ ' + IF.PERKS[p].name + ' — ' + IF.PERKS[p].desc + '</div>').join('');
        if (o.type === 'weapon') body = '<p class="desc">' + this.esc(def.desc) + '</p>' + body;
      } else if (o.type === 'armour' || (o.type === 'upgrade' && o.item.kind === 'armour')) {
        const it = o.item, set = IF.ARMOUR_SET[it.set]; title = IF.loot.itemName(it); type = o.type === 'upgrade' ? 'ARMOUR UPGRADE · +' + o.levels : IF.SLOT_NAMES[it.slot].toUpperCase();
        art = '<canvas data-knight="1" data-preview="' + it.uid + '" width="160" height="170" class="mini"></canvas>';
        const cur = IF.loot.findItem(IF.save.data.equipped[it.slot]); const av = Math.round(IF.loot.armourValue(it) * (o.type === 'upgrade' ? (1 + 0.1 * (it.level + o.levels - 1)) / (1 + 0.1 * (it.level - 1)) : 1));
        body = '<div class="kv"><span>Armour</span><b>' + av + (cur && cur.uid !== it.uid ? ' <i class="' + (av >= IF.loot.armourValue(cur) ? 'up' : 'dn') + '">vs ' + IF.loot.armourValue(cur) + '</i>' : '') + '</b></div>' + it.affixes.map((a) => '<div class="perk">✦ ' + IF.loot.affixText(a) + '</div>').join('') + '<div class="perk dim">Set: ' + set.name + ' — 2pc: ' + set.bonusText[0] + '</div>';
      } else if (o.type === 'accessory' || (o.type === 'upgrade' && o.item.kind === 'accessory')) {
        const it = o.item, def = IF.ACCESSORY[it.id], s = IF.loot.accessoryStats(it); title = def.name; type = o.type === 'upgrade' ? 'ACCESSORY UPGRADE' : 'ACCESSORY'; art = '<div class="glyph" style="color:' + def.color + '">❖</div>';
        body = '<p class="desc">' + this.esc(def.desc) + '</p>' + Object.keys(s).map((k) => '<div class="perk">✦ ' + IF.loot.statText(k, s[k]) + '</div>').join('');
      } else if (o.type === 'boon') { title = o.boon.name; type = 'RUN BOON'; art = '<div class="glyph">✠</div>'; body = '<p class="desc">' + o.boon.desc + '</p><div class="perk dim">Lasts until this run ends.</div>'; }
      else if (o.type === 'materials') { title = 'Spoils of War'; type = 'MATERIALS'; art = '<div class="glyph">⚒</div>'; body = '<p class="desc">' + this.costHtml(o.mats).split(' · ').join('<br>') + '</p>'; }
      else if (o.type === 'skill') { title = 'Tome of Valour'; type = 'SKILL POINT'; art = '<div class="glyph">❂</div>'; body = '<p class="desc">+1 skill point to spend in the Skill Tree.</p>'; }
      return '<button class="rcard r' + r.index + '" style="--rc:' + r.color + ';--rg:' + r.glow + ';animation-delay:' + (i * 0.14) + 's" data-act="claim" data-i="' + i + '" data-nav><div class="rk">' + r.name + (o.isNew ? ' · <b>NEW</b>' : '') + '</div><div class="rt">' + type + '</div><div class="art">' + art + '</div><h3>' + this.esc(title) + '</h3><div class="rb">' + body + '</div><div class="pick">[' + (i + 1) + '] Claim</div></button>';
    }).join('');
    this.afterRender = () => { this.paintCanvases(); this.root.querySelectorAll('canvas[data-knight]').forEach((c) => { const tick = () => { if (!c.isConnected) return; this.paintKnight(c); requestAnimationFrame(tick); }; tick(); }); };
    const head = run.world.isBoss ? 'GUARDIAN\'S HOARD' : 'SECTION ' + run.section + ' CLEARED';
    return '<div class="overlay reward"><div class="rhead"><small>' + head + '</small><h2>Choose your reward</h2></div><div class="rcards">' + cards + '</div><p class="dim">Distance ' + Math.round(run.distance) + ' m · ' + run.kills + ' kills · next: Section ' + (run.section + 1) + ' — ' + IF.world.biomeFor(run.section + 1).name + '</p></div>';
  },

  /* In-game modal dialog (native confirm/prompt are blocked in sandboxed hosts). */
  dialog(title, text, okLabel, onOk, opts = {}) {
    const el = document.createElement('div'); el.className = 'dlg';
    el.innerHTML = '<div class="ovbox"><h2>' + this.esc(title) + '</h2><p>' + this.esc(text) + '</p>' + (opts.area ? '<textarea rows="5">' + this.esc(opts.value || '') + '</textarea>' : '') +
      '<div class="acts">' + (onOk ? '<button class="btn pri" data-d="ok">' + this.esc(okLabel) + '</button>' : '') + '<button class="btn" data-d="no">' + (onOk ? 'Cancel' : 'Close') + '</button></div></div>';
    el.addEventListener('click', (e) => { const b = e.target.closest('[data-d]'); if (!b) return; IF.audio.ui('click'); const val = el.querySelector('textarea') && el.querySelector('textarea').value; el.remove(); if (b.dataset.d === 'ok' && onOk) onOk(val); });
    this.root.appendChild(el); const ta = el.querySelector('textarea'); if (ta) { ta.focus(); ta.select(); }
  },

  /* ---------- actions ---------- */
  act(a, ds, el) {
    const d = IF.save.data;
    if (a !== 'claim') IF.audio.ui('click');
    switch (a) {
      case 'start': if (!IF.game.loaded) return; IF.audio.unlock(); IF.audio.setMusic(0, false); this.show('menu'); break;
      case 'back': this.back(); break;
      case 'play': IF.game.newRun('endless'); break;
      case 'modes': case 'armoury': case 'equipment': case 'skills': case 'forge': case 'stats': case 'achievements': case 'settings': case 'howto': case 'companions': this.show(a, true); break;
      case 'chire': if (IF.companions.hire(ds.id)) { this.toast(IF.COMPANION[ds.id].name + ' joins the crusade.'); IF.audio.ui('upgrade'); } else IF.audio.ui('error'); this.render(); break;
      case 'cup': if (IF.companions.upgrade(ds.id)) { this.toast(IF.COMPANION[ds.id].name + ' grows stronger.'); IF.audio.ui('upgrade'); } else IF.audio.ui('error'); this.render(); break;
      case 'ctog': if (!IF.companions.toggle(ds.id)) { IF.audio.ui('error'); this.toast('All companion slots are full — stand one down first.', 'bad'); } this.render(); break;
      case 'cslot': if (IF.companions.buySlot()) { this.toast('A third companion may now march with you.'); IF.audio.ui('upgrade'); } else IF.audio.ui('error'); this.render(); break;
      case 'startmode': IF.game.newRun(ds.id); break;
      case 'newgame': this.dialog('New Game', 'Erase ALL progress and start a new knight? This cannot be undone.', 'Erase & begin anew', () => { IF.save.reset(); this.toast('A new knight takes up the sword.'); this.render(); }); break;
      case 'selw': this.sel.weapon = ds.uid; this.render(); break;
      case 'selslot': this.sel.slot = ds.slot; this.sel.item = null; this.render(); break;
      case 'selitem': this.sel.item = ds.uid; this.render(); break;
      case 'equip': d.equipped[ds.slot] = ds.uid; IF.prog.refreshSetStats(); IF.prog.checkAchievements(); IF.save.write(); this.syncRun(); IF.audio.hit('metal'); this.render(); break;
      case 'unequip': if (ds.slot === 'melee') return; d.equipped[ds.slot] = null; IF.save.write(); this.syncRun(); this.render(); break;
      case 'upgrade': { const it = IF.loot.findItem(ds.uid); if (IF.loot.upgrade(it)) { IF.audio.ui('upgrade'); this.toast(IF.loot.itemName(it) + ' upgraded to level ' + it.level); this.syncRun(); IF.prog.checkAchievements(); } else IF.audio.ui('error'); this.render(); break; }
      case 'ascend': { const it = IF.loot.findItem(ds.uid); if (IF.loot.ascend(it)) { IF.audio.reward(IF.RARITY[it.rarity].index); this.toast(IF.loot.itemName(it) + ' ascended to ' + IF.RARITY[it.rarity].name + '!', 'level'); this.syncRun(); IF.prog.checkAchievements(); } else IF.audio.ui('error'); this.render(); break; }
      case 'salvage': { const it = IF.loot.findItem(ds.uid); const v = IF.loot.salvageValue(it); if (IF.loot.salvage(it)) { this.toast('Salvaged for ' + this.costHtml(v)); this.sel.weapon = null; this.sel.item = null; } this.render(); break; }
      case 'learn': if (IF.prog.learn(ds.id)) { IF.audio.ui('upgrade'); this.syncRun(); } else IF.audio.ui('error'); this.render(); break;
      case 'setab': d.ability = ds.id; IF.save.write(); this.render(); break;
      case 'customise': this.show('customise', true); break;
      case 'app': d.appearance[ds.k] = ds.v; IF.save.write(); this.syncRun(); this.render(); break;
      case 'preset': { const p = IF.HERALDRY.presets.find((x) => x.id === ds.id); Object.assign(d.appearance, { tabard: p.tabard, emblem: p.emblem, cross: p.cross, cape: p.cape, plume: p.plume, finish: p.finish || 'auto' }); IF.save.write(); this.syncRun(); this.toast(p.name + ' heraldry applied'); this.render(); break; }
      case 'appreset': Object.assign(d.appearance, { tabard: 'auto', emblem: 'cross', cross: 'auto', cape: 'auto', plume: 'auto', helm: 'auto', finish: 'auto' }); IF.save.write(); this.syncRun(); this.render(); break;
      case 'respec': if (IF.prog.respec()) { this.toast('Skills reset'); this.syncRun(); } else IF.audio.ui('error'); this.render(); break;
      case 'forge': { const it = IF.loot.forge(ds.kind, ds.slot); if (it) { this.sel.forged = it.uid; IF.audio.reward(IF.RARITY[it.rarity].index); IF.prog.checkAchievements(); } else IF.audio.ui('error'); this.render(); break; }
      case 'gowpn': this.sel.weapon = ds.uid; this.show('armoury', true); break;
      case 'goarm': { const it = IF.loot.findItem(ds.uid); this.sel.slot = it.slot; this.sel.item = it.uid; this.show('equipment', true); break; }
      case 'toggle': d.settings[ds.k] = !d.settings[ds.k]; IF.save.write(); this.render(); break;
      case 'opt': d.settings[ds.k] = ds.v; if (ds.k === 'graphics') { IF.r3.autoTier = null; IF.r3._auto = null; IF.r3.applyQuality(); } IF.save.write(); IF.touch && IF.touch.applySettings(); if (IF.game.run) this.hud(true); this.render(); break;
      case 'rebind': el.textContent = ds.kind === 'key' ? 'Press a key…' : 'Press a button…'; IF.input.startRebind(ds.a, ds.kind, () => this.render()); break;
      case 'resetkeys': d.settings.keys = {}; d.settings.pad = {}; IF.save.write(); this.render(); break;
      case 'export': { const s = IF.save.exportString(); try { navigator.clipboard.writeText(s).then(() => this.toast('Save copied to clipboard'), () => {}); } catch (e) {} this.dialog('Export save', 'Your save string (also copied to the clipboard where allowed). Keep it somewhere safe:', null, null, { area: true, value: s }); break; }
      case 'import': this.dialog('Import save', 'Paste a save string. This replaces your current progress.', 'Import', (s) => { if (!s) return; try { IF.save.importString(s); this.toast('Save imported'); this.render(); } catch (e) { this.toast('Invalid save string', 'bad'); } }, { area: true }); break;
      case 'resume': IF.game.resume(); break;
      case 'quit': this.dialog('Abandon run?', 'Your XP, gold and items are kept.', 'Abandon run', () => IF.game.quitToMenu()); break;
      case 'again': IF.game.newRun(this.deathRun.mode.id); break;
      case 'tomenu': IF.game.quitToMenu(); break;
      case 'claim': { if (performance.now() - this.rewardT < 450) return; const o = this.offers[parseInt(ds.i)]; IF.audio.ui('upgrade'); IF.save.data.tutorialDone = true; IF.game.claimReward(o); break; }
    }
  },
  /* keep a live run in sync after menu changes made from the pause menu */
  syncRun() {
    const run = IF.game.run; if (!run) return; const d = IF.save.data;
    run.player.refreshStats();
    for (const k of ['melee', 'primary', 'secondary']) { const it = IF.loot.findItem(d.equipped[k]); if (it) run.player.equipWeapon(k, it); }
  },

  /* ---------- controller / keyboard navigation ---------- */
  navItems() { return Array.from(this.root.querySelectorAll('[data-nav]')).filter((e) => !e.disabled && e.offsetParent !== null); },
  applyFocus(reset) {
    const items = this.navItems(); if (!items.length) return;
    if (reset) { const pref = items.findIndex((e) => e.classList.contains('pri') || e.classList.contains('rcard') || e.classList.contains('mbtn')); this.focusIdx = Math.max(0, pref); }
    this.focusIdx = IF.util.clamp(this.focusIdx, 0, items.length - 1);
    if (IF.input.lastDevice === 'gamepad' || this.kbNav) { items.forEach((e) => e.classList.remove('focus')); items[this.focusIdx].classList.add('focus'); items[this.focusIdx].scrollIntoView({ block: 'nearest' }); }
  },
  navPoll() {
    if (!this.screen || IF.input.rebinding) return;
    if (this.screen === 'splash') { if (Object.values(IF.input.keys).some(Boolean) || (IF.input.readPad() && IF.input.readPad().buttons.some((b) => b.pressed))) this.act('start'); return; }
    const gp = IF.input.readPad(), K = IF.input.keys; this.navCooldown -= 16;
    let dx = 0, dy = 0, ok = false, back = false;
    if (gp) { const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0; if (ax > 0.5 || gp.buttons[15]?.pressed) dx = 1; if (ax < -0.5 || gp.buttons[14]?.pressed) dx = -1; if (ay > 0.5 || gp.buttons[13]?.pressed) dy = 1; if (ay < -0.5 || gp.buttons[12]?.pressed) dy = -1; if (gp.buttons[0]?.pressed && !this._a) ok = true; if (gp.buttons[1]?.pressed && !this._b) back = true; this._a = gp.buttons[0]?.pressed; this._b = gp.buttons[1]?.pressed; }
    if (K.ArrowRight) dx = 1; if (K.ArrowLeft) dx = -1; if (K.ArrowDown) dy = 1; if (K.ArrowUp) dy = -1;
    if ((K.Enter || K.NumpadEnter) && !this._enter) ok = true; this._enter = K.Enter || K.NumpadEnter;
    if (this.screen === 'reward') for (let i = 1; i <= 3; i++) if (K['Digit' + i] && !this['_d' + i]) { this['_d' + i] = true; this.act('claim', { i: String(i - 1) }); } else if (!K['Digit' + i]) this['_d' + i] = false;
    if ((dx || dy) && this.navCooldown <= 0) { this.kbNav = true; this.navCooldown = 170; this.moveFocus(dx, dy); }
    if (!dx && !dy) this.navCooldown = 0;
    if (ok) { const items = this.navItems(); const el = items[this.focusIdx]; if (el && (this.kbNav || IF.input.lastDevice === 'gamepad')) el.click(); }
    if (back && this.screen !== 'reward') this.back();
  },
  moveFocus(dx, dy) {
    const items = this.navItems(); if (!items.length) return; const cur = items[this.focusIdx] || items[0]; const a = cur.getBoundingClientRect();
    let best = -1, bestS = 1e9;
    items.forEach((e, i) => { if (e === cur) return; const b = e.getBoundingClientRect(); const vx = (b.left + b.width / 2) - (a.left + a.width / 2), vy = (b.top + b.height / 2) - (a.top + a.height / 2); if (dx && Math.sign(vx) !== dx) return; if (dy && Math.sign(vy) !== dy) return; if (dx && Math.abs(vx) < 4) return; if (dy && Math.abs(vy) < 4) return; const s = dx ? Math.abs(vx) + Math.abs(vy) * 2.5 : Math.abs(vy) + Math.abs(vx) * 2.5; if (s < bestS) { bestS = s; best = i; } });
    if (best >= 0) { this.focusIdx = best; IF.audio.ui('hover'); } this.applyFocus();
  },
};
