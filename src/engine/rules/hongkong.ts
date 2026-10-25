// Hong Kong Mahjong (Cantonese "Old Hong Kong" club play). 144 tiles with the
// eight flowers, four sets and a pair, scored in faan from a common Hong Kong
// faan table, with a three-faan minimum at the default table. Faan convert to
// points on the familiar half-spicy table (each faan doubles up to four, then
// rises by half steps), capped at ten faan. Clubs differ on the minimum,
// seven pairs and how a discard win is paid, so the host sets those.

import { FLOWER_BASE, KIND_COUNT, WINDS, isDragon, isHonor, isSuited, isTerminal, isTerminalOrHonor, isWind, suitOf, windKind } from '../tiles';
import { classicProfile } from './classic';
import { goulashRules } from './goulash';
import { MIXED_FAAN, mixedHandsRule, mixedPairItems, mixedSetItems } from './mixed';
import type { HandScore, Payment, RuleProfile, ScoreItem, ScoringContext } from './types';

/** Faan cap: limit hands and anything above are paid as ten. */
export const HK_LIMIT = 10;
/** Points for 0..10 faan on the half-spicy table, before the unit. */
export const HK_TABLE = [1, 2, 4, 8, 16, 24, 32, 48, 64, 96, 128];
export const HK_UNIT = 8;

const points = (faan: number) => HK_UNIT * HK_TABLE[Math.min(HK_LIMIT, Math.max(0, faan))];

function limit(name: string, ctx: ScoringContext): HandScore {
  const items: ScoreItem[] = [{ name, value: HK_LIMIT, note: 'Limit hand' }];
  if (ctx.selfDrawn) items.push({ name: 'Self-drawn', value: 0, note: 'Included in the limit' });
  return { value: HK_LIMIT, unit: 'faan', items, points: points(HK_LIMIT), limit: true };
}

/** Concealed nine gates: 1112345678999 of one suit plus any tile of that suit. */
function nineGates(counts: number[], melds: number): boolean {
  if (melds) return false;
  for (const base of [0, 9, 18]) {
    const c = counts.slice(base, base + 9);
    if (c.reduce((a, b) => a + b, 0) !== 14) continue;
    const need = [3, 1, 1, 1, 1, 1, 1, 1, 3];
    if (c.every((n, i) => n >= need[i])) return true;
  }
  return false;
}

export function hongKongScore(ctx: ScoringContext): HandScore {
  const items: ScoreItem[] = [];
  const add = (name: string, value: number, note?: string) => items.push({ name, value, note });
  const d = ctx.decomposition;
  if (d.shape === 'thirteenOrphans') return limit('Thirteen Orphans', ctx);

  type S = { type: 'pung' | 'chow' | 'kong'; kind: number; concealed: boolean };
  const sets: S[] = ctx.melds.map((m) => ({ type: m.type, kind: Math.min(...m.tiles.map((t) => t.kind)), concealed: m.concealed }));
  for (const s of d.sets) {
    if (s.type === 'pair') continue;
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
  const kongs = sets.filter((s) => s.type === 'kong');

  // Limit hands
  if (windPungs.length === 4) return limit('Great Four Winds', ctx);
  if (allKinds.every(isHonor)) return limit('All Honours', ctx);
  if (allKinds.every(isTerminal)) return limit('All Terminals', ctx);
  if (d.shape === 'standard' && pungs.length === 4 && pungs.every((p) => p.concealed)) return limit('Four Concealed Pungs', ctx);
  if (kongs.length === 4) return limit('Four Kongs', ctx);
  if (nineGates(ctx.concealedCounts, ctx.melds.length)) return limit('Nine Gates', ctx);

  const exposed = ctx.melds.some((m) => !m.concealed);
  if (ctx.selfDrawn) add('Self-drawn', 1);
  if (!exposed) add('Concealed hand', 1);
  if (d.shape === 'sevenPairs') add('Seven Pairs', 4);

  if (d.shape === 'standard') {
    const pair = d.pair;
    const valuePair = isDragon(pair) || pair === windKind(ctx.seatWind) || pair === windKind(ctx.prevailingWind);
    if (sets.every((s) => s.type === 'chow') && !valuePair) add('All Chows', 1);
    if (pungs.length === 4) add('All Pungs', 3);
    if (dragonPungs.length === 3) add('Great Three Dragons', 8);
    else if (dragonPungs.length === 2 && isDragon(pair)) add('Small Three Dragons', 5);
    else for (const p of dragonPungs) add(['Red', 'Green', 'White'][p.kind - 31] + ' Dragon pung', 1);
    if (windPungs.length === 3 && isWind(pair)) add('Small Four Winds', 6);
    else {
      if (pungs.some((p) => p.kind === windKind(ctx.seatWind))) add('Seat wind pung', 1);
      if (pungs.some((p) => p.kind === windKind(ctx.prevailingWind))) add('Round wind pung', 1);
    }
  }
  if (suits.size === 1 && !hasHonor) add('Full Flush', 7);
  else if (suits.size === 1) add('Half Flush', 3);
  if (allKinds.every(isTerminalOrHonor) && hasHonor && !allKinds.every(isHonor)) add('Mixed Terminals', 1);
  if (ctx.house?.mixedHands === 'on') {
    if (d.shape === 'standard') items.push(...mixedSetItems(sets, MIXED_FAAN));
    if (d.shape === 'sevenPairs') items.push(...mixedPairItems(ctx.concealedCounts, MIXED_FAAN));
  }

  // Flowers (when the table plays them)
  if (ctx.house?.flowers !== 'off') {
    const flowers = ctx.flowers ?? [];
    const seatNo = WINDS.indexOf(ctx.seatWind) + 1;
    if (!flowers.length) add('No flowers', 1);
    for (const [from, name] of [
      [FLOWER_BASE, 'All four plants'],
      [FLOWER_BASE + 4, 'All four seasons'],
    ] as const) {
      if ([0, 1, 2, 3].every((i) => flowers.includes(from + i))) add(name, 2);
      else if (flowers.includes(from + seatNo - 1)) add('Seat flower', 1);
    }
  }

  if (ctx.afterKong) add('Win on a kong replacement', 1);
  if (ctx.robbedKong) add('Robbing the kong', 1);
  if (ctx.lastTileOfWall) add('Last tile of the wall', 1);

  if (!items.length) add('Chicken hand', 0, 'Below the usual minimum');
  const raw = items.reduce((a, b) => a + b.value, 0);
  const value = Math.min(raw, HK_LIMIT);
  return { value, unit: 'faan', items, points: points(value), limit: raw >= HK_LIMIT };
}

/** Self-draw: everyone pays the points. Discard: the discarder pays them, the others half ("half gun"). */
export function hkHalfGun(winner: number, discarder: number | null, s: HandScore, _d: number, players: number): Payment[] {
  const out: Payment[] = [];
  for (let p = 0; p < players; p++) {
    if (p === winner) continue;
    out.push({ from: p, to: winner, amount: discarder === null || p === discarder ? s.points : s.points / 2 });
  }
  return out;
}

/** Discard: the discarder pays for the whole table ("full gun"). */
export function hkFullGun(winner: number, discarder: number | null, s: HandScore, d: number, players: number): Payment[] {
  if (discarder === null) return hkHalfGun(winner, null, s, d, players);
  return [{ from: discarder, to: winner, amount: s.points + (s.points / 2) * (players - 2) }];
}

export const hongKongProfile: RuleProfile = {
  ...classicProfile,
  id: 'hongkong',
  name: 'Hong Kong Mahjong',
  region: 'Hong Kong',
  flag: '🇭🇰',
  summary: 'Cantonese club play: 144 tiles with flowers, faan scoring on the half-spicy table, and a three-faan minimum at our default table. Clubs vary, so the host sets the minimum and who pays.',
  shapes: { sevenPairs: true, thirteenOrphans: true },
  minValue: 3,
  rounds: { ...classicProfile.rounds },
  score: hongKongScore,
  payments: hkHalfGun,
  flowers: true,
  scoreUnit: 'faan',
  callNames: { chow: 'Sheung', pung: 'Pung', kong: 'Gong', win: 'Sik Wu', selfDraw: 'Zi Mo' },
  felt: '#123b3a',
  tableName: 'Harbour Jade',
  configure(c) {
    return {
      flowers: c.flowers !== 'off',
      shapes: { sevenPairs: c.sevenPairs !== 'off', thirteenOrphans: true },
      payments: c.payout === 'fullGun' ? hkFullGun : hkHalfGun,
    };
  },
  houseRules: [
    {
      id: 'minValue',
      label: 'Minimum to win',
      options: [
        { value: '0', label: 'No minimum' },
        { value: '1', label: '1 faan' },
        { value: '3', label: '3 faan' },
      ],
      default: '3',
    },
    {
      id: 'flowers',
      label: 'Flowers',
      options: [
        { value: 'on', label: 'With flowers (144 tiles)' },
        { value: 'off', label: 'No flowers (136 tiles)' },
      ],
      default: 'on',
    },
    {
      id: 'sevenPairs',
      label: 'Seven pairs',
      options: [
        { value: 'on', label: 'Allowed (4 faan)' },
        { value: 'off', label: 'Not allowed' },
      ],
      default: 'on',
    },
    {
      id: 'payout',
      label: 'On a discard win',
      options: [
        { value: 'halfGun', label: 'Half gun: others pay half' },
        { value: 'fullGun', label: 'Full gun: discarder pays all' },
      ],
      default: 'halfGun',
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
    mixedHandsRule('off'),
    ...goulashRules(true),
  ],
};
