// The five table options from the user's options catalogue: self-draw only,
// winner takes all, cumulative leaderboard and team play (multiple winners was taken out 2026-11-13).
// They are house rules every rule set offers (src/engine/rules/tableOptions.ts).

import { describe, expect, it } from 'vitest';
import { MahjongGame } from '../src/engine/game';
import { getProfile, withHouseRules } from '../src/engine/rules';
import { classicProfile } from '../src/engine/rules/classic';
import { sanmaProfile } from '../src/engine/rules/sanma';
import { allHouseRules, partnerOf, tableOptionRules, tableOptionsFrom, teamOf, teamTotals, usesLadder, usesTeams, TABLE_OPTION_IDS } from '../src/engine/rules/tableOptions';
import type { RuleProfile } from '../src/engine/rules/types';
import type { Meld } from '../src/engine/state';
import { Tile, parseKinds } from '../src/engine/tiles';
import { threatLevels } from '../src/ai/evaluate';
import { readOpponents } from '../src/ai/danger';
import { CATALOGUE, HOUSE_RULE_GROUPS, houseRuleGroup } from '../src/club/catalogue';
import { houseRuleTip } from '../src/ui/houseRuleTips';
import { addToLadder, sortLadder, type LadderRow } from '../src/club/ladder';
import { simulateMatch } from '../src/club/sim';

const k = (s: string) => parseKinds(s)[0];

/** Tiles with ids that avoid the red-five copies. */
function tiles(spec: string): Tile[] {
  const used = new Map<number, number>();
  return parseKinds(spec).map((kind) => {
    const n = used.get(kind) ?? 0;
    used.set(kind, n + 1);
    return { id: kind * 4 + 3 - n, kind };
  });
}

/**
 * Seat 0 is about to discard a 5p. Seat 1 waits on 5p (4p-6p); seat 2 waits on 5p too (a 5p pair with
 * four complete sets, so the pair fills); seat 3 holds a dead hand.
 */
function setup(base: RuleProfile, choices: Record<string, string> = {}) {
  const profile = withHouseRules(base, choices);
  const g = new MahjongGame(profile, ['A', 'B', 'C', 'D'], 7);
  g.startHand(7);
  const five: Tile = { id: 51, kind: k('5p') };
  g.players[0].hand = [...tiles('123s 789m EE WdWd 1p 9s 2m 1s 3m'), five];
  g.players[1].hand = tiles('123m 456m 789s 46p NN');
  g.players[2].hand = tiles('123m 456m 789s 234s 5p');
  g.players[3].hand = tiles('2468m 2468p 2468s S');
  for (const pl of g.players) {
    pl.discardKinds = [];
    pl.melds = [];
  }
  g.state.phase = { kind: 'turn', seat: 0, drawn: five, afterKong: false, mustDiscardOnly: false };
  return { g, five };
}

describe('table options in the lobby and catalogue', () => {
  it('every rule set offers the four options after its own house rules; three-seat tables skip team play', () => {
    const ids = allHouseRules(classicProfile).map((r) => r.id);
    for (const id of TABLE_OPTION_IDS) expect(ids).toContain(id);
    expect(ids.slice(-TABLE_OPTION_IDS.length)).toEqual(TABLE_OPTION_IDS);
    expect(tableOptionRules(sanmaProfile.players).map((r) => r.id)).not.toContain('teamPlay');
    expect(allHouseRules(sanmaProfile).map((r) => r.id)).toContain('selfDrawOnly');
  });

  it('withHouseRules turns the choices into profile.table, off by default', () => {
    expect(withHouseRules(classicProfile, {}).table).toEqual({ selfDrawOnly: false, winnerTakesAll: false, teams: false, ladder: false });
    const on = withHouseRules(classicProfile, { selfDrawOnly: 'on', multipleWinners: 'on', winnerTakesAll: 'on', cumulativeLeaderboard: 'on', teamPlay: 'on' }).table!;
    expect(on).toEqual({ selfDrawOnly: true, winnerTakesAll: true, teams: true, ladder: true });
    // No teams at a three-seat table even if the choice is sent.
    expect(tableOptionsFrom({ teamPlay: 'on' }, 3).teams).toBe(false);
    expect(usesLadder({ cumulativeLeaderboard: 'on' })).toBe(true);
    expect(usesTeams({ teamPlay: 'on' }, 3)).toBe(false);
    // Every playable variation keeps its own rules and gains the table options.
    for (const id of ['india', 'riichi', 'american', 'taiwanese', 'uae-taiwanese', 'mcr']) {
      const p = getProfile(id)!;
      expect(withHouseRules(p, { selfDrawOnly: 'on' }).table?.selfDrawOnly, id).toBe(true);
    }
  });

  it('each option has a tooltip and a catalogue group, and the catalogue now lists them as playable', () => {
    for (const id of TABLE_OPTION_IDS) expect(houseRuleTip(id), id).toBeTruthy();
    expect(houseRuleGroup('selfDrawOnly')).toBe('winning');
    expect(houseRuleGroup('winnerTakesAll')).toBe('scoring');
    expect(houseRuleGroup('cumulativeLeaderboard')).toBe('competitive');
    expect(houseRuleGroup('teamPlay')).toBe('competitive');
    const items = HOUSE_RULE_GROUPS.flatMap((g) => g.items);
    for (const name of ['Self-draw only', 'Winner takes all', 'Cumulative leaderboard', 'Team play']) {
      expect(items.find((i) => i.name === name)?.status, name).toBe('playable');
    }
    expect(items.some((i) => i.status === 'coming')).toBe(false);
    expect(CATALOGUE.length).toBeGreaterThan(0);
  });
});

describe('self-draw only', () => {
  it('nobody is offered a win on a discard; calls still work', () => {
    const { g, five } = setup(classicProfile, { selfDrawOnly: 'on' });
    expect(g.discardWins()).toBe(false);
    g.discard(0, five.id);
    const ph = g.state.phase;
    // Seat 1 could pung nothing and seat 2 holds a 5p pair: a pung is still offered, a win never.
    if (ph.kind === 'claims') {
      for (const opts of Object.values(ph.options)) expect(opts.some((o) => o.type === 'win')).toBe(false);
    } else expect(ph.kind).toBe('turn');
  });

  it('a win on a discard is offered when the option is off', () => {
    const { g, five } = setup(classicProfile);
    g.discard(0, five.id);
    const ph = g.state.phase;
    expect(ph.kind).toBe('claims');
    if (ph.kind !== 'claims') return;
    expect(ph.options[1][0]).toEqual({ type: 'win' });
    expect(ph.options[2]?.some((o) => o.type === 'win')).toBe(true);
  });

  it('robbing the kong is off too, and the bots stop defending', () => {
    const profile = withHouseRules(classicProfile, { selfDrawOnly: 'on' });
    const g = new MahjongGame(profile, ['A', 'B', 'C', 'D'], 7);
    g.startHand(7);
    const p0 = g.players[0];
    const pung: Meld = { type: 'pung', tiles: [{ id: 50, kind: k('5p') }, { id: 49, kind: k('5p') }, { id: 48, kind: k('5p') }], concealed: false, from: 2 };
    const fourth: Tile = { id: 51, kind: k('5p') };
    p0.melds = [pung];
    p0.hand = [...tiles('123s 789m EE WdWd 1p'), fourth];
    g.players[1].hand = tiles('123m 456m 789s 46p NN');
    g.players[2].hand = tiles('1357m 1357p 1357s E');
    g.players[3].hand = tiles('2468m 2468p 2468s S');
    for (const pl of g.players) {
      pl.discardKinds = [];
      if (pl !== p0) pl.melds = [];
    }
    g.state.phase = { kind: 'turn', seat: 0, drawn: fourth, afterKong: false, mustDiscardOnly: false };
    g.declareKong(0, k('5p'));
    expect(g.state.phase.kind).toBe('turn');
    expect(p0.melds[0].type).toBe('kong');
    expect(threatLevels(g, 1).every((t) => t === 0)).toBe(true);
    expect(readOpponents(g, 1)).toEqual([]);
  });

  it('a self-drawn win still wins and pays', () => {
    const { g } = setup(classicProfile, { selfDrawOnly: 'on' });
    g.players[0].hand = tiles('123m 456m 789s 234s 5p 5p');
    g.state.phase = { kind: 'turn', seat: 0, drawn: g.players[0].hand[13], afterKong: false, mustDiscardOnly: false };
    expect(g.turnOptions(0).canWin).toBe(true);
    g.declareSelfDrawWin(0);
    const over = () => g.state.phase;
    expect(over().kind).toBe('handOver');
    const ph = over();
    if (ph.kind === 'handOver') expect(ph.result.winner).toBe(0);
  });
});

describe('one winner per discard', () => {
  it('off: only the first in turn order wins (head bump)', () => {
    const { g, five } = setup(classicProfile);
    g.discard(0, five.id);
    g.respond(1, { type: 'win' });
    g.respond(2, { type: 'win' });
    const ph = g.state.phase;
    expect(ph.kind).toBe('handOver');
    if (ph.kind !== 'handOver') return;
    expect(ph.result.winner).toBe(1);
    expect(ph.result.winners).toBeUndefined();
    expect(ph.result.deltas[2]).toBeLessThan(0);
  });

  it('only one winner, ever: a saved "multiple winners" choice is ignored (user ruling 2026-11-13)', () => {
    const { g, five } = setup(classicProfile, { multipleWinners: 'on' });
    expect(TABLE_OPTION_IDS).not.toContain('multipleWinners');
    g.discard(0, five.id);
    g.respond(1, { type: 'win' });
    g.respond(2, { type: 'win' });
    const ph = g.state.phase;
    expect(ph.kind).toBe('handOver');
    if (ph.kind !== 'handOver') return;
    expect(ph.result.winner).toBe(1);
    expect(ph.result.coWinners ?? []).toEqual([]);
  });
});

describe('winner takes all', () => {
  it('a win on a discard is paid by everyone, as the rule set pays a self-draw', () => {
    const { g, five } = setup(classicProfile, { winnerTakesAll: 'on' });
    const before = g.players.map((p) => p.score);
    g.discard(0, five.id);
    g.respond(1, { type: 'win' });
    g.respond(2, { type: 'pass' });
    const ph = g.state.phase;
    expect(ph.kind).toBe('handOver');
    if (ph.kind !== 'handOver') return;
    const pts = ph.result.score!.points;
    expect(ph.result.discarder).toBe(0);
    expect(ph.result.payments).toEqual([
      { from: 0, to: 1, amount: pts },
      { from: 2, to: 1, amount: pts },
      { from: 3, to: 1, amount: pts },
    ]);
    expect(g.players[1].score - before[1]).toBe(3 * pts);
    expect(g.players[0].score - before[0]).toBe(-pts);
  });

  it('off: the discarder pays more than the others (Classic half-gun)', () => {
    const { g, five } = setup(classicProfile);
    g.discard(0, five.id);
    g.respond(1, { type: 'win' });
    g.respond(2, { type: 'pass' });
    const ph = g.state.phase;
    if (ph.kind !== 'handOver') throw new Error('hand not over');
    const pts = ph.result.score!.points;
    expect(ph.result.payments.find((p) => p.from === 0)?.amount).toBe(2 * pts);
    expect(ph.result.payments.find((p) => p.from === 3)?.amount).toBe(pts / 2);
  });
});

describe('team play', () => {
  it('partners sit across the table and the bots never defend against a partner', () => {
    expect(teamOf(0)).toBe(0);
    expect(teamOf(2)).toBe(0);
    expect(teamOf(1)).toBe(1);
    expect(partnerOf(1)).toBe(3);
    expect(teamTotals([100, -50, 200, -250])).toEqual([300, -300]);
    const { g } = setup(classicProfile, { teamPlay: 'on' });
    expect(g.teamOf(0)).toBe(0);
    expect(g.sameTeam(0, 2)).toBe(true);
    expect(g.sameTeam(0, 1)).toBe(false);
    expect(g.dealInRisk(0, 2)).toBe(false);
    expect(g.dealInRisk(0, 1)).toBe(true);
    g.players[2].riichi = true;
    g.players[1].riichi = true;
    const t = threatLevels(g, 0);
    expect(t[2]).toBe(0);
    expect(t[1]).toBe(1);
    expect(readOpponents(g, 0).map((r) => r.seat)).toEqual([1, 3]);
    // Off: no teams.
    const plain = setup(classicProfile).g;
    expect(plain.teamOf(0)).toBeNull();
    expect(plain.sameTeam(0, 2)).toBe(false);
  });

  it('a headless match with every option on plays to the end', () => {
    const r = simulateMatch({
      variation: 'classic',
      length: 'eastRound',
      houseRules: { selfDrawOnly: 'off', winnerTakesAll: 'on', teamPlay: 'on', cumulativeLeaderboard: 'on' },
      difficulties: ['casual', 'casual', 'casual', 'casual'],
      personalities: ['zen', 'shark', 'wall', 'gambler'],
      names: ['A', 'B', 'C', 'D'],
      seed: 11,
    });
    expect(r.capped).toBe(false);
    expect(r.hands).toBeGreaterThan(0);
    const sum = r.standings.reduce((a, s) => a + s.score, 0);
    expect(sum).toBe(classicProfile.startingScore * 4 - r.leftoverPot);
  });

  it('a self-draw-only match ends every hand by self-draw or a wall game', () => {
    const r = simulateMatch({
      variation: 'hongkong',
      length: 'eastRound',
      houseRules: { selfDrawOnly: 'on' },
      difficulties: ['casual', 'strategic', 'casual', 'strategic'],
      personalities: ['zen', 'shark', 'wall', 'gambler'],
      names: ['A', 'B', 'C', 'D'],
      seed: 3,
    });
    expect(r.capped).toBe(false);
    for (const h of r.handResults) if (h.type === 'win') expect(h.discarder).toBeNull();
  });
});

describe('cumulative leaderboard', () => {
  it('adds net points, matches and wins by name, across variations', () => {
    let rows: LadderRow[] = [];
    rows = addToLadder(rows, { variation: 'classic', startingScore: 5000, seats: [{ name: 'You', score: 5600 }, { name: 'Mei', score: 4700 }, { name: 'Rex', score: 4900 }, { name: 'Hiro', score: 4800 }], date: '2026-11-12T00:00:00Z' });
    rows = addToLadder(rows, { variation: 'riichi', startingScore: 25000, seats: [{ name: 'You', score: 22000 }, { name: 'Mei', score: 31000 }, { name: 'Rex', score: 25000 }, { name: 'Hiro', score: 22000 }], date: '2026-11-12T01:00:00Z' });
    const sorted = sortLadder(rows);
    expect(sorted.map((r) => r.name)).toEqual(['Mei', 'Rex', 'You', 'Hiro']);
    const you = sorted.find((r) => r.name === 'You')!;
    expect(you).toMatchObject({ matches: 2, wins: 1, points: 600 - 3000, byVariation: { classic: 600, riichi: -3000 } });
    expect(sorted[0]).toMatchObject({ name: 'Mei', wins: 1, points: -300 + 6000 });
  });

  it('team play: a win counts for both partners', () => {
    const rows = addToLadder([], { variation: 'classic', startingScore: 5000, teams: [10400, 9600], seats: [{ name: 'You', score: 5100 }, { name: 'Mei', score: 5300 }, { name: 'Rex', score: 5300 }, { name: 'Hiro', score: 4300 }] });
    expect(rows.map((r) => [r.name, r.wins])).toEqual([
      ['You', 1],
      ['Mei', 0],
      ['Rex', 1],
      ['Hiro', 0],
    ]);
  });
});
