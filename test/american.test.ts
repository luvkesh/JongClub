import { describe, expect, it } from 'vitest';
import { AiPlayer } from '../src/ai/players';
import { MahjongGame } from '../src/engine/game';
import { CARD, FLOWER, INSTANCES, americanProfile, evaluateCard, missingFor } from '../src/engine/rules/american';
import type { Meld } from '../src/engine/state';
import { JOKER_KIND, parseKinds, type Tile } from '../src/engine/tiles';

const P = americanProfile;
let nextId = 1000;
const tiles = (spec: string): Tile[] => parseKinds(spec).map((kind) => ({ id: nextId++, kind }));

describe('american card', () => {
  it('every card hand is 14 tiles and buildable from the set', () => {
    expect(CARD.length).toBeGreaterThan(20);
    for (const inst of INSTANCES) {
      expect(inst.groups.reduce((a, g) => a + g.size, 0)).toBe(14);
      const need = new Map<number, number>();
      for (const g of inst.groups) need.set(g.kind, (need.get(g.kind) ?? 0) + g.size);
      for (const [k, n] of need) {
        const naturals = k === FLOWER ? 8 : 4;
        const jokerable = inst.groups.filter((g) => g.kind === k && g.size >= 3).reduce((a, g) => a + g.size, 0);
        expect(n - Math.min(n, naturals)).toBeLessThanOrEqual(Math.min(jokerable, 8));
      }
    }
  });

  it('matches a hand with jokers in sets but not in pairs', () => {
    // NNNN EEE WWW SSSS with jokers standing in for two winds.
    const hand = tiles('NNN J EE J WWW SSSS');
    const s = evaluateCard(hand, [], false)!;
    expect(s).not.toBeNull();
    expect(s.points).toBe(25);
    // FF NNN EEE WWW SSS: a joker can't be the flower pair.
    expect(evaluateCard(tiles('F1 J NNN EEE WWW SSS'), [], false)).toBeNull();
  });

  it('jokerless doubles, concealed hands refuse exposures', () => {
    const s = evaluateCard(tiles('NNNN EEE WWW SSSS'), [], true)!;
    expect(s.points).toBe(50);
    const sp = INSTANCES.find((i) => i.hand.pattern === 'NN EE WW SS RR GG 00')!;
    const meld: Meld = { type: 'pung', tiles: tiles('NNN'), concealed: false };
    expect(missingFor(sp, tiles('EE WW SS RR GG 00 N'), [meld])).toBe(Infinity);
  });

  it('flowers are interchangeable', () => {
    const s = evaluateCard(tiles('F1 F6 NNN EEE WWW SSS'), [], false);
    expect(s?.points).toBe(50);
  });

  it('payments: discarder pays double, others single; self-pick everyone double', () => {
    const s = { value: 25, unit: 'pts', items: [], points: 25, limit: false };
    expect(P.payments(0, 2, s, 1, 4, 0).map((p) => p.amount)).toEqual([25, 50, 25]);
    expect(P.payments(0, null, s, 1, 4, 0).map((p) => p.amount)).toEqual([50, 50, 50]);
  });

  it('runs the Charleston and full games with AI, conserving points', () => {
    let wins = 0, draws = 0, swaps = 0, calls = 0;
    for (let seed = 1; seed <= 4; seed++) {
      const g = new MahjongGame(P, ['A', 'B', 'C', 'D'], seed);
      g.on((e) => {
        if (e.type === 'jokerSwap') swaps++;
        if (e.type === 'call') calls++;
      });
      const ais = [0, 1, 2, 3].map((s) => new AiPlayer(s, (['beginner', 'casual', 'strategic', 'expert'] as const)[s], (['shark', 'wall', 'gambler', 'teacher'] as const)[s], seed * 31 + s));
      let hands = 0;
      do {
        g.startHand(seed * 1000 + hands++);
        expect(g.state.wall).toHaveLength(152);
        let steps = 0;
        while (g.state.phase.kind !== 'handOver' && steps++ < 3000) {
          const ph = g.state.phase;
          if (ph.kind === 'charleston') {
            for (let s = 0; s < 4; s++) if (g.state.phase.kind === 'charleston') g.charlestonPass(s, ais[s].charlestonPass(g).map((t) => t.id));
            g.players.forEach((p) => expect(p.hand.length).toBe(p.seat === g.dealer ? 14 : 13));
          } else if (ph.kind === 'charlestonVote') {
            for (let s = 0; s < 4; s++) if (g.state.phase.kind === 'charlestonVote') g.charlestonVote(s, ais[s].charlestonVote(g));
          } else if (ph.kind === 'turn') {
            const d = ais[ph.seat].decideTurn(g);
            if (d.action === 'win') g.declareSelfDrawWin(ph.seat);
            else if (d.action === 'swap') g.exchangeJoker(ph.seat, d.swap!);
            else g.discard(ph.seat, d.tileId!);
          } else if (ph.kind === 'claims') {
            for (const s of g.pendingClaimSeats()) {
              const cur = g.state.phase;
              if (cur.kind !== 'claims') break;
              g.respond(s, ais[s].decideClaim(g, cur.options[s], cur.tile.kind));
            }
          }
        }
        const ph = g.state.phase;
        expect(ph.kind).toBe('handOver');
        if (ph.kind === 'handOver') ph.result.type === 'win' ? wins++ : draws++;
        expect(g.players.reduce((a, p) => a + p.score, 0)).toBe(8000);
        // No joker ever sits in a pair: every exposure has 3+ tiles.
        g.players.forEach((p) => p.melds.forEach((m) => expect(m.tiles.length).toBeGreaterThanOrEqual(3)));
      } while (!g.advance() && hands < 12);
    }
    console.log({ wins, draws, swaps, calls });
    expect(wins).toBeGreaterThan(3);
    expect(JOKER_KIND).toBe(42);
  });
});
