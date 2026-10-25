// App shell: navigation, the match lifecycle and replays. The screens live in
// their own modules (screens/ for home, play, learn, results and settings).

import { lastTable, rememberTable } from './lastTable';
import { refreshLocation } from '../club/location';
import { sound } from '../audio/sound';
import { narrator } from '../audio/voice';
import { getProfile } from '../engine/rules';
import { classicProfile } from '../engine/rules/classic';
import { forfeitRanked, loadProfile, saveProfile, type Profile } from '../progression/profile';
import { TableRenderer } from '../render/table3d';
import { LESSONS } from './academy';
import { TutorialCoach } from './coach';
import { atelierScreen, collectionScreen } from './screens/collection';
import { resetFourWinds, dailyOnHand, dailyScreen, rankedFieldFromTag, tournamentOnFinish, tournamentsScreen } from './compete';
import type { AppCtx, Screen } from './ctx';
import { passportScreen } from './social';
import { profileScreen } from './screens/profile';
import { clubScreen } from './screens/club';
import { seasonsScreen } from './seasons';
import { ambience } from '../audio/ambience';
import { DEFAULT_AVATAR, HAIR_COLORS, SKIN_TONES, VARIATION_TABLE, tileSetStyle, type AvatarSpec } from '../cosmetics/catalog';
import { withBotAccessories } from '../cosmetics/avatar';
import { clear, h } from './dom';
import { MatchController, type MatchOptions, type TableConfig } from './match';
import { renameMe, type ReplayRecord } from '../net/replay';
import { Club, type TableSession, type Who } from '../net/session';
import { joinTable, tableFromLink, type LiveHost } from './live';
import { takeClubInvite } from '../club/privateClubs';
import { ReplayViewer } from './replay';
import { versionsScreen } from './versions';
import { CoachMode, withCoachMode } from './coachMode';
import { brandSvg, brandWordmark } from '../brand';
import { phoneNav, type PhoneNav } from './tabbar';
import { ACCOUNT_EVENT } from '../auth/prompt';
import { syncProfileDown } from '../progression/cloudSync';
import { tr } from '../i18n';
import { DEFAULT_TABLE, tableFor, type Lesson } from './screens/tables';
import { homeScreen } from './screens/home';
import { playScreen } from './screens/play';
import { autostartLesson, learnScreen } from './screens/learn';
import { refreshResultsName, showResults } from './screens/results';
import { labsHost, loadSettings, persistSettings, showSettings, type StoredSettings } from './screens/settings';
import { devPanel, labsButton } from '../dev/panel';
import { icon } from './icons';
import { applyVolumes, musicButton } from './musicToggle';
import { minigamesScreen } from './screens/minigames';
import type { MiniApp } from '../minigames/play';


const NAV: { id: Screen; label: string }[] = [
  { id: 'home', label: tr('Home') },
  { id: 'play', label: tr('Play') },
  { id: 'minigames', label: tr('Mini-games') },
  { id: 'versions', label: tr('Variations') },
  { id: 'learn', label: tr('Learn') },
  { id: 'daily', label: tr('Daily') },
  { id: 'passport', label: tr('World Tour') },
  { id: 'club', label: tr('Club') },
  { id: 'collection', label: tr('Collection') },
  { id: 'profile', label: tr('Profile') },
];

/** Screens reached from inside another tab. */
const NAV_PARENT: Partial<Record<Screen, Screen>> = { tournaments: 'play', atelier: 'collection', seasons: 'club' };

export class App {
  profile: Profile = loadProfile();
  settings: StoredSettings = loadSettings();
  readonly table: TableRenderer;
  private shell: HTMLElement;
  main: HTMLElement;
  private hud: HTMLElement;
  modal: HTMLElement;
  screen: Screen = 'home';
  match: MatchController | null = null;
  lastConfig: TableConfig = lastTable();
  lastOpts: MatchOptions = {};
  curTag: string | undefined;
  private navEl: HTMLElement;
  /** Five tabs at the foot on phones (tabbar.ts). */
  private phone: PhoneNav;
  club: Club | null = null;
  live: TableSession | null = null;
  replay: ReplayViewer | null = null;

  constructor(root: HTMLElement) {
    const stage = h('div', { id: 'stage' });
    this.hud = h('div', { id: 'hud', hidden: true });
    this.main = h('main', { id: 'screen' });
    this.navEl = h('nav', { class: 'nav', 'aria-label': tr('Main') });
    this.phone = phoneNav((s) => this.go(s), () => this.openSettings(), () => sound.play('button'));
    this.navEl.addEventListener('scroll', this.navEdges, { passive: true });
    window.addEventListener('resize', this.navEdges);
    this.shell = h(
      'div',
      { id: 'shell' },
      h(
        'header',
        { class: 'topbar' },
        h('button', { class: 'wordmark-sm', onclick: () => this.go('home'), 'aria-label': 'JongClub home' }, h('span', { class: 'brand-mark', 'aria-hidden': 'true', html: brandSvg('mark') }), brandWordmark()),
        this.navEl,
        h('div', { class: 'topbar-tools' }, labsButton(() => this.openLabs()), musicButton(this.settings, () => persistSettings(this)), h('button', { class: 'icon-btn', 'aria-label': tr('Settings'), onclick: () => this.openSettings(), html: icon('settings') })),
      ),
      this.phone.sub,
      this.main,
      this.phone.bar,
    );
    this.modal = h('div', { id: 'modal', hidden: true, role: 'dialog', 'aria-modal': 'true' });
    root.append(stage, this.shell, this.hud, this.modal);
    this.wireModal();

    try {
      this.table = new TableRenderer(stage);
    } catch (e) {
      // No WebGL (switched off, or a blocked graphics driver): say so instead of a blank page.
      root.append(h('div', { class: 'card no-webgl', role: 'alert', style: { margin: '20vh auto', position: 'relative', zIndex: '99' } }, h('h3', {}, tr('The 3D table needs WebGL')), h('p', { class: 'muted' }, tr('Your browser has 3D graphics switched off or blocked. Turn on WebGL or hardware acceleration in its settings, or try another browser, then reload.'))));
      throw e;
    }
    this.table.speed = this.settings.speed;
    this.table.labels = this.settings.labels;
    this.table.discardSetting = this.settings.discardLayout ?? 'auto';
    this.table.onAmbient = (w) => this.screen === 'home' && !this.match && sound.play(w === 'shuffle' ? 'shuffle' : 'slide');
    applyVolumes(this.settings);

    // Audio needs a gesture; the first tap anywhere unlocks it.
    const unlock = () => {
      sound.unlock();
      window.removeEventListener('pointerdown', unlock);
    };
    window.addEventListener('pointerdown', unlock);

    const hash = location.hash.slice(1) as Screen;
    // A table from an invite link (?table=CODE) or the older #join=CODE.
    const joinCode = /^join=([a-z2-9]{5})$/i.exec(location.hash.slice(1))?.[1]?.toLowerCase() ?? tableFromLink();
    const SCREENS: Screen[] = ['home', 'play', 'versions', 'learn', 'passport', 'club', 'collection', 'profile', 'daily', 'tournaments', 'atelier', 'minigames', 'seasons'];
    // A club invite link (?club=CODE) opens the Club screen, which opens the clubs page.
    this.go(joinCode ? 'play' : takeClubInvite() ? 'club' : SCREENS.includes(hash) ? hash : 'home');
    window.addEventListener('hashchange', () => {
      const h = location.hash.slice(1) as Screen;
      if (SCREENS.includes(h) && h !== this.screen && !this.match && !this.replay) this.go(h);
    });
    this.applyLoadout();
    // City and country for the leaderboards: from the IP address (or GPS once allowed), quietly, once per launch.
    void refreshLocation(this.profile).then((changed) => {
      if (!changed) return;
      saveProfile(this.profile);
      if ((this.screen === 'profile' || this.screen === 'club') && !this.match && this.modal.hidden) this.go(this.screen);
    });

    // Signing in from a "Save your progress?" offer: load that account's profile in place.
    window.addEventListener(ACCOUNT_EVENT, async () => {
      const before = this.profile.name;
      await syncProfileDown();
      const next = loadProfile();
      for (const k of Object.keys(this.profile)) delete (this.profile as unknown as Record<string, unknown>)[k];
      Object.assign(this.profile, next);
      this.applyLoadout();
      // The game just played (and any saved before it) now carries the account's name, not "Guest".
      if (before !== this.profile.name) {
        renameMe(before, this.profile.name);
        refreshResultsName();
      }
      if (!this.match && !this.replay && this.modal.hidden) this.go(this.screen);
    });

    // Live play lights up when the page runs where the club room exists.
    void Club.connect(this.who()).then((c) => {
      this.club = c;
      // Home, Play and Club enable their Host / Join controls once the club answers.
      if (c && !this.match && (this.screen === 'home' || this.screen === 'play' || this.screen === 'club')) this.go(this.screen);
      // An invite link opens its table straight away.
      if (c && joinCode && !this.match) void joinTable(this.liveHost(), joinCode, false);
    });
  }

  /**
   * Dialogs: while one is open the page behind it is inert (Tab stays in the dialog),
   * focus moves into it, Escape closes the ones that can simply be dismissed, and
   * focus goes back where it was when it closes.
   */
  private wireModal() {
    const o = this.modal;
    let back: HTMLElement | null = null;
    new MutationObserver(() => {
      const open = !o.hidden;
      this.shell.inert = open;
      this.hud.inert = open;
      if (open) {
        if (o.contains(document.activeElement)) return;
        back ??= document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
        queueMicrotask(() => !o.hidden && !o.contains(document.activeElement) && (o.querySelector<HTMLElement>('.btn.primary:not(:disabled)') ?? o.querySelector<HTMLElement>('button:not(:disabled), select, input, [tabindex]'))?.focus({ preventScroll: true }));
      } else {
        const b = back;
        back = null;
        if (b?.isConnected && !b.closest('[inert], [hidden]')) b.focus({ preventScroll: true });
      }
    }).observe(o, { attributes: true, attributeFilter: ['hidden'], childList: true });
    // Listen on the document: a click on a dialog's text moves focus to the page body, and Escape must still close it.
    document.addEventListener('keydown', (e) => {
      // Results and the waiting room have their own way out; the sign-in screen sits above and handles its own keys.
      if (e.key === 'Escape' && !o.hidden && !o.querySelector('.results, .waiting-room') && !document.querySelector('.auth')) o.hidden = true;
    });
    // A tap on the dimmed backdrop closes the same dialogs Escape does.
    o.addEventListener('click', (e) => {
      if (e.target === o && !o.querySelector('.results, .waiting-room')) o.hidden = true;
    });
  }

  who(): Who {
    return { name: this.profile.name, avatar: this.profile.avatar };
  }

  liveHost(): LiveHost {
    return {
      club: this.club,
      who: () => this.who(),
      rating: () => this.profile.rating,
      modal: this.modal,
      startMatch: (cfg, opts) => this.startMatch(cfg, opts),
      onSessionEnd: () => {
        void this.live?.leave();
        this.live = null;
        if (this.match) {
          this.match.abort();
        } else if (this.screen === 'play') this.go('play');
      },
      liveStarted: (s) => (this.live = s),
    };
  }

  // ------------------------------------------------------------ navigation

  go(screen: Screen) {
    narrator.stop();
    this.screen = screen;
    try {
      history.replaceState(null, '', `#${screen}`);
    } catch {
      /* sandboxed */
    }
    const same = this.rendered === screen;
    this.rendered = screen;
    // Keep the tab strip where it is (rebuilding it would jump back to the start),
    // and only bring the chosen tab into view inside the strip itself.
    if (!this.navEl.childElementCount)
      for (const n of NAV) this.navEl.append(h('button', { class: 'nav-item', 'data-screen': n.id, onclick: () => (sound.play('button'), this.go(n.id)) }, n.label));
    // Screens without a tab of their own light up the tab they live under.
    const tab = NAV_PARENT[screen] ?? screen;
    for (const b of this.navEl.querySelectorAll<HTMLElement>('.nav-item')) {
      const on = b.dataset.screen === tab;
      b.classList.toggle('on', on);
      if (on && tab === screen) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
      if (on) {
        const nav = this.navEl;
        // Both edges of a scrolling strip fade out, so a tab under a fade counts as hidden.
        const nr = nav.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        if (nav.scrollWidth > nav.clientWidth && (br.left < nr.left + 48 || br.right > nr.right - 48)) nav.scrollTo({ left: nav.scrollLeft + br.left - nr.left - (nr.width - br.width) / 2, behavior: 'smooth' });
      }
    }
    this.phone.update(screen);
    this.navEdges();
    this.shell.classList.toggle('is-home', screen === 'home');
    // Re-rendering the same screen (a tab or filter inside it) keeps your place.
    const keep = same ? this.main.scrollTop : 0;
    const m = clear(this.main);
    const c = this.ctx();
    const view = { home: () => homeScreen(this), play: () => playScreen(this), versions: () => versionsScreen(c), learn: () => learnScreen(this), passport: () => passportScreen(c), club: () => clubScreen(c), collection: () => collectionScreen(c), profile: () => profileScreen(c), daily: () => dailyScreen(c), tournaments: () => tournamentsScreen(c), atelier: () => atelierScreen(c), seasons: () => seasonsScreen(c), minigames: () => minigamesScreen(this.miniApp()) }[screen]();
    m.append(view);
    m.scrollTop = keep;
  }

  private rendered: Screen | null = null;

  /** Fade whichever edge of the tab strip has more tabs past it, so a cut-off tab reads as "scroll for more". */
  private navEdges = () => {
    const n = this.navEl;
    n.classList.toggle('more-l', n.scrollLeft > 4);
    n.classList.toggle('more-r', n.scrollLeft + n.clientWidth < n.scrollWidth - 4);
  };

  /** Scroll the screen to a section without moving the page that hosts the app. */
  /** Scroll Learn so the open lesson's card is in view. */
  scrollToLesson(smooth = true) {
    const el = this.main.querySelector<HTMLElement>('.lx-current');
    if (!el) return;
    const m = this.main;
    m.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top - m.getBoundingClientRect().top + m.scrollTop - 8), behavior: smooth ? 'smooth' : 'auto' });
  }

  scrollToId(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    const m = this.main;
    m.scrollTo({ top: el.getBoundingClientRect().top - m.getBoundingClientRect().top + m.scrollTop - 8, behavior: 'smooth' });
  }

  // ------------------------------------------------------------ learn

  learnLesson: Lesson = 'basics';

  guidedVariation = 'classic';
  /** The lesson a themed guided game follows ('words', 'tradition'), if any. */
  guidedTheme: string | undefined;

  /** The guided game: one hand of a variation at a gentle table, with Mei commentating. A theme gives Mei that lesson's script. */
  startGuided(variation = 'classic', theme?: string) {
    if (!getProfile(variation)) variation = 'classic';
    this.guidedVariation = variation;
    this.guidedTheme = theme;
    this.settings.hintDepth = 'learning';
    const base = variation === 'classic' ? DEFAULT_TABLE : tableFor(variation);
    this.startMatch({ ...base, name: tr('Guided Game'), length: 'oneHand', difficulty: 'beginner', personalities: ['teacher', 'zen', 'teacher'], hints: true, timer: 0, pace: 'untimed' }, { tag: 'tutorial', coach: new TutorialCoach(variation, theme) });
  }

  // ------------------------------------------------------------ screens in their own modules

  ctx(): AppCtx {
    return {
      profile: this.profile,
      labels: this.settings.labels,
      modal: this.modal,
      club: this.club,
      save: () => saveProfile(this.profile),
      go: (s) => this.go(s),
      startMatch: (cfg, opts) => this.startMatch(cfg, opts),
      openReplay: (r) => this.openReplay(r),
      who: () => this.who(),
      applyLoadout: () => this.applyLoadout(),
      tableFor,
      startGuided: (v, t) => this.startGuided(v, t),
      liveHost: () => this.liveHost(),
      openLesson: (l) => {
        // A variation without its own lesson yet opens the basics.
        this.learnLesson = (l in LESSONS ? l : 'basics') as Lesson;
        autostartLesson();
        this.go('learn');
        // The lesson starts at once, so bring its card into view (it sits below the placement and drills cards).
        this.main.scrollTop = 0;
        requestAnimationFrame(() => this.scrollToLesson(false));
      },
    };
  }

  /** Put the equipped cosmetics on the table. `variation` picks the table when set to each variation's own. */
  applyLoadout(variation?: string) {
    const l = this.profile.loadout;
    const t = this.table;
    t.setTileSet(l.tileSet);
    t.setRackStyle(l.rack);
    t.setTableStyle(l.table === 'auto' ? (variation ? VARIATION_TABLE[variation] ?? 'classic-green' : 'classic-green') : l.table);
    t.setEnvironment(l.environment);
    ambience.set(l.environment);
    t.setTableEffect(l.tableEffect);
    const st = tileSetStyle(l.tileSet);
    sound.setMaterial(l.sound === 'sound-bamboo' ? 'bamboo' : l.sound === 'sound-glass' ? 'glass' : st.material);
  }

  // ------------------------------------------------------------ match lifecycle

  startMatch(cfg: TableConfig, opts: MatchOptions = {}) {
    narrator.stop();
    sound.unlock();
    sound.play('button');
    this.lastConfig = structuredClone(cfg);
    // An ordinary AI table (not a daily, tournament or live game) is the one Quick Start replays.
    if (!opts.tag && !opts.link && (!opts.mode || opts.mode === 'ai' || opts.mode === 'casual')) rememberTable(cfg);
    this.lastOpts = opts.link ? {} : { ...opts, seed: undefined };
    opts = withCoachMode(cfg, opts);
    this.curTag = opts.tag;
    if (opts.tag === 'daily:fourWinds') resetFourWinds();
    this.shell.hidden = true;
    this.hud.hidden = false;
    this.match = new MatchController(this.table, this.hud, structuredClone(cfg), this.settings, this.profile.name, {
      onExit: () => this.endMatch(),
      onFinished: (summary, standings, insight, replay) => showResults(this, summary, standings, insight, replay),
      openSettings: () => this.openSettings(),
      openLabs: () => this.openLabs(),
      musicButton: () => musicButton(this.settings, () => persistSettings(this), 'icon-btn music-btn'),
      saveSettings: () => persistSettings(this),
      onHand: (r, g, me) => {
        if (r.type === 'win' && r.winner === me && me >= 0) this.table.playWinAnimation(this.profile.loadout.winAnimation, this.table.seatAnchor(me));
        if (opts.tag?.startsWith('daily:')) dailyOnHand(this.ctx(), opts.tag, r, g, me);
      },
    }, opts);
    if (opts.coach instanceof CoachMode) opts.coach.attach(this.match.game, this.match.me, cfg.hints);
    this.applyLoadout(cfg.variation);
    this.match.avatars = this.match.seats.map((x, i) => (i === this.match!.me ? this.profile.avatar : x.kind === 'ai' ? withBotAccessories(x.avatar ?? avatarForName(x.name), x.name) : (x.avatar ?? avatarForName(x.name))));
    this.table.setSeatAvatars(this.match.avatars.map((a, i) => (i === this.match!.me ? null : a)));
    this.match.run();
  }

  private endMatch() {
    this.lastOpts.coach?.stop();
    this.match?.opts.coach?.stop();
    // Leaving a ranked or tournament game early counts as finishing last there.
    const m = this.match;
    if (m && !m.spectator) {
      if (this.curTag?.startsWith('ranked:')) forfeitRanked(this.profile, this.lastConfig.variation, rankedFieldFromTag(this.curTag) ?? undefined);
      else if (this.curTag === 'tournament') {
        const scores = m.game.players.map((p) => p.score);
        const low = Math.min(...scores.filter((_, i) => i !== m.me));
        tournamentOnFinish(this.ctx(), scores.map((score, seat) => ({ seat, score: seat === m.me ? Math.min(score, low - 1) : score })), () => this.screen === 'tournaments' && !this.match && this.go('tournaments'));
      }
    }
    if (this.live) {
      void this.live.leave();
      this.live = null;
    }
    this.match = null;
    this.hud.hidden = true;
    clear(this.hud);
    this.shell.hidden = false;
    this.table.idle();
    this.go(this.screen === 'home' ? 'home' : 'play');
  }

  /** Step through a saved game on the table. */
  openReplay(rec: ReplayRecord, start?: { hand: number; step: number }) {
    if (this.replay) return;
    const back: Screen = this.screen === 'profile' ? 'profile' : 'play';
    narrator.stop();
    this.shell.hidden = true;
    this.hud.hidden = false;
    this.table.setFelt((getProfile(rec.config.variation) ?? classicProfile).felt);
    this.replay = new ReplayViewer(this.table, this.hud, rec, this.settings.labels, () => {
      this.replay = null;
      this.hud.hidden = true;
      this.shell.hidden = false;
      this.table.humanSeat = 0;
      this.table.seatCount = 4;
      this.table.idle();
      this.go(back);
    }, start);
  }

  closeMatchUi() {
    if (this.match?.opts.coach instanceof CoachMode) this.match.opts.coach.stop();
    this.match = null;
    this.hud.hidden = true;
    clear(this.hud);
    this.shell.hidden = false;
    this.table.idle();
  }

  // ------------------------------------------------------------ mini-games (src/minigames, screens/minigames.ts)

  private mini: MiniApp | null = null;

  /** What a mini-game needs from the shell: the table, the HUD layer and your profile. */
  miniApp(): MiniApp & { go(s: 'minigames'): void } {
    const app = this;
    this.mini ??= {
      table: this.table,
      hud: this.hud,
      modal: this.modal,
      get profile() {
        return app.profile;
      },
      get labels() {
        return app.settings.labels;
      },
      saveProfile: () => saveProfile(this.profile),
      setPlaying: (on) => {
        narrator.stop();
        this.shell.hidden = on;
        this.hud.hidden = !on;
        this.hud.classList.toggle('mini-playing', on);
        if (on) sound.unlock();
      },
      backToHub: () => this.go('minigames'),
      winEffect: () => this.profile.loadout.winAnimation,
    };
    return this.mini as MiniApp & { go(s: 'minigames'): void };
  }

  // ------------------------------------------------------------ settings (screens/settings.ts)

  openSettings() {
    showSettings(this);
  }

  /** Labs: testing tools (src/dev/panel.ts). */
  openLabs() {
    devPanel(labsHost(this));
  }
}

/** A stable, varied look for players who have not chosen an avatar. */
function avatarForName(name: string): AvatarSpec {
  let n = 0;
  for (const c of name) n = (n * 31 + c.charCodeAt(0)) >>> 0;
  const pick = <T,>(a: readonly T[], k: number) => a[Math.floor(n / k) % a.length];
  const hair: AvatarSpec['hair'][] = ['short', 'long', 'bun', 'bob', 'shaved', 'wavy'];
  const outfit: AvatarSpec['outfit'][] = ['blazer', 'suit', 'qipao', 'kimono', 'kandura', 'sweater'];
  return { ...DEFAULT_AVATAR, skin: n % SKIN_TONES.length, hair: pick(hair, 7), hairColor: pick(HAIR_COLORS, 11), outfit: pick(outfit, 13), outfitColor: pick(['#1f3b33', '#141414', '#7a1f1b', '#1a2440', '#5a4321'], 17) };
}
