// Target hands that are routes rather than fixed tiles: which tiles a hand keeps
// and how its sets are made. Three families use them (targets.ts):
//   goulash  India Rules West / North Goulash: a clean hand of pungs and a pair
//            that reaches the 3 doubles a win needs (indiaWest.ts)
//   yaku     Riichi family: the yaku a hand can still make
//   value    minimum-score rulesets: the scoring hands that reach the minimum

import type { MahjongGame } from '../engine/game';
import type { MeldShape } from '../engine/hand';
import { setsShanten, sevenPairsShanten } from '../engine/hand';
import type { ClaimOption } from '../engine/state';
import { FLOWER_BASE, WINDS, isDragon, isFlower, isHonor, isTerminal, isTerminalOrHonor, tileName, windKind } from '../engine/tiles';
import { decompose } from './targetBlocks';
import { handWilds, unseenCounts } from './evaluate';
import type { TargetPlan } from './targets';

const SUIT_NAMES = ['Characters', 'Dots', 'Bamboos'];
const inSuit = (s: number) => (k: number) => k < 27 && Math.floor(k / 9) === s;
const meldKinds = (m: MeldShape) => (m.type === 'chow' ? [m.kind, m.kind + 1, m.kind + 2] : [m.kind]);
const fromReady = (n: number) => (n >= 99 ? 'no win possible with these sets' : n <= 0 ? 'ready' : n === 1 ? '1 tile from ready' : `${n} tiles from ready`);

/** One route: the kinds it may hold, whether runs count, and a set it must have. */
interface Route {
  key: string;
  name: string;
  /** Kinds the hand may hold (all its tiles, melds included). */
  allowed: (k: number) => boolean;
  chows: boolean;
  /** A pung (or kong) of this kind is part of the route. */
  pung?: number;
  /** Seven pairs instead of sets. */
  pairs?: boolean;
  /** Only a concealed hand (riichi, seven pairs). */
  closed?: boolean;
  /** What it scores, for the note. */
  value?: number;
  unit?: string;
  /** Extra words after the value ("closed, declare when ready"). */
  extra?: string;
}

interface Hand {
  counts: number[];
  melds: MeldShape[];
  concealed: boolean;
  sets: number;
}

/** Distance to one route, with its pieces; null when the melds rule it out. */
function routePlan(r: Route, h: Hand): TargetPlan | null {
  if (r.closed && !h.concealed) return null;
  if (r.pairs && h.melds.length) return null;
  for (const m of h.melds) {
    if (!r.chows && m.type === 'chow') return null;
    if (!meldKinds(m).every(r.allowed)) return null;
  }
  const c = h.counts.slice(0, 34).map((n, k) => (r.allowed(k) ? n : 0));
  const fromMeld = h.melds.map(() => true);
  const meldPieces = h.melds.map((m) => (m.type === 'chow' ? meldKinds(m) : new Array(m.type === 'kong' ? 4 : 3).fill(m.kind)));
  let pieces: number[][] = [];
  let gaps: number[] = [];
  let need: number[] = [];
  let missing: number;
  if (r.pairs) {
    missing = sevenPairsShanten(c) + 1;
    const pairs = c.flatMap((n, k) => (n >= 2 ? [k] : [])).slice(0, 7);
    const singles = c.flatMap((n, k) => (n === 1 ? [k] : [])).slice(0, 7 - pairs.length);
    pieces = [...pairs.map((k) => [k, k]), ...singles.map((k) => [k, k])];
    gaps = [...pairs.map(() => 0), ...singles.map(() => 1)];
    need = singles;
  } else if (r.pung !== undefined && !h.melds.some((m) => m.type !== 'chow' && m.kind === r.pung)) {
    const k = r.pung;
    const held = Math.min(3, c[k]);
    const rest = c.slice();
    rest[k] -= held;
    missing = setsShanten(rest, h.melds.length + 1, h.sets, true, r.chows) + 1 + (3 - held);
    const b = decompose(rest, h.sets - h.melds.length - 1, true, r.chows);
    pieces = [[...new Array(held).fill(k), ...new Array(3 - held).fill(k)], ...b.pieces];
    gaps = [3 - held, ...b.gaps];
    need = [...new Array(3 - held).fill(k), ...b.need];
  } else {
    missing = setsShanten(c, h.melds.length, h.sets, true, r.chows) + 1;
    const b = decompose(c, h.sets - h.melds.length, true, r.chows);
    pieces = b.pieces;
    gaps = b.gaps;
    need = b.need;
  }
  if (missing >= 90) return null;
  const note = r.value !== undefined ? `${r.value} ${r.unit ?? 'faan'}${r.extra ? `, ${r.extra}` : ''}` : r.extra;
  return {
    key: r.key,
    names: [r.name],
    note,
    missing,
    pieces: [...meldPieces, ...pieces],
    gaps: [...meldPieces.map(() => 0), ...gaps],
    fromMeld: [...fromMeld, ...pieces.map(() => false)],
    need,
  };
}

const handOf = (g: MahjongGame, s: number, without?: number, sets = g.profile.shapes.sets ?? 4): Hand => {
  const counts = g.concealedCounts(s);
  if (without !== undefined && counts[without] > 0) counts[without]--;
  return { counts, melds: g.meldShapes(s), concealed: g.isConcealed(s), sets };
};

/** Nearest first; ties go to the route worth more. Routes far behind the best are left out. */
type Ranked = TargetPlan & { worth?: number; penalty?: number };
function rank(plans: Ranked[], limit: number, slack = 3): TargetPlan[] {
  const at = (p: Ranked) => p.missing + (p.penalty ?? 0);
  plans.sort((a, b) => at(a) - at(b) || (b.worth ?? 0) - (a.worth ?? 0));
  const best = plans[0] ? at(plans[0]) : 99;
  return plans.filter((p) => at(p) <= best + slack).slice(0, limit).map(({ worth: _w, penalty: _p, ...p }) => p);
}

/** What a call does to the routes: plans before and after a hypothetical meld. */
function callLine(label: string, verb: string, before: TargetPlan | undefined, after: TargetPlan | undefined, none: string): string {
  const b = before ? before.missing - 1 : 99;
  const a = after ? after.missing - 1 : 99;
  if (!after) return `${label}: ${none}`;
  const name = after.names.join(' + ');
  if (a < b) return `${label}: this ${verb} keeps ${name} open and leaves you ${fromReady(a)} (now ${fromReady(b)}).`;
  if (a === b) return `${label}: this ${verb} doesn't bring you closer. You stay ${fromReady(a)}, aiming for ${name}.`;
  return `${label}: this ${verb} sets you back. The best left would be ${name}, ${fromReady(a)} instead of ${fromReady(b)}.`;
}

/** The hand after calling `kind` with `o` (concealed tiles out, a meld in), or null. */
function afterCall(g: MahjongGame, s: number, o: ClaimOption, kind: number): Hand | null {
  if (o.type !== 'pung' && o.type !== 'kong' && o.type !== 'chow') return null;
  const h = handOf(g, s);
  const used = o.using?.length ? o.using : new Array(o.type === 'kong' ? 3 : 2).fill(kind);
  for (const k of used) if (h.counts[k] > 0) h.counts[k]--;
  h.melds = [...h.melds, { type: o.type, kind: o.type === 'chow' ? Math.min(kind, ...used) : kind }];
  h.concealed = false;
  return h;
}

// ------------------------------------------------------------------ India Goulash

export const isIndiaGoulash = (g: MahjongGame) => g.profile.specialRound === 'indiaWest';

/** Doubles a clean hand's route can count on before Mahjong: what the clean kind earns, value pungs
 *  in its pieces, own and round flowers, and Concealed Mahjong (3) while nothing is exposed. */
function goulashDoubles(g: MahjongGame, s: number, base: number, plan: TargetPlan, concealed: boolean): number {
  const seat = g.state.seatWinds[s];
  const own = windKind(seat);
  const round = windKind(g.prevailing);
  let d = base + (concealed ? 3 : 0);
  const pungs = plan.pieces.filter((p) => p.length >= 3 && p[0] === p[2]).map((p) => p[0]);
  for (const k of pungs) {
    if (isDragon(k)) d++;
    if (k === own) d++;
    if (k === round) d++;
  }
  for (let st = 0; st < 3; st++) if (pungs.includes(st * 9) && pungs.includes(st * 9 + 8)) d++;
  const o = WINDS.indexOf(seat);
  const r = WINDS.indexOf(g.prevailing);
  for (const f of g.players[s].flowers) if (isFlower(f.kind)) d += (((f.kind - FLOWER_BASE) % 4 === o) ? 1 : 0) + (((f.kind - FLOWER_BASE) % 4 === r) ? 1 : 0);
  return d;
}

function goulashRoutes(): (Route & { base: number })[] {
  const out: (Route & { base: number })[] = [];
  for (let s = 0; s < 3; s++) {
    out.push({ key: `clean${s}`, name: `Clean ${SUIT_NAMES[s]}`, allowed: inSuit(s), chows: false, base: 3 });
    out.push({ key: `honours${s}`, name: `${SUIT_NAMES[s]} with honours`, allowed: (k) => inSuit(s)(k) || isHonor(k), chows: false, base: 0 });
  }
  out.push({ key: 'honours', name: 'All honours', allowed: isHonor, chows: false, base: 3 });
  out.push({ key: 'terminals', name: '1s and 9s', allowed: isTerminal, chows: false, base: 3 });
  return out;
}

function goulashFor(g: MahjongGame, s: number, h: Hand, limit: number): TargetPlan[] {
  const unseen = unseenCounts(g, s);
  const jokers = handWilds(g, s).length;
  const plans: Ranked[] = [];
  for (const r of goulashRoutes()) {
    const p = routePlan(r, h);
    if (!p) continue;
    // A pung or pair that needs tiles no longer out there is a long way off.
    let penalty = p.need.some((k) => p.need.filter((x) => x === k).length > unseen[k]) ? 2 : 0;
    // One suit with honours counts only with an honour pung in it.
    if (r.base === 0 && !p.pieces.some((x) => x.length >= 3 && isHonor(x[0]))) continue;
    p.missing = Math.max(0, p.missing - jokers);
    const d = goulashDoubles(g, s, r.base, p, h.concealed);
    p.note = d >= 3 ? `${Math.min(d, 10)} doubles` : `${d} of 3 doubles`;
    p.how = h.concealed && r.base < 3 ? 'Concealed Mahjong adds 3 doubles while nothing is exposed.' : undefined;
    // Short of the 3 doubles: behind every route that has them.
    if (d < 3) penalty += 2;
    plans.push({ ...p, worth: d, penalty });
  }
  return rank(plans, limit);
}

export const goulashPlans = (g: MahjongGame, s: number, without?: number, limit = 4) => goulashFor(g, s, handOf(g, s, without, 4), limit);

export function goulashCall(g: MahjongGame, s: number, o: ClaimOption, kind: number): string | null {
  const h = afterCall(g, s, o, kind);
  if (!h) return null;
  const before = goulashFor(g, s, handOf(g, s, undefined, 4), 1)[0];
  const after = goulashFor(g, s, h, 1)[0];
  const lost = g.isConcealed(s) ? ' Exposing a pung gives up Concealed Mahjong (3 doubles).' : '';
  const line = callLine('Doubles check', o.type, before, after && !after.note?.includes('of 3') ? after : undefined, `after this ${o.type} no clean hand would reach 3 doubles. Pass.`);
  return line + (after && !after.note?.includes('of 3') ? ` ${after.names[0]} counts ${after.note}.` : '') + lost;
}

// ------------------------------------------------------------------ Riichi yaku

function yakuRoutes(g: MahjongGame, s: number, h: Hand): Route[] {
  const seat = windKind(g.state.seatWinds[s]);
  const round = windKind(g.prevailing);
  const simple = (k: number) => k < 27 && !isTerminalOrHonor(k);
  const kuitan = g.profile.houseChoices?.openTanyao !== 'off';
  const out: Route[] = [
    { key: 'riichi', name: g.profile.callNames.riichi ?? 'Riichi', allowed: () => true, chows: true, closed: true, value: 1, unit: 'han', extra: 'closed, declare when ready' },
    { key: 'tanyao', name: 'Tanyao (all simples)', allowed: simple, chows: true, closed: !kuitan, value: 1, unit: 'han' },
    { key: 'toitoi', name: 'Toitoi (all pungs)', allowed: () => true, chows: false, value: 2, unit: 'han' },
    { key: 'chiitoi', name: 'Chiitoitsu (seven pairs)', allowed: () => true, chows: true, pairs: true, closed: true, value: 2, unit: 'han' },
  ];
  // Value honours held as a pair or more, or already called.
  for (const k of [31, 32, 33, seat, round].filter((x, i, a) => a.indexOf(x) === i)) {
    if (h.counts[k] < 2 && !h.melds.some((m) => m.type !== 'chow' && m.kind === k)) continue;
    const both = k === seat && k === round;
    out.push({ key: `yakuhai${k}`, name: `Yakuhai (${tileName(k)})`, allowed: () => true, chows: true, pung: k, value: both ? 2 : 1, unit: 'han' });
  }
  for (let st = 0; st < 3; st++) {
    out.push({ key: `honitsu${st}`, name: `Honitsu (${SUIT_NAMES[st]})`, allowed: (k) => inSuit(st)(k) || isHonor(k), chows: true, value: h.concealed ? 3 : 2, unit: 'han' });
    out.push({ key: `chinitsu${st}`, name: `Chinitsu (${SUIT_NAMES[st]})`, allowed: inSuit(st), chows: true, value: h.concealed ? 6 : 5, unit: 'han' });
  }
  return out;
}

function yakuFor(g: MahjongGame, s: number, h: Hand, limit: number): TargetPlan[] {
  const plans: Ranked[] = [];
  const seen = new Set<string>();
  for (const r of yakuRoutes(g, s, h)) {
    const p = routePlan(r, h);
    if (!p) continue;
    // One flush per kind: the suit nearest wins.
    const fam = r.key.replace(/\d+$/, '');
    if ((fam === 'honitsu' || fam === 'chinitsu') && seen.has(fam)) {
      const prev = plans.find((x) => x.key.startsWith(fam))!;
      if (p.missing >= prev.missing) continue;
      plans.splice(plans.indexOf(prev), 1);
    }
    seen.add(fam);
    plans.push({ ...p, worth: r.value });
  }
  return rank(plans, limit);
}

export const yakuPlans = (g: MahjongGame, s: number, without?: number, limit = 4) => yakuFor(g, s, handOf(g, s, without), limit);

export function yakuCall(g: MahjongGame, s: number, o: ClaimOption, kind: number): string | null {
  const h = afterCall(g, s, o, kind);
  if (!h) return null;
  const before = yakuFor(g, s, handOf(g, s), 1)[0];
  const after = yakuFor(g, s, h, 1)[0];
  const verb = o.type === 'chow' ? (g.profile.callNames.chow ?? 'chow').toLowerCase() : o.type === 'kong' ? (g.profile.callNames.kong ?? 'kong').toLowerCase() : (g.profile.callNames.pung ?? 'pung').toLowerCase();
  return callLine('Yaku check', verb, before, after, `after this ${verb} your open hand would have no yaku, so it could never win. Pass.`);
}

// ------------------------------------------------------------------ minimum-score rulesets

const family = (g: MahjongGame) => g.profile.base ?? g.profile.id;

/** Rulesets where the scoring hand decides the game: a real minimum to win (2 or more, so a flower or
 *  a single scoring set doesn't already cover it), Taiwanese tai (the hand is the payout), and
 *  Sichuan's missing suit. Not the card games, the India rounds or Riichi (their own kits). */
export const valueRoutesOn = (g: MahjongGame) =>
  (g.profile.minValue >= 2 || family(g) === 'taiwanese' || !!g.profile.missingSuit) && !g.profile.yakuRequired && !g.profile.card && !g.profile.specialRound?.startsWith('india') && g.profile.shapes.standard !== false;

/** What each route scores where the ruleset's table is known (Hong Kong faan, Taiwanese tai, from
 *  hongkong.ts and taiwanese.ts); elsewhere the route is named without a number. */
const VALUES: Record<string, Record<string, number>> = {
  hongkong: { half: 3, full: 7, pungs: 3, pairs: 4, dragon: 1, wind: 1 },
  taiwanese: { half: 4, full: 8, pungs: 4, dragon: 1, wind: 1 },
};

function valueRoutes(g: MahjongGame, s: number, h: Hand): Route[] {
  const table = VALUES[family(g)];
  const hk = !!table;
  const unit = g.profile.scoreUnit ?? (family(g) === 'taiwanese' ? 'tai' : 'faan');
  const v = (k: string) => table?.[k];
  const chows = g.profile.calls.chow !== false && g.profile.shapes.chows !== false;
  const seat = windKind(g.state.seatWinds[s]);
  const round = windKind(g.prevailing);
  const out: Route[] = [{ key: 'pungs', name: 'All Pungs', allowed: () => true, chows: false, value: v('pungs'), unit }];
  if (g.profile.shapes.sevenPairs) out.push({ key: 'pairs', name: 'Seven Pairs', allowed: () => true, chows: true, pairs: true, closed: true, value: v('pairs'), unit });
  for (const k of [31, 32, 33]) if (h.counts[k] >= 2 || h.melds.some((m) => m.type !== 'chow' && m.kind === k)) out.push({ key: `dragon${k}`, name: `Pung of ${tileName(k)}s`, allowed: () => true, chows, pung: k, value: v('dragon'), unit });
  for (const k of [seat, round].filter((x, i, a) => a.indexOf(x) === i))
    if (h.counts[k] >= 2 || h.melds.some((m) => m.type !== 'chow' && m.kind === k)) out.push({ key: `wind${k}`, name: `Pung of ${tileName(k)}`, allowed: () => true, chows, pung: k, value: hk ? (k === seat && k === round ? 2 : 1) : undefined, unit });
  // Sichuan: a win needs one suit missing entirely (and there are no honours).
  if (g.profile.missingSuit) {
    for (let st = 0; st < 3; st++) out.push({ key: `void${st}`, name: `Drop ${SUIT_NAMES[st]}`, allowed: (k) => k < 27 && !inSuit(st)(k), chows, extra: 'the missing suit' });
    return [...out.filter((r) => r.key === 'pungs' || r.key === 'pairs' || r.key.startsWith('void')), ...[0, 1, 2].map((st) => ({ key: `full${st}`, name: `Full Flush (${SUIT_NAMES[st]})`, allowed: inSuit(st), chows }))];
  }
  for (let st = 0; st < 3; st++) {
    out.push({ key: `half${st}`, name: `Half Flush (${SUIT_NAMES[st]})`, allowed: (k) => inSuit(st)(k) || isHonor(k), chows, value: v('half'), unit });
    out.push({ key: `full${st}`, name: `Full Flush (${SUIT_NAMES[st]})`, allowed: inSuit(st), chows, value: v('full'), unit });
  }
  return out;
}

function valueFor(g: MahjongGame, s: number, h: Hand, limit: number): TargetPlan[] {
  const min = g.profile.minValue;
  const plans: Ranked[] = [];
  for (const r of valueRoutes(g, s, h)) {
    const p = routePlan(r, h);
    if (!p) continue;
    const fam = r.key.replace(/\d+$/, '');
    const prev = plans.find((x) => x.key.replace(/\d+$/, '') === fam && (fam === 'half' || fam === 'full' || fam === 'void'));
    if (prev) {
      if (p.missing >= prev.missing) continue;
      plans.splice(plans.indexOf(prev), 1);
    }
    // A route worth less than the minimum on its own goes behind those that reach it.
    const short = r.value !== undefined && r.value < min;
    if (short) p.note = `${p.note}, needs ${min} with other scoring`;
    plans.push({ ...p, worth: r.value ?? 0, penalty: short ? 1 : 0 });
  }
  return rank(plans, limit);
}

export const valuePlans = (g: MahjongGame, s: number, without?: number, limit = 4) => valueFor(g, s, handOf(g, s, without), limit);

export function valueCall(g: MahjongGame, s: number, o: ClaimOption, kind: number): string | null {
  const h = afterCall(g, s, o, kind);
  if (!h) return null;
  const before = valueFor(g, s, handOf(g, s), 1)[0];
  const after = valueFor(g, s, h, 1)[0];
  return callLine('Score check', o.type, before, after, `after this ${o.type} no scoring hand would be left. Pass.`);
}
