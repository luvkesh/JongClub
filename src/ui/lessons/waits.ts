// Academy, Mastering Mahjong (Level 10): reading waits. The five basic waits
// (two-sided, middle, edge, two pairs, single), longer shapes with more than
// one winning tile, counting live tiles, and choosing the better wait. The
// waits in the tables are checked against the engine in test/lessons.test.ts.

import { S, Q, type Lesson } from '../lessonKit';

export const waitsLesson: Lesson = {
  id: 'waits',
  title: 'Reading waits',
  scenes: [
    S('Your winning tiles', 'When your hand is ready, the tiles that finish it are your wait. A good wait wins more often. Tonight we’ll learn every shape of wait, and how to choose the best one.', {
      hand: {
        title: 'A ready hand and its wait',
        groups: [
          { tiles: '123m', label: 'Set' },
          { tiles: '456p', label: 'Set' },
          { tiles: '789s', label: 'Set' },
          { tiles: 'EE', label: 'Pair' },
          { tiles: '45s', label: 'The wait', sub: '3 or 6 Bamboo wins', mark: 'hl' },
        ],
      },
    }),
    S('Five basic waits', 'There are five basic waits. Two-sided, like four five, waiting on three or six. Middle, like four six, waiting on five. Edge, like one two, waiting on three. Two pairs, waiting on either one. And single, waiting to pair one lonely tile.', {
      table: {
        head: ['Wait', 'Shape', 'Wins on', 'Up to'],
        rows: [
          ['Two-sided', { tiles: '45s' }, { tiles: '3s 6s' }, '8 tiles'],
          ['Middle', { tiles: '46s' }, { tiles: '5s' }, '4 tiles'],
          ['Edge', { tiles: '12s' }, { tiles: '3s' }, '4 tiles'],
          ['Two pairs', { tiles: '55p 88s' }, { tiles: '5p 8s' }, '4 tiles'],
          ['Single', { tiles: 'E' }, { tiles: 'E' }, '3 tiles'],
        ],
      },
    }),
    S('Two pairs', 'With two pairs, either one can become your pung, and the other stays as the pair. So you win on a match for either. But each pair has only two copies left in the wall, so that’s four tiles at most.', {
      hand: {
        groups: [
          { tiles: '123m', label: 'Set' },
          { tiles: '456p', label: 'Set' },
          { tiles: '789s', label: 'Set' },
          { tiles: '55p', label: 'Pair', mark: 'hl' },
          { tiles: '88s', label: 'Pair', mark: 'hl' },
        ],
        facts: ['A 5 of Rings wins: 555p + 88s', 'An 8 of Bamboo wins: 888s + 55p'],
      },
    }),
    S('Waiting on the pair', 'A single wait looks poor, only three tiles. But it’s flexible. Whenever you draw a better tile, you can swap the lonely one out. And honours make good single waits late in the hand, when others feel safe throwing them.', {
      list: [
        { tiles: 'E', title: 'Single wait on East', text: 'Three left at most, but easy to swap.' },
        { tiles: 'W', title: 'Draw a West?', text: 'Keep whichever has more copies still hidden.' },
      ],
    }),
    S('Longer shapes', 'Some shapes hide more than one wait. Three four five six waits on three or six. Two three four five waits on two or five. And four four four five waits on three, five or six! Experts read these at a glance.', {
      table: {
        head: ['Shape', 'Wins on', 'How'],
        rows: [
          [{ tiles: '3456s' }, { tiles: '3s 6s' }, '33 + 456, or 345 + 66'],
          [{ tiles: '2345m' }, { tiles: '2m 5m' }, '22 + 345, or 234 + 55'],
          [{ tiles: '4445p' }, { tiles: '3p 5p 6p' }, '44 + 345, 444 + 55, or 44 + 456'],
          [{ tiles: '1112s' }, { tiles: '2s 3s' }, '111 + 22, or 11 + 123'],
        ],
      },
    }),
    S('Count the live tiles', 'A wait is only as good as the tiles still hidden. Four five of Bamboo waits on eight tiles. But if you can see two threes and a six on the table, only five are left. Always count what you can see.', {
      table: {
        head: ['Wait', 'On the table', 'Still hidden'],
        rows: [
          [{ tiles: '45s', text: 'Two-sided' }, { tiles: '3s 3s 6s' }, '5 of 8'],
          [{ tiles: '12s', text: 'Edge' }, '—', '4 of 4'],
        ],
      },
    }),
    S('Choose the better wait', 'Often you can choose your wait with your last discard. Keep the wait with more hidden tiles. If they’re close, prefer a tile others are likely to throw, like a lonely honour late in the hand, or a one or nine.', {
      list: [
        { tiles: '45s', title: 'More hidden tiles', text: 'Usually the best choice.' },
        { tiles: 'N', title: 'Tiles others throw', text: 'Late in the hand, honours and terminals come out.' },
        { tiles: '5m', title: 'Middle tiles', text: 'Others hold on to these, so they come out less.' },
      ],
    }),
    S('Your own discards', 'One more thing. In India Rules, you may still win on a tile you threw away yourself. But other players see your discards. If you threw a three and then wait on three and six, they may guess your wait, and hold on to those tiles.', { tiles: ['3s', '45s'] }),
    S('Waiting habits', 'So when you’re one step away: picture every wait you could choose, count what’s hidden, and pick the best. The waiting row at the table counts the hidden tiles for you. Shall we try your test?', {
      list: [
        { tiles: '45s', title: 'Name your waits', text: 'Two-sided, middle, edge, two pairs or single.' },
        { tiles: '3456s', title: 'Spot long shapes', text: 'Some hide two or three waits.' },
        { tiles: '3s 3s', title: 'Count what’s hidden', text: 'Choose the wait with more left.' },
      ],
    }),
  ],
  quiz: [
    Q('You wait on one two of Bamboo. Which tile wins?', [['Only 3 Bamboo', '3s'], ['3 or 6 Bamboo', '3s 6s'], ['1 or 2 Bamboo', '1s 2s']], 0, 'One two is an edge wait: only a three finishes the run.'),
    Q('Three four five six of Bamboo. Which tiles win?', [['3 or 6 Bamboo', '3s 6s'], ['Only 7 Bamboo', '7s'], ['2 or 7 Bamboo', '2s 7s']], 0, 'Add a three: three pair, four five six. Add a six: three four five, six pair.'),
    Q('Four four four five of Rings. Which tiles win?', [['3, 5 or 6 Rings', '3p 5p 6p'], ['Only 5 Rings', '5p'], ['4 or 5 Rings', '4p 5p']], 0, '345 or 456 with a four pair, or four four four with a five pair.'),
    Q('Your wait is four five of Bamboo. Two threes and one six are on the table. How many can still win?', ['Five', 'Eight', 'Three'], 0, 'Eight to begin with. Three are showing, so five are left.'),
    Q('Two waits have about the same number of tiles. Which is better late in the hand?', ['A tile others are likely to throw', 'A middle tile everyone needs', 'It never matters'], 0, 'Late on, honours and ones and nines are thrown more often, so they come to you sooner.'),
  ],
};
