// Passport (World Tour). The Club and Profile screens live in screens/club.ts and screens/profile.ts.

import { VARIATION_IDS } from '../club/roster';
import { avatarSvg } from '../cosmetics/avatar';
import { VARIATION_TABLE, byId, type AvatarSpec } from '../cosmetics/catalog';
import { GAME_LENGTHS } from '../engine/rounds';
import { VARIATIONS, variationTitle } from '../engine/rules';
import type { RuleProfile } from '../engine/rules/types';
import { isAnimal, isTypedJoker } from '../engine/tiles';
import { ACHIEVEMENTS, emptyVarStats, leagueOf, type Profile } from '../progression/profile';
import { dailyKey, variationChallenge } from '../club/daily';
import type { AppCtx } from './ctx';
import { clear, fmt, h } from './dom';
import { tr } from '../i18n';
import { worldTourScreen } from './worldTour';

/** What is in the set: flowers, jokers of every sort and animals, with the tile count. */
export function tileSetLine(prof: RuleProfile): string {
  const extra = prof.extraTiles ?? [];
  const khung = extra.filter(isTypedJoker).length;
  const animals = extra.filter(isAnimal).length;
  const base = prof.tileKinds.length * prof.copiesPerKind;
  const parts = [base === 136 ? tr('the 136 suit and honour tiles') : tr('{n} suit tiles (no winds or dragons)', { n: base })];
  if (prof.flowers) parts.push(tr('8 flowers, set aside when drawn'));
  if (prof.jokers) parts.push(tr(prof.card ? '{n} jokers (wild in groups of three or more)' : prof.wilds ? (prof.wilds.inPair ? '{n} jokers (wild for any tile)' : '{n} jokers (wild for any tile except in the pair)') : '{n} jokers', { n: prof.jokers }));
  if (khung) parts.push(tr('{n} Khung jokers (the Flower Joker is a bonus tile; the Wind, Dragon and Number Jokers each stand in for their own group)', { n: khung }));
  if (animals) parts.push(tr(prof.instantPayments ? '{n} animals (cat, mouse, rooster, centipede), set aside like flowers, and a predator with its prey pays out on the spot' : '{n} animals (cat, mouse, rooster, centipede), set aside like flowers', { n: animals }));
  const total = base + (prof.flowers ? 8 : 0) + (prof.jokers ?? 0) + extra.length;
  const list = parts.length > 1 ? tr('{items}; and {last}', { items: parts.slice(0, -1).join('; '), last: parts[parts.length - 1] }) : parts[0];
  return tr('{n} tiles: {list}. Hands of {size} tiles.', { n: total, list, size: prof.handSize });
}

const vinfo = (id: string) => VARIATIONS.find((v) => v.id === id) ?? VARIATIONS[0];
/** The Academy lesson for a variation: its own id, or the nearest lesson for games without one yet. */
const SHARED_LESSON: Record<string, string> = { classic: 'basics' };
const lessonOf = (id: string) => SHARED_LESSON[id] ?? id;

export function avatarNode(spec: AvatarSpec | undefined, name: string, size = 40, cls = '') {
  if (!spec) return h('div', { class: `avatar ${cls}`, 'aria-hidden': 'true' }, (name[0] ?? '?').toUpperCase());
  return h('div', { class: `avatar svg ${cls}`, 'aria-hidden': 'true', style: { width: `${size}px`, height: `${size}px` }, html: avatarSvg(spec, size) });
}

// ================================================================ passport

interface Stamp {
  label: string;
  done: boolean;
}

function stampsFor(p: Profile, id: string): Stamp[] {
  const vs = p.varStats[id] ?? emptyVarStats();
  const lesson = lessonOf(id);
  const tableId = VARIATION_TABLE[id];
  const daily = Object.entries(p.daily).some(([k, r]) => r.variation && variationChallenge(k).variation === id);
  return [
    { label: tr('Learn the rules'), done: p.lessonsDone.includes(lesson) },
    { label: tr('Play a game'), done: (p.variationGames[id] ?? 0) > 0 },
    { label: tr('Win a hand'), done: vs.handsWon > 0 || (p.variationWins[id] ?? 0) > 0 },
    { label: tr('Win a game'), done: (p.variationWins[id] ?? 0) > 0 },
    { label: tr('Play 10 games'), done: (p.variationGames[id] ?? 0) >= 10 },
    { label: tr('Play a ranked game'), done: (p.ratedByVariation[id] ?? 0) > 0 },
    // Only variations in the daily rotation have a day challenge to complete.
    ...((VARIATION_IDS as string[]).includes(id) ? [{ label: tr('Complete its day challenge'), done: daily }] : []),
    { label: tr('Sit at {table}', { table: byId('table', tableId)?.name ?? tr('its table') }), done: (p.variationGames[id] ?? 0) > 0 },
  ];
}

export function explored(p: Profile, id: string) {
  const s = stampsFor(p, id);
  return Math.round((s.filter((x) => x.done).length / s.length) * 100);
}

export function passportScreen(ctx: AppCtx) {
  return worldTourScreen(ctx, (id) => explored(ctx.profile, id), (id) => destination(ctx, id));
}

/** A destination's page: rules, lesson, table, stamps, achievements and stats. */
function destination(ctx: AppCtx, id: string) {
  const p = ctx.profile;
  const v = vinfo(id);
  const prof = v.profile!;
  const vs = p.varStats[id] ?? emptyVarStats();
  const stamps = stampsFor(p, id);
  const table = byId('table', VARIATION_TABLE[id]);
  const o = ctx.modal;
  clear(o).hidden = false;
  const games = p.variationGames[id] ?? 0;
  const wins = p.variationWins[id] ?? 0;
  const rating = p.ratings[id] ?? p.rating;
  const achievements = ACHIEVEMENTS.filter((a) => (id === 'riichi' && a.id === 'riichi-master') || a.id === 'passport' || (id === 'classic' && (a.id === 'four-winds' || a.id === 'first-table')));
  o.append(
    h(
      'div',
      { class: 'card destination' },
      h('p', { class: 'eyebrow' }, `${v.flag} ${tr(v.region)}`),
      h('h3', {}, variationTitle(v)),
      h('p', { class: 'muted' }, tr(prof.summary)),
      table ? h('div', { class: 'dest-table' }, h('div', { class: 'item-prev felt', style: { background: `radial-gradient(circle at 50% 40%, color-mix(in srgb, ${table.swatch[0]} 70%, white 12%), ${table.swatch[0]})`, borderColor: table.swatch[1] } }), h('div', {}, h('strong', {}, table.name), h('div', { class: 'muted small' }, table.blurb))) : '',
      h('h4', {}, tr('Rules at this table')),
      h(
        'ul',
        { class: 'rules-list' },
        h('li', {}, tileSetLine(prof)),
        h('li', {}, `${tr('Calls: {calls}.', { calls: [prof.calls.chow ? prof.callNames.chow : null, prof.callNames.pung, prof.callNames.kong].filter((x): x is string => !!x).map((x) => tr(x)).join(', ') })} ${prof.callNames.win === prof.callNames.selfDraw ? tr('Call {win} to win, on a discard or your own draw.', { win: tr(prof.callNames.win) }) : tr('Win with {win} on a discard or {self} on your own draw.', { win: tr(prof.callNames.win), self: tr(prof.callNames.selfDraw) })}`),
        h('li', {}, tr('Usual length: {length}.', { length: tr(GAME_LENGTHS[ctx.tableFor(id).length].label) })),
        prof.houseRules.length ? h('li', {}, tr('House rules: {rules}.', { rules: prof.houseRules.map((r) => tr(r.label)).join(', ') })) : '',
      ),
      h('h4', {}, tr('Stamps')),
      h('ul', { class: 'stamps' }, ...stamps.map((s) => h('li', { class: s.done ? 'done' : '' }, h('span', { 'aria-hidden': 'true' }, s.done ? '◆' : '◇'), s.label))),
      h('h4', {}, tr('Your statistics')),
      h(
        'div',
        { class: 'stats-grid small-grid' },
        ...(
          [
            [tr('Games'), fmt(games)],
            [tr('Wins'), fmt(wins)],
            [tr('Win rate'), games ? `${Math.round((wins / games) * 100)}%` : '—'],
            [tr('Rating'), `${leagueOf(rating).icon} ${fmt(rating)}`],
          ] as [string, string][]
        ).map(([k, val]) => h('div', { class: 'stat' }, h('span', { class: 'k' }, k), h('span', { class: 'v' }, val))),
      ),
      vs.hands ? h('p', { class: 'muted small' }, tr('{n} of {total} hands won.', { n: fmt(vs.handsWon), total: fmt(vs.hands) })) : '',
      achievements.length ? h('p', { class: 'muted small' }, tr('Achievements here: {list}', { list: achievements.map((a) => `${p.achievements[a.id] ? '◆' : '◇'} ${a.name}`).join(' · ') })) : '',
      h(
        'div',
        { class: 'btn-row' },
        h('button', { class: 'btn ghost', onclick: () => (o.hidden = true) }, tr('Close')),
        h('button', { class: 'btn', onclick: () => ((o.hidden = true), ctx.openLesson(lessonOf(id))) }, tr('Lesson')),
        h('button', { class: 'btn primary', onclick: () => ((o.hidden = true), ctx.startMatch(ctx.tableFor(id))) }, tr('Play {name}', { name: v.short })),
      ),
    ),
  );
}

export const todayKey = dailyKey;
