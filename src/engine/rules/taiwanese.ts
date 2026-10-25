// Taiwanese 16-tile Mahjong: 144 tiles with eight flowers, 16-tile hands,
// five sets and a pair. Scored in tai: each payment is a base stake plus a
// fixed amount per tai, and only the discarder pays on a discard win.
// Based on common Taiwanese home and club play; the tai list varies by
// table, so the minimum to win is a house rule. The "Dubai club card" scoring
// option swaps tai for the points card in taiwaneseDubai.ts.

import { sevenPairsShanten, waits, type SpecialShape } from '../hand';
import { FLOWER_BASE, KIND_COUNT, WINDS, flowerNumber, isDragon, isHonor, isSuited, isWind, suitOf, windKind } from '../tiles';
import type { HandScore, Payment, RuleProfile, ScoreItem, ScoringContext } from './types';
import { DUBAI_SHAPES, DUBAI_START, dubaiChase, dubaiFlowerWin, dubaiInstant, dubaiPayments, dubaiScore, nicoNico, nicoShanten } from './taiwaneseDubai';
import { MIXED_TAI, mixedHandsRule, mixedSetItems } from './mixed';

export const TW_BASE = 300;
export const TW_PER_TAI = 100;

/** Tai the dealer carries: 1, plus 2 for each consecutive deal kept. */
export const dealerTai = (streak: number) => 1 + 2 * streak;

const SHAPES = { sevenPairs: false, thirteenOrphans: false, sets: 5 };

/** Lì Gǔ Lì Gǔ (嚦咕嚦咕): the 16-tile all-pairs hand, seven pairs and one pung, fully concealed. */
export const LI_GU: SpecialShape = {
  name: 'liGu',
  complete: nicoNico,
  shanten: nicoShanten,
  ai: true,
  pairs: true,
  // Never far below plain seven pairs (a four-of-a-kind counts as two pairs here), so far hands skip it.
  bound: (c, m) => (m > 0 ? 99 : sevenPairsShanten(c) - 4),
};
const SHAPES_LI_GU = { ...SHAPES, special: [LI_GU] };
export const LI_GU_NAME = 'Li Gu Li Gu';

function score(ctx: ScoringContext): HandScore {
  const items: ScoreItem[] = [];
  const add = (name: string, value: number, note?: string) => items.push({ name, value, note });
  const d = ctx.decomposition;

  type S = { type: 'pung' | 'chow' | 'kong'; kind: number; concealed: boolean };
  const sets: S[] = ctx.melds.map((m) => ({ type: m.type, kind: Math.min(...m.tiles.map((t) => t.kind)), concealed: m.concealed }));
  // On a discard win, the pung completed by that tile is not concealed,
  // unless this reading can place the tile in the pair or a chow instead.
  const winElsewhere = d.pair === ctx.winKind || d.sets.some((s) => s.type === 'chow' && ctx.winKind >= s.kind && ctx.winKind <= s.kind + 2);
  let claimed = false;
  for (const s of d.sets) {
    if (s.type === 'pair') continue;
    const byDiscard = !ctx.selfDrawn && !winElsewhere && !claimed && s.type === 'pung' && s.kind === ctx.winKind;
    if (byDiscard) claimed = true;
    sets.push({ type: s.type, kind: s.kind, concealed: !byDiscard });
  }

  const allKinds: number[] = [];
  for (let k = 0; k < KIND_COUNT; k++) for (let i = 0; i < ctx.concealedCounts[k]; i++) allKinds.push(k);
  for (const m of ctx.melds) for (const t of m.tiles) allKinds.push(t.kind);
  const suits = new Set(allKinds.filter(isSuited).map(suitOf));
  const hasHonor = allKinds.some(isHonor);
  const pungs = sets.filter((s) => s.type !== 'chow');
  const dragonPungs = pungs.filter((s) => isDragon(s.kind));
  const windPungs = pungs.filter((s) => isWind(s.kind));
  const exposed = ctx.melds.filter((m) => !m.concealed).length;
  const flowers = ctx.flowers ?? [];

  const liGu = d.shape === 'special' && d.special === 'liGu';
  // Wait shape: a single possible winning tile earns a tai.
  const before = ctx.concealedCounts.slice();
  before[ctx.winKind]--;
  const waitCount = waits(before, ctx.melds.length, liGu ? SHAPES_LI_GU : SHAPES).length;

  // Dealer
  if (ctx.isDealer) {
    add('Dealer', 1);
    if (ctx.dealerRepeat > 0) add(`Dealer streak × ${ctx.dealerRepeat}`, 2 * ctx.dealerRepeat);
  }

  // How the hand was won. Lì Gǔ Lì Gǔ is concealed by definition, so its tai include the concealed hand.
  if (liGu) {
    add(LI_GU_NAME, 8, 'Seven pairs and a pung, all concealed');
    if (ctx.selfDrawn) add('Self-draw', 1);
  } else if (exposed === 0 && ctx.selfDrawn) add('Concealed self-draw', 3, 'Concealed hand and self-draw together');
  else {
    if (exposed === 0) add('Concealed hand', 1);
    if (ctx.selfDrawn) add('Self-draw', 1);
  }
  if (exposed === 5 && !ctx.selfDrawn) add('All melded', 2, 'Every set called, won on a discard');
  if (waitCount === 1 && !liGu) add('Single wait', 1);
  if (ctx.lastTileOfWall) add(ctx.selfDrawn ? 'Last tile self-draw' : 'Last discard', 1);
  if (ctx.afterKong) add('Win on replacement', 1);
  if (ctx.robbedKong) add('Robbing the kong', 1);

  // Shape
  const allChows = !liGu && sets.every((s) => s.type === 'chow');
  if (allChows && !hasHonor && flowers.length === 0 && !ctx.selfDrawn && waitCount >= 2) add('Ping Hu', 2, 'All chows, no honours or flowers, open wait');
  if (pungs.length === 5) add('All pungs', 4);
  if (ctx.house?.mixedHands === 'on') items.push(...mixedSetItems(sets, MIXED_TAI));
  const hidden = pungs.filter((p) => p.concealed).length;
  if (hidden >= 5) add('Five concealed pungs', 8);
  else if (hidden === 4) add('Four concealed pungs', 5);
  else if (hidden === 3) add('Three concealed pungs', 2);

  // Suits
  if (allKinds.every(isHonor)) add('All honours', 16);
  else if (suits.size === 1 && !hasHonor) add('Full flush', 8);
  else if (suits.size === 1) add('Half flush', 4);

  // Honours
  if (dragonPungs.length === 3) add('Big three dragons', 8);
  else if (dragonPungs.length === 2 && isDragon(d.pair)) add('Small three dragons', 4);
  else for (const p of dragonPungs) add(['Red', 'Green', 'White'][p.kind - 31] + ' Dragon pung', 1);
  if (windPungs.length === 4) add('Big four winds', 16);
  else if (windPungs.length === 3 && isWind(d.pair)) add('Small four winds', 8);
  else {
    if (pungs.some((p) => p.kind === windKind(ctx.seatWind))) add('Seat wind pung', 1);
    if (pungs.some((p) => p.kind === windKind(ctx.prevailingWind))) add('Round wind pung', 1);
  }

  // Flowers
  if (flowers.length === 8) add('Eight flowers', 8);
  else {
    const seatNo = WINDS.indexOf(ctx.seatWind) + 1;
    for (const [from, name] of [
      [FLOWER_BASE, 'All four plants'],
      [FLOWER_BASE + 4, 'All four seasons'],
    ] as const) {
      const set = [0, 1, 2, 3].every((i) => flowers.includes(from + i));
      if (set) add(name, 2);
      else for (const f of flowers) if (f >= from && f < from + 4 && flowerNumber(f) === seatNo) add('Seat flower', 1);
    }
  }

  const value = items.reduce((a, b) => a + b.value, 0);
  if (!items.length) add('Plain win', 0, 'No tai: base stake only');
  return { value, unit: 'tai', items, points: TW_BASE + value * TW_PER_TAI, base: TW_BASE, limit: value >= 16 };
}

function payments(winner: number, discarder: number | null, s: HandScore, dealer: number, players: number, streak: number): Payment[] {
  const out: Payment[] = [];
  // When the dealer pays a non-dealer winner, the dealer's tai are added to that payment.
  const extra = (payer: number) => (payer === dealer && winner !== dealer ? dealerTai(streak) * TW_PER_TAI : 0);
  if (discarder === null) {
    for (let p = 0; p < players; p++) if (p !== winner) out.push({ from: p, to: winner, amount: s.points + extra(p) });
  } else {
    out.push({ from: discarder, to: winner, amount: s.points + extra(discarder) });
  }
  return out;
}

export const taiwaneseProfile: RuleProfile = {
  id: 'taiwanese',
  name: 'Taiwanese Mahjong',
  region: 'Taiwan',
  flag: '🇹🇼',
  summary: '16-tile hands, five sets and a pair, flowers and tai. Only the discarder pays.',
  players: 4,
  tileKinds: Array.from({ length: KIND_COUNT }, (_, k) => k),
  copiesPerKind: 4,
  handSize: 16,
  calls: { chow: true, pung: true, exposedKong: true, concealedKong: true, addedKong: true, chowFromLeftOnly: true },
  shapes: SHAPES_LI_GU,
  minValue: 0,
  rounds: {
    prevailingWinds: ['E', 'S', 'W', 'N'],
    seatWindOrder: ['E', 'S', 'W', 'N'],
    handsPerWind: 4,
    dealerRetention: 'onDealerWinOrDraw',
    maxHands: 0,
  },
  score,
  payments,
  startingScore: 10000,
  flowers: true,
  // The last 16 tiles are never drawn; the hand is a draw when only they remain.
  deadWall: 16,
  furiten: false,
  robKong: true,
  endOnBust: false,
  callNames: { chow: 'Chi', pung: 'Pong', kong: 'Gang', win: 'Hu', selfDraw: 'Zimo' },
  yakuRequired: false,
  felt: '#0f4a46',
  tableName: 'Jade Palace',
  configure(c) {
    if (c.scoring !== 'dubai') return { shapes: c.liGu === 'off' ? SHAPES : SHAPES_LI_GU };
    return {
      score: dubaiScore,
      payments: dubaiPayments(false),
      shapes: DUBAI_SHAPES,
      minValue: 0,
      startingScore: DUBAI_START,
      scoreUnit: 'pt',
      instantPayments: dubaiInstant,
      chasePayments: dubaiChase,
      drawPot: 5,
      flowerWin: dubaiFlowerWin,
      // "Closing/Calling": declare a ready, concealed hand. No deposit.
      riichi: { cost: 0, minLiveTiles: 4 },
      callNames: { ...taiwaneseProfile.callNames, riichi: 'Call' },
    };
  },
  houseRules: [
    {
      id: 'scoring',
      label: 'Scoring',
      options: [
        { value: 'tai', label: 'Tai (Taiwan)' },
        { value: 'dubai', label: 'Dubai club card (points)' },
      ],
      default: 'tai',
    },
    {
      id: 'minValue',
      label: 'Minimum to win',
      options: [
        { value: '0', label: 'No minimum' },
        { value: '1', label: '1 tai' },
        { value: '3', label: '3 tai' },
      ],
      default: '0',
    },
    {
      id: 'liGu',
      label: 'Lì Gǔ Lì Gǔ (all pairs)',
      options: [
        { value: 'on', label: 'Allowed: seven pairs and a pung, concealed (8 tai)' },
        { value: 'off', label: 'Not allowed' },
      ],
      default: 'on',
    },
    mixedHandsRule('off'),
  ],
};
