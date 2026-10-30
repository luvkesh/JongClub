// Picture panels for Academy scenes (lessonKit Visual): a hand broken into its
// sets with the score worked out beside it, a comparison table, a list of
// points with tiles, illustrated cards, and moving demos of the table
// rituals (washing, building the wall, a turn, a call, the Charleston).
// Everything is drawn from real tile faces, so it follows the equipped set.
// Labels are lesson text: English, through lt() like the rest of a lesson.

import { smallCardView } from './smallCard';
import { cardByName } from '../engine/rules/indiaCards';
import { parseKinds } from '../engine/tiles';
import { lt } from '../i18n/lessons';
import { h, tileImg } from './dom';
import type { CardPic, Cell, DemoKind, HandPic, ListItem, TablePic } from './lessonKit';

const tiles = (spec: string, labels: boolean, cls = '') => parseKinds(spec).map((k) => tileImg(k, cls, labels));

/** A winning hand: its sets with labels, what happened, the score and who pays. */
export function handPic(p: HandPic, labels: boolean): HTMLElement {
  const groups = h(
    'div',
    { class: 'hp-groups' },
    ...p.groups.map((g) =>
      h(
        'figure',
        { class: `hp-group ${g.mark ?? ''}` },
        g.flag ? h('span', { class: 'hp-flag' }, lt(g.flag)) : null,
        h('div', { class: 'hp-tiles' }, ...tiles(g.tiles, labels)),
        g.label ? h('figcaption', {}, h('b', {}, lt(g.label)), g.sub ? h('span', {}, lt(g.sub)) : null) : null,
      ),
    ),
  );
  const facts = p.facts?.length ? h('ul', { class: 'hp-facts' }, ...p.facts.map((f) => h('li', {}, lt(f)))) : null;
  const score = p.faan
    ? h(
        'div',
        { class: 'hp-panel hp-score' },
        h('p', { class: 'hp-k' }, lt(p.scoreTitle ?? 'How it scores')),
        p.faan.length
          ? h('ul', { class: 'hp-checks' }, ...p.faan.map(([label, n]) => h('li', {}, h('i', { 'aria-hidden': 'true' }), h('span', {}, lt(label)), h('b', {}, typeof n === 'number' ? `+${n}` : lt(n)))))
          : h('p', { class: 'hp-none' }, lt(p.none ?? 'Nothing extra to count')),
        p.total ? h('p', { class: 'hp-total' }, lt(p.total)) : null,
      )
    : null;
  const pay = p.pay
    ? h(
        'div',
        { class: 'hp-panel hp-pay' },
        h('p', { class: 'hp-k' }, lt('Who pays')),
        h(
          'ul',
          { class: 'hp-payers' },
          ...p.pay.map((x) => h('li', { class: x.big ? 'big' : '' }, h('span', { class: 'hp-av', 'aria-hidden': 'true' }), h('span', { class: 'hp-who' }, lt(x.who)), h('b', {}, lt(x.amount)))),
        ),
        p.winner ? h('p', { class: 'hp-win' }, h('span', { class: 'hp-av you', 'aria-hidden': 'true' }), lt(p.winner)) : null,
      )
    : null;
  return h(
    'div',
    { class: 'lesson-pic hand-pic' },
    p.title ? h('p', { class: 'lp-title' }, lt(p.title)) : null,
    p.card && cardByName(p.card) ? h('div', { class: 'hp-with-card' }, smallCardView(cardByName(p.card)!), groups) : groups,
    facts,
    score || pay ? h('div', { class: 'hp-panels' }, score, pay) : null,
  );
}

const cell = (c: Cell, labels: boolean, th = false) => {
  const kids = typeof c === 'string' ? [lt(c)] : [c.tiles ? h('span', { class: 'lt-tiles' }, ...tiles(c.tiles, labels, 'mini')) : null, c.text ? h('span', {}, lt(c.text)) : null];
  // One wrapper, so a phone's label-and-value card keeps tiles and words together.
  return h(th ? 'th' : 'td', { scope: th ? 'row' : null }, typeof c === 'string' ? kids[0] : h('span', { class: 'lt-cell' }, ...kids));
};

const withKey = (el: HTMLElement, k: string) => (el.setAttribute('data-k', k), el);

/** A comparison table; the first column names each row. On phones each row becomes a small card. */
export function tablePic(t: TablePic, labels: boolean): HTMLElement {
  return h(
    'div',
    { class: 'lesson-pic table-pic' },
    t.title ? h('p', { class: 'lp-title' }, lt(t.title)) : null,
    h(
      'table',
      { class: 'lt-table' },
      h('thead', {}, h('tr', {}, ...t.head.map((x) => h('th', { scope: 'col' }, lt(x))))),
      h('tbody', {}, ...t.rows.map((r) => h('tr', {}, ...r.map((c, i) => withKey(cell(c, labels, i === 0), lt(t.head[i] ?? '')))))),
    ),
  );
}

/** Points in a list, each with its own tiles. */
export function listPic(items: ListItem[], labels: boolean, title?: string): HTMLElement {
  return h(
    'div',
    { class: 'lesson-pic list-pic' },
    title ? h('p', { class: 'lp-title' }, lt(title)) : null,
    h(
      'ul',
      { class: 'll-items' },
      ...items.map((x) =>
        h(
          'li',
          { class: x.tiles ? '' : 'plain' },
          x.tiles ? h('span', { class: 'll-tiles' }, ...tiles(x.tiles, labels)) : h('i', { class: 'll-dot', 'aria-hidden': 'true' }),
          h('span', { class: 'll-text' }, x.title ? h('b', {}, lt(x.title)) : null, x.text ? h('span', {}, lt(x.text)) : null),
        ),
      ),
    ),
  );
}

/** Illustrated cards side by side: tiles, a name, a line or two. */
export function cardsPic(cards: CardPic[], labels: boolean): HTMLElement {
  return h(
    'div',
    { class: `lesson-pic cards-pic n${cards.length}` },
    ...cards.map((c) =>
      h(
        'div',
        { class: 'lc-card' },
        c.tiles ? h('div', { class: 'lc-tiles' }, ...tiles(c.tiles, labels)) : null,
        h('p', { class: 'lc-t' }, lt(c.title)),
        c.alt ? h('p', { class: 'lc-alt' }, lt(c.alt)) : null,
        c.text ? h('p', { class: 'lc-d' }, lt(c.text)) : null,
      ),
    ),
  );
}

// ------------------------------------------------------------ moving demos

const back = (cls = '') => h('span', { class: `tback ${cls}`, 'aria-hidden': 'true' });

// Timed demos (Tic-Tac-Toe, wall exchange): many tiles on one looping timeline, so they run on
// the Web Animations API with keyframes placed in seconds. Positions are % of the frame.
type At = [number, Keyframe];
type Pos = [number, number];
const SEAT_AT: Record<string, Pos> = { E: [50, 89], S: [93, 50], W: [50, 11], N: [7, 50] };
/** Where three tiles lie in front of a player, beside their seat badge. */
const SLOTS: Record<string, Pos[]> = {
  E: [[60, 82], [66, 82], [72, 82]],
  S: [[86, 64], [86, 72], [86, 80]],
  W: [[60, 13], [66, 13], [72, 13]],
  N: [[14, 64], [14, 72], [14, 80]],
};
const xy = ([x, y]: Pos): Keyframe => ({ left: `${x}%`, top: `${y}%` });
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
/** One looping timeline: each element gets keyframes at times in seconds within a loop of `L` seconds. */
function timeline(stage: HTMLElement, L: number) {
  const jobs: [Element, At[]][] = [];
  const run = () => {
    if (!stage.isConnected) return void requestAnimationFrame(run);
    if (reduced()) return;
    for (const [el, at] of jobs) {
      const kf = at.map(([t, k]) => ({ easing: 'ease-in-out', ...k, offset: Math.min(1, Math.max(0, t / L)) }));
      if (kf[0].offset !== 0) kf.unshift({ ...kf[0], offset: 0 });
      if (kf[kf.length - 1].offset !== 1) kf.push({ ...kf[kf.length - 1], offset: 1 });
      el.animate(kf, { duration: L * 1000, iterations: Infinity });
    }
  };
  requestAnimationFrame(run);
  return (el: Element, at: At[]) => void jobs.push([el, at]);
}
/** A face-down tile placed by its centre. */
const piece = (at: Pos, cls = '') => {
  const t = back(`xt ${cls}`);
  Object.assign(t.style, xy(at));
  return t;
};

/** A short looping animation of a table ritual, with its steps named underneath. */
export function demoPic(kind: DemoKind, labels: boolean): HTMLElement {
  const stage = h('div', { class: `demo-stage demo-${kind}`, 'aria-hidden': 'true' });
  const steps: string[] = [];
  /** Timed demos name when each step is on, in seconds of a loop of `loop` seconds. */
  let timedSteps: [number, number][] = [];
  let loop = 0;
  const seat = (w: string, pos: string) => h('span', { class: `demo-seat ${pos}` }, w);
  const seats = () => [seat('W', 'top'), seat('N', 'left'), seat('S', 'right'), seat('E', 'bottom')];
  if (kind === 'wash') {
    // Face-down tiles swirling in the middle, pushed by two hands.
    for (let i = 0; i < 24; i++) {
      const t = back(`sw sw${i % 6}`);
      t.style.setProperty('--i', String(i));
      stage.append(t);
    }
    stage.append(h('span', { class: 'demo-hand l' }), h('span', { class: 'demo-hand r' }));
    steps.push('Turn every tile face down', 'Swirl them with both hands', 'Nobody can track a tile');
  } else if (kind === 'wall') {
    // Four rows of face-down tiles, two high, slide in from the seats and close into a square.
    for (const side of ['b', 'r', 't', 'l']) stage.append(h('div', { class: `demo-row ${side}` }, ...Array.from({ length: 9 }, () => back('two'))));
    stage.append(...seats());
    steps.push('Each player builds a row, two tiles high', 'The rows slide together', 'Four rows make a square wall');
  } else if (kind === 'turn') {
    // Your thirteen tiles along the bottom. A new tile comes from the wall to the end of the row,
    // then your lonely North lifts out of the row and lands next to the discards in the middle.
    // Every position is in container units (lesson.css), so the flights land on their slots at any width.
    const hand = tiles('2m 3m 4m 6p 7p 9s 9s E E N Rd Rd Rd', labels);
    hand[9].classList.add('leaving');
    stage.append(
      h('div', { class: 'demo-wallbit' }, ...Array.from({ length: 8 }, () => back('two'))),
      h('div', { class: 'demo-pond' }, ...tiles('1s 9m W', labels)),
      h('div', { class: 'demo-hand-row' }, ...hand),
      h('span', { class: 'demo-fly draw' }, tileImg(parseKinds('8p')[0], '', labels)),
      h('span', { class: 'demo-fly out' }, tileImg(parseKinds('N')[0], '', labels)),
    );
    steps.push('Draw one tile from the wall', 'Choose your loneliest tile', 'Discard it face up in the middle');
  } else if (kind === 'call') {
    // You sit East. West, across, throws a 5 Bamboo: you hold two, call Pung, show the set and
    // discard, and play carries on to your right. Then North, on your left, throws the 6 Crack your
    // 4-5 needs: Chow. Last, South throws a 3 Crack: no chow from the right, so it stays a discard.
    const L = 17;
    const at = timeline(stage, L);
    const badges: Record<string, HTMLElement> = { W: seat('W', 'top'), N: seat('N', 'left'), S: seat('S', 'right'), E: seat('E', 'bottom') };
    stage.append(...Object.values(badges));
    const face = (spec: string, p: Pos) => {
      const t = tileImg(parseKinds(spec)[0], 'xt up', labels);
      Object.assign(t.style, xy(p));
      stage.append(t);
      return t;
    };
    const say = (text: string, p: Pos, no = false) => {
      const el = h('span', { class: `demo-say ${no ? 'no' : ''}` }, text);
      Object.assign(el.style, xy(p));
      stage.append(el);
      return el;
    };
    const glow = (w: string, s0: number, s1: number) =>
      at(badges[w], [[s0 - 0.2, { boxShadow: '0 0 0 0 rgba(234,208,154,0)' }], [s0, { boxShadow: '0 0 0 6px rgba(234,208,154,0.5)' }], [s1, { boxShadow: '0 0 0 6px rgba(234,208,154,0.5)' }], [s1 + 0.25, { boxShadow: '0 0 0 0 rgba(234,208,154,0)' }]]);
    const CENTRE: Pos = [50, 47];
    const HAND = (i: number): Pos => [32 + i * 7.2, 74];
    const MELD1 = (i: number): Pos => [70 + i * 6.2, 54];
    const MELD2 = (i: number): Pos => [70 + i * 6.2, 30];
    // Your hand: 5 5 Bamboo for the pung, 4 5 Crack for the chow, and two tiles to discard.
    const hand = ['5s', '5s', '4m', '5m', 'N', 'Rd'].map((k, i) => face(k, HAND(i)));
    const show = (p: Pos, s0: number): [number, Keyframe][] => [[0, { ...xy(p), opacity: 0 }], [0.4, { ...xy(p), opacity: 1 }], [s0, { ...xy(p), opacity: 1 }]];
    const end = (p: Pos): [number, Keyframe][] => [[16.4, { ...xy(p), opacity: 1 }], [16.9, { ...xy(p), opacity: 0 }]];
    // 1. West throws the 5 Bamboo, you call Pung.
    glow('W', 0.5, 1.9);
    const five = face('5s', SEAT_AT.W);
    at(five, [[0.7, { ...xy(SEAT_AT.W), opacity: 0 }], [0.9, { ...xy([50, 22]), opacity: 1 }], [1.7, { ...xy(CENTRE), opacity: 1 }], [2.9, { ...xy(CENTRE), opacity: 1 }], [3.6, { ...xy(MELD1(2)), opacity: 1 }], ...end(MELD1(2))]);
    const pung = say('Pung!', [50, 61]);
    at(pung, [[2.1, { opacity: 0, transform: 'translate(-50%, -50%) scale(0.7)' }], [2.4, { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' }], [3.6, { opacity: 1 }], [3.9, { opacity: 0 }]]);
    glow('E', 2.1, 5.2);
    at(hand[0], [...show(HAND(0), 2.9), [3.6, { ...xy(MELD1(0)), opacity: 1 }], ...end(MELD1(0))]);
    at(hand[1], [...show(HAND(1), 2.9), [3.6, { ...xy(MELD1(1)), opacity: 1 }], ...end(MELD1(1))]);
    // You discard the North, and play moves on to your right, South.
    at(hand[4], [...show(HAND(4), 4.2), [4.9, { ...xy([44, 47]), opacity: 1 }], [7.2, { ...xy([44, 47]), opacity: 1 }], [7.6, { ...xy([44, 47]), opacity: 0 }]]);
    glow('S', 5.4, 7.0);
    const next = say('Play goes on from you', [50, 61]);
    at(next, [[5.3, { opacity: 0 }], [5.6, { opacity: 1 }], [7.0, { opacity: 1 }], [7.3, { opacity: 0 }]]);
    // 2. North, on your left, throws the 6 Crack: Chow.
    glow('N', 7.8, 9.2);
    const six = face('6m', SEAT_AT.N);
    at(six, [[8.0, { ...xy(SEAT_AT.N), opacity: 0 }], [8.2, { ...xy([18, 47]), opacity: 1 }], [9.0, { ...xy(CENTRE), opacity: 1 }], [10.2, { ...xy(CENTRE), opacity: 1 }], [10.9, { ...xy(MELD2(2)), opacity: 1 }], ...end(MELD2(2))]);
    const chow = say('Chow!', [50, 61]);
    at(chow, [[9.4, { opacity: 0, transform: 'translate(-50%, -50%) scale(0.7)' }], [9.7, { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' }], [10.9, { opacity: 1 }], [11.2, { opacity: 0 }]]);
    glow('E', 9.4, 11.9);
    at(hand[2], [...show(HAND(2), 10.2), [10.9, { ...xy(MELD2(0)), opacity: 1 }], ...end(MELD2(0))]);
    at(hand[3], [...show(HAND(3), 10.2), [10.9, { ...xy(MELD2(1)), opacity: 1 }], ...end(MELD2(1))]);
    at(hand[5], [...show(HAND(5), 11.3), [11.9, { ...xy([56, 47]), opacity: 1 }], [16.4, { ...xy([56, 47]), opacity: 1 }], [16.9, { ...xy([56, 47]), opacity: 0 }]]);
    // 3. South throws a 3 Crack: it would fit your run, but South is on your right.
    glow('S', 12.4, 15.6);
    const three = face('3m', SEAT_AT.S);
    at(three, [[12.6, { ...xy(SEAT_AT.S), opacity: 0 }], [12.8, { ...xy([82, 47]), opacity: 1 }], [13.6, { ...xy([50, 36]), opacity: 1 }], ...end([50, 36])]);
    const nope = say('No chow from your right', [50, 61], true);
    at(nope, [[13.8, { opacity: 0 }], [14.1, { opacity: 1 }], [15.8, { opacity: 1 }], [16.1, { opacity: 0 }]]);
    steps.push('Pung from anyone: West throws a 5, you hold two', 'Place the set face up in front of your rack, discard, and play goes on from you', 'Chow only from your left: North throws the 6 you need', 'From anyone else, a run tile is just a discard');
    timedSteps = [[0.5, 4.2], [4.2, 7.4], [7.8, 12.2], [12.4, 16.2]];
    loop = L;
  } else if (kind === 'tictactoe') {
    // East, then South, West and North each lay one tile face down in front of every other player.
    // Then everyone picks up the three in front of them.
    const L = 14;
    const at = timeline(stage, L);
    const order = ['E', 'S', 'W', 'N'];
    const filled: Record<string, number> = { E: 0, S: 0, W: 0, N: 0 };
    const badges: Record<string, HTMLElement> = { W: seat('W', 'top'), N: seat('N', 'left'), S: seat('S', 'right'), E: seat('E', 'bottom') };
    stage.append(...Object.values(badges));
    order.forEach((g, gi) => {
      const s0 = 0.6 + gi * 2.4;
      at(badges[g], [[s0 - 0.2, { boxShadow: '0 0 0 0 rgba(201,165,107,0)' }], [s0, { boxShadow: '0 0 0 5px rgba(201,165,107,0.55)' }], [s0 + 2, { boxShadow: '0 0 0 5px rgba(201,165,107,0.55)' }], [s0 + 2.3, { boxShadow: '0 0 0 0 rgba(201,165,107,0)' }]]);
      // Clockwise from the giver: right, across, left.
      [1, 2, 3].forEach((step, j) => {
        const r = order[(gi + step) % 4];
        const slot = SLOTS[r][filled[r]++];
        const t = piece(SEAT_AT[g]);
        stage.append(t);
        const go = s0 + 0.2 + j * 0.6;
        at(t, [
          [go - 0.01, { ...xy(SEAT_AT[g]), opacity: 0 }],
          [go, { ...xy(SEAT_AT[g]), opacity: 1 }],
          [go + 0.55, { ...xy(slot), opacity: 1 }],
          [10.4, { ...xy(slot), opacity: 1 }],
          [11.4, { ...xy(SEAT_AT[r]), opacity: 1, transform: 'translate(-50%, -50%) scale(0.6)' }],
          [11.6, { ...xy(SEAT_AT[r]), opacity: 0, transform: 'translate(-50%, -50%) scale(0.6)' }],
        ]);
      });
    });
    steps.push('East lays one tile face down in front of each player', 'Then South, West and North do the same', 'Everyone picks up the three in front of them');
    timedSteps = [[0.6, 3], [3, 10.4], [10.4, 12.6]];
    loop = L;
  } else if (kind === 'wallswap') {
    // Everyone lays three tiles face down, takes any three from the wall (not their own side),
    // and the three they laid down go back into the gaps.
    const L = 15;
    const at = timeline(stage, L);
    const wall: Record<string, HTMLElement[]> = { W: [], E: [], N: [], S: [] };
    const row = (side: string, n: number, pos: (i: number) => Pos) => {
      for (let i = 0; i < n; i++) {
        const t = piece(pos(i), `two ${side === 'N' || side === 'S' ? 'side' : ''}`);
        wall[side].push(t);
        stage.append(t);
      }
    };
    row('W', 8, (i) => [32 + i * 5.1, 30]);
    row('E', 8, (i) => [32 + i * 5.1, 68]);
    row('N', 5, (i) => [24, 37 + i * 6.5]);
    row('S', 5, (i) => [76, 37 + i * 6.5]);
    stage.append(seat('W', 'top'), seat('N', 'left'), seat('S', 'right'), seat('E', 'bottom'));
    // Each player takes one tile from each other side of the wall.
    const take: Record<string, [string, number][]> = {
      E: [['S', 1], ['W', 5], ['N', 3]],
      S: [['W', 2], ['N', 1], ['E', 6]],
      W: [['N', 4], ['E', 1], ['S', 3]],
      N: [['E', 3], ['S', 4], ['W', 7]],
    };
    ['E', 'S', 'W', 'N'].forEach((p, pi) => {
      // One player at a time, so each move can be followed: East takes first, then South, West, North.
      const tk = 3 + pi * 0.95;
      const bk = 7.4 + pi * 0.8;
      take[p].forEach(([side, i], j) => {
        const w = wall[side][i];
        const from: Pos = [parseFloat(w.style.left), parseFloat(w.style.top)];
        const slot = SLOTS[p][j];
        // The player's own tile: laid down, then pushed into the gap in the wall.
        const mine = piece(SEAT_AT[p]);
        // The wall tile they take: lifts out and goes to their seat.
        const taken = piece(from);
        stage.append(mine, taken);
        at(mine, [
          [0.5 + j * 0.2, { ...xy(SEAT_AT[p]), opacity: 0 }],
          [0.6 + j * 0.2, { ...xy(SEAT_AT[p]), opacity: 1 }],
          [1.4 + j * 0.2, { ...xy(slot), opacity: 1 }],
          [bk + j * 0.2, { ...xy(slot), opacity: 1 }],
          [bk + 0.6 + j * 0.2, { ...xy(from), opacity: 1 }],
          [12.6, { ...xy(from), opacity: 1 }],
          [13.4, { ...xy(from), opacity: 0 }],
        ]);
        at(w, [[tk + j * 0.25, { opacity: 1 }], [tk + 0.05 + j * 0.25, { opacity: 0 }], [13.3, { opacity: 0 }], [13.5, { opacity: 1 }]]);
        at(taken, [
          [tk + j * 0.25, { ...xy(from), opacity: 0, boxShadow: '0 0 0 0 rgba(201,165,107,0)' }],
          [tk + 0.05 + j * 0.25, { ...xy(from), opacity: 1, boxShadow: '0 0 12px 3px rgba(201,165,107,0.8)' }],
          [tk + 0.65 + j * 0.25, { ...xy(SEAT_AT[p]), opacity: 1, boxShadow: '0 0 12px 3px rgba(201,165,107,0.8)' }],
          [tk + 0.9 + j * 0.25, { ...xy(SEAT_AT[p]), opacity: 0, boxShadow: '0 0 0 0 rgba(201,165,107,0)' }],
        ]);
      });
    });
    steps.push('Everyone lays three tiles face down', 'Each takes any three from the wall, never from their own side', 'The three laid down are mixed back into the wall');
    timedSteps = [[0.5, 3], [3, 7.3], [7.3, 12.6]];
    loop = L;
  } else {
    // The Charleston: three passes. In each, all four players lay out three tiles face down and
    // pass them at the same moment, so three come back to everyone from another seat. Your own
    // three (East) glow, so you can follow where they go.
    const L = 13.4;
    const at = timeline(stage, L);
    const order = ['E', 'S', 'W', 'N'];
    const badges: Record<string, HTMLElement> = { W: seat('W', 'top'), N: seat('N', 'left'), S: seat('S', 'right'), E: seat('E', 'bottom') };
    stage.append(...Object.values(badges));
    // Three tiles in front of each seat, facing the middle.
    const ROW: Record<string, Pos[]> = {
      E: [[43, 75], [50, 75], [57, 75]],
      W: [[43, 25], [50, 25], [57, 25]],
      S: [[81, 38], [81, 50], [81, 62]],
      N: [[19, 38], [19, 50], [19, 62]],
    };
    // Across, each passer keeps to their own right, so the four sets slide past one another.
    const VIA: Record<string, Pos> = { E: [66, 50], W: [34, 50], S: [50, 40], N: [50, 60] };
    const shine = '0 0 10px 3px rgba(234,208,154,0.85)';
    const none = '0 0 0 0 rgba(234,208,154,0)';
    ['To the right', 'Across', 'To the left'].forEach((label, p) => {
      const s0 = 0.4 + p * 4.3;
      order.forEach((g, gi) => {
        const r = order[(gi + p + 1) % 4];
        const glowing = g === 'E' ? shine : none;
        ROW[g].forEach((from, j) => {
          const to = ROW[r][j];
          const t = piece(from);
          stage.append(t);
          const mid: Pos = [(from[0] + to[0]) / 2 + (p === 1 ? VIA[g][0] - 50 : 0), (from[1] + to[1]) / 2 + (p === 1 ? VIA[g][1] - 50 : 0)];
          at(t, [
            [s0, { ...xy(SEAT_AT[g]), opacity: 0, boxShadow: glowing, transform: 'translate(-50%, -50%) scale(0.6)' }],
            [s0 + 0.5, { ...xy(from), opacity: 1, boxShadow: glowing, transform: 'translate(-50%, -50%) scale(1)' }],
            [s0 + 1.1, { ...xy(from), opacity: 1, boxShadow: glowing, transform: 'translate(-50%, -50%) scale(1)' }],
            [s0 + 1.7, { ...xy(mid), opacity: 1, boxShadow: glowing, transform: 'translate(-50%, -50%) scale(1)', easing: 'linear' }],
            [s0 + 2.3, { ...xy(to), opacity: 1, boxShadow: glowing, transform: 'translate(-50%, -50%) scale(1)' }],
            [s0 + 3.1, { ...xy(to), opacity: 1, boxShadow: glowing, transform: 'translate(-50%, -50%) scale(1)' }],
            [s0 + 3.6, { ...xy(SEAT_AT[r]), opacity: 0, boxShadow: glowing, transform: 'translate(-50%, -50%) scale(0.6)' }],
          ]);
        });
        at(badges[g], [[s0, { boxShadow: none }], [s0 + 0.4, { boxShadow: '0 0 0 5px rgba(201,165,107,0.5)' }], [s0 + 3.2, { boxShadow: '0 0 0 5px rgba(201,165,107,0.5)' }], [s0 + 3.6, { boxShadow: none }]]);
      });
      const pill = h('span', { class: 'demo-say' }, lt(label));
      Object.assign(pill.style, xy([84, 11]));
      stage.append(pill);
      at(pill, [[s0 + 0.6, { opacity: 0 }], [s0 + 0.9, { opacity: 1 }], [s0 + 3.0, { opacity: 1 }], [s0 + 3.4, { opacity: 0 }]]);
    });
    steps.push('Everyone passes three tiles to the right', 'Then three across the table', 'Then three to the left');
    timedSteps = [[0.4, 4.4], [4.7, 8.7], [9.0, 13.0]];
    loop = L;
  }
  const items = steps.map((s, i) => h('li', { style: { animationDelay: `${(i * 4) / steps.length}s` } }, lt(s)));
  const caption = h('ol', { class: `demo-steps ${loop ? 'timed' : ''}` }, ...items);
  if (loop) {
    const at = timeline(stage, loop);
    const on = { color: 'var(--ivory)' };
    const off = { color: 'var(--muted)' };
    items.forEach((li, i) => at(li, [[timedSteps[i][0] - 0.2, off], [timedSteps[i][0], on], [timedSteps[i][1], on], [timedSteps[i][1] + 0.2, off]]));
  }
  const wrap = h('div', { class: 'lesson-pic demo-pic' }, h('div', { class: 'demo-frame' }, stage, h('span', { class: 'demo-badge' }, lt('Live demo'))), caption);
  // Tap to pause or play; motion stays still for reduced-motion viewers (CSS).
  wrap.onclick = () => {
    const paused = wrap.classList.toggle('paused');
    for (const a of wrap.getAnimations({ subtree: true })) if (a instanceof Animation && !(a instanceof CSSAnimation)) paused ? a.pause() : a.play();
  };
  return wrap;
}

// ------------------------------------------------------------ recorded clips

/** Where a lesson clip is served: video/lesson-<name>.mp4 beside the page. */
const clipUrl = (name: string) => {
  try {
    return new URL(`video/lesson-${name}.mp4`, document.baseURI).href;
  } catch {
    return `video/lesson-${name}.mp4`;
  }
};

/** A looping, silent clip filmed at the 3D table. If it can't load (offline, a single-file build), the moving demo stands in. */
export function videoPic(name: string, labels: boolean, fallback?: DemoKind, caption?: string): HTMLElement {
  const wrap = h('div', { class: 'lesson-pic video-pic' });
  // WebM (VP9) for browsers without H.264, MP4 for Safari and the rest; the demo if neither plays.
  const mp4 = clipUrl(name);
  const last = h('source', { src: mp4, type: 'video/mp4' });
  const v = h(
    'video',
    { class: 'lv-video', poster: mp4.replace(/\.mp4$/, '.jpg'), muted: true, loop: true, playsinline: true, autoplay: true, preload: 'auto', 'aria-label': caption ? lt(caption) : lt('A clip from the table') },
    h('source', { src: mp4.replace(/\.mp4$/, '.webm'), type: 'video/webm; codecs="vp9"' }),
    last,
  ) as HTMLVideoElement;
  v.muted = true;
  last.addEventListener('error', () => fallback && wrap.replaceWith(demoPic(fallback, labels)));
  // Autoplay can stall on an element built off-page: start it once it is on screen.
  window.setTimeout(() => v.isConnected && v.paused && void v.play().catch(() => {}), 50);
  // Tap to pause or play.
  v.onclick = () => (v.paused ? void v.play().catch(() => {}) : v.pause());
  wrap.append(h('div', { class: 'demo-frame' }, v, h('span', { class: 'demo-badge' }, lt('At the table'))));
  if (caption) wrap.append(h('p', { class: 'lv-caption' }, lt(caption)));
  return wrap;
}
