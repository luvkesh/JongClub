// Coach mode: a light version of Mei's guided commentary for any AI table
// and any variation, switched on when the table is set up. She speaks at the
// moments that matter (your first turn, a claim you can make, being one tile
// from ready, an opponent who looks ready) and leaves a short note after each
// hand; the rest of the time she stays quiet.
//
// Lines from the guided-game scripts (coach.ts) are recorded in Mei's voice.
// The lines here are built from the position (tiles, names, waits), so they
// show as captions, and are read aloud only when a device voice is chosen in
// Settings (narrator.say's fallback). Never at ranked tables, where JongBot is
// off, nor at live or competition tables.

import { claimHint } from '../ai/jongbot';
import { dangerMap, readOpponents, threatSentence } from '../ai/danger';
import { currentShanten, evaluateDiscards } from '../ai/evaluate';
import type { MahjongGame } from '../engine/game';
import { tileName } from '../engine/tiles';
import { SHARED, TutorialCoach, type ClaimKind, type TurnInfo } from './coach';
import { h } from './dom';
import type { MatchOptions, TableConfig } from './match';
import './coachMode.css';
import { tr } from '../i18n';

const INTRO = 'Coach mode is on. I’ll speak up at the moments that matter: your first turn, a tile you can claim, being one tile from ready, and danger at the table. The rest is up to you.';

const list = (ks: number[]) => {
  const n = ks.map(tileName);
  return n.length <= 1 ? n.join('') : `${n.slice(0, -1).join(', ')} or ${n[n.length - 1]}`;
};

/** Coach mode is for your own AI tables: never ranked, live, daily or tournament games. */
export function coachAllowed(cfg: Pick<TableConfig, 'coach'>, opts: MatchOptions): boolean {
  if (!cfg.coach || opts.coach || opts.ranked || opts.link || opts.seats) return false;
  if (opts.mode && opts.mode !== 'ai' && opts.mode !== 'casual') return false;
  return !/^(ranked|daily|tournament|tutorial)/.test(opts.tag ?? '');
}

/** The match options with Mei's coach added when the table asked for it and it is allowed. */
export function withCoachMode(cfg: TableConfig, opts: MatchOptions): MatchOptions {
  return coachAllowed(cfg, opts) ? { ...opts, coach: new CoachMode(cfg.variation) } : opts;
}

/** The create-form field: Coach mode on or off. */
export function coachField(cfg: TableConfig): HTMLElement {
  const id = 'f-coach';
  const s = h('select', { id }, h('option', { value: 'off', selected: !cfg.coach }, tr('Off')), h('option', { value: 'on', selected: !!cfg.coach }, tr('On: Mei talks you through'))) as HTMLSelectElement;
  s.onchange = () => (cfg.coach = s.value === 'on');
  return h(
    'label',
    { class: 'field', for: id, title: tr('Mei, the club host, gives a tip on your first turn, explains claims, tells you when you are one tile from ready and warns you when someone looks ready. Not available in ranked games.') },
    h('span', {}, tr('Coach mode')),
    s,
  );
}

export class CoachMode extends TutorialCoach {
  override readonly keepsPace = true;
  private game: MahjongGame | null = null;
  private me = 0;
  private hints = true;
  private hand = 0;
  private turnInHand = 0;
  private readyThisHand = false;
  /** Opponents already warned about this hand. */
  private warned = new Set<number>();
  private claimsSeen = new Set<ClaimKind>();
  private tipAt = 0;

  constructor(variation: string) {
    super(variation);
    const eb = this.el.querySelector('.eyebrow');
    if (eb) eb.textContent = tr('Coach · Mei');
    this.el.classList.add('coach-mode');
  }

  /** The match to read (the app attaches it right after creating the match). */
  attach(game: MahjongGame, me: number, hints: boolean) {
    this.game = game;
    this.me = me;
    this.hints = hints;
  }

  override handStart() {
    this.hand++;
    this.turnInHand = 0;
    this.readyThisHand = false;
    this.warned.clear();
    if (this.hand === 1) this.say(INTRO);
  }

  override myTurn(info: TurnInfo) {
    this.turnInHand++;
    const m = this.script.moments ?? {};
    const extra = info.hint ? `JongBot: ${info.hint}` : '';
    if (info.canWin) {
      this.say(this.script.selfWin, extra, false, true);
      return;
    }
    if (info.canRiichi && this.say(m.riichi, extra, true, true)) return;
    if (info.canSwap && this.say(m.swap, extra, true, true)) return;
    const danger = this.danger();
    if (danger) {
      if (danger.line ? this.say(danger.line, danger.extra || extra, false, true) : (this.note(danger.extra || extra), true)) return;
    }
    if (info.ready && !this.readyThisHand) {
      this.readyThisHand = true;
      this.say(this.script.ready, this.waitsNote() || extra, false);
      return;
    }
    if (this.turnInHand === 1) {
      // The first hand gets the table's own first-turn line; later hands a tip each.
      const line = this.hand === 1 ? (info.dealer === false ? SHARED.firstLater : this.script.first) : this.script.tips[this.tipAt++];
      if (line && this.say(line, extra)) return;
    }
    this.note(extra);
  }

  override claimOffer(kinds: ClaimKind[]) {
    const k = (['win', 'kong', 'pung', 'chow'] as ClaimKind[]).find((x) => kinds.includes(x));
    if (!k) return;
    if (k === 'win') {
      this.say(this.script.claim.win ?? `That’s your winning tile! Press ${this.game?.profile.callNames.win ?? 'Mahjong'}, quickly!`, '', false, true);
      return;
    }
    const advice = this.claimAdvice();
    const recorded = this.script.claim[k];
    if (!this.claimsSeen.has(k) && recorded) {
      this.claimsSeen.add(k);
      this.say(recorded, advice, true, true);
      return;
    }
    const g = this.game;
    const ph = g?.state.phase;
    if (!g || ph?.kind !== 'claims') return;
    const word = g.profile.callNames[k];
    this.say(`You can ${word} the ${tileName(ph.tile.kind)}. ${advice || 'Take it if it brings you closer to winning; otherwise press Pass.'}`, '', false, true);
  }

  /** The guided game's "every tile is called out" line is for first-timers only. */
  override otherDiscard() {}

  override handEnd(outcome: 'you' | 'other' | 'draw') {
    const g = this.game;
    const r = g?.state.phase.kind === 'handOver' ? g.state.phase.result : null;
    let line = SHARED.drawn;
    if (g && r && outcome !== 'draw') {
      if (outcome === 'you') line = `Well played! ${r.score ? `That hand was worth ${r.score.value.toLocaleString('en-US')} ${r.score.unit}.` : ''} Let’s keep that rhythm going.`;
      else {
        const who = r.winner !== undefined ? g.players[r.winner].name : 'Another player';
        if (r.discarder === this.me) line = `${who} won on your discard. Next time someone looks ready, tiles they’ve already thrown are the safest.`;
        else {
          const sh = g.profile.card ? null : currentShanten(g, this.me);
          const mine = sh === null ? '' : sh <= 0 ? ' You were ready too, so that was close.' : ` You were ${sh === 1 ? 'one tile' : `${sh} tiles`} from ready.`;
          line = `${who} won that one${r.discarder === null ? ' on their own draw' : ''}.${mine}`;
        }
      }
    }
    this.say(line.replace(/\s+/g, ' ').trim(), '', false, true);
    this.noteOnResult(line);
  }

  override finish() {}

  // ------------------------------------------------------------ reading the table

  /** Someone looks ready and you haven't been warned about them this hand. */
  private danger(): { line: string | null; extra: string } | null {
    const g = this.game;
    if (!g || g.profile.card) return null;
    const threat = readOpponents(g, this.me)
      .filter((r) => (r.riichi || r.tenpai >= 0.6) && !this.warned.has(r.seat))
      .sort((a, b) => b.threat - a.threat)[0];
    if (!threat) return null;
    this.warned.add(threat.seat);
    const extra = this.safest();
    // Mei already said her recorded riichi warning when it was declared: just add the safe tiles.
    if (threat.riichi && this.script.moments?.otherRiichi) return { line: null, extra };
    return { line: `Careful. ${threatSentence(g, threat)} Tiles they’ve already thrown are the safest.`, extra };
  }

  /** The safest tiles in your hand right now, when hints are allowed. */
  private safest(): string {
    const g = this.game;
    if (!g || !this.hints) return '';
    try {
      const map = dangerMap(g, this.me);
      const kinds = [...new Set(g.players[this.me].hand.map((t) => t.kind))].filter((k) => k < map.loss.length && !g.isWild(k));
      const best = kinds.sort((a, b) => map.loss[a] - map.loss[b]).slice(0, 2);
      return best.length ? `Safest in your hand: ${list(best).replace(' or ', ' and ')}` : '';
    } catch {
      return '';
    }
  }

  /** Which discard leaves you ready, and what you'd wait on. */
  private waitsNote(): string {
    const g = this.game;
    if (!g || g.profile.card) return '';
    if (!this.hints) return tr('Choose your discard carefully: the right one leaves you ready.');
    try {
      const ready = evaluateDiscards(g, this.me).filter((e) => e.shanten <= 0);
      const best = ready.sort((a, b) => b.ukeire - a.ukeire)[0];
      if (!best) return '';
      return `Let go of the ${tileName(best.kind)} and you wait on the ${list(best.improvers)} (${best.ukeire} left).`;
    } catch {
      return '';
    }
  }

  /** JongBot's view of the claim on offer, when hints are allowed. */
  private claimAdvice(): string {
    const g = this.game;
    const ph = g?.state.phase;
    if (!g || !this.hints || ph?.kind !== 'claims') return '';
    try {
      const opts = ph.options[this.me] ?? [];
      return opts.length ? `JongBot: ${claimHint(g, this.me, opts, ph.tile.kind, 'learning').headline}` : '';
    } catch {
      return '';
    }
  }

  /** Put the post-hand note on the hand's result card too, once it opens. */
  private noteOnResult(line: string) {
    const root = this.el.parentElement;
    if (!root) return;
    let tries = 0;
    const t = window.setInterval(() => {
      const card = root.querySelector<HTMLElement>('.hand-result');
      if (card && !card.closest('[hidden]') && !card.querySelector('.coach-note')) {
        card.append(h('p', { class: 'coach-note' }, h('span', { class: 'narrator', 'aria-hidden': 'true' }, 'M'), h('span', {}, line)));
        window.clearInterval(t);
      } else if (++tries > 40 || !this.el.isConnected) window.clearInterval(t);
    }, 250);
  }
}
