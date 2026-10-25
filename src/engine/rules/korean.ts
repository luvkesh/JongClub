// Korean Mahjong, three players. A regional family, not a formal ruleset:
// Korean tables are commonly three-handed with a reduced set (the 2–8 of
// Characters taken out, as in Japanese sanma), honours kept, flowers often
// used, no chow claims, and simple additive points with a minimum to win.
// Everything below is JongClub's table default; the choices that vary most
// between tables are house rules.
//
// Table defaults:
//   - 108 tiles (1 and 9 of Characters, all Dots and Bamboo, winds, dragons)
//     plus the eight flowers (116). Flowers are set aside and replaced.
//   - Three seats: East, South, West. North is a plain honour (no seat).
//   - Pung and kong may be claimed; chow may not (house rule: from the left).
//     Sequences still count inside the concealed hand.
//   - Riichi: declaring a concealed ready hand (no deposit) locks it for 1 point.
//   - Points add up (no doubling), limit 10. Two points to win, and flowers
//     pay but never count toward the minimum.
//   - Payments: 100 a point. Self-draw: both others pay. Discard: the
//     discarder pays both shares. Each dealer counter adds 100 per share.
//   - No dead wall: kong and flower replacements come from the back of the wall.

import { KIND_COUNT, WINDS, flowerNumber, isDragon, isHonor, isSuited, isTerminal, isTerminalOrHonor, isWind, suitOf, windKind } from '../tiles';
import type { HandScore, Payment, RuleProfile, ScoreItem, ScoringContext } from './types';

export const KOREAN_LIMIT = 10;
export const KOREAN_POINT = 100;
/** Characters 2–8 are not in the Korean three-player set. */
export const KOREAN_KINDS = Array.from({ length: KIND_COUNT }, (_, k) => k).filter((k) => k >= 9 || k === 0 || k === 8);

type S = { type: 'pung' | 'chow' | 'kong'; kind: number; concealed: boolean };

export function koreanScore(ctx: ScoringContext): HandScore {
  const house = ctx.house ?? {};
  const min = Number(house.minValue ?? 2);
  const flowerRule = house.flowers ?? 'all';
  const items: ScoreItem[] = [];
  const add = (name: string, value: number, note?: string) => items.push({ name, value, note });
  const d = ctx.decomposition;

  const sets: S[] = ctx.melds.map((m) => ({ type: m.type, kind: Math.min(...m.tiles.map((t) => t.kind)), concealed: m.concealed }));
  for (const s of d.sets) {
    if (s.type === 'pair') continue;
    // A pung completed on a discard is not concealed.
    const byDiscard = !ctx.selfDrawn && s.type === 'pung' && s.kind === ctx.winKind && !d.sets.some((x) => x.type === 'chow' && ctx.winKind >= x.kind && ctx.winKind <= x.kind + 2);
    sets.push({ type: s.type, kind: s.kind, concealed: !byDiscard });
  }
  const all: number[] = [];
  for (let k = 0; k < KIND_COUNT; k++) for (let i = 0; i < ctx.concealedCounts[k]; i++) all.push(k);
  for (const m of ctx.melds) for (const t of m.tiles) all.push(t.kind);
  const closed = ctx.melds.every((m) => m.concealed);
  const pungs = sets.filter((s) => s.type !== 'chow');
  const dragonPungs = pungs.filter((s) => isDragon(s.kind));
  const windPungs = pungs.filter((s) => isWind(s.kind));
  const suits = new Set(all.filter(isSuited).map(suitOf));
  const hasHonour = all.some(isHonor);

  // Limit hands
  let limit: string | null = null;
  if (d.shape === 'thirteenOrphans') limit = 'Thirteen Orphans';
  else if (all.every(isHonor)) limit = 'All Honours';
  else if (all.every(isTerminal)) limit = 'All Terminals';
  else if (dragonPungs.length === 3) limit = 'Big Three Dragons';
  else if (windPungs.length === 4) limit = 'Big Four Winds';
  else if (windPungs.length === 3 && isWind(d.pair)) limit = 'Small Four Winds';
  else if (d.shape === 'standard' && pungs.length === 4 && pungs.every((p) => p.concealed)) limit = 'Four Concealed Pungs';
  else if (sets.filter((s) => s.type === 'kong').length === 4) limit = 'Four Kongs';

  if (limit) add(limit, KOREAN_LIMIT, 'Limit hand');
  else {
    if (ctx.selfDrawn) add('Self-drawn', 1);
    if (closed) add('Concealed hand', 1);
    if (ctx.riichi) add('Riichi', 1, 'Declared ready with a concealed hand');
    if (d.shape === 'sevenPairs') add('Seven Pairs', 2);
    if (d.shape === 'standard') {
      for (const p of dragonPungs) add(['Red', 'Green', 'White'][p.kind - 31] + ' Dragon pung', 1);
      if (pungs.some((p) => p.kind === windKind(ctx.seatWind))) add('Seat wind pung', 1);
      if (pungs.some((p) => p.kind === windKind(ctx.prevailingWind))) add('Round wind pung', 1);
      if (pungs.length === 4) add('All Pungs', 2);
      if (pungs.filter((p) => p.concealed).length === 3) add('Three Concealed Pungs', 2);
      if (dragonPungs.length === 2 && isDragon(d.pair)) add('Small Three Dragons', 2);
    }
    if (all.every((k) => !isTerminalOrHonor(k))) add('All Simples', 1);
    else if (all.every(isTerminalOrHonor)) add('Terminals and Honours', 2);
    if (suits.size === 1 && !hasHonour) add('Pure One Suit', 5);
    else if (suits.size === 1 && hasHonour) add('Mixed One Suit', 2);
    if (ctx.afterKong) add('Win after Kong', 1);
    if (ctx.robbedKong) add('Robbing the Kong', 1);
    if (ctx.lastTileOfWall) add('Last tile', 1);
  }
  const core = Math.min(KOREAN_LIMIT, items.reduce((a, b) => a + b.value, 0));

  // Flowers pay, but never count toward the minimum.
  let flowerPts = 0;
  if (flowerRule !== 'off') {
    const seatNo = WINDS.indexOf(ctx.seatWind) + 1;
    for (const f of ctx.flowers ?? []) {
      if (flowerRule === 'all' || flowerNumber(f) === seatNo) flowerPts++;
    }
    if (flowerPts) add(flowerRule === 'all' ? 'Flowers' : 'Seat flowers', flowerPts, 'Paid, not counted toward the minimum');
  }
  const value = Math.min(KOREAN_LIMIT, core + flowerPts);
  return { value, unit: 'pt', items, points: KOREAN_POINT * value, limit: value >= KOREAN_LIMIT, qualifies: core >= min };
}

/** Self-draw: every other player pays. Discard: the discarder pays every share. */
export function koreanPayments(winner: number, discarder: number | null, s: HandScore, _dealer: number, players: number, counters: number): Payment[] {
  const share = s.points + KOREAN_POINT * counters;
  if (discarder !== null) return [{ from: discarder, to: winner, amount: share * (players - 1) }];
  const out: Payment[] = [];
  for (let p = 0; p < players; p++) if (p !== winner) out.push({ from: p, to: winner, amount: share });
  return out;
}

/** House rule: on a discard, the discarder pays one extra share and the bystander one share. */
export function koreanSplitPayments(winner: number, discarder: number | null, s: HandScore, dealer: number, players: number, counters: number): Payment[] {
  if (discarder === null) return koreanPayments(winner, null, s, dealer, players, counters);
  const share = s.points + KOREAN_POINT * counters;
  const out: Payment[] = [];
  for (let p = 0; p < players; p++) if (p !== winner) out.push({ from: p, to: winner, amount: p === discarder ? share * 2 : share });
  return out;
}

export const koreanProfile: RuleProfile = {
  id: 'korean3',
  name: 'Korean Mahjong',
  region: 'Korea',
  flag: '🇰🇷',
  summary:
    'Three players, 108 tiles plus flowers (Characters 2–8 removed), no chow claims, and simple points: two to win, flowers pay but never count toward the minimum. Korean tables vary; these are JongClub’s table defaults.',
  players: 3,
  tileKinds: KOREAN_KINDS,
  copiesPerKind: 4,
  handSize: 13,
  calls: { chow: false, pung: true, exposedKong: true, concealedKong: true, addedKong: true, chowFromLeftOnly: true },
  shapes: { sevenPairs: true, thirteenOrphans: true },
  minValue: 2,
  rounds: {
    prevailingWinds: ['E', 'S'],
    seatWindOrder: ['E', 'S', 'W'],
    handsPerWind: 3,
    dealerRetention: 'onDealerWin',
    maxHands: 0,
  },
  score: koreanScore,
  payments: koreanPayments,
  startingScore: 10000,
  flowers: true,
  deadWall: 0,
  riichi: { cost: 0, minLiveTiles: 3 },
  furiten: false,
  robKong: true,
  endOnBust: true,
  scoreUnit: 'points',
  callNames: { chow: 'Chow', pung: 'Pung', kong: 'Kong', win: 'Mahjong', selfDraw: 'Mahjong', riichi: 'Riichi' },
  yakuRequired: false,
  felt: '#20304a',
  tableName: 'Seoul Indigo',
  configure(c) {
    return {
      flowers: c.flowers !== 'off',
      riichi: c.riichi === 'off' ? undefined : { cost: 0, minLiveTiles: 3 },
      calls: { chow: c.chow === 'left', pung: true, exposedKong: true, concealedKong: true, addedKong: true, chowFromLeftOnly: true },
      shapes: { sevenPairs: c.sevenPairs !== 'off', thirteenOrphans: true },
      payments: c.payout === 'split' ? koreanSplitPayments : koreanPayments,
    };
  },
  houseRules: [
    {
      id: 'minValue',
      label: 'Minimum to win',
      options: [
        { value: '1', label: '1 point' },
        { value: '2', label: '2 points' },
        { value: '3', label: '3 points' },
      ],
      default: '2',
    },
    {
      id: 'flowers',
      label: 'Flowers',
      options: [
        { value: 'all', label: 'Every flower pays 1 point (116 tiles)' },
        { value: 'seat', label: 'Only your seat’s flowers pay (116 tiles)' },
        { value: 'off', label: 'No flowers (108 tiles)' },
      ],
      default: 'all',
    },
    {
      id: 'riichi',
      label: 'Riichi (ready declaration)',
      options: [
        { value: 'on', label: 'Allowed: lock a concealed hand for 1 point' },
        { value: 'off', label: 'Not played' },
      ],
      default: 'on',
    },
    {
      id: 'chow',
      label: 'Chow',
      options: [
        { value: 'off', label: 'No chow claims' },
        { value: 'left', label: 'From the player on your left' },
      ],
      default: 'off',
    },
    {
      id: 'sevenPairs',
      label: 'Seven pairs',
      options: [
        { value: 'on', label: 'Allowed (2 points)' },
        { value: 'off', label: 'Not allowed' },
      ],
      default: 'on',
    },
    {
      id: 'payout',
      label: 'On a discard win',
      options: [
        { value: 'discarder', label: 'Discarder pays both shares' },
        { value: 'split', label: 'Discarder pays double, the other player one share' },
      ],
      default: 'discarder',
    },
    {
      id: 'dealerRetention',
      label: 'Dealer keeps the deal',
      options: [
        { value: 'onDealerWin', label: 'When dealer wins' },
        { value: 'onDealerWinOrDraw', label: 'On win or draw' },
        { value: 'never', label: 'Never' },
      ],
      default: 'onDealerWin',
    },
  ],
};
