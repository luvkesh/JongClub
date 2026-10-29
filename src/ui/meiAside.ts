// The tiles Mei is talking about, set beside her words. On a wide lesson card
// (iPad, desktop) her caption only fills the left of the card, so the right
// shows the sets and tiles her line names, in the order she names them: a
// pung, a crochet, the dragons... Each pick uses tiles not already on show in
// the scene's picture or earlier in the aside, so nothing repeats. Phones and
// narrow cards hide it (container query in meiAside.css).

import { parseKinds } from '../engine/tiles';
import { tr } from '../i18n';
import { lessonsTranslated, lt } from '../i18n/lessons';
import type { Lesson } from './lessonKit';
import { h, tileImg } from './dom';
import './meiAside.css';

interface Concept {
  /** Matched against Mei's line, case-insensitive, whole words. */
  re: RegExp;
  label: string;
  /** Alternatives in parseKinds notation; the first with no tile already on show wins. */
  picks: string[];
  /** Families of tiles (dragons, bamboo...) give way to named sets when there are too many. */
  family?: boolean;
}

// Order matters only where one word contains another: "mixed chow" before "chow".
const CONCEPTS: Concept[] = [
  { re: /\bmixed chows?\b/, label: 'Mixed chow', picks: ['3m 4s 5p', '6p 7m 8s', '1s 2p 3m', '7s 8m 9p', '4p 5m 6s'] },
  { re: /\bcrochets?\b/, label: 'Crochet', picks: ['6m 6s 6p', '2m 2s 2p', '8m 8s 8p', '1m 1s 1p', '9m 9s 9p'] },
  { re: /\bknits?\b/, label: 'Knit', picks: ['9m 9p', '3s 3m', '5p 5s', '7p 7m'] },
  { re: /\b(pungs?|pongs?|pon)\b/, label: 'Pung', picks: ['777p', 'Gd Gd Gd', '222s', 'SSS'] },
  { re: /\b(kongs?|kans?|gangs?|quads?)\b/, label: 'Kong', picks: ['4444m', 'WWWW', '9999s'] },
  { re: /\b(chows?|chis?)\b/, label: 'Chow', picks: ['678s', '234p', '567m', '123p'] },
  { re: /\bpairs?\b/, label: 'Pair', picks: ['NN', 'Wd Wd', '88m', '11p'] },
  { re: /\bdragons?\b/, label: 'Dragons', picks: ['Rd Gd Wd'], family: true },
  { re: /\bwinds?\b/, label: 'Winds', picks: ['E S W N'], family: true },
  { re: /\b(flowers?|seasons?|bouquets?)\b/, label: 'Flowers and seasons', picks: ['F2 F7', 'F4 F5', 'F1 F8'], family: true },
  { re: /\bjokers?\b/, label: 'Joker', picks: ['J'], family: true },
  { re: /\b(bamboos?|bams?)\b/, label: 'Bamboo', picks: ['1s 5s 9s', '2s 6s 8s', '3s 7s'], family: true },
  { re: /\b(dots|rings|circles)\b/, label: 'Dots', picks: ['2p 6p 9p', '1p 4p 8p', '3p 7p'], family: true },
  { re: /\b(characters|cracks|craks|wan)\b/, label: 'Characters', picks: ['1m 5m 8m', '2m 6m 9m', '3m 7m'], family: true },
  { re: /\bterminals?\b/, label: 'Terminals', picks: ['1m 9p', '9s 1p', '1s 9m'], family: true },
  { re: /\bhonou?rs?\b/, label: 'Honours', picks: ['S Rd', 'W Gd', 'N Wd'], family: true },
];

const MAX = 6;

/** The sets named in a line, in the order they are named, with tiles not in `avoid`. */
export function namedSets(say: string, avoid: Set<number> = new Set()): { label: string; kinds: number[] }[] {
  const text = say.toLowerCase();
  const used = new Set(avoid);
  const found: { at: number; c: Concept }[] = [];
  const taken: [number, number][] = [];
  for (const c of CONCEPTS) {
    const m = c.re.exec(text);
    if (!m) continue;
    // "mixed chow" also contains "chow": a later, shorter match inside an earlier one doesn't count again.
    const span: [number, number] = [m.index, m.index + m[0].length];
    let at = m.index;
    if (taken.some(([a, b]) => at >= a && at < b)) {
      const re = new RegExp(c.re.source, 'g');
      let n: RegExpExecArray | null;
      at = -1;
      while ((n = re.exec(text))) if (!taken.some(([a, b]) => n!.index >= a && n!.index < b)) { at = n.index; span[0] = at; span[1] = at + n[0].length; break; }
      if (at < 0) continue;
    }
    taken.push(span);
    found.push({ at, c });
  }
  // Named sets first when Mei names more than fit, then back into the order she says them.
  found.sort((a, b) => Number(!!a.c.family) - Number(!!b.c.family) || a.at - b.at);
  found.splice(MAX);
  found.sort((a, b) => a.at - b.at);
  const out: { label: string; kinds: number[] }[] = [];
  for (const { c } of found) {
    if (out.length >= MAX) break;
    const pick = c.picks.map(parseKinds).find((ks) => ks.every((k) => !used.has(k))) ?? null;
    if (!pick) continue;
    for (const k of pick) used.add(k);
    out.push({ label: c.label, kinds: pick });
  }
  return out;
}

/** Where the lesson is going: this scene's place in it and the next scene's title (null before the test). */
export interface AsideNext {
  n: number;
  total: number;
  title: string | null;
}

/**
 * The aside for a lesson card: the tiles Mei names, or, when she names none that aren't already
 * on show, the lesson's progress and what comes next, so the space beside her words is never empty.
 */
export function meiAside(say: string, shown: Element | null, labels: boolean, next?: AsideNext): HTMLElement | null {
  const avoid = new Set<number>();
  shown?.querySelectorAll<HTMLElement>('[data-tile]').forEach((el) => avoid.add(Number(el.dataset.tile)));
  const sets = namedSets(say, avoid);
  if (!sets.length) return next ? upNext(next) : null;
  return h(
    'aside',
    { class: `mei-aside n${sets.length}`, 'aria-hidden': 'true' },
    ...sets.map((s, i) =>
      h(
        'figure',
        { class: 'ma-set', style: `--i:${i}` },
        h('div', { class: 'ma-tiles' }, ...s.kinds.map((k) => tileImg(k, '', labels))),
        h('figcaption', {}, lt(s.label)),
      ),
    ),
  );
}

/** A brass dial of the lesson so far, and the next scene's title. */
function upNext(x: AsideNext): HTMLElement {
  const r = 26;
  const c = 2 * Math.PI * r;
  const left = x.total - x.n;
  const dial = `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="${r}" class="ma-ring-bg"/><circle cx="32" cy="32" r="${r}" class="ma-ring" stroke-dasharray="${((x.n / x.total) * c).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 32 32)"/></svg>`;
  return h(
    'aside',
    { class: 'mei-aside upnext', 'aria-hidden': 'true' },
    h('div', { class: 'ma-dial' }, h('span', { html: dial }), h('b', {}, String(x.n)), h('small', {}, tr('of {total}', { total: x.total }))),
    h(
      'div',
      { class: 'ma-next' },
      h('p', { class: 'ma-k' }, x.title ? tr('Up next') : tr('Next')),
      h('p', { class: 'ma-t', lang: lessonsTranslated() ? null : 'en' }, x.title ? lt(x.title) : tr('The test')),
      h('p', { class: 'ma-more' }, left > 1 ? tr('{n} more scenes, then the test', { n: left - 1 }) : x.title ? tr('Then the test') : tr('A few quick questions')),
    ),
  );
}

/** The lesson's start card: what the scenes cover, beside Mei's "{n} short scenes" line. */
export function lessonContents(lesson: Lesson): HTMLElement {
  const SHOW = 5;
  const titles = lesson.scenes.map((s) => s.title);
  const more = titles.length - SHOW;
  return h(
    'aside',
    { class: 'mei-aside contents' },
    h('p', { class: 'ma-k' }, tr('In this lesson')),
    h('ol', {}, ...titles.slice(0, SHOW).map((t, i) => h('li', { style: `--i:${i}` }, h('b', {}, String(i + 1)), h('span', { lang: lessonsTranslated() ? null : 'en' }, lt(t))))),
    h('p', { class: 'ma-more' }, more > 0 ? tr('{n} more scenes, then the test', { n: more }) : tr('Then the test')),
  );
}
