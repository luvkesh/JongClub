// Table speed: how long you have to answer a claim (Pung, Chow, Kong, a win)
// and to make your own discard. Chosen when the table is set up, stored in
// TableConfig and shared with every seat of a live table (the host's config).
// The countdown itself is pure arithmetic here, so it can be tested.

import { tr } from '../i18n';

export type TablePace = 'relaxed' | 'standard' | 'competitive' | 'untimed';

export interface PaceSpec {
  label: string;
  /** Seconds to answer a claim; 0 = no limit. */
  claim: number;
  /** Seconds for your own turn (and Charleston picks); 0 = no limit. */
  turn: number;
  blurb: string;
}

export const PACES: Record<TablePace, PaceSpec> = {
  relaxed: { label: tr('Relaxed'), claim: 15, turn: 45, blurb: tr('Plenty of time to think: 15 s to claim, 45 s per turn.') },
  standard: { label: tr('Standard'), claim: 8, turn: 25, blurb: tr('A steady club pace: 8 s to claim, 25 s per turn.') },
  competitive: { label: tr('Competitive'), claim: 4, turn: 12, blurb: tr('Quick, tournament-style: 4 s to claim, 12 s per turn.') },
  untimed: { label: tr('Untimed'), claim: 0, turn: 0, blurb: tr('No clock. Take all the time you like.') },
};

export const PACE_ORDER: TablePace[] = ['relaxed', 'standard', 'competitive', 'untimed'];

const isPace = (p: unknown): p is TablePace => typeof p === 'string' && p in PACES;

/**
 * A table's speed. Older configs (and shared live tables from older clients)
 * only carry `timer`, the turn time in seconds: map it to the nearest speed.
 */
export function paceOf(cfg: { pace?: unknown; timer?: number }): TablePace {
  if (isPace(cfg.pace)) return cfg.pace;
  const t = Number(cfg.timer) || 0;
  if (t <= 0) return 'untimed';
  if (t <= 15) return 'competitive';
  if (t <= 30) return 'standard';
  return 'relaxed';
}

/** Claim and turn limits (seconds) for a table. */
export function paceLimits(cfg: { pace?: unknown; timer?: number }): { claim: number; turn: number } {
  const p = PACES[paceOf(cfg)];
  return { claim: p.claim, turn: p.turn };
}

/** The first move of a hand gets extra time to take in the deal. */
export const FIRST_TURN_MIN = 15;

/** Turn limit (seconds) for a player's first move of the hand: twice the usual time, at least 15 s. Untimed stays untimed. */
export function firstTurnLimit(turn: number): number {
  return turn > 0 ? Math.max(turn * 2, FIRST_TURN_MIN) : 0;
}

/** One line for the table summary, e.g. "Standard pace · 8 s claims · 25 s turns". */
export function paceSummary(cfg: { pace?: unknown; timer?: number }): string {
  const id = paceOf(cfg);
  const p = PACES[id];
  return id === 'untimed' ? tr('Untimed') : tr('{pace} pace · {claim}s claims · {turn}s turns', { pace: p.label, claim: p.claim, turn: p.turn });
}

/** Seconds at which the countdown gives a soft tick. */
export const TICK_FROM = 3;

export interface CountdownState {
  /** Whole seconds left, rounded up (shown in the ring). */
  left: number;
  /** Share of the time left, 1 → 0 (drives the ring). */
  frac: number;
  /** In the last few seconds. */
  low: boolean;
  done: boolean;
}

/** Where a countdown of `totalMs` stands after `elapsedMs` of (unpaused) time. */
export function countdownAt(totalMs: number, elapsedMs: number): CountdownState {
  if (totalMs <= 0) return { left: 0, frac: 1, low: false, done: false };
  const rem = Math.max(0, totalMs - Math.max(0, elapsedMs));
  const left = Math.max(0, Math.ceil(rem / 1000 - 1e-9));
  return { left, frac: rem / totalMs, low: left <= TICK_FROM, done: rem <= 0 };
}

/** Whether moving from `prevLeft` to `left` whole seconds should tick (once per second, last 3 s only). */
export function shouldTick(prevLeft: number, left: number): boolean {
  return left < prevLeft && left >= 1 && left <= TICK_FROM;
}

/**
 * A pausable clock for one decision. Time only runs while not paused, so a
 * solo player who opens Settings or the card does not lose their turn.
 */
export class Countdown {
  private elapsed = 0;
  private last: number;
  private prevLeft: number;

  constructor(
    readonly totalMs: number,
    now: number,
  ) {
    this.last = now;
    this.prevLeft = Math.ceil(totalMs / 1000);
  }

  /** Advance to `now`; returns the state and whether a tick is due. */
  step(now: number, paused = false): CountdownState & { tick: boolean } {
    const dt = Math.max(0, now - this.last);
    this.last = now;
    if (!paused) this.elapsed += dt;
    const st = countdownAt(this.totalMs, this.elapsed);
    const tick = shouldTick(this.prevLeft, st.left);
    this.prevLeft = st.left;
    return { ...st, tick };
  }
}
