// Labs: the testing panel, the flask button beside Settings that opens it, and
// the hidden switch (seven taps on the version line) that brings the button
// back once hidden. Everything here changes only this device's profile.

import { tr } from '../i18n';
import { CATALOG } from '../cosmetics/catalog';
import { VARIATIONS } from '../engine/rules';
import { ACHIEVEMENTS, emptyVarStats, leagueOf, levelOf, resetProfile, saveProfile, xpForLevel, type Profile } from '../progression/profile';
import { SEASON_TOTAL_XP } from '../club/seasons';
import { saveSeasonProgress, seasonProgress } from '../progression/season';
import { LESSONS } from '../ui/academy';
import { clear, fmt, h } from '../ui/dom';
import { icon } from '../ui/icons';
import { accountField } from '../auth/signin';
import { dev, onDevChange, saveDev, setDevEnabled } from './devMode';
import { fpsMeter, forcedQuality, setForcedQuality } from './fps';
import './dev.css';

export interface DevHost {
  profile: Profile;
  /** The Settings modal element. */
  modal: HTMLElement;
  /** Redraw the current screen after the profile changes. */
  refresh(): void;
  /** Show Settings again. */
  openSettings(): void;
  /** Re-lay the table now (show hands takes effect without waiting for a move). */
  relayout(): void;
  /** Start a one-hand game against instant AI (not offered at a table). */
  quickGame?(): void;
}

const VERSION = '0.1.0';
const TAPS = 7;
let taps = 0;
let tapTimer = 0;

/** The flask button beside Settings. Hidden while Labs is off; follows the switch. */
export function labsButton(open: () => void, cls = 'icon-btn labs-btn'): HTMLButtonElement {
  const b = h('button', { type: 'button', class: cls, 'aria-label': 'Labs', title: 'Labs: testing tools', onclick: open, html: icon('labs') }) as HTMLButtonElement;
  const sync = () => {
    if (!b.isConnected && b.dataset.drawn) return off();
    b.hidden = !dev.enabled;
  };
  const off = onDevChange(sync);
  sync();
  b.dataset.drawn = '1';
  return b;
}

/** Rows appended to Settings: the account, Labs and the version line (the hidden switch). */
export function settingsExtras(host: DevHost): HTMLElement[] {
  const hint = h('span', { class: 'dev-hint', 'aria-live': 'polite' });
  const version = h(
    'button',
    {
      type: 'button',
      class: 'dev-version',
      onclick: () => {
        if (dev.enabled) return (hint.textContent = 'Labs is already on.');
        window.clearTimeout(tapTimer);
        tapTimer = window.setTimeout(() => ((taps = 0), (hint.textContent = '')), 2500);
        taps++;
        if (taps >= TAPS) {
          taps = 0;
          setDevEnabled(true);
          host.openSettings();
          return;
        }
        if (taps >= 3) hint.textContent = `${TAPS - taps} more ${TAPS - taps === 1 ? 'tap' : 'taps'} to Labs`;
      },
    },
    `JongClub ${VERSION}`,
  );
  const rows: HTMLElement[] = [accountField()];
  if (dev.enabled)
    rows.push(
      h(
        'div',
        { class: 'field dev-field' },
        h('span', { title: tr('Testing tools for this device: Jong Points, unlocks, faster AI and animations, opponents’ hands shown, and resets.') }, tr('Labs')),
        h(
          'div',
          { class: 'dev-row' },
          h('button', { type: 'button', class: 'btn sm', onclick: () => devPanel(host) }, tr('⚗ Open Labs')),
          h('button', { type: 'button', class: 'btn sm ghost', onclick: () => (setDevEnabled(false), host.relayout(), host.openSettings()) }, tr('Hide Labs')),
        ),
      ),
    );
  rows.push(h('div', { class: 'dev-foot' }, version, hint));
  return rows;
}

/** Club XP needed to stand at the start of `level`. */
const xpAtLevel = (level: number) => {
  let xp = 0;
  for (let l = 1; l < level; l++) xp += xpForLevel(l);
  return xp;
};

export function devPanel(host: DevHost) {
  const p = host.profile;
  const o = clear(host.modal);
  o.hidden = false;
  const note = h('p', { class: 'dev-note', 'aria-live': 'polite' });
  const stats = h('div', { class: 'dev-stats' });
  const showStats = () => {
    const lv = levelOf(p.xp);
    const lg = leagueOf(p.rating);
    clear(stats).append(
      h('span', {}, h('b', {}, fmt(p.jongPoints)), ' Jong Points'),
      h('span', {}, 'Club level ', h('b', {}, String(lv.level))),
      h('span', {}, 'Rating ', h('b', {}, String(Math.round(p.rating))), ` ${lg.icon} ${lg.name}`),
    );
  };
  const apply = (msg: string, fn: () => void) => () => {
    fn();
    saveProfile(p);
    showStats();
    host.refresh();
    note.textContent = msg;
  };

  const seg = <T extends string | number>(label: string, opts: [T, string][], get: () => T, set: (v: T) => void, tip?: string) => {
    const wrap = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    const draw = () =>
      clear(wrap).append(
        ...opts.map(([v, l]) =>
          h('button', { type: 'button', role: 'radio', 'aria-checked': String(v === get()), class: v === get() ? 'on' : '', onclick: () => (set(v), saveDev(), draw()) }, l),
        ),
      );
    draw();
    return h('div', { class: 'field' }, h('span', { title: tip ?? null }, label), wrap);
  };

  const rating = h('input', { type: 'number', min: '100', max: '3000', step: '50', value: String(Math.round(p.rating)), 'aria-label': 'Rating', class: 'dev-input' }) as HTMLInputElement;

  const unlockCollection = () => {
    for (const c of CATALOG) {
      const k = `${c.category}:${c.id}`;
      if ((c.price > 0 || c.earnedBy) && !p.owned.includes(k)) p.owned.push(k);
    }
  };
  const completeLessons = () => {
    for (const id of [...Object.keys(LESSONS), 'guided']) if (!p.lessonsDone.includes(id)) p.lessonsDone.push(id);
  };
  const completeVariations = () => {
    for (const v of VARIATIONS) {
      if (!v.profile) continue;
      p.variationGames[v.id] = Math.max(10, p.variationGames[v.id] ?? 0);
      p.variationWins[v.id] = Math.max(1, p.variationWins[v.id] ?? 0);
      p.ratedByVariation[v.id] = Math.max(1, p.ratedByVariation[v.id] ?? 0);
      const vs = (p.varStats[v.id] ??= emptyVarStats());
      vs.handsWon = Math.max(1, vs.handsWon);
    }
  };
  const allAchievements = () => {
    const now = new Date().toISOString();
    for (const a of ACHIEVEMENTS) p.achievements[a.id] ??= now;
  };

  let confirmReset = false;
  const resetBtn = h('button', { type: 'button', class: 'btn sm ghost dev-danger' }, 'Reset profile') as HTMLButtonElement;
  resetBtn.onclick = () => {
    if (!confirmReset) {
      confirmReset = true;
      resetBtn.textContent = 'Tap again to reset';
      return;
    }
    confirmReset = false;
    resetBtn.textContent = 'Reset profile';
    resetProfile(p);
    showStats();
    rating.value = String(p.rating);
    host.refresh();
    note.textContent = 'Profile reset to a new player (name kept).';
  };

  const btn = (label: string, msg: string, fn: () => void, cls = 'btn sm') => h('button', { type: 'button', class: cls, onclick: apply(msg, fn) }, label);
  const store = (msg: string, fn: () => void, label: string) =>
    h('button', { type: 'button', class: 'btn sm ghost', onclick: () => (fn(), host.refresh(), (note.textContent = msg)) }, label);
  const forget = (...keys: string[]) => () => {
    try {
      // Per-account copies sit under "key:account".
      for (const k of Object.keys(localStorage)) if (keys.some((x) => k === x || k.startsWith(`${x}:`))) localStorage.removeItem(k);
    } catch {
      /* storage blocked */
    }
  };
  const completeSeason = () => {
    const sp = seasonProgress();
    sp.xp = Math.max(sp.xp, SEASON_TOTAL_XP);
    saveSeasonProgress(sp);
  };
  const everything = () => {
    unlockCollection();
    completeLessons();
    completeVariations();
    allAchievements();
    completeSeason();
    p.jongPoints += 1_000_000;
    p.xp = Math.max(p.xp, xpAtLevel(50));
    p.rating = Math.max(p.rating, 2200);
    rating.value = String(p.rating);
  };

  o.append(
    h(
      'div',
      { class: 'card settings dev-card', 'data-tap-tips': '' },
      h('button', { type: 'button', class: 'icon-btn card-close', 'aria-label': 'Close Labs', onclick: () => (o.hidden = true) }, '✕'),
      h('p', { class: 'eyebrow' }, '⚗ Labs'),
      h('h3', {}, 'Testing tools'),
      h('p', { class: 'muted small' }, 'Changes apply to this device’s profile only. Hide the Labs button from Settings › Account.'),
      stats,
      h(
        'div',
        { class: 'dev-row dev-big' },
        btn('Grant 1,000,000 Jong Points', 'Added 1,000,000 Jong Points.', () => (p.jongPoints += 1_000_000), 'btn primary'),
        btn('Unlock everything', 'Everything unlocked: collection, lessons, variations, achievements, the season track, level 50, 1,000,000 JP and a 2,200 rating.', everything, 'btn primary'),
      ),
      h('h4', { class: 'dev-h' }, 'Points and levels'),
      h(
        'div',
        { class: 'dev-row' },
        btn('+1,000 JP', 'Added 1,000 Jong Points.', () => (p.jongPoints += 1000)),
        btn('+100,000 JP', 'Added 100,000 Jong Points.', () => (p.jongPoints += 100000)),
        btn('Zero JP', 'Jong Points set to 0, to test prices you cannot afford.', () => (p.jongPoints = 0), 'btn sm ghost'),
      ),
      h(
        'div',
        { class: 'dev-row' },
        btn('+1 club level', 'Club level raised by one.', () => (p.xp = xpAtLevel(levelOf(p.xp).level + 1))),
        btn('Level 10', 'Club level set to 10.', () => (p.xp = xpAtLevel(10))),
        btn('Level 50', 'Club level set to 50.', () => (p.xp = xpAtLevel(50))),
      ),
      h(
        'div',
        { class: 'dev-row' },
        h('label', { class: 'dev-inline' }, 'Rating', rating),
        h(
          'button',
          {
            type: 'button',
            class: 'btn sm',
            onclick: apply('Rating set. Invitation tournaments open at 1,700.', () => {
              const r = Math.max(100, Math.min(3000, Math.round(Number(rating.value) || 1000)));
              p.rating = r;
              for (const v of VARIATIONS) if (v.profile) p.ratings[v.id] = r;
              rating.value = String(r);
            }),
          },
          'Set rating',
        ),
      ),
      h('h4', { class: 'dev-h' }, 'Unlocks'),
      h(
        'div',
        { class: 'dev-row' },
        btn('All collection items', 'Every tile set, table, room, outfit and effect is now in your collection.', unlockCollection),
        btn('All lessons', 'Every Academy lesson and the guided game are marked complete.', completeLessons),
        btn('Every variation', 'Every variation is played, won and ranked, so its World Tour stamps and table are unlocked.', completeVariations),
        btn('All achievements', 'Every achievement is unlocked.', allAchievements),
        btn('Whole season track', 'Every step of this season’s track is reached. Claim the rewards on the Season page.', completeSeason),
      ),
      h('h4', { class: 'dev-h' }, 'At the table'),
      seg('Show opponents’ hands', [['off', 'Off'], ['on', 'On']], () => (dev.showHands ? 'on' : 'off'), (v) => ((dev.showHands = v === 'on'), saveDev(), host.relayout()), 'Turns every other player’s hand face up on your screen, so you can see what they hold. For testing only.'),
      seg('AI speed', [[1, 'Normal'], [4, 'Fast'], [20, 'Instant']], () => dev.aiSpeed, (v) => (dev.aiSpeed = v), 'How long the table waits between moves: normal, four times shorter, or twenty times shorter.'),
      seg('Animation speed', [[1, 'Normal'], [3, 'Fast'], [8, 'Instant']], () => dev.animSpeed, (v) => (dev.animSpeed = v), 'Speeds up tile and table animations on top of the Animations setting: normal, three times or eight times faster.'),
      seg('Frame rate meter', [['off', 'Off'], ['on', 'On']], () => (dev.fps ? 'on' : 'off'), (v) => ((dev.fps = v === 'on'), saveDev(), fpsMeter(dev.fps)), 'A small meter in the corner showing frames per second.'),
      seg('Render quality (reloads)', [['auto', 'Auto'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']], () => forcedQuality(), (v) => setForcedQuality(v), 'How detailed the 3D table is drawn. Auto picks for this device; Low is lighter on older phones and tablets. The page reloads to apply it.'),
      host.quickGame
        ? h('div', { class: 'dev-row' }, h('button', { type: 'button', class: 'btn sm', onclick: () => ((o.hidden = true), host.quickGame!()) }, 'Quick test hand (instant AI, hands shown)'))
        : '',
      h('h4', { class: 'dev-h' }, 'Start again'),
      h(
        'div',
        { class: 'dev-row' },
        btn('Replay today’s daily', 'Today’s daily challenges can be played again.', () => delete p.daily[new Date().toISOString().slice(0, 10)], 'btn sm ghost'),
        btn('Reset the Academy', 'Every lesson is marked as not done, so the Academy starts from Level 1.', () => (p.lessonsDone = []), 'btn sm ghost'),
        store('The placement test and its offer on the Learn screen are back.', forget('jongclub.placement.v1', 'jongclub.placement.offer.v1'), 'Retake the placement'),
        store('Sign-in offers will show again after games and lessons.', forget('jongclub.auth.nudge.v1'), 'Show sign-in offers again'),
        resetBtn,
      ),
      note,
      h('div', { class: 'btn-row' }, h('button', { type: 'button', class: 'btn ghost', onclick: () => host.openSettings() }, 'Settings'), h('button', { type: 'button', class: 'btn primary', onclick: () => (o.hidden = true) }, 'Done')),
    ),
  );
  showStats();
}
