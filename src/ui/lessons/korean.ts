// Academy lesson: Korean Mahjong for three players, following JongClub's
// `korean3` profile (src/engine/rules/korean.ts): 116 tiles (Characters 2–8
// out, flowers in), three seats, pung and kong calls but no chow calls,
// a free riichi worth a point, additive points with a two-point minimum
// that flowers never count toward, and 100 a point. Korean tables vary, and
// the lesson says these are JongClub's table defaults.

import { S, Q, type Lesson } from '../lessonKit';

export const koreanLesson: Lesson = {
  id: 'korean3',
  title: 'Korean Mahjong',
  scenes: [
    S('Welcome to Seoul', 'Welcome to Seoul Indigo! In Korea, Mahjong is very often played by three friends, not four. Compared with Classic, the set is smaller, there are fewer calls, and the scoring is simple addition. Korean tables vary a lot, so what I’ll teach you are JongClub’s table defaults. Let me show you!', { tiles: ['1m', '9m', '5p', '5s'] }),
    S('A smaller set', 'Three players need fewer tiles. The Characters from two to eight are taken out, so only the one and the nine of Characters stay. Dots, Bamboo, winds and dragons are all kept, and the eight flowers come too. That makes one hundred and sixteen tiles.', { tiles: ['1m', '9m', '123456789p'] }),
    S('Three seats', 'You sit with two others. East deals, South sits on your right, and West on your left. Nobody sits across from you, so North is just an ordinary honour. We play an East round and a South round, three hands each, as the deal goes round.', { tiles: ['E', 'S', 'W', 'N'] }),
    S('Calls', 'You may call Pung for three of a kind, and Kong for four. But there’s no chow call here. Runs you build in your own hand still count. Flowers are set aside as soon as you draw them, and you take a replacement from the back of the wall.', { tiles: ['555p', '9999s', '345s'] }),
    S('Riichi', 'Korean play borrows riichi from Japan. When your concealed hand is one tile from winning, you may declare riichi. At our table it costs nothing, and it’s worth a point. But your hand is locked: every tile you draw goes straight back out, unless it wins.', { tiles: ['234p', '678p', '345s', 'RdRd', '9s'] }),
    S('Counting points', 'Points simply add up. Self-draw is one, a concealed hand is one, and riichi is one. Each pung of dragons, your seat wind or the round wind is one. All pungs, seven pairs and a mixed one suit are two each. A pure one suit is five, and ten points is the limit.', { tiles: ['RdRdRd', 'SSS'] }),
    S('Two to win', 'You need two points to win. Flowers pay a point each, but they never count toward those two. So a concealed hand won by self-draw always qualifies. Win a concealed hand on a discard, and you’ll want riichi, or another point.', { tiles: ['5p'] }),
    S('Paying', 'Each point is worth one hundred. Draw your winning tile yourself, and both other players pay you. Win on a discard, and the discarder pays both shares alone. So be careful what you throw.', { tiles: ['9s'] }),
    S('An example', 'A pung of Red Dragons in a concealed hand, and you draw the winning tile yourself, with two flowers set aside. Self-draw, one. Concealed, one. Red Dragons, one. That’s three, enough to win. The flowers add two more, so five points: five hundred from each player.', { tiles: ['RdRdRd', '234p', '678p', '345s', '99s'] }),
    S('House rules', 'Korean tables differ, so the host may change the minimum, the flowers, riichi, or allow chow calls from the player on your left. Check the house rules before you sit down. Now, shall we try your test?', { tiles: ['F1', 'F5'] }),
  ],
  quiz: [
    Q('Which tiles are taken out of the Korean set?', ['The Characters from two to eight', 'All the honours', 'The flowers and the dragons'], 0, 'Only the one and nine of Characters stay. Everything else is kept, flowers included.'),
    Q('Can you call a discard to make a run?', ['No, but runs in your own hand count', 'Yes, from any player', 'Only after riichi'], 0, 'There’s no chow call at our table, but runs you build in your hand are fine.'),
    Q('Do flowers count toward the two points you need to win?', ['No, they pay but don’t count', 'Yes, each one counts', 'Only your seat flower counts'], 0, 'Flowers add a point each to what you’re paid, but never toward the minimum.'),
    Q('You win a concealed hand on a discard, with nothing else. Can you claim it?', ['Not yet: one point is too few', 'Yes, any hand can win', 'Only while holding flowers'], 0, 'Concealed is one point, and you need two. Riichi, a dragon pung or a self-draw would get you there.'),
    Q('Who pays when you win on a discard?', ['The discarder pays both shares', 'Both players pay the same', 'Nobody pays'], 0, 'The player who threw your winning tile pays for the whole table.'),
  ],
};
