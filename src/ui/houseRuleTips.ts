// What each house rule changes, for its label's tooltip in the table setup
// (lobby.ts). Rules whose options already say it all have no tip.

import { tr } from '../i18n';

const TIPS: Record<string, () => string> = {
  indiaRounds: () => tr('Which India Rules rounds the match plays: East with passports, South with Small Cards, West with goulash, North East’s choice, or Classic: sets and a pair without passports in every round.'),
  passport: () => tr('In the East round: whether every win must be a passport hand, or any hand of four sets and a pair also wins.'),
  minValue: () => tr('The smallest hand value that may win. A complete hand worth less cannot be declared.'),
  dealerRetention: () => tr('When the dealer deals again instead of the deal passing to the next player.'),
  flowers: () => tr('Adds the eight flowers and seasons. A flower is set aside when drawn and replaced from the wall, and your own flower and season score.'),
  mixedSets: () => tr('Whether a set may mix suits. Allowed adds mixed pungs (crochet), mixed chows and knitted sets, in a concealed hand only.'),
  mixedHands: () => tr('Extra points for hands built from matching or stepped sets across the three suits.'),
  specialRounds: () => tr('Gives each wind round its own hands: passports in East, the Small Card in South, goulash in West and the Big Card in North. The rules explain each one.'),
  goulashExchange: () => tr('Before a goulash hand, everyone passes three tiles: right, then across, then left.'),
  goulashJokers: () => tr('Adds eight jokers to goulash hands. A joker can stand in for a tile in a set, never in the pair.'),
  goulashStakes: () => tr('Double: a hand won during a goulash pays twice as much.'),
  goulashPot: () => tr('At each wall game every player puts this much into a pot, and the next winner takes it all.'),
  openTanyao: () => tr('Whether All Simples (no 1s, 9s, winds or dragons) still scores after you have called tiles.'),
  redFives: () => tr('Red fives in the set. Each red five in your winning hand adds one han, like a dora.'),
  abortive: () => tr('Whether a hand is called off and dealt again on nine different terminals and honours, four of the same wind discarded, four kongs or four riichi.'),
  tripleRon: () => tr('What happens when three players can all win on the same discard.'),
  nagashi: () => tr('At a drawn hand, a player who discarded only terminals and honours, none of them called, is paid as for a mangan.'),
  scoring: () => tr('Count hands in tai, the Taiwan way, or with the points on the Dubai club card.'),
  liGu: () => tr('Seven pairs plus one pung, all concealed: a special winning hand worth 8 tai.'),
  chow: () => tr('Whether you may claim the discard of the player on your left to make a run.'),
  sevenPairs: () => tr('Whether a hand of seven pairs wins.'),
  payout: () => tr('Who pays when someone wins on a discard: mostly the discarder, only the discarder, or everyone the same.'),
  jokers: () => tr('Adds eight joker tiles that can stand in for other tiles.'),
  jokerCalls: () => tr('Whether a pung you claim from a discard may include one joker.'),
  cleanBonus: () => tr('An extra phán for winning without any jokers in your hand.'),
  jokerPair: () => tr('Whether a joker may stand in for a tile in the pair.'),
  bites: () => tr('On the spot: when you complete an animal pair (cat and mouse, or rooster and centipede), every other player pays you straight away, and all four animals pay more. Otherwise animals only add tai to a win.'),
  kongMoney: () => tr('On the spot: every other player pays you when you make a kong, double for a concealed kong.'),
  minFan: () => tr('The fan a hand must score to win. Official MCR needs 8.'),
  cap: () => tr('The most a single hand can score. Anything above counts as the cap.'),
  selfDraw: () => tr('What a self-drawn win adds: one more base payment, or one more fan.'),
  riichi: () => tr('Lets you declare ready with a concealed hand. Your hand is then locked, and the declaration scores 1 point.'),
  characters: () => tr('Three-player set: take out all the characters, or keep only their 1s and 9s.'),
  uma: () => tr('A placement bonus at the end of the match: the top places gain points and the bottom places lose them.'),
  limit: () => tr('The most a single hand can score.'),
  minFlowers: () => tr('How many flowers you must have set aside before you may win.'),
  closed: () => tr('Whether you need a called set to win, or may also win concealed by drawing the winning tile yourself.'),
};

/** The tooltip for a house rule's label, or null when its options explain themselves. */
export function houseRuleTip(id: string): string | null {
  return TIPS[id]?.() ?? null;
}
