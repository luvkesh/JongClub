// Academy lesson: Guangdong push-down, following JongClub's `guangdong`
// profile (src/engine/rules/guangdong.ts): 136 tiles with no flowers, no chow
// calls (runs held in the hand still count), no minimum, fan doubling a
// two-point base up to a five-fan cap, the discarder alone paying, a
// self-draw paid double by all three, and the kong's owner paying for the
// table when a kong is robbed. Said plainly: ghost tiles and buying horses
// are not played. The worked example was checked against guangdongScore.

import { S, Q, type Lesson } from '../lessonKit';

export const guangdongLesson: Lesson = {
  id: 'guangdong',
  title: 'Guangdong push-down',
  scenes: [
    S('Welcome to Guangzhou', 'Welcome to the Canton teahouse! Guangdong push-down is the everyday game of Guangzhou and the Pearl River Delta, and the one you’ll find on Cantonese phone apps. Compared with Classic, there are no flowers, you can’t call a chow, and any complete hand can be pushed down to win. Let me show you!', { tiles: ['123m', '555p', '789s', 'RdRdRd', 'EE'] }),
    S('New words', 'Push-down simply means you lay your hand down and win. You call Pung for a pung, Gong for a kong, and Wu to win, or Zi Mo on your own draw. There’s no chow call here. But runs you build in your own hand still count, just as in Classic.', { tiles: ['555p', '9999m', '345s'] }),
    S('No minimum', 'There’s no minimum at all. Any complete hand wins: four sets and a pair, seven pairs, or thirteen orphans. A hand with no fan is a chicken hand, and it still wins. So speed matters here, and everyone races to go out first.', { tiles: ['123m', '456p', '789s', '777p', '55m'] }),
    S('Counting fan', 'Each fan doubles the hand. All pungs is one fan, and so is half flush, one suit plus honours. Full flush is two, and so are seven pairs, and terminals and honours. Small three dragons is two, and small four winds is three. Here’s a surprise: a single dragon pung, or your own wind, scores nothing at all.', { tiles: ['123s', '456s', '789s', '111s', '55s'] }),
    S('Lucky finishes', 'A few finishes add one fan each: winning on a kong’s replacement tile, robbing a kong, and winning on the very last tile of the wall. And the great limit hands, like thirteen orphans, big three dragons or nine gates, go straight to the cap. At our table, that’s five fan.', { tiles: ['19m', '19p', '19s', 'ESWN', 'RdGdWdWd'] }),
    S('Points and paying', 'A hand is worth two points, doubled for each fan. So no fan is two points, one fan is four, and the five fan cap is sixty-four. Win on a discard, and only the discarder pays. Win by self-draw, and all three players pay you double.', { tiles: ['5p'] }),
    S('Robbing a kong', 'One sharp rule. If you win by robbing a kong, the player who tried to add to their pung pays for the whole table, just as if you’d drawn the tile yourself. So think twice before you add a fourth tile to a pung!', { tiles: ['555p', '5p'] }),
    S('An example', 'You called a pung of East, and the rest is Circles, all pungs. You win on a discard. All pungs, one. Half flush, one. The East pung adds nothing. Two fan makes eight points, and the discarder pays you eight. Draw that last tile yourself, and each player pays you sixteen.', { tiles: ['EEE', '222p', '444p', '777p', '99p'] }),
    S('Our table', 'One honest note. Many towns add a ghost tile, a wild card, or a side bet called buying horses. Those local extras aren’t played at our table. Flowers are off, unless the host turns them on at one fan each, and the host can set the cap at four, five or six fan. Now, shall we try your test?', { board: 'seats' }),
  ],
  quiz: [
    Q('What is the smallest hand that can win in Guangdong push-down?', ['Any complete hand, even with no fan', 'A hand worth at least three fan', 'A hand with a dragon pung'], 0, 'There’s no minimum. Any complete hand can be pushed down, even a chicken hand.'),
    Q('Can you call a discard to make a run?', ['No, only pungs and kongs', 'Yes, from the player on your left', 'Only when you’re ready'], 0, 'There’s no chow call in push-down, but runs you build in your own hand still count.'),
    Q('A two fan hand wins on a discard. What does the discarder pay?', ['Eight', 'Four', 'Sixteen'], 0, 'Two points, doubled twice, is eight, and only the discarder pays.'),
    Q('You win by self-draw. Who pays?', ['All three players, each paying double', 'Only the player on your left', 'All three players, each paying half'], 0, 'On a self-draw, all three players pay you double the hand’s points.'),
    Q('What is a single pung of Red Dragons worth here?', [['Nothing on its own', 'RdRdRd'], ['One fan', 'RdRdRd'], ['Two fan', 'RdRdRd']], 0, 'A lone dragon or wind pung scores no fan in push-down. Two dragon pungs and a dragon pair make small three dragons, worth two.'),
  ],
};
