// Classic Mahjong: the beginner-friendly Chinese game JongClub teaches first.
// 136 tiles, 13-tile hands, chow/pung/kong, four sets and a pair, scored in
// faan (doubles) with a limit. Based on common Hong Kong-style club play;
// minimum faan and dealer rotation are house rules.
// Flowers and seasons are in play by default (144 tiles; a house rule turns
// them off): the eight bonus tiles are set aside when drawn and replaced from
// the back of the wall. Your own flower and your own season are 1 faan each,
// and all four flowers or all four seasons are 2 faan for that set, as in Hong
// Kong club play.
// Mixed sets (house rule `mixedSets`, on): as at Indian and Dubai tables, a
// concealed set may be a mixed pung (crochet: 5 of each suit) or a mixed chow
// (a run with one tile from each suit), and the pair may be a knit (the same
// number in two suits). Four mixed pungs and a knit is Crochet; seven knits is
// Knitting. See special.ts. Special wind rounds are a house rule too
// (windRounds.ts).

import { KIND_COUNT, isDragon, isHonor, isSuited, isWind, suitOf, windKind } from '../tiles';
import type { SetShape } from '../hand';
import { flowerItems } from './flowerFaan';
import { goulashRules } from './goulash';
import { MIXED_FAAN, mixedHandsRule, mixedPairItems, mixedSetItems } from './mixed';
import { KNITTING, MIXED_SETS, bestMixedReading } from './special';
import { SPECIAL_ROUND_ORDER, SPECIAL_ROUND_RULES } from './windRounds';
import type { HandScore, Payment, RuleProfile, ScoreItem, ScoringContext } from './types';

const LIMIT = 8;
const BASE = 16;

export function classicScore(ctx: ScoringContext): HandScore {
  const items: ScoreItem[] = [];
  const d = ctx.decomposition;
  const add = (name: string, value: number, note?: string) => items.push({ name, value, note });

  if (d.shape === 'thirteenOrphans') return limitHand('Thirteen Orphans', ctx);
  if (d.shape === 'special') return classicSpecialScore(ctx);

  // Collect every set (declared + concealed) as {type, kind, concealed}.
  type S = { type: 'pung' | 'chow' | 'kong'; kind: number; concealed: boolean };
  const sets: S[] = ctx.melds.map((m) => ({
    type: m.type,
    kind: Math.min(...m.tiles.map((t) => t.kind)),
    concealed: m.concealed,
  }));
  for (const s of d.sets) {
    if (s.type === 'pair') continue;
    // A pung completed by a discard counts as exposed.
    const byDiscard = !ctx.selfDrawn && s.type === 'pung' && s.kind === ctx.winKind;
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
  const pairKind = d.pair;

  // Limit hands
  if (allKinds.every(isHonor)) return limitHand('All Honours', ctx);
  if (dragonPungs.length === 3) return limitHand('Big Three Dragons', ctx);
  if (windPungs.length === 4) return limitHand('Big Four Winds', ctx);
  if (d.shape === 'standard' && pungs.length === 4 && pungs.every((p) => p.concealed)) return limitHand('Four Concealed Pungs', ctx);

  const exposed = ctx.melds.some((m) => !m.concealed);
  if (ctx.selfDrawn) add('Self-drawn', 1);
  if (!exposed) add('Concealed hand', 1);

  if (d.shape === 'sevenPairs') add('Seven Pairs', 4);

  if (d.shape === 'standard') {
    const valuePair = pairKind >= 0 && (isDragon(pairKind) || pairKind === windKind(ctx.seatWind) || pairKind === windKind(ctx.prevailingWind));
    if (sets.every((s) => s.type === 'chow') && !valuePair) add('All Chows', 1);
    if (pungs.length === 4) add('All Pungs', 3);
    for (const p of dragonPungs) add(['Red', 'Green', 'White'][p.kind - 31] + ' Dragon pung', 1);
    if (pungs.some((p) => p.kind === windKind(ctx.seatWind))) add('Seat wind pung', 1);
    if (pungs.some((p) => p.kind === windKind(ctx.prevailingWind))) add('Round wind pung', 1);
    if (dragonPungs.length === 2 && isDragon(pairKind)) add('Small Three Dragons', 3);
    if (windPungs.length === 3 && isWind(pairKind)) add('Small Four Winds', 6);
    const kongs = sets.filter((s) => s.type === 'kong').length;
    if (kongs >= 2) add(`${kongs} Kongs`, kongs - 1);
    if (ctx.house?.mixedHands !== 'off') items.push(...mixedSetItems(sets, MIXED_FAAN));
  }
  if (d.shape === 'sevenPairs' && ctx.house?.mixedHands !== 'off') items.push(...mixedPairItems(ctx.concealedCounts, MIXED_FAAN));

  if (suits.size === 1 && !hasHonor) add('Pure One Suit', 7);
  else if (suits.size === 1 && hasHonor) add('Mixed One Suit', 3);

  if (ctx.afterKong) add('Win after Kong', 1);
  if (ctx.robbedKong) add('Robbing the Kong', 1);
  if (ctx.lastTileOfWall) add('Last tile', 1);

  if (!items.length) add('Chicken hand', 0, 'A plain winning hand');

  const value = Math.min(items.reduce((a, b) => a + b.value, 0), LIMIT);
  return { value, unit: 'faan', items, points: BASE * 2 ** value, limit: value >= LIMIT };
}

/** Faan for a crochet or knitting hand, or a hand that uses mixed sets. */
function classicSpecialScore(ctx: ScoringContext): HandScore {
  const d = ctx.decomposition;
  const total = (items: ScoreItem[]): HandScore => {
    if (!items.some((i) => i.value > 0)) items.push({ name: 'Chicken hand', value: 0, note: 'A plain winning hand' });
    const value = Math.min(items.reduce((a, b) => a + b.value, 0), LIMIT);
    return { value, unit: 'faan', items, points: BASE * 2 ** value, limit: value >= LIMIT };
  };
  if (d.special === 'Knitting') {
    const items: ScoreItem[] = [];
    if (ctx.selfDrawn) items.push({ name: 'Self-drawn', value: 1 });
    items.push({ name: 'Concealed hand', value: 1 }, { name: 'Knitting', value: 4, note: 'Seven knits from two suits' });
    return total(items);
  }
  const r = d.special === 'Mixed sets' ? bestMixedReading(ctx.concealedCounts, ctx.melds.length) : null;
  if (!r) return total([]);
  // Score the plain sets as usual, then add what is mixed.
  const plain: SetShape[] = r.sets.filter((x) => x.type === 'pung' || x.type === 'chow').map((x) => ({ type: x.type as 'pung' | 'chow', kind: x.kinds[0] }));
  const knit = r.pair[0] !== r.pair[1];
  const base = classicScore({ ...ctx, decomposition: { shape: 'standard', sets: plain, pair: knit ? -1 : r.pair[0] } });
  const items = base.items.filter((i) => !['All Chows', 'All Pungs', 'Chicken hand'].includes(i.name) && !i.name.endsWith(' Kongs'));
  const mixedPungs = r.sets.filter((x) => x.type === 'mixedPung').length;
  const mixedChows = r.sets.filter((x) => x.type === 'mixedChow').length;
  if (mixedPungs === 4 && knit) items.push({ name: 'Crochet', value: 6, note: 'Four mixed pungs and a knit' });
  else {
    if (mixedPungs) items.push({ name: mixedPungs > 1 ? `Mixed pung × ${mixedPungs}` : 'Mixed pung', value: mixedPungs, note: 'The same number in all three suits' });
    if (mixedChows) items.push({ name: mixedChows > 1 ? `Mixed chow × ${mixedChows}` : 'Mixed chow', value: 0, note: 'A run with one tile from each suit' });
    if (knit) items.push({ name: 'Knit pair', value: 0, note: 'The same number in two suits' });
  }
  return total(items);
}

/** Classic with its flower house rule: seat flower and season 1 faan each, a full set 2. */
export function classicFlowerScore(ctx: ScoringContext): HandScore {
  const s = classicScore(ctx);
  if (ctx.house?.flowers === 'off' || s.limit) return s;
  const extra = flowerItems(ctx);
  if (!extra.length) return s;
  const items = [...s.items.filter((i) => i.name !== 'Chicken hand'), ...extra];
  const value = Math.min(items.reduce((a, b) => a + b.value, 0), LIMIT);
  return { ...s, items, value, points: BASE * 2 ** value, limit: value >= LIMIT };
}

function limitHand(name: string, ctx: ScoringContext): HandScore {
  const items: ScoreItem[] = [{ name, value: LIMIT, note: 'Limit hand' }];
  if (ctx.selfDrawn) items.push({ name: 'Self-drawn', value: 0, note: 'Included in limit' });
  return { value: LIMIT, unit: 'faan', items, points: BASE * 2 ** LIMIT, limit: true };
}

export function classicPayments(winner: number, discarder: number | null, s: HandScore, _dealer: number, players: number, _bonus: number): Payment[] {
  const out: Payment[] = [];
  if (discarder === null) {
    for (let p = 0; p < players; p++) if (p !== winner) out.push({ from: p, to: winner, amount: s.points });
  } else {
    // Discarder pays double; the other players pay half each (club "half-gun").
    for (let p = 0; p < players; p++) {
      if (p === winner) continue;
      out.push({ from: p, to: winner, amount: p === discarder ? s.points * 2 : s.points / 2 });
    }
  }
  return out;
}

export const classicProfile: RuleProfile = {
  id: 'classic',
  name: 'Classic Mahjong',
  region: 'China',
  flag: '🇨🇳',
  summary: 'Four sets and a pair. Chow, pung and kong. The friendliest way to learn.',
  players: 4,
  tileKinds: Array.from({ length: KIND_COUNT }, (_, k) => k),
  copiesPerKind: 4,
  handSize: 13,
  calls: { chow: true, pung: true, exposedKong: true, concealedKong: true, addedKong: true, chowFromLeftOnly: true },
  shapes: { sevenPairs: true, thirteenOrphans: true },
  minValue: 0,
  rounds: {
    prevailingWinds: ['E', 'S', 'W', 'N'],
    seatWindOrder: ['E', 'S', 'W', 'N'],
    handsPerWind: 4,
    dealerRetention: 'onDealerWin',
    maxHands: 0,
  },
  score: classicFlowerScore,
  payments: classicPayments,
  startingScore: 5000,
  deadWall: 0,
  furiten: false,
  robKong: true,
  endOnBust: false,
  callNames: { chow: 'Chow', pung: 'Pung', kong: 'Kong', win: 'Mahjong', selfDraw: 'Mahjong' },
  yakuRequired: false,
  felt: '#17402f',
  tableName: 'Classic Green',
  houseRules: [
    {
      id: 'minValue',
      label: 'Minimum to win',
      options: [
        { value: '0', label: 'No minimum' },
        { value: '1', label: '1 faan' },
        { value: '3', label: '3 faan' },
      ],
      default: '0',
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
    {
      id: 'flowers',
      label: 'Flowers and seasons',
      options: [
        { value: 'off', label: 'Not used (136 tiles)' },
        { value: 'on', label: 'In play: your own flower and season score (144 tiles)' },
      ],
      default: 'on',
    },
    {
      id: 'mixedSets',
      label: 'Mixed sets and knits',
      options: [
        { value: 'on', label: 'Allowed: mixed pungs (crochet), mixed chows and knits, concealed' },
        { value: 'off', label: 'Not allowed: every set is one suit' },
      ],
      default: 'on',
    },
    mixedHandsRule('on'),
    ...SPECIAL_ROUND_RULES,
    ...goulashRules(true),
  ],
  configure(c) {
    const mixed = c.mixedSets !== 'off';
    return {
      flowers: c.flowers === 'on',
      shapes: { ...classicProfile.shapes, special: mixed ? [MIXED_SETS, KNITTING] : undefined },
      windRounds: c.specialRounds === 'on' ? { ...SPECIAL_ROUND_ORDER } : undefined,
    };
  },
};

