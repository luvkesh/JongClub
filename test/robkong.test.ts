import { describe, expect, it } from 'vitest';
import { MahjongGame } from '../src/engine/game';
import { americanProfile } from '../src/engine/rules/american';
import { classicProfile } from '../src/engine/rules/classic';
import { riichiProfile } from '../src/engine/rules/riichi';
import { taiwaneseProfile } from '../src/engine/rules/taiwanese';
import { uaeProfile } from '../src/engine/rules/uae';
import type { RuleProfile } from '../src/engine/rules/types';
import type { Meld } from '../src/engine/state';
import { Tile, parseKinds } from '../src/engine/tiles';

const k = (s: string) => parseKinds(s)[0];

/** Tiles with ids that avoid the red-five copies (id % 4 === 3, then 2, ...). */
function tiles(spec: string): Tile[] {
  const used = new Map<number, number>();
  return parseKinds(spec).map((kind) => {
    const n = used.get(kind) ?? 0;
    used.set(kind, n + 1);
    return { id: kind * 4 + 3 - n, kind };
  });
}

/**
 * Seat 0 has an exposed 5p pung and holds the fourth 5p; seat 1 waits on 5p.
 * Seats 2 and 3 hold dead hands. It is seat 0's turn.
 */
function setup(profile: RuleProfile, waiter = '123m 456m 789s 46p NN') {
  const g = new MahjongGame(profile, ['A', 'B', 'C', 'D'], 7);
  g.startHand(7);
  const p0 = g.players[0];
  const pung: Meld = { type: 'pung', tiles: [{ id: 50, kind: k('5p') }, { id: 49, kind: k('5p') }, { id: 48, kind: k('5p') }], concealed: false, from: 2 };
  const fourth: Tile = { id: 51, kind: k('5p') };
  p0.melds = [pung];
  p0.hand = [...tiles('123s 789m EE WdWd 1p'), fourth];
  g.players[1].hand = tiles(waiter);
  g.players[2].hand = tiles('1357m 1357p 1357s E');
  g.players[3].hand = tiles('2468m 2468p 2468s S');
  for (const pl of g.players) {
    pl.discardKinds = [];
    pl.melds = pl === p0 ? pl.melds : [];
  }
  g.state.phase = { kind: 'turn', seat: 0, drawn: fourth, afterKong: false, mustDiscardOnly: false };
  return { g, fourth };
}

describe('robbing the kong', () => {
  it('Classic: an added kong opens a win-only window and the kong maker pays as discarder', () => {
    const { g, fourth } = setup(classicProfile);
    expect(g.turnOptions(0).kongs).toContain(k('5p'));
    const before = g.players.map((p) => p.score);
    g.declareKong(0, k('5p'));
    const ph = g.state.phase;
    expect(ph.kind).toBe('claims');
    if (ph.kind !== 'claims') return;
    expect(ph.robKong).toBe(true);
    expect(ph.discarder).toBe(0);
    expect(ph.tile.id).toBe(fourth.id);
    expect(ph.options).toEqual({ 1: [{ type: 'win' }] });
    expect(g.pendingClaimSeats()).toEqual([1]);
    expect(g.state.log.some((e) => e.type === 'robKongChance')).toBe(true);

    g.respond(1, { type: 'win' });
    const end = g.state.phase;
    expect(end.kind).toBe('handOver');
    if (end.kind !== 'handOver') return;
    const r = end.result;
    expect(r.winner).toBe(1);
    expect(r.discarder).toBe(0);
    expect(r.robbedKong).toBe(true);
    expect(r.score!.items.map((i) => i.name)).toContain('Robbing the Kong');
    // The pung stays a pung; the tile went to the winner.
    expect(g.players[0].melds[0].type).toBe('pung');
    expect(g.players[0].melds[0].tiles).toHaveLength(3);
    expect(g.players[0].hand.some((t) => t.id === fourth.id)).toBe(false);
    expect(g.players[1].hand.some((t) => t.id === fourth.id)).toBe(true);
    // Half gun: the kong maker pays double, the others half.
    const pts = r.score!.points;
    expect(before[0] - g.players[0].score).toBe(pts * 2);
    expect(before[2] - g.players[2].score).toBe(pts / 2);
    const log = g.state.log.map((e) => e.type);
    expect(log.indexOf('robKong')).toBeLessThan(log.indexOf('win'));
    expect(g.state.log.find((e) => e.type === 'robKong')).toMatchObject({ seat: 1, from: 0 });
  });

  it('Classic: if everyone passes, the kong stands and the replacement is drawn', () => {
    const { g } = setup(classicProfile);
    const called = g.state.callsMade;
    g.declareKong(0, k('5p'));
    g.respond(1, { type: 'pass' });
    const ph = g.state.phase;
    expect(ph.kind).toBe('turn');
    if (ph.kind !== 'turn') return;
    expect(ph.seat).toBe(0);
    expect(ph.afterKong).toBe(true);
    expect(g.players[0].melds[0].type).toBe('kong');
    expect(g.players[0].melds[0].tiles).toHaveLength(4);
    expect(g.state.callsMade).toBe(called + 1);
    const last = g.state.log[g.state.log.length - 1];
    expect(last).toMatchObject({ type: 'draw', seat: 0, replacement: true });
  });

  it('no window when nobody can win: the kong completes at once', () => {
    const { g } = setup(classicProfile, '1357m 1357p 1357s W');
    g.declareKong(0, k('5p'));
    expect(g.state.phase.kind).toBe('turn');
    expect(g.players[0].melds[0].type).toBe('kong');
  });

  it('flag off: no window even when someone could win', () => {
    const { g } = setup({ ...classicProfile, robKong: false });
    g.declareKong(0, k('5p'));
    expect(g.state.phase.kind).toBe('turn');
    expect(g.players[0].melds[0].type).toBe('kong');
  });

  it('Riichi: Chankan is a yaku on its own and the kong maker pays the ron', () => {
    const { g } = setup(riichiProfile);
    const before = g.players[0].score;
    g.declareKong(0, k('5p'));
    const ph = g.state.phase;
    expect(ph.kind === 'claims' && ph.robKong).toBe(true);
    g.respond(1, { type: 'win' });
    const end = g.state.phase;
    if (end.kind !== 'handOver') throw new Error('expected a win');
    const items = end.result.score!.items;
    // Dora from the random indicator may add han, but Chankan is the only yaku.
    expect(items.map((i) => i.name).filter((n) => n !== 'Dora')).toEqual(['Chankan']);
    expect(items[0].value).toBe(1);
    expect(end.result.score!.qualifies).toBe(true);
    expect(end.result.payments).toEqual([{ from: 0, to: 1, amount: end.result.score!.points }]);
    expect(before - g.players[0].score).toBe(end.result.score!.points);
  });

  it('Riichi: furiten blocks the rob, and passing a rob makes you furiten', () => {
    const a = setup(riichiProfile);
    a.g.players[1].discardKinds = [k('5p')];
    a.g.declareKong(0, k('5p'));
    expect(a.g.state.phase.kind).toBe('turn');

    const b = setup(riichiProfile);
    b.g.declareKong(0, k('5p'));
    b.g.respond(1, { type: 'pass' });
    expect(b.g.players[1].furitenTemp).toBe(true);
    expect(b.g.players[0].melds[0].type).toBe('kong');
  });

  it('Taiwanese and Dubai score it too', () => {
    const tw = setup(taiwaneseProfile, '123m 456m 789s 111s 46p NN');
    tw.g.declareKong(0, k('5p'));
    tw.g.respond(1, { type: 'win' });
    const t = tw.g.state.phase;
    if (t.kind !== 'handOver') throw new Error('expected a win');
    expect(t.result.score!.items.map((i) => i.name)).toContain('Robbing the kong');

    const ua = setup(uaeProfile);
    ua.g.declareKong(0, k('5p'));
    ua.g.respond(1, { type: 'win' });
    const u = ua.g.state.phase;
    if (u.kind !== 'handOver') throw new Error('expected a win');
    expect(u.result.score!.items.map((i) => i.name)).toContain('Robbing the Kong');
  });

  it('same seed and actions give the same state', () => {
    const run = () => {
      const { g } = setup(riichiProfile);
      g.declareKong(0, k('5p'));
      g.respond(1, { type: 'pass' });
      return JSON.stringify(g.state);
    };
    expect(run()).toBe(run());
  });

  it('American never offers it', () => {
    expect(americanProfile.robKong).toBeFalsy();
    const g = new MahjongGame(americanProfile, ['A', 'B', 'C', 'D'], 3);
    g.startHand(3);
    const p0 = g.players[0];
    const fourth: Tile = { id: 51, kind: k('5p') };
    p0.melds = [{ type: 'pung', tiles: [{ id: 50, kind: k('5p') }, { id: 49, kind: k('5p') }, { id: 48, kind: k('5p') }], concealed: false, from: 2 }];
    p0.hand = [...p0.hand.slice(0, 10), fourth];
    g.state.phase = { kind: 'turn', seat: 0, drawn: fourth, afterKong: false, mustDiscardOnly: false };
    expect(g.turnOptions(0).kongs).toEqual([]);
    expect(() => g.declareKong(0, k('5p'))).toThrow();
  });
});
