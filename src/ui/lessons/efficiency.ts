// Academy, Mastering Mahjong (Level 9): building a fast hand. Blocks (sets,
// partial sets, pairs, loose tiles), counting how many steps a hand is from
// ready, counting the tiles that help, the five-block idea, and the order to
// let tiles go. Holds at every four-sets-and-a-pair table. The step counts in
// the examples are checked against the engine's shanten in test/lessons.test.ts.

import { S, Q, type Lesson } from '../lessonKit';

export const efficiencyLesson: Lesson = {
  id: 'efficiency',
  title: 'Building a fast hand',
  scenes: [
    S('From player to expert', 'Welcome to Mastering Mahjong! You know the rules, and you know the basics of good play. Now we go deeper, one skill at a time. Tonight, speed: how experts build a hand faster than everyone else.', {
      list: [
        { tiles: '45s', title: 'Level 9 · Building a fast hand', text: 'Blocks, steps from ready, and tiles that help.' },
        { tiles: '46s', title: 'Level 10 · Reading waits', text: 'Every winning shape, and how to pick the best one.' },
        { tiles: 'Wd Wd Wd', title: 'Level 11 · Defence', text: 'Spotting danger, and throwing safely.' },
        { tiles: 'RdRdRd', title: 'Level 12 · Value and the long game', text: 'Fast or big, and playing the whole match.' },
      ],
    }),
    S('Think in blocks', 'Experts see a hand as blocks. A finished set is a block. Half a set, like four five, is a block. A pair is a block. Anything else is a loose tile, waiting to join something, or to be thrown away.', {
      cards: [
        { tiles: '123m', title: 'Finished set', alt: 'a whole block', text: 'Done. Leave it alone.' },
        { tiles: '45p', title: 'Half a set', alt: 'a partial', text: 'One tile away from a set.' },
        { tiles: 'EE', title: 'Pair', alt: 'a block too', text: 'Your pair, or half a pung.' },
        { tiles: 'N', title: 'Loose tile', alt: 'not a block', text: 'Joins nothing yet.' },
      ],
    }),
    S('Five blocks', 'A winning hand is four sets and a pair. That’s five blocks. So aim for exactly five. Fewer than five, and you need more tiles to join up. More than five, and one block will have to go anyway.', {
      hand: {
        title: 'Five blocks: the shape of every winning hand',
        groups: [
          { tiles: '123m', label: 'Block 1', sub: 'set' },
          { tiles: '456p', label: 'Block 2', sub: 'set' },
          { tiles: '78s', label: 'Block 3', sub: 'half a set', mark: 'hl' },
          { tiles: '45s', label: 'Block 4', sub: 'half a set', mark: 'hl' },
          { tiles: 'EE', label: 'Block 5', sub: 'pair' },
        ],
        facts: ['Two half-sets to fill', 'Fill one: ready. Fill both: Mahjong'],
      },
    }),
    S('Steps from ready', 'Experts always know how far they are. Count the tiles you still need before you’re ready, one tile from winning. Ready is zero steps. In Japan, this count is called shanten. At JongClub, your hand line shows it for you.', {
      table: {
        head: ['Hand', 'Steps from ready'],
        rows: [
          [{ tiles: '123m 456p 789s EE 45s' }, '0: ready, waiting on 3 or 6 Bamboo'],
          [{ tiles: '123m 456p 78s EE 45s N' }, '1: one more good tile and you’re ready'],
          [{ tiles: '123m 45p 78s EE 13s N W' }, '2: two good tiles to go'],
        ],
      },
    }),
    S('Tiles that help', 'Next, count the tiles that would move you a step closer. Four five of Bamboo is helped by a three or a six. Seven eight is helped by a six or a nine. That’s three numbers, four copies each: twelve tiles that help.', {
      hand: {
        title: 'One step from ready: which tiles help?',
        groups: [
          { tiles: '123m', label: 'Set' },
          { tiles: '456p', label: 'Set' },
          { tiles: '45s', label: 'Needs', sub: '3 or 6 Bamboo', mark: 'hl' },
          { tiles: '78s', label: 'Needs', sub: '6 or 9 Bamboo', mark: 'hl' },
          { tiles: 'EE', label: 'Pair' },
          { tiles: 'N', label: 'Loose', sub: 'throw it next' },
        ],
        facts: ['3, 6 or 9 of Bamboo', '3 numbers × 4 copies = 12 tiles help'],
      },
    }),
    S('Keep the shape with more', 'When two discards leave you the same steps from ready, keep the one with more tiles that help. Here, one two only takes a three: four tiles. Four five takes a three or a six: eight tiles. So throw from the one two.', {
      table: {
        head: ['Half a set', 'Finished by', 'Tiles that help'],
        rows: [
          [{ tiles: '45s', text: 'Two-sided' }, { tiles: '3s 6s' }, '8'],
          [{ tiles: '46s', text: 'Middle gap' }, { tiles: '5s' }, '4'],
          [{ tiles: '12s', text: 'Edge' }, { tiles: '3s' }, '4'],
          [{ tiles: '55s', text: 'Pair' }, { tiles: '5s' }, '2'],
        ],
      },
    }),
    S('Too many blocks', 'Say you hold six blocks: two sets, three half-sets and a pair. One must go. Cut the weakest half-set, the one with the fewest tiles that help. Throw it one tile at a time, starting with the one that connects least.', {
      hand: {
        title: 'Six blocks: one has to go',
        groups: [
          { tiles: '123m', label: 'Set' },
          { tiles: '456p', label: 'Set' },
          { tiles: '45s', label: 'Two-sided', sub: '8 tiles help' },
          { tiles: '78s', label: 'Two-sided', sub: '8 tiles help' },
          { tiles: '13p', label: 'Middle gap', sub: '4 tiles help', flag: 'Cut this one', mark: 'called' },
          { tiles: 'EE', label: 'Pair' },
        ],
      },
    }),
    S('The order to let go', 'Early in a hand, let tiles go in this order. First, honours you can’t score with. Then lonely ones and nines. Then lonely twos and eights. Keep middle tiles, dragons, and your own winds a little longer.', {
      table: {
        head: ['Order', 'Tile', 'Why'],
        rows: [
          ['1st', { tiles: 'N', text: 'A wind that scores nothing for you' }, 'It can only ever make a pung'],
          ['2nd', { tiles: '1p 9s', text: 'A lonely 1 or 9' }, 'Only one run can use it'],
          ['3rd', { tiles: '2m 8s', text: 'A lonely 2 or 8' }, 'Two runs can use it'],
          ['Keep', { tiles: '5p RdRd', text: 'Middle tiles, value honours' }, 'Fast to join, or worth points'],
        ],
      },
    }),
    S('How many pairs?', 'You need one pair, so keep one. Two pairs are lovely too: whichever one draws a match becomes a pung. But four or more pairs slow you down, unless you’re going for seven pairs. Then pairs are exactly what you want.', {
      table: {
        head: ['Pairs in your hand', 'What it means'],
        rows: [
          [{ tiles: 'EE' }, 'One: your pair is ready'],
          [{ tiles: 'EE 55s' }, 'Two: perfect. Either can grow into a pung'],
          [{ tiles: 'EE 55s 77p 22m' }, 'Four or more: slow, unless you aim for seven pairs'],
        ],
      },
    }),
    S('Speed habits', 'So every turn, count your steps, count the tiles that help, and keep five blocks. After a while, you won’t even need to count. You’ll just see it. Shall we try your test?', {
      list: [
        { tiles: '45s', title: 'Count your steps', text: 'How far from ready am I?' },
        { tiles: '3s 6s', title: 'Count the tiles that help', text: 'Keep the shapes that take more.' },
        { tiles: '13p', title: 'Five blocks', text: 'Too many? Cut the weakest.' },
      ],
    }),
  ],
  quiz: [
    Q('How many blocks does a winning hand have?', ['Five: four sets and a pair', 'Four', 'Seven'], 0, 'Four sets and a pair make five blocks.'),
    Q('Which half-set has the most tiles that help?', [['Four and five', '45s'], ['One and two', '12s'], ['Four and six', '46s']], 0, 'Four five is two-sided: a three or a six helps, up to eight tiles. The others take one number, four tiles.'),
    Q('Your hand is one step from ready. What does that mean?', ['One more good tile and you’re ready', 'You have won', 'You need two more pairs'], 0, 'One step from ready: one good tile makes you ready, then one more wins.'),
    Q('You hold six blocks. Which one goes?', [['The weakest half-set', '13p'], ['A finished set', '123m'], ['Your only pair', 'EE']], 0, 'Keep sets and your pair. Cut the half-set with the fewest tiles that help.'),
    Q('Early in the hand, which tile usually goes first?', [['A wind that scores nothing', 'N'], ['A five in the middle', '5p'], ['A pair of dragons', 'RdRd']], 0, 'A wind that isn’t yours can only make a pung, and scores nothing for you.'),
  ],
};
