// India Rules, East round: JongBot's passport help. Which passport hands the
// player can still make (the planner), and which tiles to hold back because of
// the passports the other players are showing.

import type { MahjongGame } from '../engine/game';
import type { MeldShape } from '../engine/hand';
import type { ClaimOption } from '../engine/state';
import { passportPlans, type PassportPlan } from '../engine/rules/indiaPassport';
import { seatLabel } from './danger';
import { tr } from '../i18n';
import { callWord, fromReady, namesText, sentences, suitName } from './adviceText';

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
    // A partner (team play) is never a risk: their passport is your own win.
    if (o === seat || game.sameTeam(seat, o)) continue;
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
      const passport = '3 Pungs in 3 different suits';
      add(passport, suitKinds(third), tr('{who} has pungs in {a} and {b}: likely {passport}. Hold back {c} they could pung.', { who, a: suitName(ps[0]), b: suitName(ps[1]), c: suitName(third), passport: tr(passport) }));
    } else if (pungs.length >= 2 && ps.length === 1) {
      const used = pungs.map((m) => m.kind);
      const passport = '3 Pungs in the same suit';
      add(passport, suitKinds(ps[0]).filter((k) => !used.includes(k)), tr('{who} has two pungs in {a}: likely {passport}. Hold back {a}.', { who, a: suitName(ps[0]), passport: tr(passport) }));
    }
    // Two chows: a third, in the missing suit or the same suit. Only the player on your right can
    // chow your discard, but anyone can win on it.
    const cs = suitsOf(chows);
    const feeds = o === right ? tr('Your discards feed their chows.') : '';
    if (chows.length >= 2 && cs.length === 2) {
      const third = [0, 1, 2].find((s) => !cs.includes(s))!;
      const passport = '3 Chows in 3 different suits';
      add(passport, suitKinds(third), sentences(tr('{who} has chows in {a} and {b}: likely {passport}. Hold back {c}.', { who, a: suitName(cs[0]), b: suitName(cs[1]), c: suitName(third), passport: tr(passport) }), feeds));
    } else if (chows.length >= 2 && cs.length === 1) {
      const passport = '3 Chows in the same suit';
      add(passport, suitKinds(cs[0]), sentences(tr('{who} has two chows in {a}: likely {passport}. Hold back {a}.', { who, a: suitName(cs[0]), passport: tr(passport) }), feeds));
    }
    // An honour pung: Honour Pung + Honour Pair wants an honour pair.
    if (honours.length) {
      const kinds = [27, 28, 29, 30, 31, 32, 33].filter((k) => !honours.some((m) => m.kind === k));
      const passport = 'Honour Pung + Honour Pair';
      add(passport, kinds, tr('{who} has an honour pung: likely {passport}. Late in the hand, a single honour you throw can be their pair.', { who, passport: tr(passport) }));
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
  const call = callWord(o.type === 'chow' ? 'chow' : o.type === 'kong' ? 'kong' : 'pung');
  const p = { call, passport: plan ? namesText(plan.names) : '', after: fromReady(after), before: fromReady(before) };
  let line: string;
  if (!plan) line = tr('Passport check: after this {call} no passport hand would be left open to you. Pass.', p);
  else if (after < before)
    line = inPassport
      ? tr('Passport check: this {call} makes part of {passport} and leaves you {after} (now {before}).', p)
      : tr('Passport check: this {call} is a set beside {passport} and leaves you {after} (now {before}).', p);
  else if (after === before) line = tr("Passport check: this {call} doesn't bring a passport closer. You stay {after}, aiming for {passport}.", p);
  else line = tr('Passport check: this {call} blocks your nearest passport. The best left would be {passport}, {after} instead of {before}.', p);
  return { before, after, names: plan?.names ?? null, inPassport, line };
}

/** "3 Knits in the same 2 suits twice": a plan's names as one translated phrase. */
const namesPhrase = (names: string[]) => names.filter((n, i) => names.indexOf(n) === i).map((n) => (names.filter((x) => x === n).length > 1 ? tr('{name} twice', { name: tr(n) }) : tr(n))).join(' + ');

/**
 * The practice table (hands open): the passport each other player is nearest to, read from their
 * actual tiles, for the plate under their name. 13 tiles with `missing` to go are missing - 1 from ready.
 */
export function aimingReads(game: MahjongGame, seat: number): Map<number, { name: string; line: string; tag: string }> {
  const out = new Map<number, { name: string; line: string; tag: string }>();
  for (let o = 0; o < game.profile.players; o++) {
    if (o === seat) continue;
    const plan = planPassports(game, o, undefined, 1)[0];
    if (!plan) continue;
    const held = game.players[o].hand.length;
    // 14 tiles (their turn, before the discard) count one tile further than 13.
    const n = Math.max(0, plan.missing - (held >= 14 ? 2 : 1));
    const state = n <= 0 ? tr('ready') : n === 1 ? tr('1 from ready') : tr('{n} from ready', { n });
    const name = namesPhrase(plan.names);
    out.set(o, { name, tag: tr('Aiming for'), line: tr('{name} is {state}: {passport}', { name: seatLabel(game, o), state, passport: name }) });
  }
  return out;
}
