// Variation registry: every playable rule set. The wider catalogue (formal
// rulesets, regional families, what is coming) lives in src/club/catalogue.ts.

import { tr } from '../../i18n';
import { classicProfile } from './classic';
import { riichiProfile } from './riichi';
import { taiwaneseProfile } from './taiwanese';
import { americanProfile } from './american';
import { uaeProfile } from './uae';
import { vietnameseProfile } from './vietnamese';
import { indianProfile } from './indian';
import { singaporeProfile } from './singapore';
import { hongKongProfile } from './hongkong';
import { mcrProfile } from './mcr';
import { sichuanProfile } from './sichuan';
import { malaysianProfile } from './malaysian';
import { uaeAmericanProfile, uaeCustomProfile, uaeTaiwaneseProfile } from './uaeRulesets';
import { koreanProfile } from './korean';
import { sanmaProfile } from './sanma';
import { malaysian3Profile } from './malaysian3';
import { riichiTournamentProfile } from './riichiTournament';
import { emaProfile } from './ema';
import { korean4Profile } from './korean4';
import { guangdongProfile } from './guangdong';
import { zungJungProfile } from './zungJung';
import { europeanProfile } from './european';
import { wuhanProfile } from './wuhan';
import { shanghaiProfile } from './shanghai';
import { fujianProfile } from './fujian';
import { beijingProfile } from './beijing';
import { northeastProfile } from './northeast';
import { wrightPattersonProfile } from './wrightPatterson';
import { filipinoProfile } from './filipino';
import { indonesianProfile, thaiProfile } from './thaiIndonesian';
import { indiaProfile } from './india';
import { applyGoulash } from './goulash';
import type { RuleProfile } from './types';

export interface VariationInfo {
  id: string;
  name: string;
  /** Short label for buttons and history rows. */
  short: string;
  region: string;
  flag: string;
  blurb: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  profile?: RuleProfile;
  /** A ruleset inside a regional profile (UAE / Dubai Rules): the parent's id. */
  parent?: string;
  /** The ruleset's own name, shown under the profile name. */
  ruleset?: string;
  /** Seats at the table (the profile's players). Absent = 4. */
  players?: 3 | 4;
  /** Academy lesson id, when the variation has one under another id. Absent = its own id. */
  lesson?: string;
  /** Added in the Expansion release (the catalogue's 'expansion' tier). */
  expansion?: boolean;
  /** A tile that stands for the game on its card: [kind, red five]. */
  signature?: [number, boolean?];
}

/** Seats a variation is played with (3 for Korean, Sanma and Malaysian three-player, 4 everywhere else). */
export const seatsOf = (v: Pick<VariationInfo, 'players' | 'profile'>) => v.players ?? v.profile?.players ?? 4;

/** Seats at a table of this variation id (4 when unknown). */
export const seatsForVariation = (id: string) => getProfile(id)?.players ?? 4;

const UAE = 'UAE / Dubai Rules';

export const VARIATIONS: VariationInfo[] = [
  { id: 'india', name: 'India Rules', short: 'India', region: 'India', flag: '🇮🇳', blurb: indiaProfile.summary, level: 'Intermediate', profile: indiaProfile, lesson: 'india', signature: [9] },
  { id: 'classic', name: 'Classic Mahjong', short: 'Classic', region: 'China', flag: '🇨🇳', blurb: classicProfile.summary, level: 'Beginner', profile: classicProfile },
  { id: 'riichi', name: 'Japanese Riichi', short: 'Riichi', region: 'Japan', flag: '🇯🇵', blurb: riichiProfile.summary, level: 'Intermediate', profile: riichiProfile },
  { id: 'taiwanese', name: 'Taiwanese Mahjong', short: 'Taiwanese', region: 'Taiwan', flag: '🇹🇼', blurb: taiwaneseProfile.summary, level: 'Advanced', profile: taiwaneseProfile },
  { id: 'american', name: 'American Mahjong', short: 'American', region: 'USA', flag: '🇺🇸', blurb: americanProfile.summary, level: 'Intermediate', profile: americanProfile },
  { id: 'uae', name: UAE, ruleset: 'Dubai Asian · Goulash & Hands', short: 'Dubai Goulash', region: 'UAE', flag: '🇦🇪', blurb: uaeProfile.summary, level: 'Intermediate', profile: uaeProfile },
  { id: 'vietnamese', name: 'Vietnamese Mahjong', short: 'Vietnamese', region: 'Vietnam', flag: '🇻🇳', blurb: vietnameseProfile.summary, level: 'Intermediate', profile: vietnameseProfile },
  { id: 'indian', name: 'Kolkata Joker Club', short: 'Kolkata', region: 'India', flag: '🇮🇳', blurb: indianProfile.summary, level: 'Intermediate', profile: indianProfile },
  { id: 'singapore', name: 'Singapore Mahjong', short: 'Singapore', region: 'Singapore', flag: '🇸🇬', blurb: singaporeProfile.summary, level: 'Intermediate', profile: singaporeProfile },
  { id: 'hongkong', name: 'Hong Kong Mahjong', short: 'Hong Kong', region: 'Hong Kong', flag: '🇭🇰', blurb: hongKongProfile.summary, level: 'Intermediate', profile: hongKongProfile },
  { id: 'mcr', name: 'Chinese Official (MCR)', short: 'MCR', region: 'China', flag: '🇨🇳', blurb: mcrProfile.summary, level: 'Advanced', profile: mcrProfile },
  { id: 'sichuan', name: 'Sichuan Blood Battle', short: 'Sichuan', region: 'Sichuan, China', flag: '🇨🇳', blurb: sichuanProfile.summary, level: 'Intermediate', profile: sichuanProfile },
  { id: 'malaysian', name: 'Malaysian Mahjong', short: 'Malaysian', region: 'Malaysia', flag: '🇲🇾', blurb: malaysianProfile.summary, level: 'Intermediate', profile: malaysianProfile },
  { id: 'korean3', name: 'Korean Mahjong', short: 'Korean', region: 'Korea', flag: '🇰🇷', blurb: koreanProfile.summary, level: 'Intermediate', profile: koreanProfile, players: 3 },
  { id: 'sanma', name: 'Sanma (three-player Riichi)', short: 'Sanma', region: 'Japan', flag: '🇯🇵', blurb: sanmaProfile.summary, level: 'Advanced', profile: sanmaProfile, players: 3 },
  { id: 'malaysian3', name: 'Malaysian three-player', short: 'Malaysian 3P', region: 'Malaysia', flag: '🇲🇾', blurb: malaysian3Profile.summary, level: 'Intermediate', profile: malaysian3Profile, players: 3 },
  { id: 'riichi-tournament', name: 'Riichi tournament rules', short: 'Riichi League', region: 'Japan', flag: '🇯🇵', blurb: riichiTournamentProfile.summary, level: 'Advanced', profile: riichiTournamentProfile, expansion: true, signature: [4, true] },
  { id: 'ema', name: 'EMA tournament rules', short: 'EMA', region: 'Europe', flag: '🇪🇺', blurb: emaProfile.summary, level: 'Advanced', profile: emaProfile, expansion: true, signature: [33] },
  { id: 'korean', name: 'Korean Mahjong (four players)', short: 'Korean 4P', region: 'Korea', flag: '🇰🇷', blurb: korean4Profile.summary, level: 'Intermediate', profile: korean4Profile, expansion: true, signature: [9] },
  { id: 'guangdong', name: 'Guangdong push-down', short: 'Guangdong', region: 'Guangdong, China', flag: '🇨🇳', blurb: guangdongProfile.summary, level: 'Beginner', profile: guangdongProfile, expansion: true, signature: [31] },
  { id: 'zung-jung', name: 'Zung Jung', short: 'Zung Jung', region: 'Hong Kong', flag: '🇭🇰', blurb: zungJungProfile.summary, level: 'Intermediate', profile: zungJungProfile, expansion: true, signature: [32] },
  { id: 'european', name: 'European Classical', short: 'European', region: 'Britain', flag: '🇬🇧', blurb: europeanProfile.summary, level: 'Intermediate', profile: europeanProfile, expansion: true, signature: [34] },
  { id: 'wuhan', name: 'Wuhan Mahjong', short: 'Wuhan', region: 'Wuhan, China', flag: '🇨🇳', blurb: wuhanProfile.summary, level: 'Intermediate', profile: wuhanProfile, expansion: true, signature: [31] },
  { id: 'shanghai', name: 'Shanghai Mahjong', short: 'Shanghai', region: 'Shanghai, China', flag: '🇨🇳', blurb: shanghaiProfile.summary, level: 'Intermediate', profile: shanghaiProfile, expansion: true, signature: [35] },
  { id: 'fujian', name: 'Fujian Mahjong', short: 'Fujian', region: 'Fujian, China', flag: '🇨🇳', blurb: fujianProfile.summary, level: 'Advanced', profile: fujianProfile, expansion: true, signature: [22] },
  { id: 'beijing', name: 'Beijing Mahjong', short: 'Beijing', region: 'Beijing, China', flag: '🇨🇳', blurb: beijingProfile.summary, level: 'Intermediate', profile: beijingProfile, expansion: true, signature: [33] },
  { id: 'northeast', name: 'Northeast China (Dongbei)', short: 'Dongbei', region: 'Northeast China', flag: '🇨🇳', blurb: northeastProfile.summary, level: 'Intermediate', profile: northeastProfile, expansion: true, signature: [30] },
  { id: 'wright-patterson', name: 'Wright-Patterson', short: 'Wright-Patterson', region: 'USA', flag: '🇺🇸', blurb: wrightPattersonProfile.summary, level: 'Intermediate', profile: wrightPattersonProfile, expansion: true, signature: [37] },
  { id: 'thai', name: 'Thai Mahjong', short: 'Thai', region: 'Thailand', flag: '🇹🇭', blurb: thaiProfile.summary, level: 'Beginner', profile: thaiProfile, expansion: true, signature: [27] },
  { id: 'filipino', name: 'Filipino Mahjong', short: 'Filipino', region: 'Philippines', flag: '🇵🇭', blurb: filipinoProfile.summary, level: 'Intermediate', profile: filipinoProfile, expansion: true, signature: [39] },
  { id: 'indonesian', name: 'Indonesian Mahjong', short: 'Indonesian', region: 'Indonesia', flag: '🇮🇩', blurb: indonesianProfile.summary, level: 'Beginner', profile: indonesianProfile, expansion: true, signature: [29] },
  { id: 'uae-taiwanese', parent: 'uae', name: UAE, ruleset: 'Dubai Taiwanese', short: 'Dubai Taiwanese', region: 'UAE', flag: '🇦🇪', blurb: uaeTaiwaneseProfile.summary, level: 'Advanced', profile: uaeTaiwaneseProfile },
  { id: 'uae-american', parent: 'uae', name: UAE, ruleset: 'Dubai American', short: 'Dubai American', region: 'UAE', flag: '🇦🇪', blurb: uaeAmericanProfile.summary, level: 'Intermediate', profile: uaeAmericanProfile },
  { id: 'uae-custom', parent: 'uae', name: UAE, ruleset: 'Custom UAE table', short: 'Custom UAE', region: 'UAE', flag: '🇦🇪', blurb: uaeCustomProfile.summary, level: 'Intermediate', profile: uaeCustomProfile },
];

/**
 * Engine-complete variations whose table UI is not ready yet (three seats).
 * They play headless (sims, tests, AI) through getProfile but stay out of
 * VARIATIONS, so no menu, rotation or achievement lists them. To release one,
 * move it into VARIATIONS and give its catalogue entry the variationId.
 */
export const UPCOMING_VARIATIONS: VariationInfo[] = [
];

export const getProfile = (id: string) => (VARIATIONS.find((v) => v.id === id) ?? UPCOMING_VARIATIONS.find((v) => v.id === id))?.profile;

/** Full display name: "UAE / Dubai Rules · Dubai Taiwanese" for a regional ruleset. */
export const variationTitle = (v: VariationInfo) => (v.ruleset ? `${tr(v.name)} · ${tr(v.ruleset)}` : tr(v.name));

/** The UAE / Dubai Rules profile's rulesets, parent first. */
export const uaeRulesets = () => VARIATIONS.filter((v) => v.id === 'uae' || v.parent === 'uae');

/** Apply a host's house-rule choices to a base profile. */
export function withHouseRules(p: RuleProfile, choices: Record<string, string>): RuleProfile {
  const out: RuleProfile = { ...p, rounds: { ...p.rounds }, houseChoices: { ...choices } };
  if (choices.minValue !== undefined) out.minValue = Number(choices.minValue);
  if (choices.dealerRetention) out.rounds.dealerRetention = choices.dealerRetention as RuleProfile['rounds']['dealerRetention'];
  const all = { ...Object.fromEntries(p.houseRules.map((r) => [r.id, r.default])), ...choices };
  if (p.configure) Object.assign(out, p.configure(all));
  // Goulash is a mode on top of the rule set (applied after the profile's own rules).
  Object.assign(out, applyGoulash(out, all));
  return out;
}
