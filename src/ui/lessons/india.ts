// Academy course: India Rules, from the club rulebook as transcribed in
// docs/variants/india-rules.md (book page numbers there). Seven sessions: the
// basics (Level 13), then one per round: East passports (13A), South small
// cards (13B), West goulash (13C, with its single doubles 13D and big
// doubles 13E in full example hands) and North, East's choice (13F). Each round
// ends with its score sheet. The worked examples are checked in
// test/lessons.test.ts against src/engine/rules/india.ts and indiaWest.ts.
// The book is written for a deck of cards; at JongClub the cards are tiles.

import { S, Q, type Lesson } from '../lessonKit';
import { isHonor, isTerminal, parseKinds, type Wind } from '../../engine/tiles';
import { WEST_MAX_DOUBLES, westCount } from '../../engine/rules/indiaWest';

export const indiaLesson: Lesson = {
  id: 'india',
  title: 'India Rules',
  scenes: [
    S('Welcome to India Rules', 'Welcome to India Rules, the club game played across India! It’s a game of four rounds, and every round has a game of its own. This first session gives you the tiles, the words and the sets. Then there’s one session for each round: East, South, West and North.', { tiles: ['E', 'S', 'W', 'N'] }),
    S('The tiles', 'India Rules uses all one hundred and forty-four tiles. There are three suits, numbered one to nine. Cracks are the characters, Bamboos, and Rings are the dots. Then the honours: four winds and three dragons. And four flowers and four seasons, numbered one to four.', {
      list: [
        { tiles: '1m 5m 9m', title: 'Cracks', text: 'The characters, 1 to 9' },
        { tiles: '1s 5s 9s', title: 'Bamboos', text: '1 to 9' },
        { tiles: '1p 5p 9p', title: 'Rings', text: 'The dots, 1 to 9' },
        { tiles: 'E S W N', title: 'Winds', text: 'East, South, West, North' },
        { tiles: 'Rd Gd Wd', title: 'Dragons', text: 'Red, Green, White' },
        { tiles: 'F1 F2 F3 F4 F5 F6 F7 F8', title: 'Flowers and seasons', text: 'Four of each, numbered 1 to 4' },
      ],
    }),
    S('Words you’ll hear', 'A few words come up all the time. Terminals are the ones and nines. Majors are all the honours plus the terminals. Minors are the twos to eights. Each suit also has its own dragon, its corresponding dragon. Red goes with Cracks, Green with Bamboos, and White with Rings.', {
      table: {
        head: ['Word', 'Tiles', 'Means'],
        rows: [
          ['Terminals', { tiles: '1m 9s 1p' }, 'The 1s and 9s of the three suits'],
          ['Majors', { tiles: '9m E Rd' }, 'All honours plus the terminals'],
          ['Minors', { tiles: '2m 5s 8p' }, 'The 2s to 8s'],
          ['Corresponding dragons', { tiles: 'Rd Gd Wd' }, 'Red for Cracks, Green for Bamboos, White for Rings'],
        ],
      },
    }),
    S('Green and red bamboos', 'Some hands ask for green bamboos or red bamboos, so look closely at the Bamboo tiles. The two, three, four, six and eight are all green. The one, five, seven and nine have red on them.', {
      list: [
        { tiles: '2s 3s 4s 6s 8s', title: 'Green bamboos', text: '2, 3, 4, 6 and 8' },
        { tiles: '1s 5s 7s 9s', title: 'Red bamboos', text: '1, 5, 7 and 9' },
      ],
    }),
    S('The everyday sets', 'Now the sets. A pung is three of a kind, and you can claim it from anyone’s discard if you hold a pair. A chow is a run of three in one suit, claimed only from the player on your left. A pure pair is two of a kind. And a kong is four of a kind: take an extra tile from the flower wall.', {
      cards: [
        { tiles: '555p', title: 'Pung', text: 'Three of a kind. Claim from anyone' },
        { tiles: '345m', title: 'Chow', text: 'A run in one suit. Claim from your left' },
        { tiles: 'NN', title: 'Pure pair', text: 'Two of a kind' },
        { tiles: '8888s', title: 'Kong', text: 'Four of a kind, plus an extra tile' },
      ],
    }),
    S('The Indian sets', 'India Rules adds three sets of its own. A crochet is the same number in all three suits. A knit is the same number in two suits. And a mixed chow is a run across the three suits, like a two of Cracks, a three of Bamboos and a four of Rings. These can only be taken from a discard to win.', {
      cards: [
        { tiles: '4m 4s 4p', title: 'Crochet', text: 'One number in all three suits' },
        { tiles: '7m 7s', title: 'Knit', text: 'One number in two suits' },
        { tiles: '2m 3s 4p', title: 'Mixed chow', text: 'A run across the three suits' },
      ],
    }),
    S('Bouquets and the qwong', 'Flowers and seasons make bouquets. A mixed bouquet is the numbers one to four, flowers and seasons mixed. A pure bouquet is all four flowers, or all four seasons. And in the North round only, a joker can make a qwong: five of a kind, with two extra tiles.', {
      list: [
        { tiles: 'F1 F6 F3 F8', title: 'Mixed bouquet', text: 'Numbers 1 to 4, flowers and seasons mixed' },
        { tiles: 'F1 F2 F3 F4', title: 'Pure bouquet', text: 'All four flowers, or all four seasons' },
        { tiles: '3s 3s 3s 3s J', title: 'Qwong', text: 'Five of a kind with a joker, North round only' },
      ],
    }),
    S('Points to start', 'Everyone starts with thirty-five thousand points, in tokens. Two of ten thousand, nine of one thousand, ten of five hundred, and ten of one hundred. At JongClub we count the points for you.', {
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
    S('The deal', 'The dice choose East, the dealer, and where the wall is broken. East gets fourteen tiles and everyone else thirteen. Flowers and seasons are put aside face up and replaced from the flower wall, starting with East. East begins by discarding, and play goes East, South, West, North.', { board: 'wall' }),
    S('Who gets the tile', 'When two players want the same discard, Mahjong comes first, then pung, then chow. If two players both call Mahjong, the player whose turn comes first wins it. Sets you have shown can’t be changed. And to win, you may take a discard from anyone, for any set.', {
      table: {
        head: ['Call', 'From', 'Priority'],
        rows: [
          ['Mahjong', 'Anyone, for any set', 'First'],
          ['Pung or kong', 'Anyone', 'Second'],
          ['Chow', 'The player on your left', 'Third'],
        ],
      },
    }),
    S('East pays double', 'Here’s the big one. East always pays and receives double. When East wins, everyone pays East twice as much. When someone else wins, East pays them twice as much. A player who calls a wrong Mahjong, or holds the wrong number of tiles, is dead: they play on, but they can’t win.', { tiles: ['E'] }),
    S('A match of four rounds', 'A full match is sixteen games, four rounds of four, so everyone is East once a round. The East round is played with passports. The South round with small cards. The West round is the goulash. And in the North round, East chooses the game. Each round has its own session next. Shall we try your test?', {
      table: {
        head: ['Round', 'The game', 'What’s special'],
        rows: [
          [{ tiles: 'E', text: 'East' }, 'Passport', 'Special groups of 5, 6 or 9 tiles'],
          [{ tiles: 'S', text: 'South' }, 'Small cards', 'A secret card names your hand'],
          [{ tiles: 'W', text: 'West' }, 'Goulash', 'Only pungs and kongs, scored in doubles'],
          [{ tiles: 'N', text: 'North' }, 'East’s choice', 'Any round again, jokers, or a big card'],
        ],
      },
    }),
  ],
  quiz: [
    Q('Which of these is a crochet?', [['The same number in three suits', '4m 4s 4p'], ['A run in one suit', '456p'], ['Three of one honour', 'RdRdRd']], 0, 'A crochet is the same number in all three suits, like four of Cracks, four of Bamboos and four of Rings.'),
    Q('Which is the corresponding dragon for Bamboos?', [['Green', 'Gd'], ['Red', 'Rd'], ['White', 'Wd']], 0, 'Green goes with Bamboos, Red with Cracks, and White with Rings.'),
    Q('What are majors?', ['All honours plus the ones and nines', 'Only the dragons', 'The twos to eights'], 0, 'Majors are the honours and the terminals. The twos to eights are minors.'),
    Q('Who pays and receives double?', ['East', 'The player on the left', 'Nobody'], 0, 'East always pays and receives double in India Rules.'),
    Q('How many games make a full match?', ['Sixteen, in four rounds', 'Four', 'Eight, in two rounds'], 0, 'Four rounds of four games, so everyone is East once in every round.'),
  ],
};

export const indiaEastLesson: Lesson = {
  id: 'india-east',
  title: 'India Rules: the East round',
  base: 'india',
  scenes: [
    S('The East round', 'Welcome to the East round, the round of passports! Four games are played, with each player East once. You win with fourteen tiles: four sets of three and a pair. Your sets can be pungs, chows, mixed chows or crochets. The pair is a pure pair, or a knit, but a knit only when your hand also holds a crochet.', { tiles: ['555p', '345m', '2m 3s 4p', '4m 4s 4p', 'NN'] }),
    S('What is a passport?', 'Instead of plain sets, you can build a passport. A passport is a special group of nine, six or five tiles. Once it’s ready, you finish the hand with sets and a pair. Your table decides: passports can be optional, or compulsory, so every winning hand must have one.', { tiles: ['444m 777s 222p', '345s', 'WdWd'] }),
    S('Nine-tile passports: pungs', 'There are six nine-tile passports. The first two are made of pungs. Three pungs in three different suits, like fours of Cracks, sevens of Bamboos and twos of Rings. Or three pungs all in the same suit.', {
      list: [
        { tiles: '444m 777s 222p', title: 'Three pungs in three different suits', text: '9 tiles' },
        { tiles: '222p 555p 888p', title: 'Three pungs in the same suit', text: '9 tiles' },
      ],
    }),
    S('Nine-tile passports: chows', 'The next two are made of chows. Three chows in three different suits, or three chows all in the same suit.', {
      list: [
        { tiles: '123m 456s 789p', title: 'Three chows in three different suits', text: '9 tiles' },
        { tiles: '123s 456s 789s', title: 'Three chows in the same suit', text: '9 tiles' },
      ],
    }),
    S('Nine-tile passports: crochets and mixed chows', 'And the last two use the Indian sets. Three crochets: three numbers, each in all three suits. Or three mixed chows: three runs, each across the three suits.', {
      list: [
        { tiles: '2m 2s 2p 5m 5s 5p 8m 8s 8p', title: 'Three crochets', text: '9 tiles' },
        { tiles: '1m 2s 3p 4s 5p 6m 7p 8m 9s', title: 'Three mixed chows', text: '9 tiles' },
      ],
    }),
    S('Six-tile passports', 'There are three six-tile passports, all made of pairs. Three pairs in the same suit. Three pairs in three different suits. Or three knits in the same two suits.', {
      list: [
        { tiles: '33s 66s 99s', title: 'Three pairs in the same suit', text: '6 tiles' },
        { tiles: '22m 55s 88p', title: 'Three pairs in three different suits', text: '6 tiles' },
        { tiles: '3m 3s 5m 5s 7m 7s', title: 'Three knits in the same two suits', text: '6 tiles' },
      ],
    }),
    S('Five-tile passports', 'And four five-tile passports. A pung of any honour with a pair of any honour. All four winds, NEWS, plus one more wind. All three dragons with a pair of honours. Or a crochet with a knit.', {
      list: [
        { tiles: 'EEE RdRd', title: 'Honour pung and honour pair', text: 'Winds or dragons' },
        { tiles: 'N E W S W', title: 'NEWS and another wind', text: 'One of each wind, plus one more' },
        { tiles: 'Gd Rd Wd NN', title: 'Three dragons and an honour pair', text: 'Green, Red, White and any honour pair' },
        { tiles: '6m 6s 6p 9m 9s', title: 'Crochet and knit', text: 'Same number in three suits, then in two' },
      ],
    }),
    S('Putting it together', 'You can even hold more than one passport. Here are the ways to reach fourteen. The threes that finish a passport hand can be a chow, a mixed chow, a pung of any suit or honour, or a crochet. The two is any pure pair, or a knit if you hold a crochet.', {
      table: {
        head: ['Passports', 'Then', 'Tiles'],
        rows: [
          ['One 5', '3 + 3 + 3', '14'],
          ['One 6', '3 + 3 + 2', '14'],
          ['One 9', '3 + 2', '14'],
          ['A 5 and a 6', '3', '14'],
          ['Two 6s', '2', '14'],
          ['A 9 and a 5', 'Nothing else', '14'],
        ],
      },
    }),
    S('A passport hand', 'Here’s a winner. You sit South. A nine-tile passport of three pungs in three different suits, a chow of Cracks, and a pair of White dragons. Every tile came from the wall, and only the last White dragon came from a discard. That’s a concealed hand.', {
      hand: {
        title: 'East round · Passport 9 + 3 + 2 · Concealed',
        groups: [
          { tiles: '444m', label: 'Passport', sub: '4 Cracks', flag: 'Three pungs, three suits', mark: 'hl' },
          { tiles: '777s', label: 'Passport', sub: '7 Bamboos', mark: 'hl' },
          { tiles: '222p', label: 'Passport', sub: '2 Rings', mark: 'hl' },
          { tiles: '567m', label: 'Chow', sub: '5-6-7 Cracks' },
          { tiles: 'WdWd', label: 'Pair', sub: 'White dragons', flag: 'Won on a discard', mark: 'win' },
        ],
        facts: ['You sit South', 'Nothing exposed', 'Last tile from a discard'],
        scoreTitle: 'How it pays',
        faan: [['Concealed hand', '1,000 each']],
        pay: [
          { who: 'East pays double', amount: '2,000', big: true },
          { who: 'West and North pay', amount: '1,000 + 1,000' },
        ],
        winner: 'You collect 4,000',
      },
    }),
    S('Score sheet: winning', 'Here’s the East round score sheet. Everyone else pays the winner. A normal hand, with something exposed, pays five hundred, and East pays one thousand. A concealed hand, with only the last tile from a discard, pays one thousand: winning on a discard still counts as concealed. Fully concealed, the last tile drawn yourself, pays two thousand. And when East wins, everyone pays East double.', {
      table: {
        title: 'East round score sheet',
        head: ['Hand', 'Each player pays', 'East pays', 'If East wins, each pays'],
        rows: [
          ['Normal: something exposed', '500', '1,000', '1,000'],
          ['Concealed: only the last tile from a discard', '1,000', '2,000', '2,000'],
          ['Fully concealed: the last tile drawn too', '2,000', '4,000', '4,000'],
        ],
      },
    }),
    S('Score sheet: flowers', 'Flowers and seasons are paid by every player, whoever wins, and even when the wall runs out. And here East pays the same as everyone, not double. Your own flower and season together earn five hundred. So does the pair for the round. A mixed bouquet is five hundred, and a pure bouquet is one thousand.', {
      table: {
        title: 'Flowers and seasons, from each player',
        head: ['You hold', 'Tiles', 'Each pays'],
        rows: [
          ['Your own flower and season', { tiles: 'F2 F6', text: 'South: number 2' }, '500'],
          ['The round’s flower and season', { tiles: 'F1 F5', text: 'East round: number 1' }, '500'],
          ['Mixed bouquet', { tiles: 'F1 F6 F3 F8' }, '500'],
          ['Pure bouquet', { tiles: 'F1 F2 F3 F4' }, '1,000'],
        ],
      },
    }),
    S('East round tips', 'A few tips. Keep your hand flexible, and when you draw a tile, check whether a better passport has opened up. Keep track of the tiles already thrown. And near the end, keep the sets with the most ways to win. Shall we try your test?', { tiles: ['444m', '777s', '22p'] }),
  ],
  quiz: [
    Q('Which of these is a nine-tile passport?', [['Three pungs in three different suits', '444m 777s 222p'], ['Three pairs in one suit', '33s 66s 99s'], ['NEWS and another wind', 'N E W S W']], 0, 'Three pungs in three different suits is nine tiles. Three pairs is six, and NEWS with another wind is five.'),
    Q('With a nine-tile passport, what finishes the hand?', ['A set of three and a pair', 'Two pairs', 'Nothing'], 0, 'Nine plus three plus two makes fourteen.'),
    Q('You win fully concealed in the East round, and you are not East. What does West pay?', ['Two thousand', 'Five hundred', 'One thousand'], 0, 'Fully concealed pays two thousand from each player, and East pays four thousand.'),
    Q('When may a knit be your pair?', ['When your hand also holds a crochet', 'Whenever you like', 'Never'], 0, 'A knit may stand in for the pair only when your hand also holds a crochet.'),
    Q('You hold a pure bouquet. Who pays you?', ['Every player, one thousand each, even on a draw', 'Only the winner', 'Nobody unless you win'], 0, 'Flowers and seasons are paid by every player, whoever wins, and East pays the same.'),
  ],
};

export const indiaSouthLesson: Lesson = {
  id: 'india-south',
  title: 'India Rules: the South round',
  base: 'india',
  scenes: [
    S('The South round', 'Welcome to the South round, the round of small cards! Four more games, each player East once. After the flowers are replaced, every player gets a small card, in secret. Your card names the hand you must make to win. There are fifty-five small cards. Some tables let you draw three and keep one.', { tiles: ['S'] }),
    S('Reading your card', 'Every card has a name, the hand, and its value. Lily of the Valley asks for pungs of Green and White dragons, two pungs of green bamboos, and a pair of green bamboos. Some cards also say all from the wall. Then you may not take any discard, not even to win.', {
      cards: [
        { tiles: 'GdGdGd WdWdWd 222s 666s 88s', title: 'Lily of the Valley', alt: 'Double limit', text: 'Green and White dragon pungs, two green bamboo pungs, a green bamboo pair' },
        { tiles: '555m 888p NNN 234s 77p', title: 'Western Command', alt: 'Limit', text: 'Any three pungs, a chow and a pair' },
        { tiles: '11p 22p 44p 55p 66p 88p 99p', title: 'Heavenly Twins', alt: 'Limit', text: 'Seven pairs in one suit' },
      ],
    }),
    S('The compulsory exchange', 'Before play, everyone must swap tiles three times, three tiles each time, given face down and at the same time. First East swaps with South, and West with North. Then East with North, and South with West. Then East with West, and South with North. Give away what your card doesn’t need!', {
      table: {
        title: 'Three swaps of three tiles',
        head: ['Swap', 'East with', 'And'],
        rows: [
          ['First', 'South', 'West with North'],
          ['Second', 'North', 'South with West'],
          ['Third', 'West', 'South with North'],
        ],
      },
    }),
    S('Tic-Tac-Toe', 'Next, East may call Tic-Tac-Toe. It’s optional, once or three times. Each player puts one tile face down in front of each other player: East first, then South, West and North. Then everyone picks up the three tiles in front of them.', { demo: 'tictactoe' }),
    S('The wall exchange', 'Then East may order a wall exchange, again once or three times. Each player puts three tiles face down, and takes any three from the wall. Not from the flower wall, not from the starting pile, and not from your own pile. The tiles put down are mixed back into the wall. Then East starts by discarding.', { demo: 'wallswap' }),
    S('Buying a tile', 'Here’s something new. You may buy the discard of the player on your left, for one hundred points. A bought tile stays hidden in your hand, and you can use it in any set. The money goes to whoever wins that game. If nobody wins, it waits for the next winner.', {
      table: {
        head: ['Buying', ''],
        rows: [
          ['From', 'Only the player on your left'],
          ['Price', '100 points'],
          ['The tile', 'Stays hidden, use it in any set'],
          ['The money', 'Goes to the winner of the game, or waits after a draw'],
        ],
      },
    }),
    S('Claiming tiles', 'Otherwise you can claim discards as usual, for a pung, a kong, a chow, or to win. Unless your card says all from the wall: then no discard may be taken, not even for Mahjong. Buying from your left is still allowed. A tip: buy from the left even when you could chow, because a bought tile stays hidden.', { tiles: ['5p'] }),
    S('Score sheet: card values', 'Your card says what it’s worth, and everyone pays the winner. Half limit is five hundred, and East pays one thousand. Limit is one thousand. Double limit is two thousand. Super limit, four thousand. And top limit is ten thousand. East always pays and receives double. Flowers pay just as in the East round. When a card pays more concealed, concealed means nothing exposed before your Mahjong: winning on a discard still counts.', {
      table: {
        title: 'South round score sheet',
        head: ['Card value', 'Each player pays', 'East pays', 'If East wins, each pays'],
        rows: [
          ['Half limit', '500', '1,000', '1,000'],
          ['Limit', '1,000', '2,000', '2,000'],
          ['Double limit', '2,000', '4,000', '4,000'],
          ['Super limit', '4,000', '8,000', '8,000'],
          ['Top limit', '10,000', '20,000', '20,000'],
        ],
      },
    }),
    S('A small card hand', 'Here’s a winner. You sit West, and your card is Western Command, a limit hand: any three pungs, a chow and a pair. You bought one tile from your left during the game, and so did North. Everyone pays you the limit, East pays double, and you collect the two hundred in buy money too.', {
      hand: {
        title: 'South round · Western Command · Limit',
        groups: [
          { tiles: '555m', label: 'Pung', sub: '5 Cracks' },
          { tiles: '888p', label: 'Pung', sub: '8 Rings', flag: 'Bought', mark: 'hl' },
          { tiles: 'NNN', label: 'Pung', sub: 'North wind' },
          { tiles: '234s', label: 'Chow', sub: '2-3-4 Bamboos' },
          { tiles: '77p', label: 'Pair', sub: '7 Rings', mark: 'win' },
        ],
        facts: ['You sit West', 'Card: Western Command', '200 in buy money'],
        pay: [
          { who: 'East pays double', amount: '2,000', big: true },
          { who: 'South and North pay', amount: '1,000 + 1,000' },
          { who: 'The buy money', amount: '200' },
        ],
        winner: 'You collect 4,200',
      },
    }),
    S('When nobody wins', 'If the wall runs out and nobody wins, the deal still passes to the next player, and the buy money waits for the next winner. There is no extra game: every round is exactly four games.', { tiles: ['E'] }),
    S('Card families', 'With fifty-five cards, it helps to know the families. Dragon and bamboo hands, like Royal Ruby and Imperial Jade. Wind hands, like Four Blessings. Pair hands, from Heavenly Twins to Dirty Pairs, any seven pairs, worth half limit. And long runs, like Golden Staircase, one to nine in one suit.', {
      cards: [
        { tiles: 'RdRdRd 111s 555s 777s 99s', title: 'Royal Ruby', alt: 'Double limit', text: 'Red dragon pung, three red bamboo pungs, a red bamboo pair' },
        { tiles: 'EEE SSS WWW NNN RdRd', title: 'Four Blessings', alt: 'Double limit', text: 'Pungs of all four winds and any pair' },
        { tiles: '11m 33s 44s 77p 99p EE RdRd', title: 'Dirty Pairs', alt: 'Half limit', text: 'Any seven pairs' },
        { tiles: '123456789m EEE NN', title: 'Golden Staircase', alt: 'Limit', text: '1 to 9 in one suit, a concealed honour pung, an honour pair' },
      ],
    }),
    S('South round tips', 'Read your card carefully before the exchange. The exchanges are important and strategic: think about what the others might be collecting from the tiles they give and keep. And remember, buying keeps your hand hidden. Shall we try your test?', { tiles: ['S'] }),
  ],
  quiz: [
    Q('Who may you buy a discard from?', ['The player on your left', 'Anyone', 'Only East'], 0, 'You may buy only from the player on your left, for one hundred points.'),
    Q('Your card says all from the wall. May you take a discard to win?', ['No, not even for Mahjong', 'Yes, only to win', 'Yes, for any set'], 0, 'All from the wall means no discard may be taken, not even for Mahjong. Buying is still allowed.'),
    Q('In the first compulsory swap, who does East swap with?', ['South', 'North', 'West'], 0, 'First East and South swap, and West and North. Then East and North, then East and West.'),
    Q('You win a limit hand and you are not East. What does East pay you?', ['Two thousand', 'One thousand', 'Five hundred'], 0, 'A limit hand is one thousand from each player, and East pays double.'),
    Q('Where does the buy money go?', ['To the winner of the game', 'Back to the buyers', 'To East'], 0, 'The buy money goes to the winner. After a draw it waits for the next winner.'),
  ],
};

// ------------------------------------------------------------ West round examples

/** One goulash example hand: sets in parseKinds notation, `!` after a set for exposed. */
export interface GoulashExample {
  title: string;
  say: string;
  sets: string[];
  pair: string;
  flowers?: string;
  seat?: Wind;
  /** The set the winning tile finished (an index into sets), or the pair when left out. */
  winSet?: number;
  wall?: boolean;
  last?: boolean;
  earthly?: boolean;
  heavenly?: boolean;
  /** The sets the example is about. */
  show?: number[];
  /** The score Mei says, checked against the engine in test/lessons.test.ts. */
  score: number;
}

const n = (x: number) => x.toLocaleString('en-US');
const SEAT_NAME: Record<Wind, string> = { E: 'East', S: 'South', W: 'West', N: 'North' };

/** The Goulash count of an example, by the engine's own rules. */
export function goulashCount(x: GoulashExample) {
  const seat = x.seat ?? 'S';
  const won = x.winSet ?? -1;
  const groups = x.sets.map((s, i) => {
    const kinds = parseKinds(s.replace('!', ''));
    // A pung finished by a discard counts as exposed.
    return { kind: kinds[0], kong: kinds.length === 4, concealed: !s.endsWith('!') && !(i === won && !x.wall) };
  });
  const flowers = x.flowers ? parseKinds(x.flowers) : [];
  const kinds = [...x.sets.flatMap((s) => parseKinds(s.replace('!', ''))), ...parseKinds(x.pair)];
  const win = { selfDrawn: !!x.wall, concealed: !x.sets.some((s) => s.endsWith('!')), lastTile: !!x.last, earthly: !!x.earthly, heavenly: !!x.heavenly };
  return { groups, flowers, ...westCount(kinds, groups, parseKinds(x.pair)[0], flowers, seat, 'W', win) };
}

const major = (k: number) => isHonor(k) || isTerminal(k);

function goulashScene(x: GoulashExample) {
  const c = goulashCount(x);
  const won = x.winSet ?? -1;
  const how = x.heavenly ? 'Dealt to East' : x.wall ? 'Drawn from the wall' : x.earthly ? 'East’s first discard' : 'Won on a discard';
  const parts: number[] = [];
  const groups = x.sets.map((s, i) => {
    const g = c.groups[i];
    const pts = (g.kong ? (major(g.kind) ? 16 : 8) : major(g.kind) ? 4 : 2) * (g.concealed ? 2 : 1);
    parts.push(pts);
    const exposed = s.endsWith('!');
    return {
      tiles: s.replace('!', ''),
      label: g.kong ? 'Kong' : 'Pung',
      sub: `${exposed || !g.concealed ? 'Exposed' : 'Concealed'}: ${pts}`,
      flag: i === won ? how : exposed ? 'Exposed' : undefined,
      mark: i === won ? ('win' as const) : x.show?.includes(i) ? ('hl' as const) : exposed ? ('called' as const) : undefined,
    };
  });
  const pairKind = parseKinds(x.pair)[0];
  const pairPts = major(pairKind) ? 2 : 0;
  if (pairPts) parts.push(pairPts);
  groups.push({ tiles: x.pair, label: 'Pair', sub: `${pairPts ? 'A major pair' : 'A minor pair'}: ${pairPts}`, flag: won < 0 ? how : undefined, mark: won < 0 ? 'win' : undefined });
  if (c.flowers.length) {
    parts.push(c.flowers.length * 4);
    groups.push({ tiles: x.flowers!, label: c.flowers.length > 1 ? 'Flowers' : 'Flower', sub: `4 each: ${c.flowers.length * 4}`, flag: undefined, mark: 'hl' });
  }
  const sum = c.items.reduce((a, b) => a + b.value, 0);
  const faan: [string, number][] = c.items.map((i) => [i.name, i.value]);
  return S(x.title, x.say, {
    hand: {
      title: `West round · ${c.clean} · ${c.points} points, ${c.doubles} doubles`,
      groups,
      facts: [`You sit ${SEAT_NAME[x.seat ?? 'S']}`, `Points ${parts.join(' + ')} + 20 for Mahjong = ${c.points}`, ...(sum > WEST_MAX_DOUBLES ? [`${sum} doubles, capped at ${WEST_MAX_DOUBLES}`] : [])],
      scoreTitle: 'Doubles',
      faan,
      total: `${c.points} × ${n(2 ** c.doubles)} = ${n(c.score)}`,
    },
  });
}

/** Every double on the West round score sheet, each in a real winning hand (you sit South). */
export const WEST_EXAMPLES: GoulashExample[] = [
  { title: 'Three concealed pungs · 1 double', sets: ['SSS!', '333s', '666s', 'WdWdWd'], pair: '99s', show: [1, 2, 3], score: 336,
    say: 'Three concealed pungs, one double. A concealed pung is one you formed in your hand from the wall, not from a discard. Here the threes, the sixes and the White dragons are all concealed, and only the South pung is exposed. Doubles: three concealed pungs, your own wind South, and the White dragon. That’s three. Forty-two points, doubled three times, is three hundred and thirty-six.' },
  { title: 'Each dragon pung · 1 double', sets: ['RdRdRd!', 'GdGdGd', '222s', '444s'], pair: '88s', show: [0, 1], score: 320,
    say: 'Each dragon pung or kong is one double, so two dragons are two doubles. Red is exposed and Green is concealed, with concealed pungs of two and four Bamboo and a pair of eights. Red, Green, and three concealed pungs: three doubles. Forty points, doubled three times, is three hundred and twenty.' },
  { title: 'All three dragons · 1 more double', sets: ['RdRdRd!', 'GdGdGd', 'WdWdWd', '444p'], pair: '66p', show: [0, 1, 2], score: 1408,
    say: 'Hold all three dragon pungs and you get one more double, on top of one for each dragon. Red exposed, Green and White concealed, a concealed pung of four Rings and a pair of sixes. Three dragons, plus one for all three, plus three concealed pungs: five doubles. Forty-four points, doubled five times, is one thousand, four hundred and eight.' },
  { title: 'Your own wind · 1 double', sets: ['SSS!', 'RdRdRd', '555p', '777p'], pair: '99p', show: [0], score: 336,
    say: 'Your own seat wind is one double. You sit South, so a pung of South counts. Here it’s exposed, with concealed Red dragons, fives and sevens of Rings, and a pair of nines. Own wind, Red dragon, and three concealed pungs: three doubles. Forty-two points, doubled three times, is three hundred and thirty-six.' },
  { title: 'The round wind · 1 double', sets: ['WWW!', 'GdGdGd', '222m', '666m'], pair: '88m', show: [0], score: 320,
    say: 'This is the West round, so a pung of West is one double for every player. Exposed West, concealed Green dragons, twos and sixes of Cracks, and a pair of eights. Round wind, Green dragon, and three concealed pungs: three doubles. Forty points, doubled three times, is three hundred and twenty.' },
  { title: 'Three wind pungs · 1 double', sets: ['EEE!', 'SSS', 'WWW', '555s'], pair: '77s', show: [0, 1, 2], score: 704,
    say: 'Three wind pungs are one double. East is exposed, South and West are concealed. And look what else they bring: South is your own wind, and West is the round wind. Three winds, own wind, round wind, and three concealed pungs with the fives: four doubles. Forty-four points, doubled four times, is seven hundred and four.' },
  { title: 'Ones and nines in one suit · 1 double', sets: ['111m!', '999m', '555m', 'SSS'], pair: '22m', show: [0, 1], score: 352,
    say: 'A pung of ones and a pung of nines in the same suit is one double. Here, one Crack exposed and nine Crack concealed, with fives of Cracks, your own wind South, and a pair of twos. Ones and nines, own wind, and three concealed pungs: three doubles. Forty-four points, doubled three times, is three hundred and fifty-two.' },
  { title: 'A major hand · 1 double', sets: ['NNN!', 'GdGdGd', '111p', '999p'], pair: 'EE', show: [2, 3], score: 800,
    say: 'A major hand is honours with terminal pungs of one suit, and nothing in between. It’s one double. North exposed, Green dragons, ones and nines of Rings concealed, and a pair of East. Major hand, ones and nines in Rings, Green dragon, and three concealed pungs: four doubles. Fifty points, doubled four times, is eight hundred.' },
  { title: 'Your own flower and season · 1 double each', sets: ['RdRdRd!', '222s', '444s', '777s'], pair: '55s', flowers: 'F2 F6', score: 704,
    say: 'Flowers and seasons are numbered one to four, East to North. You sit South, so flower two and season two are yours: one double each, and every flower is four points. Red dragon exposed, concealed twos, fours and sevens of Bamboo, and a pair of fives. Red, three concealed pungs, own flower and own season: four doubles. Forty-four points, doubled four times, is seven hundred and four.' },
  { title: 'The round’s flower and season · 1 double each', sets: ['GdGdGd!', '333m', '555m', '777m'], pair: '99m', flowers: 'F3 F7', score: 736,
    say: 'West is the third wind, so in the West round flower three and season three are one double each, for every player. Green dragon exposed, concealed threes, fives and sevens of Cracks, and a pair of nines. Green, three concealed pungs, round flower and round season: four doubles. Forty-six points, doubled four times, is seven hundred and thirty-six.' },
  { title: 'Mahjong on the last tile · 1 double', sets: ['WdWdWd!', '222p', '555p', '888p'], pair: '33p', wall: true, last: true, score: 288,
    say: 'Win with the very last tile of the wall and you get one double. Here the last tile you draw makes your pair of threes. White dragon exposed, concealed twos, fives and eights of Rings. White, three concealed pungs, and the last tile: three doubles. Thirty-six points, doubled three times, is two hundred and eighty-eight.' },
  { title: 'Four concealed pungs · 2 doubles', sets: ['222p', '444p', '777p', 'RdRdRd'], pair: '99p', show: [0, 1, 2, 3], score: 2688,
    say: 'Four concealed pungs are two doubles. Every pung is formed in your hand, and a discard only finished your pair of nines, so the pungs stay concealed. With nothing exposed, it’s also a concealed Mahjong, three more. Four concealed pungs, concealed Mahjong and the Red dragon: six doubles. Forty-two points, doubled six times, is two thousand, six hundred and eighty-eight.' },
  { title: 'Three exposed kongs · 2 doubles', sets: ['5555m!', '8888m!', 'SSSS!', '222m'], pair: '99m', show: [0, 1, 2], score: 464,
    say: 'Three exposed kongs are two doubles. Fives and eights of Cracks and your own wind, South, all taken from discards, with a concealed pung of twos and a pair of nines. Three exposed kongs and your own wind: three doubles. Fifty-eight points, doubled three times, is four hundred and sixty-four. And remember, with three exposed sets, winning on a discard can bring the penalty.' },
  { title: 'Four wind pungs · 2 doubles', sets: ['EEE!', 'SSS!', 'WWW', 'NNN'], pair: '55s', show: [0, 1, 2, 3], score: 704,
    say: 'All four wind pungs are two doubles. East and South exposed, West and North concealed, and a pair of five Bamboo. South is your own wind and West is the round wind, one more double each. That’s four doubles. Forty-four points, doubled four times, is seven hundred and four.' },
  { title: 'All honours · 3 doubles', sets: ['EEE!', 'NNN!', 'RdRdRd', 'GdGdGd'], pair: 'WdWd', show: [0, 1, 2, 3], score: 1472,
    say: 'A hand of only winds and dragons is all honours: three doubles. East and North exposed, Red and Green dragons concealed, and a pair of White dragons. All honours, Red and Green: five doubles. Forty-six points, doubled five times, is one thousand, four hundred and seventy-two.' },
  { title: 'A clean suit · 3 doubles', sets: ['222s!', '444s!', '666s', '888s'], pair: '99s', show: [0, 1, 2, 3], score: 272,
    say: 'One suit with no honours at all is a clean suit: three doubles, enough to win on its own. Twos and fours of Bamboo exposed, sixes and eights concealed, and a pair of nines. Only two concealed pungs, so no double for those. Thirty-four points, doubled three times, is two hundred and seventy-two.' },
  { title: 'A terminal hand · 3 doubles', sets: ['111m!', '999s', '111p', '999p'], pair: '11s', show: [0, 1, 2, 3], score: 1600,
    say: 'Only ones and nines, in any suits, is a terminal hand: three doubles. One Crack exposed; nine Bamboo, one Ring and nine Ring concealed; and a pair of one Bamboo. Terminal hand, ones and nines in Rings, and three concealed pungs: five doubles. Fifty points, doubled five times, is one thousand, six hundred.' },
  { title: 'A bouquet · 3 doubles', sets: ['RdRdRd!', '222s', '555s', '777s'], pair: '99s', flowers: 'F1 F2 F3 F4', score: 6912,
    say: 'All four flowers, one to four, are a bouquet: three doubles. All four seasons are a bouquet too. And the bouquet still holds your own flower, two, and the round’s, three, one double each. Red dragon exposed, concealed twos, fives and sevens of Bamboo, and a pair of nines. Red, three concealed pungs, own flower, round flower and the bouquet: seven doubles. Fifty-four points, doubled seven times, is six thousand, nine hundred and twelve.' },
  { title: 'Three concealed kongs · 3 doubles', sets: ['2222p', '5555p', '8888p', 'RdRdRd!'], pair: '11p', show: [0, 1, 2], score: 1184,
    say: 'Three concealed kongs, drawn from the wall, are three doubles. Twos, fives and eights of Rings, each worth sixteen points, with an exposed Red dragon pung and a pair of ones. Three concealed kongs and the Red dragon: four doubles. Seventy-four points, doubled four times, is one thousand, one hundred and eighty-four.' },
  { title: 'Four exposed kongs · 3 doubles', sets: ['3333s!', '6666s!', '9999s!', 'GdGdGdGd!'], pair: '22s', show: [0, 1, 2, 3], score: 1088,
    say: 'Four exposed kongs are three doubles. Threes, sixes and nines of Bamboo and the Green dragons, all from discards, and a pair of twos. Four exposed kongs and the Green dragon: four doubles. Sixty-eight points, doubled four times, is one thousand and eighty-eight.' },
  { title: 'Concealed Mahjong · 3 doubles', sets: ['111m', '444m', '777m', 'WWW'], pair: '99m', winSet: 2, score: 1408,
    say: 'Win with nothing exposed and it’s a concealed Mahjong: three doubles. Winning on a discard still counts. But watch the winning tile. A discard finished the pung of sevens, so that pung counts as exposed: two points, not four. The ones, the fours and West stay concealed, with a pair of nines. Concealed Mahjong, the round wind, and three concealed pungs: five doubles. Forty-four points, doubled five times, is one thousand, four hundred and eight.' },
  { title: 'Four concealed kongs · 4 doubles', sets: ['2222s', '4444s', '6666s', 'RdRdRdRd'], pair: '55s', wall: true, show: [0, 1, 2, 3], score: 25600,
    say: 'Four concealed kongs are four doubles. Twos, fours and sixes of Bamboo, and the Red dragons, all drawn from the wall, and you draw the second five for your pair. Four concealed kongs, concealed Mahjong and the Red dragon: eight doubles. One hundred points, doubled eight times, is twenty-five thousand, six hundred.' },
  { title: 'Four winds and a dragon pair · 7 doubles', sets: ['EEE!', 'SSS!', 'WWW', 'NNN'], pair: 'RdRd', show: [0, 1, 2, 3], score: 47104,
    say: 'Four wind pungs with a pair of dragons are seven doubles. East and South exposed, West and North concealed, and a pair of Red dragons. It’s all honours too, three more, with your own wind and the round wind: twelve doubles. But the chart stops at ten. Forty-six points, doubled ten times, is forty-seven thousand, one hundred and four.' },
  { title: 'Earth’s Blessing · 8 doubles', sets: ['RdRdRd', '222s', '555s', '777s'], pair: '99s', earthly: true, score: 43008,
    say: 'Earth’s Blessing is eight doubles: you win on East’s very first discard. You were dealt Red dragons and twos, fives and sevens of Bamboo, all concealed, with a single nine, and East throws the other nine. Add four concealed pungs, concealed Mahjong and the Red dragon: fourteen doubles, capped at ten. Forty-two points, doubled ten times, is forty-three thousand and eight.' },
  { title: 'Heaven’s Blessing · 9 doubles', sets: ['111p', '333p', '555p', 'GdGdGd'], pair: '77p', seat: 'E', wall: true, heavenly: true, score: 45056,
    say: 'Heaven’s Blessing is nine doubles, and only East can have it: East is dealt a complete hand. Ones, threes and fives of Rings, Green dragons, and a pair of sevens. With four concealed pungs, concealed Mahjong and the Green dragon, that’s fifteen doubles, capped at ten. Forty-four points, doubled ten times, is forty-five thousand and fifty-six. And East is paid double.' },
];

export const indiaWestLesson: Lesson = {
  id: 'india-west',
  title: 'India Rules: the West round',
  base: 'india',
  scenes: [
    S('The West round: Goulash', 'Welcome to the West round, the goulash! Like the Hungarian stew, everything gets mixed. Four games again. The deal and the exchanges are just like the South round: three compulsory swaps, then East may call Tic-Tac-Toe and wall exchanges. But there are no cards, and no buying. And keep your flowers face down.', { tiles: ['W'] }),
    S('Pungs and kongs only', 'Goulash is a game of pungs and kongs, with one pure pair to finish. No chows, no crochets, no knits and no mixed chows. You may take a discard for a pung or a kong, and the last tile to win.', { tiles: ['RdRdRd', '1111s', '999s', 'WdWdWd', '55s'] }),
    S('Kongs in the goulash', 'A kong taken from a discard is exposed. A kong from the wall is concealed. If you pung from a discard, the fourth tile can only come from the wall. And once you have three exposed pungs or kongs, you must show your concealed kong and your flowers too.', {
      table: {
        head: ['Kong', 'Counts as'],
        rows: [
          ['Taken from a discard', 'Exposed'],
          ['Drawn from the wall', 'Concealed'],
          ['A pung from a discard, later a kong', 'The fourth tile from the wall only'],
        ],
      },
    }),
    S('A clean hand', 'Your points only count with a clean hand. One suit with honours, with at least one honour pung. An honour hand with terminal pungs in one suit, a major hand. Or a terminal hand: only pungs of ones and nines, in any suits. More than one suit is dirty, and a dirty hand has no points.', {
      list: [
        { tiles: '222s 666s 888s EEE RdRd', title: 'One suit with honours', text: 'One suit, with an honour pung' },
        { tiles: 'SSS GdGdGd 111p 999p NN', title: 'Major hand', text: 'Honours with terminal pungs in one suit' },
        { tiles: '111m 999s 111p 999p 11s', title: 'Terminal hand', text: 'Pungs of 1s and 9s, any suits' },
        { tiles: '222s 666p 888s EEE RdRd', title: 'Dirty', text: 'Two suits: no points, so no Mahjong' },
      ],
    }),
    S('Clean, and three doubles', 'So you need two things to go Mahjong: a clean hand, and at least three doubles. Can flowers rescue a dirty hand? No. The book says a dirty hand’s points don’t count, and even three doubles can’t save a hand that ends the wrong way. A dirty hand scores nothing, so it can’t go Mahjong, however many flowers it holds.', {
      list: [
        { tiles: 'RdRdRd GdGdGd 222s 444s 88s', title: 'Clean, 3 doubles: Mahjong', text: 'Bamboos with dragons. Red, Green and three concealed pungs' },
        { tiles: '222s 666p 888s RdRdRd SS F2 F3 F6', title: 'Dirty, 4 doubles: no Mahjong', text: 'Bamboos and Rings. The flowers can’t make it clean' },
      ],
    }),
    S('Part 1 of the count: points', 'A goulash count has two parts: points and doubles. This is part one, the points. Every pung, kong, flower and major pair scores points, and concealed sets score double. Mahjong itself adds twenty more. Part two, the doubles, comes next.', {
      table: {
        title: 'Part 1: points',
        head: ['Set', 'Exposed', 'Concealed'],
        rows: [
          ['Pung of minors, 2 to 8', '2', '4'],
          ['Pung of majors, 1s, 9s and honours', '4', '8'],
          ['Kong of minors', '8', '16'],
          ['Kong of majors', '16', '32'],
          ['Each flower or season', '4', '4'],
          ['Pair of majors', '2', '2'],
          ['Mahjong', '20', ''],
        ],
      },
    }),
    S('Part 2 of the count: doubles', 'Part two is the doubles, and here’s every one. You need at least three to go Mahjong. The next two sessions show each of them in a full winning hand, with every point and double counted, so you don’t need to learn them all now.', {
      table: {
        title: 'Part 2: doubles',
        head: ['Doubles', 'For'],
        rows: [
          ['1', 'Each dragon pung or kong · all three dragons (one more) · own wind · round wind · three wind pungs · ones and nines in one suit · a major hand · three concealed pungs · own flower or season, each · the round’s flower or season, each · Mahjong on the last tile'],
          ['2', 'Four concealed pungs · three exposed kongs · four wind pungs'],
          ['3', 'All honours · clean suit, no honours · terminal hand · a bouquet, 1 to 4 of flowers or seasons · three concealed kongs · four exposed kongs · concealed Mahjong (nothing exposed, even if a discard finishes it)'],
          ['4', 'Four concealed kongs'],
          ['7', 'Four wind pungs and a pair of dragons'],
          ['8', 'Earth’s Blessing: Mahjong on East’s first discard'],
          ['9', 'Heaven’s Blessing: East is dealt Mahjong'],
          ['10', 'The most a hand can count'],
        ],
      },
    }),
    S('The goulash chart', 'Here’s how a hand is counted. Add up the points, then double them once for each double. That’s the goulash scoring chart. Twenty-four points with three doubles is one hundred and ninety-two. With four doubles, three hundred and eighty-four. The chart goes up to ten doubles.', {
      table: {
        title: 'Goulash scoring chart (a corner of it)',
        head: ['Points', '3 doubles', '4 doubles', '5 doubles', '6 doubles'],
        rows: [
          ['24', '192', '384', '768', '1,536'],
          ['32', '256', '512', '1,024', '2,048'],
          ['48', '384', '768', '1,536', '3,072'],
          ['64', '512', '1,024', '2,048', '4,096'],
        ],
      },
    }),
    S('A goulash hand', 'Here’s a winner. You sit South: an exposed pung of Red dragons, and concealed pungs of White dragons, one Bamboo and nine Bamboo, with a pair of fives. One suit with honours, so it’s clean. Forty-eight points. Four doubles: Red, White, both terminal pungs, and three concealed pungs. Forty-eight doubled four times is seven hundred and sixty-eight.', {
      hand: {
        title: 'West round · One suit with honours · 48 points, 4 doubles',
        groups: [
          { tiles: 'RdRdRd', label: 'Pung', sub: 'Red, exposed: 4', flag: 'Exposed', mark: 'called' },
          { tiles: 'WdWdWd', label: 'Pung', sub: 'White, concealed: 8' },
          { tiles: '111s', label: 'Pung', sub: '1 Bamboo, concealed: 8' },
          { tiles: '999s', label: 'Pung', sub: '9 Bamboo, concealed: 8' },
          { tiles: '55s', label: 'Pair', sub: 'A minor pair: 0', flag: 'Won on a discard', mark: 'win' },
        ],
        facts: ['You sit South', 'Points 4 + 8 + 8 + 8 + 20 for Mahjong = 48', 'No flowers'],
        scoreTitle: 'Doubles',
        faan: [
          ['Red dragon pung', 1],
          ['White dragon pung', 1],
          ['Both terminal pungs in Bamboos', 1],
          ['Three concealed pungs', 1],
        ],
        total: '48 × 2 × 2 × 2 × 2 = 768',
      },
    }),
    S('Who pays', 'Everyone pays the winner seven hundred and sixty-eight, and East pays double. The winner pays nobody. So you collect three thousand and seventy-two. But the hand isn’t over yet: the other players may have something to collect too.', {
      hand: {
        title: 'Paying the goulash hand',
        groups: [{ tiles: '55s', label: 'Your winning tile', mark: 'win' }],
        pay: [
          { who: 'East pays double', amount: '1,536', big: true },
          { who: 'West and North pay', amount: '768 + 768' },
        ],
        winner: 'You collect 3,072',
      },
    }),
    S('The goulash twist: losers count too', 'Here’s the goulash twist. When someone wins, every other player with a clean hand and at least one pung or kong gets a count too. West didn’t win, but holds an exposed Green dragon pung, a pung of three Rings in hand, a pair of North, and flower three. Only Rings and honours, so it’s clean. The odd Rings don’t score.', {
      hand: {
        title: 'West’s losing hand · One suit with honours · 14 points, 3 doubles',
        groups: [
          { tiles: 'GdGdGd', label: 'Pung', sub: 'Exposed: 4', flag: 'Exposed', mark: 'called' },
          { tiles: '333p', label: 'Pung', sub: 'In hand, concealed: 4', mark: 'hl' },
          { tiles: 'NN', label: 'Pair', sub: 'A major pair: 2' },
          { tiles: '4p 6p 77p 9p', label: 'Loose tiles', sub: 'Not a set: 0' },
          { tiles: 'F3', label: 'Flower', sub: '4 points', mark: 'hl' },
        ],
        facts: ['West sits West', 'Points 4 + 4 + 2 + 4 = 14', 'No 20: that is only for Mahjong'],
        scoreTitle: 'Doubles',
        faan: [
          ['Dragon pung', 1],
          ['Own flower', 1],
          ['Round flower', 1],
        ],
        total: '14 × 8 = 112',
      },
    }),
    S('Paying a loser’s count', 'West’s count is fourteen points with three doubles: Green dragon, and flower three, which is both West’s own flower and the round’s. That’s one hundred and twelve. The other losers pay it: North pays one hundred and twelve, and East pays double. The winner pays nobody. A loser with a dirty hand, or without a pung, gets nothing.', {
      hand: {
        title: 'Paying West’s count',
        groups: [{ tiles: 'GdGdGd 333p', label: 'West’s count: 112', mark: 'hl' }],
        pay: [
          { who: 'East pays double', amount: '224', big: true },
          { who: 'North pays', amount: '112' },
          { who: 'You, the winner, pay', amount: 'Nothing' },
        ],
        winner: 'West collects 336',
      },
    }),
    S('The penalty', 'Now the penalty. North has three exposed pungs: Red dragons, North and West. With pairs of two and six Cracks, North is calling. You throw a six Crack and North wins: a pung of sixes and a pair of twos. Thirty-four points, and three doubles for Red, North’s own wind and the round wind. That’s two hundred and seventy-two. But North had three exposed pungs, so you pay the penalty.', {
      hand: {
        title: 'North’s Mahjong · One suit with honours · 34 points, 3 doubles',
        groups: [
          { tiles: 'RdRdRd', label: 'Pung', sub: 'Exposed: 4', flag: 'Exposed', mark: 'called' },
          { tiles: 'NNN', label: 'Pung', sub: 'Exposed: 4', flag: 'Exposed', mark: 'called' },
          { tiles: 'WWW', label: 'Pung', sub: 'Exposed: 4', flag: 'Exposed', mark: 'called' },
          { tiles: '666m', label: 'Pung', sub: 'From your discard: 2', flag: 'Your discard', mark: 'win' },
          { tiles: '22m', label: 'Pair', sub: 'A minor pair: 0' },
        ],
        facts: ['North sits North', 'Three exposed pungs', 'Points 4 + 4 + 4 + 2 + 20 for Mahjong = 34'],
        scoreTitle: 'Doubles',
        faan: [
          ['Dragon pung', 1],
          ['Own wind pung', 1],
          ['Round wind pung', 1],
        ],
        total: '34 × 8 = 272',
      },
    }),
    S('Paying the penalty', 'You threw the winning tile, so you pay for the whole table. East’s share, doubled to five hundred and forty-four. West’s share, two hundred and seventy-two. And your own, two hundred and seventy-two. One thousand and eighty-eight in all. East and West pay nothing, and nobody gets a count. Unless you were calling too: then everyone pays as usual.', {
      hand: {
        title: 'The penalty: you pay for the table',
        groups: [{ tiles: '6m', label: 'Your discard', mark: 'win' }],
        pay: [
          { who: 'You pay East’s share, doubled', amount: '544', big: true },
          { who: 'You pay West’s share', amount: '272' },
          { who: 'You pay your own', amount: '272' },
          { who: 'East and West pay', amount: 'Nothing' },
        ],
        winner: 'North collects 1,088',
      },
    }),
    S('West round tips', 'Watch the exchange: what the others pass tells you what they’re collecting. Aim for one suit, or honours, and three doubles. Watch the discards, because the tiles you need may already be gone. And be quick to call your pungs. Shall we try your test?', { tiles: ['W'] }),
  ],
  quiz: [
    Q('Which sets may you use in the goulash?', [['Pungs and kongs, and one pair', '555p'], ['Chows too', '345s'], ['Crochets too', '4m 4s 4p']], 0, 'Goulash is only pungs and kongs, with one pure pair.'),
    Q('How many doubles do you need to go Mahjong?', ['Three', 'One', 'None'], 0, 'At least three doubles, and a clean hand.'),
    Q('Your hand has pungs in two different suits, and it is not a terminal hand. What is it?', ['Dirty: no points', 'Clean', 'A major hand'], 0, 'More than one suit is dirty, unless it is a terminal hand of ones and nines.'),
    Q('A dirty hand has three doubles from flowers. Can it go Mahjong?', ['No, it must be clean', 'Yes', 'Only with a bouquet'], 0, 'A dirty hand’s points don’t count, so flowers can’t rescue it. You need a clean hand and three doubles.'),
    Q('Who pays a losing player’s count?', ['The other losers', 'The winner', 'Nobody'], 0, 'The other losers pay it, East double. The winner pays nobody.'),
    Q('What is a concealed pung of a major worth?', ['Eight points', 'Four points', 'Two points'], 0, 'A pung of majors is four exposed and eight concealed.'),
    Q('A player has three exposed pungs and you throw their winning tile. Who pays?', ['You pay for everyone', 'Everyone pays as usual', 'Nobody pays'], 0, 'That’s the penalty: you pay for all, unless you were one tile from Mahjong yourself.'),
  ],
};

export const indiaWestDoublesLesson: Lesson = {
  id: 'india-west-doubles',
  title: 'India Rules: West round, one double',
  base: 'india-west',
  scenes: [
    S('The doubles, one by one', 'Now the single doubles, one at a time. Every example is a real winning hand, with at least three doubles. You sit South, and it’s the West round. The gold sets are the ones we’re learning, and every other double in the hand is counted too, so you can see the whole score.', { tiles: ['S', 'W'] }),
    ...WEST_EXAMPLES.slice(0, 11).map(goulashScene),
    S('One double, all together', 'That’s every single double: dragons, all three dragons, your own wind, the round wind, three winds, ones and nines in a suit, a major hand, three concealed pungs, your own and the round’s flowers and seasons, and the last tile. Most winning hands mix three or four of them. Shall we try your test?', { tiles: ['RdRdRd', 'SSS', 'WWW', 'F2', 'F3'] }),
  ],
  quiz: [
    Q('You sit South. Which wind pung is your own wind?', [['South', 'SSS'], ['East', 'EEE'], ['North', 'NNN']], 0, 'Your own wind is your seat: South.'),
    Q('In the West round, which flower is the round’s flower?', [['Flower 3', 'F3'], ['Flower 1', 'F1'], ['Flower 4', 'F4']], 0, 'West is the third wind, so flower three and season three are the round’s.'),
    Q('How many doubles do pungs of all three dragons give?', ['Four', 'Three', 'One'], 0, 'One for each dragon, and one more for all three.'),
    Q('Which two pungs together make one double?', [['Ones and nines of one suit', '111m 999m'], ['Twos and eights of one suit', '222m 888m'], ['Fives of two suits', '555m 555p']], 0, 'A pung of ones and a pung of nines in the same suit is one double.'),
  ],
};

export const indiaWestBigLesson: Lesson = {
  id: 'india-west-big',
  title: 'India Rules: West round, big doubles',
  base: 'india-west',
  scenes: [
    S('The big doubles', 'Now the big ones: two, three, four doubles and more, up to the blessings. Every example is again a full winning hand. You sit South in the West round, the gold sets are the ones we’re learning, and every other double is counted too.', { tiles: ['EEE', 'SSS', 'WWW', 'NNN'] }),
    ...WEST_EXAMPLES.slice(11).map(goulashScene),
    S('Score sheet: every double', 'Here’s every double again in one place, from one double up to nine, and ten is the most a hand can count. Most winning hands mix several of them, so check every set, every flower, and how you won. Shall we try your test?', {
      table: {
        title: 'West round score sheet: doubles',
        head: ['Doubles', 'For'],
        rows: [
          ['1', 'Each dragon pung or kong · all three dragons (one more) · own wind · round wind · three wind pungs · ones and nines in one suit · a major hand · three concealed pungs · own flower or season, each · the round’s flower or season, each · Mahjong on the last tile'],
          ['2', 'Four concealed pungs · three exposed kongs · four wind pungs'],
          ['3', 'All honours · clean suit, no honours · terminal hand · a bouquet, 1 to 4 of flowers or seasons · three concealed kongs · four exposed kongs · concealed Mahjong (nothing exposed, even if a discard finishes it)'],
          ['4', 'Four concealed kongs'],
          ['7', 'Four wind pungs and a pair of dragons'],
          ['8', 'Earth’s Blessing: Mahjong on East’s first discard'],
          ['9', 'Heaven’s Blessing: East is dealt Mahjong'],
          ['10', 'The most a hand can count'],
        ],
      },
    }),
  ],
  quiz: [
    Q('What is a clean suit with no honours worth?', ['Three doubles', 'One double', 'Two doubles'], 0, 'A clean suit is three doubles, enough to win on its own.'),
    Q('A discard finishes your pung of sevens. How does that pung count?', ['As exposed', 'As concealed', 'Not at all'], 0, 'A pung finished by a discard counts as exposed, even in a concealed Mahjong.'),
    Q('What is the most doubles a hand can count?', ['Ten', 'Seven', 'There is no limit'], 0, 'The goulash chart stops at ten doubles.'),
    Q('Who can have Heaven’s Blessing?', ['Only East', 'Only South', 'Any player'], 0, 'Only East is dealt a complete hand: nine doubles.'),
  ],
};

export const indiaNorthLesson: Lesson = {
  id: 'india-north',
  title: 'India Rules: the North round',
  base: 'india',
  scenes: [
    S('The North round: East’s choice', 'Welcome to the North round, the last four games! This is the dealer’s round. Before every game, East chooses what to play: the East round with passports, small cards with jokers, the goulash with jokers, or a big card. Every game except the East round has the exchanges, just like the South round.', {
      table: {
        title: 'East chooses one each game',
        head: ['Choice', 'Exchanges', 'Scored like'],
        rows: [
          ['East round, passports', 'None', 'The East round'],
          ['Small cards with jokers', 'As in the South round', 'The card'],
          ['Goulash with jokers', 'As in the South round', 'The West round'],
          ['Big card', 'As in the South round', 'The big card sheet'],
        ],
      },
    }),
    S('The East round again', 'If East picks the East round, it’s played just as before, with passports. East may make a passport compulsory, so every winner needs one. There are no exchanges, and it’s scored like the East round.', { tiles: ['444m 777s 222p'] }),
    S('Small cards with jokers', 'With small cards, every player gets a card again. But now the flowers and seasons are jokers. They aren’t replaced, and they aren’t paid. A joker stands for any tile you need. Buying is allowed. Tables usually play the double limit cards, but you can use them all.', { tiles: ['F1', 'F6', 'GdGdGd WdWdWd 222s 666s 88s'] }),
    S('Jokers on a small card', 'On a small card, a joker can be used for anything. It stands for any tile your card needs: in a pung, a chow, a mixed set or the pair. It works in your hand, and in a set you call from a discard too.', {
      table: {
        head: ['Small card joker', ''],
        rows: [
          ['Any tile your card needs', 'Yes'],
          ['In a pung, chow, mixed set or the pair', 'Yes'],
          ['In a set called from a discard', 'Yes'],
        ],
      },
    }),
    S('Goulash with jokers', 'For a goulash with jokers, East names a number before the deal, before seeing a single tile. That number, in all three suits, is wild: say fives, then five Bamboo, five Crack and five Ring are jokers. The rules and scoring are the West round’s, with no buying. To pung a discard you need a natural pair. Jokers can make a kong, a pair, or a pung to win.', { tiles: ['5s', '5m', '5p', 'RdRd 5m'] }),
    S('A joker number pair', 'More rules for the joker goulash. A set or pair may use two jokers, but always keeps one real tile. And you can’t keep a pair of the joker number in your hand unless you use it as a pung or your pair. And if you make a clean hand of Bamboos that uses the five of Bamboos as a real tile, another five of Bamboos can’t be your joker.', { tiles: ['55s'] }),
    S('What a goulash joker can do', 'One thing a goulash joker can never do: help you call a pung. To pung a discard you need a natural pair. Everything else is allowed. A joker can finish a pung from the wall, make a kong, make the pair, or make the pung that wins on a discard.', {
      table: {
        head: ['Goulash joker', ''],
        rows: [
          ['Call a pung from a discard', 'No: you need a natural pair'],
          ['A pung from the wall, a kong, the pair', 'Yes'],
          ['The pung that wins on a discard', 'Yes'],
          ['A set or pair of jokers alone', 'No: keep one real tile'],
        ],
      },
    }),
    S('Big cards', 'Or East picks a big card, one for the whole table. There are twenty-nine big cards, and each one names its own jokers. Breaking News asks for two kongs of minors in two suits, a clean minor pair of the third suit, the two corresponding dragons, and NEWS. Clean means no jokers: a clean pair is two real tiles. Its jokers are the ones and nines of the third suit.', {
      cards: [
        { tiles: '5555p 8888s 33m Wd Gd N E W S', title: 'Breaking News', alt: 'Jokers: 1s and 9s of the third suit', text: 'Two minor kongs in two suits, a clean minor pair of the third, their two dragons, and NEWS' },
      ],
    }),
    S('More big cards', 'Here are two more. Same Number Kongs: kongs of one number in each suit, the three dragons, and a clean pair, with the four winds as jokers. And Ulta Pulta Three Kongs, made only of the Ulta Pulta tiles shown here. Its jokers are the one and nine of Cracks, the Red dragon, the one of Bamboos, and one of each wind.', {
      cards: [
        { tiles: '7777m 7777s 7777p Gd Rd Wd 22s', title: 'Same Number Kongs', alt: 'Jokers: the four winds', text: 'Kongs of one number in each suit, the three dragons and a clean pair' },
        { tiles: '2s 4s 5s 6s 8s 9s 1p 2p 3p 4p 5p 8p 9p', title: 'Ulta Pulta tiles', alt: 'For the Ulta Pulta cards', text: 'Bamboos 2, 4, 5, 6, 8, 9 and Rings 1, 2, 3, 4, 5, 8, 9' },
        { tiles: '1m 9m Rd 1s E S W N', title: 'Ulta Pulta jokers', alt: 'Cards 3 and 19 (card 29 adds the flowers and seasons)', text: 'One each of the 1 and 9 of Cracks, Red dragon, 1 of Bamboos and the four winds: 8 jokers' },
      ],
    }),
    S('Playing a big card', 'With a big card, you claim discards as before, and buying from your left is allowed. A tile you buy or draw can replace a joker in your exposed set. A discard can replace a joker only when it makes your Mahjong. And when the card says clean, that set may not use jokers: a clean pair is two real tiles. Many cards also keep jokers out of the pair.', {
      table: {
        head: ['Big card rule', ''],
        rows: [
          ['Claims', 'As before, plus buying from your left'],
          ['A bought or drawn tile', 'May replace a joker in an exposed set'],
          ['A discard', 'May replace a joker only to win'],
          ['Clean sets (a clean pair, a clean kong)', 'No jokers: real tiles only'],
        ],
      },
    }),
    S('Jokers on a big card', 'On a big card, the jokers are only the tiles your card names, and only where it allows. Most cards keep jokers out of the pair, and a clean set never uses one. Jokers can sit in your exposed sets, and a tile you buy or draw can swap one out.', {
      table: {
        head: ['Big card joker', ''],
        rows: [
          ['Which tiles', 'Only those your card names'],
          ['Kongs and qwongs', 'Yes, unless the card says clean'],
          ['The pair', 'Usually no: check the card'],
          ['An exposed set', 'Yes; a bought or drawn tile can replace it'],
        ],
      },
    }),
    S('The qwong', 'Big cards bring the qwong: five of a kind, made with a joker. When you make one, take two extra tiles from the flower wall, unless your card says otherwise. Flowers used as jokers aren’t replaced.', { tiles: ['3s 3s 3s 3s J'] }),
    S('Laying down on a big card', 'On your turn, lay down each kong, qwong or run as soon as you have it. Each one earns extra tiles from the flower wall: one for a kong or a run, two for a qwong, unless your card says otherwise. That’s why a finished big card hand holds more than fourteen tiles. Laying down your own tiles keeps the hand concealed: only a claimed discard spoils that.', {
      table: {
        head: ['Laid down', 'Extra tiles'],
        rows: [
          ['A kong', 'One'],
          ['A qwong', 'Two'],
          ['A run of four or more', 'One'],
          ['Pairs, dragons and winds', 'Stay in your hand'],
        ],
      },
    }),
    S('Score sheet: the North round', 'And the North round score sheet. The East round and the goulash pay as before. Small cards pay what the card says. A big card pays one thousand for a normal hand, and two thousand concealed, East paying double. As in every round, a hand with nothing exposed is concealed even when a discard finishes it. Flowers are paid as usual, but only when they aren’t jokers in that game.', {
      table: {
        title: 'North round score sheet',
        head: ['Game', 'Each player pays', 'East pays'],
        rows: [
          ['East round, passports', 'As the East round: 500 · 1,000 · 2,000', 'Double'],
          ['Small cards with jokers', 'The card’s value', 'Double'],
          ['Goulash with jokers', 'The goulash chart', 'Double'],
          ['Big card, normal', '1,000', '2,000'],
          ['Big card, concealed', '2,000', '4,000'],
          ['Flowers and seasons', 'As usual, unless they are jokers', 'The same'],
        ],
      },
    }),
    S('The end of the match', 'After the North round, all sixteen games are done, and the player with the most points wins the match. That’s India Rules! You can play all four rounds, or just the round you like best. Shall we try your test?', { tiles: ['E', 'S', 'W', 'N'] }),
  ],
  quiz: [
    Q('Who chooses the game in the North round?', ['East, before every game', 'The winner of the last game', 'Everyone votes'], 0, 'The North round is the dealer’s round: East chooses before every game.'),
    Q('In the joker goulash, East names fives. Which tiles are jokers?', [['The five of each suit', '5m 5s 5p'], ['The flowers', 'F1 F2'], ['The dragons', 'Rd Gd Wd']], 0, 'The named number, in all three suits, is wild.'),
    Q('What is a qwong?', [['Five of a kind, with a joker', '3s 3s 3s 3s J'], ['Four of a kind', '3333s'], ['A run of five', '34567s']], 0, 'A qwong is five of a kind made with a joker, and it takes two extra tiles.'),
    Q('A big card hand wins concealed. What does each player pay, apart from East?', ['Two thousand', 'One thousand', 'Five hundred'], 0, 'A big card pays one thousand normal and two thousand concealed, and East pays double.'),
    Q('Small cards with jokers: are flowers paid?', ['No, they are jokers', 'Yes, as usual', 'Only to East'], 0, 'When flowers are jokers, they are not replaced and not paid.'),
  ],
};
