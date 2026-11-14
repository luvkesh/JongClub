// Round-2 shell checks: payouts, the daily bonus, records and the per-game cap (src/minigames/progress.ts).
import { beforeEach, describe, expect, it } from 'vitest';
import { DAILY_PUZZLE_BONUS, MINI_DAILY_CAP, bestOf, earnedToday, loadMini, payout, recordResult, resetMiniCache } from '../src/minigames/progress';
import type { MiniGameDef, MiniResult } from '../src/minigames/types';

const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage;

const def = (id: string, reward: (r: MiniResult) => number): MiniGameDef => ({ id, title: id, blurb: '', minutes: '1', order: 0, icon: { kinds: [], shape: 'stack' }, levels: ['medium'], howTo: [], reward, start: () => ({ onPick() {}, dispose() {} }) });
const res = (o: Partial<MiniResult> = {}): MiniResult => ({ won: true, score: 100, seconds: 60, cleared: 10, total: 10, hints: 0, undos: 0, shuffles: 0, ...o });
const DAY = '2026-11-13';

beforeEach(() => {
  store.clear();
  resetMiniCache();
});

describe('mini-game payouts', () => {
  it('caps each game at the daily cap and logs exactly what was paid', () => {
    const g = def('g', () => 250);
    const paid = [1, 2, 3, 4].map(() => payout(g, res(), 'medium', false, DAY).paid);
    expect(paid).toEqual([250, 250, MINI_DAILY_CAP - 500, 0]);
    expect(earnedToday('g', DAY)).toBe(MINI_DAILY_CAP);
    expect(loadMini().totalEarned).toBe(MINI_DAILY_CAP);
  });

  it('pays the daily puzzle bonus once, on the first solve, even past the cap', () => {
    const g = def('d', () => 700);
    const a = payout(g, res(), 'medium', true, DAY);
    expect(a).toMatchObject({ paid: MINI_DAILY_CAP + DAILY_PUZZLE_BONUS, bonus: DAILY_PUZZLE_BONUS, capped: true });
    const b = payout(g, res(), 'medium', true, DAY);
    expect(b).toMatchObject({ paid: 0, bonus: 0 });
    // A loss first, then the solve: the bonus still comes once.
    resetMiniCache();
    store.clear();
    expect(payout(g, res({ won: false }), 'medium', true, DAY).bonus).toBe(0);
    expect(payout(g, res(), 'medium', true, DAY).bonus).toBe(DAILY_PUZZLE_BONUS);
  });

  it('pays nothing for a broken reward instead of NaN', () => {
    expect(payout(def('n', () => NaN), res(), 'medium', false, DAY).paid).toBe(0);
    expect(payout(def('i', () => Infinity), res(), 'medium', false, DAY).paid).toBe(0);
    expect(Number.isFinite(loadMini().totalEarned)).toBe(true);
  });
});

describe('mini-game records', () => {
  it('keeps fastest times only for games the player sets the pace of', () => {
    recordResult('blitz:medium', res({ seconds: 90 }), false);
    const r = recordResult('blitz:medium', res({ seconds: 20 }), false);
    expect(r.newBestTime).toBe(false);
    expect(bestOf('blitz:medium')?.seconds).toBe(0);
    recordResult('solitaire:medium', res({ seconds: 90 }));
    expect(recordResult('solitaire:medium', res({ seconds: 20 })).newBestTime).toBe(true);
  });

  it('marks Blitz and Survival as clock-length games', async () => {
    await import('../src/minigames/games');
    const { miniGame } = await import('../src/minigames/registry');
    expect(miniGame('blitz')?.timeRecord).toBe(false);
    expect(miniGame('survival')?.timeRecord).toBe(false);
    expect(miniGame('timed')?.timeRecord).not.toBe(false);
  });
});
