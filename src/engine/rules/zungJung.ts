// Zung Jung: a modern scoring system designed by Alan Kwan (2006) for fair,
// skill-based play. Pattern points are added, not doubled; the total is
// capped at 320. Any complete hand wins: a hand with no other pattern is a
// Chicken Hand, worth 1 point. 136 tiles, no flowers, chow/pung/kong.
//
// The pattern list (points):
//   Trivial      Chicken Hand 1, All Sequences 5, Concealed Hand 5, No Terminals 5
//   One-suit     Mixed One-Suit 40, Pure One-Suit 80, Nine Gates 480
//   Honours      Dragon Pung 10 each, Seat Wind 10, Prevailing Wind 10,
//                Small Three Dragons 40, Big Three Dragons 130,
//                Small Three Winds 30, Big Three Winds 120,
//                Small Four Winds 320, Big Four Winds 400, All Honours 320
//   Triplets     All Triplets 30, Two/Three/Four Concealed Triplets 5/30/125,
//                One/Two/Three/Four Kongs 5/20/120/480
//   Identical    Two Identical Sequences 10, Two Identical Sequences Twice 60,
//                Three Identical Sequences 120, Four Identical Sequences 480
//   Similar      Three Similar Sequences 35, Small Three Similar Triplets 30,
//                Three Similar Triplets 120
//   Consecutive  Nine-Tile Straight 40, Three Consecutive Triplets 100,
//                Four Consecutive Triplets 200
//   Terminals    Mixed Lesser Terminals 40, Pure Lesser Terminals 50,
//                Mixed Greater Terminals 100, Pure Greater Terminals 400
//   Incidental   Final Draw 10, Final Discard 10, Win on Kong 10,
//                Robbing a Kong 10, Blessing of Heaven 155, Blessing of Earth 155
//   Irregular    Thirteen Terminals 160, Seven Pairs 30
// A bigger pattern replaces the smaller one it contains (Big Three Dragons
// replaces its Dragon Pungs and Small Three Dragons, and so on).
//
// Settlement (our reading of the published rules): a self-drawn hand is paid
// its points by each other player; on a discard, the discarder pays for the
// whole table (three times the points).

import { isDragon, isHonor, isTerminal, isWind, windKind } from '../tiles';
import { handFacts, setHasTerminal, setHasTerminalOrHonour } from './handFacts';
import { classicProfile } from './classic';
import type { HandScore, Payment, RuleProfile, ScoreItem, ScoringContext } from './types';

export const ZJ_LIMIT = 320;

export function zungJungScore(ctx: ScoringContext): HandScore {
  const items: ScoreItem[] = [];
  const add = (name: string, value: number) => items.push({ name, value });
  const d = ctx.decomposition;
  const f = handFacts(ctx);
  const allHonours = f.kinds.every(isHonor);
  const noTerminals = f.kinds.every((k) => !isHonor(k) && !isTerminal(k));

  if (d.shape === 'thirteenOrphans') add('Thirteen Terminals', 160);
  else if (d.shape === 'sevenPairs') add('Seven Pairs', 30);
  else {
    // 1. Trivial
    if (f.chows.length === 4) add('All Sequences', 5);
    // 3. Honours
    const dragonPair = isDragon(d.pair);
    if (f.dragonPungs.length === 3) add('Big Three Dragons', 130);
    else if (f.dragonPungs.length === 2 && dragonPair) add('Small Three Dragons', 40);
    else for (const _ of f.dragonPungs) add('Dragon Pung', 10);
    const winds = f.windPungs.length;
    if (winds === 4) add('Big Four Winds', 400);
    else if (winds === 3 && isWind(d.pair)) add('Small Four Winds', 320);
    else if (winds === 3) add('Big Three Winds', 120);
    else if (winds === 2 && isWind(d.pair)) add('Small Three Winds', 30);
    if (winds < 3) {
      if (f.windPungs.some((s) => s.kind === windKind(ctx.seatWind))) add('Seat Wind', 10);
      if (f.windPungs.some((s) => s.kind === windKind(ctx.prevailingWind))) add('Prevailing Wind', 10);
    }
    // 4. Triplets and kongs
    if (f.pungs.length === 4) add('All Triplets', 30);
    const cp = f.concealedPungs;
    if (cp === 4) add('Four Concealed Triplets', 125);
    else if (cp === 3) add('Three Concealed Triplets', 30);
    else if (cp === 2) add('Two Concealed Triplets', 5);
    const kongs = f.kongs.length;
    if (kongs) add(['One Kong', 'Two Kongs', 'Three Kongs', 'Four Kongs'][kongs - 1], [5, 20, 120, 480][kongs - 1]);
    // 5. Identical sequences
    const runs = new Map<number, number>();
    for (const s of f.chows) runs.set(s.kind, (runs.get(s.kind) ?? 0) + 1);
    const same = [...runs.values()].sort((a, b) => b - a);
    if (same[0] === 4) add('Four Identical Sequences', 480);
    else if (same[0] === 3) add('Three Identical Sequences', 120);
    else if (same[0] === 2 && same[1] === 2) add('Two Identical Sequences Twice', 60);
    else if (same[0] === 2) add('Two Identical Sequences', 10);
    // 6. Similar sets (the same numbers in all three suits)
    const rank = (k: number) => k % 9;
    const chowRanks = new Set(f.chows.map((s) => rank(s.kind)));
    if ([...chowRanks].some((r) => [0, 1, 2].every((suit) => f.chows.some((s) => s.kind === suit * 9 + r)))) add('Three Similar Sequences', 35);
    const pungRank = (r: number) => [0, 1, 2].filter((suit) => f.pungs.some((s) => s.kind === suit * 9 + r)).length;
    let similar = 0;
    for (let r = 0; r < 9; r++) {
      if (pungRank(r) === 3) similar = 2;
      else if (similar < 2 && pungRank(r) === 2 && d.pair < 27 && rank(d.pair) === r && !f.pungs.some((s) => s.kind === d.pair)) similar = 1;
    }
    if (similar === 2) add('Three Similar Triplets', 120);
    else if (similar === 1) add('Small Three Similar Triplets', 30);
    // 7. Consecutive sets
    for (let suit = 0; suit < 3; suit++) {
      if ([0, 3, 6].every((r) => f.chows.some((s) => s.kind === suit * 9 + r))) add('Nine-Tile Straight', 40);
    }
    let bestRun = 0;
    for (let suit = 0; suit < 3; suit++) {
      let run = 0;
      for (let r = 0; r < 9; r++) {
        run = f.pungs.some((s) => s.kind === suit * 9 + r) ? run + 1 : 0;
        bestRun = Math.max(bestRun, run);
      }
    }
    if (bestRun >= 4) add('Four Consecutive Triplets', 200);
    else if (bestRun === 3) add('Three Consecutive Triplets', 100);
    // 8. Terminals
    const pairT = isTerminal(d.pair);
    const pairTH = isTerminal(d.pair) || isHonor(d.pair);
    if (!allHonours) {
      if (f.kinds.every(isTerminal)) add('Pure Greater Terminals', 400);
      else if (f.kinds.every((k) => isTerminal(k) || isHonor(k))) add('Mixed Greater Terminals', 100);
      else if (f.sets.every(setHasTerminal) && pairT) add('Pure Lesser Terminals', 50);
      else if (f.sets.every(setHasTerminalOrHonour) && pairTH) add('Mixed Lesser Terminals', 40);
    }
  }
  // 2. One suit, and All Honours
  if (allHonours) add('All Honours', 320);
  else if (f.suits.size === 1 && !f.hasHonour) add(f.closed && isNineGates(f.counts) ? 'Nine Gates' : 'Pure One-Suit', f.closed && isNineGates(f.counts) ? 480 : 80);
  else if (f.suits.size === 1) add('Mixed One-Suit', 40);
  // Irregular hands are concealed by nature: no Concealed Hand points on top.
  if (f.closed && d.shape === 'standard') add('Concealed Hand', 5);
  if (noTerminals) add('No Terminals', 5);
  // 9. Incidental
  if (ctx.heavenly) add('Blessing of Heaven', 155);
  if (ctx.earthly) add('Blessing of Earth', 155);
  if (ctx.lastTileOfWall) add(ctx.selfDrawn ? 'Final Draw' : 'Final Discard', 10);
  if (ctx.afterKong) add('Win on Kong', 10);
  if (ctx.robbedKong) add('Robbing a Kong', 10);
  if (!items.length) add('Chicken Hand', 1);
  const raw = items.reduce((a, b) => a + b.value, 0);
  const value = Math.min(raw, ZJ_LIMIT);
  return { value, unit: 'points', items, points: value, limit: raw >= ZJ_LIMIT };
}

function isNineGates(c: number[]): boolean {
  const s = c.findIndex((n) => n > 0);
  if (s < 0 || s >= 27) return false;
  const base = s - (s % 9);
  return [3, 1, 1, 1, 1, 1, 1, 1, 3].every((n, i) => c[base + i] >= n);
}

/** Self-draw: each other player pays the points. Discard: the discarder pays for the table. */
export function zungJungPayments(winner: number, discarder: number | null, s: HandScore, _d: number, players: number): Payment[] {
  if (discarder !== null) return [{ from: discarder, to: winner, amount: s.points * (players - 1) }];
  const out: Payment[] = [];
  for (let p = 0; p < players; p++) if (p !== winner) out.push({ from: p, to: winner, amount: s.points });
  return out;
}

const L = (name: string, value: number, how: string): [string, number, string] => [name, value, how];

export const zungJungProfile: RuleProfile = {
  ...classicProfile,
  id: 'zung-jung',
  base: 'zung-jung',
  name: 'Zung Jung',
  region: 'Hong Kong',
  flag: '🇭🇰',
  summary: 'A modern scoring system by Alan Kwan: 136 tiles, no flowers, and a short list of patterns whose points add up, capped at 320. Any complete hand wins; with nothing else it is a Chicken Hand, worth 1.',
  shapes: { sevenPairs: true, thirteenOrphans: true },
  minValue: 0,
  rounds: { ...classicProfile.rounds, dealerRetention: 'onDealerWin' },
  score: zungJungScore,
  payments: zungJungPayments,
  startingScore: 1000,
  flowers: false,
  robKong: true,
  windRounds: undefined,
  scoreUnit: 'points',
  callNames: { chow: 'Chow', pung: 'Pung', kong: 'Kong', win: 'Mahjong', selfDraw: 'Self-drawn' },
  felt: '#22313a',
  tableName: 'Zung Jung Salon',
  configure(c) {
    return { minValue: Number(c.minValue ?? 0) };
  },
  houseRules: [
    {
      id: 'minValue',
      label: 'Minimum to win',
      options: [
        { value: '0', label: 'No minimum (official)' },
        { value: '5', label: '5 points' },
      ],
      default: '0',
    },
  ],
  guide: {
    win: ['Any complete hand wins: four sets and a pair, seven pairs or thirteen terminals.', 'Points add up (they never double) and stop at 320. A bigger pattern replaces a smaller one it contains.'],
    pay: 'A self-drawn hand is paid its points by each other player. On a discard, the discarder pays for the whole table: three times the points.',
    sections: [
      { title: 'Trivial patterns', lines: [L('Chicken Hand', 1, 'A complete hand with no other pattern'), L('All Sequences', 5, 'Four chows and a pair'), L('Concealed Hand', 5, 'Nothing claimed before the winning tile'), L('No Terminals', 5, 'No ones, nines or honours')] },
      { title: 'One suit and honours', lines: [L('Mixed One-Suit', 40, 'One suit plus honours'), L('Pure One-Suit', 80, 'One suit only'), L('Dragon Pung', 10, 'Each pung or kong of dragons'), L('Seat Wind', 10, 'A pung of your own wind'), L('Prevailing Wind', 10, 'A pung of the round’s wind'), L('Small Three Dragons', 40, 'Two dragon pungs and a dragon pair'), L('Big Three Dragons', 130, 'Pungs of all three dragons'), L('Small Three Winds', 30, 'Two wind pungs and a wind pair'), L('Big Three Winds', 120, 'Three wind pungs'), L('Small Four Winds', 320, 'Three wind pungs and a wind pair'), L('Big Four Winds', 400, 'Four wind pungs'), L('All Honours', 320, 'Only winds and dragons')] },
      { title: 'Triplets and kongs', lines: [L('All Triplets', 30, 'Four pungs or kongs'), L('Two Concealed Triplets', 5, 'Two pungs you never claimed'), L('Three Concealed Triplets', 30, 'Three pungs you never claimed'), L('Four Concealed Triplets', 125, 'Four pungs you never claimed'), L('One Kong', 5, 'A kong'), L('Two Kongs', 20, 'Two kongs'), L('Three Kongs', 120, 'Three kongs'), L('Four Kongs', 480, 'Four kongs')] },
      { title: 'Identical, similar and consecutive', closed: true, lines: [L('Two Identical Sequences', 10, 'The same run twice in one suit'), L('Two Identical Sequences Twice', 60, 'Two runs, each twice'), L('Three Identical Sequences', 120, 'The same run three times'), L('Three Similar Sequences', 35, 'The same run in all three suits'), L('Small Three Similar Triplets', 30, 'Pungs of one number in two suits, and its pair in the third'), L('Three Similar Triplets', 120, 'Pungs of one number in all three suits'), L('Nine-Tile Straight', 40, '1 to 9 of one suit as three runs'), L('Three Consecutive Triplets', 100, 'Pungs of three numbers in a row in one suit'), L('Four Consecutive Triplets', 200, 'Pungs of four numbers in a row in one suit')] },
      { title: 'Terminals', closed: true, lines: [L('Mixed Lesser Terminals', 40, 'Every set and the pair hold a one, nine or honour'), L('Pure Lesser Terminals', 50, 'Every set and the pair hold a one or a nine'), L('Mixed Greater Terminals', 100, 'Only ones, nines and honours'), L('Pure Greater Terminals', 400, 'Only ones and nines')] },
      { title: 'Incidental and irregular', closed: true, lines: [L('Final Draw', 10, 'Self-drawn on the last tile of the wall'), L('Final Discard', 10, 'Won on the last discard'), L('Win on Kong', 10, 'Won on a kong replacement'), L('Robbing a Kong', 10, 'Won on the tile added to a pung'), L('Blessing of Heaven', 155, 'The dealer wins on the deal'), L('Blessing of Earth', 155, 'Won on the dealer’s first discard'), L('Seven Pairs', 30, 'Seven different pairs'), L('Thirteen Terminals', 160, 'One of each one, nine, wind and dragon, plus any one of them again'), L('Nine Gates', 480, '1112345678999 of one suit, concealed, plus any tile of that suit')] },
    ],
  },
};
