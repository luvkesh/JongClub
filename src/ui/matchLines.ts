// What Mei says at the table. Prompts there are dynamic (a tile, a call word),
// so each is composed from recorded pieces: tile names and call words from
// Mei's caller clips, plus short fixed narration lines recorded like the
// lessons. Every fixed line is listed by matchLines(), which the narration
// recording script reads (via narrationLines() in academy.ts).
//
// Each composer returns the parts to play and the full caption text, which a
// device voice reads instead when the player picked one in Settings.

import type { Hint } from '../ai/jongbot';
import type { SpeechPart } from '../audio/voice';
import { tr } from '../i18n';
import { tileLabel } from '../i18n/tiles';

export const LINES = {
  yourTurn: 'Your turn. Discard a tile.',
  canWin: 'Your hand is complete! Declare your win, or discard a tile.',
  claimOrPass: 'Claim it, or pass?',
  hintDiscard: 'That’s JongBot’s pick to discard.',
  hintRiichi: 'JongBot would discard that one and declare a ready hand.',
  hintSwap: 'JongBot suggests swapping that tile for a joker.',
  hintWin: 'JongBot says: declare your win!',
  hintClaim: 'JongBot would take it.',
  hintPass: 'JongBot would let it go.',
  hintCharleston: 'JongBot has picked three tiles you could pass.',
  charlestonRight: 'Charleston. Pick three tiles to pass to the right.',
  charlestonAcross: 'Charleston. Pick three tiles to pass across.',
  charlestonLeft: 'Charleston. Pick three tiles to pass to the left.',
  goulash: 'This is a goulash, so jokers may be passed.',
  vote: 'Second Charleston? Choose pass again, or start play.',
  youWin: 'You win the hand! Well played.',
  rightWins: 'The player on your right wins the hand.',
  acrossWins: 'The player across from you wins the hand.',
  leftWins: 'The player on your left wins the hand.',
  drawn: 'Drawn hand. The wall ran out.',
  timeClaim: 'Time’s up, so I passed for you.',
  timeTurn: 'Time’s up, so I discarded for you.',
  speakAllOn: 'I will read out hints, prompts and results.',
} as const;

/** Every fixed line Mei can say during a game (for recording). */
export function matchLines(): string[] {
  return [...new Set(Object.values(LINES))];
}

export interface Spoken {
  parts: SpeechPart[];
  /** The whole line as text: the caption, and what a device voice reads. */
  text: string;
}

const line = (text: string): SpeechPart => ({ line: text });

/** Your turn to discard (or to declare a self-drawn win). */
export function turnPrompt(canWin: boolean, winWord = 'Mahjong'): Spoken {
  return canWin
    ? { parts: [line(LINES.canWin)], text: tr('Your turn. You can declare {call}, or discard a tile.', { call: tr(winWord) }) }
    : { parts: [line(LINES.yourTurn)], text: tr(LINES.yourTurn) };
}

/** Someone discarded a tile you could claim: "Five Bamboo. Claim it, or pass?" */
export function claimPrompt(kind: number): Spoken {
  return { parts: [{ tile: kind }, line(LINES.claimOrPass)], text: `${tileLabel(kind)}. ${tr(LINES.claimOrPass)}` };
}

/** Charleston: pick three tiles to pass. */
export function charlestonPrompt(dir: string, goulash: boolean): Spoken {
  const first = dir === 'right' ? LINES.charlestonRight : dir === 'across' ? LINES.charlestonAcross : LINES.charlestonLeft;
  const parts = [line(first)];
  if (goulash) parts.push(line(LINES.goulash));
  return { parts, text: goulash ? `${tr(first)} ${tr(LINES.goulash)}` : tr(first) };
}

export function votePrompt(): Spoken {
  return { parts: [line(LINES.vote)], text: tr(LINES.vote) };
}

/**
 * JongBot's advice, spoken in pieces. The caption keeps JongBot's full
 * headline; Mei says the tile or call word and a short recorded line.
 * `call` is the variation's word for the claim JongBot recommends (Pung, Pon...).
 */
export function hintSpoken(hint: Hint, call?: string): Spoken {
  const text = hint.headline;
  const k = hint.focusKind;
  if (hint.action === 'win') return { parts: [line(LINES.hintWin)], text };
  if (hint.action === 'pass') return { parts: [line(LINES.hintPass)], text };
  if (hint.action === 'riichi' && k !== undefined) return { parts: [{ tile: k }, line(LINES.hintRiichi)], text };
  if (hint.action === 'discard' && k !== undefined) {
    if (/^Swap\b/.test(hint.headline)) return { parts: [{ tile: k }, line(LINES.hintSwap)], text };
    return { parts: [{ tile: k }, line(LINES.hintDiscard)], text };
  }
  if (hint.action === 'pung' || hint.action === 'kong' || hint.action === 'chow') return { parts: [...(call ? [{ call } as SpeechPart] : []), line(LINES.hintClaim)], text };
  if (/^Pass the /.test(hint.headline)) return { parts: [line(LINES.hintCharleston)], text };
  return { parts: [], text };
}

/** A prompt followed by JongBot's advice (when hints are on). */
export function withHint(prompt: Spoken, hint: Hint | null, call?: string): Spoken {
  if (!hint) return prompt;
  const h = hintSpoken(hint, call);
  return { parts: [...prompt.parts, ...h.parts], text: `${prompt.text} JongBot: ${h.text}` };
}

/**
 * A hand's result. `winnerRel` is where the winner sits relative to you
 * (0 you, 1 right, 2 across, 3 left), or null for a drawn hand.
 */
export function resultSpoken(winnerRel: number | null, caption: string): Spoken {
  if (winnerRel === null) return { parts: [line(LINES.drawn)], text: tr(LINES.drawn) };
  const l = [LINES.youWin, LINES.rightWins, LINES.acrossWins, LINES.leftWins][winnerRel] ?? LINES.rightWins;
  return { parts: [line(l)], text: caption };
}
