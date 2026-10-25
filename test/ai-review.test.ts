import { describe, expect, it } from 'vitest';
import { applyAction, decisionAction } from '../src/net/actions';
import { AiPlayer } from '../src/ai/players';
import { foldPraiseSafety, reviewClaim, reviewDiscard, type DecisionReview } from '../src/ai/review';
import { MahjongGame } from '../src/engine/game';
import { VARIATIONS } from '../src/engine/rules';
import { americanProfile } from '../src/engine/rules/american';
import { riichiProfile } from '../src/engine/rules/riichi';
import type { RuleProfile } from '../src/engine/rules/types';
import { JOKER_KIND, parseKinds, type Tile } from '../src/engine/tiles';

let nextId = 4000;
const tiles = (spec: string): Tile[] => parseKinds(spec).map((kind) => ({ id: nextId++, kind }));
const k = (s: string) => parseKinds(s)[0];

function table(hand: string, opts: { profile?: RuleProfile; discards?: Record<number, string>; riichi?: number[] } = {}) {
  const g = new MahjongGame(opts.profile ?? riichiProfile, ['You', 'Mei', 'Rex', 'Hiro'], 5);
  g.startHand(77);
  const h = tiles(hand);
  g.players[0].hand = h;
  g.state.log = [];
  for (const [seat, spec] of Object.entries(opts.discards ?? {})) {
    const p = g.players[Number(seat)];
    p.discards = tiles(spec);
    p.discardKinds = p.discards.map((t) => t.kind);
    const riichi = (opts.riichi ?? []).includes(Number(seat));
    p.discards.forEach((t, i) => g.state.log.push({ type: 'discard', seat: Number(seat), tile: t, riichi: riichi && i === p.discards.length - 1 }));
    p.riichi = riichi;
  }
  g.state.phase = { kind: 'turn', seat: 0, drawn: h[h.length - 1], afterKong: false, mustDiscardOnly: false };
  return g;
}
const idOf = (g: MahjongGame, kind: string) => g.players[0].hand.find((t) => t.kind === k(kind))!.id;

const plain = (r: DecisionReview) => {
  expect(r.explanation.length).toBeGreaterThan(10);
  expect(r.explanation).not.toMatch(/shanten|ukeire|→|->|genbutsu|suji|kabe|tenpai/i);
  expect(r.weight).toBeGreaterThanOrEqual(0);
  expect(r.weight).toBeLessThanOrEqual(1);
};

describe('reviewDiscard', () => {
  it('agrees with a good discard and does not touch the game', () => {
    const g = table('2m 3m 4m 3p 4p 5p 6s 7s 8s 2p 2p 6m 7m N');
    const before = JSON.stringify(g.state);
    const r = reviewDiscard(g, 0, idOf(g, 'N'));
    expect(JSON.stringify(g.state)).toBe(before);
    expect(r).toMatchObject({ verdict: 'best', bestKind: k('N'), chosenKind: k('N') });
    expect(r.explanation).toContain('ready');
    plain(r);
  });

  it('flags breaking a ready hand', () => {
    const g = table('2m 3m 4m 3p 4p 5p 6s 7s 8s 2p 2p 6m 7m N');
    const r = reviewDiscard(g, 0, idOf(g, '3p'));
    expect(['mistake', 'blunder']).toContain(r.verdict);
    expect(r.bestKind).toBe(k('N'));
    expect(r.chosenKind).toBe(k('3p'));
    expect(r.explanation).toMatch(/North Wind/);
    expect(r.explanation).toMatch(/ready/);
    expect(r.weight).toBeGreaterThan(0.5);
    plain(r);
  });

  it('calls out a dangerous discard against riichi and names the safe tile', () => {
    const g = table('1m 4m 8m 2p 5p 9p 3s 6s 9s E S W Rd 5m', { discards: { 1: '1p N 9s 2s 8p W', 2: '1s 7p', 3: 'Gd 6p' }, riichi: [1] });
    const r = reviewDiscard(g, 0, idOf(g, '5p'));
    expect(['inaccuracy', 'mistake', 'blunder']).toContain(r.verdict);
    expect(r.explanation).toContain('had declared Riichi');
    expect(r.explanation).toContain('5 Dot was risky');
    expect(r.explanation).toMatch(/was safe against them: they discarded it\./);
    plain(r);
    const good = reviewDiscard(g, 0, idOf(g, 'W'));
    expect(good.verdict).toBe('best');
    plain(good);
  });

  it('reviews American discards by distance to the card, and frowns on throwing a joker', () => {
    const g = new MahjongGame(americanProfile, ['You', 'Mei', 'Rex', 'Hiro'], 3);
    g.startHand(9);
    g.players[0].hand = [...tiles('2m 2m 2m 4m 4m 4m 6m 6m 6m 8m 8m E N'), { id: 7000, kind: JOKER_KIND }];
    g.state.phase = { kind: 'turn', seat: 0, drawn: g.players[0].hand[13], afterKong: false, mustDiscardOnly: false };
    const joker = reviewDiscard(g, 0, 7000);
    expect(joker.verdict).toBe('blunder');
    plain(joker);
    const wind = reviewDiscard(g, 0, idOf(g, 'E'));
    expect(['best', 'good']).toContain(wind.verdict);
    plain(wind);
    const bad = reviewDiscard(g, 0, idOf(g, '4m'));
    expect(['inaccuracy', 'mistake', 'blunder']).toContain(bad.verdict);
    plain(bad);
  });
});

describe('fold praise wording', () => {
  it('a best-move fold tile without a safety reason is worded as the best balance, not as a warning', () => {
    const kind = k('3m');
    const plainTile = foldPraiseSafety(kind, { hit: 0.05, reason: 'none', via: [] });
    expect(plainTile).toBe("The 3 Character wasn't a sure safe tile, but it was the best balance of speed and safety.");
    expect(plainTile).not.toMatch(/not a sure safe tile|risky/);
    // Real safety reasons are still explained.
    expect(foldPraiseSafety(kind, { hit: 0, reason: 'passed', via: [] })).toMatch(/safe against them/);
  });
});

describe('reviewClaim', () => {
  const claimTable = (hand: string, tile: string) => {
    const g = table(hand + ' 1s');
    g.players[0].hand = g.players[0].hand.slice(0, 13);
    g.state.phase = { kind: 'claims', discarder: 3, tile: { id: 6000, kind: k(tile) }, options: {}, responses: {} };
    return g;
  };

  it('passing a win is a blunder', () => {
    const g = claimTable('2m 3m 4m 3p 4p 5p 6s 7s 8s 2p 2p 6m 7m', '5m');
    const r = reviewClaim(g, 0, { type: 'pass' }, [{ type: 'win' }], k('5m'));
    expect(r.verdict).toBe('blunder');
    expect(r.bestKind).toBeNull();
    plain(r);
    expect(reviewClaim(g, 0, { type: 'win' }, [{ type: 'win' }], k('5m')).verdict).toBe('best');
  });

  it('calling into a yakuless open hand is a blunder; passing is best', () => {
    const g = claimTable('1m 2m 9m 1p 2p 9p 1s 9s 9s S N N W', '3p');
    const opts = [{ type: 'chow' as const, using: [k('1p'), k('2p')] }];
    const before = JSON.stringify(g.state);
    const bad = reviewClaim(g, 0, opts[0], opts, k('3p'));
    expect(JSON.stringify(g.state)).toBe(before);
    expect(bad.verdict).toBe('blunder');
    expect(bad.explanation).toContain('no yaku');
    plain(bad);
    expect(reviewClaim(g, 0, { type: 'pass' }, opts, k('3p')).verdict).toBe('best');
  });

  it('passing a dragon pung that speeds the hand up is marked down', () => {
    const g = claimTable('2m 3m 4m 3p 4p 6s 7s 9s 9s Rd Rd 1p 5m', 'Rd');
    const r = reviewClaim(g, 0, { type: 'pass' }, [{ type: 'pung' }], k('Rd'));
    expect(['inaccuracy', 'mistake']).toContain(r.verdict);
    plain(r);
  });
});

describe('review across every variation', () => {
  it('reviews every decision of AI games without changing the game', () => {
    for (const v of VARIATIONS) {
      const profile = v.profile!;
      const g = new MahjongGame(profile, ['A', 'B', 'C', 'D'], 21);
      const ais = [0, 1, 2, 3].map((s) => new AiPlayer(s, s % 2 ? 'casual' : 'expert', 'teacher', 5 + s));
      g.startHand(31);
      let reviews = 0;
      let steps = 0;
      while (g.state.phase.kind !== 'handOver' && steps++ < 400) {
        const ph = g.state.phase;
        if (ph.kind === 'charleston') {
          for (let s = 0; s < 4; s++) if (g.state.phase.kind === 'charleston') g.charlestonPass(s, ais[s].charlestonPass(g).map((t) => t.id));
        } else if (ph.kind === 'charlestonVote') {
          for (let s = 0; s < 4; s++) if (g.state.phase.kind === 'charlestonVote') g.charlestonVote(s, false);
        } else if (ph.kind === 'turn') {
          const d = ais[ph.seat].decideTurn(g);
          if (d.action === 'discard') {
            const snap = JSON.stringify(g.state);
            const r = reviewDiscard(g, ph.seat, d.tileId!);
            expect(JSON.stringify(g.state)).toBe(snap);
            plain(r);
            // Praise never carries a caveat that reads like a criticism.
            if (r.verdict === 'best' || r.verdict === 'good') expect(r.explanation).not.toMatch(/not a sure safe tile|risky against them/);
            reviews++;
          }
          if (d.action === 'abort' || d.action === 'kita') applyAction(g, decisionAction(ph.seat, d));
          else if (d.action === 'win') g.declareSelfDrawWin(ph.seat);
          else if (d.action === 'kong') g.declareKong(ph.seat, d.kind!);
          else if (d.action === 'swap') g.exchangeJoker(ph.seat, d.swap!);
          else g.discard(ph.seat, d.tileId!, { riichi: d.riichi });
        } else if (ph.kind === 'claims') {
          for (const s of g.pendingClaimSeats()) {
            const cur = g.state.phase;
            if (cur.kind !== 'claims') break;
            const resp = ais[s].decideClaim(g, cur.options[s], cur.tile.kind);
            const snap = JSON.stringify(g.state);
            const r = reviewClaim(g, s, resp, cur.options[s], cur.tile.kind);
            expect(JSON.stringify(g.state)).toBe(snap);
            plain(r);
            g.respond(s, resp);
          }
        }
      }
      expect(reviews, v.id).toBeGreaterThan(5);
    }
  }, 30_000);
});
