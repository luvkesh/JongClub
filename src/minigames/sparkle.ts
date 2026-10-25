// A small gold sparkle where a pair clears. One Points object, reused; quiet
// and short so it reads as club polish rather than an arcade burst.

import * as THREE from 'three';

const N = 48;

export class Sparkle {
  readonly points: THREE.Points;
  private pos = new Float32Array(N * 3);
  private vel = new Float32Array(N * 3);
  private life = new Float32Array(N);
  private alpha = new Float32Array(N);
  private next = 0;
  private live = 0;

  constructor() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { color: { value: new THREE.Color('#ffd98a') }, size: { value: 42 } },
      vertexShader: `attribute float alpha; varying float vA; uniform float size;
        void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 color; varying float vA;
        void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard; float s = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(color * (0.6 + s), s * vA); }`,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  burst(at: THREE.Vector3, n = 14, spread = 1) {
    for (let k = 0; k < n; k++) {
      const i = this.next;
      this.next = (this.next + 1) % N;
      this.pos.set([at.x, at.y, at.z], i * 3);
      const a = Math.random() * Math.PI * 2;
      const up = 0.6 + Math.random() * 0.9;
      const sp = (0.35 + Math.random() * 0.6) * spread;
      this.vel.set([Math.cos(a) * sp, up, Math.sin(a) * sp], i * 3);
      this.life[i] = 0.55 + Math.random() * 0.35;
    }
    this.live = 1.2;
  }

  /** True while sparks are in the air. */
  update(dt: number): boolean {
    if (this.live <= 0) return false;
    this.live -= dt;
    for (let i = 0; i < N; i++) {
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      this.vel[i * 3 + 1] -= dt * 2.2;
      for (let c = 0; c < 3; c++) this.pos[i * 3 + c] += this.vel[i * 3 + c] * dt;
      this.alpha[i] = Math.max(0, Math.min(1, this.life[i] * 2.2));
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.alpha.needsUpdate = true;
    return true;
  }

  dispose() {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}
