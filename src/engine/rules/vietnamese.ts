// Vietnamese Mahjong (Mạt chược): a club profile, not an official ruleset.
// Vietnamese sets add eight "Khung" jokers to the 144 tiles: two each of the
// Flower Joker (a bonus tile, set aside like a flower), the Wind Joker (any
// wind), the Dragon Joker (any dragon) and the Number Joker (any suited tile).
// Hands are scored in phán, which are added up, not doubled. Phán lists,
// joker counts and who pays vary from table to table, so the host sets them.

import { DRAGON_JOKER, FLOWER_BASE, FLOWER_JOKER, KIND_COUNT, NUMBER_JOKER, WIND_JOKER, WINDS, isDragon, isFlower, isHonor, isSuited, isWind, suitOf, windKind } from '../tiles';
import { classicProfile } from './classic';
import type { HandScore, Payment, RuleProfile, ScoreItem, ScoringContext } from './types';

/** Points per payment share: (1 + phán) stakes of this size. */
export const VN_STAKE = 20;

const KHUNG = [FLOWER_JOKER, FLOWER_JOKER, WIND_JOKER, WIND_JOKER, DRAGON_JOKER, DRAGON_JOKER, NUMBER_JOKER, NUMBER_JOKER];

export function vietnameseScore(ctx: ScoringContext): HandScore {
  const items: ScoreItem[] = [];
  const add = (name: string, value: number, note?: string) => items.push({ name, value, note });
  const d = ctx.decomposition;

  type S = { type: 'pung' | 'chow' | 'kong'; kind: number };
  const sets: S[] = ctx.melds.map((m) => ({ type: m.type, kind: Math.min(...m.tiles.map((t) => t.kind)) }));
  for (const x of d.sets) if (x.type !== 'pair') sets.push({ type: x.type, kind: x.kind });
  const allKinds: number[] = [];
  for (let k = 0; k < KIND_COUNT; k++) for (let i = 0; i < ctx.concealedCounts[k]; i++) allKinds.push(k);
  for (const m of ctx.melds) for (const t of m.tiles) allKinds.push(t.kind);
  const suits = new Set(allKinds.filter(isSuited).map(suitOf));
  const hasHonor = allKinds.some(isHonor);
  const pungs = sets.filter((x) => x.type !== 'chow');
  const dragonPungs = pungs.filter((x) => isDragon(x.kind));
  const windPungs = pungs.filter((x) => isWind(x.kind));
  const exposed = ctx.melds.some((m) => !m.concealed);
  const bonus = ctx.flowers ?? [];

  // How the hand was won
  if (ctx.selfDrawn) add('Self-drawn (Tự bốc)', 1);
  if (!exposed) add('Concealed hand (Bất cầu)', 1, 'No calls');
  if (ctx.lastTileOfWall) add('Last tile', 2);
  if (ctx.afterKong) add('Win after kong', 1);
  if (ctx.robbedKong) add('Robbing the kong', 1);

  // Shape and suits
  const valuePair = isDragon(d.pair) || d.pair === windKind(ctx.seatWind) || d.pair === windKind(ctx.prevailingWind);
  if (d.shape === 'sevenPairs') add('Seven Pairs', 3, 'House rule: seven different pairs, no jokers');
  else if (sets.every((x) => x.type === 'chow') && !valuePair) add('All chows (Ù phình)', 1);
  if (pungs.length === 4) add('All pungs (Ù tui tui)', 3);
  if (allKinds.every(isHonor)) add('All honours (Toàn chữ)', 18);
  else if (suits.size === 1 && !hasHonor) add('Full flush (Mủn cun)', 6, 'One suit only');
  else if (suits.size === 1) add('Half flush', 3, 'One suit with honours');

  // Honours
  if (dragonPungs.length === 3) add('Big three dragons (Đại tam nguyên)', 12);
  else if (dragonPungs.length === 2 && isDragon(d.pair)) add('Small three dragons (Tiểu tam nguyên)', 6);
  else for (const p of dragonPungs) add(['Red', 'Green', 'White'][p.kind - 31] + ' Dragon pung', 1);
  if (windPungs.length === 4) add('Big four winds (Đại tứ hỷ)', 36);
  else if (windPungs.length === 3 && isWind(d.pair)) add('Small four winds (Tiểu tứ hỷ)', 24);
  else {
    if (pungs.some((p) => p.kind === windKind(ctx.seatWind))) add('Seat wind pung', 1);
    if (pungs.some((p) => p.kind === windKind(ctx.prevailingWind))) add('Round wind pung', 1);
  }

  // Flowers and jokers
  const flowers = bonus.filter(isFlower);
  const seatNo = WINDS.indexOf(ctx.seatWind) + 1;
  for (const [from, name] of [
    [FLOWER_BASE, 'All four plants'],
    [FLOWER_BASE + 4, 'All four seasons'],
  ] as const) {
    if ([0, 1, 2, 3].every((i) => flowers.includes(from + i))) add(name, 2);
    else if (flowers.includes(from + seatNo - 1)) add('Seat flower (Hoa vị trí)', 1);
  }
  const flowerJokers = bonus.filter((k) => k === FLOWER_JOKER).length;
  if (flowerJokers) add(`Flower Joker × ${flowerJokers}`, flowerJokers);
  if (!bonus.length && ctx.house?.flowers !== 'off') add('No flowers (Không hoa)', 1);
  if (ctx.house?.jokers !== 'off' && ctx.house?.cleanBonus !== 'off' && !ctx.wildsUsed) add('No jokers used', 1);

  const value = items.reduce((a, b) => a + b.value, 0);
  if (!items.length) add('Plain win (Ù muỗi)', 0, 'No phán: one stake');
  return { value, unit: 'phán', items, points: VN_STAKE * (1 + value), limit: value >= 12 };
}

/** Self-draw: everyone pays. Discard: the discarder pays for the whole table. */
function discarderPays(winner: number, discarder: number | null, s: HandScore, _dealer: number, players: number): Payment[] {
  if (discarder !== null) return [{ from: discarder, to: winner, amount: s.points * (players - 1) }];
  const out: Payment[] = [];
  for (let p = 0; p < players; p++) if (p !== winner) out.push({ from: p, to: winner, amount: s.points });
  return out;
}

/** Discard: the discarder pays double, the others one share each. */
function shared(winner: number, discarder: number | null, s: HandScore, _dealer: number, players: number): Payment[] {
  const out: Payment[] = [];
  for (let p = 0; p < players; p++) if (p !== winner) out.push({ from: p, to: winner, amount: discarder === null || p !== discarder ? s.points : s.points * 2 });
  return out;
}

/** Discard: only the discarder pays, one share. */
function discarderOnly(winner: number, discarder: number | null, s: HandScore, dealer: number, players: number): Payment[] {
  if (discarder === null) return discarderPays(winner, null, s, dealer, players);
  return [{ from: discarder, to: winner, amount: s.points }];
}

const SHAPES = { sevenPairs: false, thirteenOrphans: false };

export const vietnameseProfile: RuleProfile = {
  ...classicProfile,
  id: 'vietnamese',
  name: 'Vietnamese Mahjong',
  region: 'Vietnam',
  flag: '🇻🇳',
  summary: 'A club profile for Vietnamese play: Khung jokers for winds, dragons and numbers, flowers, and phán added up. Tables vary, so the host sets the house rules.',
  shapes: SHAPES,
  minValue: 0,
  rounds: { ...classicProfile.rounds },
  score: vietnameseScore,
  payments: discarderPays,
  startingScore: 5000,
  flowers: true,
  extraTiles: KHUNG,
  bonusKinds: [FLOWER_JOKER],
  wilds: { inPair: true, inChow: true, inCalls: true, discard: true },
  robKong: true,
  callNames: { chow: 'Ăn', pung: 'Phỗng', kong: 'Chiếu', win: 'Ù', selfDraw: 'Ù' },
  scoreUnit: 'phán',
  felt: '#7a2a1e',
  tableName: 'Saigon Lacquer',
  configure(c) {
    const jokers = c.jokers !== 'off';
    return {
      extraTiles: jokers ? KHUNG : [],
      wilds: jokers ? { inPair: true, inChow: true, inCalls: c.jokerCalls !== 'off', discard: true } : undefined,
      bonusKinds: jokers ? [FLOWER_JOKER] : [],
      flowers: c.flowers !== 'off',
      payments: c.payout === 'shared' ? shared : c.payout === 'discarderOnly' ? discarderOnly : discarderPays,
      shapes: { ...SHAPES, sevenPairs: c.sevenPairs === 'on' },
    };
  },
  houseRules: [
    {
      id: 'jokers',
      label: 'Khung jokers',
      options: [
        { value: 'on', label: 'Eight jokers (152 tiles)' },
        { value: 'off', label: 'No jokers (144 tiles)' },
      ],
      default: 'on',
    },
    {
      id: 'jokerCalls',
      label: 'Jokers in a called pung',
      options: [
        { value: 'on', label: 'Allowed (one joker)' },
        { value: 'off', label: 'Naturals only' },
      ],
      default: 'on',
    },
    {
      id: 'cleanBonus',
      label: 'Win without jokers',
      options: [
        { value: 'on', label: '+1 phán' },
        { value: 'off', label: 'No bonus' },
      ],
      default: 'on',
    },
    {
      id: 'flowers',
      label: 'Flowers',
      options: [
        { value: 'on', label: 'With flowers' },
        { value: 'off', label: 'No flowers' },
      ],
      default: 'on',
    },
    {
      id: 'sevenPairs',
      label: 'Seven pairs',
      options: [
        { value: 'off', label: 'Not allowed' },
        { value: 'on', label: 'Allowed (3 phán)' },
      ],
      default: 'off',
    },
    {
      id: 'minValue',
      label: 'Minimum to win',
      options: [
        { value: '0', label: 'No minimum (Ù muỗi allowed)' },
        { value: '1', label: '1 phán' },
        { value: '3', label: '3 phán' },
      ],
      default: '0',
    },
    {
      id: 'payout',
      label: 'On a discard win',
      options: [
        { value: 'discarder', label: 'Discarder pays for everyone' },
        { value: 'shared', label: 'Discarder pays double, others one share' },
        { value: 'discarderOnly', label: 'Only the discarder pays, one share' },
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
