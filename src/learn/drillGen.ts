// Daily drills: short questions built by the engine itself, so every answer
// is the engine's own. Each drill comes from a type and a seed, which is all
// the schedule needs to keep to bring a missed one back days later.
//
//   name     name the tile (face shown without its corner label)
//   wait     which tiles complete this ready hand
//   discard  the most efficient discard (the daily puzzle generator)
//   safe     after an opponent's riichi, is this tile safe to discard
//   value    how many faan / han / tai a finished winning hand is worth

import { AiPlayer } from '../ai/players';
import { readOpponent, safeSets, safetySentence, tileDanger, type TileDanger } from '../ai/danger';
import { unseenCounts } from '../ai/evaluate';
import { buildPuzzle } from '../club/daily';
import { buildProfile, playHandHeadless } from '../club/sim';
import { seedOf } from '../club/util';
import { MahjongGame } from '../engine/game';
import { waits as handWaits, winningDecompositions, type SetShape } from '../engine/hand';
import { getProfile } from '../engine/rules';
import { classicProfile } from '../engine/rules/classic';
import { Rng } from '../engine/rng';
import { KIND_COUNT, WIND_NAMES, rankOf, suitOf, toCounts, type Wind } from '../engine/tiles';
import { andList, tr } from '../i18n';
import { tileLabel } from '../i18n/tiles';

export type DrillType = 'name' | 'wait' | 'discard' | 'safe' | 'value';

export const DRILL_TYPES: DrillType[] = ['name', 'wait', 'discard', 'safe', 'value'];

export const DRILL_LABEL: Record<DrillType, string> = {
  name: tr('Name the tile'),
  wait: tr('Name the wait'),
  discard: tr('Best discard'),
  safe: tr('Is this tile safe?'),
  value: tr('Count the hand'),
};

/** Variations whose winning hands the value drill can show. */
export const VALUE_VARIATIONS = ['classic', 'riichi', 'hongkong', 'taiwanese', 'uae'];

export interface DrillOption {
  label: string;
  /** Tiles drawn on the option (a set of waits). */
  tiles?: number[];
  correct: boolean;
}

export interface Drill {
  /** type:variation:seed, stable for the schedule. */
  id: string;
  type: DrillType;
  seed: number;
  variation: string;
  prompt: string;
  /** A short line of table context (winds, how the hand was won). */
  context?: string;
  /** Tiles in hand, sorted. */
  hand?: number[];
  /** Exposed sets. */
  melds?: number[][];
  /** The winning tile (value drills). */
  winTile?: number;
  /** The tile the question is about (name, safe). */
  focus?: number;
  /** Dora tiles showing (Riichi). */
  dora?: number[];
  /** Flowers (and other bonus tiles) set aside by the winner. */
  flowers?: number[];
  /** An opponent's discards (safe drills); `riichiAt` is the declaration tile. */
  pool?: { who: string; tiles: number[]; riichiAt: number; since: number[] };
  /** 'tile': answer by tapping a tile in `hand`; 'option': pick one of `options`. */
  pick: 'tile' | 'option';
  options: DrillOption[];
  /** For 'tile' drills: every kind that counts as right. */
  correctTiles?: number[];
  /** Plain explanation, shown after answering. */
  explanation: string;
  /** Draw the tile faces without corner labels (name drills). */
  hideLabels?: boolean;
}

export const drillId = (type: DrillType, variation: string, seed: number) => `${type}:${variation}:${seed}`;

const SUIT_PLURAL: Record<string, string> = { man: tr('Characters'), pin: tr('Dots'), sou: tr('Bamboo') };

/** "the 3 Dot, 6 Dot and 9 Dot" */
export function listNames(kinds: number[]): string {
  const n = kinds.map((k) => tileLabel(k));
  return n.length <= 1 ? n.join('') : andList(n);
}

function shuffle<T>(rng: Rng, a: T[]): T[] {
  return rng.shuffle(a.slice());
}

// ------------------------------------------------------------ name the tile

function recogniseTip(kind: number): string {
  const s = suitOf(kind);
  if (s === 'man') return tr('Characters tiles show the number as a Chinese numeral, with the character 萬 (ten thousand) beneath it.');
  if (s === 'pin') return tr('Dots tiles show circles: count them for the number.');
  if (s === 'sou') return rankOf(kind) === 1 ? tr('The 1 Bamboo is drawn as a bird, often a peacock or sparrow, rather than a single stick.') : tr('Bamboo tiles show sticks of bamboo: count them for the number.');
  if (s === 'wind') return tr('Winds carry their Chinese character: 東 East, 南 South, 西 West, 北 North.');
  return tr('Dragons: the Red Dragon is 中, the Green Dragon is 發, and the White Dragon is a blank or framed tile.');
}

function nameDrill(seed: number): Drill {
  const rng = new Rng(seed);
  const kind = rng.int(KIND_COUNT);
  const pool: number[] = [];
  if (kind < 27) {
    const base = kind - (kind % 9);
    for (let r = 0; r < 9; r++) if (base + r !== kind && Math.abs(r - (kind % 9)) <= 3) pool.push(base + r);
    // A same-number tile of another suit is the classic mix-up.
    pool.push((kind + 9) % 27, (kind + 18) % 27);
  } else for (let k = 27; k < KIND_COUNT; k++) if (k !== kind) pool.push(k);
  const wrong = shuffle(rng, pool).slice(0, 3);
  return {
    id: drillId('name', 'classic', seed),
    type: 'name',
    seed,
    variation: 'classic',
    prompt: tr('Which tile is this?'),
    focus: kind,
    hideLabels: true,
    pick: 'option',
    options: shuffle(rng, [kind, ...wrong]).map((k) => ({ label: tileLabel(k), correct: k === kind })),
    explanation: `${tr('It’s the {tile}.', { tile: tileLabel(kind) })} ${recogniseTip(kind)}`,
  };
}

// ------------------------------------------------------------ name the wait

function setLabel(s: SetShape): string {
  if (s.kind >= 27) return s.type === 'pair' ? tr('a pair of {tile}s', { tile: tileLabel(s.kind) }) : tr('three {tile}s', { tile: tileLabel(s.kind) });
  const r = rankOf(s.kind);
  const suit = SUIT_PLURAL[suitOf(s.kind)];
  if (s.type === 'chow') return `${r}-${r + 1}-${r + 2} ${suit}`;
  if (s.type === 'pung') return `${r}-${r}-${r} ${suit}`;
  return tr('a pair of {n} {suit}', { n: r, suit });
}

/** How a waiting tile finishes the hand, in words: "the 4 Dot makes 2-3-4 Dots, 5-6-7 Dots, ... and a pair of 9 Dots". */
export function readingWith(counts: number[], kind: number): string {
  const c = counts.slice();
  c[kind]++;
  const d = winningDecompositions(c, 0, classicProfile.shapes)[0];
  if (!d) return '';
  if (d.shape === 'sevenPairs') return tr('the {tile} makes seven pairs', { tile: tileLabel(kind) });
  if (d.shape === 'thirteenOrphans') return tr('the {tile} completes thirteen orphans', { tile: tileLabel(kind) });
  return tr('the {tile} makes {sets}', { tile: tileLabel(kind), sets: [...d.sets.map(setLabel), setLabel({ type: 'pair', kind: d.pair })].join(', ') });
}

/** A ready 13-tile concealed hand built from sets, mostly in one suit so the waits are interesting. */
function readyHand(rng: Rng): number[] | null {
  const counts = new Array(KIND_COUNT).fill(0);
  const main = rng.int(3) * 9;
  const other = ((main / 9 + 1 + rng.int(2)) % 3) * 9;
  const add = (k: number, n = 1) => {
    if (counts[k] + n > 4) return false;
    counts[k] += n;
    return true;
  };
  let sets = 0;
  for (let tries = 0; sets < 4 && tries < 40; tries++) {
    const roll = rng.next();
    const base = roll < 0.72 ? main : roll < 0.9 ? other : -1;
    if (base < 0) {
      const k = 27 + rng.int(7);
      if (add(k, 3)) sets++;
      continue;
    }
    if (rng.next() < 0.7) {
      const r = rng.int(7);
      if (counts[base + r] < 4 && counts[base + r + 1] < 4 && counts[base + r + 2] < 4) {
        add(base + r);
        add(base + r + 1);
        add(base + r + 2);
        sets++;
      }
    } else if (add(base + rng.int(9), 3)) sets++;
  }
  if (sets < 4) return null;
  const pair = rng.next() < 0.8 ? main + rng.int(9) : 27 + rng.int(7);
  if (!add(pair, 2)) return null;
  // Take one tile out: the hand is now waiting.
  const kinds = counts.flatMap((n, k) => Array<number>(n).fill(k));
  kinds.splice(rng.int(kinds.length), 1);
  return kinds;
}

const sameSet = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

function waitDrill(seed: number): Drill {
  for (let attempt = 0; attempt < 40; attempt++) {
    const rng = new Rng(seedOf(seed, 'wait', attempt));
    const hand = readyHand(rng);
    if (!hand) continue;
    const counts = toCounts(hand);
    const w = handWaits(counts.slice(), 0, classicProfile.shapes);
    if (!w.length || w.length > 4) continue;
    // Wrong answers: one wait short, one too many, or a neighbour instead.
    const near = (k: number) => [k - 1, k + 1, k - 3, k + 3].filter((x) => x >= 0 && x < 27 && Math.floor(x / 9) === Math.floor(k / 9) && !w.includes(x) && counts[x] < 4);
    const cands: number[][] = [];
    if (w.length > 1) for (const k of w) cands.push(w.filter((x) => x !== k));
    for (const k of w) for (const n of near(k)) cands.push([...w, n].sort((a, b) => a - b), w.map((x) => (x === k ? n : x)).sort((a, b) => a - b));
    for (const k of hand) if (!w.includes(k)) cands.push([k]);
    const wrong: number[][] = [];
    for (const c of shuffle(rng, cands)) if (c.length && !sameSet(c, w) && !wrong.some((x) => sameSet(x, c)) && new Set(c).size === c.length) wrong.push(c);
    if (wrong.length < 3) continue;
    const label = (ks: number[]) => (ks.length === 1 ? tr('Only the {tile}', { tile: tileLabel(ks[0]) }) : listNames(ks));
    const opts = shuffle(rng, [w, ...wrong.slice(0, 3)]).map((ks) => ({ label: label(ks), tiles: ks, correct: sameSet(ks, w) }));
    // Spell out how each wait finishes the hand when there are only one or two.
    const why = w.length <= 2 ? w.map((k) => readingWith(counts, k)).filter(Boolean) : [];
    return {
      id: drillId('wait', 'classic', seed),
      type: 'wait',
      seed,
      variation: 'classic',
      prompt: tr('This hand is one tile from winning. Which tiles complete it?'),
      hand: hand.slice().sort((a, b) => a - b),
      pick: 'option',
      options: opts,
      explanation: `${w.length === 1 ? tr('Just one wait: the {tile}.', { tile: tileLabel(w[0]) }) : tr('It waits on the {tiles}.', { tiles: listNames(w) })}${why.map((s) => ` ${s[0].toUpperCase()}${s.slice(1)}.`).join('')}${w.length > 2 ? ` ${tr('Long runs in one suit can be finished at either end and in the middle, so look for every way to split them.')}` : ''}`,
    };
  }
  throw new Error('no wait drill');
}

// ------------------------------------------------------------ best discard

function discardDrill(seed: number, variation: string): Drill {
  const v: 'classic' | 'riichi' = variation === 'riichi' ? 'riichi' : 'classic';
  let fallback: ReturnType<typeof buildPuzzle> = null;
  for (let attempt = 0; attempt < 16; attempt++) {
    const s = seedOf(seed, 'discard', attempt);
    const p = buildPuzzle(v, s, 3 + (s % 5));
    if (!p) continue;
    fallback ??= p;
    if (p.answers.length > 1 && p.answers[1].score < 95) break;
  }
  const p = fallback ?? buildPuzzle('classic', seed, 0)!;
  const best = p.answers.filter((a) => a.score >= 95).map((a) => a.kind);
  return {
    id: drillId('discard', v, seed),
    type: 'discard',
    seed,
    variation: v,
    prompt: tr('Which tile would you discard to win fastest?'),
    context: `${v === 'riichi' ? 'Riichi' : 'Classic'} · ${tr('seat wind {seat}, round wind {round}', { seat: tr(WIND_NAMES[p.seatWind]), round: tr(WIND_NAMES[p.roundWind]) })}`,
    hand: p.hand,
    dora: p.doraKinds,
    pick: 'tile',
    options: [],
    correctTiles: best,
    explanation: p.explanation,
  };
}

// ------------------------------------------------------------ is this tile safe?

/** A Riichi position just after an opponent declared, with your turn to discard. */
function riichiPosition(seed: number): { game: MahjongGame; opp: number } | null {
  const profile = buildProfile('riichi', 'oneHand');
  const game = new MahjongGame(profile, ['You', 'Mei', 'Rex', 'Hiro'], seed);
  const ais = [0, 1, 2, 3].map((s) => new AiPlayer(s, 'strategic', s === 0 ? 'zen' : 'gambler', seed + s * 101));
  game.startHand(seed);
  let opp = -1;
  let since = 0;
  for (let step = 0; step < 600; step++) {
    const ph = game.state.phase;
    if (ph.kind === 'handOver') return null;
    if (ph.kind === 'claims') {
      for (const s of game.pendingClaimSeats()) {
        const cur = game.state.phase;
        if (cur.kind !== 'claims') break;
        const r = s === 0 ? { type: 'pass' as const } : ais[s].decideClaim(game, cur.options[s], cur.tile.kind);
        game.respond(s, r);
      }
      continue;
    }
    if (ph.kind !== 'turn') return null;
    const seat = ph.seat;
    if (seat === 0) {
      if (opp >= 0 && since >= 2) return { game, opp };
      const opts = game.turnOptions(0);
      if (opts.canWin) return null;
      const kind = ais[0].pickDiscardKind(game);
      const tile = (ph.drawn && ph.drawn.kind === kind ? ph.drawn : game.players[0].hand.find((t) => t.kind === kind))!;
      game.discard(0, tile.id);
      if (opp >= 0) since++;
      continue;
    }
    const d = ais[seat].decideTurn(game);
    if (d.action === 'win') return null;
    if (d.action === 'kong') game.declareKong(seat, d.kind!);
    else {
      // Only one opponent declares in a drill, so the question stays about them.
      const riichi = !!d.riichi && opp < 0;
      game.discard(seat, d.tileId!, { riichi });
      if (riichi) opp = seat;
      else if (opp >= 0) since++;
    }
  }
  return null;
}

const SURE_SAFE: TileDanger['reason'][] = ['genbutsu', 'passedRiichi'];

/** Is a tile surely safe (they threw it, or it passed them after their riichi), or a risky live one? */
export function safetyOf(d: TileDanger): 'safe' | 'risky' | null {
  if (SURE_SAFE.includes(d.reason) && d.hit === 0) return 'safe';
  if (d.reason === 'none' && d.hit >= 0.06) return 'risky';
  return null;
}

function safeDrill(seed: number): Drill {
  for (let attempt = 0; attempt < 14; attempt++) {
    const s = seedOf(seed, 'safe', attempt);
    const pos = riichiPosition(s);
    if (!pos) continue;
    const { game, opp } = pos;
    const rng = new Rng(s);
    const read = readOpponent(game, opp);
    const safes = safeSets(game, opp);
    const unseen = unseenCounts(game, 0);
    const kinds = [...new Set(game.players[0].hand.map((t) => t.kind))].filter((k) => k < KIND_COUNT);
    const graded = kinds.map((k) => ({ k, d: tileDanger(game, k, read, safes, unseen, 'full') })).map((x) => ({ ...x, s: safetyOf(x.d) }));
    const safe = graded.filter((x) => x.s === 'safe');
    const risky = graded.filter((x) => x.s === 'risky');
    const pickSafe = safe.length && (!risky.length || rng.next() < 0.5);
    const q = pickSafe ? safe[rng.int(safe.length)] : risky.length ? risky[rng.int(risky.length)] : null;
    if (!q) continue;
    const who = game.players[opp].name;
    const p = game.players[opp];
    const answer = q.s === 'safe';
    const extra = answer ? '' : ` ${tr('They haven’t thrown it, and nothing since their riichi rules it out, so it could finish their wait.')}`;
    return {
      id: drillId('safe', 'riichi', seed),
      type: 'safe',
      seed,
      variation: 'riichi',
      prompt: tr('{name} has declared riichi. Is the {tile} safe to discard?', { name: who, tile: tileLabel(q.k) }),
      context: tr('Riichi · their discards are below, with the riichi tile marked. A riichi hand can’t win on a tile it has discarded.'),
      focus: q.k,
      pool: { who, tiles: p.discards.map((t) => t.kind), riichiAt: p.riichiDiscard ?? -1, since: [...safes.afterRiichi] },
      pick: 'option',
      options: [
        { label: tr('Safe'), correct: answer },
        { label: tr('Risky'), correct: !answer },
      ],
      explanation: `${safetySentence(q.k, q.d).replace(' against them', ` against ${who}`)}${extra}`,
    };
  }
  throw new Error('no safe drill');
}

// ------------------------------------------------------------ count the hand

/** Score items that depend on things the drill can't show (hidden dora, the last tile, a replacement draw...): named in the context. */
const HIDDEN_ITEM = /ura|ippatsu|haitei|houtei|rinshan|chankan|rob|last tile|replacement|moon|plum|heaven|earth|red five|aka|bonus counter|honba/i;

function valueDrill(seed: number, variation: string): Drill {
  const v = VALUE_VARIATIONS.includes(variation) && getProfile(variation) ? variation : 'classic';
  for (let attempt = 0; attempt < 12; attempt++) {
    const s = seedOf(seed, 'value', v, attempt);
    const profile = buildProfile(v, 'oneHand');
    const names = ['You', 'Mei', 'Rex', 'Hiro'].slice(0, profile.players);
    const game = new MahjongGame(profile, names, s);
    const ais = names.map((_, i) => new AiPlayer(i, 'strategic', i % 2 ? 'gambler' : 'zen', s + i * 101));
    game.startHand(s);
    if (!playHandHeadless(game, ais)) continue;
    const ph = game.state.phase;
    if (ph.kind !== 'handOver' || ph.result.type !== 'win' || !ph.result.score || ph.result.winner === undefined) continue;
    const r = ph.result;
    const sc = r.score!;
    if (!sc.items.length) continue;
    // Extras the tiles can't show (ura dora, the last tile, a red five...) are named in the context.
    const hidden = [...new Set(sc.items.filter((i) => HIDDEN_ITEM.test(i.name)).map((i) => i.name))];
    const winner = r.winner!;
    const unit = sc.unit;
    const rng = new Rng(s);
    const val = sc.value;
    const least = Math.max(profile.minValue, profile.riichi ? 1 : 0);
    const pool = [val - 2, val - 1, val + 1, val + 2, val + 3].filter((x) => x >= least && x !== val);
    const opts = [val, ...shuffle(rng, pool).slice(0, 3)].sort((a, b) => a - b);
    const sum = sc.items.reduce((a, i) => a + i.value, 0);
    const parts = sc.items.map((i) => `${i.name} ${i.value}`).join(' + ');
    const capped = sum !== val ? ` ${tr(sc.limit ? 'That comes to {sum}, and the hand counts {val} at the limit.' : 'That comes to {sum}, and the hand counts {val}.', { sum, val })}` : '';
    const winTile = r.winTile?.kind;
    const hand = (r.revealedHand ?? game.players[winner].hand).map((t) => t.kind).filter((k) => k < KIND_COUNT);
    const melds = (r.revealedMelds ?? game.players[winner].melds).map((m) => m.tiles.map((t) => t.kind));
    const wind = (w: Wind) => tr(WIND_NAMES[w]);
    return {
      id: drillId('value', v, seed),
      type: 'value',
      seed,
      variation: v,
      prompt: tr('How many {unit} is this winning hand worth?', { unit: tr(unit) }),
      context: `${profile.name} · ${r.discarder === null ? tr('won by self-draw') : tr('won on a discard')}${game.players[winner].riichi ? ` ${tr('after declaring riichi')}` : ''}${winner === game.dealer ? ` · ${tr('dealer')}` : ''} · ${tr('seat wind {seat}, round wind {round}', { seat: wind(game.state.seatWinds[winner]), round: wind(game.prevailing) })}${hidden.length ? ` · ${tr('it also counts {items}', { items: hidden.join(', ') })}` : ''}`,
      hand: hand.sort((a, b) => a - b),
      melds,
      winTile,
      dora: profile.riichi ? game.doraKinds() : undefined,
      flowers: game.players[winner].flowers.map((t) => t.kind),
      pick: 'option',
      options: opts.map((x) => ({ label: `${x} ${tr(unit)}`, correct: x === val })),
      explanation: `${val} ${tr(unit)}: ${parts}.${capped}`,
    };
  }
  throw new Error('no value drill');
}

// ------------------------------------------------------------ entry point

/** Build the drill of a type from its seed. Deterministic: the same seed gives the same drill. */
export function makeDrill(type: DrillType, seed: number, variation = 'classic'): Drill {
  switch (type) {
    case 'name':
      return nameDrill(seed);
    case 'wait':
      return waitDrill(seed);
    case 'discard':
      return discardDrill(seed, variation);
    case 'safe':
      return safeDrill(seed);
    case 'value':
      return valueDrill(seed, variation);
  }
}

/** Was this answer right? `answer` is an option index, or a tile kind for 'tile' drills. */
export function isRight(d: Drill, answer: number): boolean {
  if (d.pick === 'tile') return !!d.correctTiles?.includes(answer);
  return !!d.options[answer]?.correct;
}
