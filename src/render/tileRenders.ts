// The tile-set portraits rendered in Blender (Cycles, scripts/blender/tile_render.py `trio`): the
// same three tiles and one face down as the live 3D portrait, with truly carved faces. They are
// served beside the page (public/tilesets/<id>.webp). Where a picture is missing or cannot load
// (the single-file build, a set added later) the live 3D portrait is drawn instead.

import { tileSetPreview } from './tileFaces';

const RENDERED = new Set([
  'amethyst', 'black-marble', 'bone-bamboo', 'champagne', 'cinnabar', 'classic-ivory', 'crystal', 'emerald',
  'gilt-porcelain', 'jade', 'noyer', 'obsidian', 'pearl', 'royal-gold', 'sapphire', 'walnut',
  'season-dubai', 'season-hanoi', 'season-hongkong', 'season-singapore', 'season-taipei', 'season-tokyo',
]);

/** Sets whose rendered picture failed to load: they use the live portrait from then on. */
const failed = new Set<string>();

function renderUrl(id: string): string {
  try {
    return new URL(`tilesets/${id}.webp`, document.baseURI).href;
  } catch {
    return `tilesets/${id}.webp`;
  }
}

/**
 * Shows a set's portrait as the background of `el`: the Blender render when there is one, else (or if
 * it fails to load) the live 3D portrait at w x h.
 */
export function showTileSetArt(el: HTMLElement, id: string, w = 480, h = 264): HTMLElement {
  const live = () => (el.style.backgroundImage = `url(${tileSetPreview(id, w, h)})`);
  if (!RENDERED.has(id) || failed.has(id)) {
    live();
    return el;
  }
  const url = renderUrl(id);
  el.style.backgroundImage = `url(${url})`;
  const probe = new Image();
  probe.onerror = () => {
    failed.add(id);
    live();
  };
  probe.src = url;
  return el;
}
