import { describe, expect, it } from 'vitest';
import { CATALOG, ENVIRONMENTS, environmentStyle } from '../src/cosmetics/catalog';
import { VENUE_CATALOG, VENUE_ENVIRONMENTS, VENUE_STAMPS, venueStampEarned } from '../src/cosmetics/venues';
import { SCAPES } from '../src/audio/ambience';
import { isSignatureWin, signatureDuration, signatureName } from '../src/render/cinematic';
import { VARIATIONS } from '../src/engine/rules';

describe('signature venues', () => {
  it('registers three venues as environments sold for Jong Points', () => {
    expect(VENUE_ENVIRONMENTS.map((e) => e.id)).toEqual(['hk-teahouse', 'tokyo-janso', 'al-fahidi-majlis']);
    for (const e of VENUE_ENVIRONMENTS) {
      expect(ENVIRONMENTS).toContain(e);
      expect(environmentStyle(e.id)).toBe(e);
      const item = CATALOG.find((c) => c.category === 'environment' && c.id === e.id)!;
      expect(item).toBeTruthy();
      expect(item.price).toBeGreaterThan(0);
      // Buyable in The Atelier (an earnedBy would hide the price).
      expect(item.earnedBy).toBeUndefined();
    }
    expect(VENUE_CATALOG).toHaveLength(3);
  });

  it('each has its own room, floor and pendant', () => {
    const rooms = new Set(VENUE_ENVIRONMENTS.map((e) => e.room));
    const lamps = new Set(VENUE_ENVIRONMENTS.map((e) => e.lamp));
    expect(rooms.size).toBe(3);
    expect(lamps.size).toBe(3);
    const others = ENVIRONMENTS.filter((e) => !VENUE_ENVIRONMENTS.includes(e));
    for (const e of VENUE_ENVIRONMENTS) {
      expect(others.some((o) => o.room === e.room)).toBe(false);
      expect(others.some((o) => o.lamp === e.lamp)).toBe(false);
    }
  });

  it('opens free with the matching World Tour stamp: a win at that destination', () => {
    const ids = VARIATIONS.map((v) => v.id);
    for (const s of Object.values(VENUE_STAMPS)) for (const d of s.destinations) expect(ids).toContain(d);
    expect(venueStampEarned({ variationWins: {} }, 'hk-teahouse')).toBe(false);
    expect(venueStampEarned({ variationWins: { hongkong: 1 } }, 'hk-teahouse')).toBe(true);
    expect(venueStampEarned({ variationWins: { hongkong: 1 } }, 'tokyo-janso')).toBe(false);
    expect(venueStampEarned({ variationWins: { riichi: 2 } }, 'tokyo-janso')).toBe(true);
    expect(venueStampEarned({ variationWins: { 'uae-taiwanese': 1 } }, 'al-fahidi-majlis')).toBe(true);
    expect(venueStampEarned({ variationWins: { riichi: 9 } }, 'private-club')).toBe(false);
  });

  it('gives every venue an ambient soundscape', () => {
    for (const e of VENUE_ENVIRONMENTS) expect(SCAPES[e.id]).toBeTruthy();
    expect(new Set(Object.values(SCAPES)).size).toBe(3);
    expect(SCAPES['private-club']).toBeUndefined();
  });
});

describe('signature moment', () => {
  it('plays for limit hands, yakuman and maximum tai, not for mangan-tier hands', () => {
    expect(isSignatureWin({ limit: true })).toBe(true);
    expect(isSignatureWin({ limit: false })).toBe(false);
    expect(isSignatureWin({ limit: true, tier: 'Yakuman' })).toBe(true);
    expect(isSignatureWin({ limit: true, tier: '2× Yakuman' })).toBe(true);
    expect(isSignatureWin({ limit: true, tier: 'Counted Yakuman' })).toBe(true);
    expect(isSignatureWin({ limit: true, tier: 'Mangan' })).toBe(false);
    expect(isSignatureWin({ limit: true, tier: 'Sanbaiman' })).toBe(false);
    expect(isSignatureWin(null)).toBe(false);
  });

  it('names the moment and keeps it short, shorter still when calm', () => {
    expect(signatureName({ tier: 'Yakuman', unit: 'han' })).toBe('Yakuman');
    expect(signatureName({ unit: 'tai' })).toBe('Maximum tai');
    expect(signatureName({ unit: 'faan' })).toBe('Limit hand');
    expect(signatureDuration(true, 'cinematic')).toBeLessThan(signatureDuration(false, 'classic'));
    expect(signatureDuration(false, 'cinematic')).toBeLessThanOrEqual(6);
  });
});
