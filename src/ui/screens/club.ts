// The Club: season, ranked, tournaments, daily challenges and private clubs up
// top; who is in the club now; rankings with the leagues and your friends
// beside them. The club's members are AI players (club/roster.ts) until online
// play opens, and the screen says so.

import { countryName, placeOf } from '../../club/location';
import { VARIATION_IDS, leaderboard, memberById, onlineNow, type ClubMember } from '../../club/roster';
import { avatarSvg } from '../../cosmetics/avatar';
import type { AvatarSpec } from '../../cosmetics/catalog';
import { VARIATIONS } from '../../engine/rules';
import { ordinal, saveProfile } from '../../progression/profile';
import { avatarPortraitUrl } from '../../render/avatar3d';
import { clubsEntry } from '../clubs';
import { openRanked } from '../compete';
import type { AppCtx } from '../ctx';
import { h, fmt } from '../dom';
import { LEAGUE_TIERS, glyph, leagueEmblem, tierOf, type LeagueName } from '../glyphs';
import { luxCard, luxRow } from '../luxCard';
import { seasonClubMode } from '../seasons';
import { lang, tr, trn } from '../../i18n';
import './club.css';

const vshort = (id: string) => tr((VARIATIONS.find((v) => v.id === id) ?? VARIATIONS[0]).short);

const busts: (() => void)[] = [];
let bustTimer = 0;
function queueBust(el: HTMLElement, spec: AvatarSpec, size: number) {
  busts.push(() => {
    if (!el.isConnected) return;
    const url = avatarPortraitUrl(spec, Math.min(160, size * 2));
    if (url) el.replaceChildren(h('img', { src: url, alt: '', width: String(size), height: String(size), draggable: 'false' }));
  });
  const next = () => {
    busts.shift()?.();
    bustTimer = busts.length ? window.setTimeout(next, 40) : 0;
  };
  if (!bustTimer) bustTimer = window.setTimeout(next, 120);
}

/** A round portrait: the 3D bust where the device can draw it, the flat avatar otherwise. */
export function portrait(spec: AvatarSpec | undefined, name: string, size: number, cls = ''): HTMLElement {
  if (!spec) return h('span', { class: `cl-av ${cls}`, style: { width: `${size}px`, height: `${size}px` }, 'aria-hidden': 'true' }, h('span', { class: 'cl-av-initial' }, (name[0] ?? '?').toUpperCase()));
  const el = h('span', { class: `cl-av ${cls}`, style: { width: `${size}px`, height: `${size}px` }, 'aria-hidden': 'true', html: avatarSvg(spec, size) });
  // Swap in the 3D bust after the screen has painted, one at a time, so opening the Club stays instant.
  if (size >= 40) queueBust(el, spec, size);
  return el;
}

let boardScope = 'overall';
let boardFilter: 'global' | 'country' | 'city' | 'friends' = 'global';

export function clubScreen(ctx: AppCtx) {
  const p = ctx.profile;
  const follow = (id: string) => () => {
    p.following = p.following.includes(id) ? p.following.filter((x) => x !== id) : [...p.following, id];
    saveProfile(p);
    ctx.go('club');
  };
  const tier = tierOf(p.rating);

  // ------------------------------------------------ features
  // The season card's own text and target, in this screen's card.
  const seasonBtn = seasonClubMode(ctx);
  // Building the private clubs entry also opens an invite link (?club=CODE) straight away.
  const clubsBtn = clubsEntry(ctx);
  const seasonDetail = seasonBtn.querySelector('.mode-detail')?.textContent ?? '';
  const features = luxRow(
    [
      luxCard({ art: 'season', title: tr('Club Season'), line: seasonDetail, run: () => seasonBtn.click(), featured: true }),
      luxCard({ art: 'ranked', title: tr('Ranked'), line: `${tr(tier)} · ${fmt(p.rating)}`, run: () => openRanked(ctx) }),
      luxCard({ art: 'tournament', title: tr('Tournaments'), line: tr('Quick, Daily, Weekend and Global'), run: () => ctx.go('tournaments') }),
      luxCard({ art: 'daily', title: tr('Daily challenges'), line: tr('Today’s Hand, Perfect Discard and more'), run: () => ctx.go('daily') }),
      luxCard({ art: 'clubs', title: tr('Private clubs'), line: tr('Your own club: members, house rules, a weekly league'), run: () => clubsBtn.click() }),
    ],
    'cl-features',
  );

  // ------------------------------------------------ in the club now
  const live = ctx.club?.online().filter((x) => !x.isMe) ?? [];
  const regulars = onlineNow().slice(0, 9);
  const people = h(
    'div',
    { class: 'cl-people' },
    ...live.map((x) =>
      h(
        'div',
        { class: 'cl-person live' },
        portrait(x.who.avatar, x.who.name, 48),
        h('div', { class: 'cl-pmain' }, h('div', { class: 'cl-pname' }, x.who.name, h('span', { class: 'cl-tag live' }, tr('Live'))), h('div', { class: 'cl-pmeta' }, x.atTable ? tr('At a table') : tr('In the club now'))),
      ),
    ),
    ...regulars.map((m) => {
      const on = p.following.includes(m.id);
      return h(
        'div',
        { class: 'cl-person' },
        portrait(m.avatar, m.name, 48),
        h('div', { class: 'cl-pmain' }, h('div', { class: 'cl-pname' }, m.name), h('div', { class: 'cl-pmeta' }, `${m.city} · ${vshort(m.favoriteVariation)} · ${fmt(m.rating)}`)),
        h('button', { class: `cl-follow ${on ? 'on' : ''}`, 'aria-pressed': String(on), onclick: follow(m.id) }, h('span', { html: glyph(on ? 'check' : 'plus') }), on ? tr('Following') : tr('Follow')),
      );
    }),
  );

  // ------------------------------------------------ rankings
  const scopes: [string, string][] = [['overall', tr('Overall')], ...VARIATION_IDS.map((id): [string, string] => [id, vshort(id)])];
  const rate = (scope: string) => (scope === 'overall' ? p.rating : (p.ratings[scope] ?? p.rating));
  type Row = { rank: number; name: string; city: string; rating: number; me?: boolean; avatar?: AvatarSpec; id?: string };
  let rows: Row[] = leaderboard(boardScope).map((r) => ({ rank: r.rank, name: r.member.name, city: r.member.city, rating: r.rating, avatar: r.member.avatar, id: r.member.id }));
  if (boardFilter === 'friends') rows = rows.filter((r) => r.id && p.following.includes(r.id));
  if (boardFilter === 'country') rows = rows.filter((r) => !!p.country && placeOf(r.city)?.country === p.country);
  if (boardFilter === 'city') rows = rows.filter((r) => !!p.city && r.city === p.city);
  rows.push({ rank: 0, name: tr('{name} (you)', { name: p.name }), city: p.city || tr(p.region), rating: rate(boardScope), me: true, avatar: p.avatar });
  rows.sort((a, b) => b.rating - a.rating);
  rows.forEach((r, i) => (r.rank = i + 1));
  const myRank = rows.find((r) => r.me)!.rank;
  const shown = rows.filter((r, i) => i < 10 || r.me);

  const scopeStrip = h(
    'div',
    { class: 'cl-scopes', role: 'radiogroup', 'aria-label': tr('Ranking') },
    ...scopes.map(([id, label]) => h('button', { class: id === boardScope ? 'on' : '', role: 'radio', 'aria-checked': String(id === boardScope), onclick: () => ((boardScope = id), ctx.go('club')) }, label)),
  );
  const scroller = h('div', { class: 'cl-scope-wrap' }, scopeStrip, h('button', { class: 'cl-scope-more', 'aria-label': tr('More'), html: glyph('chevron'), onclick: () => scopeStrip.scrollBy({ left: scopeStrip.clientWidth * 0.7 * (document.dir === 'rtl' ? -1 : 1), behavior: 'smooth' }) }));
  const filters = h(
    'div',
    { class: 'cl-filters', role: 'radiogroup', 'aria-label': tr('Who') },
    ...(
      [
        ['global', tr('Global'), 'globe'],
        ['country', p.country ? countryName(p.country, lang()) : tr('Country'), 'pin'],
        ['city', p.city || tr('City'), 'city'],
        ['friends', tr('Following'), 'people'],
      ] as const
    ).map(([id, label, ico]) => h('button', { class: id === boardFilter ? 'on' : '', role: 'radio', 'aria-checked': String(id === boardFilter), onclick: () => ((boardFilter = id), ctx.go('club')) }, h('span', { html: glyph(ico) }), label)),
  );
  const rankMark = (n: number) => (n <= 3 ? h('span', { class: 'cl-rk medal', html: leagueEmblem(n === 1 ? 'Gold' : n === 2 ? 'Silver' : 'Bronze', 24), 'aria-label': String(n) }) : h('span', { class: 'cl-rk' }, String(n)));
  const table = h(
    'div',
    { class: 'cl-board', role: 'table', 'aria-label': tr('Rankings') },
    h('div', { class: 'cl-row head', role: 'row' }, ...[tr('#'), tr('Player'), tr('Location'), tr('League'), tr('Points')].map((t, i) => h('span', { role: 'columnheader', class: i === 4 ? 'num' : '' }, t))),
    ...shown.map((r) => {
      const t = tierOf(r.rating);
      return h(
        'div',
        { class: `cl-row ${r.me ? 'me' : ''}`, role: 'row' },
        rankMark(r.rank),
        h('span', { class: 'cl-player' }, portrait(r.avatar, r.name, 28, 'sm'), h('span', { class: 'cl-nm' }, r.name)),
        h('span', { class: 'cl-loc' }, r.city),
        h('span', { class: 'cl-lg' }, h('span', { html: leagueEmblem(t, 20) }), tr(t)),
        h('span', { class: 'num cl-pts' }, fmt(r.rating)),
      );
    }),
  );
  const rankings = h(
    'section',
    { class: 'cl-panel cl-rankings' },
    h('div', { class: 'cl-head' }, h('h3', {}, tr('Rankings'))),
    scroller,
    filters,
    table,
    boardFilter === 'friends' && rows.length === 1 ? h('p', { class: 'cl-note' }, tr('Follow club members to see them here.')) : null,
    (boardFilter === 'country' || boardFilter === 'city') && !(boardFilter === 'city' ? p.city : p.country)
      ? h('p', { class: 'cl-note' }, tr('Set your country and city on your Profile to see who plays near you.'), ' ', h('button', { class: 'cc-link', onclick: () => ctx.go('profile') }, tr('Set location')))
      : (boardFilter === 'country' || boardFilter === 'city') && rows.length === 1
        ? h('p', { class: 'cl-note' }, tr('No club members near you yet, so you top this board. Global shows everyone.'))
        : null,
    h('p', { class: 'cl-note' }, tr('You are {rank} of {n}. Ratings only move in ranked games.', { rank: ordinal(myRank), n: rows.length }), ' ', tr('Club members are JongClub’s AI players until online play opens.')),
  );

  // ------------------------------------------------ leagues and friends
  const leagues = h(
    'section',
    { class: 'cl-panel cl-leagues' },
    h('div', { class: 'cl-head' }, h('h3', {}, tr('Leagues'))),
    h(
      'ol',
      { class: 'cl-tiers' },
      ...LEAGUE_TIERS.map(([name, min]) =>
        h('li', { class: name === tier ? 'on' : '' }, h('span', { class: 'cl-tier-emb', html: leagueEmblem(name, 34) }), h('b', {}, tr(name)), h('small', {}, name === tier ? `${tr('You')} · ${fmt(p.rating)}` : min ? `${fmt(min)}+` : '')),
      ),
    ),
    leagueNext(tier, p.rating),
  );
  const followed = p.following.map((id) => memberById(id)).filter(Boolean) as ClubMember[];
  const friendRows = [
    ...p.friends.map((f) => h('div', { class: 'cl-friend' }, portrait(undefined, f.name, 36), h('div', { class: 'cl-pmain' }, h('div', { class: 'cl-pname' }, f.name), h('div', { class: 'cl-pmeta' }, `${tr('Played together')} · ${new Date(f.since).toLocaleDateString(lang())}`)))),
    ...followed.map((m) => h('div', { class: 'cl-friend' }, portrait(m.avatar, m.name, 36), h('div', { class: 'cl-pmain' }, h('div', { class: 'cl-pname' }, m.name), h('div', { class: 'cl-pmeta' }, `${m.city} · ${vshort(m.favoriteVariation)}`)), h('button', { class: 'cl-follow on', onclick: follow(m.id) }, h('span', { html: glyph('check') }), tr('Following')))),
  ];
  const friends = h(
    'section',
    { class: 'cl-panel cl-friends' },
    h('div', { class: 'cl-head' }, h('h3', {}, tr('Friends')), friendRows.length ? h('span', { class: 'cl-count' }, trn(friendRows.length, '{n} person', '{n} people')) : null),
    friendRows.length
      ? h('div', { class: 'cl-friend-list' }, ...friendRows)
      : h(
          'div',
          { class: 'cl-empty' },
          h('span', { class: 'cl-empty-ico', html: glyph('people') }),
          h('p', {}, tr('People you play live tables with appear here, and members you follow.')),
          h('button', { class: 'btn sm ghost cl-find', onclick: () => ctx.go('play') }, h('span', { html: glyph('search') }), tr('Find friends')),
        ),
  );

  const liveNote = live.length ? trn(live.length, '{n} person here with you, and club members dropping by.', '{n} people here with you, and club members dropping by.') : tr('Club members dropping by right now.');
  return h(
    'div',
    { class: 'page club-page' },
    h('header', { class: 'page-head' }, h('p', { class: 'eyebrow' }, tr('Club')), h('h2', {}, tr('Friends, rankings and tournaments'))),
    features,
    h('section', { class: 'cl-now' }, h('div', { class: 'cl-head' }, h('h3', {}, tr('In the club now')), h('p', {}, liveNote, ' ', h('span', { class: 'cl-tag' }, h('span', { html: glyph('sparkle') }), tr('AI members')))), people),
    h('div', { class: 'cl-split' }, rankings, h('div', { class: 'cl-side' }, leagues, friends)),
  );
}

/** The climb to the next league: its emblem, the rating it opens at and how far there is to go. */
function leagueNext(tier: LeagueName, rating: number): HTMLElement | null {
  const i = LEAGUE_TIERS.findIndex(([n]) => n === tier);
  if (i <= 0) return null;
  const [name, min] = LEAGUE_TIERS[i - 1];
  const from = LEAGUE_TIERS[i][1] || Math.min(rating, 1000);
  const share = Math.max(0.02, Math.min(1, (rating - from) / Math.max(1, min - from)));
  return h(
    'div',
    { class: 'cl-next' },
    h('span', { class: 'cl-tier-emb', html: leagueEmblem(name, 40) }),
    h(
      'div',
      { class: 'cl-next-main' },
      h('p', {}, tr('Next league: {league} at {rating}', { league: tr(name), rating: fmt(min) })),
      h('span', { class: 'xpbar' }, h('i', { style: { width: `${share * 100}%` } })),
      h('small', {}, tr('{n} rating to go, in ranked games', { n: fmt(min - rating) })),
    ),
  );
}
