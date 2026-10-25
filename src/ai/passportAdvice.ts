// India Rules, East round: JongBot's passport help. Which passport hands the
// player can still make (the planner), and which tiles to hold back because of
// the passports the other players are showing.

import type { MahjongGame } from '../engine/game';
import type { MeldShape } from '../engine/hand';
import type { ClaimOption } from '../engine/state';
import { passportPlans, type PassportPlan } from '../engine/rules/indiaPassport';
import { seatLabel } from './danger';

const SUIT_NAMES = ['Characters', 'Dots', 'Bamboos'];
const suitOf = (k: number) => Math.floor(k / 9);

/** Is this a passport round (the East round, or the North round played as one)? */
export const isPassportRound = (game: MahjongGame) => !!game.profile.passportView;

/** The passport hands this seat can still make, nearest first. `without` takes a tile out first
 *  (the discard JongBot is about to recommend). */
export function planPassports(game: MahjongGame, seat: number, without?: number, limit = 4): PassportPlan[] {
  const c = game.concealedCounts(seat);
  if (without !== undefined && c[without] > 0) c[without]--;
  return passportPlans(c, game.meldShapes(seat), limit);
}

/** A passport another player looks to be making, and the tiles that help it. */
export interface PassportThreat {
  seat: number;
  /** The passport, by name. */
  name: string;
  /** Kinds a discard would hand them (a pung or chow they can call, or the last tile). */
  kinds: number[];
  /** One line for JongBot. */
  line: string;
}

/** Passports the other players' exposed sets point to. Only pungs, kongs and chows can be shown before
 *  Mahjong (pairs, knits, crochets and mixed chows can't be claimed), so the reads are of those. */
export function passportThreats(game: MahjongGame, seat: number): PassportThreat[] {
  const out: PassportThreat[] = [];
  const n = game.profile.players;
  const right = (seat + 1) % n;
  for (let o = 0; o < n; o++) {
    if (o === seat) continue;
    const ms = game
      .scoringMelds(o)
      .filter((m) => !m.concealed)
      .map((m) => ({ type: m.type, kind: Math.min(...m.tiles.map((t) => t.kind)) }));
    const who = seatLabel(game, o);
    const pungs = ms.filter((m) => (m.type === 'pung' || m.type === 'kong') && m.kind < 27);
    const chows = ms.filter((m) => m.type === 'chow');
    const honours = ms.filter((m) => (m.type === 'pung' || m.type === 'kong') && m.kind >= 27);
    const suitsOf = (xs: { kind: number }[]) => [...new Set(xs.map((m) => suitOf(m.kind)))];
    const suitKinds = (s: number) => Array.from({ length: 9 }, (_, i) => s * 9 + i);
    const add = (name: string, kinds: number[], line: string) => {
      if (kinds.length) out.push({ seat: o, name, kinds, line });
    };
    // Two pungs: a third in the missing suit, or in the same suit.
    const ps = suitsOf(pungs);
    if (pungs.length >= 2 && ps.length === 2) {
      const third = [0, 1, 2].find((s) => !ps.includes(s))!;
      add('3 Pungs in 3 different suits', suitKinds(third), `${who} has pungs in ${SUIT_NAMES[ps[0]]} and ${SUIT_NAMES[ps[1]]}: likely 3 Pungs in 3 different suits. Hold back ${SUIT_NAMES[third]} they could pung.`);
    } else if (pungs.length >= 2 && ps.length === 1) {
      const used = pungs.map((m) => m.kind);
      add('3 Pungs in the same suit', suitKinds(ps[0]).filter((k) => !used.includes(k)), `${who} has two pungs in ${SUIT_NAMES[ps[0]]}: likely 3 Pungs in the same suit. Hold back ${SUIT_NAMES[ps[0]]}.`);
    }
    // Two chows: a third, in the missing suit or the same suit. Only the player on your right can
    // chow your discard, but anyone can win on it.
    const cs = suitsOf(chows);
    const feeds = o === right ? ' Your discards feed their chows.' : '';
    if (chows.length >= 2 && cs.length === 2) {
      const third = [0, 1, 2].find((s) => !cs.includes(s))!;
      add('3 Chows in 3 different suits', suitKinds(third), `${who} has chows in ${SUIT_NAMES[cs[0]]} and ${SUIT_NAMES[cs[1]]}: likely 3 Chows in 3 different suits. Hold back ${SUIT_NAMES[third]}.${feeds}`);
    } else if (chows.length >= 2 && cs.length === 1) {
      add('3 Chows in the same suit', suitKinds(cs[0]), `${who} has two chows in ${SUIT_NAMES[cs[0]]}: likely 3 Chows in the same suit. Hold back ${SUIT_NAMES[cs[0]]}.${feeds}`);
    }
    // An honour pung: Honour Pung + Honour Pair wants an honour pair.
    if (honours.length) {
      const kinds = [27, 28, 29, 30, 31, 32, 33].filter((k) => !honours.some((m) => m.kind === k));
      add('Honour Pung + Honour Pair', kinds, `${who} has an honour pung: likely Honour Pung + Honour Pair. Late in the hand, a single honour you throw can be their pair.`);
    }
  }
  return out;
}

/** Threats a discard of `kind` would feed. */
export const threatsOn = (threats: PassportThreat[], kind: number) => threats.filter((t) => t.kinds.includes(kind));

/** The likeliest passport each other player is showing, by seat (the first read for that seat). */
export function likelyPassports(game: MahjongGame, seat: number): Map<number, PassportThreat> {
  const out = new Map<number, PassportThreat>();
  for (const t of passportThreats(game, seat)) if (!out.has(t.seat)) out.set(t.seat, t);
  return out;
}

/** Every kind a discard could hand to a passport the others are showing. */
export function riskyKinds(game: MahjongGame, seat: number): Set<number> {
  return new Set(passportThreats(game, seat).flatMap((t) => t.kinds));
}

/** What a pung, kong or chow of the discard does to your passport hands. */
export interface PassportCall {
  /** Tiles from ready after the call (and its discard), against before. */
  before: number;
  after: number;
  /** The nearest passport after the call, by name, or null when none is left. */
  names: string[] | null;
  /** The called set makes a piece of that passport (not just a set beside it). */
  inPassport: boolean;
  line: string;
}

const named = (names: string[]) => names.filter((n, i) => names.indexOf(n) === i).map((n) => (names.filter((x) => x === n).length > 1 ? `${n} twice` : n)).join(' + ');
const fromReady = (n: number) => (n >= 99 ? 'no win possible with these sets' : n <= 0 ? 'ready' : n === 1 ? '1 tile from ready' : `${n} tiles from ready`);

export function passportCall(game: MahjongGame, seat: number, o: ClaimOption, discardKind: number): PassportCall | null {
  if (o.type !== 'pung' && o.type !== 'kong' && o.type !== 'chow') return null;
  const c = game.concealedCounts(seat);
  const melds = game.meldShapes(seat);
  const now = passportPlans(c, melds, 1)[0];
  const used = o.using?.length ? o.using : new Array(o.type === 'kong' ? 3 : 2).fill(discardKind);
  for (const k of used) if (c[k] > 0) c[k]--;
  const meld: MeldShape = { type: o.type, kind: o.type === 'chow' ? Math.min(discardKind, ...used) : discardKind };
  const plan = passportPlans(c, [...melds, meld], 1)[0];
  // Before the call you hold 13 tiles; after it, 14 (one to discard), so the counts compare as they are.
  const before = now ? now.missing - 1 : 99;
  const after = plan ? plan.missing - 1 : 99;
  const inPassport = !!plan && plan.meldsUsed.includes(melds.length);
  const verb = o.type === 'chow' ? 'chow' : o.type === 'kong' ? 'kong' : 'pung';
  let line: string;
  if (!plan) line = `Passport check: after this ${verb} no passport hand would be left open to you. Pass.`;
  else if (after < before)
    line = inPassport
      ? `Passport check: this ${verb} makes part of ${named(plan.names)} and leaves you ${fromReady(after)} (now ${fromReady(before)}).`
      : `Passport check: this ${verb} is a set beside ${named(plan.names)} and leaves you ${fromReady(after)} (now ${fromReady(before)}).`;
  else if (after === before) line = `Passport check: this ${verb} doesn't bring a passport closer. You stay ${fromReady(after)}, aiming for ${named(plan.names)}.`;
  else line = `Passport check: this ${verb} blocks your nearest passport. The best left would be ${named(plan.names)}, ${fromReady(after)} instead of ${fromReady(before)}.`;
  return { before, after, names: plan?.names ?? null, inPassport, line };
}
