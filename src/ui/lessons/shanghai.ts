// Academy lesson: Shanghai Mahjong, following JongClub's `shanghai` profile
// (src/engine/rules/shanghai.ts): the baida game. 144 tiles with flowers, a
// baida turned up each hand (the other copies of the tile turned up are
// wild), a base counted in flowers (two, plus flowers, honour pungs and
// kongs), doubles up to a cap of five, everyone paying on a self-draw and the
// discarder alone on a discard. The worked example was checked against
// shanghaiScore and shanghaiPayments.

import { S, Q, type Lesson } from '../lessonKit';

export const shanghaiLesson: Lesson = {
  id: 'shanghai',
  title: 'Shanghai Mahjong',
  scenes: [
    S('Welcome to Shanghai', 'Welcome to the Bund parlour! Shanghai Mahjong is played in homes and parlours all over the city. There are a few Shanghai styles, and ours is the baida game. Compared with Classic, a wild tile called the baida changes every hand, flowers build your base, and doubles multiply it. Let me show you!', { tiles: ['F1', 'F5', '5p', 'EEE'] }),
    S('The tiles', 'You’ll know every tile here: the three suits, the winds, the dragons, and eight flowers and seasons. That’s one hundred and forty-four. You call Chi for a chow, Peng for a pung, Gang for a kong, and Hu to win, or Zimo on your own draw. The goal is four sets and a pair, or seven pairs.', { tiles: ['123m', '456p', '789s', 'EEE', 'RdRd'] }),
    S('The baida', 'Baida means a hundred matches. After the deal, a tile is turned up from the back of the wall, and it stays out of play. If it’s a flower, it’s set aside and another is turned up. The other three copies of that tile are baida, wild for any tile in your hand.', { tiles: ['7s', '777s'] }),
    S('Using the baida', 'A baida can finish a pung, a chow or the pair, but only in your own hand, never in a claimed set. You may throw one away, but a discarded baida is dead, and nobody can claim it.', { tiles: ['33m 7s', '46p 7s', '9s 7s'] }),
    S('Flowers make the base', 'In Shanghai, the base is counted in flowers, called hua. Every win starts at two. Add one for each flower or season you hold. A pung of winds or dragons adds one if you claimed it, or two if it’s concealed. And every kong adds one more on top.', { tiles: ['F1', 'F6', 'NNN', 'GdGdGdGd'] }),
    S('Then the doubles', 'Each double doubles the base. Self-drawn is one. A clean win, with no baida in your hand, is one. All pungs, half flush, which is one suit with honours, seven pairs, and a win on a kong’s replacement tile are one each. A full flush is two. Five doubles is the cap.', { tiles: ['123p', '456p', '789p', 'EEE', '55p'] }),
    S('Who pays', 'Win by self-draw, and all three players pay you the score. Win on a discard, and the discarder alone pays. A word on clean wins: a baida standing for itself, as its own tile, still counts as clean. Everyone starts with one thousand points.', { tiles: ['5p'] }),
    S('An example', 'You’ve claimed a pung of East, and the rest is Circles. You hold two flowers, no baida, and you win on a discard. Base two, flowers two, East pung one: five. Clean win, one double. Half flush, one. Five doubled twice is twenty, and the discarder pays you twenty. Draw it yourself, and each player pays forty.', { tiles: ['EEE', '123p', '456p', '789p', '55p', 'F1', 'F5'] }),
    S('Our table', 'One honest note. Shanghai has several styles, and families play them all differently. This is JongClub’s own reading of the baida game. The host can ask for a minimum of two or four flowers to win, with honour pungs and kongs counting too. By default there’s none. Now, shall we try your test?', { board: 'seats' }),
  ],
  quiz: [
    Q('The tile turned up is the three of Bamboo. Which tiles are baida?', [['The other three threes of Bamboo', '3s'], ['The fours of Bamboo', '4s'], ['Every Bamboo tile', '123s']], 0, 'The baida is the tile turned up itself: its other three copies are wild.'),
    Q('What base does every Shanghai win start from?', ['Two', 'Five', 'Nothing'], 0, 'Every win starts at two, and flowers, honour pungs and kongs add to it.'),
    Q('You hold a concealed pung of Green Dragons. What does it add to the base?', [['Two', 'GdGdGd'], ['One', 'GdGdGd'], ['Nothing', 'GdGdGd']], 0, 'An honour pung adds one if you claimed it, and two if it’s concealed.'),
    Q('You win on a discard. Who pays?', ['The discarder alone', 'Everyone, the same amount', 'The discarder double, the others once'], 0, 'On a discard the discarder alone pays. On a self-draw, all three pay.'),
    Q('Can a baida help you claim a discard for a pung?', ['No, it works only in your own hand', 'Yes, at any time', 'Only when you’re ready'], 0, 'The baida is wild only in your concealed hand, never in a claimed set.'),
  ],
};
