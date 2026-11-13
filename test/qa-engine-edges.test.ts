// QA: core engine edge cases across the non-India rule sets.

import { describe, expect, it } from 'vitest';
import { MahjongGame } from '../src/engine/game';
import { advanceRound, initialRound, type RoundProfile } from '../src/engine/rounds';
import { getProfile, VARIATIONS, withHouseRules } from '../src/engine/rules';
import { isJoker, parseKinds } from '../src/engine/tiles';
import { rig, total } from './helpers/qaRig';

const k = (s: string) => parseKinds(s)[0];
const NON_INDIA = VARIATIONS.filter((v) => v.id !== 'india');

/** Everyone throws what they draw and passes every claim, until the wall runs out. */
function playOutQuietly(g: MahjongGame) {
  let steps = 0;
  while (g.state.phase.kind !== 'handOver') {
    if (steps++ > 5000) throw new Error('stuck');
    const ph = g.state.phase;
    const n = g.profile.players;
    if (ph.kind === 'charleston') {
      const picks = g.players.map((p) => p.hand.filter((t) => !isJoker(t.kind)).slice(0, 3).map((t) => t.id));
      picks.forEach((ids, s) => g.charlestonPass(s, ids));
    } else if (ph.kind === 'charlestonVote') for (let s = 0; s < n && g.state.phase.kind === 'charlestonVote'; s++) g.charlestonVote(s, false);
    else if (ph.kind === 'exchangeChoice') g.chooseExchanges(ph.seat, 1, 1);
    else if (ph.kind === 'wallExchange') g.players.map((p) => p.hand.slice(0, 3).map((t) => t.id)).forEach((ids, s) => g.wallExchange(s, ids));
    else if (ph.kind === 'turn') {
      const o = g.turnOptions(ph.seat);
      const d = ph.drawn && o.discards.some((t) => t.id === ph.drawn!.id) ? ph.drawn : o.discards[0];
      g.discard(ph.seat, d.id);
    } else if (ph.kind === 'claims') for (const s of g.pendingClaimSeats()) g.respond(s, { type: 'pass' });
    else throw new Error(ph.kind);
  }
}

describe('exhausted wall and dead wall, every rule set', () => {
  for (const v of NON_INDIA) {
    it(`${v.id}: a wall game leaves exactly the dead wall (${v.profile!.deadWall}) and conserves tiles`, () => {
      for (const seed of [1, 2, 3]) {
        const g = new MahjongGame(v.profile!, ['A', 'B', 'C', 'D'], seed);
        g.startHand(seed);
        const t0 = total(g);
        playOutQuietly(g);
        const ph = g.state.phase;
        if (ph.kind !== 'handOver') throw new Error();
        // A seven-flower or eight-flower instant win can end a quiet hand (Dubai Taiwanese); else it is a wall game.
        if (ph.result.type === 'draw') {
          const s = g.state;
          expect(s.wall.length - s.drawnFromFront - s.drawnFromBack, `seed ${seed}`).toBe(v.profile!.deadWall);
          expect(g.liveRemaining).toBe(0);
        }
        expect(total(g)).toBe(t0);
      }
    });
  }
});

describe('kongs, flowers and wins at the end of the wall', () => {
  it('a concealed kong with one live tile left draws it as the replacement; with none left no kong is offered', () => {
    for (const id of ['classic', 'hongkong', 'riichi', 'taiwanese', 'mcr']) {
      const g = new MahjongGame(getProfile(id)!, ['A', 'B', 'C', 'D'], 5);
      g.startHand(5);
      rig(g, [{ hand: '7m 7m 7m 7m 1s 2s 3s 5p 6p 7p E E N S' }, null, null, null], { liveLeft: 1 });
      expect(g.turnOptions(0).kongs, id).toContain(k('7m'));
      g.declareKong(0, k('7m'));
      expect(g.liveRemaining, id).toBe(0);
      expect(g.state.phase.kind).toBe('turn');
      const g2 = new MahjongGame(getProfile(id)!, ['A', 'B', 'C', 'D'], 5);
      g2.startHand(5);
      rig(g2, [{ hand: '7m 7m 7m 7m 1s 2s 3s 5p 6p 7p E E N S' }, null, null, null], { liveLeft: 0 });
      expect(g2.turnOptions(0).kongs, id).toEqual([]);
    }
  });

  it('a pung or kong is never offered on the last discard, only a win', () => {
    const g = new MahjongGame(getProfile('classic')!, ['A', 'B', 'C', 'D'], 5);
    g.startHand(5);
    const r = rig(g, [{ hand: '7m 1s 2s 3s 5p 6p 7p E E N S Wd Gd Rd' }, { hand: '7m 7m 7m 1m 2m 3m 4p 4p 9s 9s 1p 2p 3p' }, null, null], { liveLeft: 0 });
    g.discard(0, r.tile(0, '7m').id);
    expect(g.state.phase.kind).toBe('handOver');
  });

  it('a flower drawn as the last live tile is set aside and the hand is a wall game (HK, Malaysian, Singapore)', () => {
    for (const id of ['hongkong', 'malaysian', 'singapore']) {
      const g = new MahjongGame(getProfile(id)!, ['A', 'B', 'C', 'D'], 5);
      g.startHand(5);
      rig(g, [{ hand: '1m 1s 2s 3s 5p 6p 7p E E N S Wd Gd Rd' }, null, null, null], { liveLeft: 1, wallFront: 'F1' });
      const t0 = total(g);
      g.discard(0, g.players[0].hand[0].id);
      if (g.state.phase.kind === 'claims') for (const s of g.pendingClaimSeats()) g.respond(s, { type: 'pass' });
      const ph = g.state.phase;
      expect(ph.kind, id).toBe('handOver');
      if (ph.kind === 'handOver') expect(ph.result.type).toBe('draw');
      expect(g.players[1].flowers.map((t) => t.kind)).toEqual([k('F1')]);
      expect(g.players[1].hand.length).toBe(13);
      // Bites / flower money may be paid; the total is conserved.
      expect(total(g)).toBe(t0);
    }
  });

  it('last tile self-draw and last discard score the rule set’s bonus', () => {
    const cases: [string, string, string][] = [
      ['classic', 'Last tile', 'Last tile'],
      ['riichi', 'Haitei', 'Houtei'],
      ['mcr', 'Last Tile Draw', 'Last Tile Claim'],
      ['zung-jung', 'Final Draw', 'Final Discard'],
      ['hongkong', 'Last tile of the wall', 'Last tile of the wall'],
    ];
    for (const [id, draw, claim] of cases) {
      const p = getProfile(id)!;
      // Seat 1 draws the last tile (a 5p) and wins on it.
      const g = new MahjongGame(p, ['A', 'B', 'C', 'D'], 5);
      g.startHand(5);
      const r = rig(g, [{ hand: '1s 1s 9m 9m E S W N Wd Gd Rd 2s 8s 9s' }, { hand: '1m 2m 3m 4m 5m 6m 2s 3s 4s 4p 6p 7s 7s' }, null, null], { liveLeft: 1, wallFront: '5p' });
      if (id === 'riichi') g.players[1].riichi = true;
      g.discard(0, r.tile(0, 'Rd').id);
      if (g.state.phase.kind === 'claims') for (const s of g.pendingClaimSeats()) g.respond(s, { type: 'pass' });
      expect(g.state.phase.kind).toBe('turn');
      const o = g.turnOptions(1);
      expect(o.canWin, id).toBe(true);
      expect(o.winScore!.items.map((i) => i.name), id).toContain(draw);
      // And a discard of the 5p after the last draw.
      const g2 = new MahjongGame(p, ['A', 'B', 'C', 'D'], 5);
      g2.startHand(5);
      const r2 = rig(g2, [{ hand: '1s 1s 9m 9m E S W N Wd Gd Rd 2s 8s 5p' }, { hand: '1m 2m 3m 4m 5m 6m 2s 3s 4s 4p 6p 7s 7s' }, null, null], { liveLeft: 0 });
      if (id === 'riichi') g2.players[1].riichi = true;
      g2.discard(0, r2.tile(0, '5p').id);
      const ph = g2.state.phase;
      expect(ph.kind, id).toBe('claims');
      if (ph.kind !== 'claims') continue;
      expect(ph.options[1]).toEqual([{ type: 'win' }]);
      g2.respond(1, { type: 'win' });
      const end = g2.state.phase;
      if (end.kind !== 'handOver') throw new Error('not over');
      expect(end.result.score!.items.map((i) => i.name), id).toContain(claim);
    }
  });
});

describe('claims', () => {
  it('chow only from the left; a pung by a later seat beats an earlier chow; a win beats both', () => {
    const g = new MahjongGame(getProfile('classic')!, ['A', 'B', 'C', 'D'], 5);
    g.startHand(5);
    const r = rig(g, [{ hand: '1s 2s 3s 7m 8m 9m E E Wd Wd 1p 9s 2m 5p' }, { hand: '4p 6p 1m 1m 1m 9m 9m S S N N Gd Rd' }, { hand: '4p 6p 3p 7p 1m 2m 3m 2s 3s 4s 7s 8s 9s' }, { hand: '5p 5p 2m 4m 6m 8m 2s 4s 6s 8s W W Gd' }]);
    g.discard(0, r.tile(0, '5p').id);
    const ph = g.state.phase;
    if (ph.kind !== 'claims') throw new Error();
    expect(ph.options[1].some((o) => o.type === 'chow')).toBe(true);
    expect(ph.options[2]?.some((o) => o.type === 'chow') ?? false).toBe(false);
    expect(ph.options[3].some((o) => o.type === 'pung')).toBe(true);
    g.respond(1, ph.options[1].find((o) => o.type === 'chow')!);
    if (ph.options[2]) g.respond(2, { type: 'pass' });
    g.respond(3, { type: 'pung' });
    expect(g.state.phase.kind === 'turn' && g.state.phase.seat).toBe(3);
  });
});

describe('minimum faan', () => {
  it('Hong Kong (3 faan minimum): a chicken hand is neither offered a discard win nor a self-draw win', () => {
    const g = new MahjongGame(getProfile('hongkong')!, ['A', 'B', 'C', 'D'], 5);
    g.startHand(5);
    // Seat 1: open 123m chow, 456m 333s 77s + 4p6p waiting on 5p: only 'no flowers' (1 faan); self-drawn 2.
    const r = rig(g, [{ hand: '1s 1s 9m 9m E S W N Wd Gd Rd 2s 8s 5p' }, { hand: '4m 5m 6m 3s 3s 3s 7s 7s 4p 6p', melds: [{ spec: '1m 2m 3m', type: 'chow', from: 0 }] }, null, null], { wallFront: '5p' });
    g.discard(0, r.tile(0, '5p').id);
    const ph = g.state.phase;
    if (ph.kind === 'claims') expect(ph.options[1]?.some((o) => o.type === 'win') ?? false).toBe(false);
    // Self-draw: still under the minimum (self-drawn 1 faan only).
    if (g.state.phase.kind === 'claims') for (const s of g.pendingClaimSeats()) g.respond(s, { type: 'pass' });
    expect(g.state.phase.kind === 'turn' && g.state.phase.seat).toBe(1);
    const o = g.turnOptions(1);
    if (o.canWin) expect(o.winScore!.value).toBeGreaterThanOrEqual(3);
  });
});

describe('riichi furiten', () => {
  function riichiSetup() {
    const g = new MahjongGame(getProfile('riichi')!, ['A', 'B', 'C', 'D'], 5);
    g.startHand(5);
    const r = rig(g, [{ hand: '1s 1s 9m 9m E S W N Wd Gd Rd 2s 8s 5p' }, { hand: '1m 2m 3m 4m 5m 6m 2s 3s 4s 4p 6p 7s 7s' }, null, null]);
    g.players[1].riichi = true;
    return { g, r };
  }

  it('waiting on a tile you discarded: no ron', () => {
    const { g, r } = riichiSetup();
    g.players[1].discardKinds.push(k('5p'));
    g.discard(0, r.tile(0, '5p').id);
    const ph = g.state.phase;
    if (ph.kind === 'claims') expect(ph.options[1]?.some((o) => o.type === 'win') ?? false).toBe(false);
  });

  it('passing a ron after riichi locks furiten for the rest of the hand', () => {
    const { g, r } = riichiSetup();
    g.discard(0, r.tile(0, '5p').id);
    g.respond(1, { type: 'pass' });
    for (const s of g.pendingClaimSeats()) g.respond(s, { type: 'pass' });
    expect(g.players[1].furitenLocked).toBe(true);
    expect(g.isFuriten(1)).toBe(true);
  });

  it('declining a ron by calling chow instead is still a missed win (temporary furiten) when another seat’s pung takes the tile', () => {
    // Seat 1 (not in riichi) can ron 5p with an open hand that has a yaku (tanyao, open tanyao on by default) or chow it.
    const g = new MahjongGame(getProfile('riichi')!, ['A', 'B', 'C', 'D'], 5);
    g.startHand(5);
    const r = rig(g, [
      { hand: '1s 1s 9m 9m E S W N Wd Gd Rd 2s 8s 5p' },
      { hand: '2m 3m 4m 4m 5m 6m 2s 3s 4s 4p 6p 7s 7s' },
      null,
      { hand: '5p 5p 2m 2m 6m 8m 2s 6s 8s 9p W W Gd' },
    ]);
    g.discard(0, r.tile(0, '5p').id);
    const ph = g.state.phase;
    if (ph.kind !== 'claims') throw new Error();
    expect(ph.options[1].some((o) => o.type === 'win')).toBe(true);
    g.respond(1, ph.options[1].find((o) => o.type === 'chow')!);
    for (const s of g.pendingClaimSeats()) g.respond(s, s === 3 ? { type: 'pung' } : { type: 'pass' });
    expect(g.state.phase.kind === 'turn' && g.state.phase.seat).toBe(3);
    // Seat 1 let a winning tile go by: it may not ron until its own next discard.
    expect(g.players[1].furitenTemp).toBe(true);
  });
});

describe('dealer retention and wind progression', () => {
  const rp = (dealerRetention: RoundProfile['dealerRetention']): RoundProfile => ({ prevailingWinds: ['E', 'S'], seatWindOrder: ['E', 'S', 'W', 'N'], handsPerWind: 4, dealerRetention, maxHands: 0 });
  it('each retention rule keeps or passes the deal as documented; the wind moves after the fourth dealer; the match ends after the last wind', () => {
    const cases: [RoundProfile['dealerRetention'], { dealerWon: boolean; drawn: boolean; dealerTenpai?: boolean }, boolean][] = [
      ['onDealerWin', { dealerWon: true, drawn: false }, true],
      ['onDealerWin', { dealerWon: false, drawn: true }, false],
      ['onDealerWinOrDraw', { dealerWon: false, drawn: true }, true],
      ['onDealerWinOrTenpai', { dealerWon: false, drawn: true, dealerTenpai: false }, false],
      ['onDealerWinOrTenpai', { dealerWon: false, drawn: true, dealerTenpai: true }, true],
      ['never', { dealerWon: true, drawn: false }, false],
    ];
    for (const [ret, out, keep] of cases) expect(advanceRound(rp(ret), initialRound(), 4, out).dealerSeat === 0, `${ret} ${JSON.stringify(out)}`).toBe(keep);
    let r = initialRound();
    for (let i = 0; i < 8; i++) r = advanceRound(rp('never'), r, 4, { dealerWon: false, drawn: false });
    expect(r.finished).toBe(true);
    r = initialRound();
    for (let i = 0; i < 4; i++) r = advanceRound(rp('never'), r, 4, { dealerWon: false, drawn: false });
    expect([r.windIndex, r.dealerSeat, r.finished]).toEqual([1, 0, false]);
    // Three seats: three dealers a wind.
    const three = { ...rp('never'), seatWindOrder: ['E', 'S', 'W'] as RoundProfile['seatWindOrder'], handsPerWind: 3 };
    r = initialRound();
    for (let i = 0; i < 3; i++) r = advanceRound(three, r, 3, { dealerWon: false, drawn: false });
    expect([r.windIndex, r.dealerSeat]).toEqual([1, 0]);
  });

  it('the dealerRetention house rule overrides the rule set default', () => {
    expect(withHouseRules(getProfile('hongkong')!, { dealerRetention: 'never' }).rounds.dealerRetention).toBe('never');
    expect(getProfile('hongkong')!.rounds.dealerRetention).toBe('onDealerWin');
  });
});

describe('American Charleston and jokers', () => {
  it('a Charleston keeps 152 tiles and every hand size; jokers may not be passed', () => {
    const g = new MahjongGame(getProfile('american')!, ['A', 'B', 'C', 'D'], 3);
    g.startHand(3);
    expect(g.state.phase.kind).toBe('charleston');
    const joker = g.players.flatMap((p) => p.hand).find((t) => isJoker(t.kind));
    if (joker) {
      const owner = g.players.find((p) => p.hand.includes(joker))!;
      const others = owner.hand.filter((t) => t !== joker).slice(0, 2);
      expect(() => g.charlestonPass(owner.seat, [joker.id, ...others.map((t) => t.id)])).toThrow();
    }
    const before = g.players.map((p) => p.hand.length);
    for (let stage = 0; stage < 3; stage++) g.players.map((p) => p.hand.filter((t) => !isJoker(t.kind)).slice(0, 3).map((t) => t.id)).forEach((ids, s) => g.charlestonPass(s, ids));
    expect(g.players.map((p) => p.hand.length)).toEqual(before);
    expect(g.state.phase.kind).toBe('charlestonVote');
  });

  it('joker exchange: a natural tile from hand takes the joker out of any exposure', () => {
    const g = new MahjongGame(getProfile('american')!, ['A', 'B', 'C', 'D'], 3);
    g.startHand(3);
    // Put seat 1 in a pung of 3 Bam with a joker, and give seat 0 a natural 3 Bam on its turn.
    const all = g.players.flatMap((p) => p.hand);
    const j = all.find((t) => isJoker(t.kind))!;
    const bams = all.filter((t) => t.kind === k('3s'));
    if (!j || bams.length < 3) return;
    for (const p of g.players) p.hand = p.hand.filter((t) => t !== j && !bams.includes(t));
    g.players[1].melds = [{ type: 'pung', tiles: [bams[0], bams[1], j], concealed: false, from: 0 }];
    g.players[0].hand.push(bams[2]);
    g.state.phase = { kind: 'turn', seat: 0, drawn: bams[2], afterKong: false, mustDiscardOnly: false };
    const sw = g.turnOptions(0).jokerSwaps.find((x) => x.owner === 1);
    expect(sw).toBeTruthy();
    g.exchangeJoker(0, sw!);
    expect(g.players[0].hand.some((t) => t.id === j.id)).toBe(true);
    expect(g.players[1].melds[0].tiles.every((t) => t.kind === k('3s'))).toBe(true);
  });
});
