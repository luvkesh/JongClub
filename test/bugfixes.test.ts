// Regression tests for bugs found by the mass simulation (test/stress.test.ts)
// and by reading the rules against docs/variants. Each test failed before its fix.

import { describe, expect, it } from 'vitest';
import { MahjongGame } from '../src/engine/game';
import { americanProfile } from '../src/engine/rules/american';
import { riichiProfile } from '../src/engine/rules/riichi';
import type { Meld, Phase } from '../src/engine/state';
import type { Tile } from '../src/engine/tiles';
import { JOKER_KIND, isJoker, parseKinds, toCounts } from '../src/engine/tiles';
import { applyAction, handSeed, type Action } from '../src/net/actions';
import { RoomLink, type PlayPresence } from '../src/net/lockstep';
import { profileFor, replayHand, resumeAt, type ReplayRecord } from '../src/net/replay';
import type { TableConfig } from '../src/ui/match';
import { wildDecompositions, winningDecompositions } from '../src/engine/hand';

let nextId = 2000;
const tiles = (spec: string): Tile[] => parseKinds(spec).map((kind) => ({ id: nextId++, kind }));
const k = (s: string) => parseKinds(s)[0];

describe('American', () => {
  it('a called kong is exposed without a replacement draw (14 tiles, then discard)', () => {
    const g = new MahjongGame(americanProfile, ['A', 'B', 'C', 'D'], 5);
    g.startHand(5);
    // Skip the Charleston: seat 0 to discard a North, seat 1 holds three Norths.
    g.players[0].hand = tiles('1m 2m 3m 4m 5m 6m 7m 8m 9m 1p 2p 3p 4p N');
    g.players[1].hand = tiles('NNN 1s 3s 5s 7s 9s 2p 4p 6p 8p E');
    g.players[2].hand = tiles('1m 1m 2s 2s 4s 4s 6s 6s 8s 8s 9p 9p S');
    g.players[3].hand = tiles('3m 3m 5p 5p 7p 7p 9m 9m 2m 2m 4m 4m W');
    const north = g.players[0].hand[13];
    g.state.phase = { kind: 'turn', seat: 0, drawn: north, afterKong: false, mustDiscardOnly: false };
    g.discard(0, north.id);
    const ph = g.state.phase as Phase;
    expect(ph.kind).toBe('claims');
    if (ph.kind !== 'claims') return;
    expect(ph.options[1].map((o) => o.type)).toContain('kong');
    for (const s of g.pendingClaimSeats()) g.respond(s, s === 1 ? { type: 'kong' } : { type: 'pass' });
    const after = g.state.phase;
    expect(after.kind).toBe('turn');
    const p1 = g.players[1];
    expect(p1.melds[0].tiles.map((t) => t.kind)).toEqual([k('N'), k('N'), k('N'), k('N')]);
    // 10 in hand + 4 exposed = 14: discard next, no replacement tile.
    expect(p1.hand.length + p1.melds[0].tiles.length).toBe(14);
    if (after.kind === 'turn') {
      expect(after.drawn).toBeNull();
      expect(after.mustDiscardOnly).toBe(true);
    }
  });
});

describe('Asian jokers', () => {
  it('Indian (no joker pair): a joker fills the middle of a chow so two naturals can be the pair', () => {
    const counts = new Array(34).fill(0);
    for (const kind of parseKinds('3m 4m 4m 5m 123p 456p 789s')) counts[kind]++;
    const readings = wildDecompositions(counts, [JOKER_KIND], 0, { sevenPairs: true, thirteenOrphans: true }, { inPair: false, inChow: true });
    expect(readings.length).toBeGreaterThan(0);
    expect(readings[0].decomposition.pair).toBe(k('4m'));
  });
});

describe('Riichi kongs', () => {
  it('no fifth kong: the fifth replacement tile would be an ura dora indicator', () => {
    const g = new MahjongGame(riichiProfile, ['A', 'B', 'C', 'D'], 9);
    g.startHand(9);
    const kong = (spec: string): Meld => ({ type: 'kong', tiles: tiles(spec), concealed: true });
    g.players[1].melds = [kong('1111m'), kong('2222m')];
    g.players[2].melds = [kong('3333m'), kong('4444m')];
    g.players[1].hand = tiles('5p 6p');
    g.players[2].hand = tiles('5s 6s');
    g.players[0].hand = tiles('EEEE 123p 789p 11s 2s');
    g.players[3].hand = tiles('SSS 123s 456s 789s W');
    g.state.drawnFromBack = 4;
    g.state.doraRevealed = 5;
    g.state.phase = { kind: 'turn', seat: 0, drawn: g.players[0].hand[13], afterKong: false, mustDiscardOnly: false };
    expect(g.turnOptions(0).kongs).toEqual([]);
    // Nor an exposed kong on a discard.
    g.players[0].hand = tiles('EEE 123p 789p 11s 23s S');
    const south = g.players[0].hand[13];
    g.state.phase = { kind: 'turn', seat: 0, drawn: south, afterKong: false, mustDiscardOnly: false };
    g.discard(0, south.id);
    const ph = g.state.phase as Phase;
    expect(ph.kind).toBe('claims');
    if (ph.kind === 'claims') expect(ph.options[3].map((o) => o.type)).toEqual(['pung']);
  });
});

describe('late spectators and goulash', () => {
  const config = { variation: 'american', length: 'eastRound', houseRules: { goulash: 'on' } } as unknown as TableConfig;
  /** A goulash hand (after a wall game) whose Charleston passes a joker. */
  function goulashHand(seed: number, hand: number) {
    const g = new MahjongGame(profileFor(config), ['A', 'B', 'C', 'D'], seed);
    g.state.goulash = true;
    g.startHand(handSeed(seed, hand));
    const picks = g.players.map((p) => {
      const j = p.hand.filter((t) => isJoker(t.kind));
      const rest = p.hand.filter((t) => !isJoker(t.kind));
      return [...j, ...rest].slice(0, 3).map((t) => t.id);
    });
    const actions: Action[] = picks.map((ids, s) => ({ t: 'cp', s, ids }));
    return { g, actions, jokerPassed: picks.some((ids, s) => ids.some((id) => isJoker(g.players[s].hand.find((t) => t.id === id)!.kind))) };
  }

  it('a replay that starts at a goulash hand lets jokers pass, as the live table did', () => {
    let seed = 1;
    while (!goulashHand(seed, 2).jokerPassed) seed++;
    const { g, actions } = goulashHand(seed, 2);
    const start = { hand: 2, round: structuredClone(g.state.round), scores: g.players.map((p) => p.score), pot: 0, goulash: true };
    const rec: ReplayRecord = { id: 'g', date: '', config, names: ['A', 'B', 'C', 'D'], me: -1, matchSeed: seed, finalScores: [], placement: 1, mode: 'multiplayer', hands: [actions], start };
    for (const a of actions) applyAction(g, a);
    const steps = replayHand(rec, 0).steps;
    expect(steps.slice(-1)[0].state).toEqual(g.state);
  });

  it('the host snapshot for late spectators carries the goulash flag', () => {
    const presences: Record<string, unknown>[] = [];
    const room = { presence: async (p: Record<string, unknown>) => void presences.push(JSON.parse(JSON.stringify(p))), peers: () => [], onPeers: () => () => {}, connected: () => true, name: 'x', leave: async () => {} };
    (globalThis as { window?: unknown }).window ??= globalThis;
    const link = new RoomLink(room, [null, null, null, null], 'host', true);
    const { g } = goulashHand(3, 1);
    link.handStarted(1, g);
    link.close();
    const hs = (presences.find((p) => (p.play as PlayPresence | undefined)?.hs)!.play as PlayPresence).hs!;
    expect(hs.goulash).toBe(1);
    const fresh = new MahjongGame(profileFor(config), ['A', 'B', 'C', 'D'], 3);
    resumeAt(fresh, hs);
    expect(fresh.state.goulash).toBe(true);
    expect(fresh.state.round).toEqual(g.state.round);
  });
});

describe('network actions', () => {
  it('isLegalAction screens remote decisions without touching the game', async () => {
    const { isLegalAction } = await import('../src/net/actions');
    const g = new MahjongGame(profileFor({ variation: 'classic', length: 'oneHand', houseRules: {} } as unknown as TableConfig), ['A', 'B', 'C', 'D'], 4);
    g.startHand(4);
    const before = structuredClone(g.state);
    const dealer = g.dealer;
    const tile = g.players[dealer].hand[0];
    expect(isLegalAction(g, { t: 'd', s: dealer, id: tile.id })).toBe(true);
    expect(isLegalAction(g, { t: 'd', s: (dealer + 1) % 4, id: g.players[(dealer + 1) % 4].hand[0].id })).toBe(false);
    expect(isLegalAction(g, { t: 'd', s: dealer, id: NaN })).toBe(false);
    expect(isLegalAction(g, { t: 'c', s: 2, r: { type: 'pass' } })).toBe(false);
    expect(isLegalAction(g, { t: 'k', s: 9, k: 1 })).toBe(false);
    expect(g.state).toEqual(before);
  });
});

describe('Riichi yaku', () => {
  it('a win on the kong replacement is Rinshan, never also Haitei', () => {
    const counts = toCounts(parseKinds('234m 567m 345p 99p'));
    const d = winningDecompositions(counts, 1, riichiProfile.shapes)[0];
    const kong: Meld = { type: 'kong', tiles: tiles('EEEE'), concealed: true };
    const s = riichiProfile.score({ decomposition: d, melds: [kong], concealedCounts: counts, winKind: k('4m'), selfDrawn: true, seatWind: 'S', prevailingWind: 'E', isDealer: false, lastTileOfWall: true, afterKong: true, dealerRepeat: 0, riichi: true });
    const names = s.items.map((i) => i.name);
    expect(names).toContain('Rinshan Kaihou');
    expect(names).not.toContain('Haitei');
  });
});
