/* Fast simulation driver for soak/balance tests: steps the real game loop at fixed 60Hz without waiting for vsync. */
window.SIM = {
  now: 0,
  run(seconds, renderEvery) {
    const IF = window.IF, G = IF.game, frames = Math.round(seconds * 60); let errors = 0;
    for (let i = 0; i < frames; i++) {
      this.now += 1000 / 60;
      try { if (G.state === 'reward') IF.ui.rewardT = -1e9; BOT.step(); IF.input.update(this.now); G.step(1 / 60); if (renderEvery && i % renderEvery === 0) G.render(); }
      catch (e) { errors++; if (errors < 5) console.error('SIM ERROR', e && e.stack); }
      if (G.state === 'dead') break;
    }
    const r = G.run;
    return { state: G.state, section: r.section, kills: r.kills, time: Math.round(r.time), level: IF.save.data.level, hp: Math.round(r.player.hp), enemies: r.enemies.length, alive: r.aliveCount(), parts: IF.fx.parts.aliveCount, poolSize: IF.fx.parts.items.length, proj: IF.combat.proj.items.length, decals: IF.fx.decals.length, pickups: r.world.pickups.length, props: r.world.props.length, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1, errors, gold: IF.save.data.gold };
  },
};
