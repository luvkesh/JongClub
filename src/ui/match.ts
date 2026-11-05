// Match controller: drives a MahjongGame, asks AI or the human for each
// decision, and keeps the 3D table and HUD in sync. Rules live in the
// engine; this file only sequences, times and presents.

import type { DiscardSetting } from '../render/discardMarks';
import { labsButton } from '../dev/panel';
import { icon } from './icons';
import { dev } from '../dev/devMode';
import { cardUses, currentShanten, evaluateDiscards, exchangePick, unseenCounts } from '../ai/evaluate';
import { SMALL_CARDS, cardSets, type SmallCard } from '../engine/rules/indiaCards';
import { NORTH, NUMBER_NAMES, northBig, northGoulash } from '../engine/rules/india';
import { BIG_CARDS, type BigCard, type BigGroup } from '../engine/rules/indiaBig';
import { likelyTargets, riskyTargetKinds, targetKit, type TargetKit, type TargetPlan } from '../ai/targets';
import { bigCardView, smallCardView } from './smallCard';
import { cardDistances } from '../ai/indiaCardPick';
import { SPECIAL_ROUNDS, type SpecialRoundId } from '../engine/rules/windRounds';
import { charlestonHint, claimHint, handStatus, turnHint, type Hint, type HintDepth } from '../ai/jongbot';
import { callLeavesNoWin } from '../ai/strategy';
import { AiPlayer, PERSONALITIES, seatNames, type Difficulty, type Personality } from '../ai/players';
import { callers } from '../audio/callers';
import { sound } from '../audio/sound';
import { narrator } from '../audio/voice';
import { CHARLESTON, MahjongGame, charlestonDirName, type JokerSwap } from '../engine/game';
import type { GameState } from '../engine/state';
import { randomSeed } from '../engine/rng';
import { GAME_LENGTHS, roundLabel, roundProfileFor, seatWind, timedMatchOver, type GameLength, type RoundState } from '../engine/rounds';
import { eastRoll, openingRules, type EastRound } from '../engine/opening';
import { runOpening } from './opening';
import { VARIATIONS, getProfile, withHouseRules } from '../engine/rules';
import { CARD, CARD_KEY, progress } from '../engine/rules/american';
import { classicProfile } from '../engine/rules/classic';
import type { ClaimOption, ClaimResponse, GameEvent, HandResult } from '../engine/state';
import type { Payment } from '../engine/rules/types';
import { ANIMAL_BASE, CAT, CENTIPEDE, JOKER_KIND, KIND_COUNT, MOUSE, ROOSTER, isAnimal, isFlower, isHonor, isJoker, isRed, tileName, type HandSort } from '../engine/tiles';
import { avatarSvg } from '../cosmetics/avatar';
import { avatarPortraitUrl } from '../render/avatar3d';

import type { MatchSummary } from '../progression/profile';
import type { TableRenderer } from '../render/table3d';
import type { AvatarSpec } from '../cosmetics/catalog';
import { applyAction, decisionAction, handSeed, type Action } from '../net/actions';
import { ABORTIVE_NAMES, drawnHandNote } from './drawnHand';
import type { LockstepLink } from '../net/lockstep';
import type { ReplayRecord } from '../net/replay';
import type { ClaimKind, TutorialCoach } from './coach';
import { clear, fmt, h, sleep, tileImg } from './dom';
import { openArea, winTableSets, summaryToggle, winHandSection } from './winReveal';
import { ALL_HANDS_ICON, allHandsList } from './allHands';
import { arrangeHand, moveTile, type HandLayout, type HandSlot } from './handOrder';
import { viewControls } from './viewControls';
import { startFreeCamera } from './freeCam';
import { quadrantOf, seatAtQuadrant, seatList, type Quadrant } from '../render/seatLayout';
import { haptic } from './accessibility';
import { charlestonPrompt, claimPrompt, hintSpoken, resultSpoken, turnPrompt, votePrompt, withHint, LINES, type Spoken } from './matchLines';
import { Countdown, firstTurnLimit, paceLimits, type TablePace } from './pace';
import './match.css';
import { startWinCinematic } from './winCinematic';
import { showCheatSheet, usesDubaiCard } from './cheatSheet';
import { ScoringGuide } from './scoringGuide';
import { CALC_ICON, ScoreCalc } from './scoreCalc';
import { handNow, onShow } from '../ai/handScore';
import { handNowView, onShowView } from './handScoreView';
import { fillEtiquetteBar, showSignal } from './etiquette';
import { TeaService } from './tea';
import { diceForVariation } from '../render/sideTables';
import { andList, tr, trn } from '../i18n';
import { tileLabel } from '../i18n/tiles';
import { cardGrip, consoleWidth, dockButton, hudMode, moreSheet, restoreCard, type GridItem, type HudMode } from './matchControls';
import { applyVolumes, type MusicSettings } from './musicToggle';
import './matchControls.css';

/** A seat plate's portrait: the 3D figure's head and shoulders, or the flat bust where WebGL is unavailable. */
const seatPortrait = (a: AvatarSpec) => {
  const url = avatarPortraitUrl(a, 48);
  return url ? `<img src="${url}" alt="" width="40" height="40" draggable="false">` : avatarSvg(a, 40);
};

export interface TableConfig {
  name: string;
  variation: string;
  length: GameLength;
  difficulty: Difficulty;
  personalities: Personality[];
  houseRules: Record<string, string>;
  /** Turn time in seconds (kept for older tables and the lobby; `pace` decides when set). */
  timer: number;
  hints: boolean;
  /** Table speed: claim and turn time limits (see pace.ts). */
  pace?: TablePace;
  /** Coach mode: Mei's light commentary at an AI table (never ranked; see coachMode.ts). */
  coach?: boolean;
}

export interface Settings {
  speed: 'minimal' | 'classic' | 'cinematic';
  hintDepth: HintDepth;
  labels: boolean;
  /** Your hand's order: grouped by suit, or by number across suits. */
  sort: HandSort;
  /** Pull complete sets (pungs, runs) to the left of your hand. */
  groupSets?: boolean;
  /** Softly mark the tiles in your hand that match the latest discard (default on). */
  matchHighlight?: boolean;
  /** When you are one tile from winning, show which tiles complete your hand and how many are left (default on). */
  showWaits?: boolean;
  /** Take each tile from the wall for you. Off by default: you tap Draw (or press D) on your turn. */
  autoDraw?: boolean;
  /** How discards lie on the table: the variation's own layout ('auto'), or always rows, a pond or the centre board. */
  discardLayout?: DiscardSetting;
}


export interface MatchHooks {
  onExit(): void;
  onFinished(summary: MatchSummary, standings: { name: string; score: number; seat: number }[], insight: string, replay: ReplayRecord): void;
  openSettings(): void;
  /** Labs, the testing tools (shown only while Labs is on). */
  openLabs?(): void;
  /** The music on/off button (musicToggle.ts), kept in step with the top bar and Settings. */
  musicButton?(): HTMLElement;
  saveSettings?(): void;
  /** After every finished hand (daily challenges read it). */
  onHand?(result: HandResult, game: MahjongGame, me: number): void;
}

const THINK = { minimal: 220, classic: 650, cinematic: 950 };
/** How long the table breathes at each speed (AI thinking, the beat after a discard or call). */
const PACE = { minimal: 0.45, classic: 1, cinematic: 1.4 };
/** Thinking style: quick sharks and gamblers, a teacher who considers, a zen player who takes their time. */
const PERSONALITY_PAUSE: Record<Personality, number> = { shark: -150, gambler: -100, teacher: 150, wall: 100, zen: 200 };
const DIFFICULTY_PAUSE: Record<Difficulty, number> = { beginner: 150, casual: 50, strategic: 0, expert: -100 };
/** An AI turn takes about a second at the default speed (aiPause). */
const AI_PAUSE_MIN = 800;
const AI_PAUSE_MAX = 1250;

export type SeatKind = 'local' | 'ai' | 'remote';

export interface SeatSpec {
  kind: SeatKind;
  name: string;
  personality?: Personality;
  difficulty?: Difficulty;
  avatar?: AvatarSpec;
}

export interface MatchOptions {
  /** Match seed: hand seeds are derived from it, so the match can be replayed. */
  seed?: number;
  seats?: SeatSpec[];
  /** Spectators watch from this seat. */
  viewSeat?: number;
  /** Ranked: hints off, rating changes. */
  ranked?: boolean;
  /** What kind of game this is, for history and replays. */
  mode?: 'ai' | 'casual' | 'ranked' | 'private' | 'daily' | 'tournament' | 'multiplayer';
  /** Multiplayer lockstep connection. */
  link?: LockstepLink;
  /** Free-form tag the app uses to recognise this game when it ends (e.g. 'daily:speedJong'). */
  tag?: string;
  /** Stop after this many hands (daily challenges). */
  maxHands?: number;
  /** Join a running match at the start of hand `hand` (late spectators). */
  resume?: { hand: number; round: RoundState; scores: number[]; pot: number };
  /** Guided game: Mei talks the player through the hand. */
  coach?: TutorialCoach;
}

/**
 * A stray selection (from a double tap or long press before the no-select styles applied, or one
 * started outside the table) is dropped as soon as you touch the table or its HUD again, so it can
 * never sit over the table. Installed once; fields you type in keep their own selection.
 */
let selectionGuard = false;
function guardSelection() {
  if (selectionGuard || typeof document === 'undefined') return;
  selectionGuard = true;
  const drop = (e: Event) => {
    const t = e.target as Element | null;
    if (!t?.closest?.('#stage, #hud') || t.closest('input, textarea, [contenteditable]')) return;
    const sel = document.getSelection();
    if (sel && !sel.isCollapsed) sel.removeAllRanges();
  };
  document.addEventListener('pointerdown', drop, true);
  document.addEventListener('pointerup', drop, true);
  document.addEventListener('selectstart', (e) => {
    const t = e.target instanceof Element ? e.target : (e.target as Node | null)?.parentElement;
    if (t?.closest('#stage, #hud') && !t.closest('input, textarea, [contenteditable]')) e.preventDefault();
  });
}

export class MatchController {
  readonly game: MahjongGame;
  private ais: AiPlayer[];
  private tea: TeaService;
  /** The special wind round being played, if any (to announce a change). */
  private specialRound: SpecialRoundId | undefined;
  /** Live decisions already shared before they were committed (Charleston). */
  private sharedEarly = new Set<string>();
  readonly seats: SeatSpec[];
  /** Each seat's look for the 2D seat plates (set by the app; cosmetic only). */
  avatars: (AvatarSpec | null)[] = [];
  /** Your seat (or the seat a spectator watches). */
  readonly me: number;
  readonly spectator: boolean;
  readonly matchSeed: number;
  /** Actions of each finished hand, then the current one. */
  private record: Action[][] = [];
  private handLog: Action[] = [];
  private handNo = 0;
  private aborted = false;
  private root: HTMLElement;
  private els!: {
    autoDraw: HTMLElement;
    round: HTMLElement;
    hand: HTMLElement;
    wall: HTMLElement;
    seats: HTMLElement[];
    actions: HTMLElement;
    bot: HTMLElement;
    tray: HTMLElement;
    toast: HTMLElement;
    overlay: HTMLElement;
    /** Sheets opened from the table (leave question, shortcuts, cards): their own layer, so they never wipe a hand result. */
    sheet: HTMLElement;
    timer: HTMLElement;
    status: HTMLElement;
    sort: HTMLElement;
    group: HTMLElement;
    pp: HTMLElement;
    extra: HTMLElement;
    last: HTMLElement;
    waits: HTMLElement;
    win: HTMLElement;
  };
  /** The containers the controls move between as the screen changes shape (arrange()). */
  private ctl!: {
    badge: HTMLElement;
    tools: HTMLElement;
    more: HTMLElement;
    hudTop: HTMLElement;
    statusRow: HTMLElement;
    actionRow: HTMLElement;
    bottom: HTMLElement;
    ppBtn: HTMLElement;
    quick: HTMLElement;
    dockBar: HTMLElement;
    dock: { hand: HTMLElement; bot: HTMLElement; tutor: HTMLElement };
    con: HTMLElement;
    conHead: HTMLElement;
    conBody: HTMLElement;
    conHand: HTMLElement;
    conDock: HTMLElement;
  };
  private hudMode: HudMode = 'classic';
  /** Upright screens: JongBot's card is open (from the dock bar). */
  private botShown = false;
  private resolveHuman?: (fn: () => void) => void;
  /** The open warning before a call that leaves your hand unable to win (callWarning), if any. */
  private callWarn?: HTMLElement;
  private hintsOn: boolean;
  private showWhy = false;
  /** JongBot opened past its one-line advice (tabs, reasons, Hide hints); closes again on your next turn. */
  private botOpen = false;
  /** Score lines of the latest win, marked on the Dubai cheat sheet. */
  private lastScored: string[] = [];
  /** The rule book (HUD book icon), the expandable scoring guide: how to win and score here, and how close your hand is. */
  private guide = new ScoringGuide(() => {
    // A tile still waiting in the wall is not in your hand yet.
    const pl = this.spectator ? null : this.asSeen(() => this.game.players[this.me]);
    return { profile: this.game.profile, shapes: pl ? this.game.shapesFor(this.me) : undefined, hand: pl ? pl.hand.map((t) => t.kind) : null, melds: pl?.melds.length ?? 0, scored: this.lastScored, labels: this.settings.labels };
  });
  /** The score calculator (HUD calculator icon): what your hand is worth now, or any hand you build. */
  private calc = new ScoreCalc(() => ({ game: this.game, seat: this.me, spectator: this.spectator, labels: this.settings.labels, seen: (fn) => this.asSeen(fn) }));
  private stats = { handsWon: 0, handsPlayed: 0, selfDraws: 0, best: null as MatchSummary['bestHand'], limit: false, dealIns: 0, calls: 0, riichis: 0, riichiWins: 0, decisions: 0, goodDecisions: 0, winValue: 0 };
  private timerHandle?: number;
  /** Your own tile order for this hand (after dragging), or null to sort normally. */
  private customOrder: number[] | null = null;
  /** The tray tile being dragged, if any. */
  private drag: { id: number; x: number; y: number; active: boolean; el: HTMLElement; target: { id: number; after: boolean } | null } | null = null;
  private suppressClick = false;
  /** Last line spoken by "Speak all content", to avoid repeats. */
  private spoken = { text: '', at: 0, timer: 0 };
  /** When the match began (timed matches end once their clock has run out). */
  private startedAt = Date.now();
  /** Guided game: your last action was a claim, so Mei explains the new set. */
  private coachAfterClaim = false;
  /** The throws for East, shown at the first hand (then cleared). */
  private eastRounds?: EastRound[];
  /** Where the match starts when the throw made someone other than seat 0 East (kept with the replay). */
  private firstDealer?: { hand: number; round: RoundState; scores: number[]; pot: number };

  constructor(
    private table: TableRenderer,
    hudRoot: HTMLElement,
    readonly config: TableConfig,
    private settings: Settings,
    playerName: string,
    private hooks: MatchHooks,
    readonly opts: MatchOptions = {},
  ) {
    const rp = withHouseRules(getProfile(config.variation) ?? classicProfile, config.houseRules);
    rp.rounds = roundProfileFor(config.length, rp.rounds);
    this.matchSeed = opts.seed ?? randomSeed();
    const seed = this.matchSeed;
    // Default table: you at seat 0 and an AI player in every other seat (three, or two at a three-player table).
    const seats: SeatSpec[] = (
      opts.seats ?? [
        { kind: 'local', name: playerName },
        ...((ps) => ps.map((p, i): SeatSpec => ({ kind: 'ai', name: seatNames(ps, [playerName])[i], personality: p })))(config.personalities.slice(0, rp.players - 1)),
      ]
    ).slice(0, rp.players);
    // Avoid duplicate names when seats share a personality.
    for (let i = 1; i < seats.length; i++) {
      const sp = seats[i];
      if (sp.kind === 'ai' && seats.findIndex((x) => x.name === sp.name) !== i) sp.name = seatNames([sp.personality ?? 'zen'], seats.map((x) => x.name))[0];
    }
    this.seats = seats;
    const local = seats.findIndex((x) => x.kind === 'local');
    this.spectator = local < 0;
    this.me = local < 0 ? (opts.viewSeat ?? 0) : local;
    table.humanSeat = this.me;
    table.watchOnly = this.spectator;
    table.splitPaused = false;
    table.seatCount = rp.players;
    this.game = new MahjongGame(rp, seats.map((x) => x.name), seed);
    // Everyone throws for East (engine/opening.ts), fixed by the match seed so every client and replay agrees.
    if (!opts.resume && !opts.coach && opts.mode !== 'daily') {
      const er = eastRoll(seed, rp.players, openingRules(rp.id, rp.deadWall).dice);
      this.eastRounds = er.rounds;
      const st = this.game.state;
      if (er.east !== st.round.dealerSeat) {
        st.round.dealerSeat = er.east;
        st.seatWinds = st.players.map((_, s) => seatWind(rp.rounds, st.round, s, rp.players));
        this.firstDealer = { hand: 0, round: structuredClone(st.round), scores: st.players.map((p) => p.score), pot: 0 };
      }
    }
    // Every seat has an AI, so a player who leaves can be replaced mid-game
    // by the same deterministic decisions on every client.
    this.ais = seats.map((x, i) => new AiPlayer(i, x.difficulty ?? config.difficulty, x.personality ?? 'zen', seed + i * 101));
    this.hintsOn = config.hints && !this.spectator;
    table.setFelt(rp.felt);
    table.setDiceCount(diceForVariation(rp.id));
    this.root = hudRoot;
    // Passing tea, once per hand per seat (src/ui/tea.ts); purely social.
    this.tea = new TeaService(
      {
        seats: rp.players,
        me: this.me,
        spectator: this.spectator,
        live: !!opts.link,
        matchSeed: seed,
        name: (s) => this.game.players[s].name,
        personality: (s) => (this.seats[s].kind === 'ai' ? (this.seats[s].personality ?? 'zen') : null),
        plate: (s) => this.els.seats[this.rel(s)],
        pass: (from, to) => this.table.passTea(from, to),
        send: (code) => this.opts.link?.react(code),
        quiet: () => !this.announcing(),
        gone: () => this.aborted,
      },
      () => this.root.querySelectorAll<HTMLElement>('.reactions').forEach((b) => (b.hidden = true)),
    );
    this.buildHud();
    guardSelection();
    window.addEventListener('resize', this.onResize);
    this.game.on((e) => this.onEvent(e));
    opts.link?.onReaction((seat, emoji) => this.react(seat, emoji));
  }

  /** Your seat for wording ("You discarded"); -1 when spectating. */
  private get you() {
    return this.spectator ? -1 : this.me;
  }

  /** Seats at this table (3 for Korean, else 4). */
  private get n() {
    return this.game.profile.players;
  }

  /** Seat position on screen (0 bottom, 1 right, 2 top, 3 left): you are always at the bottom. A three-seat table leaves the top empty. */
  private rel(seat: number) {
    return quadrantOf(seat, this.me, this.n);
  }

  private isAi(seat: number) {
    return this.seats[seat].kind === 'ai';
  }

  sendReaction(emoji: string) {
    this.react(this.me, emoji);
    this.opts.link?.react(emoji);
  }

  // ------------------------------------------------------------ HUD

  private buildHud() {
    const r = clear(this.root);
    r.className = this.n === 3 ? 'hud three-seats' : 'hud';
    // One plate per screen position; at a three-seat table the top one stays empty and hidden.
    const seats = [0, 1, 2, 3].map((s) => h('div', { class: `seat seat-${s}`, hidden: seatAtQuadrant(s as Quadrant, this.me, this.n) === null }));
    const els = {
      round: h('div', { class: 'round-name' }),
      hand: h('div', { class: 'round-hand' }),
      wall: h('div', { class: 'round-wall' }),
      seats,
      actions: h('div', { class: 'actions', role: 'toolbar', 'aria-label': tr('Your actions') }),
      bot: h('aside', { class: 'jongbot', 'aria-live': 'polite', hidden: true }),
      tray: h('div', { class: 'tray' }),
      toast: h('div', { class: 'toast', 'aria-live': 'assertive' }),
      overlay: h('div', { class: 'overlay', hidden: true }),
      sheet: h('div', { class: 'overlay table-sheet', hidden: true }),
      timer: timerRing(),
      // Tap your hand's status line for what the hand is worth now (the calculator opens on it).
      status: h('div', { class: 'hand-status', role: 'button', tabindex: '0', title: tr('Tap for what your hand is worth now'), onclick: () => this.calc.toggle(true), onkeydown: (e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), this.calc.toggle(true)) }),
      sort: h('button', { class: 'sort-btn' }),
      group: h('button', { class: 'sort-btn group-btn' }),
      pp: h('div', { class: 'pp-pick', role: 'group', 'aria-label': tr('Passport'), hidden: true }),
      autoDraw: h('button', { class: 'sort-btn autodraw-btn', 'aria-pressed': 'false' }),
      extra: h('div', { class: 'round-extra' }),
      last: h('div', { class: 'last-discard', hidden: true, 'aria-live': 'polite' }),
      waits: h('div', { class: 'waits', hidden: true }),
      win: h('div', { class: 'win-banner', hidden: true, 'aria-live': 'polite' }),
    };
    this.els = els;
    this.pushLayout();
    els.sort.onclick = () => {
      // With your own order in place, Sort tidies the hand again; otherwise it switches suit/number.
      if (this.customOrder) this.customOrder = null;
      else this.settings.sort = this.settings.sort === 'suit' ? 'number' : 'suit';
      sound.play('click');
      this.pushLayout();
      this.hooks.saveSettings?.();
      this.resync();
    };
    els.autoDraw.onclick = () => this.setAutoDraw(!this.settings.autoDraw);
    // The passport strip scrolls with a mouse wheel too, not only a swipe.
    els.pp.addEventListener(
      'wheel',
      (e) => {
        if (this.hudMode === 'console' || Math.abs(e.deltaX) > Math.abs(e.deltaY) || els.pp.scrollWidth <= els.pp.clientWidth) return;
        els.pp.scrollLeft += e.deltaY;
        e.preventDefault();
      },
      { passive: false },
    );
    els.group.onclick = () => {
      this.settings.groupSets = !this.settings.groupSets;
      sound.play('click');
      this.pushLayout();
      this.hooks.saveSettings?.();
      this.resync();
    };
    this.table.onReorder = (ids) => {
      this.customOrder = ids;
      this.pushLayout();
      this.resync();
    };
    const views = viewControls(this.table);
    views.classList.add('hud-views');
    // The rule book and the calculator share the middle of the table: one at a time.
    this.guide.onOpen = () => this.calc.toggle(false);
    this.calc.onOpen = () => this.guide.toggle(false);
    // Escape closes the card and the leave question (never a hand result, which moves the game on).
    els.sheet.addEventListener('keydown', (e) => e.key === 'Escape' && (els.sheet.hidden = true));
    const reactBar = h('div', { class: 'reactions', hidden: true });
    // Reactions plus preset table phrases (src/ui/etiquette.ts); never free text.
    fillEtiquetteBar(reactBar, (code) => (this.sendReaction(code), (reactBar.hidden = true)));
    reactBar.prepend(this.tea.row);
    // The variation always heads the title, so you know which rules this table plays.
    const badge = h('div', { class: 'round-badge' }, h('span', { class: 'round-emblem', html: icon('turn') }), h('div', { class: 'round-text' }, h('div', { class: 'round-var' }, tr(VARIATIONS.find((v) => v.id === this.config.variation)?.short ?? this.game.profile.name)), els.round, h('div', { class: 'round-meta' }, els.hand, h('span', { class: 'dot' }, '·'), els.wall), els.extra));
    const more = h('button', { class: 'icon-btn more-btn', 'aria-label': tr('More options'), 'aria-expanded': 'false', title: tr('More options: rule book, possibilities, score calculator, reactions and settings'), onclick: () => this.toggleMore(reactBar), html: icon('more') });
    const tools = h(
      'div',
      { class: 'hud-tools' },
      this.game.profile.card ? h('button', { class: 'icon-btn card-btn', 'aria-label': tr('View the card'), title: tr('The card'), onclick: () => this.showCard() }, tr('Card')) : null,
      this.guide.button,
      this.calc.button,
      h('button', { class: 'icon-btn keys-btn', 'aria-label': tr('Keyboard shortcuts'), title: tr('Keyboard shortcuts (?)'), onclick: () => this.showShortcuts(), html: icon('keys') }),
      usesDubaiCard(this.game.profile) ? h('button', { class: 'icon-btn card-btn', 'aria-label': tr('Open the cheat sheet'), title: tr('Cheat sheet: every scoring line on the Dubai card'), onclick: () => showCheatSheet(this.els.sheet, { scored: this.lastScored, dice: this.game.state.dice }) }, tr('Card')) : null,
      h('button', { class: 'icon-btn react-toggle', 'aria-label': tr('Reactions'), title: tr('Send a reaction to the table'), onclick: () => (reactBar.hidden = !reactBar.hidden), html: icon('react') }),
      this.hooks.musicButton?.() ?? null,
      this.hooks.openLabs ? labsButton(() => this.hooks.openLabs!(), 'icon-btn labs-btn settings-btn') : null,
      h('button', { class: 'icon-btn settings-btn', 'aria-label': tr('Settings'), title: tr('Settings: sound, tile calls, spoken help and hand sorting'), onclick: () => this.hooks.openSettings(), html: icon('settings') }),
      // Everything that isn't on the bar folds into the More options grid.
      more,
      h('button', { class: 'icon-btn', 'aria-label': tr('Leave table'), title: tr('Leave the table'), onclick: () => this.confirmLeave(), html: icon('close') }),
    );
    const hudTop = h('div', { class: 'hud-top' }, badge, tools);
    const statusRow = h('div', { class: 'status-row' }, els.status, els.waits, els.sort, els.group, els.autoDraw, els.pp);
    const actionRow = h('div', { class: 'action-row' }, els.timer, els.actions);
    const bottom = h('div', { class: 'bottom' }, els.bot, statusRow, actionRow, els.tray);
    // Upright screens: the passport you are aiming for, as a pill that opens every possibility.
    const ppBtn = h('button', { type: 'button', class: 'sort-btn pp-btn', onclick: () => this.showPossibilities() });
    const quick = h('div', { class: 'quick-row' });
    const dHand = dockButton('db-hand', 'person', tr('Your hand'), () => this.calc.toggle(true));
    const dBot = dockButton('db-bot', 'robot', tr('JongBot'), () => this.toggleBotCard());
    const dTutor = this.opts.coach
      ? dockButton('db-tutor', 'lesson', tr('Tutor'), () => this.toggleTutor())
      : dockButton('db-tutor', 'book', tr('Rules'), () => this.guide.toggle());
    const dMore = dockButton('db-more', 'more', tr('More'), () => this.toggleMore(reactBar));
    const dockBar = h('nav', { class: 'dock-bar', 'aria-label': tr('Table controls') }, dHand.el, dBot.el, dTutor.el, dMore.el);
    // Wide screens: the side console (see matchControls.ts).
    const conHead = h('div', { class: 'con-head' });
    const conHand = h('section', { class: 'con-sec con-hand' }, h('h3', { class: 'con-cap' }, tr('Your hand')));
    const conBody = h('div', { class: 'con-body' }, conHand);
    const conDock = h('div', { class: 'con-dock' });
    const con = h('aside', { class: 'match-console', 'aria-label': tr('Table console') }, conHead, conBody, conDock);
    this.ctl = { badge, tools, more, hudTop, statusRow, actionRow, bottom, ppBtn, quick, dockBar, dock: { hand: dHand.sub, bot: dBot.sub, tutor: dTutor.sub }, con, conHead, conBody, conHand, conDock };
    r.append(
      hudTop,
      reactBar,
      // Zoom and tilt: on the left edge on wide screens, top right on phones, clear of the hand and plates.
      views,
      ...seats,
      els.last,
      this.guide.panel,
      this.calc.panel,
      // JongBot lives in the bottom stack so on phones it sits above your tiles, never over the table.
      bottom,
      els.toast,
      els.win,
      els.overlay,
      els.sheet,
      ...(this.opts.coach ? [this.opts.coach.el] : []),
      con,
    );
    // Mei's guide moves by its grip like JongBot's card.
    const coachEl = this.opts.coach?.el;
    coachEl?.querySelector('.coach-head')?.prepend(cardGrip(coachEl, () => `coach.${this.hudMode}`, () => this.placeDock()));
    coachEl?.addEventListener('coach-tuck', () => this.refreshDock());
    this.arrange(true);
    // Hover (or tap) a player's plate to see their discards in order.
    seats.forEach((el, rel) => {
      const seat = seatAtQuadrant(rel as Quadrant, this.me, this.n);
      if (seat === null) return;
      el.addEventListener('mouseenter', () => this.showRiver(seat, el));
      el.addEventListener('mouseleave', () => el.querySelector('.seat-river')?.remove());
      // A tap (or click) adds what the hand is worth now; a second tap closes it.
      el.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.bubble, .float-emoji')) return;
        if (el.querySelector('.seat-river.with-score')) el.querySelector('.seat-river')!.remove();
        else this.showRiver(seat, el, true);
      });
    });
    // Hovering a tile on the table names it; add how many are still unseen and whose discard it is.
    this.table.tipNote = (id, kind) => this.tileNote(id, kind);
    if (this.opts.coach && typeof ResizeObserver !== 'undefined') new ResizeObserver(() => !this.els.last.hidden && this.placeLastDiscard()).observe(this.opts.coach.el);
    // Mei's caption and JongBot share one dock at the bottom right, clear of the table; it follows the hand and the plates.
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => this.placeDock());
      for (const el of [r, this.els.bot, this.opts.coach?.el, r.querySelector('.bottom'), r.querySelector('.status-row'), r.querySelector('.action-row'), r.querySelector('.seat-1'), r.querySelector('.seat-3'), this.els.last]) if (el) ro.observe(el);
      new MutationObserver(() => this.placeDock()).observe(r, { attributes: true, attributeFilter: ['style', 'data-hand-clear'] });
    }
    requestAnimationFrame(() => this.placeDock());
    this.gatherTalk(r);
    window.addEventListener('keydown', this.onKey);
  }

  /**
   * Put the controls where this screen shape wants them (matchControls.ts): the side console on wide
   * screens, the header plate, hand tools and dock bar on upright ones, the floating layout otherwise.
   */
  private arrange(first = false) {
    const c = this.ctl;
    const e = this.els;
    const r = this.root;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const mode = hudMode(W, H);
    const cw = mode === 'console' ? consoleWidth(W, H) : 0;
    const changed = first || mode !== this.hudMode;
    this.hudMode = mode;
    if (changed) {
      r.classList.remove('mode-phone', 'mode-console', 'mode-classic');
      r.classList.add(`mode-${mode}`);
      if (mode === 'console') {
        c.conHead.append(c.tools);
        c.conBody.prepend(c.badge, e.last);
        c.conHand.append(e.status, e.waits, h('div', { class: 'con-tools' }, e.sort, e.group, e.autoDraw));
        c.conBody.append(e.pp);
        c.quick.remove();
        c.dockBar.remove();
      } else {
        c.hudTop.append(c.badge, c.tools);
        r.insertBefore(e.last, this.guide.panel);
        c.statusRow.append(e.status, e.waits, e.sort, e.group, e.autoDraw, e.pp);
        c.conHand.querySelector('.con-tools')?.remove();
        if (mode === 'phone') {
          c.quick.append(e.sort, c.ppBtn, e.group, e.autoDraw);
          c.bottom.append(c.quick, c.dockBar);
        } else {
          c.quick.remove();
          c.dockBar.remove();
        }
      }
      restoreCard(e.bot, `bot.${mode}`);
      if (this.opts.coach) restoreCard(this.opts.coach.el, `coach.${mode}`);
      if (!first) this.renderHint(this.lastHint);
    }
    // The table narrows to make room for the console.
    const body = document.body;
    body.classList.toggle('with-console', mode === 'console');
    if (body.style.getPropertyValue('--console-w') !== `${cw}px`) {
      body.style.setProperty('--console-w', `${cw}px`);
      this.table.resize();
    }
    this.refreshDock();
  }

  /** Give the whole screen back to the table (the match is over or left). */
  private releaseStage() {
    const body = document.body;
    if (!body.classList.contains('with-console')) return;
    body.classList.remove('with-console');
    body.style.removeProperty('--console-w');
    this.table.resize();
  }

  /** The second lines of the dock bar: your hand's state, JongBot's advice, Mei's guide. */
  private refreshDock() {
    const c = this.ctl;
    if (!c) return;
    const st = this.els.status.textContent ?? '';
    c.dock.hand.textContent = st.replace(/^[^:：]*[:：]\s*/, '') || tr('Tap for its score');
    const hint = this.lastHint;
    c.dock.bot.textContent = !this.hintsOn ? tr('Tap for hints') : hint ? hint.headline : tr('Suggests next move');
    c.dockBar.querySelector('.db-bot')?.classList.toggle('on', this.botShown && !!hint);
    const coach = this.opts.coach?.el;
    if (coach) {
      const away = coach.hidden || coach.classList.contains('tucked');
      c.dock.tutor.textContent = away ? tr('Show Mei’s guide') : tr('Mei’s guide is open');
      c.dockBar.querySelector('.db-tutor')?.classList.toggle('on', !away);
    } else c.dock.tutor.textContent = tr('How to win and score');
  }

  /** Upright screens: JongBot's card opens from the dock bar (and closes again). */
  private toggleBotCard(force?: boolean) {
    const show = force ?? !this.botShown;
    if (show && !this.hintsOn) (this.hintsOn = true), this.resync();
    this.botShown = show;
    if (show) this.botOpen = true;
    sound.play('click');
    this.renderHint(this.lastHint);
    this.refreshDock();
  }

  /** The Tutor button: Mei's guide out of her portrait, or back into it. */
  private toggleTutor() {
    const coach = this.opts.coach?.el;
    if (!coach) return;
    if (coach.classList.contains('tucked')) coach.querySelector<HTMLElement>('button.narrator')?.click();
    else coach.querySelector<HTMLElement>('.coach-hide')?.click();
    this.refreshDock();
  }

  /** The More options grid: everything that isn't on the bar, as round icon buttons (all screen sizes). */
  private toggleMore(reactBar: HTMLElement) {
    const btn = this.ctl.more;
    const open = this.root.querySelector('.more-wrap');
    if (open) {
      open.remove();
      btn.setAttribute('aria-expanded', 'false');
      return;
    }
    const close = () => {
      wrap.remove();
      btn.setAttribute('aria-expanded', 'false');
    };
    const touch = matchMedia('(pointer: coarse)').matches;
    const kit = this.kit();
    const music = this.hooks.musicButton?.() as HTMLButtonElement | undefined;
    const by = this.settings.sort === 'suit' ? tr('by suit') : tr('by number');
    const items: (GridItem | null)[] = [
      { label: tr('Rule book'), icon: 'book', act: () => this.guide.toggle(true) },
      kit && !this.spectator ? { label: tr('Possibilities'), icon: 'target', act: () => this.showPossibilities() } : null,
      { label: tr('Score calc'), icon: CALC_ICON, act: () => this.calc.toggle(true) },
      this.game.profile.card ? { label: tr('The card'), icon: 'card', act: () => this.showCard() } : null,
      usesDubaiCard(this.game.profile) ? { label: tr('Cheat sheet'), icon: 'card', act: () => showCheatSheet(this.els.sheet, { scored: this.lastScored, dice: this.game.state.dice }) } : null,
      touch ? null : { label: tr('Shortcuts'), icon: 'keys', act: () => this.showShortcuts() },
      { label: tr('Emoji'), icon: 'react', act: () => (reactBar.hidden = false) },
      { label: this.muted ? tr('Unmute') : tr('Mute'), icon: this.muted ? 'speakerOff' : 'speaker', on: this.muted, act: () => this.setMuted(!this.muted) },
      music ? { label: tr('Music'), icon: music.classList.contains('off') ? 'musicOff' : 'music', on: !music.classList.contains('off'), act: () => music.click() } : null,
      this.hudMode === 'console' ? null : { label: this.customOrder ? tr('Sort: your order ↺') : tr('Sort: {by}', { by }), icon: 'sort', act: () => this.els.sort.click() },
      kit ? null : { label: this.settings.groupSets ? tr('Sets grouped ✓') : tr('Group sets'), icon: 'group', on: !!this.settings.groupSets, act: () => this.els.group.click() },
      this.hooks.openLabs && dev.enabled ? { label: tr('Labs'), icon: 'labs', act: () => this.hooks.openLabs!() } : null,
      { label: tr('Settings'), icon: 'settings', act: () => this.hooks.openSettings() },
      { label: tr('Close game'), icon: 'close', act: () => this.confirmLeave() },
    ];
    const view = h('div', { class: 'more-view' }, h('span', { class: 'more-cap' }, tr('View')), viewControls(this.table));
    const sheet = moreSheet(items.filter((x): x is GridItem => !!x), view, close);
    const wrap = h('div', { class: 'more-wrap', onclick: (e: Event) => e.target === wrap && close() }, sheet);
    wrap.addEventListener('keydown', (e) => e.key === 'Escape' && close());
    this.root.append(wrap);
    btn.setAttribute('aria-expanded', 'true');
    // Keyboard users start on the first button; a tap doesn't leave a focus ring on it.
    if (!matchMedia('(pointer: coarse)').matches) sheet.querySelector<HTMLElement>('.more-close')?.focus({ preventScroll: true });
  }

  /** Every table sound off at once (tile sounds, callers, music and the room); Mei and spoken help stay as set. */
  private muted = false;
  private setMuted(on: boolean) {
    this.muted = on;
    if (on) sound.setVolumes({ effects: 0, music: 0, ambient: 0 });
    else {
      const s = this.settings as Settings & Partial<MusicSettings>;
      if (s.volumes) applyVolumes(s as MusicSettings);
      else sound.setVolumes({ effects: 1, music: 1, ambient: 1 });
    }
  }

  /** Every target hand you can still make (the passports in the East round), in a list that scrolls; tap one to aim for it. */
  private showPossibilities() {
    const kit = this.kit();
    if (!kit) return;
    const o = this.els.sheet;
    const list = h('div', { class: 'poss-list' });
    const paint = () => {
      clear(list);
      const plans = this.game.state.phase.kind === 'handOver' ? [] : this.targetPlansNow();
      const chosen = this.targetPlan();
      if (!plans.length) list.append(h('p', { class: 'muted' }, tr('Nothing to aim for yet: the possibilities show once your tiles are dealt.')));
      for (const p of plans) {
        const on = chosen?.key === p.key;
        const tiles = h('div', { class: 'poss-tiles' });
        p.pieces.forEach((piece, i) => {
          const g = h('span', { class: 'poss-piece' });
          piece.forEach((k, j) => {
            const img = tileImg(k, 'mini', this.settings.labels);
            if (j >= piece.length - p.gaps[i]) img.classList.add('need');
            g.append(img);
          });
          tiles.append(g);
        });
        list.append(
          h(
            'button',
            {
              type: 'button',
              class: `poss-row${on ? ' on' : ''}`,
              'aria-pressed': String(on),
              onclick: () => {
                this.ppChoice = p.key;
                if (!this.settings.groupSets) (this.settings.groupSets = true), this.hooks.saveSettings?.();
                sound.play('click');
                this.pushLayout();
                this.resync();
                paint();
              },
            },
            h('span', { class: 'poss-top' }, h('b', { class: 'poss-name' }, passportNames(p.names)), h('span', { class: 'poss-away' }, passportAway(p.missing - 1))),
            p.note ? h('span', { class: 'poss-note' }, tr(p.note)) : null,
            p.pieces.length ? tiles : null,
          ),
        );
      }
    };
    paint();
    const on = !!this.settings.groupSets;
    clear(o).hidden = false;
    o.append(
      h(
        'div',
        { class: 'card poss-sheet', role: 'dialog', 'aria-label': tr(kit.chip) },
        h('p', { class: 'eyebrow' }, tr(kit.chip)),
        h('h2', {}, tr('Possibilities')),
        h('p', { class: 'muted small' }, tr('Every hand you can still make. Tap to choose one.')),
        h('button', { type: 'button', class: `sort-btn group-btn${on ? ' on' : ''}`, 'aria-pressed': String(on), onclick: () => (this.els.group.click(), this.showPossibilities()), html: icon('group') + `<span>${on ? tr(kit.groupOn) : tr(kit.groupOff)}</span>` }),
        list,
        h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', onclick: () => (o.hidden = true) }, tr('Back to the table'))),
      ),
    );
  }

  /** A player's discards, oldest first (claimed tiles are gone from the river); with `score`, what the hand is worth now above them. */
  private showRiver(seat: number, el: HTMLElement, score = false) {
    el.querySelector('.seat-river')?.remove();
    const p = this.game.players[seat];
    if (!p) return;
    const box = h('div', { class: `seat-river${score ? ' with-score' : ''}`, role: 'tooltip' });
    if (score) box.append(this.seatScore(seat));
    box.append(h('div', { class: 'sr-head' }, seat === this.you ? tr('Your discards') : tr('{name}’s discards', { name: p.name })));
    if (!p.discards.length) box.append(h('div', { class: 'sr-empty' }, tr('Nothing discarded yet')));
    else box.append(h('div', { class: 'sr-tiles' }, ...p.discards.map((t) => tileImg(t.kind, 'mini', this.settings.labels, isRed(this.game.state, t.id)))));
    el.append(box);
  }

  /** What a seat's hand is worth now: your own in full, another player's only as far as it is on show. */
  private seatScore(seat: number): HTMLElement {
    const g = this.game;
    if ((seat === this.me && !this.spectator) || g.state.phase.kind === 'handOver') {
      const now = this.asSeen(() => handNow(g, seat));
      if (seat === this.me || now.state === 'won') return handNowView(now, this.settings.labels, true);
    }
    return onShowView(onShow(g, seat));
  }

  /** The note under a hovered tile's name: whose discard it is, and how many copies you have not seen. */
  private tileNote(id: number, kind: number): string | undefined {
    const g = this.game;
    if (this.spectator || kind >= KIND_COUNT) return undefined;
    const unseen = unseenCounts(g, this.me)[kind] ?? 0;
    const owner = g.players.findIndex((p) => p.discards.some((t) => t.id === id));
    const left = unseen === 0 ? tr('none left unseen') : tr('{n} still unseen', { n: unseen });
    if (owner < 0) return left;
    return `${owner === this.me ? tr('Your discard') : tr('{name}’s discard', { name: g.players[owner].name })} · ${left}`;
  }

  /** Keyboard play: digits pick an action, P passes, arrows and Enter pick and discard a tile, ? lists the keys. */
  private onKey = (e: KeyboardEvent) => {
    if (this.aborted) return window.removeEventListener('keydown', this.onKey);
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tgt = e.target as HTMLElement | null;
    if (tgt && (tgt.closest('input, select, textarea, [contenteditable]') || (tgt.closest('button') && (e.key === 'Enter' || e.key === ' ')))) return;
    const modal = document.getElementById('modal');
    if (modal && !modal.hidden) return;
    if (this.callWarn) return;
    const o = this.els.sheet;
    if (e.key === '?') {
      e.preventDefault();
      if (!o.hidden && o.querySelector('.keys-sheet')) o.hidden = true;
      else if (o.hidden) this.showShortcuts();
      return;
    }
    if (!o.hidden || !this.els.overlay.hidden) return;
    const k = e.key.toLowerCase();
    // D (or Space) takes your tile from the wall.
    if (this.releaseDraw && (k === 'd' || k === ' ' || k === 'enter')) {
      e.preventDefault();
      this.releaseDraw();
      return;
    }
    const btns = [...this.els.actions.querySelectorAll<HTMLButtonElement>('button')].filter((b) => !b.disabled);
    const pass = btns.find((b) => b.classList.contains('pass'));
    if (k === 'p' || (k === ' ' && pass)) {
      if (pass) {
        e.preventDefault();
        pass.click();
      }
      return;
    }
    if (/^[1-9]$/.test(k)) {
      const b = btns.filter((x) => !x.classList.contains('pass'))[Number(k) - 1];
      if (b) {
        e.preventDefault();
        b.click();
      }
      return;
    }
    const t = this.table;
    if (!t.onTileClick || !t.interactive.size) return;
    if (k === 'arrowleft' || k === 'arrowright') {
      e.preventDefault();
      const order = arrangeHand(this.game.players[this.me].hand, this.handLayout())
        .map((x) => x.tile.id)
        .filter((id) => t.interactive.has(id));
      if (!order.length) return;
      const cur = t.selectedId !== null ? order.indexOf(t.selectedId) : -1;
      const next = cur < 0 ? (k === 'arrowleft' ? order.length - 1 : 0) : (cur + (k === 'arrowleft' ? -1 : 1) + order.length) % order.length;
      // A Charleston pick toggles tiles, so arrows only move the selection during your turn.
      if (t.selectedIds.size || this.game.state.phase.kind !== 'turn') return;
      t.onTileClick(order[next]);
      return;
    }
    if ((k === 'enter' || k === ' ') && t.selectedId !== null && this.game.state.phase.kind === 'turn') {
      e.preventDefault();
      t.onTileClick(t.selectedId);
    }
  };

  private showShortcuts() {
    const o = this.els.sheet;
    clear(o).hidden = false;
    const row = (keys: string[], what: string) => h('tr', {}, h('td', {}, ...keys.map((x) => h('kbd', {}, x))), h('td', {}, what));
    o.append(
      h(
        'div',
        { class: 'card keys-sheet' },
        h('h3', {}, tr('Keyboard shortcuts')),
        h(
          'table',
          { class: 'keys-table' },
          h(
            'tbody',
            {},
            row(['←', '→'], tr('Pick a tile in your hand')),
            row([tr('Enter')], tr('Discard the picked tile')),
            row(['1', '–', '9'], tr('The buttons in the action bar, left to right (claims, a win, a kong)')),
            row(['D'], tr('Draw your tile from the wall (Space works too)')),
            row(['P'], tr('Pass on a discard (Space works too)')),
            row(['?'], tr('Show or hide this list')),
            row([tr('Esc')], tr('Close this list')),
          ),
        ),
        h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', onclick: () => (o.hidden = true) }, tr('Back to the table'))),
      ),
    );
    o.querySelector<HTMLElement>('.btn.primary')?.focus({ preventScroll: true });
  }

  /** How your hand is laid out now: sort mode, your own order, grouped sets. */
  private cardSetsFor: { key: string; sets: NonNullable<HandLayout['only']> } | null = null;
  private handLayout(): HandLayout {
    const p = this.game.profile;
    const layout: HandLayout = { mode: this.settings.sort, custom: this.customOrder, groupSets: !!this.settings.groupSets, chows: p.calls.chow && !p.card };
    // India Rules Small Cards: only the sets your card uses are pulled out (none until you hold a card).
    if (p.dealCards && !this.spectator) {
      const c = this.game.state.cards?.[this.me];
      const st = this.game.state;
      const key = `${c}|${st.seatWinds[this.me]}|${st.prevailingWind}`;
      if (this.cardSetsFor?.key !== key) this.cardSetsFor = { key, sets: c === undefined ? { pungs: new Set(), chows: new Set() } : cardSets(SMALL_CARDS[c], st.seatWinds[this.me], st.prevailingWind) };
      layout.only = this.cardSetsFor.sets;
    }
    // India Rules East round and Classic: crochets and mixed chows group too.
    if ((p.mixedSets || p.passportView) && !this.spectator) layout.indiaSets = true;
    // A round with a target hand (a passport, a card hand, a yaku...): the one you chose (JongBot's
    // nearest until you pick one) is set aside first, piece by piece.
    const plan = this.spectator || !this.settings.groupSets ? null : this.setAsidePlan();
    if (plan?.pieces.length) layout.groups = plan.pieces.flatMap((piece, i) => (plan.fromMeld[i] ? [] : [piece.slice(0, piece.length - plan.gaps[i])]));
    return layout;
  }

  /** The target kit of the round (targets.ts), and the targets open to your tiles (cached per hand). */
  private kit(): TargetKit | null {
    return this.spectator ? null : targetKit(this.game);
  }
  private ppPlans: { key: string; plans: TargetPlan[] } | null = null;
  private ppChoice: string | null = null;
  private targetPlansNow(): TargetPlan[] {
    // A tile still waiting in the wall is not in your hand yet.
    return this.asSeen(() => this.targetPlansSeen());
  }
  private targetPlansSeen(): TargetPlan[] {
    const g = this.game;
    const kit = this.kit();
    if (!kit || !g.players[this.me].hand.length) return [];
    const st = g.state;
    const key = [kit.id, g.players[this.me].hand.map((t) => t.kind).sort((a, b) => a - b).join(','), g.meldShapes(this.me).map((m) => m.type[0] + m.kind).join(','), st.cards?.[this.me], st.seatWinds[this.me], g.prevailing, g.players[this.me].flowers.length].join('|');
    if (this.ppPlans?.key !== key) this.ppPlans = { key, plans: kit.plans(g, this.me, undefined, 4) };
    return this.ppPlans.plans;
  }
  private targetPlan(): TargetPlan | null {
    const plans = this.targetPlansNow();
    return plans.find((p) => p.key === this.ppChoice) ?? plans[0] ?? null;
  }
  /** The target set aside on your rack. With the passport optional, a passport is set aside only when
   *  you pick one or it is complete, so a half-made one doesn't split your crochets and other sets. */
  private setAsidePlan(): TargetPlan | null {
    const plan = this.targetPlan();
    if (!plan || !this.game.profile.passportOptional || plan.key === this.ppChoice) return plan;
    return plan.gaps.every((g) => g === 0) ? plan : null;
  }

  /** A gold edge on your tiles in the target set aside, and a red edge on tiles that could feed a target
   *  another player is showing, or that JongBot rates high risk against a ready-looking hand (while
   *  JongBot is on). */
  private targetMarks() {
    const g = this.game;
    const t = this.table;
    t.ppIds.clear();
    t.riskKinds.clear();
    if (this.spectator || g.state.phase.kind === 'handOver') return;
    const plan = this.settings.groupSets ? this.setAsidePlan() : null;
    if (plan?.pieces.length) {
      const left = new Map<number, number>();
      plan.pieces.forEach((piece, i) => !plan.fromMeld[i] && piece.slice(0, piece.length - plan.gaps[i]).forEach((k) => left.set(k, (left.get(k) ?? 0) + 1)));
      for (const x of g.players[this.me].hand) if ((left.get(x.kind) ?? 0) > 0) (left.set(x.kind, left.get(x.kind)! - 1), t.ppIds.add(x.id));
    }
    if (this.hintsOn) for (const k of this.riskNow()) t.riskKinds.add(k);
  }

  /** The risk kinds, worked out again only when the table changes (a discard, a call, a riichi). */
  private riskCache: { key: string; kinds: Set<number> } | null = null;
  private riskNow(): Set<number> {
    const g = this.game;
    const key = g.players.map((p) => `${p.discards.length}.${p.melds.length}.${p.riichi ? 1 : 0}`).join('|') + `|${g.state.phase.kind}|${g.state.round.handsPlayed}|${g.liveRemaining}`;
    if (this.riskCache?.key !== key) this.riskCache = { key, kinds: riskyTargetKinds(g, this.me) };
    return this.riskCache.kinds;
  }

  /** The chip row above your tiles: the targets you can make; tap one to set it aside. */
  private renderTargetPick() {
    const row = clear(this.els.pp);
    const kit = this.kit();
    const plans = kit && this.settings.groupSets && this.game.state.phase.kind !== 'handOver' ? this.targetPlansNow().filter((p) => p.pieces.length) : [];
    row.hidden = !plans.length;
    // The phone pill: the target you're aiming for; it opens every possibility.
    const pill = this.ctl?.ppBtn;
    if (pill) {
      const live = !!kit && !this.spectator && this.game.state.phase.kind !== 'handOver' && this.targetPlansNow().length > 0;
      pill.hidden = !live;
      if (live) {
        const aim = this.settings.groupSets ? this.targetPlan() : null;
        pill.innerHTML = icon('grid');
        pill.append(h('span', { class: 'pp-btn-text' }, aim ? `${tr(kit!.chip)}: ${passportNames(aim.names)}` : tr('Possibilities')));
        pill.title = tr('Every hand you can still make. Tap to choose one.');
      }
    }
    if (!kit || !plans.length) return;
    const chosen = this.targetPlan();
    row.setAttribute('aria-label', tr(kit.chip));
    row.append(h('span', { class: 'pp-label' }, tr(kit.chip)));
    for (const p of plans) {
      const on = chosen?.key === p.key;
      const away = passportAway(p.missing - 1);
      row.append(
        h(
          'button',
          {
            type: 'button',
            class: `pp-chip${on ? ' on' : ''}`,
            'aria-pressed': String(on),
            title: [passportNames(p.names), p.note ? tr(p.note) : '', tr(kit.chipTip)].filter(Boolean).join(' · '),
            onclick: () => {
              this.ppChoice = p.key;
              this.pushLayout();
              this.resync();
              this.renderTargetPick();
            },
          },
          h('span', { class: 'pp-nm' }, passportNames(p.names)),
          h('span', { class: 'pp-away' }, away),
        ),
      );
    }
  }

  /** Share the hand layout with the 3D rack and refresh the sort controls. */
  private pushLayout() {
    this.table.handLayout = this.handLayout();
    const by = this.settings.sort === 'suit' ? tr('by suit') : tr('by number');
    const sort = this.els.sort;
    sort.innerHTML = icon('sort');
    sort.append(this.customOrder ? tr('Sort: your order ↺') : tr('Sort: {by}', { by }));
    sort.title = this.customOrder
      ? tr('Your own order. Tap to sort {by} again.', { by })
      : tr('Tiles are sorted {by}. Tap to sort {other}. Drag any tile to put it where you like.', { by, other: this.settings.sort === 'suit' ? tr('by number') : tr('by suit') });
    sort.setAttribute('aria-label', sort.title);
    const g = this.els.group;
    const on = !!this.settings.groupSets;
    g.innerHTML = icon('group');
    // Rounds whose targets have fixed tiles say what is set aside; the rest group sets as usual.
    const kit = this.kit();
    const pp = kit && kit.id !== 'special' ? kit : null;
    g.append(on ? (pp ? tr(pp.groupOn) : tr('Sets grouped ✓')) : pp ? tr(pp.groupOff) : tr('Group sets'));
    g.classList.toggle('on', on);
    g.setAttribute('aria-pressed', String(on));
    this.renderTargetPick();
    g.title = pp
      ? on
        ? tr(pp.tipOn)
        : tr(pp.tipOff)
      : on
      ? tr('Complete sets are pulled to the left and spaced apart. Tap to stop grouping.')
      : this.handLayout().chows ? tr('Pull complete sets (three of a kind or a run of three) to the left, spaced apart, so you can see what is still loose.') : tr('Pull complete sets (three of a kind) to the left, spaced apart, so you can see what is still loose.');
  }

  /**
   * "Speak all content": read out prompts that tell you what to do. Waits a
   * moment so a player's tile call is heard first, and never repeats a line
   * within a few seconds.
   */
  private speak(line: Spoken) {
    const text = line.text;
    if (!narrator.speakAll || this.spectator || !text) return;
    const now = Date.now();
    if (text === this.spoken.text && now - this.spoken.at < 4000) return;
    this.spoken.text = text;
    this.spoken.at = now;
    window.clearTimeout(this.spoken.timer);
    // Mei's own recorded pieces (tile names, short lines), never a stand-in voice.
    this.spoken.timer = window.setTimeout(() => !this.aborted && narrator.autoParts(line.parts, text), 650);
  }

  /** A prompt with JongBot's advice added when hints are on. */
  private prompt(line: Spoken, hint: Hint | null) {
    this.speak(this.hintsOn && hint ? withHint(line, hint, this.claimWord(hint)) : line);
  }

  /** The variation's word for the claim a hint recommends (Pung, Pon, Peng...). */
  private claimWord(hint: Hint): string | undefined {
    const a = hint.action;
    return a === 'pung' || a === 'kong' || a === 'chow' ? this.game.profile.callNames[a] : undefined;
  }

  /** Large, readable copy of the latest discard, so it never has to be found on the table. */
  private showLastDiscard(seat: number, kind: number) {
    const el = clear(this.els.last);
    el.hidden = false;
    el.append(
      tileImg(kind, '', this.settings.labels),
      h(
        'div',
        { class: 'ld-text' },
        h('span', { class: 'ld-who' }, seat === this.you ? tr('Your last discard') : tr('Last discard')),
        h('span', { class: 'ld-tile' }, tileLabel(kind)),
        seat === this.you ? null : h('span', { class: 'ld-from' }, tr('Thrown by {name}, {side}', { name: this.game.players[seat].name, side: this.sideOf(seat) })),
      ),
    );
    this.placeLastDiscard();
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  }

  /** Where a seat sits from your chair: on your right, across, on your left. */
  private sideOf(seat: number): string {
    const n = this.game.players.length;
    const d = (seat - this.you + n) % n;
    if (n === 3) return d === 1 ? tr('on your right') : tr('on your left');
    return d === 1 ? tr('on your right') : d === 2 ? tr('across from you') : tr('on your left');
  }

  /** In the guided game Mei's caption sits where the callout goes, so the callout drops just below it (and follows as her caption grows). */
  private placeLastDiscard() {
    const coach = this.opts.coach?.el;
    const el = this.els.last;
    el.style.left = el.style.right = el.style.transform = '';
    // The console holds the card in its own column.
    if (this.hudMode === 'console') return void (el.style.top = '');
    const wide = matchMedia('(min-height: 501px) and (min-aspect-ratio: 85/100)').matches;
    // Wide tables: tucked under the round title (whose height varies with dora and bonus rows); the view buttons follow below.
    const corner = () => {
      const badge = this.root.querySelector('.round-badge')?.getBoundingClientRect();
      const top = badge ? Math.round(badge.bottom + 10) : null;
      el.style.top = top === null ? '' : `${top}px`;
      const end = (top ?? 92) + (el.offsetHeight || 72) + 12;
      this.root.style.setProperty('--ld-end', `${end}px`);
      // If the view buttons would then run into the left player's plate, tuck them away (pinch, wheel and drag still work).
      const views = this.root.querySelector<HTMLElement>('.hud-views');
      const plate = [...this.root.querySelectorAll<HTMLElement>('.seat:not([hidden])')].map((x) => x.getBoundingClientRect()).filter((r) => r.left < 120 && r.top > end).sort((a, b) => a.top - b.top)[0];
      this.root.classList.toggle('views-tucked', !!views && !!plate && end + views.offsetHeight + 8 > plate.top);
    };
    if (!coach || coach.hidden || !coach.isConnected || coach.getBoundingClientRect().top > window.innerHeight / 2) {
      if (wide) corner();
      else el.style.top = '';
      return;
    }
    const c = coach.getBoundingClientRect();
    const w = el.offsetWidth || 260;
    // Wide tables keep the card in the top-left corner (match.css) when Mei's caption leaves room for it.
    if (wide && c.left >= w + 28) return corner();
    // Wide screens: beside Mei's caption, so neither covers the discards. Narrow ones: just below it.
    if (c.right + 12 + w + 16 <= window.innerWidth) {
      el.style.top = `${Math.round(c.top)}px`;
      el.style.left = `${Math.round(c.right + 12)}px`;
      el.style.right = 'auto';
      el.style.transform = 'none';
    } else el.style.top = `${Math.round(c.bottom + 8)}px`;
  }

  /** The JongClub card of American hands, with your closest hands marked. */
  private showCard() {
    const o = this.els.sheet;
    clear(o).hidden = false;
    const pl = this.game.players[this.me];
    const near = new Map(progress(pl.hand, pl.melds, 40).map((p) => [p.instance.hand.id, p.missing] as const));
    const list = h('div', { class: 'card-list' });
    let section = '';
    for (const hand of CARD) {
      if (hand.section !== section) {
        section = hand.section;
        list.append(h('h4', { class: 'card-section' }, section));
      }
      const pattern = h('span', { class: 'card-pattern' });
      for (const tok of hand.pattern.split(' ')) {
        const m = tok.match(/^(.+?)([abc])?$/)!;
        pattern.append(h('span', { class: `cp cp-${m[2] ?? 'n'}` }, m[1]), ' ');
      }
      const miss = near.get(hand.id);
      list.append(
        h(
          'div',
          { class: `card-row ${miss !== undefined && miss <= 4 ? 'near' : ''}` },
          pattern,
          h('span', { class: 'card-val' }, `${hand.concealed ? 'C ' : 'X '}${hand.value}`),
          miss !== undefined && miss <= 6 ? h('span', { class: 'card-miss' }, miss === 0 ? tr('Complete') : tr('{n} to go', { n: miss })) : null,
        ),
      );
    }
    o.append(
      h(
        'div',
        { class: 'card card-sheet' },
        h('p', { class: 'eyebrow' }, tr('JongClub card 2026')),
        h('h3', {}, tr('Hands you can win with')),
        h('p', { class: 'muted small' }, tr('This is JongClub’s own card in the American style, not the National Mah Jongg League card.')),
        list,
        h('ul', { class: 'card-key' }, ...CARD_KEY.map((k) => h('li', {}, k))),
        h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', onclick: () => (o.hidden = true) }, tr('Back to the table'))),
      ),
    );
    o.querySelector<HTMLElement>('.btn.primary')?.focus({ preventScroll: true });
  }

  private callWarnDone?: (yes: boolean) => void;

  /** Asks before a call that fits none of your cards (or no winning hand at all). Resolves true for "Call anyway". */
  private callWarning(call: string): Promise<boolean> {
    this.closeCallWarning(false);
    const cards = !!this.game.state.cards;
    return new Promise<boolean>((resolve) => {
      this.callWarnDone = resolve;
      const answer = (yes: boolean) => this.closeCallWarning(yes);
      const el = h(
        'div',
        { class: 'overlay table-sheet call-warn', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'call-warn-title' },
        h(
          'div',
          { class: 'card confirm' },
          h('h3', { id: 'call-warn-title' }, cards ? tr('This set fits none of your cards') : tr('This call leaves you no way to win')),
          h('p', {}, cards ? tr('After this {call}, none of your cards can be completed, so you could not win this hand.', { call }) : tr('After this {call}, no winning hand can be made from your sets, so you could not win this hand.', { call })),
          h(
            'div',
            { class: 'btn-row' },
            h('button', { class: 'btn primary', onclick: () => answer(false) }, tr('Don’t call')),
            h('button', { class: 'btn', onclick: () => answer(true) }, tr('Call anyway')),
          ),
        ),
      );
      // It must be answered: Escape and taps outside it do nothing, and Tab stays on its two buttons.
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') (e.preventDefault(), e.stopPropagation());
        if (e.key !== 'Tab') return;
        const bs = [...el.querySelectorAll<HTMLElement>('button')];
        const i = bs.indexOf(document.activeElement as HTMLElement);
        e.preventDefault();
        bs[(i + (e.shiftKey ? bs.length - 1 : 1)) % bs.length]?.focus();
      });
      this.callWarn = el;
      this.els.sheet.after(el);
      el.querySelector<HTMLElement>('.btn.primary')?.focus({ preventScroll: true });
    });
  }

  private closeCallWarning(yes: boolean) {
    this.callWarn?.remove();
    this.callWarn = undefined;
    const done = this.callWarnDone;
    this.callWarnDone = undefined;
    done?.(yes);
  }

  private confirmLeave() {
    const o = this.els.sheet;
    clear(o).hidden = false;
    o.append(
      h(
        'div',
        { class: 'card confirm' },
        h('h3', {}, tr('Leave the table?')),
        h('p', {}, this.opts.ranked ? tr('Leaving a ranked game counts as finishing 4th.') : this.opts.tag === 'tournament' ? tr('Leaving counts as finishing last at this table.') : tr('This game will not be saved to your profile.')),
        h(
          'div',
          { class: 'btn-row' },
          h('button', { class: 'btn ghost', onclick: () => (o.hidden = true) }, tr('Keep playing')),
          h('button', { class: 'btn', onclick: () => this.abort() }, tr('Leave table')),
        ),
      ),
    );
    o.querySelector<HTMLElement>('.btn.ghost')?.focus({ preventScroll: true });
  }

  abort() {
    this.aborted = true;
    this.closeCallWarning(false);
    window.removeEventListener('resize', this.onResize);
    this.releaseStage();
    callers.stop();
    window.clearTimeout(this.spoken.timer);
    this.opts.link?.close();
    window.clearInterval(this.timerHandle);
    window.cancelAnimationFrame(this.timerFrame);
    window.removeEventListener('keydown', this.onKey);
    this.resolveHuman?.(() => {});
    this.hooks.onExit();
  }

  applySettings(s: Settings) {
    this.settings = s;
    this.pushLayout();
    // Sorting and grouping changed in Settings show on the 3D rack at once, not on the next move.
    this.table.relayout();
    this.refreshHud();
    this.renderTray();
    // A depth changed in Settings shows at once.
    const hint = this.lastHint && (this.hintSrc?.(s.hintDepth) ?? this.lastHint);
    if (hint) this.renderHint(hint);
  }

  private refreshHud() {
    this.guide.refresh();
    this.calc.refresh();
    this.refreshAutoDraw();
    const g = this.game;
    const rl = roundLabel(g.profile.rounds, g.state.round);
    // Each seat's gold on its side table follows the score.
    this.table.setPurses(g.players.map((p) => p.score), g.profile.startingScore);
    this.els.round.textContent = rl.round;
    this.els.hand.textContent = g.profile.rounds.maxHands === 1 ? tr('Single hand') : rl.hand;
    this.els.wall.textContent = tr('{n} tiles left', { n: g.liveRemaining });
    const extra = clear(this.els.extra);
    if (g.profile.doraFromIndicator && g.state.doraRevealed) {
      const dora = h('span', { class: 'dora', title: tr('Dora: each one in your winning hand adds 1 han. The indicator tile in the dead wall points to the next tile in order.') }, tr('Dora'));
      for (const k of g.doraKinds()) dora.append(tileImg(k, 'mini', this.settings.labels));
      extra.append(dora);
    }
    // A natural wild (laizi, baida, gold, hun'er): show which tile is wild this hand.
    if (g.profile.naturalWild && g.state.wildKinds?.length) {
      const wild = h('span', { class: 'dora wild-pill', title: tr('Wild this hand: stands for any tile in your concealed hand, never in a claimed set. A thrown wild is dead.') }, tr(g.profile.naturalWild.name));
      for (const k of g.state.wildKinds) wild.append(tileImg(k, 'mini', this.settings.labels));
      extra.append(wild);
    }
    if (g.profile.riichi?.cost) extra.append(h('span', { class: 'sticks' }, tr('Riichi sticks {n} · Honba {honba}', { n: g.state.riichiPot / g.profile.riichi.cost, honba: g.state.round.repeat })));
    else if (g.state.riichiPot) extra.append(h('span', { class: 'sticks', title: g.profile.buyFromLeft ? tr('Buy money and drawn-hand stakes wait here. The next winner collects them.') : tr('Put in the bank at drawn hands. The next winner collects it.') }, `${g.state.goulash || g.profile.goulashPot ? tr('Goulash pot') : tr('Bank')} ${fmt(g.state.riichiPot)}`));
    if (g.state.goulash)
      extra.append(
        g.profile.card
          ? h('span', { class: 'goulash-pill', title: tr('Goulash: the last hand was a wall game, so East deals again and jokers may be passed in this Charleston. The deal passes as usual afterwards.') }, tr('Goulash · jokers may pass'))
          : h('span', { class: 'goulash-pill', title: tr('Goulash exchange: the last hand was a wall game, so everyone passes three tiles right, across and left before play.') }, tr('Goulash exchange')),
      );
    const special = g.profile.specialRound as SpecialRoundId | undefined;
    const chosen = g.profile.chosenGame;
    // India Rules North: the game East chose this hand.
    if (chosen) extra.append(h('button', { class: 'goulash-pill round-pill', title: tr(SPECIAL_ROUNDS.indiaNorth.rule), onclick: () => this.guide.toggle(true) }, tr('North: {game}', { game: tr(chosen) })));
    else if (special) extra.append(h('button', { class: 'goulash-pill round-pill', title: tr(SPECIAL_ROUNDS[special].rule), onclick: () => this.guide.toggle(true) }, tr(SPECIAL_ROUNDS[special].name)));
    // North round jokers: a number in each suit (one of each per player), or the flowers and seasons.
    if (g.profile.fixedWilds && g.state.wildKinds?.length) {
      const flowers = !!g.profile.flowersWild;
      const wild = h('span', { class: 'dora wild-pill', title: flowers ? tr('Flowers and seasons are jokers this game: each stands for any tile. They are not set aside and not paid.') : tr('Jokers this game: one of each in your hand stands for any tile in a pung, kong or the pair. A second copy is a natural tile.') }, tr('Jokers'));
      if (flowers) wild.append(tileImg(g.state.wildKinds[0], 'mini', this.settings.labels));
      else for (const k of g.state.wildKinds) wild.append(tileImg(k, 'mini', this.settings.labels));
      extra.append(wild);
    }
    // India Rules South round: your secret Small Card.
    const card = !this.spectator && g.state.cards ? SMALL_CARDS[g.state.cards[this.me]] : undefined;
    if (card) extra.append(h('button', { class: 'goulash-pill round-pill card-pill', title: card.how, onclick: () => this.showSmallCard(card) }, tr('Your card: {name}', { name: card.name })));
    // India Rules North round: the Big Card East chose for everyone.
    const big = g.profile.big;
    if (big) extra.append(h('button', { class: 'goulash-pill round-pill card-pill', title: big.how, onclick: () => this.showBigCard(big) }, tr('Big Card: {name}', { name: big.name })));
    if (g.state.instant?.length && !this.spectator) {
      const net = netOf(g.state.instant, this.me);
      extra.append(h('span', { class: 'instant-pill', title: tr('Paid on the spot this hand (animal bites, kong money). Settled with the hand.') }, tr('On the spot {n}', { n: `${net > 0 ? '+' : net < 0 ? '−' : ''}${fmt(Math.abs(net))}` })));
    }
    const ph = g.state.phase;
    const turn = ph.kind === 'turn' ? ph.seat : -1;
    const start = fmt(g.profile.startingScore);
    const how = g.profile.card
      ? tr('A Mah Jongg is paid by the others: the player who threw the winning tile pays double, and everyone pays double for a self-drawn win.')
      : g.profile.riichi?.cost
        ? tr('Winning a hand takes points from the player who threw your winning tile, or from everyone when you draw it yourself. Declaring riichi puts a 1,000-point stick on the table.')
        : tr('Winning a hand takes points from the player who threw your winning tile, or from everyone when you draw it yourself.');
    const scoreTip = (s: number) =>
      `${s === this.you ? tr('Points: your score in this match.') : tr('Points: {name}’s score in this match.', { name: g.players[s].name })} ${tr('Everyone starts with {n}.', { n: start })} ${how} ${tr('The most points when the match ends takes first place.')} ${tr('Tap a plate to see what that hand is worth now.')}`;
    // The target each other player's exposed sets point to (while JongBot is on).
    const reads = this.hintsOn && !this.spectator && ph.kind !== 'handOver' ? likelyTargets(g, this.me) : new Map();
    // Before the deal is done nobody has flowers to show yet, and on the first hand East is not known until the throw.
    const preDeal = performance.now() < this.trayHold;
    const eastKnown = !(this.trayHold === Infinity && this.handNo === 0);
    g.players.forEach((p, s) => {
      // Bubbles (phrases, reactions, tea) outlive a plate refresh.
      const keep = [...this.els.seats[this.rel(s)].querySelectorAll(':scope > .phrase-bubble, :scope > .bubble, :scope > .float-emoji')];
      const el = clear(this.els.seats[this.rel(s)]);
      el.classList.toggle('active', s === turn);
      const wind = g.state.seatWinds[s];
      const ai = this.ais[s];
      el.append(
        this.avatars[s] ? h('div', { class: 'avatar svg', 'aria-hidden': 'true', html: seatPortrait(this.avatars[s]!) }) : h('div', { class: 'avatar', 'aria-hidden': 'true' }, p.name[0]),
        h(
          'div',
          { class: 'seat-info' },
          h('div', { class: 'seat-name' }, h('span', { class: 'seat-nm' }, p.name), s === g.dealer && eastKnown ? h('span', { class: 'dealer', title: tr('Dealer: this player starts the hand and makes the first discard') }, tr('Dealer')) : null, p.riichi ? h('span', { class: 'riichi-pill' }, tr(g.profile.callNames.riichi ?? 'Riichi')) : null, p.flowers.length && !preDeal ? h('span', { class: 'flower-pill', title: g.profile.flowersHidden && s !== this.me && g.state.phase.kind !== 'handOver' ? tr('Face down until Mahjong') : p.flowers.map((f) => tileLabel(f.kind)).join(', ') }, `✿ ${p.flowers.length}`) : null),
          h('div', { class: 'seat-sub' }, h('span', { class: 'wind', title: { E: tr('East seat'), S: tr('South seat'), W: tr('West seat'), N: tr('North seat') }[wind] }, wind), this.seats[s].kind === 'ai' ? PERSONALITIES[ai.personality].label : s === this.you ? tr('You') : tr('Club member')),
          reads.has(s) ? h('div', { class: 'seat-pp', title: reads.get(s)!.line }, h('span', { class: 'seat-pp-tag' }, tr('Likely')), h('span', { class: 'seat-pp-name' }, tr(reads.get(s)!.name))) : null,
        ),
        h('div', { class: 'seat-score', title: scoreTip(s) }, h('span', { class: 'pts-num' }, fmt(p.score)), h('span', { class: 'pts-cap' }, tr('pts'))),
        // Narrow upright screens: the side racks run off the screen's edges, so their claimed sets show here (CSS shows it there only).
        s !== this.me && p.melds.length
          ? h('div', { class: 'seat-sets', 'aria-label': tr('Revealed sets') }, ...p.melds.map((m) => h('span', { class: 'seat-set' }, ...m.tiles.map((t, j) => (m.concealed && (j === 0 || j === m.tiles.length - 1) ? h('span', { class: 'seat-back' }) : tileImg(t.kind, 'mini', this.settings.labels, isRed(g.state, t.id)))))))
          : '',
      );
      el.append(...keep);
    });
  }

  private sync(opts: Parameters<TableRenderer['layout']>[1] = {}) {
    this.updateMatchKind();
    this.table.flowersHidden = !!this.game.profile.flowersHidden;
    this.table.discardDefault = this.game.profile.discards ?? 'rows';
    this.table.discardSetting = this.settings.discardLayout ?? 'auto';
    // The target set aside follows the hand as it changes.
    if (this.kit() && this.settings.groupSets) {
      this.table.handLayout = this.handLayout();
      this.renderTargetPick();
    }
    this.targetMarks();
    this.table.layout(this.viewState(), opts);
    // The camera settles after a move; keep the side plates level with the compass on the centre board.
    if (this.table.discardLayout === 'centre') window.setTimeout(() => !this.aborted && this.levelSidePlates(window.innerWidth / window.innerHeight < 0.85), 700);
    this.refreshHud();
    this.renderTray();
    const ph = this.game.state.phase;
    // Exchanges and the Small Card choice come before play: no hand status yet (and none without a card).
    const pre = ph.kind === 'handOver' || ph.kind === 'charleston' || ph.kind === 'charlestonVote' || ph.kind === 'cardPick' || ph.kind === 'roundChoice' || (!!this.game.profile.dealCards && !this.game.state.cards);
    const st = pre ? '' : this.asSeen(() => handStatus(this.game, this.me));
    this.els.status.textContent = st ? tr('Your hand: {status}', { status: st }) : '';
    this.renderWaits();
    this.refreshDock();
  }

  /** The latest discard by someone else, while it can still be claimed or has just landed: your matching tiles get a soft cue. */
  private updateMatchKind() {
    const g = this.game;
    const ph = g.state.phase;
    let kind: number | null = null;
    if (this.settings.matchHighlight !== false && !this.spectator && ph.kind !== 'handOver' && !(ph.kind === 'turn' && ph.seat === this.me)) {
      for (let i = g.state.log.length - 1; i >= 0; i--) {
        const e = g.state.log[i];
        if (e.type === 'discard') {
          if (e.seat !== this.me && g.players[e.seat].discards.some((t) => t.id === e.tile.id)) kind = e.tile.kind;
          break;
        }
        if (e.type === 'call' || e.type === 'draw') break;
      }
    }
    this.table.matchKind = kind;
  }

  /** One tile from winning: the tiles that complete your hand, each with how many you have not seen. */
  private renderWaits() {
    const el = this.els.waits;
    const g = this.game;
    const ph = g.state.phase;
    const pl = g.players[this.me];
    const on = this.settings.showWaits !== false && this.config.hints && !this.spectator && !g.profile.card && ph.kind !== 'handOver' && ph.kind !== 'charleston' && ph.kind !== 'charlestonVote';
    // Only between your own discards (13 tiles in hand, less any sets), when the answer is stable.
    const waiting = on && pl.hand.length % 3 === 1 ? g.waitsOf(this.me).filter((k) => k < KIND_COUNT) : [];
    const key = waiting.join(',') + '|' + (waiting.length ? unseenCounts(g, this.me).join(',') : '');
    if (el.dataset.key === key) return;
    el.dataset.key = key;
    clear(el);
    el.hidden = !waiting.length;
    if (!waiting.length) return;
    const unseen = unseenCounts(g, this.me);
    const total = waiting.reduce((a, k) => a + (unseen[k] ?? 0), 0);
    el.title = tr('You are one tile from winning. These tiles complete your hand; the number is how many you have not seen yet ({n} in all).', { n: total });
    el.append(
      h('span', { class: 'w-label' }, tr('Waiting on')),
      ...waiting.map((k) => h('span', { class: `w-tile ${unseen[k] ? '' : 'dead'}`, 'aria-label': tr('{tile}, {n} left', { tile: tileLabel(k), n: unseen[k] }) }, tileImg(k, 'mini', this.settings.labels), h('b', {}, `×${unseen[k]}`))),
    );
  }

  private toast(text: string, sub = '') {
    const t = this.els.toast;
    clear(t).append(h('div', { class: 'toast-main' }, text), sub ? h('div', { class: 'toast-sub' }, sub) : '');
    t.classList.remove('show');
    void t.offsetWidth;
    t.classList.add('show');
  }

  private bubble(seat: number, text: string) {
    const el = this.els.seats[this.rel(seat)];
    const b = h('div', { class: 'bubble' }, text);
    el.append(b);
    setTimeout(() => b.remove(), 3200);
  }

  react(seat: number, emoji: string) {
    if (this.tea.onSignal(seat, emoji)) return;
    if (showSignal(this.els.seats[this.rel(seat)], seat, emoji, seat === this.me && !this.spectator)) return;
    sound.play('react');
    const el = this.els.seats[this.rel(seat)];
    const f = h('div', { class: 'float-emoji' }, emoji);
    el.append(f);
    setTimeout(() => f.remove(), 1800);
  }

  // ------------------------------------------------------------ hand tray (compact screens)

  private traySlots: HandSlot[] = [];
  /** Whether the tray was last drawn for a phone-shaped screen. */
  private trayCompact = false;

  /** Turning a phone or resizing a window swaps between the 3D rack and the tile tray, so redraw the tray. */
  private onResize = () => {
    if (this.aborted) return window.removeEventListener('resize', this.onResize);
    if (this.table.tray !== this.trayCompact) this.renderTray();
    this.arrange();
    this.placeDock();
    this.guide.place();
    this.calc.place();
  };

  /**
   * The left player's plate and your own share the left edge: on short screens their usual spots meet,
   * so the left plate steps up (never above the last-discard card or the view buttons), and if even that
   * is not enough room it moves beside your plate instead of on top of it.
   */
  private unstackPlates() {
    const hud = this.root;
    // The top plate stays below the round title where the two meet (upright phones).
    const across = hud.querySelector<HTMLElement>('.seat-2');
    const badge = hud.querySelector<HTMLElement>('.hud-top .round-badge');
    // Landscape phones place the left plate and the last-discard card below the round title, whose
    // height grows with its extra rows (dora, bank, jokers, your card): match.css reads --badge-end.
    if (badge?.offsetParent) {
      const end = `${Math.round(badge.getBoundingClientRect().bottom - hud.getBoundingClientRect().top)}px`;
      if (hud.style.getPropertyValue('--badge-end') !== end) hud.style.setProperty('--badge-end', end);
    }
    if (across && badge) {
      across.style.top = across.style.left = across.style.transform = '';
      const t = across.getBoundingClientRect();
      const r = badge.getBoundingClientRect();
      if (across.offsetParent && t.left < r.right && r.left < t.right && t.top < r.bottom && r.top < t.bottom) {
        // Short screens: step right of the title, staying on the top edge, rather than down over the discards.
        const toolsLeft = hud.querySelector<HTMLElement>('.hud-tools')?.getBoundingClientRect().left ?? window.innerWidth;
        if (window.innerHeight <= 500 && r.right + 8 + t.width <= toolsLeft - 8) {
          across.style.left = `${Math.round(r.right + 8 - hud.getBoundingClientRect().left)}px`;
          across.style.transform = 'none';
        } else across.style.top = `${Math.round(r.bottom + 6 - hud.getBoundingClientRect().top)}px`;
      }
      // ...and below the menu buttons on the right where the screen is too narrow for both in one row.
      const tools = hud.querySelector<HTMLElement>('.hud-tools');
      const m = tools?.getBoundingClientRect();
      const t2 = across.getBoundingClientRect();
      if (m && across.offsetParent && m.height && t2.left < m.right && m.left < t2.right && t2.top < m.bottom && m.top < t2.bottom) across.style.top = `${Math.round(m.bottom + 6 - hud.getBoundingClientRect().top)}px`;
    }
    const left = hud.querySelector<HTMLElement>('.seat-3');
    const mine = hud.querySelector<HTMLElement>('.seat-0');
    if (!left || !mine) return;
    left.style.top = left.style.left = '';
    if (!left.offsetParent || !mine.offsetParent) return;
    const a = left.getBoundingClientRect();
    const b = mine.getBoundingClientRect();
    const gap = 8;
    if (a.bottom + gap <= b.top || a.top >= b.bottom + gap || a.right <= b.left || a.left >= b.right) return;
    // The lowest thing above the plate on the left edge: the title, the last-discard card, the view buttons.
    const hudTop = hud.getBoundingClientRect().top;
    const above = [...hud.querySelectorAll<HTMLElement>('.hud-top .round-badge, .last-discard:not([hidden]), .hud > .hud-views')]
      .filter((e) => e.offsetParent && getComputedStyle(e).opacity !== '0')
      .map((e) => e.getBoundingClientRect())
      .filter((r) => r.left < a.right && r.bottom < b.top)
      .reduce((m, r) => Math.max(m, r.bottom), 0);
    const want = b.top - gap - a.height;
    if (want >= above + gap) {
      left.style.top = `${Math.round(want - hudTop)}px`;
      return;
    }
    // No room above: sit level with your plate, just to its right.
    left.style.top = `${Math.round(b.top - hudTop)}px`;
    left.style.left = `${Math.round(b.right + gap)}px`;
  }

  /** Upright phones: the side plates sit low, in the band between the rivers and your hand (CSS), but never
   *  over JongBot, Mei or the status line in the bottom stack. */
  private clearSidePlates() {
    const hud = this.root;
    const bottom = hud.querySelector<HTMLElement>('.bottom');
    if (!bottom) return;
    const tops = [bottom, ...bottom.children]
      .filter((e) => (e as HTMLElement).offsetParent !== null || getComputedStyle(e).position === 'fixed')
      .map((e) => e.getBoundingClientRect())
      .filter((r) => r.height > 2)
      .map((r) => r.top);
    if (!tops.length) return;
    const limit = Math.min(...tops) - 8;
    const hudTop = hud.getBoundingClientRect().top;
    const right = hud.querySelector<HTMLElement>('.seat-1');
    if (right) right.style.top = '';
    for (const sel of ['.seat-1', '.seat-3']) {
      const el = hud.querySelector<HTMLElement>(sel);
      if (!el || !el.offsetParent || el.style.left) continue;
      const r = el.getBoundingClientRect();
      if (r.bottom > limit) el.style.top = `${Math.round(limit - r.height - hudTop)}px`;
    }
  }

  /** The hand's status row shares a band with your plate when both ride above the hand: keep it to the plate's right. */
  private clearStatusRow() {
    const row = this.root.querySelector<HTMLElement>('.bottom > .status-row');
    const mine = this.root.querySelector<HTMLElement>('.seat-0');
    if (!row) return;
    row.style.left = row.style.top = row.style.bottom = '';
    if (!mine || !row.offsetParent || !mine.offsetParent || getComputedStyle(row).position !== 'absolute') return;
    // Short landscape screens: under a tall round title the last-discard card reaches down to the status
    // line above your plate, so the line moves beside your plate instead.
    const ld = this.els.last;
    if (!ld.hidden && ld.offsetParent) {
      const a = row.getBoundingClientRect();
      const l = ld.getBoundingClientRect();
      if (a.left < l.right && l.left < a.right && a.top < l.bottom + 4 && l.top < a.bottom) {
        const b = mine.getBoundingClientRect();
        const box = (row.offsetParent as HTMLElement).getBoundingClientRect();
        row.style.bottom = 'auto';
        row.style.top = `${Math.round(b.top + (b.height - a.height) / 2 - box.top)}px`;
        row.style.left = `${Math.round(b.right + 12 - box.left)}px`;
        return;
      }
    }
    // Your plate, and the left player's when unstackPlates moved it beside yours.
    const left = this.root.querySelector<HTMLElement>('.seat-3');
    const plates = [mine, ...(left?.offsetParent && left.style.left ? [left] : [])].map((e) => e.getBoundingClientRect()).sort((p, q) => p.left - q.left);
    const base = (row.offsetParent as HTMLElement).getBoundingClientRect().left;
    for (const b of plates) {
      const a = row.getBoundingClientRect();
      if (a.right <= b.left || a.left >= b.right + 8 || a.bottom <= b.top || a.top >= b.bottom) continue;
      row.style.left = `${Math.round(b.right + 12 - base)}px`;
    }
  }

  /**
   * Upright screens: what players say (phrases, tea, bot remarks) would hang off their plates over the rivers,
   * so each bubble moves into one strip under the top player's plate, with the speaker's name. At most two show.
   */
  private gatherTalk(r: HTMLElement) {
    const talk = h('div', { class: 'table-talk' });
    r.append(talk);
    new MutationObserver((muts) => {
      if (window.innerWidth / window.innerHeight >= 0.85) return;
      for (const m of muts)
        for (const n of m.addedNodes) {
          const plate = n instanceof HTMLElement ? n.parentElement : null;
          if (!plate?.classList.contains('seat') || !(n as HTMLElement).matches('.bubble, .phrase-bubble')) continue;
          const b = n as HTMLElement;
          const who = plate.querySelector('.seat-nm')?.textContent;
          if (who && !b.classList.contains('tea-bubble')) b.prepend(h('b', { class: 'tt-who' }, who));
          talk.append(b);
          while (talk.children.length > 2) talk.firstElementChild!.remove();
        }
    }).observe(r, { childList: true, subtree: true });
  }

  private dockKey = '';
  /**
   * The bottom-right dock for Mei's caption and JongBot: below the right player's plate, above your hand,
   * and right of the hand's status buttons. Upright phones use the strip just above the bottom stack.
   */
  private placeDock() {
    const hud = this.root;
    if (!hud.isConnected) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const g = parseFloat(getComputedStyle(hud).getPropertyValue('--gutter')) || 16;
    const visible = (el: Element | null) => (el && (el as HTMLElement).offsetParent !== null ? el.getBoundingClientRect() : null);
    const upright = W / H < 0.85;
    this.unstackPlates();
    if (upright) this.clearSidePlates();
    let vars: Record<string, string>;
    if (this.hudMode === 'console' && this.ctl) {
      // The console: JongBot and Mei stand at its foot (unless moved), and its contents scroll above them.
      const cw = parseFloat(getComputedStyle(document.body).getPropertyValue('--console-w')) || 300;
      const head = this.ctl.conHead.getBoundingClientRect().bottom || 70;
      vars = { '--dock-bottom': '14px', '--dock-w': `${Math.round(cw - 28)}px`, '--dock-h': `${Math.round(H * 0.42)}px`, '--dock-tall': `${Math.round(Math.max(160, H - head - 28))}px` };
      const docked = [this.els.bot, this.opts.coach?.el].filter((el): el is HTMLElement => !!el && !el.hidden && el.offsetParent !== null && !el.classList.contains('floating') && getComputedStyle(el).display !== 'none');
      const tall = Math.max(0, ...docked.map((el) => el.getBoundingClientRect().height));
      const want = tall ? `${Math.round(tall + 20)}px` : '0px';
      if (this.ctl.conDock.style.height !== want) this.ctl.conDock.style.height = want;
    } else if (upright) {
      // Mei's guide sits under the tray on upright screens (match.css): the bottom stack makes room for it.
      // With the dock bar (phone layout) she floats above your tiles instead, like JongBot's card.
      const coach = this.hudMode === 'phone' ? null : this.opts.coach?.el;
      const space = coach && !coach.hidden && coach.isConnected && !coach.classList.contains('tucked') ? coach.offsetHeight + 6 : 0;
      if (hud.style.getPropertyValue('--coach-space') !== `${space}px`) hud.style.setProperty('--coach-space', `${space}px`);
      // The rivers keep out from under the side plates and the last-discard chip (TableRenderer.keepOut).
      this.table.keepOut = [...hud.querySelectorAll<HTMLElement>('.seat-1, .seat-3, .last-discard')]
        .filter((e) => !e.hidden && e.offsetParent !== null)
        .map((e) => e.getBoundingClientRect())
        .filter((b) => b.width > 0)
        .map((b) => ({ l: b.left - 4, t: b.top - 4, r: b.right + 4, b: b.bottom + 4 }));
      // The phone header plate's foot: the plates and the last-discard chip start below it (matchControls.css).
      const headB = `${Math.round(visible(hud.querySelector('.hud-top'))?.bottom ?? 90)}px`;
      if (hud.style.getPropertyValue('--head-b') !== headB) hud.style.setProperty('--head-b', headB);
      const across = visible(hud.querySelector('.seat-2')) ?? visible(hud.querySelector('.hud-top'));
      const talkTop = `${Math.round((across?.bottom ?? 120) + 6)}px`;
      if (hud.style.getPropertyValue('--talk-top') !== talkTop) hud.style.setProperty('--talk-top', talkTop);
      const stack = visible(hud.querySelector('.bottom > .status-row')) ?? visible(hud.querySelector('.bottom'));
      const bottom = stack ? Math.round(H - stack.top + 8) : Math.round(H * 0.3);
      const top = visible(hud.querySelector('.seat-1'))?.bottom ?? H * 0.4;
      vars = { '--dock-bottom': `${bottom}px`, '--dock-w': `${W - 2 * g}px`, '--dock-h': `${Math.max(96, Math.round(H - bottom - top - 8))}px`, '--dock-tall': `${Math.round(H * 0.45)}px` };
    } else {
      this.clearStatusRow();
      // Top of your hand: the flat tray's tiles, or the 3D rack's top edge (viewControls sets --hand-clear).
      const tiles = [...hud.querySelectorAll('.tray-tile')].map((t) => t.getBoundingClientRect()).filter((b) => b.height > 0);
      const clear = parseFloat(getComputedStyle(hud).getPropertyValue('--hand-clear'));
      let handTop = tiles.length ? Math.min(...tiles.map((b) => b.top)) : hud.hasAttribute('data-hand-clear') && clear > 0 ? hud.getBoundingClientRect().bottom - clear + 8 : H * 0.75;
      const actions = visible(hud.querySelector('.bottom > .action-row'));
      const w0 = Math.min(380, Math.max(240, Math.round(W * 0.27)));
      // Call buttons (Pung, Chow, Draw...) sit just above the hand: stay above them if they reach under the dock.
      if (actions && actions.right > W - g - w0 && actions.top < handTop) handTop = actions.top;
      const bottom = Math.round(H - handTop + 8);
      const plate = visible(hud.querySelector('.seat-1'));
      const tools = visible(hud.querySelector('.hud-tools'));
      const top = Math.round((plate && plate.bottom < handTop - 100 ? plate.bottom : (tools?.bottom ?? 60)) + 10);
      // Keep right of the hand's status row where it shares the band.
      const row = visible(hud.querySelector('.bottom > .status-row'));
      const room = row && row.bottom > top && row.top < handTop ? W - g - row.right - 12 : w0;
      const w = Math.max(220, Math.min(w0, room));
      vars = { '--dock-bottom': `${bottom}px`, '--dock-w': `${w}px`, '--dock-h': `${Math.max(110, H - bottom - top)}px`, '--dock-tall': `${Math.max(110, Math.round(H - bottom - (tools?.bottom ?? 60) - 10))}px` };
    }
    const key = JSON.stringify(vars);
    if (key !== this.dockKey) {
      this.dockKey = key;
      for (const [k, v] of Object.entries(vars)) hud.style.setProperty(k, v);
    }
    if (!upright && this.hudMode !== 'console') this.liftRightPlate();
    this.levelSidePlates(upright);
    this.measureBottomClear();
  }

  /**
   * Phones: how much of the screen's bottom your tray, the turn bar and the hint card cover, so the
   * table keeps your own discards above them. It only grows while the screen keeps its size, so the
   * view doesn't bob as the hint card comes and goes each turn.
   */
  private clearKey = '';
  private clearMax = 0;
  private measureBottomClear() {
    if (!this.table.tray) {
      this.table.bottomClear = 0;
      return;
    }
    const hud = this.root;
    const H = window.innerHeight;
    const W = window.innerWidth;
    const key = `${W}x${H}`;
    if (key !== this.clearKey) (this.clearKey = key), (this.clearMax = 0);
    const shown = (sel: string) => [...hud.querySelectorAll<HTMLElement>(sel)].filter((e) => e.offsetParent !== null && !e.closest('[hidden]')).map((e) => e.getBoundingClientRect());
    const boxes = [
      ...shown('.bottom > .status-row, .bottom > .action-row, .bottom > .tray'),
      // An opened hint panel may cover the table for a moment; only the compact card counts.
      ...shown('.hud > .coach, .jongbot').filter((r) => r.height < 130),
      // Only what lies over the middle of the table counts (landscape phones keep plates and cards to the sides).
    ].filter((r) => r.height > 0 && r.bottom > H * 0.5 && r.left < W * 0.68 && r.right > W * 0.32);
    if (!boxes.length) return;
    const top = Math.min(...boxes.map((r) => r.top));
    this.clearMax = Math.max(this.clearMax, Math.min(H * 0.5, H - top));
    this.table.bottomClear = Math.round(this.clearMax);
  }

  /**
   * Portrait phones with the centre board: the side players' plates sit level with the compass,
   * in the gap between the board's two halves, so they cover no discards.
   */
  private levelSidePlates(upright: boolean) {
    const on = upright && this.table.discardLayout === 'centre';
    const mid = this.table.centreY() - this.root.getBoundingClientRect().top;
    for (const s of [1, 3]) {
      const plate = this.root.querySelector<HTMLElement>(`.seat-${s}`);
      if (!plate) continue;
      if (!on) {
        if (plate.dataset.level) (plate.style.top = ''), delete plate.dataset.level;
        continue;
      }
      plate.dataset.level = '1';
      plate.style.top = `${Math.round(mid - plate.offsetHeight / 2)}px`;
    }
  }

  /** The right player's plate steps up when the dock (Mei, JongBot) reaches it on a short screen. */
  private liftRightPlate() {
    const plate = this.root.querySelector<HTMLElement>('.seat-1');
    if (!plate) return;
    plate.style.top = '';
    if (!plate.offsetParent) return;
    const docks = [...this.root.querySelectorAll<HTMLElement>('.hud > .coach, .jongbot')].filter((e) => !e.closest('[hidden]') && getComputedStyle(e).display !== 'none')
      .map((e) => e.getBoundingClientRect())
      .filter((d) => d.height > 0);
    const a = plate.getBoundingClientRect();
    const hit = docks.filter((d) => d.left < a.right && a.left < d.right && d.top < a.bottom + 8 && a.top < d.bottom);
    if (!hit.length) return;
    const top = Math.min(...hit.map((d) => d.top)) - 8 - a.height;
    plate.style.top = `${Math.round(Math.max(0, top - this.root.getBoundingClientRect().top))}px`;
  }

  /** Until this time (performance.now) the tray holds back your set-aside flowers; Infinity holds the whole hand (the shuffle). */
  private trayHold = 0;
  private holdTrayBonus(ms: number) {
    this.trayHold = performance.now() + ms;
    if (ms > 0) window.setTimeout(() => !this.aborted && (this.renderTray(), this.refreshHud()), ms + 20);
  }

  private renderTray() {
    if (this.drag?.active) {
      // Never pull the tiles out from under a drag; it redraws when it ends.
      return;
    }
    const tray = clear(this.els.tray);
    this.trayCompact = this.table.tray;
    // Watchers never see a player's concealed tiles.
    if (!this.table.tray || this.spectator) return;
    const g = this.game;
    const ph = g.state.phase;
    const drawnId = ph.kind === 'turn' && ph.drawn && ph.seat === this.me ? ph.drawn.id : -1;
    this.traySlots = this.trayHold === Infinity ? [] : arrangeHand(g.players[this.me].hand.filter((t) => t.id !== this.heldDraw), this.handLayout());
    tray.classList.toggle('grouped', this.traySlots.some((x) => x.set >= 0));
    for (const slot of this.traySlots) {
      const t = slot.tile;
      const img = tileImg(t.kind, '', this.settings.labels, isRed(g.state, t.id));
      const live = this.table.interactive.has(t.id);
      const b = h('button', { class: 'tray-tile', 'aria-label': tileLabel(t.kind) + (t.id === drawnId ? tr(' (just drawn)') : ''), 'data-id': String(t.id), 'aria-disabled': live ? null : 'true' }, img);
      if (slot.gap) b.classList.add(slot.gap === 2 ? 'gap-set' : 'gap-suit');
      if (slot.set >= 0) b.classList.add('in-set');
      if (t.id === drawnId) {
        b.classList.add('drawn');
        b.append(h('span', { class: 'new-mark', 'aria-hidden': 'true' }, 'new'));
      }
      if (t.id === this.table.selectedId || this.table.selectedIds.has(t.id)) b.classList.add('selected');
      if (this.table.hintKind === t.kind) b.classList.add('hint');
      else if (this.table.matchKind === t.kind) b.classList.add('match');
      else if (this.table.riskKinds.has(t.kind)) b.classList.add('risk');
      else if (this.table.ppIds.has(t.id)) b.classList.add('pp');
      if (!live) b.classList.add('off');
      b.onclick = () => {
        if (this.suppressClick) return;
        if (this.table.interactive.has(t.id)) this.table.onTileClick?.(t.id);
      };
      tray.append(b);
    }
    // Your revealed sets: on a short screen your rack (and its set ledge) gives way to this tray, so the sets show here.
    const sets = g.players[this.me].melds;
    // A short hand (sets called) fits one row of eight, so the tray stays low and the table keeps its room.
    tray.classList.toggle('one-row', this.traySlots.length <= 8);
    const extras = h('div', { class: 'tray-extras' });
    if (sets.length)
      extras.append(
        h('div', { class: 'tray-bonus tray-sets', title: tr('Your sets') }, h('span', {}, tr('Your sets')), ...sets.map((m) => h('span', { class: 'tray-set' }, ...m.tiles.map((t) => tileImg(t.kind, 'mini', this.settings.labels, isRed(g.state, t.id)))))),
      );
    // Bonus tiles you set aside (flowers, animals, Flower Jokers), on the same line as your sets.
    const bonus = performance.now() < this.trayHold ? [] : g.players[this.me].flowers;
    if (bonus.length) extras.append(h('div', { class: 'tray-bonus', title: bonus.map((f) => tileLabel(f.kind)).join(', ') }, h('span', {}, tr('Set aside')), ...bonus.map((f) => tileImg(f.kind, 'mini', this.settings.labels))));
    if (extras.childElementCount) tray.append(extras);
    this.wireTrayDrag(tray);
  }

  /** Drag a tray tile to a new place (mouse or touch). A tap without movement still selects. */
  private wireTrayDrag(tray: HTMLElement) {
    if (tray.dataset.wired) return;
    tray.dataset.wired = '1';
    const tileAt = (x: number, y: number) => {
      const others = [...tray.querySelectorAll<HTMLElement>('.tray-tile')].filter((el) => el !== this.drag?.el);
      let best: { el: HTMLElement; d: number; after: boolean } | null = null;
      for (const el of others) {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        // Rows count for more than columns, so the drop lands on the row you point at.
        const d = Math.abs(x - cx) + Math.abs(y - cy) * 2;
        if (!best || d < best.d) best = { el, d, after: x > cx };
      }
      return best;
    };
    const clearMarks = () => tray.querySelectorAll('.drop-before, .drop-after').forEach((el) => el.classList.remove('drop-before', 'drop-after'));
    tray.addEventListener('pointerdown', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('.tray-tile');
      if (!el || (e.pointerType === 'mouse' && e.button !== 0)) return;
      this.suppressClick = false;
      this.drag = { id: Number(el.dataset.id), x: e.clientX, y: e.clientY, active: false, el, target: null };
    });
    tray.addEventListener('pointermove', (e) => {
      const d = this.drag;
      if (!d) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.active) {
        if (Math.hypot(dx, dy) < 8) return;
        d.active = true;
        d.el.classList.add('dragging');
        tray.classList.add('reordering');
        try {
          tray.setPointerCapture(e.pointerId);
        } catch {
          /* pointer already gone */
        }
      }
      e.preventDefault();
      d.el.style.transform = `translate(${dx}px, ${dy}px) scale(1.08)`;
      clearMarks();
      const hit = tileAt(e.clientX, e.clientY);
      d.target = hit ? { id: Number(hit.el.dataset.id), after: hit.after } : null;
      hit?.el.classList.add(hit.after ? 'drop-after' : 'drop-before');
    });
    const end = (commit: boolean) => {
      const d = this.drag;
      this.drag = null;
      if (!d) return;
      clearMarks();
      tray.classList.remove('reordering');
      if (!d.active) return;
      // The click that follows a drag must not discard the tile.
      this.suppressClick = true;
      setTimeout(() => (this.suppressClick = false), 0);
      d.el.classList.remove('dragging');
      d.el.style.transform = '';
      if (commit && d.target) {
        const ids = this.traySlots.map((x) => x.tile.id).filter((id) => id !== d.id);
        const to = ids.indexOf(d.target.id) + (d.target.after ? 1 : 0);
        this.customOrder = moveTile(this.traySlots, d.id, to);
        sound.play('click');
        this.pushLayout();
        this.table.layout(this.viewState(), {});
      }
      this.renderTray();
    };
    tray.addEventListener('pointerup', () => end(true));
    tray.addEventListener('pointercancel', () => end(false));
    tray.addEventListener('lostpointercapture', () => this.drag?.active && end(true));
  }

  // ------------------------------------------------------------ JongBot

  private lastHint: Hint | null = null;
  /** Rebuilds the current hint at another depth, so the panel can switch between its three views. */
  private hintSrc: ((d: HintDepth) => Hint | null) | null = null;

  /** Compute and show a hint, keeping the recipe so the What / Why / Analyse tabs can redo it. */
  private showHint<T extends Hint | null>(src: (d: HintDepth) => T): T {
    this.hintSrc = src;
    // A card opened from the dock bar stays open, in full, until you close it.
    this.botOpen = this.hudMode === 'phone' && this.botShown;
    const hint = src(this.settings.hintDepth);
    this.renderHint(hint);
    return hint;
  }

  /** Switch JongBot between "What should I do?", "Why?" and "Analyse my hand" in place, and remember the choice. */
  private setHintDepth(d: HintDepth) {
    if (d === this.settings.hintDepth) return;
    this.settings.hintDepth = d;
    this.hooks.saveSettings?.();
    const hint = this.hintSrc?.(d) ?? this.lastHint;
    if (hint) this.renderHint(hint);
    (this.els.bot.querySelector('.bot-tab.on') as HTMLElement | null)?.focus({ preventScroll: true });
  }

  private hintTabs(depth: HintDepth): HTMLElement {
    const order: [HintDepth, string, string][] = [
      ['beginner', tr('What should I do?'), tr('Do')],
      ['learning', tr('Why?'), tr('Why?')],
      ['advanced', tr('Analyse my hand'), tr('Analyse')],
    ];
    const at = order.findIndex(([d]) => d === depth);
    const step = (k: number) => this.setHintDepth(order[(at + k + order.length) % order.length][0]);
    const tabs = h(
      'div',
      { class: 'bot-tabs', role: 'tablist', 'aria-label': tr('JongBot help') },
      h('button', { type: 'button', class: 'bot-step', 'aria-label': tr('Previous'), title: tr('Previous'), onclick: () => step(-1) }, '‹'),
      ...order.map(([d, long, short]) =>
        h('button', { type: 'button', role: 'tab', class: `bot-tab ${d === depth ? 'on' : ''}`, 'aria-selected': String(d === depth), tabindex: d === depth ? '0' : '-1', 'data-short': short, onclick: () => this.setHintDepth(d) }, h('span', { class: 'bot-tab-l' }, long), h('span', { class: 'bot-tab-s', 'aria-hidden': 'true' }, short)),
      ),
      h('button', { type: 'button', class: 'bot-step', 'aria-label': tr('Next'), title: tr('Next'), onclick: () => step(1) }, '›'),
    );
    tabs.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        step((e.key === 'ArrowRight') !== (document.dir === 'rtl') ? 1 : -1);
      }
    });
    return tabs;
  }

  private renderHint(hint: Hint | null) {
    this.lastHint = hint;
    if (!hint) this.hintSrc = null;
    this.refreshDock();
    const bot = clear(this.els.bot);
    this.table.hintKind = null;
    if (!hint) {
      bot.hidden = true;
      return;
    }
    bot.hidden = false;
    // Upright screens: the dock bar carries the advice; the card opens from its JongBot button.
    const phone = this.hudMode === 'phone';
    if (phone && !this.botShown) {
      bot.hidden = true;
      if (this.hintsOn) this.table.hintKind = hint.focusKind ?? null;
      return;
    }
    const grip = () => cardGrip(bot, () => `bot.${this.hudMode}`, () => this.placeDock());
    const shut = () => (phone ? h('button', { type: 'button', class: 'bot-close', title: tr('Close'), 'aria-label': tr('Close'), onclick: () => this.toggleBotCard(false), html: icon('close') }) : null);
    if (!this.hintsOn) {
      bot.classList.add('collapsed');
      bot.append(h('button', { class: 'bot-open', onclick: () => ((this.hintsOn = true), this.renderHint(hint), this.resync()) }, h('span', { class: 'bot-mark' }, '◆'), tr('JongBot')));
      return;
    }
    bot.classList.remove('collapsed');
    const depth = this.settings.hintDepth;
    const speak = () => {
      if (!narrator.enabled) narrator.setEnabled(true);
      // Mei's recorded pieces; a device voice (picked in Settings) reads the whole hint.
      void narrator.sayParts(hintSpoken(hint, this.claimWord(hint)).parts, [hint.headline, hint.why, hint.warning].filter(Boolean).join(' '));
    };
    this.table.hintKind = hint.focusKind ?? null;
    // By default JongBot is one line: its mark, the advice and a speaker. Tap the line for the tabs, the reasons and Hide hints.
    bot.classList.toggle('compact', !this.botOpen);
    if (!this.botOpen) {
      bot.classList.remove('deep');
      bot.append(
        h(
          'div',
          { class: 'bot-row' },
          grip(),
          h(
            'button',
            { type: 'button', class: 'bot-more', 'aria-expanded': 'false', title: tr('More from JongBot: why, analysis and options'), onclick: () => ((this.botOpen = true), this.renderHint(hint)) },
            h('span', { class: 'bot-mark', 'aria-hidden': 'true' }, '◆'),
            h('span', { class: 'bot-line', dir: 'auto' }, hint.headline),
            hint.warning ? h('span', { class: 'bot-warn-dot', title: hint.warning, 'aria-label': hint.warning }, '!') : null,
          ),
          h('button', { type: 'button', class: 'bot-say', title: tr('Read this hint aloud'), 'aria-label': tr('Read this hint aloud'), onclick: speak, html: icon('speaker') }),
          shut(),
        ),
      );
      return;
    }
    bot.classList.toggle('deep', depth !== 'beginner');
    bot.append(
      h(
        'div',
        { class: 'bot-head' },
        grip(),
        h('span', { class: 'bot-mark' }, '◆'),
        tr('JongBot'),
        h('button', { type: 'button', class: 'bot-less', 'aria-expanded': 'true', title: tr('Back to one line'), 'aria-label': tr('Back to one line'), onclick: () => ((this.botOpen = false), this.renderHint(hint)), html: icon('chevronDown') }),
        shut(),
      ),
      this.hintTabs(depth),
      h('p', { class: 'bot-line', dir: 'auto' }, hint.headline),
    );
    if (hint.why && (depth !== 'beginner' || this.showWhy)) bot.append(h('p', { class: 'bot-why', dir: 'auto' }, hint.why));
    if (hint.warning) bot.append(h('p', { class: 'bot-warn', dir: 'auto' }, hint.warning));
    if (hint.callCheck) bot.append(h('p', { class: 'bot-call', dir: 'auto' }, hint.callCheck));
    if (hint.table) {
      const t = h('table', { class: 'bot-table' }, h('thead', {}, h('tr', {}, h('th', {}, tr('Discard')), h('th', {}, tr('Leaves you')), h('th', {}, tr('Helpful')), h('th', {}, tr('Risk')))));
      const tb = h('tbody');
      for (const row of hint.table) tb.append(h('tr', {}, h('td', {}, row.tile), h('td', {}, row.away), h('td', { class: 'num' }, String(row.helpful)), h('td', {}, row.risk)));
      t.append(tb);
      bot.append(h('div', { class: 'bot-table-wrap' }, t));
    }
    // The target hands still open, and what the others' sets say to hold back.
    if (hint.targets?.plans.length) {
      const labels = this.settings.labels;
      const list = h('div', { class: 'bot-pp' }, h('div', { class: 'bot-pp-title' }, tr(hint.targets.title)));
      for (const p of hint.targets.plans.slice(0, 3)) {
        const name = passportNames(p.names);
        const extra = [p.sets ? trn(p.sets, '{n} more set', '{n} more sets') : '', p.pair ? tr('a pair') : '', p.note ? tr(p.note) : ''].filter(Boolean).join(', ');
        const tiles = h('div', { class: 'bot-pp-tiles' });
        p.pieces.forEach((piece, i) => {
          const g = h('span', { class: 'bot-pp-piece' });
          piece.forEach((k, j) => {
            const img = tileImg(k, 'mini', labels);
            if (j >= piece.length - p.gaps[i]) img.classList.add('need');
            g.append(img);
          });
          tiles.append(g);
        });
        const left = p.need.length ? tr('Still to find: {tiles}', { tiles: p.need.map((x) => (x.left < 0 ? tileLabel(x.kind) : `${tileLabel(x.kind)} (${tr('{n} left', { n: x.left })})`)).join(', ') }) : '';
        const how = !p.pieces.length && p.how ? h('div', { class: 'bot-pp-left' }, tr(p.how)) : null;
        list.append(h('div', { class: 'bot-pp-row' }, h('div', { class: 'bot-pp-name' }, h('b', {}, name), extra ? (p.sets || p.pair ? ` + ${extra}` : ` · ${extra}`) : '', h('span', { class: 'bot-pp-away' }, passportAway(p.shanten))), p.pieces.length ? tiles : null, how, left ? h('div', { class: 'bot-pp-left' }, left) : null));
      }
      bot.append(list);
    }
    if (hint.keepBack?.length) bot.append(h('div', { class: 'bot-pp bot-keep' }, h('div', { class: 'bot-pp-title' }, tr('Hold back')), ...hint.keepBack.map((l) => h('p', { class: 'bot-why', dir: 'auto' }, l))));
    const fullWhy = depth === 'beginner' && hint.why && !this.showWhy;
    bot.append(
      h(
        'div',
        { class: 'bot-btns' },
        h(
          'button',
          {
            class: 'link bot-speak',
            title: tr('Read this hint aloud'),
            'aria-label': tr('Read this hint aloud'),
            onclick: speak,
          },
          tr('🔊 Speak'),
        ),
        fullWhy ? h('button', { class: 'link', onclick: () => ((this.showWhy = true), this.renderHint(hint)) }, tr('Show me why')) : null,
        h('button', { class: 'link', onclick: () => ((this.hintsOn = false), this.renderHint(hint), this.resync()) }, tr('Hide hints')),
      ),
    );
    this.showWhy = false;
  }

  private resync() {
    this.updateMatchKind();
    this.targetMarks();
    this.table.layout(this.viewState(), {});
    this.renderTray();
  }

  // ------------------------------------------------------------ events → sound / toasts

  /**
   * The engine records an on-the-spot payment (bite, kong money) just after the
   * event that caused it, in the same step, so look once that step has finished.
   */
  private announceInstant(seat: number, why: string, coach?: 'bite' | 'kong') {
    if (!this.game.profile.instantPayments) return;
    const g = this.game;
    const before = g.state.instant?.length ?? 0;
    queueMicrotask(() => {
      const added = (g.state.instant ?? []).slice(before);
      if (!added.length || this.aborted || this.catchingUp()) return;
      const total = added.reduce((a, p) => a + p.amount, 0);
      const who = seat === this.you ? tr('You collect') : tr('{name} collects', { name: g.players[seat].name });
      this.toast(why ? why.toUpperCase() : tr('PAID ON THE SPOT'), tr('{who} {n} now', { who, n: fmt(total) }));
      sound.play('score');
      this.refreshHud();
      if (coach) this.coach?.instantPaid(coach, seat === this.me, `${who} ${fmt(total)}`);
    });
  }

  private onEvent(e: GameEvent) {
    const name = (s: number) => (s === this.you ? tr('You') : this.game.players[s].name);
    switch (e.type) {
      case 'draw':
        if (e.seat === this.me) sound.play('draw');
        break;
      case 'discard':
        sound.play('discard');
        this.tea.onDiscard(this.game.state.log.reduce((n, x) => n + (x.type === 'discard' ? 1 : 0), 0));
        this.showLastDiscard(e.seat, e.tile.kind);
        if (this.coach && e.seat !== this.me) setTimeout(() => this.coach?.otherDiscard(), 1100);
        if (e.riichi) this.coach?.riichi(e.seat === this.me);
        if (this.announcing()) {
          if (e.riichi) {
            callers.say(e.seat, this.game.profile.callNames.riichi ?? tr('Riichi'));
            const kind = e.tile.kind;
            const seat = e.seat;
            setTimeout(() => !this.aborted && callers.tile(seat, kind), 750);
          } else callers.tile(e.seat, e.tile.kind);
        }
        if (e.riichi) {
          sound.play('riichi');
          if (e.seat === this.me) this.stats.riichis++;
          this.toast(tr(this.game.profile.callNames.riichi ?? 'Riichi').toUpperCase(), e.seat === this.me ? tr('You declare a ready hand') : tr('{name} declares a ready hand', { name: name(e.seat) }));
        }
        break;
      case 'dora':
        this.toast(tr('NEW DORA'), tr('{tile} is now dora', { tile: tileLabel(this.game.profile.doraFromIndicator!(e.indicator.kind)) }));
        this.coach?.newDora(`${tileName(this.game.profile.doraFromIndicator!(e.indicator.kind))} is now dora`);
        break;
      case 'buy':
        sound.play('draw');
        this.toast(tr('BUY'), e.seat === this.me ? tr('You buy the {tile} for {n}', { tile: tileLabel(e.tile.kind), n: e.price }) : tr('{name} buys the {tile} for {n}', { name: name(e.seat), tile: tileLabel(e.tile.kind), n: e.price }));
        this.els.last.hidden = true;
        break;
      case 'call':
        if (e.claim === 'buy') break;
        // Big Cards: a group laid down from the hand (or grown) draws its extra tiles.
        if (this.game.profile.big && e.meld.from === undefined) {
          sound.play('kong');
          const what = e.meld.big === 'qwong' ? tr('Qwong') : e.meld.big === 'run' ? tr('Run') : tr('Kong');
          this.toast(what.toUpperCase(), e.seat === this.me ? tr('You lay down {tiles}', { tiles: e.meld.tiles.map((x) => tileLabel(x.kind)).join(' ') }) : tr('{name} lays down {tiles}', { name: name(e.seat), tiles: e.meld.tiles.map((x) => tileLabel(x.kind)).join(' ') }));
          this.els.last.hidden = true;
          break;
        }
        sound.play(e.claim === 'kong' ? 'kong' : e.claim === 'chow' ? 'chow' : 'pung');
        if (this.announcing()) callers.say(e.seat, this.game.profile.callNames[e.claim]);
        this.toast(tr(this.game.profile.callNames[e.claim === 'win' ? 'win' : e.claim]).toUpperCase(), tr(e.seat === this.me ? (e.claim === 'chow' ? 'You call {tile} run' : 'You call {tile}') : e.claim === 'chow' ? '{name} calls {tile} run' : '{name} calls {tile}', { name: name(e.seat), tile: tileLabel(e.meld.tiles[0].kind) }));
        if (e.seat === this.me) this.stats.calls++;
        if (e.claim === 'kong') this.announceInstant(e.seat, e.meld.concealed ? tr('Concealed kong money') : tr('Kong money'), 'kong');
        if (this.coach && e.claim !== 'win') {
          if (e.seat === this.me) this.coachAfterClaim = true;
          else setTimeout(() => this.coach?.otherClaimed(), 900);
        }
        this.els.last.hidden = true;
        break;
      case 'flower': {
        sound.play('draw');
        const kind = e.tile.kind;
        if (kind === this.game.profile.nukiDora) this.toast(tr('KITA'), e.seat === this.me ? tr('You set a North aside as dora') : tr('{name} sets a North aside as dora', { name: name(e.seat) }));
        else if (e.seat === this.me) this.toast(isFlower(kind) ? tr('FLOWER') : isAnimal(kind) ? tr('ANIMAL') : tr('BONUS TILE'), tr('{tile} set aside. You draw a replacement', { tile: tileLabel(kind) }));
        this.announceInstant(e.seat, isAnimal(kind) ? biteName(kind, this.game.players[e.seat].flowers.map((f) => f.kind)) : '', isAnimal(kind) ? 'bite' : undefined);
        if (e.seat === this.me) this.coach?.bonusTile(kind);
        break;
      }
      case 'handStart':
        this.els.last.hidden = true;
        this.customOrder = null;
        this.ppChoice = null;
        this.pushLayout();
        this.coach?.handStart({ house: this.houseSummary() });
        break;
      case 'win':
        sound.play('mahjong');
        if (this.announcing()) callers.say(e.seat, e.selfDrawn ? this.game.profile.callNames.selfDraw : this.game.profile.callNames.win);
        this.els.last.hidden = true;
        if (this.coach) setTimeout(() => this.coach?.handEnd(e.seat === this.me ? 'you' : 'other'), 1000);
        break;
      case 'exhausted':
        this.els.last.hidden = true;
        this.coach?.handEnd('draw');
        break;
      case 'abortive':
        this.els.last.hidden = true;
        this.toast(tr('ABORTIVE DRAW'), tr(ABORTIVE_NAMES[e.reason]));
        this.coach?.handEnd('draw');
        break;
    }
  }

  /** Guided game: Mei, when she may speak (never while a live table catches up). */
  private get coach() {
    return this.opts.coach && this.announcing() ? this.opts.coach : undefined;
  }

  /** This table's house rules in a line, for Mei's caption. */
  private houseSummary() {
    const p = this.game.profile;
    const c = p.houseChoices ?? {};
    return p.houseRules
      .map((r) => {
        const o = r.options.find((x) => x.value === (c[r.id] ?? r.default));
        return o ? `${tr(r.label)}: ${tr(o.label).replace(/\s*\(.*\)$/, '')}` : '';
      })
      .filter(Boolean)
      .join(' · ');
  }

  /** Players call out tiles and claims live, never while a live table catches up. */
  private announcing() {
    return !this.aborted && !this.catchingUp();
  }

  // ------------------------------------------------------------ main loop

  async run() {
    this.table.setView('seat', 1.6);
    // Four distinct voices, fixed by the match seed so every client hears the same table.
    callers.assign(this.matchSeed, this.seats.length);
    const resume = this.opts.resume;
    if (resume) {
      this.handNo = resume.hand;
      this.game.state.round = resume.round;
      this.game.players.forEach((p, i) => (p.score = resume.scores[i] ?? p.score));
      this.game.state.riichiPot = resume.pot;
    }
    while (!this.aborted) {
      this.handLog = [];
      if (this.opts.link) {
        // Live tables reseed every AI per hand, so a spectator who joins at hand n
        // (and a seat handed to an AI) computes the same moves as everyone else.
        this.ais = this.seats.map((x, i) => new AiPlayer(i, x.difficulty ?? this.config.difficulty, x.personality ?? 'zen', handSeed(this.matchSeed + i * 101, this.handNo)));
      }
      this.handStartScores = this.game.players.map((p) => p.score);
      this.game.startHand(handSeed(this.matchSeed, this.handNo));
      this.tea.startHand(this.handNo);
      this.opts.link?.handStarted(this.handNo, this.game);
      // The new walls rise closed; East's throw breaks them (runOpening).
      const ceremony = this.settings.speed !== 'minimal' && this.announcing() && !this.opts.coach;
      this.table.wallOpen = !ceremony;
      this.table.wallEnds = false;
      if (this.settings.speed !== 'minimal') {
        sound.play('shuffle');
        // The automatic table sweeps the last hand away and raises the new walls (render/machine.ts).
        const ms = this.table.machineShuffle({ ...this.game.state, players: this.game.players.map((p) => ({ ...p, hand: [], flowers: [] })), drawnFromFront: 0, drawnFromBack: 0, phase: { kind: 'turn', seat: -1, drawn: null, afterKong: false, mustDiscardOnly: true } });
        // Nothing of the new hand shows in the tray until it is dealt.
        this.trayHold = Infinity;
        this.refreshHud();
        await sleep(ms);
      }
      // The opening (src/ui/opening.ts): the throw for East at the first hand, then East's throw breaks the wall.
      const eastRounds = this.handNo === 0 ? this.eastRounds : undefined;
      this.eastRounds = undefined;
      if (ceremony)
        await runOpening(
          { root: this.root, table: this.table, names: this.game.players.map((p) => p.name), me: this.you, pace: this.settings.speed === 'cinematic' ? 0.85 : 1,
            eastRounds,
            pulseSeat: (seat, n) => {
              const plate = this.els.seats[this.rel(seat)];
              if (!plate) return;
              const c = h('div', { class: 'op-seat-count' }, String(n));
              plate.append(c);
              window.setTimeout(() => c.remove(), 700);
            },
          },
          this.game.state,
        );
      else this.table.breakWall();
      // Dealt flowers reach the tray's "Set aside" once the deal is done, as they leave the rack on the table.
      this.holdTrayBonus(this.settings.speed === 'minimal' ? 0 : 2900);
      if (this.aborted) return;
      this.sync({ dealing: true });
      sound.play('slide');
      await sleep(this.settings.speed === 'minimal' ? 250 : this.settings.speed === 'cinematic' ? 2300 : 1500);
      // The front and back marks were for the opening; the marked section's token stays for the hand.
      this.table.wallEnds = false;
      const rl = roundLabel(this.game.profile.rounds, this.game.state.round);
      this.toast(rl.round, this.game.dealer === this.me && !this.spectator ? tr('You are the dealer') : tr('{name} is the dealer', { name: this.game.players[this.game.dealer].name }));
      const nat = this.game.profile.naturalWild;
      const wildKind = this.game.state.wildKinds?.[0];
      if (nat && wildKind !== undefined) {
        await sleep(this.catchingUp() ? 0 : 1400);
        this.toast(tr(nat.name).toUpperCase(), tr('Wild this hand: {tile}', { tile: tileName(wildKind) }));
      }
      // Special wind rounds: a new wind brings new rules, so say which and rebuild the guide.
      const special = this.game.profile.specialRound as SpecialRoundId | undefined;
      if (special !== this.specialRound) {
        this.specialRound = special;
        this.guide.reset();
        this.calc.reset();
        this.refreshHud();
        if (special) {
          await sleep(this.catchingUp() ? 0 : 1400);
          this.toast(tr(SPECIAL_ROUNDS[special].name).toUpperCase(), tr(SPECIAL_ROUNDS[special].rule));
          await sleep(this.catchingUp() ? 0 : 3200);
        }
      }
      await this.playHand();
      if (this.aborted) return;
      const ph = this.game.state.phase;
      if (ph.kind !== 'handOver') return;
      this.record.push(this.handLog);
      this.stats.handsPlayed++;
      this.handNo++;
      const label = roundLabel(this.game.profile.rounds, this.game.state.round).round;
      // Show the result against this hand's dealer and round, then move on.
      this.hooks.onHand?.(ph.result, this.game, this.you);
      const over =
        this.game.willEnd() ||
        (this.opts.maxHands !== undefined && this.handNo >= this.opts.maxHands) ||
        // Live tables never play timed (each client has its own clock; see liveSafeLength).
        (!this.opts.link && timedMatchOver(this.config.length, this.startedAt, Date.now(), this.game.state.round, this.game.peekNextRound()));
      await this.showHandResult(ph.result, over, label);
      if (this.aborted) return;
      this.game.advance();
      if (over) break;
    }
    if (!this.aborted) this.finish();
  }

  /** Apply one decision: record it, share it if it is ours, then play it. */
  private commit(a: Action) {
    if (this.aborted) return;
    const index = this.handLog.length;
    this.handLog.push(a);
    if (this.seats[a.s].kind === 'local' && !this.sharedEarly.delete(`${this.handNo}/${index}`)) this.opts.link?.publish(this.handNo, index, a);
    if (a.t === 'd' && this.seats[a.s].kind === 'local') this.trackAccuracy(a);
    applyAction(this.game, a);
  }

  /**
   * Charleston passes and votes are gathered from all four seats before any is
   * committed, so share ours now (at the index it will be committed at) or two
   * live players would each wait for the other forever.
   */
  private shareEarly(index: number, a: Action) {
    if (!this.opts.link) return;
    this.sharedEarly.add(`${this.handNo}/${index}`);
    this.opts.link.publish(this.handNo, index, a);
  }

  /** Compare your discard with the most efficient one, for the accuracy stat. */
  private trackAccuracy(a: Extract<Action, { t: 'd' }>) {
    const g = this.game;
    if (g.profile.card) return;
    const tile = g.players[a.s].hand.find((t) => t.id === a.id);
    if (!tile) return;
    const evals = evaluateDiscards(g, a.s);
    const minSh = Math.min(...evals.map((e) => e.shanten));
    const bestUke = Math.max(...evals.filter((e) => e.shanten === minSh).map((e) => e.ukeire));
    const mine = evals.find((e) => e.kind === tile.kind);
    if (!mine) return;
    this.stats.decisions++;
    if (mine.shanten === minSh && mine.ukeire >= bestUke * 0.85) this.stats.goodDecisions++;
  }

  /** Wait for a remote player's decision (or take over with AI if they left). */
  private async remote<T extends Action>(seat: number, index = this.handLog.length): Promise<T | null> {
    const link = this.opts.link;
    if (!link) return null;
    const got = await link.next(seat, this.handNo, index);
    if (this.aborted) return null;
    if (got === 'ai') {
      this.seats[seat].kind = 'ai';
      this.toast(tr('SEAT TAKEN OVER'), tr('{name} left. An AI player continues for them', { name: this.game.players[seat].name }));
      this.refreshHud();
      return null;
    }
    return got as T;
  }

  private async playHand() {
    const g = this.game;
    while (!this.aborted) {
      const ph = g.state.phase;
      if (ph.kind === 'handOver') return;
      this.sync();
      if (ph.kind === 'charleston') await this.charlestonStage();
      else if (ph.kind === 'charlestonVote') await this.charlestonVote();
      else if (ph.kind === 'exchangeChoice') await this.exchangeChoice(ph.seat);
      else if (ph.kind === 'wallExchange') await this.wallExchangeStage();
      else if (ph.kind === 'ticTacToe') await this.ticTacToeStage();
      else if (ph.kind === 'cardPick') await this.cardPickStage();
      else if (ph.kind === 'roundChoice') await this.roundChoiceStage(ph.seat);
      else if (ph.kind === 'turn') {
        const seat = ph.seat;
        const kind = this.seats[seat].kind;
        let a: Action | null = null;
        if (kind === 'local') a = await this.humanTurn();
        else if (kind === 'remote') {
          this.markWaiting(seat);
          a = await this.remote(seat);
          this.markWaiting(-1);
          if (!a && !this.aborted && this.isAi(seat)) a = await this.aiTurn(seat);
        } else a = await this.aiTurn(seat);
        if (a && !this.aborted) {
          this.commit(a);
          // Let the discard land and be called out before the next player moves.
          if (a.t === 'd' && g.state.phase.kind !== 'handOver') await this.beat();
        }
      } else if (ph.kind === 'claims') {
        // Everyone answers in seat order, so every client applies the same sequence.
        const from = this.handLog.length;
        for (const s of g.pendingClaimSeats()) {
          const cur = g.state.phase;
          if (cur.kind !== 'claims' || this.aborted) break;
          const kind = this.seats[s].kind;
          let r: ClaimResponse | null = null;
          if (kind === 'local') r = await this.humanClaim(cur.options[s], cur.tile.kind);
          else if (kind === 'remote') {
            this.markWaiting(s);
            const a = await this.remote<Extract<Action, { t: 'c' }>>(s);
            this.markWaiting(-1);
            r = a ? a.r : null;
          }
          if (!r && this.isAi(s)) r = this.ais[s].decideClaim(g, cur.options[s], cur.tile.kind);
          if (r && !this.aborted) this.commit({ t: 'c', s, r });
        }
        // A call gets the same breathing room as a discard; a round of passes just a moment.
        const called = this.handLog.slice(from).some((x) => x.t === 'c' && x.r.type !== 'pass' && x.r.type !== 'win');
        if (called && g.state.phase.kind !== 'handOver') await this.beat();
        else if (!this.catchingUp()) await sleep(THINK[this.settings.speed] * 0.3);
      }
    }
  }

  /** Live: this client (a late spectator, a slow device) is behind the table, so skip AI pauses. */
  private catchingUp() {
    return !!this.opts.link?.behind(this.handNo, this.handLog.length);
  }

  /** Show who the table is waiting for. */
  private markWaiting(seat: number) {
    this.els.seats.forEach((el, i) => el.classList.toggle('waiting', seat >= 0 && i === this.rel(seat)));
  }

  private async aiTurn(seat: number): Promise<Action | null> {
    const g = this.game;
    const ai = this.ais[seat];
    if (!this.catchingUp()) await sleep(this.aiPause(seat));
    if (this.aborted) return null;
    const d = ai.decideTurn(g);
    if (d.action === 'win') return { t: 'w', s: seat };
    if (d.action === 'kong') return { t: 'k', s: seat, k: d.kind! };
    if (d.action === 'abort' || d.action === 'kita' || d.action === 'group') return decisionAction(seat, d);
    if (d.action === 'swap') {
      this.bubble(seat, tr('Joker swap!'));
      return { t: 'j', s: seat, o: d.swap!.owner, m: d.swap!.meld, id: d.swap!.tileId };
    }
    if (d.riichi) this.bubble(seat, `${tr(g.profile.callNames.riichi ?? 'Riichi')}!`);
    else if (ai.personality === 'teacher' && Math.random() < 0.3) this.bubble(seat, this.teacherRemark(seat, d.kind!));
    return d.riichi ? { t: 'd', s: seat, id: d.tileId!, r: 1 } : { t: 'd', s: seat, id: d.tileId! };
  }

  /**
   * A person's thinking time for an AI turn: about 1 second at the default speed (the user's
   * choice, 2026-10-30; it was 1.1 to 2.2 s), a touch quicker or slower by personality and
   * level, and a little longer for a harder decision (a kong, riichi, a joker swap or a win).
   */
  private aiPause(seat: number) {
    const g = this.game;
    const ai = this.ais[seat];
    const opts = g.turnOptions(seat);
    let ms = 900 + Math.random() * 200 + ((PERSONALITY_PAUSE[ai.personality] ?? 0) + (DIFFICULTY_PAUSE[ai.difficulty] ?? 0)) / 4;
    if (opts.kongs.length || opts.riichiDiscards.length || opts.jokerSwaps.length || opts.canWin) ms += 150;
    else if (!g.profile.card && currentShanten(g, seat) <= 1) ms += 80;
    return Math.min(AI_PAUSE_MAX, Math.max(AI_PAUSE_MIN, ms)) * PACE[this.settings.speed];
  }

  /** A short beat after a discard or a call, so the tile is seen and its name heard before anyone else acts. */
  private async beat() {
    if (this.catchingUp() || this.aborted) return;
    await sleep((600 + Math.random() * 300) * PACE[this.settings.speed]);
  }

  private teacherRemark(seat: number, kind: number): string {
    const ev = evaluateDiscards(this.game, seat).find((e) => e.kind === kind);
    const n = tileLabel(kind);
    if (ev && ev.shanten === 0) return tr('I’m nearly there, so the {tile} goes.', { tile: n });
    if (isHonor(kind)) return tr('A lone {tile} can only become a pair or pung, so I let it go early.', { tile: n });
    if (ev && ev.danger < 0.2) return tr('The {tile} is safe right now. Defence matters.', { tile: n });
    return tr('The {tile} doesn’t connect with my other tiles.', { tile: n });
  }

  /**
   * Wait for your decision. With a time limit (seconds) a thin brass ring
   * counts down beside the action bar, ticks softly in the last three
   * seconds, and `onTimeout` decides for you when it runs out. Solo tables
   * pause the clock while a sheet, Settings or another tab has your attention;
   * live tables never pause (everyone else is waiting too).
   */
  private waitHuman<T>(setup: (done: (v: T) => void) => void, onTimeout: () => T, limit = 0, kind: 'claim' | 'turn' = 'turn'): Promise<T> {
    return new Promise<T>((resolve) => {
      let finished = false;
      const ring = this.els.timer;
      const done = (v: T) => {
        if (finished) return;
        finished = true;
        window.clearInterval(this.timerHandle);
        window.cancelAnimationFrame(this.timerFrame);
        ring.hidden = true;
        ring.classList.remove('low');
        this.resolveHuman = undefined;
        resolve(v);
      };
      this.resolveHuman = () => done(undefined as T);
      setup(done);
      if (!this.catchingUp()) haptic(kind);
      if (limit > 0 && !this.catchingUp()) {
        const cd = new Countdown(limit * 1000, performance.now());
        ring.hidden = false;
        ring.dataset.kind = kind;
        ring.setAttribute('aria-label', kind === 'claim' ? tr('Time to claim: {n} seconds', { n: limit }) : tr('Time for your turn: {n} seconds', { n: limit }));
        const num = ring.querySelector('.t-num')!;
        const arc = ring.querySelector<SVGCircleElement>('.t-arc')!;
        let shown = -1;
        const step = (fromInterval = false) => {
          if (finished) return;
          const st = cd.step(performance.now(), this.clockPaused());
          arc.style.strokeDashoffset = String(RING_C * (1 - st.frac));
          if (st.left !== shown) {
            shown = st.left;
            num.textContent = String(st.left);
            ring.classList.toggle('low', st.low);
          }
          if (st.tick) sound.play('click');
          if (st.done) {
            const v = onTimeout();
            this.toast(tr('TIME'), kind === 'claim' ? tr('Passed for you') : tr('A tile was discarded for you'));
            if (kind === 'claim') this.speak({ parts: [{ line: LINES.timeClaim }], text: LINES.timeClaim });
            else this.speak({ parts: [{ line: LINES.timeTurn }], text: LINES.timeTurn });
            return done(v);
          }
          if (!fromInterval) this.timerFrame = window.requestAnimationFrame(() => step());
        };
        step();
        // rAF stops in a background tab; a slow interval keeps a live table's clock honest there.
        this.timerHandle = window.setInterval(() => !finished && document.hidden && step(true), 500);
      }
    });
  }

  private timerFrame = 0;
  /** Everyone's score as the current hand was dealt, to reconcile the summary rows with the bank. */
  private handStartScores?: number[];

  /** Solo tables stop the clock while something else has your attention. */
  private clockPaused() {
    if (this.opts.link) return false;
    const modal = document.getElementById('modal');
    return document.hidden || !this.els.overlay.hidden || !this.els.sheet.hidden || !!this.callWarn || (!!modal && !modal.hidden);
  }

  /** This table's claim and turn limits in seconds (0 = untimed). */
  private get limits() {
    if (this.opts.coach && !this.opts.coach.keepsPace) return { claim: 0, turn: 0 };
    return paceLimits(this.config);
  }

  /** Your turn limit: your first move of the hand (before your first discard) gets twice the time, at least 15 s. */
  private get turnLimit() {
    const turn = this.limits.turn;
    const me = this.me;
    return this.game.state.log.some((e) => e.type === 'discard' && e.seat === me) ? turn : firstTurnLimit(turn);
  }

  // ------------------------------------------------------------ drawing your tile

  /** The tile you have drawn but not yet taken: it stays shown in the wall until you tap Draw. */
  private heldDraw = -1;
  private releaseDraw: (() => void) | null = null;

  /** The table as you see it: while you have still to draw, the drawn tile waits in the wall. */
  private viewState(): GameState {
    const st = this.game.state;
    if (this.heldDraw < 0 || st.phase.kind !== 'turn') return st;
    const id = this.heldDraw;
    return { ...st, drawnFromFront: st.drawnFromFront - 1, phase: { ...st.phase, drawn: null }, players: st.players.map((p, i) => (i === this.me ? { ...p, hand: p.hand.filter((t) => t.id !== id) } : p)) };
  }

  /** Run fn on the table as you see it: a tile you have still to draw stays out of your hand (hand status, scores, calculator). */
  private asSeen<T>(fn: () => T): T {
    if (this.heldDraw < 0) return fn();
    const g = this.game,
      real = g.state;
    g.state = this.viewState();
    try {
      return fn();
    } finally {
      g.state = real;
    }
  }

  /** The tile the engine drew for you this turn, if it came from the front of the wall in the usual way (not a replacement, not the deal). */
  private drawableTile(): number {
    const g = this.game;
    const st = g.state;
    const ph = st.phase;
    if (ph.kind !== 'turn' || ph.seat !== this.me || !ph.drawn || ph.afterKong || ph.mustDiscardOnly) return -1;
    if (g.players[this.me].riichi || this.catchingUp() || this.spectator) return -1;
    // The dealer's fourteenth tile comes with the deal.
    if (!st.log.some((e) => e.type === 'discard')) return -1;
    if (st.drawnFromFront < 1 || st.wall[st.drawnFromFront - 1]?.id !== ph.drawn.id) return -1;
    return g.players[this.me].hand.some((t) => t.id === ph.drawn!.id) ? ph.drawn.id : -1;
  }

  /** Auto-draw on or off, from the table or Settings; remembered. Turning it on while a tile waits takes it. */
  private setAutoDraw(on: boolean) {
    this.settings.autoDraw = on;
    sound.play('click');
    this.hooks.saveSettings?.();
    this.refreshAutoDraw();
    if (on) this.releaseDraw?.();
  }

  private refreshAutoDraw() {
    const b = this.els.autoDraw;
    b.innerHTML = icon('auto');
    b.append(this.settings.autoDraw ? tr('Auto-draw: on') : tr('Auto-draw'));
    b.classList.toggle('on', !!this.settings.autoDraw);
    b.setAttribute('aria-pressed', String(!!this.settings.autoDraw));
    b.title = tr('Take each tile from the wall for you, or tap Draw yourself on your turn');
    b.hidden = this.spectator;
  }

  /** Your turn starts with taking a tile from the wall, unless auto-draw is on. */
  private async manualDraw() {
    const id = this.drawableTile();
    if (id < 0 || this.settings.autoDraw) return;
    this.heldDraw = id;
    this.table.interactive = new Set();
    this.table.selectedId = null;
    this.sync();
    const limit = this.turnLimit;
    await this.waitHuman<void>(
      (done) => {
        this.releaseDraw = () => done();
        const bar = clear(this.els.actions);
        this.coach?.drawPrompt();
        bar.append(h('button', { class: 'btn primary glow draw-btn', 'aria-keyshortcuts': 'D', title: tr('Take the next tile from the wall (D)'), onclick: () => done(), html: icon('draw') }, tr('Draw a tile')));
        // Clicking the wall draws too.
        this.table.onTileClick = () => done();
      },
      () => undefined,
      limit,
      'turn',
    );
    this.releaseDraw = null;
    this.heldDraw = -1;
    clear(this.els.actions);
    if (!this.aborted) sound.play('draw');
  }

  private async humanTurn(): Promise<Action | null> {
    const g = this.game;
    sound.play('turn');
    await this.manualDraw();
    if (this.aborted) return null;
    const opts = g.turnOptions(this.me);
    const t = this.table;
    t.interactive = new Set(opts.discards.map((x) => x.id));
    t.selectedId = null;
    const hint = this.showHint((d) => turnHint(g, this.me, d));
    this.sync();
    if (this.coach) {
      const hand = g.players[this.me].hand;
      this.coach.myTurn({
        ready: currentShanten(g, this.me) <= 0,
        canWin: opts.canWin,
        hint: this.hintsOn ? hint.headline : undefined,
        afterClaim: this.coachAfterClaim,
        dealer: g.dealer === this.me,
        canRiichi: opts.riichiDiscards.length > 0 && !g.players[this.me].riichi,
        canSwap: opts.jokerSwaps.length > 0,
        jokers: hand.filter((x) => (g.profile.card ? isJoker(x.kind) : g.isWild(x.kind))).length,
      });
    }
    this.coachAfterClaim = false;
    if (!g.players[this.me].riichi || opts.canWin) this.prompt(turnPrompt(opts.canWin, g.profile.callNames.selfDraw), hint);
    const ph = g.state.phase;
    const drawn = ph.kind === 'turn' ? ph.drawn : null;
    const names = g.profile.callNames;
    // In riichi the drawn tile goes straight back out unless it wins (or is a North to set aside).
    if (g.players[this.me].riichi && !opts.canWin && !opts.kita) {
      await sleep(THINK[this.settings.speed] * 0.6);
      t.interactive.clear();
      this.renderHint(null);
      return this.aborted ? null : { t: 'd', s: this.me, id: opts.discards[0].id };
    }
    let riichiMode = false;

    type Act = { kind: 'discard'; id: number; riichi?: boolean } | { kind: 'win' } | { kind: 'kong'; k: number } | { kind: 'group'; group: BigGroup } | { kind: 'swap'; swap: JokerSwap } | { kind: 'abort' } | { kind: 'kita' } | undefined;
    const act = await this.waitHuman<Act>(
      (done) => {
        const bar = clear(this.els.actions);
        if (opts.canWin) bar.append(h('button', { class: 'btn primary glow', onclick: () => done({ kind: 'win' }) }, `${tr(names.selfDraw)}!`));
        for (const sw of opts.jokerSwaps) {
          const mine = g.players[this.me].hand.find((x) => x.id === sw.tileId)!;
          const swapMeld = g.players[sw.owner].melds[sw.meld];
          const jokerShown = g.profile.big ? swapMeld.tiles.find((x) => x.id === swapMeld.wild?.find((w) => w.as === (mine.kind >= 34 ? 34 : mine.kind))?.id)?.kind ?? JOKER_KIND : JOKER_KIND;
          bar.append(h('button', { class: 'btn', title: sw.owner === this.me ? tr('Give your {tile} for the joker in your exposure', { tile: tileLabel(mine.kind) }) : tr('Give your {tile} for the joker in {name}’s exposure', { tile: tileLabel(mine.kind), name: g.players[sw.owner].name }), onclick: () => done({ kind: 'swap', swap: sw }) }, tileImg(mine.kind, 'mini', this.settings.labels), '⇄', tileImg(jokerShown, 'mini', this.settings.labels), tr('Swap')));
        }
        for (const k of opts.kongs) bar.append(h('button', { class: 'btn', onclick: () => done({ kind: 'kong', k }) }, tileImg(k, 'mini', this.settings.labels), tr(names.kong)));
        // Big Cards: groups to lay down, the fewest jokers first.
        const hand = g.players[this.me].hand;
        for (const gr of (opts.groups ?? []).slice().sort((a, b) => a.wild.length - b.wild.length).slice(0, 6)) {
          const label = gr.extend !== undefined ? (gr.type === 'qwong' ? tr('Make a qwong') : tr('Make a kong')) : gr.type === 'qwong' ? tr('Lay down a qwong') : gr.type === 'run' ? tr('Lay down a run') : tr('Lay down a kong');
          const tip = gr.extras ? tr('{label}: draw {n} extra from the flower wall', { label, n: gr.extras }) : label;
          bar.append(h('button', { class: 'btn group-btn', title: tip, onclick: () => done({ kind: 'group', group: gr }) }, ...gr.ids.map((id) => tileImg(hand.find((x) => x.id === id)!.kind, 'mini', this.settings.labels)), label));
        }
        if (opts.kita) bar.append(h('button', { class: 'btn', title: tr('Set the North aside as a bonus dora and draw a replacement'), onclick: () => done({ kind: 'kita' }) }, tileImg(g.profile.nukiDora!, 'mini', this.settings.labels), tr('Kita')));
        if (opts.nineTerminals) bar.append(h('button', { class: 'btn', title: tr('Nine different terminals and honours: call off this hand. The same dealer deals again.'), onclick: () => done({ kind: 'abort' }) }, tr('Nine terminals: redeal')));
        if (opts.riichiDiscards.length) {
          const rb = h('button', { class: 'btn riichi-btn' }, tr(names.riichi ?? 'Riichi'));
          rb.onclick = () => {
            riichiMode = !riichiMode;
            rb.classList.toggle('on', riichiMode);
            clear(rb).append(riichiMode ? tr('Cancel {call}', { call: tr(names.riichi ?? 'Riichi') }) : tr(names.riichi ?? 'Riichi'));
            t.interactive = new Set(riichiMode ? opts.riichiDiscards : opts.discards.map((x) => x.id));
            t.selectedId = null;
            discardBtn.disabled = true;
            discardBtn.className = 'btn ghost turn-strip';
            discardBtn.innerHTML = icon('turn');
            discardBtn.append(h('b', {}, tr('Your turn')), h('span', { class: 'ts-dot' }, '·'), riichiMode ? tr('Pick the tile to turn sideways') : tr('Tap a tile to discard'));
            this.resync();
          };
          bar.append(rb);
        }
        if (g.players[this.me].riichi) {
          bar.append(h('button', { class: 'btn ghost', onclick: () => done({ kind: 'discard', id: opts.discards[0].id }) }, tr('Skip')));
        }
        const discardBtn = h('button', { class: 'btn ghost turn-strip', disabled: true, html: icon('turn') }, h('b', {}, tr('Your turn')), h('span', { class: 'ts-dot' }, '·'), tr('Tap a tile to discard'));
        bar.append(discardBtn);
        t.onTileClick = (id) => {
          if (!t.interactive.has(id)) return;
          if (t.selectedId === id) return done({ kind: 'discard', id, riichi: riichiMode });
          t.selectedId = id;
          sound.play('click');
          const tile = g.players[this.me].hand.find((x) => x.id === id)!;
          discardBtn.disabled = false;
          discardBtn.className = 'btn';
          clear(discardBtn).append(riichiMode ? tr('{call}: discard {tile}', { call: tr(names.riichi ?? 'Riichi'), tile: tileLabel(tile.kind) }) : tr('Discard {tile}', { tile: tileLabel(tile.kind) }));
          discardBtn.onclick = () => done({ kind: 'discard', id, riichi: riichiMode });
          this.resync();
        };
      },
      () => {
        if (opts.canWin) return { kind: 'win' };
        // Out of time: JongBot's pick when hints are on, else the tile you just drew.
        const allowed = riichiMode ? new Set(opts.riichiDiscards) : new Set(opts.discards.map((x) => x.id));
        const hand = g.players[this.me].hand.filter((x) => allowed.has(x.id));
        const byHint = this.hintsOn && hint.focusKind !== undefined && hint.action === 'discard' && !/^Swap\b/.test(hint.headline) ? hand.find((x) => x.kind === hint.focusKind) : undefined;
        const pick = byHint ?? (drawn && allowed.has(drawn.id) ? drawn : undefined) ?? hand[hand.length - 1] ?? opts.discards[0];
        return { kind: 'discard', id: pick.id, riichi: riichiMode };
      },
      this.turnLimit,
      'turn',
    );
    t.onTileClick = undefined;
    t.interactive.clear();
    t.selectedId = null;
    clear(this.els.actions);
    this.renderHint(null);
    if (!act || this.aborted) return null;
    const me = this.me;
    if (act.kind === 'win') return { t: 'w', s: me };
    if (act.kind === 'kong') return { t: 'k', s: me, k: act.k };
    if (act.kind === 'group') {
      sound.play('kong');
      return act.group.extend === undefined ? { t: 'g', s: me, ids: act.group.ids } : { t: 'g', s: me, ids: act.group.ids, m: act.group.extend };
    }
    if (act.kind === 'abort') return { t: 'a', s: me };
    if (act.kind === 'kita') return { t: 'n', s: me };
    if (act.kind === 'swap') {
      sound.play('pung');
      return { t: 'j', s: me, o: act.swap.owner, m: act.swap.meld, id: act.swap.tileId };
    }
    return act.riichi ? { t: 'd', s: me, id: act.id, r: 1 } : { t: 'd', s: me, id: act.id };
  }

  // ------------------------------------------------------------ American Charleston

  private async charlestonStage() {
    const g = this.game;
    const ph = g.state.phase;
    if (ph.kind !== 'charleston') return;
    // India Rules swaps in pairs, so the direction depends on the seat.
    const target = g.passTarget(this.me, ph.stage);
    const source = g.passSource(this.me, ph.stage);
    const offset = (target - this.me + this.n) % this.n || CHARLESTON[ph.stage];
    const dir = charlestonDirName(offset);
    const india = !!g.state.exchange?.india;
    if (!this.spectator && india) this.toast(tr('EXCHANGE {n} OF 3', { n: ph.stage + 1 }), tr('Pass three tiles {dir} to {name}', { dir: tr(dir), name: g.players[target].name }));
    else if (!this.spectator) {
      if (g.state.goulash && ph.stage === 0) {
        this.toast(g.profile.card ? tr('GOULASH') : tr('GOULASH EXCHANGE'), g.profile.card ? tr('The last hand was a wall game: East deals again, and jokers may be passed this hand') : tr('The last hand was a wall game: pass three tiles right, across, then left'));
        await sleep(this.catchingUp() ? 0 : 2200);
        if (this.aborted) return;
      }
      this.toast((g.state.goulash || g.state.exchange) && !g.profile.card ? tr('GOULASH EXCHANGE') : tr('CHARLESTON'), tr(g.state.goulash && g.profile.card ? 'Pass three tiles {dir} to {name} (jokers may pass)' : 'Pass three tiles {dir} to {name}', { dir: tr(dir), name: g.players[target].name }));
    }
    // AI seats choose first; the engine only moves tiles once all four have picked.
    const picks: (number[] | null)[] = seatList(this.n).map((s) => (this.isAi(s) ? this.ais[s].charlestonPass(g).map((t) => t.id) : null));
    if (this.seats[this.me].kind === 'local') picks[this.me] = (await this.charlestonPick(dir)) ?? null;
    if (picks[this.me] && !this.aborted && this.seats[this.me].kind === 'local') this.shareEarly(this.handLog.length + this.me, { t: 'cp', s: this.me, ids: picks[this.me]! });
    if (this.aborted) return;
    for (let s = 0; s < this.n; s++) {
      if (picks[s]) continue;
      if (this.seats[s].kind === 'remote') {
        this.markWaiting(s);
        // Seat s's pass is committed at base + s (all four are committed in seat order below).
        const a = await this.remote<Extract<Action, { t: 'cp' }>>(s, this.handLog.length + s);
        this.markWaiting(-1);
        if (this.aborted) return;
        picks[s] = a ? a.ids : null;
      }
      if (!picks[s]) picks[s] = this.ais[s].charlestonPass(g).map((t) => t.id);
    }
    for (let s = 0; s < this.n; s++) this.commit({ t: 'cp', s, ids: picks[s]! });
    sound.play('slide');
    if (!this.spectator) this.toast(tr('RECEIVED'), tr('Three tiles from {name}', { name: g.players[source].name }));
    if (!this.catchingUp()) await sleep(THINK[this.settings.speed] * 0.8);
  }

  /** Your three Charleston tiles. */
  private async charlestonPick(dir: string): Promise<number[] | undefined> {
    const g = this.game;
    const advice = this.showHint((d) => charlestonHint(g, this.me, d));
    const ph = g.state.phase;
    if (ph.kind === 'charleston') this.coach?.charleston(ph.stage);
    this.prompt(charlestonPrompt(dir, !!g.state.goulash && !!g.profile.card), advice);
    const t = this.table;
    const pl = g.players[this.me];
    // Jokers never pass, except in a goulash (the hand after a wall game, when the table plays one).
    t.interactive = new Set(pl.hand.filter((x) => g.state.goulash || !isJoker(x.kind)).map((x) => x.id));
    t.selectedIds.clear();
    this.sync();
    const ids = await this.waitHuman<number[] | undefined>(
      (done) => {
        const bar = clear(this.els.actions);
        const go = h('button', { class: 'btn ghost', disabled: true }, tr('Pick 3 tiles to pass {dir}', { dir: tr(dir) }));
        const refresh = () => {
          const n = t.selectedIds.size;
          go.disabled = n !== 3;
          go.className = n === 3 ? 'btn primary' : 'btn ghost';
          clear(go).append(n === 3 ? tr('Pass {dir}', { dir: tr(dir) }) : tr('Pick {n} more', { n: 3 - n }));
          this.resync();
        };
        go.onclick = () => done([...t.selectedIds]);
        const auto = h('button', { class: 'btn', onclick: () => done(advice.tiles) }, tr('Use JongBot’s pick'));
        bar.append(auto, go);
        t.onTileClick = (id) => {
          if (!t.interactive.has(id)) return;
          if (t.selectedIds.has(id)) t.selectedIds.delete(id);
          else if (t.selectedIds.size < 3) t.selectedIds.add(id);
          sound.play('click');
          refresh();
        };
      },
      () => advice.tiles,
      this.limits.turn,
      'turn',
    );
    t.onTileClick = undefined;
    t.interactive.clear();
    t.selectedIds.clear();
    clear(this.els.actions);
    this.renderHint(null);
    return ids;
  }

  // ------------------------------------------------------------ Goulash round

  /** East chooses 1 or 3 exchanges between players and 1 or 3 with the wall
   *  (India Rules: 0, 1 or 3 Tic-Tac-Toes and 0, 1 or 3 wall exchanges). */
  private async exchangeChoice(seat: number) {
    const g = this.game;
    const india = !!g.state.exchange?.india;
    if (india) return this.indiaExchangeStep(seat);
    let pick: { passes: 0 | 1 | 3; wall: 0 | 1 | 3 } | null = null;
    if (this.seats[seat].kind === 'local') {
      const advice = this.ais[seat].exchangeChoice(g);
      pick =
        (await this.waitHuman<{ passes: 0 | 1 | 3; wall: 0 | 1 | 3 } | undefined>(
          (done) => {
            const choice = { ...advice };
            this.renderHint(
              india
                ? { headline: tr('You are East: call the exchanges'), why: tr('Tic-Tac-Toe: everyone gives one tile to each other player. Wall exchange: everyone swaps three tiles with the wall, and the tiles go back into the wall. Call none, one or three of each.') }
                : { headline: tr('You are East: choose the exchanges'), why: tr('First everyone passes three tiles to each other, once (across) or three times (right, across, left). Then everyone swaps three tiles with the wall, once or three times.') },
            );
            const bar = clear(this.els.actions);
            const counts = india ? ([0, 1, 3] as const) : ([1, 3] as const);
            const group = (label: string, key: 'passes' | 'wall') => {
              const btns = counts.map((n) => h('button', { class: `btn${choice[key] === n ? ' primary' : ''}`, onclick: () => ((choice[key] = n), paint()) }, String(n)));
              const paint = () => btns.forEach((b, i) => (b.className = `btn${choice[key] === counts[i] ? ' primary' : ''}`));
              return h('span', { class: 'ex-group' }, h('span', { class: 'ex-label' }, label), ...btns);
            };
            bar.append(group(india ? tr('Tic-Tac-Toe') : tr('Between players'), 'passes'), group(tr('With the wall'), 'wall'), h('button', { class: 'btn primary', onclick: () => done(choice) }, tr('Start the exchanges')));
          },
          () => advice,
          this.limits.turn,
          'turn',
        )) ?? advice;
      clear(this.els.actions);
      this.renderHint(null);
    } else if (this.seats[seat].kind === 'remote') {
      this.markWaiting(seat);
      const a = await this.remote<Extract<Action, { t: 'gx' }>>(seat);
      this.markWaiting(-1);
      if (a) pick = { passes: a.p, wall: a.w };
    }
    if (this.aborted) return;
    pick ??= this.ais[seat].exchangeChoice(g);
    this.commit({ t: 'gx', s: seat, p: pick.passes, w: pick.wall });
    if (!this.spectator) {
      const name = seat === this.me ? tr('You') : g.players[seat].name;
      if (india) this.toast(tr('EAST CALLS'), tr('{name} called {p} Tic-Tac-Toe and {w} wall exchanges', { name, p: pick.passes, w: pick.wall }));
      else this.toast(tr('GOULASH ROUND'), tr('{name} chose {p} exchanges between players and {w} with the wall', { name, p: pick.passes, w: pick.wall }));
      await sleep(this.catchingUp() ? 0 : 2000);
    }
  }

  /** India Rules: East calls the exchanges one question at a time (Tic-Tac-Toe or not, then one or
   *  three; a wall exchange or not, then one or three). */
  private async indiaExchangeStep(seat: number) {
    const g = this.game;
    const ph = g.state.phase;
    if (ph.kind !== 'exchangeChoice') return;
    const step = ph.step ?? 'ttt';
    const ttt = step === 'ttt' || step === 'tttMore';
    const first = step === 'ttt' || step === 'wall';
    const asWanted = (n: number) => (ttt ? { passes: n as 0 | 1 | 3, wall: 0 as const } : { passes: 0 as const, wall: n as 0 | 1 | 3 });
    const aiN = () => {
      const c = this.ais[seat].exchangeChoice(g);
      return ttt ? c.passes : c.wall;
    };
    let n: number | null = null;
    if (this.seats[seat].kind === 'local') {
      // JongBot's 0, 1 or 3 read as this question's answers (No/One first, then One/Three).
      const raw = aiN();
      const advice = first ? (raw > 0 ? 1 : 0) : raw === 3 ? 3 : 1;
      const q = {
        ttt: [tr('Call a Tic-Tac-Toe?'), tr('Everyone gives one tile to each other player.'), tr('No Tic-Tac-Toe'), tr('One Tic-Tac-Toe')],
        tttMore: [tr('Keep it at one Tic-Tac-Toe, or make it three?'), tr('Two more Tic-Tac-Toes are played if you make it three.'), tr('Keep it at one'), tr('Make it three')],
        wall: [tr('Call a wall exchange?'), tr('Everyone swaps three tiles with the wall, and the tiles go back into the wall.'), tr('No wall exchange'), tr('One wall exchange')],
        wallMore: [tr('Keep it at one wall exchange, or make it three?'), tr('Two more wall exchanges are played if you make it three.'), tr('Keep it at one'), tr('Make it three')],
      }[step];
      const values = first ? [0, 1] : [1, 3];
      n =
        (await this.waitHuman<number | undefined>(
          (done) => {
            this.renderHint({ headline: q[0], why: q[1] });
            const bar = clear(this.els.actions);
            bar.append(...values.map((v, i) => h('button', { class: `btn${v === advice ? ' primary' : ''}`, onclick: () => done(v) }, q[2 + i])));
          },
          () => advice,
          this.limits.turn,
          'turn',
        )) ?? advice;
      clear(this.els.actions);
      this.renderHint(null);
    } else if (this.seats[seat].kind === 'remote') {
      this.markWaiting(seat);
      const a = await this.remote<Extract<Action, { t: 'gx' }>>(seat);
      this.markWaiting(-1);
      if (a) n = ttt ? a.p : a.w;
    }
    if (this.aborted) return;
    n ??= aiN();
    const c = asWanted(n);
    this.commit({ t: 'gx', s: seat, p: c.passes, w: c.wall });
    if (!this.spectator) {
      const name = seat === this.me ? tr('You') : g.players[seat].name;
      const v = { name };
      const said = ttt
        ? first
          ? n
            ? tr('{name} called a Tic-Tac-Toe', v)
            : tr('{name} called no Tic-Tac-Toe', v)
          : n === 3
            ? tr('{name} made it three Tic-Tac-Toes', v)
            : tr('{name} kept it at one Tic-Tac-Toe', v)
        : first
          ? n
            ? tr('{name} called a wall exchange', v)
            : tr('{name} called no wall exchange', v)
          : n === 3
            ? tr('{name} made it three wall exchanges', v)
            : tr('{name} kept it at one wall exchange', v);
      this.toast(tr('EAST CALLS'), said);
      await sleep(this.catchingUp() ? 0 : 1500);
    }
  }

  /** Your Small Card, open to read at any time during the hand. */
  private showSmallCard(card: SmallCard) {
    const o = document.getElementById('modal');
    if (!o) return;
    clear(o).hidden = false;
    o.append(h('div', { class: 'card card-view' }, h('h3', {}, tr('Your Small Card')), smallCardView(card, { faan: this.game.profile.specialRound === 'smallCard' }), h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', onclick: () => (o.hidden = true) }, tr('Close')))));
  }

  private showBigCard(card: BigCard) {
    const o = document.getElementById('modal');
    if (!o) return;
    clear(o).hidden = false;
    o.append(h('div', { class: 'card card-view' }, h('h3', {}, tr('This game’s Big Card')), bigCardView(card, { faan: this.game.profile.specialRound === 'bigCard' }), h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', onclick: () => (o.hidden = true) }, tr('Close')))));
  }

  /** India Rules North round: before the deal, East chooses the game. You get at least 30 seconds
   *  at a timed table; JongBot's pick is the fallback. */
  private async roundChoiceStage(seat: number) {
    const g = this.game;
    const choices = g.profile.roundChoices ?? [];
    let code: number | null = null;
    if (this.seats[seat].kind === 'local') {
      const advice = this.ais[seat].roundChoice(g);
      const limit = this.limits.turn > 0 ? Math.max(30, this.limits.turn) : 0;
      let panel: HTMLElement | null = null;
      code =
        (await this.waitHuman<number | undefined>(
          (done) => {
            const opt = (title: string, line: string, ...body: HTMLElement[]) => h('div', { class: 'rc-option' }, h('div', { class: 'rc-title' }, title), h('div', { class: 'rc-line' }, line), ...body);
            const btn = (c: number, label: string, ...kids: HTMLElement[]) => h('button', { class: `btn${c === advice ? ' primary' : ''}`, onclick: () => done(c), 'aria-label': tr(choices.find((x) => x.code === c)?.label ?? label) }, ...kids, label);
            const numbers = h('div', { class: 'rc-numbers' }, ...NUMBER_NAMES.map((_, i) => btn(northGoulash(i + 1), String(i + 1), tileImg(18 + i, 'mini', this.settings.labels))));
            panel = h(
              'div',
              { class: 'card-choice round-choice', role: 'dialog', 'aria-label': tr('You are East: choose this game') },
              h('h3', {}, tr('You are East: choose this game')),
              h('p', { class: 'muted' }, tr('The North round is East’s choice. Everyone plays the game you pick, before the tiles are dealt.')),
              h(
                'div',
                { class: 'rc-options' },
                opt(tr('East round'), tr('Passports, no exchange.'), h('div', { class: 'rc-row' }, btn(NORTH.east, tr('Passport compulsory')), btn(NORTH.eastOpen, tr('Passport optional')))),
                opt(tr('Small Cards with jokers'), tr('One card each. Flowers and seasons are jokers.'), h('div', { class: 'rc-row' }, btn(NORTH.small, tr('Play Small Cards')))),
                opt(tr('Goulash with jokers'), tr('Before the deal, name a number: that number in each suit is a joker, one of each per player. Every set and pair keeps at least one real tile.'), numbers),
                opt(
                  tr('Big Card'),
                  tr('One card for the whole table. Lay down kongs, qwongs and runs for extra tiles. Each card names its jokers.'),
                  h('div', { class: 'rc-row' }, h('button', { class: `btn${advice > NORTH.big ? ' primary' : ''}`, onclick: () => showBig() }, tr('Choose a Big Card'))),
                ),
              ),
            );
            const showBig = () => {
              const list = h('div', { class: 'rc-big-list' }, ...BIG_CARDS.map((c) => bigCardView(c, { onPick: () => done(northBig(c.n)), recommended: northBig(c.n) === advice })));
              const back = h('button', { class: 'btn ghost', onclick: () => (list.replaceWith(options), back.remove()) }, tr('Back'));
              options.replaceWith(list);
              list.before(back);
            };
            const options = panel.querySelector('.rc-options') as HTMLElement;
            // The special wind rounds of other rulesets offer only Big Cards: show the cards at once.
            if (choices.every((c) => c.code > NORTH.big)) {
              panel.querySelector('p.muted')!.textContent = tr('The North round plays a Big Card. Pick the card everyone plays this hand, before the tiles are dealt.');
              options.replaceWith(h('div', { class: 'rc-big-list' }, ...BIG_CARDS.map((c) => bigCardView(c, { onPick: () => done(northBig(c.n)), recommended: northBig(c.n) === advice, faan: true }))));
            }
            this.root.append(panel);
          },
          () => advice,
          limit,
          'turn',
        )) ?? advice;
      (panel as HTMLElement | null)?.remove();
    } else if (this.seats[seat].kind === 'remote') {
      this.markWaiting(seat);
      const a = await this.remote<Extract<Action, { t: 'rc' }>>(seat);
      this.markWaiting(-1);
      if (a) code = a.c;
    }
    if (this.aborted) return;
    code ??= this.ais[seat].roundChoice(g);
    this.commit({ t: 'rc', s: seat, c: code });
    // The game changes the rules: rebuild the guide and the hand sorting (the targets change too), then deal.
    this.guide.reset();
    this.calc.reset();
    this.ppPlans = null;
    this.ppChoice = null;
    this.pushLayout();
    this.refreshHud();
    this.sync({ dealing: true });
    if (!this.spectator) {
      const name = seat === this.me ? tr('You') : g.players[seat].name;
      this.toast(tr('EAST CHOOSES'), tr('{name} chose {game}', { name, game: tr(g.profile.chosenGame ?? '') }));
      await sleep(this.catchingUp() ? 0 : 2400);
    }
  }

  /** India Rules Small Cards: everyone keeps one of three cards, having seen their tiles. You get at
   *  least 90 seconds at a timed table, and as long as you like at an untimed one or in a lesson. */
  private async cardPickStage() {
    const g = this.game;
    if (g.state.phase.kind !== 'cardPick') return;
    const offers = g.state.cardOffers!;
    const picks: (number | null)[] = seatList(this.n).map((s) => (this.isAi(s) ? this.ais[s].cardPick(g) : null));
    if (this.seats[this.me].kind === 'local') {
      const mine = offers[this.me];
      const advice = this.ais[this.me].cardPick(g);
      const dist = cardDistances(g, this.me, mine);
      const limit = this.limits.turn > 0 ? Math.max(90, this.limits.turn) : 0;
      this.sync();
      let panel: HTMLElement | null = null;
      picks[this.me] = await this.waitHuman<number>(
        (done) => {
          panel = h(
            'div',
            { class: 'card-choice', role: 'dialog', 'aria-label': tr('Choose your Small Card') },
            h('h3', {}, tr('Choose your Small Card')),
            h('p', { class: 'muted' }, tr('Look at your tiles, then keep one of these three cards. You can only win with the hand your card names.')),
            h('div', { class: 'card-offers' }, ...mine.map((c, i) => h('button', { onclick: () => done(c), 'aria-label': SMALL_CARDS[c].name }, smallCardView(SMALL_CARDS[c], { distance: dist[i] < 99 ? dist[i] : undefined, recommended: c === advice, faan: g.profile.specialRound === 'smallCard' })))),
          );
          this.root.append(panel);
        },
        () => advice,
        limit,
        'turn',
      );
      (panel as HTMLElement | null)?.remove();
      if (!this.aborted) this.shareEarly(this.handLog.length + this.me, { t: 'sc', s: this.me, c: picks[this.me]! });
    }
    if (this.aborted) return;
    for (let s = 0; s < this.n; s++) {
      if (picks[s] !== null) continue;
      if (this.seats[s].kind === 'remote') {
        this.markWaiting(s);
        const a = await this.remote<Extract<Action, { t: 'sc' }>>(s, this.handLog.length + s);
        this.markWaiting(-1);
        if (this.aborted) return;
        picks[s] = a ? a.c : null;
      }
      if (picks[s] === null) picks[s] = this.ais[s].cardPick(g);
    }
    for (let s = 0; s < this.n; s++) this.commit({ t: 'sc', s, c: picks[s]! });
    this.pushLayout();
    if (!this.spectator && g.state.cards) this.toast(tr('YOUR SMALL CARD'), SMALL_CARDS[g.state.cards[this.me]].name);
  }

  /** Everyone swaps three tiles with the wall. */
  private async wallExchangeStage() {
    const g = this.game;
    const ph = g.state.phase;
    if (ph.kind !== 'wallExchange') return;
    const total = g.state.exchange?.wall ?? 1;
    if (!this.spectator) this.toast(tr('WALL EXCHANGE'), tr('Swap three tiles with the wall ({n} of {total})', { n: ph.round + 1, total }));
    const picks: (number[] | null)[] = seatList(this.n).map((s) => (this.isAi(s) ? this.ais[s].wallExchangePick(g).map((t) => t.id) : null));
    const why = g.state.exchange?.india ? tr('The three tiles go back into the wall and you draw three new ones.') : tr('The three tiles go out of play and you draw three new ones from the wall.');
    if (this.seats[this.me].kind === 'local') picks[this.me] = (await this.pickThree(tr('Pick 3 tiles to swap with the wall'), tr('Swap with the wall'), exchangePick(g, this.me).map((t) => t.id), why)) ?? null;
    if (picks[this.me] && !this.aborted && this.seats[this.me].kind === 'local') this.shareEarly(this.handLog.length + this.me, { t: 'wx', s: this.me, ids: picks[this.me]! });
    if (this.aborted) return;
    for (let s = 0; s < this.n; s++) {
      if (picks[s]) continue;
      if (this.seats[s].kind === 'remote') {
        this.markWaiting(s);
        const a = await this.remote<Extract<Action, { t: 'wx' }>>(s, this.handLog.length + s);
        this.markWaiting(-1);
        if (this.aborted) return;
        picks[s] = a ? a.ids : null;
      }
      if (!picks[s]) picks[s] = this.ais[s].wallExchangePick(g).map((t) => t.id);
    }
    for (let s = 0; s < this.n; s++) this.commit({ t: 'wx', s, ids: picks[s]! });
    sound.play('slide');
    if (!this.catchingUp()) await sleep(THINK[this.settings.speed] * 0.8);
  }

  /** India Rules Tic-Tac-Toe: everyone gives one tile to each other player. */
  private async ticTacToeStage() {
    const g = this.game;
    const ph = g.state.phase;
    if (ph.kind !== 'ticTacToe') return;
    const total = g.state.exchange?.passes ?? 1;
    if (!this.spectator) this.toast(tr('TIC-TAC-TOE'), tr('One tile to each player ({n} of {total})', { n: ph.round + 1, total }));
    const picks: (number[] | null)[] = seatList(this.n).map((s) => (this.isAi(s) ? this.ais[s].ticTacToePick(g).map((t) => t.id) : null));
    if (this.seats[this.me].kind === 'local') picks[this.me] = (await this.pickThree(tr('Pick 3 tiles: right, across, then left'), tr('Give the tiles'), exchangePick(g, this.me).map((t) => t.id), tr('The first tile you pick goes to the player on your right, the second across, the third to your left.'))) ?? null;
    if (picks[this.me] && !this.aborted && this.seats[this.me].kind === 'local') this.shareEarly(this.handLog.length + this.me, { t: 'tt', s: this.me, ids: picks[this.me]! });
    if (this.aborted) return;
    for (let s = 0; s < this.n; s++) {
      if (picks[s]) continue;
      if (this.seats[s].kind === 'remote') {
        this.markWaiting(s);
        const a = await this.remote<Extract<Action, { t: 'tt' }>>(s, this.handLog.length + s);
        this.markWaiting(-1);
        if (this.aborted) return;
        picks[s] = a ? a.ids : null;
      }
      if (!picks[s]) picks[s] = this.ais[s].ticTacToePick(g).map((t) => t.id);
    }
    for (let s = 0; s < this.n; s++) this.commit({ t: 'tt', s, ids: picks[s]! });
    sound.play('slide');
    if (!this.catchingUp()) await sleep(THINK[this.settings.speed] * 0.8);
  }

  /** Choose three of your tiles (wall exchange, Tic-Tac-Toe). JongBot's pick is offered. */
  private async pickThree(prompt: string, go: string, advice: number[], why: string): Promise<number[] | undefined> {
    const t = this.table;
    const pl = this.game.players[this.me];
    this.renderHint({ headline: prompt, why });
    t.interactive = new Set(pl.hand.map((x) => x.id));
    t.selectedIds.clear();
    this.sync();
    const ids = await this.waitHuman<number[] | undefined>(
      (done) => {
        const bar = clear(this.els.actions);
        const btn = h('button', { class: 'btn ghost', disabled: true }, prompt);
        const refresh = () => {
          const n = t.selectedIds.size;
          btn.disabled = n !== 3;
          btn.className = n === 3 ? 'btn primary' : 'btn ghost';
          clear(btn).append(n === 3 ? go : tr('Pick {n} more', { n: 3 - n }));
          this.resync();
        };
        btn.onclick = () => done([...t.selectedIds]);
        bar.append(h('button', { class: 'btn', onclick: () => done(advice) }, tr('Use JongBot’s pick')), btn);
        t.onTileClick = (id) => {
          if (!t.interactive.has(id)) return;
          if (t.selectedIds.has(id)) t.selectedIds.delete(id);
          else if (t.selectedIds.size < 3) t.selectedIds.add(id);
          sound.play('click');
          refresh();
        };
      },
      () => advice,
      this.limits.turn,
      'turn',
    );
    t.onTileClick = undefined;
    t.interactive.clear();
    t.selectedIds.clear();
    clear(this.els.actions);
    this.renderHint(null);
    return ids;
  }

  private async charlestonVote() {
    const g = this.game;
    const votes: (boolean | null)[] = seatList(this.n).map((s) => (this.isAi(s) ? this.ais[s].charlestonVote(g) : null));
    if (this.seats[this.me].kind === 'local') {
      const again = await this.waitHuman<boolean | undefined>(
        (done) => {
          this.renderHint({ headline: tr('Second Charleston?'), why: g.profile.card ? tr('Everyone must agree to pass again: left, across, then right. Stop if your hand already fits a card hand.') : tr('Everyone must agree to pass again: left, across, then right. Stop if your hand is already shaping up well.') });
          this.speak(votePrompt());
          this.coach?.charlestonVote();
          const bar = clear(this.els.actions);
          bar.append(h('button', { class: 'btn', onclick: () => done(true) }, tr('Pass again')), h('button', { class: 'btn primary', onclick: () => done(false) }, tr('Start play')));
        },
        () => false,
        this.limits.turn,
        'turn',
      );
      clear(this.els.actions);
      this.renderHint(null);
      votes[this.me] = !!again;
      if (!this.aborted) this.shareEarly(this.handLog.length + this.me, { t: 'cv', s: this.me, v: again ? 1 : 0 });
    }
    if (this.aborted) return;
    for (let s = 0; s < this.n; s++) {
      if (votes[s] !== null) continue;
      if (this.seats[s].kind === 'remote') {
        const a = await this.remote<Extract<Action, { t: 'cv' }>>(s, this.handLog.length + s);
        if (this.aborted) return;
        votes[s] = a ? !!a.v : null;
      }
      if (votes[s] === null) votes[s] = this.ais[s].charlestonVote(g);
    }
    for (let s = 0; s < this.n && g.state.phase.kind === 'charlestonVote'; s++) this.commit({ t: 'cv', s, v: votes[s] ? 1 : 0 });
    if (g.state.phase.kind === 'turn') this.toast(tr('PLAY BEGINS'), votes.every(Boolean) ? tr('Charleston complete') : tr('Someone stopped the second Charleston'));
  }

  private async humanClaim(options: ClaimOption[], kind: number): Promise<ClaimResponse | null> {
    const g = this.game;
    // Buying is offered on every discard from the left: only ask when the card can use the tile.
    const uses = cardUses(g.shapesFor(this.me));
    if (options.every((o) => o.type === 'buy') && uses && !uses(kind)) return { type: 'pass' };
    sound.play('turn');
    const hint = this.showHint((d) => claimHint(g, this.me, options, kind, d));
    // The latest-discard callout already shows the tile, so no toast covers the table here.
    this.prompt(claimPrompt(kind), hint);
    this.opts.coach?.claimOffer(options.map((o) => o.type).filter((t): t is ClaimKind => t in { pung: 1, chow: 1, kong: 1, win: 1 }));
    const resp = await this.waitHuman<ClaimResponse | undefined>(
      (done) => {
        const bar = clear(this.els.actions);
        for (const o of options) {
          const label = o.type === 'win' ? `${tr(g.profile.callNames.win)}!` : o.type === 'buy' ? tr('Buy for {n}', { n: g.profile.buyFromLeft ?? 0 }) : tr(g.profile.callNames[o.type]);
          // A call that leaves no winning hand is allowed, but only after you answer the warning.
          const b = h('button', { class: `btn claim ${o.type === 'win' ? 'primary glow' : ''}`, onclick: async () => (!callLeavesNoWin(g, this.me, o, kind) || (await this.callWarning(label))) && done(o) });
          if (o.type === 'chow') for (const k of [...o.using!, kind].sort((a, b) => a - b)) b.append(tileImg(k, 'mini', this.settings.labels));
          b.append(label);
          bar.append(b);
        }
        bar.append(h('button', { class: 'btn claim pass', onclick: () => done({ type: 'pass' }) }, tr('Pass')));
      },
      () => ({ type: 'pass' }),
      this.limits.claim,
      'claim',
    );
    this.closeCallWarning(false);
    clear(this.els.actions);
    this.renderHint(null);
    if (this.aborted) return null;
    return resp ?? { type: 'pass' };
  }

  // ------------------------------------------------------------ results

  /** How the winning tile came, for the hand summary: self-drawn, or whose discard. */
  winFrom(r: HandResult): { selfDrawn: boolean; from?: string; yours?: boolean } | undefined {
    if (r.type !== 'win') return undefined;
    if (r.discarder === null || r.discarder === undefined) return { selfDrawn: true };
    return { selfDrawn: false, from: r.discarder === this.me ? undefined : this.game.players[r.discarder].name, yours: r.discarder === this.me };
  }

  private async showHandResult(r: HandResult, over: boolean, label: string) {
    const g = this.game;
    const t = this.table;
    const winner = r.winner;
    this.table.matchKind = null;
    // The winner's concealed tiles part into the sets they make, the winning tile marked (winReveal.ts).
    // In the summary's order: India Rules East round reads passports first, then the sets with them and the pair.
    const winHand = winner !== undefined ? r.revealedHand ?? g.players[winner].hand : [];
    const winSets = r.type === 'win' && winner !== undefined ? winTableSets(winHand, g.profile.passportView?.(winHand, r.revealedMelds ?? g.players[winner].melds)) : undefined;
    t.layout(g.state, { reveal: seatList(this.n), winner, winLift: r.type === 'win', winSets, winTileId: r.winTile?.id });
    this.refreshHud();
    this.els.status.textContent = '';
    this.renderWaits();
    let winMoment = false;
    if (r.type === 'win' && winner !== undefined) {
      const name = winner === this.you ? tr('You') : g.players[winner].name;
      const from = r.discarder === this.me ? tr('your') : tr('{name}’s', { name: g.players[r.discarder ?? 0].name });
      const how = r.robbedKong ? tr('by robbing {whose} kong', { whose: from }) : r.discarder === null ? tr('by self-draw') : tr('on {whose} discard', { whose: from });
      // The win moment: the hand lifts into a sweep of gold light, the camera leans in, and a calligraphy banner names the win.
      t.celebrateWin(winner, { selfDrawn: r.discarder === null, from: r.discarder ?? null, camera: this.settings.speed !== 'minimal' });
      this.showWinBanner(r, winner === this.me ? tr('You win {how}', { how }) : tr('{name} wins {how}', { name, how }));
      winMoment = true;
      if (winner === this.me) {
        this.stats.handsWon++;
        if (r.discarder === null) this.stats.selfDraws++;
        if (g.players[this.me].riichi) this.stats.riichiWins++;
        if (r.score!.limit) this.stats.limit = true;
        this.stats.winValue += r.score!.points;
        const best = { points: r.score!.points, value: r.score!.value, name: r.score!.tier ?? r.score!.items[0]?.name ?? tr('Mahjong') };
        if (!this.stats.best || best.points > this.stats.best.points) this.stats.best = best;
      }
      if (r.discarder === this.me) this.stats.dealIns++;
      // Opponents applaud.
      setTimeout(() => {
        for (let s = 0; s < this.n; s++) if (s !== winner && s !== this.you && Math.random() < 0.4) this.react(s, Math.random() < 0.7 ? '👏' : '😮');
      }, 900);
    } else {
      this.toast(tr('DRAWN HAND'), tr('The wall is empty'));
    }
    const sp = this.settings.speed;
    // A limit hand or yakuman gets its signature moment first (winCinematic.ts); a tap cuts it short.
    if (winMoment && !this.catchingUp()) await startWinCinematic(t, this.root, winner!, r.score, winner === this.me)?.done;
    if (this.aborted) return;
    // A win is given time to be seen; a drawn hand moves on sooner.
    await this.skippableWait(winMoment ? (sp === 'minimal' ? 1400 : sp === 'cinematic' ? 4200 : 3200) : sp === 'minimal' ? 500 : sp === 'cinematic' ? 2600 : 1700);
    this.hideWinBanner();
    if (this.aborted) return;
    sound.play('score');

    const o = this.els.overlay;
    clear(o).hidden = false;
    // The summary has the table to itself: no close-up strip of your hand (and its frame lines) behind it.
    t.splitPaused = true;
    // Every hand is face up now: the player can take the camera and look around the table.
    o.classList.add('free-cam');
    const endFreeCam = startFreeCamera(t, o);
    const card = h('div', { class: 'card hand-result' });
    if (r.type === 'win' && winner !== undefined && r.score) {
      const s = r.score;
      this.lastScored = s.items.map((i) => i.name);
      const headline = winner === this.me ? tr('You win the hand') : tr('{name} wins the hand', { name: g.players[winner].name });
      card.append(h('div', { class: 'eyebrow' }, label), h('h2', {}, headline));
      this.speak(resultSpoken(this.rel(winner), `${headline}, for ${fmt(s.points)} points.`));
      const wh = r.revealedHand ?? [];
      const wm = r.revealedMelds ?? [];
      card.append(winHandSection({ hand: wh, melds: wm, flowers: g.players[winner].flowers, winTileId: r.winTile?.id, labels: this.settings.labels, red: (id) => isRed(g.state, id), passports: g.profile.passportView?.(wh, wm), winFrom: this.winFrom(r) }));
      const items = h('ul', { class: 'score-items' });
      for (const it of s.items) items.append(h('li', {}, h('span', {}, it.name, it.note ? h('em', {}, ` ${it.note}`) : ''), h('span', { class: 'num' }, it.value ? `${fmt(it.value)} ${tr(s.unit)}` : '')));
      const summary = `${fmt(s.value)} ${tr(s.unit)}${s.fu ? ` ${s.fu} ${tr('fu')}` : ''}${s.tier ? ` · ${s.tier}` : s.limit ? ` · ${tr('Limit')}` : ''}`;
      card.append(items, h('div', { class: 'score-total' }, h('span', {}, summary), h('strong', {}, tr('{n} pts', { n: fmt(s.points) }))));
      const extras: string[] = [];
      if (r.bonusCounters) extras.push(tr('Honba {n}', { n: r.bonusCounters }));
      if (r.potWon) extras.push(`${g.profile.riichi?.cost ? tr('Riichi sticks') : g.profile.goulashPot ? tr('Goulash pot') : tr('Bank')} +${fmt(r.potWon)}`);
      if (extras.length) card.append(h('p', { class: 'muted small' }, extras.join(' · ')));
    } else {
      card.append(h('div', { class: 'eyebrow' }, tr('No winner')), h('h2', {}, tr('Drawn hand')));
      this.speak(resultSpoken(null, ''));
      const note = drawnHandNote(r, (s) => (s === this.me ? tr('you') : g.players[s].name), g.state.log.find((e) => e.type === 'abortive')?.seat);
      if (note) card.append(h('p', { class: 'muted' }, note));
      else if (r.tenpai) {
        const ready = g.players.filter((_, i) => r.tenpai![i]).map((p, _i) => (p.seat === this.me ? tr('you') : p.name));
        card.append(h('p', { class: 'muted' }, ready.length ? tr('The wall ran out. Ready (tenpai): {names}. Players who weren’t ready pay {n} points in total to those who were.', { names: andList(ready), n: g.profile.players === 3 ? '2,000' : '3,000' }) : tr('The wall ran out and nobody was ready. No points change hands.')));
      } else if (g.profile.drawPot) card.append(h('p', { class: 'muted' }, tr('The live wall ran out before anyone completed a hand. Everyone puts {n} in the bank for the next winner.', { n: fmt(g.profile.drawPot) })));
      else card.append(h('p', { class: 'muted' }, tr('The live wall ran out before anyone completed a hand. No points change hands.')));
    }
    const lines = instantLines(g, r);
    const nameOf = (s: number) => (s === this.me ? tr('You') : g.players[s].name);
    const signed = (d: number) => (d > 0 ? `+${fmt(d)}` : d < 0 ? `−${fmt(-d)}` : '0');
    if (lines.length) {
      const list = h('ul', { class: 'instant-items' });
      for (const l of lines) {
        const total = l.pays.reduce((a, p) => a + p.amount, 0);
        const payers = [...new Set(l.pays.map((p) => p.from))];
        const each = l.pays.every((p) => p.amount === l.pays[0].amount) ? l.pays[0].amount : 0;
        const fromText = payers.length === g.players.length - 1 && each ? tr('{n} from each other player', { n: fmt(each) }) : l.pays.map((p) => tr('{n} from {name}', { n: fmt(p.amount), name: nameOf(p.from) })).join(', ');
        list.append(
          h(
            'li',
            {},
            h('span', {}, h('strong', {}, l.seat >= 0 ? nameOf(l.seat) : tr('Table')), ` · ${l.why}`, h('em', {}, ` ${fromText}`)),
            h('span', { class: 'num up' }, `+${fmt(total)}`),
          ),
        );
      }
      card.append(h('h4', { class: 'instant-head' }, tr('Paid on the spot')), list);
    }
    const deltas = h('div', { class: 'deltas' });
    g.players.forEach((p, i) => {
      const hd = r.deltas[i];
      const inst = r.instant?.length ? netOf(r.instant, i) : 0;
      // Money put in the bank during the hand (riichi sticks, India buys, antes) isn't in the hand's
      // payments, so the row shows the real change in score and names the bank part.
      const start = this.handStartScores?.[i];
      const bank = start === undefined ? 0 : p.score - start - hd;
      const d = hd + bank;
      const split = bank
        ? h('span', { class: 'delta-split' }, inst ? tr('hand {a} · on the spot {b} · bank {c}', { a: signed(hd - inst), b: signed(inst), c: signed(bank) }) : tr('hand {a} · bank {b}', { a: signed(hd), b: signed(bank) }))
        : r.instant?.length
          ? h('span', { class: 'delta-split' }, tr('hand {a} · on the spot {b}', { a: signed(hd - inst), b: signed(inst) }))
          : '';
      deltas.append(h('div', { class: 'delta-row' }, h('span', {}, i === this.me ? tr('{name} (you)', { name: p.name }) : p.name, split), h('span', { class: `num ${d > 0 ? 'up' : d < 0 ? 'down' : ''}` }, signed(d)), h('span', { class: 'num muted' }, fmt(p.score))));
    });
    card.append(deltas);
    await new Promise<void>((resolve) => {
      const cont = h('button', { class: 'btn primary', onclick: () => resolve() }, over ? tr('See results') : tr('Next hand')) as HTMLButtonElement;
      // A win can fold its summary away to look at the hand on the table; the camera frames it.
      // The hand the table frames when the summary folds away: the winner's, or the one picked with View in All hands.
      let framed = winner ?? (this.spectator ? 0 : this.me);
      const reframe = () => t.frameHand(framed, openArea(o, card));
      const hide = summaryToggle(o, cont, { onHide: reframe, onShow: reframe, strip: card.querySelector('.win-hand')?.cloneNode(true) as HTMLElement | undefined });
      // View (All hands): fold the summary away and frame that player's whole hand in 3D on the table.
      const viewSeat = (seat: number) => {
        framed = seat;
        const bar = o.querySelector<HTMLElement>('.peek-bar');
        let strip = bar?.querySelector<HTMLElement>('.peek-strip');
        if (bar && !strip) bar.prepend((strip = h('div', { class: 'peek-strip' })));
        const rows = all.querySelectorAll<HTMLElement>('.ah-seat .win-hand');
        const idx = [...all.querySelectorAll<HTMLElement>('.ah-view')].findIndex((b) => b.dataset.seat === String(seat));
        if (strip && rows[idx]) strip.replaceChildren(rows[idx].cloneNode(true));
        let who = bar?.querySelector<HTMLElement>('.peek-who');
        if (bar && !who) bar.prepend((who = h('div', { class: 'peek-who' })));
        if (who) who.textContent = seat === this.me && !this.spectator ? tr('Your hand') : tr('{name}’s hand', { name: g.players[seat].name });
        o.querySelector<HTMLElement>('.hide-summary')?.click();
      };
      // Every player's hand, with how close each came, in place of the summary until you go back.
      const backIc = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4L6 8l4 4"/></svg>';
      const allBtn = h('button', { class: 'btn ghost all-hands-btn', 'aria-expanded': 'false' }, h('span', { class: 'peek-ic', 'aria-hidden': 'true', html: ALL_HANDS_ICON }), tr('All hands')) as HTMLButtonElement;
      const back = h('button', { class: 'btn ghost ah-back' }, h('span', { class: 'peek-ic', 'aria-hidden': 'true', html: backIc }), tr('Back to summary')) as HTMLButtonElement;
      const cont2 = h('button', { class: 'btn primary', onclick: () => cont.click() }, cont.textContent ?? '') as HTMLButtonElement;
      const all = h(
        'div',
        { class: 'all-hands' },
        h('div', { class: 'eyebrow' }, label),
        h('h2', {}, tr('Every player’s hand')),
        allHandsList({ game: g, result: r, me: this.spectator ? -1 : this.me, labels: this.settings.labels, red: (id) => isRed(g.state, id), onView: (seat) => viewSeat(seat) }),
        h('div', { class: 'btn-row' }, back, cont2),
      );
      const showAll = (on: boolean) => {
        card.classList.toggle('show-all', on);
        allBtn.setAttribute('aria-expanded', String(on));
        o.scrollTop = 0;
        (on ? back : allBtn).focus({ preventScroll: true });
      };
      allBtn.onclick = () => showAll(true);
      back.onclick = () => showAll(false);
      card.append(h('div', { class: 'btn-row' }, hide ?? '', allBtn, cont), all);
      o.classList.toggle('win-sheet', !!hide);
      o.append(card);
      cont.focus({ preventScroll: true });
      // Beside a panel docked at the side (wide screens), the camera frames the winning hand in the open space.
      if (hide && o.classList.contains('win-sheet') && card.getBoundingClientRect().left > window.innerWidth * 0.35) requestAnimationFrame(reframe);
      this.resolveHuman = () => resolve();
    });
    o.hidden = true;
    o.classList.remove('win-sheet', 'peek', 'free-cam');
    endFreeCam();
    t.splitPaused = false;
    if (!over) t.setView('seat', 0.8);
  }

  /**
   * The calligraphy banner for a win: the variation's own win call (Mahjong,
   * Tsumo, Hu...) brushed large, a vermilion seal, then the hand's name and
   * points. Self-drawn wins carry 自摸 (self-draw) on the seal; wins on a
   * discard carry 和 (complete).
   */
  private showWinBanner(r: HandResult, sub: string) {
    const g = this.game;
    const s = r.score;
    const self = r.discarder === null;
    const word = self ? g.profile.callNames.selfDraw : g.profile.callNames.win;
    const handName = s ? (s.tier ?? s.items.find((i) => i.value)?.name ?? s.items[0]?.name ?? '') : '';
    const el = clear(this.els.win);
    ensureBrushFont();
    el.className = `win-banner ${self ? 'self' : 'ron'} ${r.winner === this.you ? 'mine' : ''} speed-${this.settings.speed}`;
    el.append(
      h(
        'div',
        { class: 'wb-inner' },
        h('div', { class: 'wb-stroke', 'aria-hidden': 'true', html: BRUSH_SVG }),
        h('div', { class: 'wb-word' }, tr(word), h('span', { class: 'wb-seal', 'aria-hidden': 'true' }, self ? '自摸' : '和')),
        h('div', { class: 'wb-sub' }, sub),
        s ? h('div', { class: 'wb-hand' }, handName ? h('span', { class: 'wb-name' }, handName) : null, h('span', { class: 'wb-pts' }, tr('{n} pts', { n: fmt(s.points) }))) : null,
      ),
    );
    el.hidden = false;
    void el.offsetWidth;
    el.classList.add('on');
    this.root.classList.add('winning');
  }

  private hideWinBanner() {
    const el = this.els.win;
    this.root.classList.remove('winning');
    if (el.hidden) return;
    el.classList.remove('on');
    el.classList.add('off');
    window.setTimeout(() => {
      el.hidden = true;
      el.classList.remove('off');
    }, 380);
  }

  private skippableWait(ms: number) {
    return new Promise<void>((resolve) => {
      const skip = h('button', { class: 'skip' }, tr('Skip ›'));
      const done = () => {
        clearTimeout(tm);
        skip.remove();
        resolve();
      };
      skip.onclick = done;
      this.root.append(skip);
      const tm = setTimeout(done, ms);
      this.resolveHuman = () => done();
    });
  }

  private finish() {
    const g = this.game;
    // Ties never favour you: you are listed after anyone on the same score, and
    // a shared place counts as the lower one (a drawn game is no win).
    const standings = g.players.map((p) => ({ name: p.name, score: p.score, seat: p.seat })).sort((a, b) => b.score - a.score || (a.seat === this.me ? 1 : b.seat === this.me ? -1 : a.seat - b.seat));
    const placement = this.spectator ? 0 : g.players.filter((p) => p.seat !== this.me && p.score >= g.players[this.me].score).length + 1;
    const len = this.config.length;
    const summary: MatchSummary = {
      placement,
      finalScore: g.players[this.me].score,
      handsWon: this.stats.handsWon,
      handsPlayed: this.stats.handsPlayed,
      selfDraws: this.stats.selfDraws,
      bestHand: this.stats.best,
      limitHand: this.stats.limit,
      fullNews: len === 'fullNews',
      variation: g.profile.id,
      lengthLabel: GAME_LENGTHS[len].label,
      length: len,
      winds: [...g.profile.rounds.prevailingWinds],
      ranked: !!this.opts.ranked,
      mode: this.opts.mode ?? 'ai',
      decisions: this.stats.decisions,
      goodDecisions: this.stats.goodDecisions,
      dealIns: this.stats.dealIns,
      calls: this.stats.calls,
      riichis: this.stats.riichis,
      winPoints: this.stats.winValue,
      opponents: this.seats.flatMap((x, i): string[] => (i === this.me ? [] : [x.kind === 'ai' ? x.difficulty ?? this.config.difficulty : 'human'])),
    };
    const riichiInsight =
      g.profile.riichi && this.stats.riichiWins > 0
        ? tr('Your riichi paid off. Declaring locks your hand but adds han and a chance at ura dora.')
        : g.profile.riichi && this.stats.riichis === 0 && this.stats.handsWon === 0
          ? tr('Try declaring riichi when your closed hand is ready. It is the easiest yaku to get.')
          : g.profile.riichi && this.stats.calls >= 3 && this.stats.handsWon === 0
            ? tr('Open calls need a yaku of their own. Keep the hand closed unless you hold a value pair or all simples.')
            : null;
    const insight =
      riichiInsight ??
      (this.stats.dealIns === 0 && this.stats.handsPlayed > 1
        ? tr('Excellent defensive play. You never fed a winning tile.')
        : this.stats.selfDraws > 0
          ? tr('Strong hand building. You completed a hand on your own draw.')
          : this.stats.calls >= 3
            ? tr('Fast, open play. Calling often speeds you up but shows your hand.')
            : this.stats.handsWon === 0
              ? tr('Try following JongBot’s discards for a hand or two to feel the rhythm.')
              : tr('Solid game. Keep an eye on what opponents discard.'));
    const replay: ReplayRecord = {
      id: `${Date.now().toString(36)}-${this.matchSeed.toString(36)}`,
      date: new Date().toISOString(),
      config: this.config,
      names: g.players.map((p) => p.name),
      me: this.spectator ? -1 : this.me,
      matchSeed: this.matchSeed,
      hands: this.record,
      start: this.opts.resume ? { ...this.opts.resume } : this.firstDealer,
      finalScores: g.players.map((p) => p.score),
      placement,
      mode: this.opts.mode ?? 'ai',
    };
    this.opts.link?.close();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKey);
    this.releaseStage();
    this.hooks.onFinished(summary, standings, insight, replay);
  }
}

/** A dry-brush sweep under the win word (one path, tinted by CSS). */
const BRUSH_SVG = `<svg viewBox="0 0 600 120" preserveAspectRatio="none"><path d="M18 74 C 90 52, 170 40, 260 44 C 350 48, 420 58, 520 50 C 560 47, 584 44, 590 46 C 560 60, 500 70, 430 74 C 330 80, 250 84, 160 86 C 100 87, 52 84, 18 74 Z" /><path class="dry" d="M40 80 C 140 70, 300 66, 470 64 M60 70 C 200 58, 360 56, 540 54" /></svg>`;

let brushFont = false;
/** A brush-calligraphy face for the seal characters, loaded on the first win (falls back to the serif). */
function ensureBrushFont() {
  if (brushFont) return;
  brushFont = true;
  try {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&text=%E8%87%AA%E6%91%B8%E5%92%8C&display=swap';
    document.head.append(l);
  } catch {
    /* the serif fallback is fine */
  }
}

/** Circumference of the countdown ring (r = 19 in a 44 box). */
const RING_C = 2 * Math.PI * 19;

/** The countdown: a thin brass ring that empties clockwise, the seconds in its middle. */
function timerRing(): HTMLElement {
  const el = h('div', { class: 'timer', role: 'timer', hidden: true });
  el.innerHTML = `<svg viewBox="0 0 44 44" aria-hidden="true"><circle class="t-track" cx="22" cy="22" r="19"/><circle class="t-arc" cx="22" cy="22" r="19" stroke-dasharray="${RING_C.toFixed(2)}" stroke-dashoffset="0"/></svg><span class="t-num"></span>`;
  return el;
}

/** A seat's net from a list of payments. */
function netOf(pays: Payment[], seat: number): number {
  return pays.reduce((a, p) => a + (p.to === seat ? p.amount : 0) - (p.from === seat ? p.amount : 0), 0);
}

const PREY: Record<number, [number, string]> = { [CAT]: [MOUSE, tr('Cat catches Mouse')], [MOUSE]: [CAT, tr('Cat catches Mouse')], [ROOSTER]: [CENTIPEDE, tr('Rooster eats Centipede')], [CENTIPEDE]: [ROOSTER, tr('Rooster eats Centipede')] };

/** Why a newly set-aside animal pays out, given every bonus kind the seat now holds. */
function biteName(kind: number, held: number[]): string {
  const parts: string[] = [];
  const prey = PREY[kind];
  if (prey && held.includes(prey[0])) parts.push(tr('{name} bite', { name: prey[1] }));
  if ([0, 1, 2, 3].every((i) => held.includes(ANIMAL_BASE + i))) parts.push(tr('All four animals'));
  return parts.join(' + ');
}

interface InstantLine {
  /** Who collected (-1 when the cause is not known). */
  seat: number;
  why: string;
  pays: Payment[];
}

/**
 * Explain a hand's on-the-spot payments. Payments carry no reason, so walk
 * the hand's log and ask the profile which events paid what, matching the
 * recorded payments in order (the deal pays double, so both are tried).
 */
function instantLines(g: MahjongGame, r: HandResult): InstantLine[] {
  const inst = r.instant ?? [];
  const f = g.profile.instantPayments;
  const out: InstantLine[] = [];
  if (!inst.length) return out;
  let i = 0;
  const matches = (pays: Payment[]) => pays.length > 0 && pays.every((p, k) => inst[i + k] && inst[i + k].from === p.from && inst[i + k].to === p.to && inst[i + k].amount === p.amount);
  const take = (seat: number, why: string, pays: Payment[]) => {
    out.push({ seat, why, pays });
    i += pays.length;
  };
  if (f) {
    const held: number[][] = g.players.map(() => []);
    for (const e of g.state.log) {
      if (i >= inst.length) break;
      if (e.type === 'flower') {
        held[e.seat].push(e.tile.kind);
        for (const dealing of [false, true]) {
          const pays = f({ type: 'bonus', seat: e.seat, kind: e.tile.kind, held: [...held[e.seat]], dealing }, g.profile.players);
          if (matches(pays)) {
            const name = biteName(e.tile.kind, held[e.seat]) || tr('{tile} bonus', { tile: tileLabel(e.tile.kind) });
            take(e.seat, dealing ? tr('{name} (in the deal, double)', { name }) : name, pays);
            break;
          }
        }
      } else if (e.type === 'call' && e.claim === 'kong') {
        const concealed = e.meld.concealed;
        const pays = f({ type: 'kong', seat: e.seat, concealed }, g.profile.players);
        if (matches(pays)) take(e.seat, concealed ? tr('Concealed kong of {tile}', { tile: tileLabel(e.meld.tiles[0].kind) }) : tr('Kong of {tile}', { tile: tileLabel(e.meld.tiles[0].kind) }), pays);
      }
    }
  }
  if (i < inst.length) out.push({ seat: -1, why: tr('Paid during the hand'), pays: inst.slice(i) });
  return out;
}

/** Passport names for the planner and the chips: "3 Knits in the same 2 suits ×2" when one repeats. */
function passportNames(names: string[]): string {
  return names.map((n, i) => (names.indexOf(n) < i ? null : names.filter((x) => x === n).length > 1 ? `${tr(n)} ×2` : tr(n))).filter(Boolean).join(' + ');
}

/** How far a passport hand is, as JongBot says it everywhere else. */
function passportAway(shanten: number): string {
  if (shanten < 0) return tr('Complete');
  if (shanten >= 99) return tr('no win possible with these sets');
  return shanten === 0 ? tr('ready') : trn(shanten, '{n} tile from ready', '{n} tiles from ready');
}
