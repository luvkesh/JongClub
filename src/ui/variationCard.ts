// The visual half of a variation's panel (Variations / World Tour): the game at a glance as
// pictures instead of paragraphs. Four engraved numbers (players, tiles in hand, tiles in the set,
// what it takes to win), a real winning hand drawn with the shared tiles, the special tiles,
// the call words as chips with their tiles, and a little table showing who pays.
//
// Everything is read from the variation's rule profile, so all 31 games stay true to the rules
// the table actually plays. The written rules stay one tap away under "All the details".

import './variationCard.css';
import type { RuleProfile } from '../engine/rules/types';
import { ANIMAL_BASE, FLOWER_BASE, JOKER_KIND, isAnimal, isTypedJoker, kindOfTileId } from '../engine/tiles';
import { h, tileImg } from './dom';
import { icon } from './icons';
import { guideFor } from './scoringGuideData';
import { tr } from '../i18n';

interface T {
  k: number;
  red?: boolean;
  /** The tile the picture is about (the winning tile, the wild). */
  glow?: boolean;
}
interface Group {
  tiles: T[];
  label: string;
}

const t = (k: number, o: Partial<T> = {}): T => ({ k, ...o });
const run = (base: number, start: number): T[] => [t(base + start), t(base + start + 1), t(base + start + 2)];
const same = (k: number, n: number): T[] => Array.from({ length: n }, () => t(k));
const seedOf = (id: string) => [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

/** A tile drawn with the one shared tile rendering. */
function tile(x: T, cls = ''): HTMLElement {
  const img = tileImg(x.k, `vc-tile ${cls}`, true, !!x.red);
  if (!x.glow) return img;
  return h('span', { class: 'vc-glow' }, img);
}

/** One section: a short engraved heading over a single gold rule. */
function section(cls: string, ico: string, title: string, ...body: (Node | null)[]): HTMLElement {
  return h('section', { class: `vc-sec ${cls}` }, h('h4', { class: 'vc-h' }, h('span', { class: 'vc-h-ico', html: icon(ico) }), h('span', {}, title)), h('span', { class: 'vc-rule', 'aria-hidden': 'true' }), ...body);
}

/** A believable winning hand for this table, built from the tiles its set really has. */
export function sampleHand(id: string, p: RuleProfile): Group[] {
  const names = p.callNames;
  const has = new Set(p.tileKinds);
  const full = (b: number) => [0, 1, 2, 3, 4, 5, 6, 7, 8].every((r) => has.has(b + r));
  let suits = [9, 18, 0].filter(full);
  if (!suits.length) suits = [9];
  if (p.missingSuit) suits = suits.slice(0, 2);
  const s = (i: number) => suits[i % suits.length];
  const dragons = [31, 32].filter((k) => has.has(k));
  const winds = [27, 28, 29, 30].filter((k) => has.has(k));
  const seed = seedOf(id);
  const pair = (k: number): Group => {
    const tiles = same(k, 2);
    tiles[1] = { ...tiles[1], glow: true };
    return { tiles, label: tr('Pair') };
  };
  const chow = (tiles: T[]): Group => ({ tiles, label: names.chow });
  const pung = (k: number, n = 3): Group => ({ tiles: same(k, n), label: n === 4 ? names.kong : names.pung });

  // American plays from the card: a real 2468 hand, with a joker in a kong.
  if (p.card) {
    const kong = same(19, 4);
    kong[3] = t(JOKER_KIND);
    const last = same(25, 4);
    last[3] = { ...last[3], glow: true };
    return [
      { tiles: [t(FLOWER_BASE), t(FLOWER_BASE + 4)], label: tr('Pair') },
      { tiles: kong, label: names.kong },
      { tiles: same(3, 2), label: tr('Pair') },
      { tiles: same(5, 2), label: tr('Pair') },
      { tiles: last, label: names.kong },
    ];
  }
  // India Rules: its own sets, a mixed chow and a crochet, next to the usual ones.
  if (p.mixedSets || id === 'india') {
    return [chow(run(9, 1)), { tiles: [t(2), t(12), t(22)], label: tr('Mixed chow') }, { tiles: [t(6), t(15), t(24)], label: tr('Crochet') }, pung(31), pair(27)];
  }

  const out: Group[] = [];
  // Red fives: the first run shows one.
  const first = run(s(0), p.redFives ? 3 : seed % 3);
  if (p.redFives && s(0) !== 0) first[1] = { ...first[1], red: true };
  out.push(chow(first));
  out.push(pung(dragons.length ? dragons[seed % dragons.length] : s(1) + ((seed >>> 3) % 9)));
  out.push(chow(run(s(1), 3 + ((seed >>> 2) % 3))));
  out.push(winds.length ? pung(winds[(seed >>> 4) % winds.length]) : pung(s(0) + 7 + ((seed >>> 4) % 2)));
  if (p.handSize >= 16) out.push(chow(run(s(2), (seed >>> 6) % 2 ? 0 : 6)));
  // The pair: a tile no set above has used up.
  const used = new Map<number, number>();
  for (const g of out) for (const x of g.tiles) used.set(x.k, (used.get(x.k) ?? 0) + 1);
  const pairs = [s(2) + 1 + ((seed >>> 7) % 7), s(0) + 8, s(1), ...suits.flatMap((b) => [0, 1, 2, 3, 4, 5, 6, 7, 8].map((r) => b + r))];
  out.push(pair(pairs.find((k) => has.has(k) && (used.get(k) ?? 0) <= 2) ?? s(0)));
  return out;
}

interface Special {
  tiles: (T | 'arrow')[];
  label: string;
}

/** The tiles that make this table different: flowers, jokers, animals, red fives, dora, wilds. */
export function specialTiles(p: RuleProfile): Special[] {
  const out: Special[] = [];
  const extra = [...new Set((p.extraTiles ?? []).map(kindOfTileId))];
  const typed = extra.filter(isTypedJoker);
  if (p.jokers || typed.length) out.push({ tiles: [...(p.jokers ? [t(JOKER_KIND)] : []), ...typed.map((k) => t(k))].slice(0, 4), label: tr('Jokers') });
  if (p.flowers) out.push({ tiles: [t(FLOWER_BASE), t(FLOWER_BASE + 4)], label: tr('Flowers') });
  if (extra.some(isAnimal)) out.push({ tiles: [0, 1, 2, 3].map((i) => t(ANIMAL_BASE + i)), label: tr('Animals') });
  if (p.redFives) out.push({ tiles: [t(13, { red: true })], label: tr('Red fives') });
  if (p.doraFromIndicator) out.push({ tiles: [t(20), 'arrow', t(21, { glow: true })], label: tr('Dora') });
  if (p.nukiDora) out.push({ tiles: [t(30, { glow: true })], label: 'Kita' });
  const w = p.naturalWild;
  if (w) {
    const label = `${w.name} · ${tr('Wild')}`;
    if (w.pick === 'next') out.push({ tiles: [t(22), 'arrow', t(23, { glow: true })], label });
    else if (w.pick === 'same') out.push({ tiles: [t(23, { glow: true })], label });
    else out.push({ tiles: [t(w.pick, { glow: true })], label });
  }
  return out;
}

/** A riichi stick, drawn. */
const STICK = '<svg class="vc-stick" viewBox="0 0 14 60" aria-hidden="true"><defs><linearGradient id="vc-stick-g" x1="0" x2="1"><stop offset="0" stop-color="#d9d2c2"/><stop offset=".5" stop-color="#fffdf7"/><stop offset="1" stop-color="#cfc7b5"/></linearGradient></defs><rect x="2" y="1" width="10" height="58" rx="5" fill="url(#vc-stick-g)" stroke="rgba(0,0,0,.35)"/><circle cx="7" cy="30" r="3.2" fill="#b3242a"/></svg>';

/** The call words, each with the tiles it makes. A call this table forbids is shown struck out. */
function callChips(p: RuleProfile): HTMLElement {
  const n = p.callNames;
  const has = new Set(p.tileKinds);
  const pick = (...ks: number[]) => ks.find((k) => has.has(k)) ?? p.tileKinds[0];
  const runBase = [18, 9, 0].find((b) => [2, 3, 4].every((r) => has.has(b + r))) ?? 9;
  const chips: HTMLElement[] = [];
  const chip = (name: string, tiles: (HTMLElement | string)[], off = false, note = '') =>
    h(
      'li',
      { class: `vc-call${off ? ' off' : ''}`, title: off ? tr('Not called at this table') : note || null },
      h('span', { class: 'vc-call-tiles', 'aria-hidden': 'true' }, ...tiles.map((x) => (typeof x === 'string' ? h('span', { class: 'vc-call-ico', html: x }) : x))),
      h('span', { class: 'vc-call-n' }, name),
    );
  chips.push(chip(n.chow, run(runBase, 2).map((x) => tile(x, 'sm')), !p.calls.chow));
  chips.push(chip(n.pung, same(pick(6, 15, 24), 3).map((x) => tile(x, 'sm')), !p.calls.pung));
  chips.push(chip(n.kong, same(pick(32, 31, 16), 4).map((x) => tile(x, 'sm')), !p.calls.exposedKong && !p.calls.concealedKong));
  if (n.riichi) chips.push(chip(n.riichi, [STICK]));
  chips.push(chip(n.win, [tile(t(pick(29, 27, 4), { glow: true }), 'sm'), icon('trophy')], false, tr('Win on a discard')));
  if (n.selfDraw && n.selfDraw !== n.win) chips.push(chip(n.selfDraw, [icon('draw'), tile(t(pick(14, 5, 23), { glow: true }), 'sm')], false, tr('Self-draw')));
  return h('ul', { class: 'vc-calls' }, ...chips);
}

/** Seat positions on the little table: you (the winner) at the bottom. */
const SEAT_XY: Record<number, [number, number][]> = {
  4: [[60, 108], [108, 60], [60, 12], [12, 60]],
  3: [[60, 108], [108, 60], [12, 60]],
};

/** Who pays the winner, drawn: arrows from each payer, thicker for a bigger share. */
function payTable(p: RuleProfile, discarder: number | null): HTMLElement {
  const seats = p.players === 3 ? 3 : 4;
  const xy = SEAT_XY[seats];
  const score = { value: Math.max(p.minValue, 3), unit: '', items: [], points: 16, limit: false, base: 400, fu: 30 };
  let pays: { from: number; amount: number }[] = [];
  try {
    // The winner deals, so the dealer's bonus scales every share alike and the shape stays true.
    pays = p.payments(0, discarder, score, 0, seats, 0).filter((x) => x.to === 0 && x.amount > 0);
  } catch {
    pays = [];
  }
  const max = Math.max(1, ...pays.map((x) => x.amount));
  const min = Math.min(...pays.map((x) => x.amount));
  const ratios = pays.length > 1 && pays.some((x) => x.amount !== min);
  const [wx, wy] = xy[0];
  const arrows = pays
    .map(({ from, amount }) => {
      const [x, y] = xy[from];
      const dx = wx - x;
      const dy = wy - y;
      const len = Math.hypot(dx, dy);
      const ux = dx / len;
      const uy = dy / len;
      const x1 = x + ux * 14;
      const y1 = y + uy * 14;
      const x2 = wx - ux * 17;
      const y2 = wy - uy * 17;
      const w = 1.6 + 3.4 * (amount / max);
      const label = ratios ? `×${Math.round((amount / min) * 10) / 10}` : '';
      // The share sits just outside the payer's seat, away from the table.
      const ox = x - 60;
      const oy = y - 60;
      const ol = Math.hypot(ox, oy) || 1;
      const mx = y === 60 ? x + (ox / ol) * 2 : x + 17;
      const my = y === 60 ? y - 15 : y - 1;
      return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke-width="${w.toFixed(1)}" class="vc-arrow" marker-end="url(#vc-head)"/>${label ? `<text x="${mx.toFixed(1)}" y="${(my + 3).toFixed(1)}" class="vc-share">${label}</text>` : ''}`;
    })
    .join('');
  const seatsSvg = xy
    .map(([x, y], i) => {
      if (i === 0) return `<circle cx="${x}" cy="${y}" r="11" class="vc-seat win"/><path transform="translate(${x - 6} ${y - 6}) scale(.5)" class="vc-star" d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>`;
      const pays_ = pays.some((x) => x.from === i);
      const disc = i === discarder;
      return `<circle cx="${x}" cy="${y}" r="9.5" class="vc-seat${pays_ ? ' pays' : ''}${disc ? ' disc' : ''}"/>${disc ? `<rect x="${x - 4}" y="${y - 5.5}" width="8" height="11" rx="1.6" class="vc-disc-tile"/>` : ''}`;
    })
    .join('');
  const svg = `<svg viewBox="-4 -4 128 128" class="vc-pay-svg" role="img" aria-label="${discarder === null ? tr('Self-draw') : tr('Win on a discard')}"><defs><marker id="vc-head" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="vc-head"/></marker><linearGradient id="vc-felt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1d4a39"/><stop offset="1" stop-color="#0d2a20"/></linearGradient></defs><rect x="30" y="30" width="60" height="60" rx="9" class="vc-felt"/>${arrows}${seatsSvg}</svg>`;
  return h('figure', { class: 'vc-pay' }, h('div', { class: 'vc-pay-pic', html: svg }), h('figcaption', {}, discarder === null ? tr('Self-draw') : tr('Win on a discard')));
}

/** The four engraved numbers at the top. */
function stats(p: RuleProfile): HTMLElement {
  const unit = guideFor(p).unit;
  const total = p.tileKinds.length * p.copiesPerKind + (p.flowers ? 8 : 0) + (p.jokers ?? 0) + (p.extraTiles?.length ?? 0);
  const stat = (ico: string, value: string, sub: string, label: string) =>
    h('li', { class: 'vc-stat' }, h('span', { class: 'vc-stat-ico', html: icon(ico) }), h('span', { class: 'vc-stat-v' }, value, sub ? h('small', {}, sub) : null), h('span', { class: 'vc-stat-l' }, label));
  const win = p.card ? stat('card', tr('Card'), '', tr('To win')) : p.minValue > 0 ? stat('trophy', String(p.minValue), unit, tr('To win')) : stat('trophy', tr('Any'), '', tr('To win'));
  return h('ul', { class: 'vc-stats' }, stat('people', String(p.players), '', tr('Players')), stat('hand', String(p.handSize), '', tr('Tiles in hand')), stat('wall', String(total), '', tr('Tile set')), win);
}

/** The whole visual summary for a playable variation. */
export function variationVisuals(id: string, p: RuleProfile): HTMLElement {
  const hand = sampleHand(id, p);
  const special = specialTiles(p);
  return h(
    'div',
    { class: 'vc' },
    stats(p),
    section(
      'vc-hand-sec',
      'tile',
      tr('A winning hand'),
      h(
        'div',
        { class: 'vc-hand', role: 'img', 'aria-label': hand.map((g) => g.label).join(', ') },
        ...hand.map((g) => h('div', { class: 'vc-group' }, h('div', { class: 'vc-group-tiles' }, ...g.tiles.map((x) => tile(x))), h('span', { class: 'vc-group-l' }, g.label))),
      ),
    ),
    h(
      'div',
      { class: 'vc-pair-row' },
      section(
        'vc-special-sec',
        'star',
        tr('Special tiles'),
        special.length
          ? h('ul', { class: 'vc-special' }, ...special.map((s) => h('li', {}, h('span', { class: 'vc-special-tiles' }, ...s.tiles.map((x) => (x === 'arrow' ? h('span', { class: 'vc-arrow-ico', html: icon('arrowRight') }) : tile(x)))), h('span', { class: 'vc-special-l' }, s.label))))
          : h('p', { class: 'vc-none' }, h('span', { html: icon('check') }), tr('None. Just the essentials')),
      ),
      section('vc-pay-sec', 'coins', tr('Who pays'), h('div', { class: 'vc-pays' }, payTable(p, 2), payTable(p, null))),
    ),
    section('vc-calls-sec', 'broadcast', tr('Calls'), callChips(p)),
  );
}
