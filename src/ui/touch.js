/* Landscape touch controls — analogue stick on the left, action cluster on the right.
 * Multi-touch aware; writes into IF.input.touch so the game sees the same actions as keyboard/pad. */
'use strict';

IF.touch = {
  el: null, stickId: null, stickOrigin: null,
  BUTTONS: [
    { a: 'attack', label: '⚔', x: 0.905, y: 0.80, r: 1.3 }, { a: 'shoot', label: '◎', x: 0.79, y: 0.865, r: 1.05 },
    { a: 'jump', label: '⤒', x: 0.95, y: 0.58, r: 1 }, { a: 'dodge', label: '↻', x: 0.85, y: 0.62, r: 0.9 },
    { a: 'block', label: '⛨', x: 0.685, y: 0.895, r: 0.85 }, { a: 'special', label: '✠', x: 0.73, y: 0.69, r: 0.85 },
    { a: 'reload', label: 'R', x: 0.96, y: 0.38, r: 0.7 }, { a: 'switch', label: '⇄', x: 0.885, y: 0.42, r: 0.7 }, { a: 'pause', label: 'Ⅱ', x: 0.965, y: 0.2, r: 0.6 },
  ],
  init() {
    this.el = document.getElementById('touch');
    let h = '<div class="stick" id="stick"><div class="knob" id="knob"></div></div>';
    for (const b of this.BUTTONS) h += '<div class="tbtn" data-a="' + b.a + '" style="left:' + b.x * 100 + '%;top:' + b.y * 100 + '%;--r:' + b.r + '">' + b.label + '</div>';
    this.el.innerHTML = h; this.applySettings();
    const touched = {}; // touch id -> action
    const btnAt = (x, y) => { const t = document.elementFromPoint(x, y); return t && t.closest && t.closest('.tbtn'); };
    const update = (e) => {
      e.preventDefault(); const now = {};
      for (const t of e.touches) {
        if (t.identifier === this.stickId) { this.moveStick(t); continue; }
        const b = btnAt(t.clientX, t.clientY); if (b) now[b.dataset.a] = true;
      }
      for (const a of ['attack', 'shoot', 'jump', 'dodge', 'block', 'special', 'reload', 'switch', 'pause']) IF.input.touch[a] = !!now[a];
      this.el.querySelectorAll('.tbtn').forEach((b) => b.classList.toggle('on', !!now[b.dataset.a]));
    };
    this.el.addEventListener('touchstart', (e) => {
      IF.audio.unlock();
      for (const t of e.changedTouches) { const r = this.el.getBoundingClientRect(); if (t.clientX - r.left < r.width * 0.42 && this.stickId === null && !btnAt(t.clientX, t.clientY)) { this.stickId = t.identifier; this.stickOrigin = { x: t.clientX, y: t.clientY }; const s = document.getElementById('stick'); s.style.left = (t.clientX - r.left) + 'px'; s.style.top = (t.clientY - r.top) + 'px'; s.classList.add('on'); } }
      update(e);
    }, { passive: false });
    this.el.addEventListener('touchmove', update, { passive: false });
    const end = (e) => { for (const t of e.changedTouches) if (t.identifier === this.stickId) { this.stickId = null; IF.input.touchAxis = 0; IF.input.touch.down = false; IF.input.touch.sprint = false; document.getElementById('knob').style.transform = ''; document.getElementById('stick').classList.remove('on'); } update(e); };
    this.el.addEventListener('touchend', end, { passive: false }); this.el.addEventListener('touchcancel', end, { passive: false });
  },
  moveStick(t) {
    const dx = t.clientX - this.stickOrigin.x, dy = t.clientY - this.stickOrigin.y, R = 55 * IF.save.data.settings.touchSize;
    const d = Math.min(R, Math.hypot(dx, dy)), a = Math.atan2(dy, dx), kx = Math.cos(a) * d, ky = Math.sin(a) * d;
    document.getElementById('knob').style.transform = 'translate(' + kx + 'px,' + ky + 'px)';
    IF.input.touchAxis = Math.abs(kx) > R * 0.15 ? kx / R : 0;
    IF.input.touch.down = ky > R * 0.6; IF.input.touch.up = ky < -R * 0.6; IF.input.touch.sprint = Math.abs(kx) > R * 0.92;
    IF.input.lastDevice = 'touch';
  },
  applySettings() { if (!this.el) return; const s = IF.save.data.settings; this.el.style.setProperty('--ts', s.touchSize); this.el.style.setProperty('--to', s.touchOpacity); },
};
