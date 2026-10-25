// Materials for the tile racks (see racks.ts and cosmetics/racks.ts): painted
// wood grain, lacquer, engraved gilt and the cloth linings, built per quality
// tier so phones get the same look with cheaper shading.

import * as THREE from 'three';
import type { RackStyle, RackWood } from '../cosmetics/racks';
import type { QualityTier } from './quality';
import { carveMaterial, type CarveLook } from './rackCarve';

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function shade(hex: string, t: number) {
  const c = new THREE.Color(hex);
  return t >= 0 ? c.lerp(new THREE.Color('#ffffff'), t) : c.multiplyScalar(1 + t);
}

const css = (c: THREE.Color, a = 1) => `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;

/**
 * The body's texture. One repeat covers 2 x 0.5 world units (see boxUV in
 * racks.ts); grain runs along the rack. The carving lives in rackCarve.ts.
 */
function paintBody(wood: RackWood, base: string, size: number): { map: HTMLCanvasElement } {
  const W = 1024 * size,
    H = 256 * size;
  const [c, g] = canvas(W, H);
  const r = rng(wood.length * 977 + base.charCodeAt(1) * 31);
  const col = new THREE.Color(base);
  g.fillStyle = css(col);
  g.fillRect(0, 0, W, H);
  if (wood === 'lacquer') {
    // Hand-rubbed lacquer: almost flat, a faint cloud of depth.
    for (let i = 0; i < 60; i++) {
      const x = r() * W,
        y = r() * H,
        rad = (40 + r() * 120) * size;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, css(shade(base, 0.06), 0.25));
      gr.addColorStop(1, css(shade(base, 0.06), 0));
      g.fillStyle = gr;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  } else if (wood === 'gilt') {
    // Brushed gold: fine lines along the rack, then a slow sheen.
    for (let y = 0; y < H; y += 1) {
      g.fillStyle = css(shade(base, (r() - 0.5) * 0.22), 0.5);
      g.fillRect(0, y, W, 1);
    }
    const sh = g.createLinearGradient(0, 0, W, 0);
    for (let i = 0; i <= 6; i++) sh.addColorStop(i / 6, css(shade(base, i % 2 ? 0.18 : -0.1), 0.35));
    g.fillStyle = sh;
    g.fillRect(0, 0, W, H);
  } else {
    // Wood: long wavering grain lines, darker latewood bands, pores.
    const dark = shade(base, wood === 'beech' ? -0.22 : -0.45);
    const light = shade(base, wood === 'ebony' ? 0.12 : 0.2);
    const lines = wood === 'beech' ? 70 : wood === 'ebony' ? 50 : 110;
    for (let i = 0; i < lines; i++) {
      const y0 = r() * H;
      const amp = (2 + r() * (wood === 'rosewood' ? 14 : 8)) * size;
      const freq = (0.002 + r() * 0.006) / size;
      const ph = r() * 6.28;
      g.strokeStyle = r() < 0.65 ? css(dark, 0.12 + r() * 0.22) : css(light, 0.12 + r() * 0.15);
      g.lineWidth = (0.6 + r() * (wood === 'zitan' || wood === 'rosewood' ? 3 : 2)) * size;
      g.beginPath();
      for (let x = 0; x <= W; x += 16) {
        const y = y0 + Math.sin(x * freq + ph) * amp + Math.sin(x * freq * 3.1 + ph * 2) * amp * 0.25;
        if (x === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
    if (wood !== 'beech') {
      for (let i = 0; i < 900 * size; i++) {
        g.fillStyle = css(dark, 0.25);
        g.fillRect(r() * W, r() * H, (4 + r() * 10) * size, 1);
      }
    }
  }
  return { map: c };
}

function paintCloth(color: string, cloth: RackStyle['cloth']): HTMLCanvasElement {
  const S = 128;
  const [c, g] = canvas(S, S);
  g.fillStyle = color;
  g.fillRect(0, 0, S, S);
  const r = rng(color.charCodeAt(2) * 131 + cloth.length);
  const n = cloth === 'leather' ? 2200 : 4200;
  for (let i = 0; i < n; i++) {
    const v = r();
    g.fillStyle = v < 0.5 ? `rgba(0,0,0,${0.04 + r() * 0.08})` : `rgba(255,255,255,${0.02 + r() * 0.05})`;
    if (cloth === 'leather') g.fillRect(r() * S, r() * S, 2 + r() * 3, 1 + r() * 2);
    else g.fillRect(r() * S, r() * S, 1, 1);
  }
  return c;
}

function tex(c: HTMLCanvasElement, srgb: boolean, aniso: number) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}

export interface RackMaterials {
  body: THREE.Material;
  accent: THREE.Material;
  trim: THREE.Material;
  lining: THREE.Material;
  stone: THREE.Material;
  gem: THREE.Material;
  /** Carved decals: the running frieze on your rail and the framed panels on rack fronts. */
  frieze: THREE.Material;
  panel: THREE.Material;
  /** Materials (and their textures) this set made and must dispose; the table's own are borrowed. */
  owned: THREE.Material[];
}

function woodMaterial(wood: RackWood, color: string, gloss: number, tier: QualityTier, aniso: number) {
  const metal = wood === 'gilt';
  const painted = paintBody(wood, color, tier === 'low' ? 0.5 : 1);
  const map = tex(painted.map, true, aniso);
  const rough = metal ? 0.3 : Math.max(0.12, 0.6 - gloss * 0.45);
  if (tier === 'low') return new THREE.MeshStandardMaterial({ map, roughness: rough, metalness: metal ? 0.85 : 0.04, envMapIntensity: metal ? 1.1 : 0.8 });
  const m = new THREE.MeshPhysicalMaterial({
    map,
    roughness: rough,
    metalness: metal ? 0.9 : 0.03,
    clearcoat: metal ? 0.2 : 0.3 + gloss * 0.7,
    clearcoatRoughness: metal ? 0.3 : Math.max(0.04, 0.3 - gloss * 0.25),
    envMapIntensity: metal ? 1.15 : 0.9,
  });
  return m;
}

/** Build the materials for a rack style. `table` lends its rim and trim for the 'table' rack. */
export function rackMaterials(st: RackStyle, tier: QualityTier, table: { wood: THREE.Material; trim: THREE.Material; felt: string }, aniso = 4): RackMaterials {
  const owned: THREE.Material[] = [];
  const own = <T extends THREE.Material>(m: T) => (owned.push(m), m);
  const body = st.body === 'table' ? table.wood : own(woodMaterial(st.body, st.bodyColor, st.gloss, tier, aniso));
  const accent = st.accent ? own(woodMaterial(st.accent, st.accentColor ?? st.bodyColor, st.gloss, tier, aniso)) : body;
  const trim = st.body === 'table' ? table.trim : own(new THREE.MeshStandardMaterial({ color: st.trim, metalness: 1, roughness: st.engraved ? 0.22 : 0.3, envMapIntensity: 1.2 }));
  const liningColor = st.lining || shade(table.felt, -0.25).getStyle();
  const clothMap = tex(paintCloth(liningColor, st.cloth), true, aniso);
  clothMap.repeat.set(6, 6);
  const lining = own(
    tier === 'high' && st.cloth !== 'leather'
      ? new THREE.MeshPhysicalMaterial({ map: clothMap, roughness: 0.95, sheen: st.cloth === 'velvet' ? 1 : 0.6, sheenRoughness: 0.5, sheenColor: shade(liningColor, 0.45), envMapIntensity: 0.3 })
      : new THREE.MeshStandardMaterial({ map: clothMap, roughness: st.cloth === 'leather' ? 0.55 : 0.95, envMapIntensity: 0.3 }),
  );
  const stone = own(
    tier === 'low'
      ? new THREE.MeshStandardMaterial({ color: st.cartouche ?? '#ffffff', roughness: 0.2, metalness: 0 })
      : new THREE.MeshPhysicalMaterial({ color: st.cartouche ?? '#ffffff', roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: st.id === 'rack-pearl' ? 1 : 0, iridescenceIOR: 1.6, sheen: st.id === 'rack-pearl' ? 0.6 : 0, sheenColor: new THREE.Color('#ffd9f0') }),
  );
  const gem = own(
    tier === 'low'
      ? new THREE.MeshStandardMaterial({ color: st.gem ?? '#ffffff', roughness: 0.1, metalness: 0.1, emissive: st.gem ?? '#000000', emissiveIntensity: 0.15 })
      : new THREE.MeshPhysicalMaterial({ color: st.gem ?? '#ffffff', roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0, emissive: st.gem ?? '#000000', emissiveIntensity: 0.12 }),
  );
  // The carving's floor takes a deep shade of the wood it is cut into (the
  // second wood on two-tone racks, whose rail and front band carry it).
  const cutInto = st.body === 'table' ? '#3b2416' : (st.accentColor ?? st.bodyColor);
  const look: CarveLook = { inlay: st.inlay, tone: st.body === 'gilt' ? '#8a6418' : shade(cutInto, -0.45).getStyle(), metal: st.body === 'gilt' };
  const frieze = own(carveMaterial('frieze', st.carve, false, look, tier, aniso));
  const panel = own(carveMaterial('panel', st.carve, !!st.cartouche, look, tier, aniso));
  return { body, accent, trim, lining, stone, gem, frieze, panel, owned };
}

export function disposeRackMaterials(m: RackMaterials) {
  for (const mat of m.owned) {
    const any = mat as THREE.MeshStandardMaterial;
    any.map?.dispose();
    any.normalMap?.dispose();
    mat.dispose();
  }
}
