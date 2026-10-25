// Facts about a winning hand that most scorers ask for: every set with
// whether it is concealed, every tile, the suits used. Used by the newer
// tables (Guangdong, Zung Jung, European...), so each scorer reads like its
// rulebook instead of re-deriving the hand.

import { KIND_COUNT, isDragon, isHonor, isSuited, isTerminal, isTerminalOrHonor, isWind, suitOf } from '../tiles';
import type { ScoringContext } from './types';

export interface FactSet {
  type: 'pung' | 'chow' | 'kong';
  /** Lowest kind of a chow; the kind of a pung or kong. */
  kind: number;
  concealed: boolean;
}

export interface HandFacts {
  sets: FactSet[];
  /** Every tile in the hand, melds and winning tile included (flowers not). */
  kinds: number[];
  counts: number[];
  pair: number;
  suits: Set<string>;
  hasHonour: boolean;
  pungs: FactSet[];
  chows: FactSet[];
  kongs: FactSet[];
  dragonPungs: FactSet[];
  windPungs: FactSet[];
  /** No claimed set (concealed kongs allowed). */
  closed: boolean;
  /** Concealed pungs and kongs (a pung finished on a discard is not concealed). */
  concealedPungs: number;
}

export function handFacts(ctx: ScoringContext): HandFacts {
  const d = ctx.decomposition;
  const sets: FactSet[] = ctx.melds.map((m) => ({ type: m.type as FactSet['type'], kind: Math.min(...m.tiles.map((t) => t.kind)), concealed: m.concealed }));
  for (const s of d.sets) {
    if (s.type === 'pair') continue;
    // A pung finished on a discard is not concealed, unless the winning tile also fits a run.
    const byDiscard = !ctx.selfDrawn && s.type === 'pung' && s.kind === ctx.winKind && !d.sets.some((x) => x.type === 'chow' && ctx.winKind >= x.kind && ctx.winKind <= x.kind + 2);
    sets.push({ type: s.type, kind: s.kind, concealed: !byDiscard });
  }
  const kinds: number[] = [];
  for (let k = 0; k < KIND_COUNT; k++) for (let i = 0; i < ctx.concealedCounts[k]; i++) kinds.push(k);
  for (const m of ctx.melds) for (const t of m.tiles) kinds.push(t.kind);
  const counts = new Array(KIND_COUNT).fill(0);
  for (const k of kinds) if (k < KIND_COUNT) counts[k]++;
  const pungs = sets.filter((s) => s.type !== 'chow');
  return {
    sets,
    kinds,
    counts,
    pair: d.pair,
    suits: new Set(kinds.filter(isSuited).map(suitOf)),
    hasHonour: kinds.some(isHonor),
    pungs,
    chows: sets.filter((s) => s.type === 'chow'),
    kongs: sets.filter((s) => s.type === 'kong'),
    dragonPungs: pungs.filter((s) => isDragon(s.kind)),
    windPungs: pungs.filter((s) => isWind(s.kind)),
    closed: ctx.melds.every((m) => m.concealed),
    concealedPungs: pungs.filter((s) => s.concealed).length,
  };
}

/** Does this set hold a one, a nine or an honour? */
export const setHasTerminalOrHonour = (s: FactSet) => (s.type === 'chow' ? s.kind % 9 === 0 || s.kind % 9 === 6 : isTerminalOrHonor(s.kind));
/** Does this set hold a one or a nine? */
export const setHasTerminal = (s: FactSet) => (s.type === 'chow' ? s.kind % 9 === 0 || s.kind % 9 === 6 : isTerminal(s.kind));
