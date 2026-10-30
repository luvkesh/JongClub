// Academy lesson (Foundations, Level 5): hand shapes in India Rules
// (src/engine/rules/india.ts and indiaPassport.ts). The Indian sets and how to
// build them (a crochet or mixed chow can't be called, so its last tile comes
// from the wall unless it wins the hand), the knit as the pair (only with a
// crochet, the rulebook's p. 7), concealed hands, the East round's passports
// and their combinations, and the card hands of the South and North rounds.
// Seven pairs, thirteen orphans and the cross-suit patterns of other tables
// moved to the Chinese Classical lesson (lessons/classic.ts).

import { S, Q, type Lesson } from '../lessonKit';

export const shapesLesson: Lesson = {
  id: 'shapes',
  title: 'Hand shapes in India Rules',
  scenes: [
    S('More than one shape', 'You met the Indian sets in the Basics: the mixed chow, the crochet and the knit pair. Now let’s see how to build them, and the special shapes some rounds ask for.', { hand: { title: 'The usual shape: four sets and a pair', groups: [{ tiles: '123m', label: 'Chow' }, { tiles: '2m 3s 4p', label: 'Mixed chow' }, { tiles: '7m 7s 7p', label: 'Crochet' }, { tiles: 'RdRdRd', label: 'Pung' }, { tiles: 'EE', label: 'Pair' }] } }),
    S('Building a crochet', 'Say you hold the five of Cracks and the five of Bamboos. Only the five of Rings makes a crochet. And you can’t call it from a discard, so it has to come from the wall, unless it wins your hand. With one way in, a crochet can be slow. Keep it when you have other good sets.', {
      list: [
        { tiles: '5m 5s', title: 'Two of the three', text: 'Waiting on one tile: the 5 of Rings.' },
        { tiles: '5p', title: 'From the wall', text: 'You draw it yourself, or it’s your winning tile.' },
      ],
    }),
    S('Building a mixed chow', 'A mixed chow has more ways in. Hold the four of Cracks and the five of Bamboos, and a three or a six of Rings will finish it. Hold the four of Cracks and the six of Bamboos, and you need the five of Rings. Like a crochet, it comes from the wall, unless the tile wins your hand.', {
      table: {
        head: ['You hold', 'You need', 'Ways in'],
        rows: [
          [{ tiles: '4m 5s' }, { tiles: '3p 6p' }, 'Two: either end'],
          [{ tiles: '4m 6s' }, { tiles: '5p' }, 'One: the middle'],
          [{ tiles: '5m 5s' }, { tiles: '5p' }, 'One: a crochet'],
        ],
      },
    }),
    S('Passports', 'In the East round of a full match, every winning hand needs a passport: a special group of nine, six or five tiles. Here they are. You’ll meet each one properly in the East round lesson.', {
      table: {
        head: ['Passport', 'Made of'],
        rows: [
          [{ tiles: '222m 555s 888p', text: '9 tiles' }, '3 pungs or 3 chows, in 3 suits or one suit; 3 crochets; or 3 mixed chows'],
          [{ tiles: '11s 44s 77s', text: '6 tiles' }, '3 pairs in one suit or 3 suits; or 3 knits in the same 2 suits'],
          [{ tiles: 'E S W N N', text: '5 tiles' }, 'An honour pung and honour pair; NEWS and one more wind; Green, Red and White and an honour pair; or a crochet and a knit'],
        ],
      },
    }),
    S('Passport hands', 'A passport takes the place of some of your sets. Whatever is left is made of threes and a pair. So a nine-tile passport needs one more set and a pair. A five-tile passport needs three more sets. Two passports can even share one hand.', {
      table: {
        head: ['Passports', 'Plus', 'Fourteen tiles'],
        rows: [
          ['9', 'a set and a pair', '9 + 3 + 2'],
          ['6', 'two sets and a pair', '6 + 3 + 3 + 2'],
          ['5', 'three sets', '5 + 3 + 3 + 3'],
          ['9 and 5', 'nothing else', '9 + 5'],
          ['6 and 6', 'a pair', '6 + 6 + 2'],
          ['5 and 6', 'a set', '5 + 6 + 3'],
        ],
      },
    }),
    S('Card hands', 'In the South and North rounds, you build the exact hand named on a card. For example, one of the South cards is Unique Wonders: the one and nine of every suit, all four winds and all three dragons, plus one more of any of them. Check the round before you plan your hand. Now, shall we try your test?', { hand: { title: 'One of the South cards: Unique Wonders', card: 'Unique Wonders', groups: [{ tiles: '1m 9m 1s 9s 1p 9p', label: 'Terminals', sub: 'every 1 and 9' }, { tiles: 'E S W N', label: 'Winds', sub: 'all four' }, { tiles: 'Rd Gd Wd Wd', label: 'Dragons', sub: 'one doubled', mark: 'hl' }] } }),
  ],
  quiz: [
    Q('You hold the 4 of Cracks and the 5 of Bamboos. Which tiles make a mixed chow?', [['3 or 6 of Rings', '3p 6p'], ['5 of Rings only', '5p'], ['4 or 5 of Rings', '4p 5p']], 0, 'A mixed chow is a run across the three suits: 3-4-5 or 4-5-6, with the Ring at either end.'),
    Q('You hold the 5 of Cracks and the 5 of Bamboos. Which tile makes a crochet?', [['The 5 of Rings', '5p'], ['The 4 or 6 of Rings', '4p 6p'], ['Any Ring', '1p']], 0, 'A crochet is one number in all three suits, so only the 5 of Rings finishes it.'),
    Q('A five-tile passport needs what else?', ['Three more sets', 'One more set and a pair', 'Nothing else'], 0, 'Five plus three, three and three makes fourteen.'),
    Q('What does a small card do?', ['It names your whole hand', 'It doubles your score', 'It lets you call any tile'], 0, 'In the South round your card names the hand you must build.'),
    Q('A nine-tile passport needs what else?', ['One more set and a pair', 'Three more sets', 'Nothing else'], 0, 'Nine plus three plus two makes fourteen.'),
  ],
};
