import { describe, expect, it } from 'vitest';
import { applyAction, decisionAction } from '../src/net/actions';
import { dangerMap, readOpponent, safeSets, tileDanger } from '../src/ai/danger';
import { unseenCounts } from '../src/ai/evaluate';
import { turnHint } from '../src/ai/jongbot';
import { AiPlayer, type Personality } from '../src/ai/players';
import { planClaim, planDiscard, riichiAdvice } from '../src/ai/strategy';
import { MahjongGame } from '../src/engine/game';
import { classicProfile } from '../src/engine/rules/classic';
import { riichiProfile } from '../src/engine/rules/riichi';
import type { RuleProfile } from '../src/engine/rules/types';
import type { Meld } from '../src/engine/state';
import { parseKinds, type Tile } from '../src/engine/tiles';

let nextId = 2000;
const tiles = (spec: string): Tile[] => parseKinds(spec).map((kind) => ({ id: nextId++, kind }));
const k = (s: string) => parseKinds(s)[0];

/** A table where seat 0 is to discard from `hand` (14 tiles), and opponents' discards are given. */
function table(hand: string, opts: { profile?: RuleProfile; discards?: Record<number, string>; riichi?: number[]; melds?: Record<number, Meld[]>; dora?: string } = {}) {
  const g = new MahjongGame(opts.profile ?? riichiProfile, ['You', 'Mei', 'Rex', 'Hiro'], 5);
  g.startHand(77);
  const h = tiles(hand);
  g.players[0].hand = h;
  g.state.log = [];
  for (const [seat, spec] of Object.entries(opts.discards ?? {})) {
    const p = g.players[Number(seat)];
    p.discards = tiles(spec);
    p.discardKinds = p.discards.map((t) => t.kind);
    p.discards.forEach((t, i) => {
      const riichi = (opts.riichi ?? []).includes(Number(seat)) && i === p.discards.length - 1;
      g.state.log.push({ type: 'discard', seat: Number(seat), tile: t, riichi });
    });
    if ((opts.riichi ?? []).includes(Number(seat))) {
      p.riichi = true;
      p.riichiDiscard = p.discards.length - 1;
    }
  }
  for (const [seat, melds] of Object.entries(opts.melds ?? {})) g.players[Number(seat)].melds = melds;
  if (opts.dora) g.state.wall[g.doraIndicatorIndex(0)] = { id: 9999, kind: k(opts.dora) };
  g.state.phase = { kind: 'turn', seat: 0, drawn: h[h.length - 1], afterKong: false, mustDiscardOnly: false };
  return g;
}

const open = (spec: string, type: Meld['type'], from = 0): Meld => ({ type, tiles: tiles(spec), concealed: false, from });

describe('danger model', () => {
  it('reads genbutsu, suji, kabe and honours against a riichi', () => {
    // East (seat 1) declared riichi after throwing 1p and 7p. Seat 0 holds two 7s and sees two more.
    const g = table('1m 5m 9m 4p 7s 7s 2s 3s 8s E E S Wd Rd', {
      discards: { 1: '1p 7p N 4p', 2: '7s 7s E 9s', 3: 'E 2m 5s' },
      riichi: [1],
    });
    const read = readOpponent(g, 1);
    expect(read.riichi).toBe(true);
    expect(read.tenpai).toBe(1);
    const safe = safeSets(g, 1);
    const unseen = unseenCounts(g, 0);
    const d = (kind: string) => tileDanger(g, k(kind), read, safe, unseen);
    expect(d('4p')).toMatchObject({ hit: 0, reason: 'genbutsu' });
    // 2s and 9s were discarded after the riichi and not won on.
    expect(d('9s')).toMatchObject({ hit: 0, reason: 'passedRiichi' });
    // 4p is also suji of 1p/7p; check a different suji tile: 4p's partner set makes 4p genbutsu,
    // so test suji with the tile 7p-1p pair for 4p's neighbours: 1p discarded -> 4p; 7p -> 4p.
    const suji = tileDanger(g, k('4p'), read, { ...safe, own: new Set([k('1p'), k('7p')]) }, unseen);
    expect(suji.reason).toBe('suji');
    // All four 7s visible: 8s can't finish a two-sided or closed wait.
    expect(d('8s').reason).toBe('kabe');
    expect(d('8s').hit).toBeLessThan(d('5m').hit);
    // Easts let go after the riichi are safe too.
    expect(d('E').hit).toBe(0);
    // A live middle tile is clearly the most dangerous.
    expect(d('5m').hit).toBeGreaterThan(0.08);
    expect(d('5m').hit).toBeGreaterThan(d('1m').hit);
  });

  it('knows an honour with every copy visible is dead', () => {
    const g = table('1m 5m 9m 4p 6p 7s 2s 3s 8s E S W Rd Wd', { discards: { 2: 'Rd Rd', 3: 'Rd 1m' } });
    const read = readOpponent(g, 1);
    const unseen = unseenCounts(g, 0);
    expect(tileDanger(g, k('Rd'), read, safeSets(g, 1), unseen)).toMatchObject({ hit: 0, reason: 'honourDead' });
    expect(tileDanger(g, k('Wd'), read, safeSets(g, 1), unseen).hit).toBeGreaterThan(0);
  });

  it('spots a flush and weighs the suit', () => {
    const g = table('1m 5m 9m 4p 6p 7s 2s 3s 8s E S W Wd Rd', {
      discards: { 2: '1m 9p 5m 2p 7m 3p' },
      melds: { 2: [open('234s', 'chow', 1), open('666s', 'pung', 1)] },
    });
    const read = readOpponent(g, 2);
    expect(read.flushSuit).toBe(2);
    const map = dangerMap(g, 0);
    expect(map.loss[k('5s')]).toBeGreaterThan(map.loss[k('5p')] * 3);
  });

  it('rates riichi above open melds above a quiet closed hand', () => {
    const g = table('1m 5m 9m 4p 6p 7s 2s 3s 8s E S W Wd Rd', {
      discards: { 1: '1m 9p N', 2: '1p 9m', 3: 'E S W' },
      riichi: [1],
      melds: { 2: [open('234s', 'chow', 1), open('678p', 'chow', 1), open('RdRdRd', 'pung', 1)] },
    });
    const [r1, r2, r3] = [1, 2, 3].map((s) => readOpponent(g, s));
    expect(r1.threat).toBeGreaterThan(r3.threat);
    expect(r2.tenpai).toBeGreaterThan(r3.tenpai);
    expect(r2.dragonPungs).toBe(1);
  });
});

describe('push or fold', () => {
  // Far from ready against a riichi: fold with the genbutsu, keeping shape.
  const far = () =>
    table('1m 4m 8m 2p 5p 9p 3s 6s 9s E S W Rd 5m', {
      discards: { 1: '1p N 9s 2s 8p W', 2: '1s 9m', 3: 'S 1m' },
      riichi: [1],
    });

  it('folds with a safe tile when far from ready', () => {
    const plan = planDiscard(far(), 0);
    expect(plan.mode).toBe('fold');
    expect(plan.ranked[0].loss).toBe(0);
  });

  it('pushes a ready hand with a good wait', () => {
    // Ready after discarding the 5s: 234m 345p 678s 22p + 67m waiting 5m/8m.
    const g = table('2m 3m 4m 3p 4p 5p 6s 7s 8s 2p 2p 6m 7m 5s', {
      discards: { 1: '1p N 9s 2s 8p W', 2: '1s 9m', 3: 'S 1m' },
      riichi: [1],
    });
    const plan = planDiscard(g, 0);
    expect(plan.ranked[0].shanten).toBe(0);
  });

  it('The Wall gives up less than The Shark against riichi over many positions', () => {
    const loss: Record<Personality, number> = { wall: 0, shark: 0, teacher: 0, gambler: 0, zen: 0 };
    let positions = 0;
    let differ = 0;
    for (let seed = 1; seed <= 12 && positions < 40; seed++) {
      const g = new MahjongGame(riichiProfile, ['A', 'B', 'C', 'D'], seed);
      const ais = [0, 1, 2, 3].map((s) => new AiPlayer(s, 'casual', 'teacher', seed * 3 + s));
      g.startHand(seed);
      while (g.state.phase.kind !== 'handOver') {
        const ph = g.state.phase;
        if (ph.kind === 'turn') {
          if (!g.players[ph.seat].riichi && g.players.some((p, s) => s !== ph.seat && p.riichi)) {
            const map = dangerMap(g, ph.seat);
            const pick = (p: Personality) => new AiPlayer(ph.seat, 'expert', p, 1).decideTurn(g);
            const w = pick('wall');
            const s = pick('shark');
            if (w.action === 'discard' && s.action === 'discard') {
              loss.wall += map.loss[w.kind!];
              loss.shark += map.loss[s.kind!];
              positions++;
              if (w.kind !== s.kind) differ++;
            }
          }
          const d = ais[ph.seat].decideTurn(g);
          if (d.action === 'abort' || d.action === 'kita') applyAction(g, decisionAction(ph.seat, d));
          else if (d.action === 'win') g.declareSelfDrawWin(ph.seat);
          else if (d.action === 'kong') g.declareKong(ph.seat, d.kind!);
          else g.discard(ph.seat, d.tileId!, { riichi: d.riichi });
        } else if (ph.kind === 'claims') {
          for (const s of g.pendingClaimSeats()) {
            const cur = g.state.phase;
            if (cur.kind !== 'claims') break;
            g.respond(s, ais[s].decideClaim(g, cur.options[s], cur.tile.kind));
          }
        }
      }
    }
    expect(positions).toBeGreaterThan(10);
    expect(differ).toBeGreaterThan(0);
    expect(loss.wall).toBeLessThan(loss.shark);
  });
});

describe('riichi and calls', () => {
  it('stays quiet with a hand already worth a mangan, declares with a cheap one', () => {
    // 234m 234p 24s 678s 55p + N: ready on the 3s with tanyao and sanshoku; the dora (5p) makes it a mangan.
    const rich = table('2m 3m 4m 2p 3p 4p 2s 4s 6s 7s 8s 5p 5p N', { dora: '4p' });
    expect(rich.turnOptions(0).riichiDiscards.length).toBeGreaterThan(0);
    const advice = riichiAdvice(rich, 0, k('N'));
    expect(advice.wait.yakuAll).toBe(true);
    expect(advice).toMatchObject({ riichi: false, reason: 'valuable' });
    const expert = new AiPlayer(0, 'expert', 'teacher', 1).decideTurn(rich);
    expect(expert).toMatchObject({ action: 'discard', kind: k('N'), riichi: false });
    expect(turnHint(rich, 0, 'learning').headline).toContain('stay quiet');

    // No yaku without declaring: riichi.
    const plain = table('1m 1m 1m 7p 8p 9p 1s 2s 3s 6s 7s 9p 9p N', { dora: 'Wd' });
    expect(riichiAdvice(plain, 0, k('N'))).toMatchObject({ riichi: true, reason: 'noYaku' });
    expect(new AiPlayer(0, 'expert', 'teacher', 1).decideTurn(plain)).toMatchObject({ kind: k('N'), riichi: true });
  });

  it("won't call into an open hand with no yaku, but pungs a dragon", () => {
    const g = table('1m 2m 9m 1p 2p 9p 1s 9s 9s S N N W 5m', {});
    g.players[0].hand = g.players[0].hand.slice(0, 13);
    g.state.phase = { kind: 'claims', discarder: 3, tile: { id: 5000, kind: k('3p') }, options: { 0: [{ type: 'chow', using: [k('1p'), k('2p')] }] }, responses: {} };
    expect(planClaim(g, 0, [{ type: 'chow', using: [k('1p'), k('2p')] }], k('3p'))).toMatchObject({ best: { type: 'pass' }, reason: 'noYaku' });
    expect(new AiPlayer(0, 'expert', 'shark', 1).decideClaim(g, [{ type: 'chow', using: [k('1p'), k('2p')] }], k('3p'))).toEqual({ type: 'pass' });
    const d = table('1m 2m 9m 1p 2p 9p 1s 9s 9s S Rd Rd W 5m', {});
    d.players[0].hand = d.players[0].hand.slice(0, 13);
    expect(new AiPlayer(0, 'expert', 'teacher', 1).decideClaim(d, [{ type: 'pung' }], k('Rd'))).toEqual({ type: 'pung' });
  });

  it('calls for speed in Classic', () => {
    const g = table('2m 3m 5p 6p 2s 3s 4s 6s 7s 8s E E 9m 9m', { profile: classicProfile });
    g.players[0].hand = g.players[0].hand.slice(0, 13);
    const plan = planClaim(g, 0, [{ type: 'chow', using: [k('5p'), k('6p')] }], k('7p'));
    expect(plan.best.type).toBe('chow');
    expect(plan.after).toBeLessThan(plan.before);
  });
});

describe('JongBot defence warnings', () => {
  it('names the riichi and explains the safe tile', () => {
    const g = table('1m 4m 8m 2p 5p 9p 3s 6s 9s E S W Rd 5m', {
      discards: { 1: '1p N 9s 2s 8p W', 2: '1s 7p', 3: 'Gd 6p' },
      riichi: [1],
    });
    const hint = turnHint(g, 0, 'learning');
    expect(hint.warning).toMatch(/^Mei \(South\) has declared Riichi\. The (West Wind|9 Bamboo) is safe against them: they discarded it\.$/);
    expect(hint.headline).toMatch(/^Discard the /);
  });
});

describe('determinism', () => {
  it('same seeds and calls give the same decisions', () => {
    const run = () => {
      const g = new MahjongGame(riichiProfile, ['A', 'B', 'C', 'D'], 3);
      const ais = (['beginner', 'casual', 'strategic', 'expert'] as const).map((d, s) => new AiPlayer(s, d, (['gambler', 'zen', 'shark', 'wall'] as const)[s], 40 + s));
      g.startHand(11);
      const out: string[] = [];
      while (g.state.phase.kind !== 'handOver') {
        const ph = g.state.phase;
        if (ph.kind === 'turn') {
          const d = ais[ph.seat].decideTurn(g);
          out.push(JSON.stringify(d));
          if (d.action === 'abort' || d.action === 'kita') applyAction(g, decisionAction(ph.seat, d));
          else if (d.action === 'win') g.declareSelfDrawWin(ph.seat);
          else if (d.action === 'kong') g.declareKong(ph.seat, d.kind!);
          else g.discard(ph.seat, d.tileId!, { riichi: d.riichi });
        } else if (ph.kind === 'claims') {
          for (const s of g.pendingClaimSeats()) {
            const cur = g.state.phase;
            if (cur.kind !== 'claims') break;
            const r = ais[s].decideClaim(g, cur.options[s], cur.tile.kind);
            out.push(JSON.stringify(r));
            g.respond(s, r);
          }
        }
      }
      return out;
    };
    const a = run();
    expect(a.length).toBeGreaterThan(20);
    expect(run()).toEqual(a);
  });
});
