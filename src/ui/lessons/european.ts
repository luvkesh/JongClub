// Academy lesson: European Classical, following JongClub's `european`
// profile (src/engine/rules/european.ts): the British club "points and
// doubles" game with 144 tiles, points for sets, pairs, self-draw and
// flowers, then doubles that multiply the total, a 1,000-point limit, and
// everyone paying the winner with East paying and receiving double.
// Simplified, and said so: the losers don't settle among themselves. The
// worked example was checked against europeanScore and europeanPayments.

import { S, Q, type Lesson } from '../lessonKit';

export const europeanLesson: Lesson = {
  id: 'european',
  title: 'European Classical',
  scenes: [
    S('Welcome to London', 'Welcome to the London club room! European Classical is the older points and doubles game, played in Britain and across Europe since the nineteen twenties. It’s like Classic, with flowers and seasons added. What’s different? Every set earns points, and then doubles multiply the whole total. Let me show you!', { tiles: ['RdRdRd', '555s', '999p', '234m', '22p'] }),
    S('Tiles and words', 'There are one hundred and forty-four tiles, with four flowers and four seasons. The calls are Chow, Pung and Kong, and you call Mah-Jong when you go out. There’s no single authority for these rules, so this is our table, drawn from the long-standing British club books.', { tiles: ['F1 F2 F3 F4', 'F5 F6 F7 F8'] }),
    S('Counting points', 'First, add up the points. Going out is twenty. An exposed pung of simples is two, and a concealed one is four. Pungs of ones, nines or honours are worth double that. A kong is four times a pung. A pair of dragons, or of your own or the round wind, is two. Self-drawn is two, and each flower or season is four.', { tiles: ['555s', '999p', '9999m'] }),
    S('Doubles', 'Then the doubles. Each one doubles the whole total. A pung of dragons, of your own wind, or of the round wind is one double each. So are your own flower and your own season, a hand with no chows, and a concealed hand. Half flush is one double, and full flush is three!', { tiles: ['123s', '456s', '789s', '111s', '55s'] }),
    S('Your own flower', 'Flowers and seasons are numbered one to four, to match the seats: East is one, South two, West three and North four. Hold the one that matches your seat, and that’s a double. Collect all four flowers, or all four seasons, and that bouquet is worth two doubles.', { tiles: ['F1 F2 F3 F4'] }),
    S('The limit', 'Scores stop at the limit, one thousand points at our table. Some hands go straight there: thirteen orphans, heads and tails, with only ones and nines, all honours, big three dragons, four winds, four kongs, four concealed pungs, nine gates, and heaven’s blessing, when East wins on the deal.', { tiles: ['111m', '999p', '111s', '999s', '11p'] }),
    S('Who pays', 'Everyone pays the winner the full score, whether you won on a discard or drew the tile yourself. East pays and receives double. One honest note: in the old game, the losers also settle their own hands with each other. We’ve simplified that away, so only the winner is paid.', { board: 'seats' }),
    S('An example', 'You sit South. You called pungs of Red Dragons and five Bamboo, and hold a concealed pung of nine Circles, a run and a pair. You have flower two. Win on a discard. Twenty, four, two and eight, plus four for the flower, is thirty-eight. The dragon pung and your own flower are two doubles: one hundred and fifty-two. East pays you three hundred and four.', { tiles: ['RdRdRd', '555s', '999p', '234m', '22p', 'F2'] }),
    S('House rules', 'The host can set the limit at five hundred, one thousand or two thousand points. Seven pairs isn’t allowed by tradition, but the host can allow it, for ten points. Now, shall we try your test?', { board: 'seats' }),
  ],
  quiz: [
    Q('How do you score a European Classical hand?', ['Add the points, then double for each double', 'Add up the doubles only', 'Look up the fan on a table'], 0, 'Add up the points for your sets, pairs and flowers first, then double the total once for every double.'),
    Q('How many points is a concealed pung of Red Dragons?', [['Eight', 'RdRdRd'], ['Two', 'RdRdRd'], ['Four', 'RdRdRd']], 0, 'Honours count like ones and nines: four exposed, eight concealed. And a dragon pung is a double too.'),
    Q('You sit West. Which flower is your own?', [['Flower three', 'F3'], ['Flower one', 'F1'], ['Flower four', 'F4']], 0, 'East is one, South two, West three and North four.'),
    Q('You win, and you’re not East. What does East pay you?', ['Double the score', 'The score', 'Nothing'], 0, 'East pays and receives double. The other two pay the score.'),
    Q('At our table, what do the losers pay each other?', ['Nothing, only the winner is paid', 'The difference between their hands', 'Double to East'], 0, 'In the old game the losers settle among themselves. We’ve simplified that away, so only the winner is paid.'),
  ],
};
