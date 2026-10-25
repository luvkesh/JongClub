// JongBot's target-hand help for every variation that has a target worth
// planning: the hands you can still make (the planner), the one set aside on your
// rack (the chips and the gold edge), what a call does to it (the call check),
// and what the other players' exposed sets point to (nameplates, hold-back and
// the risk tint).
//
// The India Rules passport help (passportAdvice.ts) was first; each kind of
// round plugs in here as a kit with the same shape:
//   passport   India East (and North played as East): passport hands
//   card       American: the hands on the card
//   smallCard  India South / North Small Cards: the ways to fill your own card
//   special    the Classic special rounds: the hands on the round's card
//   goulash    India West / North Goulash: the clean hands that reach 3 doubles
//   yaku       Riichi family: the yaku your hand can reach
//   value      minimum-score rulesets (Hong Kong and others): the scoring routes
// Plain rulesets with no target (any four sets and a pair) get the reads and the
// risk tint only.

import type { MahjongGame } from '../engine/game';
import type { MeldShape } from '../engine/hand';
import type { ClaimOption, Meld } from '../engine/state';
import { FLOWER, distance, missingFor, progress, type CardInstance } from '../engine/rules/american';
import { SMALL_CARDS, cardSets, cardShape, type SmallCard } from '../engine/rules/indiaCards';
import { FLOWER_BASE, JOKER_KIND, WINDS, isFlower, isJoker, isHonor, tileName, type Tile } from '../engine/tiles';
import { fillComps } from './compPlan';
import { dangerMap, mainThreat, readOpponents, seatLabel, suitLabel } from './danger';
import { handWilds, unseenCounts } from './evaluate';
import { isPassportRound, passportCall, passportThreats, planPassports, riskyKinds } from './passportAdvice';
import { goulashCall, goulashPlans, isIndiaGoulash, valueCall, valuePlans, valueRoutesOn, yakuCall, yakuPlans } from './targetRoutes';
import { tilesForCall } from './american';

/** One target hand the player can still make. */
export interface TargetPlan {
  /** Stable id for the chip the player picks. */
  key: string;
  /** Its name, in parts joined with " + " (a passport hand can have two). English; the UI translates. */
  names: string[];
  /** A short note after the name: the suits, what it pays. English. */
  note?: string;
  /** One line on how to build it (special hands). English. */
  how?: string;
  /** Sets and pair still to make beside the pieces (passport hands). */
  sets?: number;
  pair?: boolean;
  /** Fewest tiles still missing (1 = ready when 13 tiles are held). */
  missing: number;
  /** The target's tiles, one list per piece, held tiles first. Empty when the target has no fixed tiles. */
  pieces: number[][];
  /** For each piece, how many of its tiles (the last ones) are still missing. */
  gaps: number[];
  /** For each piece, whether a declared meld makes it. */
  fromMeld: boolean[];
  /** Missing tiles, as kinds. */
  need: number[];
}

/** What each kind of round calls its targets, and how it finds them. */
export interface TargetKit {
  id: 'passport' | 'card' | 'smallCard' | 'special' | 'goulash' | 'yaku' | 'value';
  /** The chip row's label and the planner's title. */
  chip: string;
  list: string;
  /** The group button, off and on, and their tooltips; the chip tooltip. */
  groupOff: string;
  groupOn: string;
  tipOff: string;
  tipOn: string;
  chipTip: string;
  /** Targets nearest first. `without` takes one tile of that kind out first (the advised discard). */
  plans(game: MahjongGame, seat: number, without?: number, limit?: number): TargetPlan[];
  /** What calling this discard does to the targets, in one line (null: nothing to say). */
  call?(game: MahjongGame, seat: number, o: ClaimOption, kind: number): string | null;
}

/** A target another player looks to be making, and the tiles that help it. */
export interface TargetRead {
  seat: number;
  name: string;
  kinds: number[];
  line: string;
}

const SUIT_NAMES = ['Characters', 'Dots', 'Bamboos'];

/** "3 Knits in the same 2 suits twice", as JongBot says a plan's names in a sentence. */
export const namesSentence = (names: string[]) => names.filter((n, i) => names.indexOf(n) === i).map((n) => (names.filter((x) => x === n).length > 1 ? `${n} twice` : n)).join(' + ');
export const fromReady = (n: number) => (n >= 99 ? 'no win possible with these sets' : n <= 0 ? 'ready' : n === 1 ? '1 tile from ready' : `${n} tiles from ready`);

// ------------------------------------------------------------------ passport (India East)

const passportKit: TargetKit = {
  id: 'passport',
  chip: 'Passport',
  list: 'Passports you can make',
  groupOff: 'Set passport aside',
  groupOn: 'Passport set aside ✓',
  tipOff: 'Set the passport you are making aside on the left, then your other sets, so you can see what is still loose.',
  tipOn: 'Your passport is set aside on the left, then your other sets. Pick another passport above your tiles. Tap to stop grouping.',
  chipTip: 'Set this passport aside on your rack',
  plans: (g, s, without, limit = 4) =>
    planPassports(g, s, without, limit).map((p) => ({ key: p.names.join('+'), names: p.names, sets: p.sets, pair: p.pair, missing: p.missing, pieces: p.pieces, gaps: p.gaps, fromMeld: p.fromMeld, need: p.need })),
  call: (g, s, o, k) => passportCall(g, s, o, k)?.line ?? null,
};

// ------------------------------------------------------------------ American card

/** A card hand as this instance fills it, without suits (the tiles show them): "FF 2222 44 66 8888",
 *  with x, y, z made the numbers chosen. Singles in a block (2026) run together. */
const HONOUR_CH: Record<number, string> = { 27: 'E', 28: 'S', 29: 'W', 30: 'N', 31: 'R', 32: 'G', 33: '0' };
function pattern(inst: CardInstance): string {
  const ch = (k: number) => (k === FLOWER ? 'F' : k >= 27 ? HONOUR_CH[k] : String((k % 9) + 1));
  const blocks = inst.hand.pattern.split(' ');
  const out: string[] = [];
  let gi = 0;
  for (const b of blocks) {
    const body = b.replace(/[abc]$/, '');
    // A block of one repeated symbol is one group; mixed symbols are one group per run.
    let runs = 0;
    for (let i = 0; i < body.length; i++) if (i === 0 || body[i] !== body[i - 1]) runs++;
    let text = '';
    for (let r = 0; r < runs && gi < inst.groups.length; r++, gi++) text += ch(inst.groups[gi].kind).repeat(inst.groups[gi].size);
    out.push(text);
  }
  return out.join(' ');
}
const cardName = (inst: CardInstance) => `${inst.hand.section}: ${pattern(inst)}`;
const cardNote = (inst: CardInstance) => `${inst.hand.value} points${inst.hand.concealed ? ', concealed' : ''}`;
const normK = (k: number) => (isFlower(k) ? FLOWER : k);

/** The tiles of one card hand, as you hold them: exposures, then each group's naturals and jokers,
 *  then what is still missing (the same filling as missingFor). */
function cardFill(inst: CardInstance, hand: Tile[], melds: Meld[]): TargetPlan | null {
  const miss = missingFor(inst, hand, melds);
  if (!Number.isFinite(miss)) return null;
  const groups = inst.groups;
  const used = groups.map(() => false);
  const fromMeld = groups.map(() => false);
  for (const m of melds) {
    const t = m.tiles.find((x) => !isJoker(x.kind));
    const k = t ? normK(t.kind) : -1;
    const i = groups.findIndex((g, gi) => !used[gi] && g.kind === k && g.size === m.tiles.length);
    if (i >= 0) (used[i] = true), (fromMeld[i] = true);
  }
  // Natural tiles by kind (flowers as one kind, keeping each tile's own face).
  const pool = new Map<number, number[]>();
  let jokers = 0;
  for (const t of hand) {
    if (isJoker(t.kind)) jokers++;
    else (pool.get(normK(t.kind)) ?? pool.set(normK(t.kind), []).get(normK(t.kind))!).push(t.kind);
  }
  const held: number[][] = groups.map(() => []);
  const order = groups.map((_, i) => i).filter((i) => !used[i]);
  order.sort((a, b) => groups[a].size - groups[b].size);
  for (const i of order) {
    const p = pool.get(groups[i].kind) ?? [];
    held[i] = p.splice(0, groups[i].size);
  }
  const pieces: number[][] = [];
  const gaps: number[] = [];
  const need: number[] = [];
  groups.forEach((g, i) => {
    const face = g.kind === FLOWER ? FLOWER_BASE : g.kind;
    if (fromMeld[i]) {
      pieces.push(new Array(g.size).fill(face));
      gaps.push(0);
      return;
    }
    const tiles = held[i].slice();
    let short = g.size - tiles.length;
    if (g.size >= 3) {
      const j = Math.min(jokers, short);
      jokers -= j;
      short -= j;
      for (let x = 0; x < j; x++) tiles.push(JOKER_KIND);
    }
    for (let x = 0; x < short; x++) (tiles.push(face), need.push(face));
    pieces.push(tiles);
    gaps.push(short);
  });
  return { key: inst.hand.id, names: [cardName(inst)], note: cardNote(inst), missing: miss, pieces, gaps, fromMeld, need };
}

function cardPlans(hand: Tile[], melds: Meld[], limit = 4): TargetPlan[] {
  const out: TargetPlan[] = [];
  const seen = new Set<string>();
  for (const p of progress(hand, melds, 400)) {
    if (seen.has(p.instance.hand.id)) continue;
    const plan = cardFill(p.instance, hand, melds);
    if (!plan) continue;
    seen.add(p.instance.hand.id);
    out.push(plan);
    if (out.length >= limit) break;
  }
  return out;
}

const withoutKind = (hand: Tile[], kind?: number) => {
  if (kind === undefined) return hand;
  const i = hand.findIndex((t) => t.kind === kind);
  return i < 0 ? hand : [...hand.slice(0, i), ...hand.slice(i + 1)];
};

const cardKit: TargetKit = {
  id: 'card',
  chip: 'Card hand',
  list: 'Card hands you can make',
  groupOff: 'Set card hand aside',
  groupOn: 'Card hand set aside ✓',
  tipOff: 'Set the card hand you are making aside on the left, group by group, so you can see which tiles it doesn’t use.',
  tipOn: 'Your card hand is set aside on the left, group by group. Pick another hand above your tiles. Tap to stop grouping.',
  chipTip: 'Set this card hand aside on your rack',
  plans: (g, s, without, limit = 4) => cardPlans(withoutKind(g.players[s].hand, without), g.players[s].melds, limit),
  call(g, s, o, kind) {
    if (o.type !== 'pung' && o.type !== 'kong') return null;
    const pl = g.players[s];
    const size = o.type === 'kong' ? 4 : 3;
    const usedTiles = tilesForCall(pl.hand, kind, size - 1);
    if (usedTiles.length < size - 1) return null;
    const meld: Meld = { type: o.type, tiles: [...usedTiles, { id: -1, kind }], concealed: false };
    const rest = pl.hand.filter((t) => !usedTiles.includes(t));
    const melds = [...pl.melds, meld];
    const before = distance(pl.hand, pl.melds);
    let after = Infinity;
    let restBest = rest;
    for (const t of rest) {
      const d = distance(rest.filter((x) => x !== t), melds);
      if (d < after) (after = d), (restBest = rest.filter((x) => x !== t));
    }
    const verb = o.type === 'kong' ? 'kong' : 'pung';
    const aim = cardPlans(restBest, melds, 1)[0];
    if (!aim || !Number.isFinite(after)) return `Card check: after this ${verb} no hand on the card would fit your exposures. Pass.`;
    const left = (n: number) => (n <= 0 ? 'complete' : n === 1 ? '1 tile from Mah Jongg' : `${n} tiles from Mah Jongg`);
    if (after < before) return `Card check: this ${verb} fits ${namesSentence(aim.names)} and leaves you ${left(after)} (now ${left(before)}).`;
    if (after === before) return `Card check: this ${verb} doesn't bring a card hand closer. You stay ${left(after)}, aiming for ${namesSentence(aim.names)}.`;
    return `Card check: this ${verb} pins you to ${namesSentence(aim.names)}, ${left(after)} instead of ${left(before)}.`;
  },
};

/** Which card hands an opponent's exposures still fit, and the tiles those hands want. */
function cardReads(game: MahjongGame, seat: number): TargetRead[] {
  const out: TargetRead[] = [];
  game.players.forEach((p, o) => {
    if (o === seat || !p.melds.length) return;
    const fits = progress([], p.melds, 400).map((x) => x.instance);
    if (!fits.length) return;
    const sections = [...new Set(fits.map((f) => f.hand.section))];
    const lines = [...new Set(fits.map((f) => f.hand.id))];
    // Kinds the fitting hands want beyond what is exposed, by how many of them want it.
    const want = new Map<number, number>();
    for (const f of fits) {
      const exposed = p.melds.map((m) => m.tiles.find((t) => !isJoker(t.kind))).map((t) => (t ? normK(t.kind) : -1));
      for (const g of f.groups) if (!exposed.includes(g.kind) && g.kind !== FLOWER) want.set(g.kind, (want.get(g.kind) ?? 0) + 1);
    }
    const kinds = [...want].filter(([, n]) => n * 2 >= fits.length).map(([k]) => k).sort((a, b) => a - b);
    const name = lines.length === 1 ? cardName(fits[0]) : sections.length === 1 ? `${sections[0]} hand` : `${sections.slice(0, 2).join(' or ')} hand`;
    const who = seatLabel(game, o);
    const hold = kinds.length ? ` Hold back ${kindList(kinds)}.` : '';
    const close = p.melds.length >= 3 ? ' They may be close to Mah Jongg.' : '';
    out.push({ seat: o, name, kinds, line: `${who}'s exposures fit ${lines.length === 1 ? namesSentence([name]) : `${lines.length} card hands (${sections.join(', ')})`}.${hold}${close}` });
  });
  return out;
}

// ------------------------------------------------------------------ India Small Cards

const PERMS = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
];
/** One- and two-suit cards say which suits; a three-suit card uses them all, so the tiles say it. */
const suitsNote = (card: SmallCard, perm: number[]) => (card.suits === 1 || card.suits === 2 ? `in ${perm.slice(0, card.suits).map((s) => SUIT_NAMES[s]).join(' and ')}` : undefined);

/** The ways to fill one Small Card from these tiles, nearest first (one per way of giving it suits). */
export function smallCardPlans(card: SmallCard, counts: number[], melds: MeldShape[], seatKind: number, roundKind: number, jokers = 0, limit = 4, beam = 4): TargetPlan[] {
  const out: TargetPlan[] = [];
  const seen = new Set<string>();
  for (const p of PERMS) {
    const sk = p.slice(0, card.suits).join();
    if (seen.has(sk)) continue;
    seen.add(sk);
    card.alts({ A: p[0], B: p[1], C: p[2], seat: seatKind, round: roundKind }).forEach((comps, ai) => {
      const f = fillComps(comps, counts, melds, card, beam);
      if (!f) return;
      out.push({ key: `${sk}|${ai}`, names: [card.name], note: suitsNote(card, p), how: card.how, missing: Math.max(0, f.missing - jokers), pieces: f.pieces, gaps: f.gaps, fromMeld: f.fromMeld, need: f.need });
    });
  }
  out.sort((a, b) => a.missing - b.missing);
  // Two fills with the same tiles (suits given another way round, alternatives that agree) show once.
  const keep: TargetPlan[] = [];
  const names = new Set<string>();
  for (const x of out) {
    const n = x.pieces.map((q) => [...q].sort((a, b) => a - b).join('.')).sort().join('/');
    if (names.has(n)) continue;
    names.add(n);
    keep.push(x);
    if (keep.length >= limit) break;
  }
  return keep;
}

const seatCard = (g: MahjongGame, s: number) => {
  const c = g.state.cards?.[s];
  return g.profile.dealCards && c !== undefined ? SMALL_CARDS[c] : undefined;
};
const kindOfWind = (w: (typeof WINDS)[number]) => 27 + WINDS.indexOf(w);

const smallCardKit: TargetKit = {
  id: 'smallCard',
  chip: 'Your card',
  list: 'Ways to fill your card',
  groupOff: 'Set card aside',
  groupOn: 'Card set aside ✓',
  tipOff: 'Set the tiles of your Small Card aside on the left, piece by piece, so you can see which tiles it doesn’t use.',
  tipOn: 'Your card’s pieces are set aside on the left. Pick another way to fill it above your tiles. Tap to stop grouping.',
  chipTip: 'Set this way of filling your card aside on your rack',
  plans(g, s, without, limit = 4) {
    const card = seatCard(g, s);
    if (!card) return [];
    const c = g.concealedCounts(s);
    if (without !== undefined && c[without] > 0) c[without]--;
    return smallCardPlans(card, c, g.meldShapes(s), kindOfWind(g.state.seatWinds[s]), kindOfWind(g.prevailing), handWilds(g, s).length, limit);
  },
  call(g, s, o, kind) {
    const card = seatCard(g, s);
    if (!card || (o.type !== 'pung' && o.type !== 'kong' && o.type !== 'chow' && o.type !== 'buy')) return null;
    const sk = kindOfWind(g.state.seatWinds[s]);
    const rk = kindOfWind(g.prevailing);
    const jokers = handWilds(g, s).length;
    const c = g.concealedCounts(s);
    const melds = g.meldShapes(s);
    const now = smallCardPlans(card, c, melds, sk, rk, jokers, 1)[0];
    let after: TargetPlan | undefined;
    if (o.type === 'buy') after = smallCardPlans(card, (c[kind]++, c), melds, sk, rk, jokers, 1)[0];
    else {
      const used = o.using?.length ? o.using : new Array(o.type === 'kong' ? 3 : 2).fill(kind);
      for (const k of used) if (c[k] > 0) c[k]--;
      const meld: MeldShape = { type: o.type, kind: o.type === 'chow' ? Math.min(kind, ...used) : kind };
      after = smallCardPlans(card, c, [...melds, meld], sk, rk, jokers, 1)[0];
    }
    const verb = o.type === 'buy' ? 'buy' : o.type;
    const b = now ? now.missing - 1 : 99;
    const a = after ? after.missing - 1 : 99;
    if (!after) return `Card check: ${card.name} has no place for this ${verb}. Pass.`;
    const how = after.note ? `${card.name} ${after.note}` : card.name;
    if (a < b) return `Card check: this ${verb} fills part of ${how} and leaves you ${fromReady(a)} (now ${fromReady(b)}).`;
    if (a === b) return `Card check: this ${verb} doesn't bring ${card.name} closer. You stay ${fromReady(a)}.`;
    return `Card check: this ${verb} sets ${card.name} back to ${fromReady(a)} (now ${fromReady(b)}).`;
  },
};

/** The Small Cards an opponent's exposed sets still fit (their own card is secret). */
function smallCardReads(game: MahjongGame, seat: number): TargetRead[] {
  const out: TargetRead[] = [];
  game.players.forEach((p, o) => {
    if (o === seat) return;
    const melds = game.meldShapes(o).filter((_, i) => !p.melds[i]?.concealed);
    if (melds.length < 2) return;
    const sk = kindOfWind(game.state.seatWinds[o]);
    const rk = kindOfWind(game.prevailing);
    const deck = game.profile.dealDeck ?? SMALL_CARDS.map((_, i) => i);
    const fits: { card: SmallCard; plan: TargetPlan }[] = [];
    for (const i of deck) {
      const card = SMALL_CARDS[i];
      if (card.wall) continue;
      // A card that can't hold each exposed set on its own is out at once.
      const sets = cardSets(card, game.state.seatWinds[o], game.prevailing);
      if (!melds.every((m) => (m.type === 'chow' ? sets.chows : sets.pungs).has(m.kind))) continue;
      // Only the exposed sets are known: price the card with no concealed tiles (a narrow search).
      const plan = smallCardPlans(card, new Array(34).fill(0), melds, sk, rk, 0, 1, 2)[0];
      if (plan) fits.push({ card, plan });
    }
    if (!fits.length || fits.length > 6) return;
    // Tiles every card that fits can use, less what they have shown; worth naming only when few.
    const usable = fits.map((f) => {
      const shape = cardShape(f.card, game.state.seatWinds[o], game.prevailing, () => melds);
      return new Set(Array.from({ length: 34 }, (_, k) => k).filter((k) => shape.uses!(k)));
    });
    const shown = new Set(melds.flatMap((m) => (m.type === 'chow' ? [] : [m.kind])));
    const common = Array.from({ length: 34 }, (_, k) => k).filter((k) => usable.every((u) => u.has(k)) && !shown.has(k));
    const kinds = common.length <= 12 ? common : [];
    const names = fits.map((f) => f.card.name);
    const name = names.length === 1 ? names[0] : `${names[0]} or ${names.length - 1} more`;
    const hold = kinds.length ? ` Hold back ${kindList(kinds)}.` : '';
    out.push({ seat: o, name, kinds, line: `${seatLabel(game, o)}'s sets fit ${names.length === 1 ? names[0] : `only ${names.length} cards: ${names.join(', ')}`}.${hold}` });
  });
  return out;
}

// ------------------------------------------------------------------ Classic special rounds

const specialKit: TargetKit = {
  id: 'special',
  chip: 'Card hand',
  list: 'Hands on the card you can make',
  groupOff: 'Group sets',
  groupOn: 'Sets grouped ✓',
  tipOff: 'Pull complete sets to the left, spaced apart, so you can see what is still loose.',
  tipOn: 'Complete sets are pulled to the left and spaced apart. Tap to stop grouping.',
  chipTip: '',
  plans(g, s, without, limit = 4) {
    const rules = g.shapesFor(s);
    const c = g.concealedCounts(s);
    if (without !== undefined && c[without] > 0) c[without]--;
    const m = g.players[s].melds.length;
    const card = g.profile.guide?.sections?.flatMap((x) => x.lines) ?? [];
    return (rules.special ?? [])
      .map((sp) => {
        const line = card.find((l) => l[0] === sp.name);
        return { key: sp.name, names: [sp.name], note: line && typeof line[1] === 'number' ? `${line[1]} ${g.profile.scoreUnit ?? 'faan'}` : undefined, how: sp.how ?? (line ? String(line[2] ?? '') : undefined), missing: sp.shanten(c, m) + 1, pieces: [], gaps: [], fromMeld: [], need: [] };
      })
      .filter((p) => p.missing < 90)
      .sort((a, b) => a.missing - b.missing)
      .slice(0, limit);
  },
};

// ------------------------------------------------------------------ routes (Goulash, yaku, value)

const goulashKit: TargetKit = {
  id: 'goulash',
  chip: 'Clean hand',
  list: 'Clean hands that reach 3 doubles',
  groupOff: 'Set clean hand aside',
  groupOn: 'Clean hand set aside ✓',
  tipOff: 'Set the pungs and pair of the clean hand you are making aside on the left, so you can see which tiles don’t belong.',
  tipOn: 'Your clean hand’s pungs and pair are set aside on the left. Pick another clean hand above your tiles. Tap to stop grouping.',
  chipTip: 'Set this clean hand aside on your rack',
  plans: goulashPlans,
  call: goulashCall,
};

const yakuKit: TargetKit = {
  id: 'yaku',
  chip: 'Yaku',
  list: 'Yaku you can make',
  groupOff: 'Set yaku aside',
  groupOn: 'Yaku set aside ✓',
  tipOff: 'Set the tiles of the yaku you are making aside on the left, set by set, so you can see what is still loose.',
  tipOn: 'The tiles of your yaku are set aside on the left. Pick another yaku above your tiles. Tap to stop grouping.',
  chipTip: 'Set this yaku aside on your rack',
  plans: yakuPlans,
  call: yakuCall,
};

const valueKit: TargetKit = {
  id: 'value',
  chip: 'Aim',
  list: 'Scoring hands you can make',
  groupOff: 'Set scoring hand aside',
  groupOn: 'Scoring hand set aside ✓',
  tipOff: 'Set the tiles of the scoring hand you are making aside on the left, set by set, so you can see what is still loose.',
  tipOn: 'The tiles of your scoring hand are set aside on the left. Pick another one above your tiles. Tap to stop grouping.',
  chipTip: 'Set this scoring hand aside on your rack',
  plans: valuePlans,
  call: valueCall,
};

/** The target kit for the round being played, or null when there is no target to plan. */
export function targetKit(game: MahjongGame): TargetKit | null {
  const p = game.profile;
  if (isPassportRound(game)) return passportKit;
  if (p.card) return cardKit;
  if (p.dealCards) return smallCardKit;
  if (isIndiaGoulash(game)) return goulashKit;
  if (p.shapes.standard === false && p.shapes.special?.length) return specialKit;
  if (p.yakuRequired) return yakuKit;
  if (valueRoutesOn(game)) return valueKit;
  return null;
}

// ------------------------------------------------------------------ reads and risk

const kindList = (kinds: number[]) => {
  // By suit where a whole run of a suit is wanted: "Bamboos 2, 4, 6"; honours by name.
  const parts: string[] = [];
  for (let s = 0; s < 3; s++) {
    const ks = kinds.filter((k) => k < 27 && Math.floor(k / 9) === s);
    if (ks.length === 9) parts.push(`all ${SUIT_NAMES[s]}`);
    else if (ks.length) parts.push(`${SUIT_NAMES[s]} ${ks.map((k) => (k % 9) + 1).join(', ')}`);
  }
  for (const k of kinds.filter(isHonor)) parts.push(tileName(k));
  return parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
};

/** Targets another player looks to be making, from what they show. */
export function targetReads(game: MahjongGame, seat: number): TargetRead[] {
  if (isPassportRound(game)) return passportThreats(game, seat);
  if (game.profile.card) return cardReads(game, seat);
  if (game.profile.dealCards) return smallCardReads(game, seat);
  return tableReads(game, seat);
}

/** The Asian-variant reads (danger.ts) as targets: riichi, a flush, dragons, all pungs. */
function tableReads(game: MahjongGame, seat: number): TargetRead[] {
  const out: TargetRead[] = [];
  const riichiName = game.profile.callNames.riichi ?? 'Riichi';
  const goulash = isIndiaGoulash(game);
  for (const r of readOpponents(game, seat)) {
    const who = seatLabel(game, r.seat);
    const p = game.players[r.seat];
    if (r.flushSuit !== null) {
      const s = r.flushSuit;
      const honours = p.melds.some((m) => !m.concealed && m.tiles[0].kind >= 27);
      const kinds = Array.from({ length: 9 }, (_, i) => s * 9 + i);
      const name = goulash ? (honours ? `${SUIT_NAMES[s]} with honours` : `Clean ${SUIT_NAMES[s]}`) : honours ? `${SUIT_NAMES[s]} half flush` : `${SUIT_NAMES[s]} flush`;
      out.push({ seat: r.seat, name, kinds, line: `${who} looks to be collecting ${suitLabel(s)}: likely ${name}. Hold back ${SUIT_NAMES[s]}${honours ? ' and honours they could pung' : ''}.` });
      continue;
    }
    if (r.dragonPungs >= 2) {
      const shown = p.melds.filter((m) => !m.concealed && m.tiles[0].kind >= 31).map((m) => m.tiles[0].kind);
      const kinds = [31, 32, 33].filter((k) => !shown.includes(k));
      out.push({ seat: r.seat, name: 'Three Dragons', kinds, line: `${who} has ${r.dragonPungs} dragon sets showing: likely Three Dragons. Hold back the ${kinds.map(tileName).join(' and ')}.` });
      continue;
    }
    if (r.riichi) {
      out.push({ seat: r.seat, name: riichiName, kinds: [], line: `${who} has declared ${riichiName}. Tiles they discarded are safe against them.` });
      continue;
    }
    if (r.pungHand && r.openMelds >= 3) out.push({ seat: r.seat, name: 'All Pungs', kinds: [], line: `${who} has only pungs showing: likely All Pungs. A pair you break up is safer than a single honour.` });
  }
  return out;
}

/** The likeliest target each other player is showing, by seat. */
export function likelyTargets(game: MahjongGame, seat: number): Map<number, TargetRead> {
  const out = new Map<number, TargetRead>();
  for (const t of targetReads(game, seat)) if (!out.has(t.seat)) out.set(t.seat, t);
  return out;
}

/** Kinds a discard could hand to someone: what their targets want, and (against a riichi or a ready-
 *  looking hand) the tiles JongBot rates high risk. Passport rounds keep the passport reads only. */
export function riskyTargetKinds(game: MahjongGame, seat: number): Set<number> {
  if (isPassportRound(game)) return riskyKinds(game, seat);
  const out = new Set(targetReads(game, seat).flatMap((t) => t.kinds));
  if (!game.profile.card) {
    const d = dangerMap(game, seat, 'full');
    if (mainThreat(d.reads, 0.45)) d.loss.forEach((l, k) => l >= 0.04 && out.add(k));
  }
  return out;
}

/** Tiles still out there for each kind a plan needs (for "Still to find"). */
export const leftOf = (game: MahjongGame, seat: number) => unseenCounts(game, seat);
