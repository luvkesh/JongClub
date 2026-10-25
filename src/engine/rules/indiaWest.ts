// India Rules, Round 3 (West): Goulash, as the club rulebook has it (pp. 26-29,
// the Goulash Scoring Chart pp. 41-42; docs/variants/india-rules.md).
//
//   - Only pungs, kongs and one pure pair. No chows, crochets, knits or mixed chows.
//   - A hand counts only when it is clean: one suit with honours (with an honour
//     pung or kong), one suit alone, all honours, honours with terminal pungs in
//     one suit (a major hand), or pungs and kongs of 1s and 9s in any suits.
//   - Mahjong needs at least 3 doubles. Score = points x 2^doubles, +20 points
//     for Mahjong. East pays and receives double; the winner pays nobody.
//   - Every other player with a clean hand and at least one pung or kong also
//     scores, paid by the other losers, unless the penalty is paid.
//   - Penalty: a player with 3 exposed pungs/kongs wins on a discard from a player
//     who is not calling: the thrower pays for the whole table and nobody else counts.
//
// Readings where the book is silent are marked [reading] and listed in the spec.

import { FLOWER_BASE, WINDS, isDragon, isHonor, isTerminal, type Wind } from '../tiles';
import type { Meld } from '../state';
import type { HandScore, Payment, ScoreItem, ScoringContext, SettleInfo } from './types';

/** A pung or kong as the Goulash count sees it. */
export interface Group {
  kind: number;
  kong: boolean;
  /** Formed in the hand (or a kong declared from it), not from a discard. */
  concealed: boolean;
}

export type CleanKind = 'All honours' | 'Clean suit' | 'Terminal hand' | 'Major hand' | 'One suit with honours';

/** Doubles a clean hand earns for itself (a suit with honours earns none). */
const CLEAN_DOUBLES: Record<CleanKind, number> = { 'All honours': 3, 'Clean suit': 3, 'Terminal hand': 3, 'Major hand': 1, 'One suit with honours': 0 };

/** The Goulash Scoring Chart stops at 10 doubles. [reading] */
export const WEST_MAX_DOUBLES = 10;
export const WEST_MIN_DOUBLES = 3;
export const MAHJONG_POINTS = 20;

const major = (k: number) => isHonor(k) || isTerminal(k);
const windKind = (w: Wind) => 27 + WINDS.indexOf(w);

/** Is a hand clean, and which kind of clean? `kinds` is every tile the player holds, melds included. */
export function cleanKind(kinds: number[], groups: Group[]): CleanKind | null {
  const suits = new Set(kinds.filter((k) => k < 27).map((k) => Math.floor(k / 9)));
  const honours = kinds.some(isHonor);
  if (!suits.size) return 'All honours';
  if (suits.size === 1 && !honours) return 'Clean suit';
  const allTerminal = kinds.filter((k) => k < 27).every(isTerminal);
  if (allTerminal && !honours) return 'Terminal hand';
  if (suits.size !== 1) return null;
  // Honours with one suit: an honour hand can't end with only a terminal pair, and a
  // suit hand can't end with only an honour pair (notes 8 and 9, p. 29).
  if (allTerminal) return groups.some((g) => isTerminal(g.kind)) ? 'Major hand' : null;
  return groups.some((g) => isHonor(g.kind)) ? 'One suit with honours' : null;
}

export interface WestWin {
  selfDrawn: boolean;
  /** No exposed pung or kong. */
  concealed: boolean;
  lastTile: boolean;
  earthly: boolean;
  heavenly: boolean;
}

export interface WestCount {
  clean: CleanKind | null;
  points: number;
  doubles: number;
  items: ScoreItem[];
  score: number;
}

/** Points and doubles for a hand (pp. 27-29). `win` is set for the Mahjong hand only. */
export function westCount(kinds: number[], groups: Group[], pair: number | null, flowers: number[], seat: Wind, prevailing: Wind, win?: WestWin): WestCount {
  const clean = cleanKind(kinds, groups);
  const items: ScoreItem[] = [];
  const add = (name: string, value: number) => value && items.push({ name, value });
  if (clean) add(clean, CLEAN_DOUBLES[clean]);
  const has = (k: number) => groups.some((g) => g.kind === k);
  for (let s = 0; s < 3; s++) if (has(s * 9) && has(s * 9 + 8)) add('Pungs of 1 and 9 in one suit', 1);
  const dragons = groups.filter((g) => isDragon(g.kind)).length;
  for (let i = 0; i < dragons; i++) add('Dragon pung', 1);
  if (dragons === 3) add('All three dragons', 1);
  const winds = groups.filter((g) => g.kind >= 27 && g.kind <= 30).length;
  if (winds === 4 && pair !== null && isDragon(pair)) add('4 wind pungs and a pair of dragons', 7);
  else if (winds === 4) add('4 wind pungs', 2);
  else if (winds === 3) add('3 wind pungs', 1);
  if (has(windKind(seat))) add('Own wind pung', 1);
  if (has(windKind(prevailing))) add('Round wind pung', 1);
  const cPungs = groups.filter((g) => g.concealed && !g.kong).length;
  if (cPungs >= 4) add('4 concealed pungs', 2);
  else if (cPungs === 3) add('3 concealed pungs', 1);
  const eKongs = groups.filter((g) => !g.concealed && g.kong).length;
  if (eKongs >= 4) add('4 exposed kongs', 3);
  else if (eKongs === 3) add('3 exposed kongs', 2);
  const cKongs = groups.filter((g) => g.concealed && g.kong).length;
  if (cKongs >= 4) add('4 concealed kongs', 4);
  else if (cKongs === 3) add('3 concealed kongs', 3);
  if (win) {
    if (win.concealed) add('Concealed Mahjong', 3);
    if (win.lastTile) add('Mahjong on the last tile', 1);
    if (win.heavenly) add('Heaven’s Blessing', 9);
    else if (win.earthly) add('Earth’s Blessing', 8);
  }
  // Flowers and seasons: own number (East 1 ... North 4) and the round's (3), each one double.
  const own = WINDS.indexOf(seat);
  const round = WINDS.indexOf(prevailing);
  for (const f of flowers) {
    const n = (f - FLOWER_BASE) % 4;
    if (n === own) add(f - FLOWER_BASE < 4 ? 'Own flower' : 'Own season', 1);
    if (n === round) add(f - FLOWER_BASE < 4 ? 'Round flower' : 'Round season', 1);
  }
  for (const b of [0, 4]) if ([0, 1, 2, 3].every((i) => flowers.includes(FLOWER_BASE + b + i))) add(b ? 'Bouquet of seasons' : 'Bouquet of flowers', 3);
  const doubles = Math.min(items.reduce((a, b) => a + b.value, 0), WEST_MAX_DOUBLES);

  let points = 0;
  for (const g of groups) points += (g.kong ? (major(g.kind) ? 16 : 8) : major(g.kind) ? 4 : 2) * (g.concealed ? 2 : 1);
  points += flowers.length * 4;
  if (pair !== null && major(pair)) points += 2;
  if (win) points += MAHJONG_POINTS;
  return { clean, points, doubles, items, score: points * 2 ** doubles };
}

/** The Goulash count of a winning hand. */
export function westScore(ctx: ScoringContext): HandScore {
  const groups: Group[] = ctx.melds.filter((m) => m.type !== 'chow').map((m) => ({ kind: m.tiles[0].kind, kong: m.type === 'kong', concealed: m.concealed }));
  for (const s of ctx.decomposition.sets) {
    if (s.type !== 'pung') continue;
    // A pung finished by the discard counts as exposed.
    groups.push({ kind: s.kind, kong: false, concealed: ctx.selfDrawn || s.kind !== ctx.winKind || ctx.decomposition.pair === ctx.winKind });
  }
  const kinds: number[] = [];
  ctx.concealedCounts.forEach((n, k) => {
    for (let i = 0; i < n && k < 34; i++) kinds.push(k);
  });
  for (const m of ctx.melds) kinds.push(...m.tiles.map((t) => t.kind));
  const pair = ctx.decomposition.shape === 'standard' ? ctx.decomposition.pair : null;
  const c = westCount(kinds, groups, pair, ctx.flowers ?? [], ctx.seatWind, ctx.prevailingWind, {
    selfDrawn: ctx.selfDrawn,
    concealed: !ctx.melds.some((m) => !m.concealed),
    lastTile: ctx.lastTileOfWall,
    earthly: !!ctx.earthly,
    heavenly: !!ctx.heavenly,
  });
  const ok = ctx.decomposition.shape === 'standard' && !!c.clean && !ctx.decomposition.sets.some((s) => s.type === 'chow') && c.doubles >= WEST_MIN_DOUBLES;
  const items = [...c.items, { name: `${c.points} points x ${2 ** c.doubles}`, value: 0, note: `${c.points} points doubled ${c.doubles} times` }];
  if (!c.clean) items.unshift({ name: 'Dirty hand: no count', value: 0 });
  return { value: c.doubles, unit: 'doubles', items, points: c.score, limit: false, qualifies: ok };
}

/** A losing hand's count: pungs it holds (declared or in hand), one major pair, flowers. [reading] */
export function loserCount(concealed: number[], melds: Meld[], flowers: number[], seat: Wind, prevailing: Wind): WestCount {
  const groups: Group[] = melds.filter((m) => m.type !== 'chow').map((m) => ({ kind: m.tiles[0].kind, kong: m.type === 'kong', concealed: m.concealed }));
  const counts = new Array(34).fill(0);
  for (const k of concealed) if (k < 34) counts[k]++;
  let pair: number | null = null;
  for (let k = 0; k < 34; k++) {
    if (counts[k] >= 3) groups.push({ kind: k, kong: false, concealed: true });
    else if (counts[k] === 2 && major(k) && pair === null) pair = k;
  }
  const kinds = [...concealed.filter((k) => k < 34), ...melds.flatMap((m) => m.tiles.map((t) => t.kind))];
  const c = westCount(kinds, groups, pair, flowers, seat, prevailing);
  // At least one pung or kong is needed for a count (note 7, p. 29).
  if (!c.clean || !groups.length) return { ...c, score: 0 };
  return c;
}

/** Settlement for a West-round hand: the win, the penalty and the losers' counts. */
export function westPayments(info: SettleInfo): Payment[] {
  const { winner, discarder, dealer, players } = info;
  if (winner === null || !info.score || !info.hands) return []; // a draw: nobody scores [reading]
  const mult = (a: number, b: number) => (a === dealer || b === dealer ? 2 : 1);
  const out: Payment[] = [];
  const exposed = info.hands[winner].melds.filter((m) => !m.concealed && m.type !== 'chow').length;
  if (exposed >= 3 && discarder !== null && !info.calling?.(discarder)) {
    let total = 0;
    for (let p = 0; p < players; p++) if (p !== winner) total += info.score.points * mult(p, winner);
    out.push({ from: discarder, to: winner, amount: total, reason: 'Penalty: pays for the table' });
    return out;
  }
  for (let p = 0; p < players; p++) if (p !== winner) out.push({ from: p, to: winner, amount: info.score.points * mult(p, winner) });
  for (let l = 0; l < players; l++) {
    if (l === winner) continue;
    const h = info.hands[l];
    const c = loserCount(h.concealed, h.melds, info.flowers[l] ?? [], info.seatWinds[l], info.prevailing);
    if (!c.score) continue;
    for (let p = 0; p < players; p++) if (p !== winner && p !== l) out.push({ from: p, to: l, amount: c.score * mult(p, l), reason: `Count: ${c.clean}` });
  }
  return out;
}
