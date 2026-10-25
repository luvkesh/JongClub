// Guangdong "push-down" Mahjong (tui dao hu), the everyday game of Guangzhou
// and the Pearl River Delta and the default on Cantonese phone apps. Any
// complete hand may be pushed down: there is no minimum. JongClub's table:
//   - 136 tiles, no flowers (house rule: with flowers, one fan each).
//   - Pung and kong may be claimed, chow may not; runs in your own hand count.
//   - Seven pairs and thirteen orphans win.
//   - Fan double the base: All Pungs 1, Half Flush 1, Seven Pairs 2, Full
//     Flush 2, Terminals and Honours 2, Small Three Dragons 2, Small Four
//     Winds 3, win on a kong 1, robbing a kong 1, last tile 1. Limit hands
//     (Thirteen Orphans, All Honours, All Terminals, Big Three Dragons, Big
//     Four Winds, Nine Gates, Four Kongs) score the cap, 5 fan.
//   - A hand is worth 2 points, doubled for each fan. Discard: only the
//     discarder pays it. Self-draw: all three pay double.
//   - Robbing a kong: the kong's owner pays for everyone (qiang gang bao).
// Many towns add a ghost tile (gui pai) or "buying horses" (mai ma); those
// local extras are not played here.

import { isTerminal, isTerminalOrHonor, isWind } from '../tiles';
import { handFacts } from './handFacts';
import { classicProfile } from './classic';
import type { HandScore, Payment, RuleProfile, ScoreItem, ScoringContext } from './types';

export const GD_BASE = 2;
export const GD_CAP = 5;

export function guangdongScore(ctx: ScoringContext): HandScore {
  const items: ScoreItem[] = [];
  const add = (name: string, value: number, note?: string) => items.push({ name, value, note });
  const d = ctx.decomposition;
  const f = handFacts(ctx);
  const cap = Number(ctx.house?.cap ?? GD_CAP);
  const limit = (name: string) => add(name, cap, 'Limit hand');

  if (d.shape === 'thirteenOrphans') limit('Thirteen Orphans');
  else if (f.kinds.every((k) => k >= 27)) limit('All Honours');
  else if (f.kinds.every(isTerminal)) limit('All Terminals');
  else if (f.dragonPungs.length === 3) limit('Big Three Dragons');
  else if (f.windPungs.length === 4) limit('Big Four Winds');
  else if (f.kongs.length === 4) limit('Four Kongs');
  else if (f.closed && f.suits.size === 1 && !f.hasHonour && isNineGates(f.counts)) limit('Nine Gates');
  else {
    if (d.shape === 'sevenPairs') add('Seven Pairs', 2);
    if (d.shape === 'standard' && f.chows.length === 0) add('All Pungs', 1);
    if (f.suits.size === 1 && !f.hasHonour) add('Full Flush', 2);
    else if (f.suits.size === 1) add('Half Flush', 1);
    if (f.kinds.every(isTerminalOrHonor)) add('Terminals and Honours', 2);
    if (f.dragonPungs.length === 2 && d.pair >= 31) add('Small Three Dragons', 2);
    if (f.windPungs.length === 3 && isWind(d.pair)) add('Small Four Winds', 3);
    if (ctx.afterKong) add('Win on a kong replacement', 1);
    if (ctx.robbedKong) add('Robbing the kong', 1);
    if (ctx.lastTileOfWall) add('Last tile', 1);
  }
  if (ctx.house?.flowers === 'on' && ctx.flowers?.length) add('Flowers', ctx.flowers.length, 'One fan each');
  if (!items.length) add('Chicken hand', 0, 'Any complete hand wins');
  const raw = items.reduce((a, b) => a + b.value, 0);
  const value = Math.min(raw, cap);
  return { value, unit: 'fan', items, points: GD_BASE * 2 ** value, limit: raw >= cap };
}

function isNineGates(c: number[]): boolean {
  const s = c.findIndex((n) => n > 0);
  const base = s - (s % 9);
  const need = [3, 1, 1, 1, 1, 1, 1, 1, 3];
  return need.every((n, i) => c[base + i] >= n);
}

/** Discard: the discarder alone pays. Self-draw: everyone pays double. */
export function guangdongPayments(winner: number, discarder: number | null, s: HandScore, _d: number, players: number): Payment[] {
  if (discarder !== null) {
    // Robbing a kong: the kong's owner pays what a self-draw would have cost everyone.
    const robbed = s.items.some((i) => i.name === 'Robbing the kong');
    return [{ from: discarder, to: winner, amount: robbed ? s.points * 2 * (players - 1) : s.points }];
  }
  const out: Payment[] = [];
  for (let p = 0; p < players; p++) if (p !== winner) out.push({ from: p, to: winner, amount: s.points * 2 });
  return out;
}

export const guangdongProfile: RuleProfile = {
  ...classicProfile,
  id: 'guangdong',
  base: 'guangdong',
  name: 'Guangdong push-down',
  region: 'Guangdong, China',
  flag: '🇨🇳',
  summary: 'The everyday Cantonese game: 136 tiles, no flowers and no chow claims (runs in your own hand still count). Any complete hand wins. Fan double a two-point base; the discarder alone pays, and a self-draw is paid double by everyone.',
  tileKinds: classicProfile.tileKinds,
  calls: { ...classicProfile.calls, chow: false },
  shapes: { sevenPairs: true, thirteenOrphans: true },
  minValue: 0,
  rounds: { ...classicProfile.rounds },
  score: guangdongScore,
  payments: guangdongPayments,
  startingScore: 500,
  flowers: false,
  robKong: true,
  windRounds: undefined,
  scoreUnit: 'fan',
  callNames: { chow: 'Sheung', pung: 'Pung', kong: 'Gong', win: 'Wu', selfDraw: 'Zi Mo' },
  felt: '#1d3b2a',
  tableName: 'Canton Teahouse',
  configure(c) {
    return { flowers: c.flowers === 'on', minValue: 0 };
  },
  houseRules: [
    {
      id: 'cap',
      label: 'Fan cap',
      options: [
        { value: '4', label: '4 fan' },
        { value: '5', label: '5 fan' },
        { value: '6', label: '6 fan' },
      ],
      default: '5',
    },
    {
      id: 'flowers',
      label: 'Flowers',
      options: [
        { value: 'off', label: 'No flowers (136 tiles)' },
        { value: 'on', label: 'With flowers, one fan each (144 tiles)' },
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
  guide: {
    win: ['Any complete hand wins: four sets and a pair, seven pairs or thirteen orphans. There is no minimum.', 'You may claim a pung or a kong, but never a chow. Runs you build in your own hand still count.'],
    pay: 'A hand is worth 2 points, doubled for each fan, up to the cap. On a discard only the discarder pays. On a self-draw all three pay double. If you rob a kong, the kong’s owner pays for everyone.',
    sections: [
      {
        title: 'Fan',
        lines: [
          ['All Pungs', 1, 'Four pungs or kongs and a pair'],
          ['Half Flush', 1, 'One suit plus honours'],
          ['Full Flush', 2, 'One suit only, no honours'],
          ['Seven Pairs', 2, 'Seven different pairs'],
          ['Terminals and Honours', 2, 'Only ones, nines, winds and dragons'],
          ['Small Three Dragons', 2, 'Two dragon pungs and a dragon pair'],
          ['Small Four Winds', 3, 'Three wind pungs and a wind pair'],
          ['Win on a kong replacement', 1, 'Your winning tile is the replacement for a kong'],
          ['Robbing the kong', 1, 'Win on the tile someone adds to a pung'],
          ['Last tile', 1, 'Win on the very last tile of the wall'],
        ],
      },
      {
        title: 'Limit hands',
        closed: true,
        lines: [
          ['Thirteen Orphans', 'Limit', 'One of each one, nine, wind and dragon, plus any one of them again'],
          ['All Honours', 'Limit', 'Only winds and dragons'],
          ['All Terminals', 'Limit', 'Only ones and nines'],
          ['Big Three Dragons', 'Limit', 'Pungs of all three dragons'],
          ['Big Four Winds', 'Limit', 'Pungs of all four winds'],
          ['Four Kongs', 'Limit', 'Four kongs and a pair'],
          ['Nine Gates', 'Limit', '1112345678999 of one suit, concealed, plus any tile of that suit'],
        ],
      },
    ],
  },
};
