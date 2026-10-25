// Academy lesson: Malaysian three-player Mahjong, following JongClub's
// `malaysian3` profile (src/engine/rules/malaysian3.ts): the Characters suit
// taken out (112 tiles with flowers and animals), three seats, tai capped at
// five, the discarder pays double and the other player single, bites and
// kong money on the spot. It builds on the Malaysian lesson, and says these
// are JongClub's table defaults.

import { S, Q, type Lesson } from '../lessonKit';

export const malaysian3Lesson: Lesson = {
  id: 'malaysian3',
  title: 'Malaysian three-player',
  base: 'malaysian',
  scenes: [
    S('Welcome to Kuala Lumpur', 'Welcome to Kuala Lumpur Jade! In Malaysia, three friends often play without waiting for a fourth. It’s the Malaysian game you know, with flowers, animals and tai, but one whole suit is taken out. Tables differ, so what I’ll teach you are JongClub’s table defaults.', { tiles: ['Cat', 'Mse', 'Rst', 'Cpd'] }),
    S('A smaller set', 'The Characters are taken out entirely. You play with Dots, Bamboo, winds and dragons, plus the eight flowers and the four animals. That’s one hundred and twelve tiles. Some tables keep the one and nine of Characters, and the host can choose that.', { tiles: ['123456789p', '123456789s'] }),
    S('Three seats', 'You sit East, South or West. Nobody sits North, so the North wind is an ordinary honour, and the fourth flower and the fourth season belong to nobody.', { tiles: ['E', 'S', 'W', 'N'] }),
    S('One suit comes easily', 'With only two suits, a one-suit hand is much easier to build. Full colour is four tai and half colour is two, so watch what your neighbours collect, and think about it for your own hand too.', { tiles: ['123p', '456p', '789p', 'EEE', '55p'] }),
    S('Animals still bite', 'Draw the cat and the mouse, or the rooster and the centipede, and both other players pay you on the spot. A kong pays on the spot too.', { tiles: ['Cat', 'Mse'] }),
    S('Paying', 'Tai are capped at five, and you need one to win. Win on a discard, and the discarder pays double while the other player pays single. Win by self-draw, and both players pay double.', { tiles: ['5p'] }),
    S('An example', 'All pungs, with a cat set aside, won on a discard. Pong Pong is two tai, and the cat is one. Three tai is worth one hundred and twenty-eight, so the discarder pays two hundred and fifty-six, and the other player one hundred and twenty-eight.', { tiles: ['222p', '444p', '555s', '888s', '66p'] }),
    S('House rules', 'The host may keep the one and nine of Characters, raise the tai cap, or change who pays on a discard. Check the house rules before you sit down. Now, shall we try your test?', { tiles: ['1m', '9m'] }),
  ],
  quiz: [
    Q('Which tiles are taken out at our three-player Malaysian table?', ['The whole Characters suit', 'The animals', 'The dragons'], 0, 'Dots, Bamboo, winds, dragons, flowers and animals stay. The Characters go.'),
    Q('Who sits in the North seat?', ['Nobody: North is an ordinary honour', 'The dealer', 'Whoever holds the cat'], 0, 'There are only three seats: East, South and West.'),
    Q('Why do one-suit hands come more often here?', ['Only two suits are left', 'Flowers count as a suit', 'There are no chow calls'], 0, 'With just Dots and Bamboo, collecting one suit is much easier.'),
    Q('You win on a discard. Who pays what?', ['The discarder double, the other player single', 'Only the discarder, single', 'Both pay the same'], 0, 'The discarder pays double and the other player pays single.'),
    Q('You hold the rooster, then draw the centipede. What happens?', ['A bite: both other players pay you now', 'Nothing until you win', 'You must discard it'], 0, 'The rooster eats the centipede: that’s a bite, paid on the spot.'),
  ],
};
