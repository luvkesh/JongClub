// Mahjong Academy: each lesson is a short story told by Mei, the club host,
// one scene at a time with narration and captions, then a quick test.
// A lesson only counts as learned once the test is passed.

import { narrator } from '../audio/voice';
import { sound } from '../audio/sound';
import { parseKinds } from '../engine/tiles';
import { coachLines } from './coach';
import { versionLines } from './versions';
import { matchLines } from './matchLines';
import { placementLines } from '../progression/placement';
import { clear, h, tileImg } from './dom';
import './lesson.css';

import { S, Q, type Lesson, type LessonId, type Visual } from './lessonKit';
import { cardsPic, demoPic, handPic, listPic, tablePic, videoPic } from './lessonVisuals';
import { lessonContents, meiAside } from './meiAside';
import { indianLesson } from './lessons/indian';
import { indiaEastLesson, indiaLesson, indiaNorthLesson, indiaSouthLesson, indiaWestBigLesson, indiaWestDoublesLesson, indiaWestLesson } from './lessons/india';
import { classicLesson } from './lessons/classic';
import { roundsLesson } from './lessons/rounds';
import { singaporeLesson } from './lessons/singapore';
import { vietnameseLesson } from './lessons/vietnamese';
import { wordsLesson } from './lessons/words';
import { scoringLesson } from './lessons/scoring';
import { shapesLesson } from './lessons/shapes';
import { strategyLesson } from './lessons/strategy';
import { traditionLesson } from './lessons/tradition';
import { efficiencyLesson } from './lessons/efficiency';
import { waitsLesson } from './lessons/waits';
import { defenceLesson } from './lessons/defence';
import { valueLesson } from './lessons/value';
import { hongKongLesson } from './lessons/hongkong';
import { mcrLesson } from './lessons/mcr';
import { sichuanLesson } from './lessons/sichuan';
import { malaysianLesson } from './lessons/malaysian';
import { koreanLesson } from './lessons/korean';
import { sanmaLesson } from './lessons/sanma';
import { malaysian3Lesson } from './lessons/malaysian3';
import { riichiTournamentLesson } from './lessons/riichiTournament';
import { emaLesson } from './lessons/ema';
import { korean4Lesson } from './lessons/korean4';
import { guangdongLesson } from './lessons/guangdong';
import { zungJungLesson } from './lessons/zungJung';
import { europeanLesson } from './lessons/european';
import { wuhanLesson } from './lessons/wuhan';
import { shanghaiLesson } from './lessons/shanghai';
import { fujianLesson } from './lessons/fujian';
import { beijingLesson } from './lessons/beijing';
import { northeastLesson } from './lessons/northeast';
import { wrightPattersonLesson } from './lessons/wrightPatterson';
import { thaiLesson } from './lessons/thai';
import { filipinoLesson } from './lessons/filipino';
import { indonesianLesson } from './lessons/indonesian';
import { VARIATION_SHEETS } from '../club/variationSheets';
import { dubaiAmericanLesson, dubaiCustomLesson, dubaiTaiwaneseLesson } from './lessons/dubai';
import { tr } from '../i18n';
import { lessonNote, lessonsTranslated, lt } from '../i18n/lessons';

export * from './lessonKit';

export const LESSONS: Record<LessonId, Lesson> = {
  basics: {
    id: 'basics',
    title: 'Mahjong for beginners',
    scenes: [
      S('Welcome to the club', 'Hello, and welcome to JongClub! I’m Mei. Come in, pull up a chair, the tea is still warm. If you’re new to Mahjong, all these tiles can look a little intimidating at first. Don’t worry, everyone feels that way on their first day. Once we break it down, it’s really quite simple. Let me show you!', { tiles: ['5p', 'Rd', 'E', '3s', '7m'] }),
      S('The table', 'This is our table. Four friends sit around it, and each seat is named after a wind. You’re East. South is on your right, West is across, and North is on your left. East is the dealer, which simply means the player who starts the hand. Tonight, that’s you.', { board: 'seats' }),
      S('The shuffle', 'Before every hand, all the tiles are turned face down and mixed, with that lovely clatter you’ll soon come to love. Nobody can see which tile is which.', { video: 'wall', demo: 'wash', caption: 'At JongClub, the table washes the tiles and builds the wall for you.' }),
      S('The wall', 'Then we build the tiles into four walls, two tiles high, pushed together into a square. Everyone draws from the wall, one tile at a time.', { demo: 'wall' }),
      S('Three suits', 'Most of the tiles belong to three suits, each numbered one to nine: Cracks, Bamboos and Rings. Cracks are also called Characters, and Rings are also called Dots. If you’ve ever played cards, you already know the idea. They’re just like hearts, clubs and spades.', {
        list: [
          { tiles: '123456789m', title: 'Cracks, also called Characters', text: 'A Chinese number on top, 萬 underneath.' },
          { tiles: '123456789s', title: 'Bamboos, also called Bams', text: 'Count the sticks. The 1 is a bird.' },
          { tiles: '123456789p', title: 'Rings, also called Dots', text: 'Count the rings.' },
        ],
      }),
      S('Reading a tile', 'Reading a tile is easy. For Rings and Bamboos, just count. For Cracks, the top symbol is the number. And at JongClub, every tile has its number in the corner, so you never have to guess.', {
        list: [
          { tiles: '3p', title: 'Rings', text: 'Count the rings: three rings, the 3 of Rings.' },
          { tiles: '4s', title: 'Bamboos', text: 'Count the sticks: four sticks, the 4 of Bamboos.' },
          { tiles: '1s', title: 'The 1 of Bamboos', text: 'A bird instead of one stick. It’s just the 1.' },
          { tiles: '7m', title: 'Cracks', text: 'The top symbol is the number. Look at the corner: 7.' },
        ],
      }),
      S('The honours', 'Then we have the honours, my favourites. Four winds: East, South, West and North. And three dragons: Red, Green and White. Honours have no numbers, so they can never be part of a run.', {
        cards: [
          { tiles: 'E S W N', title: 'Four winds', alt: 'East · South · West · North', text: 'The four directions of the compass.' },
          { tiles: 'Rd Gd Wd', title: 'Three dragons', alt: 'Red · Green · White', text: 'The White Dragon is a plain frame.' },
        ],
      }),
      S('Four of each', 'Here’s a little secret. There are four copies of every suit tile and every honour, one hundred and thirty-six tiles. Then come eight bonus tiles, just one of each: four flowers and four seasons. That makes one hundred and forty-four, the full set India Rules plays with.', {
        table: {
          head: ['Tiles', 'Kinds', 'Copies', 'Total'],
          rows: [
            [{ tiles: '1m 1p 1s', text: 'Suits' }, '3 suits × 9 numbers', '× 4', '108'],
            [{ tiles: 'E S W N', text: 'Winds' }, '4', '× 4', '16'],
            [{ tiles: 'Rd Gd Wd', text: 'Dragons' }, '3', '× 4', '12'],
            [{ tiles: 'F1 F5', text: 'Flowers and seasons' }, '8', '× 1', '8'],
            ['All together', '', '', '144'],
          ],
        },
      }),
      S('Flowers, seasons and jokers', 'Now the bonus tiles. Four flowers and four seasons, each numbered one to four. You never build sets with them. Draw one, put it aside, and take a new tile from the flower wall. Some India Rules games add jokers, wild tiles that can stand in for others. The traditional Chinese game uses none of these.', {
        list: [
          { tiles: 'F1 F2 F3 F4', title: 'Flowers', text: 'Numbered 1 to 4. Used in India Rules.' },
          { tiles: 'F5 F6 F7 F8', title: 'Seasons', text: 'Numbered 1 to 4. Used in India Rules.' },
          { tiles: 'F3 5s', title: 'Jokers', text: 'Wild tiles in some India Rules games: in the North round, the flowers, or a number East names, can turn wild.' },
          { tiles: 'Rd 5p', title: 'The traditional Chinese game', text: 'Plays without flowers, seasons or jokers.' },
        ],
      }),
      S('The goal', 'Now, the goal. You want four sets and one pair, fourteen tiles. A set can be a run, three of a kind, or one of the Indian sets, the mixed chow and the crochet. I’ll show you each in a moment. Complete that, and you call out, Mahjong! It’s the best feeling in the club, I promise!', {
        hand: {
          title: 'A winning hand: four sets and one pair',
          groups: [
            { tiles: '123m', label: 'Chow', sub: 'a run' },
            { tiles: '2m 3s 4p', label: 'Mixed chow', sub: 'across 3 suits' },
            { tiles: '7m 7s 7p', label: 'Crochet', sub: 'one number, 3 suits' },
            { tiles: 'RdRdRd', label: 'Pung', sub: 'three the same' },
            { tiles: 'EE', label: 'The pair', mark: 'hl' },
          ],
          facts: ['4 sets × 3 tiles = 12', '+ 1 pair = 14 tiles'],
        },
      }),
      S('Sets', 'So, what’s a set? Usually three tiles. A chow is a run in one suit, like three, four, five of Bamboos. A pung is three of the same tile. A kong is four of the same, but still just one set. And India Rules adds two more: a mixed chow, a run across the three suits, and a crochet, one number in all three suits.', {
        cards: [
          { tiles: '345s', title: 'Chow', alt: 'a run', text: 'Three numbers in a row, all in one suit.' },
          { tiles: 'EEE', title: 'Pung', alt: 'three the same', text: 'Any tile, three times.' },
          { tiles: '7777p', title: 'Kong', alt: 'four the same', text: 'Four of one tile. Still just one set.' },
          { tiles: '4m 5s 6p', title: 'Mixed chow', alt: 'a run across the suits', text: 'Three numbers in a row, one from each suit.' },
          { tiles: '2m 2s 2p', title: 'Crochet', alt: 'one number, three suits', text: 'The same number in all three suits.' },
        ],
      }),
      S('What isn’t a run', 'A few things look like runs, but aren’t. Numbers can’t skip, and they don’t go round the corner from nine back to one. A run in two suits is neither a chow nor a mixed chow. And honours never make runs at all, not even the three dragons, Red, Green and White.', {
        list: [
          { tiles: '2s 4s 6s', title: 'Gaps', text: 'Not a run: the numbers must be next to each other.' },
          { tiles: '3s 4s 5m', title: 'Two suits', text: 'Not a run: a chow is one suit, a mixed chow uses all three.' },
          { tiles: '8s 9s 1s', title: 'Round the corner', text: 'Not a run: nine never wraps back to one.' },
          { tiles: 'E S W', title: 'Winds', text: 'Never a run. Winds only make pungs and kongs.' },
          { tiles: 'Rd Gd Wd', title: 'Red, Green and White dragons', text: 'Not a chow. Dragons only make pungs and kongs.' },
        ],
      }),
      S('The pair', 'The pair is the easy part. Any two matching tiles will do: that’s a pure pair. India Rules has one more pair, the knit: the same number in two suits. But a knit counts as your pair only when your hand also holds a crochet. Every winning hand needs exactly one pair.', {
        list: [
          { tiles: 'EE', title: 'A pure pair', text: 'Two of the same tile. Numbers or honours, both are fine.' },
          { tiles: '7m 7s', title: 'A knit', text: 'One number in two suits. Your pair only when your hand holds a crochet.' },
          { tiles: '2m 3m', title: 'Not a pair', text: 'The two tiles must match exactly.' },
        ],
      }),
      S('Your turn', 'Every turn has the same gentle rhythm. Draw one tile from the wall, then throw one away, face up, into the middle of the table. That’s called a discard. Between turns, you’ll always hold thirteen. Draw, discard. You’ll find it quite relaxing.', { demo: 'turn' }),
      S('Turn by turn', 'Turns go around the table to the right: East, then South, then West, then North, and back to East. When it isn’t your turn, just watch what the others throw away.', { board: 'turns' }),
      S('Calling', 'Here’s the fun part! When someone discards a tile you need, you can call for it. Two that match? Call Pung, from anyone. Need it for a run? Call Chow, only from your left. Place the set face up in front of your rack, discard, and play carries on from you. And a tile that finishes your hand? Call Mahjong, from anyone, for any set: even a pair, knit, crochet or mixed chow!', { demo: 'call' }),
      S('Which call when?', 'Here are the calls you can make, and the sets you can never call. Pung needs two matching tiles in your hand. Chow needs two tiles of a run, and only from your left. Kong needs three matching. But you can never call a tile for a pair, a mixed chow, a knit or a crochet. Those always come from your hand or the wall. Only Mahjong may take any tile, for any set.', {
        tables: [
          {
            title: 'Calls you can make',
            head: ['Call', 'You hold', 'You can take it from'],
            rows: [
              [{ tiles: '5s 5s', text: 'Pung' }, 'Two matching tiles', 'Anyone'],
              [{ tiles: '4s 6s', text: 'Chow' }, 'Two tiles of a run', 'Only the player on your left'],
              [{ tiles: '5s 5s 5s', text: 'Kong' }, 'Three matching tiles, still in your hand', 'Anyone'],
              [{ tiles: 'EE', text: 'Mahjong' }, 'A hand that one tile finishes', 'Anyone, for any set'],
            ],
          },
          {
            title: 'Never called',
            head: ['Set', 'Example', 'Where it comes from'],
            rows: [
              ['Pair', { tiles: 'NN' }, 'Your hand or the wall'],
              ['Mixed chow', { tiles: '2m 3s 4p' }, 'Your hand or the wall'],
              ['Crochet', { tiles: '7m 7s 7p' }, 'Your hand or the wall'],
              ['Knit', { tiles: '9m 9p' }, 'Your hand or the wall'],
            ],
          },
        ],
      }, 'Pung, chow and kong.'),
      S('A kong after a pung', 'One thing to know about kongs. Once your pung is face up, you can’t call a thrown tile to make it a kong. But if you draw the fourth tile yourself, you can add it on your turn: an added kong. Then draw a replacement tile from the flower wall.', {
        list: [
          { tiles: '5s 5s 5s 5s', title: 'A thrown fourth tile: no', text: 'A face-up pung can’t claim a discard to become a kong' },
          { tiles: 'Gd Gd Gd Gd', title: 'Your own draw: an added kong', text: 'Add it to your face-up pung on your turn, then draw a replacement tile' },
        ],
      }),
      S('Be quick to call', 'Calls happen in a short window, right after a tile is thrown. If you wait too long, the next player draws, and the chance is gone. Online, that window can be almost instant. When playing against AI players, the table’s timer can be set to relaxed, standard or competitive. While you’re learning, relaxed gives you plenty of time.', { tiles: ['5s', '5s'] }),
      S('You are ready', 'And that’s really all there is to it. Draw, discard, build your sets, and find your pair. JongBot, our helper, will sit right beside you at the table whenever you’d like a hint. Before you play, let’s try a little test, just to be sure.', {
        list: [
          { tiles: '5p', title: 'Draw', text: 'Take one tile from the wall.' },
          { tiles: 'N', title: 'Discard', text: 'Throw your loneliest tile into the middle.' },
          { tiles: '555s', title: 'Call', text: 'Take a discard that finishes a set.' },
          { tiles: 'EE', title: 'Win', text: 'Four sets and a pair: Mahjong!' },
        ],
      }),
    ],
    quiz: [
      Q('What makes a winning hand?', ['Four sets and one pair', 'Thirteen different tiles', 'Five pairs'], 0, 'A winning hand is four sets plus one pair: fourteen tiles.'),
      Q('Which of these is a chow?', [['Run in one suit', '345s'], ['Numbers with a gap', '2s 4s 6s'], ['Three winds', 'E S W']], 0, 'A chow is three numbers in a row in the same suit. Gaps don’t count, and honours never make runs.'),
      Q('Which of these is a crochet?', [['One number in all three suits', '2m 2s 2p'], ['A run in one suit', '234p'], ['Three of one wind', 'NNN']], 0, 'A crochet is the same number in Cracks, Bamboos and Rings.'),
      Q('Which tile is an honour?', [['Red Dragon', 'Rd'], ['5 Rings', '5p'], ['9 Bamboo', '9s']], 0, 'Winds and dragons are honours. Numbered tiles belong to suits.'),
      Q('What do you do on your turn?', ['Draw one tile, then discard one', 'Discard two tiles', 'Draw until you win'], 0, 'Every turn: draw one, discard one. You keep thirteen.'),
      Q('Someone discards a 5 Bamboo and you hold two 5 Bamboo. What can you call?', ['Pung', 'Nothing', 'Chow'], 0, 'Two matching tiles plus the discard make a pung, so you can call Pung.'),
      Q('When can you call a discard?', ['Straight away, before the next player draws', 'Any time later in the hand', 'Only at the end of the hand'], 0, 'A call must be made quickly, right after the discard. Once the next player draws, the chance is gone.'),
      Q('Someone throws the tile your mixed chow needs. Can you call it?', ['Only if it finishes your hand', 'Yes, from anyone', 'Only from your left'], 0, 'Pairs, mixed chows, knits and crochets can’t be called. They come from your hand or the wall, unless the tile wins your hand.'),
    ],
  },
  words: wordsLesson,
  scoring: scoringLesson,
  classic: classicLesson,
  shapes: shapesLesson,
  tradition: traditionLesson,
  efficiency: efficiencyLesson,
  waits: waitsLesson,
  defence: defenceLesson,
  value: valueLesson,
  riichi: {
    id: 'riichi',
    title: 'Japanese Riichi',
    scenes: [
      S('A trip to Tokyo', 'Hello again! Tonight, we’re off to Tokyo. Riichi is Japan’s favourite, played in busy parlours and online. Compared with Classic, the tiles are the same, and so is four sets and a pair. What’s new? Every win needs a named pattern, and scores are counted in han and fu. Let me show you!', { tiles: ['234m', '567p', '345s', '678s', '22p'] }),
      S('New words', 'First, the words. You’ll call Chi for a chow, Pon for a pung, and Kan for a kong. A win on a discard is Ron. A win on your own draw is Tsumo. And a ready hand, one tile from winning, is tenpai.', { tiles: ['345s', '555p', '9999m'] }),
      S('Every win needs a yaku', 'Here’s the most important rule. Every win needs at least one yaku, a named scoring pattern. No yaku, no win, even if your hand is complete. It catches everyone out once, so now you know!', { tiles: ['234m', '567p', '345s', '678s', '22p'] }),
      S('Declare riichi', 'The easiest yaku is riichi itself. Keep your hand closed, with no calls. When you’re tenpai, declare riichi and place a one thousand point stick on the table. From then on your hand is locked, and you’re waiting for that one lucky tile.', { tiles: ['234m', '567p', '345s', '678s', '2p'] }),
      S('Other easy yaku', 'Here are two more you can use right away. All simples, a hand with only twos to eights, so no ones, nines or honours. And a value pung: three dragons, your seat wind, or the round wind.', { tiles: ['RdRdRd', '456s', '33p'] }),
      S('Dora', 'Now for a little treasure. The last fourteen tiles of the wall are kept aside, and we call them the dead wall. One of them is turned face up as the indicator. The next tile in order is the dora, and each one in your hand adds a han. Dora adds value, but on its own it isn’t a yaku.', { tiles: ['3s', '4s'] }),
      S('Furiten', 'You can win by Ron or by Tsumo. But be careful! If you’ve already discarded one of your own winning tiles, you’re furiten, and then only Tsumo will do.', { tiles: ['3m', '6m'] }),
      S('Han and fu', 'Now scoring, at a gentle level. Han are the doubles. Each yaku and each dora adds han. Fu are small extra points for how the hand is built, and most hands have thirty. A one han, thirty fu hand won by Ron is worth one thousand points. Each extra han roughly doubles it, and five han is a mangan, eight thousand.', { tiles: ['234m', '567p', '345s', '678s', '22p'] }),
      S('Who pays', 'Win by Ron, and the discarder pays it all. Win by Tsumo, and everyone pays a share, with the dealer paying double. And the dealer’s own wins are worth half as much again. Don’t worry, the table does the maths for you.', { tiles: ['5p'] }),
      S('A hanchan', 'Riichi players in Japan usually play the East and South rounds, which they call a hanchan, or half game. The dealer keeps the deal by winning, or by being ready when the wall runs out. At JongClub, a Riichi table plays a hanchan unless you choose otherwise.', { tiles: ['E', 'S'] }),
    ],
    quiz: [
      Q('Your hand is complete but has no yaku. Can you win?', ['No, every win needs a yaku', 'Yes, any complete hand wins', 'Only on a discard'], 0, 'In Riichi, a complete hand still needs at least one yaku.'),
      Q('What does declaring riichi cost?', ['A 1,000 point stick', 'Nothing', 'Half your points'], 0, 'You put a 1,000 point stick on the table when your riichi stands.'),
      Q('The dora indicator is a 3 Bamboo. Which tile is dora?', [['4 Bamboo', '4s'], ['3 Bamboo', '3s'], ['2 Bamboo', '2s']], 0, 'Dora is the tile after the indicator: 3 Bamboo points to 4 Bamboo.'),
      Q('You wait on 3 and 6 Characters, and you already discarded a 6. What can you do?', ['Only win by Tsumo', 'Win on any discard', 'Nothing until next hand'], 0, 'Discarding one of your winning tiles makes you furiten: Tsumo only.'),
      Q('What does Ron mean?', ['Winning on another player’s discard', 'Winning on your own draw', 'Calling a pung'], 0, 'Ron is a win on a discard. Tsumo is a win on your own draw.'),
      Q('A one han, thirty fu hand won by Ron. What is it worth?', ['1,000 points', '8,000 points', '30 points'], 0, 'One han and thirty fu is worth one thousand points. Five han is a mangan, eight thousand.'),
    ],
  },
  taiwanese: {
    id: 'taiwanese',
    title: 'Taiwanese Mahjong',
    scenes: [
      S('Welcome to Taipei', 'Hi, welcome back! Next stop, Taipei. Taiwanese Mahjong is played across Taiwan, and by Taiwanese families everywhere. Compared with Classic, you hold more tiles, flowers are always in, and hands are scored in tai. Let me show you around!', { tiles: ['123m', '456m', '789p', '345s', 'EEE', 'WdWd'] }),
      S('New words', 'Here you’ll call Chi for a chow, Pong for a pung, and Gang for a kong. A win on a discard is Hu, and a win on your own draw is Zimo.', { tiles: ['345s', '555p', '9999m'] }),
      S('Sixteen tiles', 'First, you’ll hold sixteen tiles, not thirteen. So a winning hand is five sets and a pair, seventeen tiles in total.', { tiles: ['123m', '456m', '789p', '345s', 'EEE', 'WdWd'] }),
      S('Flowers', 'See these pretty ones? There are eight flower tiles in the wall. When you draw one, set it aside face up and draw a replacement. If it’s your own seat flower, it’s worth a tai.', { tiles: ['F1', 'F2', 'F5', 'F6'] }),
      S('Tai', 'Tai are simply added up, never doubled. A concealed hand is one tai, and a self-draw is one. Both together make three. A pung of dragons, your seat wind or the round wind, or waiting on a single tile, adds one each.', { tiles: ['RdRdRd', 'EEE'] }),
      S('Counting the score', 'Each hand is worth a base of three hundred, plus one hundred for every tai. So a hand with no tai is worth three hundred, and a three tai hand is worth six hundred.', { tiles: ['RdRdRd', 'EEE'] }),
      S('Who pays', 'Here’s how paying works. Win on a discard, and only the player who discarded pays. Win on your own draw, and all three players pay that amount.', { tiles: ['5p'] }),
      S('The dealer', 'And the dealer? They add a tai to any hand they win or pay for, plus two more for every hand they keep the deal. So keep an eye on a dealer who’s on a streak!', { tiles: ['E'] }),
      S('A long evening', 'Taiwanese tables love a long game, all the way through the four winds: East, South, West and North. The dealer keeps the deal on a win, or when nobody wins, so a lucky dealer can stay East for a while.', { tiles: ['E', 'S', 'W', 'N'] }),
    ],
    quiz: [
      Q('How many tiles do you hold between turns?', ['16', '13', '14'], 0, 'Taiwanese hands are sixteen tiles.'),
      Q('What is a winning hand?', ['Five sets and a pair', 'Four sets and a pair', 'Eight pairs'], 0, 'Five sets plus a pair makes seventeen tiles.'),
      Q('You draw a flower. What happens?', ['Set it aside and draw a replacement', 'Discard it', 'Keep it in your hand'], 0, 'Flowers go face up beside you and you draw again.'),
      Q('You win on a discard. Who pays?', ['Only the discarder', 'Everyone', 'Nobody'], 0, 'On a discard win, only the player who discarded pays.'),
      Q('What is a two tai hand worth?', ['Five hundred', 'Two hundred', 'One thousand two hundred'], 0, 'Three hundred for the win, plus one hundred for each tai: five hundred.'),
    ],
  },
  american: {
    id: 'american',
    title: 'American Mahjong',
    scenes: [
      S('New York, New York', 'Hello, hello! Now we’re in New York. American Mahjong is played across the United States, often by groups who meet every week. It’s a game all of its own, so set aside the Asian rules for tonight. There are no chows, and you can’t just build any sets you like. Instead, you play from a card. Let me show you how it works!', { tiles: ['NNNN', 'EEE', 'WWW', 'SSSS'] }),
      S('New words', 'Tonight’s new words are the card, jokers, the Charleston, and exposures. A win is called Mah Jongg. You’ll call Pung for three of a kind, and Kong for four. And here, groups can be bigger: five of a kind is a quint.', { tiles: ['5555s J'] }),
      S('The card', 'Real American groups play from the National Mah Jongg League’s card, printed fresh every year. It lists every hand you’re allowed to win with. Look at your tiles, pick one or two hands that match, and build toward them exactly. At the table, just tap Card to see JongClub’s own card.', { tiles: ['F1 F5', '2222m', '44p', '66p', '8888m'] }),
      S('Jokers and flowers', 'There are eight jokers. A joker can stand in for any tile in a group of three or more, but never in a pair, and never on its own. The eight flowers all count as the same tile here, and they stay in your hand.', { tiles: ['J', 'J', 'F1', 'F5'] }),
      S('The Charleston', 'Before play begins, there’s a lovely tradition called the Charleston. Everyone passes three tiles at the same time: to the right, then across, then to the left. If everyone agrees, you pass again: left, across, right. Just remember, jokers can never be passed.', { demo: 'charleston' }),
      S('Calling and swapping', 'You can call a discard only to complete a group of three or more. Then you lay the group face up, and that’s called an exposure. Pairs and single tiles can only be called for Mah Jongg. And here’s a clever move: on your turn, you may swap a real tile for a joker in anyone’s exposure.', { tiles: ['5s', '5s', 'J'] }),
      S('Paying', 'Every hand on the card has its value printed beside it, like twenty-five or fifty. Win on a discard, and the discarder pays double, while the others pay the value once. Win on your own draw, and everyone pays double. If your hand has no jokers at all, the value doubles too.', { tiles: ['2m', 'Wd', '2m', '6m'] }),
      S('A quick example', 'Say you win a twenty-five hand on a discard. The discarder pays you fifty, and the other two pay twenty-five each. Draw it yourself instead, and all three pay you fifty.', { tiles: ['5p'] }),
      S('The deal and the round', 'American play keeps things simple. The deal passes every hand, and there’s no round wind to score, because every hand is matched against the card.', { tiles: ['E', 'S', 'W', 'N'] }),
      S('A goulash', 'Some groups add a custom after a wall game, when nobody wins: a goulash. East keeps the deal for one more hand, which starts with a Charleston, and the house may let jokers be passed. Why give one away? A joker can’t stand in for a pair or a single tile, so a player chasing a hand of pairs can’t use it, and would rather swap it for a tile they need.', { tiles: ['J', 'J', '9p'] }),
    ],
    quiz: [
      Q('How do you win in American Mahjong?', ['Match a hand on the card exactly', 'Any four sets and a pair', 'Seven pairs of anything'], 0, 'You must complete one hand from the card.'),
      Q('Can a joker be part of a pair?', ['No, only groups of three or more', 'Yes, anywhere', 'Only with flowers'], 0, 'Jokers fill pungs, kongs and bigger groups, never pairs or singles.'),
      Q('What order is the first Charleston?', ['Right, across, left', 'Left, left, left', 'Across, right, left'], 0, 'The first Charleston passes right, then across, then left.'),
      Q('A discard would finish a pair for you, but not your hand. Can you call it?', ['No, pairs only for Mah Jongg', 'Yes, always', 'Only if it is a joker'], 0, 'You may only call for a pair or single when it completes your hand.'),
      Q('You win a twenty-five hand on a discard. What does the discarder pay?', ['Fifty', 'Twenty-five', 'Nothing'], 0, 'The discarder pays double, so fifty. The other two pay twenty-five each.'),
    ],
  },
  uae: {
    id: 'uae',
    title: 'Dubai Asian club play',
    scenes: [
      S('An evening in Dubai', 'Hello, and welcome to the Marina club in Dubai! The Emirates are home to players from all over the world, and people play with many different house rules. There’s no single official UAE way, so JongClub has several Dubai tables. This lesson is the Dubai Asian table: much like Classic, with flowers, faan, and a goulash. Let me show you!', { tiles: ['123m', '456p', '789s', 'RdRdRd', 'EE'] }),
      S('House rules', 'House rules are simply the choices a table makes before it plays. Here, the host sets the minimum faan to win, whether flowers and chows are allowed, whether seven pairs counts, and when the dealer keeps the deal.', { tiles: ['345s'] }),
      S('Flowers', 'If flowers are on, a drawn flower goes aside and you draw again. Your own seat flower is worth one faan, a full set is worth two, and having no flowers at all also earns a faan.', { tiles: ['F1', 'F5'] }),
      S('Counting faan', 'Scoring works just like Classic. Add up your faan, and each one doubles the points. One faan is thirty-two, two is sixty-four, and three is one hundred and twenty-eight. Most hosts ask for at least one faan to win.', { tiles: ['RdRdRd', 'F1'] }),
      S('Who pays', 'On a discard, there are three ways to pay. In club slang, the discarder is the gun. Half gun: the discarder pays double, and the others pay half. Full gun: the discarder pays for everyone. Or equal: everyone pays the same. Win by self-draw, and everyone pays you in full.', { tiles: ['7p'] }),
      S('The goulash', 'When the wall runs out and nobody wins, the Dubai Asian table plays a goulash. East keeps the deal, and everyone passes three tiles before play: right, across, then left. By default, a goulash win pays double. The host can also add jokers, or a pot that grows until someone wins.', { tiles: ['9p', 'Rd', '1s'] }),
      S('Other Dubai tables', 'JongClub also has Dubai Taiwanese, Dubai American, and a custom UAE table, each with a short lesson of its own.', { tiles: ['E', 'S', 'W', 'N'] }),
      S('Check the table', 'Since the rules change from table to table, always check the table’s choices first. If you’re ever unsure, just ask the host. Everyone here is happy to help. Now, shall we try your test?', { board: 'seats' }),
    ],
    quiz: [
      Q('Is there one official UAE ruleset?', ['No, the host sets house rules', 'Yes, everyone uses it', 'Only in Abu Dhabi'], 0, 'UAE play varies, so the table host chooses the rules.'),
      Q('What does full gun mean?', ['The discarder pays for everyone', 'Everyone pays the same', 'Nobody pays'], 0, 'Full gun: the player who discarded the winning tile pays the whole table.'),
      Q('With flowers on, what is your own seat flower worth?', ['1 faan', 'Nothing', 'An instant win'], 0, 'Your seat flower adds one faan.'),
      Q('After a wall game at the Dubai Asian table, what happens?', ['A goulash: East stays and three tiles are passed', 'Everyone pays the dealer', 'The game ends'], 0, 'East keeps the deal, everyone passes three tiles, and a goulash win pays double by default.'),
      Q('How do faan work at a Dubai table?', ['Each one doubles the points', 'They’re added, ten points each', 'Only the biggest counts'], 0, 'Just like Classic, each faan doubles the points: thirty-two, sixty-four, one hundred and twenty-eight.'),
    ],
  },
  rounds: roundsLesson,
  vietnamese: vietnameseLesson,
  india: indiaLesson,
  'india-east': indiaEastLesson,
  'india-south': indiaSouthLesson,
  'india-west': indiaWestLesson,
  'india-west-doubles': indiaWestDoublesLesson,
  'india-west-big': indiaWestBigLesson,
  'india-north': indiaNorthLesson,
  indian: indianLesson,
  singapore: singaporeLesson,
  hongkong: hongKongLesson,
  mcr: mcrLesson,
  sichuan: sichuanLesson,
  malaysian: malaysianLesson,
  korean3: koreanLesson,
  sanma: sanmaLesson,
  malaysian3: malaysian3Lesson,
  'uae-taiwanese': dubaiTaiwaneseLesson,
  'uae-american': dubaiAmericanLesson,
  'uae-custom': dubaiCustomLesson,
  'riichi-tournament': riichiTournamentLesson,
  ema: emaLesson,
  korean: korean4Lesson,
  guangdong: guangdongLesson,
  'zung-jung': zungJungLesson,
  european: europeanLesson,
  wuhan: wuhanLesson,
  shanghai: shanghaiLesson,
  fujian: fujianLesson,
  beijing: beijingLesson,
  northeast: northeastLesson,
  'wright-patterson': wrightPattersonLesson,
  thai: thaiLesson,
  filipino: filipinoLesson,
  indonesian: indonesianLesson,
  strategy: strategyLesson,
};

/** The Academy path, in the order the Learn screen lists it (Foundations, Mastering Mahjong, Variations). `tradition` is optional. */
/** Scenes that teach a rule India Rules sets its own way. Each shows a note under
 * Mei's caption that other variations may differ (the user, 2026-10-25). */
export const INDIA_RULE_SCENES: Record<LessonId, string[]> = {
  basics: ['The wall', 'Four of each', 'Flowers, seasons and jokers', 'The goal', 'Sets', 'What isn’t a run', 'The pair', 'Turn by turn', 'Calling', 'Which call when?', 'A kong after a pung'],
  scoring: ['Points to start', 'Three kinds of win', 'Everyone pays the winner', 'East pays double', 'What keeps a hand concealed', 'Example one', 'Example two', 'Example three', 'Flowers and seasons pay', 'East pays flowers the same', 'When nobody wins', 'The table counts for you'],
  rounds: ['Seats that move', 'Throw for East', 'Breaking the wall', 'The flower wall', 'The round wind', 'A match of four rounds', 'The goulash round', 'How long shall we play?'],
  shapes: ['Building a crochet', 'Building a mixed chow', 'Passports', 'Passport hands', 'Card hands'],
  strategy: ['Calling wisely'],
  tradition: ['Why jokers?', 'The club rulebook'],
  words: ['More new words', 'Everything on one page'],
  efficiency: ['How many pairs?'],
  waits: ['Your own discards'],
  defence: ['Why defence wins', 'Their own discards'],
  value: ['Fast or big?', 'Card hands pay more', 'The dealer’s chance', 'The last game'],
};

export const ACADEMY_ORDER: LessonId[] = [
  // Foundations, all India Rules: Tradition is the optional Level 7, and Words at the table comes after it
  'basics', 'scoring', 'rounds', 'shapes', 'strategy', 'tradition', 'words',
  // Mastering Mahjong
  'efficiency', 'waits', 'defence', 'value',
  // Variations and regional rules
  'india', 'india-east', 'india-south', 'india-west', 'india-west-doubles', 'india-west-big', 'india-north', 'classic', 'indian',
  'hongkong', 'taiwanese', 'riichi', 'american',
  'uae', 'uae-taiwanese', 'uae-american', 'uae-custom',
  'vietnamese', 'singapore', 'malaysian', 'sichuan', 'mcr', 'korean3', 'sanma', 'malaysian3',
  // Expansion tables
  'guangdong', 'riichi-tournament', 'ema', 'korean', 'zung-jung', 'european',
  'beijing', 'northeast', 'wuhan', 'shanghai', 'fujian',
  'thai', 'indonesian', 'filipino', 'wright-patterson',
];

/** Lessons kept for old games that the Academy no longer lists. */
export const RETIRED_LESSONS: LessonId[] = [];

/** Lessons you may skip: they never block the path or the all-lessons trophy. */
export const OPTIONAL_LESSONS: LessonId[] = ['tradition'];

// ------------------------------------------------------------------ player

function boardDiagram(focus: 'seats' | 'wall' | 'centre' | 'turns') {
  const seat = (w: string, pos: string, you = false) => h('div', { class: `bd-seat bd-${pos} ${focus === 'seats' ? 'on' : ''}`, style: focus === 'turns' ? `--t:${'ESWN'.indexOf(w)}` : null }, h('b', {}, w), h('span', {}, you ? tr('You') : pos === 'top' ? tr('Across') : pos === 'left' ? tr('Left') : tr('Right')));
  const board = h(
    'div',
    { class: `board-diagram focus-${focus}`, role: 'img', 'aria-label': tr('Four seats around the table, the wall, and the discards in the middle') },
    // Seats run counter-clockwise from East: South on your right, West across, North on your left.
    seat('W', 'top'),
    seat('N', 'left'),
    seat('S', 'right'),
    seat('E', 'bottom', true),
    h('div', { class: `bd-wall ${focus === 'wall' ? 'on' : ''}` }, h('div', { class: `bd-centre ${focus === 'centre' ? 'on' : ''}` }, focus === 'centre' ? tr('Discards') : '')),
    // The turn order: a gold arrow draws from each seat to the next, East, South, West, North, and round again.
    focus === 'turns' ? h('span', { class: 'bd-turns', 'aria-hidden': 'true', html: TURN_ARCS }) : null,
  );
  if (focus !== 'turns') return board;
  // The turn order, with two ways to remember it: the first letters spell East, South, West, North.
  const phrase = (words: string[]) => h('span', { class: 'bd-phrase' }, ...words.flatMap((w, i) => [i ? ' ' : '', h('b', {}, w[0]), w.slice(1)]));
  return h(
    'div',
    { class: 'bd-turns-wrap' },
    board,
    h('p', { class: 'bd-mnemonic', lang: 'en' }, h('span', { class: 'bd-k' }, 'Remember it'), phrase(['Eat', 'Soup', 'With', 'Noodles']), h('i', {}, 'or'), phrase(['East', 'Starts,', 'We’re', 'Next'])),
  );
}

const TURN_PATHS = ['M58 79 Q77 77 79 58', 'M79 42 Q77 23 58 21', 'M42 21 Q23 23 21 42', 'M21 58 Q23 77 42 79'];
const TURN_ARCS = `<svg viewBox="0 0 100 100"><defs><marker id="bd-tip" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="#ead09a"/></marker></defs>${TURN_PATHS.map((d) => `<path class="bd-arc-bg" d="${d}"/>`).join('')}${TURN_PATHS.map((d, i) => `<path class="bd-arc" style="--t:${i}" d="${d}" pathLength="1" marker-end="url(#bd-tip)"/>`).join('')}</svg>`;

function sceneVisual(v: Visual, labels: boolean): HTMLElement {
  if ('board' in v) return boardDiagram(v.board);
  if ('hand' in v) return handPic(v.hand, labels);
  if ('table' in v) return tablePic(v.table, labels);
  if ('tables' in v) return h('div', { class: 'lesson-pics' }, ...v.tables.map((t) => tablePic(t, labels)));
  if ('list' in v) return listPic(v.list, labels, v.title);
  if ('cards' in v) return cardsPic(v.cards, labels);
  if ('video' in v) return videoPic(v.video, labels, v.demo, v.caption);
  if ('demo' in v) return demoPic(v.demo, labels);
  return tilesRow(v.tiles, labels);
}

function tilesRow(specs: string[], labels: boolean) {
  return h('div', { class: 'lesson-tiles' }, ...specs.map((spec) => h('div', { class: 'meld' }, ...parseKinds(spec).map((k) => tileImg(k, '', labels)))));
}

const passedQuiz = (firstTry: number, total: number) => Math.round((firstTry / total) * 100) >= 80;

function resultLine(firstTry: number, total: number) {
  return passedQuiz(firstTry, total)
    ? `Wonderful! You got ${firstTry} of ${total} right first time. You’re ready for the table. Shall we play?`
    : `You got ${firstTry} of ${total} right first time. That’s a good start! Let’s go through it once more together, then try again.`;
}

const wrongLine = (explain: string) => `Not quite. ${explain} Have another go!`;

/** Every line Mei can say, for recording the narration clips. */
export function narrationLines(): string[] {
  const out = new Set<string>(['Hello! This is how I will sound at the table.']);
  for (const l of Object.values(LESSONS)) {
    for (const s of l.scenes) out.add(s.say);
    for (const q of l.quiz) {
      out.add(q.q);
      out.add(wrongLine(q.explain));
    }
    for (let n = 0; n <= l.quiz.length; n++) out.add(resultLine(n, l.quiz.length));
  }
  for (const line of coachLines()) out.add(line);
  for (const line of versionLines()) out.add(line);
  for (const s of VARIATION_SHEETS) if (s.mei) out.add(s.mei);
  for (const line of matchLines()) out.add(line);
  for (const line of placementLines()) out.add(line);
  return [...out];
}

export interface LessonPlayerOptions {
  labels: boolean;
  /** Called once the test is passed. */
  onPassed(): void;
  practiceLabel: string;
  onPractice(): void;
  /** The next lesson in the Academy, offered once the test is passed (left out at the end of the path). */
  nextLabel?: string;
  onNext?(): void;
  /** Open another lesson (the base lesson a Dubai table builds on). */
  onOpenLesson?(id: LessonId): void;
  /** Start the first scene straight away (the player chose this lesson). Otherwise a start card waits for a tap. */
  autostart?: boolean;
}

/** A self-contained story lesson with narration, then a test. */
export function lessonPlayer(lesson: Lesson, opts: LessonPlayerOptions): HTMLElement {
  const root = h('div', { class: 'lesson story' });
  let i = 0;
  let speaking = 0;

  const voiceBtn = () =>
    narrator.available
      ? h(
          'button',
          {
            class: `btn sm ghost voice-btn ${narrator.enabled ? 'on' : ''}`,
            'aria-pressed': String(narrator.enabled),
            title: tr('Turns Mei’s spoken voice on or off. The choice is remembered on this device.'),
            onclick: () => {
              narrator.setEnabled(!narrator.enabled);
              scene();
            },
          },
          narrator.enabled ? tr('🔊 Voice on') : tr('🔇 Voice off'),
        )
      : null;

  // Moving to another scene or question: the card grows or shrinks smoothly from its old height to
  // the new one (so the page never jumps or leaves a gap), and the page glides once to the top of
  // the card, just under the header.
  let release = 0;
  const go = (show: () => void) => {
    window.clearTimeout(release);
    Object.assign(root.style, { height: '', overflow: '', transition: '' });
    const from = root.offsetHeight;
    show();
    const to = root.offsetHeight;
    if (Math.abs(to - from) > 2 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      Object.assign(root.style, { boxSizing: 'border-box', height: `${from}px`, overflow: 'hidden' });
      void root.offsetHeight;
      Object.assign(root.style, { transition: `height ${Math.min(0.5, 0.25 + Math.abs(to - from) / 2400).toFixed(2)}s cubic-bezier(0.4, 0, 0.2, 1)`, height: `${to}px` });
      release = window.setTimeout(() => Object.assign(root.style, { height: '', overflow: '', transition: '' }), 560);
    }
    requestAnimationFrame(() => {
      let sc: HTMLElement | null = root.parentElement;
      while (sc && !/(auto|scroll)/.test(getComputedStyle(sc).overflowY)) sc = sc.parentElement;
      const scroller = sc ?? (document.scrollingElement as HTMLElement);
      const head = document.querySelector('header');
      const headBottom = head && /fixed|sticky/.test(getComputedStyle(head).position) ? head.getBoundingClientRect().bottom : 0;
      const top = Math.max(sc ? sc.getBoundingClientRect().top : 0, headBottom);
      const target = scroller.scrollTop + root.getBoundingClientRect().top - top - 12;
      if (Math.abs(target - scroller.scrollTop) > 4) scroller.scrollTo({ top: Math.max(0, target), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
  };

  const speak = (text: string) => {
    const id = ++speaking;
    root.classList.add('speaking');
    narrator.say(text).then(() => id === speaking && root.classList.remove('speaking'));
  };

  const scene = () => {
    const s = lesson.scenes[i];
    const pic = s.visual ? sceneVisual(s.visual, opts.labels) : null;
    root.classList.add('playing');
    clear(root).append(
      h(
        'div',
        { class: 'lesson-progress jump' },
        ...lesson.scenes.map((sc, j) =>
          h('button', { type: 'button', class: `lp-seg ${j <= i ? 'on' : ''}`, title: lt(sc.title), 'aria-label': `${j + 1}. ${lt(sc.title)}`, 'aria-current': j === i ? 'step' : null, onclick: () => j !== i && go(() => ((i = j), scene())) }),
        ),
        h('button', { type: 'button', class: 'lp-seg quiz-dot', title: tr('Take the test'), 'aria-label': tr('Take the test'), onclick: () => go(quiz) }),
      ),
      h('div', { class: 'story-head' }, h('p', { class: 'eyebrow' }, `${lt(lesson.title)} · ${tr('{n} of {total}', { n: i + 1, total: lesson.scenes.length })}`), voiceBtn()),
      lessonNote() ? h('p', { class: 'lesson-lang-note' }, lessonNote()) : '',
      h('h3', { lang: lessonsTranslated() ? null : 'en' }, lt(s.title)),
      pic ?? '',
      h('div', { class: 'narration' }, h('div', { class: 'narrator', 'aria-hidden': 'true' }, 'M'), h('p', { class: 'lesson-body', lang: lessonsTranslated() ? null : 'en', dir: lessonsTranslated() ? null : 'ltr' }, lt(s.say)), meiAside(s.aside ?? s.say, pic, opts.labels, { n: i + 1, total: lesson.scenes.length, title: lesson.scenes[i + 1]?.title ?? null })),
      i === 0 && lesson.base && LESSONS[lesson.base] && opts.onOpenLesson
        ? h('button', { class: 'btn sm lesson-base', onclick: () => (narrator.stop(), opts.onOpenLesson!(lesson.base!)) }, tr('New to this game? Start with “{lesson}” ›', { lesson: lt(LESSONS[lesson.base].title) }))
        : '',
      INDIA_RULE_SCENES[lesson.id]?.includes(s.title) ? h('p', { class: 'lesson-rule-note' }, tr('This rule follows India Rules. Other variations may differ.')) : '',
      h(
        'div',
        { class: 'btn-row' },
        i > 0 ? h('button', { class: 'btn ghost', onclick: () => go(() => (i--, scene())) }, tr('Back')) : null,
        h('button', { class: 'btn ghost', onclick: () => speak(s.say) }, tr('Replay')),
        i < lesson.scenes.length - 1
          ? h('button', { class: 'btn primary', onclick: () => (sound.play('button'), go(() => (i++, scene()))) }, tr('Next'))
          : h('button', { class: 'btn primary', onclick: () => (sound.play('button'), go(quiz)) }, tr('Take the test')),
      ),
    );
    speak(s.say);
  };

  // The test: every question must be answered correctly; a wrong answer
  // explains why and asks again. Passing needs 80% right first time.
  const quiz = () => {
    narrator.stop();
    let q = 0;
    let firstTry = 0;
    let missed = false;
    const ask = () => {
      const item = lesson.quiz[q];
      // Show options in a stable shuffled order so the answer isn't always first.
      // (Seeded by the lesson and question: the old fixed pattern put every lesson's first answer first.)
      let seed = [...`${lesson.id}:${q}`].reduce((a, c) => Math.imul(a ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
      const order = item.options.map((_, k) => k);
      for (let j = order.length - 1; j > 0; j--) {
        seed = (Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
        const r = seed % (j + 1);
        [order[j], order[r]] = [order[r], order[j]];
      }
      const feedback = h('p', { class: 'quiz-feedback', 'aria-live': 'polite' });
      // No tile-name plaques during the test.
      const opts2 = h('div', { class: 'quiz-options', 'data-no-tips': '' });
      for (const k of order) {
        const o = item.options[k];
        const b = h('button', { class: 'quiz-option' }, o.tiles ? h('span', { class: 'meld' }, ...parseKinds(o.tiles).map((t) => tileImg(t, 'mini', opts.labels))) : null, h('span', {}, lt(o.text)));
        b.onclick = () => {
          if (k === item.answer) {
            sound.play('score');
            if (!missed) firstTry++;
            b.classList.add('right');
            feedback.textContent = tr('Correct!');
            opts2.querySelectorAll('button').forEach((x) => ((x as HTMLButtonElement).disabled = true));
            setTimeout(() => {
              q++;
              missed = false;
              go(q < lesson.quiz.length ? ask : done);
            }, 700);
          } else {
            sound.play('click');
            missed = true;
            b.classList.add('wrong');
            b.disabled = true;
            feedback.textContent = lt(wrongLine(item.explain));
            speak(wrongLine(item.explain));
          }
        };
        opts2.append(b);
      }
      clear(root).append(
        h('div', { class: 'lesson-progress' }, ...lesson.quiz.map((_, j) => h('i', { class: j < q ? 'on' : j === q ? 'now' : '' }))),
        h('p', { class: 'eyebrow' }, tr('Test · question {n} of {total}', { n: q + 1, total: lesson.quiz.length })),
        h('h3', {}, lt(item.q)),
        opts2,
        feedback,
      );
      speak(item.q);
    };
    const done = () => {
      const passed = passedQuiz(firstTry, lesson.quiz.length);
      if (passed) opts.onPassed();
      const line = resultLine(firstTry, lesson.quiz.length);
      clear(root).append(
        h('p', { class: 'eyebrow' }, passed ? tr('Test passed') : tr('Almost there')),
        h('h3', {}, passed ? tr('You’ve got it.') : tr('One more look')),
        h('div', { class: 'narration' }, h('div', { class: 'narrator', 'aria-hidden': 'true' }, 'M'), h('p', { class: 'lesson-body' }, lt(line))),
        h(
          'div',
          { class: 'btn-row' },
          h('button', { class: 'btn ghost', onclick: () => go(() => ((i = 0), scene())) }, tr('Review the lesson')),
          passed ? h('button', { class: 'btn primary', onclick: () => (narrator.stop(), opts.onPractice()) }, opts.practiceLabel) : h('button', { class: 'btn primary', onclick: () => go(quiz) }, tr('Retake the test')),
          passed && opts.nextLabel && opts.onNext ? h('button', { class: 'btn', onclick: () => (narrator.stop(), opts.onNext!()) }, opts.nextLabel) : null,
        ),
      );
      speak(line);
    };
    ask();
  };

  // Nothing plays until the player asks: a start card first, unless they just picked this lesson.
  const intro = () =>
    (root.classList.remove('playing'), clear(root)).append(
      h('div', { class: 'story-head' }, h('p', { class: 'eyebrow' }, lt(lesson.title)), voiceBtnIntro()),
      h('h3', { lang: lessonsTranslated() ? null : 'en' }, lt(lesson.title)),
      h('div', { class: 'narration' }, h('div', { class: 'narrator', 'aria-hidden': 'true' }, 'M'), h('p', { class: 'lesson-body' }, tr('{n} short scenes with Mei, then a quick test.', { n: lesson.scenes.length })), lessonContents(lesson)),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn primary lesson-begin', onclick: () => (sound.play('button'), go(scene)) }, tr('Begin the lesson'))),
    );
  const voiceBtnIntro = () => {
    const b = voiceBtn();
    if (b) b.onclick = () => (narrator.setEnabled(!narrator.enabled), intro());
    return b;
  };

  if (opts.autostart) scene();
  else intro();
  return root;
}
