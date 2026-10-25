import { describe, expect, it } from 'vitest';
import { AiPlayer } from '../src/ai/players';
import { MahjongGame } from '../src/engine/game';
import { VARIATIONS, getProfile } from '../src/engine/rules';
import { classicProfile } from '../src/engine/rules/classic';
import { FLOWER_BASE, JOKER_KIND } from '../src/engine/tiles';
import { BOARD_NEAR, boardPos, boardSlot, discardLayoutFor } from '../src/render/discardMarks';

describe('discard layouts', () => {
  it('maps each variation to its layout', () => {
    const pond = ['riichi', 'riichi-tournament', 'sanma'];
    const centre = ['american', 'uae-american', 'wright-patterson'];
    for (const v of VARIATIONS) {
      const want = pond.includes(v.id) ? 'pond' : centre.includes(v.id) ? 'centre' : 'rows';
      expect([v.id, discardLayoutFor('auto', getProfile(v.id)?.discards)]).toEqual([v.id, want]);
    }
    expect(discardLayoutFor('centre', 'pond')).toBe('centre');
    expect(discardLayoutFor(undefined, undefined)).toBe('rows');
  });

  it('gives every kind its own centre-board slot, flowers and jokers sharing one each', () => {
    const seen = new Set<string>();
    for (let k = 0; k < 34; k++) {
      const { row, col } = boardSlot(k);
      const key = `${row}:${col}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    expect(boardSlot(FLOWER_BASE)).toEqual(boardSlot(FLOWER_BASE + 7));
    expect(boardSlot(JOKER_KIND)).toEqual({ row: 3, col: 8 });
    expect(boardSlot(18)).toEqual({ row: 0, col: 0 });
    // The board stays clear of the compass (radius 0.66) and inside the walls.
    for (let r = 0; r < 4; r++) for (let c = 0; c < 9; c++) {
      const { x, z } = boardPos(r, c);
      expect(Math.abs(z)).toBeGreaterThan(0.66 + 0.28);
      expect(Math.abs(x)).toBeLessThan(2.4);
    }
    expect(BOARD_NEAR).toBeLessThan(2.6);
  });

  it('records each called discard with its river slot and taker', () => {
    let calls = 0;
    for (let seed = 1; seed <= 15; seed++) {
      const g = new MahjongGame(classicProfile, ['A', 'B', 'C', 'D'], seed);
      const ais = [0, 1, 2, 3].map((s) => new AiPlayer(s, 'casual', 'shark', seed * 7 + s));
      g.startHand(seed);
      let steps = 0;
      while (g.state.phase.kind !== 'handOver' && steps++ < 1000) {
        const ph = g.state.phase;
        if (ph.kind === 'turn') {
          const d = ais[ph.seat].decideTurn(g);
          if (d.action === 'win') g.declareSelfDrawWin(ph.seat);
          else if (d.action === 'kong') g.declareKong(ph.seat, d.kind!);
          else g.discard(ph.seat, d.tileId!);
        } else if (ph.kind === 'claims') {
          for (const s of g.pendingClaimSeats()) {
            const cur = g.state.phase;
            if (cur.kind !== 'claims') break;
            g.respond(s, ais[s].decideClaim(g, cur.options[s], cur.tile.kind));
          }
        } else break;
      }
      for (const p of g.state.players) {
        expect(p.called.map((c) => c.id)).toEqual(p.claimedDiscards);
        for (const c of p.called) {
          calls++;
          expect(c.by).not.toBe(p.seat);
          expect(c.at).toBeLessThanOrEqual(p.discards.length);
          expect(p.discards.some((t) => t.id === c.id)).toBe(false);
        }
      }
    }
    expect(calls).toBeGreaterThan(10);
  });
});
