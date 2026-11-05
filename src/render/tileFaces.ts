// Draws tile faces to canvas. Used as 3D textures and as 2D images in the UI.
// Every tile set (see cosmetics/catalog.ts) is its own object: a face ground
// painted in its material (jade, marble, pearl, glass, lacquer, wood...), its
// own calligraphy, ink that is printed, carved, gilded, glowing or inlaid, an
// engraved frame, and a back with its own finish and engraving. Red fives
// (Riichi aka dora) are drawn in the set's aka ink with a small marker.

import { ANIMAL_BASE, FLOWER_BASE, FLOWER_JOKER, KIND_COUNT, WINDS, flowerNumber, isAnimal, isFlower, isJoker, isTypedJoker, rankOf, suitOf } from '../engine/tiles';
import { TILE_SETS, tileSetStyle, type TileFinish, type TileFoil, type TileSetStyle } from '../cosmetics/catalog';
import { FACE_STORE_VERSION, blobCanvas, encodePng, loadFaces, saveFace } from './faceStore';
import { FACE_ACCESS, accessibleStyle, DRAGON_INDEX, tileIndex, type FaceAccess, type SuitMark } from './tileAccess';

export const FACE_W = 192;
export const FACE_H = 256;
/** Pixels per face unit while a face is being drawn (set per draw by drawFace). */
let FACE_SCALE = 1.5;
/**
 * Face detail for the 3D table, in pixels per face unit: 4.5 (864x1152, three
 * times the old 1.5) on capable desktops, less on phones (see quality.ts).
 */
let detail = 1.5;
/** Detail for 2D images in the UI (hand tray, guides, shop): crisp at 3x device pixels. */
export const UI_FACE_SCALE = 2;

/** Set the 3D face detail from the render quality tier. Clears the face caches when it changes. */
export function setFaceDetail(scale: number) {
  if (scale === detail) return;
  detail = scale;
  cache.clear();
  surfaceCache.clear();
  finishCache.clear();
}
export const faceDetail = () => detail;

/** The tile set faces are currently drawn in (mutable; follows setTileSet). */
export const TILE_SET = {
  id: 'classic-ivory',
  face: '#f3ead6',
  faceCentre: '#f8f1e1',
  faceEdge: '#e4d6b8',
  back: '#1f5a46',
  ink: '#1b2430',
  red: '#b3352a',
  green: '#1f7a4f',
  blue: '#1f4f8a',
  /** Red-five ink. */
  aka: '#b3352a',
  /** Frame and engraving colour. */
  trim: '#c9a46a',
  /** Light ground behind the sparrow's eye and index chips. */
  paper: '#f6efe0',
  dark: false,
};

let style: TileSetStyle = TILE_SETS[0];
/** The equipped set as the catalogue has it, before accessibility adjustments (tileAccess.ts). */
let equipped: TileSetStyle = TILE_SETS[0];

/** The equipped tile set's full style. */
export const currentTileSet = () => style;

/**
 * Light faces in the cream-to-bone range are drawn clean: much nearer white, with only a whisper of
 * the set's warmth and almost no darkening toward the rim, so they read as polished new tiles and
 * never as white tiles yellowed with age. A set's colour lives in its body, back and trim; tinted
 * faces that are a deliberate colour (blush, jade, lilac, ice) keep theirs.
 */
function cleanFaces(st: TileSetStyle): TileSetStyle {
  const creamy = (hex: string) => {
    const [r, g, b] = rgb(hex);
    if (luma(hex) < 0.62 || r < g || g < b || r - b < 6) return false;
    // Hue between orange and yellow (about 25 to 65 degrees): ivory, cream, bone, parchment.
    const hue = (60 * (g - b)) / Math.max(1, r - b);
    return hue >= 25 && hue <= 65;
  };
  if (!creamy(st.face[0])) return st;
  const centre = mix(st.face[0], '#ffffff', 0.68);
  const edge = mix(st.face[1], centre, 0.78);
  const body = creamy(st.body) ? mix(st.body, '#ffffff', 0.45) : st.body;
  return { ...st, face: [centre, edge], body };
}

function applyStyle(next: TileSetStyle, access = true) {
  if (access) {
    equipped = next;
    next = accessibleStyle(next);
  }
  next = cleanFaces(next);
  style = next;
  const [ink, red, green, blue] = next.ink;
  const dark = luma(next.face[0]) < 0.4;
  Object.assign(TILE_SET, {
    id: next.id,
    face: mix(next.face[0], next.face[1], 0.45),
    faceCentre: next.face[0],
    faceEdge: next.face[1],
    back: next.back,
    ink,
    red,
    green,
    blue,
    aka: next.aka ?? red,
    trim: next.trim,
    paper: dark ? mix(next.face[0], '#ffffff', 0.12) : mix(next.face[0], '#ffffff', 0.25),
    dark,
  });
  // 2D tiles in the UI wear the equipped set's body, metal seam and back (style.css .tile2d).
  if (access && typeof document !== 'undefined') {
    const root = document.documentElement.style;
    root.setProperty('--tile-body', mix(next.body, '#000000', 0.12));
    root.setProperty('--tile-metal', METALS[jewelMetal()].stops[1]);
    root.setProperty('--tile-back', next.back);
  }
}

/** Equip a tile set for every face drawn from now on (3D textures and 2D images). Clears caches. */
export function setTileSet(id: string) {
  const next = tileSetStyle(id);
  if (next === equipped && TILE_SET.id === next.id) return;
  applyStyle(next);
  clearFaceCache();
}

/** Change the accessibility options for faces (suit marks, colour-safe, high contrast). Clears caches. */
export function setFaceAccess(o: Partial<FaceAccess>) {
  if ((Object.keys(o) as (keyof FaceAccess)[]).every((k) => FACE_ACCESS[k] === o[k])) return;
  Object.assign(FACE_ACCESS, o);
  applyStyle(equipped);
  clearFaceCache();
}

/** Run `fn` with another tile set's style active, without touching the equipped set's caches. */
export function withTileSet<T>(id: string, fn: () => T): T {
  const prev = equipped;
  // Previews show the set as it is, whatever the accessibility options.
  applyStyle(tileSetStyle(id), false);
  try {
    return fn();
  } finally {
    applyStyle(prev);
  }
}

// ------------------------------------------------------------ colour helpers

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(f, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Linear blend of two hex colours; t = 0 gives a, 1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const A = rgb(a),
    B = rgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

/** Relative brightness 0..1. */
export function luma(hex: string) {
  const [r, g, b] = rgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

const rgba = (hex: string, a: number) => {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seedOf = (s: string) => s.split('').reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);

function canvas(w: number, h: number, readBack = false) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d', readBack ? { willReadFrequently: true } : undefined)!] as const;
}

/** Small read-back copy of the ink layer used to fit it clear of the index. */
let probeL: readonly [HTMLCanvasElement, CanvasRenderingContext2D] | undefined;

// ------------------------------------------------------------ calligraphy

const CN_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const SERIF = '"Noto Serif SC", "Songti SC", "SimSun", "Noto Serif CJK SC", serif';
const FONTS: Record<TileSetStyle['font'], [weight: number, family: string]> = {
  serif: [700, SERIF],
  brush: [400, `"Ma Shan Zheng", "STKaiti", "KaiTi", ${SERIF}`],
  song: [400, `"ZCOOL XiaoWei", ${SERIF}`],
  sans: [900, '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif'],
};
/** Every character a face or back can show, for the font subsets. */
const GLYPHS = '一二三四五六七八九萬万東南西北中發梅蘭菊竹春夏秋冬花喜元合貓鼠雞蜈龍雀';

const cache = new Map<string, HTMLCanvasElement>();

/** Whether this face is already drawn (or loaded from the device) at `scale`, so using it costs no drawing. */
export function hasFace(kind: number, labels: boolean, red = false, scale = detail): boolean {
  return cache.has(`${TILE_SET.id}:${kind}:${labels}:${red && kind < 27 ? 'r' : ''}:${scale}`);
}

export function drawFace(kind: number, labels: boolean, red = false, scale = detail): HTMLCanvasElement {
  red = red && kind < 27;
  const key = `${TILE_SET.id}:${kind}:${labels}:${red ? 'r' : ''}:${scale}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const prev = FACE_SCALE;
  FACE_SCALE = scale;
  try {
    const { face, foil, relief } = renderFace(kind, labels, red);
    cache.set(key, face);
    if (foil) surfaceCache.set(key, foil);
    reliefCache.set(key, relief);
    // 3D faces are kept on the device so the next visit starts sharp (faceStore.ts).
    if (scale === detail) queueSave(storePrefix(scale, labels), `${kind}:${red ? 'r' : ''}`, face, foil, relief);
    return face;
  } finally {
    FACE_SCALE = prev;
  }
}

// ------------------------------------------------------------ faces kept on the device

const storePrefix = (scale: number, labels: boolean) => `${FACE_STORE_VERSION}|${TILE_SET.id}|${scale}|${labels ? 1 : 0}|${FACE_ACCESS.suitMarks ? 1 : 0}${FACE_ACCESS.colourSafe ? 1 : 0}${FACE_ACCESS.highContrast ? 1 : 0}|`;

const saveQueue: (() => Promise<void>)[] = [];
let saving = false;

/** PNG-encodes (off the main thread where it can) and stores faces one after another. */
function queueSave(prefix: string, rest: string, face: HTMLCanvasElement, foil: HTMLCanvasElement | null, relief: HTMLCanvasElement) {
  if (typeof indexedDB === 'undefined') return;
  saveQueue.push(async () => {
    const [f, m, h] = await Promise.all([encodePng(face), foil ? encodePng(foil) : null, encodePng(relief)]);
    if (f && h) await saveFace(prefix, rest, m ? { face: f, foil: m, relief: h } : { face: f, relief: h });
  });
  if (saving) return;
  saving = true;
  const next = () => {
    const job = saveQueue.shift();
    if (!job) {
      saving = false;
      return;
    }
    void job().finally(() => window.setTimeout(next, 30));
  };
  window.setTimeout(next, 200);
}

/**
 * Loads the equipped set's faces kept on this device at the 3D detail, so the
 * table never shows a face being drawn. Gives up after `timeoutMs`; anything
 * not found is drawn when first needed.
 */
export async function primeFaces(labels: boolean, timeoutMs = 2500): Promise<number> {
  const scale = detail,
    setId = TILE_SET.id,
    prefix = storePrefix(scale, labels);
  let n = 0;
  const work = (async () => {
    const stored = await loadFaces(prefix);
    await Promise.all(
      [...stored].map(async ([rest, v]) => {
        if (!v.relief) return;
        const [face, foil, relief] = await Promise.all([blobCanvas(v.face), v.foil ? blobCanvas(v.foil) : null, blobCanvas(v.relief)]);
        // The set or detail may have changed while decoding.
        if (!face || !relief || TILE_SET.id !== setId || detail !== scale) return;
        if (!foil) return;
        const [k, r] = rest.split(':');
        const key = `${setId}:${k}:${labels}:${r}:${scale}`;
        if (cache.has(key)) return;
        cache.set(key, face);
        if (foil) surfaceCache.set(key, foil);
        reliefCache.set(key, relief);
        n++;
      }),
    );
  })();
  await Promise.race([work, new Promise((r) => setTimeout(r, timeoutMs))]);
  return n;
}

/** Where a face is metal (white = foil), at half the face's resolution; null for sets without foil. */
const surfaceCache = new Map<string, HTMLCanvasElement>();
/** Each face's relief at half resolution (white = the face's surface, dark = engraved ink), for the 3D bump map. */
const reliefCache = new Map<string, HTMLCanvasElement>();

/**
 * The face's surface map for the 3D material (three.js reads roughness from
 * green and metalness from blue): the ground keeps `groundRough`, the foil
 * linework, inlay and gilt ink turn to polished metal. Null when the equipped
 * set has no foil. Index chips and gems stay non-metal so they always read.
 */
export function drawFaceSurface(kind: number, labels: boolean, red = false, groundRough = 0.32, scale = detail): HTMLCanvasElement | null {
  red = red && kind < 27;
  drawFace(kind, labels, red, scale);
  const key = `${TILE_SET.id}:${kind}:${labels}:${red ? 'r' : ''}:${scale}`;
  const relief = reliefCache.get(key);
  if (!relief) return null;
  return surfaceMap(relief, surfaceCache.get(key) ?? null, groundRough);
}

/** Enamel takes a glassy polish whatever the ground (three.js roughness, 0-1). */
const ENAMEL_ROUGH = 0.1;

/**
 * The surface map from a face's relief and metal mask: relief in red (the bump map), roughness in
 * green (the ground's, enamel polished glassy, metal its own) and metalness in blue.
 */
function surfaceMap(relief: HTMLCanvasElement, metalMask: HTMLCanvasElement | null, groundRough: number) {
  const [c, g] = canvas(relief.width, relief.height, true);
  g.fillStyle = '#000000';
  g.fillRect(0, 0, c.width, c.height);
  const m = METALS[jewelMetal()];
  if (metalMask) g.drawImage(tinted(metalMask, `rgb(0,${Math.round(m.rough * 255)},${Math.round(m.metal * 255)})`), 0, 0, c.width, c.height);
  const img = g.getImageData(0, 0, c.width, c.height);
  const r = relief.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, c.width, c.height).data;
  const d = img.data;
  const ground = Math.round(groundRough * 255),
    glassy = Math.round(ENAMEL_ROUGH * 255);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = r[i];
    // Where the metal fades out at its edge, what lies under it shows: enamel or ground.
    const under = r[i] < ENAMEL_BELOW ? glassy : ground;
    const k = d[i + 2] / 255 / m.metal;
    if (k < 1) d[i + 1] = Math.round(d[i + 1] + under * (1 - k));
  }
  g.putImageData(img, 0, 0);
  return c;
}

/**
 * A face and its surface map (relief in red, roughness in green, metal in blue, as drawFaceSurface)
 * drawn fresh for a one-off picture such as a shop portrait: nothing is cached or kept on the device.
 */
export function drawFaceOnce(kind: number, scale: number, groundRough = 0.32): { face: HTMLCanvasElement; surface: HTMLCanvasElement } {
  const prev = FACE_SCALE;
  FACE_SCALE = scale;
  try {
    const { face, foil, relief } = renderFace(kind, false, false);
    const c = surfaceMap(relief, foil, groundRough);
    return { face, surface: c };
  } finally {
    FACE_SCALE = prev;
  }
}

/** The back of a tile in the current set, as the 3D tiles wear it (for one-off pictures). */
export const drawBackOnce = (w = 384, h = 512) => paintBack(style, w, h);

/** The body's finish in the current set (for one-off pictures; tileFinishCanvas keeps the table's). */
export function drawBodyOnce(): HTMLCanvasElement {
  const [c, g] = canvas(256, 256);
  g.scale(2, 2);
  paintFinish(g, 128, 128, style.bodyFinish, style.body, mix(style.body, '#000000', luma(style.body) > 0.6 ? 0.04 : 0.12), seedOf(style.id) * 7);
  return c;
}

/**
 * A 3D portrait of a set (tilePicture.ts registers it): the real tile geometry and materials under
 * studio light. The painted portrait below is the fallback where WebGL is unavailable.
 */
let picture3d: ((id: string, w: number, h: number) => string) | null = null;
export const setTilePicture3d = (fn: typeof picture3d) => void (picture3d = fn);

// Scratch layer the ink is drawn onto before it is set into the face.
let layer: readonly [HTMLCanvasElement, CanvasRenderingContext2D] | undefined;
let tintL: readonly [HTMLCanvasElement, CanvasRenderingContext2D] | undefined;

// ------------------------------------------------------------ the jeweller's setting
//
// Every set is made the way a jeweller makes cloisonné: each symbol is enamel
// laid between fine metal wires (the cloisons), pips are cabochons in metal
// collars, bamboo canes wear metal ferrules, and the whole face sits in a
// polished metal bezel. The wires, collars and bezel are real metal on the 3D
// table (the surface map's blue), the enamel a glassy polish (its green), and
// the ground carries an engine-turned guilloche that only the light reveals
// (the relief), so the faces stay truly white.

/** Metal parts the symbols draw for themselves (ferrules, beaks, studs), at face resolution. */
let metalL: readonly [HTMLCanvasElement, CanvasRenderingContext2D] | undefined;
/** While a face's symbols are drawn: the context they paint metal parts onto. */
let metalCtx: CanvasRenderingContext2D | null = null;
/** Width of the wire round each symbol, in face units (fine round calligraphy, a little bolder round pips and canes). */
let wireW = 1.3;
let wireL: readonly [HTMLCanvasElement, CanvasRenderingContext2D] | undefined;
let maskL: readonly [HTMLCanvasElement, CanvasRenderingContext2D] | undefined;
let paintL: readonly [HTMLCanvasElement, CanvasRenderingContext2D] | undefined;

/** The set's metal: its foil's, or what its trim colour is (silver, brass or gold). */
function jewelMetal(): TileFoil['metal'] {
  if (style.foil) return style.foil.metal;
  const [r, g, b] = rgb(style.trim);
  if (Math.max(r, g, b) - Math.min(r, g, b) < 24) return 'silver';
  return luma(style.trim) < 0.45 ? 'brass' : 'gold';
}

/** Paint metal parts of a symbol (in face units, like the symbol itself); nothing when no face is being drawn. */
function metalPart(draw: (m: CanvasRenderingContext2D) => void) {
  if (!metalCtx) return;
  metalCtx.save();
  metalCtx.fillStyle = metalCtx.strokeStyle = '#ffffff';
  draw(metalCtx);
  metalCtx.restore();
}

const sized = (l: readonly [HTMLCanvasElement, CanvasRenderingContext2D] | undefined, w: number, h: number) => (l && l[0].width === w && l[0].height === h ? l : canvas(w, h));

/** The wires: a band `w` face units wide hugging the outside of every shape on `L`. */
function wires(L: HTMLCanvasElement, w: number) {
  wireL = sized(wireL, L.width, L.height);
  const [O, og] = wireL;
  og.setTransform(1, 0, 0, 1, 0, 0);
  og.globalCompositeOperation = 'source-over';
  og.clearRect(0, 0, O.width, O.height);
  const r = w * FACE_SCALE;
  for (const [n, k] of [
    [20, 1],
    [10, 0.55],
  ])
    for (let a = 0; a < n; a++) og.drawImage(L, Math.cos((a / n) * Math.PI * 2) * r * k, Math.sin((a / n) * Math.PI * 2) * r * k);
  og.globalCompositeOperation = 'destination-out';
  og.drawImage(L, 0, 0);
  og.globalCompositeOperation = 'source-over';
  return O;
}

/** The face's bezel: a polished band round the very edge of the face, in face units. */
function bezel(g: CanvasRenderingContext2D) {
  g.save();
  g.strokeStyle = '#ffffff';
  g.lineWidth = 3.4;
  g.beginPath();
  g.roundRect(1.7, 1.7, FACE_W - 3.4, FACE_H - 3.4, 9);
  g.stroke();
  g.restore();
}

/**
 * Lays polished metal wherever `mask` is opaque: the set's metal under a raking light, a fine brushed
 * grain, a bright bevel on the upper-left of every wire and a shaded one below, and a hairline shadow
 * where the metal stands proud of the face.
 */
function paintMetal(g: CanvasRenderingContext2D, mask: HTMLCanvasElement, metal: TileFoil['metal']) {
  const m = METALS[metal];
  paintL = sized(paintL, mask.width, mask.height);
  const [P, pg] = paintL;
  pg.setTransform(1, 0, 0, 1, 0, 0);
  pg.globalCompositeOperation = 'source-over';
  pg.clearRect(0, 0, P.width, P.height);
  pg.drawImage(mask, 0, 0);
  pg.globalCompositeOperation = 'source-in';
  const lg = pg.createLinearGradient(0, 0, P.width * 0.9, P.height);
  m.stops.forEach((c, i) => lg.addColorStop(i / (m.stops.length - 1), c));
  pg.fillStyle = lg;
  pg.fillRect(0, 0, P.width, P.height);
  pg.globalCompositeOperation = 'source-atop';
  const r = rng(seedOf(style.id) + 29);
  const step = Math.max(1, FACE_SCALE * 0.6);
  for (let y = 0; y < P.height; y += step) {
    pg.fillStyle = r() < 0.5 ? `rgba(255,255,255,${r() * 0.14})` : `rgba(0,0,0,${r() * 0.1})`;
    pg.fillRect(0, y, P.width, step * 0.6);
  }
  pg.drawImage(inkEdge(mask, 0.5, 'rgba(255,252,236,0.8)', true), 0, 0);
  pg.drawImage(inkEdge(mask, -0.6, 'rgba(48,26,4,0.5)', true), 0, 0);
  pg.globalCompositeOperation = 'source-over';
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(inkEdge(mask, 0.7, TILE_SET.dark ? 'rgba(0,0,0,0.55)' : 'rgba(70,46,12,0.32)', false), 0, 0);
  g.drawImage(P, 0, 0);
  g.restore();
}

/**
 * Glassy enamel: the ink is already laid; this domes it. A bright meniscus along the upper-left of
 * each shape where it meets its wire, the lower-right rim a shade deeper, and a soft sheen across.
 * `fine` is for calligraphy, whose strokes are too slender for a broad highlight.
 */
function enamel(g: CanvasRenderingContext2D, L: HTMLCanvasElement, fine: boolean) {
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  const dark = TILE_SET.dark;
  g.drawImage(inkEdge(L, fine ? -1.1 : -2.6, dark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.2)', true), 0, 0);
  g.drawImage(inkEdge(L, fine ? 0.9 : 2.2, `rgba(255,255,255,${fine ? 0.32 : 0.42})`, true), 0, 0);
  const [c, tg] = (tintL = sized(tintL, L.width, L.height));
  tg.globalCompositeOperation = 'source-over';
  tg.clearRect(0, 0, c.width, c.height);
  tg.drawImage(L, 0, 0);
  tg.globalCompositeOperation = 'source-in';
  const lg = tg.createLinearGradient(0, 0, c.width * 0.7, c.height);
  lg.addColorStop(0, 'rgba(255,255,255,0.22)');
  lg.addColorStop(0.45, 'rgba(255,255,255,0.02)');
  lg.addColorStop(1, 'rgba(0,0,0,0.12)');
  tg.fillStyle = lg;
  tg.fillRect(0, 0, c.width, c.height);
  tg.globalCompositeOperation = 'source-over';
  g.drawImage(c, 0, 0);
  g.restore();
}

/** Engine-turned guilloche for the relief: fine waves round the face, a few grey levels deep (cached per size). */
const guillocheCache = new Map<string, HTMLCanvasElement>();
function guilloche(w: number, h: number) {
  const key = `${w}x${h}`;
  let c = guillocheCache.get(key);
  if (c) return c;
  const [gc, gg] = canvas(w, h, true);
  const img = gg.createImageData(w, h);
  const d = img.data;
  const cx = w / 2,
    cy = h / 2,
    s = FACE_W / w;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) * s,
        dy = (y - cy) * s;
      const rr = Math.hypot(dx, dy),
        th = Math.atan2(dy, dx);
      // Rings rippled by a twelve-fold rose: the barleycorn of a watch dial.
      const v = 0.5 + 0.5 * Math.sin(rr * 0.9 + 2.2 * Math.sin(th * 12 + rr * 0.05));
      const i = (y * w + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = 255;
      d[i + 3] = Math.round(v * 255);
    }
  gg.putImageData(img, 0, 0);
  guillocheCache.set(key, gc);
  return gc;
}

function renderFace(kind: number, labels: boolean, red: boolean): { face: HTMLCanvasElement; foil: HTMLCanvasElement | null; relief: HTMLCanvasElement } {
  const PW = Math.round(FACE_W * FACE_SCALE),
    PH = Math.round(FACE_H * FACE_SCALE);
  const [c, g] = canvas(PW, PH);
  g.scale(FACE_SCALE, FACE_SCALE);
  paintFinish(g, FACE_W, FACE_H, style.ground, TILE_SET.faceCentre, TILE_SET.faceEdge, seedOf(style.id) + kind);

  // The corner index is ink like the symbols: drawn on its own layer first so the frame
  // (or foil) can part round it, then set into the face together with the symbols.
  const idx = indexFor(kind, labels, red);
  const I = idx ? indexLayer(idx) : null;
  // The frame, struck once per set (in metal on foil sets); it parts in a fine line round the index.
  const [F, D] = frameLayers();
  const halo = I ? indexHalo(I) : null;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(halo ? knockOut(D, halo) : D, 0, 0);
  g.restore();

  const { L, M } = inkLayer(g, kind, labels, red);
  const metal = jewelMetal();
  const gilt = style.inkStyle === 'gilded';
  // Everything that is metal on this face, at full resolution: the symbols' own metal parts,
  // the wires round them (gilt ink is metal already and needs none), and the bezel.
  maskL = sized(maskL, PW, PH);
  const [MM, mmg] = maskL;
  mmg.setTransform(1, 0, 0, 1, 0, 0);
  mmg.clearRect(0, 0, PW, PH);
  if (!gilt) mmg.drawImage(wires(L, wireW), 0, 0);
  mmg.drawImage(M, 0, 0);
  mmg.setTransform(FACE_SCALE, 0, 0, FACE_SCALE, 0, 0);
  bezel(mmg);
  mmg.setTransform(1, 0, 0, 1, 0, 0);

  g.setTransform(1, 0, 0, 1, 0, 0);
  setInk(g, L);
  if (I) {
    // The index is set the same way, with the finest finish so it stays crisp at a glance.
    const w0 = wireW;
    wireW = 1;
    setInk(g, I);
    wireW = w0;
    const lg = L.getContext('2d')!;
    lg.save();
    lg.setTransform(1, 0, 0, 1, 0, 0);
    lg.drawImage(I, 0, 0);
    lg.restore();
  }
  paintMetal(g, MM, metal);
  g.setTransform(FACE_SCALE, 0, 0, FACE_SCALE, 0, 0);
  drawGloss(g);
  const gems = style.foil ? drawGems(g) : [];
  if (red) drawRedMarker(g);

  // The metal mask, at half resolution: the setting, the foil (parted round the index as on the
  // face) and, on gilt sets, all the ink, index included, so the whole face reads as one surface.
  const [mc, mg] = canvas(Math.round(PW / 2), Math.round(PH / 2));
  mg.drawImage(MM, 0, 0, mc.width, mc.height);
  if (style.foil) {
    mg.drawImage(halo ? knockOut(F, halo) : F, 0, 0, mc.width, mc.height);
    if (style.foil.ink) mg.drawImage(L, 0, 0, mc.width, mc.height);
    mg.globalCompositeOperation = 'destination-out';
    mg.scale(FACE_SCALE / 2, FACE_SCALE / 2);
    for (const [x, y, r] of gems) {
      mg.beginPath();
      mg.arc(x, y, r * 0.8, 0, Math.PI * 2);
      mg.fill();
    }
  }
  const foil = mc;
  // The relief (half resolution): the ground engine-turned a few levels deep, the enamel lying a
  // little below it and the metal standing proud, with softly sloped walls.
  const [rc, rg] = canvas(Math.round(PW / 2), Math.round(PH / 2), true);
  rg.fillStyle = `rgb(${RELIEF.ground},${RELIEF.ground},${RELIEF.ground})`;
  rg.fillRect(0, 0, rc.width, rc.height);
  rg.globalAlpha = 0.16;
  rg.drawImage(tinted(guilloche(rc.width, rc.height), '#ffffff'), 0, 0);
  rg.globalAlpha = 1;
  if (typeof rg.filter === 'string') rg.filter = `blur(${Math.max(0.5, FACE_SCALE * 0.18).toFixed(2)}px)`;
  rg.drawImage(tinted(L, `rgb(${RELIEF.enamel},${RELIEF.enamel},${RELIEF.enamel})`), 0, 0, rc.width, rc.height);
  rg.drawImage(tinted(MM, '#ffffff'), 0, 0, rc.width, rc.height);
  if (gilt) rg.drawImage(tinted(L, '#ffffff'), 0, 0, rc.width, rc.height);
  rg.filter = 'none';
  return { face: c, foil, relief: rc };
}

/** Relief levels (0-255): the ground (its guilloche lifts it a little), the enamel just below it, metal proud. */
const RELIEF = { ground: 214, enamel: 186, metal: 255 };
/** Below this relief level a non-metal pixel is enamel (polished glassy) rather than ground. */
const ENAMEL_BELOW = 205;

let indexL: readonly [HTMLCanvasElement, CanvasRenderingContext2D] | undefined;
let haloL: readonly [HTMLCanvasElement, CanvasRenderingContext2D] | undefined;
let knockL: readonly [HTMLCanvasElement, CanvasRenderingContext2D] | undefined;

/** The index alone, at face resolution. */
function indexLayer(idx: FaceIndex) {
  const PW = Math.round(FACE_W * FACE_SCALE),
    PH = Math.round(FACE_H * FACE_SCALE);
  if (!indexL || indexL[0].width !== PW || indexL[0].height !== PH) indexL = canvas(PW, PH);
  const [I, ig] = indexL;
  ig.setTransform(1, 0, 0, 1, 0, 0);
  ig.clearRect(0, 0, PW, PH);
  ig.setTransform(FACE_SCALE, 0, 0, FACE_SCALE, 0, 0);
  if (idx.marked) drawMarkedIndex(ig, idx.text, idx.mark, idx.ink);
  else drawIndex(ig, idx.text, idx.ink);
  return I;
}

/** The index grown by a few units all round: where the frame parts for it. */
function indexHalo(I: HTMLCanvasElement) {
  if (!haloL || haloL[0].width !== I.width || haloL[0].height !== I.height) haloL = canvas(I.width, I.height);
  const [H, hg] = haloL;
  hg.clearRect(0, 0, H.width, H.height);
  const r = 3.2 * FACE_SCALE;
  // The index lives in the top-left corner: only that corner needs growing.
  const cw = Math.round(170 * FACE_SCALE),
    ch = Math.round(72 * FACE_SCALE);
  for (let a = 0; a < 16; a++) hg.drawImage(I, 0, 0, cw, ch, Math.cos((a / 16) * Math.PI * 2) * r, Math.sin((a / 16) * Math.PI * 2) * r, cw, ch);
  hg.drawImage(I, 0, 0, cw, ch, 0, 0, cw, ch);
  return H;
}

/** A copy of `src` with `hole` cut out of it (scratch canvas, valid until the next call). */
function knockOut(src: HTMLCanvasElement, hole: HTMLCanvasElement) {
  if (!knockL || knockL[0].width !== src.width || knockL[0].height !== src.height) knockL = canvas(src.width, src.height);
  const [K, kg] = knockL;
  kg.globalCompositeOperation = 'source-over';
  kg.clearRect(0, 0, K.width, K.height);
  kg.drawImage(src, 0, 0);
  kg.globalCompositeOperation = 'destination-out';
  kg.drawImage(hole, 0, 0);
  kg.globalCompositeOperation = 'source-over';
  return K;
}

/** The face's symbols on the scratch layer (and their metal parts on their own), already moved clear of the corner index; and the index. */
function inkLayer(g: CanvasRenderingContext2D, kind: number, labels: boolean, red: boolean) {
  const PW = Math.round(FACE_W * FACE_SCALE),
    PH = Math.round(FACE_H * FACE_SCALE);
  if (!layer || layer[0].width !== PW || layer[0].height !== PH) layer = canvas(PW, PH);
  metalL = sized(metalL, PW, PH);
  const [L, lg] = layer;
  const [M, ml] = metalL;
  for (const x of [lg, ml]) {
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, PW, PH);
    x.setTransform(FACE_SCALE, 0, 0, FACE_SCALE, 0, 0);
  }
  const s = suitOf(kind);
  // Calligraphy takes the finest wire; pips and canes a bolder one.
  wireW = s === 'pin' || s === 'sou' ? 1.6 : 1.15;
  metalCtx = ml;
  try {
    if (isJoker(kind)) drawJoker(lg);
    else if (isFlower(kind)) drawFlower(lg, kind);
    else if (isTypedJoker(kind)) drawKhung(lg, kind - FLOWER_JOKER);
    else if (isAnimal(kind)) drawAnimal(lg, kind - ANIMAL_BASE);
    else if (s === 'man') drawCharacter(lg, rankOf(kind), red);
    else if (s === 'pin') drawDots(lg, rankOf(kind), red);
    else if (s === 'sou') drawBamboo(lg, rankOf(kind), red);
    else if (s === 'wind') drawGlyph(lg, '東南西北'[kind - 27], TILE_SET.ink, 132);
    else if (kind === 31) drawGlyph(lg, '中', TILE_SET.red, 140);
    else if (kind === 32) drawGlyph(lg, '發', TILE_SET.green, 132);
    else drawWhiteDragon(lg);
  } finally {
    metalCtx = null;
  }

  // The corner index (and a red five's marker) never touch the tile's symbols:
  // if the ink reaches under them, the whole design shrinks a little and moves
  // clear of the corner (see clearOfIndex).
  const keepOut: Box[] = [];
  const idx = indexFor(kind, labels, red);
  if (idx) keepOut.push(idx.marked ? markedIndexBox(g, idx.text, idx.mark) : indexBox(g, idx.text));
  if (red) keepOut.push(RED_MARKER_BOX);
  if (keepOut.length) clearOfIndex(L, keepOut, M);
  return { L, M, idx, keepOut };
}

/**
 * Inked pixels of a face's symbols that lie under (or within half the gap of)
 * its corner index or red-five marker, in the equipped set. 0 means clear.
 * For the face checks (scripts/check-faces.mjs).
 */
export function indexOverlap(kind: number, labels = true, red = false): number {
  red = red && kind < 27;
  const [, g] = canvas(4, 4);
  g.scale(FACE_SCALE, FACE_SCALE);
  const { L, keepOut } = inkLayer(g, kind, labels, red);
  const d = L.getContext('2d')!.getImageData(0, 0, L.width, L.height).data;
  let n = 0;
  for (const b of keepOut) {
    const m = INDEX_GAP / 2;
    for (let y = Math.max(0, Math.floor((b.y - m) * FACE_SCALE)); y < Math.min(L.height, Math.ceil((b.y + b.h + m) * FACE_SCALE)); y++)
      for (let x = Math.max(0, Math.floor((b.x - m) * FACE_SCALE)); x < Math.min(L.width, Math.ceil((b.x + b.w + m) * FACE_SCALE)); x++) if (d[(y * L.width + x) * 4 + 3] > 16) n++;
  }
  return n;
}

interface FaceIndex {
  text: string;
  ink: string;
  /** Suit-marked (Settings, Accessibility) rather than the plain numeral. */
  marked: boolean;
  mark: SuitMark;
}

/** What the corner index shows on a face, if anything. */
function indexFor(kind: number, labels: boolean, red: boolean): FaceIndex | null {
  const s = suitOf(kind);
  if (FACE_ACCESS.suitMarks) {
    const t = tileIndex(kind);
    return { text: t.text, mark: t.mark, ink: red ? TILE_SET.aka : TILE_SET[t.ink], marked: true };
  }
  if (!labels) return null;
  {
    let label: string | undefined;
    let ink = TILE_SET.ink;
    if (isJoker(kind)) label = undefined;
    else if (isFlower(kind)) {
      label = String(flowerNumber(kind));
      const i = kind - FLOWER_BASE;
      ink = i < 4 ? (i % 2 ? TILE_SET.green : TILE_SET.red) : TILE_SET.blue;
    } else if (isTypedJoker(kind)) {
      label = 'J';
      ink = [TILE_SET.red, TILE_SET.blue, TILE_SET.green, TILE_SET.ink][kind - FLOWER_JOKER];
    } else if (isAnimal(kind)) {
      const i = kind - ANIMAL_BASE;
      // Predator and prey share a number: 1 cat & mouse, 2 rooster & centipede.
      label = String(i < 2 ? 1 : 2);
      ink = ANIMAL_RING[i];
    } else {
      label = s === 'wind' ? WINDS[kind - 27] : s === 'dragon' ? DRAGON_INDEX[kind - 31] : String(rankOf(kind));
      // Ink follows the suit, so number and suit read together at a glance.
      ink = s === 'dragon' ? [TILE_SET.red, TILE_SET.green, TILE_SET.blue][kind - 31] : red ? TILE_SET.aka : s === 'pin' ? TILE_SET.blue : s === 'sou' ? TILE_SET.green : s === 'man' ? TILE_SET.red : TILE_SET.ink;
    }
    return label ? { text: label, ink, marked: false, mark: 'none' } : null;
  }
}

/** A rectangle on the face, in face units (FACE_W x FACE_H). */
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Clear space kept between a symbol and the index chip (face units). */
const INDEX_GAP = 4;
const RED_MARKER_BOX: Box = { x: FACE_W - 30, y: 10, w: 20, h: 20 };

/**
 * Moves the ink layer clear of the keep-out boxes. Finds the largest scale (and
 * the smallest shift from centre) at which no inked pixel falls inside any box
 * grown by INDEX_GAP, using a summed-area table of the ink, and redraws the
 * layer with it. Faces already clear are left untouched.
 */
function clearOfIndex(L: HTMLCanvasElement, boxes: Box[], M?: HTMLCanvasElement) {
  // Worked out on a copy at 1.5 pixels per unit (the fit does not need more), applied at full detail.
  const k = Math.min(FACE_SCALE, 1.5),
    up = FACE_SCALE / k;
  const W = Math.round(FACE_W * k),
    H = Math.round(FACE_H * k);
  if (!probeL || probeL[0].width !== W || probeL[0].height !== H) probeL = canvas(W, H, true);
  const pg = probeL[1];
  pg.clearRect(0, 0, W, H);
  pg.drawImage(L, 0, 0, W, H);
  // The symbols' metal parts and their wires keep clear too.
  if (M) pg.drawImage(M, 0, 0, W, H);
  if (typeof pg.filter === 'string') {
    pg.filter = `blur(${(1.6 * k).toFixed(2)}px)`;
    pg.drawImage(L, 0, 0, W, H);
    pg.filter = 'none';
  }
  const data = pg.getImageData(0, 0, W, H).data;
  // sat[(y+1)*(W+1)+(x+1)] = inked pixels in [0,x] x [0,y].
  const sat = new Uint32Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) {
    let row = 0;
    for (let x = 0; x < W; x++) {
      row += data[(y * W + x) * 4 + 3] > 16 ? 1 : 0;
      sat[(y + 1) * (W + 1) + x + 1] = sat[y * (W + 1) + x + 1] + row;
    }
  }
  const inked = (x0: number, y0: number, x1: number, y1: number) => {
    const a = Math.max(0, Math.floor(x0)),
      b = Math.max(0, Math.floor(y0)),
      c = Math.min(W, Math.ceil(x1)),
      d = Math.min(H, Math.ceil(y1));
    if (c <= a || d <= b) return 0;
    return sat[d * (W + 1) + c] - sat[b * (W + 1) + c] - sat[d * (W + 1) + a] + sat[b * (W + 1) + a];
  };
  const keep = boxes.map((b) => ({ x0: (b.x - INDEX_GAP) * k, y0: (b.y - INDEX_GAP) * k, x1: (b.x + b.w + INDEX_GAP) * k, y1: (b.y + b.h + INDEX_GAP) * k }));
  const cx = W / 2,
    cy = H / 2;
  // Does the layer, scaled by s about the centre and shifted by (dx, dy), stay out of every box?
  const clear = (s: number, dx: number, dy: number) =>
    keep.every((r) => inked((r.x0 - dx - cx) / s + cx, (r.y0 - dy - cy) / s + cy, (r.x1 - dx - cx) / s + cx, (r.y1 - dy - cy) / s + cy) === 0);
  if (clear(1, 0, 0)) return;
  // Shift away from the boxes: down always, and sideways away from whichever corners are kept out.
  const left = keep.some((r) => r.x0 < cx),
    right = keep.some((r) => r.x1 > cx);
  const xs = left && right ? [0] : left ? [0, 0.5, 1] : [0, -0.5, -1];
  for (let s = 0.98; s >= 0.6; s -= 0.02) {
    let best: [number, number] | null = null;
    let bestCost = Infinity;
    for (const kx of xs)
      for (const ky of [0, 0.5, 1]) {
        const dx = kx * (1 - s) * cx,
          dy = ky * (1 - s) * cy;
        const cost = kx * kx + ky * ky;
        if (cost < bestCost && clear(s, dx, dy)) {
          best = [dx, dy];
          bestCost = cost;
        }
      }
    if (best) {
      for (const layerC of M ? [L, M] : [L]) {
        const FW = layerC.width,
          FH = layerC.height;
        const lg = layerC.getContext('2d')!;
        const copy = document.createElement('canvas');
        copy.width = FW;
        copy.height = FH;
        copy.getContext('2d')!.drawImage(layerC, 0, 0);
        lg.save();
        lg.setTransform(1, 0, 0, 1, 0, 0);
        lg.clearRect(0, 0, FW, FH);
        lg.setTransform(s, 0, 0, s, (cx - s * cx + best[0]) * up, (cy - s * cy + best[1]) * up);
        lg.drawImage(copy, 0, 0);
        lg.restore();
      }
      return;
    }
  }
}

// ------------------------------------------------------------ materials

/**
 * Paints a material: used for the face ground and for the body and back
 * textures of the 3D tiles. `base` is the centre colour and `edge` the rim.
 */
function paintFinish(g: CanvasRenderingContext2D, w: number, h: number, f: TileFinish, base: string, edge: string, seed: number) {
  const r = rng(seed);
  g.save();
  const radial = (a = base, b = edge) => {
    const gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.1, w / 2, h / 2, Math.max(w, h) * 0.75);
    gr.addColorStop(0, a);
    gr.addColorStop(1, b);
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  };
  const metal = (stops: string[]) => {
    // Polished, not painted: the colour stays close to the metal's own and the room's reflections
    // do the shading, with only a whisper of a fine satin grain.
    const gr = g.createLinearGradient(0, 0, w, h);
    stops.forEach((s, i) => gr.addColorStop(i / (stops.length - 1), mix(s, base, 0.7)));
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 0.5) {
      g.fillStyle = r() < 0.5 ? `rgba(255,255,255,${r() * 0.03})` : `rgba(0,0,0,${r() * 0.03})`;
      g.fillRect(0, y, w, 0.5);
    }
  };
  switch (f) {
    case 'ivory': {
      radial();
      // Faint growth lines, barely there: polished, not aged.
      for (let i = 0; i < 14; i++) {
        g.strokeStyle = `rgba(150,125,80,${0.008 + r() * 0.012})`;
        g.lineWidth = 1 + r() * 2;
        g.beginPath();
        const x = r() * w;
        g.moveTo(x, 0);
        g.bezierCurveTo(x + (r() - 0.5) * 30, h / 3, x + (r() - 0.5) * 30, (h * 2) / 3, x + (r() - 0.5) * 20, h);
        g.stroke();
      }
      break;
    }
    case 'bone': {
      radial(base, mix(edge, '#c8a870', 0.12));
      // A fine longitudinal grain, as in polished bone; no dark flecks (they read as dirt).
      for (let i = 0; i < 70; i++) {
        g.strokeStyle = `rgba(130,100,60,${0.01 + r() * 0.018})`;
        g.lineWidth = 0.5 + r() * 1.2;
        const x = r() * w;
        g.beginPath();
        g.moveTo(x, r() * h * 0.3);
        g.lineTo(x + (r() - 0.5) * 6, h * (0.6 + r() * 0.4));
        g.stroke();
      }
      break;
    }
    case 'lacquer': {
      radial(base, edge);
      // Deep, liquid gloss: one soft diagonal band.
      const lg = g.createLinearGradient(0, 0, w, h);
      lg.addColorStop(0.15, 'rgba(255,255,255,0)');
      lg.addColorStop(0.32, 'rgba(255,255,255,0.10)');
      lg.addColorStop(0.42, 'rgba(255,255,255,0)');
      g.fillStyle = lg;
      g.fillRect(0, 0, w, h);
      break;
    }
    case 'jade': {
      radial();
      // Cloudy mottling: lighter and darker inclusions, a few veins.
      for (let i = 0; i < 26; i++) {
        const x = r() * w,
          y = r() * h,
          rad = 10 + r() * Math.max(w, h) * 0.22;
        const c = r() < 0.55 ? mix(base, '#ffffff', 0.35) : mix(edge, '#0d3a24', 0.35);
        const gr = g.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, rgba(c, 0.22 + r() * 0.2));
        gr.addColorStop(1, rgba(c, 0));
        g.fillStyle = gr;
        g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
      for (let i = 0; i < 5; i++) {
        g.strokeStyle = rgba(mix(edge, '#0a2e1c', 0.4), 0.12 + r() * 0.12);
        g.lineWidth = 0.6 + r();
        g.beginPath();
        let x = r() * w,
          y = r() * h;
        g.moveTo(x, y);
        for (let k = 0; k < 4; k++) {
          x += (r() - 0.5) * w * 0.5;
          y += (r() - 0.3) * h * 0.35;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      break;
    }
    case 'malachite': {
      g.fillStyle = edge;
      g.fillRect(0, 0, w, h);
      // Concentric wavy bands of light and dark green, the stone's signature.
      const cx = w * (0.2 + r() * 0.6),
        cy = h * (1.05 + r() * 0.3);
      const dark = mix(base, '#02261a', 0.55),
        light = mix(base, '#7fe0b0', 0.35);
      for (let k = 60; k > 0; k--) {
        const rad = k * Math.max(w, h) * 0.035;
        g.fillStyle = k % 3 === 0 ? light : k % 3 === 1 ? base : dark;
        g.beginPath();
        for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.12) {
          const rr = rad * (1 + 0.06 * Math.sin(a * 5 + k * 0.7) + 0.03 * Math.sin(a * 11 + k));
          const px = cx + Math.cos(a) * rr * 1.2,
            py = cy + Math.sin(a) * rr;
          if (a === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.fill();
      }
      break;
    }
    case 'marble': {
      radial();
      const light = luma(base) > 0.5;
      const vein = light ? '70,70,75' : '235,230,220';
      for (let i = 0; i < 9; i++) {
        g.strokeStyle = `rgba(${vein},${0.12 + r() * 0.3})`;
        g.lineWidth = 0.6 + r() * 2.4;
        g.beginPath();
        let x = r() * w,
          y = r() * h * 0.2;
        g.moveTo(x, y);
        for (let k = 0; k < 6; k++) {
          const nx = x + (r() - 0.4) * w * 0.4,
            ny = y + r() * h * 0.3;
          g.quadraticCurveTo(x + (r() - 0.5) * w * 0.3, (y + ny) / 2, nx, ny);
          x = nx;
          y = ny;
        }
        g.stroke();
      }
      // A soft grey cloud through the stone.
      for (let i = 0; i < 5; i++) {
        const x = r() * w,
          y = r() * h,
          rad = 20 + r() * 60;
        const gr = g.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, `rgba(${vein},0.05)`);
        gr.addColorStop(1, `rgba(${vein},0)`);
        g.fillStyle = gr;
        g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
      break;
    }
    case 'obsidian': {
      radial(mix(base, '#3a3a44', 0.25), edge);
      // Conchoidal ripples and a glassy streak of reflection.
      for (let k = 0; k < 7; k++) {
        g.strokeStyle = `rgba(255,255,255,${0.015 + r() * 0.025})`;
        g.lineWidth = 1 + r() * 2;
        g.beginPath();
        g.ellipse(w * (0.2 + r() * 0.6), h * (0.2 + r() * 0.6), 20 + r() * 80, 10 + r() * 40, r() * Math.PI, 0, Math.PI * 1.3);
        g.stroke();
      }
      const lg = g.createLinearGradient(0, 0, w, h * 0.7);
      lg.addColorStop(0.2, 'rgba(255,255,255,0)');
      lg.addColorStop(0.36, 'rgba(220,225,255,0.10)');
      lg.addColorStop(0.44, 'rgba(255,255,255,0)');
      g.fillStyle = lg;
      g.fillRect(0, 0, w, h);
      break;
    }
    case 'pearl': {
      radial();
      // Nacre: soft rainbow bands that ripple across the shell.
      const hues = ['#ffb3d4', '#a8eadb', '#c9bcff', '#ffd9a8', '#a9d6ff'];
      for (let i = 0; i < 9; i++) {
        g.strokeStyle = rgba(hues[i % hues.length], 0.3 + r() * 0.25);
        g.lineWidth = 6 + r() * 16;
        g.beginPath();
        const y0 = r() * h;
        g.moveTo(-10, y0);
        g.bezierCurveTo(w * 0.3, y0 + (r() - 0.5) * h * 0.5, w * 0.7, y0 + (r() - 0.5) * h * 0.5, w + 10, y0 + (r() - 0.5) * h * 0.3);
        g.stroke();
      }
      const lg = g.createLinearGradient(0, 0, w, h);
      lg.addColorStop(0, 'rgba(255,200,225,0.18)');
      lg.addColorStop(0.5, 'rgba(255,255,255,0.05)');
      lg.addColorStop(1, 'rgba(180,215,255,0.22)');
      g.fillStyle = lg;
      g.fillRect(0, 0, w, h);
      break;
    }
    case 'glass': {
      radial();
      // Cut-glass facets: triangles of differing brightness from a central star.
      const cx = w / 2,
        cy = h / 2;
      const pts: [number, number][] = [];
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        pts.push([cx + Math.cos(a) * w * 0.9, cy + Math.sin(a) * h * 0.9]);
      }
      for (let k = 0; k < 12; k++) {
        const [x1, y1] = pts[k],
          [x2, y2] = pts[(k + 1) % 12];
        g.fillStyle = k % 2 ? `rgba(255,255,255,${0.06 + r() * 0.12})` : `rgba(90,150,200,${0.03 + r() * 0.06})`;
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(x1, y1);
        g.lineTo(x2, y2);
        g.fill();
      }
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 1;
      for (const [x, y] of pts) {
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(x, y);
        g.stroke();
      }
      // Bright bevel edge.
      g.strokeStyle = 'rgba(255,255,255,0.7)';
      g.lineWidth = 3;
      g.strokeRect(2, 2, w - 4, h - 4);
      break;
    }
    case 'gold':
      metal([mix(base, '#5a3c0c', 0.45), mix(base, '#fff2c0', 0.55), base, mix(base, '#5a3c0c', 0.35), mix(base, '#fff2c0', 0.35)]);
      break;
    case 'rosegold':
      metal([mix(base, '#5a2a20', 0.4), mix(base, '#ffe6dc', 0.55), base, mix(base, '#5a2a20', 0.3), mix(base, '#ffe6dc', 0.3)]);
      break;
    case 'porcelain': {
      radial(base, edge);
      // A cool glaze pooling at the edges, with a bright wet highlight.
      const gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
      gr.addColorStop(0, 'rgba(200,215,240,0)');
      gr.addColorStop(1, 'rgba(160,185,225,0.25)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      const lg = g.createLinearGradient(0, 0, w * 0.8, h * 0.5);
      lg.addColorStop(0.2, 'rgba(255,255,255,0)');
      lg.addColorStop(0.3, 'rgba(255,255,255,0.35)');
      lg.addColorStop(0.36, 'rgba(255,255,255,0)');
      g.fillStyle = lg;
      g.fillRect(0, 0, w, h);
      break;
    }
    case 'amethyst': {
      // Polished amethyst: violet clouds, paler crystal veils and fine sparkle.
      radial(base, edge);
      for (let i = 0; i < 26; i++) {
        const x = r() * w,
          y = r() * h,
          rad = 10 + r() * 46;
        const gr = g.createRadialGradient(x, y, 0, x, y, rad);
        const c = r() < 0.5 ? mix(base, '#b77ad6', 0.5) : mix(edge, '#1a0826', 0.45);
        gr.addColorStop(0, rgba(c, 0.32 + r() * 0.2));
        gr.addColorStop(1, rgba(c, 0));
        g.fillStyle = gr;
        g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
      for (let i = 0; i < 7; i++) {
        g.strokeStyle = `rgba(230,200,255,${0.05 + r() * 0.08})`;
        g.lineWidth = 2 + r() * 6;
        g.beginPath();
        const y0 = r() * h;
        g.moveTo(-5, y0);
        g.bezierCurveTo(w * 0.3, y0 + (r() - 0.5) * 60, w * 0.7, y0 + (r() - 0.5) * 60, w + 5, y0 + (r() - 0.5) * 40);
        g.stroke();
      }
      for (let i = 0; i < 160; i++) {
        g.fillStyle = `rgba(255,240,255,${0.15 + r() * 0.4})`;
        g.fillRect(r() * w, r() * h, 0.6, 0.6);
      }
      break;
    }
    case 'wood':
    case 'bamboo': {
      radial(base, edge);
      const bamboo = f === 'bamboo';
      // Grain: long wavy lines, darker and lighter, running the length of the tile.
      for (let i = 0; i < (bamboo ? 90 : 46); i++) {
        const x0 = r() * w;
        const dark = r() < 0.6;
        g.strokeStyle = dark ? `rgba(30,15,5,${0.06 + r() * 0.14})` : `rgba(255,225,180,${0.03 + r() * 0.07})`;
        g.lineWidth = bamboo ? 0.6 + r() * 0.8 : 0.8 + r() * 2.4;
        g.beginPath();
        g.moveTo(x0, 0);
        const amp = bamboo ? 1.5 : 6 + r() * 10;
        for (let y = 0; y <= h; y += 8) g.lineTo(x0 + Math.sin(y * 0.03 + i) * amp + Math.sin(y * 0.11 + i * 2) * amp * 0.3, y);
        g.stroke();
      }
      if (bamboo) {
        // A node ring across the cane.
        const ny = h * (0.3 + r() * 0.15);
        const ng = g.createLinearGradient(0, ny - 8, 0, ny + 8);
        ng.addColorStop(0, 'rgba(60,35,10,0)');
        ng.addColorStop(0.5, 'rgba(60,35,10,0.35)');
        ng.addColorStop(1, 'rgba(255,230,180,0.12)');
        g.fillStyle = ng;
        g.fillRect(0, ny - 8, w, 16);
      } else {
        // A small knot with rings around it.
        const kx = w * (0.2 + r() * 0.6),
          ky = h * (0.2 + r() * 0.6);
        for (let k = 6; k > 0; k--) {
          g.strokeStyle = `rgba(30,15,5,${0.05 + k * 0.012})`;
          g.lineWidth = 1.2;
          g.beginPath();
          g.ellipse(kx, ky, k * 3.2, k * 6, 0, 0, Math.PI * 2);
          g.stroke();
        }
      }
      break;
    }
  }
  g.restore();
}

// ------------------------------------------------------------ foil

/** Metals for foil linework: shading stops (shadow, body, highlight, fold) and the 3D surface they take. */
const METALS: Record<TileFoil['metal'], { stops: string[]; rough: number; metal: number }> = {
  gold: { stops: ['#7a5212', '#d9b25a', '#fff0b8', '#b88a2e', '#e8c873'], rough: 0.2, metal: 1 },
  silver: { stops: ['#5f656d', '#c9ced6', '#ffffff', '#8d949d', '#dfe3e8'], rough: 0.18, metal: 1 },
  rosegold: { stops: ['#7a3e30', '#d99a84', '#ffe2d4', '#a86a58', '#ebb7a3'], rough: 0.2, metal: 1 },
  copper: { stops: ['#5e2a12', '#c27242', '#ffcfa8', '#8e4a26', '#d98a58'], rough: 0.24, metal: 1 },
  brass: { stops: ['#5e4216', '#c9a45a', '#f6e2a6', '#94722e', '#dcbb72'], rough: 0.26, metal: 1 },
};

/** The struck foil of the equipped set at one detail, the same on every face: [foil, foil set with its emboss]. */
const foilCache = new Map<string, [HTMLCanvasElement, HTMLCanvasElement]>();

/**
 * Strikes the set's frame and border pattern in foil on a layer of its own,
 * shades it like polished metal and sets it into the face with a fine
 * emboss. The pattern stays in the margin, around the symbols, never under them.
 * Returns the layer (its alpha is where the face is metal).
 */
function frameLayers(): [HTMLCanvasElement, HTMLCanvasElement] {
  const key = `${TILE_SET.id}:${FACE_SCALE}`;
  let hit = foilCache.get(key);
  if (!hit) {
    hit = strikeFoil();
    foilCache.set(key, hit);
  }
  return hit;
}

function strikeFoil(): [HTMLCanvasElement, HTMLCanvasElement] {
  const PW = Math.round(FACE_W * FACE_SCALE),
    PH = Math.round(FACE_H * FACE_SCALE);
  const [F, fg] = canvas(PW, PH);
  fg.setTransform(FACE_SCALE, 0, 0, FACE_SCALE, 0, 0);
  drawFrame(fg);
  // Sets without foil: the frame engraved in the set's trim, as it is.
  if (!style.foil) return [F, F];
  drawBorder(fg, style.foil.border);
  // Polished metal: a raking light across the face, a fine brushed grain.
  const m = METALS[style.foil!.metal];
  fg.globalCompositeOperation = 'source-in';
  const lg = fg.createLinearGradient(0, 0, FACE_W * 0.9, FACE_H);
  m.stops.forEach((c, i) => lg.addColorStop(i / (m.stops.length - 1), c));
  fg.fillStyle = lg;
  fg.fillRect(0, 0, FACE_W, FACE_H);
  fg.globalCompositeOperation = 'source-atop';
  const r = rng(seedOf(style.id) + 17);
  for (let y = 0; y < FACE_H; y += 0.75) {
    fg.fillStyle = r() < 0.5 ? `rgba(255,255,255,${r() * 0.12})` : `rgba(0,0,0,${r() * 0.1})`;
    fg.fillRect(0, y, FACE_W, 0.5);
  }
  fg.globalCompositeOperation = 'source-over';
  // Set into the face: a hairline shadow below, a bright lip above.
  const k = FACE_SCALE;
  const [D, dg] = canvas(PW, PH);
  dg.drawImage(tinted(F, TILE_SET.dark ? 'rgba(0,0,0,0.6)' : 'rgba(60,40,10,0.35)'), 0.5 * k, 0.7 * k);
  dg.drawImage(tinted(F, 'rgba(255,255,255,0.35)'), -0.3 * k, -0.4 * k);
  dg.drawImage(F, 0, 0);
  return [F, D];
}

/** Points along the face's margin, edge by edge (corners left for ornaments). */
function marginEdges(inset: number, cornerGap: number) {
  const x0 = inset,
    y0 = inset,
    x1 = FACE_W - inset,
    y1 = FACE_H - inset;
  return [
    { ax: x0 + cornerGap, ay: y0, bx: x1 - cornerGap, by: y0, nx: 0, ny: 1 },
    { ax: x1, ay: y0 + cornerGap, bx: x1, by: y1 - cornerGap, nx: -1, ny: 0 },
    { ax: x1 - cornerGap, ay: y1, bx: x0 + cornerGap, by: y1, nx: 0, ny: -1 },
    { ax: x0, ay: y1 - cornerGap, bx: x0, by: y0 + cornerGap, nx: 1, ny: 0 },
  ];
}

/** The foil border pattern, drawn in the margin band (about 9-16 face units in from the edge). */
function drawBorder(g: CanvasRenderingContext2D, kind: TileFoil['border']) {
  g.save();
  g.strokeStyle = g.fillStyle = '#fff';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const band = 12.5;
  const corners: [number, number][] = [
    [band, band],
    [FACE_W - band, band],
    [FACE_W - band, FACE_H - band],
    [band, FACE_H - band],
  ];
  const rosette = (x: number, y: number, r: number) => {
    for (let p = 0; p < 4; p++) {
      const a = (p / 4) * Math.PI * 2 + Math.PI / 4;
      g.beginPath();
      g.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.5, r * 0.26, a, 0, Math.PI * 2);
      g.fill();
    }
    g.beginPath();
    g.arc(x, y, r * 0.22, 0, Math.PI * 2);
    g.fill();
  };
  switch (kind) {
    case 'beads': {
      // Fine gilt rules either side of a row of beads, as on painted porcelain.
      g.lineWidth = 0.9;
      g.beginPath();
      g.roundRect(band - 3.4, band - 3.4, FACE_W - (band - 3.4) * 2, FACE_H - (band - 3.4) * 2, 9);
      g.roundRect(band + 3.4, band + 3.4, FACE_W - (band + 3.4) * 2, FACE_H - (band + 3.4) * 2, 6);
      g.stroke();
      for (const e of marginEdges(band, 6)) {
        const len = Math.hypot(e.bx - e.ax, e.by - e.ay);
        const n = Math.round(len / 5.2);
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          g.beginPath();
          g.arc(e.ax + (e.bx - e.ax) * t, e.ay + (e.by - e.ay) * t, i % 4 === 0 ? 1.35 : 0.95, 0, Math.PI * 2);
          g.fill();
        }
      }
      for (const [x, y] of corners) rosette(x, y, 5.2);
      break;
    }
    case 'guilloche': {
      // Two interlaced waves, like the engine-turned border of a banknote.
      g.lineWidth = 0.7;
      for (const e of marginEdges(band, 4)) {
        const len = Math.hypot(e.bx - e.ax, e.by - e.ay);
        const ux = (e.bx - e.ax) / len,
          uy = (e.by - e.ay) / len;
        for (const ph of [0, Math.PI, Math.PI / 2]) {
          g.beginPath();
          for (let d = 0; d <= len; d += 0.8) {
            const o = Math.sin((d / 7) * Math.PI * 2 + ph) * (ph === Math.PI / 2 ? 1.4 : 3);
            const x = e.ax + ux * d + e.nx * o,
              y = e.ay + uy * d + e.ny * o;
            if (d === 0) g.moveTo(x, y);
            else g.lineTo(x, y);
          }
          g.stroke();
        }
      }
      g.lineWidth = 0.9;
      g.beginPath();
      g.roundRect(band - 4.6, band - 4.6, FACE_W - (band - 4.6) * 2, FACE_H - (band - 4.6) * 2, 9);
      g.roundRect(band + 4.6, band + 4.6, FACE_W - (band + 4.6) * 2, FACE_H - (band + 4.6) * 2, 6);
      g.stroke();
      for (const [x, y] of corners) {
        g.beginPath();
        g.arc(x, y, 3, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    case 'fret': {
      // The Chinese key fret (huiwen), a continuous meander round the face.
      g.lineWidth = 1;
      const u = 3.2;
      for (const e of marginEdges(band, 7)) {
        const len = Math.hypot(e.bx - e.ax, e.by - e.ay);
        const ux = (e.bx - e.ax) / len,
          uy = (e.by - e.ay) / len;
        const n = Math.floor(len / (u * 3));
        const start = (len - n * u * 3) / 2;
        const P = (d: number, o: number) => [e.ax + ux * d + e.nx * o, e.ay + uy * d + e.ny * o] as const;
        g.beginPath();
        g.moveTo(...P(start, u));
        for (let i = 0; i < n; i++) {
          const d = start + i * u * 3;
          // One key: up, across, down a little, back, down, across to the next.
          g.lineTo(...P(d, -u));
          g.lineTo(...P(d + u * 2, -u));
          g.lineTo(...P(d + u * 2, u * 0.2));
          g.lineTo(...P(d + u, u * 0.2));
          g.moveTo(...P(d + u, u * 0.2));
          g.moveTo(...P(d, u));
          g.lineTo(...P(d + u * 3, u));
        }
        g.stroke();
      }
      for (const [x, y] of corners) {
        g.beginPath();
        g.rect(x - 3, y - 3, 6, 6);
        g.stroke();
      }
      break;
    }
    case 'lattice': {
      // A chain of small lozenges.
      g.lineWidth = 0.8;
      for (const e of marginEdges(band, 6)) {
        const len = Math.hypot(e.bx - e.ax, e.by - e.ay);
        const ux = (e.bx - e.ax) / len,
          uy = (e.by - e.ay) / len;
        const n = Math.round(len / 7);
        const step = len / n;
        for (let i = 0; i < n; i++) {
          const d = i * step + step / 2;
          const cx = e.ax + ux * d,
            cy = e.ay + uy * d;
          g.beginPath();
          g.moveTo(cx - ux * step * 0.5, cy - uy * step * 0.5);
          g.lineTo(cx + e.nx * 3, cy + e.ny * 3);
          g.lineTo(cx + ux * step * 0.5, cy + uy * step * 0.5);
          g.lineTo(cx - e.nx * 3, cy - e.ny * 3);
          g.closePath();
          g.stroke();
          g.beginPath();
          g.arc(cx, cy, 0.8, 0, Math.PI * 2);
          g.fill();
        }
      }
      for (const [x, y] of corners) rosette(x, y, 4.6);
      break;
    }
    case 'scroll': {
      // Filigree scrolls curling out of each corner, a fine rule between them.
      g.lineWidth = 1.1;
      for (const [x, y] of corners) {
        const sx = x < FACE_W / 2 ? 1 : -1,
          sy = y < FACE_H / 2 ? 1 : -1;
        g.beginPath();
        g.moveTo(x, y + sy * 26);
        g.quadraticCurveTo(x, y, x + sx * 26, y);
        g.moveTo(x + sx * 26, y);
        g.bezierCurveTo(x + sx * 34, y, x + sx * 36, y + sy * 7, x + sx * 30, y + sy * 8);
        g.arc(x + sx * 30, y + sy * 5.5, 2.5, Math.PI / 2, Math.PI * 2.2, sx * sy < 0);
        g.moveTo(x, y + sy * 26);
        g.bezierCurveTo(x, y + sy * 34, x + sx * 7, y + sy * 36, x + sx * 8, y + sy * 30);
        g.stroke();
        g.beginPath();
        g.arc(x + sx * 7, y + sy * 7, 2.2, 0, Math.PI * 2);
        g.fill();
      }
      g.lineWidth = 0.7;
      g.beginPath();
      g.roundRect(band + 3, band + 3, FACE_W - (band + 3) * 2, FACE_H - (band + 3) * 2, 6);
      g.stroke();
      break;
    }
    default:
  }
  g.restore();
}

/** Cabochon gems set into the margin at the middle of each long edge. Returns [x, y, r] of each. */
function drawGems(g: CanvasRenderingContext2D): [number, number, number][] {
  const col = style.foil?.gems;
  if (!col) return [];
  const r = 3.6;
  const at: [number, number, number][] = [
    [FACE_W / 2, 12.5, r],
    [FACE_W / 2, FACE_H - 12.5, r],
    [12.5, FACE_H / 2, r],
    [FACE_W - 12.5, FACE_H / 2, r],
  ];
  const m = METALS[style.foil!.metal];
  for (const [x, y] of at) {
    g.save();
    // The bezel.
    g.fillStyle = m.stops[1];
    g.beginPath();
    g.arc(x, y, r + 1.3, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = m.stops[0];
    g.lineWidth = 0.6;
    g.stroke();
    // The stone: deep at the rim, bright at the crown, one white glint.
    const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
    gr.addColorStop(0, mix(col, '#ffffff', 0.55));
    gr.addColorStop(0.45, col);
    gr.addColorStop(1, mix(col, '#000000', 0.55));
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.beginPath();
    g.arc(x - r * 0.35, y - r * 0.4, r * 0.22, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  return at;
}

/** The engraved border round the face, in the set's trim colour. */
function drawFrame(g: CanvasRenderingContext2D) {
  const t = TILE_SET.trim;
  g.save();
  const rr = (x: number, y: number, w: number, h: number, r: number, lw: number, color: string) => {
    g.strokeStyle = color;
    g.lineWidth = lw;
    g.beginPath();
    g.roundRect(x, y, w, h, r);
    g.stroke();
  };
  switch (style.frame) {
    case 'line':
      rr(8, 8, FACE_W - 16, FACE_H - 16, 12, 2, rgba(t, 0.75));
      break;
    case 'double':
      rr(7, 7, FACE_W - 14, FACE_H - 14, 12, 4, rgba(t, 0.85));
      rr(15, 15, FACE_W - 30, FACE_H - 30, 8, 1.5, rgba(t, 0.7));
      break;
    case 'band': {
      // A gilded bezel framing a white inset.
      const gr = g.createLinearGradient(0, 0, FACE_W, FACE_H);
      gr.addColorStop(0, mix(t, '#5a3c0c', 0.3));
      gr.addColorStop(0.45, mix(t, '#fff2c0', 0.5));
      gr.addColorStop(1, mix(t, '#5a3c0c', 0.4));
      g.strokeStyle = gr;
      g.lineWidth = 7;
      g.beginPath();
      g.roundRect(6.5, 6.5, FACE_W - 13, FACE_H - 13, 12);
      g.stroke();
      rr(13, 13, FACE_W - 26, FACE_H - 26, 8, 1, 'rgba(0,0,0,0.25)');
      break;
    }
    case 'corners': {
      // Filigree: an L with a curl at each corner.
      g.strokeStyle = rgba(t, 0.9);
      g.lineWidth = 2.5;
      g.lineCap = 'round';
      for (const [sx, sy] of [
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
      ]) {
        const x = sx > 0 ? 12 : FACE_W - 12,
          y = sy > 0 ? 12 : FACE_H - 12;
        g.beginPath();
        g.moveTo(x, y + sy * 34);
        g.lineTo(x, y);
        g.lineTo(x + sx * 34, y);
        g.stroke();
        g.beginPath();
        g.arc(x + sx * 10, y + sy * 10, 5, 0, Math.PI * 2);
        g.stroke();
        g.beginPath();
        g.moveTo(x + sx * 34, y);
        g.quadraticCurveTo(x + sx * 44, y + sy * 2, x + sx * 40, y + sy * 9);
        g.moveTo(x, y + sy * 34);
        g.quadraticCurveTo(x + sx * 2, y + sy * 44, x + sx * 9, y + sy * 40);
        g.stroke();
      }
      break;
    }
    case 'deco': {
      // Art Deco: stepped corners and a small fan at the top and bottom.
      g.strokeStyle = rgba(t, 0.85);
      g.lineWidth = 1.6;
      for (const inset of [8, 13]) {
        const s = 14;
        g.beginPath();
        g.moveTo(inset + s, inset);
        g.lineTo(FACE_W - inset - s, inset);
        g.lineTo(FACE_W - inset - s, inset + s * 0.5);
        g.lineTo(FACE_W - inset, inset + s * 0.5);
        g.lineTo(FACE_W - inset, FACE_H - inset - s * 0.5);
        g.lineTo(FACE_W - inset - s, FACE_H - inset - s * 0.5);
        g.lineTo(FACE_W - inset - s, FACE_H - inset);
        g.lineTo(inset + s, FACE_H - inset);
        g.lineTo(inset + s, FACE_H - inset - s * 0.5);
        g.lineTo(inset, FACE_H - inset - s * 0.5);
        g.lineTo(inset, inset + s * 0.5);
        g.lineTo(inset + s, inset + s * 0.5);
        g.closePath();
        g.stroke();
      }
      for (const [y, dir] of [
        [13, 1],
        [FACE_H - 13, -1],
      ]) {
        for (let k = 0; k <= 6; k++) {
          const a = (k / 6) * Math.PI;
          g.beginPath();
          g.moveTo(FACE_W / 2, y);
          g.lineTo(FACE_W / 2 + Math.cos(a) * 16, y + dir * Math.sin(a) * 10);
          g.stroke();
        }
      }
      break;
    }
    default:
  }
  g.restore();
}

function tinted(src: HTMLCanvasElement, color: string) {
  if (!tintL || tintL[0].width !== src.width || tintL[0].height !== src.height) tintL = canvas(src.width, src.height);
  const [c, g] = tintL;
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, c.width, c.height);
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'source-over';
  return c;
}

let bandL: readonly [HTMLCanvasElement, CanvasRenderingContext2D] | undefined;

/**
 * One edge of the ink, `d` face units wide: inside (the ink near its upper-left walls) or outside
 * (the face just past its lower-right walls). Sharp, not blurred, so the ink stays crisp.
 */
function inkEdge(L: HTMLCanvasElement, d: number, color: string, inside: boolean) {
  if (!bandL || bandL[0].width !== L.width || bandL[0].height !== L.height) bandL = canvas(L.width, L.height);
  const [B, bg] = bandL;
  const o = d * FACE_SCALE;
  bg.globalCompositeOperation = 'source-over';
  bg.clearRect(0, 0, B.width, B.height);
  bg.drawImage(tinted(L, color), inside ? 0 : o, inside ? 0 : o);
  bg.globalCompositeOperation = 'destination-out';
  bg.drawImage(L, inside ? o : 0, inside ? o : 0);
  bg.globalCompositeOperation = 'source-over';
  return B;
}

/**
 * Cuts the ink into the face: a bright lip where the light catches the lower-right edge of each
 * groove, and the groove's upper-left wall in shade. Drawn round ink already set into the face.
 */
function recess(g: CanvasRenderingContext2D, L: HTMLCanvasElement, beforeInk: boolean) {
  const dark = TILE_SET.dark;
  if (beforeInk) g.drawImage(inkEdge(L, 1.1, dark ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.9)', false), 0, 0);
  else {
    g.drawImage(inkEdge(L, 2.2, dark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.36)', true), 0, 0);
    g.drawImage(inkEdge(L, -1.2, 'rgba(255,255,255,0.3)', true), 0, 0);
  }
}

/** Sets the ink layer into the face: printed, carved, gilded, glowing or inlaid. */
function setInk(g: CanvasRenderingContext2D, L: HTMLCanvasElement) {
  const k = FACE_SCALE;
  g.save();
  switch (style.inkStyle) {
    case 'carved': {
      // Carved stone: the cut is filled with enamel to the brim, then polished flush.
      g.drawImage(tinted(L, TILE_SET.dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.6)'), 0.9 * k, 0.9 * k);
      g.drawImage(L, 0, 0);
      enamel(g, L, wireW < 1.4);
      break;
    }
    case 'gilded': {
      // Gold leaf laid into a cut groove.
      recess(g, L, true);
      g.drawImage(L, 0, 0);
      recess(g, L, false);
      // Leaf sheen: bright across the top, a darker fold below.
      const [c, tg] = tintL!;
      tg.clearRect(0, 0, c.width, c.height);
      tg.drawImage(L, 0, 0);
      tg.globalCompositeOperation = 'source-in';
      const lg = tg.createLinearGradient(0, 0, c.width * 0.6, c.height);
      lg.addColorStop(0, 'rgba(255,250,225,0.55)');
      lg.addColorStop(0.35, 'rgba(255,240,200,0.05)');
      lg.addColorStop(0.55, 'rgba(60,30,0,0.3)');
      lg.addColorStop(0.75, 'rgba(255,240,200,0.25)');
      lg.addColorStop(1, 'rgba(60,30,0,0.25)');
      tg.fillStyle = lg;
      tg.fillRect(0, 0, c.width, c.height);
      tg.globalCompositeOperation = 'source-over';
      g.drawImage(c, 0, 0);
      break;
    }
    case 'glow': {
      // The ink glows from inside the glass.
      if (typeof g.filter === 'string') {
        g.filter = `blur(${6 * k}px)`;
        g.globalAlpha = 0.85;
        g.drawImage(L, 0, 0);
        g.filter = 'none';
        g.globalAlpha = 1;
      } else {
        g.shadowColor = rgba(TILE_SET.blue, 0.8);
        g.shadowBlur = 14 * k;
      }
      g.drawImage(L, 0, 0);
      g.shadowBlur = 0;
      g.drawImage(tinted(L, 'rgba(255,255,255,0.25)'), -0.8 * k, -0.8 * k);
      g.globalCompositeOperation = 'source-over';
      break;
    }
    default:
      // Printed, inlaid and the rest: cloisonné, enamel laid between the wires and domed.
      g.drawImage(L, 0, 0);
      enamel(g, L, wireW < 1.4);
  }
  g.restore();
}

/** The material's last word: a highlight across the face, stronger on glossy sets. */
function drawGloss(g: CanvasRenderingContext2D) {
  const a = style.gloss * (TILE_SET.dark ? 0.1 : 0.16);
  if (a <= 0.01) return;
  const lg = g.createLinearGradient(0, 0, FACE_W, FACE_H * 0.8);
  lg.addColorStop(0, `rgba(255,255,255,${a})`);
  lg.addColorStop(0.35, 'rgba(255,255,255,0)');
  g.fillStyle = lg;
  g.fillRect(0, 0, FACE_W, FACE_H);
}

/** The Riichi convention: a small red dot in the top-right corner marks an aka (red) five. */
function drawRedMarker(g: CanvasRenderingContext2D) {
  const x = FACE_W - 20,
    y = 20;
  g.save();
  g.fillStyle = TILE_SET.aka;
  g.beginPath();
  g.arc(x, y, 9, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = TILE_SET.dark ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.7)';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(x, y, 9, 0, Math.PI * 2);
  g.stroke();
  g.restore();
}

/** Plants 梅蘭菊竹 in green and red, seasons 春夏秋冬 in blue, each with its seat number. */
function drawFlower(g: CanvasRenderingContext2D, kind: number) {
  const i = kind - FLOWER_BASE;
  const plant = i < 4;
  const ch = '梅蘭菊竹春夏秋冬'[i];
  const color = plant ? (i % 2 ? TILE_SET.green : TILE_SET.red) : TILE_SET.blue;
  // A small blossom above the glyph marks it as a bonus tile.
  for (let p = 0; p < 5; p++) {
    const a = (p / 5) * Math.PI * 2 - Math.PI / 2;
    circle(g, FACE_W / 2 + Math.cos(a) * 16, 58 + Math.sin(a) * 16, 11, plant ? '#d58aa0' : '#7fa3cf');
  }
  circle(g, FACE_W / 2, 58, 8, '#e2b14e');
  drawGlyph(g, ch, color, 104, 168);
}

/**
 * The corner index: a bold numeral (or wind/dragon letter), large enough to
 * read on distant tiles. It is drawn with the symbols, in the same ink and
 * finish, straight onto the face (no chip behind it).
 */
/** The plain index's font: a bold letter or number, or a smaller word (the dragons' RED, GREEN, WHITE). */
const indexFont = (label: string) => `800 ${label.length > 2 ? 29 : 50}px Manrope, system-ui, sans-serif`;

function indexBox(g: CanvasRenderingContext2D, label: string): Box {
  g.save();
  g.font = indexFont(label);
  const w = Math.max(40, g.measureText(label).width + 14);
  g.restore();
  return { x: 5, y: 5, w, h: label.length > 2 ? 40 : 54 };
}

function drawIndex(g: CanvasRenderingContext2D, label: string, ink: string) {
  const { x, y, w, h } = indexBox(g, label);
  g.save();
  g.font = indexFont(label);
  g.fillStyle = ink;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(label, x + w / 2, y + h / 2 + 2);
  g.restore();
}

/**
 * The suit-marked index (Settings, Accessibility): the number or letter and a
 * suit mark drawn as a shape, so suits differ by form as well as colour.
 */
function markedIndexBox(g: CanvasRenderingContext2D, text: string, mark: SuitMark): Box & { tw: number; mw: number } {
  g.save();
  g.font = `800 ${text.length > 2 ? 30 : 46}px Manrope, system-ui, sans-serif`;
  const tw = g.measureText(text).width;
  g.restore();
  const mw = mark === 'none' ? 0 : mark === 'char' ? 34 : 26;
  return { x: 5, y: 5, w: Math.max(40, tw + mw + (mw ? 18 : 14)), h: 54, tw, mw };
}

function drawMarkedIndex(g: CanvasRenderingContext2D, text: string, mark: SuitMark, ink: string) {
  const { x, y, h, tw, mw } = markedIndexBox(g, text, mark);
  g.save();
  g.font = `800 ${text.length > 2 ? 30 : 46}px Manrope, system-ui, sans-serif`;
  g.fillStyle = ink;
  g.strokeStyle = ink;
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  const left = x + 7;
  g.fillText(text, left, y + h / 2 + 2);
  const mx = left + tw + 3 + mw / 2,
    my = y + h / 2;
  g.beginPath();
  switch (mark) {
    case 'dot':
      // A ring with a centre dot, like the tile's own circles.
      g.lineWidth = 4;
      g.arc(mx, my, 10, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.arc(mx, my, 4, 0, Math.PI * 2);
      g.fill();
      break;
    case 'bamboo':
      // Two upright sticks.
      g.roundRect(mx - 9, my - 15, 6, 30, 3);
      g.roundRect(mx + 3, my - 15, 6, 30, 3);
      g.fill();
      break;
    case 'char':
      g.font = `900 30px "Noto Sans SC", "PingFang SC", "Microsoft YaHei", ${SERIF}`;
      g.textAlign = 'center';
      g.fillText('万', mx, my + 2);
      break;
    case 'dragon':
      g.moveTo(mx, my - 13);
      g.lineTo(mx + 10, my);
      g.lineTo(mx, my + 13);
      g.lineTo(mx - 10, my);
      g.closePath();
      g.fill();
      break;
    case 'plant':
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2 - Math.PI / 2;
        g.moveTo(mx + Math.cos(a) * 7 + 5, my + Math.sin(a) * 7);
        g.arc(mx + Math.cos(a) * 7, my + Math.sin(a) * 7, 5, 0, Math.PI * 2);
      }
      g.fill();
      break;
    case 'season':
      g.arc(mx, my, 6, 0, Math.PI * 2);
      g.fill();
      g.lineWidth = 3;
      g.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        g.moveTo(mx + Math.cos(a) * 9, my + Math.sin(a) * 9);
        g.lineTo(mx + Math.cos(a) * 13, my + Math.sin(a) * 13);
      }
      g.stroke();
      break;
    default:
  }
  g.restore();
}

/** American joker: bold gold lettering, readable at a glance. */
function drawJoker(g: CanvasRenderingContext2D) {
  g.save();
  g.fillStyle = '#7a1f2b';
  g.beginPath();
  g.roundRect(22, 30, FACE_W - 44, FACE_H - 60, 16);
  g.fill();
  g.fillStyle = '#f2cf7a';
  g.font = '800 38px Manrope, system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  'JOKER'.split('').forEach((ch, i) => g.fillText(ch, FACE_W / 2, 64 + i * 32));
  g.restore();
}

/**
 * Vietnamese Khung jokers: a lacquer-red double frame with a gold glyph.
 * 花 Flower Joker (a bonus tile), 喜 Wind Joker, 元 Dragon Joker, 合 Number Joker.
 * A small caption says what the joker can stand for.
 */
function drawKhung(g: CanvasRenderingContext2D, i: number) {
  const glyph = '花喜元合'[i];
  const caption = ['FLOWER', 'WINDS', 'DRAGONS', 'NUMBERS'][i];
  const tone = [TILE_SET.red, TILE_SET.blue, TILE_SET.green, TILE_SET.ink][i];
  const lacquer = TILE_SET.dark ? '#e0705f' : '#8a1c24';
  g.save();
  g.strokeStyle = lacquer;
  g.lineWidth = 6;
  g.beginPath();
  g.roundRect(16, 16, FACE_W - 32, FACE_H - 32, 14);
  g.stroke();
  g.strokeStyle = '#c99a3c';
  g.lineWidth = 2.5;
  g.beginPath();
  g.roundRect(26, 26, FACE_W - 52, FACE_H - 52, 10);
  g.stroke();
  // Four gold corner studs, as on lacquered joker tiles.
  g.fillStyle = '#c99a3c';
  for (const [x, y] of [
    [26, 26],
    [FACE_W - 26, 26],
    [26, FACE_H - 26],
    [FACE_W - 26, FACE_H - 26],
  ]) {
    g.beginPath();
    g.arc(x, y, 5, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  drawGlyph(g, glyph, tone, 112, FACE_H / 2 - 4);
  g.save();
  g.fillStyle = lacquer;
  g.font = '800 19px Manrope, system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(caption, FACE_W / 2, FACE_H - 48);
  g.restore();
}

const ANIMAL_RING = ['#d9a441', '#8f9aa6', '#c8553d', '#5e7d3a'];

/** Animal bonus tiles: a soft medallion with the animal's character and its name. */
function drawAnimal(g: CanvasRenderingContext2D, i: number) {
  const glyph = '貓鼠雞蜈'[i];
  const name = ['CAT', 'MOUSE', 'ROOSTER', 'CENTIPEDE'][i];
  const ring = ANIMAL_RING[i];
  const cx = FACE_W / 2,
    cy = FACE_H / 2 - 10;
  g.save();
  const halo = g.createRadialGradient(cx, cy, 10, cx, cy, 70);
  halo.addColorStop(0, rgba(TILE_SET.paper, 0.6));
  halo.addColorStop(1, rgba(mix(ring, TILE_SET.faceCentre, 0.7), 0.6));
  g.fillStyle = halo;
  g.beginPath();
  g.arc(cx, cy, 66, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = ring;
  g.lineWidth = 5;
  g.stroke();
  g.restore();
  drawGlyph(g, glyph, i === 2 ? TILE_SET.red : TILE_SET.ink, 92, cy + 4);
  g.save();
  // A darker shade of the ring keeps the name readable on light faces.
  g.fillStyle = TILE_SET.dark ? ring : mix(ring, '#000000', 0.35);
  g.font = `800 ${name.length > 7 ? 17 : 20}px Manrope, system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(name, cx, FACE_H - 34);
  g.restore();
}

function drawGlyph(g: CanvasRenderingContext2D, ch: string, color: string, size: number, y = FACE_H / 2 + 6) {
  const [weight, family] = FONTS[style.font];
  // Brush and Song faces run a little small for their size: give them room.
  const s = style.font === 'brush' ? size * 1.08 : style.font === 'song' ? size * 1.05 : size;
  g.fillStyle = color;
  g.font = `${weight} ${s}px ${family}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(ch, FACE_W / 2, y);
}

function drawCharacter(g: CanvasRenderingContext2D, n: number, red = false) {
  drawGlyph(g, CN_NUM[n - 1], red ? TILE_SET.aka : TILE_SET.ink, 84, 78);
  drawGlyph(g, '萬', red ? TILE_SET.aka : TILE_SET.red, 104, 182);
}

/** A ring-and-dot circle; the ring's hollow lets the face material show through. */
function circle(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  if (style.pip === 'rosette') return rosettePip(g, x, y, r, color);
  g.fillStyle = color;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.save();
  g.globalCompositeOperation = 'destination-out';
  g.beginPath();
  g.arc(x, y, r * 0.62, 0, Math.PI * 2);
  g.fill();
  g.restore();
  cabochon(g, x, y, r * 0.38, color);
}

/** A domed stone: deep at its rim, bright at the crown, with one white glint. */
function cabochon(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  const gr = g.createRadialGradient(x - r * 0.32, y - r * 0.36, r * 0.05, x, y, r);
  gr.addColorStop(0, mix(color, '#ffffff', 0.5));
  gr.addColorStop(0.5, color);
  gr.addColorStop(1, mix(color, '#000000', 0.38));
  g.fillStyle = gr;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.beginPath();
  g.ellipse(x - r * 0.36, y - r * 0.42, r * 0.24, r * 0.15, -0.6, 0, Math.PI * 2);
  g.fill();
}

/** A pearl: white nacre with a rosy sheen and a soft glint. */
function pearl(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r);
  gr.addColorStop(0, '#ffffff');
  gr.addColorStop(0.55, '#f1ebf0');
  gr.addColorStop(1, '#b9adb8');
  g.fillStyle = gr;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

/**
 * The Noyer set's pip: a chrysanthemum medallion, eight rounded petals in a
 * ring, with the face showing between them. (An original design for the set.)
 */
function rosettePip(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  g.save();
  g.fillStyle = color;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.globalCompositeOperation = 'destination-out';
  g.beginPath();
  g.arc(x, y, r * 0.8, 0, Math.PI * 2);
  g.fill();
  g.globalCompositeOperation = 'source-over';
  for (let p = 0; p < 8; p++) {
    const a = (p / 8) * Math.PI * 2;
    g.beginPath();
    g.ellipse(x + Math.cos(a) * r * 0.42, y + Math.sin(a) * r * 0.42, r * 0.27, r * 0.15, a, 0, Math.PI * 2);
    g.fill();
  }
  g.globalCompositeOperation = 'destination-out';
  g.beginPath();
  g.arc(x, y, r * 0.15, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

// Dot positions in a 0..1 box, traditional layouts.
// Colours are resolved at draw time so they follow the tile set.
type Ink = 'R' | 'G' | 'B';
const R: Ink = 'R',
  G: Ink = 'G',
  B: Ink = 'B';
const inkOf = (c: Ink) => (c === 'R' ? TILE_SET.red : c === 'G' ? TILE_SET.green : TILE_SET.blue);
const DOTS: Record<number, [number, number, Ink][]> = {
  1: [[0.5, 0.5, R]],
  2: [
    [0.5, 0.27, G],
    [0.5, 0.73, B],
  ],
  3: [
    [0.24, 0.22, B],
    [0.5, 0.5, R],
    [0.76, 0.78, G],
  ],
  4: [
    [0.28, 0.27, B],
    [0.72, 0.27, G],
    [0.28, 0.73, G],
    [0.72, 0.73, B],
  ],
  5: [
    [0.26, 0.24, B],
    [0.74, 0.24, G],
    [0.5, 0.5, R],
    [0.26, 0.76, G],
    [0.74, 0.76, B],
  ],
  6: [
    [0.3, 0.2, G],
    [0.7, 0.2, G],
    [0.3, 0.52, R],
    [0.7, 0.52, R],
    [0.3, 0.8, R],
    [0.7, 0.8, R],
  ],
  7: [
    [0.22, 0.14, G],
    [0.5, 0.24, G],
    [0.78, 0.34, G],
    [0.3, 0.58, R],
    [0.7, 0.58, R],
    [0.3, 0.84, R],
    [0.7, 0.84, R],
  ],
  8: [
    [0.3, 0.13, B],
    [0.7, 0.13, B],
    [0.3, 0.38, B],
    [0.7, 0.38, B],
    [0.3, 0.62, B],
    [0.7, 0.62, B],
    [0.3, 0.87, B],
    [0.7, 0.87, B],
  ],
  9: [
    [0.2, 0.18, B],
    [0.5, 0.18, B],
    [0.8, 0.18, B],
    [0.2, 0.5, R],
    [0.5, 0.5, R],
    [0.8, 0.5, R],
    [0.2, 0.82, G],
    [0.5, 0.82, G],
    [0.8, 0.82, G],
  ],
};

function drawDots(g: CanvasRenderingContext2D, n: number, red = false) {
  const pad = 22;
  const w = FACE_W - pad * 2,
    h = FACE_H - pad * 2;
  const r = n === 1 ? 60 : n <= 4 ? 30 : n <= 6 ? 25 : 21;
  for (const [x, y, col] of DOTS[n]) circle(g, pad + x * w, pad + y * h, r, red ? TILE_SET.aka : inkOf(col));
  if (n === 1) {
    g.strokeStyle = TILE_SET.green;
    g.lineWidth = 4;
    g.beginPath();
    g.arc(FACE_W / 2, FACE_H / 2, 74, 0, Math.PI * 2);
    g.stroke();
    // A ring of pearls round the great dot, each in its own collar.
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      pearl(g, FACE_W / 2 + Math.cos(a) * 66, FACE_H / 2 + Math.sin(a) * 66, 3.6);
    }
  }
}

function stick(g: CanvasRenderingContext2D, x: number, y: number, h: number, color: string) {
  const w = 16;
  g.fillStyle = color;
  g.beginPath();
  g.roundRect(x - w / 2, y - h / 2, w, h, 7);
  g.fill();
  // Enamel over a cane: lit down one side, deeper down the other.
  const lg = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  lg.addColorStop(0, 'rgba(255,255,255,0)');
  lg.addColorStop(0.3, 'rgba(255,255,255,0.32)');
  lg.addColorStop(0.55, 'rgba(255,255,255,0)');
  lg.addColorStop(1, 'rgba(0,0,0,0.22)');
  g.fillStyle = lg;
  g.beginPath();
  g.roundRect(x - w / 2, y - h / 2, w, h, 7);
  g.fill();
  // Metal ferrules: one at the node, a cap at each end.
  metalPart((m) => {
    m.beginPath();
    m.roundRect(x - w / 2 - 1.8, y - 3, w + 3.6, 6, 2.2);
    m.roundRect(x - w / 2 - 0.6, y - h / 2 - 1.2, w + 1.2, 4.6, 2);
    m.roundRect(x - w / 2 - 0.6, y + h / 2 - 3.4, w + 1.2, 4.6, 2);
    m.fill();
  });
}

const BAMBOO: Record<number, [number, number, number][]> = {
  2: [
    [0.5, 0.27, 0],
    [0.5, 0.73, 0],
  ],
  3: [
    [0.5, 0.27, 0],
    [0.3, 0.73, 0],
    [0.7, 0.73, 0],
  ],
  4: [
    [0.3, 0.27, 0],
    [0.7, 0.27, 0],
    [0.3, 0.73, 0],
    [0.7, 0.73, 0],
  ],
  5: [
    [0.24, 0.27, 0],
    [0.76, 0.27, 0],
    [0.5, 0.5, 1],
    [0.24, 0.73, 0],
    [0.76, 0.73, 0],
  ],
  6: [
    [0.22, 0.27, 0],
    [0.5, 0.27, 0],
    [0.78, 0.27, 0],
    [0.22, 0.73, 0],
    [0.5, 0.73, 0],
    [0.78, 0.73, 0],
  ],
  7: [
    [0.5, 0.17, 1],
    [0.22, 0.5, 0],
    [0.5, 0.5, 0],
    [0.78, 0.5, 0],
    [0.22, 0.83, 0],
    [0.5, 0.83, 0],
    [0.78, 0.83, 0],
  ],
  8: [
    [0.2, 0.27, 0],
    [0.4, 0.27, 0],
    [0.6, 0.27, 0],
    [0.8, 0.27, 0],
    [0.2, 0.73, 0],
    [0.4, 0.73, 0],
    [0.6, 0.73, 0],
    [0.8, 0.73, 0],
  ],
  9: [
    [0.22, 0.17, 1],
    [0.5, 0.17, 0],
    [0.78, 0.17, 1],
    [0.22, 0.5, 1],
    [0.5, 0.5, 0],
    [0.78, 0.5, 1],
    [0.22, 0.83, 1],
    [0.5, 0.83, 0],
    [0.78, 0.83, 1],
  ],
};

function drawBamboo(g: CanvasRenderingContext2D, n: number, red = false) {
  if (n === 1) return drawBird(g);
  const pad = 20;
  const w = FACE_W - pad * 2,
    h = FACE_H - pad * 2;
  const sh = n >= 7 ? 62 : 86;
  for (const [x, y, r] of BAMBOO[n]) stick(g, pad + x * w, pad + y * h, sh, red ? TILE_SET.aka : r ? TILE_SET.red : TILE_SET.green);
}

function drawBird(g: CanvasRenderingContext2D) {
  // A stylised sparrow perched on a bamboo stem: the traditional 1 Bamboo.
  const cx = FACE_W / 2,
    cy = FACE_H / 2;
  stick(g, cx + 34, cy + 40, 110, TILE_SET.green);
  g.fillStyle = TILE_SET.green;
  g.beginPath();
  g.ellipse(cx - 4, cy + 4, 46, 34, -0.35, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = TILE_SET.red;
  g.beginPath();
  g.ellipse(cx - 10, cy + 12, 26, 16, -0.35, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = TILE_SET.blue;
  g.beginPath();
  g.arc(cx - 40, cy - 30, 22, 0, Math.PI * 2);
  g.fill();
  // A pearl eye with a jet pupil, and a beak of solid metal.
  pearl(g, cx - 46, cy - 34, 6.5);
  cabochon(g, cx - 47, cy - 34, 3.2, '#1b1b1b');
  metalPart((m) => {
    m.beginPath();
    m.moveTo(cx - 61, cy - 31);
    m.lineTo(cx - 83, cy - 24);
    m.lineTo(cx - 61, cy - 21);
    m.closePath();
    m.fill();
  });
  // Tail feathers
  g.strokeStyle = TILE_SET.blue;
  g.lineWidth = 7;
  g.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.moveTo(cx + 30, cy + 20);
    g.quadraticCurveTo(cx + 60, cy + 30 + i * 12, cx + 70, cy + 70 + i * 14);
    g.stroke();
  }
}

function drawWhiteDragon(g: CanvasRenderingContext2D) {
  g.strokeStyle = TILE_SET.blue;
  g.lineWidth = 9;
  g.strokeRect(34, 40, FACE_W - 68, FACE_H - 80);
  g.lineWidth = 3;
  g.strokeRect(48, 54, FACE_W - 96, FACE_H - 108);
  // Metal studs at the corners of the frame, as on a jewel box.
  metalPart((m) => {
    for (const [x, y] of [
      [34, 40],
      [FACE_W - 34, 40],
      [34, FACE_H - 40],
      [FACE_W - 34, FACE_H - 40],
    ]) {
      m.beginPath();
      m.arc(x, y, 7.5, 0, Math.PI * 2);
      m.fill();
    }
  });
}

// ------------------------------------------------------------ backs and bodies

/** Back of the tile: its finish plus the set's engraving. Aspect matches a tile. */
function paintBack(st: TileSetStyle, w: number, h: number) {
  const [c, g] = canvas(w, h);
  const k = w / 192;
  g.save();
  g.scale(k, k);
  paintFinish(g, 192, 256, st.backFinish, st.back, mix(st.back, '#000000', 0.22), seedOf(st.id) * 3);
  drawMotif(g, st, 192, 256);
  if (!FRAMED_MOTIFS.has(st.motif)) drawBackFrame(g, st, 192, 256);
  g.restore();
  return c;
}

/** Back motifs that already carry their own border. */
const FRAMED_MOTIFS = new Set<TileSetStyle['motif']>(['cloud', 'bands', 'lattice', 'shell']);

/**
 * The back's border, engraved in the set's trim: a double rule with a fleuron in each corner and a
 * small lozenge on every side, as on a cased club set.
 */
function drawBackFrame(g: CanvasRenderingContext2D, st: TileSetStyle, w: number, h: number) {
  // The trim, lifted or deepened where it would sink into the back's own colour.
  const lb = luma(st.back);
  const t = Math.abs(luma(st.trim) - lb) < 0.22 ? mix(st.trim, lb < 0.5 ? '#ffffff' : '#000000', 0.5) : st.trim;
  let col: string | CanvasGradient = rgba(t, 0.9);
  if (st.motif === 'seal' || st.backFinish === 'wood') {
    const gold = g.createLinearGradient(0, 0, w, h);
    gold.addColorStop(0, '#8a6218');
    gold.addColorStop(0.3, '#f6dc8e');
    gold.addColorStop(0.55, '#c99a3e');
    gold.addColorStop(0.8, '#f2d482');
    gold.addColorStop(1, '#8a6218');
    col = gold;
  }
  const ink = col as unknown as string;
  // A quiet mount under the border, so it reads even over a busy pattern.
  g.save();
  g.beginPath();
  g.roundRect(6, 6, w - 12, h - 12, 18);
  g.roundRect(21, 21, w - 42, h - 42, 7);
  g.fillStyle = rgba(st.back, 0.72);
  g.fill('evenodd');
  g.restore();
  engrave(g, () => (g.beginPath(), g.roundRect(10, 10, w - 20, h - 20, 15)), ink, 2.6);
  engrave(g, () => (g.beginPath(), g.roundRect(17, 17, w - 34, h - 34, 9)), ink, 0.9);
  // Corner fleurons: three petals opening into the field, and a bead.
  const petal = (x: number, y: number, a: number, len: number, wd: number) => {
    const ex = x + Math.cos(a) * len,
      ey = y + Math.sin(a) * len;
    const nx = -Math.sin(a) * wd,
      ny = Math.cos(a) * wd;
    g.moveTo(x, y);
    g.quadraticCurveTo((x + ex) / 2 + nx, (y + ey) / 2 + ny, ex, ey);
    g.quadraticCurveTo((x + ex) / 2 - nx, (y + ey) / 2 - ny, x, y);
  };
  for (const [x, y, a] of [
    [17, 17, Math.PI / 4],
    [w - 17, 17, (Math.PI * 3) / 4],
    [17, h - 17, -Math.PI / 4],
    [w - 17, h - 17, (-Math.PI * 3) / 4],
  ] as const) {
    engrave(
      g,
      () => {
        g.beginPath();
        petal(x, y, a, 17, 4.2);
        petal(x, y, a - 0.62, 11, 2.6);
        petal(x, y, a + 0.62, 11, 2.6);
        g.moveTo(x + Math.cos(a) * 22 + 2, y + Math.sin(a) * 22);
        g.arc(x + Math.cos(a) * 22, y + Math.sin(a) * 22, 2, 0, Math.PI * 2);
      },
      ink,
      1,
      true,
    );
  }
  // A lozenge with two curls at the middle of each side.
  const lozenge = (x: number, y: number, vertical: boolean) => {
    const a = vertical ? 4 : 7,
      b = vertical ? 7 : 4;
    g.moveTo(x - a, y);
    g.lineTo(x, y - b);
    g.lineTo(x + a, y);
    g.lineTo(x, y + b);
    g.closePath();
  };
  for (const [x, y, v] of [
    [w / 2, 17, false],
    [w / 2, h - 17, false],
    [17, h / 2, true],
    [w - 17, h / 2, true],
  ] as const)
    engrave(g, () => (g.beginPath(), lozenge(x, y, v)), ink, 1, true);
}

/** Strokes a path as an engraving: a light lip below, the trim colour on top. */
function engrave(g: CanvasRenderingContext2D, draw: () => void, color: string, lw: number, fill = false) {
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.translate(1, 1.2);
  g.strokeStyle = 'rgba(255,255,255,0.18)';
  g.fillStyle = 'rgba(255,255,255,0.18)';
  g.lineWidth = lw;
  draw();
  if (fill) g.fill();
  else g.stroke();
  g.translate(-1.8, -2);
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.fillStyle = 'rgba(0,0,0,0.35)';
  draw();
  if (fill) g.fill();
  else g.stroke();
  g.translate(0.8, 0.8);
  g.strokeStyle = color;
  g.fillStyle = color;
  draw();
  if (fill) g.fill();
  else g.stroke();
  g.restore();
}

function drawMotif(g: CanvasRenderingContext2D, st: TileSetStyle, w: number, h: number) {
  const t = st.trim;
  const cx = w / 2,
    cy = h / 2;
  const r = rng(seedOf(st.id) + 99);
  switch (st.motif) {
    case 'cloud': {
      // Auspicious clouds (xiangyun): curling scrolls.
      const scroll = (x: number, y: number, s: number, flip: number) => {
        g.beginPath();
        g.arc(x, y, s, Math.PI * 0.5, Math.PI * 2.1, false);
        g.arc(x + flip * s * 0.45, y - s * 0.1, s * 0.5, 0, Math.PI * 1.6, flip < 0);
        g.moveTo(x - s * 1.6, y + s);
        g.quadraticCurveTo(x, y + s * 1.25, x + s * 1.8, y + s * 0.6);
      };
      for (const [x, y, s, f] of [
        [cx - 22, cy - 46, 20, 1],
        [cx + 26, cy + 4, 24, -1],
        [cx - 18, cy + 58, 18, 1],
      ] as const)
        engrave(g, () => scroll(x, y, s, f), rgba(t, 0.8), 3.2);
      engrave(g, () => (g.beginPath(), g.roundRect(14, 14, w - 28, h - 28, 12)), rgba(t, 0.55), 2);
      break;
    }
    case 'kintsugi': {
      // Gold-mended cracks branching across black glass.
      g.save();
      g.shadowColor = rgba(t, 0.7);
      g.shadowBlur = 6;
      g.strokeStyle = t;
      g.lineCap = 'round';
      const crack = (x: number, y: number, a: number, len: number, wd: number, depth: number) => {
        g.lineWidth = wd;
        g.beginPath();
        g.moveTo(x, y);
        for (let i = 0; i < 6; i++) {
          a += (r() - 0.5) * 0.9;
          x += Math.cos(a) * len / 6;
          y += Math.sin(a) * len / 6;
          g.lineTo(x, y);
          if (depth > 0 && r() < 0.3) {
            g.stroke();
            crack(x, y, a + (r() < 0.5 ? 0.9 : -0.9), len * 0.5, wd * 0.6, depth - 1);
            g.lineWidth = wd;
            g.beginPath();
            g.moveTo(x, y);
          }
        }
        g.stroke();
      };
      crack(0, h * 0.25, 0.4, w * 1.1, 2.6, 2);
      crack(w, h * 0.7, Math.PI + 0.3, w * 1.1, 2.2, 2);
      g.restore();
      break;
    }
    case 'shell': {
      // A scallop shell, and a scalloped border.
      engrave(
        g,
        () => {
          g.beginPath();
          g.moveTo(cx, cy + 46);
          for (let k = 0; k <= 8; k++) {
            const a = Math.PI + (k / 8) * Math.PI;
            g.moveTo(cx, cy + 46);
            g.lineTo(cx + Math.cos(a) * 58, cy + 6 + Math.sin(a) * 58);
          }
          g.moveTo(cx - 58, cy + 6);
          for (let k = 0; k < 8; k++) {
            const a0 = Math.PI + (k / 8) * Math.PI,
              a1 = Math.PI + ((k + 1) / 8) * Math.PI;
            const mx = cx + Math.cos((a0 + a1) / 2) * 66,
              my = cy + 6 + Math.sin((a0 + a1) / 2) * 66;
            g.quadraticCurveTo(mx, my, cx + Math.cos(a1) * 58, cy + 6 + Math.sin(a1) * 58);
          }
        },
        rgba(t, 0.9),
        2.4,
      );
      engrave(
        g,
        () => {
          g.beginPath();
          for (let x = 16; x < w - 16; x += 16) {
            g.moveTo(x, 16);
            g.arc(x + 8, 16, 8, Math.PI, 0, true);
            g.moveTo(x, h - 16);
            g.arc(x + 8, h - 16, 8, Math.PI, 0, false);
          }
        },
        rgba(t, 0.6),
        1.6,
      );
      break;
    }
    case 'facets': {
      // A brilliant cut seen from above.
      engrave(
        g,
        () => {
          g.beginPath();
          const pts = 8;
          for (let k = 0; k < pts; k++) {
            const a = (k / pts) * Math.PI * 2;
            const a2 = ((k + 0.5) / pts) * Math.PI * 2;
            g.moveTo(cx + Math.cos(a) * 30, cy + Math.sin(a) * 40);
            g.lineTo(cx + Math.cos(a2) * 70, cy + Math.sin(a2) * 95);
            g.lineTo(cx + Math.cos(a + (Math.PI * 2) / pts) * 30, cy + Math.sin(a + (Math.PI * 2) / pts) * 40);
            g.moveTo(cx, cy);
            g.lineTo(cx + Math.cos(a) * 30, cy + Math.sin(a) * 40);
          }
        },
        'rgba(255,255,255,0.7)',
        1.4,
      );
      break;
    }
    case 'dragon': {
      // An embossed dragon seal in a beaded ring.
      engrave(g, () => (g.beginPath(), g.arc(cx, cy, 62, 0, Math.PI * 2)), rgba(mix(t, '#3a2205', 0.4), 0.9), 3);
      engrave(g, () => (g.beginPath(), g.arc(cx, cy, 52, 0, Math.PI * 2)), rgba(mix(t, '#3a2205', 0.4), 0.9), 1.5);
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2;
        engrave(g, () => (g.beginPath(), g.arc(cx + Math.cos(a) * 57, cy + Math.sin(a) * 57, 2, 0, Math.PI * 2)), rgba(mix(t, '#3a2205', 0.4), 0.9), 1, true);
      }
      g.save();
      g.font = `400 64px ${FONTS.brush[1]}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = 'rgba(255,245,210,0.35)';
      g.fillText('龍', cx + 1.5, cy + 3.5);
      g.fillStyle = mix(t, '#3a2205', 0.55);
      g.fillText('龍', cx, cy + 2);
      g.restore();
      break;
    }
    case 'fan': {
      // Art Deco fans, top and bottom, and stepped rules.
      for (const [y, dir] of [
        [h - 26, -1],
        [26, 1],
      ]) {
        engrave(
          g,
          () => {
            g.beginPath();
            for (let k = 0; k <= 10; k++) {
              const a = (k / 10) * Math.PI;
              g.moveTo(cx, y);
              g.lineTo(cx + Math.cos(a) * 70, y + dir * Math.sin(a) * 70);
            }
            for (const rad of [30, 50, 70]) {
              g.moveTo(cx + rad, y);
              g.arc(cx, y, rad, 0, Math.PI, dir < 0);
            }
          },
          rgba(mix(t, '#ffffff', 0.4), 0.75),
          1.6,
        );
      }
      engrave(g, () => (g.beginPath(), g.moveTo(24, cy), g.lineTo(w - 24, cy), g.moveTo(40, cy - 6), g.lineTo(w - 40, cy - 6), g.moveTo(40, cy + 6), g.lineTo(w - 40, cy + 6)), rgba(mix(t, '#ffffff', 0.4), 0.7), 1.4);
      break;
    }
    case 'waves': {
      // Seigaiha: overlapping waves in white slip over the cobalt.
      g.save();
      g.strokeStyle = 'rgba(255,255,255,0.75)';
      g.lineWidth = 1.6;
      const R = 22;
      for (let row = 0; row * (R * 0.5) < h + R; row++) {
        const y = row * R * 0.5;
        const off = row % 2 ? R : 0;
        for (let x = -R + off; x < w + R; x += R * 2) {
          for (const k of [1, 0.7, 0.4]) {
            g.beginPath();
            g.arc(x, y, R * k, Math.PI, Math.PI * 2);
            g.stroke();
          }
        }
      }
      g.restore();
      break;
    }
    case 'bands':
      engrave(g, () => (g.beginPath(), g.roundRect(12, 12, w - 24, h - 24, 12)), rgba(t, 0.9), 3);
      break;
    case 'lattice': {
      // Brass inlay: a key-fret border round a diamond lattice.
      engrave(g, () => (g.beginPath(), g.rect(16, 16, w - 32, h - 32), g.rect(24, 24, w - 48, h - 48)), rgba(t, 0.85), 1.6);
      g.save();
      g.beginPath();
      g.rect(30, 30, w - 60, h - 60);
      g.clip();
      engrave(
        g,
        () => {
          g.beginPath();
          const s = 24;
          for (let d = -h; d < w + h; d += s) {
            g.moveTo(d, 0);
            g.lineTo(d + h, h);
            g.moveTo(d + h, 0);
            g.lineTo(d, h);
          }
        },
        rgba(t, 0.6),
        1.2,
      );
      g.restore();
      break;
    }
    case 'bamboo': {
      // The dovetail where the bone face was keyed into the bamboo, and a leaf spray.
      engrave(
        g,
        () => {
          g.beginPath();
          g.moveTo(cx - 34, 0);
          g.lineTo(cx - 20, 30);
          g.lineTo(cx + 20, 30);
          g.lineTo(cx + 34, 0);
        },
        rgba(t, 0.7),
        2,
      );
      engrave(
        g,
        () => {
          g.beginPath();
          for (const [a, len] of [
            [-0.5, 46],
            [-0.15, 56],
            [0.25, 48],
          ]) {
            const x0 = cx - 10,
              y0 = cy + 40;
            const x1 = x0 + Math.sin(a) * len,
              y1 = y0 - Math.cos(a) * len;
            g.moveTo(x0, y0);
            g.quadraticCurveTo((x0 + x1) / 2 + 12, (y0 + y1) / 2, x1, y1);
            g.quadraticCurveTo((x0 + x1) / 2 - 12, (y0 + y1) / 2, x0, y0);
          }
        },
        rgba(t, 0.75),
        1.8,
      );
      break;
    }
    case 'seal': {
      // JongClub's maker's seal: a gilt octagon round the sparrow 雀, the bird of the game.
      const R = 30;
      const oct = (rad: number) => {
        g.beginPath();
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
          const x = cx + Math.cos(a) * rad,
            y = cy + Math.sin(a) * rad;
          if (k) g.lineTo(x, y);
          else g.moveTo(x, y);
        }
        g.closePath();
      };
      const gold = g.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
      gold.addColorStop(0, '#8a6218');
      gold.addColorStop(0.4, '#f6dc8e');
      gold.addColorStop(0.6, '#d2a64a');
      gold.addColorStop(1, '#8a6218');
      engrave(g, () => oct(R), gold as unknown as string, 2.2);
      engrave(g, () => oct(R - 5), gold as unknown as string, 0.9);
      g.save();
      const [weight, family] = FONTS.serif;
      g.font = `${weight} 34px ${family}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.fillText('雀', cx - 0.8, cy + 1.2);
      g.fillStyle = gold;
      g.fillText('雀', cx, cy + 2);
      g.restore();
      break;
    }
    case 'medallion': {
      // A carved compass rose in a double ring.
      const col = rgba(mix(t, '#ffffff', 0.25), 0.8);
      engrave(g, () => (g.beginPath(), g.arc(cx, cy, 58, 0, Math.PI * 2), g.moveTo(cx + 48, cy), g.arc(cx, cy, 48, 0, Math.PI * 2)), col, 1.8);
      engrave(
        g,
        () => {
          g.beginPath();
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2 - Math.PI / 2;
            const L = k % 2 ? 26 : 44;
            g.moveTo(cx + Math.cos(a - 0.35) * 8, cy + Math.sin(a - 0.35) * 8);
            g.lineTo(cx + Math.cos(a) * L, cy + Math.sin(a) * L);
            g.lineTo(cx + Math.cos(a + 0.35) * 8, cy + Math.sin(a + 0.35) * 8);
          }
        },
        col,
        1.5,
      );
      break;
    }
    default:
  }
}

const finishCache = new Map<string, HTMLCanvasElement>();

/** Texture canvases for the 3D tile in the equipped set: the back slab and the body slab. */
export function tileFinishCanvas(part: 'back' | 'body'): HTMLCanvasElement {
  const key = `${style.id}:${part}`;
  let c = finishCache.get(key);
  if (!c) {
    // Backs and bodies follow the face detail: twice as fine on medium and high tiers.
    const k = detail >= 3 ? 2 : 1;
    if (part === 'back') c = paintBack(style, 192 * k, 256 * k);
    else {
      const [bc, bg] = canvas(128 * k, 128 * k);
      bg.scale(k, k);
      paintFinish(bg, 128, 128, style.bodyFinish, style.body, mix(style.body, '#000000', luma(style.body) > 0.6 ? 0.04 : 0.12), seedOf(style.id) * 7);
      c = bc;
    }
    finishCache.set(key, c);
  }
  return c;
}

// ------------------------------------------------------------ shop preview

const previewCache = new Map<string, string>();

/**
 * A portrait of a tile set for the shop: three tiles standing and one face
 * down, each drawn with the set's real faces, body layers and back.
 */
export function tileSetPreview(id: string, w = 480, h = 264): string {
  const key = `${id}:${w}x${h}`;
  const hit = previewCache.get(key);
  if (hit) return hit;
  if (picture3d) {
    let pic = '';
    try {
      pic = picture3d(id, w, h);
    } catch (e) {
      console.warn('tile picture', e);
      pic = '';
    }
    if (pic) {
      previewCache.set(key, pic);
      return pic;
    }
  }
  const url = withTileSet(id, () => {
    const st = style;
    const [c, g] = canvas(w, h);
    // Stage: the set's own back colour, falling to black, with a spotlight.
    if (st.stage === 'suede') suedeStage(g, w, h);
    else {
      const bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, mix(st.back, '#0b0d0c', 0.55));
      bg.addColorStop(1, mix(st.back, '#050606', 0.85));
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
    }
    const sp = g.createRadialGradient(w / 2, h * 0.35, 10, w / 2, h * 0.35, w * 0.6);
    sp.addColorStop(0, 'rgba(255,240,215,0.22)');
    sp.addColorStop(1, 'rgba(255,240,215,0)');
    g.fillStyle = sp;
    g.fillRect(0, 0, w, h);
    const back = paintBack(st, 192, 256);
    const [bc, bgc] = canvas(64, 64);
    paintFinish(bgc, 64, 64, st.bodyFinish, st.body, mix(st.body, '#000000', 0.15), 3);
    const tw = h * 0.36,
      th = tw * (FACE_H / FACE_W);
    const kinds = [31, 18, 9];
    const gap = tw * 0.16;
    const total = tw * 4 + gap * 3;
    const x0 = (w - total) / 2,
      y0 = h * 0.14;
    // Floor reflection line.
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath();
    g.ellipse(w / 2, y0 + th + tw * 0.32, total * 0.56, tw * 0.16, 0, 0, Math.PI * 2);
    g.fill();
    for (let i = 0; i < 4; i++) {
      const x = x0 + i * (tw + gap);
      const face = i === 0 ? back : renderFace(kinds[i - 1], false, false).face;
      tile2d(g, x, y0 + (i === 0 ? tw * 0.05 : 0), tw, th, face, bc, back, st);
    }
    return c.toDataURL('image/png');
  });
  previewCache.set(key, url);
  return url;
}

/** The lining of a luxury case: forest-green suede, a stitched seam and a tan leather pull. */
function suedeStage(g: CanvasRenderingContext2D, w: number, h: number) {
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#1f5a44');
  bg.addColorStop(1, '#0c2c21');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  const r = rng(41);
  for (let i = 0; i < w * h * 0.04; i++) {
    g.fillStyle = r() < 0.5 ? `rgba(255,255,255,${r() * 0.05})` : `rgba(0,0,0,${r() * 0.08})`;
    g.fillRect(r() * w, r() * h, 1, 1);
  }
  // Stitched seam along the bottom compartment, and the leather tab.
  const sy = h * 0.86;
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(0, sy, w, 2);
  g.fillStyle = '#d8b06a';
  for (let x = 8; x < w; x += 14) g.fillRect(x, sy - 6, 6, 1.6);
  const tg = g.createLinearGradient(0, sy, 0, h);
  tg.addColorStop(0, '#e2b98a');
  tg.addColorStop(1, '#b98a5a');
  g.fillStyle = tg;
  g.beginPath();
  g.ellipse(w * 0.82, h + 8, w * 0.07, h * 0.16, 0, Math.PI, 0);
  g.fill();
}

/** One tile seen from slightly above: the face, then its body and back layers beneath. */
function tile2d(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, face: HTMLCanvasElement, body: HTMLCanvasElement, back: HTMLCanvasElement, st: TileSetStyle) {
  const depth = w * 0.3;
  const rad = w * 0.12;
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.55)';
  g.shadowBlur = w * 0.2;
  g.shadowOffsetY = w * 0.08;
  // Back slab (bottom layer).
  g.fillStyle = g.createPattern(back, 'repeat')!;
  g.beginPath();
  g.roundRect(x, y + depth, w, h, rad);
  g.fill();
  g.restore();
  g.save();
  g.fillStyle = mix(st.back, '#000000', 0.25);
  g.globalAlpha = 0.35;
  g.beginPath();
  g.roundRect(x, y + depth, w, h, rad);
  g.fill();
  g.restore();
  // Body slab.
  g.save();
  g.fillStyle = g.createPattern(body, 'repeat')!;
  g.beginPath();
  g.roundRect(x, y + depth * 0.5, w, h, rad);
  g.fill();
  if (st.stripes) {
    // Layered resin: one band per layer across the visible edge, back side lowest.
    const n = st.stripes.length;
    g.save();
    g.clip();
    for (let i = 0; i < n; i++) {
      g.fillStyle = st.stripes[n - 1 - i];
      g.fillRect(x, y + h - rad + ((depth * 0.5 + rad) * i) / n, w, (depth * 0.5 + rad) / n + 0.5);
    }
    g.restore();
  }
  const shade = g.createLinearGradient(0, y + h, 0, y + h + depth * 0.5);
  shade.addColorStop(0, 'rgba(0,0,0,0.05)');
  shade.addColorStop(1, 'rgba(0,0,0,0.3)');
  g.fillStyle = shade;
  g.fill();
  g.restore();
  // Face.
  g.save();
  g.beginPath();
  g.roundRect(x, y, w, h, rad);
  g.clip();
  g.drawImage(face, x, y, w, h);
  const hl = g.createLinearGradient(x, y, x + w, y + h);
  hl.addColorStop(0, `rgba(255,255,255,${0.1 + st.gloss * 0.2})`);
  hl.addColorStop(0.4, 'rgba(255,255,255,0)');
  g.fillStyle = hl;
  g.fillRect(x, y, w, h);
  g.restore();
  g.save();
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = 1;
  g.beginPath();
  g.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, rad);
  g.stroke();
  g.restore();
}

// ------------------------------------------------------------ 2D images and caches

const urlCache = new Map<string, string>();
/** Data URL for 2D UI use, in the equipped tile set. */
export function faceUrl(kind: number, labels = true, red = false): string {
  const key = `${TILE_SET.id}:${kind}:${labels}:${red ? 'r' : ''}`;
  let u = urlCache.get(key);
  if (!u) {
    u = drawFace(kind, labels, red, UI_FACE_SCALE).toDataURL('image/png');
    urlCache.set(key, u);
  }
  return u;
}

/**
 * Draw the 2D face images (the latest-discard card, hand tray, seat rivers) for every playable kind
 * ahead of time, one per idle moment. Each is a full PNG encode, tens of milliseconds on a phone, and
 * otherwise lands on the first discard of each kind, mid-animation.
 */
export function warmFaceUrls(labels: boolean, kinds = 34) {
  type Deadline = { timeRemaining(): number };
  const ric = (window as Window & { requestIdleCallback?: (cb: (d: Deadline) => void, o?: { timeout: number }) => number }).requestIdleCallback;
  const later = (f: (d?: Deadline) => void) => (ric ? ric(f, { timeout: 500 }) : window.setTimeout(f, 120));
  const n = Math.min(kinds, KIND_COUNT);
  let k = 0;
  const step = (d?: Deadline) => {
    // One face per slice, more while the browser says it has idle time to spare.
    do faceUrl(k++, labels);
    while (k < n && d && d.timeRemaining() > 30);
    if (k < n) later(step);
  };
  later(step);
}

export function clearFaceCache() {
  cache.clear();
  surfaceCache.clear();
  reliefCache.clear();
  foilCache.clear();
  urlCache.clear();
  finishCache.clear();
}

export async function loadTileFonts() {
  try {
    // The brush, Song and sans calligraphy of the premium sets, subset to the glyphs tiles use.
    const text = encodeURIComponent(GLYPHS);
    const href = `https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&family=ZCOOL+XiaoWei&family=Noto+Sans+SC:wght@900&family=Noto+Serif+SC:wght@700&text=${text}&display=swap`;
    const sheet = new Promise<void>((resolve) => {
      if (document.querySelector('link[data-tile-fonts]')) return resolve();
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.dataset.tileFonts = '';
      link.onload = link.onerror = () => resolve();
      document.head.append(link);
    });
    await Promise.race([
      sheet.then(() => Promise.all([
        document.fonts.load(`700 100px "Noto Serif SC"`, GLYPHS),
        document.fonts.load(`400 100px "Ma Shan Zheng"`, GLYPHS),
        document.fonts.load(`400 100px "ZCOOL XiaoWei"`, GLYPHS),
        document.fonts.load(`900 100px "Noto Sans SC"`, GLYPHS),
        document.fonts.load('700 30px Manrope'),
      ])),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
  } catch {
    /* fall back to system fonts */
  }
}

export const ALL_KINDS = Array.from({ length: KIND_COUNT }, (_, k) => k);
