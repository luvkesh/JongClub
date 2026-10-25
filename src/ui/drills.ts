// Daily drills: about five minutes, eight quick questions chosen from your
// weak spots, with the ones you missed coming back after 1, 3 and 7 days
// (learn/drillSchedule.ts). Every question is built by the engine
// (learn/drillGen.ts), so its answer is the engine's own. Opened from the
// Learn screen, and from Profile's "Practise this" for one kind of drill.

import { sound } from '../audio/sound';
import { DRILL_LABEL, VALUE_VARIATIONS, isRight, makeDrill, type Drill, type DrillType } from '../learn/drillGen';
import { accuracy, drillStreak, dueItems, finishSet, loadDrills, planSet, recordAnswer, saveDrills, today, POINTS_FOR_SET, POINTS_PER_RIGHT, SET_SIZE, type PlannedDrill } from '../learn/drillSchedule';
import type { AppCtx } from './ctx';
import { clear, fmt, h, tileImg } from './dom';
import { addSeasonXp } from '../progression/season';
import { SEASON_XP } from '../club/seasons';
import './drills.css';
import { tr, trn } from '../i18n';
import { luxCard } from './luxCard';

/** The variation your value and discard drills use: the one you play most that they cover. */
function drillVariation(ctx: AppCtx): string {
  const played = Object.entries(ctx.profile.variationGames).sort((a, b) => b[1] - a[1]);
  return played.find(([v]) => VALUE_VARIATIONS.includes(v))?.[0] ?? 'classic';
}

/** The Daily drills card on the Learn screen. */
export function drillsEntry(ctx: AppCtx): HTMLElement {
  const s = loadDrills();
  const day = today();
  const done = !!s.days[day]?.sets;
  const due = dueItems(s, day).length;
  const streak = drillStreak(s, day);
  const el = h(
    'section',
    { class: `drills-entry ${done ? 'done' : ''}` },
    h(
      'div',
      { class: 'de-main' },
      h('p', { class: 'eyebrow' }, tr('Daily drills')),
      h('h3', {}, done ? tr('Today’s drills are done') : tr('Five minutes of practice')),
      h('p', { class: 'muted' }, tr('Name the wait, find the best discard, spot a safe tile, count a hand and name the tiles. Chosen from your weak spots; anything you miss comes back after 1, 3 and 7 days.')),
      h(
        'p',
        { class: 'de-stats' },
        h('span', {}, streak ? tr('{n}-day streak', { n: streak }) : tr('Start a streak today')),
        due ? h('span', {}, tr('{n} to review', { n: due })) : null,
        done ? h('span', { class: 'de-tick' }, tr('Done today ✓')) : h('span', {}, tr('Up to {n} Jong Points', { n: fmt(SET_SIZE * POINTS_PER_RIGHT + POINTS_FOR_SET) })),
      ),
    ),
    h('button', { class: `btn ${done ? 'ghost' : 'primary'}`, onclick: () => openDrills(ctx, { onClose: () => el.replaceWith(drillsEntry(ctx)) }) }, done ? tr('Practise again') : tr('Start today’s drills')),
  );
  return el;
}

/** The Daily drills choice as a premium card, for the Learn screen's top row. */
export function drillsCard(ctx: AppCtx): HTMLElement {
  const s = loadDrills();
  const day = today();
  const done = !!s.days[day]?.sets;
  const streak = drillStreak(s, day);
  const line = `${streak ? tr('{n}-day streak', { n: streak }) : tr('Start a streak today')} · ${done ? tr('Done today ✓') : tr('Up to {n} Jong Points', { n: fmt(SET_SIZE * POINTS_PER_RIGHT + POINTS_FOR_SET) })}`;
  const card: HTMLElement = luxCard({ art: 'drills', title: tr('Daily drills'), line, run: () => openDrills(ctx, { onClose: () => card.replaceWith(drillsCard(ctx)) }) });
  return card;
}

export interface DrillOpts {
  /** One kind of drill only (Profile's "Practise this"). */
  focus?: DrillType;
  onClose?: () => void;
}

/** Run a set of drills in the dialog. */
export function openDrills(ctx: AppCtx, opts: DrillOpts = {}) {
  const state = loadDrills();
  const day = today();
  const practice = !!opts.focus || !!state.days[day]?.sets;
  const plan: PlannedDrill[] = planSet(state, day, {
    size: opts.focus ? 5 : SET_SIZE,
    focus: opts.focus,
    salt: (state.days[day]?.sets ?? 0) + (state.days[day]?.practice ?? 0) * 7 + (opts.focus ? 1000 : 0),
    variation: drillVariation(ctx),
  });
  const results: boolean[] = [];
  const drills: (Drill | null)[] = [];
  const o = ctx.modal;
  const card = h('div', { class: 'card drills', role: 'document', 'data-no-tips': '' });
  clear(o).hidden = false;
  o.append(card);
  const close = () => {
    o.hidden = true;
    clear(o);
    opts.onClose?.();
  };

  /** Build drill i (a fallback tile-name drill if the engine can't make it). */
  const build = (i: number): Drill => {
    if (drills[i]) return drills[i]!;
    const p = plan[i];
    let d: Drill;
    try {
      d = makeDrill(p.type, p.seed, p.variation);
    } catch {
      d = makeDrill('name', p.seed);
      plan[i] = { ...p, type: 'name', variation: 'classic', review: false };
    }
    drills[i] = d;
    return d;
  };

  const dots = () =>
    h(
      'div',
      { class: 'lesson-progress dr-dots', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(plan.length), 'aria-valuenow': String(results.length) },
      ...plan.map((_, j) => h('i', { class: j < results.length ? (results[j] ? 'right' : 'wrong') : j === results.length ? 'now' : '' })),
    );
  const top = () => h('div', { class: 'dr-top' }, dots(), h('button', { class: 'icon-btn', 'aria-label': tr('Leave the drills'), onclick: close }, '✕'));

  const show = (i: number) => {
    if (i >= plan.length) return end();
    if (!drills[i]) {
      // Some drills play out a few turns first: show a moment's pause, then build.
      clear(card).append(top(), h('p', { class: 'dr-wait muted' }, h('i', { class: 'dr-spin', 'aria-hidden': 'true' }, h('b'), h('b'), h('b')), tr('Setting the tiles…')));
      window.setTimeout(() => card.isConnected && (build(i), show(i)), 30);
      return;
    }
    const d = drills[i]!;
    const p = plan[i];
    const feedback = h('div', { class: 'dr-feedback', 'aria-live': 'polite' });
    const answer = (a: number, el: HTMLElement) => {
      const right = isRight(d, a);
      results.push(right);
      recordAnswer(state, { type: p.type, seed: p.seed, variation: p.variation }, right, day);
      saveDrills(state);
      sound.play(right ? 'score' : 'click');
      el.classList.add(right ? 'right' : 'wrong');
      card.querySelectorAll<HTMLButtonElement>('.quiz-option, .pz-tile').forEach((b) => {
        b.disabled = true;
        const k = Number(b.dataset.answer);
        if (!right && (d.pick === 'tile' ? d.correctTiles?.includes(k) : d.options[k]?.correct)) b.classList.add(d.pick === 'tile' ? 'best' : 'right');
      });
      card.querySelector('.dr-dots')?.replaceWith(dots());
      const next = h('button', { class: 'btn primary', onclick: () => show(i + 1) }, i + 1 < plan.length ? tr('Continue') : tr('See how you did'));
      clear(feedback).append(h('p', { class: `dr-verdict ${right ? 'ok' : 'no'}` }, right ? tr('Correct') : tr('Not quite')), h('p', { class: 'dr-why' }, d.explanation), next);
      next.focus({ preventScroll: true });
      // Build the next one while this explanation is read.
      if (i + 1 < plan.length) window.setTimeout(() => card.isConnected && build(i + 1), 60);
    };
    clear(card).append(top(), h('p', { class: 'eyebrow' }, `${DRILL_LABEL[d.type]}${p.review ? ` · ${tr('back for review')}` : ''}`), h('h3', { class: 'dr-q' }, d.prompt), d.context ? h('p', { class: 'muted small dr-context' }, d.context) : '', board(d, ctx.labels, answer), d.pick === 'option' ? options(d, ctx.labels, answer) : '', feedback);
  };

  const end = () => {
    const right = results.filter(Boolean).length;
    const pts = finishSet(state, day, right, results.length, practice);
    saveDrills(state);
    if (pts) {
      ctx.profile.jongPoints += pts;
      // The day's first set also counts towards the Club Season.
      addSeasonXp('drill', SEASON_XP.drill * right);
      ctx.save();
    }
    const streak = drillStreak(state, day);
    const back = dueItems(state, nextDay(day)).length;
    const byType = [...new Set(plan.map((p) => p.type))].map((t) => {
      const idx = plan.map((p, j) => (p.type === t ? j : -1)).filter((j) => j >= 0 && j < results.length);
      return { t, right: idx.filter((j) => results[j]).length, total: idx.length, acc: accuracy(state, t) };
    });
    sound.play('score');
    clear(card).append(
      top(),
      h('p', { class: 'eyebrow' }, practice ? tr('Practice set complete') : tr('Daily drills complete')),
      h('h3', {}, tr('{n} of {total} right', { n: right, total: results.length })),
      h(
        'div',
        { class: 'rewards dr-rewards' },
        h('div', { class: 'reward big' }, h('span', { class: 'k' }, tr('Jong Points')), h('span', { class: 'v' }, pts ? `+${fmt(pts)}` : '—'), practice ? h('span', { class: 'note' }, tr('Points come with the day’s first set')) : null),
        h('div', { class: 'reward' }, h('span', { class: 'k' }, tr('Streak')), h('span', { class: 'v sm' }, streak ? trn(streak, '{n} day', '{n} days') : '—')),
        h('div', { class: 'reward' }, h('span', { class: 'k' }, tr('Back tomorrow')), h('span', { class: 'v sm' }, back ? tr('{n} to review', { n: back }) : tr('Nothing'))),
      ),
      h(
        'ul',
        { class: 'breakdown dr-skills' },
        ...byType.map((x) => h('li', {}, h('span', {}, DRILL_LABEL[x.t]), h('span', { class: 'num' }, `${x.right} / ${x.total}${x.acc !== null ? ` · ${tr('{n}% lately', { n: Math.round(x.acc * 100) })}` : ''}`))),
      ),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn ghost', onclick: () => (close(), openDrills(ctx, { ...opts })) }, tr('Another set')), h('button', { class: 'btn primary', onclick: close }, tr('Done'))),
    );
  };

  show(0);
}

const nextDay = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/** The tiles a question is about. Best-discard drills answer by tapping a tile here. */
function board(d: Drill, labels: boolean, answer: (a: number, el: HTMLElement) => void): HTMLElement {
  const wrap = h('div', { class: 'dr-board' });
  if (d.type === 'name' && d.focus !== undefined) {
    wrap.append(h('div', { class: 'dr-single' }, tileImg(d.focus, 'dr-big', false)));
    return wrap;
  }
  if (d.pool) {
    wrap.append(
      h('p', { class: 'dr-label' }, tr('{name}’s discards', { name: d.pool.who })),
      h('div', { class: 'dr-row dr-pool' }, ...d.pool.tiles.map((k, j) => tileImg(k, j === d.pool!.riichiAt ? 'mini dr-riichi' : 'mini', labels))),
      d.pool.since.length ? h('p', { class: 'dr-label' }, tr('Let go by others since their riichi')) : '',
      d.pool.since.length ? h('div', { class: 'dr-row' }, ...d.pool.since.map((k) => tileImg(k, 'mini', labels))) : '',
      h('p', { class: 'dr-label' }, tr('The tile in question')),
      d.focus !== undefined ? h('div', { class: 'dr-single' }, tileImg(d.focus, 'dr-mid', labels)) : '',
    );
    return wrap;
  }
  if (d.hand) {
    const row = h('div', { class: `dr-row dr-hand ${d.pick === 'tile' ? 'pick' : ''}` });
    let winShown = false;
    for (const k of d.hand) {
      // The winning tile sits apart, marked.
      if (d.winTile === k && !winShown) {
        winShown = true;
        continue;
      }
      if (d.pick === 'tile') {
        const img = tileImg(k, '', labels);
        const b = h('button', { class: 'pz-tile', 'data-answer': String(k), 'aria-label': tr('Discard the {tile}', { tile: img.alt }) }, img);
        b.onclick = () => answer(k, b);
        row.append(b);
      } else row.append(tileImg(k, '', labels));
    }
    wrap.append(row);
    const extras: (HTMLElement | string)[] = [];
    if (d.melds?.length) extras.push(h('span', { class: 'dr-chip' }, h('span', { class: 'dr-label' }, tr('Sets shown')), ...d.melds.map((m) => h('span', { class: 'meld' }, ...m.map((k) => tileImg(k, 'mini', labels))))));
    if (d.winTile !== undefined && winShown) extras.push(h('span', { class: 'dr-chip dr-win' }, h('span', { class: 'dr-label' }, tr('Winning tile')), tileImg(d.winTile, 'mini', labels)));
    if (d.dora?.length) extras.push(h('span', { class: 'dr-chip' }, h('span', { class: 'dr-label' }, tr('Dora')), ...d.dora.map((k) => tileImg(k, 'mini', labels))));
    if (d.flowers?.length) extras.push(h('span', { class: 'dr-chip' }, h('span', { class: 'dr-label' }, tr('Flowers')), ...d.flowers.map((k) => tileImg(k, 'mini', labels))));
    if (extras.length) wrap.append(h('div', { class: 'dr-extras' }, ...extras));
  }
  return wrap;
}

function options(d: Drill, labels: boolean, answer: (a: number, el: HTMLElement) => void): HTMLElement {
  const box = h('div', { class: `quiz-options ${d.options.length <= 2 ? 'dr-two' : ''}` });
  d.options.forEach((o, i) => {
    const b = h('button', { class: 'quiz-option', 'data-answer': String(i) }, o.tiles ? h('span', { class: 'meld' }, ...o.tiles.map((k) => tileImg(k, 'mini', labels))) : null, h('span', {}, o.label));
    b.onclick = () => answer(i, b);
    box.append(b);
  });
  return box;
}
