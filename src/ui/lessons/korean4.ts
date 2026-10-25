// Academy lesson: Korean Mahjong for four players, following JongClub's
// `korean` profile (src/engine/rules/korean4.ts), which builds on the
// three-player `korean3` table: the whole set with flowers (144 tiles), four
// seats, East and South rounds of four hands, pung and kong calls but no chow
// calls, a free riichi worth a point, additive points (limit ten) with a
// two-point minimum that flowers never count toward, 100 a point, and the
// discarder paying all three shares. Korean tables vary, and the lesson says
// these are JongClub's table defaults.

import { S, Q, type Lesson } from '../lessonKit';

export const korean4Lesson: Lesson = {
  id: 'korean',
  title: 'Korean four-player',
  base: 'korean3',
  scenes: [
    S('Welcome to Busan', 'Welcome to Busan Harbour! Most Korean tables play three-handed, but when four friends sit down, they use the whole set. Compared with Classic, there’s no chow call, riichi is borrowed from Japan, and the points simply add up. Compared with three-player Korean, there’s a fourth seat and every tile is back. Korean tables vary, so these are JongClub’s table defaults. Let me show you!', { tiles: ['1m', '5m', '9m', 'F1'] }),
    S('The whole set', 'All the Characters return, from one to nine, beside the Dots, Bamboo, winds and dragons. The eight flowers come too, making one hundred and forty-four tiles. Flowers are set aside as soon as you draw them, and you take a replacement from the back of the wall.', { tiles: ['123456789m', 'F1', 'F5'] }),
    S('Four seats', 'Now there are four of you. If you’re East, South is on your right, West is across, and North is on your left. So North is a seat wind again. We play an East round and a South round, four hands each, and the dealer keeps the deal by winning.', { tiles: ['E', 'S', 'W', 'N'] }),
    S('Calls', 'The calls haven’t changed. Pung for three of a kind, Kong for four, but there’s no chow call. Runs you build in your own hand still count. And with three opponents, there are more discards to watch, and more to fear.', { tiles: ['555p', '9999s', '345m'] }),
    S('Riichi', 'Riichi works just as before. When your concealed hand is one tile from winning, you may declare it, as long as at least four tiles are left to draw. It costs nothing at our table, and it’s worth a point. Then your hand is locked: every tile you draw goes straight back out, unless it wins.', { tiles: ['234p', '678p', '345s', 'RdRd', '9s'] }),
    S('Counting points', 'Points add up, with no doubling. Self-draw, a concealed hand and riichi are one each. A pung of dragons, your seat wind or the round wind is one. All pungs, seven pairs and a mixed one suit are two. A pure one suit is five, and ten is the limit. You need two to win, and flowers pay a point each but never count toward those two.', { tiles: ['RdRdRd', 'NNN'] }),
    S('Paying', 'Each point is worth one hundred. Draw your winning tile yourself, and all three other players pay you. Win on a discard, and the discarder pays all three shares alone. That’s a heavy bill at a four-player table, so be careful what you throw.', { tiles: ['9s'] }),
    S('An example', 'A concealed hand with a pung of Red Dragons, you’ve declared riichi, and you win on a discard, with no flowers. Concealed, one. Riichi, one. Red Dragons, one. That’s three points, three hundred a share. The discarder pays all three shares: nine hundred.', { tiles: ['RdRdRd', '234p', '678p', '345s', '99s'] }),
    S('House rules', 'Korean tables differ, so the host may change the minimum, pay only your seat’s flowers or play with none, turn riichi off, allow chow from the player on your left, or have the discarder pay double while the others pay one share. Check the house rules before you sit down. Now, shall we try your test?', { tiles: ['F1', 'F5'] }),
  ],
  quiz: [
    Q('How many tiles are in the four-player Korean set?', ['One hundred and forty-four', 'One hundred and sixteen', 'One hundred and eight'], 0, 'The whole set comes back: one hundred and thirty-six tiles, plus the eight flowers.'),
    Q('Can you call a discard to make a run?', ['No, but runs in your own hand count', 'Yes, from any player', 'Only after riichi'], 0, 'There’s no chow call at our table, but runs you build in your hand are fine.'),
    Q('You win on a discard at our table. Who pays?', ['The discarder pays all three shares', 'Each player pays one share', 'The dealer pays double'], 0, 'The player who threw your winning tile pays for the whole table.'),
    Q('Your hand is worth one point, and you hold three flowers. Can you win?', ['No, flowers don’t count toward the two', 'Yes, that makes four points', 'Only with the North flower'], 0, 'Flowers add to what you’re paid, but never toward the two-point minimum.'),
    Q('What is riichi worth at our Korean table?', ['One point, and it costs nothing', 'Two points, and it costs one hundred', 'Nothing, it only locks your hand'], 0, 'At our table, riichi is free and adds one point to your hand.'),
  ],
};
