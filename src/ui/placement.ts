// The placement test on screen: "Already play? Take a 2-minute placement".
// Ten questions, one answer each, a short note after every answer, then the
// result: lessons marked as known and a table at the player's level.
// The questions and grading live in src/progression/placement.ts.

import { promptSignIn } from '../auth/prompt';
import { sound } from '../audio/sound';
import { narrator } from '../audio/voice';
import { parseKinds } from '../engine/tiles';
import { PLACEMENT, applyPlacement, dismissPlacementOffer, gradePlacement, loadPlacement, placementAnswerLine, placementIntroLine, placementOfferDismissed, placementResultLine, placementVerdict, savePlacement, type PlacementResult } from '../progression/placement';
import { ACADEMY_ORDER, LESSONS, OPTIONAL_LESSONS } from './academy';
import type { AppCtx } from './ctx';
import { clear, h, tileImg } from './dom';
import type { TableConfig } from './match';
import './placement.css';
import { tr } from '../i18n';

const lessonTitle = (id: string) => (id === 'guided' ? tr('Your first guided game') : LESSONS[id]?.title ?? id);

/** The table the result suggests, or null when the guided game with Mei is the place to start. */
export function placementTable(ctx: AppCtx, r: PlacementResult | null = loadPlacement()): TableConfig | null {
  if (!r?.suggestion.length) return null;
  return { ...ctx.tableFor('classic'), name: 'Jade Room', difficulty: r.suggestion.difficulty, length: r.suggestion.length };
}

/** Start where the result suggests: a table at that level, or the guided game. */
function sitDown(ctx: AppCtx, r: PlacementResult) {
  const t = placementTable(ctx, r);
  if (t) ctx.startMatch(t);
  else ctx.startGuided();
}

/** Open the first lesson on the Academy path still to learn. */
function nextLesson(ctx: AppCtx) {
  const next = ACADEMY_ORDER.find((l) => !OPTIONAL_LESSONS.includes(l) && !ctx.profile.lessonsDone.includes(l)) ?? 'basics';
  ctx.openLesson(next);
}

/** The test, in the modal. */
export function openPlacement(ctx: AppCtx) {
  const o = ctx.modal;
  // No tile-name plaques on hover or long press during the test: they would give answers away.
  const card = h('div', { class: 'card placement', 'data-no-tips': '' });
  clear(o).append(card);
  o.hidden = false;
  const answers: number[] = [];
  // Mei reads every card aloud; closing the test (or moving on) cuts her off.
  let step = 0;
  const close = () => {
    step++;
    narrator.stop();
    o.hidden = true;
  };

  const intro = () => {
    clear(card).append(
      h('p', { class: 'eyebrow' }, tr('Placement')),
      h('h3', {}, tr('Already play?')),
      h('p', { class: 'muted' }, tr('Ten quick questions, about two minutes. We’ll mark the lessons you already know as done and suggest a table at your level.')),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn ghost', onclick: close }, tr('Not now')), h('button', { class: 'btn primary', onclick: () => ask(0) }, tr('Begin'))),
    );
    void narrator.say(placementIntroLine());
  };

  const ask = (i: number) => {
    const q = PLACEMENT[i];
    const labels = ctx.labels && !q.noLabels;
    const feedback = h('p', { class: 'quiz-feedback', 'aria-live': 'polite' });
    const opts = h('div', { class: 'quiz-options' });
    // A stable shuffle per question, so the answer isn't always first.
    const order = q.options.map((_, k) => k);
    let seed = [...q.id].reduce((a, c) => Math.imul(a ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
    for (let j = order.length - 1; j > 0; j--) {
      seed = (Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
      const r = seed % (j + 1);
      [order[j], order[r]] = [order[r], order[j]];
    }
    for (const k of order) {
      const opt = q.options[k];
      const b = h(
        'button',
        { class: `quiz-option ${opt.text ? '' : 'tiles-only'}` },
        opt.tiles ? h('span', { class: 'meld' }, ...parseKinds(opt.tiles).map((t) => tileImg(t, opt.text ? 'mini' : '', labels))) : null,
        opt.text ? h('span', {}, opt.text) : null,
      );
      b.onclick = () => {
        answers[i] = k;
        const right = k === q.answer;
        sound.play(right ? 'score' : 'click');
        opts.querySelectorAll('button').forEach((x) => ((x as HTMLButtonElement).disabled = true));
        b.classList.add(right ? 'right' : 'wrong');
        if (!right) opts.children[order.indexOf(q.answer)]?.classList.add('right');
        feedback.textContent = right ? tr('Correct.') : `${tr('Not quite.')} ${q.explain}`;
        // Move on once Mei has finished the note (or after a short read without her).
        const at = ++step;
        const spoken = narrator.say(placementAnswerLine(q, right));
        void Promise.all([spoken, new Promise((r) => window.setTimeout(r, right ? 700 : 1800))]).then(() => {
          if (at !== step || o.hidden) return;
          if (i + 1 < PLACEMENT.length) ask(i + 1);
          else finish();
        });
      };
      opts.append(b);
    }
    card.classList.toggle('has-hand', !!q.hand);
    clear(card).append(
      h('div', { class: 'lesson-progress' }, ...PLACEMENT.map((_, j) => h('i', { class: j < i ? 'on' : j === i ? 'now' : '' }))),
      h('p', { class: 'eyebrow' }, tr('Placement · question {n} of {total}', { n: i + 1, total: PLACEMENT.length })),
      h('h3', {}, q.q),
      q.hand ? h('div', { class: 'lesson-tiles placement-hand' }, ...q.hand.split(' ').map((spec) => h('div', { class: 'meld' }, ...parseKinds(spec).map((t) => tileImg(t, 'mini', labels))))) : '',
      opts,
      feedback,
    );
    (opts.firstElementChild as HTMLElement | null)?.focus({ preventScroll: true });
    step++;
    void narrator.say(q.q);
  };

  const finish = () => {
    card.classList.remove('has-hand');
    const r = gradePlacement(answers);
    const added = applyPlacement(ctx.profile, r);
    ctx.save();
    savePlacement(r);
    document.querySelector('.placement-offer')?.remove();
    const line = placementVerdict(r.score);
    void narrator.say(placementResultLine(r.score, r.total));
    clear(card).append(
      h('p', { class: 'eyebrow' }, tr('Placement complete')),
      h('h3', {}, tr('{n} of {total}', { n: r.score, total: r.total })),
      h('p', { class: 'muted' }, line),
      r.lessons.length
        ? h('div', { class: 'placement-done' }, h('span', { class: 'k' }, tr('Marked as done')), h('ul', {}, ...r.lessons.map((l) => h('li', {}, lessonTitle(l), added.includes(l) ? '' : h('small', { class: 'muted' }, tr(' (already done)'))))))
        : '',
      h('div', { class: 'placement-done' }, h('span', { class: 'k' }, tr('Your table')), h('p', {}, r.suggestion.label)),
      h(
        'div',
        { class: 'btn-row' },
        h('button', { class: 'btn ghost', onclick: () => (close(), nextLesson(ctx)) }, tr('Continue to the Academy')),
        h('button', { class: 'btn primary', onclick: () => (close(), sitDown(ctx, r)) }, r.suggestion.length ? tr('Sit at your table') : tr('Play with Mei')),
      ),
    );
    window.setTimeout(() => !o.hidden && void promptSignIn('placement'), 900);
  };

  intro();
}

/** The Learn screen's first-visit offer, or null once taken or dismissed (or for anyone already on the path). */
const offerDue = (ctx: AppCtx) => !loadPlacement() && !placementOfferDismissed() && !ctx.profile.lessonsDone.length;

export function placementOffer(ctx: AppCtx): HTMLElement | null {
  if (!offerDue(ctx)) return null;
  const el = h(
    'section',
    { class: 'placement-offer' },
    h('div', {}, h('b', {}, tr('Already play?')), h('span', {}, tr('Take a 2-minute placement and skip what you know.'))),
    h(
      'div',
      { class: 'placement-offer-btns' },
      h('button', { class: 'btn ghost sm', onclick: () => (dismissPlacementOffer(), ctx.go('learn')) }, tr('No thanks')),
      h('button', { class: 'btn primary sm', onclick: () => openPlacement(ctx) }, tr('Take the placement')),
    ),
  );
  return el;
}

/** The Academy's standing link to the test (the first-visit offer stands in for it while shown). */
export function placementLink(ctx: AppCtx): HTMLElement | null {
  if (offerDue(ctx)) return null;
  const r = loadPlacement();
  return h('button', { class: 'btn sm ghost', onclick: () => openPlacement(ctx) }, r ? tr('Placement: {n} of {total} · Retake', { n: r.score, total: r.total }) : tr('Already play? Take a 2-minute placement'));
}
