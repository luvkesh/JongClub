// Sanma: three-player Riichi, as played in Japanese parlours and online rooms.
// The Riichi rules carry over (yaku, dora, furiten, han and fu) with the
// three-player changes that nearly every table shares:
//   - 108 tiles: the 2 to 8 of Characters are taken out (1m and 9m stay).
//     A 1m indicator makes 9m dora.
//   - Three seats (East, South, West), East and South rounds of three hands.
//   - No chi. Pon and kan as usual.
//   - Kita: a North may be set aside on your turn as a bonus dora (nukidora)
//     and replaced from the dead wall. It is not a call; others may win on it
//     (without chankan). North is no seat's wind, so a pung of it is no yaku.
//   - 35,000 to start; riichi costs 1,000; two red fives (5p and 5s) by default.
//   - Ready-hand payments at a wall game total 2,000.
// What varies most between tables is a house rule:
//   - Self-draw: "tsumo loss" (the default: you lose the absent North's share)
//     or "point split" (the North share is split between the two payers).
// JongClub's table default for counters: each honba is worth 100 from each
// player who pays (200 on a discard).

import { KIND_COUNT } from '../tiles';
import { RIICHI_DRAW_RULES, abortiveFrom, doraFromIndicator, riichiProfile, roundUp100 } from './riichi';
import type { HandScore, Payment, RuleProfile } from './types';

/** The 108-tile set: no Characters from 2 to 8. */
export const SANMA_KINDS = Array.from({ length: KIND_COUNT }, (_, k) => k).filter((k) => k >= 9 || k === 0 || k === 8);
export const SANMA_NORTH = 30;
export const SANMA_HONBA = 100;

/** Dora in a set without 2m–8m: the 1m indicator points to 9m, the 9m to 1m. */
export function sanmaDora(k: number): number {
  if (k === 0) return 8;
  if (k === 8) return 0;
  return doraFromIndicator(k);
}

/** Who pays a win. `split`: on a self-draw the North share is split between the payers. */
export function sanmaPayments(split: boolean) {
  return (winner: number, discarder: number | null, s: HandScore, dealer: number, players: number, honba: number): Payment[] => {
    const base = s.base ?? 0;
    if (discarder !== null) return [{ from: discarder, to: winner, amount: roundUp100(base * (winner === dealer ? 6 : 4)) + SANMA_HONBA * (players - 1) * honba }];
    const out: Payment[] = [];
    for (let p = 0; p < players; p++) {
      if (p === winner) continue;
      let mult: number;
      if (!split) mult = winner === dealer || p === dealer ? 2 : 1;
      else if (winner === dealer) mult = 3;
      else mult = p === dealer ? 2.5 : 1.5;
      out.push({ from: p, to: winner, amount: roundUp100(base * mult) + SANMA_HONBA * honba });
    }
    return out;
  };
}

/** Wall game: 2,000 points move from the players who aren't ready to those who are. */
export function sanmaDrawPayments(tenpai: boolean[]): Payment[] {
  const ready = tenpai.filter(Boolean).length;
  if (ready === 0 || ready === tenpai.length) return [];
  const out: Payment[] = [];
  const each = 2000 / (tenpai.length - ready) / ready;
  tenpai.forEach((t, from) => {
    if (t) return;
    tenpai.forEach((r, to) => r && out.push({ from, to, amount: each }));
  });
  return out;
}

export const sanmaProfile: RuleProfile = {
  ...riichiProfile,
  id: 'sanma',
  base: 'riichi',
  name: 'Sanma (three-player Riichi)',
  region: 'Japan',
  flag: '🇯🇵',
  summary: 'Riichi for three: 108 tiles (Characters 2–8 out), no chi, and Norths set aside as bonus dora (kita). Big hands come quickly.',
  players: 3,
  tileKinds: SANMA_KINDS,
  calls: { ...riichiProfile.calls, chow: false },
  rounds: {
    prevailingWinds: ['E', 'S'],
    seatWindOrder: ['E', 'S', 'W'],
    handsPerWind: 3,
    dealerRetention: 'onDealerWinOrTenpai',
    maxHands: 0,
  },
  payments: sanmaPayments(false),
  drawPayments: sanmaDrawPayments,
  startingScore: 35000,
  doraFromIndicator: sanmaDora,
  riichi: { cost: 1000, minLiveTiles: 3 },
  nukiDora: SANMA_NORTH,
  felt: '#2a2140',
  tableName: 'Osaka Plum',
  houseRules: [
    {
      id: 'payout',
      label: 'Self-draw payments',
      options: [
        { value: 'tsumoLoss', label: 'Tsumo loss: the North share is lost' },
        { value: 'split', label: 'Point split: the North share is shared' },
      ],
      default: 'tsumoLoss',
    },
    {
      id: 'redFives',
      label: 'Red fives (aka dora)',
      options: [
        { value: '0', label: 'None' },
        { value: '3', label: 'Two (5p, 5s)' },
        { value: '4', label: 'Three (two 5p, one 5s)' },
      ],
      default: '3',
    },
    riichiProfile.houseRules.find((r) => r.id === 'openTanyao')!,
    {
      ...RIICHI_DRAW_RULES.find((r) => r.id === 'abortive')!,
      options: [
        { value: 'on', label: 'Played: nine terminals, four kongs' },
        { value: 'off', label: 'Not played: the hand goes on' },
      ],
    },
    RIICHI_DRAW_RULES.find((r) => r.id === 'nagashi')!,
  ],
  configure(c) {
    return {
      payments: sanmaPayments(c.payout === 'split'),
      redFives: c.redFives === undefined ? 3 : Number(c.redFives),
      abortiveDraws: abortiveFrom(c),
      nagashiMangan: c.nagashi !== 'off',
    };
  },
};
