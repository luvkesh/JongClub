// JongBot audit (Chinese rulesets). Each test asserts the CORRECT behaviour and
// fails today. Positions are fixed (seeded deal, hand forced by kind).
import { describe, expect, it } from 'vitest';
import { claimHint, handStatus, turnHint } from '../src/ai/jongbot';
import { planClaim } from '../src/ai/strategy';
import { parseKinds, tileName } from '../src/engine/tiles';
import { legalWaitsAfter, onClaim, onTurn, readyAfterCall } from './audit-helpers';

const k = (s: string) => parseKinds(s)[0];

describe('JongBot: "ready" hands that can never win', () => {
  it('Wuhan: does not head for a ready hand without a 2-5-8 pair (discard 6p, not 2s)', () => {
    const g = onTurn({ variation: 'wuhan', hand: '222p 999m 333p 6789p 2s' });
    const h = turnHint(g, 0, 'learning');
    // Discarding 2s waits on 6p/9p with a 99m or 66p pair: never legal. Discarding 6p waits on 2s (22s pair).
    expect(legalWaitsAfter(g, h.focusKind!).length, `${h.headline} ${h.why}`).toBeGreaterThan(0);
  });

  it('MCR: does not head for a ready hand worth under 8 fan (discard 3m, not 6m)', () => {
    const g = onTurn({ variation: 'mcr', hand: '345s 56p 999m 345m 55s 6m' });
    const h = turnHint(g, 0, 'learning');
    expect(legalWaitsAfter(g, h.focusKind!).length, `${h.headline} ${h.why}`).toBeGreaterThan(0);
  });

  it('Northeast: does not head for a ready hand missing a suit (discard 9s, not 4p)', () => {
    const g = onTurn({ variation: 'northeast', hand: '123s 678s 9s 345m 4p', melds: [{ type: 'pung', kinds: 'GdGdGd' }] });
    const h = turnHint(g, 0, 'learning');
    expect(legalWaitsAfter(g, h.focusKind!).length, `${h.headline} ${h.why}`).toBeGreaterThan(0);
  });

  it('Hong Kong: does not pick a wait with no tiles left over a live one', () => {
    // 1p out leaves WWW 222m 3333s 789p: the only wait is a fifth 3s. 3s out waits on 1p.
    const g = onTurn({ variation: 'hongkong', hand: 'WWW 222m 333s 789p 1p 3s' });
    const h = turnHint(g, 0, 'learning');
    expect(h.why).not.toMatch(/nothing live/);
    expect(h.focusKind).toBe(k('3s'));
  });

  it('Beijing: a seven-pairs wait that needs the hun\'er is not called ready unless it can win', () => {
    // 33m 22p GdGd 77s 44s + hun'er (9s) + 5p N: JongBot says ready on 5p/N, but the engine never
    // reads a wild as half of a pair in seven pairs, so neither tile wins.
    const g = onTurn({ variation: 'beijing', hand: '33m 22p GdGd 77s 44s 9s 5p N S', wild: [k('9s')] });
    const h = turnHint(g, 0, 'learning');
    const legal = legalWaitsAfter(g, h.focusKind!);
    expect(legal.length > 0 || !/ready to win/.test(h.why ?? ''), `${h.headline} ${h.why} legal=${legal.map(tileName)}`).toBe(true);
  });
});

describe('JongBot: claim advice and minimum value', () => {
  it('Hong Kong (3 faan): does not chow into an open hand that can reach 2 faan at most', () => {
    const c = onClaim({ variation: 'hongkong', hand: '2m 3m 5p 6p 7p 7s 8s 9s 1s 1s Rd Rd 9p', tile: '4m', flowers: [2] });
    const h = claimHint(c.g, 0, c.options, c.kind, 'learning');
    expect(h.action, h.headline).toBe('pass');
  });

  it('Classic (3-faan house rule): same chow is not advised', () => {
    const c = onClaim({ variation: 'classic', house: { minValue: '3' }, hand: '2m 3m 5p 6p 7p 7s 8s 9s 1s 1s Rd Rd 9p', tile: '4m', flowers: [2] });
    const h = claimHint(c.g, 0, c.options, c.kind, 'learning');
    expect(h.action, h.headline).toBe('pass');
  });

  it('MCR (8 fan): an advised call leaves at least one winning tile', () => {
    const c = onClaim({ variation: 'mcr', hand: '1s 3s 4p 2p 3p 4m 5m 6m 8s 8s 8s 6p 9m', tile: '2s' });
    const h = claimHint(c.g, 0, c.options, c.kind, 'learning');
    if (h.action === 'pass') return;
    const after = readyAfterCall(c.g, planClaim(c.g, 0, c.options, c.kind).best as never);
    expect(after.some((r) => r.legal.length > 0), `${h.headline}: ready hands after the call ${JSON.stringify(after)}`).toBe(true);
  });

  it('Classic West (Goulash) round: a pung is never "unable to reach 3 faan" (every win is All Pungs)', () => {
    const c = onClaim({ variation: 'classic', house: { specialRounds: 'on' }, windIndex: 2, hand: '55m 77p 99s 44s 2m 3m 6p 8p 1s', tile: '5m' });
    const h = claimHint(c.g, 0, c.options, c.kind, 'learning');
    expect(h.why).not.toMatch(/couldn't reach/);
    // (Seven pairs is the shorter road here, so passing is fine; the old text wrongly blamed the 3 faan.)
  });

  it('Northeast: a concealed hand is told to open up (it can never win concealed)', () => {
    const c = onClaim({ variation: 'northeast', hand: '111m 234p 567s 78s 99p', tile: '9s' });
    const h = claimHint(c.g, 0, c.options, c.kind, 'learning');
    expect(h.action, `${h.headline} ${h.why}`).toBe('chow');
  });

  it('Northeast: handStatus does not call an unwinnable concealed hand ready', () => {
    const c = onClaim({ variation: 'northeast', hand: '111m 234p 567s 78s 99p', tile: '9s' });
    expect(handStatus(c.g, 0)).not.toMatch(/^Ready/);
  });
});

describe('JongBot: special shapes', () => {
  it('Classic East (Passport) round: a 9-passport two tiles short is not "ready"', () => {
    // Called 345s; 1s 3s 4s 6s 7s 8s 9s 444p after 3s out: the 1-9 passport lacks 2s AND 5s.
    const g = onTurn({ variation: 'classic', house: { specialRounds: 'on' }, windIndex: 0, hand: '1s 3s 4s 6s 7s 8s 9s 444p 3s', melds: [{ type: 'chow', kinds: '345s' }] });
    const h = turnHint(g, 0, 'learning');
    expect(legalWaitsAfter(g, h.focusKind!).length > 0 || !/ready to win/.test(h.why ?? ''), `${h.headline} ${h.why}`).toBe(true);
  });

  it('Classic East (Passport) round: names the honours a 5-passport waits on', () => {
    const g = onTurn({ variation: 'classic', house: { specialRounds: 'on' }, windIndex: 0, hand: 'Rd Wd W S 345m 5m', melds: [{ type: 'chow', kinds: '123p' }, { type: 'chow', kinds: '567s' }] });
    const h = turnHint(g, 0, 'learning');
    // Legal winning tiles after 5m out: East, North, Green Dragon.
    expect(h.why).not.toMatch(/nothing live/);
  });

  it('MCR knitted straight: waits on the missing knitted tile, not a tile that completes nothing', () => {
    const g = onTurn({ variation: 'mcr', hand: '1m 4m 258p 369s EEE NN Wd' });
    const h = turnHint(g, 0, 'learning');
    expect(h.focusKind).toBe(k('Wd'));
    expect(h.why).toMatch(/7 Character/);
    expect(h.why).not.toMatch(/North Wind/);
  });
});

describe('JongBot: kongs (weak)', () => {
  it('Sichuan: suggests the free concealed kong (kong money is paid on the spot)', () => {
    const g = onTurn({ variation: 'sichuan', hand: '5555m 123m 789m 11p 24p' });
    expect(g.turnOptions(0).kongs).toContain(k('5m'));
    const h = turnHint(g, 0, 'learning');
    expect(h.headline).toMatch(/Gang|kong/i);
  });
});
