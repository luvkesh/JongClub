// Game replay: step through a saved game on the 3D table with every hand
// shown, a timeline of turns, and JongBot's review of your decisions.

import { reviewClaim, reviewDiscard, type DecisionReview } from '../ai/review';
import { ABORTIVE_NAMES } from './drawnHand';
import type { MahjongGame } from '../engine/game';
import type { GameEvent, GameState } from '../engine/state';
import { tileLabel } from '../i18n/tiles';
import type { Action } from '../net/actions';
import { gameAt, replayHand, type ReplayRecord, type ReplayStep } from '../net/replay';
import type { TableRenderer } from '../render/table3d';
import { clear, h, tileImg } from './dom';
import { tr } from '../i18n';
import { getProfile } from '../engine/rules';

const VERDICT_LABEL: Record<DecisionReview['verdict'], string> = {
  best: tr('Best move'),
  good: tr('Good'),
  inaccuracy: tr('Inaccuracy'),
  mistake: tr('Mistake'),
  blunder: tr('Blunder'),
};

export class ReplayViewer {
  private hand = 0;
  private steps: ReplayStep[] = [];
  private at = 0;
  private playing = false;
  private timer = 0;
  private reviews = new Map<number, DecisionReview>();
  private els!: { title: HTMLElement; caption: HTMLElement; review: HTMLElement; slider: HTMLInputElement; marks: HTMLElement; play: HTMLButtonElement; hands: HTMLElement; count: HTMLElement };

  constructor(
    private table: TableRenderer,
    private root: HTMLElement,
    private rec: ReplayRecord,
    private labels: boolean,
    private onExit: () => void,
    start?: { hand: number; step: number },
  ) {
    table.humanSeat = rec.me >= 0 ? rec.me : 0;
    table.watchOnly = false;
    this.build();
    this.loadHand(Math.max(0, Math.min(rec.hands.length - 1, start?.hand ?? 0)));
    if (start) this.go(start.step);
    table.setView('seat', 1.2);
  }

  private name(seat: number) {
    return seat === this.rec.me ? tr('You') : this.rec.names[seat];
  }

  private build() {
    const r = clear(this.root);
    r.className = 'hud replay-hud';
    const slider = h('input', { type: 'range', min: '0', max: '0', value: '0', class: 'rp-slider', 'aria-label': tr('Move through the hand') }) as HTMLInputElement;
    slider.oninput = () => this.go(Number(slider.value));
    const play = h('button', { class: 'btn sm', onclick: () => this.toggle() }, tr('Play')) as HTMLButtonElement;
    this.els = {
      title: h('div', { class: 'rp-title' }),
      caption: h('div', { class: 'rp-caption', 'aria-live': 'polite' }),
      review: h('div', { class: 'rp-review' }),
      slider,
      marks: h('div', { class: 'rp-marks', 'aria-hidden': 'true' }),
      play,
      hands: h('div', { class: 'rp-hands' }),
      count: h('span', { class: 'rp-count' }),
    };
    r.append(
      h(
        'div',
        { class: 'hud-top' },
        h('div', { class: 'round-badge' }, this.els.title, h('div', { class: 'round-meta' }, tr('Replay · every hand shown'))),
        h('div', { class: 'hud-tools' }, h('button', { class: 'icon-btn', 'aria-label': tr('Close replay'), onclick: () => this.close() }, '✕')),
      ),
      h(
        'div',
        { class: 'bottom rp-bottom' },
        this.els.review,
        this.els.caption,
        h('div', { class: 'rp-track' }, this.els.marks, slider),
        h(
          'div',
          { class: 'rp-controls' },
          h('button', { class: 'btn sm ghost', 'aria-label': tr('Previous move'), onclick: () => this.go(this.at - 1) }, '‹'),
          play,
          h('button', { class: 'btn sm ghost', 'aria-label': tr('Next move'), onclick: () => this.go(this.at + 1) }, '›'),
          h('button', { class: 'btn sm ghost', onclick: () => this.nextKey() }, tr('Next key moment')),
          this.els.count,
        ),
        this.els.hands,
      ),
    );
  }

  private loadHand(n: number) {
    this.stop();
    this.hand = n;
    this.steps = replayHand(this.rec, n).steps;
    this.reviews.clear();
    // Review your decisions in this hand.
    if (this.rec.me >= 0) {
      for (const st of this.steps) {
        if (!st.action || !st.before || st.action.s !== this.rec.me) continue;
        const r = this.review(st.before, st.action);
        if (r) this.reviews.set(st.index, r);
      }
    }
    const s = this.els.slider;
    s.max = String(this.steps.length - 1);
    // Timeline marks: wins, calls and your notable decisions.
    const marks = clear(this.els.marks);
    const total = Math.max(1, this.steps.length - 1);
    for (const st of this.steps) {
      const rv = this.reviews.get(st.index);
      const kind = st.events.some((e) => e.type === 'win') ? 'win' : st.events.some((e) => e.type === 'call') ? 'call' : rv && rv.verdict !== 'best' && rv.verdict !== 'good' ? rv.verdict : '';
      if (!kind) continue;
      marks.append(h('i', { class: `mk mk-${kind}`, style: { left: `${(st.index / total) * 100}%` }, title: kind }));
    }
    const hands = clear(this.els.hands);
    this.rec.hands.forEach((_, i) => hands.append(h('button', { class: `chip-btn ${i === n ? 'on' : ''}`, onclick: () => this.loadHand(i) }, tr('Hand {n}', { n: i + 1 }))));
    this.go(0);
  }

  private review(before: GameState, a: Action): DecisionReview | null {
    const g: MahjongGame = gameAt(this.rec, before);
    try {
      if (a.t === 'd') return reviewDiscard(g, a.s, a.id);
      if (a.t === 'c' && before.phase.kind === 'claims') {
        const opts = before.phase.options[a.s] ?? [];
        if (!opts.length) return null;
        return reviewClaim(g, a.s, a.r, opts, before.phase.tile.kind);
      }
    } catch {
      return null;
    }
    return null;
  }

  private go(i: number) {
    if (!this.steps.length) return;
    this.at = Math.max(0, Math.min(this.steps.length - 1, i));
    const st = this.steps[this.at];
    this.els.slider.value = String(this.at);
    this.table.discardDefault = getProfile(this.rec.config.variation)?.discards ?? 'rows';
    this.table.layout(st.state, { reveal: st.state.players.map((_, i) => i), winner: st.state.phase.kind === 'handOver' ? st.state.phase.result.winner : undefined });
    this.els.title.textContent = `${this.rec.config.name} · ${tr('Hand {n} of {total}', { n: this.hand + 1, total: this.rec.hands.length })}`;
    this.els.count.textContent = this.at === 0 ? tr('The deal') : tr('Turn {turn} · move {n} of {total}', { turn: this.turnOf(st.state), n: this.at, total: this.steps.length - 1 });
    this.els.caption.textContent = this.describe(st);
    const rv = this.reviews.get(st.index);
    const box = clear(this.els.review);
    box.hidden = !rv;
    if (rv) {
      box.className = `rp-review v-${rv.verdict}`;
      box.append(
        h('div', { class: 'bot-head' }, h('span', { class: 'bot-mark' }, '◆'), tr('JongBot'), h('span', { class: `verdict v-${rv.verdict}` }, VERDICT_LABEL[rv.verdict])),
        h('p', { class: 'bot-line' }, rv.explanation),
        rv.bestKind !== null && rv.bestKind !== rv.chosenKind ? h('div', { class: 'rp-better' }, tr('Better: '), tileImg(rv.bestKind, 'mini', this.labels), tileLabel(rv.bestKind)) : '',
      );
    }
  }

  private turnOf(s: GameState) {
    return Math.max(1, Math.ceil(s.turnCount / Math.max(1, s.players.length)));
  }

  private describe(st: ReplayStep): string {
    if (!st.action) {
      const dealer = Math.max(0, st.state.seatWinds.indexOf('E'));
      return dealer === this.rec.me ? tr('You deal. Every hand is shown face up.') : tr('{name} deals. Every hand is shown face up.', { name: this.name(dealer) });
    }
    const parts: string[] = [];
    for (const e of st.events) {
      const line = this.eventLine(e);
      if (line) parts.push(line);
    }
    if (!parts.length) {
      const a = st.action;
      if (a.t === 'c' && a.r.type === 'pass') return '';
    }
    return parts.join(' ');
  }

  private eventLine(e: GameEvent): string {
    const you = 'seat' in e && e.seat === this.rec.me;
    const p = { name: 'seat' in e && e.seat !== undefined ? this.name(e.seat) : '' };
    switch (e.type) {
      case 'discard':
        return tr(you ? (e.riichi ? 'You discard {tile} and declare riichi.' : 'You discard {tile}.') : e.riichi ? '{name} discards {tile} and declares riichi.' : '{name} discards {tile}.', { ...p, tile: tileLabel(e.tile.kind) });
      case 'call':
        return tr(you ? 'You call {claim} on {tile}.' : '{name} calls {claim} on {tile}.', { ...p, claim: ({ pung: tr('pung'), chow: tr('chow'), kong: tr('kong') } as Record<string, string>)[e.claim] ?? e.claim, tile: tileLabel(e.meld.tiles[0].kind) });
      case 'win':
        return tr(you ? (e.selfDrawn ? 'You win by self-draw with {tile}!' : 'You win with {tile}!') : e.selfDrawn ? '{name} wins by self-draw with {tile}!' : '{name} wins with {tile}!', { ...p, tile: tileLabel(e.tile.kind) });
      case 'flower':
        return tr(you ? 'You set aside the {tile}.' : '{name} sets aside the {tile}.', { ...p, tile: tileLabel(e.tile.kind) });
      case 'robKong':
        return tr(you ? 'You rob the kong.' : '{name} robs the kong.', p);
      case 'exhausted':
        return tr('The wall runs out. Drawn hand.');
      case 'abortive':
        return tr('Abortive draw: {name}.', { name: tr(ABORTIVE_NAMES[e.reason]) });
      case 'charlestonPassed':
        return tr('Charleston: everyone passes three tiles.');
      case 'jokerSwap':
        return tr(you ? 'You swap for a joker.' : '{name} swaps for a joker.', p);
      default:
        return '';
    }
  }

  private nextKey() {
    for (let i = this.at + 1; i < this.steps.length; i++) {
      const st = this.steps[i];
      const rv = this.reviews.get(st.index);
      if (st.events.some((e) => e.type === 'win' || e.type === 'call' || e.type === 'exhausted') || (rv && rv.weight >= 0.4)) return this.go(i);
    }
    this.go(this.steps.length - 1);
  }

  private toggle() {
    if (this.playing) this.stop();
    else {
      this.playing = true;
      this.els.play.textContent = tr('Pause');
      this.timer = window.setInterval(() => {
        if (this.at >= this.steps.length - 1) return this.stop();
        this.go(this.at + 1);
      }, 900);
    }
  }

  private stop() {
    this.playing = false;
    window.clearInterval(this.timer);
    if (this.els) this.els.play.textContent = tr('Play');
  }

  close() {
    this.stop();
    clear(this.root);
    this.onExit();
  }
}
