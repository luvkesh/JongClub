// The end of a game: results and rewards, sharing, and the spectator's end card.

import { tablePlacement } from '../../club/placement';
import { placementCell } from '../placementUi';
import { narrator } from '../../audio/voice';
import { getProfile } from '../../engine/rules';
import { ACHIEVEMENTS, applyMatch, levelOf, ordinal, saveProfile, type MatchSummary } from '../../progression/profile';
import { LESSONS } from '../academy';
import { dailyOnFinish, rankedFieldFromTag, tournamentOnFinish } from '../compete';
import { seasonOnGame } from '../../progression/season';
import { clear, copyWithNote, fmt, h } from '../dom';
import { saveReplay, type ReplayRecord } from '../../net/replay';
import { clubOnFinish } from '../../club/privateClubs';
import { keyMomentsSection } from '../keyMoments';
import { recordGameSkills } from '../../progression/skills';
import { saveProgressCard } from '../../auth/prompt';
import { andList, tr } from '../../i18n';
import type { App } from '../app';
import { autostartLesson, nextAfter, nextLesson } from './learn';
import { ICONS, LAUREL, SCENE } from '../resultsLook';

let renameOnCard: (() => void) | null = null;

/** Show the player's (new) name on the results card, if one is open. */
export function refreshResultsName() {
  renameOnCard?.();
}

export function showResults(app: App, summary: MatchSummary, standings: { name: string; score: number; seat: number }[], insight: string, replay: ReplayRecord) {
  saveReplay(replay);
  recordGameSkills(replay);
  const wasLive = !!app.live;
  if (app.live) {
    // Remember the people you played with.
    for (const n of replay.names) if (n !== app.profile.name && !app.profile.friends.some((f) => f.name === n) && app.match?.seats.some((x) => x.name === n && x.kind !== 'ai')) app.profile.friends.push({ id: `live:${n}`, name: n, since: new Date().toISOString() });
    void app.live.leave();
    app.live = null;
  }
  const spectated = replay.me < 0;
  const tag = app.curTag;
  const me = replay.me;
  const ratings = rankedFieldFromTag(tag);
  if (ratings && summary.ranked) {
    // Opponents sit in seats 1..3 in the order the tag lists them.
    const placeOf = (score: number, seat: number) => standings.filter((o) => o.seat !== seat && o.score >= score).length + 1;
    summary.field = standings.flatMap((s) => (s.seat === me ? [] : [{ rating: ratings[s.seat - 1] ?? app.profile.rating, place: placeOf(s.score, s.seat) }]));
  }
  const rewards = spectated ? null : applyMatch(app.profile, summary);
  if (!spectated) clubOnFinish(tag, summary.placement);
  const extra: HTMLElement[] = [];
  if (!spectated && tag?.startsWith('daily:')) {
    const line = dailyOnFinish(app.ctx(), tag, summary);
    if (line) extra.push(infoLine('daily', line));
  }
  const seasonLine = spectated ? null : seasonOnGame(summary);
  if (seasonLine) extra.push(infoLine('season', seasonLine));
  const guided = tag === 'tutorial';
  // A lesson's practice game leads straight on to the next lesson.
  const afterLesson = tag?.startsWith('lesson:') ? nextAfter(app, tag.slice(7)) : null;
  if (guided && rewards) {
    if (!app.profile.lessonsDone.includes('guided')) app.profile.lessonsDone.push('guided');
    saveProfile(app.profile);
    const coach = app.lastOpts.coach;
    window.setTimeout(() => coach?.finish(), 600);
    extra.push(infoLine('academy', tr('Guided game complete. Next in the Academy: {lesson}.', { lesson: '\u0000' }), LESSONS[nextLesson(app)].title));
  }
  if (!rewards) {
    return showSpectatorEnd(app, standings, replay);
  }
  const lv = levelOf(app.profile.xp);
  const title = matchTitle(summary);
  const o = app.modal;
  clear(o).hidden = false;
  const top = topLine(standings, (s) => (s.seat === me ? app.profile.name : s.name));
  const tourney = tag === 'tournament' ? h('p', { class: 'tourney-line daily-line muted' }, tr('Playing out the other tables…')) : null;
  if (tourney) tournamentOnFinish(app.ctx(), standings.map((s) => ({ seat: s.seat, score: s.score })), (line) => {
    tourney.textContent = line;
    if (app.screen === 'tournaments' && !app.match && o.hidden) app.go('tournaments');
  });
  const uma = tablePlacement(app.lastConfig.houseRules, replay.finalScores, getProfile(app.lastConfig.variation)?.startingScore ?? 0);
  const ratingNote = summary.ranked ? tr('Ranked: {change}', { change: `${rewards.ratingAfter >= rewards.ratingBefore ? '+' : '−'}${fmt(Math.abs(rewards.ratingAfter - rewards.ratingBefore))}` }) : tr('Unranked game');
  const card = h(
    'div',
    { class: 'results' },
    h('div', { class: 'res-scene', 'aria-hidden': 'true', html: SCENE }),
    h('p', { class: 'eyebrow res-eyebrow' }, h('span', {}, title)),
    top,
    h('ol', { class: 'standings' }, ...standings.map((s, i) => h('li', { class: s.seat === me ? 'me' : '' }, h('span', { class: 'pl' }, firstPlace(standings, i) ? h('span', { class: 'laurel', 'aria-hidden': 'true', html: LAUREL }) : '', placeLabel(standings, i)), h('span', { class: 'nm' }, s.seat === me ? tr('{name} (you)', { name: app.profile.name }) : s.name), h('span', { class: 'num' }, fmt(s.score)), uma ? placementCell(uma[s.seat]) : ''))),
    standings.some((o) => o.seat !== me && o.score === standings.find((x) => x.seat === me)?.score) ? h('p', { class: 'muted small', style: { margin: '-8px 0 14px' } }, tr('A shared place earns the reward for the lower place.')) : '',
    uma ? h('p', { class: 'muted small' }, tr('Tournament scoring: placement points are the bonus for each place plus the score difference.')) : '',
    h(
      'div',
      { class: 'rewards' },
      h('div', { class: 'reward big' }, h('span', { class: 'k' }, ric('points'), tr('Jong Points')), h('span', { class: 'v' }, `+${fmt(rewards.jongPoints)}`)),
      h('div', { class: 'reward' }, h('span', { class: 'k' }, ric('rating'), tr('Rating')), h('span', { class: 'v sm' }, `${fmt(rewards.ratingBefore)} → ${fmt(rewards.ratingAfter)}`), h('span', { class: 'note' }, ratingNote)),
      h('div', { class: 'reward' }, h('span', { class: 'k' }, ric('level'), tr('Club Level')), h('span', { class: 'v sm' }, rewards.levelAfter > rewards.levelBefore ? `${rewards.levelBefore} → ${rewards.levelAfter}` : String(lv.level)), h('div', { class: 'xpbar' }, h('i', { style: { width: `${(lv.into / lv.need) * 100}%` } }))),
      h('div', { class: 'reward' }, h('span', { class: 'k' }, ric('best'), tr('Best hand')), h('span', { class: 'v sm' }, summary.bestHand ? tr('{n} pts', { n: fmt(summary.bestHand.points) }) : '—')),
    ),
    h(
      'div',
      { class: 'res-panel' },
      h('ul', { class: 'breakdown' }, ...rewards.breakdown.map((b) => h('li', {}, h('span', {}, b.label), h('span', { class: 'num' }, `+${fmt(b.points)}`)))),
      rewards.unlocked.length ? h('div', { class: 'unlocked' }, ...rewards.unlocked.map((id) => h('span', { class: 'chip' }, h('i', { class: 'dm', 'aria-hidden': 'true' }), ACHIEVEMENTS.find((a) => a.id === id)?.name ?? id))) : null,
      ...extra,
      tourney ?? '',
    ),
    h('div', { class: 'insight' }, h('span', { class: 'iic', 'aria-hidden': 'true', html: ICONS.insight }), h('div', { class: 'itext' }, h('span', { class: 'eyebrow' }, tr('Game insight')), h('p', {}, insight))),
    keyMomentsSection(replay, app.settings.labels, (hand, step) => ((o.hidden = true), narrator.stop(), app.closeMatchUi(), app.openReplay(replay, { hand, step }))),
    h(
      'div',
      { class: 'btn-row' },
      h('button', { class: 'btn ghost', onclick: () => ((o.hidden = true), app.closeMatchUi(), app.openReplay(replay)) }, tr('Review Game')),
      h('button', { class: 'btn ghost', onclick: (e: Event) => shareResult(app, e.currentTarget as HTMLButtonElement, summary, standings, me) }, tr('Share')),
      guided
        ? h('button', { class: 'btn', onclick: () => ((o.hidden = true), narrator.stop(), app.closeMatchUi(), app.startGuided(app.guidedVariation, app.guidedTheme)) }, tr('Play another guided hand'))
        : tag === 'tournament' || tag?.startsWith('daily:') || wasLive ? '' : h('button', { class: 'btn', onclick: () => ((o.hidden = true), app.closeMatchUi(), app.startMatch(app.lastConfig, app.lastOpts)) }, tr('Rematch')),
      guided
        ? h('button', { class: 'btn primary', onclick: () => ((o.hidden = true), narrator.stop(), app.closeMatchUi(), (app.learnLesson = nextLesson(app)), autostartLesson(), app.go('learn')) }, tr('Continue the Academy'))
        : afterLesson
          ? h('button', { class: 'btn primary', onclick: () => ((o.hidden = true), app.closeMatchUi(), (app.learnLesson = afterLesson), autostartLesson(), app.go('learn')) }, tr('Next lesson'))
          : h('button', { class: 'btn primary', onclick: () => ((o.hidden = true), app.closeMatchUi(), app.go('play')) }, tr('Return to Lobby')),
    ),
    // A guest who has just earned something: offer, gently, to keep it (src/auth/prompt.ts).
    saveProgressCard('results', { points: app.profile.jongPoints }),
  );
  o.append(card);
  // Signing in from the "Save your progress?" offer on this card renames you here (app.ts, ACCOUNT_EVENT).
  renameOnCard = () => {
    if (o.hidden || !card.isConnected) return;
    if (me >= 0) replay.names[me] = app.profile.name;
    card.querySelector('.results-title')?.replaceWith(topLine(standings, (s) => (s.seat === me ? app.profile.name : s.name)));
    const nm = card.querySelector('.standings li.me .nm');
    if (nm) nm.textContent = tr('{name} (you)', { name: app.profile.name });
  };
}

/** Copy a short summary of the game to the clipboard. */
function shareResult(app: App, btn: HTMLButtonElement, summary: MatchSummary, standings: { name: string; score: number; seat: number }[], me: number) {
  const place = sharedPlace(standings, standings.findIndex((s) => s.seat === me));
  const v = getProfile(app.lastConfig.variation)?.name ?? tr('Mahjong');
  const text = [`JongClub · ${v} · ${tr(summary.lengthLabel)}`, summary.bestHand ? tr('I finished {place} of {total}, best hand {n} pts.', { place: ordinal(place), total: standings.length, n: fmt(summary.bestHand.points) }) : tr('I finished {place} of {total}.', { place: ordinal(place), total: standings.length }), ...standings.map((s, i) => `${placeLabel(standings, i)} ${s.seat === me ? app.profile.name : s.name} ${fmt(s.score)}`), tr('The Table Awaits.')].join('\n');
  void copyWithNote(btn, text, btn.textContent || tr('Share'));
}

function showSpectatorEnd(app: App, standings: { name: string; score: number; seat: number }[], replay: ReplayRecord) {
  const o = app.modal;
  clear(o).hidden = false;
  o.append(
    h(
      'div',
      { class: 'results' },
      h('p', { class: 'eyebrow res-eyebrow' }, h('span', {}, tr('GAME COMPLETE'))),
      topLine(standings, (s) => s.name),
      h('ol', { class: 'standings' }, ...standings.map((s, i) => h('li', {}, h('span', { class: 'pl' }, placeLabel(standings, i)), h('span', { class: 'nm' }, s.name), h('span', { class: 'num' }, fmt(s.score))))),
      h(
        'div',
        { class: 'btn-row' },
        h('button', { class: 'btn ghost', onclick: () => ((o.hidden = true), app.closeMatchUi(), app.openReplay(replay)) }, tr('Review Game')),
        h('button', { class: 'btn primary', onclick: () => ((o.hidden = true), app.closeMatchUi(), app.go('play')) }, tr('Return to Lobby')),
      ),
    ),
  );
}

type Standing = { name: string; score: number; seat: number };

/** Place by score, shared on a tie: two players on the top score are both 1st. */
export function sharedPlace(standings: Standing[], i: number): number {
  return 1 + standings.filter((o) => o.score > standings[i].score).length;
}

/** "1st", or "=1st" when the place is shared. */
export function placeLabel(standings: Standing[], i: number): string {
  const tied = standings.filter((o) => o.score === standings[i].score).length > 1;
  return `${tied ? '=' : ''}${ordinal(sharedPlace(standings, i))}`;
}

/** The results heading: the winner, everyone sharing the top score, or no winner at all after a drawn game. */
function topLine(standings: Standing[], name: (s: Standing) => string): HTMLElement {
  const best = standings.filter((s) => s.score === standings[0].score);
  if (best.length === standings.length) return h('h2', { class: 'results-title' }, tr('All square: no winner'));
  return h('h2', { class: 'results-title' }, h('span', { class: 'laurel', 'aria-hidden': 'true', html: LAUREL }), h('span', { class: 'ord' }, best.length > 1 ? `=${ordinal(1)}` : ordinal(1)), h('span', { class: 'sep' }, '·'), h('span', { class: 'who' }, andList(best.map(name))));
}

/** First place (shared or not), unless everyone finished level. */
function firstPlace(standings: Standing[], i: number): boolean {
  return sharedPlace(standings, i) === 1 && standings.some((o) => o.score !== standings[i].score);
}

/** A reward card's small icon. */
function ric(icon: keyof typeof ICONS): HTMLElement {
  return h('span', { class: 'ric', 'aria-hidden': 'true', html: ICONS[icon] });
}

/** A line under the points (season, Academy, daily): its icon, the text, and a name in gold where the text marks one with \u0000. */
function infoLine(icon: keyof typeof ICONS, text: string, gold?: string): HTMLElement {
  const [before, after] = text.split('\u0000');
  return h('p', { class: 'daily-line' }, h('span', { class: 'lic', 'aria-hidden': 'true', html: ICONS[icon] }), h('span', {}, before, gold !== undefined && after !== undefined ? h('span', { class: 'gold' }, gold) : '', after ?? ''));
}

/** The results title from the format and the winds the match covered. */
export function matchTitle(summary: Pick<MatchSummary, 'length' | 'lengthLabel' | 'winds'>): string {
  const len = summary.length ?? Object.entries({ 'Single hand': 'oneHand', 'East + South': 'eastSouth', 'Full E-S-W-N': 'fullNews' }).find(([k]) => k === summary.lengthLabel)?.[1] ?? 'eastRound';
  const winds = summary.winds ?? [];
  if (len === 'oneHand') return tr('HAND COMPLETE');
  if (len === 'timed' || len === 'suddenDeath') return tr('MATCH COMPLETE');
  if (len === 'fullNews' || winds.length === 4) return tr('NEWS MATCH COMPLETE');
  if (winds.length === 2 && winds[0] === 'E' && winds[1] === 'S') return tr('SOUTH ROUND COMPLETE');
  if (winds.length > 1) return tr('MATCH COMPLETE');
  return { S: tr('SOUTH ROUND COMPLETE'), W: tr('WEST ROUND COMPLETE'), N: tr('NORTH ROUND COMPLETE') }[winds[0] ?? 'E'] ?? tr('EAST ROUND COMPLETE');
}
