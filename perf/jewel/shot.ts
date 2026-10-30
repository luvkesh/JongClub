// Tile-set capture harness (perf/jewel): faces in a row and the Atelier 3D portrait,
// for before/after pictures. Open /perf/jewel/ on the dev server; window.shot(id) returns PNG data URLs.
import '../../src/render/tilePicture';
import { drawFace, loadTileFonts, tileSetPreview, withTileSet } from '../../src/render/tileFaces';

const ROW = [0, 4, 8, 9, 13, 17, 18, 19, 22, 26, 27, 30, 31, 32, 33];

async function shot(id: string, scale = 2) {
  await loadTileFonts();
  const faces = withTileSet(id, () => {
    const fs = ROW.map((k) => drawFace(k, true, false, scale));
    const w = fs[0].width, h = fs[0].height, gap = 12;
    const c = document.createElement('canvas');
    c.width = ROW.length * (w + gap) + gap; c.height = h + gap * 2;
    const g = c.getContext('2d')!;
    g.fillStyle = '#2a241e'; g.fillRect(0, 0, c.width, c.height);
    fs.forEach((f, i) => g.drawImage(f, gap + i * (w + gap), gap));
    return c.toDataURL('image/png');
  });
  const portrait = tileSetPreview(id, 960, 528);
  return { faces, portrait };
}
(window as unknown as { shot: typeof shot }).shot = shot;
(window as unknown as { ready: boolean }).ready = true;
