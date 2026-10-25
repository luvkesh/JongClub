import { beforeEach, describe, expect, it } from 'vitest';

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const { NUDGE_GAP, NUDGE_MAX_DECLINES, loadNudge, markAsked, markDeclined, noteSession, nudgeAllowed } = await import('../src/auth/nudge');
const { activate, currentAccount, guestAccount, signOut } = await import('../src/auth/account');
const { loadProfile, saveProfile } = await import('../src/progression/profile');

const allowed = () => nudgeAllowed(loadNudge());

describe('sign-in offers to guests', () => {
  beforeEach(() => store.clear());

  it('asks once, then waits a few sessions before asking again', () => {
    noteSession();
    expect(allowed()).toBe(true);
    markAsked();
    expect(allowed()).toBe(false);
    for (let i = 1; i < NUDGE_GAP; i++) {
      noteSession();
      expect(allowed(), `session +${i}`).toBe(false);
    }
    noteSession();
    expect(allowed()).toBe(true);
  });

  it('stops asking on its own after a few "Not now"s', () => {
    for (let n = 0; n < NUDGE_MAX_DECLINES; n++) {
      for (let i = 0; i < NUDGE_GAP; i++) noteSession();
      expect(allowed()).toBe(true);
      markAsked();
      markDeclined();
    }
    for (let i = 0; i < NUDGE_GAP * 3; i++) noteSession();
    expect(allowed()).toBe(false);
  });

  it('survives junk in storage', () => {
    store.set('jongclub.auth.nudge.v1', '[1]');
    expect(loadNudge().sessions).toBe(0);
    expect(allowed()).toBe(true);
  });
});

describe('play first, sign in later', () => {
  beforeEach(() => store.clear());

  it('a guest’s progress carries over to the account on first sign-in', () => {
    signOut();
    expect(currentAccount()).toBeNull();
    // First visit: straight in as a guest (what authGate does).
    activate(currentAccount() ?? guestAccount());
    const p = loadProfile();
    p.jongPoints = 120;
    p.lessonsDone.push('basics');
    saveProfile(p);

    activate({ id: 'google-demo-a@b.co', provider: 'google', name: 'Ana', email: 'a@b.co', demo: true, since: '' });
    const q = loadProfile();
    expect(q.jongPoints).toBe(120);
    expect(q.lessonsDone).toEqual(['basics']);
    expect(q.name).toBe('Ana');

    // The account keeps its own slot; signing out returns to the guest's.
    q.jongPoints = 300;
    saveProfile(q);
    signOut();
    expect(loadProfile().jongPoints).toBe(120);
  });
});

describe('signing in renames the guest', () => {
  beforeEach(() => store.clear());

  it('an account slot left with the placeholder name takes the account name', async () => {
    store.set('jongclub.profile.v1:email-x', JSON.stringify({ name: 'Guest', jongPoints: 40 }));
    activate({ id: 'email-x', provider: 'email', name: 'Luv', email: 'l@x.co', since: '' });
    const p = loadProfile();
    expect(p.name).toBe('Luv');
    expect(p.jongPoints).toBe(40);
    signOut();
  });

  it('saved games show the new name in your own seat only', async () => {
    const { renameMe, saveReplay, loadReplays } = await import('../src/net/replay');
    const base = { date: '', config: {} as never, matchSeed: 1, hands: [], finalScores: [], placement: 1, mode: 'ai' };
    saveReplay({ ...base, id: 'a', names: ['Guest', 'Mei', 'Guest', 'Lau'], me: 0 });
    saveReplay({ ...base, id: 'b', names: ['Ana', 'Guest', 'Mei', 'Lau'], me: -1 });
    renameMe('Guest', 'Luv');
    const byId = Object.fromEntries(loadReplays().map((r) => [r.id, r.names]));
    expect(byId.a).toEqual(['Luv', 'Mei', 'Guest', 'Lau']);
    expect(byId.b).toEqual(['Ana', 'Guest', 'Mei', 'Lau']);
  });
});
