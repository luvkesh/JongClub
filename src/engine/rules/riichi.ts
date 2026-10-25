// Japanese Riichi Mahjong. 136 tiles, 13-tile hands, a 14-tile dead wall
// with dora indicators, riichi declarations, furiten, and scoring in han
// and fu. Every win needs at least one yaku; dora alone never qualifies.
// Based on the widely used modern rules (open tanyao allowed, three red fives
// by default, no kiriage mangan, double yakuman counted as two). Abortive
// draws (nine terminals, four winds, four kongs, four riichi, triple ron) and
// nagashi mangan are played as in most clubs and online rooms; each is a house
// rule, since leagues such as the WRC and EMA leave some or all of them out.
// Thirteen orphans may rob a concealed kong. Two players winning on one tile:
// head bump (the first in turn order wins).

import type { Decomposition } from '../hand';
import { KIND_COUNT, isDragon, isHonor, isSuited, isTerminal, isTerminalOrHonor, isWind, suitOf, windKind } from '../tiles';
import type { AbortiveRules, HandScore, Payment, RuleProfile, ScoreItem, ScoringContext } from './types';

type SetKind = 'chow' | 'pung' | 'kong';
interface HandSet {
  type: SetKind;
  kind: number;
  open: boolean;
}

const roundUp100 = (n: number) => Math.ceil(n / 100) * 100;
const roundUp10 = (n: number) => Math.ceil(n / 10) * 10;
const GREEN = new Set([19, 20, 21, 23, 25, 32]); // 2,3,4,6,8 bamboo + green dragon
const NORTH = 30;

/** Abortive draws as the house rules set them (choices include defaults). */
export function abortiveFrom(c: Record<string, string>): AbortiveRules {
  const on = c.abortive !== 'off';
  return { nineTerminals: on, fourWinds: on, fourKongs: on, fourRiichi: on, tripleRon: c.tripleRon !== 'headBump' };
}

/** The Riichi draw house rules, shared with three-player Riichi. */
export const RIICHI_DRAW_RULES: RuleProfile['houseRules'] = [
  {
    id: 'abortive',
    label: 'Abortive draws',
    options: [
      { value: 'on', label: 'Played: nine terminals, four winds, four kongs, four riichi' },
      { value: 'off', label: 'Not played: the hand goes on' },
    ],
    default: 'on',
  },
  {
    id: 'tripleRon',
    label: 'Three players win on one tile',
    options: [
      { value: 'abortive', label: 'Abortive draw (sanchahou)' },
      { value: 'headBump', label: 'Head bump: first in turn wins' },
    ],
    default: 'abortive',
  },
  {
    id: 'nagashi',
    label: 'Nagashi mangan',
    options: [
      { value: 'on', label: 'Paid as a mangan' },
      { value: 'off', label: 'Not played' },
    ],
    default: 'on',
  },
];

/** Dora indicator → dora: next in suit (9→1), winds E→S→W→N→E, dragons White→Green→Red→White. */
export function doraFromIndicator(k: number): number {
  if (k < 27) return k - (k % 9) + ((k % 9) + 1) % 9;
  if (k <= 30) return 27 + ((k - 27 + 1) % 4);
  return { 33: 32, 32: 31, 31: 33 }[k as 31 | 32 | 33];
}

function tierOf(han: number, base: number, yakuman: number): { base: number; tier?: string } {
  if (yakuman) return { base: 8000 * yakuman, tier: yakuman > 1 ? `${yakuman}× Yakuman` : 'Yakuman' };
  if (han >= 13) return { base: 8000, tier: 'Counted Yakuman' };
  if (han >= 11) return { base: 6000, tier: 'Sanbaiman' };
  if (han >= 8) return { base: 4000, tier: 'Baiman' };
  if (han >= 6) return { base: 3000, tier: 'Haneman' };
  if (han >= 5 || base >= 2000) return { base: 2000, tier: 'Mangan' };
  return { base };
}

function score(ctx: ScoringContext): HandScore {
  const closed = ctx.melds.every((m) => m.concealed);
  const d = ctx.decomposition;

  // All tiles, for dora and colour checks.
  const all: number[] = [];
  for (let k = 0; k < KIND_COUNT; k++) for (let i = 0; i < ctx.concealedCounts[k]; i++) all.push(k);
  for (const m of ctx.melds) for (const t of m.tiles) all.push(t.kind);

  // Try every placement of the winning tile; keep the most valuable reading.
  const placements = d.shape === 'standard' ? placementsFor(d, ctx.winKind) : [null];
  let best: HandScore | null = null;
  for (const place of placements) {
    const s = scoreReading(ctx, d, place, closed, all);
    if (!best || (s.qualifies && !best.qualifies) || (s.qualifies === best.qualifies && s.points > best.points)) best = s;
  }
  return best!;
}

/** Where the winning tile can sit: index into sets, or 'pair'. */
function placementsFor(d: Decomposition, win: number): (number | 'pair')[] {
  const out: (number | 'pair')[] = [];
  d.sets.forEach((s, i) => {
    if (s.type === 'pung' && s.kind === win) out.push(i);
    if (s.type === 'chow' && win >= s.kind && win <= s.kind + 2) out.push(i);
  });
  if (d.pair === win) out.push('pair');
  return out.length ? out : [null as unknown as number];
}

function scoreReading(ctx: ScoringContext, d: Decomposition, place: number | 'pair' | null, closed: boolean, all: number[]): HandScore {
  const yaku: ScoreItem[] = [];
  const add = (name: string, han: number, note?: string) => yaku.push({ name, value: han, note });
  const yakuman: ScoreItem[] = [];
  const ym = (name: string, n = 1) => yakuman.push({ name, value: 13 * n, note: n > 1 ? 'Double yakuman' : 'Yakuman' });

  const seat = windKind(ctx.seatWind);
  const round = windKind(ctx.prevailingWind);
  const tsumo = ctx.selfDrawn;
  const counts = ctx.concealedCounts;

  // ---------------------------------------------------------- special shapes
  if (d.shape === 'thirteenOrphans') {
    ym('Kokushi Musou', counts[ctx.winKind] === 2 ? 2 : 1);
    return finish(ctx, yaku, yakuman, 0, all);
  }

  const sets: HandSet[] = ctx.melds.map((m) => ({ type: m.type, kind: Math.min(...m.tiles.map((t) => t.kind)), open: !m.concealed }));
  d.sets.forEach((s, i) => {
    if (s.type === 'pair') return;
    // A pung completed by someone else's discard counts as open.
    const open = !tsumo && place === i && s.type === 'pung';
    sets.push({ type: s.type, kind: s.kind, open });
  });
  const pungs = sets.filter((s) => s.type !== 'chow');
  const chows = sets.filter((s) => s.type === 'chow');
  const concealedPungs = pungs.filter((s) => !s.open).length;
  const kongs = sets.filter((s) => s.type === 'kong').length;
  const suits = new Set(all.filter(isSuited).map(suitOf));
  const honors = all.some(isHonor);
  const pair = d.pair;

  // ---------------------------------------------------------- yakuman
  if (all.every(isHonor)) ym('Tsuuiisou');
  if (all.every(isTerminal)) ym('Chinroutou');
  if (all.every((k) => GREEN.has(k))) ym('Ryuuiisou');
  if (kongs === 4) ym('Suukantsu');
  if (d.shape === 'standard') {
    const dragonPungs = pungs.filter((s) => isDragon(s.kind)).length;
    const windPungs = pungs.filter((s) => isWind(s.kind)).length;
    if (dragonPungs === 3) ym('Daisangen');
    if (windPungs === 4) ym('Daisuushii', 2);
    else if (windPungs === 3 && isWind(pair)) ym('Shousuushii');
    if (concealedPungs === 4) ym('Suuankou', place === 'pair' ? 2 : 1);
    if (closed && suits.size === 1 && !honors) {
      const base = all.find(isSuited)! - (all.find(isSuited)! % 9);
      const c = Array.from({ length: 9 }, (_, i) => counts[base + i]);
      const need = [3, 1, 1, 1, 1, 1, 1, 1, 3];
      if (c.every((n, i) => n >= need[i])) {
        c[ctx.winKind - base]--;
        ym('Chuuren Poutou', c.every((n, i) => n === need[i]) ? 2 : 1);
      }
    }
  }
  if (yakuman.length) return finish(ctx, yaku, yakuman, 0, all);

  // ---------------------------------------------------------- regular yaku
  if (ctx.doubleRiichi) add('Double Riichi', 2);
  else if (ctx.riichi) add('Riichi', 1);
  if (ctx.riichi && ctx.ippatsu) add('Ippatsu', 1);
  if (closed && tsumo) add('Menzen Tsumo', 1);
  if (all.every((k) => !isTerminalOrHonor(k)) && (closed || ctx.house?.openTanyao !== 'off')) add('Tanyao', 1, 'All simples');

  const valuePair = pair >= 0 && (isDragon(pair) || pair === seat || pair === round);
  const waitType = d.shape === 'standard' ? waitOf(d, place, ctx.winKind) : 'tanki';
  const pinfu = d.shape === 'standard' && closed && pungs.length === 0 && !valuePair && waitType === 'ryanmen';
  if (pinfu) add('Pinfu', 1, 'All sequences, two-sided wait');

  if (d.shape === 'sevenPairs') add('Chiitoitsu', 2, 'Seven pairs');

  if (d.shape === 'standard') {
    for (const p of pungs) {
      if (isDragon(p.kind)) add(`Yakuhai: ${['Chun', 'Hatsu', 'Haku'][p.kind - 31]}`, 1);
      if (p.kind === seat) add('Yakuhai: seat wind', 1);
      if (p.kind === round) add('Yakuhai: round wind', 1);
    }
    // Identical sequences (closed only)
    if (closed) {
      const tally = new Map<number, number>();
      for (const c of chows) tally.set(c.kind, (tally.get(c.kind) ?? 0) + 1);
      const doubles = [...tally.values()].reduce((a, n) => a + Math.floor(n / 2), 0);
      if (doubles >= 2) add('Ryanpeikou', 3);
      else if (doubles === 1) add('Iipeikou', 1);
    }
    const hasChow = (k: number) => chows.some((c) => c.kind === k);
    for (let r = 0; r < 7; r++) if (hasChow(r) && hasChow(r + 9) && hasChow(r + 18)) add('Sanshoku Doujun', closed ? 2 : 1);
    for (const base of [0, 9, 18]) if (hasChow(base) && hasChow(base + 3) && hasChow(base + 6)) add('Ittsu', closed ? 2 : 1, 'Pure straight');
    for (let r = 0; r < 9; r++) if ([r, r + 9, r + 18].every((k) => pungs.some((p) => p.kind === k))) add('Sanshoku Doukou', 2);
    if (pungs.length === 4) add('Toitoi', 2);
    if (concealedPungs === 3) add('Sanankou', 2);
    if (kongs === 3) add('Sankantsu', 2);
    if (pungs.filter((p) => isDragon(p.kind)).length === 2 && isDragon(pair)) add('Shousangen', 2);

    const termSet = (s: HandSet) => (s.type === 'chow' ? isTerminal(s.kind) || isTerminal(s.kind + 2) : isTerminalOrHonor(s.kind));
    const everyGroupTerminal = sets.every(termSet) && isTerminalOrHonor(pair);
    if (all.every(isTerminalOrHonor)) add('Honroutou', 2);
    else if (everyGroupTerminal && chows.length) {
      if (honors) add('Chanta', closed ? 2 : 1);
      else add('Junchan', closed ? 3 : 2);
    }
  } else if (all.every(isTerminalOrHonor)) add('Honroutou', 2);

  if (suits.size === 1 && !honors) add('Chinitsu', closed ? 6 : 5, 'Full flush');
  else if (suits.size === 1) add('Honitsu', closed ? 3 : 2, 'Half flush');

  // A kong replacement is not the last tile of the live wall: Rinshan, never Haitei.
  if (ctx.lastTileOfWall && !(tsumo && ctx.afterKong)) add(tsumo ? 'Haitei' : 'Houtei', 1, 'Last tile');
  if (ctx.afterKong && tsumo) add('Rinshan Kaihou', 1, 'Win on the kong replacement');
  if (ctx.robbedKong && !tsumo) add('Chankan', 1, 'Robbing the kong');

  // ---------------------------------------------------------- fu
  let fu: number;
  if (d.shape === 'sevenPairs') fu = 25;
  else if (pinfu && tsumo) fu = 20;
  else {
    fu = 20;
    if (closed && !tsumo) fu += 10;
    if (tsumo && !pinfu) fu += 2;
    for (const p of pungs) {
      let f = 2;
      if (isTerminalOrHonor(p.kind)) f *= 2;
      if (!p.open) f *= 2;
      if (p.type === 'kong') f *= 4;
      fu += f;
    }
    if (isDragon(pair)) fu += 2;
    if (pair === seat) fu += 2;
    if (pair === round) fu += 2;
    if (waitType !== 'ryanmen' && waitType !== 'shanpon') fu += 2;
    fu = roundUp10(fu);
    if (!closed && fu === 20) fu = 30;
  }
  return finish(ctx, yaku, yakuman, fu, all);
}

type Wait = 'ryanmen' | 'kanchan' | 'penchan' | 'tanki' | 'shanpon';

function waitOf(d: Decomposition, place: number | 'pair' | null, win: number): Wait {
  if (place === 'pair' || place === null) return 'tanki';
  const s = d.sets[place];
  if (s.type === 'pung') return 'shanpon';
  const pos = win - s.kind;
  if (pos === 1) return 'kanchan';
  const r = s.kind % 9;
  if ((pos === 2 && r === 0) || (pos === 0 && r === 6)) return 'penchan';
  return 'ryanmen';
}

function finish(ctx: ScoringContext, yaku: ScoreItem[], yakuman: ScoreItem[], fu: number, all: number[]): HandScore {
  if (yakuman.length) {
    const n = yakuman.reduce((a, y) => a + y.value / 13, 0);
    const t = tierOf(13 * n, 0, n);
    return { value: 13 * n, unit: 'han', items: yakuman, points: payout(ctx.isDealer, t.base), limit: true, qualifies: true, fu: 0, base: t.base, tier: t.tier };
  }
  const qualifies = yaku.length > 0;
  const items = yaku.slice();
  // Sanma: Norths set aside (kita) are bonus dora, and count again if North is dora.
  const kita = (ctx.flowers ?? []).filter((k) => k === NORTH);
  const dora = (kinds: number[] | undefined) => [...all, ...kita].reduce((a, k) => a + (kinds ?? []).filter((x) => x === k).length, 0);
  const nDora = dora(ctx.doraKinds);
  if (nDora) items.push({ name: 'Dora', value: nDora });
  const nUra = ctx.riichi ? dora(ctx.uraDoraKinds) : 0;
  if (nUra) items.push({ name: 'Ura Dora', value: nUra });
  // Red fives count like dora: extra han, never a yaku on their own.
  if (ctx.redFives) items.push({ name: 'Red five', value: ctx.redFives, note: 'Aka dora' });
  if (kita.length) items.push({ name: 'Kita', value: kita.length, note: 'North set aside' });
  const han = items.reduce((a, b) => a + b.value, 0);
  const raw = fu * 2 ** (2 + han);
  const t = tierOf(han, raw, 0);
  return { value: han, unit: 'han', items, points: payout(ctx.isDealer, t.base), limit: !!t.tier, qualifies, fu, base: t.base, tier: t.tier };
}

/** What a ron is worth (also the total of a tsumo, give or take rounding). */
const payout = (dealer: boolean, base: number) => roundUp100(base * (dealer ? 6 : 4));

function payments(winner: number, discarder: number | null, s: HandScore, dealer: number, players: number, honba: number): Payment[] {
  const base = s.base ?? 0;
  const out: Payment[] = [];
  if (discarder !== null) {
    out.push({ from: discarder, to: winner, amount: roundUp100(base * (winner === dealer ? 6 : 4)) + 300 * honba });
    return out;
  }
  for (let p = 0; p < players; p++) {
    if (p === winner) continue;
    const mult = winner === dealer || p === dealer ? 2 : 1;
    out.push({ from: p, to: winner, amount: roundUp100(base * mult) + 100 * honba });
  }
  return out;
}

/** Noten penalty: 3,000 points move from players who aren't ready to those who are. */
function drawPayments(tenpai: boolean[]): Payment[] {
  const ready = tenpai.filter(Boolean).length;
  if (ready === 0 || ready === tenpai.length) return [];
  const out: Payment[] = [];
  const pay = 3000 / (tenpai.length - ready);
  const get = 3000 / ready;
  // Pool through the ready players proportionally.
  tenpai.forEach((t, from) => {
    if (t) return;
    tenpai.forEach((r, to) => r && out.push({ from, to, amount: (pay * get) / 3000 }));
  });
  return out;
}

export const riichiProfile: RuleProfile = {
  discards: 'pond',
  id: 'riichi',
  name: 'Japanese Riichi',
  region: 'Japan',
  flag: '🇯🇵',
  summary: 'Declare riichi, chase dora, mind furiten. Every win needs a yaku.',
  players: 4,
  tileKinds: Array.from({ length: KIND_COUNT }, (_, k) => k),
  copiesPerKind: 4,
  handSize: 13,
  calls: { chow: true, pung: true, exposedKong: true, concealedKong: true, addedKong: true, chowFromLeftOnly: true },
  shapes: { sevenPairs: true, thirteenOrphans: true },
  minValue: 1,
  rounds: {
    prevailingWinds: ['E', 'S'],
    seatWindOrder: ['E', 'S', 'W', 'N'],
    handsPerWind: 4,
    dealerRetention: 'onDealerWinOrTenpai',
    maxHands: 0,
  },
  score,
  payments,
  drawPayments,
  startingScore: 25000,
  deadWall: 14,
  doraFromIndicator,
  riichi: { cost: 1000, minLiveTiles: 4 },
  furiten: true,
  robKong: true,
  kokushiRobsConcealedKong: true,
  abortiveDraws: abortiveFrom({}),
  nagashiMangan: true,
  redFives: 3,
  endOnBust: true,
  callNames: { chow: 'Chi', pung: 'Pon', kong: 'Kan', win: 'Ron', selfDraw: 'Tsumo', riichi: 'Riichi' },
  yakuRequired: true,
  felt: '#1b2a44',
  tableName: 'Tokyo Night',
  houseRules: [
    {
      id: 'openTanyao',
      label: 'Open tanyao (kuitan)',
      options: [
        { value: 'on', label: 'Allowed' },
        { value: 'off', label: 'Closed hands only' },
      ],
      default: 'on',
    },
    {
      id: 'redFives',
      label: 'Red fives (aka dora)',
      options: [
        { value: '0', label: 'None' },
        { value: '3', label: 'Three (5m, 5p, 5s)' },
        { value: '4', label: 'Four (two 5p)' },
      ],
      default: '3',
    },
    ...RIICHI_DRAW_RULES,
  ],
  configure(c) {
    return { redFives: c.redFives === undefined ? 3 : Number(c.redFives), abortiveDraws: abortiveFrom(c), nagashiMangan: c.nagashi !== 'off' };
  },
};

export { score as riichiScore, payments as riichiPayments, roundUp100 };
