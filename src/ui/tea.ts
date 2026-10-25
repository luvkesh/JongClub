// Passing tea: once per hand each player (you, other people and the bots) may
// pass a cup of tea to someone at the table. A cup glides round to the
// receiver's side table, who nods thanks and sips (render/sideTables.ts). It is
// purely social: it never touches play, scores or ratings.
//
// Live tables: your cup travels as the preset signal "tea:<seat>" (net/etiquette.ts),
// like a reaction. Bots decide from a seed of the match, hand and seat, and pass
// at a set discard, so every client sees the same bot pass the same cup.

import { Rng } from '../engine/rng';
import { etiquetteHidden, teaCode, teaTarget } from '../net/etiquette';
import type { Personality } from '../ai/players';
import { clear, h } from './dom';
import { tr } from '../i18n';
import './tea.css';

/** How likely each personality is to pass tea in a hand, and to return a cup you passed them. */
const GIVE: Record<Personality, number> = { teacher: 0.55, zen: 0.6, wall: 0.25, shark: 0.15, gambler: 0.45 };
const RETURN: Record<Personality, number> = { teacher: 0.7, zen: 0.8, wall: 0.4, shark: 0.25, gambler: 0.6 };

export interface TeaHost {
  /** Seats at the table (3 or 4). */
  seats: number;
  me: number;
  spectator: boolean;
  /** A live table: bots pass only on their seeded schedule, so every client agrees. */
  live: boolean;
  matchSeed: number;
  name(seat: number): string;
  /** A bot's personality, or null for a person. */
  personality(seat: number): Personality | null;
  /** The seat's plate, for the little "tea" bubble. */
  plate(seat: number): HTMLElement;
  /** Play the cup on the table; ms until it arrives. */
  pass(from: number, to: number): number;
  /** Share your own cup at a live table. */
  send(code: string): void;
  /** No animation now (a live table catching up). */
  quiet(): boolean;
  gone(): boolean;
}

export class TeaService {
  /** The "Pass tea" row for the reactions menu. */
  readonly row: HTMLElement;
  private used = new Set<number>();
  private plan = new Map<number, { at: number; to: number }>();
  private hand = -1;
  private buttons: HTMLButtonElement[] = [];
  private note: HTMLElement;

  constructor(
    private host: TeaHost,
    onPick: () => void,
  ) {
    this.note = h('span', { class: 'tea-note' });
    const targets = Array.from({ length: host.seats }, (_, s) => s).filter((s) => s !== host.me);
    this.buttons = targets.map((s) => {
      const b = h('button', { class: 'tea-btn', 'aria-label': tr('Pass a cup of tea to {name}', { name: host.name(s) }), title: tr('Pass a cup of tea to {name}', { name: host.name(s) }) }, host.name(s)) as HTMLButtonElement;
      b.onclick = () => {
        if (this.give(host.me, s)) onPick();
      };
      return b;
    });
    this.row = h('div', { class: 'tea-row', hidden: host.spectator }, h('span', { class: 'tea-label' }, h('span', { class: 'tea-glyph', 'aria-hidden': 'true' }, '🍵'), tr('Pass tea')), h('div', { class: 'tea-targets' }, ...this.buttons), this.note);
    this.refresh();
  }

  /** A new hand: everyone's cup is full again, and the bots decide whether to pass one. */
  startHand(handNo: number) {
    this.hand = handNo;
    this.used.clear();
    this.plan.clear();
    const taken = new Set<number>();
    for (let s = 0; s < this.host.seats; s++) {
      const p = this.host.personality(s);
      if (!p) continue;
      const rng = new Rng(((this.host.matchSeed * 31 + handNo * 7919 + s * 104729) ^ 0x7ea7ea) >>> 0);
      if (rng.next() >= GIVE[p]) continue;
      let to = rng.int(this.host.seats - 1);
      if (to >= s) to++;
      let at = 3 + rng.int(18);
      while (taken.has(at)) at++;
      taken.add(at);
      this.plan.set(s, { at, to });
    }
    this.refresh();
  }

  /** After each discard (counted from the start of the hand): a bot whose moment it is passes its cup. */
  onDiscard(count: number) {
    for (const [seat, p] of [...this.plan]) {
      if (p.at !== count) continue;
      this.plan.delete(seat);
      this.give(seat, p.to);
    }
  }

  /** A signal from another player at a live table. True if it was a cup of tea. */
  onSignal(seat: number, code: string): boolean {
    const to = teaTarget(code);
    if (to === null) return false;
    if (seat !== this.host.me || this.host.spectator) this.give(seat, to, true);
    return true;
  }

  canGive(seat: number) {
    return this.hand >= 0 && !this.used.has(seat);
  }

  /** Pass a cup from one seat to another, at most once per seat per hand. */
  give(from: number, to: number, remote = false): boolean {
    const n = this.host.seats;
    if (from === to || from < 0 || to < 0 || from >= n || to >= n || !this.canGive(from)) return false;
    this.used.add(from);
    this.plan.delete(from);
    const mine = from === this.host.me && !this.host.spectator;
    if (mine && !remote) this.host.send(teaCode(to));
    this.refresh();
    if (this.host.quiet()) return true;
    const ms = this.host.pass(from, to);
    const hand = this.hand;
    window.setTimeout(() => {
      if (this.host.gone()) return;
      // A person who hid other players' phrases and reactions doesn't see their bubbles either.
      const person = !mine && !this.host.personality(from);
      if (!(person && etiquetteHidden())) this.bubble(from, to);
      // At your own table a bot may pour one back for you.
      const p = this.host.personality(to);
      if (mine && p && !this.host.live && this.canGive(to) && Math.random() < RETURN[p])
        window.setTimeout(() => !this.host.gone() && this.hand === hand && this.give(to, from), 2600 + Math.random() * 1800);
    }, ms + 150);
    return true;
  }

  private bubble(from: number, to: number) {
    const me = this.host.me;
    const text = to === me && !this.host.spectator ? tr('{name} passes you tea', { name: this.host.name(from) }) : from === me && !this.host.spectator ? tr('Tea from you') : tr('Tea from {name}', { name: this.host.name(from) });
    const plate = this.host.plate(to);
    plate.querySelector('.phrase-bubble')?.remove();
    const b = h('div', { class: 'phrase-bubble gesture tea-bubble', role: 'status' }, h('span', { class: 'pb-glyph', 'aria-hidden': 'true' }, '🍵'), h('span', { class: 'pb-text' }, text));
    plate.append(b);
    window.setTimeout(() => b.remove(), 3400);
  }

  private refresh() {
    const can = !this.host.spectator && this.canGive(this.host.me);
    for (const b of this.buttons) b.disabled = !can;
    clear(this.note).append(this.hand >= 0 && !can ? tr('You have passed your tea this hand') : '');
  }
}
