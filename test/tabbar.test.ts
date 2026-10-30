import { describe, expect, it } from 'vitest';
import { PHONE_TABS, subOf, tabOf } from '../src/ui/tabbar';
import type { Screen } from '../src/ui/ctx';

const SCREENS: Screen[] = ['home', 'play', 'minigames', 'versions', 'learn', 'passport', 'club', 'collection', 'profile', 'daily', 'tournaments', 'atelier', 'store', 'seasons'];

describe('phone tab bar', () => {
  it('has the six tabs the user chose, in order (2026-10-30)', () => {
    expect(PHONE_TABS.map((t) => t.label)).toEqual(['Home', 'Play', 'Mini-games', 'Learn', 'Club', 'Profile']);
  });

  it('every screen sits under exactly one tab', () => {
    for (const s of SCREENS) expect(PHONE_TABS.filter((t) => t.screens.includes(s)).length, s).toBe(1);
    expect(tabOf('home')?.id).toBe('home');
    expect(tabOf('versions')?.id).toBe('play');
    expect(tabOf('daily')?.id).toBe('play');
    expect(tabOf('minigames')?.id).toBe('minigames');
    expect(tabOf('passport')?.id).toBe('club');
    expect(tabOf('collection')?.id).toBe('profile');
    expect(tabOf('atelier')?.id).toBe('profile');
    expect(tabOf('profile')?.id).toBe('profile');
  });

  it('lights the right sub-tab', () => {
    expect(subOf('versions')?.label).toBe('Variations');
    expect(subOf('tournaments')?.label).toBe('Play');
    expect(subOf('passport')?.label).toBe('World Tour');
    expect(subOf('learn')).toBeNull();
    expect(PHONE_TABS.find((t) => t.id === 'profile')?.subs?.map((s) => s.label)).toEqual(['Profile', 'Collection', 'Jong Points', 'Settings']);
    expect(subOf('store')?.label).toBe('Jong Points');
    expect(subOf('atelier')?.label).toBe('Collection');
  });
});
