// Saved state from older or damaged saves must load without crashing the
// screens that draw it (QA pass, 2026-11-13).
import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const { loadProfile } = await import('../src/progression/profile');
const { econOf, loginStatus, claimLogin, weekChallenges, LOGIN_LADDER } = await import('../src/economy/economy');
const { avatarSvg } = await import('../src/cosmetics/avatar');

describe('damaged saves', () => {
  beforeEach(() => store.clear());

  it('repairs avatar and loadout fields of the wrong type, so the avatar still draws', () => {
    store.set('jongclub.profile.v1', JSON.stringify({ name: 'Old', avatar: { hairColor: 5, skin: 'pale', outfit: 'suit', eyes: 3 }, loadout: { tileSet: 7, rack: 'rack-table' } }));
    const p = loadProfile();
    expect(p.avatar.hairColor).toBeTypeOf('string');
    expect(p.avatar.skin).toBeTypeOf('number');
    expect(p.avatar.outfit).toBe('suit');
    expect(p.avatar.eyes).toBeUndefined();
    expect(p.loadout.tileSet).toBe('classic-ivory');
    expect(p.loadout.rack).toBe('rack-table');
    expect(() => avatarSvg(p.avatar, 72)).not.toThrow();
  });

  it('drops list entries of the wrong kind', () => {
    store.set('jongclub.profile.v1', JSON.stringify({ history: [null, { date: '2026-01-01', score: 1 }], trophies: [null], owned: [1, 'tileSet:jade'], lessonsDone: [null, 'basics'] }));
    const p = loadProfile();
    expect(p.history).toHaveLength(1);
    expect(p.trophies).toHaveLength(0);
    expect(p.owned).toEqual(['tileSet:jade']);
    expect(p.lessonsDone).toEqual(['basics']);
  });

  it('a login run with no day on the ladder starts again at Day 1', () => {
    const now = new Date(2026, 10, 13, 12);
    const p = loadProfile();
    (p as unknown as { econ: unknown }).econ = { login: { last: '2026-11-13', day: 0 } };
    expect(loginStatus(p, now)).toMatchObject({ day: 1, claimed: false, points: LOGIN_LADDER[0] });
    expect(claimLogin(p, now)).toBe(LOGIN_LADDER[0]);
  });

  it('weekly progress ignores a damaged starting count', () => {
    const now = new Date(2026, 10, 13, 12);
    const p = loadProfile();
    (p as unknown as { econ: unknown }).econ = { week: { id: '2026-11-09', base: { games: 'x', wins: null }, claimed: [] } };
    econOf(p, now);
    for (const c of weekChallenges(p, now)) expect(Number.isFinite(c.done)).toBe(true);
  });

  it('a damaged sign-in session plays as a guest', async () => {
    for (const bad of ['"x"', '{}', '[1]', '{"id":"a","name":"A","provider":"toString"}']) {
      store.set('jongclub.auth.session.v1', bad);
      vi.resetModules();
      const { currentAccount } = await import('../src/auth/account');
      expect(currentAccount()).toBeNull();
    }
    store.set('jongclub.auth.session.v1', JSON.stringify({ id: 'email-1', name: 'Asha', provider: 'email', since: '' }));
    vi.resetModules();
    const { currentAccount } = await import('../src/auth/account');
    expect(currentAccount()?.id).toBe('email-1');
  });
});
