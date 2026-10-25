// Profile and the avatar editor, after the user's reference mockups: a hero in
// your own room, your numbers in one panel, then folding cards for ratings,
// analytics, skills, achievements and your games. Only the player's own local
// data is shown.

import { applyLocation, citiesIn, COUNTRIES, countryName, fromGps, refreshLocation } from '../../club/location';
import { ROSTER } from '../../club/roster';
import { avatarSvg } from '../../cosmetics/avatar';
import { CATALOG, EYE_COLORS, HAIR_COLORS, SKIN_ORDER, SKIN_TONES, VARIATION_TABLE, byId, type AvatarSpec } from '../../cosmetics/catalog';
import { VARIATIONS } from '../../engine/rules';
import { loadReplays } from '../../net/replay';
import { ACHIEVEMENTS, levelOf, ordinal, saveProfile } from '../../progression/profile';
import { avatarPortraitUrl } from '../../render/avatar3d';
import { environmentPreview } from '../../render/backdrop';
import { owns as ownsItem } from '../atelier';
import type { AppCtx } from '../ctx';
import { clear, fmt, h } from '../dom';
import { glyph, leagueEmblem, tierOf } from '../glyphs';
import { skillsSection } from '../skills';
import { lang, shownName, tr, trn } from '../../i18n';
import './profile.css';

const vinfo = (id: string) => VARIATIONS.find((v) => v.id === id) ?? VARIATIONS[0];
const playable = () => VARIATIONS.filter((v) => v.profile);

/** Which folding cards are open (kept while you move around the app). */
const open: Record<string, boolean> = {};

/** A large round portrait: the 3D bust, or the flat avatar where WebGL is unavailable. */
function bigPortrait(spec: AvatarSpec, size: number): HTMLElement {
  const url = avatarPortraitUrl(spec, size);
  return url ? h('img', { class: 'pf-portrait-img', src: url, alt: '', draggable: 'false' }) : h('span', { class: 'pf-portrait-svg', html: avatarSvg(spec, size) });
}

/** A card with an emblem, title and one line, that opens to show more. */
function fold(id: string, ico: string, tone: string, title: string, line: string, body: () => Node | null) {
  const content = body();
  const card = h('section', { class: `pf-fold ${open[id] && content ? 'open' : ''} ${content ? '' : 'empty'}` });
  const head = h(
    content ? 'button' : 'div',
    { class: 'pf-fold-head', 'aria-expanded': content ? String(!!open[id]) : undefined },
    h('span', { class: `pf-emblem ${tone}`, html: glyph(ico) }),
    h('span', { class: 'pf-fold-text' }, h('h3', {}, title), h('span', { class: 'pf-fold-line' }, line)),
    content ? h('span', { class: 'pf-fold-chev', html: glyph('chevron') }) : null,
  );
  if (content) {
    head.addEventListener('click', () => {
      open[id] = !open[id];
      card.classList.toggle('open', open[id]);
      head.setAttribute('aria-expanded', String(open[id]));
    });
  }
  card.append(head);
  if (content) card.append(h('div', { class: 'pf-fold-body' }, content));
  return card;
}

export function profileScreen(ctx: AppCtx) {
  const p = ctx.profile;
  const lv = levelOf(p.xp);
  const tier = tierOf(p.rating);

  // ------------------------------------------------ hero
  const nameInput = h('input', { id: 'p-name', class: 'pf-name', value: shownName(p.name), maxlength: '18', size: String(Math.max(4, shownName(p.name).length + 1)), 'aria-label': tr('Display name') }) as HTMLInputElement;
  // Without field-sizing (Safari), the size attribute keeps the pencil beside the name.
  nameInput.oninput = () => (nameInput.size = Math.max(4, nameInput.value.length + 1));
  nameInput.readOnly = true;
  nameInput.tabIndex = -1;
  // Edit mode: the pencil starts it and turns into Done; Done, Enter, Escape or a tap anywhere else ends it.
  const penBtn = h('button', { type: 'button', class: 'pf-name-pen' }) as HTMLButtonElement;
  const paintPen = (on: boolean) => {
    penBtn.innerHTML = on ? `<span class="pf-pen-ico">${glyph('check')}</span>${tr('Done')}` : `<span class="pf-pen-ico">${glyph('pencil')}</span>`;
    penBtn.classList.toggle('on', on);
    penBtn.setAttribute('aria-label', on ? tr('Done') : tr('Display name'));
  };
  const startEdit = () => {
    nameInput.readOnly = false;
    nameInput.classList.add('editing');
    paintPen(true);
    nameInput.focus();
    nameInput.select();
  };
  const endEdit = () => {
    if (nameInput.readOnly) return;
    const v = nameInput.value.trim();
    p.name = !v || v === shownName('Guest') ? 'Guest' : v;
    nameInput.value = shownName(p.name);
    nameInput.size = Math.max(4, nameInput.value.length + 1);
    nameInput.readOnly = true;
    nameInput.classList.remove('editing');
    paintPen(false);
    saveProfile(p);
    ctx.club?.setWho(ctx.who());
    nameInput.blur();
  };
  // Keep focus in the field when Done is pressed, so the tap ends edit mode once (not blur, then start again).
  penBtn.onpointerdown = (e) => e.preventDefault();
  penBtn.onclick = () => (nameInput.readOnly ? startEdit() : endEdit());
  nameInput.onclick = () => nameInput.readOnly && startEdit();
  nameInput.onblur = endEdit;
  nameInput.onkeydown = (e) => {
    if (e.key === 'Enter') endEdit();
    else if (e.key === 'Escape') ((nameInput.value = shownName(p.name)), endEdit());
  };
  paintPen(false);
  const where = locationPicker(ctx);
  let roomArt = '';
  try {
    roomArt = environmentPreview(p.loadout.environment, 960, 360);
  } catch {
    roomArt = '';
  }
  const hero = h(
    'header',
    { class: 'pf-hero', style: roomArt ? { backgroundImage: `linear-gradient(90deg, rgba(9,13,11,.94) 0%, rgba(9,13,11,.7) 42%, rgba(9,13,11,.25) 75%, rgba(9,13,11,.5) 100%), linear-gradient(0deg, rgba(9,13,11,.95), transparent 45%), url(${roomArt})` } : undefined },
    h(
      'div',
      { class: 'pf-avatar' },
      h('button', { class: 'pf-portrait', 'aria-label': tr('Edit your avatar'), onclick: () => avatarEditor(ctx) }, bigPortrait(p.avatar, 160)),
      h('button', { class: 'pf-edit', 'aria-label': tr('Edit your avatar'), title: tr('Edit your avatar'), onclick: () => avatarEditor(ctx), html: glyph('pencil') }),
    ),
    h(
      'div',
      { class: 'pf-id' },
      h('p', { class: 'pf-rank' }, `${tr(tier)} · ${tr('Club Level {n}', { n: lv.level })}`),
      h('div', { class: 'pf-name-row' }, nameInput, penBtn),
      h('div', { class: 'pf-xp', title: `${fmt(lv.into)} / ${fmt(lv.need)} XP` }, h('i', { style: { width: `${Math.max(2, (lv.into / lv.need) * 100)}%` } })),
      where,
    ),
  );

  // ------------------------------------------------ numbers
  const favId = Object.entries(p.variationGames).sort((a, b) => b[1] - a[1])[0]?.[0];
  const fav = favId ? vinfo(favId) : null;
  const winRate = p.games ? Math.round((p.gamesWon / p.games) * 100) : 0;
  const globalRank = ROSTER.filter((m) => m.rating > p.rating).length + 1;
  const tiles: [string, string, string, string, boolean?][] = [
    ['coin', 'violet', tr('Jong Points'), fmt(p.jongPoints)],
    ['gamepad', 'sky', tr('Games'), fmt(p.games)],
    ['trophy', 'jade', tr('Wins'), fmt(p.gamesWon)],
    ['percent', 'ruby', tr('Win rate'), `${winRate}%`],
    ['hand', 'sky', tr('Hands won'), fmt(p.handsWon)],
    ['flame', 'amber', tr('Longest streak'), fmt(p.longestStreak)],
    ['leaf', 'jade', tr('Favourite table'), fav ? (byId('table', VARIATION_TABLE[fav.id])?.name ?? tr('Classic Green')) : tr('Classic Green'), true],
    ['crown', 'violet', tr('Club rank'), `#${fmt(globalRank)}`],
  ];
  if (fav) tiles.splice(6, 0, ['tiles', 'amber', tr('Favourite variation'), fav.name, true]);
  if (p.bestHand) tiles.push(['star', 'amber', tr('Best hand'), tr('{n} pts', { n: fmt(p.bestHand.points) })]);
  if (p.history.length) tiles.push(['bars', 'sky', tr('Average score'), fmt(p.history.reduce((a, g) => a + g.score, 0) / p.history.length)]);
  const numbers = h(
    'section',
    { class: 'pf-numbers' },
    h(
      'div',
      { class: 'pf-rating' },
      // Gold throughout: the beginner's sprout is drawn in gold line, league medals sit in the same gold ring.
      h('span', { class: 'pf-rating-emb', html: tier === 'Beginner' ? glyph('sprout') : leagueEmblem(tier, 44) }),
      h('span', { class: 'pf-rating-k' }, tr('Rating')),
      !p.ratedGames ? h('span', { class: 'pf-rating-sub' }, tr('Provisional')) : null,
      h('b', { class: 'pf-rating-v' }, fmt(p.rating)),
    ),
    h('div', { class: 'pf-tiles' }, ...tiles.map(([ico, tone, k, v, word]) => h('div', { class: `pf-tile ${word ? 'word' : ''}` }, h('span', { class: `pf-tile-ico ${tone}`, html: glyph(ico) }), h('span', { class: 'pf-tile-k' }, k), h('b', { class: 'pf-tile-v' }, v)))),
  );

  // ------------------------------------------------ ratings by variation
  const played = playable().filter((v) => p.ratings[v.id] || p.varStats[v.id]?.games || p.variationGames[v.id]);
  played.sort((a, b) => (p.ratings[b.id] ? 1 : 0) - (p.ratings[a.id] ? 1 : 0) || (p.variationGames[b.id] ?? 0) - (p.variationGames[a.id] ?? 0));
  const hist = p.ratingHistory;
  const ratings = fold(
    'ratings',
    'star',
    'gold',
    tr('Ratings by variation'),
    played.length ? trn(played.length, '{n} variation played', '{n} variations played') : tr('Play any variation and it will appear here. Ranked games give it a rating.'),
    () =>
      played.length
        ? h(
            'div',
            { class: 'pf-ratings' },
            h(
              'div',
              { class: 'pf-var-list' },
              ...played.map((v) => {
                const r = p.ratings[v.id];
                const n = p.variationGames[v.id] ?? p.varStats[v.id]?.games ?? 0;
                return h('div', { class: `pf-var ${r ? '' : 'unrated'}` }, h('span', { class: 'pf-var-flag' }, v.flag), h('span', { class: 'pf-var-name' }, v.short), r ? h('span', { class: 'pf-var-emb', html: leagueEmblem(tierOf(r), 20) }) : null, h('b', {}, r ? fmt(r) : tr('Unrated')), n ? h('small', {}, trn(n, '{n} game', '{n} games')) : null);
              }),
            ),
            hist.length > 1 ? h('div', { class: 'pf-spark' }, h('span', { class: 'pf-sub' }, tr('Rating over your ranked games')), sparkline(hist.map((x) => x.rating))) : null,
          )
        : null,
  );

  // ------------------------------------------------ analytics
  const rowsV = playable().filter((v) => p.varStats[v.id]?.games);
  const tot = Object.values(p.varStats).reduce((a, s) => ({ hands: a.hands + s.hands, dealIns: a.dealIns + s.dealIns, decisions: a.decisions + s.decisions, good: a.good + s.good, calls: a.calls + s.calls }), { hands: 0, dealIns: 0, decisions: 0, good: 0, calls: 0 });
  const insights: string[] = [];
  if (tot.decisions >= 20) insights.push(tr(tot.good / tot.decisions >= 0.8 ? 'Your discards match JongBot’s most efficient choice {n}% of the time. Excellent tile efficiency.' : 'Your discards match the most efficient choice {n}% of the time. Review a game to see where useful tiles slipped away.', { n: Math.round((tot.good / tot.decisions) * 100) }));
  if (tot.hands >= 10) insights.push(tot.dealIns / tot.hands > 0.18 ? tr('You deal in fairly often. When someone is ready, try discarding tiles they have already thrown.') : tr('You rarely feed winning tiles. Solid defence.'));
  if (tot.hands >= 10 && tot.calls / tot.hands > 1.2) insights.push(tr('You call a lot. Open hands are faster but easier to read.'));
  const analytics = fold(
    'analytics',
    'bars',
    'violet',
    tr('Analytics'),
    rowsV.length ? (tot.decisions ? tr('Discard accuracy {n}%', { n: Math.round((tot.good / tot.decisions) * 100) }) : trn(rowsV.length, '{n} variation played', '{n} variations played')) : tr('Play a few games to see your analytics: win rate, deal-ins, discard accuracy and more.'),
    () =>
      rowsV.length
        ? h(
            'div',
            {},
            h(
              'div',
              { class: 'table-wrap' },
              h(
                'table',
                { class: 'history analytics' },
                h('thead', {}, h('tr', {}, h('th', {}, tr('Variation')), h('th', { class: 'num' }, tr('Games')), h('th', { class: 'num' }, tr('Win rate')), h('th', { class: 'num' }, tr('Avg place')), h('th', { class: 'num' }, tr('Hands won')), h('th', { class: 'num' }, tr('Deal-ins')), h('th', { class: 'num' }, tr('Discard accuracy')), h('th', { class: 'num' }, tr('Avg win')))),
                h(
                  'tbody',
                  {},
                  ...rowsV.map((v) => {
                    const s = p.varStats[v.id];
                    const avgPlace = s.placements.reduce((a, n, i) => a + n * (i + 1), 0) / Math.max(1, s.games);
                    return h(
                      'tr',
                      {},
                      h('td', {}, `${v.flag} ${tr(v.short)}`),
                      h('td', { class: 'num' }, fmt(s.games)),
                      h('td', { class: 'num' }, `${Math.round((s.wins / s.games) * 100)}%`),
                      h('td', { class: 'num' }, avgPlace.toFixed(2)),
                      h('td', { class: 'num' }, s.hands ? `${Math.round((s.handsWon / s.hands) * 100)}%` : '—'),
                      h('td', { class: 'num' }, s.hands ? `${Math.round((s.dealIns / s.hands) * 100)}%` : '—'),
                      h('td', { class: 'num' }, s.decisions ? `${Math.round((s.good / s.decisions) * 100)}%` : '—'),
                      h('td', { class: 'num' }, s.handsWon ? fmt(s.winPoints / s.handsWon) : '—'),
                    );
                  }),
                ),
              ),
            ),
            insights.length ? h('ul', { class: 'insights' }, ...insights.map((t) => h('li', {}, t))) : null,
          )
        : null,
  );

  // ------------------------------------------------ skills
  const sk = skillsSection(ctx);
  const skList = sk.querySelector('.sk-list');
  const skills = fold('skills', 'target', 'sky', tr('Skills'), skList ? tr('Efficiency, defence, speed to ready and call rate, with a trend over recent games.') : tr('Finish a game to see your efficiency, defence, speed to ready and call rate, with a trend over recent games.'), () => (skList ? h('div', { class: 'skills' }, skList) : null));

  // ------------------------------------------------ achievements
  const got = ACHIEVEMENTS.filter((a) => p.achievements[a.id]).length;
  const achievements = h(
    'section',
    { class: 'pf-ach' },
    h('div', { class: 'pf-ach-head' }, h('span', { class: 'pf-emblem gold', html: glyph('trophy') }), h('h3', {}, tr('Achievements')), h('span', { class: 'pf-ach-count' }, tr('{n} of {total}', { n: got, total: ACHIEVEMENTS.length }))),
    h(
      'div',
      { class: 'pf-ach-grid' },
      ...ACHIEVEMENTS.map((a) => {
        const on = !!p.achievements[a.id];
        return h('div', { class: `pf-ach-card ${on ? 'got' : ''}` }, h('span', { class: 'pf-ach-mark', html: glyph(on ? 'check' : 'diamond') }), h('div', {}, h('div', { class: 'pf-ach-name' }, a.name), h('div', { class: 'pf-ach-detail' }, a.detail)));
      }),
    ),
    p.trophies.length ? h('div', { class: 'pf-trophies' }, ...p.trophies.map((t) => h('span', { class: 'pf-trophy' }, h('span', { class: 'pf-trophy-ico', html: glyph('trophy') }), t.name))) : null,
  );

  // ------------------------------------------------ game history
  const replays = loadReplays();
  const last = p.history[0];
  const history = fold(
    'history',
    'history',
    'gold',
    tr('Game history'),
    p.history.length || replays.length ? `${trn(p.history.length, '{n} game', '{n} games')}${last ? ` · ${new Date(last.date).toLocaleDateString(lang())}` : ''}` : tr('Your games will appear here.'),
    () =>
      p.history.length || replays.length
        ? h(
            'div',
            { class: 'pf-history' },
            replays.length
              ? h(
                  'div',
                  { class: 'pf-replays' },
                  h('span', { class: 'pf-sub' }, tr('Game replays')),
                  ...replays.slice(0, 12).map((r) =>
                    h(
                      'div',
                      { class: 'pf-replay' },
                      h('span', { class: 'pf-replay-name' }, `${vinfo(r.config.variation).flag} ${r.config.name}`),
                      h('span', { class: 'pf-replay-meta' }, `${new Date(r.date).toLocaleDateString(lang())} · ${trn(r.hands.length, '{n} hand', '{n} hands')}${r.me >= 0 ? ` · ${ordinal(r.placement)}` : ` · ${tr('watched')}`}`),
                      h('button', { class: 'btn sm', onclick: () => ctx.openReplay(r) }, h('span', { class: 'pf-btn-ico', html: glyph('history') }), tr('Review')),
                    ),
                  ),
                )
              : null,
            p.history.length
              ? h(
                  'div',
                  { class: 'table-wrap' },
                  h(
                    'table',
                    { class: 'history' },
                    h('thead', {}, h('tr', {}, h('th', {}, tr('Date')), h('th', {}, tr('Game')), h('th', {}, tr('Place')), h('th', { class: 'num' }, tr('Score')), h('th', { class: 'num' }, tr('Jong Points')))),
                    h('tbody', {}, ...p.history.map((g) => h('tr', {}, h('td', {}, new Date(g.date).toLocaleDateString(lang())), h('td', {}, `${vinfo(g.variation).short} · ${tr(g.length)}`), h('td', {}, ordinal(g.placement)), h('td', { class: 'num' }, fmt(g.score)), h('td', { class: 'num' }, `+${fmt(g.points)}`)))),
                  ),
                )
              : null,
          )
        : null,
  );

  return h(
    'div',
    { class: 'page pf-page' },
    hero,
    numbers,
    ratings,
    analytics,
    skills,
    achievements,
    history,
    h('footer', { class: 'pf-motto', 'aria-hidden': 'true' }, h('span', { class: 'pf-motto-ico', html: glyph('lotus') }), h('span', {}, tr('Learn. Play. Master.'))),
  );
}

function sparkline(values: number[]) {
  const w = 320;
  const ht = 64;
  const min = Math.min(...values) - 10;
  const max = Math.max(...values) + 10;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(ht - ((v - min) / (max - min)) * ht).toFixed(1)}`).join(' ');
  const last = values[values.length - 1];
  return h('div', {
    class: 'spark',
    html: `<svg viewBox="0 0 ${w} ${ht}" width="100%" height="${ht}" preserveAspectRatio="none" role="img" aria-label="${tr('Rating trend, now {n}', { n: Math.round(last) })}"><polyline fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke" points="${pts}"/></svg>`,
  });
}

// ================================================================ location

/**
 * Country and city for the leaderboards: found from the IP address (or the
 * time zone when that's blocked), made precise with the device's location
 * on request, or picked by hand.
 */
function locationPicker(ctx: AppCtx) {
  const p = ctx.profile;
  const box = h('div', { class: 'pf-loc' });
  const names = new Map(COUNTRIES.map((cc) => [cc, countryName(cc, lang())]));
  const paint = (busy = false, note = '') => {
    const cc = p.country ?? '';
    const cities = cc ? citiesIn(cc) : [];
    if (p.city && !cities.includes(p.city)) cities.unshift(p.city);
    const country = h(
      'select',
      { class: 'pf-loc-select', 'aria-label': tr('Country') },
      cc ? null : h('option', { value: '', selected: true }, tr('Choose your country')),
      ...[...names].sort((a, b) => a[1].localeCompare(b[1], lang())).map(([code, name]) => h('option', { value: code, selected: code === cc }, name)),
    ) as HTMLSelectElement;
    country.onchange = () => {
      applyLocation(p, { country: country.value, city: citiesIn(country.value)[0] ?? '', source: 'manual' });
      saveProfile(p);
      paint();
    };
    const city = h('select', { class: 'pf-loc-select', 'aria-label': tr('City') }, ...cities.map((c) => h('option', { value: c, selected: c === p.city }, c))) as HTMLSelectElement;
    city.onchange = () => {
      applyLocation(p, { country: cc, city: city.value, source: 'manual' });
      saveProfile(p);
      paint();
    };
    const precise = h('button', { class: 'pf-loc-gps', disabled: busy, 'aria-label': tr('Use my precise location'), title: tr('Use my precise location') }, h('span', { html: glyph('locate') }));
    precise.onclick = async () => {
      paint(true);
      const got = await fromGps();
      if (got) {
        applyLocation(p, got);
        saveProfile(p);
      }
      paint(false, got ? '' : tr('Your device didn’t share its location, so we kept {place}.', { place: p.city || tr('your choice') }));
    };
    const SRC: Record<string, string> = {
      gps: tr('Precise, from your device’s location.'),
      ip: tr('Found from your internet connection. Tap the target for your precise location.'),
      tz: tr('A guess from your time zone. Tap the target for your precise location.'),
      manual: tr('Chosen by you.'),
    };
    const auto = p.locSource === 'manual' ? h('button', { class: 'cc-link pf-loc-auto' }, tr('Find me automatically')) : null;
    if (auto)
      auto.onclick = async () => {
        p.locSource = undefined;
        paint(true);
        if (await refreshLocation(p)) saveProfile(p);
        paint();
      };
    box.replaceChildren(
      h(
        'div',
        { class: 'pf-loc-row' },
        h('label', { class: 'pf-region' }, h('span', { class: 'pf-region-ico', html: glyph('pin') }), country, h('span', { class: 'pf-region-caret', html: glyph('chevronDown') })),
        cc ? h('label', { class: 'pf-region' }, h('span', { class: 'pf-region-ico', html: glyph('city') }), city, h('span', { class: 'pf-region-caret', html: glyph('chevronDown') })) : null,
        precise,
      ),
      h('p', { class: 'pf-loc-note' }, busy ? tr('Finding you…') : note || (p.locSource ? SRC[p.locSource] : tr('Choose your country and city for the local leaderboards.')), auto ? ' ' : null, auto),
    );
  };
  paint();
  return box;
}

// ================================================================ avatar editor

/** Which editor sections are folded shut. */
const shut: Record<string, boolean> = {};

export function avatarEditor(ctx: AppCtx) {
  const p = ctx.profile;
  const saved: AvatarSpec = { ...p.avatar };
  const spec: AvatarSpec = { ...p.avatar };
  const o = ctx.modal;
  clear(o).hidden = false;
  const card = h('div', { class: 'card av-ed', role: 'dialog', 'aria-modal': 'true', 'aria-label': tr('Your avatar') });
  o.append(card);
  const owns = (cat: string, id: string) => {
    const item = CATALOG.find((c) => c.category === cat && c.id === id);
    return !item || ownsItem(p, item);
  };
  const outfits: AvatarSpec['outfit'][] = ['blazer', 'suit', 'qipao', 'kimono', 'kandura', 'sweater'];
  const accessories: AvatarSpec['accessory'][] = ['none', 'glasses', 'aviators', 'pixel', 'earrings', 'hat', 'fan', 'pearls'];
  const frames = CATALOG.filter((c) => c.category === 'frame').map((c) => c.id);
  const outfitColors = ['#1f3b33', '#141414', '#7a1f1b', '#1a2440', '#f5f3ee', '#8a6a4a', '#5a4321', '#2a1530'];
  const hairs: AvatarSpec['hair'][] = ['short', 'sidepart', 'slicked', 'buzz', 'shaved', 'curly', 'afro', 'wavy', 'bob', 'long', 'ponytail', 'braids', 'bun', 'topknot'];
  const HAIR_NAMES: Record<AvatarSpec['hair'], string> = {
    short: tr('Short'), long: tr('Long'), bun: tr('Bun'), bob: tr('Bob'), shaved: tr('Shaved'), wavy: tr('Wavy'), sidepart: tr('Side part'), slicked: tr('Slicked back'),
    buzz: tr('Buzz cut'), curly: tr('Curly'), afro: tr('Afro'), ponytail: tr('Ponytail'), braids: tr('Braids'), topknot: tr('Top knot'),
  };
  const PARTS: Record<NonNullable<AvatarSpec['hairPart']>, string> = { left: tr('Left'), centre: tr('Centre'), right: tr('Right') };
  const FACES: Record<NonNullable<AvatarSpec['face']>, string> = { oval: tr('Oval'), round: tr('Round'), long: tr('Oblong'), square: tr('Square'), heart: tr('Heart') };
  const EYES: Record<NonNullable<AvatarSpec['eyes']>, string> = { almond: tr('Almond'), round: tr('Round'), narrow: tr('Narrow'), hooded: tr('Hooded'), upturned: tr('Upturned') };
  const BROWS: Record<NonNullable<AvatarSpec['brows']>, string> = { soft: tr('Soft'), straight: tr('Straight'), arched: tr('Arched'), thick: tr('Thick') };
  const NOSES: Record<NonNullable<AvatarSpec['nose']>, string> = { button: tr('Button'), straight: tr('Straight'), broad: tr('Broad'), aquiline: tr('Aquiline') };
  const LIPS: Record<NonNullable<AvatarSpec['lips']>, string> = { thin: tr('Thin'), medium: tr('Medium'), full: tr('Full') };
  const BEARDS: Record<NonNullable<AvatarSpec['facialHair']>, string> = { none: tr('None'), stubble: tr('Stubble'), moustache: tr('Moustache'), goatee: tr('Goatee'), beard: tr('Full beard') };
  const keys = <K extends string>(r: Record<K, string>) => Object.keys(r) as K[];

  const previewBox = h('div', { class: 'av-stage-portrait' });
  const showPreview = () => previewBox.replaceChildren(bigPortrait(spec, 220));
  const body = h('div', { class: 'av-sections' });

  const options = <T extends string | number>(kind: 'swatch' | 'pill', values: T[], cur: () => T, set: (v: T) => void, show: (v: T) => string, locked?: (v: T) => boolean, colour: (v: T) => string = (v) => String(v)) => {
    const opts = h('div', { class: `av-opts ${kind}` });
    const paint = () =>
      opts.replaceChildren(
        ...values.map((v) => {
          const lock = locked?.(v) ?? false;
          const on = v === cur();
          const btn =
            kind === 'swatch'
              ? h('button', { class: `av-swatch ${on ? 'on' : ''}`, 'aria-label': show(v), 'aria-pressed': String(on), title: show(v) }, h('i', { style: { background: colour(v) } }), on ? h('span', { class: 'av-tick', html: glyph('check') }) : null)
              : h('button', { class: `av-pill ${on ? 'on' : ''} ${lock ? 'locked' : ''}`, 'aria-pressed': String(on), disabled: lock, title: lock ? tr('Find it in The Atelier') : undefined }, lock ? h('span', { class: 'av-pill-ico', html: glyph('lock') }) : null, show(v), on ? h('span', { class: 'av-tick', html: glyph('check') }) : null);
          btn.addEventListener('click', () => {
            set(v);
            paint();
            showPreview();
          });
          return btn;
        }),
      );
    paint();
    return opts;
  };
  /** A foldable section; with several rows, each row gets a small label. */
  const section = (id: string, ico: string, label: string, ...rows: [string | null, HTMLElement][]) => {
    const sec = h('section', { class: `av-sec ${shut[id] ? 'shut' : ''}` });
    const head = h('button', { class: 'av-sec-head', 'aria-expanded': String(!shut[id]) }, h('span', { class: 'av-sec-ico', html: glyph(ico) }), h('h4', {}, label), h('span', { class: 'av-sec-chev', html: glyph('chevronDown') }));
    head.addEventListener('click', () => {
      shut[id] = !shut[id];
      sec.classList.toggle('shut', shut[id]);
      head.setAttribute('aria-expanded', String(!shut[id]));
    });
    const body = rows.length === 1 && !rows[0]![0] ? rows[0]![1] : h('div', { class: 'av-rows' }, ...rows.map(([l, el]) => h('div', { class: 'av-row' }, l ? h('span', { class: 'av-row-label' }, l) : null, el)));
    sec.append(head, body);
    return sec;
  };

  const sections = () => [
    section('skin', 'face', tr('Skin'), [null, options('swatch', SKIN_ORDER, () => spec.skin, (v) => (spec.skin = v), (v) => tr('Skin tone {n}', { n: SKIN_ORDER.indexOf(v) + 1 }), undefined, (v) => SKIN_TONES[v] ?? '#ccc')]),
    section(
      'features',
      'face',
      tr('Face'),
      [tr('Face shape'), options('pill', keys(FACES), () => spec.face ?? 'oval', (v) => (spec.face = v), (v) => FACES[v])],
      [tr('Eyes'), options('pill', keys(EYES), () => spec.eyes ?? 'almond', (v) => (spec.eyes = v), (v) => EYES[v])],
      [tr('Eye colour'), options('swatch', EYE_COLORS, () => spec.eyeColor ?? EYE_COLORS[0]!, (v) => (spec.eyeColor = v), (v) => tr('Colour {n}', { n: EYE_COLORS.indexOf(v) + 1 }))],
      [tr('Brows'), options('pill', keys(BROWS), () => spec.brows ?? 'soft', (v) => (spec.brows = v), (v) => BROWS[v])],
      [tr('Nose'), options('pill', keys(NOSES), () => spec.nose ?? 'straight', (v) => (spec.nose = v), (v) => NOSES[v])],
      [tr('Lips'), options('pill', keys(LIPS), () => spec.lips ?? 'medium', (v) => (spec.lips = v), (v) => LIPS[v])],
      [tr('Facial hair'), options('pill', keys(BEARDS), () => spec.facialHair ?? 'none', (v) => (spec.facialHair = v), (v) => BEARDS[v])],
    ),
    section(
      'hair',
      'hair',
      tr('Hair'),
      [tr('Style'), options('pill', hairs, () => spec.hair, (v) => (spec.hair = v), (v) => HAIR_NAMES[v])],
      [tr('Parting'), options('pill', keys(PARTS), () => spec.hairPart ?? 'left', (v) => (spec.hairPart = v), (v) => PARTS[v])],
      [tr('Hair colour'), options('swatch', HAIR_COLORS, () => spec.hairColor, (v) => (spec.hairColor = v), (v) => tr('Colour {n}', { n: HAIR_COLORS.indexOf(v) + 1 }))],
    ),
    section(
      'outfit',
      'shirt',
      tr('Outfit'),
      [tr('Style'), options('pill', outfits, () => spec.outfit, (v) => (spec.outfit = v), (v) => byId('avatar', `outfit-${v}`)?.name ?? v, (v) => !owns('avatar', `outfit-${v}`))],
      [tr('Outfit colour'), options('swatch', outfitColors, () => spec.outfitColor, (v) => (spec.outfitColor = v), (v) => tr('Colour {n}', { n: outfitColors.indexOf(v) + 1 }))],
    ),
    section('accessory', 'glasses', tr('Accessory'), [null, options('pill', accessories, () => spec.accessory, (v) => (spec.accessory = v), (v) => byId('accessory', v)?.name ?? v, (v) => !owns('accessory', v))]),
    section('frame', 'frame', tr('Frame'), [null, options('pill', frames, () => spec.frame, (v) => (spec.frame = v), (v) => byId('frame', v)?.name ?? v, (v) => !owns('frame', v))]),
  ];
  const fillSections = () => body.replaceChildren(...sections());

  const close = () => (o.hidden = true);
  card.append(
    h('header', { class: 'av-head' }, h('span', { class: 'av-head-ico', html: glyph('fan') }), h('div', {}, h('h3', {}, tr('Your avatar')), h('p', {}, tr('Make it yours. Choose your style and stand out in the club.'))), h('button', { class: 'av-x', 'aria-label': tr('Close'), onclick: close, html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' })),
    h(
      'div',
      { class: 'av-main' },
      h(
        'aside',
        { class: 'av-stage' },
        previewBox,
        h(
          'button',
          {
            class: 'btn sm ghost av-reset',
            onclick: () => {
              Object.assign(spec, saved);
              fillSections();
              showPreview();
            },
          },
          h('span', { class: 'av-btn-ico', html: glyph('reset') }),
          tr('Reset'),
        ),
        h('button', { class: 'cc-link av-atelier', onclick: () => (close(), ctx.go('atelier')) }, tr('More in The Atelier')),
      ),
      body,
    ),
    h(
      'footer',
      { class: 'av-foot' },
      h('button', { class: 'btn ghost', onclick: close }, tr('Cancel')),
      h(
        'button',
        {
          class: 'btn primary av-save',
          onclick: () => {
            p.avatar = { ...spec };
            saveProfile(p);
            ctx.club?.setWho(ctx.who());
            close();
            ctx.go('profile');
          },
        },
        h('span', { class: 'av-btn-ico', html: glyph('check') }),
        tr('Save avatar'),
      ),
    ),
  );
  fillSections();
  showPreview();
}
