// JongClub logo, inlined from brand/ (see brand/README.md).
// The crest is cut from the original logo (brand/src/build-crest.py); the
// wordmark is always the embossed gold lettering (build-brand.py).
import './brand.css';
import crestSmall from '../brand/png/jongclub-crest-256.webp?inline';
import crestLarge from '../brand/png/jongclub-crest-512.webp?inline';
import wordmarkUrl from '../brand/jongclub-wordmark-embossed.svg?inline';
import tileSvg from '../brand/jongclub-tile.svg?raw';

export type BrandMark = 'mark' | 'crest' | 'tile';

/** Markup for a logo mark. 'mark' and 'crest' are the JongClub crest (the same
 *  image everywhere); 'tile' is the bare East tile, kept for tiny glyph uses. */
export function brandSvg(kind: BrandMark, label = ''): string {
  if (kind === 'tile') return tileSvg.replace(/<metadata>[\s\S]*?<\/metadata>/, '');
  const src = kind === 'crest' ? crestLarge : crestSmall;
  return `<img class="jc-crest" src="${src}" alt="${label}" draggable="false" decoding="async">`;
}

/** The embossed JONGCLUB wordmark as an image element. */
export function brandWordmark(label = 'JongClub'): HTMLImageElement {
  const img = document.createElement('img');
  img.className = 'jc-wordmark';
  img.src = wordmarkUrl;
  img.alt = label;
  img.draggable = false;
  return img;
}
