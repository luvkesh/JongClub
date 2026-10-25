// Academy, Mastering Mahjong (Level 12): value and the long game. Fast or
// big, cheap value you can add, when to aim for one suit, the dealer's
// chance, table minimums, reading the scores, the last hand, and placement
// points. Uses Classic numbers (classic.ts) for the worked figures.

import { S, Q, type Lesson } from '../lessonKit';

export const valueLesson: Lesson = {
  id: 'value',
  title: 'Value and the long game',
  scenes: [
    S('Fast or big?', 'Every hand asks one question: fast, or big? A fast hand wins often, but pays little. A big hand pays a lot, but wins less often. Experts choose on purpose, every hand, and change their mind when the tiles say so.', {
      table: {
        head: ['', 'Fast hand', 'Big hand'],
        rows: [
          ['Looks like', { tiles: '123m 456p 78s' }, { tiles: '123s 456s GdGd' }],
          ['Wins', 'Often', 'Less often'],
          ['Pays', 'Little', 'A lot'],
          ['Good when', 'You’re ahead, or someone is close', 'You’re behind, or the tiles flow'],
        ],
      },
    }),
    S('Easy value', 'You can often add value without slowing down. Keep a pair of dragons, or of your seat or round wind: one more makes a scoring pung. Stay concealed when calling doesn’t help much. And remember, a self-draw adds a faan too.', {
      list: [
        { tiles: 'RdRd', title: 'Dragon pairs', text: 'One more makes a pung worth a faan.' },
        { tiles: 'EE', title: 'Your winds', text: 'Seat wind and round wind pungs score.' },
        { tiles: '123m', title: 'Stay concealed', text: 'No calls is worth a faan by itself.' },
      ],
    }),
    S('Going for one suit', 'Mixed one suit, one suit plus honours, is three faan in Classic. When to aim for it? When eight or more of your first tiles are one suit, or one suit and honours. Then let the other suits go early.', {
      hand: {
        title: 'A good start for mixed one suit',
        groups: [
          { tiles: '234s', label: 'Bamboo' },
          { tiles: '567s', label: 'Bamboo' },
          { tiles: '99s', label: 'Bamboo' },
          { tiles: 'GdGd', label: 'Honours', mark: 'hl' },
          { tiles: '4m 8p 1p', label: 'Let go', sub: 'other suits', mark: 'called' },
        ],
        facts: ['Ten of thirteen tiles are Bamboo or honours', 'Aim: mixed one suit, 3 faan'],
      },
    }),
    S('Know the minimum', 'Check the table’s minimum before you call. Hong Kong tables often need three faan, and Chinese Official needs eight fan. A fast hand that can’t reach the minimum can’t win at all, so build the value first.', {
      table: {
        head: ['Table', 'Minimum to win'],
        rows: [
          ['Classic at JongClub', 'None, unless the host sets one'],
          ['Hong Kong', 'Often three faan'],
          ['Chinese Official', 'Eight fan'],
          ['Dubai', 'The host decides, often one faan'],
        ],
      },
    }),
    S('The dealer’s chance', 'The dealer often wins more, pays more, and keeps the deal by winning. So when you’re East with a decent hand, push a little harder. And when another player is dealing on a streak, stopping them matters, even with a cheap win.', { board: 'seats' }),
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
    S('The last hand', 'In the last hand, do the sums. If you need two hundred points to catch up, a chicken hand won’t do it. Build exactly what you need. And if you’re in front, any win, or a drawn hand, may be enough.', {
      list: [
        { tiles: '777p', title: 'A chicken hand: 16 points', text: 'Won’t close a big gap.' },
        { tiles: 'GdGdGd', title: 'Four faan: 256 points', text: 'Might be exactly what you need.' },
        { tiles: 'E', title: 'In front?', text: 'A quick cheap win, or a draw, ends it.' },
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
    Q('You are well ahead near the end of the match. What should you aim for?', ['Safe, fast hands', 'The biggest hand possible', 'Calling every tile'], 0, 'Cheap wins end hands quickly and protect your lead.'),
    Q('When is mixed one suit worth aiming for?', ['When eight or more tiles are one suit and honours', 'Every hand', 'Only when you are the dealer'], 0, 'Start it when your tiles already lean that way: about eight of one suit and honours.'),
    Q('The table needs three faan to win. What about a fast chicken hand?', ['It can’t win: it has no faan', 'It wins, but pays less', 'It pays double'], 0, 'Below the minimum, a hand can’t win at all, so build value before you call.'),
    Q('You need 200 points in the last hand. Which hand helps?', ['A four faan hand, 256 points', 'A chicken hand, 16 points', 'A drawn hand'], 0, 'Do the sums: only a hand worth enough closes the gap.'),
    Q('With placement points, what matters most?', ['Your finishing place', 'Your single biggest hand', 'How many tiles you called'], 0, 'Each place earns a bonus, so finishing higher matters more than one big hand.'),
  ],
};
