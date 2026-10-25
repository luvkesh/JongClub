// Academy lesson: EMA tournament rules, following JongClub's `ema` profile
// (src/engine/rules/ema.ts): the Chinese Official fan list as at our MCR
// table, with no flower tiles (136), the deal always passing (sixteen hands,
// four in each wind) and eight fan to win; the discarder pays eight plus the
// hand, the others eight, and on a self-draw everyone pays eight plus the
// hand. EMA Riichi is our Riichi tournament table. It builds on the MCR
// lesson; the worked example is the MCR lesson's, checked in
// test/lessons.test.ts.

import { S, Q, type Lesson } from '../lessonKit';

export const emaLesson: Lesson = {
  id: 'ema',
  title: 'EMA tournament rules',
  base: 'mcr',
  scenes: [
    S('Welcome to Europe', 'Welcome to the European Championship! The European Mahjong Association runs its championships on two rulesets, Chinese Official and Riichi. This table is the Chinese Official one, the way Europe plays it. Compared with Classic, it’s the formal game: a fixed list of fan, added up, with eight to win. Compared with our Chinese Official table, only a few things change. Let me show you!', { tiles: ['234m', '234p', '234s', '789s', '55p'] }),
    S('The same fan list', 'Everything from the Chinese Official lesson still holds. The calls are Chi, Peng and Gang, and the win is Hu. Fan are added, never doubled, and a big pattern never also scores the smaller ones inside it. Mixed triple chow is still eight, half flush six, and full flush twenty-four.', { tiles: ['234m', '234p', '234s'] }),
    S('No flowers', 'First change: no flowers. The set is the one hundred and thirty-six tiles of suits, winds and dragons. So there are no flower fan to add, and no flowers to replace. Every fan you score comes from your hand itself.', { tiles: ['E', 'S', 'W', 'N', 'Rd', 'Gd', 'Wd'] }),
    S('Sixteen hands', 'Second change: the deal always passes. Even when the dealer wins, the deal moves on. So a game is exactly sixteen hands, four in each wind: East, South, West and North. Everyone deals four times, and every game has the same length, which suits a tournament timetable.', { board: 'seats' }),
    S('Eight to win', 'You need at least eight fan to win, just as at our Chinese Official table. Without flowers, nothing tops up a small hand afterwards. So plan from the very start: aim for one pattern worth eight, or a few smaller ones that add up.', { tiles: ['234m', '234p', '234s'] }),
    S('Who pays', 'Paying is the same too. Every other player pays the winner a base of eight. Win on a discard, and the discarder also pays the hand’s fan. Win on your own draw, Zimo, and everyone pays eight plus the fan.', { tiles: ['5p'] }),
    S('An example', 'Same run in three suits, all chows, no calls, and you win on a discard. Mixed triple chow, eight. All chows, two. Concealed hand, two. No honours, one. Thirteen fan. The discarder pays eight plus thirteen, twenty-one, and the other two pay eight each. That’s thirty-seven for you.', { tiles: ['234m', '234p', '234s', '789s', '55p'] }),
    S('European Riichi', 'And the other European ruleset? Riichi championships start everyone on thirty thousand, with no red fives, and pay uma by place at the end. In JongClub, that’s our Riichi tournament table, the lesson just before this one.', { tiles: ['5m', '5p', '5s'] }),
    S('Our table', 'For practice, the host can drop the eight fan minimum, so any complete hand wins. Everything else follows the European way. Now, shall we try your test?', { board: 'seats' }),
  ],
  quiz: [
    Q('Does the European table use flower tiles?', ['No, just the one hundred and thirty-six tiles', 'Yes, all eight flowers', 'Only the four seasons'], 0, 'European championships play without flowers, so every fan comes from the hand.'),
    Q('The dealer wins a hand. What happens to the deal?', ['It passes on anyway', 'The dealer deals again', 'It goes back to East'], 0, 'At the European table the deal always passes, so a game is always sixteen hands.'),
    Q('How many hands make a full European game?', ['Sixteen, four in each wind', 'Eight, four in each of two winds', 'As many as the dealer wins'], 0, 'Four winds, four hands each: sixteen, with everyone dealing four times.'),
    Q('You win a ten fan hand by self-draw. What does each other player pay?', ['Eighteen', 'Ten', 'Eight'], 0, 'On a self-draw everyone pays the base of eight plus the hand’s ten fan: eighteen each.'),
    Q('How many fan do you need to win, by the official rules?', ['Eight', 'One', 'Three'], 0, 'Eight fan, just as in Chinese Official. Only practice tables drop the minimum.'),
  ],
};
