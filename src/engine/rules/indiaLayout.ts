// India Rules, East round: a hand laid out the way the club reads it, its passports first and
// apart, then the other sets and the pair. Used by the hand summary and All hands, for the
// winner (the reading the win was scored on) and for everyone else (any passport they hold).

import type { MeldShape } from '../hand';
import type { Meld } from '../state';
import type { Tile } from '../tiles';
import { eastReading, passportOf, type Piece } from './india';

export interface PassportLayout {
  /** Each passport with its pieces as tiles (declared melds keep their own tiles). */
  passports: { name: string; sets: LaidPiece[]; melds: Meld[] }[];
  /** Declared melds outside the passports. */
  melds: Meld[];
  /** Concealed pieces outside the passports: sets, then the pair (a complete hand only). */
  sets: LaidPiece[];
  /** Tiles in no piece (a hand that isn't complete). */
  loose: Tile[];
}

/** A concealed piece with its tiles; `t` names it (pung, chow, mixed chow, crochet, pair, knit...). */
export interface LaidPiece {
  t: Piece['t'];
  tiles: Tile[];
}

const meldShape = (m: Meld): MeldShape => ({ type: m.type, kind: Math.min(...m.tiles.map((t) => t.kind)) });
const counted = (hand: Tile[]) => {
  const c = new Array(34).fill(0);
  for (const t of hand) if (t.kind < 34) c[t.kind]++;
  return c;
};

/** Lay out a hand. `complete`: read it as a finished hand (with the passport rule); otherwise find
 *  the biggest passport it already holds. */
export function passportLayout(hand: Tile[], melds: Meld[], passportOnly: boolean): PassportLayout {
  const pool = new Map<number, Tile[]>();
  for (const t of [...hand].sort((a, b) => a.kind - b.kind || a.id - b.id)) if (t.kind < 34) pool.set(t.kind, [...(pool.get(t.kind) ?? []), t]);
  const take = (p: Piece): LaidPiece => ({ t: p.t, tiles: p.k.map((k) => pool.get(k)!.shift()!) });
  const counts = counted(hand);
  const shapes = melds.map(meldShape);
  const out: PassportLayout = { passports: [], melds: [], sets: [], loose: [] };
  // Pieces 0..melds.length-1 are the declared melds, in order.
  const place = (pieces: Piece[], groups: number[][], names: string[]) => {
    const inPassport = new Set(groups.flat());
    groups.forEach((g, i) => {
      const sets: LaidPiece[] = [];
      const ms: Meld[] = [];
      for (const j of g) (j < melds.length ? ms.push(melds[j]) : sets.push(take(pieces[j])));
      out.passports.push({ name: names[i], sets, melds: ms });
    });
    pieces.forEach((p, j) => {
      if (inPassport.has(j)) return;
      if (j < melds.length) out.melds.push(melds[j]);
      else out.sets.push(take(p));
    });
    // Twos (the pair) last.
    out.sets.sort((a, b) => Number(a.tiles.length === 2) - Number(b.tiles.length === 2));
    out.loose = [...pool.values()].flat();
  };
  const total = counts.reduce((a, b) => a + b, 0) + 3 * melds.length;
  const reading = total === 14 ? eastReading(counts, shapes, passportOnly) : null;
  if (reading) {
    place(reading.pieces, reading.groups, reading.passports);
    return out;
  }
  // Not a finished hand: the biggest passport held, from candidate pieces and declared melds.
  const best = heldPassport(counts, shapes);
  const usedMelds = new Set<number>();
  if (best) {
    const sets: LaidPiece[] = [];
    const ms: Meld[] = [];
    for (const p of best.pieces) {
      if (p.meld !== undefined && typeof p.meldIndex === 'number') {
        ms.push(melds[p.meldIndex]);
        usedMelds.add(p.meldIndex);
      } else sets.push(take(p));
    }
    out.passports.push({ name: best.name, sets, melds: ms });
  }
  out.melds = melds.filter((_, i) => !usedMelds.has(i));
  out.loose = [...pool.values()].flat();
  return out;
}
/** The biggest passport these tiles and melds already hold, or null. */
type HeldPiece = Piece & { meldIndex?: number };

function heldPassport(counts: number[], melds: MeldShape[]): { name: string; pieces: HeldPiece[] } | null {
  const cands: HeldPiece[] = melds.map((m, i) => ({ t: m.type, k: m.type === 'chow' ? [m.kind, m.kind + 1, m.kind + 2] : Array(m.type === 'kong' ? 4 : 3).fill(m.kind), meld: true, meldIndex: i }));
  // Every piece the concealed tiles could make on their own.
  const seen = new Set<string>();
  const one = (p: Piece) => {
    const key = p.t + p.k.join('.');
    if (!seen.has(key)) {
      seen.add(key);
      cands.push(p);
    }
  };
  const has = (ks: number[]) => {
    const need = new Map<number, number>();
    for (const k of ks) need.set(k, (need.get(k) ?? 0) + 1);
    return [...need].every(([k, n]) => counts[k] >= n);
  };
  for (let k = 0; k < 34; k++) {
    if (counts[k] >= 3) one({ t: 'pung', k: [k, k, k] });
    if (counts[k] >= 2) one({ t: 'pair', k: [k, k] });
    if (k < 27) {
      const s = Math.floor(k / 9), r = k % 9;
      if (r <= 6 && has([k, k + 1, k + 2])) one({ t: 'chow', k: [k, k + 1, k + 2] });
      if (s === 0 && has([k, k + 9, k + 18])) one({ t: 'crochet', k: [k, k + 9, k + 18] });
      for (let s2 = s + 1; s2 < 3; s2++) if (has([k, s2 * 9 + r])) one({ t: 'knit', k: [k, s2 * 9 + r] });
      if (r <= 6)
        for (const a of [0, 1, 2]) for (const b of [0, 1, 2]) if (a !== s && b !== s && a !== b && has([k, a * 9 + r + 1, b * 9 + r + 2])) one({ t: 'mchow', k: [k, a * 9 + r + 1, b * 9 + r + 2] });
    }
  }
  for (const w of [27, 28, 29, 30]) if (has([27, 28, 29, 30, w])) one({ t: 'news5', k: [27, 28, 29, 30, w] });
  if (has([31, 32, 33])) one({ t: 'grw', k: [31, 32, 33] });
  // Every passport of one, two or three pieces that the tiles can make at once; the biggest wins.
  const fits = (ps: HeldPiece[]) => {
    const c = counts.slice();
    for (const p of ps) {
      if (p.meld) continue;
      for (const k of p.k) if (--c[k] < 0) return false;
    }
    return true;
  };
  const size = (ps: Piece[]) => ps.reduce((a, p) => a + (p.t === 'kong' ? 3 : p.k.length), 0);
  let best: { name: string; pieces: HeldPiece[] } | null = null;
  const consider = (ps: HeldPiece[]) => {
    const name = passportOf(ps);
    if (!name || !fits(ps) || size(ps) !== (ps.length === 3 ? (ps[0].k.length === 2 ? 6 : 9) : 5)) return;
    if (!best || size(ps) > size(best.pieces)) best = { name, pieces: ps };
  };
  const n = cands.length;
  for (let i = 0; i < n; i++) {
    consider([cands[i]]);
    for (let j = i + 1; j < n; j++) {
      consider([cands[i], cands[j]]);
      for (let k = j + 1; k < n; k++) consider([cands[i], cands[j], cands[k]]);
    }
  }
  return best;
}
