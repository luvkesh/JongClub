// Skill ratings beyond win rate, per variation: efficiency (discards that
// match the most efficient one), defence (deal-ins once someone is ready),
// speed to ready (your turns until one tile from winning) and call rate.
// Each finished game is measured from its replay and kept here, per account,
// so the profile can draw a trend over recent games.

import { currentShanten, evaluateDiscards } from '../ai/evaluate';
import { runSliced, walkMatch } from '../ai/matchWalk';
import type { MahjongGame } from '../engine/game';
import { distance as cardDistance } from '../engine/rules/american';
import type { ReplayRecord } from '../net/replay';
import { accountKey, readJson, writeJson } from './accountKey';
import { tr } from '../i18n';

/** One game's measurements. Ratios are built from these counts. */
export interface GameSkill {
  date: string;
  variation: string;
  hands: number;
  /** Discards judged, and how many matched the most efficient choice. */
  decisions: number;
  good: number;
  /** Hands where you reached ready, and your turns to get there in total. */
  readyHands: number;
  readyTurns: number;
  /** Hands where an opponent was ready while you still had discards to make, and how many of those you dealt into. */
  exposedHands: number;
  exposedDealIns: number;
  /** Hands where you called at least one set. */
  callHands: number;
}

export type SkillId = 'efficiency' | 'defence' | 'speed' | 'calls';

export const SKILL_LABEL: Record<SkillId, string> = {
  efficiency: tr('Efficiency'),
  defence: tr('Defence'),
  speed: tr('Speed to ready'),
  calls: tr('Call rate'),
};

const KEY = 'jongclub.skills.v1';
const MAX = 150;

export function loadSkills(): GameSkill[] {
  const all = readJson<unknown>(accountKey(KEY));
  if (!Array.isArray(all)) return [];
  return all.filter((g): g is GameSkill => !!g && typeof g === 'object' && typeof (g as GameSkill).variation === 'string' && typeof (g as GameSkill).hands === 'number');
}

export function saveSkill(g: GameSkill) {
  writeJson(accountKey(KEY), [...loadSkills(), g].slice(-MAX));
}

/** Measure a finished game in the background (a few milliseconds at a time) and keep it. */
export function recordGameSkills(rec: ReplayRecord) {
  if (rec.me < 0) return;
  void runSliced(measureGame(rec)).then((g) => g && saveSkill(g));
}

/** Is this seat one tile from winning (13-tile view)? */
function isReady(game: MahjongGame, seat: number): boolean {
  const p = game.players[seat];
  if (p.riichi) return true;
  if (game.profile.card) return cardDistance(p.hand, p.melds) <= 1;
  return currentShanten(game, seat) <= 0;
}

/** Same test the match uses for its accuracy stat (match.ts trackAccuracy). */
function efficient(game: MahjongGame, seat: number, tileId: number): boolean | null {
  if (game.profile.card) return null;
  const tile = game.players[seat].hand.find((t) => t.id === tileId);
  if (!tile) return null;
  const evals = evaluateDiscards(game, seat);
  const minSh = Math.min(...evals.map((e) => e.shanten));
  const bestUke = Math.max(...evals.filter((e) => e.shanten === minSh).map((e) => e.ukeire));
  const mine = evals.find((e) => e.kind === tile.kind);
  if (!mine) return null;
  return mine.shanten === minSh && mine.ukeire >= bestUke * 0.85;
}

/** Measure a finished game from its replay. A generator, so it can run between frames. */
export function* measureGame(rec: ReplayRecord): Generator<void, GameSkill | null, void> {
  const me = rec.me;
  if (me < 0 || !rec.hands.length) return null;
  const out: GameSkill = { date: rec.date, variation: rec.config.variation, hands: 0, decisions: 0, good: 0, readyHands: 0, readyTurns: 0, exposedHands: 0, exposedDealIns: 0, callHands: 0 };
  let turns = 0;
  let ready = false;
  let exposed = false;
  let called = false;
  for (const ev of walkMatch(rec)) {
    if (ev.type === 'start') {
      turns = 0;
      ready = false;
      exposed = false;
      called = false;
    } else if (ev.type === 'action' && ev.action.t === 'd' && ev.action.s === me) {
      const g = ev.game;
      if (!exposed && g.players.some((_, s) => s !== me && isReady(g, s))) exposed = true;
      if (!g.players[me].riichi) {
        const ok = efficient(g, me, ev.action.id);
        if (ok !== null) {
          out.decisions++;
          if (ok) out.good++;
        }
      }
      yield;
    } else if (ev.type === 'applied') {
      if (ev.events.some((e) => e.type === 'call' && e.seat === me && e.claim !== 'win')) called = true;
      if (ev.action.t === 'd' && ev.action.s === me) {
        turns++;
        if (!ready && isReady(ev.game, me)) {
          ready = true;
          out.readyHands++;
          out.readyTurns += turns;
        }
      }
    } else if (ev.type === 'end') {
      if (!ev.result) break;
      out.hands++;
      if (called) out.callHands++;
      if (exposed) {
        out.exposedHands++;
        if (ev.result.type === 'win' && ev.result.discarder === me && ev.result.winner !== me) out.exposedDealIns++;
      }
    }
  }
  return out.hands ? out : null;
}

export interface SkillSummary {
  variation: string;
  games: number;
  /** Ratios over every stored game of this variation (null when there is nothing to measure yet). */
  value: Record<SkillId, number | null>;
  /** One value per recent game, oldest first, for the trend line. */
  trend: Record<SkillId, number[]>;
}

const ratio = (a: number, b: number) => (b > 0 ? a / b : null);

export function skillValue(g: Pick<GameSkill, 'decisions' | 'good' | 'readyHands' | 'readyTurns' | 'exposedHands' | 'exposedDealIns' | 'callHands' | 'hands'>, id: SkillId): number | null {
  switch (id) {
    case 'efficiency':
      return ratio(g.good, g.decisions);
    case 'defence':
      return ratio(g.exposedDealIns, g.exposedHands);
    case 'speed':
      return ratio(g.readyTurns, g.readyHands);
    case 'calls':
      return ratio(g.callHands, g.hands);
  }
}

export const SKILLS: SkillId[] = ['efficiency', 'defence', 'speed', 'calls'];

/** Per-variation summary of the stored games, most played first. */
export function summarise(games: GameSkill[] = loadSkills(), recent = 12): SkillSummary[] {
  const by = new Map<string, GameSkill[]>();
  for (const g of games) by.set(g.variation, [...(by.get(g.variation) ?? []), g]);
  return [...by.entries()]
    .map(([variation, gs]) => {
      const sum = gs.reduce((a, g) => ({ hands: a.hands + g.hands, decisions: a.decisions + g.decisions, good: a.good + g.good, readyHands: a.readyHands + g.readyHands, readyTurns: a.readyTurns + g.readyTurns, exposedHands: a.exposedHands + g.exposedHands, exposedDealIns: a.exposedDealIns + g.exposedDealIns, callHands: a.callHands + g.callHands }), { hands: 0, decisions: 0, good: 0, readyHands: 0, readyTurns: 0, exposedHands: 0, exposedDealIns: 0, callHands: 0 });
      const value = Object.fromEntries(SKILLS.map((id) => [id, skillValue(sum, id)])) as Record<SkillId, number | null>;
      const trend = Object.fromEntries(SKILLS.map((id) => [id, gs.slice(-recent).map((g) => skillValue(g, id)).filter((v): v is number => v !== null)])) as Record<SkillId, number[]>;
      return { variation, games: gs.length, value, trend };
    })
    .sort((a, b) => b.games - a.games);
}

/**
 * How far a skill sits from a sound club standard, 0 (fine) to 1 (needs work).
 * Efficiency aims at 80%, deal-ins under 12% once someone is ready, ready
 * within about eight turns, and calling in no more than half of your hands.
 */
export function weakness(id: SkillId, v: number | null): number {
  if (v === null) return 0;
  switch (id) {
    case 'efficiency':
      return Math.max(0, Math.min(1, (0.8 - v) / 0.4));
    case 'defence':
      return Math.max(0, Math.min(1, (v - 0.12) / 0.3));
    case 'speed':
      return Math.max(0, Math.min(1, (v - 8) / 6));
    case 'calls':
      // Calling little is often right (closed Riichi hands); calling a lot gives your hand away.
      return v > 0.5 ? Math.min(1, (v - 0.5) / 0.4) : 0;
  }
}

/** The skill most worth practising for a summary (or null when all look fine). */
export function weakest(s: SkillSummary): SkillId | null {
  let best: SkillId | null = null;
  let most = 0.1;
  for (const id of SKILLS) {
    const w = weakness(id, s.value[id]);
    if (w > most) {
      most = w;
      best = id;
    }
  }
  return best;
}
