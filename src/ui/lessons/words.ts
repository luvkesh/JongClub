// Academy lesson: "Words at the table", a phrasebook taught right after the
// basics. Every word the later lessons use (meld, concealed, self-draw,
// terminals, seat and round wind, faan, tai, han, phán...) is introduced here
// in plain words first, with the names the same thing goes by around the
// world: Chinese (Mandarin and Cantonese), Japanese, Vietnamese and American
// tables. Each scene puts the names side by side in a table or on cards.

import { S, Q, type Lesson } from '../lessonKit';

export const wordsLesson: Lesson = {
  id: 'words',
  title: 'Words at the table',
  scenes: [
    S('A little phrasebook', 'Mahjong is played all over the world, and every table has its own words. Very often, they mean exactly the same thing. So here’s a little phrasebook. Then nothing at any table will sound strange.', { tiles: ['345s', 'EEE', '7777p'] }),
    S('Suit names', 'First, the suits. Characters are also called Craks, or Man in Japan. Dots are also called Circles, or Pin. And Bamboo is Bams, or Sou. Same tiles, just different names.', {
      table: {
        head: ['Suit', 'Chinese', 'Japanese', 'Also called'],
        rows: [
          [{ tiles: '5m', text: 'Characters' }, '萬 Wan', '萬子 Manzu, or Man', 'Craks'],
          [{ tiles: '5p', text: 'Dots' }, '筒 Tong', '筒子 Pinzu, or Pin', 'Circles, Coins'],
          [{ tiles: '5s', text: 'Bamboo' }, '索 Suo, or 條 Tiao', '索子 Souzu, or Sou', 'Bams, Sticks'],
        ],
      },
    }),
    S('Simples and terminals', 'The numbers two to eight are called simples. The ones and nines sit at the ends of each suit, so we call them terminals. And the winds and dragons, as you know, are the honours.', {
      cards: [
        { tiles: '2m 5p 8s', title: 'Simples', alt: '2 to 8', text: 'The middle numbers. They fit into the most runs.' },
        { tiles: '1m 9p 1s', title: 'Terminals', alt: '1 and 9', text: 'The ends of each suit.' },
        { tiles: 'E Rd', title: 'Honours', alt: 'winds and dragons', text: 'No numbers, so never in a run.' },
      ],
    }),
    S('Winds and dragons', 'The honours have Chinese names too. The winds are Dong, Nan, Xi and Bei. The Red Dragon is Zhong, meaning centre. The Green is Fa, meaning fortune. And the White is Bai, simply white, or blank.', {
      table: {
        head: ['Tile', 'Chinese', 'It means'],
        rows: [
          [{ tiles: 'E S W N', text: 'Winds' }, '東 Dong · 南 Nan · 西 Xi · 北 Bei', 'East, South, West, North'],
          [{ tiles: 'Rd', text: 'Red Dragon' }, '中 Zhong', 'Centre, or a hit on the target'],
          [{ tiles: 'Gd', text: 'Green Dragon' }, '發 Fa', 'Fortune, to prosper'],
          [{ tiles: 'Wd', text: 'White Dragon' }, '白 Bai', 'White, a blank board'],
        ],
      },
    }),
    S('One set, many names', 'A run of three, the chow, is called Chi in Chinese and Japanese, and Ăn in Vietnam. Three of a kind, the pung, is Pong, or Peng, or Pon in Japan, or Phỗng in Vietnam. And four of a kind, the kong, is Gang, Kan, or Chiếu.', {
      table: {
        head: ['Set', 'Chinese', 'Japanese', 'Vietnamese'],
        rows: [
          [{ tiles: '345s', text: 'Chow, a run' }, '吃 Chi', 'チー Chi', 'Ăn'],
          [{ tiles: '555p', text: 'Pung, three the same' }, '碰 Peng, or Pong', 'ポン Pon', 'Phỗng'],
          [{ tiles: '9999m', text: 'Kong, four the same' }, '槓 Gang', 'カン Kan', 'Chiếu'],
        ],
      },
    }),
    S('The pair has names too', 'Even the pair has nicknames. In Chinese, it’s the eyes. In Japan, it’s the head. Every winning hand needs one, whatever you call it.', {
      cards: [
        { tiles: 'EE', title: 'Pair', alt: 'English', text: 'Two matching tiles.' },
        { tiles: '55s', title: 'Eyes', alt: '眼 Yan · Chinese', text: 'The pair that finishes the hand.' },
        { tiles: 'RdRd', title: 'Head', alt: '頭 Atama · Japanese', text: 'Also called a toitsu.' },
      ],
    }),
    S('Calling the win', 'And the win itself? It’s Mahjong in English, or Mah Jongg on American tables. Hu in Chinese, and Ù in Vietnam. Japan uses two words. Ron, when you win on a discard, and Tsumo, when you draw the tile yourself.', {
      cards: [
        { title: 'Mahjong!', alt: 'English · Mah Jongg in America', text: 'Called out when your hand is complete.' },
        { title: 'Hu', alt: '和 · Chinese', text: 'Win. In Cantonese, Sik Wu.' },
        { title: 'Ron · Tsumo', alt: 'Japanese', text: 'Ron on a discard. Tsumo on your own draw.' },
        { title: 'Ù', alt: 'Vietnamese', text: 'The Vietnamese call for the win.' },
      ],
    }),
    S('Self-draw or discard', 'If you win with a tile you drew from the wall yourself, that’s a self-draw. If you win with someone else’s tile, they’re the discarder. In Singapore, they call that player the shooter. Who pays usually depends on which one it was.', {
      table: {
        head: ['How you won', 'Chinese', 'Japanese', 'Club slang'],
        rows: [
          [{ tiles: '5p', text: 'Self-draw: from the wall' }, '自摸 Zimo', 'ツモ Tsumo', '“Self-pick”'],
          [{ tiles: '7s', text: 'On someone’s discard' }, '食糊 Sik Wu (Cantonese)', 'ロン Ron', '—'],
          ['The player who threw it', '放銃 Fang chong, “firing the gun”', '放銃 Hoju, “dealing in”', 'The discarder, the shooter, the gun'],
        ],
      },
    }),
    S('Melds', 'When you call a tile, your new set goes face up beside your tiles. A face up set is called a meld, or an exposed set. Sets still hidden in your hand are concealed. A hand with no calls at all is a concealed hand, and it’s often worth a little more.', {
      hand: {
        groups: [
          { tiles: '555p', label: 'Meld', sub: 'called, face up', flag: 'Exposed', mark: 'called' },
          { tiles: '123m', label: 'Concealed', sub: 'still in your hand' },
          { tiles: '678s', label: 'Concealed', sub: 'still in your hand' },
        ],
        facts: ['One call made: no longer a concealed hand'],
      },
    }),
    S('Ready to win', 'When you need just one more tile to win, your hand is ready. We also say you’re waiting, and the tiles that would finish it are your wait. In Japan, a ready hand is called tenpai.', {
      hand: {
        title: 'A ready hand, waiting on one tile',
        groups: [
          { tiles: '123m', label: 'Set' },
          { tiles: '456p', label: 'Set' },
          { tiles: '789s', label: 'Set' },
          { tiles: 'RdRdRd', label: 'Set' },
          { tiles: 'E', label: 'Waiting', sub: 'needs another East', flag: 'The wait', mark: 'hl' },
        ],
        facts: ['Ready · waiting · tenpai: one tile from Mahjong'],
      },
    }),
    S('Two kinds of wind', 'Your seat wind is the wind of your chair. The round wind, also called the prevailing wind, is shared by everyone for a whole round. A pung of either one is often worth more.', { board: 'seats' }),
    S('Bonus and wild tiles', 'Some sets add extra tiles. Flowers and seasons are bonus tiles. You never use them in a set. Just put them aside face up, draw a new tile, and they may add to your score. Jokers are wild tiles, which can stand in for other tiles. Only some versions use them.', {
      cards: [
        { tiles: 'F1 F2', title: 'Flowers', alt: '花 Hua', text: 'Bonus tiles: set aside, draw again.' },
        { tiles: 'F5 F6', title: 'Seasons', alt: '季 Ji', text: 'Bonus tiles too. Not used in Japan.' },
        { tiles: 'J', title: 'Jokers', alt: 'wild tiles', text: 'Stand in for other tiles, at some tables.' },
      ],
    }),
    S('Counting words', 'Every version counts hand value in its own unit. Faan, or fan, in Hong Kong style play, like Classic, Dubai and Indian clubs. Tai in Taiwan and Singapore. Han in Japan, with fu as small extra points. And phán in Vietnam. They all measure the same thing: how special your hand is.', {
      table: {
        head: ['Unit', 'Where', 'How it adds up'],
        rows: [
          ['Faan, or fan 番', 'Classic, Hong Kong, Dubai, Indian clubs', 'Each faan doubles the points'],
          ['Fan 番', 'Chinese Official tournaments', 'Added up: you need 8 to win'],
          ['Tai 台', 'Taiwan, Singapore', 'Added up, never doubled'],
          ['Han 翻 and fu 符', 'Japan', 'Han double; fu are small extra points'],
          ['Phán', 'Vietnam', 'Added up'],
        ],
      },
    }),
    S('Words from Japan', 'Japanese tables add a few words of their own. A yaku is a named pattern, and every win there needs one. Riichi means declaring that you’re ready. Dora are lucky bonus tiles. And a yakuman is a limit hand, the rarest and richest of all.', {
      list: [
        { tiles: '234m', title: 'Yaku', text: 'A named scoring pattern. In Japan, every win needs one.' },
        { tiles: '5p', title: 'Riichi', text: 'Declaring you’re ready, with a 1,000 point stick on the table.' },
        { tiles: '4s', title: 'Dora', text: 'Bonus tiles that add value when you win with them.' },
        { tiles: '1m 9m 1p 9p', title: 'Yakuman', text: 'A limit hand, like thirteen orphans: the biggest scores.' },
      ],
    }),
    S('Swaps and wall games', 'A few words from special games. A Charleston is a swap of three tiles before play starts. A goulash is named after the Hungarian stew, because everything gets mixed: tiles change hands before play, and special rules apply. A wall game is a hand where the wall runs out and nobody wins. And Tic-Tac-Toe is an Indian swap: one tile face down to each other player.', {
      list: [
        { tiles: 'N Wd 9p', title: 'Charleston', text: 'Three unwanted tiles passed face down: right, across, then left.' },
        { tiles: 'W', title: 'Goulash', text: 'Like the stew, everything mixed: tiles swapped before play, with special rules.' },
        { tiles: '1m 1m', title: 'Wall game', text: 'The wall runs out and nobody wins. Also called a draw.' },
        { tiles: 'E', title: 'Tic-Tac-Toe', text: 'India Rules: one tile face down to each other player.' },
      ],
    }),
    S('Words for the wall', 'The wall has words of its own. Breaking the wall means splitting it where the dice say, so the deal can start. Loose tiles are the few stacks kept aside to replace flowers and kongs. Riichi calls that part the dead wall. And at India Rules tables, the bigger pile kept aside for replacements is the flower wall.', {
      list: [
        { tiles: '5p 5p', title: 'Breaking the wall', text: 'Opening the wall where East’s dice throw says.' },
        { tiles: 'F1 F5', title: 'Loose tiles', text: 'A few stacks kept aside to replace flowers and kongs.' },
        { tiles: '4s', title: 'Dead wall', text: 'Riichi’s fourteen tiles kept aside, with the dora on top.' },
        { tiles: 'F1 F2 F3 F4', title: 'Flower wall', text: 'India Rules: twice the dice total in tiles, set aside by North.' },
      ],
    }),
    S('Words from Indian clubs', 'Indian clubs have their own words too. A passport is a special group of nine, six or five tiles, needed to win in the East round. A crochet is the same number in all three suits. A knit is that number in just two suits. A mixed chow is a run across three suits. A bouquet is a set of flowers. And a qwong is five of a kind, made with a joker.', {
      list: [
        { tiles: 'E S W N Rd', title: 'Passport', text: 'A special group of nine, six or five tiles: the East round needs one.' },
        { tiles: '4m 4s 4p', title: 'Crochet and knit', text: 'The same number in three suits. A knit is two suits: 4m 4s.' },
        { tiles: '2m 3s 4p', title: 'Mixed chow', text: 'A run across the three suits.' },
        { tiles: 'F1 F2 F3 F4', title: 'Bouquet', text: 'Four flowers or four seasons, or one to four mixed.' },
        { tiles: '3s 3s 3s 3s J', title: 'Qwong', text: 'Five of a kind with a joker, in the North round.' },
      ],
    }),
  ],
  quiz: [
    Q('Pon, Pong and Phỗng all mean the same thing. What?', [['A pung, three of a kind', '555p'], ['A run of three', '345s'], ['A winning hand', '123m']], 0, 'Pon in Japan, Pong in Chinese, Phỗng in Vietnam. They all mean a pung, three of a kind.'),
    Q('Which tiles are terminals?', [['Ones and nines', '1m 9p'], ['Twos to eights', '5s'], ['Dragons', 'Rd']], 0, 'Terminals are the ones and nines, at the ends of each suit. Twos to eights are simples.'),
    Q('You win with a tile you drew yourself. What is that called?', ['A self-draw', 'A discard win', 'A meld'], 0, 'Winning on your own draw is a self-draw. In Japan it’s Tsumo, and in Chinese it’s Zimo.'),
    Q('In Japan, you win on another player’s discard. What do you call?', ['Ron', 'Tsumo', 'Pon'], 0, 'Ron is a win on a discard. Tsumo is a win on your own draw, and Pon is a pung.'),
    Q('What is a meld?', ['A called set, face up on the table', 'A set hidden in your hand', 'A tile you threw away'], 0, 'A meld, or exposed set, is a set you called. It sits face up beside your tiles.'),
    Q('Faan, tai, han and phán are all…', ['Ways to count a hand’s value', 'Kinds of joker', 'Names of winds'], 0, 'Each version counts hand value in its own unit: faan, tai, han, or phán.'),
  ],
};
