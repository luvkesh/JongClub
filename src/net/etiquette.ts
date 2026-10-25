// Table etiquette: a short set of preset phrases and gestures players can send
// at a table, instead of free chat. They travel like reactions (lockstep `re`
// in presence) as a short code, "~" + the phrase id, so nobody can put words
// of their own in front of others. Sending is rate-limited, and each seat's
// incoming phrases too, so a table stays calm.

import { tr } from '../i18n';

export interface Phrase {
  id: string;
  /** What the bubble says. */
  text: string;
  /** A gesture shows its glyph large, with the text as its label. */
  glyph?: string;
}

export const PHRASES: Phrase[] = [
  { id: 'nice', text: tr('Nice hand') },
  { id: 'gg', text: tr('Good game') },
  { id: 'wp', text: tr('Well played') },
  { id: 'thanks', text: tr('Thank you') },
  { id: 'luck', text: tr('Good luck') },
  { id: 'bow', text: tr('A bow'), glyph: '🙇' },
  { id: 'tea', text: tr('A cup of tea'), glyph: '🍵' },
];

/** The emoji reactions every table has always had. */
export const EMOJI_REACTIONS = ['👏', '🔥', '😮', '😂', '🀄'];

export const phraseCode = (id: string) => `~${id}`;
export const phraseOf = (code: string): Phrase | undefined => (code.startsWith('~') ? PHRASES.find((p) => p.id === code.slice(1)) : undefined);
/** A cup of tea passed to a seat (once per hand; see src/ui/tea.ts) travels as "tea:" + the receiving seat. */
export const teaCode = (to: number) => `tea:${to}`;
export const teaTarget = (code: string): number | null => (/^tea:[0-3]$/.test(code) ? Number(code.slice(4)) : null);
/** Any code a table accepts from another player: an emoji reaction, a preset phrase or a cup of tea. */
export const isTableSignal = (code: unknown): code is string => typeof code === 'string' && (EMOJI_REACTIONS.includes(code) || !!phraseOf(code) || teaTarget(code) !== null);

/** At most `burst` signals in `windowMs`, and never two within `gapMs`. */
export class SignalLimiter {
  private times: number[] = [];
  constructor(
    private burst = 5,
    private windowMs = 60_000,
    private gapMs = 2000,
  ) {}
  allow(now = Date.now()): boolean {
    this.times = this.times.filter((t) => now - t < this.windowMs);
    const last = this.times[this.times.length - 1];
    if (this.times.length >= this.burst || (last !== undefined && now - last < this.gapMs)) return false;
    this.times.push(now);
    return true;
  }
}

// ------------------------------------------------------------ the player's choice

const KEY = 'jongclub.etiquette.v1';

/** Hide phrases and reactions from other players (Settings). */
export function etiquetteHidden(): boolean {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}').hide === true;
  } catch {
    return false;
  }
}

export function setEtiquetteHidden(hide: boolean) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ hide }));
  } catch {
    /* ignore */
  }
}
