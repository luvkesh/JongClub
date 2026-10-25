// Academy lesson: Filipino Mahjong, following JongClub's `filipino` profile
// (src/engine/rules/filipino.ts): 144 tiles with eight flowers, sixteen-tile
// hands of five sets and a pair, chow from the left, and points that add up,
// ten to the point (win, bunot, own flowers, sin flores, Escalera, todo pong,
// one suit, Siete Pares, agaw). No minimum. Self-draw: everyone pays; discard:
// the discarder alone pays. Said plainly: there is no formal rulebook, and the
// jackpot is not played. The worked example was checked against
// filipinoScore and filipinoPayments.

import { S, Q, type Lesson } from '../lessonKit';

export const filipinoLesson: Lesson = {
  id: 'filipino',
  title: 'Filipino Mahjong',
  scenes: [
    S('Welcome to Manila', 'Welcome to the Manila veranda! Filipino Mahjong, or Pinoy Mahjong, is the family game of the Philippines, played at home tables and on phone apps. Compared with Classic, you hold sixteen tiles, not thirteen, and you build five sets and a pair. Flowers count, and the points simply add up. Let me show you!', { tiles: ['123p', '456p', '789p', '555s', '777m', '22s'] }),
    S('Our reading', 'There’s no formal rulebook, and every family plays a little differently. So our table is a reading of what Filipino tables and apps share. You call Chow from the player on your left, Pong for three of a kind, and Kang for four. Call Mahjong to win on a discard, and Bunot when you draw the winning tile yourself.', { tiles: ['345m', '777p', '2222s'] }),
    S('Flowers', 'There are one hundred and forty-four tiles, with eight flowers and seasons. Draw one, set it aside, and take a replacement. Each flower or season numbered for your seat is a point: East is one, South two, West three and North four. And if you win with no flowers at all, that’s sin flores, worth a point too.', { tiles: ['F1 F2 F3 F4', 'F5 F6 F7 F8'] }),
    S('Points add up', 'Every win is one point. Bunot, drawing the winning tile yourself, is one more. Escalera, one to nine of one suit as three runs, is two. Todo pong, all pungs, is two. A hand of one suit, with or without honours, is three. And robbing a kong is called agaw, worth one point.', { tiles: ['123p', '456p', '789p'] }),
    S('Siete Pares', 'With sixteen tiles, seven pairs needs a little extra. Siete Pares is seven pairs and a pung, all concealed, and it’s worth three points. Seven pairs on their own won’t make a hand here.', { tiles: ['11m', '33m', '55p', '77p', '99s', 'EE', 'RdRd', '222s'] }),
    S('Who pays', 'Each point is worth ten. There’s no minimum, so any complete hand wins, and the smallest win is worth ten. Win on a discard, and the discarder alone pays. Draw the tile yourself, and all three players pay you.', { board: 'seats' }),
    S('An example', 'You sit South, with flower two set aside. You hold one to nine of Circles as three runs, a pung of five Bamboo, a pung of seven Characters, and a two Bamboo. You draw the other two Bamboo yourself. The win is one, bunot one, your own flower one, and Escalera two. Five points makes fifty, and each player pays you fifty.', { tiles: ['123p', '456p', '789p', '555s', '777m', '22s', 'F2'] }),
    S('Our table', 'One honest note. Many tables add a jackpot, a pot for the first player to win five hands. The jackpot isn’t played at our table. Everyone starts with one thousand points. Now, shall we try your test?', { board: 'seats' }),
  ],
  quiz: [
    Q('How many tiles do you hold in Filipino Mahjong?', ['Sixteen, for five sets and a pair', 'Thirteen, for four sets and a pair', 'Fourteen, for seven pairs'], 0, 'You hold sixteen tiles and win with the seventeenth: five sets and a pair.'),
    Q('What is bunot?', ['Drawing the winning tile yourself', 'Claiming a discard to make a run', 'Winning with no flowers'], 0, 'Bunot is a self-draw. It’s worth a point, and everyone pays you.'),
    Q('What does sin flores mean?', [['Winning with no flowers at all', 'F1'], ['Holding every flower', 'F1'], ['Playing without seasons', 'F1']], 0, 'Sin flores means you won without drawing a single flower or season. It’s worth one point.'),
    Q('What is Siete Pares?', [['Seven pairs and a pung, concealed', '11m 33m 55p 77p 99s EE RdRd 222s'], ['Seven pairs, nothing more', '11m 33m 55p 77p 99s EE RdRd'], ['Seven runs in a row', '123m 456m 789m']], 0, 'With sixteen tiles, Siete Pares is seven pairs and a pung, all concealed. It’s worth three points.'),
    Q('You win on a discard. Who pays?', ['Only the discarder', 'All three players', 'The player on your left'], 0, 'On a discard, the discarder alone pays. On a self-draw, everyone pays.'),
  ],
};
