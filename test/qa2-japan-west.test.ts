// Second QA pass over Riichi, Sanma, Korean, the SEA club tables, the Western
// games and the UAE rulesets: regression tests for what it fixed.

import { describe, expect, it } from 'vitest';
import { MahjongGame } from '../src/engine/game';
import { buildProfile } from '../src/club/sim';
import { winningDecompositions } from '../src/engine/hand';
import { parseKinds } from '../src/engine/tiles';
import { riichiProfile } from '../src/engine/rules/riichi';
import { koreanProfile, koreanScore } from '../src/engine/rules/korean';
import { korean4Profile } from '../src/engine/rules/korean4';
import { guideFor } from '../src/ui/scoringGuideData';
import type { RuleProfile, ScoringContext } from '../src/engine/rules/types';

/** Best score of a closed hand (13 tiles + the winning tile) under a profile. */
function best(p: RuleProfile, hand: string, win: string, extra: Partial<ScoringContext> = {}) {
  const counts = new Array(34).fill(0);
  for (const k of parseKinds(hand)) counts[k]++;
  const w = parseKinds(win)[0];
  counts[w]++;
  const scores = winningDecompositions(counts, 0, p.shapes).map((d) =>
    p.score({ decomposition: d, melds: [], concealedCounts: counts, winKind: w, selfDrawn: true, seatWind: 'S', prevailingWind: 'E', isDealer: false, lastTileOfWall: false, afterKong: false, dealerRepeat: 0, doraKinds: [], uraDoraKinds: [], ...extra }),
  );
  return scores.sort((a, b) => b.points - a.points)[0];
}

describe('Riichi: tenhou and chiihou', () => {
  it('the dealer winning on the deal is a yakuman (tenhou)', () => {
    const s = best(riichiProfile, '123m 456p 789s 234s 5p', '5p', { seatWind: 'E', isDealer: true, heavenly: true });
    expect(s.items.map((i) => i.name)).toEqual(['Tenhou']);
    expect(s.tier).toBe('Yakuman');
    expect(s.points).toBe(48000);
  });

  it('a non-dealer self-drawing on the first draw is a yakuman (chiihou), and stacks with another yakuman', () => {
    expect(best(riichiProfile, '123m 456p 789s 234s 5p', '5p', { firstDraw: true }).items.map((i) => i.name)).toEqual(['Chiihou']);
    const both = best(riichiProfile, '111m 999p 555s EEE N', 'N', { firstDraw: true });
    expect(both.items.map((i) => i.name).sort()).toEqual(['Chiihou', 'Suuankou']);
    // Not the dealer's first draw, and not a later draw.
    expect(best(riichiProfile, '123m 456p 789s 234s 5p', '5p', { firstDraw: true, isDealer: true, seatWind: 'E' }).items.map((i) => i.name)).not.toContain('Chiihou');
    expect(best(riichiProfile, '123m 456p 789s 234s 5p', '5p').tier).toBeUndefined();
  });

  it('the engine passes the first draw: a non-dealer who wins on their first draw scores chiihou', () => {
    const g = new MahjongGame(buildProfile('riichi', 'eastRound'), ['A', 'B', 'C', 'D'], 11);
    g.startHand(11);
    const dealer = g.dealer;
    const ph0 = g.state.phase;
    if (ph0.kind !== 'turn') throw new Error('dealer not on turn');
    g.discard(dealer, g.players[dealer].hand[0].id);
    for (let i = 0; i < 4 && g.state.phase.kind === 'claims'; i++) for (const s of g.pendingClaimSeats()) g.respond(s, { type: 'pass' });
    const ph = g.state.phase;
    if (ph.kind !== 'turn') throw new Error('no next turn');
    const seat = ph.seat;
    expect(seat).not.toBe(dealer);
    const kinds = parseKinds('123m 456p 789s 234s 5p 5p');
    g.players[seat].hand.forEach((t, i) => (t.kind = kinds[i]));
    (ph as { drawn: unknown }).drawn = g.players[seat].hand[13];
    (g as unknown as { seatShapeCache: unknown[] }).seatShapeCache = [];
    const opts = g.turnOptions(seat);
    expect(opts.canWin).toBe(true);
    expect(opts.winScore!.items.map((i) => i.name)).toContain('Chiihou');
  });

  it('the scoring guide lists both', () => {
    const names = guideFor(riichiProfile).sections.flatMap((s) => s.lines.map((l) => l.name));
    expect(names).toEqual(expect.arrayContaining(['Tenhou', 'Chiihou']));
  });
});

describe('Korean: the scoring guide matches the scorer', () => {
  it('lists every limit hand and every incidental point the scorer gives', () => {
    for (const p of [koreanProfile, korean4Profile]) {
      const names = guideFor(p).sections.flatMap((s) => s.lines.map((l) => l.name));
      for (const n of ['All Terminals', 'Small Four Winds', 'Four Kongs', 'Win after Kong', 'Robbing the Kong', 'Last tile']) expect(names).toContain(n);
    }
    // The scorer does give them.
    const k = koreanProfile;
    expect(best(k, '222p 555p 777s 999s 4p', '4p').items[0].name).toBe('Four Concealed Pungs');
    expect(best(k, '111p 999p 999s 111s 9m', '9m', { selfDrawn: false }).items.map((i) => i.name)).toContain('All Terminals');
    expect(best(k, 'EEE SSS WWW N 123p', 'N', { selfDrawn: false }).items.map((i) => i.name)).toContain('Small Four Winds');
    expect(koreanScore).toBe(k.score);
  });
});
