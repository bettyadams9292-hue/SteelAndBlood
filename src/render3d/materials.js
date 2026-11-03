/* Procedural PBR materials: tileable noise -> colour, roughness and normal maps generated at load.
 * No external textures; every surface is original and licence-free. */
'use strict';

IF.mat = {
  cache: {}, tex: {},
  init(T, renderer) { this.T = T; this.aniso = renderer.capabilities.getMaxAnisotropy(); },

  /* Tileable value noise (periodic lattice) — fbm in [0,1]. */
  noiseField(size, freq, oct, seed) {
    const out = new Float32Array(size * size); let amp = 1, tot = 0;
    for (let o = 0; o < oct; o++) {
      const f = freq << o, lat = new Float32Array(f * f), rng = new IF.RNG(seed * 131 + o * 977);
      for (let i = 0; i < lat.length; i++) lat[i] = rng.next();
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const fx = x / size * f, fy = y / size * f, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        const a = lat[(iy % f) * f + ix % f], b = lat[(iy % f) * f + (ix + 1) % f], c = lat[((iy + 1) % f) * f + ix % f], d = lat[((iy + 1) % f) * f + (ix + 1) % f];
        out[y * size + x] += ((a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy) * amp;
      }
      tot += amp; amp *= 0.5;
    }
    for (let i = 0; i < out.length; i++) out[i] /= tot;
    return out;
  },
  canvasTex(size, paint, opts = {}) {
    const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
    paint(g, size); const t = new this.T.CanvasTexture(c);
    t.wrapS = t.wrapT = this.T.RepeatWrapping; t.anisotropy = Math.min(8, this.aniso);
    if (!opts.data) t.colorSpace = this.T.SRGBColorSpace;
    if (opts.repeat) t.repeat.set(opts.repeat, opts.repeat);
    return t;
  },
  fieldToTex(size, field, colorFn, data) {
    return this.canvasTex(size, (g) => {
      const im = g.createImageData(size, size);
      for (let i = 0; i < size * size; i++) { const c = colorFn(field[i], i); im.data[i * 4] = c[0]; im.data[i * 4 + 1] = c[1]; im.data[i * 4 + 2] = c[2]; im.data[i * 4 + 3] = 255; }
      g.putImageData(im, 0, 0);
    }, { data });
  },
  normalFromHeight(size, h, strength) {
    return this.fieldToTex(size, h, (v, i) => {
      const x = i % size, y = (i / size) | 0, l = h[y * size + (x - 1 + size) % size], r = h[y * size + (x + 1) % size], u = h[((y - 1 + size) % size) * size + x], d = h[((y + 1) % size) * size + x];
      let nx = (l - r) * strength, ny = (u - d) * strength, nz = 1; const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
      return [(nx * 0.5 + 0.5) * 255, (ny * 0.5 + 0.5) * 255, (nz * 0.5 + 0.5) * 255];
    }, true);
  },

  /* ---------- texture sets ---------- */
  groundDetail() { // greyscale-ish detail used under vertex-coloured terrain (macro colour comes from vertices)
    if (this.tex.ground) return this.tex.ground;
    const N = 512, h = this.noiseField(N, 8, 6, 11), pebbles = this.noiseField(N, 64, 2, 12);
    for (let i = 0; i < h.length; i++) h[i] = h[i] * 0.7 + Math.max(0, pebbles[i] - 0.62) * 1.6;
    const map = this.fieldToTex(N, h, (v) => { const c = 150 + v * 110; return [c, c * 0.96, c * 0.9]; });
    const rough = this.fieldToTex(N, h, (v) => { const c = 255 - v * 70; return [c, c, c]; }, true);
    const normal = this.normalFromHeight(N, h, 6);
    return (this.tex.ground = { map, rough, normal });
  },
  metalSet() {
    if (this.tex.metal) return this.tex.metal;
    const N = 256, h = this.noiseField(N, 4, 5, 21);
    const rough = this.canvasTex(N, (g) => {
      const im = g.createImageData(N, N); for (let i = 0; i < N * N; i++) { const c = 70 + h[i] * 90; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = c; im.data[i * 4 + 3] = 255; } g.putImageData(im, 0, 0);
      const rng = new IF.RNG(5); g.strokeStyle = 'rgba(30,30,30,0.6)'; g.lineWidth = 1; // scratches lower roughness locally (brighter = rougher, darker = polished)
      for (let i = 0; i < 160; i++) { g.globalAlpha = 0.25 + rng.next() * 0.4; g.beginPath(); const x = rng.next() * N, y = rng.next() * N, a = rng.next() * 6.28, L = 6 + rng.next() * 40; g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); }
    }, { data: true });
    const dents = this.noiseField(N, 16, 3, 22); const normal = this.normalFromHeight(N, dents, 1.6);
    return (this.tex.metal = { rough, normal });
  },
  clothSet() {
    if (this.tex.cloth) return this.tex.cloth;
    const N = 256, n = this.noiseField(N, 8, 4, 31);
    const h = new Float32Array(N * N); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) h[y * N + x] = (Math.sin(x * 1.6) * Math.sin(y * 1.6) * 0.5 + 0.5) * 0.4 + n[y * N + x] * 0.6;
    const normal = this.normalFromHeight(N, h, 2.5); const rough = this.fieldToTex(N, n, (v) => [230 - v * 40, 230 - v * 40, 230 - v * 40], true);
    return (this.tex.cloth = { normal, rough });
  },
  skinSet() {
    if (this.tex.skin) return this.tex.skin;
    const N = 256, n = this.noiseField(N, 6, 5, 41), spots = this.noiseField(N, 24, 2, 42);
    const map = this.canvasTex(N, (g) => {
      const im = g.createImageData(N, N);
      for (let i = 0; i < N * N; i++) { const v = n[i], s = spots[i] > 0.66 ? (spots[i] - 0.66) * 3 : 0; im.data[i * 4] = 205 - v * 50 - s * 90; im.data[i * 4 + 1] = 210 - v * 40 - s * 110; im.data[i * 4 + 2] = 195 - v * 45 - s * 100; im.data[i * 4 + 3] = 255; }
      g.putImageData(im, 0, 0); const rng = new IF.RNG(43);
      g.strokeStyle = 'rgba(70,40,90,0.35)'; g.lineWidth = 1.2; // veins
      for (let i = 0; i < 18; i++) { let x = rng.next() * N, y = rng.next() * N; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 6; j++) { x += (rng.next() - 0.5) * 24; y += rng.next() * 16; g.lineTo(x, y); } g.stroke(); }
      g.fillStyle = 'rgba(90,10,10,0.55)'; for (let i = 0; i < 14; i++) { g.beginPath(); g.ellipse(rng.next() * N, rng.next() * N, 2 + rng.next() * 8, 1 + rng.next() * 4, rng.next() * 3, 0, 6.28); g.fill(); }
    });
    const normal = this.normalFromHeight(N, n, 3);
    return (this.tex.skin = { map, normal });
  },
  /* Ashlar masonry: staggered blocks with recessed mortar, weathering noise and soot near the base. */
  stoneSet() {
    if (this.tex.stone) return this.tex.stone;
    const N = 256, n = this.noiseField(N, 8, 4, 77), n2 = this.noiseField(N, 3, 3, 78), h = new Float32Array(N * N), tint = new Float32Array(N * N);
    const rows = 4, bh = N / rows;
    for (let y = 0; y < N; y++) {
      const r = Math.floor(y / bh), off = (r % 2) * N / 4, bw = N / 2;
      for (let x = 0; x < N; x++) {
        const xx = (x + off) % N, bx = xx % bw, by = y % bh, edge = Math.min(bx, bw - bx, by, bh - by);
        const block = Math.floor(xx / bw) + r * 7;
        const m = Math.min(1, edge / 5); h[y * N + x] = m * (0.75 + n[y * N + x] * 0.25) - (1 - m) * 0.2;
        tint[y * N + x] = ((block * 9301 + 49297) % 233280) / 233280;
      }
    }
    const map = this.fieldToTex(N, h, (v, i) => { const k = 0.72 + tint[i] * 0.2 + n2[i] * 0.2 + n[i] * 0.12, mort = v < 0.2 ? 0.55 : 1; return [128 * k * mort, 124 * k * mort, 118 * k * mort]; });
    const normal = this.normalFromHeight(N, h, 3.5);
    const rough = this.fieldToTex(N, n, (v) => { const c = 200 + v * 50; return [c, c, c]; }, true);
    return (this.tex.stone = { map, normal, rough });
  },
  stone(color = '#8a847c', key) { return this.get(key || 'st' + color, () => { const s = this.stoneSet(); const m = new this.T.MeshStandardMaterial({ color, map: s.map, normalMap: s.normal, roughnessMap: s.rough, roughness: 1, metalness: 0 }); m.userData.worldUV = 2.2; return m; }); },
  woodSet() {
    if (this.tex.wood) return this.tex.wood;
    const N = 256, n = this.noiseField(N, 4, 4, 51);
    const map = this.canvasTex(N, (g) => {
      const im = g.createImageData(N, N);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = y * N + x, gr = Math.sin((x * 0.25 + n[i] * 18)) * 0.5 + 0.5; im.data[i * 4] = 120 + gr * 50; im.data[i * 4 + 1] = 85 + gr * 35; im.data[i * 4 + 2] = 55 + gr * 20; im.data[i * 4 + 3] = 255; }
      g.putImageData(im, 0, 0);
    });
    return (this.tex.wood = { map, normal: this.normalFromHeight(N, n, 2) });
  },

  /* ---------- material factory (cached) ---------- */
  get(key, make) { return this.cache[key] || (this.cache[key] = make()); },
  metal(color, rough = 0.38, metal = 0.92, key) {
    const k = key || 'm' + color + rough + metal; return this.get(k, () => { const s = this.metalSet(); return new this.T.MeshStandardMaterial({ color, roughness: rough, metalness: metal, roughnessMap: s.rough, normalMap: s.normal, normalScale: new this.T.Vector2(0.35, 0.35) }); });
  },
  cloth(color, key) { return this.get(key || 'c' + color, () => { const s = this.clothSet(); return new this.T.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0, normalMap: s.normal, roughnessMap: s.rough, side: this.T.DoubleSide }); }); },
  leather(color) { return this.get('l' + color, () => new this.T.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, normalMap: this.clothSet().normal, normalScale: new this.T.Vector2(0.4, 0.4) })); },
  wood(color) { return this.get('w' + (color || ''), () => { const s = this.woodSet(); return new this.T.MeshStandardMaterial({ color: color || '#ffffff', map: s.map, normalMap: s.normal, roughness: 0.85 }); }); },
  skin(color) { return this.get('s' + color, () => { const s = this.skinSet(); return new this.T.MeshStandardMaterial({ color, map: s.map, normalMap: s.normal, normalScale: new this.T.Vector2(0.6, 0.6), roughness: 0.72, metalness: 0 }); }); },
  basic(color, rough = 0.8, metal = 0) { return this.get('b' + color + rough + metal, () => new this.T.MeshStandardMaterial({ color, roughness: rough, metalness: metal })); },
  glow(color, intensity = 2) { return this.get('g' + color + intensity, () => new this.T.MeshStandardMaterial({ color: '#000000', emissive: color, emissiveIntensity: intensity, roughness: 1 })); },
  blood() { return this.get('blood', () => new this.T.MeshStandardMaterial({ color: '#5a0606', roughness: 0.22, metalness: 0.1 })); },
  bone() { return this.get('bone', () => new this.T.MeshStandardMaterial({ color: '#d8ccb0', roughness: 0.6 })); },
};
