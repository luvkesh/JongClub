// The opening ceremony at the table (engine/opening.ts has the rules): at the start
// of a match everyone throws for East, ties throwing again; every hand East throws
// to break the wall, the wall opens at the break and the front, back and marked
// section (flower wall, dead wall...) are shown. A caption card follows along; Skip
// (or Escape) jumps straight to the deal. The outcome never depends on watching it.

import type { GameState } from '../engine/state';
import type { EastRound, WallBreak } from '../engine/opening';
import type { TableRenderer } from '../render/table3d';
import { tr } from '../i18n';
import { h, clear } from './dom';
import { icon } from './icons';
import { sound } from '../audio/sound';
import './opening.css';

export interface OpeningCtx {
  root: HTMLElement;
  table: TableRenderer;
  names: string[];
  /** Your seat, -1 when watching. */
  me: number;
  /** 1 = classic pace; cinematic is a little slower. */
  pace: number;
  /** Everyone's throws for East (the first hand of a match only). */
  eastRounds?: EastRound[];
  /** Counting round the table: show `n` on this seat's plate for a moment. */
  pulseSeat?: (seat: number, n: number) => void;
}

const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);

const PIPS: Record<number, [number, number][]> = {
  1: [[12, 12]],
  2: [[7.5, 7.5], [16.5, 16.5]],
  3: [[7, 7], [12, 12], [17, 17]],
  4: [[7.5, 7.5], [16.5, 7.5], [7.5, 16.5], [16.5, 16.5]],
  5: [[7, 7], [17, 7], [12, 12], [7, 17], [17, 17]],
  6: [[7.5, 6.5], [16.5, 6.5], [7.5, 12], [16.5, 12], [7.5, 17.5], [16.5, 17.5]],
};

/** An ivory die face; ones and fours have red pips, as on the table's dice. */
function die(v: number): HTMLElement {
  const red = v === 1 || v === 4;
  const pips = PIPS[v] ?? PIPS[1];
  const span = h('span', { class: 'op-die', 'aria-hidden': 'true' });
  span.innerHTML = `<svg viewBox="0 0 24 24"><rect x="1.5" y="1.5" width="21" height="21" rx="5"/>${pips.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${v === 1 ? 3 : 2.1}"${red ? ' class="red"' : ''}/>`).join('')}</svg>`;
  return span;
}

const SEGMENT_LABEL: Record<WallBreak['segment'], string> = {
  flower: 'Flower wall',
  dead: 'Dead wall',
  last16: 'Last 16',
  loose: 'Loose tiles',
  none: '',
};

export async function runOpening(ctx: OpeningCtx, state: GameState): Promise<void> {
  const { table } = ctx;
  const wb = state.wallBreak;
  const dealer = state.round.dealerSeat;
  if (!wb) {
    table.breakWall();
    return;
  }
  let skipped = false;
  let wake: (() => void) | null = null;
  const wait = (ms: number) =>
    skipped
      ? Promise.resolve()
      : new Promise<void>((res) => {
          // __openingSlow: test harnesses (perf/opening-shot.cjs) stretch the pauses to catch each step.
          const t = window.setTimeout(done, (ms / ctx.pace) * ((window as { __openingSlow?: number }).__openingSlow ?? 1));
          function done() {
            window.clearTimeout(t);
            wake = null;
            res();
          }
          wake = done;
        });
  const name = (seat: number) => (seat === ctx.me ? tr('You') : (ctx.names[seat] ?? ''));

  const title = h('div', { class: 'op-title' });
  const rows = h('div', { class: 'op-rows' });
  const line = h('div', { class: 'op-line', 'aria-live': 'polite' });
  const skip = h('button', { class: 'op-skip', type: 'button', onclick: () => finish() });
  skip.innerHTML = `${icon('play')}<span>${tr('Skip')}</span>`;
  const act = h('div', { class: 'op-actions' });
  const card = h('div', { class: 'opening', role: 'status' }, h('div', { class: 'op-head' }, title, skip), rows, line, act);
  const labels = h('div', { class: 'op-labels', 'aria-hidden': 'true' });
  ctx.root.append(card, labels);
  table.setOpeningWide(true);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') finish();
  };
  window.addEventListener('keydown', onKey);

  function finish() {
    if (skipped) return;
    skipped = true;
    table.breakWall();
    table.diceHome();
    wake?.();
  }

  // Your own throws wait for Roll, and the result for Continue; Skip resolves them too.
  const press = (label: string, ic: string) =>
    skipped
      ? Promise.resolve()
      : new Promise<void>((res) => {
          const b = h('button', { class: 'op-act', type: 'button' });
          b.innerHTML = `${icon(ic)}<span>${label}</span>`;
          const done = () => {
            b.remove();
            wake = null;
            res();
          };
          b.onclick = done;
          wake = done;
          act.append(b);
          b.focus({ preventScroll: true });
        });
  const mine = (seat: number) => ctx.me >= 0 && seat === ctx.me;
  const chip = h('span', { class: 'op-count' });
  labels.append(chip);

  const row = (seat: number, values: number[], cls = '') =>
    h('div', { class: `op-row ${cls}` }, h('span', { class: 'op-name' }, name(seat)), h('span', { class: 'op-dice' }, ...values.map(die)), h('span', { class: 'op-total' }, String(sum(values))));

  try {
    // Everyone throws for East; the highest throw is East, ties throw again.
    if (ctx.eastRounds?.length) {
      title.textContent = tr('Throw for East');
      for (const [ri, round] of ctx.eastRounds.entries()) {
        clear(rows);
        line.textContent = tr('Highest throw is East');
        for (const t of round) {
          if (skipped) break;
          if (mine(t.seat)) {
            line.textContent = tr('Your turn to throw');
            await press(tr('Roll'), 'dice');
          } else {
            line.textContent = tr('{name} throws', { name: name(t.seat) });
            await wait(500);
          }
          if (skipped) break;
          table.rollDice(t.values, t.seat, { pace: 1.5, hold: true });
          sound.play('dice', 0.36 / ctx.pace);
          await wait(1000);
          rows.append(row(t.seat, t.values));
        }
        if (skipped) break;
        const best = Math.max(...round.map((t) => sum(t.values)));
        const top = round.filter((t) => sum(t.values) === best);
        [...rows.children].forEach((el, i) => el.classList.toggle('lead', sum(round[i].values) === best));
        if (top.length > 1 && ri < ctx.eastRounds.length - 1) {
          line.textContent = tr('Tie on {total}: {names} throw again', { total: best, names: top.map((t) => name(t.seat)).join(' · ') });
          await wait(1800);
        } else {
          // The result waits for you: who won the throw, and so who is East.
          card.classList.add('op-result');
          line.textContent = mine(top[0].seat) ? tr('You are East') : tr('{name} is East', { name: name(top[0].seat) });
          sound.play('score');
          await press(tr('Continue'), 'arrowRight');
          card.classList.remove('op-result');
        }
      }
    }

    // East throws to break the wall, counting round the table and then along the wall.
    if (!skipped) {
      title.textContent = tr('Breaking the wall');
      clear(rows);
      const [first, second] = wb.throws;
      if (mine(dealer)) {
        line.textContent = tr('Your throw to break the wall');
        await press(tr('Roll'), 'dice');
      } else {
        line.textContent = tr('{name} throws to break the wall', { name: name(dealer) });
        await wait(900);
      }
      if (!skipped) {
        table.rollDice(first.values, dealer, { pace: 1.1, hold: !!second });
        sound.play('dice', 0.5 / ctx.pace);
        await wait(1300);
        rows.append(row(dealer, first.values, 'lead'));
      }
      const total = sum(first.values);
      const own = wb.wallSeat === dealer && !second && wb.segment === 'none';
      if (!own && !skipped) {
        line.textContent = tr('Counting {total} round from East', { total });
        for (let k = 1; k <= total && !skipped; k++) {
          ctx.pulseSeat?.((dealer + k - 1) % ctx.names.length, k);
          sound.play('button');
          await wait(330);
        }
      }
      if (!skipped) {
        if (own) line.textContent = tr('East breaks their own wall, {count} stacks from the right', { count: wb.count });
        else line.textContent = mine(wb.wallSeat) ? tr('Counting {total} round from East: your wall', { total }) : tr('Counting {total} round from East: {name}’s wall', { total, name: name(wb.wallSeat) });
        await wait(1400);
      }
      if (second && !skipped) {
        if (mine(second.seat)) await press(tr('Roll'), 'dice');
        else await wait(600);
        if (!skipped) {
          table.rollDice(second.values, second.seat, { pace: 1.1 });
          sound.play('dice', 0.5 / ctx.pace);
          await wait(1300);
          rows.append(row(second.seat, second.values, 'lead'));
          line.textContent = tr('{name} throws {total} too: {count} stacks from the right', { name: name(second.seat), total: sum(second.values), count: wb.count });
          await wait(1400);
        }
      }
      // Along the wall: each stack lifts as it is counted from the right-hand end.
      if (!skipped) {
        line.textContent = tr('Counting {count} stacks from the right', { count: wb.count });
        labels.classList.add('show');
        const step = Math.min(420, Math.max(240, 5200 / wb.count));
        for (let k = 1; k <= wb.count && !skipped; k++) {
          const p = table.countStack(k);
          if (p) {
            const r = ctx.root.getBoundingClientRect();
            chip.textContent = String(k);
            chip.style.transform = `translate(${Math.round(p.x - r.left)}px, ${Math.round(p.y - r.top)}px) translate(-50%, -130%)`;
            chip.classList.remove('tick');
            void chip.offsetWidth;
            chip.classList.add('tick');
          }
          sound.play('button');
          await wait(step);
        }
        await wait(700);
        chip.remove();
      }
    }

    // The wall opens at the break; the front, back and marked section are shown.
    table.breakWall(!skipped);
    if (!skipped) {
      sound.play('slide');
      await wait(1100);
      const seg = wb.segment;
      line.textContent =
        seg === 'flower'
          ? tr('The {tiles} tiles counted off become the flower wall', { tiles: wb.segTiles })
          : seg === 'dead'
            ? tr('The last {tiles} tiles are the dead wall', { tiles: wb.segTiles })
            : seg === 'last16'
              ? tr('The last 16 tiles are never drawn')
              : seg === 'loose'
                ? tr('The two stacks at the break are the loose tiles')
                : tr('{count} stacks from the right: the wall breaks here', { count: wb.count });
      const tags: [string, 'front' | 'back' | 'seg'][] = [
        [tr('Front of the wall'), 'front'],
        [tr('Back of the wall'), 'back'],
      ];
      if (SEGMENT_LABEL[seg] && seg !== 'none') tags.push([tr(SEGMENT_LABEL[seg]), 'seg']);
      const els = tags.map(([text, k]) => h('span', { class: `op-tag op-${k}` }, text));
      labels.append(...els);
      let raf = 0;
      const place = () => {
        const pts = table.wallMarkPoints();
        if (pts) {
          const r = ctx.root.getBoundingClientRect();
          // Each label sits beside its token on the table's side of the wall, kept apart and on screen.
          const at = tags.map(([, k], i) => {
            const p = pts[k];
            const dx = pts.centre.x - p.x,
              dy = pts.centre.y - p.y;
            const side = Math.abs(dx) > Math.abs(dy);
            const w = els[i].offsetWidth,
              hgt = els[i].offsetHeight;
            const x = side ? p.x - r.left + Math.sign(dx) * (14 + w / 2) : p.x - r.left;
            const y = side ? p.y - r.top : p.y - r.top + Math.sign(dy) * (14 + hgt / 2);
            return { i, x, y, w, h: hgt, side };
          });
          const vertical = at.filter((a) => a.side).length >= at.length / 2;
          const key = (a: (typeof at)[number]) => (vertical ? a.y : a.x);
          at.sort((a, b) => key(a) - key(b));
          for (let j = 1; j < at.length; j++) {
            const a = at[j - 1],
              b = at[j];
            const gap = vertical ? (a.h + b.h) / 2 + 4 : (a.w + b.w) / 2 + 6;
            if (vertical && b.y - a.y < gap && Math.abs(b.x - a.x) < (a.w + b.w) / 2) b.y = a.y + gap;
            if (!vertical && b.x - a.x < gap && Math.abs(b.y - a.y) < (a.h + b.h) / 2 + 4) b.x = a.x + gap;
          }
          for (const a of at) {
            const x = Math.min(Math.max(a.x, a.w / 2 + 6), r.width - a.w / 2 - 6);
            const y = Math.min(Math.max(a.y, a.h / 2 + 6), r.height - a.h / 2 - 6);
            els[a.i].style.transform = `translate(${Math.round(x - a.w / 2)}px, ${Math.round(y - a.h / 2)}px)`;
          }
        }
        raf = requestAnimationFrame(place);
      };
      place();
      labels.classList.add('show');
      await wait(2800);
      cancelAnimationFrame(raf);
    }
  } finally {
    window.removeEventListener('keydown', onKey);
    table.setOpeningWide(false);
    card.classList.add('leaving');
    labels.classList.remove('show');
    window.setTimeout(() => {
      card.remove();
      labels.remove();
    }, 260);
  }
}
