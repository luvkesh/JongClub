// "Nothing claimed" hands (Seven Pairs, Thirteen Orphans, a concealed hand): no set may be
// claimed, but the winning tile itself may be taken from a discard. The rule book says so in
// plain words (user, 2026-11-17: "clarify if winning tile can be claimed or not?").

import { describe, expect, it } from 'vitest';
import { MahjongGame } from '../src/engine/game';
import { getProfile, VARIATIONS } from '../src/engine/rules';
import { guideFor } from '../src/ui/scoringGuideData';
import { rig } from './helpers/qaRig';

/** Seat 0 throws `tile`; does seat 1 (holding `hand`) get a Mahjong call, and what does it score? */
function winOnDiscard(id: string, hand: string, tile: string) {
  const p = getProfile(id)!;
  const g = new MahjongGame(p, ['A', 'B', 'C', 'D'].slice(0, p.players), 5);
  g.startHand(5);
  const filler = p.players === 3 ? '2s 3s 4s 6s 7s 8s 9s 9s 9s 5s 5s 4s 4s' : '2s 3s 4s 6s 7s 8s 3p 3p 3p 5s 5s 4s 4s';
  const r = rig(g, [{ hand: `${filler} ${tile}` }, { hand }], { turn: 0 });
  g.discard(0, r.tile(0, tile).id);
  const ph = g.state.phase;
  if (ph.kind !== 'claims' || !ph.options[1]?.some((o) => o.type === 'win')) return null;
  g.respond(1, { type: 'win' });
  for (const s of g.pendingClaimSeats()) g.respond(s, { type: 'pass' });
  const end = g.state.phase;
  return end.kind === 'handOver' ? end.result.score?.items.map((i) => i.name) ?? [] : null;
}

const PAIRS = VARIATIONS.map((v) => v.id).filter((id) => {
  const p = getProfile(id);
  return p && !p.wilds && !p.card && p.shapes.sevenPairs && !p.shapes.sevenPairsQuads;
});

describe('Seven Pairs may be won on a discard', () => {
  it.each(PAIRS)('%s', (id) => {
    const items = winOnDiscard(id, '1p 1p 4p 4p 7p 7p 9p 9p 2s 2s 5s 5s E', 'E');
    expect(items, id).not.toBeNull();
  });

  it('Classic: Seven Pairs on a discard still scores Seven Pairs and the concealed hand', () => {
    const items = winOnDiscard('classic', '1p 1p 4p 4p 7p 7p 9p 9p 2s 2s 5s 5s E', 'E');
    expect(items).toEqual(expect.arrayContaining(['Seven Pairs', 'Concealed hand']));
    expect(items).not.toContain('Self-drawn');
  });
});

describe('Four Concealed Pungs: only the pair’s tile may be a discard', () => {
  it.each(['classic', 'hongkong', 'riichi', 'mcr'])('%s', (id) => {
    const four = id === 'riichi' ? 'Suuankou' : 'Four Concealed Pungs';
    // Waiting on the pair: the discard finishes the pair, the four pungs stay concealed.
    expect(winOnDiscard(id, '1m 1m 1m 4p 4p 4p 7s 7s 7s 9s 9s 9s E', 'E'), id).toContain(four);
    // Waiting on two pairs: the discard finishes a pung, so only three are concealed.
    expect(winOnDiscard(id, '1m 1m 1m 4p 4p 4p 7s 7s 7s 9s 9s E E', '9s'), id).not.toContain(four);
  });
});

describe('the rule book says the winning tile may be a discard', () => {
  it('no guide line says only "nothing claimed" or "claimed nothing" without saying so', () => {
    for (const v of VARIATIONS) {
      const p = getProfile(v.id);
      if (!p) continue;
      const g = guideFor(p);
      const lines = [...g.win, ...g.sections.flatMap((s) => s.lines.map((l) => `${l.name}: ${l.how}`))];
      for (const l of lines) {
        if (!/nothing claimed|claimed nothing|none of them claimed|never claimed/i.test(l)) continue;
        expect(l, `${v.id}: ${l}`).toMatch(/discard|own draws|the wall|winning tile/i);
      }
    }
  });
});
