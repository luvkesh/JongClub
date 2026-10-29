// Academy lesson: "Words at the table", the phrasebook of an India Rules
// table (the club rulebook's own words, docs/variants/india-rules.md), Level 8
// after Tradition and etiquette. It teaches only words the earlier lessons
// didn't, then recaps the rest on one page (the user: no repeated lessons,
// 2026-10-25). The names other traditions use (Chinese, Japanese and
// Vietnamese calls, faan, tai, han, phán) live in their own variation lessons.

import { S, Q, type Lesson } from '../lessonKit';

export const wordsLesson: Lesson = {
  id: 'words',
  title: 'Words at the table',
  scenes: [
    S('A little phrasebook', 'You already know most of the words at an India Rules table. So this lesson teaches only the new ones, then puts everything you’ve learned on one page.', { tiles: ['9m E Gd', '555p', 'F1 F2 F3 F4'] }),
    S('Minors, terminals and majors', 'The twos to eights are the minors. The ones and nines sit at the ends of each suit, so we call them terminals. The winds and dragons are the honours. And the honours and terminals together are the majors.', {
      cards: [
        { tiles: '2m 5p 8s', title: 'Minors', alt: '2 to 8', text: 'The middle numbers.' },
        { tiles: '1m 9p 1s', title: 'Terminals', alt: '1 and 9', text: 'The ends of each suit.' },
        { tiles: 'E Rd', title: 'Honours', alt: 'winds and dragons', text: 'No numbers, so never in a run.' },
        { tiles: '9m E Gd', title: 'Majors', alt: 'honours and terminals', text: 'All the honours, plus every 1 and 9.' },
      ],
    }),
    S('Dragons and bamboos', 'Each suit has its own dragon, its corresponding dragon: Red for Cracks, Green for Bamboos, and White for Rings. And some hands ask for green bamboos, the two, three, four, six and eight, or red bamboos, the one, five, seven and nine.', {
      list: [
        { tiles: 'Rd Gd Wd', title: 'Corresponding dragons', text: 'Red for Cracks, Green for Bamboos, White for Rings.' },
        { tiles: '2s 3s 4s 6s 8s', title: 'Green bamboos', text: '2, 3, 4, 6 and 8.' },
        { tiles: '1s 5s 7s 9s', title: 'Red bamboos', text: '1, 5, 7 and 9.' },
      ],
    }),
    S('Melds', 'Any finished set is a meld. A set you called sits face up in front of your rack: that’s an exposed meld. A set you built in your hand from your own draws is a concealed meld, even a concealed kong you lay down to draw a spare tile.', {
      hand: {
        groups: [
          { tiles: '555p', label: 'Exposed meld', sub: 'called, face up', flag: 'Exposed', mark: 'called' },
          { tiles: '123m', label: 'Concealed meld', sub: 'built in your hand' },
          { tiles: '6m 7s 8p', label: 'Concealed meld', sub: 'built in your hand' },
        ],
      },
    }),
    S('Self-draw', 'Winning with a tile you drew from the wall yourself is a self-draw. Winning with someone else’s tile is a win on a discard.', { tiles: ['5p'] }),
    S('Ready to win', 'When you need just one more tile to win, your hand is ready. We also say you’re waiting, and the tiles that would finish it are your wait.', {
      hand: {
        title: 'A ready hand, waiting on one tile',
        groups: [
          { tiles: '123m', label: 'Set' },
          { tiles: '4m 5s 6p', label: 'Set' },
          { tiles: '789s', label: 'Set' },
          { tiles: 'RdRdRd', label: 'Set' },
          { tiles: 'E', label: 'Waiting', sub: 'needs another East', flag: 'The wait', mark: 'hl' },
        ],
        facts: ['Ready, waiting: one tile from Mahjong'],
      },
    }),
    S('More new words', 'A few more you’ll hear. A wall game is a drawn game: the wall runs out and nobody wins. A qwong is five of a kind, made with a joker. Tic-Tac-Toe is a swap: one tile face down to each other player. And buying is taking your left player’s discard for one hundred points.', {
      list: [
        { tiles: '1m 1m', title: 'Wall game', text: 'A drawn game: the wall runs out, nobody wins.' },
        { tiles: '3s 3s 3s 3s J', title: 'Qwong', text: 'Five of a kind, with a joker.' },
        { tiles: 'S', title: 'Tic-Tac-Toe', text: 'One tile face down to each other player.' },
        { tiles: 'N', title: 'Buying', text: 'Your left player’s discard, for 100.' },
      ],
    }),
    S('Everything on one page', 'And here’s everything you’ve learned, on one page. Keep it handy at the table. Shall we try your test?', {
      table: {
        head: ['Word', 'Means'],
        rows: [
          [{ tiles: '5m 5s 5p', text: 'Cracks, Bamboos, Rings' }, 'The three suits, also called Characters, Bams and Dots'],
          [{ tiles: '345s', text: 'Chow, pung, kong' }, 'A run in one suit; three of a kind; four of a kind'],
          [{ tiles: '2m 3s 4p', text: 'Mixed chow, crochet' }, 'A run across the suits; one number in all three'],
          [{ tiles: '7m 7s', text: 'Pure pair, knit' }, 'Two of a kind; one number in two suits, with a crochet'],
          [{ tiles: 'F1 F5', text: 'Bouquets' }, 'Mixed: 1 to 4, flowers and seasons; pure: all four of one'],
          [{ tiles: 'E S W N N', text: 'Passport, card, goulash' }, 'East, South and West round games'],
          ['Normal, concealed, fully concealed', '500, 1,000, 2,000; East pays and receives double'],
          ['Half limit to top limit', '500, 1,000, 2,000, 4,000, 10,000'],
        ],
      },
    }),
  ],
  quiz: [
    Q('Which tiles are the majors?', [['Honours and terminals', '9m E Gd'], ['The twos to eights', '2m 5p 8s'], ['Only the dragons', 'Rd Gd Wd']], 0, 'Majors are all the honours plus the ones and nines. The twos to eights are minors.'),
    Q('Which is the corresponding dragon for Rings?', [['White', 'Wd'], ['Red', 'Rd'], ['Green', 'Gd']], 0, 'Red goes with Cracks, Green with Bamboos, and White with Rings.'),
    Q('You win with a tile you drew yourself. What is that called?', ['A self-draw', 'A discard win', 'A meld'], 0, 'Winning on your own draw is a self-draw. With nothing face up, it’s fully concealed.'),
    Q('What is a meld?', ['Any finished set, exposed or concealed', 'Only a set you called', 'A tile you threw away'], 0, 'Any finished set is a meld. A called set is an exposed meld, and a set built in your hand is a concealed meld.'),
    Q('What is buying?', ['Taking your left player’s discard for 100', 'Paying East double', 'Swapping a tile face down'], 0, 'Buying takes your left player’s discard, for one hundred points.'),
    Q('What is a qwong?', ['Five of a kind, made with a joker', 'Four of a kind', 'A pair of jokers'], 0, 'A qwong is five of a kind, and the fifth tile is a joker.'),
  ],
};
