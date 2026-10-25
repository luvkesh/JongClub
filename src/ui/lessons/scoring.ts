// Academy lesson: scoring in Classic, following classicScore and
// classicPayments (src/engine/rules/classic.ts): faan are added up, a hand
// is worth 16 points doubled once per faan, eight faan is the limit, a
// self-draw is paid in full by all three players, and on a discard the
// discarder pays double and the others half. The three worked examples are
// checked against the engine in test/lessons.test.ts. Written for someone
// who has never kept score: one idea per scene, each with a picture.

import { S, Q, type Lesson } from '../lessonKit';

export const scoringLesson: Lesson = {
  id: 'scoring',
  title: 'Scoring in Classic',
  scenes: [
    S('Why keep score?', 'Winning is lovely. But at most tables, how you win matters too, because special hands are worth more. In Classic, we count faan. Don’t worry, it’s only adding up, then doubling. Let me show you!', { tiles: ['RdRdRd', '234m', '567p', '678s', '99s'] }),
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
    S('The table counts for you', 'You never have to count at JongClub. When a hand ends, the score card lists every faan for you. And some hosts set a minimum, like one faan, before you’re allowed to win at all. So at those tables, you can’t win with a chicken hand. Now, shall we try your test?', {
      list: [
        { tiles: 'RdRdRd', title: 'JongClub counts for you', text: 'The score card lists every faan when a hand ends.' },
        { tiles: '777p', title: 'Some tables set a minimum', text: 'With a one-faan minimum, a chicken hand can’t win.' },
      ],
    }),
  ],
  quiz: [
    Q('In Classic, what is a hand with no faan worth?', ['Sixteen points, a chicken hand', 'Nothing at all', 'One hundred points'], 0, 'A chicken hand has no faan and is worth sixteen points.'),
    Q('What does each extra faan do?', ['Doubles the points', 'Adds one point', 'Halves the points'], 0, 'Each faan doubles the score: sixteen, thirty-two, sixty-four, and so on, up to the limit.'),
    Q('Self-drawn, concealed, and one dragon pung. How many faan?', ['Three', 'One', 'Six'], 0, 'One for the self-draw, one for the concealed hand, and one for the dragon pung. Three faan.'),
    Q('You win on a discard. Who pays the most?', ['The discarder, who pays double', 'Everyone pays the same', 'The dealer'], 0, 'On a discard, the discarder pays double and the other two pay half.'),
    Q('The host asks for at least one faan. Can you win with a chicken hand?', ['No, it has no faan', 'Yes, any complete hand wins', 'Only on a discard'], 0, 'A chicken hand has no faan, so at a one-faan table it can’t win.'),
    Q('What is the most a Classic hand can score?', ['Eight faan, the limit', 'There’s no limit', 'Three faan'], 0, 'Eight faan is the limit, the most any hand can score.'),
  ],
};
