// The game catalogue: every way of playing Mahjong the club knows about,
// what kind of thing each one is, and whether you can play it yet.
//
// Three kinds of choice, never mixed up:
//   - Rule sets (Riichi, Hong Kong, MCR...): grouped by region, each labelled
//     with how standardised it really is. UAE / Dubai Rules is a regional
//     profile holding several rulesets.
//   - Formats: how long a match runs (East only, East-South, full E-S-W-N,
//     timed, sudden death) and how many play. Any format goes with any rule set.
//   - Modes: Goulash is a first-class mode layered on a rule set.
// House rules sit underneath, grouped by what they change.

import type { GameLength } from '../engine/rounds';
import { tr } from '../i18n';

export type Standardisation = 'formal' | 'regional' | 'house';
export type Availability = 'playable' | 'coming';
export type Tier = 'core' | 'distinctive' | 'expansion';
export type RegionId = 'chinese' | 'japanese' | 'korean' | 'western' | 'seasia' | 'southasia' | 'middleeast';

export const STANDARDISATION: Record<Standardisation, { label: string; detail: string }> = {
  formal: { label: tr('Formal ruleset'), detail: tr('Written rules kept by a governing body or tournament organisation.') },
  regional: { label: tr('Regional family'), detail: tr('A shared regional style with many local versions. Our table is one of them.') },
  house: { label: tr('House-rule tradition'), detail: tr('Played by clubs and families with their own customs. The host sets the rules.') },
};

export const AVAILABILITY: Record<Availability, string> = { playable: tr('Playable'), coming: tr('Coming') };

export const TIERS: Record<Tier, { label: string; detail: string }> = {
  core: { label: tr('Core'), detail: tr('The great rule sets, ready to play') },
  distinctive: { label: tr('Distinctive'), detail: tr('Regional favourites with a twist of their own') },
  expansion: { label: tr('Expansion'), detail: tr('On the way to the club') },
};

export const REGIONS: { id: RegionId; name: string; note: string }[] = [
  { id: 'chinese', name: tr('Chinese & East Asian'), note: tr('The roots of the game and its many regional branches.') },
  { id: 'japanese', name: tr('Japanese'), note: tr('Riichi and its relatives: yaku, dora and tight defence.') },
  { id: 'korean', name: tr('Korean'), note: tr('Brisk games, often for three players.') },
  { id: 'western', name: tr('Western'), note: tr('American card play and the European traditions. A separate family.') },
  { id: 'seasia', name: tr('Southeast Asia'), note: tr('Animals, flowers and lively house rules.') },
  { id: 'southasia', name: tr('South Asia'), note: tr('Club tables with jokers and long-kept customs.') },
  { id: 'middleeast', name: tr('Middle East'), note: tr('A regional profile of the rules played in the Emirates.') },
];

export interface CatalogueEntry {
  id: string;
  name: string;
  region: RegionId;
  flag: string;
  standardisation: Standardisation;
  status: Availability;
  tier: Tier;
  /** The engine variation (src/engine/rules) when playable. */
  variationId?: string;
  blurb: string;
}

const E = (id: string, name: string, region: RegionId, flag: string, standardisation: Standardisation, tier: Tier, blurb: string, variationId?: string): CatalogueEntry => ({
  id,
  name,
  region,
  flag,
  standardisation,
  status: variationId ? 'playable' : 'coming',
  tier,
  variationId,
  blurb,
});

export const CATALOGUE: CatalogueEntry[] = [
  // Chinese & East Asian
  E('classic', 'Chinese Classical', 'chinese', '🇨🇳', 'regional', 'core', 'Four sets and a pair with chow, pung and kong, scored in faan. Our friendliest table and the root of the Asian family. Flowers and seasons are in play (your own flower and season score a faan each), mixed sets and knits are allowed, and special wind rounds (passports, goulash, small and big cards) are a house rule.', 'classic'),
  E('hongkong', 'Hong Kong', 'chinese', '🇭🇰', 'regional', 'core', 'Cantonese club play with flowers and faan, three faan to win at our default table. Widely shared, but clubs set their own minimum and payments.', 'hongkong'),
  E('taiwanese', 'Taiwanese', 'chinese', '🇹🇼', 'regional', 'core', 'Sixteen-tile hands, five sets and a pair, flowers and tai. Only the discarder pays.', 'taiwanese'),
  E('mcr', 'Chinese Official (MCR)', 'chinese', '🇨🇳', 'formal', 'core', 'The tournament ruleset: a fixed list of fan and eight fan to win, knitted hands included (Knitted Straight, Lesser and Greater Honours and Knitted Tiles).', 'mcr'),
  E('sichuan', 'Sichuan · Blood Battle', 'chinese', '🇨🇳', 'regional', 'distinctive', 'Three suits only, no chow calls (runs in your own hand still count), and your hand must miss a suit. Simplified: the hand ends at the first win, where true Blood Battle plays on.', 'sichuan'),
  E('vietnamese', 'Vietnamese', 'chinese', '🇻🇳', 'regional', 'distinctive', 'Khung jokers, flowers and phán. Tables differ, so ours is one friendly club’s version.', 'vietnamese'),
  E('wuhan', 'Wuhan', 'chinese', '🇨🇳', 'regional', 'expansion', 'Wuhan’s red dragon laizi game: a tile turned up each hand makes the next one wild, Red Dragons are kongs that double your win, and the pair must be twos, fives or eights.', 'wuhan'),
  E('guangdong', 'Guangdong', 'chinese', '🇨🇳', 'regional', 'expansion', 'Push-down play from Guangzhou and the Pearl River Delta: no chow claims, any complete hand wins, and a self-draw is paid double by everyone.', 'guangdong'),
  E('shanghai', 'Shanghai', 'chinese', '🇨🇳', 'regional', 'expansion', 'Shanghai’s baida game: a tile turned up each hand makes its other copies wild, and flowers and honour pungs build the score that doubles multiply.', 'shanghai'),
  E('beijing', 'Beijing', 'chinese', '🇨🇳', 'regional', 'expansion', 'Beijing’s hun’er game: a tile turned up each hand makes the next one wild, and the discarder pays for the whole table.', 'beijing'),
  E('fujian', 'Fujian', 'chinese', '🇨🇳', 'regional', 'expansion', 'Fuzhou’s sixteen-tile game with a golden wild tile: five sets and a pair, flowers, and three golds win at once.', 'fujian'),
  E('northeast', 'Northeast China', 'chinese', '🇨🇳', 'regional', 'expansion', 'Dongbei play: quick hands that must pass a checklist (all three suits, a one or nine, a pung, a chow, and an open hand).', 'northeast'),
  // Japanese
  E('riichi', 'Riichi', 'japanese', '🇯🇵', 'formal', 'core', 'Every win needs a yaku. Riichi, dora, red fives and furiten, close to common club and league rules. Abortive draws, nagashi mangan and triple ron vary by club, so they are house rules (on, with triple ron abortive, by default).', 'riichi'),
  E('sanma', 'Sanma (three-player Riichi)', 'japanese', '🇯🇵', 'formal', 'distinctive', 'Riichi for three: Characters 2–8 removed (108 tiles), no chi, and Norths set aside as bonus dora (kita). Self-draws pay with tsumo loss by default; the point split is a house rule, as are red fives and the draw rules.', 'sanma'),
  E('riichi-tournament', 'Riichi tournament rules', 'japanese', '🇯🇵', 'formal', 'expansion', 'League and tournament Riichi: no red fives or abortive draws, 30,000 points each, and uma paid by place at the end.', 'riichi-tournament'),
  // Korean
  E('korean', 'Korean', 'korean', '🇰🇷', 'regional', 'expansion', 'The four-player Korean game: the whole set with flowers, no chow claims and simple points, two to win.', 'korean'),
  E('korean3', 'Korean three-player', 'korean', '🇰🇷', 'regional', 'distinctive', 'The popular three-player Korean table: Characters 2–8 out, flowers in, no chow claims and simple points with a two-point minimum. Korean tables vary; these are JongClub’s table defaults.', 'korean3'),
  // Western
  E('american', 'American (NMJL-style)', 'western', '🇺🇸', 'formal', 'core', 'Card play with jokers and the Charleston, in the style of the National Mah Jongg League. We use JongClub’s own card, not the NMJL card.', 'american'),
  E('wright-patterson', 'Wright-Patterson', 'western', '🇺🇸', 'house', 'expansion', 'The written club rules of a US air base, carried to bases worldwide: Chinese-style hands, a Charleston, points and doubles, and named special hands like Wriggling Snake.', 'wright-patterson'),
  E('european', 'European Classical', 'western', '🇬🇧', 'regional', 'expansion', 'The older British and European game: points for every set, then doubles that multiply the total, and East pays and receives double.', 'european'),
  E('ema', 'EMA tournament rules', 'western', '🇪🇺', 'formal', 'expansion', 'European Mahjong Association MCR: the Chinese Official fan list without flowers and sixteen hands. EMA Riichi is our Riichi tournament table.', 'ema'),
  E('zung-jung', 'Zung Jung', 'chinese', '🇭🇰', 'formal', 'expansion', 'Alan Kwan’s modern scoring system: a short pattern list whose points add up to a 320 cap, and a Chicken Hand still wins.', 'zung-jung'),
  // Southeast Asia
  E('singapore', 'Singaporean', 'seasia', '🇸🇬', 'regional', 'core', 'Four animals that bite and pay on the spot, tai capped at five. Every table has its own little rules.', 'singapore'),
  E('malaysian', 'Malaysian', 'seasia', '🇲🇾', 'regional', 'distinctive', 'Animals, flowers and tai, with our Malaysian defaults: discarder pays double, seven pairs allowed.', 'malaysian'),
  E('malaysian3', 'Malaysian three-player', 'seasia', '🇲🇾', 'regional', 'distinctive', 'The Malaysian game for three, with the Characters suit taken out (112 tiles with flowers and animals). Some tables keep the 1 and 9 of Characters: a house rule. Our Malaysian defaults otherwise.', 'malaysian3'),
  E('thai', 'Thai', 'seasia', '🇹🇭', 'house', 'expansion', 'Thai home and club play: Hong Kong-style faan with flowers, one faan to win, and the discarder pays for the whole table.', 'thai'),
  E('filipino', 'Filipino', 'seasia', '🇵🇭', 'regional', 'expansion', 'Sixteen-tile Pinoy play with flowers: points add up for a self-draw, your own flowers, no flowers at all, Escalera and Siete Pares.', 'filipino'),
  E('indonesian', 'Indonesian', 'seasia', '🇮🇩', 'house', 'expansion', 'Indonesian family tables: Hong Kong-style faan with flowers, any complete hand wins, and half gun on a discard.', 'indonesian'),
  // South Asia
  E('india', 'India Rules', 'southasia', '🇮🇳', 'house', 'core', 'The Indian club game from the club rulebook: 35,000 points each, East pays and receives double, and the East round is played with passports, flowers and seasons.', 'india'),
  E('indian', 'Kolkata Joker Club', 'southasia', '🇮🇳', 'house', 'distinctive', 'Kolkata, Mumbai and Darjeeling clubs: jokers, flowers and faan. Each club keeps its own customs.', 'indian'),
  // Middle East
  E('uae', 'UAE / Dubai Rules', 'middleeast', '🇦🇪', 'house', 'distinctive', 'A regional profile, not one official ruleset: choose Dubai Asian (Goulash & Hands), Dubai Taiwanese, Dubai American or a custom UAE table.', 'uae'),
];

/** UAE / Dubai Rules: a regional profile whose rulesets map to engines plus house-rule presets. */
export interface UaeRuleset {
  /** Engine variation id. */
  variationId: string;
  name: string;
  engine: string;
  detail: string;
}

export const UAE_PROFILE = {
  id: 'uae',
  name: 'UAE / Dubai Rules',
  note: tr('There is no single official UAE ruleset. Tables across the Emirates play several styles; pick the one your table uses.'),
  rulesets: [
    { variationId: 'uae', name: 'Dubai Asian · Goulash & Hands', engine: tr('Hong Kong-style, 13 tiles'), detail: tr('Flexible house rules and a goulash after every wall game: East stays, tiles are exchanged, stakes rise.') },
    { variationId: 'uae-taiwanese', name: 'Dubai Taiwanese', engine: tr('Taiwanese, 16 tiles'), detail: tr('The Taiwanese game with a one-tai minimum and an optional goulash.') },
    { variationId: 'uae-american', name: 'Dubai American', engine: tr('American card (our own card)'), detail: tr('Card play with the Charleston, and a goulash after a wall game where jokers may pass.') },
    { variationId: 'uae-custom', name: 'Custom UAE table', engine: tr('Hong Kong-style, 13 tiles'), detail: tr('Every UAE house rule open, Goulash off until you turn it on.') },
  ] as UaeRuleset[],
};

export const isUaeRuleset = (variationId: string) => UAE_PROFILE.rulesets.some((r) => r.variationId === variationId);

// ------------------------------------------------------------------ formats

export type FormatKind = 'length' | 'players' | 'scoring';

export interface FormatEntry {
  id: string;
  name: string;
  kind: FormatKind;
  status: Availability;
  detail: string;
  /** The match length setting when this is a length. */
  length?: GameLength;
}

export const FORMATS: FormatEntry[] = [
  { id: 'eastRound', name: tr('East only'), kind: 'length', status: 'playable', length: 'eastRound', detail: tr('One wind: four or more hands') },
  { id: 'eastSouth', name: tr('East–South'), kind: 'length', status: 'playable', length: 'eastSouth', detail: tr('Two winds, the usual Riichi match') },
  { id: 'fullNews', name: tr('Full E–S–W–N'), kind: 'length', status: 'playable', length: 'fullNews', detail: tr('All four winds, sixteen or more hands') },
  { id: 'oneHand', name: tr('Single hand'), kind: 'length', status: 'playable', length: 'oneHand', detail: tr('One hand, about four minutes') },
  { id: 'timed', name: tr('Timed match'), kind: 'length', status: 'playable', length: 'timed', detail: tr('Play until the clock runs out, then finish the round') },
  { id: 'suddenDeath', name: tr('Sudden death'), kind: 'length', status: 'playable', length: 'suddenDeath', detail: tr('The first hand anyone wins ends the match') },
  { id: 'dealerStreak', name: tr('Dealer streak'), kind: 'scoring', status: 'playable', detail: tr('Set under house rules: when the dealer keeps the deal') },
  { id: 'fourPlayer', name: tr('Four players'), kind: 'players', status: 'playable', detail: tr('Every table except Korean') },
  { id: 'threePlayer', name: tr('Three players'), kind: 'players', status: 'playable', detail: tr('Korean, Sanma and Malaysian three-player') },
  { id: 'tournamentScoring', name: tr('Tournament scoring'), kind: 'scoring', status: 'playable', detail: tr('Placement points (uma): +15, +5, −5, −15 by place plus the score difference in thousands, added up across rounds. A table option, and a choice for club tournaments') },
];

// ------------------------------------------------------------------ modes

export interface ModeEntry {
  id: 'standard' | 'goulash';
  name: string;
  detail: string;
}

export const MODES: ModeEntry[] = [
  { id: 'standard', name: tr('Standard'), detail: tr('A wall game simply passes the deal (or keeps it, as the house rules say).') },
  { id: 'goulash', name: tr('Goulash'), detail: tr('After a wall game, East stays and a goulash is played: tiles are exchanged (jokers pass at American tables), stakes may rise and a pot may build.') },
];

// ------------------------------------------------------------------ house rules

export type HouseRuleGroup = 'goulash' | 'winning' | 'scoring' | 'dealer' | 'tiles' | 'hands' | 'match' | 'competitive';

export const HOUSE_RULE_GROUPS: { id: HouseRuleGroup; name: string; items: { name: string; status: Availability; where?: string }[] }[] = [
  {
    id: 'goulash',
    name: tr('Goulash'),
    items: [
      { name: tr('Drawn-hand replay (East stays)'), status: 'playable', where: tr('Goulash mode') },
      { name: tr('Tile exchange'), status: 'playable', where: tr('Goulash mode') },
      { name: tr('Goulash with jokers'), status: 'playable', where: tr('Goulash mode') },
      { name: tr('Cumulative pot'), status: 'playable', where: tr('Goulash mode') },
    ],
  },
  {
    id: 'winning',
    name: tr('Winning'),
    items: [
      { name: tr('Minimum points'), status: 'playable' },
      { name: tr('Discard wins'), status: 'playable' },
      { name: tr('Last tile'), status: 'playable' },
      { name: tr('Abortive draws'), status: 'playable', where: tr('Riichi, Sanma') },
      { name: tr('Self-draw only'), status: 'coming' },
      { name: tr('Multiple winners'), status: 'coming' },
    ],
  },
  {
    id: 'scoring',
    name: tr('Scoring'),
    items: [
      { name: tr('Faan, fan and tai'), status: 'playable', where: tr('By rule set') },
      { name: tr('Doubles and multipliers'), status: 'playable', where: tr('By rule set') },
      { name: tr('Fixed points (MCR)'), status: 'playable' },
      { name: tr('Who pays on a discard'), status: 'playable' },
      { name: tr('Nagashi mangan'), status: 'playable', where: tr('Riichi, Sanma') },
      { name: tr('Placement points (uma)'), status: 'playable', where: tr('Table option, tournaments') },
      { name: tr('Winner takes all'), status: 'coming' },
    ],
  },
  { id: 'dealer', name: tr('Dealer'), items: [{ name: tr('Dealer keeps the deal'), status: 'playable' }, { name: tr('Dealer streak bonus'), status: 'playable', where: tr('Riichi, Taiwanese') }] },
  {
    id: 'tiles',
    name: tr('Tiles'),
    items: [
      { name: tr('Flowers and seasons'), status: 'playable' },
      { name: tr('Animals'), status: 'playable', where: tr('Singaporean, Malaysian') },
      { name: tr('Jokers'), status: 'playable', where: tr('American, Indian, Goulash') },
      { name: tr('Wild tiles'), status: 'playable', where: tr('Vietnamese') },
      { name: tr('Red fives'), status: 'playable', where: tr('Riichi') },
    ],
  },
  {
    id: 'hands',
    name: tr('Hand types'),
    items: [
      { name: tr('All Pungs, Pure Suit, All Honours'), status: 'playable' },
      { name: tr('Seven Pairs'), status: 'playable' },
      { name: tr('Mixed sets and knits'), status: 'playable', where: tr('Classic') },
      { name: tr('Chows allowed'), status: 'playable' },
      { name: tr('Regional special hands'), status: 'playable', where: tr('By rule set') },
    ],
  },
  { id: 'match', name: tr('Match structure'), items: [{ name: tr('East only, East–South, E–S–W–N'), status: 'playable' }, { name: tr('Timed match and sudden death'), status: 'playable' }, { name: tr('Special wind rounds'), status: 'playable', where: tr('Classic, Dubai Asian') }] },
  {
    id: 'competitive',
    name: tr('Competitive'),
    items: [
      { name: tr('Ranked'), status: 'playable' },
      { name: tr('Tournaments'), status: 'playable' },
      { name: tr('Private tables'), status: 'playable', where: tr('Live on claude.ai') },
      { name: tr('Cumulative leaderboard'), status: 'coming' },
      { name: tr('Team play'), status: 'coming' },
    ],
  },
];

/** Which group a profile's house rule belongs to, for the lobby's House rules panel. */
export function houseRuleGroup(id: string): HouseRuleGroup {
  if (id.startsWith('goulash')) return 'goulash';
  if (id === 'minValue' || id === 'minFan' || id === 'abortive' || id === 'tripleRon') return 'winning';
  if (id === 'dealerRetention') return 'dealer';
  if (['flowers', 'jokers', 'jokerPair', 'jokerCalls', 'bites', 'redFives', 'animals', 'characters'].includes(id)) return 'tiles';
  if (['sevenPairs', 'chow', 'openTanyao', 'mixedSets', 'mixedHands'].includes(id)) return 'hands';
  if (id === 'specialRounds' || id === 'passportNine') return 'match';
  return 'scoring';
}

// ------------------------------------------------------------------ lookups

export const entryFor = (variationId: string) => CATALOGUE.find((e) => e.variationId === variationId) ?? (isUaeRuleset(variationId) ? CATALOGUE.find((e) => e.id === 'uae') : undefined);
export const byTier = (tier: Tier) => CATALOGUE.filter((e) => e.tier === tier);
export const byRegion = (region: RegionId) => CATALOGUE.filter((e) => e.region === region);
export const playableEntries = () => CATALOGUE.filter((e) => e.status === 'playable');
