// The 3D finish of the equipped tile set: body and back slabs get their own
// material (gilded metal, polished stone, lacquer, iridescent pearl, glass,
// oiled wood...) and texture, and the face plane its gloss. Purely visual.

import * as THREE from 'three';
import type { TileFinish } from '../cosmetics/catalog';
import { currentTileSet, drawFaceSurface, tileFinishCanvas } from './tileFaces';
import { leanGraphics } from './quality';

export interface Finish {
  roughness: number;
  metalness?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  sheen?: number;
  sheenColor?: string;
  iridescence?: number;
  /** Opacity for see-through finishes. */
  opacity?: number;
  env?: number;
}

export const FINISH: Record<TileFinish, Finish> = {
  // Every finish is polished the way a jeweller polishes a piece: a deep clear coat over the
  // material, so light runs over tiles in long, clean highlights.
  ivory: { roughness: 0.32, clearcoat: 0.85, clearcoatRoughness: 0.07, sheen: 0.35, sheenColor: '#fff4e6' },
  bone: { roughness: 0.36, clearcoat: 0.7, clearcoatRoughness: 0.1, sheen: 0.3, sheenColor: '#fbf0dc' },
  lacquer: { roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.03, env: 1.25 },
  jade: { roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 0.5, sheenColor: '#c8f0d4', env: 1.25 },
  malachite: { roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.04, env: 1.25 },
  marble: { roughness: 0.2, clearcoat: 0.95, clearcoatRoughness: 0.05, env: 1.15 },
  obsidian: { roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.02, env: 1.6 },
  pearl: { roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1, iridescence: 1, sheen: 0.8, sheenColor: '#f6d8ea', env: 1.3 },
  glass: { roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02, opacity: 0.62, env: 1.8 },
  gold: { roughness: 0.22, metalness: 1, clearcoat: 0.4, clearcoatRoughness: 0.12, env: 1.4 },
  rosegold: { roughness: 0.25, metalness: 1, clearcoat: 0.4, clearcoatRoughness: 0.12, env: 1.3 },
  porcelain: { roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03, env: 1.2 },
  wood: { roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.14 },
  bamboo: { roughness: 0.45, clearcoat: 0.45, clearcoatRoughness: 0.2 },
  amethyst: { roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.04, env: 1.3 },
};

// The body slab's depth range in tile space (table3d: TD * 0.64 deep, moved TD * 0.18 forward, TD = 0.22).
const BODY_Z0 = -0.0308,
  BODY_Z1 = 0.11;

/**
 * The body slab's shading, worked out per pixel from the slab's own depth so every side matches:
 * layered resin is banded through its depth (one colour per layer, the last meeting the face), and
 * every set has a fine polished seam in its trim metal where the body meets the back.
 */
export function shadeBody(m: THREE.MeshPhysicalMaterial, stripes: string[] | undefined, trim: string) {
  const contact = !!m.userData.contact;
  const key = `body:${stripes?.join(',') ?? ''}:${trim}:${contact}`;
  if (m.userData.body === key) return;
  m.userData.body = key;
  const cols = (stripes ?? []).map((c) => new THREE.Color(c));
  const n = cols.length;
  const seam = new THREE.Color(trim);
  const t = `clamp((vSlabZ - (${BODY_Z0.toFixed(4)})) / ${(BODY_Z1 - BODY_Z0).toFixed(4)}, 0.0, 0.9999)`;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSeam = { value: seam };
    if (n) sh.uniforms.uStripes = { value: cols };
    if (contact) groundShade(sh);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vSlabZ;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvSlabZ = position.z;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying float vSlabZ;\nuniform vec3 uSeam;${n ? `\nuniform vec3 uStripes[${n}];` : ''}`)
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float slabT = ${t};
        // The seam: a band just above the join with the back, with crisp edges; and a fine bezel
        // line in the same metal running round the front, where the face is set.
        float seamK = smoothstep(0.035, 0.05, slabT) * (1.0 - smoothstep(0.1, 0.115, slabT));
        seamK = max(seamK, smoothstep(0.835, 0.845, slabT) * (1.0 - smoothstep(0.865, 0.875, slabT)));
        ${
          n
            ? `{
          int i = int(floor(slabT * ${n.toFixed(1)}));
          vec3 c = uStripes[0];
          for (int k = 1; k < ${n}; k++) if (k == i) c = uStripes[k];
          diffuseColor.rgb *= c;
        }`
            : ''
        }
        diffuseColor.rgb = mix(diffuseColor.rgb, uSeam, seamK);`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.2, seamK);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 1.0, seamK);');
  };
  m.customProgramCacheKey = () => key;
  m.needsUpdate = true;
}

/** Height of the felt the tiles lie on (world y); the table's tiles rest on y = 0. */
export const TILE_FLOOR = { value: 0 };

/**
 * Contact shading (only on materials marked userData.contact, the table's tiles): the last few millimetres of a tile above the felt darken, as light can't reach
 * in under a solid block. It is what makes a tile look set down on the cloth rather than floating
 * over it, and it costs one line of shader (the shadow map is too soft to draw it).
 */
function groundShade(sh: THREE.WebGLProgramParametersWithUniforms) {
  sh.uniforms.uTileFloor = TILE_FLOOR;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying float vTileH;')
    .replace('#include <project_vertex>', '#include <project_vertex>\n{ vec4 tileW = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\ntileW = instanceMatrix * tileW;\n#endif\nvTileH = (modelMatrix * tileW).y; }');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vTileH;\nuniform float uTileFloor;')
    .replace('#include <aomap_fragment>', '#include <aomap_fragment>\n{ float contact = smoothstep(0.0, 0.07, vTileH - uTileFloor); float k = mix(0.45, 1.0, contact * contact * (3.0 - 2.0 * contact)); reflectedLight.indirectDiffuse *= k; reflectedLight.directDiffuse *= mix(0.7, 1.0, contact); reflectedLight.indirectSpecular *= k; }');
}

/** The shared back material gets the contact shading too (it is the part lying on the felt). */
function shadeBack(m: THREE.MeshPhysicalMaterial) {
  if (m.userData.back || !m.userData.contact) return;
  m.userData.back = true;
  m.onBeforeCompile = (sh) => groundShade(sh);
  m.customProgramCacheKey = () => 'tile-back';
  m.needsUpdate = true;
}

const texCache = new Map<string, THREE.CanvasTexture>();

function finishTexture(part: 'back' | 'body', setId: string) {
  const key = `${setId}:${part}`;
  let t = texCache.get(key);
  if (!t) {
    t = new THREE.CanvasTexture(tileFinishCanvas(part));
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    texCache.set(key, t);
  }
  return t;
}

/**
 * The tiles' own white balance, shared by every face and body material (backs keep the room's
 * colour). A warm or coloured room light would otherwise tint ivory tan, as an uncorrected photo
 * does; this cancels most of the light's colour on the tiles at the same brightness, so white
 * faces stay white and ink keeps its true colour in every room. Set by setTileLight.
 */
export const TILE_WB = new THREE.Color(1, 1, 1);

/** How much of the light's colour is cancelled on tiles (1 = all of it; a trace of warmth stays). */
const WB_STRENGTH = 0.75;
/** Tiles are lit a touch brighter than the room around them, as a photographer lifts the subject. */
const TILE_LIFT = 1.12;

/** Balance the tiles for a room lit mainly by `light` (the key light's colour, mixed with the fill). */
export function setTileLight(light: THREE.Color) {
  const m = Math.max(light.r, light.g, light.b, 1e-3);
  const inv = new THREE.Color(m / Math.max(light.r, 1e-3), m / Math.max(light.g, 1e-3), m / Math.max(light.b, 1e-3));
  const wb = new THREE.Color(1, 1, 1).lerp(inv, WB_STRENGTH);
  // Same brightness as before (plus the lift): only the colour of the light is taken out.
  const lum = (c: THREE.Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  const lit = light.clone().multiply(wb);
  wb.multiplyScalar((TILE_LIFT * lum(light)) / Math.max(1e-3, lum(lit)));
  TILE_WB.copy(wb);
}

export function apply(m: THREE.MeshPhysicalMaterial, f: Finish, map: THREE.Texture | null, lowTier: boolean, balanced = false) {
  m.map = map;
  if (balanced) m.color = TILE_WB;
  else m.color.set('#ffffff');
  m.roughness = f.roughness;
  m.metalness = f.metalness ?? 0;
  m.clearcoat = lowTier ? Math.min(0.5, f.clearcoat ?? 0) : f.clearcoat ?? 0;
  m.clearcoatRoughness = f.clearcoatRoughness ?? 0.15;
  m.sheen = lowTier ? 0 : f.sheen ?? 0;
  if (f.sheenColor) m.sheenColor.set(f.sheenColor);
  m.sheenRoughness = 0.5;
  m.iridescence = lowTier ? 0 : f.iridescence ?? 0;
  m.iridescenceIOR = 1.35;
  m.iridescenceThicknessRange = [180, 520];
  m.transparent = f.opacity !== undefined;
  m.opacity = f.opacity ?? 1;
  m.envMapIntensity = f.env ?? 1;
  m.needsUpdate = true;
}

/**
 * Dress the 3D tiles in the equipped set: one shared back material, one body
 * material per tile (they also carry hover glow), and the face planes' gloss.
 */
export function applyTileFinish(bodies: THREE.MeshPhysicalMaterial[], back: THREE.MeshPhysicalMaterial, faces: THREE.MeshStandardMaterial[], lowTier = false) {
  const st = currentTileSet();
  const bodyTex = finishTexture('body', st.id);
  const backTex = finishTexture('back', st.id);
  const bf = FINISH[st.bodyFinish];
  for (const m of bodies) {
    apply(m, bf, st.stripes ? null : bodyTex, lowTier, true);
    shadeBody(m, st.stripes, st.trim);
  }
  apply(back, FINISH[st.backFinish], backTex, lowTier);
  shadeBack(back);
  // The back of a glass set is a little more frosted than its body.
  if (st.backFinish === 'glass') back.opacity = 0.55;
  const gf = FINISH[st.ground];
  for (const m of faces) {
    m.color = TILE_WB;
    m.roughness = faceRough = Math.max(0.08, Math.min(0.5, gf.roughness + 0.04));
    m.metalness = 0;
    m.envMapIntensity = gf.env ?? 1;
    // The face is the same polished surface as the body around it: the same clear coat, so light
    // runs over face and edge as one piece instead of the face reading as a printed card.
    if (m instanceof THREE.MeshPhysicalMaterial) {
      const cc = lowTier ? 0 : faceCoat(gf);
      if ((m.clearcoat > 0) !== (cc > 0)) m.needsUpdate = true;
      m.clearcoat = cc;
      m.clearcoatRoughness = faceCoatRough(gf);
    }
  }
  surfaceLow = lowTier;
}

/** The face's glaze: every face is glazed like enamel, whatever its ground. */
export const faceCoat = (gf: Finish) => Math.max(0.8, gf.clearcoat ?? 0);
export const faceCoatRough = (gf: Finish) => Math.min(0.06, Math.max(0.03, gf.clearcoatRoughness ?? 0.06));

let faceRough = 0.32;
/** How far the wires and bezel stand proud of the enamel under the room's light (the relief is in tileFaces). */
export const BUMP = 2.6;
let surfaceLow = false;
const surfaceTex = new Map<string, THREE.CanvasTexture>();
let surfaceSet = '';

/**
 * Gives a face its metal: on sets with foil, a roughness/metalness map makes
 * the foil linework and gilt ink polished metal that catches the room's
 * light as tiles move. Call after the face's colour map is set. The low
 * quality tier keeps the painted foil but skips the extra map.
 */
export function dressFace(m: THREE.MeshStandardMaterial, kind: number, labels: boolean, red: boolean, anisotropy = 4, scale?: number) {
  const st = currentTileSet();
  if (surfaceSet !== st.id) {
    for (const t of surfaceTex.values()) t.dispose();
    surfaceTex.clear();
    surfaceSet = st.id;
  }
  let tex: THREE.CanvasTexture | null = null;
  // Every set's ink is engraved in 3D (the map's red is its relief); low tier and lean devices skip the map.
  if (!surfaceLow && !leanGraphics()) {
    const key = `${kind}:${labels}:${red}:${scale}`;
    tex = surfaceTex.get(key) ?? null;
    if (!tex) {
      const c = drawFaceSurface(kind, labels, red, faceRough, scale);
      if (c) {
        tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.NoColorSpace;
        tex.anisotropy = anisotropy;
        surfaceTex.set(key, tex);
      }
    }
  }
  const had = !!m.metalnessMap;
  const old = m.metalnessMap;
  m.metalnessMap = m.roughnessMap = m.bumpMap = tex;
  m.bumpScale = BUMP;
  // A sharper map replaces a preview one: free the old unless another copy still shows it.
  if (old && old !== tex && ![...surfaceTex.values()].includes(old as THREE.CanvasTexture)) old.dispose();
  m.metalness = tex ? 1 : 0;
  m.roughness = tex ? 1 : faceRough;
  if (had !== !!tex) m.needsUpdate = true;
}

/** Drop every face surface map (the labels option or the face detail changed). */
export function clearFaceSurfaces() {
  for (const t of surfaceTex.values()) t.dispose();
  surfaceTex.clear();
}
