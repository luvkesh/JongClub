// Academy lesson: Wuhan Mahjong, following JongClub's `wuhan` profile
// (src/engine/rules/wuhan.ts): the red dragon laizi game. 112 tiles (three
// suits and four Red Dragons), a laizi turned up each hand (the tile after the
// one turned up, nine wrapping to one), Red Dragons set aside as doubles, a
// pair of twos, fives or eights, one point doubled per double up to a cap of
// five, and everyone paying with the discarder paying double. The worked
// example was checked against wuhanScore and wuhanPayments.

import { S, Q, type Lesson } from '../lessonKit';

export const wuhanLesson: Lesson = {
  id: 'wuhan',
  title: 'Wuhan Mahjong',
  scenes: [
    S('Welcome to Wuhan', 'Welcome to the Hankou tea room! Wuhan Mahjong is the great game of Wuhan, on the Yangtze, played in tea rooms and on phone apps all over Hubei. Ours is the red dragon laizi style. Compared with Classic, there are only one hundred and twelve tiles, a wild tile called the laizi changes every hand, and Red Dragons double your win. Let me show you!', { tiles: ['1m', '5p', '9s', 'Rd'] }),
    S('The tiles', 'Our set is the three suits, Characters, Circles and Bamboo, plus the four Red Dragons. That’s one hundred and twelve tiles, with no winds, no other dragons and no flowers. You call Chi for a chow, Peng for a pung, Gang for a kong, and Hu to win, or Zimo on your own draw.', { tiles: ['123m', '456p', '789s', 'RdRdRdRd'] }),
    S('The laizi', 'After the deal, a tile is turned up from the back of the wall, and it stays out of play. The laizi is the next tile in order. Turn up the four of Bamboo, and every five of Bamboo is wild. A nine wraps round, so after the nine of Circles comes the one of Circles.', { tiles: ['4s', '5s', '9p', '1p'] }),
    S('Using the laizi', 'The laizi stands for any tile in your own hand: in a pung, a chow, or the pair. But never in a claimed set, so you can’t call a discard with it. You may throw a laizi away, but a discarded laizi is dead, and nobody can claim it.', { tiles: ['55m 5s', '46p 5s', '8m 5s'] }),
    S('Red Dragons', 'Red Dragons aren’t played in sets here. Draw one, and you set it aside at once and draw a replacement, a little like a flower. In Wuhan they call it a kong. Each Red Dragon you set aside doubles your hand if you win.', { tiles: ['Rd', 'Rd'] }),
    S('Twos, fives and eights', 'Here’s the big rule. Your pair must be twos, fives or eights, and in Wuhan they call it the general. There are three exceptions. All pungs, a full flush of one suit, and seven pairs may use any pair. And yes, the laizi can help to make the pair.', { tiles: ['22m', '55p', '88s'] }),
    S('Counting doubles', 'A hand is worth one point, doubled for each double. Self-drawn is one. A hard win, with no laizi in your hand, is one. All pungs, seven pairs, and a win on a kong’s replacement tile are one each. A full flush is two, and each Red Dragon is one more. The cap, called the gold top, is five doubles: thirty-two points.', { tiles: ['111s', '333s', '555s', '777s', '99s'] }),
    S('Who pays', 'Everyone pays the winner, even on a discard, and the discarder pays double. A word on hard wins: a laizi standing for itself, as its own tile, still counts as a hard win. A soft win with no doubles is still worth one point.', { tiles: ['5s'] }),
    S('An example', 'You win on a discard of the five of Bamboo, for your pair. There’s no laizi in your hand, and you set one Red Dragon aside. Hard win, one double. Red Dragon, one. Two doubles make four points. The other two pay you four, and the discarder pays eight. Draw it yourself, and it’s three doubles: eight points from everyone.', { tiles: ['234m', '567m', '888p', '345s', '55s', 'Rd'] }),
    S('Our table', 'One honest note. Hubei tables differ a great deal, and this is JongClub’s own reading of the red dragon laizi game. Everyone starts with two hundred points, and the host can set the gold top at four, five or six doubles. Now, shall we try your test?', { board: 'seats' }),
  ],
  quiz: [
    Q('The tile turned up is the nine of Circles. Which tile is the laizi?', [['The one of Circles', '1p'], ['The nine of Circles', '9p'], ['The eight of Circles', '8p']], 0, 'The laizi is the next tile in order after the one turned up, and a nine wraps round to the one.'),
    Q('You draw a Red Dragon. What happens?', [['Set it aside, draw again, and it doubles your win', 'Rd'], ['Keep it for a pung', 'RdRdRd'], ['Discard it at once', 'Rd']], 0, 'Red Dragons are set aside at once and replaced. Each one doubles your hand if you win.'),
    Q('Your hand has chows and pungs in two suits. Which pair can finish it?', [['A pair of fives', '55m'], ['A pair of sixes', '66m'], ['A pair of nines', '99m']], 0, 'The pair must be twos, fives or eights, except in all pungs, a full flush or seven pairs.'),
    Q('Someone discards the laizi. Can you claim it?', ['No, a discarded laizi is dead', 'Yes, for a pung', 'Only to win'], 0, 'A discarded laizi is dead. Nobody can claim it, and it never helps a claimed set.'),
    Q('A two double hand wins on a discard. What does the discarder pay?', ['Eight', 'Four', 'Two'], 0, 'Two doubles make four points. Everyone pays, and the discarder pays double: eight.'),
  ],
};
