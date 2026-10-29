// Academy lesson (optional, Level 7): where Mahjong came from and what its
// tiles mean (coins, strings of coins and myriads; the sparrow; the winds and
// dragons; the four gentlemen and the seasons; India Rules' jokers), the
// rituals of the table (washing the tiles, building the wall, dice and seats),
// table manners, and Mahjong in India's clubs. Origins that are told as
// stories are said to be stories. The customs of other countries' tables live
// in their own variation lessons (the user, 2026-10-25).

import { S, Q, type Lesson } from '../lessonKit';

export const traditionLesson: Lesson = {
  id: 'tradition',
  title: 'Tradition and etiquette',
  scenes: [
    S('A game with a story', 'This one is just for fun, so pour a fresh cup of tea. Mahjong grew up in China in the eighteen hundreds. In the nineteen twenties it crossed the oceans and spread around the world. In India it found a home in the clubs, where players made the game their own. Today it’s played everywhere, and online too.', {
      table: {
        head: ['When', 'What happened'],
        rows: [
          ['1800s', 'Mahjong takes shape in China, probably from older card games played with money suits.'],
          ['1920s', 'The game crosses the oceans and spreads around the world.'],
          ['In India', 'Clubs take up the game, with their own sets, rounds and house rules.'],
          ['Today', 'Clubs on every continent, and tables online.'],
        ],
      },
    }),
    S('The sparrow game', 'One old name for the game means sparrow. Some say it’s the sound. When the tiles are mixed, they chatter like a flock of sparrows. And look closely at the one of Bamboos: there’s a little bird on it.', {
      cards: [
        { tiles: '1s', title: 'The sparrow', alt: '麻雀 · sparrow', text: 'A bird stands in for the single stick.' },
        { title: 'Mahjong', alt: '麻將 · the game’s name', text: 'Said “ma jiang” in Mandarin, “ma cheuk” in Cantonese.' },
      ],
    }),
    S('Coins, strings and myriads', 'The three suits began as money. Rings are copper coins, round, with a square hole in the middle. Bamboos are strings of those coins, threaded on a cord, which look like sticks of bamboo. And Cracks are myriads: the symbol on every one means ten thousand.', {
      cards: [
        { tiles: '1p 5p 9p', title: 'Rings: coins', alt: '筒 Tong · also 餅 cakes', text: 'Round copper coins with a square hole.' },
        { tiles: '1s 5s 9s', title: 'Bamboos: strings', alt: '索 Suo · a cord', text: 'Strings of coins, a hundred to a cord. They look like bamboo.' },
        { tiles: '1m 5m 9m', title: 'Cracks: myriads', alt: '萬 Wan · ten thousand', text: 'Ten thousand coins: the biggest money of all.' },
      ],
    }),
    S('Why a bird?', 'So why is the one of Bamboos a bird? Nobody knows for sure. One story says a single string of coins was too easy to fake, so a bird was painted instead. Over the years, sets have shown sparrows, peacocks and even cranes.', { tiles: ['1s', '2s', '3s'] }),
    S('Winds and dragons', 'The winds are simply the four directions, the same compass that names our seats. The dragons have lovely meanings. The Red is Zhong, the centre, or a hit on the target. The Green is Fa, to prosper. And the White is Bai, a blank board.', {
      cards: [
        { tiles: 'E S W N', title: 'The four winds', alt: '風 Feng · the compass', text: 'The four directions, which also name the seats.' },
        { tiles: 'Rd', title: 'Red: centre', alt: '中 Zhong', text: 'The centre, or an arrow that hits the target.' },
        { tiles: 'Gd', title: 'Green: prosper', alt: '發 Fa', text: 'Good fortune, to grow rich.' },
        { tiles: 'Wd', title: 'White: blank', alt: '白 Bai', text: 'A clean white board.' },
      ],
    }),
    S('Flowers and seasons', 'The flowers are plum, orchid, chrysanthemum and bamboo. In Chinese painting, they’re the four gentlemen, each one brave in its own season. The seasons are spring, summer, autumn and winter. Each is numbered one to four, for East, South, West and North, so one flower and one season belong to your seat.', {
      cards: [
        { tiles: 'F1 F2 F3 F4', title: 'The four gentlemen', alt: '花 Hua · flowers', text: 'Plum, orchid, chrysanthemum and bamboo.' },
        { tiles: 'F5 F6 F7 F8', title: 'The four seasons', alt: '季 Ji · seasons', text: 'Spring, summer, autumn and winter.' },
        { tiles: 'F1 F5', title: 'Your own tiles', alt: 'East = number 1', text: 'Number 1 belongs to East, 2 to South, 3 to West, 4 to North.' },
      ],
    }),
    S('Why jokers?', 'The first sets had no jokers at all. Wild tiles came later, to make bigger and bolder hands possible. In India Rules they arrive in the North round. With small cards, the flowers and seasons turn wild. For a goulash with jokers, East names a wild number. And a big card names its own jokers. Some Indian clubs, like Kolkata’s joker clubs, play with joker tiles in every game.', {
      list: [
        { tiles: 'F1 F5', title: 'Flowers as jokers', text: 'North round, small cards: the flowers and seasons are wild.' },
        { tiles: '5m 5s 5p', title: 'A wild number', text: 'North round goulash: East names a number, wild in all three suits.' },
        { tiles: 'J', title: 'Joker tiles', text: 'Some Indian clubs play with joker tiles in every game.' },
      ],
    }),
    S('Washing the tiles', 'Every hand begins with a wash. Washing the tiles is a cleansing: it clears away the last hand, its luck and its tiles, so the next one starts fresh and fair. All the tiles are turned face down and swirled with both hands. Some say the clatter sounds like sparrows chattering.', { demo: 'wash' }),
    S('Table manners', 'Now, a few manners. Keep a steady pace, and don’t keep the table waiting. Call clearly, Pung, Chow or Mahjong, so everyone hears you. Never touch another player’s tiles. And only discard on your own turn.', {
      list: [
        { title: 'Keep a steady pace', text: 'Don’t keep the table waiting.' },
        { title: 'Call clearly', text: 'Pung, Chow or Mahjong, so everyone hears you.' },
        { title: 'Hands off', text: 'Never touch another player’s tiles.' },
        { title: 'Your turn only', text: 'Only discard on your own turn.' },
      ],
    }),
    S('A good sport', 'At a real table, name each tile as you discard it. Once a tile is down, it stays down. Don’t coach other players in the middle of a hand. And win or lose, thank the table. That’s the club spirit.', {
      list: [
        { title: 'Name your discard', text: 'Say the tile as you throw it.' },
        { title: 'Down is down', text: 'Once a tile is on the table, it stays there.' },
        { title: 'No coaching', text: 'Let everyone play their own hand.' },
        { title: 'Thank the table', text: 'Win or lose.' },
      ],
    }),
    S('Mahjong in India', 'In India, Mahjong lives on in the clubs, in cities like Kolkata, Mumbai and Darjeeling. Over the years the clubs gave the game their own sets, like the crochet and the mixed chow, and their own rounds: passports, small cards, the goulash and the big cards. India Rules is that club game.', { tiles: ['7m 7s 7p', '2m 3s 4p'] }),
    S('The club rulebook', 'Every club keeps a rulebook, and the members know it well. Before a game, the table agrees its house rules: how long to play, and whether the East round needs a passport. At JongClub, the host sets these when opening a table, so always have a quick look before you sit down.', { tiles: ['E', 'S', 'W', 'N'] }),
    S('Wherever you sit', 'So wherever you sit, ask about the house rules, keep the pace, and enjoy the company. That’s what Mahjong is really about. Four friends, one table, and a little luck and skill. Shall we try a few fun questions?', { board: 'seats' }),
  ],
  quiz: [
    Q('The Rings suit began as…', [['Copper coins', '5p'], ['Flowers', 'F1'], ['Dragon eyes', 'Rd']], 0, 'The suits began as money: Rings are coins, Bamboos are strings of coins, and Cracks are ten thousands.'),
    Q('Plum, orchid, chrysanthemum and bamboo are…', ['The four flower tiles', 'The four suits', 'The four winds'], 0, 'They are the flowers, the four gentlemen of Chinese painting.'),
    Q('What does washing the tiles mean?', ['A cleansing shuffle, face down, before every hand', 'Sorting them by suit', 'Turning them all face up'], 0, 'Washing is the shuffle, and a little cleansing: tiles face down, swirled with both hands, so every hand starts fresh.'),
    Q('The Green Dragon is called Fa. What does it mean?', ['To prosper', 'The centre', 'A blank board'], 0, 'Red is Zhong, the centre. Green is Fa, to prosper. White is Bai, a blank board.'),
    Q('Which of these is good table manners?', ['Call clearly and keep a steady pace', 'Discard whenever you like', 'Tidy up another player’s tiles'], 0, 'Call clearly, keep the pace, discard only on your turn, and never touch another player’s tiles.'),
    Q('In India Rules, when do jokers come in?', ['The North round', 'Every game', 'Never'], 0, 'In the North round, flowers, a wild number or a big card’s own jokers can be wild.'),
    Q('Who sets an India Rules table’s house rules at JongClub?', ['The host, when opening the table', 'The player with most points', 'Nobody: they never change'], 0, 'The host chooses the house rules, like how long to play and whether passports are needed.'),
  ],
};
