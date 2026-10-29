// Academy, Mastering Mahjong (Level 12): value and the long game in India
// Rules. Fast or big (normal 500, concealed 1,000, fully concealed 2,000),
// cheap value, when to stay concealed, card-hand limits, East's double,
// reading the scores, the last game, and placement points. The figures follow
// eastScore and indiaPayments in src/engine/rules/india.ts.

import { S, Q, type Lesson } from '../lessonKit';

export const valueLesson: Lesson = {
  id: 'value',
  title: 'Value and the long game',
  scenes: [
    S('Fast or big?', 'Every hand asks one question: fast, or big? A fast hand calls tiles and wins often, but pays five hundred. A concealed hand pays double, or four times if you draw the last tile, but wins less often. Experts choose on purpose, every hand, and change their mind when the tiles say so.', {
      table: {
        head: ['', 'Fast hand', 'Big hand'],
        rows: [
          ['Looks like', { tiles: '555p 123m 78s' }, { tiles: '2m 3s 4p 7m 7s 7p' }],
          ['Wins', 'Often', 'Less often'],
          ['Pays', 'A normal hand, 500', 'Concealed 1,000, fully concealed 2,000'],
          ['Good when', 'You’re ahead, or someone is close', 'You’re behind, or the tiles flow']
        ],
      },
    }),
    S('Card hands pay more', 'In the South and North rounds, card hands pay in limits: half limit, limit, double limit, super limit and top limit. Before you choose your card, check what it pays, and how many of its tiles you already hold. A double limit you can reach beats a top limit you can’t.', {
      table: {
        head: ['Card hand', 'Each player pays'],
        rows: [
          ['Half limit', '500'],
          ['Limit', '1,000'],
          ['Double limit', '2,000'],
          ['Super limit', '4,000'],
          ['Top limit', '10,000'],
        ],
      },
    }),
    S('The dealer’s chance', 'East pays and receives double. So when you’re East with a decent hand, push a little harder: every player pays you twice. But every other player’s win costs you double too, so as East, defence matters more as well.', { board: 'seats' }),
    S('Watch the scores', 'Mahjong is a whole match, not one hand. When you’re well ahead, play safe and take cheap wins: they end hands quickly. When you’re behind, you need bigger hands, so take a little more risk.', {
      table: {
        head: ['You are', 'Play'],
        rows: [
          ['Well ahead', 'Safe and fast. Cheap wins end hands and keep your lead.'],
          ['Close', 'Your normal game.'],
          ['Behind', 'Aim bigger. Take a little more risk.'],
        ],
      },
    }),
    S('The last game', 'In the last game, do the sums. Sitting South, a normal hand collects two thousand, and a concealed hand four thousand. So if you need three thousand to catch up, a quick called hand won’t do it. Build exactly what you need. And if you’re in front, any win, or a drawn game, may be enough.', {
      list: [
        { tiles: '777p', title: 'A normal hand: 2,000', text: 'Won’t close a 3,000 gap.' },
        { tiles: '7m 7s 7p', title: 'A concealed hand: 4,000', text: 'Might be exactly what you need.' },
        { tiles: 'E', title: 'In front?', text: 'A quick win, or a draw, ends it.' },
      ],
    }),
    S('Placement points', 'Tournaments often use placement points. Your finishing place earns a bonus, on top of your score. So finishing first matters more than winning big. At JongClub, hosts can switch on tournament scoring when they set up a table.', {
      table: {
        head: ['Finish', 'Bonus, for example'],
        rows: [
          ['1st', '+15'],
          ['2nd', '+5'],
          ['3rd', '−5'],
          ['4th', '−15'],
        ],
      },
    }),
    S('Expert habits', 'That’s Mastering Mahjong! Count your steps, read the waits, watch the table, and play the whole match. After each game, open Review Game and look at your key moments. That’s how experts keep getting better. Well done!', {
      list: [
        { tiles: '45s', title: 'Speed', text: 'Five blocks, and the shapes that take more tiles.' },
        { tiles: '3456s', title: 'Waits', text: 'Name them, count them, choose the best.' },
        { tiles: '7s', title: 'Defence', text: 'Spot danger, fold without regret.' },
        { tiles: 'RdRdRd', title: 'Value', text: 'Fast or big, on purpose, every hand.' },
      ],
    }),
  ],
  quiz: [
    Q('You are well ahead near the end of the match. What should you aim for?', ['Safe, fast hands', 'The biggest hand possible', 'Calling every tile'], 0, 'Cheap wins end games quickly and protect your lead.'),
    Q('You are East with a decent hand. What should you do?', ['Push a little harder: everyone pays you double', 'Fold at once', 'Throw your best tiles'], 0, 'East receives double, so a decent hand is worth pushing.'),
    Q('When is a fast, called hand the better choice?', ['When you’re ahead, or someone else is close', 'Always', 'Never'], 0, 'Fast hands win often: good for protecting a lead or stopping a rival.'),
    Q('Sitting South, you need 3,000 in the last game. Which hand helps?', ['A concealed hand, 4,000', 'A normal hand, 2,000', 'A drawn game'], 0, 'Do the sums: only a hand worth enough closes the gap.'),
    Q('With placement points, what matters most?', ['Your finishing place', 'Your single biggest hand', 'How many tiles you called'], 0, 'Each place earns a bonus, so finishing higher matters more than one big hand.'),
  ],
};
