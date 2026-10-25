// Table effects (candle, mist, fireflies) and short win animations
// (lanterns, gold dust, sakura). Each is one or two draw calls and cleans
// itself up. Purely cosmetic.

import * as THREE from 'three';

// ------------------------------------------------------------ sprite textures

const texCache = new Map<string, THREE.Texture>();
function spriteTex(key: string, size: number, draw: (g: CanvasRenderingContext2D, s: number) => void) {
  let t = texCache.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  t = new THREE.CanvasTexture(c);
  texCache.set(key, t);
  return t;
}

const softDot = () =>
  spriteTex('dot', 64, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.25, 'rgba(255,255,255,0.65)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
  });

export const sparkle = () =>
  spriteTex('sparkle', 64, (g, s) => {
    const c = s / 2;
    const gr = g.createRadialGradient(c, c, 0, c, c, c * 0.55);
    gr.addColorStop(0, 'rgba(255,248,225,1)');
    gr.addColorStop(0.35, 'rgba(255,214,130,0.55)');
    gr.addColorStop(1, 'rgba(255,200,110,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
    // A fine four-point glint.
    g.fillStyle = 'rgba(255,240,200,0.75)';
    g.beginPath();
    g.moveTo(c, 2);
    g.lineTo(c + 2, c);
    g.lineTo(c, s - 2);
    g.lineTo(c - 2, c);
    g.fill();
    g.beginPath();
    g.moveTo(2, c);
    g.lineTo(c, c + 2);
    g.lineTo(s - 2, c);
    g.lineTo(c, c - 2);
    g.fill();
  });

const lanternTex = () =>
  spriteTex('lantern', 128, (g, s) => {
    const c = s / 2;
    const glow = g.createRadialGradient(c, c, 0, c, c, c);
    glow.addColorStop(0, 'rgba(255,170,90,0.5)');
    glow.addColorStop(1, 'rgba(255,120,60,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, s, s);
    const body = g.createRadialGradient(c - 6, c - 8, 2, c, c, 30);
    body.addColorStop(0, '#ffe2a8');
    body.addColorStop(0.45, '#f08a3c');
    body.addColorStop(1, '#a8281f');
    g.fillStyle = body;
    g.beginPath();
    g.ellipse(c, c + 2, 24, 30, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(120,30,20,0.35)';
    g.lineWidth = 1.4;
    for (const rx of [8, 16]) {
      g.beginPath();
      g.ellipse(c, c + 2, rx, 29, 0, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = '#3a2416';
    g.fillRect(c - 12, c - 32, 24, 6);
    g.fillRect(c - 12, c + 28, 24, 6);
    g.fillStyle = '#c9a24a';
    g.fillRect(c - 12, c - 27, 24, 1.5);
  });

const petalTex = () =>
  spriteTex('petal', 64, (g, s) => {
    const c = s / 2;
    const gr = g.createLinearGradient(c, 8, c, s - 8);
    gr.addColorStop(0, '#fff3f5');
    gr.addColorStop(1, '#f4a7b9');
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(c, s - 8);
    g.bezierCurveTo(c - 22, c + 6, c - 16, 10, c - 4, 12);
    g.lineTo(c, 17);
    g.lineTo(c + 4, 12);
    g.bezierCurveTo(c + 16, 10, c + 22, c + 6, c, s - 8);
    g.fill();
    g.strokeStyle = 'rgba(214,110,140,0.35)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(c, s - 12);
    g.lineTo(c, 20);
    g.stroke();
  });

// ------------------------------------------------------------ particle points

const VERT = `
attribute float aSize;
attribute float aAlpha;
attribute float aRot;
attribute vec3 aColor;
uniform float uScale;
varying float vAlpha;
varying float vRot;
varying vec3 vColor;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uScale / max(0.1, -mv.z);
  vAlpha = aAlpha;
  vRot = aRot;
  vColor = aColor;
}`;

const FRAG = `
uniform sampler2D uMap;
varying float vAlpha;
varying float vRot;
varying vec3 vColor;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float c = cos(vRot), s = sin(vRot);
  p = mat2(c, -s, s, c) * p + 0.5;
  vec4 t = texture2D(uMap, clamp(p, 0.0, 1.0));
  float a = t.a * vAlpha;
  if (a < 0.004) discard;
  gl_FragColor = vec4(t.rgb * vColor, a);
}`;

/** One draw call of camera-facing, individually sized, faded and rotated sprites. */
export class Particles {
  readonly points: THREE.Points;
  readonly pos: Float32Array;
  readonly size: Float32Array;
  readonly alpha: Float32Array;
  readonly rot: Float32Array;
  readonly color: Float32Array;
  readonly mat: THREE.ShaderMaterial;

  constructor(
    readonly n: number,
    map: THREE.Texture,
    additive: boolean,
  ) {
    this.pos = new Float32Array(n * 3);
    this.size = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.rot = new Float32Array(n);
    this.color = new Float32Array(n * 3).fill(1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    geo.setAttribute('aRot', new THREE.BufferAttribute(this.rot, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.color, 3));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: map }, uScale: { value: 400 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  flush(scale: number) {
    this.mat.uniforms.uScale.value = scale;
    const a = this.points.geometry.attributes;
    a.position.needsUpdate = true;
    a.aAlpha.needsUpdate = true;
    a.aRot.needsUpdate = true;
    a.aSize.needsUpdate = true;
    a.aColor.needsUpdate = true;
  }

  dispose() {
    this.points.removeFromParent();
    this.points.geometry.dispose();
    this.mat.dispose();
  }
}

// ------------------------------------------------------------ win animations

export type WinAnimation = 'win-classic' | 'win-lanterns' | 'win-gold-dust' | 'win-sakura';

interface Burst {
  p: Particles;
  t0: number;
  dur: number;
  step: (t: number, dt: number) => void;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const fade = (t: number, inT: number, outT: number, dur: number) => Math.max(0, Math.min(1, t / inT, (dur - t) / outT));

export class Effects {
  private bursts: Burst[] = [];
  private candle?: { group: THREE.Group; light: THREE.PointLight; flame: THREE.Sprite; base: number };
  private mist?: { group: THREE.Group; textures: THREE.Texture[] };
  private flies?: { p: Particles; seed: Float32Array };
  private effect = 'fx-none';

  constructor(private scene: THREE.Scene) {}

  /** Win animation at the winning hand. 'win-classic' is the existing tile reveal, so it adds nothing. */
  playWin(id: string, anchor: THREE.Vector3, now: number) {
    if (id === 'win-lanterns') this.lanterns(anchor, now);
    else if (id === 'win-gold-dust') this.goldDust(anchor, now);
    else if (id === 'win-sakura') this.sakura(anchor, now);
  }

  /**
   * The win moment, for every win: fine gold motes appear along the winning
   * hand as a light sweeps from `a` to `b`, then drift up and fade, like dust
   * in a lamp's beam. A self-drawn win's motes rise higher and straighter; a
   * win on a discard first sends a thin thread of light from `from` (the
   * discarder's river) to the hand. Quiet by design: no coins, no bursts.
   */
  winSweep(a: THREE.Vector3, b: THREE.Vector3, now: number, o: { selfDrawn: boolean; from: THREE.Vector3 | null; dur: number }) {
    const lead = 0.35;
    const n = 90;
    const p = new Particles(n, sparkle(), true);
    const born = new Float32Array(n);
    const u = new Float32Array(n);
    const v = new Float32Array(n * 3);
    const ph = new Float32Array(n);
    const rise = o.selfDrawn ? 1 : 0.6;
    for (let i = 0; i < n; i++) {
      u[i] = Math.random();
      // Each mote appears as the sweep passes its place along the hand.
      born[i] = lead + u[i] * o.dur * 0.9 + rand(0, 0.15);
      v.set([rand(-0.05, 0.05), rand(0.18, 0.42) * rise * (o.selfDrawn ? 1.35 : 1), rand(-0.05, 0.05)], i * 3);
      ph[i] = rand(0, 6.28);
      p.size[i] = rand(0.035, 0.08);
      const warm = rand(0.8, 1);
      p.color.set([1, 0.84 * warm + 0.1, 0.5 * warm], i * 3);
    }
    const life = 1.5;
    const total = lead + o.dur + life;
    this.add(p, now, total, (t) => {
      for (let i = 0; i < n; i++) {
        const age = t - born[i];
        if (age < 0) {
          p.alpha[i] = 0;
          continue;
        }
        const x = a.x + (b.x - a.x) * u[i];
        const z = a.z + (b.z - a.z) * u[i];
        p.pos[i * 3] = x + v[i * 3] * age + Math.sin(age * 1.7 + ph[i]) * 0.03;
        p.pos[i * 3 + 1] = a.y - 0.25 + v[i * 3 + 1] * age * (1 - age * 0.12);
        p.pos[i * 3 + 2] = z + v[i * 3 + 2] * age;
        p.alpha[i] = fade(age, 0.18, 0.8, life) * (0.6 + 0.4 * Math.sin(age * 6 + ph[i]));
        p.rot[i] = age * 0.6 + ph[i];
      }
    });
    if (o.from) this.thread(o.from, a.clone().lerp(b, 0.5).setY(a.y - 0.2), now);
  }

  /** A thin line of light travelling from a discard to the hand it completed. */
  private thread(from: THREE.Vector3, to: THREE.Vector3, now: number) {
    const n = 26;
    const p = new Particles(n, sparkle(), true);
    for (let i = 0; i < n; i++) {
      p.size[i] = 0.07 * (1 - i / n) + 0.02;
      p.color.set([1, 0.9, 0.62], i * 3);
    }
    const dur = 0.9;
    this.add(p, now, dur, (t) => {
      for (let i = 0; i < n; i++) {
        // Each point trails the head a little, so the thread reads as a stroke.
        const k = Math.max(0, Math.min(1, (t - i * 0.012) / 0.6));
        const e = 1 - Math.pow(1 - k, 2);
        p.pos[i * 3] = from.x + (to.x - from.x) * e;
        p.pos[i * 3 + 1] = from.y + (to.y - from.y) * e + Math.sin(Math.PI * e) * 0.35;
        p.pos[i * 3 + 2] = from.z + (to.z - from.z) * e;
        p.alpha[i] = k <= 0 ? 0 : fade(t, 0.08, 0.3, dur) * (1 - i / n) * 0.9;
        p.rot[i] = 0;
      }
    });
  }

  private add(p: Particles, now: number, dur: number, step: Burst['step']) {
    this.scene.add(p.points);
    this.bursts.push({ p, t0: now, dur, step });
  }

  private lanterns(at: THREE.Vector3, now: number) {
    const n = 12;
    const p = new Particles(n, lanternTex(), false);
    const seed = Array.from({ length: n }, (_, i) => ({
      a: (i / n) * Math.PI * 2 + rand(-0.2, 0.2),
      r: rand(0.4, 1.6),
      v: rand(0.55, 0.95),
      d: rand(0, 0.5),
      ph: rand(0, 6),
      s: rand(0.34, 0.48),
    }));
    const dur = 2.6;
    this.add(p, now, dur, (t) => {
      seed.forEach((q, i) => {
        const tt = Math.max(0, t - q.d);
        const r = q.r + tt * 0.25;
        p.pos[i * 3] = at.x + Math.cos(q.a) * r + Math.sin(tt * 1.4 + q.ph) * 0.12;
        p.pos[i * 3 + 1] = at.y + 0.2 + tt * q.v + tt * tt * 0.08;
        p.pos[i * 3 + 2] = at.z + Math.sin(q.a) * r;
        p.size[i] = q.s;
        p.alpha[i] = t < q.d ? 0 : fade(tt, 0.35, 0.7, dur - q.d) * 0.95;
        p.rot[i] = Math.sin(tt * 1.6 + q.ph) * 0.12;
      });
    });
  }

  private goldDust(at: THREE.Vector3, now: number) {
    const n = 110;
    const p = new Particles(n, sparkle(), true);
    const v = new Float32Array(n * 3);
    const ph = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const up = rand(0.9, 2.2);
      const out = rand(0.3, 1.5);
      v.set([Math.cos(a) * out, up, Math.sin(a) * out], i * 3);
      p.pos.set([at.x + rand(-0.6, 0.6), at.y + 0.15, at.z + rand(-0.25, 0.25)], i * 3);
      ph[i] = rand(0, 6.28);
      p.size[i] = rand(0.05, 0.11);
      const warm = rand(0.75, 1);
      p.color.set([1, 0.86 * warm + 0.1, 0.55 * warm], i * 3);
    }
    const dur = 2.5;
    this.add(p, now, dur, (t, dt) => {
      for (let i = 0; i < n; i++) {
        // Rise, then drift down slowly, like dust in the light.
        v[i * 3 + 1] -= dt * 1.6;
        const drag = Math.pow(0.35, dt);
        v[i * 3] *= drag;
        v[i * 3 + 2] *= drag;
        if (v[i * 3 + 1] < -0.25) v[i * 3 + 1] = -0.25;
        p.pos[i * 3] += v[i * 3] * dt;
        p.pos[i * 3 + 1] += v[i * 3 + 1] * dt;
        p.pos[i * 3 + 2] += v[i * 3 + 2] * dt;
        p.alpha[i] = fade(t, 0.12, 0.9, dur) * (0.55 + 0.45 * Math.sin(t * 11 + ph[i]));
        p.rot[i] = t * 0.8 + ph[i];
      }
    });
  }

  private sakura(at: THREE.Vector3, now: number) {
    const n = 42;
    const p = new Particles(n, petalTex(), false);
    const seed = Array.from({ length: n }, () => ({
      x: rand(-2, 2),
      z: rand(-1.2, 1.2),
      y: rand(1.6, 3.6),
      v: rand(0.6, 1.0),
      sw: rand(0.15, 0.4),
      ph: rand(0, 6.28),
      spin: rand(-3, 3),
      d: rand(0, 0.6),
    }));
    for (let i = 0; i < n; i++) p.size[i] = rand(0.14, 0.2);
    const dur = 2.7;
    this.add(p, now, dur, (t) => {
      seed.forEach((q, i) => {
        const tt = Math.max(0, t - q.d);
        p.pos[i * 3] = at.x + q.x + Math.sin(tt * 1.8 + q.ph) * q.sw + tt * 0.25;
        p.pos[i * 3 + 1] = Math.max(at.y + 0.02, at.y + q.y - tt * q.v);
        p.pos[i * 3 + 2] = at.z + q.z + Math.cos(tt * 1.3 + q.ph) * q.sw * 0.6;
        p.alpha[i] = t < q.d ? 0 : fade(tt, 0.3, 0.6, dur - q.d);
        p.rot[i] = q.ph + tt * q.spin;
      });
    });
  }

  // ------------------------------------------------------------ table effects

  setEffect(id: string) {
    if (id === this.effect) return;
    this.effect = id;
    this.clearEffect();
    if (id === 'fx-candle') this.buildCandle();
    else if (id === 'fx-mist') this.buildMist();
    else if (id === 'fx-fireflies') this.buildFireflies();
  }

  private clearEffect() {
    if (this.candle) {
      this.candle.group.removeFromParent();
      this.candle.light.dispose();
      this.candle.group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      this.candle.flame.material.dispose();
      this.candle = undefined;
    }
    if (this.mist) {
      this.mist.group.removeFromParent();
      this.mist.group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      this.mist.textures.forEach((t) => t.dispose());
      this.mist = undefined;
    }
    if (this.flies) {
      this.flies.p.dispose();
      this.flies = undefined;
    }
  }

  /** A single brass candlestick standing on the left rim, with a warm flickering light. */
  private buildCandle() {
    const group = new THREE.Group();
    const brass = new THREE.MeshStandardMaterial({ color: '#c8a46a', metalness: 0.85, roughness: 0.3 });
    const wax = new THREE.MeshStandardMaterial({ color: '#f3ead6', roughness: 0.6, emissive: '#ffb45f', emissiveIntensity: 0.12 });
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.04, 24), brass);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.22, 16), brass);
    stem.position.y = 0.13;
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.05, 0.04, 20), brass);
    cup.position.y = 0.26;
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.26, 20), wax);
    candle.position.y = 0.41;
    for (const m of [foot, stem, cup, candle]) m.castShadow = true;
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: '#ffc27a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    flame.scale.set(0.09, 0.16, 1);
    flame.position.y = 0.6;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: '#ff9a4a', transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.set(0.6, 0.6, 1);
    halo.position.y = 0.6;
    const light = new THREE.PointLight('#ffb062', 6, 10, 1.6);
    light.position.y = 0.7;
    group.add(foot, stem, cup, candle, flame, halo, light);
    // On top of the raised rim (see table3d buildTable), clear of the walls and rivers.
    group.position.set(-4.62, 0.1, 0.9);
    this.scene.add(group);
    this.candle = { group, light, flame, base: 6 };
  }

  /** A low haze drifting over the felt and pooling around the table. */
  private buildMist() {
    const group = new THREE.Group();
    const textures: THREE.Texture[] = [];
    const mk = (seed: number) => {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const g = c.getContext('2d')!;
      let s = seed;
      const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 26; i++) {
        const x = r() * 256,
          y = r() * 256,
          rad = 40 + r() * 70;
        for (const dx of [-256, 0, 256])
          for (const dy of [-256, 0, 256]) {
            const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
            gr.addColorStop(0, 'rgba(255,255,255,0.22)');
            gr.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = gr;
            g.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2);
          }
      }
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      textures.push(t);
      return t;
    };
    const layer = (w: number, y: number, opacity: number, seed: number, repeat: number) => {
      const t = mk(seed);
      t.repeat.set(repeat, repeat);
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, w),
        new THREE.MeshBasicMaterial({ map: t, color: '#dfe6ea', transparent: true, opacity, depthWrite: false, fog: true }),
      );
      m.rotation.x = -Math.PI / 2;
      m.position.y = y;
      m.renderOrder = 2;
      group.add(m);
    };
    // Around and below the table edge, then the faintest whisper over the felt
    // (kept thin so discards never look washed out).
    layer(26, -0.32, 0.24, 11, 3);
    layer(26, -0.9, 0.2, 29, 2);
    layer(8.7, 0.05, 0.06, 47, 1.4);
    this.scene.add(group);
    this.mist = { group, textures };
  }

  private buildFireflies() {
    const n = 22;
    const p = new Particles(n, softDot(), true);
    const seed = new Float32Array(n * 5);
    for (let i = 0; i < n; i++) {
      seed.set([rand(0, 6.28), rand(5.4, 9), rand(0.3, 2.8), rand(0.05, 0.14), rand(0, 6.28)], i * 5);
      p.size[i] = rand(0.09, 0.14);
      p.color.set([0.9, 1, 0.54], i * 3);
    }
    this.scene.add(p.points);
    this.flies = { p, seed };
  }

  /** Per frame. `scale` is the point-size factor; `minimal` hides the particle effects. */
  update(now: number, dt: number, scale: number, minimal: boolean) {
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      const t = now - b.t0;
      if (t > b.dur) {
        b.p.dispose();
        this.bursts.splice(i, 1);
        continue;
      }
      b.step(t, dt);
      b.p.flush(scale);
    }
    if (this.candle) {
      const f = 0.86 + 0.08 * Math.sin(now * 9.3) + 0.05 * Math.sin(now * 23.7 + 1.3) + 0.04 * Math.sin(now * 3.1);
      this.candle.light.intensity = this.candle.base * f;
      this.candle.flame.scale.set(0.09 * (0.95 + 0.05 * f), 0.16 * f, 1);
    }
    if (this.mist) {
      const [a, b, c] = this.mist.textures;
      a.offset.set(now * 0.006, now * 0.003);
      b.offset.set(-now * 0.004, now * 0.005);
      c.offset.set(now * 0.005, -now * 0.004);
    }
    if (this.flies) {
      const { p, seed } = this.flies;
      p.points.visible = !minimal;
      if (!minimal) {
        for (let i = 0; i < p.n; i++) {
          const [a0, r, y, sp, ph] = seed.subarray(i * 5, i * 5 + 5);
          const a = a0 + now * sp * 0.4;
          p.pos[i * 3] = Math.cos(a) * r + Math.sin(now * 0.7 + ph) * 0.4;
          p.pos[i * 3 + 1] = y + Math.sin(now * 0.9 + ph) * 0.35;
          p.pos[i * 3 + 2] = Math.sin(a) * r + Math.cos(now * 0.6 + ph) * 0.4;
          const blink = Math.max(0, Math.sin(now * 1.3 + ph * 3));
          p.alpha[i] = 0.15 + 0.85 * blink * blink;
        }
        p.flush(scale);
      }
    }
  }

  /** Stop any running win animation (e.g. leaving a match). */
  clearBursts() {
    for (const b of this.bursts) b.p.dispose();
    this.bursts = [];
  }
}
