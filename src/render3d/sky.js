/* Sky, blood moon, clouds, fog and the day/night lighting presets.
 * Time of day advances with the journey: each section moves the clock (dusk -> night -> blood moon -> dawn). */
'use strict';

IF.sky = {
  TOD: [
    { id: 'dusk', name: 'Dusk', sunDir: [-0.55, 0.45, 0.7], sunI: 3.4, sunCol: '#ff9a5a', hemiI: 0.75, fogK: 1, skyMix: 0, stars: 0.1, moon: 0.6 },
    { id: 'night', name: 'Night', sunDir: [0.45, 0.7, 0.6], sunI: 2.0, sunCol: '#b8c8ff', hemiI: 0.5, fogK: 1.15, skyMix: 0.55, stars: 1, moon: 1 },
    { id: 'bloodmoon', name: 'Blood Moon', sunDir: [0.4, 0.7, 0.6], sunI: 2.4, sunCol: '#ff5a48', hemiI: 0.55, fogK: 1.25, skyMix: 0.35, stars: 0.7, moon: 1.3 },
    { id: 'dawn', name: 'Dawn', sunDir: [0.65, 0.35, 0.7], sunI: 3.0, sunCol: '#ffc890', hemiI: 0.85, fogK: 0.85, skyMix: -0.25, stars: 0, moon: 0.2 },
  ],
  todFor(section) { return this.TOD[(Math.floor((section - 1) / 1)) % this.TOD.length]; },

  init(scene) {
    const T = IF.r3.T; this.scene = scene;
    this.uniforms = { top: { value: new T.Color() }, mid: { value: new T.Color() }, bot: { value: new T.Color() }, stars: { value: 0 }, time: { value: 0 } };
    const mat = new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false, uniforms: this.uniforms,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top, mid, bot; uniform float stars, time; varying vec3 vP;
        float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164)))*43758.5453); }
        void main(){ float y = vP.y; vec3 c = y > 0.12 ? mix(mid, top, smoothstep(0.12, 0.75, y)) : mix(bot, mid, smoothstep(-0.12, 0.12, y));
          vec3 g = floor(vP*420.0); float s = step(0.9965, h(g)) * stars * smoothstep(0.1, 0.5, y) * (0.6 + 0.4*sin(time*2.0 + h(g)*40.0));
          gl_FragColor = vec4(c + s, 1.0); }`,
    });
    this.dome = new T.Mesh(new T.SphereGeometry(300, 32, 16), mat); this.dome.renderOrder = -10; scene.add(this.dome);
    // blood moon
    const mt = IF.mat.canvasTex(256, (g, N) => {
      const gr = g.createRadialGradient(N * 0.4, N * 0.38, N * 0.05, N / 2, N / 2, N / 2); gr.addColorStop(0, '#f08a5a'); gr.addColorStop(0.65, '#b0281e'); gr.addColorStop(1, '#5a0c0c');
      g.fillStyle = gr; g.beginPath(); g.arc(N / 2, N / 2, N / 2 - 1, 0, 6.283); g.fill(); const r = new IF.RNG(9);
      for (let i = 0; i < 26; i++) { g.fillStyle = 'rgba(70,8,8,' + (0.15 + r.next() * 0.3) + ')'; g.beginPath(); g.arc(N * (0.2 + r.next() * 0.6), N * (0.2 + r.next() * 0.6), 4 + r.next() * 22, 0, 6.283); g.fill(); }
    });
    this.moon = new T.Mesh(new T.CircleGeometry(9, 48), new T.MeshBasicMaterial({ map: mt, transparent: true, fog: false, depthWrite: false })); scene.add(this.moon);
    const gt = IF.mat.canvasTex(128, (g, N) => { const gr = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2); gr.addColorStop(0, 'rgba(255,80,50,0.55)'); gr.addColorStop(0.4, 'rgba(200,30,20,0.18)'); gr.addColorStop(1, 'rgba(120,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, N, N); });
    this.halo = new T.Mesh(new T.PlaneGeometry(70, 70), new T.MeshBasicMaterial({ map: gt, transparent: true, fog: false, depthWrite: false, blending: T.AdditiveBlending })); scene.add(this.halo);
    // clouds
    const ct = IF.mat.canvasTex(256, (g, N) => { const f = IF.mat.noiseField(N, 4, 5, 77); const im = g.createImageData(N, N); for (let i = 0; i < N * N; i++) { const x = i % N, y = (i / N) | 0, e = Math.min(1, Math.min(x, N - x, y, N - y) / 50), a = Math.max(0, f[i] - 0.42) * 2.4 * e; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = 255; im.data[i * 4 + 3] = a * 255; } g.putImageData(im, 0, 0); });
    this.clouds = [];
    for (let i = 0; i < 7; i++) { const m = new T.Mesh(new T.PlaneGeometry(90, 26), new T.MeshBasicMaterial({ map: ct, transparent: true, depthWrite: false, fog: false, opacity: 0.55 })); m.userData.off = i * 61; m.userData.y = 18 + (i % 3) * 7; m.userData.z = -120 - i * 12; scene.add(m); this.clouds.push(m); }
    scene.fog = new T.FogExp2('#3a2a2a', 0.018);
  },
  lighting(b, run) {
    const tod = this.todFor(run.section);
    if (b.indoor) return { sunDir: [0.3, 1, 0.4], tod };
    return { sunDir: tod.sunDir, tod };
  },
  update(R, run, dt) {
    const b = run.world.biome, tod = this.todFor(run.section), T = R.T, u = this.uniforms, cam = R.camera;
    const mix = (a, c, k) => new T.Color(a).lerp(new T.Color(c), Math.max(0, k));
    let top = new T.Color(b.sky[0]), mid = new T.Color(b.sky[1]), bot = new T.Color(b.sky[2]);
    if (tod.skyMix > 0) { top.lerp(new T.Color('#05060c'), tod.skyMix); mid.lerp(new T.Color('#120c18'), tod.skyMix * 0.8); bot.lerp(new T.Color('#2a1414'), tod.skyMix * 0.5); }
    if (tod.skyMix < 0) { mid.lerp(new T.Color('#c88a6a'), -tod.skyMix); bot.lerp(new T.Color('#f0b080'), -tod.skyMix * 1.2); }
    if (tod.id === 'bloodmoon') { mid.lerp(new T.Color('#5a1010'), 0.35); bot.lerp(new T.Color('#8a2010'), 0.3); }
    if (b.indoor) { top.set('#050607'); mid.set('#0b0e0f'); bot.set('#141a1a'); }
    u.top.value.copy(top); u.mid.value.copy(mid); u.bot.value.copy(bot); u.stars.value = b.indoor ? 0 : tod.stars; u.time.value = R.clock;
    this.dome.position.copy(cam.position);
    // fog takes the horizon colour so geometry melts into the sky
    const fogCol = bot.clone().lerp(mid, 0.35); R.scene.fog.color.copy(fogCol);
    R.scene.fog.density = (b.indoor ? 0.045 : 0.016) * tod.fogK * (run.mods.fog || 1);
    // moon behind the action, parallaxed far away
    const mv = !b.indoor; this.moon.visible = this.halo.visible = mv;
    this.moon.position.set(cam.position.x + 26, cam.position.y + 26, -170); this.moon.lookAt(cam.position);
    this.halo.position.copy(this.moon.position).z += 1; this.halo.lookAt(cam.position);
    this.moon.material.opacity = Math.min(1, tod.moon); this.halo.material.opacity = Math.min(1, tod.moon * 0.9);
    for (const c of this.clouds) { c.visible = mv; const x = ((c.userData.off + R.clock * 1.2) % 420) - 210; c.position.set(cam.position.x * 0.7 + x, c.userData.y, c.userData.z); c.material.color.copy(mid).lerp(new T.Color('#000000'), 0.35); c.lookAt(cam.position.x * 0.7 + x, c.userData.y, 0); }
    // lights
    const key = new T.Color(tod.sunCol).lerp(new T.Color(b.light), 0.35);
    R.sun.color.copy(key); R.sun.intensity = b.indoor ? 0.9 : tod.sunI;
    R.hemi.color.copy(mid).lerp(new T.Color('#9aa0c0'), 0.3); R.hemi.groundColor.set(b.ground); R.hemi.intensity = (b.indoor ? 0.9 : tod.hemiI) * 1.6;
    R.rim.color.set(tod.id === 'dawn' ? '#ffd0a0' : '#8aa0ff'); R.rim.intensity = 0.8;
    if (b.id === 'home') { R.hemi.color.set('#ffd8b0'); R.hemi.groundColor.set('#3a2414'); R.hemi.intensity = 2.2; R.sun.intensity = 0.6; }
    R.renderer.toneMappingExposure = b.id === 'home' ? 1.6 : b.indoor ? 1.35 : tod.id === 'night' ? 1.45 : 1.3;
    this.current = tod;
  },
};
