/* Input system — action-based, unified across keyboard, mouse, gamepad and touch.
 * Systems never read raw keys; they query actions: IF.input.down('jump'), pressed('attack')…
 * Presses are timestamped so the player controller can buffer inputs. */
'use strict';

IF.ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'attack', 'shoot', 'block', 'dodge', 'special', 'reload', 'switch', 'sprint', 'w1', 'w2', 'w3', 'tactical', 'tacnext', 'companion', 'pause'];
IF.ACTION_LABELS = { left: 'Move Left', right: 'Move Right', up: 'Aim Up (keyboard)', down: 'Crouch', jump: 'Jump', attack: 'Melee Attack (hold = heavy)', shoot: 'Shoot', block: 'Block', dodge: 'Dodge Roll', special: 'Special Ability', reload: 'Reload', switch: 'Switch Weapon', sprint: 'Sprint', w1: 'Melee Weapon', w2: 'Primary Firearm', w3: 'Secondary Firearm', tactical: 'Throw / Deploy Tactical', tacnext: 'Cycle Tactical', companion: 'Companion Command (Hold / Follow)', pause: 'Pause' };

IF.DEFAULT_KEYS = {
  left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'],
  jump: ['Space', 'KeyW'], attack: ['KeyJ', 'Mouse2'], shoot: ['KeyK', 'Mouse0'], block: ['KeyU'], dodge: ['KeyL', 'ShiftRight'],
  special: ['KeyE'], reload: ['KeyR'], switch: ['KeyQ', 'Wheel'], sprint: ['ShiftLeft'], w1: ['Digit1'], w2: ['Digit2'], w3: ['Digit3'], tactical: ['KeyG'], tacnext: ['KeyT'], companion: ['KeyC'], pause: ['Escape', 'KeyP'],
};
/* Standard gamepad mapping (Xbox layout names). */
IF.DEFAULT_PAD = { jump: [0], dodge: [1], attack: [2], special: [3], reload: [4], switch: [5], block: [6], shoot: [7], pause: [9], sprint: [10], up: [12], down: [13], left: [14], right: [15], tactical: [11], tacnext: [8] };
IF.PAD_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'L3', 'R3', 'D-Up', 'D-Down', 'D-Left', 'D-Right', 'Home'];

IF.input = {
  keys: {}, // code -> bool
  state: {}, prev: {}, pressTime: {}, downSince: {},
  touch: {}, // action -> bool (virtual)
  axisX: 0, // analogue -1..1
  mouse: { x: 0, y: 0 }, mouseAim: false, padAim: null,
  padConnected: false, padIndex: -1,
  wheelPulse: false,
  rebinding: null, // {action, kind, cb}
  lastDevice: 'keyboard',
  now: 0,

  init(canvas) {
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') && e.target.type !== 'range') return;
      if (this.rebinding && this.rebinding.kind === 'key') { e.preventDefault(); this._finishRebind(e.code); return; }
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      this.keys[e.code] = true; this.lastDevice = 'keyboard';
      IF.audio && IF.audio.unlock();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; });
    // pointer position in logical (1280x720) screen space, used for aiming
    const track = (e) => { const r = canvas.getBoundingClientRect(); this.mouse = { x: (e.clientX - r.left) * IF.W / r.width, y: (e.clientY - r.top) * IF.H / r.height }; this.mouseAim = true; this.lastDevice = 'keyboard'; };
    window.addEventListener('mousemove', (e) => { if (e.movementX || e.movementY) track(e); });
    canvas.addEventListener('mousedown', track);
    canvas.addEventListener('mousedown', (e) => {
      this.keys['Mouse' + e.button] = true; this.lastDevice = 'keyboard'; IF.audio && IF.audio.unlock();
    });
    window.addEventListener('mouseup', (e) => { this.keys['Mouse' + e.button] = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { this.wheelPulse = true; e.preventDefault(); }, { passive: false });
    window.addEventListener('gamepadconnected', (e) => { this.padConnected = true; this.padIndex = e.gamepad.index; IF.events.emit('toast', { text: 'Controller connected: ' + e.gamepad.id.slice(0, 32) }); });
    window.addEventListener('gamepaddisconnected', () => { this.padConnected = false; this.padIndex = -1; });
  },

  bindings() { const s = IF.save && IF.save.data && IF.save.data.settings; return { keys: Object.assign({}, IF.DEFAULT_KEYS, s && s.keys), pad: Object.assign({}, IF.DEFAULT_PAD, s && s.pad) }; },

  readPad() {
    if (!navigator.getGamepads) return null;
    const pads = navigator.getGamepads();
    let gp = this.padIndex >= 0 ? pads[this.padIndex] : null;
    if (!gp) for (const p of pads) if (p) { gp = p; this.padIndex = p.index; this.padConnected = true; break; }
    return gp;
  },

  /* Called once per frame before game update. */
  update(now) {
    this.now = now;
    const b = this.bindings();
    const gp = this.readPad();
    if (this.rebinding && this.rebinding.kind === 'pad' && gp) {
      gp.buttons.forEach((btn, i) => { if (btn.pressed && !this._padPrev?.[i]) this._finishRebind(i); });
      this._padPrev = gp.buttons.map((x) => x.pressed);
      return;
    }
    let ax = 0;
    for (const a of IF.ACTIONS) {
      this.prev[a] = this.state[a];
      let d = false;
      for (const code of b.keys[a] || []) {
        if (code === 'Wheel') { if (this.wheelPulse) d = true; } else if (this.keys[code]) d = true;
      }
      if (gp) for (const bi of b.pad[a] || []) if (gp.buttons[bi] && (gp.buttons[bi].pressed || gp.buttons[bi].value > 0.4)) { d = true; this.lastDevice = 'gamepad'; }
      if (this.touch[a]) d = true;
      this.state[a] = d;
      if (d && !this.prev[a]) { this.pressTime[a] = now; this.downSince[a] = now; }
    }
    this.wheelPulse = false;
    if (gp) {
      const sx = gp.axes[0] || 0, sy = gp.axes[1] || 0;
      if (Math.abs(sx) > 0.2) { ax = sx; this.lastDevice = 'gamepad'; }
      if (sy > 0.6) { this.state.down = true; if (!this.prev.down) this.pressTime.down = now; }
      if (sy < -0.6) this.state.up = true;
    }
    this.padAim = null;
    if (gp && Math.hypot(gp.axes[2] || 0, gp.axes[3] || 0) > 0.35) { this.padAim = { x: gp.axes[2], y: gp.axes[3] }; this.mouseAim = false; }
    if (gp && this.lastDevice === 'gamepad') this.mouseAim = false;
    if (this.touchAxis) { ax = this.touchAxis; this.mouseAim = false; }
    if (!ax) ax = (this.state.right ? 1 : 0) - (this.state.left ? 1 : 0);
    this.axisX = ax;
  },
  down(a) { return !!this.state[a]; },
  pressed(a) { return !!this.state[a] && !this.prev[a]; },
  released(a) { return !this.state[a] && !!this.prev[a]; },
  heldFor(a) { return this.state[a] ? (this.now - (this.downSince[a] || this.now)) / 1000 : 0; },
  /* True if `a` was pressed within the buffer window and not yet consumed. */
  buffered(a, windowMs = 140) { const t = this.pressTime[a]; return t !== undefined && this.now - t <= windowMs; },
  consume(a) { this.pressTime[a] = -1e9; },

  startRebind(action, kind, cb) { this.rebinding = { action, kind, cb }; this._padPrev = null; },
  _finishRebind(code) {
    const r = this.rebinding; this.rebinding = null;
    const s = IF.save.data.settings;
    if (r.kind === 'key') { if (code !== 'Escape') { s.keys[r.action] = [code]; } }
    else { s.pad[r.action] = [code]; }
    IF.save.write(); r.cb && r.cb();
  },
  keyLabel(action) {
    const b = this.bindings();
    if (this.lastDevice === 'gamepad') { const p = b.pad[action]; return p && p.length ? IF.PAD_NAMES[p[0]] || 'B' + p[0] : '—'; }
    const k = b.keys[action]; if (!k || !k.length) return '—';
    return k[0].replace('Key', '').replace('Digit', '').replace('Mouse0', 'LMB').replace('Mouse2', 'RMB').replace('Arrow', '').replace('Left', 'L-').replace('Right', 'R-');
  },
};
