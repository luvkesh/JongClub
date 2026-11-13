// Second QA pass on India Rules and the owner's rulings of 2026-11-13 (PR #32):
// one winner per discard, the West clean-hand warning, the extra game after a drawn last game.
import { describe, expect, it } from "vitest";
import { MahjongGame } from "../src/engine/game";
import { getProfile, withHouseRules } from "../src/engine/rules";
import { northGoulash } from "../src/engine/rules/india";
import { parseKinds } from "../src/engine/tiles";
import type { ClaimOption, Phase } from "../src/engine/state";
import { buildProfile, playHandHeadless } from "../src/club/sim";
import { AiPlayer } from "../src/ai/players";
import { callLeavesNoWin } from "../src/ai/strategy";
import { rig, total } from "./helpers/qaRig";
import { toTurn } from "./helpers-india";

const k1 = (s: string) => parseKinds(s)[0];

describe("one winner per discard (ruling 1)", () => {
  it("3 players, robbing a kong: two can rob, only the nearest after the konger wins", () => {
    const g = new MahjongGame(
      withHouseRules(getProfile("korean3")!, { multipleWinners: "on" }),
      ["A", "B", "C"],
      4,
    );
    g.startHand(4);
    rig(
      g,
      [
        { hand: "111s 46s 789s 999s 22s" },
        {
          hand: "1m 1m 9m 9m S S 2p 2p W W 5s",
          melds: [{ spec: "5s 5s 5s", type: "pung", from: 0 }],
        },
        { hand: "123s 46s 678s 33s EEE" },
      ],
      { turn: 1 },
    );
    for (const pl of g.players) pl.flowers = [];
    const before = total(g);
    g.declareKong(1, k1("5s"));
    const ph = g.state.phase;
    expect(ph.kind).toBe("claims");
    if (ph.kind !== "claims") return;
    expect(Object.keys(ph.options).map(Number).sort()).toEqual([0, 2]);
    g.respond(0, { type: "win" });
    g.respond(2, { type: "win" });
    const end = g.state.phase;
    if (end.kind !== "handOver" || end.result.type !== "win")
      throw new Error("no win");
    // Turn order after seat 1 is 2, then 0.
    expect(end.result.winner).toBe(2);
    expect(end.result.winners).toBeUndefined();
    expect(total(g)).toBe(before);
  });

  it("India, three Mahjong calls on one discard: only the next in turn wins and only that win is paid", () => {
    const g = new MahjongGame(
      withHouseRules(getProfile("india")!, {
        indiaRounds: "E",
        passport: "optional",
        multipleWinners: "on",
      }),
      ["A", "B", "C", "D"],
      5,
    );
    g.startHand(5);
    // Seat 2 deals here, so seat 1 is the farthest caller and seat 3 the nearest after seat 2.
    g.state.round.dealerSeat = 2;
    rig(
      g,
      [
        { hand: "123m 456m 789m EEE 5p" },
        { hand: "123m 456m 789m SSS 5p" },
        { hand: "1p 9p 2s 6s N Rd Gd Wd 3s 7s 9s 1s 2p 5p" },
        { hand: "123m 456m 789m WWW 5p" },
      ],
      { turn: 2 },
    );
    for (const pl of g.players) pl.flowers = [];
    const before = g.players.map((p) => p.score);
    g.discard(2, g.players[2].hand.find((t) => t.kind === k1("5p"))!.id);
    const ph = g.state.phase;
    if (ph.kind !== "claims") throw new Error("no claims");
    expect(
      [0, 1, 3].every((s) => ph.options[s]?.some((o) => o.type === "win")),
    ).toBe(true);
    for (const s of [1, 0, 3]) g.respond(s, { type: "win" });
    const end = g.state.phase;
    if (end.kind !== "handOver" || end.result.type !== "win")
      throw new Error("no win");
    expect(end.result.winner).toBe(3);
    expect(end.result.winners).toBeUndefined();
    expect(end.result.payments.every((p) => p.to === 3)).toBe(true);
    // Concealed hand on a discard: 1000 each, East (seat 2) pays double.
    expect(g.players.map((p, s) => p.score - before[s])).toEqual([
      -1000, -1000, -2000, 4000,
    ]);
  });
});

/** Seat 0 holds `hand` (and exposed pungs `melds`); seat 3 throws `tile`. Plays any exchange phase first;
 *  `north` is East's North-round choice. */
function claimAt(
  house: Record<string, string>,
  hand: string,
  tile: string,
  melds: string[] = [],
  north?: number,
  seed = 7,
) {
  const g = new MahjongGame(
    buildProfile("india", "fullNews", house),
    ["A", "B", "C", "D"],
    seed,
  );
  g.state.round.dealerSeat = 3;
  g.startHand(seed);
  if (north !== undefined && g.state.phase.kind === "roundChoice")
    g.chooseRound(g.state.phase.seat, north);
  toTurn(g);
  if (g.state.phase.kind !== "turn" || g.state.phase.seat !== 3)
    throw new Error("seat 3 not on turn");
  const pl = g.players[0];
  pl.melds = [];
  for (const m of melds) {
    const tiles = pl.hand.splice(0, 3);
    parseKinds(m).forEach((k, i) => (tiles[i].kind = k));
    pl.melds.push({ type: "pung", tiles, concealed: false, from: 2 });
  }
  const kinds = parseKinds(hand);
  if (kinds.length !== pl.hand.length)
    throw new Error(`hand needs ${pl.hand.length}`);
  pl.hand.forEach((t, i) => (t.kind = kinds[i]));
  pl.flowers = [];
  (g as unknown as { seatShapeCache: unknown[] }).seatShapeCache = [];
  const kind = parseKinds(tile)[0];
  g.state.turnCount = 6;
  const t = g.players[3].hand[0];
  t.kind = kind;
  g.discard(3, t.id);
  const ph = g.state.phase as Phase;
  const options: ClaimOption[] =
    (ph.kind === "claims" ? ph.options[0] : undefined) ?? [];
  return { g, kind, options };
}
const W = { indiaRounds: "W" };
function warns(
  hand: string,
  tile: string,
  melds: string[],
  type: "pung" | "kong" = "pung",
  house: Record<string, string> = W,
  north?: number,
) {
  const { g, kind, options } = claimAt(house, hand, tile, melds, north);
  const o = options.find((x) => x.type === type);
  if (!o) throw new Error(`no ${type} offered: ${JSON.stringify(options)}`);
  return { warned: callLeavesNoWin(g, 0, o, kind), g, o };
}

describe("West clean-hand warning (ruling 2)", () => {
  it("an honour pung after 1s and 9s in two suits rules the terminal hand out: warned", () => {
    expect(
      warns("E E 2s 3s 4s 6s 7s", "E", ["1m 1m 1m", "9p 9p 9p"]).warned,
    ).toBe(true);
  });
  it("a 1s or 9s pung in a second suit keeps the terminal hand open: not warned", () => {
    expect(
      warns("9s 9s 2s 3s 4s 6s 7s", "9s", ["1m 1m 1m", "9p 9p 9p"]).warned,
    ).toBe(false);
  });
  it("a 1 pung beside an honour pung keeps the major hand open: not warned", () => {
    expect(
      warns("9m 9m 2s 3s 4s 6s 7s", "9m", ["1m 1m 1m", "E E E"]).warned,
    ).toBe(false);
  });
  it("a kong in a second suit is warned like a pung", () => {
    expect(
      warns("5p 5p 5p 2m 3m 4m 6m 7m 8m E", "5p", ["5m 5m 5m"], "kong").warned,
    ).toBe(true);
  });
  it("honour sets only: a suit pung keeps one suit with honours open", () => {
    expect(
      warns("5p 5p 2p 3p 4p 6p 7p 8p 9p E", "5p", ["Rd Rd Rd"]).warned,
    ).toBe(false);
  });
  it("the first call is never warned, whatever its suit", () => {
    expect(warns("5p 5p 2m 3m 4m 6m 7m 8m 9m E Rd S S", "5p", []).warned).toBe(
      false,
    );
  });
  it("sets already in two suits: a further call changes nothing, so it is not warned again", () => {
    expect(
      warns("7m 7m 2s 3s 4s 6s 7s", "7m", ["5m 5m 5m", "5p 5p 5p"]).warned,
    ).toBe(false);
  });
  it("North Goulash with jokers is checked the same way", () => {
    expect(
      warns(
        "5p 5p 2m 3m 4m 6m 7m 8m 9m E",
        "5p",
        ["7m 7m 7m"],
        "pung",
        { indiaRounds: "N" },
        northGoulash(1),
      ).warned,
    ).toBe(true);
    expect(
      warns(
        "5m 5m 2m 3m 4m 6m 7m 8m 9m E",
        "5m",
        ["7m 7m 7m"],
        "pung",
        { indiaRounds: "N" },
        northGoulash(1),
      ).warned,
    ).toBe(false);
  });
  it("outside the West round a second-suit pung is not a clean-hand matter", () => {
    expect(
      warns("5p 5p 2m 3m 4m 6m 7m 8m 9m E", "5p", ["7m 7m 7m"], "pung", {
        indiaRounds: "E",
        passport: "optional",
      }).warned,
    ).toBe(false);
  });
  it("the warning never blocks: the engine takes the call", () => {
    const { g, o } = warns("5p 5p 2m 3m 4m 6m 7m 8m 9m E", "5p", ["5m 5m 5m"]);
    expect(callLeavesNoWin(g, 0, o, k1("5p"))).toBe(true);
    g.respond(0, o);
    for (const s of g.pendingClaimSeats()) g.respond(s, { type: "pass" });
    expect(g.players[0].melds).toHaveLength(2);
  });
});

describe("North Goulash with jokers: a loser’s count", () => {
  it("a joker in a losing hand does not make the hand dirty", () => {
    const g = new MahjongGame(
      withHouseRules(getProfile("india")!, { indiaRounds: "N" }),
      ["A", "B", "C", "D"],
      6,
    );
    g.startHand(6);
    g.chooseRound(g.dealer, northGoulash(5));
    toTurn(g);
    // Seat 0 wins from the wall; seat 1 holds a clean Rings hand with an honour pung, plus one joker (5m).
    rig(
      g,
      [
        { hand: "111s 222s 333s 444s 99s" },
        { hand: "111p 999p EEE 22p 4p 5m" },
        null,
        null,
      ],
      { turn: 0 },
    );
    for (const pl of g.players) pl.flowers = [];
    const before = total(g);
    g.declareSelfDrawWin(0);
    const ph = g.state.phase;
    if (ph.kind !== "handOver" || ph.result.type !== "win")
      throw new Error("no win");
    const count = ph.result.payments.filter((p) => p.to === 1);
    // Book p. 29 note 6: every player with a clean hand gets a score; the joker stands for any tile.
    expect(count.length).toBeGreaterThan(0);
    expect(
      count.every((p) => p.reason?.startsWith("Count: One suit with honours")),
    ).toBe(true);
    expect(total(g)).toBe(before);
  });

  it("a joker-number tile beyond the first is natural and still dirties the hand", () => {
    const g = new MahjongGame(
      withHouseRules(getProfile("india")!, { indiaRounds: "N" }),
      ["A", "B", "C", "D"],
      6,
    );
    g.startHand(6);
    g.chooseRound(g.dealer, northGoulash(5));
    toTurn(g);
    rig(
      g,
      [
        { hand: "111s 222s 333s 444s 99s" },
        { hand: "111p 999p EEE 22p 5m 5m" },
        null,
        null,
      ],
      { turn: 0 },
    );
    for (const pl of g.players) pl.flowers = [];
    g.declareSelfDrawWin(0);
    const ph = g.state.phase;
    if (ph.kind !== "handOver" || ph.result.type !== "win")
      throw new Error("no win");
    expect(ph.result.payments.filter((p) => p.to === 1)).toEqual([]);
  });
});

describe("extra game after a drawn last game with buy money in the bank (ruling 3)", () => {
  /** Force the current hand to end as `type` (scores untouched) with `pot` in the bank. */
  const end = (g: MahjongGame, type: "draw" | "win", pot: number) => {
    g.state.riichiPot = pot;
    g.state.phase = {
      kind: "handOver",
      result:
        type === "draw"
          ? { type: "draw", payments: [], deltas: [0, 0, 0, 0] }
          : ({
              type: "win",
              winner: 1,
              discarder: null,
              payments: [],
              deltas: [0, 0, 0, 0],
            } as never),
    };
  };
  const lastGame = (rounds: string) => {
    const g = new MahjongGame(
      buildProfile("india", "fullNews", { indiaRounds: rounds }),
      ["A", "B", "C", "D"],
      3,
    );
    const last = g.profile.rounds.prevailingWinds.length - 1;
    g.state.round = {
      ...g.state.round,
      windIndex: last,
      dealerHand: g.profile.rounds.handsPerWind - 1,
      dealerSeat: 3,
      handsPlayed: 15,
    };
    return g;
  };

  it("repeats while the extra games are drawn, then ends on the win that collects the bank; East keeps the deal throughout", () => {
    const g = lastGame("ESWN");
    for (let i = 1; i <= 3; i++) {
      end(g, "draw", 200);
      expect(g.willEnd()).toBe(false);
      expect(g.advance()).toBe(false);
      expect(g.state.round).toMatchObject({
        windIndex: 3,
        dealerHand: 3,
        dealerSeat: 3,
        handsPlayed: 15 + i,
        finished: false,
      });
    }
    // The extra game is won: the bank is paid out with the win, and the match ends.
    end(g, "win", 0);
    expect(g.willEnd()).toBe(true);
    expect(g.advance()).toBe(true);
  });

  it("a drawn game before the last one passes the deal as before, bank or not", () => {
    const g = lastGame("ESWN");
    g.state.round = { ...g.state.round, dealerHand: 2, dealerSeat: 2 };
    end(g, "draw", 300);
    expect(g.advance()).toBe(false);
    expect(g.state.round).toMatchObject({ dealerHand: 3, dealerSeat: 3 });
    expect(g.state.riichiPot).toBe(300);
  });

  it("the last game of a round that is not the last round: the deal passes to the next round", () => {
    const g = lastGame("ESWN");
    g.state.round = { ...g.state.round, windIndex: 1, dealerSeat: 3 };
    end(g, "draw", 300);
    expect(g.advance()).toBe(false);
    expect(g.state.round).toMatchObject({
      windIndex: 2,
      dealerHand: 0,
      dealerSeat: 0,
    });
  });

  it("only India Rules: another rule set with sticks on the table still ends", () => {
    const g = new MahjongGame(
      buildProfile("hongkong", "eastRound", {}),
      ["A", "B", "C", "D"],
      3,
    );
    g.state.round = {
      ...g.state.round,
      dealerHand: 3,
      dealerSeat: 3,
      handsPlayed: 3,
      repeat: 0,
    };
    end(g, "draw", 1000);
    expect(g.peekNextRound().windIndex).toBeGreaterThan(0);
    expect(g.willEnd()).toBe(true);
  });

  it("a real North-round match with an extra game: 5 games, money conserved, bank empty at the end", () => {
    const seed = 4;
    const g = new MahjongGame(
      withHouseRules(getProfile("india")!, { indiaRounds: "N" }),
      ["A", "B", "C", "D"],
      seed,
    );
    const ais = [0, 1, 2, 3].map(
      (s) => new AiPlayer(s, "casual", "zen", seed * 10 + s),
    );
    let hands = 0;
    let extra = false;
    while (!g.matchOver && hands < 12) {
      g.startHand(seed * 1000 + hands);
      const dealer = g.dealer;
      expect(playHandHeadless(g, ais)).toBe(true);
      expect(total(g)).toBe(4 * 35000);
      const drawnLast =
        hands >= 3 &&
        g.state.phase.kind === "handOver" &&
        g.state.phase.result.type === "draw";
      g.advance();
      if (drawnLast && !g.matchOver) {
        extra = true;
        expect(g.dealer).toBe(dealer);
      }
      hands++;
    }
    expect(g.matchOver).toBe(true);
    expect(extra).toBe(true);
    expect(hands).toBe(5);
    expect(g.state.riichiPot).toBe(0);
    expect(g.players.reduce((a, p) => a + p.score, 0)).toBe(4 * 35000);
  }, 30000);
});
