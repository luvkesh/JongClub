// Sichuan Mahjong, "Blood Battle" (xuezhan) style, as played in Chengdu and
// across Sichuan. 108 tiles: the three suits only, no honours or flowers.
// No chows, just pungs and kongs. A winning hand must be missing at least one
// suit entirely (que yi men). Hands are scored in fan, each doubling, capped
// at four by default. Kongs pay on the spot ("wind and rain"), and at a wall
// game players who aren't ready pay those who are.
//
// Simplified: in a true Blood Battle, play continues after each win until
// three players have won or the wall runs out. Here the hand ends at the first
// win. Players don't announce their missing suit before play; the rule is
// checked when they win.

import { KIND_COUNT, isSuited, isTerminal } from '../tiles';
import { classicProfile } from './classic';
import type { HandScore, InstantEvent, Payment, RuleProfile, ScoreItem, ScoringContext } from './types';

export const SC_UNIT = 10;
export const SC_CAP = 4;

export function sichuanScore(ctx: ScoringContext): HandScore {
  const items: ScoreItem[] = [];
  const add = (name: string, value: number, note?: string) => items.push({ name, value, note });
  const d = ctx.decomposition;
  const allKinds: number[] = [];
  for (let k = 0; k < KIND_COUNT; k++) for (let i = 0; i < ctx.concealedCounts[k]; i++) allKinds.push(k);
  for (const m of ctx.melds) for (const t of m.tiles) allKinds.push(t.kind);
  const tally = new Array(KIND_COUNT).fill(0);
  for (const k of allKinds) tally[k]++;
  const suits = new Set(allKinds.filter(isSuited).map((k) => Math.floor(k / 9)));
  const cap = Number(ctx.house?.cap ?? SC_CAP);
  if (suits.size === 3) {
    return { value: 0, unit: 'fan', items: [{ name: 'Missing suit', value: 0, note: 'A winning hand must lack one suit entirely' }], points: 0, limit: false, qualifies: false };
  }

  if (d.shape === 'sevenPairs') add('Seven Pairs', 2);
  else {
    const sets = [...ctx.melds.map((m) => ({ type: m.type, kind: Math.min(...m.tiles.map((t) => t.kind)) })), ...d.sets.filter((s) => s.type !== 'pair')];
    const allPungs = sets.every((s) => s.type !== 'chow');
    if (allPungs) add('All Pungs', 1);
    if (allPungs && [...sets.map((s) => s.kind), d.pair].every((k) => [1, 4, 7].includes(k % 9))) add('Pure 2-5-8', 2, 'Every set and the pair are twos, fives or eights');
    const terminalIn = (s: { type: string; kind: number }) => (s.type === 'chow' ? s.kind % 9 === 0 || s.kind % 9 === 6 : isTerminal(s.kind));
    if (sets.every(terminalIn) && isTerminal(d.pair)) add('Terminals in every set', 2);
    if (ctx.melds.length === 4) add('Golden Hook', 1, 'Four sets called, waiting on the pair');
  }
  if (suits.size === 1) add('Pure Suit', 2);
  if (allKinds.every((k) => !isTerminal(k))) add('All Simples', 1);
  // Roots: every four of a kind, as a kong or held in the hand.
  for (let k = 0; k < KIND_COUNT; k++) if (tally[k] === 4) add('Root (four of a kind)', 1);

  if (ctx.afterKong) add('Win on a kong replacement', 1);
  if (ctx.robbedKong) add('Robbing the kong', 1);
  if (ctx.lastTileOfWall) add('Last tile', 1);
  const selfFan = ctx.selfDrawn && ctx.house?.selfDraw === 'fan';
  if (selfFan) add('Self-drawn', 1);
  if (!items.length) add('Plain win', 0, 'Basic hand');

  const raw = items.reduce((a, b) => a + b.value, 0);
  const value = Math.min(raw, cap);
  // Self-draw adds one base (jia di) unless the table doubles it instead.
  const bonus = ctx.selfDrawn && !selfFan ? SC_UNIT : 0;
  return { value, unit: 'fan', items, points: SC_UNIT * 2 ** value + bonus, limit: raw >= cap };
}

/** Discard: the discarder pays. Self-draw: everyone pays. */
export function sichuanPayments(winner: number, discarder: number | null, s: HandScore, _d: number, players: number): Payment[] {
  if (discarder !== null) return [{ from: discarder, to: winner, amount: s.points }];
  const out: Payment[] = [];
  for (let p = 0; p < players; p++) if (p !== winner) out.push({ from: p, to: winner, amount: s.points });
  return out;
}

/** Wind and rain: a concealed kong collects two units from everyone, an open kong one. */
export function sichuanKongs(e: InstantEvent, players: number): Payment[] {
  if (e.type !== 'kong') return [];
  const amount = (e.concealed ? 2 : 1) * SC_UNIT;
  return Array.from({ length: players }, (_, p) => p)
    .filter((p) => p !== e.seat)
    .map((p) => ({ from: p, to: e.seat, amount }));
}

/** Checking the ready hands at a wall game: each player not ready pays each ready player. */
export function sichuanDraw(tenpai: boolean[]): Payment[] {
  const out: Payment[] = [];
  tenpai.forEach((ready, to) => {
    if (!ready) return;
    tenpai.forEach((r, from) => !r && out.push({ from, to, amount: 2 * SC_UNIT }));
  });
  return out;
}

export const sichuanProfile: RuleProfile = {
  ...classicProfile,
  id: 'sichuan',
  name: 'Sichuan Blood Battle',
  region: 'Sichuan, China',
  flag: '🇨🇳',
  summary: '108 tiles, three suits only, no chow calls (runs built in your own hand still count). Your winning hand must be missing a whole suit. Kongs pay on the spot. Simplified: the hand ends at the first win, where real Blood Battle plays on.',
  tileKinds: Array.from({ length: 27 }, (_, k) => k),
  calls: { ...classicProfile.calls, chow: false },
  shapes: { sevenPairs: true, thirteenOrphans: false },
  minValue: 0,
  rounds: { ...classicProfile.rounds },
  score: sichuanScore,
  payments: sichuanPayments,
  startingScore: 1000,
  flowers: false,
  missingSuit: true,
  instantPayments: sichuanKongs,
  drawPayments: sichuanDraw,
  robKong: true,
  scoreUnit: 'fan',
  callNames: { chow: 'Chi', pung: 'Peng', kong: 'Gang', win: 'Hu', selfDraw: 'Zimo' },
  felt: '#4a1a14',
  tableName: 'Chengdu Teahouse',
  configure(c) {
    return { instantPayments: c.kongMoney === 'off' ? undefined : sichuanKongs };
  },
  houseRules: [
    {
      id: 'cap',
      label: 'Fan cap',
      options: [
        { value: '3', label: '3 fan' },
        { value: '4', label: '4 fan' },
        { value: '5', label: '5 fan' },
      ],
      default: '4',
    },
    {
      id: 'selfDraw',
      label: 'Self-draw bonus',
      options: [
        { value: 'base', label: 'Adds one base' },
        { value: 'fan', label: 'Adds one fan' },
      ],
      default: 'base',
    },
    {
      id: 'kongMoney',
      label: 'Kong money (wind and rain)',
      options: [
        { value: 'on', label: 'Paid on the spot' },
        { value: 'off', label: 'None' },
      ],
      default: 'on',
    },
  ],
};
