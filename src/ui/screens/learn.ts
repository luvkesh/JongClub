// Learn screen: the Mahjong Academy's lesson player and level list.

import { saveProfile, unlock } from '../../progression/profile';
import { VARIATION_SHEETS } from '../../club/variationSheets';
import { ACADEMY_ORDER, LESSONS, OPTIONAL_LESSONS, lessonPlayer } from '../academy';
import { addSeasonXp } from '../../progression/season';
import { SEASON_XP } from '../../club/seasons';
import { clear, h } from '../dom';
import { icon } from '../icons';
import { signatureTile } from '../versions';
import { tileImg } from '../dom';
import { CAT, CENTIPEDE, FLOWER_BASE, JOKER_KIND, MOUSE, ROOSTER, parseKinds } from '../../engine/tiles';
import { lt } from '../../i18n/lessons';
import './learn.css';
import type { TableConfig } from '../match';
import { drillsCard } from '../drills';
import { luxCard, luxRow } from '../luxCard';
import type { LuxArtId } from '../luxArt';
import { promptSignIn } from '../../auth/prompt';
import { placementLink, placementOffer } from '../placement';
import { tr } from '../../i18n';
import type { App } from '../app';
import { DEFAULT_TABLE, tableFor, type Lesson } from './tables';

/** Set when the player picks a lesson from the list, so it begins at once; opening Learn shows a start card instead. */
let autostartNext = false;
/** The next Learn screen begins its lesson at once (the player asked for that lesson). */
export const autostartLesson = () => void (autostartNext = true);
const takeAutostart = () => {
  const v = autostartNext;
  autostartNext = false;
  return v;
};

export function learnScreen(app: App) {
  const practice = (v: Lesson, name: string): TableConfig => ({ ...(v === 'basics' ? DEFAULT_TABLE : tableFor(v)), name, length: 'oneHand', difficulty: 'beginner', personalities: ['teacher', 'zen', 'teacher'], hints: true, timer: 0, pace: 'untimed' });
  const indiaRound = (round: string, name: string): TableConfig => { const t = practice('india', name); return { ...t, houseRules: { ...t.houseRules, indiaRounds: round } }; };
  // The Foundations and Mastery lessons teach India Rules, so they practise its Classic style: the East round's game, no passports.
  const indiaClassic = (name: string): TableConfig => indiaRound('C', name);
  const tables: Partial<Record<Lesson, [string, TableConfig]>> = {
    basics: [tr('Play a guided game with Mei'), practice('basics', tr('Guided Game'))],
    words: [tr('Play a guided game with Mei'), practice('basics', tr('Guided Game'))],
    scoring: [tr('Play an India Rules hand'), indiaClassic(tr('Scoring Practice'))],
    shapes: [tr('Play an India Rules hand'), indiaClassic(tr('Hand Shapes Practice'))],
    strategy: [tr('Play an India Rules hand'), indiaClassic(tr('Strategy Practice'))],
    efficiency: [tr('Play an India Rules hand'), indiaClassic(tr('Strategy Practice'))],
    waits: [tr('Play an India Rules hand'), indiaClassic(tr('Strategy Practice'))],
    defence: [tr('Play an India Rules hand'), { ...indiaClassic(tr('Strategy Practice')), difficulty: 'expert' } as TableConfig],
    value: [tr('Play four India Rules games'), { ...indiaClassic(tr('India Rules Practice')), length: 'eastRound' }],
    classic: [tr('Play a Classic hand'), practice('basics', tr('Classic Practice'))],
    tradition: [tr('Play a guided game with Mei'), practice('basics', tr('Guided Game'))],
    riichi: [tr('Play a Riichi hand'), practice('riichi', tr('Riichi Practice'))],
    taiwanese: [tr('Play a Taiwanese hand'), practice('taiwanese', tr('Taiwanese Practice'))],
    american: [tr('Play an American hand'), practice('american', tr('American Practice'))],
    uae: [tr('Play a Dubai club hand'), practice('uae', tr('Dubai Practice'))],
    rounds: [tr('Play four India Rules games'), { ...indiaClassic(tr('India Rules Practice')), length: 'eastRound' }],
    vietnamese: [tr('Play a Vietnamese hand'), practice('vietnamese', tr('Vietnamese Practice'))],
    india: [tr('Play an India Rules hand'), practice('india', tr('India Rules Practice'))],
    'india-east': [tr('Play an East round hand'), indiaRound('E', tr('East Round Practice'))],
    'india-south': [tr('Play a South round hand'), indiaRound('S', tr('South Round Practice'))],
    'india-west': [tr('Play a West round hand'), indiaRound('W', tr('West Round Practice'))],
    'india-west-doubles': [tr('Play a West round hand'), indiaRound('W', tr('West Round Practice'))],
    'india-west-big': [tr('Play a West round hand'), indiaRound('W', tr('West Round Practice'))],
    'india-north': [tr('Play a West round hand'), indiaRound('W', tr('West Round Practice'))],
    indian: [tr('Play a Kolkata Joker Club hand'), practice('indian', tr('Kolkata Joker Club Practice'))],
    singapore: [tr('Play a Singapore hand'), practice('singapore', tr('Singapore Practice'))],
    hongkong: [tr('Play a Hong Kong hand'), practice('hongkong', tr('Hong Kong Practice'))],
    mcr: [tr('Play a Chinese Official hand'), practice('mcr', tr('MCR Practice'))],
    sichuan: [tr('Play a Sichuan hand'), practice('sichuan', tr('Sichuan Practice'))],
    malaysian: [tr('Play a Malaysian hand'), practice('malaysian', tr('Malaysian Practice'))],
    korean3: [tr('Play a Korean hand'), practice('korean3', tr('Korean Practice'))],
    sanma: [tr('Play a Sanma hand'), practice('sanma', tr('Sanma Practice'))],
    malaysian3: [tr('Play a three-player Malaysian hand'), practice('malaysian3', tr('Malaysian Three-Player Practice'))],
    'uae-taiwanese': [tr('Play a Dubai Taiwanese hand'), practice('uae-taiwanese', tr('Dubai Taiwanese Practice'))],
    'uae-american': [tr('Play a Dubai American hand'), practice('uae-american', tr('Dubai American Practice'))],
    'uae-custom': [tr('Play a custom UAE hand'), practice('uae-custom', tr('Custom UAE Practice'))],
  };
  const id = app.learnLesson;
  const [cta, table] = tables[id] ?? [tr('Play a guided game with Mei'), practice('basics', tr('Guided Game'))];
  // The current lesson's line in the level list, marked complete as soon as its test is passed.
  const state = h('span', { class: 'lv-state' }, app.profile.lessonsDone.includes(id) ? tr('Completed') : tr('In progress'));
  const body = lessonPlayer(LESSONS[id], {
    labels: app.settings.labels,
    practiceLabel: cta,
    onPassed: () => {
      if (!app.profile.lessonsDone.includes(id)) (app.profile.lessonsDone.push(id), addSeasonXp('lesson', SEASON_XP.lesson));
      if (id === 'basics') unlock(app.profile, 'student');
      if ((Object.keys(tables) as Lesson[]).every((l) => OPTIONAL_LESSONS.includes(l) || app.profile.lessonsDone.includes(l))) unlock(app.profile, 'student-of-the-game');
      saveProfile(app.profile);
      state.textContent = tr('Completed');
      window.setTimeout(() => void promptSignIn('lesson', { points: app.profile.jongPoints }), 1500);
    },
    // Basics leads to the plain guided game; Words and Tradition each have a guided game of their own.
    onPractice: () => (id === 'basics' ? app.startGuided('india') : id === 'words' || id === 'tradition' ? app.startGuided('india', id) : ((app.settings.hintDepth = 'learning'), app.startMatch(table, { tag: `lesson:${id}` }))),
    nextLabel: nextAfter(app, id) ? tr('Next lesson') : undefined,
    onNext: () => {
      const n = nextAfter(app, id);
      if (n) open(n)();
    },
    onOpenLesson: (l) => open(l as Lesson)(),
    autostart: takeAutostart(),
  });
  const open = (lesson: Lesson) => () => {
    app.learnLesson = lesson;
    autostartNext = true;
    app.go('learn');
    requestAnimationFrame(() => app.scrollToLesson());
  };
  const L = (n: number | string) => tr('Level {n}', { n: String(n) });
  const levels: Level[] = [
    // Foundations: Levels 1 to 8, all India Rules (the user, 2026-10-25). Tradition (7) is optional; Words comes after it.
    { n: L(1), t: tr('The Basics'), d: tr('Tiles, flowers and seasons, suits, sets and the Indian sets, pairs, calling and claim timing'), lesson: 'basics', cat: 'foundations' },
    { n: L(2), t: tr('Play'), d: tr('A guided game: play a real hand while Mei talks you through it'), guided: true, cat: 'foundations' },
    { n: L(3), t: tr('Scoring'), d: tr('What a win pays in India Rules, East’s double, flowers and seasons, and worked examples'), lesson: 'scoring', cat: 'foundations' },
    { n: L(4), t: tr('Winds and rounds'), d: tr('Seat winds, the dice, the wall and the flower wall, and the four rounds of a match'), lesson: 'rounds', cat: 'foundations' },
    { n: L(5), t: tr('Hand shapes'), d: tr('Building mixed chows and crochets, passports and card hands'), lesson: 'shapes', cat: 'foundations' },
    { n: L(6), t: tr('Strategy'), d: tr('Three questions for every discard, calling wisely, and playing to your card'), lesson: 'strategy', cat: 'foundations' },
    { n: L(7), t: tr('Tradition and etiquette'), d: tr('A little history, washing the tiles, table manners, and Mahjong in India'), lesson: 'tradition', cat: 'foundations', optional: true },
    { n: L(8), t: tr('Words at the table'), d: tr('The words you’ll hear at an India Rules table, from minors and majors to passports and bouquets'), lesson: 'words', cat: 'foundations' },
    // Mastering Mahjong: Levels 9 to 12
    { n: L(9), t: tr('Building a fast hand'), d: tr('Blocks, steps from ready, and the tiles that help'), lesson: 'efficiency', cat: 'mastery' },
    { n: L(10), t: tr('Reading waits'), d: tr('Every winning shape, longer waits, and choosing the best one'), lesson: 'waits', cat: 'mastery' },
    { n: L(11), t: tr('Defence'), d: tr('Spotting a ready player, safe tiles, and folding well'), lesson: 'defence', cat: 'mastery' },
    { n: L(12), t: tr('Value and the long game'), d: tr('Fast or big, table minimums, the scores and the last hand'), lesson: 'value', cat: 'mastery' },
    // Variations and regional rules: Level 13 onwards
    { n: L(13), t: tr('India Rules'), d: tr('The club game played across India: the tiles, the words, the Indian sets and the four rounds.'), lesson: 'india', cat: 'regional' },
    { n: '', t: tr('East round: Passport'), d: tr('Every passport, how they combine, and the East round score sheet.'), lesson: 'india-east', cat: 'regional' },
    { n: '', t: tr('South round: Small Cards'), d: tr('Your secret card, the exchanges, Tic-Tac-Toe, buying and the card values.'), lesson: 'india-south', cat: 'regional' },
    { n: '', t: tr('West round: Goulash'), d: tr('Pungs and kongs, clean hands, doubles, the goulash chart and the penalty.'), lesson: 'india-west', cat: 'regional' },
    { n: '', t: tr('West round: one double'), d: tr('Every single double on the goulash score sheet, each in a full example hand.'), lesson: 'india-west-doubles', cat: 'regional' },
    { n: '', t: tr('West round: big doubles'), d: tr('Two doubles up to the blessings, each in a full example hand.'), lesson: 'india-west-big', cat: 'regional' },
    { n: '', t: tr('North round: East’s choice'), d: tr('Jokers, the joker goulash, big cards and the qwong.'), lesson: 'india-north', cat: 'regional' },
    { n: L(14), t: tr('Chinese Classical'), d: tr('The traditional game: 136 tiles, faan scoring, seven pairs and thirteen orphans.'), lesson: 'classic', cat: 'regional' },
    { n: L(15), t: tr('Kolkata Joker Club'), d: tr('Jokers, flowers and club faan.'), lesson: 'indian', cat: 'regional' },
    { n: L(16), t: tr('Hong Kong'), d: tr('Cantonese calls, a three-faan minimum, flowers and the half-spicy table.'), lesson: 'hongkong', cat: 'regional' },
    { n: L(17), t: tr('Taiwanese'), d: tr('16-tile hands, flowers, tai and the dealer streak.'), lesson: 'taiwanese', cat: 'regional' },
    { n: L(18), t: tr('Riichi'), d: tr('Yaku, riichi, dora, furiten, and han and fu.'), lesson: 'riichi', cat: 'regional' },
    { n: L(19), t: tr('American'), d: tr('The card, jokers, the Charleston, exposures and card values.'), lesson: 'american', cat: 'regional' },
    { n: L(20), t: tr('Dubai Asian'), d: tr('House rules, flowers, faan, who pays and the goulash.'), lesson: 'uae', cat: 'regional' },
    { n: '', t: tr('Dubai Taiwanese'), d: tr('The Taiwanese game with a one-tai minimum and an optional goulash.'), lesson: 'uae-taiwanese', cat: 'regional' },
    { n: '', t: tr('Dubai American'), d: tr('The American card with the goulash switched on.'), lesson: 'uae-american', cat: 'regional' },
    { n: '', t: tr('Custom UAE table'), d: tr('Every house rule is the host’s choice.'), lesson: 'uae-custom', cat: 'regional' },
    { n: L(21), t: tr('Vietnamese'), d: tr('Khung jokers, flowers and phán.'), lesson: 'vietnamese', cat: 'regional' },
    { n: L(22), t: tr('Singapore'), d: tr('Animals, bites, tai and shooter pays.'), lesson: 'singapore', cat: 'regional' },
    { n: L(23), t: tr('Malaysian'), d: tr('Animals and tai, seven pairs, and a shared payment.'), lesson: 'malaysian', cat: 'regional' },
    { n: L(24), t: tr('Sichuan'), d: tr('Three suits, the missing suit, wind and rain.'), lesson: 'sichuan', cat: 'regional' },
    { n: L(25), t: tr('Chinese Official'), d: tr('The tournament fan list and eight fan to win.'), lesson: 'mcr', cat: 'regional' },
    { n: L(26), t: tr('Korean'), d: tr('Three players, a smaller set, no chow calls and simple points.'), lesson: 'korean3', cat: 'regional' },
    { n: '', t: tr('Sanma'), d: tr('Riichi for three: no chi, kita and tsumo loss.'), lesson: 'sanma', cat: 'regional' },
    { n: '', t: tr('Malaysian three-player'), d: tr('Two suits, flowers and animals, three seats.'), lesson: 'malaysian3', cat: 'regional' },
  ];
  // The newer rulesets: a lettered level under their family (SUB), or a level of their own; then any other lesson not listed yet.
  let next = 27;
  for (const sh of VARIATION_SHEETS) if (!levels.some((x) => x.lesson === sh.lesson)) levels.push({ n: SUB[sh.lesson as Lesson] ? '' : L(next++), t: sh.level.t, d: sh.level.d, lesson: sh.lesson as Lesson, cat: 'regional' });
  for (const l of ACADEMY_ORDER as Lesson[]) if (LESSONS[l] && !levels.some((x) => x.lesson === l)) levels.push({ n: L(next++), t: lt(LESSONS[l].title), d: '', lesson: l, cat: 'regional' });

  const isDone = (l: Level) => (l.guided ? app.profile.lessonsDone.includes('guided') : !!l.lesson && app.profile.lessonsDone.includes(l.lesson));
  const required = levels.filter((l) => !l.optional);
  const completed = required.filter(isDone).length;
  return h(
    'div',
    { class: 'page learn' },
    h(
      'header',
      { class: 'page-head lx-head' },
      h(
        'div',
        { class: 'lx-head-text' },
        h('p', { class: 'eyebrow' }, tr('Mahjong Academy')),
        h('h2', {}, tr('Learning path')),
        h('p', { class: 'lx-sub' }, tr('Build your skills, one level at a time. {done} of {total} completed.', { done: completed, total: required.length })),
        h('div', { class: 'lx-progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(required.length), 'aria-valuenow': String(completed) }, h('i', { style: { width: `${(completed / Math.max(1, required.length)) * 100}%` } })),
      ),
      h('div', { class: 'learn-head-links' }, placementLink(app.ctx()), h('button', { class: 'btn sm ghost', onclick: () => app.go('versions') }, tr('All variations: the Mahjong family'), h('span', { html: icon('chevronRight') }))),
    ),
    placementOffer(app.ctx()),
    learnChoices(app, levels, open, isDone),
    h(
      'section',
      { class: 'lx-current', 'aria-label': tr('Your lesson') },
      nowLearning(levels, id),
      body,
    ),
    learningPath(app, levels, id, open, isDone),
  );
}

/** The open lesson's level and name above the lesson card, so it's clear which lesson is on. */
function nowLearning(levels: Level[], id: Lesson): HTMLElement | null {
  const l = levels.find((x) => x.lesson === id);
  if (!l) return null;
  const tag = SUB[id]?.[1] ? tr('Level {n}', { n: SUB[id]![1] }) : l.n;
  return h('header', { class: 'lx-now' }, h('p', { class: 'eyebrow' }, h('i', { class: 'lx-live', 'aria-hidden': 'true' }), tag ? `${tr('Now learning')} · ${tag}` : tr('Now learning')), h('h2', { class: 'lx-now-t' }, l.t));
}

type Category = 'foundations' | 'mastery' | 'regional';
interface Level {
  n: string;
  t: string;
  d: string;
  lesson?: Lesson;
  guided?: boolean;
  /** Optional: never blocks the path or counts toward it. */
  optional?: boolean;
  cat: Category;
}

const CATS: { id: '' | Category; label: string; head?: string; icon: string; range?: string }[] = [
  { id: '', label: tr('All Lessons'), icon: 'grid' },
  { id: 'foundations', label: tr('Foundations'), icon: 'leaf', range: '1–8' },
  { id: 'mastery', label: tr('Mastering Mahjong'), icon: 'trophy', range: '9–12' },
  { id: 'regional', label: tr('Variations'), head: tr('Variations (Regional Rules)'), icon: 'globe', range: '13+' },
];
/** Variation levels shown before Show more. */
const SHOWN = 6;
/** Lettered levels: their parent lesson and their short tag. */
const SUB: Partial<Record<Lesson, [Lesson, string]>> = {
  'india-east': ['india', '13A'], 'india-south': ['india', '13B'], 'india-west': ['india', '13C'], 'india-west-doubles': ['india', '13D'], 'india-west-big': ['india', '13E'], 'india-north': ['india', '13F'],
  guangdong: ['hongkong', '16A'], 'zung-jung': ['hongkong', '16B'], 'riichi-tournament': ['riichi', '18A'], 'wright-patterson': ['american', '19A'],
  'uae-taiwanese': ['uae', '20A'], 'uae-american': ['uae', '20B'], 'uae-custom': ['uae', '20C'], ema: ['mcr', '25A'],
  sanma: ['korean3', '26A'], malaysian3: ['korean3', '26B'], korean: ['korean3', '26C'],
} as Partial<Record<string, [Lesson, string]>>;
/** Each lesson's own picture: a drawn icon for the Foundations and Mastery levels, the game's signature tile for a variation (a wind tile for each India Rules round). */
const LESSON_ICON: Partial<Record<Lesson | 'guided', string>> = {
  basics: 'tile', guided: 'play', words: 'book', scoring: 'coins', rounds: 'wind', shapes: 'group', strategy: 'target', tradition: 'tea',
  efficiency: 'bolt', waits: 'eye', defence: 'shield', value: 'star',
};
/** A different tile for every variation, so no two lessons share a picture. A red five is written 5m!. */
const F = (n: number) => FLOWER_BASE + n - 1;
const LESSON_TILE: Record<string, number | string> = {
  india: '1p', classic: '6p', indian: '2p', 'india-east': 'E', 'india-south': 'S', 'india-west': 'W', 'india-west-doubles': '3s', 'india-west-big': '7s', 'india-north': 'N',
  hongkong: F(1), guangdong: 'Rd', 'zung-jung': 'Gd', taiwanese: F(5), riichi: '5m!', 'riichi-tournament': '5p!',
  american: JOKER_KIND, 'wright-patterson': F(2), uae: F(6), 'uae-taiwanese': F(7), 'uae-american': F(8), 'uae-custom': F(3),
  vietnamese: F(4), singapore: CAT, malaysian: ROOSTER, malaysian3: MOUSE, indonesian: CENTIPEDE, sichuan: '1s', mcr: 'Wd', ema: '9p',
  korean3: '9m', sanma: '9s', korean: '1m', european: '5s', wuhan: '2s', shanghai: '3p', fujian: '7m', beijing: '8s', northeast: '4p', thai: '6s', filipino: '3m',
};
function lessonIcon(l: Level, fallback: string): HTMLElement {
  const named = LESSON_ICON[l.guided ? 'guided' : (l.lesson as Lesson)];
  if (named || l.cat !== 'regional' || !l.lesson) return h('span', { class: 'lx-ico', 'aria-hidden': 'true', html: icon(named ?? fallback) });
  const t = LESSON_TILE[l.lesson];
  const kind = typeof t === 'number' ? t : t ? parseKinds(t.replace('!', ''))[0] : -1;
  return h('span', { class: 'lx-ico tile', 'aria-hidden': 'true' }, kind >= 0 ? tileImg(kind, '', true, typeof t === 'string' && t.endsWith('!')) : signatureTile(l.lesson));
}
/** Shows one kind of lesson in the level list (set by the list itself). */
let pickCat: (c: '' | Category) => void = () => {};
const CAT_ART: Record<Category, LuxArtId> = { foundations: 'foundations', mastery: 'mastery', regional: 'variations' };

/** The top row of premium cards: carry on where you left off, the three kinds of lesson, and the daily drills. */
function learnChoices(app: App, levels: Level[], open: (l: Lesson) => () => void, isDone: (l: Level) => boolean): HTMLElement {
  const next = levels.find((l) => !l.optional && !isDone(l));
  const tag = (l: Level) => l.n || (l.lesson && SUB[l.lesson]?.[1] ? tr('Level {n}', { n: SUB[l.lesson]![1] }) : '');
  const cont = luxCard({
    art: 'learn',
    title: tr('Continue'),
    line: next ? [tag(next), next.t].filter(Boolean).join(' · ') : tr('Every lesson is done. Pick any level to review.'),
    run: next ? (next.guided ? () => app.startGuided('india') : open(next.lesson!)) : () => pickCat(''),
    featured: true,
  });
  const cats = CATS.filter((c) => c.id).map((c) => {
    const mine = levels.filter((l) => l.cat === c.id && !l.optional);
    const done = mine.filter(isDone).length;
    return luxCard({
      art: CAT_ART[c.id as Category],
      title: c.label,
      line: `${tr('Levels {n}', { n: c.range ?? '' })} · ${tr('{done} of {total} done', { done, total: mine.length })}`,
      run: () => {
        pickCat(c.id);
        document.querySelector('.lx-path')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
    });
  });
  return h('section', { class: 'lx-choices', 'aria-label': tr('Learn') }, luxRow([cont, ...cats, drillsCard(app.ctx())]));
}

const path = { cat: '' as '' | Category, q: '', sort: 'level' as 'level' | 'todo' | 'done', more: false, open: new Set<string>() };

/** The Academy's learning path: every level, filterable, with lettered levels folded under their parent. */
function learningPath(app: App, levels: Level[], current: Lesson, open: (l: Lesson) => () => void, isDone: (l: Level) => boolean): HTMLElement {
  const key = (l: Level) => l.lesson ?? (l.guided ? 'guided' : l.t);
  // Lettered levels (11a, 18b) fold under their parent level.
  const parentOf = (l: Level) => (l.lesson && SUB[l.lesson] ? (levels.find((p) => p.lesson === SUB[l.lesson!]![0]) ?? null) : null);
  const status = (l: Level) => (isDone(l) ? 'done' : l.lesson === current ? 'progress' : 'todo');
  const STATUS = { done: tr('Completed'), progress: tr('In progress'), todo: tr('Not started') };

  const list = h('div', { class: 'lx-list' });
  const moreRow = h('div', { class: 'lx-more' });

  const action = (l: Level) =>
    l.guided
      ? h('button', { class: 'btn sm ghost lx-go', onclick: () => app.startGuided('india') }, isDone(l) ? tr('Play again') : tr('Play'), h('span', { html: icon('chevronRight') }))
      : h('button', { class: 'btn sm ghost lx-go', onclick: open(l.lesson!) }, isDone(l) ? tr('Review') : l.lesson === current ? tr('Continue') : tr('Start'), h('span', { html: icon('chevronRight') }));

  const row = (l: Level, kids: Level[], child = false) => {
    const st = status(l);
    const k = key(l);
    const cat = CATS.find((c) => c.id === l.cat)!;
    const opened = path.open.has(k) || (!!path.q && kids.length > 0) || kids.some((x) => x.lesson === current);
    const active = l.lesson === current;
    const chev = kids.length
      ? h('button', { type: 'button', class: 'lx-chev', 'aria-expanded': String(opened), 'aria-label': opened ? tr('Hide {name}', { name: kids.map((x) => x.t).join(', ') }) : tr('Show {name}', { name: kids.map((x) => x.t).join(', ') }), html: icon('chevronDown') })
      : h('span', { class: 'lx-chev-gap' });
    const el = h(
      'div',
      { class: `lx-row ${child ? 'child' : ''} ${st} ${opened ? 'open' : ''} ${active ? 'active' : ''}`, role: 'listitem', 'aria-current': active ? 'true' : null },
      h(
        'div',
        { class: 'lx-main' },
        h('span', { class: 'lx-n' }, child && l.lesson && SUB[l.lesson] ? SUB[l.lesson]![1] : l.n),
        lessonIcon(l, cat.icon),
        h('div', { class: 'lx-text' }, h('p', { class: 'lx-t' }, l.t), l.d ? h('p', { class: 'lx-d' }, l.d) : null),
        h('span', { class: 'lx-meta' }, h('span', { class: `lx-state ${st}` }, h('i', { 'aria-hidden': 'true' }), active ? h('b', { class: 'lx-live', title: tr('Now learning') }) : null, STATUS[st]), l.optional ? h('span', { class: 'lx-opt' }, tr('Optional')) : null),
        action(l),
        chev,
      ),
    );
    if (kids.length) {
      const sub = h('div', { class: 'lx-kids', hidden: !opened }, ...kids.map((x) => row(x, [], true)));
      el.append(sub);
      (chev as HTMLButtonElement).onclick = () => {
        const now = !path.open.has(k);
        if (now) path.open.add(k);
        else path.open.delete(k);
        sub.hidden = !now;
        el.classList.toggle('open', now);
        chev.setAttribute('aria-expanded', String(now));
      };
    }
    return el;
  };

  const draw = () => {
    const q = path.q.trim().toLowerCase();
    const hit = (l: Level) => (!path.cat || l.cat === path.cat) && (!q || `${l.n} ${l.t} ${l.d}`.toLowerCase().includes(q));
    let tops = levels.filter((l) => !parentOf(l));
    const kidsOf = (p: Level) => levels.filter((l) => parentOf(l) === p && hit(l));
    tops = tops.filter((l) => hit(l) || kidsOf(l).length);
    const rank = { done: 2, progress: 0, todo: 1 };
    if (path.sort === 'todo') tops = [...tops].sort((a, b) => rank[status(a)] - rank[status(b)]);
    if (path.sort === 'done') tops = [...tops].sort((a, b) => Number(isDone(b)) - Number(isDone(a)));
    clear(list);
    clear(moreRow);
    // All Lessons in level order: three groups, Foundations, Mastering Mahjong, then the variations (only those fold behind Show more).
    const grouped = !path.cat && path.sort === 'level';
    list.classList.toggle('grouped', grouped);
    if (grouped) list.removeAttribute('role');
    else list.setAttribute('role', 'list');
    if (grouped) {
      let hidden = 0;
      for (const c of CATS) {
        if (!c.id) continue;
        let mine = tops.filter((l) => l.cat === c.id);
        if (!mine.length) continue;
        const limit = c.id === 'regional' && !path.more && !q ? SHOWN : mine.length;
        hidden += mine.length - Math.min(limit, mine.length);
        mine = mine.slice(0, limit);
        list.append(
          h(
            'section',
            { class: `lx-group ${c.id}`, 'aria-label': c.head ?? c.label },
            h('header', { class: 'lx-group-head' }, h('span', { class: 'lx-ico', 'aria-hidden': 'true', html: icon(c.icon) }), h('h3', {}, c.head ?? c.label), h('span', { class: 'lx-range' }, tr('Levels {n}', { n: c.range ?? '' }))),
            h('div', { class: 'lx-list', role: 'list' }, ...mine.map((l) => row(l, kidsOf(l)))),
          ),
        );
      }
      if (!tops.length) list.append(h('p', { class: 'lx-empty' }, tr('No lessons match.')));
      if (hidden) moreRow.append(h('button', { class: 'btn sm ghost', type: 'button', onclick: () => ((path.more = true), draw()) }, tr('Show more'), h('span', { class: 'tf-left' }, `(${hidden})`), h('span', { html: icon('chevronDown') })));
      return;
    }
    const limit = path.more || q || path.cat ? tops.length : SHOWN;
    list.append(...tops.slice(0, limit).map((l) => row(l, kidsOf(l))));
    if (!tops.length) list.append(h('p', { class: 'lx-empty' }, tr('No lessons match.')));
    if (tops.length > limit) moreRow.append(h('button', { class: 'btn sm ghost', type: 'button', onclick: () => ((path.more = true), draw()) }, tr('Show more'), h('span', { class: 'tf-left' }, `(${tops.length - limit})`), h('span', { html: icon('chevronDown') })));
  };

  const chips = h(
    'div',
    { class: 'lx-cats', role: 'radiogroup', 'aria-label': tr('Lesson type') },
    ...CATS.map((c) => {
      const b = h('button', { type: 'button', role: 'radio', class: path.cat === c.id ? 'on' : '', 'aria-checked': String(path.cat === c.id) }, h('span', { html: icon(c.icon) }), c.label);
      b.onclick = () => {
        path.cat = c.id;
        chips.querySelectorAll('button').forEach((x) => (x.classList.toggle('on', x === b), x.setAttribute('aria-checked', String(x === b))));
        draw();
      };
      return b;
    }),
  );
  pickCat = (c) => (chips.querySelectorAll('button')[CATS.findIndex((x) => x.id === c)] as HTMLButtonElement | undefined)?.click();
  const search = h('input', { type: 'search', class: 'lx-search-in', placeholder: tr('Search lessons…'), 'aria-label': tr('Search lessons'), value: path.q, autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
  search.oninput = () => ((path.q = search.value), draw());
  const sort = h(
    'select',
    { class: 'lx-sort', 'aria-label': tr('Sort') },
    h('option', { value: 'level', selected: path.sort === 'level' }, tr('Level order')),
    h('option', { value: 'todo', selected: path.sort === 'todo' }, tr('To do first')),
    h('option', { value: 'done', selected: path.sort === 'done' }, tr('Completed first')),
  ) as HTMLSelectElement;
  sort.onchange = () => ((path.sort = sort.value as typeof path.sort), draw());
  draw();
  return h(
    'section',
    { class: 'lx-path', 'aria-label': tr('Learning path') },
    h('div', { class: 'lx-bar' }, chips, h('div', { class: 'lx-tools' }, h('label', { class: 'lx-search' }, h('span', { html: icon('search') }), search), h('label', { class: 'lx-sort-wrap' }, h('span', { html: icon('sort') }), sort))),
    h('div', { class: 'lx-list-wrap' }, list),
    moreRow,
  );
}

/** The lesson after `id` on the learning path that is still to learn (or the first one left anywhere); null once every lesson is done. */
export function nextAfter(app: App, id: string): Lesson | null {
  const order = ACADEMY_ORDER as Lesson[];
  const todo = (l: Lesson) => l !== id && !!LESSONS[l] && !app.profile.lessonsDone.includes(l);
  const at = order.indexOf(id as Lesson);
  return order.slice(at + 1).find(todo) ?? order.find(todo) ?? null;
}

/** The lesson to suggest after a guided game: that table's own lesson if it is still to learn, else the next one in the Academy. */
export function nextLesson(app: App): Lesson {
  // A guided game that follows a lesson (Words, Tradition) leads on to the lesson after it.
  if (app.guidedTheme) return nextAfter(app, app.guidedTheme) ?? 'riichi';
  const done = (l: Lesson) => app.profile.lessonsDone.includes(l);
  // Level 2's guided game is an India Rules hand: it follows the Basics, so it leads on along the path, never to the India Rules course (Level 13).
  const own = (app.guidedVariation === 'classic' || app.guidedVariation === 'india' ? 'basics' : app.guidedVariation) as Lesson;
  if (own in LESSONS && !done(own)) return own;
  return (ACADEMY_ORDER.filter((l) => !OPTIONAL_LESSONS.includes(l)) as Lesson[]).find((l) => !done(l)) ?? 'riichi';
}
