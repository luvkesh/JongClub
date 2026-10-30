// The Mahjong family: the whole catalogue by region (src/club/catalogue.ts),
// each game labelled with how standardised it is (formal ruleset, regional
// family, house-rule tradition) and whether it is playable yet. Playable games
// open a panel where Mei introduces them; from there you can learn the game in
// the Academy, play a guided hand with Mei, or just sit down at its table.
//
// American Mahjong is its own family: its card, jokers and Charleston never
// mix with the Asian tables.

import './versions.css';
import './variations.css';
import { narrator } from '../audio/voice';
import { sound } from '../audio/sound';
import { VARIATIONS, type VariationInfo } from '../engine/rules';
import { VARIATION_SHEETS } from '../club/variationSheets';
import { AVAILABILITY, CATALOGUE, REGIONS, STANDARDISATION, UAE_PROFILE, type CatalogueEntry, type Standardisation } from '../club/catalogue';
import { CAT, JOKER_KIND, MOUSE, ROOSTER } from '../engine/tiles';
import { icon } from './icons';
import type { AppCtx } from './ctx';
import { clear, h, tileImg } from './dom';
import { tr, trn } from '../i18n';

const LAST_KEY = 'jongclub.versions.last.v1';

interface Version {
  id: string;
  /** Academy lesson id. */
  lesson: string;
  /** The game has no lesson of its own yet: `lesson` is the nearest one. */
  sharedLesson?: boolean;
  /** One line for the map node. */
  hook: string;
  /** Club play: rules vary from table to table, so the host sets them. */
  club: boolean;
  who: string;
  facts: [string, string][];
  win: string;
  /** Mei's spoken introduction. No digits or abbreviations: it is read aloud. */
  mei: string;
}

const VERSIONS: Version[] = [
  {
    id: 'classic',
    lesson: 'basics',
    hook: tr('Four sets and a pair. The friendliest place to start.'),
    club: false,
    who: tr('Families and friends across China and Chinese communities everywhere. It is the shared root of every Asian table on this map.'),
    facts: [
      [tr('Hand'), tr('13 tiles; win with 14')],
      [tr('Tiles'), tr('136: three suits, winds and dragons')],
      [tr('Special tiles'), tr('None. Just the essentials')],
      [tr('Scoring'), tr('Faan')],
      [tr('Calls'), tr('Chow, Pung, Kong, Mahjong')],
    ],
    win: tr('Four sets and a pair. Seven pairs and thirteen orphans count too. No minimum score at our default table.'),
    mei: 'This is where it all began. Classic Mahjong comes from China, and it’s the friendliest place to start. You hold thirteen tiles, and you’re building four sets and a pair. Chow, pung and kong. That’s really the whole vocabulary. If you’re new, start right here with me.',
  },
  {
    id: 'riichi',
    lesson: 'riichi',
    hook: tr('Every win needs a yaku. Tactical and elegant.'),
    club: false,
    who: tr('Japan’s parlours, apps and pro leagues, and a big following online around the world.'),
    facts: [
      [tr('Hand'), tr('13 tiles; win with 14')],
      [tr('Tiles'), tr('136, with three red fives')],
      [tr('Special tiles'), tr('Dora indicators and red fives add value')],
      [tr('Scoring'), tr('Han and fu')],
      [tr('Calls'), tr('Chi, Pon, Kan, Ron, Tsumo, Riichi')],
    ],
    win: tr('Four sets and a pair with at least one yaku, a named scoring pattern. Watch out for furiten: if you discarded a winning tile, only Tsumo wins.'),
    mei: 'Riichi is Japan’s version, and it’s wonderfully tactical. The tiles are the same, but every win needs a yaku, a named scoring pattern. Keep your hand closed, declare riichi when you’re one tile away, and hope the dora smile on you. Just watch out for furiten!',
  },
  {
    id: 'taiwanese',
    lesson: 'taiwanese',
    hook: tr('Sixteen tiles, five sets, flowers and tai.'),
    club: false,
    who: tr('Homes, clubs and night markets across Taiwan, and Taiwanese communities abroad.'),
    facts: [
      [tr('Hand'), tr('16 tiles; win with 17')],
      [tr('Tiles'), tr('144, with eight flowers')],
      [tr('Special tiles'), tr('Flowers, set aside for bonus tai')],
      [tr('Scoring'), tr('Tai, plus a base payment')],
      [tr('Calls'), tr('Chi, Pong, Gang, Hu, Zimo')],
    ],
    win: tr('Five sets and a pair. On a discard win, only the discarder pays, and the dealer’s streak raises the stakes.'),
    mei: 'Taiwanese Mahjong gives you more to play with. You hold sixteen tiles, not thirteen, so you’re building five sets and a pair. Flowers count, and the hand is scored in tai. When you win on a discard, only the player who threw it pays. It’s fast and lively, in the best way.',
  },
  {
    id: 'vietnamese',
    lesson: 'vietnamese',
    hook: tr('Khung jokers, flowers and phán. Bright and quick.'),
    club: true,
    who: tr('Families and cafés across Vietnam and the Vietnamese diaspora. Every table plays it a little differently.'),
    facts: [
      [tr('Hand'), tr('13 tiles; win with 14')],
      [tr('Tiles'), tr('152 with Khung jokers, or 144 without')],
      [tr('Special tiles'), tr('Khung jokers for winds, dragons and numbers; flowers')],
      [tr('Scoring'), tr('Phán, added up')],
      [tr('Calls'), tr('Ăn, Phỗng, Chiếu, Ù')],
    ],
    win: tr('Four sets and a pair, with jokers standing in where the table allows. The host decides jokers, flowers and who pays.'),
    mei: 'Vietnamese Mahjong is bright and playful. Most tables add Khung jokers that can stand in for winds, dragons and numbers, and flowers are in play too. Your hand is scored in phán, added up at the end. Rules change from table to table, so think of ours as one friendly club’s way of playing.',
  },
  {
    id: 'uae',
    lesson: 'uae',
    hook: tr('A regional profile: pick the UAE ruleset your table plays.'),
    club: true,
    who: tr('Friends and clubs across Dubai and the Emirates, from every corner of the world. There is no single official UAE ruleset, so tables play several styles.'),
    facts: [
      [tr('Rulesets'), tr('Dubai Asian · Goulash & Hands, Dubai Taiwanese, Dubai American, or a custom table')],
      [tr('Hand'), tr('13 tiles (16 at Dubai Taiwanese)')],
      [tr('Goulash'), tr('After a wall game East stays, tiles are exchanged and the stakes rise')],
      [tr('Scoring'), tr('Faan, tai or the card, by ruleset')],
      [tr('Calls'), tr('Chow (if allowed), Pung, Kong, Mahjong')],
    ],
    win: tr('It depends on the ruleset you choose. At the Dubai Asian table: four sets and a pair meeting the minimum faan, and a goulash after every wall game.'),
    mei: 'Dubai has a lovely Mahjong scene, with friends playing at home and in clubs. There isn’t one official rulebook, so we call this the UAE and Dubai profile, and you pick the style your table plays. The Dubai Asian table is famous for its goulash: when nobody wins, East stays, everyone swaps tiles, and the next hand is worth more. You can also play Dubai Taiwanese, Dubai American, or build your own table.',
  },
  {
    id: 'india',
    lesson: 'india',
    hook: tr('Four rounds, four games: passports, small cards, goulash and East’s choice.'),
    club: true,
    who: tr('Club tables across India, played from the club rulebook.'),
    facts: [
      [tr('Hand'), tr('13 tiles; win with 14')],
      [tr('Tiles'), tr('144 with flowers and seasons')],
      [tr('Play styles'), tr('The full match: 16 games in 4 rounds. Or Classic: East round games without passports')],
      [tr('Scoring'), tr('500, 1,000 concealed, 2,000 fully concealed; East pays and receives double')],
      [tr('Sets'), tr('Chow, mixed chow, crochet, pung, kong; the pair may be a knit with a crochet')],
      [tr('Calls'), tr('Chow from the left, Pung, Kong, Mahjong; mixed chows, crochets, knits and pairs only to win')],
    ],
    win: tr('Four sets and a pair, where a set may be a mixed chow or a crochet, or a passport with sets and a pair.'),
    mei: 'India Rules is the club game played across India. A match is sixteen games in four rounds, and each round has a game of its own: passports in the East, small cards in the South, the goulash in the West, and in the North, East chooses. East always pays and receives double, so being East is exciting!',
  },
  {
    id: 'indian',
    lesson: 'indian',
    hook: tr('Jokers and flowers, and customs that vary by club.'),
    club: true,
    who: tr('Club tables in Kolkata, Mumbai and Darjeeling, loved for generations. Each club keeps its own customs.'),
    facts: [
      [tr('Hand'), tr('13 tiles; win with 14')],
      [tr('Tiles'), tr('152 with jokers, or 144 without')],
      [tr('Special tiles'), tr('Eight jokers and eight flowers')],
      [tr('Scoring'), tr('Faan; one faan to win by default')],
      [tr('Calls'), tr('Chow, Pung, Kong, Mahjong')],
    ],
    win: tr('Four sets and a pair. Jokers can fill a chow or a pung; the host decides whether they can make the pair.'),
    mei: 'In India, Mahjong has been loved for generations, from Kolkata to Mumbai to Darjeeling. Club tables often add jokers and flowers, and hands are scored in faan. Every club has its own customs, so this is a club profile, not one official set of rules. The host chooses the house rules for the table.',
  },
  {
    id: 'singapore',
    lesson: 'singapore',
    hook: tr('Four animals that bite and pay on the spot.'),
    club: true,
    who: tr('Family tables in Singapore and Malaysia, especially around Chinese New Year. Every table has its own little rules.'),
    facts: [
      [tr('Hand'), tr('13 tiles; win with 14')],
      [tr('Tiles'), tr('148, with flowers and four animals')],
      [tr('Special tiles'), tr('Cat, mouse, rooster and centipede')],
      [tr('Scoring'), tr('Tai, capped at five')],
      [tr('Calls'), tr('Chi, Pong, Kong, Hu, Zimo')],
    ],
    win: tr('Four sets and a pair worth at least one tai. On a discard win the shooter pays; animal bites and kongs pay on the spot.'),
    mei: 'Singapore and Malaysian tables have a special twist: animals! There’s a cat, a mouse, a rooster and a centipede. Catch the right pair and that’s a bite, which pays on the spot. Hands are scored in tai, and the shooter pays. Tables differ, so the host sets the house rules here.',
  },
  {
    id: 'hongkong',
    lesson: 'hongkong',
    hook: tr('Cantonese club play: flowers, faan and a three-faan minimum.'),
    club: false,
    who: tr('Homes and clubs in Hong Kong and Cantonese communities worldwide. Widely shared conventions, though clubs set their own details.'),
    facts: [
      [tr('Hand'), tr('13 tiles; win with 14')],
      [tr('Tiles'), tr('144, with eight flowers')],
      [tr('Special tiles'), tr('Flowers: your seat flower scores a faan')],
      [tr('Scoring'), tr('Faan on the half-spicy table, capped at ten')],
      [tr('Calls'), tr('Sheung, Pung, Gong, Sik Wu')],
    ],
    win: tr('Four sets and a pair worth at least three faan at our default table. Half gun: the discarder pays, the others pay half.'),
    mei: 'Hong Kong Mahjong is the lively Cantonese game played in homes and clubs across the city. It looks like Classic, but you need at least three faan to win, so you’ll chase a flush, a dragon pung or a clean concealed hand. Flowers count too. It’s quick, chatty and wonderfully social.',
  },
  {
    id: 'mcr',
    lesson: 'mcr',
    hook: tr('The tournament rules: a fixed fan list and eight fan to win.'),
    club: false,
    who: tr('Tournament players in China, Europe and at world championships. A formal ruleset with written rules.'),
    facts: [
      [tr('Hand'), tr('13 tiles; win with 14')],
      [tr('Tiles'), tr('144, with eight flowers')],
      [tr('Special tiles'), tr('Flowers, one fan each (not toward the minimum)')],
      [tr('Scoring'), tr('Fan from a fixed list, with exclusions')],
      [tr('Calls'), tr('Chi, Peng, Gang, Hu')],
    ],
    win: tr('Four sets and a pair (or seven pairs, thirteen orphans or a knitted hand) worth at least eight fan. Everyone pays an eight-point base; the discarder adds the hand’s fan.'),
    mei: 'Chinese Official Mahjong is the tournament game, with written rules used at championships around the world. Every hand is scored from a fixed list of patterns, and you need at least eight points to win, not counting flowers. Mixed triple chow, pure straight, half flush: you learn to build toward them. It rewards planning like nothing else.',
  },
  {
    id: 'sichuan',
    lesson: 'sichuan',
    hook: tr('Three suits, no chow calls, and one suit must go.'),
    club: false,
    who: tr('Teahouses and homes across Sichuan, and players of the hugely popular Blood Battle apps. A regional family with many local versions.'),
    facts: [
      [tr('Hand'), tr('13 tiles; win with 14')],
      [tr('Tiles'), tr('108: three suits only, no honours or flowers')],
      [tr('Special rule'), tr('Missing suit: your winning hand lacks one suit entirely')],
      [tr('Scoring'), tr('Fan that double, capped at four')],
      [tr('Calls'), tr('Peng, Gang, Hu. No chow calls; runs in your own hand still count')],
    ],
    win: tr('Four sets and a pair, or seven pairs, using two suits at most. Kongs pay on the spot. Simplified: the hand ends at the first win, where real Blood Battle plays on until three have won.'),
    mei: 'Sichuan Mahjong is fiery, like the food! There are only three suits, no winds or dragons, and you can’t call a chow, though runs you draw yourself still count. The big rule is the missing suit: before you can win, you have to clear one suit out of your hand completely. Kongs pay on the spot. In real Blood Battle play continues after a win, but at our table the hand ends with the first one.',
  },
  {
    id: 'malaysian',
    lesson: 'malaysian',
    hook: tr('Animals and flowers with a Malaysian twist.'),
    club: true,
    who: tr('Family tables in Kuala Lumpur, Penang and Johor Bahru, especially at Chinese New Year. Every table keeps its own customs.'),
    facts: [
      [tr('Hand'), tr('13 tiles; win with 14')],
      [tr('Tiles'), tr('148, with flowers and four animals')],
      [tr('Special tiles'), tr('Cat, mouse, rooster and centipede')],
      [tr('Scoring'), tr('Tai, capped at five (the host may raise it)')],
      [tr('Calls'), tr('Chi, Pong, Kong, Hu, Zimo')],
    ],
    win: tr('Four sets and a pair, or seven pairs, worth at least one tai. The discarder pays double and the others single; bites and kongs pay on the spot.'),
    mei: 'Malaysian Mahjong is a close cousin of the Singapore game, animals and all. Catch the cat and the mouse, or the rooster and the centipede, and you get paid on the spot. Our Malaysian table lets you win with seven pairs, and the discarder pays double while everyone else pays a little. Tables differ, so the host can change the rules.',
  },
  {
    id: 'korean3',
    lesson: 'korean3',
    hook: tr('Three players, a smaller set, and simple points.'),
    club: true,
    who: tr('Homes and clubs across South Korea, very often three-handed. A regional family with many local versions; ours uses JongClub’s table defaults.'),
    facts: [
      [tr('Hand'), tr('13 tiles; win with 14')],
      [tr('Tiles'), tr('116: Characters 2–8 removed, flowers kept')],
      [tr('Players'), tr('Three: East, South and West')],
      [tr('Scoring'), tr('Points that add up, two to win (flowers pay but don’t count)')],
      [tr('Calls'), tr('Pung, Kong, Riichi. No chow calls; runs in your own hand still count')],
    ],
    win: tr('Four sets and a pair, seven pairs or thirteen orphans, worth at least two points. Self-draw: both others pay. Discard: the discarder pays both shares.'),
    mei: 'Korean Mahjong is usually played by three friends, so the set is smaller: the Characters from two to eight are taken out. There’s no chow call, riichi is free and worth a point, and the points simply add up. You need two to win, and flowers pay but don’t count toward them. Korean tables vary, so these are our club’s defaults.',
  },
  {
    id: 'sanma',
    lesson: 'sanma',
    hook: tr('Riichi for three: no chi, and Norths become dora.'),
    club: false,
    who: tr('Japanese parlours and online rooms, where three-player Riichi is a favourite for its big, fast hands.'),
    facts: [
      [tr('Hand'), tr('13 tiles; win with 14')],
      [tr('Tiles'), tr('108: Characters 2–8 removed, two red fives')],
      [tr('Players'), tr('Three: East, South and West')],
      [tr('Special tiles'), tr('Kita: a North set aside is a bonus dora')],
      [tr('Calls'), tr('Pon, Kan, Kita, Ron, Tsumo, Riichi. No chi')],
    ],
    win: tr('As in Riichi: four sets and a pair (or seven pairs, or thirteen orphans) with at least one yaku. A self-draw is paid by the two others; the empty North seat’s share is lost unless the host splits it.'),
    mei: 'Sanma is Riichi for three players. The Characters from two to eight are taken out, there’s no chi, and any North you hold can be set aside as a bonus dora. With fewer tiles and extra dora, big hands come quickly. Everything else is the Riichi you know: yaku, dora and furiten.',
  },
  {
    id: 'malaysian3',
    lesson: 'malaysian3',
    hook: tr('The Malaysian game for three, with one suit out.'),
    club: true,
    who: tr('Family and friends’ tables across Malaysia, when three sit down without waiting for a fourth. Tables vary; ours uses JongClub’s defaults.'),
    facts: [
      [tr('Hand'), tr('13 tiles; win with 14')],
      [tr('Tiles'), tr('112: no Characters, with flowers and four animals')],
      [tr('Players'), tr('Three: East, South and West')],
      [tr('Scoring'), tr('Tai, capped at five')],
      [tr('Calls'), tr('Chi, Pong, Kong, Hu, Zimo')],
    ],
    win: tr('Four sets and a pair, or seven pairs, worth at least one tai. The discarder pays double and the other player single; bites and kongs pay on the spot.'),
    mei: 'Three-player Malaysian Mahjong takes the whole Characters suit out, so you play with Dots, Bamboo, winds and dragons, plus the flowers and the four animals. With only two suits, one-suit hands come often. Animals still bite, and the discarder pays double. Some tables keep the one and nine of Characters, so the host decides.',
  },
  {
    id: 'american',
    lesson: 'american',
    hook: tr('Play from the card, with jokers and the Charleston.'),
    club: false,
    who: tr('Players across the United States, from community centres to living rooms. Its own family, with its own rules.'),
    facts: [
      [tr('Hand'), tr('13 tiles; win with 14')],
      [tr('Tiles'), tr('152, with flowers and eight jokers')],
      [tr('Special tiles'), tr('Jokers (never in a pair) and flowers')],
      [tr('Scoring'), tr('Each hand on the card has its value')],
      [tr('Calls'), tr('Pung, Kong and more; no chow')],
    ],
    win: tr('Match one hand on the card exactly. Before play, everyone passes tiles in the Charleston.'),
    mei: 'American Mahjong is its own family, with its own rules. You play from a card of hands, and you have to match one exactly. There are jokers, there’s no chow at all, and before each hand everyone swaps tiles in the Charleston. Don’t mix it up with the Asian games. It really is a different conversation.',
  },
  ...VARIATION_SHEETS,
];

/** Every line Mei speaks on this screen, for recording her narration clips. */
export function versionLines(): string[] {
  return VERSIONS.map((v) => v.mei);
}

const info = (id: string): VariationInfo => VARIATIONS.find((v) => v.id === id) ?? VARIATIONS[0];
const LEVELS = { Beginner: 1, Intermediate: 2, Advanced: 3 } as const;

function remember(id: string) {
  try {
    localStorage.setItem(LAST_KEY, id);
  } catch {
    /* private mode */
  }
}

function lastPicked(): string | null {
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}

const levelPips = (level: VariationInfo['level']) =>
  h('span', { class: 'vt-level', title: tr(level) }, h('span', { class: 'vt-pips', 'aria-hidden': 'true' }, ...[1, 2, 3].map((n) => h('i', { class: n <= LEVELS[level] ? 'on' : '' }))), tr(level));

/** A tile that stands for each game on its card. */
const SIGNATURE: Record<string, [number, boolean?]> = {
  classic: [31], hongkong: [34], taiwanese: [38], mcr: [32], riichi: [4, true], sanma: [30], sichuan: [18], vietnamese: [JOKER_KIND],
  korean3: [9], korean: [9], american: [JOKER_KIND], singapore: [CAT], malaysian: [ROOSTER], malaysian3: [MOUSE], indian: [33], uae: [27],
};
export const signatureTile = (id: string) => {
  const own = (VARIATIONS.find((v) => v.id === id) as { signature?: [number, boolean?] } | undefined)?.signature;
  const [kind, red] = SIGNATURE[id] ?? own ?? [27 + ([...id].reduce((a, c) => a + c.charCodeAt(0), 0) % 7)];
  return tileImg(kind, 'vx-tile', true, !!red);
};

/** Games kept in the code but no longer shown. */
const RETIRED = new Set<string>([]);

type Difficulty = '' | VariationInfo['level'];
type RulesType = '' | Standardisation;
const vxFilters = { q: '', region: '', level: '' as Difficulty, std: '' as RulesType, playable: false };

/** The Mahjong family screen: every game by region, with search and filters. Each card opens its rules and its lessons. */
export function versionsScreen(ctx: AppCtx): HTMLElement {
  const done = (lesson: string) => ctx.profile.lessonsDone.includes(lesson);
  const last = lastPicked();
  /** Every game the club knows: the catalogue, plus any playable variation the catalogue does not list yet. */
  const games = [
    ...CATALOGUE.filter((e) => !RETIRED.has(e.id)),
    ...VARIATIONS.filter((v) => v.profile && !v.parent && !RETIRED.has(v.id) && !CATALOGUE.some((e) => e.variationId === v.id)).map(
      (v): CatalogueEntry => ({ id: v.id, name: v.name, region: 'chinese', flag: v.flag, standardisation: 'regional', status: 'playable', tier: 'distinctive', variationId: v.id, blurb: v.blurb }),
    ),
  ];
  const idOf = (e: CatalogueEntry) => e.variationId ?? e.id;
  const levelOf = (e: CatalogueEntry): VariationInfo['level'] | null => (e.variationId ? (VARIATIONS.find((v) => v.id === e.variationId)?.level ?? null) : null);
  const hookOf = (e: CatalogueEntry) => VERSIONS.find((v) => v.id === e.variationId)?.hook ?? tr(e.blurb);
  const placeOf = (e: CatalogueEntry) => {
    const v = e.variationId ? VARIATIONS.find((x) => x.id === e.variationId) : undefined;
    return v ? tr(v.region) : REGIONS.find((r) => r.id === e.region)!.name;
  };

  const card = (e: CatalogueEntry) => {
    const id = idOf(e);
    const level = levelOf(e);
    const lesson = lessonFor(id);
    const learned = done(lesson);
    const playable = e.status === 'playable';
    const link = (cls: string, label: string, run: () => void) => h('button', { type: 'button', class: `vx-link ${cls}`, onclick: (ev: Event) => (ev.stopPropagation(), run()) }, label, h('span', { 'aria-hidden': 'true', html: icon('arrowRight') }));
    const el = h(
      'article',
      { class: `vx-card ${id === last ? 'last' : ''}`, 'data-version': id },
      h('div', { class: 'vx-art', 'aria-hidden': 'true' }, signatureTile(id)),
      h(
        'div',
        { class: 'vx-body' },
        h('p', { class: 'vx-place' }, h('span', { class: 'vx-flag', 'aria-hidden': 'true' }, e.flag), placeOf(e), learned ? h('span', { class: 'vt-done', title: tr('Lesson passed') }, h('span', { html: icon('check') })) : null),
        h('h4', { class: 'vx-name' }, h('button', { type: 'button', class: 'vx-open', 'aria-haspopup': 'dialog', onclick: () => openVersion(ctx, id, el) }, tr(e.name))),
        level ? levelPips(level) : null,
        h('p', { class: 'vx-hook' }, hookOf(e)),
        h(
          'span',
          { class: 'vt-labels' },
          h('span', { class: `vt-std ${e.standardisation}`, title: STANDARDISATION[e.standardisation].detail }, STANDARDISATION[e.standardisation].label),
          playable ? h('span', { class: 'vt-avail playable' }, AVAILABILITY.playable) : null,
        ),
      ),
      h('div', { class: 'vx-links' }, link('rules', tr('Rules'), () => openVersion(ctx, id, el)), link('lessons', learned ? tr('Review lesson') : tr('Lessons'), () => ctx.openLesson(lesson))),
    );
    el.onclick = () => openVersion(ctx, id, el);
    return el;
  };

  // ---- the newcomers' path
  const step = (n: number, label: string, id: string, run: () => void) =>
    h('li', { class: done(id) ? 'done' : '' }, h('button', { type: 'button', class: 'vx-step', onclick: run }, h('span', { class: 'vx-step-n' }, done(id) ? h('span', { html: icon('check') }) : String(n)), label));
  const path = h(
    'nav',
    { class: 'vx-path', 'aria-label': tr('A good path for newcomers') },
    h('p', { class: 'eyebrow' }, tr('A good path for newcomers')),
    h(
      'ol',
      {},
      step(1, tr('Learn the basics'), 'basics', () => ctx.openLesson('basics')),
      step(2, tr('Play a hand with Mei'), 'guided', () => ctx.startGuided('classic')),
      step(3, tr('Winds and rounds'), 'rounds', () => ctx.openLesson('rounds')),
    ),
  );

  // ---- filters
  const results = h('div', { class: 'vx-results' });
  const search = h('input', { type: 'search', class: 'vx-search-in', placeholder: tr('Search games…'), 'aria-label': tr('Search games'), value: vxFilters.q, autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
  search.oninput = () => ((vxFilters.q = search.value), draw());
  const regionSel = h('select', { 'aria-label': tr('Region') }, h('option', { value: '' }, tr('All regions')), ...REGIONS.map((r) => h('option', { value: r.id, selected: vxFilters.region === r.id }, r.name))) as HTMLSelectElement;
  regionSel.onchange = () => ((vxFilters.region = regionSel.value), draw());
  const chips = <T extends string>(label: string, options: [T, string][], get: () => T, set: (v: T) => void) => {
    const group = h('div', { class: 'vx-chips', role: 'radiogroup', 'aria-label': label });
    const paint = () => group.querySelectorAll<HTMLButtonElement>('button').forEach((b) => (b.classList.toggle('on', b.dataset.v === get()), b.setAttribute('aria-checked', String(b.dataset.v === get()))));
    for (const [v, l] of options) group.append(h('button', { type: 'button', role: 'radio', 'data-v': v, onclick: () => (set(v), paint(), draw()) }, l));
    paint();
    return h('div', { class: 'vx-filter' }, h('span', { class: 'vx-k' }, label), group);
  };
  const toggle = h('input', { type: 'checkbox', class: 'vx-switch', checked: vxFilters.playable, 'aria-label': tr('Only show playable') }) as HTMLInputElement;
  toggle.onchange = () => ((vxFilters.playable = toggle.checked), draw());
  const filters = h(
    'div',
    { class: 'vx-filters' },
    h('label', { class: 'vx-search' }, h('span', { html: icon('search') }), search),
    h('div', { class: 'vx-filter' }, h('span', { class: 'vx-k' }, tr('Region')), regionSel),
    chips<Difficulty>(tr('Difficulty'), [['', tr('All')], ['Beginner', tr('Beginner')], ['Intermediate', tr('Intermediate')], ['Advanced', tr('Advanced')]], () => vxFilters.level, (v) => (vxFilters.level = v)),
    chips<RulesType>(tr('Rules type'), [['', tr('All')], ['regional', tr('Regional')], ['formal', tr('Formal')], ['house', tr('House rules')]], () => vxFilters.std, (v) => (vxFilters.std = v)),
    h('label', { class: 'vx-filter vx-toggle' }, h('span', { class: 'vx-k' }, tr('Playable now')), h('span', { class: 'vx-toggle-row' }, toggle, h('span', {}, tr('Only show playable')))),
  );

  const matches = (e: CatalogueEntry) => {
    if (vxFilters.region && e.region !== vxFilters.region) return false;
    if (vxFilters.level && levelOf(e) !== vxFilters.level) return false;
    if (vxFilters.std && e.standardisation !== vxFilters.std) return false;
    if (vxFilters.playable && e.status !== 'playable') return false;
    const q = vxFilters.q.trim().toLowerCase();
    if (!q) return true;
    const hay = [e.name, tr(e.name), placeOf(e), REGIONS.find((r) => r.id === e.region)!.name, hookOf(e)].join(' ').toLowerCase();
    return q.split(/\s+/).every((w) => hay.includes(w));
  };

  const draw = () => {
    clear(results);
    let shown = 0;
    for (const r of REGIONS) {
      const entries = games.filter((e) => e.region === r.id && matches(e));
      if (!entries.length) continue;
      shown += entries.length;
      // Playable first, then the rest.
      entries.sort((a, b) => (a.status === b.status ? 0 : a.status === 'playable' ? -1 : 1));
      results.append(
        h(
          'section',
          { class: 'vx-region', 'aria-labelledby': `vx-r-${r.id}` },
          h('div', { class: 'vx-region-head' }, h('h3', { id: `vx-r-${r.id}` }, r.name), h('span', { class: 'vx-count' }, trn(entries.length, '{n} game', '{n} games')), h('span', { class: 'vx-rule', 'aria-hidden': 'true' })),
          r.id === 'western' ? h('p', { class: 'vx-region-note' }, tr('Its card, jokers and Charleston never mix with the Asian tables.')) : null,
          h('div', { class: 'vx-grid' }, ...entries.map(card)),
        ),
      );
    }
    if (!shown) results.append(h('p', { class: 'vx-empty' }, tr('No games match these filters.'), ' ', h('button', { type: 'button', class: 'link', onclick: clearAll }, tr('Clear filters'))));
  };
  const clearAll = () => {
    Object.assign(vxFilters, { q: '', region: '', level: '', std: '', playable: false });
    ctx.go('versions');
  };
  draw();

  const rounds = h(
    'section',
    { class: 'vt-rounds' },
    h('div', {}, h('p', { class: 'eyebrow' }, tr('Shared by the Asian family')), h('p', { class: 'vt-rounds-t' }, tr('Winds, seats and rounds work the same way at every Asian table. Learn them once.'))),
    h('button', { class: 'btn sm', onclick: () => ctx.openLesson('rounds') }, done('rounds') ? tr('✓ Winds and rounds · Review') : tr('Winds and rounds lesson')),
  );

  return h(
    'div',
    { class: 'page versions vx' },
    h(
      'header',
      { class: 'vx-hero' },
      h('div', { class: 'vx-hero-text' }, h('p', { class: 'eyebrow' }, tr('The Mahjong family')), h('h2', {}, tr('Choose your game')), h('p', { class: 'lede' }, tr('Explore regional traditions, tournament rules and friendly house variants.'))),
      h('button', { class: 'btn primary vx-start', onclick: (e: Event) => openVersion(ctx, 'india', e.currentTarget as HTMLElement) }, tr('Start with India Rules'), h('span', { html: icon('arrowRight') })),
    ),
    path,
    filters,
    results,
    rounds,
  );
}

/** The Academy lesson for a variation (a UAE ruleset has its own). */
export const lessonFor = (variation: string) => (VERSIONS.some((v) => v.id === variation) ? VERSIONS.find((v) => v.id === variation)!.lesson : variation);

/** A variation's rules: its panel from the Variations screen (a UAE ruleset opens the UAE profile). */
export function openVariationRules(ctx: AppCtx, variation: string, from: HTMLElement | null = null) {
  const id = VERSIONS.some((v) => v.id === variation) ? variation : (info(variation).parent ?? variation);
  openVersion(ctx, id, from ?? (document.activeElement as HTMLElement | null));
}

/** A game without a written panel yet (a ruleset that has just joined the club): its panel from the catalogue. */
function fallbackVersion(id: string): Version | undefined {
  const e = CATALOGUE.find((x) => x.variationId === id || x.id === id);
  const vi = VARIATIONS.find((x) => x.id === id);
  if (!e && !vi) return undefined;
  const blurb = tr(vi?.blurb ?? e!.blurb);
  return { id, lesson: lessonFor(id), hook: blurb, club: e?.standardisation === 'house', who: REGIONS.find((r) => r.id === (e?.region ?? 'chinese'))!.note, facts: [], win: vi?.profile ? tr(vi.profile.summary) : blurb, mei: '' };
}

/** Open a version's detail panel. Mei introduces it as it opens. */
function openVersion(ctx: AppCtx, id: string, from: HTMLElement | null) {
  const v = VERSIONS.find((x) => x.id === id) ?? fallbackVersion(id);
  if (!v) return;
  remember(id);
  for (const n of document.querySelectorAll<HTMLElement>('.vt-node')) n.classList.toggle('last', n.dataset.version === id);
  sound.play('button');
  const entry = CATALOGUE.find((e) => e.variationId === id || e.id === id);
  const known = VARIATIONS.find((x) => x.id === id);
  // A game the catalogue lists before it has a table: its name, flag and region from the catalogue.
  const vi: VariationInfo = known ?? { id, name: entry!.name, short: entry!.name, region: REGIONS.find((r) => r.id === entry!.region)!.name, flag: entry!.flag, blurb: entry!.blurb, level: 'Intermediate' };
  const playable = !!known?.profile;
  const o = ctx.modal;
  clear(o).hidden = false;
  const done = (lesson: string) => ctx.profile.lessonsDone.includes(lesson);
  const learned = !v.sharedLesson && done(v.lesson);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    narrator.stop();
    o.hidden = true;
    clear(o);
    o.removeEventListener('click', onBackdrop);
    o.removeEventListener('keydown', onKey);
    from?.focus();
  };
  const leave = (then: () => void) => () => {
    close();
    then();
  };
  const onBackdrop = (e: Event) => e.target === o && close();
  const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (e.stopPropagation(), close());
  o.addEventListener('click', onBackdrop);
  o.addEventListener('keydown', onKey);

  const caption = h('p', { class: 'vp-say', lang: 'en' }, v.mei);
  const mei = h('div', { class: 'vp-mei' }, h('div', { class: 'vp-avatar', 'aria-hidden': 'true' }, 'M'));
  const speak = () => {
    if (!narrator.enabled) return;
    mei.classList.add('speaking');
    void narrator.say(v.mei).then(() => !closed && mei.classList.remove('speaking'));
  };
  const replay = h('button', { class: 'btn sm ghost', 'aria-label': tr('Hear Mei again'), disabled: !narrator.enabled, onclick: () => speak() }, tr('↻ Replay'));
  const voice = h('button', { class: 'btn sm ghost', 'aria-pressed': String(narrator.enabled), title: tr('Turns Mei’s spoken voice on or off. The choice is remembered on this device.') }, narrator.enabled ? tr('🔊 Voice on') : tr('🔇 Voice off'));
  voice.onclick = () => {
    narrator.setEnabled(!narrator.enabled);
    voice.textContent = narrator.enabled ? tr('🔊 Voice on') : tr('🔇 Voice off');
    voice.setAttribute('aria-pressed', String(narrator.enabled));
    (replay as HTMLButtonElement).disabled = !narrator.enabled;
    if (narrator.enabled) speak();
    else mei.classList.remove('speaking');
  };
  mei.append(h('div', { class: 'vp-mei-body' }, h('p', { class: 'eyebrow' }, tr('Mei introduces')), caption, h('div', { class: 'vp-voice' }, replay, voice)));

  const i = VERSIONS.indexOf(v);
  const prev = VERSIONS[(i + VERSIONS.length - 1) % VERSIONS.length];
  const next = VERSIONS[(i + 1) % VERSIONS.length];
  const hop = (to: Version) => () => {
    closed = true;
    o.removeEventListener('click', onBackdrop);
    o.removeEventListener('keydown', onKey);
    openVersion(ctx, to.id, document.querySelector<HTMLElement>(`.vt-node[data-version="${to.id}"]`) ?? from);
  };

  const action = (cls: string, title: string, note: string, run: () => void) => h('button', { class: `vp-action ${cls}`, onclick: leave(run) }, h('span', { class: 'vp-action-t' }, title), h('span', { class: 'vp-action-d' }, note));

  const card = h(
    'div',
    { class: 'card vp-sheet', role: 'document', 'aria-labelledby': 'vp-title' },
    h(
      'header',
      { class: 'vp-head' },
      h('span', { class: 'vp-flag', 'aria-hidden': 'true' }, vi.flag),
      h('div', { class: 'vp-title' }, h('p', { class: 'eyebrow' }, `${tr(vi.region)} · ${entry ? STANDARDISATION[entry.standardisation].label : v.id === 'american' ? tr('Western family') : tr('Asian family')}`), h('h3', { id: 'vp-title' }, vi.name), known ? levelPips(vi.level) : null),
      h('button', { class: 'icon-btn vp-close', 'aria-label': tr('Close'), onclick: close, html: icon('close') }),
    ),
    v.mei ? mei : null,
    v.club ? h('p', { class: 'vp-club' }, h('strong', {}, tr('Club play. ')), tr('There is no single official ruleset: rules vary from club to club, and at JongClub the table host sets the house rules.')) : null,
    id === UAE_PROFILE.id
      ? h(
          'div',
          { class: 'vp-rulesets', role: 'group', 'aria-label': tr('UAE rulesets') },
          h('p', { class: 'eyebrow' }, tr('Choose a UAE ruleset')),
          ...UAE_PROFILE.rulesets.map((r) =>
            h(
              'button',
              { class: 'vp-ruleset', onclick: leave(() => ctx.startMatch(ctx.tableFor(r.variationId))) },
              h('span', { class: 'vp-ruleset-t' }, r.name),
              h('span', { class: 'vp-ruleset-d' }, `${r.engine}. ${r.detail}`),
              h('span', { class: 'vp-ruleset-go', 'aria-hidden': 'true' }, tr('Play ›')),
            ),
          ),
        )
      : null,
    h(
      'dl',
      { class: 'vp-facts' },
      h('div', { class: 'wide' }, h('dt', {}, tr('Who plays it')), h('dd', {}, v.who)),
      // An odd fact out takes the full row, so the grid never shows an empty cell.
      ...v.facts.map(([k, d], i) => h('div', { class: v.facts.length % 2 && i === v.facts.length - 1 ? 'wide' : '' }, h('dt', {}, k), h('dd', {}, d))),
      h('div', { class: 'wide' }, h('dt', {}, tr('How to win')), h('dd', {}, v.win)),
    ),
    h(
      'div',
      { class: 'vp-actions' },
      v.sharedLesson
        ? action('learn', v.lesson === 'basics' ? tr('Learn the basics') : tr('Learn {name}', { name: info(v.lesson).short }), v.lesson === 'basics' ? tr('No lesson of its own yet. The beginners’ lesson covers most of it') : tr('No lesson of its own yet. The {name} lesson covers most of it', { name: info(v.lesson).short }), () => ctx.openLesson(v.lesson))
        : action('learn', learned ? tr('✓ Review the lesson') : tr('Learn it'), learned ? tr('Lesson and test passed') : tr('A short story lesson with Mei, then a quick test'), () => ctx.openLesson(v.lesson)),
      playable && action('guided', tr('Play with Mei'), tr('One gentle hand. Mei talks you through every move'), () => ctx.startGuided(v.id)),
      playable && action('play primary', tr('Play'), tr('Sit down at the {table} with three AI players', { table: ctx.tableFor(v.id).name }), () => ctx.startMatch(ctx.tableFor(v.id))),
    ),
    h(
      'footer',
      { class: 'vp-foot' },
      h('button', { class: 'link', onclick: hop(prev) }, `‹ ${info(prev.id).short}`),
      v.id !== 'american' ? h('button', { class: 'link', onclick: leave(() => ctx.openLesson('rounds')) }, done('rounds') ? tr('Winds and rounds ✓') : tr('Winds and rounds lesson')) : h('span', {}),
      h('button', { class: 'link', onclick: hop(next) }, `${info(next.id).short} ›`),
    ),
  );
  o.append(card);
  (card.querySelector('.vp-close') as HTMLElement).focus();
  if (v.mei) speak();
}
