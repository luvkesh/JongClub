import { describe, expect, it } from 'vitest';
import { applyLocation, nearestPlace, PLACES, placeOf, regionOfCountry } from '../src/club/location';
import { ROSTER } from '../src/club/roster';

describe('player location', () => {
  it('knows the country of every club member’s city', () => {
    for (const m of ROSTER) expect(placeOf(m.city), m.city).toBeTruthy();
  });
  it('agrees with the roster on each member’s region', () => {
    for (const m of ROSTER) expect(regionOfCountry(placeOf(m.city)!.country), m.city).toBe(m.region);
  });
  it('finds the nearest listed city', () => {
    expect(nearestPlace(25.08, 55.14).city).toBe('Dubai'); // Dubai Marina
    expect(nearestPlace(22.28, 114.16).city).toBe('Hong Kong');
    expect(nearestPlace(51.45, -0.3).city).toBe('London');
  });
  it('fills city, country and region together', () => {
    const p = { region: 'Europe' } as { region: string; city?: string; country?: string; locSource?: string };
    applyLocation(p as never, { city: 'Mumbai', country: 'IN', source: 'manual' });
    expect(p).toMatchObject({ city: 'Mumbai', country: 'IN', region: 'South Asia', locSource: 'manual' });
  });
  it('lists each city once', () => {
    const seen = new Set(PLACES.map((p) => p[0]));
    expect(seen.size).toBe(PLACES.length);
  });
});
