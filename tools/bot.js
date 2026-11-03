/* QA autoplay bot — injected by the test harness. Drives the game ONLY through IF.input.touch
 * (the same path real players use), so it exercises movement, combat, rewards and bosses end-to-end. */
window.BOT = {
  on: true, god: false, tick: 0, log: [], picks: 0, pickPref: 'weapon', toggle: false,
  start(opts) {
    Object.assign(this, opts || {});
    setInterval(() => this.step(), 16);
  },
  step() {
    const IF = window.IF, G = IF.game, T = IF.input.touch; this.tick++;
    for (const k in T) T[k] = false; IF.input.touchAxis = 0;
    if (!this.on) return;
    if (G.state === 'reward' && this.tick % 30 === 0 && performance.now() - IF.ui.rewardT > 600) {
      const o = IF.ui.offers; let i = o.findIndex((x) => x.type === this.pickPref); if (i < 0) i = o.findIndex((x) => x.type === 'weapon' || x.type === 'armour'); if (i < 0) i = 0;
      this.log.push('S' + G.run.section + ':' + o[i].type + ':' + (o[i].item ? (o[i].item.id || o[i].item.set + '/' + o[i].item.slot) : o[i].boon ? o[i].boon.id : '') + ':' + o[i].rarity);
      this.pickPref = ['weapon', 'armour', 'armour', 'weapon', 'boon'][this.picks++ % 5];
      IF.ui.act('claim', { i: String(i) }); return;
    }
    if (G.state !== 'playing') return;
    const run = G.run, pl = run.player;
    if (this.god) { pl.hp = pl.maxHp; for (const k in run.ammo) run.ammo[k] = Math.max(run.ammo[k], 30); }
    let near = null, nd = 1e9;
    for (const e of run.enemies) { if (e.dead || e.state === 'rise') continue; const d = Math.abs(e.x - pl.x); if (d < nd) { nd = d; near = e; } }
    const g = pl.gun; this.toggle = !this.toggle;
    if (near) {
      const dir = Math.sign(near.x - pl.x) || 1;
      const boss = near.boss;
      if (boss) {
        const a = near.atk;
        if (a && near.stateT < a.wind && near.stateT > a.wind - 0.3 && pl.stamina > 25) { T.dodge = true; IF.input.touchAxis = -dir; return; }
        if (a && (a.kind === 'slam' || a.kind === 'barrage')) T.down = a.kind === 'barrage';
        for (const s of run.shockwaves) if (Math.abs(s.x - pl.x) < 90 && Math.sign(pl.x - s.x) === s.dir) T.jump = true;
        if (near.vuln > 0 && nd < 260) { IF.input.touchAxis = dir * 0.9; T.attack = this.toggle; return; }
        if (nd < 260) IF.input.touchAxis = -dir; else if (nd > 600) IF.input.touchAxis = dir;
        else { IF.input.touchAxis = dir * 0.01; }
        if (pl.facing !== dir) { IF.input.touchAxis = dir * 0.3; return; }
        if (g && g.mag + (run.ammo[g.def.ammo] || 0) > 0) T.shoot = g.def.auto ? true : this.toggle; else if (nd < 200) T.attack = this.toggle;
        return;
      }
      // use the tactical belt now and then: grenades into crowds, traps and the sentry when swarmed
      if (run.tac && this.tick % 240 === 0) { const crowd = run.enemies.filter((e) => !e.dead && Math.abs(e.x - pl.x) < 400).length; if (crowd >= 4) { run.tac.sel = [0, 1, 2, 3, 4][(this.tick / 240) % 5 | 0]; T.tactical = true; } }
      if (nd < 120) { IF.input.touchAxis = dir * 0.3; T.attack = this.toggle; if (near.def.low) T.down = false; if (this.tick % 90 === 0) T.block = true; }
      else if (nd < 650 && g && pl.facing !== dir) IF.input.touchAxis = dir * 0.3;
      else if (nd < 650 && g && (g.mag + (run.ammo[g.def.ammo] || 0)) > 0) { IF.input.touchAxis = dir * 0.01; T.shoot = g.def.auto ? true : this.toggle; if (near.def.low) T.down = true; }
      else IF.input.touchAxis = dir;
      if (near.def.low && nd < 160 && this.tick % 50 === 0) T.jump = true;
      if (near.state === 'windup' && nd < 130 && near.def.explode && pl.stamina > 30) { T.dodge = true; IF.input.touchAxis = -dir; }
    } else IF.input.touchAxis = 1;
    if (this.tick % 400 === 0 && pl.abilityCd <= 0) T.special = true;
  },
};
