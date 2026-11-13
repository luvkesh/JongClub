// The painted portraits of the five regulars (Mei, Rex, Hiro, Lucky, Amara),
// cropped from the user's reference card art (website/refs/regulars.png) by
// brand/cast/README.md's steps. Wherever one of them sits at a table in their
// own look, the seat plate shows this painting instead of a render of the 3D
// figure, so they look the same in the game as on the website.

import mei from '../../brand/cast/mei.webp?inline';
import rex from '../../brand/cast/rex.webp?inline';
import hiro from '../../brand/cast/hiro.webp?inline';
import lucky from '../../brand/cast/lucky.webp?inline';
import amara from '../../brand/cast/amara.webp?inline';
import type { AvatarSpec } from './catalog';
import { castLook } from './cast';

const ART: Record<string, string> = { Mei: mei, Rex: rex, Hiro: hiro, Lucky: lucky, Amara: amara };

/** The painted portrait for a named regular wearing their own cast look, else null. */
export function castPortrait(name: string, spec?: AvatarSpec | null): string | null {
  const art = ART[name];
  if (!art) return null;
  if (spec) {
    const own = castLook(name);
    if (!own || JSON.stringify(own) !== JSON.stringify(spec)) return null;
  }
  return art;
}
