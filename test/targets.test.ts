// JongBot's target-hand help beyond the passport rounds (src/ai/targets.ts, targetRoutes.ts):
// which kit each round gets, what the planner says, the call check and the reads.
import { describe, expect, it } from 'vitest';
import { MahjongGame } from '../src/engine/game';
import { americanProfile } from '../src/engine/rules/american';
import { SMALL_CARDS, cardByName } from '../src/engine/rules/indiaCards';
import { passportPlans } from '../src/engine/rules/indiaPassport';
import { JOKER_KIND, parseKinds, toCounts } from '../src/engine/tiles';
import { charlestonPick } from '../src/ai/american';
import { claimHint, turnHint } from '../src/ai/jongbot';
import { likelyTargets, riskyTargetKinds, smallCardPlans, targetKit, targetReads } from '../src/ai/targets';
import { decompose } from '../src/ai/targetBlocks';
import { fillComps } from '../src/ai/compPlan';
import { onClaim, onTurn } from './audit-helpers';
import { EAST, WEST, setHand, southAt, toTurn } from './helpers-india';
import type { Meld } from '../src/engine/state';

let nextId = 7000;
const exposed = (type: Meld['type'], spec: string): Meld => ({ type, tiles: parseKinds(spec).map((kind) => ({ id: nextId++, kind })), concealed: false, from: 1 });

function americanTurn(hand: string, seed = 3) {
  const g = new MahjongGame(americanProfile, ['A', 'B', 'C', 'D'], seed);
  g.startHand(seed);
  while (g.state.phase.kind === 'charleston') for (let s = 0; s < 4; s++) if (g.state.phase.kind === 'charleston') g.charlestonPass(s, charlestonPick(g.players[s].hand).map((t) => t.id));
  if (g.state.phase.kind === 'charlestonVote') for (let s = 0; s < 4; s++) if (g.state.phase.kind === 'charlestonVote') g.charlestonVote(s, false);
  const seat = (g.state.phase as { seat: number }).seat;
  const kinds = parseKinds(hand);
  g.players[seat].hand.forEach((t, i) => (t.kind = kinds[i]));
  return { g, seat };
}

describe('which rounds get target help', () => {
  it('picks the kit for each kind of round', () => {
    const kit = (variation: string, house?: Record<string, string>) => targetKit(onTurn({ variation, house, hand: '123m 456p 789s 11s 22p E' }))?.id ?? null;
    expect(kit('riichi')).toBe('yaku');
    expect(kit('sanma')).toBe('yaku');
    expect(kit('hongkong')).toBe('value');
    expect(kit('sichuan')).toBe('value');
    // Plain rulesets with no target: reads and the risk tint only.
    expect(kit('classic')).toBe(null);
    expect(kit('vietnamese')).toBe(null);
    expect(targetKit(americanTurn('2222m 4444m 666m 88m').g)?.id).toBe('card');
    const east = new MahjongGame(EAST, ['A', 'B', 'C', 'D'], 3);
    east.startHand(3);
    expect(targetKit(east)?.id).toBe('passport');
    const west = new MahjongGame(WEST, ['A', 'B', 'C', 'D'], 3);
    west.startHand(3);
    toTurn(west);
    expect(targetKit(west)?.id).toBe('goulash');
    expect(targetKit(southAt('Lily of the Valley', '222s 666s 88s GdGd WdWd E 1m').g)?.id).toBe('smallCard');
  });

  it('Taiwanese plans tai (no minimum, but the hand is the payout)', () => {
    const g = onTurn({ variation: 'taiwanese', hand: '111s 234s 567s 99s RdRd 12m 5p E' });
    expect(targetKit(g)?.id).toBe('value');
    const plans = targetKit(g)!.plans(g, 0);
    expect(plans.find((p) => p.key === 'dragon31')?.note).toMatch(/^1 tai/);
    expect(plans.some((p) => p.names[0] === 'Half Flush (Bamboos)' && p.note?.startsWith('4 tai'))).toBe(true);
  });
});

describe('the passport kit is the passport planner, unchanged', () => {
  it('returns passportPlans with the passport names as keys', () => {
    const g = new MahjongGame(EAST, ['A', 'B', 'C', 'D'], 21);
    g.startHand(21);
    toTurn(g);
    const me = g.dealer;
    const kit = targetKit(g)!;
    const mine = kit.plans(g, me);
    const theirs = passportPlans(g.concealedCounts(me), g.meldShapes(me), 4);
    expect(mine.map((p) => p.key)).toEqual(theirs.map((p) => p.names.join('+')));
    expect(mine.map((p) => p.missing)).toEqual(theirs.map((p) => p.missing));
    expect(kit.chip).toBe('Passport');
    expect(kit.groupOff).toBe('Set passport aside');
  });
});

describe('American card hands', () => {
  it('plans the nearest card hands with jokers filling sets, and names them with real numbers', () => {
    const { g, seat } = americanTurn('222m 4444m 66m 888m J J E');
    const plans = targetKit(g)!.plans(g, seat);
    const best = plans[0];
    expect(best.names[0]).toBe('2468: 222 4444 666 8888');
    expect(best.missing).toBe(0);
    // The two jokers make up the 6s and the 8s' kong.
    expect(best.pieces.flat().filter((k) => k === JOKER_KIND).length).toBe(2);
    expect(best.note).toBe('25 points');
  });

  it('reads the hands an opponent’s exposures fit', () => {
    const { g, seat } = americanTurn('222m 4444m 66m 888m J J E');
    const o = (seat + 1) % 4;
    g.players[o].melds = [exposed('kong', 'NNNN'), exposed('pung', 'EEE')];
    const r = likelyTargets(g, seat).get(o)!;
    expect(r.name).toMatch(/Winds & Dragons/);
    expect(r.kinds).toEqual(expect.arrayContaining(parseKinds('W')));
    expect(riskyTargetKinds(g, seat).has(parseKinds('W')[0])).toBe(true);
  });

  it('the call check says what a pung does to the card hand', () => {
    const { g, seat } = americanTurn('222m 4444m 66m 888m J E S');
    // The seat that calls holds 13: drop the South.
    g.players[seat].hand = g.players[seat].hand.filter((t) => t.kind !== parseKinds('S')[0]);
    const line = targetKit(g)!.call!(g, seat, { type: 'pung' }, parseKinds('6m')[0]);
    expect(line).toMatch(/^Card check: this pung fits 2468/);
  });
});

describe('India Small Cards', () => {
  it('plans the fill of your own card, piece by piece', () => {
    const plans = smallCardPlans(cardByName('Lily of the Valley')!, toCounts(parseKinds('222s 666s 8s GdGd WdWdWd 1m')), [], 27, 28);
    expect(plans[0].missing).toBe(2);
    expect(plans[0].need.sort()).toEqual(parseKinds('8s Gd').sort());
  });

  it('a two-suit card names its suits, and a buy gets a card check', () => {
    const { g, seat } = southAt('Gertie’s Garter', '1234567m 123456s E');
    const kit = targetKit(g)!;
    const [best] = kit.plans(g, seat);
    expect(best.note).toBe('in Characters and Bamboos');
    expect(best.missing).toBe(1);
    const line = kit.call!(g, seat, { type: 'buy' }, parseKinds('7s')[0]);
    expect(line).toMatch(/^Card check: this buy fills part of Gertie’s Garter in Characters and Bamboos/);
  });

  it('JongBot lists the ways to fill the card', () => {
    const { g, seat } = southAt('Gertie’s Garter', '1234567m 123456s E');
    const h = turnHint(g, seat, 'advanced');
    expect(h.targets?.title).toBe('Ways to fill your card');
    expect(h.targets?.plans[0].names).toEqual(['Gertie’s Garter']);
  });

  it('every Small Card fill uses each declared meld or is left out', () => {
    for (const card of SMALL_CARDS.slice(0, 20)) {
      for (const comps of card.alts({ A: 0, B: 1, C: 2, seat: 27, round: 28 })) {
        const f = fillComps(comps, toCounts(parseKinds('111m 222p 333s')), [{ type: 'pung', kind: 33 }], card);
        if (f) expect(f.fromMeld.filter(Boolean).length).toBe(1);
      }
    }
  });
});

describe('India Goulash: clean hands that reach 3 doubles', () => {
  const westAt = (hand: string) => {
    const g = new MahjongGame(WEST, ['A', 'B', 'C', 'D'], 9);
    g.startHand(9);
    toTurn(g);
    const seat = g.dealer;
    setHand(g, seat, hand);
    g.players[seat].flowers = [];
    return { g, seat };
  };

  it('a concealed one-suit hand counts Concealed Mahjong (3) on top of the clean suit (3)', () => {
    const { g, seat } = westAt('111m 333m 555m 77m 99m E');
    const clean = targetKit(g)!.plans(g, seat).find((p) => p.key === 'clean0')!;
    expect(parseInt(clean.note!)).toBeGreaterThanOrEqual(6);
    expect(clean.pieces.slice(0, 3)).toEqual([parseKinds('111m'), parseKinds('333m'), parseKinds('555m')]);
  });

  it('the call check warns that exposing gives up Concealed Mahjong', () => {
    const { g, seat } = westAt('111m 333m 55m 77m 99m E S');
    g.players[seat].hand.pop();
    const line = targetKit(g)!.call!(g, seat, { type: 'pung' }, parseKinds('5m')[0]);
    expect(line).toMatch(/^Doubles check: this pung keeps Clean Characters open/);
    expect(line).toMatch(/gives up Concealed Mahjong/);
  });
});

describe('Riichi: yaku planner and defence', () => {
  it('lists yakuhai for a dragon pair and riichi while closed', () => {
    const g = onTurn({ variation: 'riichi', hand: 'RdRd 234m 567p 78s 11m 9p N' });
    const plans = targetKit(g)!.plans(g, 0);
    const names = plans.map((p) => p.names[0]);
    expect(names).toContain('Yakuhai (Red Dragon)');
    expect(names).toContain('Riichi');
    const yh = plans.find((p) => p.key === 'yakuhai31')!;
    expect(yh.pieces[0]).toEqual(parseKinds('RdRdRd'));
    expect(yh.gaps[0]).toBe(1);
  });

  it('the call check says when a chi leaves no yaku', () => {
    // An open chi in Dots already, then a chi of 1-2-3 Bamboos: no flush, no tanyao, no pungs, no honour pair.
    const { g, options, kind } = onClaim({ variation: 'riichi', melds: [{ type: 'chow', kinds: '234p' }], hand: '19m 9p 23s 678m E N', tile: '1s' });
    const chi = options.find((o) => o.type === 'chow')!;
    const line = targetKit(g)!.call!(g, 0, chi, kind)!;
    expect(line).toMatch(/^Yaku check: after this chi your open hand would have no yaku/);
  });

  it('against a riichi, the risk tint marks the dangerous tiles in hand', () => {
    const g = onTurn({ variation: 'riichi', hand: '234m 567p 345s 11m 9p 5s 6s' });
    const o = 2;
    g.players[o].riichi = true;
    g.players[o].discardKinds.push(...parseKinds('1m 9m 1p'));
    const risky = riskyTargetKinds(g, 0);
    expect(risky.has(parseKinds('5s')[0]) || risky.has(parseKinds('6s')[0])).toBe(true);
    expect(likelyTargets(g, 0).get(o)?.name).toBe('Riichi');
  });
});

describe('Hong Kong scoring routes', () => {
  it('values routes from the faan table and puts one-faan routes behind the 3-faan ones', () => {
    const g = onTurn({ variation: 'hongkong', hand: '123p 456p 78p 99p EE GdGd' });
    const plans = targetKit(g)!.plans(g, 0);
    expect(plans[0].names[0]).toBe('Half Flush (Dots)');
    expect(plans[0].note).toBe('3 faan');
    const gd = plans.find((p) => p.key === 'dragon32');
    if (gd) expect(gd.note).toMatch(/needs 3 with other scoring/);
  });
});

describe('reads on plain rulesets', () => {
  it('names a flush from exposures in one suit and tints that suit', () => {
    const g = onTurn({ variation: 'classic', hand: '123m 456p 789s 11s 22p E' });
    const o = 1;
    g.players[o].melds = [exposed('chow', '123s'), exposed('pung', '777s')];
    g.players[o].discardKinds.push(...parseKinds('1m 2p 9m E 5p'));
    const r = targetReads(g, 0).find((x) => x.seat === o)!;
    expect(r.name).toBe('Bamboos flush');
    expect(riskyTargetKinds(g, 0).has(parseKinds('5s')[0])).toBe(true);
  });
});

describe('blocks for routes', () => {
  it('finds sets, the pair and partial sets', () => {
    const b = decompose(toCounts(parseKinds('123m 456m 77m 13p')), 4, true, true);
    expect(b.pieces).toEqual([parseKinds('123m'), parseKinds('456m'), parseKinds('77m'), parseKinds('1p 3p 2p')]);
    expect(b.gaps).toEqual([0, 0, 0, 1]);
    expect(b.need).toEqual(parseKinds('2p'));
  });
});

describe('JongBot uses the kit in every hint', () => {
  it('a Riichi turn hint lists yaku, and a claim hint carries the yaku check', () => {
    const g = onTurn({ variation: 'riichi', hand: 'RdRd 234m 567p 78s 11m 9p N' });
    expect(turnHint(g, 0, 'advanced').targets?.title).toBe('Yaku you can make');
    const { g: g2, options, kind } = onClaim({ variation: 'riichi', hand: 'RdRd 234m 567p 78s 11m 9p', tile: 'Rd' });
    expect(claimHint(g2, 0, options, kind, 'advanced').callCheck).toMatch(/^Yaku check/);
  });
});
