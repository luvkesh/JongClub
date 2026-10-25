// Private member clubs: found a club, see its members, its tables, this week's
// league and its leaderboard, and invite friends by link. Opened from the Club
// screen (social.ts). Clubs live on the club server when signed in there, and
// on this device with AI members otherwise (src/club/privateClubs.ts).

import type { Personality } from '../ai/players';
import { brandSvg } from '../brand';
import {
  CREST_EMBLEMS,
  clubInviteLink,
  clubsAreLocal,
  clubsBackend,
  crestOf,
  pendingClubInvite,
  type ClubSpec,
  type PrivateClub,
} from '../club/privateClubs';
import { ROSTER } from '../club/roster';
import { TABLES } from '../cosmetics/catalog';
import { GAME_LENGTHS, liveSafeLength, type GameLength } from '../engine/rounds';
import { VARIATIONS, getProfile, seatsForVariation } from '../engine/rules';
import { randomSeed } from '../engine/rng';
import { cloudSignedIn, serverUrl } from '../net/api';
import type { AppCtx } from './ctx';
import { clear, copyWithNote, flashNote, fmt, h, tileImg } from './dom';
import { avatarEl, waitingRoom } from './live';
import type { SeatSpec, TableConfig } from './match';
import './clubs.css';
import { lang, tr, trn } from '../i18n';

const playable = () => VARIATIONS.filter((v) => v.profile);
const vinfo = (id: string) => VARIATIONS.find((v) => v.id === id) ?? VARIATIONS[0];

/** The club's crest: a roundel in an Atelier table's colours with an emblem. */
export function crestEl(crest: string, size = 56) {
  const { table, emblem } = crestOf(crest);
  const el = h('div', {
    class: 'crest',
    role: 'img',
    'aria-label': tr('Crest: {name}', { name: emblem.label }),
    style: { width: `${size}px`, height: `${size}px`, background: `radial-gradient(circle at 50% 35%, ${table.felt}, #0b0f0d 120%)`, borderColor: table.rim },
  });
  if (emblem.kind !== undefined) el.append(tileImg(emblem.kind, 'crest-tile'));
  else el.append(h('span', { class: 'crest-mark', html: brandSvg('mark') }));
  return el;
}

let view: { kind: 'list' } | { kind: 'club'; id: string } | { kind: 'found' } = { kind: 'list' };

/** Open the private clubs page in place of the Club screen. */
export function openClubs(ctx: AppCtx, at?: { club?: string }) {
  if (at?.club) view = { kind: 'club', id: at.club };
  void render(ctx);
}

/** The Club screen's entry card (social.ts). */
export function clubsEntry(ctx: AppCtx): HTMLElement {
  // An invite link (?club=CODE) opens the clubs page straight away.
  if (pendingClubInvite()) queueMicrotask(() => openClubs(ctx));
  return h(
    'button',
    { class: 'mode', onclick: () => ((view = { kind: 'list' }), openClubs(ctx)) },
    h('span', { class: 'mode-title' }, tr('Private clubs')),
    h('span', { class: 'mode-detail' }, tr('Your own club: members, house rules, a weekly league')),
  );
}

const host = () => document.getElementById('screen');

function page(ctx: AppCtx, title: string, ...body: (Node | string | null)[]) {
  const root = host();
  if (!root) return;
  clear(root).append(
    h(
      'div',
      { class: 'page clubs-page' },
      h(
        'header',
        { class: 'page-head' },
        h('button', { class: 'btn sm ghost clubs-back', onclick: () => (view.kind === 'list' ? ctx.go('club') : ((view = { kind: 'list' }), void render(ctx))) }, view.kind === 'list' ? tr('‹ Club') : tr('‹ Your clubs')),
        h('p', { class: 'eyebrow' }, tr('Private clubs')),
        h('h2', {}, title),
      ),
      ...body,
    ),
  );
  root.scrollTop = 0;
}

async function render(ctx: AppCtx) {
  const back = clubsBackend();
  // A pending invite: join on the server, or explain why not yet.
  const invite = pendingClubInvite(true);
  if (invite) {
    if (!cloudSignedIn()) flashNote(serverUrl() ? tr('Sign in (Settings › Account) to join the club you were invited to.') : tr('Club invites open once the club server is live.'), true);
    else
      try {
        const c = await back.join(invite);
        view = { kind: 'club', id: c.id };
        flashNote(tr('Welcome to {name}.', { name: c.name }));
      } catch (e) {
        flashNote((e as Error).message, true);
      }
  }
  if (view.kind === 'found') return foundForm(ctx);
  let clubs: PrivateClub[] = [];
  try {
    clubs = await back.list();
  } catch (e) {
    return page(ctx, tr('Your clubs'), h('p', { class: 'muted' }, (e as Error).message), h('div', { class: 'btn-row' }, h('button', { class: 'btn', onclick: () => void render(ctx) }, tr('Try again'))));
  }
  if (view.kind === 'club') {
    const id = view.id;
    const c = clubs.find((x) => x.id === id);
    if (c) return clubPage(ctx, c);
    view = { kind: 'list' };
  }
  listPage(ctx, clubs);
}

function listPage(ctx: AppCtx, clubs: PrivateClub[]) {
  const local = clubsAreLocal();
  const cards = clubs.map((c) =>
    h(
      'button',
      { class: 'club-card', onclick: () => ((view = { kind: 'club', id: c.id }), void render(ctx)) },
      crestEl(c.crest, 52),
      h('span', { class: 'cc-main' }, h('span', { class: 'cc-name' }, c.name), h('span', { class: 'cc-meta' }, `${vinfo(c.variation).flag} ${vinfo(c.variation).name} · ${trn(c.members.length, '{n} member', '{n} members')}`)),
      h('span', { class: 'cc-go', 'aria-hidden': 'true' }, '›'),
    ),
  );
  page(
    ctx,
    clubs.length ? tr('Your clubs') : tr('Found your own club'),
    h(
      'p',
      { class: 'muted clubs-lede' },
      tr('A private club is how mahjong is really played: the same friends, the same house rules, every week. Found one, set its rules, and invite friends with a link.'),
    ),
    clubs.length ? h('div', { class: 'club-cards' }, ...cards) : '',
    h('div', { class: 'btn-row clubs-actions' }, h('button', { class: 'btn primary', onclick: () => ((view = { kind: 'found' }), void render(ctx)) }, clubs.length ? tr('Found another club') : tr('Found a club'))),
    local
      ? h('p', { class: 'muted small' }, serverUrl() ? tr('Sign in (Settings › Account) to found a club your friends can join. Until then your club is kept on this device, with members from the club roster.') : tr('Until the club server is live, your club is kept on this device and its members come from the club roster, so you can try everything now.'))
      : '',
  );
}

function foundForm(ctx: AppCtx) {
  const spec: ClubSpec = { name: ctx.profile.name === 'Guest' ? tr('The Tile Club') : tr('{name}’s Tile Club', { name: ctx.profile.name }), crest: `${TABLES[2].id}|mark`, variation: 'classic', length: 'eastRound', houseRules: {} };
  const err = h('p', { class: 'auth-err', role: 'alert' });
  const name = h('input', { type: 'text', class: 'code-input club-name-in', maxlength: '32', value: spec.name, 'aria-label': tr('Club name') }) as HTMLInputElement;
  name.oninput = () => (spec.name = name.value);

  const preview = h('div', { class: 'crest-preview' });
  const drawPreview = () => clear(preview).append(crestEl(spec.crest, 84));
  const [tableId0, emblem0] = spec.crest.split('|');
  let tableId = tableId0;
  let emblem = emblem0;
  const colours = h('div', { class: 'crest-colours', role: 'radiogroup', 'aria-label': tr('Crest colours') });
  for (const t of TABLES) {
    const b = h('button', { type: 'button', class: `swatch${t.id === tableId ? ' on' : ''}`, role: 'radio', 'aria-checked': String(t.id === tableId), 'aria-label': t.id.replace(/-/g, ' '), style: { background: t.felt, borderColor: t.rim } });
    b.onclick = () => {
      tableId = t.id;
      spec.crest = `${tableId}|${emblem}`;
      colours.querySelectorAll('button').forEach((x) => (x.classList.toggle('on', x === b), x.setAttribute('aria-checked', String(x === b))));
      drawPreview();
    };
    colours.append(b);
  }
  const emblems = h('div', { class: 'crest-emblems', role: 'radiogroup', 'aria-label': tr('Crest emblem') });
  for (const e of CREST_EMBLEMS) {
    const b = h('button', { type: 'button', class: `emblem${e.id === emblem ? ' on' : ''}`, role: 'radio', 'aria-checked': String(e.id === emblem), title: e.label, 'aria-label': e.label });
    b.append(e.kind !== undefined ? tileImg(e.kind, 'emblem-tile') : h('span', { class: 'crest-mark', html: brandSvg('mark') }));
    b.onclick = () => {
      emblem = e.id;
      spec.crest = `${tableId}|${emblem}`;
      emblems.querySelectorAll('button').forEach((x) => (x.classList.toggle('on', x === b), x.setAttribute('aria-checked', String(x === b))));
      drawPreview();
    };
    emblems.append(b);
  }
  drawPreview();

  // Rules: the variation, the length, and that variation's own house rules.
  const rules = h('div', { class: 'club-rules' });
  const drawRules = () => {
    const prof = getProfile(spec.variation);
    spec.houseRules = Object.fromEntries((prof?.houseRules ?? []).map((r) => [r.id, spec.houseRules[r.id] ?? r.default]));
    const varSel = h('select', { id: 'club-var' }, ...playable().map((v) => h('option', { value: v.id, selected: v.id === spec.variation }, `${v.flag} ${v.name}`))) as HTMLSelectElement;
    varSel.onchange = () => {
      spec.variation = varSel.value;
      spec.length = ctx.tableFor(spec.variation).length;
      spec.houseRules = {};
      drawRules();
    };
    const lenSel = h('select', { id: 'club-len' }, ...(Object.keys(GAME_LENGTHS) as GameLength[]).map((k) => h('option', { value: k, selected: k === spec.length }, GAME_LENGTHS[k].label))) as HTMLSelectElement;
    lenSel.onchange = () => (spec.length = lenSel.value);
    const house = (prof?.houseRules ?? []).map((r) => {
      const s = h('select', { id: `club-hr-${r.id}` }, ...r.options.map((o) => h('option', { value: o.value, selected: o.value === spec.houseRules[r.id] }, o.label))) as HTMLSelectElement;
      s.onchange = () => (spec.houseRules[r.id] = s.value);
      return h('label', { class: 'field', for: `club-hr-${r.id}` }, h('span', {}, r.label), s);
    });
    clear(rules).append(
      h('label', { class: 'field', for: 'club-var' }, h('span', {}, tr('Club variation')), varSel),
      h('label', { class: 'field', for: 'club-len' }, h('span', {}, tr('Game length')), lenSel),
      ...(house.length ? [h('p', { class: 'eyebrow club-hr-head' }, tr('House rules')), h('div', { class: 'club-hr' }, ...house)] : [h('p', { class: 'muted small' }, tr('This rule set is played as written.'))]),
    );
  };
  drawRules();

  const submit = h('button', { class: 'btn primary', type: 'submit' }, tr('Found the club')) as HTMLButtonElement;
  const form = h(
    'form',
    { class: 'club-found' },
    h('section', { class: 'section' }, h('h3', {}, tr('Name')), name),
    h('section', { class: 'section' }, h('h3', {}, tr('Crest')), h('div', { class: 'crest-pick' }, preview, h('div', { class: 'crest-opts' }, colours, emblems))),
    h('section', { class: 'section' }, h('h3', {}, tr('Rules at the club’s tables')), rules),
    err,
    h('div', { class: 'btn-row' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => ((view = { kind: 'list' }), void render(ctx)) }, tr('Cancel')), submit),
  ) as HTMLFormElement;
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!spec.name.trim()) return void (err.textContent = tr('Give the club a name.'));
    submit.disabled = true;
    try {
      const c = await clubsBackend().create({ ...spec, name: spec.name.trim().slice(0, 32) });
      view = { kind: 'club', id: c.id };
      void render(ctx);
    } catch (x) {
      err.textContent = (x as Error).message;
      submit.disabled = false;
    }
  };
  page(ctx, tr('Found a club'), form);
  name.focus({ preventScroll: true });
}

/** The table a club game is played at: the club's variation, length and house rules. */
function clubTable(ctx: AppCtx, c: PrivateClub): TableConfig {
  const base = ctx.tableFor(getProfile(c.variation) ? c.variation : 'classic');
  return { ...base, name: c.name, length: (c.length in GAME_LENGTHS ? c.length : base.length) as GameLength, houseRules: { ...base.houseRules, ...c.houseRules } };
}

function clubPage(ctx: AppCtx, c: PrivateClub) {
  const v = vinfo(c.variation);
  const prof = getProfile(c.variation);
  const ruleText = (prof?.houseRules ?? [])
    .filter((r) => c.houseRules[r.id] !== undefined && c.houseRules[r.id] !== r.default)
    .map((r) => `${tr(r.label)}: ${tr(r.options.find((o) => o.value === c.houseRules[r.id])?.label ?? c.houseRules[r.id])}`);

  // Invite.
  const link = clubInviteLink(c.invite);
  const invite = h(
    'div',
    { class: 'club-invite' },
    h('div', {}, h('span', { class: 'muted small' }, tr('Invite code')), h('strong', {}, c.invite.toUpperCase())),
    h(
      'button',
      {
        class: 'btn sm',
        onclick: async (e: Event) => {
          const btn = e.currentTarget as HTMLButtonElement;
          const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string; url?: string }) => Promise<void> };
          if (!c.local && nav.share)
            try {
              return await nav.share({ title: c.name, text: tr('Join {name}, my private mahjong club at JongClub.', { name: c.name }), url: link });
            } catch (x) {
              if ((x as Error).name === 'AbortError') return;
            }
          await copyWithNote(btn, link, tr('Invite a friend'));
        },
      },
      tr('Invite a friend'),
    ),
    c.local ? h('p', { class: 'muted small' }, tr('Friends can join by link once the club server is live.')) : '',
  );

  // Tables.
  const tables = h('div', { class: 'tables club-tables', role: 'list' });
  const seats = seatsForVariation(c.variation);
  if (c.local) {
    for (const t of c.tables) {
      const names = t.host.split(', ');
      const members = names.map((n) => ROSTER.find((m) => m.name === n)).filter(Boolean) as typeof ROSTER;
      tables.append(
        h(
          'div',
          { class: 'table-row', role: 'listitem' },
          h('div', { class: 'tr-flag', 'aria-hidden': 'true' }, v.flag),
          h('div', { class: 'tr-main' }, h('div', { class: 'tr-name' }, t.title), h('div', { class: 'tr-meta' }, `${t.host} · ${v.name}`)),
          h('button', { class: 'btn sm', onclick: () => playLocal(ctx, c, members) }, tr('Sit down')),
        ),
      );
    }
  } else
    for (const t of c.tables)
      tables.append(
        h(
          'div',
          { class: 'table-row', role: 'listitem' },
          h('div', { class: 'tr-flag', 'aria-hidden': 'true' }, v.flag),
          h('div', { class: 'tr-main' }, h('div', { class: 'tr-name' }, t.title), h('div', { class: 'tr-meta' }, `${tr('Hosted by {name}', { name: t.host })} · ${new Date(t.at).toLocaleTimeString(lang(), { hour: '2-digit', minute: '2-digit' })}`)),
          h('button', { class: 'btn sm', onclick: () => joinLive(ctx, c, t.code) }, tr('Sit down')),
        ),
      );
  if (!c.tables.length) tables.append(h('div', { class: 'table-row empty' }, h('p', { class: 'muted' }, c.local ? tr('Nobody is at a club table just now. Open one and members will sit with you.') : tr('No club tables open. Open one and your members can sit down.'))));
  const open = h(
    'button',
    {
      class: 'btn primary',
      onclick: () => {
        if (c.local) {
          // Members who are around fill the other seats.
          const pool = c.members.filter((m) => m.ai).map((m) => ROSTER.find((r) => r.id === m.id)!).filter(Boolean);
          const start = Math.floor(Math.random() * Math.max(1, pool.length));
          playLocal(ctx, c, Array.from({ length: seats - 1 }, (_, i) => pool[(start + i) % pool.length]).filter(Boolean));
        } else void hostLive(ctx, c);
      },
    },
    tr('Open a club table'),
  );

  // League.
  const league = h(
    'ol',
    { class: 'board club-league' },
    ...c.league.map((r, i) => h('li', { class: r.me ? 'me' : '' }, h('span', { class: 'rk' }, String(i + 1)), h('span', { class: 'nm' }, r.name, h('em', {}, ` ${trn(r.games, '{n} game', '{n} games')} · ${trn(r.wins, '{n} win', '{n} wins')}`)), h('span', { class: 'num' }, tr('{n} pts', { n: r.points })))),
  );
  const weekEnd = new Date(Date.parse(`${c.week}T00:00:00Z`) + 7 * 86_400_000);
  const days = Math.max(0, Math.ceil((weekEnd.getTime() - Date.now()) / 86_400_000));

  // Leaderboard (loads after the page draws).
  const board = h('ol', { class: 'board club-board' }, h('li', {}, h('span', { class: 'muted small' }, tr('Loading…'))));
  void clubsBackend()
    .leaderboard(c, { id: c.members.find((m) => m.role === 'founder' && c.local)?.id ?? '', rating: ctx.profile.ratings[c.variation] ?? ctx.profile.rating })
    .then((rows) => {
      clear(board).append(...rows.map((r, i) => h('li', { class: r.me ? 'me' : '' }, h('span', { class: 'rk' }, String(i + 1)), avatarEl(r.avatar, r.name, 28), h('span', { class: 'nm' }, r.me && c.local ? tr('{name} (you)', { name: ctx.profile.name }) : r.name), h('span', { class: 'num' }, fmt(r.rating)))));
    })
    .catch((e: Error) => clear(board).append(h('li', {}, h('span', { class: 'muted small' }, e.message))));

  // Members.
  const people = h(
    'div',
    { class: 'people' },
    ...c.members.map((m) => h('div', { class: 'person' }, avatarEl(m.avatar, m.name, 40), h('div', { class: 'pmain' }, h('div', { class: 'pn' }, m.name === 'You' ? tr('{name} (you)', { name: ctx.profile.name }) : m.name, m.role === 'founder' ? h('span', { class: 'chip sm' }, tr('Founder')) : ''), h('div', { class: 'muted small' }, m.ai ? tr('Club roster member') : tr('Member since {date}', { date: new Date(m.joined).toLocaleDateString(lang()) }))))),
  );

  const leave = h(
    'button',
    {
      class: 'btn ghost',
      onclick: async (e: Event) => {
        const b = e.currentTarget as HTMLButtonElement;
        if (b.dataset.sure !== '1') {
          b.dataset.sure = '1';
          b.textContent = c.local ? tr('Close the club for good?') : tr('Leave this club?');
          return;
        }
        await clubsBackend()
          .leave(c.id)
          .catch(() => {});
        view = { kind: 'list' };
        void render(ctx);
      },
    },
    c.local ? tr('Close the club') : tr('Leave the club'),
  );

  page(
    ctx,
    c.name,
    h(
      'div',
      { class: 'club-hero' },
      crestEl(c.crest, 88),
      h(
        'div',
        { class: 'club-facts' },
        h('p', {}, `${v.flag} ${v.name} · ${tr(GAME_LENGTHS[c.length as GameLength]?.label ?? '')} · ${trn(c.members.length, '{n} member', '{n} members')}`),
        h('p', { class: 'muted small' }, ruleText.length ? tr('House rules: {rules}', { rules: ruleText.join(' · ') }) : tr('House rules: as written')),
        invite,
      ),
    ),
    h('section', { class: 'section' }, h('div', { class: 'section-head' }, h('h3', {}, tr('Club tables')), h('p', { class: 'muted' }, tr('Every table here plays the club’s rules.'))), tables, h('div', { class: 'btn-row clubs-actions' }, open)),
    h('section', { class: 'section' }, h('div', { class: 'section-head' }, h('h3', {}, tr('This week’s league')), h('p', { class: 'muted' }, `${tr('4 points for 1st, 2 for 2nd, 1 for 3rd.')} ${days ? trn(days, 'A new week starts in {n} day.', 'A new week starts in {n} days.') : tr('A new week starts tomorrow.')}`)), c.league.length ? league : h('p', { class: 'muted' }, tr('No club games this week yet.'))),
    h('section', { class: 'section' }, h('div', { class: 'section-head' }, h('h3', {}, tr('Leaderboard')), h('p', { class: 'muted' }, tr('Members by {name} rating. Ratings move only in ranked games.', { name: v.name }))), board),
    h('section', { class: 'section' }, h('h3', {}, tr('Members')), people),
    h('div', { class: 'btn-row' }, leave),
  );
}

/** Local club: an AI table with club members in the other seats; the result counts in the league. */
function playLocal(ctx: AppCtx, c: PrivateClub, members: typeof ROSTER) {
  const cfg = clubTable(ctx, c);
  const n = seatsForVariation(c.variation);
  const seats: SeatSpec[] = [{ kind: 'local', name: ctx.profile.name }];
  for (const m of members.slice(0, n - 1)) seats.push({ kind: 'ai', name: m.name, personality: m.personality as Personality, difficulty: m.difficulty, avatar: m.avatar });
  // Not enough members around: club regulars from the roster fill in.
  for (const m of ROSTER) if (seats.length < n && !seats.some((s) => s.name === m.name)) seats.push({ kind: 'ai', name: m.name, personality: m.personality, difficulty: m.difficulty, avatar: m.avatar });
  ctx.startMatch(cfg, { seed: randomSeed(), seats, mode: 'private', tag: `club:${c.id}` });
}

/** Server club: a private live table with the club's rules, listed on the club page. */
async function hostLive(ctx: AppCtx, c: PrivateClub) {
  const lh = ctx.liveHost?.();
  if (!ctx.club || !lh) return flashNote(tr('Live club tables need the club server.'), true);
  const cfg = clubTable(ctx, c);
  const title = tr('{name} table', { name: c.name });
  const s = await ctx.club.host({ ...cfg, length: liveSafeLength(cfg.length), timer: cfg.timer || 30 }, ctx.who(), { title, isPrivate: true, ranked: false }).catch(() => null);
  if (!s) return flashNote(tr('The table couldn’t be opened. Please try again.'), true);
  void clubsBackend()
    .postTable(c.id, s.code, title)
    .catch(() => {});
  waitingRoom(clubLiveHost(ctx, c, lh), s);
}

async function joinLive(ctx: AppCtx, c: PrivateClub, code: string) {
  const lh = ctx.liveHost?.();
  if (!ctx.club || !lh) return flashNote(tr('Live club tables need the club server.'), true);
  const s = await ctx.club.join(code, ctx.who()).catch(() => null);
  if (s) waitingRoom(clubLiveHost(ctx, c, lh), s);
}

/** The live host, with club games tagged so their results count in the league. */
const clubLiveHost = (ctx: AppCtx, c: PrivateClub, lh: NonNullable<ReturnType<NonNullable<AppCtx['liveHost']>>>) => ({
  ...lh,
  startMatch: (cfg: TableConfig, opts: Parameters<AppCtx['startMatch']>[1]) => ctx.startMatch(cfg, { ...opts, tag: `club:${c.id}` }),
});
