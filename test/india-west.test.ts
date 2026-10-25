import { describe, expect, it } from 'vitest';
import { MahjongGame } from '../src/engine/game';
import { withHouseRules } from '../src/engine/rules';
import { indiaProfile } from '../src/engine/rules/india';
import { cleanKind, loserCount, westPayments, westScore, type Group } from '../src/engine/rules/indiaWest';
import { standardDecompositions } from '../src/engine/hand';
import type { ScoringContext } from '../src/engine/rules/types';
import { FLOWER_BASE, parseKinds, toCounts } from '../src/engine/tiles';
import type { Meld } from '../src/engine/state';
import { playHandHeadless } from '../src/club/sim';
import { AiPlayer } from '../src/ai/players';

const k = (s: string) => parseKinds(s)[0];
const kinds = (s: string) => parseKinds(s);
const pung = (kind: number, concealed = false, type: 'pung' | 'kong' = 'pung'): Meld => ({ type, tiles: Array.from({ length: type === 'kong' ? 4 : 3 }, (_, i) => ({ id: kind * 4 + i, kind })), concealed });
const WEST = withHouseRules(indiaProfile, { indiaRounds: 'W' });

function ctx(hand: string, over: Partial<ScoringContext> = {}): ScoringContext {
  const counts = toCounts(kinds(hand));
  const need = 4 - (over.melds?.length ?? 0);
  const decomposition = standardDecompositions(counts, need, false)[0] ?? { shape: 'standard' as const, sets: [], pair: -1 };
  return { decomposition, melds: [], concealedCounts: counts, winKind: kinds(hand)[0], selfDrawn: true, seatWind: 'S', prevailingWind: 'W', isDealer: false, lastTileOfWall: false, afterKong: false, dealerRepeat: 0, flowers: [], ...over };
}

describe('India Rules West round: the exchanges (pp. 12, 26)', () => {
  it('swaps in pairs: E-S & W-N, then E-N & S-W, then E-W & S-N', () => {
    const g = new MahjongGame(WEST, ['A', 'B', 'C', 'D'], 3);
    g.startHand(3);
    const d = g.dealer;
    const rel = (stage: number) => [0, 1, 2, 3].map((r) => (g.passTarget((d + r) % 4, stage) - d + 4) % 4);
    expect(rel(0)).toEqual([1, 0, 3, 2]);
    expect(rel(1)).toEqual([3, 2, 1, 0]);
    expect(rel(2)).toEqual([2, 3, 0, 1]);
  });
  it('runs three swaps, then East calls Tic-Tac-Toe and wall exchanges, keeping every tile', () => {
    const g = new MahjongGame(WEST, ['A', 'B', 'C', 'D'], 11);
    g.startHand(11);
    const ids = () => [...g.state.wall.slice(g.state.drawnFromFront, g.state.wall.length - g.state.drawnFromBack), ...g.players.flatMap((p) => [...p.hand, ...p.flowers])].map((t) => t.id).sort((a, b) => a - b);
    const all = ids();
    const wallLength = g.state.wall.length;
    const ais = [0, 1, 2, 3].map((s) => new AiPlayer(s, 'casual', 'zen', s));
    for (let stage = 0; stage < 3; stage++) {
      expect(g.state.phase).toMatchObject({ kind: 'charleston', stage });
      ais.forEach((ai, s) => g.charlestonPass(s, ai.charlestonPass(g).map((t) => t.id)));
    }
    // East answers four questions: Tic-Tac-Toe or not, then one or three; a wall exchange or not, then one or three.
    expect(g.state.phase).toMatchObject({ kind: 'exchangeChoice', seat: g.dealer, step: 'ttt' });
    expect(() => g.chooseExchanges(g.dealer, 2 as 1, 0)).toThrow();
    g.chooseExchanges(g.dealer, 1, 0);
    expect(g.state.phase.kind).toBe('ticTacToe');
    // The first tile goes right, the second across, the third left.
    const given = g.players[0].hand.slice(0, 3);
    ais.forEach((ai, s) => g.ticTacToe(s, s === 0 ? given.map((t) => t.id) : ai.ticTacToePick(g).map((t) => t.id)));
    given.forEach((t, i) => expect(g.players[1 + i].hand).toContain(t));
    expect(g.state.phase).toMatchObject({ kind: 'exchangeChoice', step: 'tttMore' });
    expect(() => g.chooseExchanges(g.dealer, 0, 0)).toThrow();
    g.chooseExchanges(g.dealer, 1, 0);
    expect(g.state.phase).toMatchObject({ kind: 'exchangeChoice', step: 'wall' });
    g.chooseExchanges(g.dealer, 0, 1);
    expect(g.state.phase).toMatchObject({ kind: 'wallExchange', round: 0 });
    ais.forEach((ai, s) => g.wallExchange(s, ai.wallExchangePick(g).map((t) => t.id)));
    expect(g.state.phase).toMatchObject({ kind: 'exchangeChoice', step: 'wallMore' });
    g.chooseExchanges(g.dealer, 0, 3);
    for (let r = 1; r < 3; r++) {
      expect(g.state.phase).toMatchObject({ kind: 'wallExchange', round: r });
      ais.forEach((ai, s) => g.wallExchange(s, ai.wallExchangePick(g).map((t) => t.id)));
    }
    expect(g.state.phase.kind).toBe('turn');
    expect(g.state.wall.length).toBe(wallLength);
    expect(g.state.outOfPlay ?? []).toEqual([]);
    expect(ids()).toEqual(all);
    g.players.forEach((p, s) => expect(p.hand.length).toBe(s === g.dealer ? 14 : 13));
  });
  it('East may call no exchanges at all', () => {
    const g = new MahjongGame(WEST, ['A', 'B', 'C', 'D'], 5);
    g.startHand(5);
    const ais = [0, 1, 2, 3].map((s) => new AiPlayer(s, 'casual', 'zen', s));
    for (let stage = 0; stage < 3; stage++) ais.forEach((ai, s) => g.charlestonPass(s, ai.charlestonPass(g).map((t) => t.id)));
    g.chooseExchanges(g.dealer, 0, 0);
    expect(g.state.phase).toMatchObject({ kind: 'exchangeChoice', step: 'wall' });
    g.chooseExchanges(g.dealer, 0, 0);
    expect(g.state.phase.kind).toBe('turn');
  });
});

describe('India Rules West round: clean hands (p. 27)', () => {
  const groups = (s: string): Group[] => kinds(s).map((kind) => ({ kind, kong: false, concealed: true }));
  it('reads each kind of clean hand', () => {
    expect(cleanKind(kinds('111m 222m 333m 555m 99m'), groups('1m 2m 3m 5m'))).toBe('Clean suit');
    expect(cleanKind(kinds('EEE SSS RdRdRd GdGdGd WdWd'), groups('E S Rd Gd'))).toBe('All honours');
    expect(cleanKind(kinds('111m 999p 111s 999s 11p'), groups('1m 9p 1s 9s'))).toBe('Terminal hand');
    expect(cleanKind(kinds('EEE SSS 111m 999m RdRd'), groups('E S 1m 9m'))).toBe('Major hand');
    expect(cleanKind(kinds('EEE 222m 333m 555m 66m'), groups('E 2m 3m 5m'))).toBe('One suit with honours');
  });
  it('turns away dirty hands and the wrong pairs', () => {
    expect(cleanKind(kinds('111m 222p 333m RdRdRd 99m'), groups('1m 2p 3m Rd'))).toBeNull();
    // A suit hand can't rest on an honour pair; an honour hand can't rest on a terminal pair.
    expect(cleanKind(kinds('111m 222m 333m 444m EE'), groups('1m 2m 3m 4m'))).toBeNull();
    expect(cleanKind(kinds('EEE SSS WWW RdRdRd 99m'), groups('E S W Rd'))).toBeNull();
  });
  it('a dirty hand cannot go Mahjong, however many flower doubles it has [reading, as the Learn lessons say]', () => {
    const s = westScore(ctx('111m 222p 333m RdRdRd 99m', { flowers: [FLOWER_BASE, FLOWER_BASE + 1, FLOWER_BASE + 2, FLOWER_BASE + 3, FLOWER_BASE + 4] }));
    expect(s.qualifies).toBe(false);
  });
});

describe('India Rules West round: doubles and points (pp. 27-29, chart p. 41)', () => {
  it('scores points x 2^doubles, with 20 for Mahjong', () => {
    // Clean suit 3 + 4 concealed pungs 2 + concealed Mahjong 3 = 8 doubles.
    // Points: 1m pung 8 (major, concealed), three minor pungs 4 each, a major pair 2, Mahjong 20 = 42.
    const s = westScore(ctx('111m 222m 333m 555m 99m'));
    expect(s.qualifies).toBe(true);
    expect(s.value).toBe(8);
    expect(s.points).toBe(42 * 256);
  });
  it('counts a pung finished by a discard as exposed', () => {
    const s = westScore(ctx('111m 222m 333m 555m 99m', { selfDrawn: false, winKind: k('5m') }));
    // 5m pung exposed: 2 points not 4; three concealed pungs is 1 double, concealed Mahjong 3, clean suit 3.
    expect(s.value).toBe(7);
    expect(s.points).toBe(40 * 128);
  });
  it('gives the own and round wind, dragons and flowers their doubles', () => {
    const s = westScore(ctx('WWW RdRdRd 222m 55m', { melds: [pung(k('7m'))], selfDrawn: false, winKind: k('5m'), seatWind: 'W', flowers: [FLOWER_BASE + 2, FLOWER_BASE + 6] }));
    const names = s.items.map((i) => i.name);
    expect(names).toEqual(expect.arrayContaining(['Own wind pung', 'Round wind pung', 'Dragon pung', 'Own flower', 'Round flower', 'Own season', 'Round season']));
  });
  it('needs at least 3 doubles and a clean hand', () => {
    expect(westScore(ctx('EEE 555m 66m', { melds: [pung(k('2m')), pung(k('3m'))], selfDrawn: false, winKind: k('5m'), seatWind: 'S' })).qualifies).toBe(false);
    expect(westScore(ctx('111m 222p 333m RdRdRd 99m')).qualifies).toBe(false);
  });
});

describe('India Rules West round: settlement (p. 29)', () => {
  const base = { dealer: 0, players: 4, flowers: [[], [], [], []] as number[][], seatWinds: ['E', 'S', 'W', 'N'] as ('E' | 'S' | 'W' | 'N')[], prevailing: 'W' as const };
  const score = { value: 3, unit: 'doubles', items: [], points: 400, limit: false };
  const plain = { concealed: kinds('1m 4p 7s E S W N Rd Gd Wd 2m 5p 8s'), melds: [] as Meld[] };
  it('everyone pays the winner, East double; the winner pays nobody', () => {
    const hands = [plain, { concealed: kinds('11m'), melds: [pung(k('2m')), pung(k('3m')), pung(k('4m'))] }, plain, plain];
    const pays = westPayments({ ...base, winner: 1, discarder: 2, score, hands, calling: () => true });
    expect(pays.map((p) => [p.from, p.to, p.amount])).toEqual([
      [0, 1, 800],
      [2, 1, 400],
      [3, 1, 400],
    ]);
  });
  it('the thrower pays for the table when a player with 3 exposed sets wins and the thrower is not calling', () => {
    const hands = [plain, { concealed: kinds('11m'), melds: [pung(k('2m')), pung(k('3m')), pung(k('4m'))] }, plain, plain];
    const pays = westPayments({ ...base, winner: 1, discarder: 2, score, hands, calling: () => false });
    expect(pays).toEqual([{ from: 2, to: 1, amount: 1600, reason: 'Penalty: pays for the table' }]);
  });
  it('other clean hands score too, paid by the other losers', () => {
    const clean = { concealed: kinds('555p 666p 1p 2p 3p 9p 9p 4p'), melds: [pung(k('7p'))] };
    const c = loserCount(clean.concealed, clean.melds, [], 'W', 'W');
    expect(c.clean).toBe('Clean suit');
    // 5p and 6p concealed pungs 4 each, 7p exposed 2, major pair 9p 2 = 12 points; clean suit = 3 doubles.
    expect(c.score).toBe(12 * 8);
    const pays = westPayments({ ...base, winner: 1, discarder: null, score, hands: [plain, plain, clean, plain], calling: () => true });
    expect(pays.filter((p) => p.reason?.startsWith('Count'))).toEqual([
      { from: 0, to: 2, amount: 192, reason: 'Count: Clean suit' },
      { from: 3, to: 2, amount: 96, reason: 'Count: Clean suit' },
    ]);
  });
  it('a dirty hand or a hand without a pung gets no count', () => {
    expect(loserCount(kinds('555p 666m 1p 2p 3p 9p 9p 4p 7p 7p'), [], [], 'S', 'W').score).toBe(0);
    expect(loserCount(kinds('1p 2p 3p 4p 5p 6p 7p 8p 9p 1p 2p 3p 4p'), [], [], 'S', 'W').score).toBe(0);
  });
});

describe('India Rules West round: the table', () => {
  it('plays the West round only, with flowers face down and no chows', () => {
    const g = new MahjongGame(WEST, ['A', 'B', 'C', 'D'], 1);
    g.startHand(1);
    expect(g.profile.specialRound).toBe('indiaWest');
    expect(g.profile.flowersHidden).toBe(true);
    expect(g.profile.calls.chow).toBe(false);
    expect(g.prevailing).toBe('W');
  });
  it('AI players finish Goulash games, win some, and the ledger balances', () => {
    let wins = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const g = new MahjongGame(WEST, ['A', 'B', 'C', 'D'], seed);
      const before = g.players.reduce((a, p) => a + p.score, 0);
      g.startHand(seed);
      expect(playHandHeadless(g, [0, 1, 2, 3].map((s) => new AiPlayer(s, 'strategic', 'zen', seed * 10 + s)))).toBe(true);
      const ph = g.state.phase;
      if (ph.kind === 'handOver' && ph.result.type === 'win') {
        wins++;
        expect(ph.result.score!.value).toBeGreaterThanOrEqual(3);
      }
      expect(g.players.reduce((a, p) => a + p.score, 0)).toBe(before);
    }
    expect(wins).toBeGreaterThan(3);
  });
});
