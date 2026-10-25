import { describe, expect, it } from 'vitest';
import { CATALOG, DEFAULT_LOADOUT } from '../src/cosmetics/catalog';
import { RACK_STYLES, rackStyle } from '../src/cosmetics/racks';

describe('tile racks', () => {
  const racks = CATALOG.filter((c) => c.category === 'rack');
  it('every rack in the Atelier has a style, and every style is sold or free', () => {
    expect(racks.map((c) => c.id).sort()).toEqual(RACK_STYLES.map((r) => r.id).sort());
  });
  it('starts on the free table-matched rack and climbs in price', () => {
    expect(DEFAULT_LOADOUT.rack).toBe('rack-table');
    expect(racks[0].price).toBe(0);
    for (let i = 1; i < racks.length; i++) expect(racks[i].price).toBeGreaterThan(racks[i - 1].price);
  });
  it('falls back to the table rack for an unknown id', () => {
    expect(rackStyle('nope').id).toBe('rack-table');
  });
});
