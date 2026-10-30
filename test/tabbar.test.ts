import { describe, expect, it } from 'vitest';
import { PHONE_TABS, subOf, tabOf } from '../src/ui/tabbar';
import type { Screen } from '../src/ui/ctx';

const SCREENS: Screen[] = ['home', 'play', 'versions', 'learn', 'passport', 'club', 'collection', 'profile', 'daily', 'tournaments', 'atelier'];

describe('phone tab bar', () => {
  it('has five tabs in the agreed order', () => {
    expect(PHONE_TABS.map((t) => t.label)).toEqual(['Play', 'Learn', 'Club', 'Collection', 'You']);
  });

  it('every screen but Home sits under exactly one tab', () => {
    for (const s of SCREENS) {
      const n = PHONE_TABS.filter((t) => t.screens.includes(s)).length;
      expect(n, s).toBe(s === 'home' ? 0 : 1);
    }
    expect(tabOf('versions')?.id).toBe('play');
    expect(tabOf('daily')?.id).toBe('play');
    expect(tabOf('passport')?.id).toBe('club');
    expect(tabOf('atelier')?.id).toBe('collection');
    expect(tabOf('profile')?.id).toBe('you');
  });

  it('lights the right sub-tab', () => {
    expect(subOf('versions')?.label).toBe('Variations');
    expect(subOf('tournaments')?.label).toBe('Play');
    expect(subOf('passport')?.label).toBe('World Tour');
    expect(subOf('learn')).toBeNull();
    expect(PHONE_TABS.find((t) => t.id === 'you')?.subs?.map((s) => s.label)).toEqual(['Profile', 'Jong Points', 'Settings']);
    expect(subOf('store')?.label).toBe('Jong Points');
  });
});
