/**
 * Tone-on-tone patterns woven into the table felt: each table has its own quiet motif
 * (a fret, clouds, waves, a star, deco fans or a lattice) plus a matching border band.
 * Everything is drawn in a lighter shade of the felt's own hue, so tiles keep their colour
 * and nothing tints them. A tiny shared twill bump map adds the weave up close.
 */
import * as THREE from 'three';

export type FeltMotif = 'fret' | 'cloud' | 'waves' | 'star' | 'deco' | 'lattice';

const BY_TABLE: Record<string, FeltMotif> = {
  'classic-green': 'fret',
  'black-marble': 'lattice',
  'jade-palace': 'cloud',
  'tokyo-night': 'waves',
  'dubai-gold': 'star',
  manhattan: 'deco',
  ocean: 'waves',
  'art-deco': 'deco',
  'midnight-club': 'lattice',
  'saigon-lacquer': 'cloud',
  'calcutta-club': 'star',
  'marina-teal': 'waves',
};
const BY_CITY: [string, FeltMotif][] = [
  ['hongkong', 'cloud'],
  ['tokyo', 'waves'],
  ['dubai', 'star'],
  ['taipei', 'fret'],
  ['singapore', 'lattice'],
  ['hanoi', 'cloud'],
];

/** The motif for a table id (season cloths follow their city). */
export function feltMotif(tableId: string): FeltMotif {
  return BY_TABLE[tableId] ?? BY_CITY.find(([c]) => tableId.includes(c))?.[1] ?? 'fret';
}

/** The felt's colour, lighter but the same hue and saturation: no colour cast on the tiles. */
function lift(hex: string, dl: number) {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.min(1, hsl.l + dl));
  return `#${c.getHexString()}`;
}

/** Paint the motif and its border band over a felt canvas (S x S), inside the gold-thread border at `inset`. */
export function paintFeltPattern(g: CanvasRenderingContext2D, S: number, color: string, motif: FeltMotif, inset: number) {
  const k = S / 1024;
  const layer = document.createElement('canvas');
  layer.width = layer.height = S;
  const c = layer.getContext('2d')!;
  c.strokeStyle = c.fillStyle = lift(color, 0.16);
  c.lineWidth = 1.6 * k;
  c.lineCap = c.lineJoin = 'round';
  // Field: the motif repeated over the cloth.
  const band = 34 * k;
  const b0 = inset + 12 * k;
  const f0 = b0 + band + 8 * k;
  c.save();
  c.beginPath();
  c.rect(f0, f0, S - f0 * 2, S - f0 * 2);
  c.clip();
  FIELD[motif](c, S, 64 * k);
  c.restore();
  // The border band between two fine rules.
  c.save();
  c.beginPath();
  c.rect(b0, b0, S - b0 * 2, S - b0 * 2);
  c.rect(b0 + band, b0 + band, S - (b0 + band) * 2, S - (b0 + band) * 2);
  c.clip('evenodd');
  for (let side = 0; side < 4; side++) {
    c.save();
    c.translate(S / 2, S / 2);
    c.rotate((side * Math.PI) / 2);
    c.translate(-S / 2, -S / 2);
    BAND[motif](c, b0, S - b0, band);
    c.restore();
  }
  c.restore();
  c.lineWidth = 1.2 * k;
  c.strokeRect(b0, b0, S - b0 * 2, S - b0 * 2);
  c.strokeRect(b0 + band, b0 + band, S - (b0 + band) * 2, S - (b0 + band) * 2);
  // Tone-on-tone: barely there, so tiles and discards stay the clearest thing on the cloth.
  g.save();
  g.globalAlpha = 0.24;
  g.drawImage(layer, 0, 0);
  g.restore();
}

type Field = (c: CanvasRenderingContext2D, S: number, P: number) => void;
type Band = (c: CanvasRenderingContext2D, from: number, to: number, w: number) => void;

/** A square key spiral (回) of size s centred at x, y. */
function spiral(c: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const h = s / 2,
    q = s / 6;
  c.beginPath();
  c.moveTo(x - h, y + h);
  c.lineTo(x - h, y - h);
  c.lineTo(x + h, y - h);
  c.lineTo(x + h, y + h);
  c.lineTo(x - h + q * 2, y + h);
  c.lineTo(x - h + q * 2, y - h + q * 2);
  c.lineTo(x + h - q * 2, y - h + q * 2);
  c.lineTo(x + h - q * 2, y + h - q * 2);
  c.stroke();
}

function cloud(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  // A ruyi cloud: three lobes over a curling tail.
  c.beginPath();
  c.arc(x - r * 0.9, y + r * 0.1, r * 0.55, Math.PI * 0.55, Math.PI * 1.75);
  c.arc(x, y - r * 0.35, r * 0.7, Math.PI * 1.1, Math.PI * 1.95);
  c.arc(x + r * 0.95, y + r * 0.05, r * 0.55, Math.PI * 1.3, Math.PI * 0.45);
  c.stroke();
  c.beginPath();
  c.arc(x, y + r * 0.25, r * 0.32, Math.PI * 0.1, Math.PI * 1.6);
  c.stroke();
}

function star(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  for (const a of [0, Math.PI / 4]) {
    c.beginPath();
    for (let i = 0; i < 4; i++) {
      const t = a + (i * Math.PI) / 2;
      c[i ? 'lineTo' : 'moveTo'](x + Math.cos(t) * r, y + Math.sin(t) * r);
    }
    c.closePath();
    c.stroke();
  }
}

function fan(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.beginPath();
  c.arc(x, y, r, Math.PI, 0);
  c.stroke();
  c.beginPath();
  c.arc(x, y, r * 0.55, Math.PI, 0);
  c.stroke();
  for (let i = 1; i < 6; i++) {
    const t = Math.PI + (i * Math.PI) / 6;
    c.beginPath();
    c.moveTo(x + Math.cos(t) * r * 0.55, y + Math.sin(t) * r * 0.55);
    c.lineTo(x + Math.cos(t) * r, y + Math.sin(t) * r);
    c.stroke();
  }
}

function diamond(c: CanvasRenderingContext2D, x: number, y: number, r: number, fill = false) {
  c.beginPath();
  c.moveTo(x, y - r);
  c.lineTo(x + r, y);
  c.lineTo(x, y + r);
  c.lineTo(x - r, y);
  c.closePath();
  if (fill) c.fill();
  else c.stroke();
}

const FIELD: Record<FeltMotif, Field> = {
  fret: (c, S, P) => {
    for (let y = 0, j = 0; y < S + P; y += P, j++)
      for (let x = (j % 2) * (P / 2); x < S + P; x += P) spiral(c, x, y, P * 0.3);
  },
  cloud: (c, S, P) => {
    const Q = P * 1.3;
    for (let y = 0, j = 0; y < S + Q; y += Q * 0.75, j++)
      for (let x = (j % 2) * (Q / 2); x < S + Q; x += Q) cloud(c, x, y, Q * 0.2);
  },
  waves: (c, S, P) => {
    // Seigaiha: overlapping rows of concentric arcs, each row hiding the one behind.
    const r = P * 0.5;
    for (let y = 0, j = 0; y < S + r * 2; y += r / 2, j++)
      for (let x = (j % 2) * r; x < S + r * 2; x += r * 2) {
        c.save();
        c.globalCompositeOperation = 'destination-out';
        c.beginPath();
        c.arc(x, y, r, Math.PI, 0);
        c.fill();
        c.restore();
        for (const f of [1, 0.7, 0.4]) {
          c.beginPath();
          c.arc(x, y, r * f, Math.PI, 0);
          c.stroke();
        }
      }
  },
  star: (c, S, P) => {
    for (let y = 0; y < S + P; y += P)
      for (let x = 0; x < S + P; x += P) {
        star(c, x, y, P * 0.26);
        diamond(c, x + P / 2, y + P / 2, P * 0.08, true);
      }
  },
  deco: (c, S, P) => {
    for (let y = 0, j = 0; y < S + P; y += P * 0.5, j++)
      for (let x = (j % 2) * (P / 2); x < S + P; x += P) fan(c, x, y, P * 0.42);
  },
  lattice: (c, S, P) => {
    const h = P / 2;
    c.beginPath();
    for (let t = -S; t < S * 2; t += P) {
      c.moveTo(t, 0);
      c.lineTo(t + S, S);
      c.moveTo(t, S);
      c.lineTo(t + S, 0);
    }
    c.stroke();
    for (let y = 0; y < S + P; y += P) for (let x = h; x < S + P; x += P) diamond(c, x, y, P * 0.06, true);
  },
};

/** Border pattern along the top edge, from `from` to `to`, `w` deep, starting at y = from. */
const fretBand: Band = (c, from, to, w) => {
  // A continuous key fret (回纹) along the band.
  const u = w * 0.8,
    y0 = from + w * 0.1,
    q = u / 4;
  c.beginPath();
  c.moveTo(from, y0 + u);
  for (let x = from + w; x + u <= to - w; x += u) {
    c.lineTo(x, y0 + u);
    c.lineTo(x, y0);
    c.lineTo(x + u - q, y0);
    c.lineTo(x + u - q, y0 + u - q);
    c.lineTo(x + q, y0 + u - q);
    c.lineTo(x + q, y0 + q);
    c.lineTo(x + u - q * 2, y0 + q);
    c.moveTo(x, y0 + u);
    c.lineTo(x + u, y0 + u);
  }
  c.lineTo(to, y0 + u);
  c.stroke();
};
const repeatBand =
  (draw: (c: CanvasRenderingContext2D, x: number, y: number, w: number) => void): Band =>
  (c, from, to, w) => {
    for (let x = from + w * 1.5; x < to - w; x += w) draw(c, x, from + w / 2, w);
  };

const BAND: Record<FeltMotif, Band> = {
  fret: fretBand,
  cloud: fretBand,
  lattice: repeatBand((c, x, y, w) => {
    diamond(c, x, y, w * 0.32);
    diamond(c, x + w / 2, y, w * 0.06, true);
  }),
  waves: repeatBand((c, x, y, w) => {
    for (const f of [0.42, 0.26]) {
      c.beginPath();
      c.arc(x, y + w * 0.3, w * f, Math.PI, 0);
      c.stroke();
    }
  }),
  star: repeatBand((c, x, y, w) => {
    star(c, x, y, w * 0.32);
  }),
  deco: repeatBand((c, x, y, w) => {
    fan(c, x, y + w * 0.3, w * 0.42);
  }),
};

let weave: THREE.CanvasTexture | null = null;
/** One small twill texture shared by every felt: the weave you see up close (used as a bump map). */
export function feltWeave(anisotropy: number): THREE.CanvasTexture {
  if (weave) return weave;
  const N = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const g = cv.getContext('2d')!;
  const img = g.createImageData(N, N);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      // 2/2 twill: diagonal ribs one thread wide, with a little fibre noise.
      const rib = (x + y) % 4 < 2 ? 1 : 0;
      const thread = Math.sin(((x - y) / N) * Math.PI * 16) * 0.5 + 0.5;
      const v = 128 + rib * 40 * (0.6 + 0.4 * thread) - 20 + (rnd() - 0.5) * 30;
      const i = (y * N + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  weave = new THREE.CanvasTexture(cv);
  weave.wrapS = weave.wrapT = THREE.RepeatWrapping;
  weave.repeat.set(96, 96);
  weave.anisotropy = anisotropy;
  return weave;
}
