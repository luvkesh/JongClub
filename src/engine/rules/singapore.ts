// Singapore / Malaysian Mahjong: a club profile of common table rules.
// 148 tiles: the 136, eight flowers and four animals (cat, mouse, rooster,
// centipede), all bonus tiles set aside when drawn. Hands are scored in tai,
// capped at 5; a win needs at least 1 tai. Each tai doubles the stake. On a
// discard the "shooter" pays for the whole table; a self-draw is paid double
// by everyone. Animal pairs "bite" and kongs pay on the spot. Stakes, the tai
// list and the instant payments vary by table, so the host can change them.

import { waits } from '../hand';
import { ANIMAL_BASE, CAT, CENTIPEDE, FLOWER_BASE, KIND_COUNT, MOUSE, ROOSTER, WINDS, isAnimal, isDragon, isFlower, isHonor, isSuited, isWind, suitOf, windKind } from '../tiles';
import { classicProfile } from './classic';
import type { HandScore, InstantEvent, Payment, RuleProfile, ScoreItem, ScoringContext } from './types';

export const SG_LIMIT = 5;
/** One payment share for a 1-tai hand; each further tai doubles it. */
export const SG_UNIT = 32;
const ANIMALS = [CAT, MOUSE, ROOSTER, CENTIPEDE];
/** Predator and prey: the cat catches the mouse, the rooster eats the centipede. */
const PARTNER: Record<number, number> = { [CAT]: MOUSE, [MOUSE]: CAT, [ROOSTER]: CENTIPEDE, [CENTIPEDE]: ROOSTER };
const SHAPES = { sevenPairs: false, thirteenOrphans: true };

const limitScore = (name: string): HandScore => ({ value: SG_LIMIT, unit: 'tai', items: [{ name, value: SG_LIMIT, note: 'Limit hand' }], points: SG_UNIT * 2 ** (SG_LIMIT - 1), limit: true });

export function singaporeScore(ctx: ScoringContext): HandScore {
  const items: ScoreItem[] = [];
  const add = (name: string, value: number, note?: string) => items.push({ name, value, note });
  const d = ctx.decomposition;
  if (d.shape === 'thirteenOrphans') return limitScore('Thirteen Wonders');

  type S = { type: 'pung' | 'chow' | 'kong'; kind: number; concealed: boolean };
  const sets: S[] = ctx.melds.map((m) => ({ type: m.type, kind: Math.min(...m.tiles.map((t) => t.kind)), concealed: m.concealed }));
  for (const x of d.sets) if (x.type !== 'pair') sets.push({ type: x.type, kind: x.kind, concealed: true });
  const allKinds: number[] = [];
  for (let k = 0; k < KIND_COUNT; k++) for (let i = 0; i < ctx.concealedCounts[k]; i++) allKinds.push(k);
  for (const m of ctx.melds) for (const t of m.tiles) allKinds.push(t.kind);
  const suits = new Set(allKinds.filter(isSuited).map(suitOf));
  const hasHonor = allKinds.some(isHonor);
  const pungs = sets.filter((x) => x.type !== 'chow');
  const dragonPungs = pungs.filter((x) => isDragon(x.kind));
  const windPungs = pungs.filter((x) => isWind(x.kind));
  const bonus = ctx.flowers ?? [];

  if (allKinds.every(isHonor)) return limitScore('All Honours');
  if (dragonPungs.length === 3) return limitScore('Big Three Dragons');
  if (windPungs.length === 4) return limitScore('Big Four Winds');
  if (windPungs.length === 3 && isWind(d.pair)) return limitScore('Small Four Winds');

  // Shape
  const valuePair = isDragon(d.pair) || d.pair === windKind(ctx.seatWind) || d.pair === windKind(ctx.prevailingWind);
  if (sets.every((x) => x.type === 'chow') && !valuePair && !bonus.length) {
    // Ping Hu needs an open (two-sided) wait as well.
    const before = ctx.concealedCounts.slice();
    before[ctx.winKind]--;
    if (waits(before, ctx.melds.length, SHAPES).length >= 2) add('Ping Hu', 4, 'All chows, no bonus tiles, open wait');
  }
  if (pungs.length === 4) add('Pong Pong', 2, 'All pungs');
  if (suits.size === 1 && !hasHonor) add('Full colour', 4, 'One suit only');
  else if (suits.size === 1) add('Half colour', 2, 'One suit with honours');

  // Honours
  if (dragonPungs.length === 2 && isDragon(d.pair)) add('Small Three Dragons', 4);
  else for (const p of dragonPungs) add(['Red', 'Green', 'White'][p.kind - 31] + ' Dragon pung', 1);
  if (pungs.some((p) => p.kind === windKind(ctx.seatWind))) add('Seat wind pung', 1);
  if (pungs.some((p) => p.kind === windKind(ctx.prevailingWind))) add('Prevailing wind pung', 1);

  // Bonus tiles
  const seatNo = WINDS.indexOf(ctx.seatWind) + 1;
  for (const f of bonus.filter(isFlower)) if (((f - FLOWER_BASE) % 4) + 1 === seatNo) add('Seat flower', 1);
  for (const [from, name] of [
    [FLOWER_BASE, 'Full set of plants'],
    [FLOWER_BASE + 4, 'Full set of seasons'],
  ] as const)
    if ([0, 1, 2, 3].every((i) => bonus.includes(from + i))) add(name, 1);
  for (const a of bonus.filter(isAnimal)) add(['Cat', 'Mouse', 'Rooster', 'Centipede'][a - ANIMAL_BASE], 1, 'Animal');

  // How the hand was won
  if (ctx.afterKong) add('Win on kong replacement', 1);
  if (ctx.robbedKong) add('Robbing the kong', 1);
  if (ctx.lastTileOfWall) add('Last tile', 1);

  const raw = items.reduce((a, b) => a + b.value, 0);
  const value = Math.min(raw, SG_LIMIT);
  if (!items.length) add('No tai', 0, 'Needs at least 1 tai to win');
  return { value, unit: 'tai', items, points: SG_UNIT * 2 ** Math.max(0, value - 1), limit: raw >= SG_LIMIT };
}

/** Self-draw: everyone pays double. Discard: the shooter pays for the table (double plus two singles). */
function shooter(winner: number, discarder: number | null, s: HandScore, _dealer: number, players: number): Payment[] {
  const out: Payment[] = [];
  if (discarder !== null) return [{ from: discarder, to: winner, amount: s.points * (players) }];
  for (let p = 0; p < players; p++) if (p !== winner) out.push({ from: p, to: winner, amount: s.points * 2 });
  return out;
}

/** Self-draw: everyone pays double. Discard: the discarder pays double, the others single. */
function shared(winner: number, discarder: number | null, s: HandScore, _dealer: number, players: number): Payment[] {
  const out: Payment[] = [];
  for (let p = 0; p < players; p++) if (p !== winner) out.push({ from: p, to: winner, amount: discarder === null || p === discarder ? s.points * 2 : s.points });
  return out;
}

const fromOthers = (seat: number, players: number, amount: number): Payment[] =>
  Array.from({ length: players }, (_, p) => p)
    .filter((p) => p !== seat)
    .map((p) => ({ from: p, to: seat, amount }));

/** Instant payments: animal bites and kong money, as the host has set them. */
export function singaporeInstant(bites: boolean, kongMoney: boolean) {
  return (e: InstantEvent, players: number): Payment[] => {
    if (e.type === 'kong') return kongMoney ? fromOthers(e.seat, players, e.concealed ? 2 * SG_UNIT : SG_UNIT) : [];
    if (!bites || !isAnimal(e.kind)) return [];
    const mult = e.dealing ? 2 : 1;
    const out: Payment[] = [];
    // The second of a predator-and-prey pair bites: everyone pays.
    if (e.held.includes(PARTNER[e.kind])) out.push(...fromOthers(e.seat, players, SG_UNIT * mult));
    // All four animals: a bigger bite on top.
    if (ANIMALS.every((a) => e.held.includes(a))) out.push(...fromOthers(e.seat, players, 2 * SG_UNIT * mult));
    return out;
  };
}

/** Seven pairs in tai (Singapore scoring has no pairs line of its own): 3 tai plus the bonus tiles and the way it was won. */
export function sevenPairsTai(ctx: ScoringContext, cap: number): HandScore {
  const base = singaporeScore({ ...ctx, decomposition: { shape: 'standard', sets: [], pair: -1 } });
  if (base.items[0]?.note === 'Limit hand') return { ...base, items: [{ ...base.items[0], value: cap }], value: cap, points: SG_UNIT * 2 ** (cap - 1), limit: true };
  const extras = base.items.filter((i) => i.note === 'Animal' || /flower|plants|seasons|colour|Last tile|kong/i.test(i.name));
  const items = [{ name: 'Seven Pairs', value: 3 }, ...extras];
  const raw = items.reduce((a, b) => a + b.value, 0);
  const value = Math.min(raw, cap);
  return { value, unit: 'tai', items, points: SG_UNIT * 2 ** Math.max(0, value - 1), limit: raw >= cap };
}

const scoreWithPairs = (ctx: ScoringContext) => (ctx.decomposition.shape === 'sevenPairs' ? sevenPairsTai(ctx, SG_LIMIT) : singaporeScore(ctx));

export const singaporeProfile: RuleProfile = {
  ...classicProfile,
  id: 'singapore',
  name: 'Singapore Mahjong',
  region: 'Singapore & Malaysia',
  flag: '🇸🇬',
  summary: 'A club profile for Singapore and Malaysian tables: 148 tiles with four animals, tai capped at 5, the shooter pays, and animal bites pay on the spot. Tables vary, so the host sets the house rules.',
  shapes: SHAPES,
  minValue: 1,
  rounds: { ...classicProfile.rounds },
  score: scoreWithPairs,
  payments: shooter,
  startingScore: 5000,
  flowers: true,
  extraTiles: ANIMALS,
  bonusKinds: ANIMALS,
  instantPayments: singaporeInstant(true, true),
  robKong: true,
  callNames: { chow: 'Chi', pung: 'Pong', kong: 'Kong', win: 'Hu', selfDraw: 'Zimo' },
  scoreUnit: 'tai',
  felt: '#0d3b4f',
  tableName: 'Marina Teal',
  configure(c) {
    return {
      payments: c.payout === 'shared' ? shared : shooter,
      instantPayments: singaporeInstant(c.bites !== 'off', c.kongMoney !== 'off'),
      shapes: { ...SHAPES, sevenPairs: c.sevenPairs === 'on' },
    };
  },
  houseRules: [
    {
      id: 'minValue',
      label: 'Minimum to win',
      options: [
        { value: '1', label: '1 tai' },
        { value: '2', label: '2 tai' },
        { value: '3', label: '3 tai' },
      ],
      default: '1',
    },
    {
      id: 'payout',
      label: 'On a discard win',
      options: [
        { value: 'shooter', label: 'Shooter pays for everyone' },
        { value: 'shared', label: 'Shooter pays double, others single' },
      ],
      default: 'shooter',
    },
    {
      id: 'bites',
      label: 'Animal bites',
      options: [
        { value: 'on', label: 'Paid on the spot' },
        { value: 'off', label: 'Tai only' },
      ],
      default: 'on',
    },
    {
      id: 'kongMoney',
      label: 'Kong money',
      options: [
        { value: 'on', label: 'Paid on the spot' },
        { value: 'off', label: 'None' },
      ],
      default: 'on',
    },
    {
      id: 'sevenPairs',
      label: 'Seven pairs',
      options: [
        { value: 'off', label: 'Not allowed' },
        { value: 'on', label: 'Allowed (3 tai)' },
      ],
      default: 'off',
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
