// Set pieces for the three signature venues (cosmetics/venues.ts): their
// floors, the sadu rug, their pendants (a ceiling fan with opal globes, a
// jansō's square table lamp, a cluster of pierced brass lanterns) and the
// things standing round the room (birdcages and tea tables; the parlour's
// other tables; coffee trays and floor lanterns). Procedural and cheap: a few
// merged meshes per venue, and none of it on low-tier devices.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { EnvironmentStyle } from '../cosmetics/catalog';
import type { QualitySpec } from './quality';
import { saduBand } from './venueRooms';

const FLOOR_Y = -1.6;

function canvas(w: number, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}

const srgb = (c: HTMLCanvasElement) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

let glowTex: THREE.Texture | undefined;
function glowTexture() {
  if (glowTex) return glowTex;
  const [c, g] = canvas(64);
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(255,255,255,0.5)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

const glowSprite = (color: string, size: number, opacity: number) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  s.scale.set(size, size, 1);
  return s;
};

const emissive = (color: string, k = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k) });

// ------------------------------------------------------------ floors and rug

/** Paint a venue floor into a 512 canvas; returns how often it repeats across the floor. */
export function paintVenueFloor(kind: EnvironmentStyle['floor'], g: CanvasRenderingContext2D, S: number, r: () => number): number {
  switch (kind) {
    case 'mosaic': {
      // Hong Kong mosaic: small cream tiles with diamonds of green and brick red.
      const n = 32,
        t = S / n;
      g.fillStyle = '#3a3428';
      g.fillRect(0, 0, S, S);
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          const dx = Math.abs((x % 16) - 7.5),
            dy = Math.abs((y % 16) - 7.5);
          const d = dx + dy;
          const col = d < 2 ? '#7a3426' : d > 6.5 && d < 8 ? '#2a5040' : d < 4.5 && d > 3.5 ? '#2a5040' : '#b8ac8e';
          const k = 0.92 + r() * 0.1;
          const c = new THREE.Color(col).multiplyScalar(k);
          g.fillStyle = `#${c.getHexString()}`;
          g.fillRect(x * t + 1, y * t + 1, t - 2, t - 2);
        }
      return 9;
    }
    case 'carpet': {
      // A parlour's low-pile carpet: deep green with a small woven lattice.
      g.fillStyle = '#18282a';
      g.fillRect(0, 0, S, S);
      const img = g.getImageData(0, 0, S, S);
      for (let i = 0; i < img.data.length; i += 4) {
        const n = (r() - 0.5) * 16;
        img.data[i] += n;
        img.data[i + 1] += n;
        img.data[i + 2] += n;
      }
      g.putImageData(img, 0, 0);
      g.strokeStyle = 'rgba(160,190,170,0.08)';
      g.lineWidth = 2;
      for (let k = 0; k < S; k += 32) {
        g.beginPath();
        g.moveTo(k, 0);
        g.lineTo(k + S, S);
        g.moveTo(k, 0);
        g.lineTo(k - S, S);
        g.stroke();
      }
      g.fillStyle = 'rgba(200,170,110,0.12)';
      for (let y = 16; y < S; y += 32) for (let x = 0; x < S; x += 32) g.fillRect(x - 2, y - 2, 4, 4);
      return 8;
    }
    case 'limestone':
    default: {
      // Pale limestone slabs, warm and slightly worn.
      const n = 2,
        t = S / n;
      g.fillStyle = '#5a4a34';
      g.fillRect(0, 0, S, S);
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          const k = r();
          g.fillStyle = `rgb(${196 + k * 18},${176 + k * 16},${140 + k * 12})`;
          g.fillRect(x * t + 2, y * t + 2, t - 4, t - 4);
          for (let i = 0; i < 400; i++) {
            g.fillStyle = r() < 0.5 ? `rgba(90,70,40,${r() * 0.12})` : `rgba(255,248,230,${r() * 0.1})`;
            g.fillRect(x * t + r() * t, y * t + r() * t, 1 + r() * 3, 1 + r() * 2);
          }
        }
      return 10;
    }
  }
}

/** The majlis rug: rows of sadu weave in a black border. */
export function paintSaduRug(g: CanvasRenderingContext2D, S: number) {
  g.fillStyle = '#1a1210';
  g.fillRect(0, 0, S, S);
  const rows = 5;
  const h = (S - 60) / rows;
  for (let i = 0; i < rows; i++) saduBand(g, 30, 30 + i * h, S - 60, h - 4, 1.4);
  g.strokeStyle = '#e8dcc2';
  g.lineWidth = 3;
  g.strokeRect(18, 18, S - 36, S - 36);
}

// ------------------------------------------------------------ pendants

function piercedTexture(color: string) {
  const [c, g] = canvas(128);
  g.fillStyle = '#4a2e10';
  g.fillRect(0, 0, 128, 128);
  for (let y = 8; y < 128; y += 16)
    for (let x = (y / 16) % 2 ? 8 : 0; x < 128; x += 16) {
      const gr = g.createRadialGradient(x, y, 0, x, y, 6);
      gr.addColorStop(0, '#fff2c8');
      gr.addColorStop(0.5, color);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.beginPath();
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const rad = k % 2 ? 2 : 5;
        g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
      }
      g.fill();
    }
  return srgb(c);
}

/** One pierced brass lantern; its bottom sits at y = 0. */
function brassLantern(brass: THREE.Material, warm: string, s = 1) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * s, 0.48 * s, 0.9 * s, 8, 1, true), new THREE.MeshBasicMaterial({ map: piercedTexture(warm), side: THREE.DoubleSide }));
  body.position.y = 0.55 * s;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.45 * s, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), brass);
  dome.position.y = 1.0 * s;
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.08 * s, 0.4 * s, 8), brass);
  spire.position.y = 1.6 * s;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5 * s, 0.2 * s, 0.22 * s, 8), brass);
  base.position.y = 0.05 * s;
  const inner = glowSprite(warm, 1.6 * s, 0.35);
  inner.position.y = 0.55 * s;
  g.add(body, dome, spire, base, inner);
  return g;
}

/**
 * The venue pendants, in lamp space (bottom near y = -0.3, rod up to the
 * ceiling). A part with userData.spin turns slowly (the fan's blades).
 */
export function buildVenueLamp(kind: EnvironmentStyle['lamp'], warm: string, lacquer: THREE.Material, brass: THREE.Material): THREE.Object3D[] {
  const parts: THREE.Object3D[] = [];
  const rod = (len: number, y: number, x = 0, z = 0, mat = brass, r = 0.03) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), mat);
    m.position.set(x, y + len / 2, z);
    parts.push(m);
  };
  if (kind === 'fan') {
    // A teak and brass ceiling fan with a light kit of opal globes.
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.32, 24), brass);
    motor.position.y = 1.0;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), brass);
    cap.position.y = 1.16;
    const blades = new THREE.Group();
    blades.userData.spin = 0.9;
    blades.position.y = 0.95;
    const teak = new THREE.MeshStandardMaterial({ color: '#4a2a14', roughness: 0.5 });
    for (let k = 0; k < 4; k++) {
      const b = new THREE.Mesh(new RoundedBoxGeometry(1.9, 0.035, 0.36, 2, 0.015), teak);
      b.position.x = 1.25;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 0.08), brass);
      arm.position.x = 0.45;
      const pivot = new THREE.Group();
      pivot.rotation.y = (k * Math.PI) / 2;
      b.rotation.x = 0.12;
      pivot.add(b, arm);
      blades.add(pivot);
    }
    const kit = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, 0.3, 16), brass);
    kit.position.y = 0.65;
    parts.push(motor, cap, blades, kit);
    const opal = emissive(warm, 1.25);
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2 + Math.PI / 4;
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), brass);
      arm.position.set(Math.cos(a) * 0.25, 0.48, Math.sin(a) * 0.25);
      arm.rotation.z = Math.cos(a) * 0.9;
      arm.rotation.x = -Math.sin(a) * 0.9;
      const globe = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), opal);
      globe.position.set(Math.cos(a) * 0.45, 0.22, Math.sin(a) * 0.45);
      parts.push(arm, globe);
    }
    const centre = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), opal);
    centre.position.y = 0.28;
    parts.push(centre);
    rod(8.4, 1.15);
  } else if (kind === 'fluoro') {
    // The jansō lamp: a square enamel shade over a frosted panel, on four chains.
    const enamel = new THREE.MeshStandardMaterial({ color: '#2f4a3e', roughness: 0.35, metalness: 0.2, side: THREE.DoubleSide });
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.75, 0.5, 4, 1, true), enamel);
    shade.rotation.y = Math.PI / 4;
    shade.position.y = 0.2;
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.99, 1.74, 0.49, 4, 1, true), emissive('#f2f4ee', 0.9));
    (inner.material as THREE.MeshBasicMaterial).side = THREE.BackSide;
    inner.rotation.y = Math.PI / 4;
    inner.position.y = 0.2;
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), emissive('#f6f8ff', 1.35));
    panel.rotation.x = Math.PI / 2;
    panel.position.y = -0.04;
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.06, 1.42), enamel);
    top.position.y = 0.46;
    parts.push(shade, inner, panel, top);
    for (const [x, z] of [
      [-0.6, -0.6],
      [0.6, -0.6],
      [-0.6, 0.6],
      [0.6, 0.6],
    ])
      rod(9, 0.49, x, z, new THREE.MeshStandardMaterial({ color: '#888884', metalness: 0.8, roughness: 0.4 }), 0.012);
  } else if (kind === 'majlis') {
    // Three pierced brass lanterns hung at different heights.
    for (const [x, y, z, s] of [
      [0, 0, 0, 1],
      [1.0, 0.8, 0.45, 0.72],
      [-0.85, 1.1, -0.55, 0.62],
    ]) {
      const l = brassLantern(brass, warm, s);
      l.position.set(x, y - 0.25, z);
      parts.push(l);
      rod(9, y - 0.25 + 1.75 * s, x, z, brass, 0.015);
    }
  }
  void lacquer;
  return parts;
}

// ------------------------------------------------------------ set pieces

/** A domed birdcage drawn in fine bamboo lines, with a base, a hook and a small bird. */
function birdcage(): THREE.Group {
  const g = new THREE.Group();
  const pts: number[] = [];
  const R = 0.42,
    Hc = 0.55,
    dome = 0.35,
    bars = 18;
  const prof = (t: number): [number, number] => (t < 0.6 ? [R, (t / 0.6) * Hc] : [R * Math.cos(((t - 0.6) / 0.4) * (Math.PI / 2)), Hc + Math.sin(((t - 0.6) / 0.4) * (Math.PI / 2)) * dome]);
  for (let b = 0; b < bars; b++) {
    const a = (b / bars) * Math.PI * 2;
    for (let s = 0; s < 10; s++) {
      const [r0, y0] = prof(s / 10),
        [r1, y1] = prof((s + 1) / 10);
      pts.push(Math.cos(a) * r0, y0, Math.sin(a) * r0, Math.cos(a) * r1, y1, Math.sin(a) * r1);
    }
  }
  for (const y of [0.04, Hc * 0.5, Hc]) {
    for (let k = 0; k < 24; k++) {
      const a0 = (k / 24) * Math.PI * 2,
        a1 = ((k + 1) / 24) * Math.PI * 2;
      pts.push(Math.cos(a0) * R, y, Math.sin(a0) * R, Math.cos(a1) * R, y, Math.sin(a1) * R);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#c8a46a', transparent: true, opacity: 0.85 })));
  const base = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.04, R + 0.04, 0.07, 24), new THREE.MeshStandardMaterial({ color: '#3a2212', roughness: 0.5 }));
  g.add(base);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 6, 16), new THREE.MeshStandardMaterial({ color: '#c8a46a', metalness: 1, roughness: 0.3 }));
  hook.position.y = Hc + dome + 0.07;
  g.add(hook);
  const bird = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshStandardMaterial({ color: '#d8b84a', roughness: 0.6 }));
  bird.scale.set(1.4, 1, 1);
  bird.position.y = 0.28;
  bird.userData.bird = true;
  g.add(bird);
  return g;
}

/** A neighbouring parlour table: felt, a rim, four squared walls of tiles, four stools and its own lamp. */
function parlourTable(): THREE.Group {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#241812', roughness: 0.45 });
  const felt = new THREE.MeshStandardMaterial({ color: '#1f4a3a', roughness: 0.9 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(3.4, 1.4, 3.4, 2, 0.08), wood);
  body.position.y = -0.85;
  const top = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.02, 3.0), felt);
  top.position.y = -0.14;
  g.add(body, top);
  // Tile walls: one merged geometry, ivory with blue backs.
  const walls: THREE.BufferGeometry[] = [];
  for (let s = 0; s < 4; s++) {
    const len = 1.9;
    const b = new THREE.BoxGeometry(len, 0.18, 0.13);
    b.translate(0, -0.04, 0.95);
    b.rotateY((s * Math.PI) / 2);
    walls.push(b);
  }
  g.add(new THREE.Mesh(mergeGeometries(walls)!, new THREE.MeshStandardMaterial({ color: '#e9e2cf', roughness: 0.4 })));
  const backs: THREE.BufferGeometry[] = [];
  for (let s = 0; s < 4; s++) {
    const b = new THREE.BoxGeometry(1.9, 0.02, 0.13);
    b.translate(0, 0.06, 0.95);
    b.rotateY((s * Math.PI) / 2);
    backs.push(b);
  }
  g.add(new THREE.Mesh(mergeGeometries(backs)!, new THREE.MeshStandardMaterial({ color: '#2a4a8a', roughness: 0.3 })));
  // Stools.
  const stoolGeo = new THREE.CylinderGeometry(0.42, 0.38, 0.9, 16);
  const stoolMat = new THREE.MeshStandardMaterial({ color: '#2a3654', roughness: 0.6 });
  for (let s = 0; s < 4; s++) {
    const st = new THREE.Mesh(stoolGeo, stoolMat);
    const a = (s * Math.PI) / 2;
    st.position.set(Math.sin(a) * 2.4, -1.15, Math.cos(a) * 2.4);
    g.add(st);
  }
  // Its own square lamp, lit, and a soft pool on the felt.
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), emissive('#f6f8ff', 1.2));
  panel.rotation.x = Math.PI / 2;
  panel.position.y = 4.4;
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.32, 0.4, 4, 1, true), new THREE.MeshStandardMaterial({ color: '#2f4a3e', roughness: 0.35, side: THREE.DoubleSide }));
  shade.rotation.y = Math.PI / 4;
  shade.position.y = 4.62;
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), new THREE.MeshBasicMaterial({ map: glowTexture(), color: '#dfe8ff', transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = -0.12;
  g.add(panel, shade, pool);
  return g;
}

/** Everything that stands round a venue. One group per venue, built on first use. */
export class VenueProps {
  readonly group = new THREE.Group();
  private built = new Map<string, THREE.Group>();
  private current: THREE.Group | null = null;
  private brass = new THREE.MeshStandardMaterial({ color: '#c9a46a', metalness: 1, roughness: 0.32 });

  constructor(private q: QualitySpec) {}

  set(e: EnvironmentStyle) {
    if (this.current) this.current.visible = false;
    this.current = null;
    if (!this.q.props || (e.room !== 'teahouse' && e.room !== 'janso' && e.room !== 'majlis')) return;
    let g = this.built.get(e.room);
    if (!g) {
      g = this.build(e.room);
      this.built.set(e.room, g);
      this.group.add(g);
    }
    g.visible = true;
    this.current = g;
  }

  private build(room: 'teahouse' | 'janso' | 'majlis') {
    const g = new THREE.Group();
    // Set pieces sit between the chairs, out of the player's view of the table.
    const around = (n: number, r: number, offset: number, make: (i: number) => THREE.Object3D, y = 0) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + offset;
        const o = make(i);
        o.position.set(Math.cos(a) * r, y + o.position.y, Math.sin(a) * r);
        o.rotation.y = -a;
        g.add(o);
      }
    };
    if (room === 'teahouse') {
      around(7, 11.2, 0.3, (i) => {
        const c = birdcage();
        c.position.y = 5.4 + (i % 3) * 0.55;
        c.userData.sway = i * 1.7;
        const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 6, 4), new THREE.MeshBasicMaterial({ color: '#1a1410' }));
        cord.position.y = 3.95;
        c.add(cord);
        return c;
      });
    } else if (room === 'janso') {
      for (const [a, r] of [
        [Math.PI * 0.25, 11.6],
        [Math.PI * 0.95, 11.8],
        [Math.PI * 1.6, 11.4],
      ]) {
        const t = parlourTable();
        t.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
        t.rotation.y = a * 0.7;
        g.add(t);
      }
    } else {
      around(6, 13.4, 0.5, () => {
        const l = brassLantern(this.brass, '#ffb868', 0.9);
        l.position.y = FLOOR_Y;
        l.userData.flicker = Math.random() * 6;
        return l;
      });
    }
    return g;
  }

  /** Per frame: turn the fan, sway the birdcages, flicker the lanterns. */
  update(now: number, dt: number, lamp: THREE.Object3D, minimal: boolean) {
    if (!minimal)
      lamp.traverse((o) => {
        if (o.userData.spin) o.rotation.y += dt * o.userData.spin;
      });
    const g = this.current;
    if (!g || minimal) return;
    for (const o of g.children) {
      if (o.userData.sway !== undefined) o.rotation.z = Math.sin(now * 0.6 + o.userData.sway) * 0.02;
      if (o.userData.flicker !== undefined) {
        const s = o.children.find((c) => c instanceof THREE.Sprite) as THREE.Sprite | undefined;
        if (s) s.material.opacity = 0.3 + 0.06 * Math.sin(now * 7.3 + o.userData.flicker) + 0.04 * Math.sin(now * 17.1 + o.userData.flicker);
      }
    }
  }
}
