// The score calculator: a panel at the table (the HUD calculator icon) that
// shows what your hand is worth now, and scores any hand you build from a tile
// picker with this table's rules and your place at it (seat and round wind,
// dealer, dora, flowers). It sits where the rule book does, over the middle of
// the table, clear of the HUD bar, your hand and the action row.

import { calcNeed, calculate, handNow, type CalcInput, type CalcResult } from '../ai/handScore';
import type { MahjongGame } from '../engine/game';
import { FLOWER_BASE, FLOWER_COUNT, KIND_COUNT, JOKER_KIND, isFlower, isHonor, rankOf, suitOf } from '../engine/tiles';
import { tr } from '../i18n';
import { tileLabel } from '../i18n/tiles';
import { clear, h, tileImg } from './dom';
import { handNowView, scoreLines, scoreRow } from './handScoreView';
import { guideFor } from './scoringGuideData';
import './scoreCalc.css';

/** A pocket calculator. */
export const CALC_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2.5" width="14" height="19" rx="2.2"/><rect x="7.8" y="5.3" width="8.4" height="4.2" rx="0.8"/><path d="M8.6 13h.01M12 13h.01M15.4 13h.01M8.6 16.2h.01M12 16.2h.01M8.6 19h.01M12 19h.01"/><path d="M15.4 15.6v3.8"/></svg>';

type Mode = 'tile' | 'pung' | 'chow' | 'kong' | 'ckong';

export interface CalcState {
  game: MahjongGame;
  /** Your seat (the table's winds, dealer and flowers are read for it). */
  seat: number;
  /** Watching, not playing: no hand of your own. */
  spectator: boolean;
  labels: boolean;
  /** Runs a read on the table as you see it (a tile you have still to draw is not in your hand yet). */
  seen?: <T>(fn: () => T) => T;
}

export class ScoreCalc {
  readonly button: HTMLButtonElement;
  readonly panel: HTMLElement;
  /** Opening the calculator closes the rule book, and the other way round. */
  onOpen?: () => void;
  private nowBox = h('div', { class: 'sc-now' });
  private hand: number[] = [];
  private melds: CalcInput['melds'] = [];
  private mode: Mode = 'tile';
  private selfDrawn = false;
  private riichi = false;
  private flowers = true;
  private els!: { hand: HTMLElement; melds: HTMLElement; count: HTMLElement; result: HTMLElement; modes: HTMLElement; ways: HTMLElement; flowers: HTMLElement };
  private built = false;

  constructor(private state: () => CalcState) {
    this.panel = h('aside', { class: 'sg-panel sc-panel', hidden: true, role: 'dialog', 'aria-label': tr('Score calculator') });
    this.button = h('button', { class: 'icon-btn calc-btn', 'aria-label': tr('Score calculator'), 'aria-expanded': 'false', title: tr('Score calculator: what your hand is worth now, or try any hand'), onclick: () => this.toggle() }) as HTMLButtonElement;
    this.button.innerHTML = CALC_ICON;
    this.panel.addEventListener('keydown', (e) => e.key === 'Escape' && this.toggle(false));
    // The table calls place() on resize (a window listener here would outlive the match).
  }

  get open() {
    return !this.panel.hidden;
  }

  toggle(force?: boolean) {
    const show = force ?? this.panel.hidden;
    if (show && !this.built) this.build();
    this.panel.hidden = !show;
    this.button.setAttribute('aria-expanded', String(show));
    this.button.classList.toggle('on', show);
    if (show) {
      this.onOpen?.();
      this.redraw();
      this.panel.querySelector<HTMLElement>('.sg-close')?.focus({ preventScroll: true });
    }
  }

  /** Same place as the rule book: between the HUD bar and your hand. */
  place() {
    const root = this.panel.parentElement;
    if (!root || this.panel.hidden) return;
    const box = root.getBoundingClientRect();
    const top = root.querySelector('.hud-top')?.getBoundingClientRect().bottom ?? box.top + 56;
    let bottom = root.querySelector('.bottom')?.getBoundingClientRect().top ?? box.bottom - 200;
    const plate = root.querySelector<HTMLElement>('.seat-0:not([hidden])')?.getBoundingClientRect();
    if (plate && plate.height && plate.top > top + 200) bottom = Math.min(bottom, plate.top);
    // Phones: little room above the hand, so the calculator takes the screen below the bar until closed.
    if (innerWidth <= 760 || innerHeight <= 500) bottom = box.bottom - 8;
    const y = top - box.top + 8;
    this.panel.style.top = `${y}px`;
    this.panel.style.maxHeight = `${Math.max(160, bottom - box.top - y - 8)}px`;
  }

  /** A new match or a new wind round: the rules (and the tiles) may have changed. */
  reset() {
    this.built = false;
    this.hand = [];
    this.melds = [];
    this.mode = 'tile';
    if (this.open) this.build(), this.redraw();
  }

  private pending = 0;

  /** Keep "your hand now" current. Cheap when closed; several changes in a row redraw once. */
  refresh() {
    if (!this.open || this.pending) return;
    this.pending = window.setTimeout(() => ((this.pending = 0), this.redraw()), 40);
  }

  private redraw() {
    if (!this.open) return;
    this.place();
    const s = this.state();
    clear(this.nowBox);
    if (s.spectator) return void this.nowBox.append(h('p', { class: 'hs-note' }, tr('You are watching: build a hand below to score it.')));
    this.nowBox.append(handNowView(this.seen(() => handNow(s.game, s.seat)), s.labels));
    this.syncFlowers();
  }

  /** The "Count my flowers" box follows your flowers this hand. */
  private syncFlowers() {
    if (!this.built) return;
    const s = this.state();
    const fl = s.spectator ? 0 : (s.game.players[s.seat]?.flowers.length ?? 0);
    this.els.flowers.hidden = !fl;
    if (fl) this.els.flowers.querySelector('span')!.textContent = tr('Count my flowers ({n})', { n: fl });
  }

  /** Tiles a hand can hold at this table, with how many of each the set has. */
  private palette(): [number, number][] {
    const p = this.state().game.profile;
    const out = new Map<number, number>();
    for (const k of p.tileKinds) if (k < KIND_COUNT) out.set(k, p.copiesPerKind);
    // Flowers are hand tiles on a card (American) or as jokers; elsewhere they go aside.
    if (p.card || p.flowersWild) for (let f = 0; f < FLOWER_COUNT; f++) out.set(FLOWER_BASE + f, 1);
    if (p.jokers) out.set(JOKER_KIND, p.jokers);
    for (const k of p.extraTiles ?? []) if (!p.bonusKinds?.includes(k)) out.set(k, (out.get(k) ?? 0) + 1);
    return [...out].sort((a, b) => a[0] - b[0]);
  }

  private used(kind: number) {
    return this.hand.filter((k) => k === kind).length + this.melds.reduce((a, m) => a + m.kinds.filter((k) => k === kind).length, 0);
  }

  private add(kind: number, copies: number) {
    const left = copies - this.used(kind);
    const p = this.state().game.profile;
    const need = calcNeed(this.state().game, this.melds.length);
    if (this.mode === 'tile') {
      if (left < 1 || this.hand.length >= need) return;
      this.hand.push(kind);
    } else {
      // Card hands have no sets to declare here: their exposures are part of the hand.
      if (p.card) return;
      const kinds =
        this.mode === 'chow' ? (kind < KIND_COUNT && !isHonor(kind) && rankOf(kind) <= 7 ? [kind, kind + 1, kind + 2] : null) : Array<number>(this.mode === 'pung' ? 3 : 4).fill(kind);
      const pal = new Map(this.palette());
      if (!kinds || kinds.some((k) => this.used(k) + kinds.filter((x) => x === k).length > (pal.get(k) ?? 0))) return;
      if (this.melds.length >= Math.floor((p.handSize + 1) / 3)) return;
      this.melds.push({ type: this.mode === 'ckong' ? 'kong' : this.mode, kinds, concealed: this.mode === 'ckong' });
      // Room for the rest: drop tiles past the new count.
      this.hand = this.hand.slice(0, calcNeed(this.state().game, this.melds.length));
    }
    this.update();
  }

  private seen<T>(fn: () => T): T {
    const s = this.state();
    return s.seen ? s.seen(fn) : fn();
  }

  /** Fill the calculator with your own hand (and its winning tile when it has one). */
  private useMine() {
    this.seen(() => this.fillMine());
  }

  private fillMine() {
    const s = this.state();
    const g = s.game;
    const pl = g.players[s.seat];
    if (!pl || s.spectator) return;
    this.melds = pl.melds.map((m) => ({ type: m.type, kinds: m.tiles.map((t) => t.kind), concealed: m.concealed }));
    const ph = g.state.phase;
    const drawn = ph.kind === 'turn' && ph.seat === s.seat ? ph.drawn : null;
    const kinds = pl.hand.filter((t) => t.id !== drawn?.id).map((t) => t.kind).sort((a, b) => a - b);
    this.hand = kinds;
    if (drawn) {
      this.hand.push(drawn.kind);
      this.selfDrawn = true;
    } else {
      const now = handNow(g, s.seat, false);
      if (now.state === 'ready') {
        const best = now.waits.slice().sort((a, b) => (b.ron?.score.points ?? b.tsumo?.score.points ?? 0) - (a.ron?.score.points ?? a.tsumo?.score.points ?? 0))[0];
        if (best) this.hand.push(best.kind), (this.selfDrawn = !best.ron);
      }
    }
    this.hand = this.hand.slice(0, calcNeed(g, this.melds.length));
    this.riichi = pl.riichi;
    this.update();
  }

  private result(): CalcResult {
    const s = this.state();
    return calculate(s.game, s.seat, { hand: this.hand, melds: this.melds, selfDrawn: this.selfDrawn, riichi: this.riichi, flowers: this.flowers });
  }

  private update() {
    const s = this.state();
    const g = s.game;
    const need = calcNeed(g, this.melds.length);
    const e = this.els;
    const sorted = this.hand.slice(0, -1).sort((a, b) => a - b);
    const win = this.hand.length === need ? this.hand[this.hand.length - 1] : undefined;
    const tile = (k: number, isWin = false) =>
      h('button', { class: `sc-tile${isWin ? ' win' : ''}`, 'aria-label': tr('Take out this tile'), title: isWin ? tr('Winning tile: tap to take it out') : tr('Tap to take it out'), onclick: () => this.removeHand(k, isWin) }, tileImg(k, 'mini', s.labels));
    clear(e.hand).append(...(win === undefined ? this.hand.slice().sort((a, b) => a - b).map((k) => tile(k)) : [...sorted.map((k) => tile(k)), h('span', { class: 'sc-gap' }), tile(win, true)]));
    if (!this.hand.length) e.hand.append(h('span', { class: 'sc-empty' }, tr('Tap tiles below to build a hand. The last tile you add is the winning tile.')));
    clear(e.melds).append(
      ...this.melds.map((m, i) =>
        h('button', { class: `sc-meld${m.concealed ? ' concealed' : ''}`, title: tr('Tap to take this set out'), 'aria-label': tr('Take this set out'), onclick: () => (this.melds.splice(i, 1), this.update()) }, ...m.kinds.map((k) => tileImg(k, 'mini', s.labels))),
      ),
    );
    e.melds.hidden = !this.melds.length;
    e.count.textContent = tr('{n} of {need} tiles', { n: this.hand.length, need });
    this.syncFlowers();
    // Tiles all used up can't be picked again.
    for (const b of this.panel.querySelectorAll<HTMLButtonElement>('.sc-pick')) b.disabled = this.used(Number(b.dataset.kind)) >= Number(b.dataset.copies);
    for (const b of e.modes.querySelectorAll<HTMLButtonElement>('button')) b.setAttribute('aria-pressed', String(b.dataset.mode === this.mode));
    for (const b of e.ways.querySelectorAll<HTMLButtonElement>('button')) b.setAttribute('aria-pressed', String((b.dataset.way === 'self') === this.selfDrawn));
    const r = this.result();
    clear(e.result);
    if (r.ok) e.result.append(scoreRow(r.win), scoreLines(r.win.score));
    else if (r.reason === 'count') {
      e.result.append(h('p', { class: 'sc-msg' }, tr('Add {n} more tiles to score the hand.', { n: r.need - this.hand.length })));
    } else if (r.reason === 'noValue') e.result.append(h('p', { class: 'sc-msg warn' }, tr('A winning shape, but it doesn’t score enough to win at this table (no scoring pattern, or under the minimum). Open the rule book to see what counts.')));
    else e.result.append(h('p', { class: 'sc-msg warn' }, tr('Not a winning hand with this winning tile.')));
  }

  private removeHand(kind: number, isWin: boolean) {
    if (isWin) this.hand.pop();
    else {
      // Take out one copy of that kind (never the winning tile).
      const last = this.hand.length - 1;
      const at = this.hand.findIndex((k, j) => k === kind && (j !== last || this.hand.length < calcNeed(this.state().game, this.melds.length)));
      if (at >= 0) this.hand.splice(at, 1);
    }
    this.update();
  }

  private build() {
    this.built = true;
    const s = this.state();
    const g = s.game;
    const p = g.profile;
    const seg = (cls: string, items: [string, string, string][], pick: (v: string) => void) =>
      h('div', { class: `sc-seg ${cls}`, role: 'group' }, ...items.map(([v, label, key]) => h('button', { type: 'button', [`data-${key}`]: v, 'aria-pressed': 'false', onclick: () => (pick(v), this.update()) }, label)));
    const modes: [string, string, string][] = [['tile', tr('Tile'), 'mode']];
    if (!p.card) {
      if (p.calls.pung) modes.push(['pung', tr('Pung'), 'mode']);
      if (p.calls.chow) modes.push(['chow', tr('Chow'), 'mode']);
      if (p.calls.exposedKong) modes.push(['kong', tr('Kong'), 'mode']);
      if (p.calls.concealedKong) modes.push(['ckong', tr('Concealed kong'), 'mode']);
    }
    const modeRow = seg('sc-modes', modes, (v) => (this.mode = v as Mode));
    const ways = seg('sc-ways', [['discard', tr('On a discard'), 'way'], ['self', tr('Self-drawn'), 'way']], (v) => (this.selfDrawn = v === 'self'));
    const check = (label: string, on: boolean, set: (v: boolean) => void) => {
      const input = h('input', { type: 'checkbox' }) as HTMLInputElement;
      input.checked = on;
      input.onchange = () => (set(input.checked), this.update());
      return h('label', { class: 'sc-check' }, input, h('span', {}, label));
    };
    // Flowers change every hand (and arrive after the deal), so update() keeps this one current.
    const flowerCheck = check('', this.flowers, (v) => (this.flowers = v));
    const opts = h(
      'div',
      { class: 'sc-opts' },
      ways,
      p.riichi ? check(tr(p.callNames.riichi ?? 'Riichi'), this.riichi, (v) => (this.riichi = v)) : null,
      flowerCheck,
    );
    // The tile picker: one row per suit, honours, then flowers and jokers.
    const rows = new Map<string, HTMLElement>();
    for (const [k, copies] of this.palette()) {
      const row = k < KIND_COUNT ? suitOf(k) : isFlower(k) ? 'flower' : 'extra';
      if (!rows.has(row)) rows.set(row, h('div', { class: 'sc-row', dir: 'ltr' }));
      rows.get(row)!.append(h('button', { type: 'button', class: 'sc-pick', 'data-kind': String(k), 'data-copies': String(copies), 'aria-label': tr('Add {tile}', { tile: tileLabel(k) }), onclick: () => this.add(k, copies) }, tileImg(k, 'mini', s.labels)));
    }
    const hand = h('div', { class: 'sc-hand', dir: 'ltr' });
    const melds = h('div', { class: 'sc-melds', dir: 'ltr', 'aria-label': tr('Sets on show') });
    const count = h('span', { class: 'sc-count' });
    const result = h('div', { class: 'sc-result', 'aria-live': 'polite' });
    this.els = { hand, melds, count, result, modes: modeRow, ways, flowers: flowerCheck };
    const sec = (title: string, open: boolean, ...body: (Node | null)[]) => {
      const d = h('details', { class: 'sg-sec' }, h('summary', {}, h('span', { class: 'sg-title' }, title)), h('div', { class: 'sg-cards' }, ...body));
      (d as HTMLDetailsElement).open = open;
      return d;
    };
    const unit = guideFor(p).unit;
    clear(this.panel).append(
      h(
        'header',
        { class: 'sg-head' },
        h('div', {}, h('p', { class: 'eyebrow' }, `${tr(p.name)} · ${tr(unit)}`), h('h3', {}, tr('Score calculator'))),
        h('button', { class: 'icon-btn sg-close', 'aria-label': tr('Close the score calculator'), onclick: () => this.toggle(false), html: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>' }),
      ),
      h(
        'div',
        { class: 'sg-body' },
        sec(tr('Your hand now'), true, this.nowBox),
        sec(
          tr('Try a hand'),
          true,
          // Wide panels: the hand and its score on one side, the tile picker on the other.
          // Narrow ones: the hand and score stay pinned above the picker as it scrolls.
          h(
            'div',
            { class: 'sc-grid' },
            h(
              'div',
              { class: 'sc-build' },
              h('div', { class: 'sc-tools' }, s.spectator ? null : h('button', { type: 'button', class: 'btn sc-mine', onclick: () => this.useMine() }, tr('Use my hand')), h('button', { type: 'button', class: 'btn ghost sc-clear', onclick: () => ((this.hand = []), (this.melds = []), this.update()) }, tr('Clear')), count),
              melds,
              hand,
              result,
            ),
            h(
              'div',
              { class: 'sc-picker' },
              opts,
              p.card ? null : h('div', { class: 'sc-add' }, h('span', { class: 'sc-cap' }, tr('Add')), modeRow),
              h('div', { class: 'sc-palette' }, ...rows.values()),
              h('p', { class: 'hs-note' }, tr('Scored with this table’s rules for your seat this hand: your seat and round wind, dealer, bonus tiles and house rules.')),
            ),
          ),
        ),
      ),
    );
    this.update();
  }
}
