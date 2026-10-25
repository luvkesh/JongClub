// Live tables: the lobby list, hosting, joining by code, and the waiting
// room before a multiplayer game starts.

import { seatNames, type Personality } from '../ai/players';
import { avatarSvg } from '../cosmetics/avatar';
import type { AvatarSpec } from '../cosmetics/catalog';
import { GAME_LENGTHS, liveSafeLength, type GameLength } from '../engine/rounds';
import { VARIATIONS } from '../engine/rules';
import { randomSeed } from '../engine/rng';
import type { Club, TableSession, Who } from '../net/session';
import { clear, copyWithNote, flashNote, h } from './dom';
import { icon } from './icons';
import './live.css';
import './etiquette.css';
import type { MatchOptions, SeatSpec, TableConfig } from './match';
import { tr, trn } from '../i18n';

export interface LiveHost {
  club: Club | null;
  who(): Who;
  rating(): number;
  modal: HTMLElement;
  startMatch(cfg: TableConfig, opts: MatchOptions): void;
  /** Called when a live game ends or the table closes. */
  onSessionEnd(): void;
  /** A live game is starting at this table (leave it when the game ends). */
  liveStarted(s: TableSession): void;
}

const varName = (id: string) => VARIATIONS.find((v) => v.id === id) ?? VARIATIONS[0];

export function avatarEl(spec: AvatarSpec | undefined, name: string, size = 40) {
  if (!spec) return h('div', { class: 'avatar', 'aria-hidden': 'true', style: { width: `${size}px`, height: `${size}px` } }, (name[0] ?? '?').toUpperCase());
  return h('div', { class: 'avatar svg', 'aria-hidden': 'true', html: avatarSvg(spec, size), style: { width: `${size}px`, height: `${size}px` } });
}

/** The "Live tables" section of the Play screen: one bar to host, open a private table or join by code, then the tables people are hosting. */
/** `actions: false` leaves out the host / join bar, for a screen that places those itself. */
export function liveSection(host: LiveHost, cfg: () => TableConfig, rerender: () => void, opts: { actions?: boolean } = {}): HTMLElement {
  const club = host.club;
  const sec = h('section', { class: 'section live' });
  sec.append(h('div', { class: 'section-head live-head' }, h('h3', {}, tr('Live tables'))));
  if (!club) {
    sec.append(h('div', { class: 'live-note-bar' }, h('span', { html: icon('info') }), h('p', {}, tr('Live tables open when JongClub is opened on claude.ai, where other members can sit with you. Here, play with AI players.'))));
    return sec;
  }

  const online = club.online().filter((p) => !p.isMe).length;
  const tables = club.tables();
  const list = h('div', { class: 'tables live-list', role: 'list' });
  for (const t of tables) {
    const v = varName(t.variation);
    list.append(
      h(
        'div',
        { class: 'table-row', role: 'listitem' },
        h('div', { class: 'tr-flag', 'aria-hidden': 'true' }, v.flag),
        h('div', { class: 'tr-main' }, h('div', { class: 'tr-name' }, t.title, t.ranked ? h('span', { class: 'chip sm' }, tr('Ranked')) : null), h('div', { class: 'tr-meta' }, `${v.name} · ${tr(GAME_LENGTHS[t.length as GameLength]?.label ?? '')} · ${tr('hosted by {name}', { name: t.host })}`)),
        h('div', { class: 'tr-seats' }, h('span', { class: 'pips' }, ...Array.from({ length: t.seats }, (_, i) => h('i', { class: i < t.seated ? 'on' : '' }))), `${t.seated} / ${t.seats}`),
        h('div', { class: 'tr-level' }, t.started ? tr('Playing') : tr('Waiting')),
        h('div', { class: 'tr-time' }, t.timer ? tr('{n}s turns', { n: t.timer }) : ''),
        t.started || t.seated >= t.seats
          ? h('button', { class: 'btn sm ghost', onclick: () => joinTable(host, t.code, true) }, tr('Watch'))
          : h('button', { class: 'btn sm', onclick: () => joinTable(host, t.code, false) }, tr('Sit down')),
      ),
    );
  }

  const codeIn = h('input', { class: 'code-input', placeholder: tr('Enter code…'), maxlength: '5', 'aria-label': tr('Table code'), autocapitalize: 'off', spellcheck: 'false', value: draftCode }) as HTMLInputElement;
  codeIn.oninput = () => (draftCode = codeIn.value);
  const err = h('span', { class: 'muted small live-err', role: 'status' });
  const code = () => {
    const c = codeIn.value.trim();
    if (/^[a-z0-9]{5}$/i.test(c)) return c.toLowerCase();
    err.textContent = tr('Codes are five letters or numbers.');
    codeIn.focus();
    return null;
  };
  const withIcon = (name: string, label: string) => [h('span', { html: icon(name) }), label];
  const bar = h(
    'div',
    { class: 'live-bar' },
    h('div', { class: 'live-intro' }, h('span', { class: 'live-ico', html: icon('people') }), h('div', {}, h('p', { class: 'live-t' }, tr('Play with others.')), h('p', { class: 'live-d' }, tr('Host a public table, create a private table, or join with a code.')))),
    h(
      'div',
      { class: 'live-actions' },
      h('button', { class: 'btn primary', title: tr('Live tables use the settings from Create a table below.'), onclick: () => hostTable(host, cfg(), false, false) }, ...withIcon('plus', tr('Host public table'))),
      h('button', { class: 'btn', title: tr('Live tables use the settings from Create a table below.'), onclick: () => hostTable(host, cfg(), true, false) }, ...withIcon('lock', tr('Private table'))),
      h(
        'form',
        {
          class: 'join-code',
          onsubmit: (e: Event) => {
            e.preventDefault();
            const c = code();
            if (c) joinTable(host, c, false);
          },
        },
        codeIn,
        h('button', { class: 'btn primary', type: 'submit' }, tr('Join')),
      ),
      h(
        'button',
        {
          class: 'btn ghost live-watch',
          type: 'button',
          title: tr('Join as a watcher: see the table, never anyone’s concealed tiles'),
          onclick: () => {
            const c = code();
            if (c) joinTable(host, c, true);
          },
        },
        ...withIcon('eye', tr('Watch')),
      ),
    ),
  );
  if (opts.actions !== false) sec.append(bar, err);
  if (tables.length) sec.append(list);
  else sec.append(h('div', { class: 'live-note-bar' }, h('span', { html: icon('info') }), h('p', {}, online ? trn(online, '{n} member is in the club. Host a table and they will see it here.', '{n} members are in the club. Host a table and they will see it here.') : tr('No live tables yet. Host one, or share a private table code with a friend.'))));
  const off = club.onChange(() => {
    if (!sec.isConnected) return off();
    // The list redraws whenever someone comes or goes: keep a half-typed code and its focus.
    const typing = document.activeElement === codeIn;
    rerender();
    if (typing) document.querySelector<HTMLInputElement>('.code-input')?.focus({ preventScroll: true });
  });
  return sec;
}

/** A table code being typed, kept while the live list redraws. */
let draftCode = '';

// One table at a time: a double click must not host or join twice.
let busy = false;

export async function hostTable(host: LiveHost, cfg: TableConfig, isPrivate: boolean, ranked: boolean) {
  if (!host.club || busy) return;
  busy = true;
  try {
    const who = host.who();
    // Timed matches need one shared clock, which live tables don't have yet (rounds.ts).
    const s = await host.club.host({ ...cfg, length: liveSafeLength(cfg.length), hints: ranked ? false : cfg.hints, timer: cfg.timer || 30 }, who, { title: tr('{name}’s table', { name: who.name }), isPrivate, ranked }).catch(() => null);
    if (s) waitingRoom(host, s);
  } finally {
    busy = false;
  }
}

export async function joinTable(host: LiveHost, code: string, spectate: boolean) {
  if (!host.club || busy) return;
  busy = true;
  try {
    const s = await host.club.join(code, host.who(), spectate).catch(() => null);
    if (s) waitingRoom(host, s);
  } finally {
    busy = false;
  }
}

/** The waiting room: seats, spectators, the code to share, and Start for the host. */
/** Which links reach this table (✓ connected, ✕ not), so a failed join says why. */
function linkLine(s: TableSession) {
  const ln = s.links();
  const mark = (v: string) => (v === 'on' ? '✓' : v === 'off' ? '✕' : '–');
  const text = `${tr('Instant link')} ${mark(ln.room)} · ${tr('Saved link')} ${mark(ln.store)}${ln.error ? ` · ${ln.error}` : ''}`;
  return h('p', { class: 'muted small wr-links' }, text);
}

export function waitingRoom(host: LiveHost, s: TableSession) {
  const o = host.modal;
  clear(o).hidden = false;
  const card = h('div', { class: 'card waiting-room' });
  o.append(card);
  let started = false;
  let closed = false;
  let since = Date.now();
  let starting = false;

  const close = async () => {
    if (closed) return;
    closed = true;
    off();
    window.clearInterval(tick);
    o.hidden = true;
    await s.leave();
    host.onSessionEnd();
  };

  const render = () => {
    if (started || closed) return;
    const t = s.table();
    const start = t?.start;
    if (start) {
      started = true;
      off();
      window.clearInterval(tick);
      o.hidden = true;
      beginLive(host, s);
      return;
    }
    // Redrawn every couple of seconds: keep the sheet's scroll and a start already pressed.
    const keep = o.scrollTop;
    clear(card);
    if (!t) {
      // The saved link can take a few seconds longer than the instant one.
      const waited = Date.now() - since > 15000;
      const ln = s.links();
      const cut = waited && ln.room !== 'on' && ln.store !== 'on';
      card.append(
        h('p', { class: 'eyebrow' }, tr('Table {code}', { code: s.code.toUpperCase() })),
        h('h3', {}, waited ? tr('No table with that code') : tr('Finding the table…')),
        h(
          'p',
          { class: 'muted' },
          cut
            ? tr('This device can’t reach live tables right now. Reload the page and try again.')
            : waited
              ? tr('The host may have closed it, or opened an older copy of the game. Check the code, ask them to reload, and try again.')
              : tr('Connecting to the host.'),
        ),
        linkLine(s),
        h('div', { class: 'btn-row' }, h('button', { class: 'btn', onclick: close }, tr('Back'))),
      );
      o.scrollTop = keep;
      return;
    }
    const v = varName(t.cfg.variation);
    const seating = s.seating();
    const seats = h('ol', { class: 'wr-seats' });
    seating.forEach((p, i) => {
      seats.append(
        h(
          'li',
          { class: p ? 'taken' : 'open' },
          p ? avatarEl(p.who.avatar, p.who.name, 36) : h('div', { class: 'avatar ghost', 'aria-hidden': 'true' }, '·'),
          h('span', { class: 'wr-name' }, p ? `${p.isMe ? tr('{name} (you)', { name: p.who.name }) : p.who.name}${i === 0 ? ` · ${tr('host')}` : ''}` : tr('Open seat')),
          h('span', { class: 'muted small' }, p ? '' : tr('An AI player sits here if nobody joins')),
        ),
      );
    });
    const specs = s.spectators();
    card.append(
      h('p', { class: 'eyebrow' }, `${v.flag} ${v.name} · ${tr(GAME_LENGTHS[t.cfg.length]?.label ?? '')}${t.ranked ? ` · ${tr('Ranked')}` : ''}`),
      h('h3', {}, t.title),
      h('div', { class: 'wr-code' }, h('span', { class: 'muted small' }, tr('Table code')), h('strong', {}, s.code.toUpperCase()), h('button', { class: 'btn sm copy-btn', onclick: (e: Event) => void copyWithNote(e.currentTarget as HTMLButtonElement, s.code.toUpperCase()) }, tr('Copy'))),
      s.spectating ? '' : h('div', { class: 'wr-invite' }, h('button', { class: 'btn sm', onclick: (e: Event) => void inviteFriend(e.currentTarget as HTMLButtonElement, s.code, t.title) }, tr('Invite a friend')), h('span', { class: 'muted small' }, tr('Sends a link that opens this table.'))),
      seats,
      specs.length ? h('p', { class: 'muted small' }, tr('{n} watching: {names}', { n: specs.length, names: specs.map((x) => x.name).join(', ') })) : '',
      s.spectating ? h('p', { class: 'muted small' }, tr('You are watching this table. You will see the game from the host’s seat.')) : '',
      !s.hostPresent() ? h('p', { class: 'muted small' }, tr('The host has left this table.')) : '',
      linkLine(s),
      h(
        'div',
        { class: 'btn-row' },
        h('button', { class: 'btn ghost', onclick: close }, tr('Leave')),
        s.isHost
          ? h(
              'button',
              {
                class: 'btn primary',
                disabled: starting,
                onclick: (e: Event) => {
                  (e.currentTarget as HTMLButtonElement).disabled = true;
                  starting = true;
                  const names = seatNames(t.cfg.personalities as Personality[]);
                  void s.start(names, randomSeed());
                },
              },
              seating.filter(Boolean).length > 1 ? tr('Start the game') : tr('Start with AI players'),
            )
          : h('span', { class: 'muted small' }, s.spectating ? '' : tr('Waiting for {name} to start', { name: s.hostName() })),
      ),
    );
    o.scrollTop = keep;
  };
  const off = s.onChange(render);
  const tick = window.setInterval(() => (started || closed ? window.clearInterval(tick) : render()), 2000);
  since = Date.now();
  render();
}

/** Start the match for everyone at the table: your seat is local, other people are remote. */
function beginLive(host: LiveHost, s: TableSession) {
  const t = s.table()!;
  const start = t.start!;
  const me = s.myPeer;
  const seats: SeatSpec[] = start.seats.map((x) =>
    x.kind === 'ai' ? { kind: 'ai', name: x.name, personality: (x.personality as Personality) ?? 'zen' } : { kind: x.peer === me ? 'local' : 'remote', name: x.name, avatar: x.avatar },
  );
  const link = s.link();
  if (!link) return host.onSessionEnd();
  link.onHostLost = () => {
    host.onSessionEnd();
    hostLeftNotice(host);
  };
  const seated = seats.some((x) => x.kind === 'local');
  const opts: MatchOptions = { seed: start.seed, seats, link, mode: t.ranked ? 'ranked' : 'multiplayer', ranked: t.ranked && seated };
  if (!seated) {
    // Spectators: watch from the host's seat, joining at the current hand.
    const snap = s.hostSnapshot();
    opts.viewSeat = 0;
    if (snap && snap.h > 0) opts.resume = { hand: snap.h, round: snap.round as never, scores: snap.scores, pot: snap.pot };
  }
  host.liveStarted(s);
  host.startMatch(t.cfg, opts);
  watcherBadge(s);
}

/** How many people are watching, shown on the table while a live game runs. */
function watcherBadge(s: TableSession) {
  const hud = document.getElementById('hud');
  if (!hud) return;
  const badge = h('div', { class: 'watchers-badge', 'aria-live': 'polite' });
  hud.append(badge);
  const draw = () => {
    if (!badge.isConnected) return off();
    const n = s.spectators().length;
    badge.hidden = n === 0;
    badge.textContent = tr('{n} watching', { n });
  };
  const off = s.onChange(draw);
  draw();
}

/** On claude.ai the game runs inside a frame whose own address opens nothing for a friend, so invites point at the club page. */
const CLUB_PAGE = 'https://claude.ai/artifact/VN7r7NMHe5kzcG5jzaDr3g';
const framed = () => {
  try {
    return window.top !== window.self;
  } catch {
    return true;
  }
};

/** The link that opens a live table: ?table=CODE on this page. */
export function tableLink(code: string): string {
  const u = new URL(framed() ? CLUB_PAGE : location.href);
  u.hash = '';
  u.search = '';
  u.searchParams.set('table', code);
  return u.toString();
}

/** A table code from the page's link (?table=CODE), taken off the address so a reload doesn't join again. */
export function tableFromLink(): string | null {
  try {
    const u = new URL(location.href);
    const code = u.searchParams.get('table')?.trim().toLowerCase() ?? '';
    if (!code) return null;
    u.searchParams.delete('table');
    history.replaceState(null, '', u.toString());
    return /^[a-z0-9]{5}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}

/** One tap: the phone's share sheet where there is one, else copy the link. */
async function inviteFriend(btn: HTMLButtonElement, code: string, title: string) {
  const url = tableLink(code);
  const text = tr('Join me at {title} in JongClub. Table {code}.', { title, code: code.toUpperCase() });
  const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string; url?: string }) => Promise<void> };
  if (nav.share) {
    try {
      await nav.share({ title: tr('JongClub · The Table Awaits.'), text, url });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  const ok = await copyWithNote(btn, url, tr('Invite a friend'));
  if (ok) flashNote(tr('Invite link copied. Send it to a friend.'));
}

/** Tell guests why their game stopped. */
function hostLeftNotice(host: LiveHost) {
  const o = host.modal;
  clear(o).hidden = false;
  const ok = h('button', { class: 'btn primary', onclick: () => (o.hidden = true) }, tr('Back to the lobby'));
  o.append(
    h(
      'div',
      { class: 'card waiting-room', role: 'alertdialog', 'aria-labelledby': 'host-left-title' },
      h('h3', { id: 'host-left-title' }, tr('The game has ended')),
      h('p', { class: 'muted' }, tr('The host left the table, so this game can’t continue. Nothing was recorded for this game.')),
      h('div', { class: 'btn-row' }, ok),
    ),
  );
  ok.focus({ preventScroll: true });
}
