// Academy lessons: the other UAE / Dubai tables (src/engine/rules/uaeRulesets.ts).
// Each is a short lesson on how that table differs from its base game, and
// links to the base lesson (`base`). None is an official UAE ruleset; there
// isn't one. American and Asian goulash stay separate: Dubai American passes
// jokers in the goulash Charleston, the Asian tables exchange three tiles.

import { S, Q, type Lesson } from '../lessonKit';

export const dubaiTaiwaneseLesson: Lesson = {
  id: 'uae-taiwanese',
  title: 'Dubai Taiwanese',
  base: 'taiwanese',
  scenes: [
    S('Taiwanese, Dubai style', 'Many Dubai tables love the Taiwanese sixteen-tile game. Our Dubai Taiwanese table plays it just as the Taiwanese lesson teaches: five sets and a pair, flowers, and tai. If you haven’t learned Taiwanese yet, start with that lesson.', { tiles: ['123m', '456m', '789p', '345s', 'EEE', 'WdWd'] }),
    S('What changes', 'Two things change. You need at least one tai to win, so a hand with no tai isn’t enough. And the host can switch on a goulash after a wall game.', { tiles: ['RdRdRd'] }),
    S('The goulash', 'In a goulash, East keeps the deal, and everyone passes three tiles before play: right, across, then left. By default a goulash win pays double. The host can also add jokers, or a pot that grows until someone wins.', { tiles: ['9p', 'Rd', '1s'] }),
    S('One house style', 'Remember, this is one Dubai house style, not an official UAE ruleset. Always check the table’s house rules. Now, shall we try your test?', { board: 'seats' }),
  ],
  quiz: [
    Q('How many tiles do you hold at Dubai Taiwanese?', ['Sixteen', 'Thirteen', 'Fourteen'], 0, 'It’s the Taiwanese game: sixteen tiles, five sets and a pair.'),
    Q('What is the minimum to win?', ['One tai', 'No minimum', 'Eight tai'], 0, 'Dubai Taiwanese needs at least one tai to win.'),
    Q('In a goulash at this table, what happens before play?', ['Everyone passes three tiles', 'Jokers are thrown away', 'The dealer passes to North'], 0, 'East keeps the deal, and everyone passes three tiles right, across, then left.'),
  ],
};

export const dubaiAmericanLesson: Lesson = {
  id: 'uae-american',
  title: 'Dubai American',
  base: 'american',
  scenes: [
    S('The card in Dubai', 'Plenty of Dubai groups play the American game. Our Dubai American table is the American game you know: JongClub’s own card, jokers, and the Charleston. If you’re new to it, take the American lesson first.', { tiles: ['F1 F5', '2222m', '44p', '66p', '8888m'] }),
    S('Goulash is on', 'The difference is the goulash, and here it’s on by default. When the wall runs out and nobody wins, East keeps the deal. And in the next Charleston, jokers may be passed. Official American rules never allow that, so it’s a house custom.', { tiles: ['J', 'J', '9p'] }),
    S('One house style', 'This is one Dubai house style, not an official ruleset, and JongClub’s card isn’t the League’s card. Check the house rules, and enjoy! Now, shall we try your test?', { board: 'seats' }),
  ],
  quiz: [
    Q('How do you win at Dubai American?', ['Match a hand on the card', 'Four sets and a pair', 'Three faan or more'], 0, 'It’s the American game: you play a hand from the card.'),
    Q('What is different in a goulash here?', ['Jokers may be passed in the Charleston', 'The card changes', 'Chows are allowed'], 0, 'In a goulash, East keeps the deal and jokers may be passed in its Charleston.'),
    Q('Is the goulash part of the official American rules?', ['No, it’s a house custom', 'Yes, always', 'Only in Dubai'], 0, 'Official American rules never allow passing jokers. The goulash is a house custom.'),
  ],
};

export const dubaiCustomLesson: Lesson = {
  id: 'uae-custom',
  title: 'Custom UAE table',
  base: 'uae',
  scenes: [
    S('Build your own table', 'Every Dubai group has its own habits, so the custom table lets the host choose everything. It starts from our Dubai Asian table, so take the Dubai lesson first if you haven’t.', { tiles: ['123m', '456p', '789s', 'RdRdRd', 'EE'] }),
    S('What the host chooses', 'The host picks flowers, chows, seven pairs, the minimum faan, who pays on a discard, and when the dealer keeps the deal. Scoring stays in faan, just like Classic.', { tiles: ['F1', '345s', 'RdRdRd'] }),
    S('Goulash starts off', 'Unlike the Dubai Asian table, the goulash starts switched off here. Turn it on, and the host also chooses the tile exchange, jokers, double stakes, and a pot. So ask before you play! Now, shall we try your test?', { board: 'seats' }),
  ],
  quiz: [
    Q('Who sets the rules at a custom UAE table?', ['The host', 'An official UAE rulebook', 'The player in North'], 0, 'The host chooses every house rule. There’s no official UAE rulebook.'),
    Q('At a custom table, is the goulash on at the start?', ['No, the host can switch it on', 'Yes, always', 'It isn’t possible here'], 0, 'The goulash starts off at the custom table. The host can turn it on.'),
    Q('How are hands scored here?', ['In faan, like Classic', 'In phán, added up', 'In tai'], 0, 'The custom table builds on the Dubai Asian table, scored in faan like Classic.'),
  ],
};
