// The Club Season page: this season's destination, your step on the reward
// track, the league table of players near you and the closing Season Finals.
// Season progress is earned only by playing; rewards are cosmetics and Jong
// Points, never sold and never random (club/seasons.ts).

import { avatarSvg } from '../cosmetics/avatar';
import { byId } from '../cosmetics/catalog';
import { VARIATIONS } from '../engine/rules';
import { tileSetPreview } from '../render/tileFaces';
import { claimAll, claimStep, claimable, finalsQualified, FINALS_STEP, rewardTrack, seasonAt, SEASON_STEPS, SEASON_WEEKS, stepOf, xpToReach, type SeasonInfo, type SeasonProgress, type SeasonReward } from '../club/seasons';
import { loadSeasonLeague } from '../club/seasonLeague';
import { createTournament, nextRound } from '../club/tournament';
import type { VariationId } from '../club/roster';
import { saveProfile } from '../progression/profile';
import { saveSeasonProgress, seasonProgress } from '../progression/season';
import { loadTournament, saveTournament } from './compete';
import type { AppCtx } from './ctx';
import { clear, fmt, h } from './dom';
import './seasons.css';
import { seasonArt } from './seasonArt';
import { lang, tr, trn } from '../i18n';

const vinfo = (id: string) => VARIATIONS.find((v) => v.id === id) ?? VARIATIONS[0];
const dateText = (d: Date) => d.toLocaleDateString(lang(), { day: 'numeric', month: 'short', timeZone: 'UTC' });
const XP_LABELS: Record<string, string> = { game: tr('Games'), daily: tr('Daily challenges'), lesson: tr('Lessons'), drill: tr('Drills'), event: tr('Events') };

/** Accent colours for the page, from the season's theme. */
const themeStyle = (s: SeasonInfo) => ({ '--season-deep': s.theme.colors[0], '--season-accent': s.theme.colors[1], '--season-light': s.theme.colors[2] });

function withVars(el: HTMLElement, vars: Record<string, string>) {
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
  return el;
}

/** A small picture of a reward: Jong Points, the frame on your avatar, the cloth or the tiles. */
function rewardArt(ctx: AppCtx, r: SeasonReward, big = false): HTMLElement {
  const c = r.cosmetic;
  if (!c) return h('div', { class: 'sr-art jp', 'aria-hidden': 'true' }, h('span', {}, fmt(r.jongPoints ?? 0)), h('em', {}, tr('JP')));
  if (c.category === 'frame') return h('div', { class: 'sr-art frame', html: avatarSvg({ ...ctx.profile.avatar, frame: c.id }, big ? 96 : 54) });
  if (c.category === 'tileSet') return h('div', { class: 'sr-art tiles', style: { backgroundImage: `url(${tileSetPreview(c.id, 240, 132)})` } });
  const item = byId('table', c.id);
  return h('div', { class: 'sr-art cloth', style: { background: `radial-gradient(circle at 50% 40%, color-mix(in srgb, ${item?.swatch[0] ?? '#123'} 70%, white 12%), ${item?.swatch[0] ?? '#123'})`, boxShadow: `inset 0 0 0 5px ${item?.swatch[1] ?? '#333'}` } });
}

/** Collect rewards and say what came in. */
/** Where the reward track was scrolled when you collected, so the re-drawn track stays put. */
let trackScroll: number | null = null;

function collect(ctx: AppCtx, prog: SeasonProgress, steps: number[] | 'all') {
  const p = ctx.profile;
  const track = document.querySelector<HTMLElement>('.season-track');
  if (track) trackScroll = track.scrollLeft;
  const got = steps === 'all' ? claimAll(prog, p) : steps.map((k) => claimStep(prog, k, p)).filter((r): r is SeasonReward => !!r);
  if (!got.length) return;
  saveProfile(p);
  saveSeasonProgress(prog);
  const jp = got.reduce((a, r) => a + (r.jongPoints ?? 0), 0);
  const items = got.filter((r) => r.cosmetic);
  const o = ctx.modal;
  clear(o).hidden = false;
  o.append(
    h(
      'div',
      { class: 'card season-collect' },
      h('p', { class: 'eyebrow' }, tr('Collected')),
      h('h3', {}, items.length ? items.map((r) => r.label).join(' · ') : tr('{n} Jong Points', { n: fmt(jp) })),
      items.length ? h('div', { class: 'sc-art' }, ...items.map((r) => rewardArt(ctx, r, true))) : null,
      h('p', { class: 'muted' }, [jp ? tr('{n} Jong Points added.', { n: fmt(jp) }) : '', items.length ? tr('New cosmetics are in your Collection, ready to wear.') : ''].filter(Boolean).join(' ')),
      h(
        'div',
        { class: 'btn-row' },
        items.length ? h('button', { class: 'btn ghost', onclick: () => ((o.hidden = true), ctx.go('collection')) }, tr('Open Collection')) : null,
        h('button', { class: 'btn primary', onclick: () => ((o.hidden = true), ctx.go('seasons')) }, tr('Lovely')),
      ),
    ),
  );
}

/** Enter the Season Finals: a free tournament at the season's destination. */
function enterFinals(ctx: AppCtx, season: SeasonInfo) {
  const p = ctx.profile;
  let s = createTournament('season', new Date(), { name: p.name, rating: p.rating }, Math.floor(Math.random() * 0x7fffffff), { variation: season.theme.destination as VariationId });
  s = { ...s, name: tr('Season {n} Finals', { n: season.number }) };
  s = nextRound(s);
  saveTournament(s);
  ctx.go('tournaments');
}

export function seasonsScreen(ctx: AppCtx): HTMLElement {
  const p = ctx.profile;
  const season = seasonAt();
  const prog = seasonProgress(season.number);
  const st = stepOf(prog.xp);
  const track = rewardTrack(season.theme);
  const ready = claimable(prog);
  const dest = vinfo(season.theme.destination);

  // ---- the season's head and your progress
  const head = withVars(
    h(
      'section',
      { class: 'season-hero' },
      h('div', { class: 'sh-place' }, h('span', { class: 'sh-flag', 'aria-hidden': 'true' }, dest.flag), h('span', {}, `${season.theme.city} · ${tr('Week {week} of {total}', { week: season.week, total: SEASON_WEEKS })}`)),
      h('p', { class: 'sh-line' }, season.theme.line),
      h(
        'div',
        { class: 'sh-progress' },
        h('div', { class: 'sh-step' }, h('span', { class: 'k' }, tr('Your step')), h('span', { class: 'v' }, String(st.step)), h('span', { class: 'of' }, tr('of {total}', { total: SEASON_STEPS }))),
        h(
          'div',
          { class: 'sh-bar-wrap' },
          h('div', { class: 'xpbar sh-bar' }, h('i', { style: { width: `${st.need ? (st.into / st.need) * 100 : 100}%` } })),
          h('p', { class: 'muted small' }, st.step >= SEASON_STEPS ? tr('Track complete with {xp} season XP. Well played.', { xp: fmt(prog.xp) }) : `${tr('{into} of {need} season XP to step {step}.', { into: fmt(st.into), need: fmt(st.need), step: st.step + 1 })} ${season.daysLeft === 1 ? tr('Last day of the season.') : trn(season.daysLeft, '{n} day left (ends {date}).', '{n} days left (ends {date}).', { date: dateText(new Date(season.end.getTime() - 1)) })}`),
        ),
      ),
      h(
        'div',
        { class: 'btn-row left' },
        ready.length ? h('button', { class: 'btn primary', onclick: () => collect(ctx, prog, 'all') }, ready.length === 1 ? tr('Collect your reward') : trn(ready.length, 'Collect {n} reward', 'Collect {n} rewards')) : null,
        h('button', { class: `btn ${ready.length ? 'ghost' : 'primary'}`, onclick: () => ctx.startMatch(ctx.tableFor(season.theme.destination)) }, tr('Play {name}', { name: dest.short })),
        h('button', { class: 'btn ghost', onclick: () => ctx.go('daily') }, tr('Daily challenges')),
      ),
    ),
    themeStyle(season),
  );

  // ---- the reward track
  const steps = h(
    'ol',
    { class: 'season-track', 'aria-label': tr('Reward track') },
    ...track.map((r) => {
      const reached = st.step >= r.step;
      const got = prog.claimed.includes(r.step);
      return h(
        'li',
        { class: `sr ${reached ? 'reached' : ''} ${got ? 'got' : ''} ${r.cosmetic ? 'cosmetic' : ''}` },
        h('span', { class: 'sr-n' }, String(r.step)),
        rewardArt(ctx, r),
        h('span', { class: 'sr-label' }, r.cosmetic ? r.label : tr('Jong Points')),
        got ? h('span', { class: 'sr-state' }, tr('Collected')) : reached ? h('button', { class: 'btn sm', onclick: () => collect(ctx, prog, [r.step]) }, tr('Collect')) : h('span', { class: 'sr-state muted' }, r.step === FINALS_STEP ? tr('Finals invitation') : tr('{xp} XP to go', { xp: fmt(Math.max(0, xpToReach(r.step) - prog.xp)) })),
      );
    }),
  );
  // Keep the next step in view on a phone.
  // After collecting, the track stays where you left it; otherwise it opens on the first
  // reward waiting to be collected, or your current step.
  const kept = trackScroll;
  trackScroll = null;
  requestAnimationFrame(() => {
    if (kept !== null) {
      steps.scrollLeft = kept;
      return;
    }
    const waiting = track.findIndex((r) => st.step >= r.step && !prog.claimed.includes(r.step));
    const next = steps.children[waiting >= 0 ? waiting : Math.max(0, Math.min(SEASON_STEPS - 1, st.step - 1))] as HTMLElement | undefined;
    // Measured against the track itself (offsetLeft counts from the page when the track is not positioned).
    if (next) steps.scrollLeft = Math.max(0, steps.scrollLeft + next.getBoundingClientRect().left - steps.getBoundingClientRect().left - steps.clientWidth / 2 + next.clientWidth / 2);
  });

  // ---- how XP is earned, and what you have earned so far
  const sources = Object.entries(prog.bySource).filter(([, v]) => v);
  const earn = h(
    'div',
    { class: 'season-earn' },
    h(
      'ul',
      { class: 'se-ways' },
      h('li', {}, h('strong', {}, tr('Finish a game')), ` · ${tr('more for every hand played and won, and a quarter more at {city}’s tables', { city: season.theme.city })}`),
      h('li', {}, h('strong', {}, tr('Daily challenges')), ` · ${tr('50 for each one completed')}`),
      h('li', {}, h('strong', {}, tr('Lessons and drills')), ` · ${tr('80 for a lesson passed, a little for each drill')}`),
    ),
    sources.length ? h('p', { class: 'muted small' }, tr('This season: {list}.', { list: sources.map(([k, v]) => `${XP_LABELS[k] ?? k} ${fmt(v ?? 0)}`).join(' · ') })) : h('p', { class: 'muted small' }, tr('Nothing earned yet this season. Any finished game starts your track.')),
    h('p', { class: 'muted small' }, tr('Season rewards are earned by playing only. There is nothing to buy, nothing left to chance, and nothing here changes play or your rating.')),
  );

  // ---- league table
  const league = h('ol', { class: 'board season-board' }, h('li', { class: 'muted' }, tr('Loading the table…')));
  void loadSeasonLeague(season, { name: p.name, rating: p.rating, xp: prog.xp }).then((rows) => {
    clear(league).append(
      ...rows.map((r) =>
        h(
          'li',
          { class: r.me ? 'me' : '' },
          h('span', { class: 'rk' }, String(r.rank)),
          h('div', { class: 'avatar svg sm', 'aria-hidden': 'true', html: avatarSvg(r.me ? p.avatar : r.member!.avatar, 26) }),
          h('span', { class: 'nm' }, r.me ? tr('{name} (you)', { name: p.name }) : r.name, h('em', {}, ` ${r.me ? '' : r.city}`)),
          h('span', { class: 'lg' }, tr('Step {n}', { n: stepOf(r.xp).step })),
          h('span', { class: 'num' }, fmt(r.xp)),
        ),
      ),
    );
  });

  // ---- Season Finals
  const t = loadTournament();
  const inFinals = !!t && t.formatId === 'season' && !t.finished;
  const qualified = finalsQualified(prog);
  const finalsStart = new Date(season.start.getTime() + (SEASON_WEEKS - 1) * 7 * 86_400_000);
  const finals = withVars(
    h(
      'div',
      { class: `season-finals ${season.finalsOpen ? 'open' : ''}` },
      // The host city at night, the season's own picture, where the wide card has room.
      h('span', { class: 'sf-art', html: seasonArt(season.theme.id, season.theme.colors) }),
      h('p', {}, tr('Sixteen players at {city}’s tables: two rounds of East rounds, then a final table of four. Free to enter for players who reach step {step}. The champion takes the Season Finals Cup and 2,000 Jong Points.', { city: season.theme.city, step: FINALS_STEP })),
      inFinals
        ? h('button', { class: 'btn primary', onclick: () => ctx.go('tournaments') }, tr('Continue your Finals'))
        : !season.finalsOpen
          ? h('p', { class: 'muted small' }, `${tr('Opens {date}, in the last week of the season.', { date: dateText(finalsStart) })} ${qualified ? tr('You are invited.') : tr('Reach step {step} to be invited.', { step: FINALS_STEP })}`)
          : !qualified
            ? h('p', { class: 'muted small' }, tr('The Finals are on. Reach step {step} to be invited: you are at step {now}.', { step: FINALS_STEP, now: st.step }))
            : t && !t.finished
              ? h('p', { class: 'muted small' }, tr('Finish or withdraw from your current tournament first.'))
              : h('button', { class: 'btn primary', onclick: () => enterFinals(ctx, season) }, tr('Enter the Season Finals')),
    ),
    themeStyle(season),
  );

  // ---- rewards still waiting from last season
  const prev = season.number > 1 ? seasonProgress(season.number - 1) : null;
  const prevReady = prev ? claimable(prev) : [];
  const leftover = prev && prevReady.length ? h('div', { class: 'season-leftover' }, h('p', {}, trn(prevReady.length, 'You reached step {step} last season and have {n} reward to collect.', 'You reached step {step} last season and have {n} rewards to collect.', { step: stepOf(prev.xp).step })), h('button', { class: 'btn sm', onclick: () => collect(ctx, prev, 'all') }, tr('Collect'))) : null;

  const page = h(
    'div',
    { class: 'page season-page' },
    h('header', { class: 'page-head' }, h('button', { class: 'btn sm ghost clubs-back', onclick: () => ctx.go('club') }, tr('‹ Club')), h('p', { class: 'eyebrow' }, tr('Club Season {n}', { n: season.number })), h('h2', {}, season.theme.name)),
    head,
    leftover,
    h('section', { class: 'section' }, h('div', { class: 'section-head' }, h('h3', {}, tr('Reward track')), h('p', { class: 'muted' }, tr('A frame at step 5, a table cloth at 10 and the {city} tiles at 20, with Jong Points between.', { city: season.theme.city }))), steps),
    h('section', { class: 'section' }, h('div', { class: 'section-head' }, h('h3', {}, tr('Season league')), h('p', { class: 'muted' }, tr('You and the club members nearest your rating, by season XP.'))), league),
    h('section', { class: 'section' }, h('div', { class: 'section-head' }, h('h3', {}, tr('Season Finals')), h('p', { class: 'muted' }, tr('The closing tournament, in the last week.'))), finals),
    h('section', { class: 'section' }, h('div', { class: 'section-head' }, h('h3', {}, tr('Earning season XP')), h('p', { class: 'muted' }, tr('Only by playing.'))), earn),
  );
  return withVars(page, themeStyle(season));
}

/** A small card for Home: the season, your step and anything to collect. */
export function seasonHomeCard(ctx: AppCtx): HTMLElement {
  const season = seasonAt();
  const prog = seasonProgress(season.number);
  const st = stepOf(prog.xp);
  const ready = claimable(prog).length;
  return withVars(
    h(
      'button',
      { class: 'season-card', onclick: () => ctx.go('seasons'), 'aria-label': tr('Club Season {n}, {name}: step {step} of {total}', { n: season.number, name: season.theme.name, step: st.step, total: SEASON_STEPS }) },
      h('span', { class: 'sc-eyebrow' }, `${tr('Club Season {n}', { n: season.number })} · ${vinfo(season.theme.destination).flag} ${season.theme.city}`),
      h('span', { class: 'sc-name' }, season.theme.name),
      h('span', { class: 'sc-row' }, h('span', {}, tr('Step {step} of {total}', { step: st.step, total: SEASON_STEPS })), h('span', { class: 'xpbar' }, h('i', { style: { width: `${(st.step / SEASON_STEPS) * 100}%` } })), ready ? h('span', { class: 'chip sm' }, tr('{n} to collect', { n: ready })) : h('span', { class: 'muted' }, season.finalsOpen ? tr('Finals week') : tr('Week {week} of {total}', { week: season.week, total: SEASON_WEEKS }))),
    ),
    themeStyle(season),
  );
}

/** The Club screen's entry to the season. */
export function seasonClubMode(ctx: AppCtx): HTMLElement {
  const season = seasonAt();
  const st = stepOf(seasonProgress(season.number).xp);
  return h('button', { class: 'mode', onclick: () => ctx.go('seasons') }, h('span', { class: 'mode-title' }, tr('Club Season')), h('span', { class: 'mode-detail' }, `${season.theme.name} · ${tr('step {step} of {total}', { step: st.step, total: SEASON_STEPS })}`));
}
