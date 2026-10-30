// The table's own look, shared by the 3D table (table3d.ts) and its Atelier picture
// (tablePreview.ts): the painted felt, and the rim's finish and inlay for a table style.

import * as THREE from 'three';
import type { TableStyle } from '../cosmetics/catalog';
import { paintFeltPattern, type FeltMotif } from './feltPattern';
import { luma } from './tileFaces';

/** The felt in a table's colour: a fine woven nap, a gold-thread border, the lamp's gentle falloff and the table's motif. */
export function paintFelt(color: string, motif: FeltMotif, S: number) {
  const tc = document.createElement('canvas');
  tc.width = tc.height = S;
  const tg = tc.getContext('2d')!;
  tg.fillStyle = color;
  tg.fillRect(0, 0, S, S);
  const img = tg.getImageData(0, 0, S, S);
  const d = img.data;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      // Weave: a faint twill diagonal plus fibre noise.
      const n = (Math.random() - 0.5) * 12 + (((x + y) & 3) === 0 ? 3 : 0) - (((x - y) & 7) === 0 ? 2 : 0);
      d[i] += n;
      d[i + 1] += n;
      d[i + 2] += n;
    }
  }
  tg.putImageData(img, 0, 0);
  // The lamp's falloff: bright and even over the rivers, only darkening near the rim.
  const vg = tg.createRadialGradient(S / 2, S / 2, S * 0.36, S / 2, S / 2, S * 0.72);
  vg.addColorStop(0, 'rgba(255,240,200,0.04)');
  vg.addColorStop(0.5, 'rgba(0,0,0,0.06)');
  vg.addColorStop(1, 'rgba(0,0,0,0.3)');
  tg.fillStyle = vg;
  tg.fillRect(0, 0, S, S);
  // Gold-thread border, inset from the rim.
  const inset = S * 0.018;
  tg.strokeStyle = 'rgba(214,180,112,0.5)';
  tg.lineWidth = 2;
  tg.strokeRect(inset, inset, S - inset * 2, S - inset * 2);
  tg.strokeStyle = 'rgba(214,180,112,0.22)';
  tg.lineWidth = 1;
  tg.strokeRect(inset + 6, inset + 6, S - inset * 2 - 12, S - inset * 2 - 12);
  // The table's own tone-on-tone motif and border band (feltPattern.ts).
  paintFeltPattern(tg, S, color, motif, inset);
  return tc;
}

/**
 * Finish a rim for table style `t`, as a jeweller would: oiled wood under a clear polish, lacquer and
 * stone a deep glaze, gilt polished bright; brass inlay, or a black lacquer line on a gilded rim.
 */
export function finishRim(m: THREE.MeshPhysicalMaterial, trim: THREE.MeshStandardMaterial, t: TableStyle) {
  const hsl = { h: 0, s: 0, l: 0 };
  new THREE.Color(t.rim).getHSL(hsl);
  const gilded = t.rimGloss >= 0.75 && hsl.s > 0.3 && hsl.h > 0.08 && hsl.h < 0.16;
  const stone = !gilded && t.rimGloss >= 0.75 && luma(t.rim) > 0.55;
  const wood = !gilded && !stone && t.rimGloss < 0.5;
  m.map?.dispose();
  m.map = stone ? marbleTexture(t.rim, true) : wood ? woodTexture(t.rim) : null;
  m.color.set(m.map ? '#ffffff' : t.rim);
  m.roughness = gilded ? 0.24 : Math.max(0.12, 0.5 - t.rimGloss * 0.42);
  m.metalness = gilded ? 1 : 0.02;
  m.clearcoat = gilded ? 0.3 : wood ? 0.8 : 1;
  m.clearcoatRoughness = gilded ? 0.1 : wood ? 0.1 : 0.04;
  m.envMapIntensity = gilded ? 1.3 : 1;
  m.needsUpdate = true;
  trim.color.set(gilded ? '#120c08' : '#c9a46a');
  trim.metalness = gilded ? 0.1 : 1;
  trim.roughness = gilded ? 0.12 : 0.2;
  trim.envMapIntensity = gilded ? 1 : 1.45;
  return { gilded, stone, wood };
}

/** Polished stone with soft veins, for marble tile backs and table rims. */
export function marbleTexture(base: string, light = false) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  let s = 97;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const vein = light ? 'rgba(90,86,80,' : 'rgba(235,230,220,';
  for (let i = 0; i < 9; i++) {
    g.strokeStyle = `${vein}${0.05 + r() * 0.12})`;
    g.lineWidth = 0.6 + r() * 1.6;
    g.beginPath();
    let x = r() * 256,
      y = r() * 256;
    g.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      const nx = x + (r() - 0.3) * 90,
        ny = y + (r() - 0.5) * 90;
      g.quadraticCurveTo(x + (r() - 0.5) * 60, y + (r() - 0.5) * 60, nx, ny);
      x = nx;
      y = ny;
    }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Fine, quiet wood grain. */
export function woodTexture(base: string) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  let s = 31;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < 256; y += 2) {
    const a = r() * 0.07;
    g.fillStyle = r() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,220,180,${a * 0.6})`;
    g.fillRect(0, y + Math.sin(y * 0.08) * 1.5, 256, 1 + r() * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
