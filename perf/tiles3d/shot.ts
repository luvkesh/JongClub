// Tile 3D harness (perf/tiles3d): exports a set's faces, surface maps, body and back finishes for the
// Blender renders (blender/), and shoots the game's own three.js close-ups for before/after pictures.
import * as THREE from 'three';
import '../../src/render/tilePicture';
import { jewelStudio, jewelTiles } from '../../src/render/tilePicture';
import { drawBackOnce, drawBodyOnce, drawFaceOnce, loadTileFonts, tileSetPreview, withTileSet, currentTileSet } from '../../src/render/tileFaces';
import { FINISH } from '../../src/render/tileMaterials';
import { TD, TH } from '../../src/render/tileShape';

const url = (c: HTMLCanvasElement) => c.toDataURL('image/png');

/** Faces (colour + surface: R relief, G roughness, B metalness), body and back, and the set's style. */
async function dump(id: string, kinds: number[], scale = 4) {
  await loadTileFonts();
  return withTileSet(id, () => {
    const st = currentTileSet();
    const faces: Record<number, { face: string; surface: string }> = {};
    const gf = FINISH[st.ground];
    const rough = Math.max(0.08, Math.min(0.5, gf.roughness + 0.04));
    for (const k of kinds) {
      const { face, surface } = drawFaceOnce(k, scale, rough);
      faces[k] = { face: url(face), surface: url(surface) };
    }
    return { style: st, finish: { body: FINISH[st.bodyFinish], back: FINISH[st.backFinish], ground: gf }, faces, body: url(drawBodyOnce()), back: url(drawBackOnce()) };
  });
}

/** One tile, large, in the Atelier studio (plus one face down behind it). */
async function closeup(id: string, kind = 31, w = 900, h = 900) {
  await loadTileFonts();
  return withTileSet(id, () => {
    const st = currentTileSet();
    const studio = jewelStudio(w, h, st.stage === 'suede' ? '#1d5240' : '#2a2622');
    const tiles = jewelTiles({ seg: 6, faceScale: 4 });
    const g = tiles.tile(kind);
    g.position.set(-0.05, TH / 2, 0);
    g.rotation.y = 0.42;
    studio.show(g);
    const down = tiles.tile(null);
    down.rotation.set(Math.PI / 2, 0, -0.5);
    down.position.set(0.24, TD / 2, -0.28);
    studio.show(down);
    const cam = new THREE.PerspectiveCamera(24, w / h, 0.05, 30);
    cam.position.set(0.25, 0.52, 1.25);
    cam.lookAt(0.03, 0.17, -0.05);
    const u = studio.shoot(cam);
    tiles.dispose();
    return u;
  });
}

async function portrait(id: string) {
  await loadTileFonts();
  return tileSetPreview(id, 960, 528);
}
Object.assign(window, { dump, closeup, portrait, ready: true });
