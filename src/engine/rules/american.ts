// American Mahjong, kept entirely separate from the Asian variants.
// 152 tiles: the 136 standard tiles, eight flowers (all interchangeable)
// and eight jokers. No chows. A win must match a hand on the card exactly.
// The Charleston passes tiles before play, and the deal passes every hand.
//
// The hands below are JongClub's own card, written in the American style.
// They are not the National Mah Jongg League card, which is published
// each year and is its own copyrighted work.

import { FLOWER_BASE, JOKER_KIND, KIND_COUNT, Tile, isFlower, isJoker, tileName } from '../tiles';
import type { Meld } from '../state';
import type { HandScore, Payment, RuleProfile } from './types';

// ------------------------------------------------------------------ the card

export interface CardHand {
  id: string;
  section: string;
  /** Pattern as printed on the card (see CARD_KEY). */
  pattern: string;
  value: number;
  /** Concealed hands may only call a discard for Mah Jongg. */
  concealed: boolean;
}

/** How to read a pattern. Shown under the card in the app. */
export const CARD_KEY = [
  'Each block is one group: FF is a pair of flowers, 2222 is a kong of 2s.',
  'Colours are suits: one colour is one suit, different colours are different suits.',
  'x, y, z and w are consecutive numbers you choose (x = 3 makes y = 4, z = 5).',
  'D is the dragon that matches its suit: Red with Craks, Green with Bams, Soap with Dots. 0 is Soap.',
  'R, G and 0 are Red, Green and Soap dragons. N E W S are the winds. F is any flower.',
  'Jokers may stand in for any tile in a group of three or more, never in a pair or single.',
  'C hands are concealed: you may only call a discard to complete the hand.',
];

const H = (section: string, pattern: string, value: number, concealed = false): Omit<CardHand, 'id'> => ({ section, pattern, value, concealed });

const RAW: Omit<CardHand, 'id'>[] = [
  H('2026', 'FFFF 2026a 222b 222c', 25),
  H('2026', '222a 000 2222b 6666c', 25),
  H('2026', 'NN EEE WWW SS 2026a', 30),
  H('2026', 'FF 2026a 2026b 2026c', 30, true),
  H('2468', '222a 4444a 666a 8888a', 25),
  H('2468', 'FF 2222a 44b 66b 8888a', 25),
  H('2468', '22a 44a 666b 888b DDDDc', 25),
  H('Like Numbers', 'FF xxxxa xxxxb xxxxc', 25),
  H('Like Numbers', 'FFFF xxxa xxxb DDDDc', 30),
  H('Quints', 'FF xxxxxa yyyyya DDb', 40),
  H('Quints', 'FFFFF xxxxxa yyyya', 40),
  H('Consecutive Run', 'xxxa yyyya zzzza wwwa', 25),
  H('Consecutive Run', 'FFFF xxxa yyyb zzzzc', 25),
  H('Consecutive Run', 'FF xxxxa yya zzzza DDa', 30),
  H('13579', '11a 333a 5555a 777a 99a', 25),
  H('13579', '1111a 333a 5555b 777b', 25),
  H('13579', 'FFFF 999a DDDa 99b 99c', 30),
  H('Winds & Dragons', 'NNNN EEE WWW SSSS', 25),
  H('Winds & Dragons', 'FF NNN EEE WWW SSS', 25),
  H('Winds & Dragons', 'FF RRRR GGG 000 NN', 30),
  H('369', '333a 666a 9999a DDDDa', 25),
  H('369', 'FF 3333a 66b 66c 9999a', 25),
  H('Singles & Pairs', 'FF 22a 44a 66a 88a 22b 22c', 50, true),
  H('Singles & Pairs', 'xxa yya zza wwa xxb yyb zzb', 50, true),
  H('Singles & Pairs', '11a 33a 55a 77a 99a 11b 11c', 50, true),
  H('Singles & Pairs', 'NN EE WW SS RR GG 00', 50, true),
];

export const CARD: CardHand[] = RAW.map((h, i) => ({ ...h, id: `h${i + 1}` }));

// ------------------------------------------------------------------ expansion

/** Flowers are interchangeable, so matching treats every flower as one kind. */
export const FLOWER = FLOWER_BASE;
const SLOTS = KIND_COUNT + 1;
const SUIT_BASE = [0, 9, 18]; // Craks (man), Dots (pin), Bams (sou)
const SUIT_DRAGON = [31, 33, 32]; // Red, Soap, Green
const WIND: Record<string, number> = { E: 27, S: 28, W: 29, N: 30 };
const OFFSET: Record<string, number> = { x: 0, y: 1, z: 2, w: 3 };

export interface Group {
  kind: number;
  size: number;
}

export interface CardInstance {
  hand: CardHand;
  groups: Group[];
  /** Natural tiles needed per kind for the groups that can't take jokers. */
  label: string;
}

function tokenGroups(token: string, suits: Record<string, number>, n: number): Group[] {
  const m = token.match(/^(.+?)([abc])?$/)!;
  const body = m[1];
  const suit = m[2] ? suits[m[2]] : -1;
  const kindOf = (ch: string): number => {
    if (ch === 'F') return FLOWER;
    if (ch in WIND) return WIND[ch];
    if (ch === 'R') return 31;
    if (ch === 'G') return 32;
    if (ch === '0') return 33;
    if (ch === 'D') return SUIT_DRAGON[suit];
    const rank = ch in OFFSET ? n + OFFSET[ch] : Number(ch);
    return SUIT_BASE[suit] + rank - 1;
  };
  // A block of one repeated symbol is one group; mixed symbols (2026) are singles.
  if ([...body].every((c) => c === body[0])) return [{ kind: kindOf(body[0]), size: body.length }];
  const out: Group[] = [];
  for (let i = 0; i < body.length; ) {
    let j = i;
    while (j < body.length && body[j] === body[i]) j++;
    out.push({ kind: kindOf(body[i]), size: j - i });
    i = j;
  }
  return out;
}

const PERMS = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
];

function expand(hand: CardHand): CardInstance[] {
  const tokens = hand.pattern.split(' ');
  const maxOff = Math.max(-1, ...[...hand.pattern].filter((c) => c in OFFSET).map((c) => OFFSET[c]));
  const numbers = maxOff >= 0 ? Array.from({ length: 9 - maxOff }, (_, i) => i + 1) : [0];
  const seen = new Set<string>();
  const out: CardInstance[] = [];
  for (const perm of PERMS)
    for (const n of numbers) {
      const suits = { a: perm[0], b: perm[1], c: perm[2] };
      const groups = tokens.flatMap((t) => tokenGroups(t, suits, n));
      const key = groups
        .map((g) => `${g.kind}x${g.size}`)
        .sort()
        .join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ hand, groups, label: groups.map((g) => `${g.size}×${tileName(g.kind === FLOWER ? FLOWER_BASE : g.kind)}`).join(', ') });
    }
  return out;
}

export const INSTANCES: CardInstance[] = CARD.flatMap(expand);

// ------------------------------------------------------------------ matching

const norm = (kind: number) => (isFlower(kind) ? FLOWER : kind);

/** The base kind an exposure stands for (its first natural tile). */
export function meldKind(m: Meld): number {
  const t = m.tiles.find((x) => !isJoker(x.kind));
  return t ? norm(t.kind) : -1;
}

export interface Progress {
  instance: CardInstance;
  /** Tiles still needed to complete this hand. */
  missing: number;
}

/**
 * How far concealed tiles plus exposures are from a card hand.
 * Exposures must each be one whole group of that hand; jokers fill
 * only groups of three or more. Returns Infinity when impossible.
 */
export function missingFor(inst: CardInstance, hand: Tile[], melds: Meld[]): number {
  if (melds.length && inst.hand.concealed) return Infinity;
  const used = new Array(inst.groups.length).fill(false);
  for (const m of melds) {
    const k = meldKind(m);
    const i = inst.groups.findIndex((g, gi) => !used[gi] && g.kind === k && g.size === m.tiles.length);
    if (i < 0) return Infinity;
    used[i] = true;
  }
  const counts = new Array(SLOTS).fill(0);
  let jokers = 0;
  for (const t of hand) {
    if (isJoker(t.kind)) jokers++;
    else counts[norm(t.kind)]++;
  }
  let small = 0;
  let big = 0;
  // Fill pairs and singles first (naturals only), then sets (jokers allowed).
  const order = inst.groups.map((_, i) => i).filter((i) => !used[i]);
  order.sort((a, b) => inst.groups[a].size - inst.groups[b].size);
  for (const i of order) {
    const g = inst.groups[i];
    const take = Math.min(counts[g.kind], g.size);
    counts[g.kind] -= take;
    if (g.size < 3) small += g.size - take;
    else big += g.size - take;
  }
  return small + Math.max(0, big - jokers);
}

/** Card hands ranked by how close they are. */
export function progress(hand: Tile[], melds: Meld[], limit = 5): Progress[] {
  const out: Progress[] = [];
  for (const inst of INSTANCES) {
    const missing = missingFor(inst, hand, melds);
    if (missing !== Infinity) out.push({ instance: inst, missing });
  }
  out.sort((a, b) => a.missing - b.missing || b.instance.hand.value - a.instance.hand.value);
  return out.slice(0, limit);
}

export function distance(hand: Tile[], melds: Meld[]): number {
  let best = Infinity;
  for (const inst of INSTANCES) best = Math.min(best, missingFor(inst, hand, melds));
  return best;
}

/** Score a complete 14-tile hand (concealed tiles include the winning tile). */
export function evaluateCard(hand: Tile[], melds: Meld[], selfDrawn: boolean): HandScore | null {
  const total = hand.length + melds.reduce((a, m) => a + m.tiles.length, 0);
  if (total !== 14) return null;
  let best: HandScore | null = null;
  for (const inst of INSTANCES) {
    if (missingFor(inst, hand, melds) !== 0) continue;
    const h = inst.hand;
    const jokerless = ![...hand, ...melds.flatMap((m) => m.tiles)].some((t) => isJoker(t.kind));
    const items = [{ name: `${h.section}: ${h.pattern}`, value: h.value, note: h.concealed ? 'Concealed' : undefined }];
    let value = h.value;
    // Jokerless doubles the value, except for hands that can't use jokers anyway.
    if (jokerless && !h.section.startsWith('Singles')) {
      items.push({ name: 'Jokerless', value: h.value, note: 'Doubled' });
      value *= 2;
    }
    if (selfDrawn) items.push({ name: 'Self-picked', value: 0, note: 'Everyone pays double' });
    const s: HandScore = { value, unit: 'pts', items, points: value, limit: false, tier: h.section };
    if (!best || s.points > best.points) best = s;
  }
  return best;
}

// ------------------------------------------------------------------ profile

// The engine routes American hands through evaluateCard; sets-and-a-pair readings never qualify.
function score(): HandScore {
  return { value: 0, unit: 'pts', items: [], points: 0, limit: false, qualifies: false };
}

function payments(winner: number, discarder: number | null, s: HandScore, _dealer: number, players: number): Payment[] {
  const out: Payment[] = [];
  for (let p = 0; p < players; p++) {
    if (p === winner) continue;
    // Self-picked: everyone pays double. Discard: the discarder pays double, the rest single.
    const amount = discarder === null || p === discarder ? s.points * 2 : s.points;
    out.push({ from: p, to: winner, amount });
  }
  return out;
}

export const americanProfile: RuleProfile = {
  discards: 'centre',
  id: 'american',
  name: 'American Mahjong',
  region: 'USA',
  flag: '🇺🇸',
  summary: 'Jokers, the Charleston and a card of hands. Match a hand on the card exactly.',
  players: 4,
  tileKinds: Array.from({ length: KIND_COUNT }, (_, k) => k),
  copiesPerKind: 4,
  handSize: 13,
  calls: { chow: false, pung: true, exposedKong: true, concealedKong: false, addedKong: false, chowFromLeftOnly: true },
  shapes: { sevenPairs: false, thirteenOrphans: false },
  minValue: 0,
  rounds: {
    prevailingWinds: ['E'],
    seatWindOrder: ['E', 'S', 'W', 'N'],
    handsPerWind: 4,
    dealerRetention: 'never',
    maxHands: 0,
  },
  score,
  payments,
  startingScore: 2000,
  flowers: true,
  jokers: 8,
  card: { evaluate: evaluateCard, distance, jokerKind: JOKER_KIND },
  charleston: true,
  deadWall: 0,
  furiten: false,
  // No robbing the kong in American play (and no added kongs at all).
  robKong: false,
  endOnBust: false,
  callNames: { chow: 'Chow', pung: 'Pung', kong: 'Kong', win: 'Mah Jongg', selfDraw: 'Mah Jongg' },
  yakuRequired: false,
  felt: '#3a2a1c',
  tableName: 'Manhattan',
  // Goulash: a table custom, not an NMJL rule. After a wall game East stays
  // East for one more hand, and in that hand's Charleston jokers may be passed.
  configure(c) {
    return { goulash: c.goulash === 'on' };
  },
  houseRules: [
    {
      id: 'goulash',
      label: 'After a wall game',
      options: [
        { value: 'off', label: 'Deal passes as usual' },
        { value: 'on', label: 'Goulash (East stays, jokers may be passed)' },
      ],
      default: 'off',
    },
  ],
};
