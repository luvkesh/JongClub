// Academy lesson: Hong Kong Mahjong, following JongClub's `hongkong` profile
// (src/engine/rules/hongkong.ts): Classic-style faan with flowers, a three-faan
// minimum at the default table, points on the half-spicy table (8 x 1, 2, 4,
// 8, 16, 24, 32, 48, 64, 96, 128, capped at ten faan), and half gun by
// default. The worked example is checked in test/lessons.test.ts.

import { S, Q, type Lesson } from '../lessonKit';

export const hongKongLesson: Lesson = {
  id: 'hongkong',
  title: 'Hong Kong Mahjong',
  scenes: [
    S('Welcome to Hong Kong', 'Hello, and welcome to Hong Kong! This is the lively Cantonese game, played in homes and clubs across the city, and in Cantonese communities all over the world. It’s very close to Classic. What’s different? Flowers are in, you need three faan to win, and points follow a special table. Let me show you!', { tiles: ['123m', '456p', '789s', 'RdRdRd', 'EE'] }),
    S('New words', 'The calls have Cantonese names. Sheung is a chow, Pung is a pung, and Gong is a kong. When you win, you call Sik Wu. And a win on your own draw is Zi Mo.', { tiles: ['345s', '555p', '9999m'] }),
    S('Three faan to win', 'At our table, a hand needs at least three faan to win. So a plain hand won’t do. Aim for a flush, a dragon pung, or a concealed hand you draw yourself. The host can lower the minimum, if you’d like a gentler game.', { tiles: ['RdRdRd', '234m', '567p', '678s', '99s'] }),
    S('Counting faan', 'Most faan are the ones you know from Classic. Self-draw is one, a concealed hand is one, and each dragon pung is one, and so is your seat or round wind. Half flush, one suit plus honours, is three. Full flush is seven. With flowers on, no flowers at all is a faan, and so is your seat flower.', { tiles: ['123s', '456s', '789s', 'EEE', '55s'] }),
    S('The half-spicy table', 'Here’s the Hong Kong twist. Up to four faan, each faan doubles the points: eight, sixteen, thirty-two, sixty-four, one hundred and twenty-eight. After that, points rise by half steps. Five faan is one hundred and ninety-two, and six is two hundred and fifty-six. Ten faan is the limit, one thousand and twenty-four.', { tiles: ['RdRdRd'] }),
    S('Who pays', 'Win by self-draw, and everyone pays you the points. Win on a discard, and the discarder pays the points, while the other two pay half. That’s called half gun. Some hosts choose full gun instead, where the discarder pays for everyone.', { tiles: ['5p'] }),
    S('An example', 'Here’s a winning hand. You called a chow, every number tile is Bamboo, and you have a pung of East in the East round. No flowers came your way. Half flush is three faan. Round wind is one. No flowers is one more. Five faan in all, one hundred and ninety-two points.', {
      hand: {
        title: 'Hong Kong · Half flush · 5 faan, 192 points',
        groups: [
          { tiles: '123s', label: 'Sheung', sub: 'Chow, 1-2-3 Bamboo', flag: 'Called', mark: 'called' },
          { tiles: '456s', label: 'Sheung', sub: 'Chow, 4-5-6 Bamboo' },
          { tiles: '789s', label: 'Sheung', sub: 'Chow, 7-8-9 Bamboo' },
          { tiles: 'EEE', label: 'Pung', sub: 'East, the round wind', mark: 'hl' },
          { tiles: '55s', label: 'Eyes', sub: 'The pair, 5 Bamboo', flag: 'Won on a discard', mark: 'win' },
        ],
        facts: ['One suit plus honours', 'East round, you sit South', 'No flowers or seasons'],
        faan: [
          ['Half flush', 3],
          ['Round wind pung', 1],
          ['No flowers', 1],
        ],
        total: '5 faan = 192 points',
      },
    }),
    S('Who pays for it', 'And who pays? You won on a discard, so at a half gun table, the player who threw your tile pays the full one hundred and ninety-two. The other two pay half, ninety-six each. You collect three hundred and eighty-four.', {
      hand: {
        title: 'Half gun: the discarder pays the most',
        groups: [{ tiles: '55s', label: 'Your winning tile', sub: 'thrown by the player on your left', mark: 'win' }],
        pay: [
          { who: 'The discarder pays it all', amount: '192', big: true },
          { who: 'Each other player pays half', amount: '96 + 96' },
        ],
        winner: 'You collect 384',
      },
    }),
    S('Check your table', 'Hong Kong clubs differ, so the host sets the minimum, the flowers, seven pairs, who pays, and whether a goulash follows a wall game. Have a quick look before you sit down. Now, shall we try your test?', { board: 'seats' }),
  ],
  quiz: [
    Q('At our default Hong Kong table, how many faan do you need to win?', ['Three', 'None', 'Eight'], 0, 'Our default table needs three faan. The host can lower it.'),
    Q('What is Sheung?', [['A chow', '345s'], ['A kong', '9999m'], ['A win', '123m']], 0, 'Sheung is the Cantonese call for a chow. Gong is a kong, and Sik Wu is the win.'),
    Q('On the half-spicy table, what is a five faan hand worth?', ['One hundred and ninety-two', 'Two hundred and fifty-six', 'Five hundred and twelve'], 0, 'Up to four faan the points double. Then they rise by half steps, so five faan is one hundred and ninety-two.'),
    Q('Half gun: you win on a discard. Who pays what?', ['The discarder pays the points, the others half', 'Everyone pays the same', 'Only the dealer pays'], 0, 'With half gun, the discarder pays the full points and the other two pay half.'),
    Q('What does Zi Mo mean?', ['A win on your own draw', 'A win on a discard', 'Three of a kind'], 0, 'Zi Mo is a self-draw win. Sik Wu is the call for any win.'),
  ],
};
