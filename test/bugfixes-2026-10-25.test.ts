import { describe, expect, it } from 'vitest';
import { MahjongGame } from '../src/engine/game';
import { toCounts } from '../src/engine/tiles';
import { EAST } from './helpers-india';
import { withHouseRules } from '../src/engine/rules';
import { indiaProfile } from '../src/engine/rules/india';
import { AiPlayer } from '../src/ai/players';
import { handStatus } from '../src/ai/jongbot';
import { currentShanten } from '../src/ai/evaluate';
import { callLeavesNoWin } from '../src/ai/strategy';

// Bug round 2026-10-25.
describe('bug round 2026-10-25', () => {
  it('the rule book reads the passport road from the game, so it never says "99 tiles from ready"', () => {
    const g = new MahjongGame(EAST, ['A', 'B', 'C', 'D'], 7);
    g.startHand(7);
    for (let seat = 0; seat < 4; seat++) {
      const pl = g.players[seat];
      const c = toCounts(pl.hand.map((t) => t.kind));
      // The profile's own shape can't see declared sets, so it gives up (99); the seat's shapes measure it.
      const road = g.shapesFor(seat).special!.find((s) => s.name === 'Passport')!;
      expect(road.shanten(c, pl.melds.length)).toBeLessThan(99);
    }
  });


  it('a call that fits no card reads "no win possible", never "99 tiles from ready"', () => {
    const g = new MahjongGame(withHouseRules(indiaProfile, { indiaRounds: 'N' }), ['A', 'B', 'C', 'D'], 2);
    g.startHand(2);
    const ph = g.state.phase as { kind: string; seat: number };
    g.chooseRound(ph.seat, 2);
    const ais = [0, 1, 2, 3].map((s) => new AiPlayer(s, 'expert', 'zen', 5 + s));
    if (g.state.phase.kind === 'cardPick') ais.forEach((a, s) => g.pickCard(s, a.cardPick(g)));
    // Every card hand checked: find a seat and a chow that no card of theirs can use.
    const pl = g.players[0];
    let hit = false;
    for (let k = 0; k < 25 && !hit; k++) {
      if (k % 9 > 6) continue;
      const take = pl.hand.splice(0, 3);
      pl.melds.push({ type: 'chow', tiles: [0, 1, 2].map((i) => ({ id: 9000 + k * 3 + i, kind: k + i })), concealed: false, from: 3 });
      if (currentShanten(g, 0) >= 99) hit = true;
      else (pl.melds.pop(), pl.hand.unshift(...take));
    }
    expect(hit).toBe(true);
    expect(handStatus(g, 0)).toBe('no win possible with these sets');
  });

  it('a chow that fits no Small Card is flagged for the warning, and an ordinary game never is', () => {
    const g = new MahjongGame(withHouseRules(indiaProfile, { indiaRounds: 'N' }), ['A', 'B', 'C', 'D'], 2);
    g.startHand(2);
    const ph = g.state.phase as { kind: string; seat: number };
    g.chooseRound(ph.seat, 2);
    const ais = [0, 1, 2, 3].map((s) => new AiPlayer(s, 'expert', 'zen', 5 + s));
    if (g.state.phase.kind === 'cardPick') ais.forEach((a, s) => g.pickCard(s, a.cardPick(g)));
    let flagged = 0, kept = 0;
    for (let seat = 0; seat < 4; seat++) {
      const kinds = new Set(g.players[seat].hand.map((t) => t.kind));
      for (let k = 0; k < 27; k++) {
        if (k % 9 > 6 || !kinds.has(k + 1) || !kinds.has(k + 2)) continue;
        if (callLeavesNoWin(g, seat, { type: 'chow', using: [k + 1, k + 2] }, k)) flagged++;
        else kept++;
      }
      expect(callLeavesNoWin(g, seat, { type: 'win' }, 0)).toBe(false);
    }
    expect(flagged).toBeGreaterThan(0);
    const plain = new MahjongGame(EAST, ['A', 'B', 'C', 'D'], 3);
    plain.startHand(3);
    const pl = plain.players[1];
    const k = pl.hand[0].kind;
    expect(callLeavesNoWin(plain, 1, { type: 'pung' }, k)).toBe(false);
  });
});
