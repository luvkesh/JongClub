// The hand-score card: what a hand is worth right now (src/ai/handScore.ts),
// drawn for a player's plate (tap it) and the top of the score calculator.
// Score line names stay as the hand result shows them; units, labels and notes
// are translated.

import type { HandNow, OnShow, WaitScore, WinValue } from '../ai/handScore';
import type { HandScore } from '../engine/rules/types';
import { tr, trn } from '../i18n';
import { fmt, h, tileImg } from './dom';
import './handScore.css';

/** "5 faan · Mangan", as the hand result writes it. */
export function scoreSummary(s: HandScore): string {
  return `${fmt(s.value)} ${tr(s.unit)}${s.fu ? ` ${s.fu} ${tr('fu')}` : ''}${s.tier ? ` · ${s.tier}` : s.limit ? ` · ${tr('Limit')}` : ''}`;
}

/** The score, its points and what the win pays you, on one row. */
export function scoreRow(v: WinValue, label?: string): HTMLElement {
  return h(
    'div',
    { class: 'hs-score' },
    label ? h('span', { class: 'hs-how' }, label) : null,
    // Tables that score in points already said so: no second "pts".
    v.score.value === v.score.points ? null : h('span', { class: 'hs-val' }, scoreSummary(v.score)),
    h('strong', { class: 'hs-pts' }, v.score.value === v.score.points ? scoreSummary(v.score) : tr('{n} pts', { n: fmt(v.score.points) })),
    v.collect > 0 ? h('span', { class: 'hs-pay', title: tr('What the win itself pays you under this table’s payment rules (flowers settled at the end and pots aside).') }, tr('pays you {n}', { n: fmt(v.collect) })) : null,
  );
}

/** The score lines, as the hand result lists them. */
export function scoreLines(s: HandScore, max = 99): HTMLElement {
  const items = s.items.slice(0, max);
  const ul = h('ul', { class: 'hs-lines' }, ...items.map((it) => h('li', {}, h('span', {}, it.name, it.note ? h('em', {}, ` ${it.note}`) : ''), h('span', { class: 'num' }, it.value ? `${fmt(it.value)} ${tr(s.unit)}` : ''))));
  if (s.items.length > max) ul.append(h('li', { class: 'hs-more' }, tr('+{n} more lines', { n: s.items.length - max })));
  return ul;
}

/** "3 faan · 800", or just "2,000 pts" where the score is the points. */
const short = (v: WinValue) => (v.score.value === v.score.points ? scoreSummary(v.score) : `${scoreSummary(v.score)} · ${fmt(v.score.points)}`);
const mini = (kind: number, labels: boolean) => tileImg(kind, 'mini', labels);
const tiles = (kinds: number[], labels: boolean) => h('span', { class: 'hs-tiles', dir: 'ltr' }, ...kinds.map((k) => mini(k, labels)));

function waitRow(w: WaitScore, labels: boolean): HTMLElement {
  const half = (v: WinValue | null, how: string) => h('span', { class: `hs-way${v ? '' : ' off'}` }, h('small', {}, how), v ? short(v) : tr('no win this way'));
  return h(
    'div',
    { class: 'hs-wait' },
    mini(w.kind, labels),
    h('div', { class: 'hs-ways' }, half(w.ron, tr('On a discard')), half(w.tsumo, tr('Self-drawn'))),
    h('span', { class: `hs-left${w.left ? '' : ' none'}`, title: tr('Copies you have not seen') }, w.left ? tr('{n} left', { n: w.left }) : tr('none left')),
  );
}

/** Your own hand now. `compact` keeps it short for a plate's card. */
export function handNowView(now: HandNow, labels: boolean, compact = false): HTMLElement {
  const box = h('div', { class: `hs-now${compact ? ' compact' : ''}` });
  const head = (t: string) => box.append(h('div', { class: 'hs-head' }, t));
  switch (now.state) {
    case 'win':
      head(tr('Mahjong now: you can declare this hand'));
      box.append(scoreRow(now.win), scoreLines(now.win.score, compact ? 4 : 99));
      break;
    case 'won':
      head(tr('Won this hand'));
      box.append(scoreRow(now.win), scoreLines(now.win.score, compact ? 4 : 99));
      break;
    case 'ready': {
      head(trn(now.waits.length, 'Ready: one tile wins', 'Ready: {n} tiles win'));
      const rows = compact ? now.waits.slice(0, 3) : now.waits;
      box.append(...rows.map((w) => waitRow(w, labels)));
      if (rows.length < now.waits.length) box.append(h('p', { class: 'hs-note' }, tr('+{n} more tiles', { n: now.waits.length - rows.length })));
      if (now.best) box.append(h('p', { class: 'hs-note' }, tr('Best win: {score}', { score: short(now.best) })));
      break;
    }
    case 'discard': {
      head(tr('Throw one of these to be ready'));
      const rows = now.options.slice(0, compact ? 2 : 5);
      for (const o of rows)
        box.append(
          h(
            'div',
            { class: 'hs-opt' },
            h('span', { class: 'hs-throw' }, h('small', {}, tr('Throw')), mini(o.discard, labels)),
            h('span', { class: 'hs-wins' }, h('small', {}, tr('Wins on')), tiles(o.waits.map((w) => w.kind), labels)),
            o.best ? h('span', { class: 'hs-best' }, short(o.best)) : null,
          ),
        );
      break;
    }
    case 'building':
      head(now.away >= 99 ? tr('no win possible with these sets') : trn(now.away, '{n} tile from ready', '{n} tiles from ready'));
      if (now.reach) {
        const r = now.reach;
        box.append(
          h(
            'div',
            { class: 'hs-reach' },
            h('small', {}, tr('Best win one swap away')),
            h('span', { class: 'hs-path', dir: 'ltr' }, h('span', {}, tr('Draw')), mini(r.draw, labels), h('span', {}, tr('throw')), mini(r.discard, labels), h('span', {}, tr('win on')), mini(r.wait, labels)),
            scoreRow(r.value),
          ),
        );
      } else box.append(h('p', { class: 'hs-note' }, tr('No score until the hand is a tile from winning. Open the calculator to try a finished hand.')));
      break;
    default:
      head(tr('Nothing to score yet'));
  }
  return box;
}

/** Another player's hand: only what is on show. */
export function onShowView(s: OnShow): HTMLElement {
  const row = (k: string, v: string) => h('div', { class: 'hs-kv' }, h('span', {}, k), h('strong', {}, v));
  return h(
    'div',
    { class: 'hs-now compact' },
    h('div', { class: 'hs-head' }, tr('On show')),
    row(tr('Points'), fmt(s.points)),
    row(tr('Sets on show'), String(s.sets + s.concealedKongs)),
    s.flowers ? row(tr('Flowers'), String(s.flowers)) : null,
    row(tr('Tiles hidden'), String(s.tiles)),
    h('p', { class: 'hs-note' }, tr('Their score stays hidden with their tiles until the hand ends.')),
  );
}
