/* STEEL & BLOOD: KNIGHTS OF THE APOCALYPSE — core namespace & utilities
 * Every module attaches itself to the global IF namespace. The build script
 * concatenates modules in dependency order (see build.js MODULES list). */
'use strict';
const IF = (window.IF = window.IF || {});
IF.VERSION = '1.0.0';
IF.TITLE = 'Steel & Blood: Knights of the Apocalypse';
IF.W = 1280; // logical render width
IF.H = 720;  // logical render height
IF.GROUND = 600; // world ground line (y)
IF.ZOOM = 1.12;  // world camera zoom (knight reads larger on screen)
IF.VIEW_W = IF.W / IF.ZOOM;
IF.CAN_FILTER = (() => { try { const c = document.createElement('canvas').getContext('2d'); c.filter = 'blur(1px)'; return c.filter === 'blur(1px)'; } catch (e) { return false; } })();

IF.util = {
  clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  sign: (v) => (v < 0 ? -1 : 1),
  approach(v, target, delta) {
    if (v < target) return Math.min(v + delta, target);
    return Math.max(v - delta, target);
  },
  easeOut: (t) => 1 - (1 - t) * (1 - t),
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  dist: (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay),
  rectsOverlap: (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y,
  fmt(n) {
    n = Math.floor(n);
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e4) return (n / 1e3).toFixed(1) + 'k';
    return String(n);
  },
  fmtTime(s) {
    s = Math.floor(s);
    const m = Math.floor(s / 60), r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  },
  uid: (() => { let i = 1; return () => 'u' + (Date.now().toString(36)) + (i++).toString(36); })(),
};

/* Mulberry32 seeded RNG — used for world generation (daily challenge seeds) and loot. */
IF.RNG = class RNG {
  constructor(seed) { this.s = (seed >>> 0) || 1; }
  next() {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p) { return this.next() < p; }
  weighted(entries) { // [{w, v}]
    let total = 0; for (const e of entries) total += e.w;
    let r = this.next() * total;
    for (const e of entries) { if ((r -= e.w) <= 0) return e.v; }
    return entries[entries.length - 1].v;
  }
};
IF.rng = new IF.RNG(Date.now());
IF.hashString = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/* Generic object pool to avoid GC churn for particles/projectiles. */
IF.Pool = class Pool {
  constructor(factory, size) {
    this.factory = factory; this.items = []; this.free = [];
    for (let i = 0; i < size; i++) { const o = factory(); o._alive = false; this.items.push(o); this.free.push(o); }
  }
  get() {
    let o = this.free.pop();
    if (!o) { o = this.factory(); this.items.push(o); }
    o._alive = true; return o;
  }
  release(o) { if (o._alive) { o._alive = false; this.free.push(o); } }
  forEachAlive(fn) { for (const o of this.items) if (o._alive) fn(o); }
  get aliveCount() { return this.items.length - this.free.length; }
};

/* Simple event bus for decoupled systems (achievements, audio, UI). */
IF.events = {
  map: {},
  on(name, fn) { (this.map[name] = this.map[name] || []).push(fn); },
  emit(name, data) { const l = this.map[name]; if (l) for (const fn of l) fn(data); },
};
