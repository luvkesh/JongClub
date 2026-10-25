// The game catalogue: honest labels, every playable entry wired to an engine,
// and rule sets, formats and modes kept as separate kinds of choice.

import { describe, expect, it } from 'vitest';
import { CATALOGUE, FORMATS, MODES, REGIONS, UAE_PROFILE, byTier, entryFor, houseRuleGroup } from '../src/club/catalogue';
import { GAME_LENGTHS } from '../src/engine/rounds';
import { VARIATIONS, getProfile } from '../src/engine/rules';
import { versionLines } from '../src/ui/versions';

describe('catalogue', () => {
  it('every playable entry maps to a rule profile, and every profile is catalogued', () => {
    for (const e of CATALOGUE) {
      if (e.status === 'playable') expect(getProfile(e.variationId!), e.id).toBeTruthy();
      else expect(e.variationId).toBeUndefined();
    }
    for (const v of VARIATIONS) expect(entryFor(v.id), v.id).toBeTruthy();
    expect(new Set(CATALOGUE.map((e) => e.id)).size).toBe(CATALOGUE.length);
  });

  it('labels standardisation honestly', () => {
    const std = (id: string) => CATALOGUE.find((e) => e.id === id)!.standardisation;
    expect(std('mcr')).toBe('formal');
    expect(std('riichi')).toBe('formal');
    expect(std('uae')).toBe('house');
    expect(std('indian')).toBe('house');
    expect(std('sichuan')).toBe('regional');
    expect(new Set(CATALOGUE.map((e) => e.standardisation)).size).toBe(3);
    for (const r of REGIONS) expect(CATALOGUE.some((e) => e.region === r.id), r.id).toBe(true);
  });

  it('follows the launch priority', () => {
    expect(byTier('core').map((e) => e.id).sort()).toEqual(['american', 'classic', 'hongkong', 'india', 'mcr', 'riichi', 'singapore', 'taiwanese']);
    expect(byTier('distinctive').map((e) => e.id)).toEqual(expect.arrayContaining(['uae', 'malaysian', 'vietnamese', 'sichuan']));
    const korean = CATALOGUE.find((e) => e.id === 'korean')!;
    expect(korean.tier).toBe('expansion');
    expect(korean.status).toBe('playable');
  });

  it('UAE / Dubai Rules is a profile of rulesets, never one official ruleset', () => {
    expect(UAE_PROFILE.name).toBe('UAE / Dubai Rules');
    expect(UAE_PROFILE.rulesets.map((r) => r.name)).toEqual(['Dubai Asian · Goulash & Hands', 'Dubai Taiwanese', 'Dubai American', 'Custom UAE table']);
    for (const r of UAE_PROFILE.rulesets) {
      expect(getProfile(r.variationId)).toBeTruthy();
      expect(entryFor(r.variationId)!.id).toBe('uae');
    }
    expect(UAE_PROFILE.note).toMatch(/no single official/i);
  });

  it('formats and modes are their own categories', () => {
    for (const f of FORMATS) if (f.length) expect(GAME_LENGTHS[f.length]).toBeTruthy();
    expect(FORMATS.map((f) => f.id)).toEqual(expect.arrayContaining(['eastRound', 'eastSouth', 'fullNews', 'timed', 'threePlayer']));
    expect(MODES.map((m) => m.id)).toEqual(['standard', 'goulash']);
    // Goulash is a mode: never a catalogue entry or a format.
    expect(CATALOGUE.some((e) => /goulash/i.test(e.name))).toBe(false);
    expect(FORMATS.some((f) => /goulash/i.test(f.name))).toBe(false);
    expect(houseRuleGroup('goulashPot')).toBe('goulash');
    expect(houseRuleGroup('minFan')).toBe('winning');
  });

  it('Mei introduces every playable rule set', () => {
    expect(versionLines().length).toBe(CATALOGUE.filter((e) => e.status === 'playable').length);
    for (const l of versionLines()) expect(l).not.toMatch(/\d/);
  });
});
