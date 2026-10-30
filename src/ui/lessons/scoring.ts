// Academy lesson (Foundations, Level 3): scoring in India Rules, the East
// round's flat payments that the Classic style plays in every round
// (eastScore, indiaPayments and flowerPayments in src/engine/rules/india.ts):
// a normal hand 500, concealed 1,000, fully concealed 2,000, paid by each other
// player whoever threw the tile; East pays and receives double; flowers and
// seasons are paid by everyone, win or draw, East paying the same. The worked
// examples are checked against the engine in test/lessons.test.ts. Chinese
// Classical's faan moved to its own lesson (lessons/classic.ts).

import { S, Q, type Lesson } from '../lessonKit';

export const scoringLesson: Lesson = {
  id: 'scoring',
  title: 'Scoring in India Rules',
  scenes: [
    S('Why keep score?', 'Winning is lovely. And in India Rules, how you win decides what you’re paid. There’s nothing to add up in your hand. A win pays a fixed amount, and the more of your hand you keep hidden, the more it pays. Let me show you!', { tiles: ['123m', '4m 5s 6p', '9m 9s 9p', 'RdRdRd', 'EE'] }),
    S('Points to start', 'Everyone starts with thirty-five thousand points. At a club table they’re tokens, of ten thousand, one thousand, five hundred and one hundred. At JongClub we count the points for you.', {
      table: {
        head: ['Token', 'Each player gets', 'Worth'],
        rows: [
          ['10,000', '2', '20,000'],
          ['1,000', '9', '9,000'],
          ['500', '10', '5,000'],
          ['100', '10', '1,000'],
          ['Total', '', '35,000'],
        ],
      },
    }),
    S('Three kinds of win', 'There are three kinds of win. If anything in your hand is face up, it’s a normal hand, worth five hundred. Nothing face up is a concealed hand, worth a thousand, even if the winning tile was a discard. And if you drew every tile yourself, the last one too, it’s fully concealed: two thousand.', {
      table: {
        head: ['Your win', 'What it means', 'Each player pays'],
        rows: [
          [{ tiles: '777p', text: 'Normal hand' }, 'You called a tile, so a set is face up', '500'],
          [{ tiles: '123m', text: 'Concealed hand' }, 'Nothing face up. The winning tile may be a discard', '1,000'],
          [{ tiles: '5p', text: 'Fully concealed' }, 'Every tile from the wall, the winning tile too', '2,000'],
        ],
      },
    }),
    S('Everyone pays the winner', 'When you win, each of the other three players pays you. It doesn’t matter who threw the winning tile. Everyone pays the same, so nobody is punished for one unlucky discard.', { board: 'seats' }),
    S('East pays double', 'Here’s the big one. East always pays and receives double. When East wins, everyone pays East twice as much. When someone else wins, East pays them twice as much, and the other two pay the usual amount. That’s why being East is so exciting!', {
      table: {
        head: ['A normal hand', 'East pays', 'Each other player pays', 'The winner collects'],
        rows: [
          [{ tiles: 'S', text: 'South wins' }, '1,000', '500', '2,000'],
          [{ tiles: 'E', text: 'East wins' }, '—', '1,000', '3,000'],
        ],
      },
    }),
    S('What keeps a hand concealed', 'So what spoils a concealed hand? Calling a discard for a pung, a chow or a kong. That set goes face up. A kong you draw all four of yourself stays concealed, and so does the discard that wins your hand. Remember, you can never call for a mixed chow, a crochet, a knit or a pair, so those always stay hidden.', {
      list: [
        { tiles: '555s', title: 'A called pung, chow or kong', text: 'Goes face up: now it’s a normal hand.' },
        { tiles: '8888m', title: 'A kong you drew yourself', text: 'Still concealed.' },
        { tiles: 'EE', title: 'The winning discard', text: 'Still concealed: only the last tile came from a discard.' },
      ],
    }),
    S('Example one', 'Let’s try some. You sit South. You called a pung of seven Rings, and won on a discard. Something is face up, so it’s a normal hand: five hundred. East pays double, a thousand, and the other two pay five hundred each. You collect two thousand.', {
      hand: {
        title: 'Example 1 · A normal hand · 500',
        groups: [
          { tiles: '777p', label: 'Pung', sub: '7 Rings', flag: 'Called', mark: 'called' },
          { tiles: '123m', label: 'Chow', sub: '1-2-3 Cracks' },
          { tiles: '4m 5s 6p', label: 'Mixed chow', sub: 'across 3 suits' },
          { tiles: '9m 9s 9p', label: 'Crochet', sub: 'the 9s' },
          { tiles: 'EE', label: 'Pair', sub: 'East', flag: 'Won on a discard', mark: 'win' },
        ],
        facts: ['You sit South', 'A pung is face up', 'Won on a discard'],
        scoreTitle: 'What it pays',
        faan: [['Normal hand', '500']],
        total: 'A normal hand: 500',
        pay: [
          { who: 'East pays double', amount: '1,000', big: true },
          { who: 'West and North pay', amount: '500 + 500' },
        ],
        winner: 'You collect 2,000',
      },
    }),
    S('Example two', 'This time you made no calls at all, and won on a discard. Nothing is face up, so it’s a concealed hand: a thousand. East pays two thousand, and the other two pay a thousand each. You collect four thousand.', {
      hand: {
        title: 'Example 2 · A concealed hand · 1,000',
        groups: [
          { tiles: '234s', label: 'Chow', sub: '2-3-4 Bamboos' },
          { tiles: '6m 7p 8s', label: 'Mixed chow', sub: 'across 3 suits' },
          { tiles: '3m 3s 3p', label: 'Crochet', sub: 'the 3s' },
          { tiles: 'RdRdRd', label: 'Pung', sub: 'Red Dragons' },
          { tiles: 'NN', label: 'Pair', sub: 'North', flag: 'Won on a discard', mark: 'win' },
        ],
        facts: ['You sit South', 'Nothing face up', 'Won on a discard'],
        scoreTitle: 'What it pays',
        faan: [['Concealed hand', '1,000']],
        total: 'A concealed hand: 1,000',
        pay: [
          { who: 'East pays double', amount: '2,000', big: true },
          { who: 'West and North pay', amount: '1,000 + 1,000' },
        ],
        winner: 'You collect 4,000',
      },
    }),
    S('Example three', 'Last one, and you’re East! No calls, and you drew the winning tile yourself. That’s fully concealed: two thousand. And East receives double, so all three players pay you four thousand each. That’s twelve thousand!', {
      hand: {
        title: 'Example 3 · East, fully concealed · 2,000',
        groups: [
          { tiles: '123p', label: 'Chow', sub: '1-2-3 Rings' },
          { tiles: '456p', label: 'Chow', sub: '4-5-6 Rings' },
          { tiles: '789m', label: 'Chow', sub: '7-8-9 Cracks' },
          { tiles: '5m 5s 5p', label: 'Crochet', sub: 'the 5s', mark: 'hl' },
          { tiles: 'GdGd', label: 'Pair', sub: 'Green Dragons', flag: 'Drew it yourself', mark: 'win' },
        ],
        facts: ['You are East', 'Nothing face up', 'Drew the winning tile'],
        scoreTitle: 'What it pays',
        faan: [['Fully concealed', '2,000'], ['East receives double', '× 2']],
        total: 'Fully concealed, East: 4,000 each',
        pay: [
          { who: 'South', amount: '4,000' },
          { who: 'West', amount: '4,000' },
          { who: 'North', amount: '4,000' },
        ],
        winner: 'You collect 12,000',
      },
    }),
    S('Flowers and seasons pay', 'Flowers and seasons pay too, at the end of every game, even when nobody wins. Your own flower and season together are worth five hundred, and so are the round’s flower and season. One to four, flowers and seasons mixed, is a mixed bouquet: five hundred. All four flowers, or all four seasons, is a pure bouquet: a thousand.', {
      table: {
        head: ['You hold', 'Tiles', 'Each player pays you'],
        rows: [
          ['Your own flower and season', { tiles: 'F2 F6', text: 'South: the 2s' }, '500'],
          ['The round’s flower and season', { tiles: 'F1 F5', text: 'East round: the 1s' }, '500'],
          ['A mixed bouquet', { tiles: 'F1 F6 F3 F8', text: '1 to 4, mixed' }, '500'],
          ['A pure bouquet', { tiles: 'F1 F2 F3 F4', text: 'all four flowers' }, '1,000'],
        ],
      },
    }),
    S('East pays flowers the same', 'One small difference. For flowers and seasons, East pays the same as everyone else, not double. So if you sit South and hold flower two and season two, all three players pay you five hundred, East included. That’s fifteen hundred, win or lose.', { tiles: ['F2', 'F6'] }),
    S('When nobody wins', 'Sometimes the wall runs out and nobody wins. That’s a drawn game. Nobody is paid for a win, but flowers and seasons are still paid. Then the deal passes to the next player, just as it does after a win. East never keeps the deal.', { tiles: ['E'] }),
    S('The table counts for you', 'You never have to count at JongClub. When a game ends, the score card shows every payment. In the Classic style, any four sets and a pair wins. In a full match, each round adds something of its own, like the East round’s passports. You’ll meet them later. Now, shall we try your test?', {
      list: [
        { tiles: '123m', title: 'JongClub counts for you', text: 'The score card shows every payment when a game ends.' },
        { tiles: '9m 9s 9p', title: 'Classic style', text: 'Any four sets and a pair wins.' },
        { tiles: 'E S W N', title: 'A full match', text: 'Each round has its own game: passports, small cards, goulash and East’s choice.' },
      ],
    }),
  ],
  quiz: [
    Q('You win with a pung face up. What is it worth?', ['500, a normal hand', '1,000, a concealed hand', '2,000, fully concealed'], 0, 'Anything face up makes it a normal hand, worth five hundred.'),
    Q('Nothing is face up, and you win on a discard. What is it?', ['A concealed hand, 1,000', 'A normal hand, 500', 'Fully concealed, 2,000'], 0, 'The winning discard doesn’t spoil it: nothing face up is a concealed hand.'),
    Q('Who pays when you win on a discard?', ['All three other players', 'Only the player who threw it', 'Nobody'], 0, 'Everyone pays the winner, whoever threw the winning tile.'),
    Q('South wins a normal hand. What does East pay?', ['1,000, double', '500', 'Nothing'], 0, 'East always pays and receives double.'),
    Q('You sit South with flower 2 and season 2. What happens?', ['Everyone pays you 500, win or draw', 'Nothing, unless you win', 'Only East pays'], 0, 'Your own flower and season are worth five hundred from each player, even on a drawn game. East pays the same as the others.'),
    Q('The wall runs out and nobody wins. Who deals next?', ['The next player', 'East plays again', 'Whoever holds most flowers'], 0, 'The deal passes after every game, won or drawn. East never keeps it.'),
  ],
};
