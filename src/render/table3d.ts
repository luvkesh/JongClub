// The 3D table: scene, tiles, layout-from-state and tweened animation.
// The renderer derives every tile's pose from GameState, so any engine
// change animates naturally (draws slide, discards arc, calls regroup).

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { GameState } from '../engine/state';
import { TILE_ID_COUNT, kindOfTileId, WINDS, compareTiles, type HandSort, type Tile, type Wind } from '../engine/tiles';
import { feltMotif, feltWeave, paintFeltPattern } from './feltPattern';
import { TILE_SET, drawFace, faceDetail, faceUrl, luma, mix, setFaceDetail, setTileSet as setFaceSet, warmFaceUrls } from './tileFaces';
import { handTileScale, reduceMotionSetting } from './tileAccess';
import { environmentStyle, tableStyle, type AvatarSpec, type EnvironmentStyle } from '../cosmetics/catalog';
import { SeatFigure } from './avatar3d';
import { Backdrop } from './backdrop';
import { applyTileFinish, clearFaceSurfaces, dressFace, setTileLight } from './tileMaterials';
import { Effects } from './fx';
import { Room, clubEnvironment } from './room';
import { SignatureShot, signatureDuration } from './cinematic';
import { FrameGovernor, detectQuality, gpuLostRecently, type GovernorStep, qualitySpec, tierFaceDetail, type QualitySpec, type QualityTier } from './quality';
import { arrangeHand, moveTile, type HandLayout, type HandSlot } from '../ui/handOrder';
import { hideTip, showTile } from '../ui/tooltip';
import { devAnimScale, devRevealAll } from '../dev/devMode';
import { quadrantOf } from './seatLayout';
import { SideTables, START_UNITS, purseUnits } from './sideTables';
import { ShuffleMachine } from './machine';
import { WallMarkers } from './wallMarkers';
import { HAND_LEAN, HAND_RAISE, MY_LEDGE, MY_LEDGE_NORMAL, OPP_RACK, Racks, SHELF_NORMAL, myLedgeHeight, shelfHeight } from './racks';
import './tilePicture';
import { BOARD_NEAR, BOARD_SCALE, DiscardMarks, SPOT_BELOW, SPOT_SCALE, SPOT_X, boardPos, boardSlot, discardLayoutFor, type DiscardLayout, type DiscardSetting } from './discardMarks';

export const TW = 0.3;
export const TH = 0.4;
export const TD = 0.22;

export type AnimSpeed = 'minimal' | 'classic' | 'cinematic';
const SPEED: Record<AnimSpeed, number> = { minimal: 0.12, classic: 0.3, cinematic: 0.55 };

type Loc = 'wall' | 'hand' | 'meld' | 'discard' | 'scatter' | 'hidden';

interface Pose {
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  scale: number;
}

interface Tween {
  /** Null: from wherever the tile is when this leg starts. */
  from: Pose | null;
  to: Pose;
  t0: number;
  dur: number;
  arc: number;
  /** The next leg, run when this one ends (the shuffling machine's gather, sink and rise). */
  next?: Tween;
}

interface TileObj {
  id: number;
  kind: number;
  group: THREE.Group;
  faceMat: THREE.MeshStandardMaterial;
  bodyMat: THREE.MeshPhysicalMaterial;
  /** Showing the red (aka) five face. */
  red: boolean;
  loc: Loc;
  /** Face up where the player can see it, so hovering it names the tile. */
  tipOk: boolean;
  target?: Pose;
  tween?: Tween;
}

export interface LayoutOptions {
  /** Seats whose hands are shown face up. */
  reveal?: number[];
  winner?: number;
  /** Deal animation: stagger tiles by draw order. */
  dealing?: boolean;
  /** Seat whose turn it is, for the compass. */
  turnSeat?: number;
  /** The winner's revealed hand rises and leans toward its player (the win moment). */
  winLift?: boolean;
  /** The winner's concealed tiles as the sets they make (tile ids), laid out with a gap between sets (ui/winReveal.ts). */
  winSets?: number[][];
  /** The winning tile, marked brighter than the rest of the winning hand. */
  winTileId?: number;
}

/** The player's own adjustment of the seat camera. */
export interface TableView {
  /** 1 is the default framing; larger is closer. */
  zoom: number;
  /** -1 (lower, more perspective) .. 1 (more top-down); 0 is the default. */
  tilt: number;
  /** Small orbit around the table in degrees, clamped to ±YAW_MAX. */
  yaw: number;
  /** Sideways shift: -1 .. 1, where 1 moves the view right by PAN_SHARE of its width. */
  pan: number;
}

export const ZOOM_MIN = 0.72;
export const ZOOM_MAX = 2.4;
export const TILT_MIN = -1;
export const TILT_MAX = 1;
export const YAW_MAX = 25;
/** Split view switches on by itself where the whole-table view would make your tiles narrower than this (CSS px). */
/** How much taller the hand strip gets while your ledge holds sets (0.78 / 0.56 of the view it needs). */
const LEDGE_STRIP = 1.4;
const SPLIT_BELOW_PX = 44;
export type SplitPref = 'auto' | 'on' | 'off';
const SPLIT_KEY = 'jongclub.split.v1';
function loadSplitPref(): SplitPref {
  try {
    const v = localStorage.getItem(SPLIT_KEY);
    if (v === 'on' || v === 'off' || v === 'auto') return v;
  } catch {
    /* storage unavailable */
  }
  return 'auto';
}
/** How far the view can slide left or right, as a share of the view's width. */
export const PAN_SHARE = 0.1;
/** The free camera after a hand: the point it circles, how far round (theta) and down from overhead (phi), and how far away. */
interface FreePose {
  target: THREE.Vector3;
  theta: number;
  phi: number;
  dist: number;
}
const FREE_LOOK_Y = 0.4;
const FREE_PHI_MIN = 0.08;
const FREE_PHI_MAX = 1.36;
const FREE_DIST_MIN = 2.4;
const FREE_DIST_MAX = 15;
/** How far from the centre the point the free camera circles may wander (world units). */
const FREE_REACH = 6.5;
/** Keys that steer the free camera: [forward, right, turn, zoom]. Arrows move like WASD. */
const FREE_KEYS: Record<string, [number, number, number, number]> = {
  KeyW: [1, 0, 0, 0],
  ArrowUp: [1, 0, 0, 0],
  KeyS: [-1, 0, 0, 0],
  ArrowDown: [-1, 0, 0, 0],
  KeyA: [0, -1, 0, 0],
  ArrowLeft: [0, -1, 0, 0],
  KeyD: [0, 1, 0, 0],
  ArrowRight: [0, 1, 0, 0],
  KeyQ: [0, 0, 1, 0],
  KeyE: [0, 0, -1, 0],
  Equal: [0, 0, 0, 1],
  NumpadAdd: [0, 0, 0, 1],
  Minus: [0, 0, 0, -1],
  NumpadSubtract: [0, 0, 0, -1],
};
const VIEW_KEY = 'jongclub.view.v1';
const DEFAULT_VIEW: TableView = { zoom: 1, tilt: 0, yaw: 0, pan: 0 };
const clampView = (v: Partial<TableView>): TableView => ({
  zoom: THREE.MathUtils.clamp(Number.isFinite(v.zoom) ? v.zoom! : 1, ZOOM_MIN, ZOOM_MAX),
  tilt: THREE.MathUtils.clamp(Number.isFinite(v.tilt) ? v.tilt! : 0, TILT_MIN, TILT_MAX),
  yaw: THREE.MathUtils.clamp(Number.isFinite(v.yaw) ? v.yaw! : 0, -YAW_MAX, YAW_MAX),
  pan: THREE.MathUtils.clamp(Number.isFinite(v.pan) ? v.pan! : 0, -1, 1),
});

function loadView(): TableView {
  try {
    const raw = localStorage.getItem(VIEW_KEY);
    // Turning is no longer a gesture, so an old saved turn would be stuck: start square to the table.
    if (raw) return clampView({ ...(JSON.parse(raw) as Partial<TableView>), yaw: 0 });
  } catch {
    /* storage unavailable */
  }
  return { ...DEFAULT_VIEW };
}

/** Rack tiles: scale and distance from the centre. */
const HAND_SCALE = 1.32;
const HAND_Z = 3.98;
/** Discards: largest scale, and the half-size of the square around the compass where the rivers start. */
const DISCARD_SCALE = 1.5;
/** Half the width a portrait phone frames: the rivers at their longest, and the closest it comes while they are short. */
const RIVERS_FULL = 2.82;
const RIVERS_CLOSE = 1.95;
/** Half the width a portrait phone frames through the opening: the walls and their marks. */
const OPENING_REACH = 3.75;
const RIVER_NEAR = 0.78;
/** Walls sit this far out (at least), leaving the rivers room to be large. */
const WALL_Z = 2.86;
/** The marked section at the back of a broken wall (flower wall, dead wall) steps in this far. */
const SEG_IN = 0.14;
/** Rivers must end before the inner edge of the walls. */
const RIVER_LIMIT = WALL_Z - TH / 2 - 0.04;
/** With your hand in the 2D tray (short screens), your melds and flowers lie on the felt just outside the wall. */
const MELD_Z = 3.34;
/** Your called sets are a little larger than the wall's tiles. */
const MY_MELD_SCALE = 1.1;
/** Opponents' called sets on their rack shelves: as large as this, smaller only when many must fit. */
const OPP_MELD_SCALE = 1.22;
/** Faces glow faintly from within so they stay bright under the low club light. */
const FACE_GLOW = 0.26;
/** Extra inner light on discarded faces (they lie flat, away from the lamp's best angle). */
const DISCARD_FACE_LIFT = 0.1;
/** The flat face pictures laid over the 3D faces (updateRiver2d) are drawn at this size, then mapped onto each face. */
const FACE_PX_W = 60;
const FACE_PX_H = 80;

/**
 * A CSS matrix3d that maps a w x h box onto the quad p (x0,y0 .. x3,y3: top left, top right, bottom right,
 * bottom left), perspective included (Heckbert's square-to-quad mapping).
 */
function quadMatrix(p: number[], w: number, h: number): string {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = p;
  const dx1 = x1 - x2,
    dx2 = x3 - x2,
    dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2,
    dy2 = y3 - y2,
    dy3 = y0 - y1 + y2 - y3;
  let g = 0,
    k = 0;
  if (Math.abs(dx3) > 1e-6 || Math.abs(dy3) > 1e-6) {
    const det = dx1 * dy2 - dx2 * dy1 || 1e-6;
    g = (dx3 * dy2 - dx2 * dy3) / det;
    k = (dx1 * dy3 - dx3 * dy1) / det;
  }
  const a = x1 - x0 + g * x1,
    b = x3 - x0 + k * x3,
    d = y1 - y0 + g * y1,
    e = y3 - y0 + k * y3;
  const m = [a / w, d / w, 0, g / w, b / h, e / h, 0, k / h, 0, 0, 1, 0, x0, y0, 0, 1];
  return `matrix3d(${m.map((v) => +v.toFixed(6)).join(',')})`;
}

/** Seconds after the deal starts that dealt flowers leave the rack for the ledge (the deal itself runs about 2.3 s). */
const FLOWER_ASIDE_AT = 2.9;
/** Pointer travel (px) before a press on a hand tile becomes a drag. */
const DRAG_PX = 8;

/**
 * How a river of `n` discards fits between the compass and the wall: tiles per
 * row and scale. Front and back rivers start at six a row, side rivers at five,
 * and a long river first lengthens its rows (up to two more) before it adds a
 * row, whichever keeps its tiles larger. Rows never reach past RIVER_LIMIT, in
 * either direction, so the four rivers of the pinwheel never touch.
 */
export function riverFit(n: number, side: boolean, along = side ? TH : TW, across = side ? TW : TH, near = RIVER_NEAR): { perRow: number; rows: number; ds: number } {
  const base = side ? 5 : 6;
  const minRows = side ? 4 : 3;
  let best = { perRow: base, rows: minRows, ds: 0 };
  for (let perRow = base; perRow <= base + 2; perRow++) {
    const rows = Math.max(minRows, Math.ceil(n / perRow));
    const ds = Math.min(DISCARD_SCALE, ((RIVER_LIMIT - near) / rows - 0.016) / across, ((RIVER_LIMIT + near) / perRow - 0.014) / along);
    // Prefer the familiar row length unless a longer row is clearly larger.
    if (ds > best.ds + 0.02) best = { perRow, rows, ds };
  }
  return best;
}

/** The table's governor ladder: shadow refresh, then ambient effects; never resolution. */
const TABLE_GOVERNOR_STEPS: GovernorStep[] = [
  { scale: 1, staticShadows: false, effects: true },
  { scale: 1, staticShadows: true, effects: true },
  { scale: 1, staticShadows: true, effects: false },
];

/** Most drawing-buffer pixels per frame, by tier (high about 3840 x 2200); see resize(). */
// With 4x antialiasing each drawing-buffer pixel costs about 36 bytes of graphics memory, so phone and
// tablet tiers stay near 160 MB for the buffer (about 4.4M px), leaving room for faces and the room.
const MAX_PIXELS = { high: 8_500_000, medium: 4_400_000, low: 3_800_000 } as const;
/** While the page itself is pinch-zoomed, the canvas is drawn denser up to this many pixels. */
const ZOOM_PIXELS = { high: 8_000_000, medium: 5_000_000, low: 4_000_000 } as const;
/** Set after the browser once dropped our graphics context for memory: later visits draw leaner. */
const GPU_LOST_KEY = 'jongclub.gpuLost';
/** Face detail for the kinds in the player's own hand, which the camera shows closest. */
const HAND_DETAIL = { high: 6, medium: 4.5, low: 3.25 } as const;
/** How many hand-detail faces may be kept at once before older ones are scaled back down. */
const HAND_DETAIL_KEEP = 14;
const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const qFromEuler = (x: number, y: number, z: number) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'YXZ'));

export class TableRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private tiles = new Map<number, TileObj>();
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2(-9, -9);
  private compass!: { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture };
  private machine!: ShuffleMachine;
  private marker!: THREE.Mesh;
  /** A soft gold frame under the latest discard. */
  private lastRing!: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private camFrom = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  private camTo = { pos: new THREE.Vector3(0, 6, 8), look: new THREE.Vector3(0, 0, 0.8) };
  private camLook = new THREE.Vector3(0, 0, 0.8);
  private camT = 1;
  private camDur = 1;
  private camStart = 0;
  private view: 'orbit' | 'seat' | 'focus' = 'orbit';
  private focusTarget = new THREE.Vector3();
  private lastState?: GameState;
  private lastOpts: LayoutOptions = {};
  private scatterTimer = 0;
  private lastFrame = 0;
  // Frame pacing (see frame()): when the last frame was drawn, and full rate is kept until this time.
  private lastRender = 0;
  private activeUntil = 0;
  /** Pointer hover keeps the frame rate up until then, but is not motion: it never lowers sharpness. */
  private hoverUntil = 0;
  /** Tiles whose current slide is only a hover lift (cleared by the next full layout). */
  private hoverTweens = new Set<number>();
  private shadowTick = 0;
  /** The pixel ratio we aim for before the pixel budget; lowered for good if frames run long. */
  private prMax = 1;
  /** Low on graphics memory (a lost context before, or a device reporting 4 GB or less): no extra detail. */
  private memTight = false;
  private lastDiscardId = -1;
  private faceTex = new Map<string, THREE.CanvasTexture>();
  private feltMat!: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
  private feltColor = '';
  private feltMotif = '';
  private sticks: THREE.Group[] = [];
  private racks!: Racks;
  // Cosmetics: tile set, table, environment, effects, avatars.
  private backMat!: THREE.MeshPhysicalMaterial;
  private rimMat!: THREE.MeshPhysicalMaterial;
  /** The inlay line along the rim and the trim on the apron: brass, or dark lacquer on a gilded rim. */
  private trimMat!: THREE.MeshStandardMaterial;
  private hemi!: THREE.HemisphereLight;
  private keyLight!: THREE.SpotLight;
  private fillLight!: THREE.DirectionalLight;
  private rimLight!: THREE.DirectionalLight;
  private backdrop: Backdrop;
  private room: Room;
  private q: QualitySpec;
  /** Steps resolution, shadow refresh and ambient effects down (and back up) to hold 60 fps. */
  readonly governor: FrameGovernor;
  private fx: Effects;
  private envId = '';
  private tableId = '';
  private figures: (SeatFigure | null)[] = [null, null, null, null];
  /** Whose turn it is (from the compass), so the others can glance their way. */
  private turnSeat = -1;
  private avatarKeys: string[] = ['', '', '', ''];
  private pointScale = 400;

  // The player's view adjustment: target and eased current value.
  private viewT: TableView = loadView();
  private viewC: TableView = { ...this.viewT };
  /** 1 while the seat view (where adjustments apply) is active, eased. */
  private viewW = 0;
  private viewSaveTimer = 0;
  /** The camera pose before the player's adjustment. */
  private camBase = new THREE.Vector3(0, 7, 11);
  private compassKey = '';
  // Pointer gestures on the canvas.
  private ptrs = new Map<number, { x: number; y: number }>();
  private gesture:
    | null
    | { kind: 'press'; id: number | null; pointerId: number; x: number; y: number; touch: boolean }
    | { kind: 'drag'; id: number; pointerId: number }
    | { kind: 'look'; pointerId: number; x: number; y: number; tilt: number; pan: number; moved: boolean }
    | { kind: 'pinch'; d: number; mx: number; my: number; zoom: number; tilt: number; pan: number }
    | { kind: 'free'; pointerId: number; x: number; y: number; slide: boolean; from: FreePose | null }
    | { kind: 'freePinch'; d: number; mx: number; my: number; from: FreePose } = null;
  private suppressClick = false;
  private longPress = 0;
  /** Your hand as last laid out, and each slot's resting x. */
  private handSlots: HandSlot[] = [];
  private handXs: number[] = [];
  private dragX = 0;
  private dragIndex = -1;
  // Tile name plaques.
  private tipId: number | null = null;
  private tipShown = false;
  private tipTimer = 0;
  private tipHide = 0;
  /** Marks your freshly drawn tile. */
  private drawnPip!: THREE.Mesh;
  private drawnPipId = -1;

  humanSeat = 0;
  /** Watching a live table: the seat in front of the camera keeps its tiles concealed like everyone else's. */
  watchOnly = false;
  /** Opponents' flowers and seasons lie face down until Mahjong or their third exposed set (India Rules West round). */
  flowersHidden = false;
  /** Seats at the table: 4, or 3 (Korean), where the seat across from you stays empty. */
  seatCount = 4;
  /** The player's discard layout setting, and the variation's own layout (used when the setting is 'auto'). */
  discardSetting: DiscardSetting = 'auto';
  discardDefault: DiscardLayout = 'rows';
  get discardLayout(): DiscardLayout {
    return discardLayoutFor(this.discardSetting, this.discardDefault);
  }
  private marks!: DiscardMarks;
  private wallMarks!: WallMarkers;
  /** Screen quadrant a seat sits in (0 you, 1 right, 2 across, 3 left); see seatLayout.ts. */
  private quad(seat: number) {
    return quadrantOf(seat, this.humanSeat, this.seatCount);
  }
  /** How your own hand is laid out (sort, your own order, set grouping). */
  handLayout: HandLayout = { mode: 'suit', custom: null, groupSets: false };
  /** How your own hand is sorted (kept for older callers; mirrors handLayout.mode). */
  get sortMode(): HandSort {
    return this.handLayout.mode;
  }
  set sortMode(m: HandSort) {
    this.handLayout.mode = m;
  }
  /** Called after you drag a tile in your hand to a new place, with the new order of tile ids. */
  onReorder?: (ids: number[]) => void;
  /** Called whenever the player's view (zoom, tilt, yaw) changes. */
  onViewChange?: (view: TableView) => void;
  private viewListeners = new Set<(view: TableView) => void>();
  /** Listen for view changes alongside onViewChange; returns an unsubscribe function. */
  addViewListener(fn: (view: TableView) => void) {
    this.viewListeners.add(fn);
    return () => void this.viewListeners.delete(fn);
  }
  /** Hears where the top of your 3D rack is on screen (client px), or null when your hand is in the 2D tray. */
  private handTopListeners = new Set<(top: number | null) => void>();
  private handTop: number | null = null;
  private handTopAt = 0;
  /** Your revealed sets on your rack's ledge: the hand labels stay above them too. */
  private ledgeIds: number[] = [];
  addHandTopListener(fn: (top: number | null) => void) {
    this.handTopListeners.add(fn);
    fn(this.handTop);
    return () => void this.handTopListeners.delete(fn);
  }
  compact = false;
  /** Landscape phones: too short for the 3D rack, so your hand lives in the 2D tray there too (as on portrait phones). */
  short = false;
  /** Your hand is shown in the 2D tray (portrait phones and landscape phones), not on the 3D rack. */
  get tray() {
    return this.compact || this.short;
  }
  speed: AnimSpeed = 'classic';
  labels = true;
  hoverId: number | null = null;
  selectedId: number | null = null;
  /** Several lifted tiles at once (Charleston picks). */
  selectedIds = new Set<number>();
  hintKind: number | null = null;
  /** India Rules passport rounds: your tiles in the passport you set aside (a gold edge), and kinds that
   *  could feed a passport another player is showing (a red edge). */
  ppIds = new Set<number>();
  riskKinds = new Set<number>();
  /** Tiles in your hand matching the latest discard (a soft cue for claims). */
  matchKind: number | null = null;
  /** Extra line under a hovered tile's name plaque (e.g. how many are still unseen). */
  tipNote?: (id: number, kind: number) => string | undefined;
  interactive = new Set<number>();
  onTileClick?: (id: number) => void;
  onHover?: (id: number | null) => void;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.q = qualitySpec(detectQuality(this.renderer.getContext()));
    setFaceDetail(tierFaceDetail(this.q));
    // Draw at the screen's own density (up to 3x) so tiles stay crisp on phones and tablets; the pixel
    // budget in resize() and the frame governor step it down only if the device can't keep up.
    const smallScreen = window.innerWidth * window.innerHeight < 450_000;
    this.prMax = Math.min(window.devicePixelRatio, this.q.tier === 'low' && !smallScreen ? 1.5 : 3);
    this.renderer.setPixelRatio(this.prMax);
    this.renderer.shadowMap.enabled = true;
    // The shadow map is redrawn only when something that casts a shadow moves (frame()).
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.type = this.q.shadowType;
    // Neutral tone mapping keeps ivory faces white and ink colours true, unlike ACES's yellow shoulder.
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.river2d = document.createElement('div');
    this.river2d.className = 'river-2d';
    this.river2d.hidden = true;
    container.appendChild(this.river2d);
    // Hold 60 fps: shed pixels first, then shadow refresh, then ambient effects, and take them back when there is room.
    // The table never lowers its resolution, not even mid-move: tiles stay crisp through every discard
    // (a dip while tiles slide read as a bug). Slow devices give up shadow refresh and ambient effects instead.
    this.governor = new FrameGovernor(() => this.applyDensity(), TABLE_GOVERNOR_STEPS);

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    this.camera.position.set(0, 7, 11);

    this.scene.environment = clubEnvironment(this.renderer);
    this.scene.environmentIntensity = 0.55;
    this.scene.background = new THREE.Color('#0b0f0d');
    this.scene.fog = new THREE.Fog('#0b0f0d', 16, 34);

    this.fx = new Effects(this.scene);
    this.backdrop = new Backdrop(this.q.paint);
    this.room = new Room(this.q);
    this.scene.add(this.room.group);
    this.buildLights();
    this.buildTable();
    this.buildTiles();
    this.buildCompass();
    this.scene.add(this.backdrop.group);
    this.setEnvironment('private-club');
    this.setTileSet(TILE_SET.id);
    // Compile shaders and upload tile faces once the first screen is up, not on the first discard that needs them.
    window.setTimeout(() => this.prewarm(), 0);
    // The HUD's 2D face images too, while the player is still on the club screens.
    window.setTimeout(() => warmFaceUrls(this.labels), 2500);

    const el = this.renderer.domElement;
    // Pinch, two-finger tilt and hand dragging are handled here, not by the browser.
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', (e) => this.onDown(e));
    el.addEventListener('pointermove', (e) => this.onMove(e));
    el.addEventListener('pointerup', (e) => this.onUp(e));
    el.addEventListener('pointercancel', (e) => this.onUp(e, true));
    el.addEventListener('pointerleave', (e) => {
      if (this.gesture && this.gesture.kind !== 'press') return;
      if (e.pointerType === 'touch') return;
      this.pointer.set(-9, -9);
      this.setHover(null);
      this.clearTip();
    });
    el.addEventListener('click', (e) => {
      if (this.suppressClick) {
        this.suppressClick = false;
        return;
      }
      this.onPointer(e);
      const id = this.pick();
      if (id !== null) this.onTileClick?.(id);
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    window.addEventListener('keydown', (e) => this.onFreeKey(e, true));
    window.addEventListener('keyup', (e) => this.onFreeKey(e, false));
    window.addEventListener('blur', () => this.freeKeys.clear());
    // Hover, drags and pinches change the picture: draw at full rate while the pointer is busy.
    // Moving the pointer only highlights: draw smoothly, but don't count it as motion (resolution and
    // face sharpening only give way to real tile and camera movement).
    el.addEventListener('pointermove', () => this.hoverWake(500), { passive: true });
    for (const ev of ['pointerdown', 'wheel'] as const) el.addEventListener(ev, () => this.wake(500), { passive: true });
    window.addEventListener('resize', () => this.resize());
    try {
      const devMem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
      this.memTight = devMem <= 4 || gpuLostRecently();
    } catch {
      /* storage unavailable */
    }
    // If the browser drops the graphics context (out of memory), remember it, let three.js restore it,
    // and come back leaner: smaller drawing buffer and no extra-detail faces.
    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.memTight = true;
      try {
        localStorage.setItem(GPU_LOST_KEY, String(Date.now()));
      } catch {
        /* storage unavailable */
      }
    });
    this.renderer.domElement.addEventListener('webglcontextrestored', () => {
      this.trimHandFaces(new Set(), faceDetail(), 0);
      this.resize();
      this.wake(500);
    });
    // A page pinch-zoom fires many events: redraw at the new density once the fingers settle.
    let zoomTimer = 0;
    window.visualViewport?.addEventListener('resize', () => {
      window.clearTimeout(zoomTimer);
      zoomTimer = window.setTimeout(() => this.resize(), 250);
    });
    this.resize();
    // The landing table starts with its walls built; the machine reshuffles them now and then.
    const now0 = this.clock.getElapsedTime();
    [...this.tiles.values()].forEach((t) => {
      const pose = t.id < 136 ? this.wallPose(t.id, 0) : { pos: new THREE.Vector3(0, -1, 0), quat: new THREE.Quaternion(), scale: 0.001 };
      this.moveTo(t, pose, t.id < 136 ? 'wall' : 'hidden', now0, 0.01, 0);
      t.group.position.copy(pose.pos);
      t.group.quaternion.copy(pose.quat);
      t.group.scale.setScalar(pose.scale);
      t.group.visible = t.id < 136;
      t.tween = undefined;
    });
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ------------------------------------------------------------ scene build

  private buildLights() {
    const hemi = new THREE.HemisphereLight('#f4e6cc', '#0d1612', 0.3);
    this.scene.add(hemi);
    this.hemi = hemi;
    // The pendant's light: a warm pool on the felt that falls off past the rim.
    const key = new THREE.SpotLight('#ffe2b8', 150, 30, 0.62, 0.75, 1.6);
    this.keyLight = key;
    key.position.set(0.9, 10.5, 2.6);
    key.target.position.set(0, 0, 0.3);
    key.castShadow = true;
    key.shadow.mapSize.set(this.q.shadowMap, this.q.shadowMap);
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.01;
    key.shadow.radius = 5;
    key.shadow.camera.near = 4;
    key.shadow.camera.far = 20;
    this.scene.add(key, key.target);
    // A soft fill from the player's side so the rack faces (tilted toward you) stay bright.
    const fill = new THREE.DirectionalLight('#fff4e4', 0.75);
    fill.position.set(0, 4, 10);
    this.scene.add(fill);
    this.fillLight = fill;
    const rim = new THREE.DirectionalLight('#9fc7ff', 0.35);
    rim.position.set(-6, 4, -6);
    // Every light costs every lit pixel; the coloured rim is a high-tier nicety.
    if (this.q.tier === 'high') this.scene.add(rim);
    this.rimLight = rim;
    // The win moment's gold sweep (dark until then); low-tier devices get the particles only.
    if (this.q.tier !== 'low') {
      this.winGlow = new THREE.PointLight('#ffd58a', 0, 3.2, 1.6);
      this.winGlow.position.set(0, -5, 0);
      this.scene.add(this.winGlow);
    }
  }

  private buildTable() {
    // Lacquered table: a deep base, a raised rim with a brass inlay, an apron and a turned pedestal.
    const wood = new THREE.MeshPhysicalMaterial({ color: '#3b2416', roughness: 0.42, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.2 });
    this.rimMat = wood;
    const brass = this.room.brass;
    this.trimMat = new THREE.MeshStandardMaterial({ color: '#c9a46a', metalness: 1, roughness: 0.3 });
    const base = new THREE.Mesh(new RoundedBoxGeometry(9.7, 0.36, 9.7, 4, 0.1), wood);
    base.position.y = -0.2;
    base.receiveShadow = true;
    base.castShadow = true;
    this.scene.add(base);
    // Raised rim: four rounded bars around the felt, thick and glossy.
    const RIM_IN = 4.4,
      RIM_W = 0.45,
      RIM_H = 0.17,
      RIM_TOP = 0.1;
    for (let i = 0; i < 4; i++) {
      const long = i % 2 === 0;
      const bar = new THREE.Mesh(new RoundedBoxGeometry(long ? (RIM_IN + RIM_W) * 2 : RIM_IN * 2 + 0.02, RIM_H, RIM_W, 3, 0.06), wood);
      const off = RIM_IN + RIM_W / 2;
      const a = (i * Math.PI) / 2;
      bar.position.set(Math.sin(a) * off, RIM_TOP - RIM_H / 2, Math.cos(a) * off);
      bar.rotation.y = a;
      bar.castShadow = true;
      bar.receiveShadow = true;
      this.scene.add(bar);
      // Brass inlay line along the middle of the rim.
      const inlay = new THREE.Mesh(new THREE.BoxGeometry(off * 2, 0.012, 0.028), this.trimMat);
      inlay.position.set(Math.sin(a) * off, RIM_TOP + 0.002, Math.cos(a) * off);
      inlay.rotation.y = a;
      this.scene.add(inlay);
      // A fine brass bead where the felt meets the rim.
      const bead = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, RIM_IN * 2, 8), brass);
      bead.rotation.z = Math.PI / 2;
      bead.rotation.y = a;
      bead.position.set(Math.sin(a) * (RIM_IN - 0.005), 0.03, Math.cos(a) * (RIM_IN - 0.005));
      this.scene.add(bead);
      // Brass corner caps.
      const corner = new THREE.Mesh(new THREE.BoxGeometry(RIM_W * 0.5, 0.02, RIM_W * 0.5), brass);
      const ca = a + Math.PI / 4;
      const cd = Math.SQRT2 * (RIM_IN + RIM_W / 2);
      corner.position.set(Math.sin(ca) * cd, RIM_TOP + 0.005, Math.cos(ca) * cd);
      corner.rotation.y = Math.PI / 4;
      this.scene.add(corner);
    }
    // Apron with a brass trim line, then the pedestal and its brass foot.
    const apron = new THREE.Mesh(new RoundedBoxGeometry(9.2, 0.42, 9.2, 3, 0.06), wood);
    apron.position.y = -0.55;
    apron.castShadow = true;
    this.scene.add(apron);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(9.24, 0.025, 9.24), this.trimMat);
    trim.position.y = -0.73;
    this.scene.add(trim);
    const profile = [
      [1.5, -1.6],
      [1.55, -1.52],
      [1.1, -1.42],
      [0.62, -1.2],
      [0.5, -0.95],
      [0.62, -0.8],
      [1.0, -0.74],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const pedestal = new THREE.Mesh(new THREE.LatheGeometry(profile, 40), wood);
    pedestal.castShadow = true;
    this.scene.add(pedestal);
    const foot = new THREE.Mesh(new THREE.TorusGeometry(1.52, 0.03, 8, 64), brass);
    foot.rotation.x = Math.PI / 2;
    foot.position.y = -1.5;
    this.scene.add(foot);

    // Felt: each variation brings its own colour (Classic Green, Tokyo Night).
    // Velvet sheen on the felt only where the GPU has room for it: the felt covers most of the screen.
    this.feltMat =
      this.q.tier === 'high'
        ? new THREE.MeshPhysicalMaterial({ roughness: 0.92, sheen: 0.6, sheenRoughness: 0.75, envMapIntensity: 0.4 })
        : new THREE.MeshStandardMaterial({ roughness: 0.92, envMapIntensity: 0.4 });
    this.setFelt('#17402f');
    const felt = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.04, 8.8), this.feltMat);
    felt.position.y = -0.0;
    felt.receiveShadow = true;
    this.scene.add(felt);

    // Tile racks at every seat (racks.ts): the table's own wood until a rack is equipped from The Atelier.
    this.racks = new Racks(this.rimMat, this.trimMat, this.q.tier, Math.min(8, this.renderer.capabilities.getMaxAnisotropy()));
    this.racks.setFelt(this.feltColor);
    this.racks.fitHuman({ scale: HAND_SCALE, z: HAND_Z, tw: TW, th: TH, td: TD }, 14 * (TW * HAND_SCALE + 0.012));
    this.scene.add(this.racks.group);

    // Riichi sticks: one per seat, laid in front of the discards when declared.
    const stickMat = new THREE.MeshStandardMaterial({ color: '#f4efe4', roughness: 0.4 });
    const dotMat = new THREE.MeshStandardMaterial({ color: '#b3262b', roughness: 0.4 });
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.025, 0.07), stickMat);
      const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 16), dotMat);
      body.castShadow = true;
      g.add(body, dot);
      g.visible = false;
      this.scene.add(g);
      this.sticks.push(g);
    }

    // Last-discard marker
    this.marker = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 20), new THREE.MeshStandardMaterial({ color: '#e7c27d', emissive: '#c8a46a', emissiveIntensity: 0.8, metalness: 0.6, roughness: 0.3 }));
    this.marker.rotation.x = Math.PI;
    this.marker.visible = false;
    this.scene.add(this.marker);
    // A soft gold frame glowing on the felt around the latest discard (it follows the tile).
    const ringGeo = new THREE.PlaneGeometry(TW + 0.24, TH + 0.24);
    this.lastRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ map: frameGlowTexture(), color: '#f2cf86', transparent: true, depthWrite: false, toneMapped: false }));
    this.lastRing.visible = false;
    this.lastRing.renderOrder = 2;
    this.scene.add(this.lastRing);
    this.marks = new DiscardMarks(this.scene);
    this.wallMarks = new WallMarkers(this.scene);

    // Freshly drawn tile: a small brass lozenge floating over it.
    const pip = new THREE.OctahedronGeometry(0.055, 0);
    pip.scale(1, 1.5, 0.45);
    this.drawnPip = new THREE.Mesh(pip, new THREE.MeshStandardMaterial({ color: '#f1d18f', emissive: '#d9a64e', emissiveIntensity: 0.9, metalness: 0.7, roughness: 0.28 }));
    this.drawnPip.visible = false;
    this.scene.add(this.drawnPip);
  }

  /** Passport rounds: a bar along the foot of each marked tile's face on your rack (gold: your passport; red: risky). */
  private edgeBars: THREE.Mesh[] = [];
  private edgeGeo = new THREE.BoxGeometry(TW * 0.84, 0.034, 0.01);
  private edgeMats = {
    pp: new THREE.MeshStandardMaterial({ color: '#f0cf7a', emissive: '#d9a64e', emissiveIntensity: 0.7, metalness: 0.75, roughness: 0.3 }),
    risk: new THREE.MeshStandardMaterial({ color: '#e0644c', emissive: '#c8432e', emissiveIntensity: 0.8, metalness: 0.2, roughness: 0.45 }),
  };
  private static edgeLocal = new THREE.Vector3();
  private updateEdgeBars() {
    let n = 0;
    const show = this.view !== 'orbit' && !this.tray && (this.ppIds.size > 0 || this.riskKinds.size > 0);
    if (show)
      for (const sl of this.handSlots) {
        const k = this.riskKinds.has(sl.tile.kind) ? 'risk' : this.ppIds.has(sl.tile.id) ? 'pp' : null;
        const t = k && this.tiles.get(sl.tile.id);
        if (!k || !t || t.loc !== 'hand' || !t.group.visible) continue;
        let m = this.edgeBars[n];
        if (!m) {
          m = new THREE.Mesh(this.edgeGeo, this.edgeMats.pp);
          this.scene.add(m);
          this.edgeBars.push(m);
        }
        m.material = this.edgeMats[k];
        m.visible = true;
        t.group.localToWorld(TableRenderer.edgeLocal.set(0, -TH / 2 + 0.024, TD / 2 + 0.006));
        m.position.copy(TableRenderer.edgeLocal);
        m.quaternion.copy(t.group.quaternion);
        m.scale.copy(t.group.scale);
        n++;
      }
    for (let i = n; i < this.edgeBars.length; i++) this.edgeBars[i].visible = false;
  }

  /** Repaint the felt in a variation's colour: a fine woven nap, a gold-thread border and the lamp's gentle falloff. */
  setFelt(color: string) {
    const motif = feltMotif(this.tableId);
    if (color === this.feltColor && motif === this.feltMotif) return;
    this.feltColor = color;
    this.feltMotif = motif;
    this.racks?.setFelt(color);
    const S = this.q.paint === 2 ? 1024 : 512;
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
    const tex = new THREE.CanvasTexture(tc);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    this.feltMat.map?.dispose();
    this.feltMat.map = tex;
    if (this.feltMat instanceof THREE.MeshPhysicalMaterial) this.feltMat.sheenColor.set(mix(color, '#fff2dc', 0.35));
    // The weave up close: one tiny shared twill bump, skipped on the lightest tier.
    if (this.q.tier !== 'low' && !this.feltMat.bumpMap) {
      this.feltMat.bumpMap = feltWeave(Math.min(8, this.renderer.capabilities.getMaxAnisotropy()));
      this.feltMat.bumpScale = 0.6;
    }
    this.feltMat.needsUpdate = true;
  }

  private buildTiles() {
    const ivory = new RoundedBoxGeometry(TW, TH, TD * 0.64, 3, 0.035);
    ivory.translate(0, 0, TD * 0.18);
    const jade = new RoundedBoxGeometry(TW, TH, TD * 0.4, 3, 0.035);
    jade.translate(0, 0, -TD * 0.3);
    const face = new THREE.PlaneGeometry(TW * 0.84, TH * 0.86);
    face.translate(0, 0, TD / 2 + 0.0015);
    const jadeMat = new THREE.MeshPhysicalMaterial({ color: TILE_SET.back, roughness: 0.25, metalness: 0.05, clearcoatRoughness: 0.1 });
    this.backMat = jadeMat;
    // Tiles on the felt get contact shading (tileMaterials.ts).
    jadeMat.userData.contact = true;
    // 136 standard tiles plus the eight flowers (ids 136..143) for flower games.
    // ...and eight American jokers (ids 144..151).
    for (let id = 0; id < TILE_ID_COUNT; id++) {
      const kind = kindOfTileId(id);
      const faceTex = this.faceTexture(kind);
      // The face texture doubles as a faint emissive so engraved ink stays crisp and the ground stays bright in low light.
      const faceMat = new THREE.MeshPhysicalMaterial({ map: faceTex, emissiveMap: faceTex, emissive: '#ffffff', emissiveIntensity: FACE_GLOW, roughness: 0.32, metalness: 0 });
      const bodyMat = new THREE.MeshPhysicalMaterial({ color: TILE_SET.face, roughness: 0.3, metalness: 0 });
      bodyMat.userData.contact = true;
      const g = new THREE.Group();
      const a = new THREE.Mesh(ivory, bodyMat);
      const b = new THREE.Mesh(jade, jadeMat);
      const c = new THREE.Mesh(face, faceMat);
      for (const m of [a, b]) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
      // The ivory body alone throws nearly the same shadow; below the high tier the jade back skips the
      // shadow pass, which saves ~150 draws every time shadows are redrawn.
      if (this.q.tier !== 'high') b.castShadow = false;
      for (const m of [a, b, c]) m.userData.tileId = id;
      g.add(a, b, c);
      this.scene.add(g);
      this.tiles.set(id, { id, kind, group: g, faceMat, bodyMat, red: false, loc: 'hidden', tipOk: false });
    }
  }

  /**
   * One texture per tile kind (and one per red five), shared by its copies, to keep GPU memory low on phones.
   * The player's own kinds are later sharpened further to hand detail while the browser is idle.
   */
  private faceTexture(kind: number, red = false) {
    const key = `${kind}:${red ? 'r' : ''}`;
    let tex = this.faceTex.get(key);
    if (!tex) {
      // Always the tier's full detail: a face is never shown softer than that (the faces kept on
      // the device, see primeFaces, make this a canvas lookup rather than a redraw on later visits).
      tex = this.makeFaceTexture(kind, red, faceDetail());
      this.faceTex.set(key, tex);
    }
    return tex;
  }

  private makeFaceTexture(kind: number, red: boolean, scale: number, canvas?: HTMLCanvasElement) {
    const tex = new THREE.CanvasTexture(canvas ?? drawFace(kind, this.labels, red, scale));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.faceAniso(scale);
    tex.userData.scale = scale;
    return tex;
  }

  private faceUpgrades: string[] = [];
  private faceUpgradeTimer = 0;

  private queueFaceUpgrade(key: string) {
    if (!this.faceUpgrades.includes(key)) this.faceUpgrades.push(key);
    if (this.faceUpgradeTimer) return;
    const ric = (window as Window & { requestIdleCallback?: (cb: (d: { timeRemaining(): number }) => void, o?: { timeout: number }) => number }).requestIdleCallback;
    this.faceUpgradeTimer = ric ? ric((d) => this.runFaceUpgrades(d), { timeout: 1500 }) : window.setTimeout(() => this.runFaceUpgrades(), 60);
  }

  /** Sharpens a few faces per idle slice; the hand's own kinds first. */
  private runFaceUpgrades(deadline?: { timeRemaining(): number }) {
    this.faceUpgradeTimer = 0;
    const hand = this.handFaceKeys();
    this.faceUpgrades.sort((a, b) => Number(hand.has(b)) - Number(hand.has(a)));
    // Drawing and uploading a full-detail face takes several milliseconds: never during a discard,
    // a call, the shuffle or the win moment. Try again once the table is still. The player's own tiles
    // may also sharpen in the calm after a move (nothing sliding, camera at rest), one per slice, since
    // between opponents' turns the table is rarely fully still for long.
    const now = performance.now();
    let calmOnly = false;
    if (this.moving(now)) {
      const calm = hand.has(this.faceUpgrades[0] ?? '') && !this.gesture && !this.cine && this.camT >= 1 && this.view !== 'orbit' && ![...this.tiles.values()].some((t) => t.tween);
      if (!calm) {
        this.faceUpgradeTimer = window.setTimeout(() => this.runFaceUpgrades(), 400);
        return;
      }
      calmOnly = true;
    }
    const full = faceDetail();
    do {
      const key = this.faceUpgrades.shift();
      if (!key) break;
      const old = this.faceTex.get(key);
      // The player's own tiles get the most detailed faces: the camera sees them closest.
      const want = hand.has(key) && !this.memTight ? Math.max(full, HAND_DETAIL[this.q.tier]) : full;
      if (!old || (old.userData.scale ?? 0) >= want) continue;
      const [k, r] = key.split(':');
      const kind = Number(k),
        red = r === 'r';
      const tex = this.makeFaceTexture(kind, red, want);
      // Upload now, in idle time, rather than stalling the next frame that shows it.
      this.renderer.initTexture(tex);
      this.faceTex.set(key, tex);
      for (const t of this.tiles.values()) {
        if (t.kind !== kind || t.red !== red) continue;
        t.faceMat.map = t.faceMat.emissiveMap = tex;
        dressFace(t.faceMat, kind, this.labels, red, this.faceAniso(want), want);
      }
      // The foil map too, so the next frame showing this face has nothing left to upload.
      const foil = [...this.tiles.values()].find((t) => t.kind === kind && t.red === red)?.faceMat.metalnessMap;
      if (foil) this.renderer.initTexture(foil);
      old.dispose();
      this.wake(100);
    } while (!calmOnly && deadline && deadline.timeRemaining() > 12);
    if (this.faceUpgrades.length) this.queueFaceUpgrade(this.faceUpgrades[0]);
    else this.trimHandFaces(hand, full);
  }

  private handFaceKeys() {
    const own = this.handSlots.map((s) => this.tiles.get(s.tile.id)).filter((t) => t?.loc === 'hand');
    return new Set(own.map((t) => `${t!.kind}:${t!.red ? 'r' : ''}`));
  }

  /** Ask for hand-detail faces for the kinds now in the player's hand (after each layout). */
  private queueHandFaces() {
    if (this.memTight) return;
    const want = Math.max(faceDetail(), HAND_DETAIL[this.q.tier]);
    for (const key of this.handFaceKeys()) if ((this.faceTex.get(key)?.userData.scale ?? want) < want) this.queueFaceUpgrade(key);
  }

  /**
   * Keeps GPU memory in check: once more than HAND_DETAIL_KEEP faces hold hand detail, the ones that
   * left the hand are scaled back to the tier's detail (a quick canvas copy, not a redraw).
   */
  private trimHandFaces(hand: Set<string>, full: number, keep = HAND_DETAIL_KEEP) {
    const big = [...this.faceTex.entries()].filter(([, t]) => (t.userData.scale ?? 0) > full);
    let extra = big.length - keep;
    for (const [key, old] of big) {
      if (extra <= 0) break;
      if (hand.has(key)) continue;
      const src = old.image as HTMLCanvasElement;
      const c = document.createElement('canvas');
      c.width = Math.round((src.width * full) / old.userData.scale);
      c.height = Math.round((src.height * full) / old.userData.scale);
      const g = c.getContext('2d')!;
      g.imageSmoothingQuality = 'high';
      g.drawImage(src, 0, 0, c.width, c.height);
      const [k, r] = key.split(':');
      const kind = Number(k),
        red = r === 'r';
      const tex = this.makeFaceTexture(kind, red, full, c);
      this.renderer.initTexture(tex);
      this.faceTex.set(key, tex);
      for (const t of this.tiles.values()) {
        if (t.kind !== kind || t.red !== red) continue;
        t.faceMat.map = t.faceMat.emissiveMap = tex;
        dressFace(t.faceMat, kind, this.labels, red, this.faceAniso(full), full);
      }
      old.dispose();
      extra--;
    }
  }

  /** Hand-detail faces get the GPU's full anisotropic filtering, so they stay sharp at a slant. */
  private faceAniso(scale = 0) {
    const max = this.renderer.capabilities.getMaxAnisotropy();
    return scale > faceDetail() ? max : Math.min(this.q.anisotropy, max);
  }

  /** Redraw faces (e.g. after toggling beginner labels or changing tile set). */
  refreshFaces() {
    for (const tex of this.faceTex.values()) tex.dispose();
    this.faceTex.clear();
    clearFaceSurfaces();
    for (const t of this.tiles.values()) {
      const tex = this.faceTexture(t.kind, t.red);
      t.faceMat.map = t.faceMat.emissiveMap = tex;
      dressFace(t.faceMat, t.kind, this.labels, t.red, this.faceAniso(tex.userData.scale), tex.userData.scale);
      t.faceMat.needsUpdate = true;
    }
  }

  // ------------------------------------------------------------ cosmetics

  /** Equip a tile set (catalog TILE_SETS id): faces, body and back colour, gloss and translucency. Purely visual. */
  setTileSet(id: string) {
    setFaceSet(id);
    // Body, back and face finishes come from the set (render/tileMaterials.ts).
    applyTileFinish([...this.tiles.values()].map((t) => t.bodyMat), this.backMat, [...this.tiles.values()].map((t) => t.faceMat), this.q.tier === 'low');
    this.refreshFaces();
  }

  /** Equip a tile rack (cosmetics/racks.ts id) at all four seats. Purely visual. */
  setRackStyle(id: string) {
    this.racks.setStyle(id);
  }

  /** Equip a table (catalog TABLES id): felt colour plus rim colour and finish. */
  setTableStyle(id: string) {
    const t = tableStyle(id);
    this.tableId = t.id;
    this.setFelt(t.felt);
    const hsl = { h: 0, s: 0, l: 0 };
    new THREE.Color(t.rim).getHSL(hsl);
    const gilded = t.rimGloss >= 0.75 && hsl.s > 0.3 && hsl.h > 0.08 && hsl.h < 0.16;
    const stone = !gilded && t.rimGloss >= 0.75 && luma(t.rim) > 0.55;
    const wood = !gilded && !stone && t.rimGloss < 0.5;
    const m = this.rimMat;
    m.map?.dispose();
    m.map = stone ? marbleTexture(t.rim, true) : wood ? woodTexture(t.rim) : null;
    m.color.set(m.map ? '#ffffff' : t.rim);
    // Every rim is finished: oiled wood gets a satin coat, lacquer and stone a deep gloss, gilt a brushed sheen.
    m.roughness = gilded ? 0.32 : Math.max(0.14, 0.55 - t.rimGloss * 0.45);
    m.metalness = gilded ? 0.9 : 0.02;
    m.clearcoat = gilded ? 0.15 : wood ? 0.55 : 1;
    m.clearcoatRoughness = wood ? 0.22 : 0.07;
    m.envMapIntensity = gilded ? 1.1 : 0.9;
    m.needsUpdate = true;
    // Brass inlay everywhere except on a gilded rim, which gets a black lacquer line instead.
    this.trimMat.color.set(gilded ? '#120c08' : '#c9a46a');
    this.trimMat.metalness = gilded ? 0.1 : 1;
    this.trimMat.roughness = gilded ? 0.2 : 0.3;
  }

  /** The equipped table id ('' until setTableStyle is called). */
  get tableStyleId() {
    return this.tableId;
  }

  /** Equip an environment (catalog ENVIRONMENTS id): room colour, key and rim light, and a painted backdrop. */
  setEnvironment(id: string) {
    const e: EnvironmentStyle = environmentStyle(id);
    if (e.id === this.envId) return;
    this.envId = e.id;
    (this.scene.background as THREE.Color).set(e.sky);
    (this.scene.fog as THREE.Fog).color.set(e.sky);
    // Warm, but not so warm that ivory reads as cream.
    this.keyLight.color.set(mix(e.key, '#ffffff', 0.45));
    this.keyLight.intensity = 150 * e.keyPower;
    this.fillLight.color.set(mix(e.key, '#ffffff', 0.6));
    // Softened so a city's colour reads as a hint on the tiles, never as neon.
    this.rimLight.color.set(mix(e.rim, '#ffffff', 0.45));
    this.rimLight.intensity = 0.3;
    this.hemi.color.set(mix('#f4e6cc', e.key, 0.4));
    this.hemi.groundColor.set(mix('#0d1612', e.sky, 0.5));
    // The tiles are white-balanced for this light, so ivory stays white under a lantern-red or amber room.
    // The light on a face: the key, the fill, the room's bounce and the club's warm reflections (room.ts).
    const light = this.keyLight.color.clone().multiplyScalar(0.45);
    light.add(this.fillLight.color.clone().multiplyScalar(0.1)).add(this.hemi.color.clone().multiplyScalar(0.25)).add(new THREE.Color('#ffe4c4').multiplyScalar(0.2));
    setTileLight(light);
    this.room.setEnvironment(e, RUG[e.id] ?? '#3a1a18');
    this.backdrop.set(e);
  }

  /** Table ambience (fx-none, fx-candle, fx-mist, fx-fireflies). */
  setTableEffect(id: string) {
    this.fx.setEffect(id);
  }

  /**
   * A short (about 2.5 s) celebratory particle effect over the winning hand.
   * 'win-classic' is the existing reveal and adds nothing; skipped at minimal animation speed.
   */
  playWinAnimation(id: string, anchor?: THREE.Vector3 | { x: number; y: number; z: number }) {
    if (this.speed === 'minimal' || id === 'win-classic') return;
    const at = anchor ? new THREE.Vector3(anchor.x, anchor.y, anchor.z) : new THREE.Vector3(0, 0.3, 0);
    this.fx.playWin(id, at, this.clock.getElapsedTime());
  }

  /** The player asked the system for less motion. */
  get reducedMotion() {
    try {
      return reduceMotionSetting() || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  }

  /** The win sweep's light: always in the scene (adding a light later recompiles every material), dark until a win. */
  private winGlow: THREE.PointLight | null = null;
  private winLight: { light: THREE.PointLight; from: THREE.Vector3; to: THREE.Vector3; t0: number; dur: number } | null = null;

  /**
   * The win moment on the table, for every win: a soft gold light sweeps along
   * the winning hand (lifted by layout's winLift) and fine gold motes rise from
   * it, and the camera pushes slowly in. A self-drawn win's motes rise straight
   * from the hand; a win on a discard first draws a thin thread of light from
   * the discarder's river. Reduced motion or minimal animations: no particles
   * and no camera move, just the lifted hand and a still glow.
   */
  celebrateWin(winner: number, o: { selfDrawn: boolean; from?: number | null; camera?: boolean }) {
    const now = this.clock.getElapsedTime();
    const calm = this.reducedMotion || this.speed === 'minimal';
    const q = this.seatQuat(winner);
    const span = this.lastState ? Math.max(1.2, (this.lastState.players[winner].hand.length * TW * 1.08) / 2 + 0.2) : 2.2;
    const a = new THREE.Vector3(-span, 0.55, 3.75).applyQuaternion(q);
    const b = new THREE.Vector3(span, 0.55, 3.75).applyQuaternion(q);
    const dur = calm ? 2.4 : this.speed === 'cinematic' ? 2.4 : 1.8;
    if (this.winGlow) {
      this.winLight = { light: this.winGlow, from: a, to: b, t0: now + (calm ? 0 : 0.35), dur };
      this.winGlow.userData.calm = calm;
    }
    if (!calm) {
      const thread = !o.selfDrawn && o.from !== undefined && o.from !== null && o.from !== winner ? new THREE.Vector3(0, 0.12, 1.4).applyQuaternion(this.seatQuat(o.from)) : null;
      this.fx.winSweep(a, b, now, { selfDrawn: o.selfDrawn, from: thread, dur });
    }
    // Portrait phones keep their whole-table view: every revealed hand is already in frame there.
    if (o.camera !== false && !calm && !this.compact) {
      const anchor = this.seatAnchor(winner);
      this.setView('focus', this.speed === 'cinematic' ? 3.4 : 2.6, anchor);
      // A slow push: settle a little closer than the usual focus shot.
      this.camTo.pos.lerp(this.camTo.look, 0.12);
    }
  }

  /** The signature moment under way (cinematic.ts), if any. */
  private cine: SignatureShot | null = null;

  /**
   * The signature moment for a limit hand or yakuman: a camera glide along the
   * winning hand, a gold sweep across its tiles, a shaft of light and rising
   * motes. Calm (reduced motion or Minimal speed): a short still glow only.
   * Returns its length in seconds.
   */
  playSignatureWin(winner: number): number {
    this.cine?.dispose();
    const now = this.clock.getElapsedTime();
    const calm = this.reducedMotion || this.speed === 'minimal';
    const dur = signatureDuration(calm, this.speed);
    const q = this.seatQuat(winner);
    const p = this.lastState?.players[winner];
    const ids = new Set([...(p?.hand ?? []), ...(p?.melds ?? []).flatMap((m) => m.tiles)].map((x) => x.id));
    const tiles = [...ids].map((id) => this.tiles.get(id)).filter((t): t is TileObj => !!t && t.group.visible);
    const span = p ? Math.max(1.2, (p.hand.length * TW * 1.08) / 2 + 0.2) : 2.2;
    this.cine = new SignatureShot(this.scene, {
      centre: new THREE.Vector3(0, 0.55, 3.75).applyQuaternion(q),
      along: new THREE.Vector3(1, 0, 0).applyQuaternion(q),
      out: new THREE.Vector3(0, 0, 1).applyQuaternion(q),
      span,
      tiles,
      now,
      dur,
      calm,
      compact: this.compact,
    });
    return dur;
  }

  /** Cut the signature moment short (a tap, or Skip). */
  skipSignatureWin() {
    this.cine?.finish(this.clock.getElapsedTime());
  }

  /** Move and fade the win light. */
  private updateWinLight(now: number) {
    const w = this.winLight;
    if (!w) return;
    const k = (now - w.t0) / w.dur;
    if (w.light.userData.calm) {
      // Still: rest over the middle of the hand, fade in and out.
      w.light.position.lerpVectors(w.from, w.to, 0.5);
      w.light.intensity = k < 0 || k > 1 ? 0 : Math.sin(Math.PI * k) * 2.2;
    } else {
      w.light.position.lerpVectors(w.from, w.to, ease(Math.min(1, Math.max(0, k))));
      w.light.intensity = k < 0 || k > 1.15 ? 0 : Math.sin(Math.PI * Math.min(1, k)) * 3.2;
    }
    if (k > 1.2) {
      w.light.intensity = 0;
      this.winLight = null;
    }
  }

  /**
   * Opponents (by seat; the human seat and nulls are skipped) as 3D figures
   * seated behind their racks, forearms on the rim. They glance at whoever is
   * playing and look down at their own tiles on their turn.
   */
  setSeatAvatars(specs: (AvatarSpec | null)[]) {
    for (let seat = 0; seat < 4; seat++) {
      const spec = seat === this.humanSeat ? null : (specs[seat] ?? null);
      const key = spec ? JSON.stringify(spec) : '';
      if (key === this.avatarKeys[seat]) continue;
      this.avatarKeys[seat] = key;
      this.figures[seat]?.dispose();
      this.figures[seat] = null;
      if (!spec) continue;
      const fig = new SeatFigure(spec);
      this.scene.add(fig.group);
      this.figures[seat] = fig;
    }
    this.placeAvatars();
  }

  // ------------------------------------------------------------ side tables (sideTables.ts)

  /** Each seat's gold on its side table follows its score, by seat; `start` is the starting score. */
  setPurses(scores: number[], start: number) {
    const units: (number | null)[] = [null, null, null, null];
    scores.forEach((sc, seat) => (units[this.quad(seat)] = purseUnits(sc, start)));
    this.room.sides.setPurses(units);
  }

  /** Two dice or three on the dice tray, as the variation rolls. */
  setDiceCount(n: number) {
    this.room.sides.setDiceCount(n);
  }

  /** The hand-start roll in front of the dealer (on the tray only, with less motion). */
  rollDice(values: number[], dealer: number, opts: { pace?: number; hold?: boolean } = {}) {
    const calm = this.reducedMotion || this.speed === 'minimal';
    this.room.sides.rollDice(values, this.quad(dealer), calm, opts);
    if (!calm) this.wake((SideTables.ROLL_S * 1000) / (opts.pace ?? 1) + 300);
  }

  /** Dice held on the felt by the opening's throws go back to their tray. */
  diceHome() {
    this.room.sides.sendDiceHome();
    this.wake(1000);
  }

  /** A cup of tea from one seat to another; the receiver nods thanks when it arrives. Returns ms to arrival. */
  passTea(from: number, to: number): number {
    const calm = this.reducedMotion || this.speed === 'minimal';
    const s = this.room.sides.passTea(this.quad(from), this.quad(to), calm);
    if (calm) return 0;
    this.wake(s * 1000 + 2200);
    window.setTimeout(() => this.figures[to]?.nod(), s * 1000 + 200);
    return s * 1000;
  }

  /** Behind each opponent's rack, beyond the table edge, facing the middle. */
  private placeAvatars() {
    for (let seat = 0; seat < 4; seat++) {
      const f = this.figures[seat];
      if (!f) continue;
      const rel = this.quad(seat);
      // Smaller than life beside the oversized tiles, with forearms resting on the rim.
      f.group.position.copy(this.seatAnchor(seat, new THREE.Vector3(0, 0.04, 5.62)));
      f.group.quaternion.copy(this.seatQuat(seat)).multiply(TableRenderer.faceIn);
      f.group.scale.setScalar(0.68);
      // A phone's top-down view frames only the felt, and an empty seat stays empty.
      f.group.visible = rel !== 0 && !this.compact;
    }
  }

  private static box = new THREE.Box3();
  private static corner = new THREE.Vector3();

  /**
   * Where your rack's highest tile edge lands on screen, so the HUD can keep the
   * hand's labels clear of it at every zoom, tilt and pan.
   */
  private canvasRect: DOMRect | null = null;
  private canvasRectAt = 0;

  private measureHandTop() {
    let top: number | null = null;
    if (!this.tray && this.handSlots.length && this.view === 'seat' && this.handTopListeners.size) {
      // The canvas only moves on resize: read its box at most once a second, so this per-frame
      // check never forces the browser to lay the HUD out again mid-animation.
      const nowMs = performance.now();
      if (!this.canvasRect || nowMs - this.canvasRectAt > 1000) {
        this.canvasRect = this.renderer.domElement.getBoundingClientRect();
        this.canvasRectAt = nowMs;
      }
      const r = this.canvasRect;
      let minY = Infinity;
      // In split view the hand sits in its strip, so labels go just above the strip.
      if (this.splitOn) minY = r.top + this.stripRect().top;
      else
      for (const id of [...this.handSlots.map((sl) => sl.tile.id), ...this.ledgeIds]) {
        const t = this.tiles.get(id);
        // A tile lifted by hover or selection should not make the labels hop.
        if (!t || !t.group.visible || id === this.hoverId || id === this.selectedId) continue;
        const b = TableRenderer.box.setFromObject(t.group);
        for (let i = 0; i < 8; i++) {
          const c = TableRenderer.corner.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).project(this.camera);
          minY = Math.min(minY, r.top + ((1 - c.y) / 2) * r.height);
        }
      }
      if (Number.isFinite(minY)) top = Math.round(minY);
    }
    if (top === this.handTop || (top !== null && this.handTop !== null && Math.abs(top - this.handTop) < 2)) return;
    this.handTop = top;
    for (const fn of this.handTopListeners) fn(top);
  }

  private static faceIn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
  private static lookAt = new THREE.Vector3();

  private updateFigures(now: number, dt: number) {
    for (let seat = 0; seat < 4; seat++) {
      const f = this.figures[seat];
      if (!f || !f.group.visible) continue;
      const turn = this.turnSeat;
      const look = turn >= 0 && turn !== seat ? this.seatAnchor(turn, TableRenderer.lookAt.set(0, 0.9, 4.6)) : null;
      f.update(now, dt, look);
    }
  }

  private buildCompass() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.06, 64), [
      new THREE.MeshStandardMaterial({ color: '#2b1c12', roughness: 0.4 }),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.1 }),
      new THREE.MeshStandardMaterial({ color: '#2b1c12' }),
    ]);
    disc.position.y = 0.04;
    disc.rotation.y = Math.PI / 2;
    disc.receiveShadow = true;
    this.scene.add(disc);
    this.compass = { canvas, tex };
    this.machine = new ShuffleMachine(disc, 18 * TW + 0.1, WALL_Z, TH + 0.08);
    this.scene.add(this.machine.group);
    this.drawCompass(['E', 'S', 'W', 'N'], 'E', 0, -1);
  }

  /** Centre compass: each seat's wind faces that seat; prevailing wind in the middle. */
  drawCompass(seatWinds: Wind[], prevailing: Wind, dealer: number, turn: number) {
    // Layout runs on every hover and drag step; only repaint when something changed.
    this.turnSeat = turn;
    const key = `${seatWinds.join('')}|${prevailing}|${dealer}|${turn}|${this.humanSeat}`;
    if (key === this.compassKey) return;
    this.compassKey = key;
    const g = this.compass.canvas.getContext('2d')!;
    const S = 512,
      C = S / 2;
    g.clearRect(0, 0, S, S);
    g.fillStyle = '#1a120c';
    g.fillRect(0, 0, S, S);
    g.strokeStyle = '#c8a46a';
    g.lineWidth = 6;
    g.beginPath();
    g.arc(C, C, 236, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(C, C, 214, 0, Math.PI * 2);
    g.stroke();
    // Rotation: canvas "up" maps to -z (away from the human). The cylinder
    // top UVs are rotated, so draw relative positions accordingly.
    const angleFor = (rel: number) => Math.PI / 2 + rel * (-Math.PI / 2); // rel0 bottom, rel1 right
    for (let seat = 0; seat < seatWinds.length; seat++) {
      const rel = quadrantOf(seat, this.humanSeat, seatWinds.length);
      const a = angleFor(rel);
      const x = C + Math.cos(a) * 160,
        y = C + Math.sin(a) * 160;
      const active = seat === turn;
      if (active) {
        g.strokeStyle = 'rgba(231,194,125,0.9)';
        g.lineWidth = 14;
        g.beginPath();
        g.arc(C, C, 225, a - 0.42, a + 0.42);
        g.stroke();
      }
      g.save();
      g.translate(x, y);
      g.rotate(a - Math.PI / 2);
      g.fillStyle = active ? '#f1d9a6' : '#b89a6a';
      g.font = '600 64px Marcellus, Georgia, serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(seatWinds[seat], 0, 0);
      if (seat === dealer) {
        g.fillStyle = '#b3352a';
        g.beginPath();
        g.arc(0, 46, 9, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    }
    g.fillStyle = '#efe6d2';
    g.font = '700 120px "Noto Serif SC", serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('東南西北'[WINDS.indexOf(prevailing)], C, C - 6);
    g.font = '600 22px Manrope, sans-serif';
    g.fillStyle = '#c8a46a';
    g.fillText('NEWS', C, C + 72);
    this.compass.tex.needsUpdate = true;
  }

  // ------------------------------------------------------------ camera

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.canvasRect = null;
    // A pixel budget: a Retina laptop at 2x draws 6 to 8 million pixels a frame, which keeps its GPU
    // flat out and makes the whole page stutter. Never below 1x, and phones stay well inside it.
    this.renderer.setPixelRatio(this.pixelRatioFor(w, h));
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.compact = w / h < 0.85;
    this.short = !this.compact && h <= 500;
    this.camera.fov = this.compact ? 50 : 38;
    this.applyViewShift();
    this.placeAvatars();
    if (this.view === 'seat') this.setView('seat', 0.01);
    if (this.lastState) this.layout(this.lastState, this.lastOpts, true);
  }

  /**
   * The drawing density for a w x h view. The governor's lower resolution applies only while
   * something moves (lowRes, see frame()): a still table, which is when tiles are read, is always
   * drawn at the screen's full density within the pixel budget.
   */
  private pixelRatioFor(w: number, h: number) {
    const gs = this.lowRes ? this.governor.step.scale : 1;
    // The governor may go a little under 1x (never below 0.75x) only on its last rungs.
    const floor = gs <= 0.6 ? 0.75 : 1;
    const area = Math.max(1, w * h);
    const lean = this.memTight ? 0.75 : 1;
    let pr = Math.min(this.prMax, Math.sqrt((MAX_PIXELS[this.q.tier] * lean) / area));
    // When the page itself is pinch-zoomed (a browser or app viewer zoom, not the table's own camera),
    // the canvas is magnified like a photo: draw it denser so the tiles stay sharp.
    const pageZoom = Math.min(4, Math.max(1, window.visualViewport?.scale ?? 1));
    if (pageZoom > 1.05 && !this.memTight) pr = Math.max(pr, Math.min(this.prMax * pageZoom, Math.sqrt(ZOOM_PIXELS[this.q.tier] / area)));
    return Math.max(Math.min(floor, this.prMax), pr * gs);
  }

  /** Drawn at the governor's reduced resolution (only while moving). */
  private lowRes = false;
  private stillSince = 0;

  /** Full density as soon as the table comes to rest; the governor's resolution only while it moves. */
  private settleResolution(moving: boolean, ms: number) {
    let want = this.lowRes;
    if (moving) {
      this.stillSince = 0;
      want = this.governor.step.scale < 1;
    } else if (this.lowRes) {
      this.stillSince ||= ms;
      if (ms - this.stillSince > 300) want = false;
    }
    if (want === this.lowRes) return;
    this.lowRes = want;
    this.applyDensity();
  }

  /** Re-apply the drawing density (the governor changed rung, or the table moved or came to rest). */
  private applyDensity() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const pr = this.pixelRatioFor(w, h);
    if (Math.abs(pr - this.renderer.getPixelRatio()) > 0.01) this.renderer.setPixelRatio(pr);
  }

  /** On phones the bottom of the screen holds your tiles, so lift the table into the space above. */
  private applyViewShift() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    if (this.compact && this.view !== 'orbit') this.camera.setViewOffset(w, h, 0, Math.round(h * 0.14), w, h);
    // Landscape phones: the tray takes the bottom of the screen, so lift the table into the space above it.
    else if (this.short && this.view !== 'orbit') this.camera.setViewOffset(w, h, 0, Math.round(h * 0.15), w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  setView(view: 'orbit' | 'seat' | 'focus', dur = 1.4, focus?: THREE.Vector3) {
    // A new framing takes the camera back from the player, gliding from wherever they left it.
    this.releaseFree();
    this.view = view;
    this.applyViewShift();
    this.camFrom.pos.copy(this.camBase);
    this.camFrom.look.copy(this.camLook);
    const aspect = this.camera.aspect;
    if (view === 'seat') {
      if (this.compact) {
        // Portrait: near top-down, wide enough to show the whole table.
        const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * aspect);
        // Frame the discard rivers edge to edge (the walls may run off the sides);
        // hands live in the 2D tray and seat plates.
        // Wider upright screens (tablets) have the height to spare: widen toward the side racks and their sets.
        const wide = THREE.MathUtils.clamp((aspect - 0.56) / 0.11, 0, 1);
        // Phones frame the rivers as far as they reach (riverReach), so few discards read large; tablets keep the wide view.
        // The opening (East's throw, the wall break) steps back to show the whole wall.
        const reach = this.openingWide ? OPENING_REACH : Math.min(this.riverReach, RIVERS_FULL);
        const half = reach + (4.5 - reach) * wide;
        const d = half / Math.tan(hfov / 2);
        this.camTo.pos.set(0, d * 0.96, d * 0.26 + 0.9);
        this.camTo.look.set(0, 0, 0.75);
      } else if (this.short) {
        // Landscape phone: no rack to show, so look down on the rivers and fill the short screen with them.
        const f = Math.max(1, 1.55 / aspect);
        this.camTo.pos.set(0, 11 * f, 4.2 * f);
        this.camTo.look.set(0, 0, 0.4);
      } else {
        // Close enough that the rack and rivers read clearly, with the far wall still in frame.
        const f = Math.max(1, 1.55 / aspect);
        this.camTo.pos.set(0, 8.0 * f, 7.2 * f);
        this.camTo.look.set(0, 0, 1.6);
      }
    } else if (view === 'focus' && focus) {
      this.focusTarget.copy(focus);
      const dir = focus.clone().setY(0).normalize();
      const dist = this.compact ? 7 : 4.6;
      this.camTo.pos.copy(focus).addScaledVector(dir, -1.2).add(new THREE.Vector3(0, dist, 0)).addScaledVector(dir, dist * 0.55);
      if (focus.z > 2) this.camTo.pos.set(focus.x, dist + 1.2, focus.z + dist * 0.9);
      this.camTo.look.copy(focus);
    }
    this.camT = 0;
    this.camStart = this.clock.getElapsedTime();
    this.camDur = Math.max(0.01, dur);
  }

  // ------------------------------------------------------------ player view (zoom, tilt, yaw)

  /** The player's view adjustment (applies at the seat view). */
  get zoom() {
    return this.viewT.zoom;
  }
  get tilt() {
    return this.viewT.tilt;
  }
  get yaw() {
    return this.viewT.yaw;
  }
  get pan() {
    return this.viewT.pan;
  }
  /** The whole adjustment at once. */
  get tableView(): TableView {
    return { ...this.viewT };
  }
  /** True while playing from your seat, where zoom and tilt apply. */
  get viewAdjustable() {
    return this.view === 'seat';
  }

  /** Zoom: 1 is the default framing; clamped to ZOOM_MIN..ZOOM_MAX. Eased. */
  setZoom(z: number) {
    this.setTableView({ ...this.viewT, zoom: z });
  }
  /** Tilt: -1 lower and more angled .. 1 more top-down; 0 is the default. Eased. */
  setTilt(t: number) {
    this.setTableView({ ...this.viewT, tilt: t });
  }
  /** Yaw in degrees, clamped to ±YAW_MAX. Eased. */
  setYaw(deg: number) {
    this.setTableView({ ...this.viewT, yaw: deg });
  }
  /** Sideways shift, -1 .. 1 (each end is PAN_SHARE of the view's width). Eased. */
  setPan(p: number) {
    this.setTableView({ ...this.viewT, pan: p });
  }
  /** True once the player has moved the camera away from the default framing. */
  get viewChanged() {
    const v = this.viewT;
    return Math.abs(v.zoom - 1) > 1e-3 || Math.abs(v.tilt) > 1e-3 || Math.abs(v.yaw) > 0.05 || Math.abs(v.pan) > 1e-3;
  }
  /** Back to the default framing. */
  resetView() {
    this.setTableView({ ...DEFAULT_VIEW });
  }

  setTableView(v: Partial<TableView>) {
    const next = clampView({ ...this.viewT, ...v });
    if (next.zoom === this.viewT.zoom && next.tilt === this.viewT.tilt && next.yaw === this.viewT.yaw && next.pan === this.viewT.pan) return;
    this.viewT = next;
    this.clearTip();
    window.clearTimeout(this.viewSaveTimer);
    this.viewSaveTimer = window.setTimeout(() => {
      try {
        localStorage.setItem(VIEW_KEY, JSON.stringify(this.viewT));
      } catch {
        /* storage unavailable */
      }
    }, 250);
    this.onViewChange?.({ ...next });
    for (const fn of this.viewListeners) fn({ ...next });
  }

  private static sph = new THREE.Spherical();
  private static v3 = new THREE.Vector3();
  private static v3b = new THREE.Vector3();

  /** Ease the player's adjustment and apply it on top of the base camera pose. */
  private applyCamera(dt: number) {
    const k = 1 - Math.exp(-dt * 9);
    const c = this.viewC,
      t = this.viewT;
    c.zoom += (t.zoom - c.zoom) * k;
    c.tilt += (t.tilt - c.tilt) * k;
    c.yaw += (t.yaw - c.yaw) * k;
    c.pan += (t.pan - c.pan) * k;
    this.viewW += ((this.view === 'seat' ? 1 : 0) - this.viewW) * (1 - Math.exp(-dt * 3));
    this.bottomClearC += (this.bottomClearT - this.bottomClearC) * (1 - Math.exp(-dt * 4));
    if (Math.abs(this.bottomClearT - this.bottomClearC) < 0.5) this.bottomClearC = this.bottomClearT;
    if (this.tray) {
      const end = this.myRiverEnd();
      this.riverEndC = this.riverEndC ? this.riverEndC + (end - this.riverEndC) * (1 - Math.exp(-dt * 3)) : end;
      if (Math.abs(end - this.riverEndC) > 0.002) this.wake(300);
    }
    const w = this.viewW;
    // The room view (home, menus) gets a warmer, fuller ambient; at the seat it settles back so tiles stay white.
    this.hemi.intensity = 0.3 + 0.22 * (1 - w);
    const zoom = 1 + (c.zoom - 1) * w;
    const tilt = c.tilt * w;
    const yaw = THREE.MathUtils.degToRad(c.yaw) * w;
    const look = TableRenderer.v3.copy(this.camLook);
    const s = TableRenderer.sph.setFromVector3(this.camBase.clone().sub(this.camLook));
    // The seat view never drops below ~9° of elevation; the establishing shot may glide lower.
    s.phi = THREE.MathUtils.clamp(s.phi - tilt * 0.5, 0.12, 1.42 + (1 - w) * 0.18);
    s.theta += yaw;
    const seat = w > 0.01 && !this.tray;
    // Leaving the seat view (the home room, menus) hides the hand strip and its rules too.
    if (!seat && this.splitOn) this.setSplitOn(false);
    if (seat) {
      // Frame the whole board and your full hand for this screen's shape, then apply the player's zoom.
      // Where that leaves your tiles small (tablets, wide windows), split: the board above, your hand close up below.
      let fit = this.fitBoard(s.phi, s.theta, look, false);
      const split = !this.splitPaused && (this.splitPref === 'on' || (this.splitPref === 'auto' && fit.tilePx < SPLIT_BELOW_PX));
      if (split !== this.splitOn) this.setSplitOn(split);
      if (split) fit = this.fitBoard(s.phi, s.theta, look, true);
      s.radius += (fit.radius - s.radius) * w;
      look.z += fit.dz * w;
      // Zooming in leans toward your rack, except in split view, where your hand is in the strip
      // (leaning there would lift the board's copy of it back into view).
      if (!split) look.z += Math.max(0, zoom - 1) * 1.2;
      s.radius /= zoom;
      this.camera.position.setFromSpherical(s).add(look);
    } else {
      // Zooming in leans the focus toward your rack, so your hand stays in frame.
      look.z += this.compact ? (zoom - 1) * 0.4 : Math.max(0, zoom - 1) * 1.6;
      // Looking more from above also steps back a little, so the far wall stays in frame.
      s.radius *= (1 + Math.max(0, tilt) * 0.22) / zoom;
      this.camera.position.setFromSpherical(s).add(look);
      if (w > 0.01) this.keepRacksInFrame(s, look);
    }
    // Slide sideways (camera and focus together) by up to PAN_SHARE of the visible width.
    const pan = c.pan * w;
    if (Math.abs(pan) > 1e-4) {
      const visW = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * s.radius * this.camera.aspect;
      const right = TableRenderer.v3b.set(Math.cos(s.theta), 0, -Math.sin(s.theta)).multiplyScalar(pan * PAN_SHARE * visW);
      this.camera.position.add(right);
      look.add(right);
    }
    this.camera.lookAt(look);
  }

  private static farRack = new THREE.Vector3();
  private fitFull = { key: '', out: { radius: 12, dz: 0, tilePx: 99 } };
  private fitSplit = { key: '', out: { radius: 12, dz: 0, tilePx: 99 } };

  // ------------------------------------------------------------ split view

  /** 'auto' splits where the whole-table view would leave your tiles small; 'on' and 'off' are the player's choice. */
  splitPref: SplitPref = loadSplitPref();
  private splitOn = false;
  /** Set while a hand's summary is up: the whole table shows, without your hand's close-up strip. */
  splitPaused = false;
  /** Looks at your rack close up for the strip along the bottom in split view. */
  private handCam = new THREE.PerspectiveCamera(28, 2, 0.1, 60);
  /** The camera the pointer is over (the hand strip's in split view). */
  private pickCam: THREE.Camera = new THREE.PerspectiveCamera();
  private stripEl: HTMLElement | null = null;
  /** How far the discards reach from the centre (world units), for a portrait phone's framing. */
  private riverReach = RIVERS_FULL;
  private riverEdge: THREE.Vector3[] = [];
  /** Screen rectangles (px) the HUD lays over the table on upright phones (side plates, last-discard chip): no discard goes under them. */
  keepOut: { l: number; t: number; r: number; b: number }[] = [];

  /** True while the table shows the board above and your hand close up in a strip below. */
  get splitView() {
    return this.splitOn;
  }

  setSplitPref(p: SplitPref) {
    this.splitPref = p;
    try {
      localStorage.setItem(SPLIT_KEY, p);
    } catch {
      /* storage unavailable */
    }
    for (const fn of this.viewListeners) fn({ ...this.viewT });
  }

  private setSplitOn(on: boolean) {
    this.splitOn = on;
    this.clearTip();
    if (on && !this.stripEl) {
      this.stripEl = document.createElement('div');
      this.stripEl.className = 'split-strip';
      this.stripEl.setAttribute('aria-hidden', 'true');
      this.container.append(this.stripEl);
    }
    this.stripEl?.toggleAttribute('hidden', !on);
    this.handTop = -1;
    for (const fn of this.viewListeners) fn({ ...this.viewT });
  }

  /** The hand strip in canvas px: from `top` down to `bottom`, the full width. Above the bottom bar. */
  private stripRect(W = this.container.clientWidth || window.innerWidth, H = this.container.clientHeight || window.innerHeight) {
    const bottom = H - Math.min(72, Math.max(52, H * 0.085));
    // Sets or flowers on your ledge make the strip taller (LEDGE_STRIP), so your hand tiles keep their size.
    const h = THREE.MathUtils.clamp(H * 0.26, 110, 240) * (this.ledgeIds.length > 0 ? LEDGE_STRIP : 1);
    return { top: Math.round(bottom - h), bottom: Math.round(bottom), w: W, h: Math.round(h) };
  }

  /** Point the strip's camera at your rack so the whole hand fills the strip. */
  private aimHandCam() {
    const r = this.stripRect();
    const cam = this.handCam;
    cam.aspect = r.w / r.h;
    const xs = this.handXs;
    // Frame at least a full hand's width (13 tiles and their suit gaps), so calling a set never zooms the hand in or out.
    const tw = TW * HAND_SCALE * handTileScale();
    const full = (13 * (tw + 0.012) + 3 * 0.35 * tw) / 2;
    const half = Math.max(full, xs.length ? Math.max(...xs.map(Math.abs)) : 0) + TW * HAND_SCALE * 0.9;
    // Keep clear of the seat plates in the bottom corners on narrower screens.
    const useW = r.w > 900 ? 0.8 : 0.92;
    const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const dH = half / (tanV * cam.aspect * useW);
    // With sets or flowers on your ledge (just in front of the hand), look down more steeply and take in
    // the ledge too, so the standing hand never hides them.
    const ledge = this.ledgeIds.length > 0;
    // The strip is LEDGE_STRIP taller then, and the camera steps back by the same factor: the tiles stay the same size
    // on screen while the strip takes in the ledge too.
    const k = ledge ? LEDGE_STRIP : 1;
    const dV = (0.56 * k) / (tanV * 0.86);
    const d = Math.max(dH, dV);
    const target = TableRenderer.v3b.set(0, ledge ? 0.42 : 0.34, ledge ? HAND_Z - 0.3 : HAND_Z + 0.05);
    const el = THREE.MathUtils.degToRad(ledge ? 56 : 38);
    cam.position.set(0, target.y + Math.sin(el) * d, target.z + Math.cos(el) * d);
    cam.lookAt(target);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  }

  private renderHandStrip() {
    const R = this.renderer;
    const W = this.container.clientWidth || window.innerWidth;
    const H = this.container.clientHeight || window.innerHeight;
    const r = this.stripRect(W, H);
    this.aimHandCam();
    if (this.stripEl) {
      this.stripEl.style.top = `${r.top}px`;
      this.stripEl.style.height = `${r.h}px`;
    }
    const shadows = R.shadowMap.needsUpdate;
    R.shadowMap.needsUpdate = false;
    R.setScissorTest(true);
    R.setScissor(0, H - r.bottom, r.w, r.h);
    R.setViewport(0, H - r.bottom, r.w, r.h);
    R.render(this.scene, this.handCam);
    R.setScissorTest(false);
    R.setViewport(0, 0, W, H);
    R.shadowMap.needsUpdate = shadows;
  }

  /** A world point on screen (client px); tiles in your hand use the strip in split view. */
  private screenOf(p: THREE.Vector3, inHand: boolean) {
    const r = this.renderer.domElement.getBoundingClientRect();
    if (inHand && this.splitOn) {
      const s = this.stripRect();
      const v = TableRenderer.v3b.copy(p).project(this.handCam);
      return { x: r.left + ((v.x + 1) / 2) * s.w, y: r.top + s.top + ((1 - v.y) / 2) * s.h };
    }
    const v = TableRenderer.v3b.copy(p).project(this.camera);
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  }

  private static fitPts: { p: THREE.Vector3; edge: 'top' | 'bottom' | 'side' | 'under' }[] = [];

  /**
   * The closest camera (distance, and how far to slide the focus toward or away
   * from you) that shows the rack across the table below the top name plates,
   * every tile of your hand above the bottom bar, and the side racks on screen,
   * at this elevation and screen shape. Cached until any of those change.
   */
  private fitBoard(phi: number, theta: number, look: THREE.Vector3, split: boolean) {
    const W = Math.max(200, this.container.clientWidth || window.innerWidth);
    const H = Math.max(200, this.container.clientHeight || window.innerHeight);
    // Half the hand's width: at least a full fourteen tiles, in coarse steps so the view doesn't breathe with every draw.
    const xs = this.handXs;
    const actual = xs.length ? Math.max(...xs.map(Math.abs)) + TW * HAND_SCALE * 0.6 : 0;
    const half = Math.ceil(Math.max(3.1, actual) * 4) / 4;
    const key = `${split}|${split && this.ledgeIds.length > 0}|${W}x${H}|${phi.toFixed(3)}|${theta.toFixed(3)}|${look.x.toFixed(2)},${look.y.toFixed(2)},${look.z.toFixed(2)}|${half.toFixed(2)}|${this.camera.fov}`;
    const cache = split ? this.fitSplit : this.fitFull;
    if (key === cache.key) return cache.out;
    cache.key = key;
    const P = TableRenderer.fitPts;
    P.length = 0;
    const add = (x: number, y: number, z: number, edge: 'top' | 'bottom' | 'side' | 'under') => P.push({ p: new THREE.Vector3(x, y, z), edge });
    // The rack across the table and the sets on its shelf.
    const farY = OPP_RACK.stepY + 0.4;
    // Split view comes closer: the far wall (not the rack behind it) stays below the top plates.
    if (split) for (const x of [-2.6, 0, 2.6]) add(x, 0.3, -WALL_Z - TH / 2, 'top');
    else for (const x of [-2.6, 0, 2.6]) add(x, farY, -4.05, 'top');
    if (split) {
      // Your hand (and the sets on your ledge) live in the strip below: your wall must clear the strip's top,
      // and the hand's copy on the board must stay hidden under the strip, so it never shows twice.
      // Your own wall shows in the strip too, so only your discards must stay above it.
      for (const x of [-2.4, 2.4]) add(x, 0.05, RIVER_LIMIT, 'bottom');
      for (const x of [-half, 0, half]) add(x, TH * HAND_SCALE + HAND_RAISE + 0.08, HAND_Z - 0.1, 'under');
      // ...and so must the sets on your ledge, in front of the hand.
      const ledgeHalf = (this.racks.humanLength - 0.3) / 2;
      if (this.ledgeIds.length) for (const x of [-ledgeHalf, 0, ledgeHalf]) add(x, MY_LEDGE.y0 + TH * MY_MELD_SCALE, MY_LEDGE.z0, 'under');
    } else {
      // Your hand: the tops must clear the plates too (low views), the feet the bottom bar.
      for (const x of [-half, half]) {
        add(x, 0.05, HAND_Z + TD * HAND_SCALE, 'bottom');
        add(x, 0.75, HAND_Z, 'side');
      }
    }
    // The side racks just on screen.
    for (const x of [-4.05, 4.05]) for (const z of [-2.2, 2.2]) add(x, 0.4, z, 'side');
    const topLim = 1 - (2 * 78) / H;
    const strip = this.stripRect(W, H);
    // In split view the hand's status line and buttons sit just above the strip: keep your wall clear of them too.
    const botLim = -1 + (2 * (split ? H - strip.top + 14 : 86)) / H;
    const underLim = -1 + (2 * (H - strip.top - 2)) / H;
    const sideLim = 1 - (2 * 8) / W;
    const cam = this.camera;
    const sph = new THREE.Spherical(1, phi, theta);
    const at = new THREE.Vector3();
    const v = new THREE.Vector3();
    // 'under' points (split view: your hand's copy on the board) must end up hidden under the strip. That holds
    // best close in, so each focus first finds its closest framing without them, then keeps it only if they hold.
    const fits = (r: number, dz: number, under = false) => {
      sph.radius = r;
      at.copy(look).z += dz;
      cam.position.setFromSpherical(sph).add(at);
      cam.lookAt(at);
      cam.updateMatrixWorld();
      for (const { p, edge } of P) {
        v.copy(p).project(cam);
        if (edge === 'under') {
          if (under && v.z <= 1 && v.y > underLim) return false;
          continue;
        }
        if (v.z > 1 || Math.abs(v.x) > sideLim) return false;
        if (edge === 'top' && v.y > topLim) return false;
        if (edge === 'bottom' && v.y < botLim) return false;
        if (edge === 'side' && v.y > topLim + 0.08) return false;
      }
      return true;
    };
    let best = { radius: Infinity, dz: 0 };
    let loose = { radius: Infinity, dz: 0 };
    for (let dz = -1.6; dz <= 1.61; dz += 0.2) {
      let lo = 3,
        hi = 60;
      if (!fits(hi, dz)) continue;
      for (let i = 0; i < 16; i++) {
        const mid = (lo + hi) / 2;
        if (fits(mid, dz)) hi = mid;
        else lo = mid;
      }
      const better = (b: { radius: number; dz: number }) => hi < b.radius - 1e-3 || (Math.abs(hi - b.radius) < 1e-3 && Math.abs(dz) < Math.abs(b.dz));
      if (better(loose)) loose = { radius: hi, dz };
      if (fits(hi, dz, true) && better(best)) best = { radius: hi, dz };
    }
    if (!Number.isFinite(best.radius)) best = loose;
    if (!Number.isFinite(best.radius)) best = { radius: 14, dz: 0 };
    // How wide one of your tiles would be on screen at this framing.
    fits(best.radius, best.dz);
    const a = v.set(0, 0.3, HAND_Z).project(cam).x;
    const b = v.set(TW * HAND_SCALE, 0.3, HAND_Z).project(cam).x;
    const out = { ...best, tilePx: Math.abs(b - a) * 0.5 * W };
    cache.out = out;
    return out;
  }

  /**
   * Keep the rack across the table below the name plates at the top and your
   * own rack above the bottom bar, whatever the zoom and tilt: aim further
   * across, and step back when both cannot fit.
   */
  private keepRacksInFrame(s: THREE.Spherical, look: THREE.Vector3) {
    const h = Math.max(200, this.container.clientHeight || window.innerHeight);
    const topLim = 1 - (2 * 58) / h;
    const w = Math.max(200, this.container.clientWidth || window.innerWidth);
    // With your hand in the 2D tray, your own discards must end above the tray and the turn bar (bottomClear).
    const clear = this.tray ? this.bottomClearC : 52;
    const botLim = -1 + (2 * (clear + 6)) / h;
    const nearZ = this.tray ? (this.bottomClearC > 0 ? this.riverEndC : -9) : HAND_Z + 0.4;
    for (let i = 0; i < 40; i++) {
      this.camera.lookAt(look);
      this.camera.updateMatrixWorld();
      // Landscape phones have no height to spare: there the far wall (not the rack behind it) is what must stay below the plates.
      const far = (this.short ? TableRenderer.farRack.set(0, 0.3, -WALL_Z - 0.3) : TableRenderer.farRack.set(0, OPP_RACK.stepY + 0.35, -4.1)).project(this.camera).y;
      const near = TableRenderer.farRack.set(0, 0.05, nearZ).project(this.camera).y;
      let nearest = near,
        sideOk = true;
      // Upright phones: the side players' plates sit on the screen's edges, so the rivers keep out from under them.
      if (this.compact && this.riverEdge.length) {
        const keep = this.keepOut;
        for (const p of this.riverEdge) {
          const v = TableRenderer.farRack.copy(p).project(this.camera);
          nearest = Math.min(nearest, v.y);
          if (!sideOk || !keep.length) continue;
          const px = ((v.x + 1) / 2) * w,
            py = ((1 - v.y) / 2) * h;
          if (keep.some((k) => px > k.l && px < k.r && py > k.t && py < k.b)) sideOk = false;
        }
      }
      if (!sideOk) {
        s.radius *= 1.03;
        this.camera.position.setFromSpherical(s).add(look);
        continue;
      }
      const farOk = far <= topLim,
        nearOk = nearest >= botLim;
      if (farOk && nearOk) return;
      // The far rack too high: turn the focus toward it. Your rack (or river) too low: turn toward you,
      // unless the far rack has no room to give; both at once: step back.
      if (!farOk && nearOk) look.z -= 0.1;
      else if (farOk && !nearOk && far < topLim - 0.04) look.z += 0.1;
      else s.radius *= 1.03;
      this.camera.position.setFromSpherical(s).add(look);
    }
  }

  /**
   * Screen pixels at the bottom taken by your 2D tray, the turn bar and the hint card (phones). Set by the
   * match HUD; the seat view keeps your own discards above it. Eased (bottomClearC) so the view glides.
   */
  private bottomClearT = 0;
  private bottomClearC = 0;
  get bottomClear() {
    return this.bottomClearT;
  }
  set bottomClear(px: number) {
    if (Math.abs(px - this.bottomClearT) < 1) return;
    this.bottomClearT = px;
    this.wake(1500);
  }
  /** Where your own river ends toward you (at least two rows' room); eased in riverEndC as rows are added. */
  private myRiverEnd() {
    if (this.discardLayout === 'centre') return this.compact ? BOARD_NEAR + SPOT_BELOW + 0.1 : BOARD_NEAR;
    const pl = this.lastState?.players[this.humanSeat];
    const n = (pl?.discards.length ?? 0) + (this.discardLayout === 'pond' ? pl?.called?.length ?? 0 : 0);
    const { perRow, ds } = riverFit(n, false);
    return RIVER_NEAR + Math.max(2, Math.ceil(n / perRow)) * (TH * ds + 0.016);
  }
  private riverEndC = 0;

  // ------------------------------------------------------------ picking

  private setPointer(e: { clientX: number; clientY: number }) {
    const r = this.renderer.domElement.getBoundingClientRect();
    if (this.splitOn) {
      // Over the hand strip, pick through the strip's own camera.
      const s = this.stripRect();
      const y = e.clientY - r.top;
      const dragging = this.gesture?.kind === 'drag';
      if (dragging || (y >= s.top && y <= s.bottom)) {
        this.pickCam = this.handCam;
        this.pointer.set(((e.clientX - r.left) / s.w) * 2 - 1, -((y - s.top) / s.h) * 2 + 1);
        return;
      }
    }
    this.pickCam = this.camera;
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  private onPointer(e: PointerEvent | MouseEvent) {
    this.setPointer(e);
    this.setHover(this.pick());
  }

  private pickAmong(ids: Iterable<number>, test: (t: TileObj) => boolean = () => true): number | null {
    this.raycaster.setFromCamera(this.pointer, this.pickCam);
    const objs: THREE.Object3D[] = [];
    for (const id of ids) {
      const t = this.tiles.get(id);
      if (t && t.group.visible && test(t)) objs.push(t.group);
    }
    if (!objs.length) return null;
    const hit = this.raycaster.intersectObjects(objs, true)[0];
    return hit ? (hit.object.userData.tileId as number) : null;
  }

  private pick(): number | null {
    if (!this.interactive.size || this.tray) return null;
    return this.pickAmong(this.interactive);
  }

  /** A tile in your rack (for dragging), whether or not it can be played now. */
  private pickHand(): number | null {
    if (this.tray || !this.handSlots.length) return null;
    return this.pickAmong(
      this.handSlots.map((s) => s.tile.id),
      (t) => t.loc === 'hand',
    );
  }

  /** Any face-up tile you can see (for its name plaque). */
  private pickTip(): number | null {
    return this.pickAmong(this.tiles.keys(), (t) => t.tipOk);
  }

  // ------------------------------------------------------------ gestures

  private onDown(e: PointerEvent) {
    this.suppressClick = false;
    this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.clearTip();
    window.clearTimeout(this.longPress);
    if (this.freeOn) return this.freeDown(e);
    if (this.ptrs.size >= 2) {
      // A second finger: pinch to zoom, move both to tilt and turn.
      if (this.gesture?.kind === 'drag') this.endDrag(false);
      this.gesture = null;
      if (this.viewAdjustable && this.ptrs.size === 2) {
        const [a, b] = [...this.ptrs.values()];
        const { zoom, tilt, pan } = this.viewT;
        this.gesture = { kind: 'pinch', d: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, zoom, tilt, pan };
        this.suppressClick = true;
      }
      return;
    }
    if ((e.button === 2 || (e.button === 0 && e.shiftKey)) && this.viewAdjustable) {
      this.startLook(e.pointerId, e.clientX, e.clientY);
      return;
    }
    if (e.button !== 0) return;
    // No text selection or native drag while pressing on the table.
    if (e.pointerType === 'mouse') e.preventDefault();
    this.setPointer(e);
    const touch = e.pointerType === 'touch';
    this.gesture = { kind: 'press', id: this.pickHand(), pointerId: e.pointerId, x: e.clientX, y: e.clientY, touch };
    if (touch) {
      // A long press names the tile under the finger; a tap still plays as before.
      this.longPress = window.setTimeout(() => {
        const g = this.gesture;
        if (g?.kind !== 'press' || g.pointerId !== e.pointerId) return;
        const at = this.ptrs.get(e.pointerId);
        if (at) this.setPointer({ clientX: at.x, clientY: at.y });
        const id = this.pickTip();
        if (id !== null && this.showTipFor(id)) this.suppressClick = true;
      }, 480);
    }
  }

  private onMove(e: PointerEvent) {
    if (this.ptrs.has(e.pointerId)) this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = this.gesture;
    if (g?.kind === 'free' || g?.kind === 'freePinch') return this.freeMove(e);
    if (g?.kind === 'pinch') {
      if (this.ptrs.size < 2) return;
      const [a, b] = [...this.ptrs.values()];
      const d = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const mx = (a.x + b.x) / 2,
        my = (a.y + b.y) / 2;
      this.setTableView({ zoom: g.zoom * (d / g.d), ...this.lookFrom(g, mx - g.mx, my - g.my) });
      return;
    }
    if (g?.kind === 'look') {
      if (e.pointerId !== g.pointerId) return;
      const dx = e.clientX - g.x,
        dy = e.clientY - g.y;
      if (Math.hypot(dx, dy) > 3) g.moved = this.suppressClick = true;
      this.setTableView(this.lookFrom(g, dx, dy));
      return;
    }
    if (g?.kind === 'drag') {
      if (e.pointerId === g.pointerId) this.updateDrag(e);
      return;
    }
    if (g?.kind === 'press' && e.pointerId === g.pointerId) {
      const dx = e.clientX - g.x,
        dy = e.clientY - g.y;
      if (Math.hypot(dx, dy) > DRAG_PX) {
        window.clearTimeout(this.longPress);
        if (g.id !== null && Math.abs(dx) >= Math.abs(dy) * 0.8 && !(g.touch && this.tipShown)) {
          this.startDrag(g.id, g.pointerId);
          this.updateDrag(e);
          return;
        }
        // Anything else dragged across the table moves the camera: up and down tilts, left and right slides.
        if (this.viewAdjustable && !(g.touch && this.tipShown)) {
          this.startLook(g.pointerId, g.x, g.y);
          this.onMove(e);
          return;
        }
        this.gesture = null;
      }
    }
    if (e.pointerType === 'touch') return;
    this.onPointer(e);
    if (g?.kind === 'press') return;
    // Tiles you cannot play now can still be dragged into a new place.
    if (this.hoverId === null) this.renderer.domElement.style.cursor = this.viewAdjustable || (this.handSlots.length && this.pickHand() !== null) ? 'grab' : 'default';
    this.updateTipHover();
  }

  private onUp(e: PointerEvent, cancel = false) {
    this.ptrs.delete(e.pointerId);
    window.clearTimeout(this.longPress);
    const g = this.gesture;
    if (g?.kind === 'drag' && g.pointerId === e.pointerId) this.endDrag(!cancel);
    else if ((g?.kind === 'free' && g.pointerId === e.pointerId) || (g?.kind === 'freePinch' && this.ptrs.size < 2)) {
      this.gesture = null;
      this.renderer.domElement.style.cursor = 'grab';
    } else if (g?.kind === 'look' && g.pointerId === e.pointerId) {
      this.gesture = null;
      this.renderer.domElement.style.cursor = this.viewAdjustable ? 'grab' : 'default';
    }
    else if (g?.kind === 'pinch') {
      if (this.ptrs.size < 2) this.gesture = null;
    } else if (g?.kind === 'press' && g.pointerId === e.pointerId) this.gesture = null;
    if (e.pointerType === 'touch' && this.tipShown) {
      window.clearTimeout(this.tipHide);
      this.tipHide = window.setTimeout(() => this.clearTip(), 1600);
    }
  }

  private onWheel(e: WheelEvent) {
    if (this.freeOn) {
      e.preventDefault();
      const d = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 800 : e.deltaY;
      const g = this.takeFree();
      g.dist = THREE.MathUtils.clamp(g.dist * Math.exp(d * (e.ctrlKey ? 0.01 : 0.0012)), FREE_DIST_MIN, FREE_DIST_MAX);
      return;
    }
    if (!this.viewAdjustable) return;
    e.preventDefault();
    this.clearTip();
    // Trackpad pinches arrive as ctrl+wheel with small deltas.
    // Wheel steps in pixels: Firefox counts lines (about 3 a notch), where Chrome and Safari send about 100 px.
    const d = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 800 : e.deltaY;
    this.setZoom(this.viewT.zoom * Math.exp(-d * (e.ctrlKey ? 0.01 : 0.0012)));
  }

  // ------------------------------------------------------------ free camera (after a hand)

  /** While a hand's result is up, the player can move the camera anywhere around the table to see every hand. */
  private freeOn = false;
  /** Where the player has the free camera now, and where it is easing to. Null until they take it (drag, wheel or a key). */
  private freeCur: FreePose | null = null;
  private freeGoal: FreePose | null = null;
  private freeKeys = new Set<string>();
  private static freeSph = new THREE.Spherical();

  /**
   * Turn the free camera on (a hand has ended) or off. Until the player
   * moves it, the table keeps its own framing (the win shot, View in All hands).
   * Drag to circle the table, right-drag, Shift+drag or two fingers to slide,
   * pinch or scroll to zoom; WASD or the arrow keys move, Q and E turn, R resets.
   */
  setFreeCamera(on: boolean) {
    if (on === this.freeOn) return;
    this.freeOn = on;
    this.freeKeys.clear();
    if (this.gesture?.kind === 'free' || this.gesture?.kind === 'freePinch') this.gesture = null;
    if (!on) this.releaseFree();
    this.renderer.domElement.style.cursor = on ? 'grab' : 'default';
  }

  /** True while the free camera is on (after a hand). */
  get freeCamera() {
    return this.freeOn;
  }

  /** Called the first time the player moves the free camera after it turns on or is reset. */
  onFreeMove?: () => void;
  /** Whether the keys may steer the free camera now (false while a panel covers the table and the arrows should scroll it). */
  freeKeysAllowed?: () => boolean;

  /** Take the camera from the table's framing, starting exactly where it is now. */
  private takeFree(): FreePose {
    if (this.freeGoal) return this.freeGoal;
    const pos = this.camera.position;
    const dir = this.camera.getWorldDirection(new THREE.Vector3());
    // Circle the point on the table the camera is looking at.
    const t = dir.y < -0.05 ? THREE.MathUtils.clamp((FREE_LOOK_Y - pos.y) / dir.y, FREE_DIST_MIN, FREE_DIST_MAX) : 8;
    const target = pos.clone().addScaledVector(dir, t);
    target.y = FREE_LOOK_Y;
    const s = TableRenderer.freeSph.setFromVector3(pos.clone().sub(target));
    const pose = { target, theta: s.theta, phi: THREE.MathUtils.clamp(s.phi, FREE_PHI_MIN, FREE_PHI_MAX), dist: THREE.MathUtils.clamp(s.radius, FREE_DIST_MIN, FREE_DIST_MAX) };
    this.freeCur = { ...pose, target: target.clone() };
    this.freeGoal = { ...pose, target: target.clone() };
    // A glide still under way stops here; the player has the camera now.
    this.camT = 1;
    this.clearTip();
    this.onFreeMove?.();
    return this.freeGoal;
  }

  /**
   * Hand the camera back to the table's framing. The framing glides on from
   * where the player left the camera (to the last shot, or the new one setView
   * is about to set up).
   */
  private releaseFree() {
    if (!this.freeCur) return;
    this.camBase.copy(this.camera.position);
    this.camLook.copy(this.freeCur.target);
    this.freeCur = this.freeGoal = null;
    this.camFrom.pos.copy(this.camBase);
    this.camFrom.look.copy(this.camLook);
    this.camT = 0;
    this.camStart = this.clock.getElapsedTime();
    this.camDur = this.reducedMotion ? 0.01 : 0.9;
  }

  /** The free camera is easing or a key is held. */
  private freeMoving() {
    const c = this.freeCur,
      g = this.freeGoal;
    if (!c || !g) return false;
    return this.freeKeys.size > 0 || Math.abs(c.theta - g.theta) + Math.abs(c.phi - g.phi) + Math.abs(c.dist - g.dist) + c.target.distanceTo(g.target) > 1e-3;
  }

  private freeDown(e: PointerEvent) {
    if (this.gesture?.kind === 'drag') this.endDrag(false);
    if (this.ptrs.size >= 2) {
      const [a, b] = [...this.ptrs.values()];
      const g = this.takeFree();
      this.gesture = { kind: 'freePinch', d: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, from: { ...g, target: g.target.clone() } };
      this.suppressClick = true;
      return;
    }
    if (e.button !== 0 && e.button !== 2) return;
    if (e.pointerType === 'mouse') e.preventDefault();
    // A click without a drag still names the tile under the pointer; the camera is taken once the pointer moves.
    this.gesture = { kind: 'free', pointerId: e.pointerId, x: e.clientX, y: e.clientY, slide: e.button === 2 || e.shiftKey, from: null };
    try {
      this.renderer.domElement.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  private freeMove(e: PointerEvent) {
    const g = this.gesture;
    const r = this.renderer.domElement.getBoundingClientRect();
    const h = Math.max(240, r.height);
    if (g?.kind === 'freePinch') {
      if (this.ptrs.size < 2) return;
      const [a, b] = [...this.ptrs.values()];
      const d = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const goal = this.takeFree();
      goal.dist = THREE.MathUtils.clamp(g.from.dist * (g.d / d), FREE_DIST_MIN, FREE_DIST_MAX);
      // Both fingers moving together slide the view.
      this.slideFree(goal, g.from, (a.x + b.x) / 2 - g.mx, (a.y + b.y) / 2 - g.my, h);
      return;
    }
    if (g?.kind !== 'free' || e.pointerId !== g.pointerId) return;
    const dx = e.clientX - g.x,
      dy = e.clientY - g.y;
    if (!g.from) {
      if (Math.hypot(dx, dy) <= DRAG_PX) return;
      const p = this.takeFree();
      g.from = { ...p, target: p.target.clone() };
      this.suppressClick = true;
      this.setHover(null);
      this.renderer.domElement.style.cursor = 'grabbing';
    }
    const goal = this.freeGoal!;
    if (g.slide) {
      this.slideFree(goal, g.from, dx, dy, h);
      return;
    }
    // Drag sideways to circle the table, up and down to look from higher or lower.
    goal.theta = g.from.theta - (dx / h) * Math.PI * 1.4;
    goal.phi = THREE.MathUtils.clamp(g.from.phi - (dy / h) * Math.PI * 0.9, FREE_PHI_MIN, FREE_PHI_MAX);
  }

  /** Slide the point the free camera circles so the table follows the pointer. */
  private slideFree(goal: FreePose, from: FreePose, dx: number, dy: number, h: number) {
    const perPx = (2 * from.dist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) / h;
    const fwd = TableRenderer.v3.set(-Math.sin(from.theta), 0, -Math.cos(from.theta));
    const right = TableRenderer.v3b.set(Math.cos(from.theta), 0, -Math.sin(from.theta));
    // Looking straight down, dragging up the screen moves along the table; from low down it moves further.
    const along = 1 / Math.max(0.35, Math.cos(from.phi));
    goal.target.copy(from.target).addScaledVector(right, -dx * perPx).addScaledVector(fwd, dy * perPx * along);
    this.clampFreeTarget(goal.target);
  }

  private clampFreeTarget(t: THREE.Vector3) {
    t.y = FREE_LOOK_Y;
    const r = Math.hypot(t.x, t.z);
    if (r > FREE_REACH) t.multiplyScalar(FREE_REACH / r).setY(FREE_LOOK_Y);
  }

  private onFreeKey(e: KeyboardEvent, down: boolean) {
    if (!down) {
      this.freeKeys.delete(e.code);
      if (e.key === 'Shift') this.freeKeys.delete('Shift');
      return;
    }
    if (!this.freeOn || e.ctrlKey || e.metaKey || e.altKey) return;
    const tgt = e.target as HTMLElement | null;
    if (tgt?.closest?.('input, select, textarea, [contenteditable]')) return;
    const modal = document.getElementById('modal');
    if ((modal && !modal.hidden) || this.freeKeysAllowed?.() === false) return;
    if (e.key === 'Shift') {
      this.freeKeys.add('Shift');
      return;
    }
    if (e.code === 'KeyR' || e.code === 'Home') {
      e.preventDefault();
      // Back to the table's own framing.
      this.releaseFree();
      return;
    }
    if (!FREE_KEYS[e.code]) return;
    e.preventDefault();
    this.takeFree();
    this.freeKeys.add(e.code);
    this.wake(300);
  }

  /** Ease the free camera toward where the player is steering it, and place the camera there. */
  private applyFree(dt: number) {
    const c = this.freeCur!,
      g = this.freeGoal!;
    if (this.freeKeys.size) {
      let f = 0,
        r = 0,
        turn = 0,
        zoom = 0;
      for (const k of this.freeKeys) {
        const m = FREE_KEYS[k];
        if (!m) continue;
        f += m[0];
        r += m[1];
        turn += m[2];
        zoom += m[3];
      }
      const fast = this.freeKeys.has('Shift') ? 2.2 : 1;
      // Further out moves faster, so crossing the table takes about the same time at any zoom.
      const step = dt * (1.6 + g.dist * 0.32) * fast;
      g.target.x += (-Math.sin(g.theta) * f + Math.cos(g.theta) * r) * step;
      g.target.z += (-Math.cos(g.theta) * f - Math.sin(g.theta) * r) * step;
      this.clampFreeTarget(g.target);
      g.theta += turn * dt * 1.5 * fast;
      g.dist = THREE.MathUtils.clamp(g.dist * Math.exp(-zoom * dt * 1.2 * fast), FREE_DIST_MIN, FREE_DIST_MAX);
    }
    const k = this.reducedMotion ? 1 : 1 - Math.exp(-dt * 10);
    c.theta += (g.theta - c.theta) * k;
    c.phi += (g.phi - c.phi) * k;
    c.dist += (g.dist - c.dist) * k;
    c.target.lerp(g.target, k);
    const s = TableRenderer.freeSph.set(c.dist, c.phi, c.theta);
    this.camera.position.setFromSpherical(s).add(c.target);
    this.camera.lookAt(c.target);
  }

  /** Start moving the camera with one pointer (mouse drag, one finger, right-drag or Shift+drag). */
  private startLook(pointerId: number, x: number, y: number) {
    this.gesture = { kind: 'look', pointerId, x, y, tilt: this.viewT.tilt, pan: this.viewT.pan, moved: false };
    this.clearTip();
    this.setHover(null);
    this.renderer.domElement.style.cursor = 'grabbing';
    try {
      this.renderer.domElement.setPointerCapture(pointerId);
    } catch {
      /* ignore */
    }
  }

  /**
   * The view after dragging dx, dy pixels from where a gesture began. Dragging
   * down looks more from above; the table follows the pointer sideways, up to
   * PAN_SHARE of the view's width either way.
   */
  private lookFrom(g: { tilt: number; pan: number }, dx: number, dy: number): Partial<TableView> {
    const r = this.renderer.domElement.getBoundingClientRect();
    const h = Math.max(240, r.height),
      w = Math.max(240, r.width);
    return { tilt: g.tilt + (dy / h) * 3.2, pan: g.pan - dx / (w * PAN_SHARE * 1.6) };
  }

  private startDrag(id: number, pointerId: number) {
    this.gesture = { kind: 'drag', id, pointerId };
    this.suppressClick = true;
    this.clearTip();
    try {
      this.renderer.domElement.setPointerCapture(pointerId);
    } catch {
      /* ignore */
    }
    this.renderer.domElement.style.cursor = 'grabbing';
    const i = this.handSlots.findIndex((s) => s.tile.id === id);
    this.dragX = this.handXs[i] ?? 0;
    this.dragIndex = i;
  }

  private static plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.3);

  private updateDrag(e: PointerEvent) {
    const g = this.gesture;
    if (g?.kind !== 'drag') return;
    this.setPointer(e);
    this.raycaster.setFromCamera(this.pointer, this.pickCam);
    const hit = this.raycaster.ray.intersectPlane(TableRenderer.plane, new THREE.Vector3());
    if (!hit) return;
    // Into your seat's frame (identity unless you sit elsewhere).
    hit.applyQuaternion(this.seatQuat(this.humanSeat).invert());
    const xs = this.handXs;
    const lo = Math.min(...xs) - TW,
      hi = Math.max(...xs) + TW;
    this.dragX = THREE.MathUtils.clamp(hit.x, lo, hi);
    let idx = 0;
    this.handSlots.forEach((s, i) => {
      if (s.tile.id !== g.id && xs[i] < this.dragX) idx++;
    });
    this.dragIndex = idx;
    this.relayout();
  }

  private endDrag(commit: boolean) {
    const g = this.gesture;
    if (g?.kind !== 'drag') return;
    this.gesture = null;
    this.renderer.domElement.style.cursor = 'default';
    if (commit && this.dragIndex >= 0) {
      const before = this.handSlots.map((s) => s.tile.id);
      const ids = moveTile(this.handSlots, g.id, this.dragIndex);
      if (ids.some((id, i) => id !== before[i])) {
        this.handLayout.custom = ids;
        this.onReorder?.(ids);
      }
    }
    this.dragIndex = -1;
    this.relayout();
  }

  /** Re-run the last layout (e.g. after changing handLayout, hint or selection). */
  relayout() {
    if (this.lastState) this.layout(this.lastState, this.lastOpts, true);
  }

  // ------------------------------------------------------------ tile names

  private updateTipHover() {
    if (this.gesture && this.gesture.kind !== 'press') return;
    const id = this.pickTip();
    if (id === this.tipId) return;
    this.clearTip();
    this.tipId = id;
    if (id === null) return;
    // Wait out a hover lift or a slide before reading the tile's place on screen.
    const tryShow = () => {
      if (this.tipId === id && !this.showTipFor(id) && this.tiles.get(id)?.tween) this.tipTimer = window.setTimeout(tryShow, 120);
    };
    this.tipTimer = window.setTimeout(tryShow, 250);
  }

  private showTipFor(id: number): boolean {
    const t = this.tiles.get(id);
    if (!t || !t.tipOk || t.tween || !t.group.visible) return false;
    const box = new THREE.Box3().setFromObject(t.group);
    const inHand = this.handSlots.some((sl) => sl.tile.id === id);
    let top = Infinity,
      sx = 0;
    for (let i = 0; i < 8; i++) {
      const v = this.screenOf(new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z), inHand);
      top = Math.min(top, v.y);
      sx += v.x;
    }
    showTile(t.kind, sx / 8, top, { red: t.red, labels: this.labels, note: this.tipNote?.(id, t.kind) });
    this.tipId = id;
    this.tipShown = true;
    return true;
  }

  private clearTip() {
    window.clearTimeout(this.tipTimer);
    window.clearTimeout(this.tipHide);
    if (this.tipShown) hideTip();
    this.tipShown = false;
    this.tipId = null;
  }

  private setHover(id: number | null) {
    if (id === this.hoverId) return;
    for (const h of [this.hoverId, id]) if (h !== null) this.hoverTweens.add(h);
    this.hoverId = id;
    this.renderer.domElement.style.cursor = id !== null ? 'pointer' : 'default';
    this.onHover?.(id);
    if (this.lastState) this.layout(this.lastState, this.lastOpts, true);
  }

  // ------------------------------------------------------------ layout

  /** Landing: tiles tumble face down in the middle of the table. */
  /**
   * The automatic table between hands: everything on the felt is swept into the
   * centre and washed, and the walls `state` describes rise from the slots.
   * Returns how long it runs (ms); the deal should wait for it.
   */
  machineShuffle(state: GameState): number {
    if (this.reducedMotion || this.speed === 'minimal') {
      this.machine.stop();
      this.layout(state, {}, false);
      return 500;
    }
    const before = this.onTable();
    this.layout(state, {}, true);
    return this.runMachine(before, this.speed === 'cinematic' ? 1.3 : 1);
  }

  /** The landing loop: the table shuffles itself and builds a fresh set of walls. */
  private ambientShuffle() {
    const before = this.onTable();
    const now = this.clock.getElapsedTime();
    const ids = [...this.tiles.keys()].filter((id) => id < 136);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    ids.forEach((id, i) => this.moveTo(this.tiles.get(id)!, this.wallPose(i, 0), 'wall', now, 0.01, 0));
    for (const t of this.tiles.values()) if (t.id >= 136) this.moveTo(t, { pos: new THREE.Vector3(0, -1, 0), quat: new THREE.Quaternion(), scale: 0.001 }, 'hidden', now, 0.01, 0);
    const ms = this.runMachine(before, 1);
    this.ambientBuildAt = now + ms / 1000 - 0.95;
  }

  private ambientBuildAt = -1;

  /** Tiles showing on the table right now. */
  private onTable() {
    return new Set([...this.tiles.values()].filter((t) => t.group.visible && t.group.scale.x > 0.01).map((t) => t.id));
  }

  /**
   * Moves every tile along the machine's timeline toward the target `layout`
   * (or the landing loop) gave it: tiles that were showing are swept into the
   * opening and sink; wall tiles rise from under their slot, a side at a time.
   */
  private runMachine(before: Set<number>, k: number): number {
    const now = this.clock.getElapsedTime();
    const tl = this.machine.start(now, k);
    const below = new THREE.Vector3(0, -0.5, 0);
    for (const t of this.tiles.values()) {
      const target = t.target;
      if (!target) continue;
      const g = t.group;
      const legs: Tween[] = [];
      let at = now;
      if (before.has(t.id)) {
        const r = Math.random();
        const gt = tl.gather(r);
        const p = ShuffleMachine.holePoint(Math.random);
        const q = g.quaternion.clone();
        legs.push({ from: null, to: { pos: p, quat: q, scale: g.scale.x }, t0: gt.t0, dur: gt.dur, arc: 0.18 });
        legs.push({ from: null, to: { pos: p.clone().add(below), quat: q, scale: g.scale.x * 0.7 }, t0: gt.t0 + gt.dur, dur: gt.sinkDur, arc: 0 });
        at = gt.t0 + gt.dur + gt.sinkDur;
      } else {
        // Not on the table: stays out of sight until its wall rises.
        g.position.set(0, -1, 0);
        g.scale.setScalar(0.001);
        g.visible = false;
      }
      if (t.loc === 'wall') {
        const side = Math.abs(target.pos.x) > Math.abs(target.pos.z) ? (target.pos.x > 0 ? 1 : 3) : target.pos.z > 0 ? 0 : 2;
        const rise = tl.rise(side);
        legs.push({ from: { pos: target.pos.clone().add(below), quat: target.quat.clone(), scale: target.scale }, to: target, t0: Math.max(at, rise.t0), dur: rise.dur, arc: 0 });
      } else legs.push({ from: null, to: target, t0: at, dur: 0.011, arc: 0 });
      for (let i = 0; i < legs.length - 1; i++) legs[i].next = legs[i + 1];
      t.tween = legs[0];
    }
    return tl.total * 1000;
  }

  private seatQuat(seat: number) {
    return this.quadQuat(this.quad(seat));
  }

  private quadQuat(quadrant: number) {
    return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (quadrant * Math.PI) / 2);
  }

  private place(seat: number, local: THREE.Vector3, localQuat: THREE.Quaternion, scale = 1): Pose {
    return this.placeQuad(this.quad(seat), local, localQuat, scale);
  }

  private placeQuad(quadrant: number, local: THREE.Vector3, localQuat: THREE.Quaternion, scale = 1): Pose {
    const q = this.quadQuat(quadrant);
    return { pos: local.clone().applyQuaternion(q), quat: q.clone().multiply(localQuat), scale };
  }

  private wallPose(index: number, dealer: number, total = 136, start = 0, inward = 0): Pose {
    // Four walls of two-high stacks: 17 stacks a side for 136 tiles, 18 for 144.
    const perSide = Math.ceil(total / 8);
    // Ring position: `start` stacks clockwise from the right-hand end of the dealer's wall, where
    // East's throw broke it (engine/opening.ts); the live wall runs clockwise from there.
    const stack = (Math.floor(index / 2) + start) % (perSide * 4);
    const level = index % 2;
    // Always four walls, running clockwise from the dealer's (each wall from its owner's right
    // to left, then on to the wall of the player on their left); a three-seat table keeps a wall
    // in front of the empty seat too.
    const side = Math.floor(stack / perSide) % 4;
    const quadrant = (this.quad(dealer) - side + 4) % 4;
    const x = ((perSide - 1) / 2) * TW - (stack % perSide) * TW;
    const z = Math.max(WALL_Z, (perSide / 2) * TW + 0.12) - inward;
    return this.placeQuad(quadrant, new THREE.Vector3(x, level === 0 ? TD * 1.5 : TD * 0.5, z), qFromEuler(Math.PI / 2, 0, 0));
  }

  /**
   * The wall is broken (East has thrown): the marked section at the back (flower wall, dead wall,
   * loose tiles) steps in from the ring and the markers show. Off while the walls rise for a new
   * hand, until the opening's break (TableRenderer.breakWall).
   */
  wallOpen = true;
  /** The front and back markers show (the opening, until the deal). */
  wallEnds = false;

  /** Wall slots for this hand's marks: the first live tile, the last of the main wall, and the marked section. */
  private wallMarkPoses(state: GameState) {
    const wb = state.wallBreak;
    const L = state.wall.length;
    if (!wb || !L) return null;
    const dealer = state.round.dealerSeat;
    const seg = Math.min(wb.segTiles || 4, L - 2);
    const top = (i: number) => {
      const p = this.wallPose(i - (i % 2), dealer, L, wb.start, i >= L - seg ? SEG_IN : 0);
      return p.pos.clone().setY(TD * 2);
    };
    const live = [state.drawnFromFront, L - state.drawnFromBack];
    // The section's token sits on its stack farthest from the break (drawn last).
    const segFrom = Math.max(L - seg, live[0]);
    return {
      front: top(Math.min(live[0], L - 1)),
      back: top(Math.max(0, L - seg - 1)),
      seg: wb.segTiles && segFrom < live[1] ? top(segFrom) : null,
      segMid: top(L - Math.ceil(seg / 2)),
      quat: this.wallPose(0, dealer, L, wb.start).quat,
    };
  }

  /** Screen points (client px) of this hand's wall marks, for the opening's labels. */
  wallMarkPoints() {
    const st = this.lastState;
    const m = st && this.wallMarkPoses(st);
    if (!m) return null;
    return { front: this.screenOf(m.front, false), back: this.screenOf(m.back, false), seg: this.screenOf(m.segMid, false), centre: this.screenOf(new THREE.Vector3(), false) };
  }

  private openingWide = false;
  /** Portrait phones frame the rivers; through the opening they step back to show the whole wall. */
  setOpeningWide(on: boolean) {
    if (on === this.openingWide) return;
    this.openingWide = on;
    if (this.compact && this.view === 'seat') this.setView('seat', 0.8);
  }

  /**
   * The opening's count along the broken wall: stack `k` (1 = the right-hand end of the wall being
   * broken) lifts and settles. Returns where its top is on screen, for the count's number.
   */
  countStack(k: number) {
    const st = this.lastState;
    const wb = st?.wallBreak;
    if (!st || !wb || !st.wall.length) return null;
    const L = st.wall.length;
    const ring = Math.ceil(L / 8) * 4;
    const dealer = st.round.dealerSeat;
    const off = (((k - 1 - wb.count) % ring) + ring) % ring;
    const now = this.clock.getElapsedTime();
    let top: THREE.Vector3 | null = null;
    for (const i of [off * 2, off * 2 + 1]) {
      if (i >= L) continue;
      const t = this.tiles.get(st.wall[i].id);
      if (!t || t.loc !== 'wall') continue;
      const pose = this.wallPose(i, dealer, L, wb.start);
      const up = { ...pose, pos: pose.pos.clone().setY(pose.pos.y + 0.09) };
      t.tween = { from: null, to: up, t0: now, dur: 0.12, arc: 0, next: { from: null, to: pose, t0: now + 0.3, dur: 0.16, arc: 0 } };
      if (!top || pose.pos.y > top.y) top = pose.pos.clone().setY(TD * 2 + 0.09);
    }
    this.wake(700);
    return top ? this.screenOf(top, false) : null;
  }

  /** East's throw has landed: open the wall at the break and set the markers. */
  breakWall(slow = false) {
    const was = this.wallOpen;
    this.wallOpen = true;
    this.wallEnds = true;
    if (!this.lastState) return;
    this.layout(this.lastState, this.lastOpts);
    // The opening's break: the section at the back slides out of the wall unhurried.
    if (slow && !was)
      for (const t of this.tiles.values()) if (t.loc === 'wall' && t.tween && !t.tween.next) t.tween.dur = Math.max(t.tween.dur, 0.85);
  }

  layout(state: GameState, opts: LayoutOptions = {}, quick = false) {
    this.lastState = state;
    this.lastOpts = opts;
    // A quick relayout (hover, drag step) keeps the frame rate up without counting as motion; a full
    // one moves tiles for real, so hover lifts stop being treated as calm.
    if (quick) this.hoverWake(1500);
    else {
      this.wake(1500);
      this.hoverTweens.clear();
    }
    window.setTimeout(() => this.queueHandFaces(), 0);
    // A new hand: make sure every shader is ready before tiles start moving (cheap when nothing is new),
    // and the 2D face images the HUD shows on each discard are drawn while the table is idle.
    if (opts.dealing) {
      this.prewarm();
      warmFaceUrls(this.labels);
    }
    const now = this.clock.getElapsedTime();
    const base = (quick ? 0.09 : SPEED[this.speed]) * devAnimScale();
    const placed = new Set<number>();
    const n = state.players.length;
    this.seatCount = n;
    const dealer = state.round.dealerSeat;

    for (const t of this.tiles.values()) t.tipOk = false;
    let drawnMark = -1;
    // Racks stand at the occupied seats; yours hides while your hand lives in the 2D tray.
    const occupied = [false, false, false, false];
    for (let seat = 0; seat < n; seat++) occupied[this.quad(seat)] = true;
    this.racks.setVisible(occupied, !this.tray);

    // Wall
    const liveStart = state.drawnFromFront;
    const liveEnd = state.wall.length - state.drawnFromBack;
    const doraAt = new Set(Array.from({ length: state.doraRevealed ?? 0 }, (_, i) => state.wall.length - 6 - 2 * i));
    const wb = state.wallBreak;
    const segFrom = wb && this.wallOpen ? state.wall.length - (wb.segTiles || 4) : Infinity;
    for (let i = liveStart; i < liveEnd; i++) {
      const t = this.tiles.get(state.wall[i].id)!;
      const pose = this.wallPose(i, dealer, state.wall.length, wb?.start ?? 0, i >= segFrom ? SEG_IN : 0);
      // Dora indicators sit face up on top of the dead wall.
      if (doraAt.has(i)) pose.quat.multiply(qFromEuler(Math.PI, 0, 0));
      this.moveTo(t, pose, 'wall', now, base, 0);
      t.tipOk = doraAt.has(i);
      placed.add(t.id);
    }

    // The wall's marks: front and back through the opening, the marked section for the hand.
    const wm = this.wallOpen ? this.wallMarkPoses(state) : null;
    this.wallMarks.set('front', this.wallEnds && wm ? wm.front : null, now);
    this.wallMarks.set('back', this.wallEnds && wm ? wm.back : null, now);
    this.wallMarks.set('seg', wm?.seg ?? null, now);

    const phase = state.phase;
    const drawnId = phase.kind === 'turn' && phase.drawn ? phase.drawn.id : -1;
    const reveal = new Set([...(opts.reveal ?? []), ...devRevealAll(n)]);
    let lastDiscard: THREE.Vector3 | null = null;
    // The most recent discard still lying in a river gets a glow and a marker.
    let lastDiscardId = -1;
    for (let i = state.log.length - 1; i >= 0; i--) {
      const e = state.log[i];
      if (e.type === 'discard') {
        lastDiscardId = e.tile.id;
        break;
      }
    }
    if (phase.kind === 'handOver') lastDiscardId = -1;
    this.lastDiscardId = lastDiscardId;
    const mode = this.discardLayout;
    const centre: { tile: Tile; seat: number }[] = [];
    const redIds = new Set((state as { red?: number[] }).red ?? []);
    this.marks.begin();
    let riverReach = 0;
    const riverCorners: THREE.Vector3[] = [];

    for (let seat = 0; seat < n; seat++) {
      const pl = state.players[seat];
      const human = seat === this.humanSeat && !this.watchOnly;
      const shown = reveal.has(seat);

      // Hand. Yours follows your layout (sort, own order, set gaps); the freshly
      // drawn tile sits in its sorted place and is marked rather than set apart.
      const scale = human ? (this.tray ? 1 : HAND_SCALE * handTileScale()) : 1;
      const step = TW * scale + 0.012;
      const winSets = shown && opts.winner === seat ? opts.winSets : undefined;
      const slots: HandSlot[] = winSets
        ? winHandSlots(pl.hand, winSets)
        : human
        ? arrangeHand(pl.hand, this.handLayout)
        : [...pl.hand].sort(compareTiles('suit')).map((tile) => ({ tile, gap: 0 as const, set: -1 }));
      const xs: number[] = [];
      let cx = 0;
      slots.forEach((sl, i) => {
        if (i > 0) cx += step + (sl.gap === 2 ? 0.6 : sl.gap === 1 ? 0.35 : 0) * TW * scale;
        xs.push(cx);
      });
      const mid = slots.length ? cx / 2 : 0;
      for (let i = 0; i < xs.length; i++) xs[i] -= mid;
      const rack = human && !shown && !this.tray;
      const rel = this.quad(seat);
      if (rel === 0 && !this.tray) this.racks.fitHuman({ scale: human ? scale : HAND_SCALE, z: HAND_Z, tw: TW, th: TH, td: TD }, Math.max(xs.length ? xs[xs.length - 1] - xs[0] : 0, 12 * TW * HAND_SCALE) + TW * (human ? scale : HAND_SCALE));
      // Revealed opponent hands lie face up on their rack's step, side by side, turned to face the table.
      const flatStep = TW + 0.012;
      // In the deal a flower lands at the end of its player's rack like any dealt tile, then, once the deal is
      // done, is set aside to that player's ledge or shelf (the replacement draw is already in the hand).
      let flowerK = 0;
      const setAside = (t: TileObj, pose: Pose) => {
        const inDeal = opts.dealing && !quick && this.speed !== 'minimal' && t.loc !== 'meld' && !(rel === 0 && this.tray);
        if (!inDeal) return this.moveTo(t, pose, 'meld', now, base, 0.15);
        const k = flowerK++;
        const end = (xs.length ? xs[xs.length - 1] : 0) + (k + 1) * step + 0.06;
        const onRack =
          rel === 0
            ? this.place(seat, new THREE.Vector3(end, (TH * scale) / 2 + 0.03 + HAND_RAISE, HAND_Z), qFromEuler(-HAND_LEAN, 0, 0), scale)
            : this.place(seat, new THREE.Vector3(end, OPP_RACK.stepY + TH / 2 + 0.004, OPP_RACK.handZ), new THREE.Quaternion(), 1);
        this.moveTo(t, onRack, 'meld', now + 0.9 + k * 0.12, base, 0.2);
        const leg: Tween = { from: null, to: pose, t0: now + FLOWER_ASIDE_AT + k * 0.18, dur: Math.max(base, 0.45), arc: 0.18 };
        if (t.tween) t.tween.next = leg;
        else t.tween = leg;
        t.target = pose;
      };
      if (human) {
        this.handSlots = rack ? slots : [];
        this.handXs = rack ? xs.slice() : [];
        if (rack && pl.hand.some((h) => h.id === drawnId)) drawnMark = drawnId;
      }
      // While you drag a tile, the others close up around a space where it would land.
      const drag = rack && this.gesture?.kind === 'drag' ? this.gesture.id : -1;
      const dragXs = xs.slice();
      if (drag >= 0 && this.dragIndex >= 0) {
        const from = slots.findIndex((sl) => sl.tile.id === drag);
        if (from < 0) this.gesture = null;
        else {
          const others = slots.map((_, i) => i).filter((i) => i !== from);
          // Others keep their resting x, shifted to open a space of one tile at the drop index.
          others.forEach((si, k) => (dragXs[si] = xs[si] + (si > from ? -step : 0) + (k >= this.dragIndex ? step : 0)));
          dragXs[from] = this.dragX;
        }
      }
      slots.forEach((sl, i) => {
        const tile = sl.tile;
        const t = this.tiles.get(tile.id)!;
        const x = drag >= 0 ? dragXs[i] : xs[i];
        let pose: Pose;
        if (human && !shown) {
          const dragging = tile.id === drag;
          const lift = dragging ? 0.26 : tile.id === this.selectedId || this.selectedIds.has(tile.id) ? 0.2 : tile.id === this.hoverId && drag < 0 ? 0.09 : tile.kind === this.hintKind ? 0.05 : 0;
          if (this.tray) {
            pose = this.place(seat, new THREE.Vector3(x, -3, 6), new THREE.Quaternion(), 0.001);
          } else {
            pose = this.place(seat, new THREE.Vector3(x, (TH * scale) / 2 + 0.03 + HAND_RAISE + lift, HAND_Z - lift * 0.3), qFromEuler(-HAND_LEAN, 0, 0), scale);
          }
          t.tipOk = !this.tray;
        } else if (shown) {
          const lifted = opts.winner === seat && opts.winLift;
          const rise = opts.winner === seat ? (lifted ? 0.34 : 0.12) : 0;
          if (rel === 0) {
            // Your revealed hand stays on your rack, face up; the winning hand lifts and leans toward you.
            pose = this.place(seat, new THREE.Vector3(x, (TH * scale) / 2 + 0.03 + HAND_RAISE + rise, HAND_Z + (lifted ? 0.1 : 0)), qFromEuler(-HAND_LEAN - (lifted ? 0.25 : 0), 0, 0), scale * (lifted ? 1.08 : 1));
          } else {
            // Set gaps carry over from the rack spacing (xs) to the flat row.
            // Each tile's top points to its owner and its face to the table, so every revealed hand reads in order toward the seat's -x.
            const fx = -xs[i] * (flatStep / step);
            pose = this.place(seat, new THREE.Vector3(fx, OPP_RACK.stepY + TD / 2 + rise, (OPP_RACK.stepZ + OPP_RACK.z1) / 2 + (lifted ? 0.1 : 0)), new THREE.Quaternion(), lifted ? 1.08 : 1);
            pose.quat = Racks.shelfQuat(rel, false, lifted ? 0.5 : 0.08);
          }
          t.tipOk = true;
        } else if (rel === 0) {
          // A watcher sees the backs of the near seat's tiles, standing on its rack.
          pose = this.place(seat, new THREE.Vector3(x, TH / 2 + 0.03 + HAND_RAISE, HAND_Z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -HAND_LEAN).multiply(qFromEuler(0, Math.PI, 0)), 1);
        } else {
          // Opponents' hands stand on their racks' raised step.
          pose = this.place(seat, new THREE.Vector3(x, OPP_RACK.stepY + TH / 2 + 0.004, OPP_RACK.handZ), new THREE.Quaternion(), 1);
        }
        const fromWall = t.loc === 'wall';
        // The winning hand turns up one set at a time.
        const setDelay = winSets && opts.winLift && !quick && !this.reducedMotion && this.speed !== 'minimal' ? Math.max(0, sl.set) * 0.16 : 0;
        const delay = opts.dealing && fromWall ? Math.min(2.2, (state.wall.findIndex((w) => w.id === tile.id) / 4) * 0.06) : setDelay;
        const dur = tile.id === drag ? 0.05 : human && !shown && t.loc === 'hand' ? Math.min(base, 0.14) : shown && opts.winLift && opts.winner === seat ? Math.max(base, this.reducedMotion ? 0.2 : 1.1) : base;
        this.moveTo(t, pose, 'hand', now + delay, dur, fromWall ? 0.2 : 0);
        placed.add(tile.id);
      });

      // Melds and flowers sit on the racks' set ledges, level with the wall's
      // top so they are never hidden behind it. Yours lie on the ledge in front
      // of your hand, sets from its left end and flowers from its right, leaning toward you.
      // Each opponent's sit on the sloped shelf of their rack, tilted toward the
      // centre and turned to read upright from your seat. A long row shrinks a
      // little to stay on its ledge.
      if (rel === 0) this.ledgeIds = [];
      if (rel === 0 && !this.tray) {
        const flowers = pl.flowers ?? [];
        this.ledgeIds = [...pl.melds.flatMap((m) => m.tiles.map((x) => x.id)), ...flowers.map((f) => f.id)];
        const room = this.racks.humanLength - 0.3;
        const need = pl.melds.reduce((a, m) => a + m.tiles.length * (TW + 0.006) + 0.1, 0) + flowers.length * (TW + 0.006);
        const ms = Math.min(MY_MELD_SCALE, need > 0 ? room / need : MY_MELD_SCALE);
        // Sets from the ledge's left end in the order made, flowers from its right end, so the two never merge.
        const setsLen = pl.melds.reduce((a, m) => a + m.tiles.length * (TW * ms + 0.006) + 0.1 * ms, 0);
        let mx = -room / 2 + setsLen;
        const onLedge = (sc: number, x: number, faceDown: boolean): Pose => {
          const across = TH * sc * Math.cos(MY_LEDGE.tilt);
          const z = MY_LEDGE.z0 + 0.05 + across / 2;
          const p = new THREE.Vector3(x, myLedgeHeight(z), z).addScaledVector(MY_LEDGE_NORMAL, (TD * sc) / 2 + 0.002);
          const pose = this.place(seat, p, new THREE.Quaternion(), sc);
          pose.quat = Racks.shelfQuat(0, faceDown, -MY_LEDGE.tilt);
          return pose;
        };
        for (let mi = pl.melds.length - 1; mi >= 0; mi--) {
          const m = pl.melds[mi];
          const tiles = [...m.tiles].reverse();
          tiles.forEach((tile, j) => {
            const t = this.tiles.get(tile.id)!;
            const faceDown = m.concealed && (j === 0 || j === tiles.length - 1);
            this.moveTo(t, onLedge(ms, mx - (TW * ms) / 2, faceDown), 'meld', now, base, 0.15);
            t.tipOk = !faceDown;
            placed.add(tile.id);
            mx -= TW * ms + 0.006;
          });
          mx -= 0.1 * ms;
        }
        mx = room / 2;
        for (const f of flowers) {
          const t = this.tiles.get(f.id)!;
          const fs = ms;
          setAside(t, onLedge(fs, mx - (TW * fs) / 2, false));
          t.tipOk = true;
          placed.add(f.id);
          mx -= TW * fs + 0.006;
        }
      } else if (rel === 0 && human) {
        // Your sets and flowers are shown in the 2D tray ("Your sets", "Set aside"): kept out of sight
        // here so they never sit under the tray's hand tiles.
        for (const tile of [...pl.melds.flatMap((m) => m.tiles), ...(pl.flowers ?? [])]) {
          const t = this.tiles.get(tile.id)!;
          this.moveTo(t, this.place(seat, new THREE.Vector3(0, -3, 6), new THREE.Quaternion(), 0.001), 'meld', now, base, 0);
          t.tipOk = false;
          placed.add(tile.id);
        }
      } else if (rel === 0) {
        const ms = MY_MELD_SCALE;
        // Sets on the left, flowers from the right end (as on the ledge).
        let mx = -2.85 + pl.melds.reduce((a, m) => a + m.tiles.length * (TW * ms + 0.006) + 0.1, 0);
        for (let mi = pl.melds.length - 1; mi >= 0; mi--) {
          const m = pl.melds[mi];
          const tiles = [...m.tiles].reverse();
          tiles.forEach((tile, j) => {
            const t = this.tiles.get(tile.id)!;
            const faceDown = m.concealed && (j === 0 || j === tiles.length - 1);
            const pose = this.place(seat, new THREE.Vector3(mx - (TW * ms) / 2, (TD * ms) / 2 + 0.02, MELD_Z), qFromEuler(faceDown ? Math.PI / 2 : -Math.PI / 2, 0, 0), ms);
            this.moveTo(t, pose, 'meld', now, base, 0.15);
            t.tipOk = !faceDown;
            placed.add(tile.id);
            mx -= TW * ms + 0.006;
          });
          mx -= 0.1;
        }
        mx = 2.85;
        for (const f of pl.flowers ?? []) {
          const t = this.tiles.get(f.id)!;
          setAside(t, this.place(seat, new THREE.Vector3(mx - (TW * ms) / 2, (TD * ms) / 2 + 0.02, MELD_Z), qFromEuler(-Math.PI / 2, 0, 0), ms));
          t.tipOk = true;
          placed.add(f.id);
          mx -= TW * ms + 0.006;
        }
      } else {
        const along = TW;
        const flowers = pl.flowers ?? [];
        const need = pl.melds.reduce((a, m) => a + m.tiles.length * (along + 0.006) + 0.1, 0) + flowers.length * (along + 0.006);
        const room = OPP_RACK.length - 0.3;
        const ms = Math.min(OPP_MELD_SCALE, need > 0 ? room / need : OPP_MELD_SCALE);
        // Each player's sets at the left end of their shelf (their left), flowers from the right end, so the two never merge.
        let mx = -room / 2 + pl.melds.reduce((a, m) => a + m.tiles.length * (along * ms + 0.006) + 0.1 * ms, 0);
        const onShelf = (sc: number, x: number, faceDown: boolean): Pose => {
          const across = TH * sc * Math.cos(OPP_RACK.slope);
          const z = OPP_RACK.shelfZ + 0.008 + across / 2;
          const p = new THREE.Vector3(x, shelfHeight(z), z).addScaledVector(SHELF_NORMAL, (TD * sc) / 2 + 0.002);
          const pose = this.place(seat, p, new THREE.Quaternion(), sc);
          pose.quat = Racks.shelfQuat(rel, faceDown);
          return pose;
        };
        // Faces turned to the table read toward the seat's -x, so the sets go in the order they were made, each in its own order.
        for (const m of pl.melds) {
          const tiles = m.tiles;
          tiles.forEach((tile, j) => {
            const t = this.tiles.get(tile.id)!;
            const faceDown = m.concealed && (j === 0 || j === tiles.length - 1);
            this.moveTo(t, onShelf(ms, mx - (along * ms) / 2, faceDown), 'meld', now, base, 0.15);
            t.tipOk = !faceDown;
            placed.add(tile.id);
            mx -= along * ms + 0.006;
          });
          mx -= 0.1 * ms;
        }
        const hideFlowers = this.flowersHidden && !shown && pl.melds.filter((m) => !m.concealed).length < 3;
        mx = room / 2;
        for (const f of flowers) {
          const t = this.tiles.get(f.id)!;
          const fs = ms;
          setAside(t, onShelf(fs, mx - (along * fs) / 2, hideFlowers));
          t.tipOk = !hideFlowers;
          placed.add(f.id);
          mx -= along * fs + 0.006;
        }
      }

      // Discards: a pinwheel around the compass, as on a real table. Each river
      // starts at its player's left corner of the centre square and runs to
      // the right, so the four can be large without ever touching; every face
      // is turned upright for you. Front and back rivers run six to a row;
      // the side rivers (tiles side on) run five to a row in more rows. A river
      // that outgrows its rows shrinks a little to stay clear of the wall. The
      // riichi declaration tile lies sideways and pushes its row along.
      // The centre board gathers everyone's discards after this loop.
      if (mode === 'centre') centre.push(...pl.discards.map((tile) => ({ tile, seat })));
      else {
        const side = rel === 1 || rel === 3;
        const along = side ? TH : TW;
        const across = side ? TW : TH;
        const near = RIVER_NEAR;
        // In a pond a called tile leaves a faded print in its slot, with an arrow toward whoever took it.
        const called = mode === 'pond' ? pl.called ?? [] : [];
        type RiverItem = { tile: Tile; i: number } | { ghost: (typeof called)[number] };
        const items: RiverItem[] = [];
        pl.discards.forEach((tile, i) => {
          for (const c of called) if (c.at === i) items.push({ ghost: c });
          items.push({ tile, i });
        });
        for (const c of called) if (c.at >= pl.discards.length) items.push({ ghost: c });
        // A long river first grows its rows longer, then adds a row: whichever keeps the tiles larger.
        const { perRow, ds } = riverFit(items.length, side, along, across, near);
        const dw = along * ds + 0.014;
        const dh = across * ds + 0.016;
        const faceUp = this.seatQuat(this.humanSeat).multiply(qFromEuler(-Math.PI / 2, 0, 0));
        const faceSide = this.seatQuat(this.humanSeat).multiply(qFromEuler(-Math.PI / 2, Math.PI / 2, 0));
        let rowShift = 0;
        items.forEach((it, k) => {
          const col = k % perRow;
          const row = Math.floor(k / perRow);
          if (col === 0) rowShift = 0;
          const riichi = 'tile' in it && pl.riichiDiscard === it.i;
          const extra = riichi ? Math.abs(TH - TW) * ds : 0;
          const x = -near + dw / 2 + col * dw + rowShift + (side ? -extra : extra) / 2;
          const z = near + dh / 2 + row * dh;
          if ('ghost' in it) {
            const g = this.place(seat, new THREE.Vector3(x, 0.023, z), new THREE.Quaternion(), ds);
            this.marks.ghost(this.faceTexture(it.ghost.kind, redIds.has(it.ghost.id)), g.pos, faceUp, TW * ds * 0.94, TH * ds * 0.94);
            const corner = new THREE.Vector3((TW * ds) / 2 - 0.035, 0, (-TH * ds) / 2 + 0.035).applyQuaternion(this.seatQuat(this.humanSeat));
            this.marks.arrow(g.pos.clone().add(corner).setY(0.03), new THREE.Vector3(0, 0, 1).applyQuaternion(this.seatQuat(it.ghost.by)), 0.075);
            return;
          }
          const t = this.tiles.get(it.tile.id)!;
          // Resting on the felt (its top is at 0.02), whatever the scale.
          const pose = this.place(seat, new THREE.Vector3(x, (TD / 2) * ds + 0.02, z), new THREE.Quaternion(), ds);
          // Every face reads upright from your seat; the riichi tile turns across its row.
          pose.quat = (riichi ? faceSide : faceUp).clone();
          if (riichi) rowShift += side ? -extra : extra;
          riverReach = Math.max(riverReach, Math.abs(pose.pos.x) + (along * ds) / 2, Math.abs(pose.pos.z) + (across * ds) / 2);
          for (const sx of [-1, 1]) for (const sz of [-1, 1]) riverCorners.push(new THREE.Vector3(pose.pos.x + (sx * along * ds) / 2, 0.05, pose.pos.z + (sz * across * ds) / 2));
          const arc = t.loc === 'hand' ? 0.55 : 0;
          this.moveTo(t, pose, 'discard', now, arc ? base * 1.2 : base, arc);
          t.tipOk = true;
          placed.add(it.tile.id);
        });
        const last = pl.discards[pl.discards.length - 1];
        if (last && last.id === lastDiscardId) lastDiscard = this.tiles.get(last.id)!.target!.pos.clone();
      }

      // Riichi stick
      const stick = this.sticks[seat];
      stick.visible = pl.riichi && pl.riichiPaid;
      if (stick.visible) {
        const p = this.place(seat, new THREE.Vector3(0, 0.02, 0.72), new THREE.Quaternion());
        stick.position.copy(p.pos);
        stick.quaternion.copy(p.quat);
      }
    }

    // Centre board (American tables): one shared board, each kind in its own slot, sorted
    // by suit. The newest copy lies on top with a count chip; the newest discard waits in
    // a spotlight beside the compass, an arrow pointing from its thrower, until the next discard.
    // A portrait phone frames the discards as they are, close in while the rivers are short, stepping back as they grow.
    // Every river tile's corners: the portrait view keeps them clear of the plates and cards over the table (keepOut) and your tray.
    this.riverEdge = mode === 'centre' ? [] : riverCorners;
    const reach = mode === 'centre' ? RIVERS_FULL : THREE.MathUtils.clamp(riverReach + 0.12, RIVERS_CLOSE, RIVERS_FULL);
    if (Math.abs(reach - this.riverReach) > 0.06) {
      this.riverReach = reach;
      if (this.compact && this.view === 'seat') this.setView('seat', quick ? 0.01 : 0.9);
    }
    this.marks.showOutline(mode === 'centre', this.seatQuat(this.humanSeat));
    if (mode === 'centre') {
      const q = this.seatQuat(this.humanSeat);
      const faceUp = q.clone().multiply(qFromEuler(-Math.PI / 2, 0, 0));
      const order = new Map<number, number>();
      state.log.forEach((e, i) => e.type === 'discard' && order.set(e.tile.id, i));
      const spot = centre.find((c) => c.tile.id === lastDiscardId);
      const slots = new Map<string, { tile: Tile; seat: number }[]>();
      for (const c of centre) {
        if (c === spot) continue;
        const { row, col } = boardSlot(c.tile.kind);
        const key = `${row}:${col}`;
        if (!slots.has(key)) slots.set(key, []);
        slots.get(key)!.push(c);
      }
      for (const list of slots.values()) {
        list.sort((a, b) => (order.get(a.tile.id) ?? 0) - (order.get(b.tile.id) ?? 0));
        const top = list[list.length - 1];
        const { row, col } = boardSlot(top.tile.kind);
        const { x, z } = boardPos(row, col);
        const t = this.tiles.get(top.tile.id)!;
        const pose = this.place(this.humanSeat, new THREE.Vector3(x, (TD / 2) * BOARD_SCALE + 0.02, z), new THREE.Quaternion(), BOARD_SCALE);
        pose.quat = faceUp.clone();
        this.moveTo(t, pose, 'discard', now, base, 0);
        t.tipOk = true;
        placed.add(t.id);
        if (list.length > 1) this.marks.chip(list.length, new THREE.Vector3(x + (TW * BOARD_SCALE) / 2 - 0.04, TD * BOARD_SCALE + 0.028, z + (TH * BOARD_SCALE) / 2 - 0.05).applyQuaternion(q), q);
      }
      if (spot) {
        const t = this.tiles.get(spot.tile.id)!;
        // Beside the compass; below the board on portrait phones, where the side players' plates sit level with the compass.
        const spotAt = this.compact ? new THREE.Vector3(0, 0, BOARD_NEAR + SPOT_BELOW / 2) : new THREE.Vector3(SPOT_X, 0, 0);
        const pose = this.place(this.humanSeat, spotAt.setY((TD / 2) * SPOT_SCALE + 0.02), new THREE.Quaternion(), SPOT_SCALE);
        pose.quat = faceUp.clone();
        const arc = t.loc === 'hand' ? 0.55 : 0;
        this.moveTo(t, pose, 'discard', now, arc ? base * 1.2 : base, arc);
        t.tipOk = true;
        placed.add(t.id);
        lastDiscard = pose.pos.clone();
        // The arrow sits on the thrower's side of the tile and points at it.
        const from = new THREE.Vector3(0, 0, 1).applyQuaternion(this.seatQuat(spot.seat));
        const reach = Math.abs(from.dot(new THREE.Vector3(1, 0, 0).applyQuaternion(q))) > 0.5 ? (TW * SPOT_SCALE) / 2 + 0.16 : (TH * SPOT_SCALE) / 2 + 0.14;
        this.marks.arrow(pose.pos.clone().addScaledVector(from, reach).setY(0.03), from.clone().negate(), 0.1);
      }
    }
    this.marks.end();

    // Anything not placed (e.g. between hands) goes back under the table. So do
    // tiles left from the landing scatter that this set doesn't use (Korean has
    // no Characters 2–8, Sichuan no honours).
    const inSet = new Set(state.wallOrder);
    for (const t of this.tiles.values()) {
      if (!placed.has(t.id) && (t.loc !== 'scatter' || (inSet.size > 0 && !inSet.has(t.id)))) this.moveTo(t, { pos: new THREE.Vector3(0, -1, 0), quat: new THREE.Quaternion(), scale: 0.001 }, 'hidden', now, 0.01, 0);
    }

    // The centre board's spotlight is marked enough by its glow and arrow; the cone would hide its face from above.
    if (lastDiscard && mode !== 'centre') {
      this.marker.visible = true;
      this.marker.position.copy(lastDiscard).add(new THREE.Vector3(0, 0.42, 0));
    } else this.marker.visible = false;

    // Red fives (Riichi aka dora) show their red face.
    const red = new Set((state as { red?: number[] }).red ?? []);
    for (const t of this.tiles.values()) {
      const want = red.has(t.id);
      if (want !== t.red) {
        t.red = want;
        const tex = this.faceTexture(t.kind, want);
        t.faceMat.map = t.faceMat.emissiveMap = tex;
        dressFace(t.faceMat, t.kind, this.labels, want, this.faceAniso(tex.userData.scale), tex.userData.scale);
      }
    }
    this.placeAvatars();

    // Highlights
    for (const t of this.tiles.values()) {
      const inHand = state.players[this.humanSeat].hand.some((h) => h.id === t.id);
      const hint = inHand && this.hintKind === t.kind;
      const match = inHand && !hint && this.matchKind === t.kind && t.id !== this.selectedId;
      const sel = t.id === this.selectedId || this.selectedIds.has(t.id);
      const win = opts.winner !== undefined && state.players[opts.winner].hand.some((h) => h.id === t.id);
      const fresh = t.id === this.lastDiscardId;
      // Your freshly drawn tile: a soft warm rim, quieter than a hint, plus the pip above it.
      const drawn = t.id === drawnMark;
      const winTile = win && t.id === opts.winTileId;
      const glow = sel ? 0.35 : hint ? 0.5 : fresh ? 0.62 : drawn ? 0.3 : match ? 0.32 : winTile ? 0.6 : win ? 0.22 : 0;
      t.bodyMat.emissive.set(sel ? '#f0c46e' : hint || fresh ? '#e5b45a' : drawn ? '#ffd890' : match ? '#9fd8bd' : '#f2d08c');
      t.bodyMat.emissiveIntensity = glow;
      t.faceMat.emissive.set(glow && !match ? '#ffe2a8' : '#ffffff');
      // River tiles glow a touch more from within, so their ink stays crisp from across the table.
      t.faceMat.emissiveIntensity = FACE_GLOW + glow * 0.5 + (t.loc === 'discard' ? DISCARD_FACE_LIFT : 0);
    }

    this.drawnPipId = drawnMark;
    const turn = opts.turnSeat ?? (phase.kind === 'turn' ? phase.seat : -1);
    this.drawCompass(state.seatWinds, state.prevailingWind, dealer, turn);
  }

  /** Keep the gold frame under the latest discard, wherever its tile is in its flight. */
  /**
   * Every settled face-up tile on the table (discards, everyone's sets, revealed hands) also shows as the same
   * flat picture your hand tiles use, mapped exactly onto its 3D face, so the table reads as clearly as your
   * hand; the 3D tile underneath gives the depth and the bevel. Tiles in flight show in 3D only; the pictures
   * follow any zoom or tilt of the view. Your own hand keeps its 3D faces (or the tray).
   */
  private river2d!: HTMLDivElement;
  private river2dImgs = new Map<number, HTMLImageElement>();
  private static rv = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private updateRiver2d() {
    const box = this.river2d;
    const on = this.view === 'seat' && !this.cine && this.viewW > 0.98;
    if (!on) {
      if (!box.hidden) box.hidden = true;
      return;
    }
    box.hidden = false;
    const el = this.renderer.domElement;
    const w = el.clientWidth;
    // Split View draws your hand in its own strip at the bottom: the pictures stop above it.
    const h = this.splitOn ? this.stripRect().top : el.clientHeight;
    const H = el.clientHeight;
    box.style.left = `${el.offsetLeft}px`;
    box.style.top = `${el.offsetTop}px`;
    box.style.height = `${h}px`;
    this.camera.updateMatrixWorld();
    const [c, a, b, n, q, e, cam] = TableRenderer.rv;
    cam.setFromMatrixPosition(this.camera.matrixWorld);
    const mine = new Set(this.handSlots.map((sl) => sl.tile.id));
    const centre = this.discardLayout === 'centre';
    const seen = new Set<number>();
    const pts: number[] = [];
    for (const t of this.tiles.values()) {
      if (t.tween || !t.group.visible || mine.has(t.id)) continue;
      // The centre board keeps its 3D copies: their count chips lie on top of the faces.
      if (t.loc === 'discard' ? centre : t.loc !== 'meld' && t.loc !== 'hand') continue;
      const g = t.group;
      const sc = g.scale.x;
      n.set(0, 0, 1).applyQuaternion(g.quaternion);
      c.copy(g.position).addScaledVector(n, (TD / 2) * sc);
      // Facing the camera, not lying face down or turned away.
      if (q.copy(cam).sub(c).normalize().dot(n) < 0.2) continue;
      a.set(((TW * 0.94) / 2) * sc, 0, 0).applyQuaternion(g.quaternion);
      b.set(0, ((TH * 0.95) / 2) * sc, 0).applyQuaternion(g.quaternion);
      // Corners in picture order: top left, top right, bottom right, bottom left.
      pts.length = 0;
      let ok = true;
      for (const [sx, sy] of [[-1, 1], [1, 1], [1, -1], [-1, -1]]) {
        e.copy(c).addScaledVector(a, sx).addScaledVector(b, sy).project(this.camera);
        if (e.z > 1 || e.z < -1) ok = false;
        pts.push(((e.x + 1) / 2) * w, ((1 - e.y) / 2) * H);
      }
      if (!ok) continue;
      const xs = [pts[0], pts[2], pts[4], pts[6]],
        ys = [pts[1], pts[3], pts[5], pts[7]];
      if (Math.max(...xs) < 0 || Math.min(...xs) > w || Math.max(...ys) < 0 || Math.min(...ys) > h || Math.max(...xs) - Math.min(...xs) < 4) continue;
      seen.add(t.id);
      let img = this.river2dImgs.get(t.id);
      const src = faceUrl(t.kind, this.labels, t.red);
      if (!img) {
        img = document.createElement('img');
        img.alt = '';
        img.draggable = false;
        this.river2dImgs.set(t.id, img);
        box.appendChild(img);
      }
      if (img.dataset.src !== src) {
        img.src = src;
        img.dataset.src = src;
      }
      const tf = quadMatrix(pts, FACE_PX_W, FACE_PX_H);
      if (img.style.transform !== tf) img.style.transform = tf;
      // Nearer faces lie over farther ones.
      const z = String(Math.round((1 - c.project(this.camera).z) * 50000));
      if (img.style.zIndex !== z) img.style.zIndex = z;
      img.classList.toggle('last', t.id === this.lastDiscardId);
    }
    for (const [id, img] of this.river2dImgs)
      if (!seen.has(id)) {
        img.remove();
        this.river2dImgs.delete(id);
      }
  }

  private updateLastRing(now: number) {
    const t = this.lastDiscardId >= 0 ? this.tiles.get(this.lastDiscardId) : undefined;
    const show = !!t && t.loc === 'discard' && t.group.visible && !t.tween;
    this.lastRing.visible = show;
    if (!show) return;
    const g = t.group;
    // Lying on the felt just under the tile, the same footprint plus a margin.
    this.lastRing.position.set(g.position.x, 0.026, g.position.z);
    this.lastRing.quaternion.copy(g.quaternion);
    this.lastRing.scale.copy(g.scale);
    this.lastRing.material.opacity = 0.75 + Math.sin(now * 3) * 0.2;
  }

  private static pipLocal = new THREE.Vector3();

  /** Keep the drawn-tile pip floating just over its tile, wherever the tile goes. */
  private updateDrawnPip(now: number) {
    const t = this.drawnPipId >= 0 ? this.tiles.get(this.drawnPipId) : undefined;
    const show = !!t && t.loc === 'hand' && t.group.visible && this.view !== 'orbit';
    this.drawnPip.visible = show;
    if (!show) return;
    const p = TableRenderer.pipLocal.set(0, TH / 2 + 0.085 + Math.sin(now * 2.6) * 0.012, 0);
    t.group.localToWorld(p);
    this.drawnPip.position.copy(p);
    this.drawnPip.quaternion.copy(t.group.quaternion);
    this.drawnPip.rotateY(now * 0.9);
  }

  /**
   * Frame a seat's revealed hand (its tiles and called sets) from your side of
   * the table, so its tiles read upright (they are laid out to read from your
   * seat), fitted inside `area` (client px; default the whole view). Used by
   * the win summary (ui/winReveal.ts), which leaves the open part of the screen
   * beside a docked panel or above the summary bar.
   */
  frameHand(seat: number, area?: { left: number; top: number; right: number; bottom: number }) {
    const rel = this.quad(seat);
    // A portrait phone keeps its whole-table view (the summary bar carries the hand there).
    if (this.compact) return;
    const p = this.lastState?.players[seat];
    if (!p) return;
    const calm = this.reducedMotion || this.speed === 'minimal';
    const at = this.seatAnchor(seat, new THREE.Vector3(0, 0.37, 3.8));
    this.setView('focus', calm ? 0.01 : 1.1, at);
    const pos = this.camTo.pos,
      look = this.camTo.look;
    if (rel === 2) {
      // Look over the centre at the far hand rather than from behind it.
      pos.set(at.x * 0.55, at.y + 5.2, at.z * 0.55 + 3.8);
    } else if (rel !== 0) {
      // A side hand runs up the screen: stand back on your side and high enough to see all of it.
      pos.set(at.x * 0.45, at.y + 8.2, at.z + 6);
    } else {
      // Your own hand: from higher up, so the sets you called (lying flat beyond the rack) show over the standing tiles.
      pos.set(at.x, at.y + 7.5, at.z + 3.6);
    }
    // Fit the hand's resting tiles inside the area: centre them, then step in or out until they fill it.
    const pts = [...p.hand, ...p.melds.flatMap((m) => m.tiles)].map((t) => this.tiles.get(t.id)).filter((t): t is TileObj => !!t).map((t) => (t.target?.pos ?? t.group.position).clone());
    if (!pts.length) return;
    const W = this.container.clientWidth || window.innerWidth,
      H = this.container.clientHeight || window.innerHeight;
    const r = this.container.getBoundingClientRect();
    const box = area ? { left: area.left - r.left, right: area.right - r.left, top: area.top - r.top, bottom: area.bottom - r.top } : { left: 0, right: W, top: 0, bottom: H };
    const cam = this.camera.clone();
    const up = new THREE.Vector3();
    const right = new THREE.Vector3();
    for (let i = 0; i < 4; i++) {
      cam.position.copy(pos);
      cam.lookAt(look);
      cam.updateMatrixWorld();
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const v of pts) {
        const q = v.clone().project(cam);
        const sx = ((q.x + 1) / 2) * W, sy = ((1 - q.y) / 2) * H;
        x0 = Math.min(x0, sx), x1 = Math.max(x1, sx), y0 = Math.min(y0, sy), y1 = Math.max(y1, sy);
      }
      const d = pos.distanceTo(look);
      const perPx = (2 * d * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))) / H;
      // A tile's own size around its centre point, plus a little air.
      const pad = (TH * 1.6) / perPx;
      const k = Math.max((x1 - x0 + pad) / Math.max(80, box.right - box.left), (y1 - y0 + pad) / Math.max(80, box.bottom - box.top)) / 0.9;
      right.setFromMatrixColumn(cam.matrixWorld, 0);
      up.setFromMatrixColumn(cam.matrixWorld, 1);
      const dx = ((x0 + x1) / 2 - (box.left + box.right) / 2) * perPx;
      const dy = ((y0 + y1) / 2 - (box.top + box.bottom) / 2) * perPx;
      const off = right.multiplyScalar(dx).addScaledVector(up, -dy);
      pos.add(off);
      look.add(off);
      if (i === 3) break;
      // Never closer than a comfortable reading distance, never further than the whole table.
      // (Stepping in or out moves the hand about the screen centre, so the next pass re-centres it.)
      const nd = THREE.MathUtils.clamp(d * THREE.MathUtils.clamp(k, 0.6, 1.8), 3.2, this.short ? 12 : 16);
      pos.sub(look).setLength(nd).add(look);
    }
  }

  /** World position of a seat's hand centre (for focus shots and labels). */
  seatAnchor(seat: number, local = new THREE.Vector3(0, 0.2, 3.6)) {
    return local.clone().applyQuaternion(this.seatQuat(seat));
  }

  /**
   * Where the discard rivers can reach on screen (client px), so HUD layouts
   * can keep seat plates and controls off them. Uses the current camera, so
   * call it after a resize or view change has settled.
   */
  riverBounds() {
    const r = this.renderer.domElement.getBoundingClientRect();
    let left = Infinity,
      top = Infinity,
      right = -Infinity,
      bottom = -Infinity;
    const v = new THREE.Vector3();
    for (const [x, z] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      v.set(x * RIVER_LIMIT, 0.25, z * RIVER_LIMIT).project(this.camera);
      const sx = r.left + ((v.x + 1) / 2) * r.width,
        sy = r.top + ((1 - v.y) / 2) * r.height;
      left = Math.min(left, sx);
      right = Math.max(right, sx);
      top = Math.min(top, sy);
      bottom = Math.max(bottom, sy);
    }
    return { left, top, right, bottom };
  }

  /** Where the compass sits on screen (client px, vertical). */
  centreY() {
    return this.renderer.domElement.getBoundingClientRect().top + this.toScreen(new THREE.Vector3(0, 0.05, 0)).y;
  }

  /** Screen position (px) of a world point. */
  toScreen(v: THREE.Vector3) {
    const p = v.clone().project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: ((p.x + 1) / 2) * r.width, y: ((1 - p.y) / 2) * r.height, visible: p.z < 1 };
  }

  private moveTo(t: TileObj, pose: Pose, loc: Loc, start: number, dur: number, arc: number) {
    const same = t.target && t.target.pos.distanceToSquared(pose.pos) < 1e-6 && t.target.quat.angleTo(pose.quat) < 1e-4 && Math.abs(t.target.scale - pose.scale) < 1e-4;
    t.loc = loc;
    if (same) return;
    const g = t.group;
    const from: Pose = { pos: g.position.clone(), quat: g.quaternion.clone(), scale: g.scale.x };
    t.target = pose;
    if (dur <= 0.011 || g.scale.x < 0.01) {
      // Appear instantly when coming from hidden.
      if (g.scale.x < 0.01 && loc !== 'hidden') {
        g.position.copy(pose.pos);
        g.quaternion.copy(pose.quat);
        g.scale.setScalar(pose.scale);
        g.visible = true;
        t.tween = undefined;
        return;
      }
    }
    t.tween = { from, to: pose, t0: start, dur, arc };
  }

  // ------------------------------------------------------------ loop

  /** Keep drawing at full rate for a while: something outside the tile tweens is animating. */
  wake(ms = 1200) {
    this.activeUntil = Math.max(this.activeUntil, performance.now() + ms);
  }

  private hoverWake(ms: number) {
    this.hoverUntil = Math.max(this.hoverUntil, performance.now() + ms);
  }

  /** Real motion, or only the pointer highlighting tiles (full frame rate, but sharpness kept). */
  private busy(ms: number): boolean {
    if (this.moving(ms) || ms < this.hoverUntil) return true;
    for (const id of this.hoverTweens) if (this.tiles.get(id)?.tween) return true;
    return false;
  }

  /** Whether anything on screen is in motion (tiles, camera, a gesture, the win moment); hover lifts don't count. */
  private moving(ms: number): boolean {
    if (ms < this.activeUntil || this.view === 'orbit' || this.camT < 1 || this.cine || this.gesture || this.room.sides.busy || this.freeMoving()) return true;
    for (const t of this.tiles.values()) if (t.tween && !this.hoverTweens.has(t.id)) return true;
    const c = this.viewC,
      v = this.viewT;
    return Math.abs(c.zoom - v.zoom) + Math.abs(c.tilt - v.tilt) + Math.abs(c.yaw - v.yaw) > 1e-3 || Math.abs(this.viewW - (this.view === 'seat' ? 1 : 0)) > 1e-3;
  }

  /**
   * Compile every shader the scene can need (hidden pieces included: the discard ring, the shuffle
   * machine, riichi sticks) and upload the tile faces now. Otherwise the first discard, call or
   * shuffle that shows a new piece stalls while the GPU driver compiles it.
   */
  prewarm() {
    const hidden: THREE.Object3D[] = [];
    this.scene.traverse((o) => {
      if (!o.visible) {
        hidden.push(o);
        o.visible = true;
      }
    });
    try {
      for (const tex of this.faceTex.values()) this.renderer.initTexture(tex);
      // compile() does its work synchronously (linking finishes in parallel where the driver can), so
      // the hidden pieces can go back right away. Not compileAsync: its readiness poll runs in a timer
      // and throws an uncaught error when a material is swapped or disposed before it links.
      this.renderer.compile(this.scene, this.camera);
    } finally {
      for (const o of hidden) o.visible = false;
    }
  }

  private frame() {
    // Frame pacing: up to about 60 frames a second while anything moves, about half that while the
    // table is still (only the room's ambience moves then). A 120 Hz screen would otherwise draw the
    // whole room twice as often for no visible gain, and a GPU kept that busy delays everything else
    // on the page: the hitch after each discard.
    const ms = performance.now();
    const moving = this.moving(ms);
    const busy = moving || this.busy(ms);
    if (ms - this.lastRender < (busy ? 1000 / 75 : 1000 / 40)) return;
    this.lastRender = ms;
    // Only full-rate frames say anything about whether the device keeps up.
    if (!moving) this.governor.pause();
    this.settleResolution(moving, ms);
    // Shadows follow moving tiles every frame; otherwise a few times a second is plenty (seated figures breathe).
    // When the governor asks, moving shadows update every third frame too.
    const gov = this.governor.step;
    this.shadowTick++;
    if (gov.staticShadows ? this.shadowTick % (moving ? 3 : 9) === 0 : moving || this.shadowTick % 3 === 0) this.renderer.shadowMap.needsUpdate = true;
    const calmFx = this.speed === 'minimal' || !gov.effects;
    const now = this.clock.getElapsedTime();
    const dt = Math.min(0.05, now - this.lastFrame);
    this.lastFrame = now;
    for (const t of this.tiles.values()) {
      const tw = t.tween;
      if (!tw) continue;
      const k = (now - tw.t0) / tw.dur;
      if (k < 0) continue;
      const g = t.group;
      if (!tw.from) tw.from = { pos: g.position.clone(), quat: g.quaternion.clone(), scale: g.scale.x };
      const e = ease(Math.min(1, k));
      g.position.lerpVectors(tw.from.pos, tw.to.pos, e);
      if (tw.arc) g.position.y += Math.sin(Math.PI * Math.min(1, k)) * tw.arc;
      g.quaternion.slerpQuaternions(tw.from.quat, tw.to.quat, e);
      g.scale.setScalar(tw.from.scale + (tw.to.scale - tw.from.scale) * e);
      g.visible = g.scale.x > 0.01;
      if (k >= 1) t.tween = tw.next;
    }
    this.machine.update(now);
    if (this.wallMarks.update(now)) this.wake(150);

    // Camera
    if (this.view === 'orbit') {
      // The establishing shot: a slow, low glide around the room, the lamp hanging in frame.
      const a = now * 0.045;
      const r = this.camera.aspect < 0.85 ? 19 : 16;
      this.camBase.set(Math.sin(a) * r, 3.7 + Math.sin(now * 0.15) * 0.25, Math.cos(a) * r);
      this.camLook.set(0, 1.5, 0);
    } else if (this.camT < 1) {
      this.camT = Math.min(1, (now - this.camStart) / this.camDur);
      const e = ease(this.camT);
      this.camBase.lerpVectors(this.camFrom.pos, this.camTo.pos, e);
      this.camLook.lerpVectors(this.camFrom.look, this.camTo.look, e);
    }
    // The signature moment bends the camera for this frame only; the view underneath carries on.
    const cine = this.cine ? [this.camBase.clone(), this.camLook.clone()] : null;
    if (this.cine && !this.cine.update(now, this.camBase, this.camLook, this.pointScale)) this.cine = null;
    this.applyCamera(dt);
    if (this.freeCur) this.applyFree(dt);
    this.updateFigures(now, dt);
    if (now - this.handTopAt > (busy ? 0.12 : 0.5)) {
      this.handTopAt = now;
      this.measureHandTop();
    }
    if (cine) {
      this.camBase.copy(cine[0]);
      this.camLook.copy(cine[1]);
    }
    if (this.tipShown && this.tipId !== null && this.tiles.get(this.tipId)?.tween) this.clearTip();
    this.updateDrawnPip(now);
    this.updateEdgeBars();
    this.updateLastRing(now);
    this.updateRiver2d();
    this.updateWinLight(now);

    if (this.marker.visible) this.marker.position.y += Math.sin(now * 4) * 0.0015;
    this.room.update(now, dt, this.camera, this.view === 'orbit', calmFx);
    this.backdrop.update(dt);
    const size = this.renderer.getDrawingBufferSize(TableRenderer.v2);
    this.pointScale = size.y * 0.5 * this.camera.projectionMatrix.elements[5];
    this.fx.update(now, dt, this.pointScale, calmFx);

    if (this.view === 'orbit') {
      this.scatterTimer += dt;
      if (this.scatterTimer > 9) {
        this.scatterTimer = 0;
        this.ambientShuffle();
        this.onAmbient?.('shuffle');
      }
      if (this.ambientBuildAt > 0 && now >= this.ambientBuildAt) {
        this.ambientBuildAt = -1;
        this.onAmbient?.('build');
      }
    }
    this.renderer.render(this.scene, this.camera);
    if (this.splitOn) this.renderHandStrip();
    if (moving) this.governor.tick(performance.now());
    this.perfCount(ms, busy);
  }

  /** The render quality tier in use (picked from the device; see quality.ts). */
  get quality(): QualityTier {
    return this.q.tier;
  }

  /** Average frame time (ms) over the last few seconds, 0 until measured. */
  get frameMs() {
    return this.governor.avgMs;
  }

  private static v2 = new THREE.Vector2();
  private perfWin = { t: 0, n: 0, sum: 0, worst: 0, last: 0 };
  /** Last second's numbers for the Labs frame-rate overlay (dev/fps.ts). */
  perf = { fps: 0, avgMs: 0, worstMs: 0, level: 0, pixelRatio: 1, calls: 0, triangles: 0, tier: 'high' as QualityTier, moving: false };

  private perfCount(ms: number, moving: boolean) {
    const w = this.perfWin;
    const d = w.last ? ms - w.last : 0;
    w.last = ms;
    if (d > 0 && d < 1000) {
      w.n++;
      w.sum += d;
      w.worst = Math.max(w.worst, d);
    }
    if (ms - w.t < 1000) return;
    const info = this.renderer.info.render;
    this.perf = { fps: w.n ? (1000 * w.n) / w.sum : 0, avgMs: w.n ? w.sum / w.n : 0, worstMs: w.worst, level: this.governor.level, pixelRatio: this.renderer.getPixelRatio(), calls: info.calls, triangles: info.triangles, tier: this.q.tier, moving };
    w.t = ms;
    w.n = w.sum = w.worst = 0;
  }

  onAmbient?: (what: 'shuffle' | 'build') => void;

  /** Back to the landing loop. */
  idle() {
    this.watchOnly = false;
    this.setFreeCamera(false);
    this.room.sides.setPurses([START_UNITS, START_UNITS, START_UNITS, START_UNITS]);
    this.lastState = undefined;
    this.interactive.clear();
    this.hintKind = null;
    this.ppIds.clear();
    this.riskKinds.clear();
    this.selectedId = null;
    this.selectedIds.clear();
    this.marker.visible = false;
    this.gesture = null;
    this.dragIndex = -1;
    this.handSlots = [];
    this.handXs = [];
    this.drawnPipId = -1;
    this.clearTip();
    this.setSeatAvatars([]);
    this.fx.clearBursts();
    this.cine?.dispose();
    this.cine = null;
    if (this.winLight) this.winLight.light.intensity = 0;
    this.winLight = null;
    this.matchKind = null;
    this.tipNote = undefined;
    for (const t of this.tiles.values()) {
      t.bodyMat.emissiveIntensity = 0;
      t.faceMat.emissive.set('#ffffff');
      t.faceMat.emissiveIntensity = FACE_GLOW;
    }
    this.camFrom.pos.copy(this.camBase);
    this.view = 'orbit';
    this.scatterTimer = 0;
    this.racks.setVisible([true, true, true, true], !this.tray);
    this.wallOpen = true;
    this.wallEnds = false;
    for (const k of ['front', 'back', 'seg'] as const) this.wallMarks.set(k, null, 0);
    this.ambientShuffle();
  }
}

/** Rug field colour per environment: deep, quiet silks. */
const RUG: Record<string, string> = {
  'private-club': '#3a1716',
  tokyo: '#1a2038',
  taipei: '#4a1712',
  dubai: '#4a3418',
  'new-york': '#2a2024',
  shanghai: '#2a1a2e',
  'modern-luxury': '#2a2622',
};

// ------------------------------------------------------------ material textures

/** A rounded-rectangle glow, transparent in the middle (where the tile sits). */
function frameGlowTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 160;
  const g = c.getContext('2d')!;
  g.shadowColor = 'rgba(255,255,255,1)';
  g.shadowBlur = 12;
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.lineWidth = 6;
  g.beginPath();
  if (g.roundRect) g.roundRect(14, 14, 100, 132, 14);
  else g.rect(14, 14, 100, 132);
  g.stroke();
  g.stroke();
  return new THREE.CanvasTexture(c);
}

/** Polished stone with soft veins, for marble tile backs and table rims. */
function marbleTexture(base: string, light = false) {
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
function woodTexture(base: string) {
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

/** The winning hand's slots: its concealed sets in order, a set's width of space apart; any tile not in a set goes last. */
function winHandSlots(hand: Tile[], sets: number[][]): HandSlot[] {
  const byId = new Map(hand.map((t) => [t.id, t]));
  const out: HandSlot[] = [];
  sets.forEach((ids, si) =>
    ids.forEach((id, j) => {
      const tile = byId.get(id);
      if (!tile) return;
      byId.delete(id);
      out.push({ tile, gap: si > 0 && j === 0 ? 2 : 0, set: si });
    }),
  );
  for (const tile of byId.values()) out.push({ tile, gap: out.length ? 2 : 0, set: -1 });
  return out;
}
