// Academy lesson (optional, Level 8): where Mahjong came from and what its
// tiles mean (coins, strings of coins and myriads; the sparrow; the winds and
// dragons; the four gentlemen and the seasons; why jokers arrived), how it
// spread, the rituals of the table (washing the tiles, building the wall, dice
// and seats), table manners, and how Mahjong is played around the world.
// Origins that are told as stories are said to be stories. American customs
// (the League card, the goulash) are described as American customs only,
// never mixed into the Asian games, and the UAE is described as a club scene
// with no single official rulebook.

import { S, Q, type Lesson } from '../lessonKit';

export const traditionLesson: Lesson = {
  id: 'tradition',
  title: 'Tradition and etiquette',
  scenes: [
    S('A game with a story', 'This one is just for fun, so pour a fresh cup of tea. Mahjong grew up in China in the eighteen hundreds. In the nineteen twenties it crossed the oceans, and a Mahjong craze swept America, while the game took root in Japan too. Today it’s played all over the world.', {
      table: {
        head: ['When', 'What happened'],
        rows: [
          ['1800s', 'Mahjong takes shape in China, probably from older card games played with money suits.'],
          ['1920s', 'A Mahjong craze sweeps America and Europe. Japan starts to play.'],
          ['1937', 'The National Mah Jongg League is founded in New York.'],
          ['1950s', 'Riichi, Japan’s own style, takes shape after the war.'],
          ['1998', 'China publishes the Chinese Official rules for competitions.'],
          ['Today', 'World championships, clubs on every continent, and tables online.'],
        ],
      },
    }),
    S('The sparrow game', 'One old name for the game means sparrow. Some say it’s the sound. When the tiles are mixed, they chatter like a flock of sparrows. And look closely at the one of Bamboo: there’s a little bird on it.', {
      cards: [
        { tiles: '1s', title: 'The sparrow', alt: '麻雀 · sparrow', text: 'A bird stands in for the single stick.' },
        { title: 'Mahjong', alt: '麻將 · the game’s name', text: 'Said “ma jiang” in Mandarin, “ma cheuk” in Cantonese.' },
      ],
    }),
    S('Coins, strings and myriads', 'The three suits began as money. Dots are copper coins, round, with a square hole in the middle. Bamboo are strings of those coins, threaded on a cord, which look like sticks of bamboo. And Characters are myriads: the symbol on every one means ten thousand.', {
      cards: [
        { tiles: '1p 5p 9p', title: 'Dots: coins', alt: '筒 Tong · also 餅 cakes', text: 'Round copper coins with a square hole.' },
        { tiles: '1s 5s 9s', title: 'Bamboo: strings', alt: '索 Suo · a cord', text: 'Strings of coins, a hundred to a cord. They look like bamboo.' },
        { tiles: '1m 5m 9m', title: 'Characters: myriads', alt: '萬 Wan · ten thousand', text: 'Ten thousand coins: the biggest money of all.' },
      ],
    }),
    S('Why a bird?', 'So why is the one of Bamboo a bird? Nobody knows for sure. One story says a single string of coins was too easy to fake, so a bird was painted instead. Over the years, sets have shown sparrows, peacocks and even cranes.', { tiles: ['1s', '2s', '3s'] }),
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
    S('Why jokers?', 'The first sets had no jokers at all. They came later, mostly in America, where every hand must match the card exactly. Jokers make those hands possible, and today an American set has eight. Vietnamese and Indian clubs use jokers of their own, and some Chinese towns turn a tile wild each hand.', {
      list: [
        { tiles: 'J', title: 'American jokers', text: 'Eight joker tiles, used in groups of three or more.' },
        { tiles: 'JW', title: 'Vietnamese and Indian jokers', text: 'Their own wild tiles, with their own house rules.' },
        { tiles: '5p', title: 'A wild tile each hand', text: 'Some Chinese towns pick a tile that is wild for that hand.' },
      ],
    }),
    S('Washing the tiles', 'Every hand begins with a wash. Washing the tiles is a cleansing: it clears away the last hand, its luck and its tiles, so the next one starts fresh and fair. All the tiles are turned face down and swirled with both hands. Some say the clatter sounds like sparrows chattering.', { demo: 'wash' }),
    S('Building the wall', 'Then each player builds a row of tiles, two high, in front of their seat. Pushed together, the four rows make a square wall. It’s a little ritual, and it keeps the tiles honest.', { video: 'wall', demo: 'wall', caption: 'At JongClub, the table washes the tiles and builds the wall for you.' }),
    S('Dice and seats', 'Dice decide a lot. Many tables roll to choose who sits East, or draw wind tiles face down to pick seats. Then the dealer rolls to show where to break the wall. From East, South is on your right, West is across, and North is on your left.', { board: 'seats' }),
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
    S('Hong Kong and China', 'Every part of the world has its own customs. In Hong Kong, games are fast and lively, scored in faan, often with flowers. In mainland China, the Chinese Official rules list eighty-one named patterns, for serious competitions.', { tiles: ['RdRdRd', 'F1'] }),
    S('Japan and Taiwan', 'In Japan, Riichi players meet in quiet parlours, and the usual game is a hanchan, the East and South rounds. In Taiwan, sixteen-tile hands and long evenings through all four winds are the custom.', { tiles: ['E', 'S'] }),
    S('America', 'In America, the National Mah Jongg League prints a new card every year, and players get the new one each spring. Groups often meet weekly, and every hand starts with the Charleston. Some groups play a goulash after a wall game, and pass jokers in its Charleston.', { tiles: ['J', 'F1'] }),
    S('Singapore, Malaysia and Vietnam', 'In Singapore and Malaysia, families play with cheeky animals and on-the-spot payments, especially at Chinese New Year. In Vietnam, families and cafés play quick, cheerful games full of jokers.', { tiles: ['Cat', 'Mse', 'JW'] }),
    S('India and the Emirates', 'In India, Mahjong lives on in the clubs of Kolkata, Mumbai and Darjeeling, with jokers and club house rules. In Dubai and across the Emirates, clubs bring together players from everywhere. Some tables play Hong Kong style, with their own goulash after a wall game. Others play Taiwanese, or the American card. There’s no single official UAE rulebook, so always ask the host.', { tiles: ['J', 'F5'] }),
    S('Wherever you sit', 'So wherever you sit, ask about the house rules, keep the pace, and enjoy the company. That’s what Mahjong is really about. Four friends, one table, and a little luck and skill. Shall we try a few fun questions?', { board: 'seats' }),
  ],
  quiz: [
    Q('The Dots suit began as…', [['Copper coins', '5p'], ['Flowers', 'F1'], ['Dragon eyes', 'Rd']], 0, 'The suits began as money: Dots are coins, Bamboo are strings of coins, and Characters are ten thousands.'),
    Q('Plum, orchid, chrysanthemum and bamboo are…', ['The four flower tiles', 'The four suits', 'The four winds'], 0, 'They are the flowers, the four gentlemen of Chinese painting.'),
    Q('What does washing the tiles mean?', ['A cleansing shuffle, face down, before every hand', 'Sorting them by suit', 'Turning them all face up'], 0, 'Washing is the shuffle, and a little cleansing: tiles face down, swirled with both hands, so every hand starts fresh.'),
    Q('Seen from East, where does South sit?', ['On your right', 'Across the table', 'On your left'], 0, 'From East, South is on your right, West across, and North on your left.'),
    Q('Which of these is good table manners?', ['Call clearly and keep a steady pace', 'Discard whenever you like', 'Tidy up another player’s tiles'], 0, 'Call clearly, keep the pace, discard only on your turn, and never touch another player’s tiles.'),
    Q('Who prints a new American card every year?', ['The National Mah Jongg League', 'Nobody, the card never changes', 'Each player writes their own'], 0, 'The National Mah Jongg League publishes a new card every year.'),
    Q('Is there one official UAE rulebook?', ['No, the host sets the house rules', 'Yes, every club uses it', 'Only for American tables'], 0, 'UAE clubs play many different house rules, so always ask the host.'),
  ],
};
