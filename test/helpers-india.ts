import { MahjongGame } from '../src/engine/game';
import { withHouseRules } from '../src/engine/rules';
import { indiaProfile } from '../src/engine/rules/india';
import { SMALL_CARDS, cardByName, type SmallCard } from '../src/engine/rules/indiaCards';
import { parseKinds } from '../src/engine/tiles';
import { AiPlayer } from '../src/ai/players';

export const SOUTH = withHouseRules(indiaProfile, { indiaRounds: 'S' });
export const WEST = withHouseRules(indiaProfile, { indiaRounds: 'W' });
export const EAST = withHouseRules(indiaProfile, { indiaRounds: 'E' });
export const EASTPP = withHouseRules(indiaProfile, { indiaRounds: 'E', passport: 'on' });

const PERMS = [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];

/** Exact min tiles missing for a concealed 13/14 hand (no melds), independent search. */
export function exactMissing(card: SmallCard, counts: number[], seat: number, round: number): number {
  let best = 99;
  for (const p of PERMS) {
    const env = { A: p[0], B: p[1], C: p[2], seat, round };
    for (const comps of card.alts(env)) {
      const c = counts.slice(0, 34);
      const pairs: number[] = [];
      const go = (i: number, minOpt: number, miss: number) => {
        if (miss >= best) return;
        if (i === comps.length) { best = miss; return; }
        const comp = comps[i];
        const start = i > 0 && comps[i - 1].id === comp.id ? minOpt : 0;
        const sc: { o: number; m: number }[] = [];
        for (let o = start; o < comp.opts.length; o++) {
          const t = comp.opts[o].tiles;
          if (card.distinct && t.length === 2 && t[0] === t[1] && pairs.includes(t[0])) continue;
          const need = new Map<number, number>();
          for (const k of t) need.set(k, (need.get(k) ?? 0) + 1);
          let m = 0; let bad = false;
          for (const [k, n] of need) { m += Math.max(0, n - c[k]); if (n > 4) bad = true; }
          if (!bad) sc.push({ o, m });
        }
        sc.sort((a, b) => a.m - b.m);
        for (const s of sc) {
          const t = comp.opts[s.o].tiles;
          const took: number[] = [];
          for (const k of t) if (c[k] > 0) { c[k]--; took.push(k); }
          const isPair = t.length === 2 && t[0] === t[1];
          if (isPair) pairs.push(t[0]);
          go(i + 1, s.o, miss + s.m);
          if (isPair) pairs.pop();
          for (const k of took) c[k]++;
        }
      };
      go(0, 0, 0);
    }
  }
  return best;
}

/** Kinds a card could ever use. */
export function usable(card: SmallCard, seat: number, round: number): Set<number> {
  const s = new Set<number>();
  for (const p of PERMS) for (const comps of card.alts({ A: p[0], B: p[1], C: p[2], seat, round })) for (const c of comps) for (const o of c.opts) for (const k of o.tiles) s.add(k);
  return s;
}

/** Play exchanges with bots until the first turn. */
export function toTurn(g: MahjongGame) {
  const ais = [0, 1, 2, 3].map((s) => new AiPlayer(s, 'casual', 'zen', s + 1));
  for (let i = 0; i < 50 && g.state.phase.kind !== 'turn'; i++) {
    const ph = g.state.phase;
    if (ph.kind === 'charleston') { const picks = ais.map((ai) => ai.charlestonPass(g).map((t) => t.id)); picks.forEach((ids, s) => g.charlestonPass(s, ids)); }
    else if (ph.kind === 'exchangeChoice') g.chooseExchanges(ph.seat, 0, 0);
    else if (ph.kind === 'ticTacToe') { const picks = ais.map((ai) => ai.ticTacToePick(g).map((t) => t.id)); picks.forEach((ids, s) => g.ticTacToe(s, ids)); }
    else if (ph.kind === 'wallExchange') { const picks = ais.map((ai) => ai.wallExchangePick(g).map((t) => t.id)); picks.forEach((ids, s) => g.wallExchange(s, ids)); }
    else if (ph.kind === 'cardPick') ais.forEach((ai, s) => g.pickCard(s, ai.cardPick(g)));
    else if (ph.kind === 'roundChoice') g.chooseRound(ph.seat, ais[ph.seat].roundChoice(g));
    else break;
  }
  return ais;
}

export function setHand(g: MahjongGame, seat: number, hand: string | number[]) {
  const kinds = typeof hand === 'string' ? parseKinds(hand) : hand;
  const pl = g.players[seat];
  if (kinds.length !== pl.hand.length) throw new Error(`hand length ${kinds.length} vs ${pl.hand.length}`);
  pl.hand.forEach((t, i) => (t.kind = kinds[i]));
  (g as unknown as { seatShapeCache: unknown[] }).seatShapeCache = [];
}

/** A South game at seat 0's (dealer's) first turn holding `card`. */
export function southAt(card: string, hand: string | number[], seed = 11) {
  const g = new MahjongGame(SOUTH, ['A', 'B', 'C', 'D'], seed);
  g.startHand(seed);
  toTurn(g);
  const seat = g.dealer;
  g.state.cards![seat] = SMALL_CARDS.indexOf(cardByName(card)!);
  setHand(g, seat, hand);
  return { g, seat };
}
