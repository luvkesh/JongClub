// European Classical: the older British and European "points and doubles"
// game, as written in the long-standing club rule books (Babcock's rules as
// played in Britain, and the British Mah-Jong Association style). There is no
// single authority; this is JongClub's table.
//
//   - 144 tiles with flowers and seasons; chow, pung and kong.
//   - Points: Mahjong 20. Pungs: simples 2 exposed / 4 concealed, terminals
//     and honours 4 / 8. Kongs: simples 8 / 16, terminals and honours 16 / 32.
//     Pair of dragons, your own wind or the round wind 2 (4 if it is both
//     winds). Self-drawn 2, each flower or season 4.
//   - Doubles, each doubling the total: a pung of dragons, of your own wind,
//     of the round wind; your own flower, your own season; all four flowers
//     or all four seasons (a bouquet: 2); no chows; concealed hand; half
//     flush 1; full flush 3; small three dragons 1; terminals and honours 1;
//     last tile of the wall, a win on a kong replacement, robbing a kong 1.
//   - Limit hands score the limit, 1,000 points: Thirteen Orphans, Heads and
//     Tails (only ones and nines), All Honours, Big Three Dragons, Four Winds,
//     Four Kongs, Four Concealed Pungs, Nine Gates, Heaven's Blessing.
//   - Payment: every other player pays the winner the score; East pays and
//     receives double. (Simplified: in the old game the losers also settle
//     their own hands with each other; here only the winner is paid.)

import { WINDS, flowerNumber, isDragon, isHonor, isTerminal, isTerminalOrHonor, windKind } from '../tiles';
import { handFacts } from './handFacts';
import { classicProfile } from './classic';
import type { HandScore, Payment, RuleProfile, ScoreItem, ScoringContext } from './types';

export const EU_LIMIT = 1000;

export function europeanScore(ctx: ScoringContext): HandScore {
  const items: ScoreItem[] = [];
  const pts = (name: string, value: number) => items.push({ name, value, note: 'points' });
  const dbl = (name: string, value = 1) => items.push({ name, value, note: 'double' });
  const d = ctx.decomposition;
  const f = handFacts(ctx);
  const limit = Number(ctx.house?.limit ?? EU_LIMIT);
  const own = windKind(ctx.seatWind);
  const round = windKind(ctx.prevailingWind);
  const limitHand = (name: string): HandScore => ({ value: limit, unit: 'points', items: [{ name, value: limit, note: 'Limit hand' }], points: limit, limit: true });

  if (d.shape === 'thirteenOrphans') return limitHand('Thirteen Orphans');
  if (f.kinds.every(isTerminal)) return limitHand('Heads and Tails');
  if (f.kinds.every(isHonor)) return limitHand('All Honours');
  if (f.dragonPungs.length === 3) return limitHand('Big Three Dragons');
  if (f.windPungs.length === 4) return limitHand('Four Winds');
  if (f.kongs.length === 4) return limitHand('Four Kongs');
  if (d.shape === 'standard' && f.concealedPungs === 4) return limitHand('Four Concealed Pungs');
  if (f.closed && f.suits.size === 1 && !f.hasHonour && isNineGates(f.counts)) return limitHand('Nine Gates');
  if (ctx.heavenly) return limitHand('Heaven’s Blessing');

  pts('Mahjong', 20);
  for (const s of f.pungs) {
    const th = isTerminalOrHonor(s.kind);
    const v = (s.type === 'kong' ? 8 : 2) * (th ? 2 : 1) * (s.concealed ? 2 : 1);
    pts(`${s.type === 'kong' ? 'Kong' : 'Pung'} (${th ? 'terminals/honours' : 'simples'}, ${s.concealed ? 'concealed' : 'exposed'})`, v);
  }
  if (d.shape === 'standard' && (isDragon(d.pair) || d.pair === own || d.pair === round)) pts('Valuable pair', d.pair === own && d.pair === round ? 4 : 2);
  if (ctx.selfDrawn) pts('Self-drawn', 2);
  if (d.shape === 'sevenPairs') pts('Seven Pairs', 10);
  const flowers = ctx.flowers ?? [];
  if (flowers.length) pts('Flowers and seasons', 4 * flowers.length);

  const seat = WINDS.indexOf(ctx.seatWind) + 1;
  f.dragonPungs.forEach(() => dbl('Dragon pung'));
  if (f.windPungs.some((s) => s.kind === own)) dbl('Own wind pung');
  if (f.windPungs.some((s) => s.kind === round)) dbl('Round wind pung');
  const isFlowerSet = (k: number) => k - 34 < 4;
  if (flowers.some((k) => isFlowerSet(k) && flowerNumber(k) === seat)) dbl('Own flower');
  if (flowers.some((k) => !isFlowerSet(k) && flowerNumber(k) === seat)) dbl('Own season');
  if (flowers.filter(isFlowerSet).length === 4) dbl('All four flowers', 2);
  if (flowers.filter((k) => !isFlowerSet(k)).length === 4) dbl('All four seasons', 2);
  if (d.shape === 'standard' && f.chows.length === 0) dbl('No chows');
  if (f.closed) dbl('Concealed hand');
  if (f.suits.size === 1 && !f.hasHonour) dbl('Full flush', 3);
  else if (f.suits.size === 1) dbl('Half flush');
  if (f.dragonPungs.length === 2 && isDragon(d.pair)) dbl('Small three dragons');
  if (f.kinds.every(isTerminalOrHonor)) dbl('Terminals and honours');
  if (ctx.lastTileOfWall) dbl('Last tile of the wall');
  if (ctx.afterKong) dbl('Win on a kong replacement');
  if (ctx.robbedKong) dbl('Robbing the kong');

  const base = items.filter((i) => i.note === 'points').reduce((a, b) => a + b.value, 0);
  const doubles = items.filter((i) => i.note === 'double').reduce((a, b) => a + b.value, 0);
  const raw = base * 2 ** doubles;
  const points = Math.min(raw, limit);
  return { value: points, unit: 'points', items, points, limit: raw >= limit };
}

function isNineGates(c: number[]): boolean {
  const s = c.findIndex((n) => n > 0);
  if (s < 0 || s >= 27) return false;
  const base = s - (s % 9);
  return [3, 1, 1, 1, 1, 1, 1, 1, 3].every((n, i) => c[base + i] >= n);
}

/** Everyone pays the winner the score; East pays and receives double. */
export function europeanPayments(winner: number, _discarder: number | null, s: HandScore, dealer: number, players: number): Payment[] {
  const out: Payment[] = [];
  for (let p = 0; p < players; p++) if (p !== winner) out.push({ from: p, to: winner, amount: s.points * (p === dealer || winner === dealer ? 2 : 1) });
  return out;
}

export const europeanProfile: RuleProfile = {
  ...classicProfile,
  id: 'european',
  base: 'european',
  name: 'European Classical',
  region: 'Britain and Europe',
  flag: '🇬🇧',
  summary: 'The older British and European game: 144 tiles with flowers and seasons, points for every set, then doubles that multiply the total, up to a 1,000-point limit. Everyone pays the winner, and East pays and receives double.',
  shapes: { sevenPairs: false, thirteenOrphans: true },
  minValue: 0,
  rounds: { ...classicProfile.rounds, dealerRetention: 'onDealerWin' },
  score: europeanScore,
  payments: europeanPayments,
  startingScore: 2000,
  flowers: true,
  robKong: true,
  windRounds: undefined,
  scoreUnit: 'points',
  callNames: { chow: 'Chow', pung: 'Pung', kong: 'Kong', win: 'Mah-Jong', selfDraw: 'Mah-Jong' },
  felt: '#2b3a2a',
  tableName: 'London Club Room',
  configure(c) {
    return { shapes: { sevenPairs: c.sevenPairs === 'on', thirteenOrphans: true } };
  },
  houseRules: [
    {
      id: 'limit',
      label: 'Limit',
      options: [
        { value: '500', label: '500 points' },
        { value: '1000', label: '1,000 points' },
        { value: '2000', label: '2,000 points' },
      ],
      default: '1000',
    },
    {
      id: 'sevenPairs',
      label: 'Seven pairs',
      options: [
        { value: 'off', label: 'Not allowed (traditional)' },
        { value: 'on', label: 'Allowed (10 points)' },
      ],
      default: 'off',
    },
    {
      id: 'dealerRetention',
      label: 'Dealer keeps the deal',
      options: [
        { value: 'onDealerWin', label: 'When dealer wins' },
        { value: 'never', label: 'Never' },
      ],
      default: 'onDealerWin',
    },
  ],
  guide: {
    win: ['Four sets and a pair (or thirteen orphans). Any complete hand wins.', 'Add up the points first, then double the total once for every double.'],
    pay: 'Everyone pays the winner the score, up to the limit. East pays double, and when East wins everyone pays East double.',
    sections: [
      {
        title: 'Points',
        lines: [
          ['Mahjong', 20, 'For going out'],
          ['Pung of simples', '2 / 4', 'Exposed / concealed'],
          ['Pung of terminals or honours', '4 / 8', 'Exposed / concealed'],
          ['Kong of simples', '8 / 16', 'Exposed / concealed'],
          ['Kong of terminals or honours', '16 / 32', 'Exposed / concealed'],
          ['Valuable pair', 2, 'A pair of dragons, your own wind or the round wind (4 if it is both winds)'],
          ['Self-drawn', 2, 'You drew the winning tile yourself'],
          ['Flowers and seasons', 4, 'Each one you hold'],
        ],
      },
      {
        title: 'Doubles',
        lines: [
          ['Dragon pung', 1, 'Each pung or kong of dragons'],
          ['Own wind pung', 1, 'A pung of your seat wind'],
          ['Round wind pung', 1, 'A pung of the round’s wind'],
          ['Own flower', 1, 'The flower numbered for your seat'],
          ['Own season', 1, 'The season numbered for your seat'],
          ['All four flowers', 2, 'A bouquet: all four flowers'],
          ['All four seasons', 2, 'A bouquet: all four seasons'],
          ['No chows', 1, 'Four pungs or kongs'],
          ['Concealed hand', 1, 'Nothing claimed before the winning tile'],
          ['Half flush', 1, 'One suit plus honours'],
          ['Full flush', 3, 'One suit only'],
          ['Small three dragons', 1, 'Two dragon pungs and a dragon pair'],
          ['Terminals and honours', 1, 'Only ones, nines, winds and dragons'],
          ['Last tile of the wall', 1, 'Won on the very last tile'],
          ['Win on a kong replacement', 1, 'Your winning tile is the replacement for a kong'],
          ['Robbing the kong', 1, 'Win on the tile someone adds to a pung'],
        ],
      },
      {
        title: 'Limit hands',
        closed: true,
        lines: [
          ['Thirteen Orphans', 'Limit', 'One of each one, nine, wind and dragon, plus any one of them again'],
          ['Heads and Tails', 'Limit', 'Only ones and nines'],
          ['All Honours', 'Limit', 'Only winds and dragons'],
          ['Big Three Dragons', 'Limit', 'Pungs of all three dragons'],
          ['Four Winds', 'Limit', 'Pungs of all four winds'],
          ['Four Kongs', 'Limit', 'Four kongs and a pair'],
          ['Four Concealed Pungs', 'Limit', 'Four pungs you never claimed'],
          ['Nine Gates', 'Limit', '1112345678999 of one suit, concealed, plus any tile of that suit'],
          ['Heaven’s Blessing', 'Limit', 'East wins on the deal'],
        ],
      },
    ],
  },
};
