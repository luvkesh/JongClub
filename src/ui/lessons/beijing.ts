// Academy lesson: Beijing Mahjong, following JongClub's `beijing` profile
// (src/engine/rules/beijing.ts): 136 tiles with no flowers, the hun'er (a
// tile turned up after the deal, the next tile in order wild in the concealed
// hand only, dead when discarded), doubles on a one-point base capped at
// five, everyone paying on a self-draw and the discarder paying for the
// table. Said plainly: local tables differ, and this is JongClub's reading.
// The worked example was checked against beijingScore and beijingPayments.

import { S, Q, type Lesson } from '../lessonKit';

export const beijingLesson: Lesson = {
  id: 'beijing',
  title: 'Beijing Mahjong',
  scenes: [
    S('Welcome to Beijing', 'Welcome to the hutong courtyard! Beijing Mahjong is played in courtyards, parks and homes all over the capital. Compared with Classic, there are no flowers, and in every hand one tile becomes wild. It’s called the hun’er. Each double doubles a single point, and if you throw the winning tile, you pay for the whole table. Let me show you!', { tiles: ['123m', '555p', '789s', 'RdRdRd', 'EE'] }),
    S('New words', 'There are one hundred and thirty-six tiles: the three suits, the winds and the dragons. You call Chi for a chow, from the player on your left, Peng for a pung and Gang for a kong. When you win, you call Hu, or Zimo on your own draw. The goal is the one you know, four sets and a pair, or seven pairs.', { tiles: ['123m', '555p', '9999s'] }),
    S('Turning up the hun’er', 'After the deal, one tile is turned up from the back of the wall, and that tile is out of play. The hun’er is the next tile in order. So if a four of Circles is turned up, the fives of Circles are wild for the whole hand. Keep an eye on them!', { tiles: ['4p', '5p'] }),
    S('Round the ring', 'Counting wraps around. If a nine is turned up, the one of that suit is wild. Winds go East, South, West, North, and back to East. Dragons go round in a ring too: Red, then Green, then White, then back to Red. So a White Dragon turned up makes the Red Dragon wild.', { tiles: ['9m', '1m', 'N', 'E', 'Wd', 'Rd'] }),
    S('Using the hun’er', 'In your own concealed hand, a hun’er can stand for any tile. It can finish a pung, a run or your pair. But it never goes into a claimed set, so you can’t call a pung with one. You may throw a hun’er away, but a discarded hun’er is dead, and nobody can claim it.', { tiles: ['RdRd 5p', '46s 5p', 'E 5p'] }),
    S('Counting doubles', 'A hand is worth one point, doubled for each double. Your own draw is one. A plain win, with no hun’er used as a wild, is one more. All pungs is one, half flush is one, and full flush is two. Seven pairs is one, each dragon pung is one, and so is winning on a kong’s replacement tile. Five doubles is the cap: thirty-two points.', { tiles: ['111s', '333s', '555s', 'RdRdRd', '99s'] }),
    S('Who pays', 'Win on your own draw, and all three players pay you the hand’s points. Win on a discard, and the discarder pays for the whole table, three times the hand’s points. They call it dian pao bao. So think hard before that risky discard!', { tiles: ['5p'] }),
    S('An example', 'You called a pung of Red Dragons, and the rest is Bamboo, with no hun’er in your hand. You win on a discard. Plain win, one. Half flush, one. Dragon pung, one. Three doubles make eight points, so the discarder pays twenty-four. If a hun’er had been in your hand, there’s no plain win: four points, and twelve to pay.', { tiles: ['RdRdRd', '123s', '456s', '777s', '99s'] }),
    S('Our table', 'One honest note. Beijing rules differ from courtyard to courtyard, so this is JongClub’s own reading. Some tables pay extra for a hand without the hun’er, or add more doubles. At ours, the host can set the cap at four, five or six doubles. Now, shall we try your test?', { board: 'seats' }),
  ],
  quiz: [
    Q('A three of Bamboo is turned up after the deal. Which tile is the hun’er?', [['The four of Bamboo', '4s'], ['The three of Bamboo', '3s'], ['The two of Bamboo', '2s']], 0, 'The hun’er is the next tile in order after the one turned up, so a three makes the four wild.'),
    Q('The North wind is turned up. Which tile is wild?', [['East', 'E'], ['South', 'S'], ['North', 'N']], 0, 'Winds go round in a ring, East, South, West, North, so after North comes East.'),
    Q('Someone discards a hun’er. Can you claim it?', ['No, a discarded hun’er is dead', 'Yes, for any set', 'Only to win'], 0, 'A discarded hun’er is dead. Nobody can claim it, not even to win.'),
    Q('Can a hun’er go into a pung you claim from a discard?', ['No, only into your concealed hand', 'Yes, at any time', 'Only for a dragon pung'], 0, 'The hun’er works only in your concealed hand, never in a claimed set.'),
    Q('A three double hand wins on a discard. What does the discarder pay?', ['Twenty-four', 'Eight', 'Sixteen'], 0, 'One point doubled three times is eight, and the discarder pays for the whole table: three times eight is twenty-four.'),
  ],
};
