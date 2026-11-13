// Runs one mini-game on the table: builds the board, the camera, the HUD
// (stats, tools, toasts) and the host the game talks to, ticks the clock, and
// on finish shows the result sheet and pays Jong Points.

import * as THREE from 'three';
import { Rng, randomSeed } from '../engine/rng';
import { sound } from '../audio/sound';
import { narrator } from '../audio/voice';
import { fmt, h } from '../ui/dom';
import { icon } from '../ui/icons';
import { tr } from '../i18n';
import type { TableRenderer } from '../render/table3d';
import type { Profile } from '../progression/profile';
import { qualitySpec, tierFaceDetail } from '../render/quality';
import { TileBoard } from './board';
import { holdMiniIcons } from './icons';
import { BoardCamera, CUBE_LIMITS, FLAT_LIMITS } from './camera';
import { MiniStage } from './stage';
import { Sparkle } from './sparkle';
import { setLiveMini } from './historyGuard';
import { TOOL_ICONS, toolSvg } from './toolIcons';
import { MINI_DAILY_CAP, bestKey, earnedToday, payout, recordResult, suggestAfter } from './progress';
import { howToLine } from './narration';
import type { MiniGameDef, MiniHost, MiniLevel, MiniResult, MiniSession } from './types';

/** What the play shell needs from the app. */
export interface MiniApp {
  table: TableRenderer;
  hud: HTMLElement;
  modal: HTMLElement;
  profile: Profile;
  labels: boolean;
  saveProfile(): void;
  /** Hide the lobby and show the HUD layer (true), or the reverse. */
  setPlaying(on: boolean): void;
  /** Back to the mini-games hub. */
  backToHub(): void;
  /** The equipped win effect id. */
  winEffect(): string;
}

export interface MiniStart {
  level: MiniLevel;
  options: Record<string, string>;
  seed?: number;
  daily?: boolean;
}

export const levelName = (l: MiniLevel) => ({ easy: tr('Easy'), medium: tr('Medium'), hard: tr('Hard') })[l];

export class MiniPlay {
  private board: TileBoard;
  private cam = new BoardCamera();
  private stage: MiniStage;
  private sparkle = new Sparkle();
  private session!: MiniSession;
  private host!: MiniHost;
  private root: HTMLElement;
  private stats = new Map<string, HTMLElement>();
  private statsEl: HTMLElement;
  private toastEl: HTMLElement;
  private tools = new Map<string, HTMLButtonElement>();
  private timer = 0;
  private finished = false;
  private counts = { hints: 0, undos: 0, shuffles: 0 };
  private hover: number | null = null;
  private seed: number;
  private paused = false;
  /** When the player last did anything; a move is suggested after a pause (suggestAfter seconds). */
  private idleAt = performance.now();
  private suggested = false;
  private ticks = 0;
  private readonly poke = () => {
    this.idleAt = performance.now();
    this.suggested = false;
    if (this.board.pulsingIds.length) this.board.pulse([]);
    this.tools.get('shuffle')?.classList.remove('nudge');
  };
  private onResize = () => this.layoutInsets(true);
  // Coming back to the tab resumes only when no sheet is open (a sheet keeps the game paused).
  private onVis = () => this.setPaused(document.hidden || !this.app.modal.hidden || this.finished);
  /** Left or replaced: late timers, finishes and sheets of this game do nothing from then on. */
  private disposed = false;
  /** The hash of the hub the game was started from; the game adds one history entry on top of it. */
  private hash = '';
  /**
   * The browser's Back mid-game asks before leaving (the board would be lost), and Back on a
   * finished game goes to the hub. The entry is put back so the game keeps its place in history.
   */
  private onPop = () => {
    if (this.disposed) return;
    narrator.stop();
    if (this.finished) {
      this.app.modal.hidden = true;
      this.leave(false);
      return;
    }
    this.pushEntry();
    this.askLeave();
  };
  private pushEntry() {
    try {
      history.pushState({ mini: this.def.id }, '', this.hash || location.hash);
    } catch {
      /* sandboxed */
    }
  }

  constructor(private app: MiniApp, private def: MiniGameDef, private start: MiniStart) {
    const t = app.table;
    this.seed = start.seed ?? randomSeed();
    // Faces at the tier's full detail, drawn quick first and sharpened while no tile travels (hover
    // and highlights don't count), with the tier's anisotropy so slanted faces stay crisp up close.
    // The board holds the only copy on the GPU: the table's own faces are released while a
    // mini-game is open (releaseTableFaces), so graphics memory stays as at the table.
    const spec = qualitySpec(t.quality);
    const lean = !!(t as unknown as { memTight?: boolean }).memTight;
    this.board = new TileBoard({
      shape: def.shape ?? 'tile',
      scale: def.shape === 'cube' ? 1.25 : 1.32,
      labels: app.labels,
      lowTier: t.quality === 'low',
      // The same detail as the table's faces (lean devices 2.25, tierFaceDetail), so both share one drawing.
      detail: lean ? Math.min(2.25, spec.faceScale) : tierFaceDetail(spec),
      // Few kinds, big tiles (Memory, Match-3): the table's hand detail.
      fewDetail: lean ? 3 : { high: 6, medium: 4.5, low: 3.25 }[t.quality],
      previewDetail: 2.25,
      anisotropy: Math.min(spec.anisotropy, t.renderer.capabilities.getMaxAnisotropy()),
      renderer: t.renderer,
      onSharpen: () => this.stage.wake(200),
      dynamic: !!def.dynamicKinds,
    });
    this.board.root.add(this.sparkle.points);
    this.cam.limits = def.shape === 'cube' ? CUBE_LIMITS : FLAT_LIMITS;
    this.stage = new MiniStage(t);
    this.statsEl = h('div', { class: 'mini-stats', 'aria-live': 'polite' });
    this.toastEl = h('div', { class: 'mini-toast', role: 'status' });
    this.root = this.buildHud();
  }

  // ------------------------------------------------------------ HUD

  private buildHud(): HTMLElement {
    const def = this.def;
    const tool = (id: keyof typeof TOOL_ICONS, label: string, on: () => void) => {
      const b = h('button', { type: 'button', class: 'mini-tool', 'aria-label': label, title: label, onclick: () => (sound.play('button'), on()) }, h('span', { class: 'mt-icon', html: toolSvg(id) }), h('span', { class: 'mt-label' }, label), h('span', { class: 'mt-badge', hidden: true }));
      this.tools.set(id, b);
      return b;
    };
    const tl = def.tools ?? {};
    const bar = h(
      'div',
      { class: 'mini-tools mini-ui' },
      tl.hint ? tool('hint', tr('Hint'), () => this.useHint()) : null,
      tl.undo ? tool('undo', tr('Undo'), () => this.useUndo()) : null,
      tl.shuffle ? tool('shuffle', tr('Shuffle'), () => this.useShuffle()) : null,
      def.shape === 'cube' ? tool('turnL', tr('Turn left'), () => this.cam.turn(-90)) : null,
      def.shape === 'cube' ? tool('turnR', tr('Turn right'), () => this.cam.turn(90)) : null,
      tool('view', tr('Reset view'), () => this.cam.reset()),
    );
    const top = h(
      'div',
      { class: 'mini-top mini-ui' },
      h(
        'div',
        { class: 'mini-title' },
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': tr('Leave game'), title: tr('Leave game'), onclick: () => this.askLeave(), html: icon('close') }),
        h('div', {}, h('div', { class: 'mini-name' }, def.title), h('div', { class: 'mini-sub' }, this.start.daily ? tr('Daily puzzle') : levelName(this.start.level))),
      ),
      this.statsEl,
      h(
        'div',
        { class: 'mini-actions' },
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': tr('How to play'), title: tr('How to play'), onclick: () => this.showHelp(), html: toolSvg('help') }),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': tr('New board'), title: tr('New board'), onclick: () => this.askRestart(), html: toolSvg('restart') }),
      ),
    );
    const layer = h('div', { class: 'mini-layer' });
    this.cam.attach(layer);
    this.cam.onTap = (x, y) => {
      const id = this.board.pick(x, y, this.app.table.camera, this.app.table.renderer.domElement);
      if (this.finished || this.paused) return;
      if (id !== null) this.session.onPick(id);
      else this.session.onEmptyTap?.(x, y, this.app.table.camera, this.app.table.renderer.domElement);
    };
    // Swipes (Match-3): a drag that starts on a tile moves that tile instead of turning the view.
    this.cam.onDragStart = (x, y) => !!this.session?.onSwipe && !this.finished && !this.paused && this.board.pick(x, y, this.app.table.camera, this.app.table.renderer.domElement) !== null;
    this.cam.onSwipe = (sx, sy, x, y) => {
      const el = this.app.table.renderer.domElement;
      const id = this.board.pick(sx, sy, this.app.table.camera, el);
      const pose = id === null ? null : this.board.pose(id);
      if (id === null || !pose) return;
      const a = this.boardPoint(sx, sy, pose.pos.y),
        b = this.boardPoint(x, y, pose.pos.y);
      if (a && b) this.session.onSwipe?.(id, b.x - a.x, b.z - a.z);
    };
    let hoverAt = 0;
    this.cam.onHover = (x, y) => {
      const now = performance.now();
      if (now - hoverAt < 40) return;
      hoverAt = now;
      const id = this.board.pick(x, y, this.app.table.camera, this.app.table.renderer.domElement);
      if (id === this.hover) return;
      if (this.hover !== null && this.board.look(this.hover) === 'hover') this.board.setLook(this.hover, 'normal');
      this.hover = id;
      if (id !== null && this.board.look(id) === 'normal') this.board.setLook(id, 'hover');
      layer.style.cursor = id !== null ? 'pointer' : '';
      this.stage.wake(300);
    };
    return h('div', { class: 'mini-hud' }, layer, top, this.toastEl, bar);
  }

  /** Where a screen point meets the level plane at height `y` on the board. */
  private boardPoint(x: number, y: number, h: number): THREE.Vector3 | null {
    const el = this.app.table.renderer.domElement;
    const r = el.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1), this.app.table.camera);
    this.board.root.updateMatrixWorld();
    const inv = this.board.root.matrixWorld.clone().invert();
    ray.ray.applyMatrix4(inv);
    return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -h), new THREE.Vector3());
  }

  private setStat(id: string, text: string | null, label?: string) {
    let el = this.stats.get(id);
    if (text === null) {
      el?.remove();
      this.stats.delete(id);
      return;
    }
    if (!el) {
      el = h('div', { class: `mini-stat s-${id}` }, h('span', { class: 'k' }), h('span', { class: 'v' }));
      this.stats.set(id, el);
      // A steady order whatever order the game reports in.
      const order = ['time', 'score', 'left', 'moves', 'combo', 'status'];
      const after = [...this.stats.keys()].filter((k) => order.indexOf(k) > order.indexOf(id)).map((k) => this.stats.get(k)!).find((x) => x.isConnected);
      this.statsEl.insertBefore(el, after ?? null);
    }
    (el.firstChild as HTMLElement).textContent = label ?? '';
    // Big counts read with separators, as on the results sheet (12,450, not 12450).
    (el.lastChild as HTMLElement).textContent = text.replace(/\b\d{4,}\b/g, (n) => fmt(Number(n)));
  }

  private toastTimer = 0;
  private toast(text: string, tone: 'good' | 'bad' | 'info' = 'info') {
    const el = this.toastEl;
    el.textContent = text;
    el.className = `mini-toast on ${tone}`;
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (el.className = 'mini-toast'), tone === 'bad' ? 3200 : 1800);
  }

  private refreshButtons() {
    const s = this.session;
    if (!s) return;
    const badges = s.badges?.() ?? {};
    const att = s.attention?.() ?? null;
    for (const [id, b] of this.tools) {
      const badge = b.querySelector<HTMLElement>('.mt-badge')!;
      const text = (badges as Record<string, string | undefined>)[id];
      badge.hidden = text === undefined;
      badge.textContent = text ?? '';
      if (id === 'undo') b.disabled = this.finished || !(s.canUndo?.() ?? false);
      if (id === 'hint' || id === 'shuffle') b.disabled = this.finished || !(s.canUse?.(id) ?? true);
      b.classList.toggle('attn', att === id);
    }
  }

  /**
   * The board fits between the top bar and the tool bar. On short landscape screens (phones held
   * sideways) the top bar can instead stand as a column down the left edge, giving the board the
   * screen's full height: both layouts are measured and the one that shows this board's tiles
   * larger is kept (wide, shallow boards keep the bar along the top).
   */
  private layoutInsets(refit = false) {
    const W = window.innerWidth,
      H = window.innerHeight;
    const hud = this.root;
    if (H <= 500 && W > H) {
      hud.classList.remove('hud-side');
      const along = this.measureInsets();
      hud.classList.add('hud-side');
      const side = this.measureInsets();
      const box = this.board.bounds(true),
        pts = this.board.fitPoints(true);
      const cam = this.app.table.camera;
      const useSide = this.cam.distanceFor(cam, box, side, W, H, pts) < this.cam.distanceFor(cam, box, along, W, H, pts) * 0.99;
      hud.classList.toggle('hud-side', useSide);
      this.cam.insets = useSide ? side : along;
    } else {
      hud.classList.remove('hud-side');
      this.cam.insets = this.measureInsets();
    }
    // Toasts sit just under the top bar (whose stats can wrap to two rows on phones), never over it.
    this.toastEl.style.top = `${Math.max(this.cam.insets.top + 4, H * 0.22)}px`;
    if (refit) this.fit();
  }

  /** The space the HUD covers as it stands now. */
  private measureInsets() {
    const top = this.root.querySelector<HTMLElement>('.mini-top');
    const bar = this.root.querySelector<HTMLElement>('.mini-tools');
    const W = window.innerWidth,
      H = window.innerHeight;
    const tb = top?.getBoundingClientRect();
    const bb = bar?.getBoundingClientRect();
    // Portrait phones are width-bound: a slim margin at the sides.
    const edge = W < H ? 6 : 10;
    // Short landscape screens stand the tool bar up along the right edge (CSS), so the board gets the height;
    // the top bar may stand down the left edge as well (hud-side).
    const toolsSide = !!bb && bb.height > bb.width;
    const topSide = !!tb && this.root.classList.contains('hud-side');
    return {
      top: topSide ? 8 : tb ? Math.max(40, tb.bottom + 6) : 70,
      bottom: toolsSide ? 8 : bb ? Math.max(40, H - bb.top + 6) : 86,
      left: topSide ? tb!.right + 6 : edge,
      right: toolsSide ? Math.max(10, W - bb!.left + 6) : edge,
    };
  }

  private fit(snap = false) {
    this.cam.frame(this.board.bounds(true), snap, this.board.fitPoints(true));
    this.stage.wake(800);
  }

  // ------------------------------------------------------------ lifecycle

  run() {
    const app = this.app;
    app.setPlaying(true);
    holdMiniIcons(true);
    app.hud.append(this.root);
    this.releaseTableFaces();
    this.stage.enter(this.board, this.cam);
    this.stage.onFrame = (dt) => {
      if (this.sparkle.update(dt)) this.stage.wake(100);
    };
    this.layoutInsets();
    this.begin();
    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVis);
    this.hash = location.hash;
    // Before this game's own listener: once the game has gone, its entry is skipped (historyGuard.ts).
    setLiveMini(this, true);
    this.pushEntry();
    window.addEventListener('popstate', this.onPop);
    let last = performance.now();
    this.timer = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.5, (now - last) / 1000);
      last = now;
      if (!this.paused && !this.finished && app.modal.hidden) {
        this.session?.tick?.(dt);
        this.maybeSuggest(now);
        if (++this.ticks % 50 === 0) this.releaseTableFaces();
      } else this.idleAt = now;
    }, 100);
    for (const ev of ['pointerdown', 'wheel', 'keydown'] as const) this.root.addEventListener(ev, this.poke, { capture: true, passive: true });
  }

  private begin() {
    this.finished = false;
    this.counts = { hints: 0, undos: 0, shuffles: 0 };
    for (const k of [...this.stats.keys()]) this.setStat(k, null);
    const rng = new Rng(this.seed);
    // A late timer from a game already left must not reach the next board.
    const host: MiniHost = (this.host = {
      board: this.board,
      camera: this.cam,
      rng,
      seed: this.seed,
      level: this.start.level,
      options: this.start.options,
      daily: !!this.start.daily,
      fit: (snap) => this.fit(snap),
      burst: (at, big) => {
        this.sparkle.burst(at, big ? 40 : 14, big ? 2 : 1);
        this.stage.wake(1200);
      },
      setStat: (id, text, label) => this.setStat(id, text, label),
      toast: (text, tone) => host === this.host && !this.disposed && this.toast(text, tone),
      sound: (name) => !this.disposed && sound.play(name),
      finish: (r) => host === this.host && !this.disposed && this.finish(r),
      used: (what) => host === this.host && !this.disposed && this.counts[what]++,
      refreshButtons: () => this.refreshButtons(),
    });
    this.session = this.def.start(this.host);
    // Portrait phones and phones held sideways: look down on flat boards from higher up, so the board
    // fills the screen (a slanted view wastes height and shrinks the far rows).
    const W = window.innerWidth,
      H = window.innerHeight;
    if (this.def.shape !== 'cube' && !this.def.ownPortraitCamera && (W / H < 0.85 || (H <= 500 && W > H)) && this.cam.home.pitch < 76) {
      this.cam.home = { ...this.cam.home, pitch: W > H ? 84 : 78 };
      this.cam.reset();
    }
    this.layoutInsets();
    this.fit(true);
    this.refreshButtons();
    this.stage.wake(1500);
    this.poke();
  }

  /**
   * The table's tiles are hidden while a mini-game is open, so their face textures are freed from
   * the GPU (they upload again by themselves when the table next shows them). Repeated now and then,
   * as the table may sharpen a face in idle time meanwhile.
   */
  private releaseTableFaces() {
    const faces = (this.app.table as unknown as { faceTex?: Map<string, THREE.Texture> }).faceTex;
    if (faces) for (const tex of faces.values()) tex.dispose();
  }

  /** After a pause with no move, softly show one (free: no hint used, no points lost). */
  private maybeSuggest(now: number) {
    const after = suggestAfter();
    if (!after || this.suggested || this.def.pauseHints === false || !this.session?.suggest || now - this.idleAt < after * 1000) return;
    const ids = this.session.suggest();
    if (ids && !ids.length) return;
    this.suggested = true;
    if (ids) {
      this.board.pulse(ids);
      this.stage.wake(400);
    } else if (this.tools.has('shuffle') && (this.session.canUse?.('shuffle') ?? true)) {
      this.toast(tr('No more moves. Shuffle the tiles to carry on.'), 'info');
      this.tools.get('shuffle')!.classList.add('nudge');
    }
  }

  private useHint() {
    if (this.finished || !this.session.hint) return;
    if (this.session.hint()) this.counts.hints++;
    else if (this.tools.has('shuffle') && (this.session.canUse?.('shuffle') ?? true)) this.toast(tr('No pair to show. Try a shuffle.'), 'bad');
    this.refreshButtons();
  }
  private useUndo() {
    if (this.finished || !this.session.undo) return;
    if (this.session.undo()) this.counts.undos++;
    this.refreshButtons();
  }
  private useShuffle() {
    if (this.finished || !this.session.shuffle) return;
    if (this.session.shuffle()) this.counts.shuffles++;
    this.refreshButtons();
  }

  private setPaused(p: boolean) {
    this.paused = p;
    this.session?.pause?.(p);
  }

  private sheet(...children: (Node | null)[]) {
    const o = this.app.modal;
    o.replaceChildren(h('div', { class: 'card mini-sheet' }, ...children));
    o.hidden = false;
    this.setPaused(true);
    const obs = new MutationObserver(() => {
      if (o.hidden) {
        obs.disconnect();
        // Mei stops reading when the how-to closes any way (Escape, the backdrop, Back).
        narrator.stop();
        if (!this.finished && !this.disposed && !document.hidden) this.setPaused(false);
      }
    });
    obs.observe(o, { attributes: true, attributeFilter: ['hidden'] });
  }

  showHelp() {
    const lines = this.def.howTo;
    // Mei reads the sheet on request (and by herself when "Speak all content" is on).
    let reading = 0;
    let on = false;
    const listen = h('button', { type: 'button', class: 'btn ghost mini-listen', disabled: !narrator.enabled }) as HTMLButtonElement;
    const paint = (v: boolean) => ((on = v), (listen.innerHTML = `${icon(v ? 'speakerOff' : 'speaker')}<span>${v ? tr('Pause') : tr('Listen to Mei')}</span>`));
    const read = () => {
      const mine = ++reading;
      paint(true);
      void narrator.say(narrator.recorded ? howToLine(this.def) : lines.join(' ')).then(() => mine === reading && paint(false));
    };
    listen.onclick = () => (on ? (reading++, narrator.stop(), paint(false)) : read());
    paint(false);
    this.sheet(
      h('p', { class: 'eyebrow' }, tr('How to play')),
      h('h3', {}, this.def.title),
      h('ol', { class: 'mini-howto' }, ...lines.map((l) => h('li', {}, l))),
      h('div', { class: 'btn-row' }, listen, h('button', { class: 'btn primary', onclick: () => ((this.app.modal.hidden = true), narrator.stop()) }, tr('Play'))),
    );
    // Mei's clip is keyed by the English text; a device voice reads the sheet as shown.
    if (narrator.speakAll) read();
  }

  private askLeave() {
    if (this.finished) return this.leave();
    this.sheet(
      h('h3', {}, tr('Leave this game?')),
      h('p', { class: 'muted' }, tr('This board will not be saved.')),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn ghost', onclick: () => (this.app.modal.hidden = true) }, tr('Keep playing')), h('button', { class: 'btn primary', onclick: () => ((this.app.modal.hidden = true), this.leave()) }, tr('Leave'))),
    );
  }

  private askRestart() {
    this.sheet(
      h('h3', {}, tr('Start a new board?')),
      h('p', { class: 'muted' }, tr('The board you are on will not be saved.')),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn ghost', onclick: () => (this.app.modal.hidden = true) }, tr('Keep playing')), h('button', { class: 'btn primary', onclick: () => ((this.app.modal.hidden = true), this.restart(true)) }, tr('New board'))),
    );
  }

  /** Same game again: a new deal, or the same deal (`same`, used by the daily puzzle). */
  restart(fresh = true) {
    if (this.disposed) return;
    this.session?.dispose();
    if (fresh && !this.start.daily) this.seed = randomSeed();
    this.begin();
  }

  // ------------------------------------------------------------ finish

  private finish(r: Omit<MiniResult, 'hints' | 'undos' | 'shuffles'> & Partial<Pick<MiniResult, 'hints' | 'undos' | 'shuffles'>>) {
    if (this.finished || this.disposed) return;
    this.finished = true;
    this.refreshButtons();
    const result: MiniResult = { hints: this.counts.hints, undos: this.counts.undos, shuffles: this.counts.shuffles, ...r };
    const variant = this.session.variant?.() ?? '';
    const rec = recordResult(bestKey(this.def.id, this.start.level, this.start.daily ? 'daily' : variant), result, this.def.timeRecord !== false);
    const pay = payout(this.def, result, this.start.level, !!this.start.daily);
    const p = this.app.profile;
    p.jongPoints += pay.paid;
    this.app.saveProfile();
    if (result.won) {
      const c = this.board.bounds(true).getCenter(new THREE.Vector3());
      this.app.table.playWinAnimation(this.app.winEffect(), c.clone().setY(0.3));
      this.sparkle.burst(c.clone().setY(0.6), 40, 2.2);
      sound.play('mahjong');
      this.stage.wake(3000);
    } else sound.play('score');
    // Not over the hub (or another game) when the player left in the moment before the sheet.
    const host = this.host;
    window.setTimeout(() => !this.disposed && host === this.host && this.showResult(result, rec.newBestScore, rec.newBestTime, pay), result.won ? 1300 : 700);
  }

  private showResult(r: MiniResult, bestScore: boolean, bestTime: boolean, pay: { paid: number; bonus: number; capped: boolean }) {
    const today = earnedToday(this.def.id);
    const row = (k: string, v: string) => h('div', { class: 'stat' }, h('span', { class: 'k' }, k), h('span', { class: 'v' }, v));
    // Whole seconds first, so 59.6 s reads 1:00, not 0:00.
    const secs = Math.round(r.seconds);
    const mins = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    const title = r.won ? (this.start.daily ? tr('Daily puzzle solved') : r.headline ?? tr('Board cleared')) : tr('Good try');
    const tally = r.tally === undefined ? { label: tr('Tiles cleared'), text: `${r.cleared} / ${r.total}` } : r.tally;
    this.sheet(
      h('p', { class: 'eyebrow' }, this.def.title),
      h('h2', { class: 'results-title' }, title),
      h('div', { class: 'mini-result-stats' }, row(tr('Score'), fmt(r.score)), row(tr('Time'), mins), tally ? row(tally.label, tally.text) : null),
      bestScore || bestTime ? h('p', { class: 'mini-best' }, bestScore ? tr('New best score') : tr('New best time')) : null,
      r.notes?.length ? h('ul', { class: 'mini-notes' }, ...r.notes.map((n) => h('li', {}, n))) : null,
      r.hints + r.undos + r.shuffles ? h('p', { class: 'muted small' }, tr('Hints {h} · Undos {u} · Shuffles {s}', { h: r.hints, u: r.undos, s: r.shuffles })) : null,
      h(
        'div',
        { class: 'mini-pay' },
        h('span', { class: 'mini-pay-n' }, `+${fmt(pay.paid)}`),
        h('span', {}, tr('Jong Points')),
        h('small', { class: 'muted' }, pay.bonus ? tr('Includes the daily puzzle bonus of {n}.', { n: pay.bonus }) : pay.capped ? tr('You have reached today’s {n} Jong Points from this game. More tomorrow.', { n: MINI_DAILY_CAP }) : tr('{n} of {cap} Jong Points earned from this game today.', { n: fmt(today), cap: fmt(MINI_DAILY_CAP) })),
      ),
      h(
        'div',
        { class: 'btn-row' },
        h('button', { class: 'btn ghost', onclick: () => ((this.app.modal.hidden = true), this.leave()) }, tr('Mini-games')),
        h('button', { class: 'btn primary', onclick: () => ((this.app.modal.hidden = true), this.restart(true)) }, this.start.daily ? tr('Play again') : tr('New board')),
      ),
    );
  }

  /** For headless tests: the session, the board and a tile's place on screen. */
  get debug() {
    const t = this.app.table;
    return { session: this.session, board: this.board, screenOf: (id: number) => this.board.toScreen(this.board.pose(id)!.pos, t.camera, t.renderer.domElement) };
  }

  /** Back to the hub; `popEntry` also takes the game's history entry off (false when Back already did). */
  leave(popEntry = true) {
    const ours = popEntry && !this.disposed && (history.state as { mini?: string } | null)?.mini === this.def.id;
    this.dispose();
    if (ours) history.back();
    this.app.backToHub();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener('popstate', this.onPop);
    setLiveMini(this, false);
    window.clearInterval(this.timer);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVis);
    narrator.stop();
    this.session?.dispose();
    this.cam.dispose();
    this.stage.exit();
    this.sparkle.dispose();
    this.board.dispose();
    this.root.remove();
    this.app.setPlaying(false);
    holdMiniIcons(false);
  }
}
