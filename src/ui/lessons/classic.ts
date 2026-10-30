// Academy, Variations (Level 14): Chinese Classical, JongClub's 'classic'
// table and the second version after India Rules. How it differs from India
// Rules (136 tiles, runs in one suit only, no Indian sets), scoring in faan,
// following classicScore and classicPayments (src/engine/rules/classic.ts):
// faan are added up, a hand is worth 16 points doubled once per faan, eight
// faan is the limit, a self-draw is paid in full by all three players, and on
// a discard the discarder pays double and the others half. The three worked
// examples are checked against the engine in test/lessons.test.ts. Then the
// wind pungs and the deal, the other hand shapes (seven pairs, thirteen
// orphans, mixed chows and pungs) and how other tables throw the dice, moved
// here when the Foundations became India Rules (the user, 2026-10-25).

import { S, Q, type Lesson } from '../lessonKit';

export const classicLesson: Lesson = {
  id: 'classic',
  title: 'Chinese Classical',
  scenes: [
    S('The traditional game', 'Welcome to Chinese Classical, the traditional game, and the base of many tables around the world. It’s the same four sets and a pair, but simpler than India Rules. Just one hundred and thirty-six tiles, with no flowers, seasons or jokers. Runs stay in one suit, so there are no mixed chows, crochets or knits. And every hand is scored in faan.', {
      table: {
        head: ['', 'India Rules', 'Chinese Classical'],
        rows: [
          ['Tiles', '144, with flowers and seasons', '136'],
          [{ tiles: '2m 3s 4p', text: 'Indian sets' }, 'Mixed chows, crochets, knits', 'None: runs stay in one suit'],
          ['Scoring', 'Fixed payments, East double', 'Faan, doubling the points'],
        ],
      },
    }),
    S('Keeping score in faan', 'Winning is lovely. But in Classic, how you win matters too, because special hands are worth more. We count faan. Don’t worry, it’s only adding up, then doubling. Let me show you!', { tiles: ['RdRdRd', '234m', '567p', '678s', '99s'] }),
    S('Three easy steps', 'Every score takes three steps. First, count your faan. Second, turn the faan into points. Third, see who pays. That’s all! We’ll take them one at a time.', {
      list: [
        { title: '1. Count your faan', text: 'One faan for each special thing about your win.' },
        { title: '2. Turn faan into points', text: 'Start at 16 points, and double once for every faan.' },
        { title: '3. See who pays', text: 'It depends on how you won: from the wall, or from a discard.' },
      ],
    }),
    S('What is a faan?', 'A faan is a little bonus. You earn one for each special thing about your winning hand. No special things? Then you have zero faan, and that’s perfectly fine. You still win!', { tiles: ['RdRdRd'] }),
    S('The easy faan', 'Here are the easy ones. Win with a tile you drew yourself: one faan. Win with no calls at all: one faan. A pung of dragons: one faan. A pung of your seat wind, or of the round wind: one faan each.', {
      list: [
        { tiles: '5p', title: 'Self-draw', text: 'You drew the winning tile from the wall: +1' },
        { tiles: '123m', title: 'Concealed hand', text: 'You made no calls at all: +1' },
        { tiles: 'RdRdRd', title: 'Dragon pung', text: 'Three Red, Green or White Dragons: +1 each' },
        { tiles: 'EEE', title: 'Wind pung', text: 'Your seat wind or the round wind: +1 each' },
      ],
    }),
    S('Bigger patterns', 'Some patterns are worth more. All pungs is three faan. One suit plus honours, called mixed one suit, is three. One suit only, called pure one suit, is seven. And seven pairs, a hand made only of pairs, is four.', {
      table: {
        head: ['Pattern', 'What it looks like', 'Faan'],
        rows: [
          ['All pungs', { tiles: '111p 555s 777m', text: 'only pungs, no runs' }, '3'],
          ['Mixed one suit', { tiles: '123s 456s EEE', text: 'one suit plus honours' }, '3'],
          ['Seven pairs', { tiles: '11m 44p 77s', text: 'seven pairs, no sets' }, '4'],
          ['Pure one suit', { tiles: '123p 456p 789p', text: 'one suit, nothing else' }, '7'],
        ],
      },
    }),
    S('Faan double the points', 'Now the doubling. A hand with no faan at all is called a chicken hand, and it’s worth sixteen points. Each faan doubles that. One faan is thirty-two, two is sixty-four, and three is one hundred and twenty-eight. Eight faan is the limit, the most any hand can score.', {
      table: {
        head: ['Faan', 'Points', 'How'],
        rows: [
          ['0', '16', 'a chicken hand'],
          ['1', '32', '16 doubled once'],
          ['2', '64', 'doubled twice'],
          ['3', '128', 'doubled three times'],
          ['4', '256', 'and so on…'],
          ['8', '4,096', 'the limit: the most any hand scores'],
        ],
      },
    }),
    S('Who pays', 'Win by self-draw, and all three players pay you the full amount. Win on a discard, and the discarder pays double, while the other two pay half. So mind what you throw!', {
      table: {
        head: ['How you won', 'The player who threw it', 'The other players'],
        rows: [
          ['From the wall (self-draw)', '—', 'Everyone pays the full points'],
          ['On a discard', 'Pays double', 'Pay half each'],
        ],
      },
    }),
    S('Example one', 'Let’s try some. Here, you called a pung of seven Dots, and won on a discard. No self-draw, no concealed hand, no dragons. That’s a chicken hand, sixteen points. The discarder pays thirty-two, and the others pay eight each.', {
      hand: {
        title: 'Example 1 · A chicken hand · 0 faan, 16 points',
        groups: [
          { tiles: '777p', label: 'Pung', sub: '7 Dots', flag: 'Called', mark: 'called' },
          { tiles: '123m', label: 'Chow', sub: '1-2-3 Characters' },
          { tiles: '456p', label: 'Chow', sub: '4-5-6 Dots' },
          { tiles: '789s', label: 'Chow', sub: '7-8-9 Bamboo' },
          { tiles: '55m', label: 'Pair', sub: '5 Characters', flag: 'Won on a discard', mark: 'win' },
        ],
        facts: ['Won on a discard', 'Made a call', 'No dragons or winds'],
        faan: [],
        none: 'No faan: a chicken hand',
        total: '0 faan = 16 points',
        pay: [
          { who: 'The discarder pays double', amount: '32', big: true },
          { who: 'Each other player pays half', amount: '8 + 8' },
        ],
        winner: 'You collect 48',
      },
    }),
    S('Example two', 'This time you made no calls, held a pung of Red Dragons, and drew the winning tile yourself. Self-draw, one. Concealed, one. Red Dragons, one. Three faan, so one hundred and twenty-eight points, and all three players pay you that.', {
      hand: {
        title: 'Example 2 · A self-drawn hand · 3 faan, 128 points',
        groups: [
          { tiles: 'RdRdRd', label: 'Pung', sub: 'Red Dragons', mark: 'hl' },
          { tiles: '234m', label: 'Chow', sub: '2-3-4 Characters' },
          { tiles: '567p', label: 'Chow', sub: '5-6-7 Dots' },
          { tiles: '678s', label: 'Chow', sub: '6-7-8 Bamboo' },
          { tiles: '99s', label: 'Pair', sub: '9 Bamboo', flag: 'Drew it yourself', mark: 'win' },
        ],
        facts: ['No calls: concealed', 'Drew the winning tile', 'Red Dragons'],
        faan: [
          ['Self-draw', 1],
          ['Concealed hand', 1],
          ['Red Dragon pung', 1],
        ],
        total: '3 faan = 128 points',
        pay: [
          { who: 'Player on your right', amount: '128' },
          { who: 'Player across', amount: '128' },
          { who: 'Player on your left', amount: '128' },
        ],
        winner: 'You collect 384',
      },
    }),
    S('Example three', 'Last one. Every number tile is Bamboo, with a pung of Green Dragons. You called a chow on the way, and won on a discard. Mixed one suit, three. Green Dragons, one. Four faan, two hundred and fifty-six points. The discarder pays five hundred and twelve, and the others pay one hundred and twenty-eight each.', {
      hand: {
        title: 'Example 3 · Mixed one suit · 4 faan, 256 points',
        groups: [
          { tiles: '123s', label: 'Chow', sub: '1-2-3 Bamboo', flag: 'Called', mark: 'called' },
          { tiles: '456s', label: 'Chow', sub: '4-5-6 Bamboo' },
          { tiles: '789s', label: 'Chow', sub: '7-8-9 Bamboo' },
          { tiles: 'GdGdGd', label: 'Pung', sub: 'Green Dragons', mark: 'hl' },
          { tiles: '22s', label: 'Pair', sub: '2 Bamboo', flag: 'Won on a discard', mark: 'win' },
        ],
        facts: ['Only Bamboo and honours', 'Called a chow', 'Won on a discard'],
        faan: [
          ['Mixed one suit', 3],
          ['Green Dragon pung', 1],
        ],
        total: '4 faan = 256 points',
        pay: [
          { who: 'The discarder pays double', amount: '512', big: true },
          { who: 'Each other player pays half', amount: '128 + 128' },
        ],
        winner: 'You collect 768',
      },
    }),
    S('The table counts for you', 'You never have to count at JongClub. When a hand ends, the score card lists every faan for you. And some hosts set a minimum, like one faan, before you’re allowed to win at all. So at those tables, you can’t win with a chicken hand.', {
      list: [
        { tiles: 'RdRdRd', title: 'JongClub counts for you', text: 'The score card lists every faan when a hand ends.' },
        { tiles: '777p', title: 'Some tables set a minimum', text: 'With a one-faan minimum, a chicken hand can’t win.' },
      ],
    }),
    S('Winds that score', 'In Classic the winds score too. A pung of your own seat wind is a faan, and so is a pung of the round wind, sometimes called the prevailing wind. If they’re the same, say you’re East in the East round, a pung of East counts twice! So keep an eye on the round wind before you throw one away.', { list: [{ tiles: 'SSS', title: 'Your seat wind', text: 'You sit South: a pung of South is worth a faan.' }, { tiles: 'EEE', title: 'The round wind', text: 'In the East round, a pung of East is worth a faan for everyone.' }, { tiles: 'EEE', title: 'Both at once', text: 'East seat in the East round: that pung counts twice!' }] }),
    S('Keeping the deal', 'In Classic, East usually keeps the deal by winning, and the host can choose to let East stay on a drawn hand as well. Other tables do it their own way: Riichi keeps East on a win, or when East is ready as the wall runs out. Taiwanese keeps East on a win or a draw. American play passes the deal every hand.', { table: { head: ['Table', 'East keeps the deal when…'], rows: [[{ tiles: 'E', text: 'Classic and Dubai' }, 'East wins. The host may also let East stay on a drawn hand.'], [{ tiles: '5p', text: 'Riichi' }, 'East wins, or is ready when the wall runs out.'], [{ tiles: 'F5', text: 'Taiwanese' }, 'East wins, or nobody wins.'], [{ tiles: 'J', text: 'American' }, 'Never: the deal passes every hand.']] } }),
    S('Seven pairs', 'Classic also welcomes two special shapes. First, seven pairs: fourteen tiles, no sets at all, just seven pairs, worth four faan. Hong Kong, Malaysian, Sichuan and Chinese Official tables allow it too, and Dubai hosts can switch it on or off. In Riichi all seven pairs must be different.', { hand: { title: 'Seven pairs: fourteen tiles, no sets', groups: [{ tiles: '11m', label: 'Pair' }, { tiles: '44m', label: 'Pair' }, { tiles: '77p', label: 'Pair' }, { tiles: '22s', label: 'Pair' }, { tiles: '99s', label: 'Pair' }, { tiles: 'EE', label: 'Pair' }, { tiles: 'RdRd', label: 'Pair' }] } }),
    S('Where pairs don’t count', 'Taiwanese, Vietnamese and Singapore tables don’t use seven pairs, so stick to sets there. American tables are different again. Their card has its own pair hands, which must be played exactly as printed.', { table: { head: ['Table', 'Seven pairs?'], rows: [['Classic, Hong Kong, Malaysian, Sichuan, Chinese Official', 'Yes'], ['Riichi', 'Yes: Chiitoitsu, seven different pairs'], ['Dubai', 'The host decides'], ['Taiwanese, Vietnamese, Singapore', 'No: build sets'], ['American', 'Only the pair hands printed on the card']] } }),
    S('Thirteen orphans', 'Then there’s thirteen orphans. One of every terminal and every honour, plus one extra to make a pair. It’s a limit hand in Classic, Hong Kong and Riichi. In Singapore it’s called the thirteen wonders.', { hand: { title: 'Thirteen orphans: one of every terminal and honour, plus one', groups: [{ tiles: '1m 9m 1p 9p 1s 9s', label: 'Terminals', sub: 'every 1 and 9' }, { tiles: 'E S W N', label: 'Winds', sub: 'one of each' }, { tiles: 'Rd Gd Wd Wd', label: 'Dragons', sub: 'one doubled for the pair', mark: 'hl' }], facts: ['A limit hand: Classic, Hong Kong, Riichi'] } }),
    S('Patterns across the suits', 'Some tables score patterns across the three suits. The same run in all three suits is a mixed triple chow. The same pung in all three is a triple pung. Chinese Official scores them, eight and sixteen fan, and Riichi calls them Sanshoku. In Classic they win, but add no faan.', { table: { head: ['Pattern', 'Chinese Official', 'Riichi', 'Classic'], rows: [[{ tiles: '345m 345p 345s', text: 'Mixed triple chow' }, '8 fan', 'Sanshoku', 'A good hand, no extra faan'], [{ tiles: '555m 555p 555s', text: 'Triple pung' }, '16 fan', 'Sanshoku', 'A good hand, no extra faan']] } }),
    S('Dice at other tables', 'Each table throws the dice a little differently. Classic tables throw twice, East and then the owner of that wall, and add the two. Hong Kong, Taiwanese and Dubai tables use three dice. Riichi keeps fourteen tiles aside as the dead wall. American tables always break East’s own wall. JongClub throws for you, the right way for each table. Now, shall we try your test?', { table: { head: ['Table', 'Dice', 'Tiles kept aside'], rows: [[{ tiles: 'Rd', text: 'Chinese Classical' }, '2, thrown twice and added', 'Two loose stacks at the break'], [{ tiles: 'Gd', text: 'Hong Kong, Dubai Asian' }, '3, East throws once', 'Two loose stacks'], [{ tiles: 'F5', text: 'Taiwanese' }, '3, East throws once', 'The last sixteen tiles are never drawn'], [{ tiles: '5p', text: 'Riichi' }, '2, East throws once', 'A dead wall of fourteen tiles'], [{ tiles: 'J', text: 'American' }, '2, East throws once', 'None: always East’s own wall']] } }),
  ],
  quiz: [
    Q('Which of these is a set in Chinese Classical?', [['A run in one suit', '345s'], ['A mixed chow', '3m 4s 5p'], ['A crochet', '5m 5s 5p']], 0, 'Classic has no Indian sets: runs stay in one suit.'),
    Q('In Classic, what is a hand with no faan worth?', ['Sixteen points, a chicken hand', 'Nothing at all', 'One hundred points'], 0, 'A chicken hand has no faan and is worth sixteen points.'),
    Q('What does each extra faan do?', ['Doubles the points', 'Adds one point', 'Halves the points'], 0, 'Each faan doubles the score: sixteen, thirty-two, sixty-four, and so on, up to the limit.'),
    Q('Self-drawn, concealed, and one dragon pung. How many faan?', ['Three', 'One', 'Six'], 0, 'One for the self-draw, one for the concealed hand, and one for the dragon pung. Three faan.'),
    Q('You win on a discard. Who pays the most?', ['The discarder, who pays double', 'Everyone pays the same', 'The dealer'], 0, 'On a discard, the discarder pays double and the other two pay half.'),
    Q('The host asks for at least one faan. Can you win with a chicken hand?', ['No, it has no faan', 'Yes, any complete hand wins', 'Only on a discard'], 0, 'A chicken hand has no faan, so at a one-faan table it can’t win.'),
    Q('What is the most a Classic hand can score?', ['Eight faan, the limit', 'There’s no limit', 'Three faan'], 0, 'Eight faan is the limit, the most any hand can score.'),
    Q('Which shape does Classic accept, for four faan?', ['Seven pairs', 'Five pungs', 'Thirteen runs'], 0, 'Seven pairs, fourteen tiles and no sets, is worth four faan in Classic.'),
  ],
};
