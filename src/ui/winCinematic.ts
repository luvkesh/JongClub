// The signature moment's frame on screen: two quiet bars close in like a
// film's letterbox while the table plays its cinematic (render/cinematic.ts),
// with the hand's name engraved small in the lower bar. A tap anywhere (or
// Skip) cuts it short. Reduced motion: no sliding, a short fade.

import type { HandScore } from '../engine/rules/types';
import { isSignatureWin, signatureName } from '../render/cinematic';
import type { TableRenderer } from '../render/table3d';
import { h } from './dom';
import { tr } from '../i18n';
import './winCinematic.css';

/** The moment's name in the player's language: "2× Yakuman" keeps its count. */
const sigLabel = (name: string) => {
  const m = /^(\d+)× Yakuman$/.exec(name);
  return m ? tr('{n}× Yakuman', { n: m[1] }) : tr(name);
};

export interface WinCinematic {
  /** Resolves when the moment has played or been skipped. */
  done: Promise<void>;
  skip(): void;
}

/** Start the signature moment for a win, or return null if the hand is not a limit hand or yakuman. */
export function startWinCinematic(table: TableRenderer, root: HTMLElement, winner: number, score: HandScore | undefined, mine: boolean): WinCinematic | null {
  if (!isSignatureWin(score)) return null;
  const secs = table.playSignatureWin(winner);
  const calm = secs < 2;
  let finish!: () => void;
  const done = new Promise<void>((r) => (finish = r));
  let over = false;
  const el = h(
    'div',
    { class: `sig-moment ${calm ? 'calm' : ''} ${mine ? 'mine' : ''}`, role: 'presentation' },
    h('div', { class: 'sig-bar top' }),
    h('div', { class: 'sig-bar bottom' }, h('span', { class: 'sig-name' }, sigLabel(signatureName(score!)))),
    h('button', { class: 'sig-skip', 'aria-label': tr('Skip the moment') }, tr('Skip ›')),
  );
  const end = (skipped: boolean) => {
    if (over) return;
    over = true;
    clearTimeout(tm);
    if (skipped) table.skipSignatureWin();
    el.classList.add('out');
    document.body.classList.remove('sig-on');
    window.setTimeout(() => el.remove(), 380);
    finish();
  };
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    end(true);
  });
  const tm = window.setTimeout(() => end(false), secs * 1000);
  root.append(el);
  void el.offsetWidth;
  el.classList.add('on');
  document.body.classList.add('sig-on');
  return { done, skip: () => end(true) };
}
