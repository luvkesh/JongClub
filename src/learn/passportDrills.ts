// Passport drills (India Rules, East round), built by the engine's own passport
// planner so every answer is the engine's own:
//
//   passport         spot the passport a complete hand is built around
//   passportDiscard  pick the discard that keeps you nearest a passport, with
//                    the most passports still open
//
// Opened from Learn's "Passport drills" card (ui/drills.ts); the schedule
// brings a missed one back like any other drill.

import { PASSPORT_HANDS, passportMissing, passportPlans, type PassportHand } from '../engine/rules/indiaPassport';
import { Rng } from '../engine/rng';
import { KIND_COUNT } from '../engine/tiles';
import { seedOf } from '../club/util';
import { andList, tr } from '../i18n';
import { tileLabel } from '../i18n/tiles';
import type { Drill } from './drillGen';

/** "3 Knits in the same 2 suits twice" for a plan's names, translated. */
export const passportNames = (names: string[]) => names.filter((n, i) => names.indexOf(n) === i).map((n) => (names.filter((x) => x === n).length > 1 ? tr('{name} twice', { name: tr(n) }) : tr(n))).join(' + ');
const key = (names: string[]) => names.join('|');
/** A passport piece in words: "a pair of 2 Characters", "three East Winds", or the tiles listed. */
const pieceText = (kinds: number[]) => {
  if (kinds.length === 2 && kinds[0] === kinds[1]) return tr('a pair of {tile}s', { tile: tileLabel(kinds[0]) });
  if (kinds.length === 3 && kinds.every((k) => k === kinds[0])) return tr('three {tile}s', { tile: tileLabel(kinds[0]) });
  return andList(kinds.map((k) => tileLabel(k)));
};
const beside = (sets: number, pair: boolean) => (sets === 1 && pair ? tr('a set and a pair') : sets === 1 ? tr('a set') : sets && pair ? tr('{n} sets and a pair', { n: sets }) : sets ? tr('{n} sets', { n: sets }) : pair ? tr('a pair') : '');

/**
 * A complete 14-tile hand built on one passport hand: its passports filled with concrete tiles,
 * then the sets and pair beside them. Null when the tiles ran out (four of a kind at most).
 */
function buildHand(rng: Rng, h: PassportHand): number[] | null {
  const counts = new Array(KIND_COUNT).fill(0);
  const take = (tiles: number[]) => {
    if (tiles.some((k) => counts[k] >= 4) || tiles.some((k, i) => tiles.filter((x, j) => j < i && x === k).length + counts[k] >= 4)) return false;
    for (const k of tiles) counts[k]++;
    return true;
  };
  for (let i = 0; i < h.pass.length; i++) {
    const comp = h.pass[i];
    const opts = rng.shuffle(comp.opts.map((_, j) => j));
    let ok = false;
    for (const o of opts) {
      // Repeated pieces (three pairs, three knits) read better as different tiles.
      const same = i > 0 && h.pass[i - 1].id === comp.id;
      if (same && rng.next() < 0.9 && comp.opts[o].tiles.every((k) => counts[k] > 0)) continue;
      if (take(comp.opts[o].tiles)) {
        ok = true;
        break;
      }
    }
    if (!ok) return null;
  }
  for (let s = 0; s < h.sets; s++) {
    let ok = false;
    for (let tries = 0; tries < 30 && !ok; tries++) {
      const roll = rng.next();
      if (roll < 0.45) {
        const suit = rng.int(3) * 9;
        const n = rng.int(7);
        ok = take([suit + n, suit + n + 1, suit + n + 2]);
      } else if (roll < 0.8) {
        const k = rng.int(KIND_COUNT);
        ok = take([k, k, k]);
      } else {
        // A mixed chow: one tile from each suit.
        const n = rng.int(7);
        const order = rng.shuffle([0, 1, 2]);
        ok = take([order[0] * 9 + n, order[1] * 9 + n + 1, order[2] * 9 + n + 2]);
      }
    }
    if (!ok) return null;
  }
  if (h.pair) {
    let ok = false;
    for (let tries = 0; tries < 30 && !ok; tries++) {
      const k = rng.int(KIND_COUNT);
      ok = take([k, k]);
    }
    if (!ok) return null;
  }
  return counts.flatMap((n, k) => Array<number>(n).fill(k)).sort((a, b) => a - b);
}

const toCounts = (hand: number[]) => {
  const c = new Array(KIND_COUNT).fill(0);
  for (const k of hand) c[k]++;
  return c;
};

/** The passports (by name, each once) still open at distance `missing`, as the planner reads this hand. */
const openAt = (counts: number[], missing: number) => [...new Set(passportPlans(counts, [], 60, 99).filter((p) => p.missing === missing).flatMap((p) => p.names))];

const DRILL_ID = (type: string, seed: number) => `${type}:india:${seed}`;

// ------------------------------------------------------------ spot the passport

export function passportDrill(seed: number): Drill {
  for (let attempt = 0; attempt < 40; attempt++) {
    const rng = new Rng(seedOf(seed, 'passport', attempt));
    const h = PASSPORT_HANDS[rng.int(PASSPORT_HANDS.length)];
    const hand = buildHand(rng, h);
    if (!hand) continue;
    const counts = toCounts(hand);
    const plans = passportPlans(counts, [], 60, 99);
    const best = plans[0];
    if (!best || best.missing !== 0) continue;
    // Every passport the hand also completes is a right answer; too many of them make a muddled question.
    const fits = plans.filter((p) => p.missing === 0);
    if (fits.length > 2 || !fits.some((p) => key(p.names) === key(h.names))) continue;
    const mine = fits.find((p) => key(p.names) === key(h.names))!;
    const fitKeys = new Set(fits.map((p) => key(p.names)));
    const pool = PASSPORT_HANDS.map((x) => key(x.names)).filter((k, i, a) => a.indexOf(k) === i && !fitKeys.has(k));
    const wrong = rng.shuffle(pool).slice(0, 3);
    if (wrong.length < 3) continue;
    const options = rng.shuffle([{ k: key(mine.names), correct: true }, ...wrong.map((k) => ({ k, correct: false }))]);
    const pieces = mine.pieces.map(pieceText).join(' · ');
    const with_ = beside(mine.sets, mine.pair);
    return {
      id: DRILL_ID('passport', seed),
      type: 'passport',
      seed,
      variation: 'india',
      prompt: tr('This hand is complete. Which passport is it built around?'),
      context: tr('India Rules · East round'),
      hand,
      pick: 'option',
      options: options.map((o) => ({ label: passportNames(o.k.split('|')), correct: o.correct })),
      explanation: `${tr('The passport is {passport}: {pieces}.', { passport: passportNames(mine.names), pieces })}${with_ ? ` ${tr('With it: {sets}.', { sets: with_ })}` : ''}${fits.length > 1 ? ` ${tr('The same tiles also read as {other}.', { other: passportNames(fits.find((p) => p !== mine)!.names) })}` : ''}`,
    };
  }
  throw new Error('no passport drill');
}

// ------------------------------------------------------------ keep two passports open

interface Choice {
  kind: number;
  /** Tiles still missing after this discard, by the nearest passport hand. */
  missing: number;
  /** The passports (by name) still open at that distance. */
  open: string[];
}

export function passportDiscardDrill(seed: number): Drill {
  for (let attempt = 0; attempt < 40; attempt++) {
    const rng = new Rng(seedOf(seed, 'passportDiscard', attempt));
    const h = PASSPORT_HANDS[rng.int(PASSPORT_HANDS.length)];
    const base = buildHand(rng, h);
    if (!base) continue;
    // Loosen the hand: two or three tiles swapped for strangers, so there is a way back to more than one passport.
    const counts = toCounts(base);
    const swaps = 2 + rng.int(2);
    for (let s = 0; s < swaps; s++) {
      const held = counts.flatMap((n, k) => (n ? [k] : []));
      const out = held[rng.int(held.length)];
      let into = rng.int(KIND_COUNT);
      for (let t = 0; t < 20 && (counts[into] >= 4 || into === out); t++) into = rng.int(KIND_COUNT);
      if (counts[into] >= 4 || into === out) continue;
      counts[out]--;
      counts[into]++;
    }
    // How far each discard leaves you (the quick search), then which passports stay open for the nearest ones.
    const dist: { kind: number; missing: number }[] = [];
    for (let k = 0; k < KIND_COUNT; k++) {
      if (!counts[k]) continue;
      const c = counts.slice();
      c[k]--;
      dist.push({ kind: k, missing: passportMissing(c, []) });
    }
    const choices: Choice[] = dist.filter((d) => d.missing < 99).map((d) => ({ ...d, open: [] }));
    if (!choices.length) continue;
    const nearest = Math.min(...choices.map((c) => c.missing));
    if (nearest === 0 || nearest > 3) continue;
    const near = choices.filter((c) => c.missing === nearest);
    for (const c of near) {
      const x = counts.slice();
      x[c.kind]--;
      c.open = openAt(x, nearest);
    }
    const most = Math.max(...near.map((c) => c.open.length));
    if (most < 2) continue;
    const right = near.filter((c) => c.open.length === most);
    if (right.length > 2) continue;
    // Something to learn from: a tile at the same distance that keeps fewer open, or one that falls further behind.
    const narrower = near.find((c) => c.open.length < most);
    const slower = choices.find((c) => c.missing > nearest);
    if (!narrower && !slower) continue;
    const hand = counts.flatMap((n, k) => Array<number>(n).fill(k)).sort((a, b) => a - b);
    const best = right[0];
    const openNames = best.open.map((n) => tr(n));
    const fromReady = (missing: number) => (missing <= 1 ? tr('ready') : missing === 2 ? tr('1 from ready') : tr('{n} from ready', { n: missing - 1 }));
    const lesson = narrower
      ? tr('The {tile} would leave you as close but keep only {open}.', { tile: tileLabel(narrower.kind), open: andList(narrower.open.map((n) => tr(n))) })
      : tr('The {tile} would leave you {state}.', { tile: tileLabel(slower!.kind), state: fromReady(slower!.missing) });
    return {
      id: DRILL_ID('passportDiscard', seed),
      type: 'passportDiscard',
      seed,
      variation: 'india',
      prompt: tr('Which discard keeps you nearest a passport, with the most passports still open?'),
      context: tr('India Rules · East round'),
      hand,
      pick: 'tile',
      options: [],
      correctTiles: right.map((c) => c.kind),
      explanation: `${tr('Discard the {tile}: you stay {state} with {open} all open.', { tile: right.length > 1 ? andList(right.map((c) => tileLabel(c.kind))) : tileLabel(best.kind), state: fromReady(best.missing), open: andList(openNames) })} ${lesson}`,
    };
  }
  throw new Error('no passport discard drill');
}
