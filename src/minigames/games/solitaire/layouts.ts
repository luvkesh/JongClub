// Mahjong Solitaire layouts. A slot is a tile position in tile units: x
// across (tile widths), y down the board (tile lengths), z the layer. Half
// steps (7.5) sit a tile between two others, as in the classic Turtle.

export interface Slot {
  x: number;
  y: number;
  z: number;
}

export interface Layout {
  id: string;
  /** English name; the screen wraps it in tr() through LAYOUT_NAMES. */
  name: string;
  slots: Slot[];
}

/** Fill a rectangle of slots on layer z. */
function rect(x0: number, y0: number, w: number, h: number, z: number, out: Slot[] = []): Slot[] {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.push({ x: x0 + x, y: y0 + y, z });
  return out;
}
function row(x0: number, y: number, w: number, z: number, out: Slot[]) {
  for (let x = 0; x < w; x++) out.push({ x: x0 + x, y, z });
}

/** The classic Turtle: 144 tiles in five layers. */
function turtle(): Slot[] {
  const s: Slot[] = [];
  // Layer 0: the shell, with the head and tail tiles at the ends.
  row(1, 0, 12, 0, s);
  row(3, 1, 8, 0, s);
  row(2, 2, 10, 0, s);
  row(1, 3, 12, 0, s);
  row(1, 4, 12, 0, s);
  row(2, 5, 10, 0, s);
  row(3, 6, 8, 0, s);
  row(1, 7, 12, 0, s);
  s.push({ x: 0, y: 3.5, z: 0 }, { x: 13, y: 3.5, z: 0 }, { x: 14, y: 3.5, z: 0 });
  rect(4, 1, 6, 6, 1, s);
  rect(5, 2, 4, 4, 2, s);
  rect(6, 3, 2, 2, 3, s);
  s.push({ x: 6.5, y: 3.5, z: 4 });
  return s;
}

/** A stepped pyramid, 100 tiles. */
function pyramid(): Slot[] {
  const s: Slot[] = [];
  rect(0, 0, 8, 7, 0, s);
  rect(1, 1, 6, 5, 1, s);
  rect(2, 2, 4, 3, 2, s);
  rect(3, 3, 2, 1, 3, s);
  return s;
}

/** A walled fortress with four corner towers and a keep, 114 tiles. */
function fortress(): Slot[] {
  const s: Slot[] = [];
  rect(0, 0, 10, 6, 0, s);
  // Corner towers.
  for (const [x, y] of [
    [0, 0],
    [8, 0],
    [0, 4],
    [8, 4],
  ])
    rect(x, y, 2, 2, 1, s);
  // The keep.
  rect(3, 2, 4, 2, 1, s);
  for (const [x, y] of [
    [0.5, 0.5],
    [8.5, 0.5],
    [0.5, 4.5],
    [8.5, 4.5],
  ])
    s.push({ x, y, z: 2 });
  rect(4, 2, 2, 2, 2, s);
  s.push({ x: 4.5, y: 2.5, z: 3 }, { x: 4.5, y: 2.5, z: 4 }, { x: 0.5, y: 0.5, z: 3 }, { x: 8.5, y: 0.5, z: 3 }, { x: 0.5, y: 4.5, z: 3 }, { x: 8.5, y: 4.5, z: 3 });
  // Walls between the towers, one tile high.
  row(2, 0, 6, 1, s);
  row(2, 5, 6, 1, s);
  s.push({ x: 0, y: 2, z: 1 }, { x: 0, y: 3, z: 1 }, { x: 9, y: 2, z: 1 }, { x: 9, y: 3, z: 1 });
  return s;
}

/** Two peaks side by side, 72 tiles. */
function twinPeaks(): Slot[] {
  const s: Slot[] = [];
  for (const ox of [0, 6]) {
    rect(ox, 0, 5, 5, 0, s);
    rect(ox + 1, 1, 3, 3, 1, s);
    s.push({ x: ox + 2, y: 2, z: 2 });
  }
  // A bridge across the gap.
  s.push({ x: 5, y: 1, z: 0 }, { x: 5, y: 3, z: 0 });
  return s.length % 2 ? s.slice(0, -1) : s;
}

/** A butterfly with spread wings, 104 tiles. */
function butterfly(): Slot[] {
  const s: Slot[] = [];
  // Body down the middle.
  for (let y = 0; y < 8; y++) s.push({ x: 7, y, z: 0 }, { x: 7, y, z: 1 });
  s.push({ x: 7, y: 3.5, z: 2 });
  // Wings: wider at the top, narrower below.
  const wing = (dir: 1 | -1) => {
    const widths = [6, 6, 5, 4, 4, 5, 4, 3];
    widths.forEach((w, y) => {
      for (let i = 1; i <= w; i++) s.push({ x: 7 + dir * i, y, z: 0 });
    });
    for (let y = 1; y < 6; y++) for (let i = 1; i <= Math.max(1, widths[y] - 3); i++) s.push({ x: 7 + dir * (i + 0.5), y: y + 0.5, z: 1 });
  };
  wing(-1);
  wing(1);
  return s.length % 2 ? s.slice(0, -1) : s;
}

/** A gentle starter board, 36 tiles. */
function garden(): Slot[] {
  const s: Slot[] = [];
  rect(0, 0, 7, 4, 0, s);
  rect(1, 1, 4, 2, 1, s);
  return s;
}

/** Mahjong Tower: a tall, narrow pagoda, 92 tiles over eight floors. */
function tower(): Slot[] {
  const s: Slot[] = [];
  rect(0, 0, 4, 4, 0, s);
  for (let z = 1; z < 7; z++) {
    // Each floor turns the pattern: a ring, then a cross, so pairs hide beneath.
    if (z % 2) {
      for (const [x, y] of [
        [0, 0],
        [3, 0],
        [0, 3],
        [3, 3],
        [1, 1],
        [2, 1],
        [1, 2],
        [2, 2],
      ])
        s.push({ x, y, z });
      s.push({ x: 1.5, y: 0, z }, { x: 1.5, y: 3, z }, { x: 0, y: 1.5, z }, { x: 3, y: 1.5, z });
    } else rect(0.5, 0.5, 3, 3, z, s), s.push({ x: 1.5, y: -0.5, z }, { x: 1.5, y: 3.5, z }, { x: -0.5, y: 1.5, z });
  }
  rect(1, 1, 2, 2, 7, s);
  return s.length % 2 ? s.slice(0, -1) : s;
}

/** Twin towers joined by a bridge, 86 tiles. */
function twinTowers(): Slot[] {
  const s: Slot[] = [];
  for (const ox of [0, 5]) {
    for (let z = 0; z < 5; z++) rect(ox, 0, 3, 3, z, s).length;
  }
  // Remove the centre of each upper floor so the towers are hollow.
  const hollow = s.filter((t) => !(t.z > 0 && t.z < 4 && (t.x === 1 || t.x === 6) && t.y === 1));
  row(3, 1, 2, 2, hollow);
  return hollow.length % 2 ? hollow.slice(0, -1) : hollow;
}

export const LAYOUTS: Layout[] = [
  { id: 'turtle', name: 'Turtle', slots: turtle() },
  { id: 'pyramid', name: 'Pyramid', slots: pyramid() },
  { id: 'fortress', name: 'Fortress', slots: fortress() },
  { id: 'butterfly', name: 'Butterfly', slots: butterfly() },
  { id: 'peaks', name: 'Twin Peaks', slots: twinPeaks() },
  { id: 'garden', name: 'Garden', slots: garden() },
];

export const TOWER_LAYOUTS: Layout[] = [
  { id: 'tower', name: 'Pagoda Tower', slots: tower() },
  { id: 'twin-towers', name: 'Twin Towers', slots: twinTowers() },
];

export const layoutById = (id: string) => [...LAYOUTS, ...TOWER_LAYOUTS].find((l) => l.id === id) ?? LAYOUTS[0];
