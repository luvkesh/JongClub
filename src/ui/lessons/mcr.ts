// Academy lesson: Chinese Official Mahjong (MCR), following JongClub's `mcr`
// profile (src/engine/rules/mcr.ts): a fixed fan list, fan added (never
// doubled), eight fan to win with flowers not counted, the exclusion
// principle, and payments of an eight-point base from everyone plus the
// hand's fan from the discarder (or from everyone on a self-draw). The
// simplification (no "Last Tile" fan) is stated plainly.
// The worked example is checked in test/lessons.test.ts.

import { S, Q, type Lesson } from '../lessonKit';

export const mcrLesson: Lesson = {
  id: 'mcr',
  title: 'Chinese Official (MCR)',
  scenes: [
    S('The tournament game', 'Welcome to the tournament hall! Chinese Official Mahjong, often called MCR, is the formal ruleset used at championships in China, Europe and around the world. It’s built like Classic, four sets and a pair. What’s different? Every hand is scored from a fixed list of patterns, and you need eight points to win. Let me show you!', { tiles: ['234m', '234p', '234s', '789s', '55p'] }),
    S('New words', 'The calls are Chi for a chow, Peng for a pung, and Gang for a kong. The win is Hu, or Zimo on your own draw. The points are called fan, just like faan. But here, fan are added up, never doubled.', { tiles: ['345s', '555p', '9999m'] }),
    S('Eight to win', 'You need at least eight fan to win, and flowers don’t count toward that. Each flower adds one fan afterwards. So you plan your hand around patterns from the list, right from the start.', { tiles: ['F1', 'F5'] }),
    S('Some patterns', 'Here are a few to aim for. Mixed triple chow, the same run in all three suits, is eight. Mixed shifted chows is six. Half flush is six, and full flush is twenty-four. All chows is two. And a concealed hand, won on a discard, is two.', { tiles: ['234m', '234p', '234s'] }),
    S('No double counting', 'One golden rule. A big pattern never also scores the smaller patterns already inside it. Full flush, for example, already means no honours, so you don’t count both. The score card does this for you.', { tiles: ['123s', '456s', '789s', '111s', '55s'] }),
    S('Who pays', 'Every other player pays the winner a base of eight. On a discard, the discarder also pays the hand’s fan. On a self-draw, everyone does.', { tiles: ['5p'] }),
    S('An example', 'Same run in three suits, all chows, no calls, and you win on a discard. Mixed triple chow, eight. All chows, two. Concealed hand, two. No honours, one. Thirteen fan. The discarder pays eight plus thirteen, twenty-one, and the others pay eight each.', { tiles: ['234m', '234p', '234s', '789s', '55p'] }),
    S('Our table', 'JongClub plays the main fan list, knitted hands included. Only Last Tile, for winning on the fourth copy of a tile, isn’t scored. For practice, the host can drop the eight fan minimum. Now, shall we try your test?', { board: 'seats' }),
  ],
  quiz: [
    Q('How many fan do you need to win, by the official rules?', ['Eight, not counting flowers', 'One', 'Three, flowers included'], 0, 'Eight fan, and flowers don’t count toward the minimum.'),
    Q('How are MCR fan combined?', ['Added up', 'Each one doubles the score', 'Only the biggest counts'], 0, 'MCR fan are simply added up.'),
    Q('What is a mixed triple chow worth?', [['Eight fan', '234m 234p 234s'], ['Two fan', '234m'], ['Twenty-four fan', '234s']], 0, 'The same run in all three suits is eight fan.'),
    Q('You win a thirteen fan hand on a discard. What does the discarder pay?', ['Twenty-one', 'Thirteen', 'Eight'], 0, 'Everyone pays the base of eight, and the discarder adds the thirteen fan: twenty-one.'),
    Q('Your hand is a full flush. Do you also score no honours?', ['No, the bigger pattern includes it', 'Yes, always', 'Only on a self-draw'], 0, 'A big pattern never also scores the smaller ones inside it.'),
  ],
};
