// Competitive screens: daily challenges, ranked play and tournaments.

import { PERSONALITIES, type Personality } from '../ai/players';
import { pointsText, setTournamentScoringPref, tournamentScoringPref } from './placementUi';
import {
  DAILY_SWEEP_BONUS,
  clubRegular,
  dailyChallenges,
  dailyKey,
  dailyRewards,
  pungKindsFromResult,
  scorePerfectDiscard,
  scoreSpeedJong,
  scoreTodaysHand,
  speedJongRating,
  startingScoreOf,
  type DailyChallengeId,
  type DailyTableSpec,
  type FourWindsSummary,
} from '../club/daily';
import { ROSTER, type ClubMember } from '../club/roster';
import { shieldLine, shieldedDays } from '../club/streakShield';
import { addSeasonXp } from '../progression/season';
import { SEASON_XP } from '../club/seasons';
import { PLACEMENT_RULE, FORMATS, FORMAT_IDS, TROPHIES, createTournament, entryStatus, humanPrize, humanTable, isFinalNext, nextRound, pendingAiTables, playAiTable, playRound, standings, startTime, tournamentVariation, type TournamentState } from '../club/tournament';
import { byId } from '../cosmetics/catalog';
import type { MahjongGame } from '../engine/game';
import { randomSeed } from '../engine/rng';
import { GAME_LENGTHS } from '../engine/rounds';
import { VARIATIONS, seatsOf } from '../engine/rules';
import type { HandResult } from '../engine/state';
import { leagueOf, saveProfile, unlock, type MatchSummary } from '../progression/profile';
import type { AppCtx } from './ctx';
import { clear, fmt, h, tileImg } from './dom';
import { icon } from './icons';
import './daily.css';
import type { SeatSpec, TableConfig } from './match';
import { lang, tr, trn } from '../i18n';
import { tileLabel } from '../i18n/tiles';

const vinfo = (id: string) => VARIATIONS.find((v) => v.id === id) ?? VARIATIONS[0];

const page = (eyebrow: string, title: string, ...body: (Node | string | null)[]) => {
  // A back button given first goes at the top of the header.
  const back = body[0] instanceof HTMLElement && body[0].classList.contains('page-back') ? (body.shift() as HTMLElement) : null;
  return h('div', { class: 'page' }, h('header', { class: 'page-head' }, back, h('p', { class: 'eyebrow' }, eyebrow), h('h2', {}, title)), ...body);
};

/** Seats for a table of three roster members. */
function seatsFor(you: string, members: { name: string; difficulty: string; personality: string }[]): SeatSpec[] {
  return [{ kind: 'local', name: you }, ...members.map((m): SeatSpec => ({ kind: 'ai', name: m.name, difficulty: m.difficulty as SeatSpec['difficulty'], personality: m.personality as Personality }))];
}

function specConfig(spec: DailyTableSpec, length = spec.length): TableConfig {
  return { name: spec.name, variation: spec.variation, length, difficulty: spec.difficulty, personalities: spec.personalities, houseRules: spec.houseRules, timer: spec.timer, hints: spec.hints };
}

// ================================================================ daily

/** Record a daily result once (best kept) and pay the reward the first time. */
function recordDaily(ctx: AppCtx, id: DailyChallengeId, field: 'hand' | 'discard' | 'speed' | 'winds' | 'variation', value: number | boolean, done: boolean): string | null {
  const p = ctx.profile;
  const key = dailyKey();
  const rec = (p.daily[key] ??= {});
  const before = rec[field];
  const firstDone = done && (before === undefined || before === false || (field === 'speed' && before === 0));
  if (typeof value === 'number') (rec as Record<string, unknown>)[field] = Math.max(Number(before ?? (field === 'speed' ? 0 : -Infinity)), value);
  else (rec as Record<string, unknown>)[field] = !!before || value;
  let note: string | null = null;
  if (firstDone) {
    p.jongPoints += dailyRewards[id];
    note = tr('+{n} Jong Points', { n: dailyRewards[id] });
    addSeasonXp('daily', SEASON_XP.daily);
    const all = ['hand', 'discard', 'speed', 'winds', 'variation'].every((f) => {
      const v = (rec as Record<string, unknown>)[f];
      return v !== undefined && v !== false;
    });
    if (all) {
      p.jongPoints += DAILY_SWEEP_BONUS;
      note += ` · ${tr('all five done: +{n}', { n: DAILY_SWEEP_BONUS })}`;
    }
  }
  if (!p.daysPlayed.includes(key)) p.daysPlayed = [...p.daysPlayed, key].slice(-60);
  if (clubRegular(shieldedDays(p.daysPlayed)).achieved) unlock(p, 'club-regular');
  saveProfile(p);
  return note;
}

const fwState = { dealtIn: false, met: false };

/** A fresh Four Winds attempt starts clean. */
export function resetFourWinds() {
  fwState.dealtIn = false;
  fwState.met = false;
}

/** Called by the app after each hand of a tagged game. */
export function dailyOnHand(ctx: AppCtx, tag: string, r: HandResult, g: MahjongGame, me: number) {
  const d = dailyChallenges();
  const won = r.type === 'win' && r.winner === me;
  if (tag === 'daily:todaysHand') {
    const score = scoreTodaysHand(d.todaysHand.variation, r.deltas[me] ?? 0, won);
    recordDaily(ctx, 'todaysHand', 'hand', score, true);
  } else if (tag === 'daily:speedJong') {
    const turns = g.players[me].discards.length + (won ? 1 : 0);
    recordDaily(ctx, 'speedJong', 'speed', scoreSpeedJong(turns, won), won);
  } else if (tag === 'daily:fourWinds') {
    if (r.type === 'win' && r.discarder === me) fwState.dealtIn = true;
    const s: FourWindsSummary = {
      won,
      seatWind: g.state.seatWinds[me],
      roundWind: g.state.prevailingWind,
      dealerAtWin: won && g.state.seatWinds[me] === 'E',
      pungKindsAtWin: won ? pungKindsFromResult(r) : [],
      dealtIn: fwState.dealtIn,
      length: d.fourWinds.length,
    };
    if (d.fourWinds.check(s)) fwState.met = true;
  }
}

/** Called by the app when a tagged game ends. Returns a line for the results screen. */
export function dailyOnFinish(ctx: AppCtx, tag: string, m: MatchSummary): string | null {
  const d = dailyChallenges();
  if (tag === 'daily:fourWinds') {
    const s: FourWindsSummary = { won: false, seatWind: 'E', roundWind: 'E', dealerAtWin: false, pungKindsAtWin: [], dealtIn: fwState.dealtIn, length: d.fourWinds.length, matchComplete: true };
    const met = fwState.met || d.fourWinds.check(s);
    fwState.met = false;
    fwState.dealtIn = false;
    const note = recordDaily(ctx, 'fourWinds', 'winds', met, met);
    return met ? `${tr('Four Winds complete: {title}.', { title: d.fourWinds.title })} ${note ?? ''}` : tr('Four Winds not yet: {detail}', { detail: d.fourWinds.detail });
  }
  if (tag === 'daily:variation') {
    const ok = d.variation.check({ variation: m.variation, placement: m.placement, handsWon: m.handsWon });
    const note = recordDaily(ctx, 'variation', 'variation', ok, ok);
    return ok ? `${tr('{title} complete.', { title: d.variation.title })} ${note ?? ''}` : `${d.variation.title}: ${d.variation.target}`;
  }
  if (tag === 'daily:todaysHand') return tr('Today’s Hand recorded: {n} points.', { n: fmt(ctx.profile.daily[dailyKey()]?.hand ?? 0) });
  if (tag === 'daily:speedJong') {
    const sp = ctx.profile.daily[dailyKey()]?.speed ?? 0;
    return sp ? tr('Speed Jong: {n} points.', { n: fmt(sp) }) : tr('Speed Jong: win the hand to post a time.');
  }
  return null;
}

/** Club members' results today, made from the day's seed so everyone sees the same table. */
function clubToday(seedKey: string, mine: number | undefined, label: (n: number) => string) {
  let x = 0;
  for (const c of seedKey) x = (x * 31 + c.charCodeAt(0)) >>> 0;
  const rows = ROSTER.slice()
    .sort((a, b) => ((a.rating * 7 + x) % 97) - ((b.rating * 7 + x) % 97))
    .slice(0, 9)
    .map((m) => ({ name: m.name, city: m.city, v: Math.round(((m.rating - 800) / 1500) * 900 + ((x ^ (m.rating * 2654435761)) % 300)) }));
  if (mine !== undefined) rows.push({ name: 'You', city: '', v: mine });
  rows.sort((a, b) => b.v - a.v);
  return h(
    'ol',
    { class: 'board' },
    ...rows.map((r, i) => h('li', { class: r.name === 'You' ? 'me' : '' }, h('span', { class: 'rk' }, String(i + 1)), h('span', { class: 'nm' }, r.name, r.city ? h('em', {}, ` ${r.city}`) : ''), h('span', { class: 'num' }, label(r.v)))),
  );
}

export function dailyScreen(ctx: AppCtx) {
  const d = dailyChallenges();
  const p = ctx.profile;
  const rec = p.daily[d.key] ?? {};
  // Days a streak shield covered count too (src/club/streakShield.ts).
  const streak = clubRegular(shieldedDays(p.daysPlayed));
  const you = p.name;

  const playSpec = (spec: DailyTableSpec, tag: string, maxHands?: number) => () =>
    ctx.startMatch(specConfig(spec), { seed: spec.seed, seats: seatsFor(you, spec.opponents), mode: 'daily', tag, maxHands });

  const card = (cls: string, title: string, done: boolean, reward: number, ...body: (Node | string | null)[]) =>
    h(
      'article',
      { class: `daily-card dx-card ${cls} ${done ? 'done' : ''}` },
      h('div', { class: 'dc-head' }, h('h3', {}, title), h('span', { class: 'dc-reward' }, done ? h('span', { class: 'dc-done' }, h('span', { html: icon('check') }), tr('Done')) : tr('+{n} JP', { n: reward }))),
      ...body,
    );
  const go = (label: string, run: () => void, primary = true) => h('button', { class: `btn ${primary ? 'primary' : ''} dx-go`, onclick: run }, label, h('span', { html: icon('arrowRight') }));
  const medal = (...inner: (Node | string)[]) => h('div', { class: 'dx-medal', 'aria-hidden': 'true' }, ...inner);

  const th = d.todaysHand;
  const sj = d.speedJong;
  const fw = d.fourWinds;
  const vc = d.variation;

  // Perfect discard puzzle, inline.
  const puzzle = d.perfectDiscard;
  const pz = h('div', { class: 'puzzle' });
  const renderPuzzle = (picked?: number) => {
    clear(pz);
    const hand = h('div', { class: 'pz-hand', role: 'group', 'aria-label': tr('Your hand: pick the best discard') });
    puzzle.hand.forEach((k) => {
      const b = h('button', { class: `pz-tile ${picked === k ? 'picked' : ''} ${(picked !== undefined || rec.discard !== undefined) && puzzle.answers[0].kind === k ? 'best' : ''}`, disabled: picked !== undefined || rec.discard !== undefined, 'aria-label': tr('Discard {tile}', { tile: tileLabel(k) }) }, tileImg(k, '', ctx.labels));
      b.onclick = () => {
        const score = scorePerfectDiscard(puzzle, k);
        recordDaily(ctx, 'perfectDiscard', 'discard', score, true);
        // Re-render the page so the card shows it is done.
        ctx.go('daily');
      };
      hand.append(b);
    });
    pz.append(
      h('p', { class: 'muted small' }, `${vinfo(puzzle.variation).name} · ${tr('seat wind {seat}, round wind {round}. Which tile would you discard?', { seat: puzzle.seatWind, round: puzzle.roundWind })}`),
      puzzle.doraKinds?.length ? h('p', { class: 'muted small pz-dora' }, tr('Dora: '), ...puzzle.doraKinds.map((k) => tileImg(k, 'mini', ctx.labels))) : '',
      hand,
    );
    const prior = rec.discard;
    if (picked !== undefined || prior !== undefined) {
      const score = picked !== undefined ? scorePerfectDiscard(puzzle, picked) : Number(prior);
      pz.append(
        h('p', { class: 'pz-score' }, score >= 100 ? tr('Perfect discard!') : score >= 80 ? tr('Very close.') : tr('Not quite.'), ` ${score} / 100`),
        h('p', { class: 'muted' }, puzzle.explanation),
        h('ol', { class: 'pz-answers' }, ...puzzle.answers.slice(0, 4).map((a) => h('li', {}, tileImg(a.kind, 'mini', ctx.labels), h('span', {}, a.note), h('span', { class: 'num' }, String(a.score))))),
      );
    }
  };
  renderPuzzle();

  const grid = h(
    'div',
    { class: 'daily-grid' },
    card(
      'dx-hand',
      tr('Today’s Hand'),
      rec.hand !== undefined,
      dailyRewards.todaysHand,
      h('p', { class: 'dx-lead' }, h('span', { class: 'dx-flag', 'aria-hidden': 'true' }, vinfo(th.variation).flag), `${vinfo(th.variation).name}. ${tr('Everyone gets the same deal and the same three opponents today.')}`),
      h('p', { class: 'dx-note' }, th.metric),
      rec.hand !== undefined ? h('p', { class: 'dc-best' }, tr('Your best: {n}', { n: fmt(rec.hand) })) : '',
      go(rec.hand !== undefined ? tr('Play again') : tr('Play today’s hand'), playSpec(th, 'daily:todaysHand', 1)),
      h('details', { class: 'dc-board' }, h('summary', {}, tr('Club today')), clubToday(`${d.key}h`, rec.hand, (n) => fmt(n))),
    ),
    card('dx-discard', tr('Perfect Discard'), rec.discard !== undefined, dailyRewards.perfectDiscard, pz),
    card(
      'dx-speed',
      tr('Speed Jong'),
      !!rec.speed,
      dailyRewards.speedJong,
      h('div', { class: 'dx-row' }, medal(h('span', { html: icon('clock') })), h('p', { class: 'dx-lead' }, h('span', { class: 'dx-flag', 'aria-hidden': 'true' }, vinfo(sj.variation).flag), tr('Win one hand of {name} in as few turns as you can.', { name: vinfo(sj.variation).name }))),
      rec.speed ? h('p', { class: 'dc-best' }, tr('Your best: {n} points', { n: fmt(rec.speed) })) : '',
      go(tr('Start the clock'), playSpec(sj, 'daily:speedJong', 1)),
      h('details', { class: 'dc-board' }, h('summary', {}, tr('Club today')), clubToday(`${d.key}s`, rec.speed || undefined, (n) => fmt(n))),
    ),
    card(
      'dx-winds wide',
      `${tr('Four Winds')} · ${fw.title}`,
      !!rec.winds,
      dailyRewards.fourWinds,
      h(
        'div',
        { class: 'dx-row' },
        medal(tileImg(27, 'dx-medal-tile', ctx.labels)),
        h(
          'div',
          { class: 'dx-col' },
          h('p', { class: 'dx-lead' }, fw.detail),
          h('p', { class: 'dx-note' }, `${vinfo(fw.variation).name} · ${tr(GAME_LENGTHS[fw.length].label)}`),
          go(tr('Take on the winds'), () => ctx.startMatch({ ...ctx.tableFor(fw.variation), length: fw.length }, { mode: 'daily', tag: 'daily:fourWinds' })),
        ),
      ),
    ),
    card(
      'dx-variation wide',
      vc.title,
      !!rec.variation,
      dailyRewards.variation,
      h(
        'div',
        { class: 'dx-row' },
        medal(h('span', { class: 'dx-medal-flag' }, vinfo(vc.variation).flag)),
        h(
          'div',
          { class: 'dx-col' },
          h('p', { class: 'dx-lead' }, vc.target),
          go(tr('Play {name}', { name: vinfo(vc.variation).short }), () => ctx.startMatch({ ...ctx.tableFor(vc.variation), length: vc.length }, { mode: 'daily', tag: 'daily:variation' })),
        ),
      ),
    ),
  );

  return h(
    'div',
    { class: 'page daily-page' },
    h(
      'header',
      { class: 'page-head dx-head' },
      h('p', { class: 'eyebrow' }, `${tr('Daily challenges')} · ${new Date(d.key + 'T00:00:00Z').toLocaleDateString(lang(), { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })}`),
      h('h2', {}, tr('Today at the club')),
    ),
    h(
      'div',
      { class: 'streak dx-streak' },
      h('div', { class: 'dx-streak-main' }, h('span', { class: 'dx-crest', 'aria-hidden': 'true', html: icon('shield') }), h(
        'div',
        { class: 'dx-streak-body' },
        h('div', { class: 'dx-streak-top' }, h('span', { class: 'dx-streak-t' }, trn(streak.current, 'Club Regular: {n} day in a row', 'Club Regular: {n} days in a row')), h('div', { class: 'bar' }, h('i', { style: { width: `${Math.min(100, (streak.current / streak.target) * 100)}%` } }))),
        h('span', { class: 'dx-streak-note' }, tr('{n} days earns Club Regular. Complete all five today for +{bonus} more.', { n: streak.target, bonus: DAILY_SWEEP_BONUS })),
      )),
      h('div', { class: 'dx-shield shield-line' }, h('span', { html: icon('star') }), h('span', {}, shieldLine())),
    ),
    grid,
  );
}

// ================================================================ ranked

/** Three club members near your rating for a ranked table. */
function rankedField(rating: number, variation: string, seed: number): ClubMember[] {
  let x = seed >>> 0;
  const rnd = () => ((x = (Math.imul(x ^ (x >>> 15), 2246822507) + 0x9e3779b9) >>> 0) / 4294967296);
  const pool = ROSTER.map((m) => ({ m, key: Math.abs((m.ratings[variation as keyof ClubMember['ratings']] ?? m.rating) - rating) + rnd() * 220 }))
    .sort((a, b) => a.key - b.key)
    .slice(0, 3);
  return pool.map((p) => p.m);
}

export function openRanked(ctx: AppCtx) {
  const o = ctx.modal;
  clear(o).hidden = false;
  const p = ctx.profile;
  // Ranked tables seat four (three club members); three-seat games stay out until ranked fields can be sized.
  const playable = VARIATIONS.filter((v) => v.profile && seatsOf(v) === 4);
  let variation = p.loadout && p.history[0]?.variation && playable.some((v) => v.id === p.history[0].variation) ? p.history[0].variation : 'classic';
  const body = h('div', { class: 'card ranked-card' });
  const render = () => {
    const rating = p.ratings[variation] ?? p.rating;
    const league = leagueOf(rating);
    const games = p.ratedByVariation[variation] ?? 0;
    const field = rankedField(rating, variation, randomSeed());
    // Rebuilding the card empties it for a moment; keep the sheet where it was scrolled to on a phone.
    const keep = o.scrollTop;
    clear(body).append(
      h('p', { class: 'eyebrow' }, tr('Ranked')),
      h('h3', {}, `${league.icon} ${league.name} · ${fmt(rating)}`),
      h('p', { class: 'muted small' }, games < 10 ? tr('Placement: {n} of 10 games played. Your rating moves faster until then.', { n: games }) : tr('{n} ranked {name} games.', { n: games, name: vinfo(variation).short })),
      h('div', { class: 'seg', role: 'radiogroup', 'aria-label': tr('Variation') }, ...playable.map((v) => h('button', { class: v.id === variation ? 'on' : '', role: 'radio', 'aria-checked': String(v.id === variation), onclick: () => ((variation = v.id), render()) }, `${v.flag} ${v.short}`))),
      h('ul', { class: 'rules-list' }, h('li', {}, tr('One East round against three club members near your rating.')), h('li', {}, tr('JongBot is off and turns are timed (20 seconds).')), h('li', {}, tr('Your rating changes by where you finish against each opponent. Nothing you buy ever changes it.'))),
      h('p', { class: 'small' }, tr('Your table: '), field.map((m) => `${m.name} (${fmt(m.ratings[variation as keyof ClubMember['ratings']] ?? m.rating)})`).join(', ')),
      h(
        'div',
        { class: 'btn-row' },
        h('button', { class: 'btn ghost', onclick: () => (o.hidden = true) }, tr('Not now')),
        h(
          'button',
          {
            class: 'btn primary',
            onclick: () => {
              o.hidden = true;
              const cfg: TableConfig = { ...ctx.tableFor(variation), name: tr('Ranked Table'), length: 'eastRound', hints: false, timer: 20 };
              const seats = seatsFor(p.name, field.map((m) => ({ name: m.name, difficulty: m.difficulty, personality: m.personality })));
              ctx.startMatch(cfg, { seats, ranked: true, mode: 'ranked', tag: `ranked:${field.map((m) => m.ratings[variation as keyof ClubMember['ratings']] ?? m.rating).join(',')}` });
            },
          },
          tr('Find a ranked table'),
        ),
      ),
    );
    o.scrollTop = keep;
  };
  render();
  o.append(body);
}

/** Ratings of a ranked table's opponents, from the game's tag. */
export const rankedFieldFromTag = (tag: string | undefined) => (tag?.startsWith('ranked:') ? tag.slice(7).split(',').map(Number) : null);

// ================================================================ tournaments

const T_KEY = 'jongclub.tournament.v1';

export function loadTournament(): TournamentState | null {
  try {
    const raw = localStorage.getItem(T_KEY);
    return raw ? (JSON.parse(raw) as TournamentState) : null;
  } catch {
    return null;
  }
}

export function saveTournament(s: TournamentState | null) {
  try {
    if (s) localStorage.setItem(T_KEY, JSON.stringify(s));
    else localStorage.removeItem(T_KEY);
  } catch {
    /* ignore */
  }
}

/** Play your table of the current round. */
function playMyTable(ctx: AppCtx, s: TournamentState) {
  if (!s.current) {
    s = nextRound(s);
    saveTournament(s);
  }
  const t = humanTable(s);
  if (!t) return;
  const cfg: TableConfig = { ...ctx.tableFor(t.variation), name: `${s.name} · ${t.final ? tr('Final table') : tr('Round {n}', { n: s.roundsPlayed + 1 })}`, length: t.length, hints: false, timer: 30 };
  const seats = seatsFor(ctx.profile.name, t.opponents.map((o) => ({ name: o.name, difficulty: o.difficulty, personality: o.personality })));
  ctx.startMatch(cfg, { seed: t.seed, seats, mode: 'tournament', tag: 'tournament' });
}

/** The app calls this when your tournament table finishes. Simulates the rest of the round in small steps. */
const PENDING_KEY = 'jongclub.tournament.pending.v1';
let resolving = false;

/** True while the other tables of a round are still being played out. */
export const tournamentResolving = () => resolving;

export function tournamentOnFinish(ctx: AppCtx, standingsAtTable: { seat: number; score: number }[], done: (line: string) => void) {
  let s = loadTournament();
  if (!s || resolving) return;
  // Keep your result first, so a reload or a quick click elsewhere cannot lose or replay it.
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ id: s.id, round: s.roundsPlayed, result: standingsAtTable }));
  } catch {
    /* ignore */
  }
  resolving = true;
  const finish = (line: string) => {
    resolving = false;
    try {
      localStorage.removeItem(PENDING_KEY);
    } catch {
      /* ignore */
    }
    done(line);
  };
  const step = () => {
    try {
      stepInner();
    } catch {
      finish(tr('The round could not be completed. Your tournament is unchanged.'));
    }
  };
  const stepInner = () => {
    const pending = pendingAiTables(s!);
    if (pending.length) {
      s = playAiTable(s!, pending[0]);
      setTimeout(step, 0);
      return;
    }
    // Withdrawn meanwhile: stop quietly.
    if (loadTournament()?.id !== s!.id) return finish(tr('You left this tournament.'));
    s = playRound(s!, standingsAtTable);
    saveTournament(s);
    const me = standings(s).find((r) => r.human);
    if (s.finished) {
      const prize = humanPrize(s);
      if (prize) {
        const p = ctx.profile;
        p.jongPoints += prize.jongPoints;
        if (prize.cosmetic && !p.owned.includes(`frame:${prize.cosmetic}`)) p.owned.push(`frame:${prize.cosmetic}`);
        if (prize.trophy) {
          const tr = TROPHIES.find((x) => x.id === prize.trophy);
          p.trophies.push({ id: prize.trophy, name: tr?.name ?? prize.trophy, date: new Date().toISOString() });
        }
        saveProfile(p);
      }
      const pr = { name: s.name, rank: me?.rank ?? '?', n: s.entrants.length, points: fmt(prize?.jongPoints ?? 0) };
      finish(prize?.jongPoints ? (prize.trophy ? tr('{name} complete. You finished {rank} of {n}: +{points} Jong Points and a trophy', pr) : tr('{name} complete. You finished {rank} of {n}: +{points} Jong Points', pr)) : tr('{name} complete. You finished {rank} of {n}.', pr));
    } else finish(tr(isFinalNext(s) ? '{name}: you are {rank} of {n} after round {round}. The final table is next.' : '{name}: you are {rank} of {n} after round {round}.', { name: s.name, rank: me?.rank ?? '?', n: s.entrants.length, round: s.roundsPlayed }));
  };
  step();
}

/** Finish a round whose result was saved but not yet applied (e.g. the page was closed). */
function resumePending(ctx: AppCtx) {
  if (resolving) return;
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    const pend = raw ? JSON.parse(raw) : null;
    const s = loadTournament();
    if (!pend || !s || pend.id !== s.id || pend.round !== s.roundsPlayed) {
      if (raw) localStorage.removeItem(PENDING_KEY);
      return;
    }
    tournamentOnFinish(ctx, pend.result, () => ctx.go('tournaments'));
  } catch {
    /* ignore */
  }
}

export function tournamentsScreen(ctx: AppCtx): HTMLElement {
  const p = ctx.profile;
  resumePending(ctx);
  const current = loadTournament();
  const body: (Node | string)[] = [];

  if (current) {
    const rows = standings(current);
    const me = rows.find((r) => r.human);
    const t = current.current ? humanTable(current) : null;
    body.push(
      h(
        'section',
        { class: 'section t-live' },
        h('div', { class: 'section-head' }, h('h3', {}, `${current.name} · ${vinfo(current.variation).flag} ${vinfo(current.variation).short}`), h('p', { class: 'muted' }, current.finished ? tr('Finished') : tr('Round {n} · you are {rank} of {total}', { n: Math.min(current.roundsPlayed + 1, current.swissRounds + (FORMATS[current.formatId].finalTable ? 1 : 0)), rank: me?.rank ?? '?', total: rows.length }))),
        h(
          'div',
          { class: 'table-wrap' },
          h(
            'table',
            { class: 'history standings-table' },
            h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, tr('Player')), h('th', { class: 'num' }, tr('Points')), h('th', { class: 'num' }, tr('Score')), h('th', {}, tr('Places')))),
            h(
              'tbody',
              {},
              ...rows.slice(0, 16).map((r) => h('tr', { class: r.human ? 'me' : '' }, h('td', {}, String(r.rank)), h('td', {}, r.human ? tr('{name} (you)', { name: p.name }) : r.name), h('td', { class: 'num' }, pointsText(current.scoring, r.points)), h('td', { class: 'num' }, fmt(r.totalScore)), h('td', {}, r.placements.join(' · ') || '—'))),
              me && me.rank > 16 ? h('tr', { class: 'me' }, h('td', {}, String(me.rank)), h('td', {}, tr('{name} (you)', { name: p.name })), h('td', { class: 'num' }, pointsText(current.scoring, me.points)), h('td', { class: 'num' }, fmt(me.totalScore)), h('td', {}, me.placements.join(' · '))) : '',
            ),
          ),
        ),
        h(
          'div',
          { class: 'btn-row left' },
          current.finished
            ? h('button', { class: 'btn', onclick: () => (saveTournament(null), ctx.go('tournaments')) }, tr('Close this tournament'))
            : resolving
              ? h('p', { class: 'muted' }, tr('The other tables are finishing their round…'))
              : h('button', { class: 'btn primary', onclick: () => playMyTable(ctx, current) }, t?.final || isFinalNext(current) ? tr('Play the final table') : tr('Play round {n}', { n: current.roundsPlayed + 1 })),
          !current.finished && !resolving ? h('button', { class: 'btn ghost', onclick: () => (saveTournament(null), ctx.go('tournaments')) }, tr('Withdraw')) : '',
        ),
      ),
    );
  }

  const list = h('div', { class: 'tournaments' });
  for (const id of FORMAT_IDS) {
    const f = FORMATS[id];
    const gate = entryStatus(id, p.rating);
    const when = startTime(id);
    const v = vinfo(tournamentVariation(id));
    const first = f.prizes[0];
    const prizeText = `${tr('1st: {n} JP', { n: fmt(first.jongPoints) })}${first.cosmetic ? ` + ${byId('frame', first.cosmetic)?.name ?? tr('a frame')}` : ''}${first.trophy ? ` + ${TROPHIES.find((x) => x.id === first.trophy)?.name}` : ''}`;
    list.append(
      h(
        'article',
        { class: `t-card ${gate.locked ? 'locked' : ''}` },
        h('div', { class: 't-head' }, h('h3', {}, f.name), h('span', { class: 'chip sm' }, id === 'quick' ? tr('Now') : when.toLocaleString(lang(), { weekday: 'short', hour: '2-digit', minute: '2-digit' }))),
        h('dl', { class: 't-facts' }, h('dt', {}, tr('Entry')), h('dd', {}, f.entry ? tr('{n} JP', { n: fmt(f.entry) }) : tr('Free')), h('dt', {}, tr('Players')), h('dd', {}, String(f.maxPlayers)), h('dt', {}, tr('Game')), h('dd', {}, `${v.flag} ${v.short}`), h('dt', {}, tr('Prize')), h('dd', {}, prizeText)),
        h('p', { class: 'muted small' }, f.formatText),
        h('details', {}, h('summary', {}, tr('Rules')), h('p', { class: 'small' }, f.rulesText)),
        gate.locked
          ? h('p', { class: 'muted small' }, gate.reason ?? tr('Invitation only'))
          : h(
              'button',
              {
                class: 'btn',
                disabled: !!current && !current.finished,
                title: current && !current.finished ? tr('Finish or withdraw from your current tournament first') : undefined,
                onclick: () => {
                  if (f.entry > p.jongPoints) return alertModal(ctx, tr('Not enough Jong Points'), tr('{name} costs {n} Jong Points to enter. You have {have}. Win games and daily challenges to earn more.', { name: f.name, n: fmt(f.entry), have: fmt(p.jongPoints) }));
                  p.jongPoints -= f.entry;
                  saveProfile(p);
                  let s = createTournament(id, new Date(), { name: p.name, rating: p.rating }, randomSeed(), { scoring: tournamentScoringPref() });
                  s = nextRound(s);
                  saveTournament(s);
                  ctx.go('tournaments');
                },
              },
              f.entry ? tr('Enter for {n} JP', { n: fmt(f.entry) }) : tr('Enter'),
            ),
      ),
    );
  }
  const scoringSel = h('select', { 'aria-label': tr('Tournament scoring') }, h('option', { value: 'standings' }, tr('Standings: 4, 2, 1, 0 points by place')), h('option', { value: 'placement' }, tr('Placement points (uma): bonus by place plus score'))) as HTMLSelectElement;
  scoringSel.value = tournamentScoringPref();
  // The line under the picker explains the scoring that is chosen.
  const STANDINGS_RULE = tr('Standings scoring: each table awards 4, 2, 1 and 0 points by place, added up across rounds. Ties are broken by total score change.');
  const ruleLine = h('p', { class: 'muted small' }, scoringSel.value === 'placement' ? PLACEMENT_RULE : STANDINGS_RULE);
  scoringSel.onchange = () => {
    setTournamentScoringPref(scoringSel.value === 'placement' ? 'placement' : 'standings');
    ruleLine.textContent = scoringSel.value === 'placement' ? PLACEMENT_RULE : STANDINGS_RULE;
  };
  body.push(h('section', { class: 'section' }, h('div', { class: 'section-head' }, h('h3', {}, tr('Events')), h('p', { class: 'muted' }, tr('Tournaments are played against the club’s members. Prizes are Jong Points, trophies and frames.'))), h('label', { class: 'muted small t-scoring' }, tr('Scoring for your next event: '), scoringSel), ruleLine, list));

  if (p.trophies.length) body.push(h('section', { class: 'section' }, h('h3', {}, tr('Your trophies')), h('div', { class: 'trophies' }, ...p.trophies.map((t) => h('div', { class: 'trophy' }, h('span', { class: 'tr-mark', 'aria-hidden': 'true' }, '🏆'), h('span', {}, t.name), h('span', { class: 'muted small' }, new Date(t.date).toLocaleDateString()))))));
  return page(tr('Tournaments'), tr('Compete for the cup'), h('button', { class: 'btn sm ghost clubs-back page-back', onclick: () => ctx.go('play') }, tr('‹ Play')), ...body);
}

export function alertModal(ctx: AppCtx, title: string, text: string) {
  const o = ctx.modal;
  clear(o).hidden = false;
  o.append(h('div', { class: 'card' }, h('h3', {}, title), h('p', { class: 'muted' }, text), h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', onclick: () => (o.hidden = true) }, 'OK'))));
}

export const personalityLabel = (p: string) => PERSONALITIES[p as Personality]?.label ?? p;
export { startingScoreOf, speedJongRating };
