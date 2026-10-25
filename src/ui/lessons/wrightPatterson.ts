// Academy lesson: Wright-Patterson, following JongClub's `wright-patterson`
// profile (src/engine/rules/wrightPatterson.ts): a Western club game with 144
// tiles and no jokers, a Charleston before each hand (a second one if all
// agree), European Classical points and doubles to a 500-point limit, four
// concealed special hands, and everyone paying the winner with East paying
// and receiving double. Said plainly: it is not the American card game, and
// copies of the rulebook differ. The worked example was checked against
// wrightPattersonScore and europeanPayments.

import { S, Q, type Lesson } from '../lessonKit';

export const wrightPattersonLesson: Lesson = {
  id: 'wright-patterson',
  title: 'Wright-Patterson',
  scenes: [
    S('Welcome to the base', 'Welcome to the Officers’ Club! Wright-Patterson is the club game of an American air base in Ohio, carried by service families to bases all over the world. It’s a Western game, a lot like Classic, with flowers and seasons and four sets and a pair. What’s different? A Charleston before each hand, and scores in points and doubles. Let me show you!', { tiles: ['GdGdGd', '888s', '123s', '456s', '99s'] }),
    S('Not the card game', 'Don’t mix it up with American Mah Jongg. There’s no yearly card here, and no jokers at all. There are one hundred and forty-four tiles, and you call Chow, Pung and Kong, and Mah Jongg to win. Copies of the rulebook differ from base to base, so this is our reading of it.', { tiles: ['F1 F2 F3 F4', 'F5 F6 F7 F8'] }),
    S('The Charleston', 'Before each hand, everyone passes three tiles: to the right, then across, then to the left. That’s the Charleston. Then everyone votes. If all four players agree, you pass again: left, across, right. Pass what you don’t need, and watch what comes back to you.', { tiles: ['9p', 'Rd', '1s'] }),
    S('Counting points', 'Scoring works just like our European Classical table. First add up the points. Going out is twenty. A pung of simples is two exposed, or four concealed. Ones, nines and honours are worth double that, and a kong is four times a pung. A pair of dragons, or of your own or the round wind, is two. Self-drawn is two, and each flower or season is four.', { tiles: ['555s', '999p', '9999m'] }),
    S('Doubles', 'Then the doubles, each one doubling the whole total. A pung of dragons, of your own wind, or of the round wind. Your own flower, your own season, no chows, a concealed hand, or half flush. Those are one double each, and full flush is three. Scores stop at the limit, five hundred points at our table.', { tiles: ['123s', '456s', '789s', '111s', '55s'] }),
    S('Special hands', 'Now the fun part: named special hands, all concealed. Heavenly Twins is seven pairs, worth half the limit. Knitting is seven knits. A knit is the same number in two suits, like one Characters with one Circles, and you may use only two suits. That’s half the limit too.', { tiles: ['1m 1p', '3m 3p', '4m 4p', '5m 5p', '6m 6p', '8m 8p', '9m 9p'] }),
    S('Straight to the limit', 'Two special hands go straight to the limit. Triple Knitting is four mixed pungs, each one number in all three suits, plus a knit pair. Wriggling Snake is one to nine of one suit, one of each wind, and any one of those tiles again. The classic limit hands, like thirteen orphans and big three dragons, score the limit too.', { tiles: ['123456789p', 'ESWN', '5p'] }),
    S('Who pays', 'Everyone pays the winner the full score, whether you won on a discard or drew the tile yourself. East pays double, and when East wins, everyone pays East double. Just as at our European Classical table, the losers don’t settle among themselves.', { board: 'seats' }),
    S('An example', 'You sit South. You called a pung of Green Dragons, and hold a concealed pung of eight Bamboo, two runs and a pair, all Bamboo. You draw the winning tile yourself. Twenty, four, four and two make thirty. The dragon pung and half flush are two doubles: one hundred and twenty. East pays you two hundred and forty, and the others pay one hundred and twenty.', { tiles: ['GdGdGd', '888s', '123s', '456s', '99s'] }),
    S('Our table', 'The host can set the limit at three hundred, five hundred or one thousand points, and everyone starts with two thousand. Remember, copies of the rulebook differ, so another base may play it a little differently. Now, shall we try your test?', { board: 'seats' }),
  ],
  quiz: [
    Q('What happens before each hand at a Wright-Patterson table?', ['A Charleston: three tiles right, across, then left', 'Everyone takes a joker from the wall', 'East swaps three tiles with the wall'], 0, 'Before each hand comes a Charleston: three tiles right, across, then left. If everyone agrees, you pass again: left, across, right.'),
    Q('How many jokers are in a Wright-Patterson set?', ['None at all', 'Eight', 'Four'], 0, 'It’s a Western game, not the American card game. There are no jokers, just one hundred and forty-four tiles with flowers and seasons.'),
    Q('What is Heavenly Twins worth?', [['Half the limit', '11m 33m 55p 77p 99s EE RdRd'], ['The limit', '11m 33m 55p 77p 99s EE RdRd'], ['Twenty points', '11m 33m 55p 77p 99s EE RdRd']], 0, 'Heavenly Twins, seven concealed pairs, is worth half the limit. So is Knitting.'),
    Q('Which hand is a Wriggling Snake?', [['One to nine of a suit, each wind, and one tile again', '123456789p ESWN 5p'], ['Seven pairs of one suit', '11p 22p 33p 55p 66p 77p 99p'], ['Four kongs and a pair', '1111m 5555p 9999s EEEE RdRd']], 0, 'Wriggling Snake is one to nine of one suit, one of each wind, and any one of those tiles again. It scores the limit.'),
    Q('Your hand scores one hundred and twenty, and you’re not East. What does East pay you?', ['Two hundred and forty', 'One hundred and twenty', 'Sixty'], 0, 'East pays and receives double. The other two players pay the score.'),
  ],
};
