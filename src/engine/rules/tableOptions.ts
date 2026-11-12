// Table options: five house rules that belong to the table, not to any one
// rule set, so every variation offers them. They come from the user's
// options catalogue (self-draw only, multiple winners, winner takes all,
// cumulative leaderboard, team play) and sit in the House rules panel next
// to the rule set's own options. withHouseRules turns the choices into
// `profile.table`, which the game reads from its base profile (a special
// wind round's overlay never loses them).

import type { RuleProfile } from './types';

type HouseRule = RuleProfile['houseRules'][number];

export interface TableOptions {
  /** Only a self-drawn tile wins: no win on a discard, a robbed kong or a set-aside North. */
  selfDrawOnly: boolean;
  /** Everyone who can win on the same discard wins; the discarder pays each of them. */
  multipleWinners: boolean;
  /** A win on a discard is paid by every other player, as the rule set pays a self-draw. */
  winnerTakesAll: boolean;
  /** Partners sit across the table (East with West, South with North) and score together. */
  teams: boolean;
  /** The match result joins the running table in the Club (src/club/ladder.ts). */
  ladder: boolean;
}

export const SELF_DRAW_ONLY = 'selfDrawOnly';
export const MULTIPLE_WINNERS = 'multipleWinners';
export const WINNER_TAKES_ALL = 'winnerTakesAll';
export const CUMULATIVE_LEADERBOARD = 'cumulativeLeaderboard';
export const TEAM_PLAY = 'teamPlay';

export const TABLE_OPTION_RULES: HouseRule[] = [
  {
    id: SELF_DRAW_ONLY,
    label: 'Self-draw only',
    options: [
      { value: 'off', label: 'Off: a discard can be won on' },
      { value: 'on', label: 'On: only a tile you draw yourself wins' },
    ],
    default: 'off',
  },
  {
    id: MULTIPLE_WINNERS,
    label: 'Multiple winners',
    options: [
      { value: 'off', label: 'Off: the first in turn order wins' },
      { value: 'on', label: 'On: everyone who can win on the tile wins' },
    ],
    default: 'off',
  },
  {
    id: WINNER_TAKES_ALL,
    label: 'Winner takes all',
    options: [
      { value: 'off', label: 'Off: paid as the rule set says' },
      { value: 'on', label: 'On: every other player pays the winner' },
    ],
    default: 'off',
  },
  {
    id: CUMULATIVE_LEADERBOARD,
    label: 'Cumulative leaderboard',
    options: [
      { value: 'off', label: 'Off: this match stands alone' },
      { value: 'on', label: 'On: the result joins the running table' },
    ],
    default: 'off',
  },
  {
    id: TEAM_PLAY,
    label: 'Team play',
    options: [
      { value: 'off', label: 'Off: everyone plays for themselves' },
      { value: 'on', label: 'On: partners sit across the table' },
    ],
    default: 'off',
  },
];

export const TABLE_OPTION_IDS = TABLE_OPTION_RULES.map((r) => r.id);

/** The table options a table of `players` seats offers (teams need four). */
export function tableOptionRules(players: number): HouseRule[] {
  return TABLE_OPTION_RULES.filter((r) => players === 4 || r.id !== TEAM_PLAY);
}

/** The rule set's own house rules and the table options together, as the lobby lists them. */
export function allHouseRules(p: Pick<RuleProfile, 'houseRules' | 'players'>): HouseRule[] {
  return [...p.houseRules, ...tableOptionRules(p.players)];
}

/** Turn a host's choices into the table options (anything unset is off). */
export function tableOptionsFrom(choices: Record<string, string> | undefined, players: number): TableOptions {
  const on = (id: string) => choices?.[id] === 'on';
  return {
    selfDrawOnly: on(SELF_DRAW_ONLY),
    multipleWinners: on(MULTIPLE_WINNERS),
    winnerTakesAll: on(WINNER_TAKES_ALL),
    teams: players === 4 && on(TEAM_PLAY),
    ladder: on(CUMULATIVE_LEADERBOARD),
  };
}

/** Does this table's result join the cumulative leaderboard? */
export const usesLadder = (houseRules: Record<string, string> | undefined) => houseRules?.[CUMULATIVE_LEADERBOARD] === 'on';

/** Team play at a four-seat table: partners sit across from each other. */
export const usesTeams = (houseRules: Record<string, string> | undefined, players = 4) => players === 4 && houseRules?.[TEAM_PLAY] === 'on';

/** Which team a seat is on (0: East and West, 1: South and North). */
export const teamOf = (seat: number) => seat % 2;

/** The seat across the table. */
export const partnerOf = (seat: number, players = 4) => (seat + 2) % players;

/** Each team's total from the seats' scores: [East–West, South–North]. */
export function teamTotals(scores: number[]): [number, number] {
  const t: [number, number] = [0, 0];
  scores.forEach((s, seat) => (t[teamOf(seat)] += s));
  return t;
}
