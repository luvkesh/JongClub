// Asset capture harness (perf/assets): the Atelier pictures of racks, tables and rooms, for
// before/after pictures. Open /perf/assets/ on the dev server; window.shot(kind, id) returns a data URL.
import '../../src/render/tilePicture';
import { loadTileFonts, setTileSet } from '../../src/render/tileFaces';
import { rackPreview } from '../../src/render/rackPreview';
import { environmentPreview } from '../../src/render/backdrop';
import { tablePreview } from '../../src/render/tablePreview';
import { avatarPortraitUrl } from '../../src/render/avatar3d';
import { effectPreview } from '../../src/render/effectArt';
import { loadProfile } from '../../src/progression/profile';

const pictures: Record<string, (id: string) => string | Promise<string>> = {
  frame: (id) => avatarPortraitUrl({ ...loadProfile().avatar, frame: id }, 360) ?? '',
  effect: (id) => effectPreview(id),
  rack: (id) => rackPreview(id),
  room: (id) => environmentPreview(id, 960, 528),
  table: (id) => tablePreview(id),
};
async function shot(kind: string, id: string) {
  await loadTileFonts();
  setTileSet('classic-ivory');
  return pictures[kind]?.(id) ?? '';
}
(window as unknown as { shot: typeof shot; pictures: typeof pictures }).shot = shot;
(window as unknown as { pictures: typeof pictures }).pictures = pictures;
(window as unknown as { ready: boolean }).ready = true;
