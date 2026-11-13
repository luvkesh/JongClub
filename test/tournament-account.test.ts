import { describe, expect, it } from 'vitest';

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const { activate, guestAccount, signOut } = await import('../src/auth/account');
const { loadTournament, saveTournament } = await import('../src/ui/compete');

describe('a tournament belongs to the account that entered it', () => {
  it('is not seen by a guest or another account', () => {
    activate({ id: 'email-a', provider: 'email', name: 'Ana', email: 'a@x.co', since: '' });
    saveTournament({ id: 't1' } as never);
    expect(loadTournament()?.id).toBe('t1');
    signOut();
    activate(guestAccount());
    expect(loadTournament()).toBeNull();
    activate({ id: 'email-b', provider: 'email', name: 'Ben', email: 'b@x.co', since: '' });
    expect(loadTournament()).toBeNull();
    activate({ id: 'email-a', provider: 'email', name: 'Ana', email: 'a@x.co', since: '' });
    expect(loadTournament()?.id).toBe('t1');
    signOut();
  });
});
