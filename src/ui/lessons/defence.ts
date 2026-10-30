// Academy, Mastering Mahjong (Level 11): defence in India Rules. Why it
// matters (everyone pays every winner, East double), spotting a ready
// player, the ladder of safe tiles (just passed, honours on show, their own
// discards, lines of three, walls), and folding well. Safety follows the AI's
// own reads in src/ai/danger.ts: a player may win on a tile they threw, so
// their own discards are a strong hint, not a guarantee.

import { S, Q, type Lesson } from '../lessonKit';

export const defenceLesson: Lesson = {
  id: 'defence',
  title: 'Defence: reading the table',
  scenes: [
    S('Why defence wins', 'Here’s a secret of strong players. They don’t just win more, they lose less. In India Rules, every win is paid by all three other players. So each hand someone else wins costs you, and twice as much when you’re East. Stopping a big concealed hand, or a card hand, saves you the most.', {
      table: {
        head: ['South wins a concealed hand', 'You pay'],
        rows: [
          ['You sit West or North', '1,000'],
          ['You are East', '2,000'],
        ],
      },
    }),
    S('Who looks ready?', 'First, spot the danger. A player who has called two or three sets is often close. Watch for a change, too: early on they throw honours and ones, then suddenly they throw middle tiles they were keeping. And as the wall gets short, assume everyone is near.', {
      list: [
        { tiles: '555p WWW', title: 'Two or three sets called', text: 'Their hand is small, and probably close.' },
        { tiles: '5m 6s', title: 'Throwing middle tiles late', text: 'They have stopped building and are waiting.' },
        { tiles: '1s 9m', title: 'Few tiles left in the wall', text: 'Everyone is closer to winning.' },
      ],
    }),
    S('The safety ladder', 'Some tiles are much safer than others. Safest of all is a tile that player just let pass without calling. Next, an honour with three already showing. Then tiles that player threw away earlier. Middle tiles they might need are the most dangerous.', {
      table: {
        head: ['', 'Tile', 'Why'],
        rows: [
          ['Safest', { tiles: '7s', text: 'They just let it pass' }, 'If it won for them, they’d have called it'],
          ['Very safe', { tiles: 'Wd Wd Wd', text: 'Honour, three showing' }, 'Only a single wait could use the last one'],
          ['Safer', { tiles: '9m', text: 'They threw it earlier' }, 'They didn’t want it then'],
          ['Risky', { tiles: '5m', text: 'Middle tile, their suit' }, 'It fits the most waits'],
        ],
      },
    }),
    S('Their own discards', 'Tiles a player threw away themselves are special. They could still win on one, but it’s unlikely they built a wait on a tile they let go. So against them, their own discards are a good, safe choice.', { tiles: ['9m', '1p', 'N'] }),
    S('Lines of three', 'Here’s an expert trick. Numbers are linked in lines: one four seven, two five eight, three six nine. If a player threw a four, then a two-sided wait on one and four, or four and seven, is less likely. It’s a hint, not a promise.', {
      table: {
        head: ['Line', 'If they threw…', '…these are a little safer'],
        rows: [
          ['1 · 4 · 7', { tiles: '4s' }, { tiles: '1s 7s' }],
          ['2 · 5 · 8', { tiles: '5s' }, { tiles: '2s 8s' }],
          ['3 · 6 · 9', { tiles: '6s' }, { tiles: '3s 9s' }],
        ],
      },
    }),
    S('Walls you can see', 'Another trick: count what’s showing. If all four sevens are on the table, nobody can hold seven eight, or six seven. So an eight or a nine can’t be finished by a run through the seven. Experts call this a wall.', {
      list: [
        { tiles: '7p 7p 777p', title: 'All four 7s are showing', text: 'No run can use a 7 any more.' },
        { tiles: '8p 9p', title: 'So 8 and 9 are safer', text: 'Nobody can wait on a 9 with 7-8, or on an 8 with 6-7.' },
      ],
    }),
    S('Folding well', 'When you decide to fold, do it properly. Throw your safest tile every turn, even if it breaks a set. You may still reach a drawn game, where nobody is paid for a win. A fold is not losing. It’s saving points for a better hand.', {
      list: [
        { tiles: '7s', title: 'Every turn, the safest tile', text: 'Even from a set you liked.' },
        { tiles: 'Wd', title: 'Keep a few safe tiles', text: 'So you never run out of good throws.' },
        { tiles: 'E', title: 'Hope for a draw', text: 'If the wall runs out, nobody wins.' },
      ],
    }),
    S('When to fold', 'So when should you fold? When another player looks ready and you’re two or more steps away. When your hand is cheap and theirs looks big. Push on when you’re ready yourself, especially with a good hand.', {
      table: {
        head: ['You', 'They look ready', 'Do this'],
        rows: [
          ['Ready, good hand', 'Yes', 'Push'],
          ['One step away, good hand', 'Yes', 'Push, but avoid risky tiles'],
          ['Two or more steps away', 'Yes', 'Fold'],
          ['Any', 'No', 'Keep building'],
        ],
      },
    }),
    S('Defence habits', 'Every few turns, look up from your tiles. Who has called? What are they throwing? How many tiles are left? Tap JongBot’s Why at the table, and it will tell you how dangerous a tile is. Shall we try your test?', {
      list: [
        { tiles: '555p', title: 'Look up', text: 'Who has called, and what are they throwing?' },
        { tiles: '7s', title: 'Know your safe tiles', text: 'Just passed, honours on show, their own discards.' },
        { tiles: 'E', title: 'Fold without regret', text: 'Saving points is winning points.' },
      ],
    }),
  ],
  quiz: [
    Q('Another player just let a 7 Bamboo pass without calling. Is it safe against them?', ['Very: if it won for them, they would have called it', 'No, it is the most dangerous tile', 'Only if it is an honour'], 0, 'A tile they just passed on isn’t their winning tile right now.'),
    Q('An honour has three copies showing. How dangerous is the last one?', ['Very safe: only a single wait could use it', 'Very dangerous', 'It can’t be thrown'], 0, 'Nobody can make a pung of it, so only a rare single wait could win on it.'),
    Q('A player threw a 4 of Bamboo. Which tiles are a little safer against their two-sided waits?', [['1 and 7 of Bamboo', '1s 7s'], ['3 and 5 of Bamboo', '3s 5s'], ['Any Rings', '5p']], 0, 'One, four and seven are a line. A two-sided wait on one-four or four-seven would also take the four they threw.'),
    Q('You are two steps from ready and another player looks ready. What should you do?', ['Fold: throw safe tiles', 'Throw your most useless middle tile', 'Call everything'], 0, 'Far away against a ready player: fold, and save your points.'),
    Q('All four 7s of Rings are on the table. Which tiles get safer?', [['8 and 9 of Rings', '8p 9p'], ['1 and 2 of Rings', '1p 2p'], ['All Bamboo', '5s']], 0, 'With every seven showing, no run through the seven can be waiting on an eight or a nine.'),
  ],
};
