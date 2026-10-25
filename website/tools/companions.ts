// Character-select portraits of the five table companions (Mei, Rex, Hiro,
// Lucky, Amara) for the website: the game's own 3D seat figure, chest up,
// turned three-quarters, under soft studio light, on a transparent ground.
// Run in the game's dev server from website/tools/companions.mjs.
//
// The look is what the table gives each bot: avatarForName (src/ui/app.ts,
// copied below because it is not exported) plus withBotAccessories, whose
// extras depend on a per-session salt that companions.html pins.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { SeatFigure } from '../../src/render/avatar3d';
import { withBotAccessories } from '../../src/cosmetics/avatar';
import { DEFAULT_AVATAR, HAIR_COLORS, SKIN_TONES, type AvatarSpec } from '../../src/cosmetics/catalog';

/** Copy of avatarForName in src/ui/app.ts: a stable look for a bot without a chosen avatar. */
export function avatarForName(name: string): AvatarSpec {
  let n = 0;
  for (const c of name) n = (n * 31 + c.charCodeAt(0)) >>> 0;
  const pick = <T,>(a: readonly T[], k: number) => a[Math.floor(n / k) % a.length];
  const hair: AvatarSpec['hair'][] = ['short', 'long', 'bun', 'bob', 'shaved', 'wavy'];
  const outfit: AvatarSpec['outfit'][] = ['blazer', 'suit', 'qipao', 'kimono', 'kandura', 'sweater'];
  return { ...DEFAULT_AVATAR, skin: n % SKIN_TONES.length, hair: pick(hair, 7), hairColor: pick(HAIR_COLORS, 11), outfit: pick(outfit, 13), outfitColor: pick(['#1f3b33', '#141414', '#7a1f1b', '#1a2440', '#5a4321'], 17) };
}

// The modules are loaded: let Math.random be random again.
(window as unknown as { __pinnedSalt?: number }).__pinnedSalt = undefined;

/** The look the table gives this bot this session. */
export const tableLook = (name: string) => withBotAccessories(avatarForName(name), name);

let renderer: THREE.WebGLRenderer | null = null;
let env: THREE.Texture | null = null;

function getRenderer(px: number) {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, premultipliedAlpha: false });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    env = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
  }
  renderer.setPixelRatio(1);
  renderer.setSize(px, px, false);
  renderer.setClearColor(0x000000, 0);
  return renderer;
}

export interface Opts {
  /** Turn of the body toward camera-right (radians); the head turns a little less. */
  turn?: number;
  exposure?: number;
}

/** Studio light: soft warm key high front-left, gentle cool fill, warm rims behind both shoulders. */
function studio(scene: THREE.Scene) {
  scene.environment = env;
  scene.environmentIntensity = 0.35;
  scene.add(new THREE.HemisphereLight('#f6ead6', '#20160f', 0.4));
  const key = new THREE.DirectionalLight('#fff0dc', 2.6);
  key.position.set(-2.6, 3.4, 4.2);
  scene.add(key);
  const fill = new THREE.DirectionalLight('#cfdcff', 0.4);
  fill.position.set(3.2, 1.2, 3.0);
  scene.add(fill);
  const rimL = new THREE.DirectionalLight('#ffc98a', 3.4);
  rimL.position.set(-3.2, 2.6, -3.2);
  scene.add(rimL);
  const rimR = new THREE.DirectionalLight('#ffd7a3', 2.6);
  rimR.position.set(3.4, 2.2, -2.8);
  scene.add(rimR);
  const top = new THREE.DirectionalLight('#fff4e4', 0.6);
  top.position.set(0, 5, 0.5);
  scene.add(top);
}

/**
 * The portrait as a PNG data URL, `size` square, rendered at `ss`x and
 * downsampled for clean edges. The body fades out softly at the bottom.
 */
export function portrait(name: string, size = 640, ss = 2, o: Opts = {}): string {
  const spec = tableLook(name);
  const px = size * ss;
  const r = getRenderer(px);
  r.toneMappingExposure = o.exposure ?? 1.0;
  const scene = new THREE.Scene();
  studio(scene);
  const fig = new SeatFigure(spec);
  scene.add(fig.group);
  fig.update(0, 1, null);
  const turn = o.turn ?? 0.5;
  fig.group.rotation.y = -turn;
  // Head back toward the camera a little, chin level: a relaxed three-quarter.
  (fig as unknown as { head: THREE.Group }).head.rotation.set(0.04, turn * 0.2, 0, 'YXZ');
  // Eyes open (update may have started a blink).
  fig.group.traverse((x) => x.scale.y < 0.5 && x.scale.y > 0 && (x.scale.y = 1));
  const cam = new THREE.PerspectiveCamera(20, 1, 0.1, 50);
  cam.position.set(0, 1.92, 5.9);
  cam.lookAt(0, 1.76, 0);
  r.render(scene, cam);

  const out = document.createElement('canvas');
  out.width = out.height = size;
  const g = out.getContext('2d')!;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(r.domElement, 0, 0, size, size);
  // Fade the chest into nothing so the cut never shows.
  g.globalCompositeOperation = 'destination-in';
  const fade = g.createLinearGradient(0, size * 0.72, 0, size);
  fade.addColorStop(0, 'rgba(0,0,0,1)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fade;
  g.fillRect(0, 0, size, size);
  fig.dispose();
  return out.toDataURL('image/png');
}

/** Three friends for the "Your Friends" card: player looks from the avatar shop, side by side. */
export const FRIENDS: AvatarSpec[] = [
  { ...DEFAULT_AVATAR, skin: 7, hair: 'wavy', hairColor: '#3b2a20', outfit: 'sweater', outfitColor: '#7a1f1b', accessory: 'earrings', lips: 'full' as AvatarSpec['lips'] },
  { ...DEFAULT_AVATAR, skin: 3, hair: 'short', hairColor: '#1b1715', outfit: 'blazer', outfitColor: '#1a2440', accessory: 'aviators' },
  { ...DEFAULT_AVATAR, skin: 6, hair: 'bob', hairColor: '#a37b4c', outfit: 'qipao', outfitColor: '#1f3b33', accessory: 'pearls' },
];

/** A group portrait of FRIENDS, the middle one a step forward, the others turned in toward them. */
export function friends(size = 640, ss = 2, exposure = 1.0): string {
  const px = size * ss;
  const r = getRenderer(px);
  r.toneMappingExposure = exposure;
  const scene = new THREE.Scene();
  studio(scene);
  const place: [number, number, number][] = [[-0.8, -0.2, -0.45], [0, 0.05, 0.05], [0.8, -0.2, 0.45]];
  const figs = FRIENDS.map((spec, i) => {
    const fig = new SeatFigure(spec);
    scene.add(fig.group);
    fig.update(0, 1, null);
    const [x, z, turn] = place[i];
    fig.group.position.set(x, 0, z);
    fig.group.rotation.y = -turn;
    (fig as unknown as { head: THREE.Group }).head.rotation.set(0.04, turn * 0.5, 0, 'YXZ');
    fig.group.traverse((o) => o.scale.y < 0.5 && o.scale.y > 0 && (o.scale.y = 1));
    // No table in front of them: hide the forearms and hands that rest on its rim.
    fig.group.updateMatrixWorld(true);
    fig.group.children.forEach((o) => new THREE.Box3().setFromObject(o).max.y - fig.group.position.y < 0.45 && (o.visible = false));
    return fig;
  });
  const cam = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
  cam.position.set(0, 1.9, 7.4);
  cam.lookAt(0, 1.42, 0);
  r.render(scene, cam);
  const out = document.createElement('canvas');
  out.width = out.height = size;
  const g = out.getContext('2d')!;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(r.domElement, 0, 0, size, size);
  g.globalCompositeOperation = 'destination-in';
  const fade = g.createLinearGradient(0, size * 0.6, 0, size * 0.93);
  fade.addColorStop(0, 'rgba(0,0,0,1)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fade;
  g.fillRect(0, 0, size, size);
  figs.forEach((f) => f.dispose());
  return out.toDataURL('image/png');
}
