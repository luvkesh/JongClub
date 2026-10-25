// Academy lesson: Sichuan Blood Battle, following JongClub's `sichuan`
// profile (src/engine/rules/sichuan.ts): 108 tiles, no chow calls (runs held
// in the hand still count), the missing-suit rule checked at the win, fan
// doubling ten points up to a cap of four, ten extra per payer on a
// self-draw, kong money ("wind and rain"), and ready-hand payments at a wall
// game. Simplified, and said so: the hand ends at the first win.

import { S, Q, type Lesson } from '../lessonKit';

export const sichuanLesson: Lesson = {
  id: 'sichuan',
  title: 'Sichuan Blood Battle',
  scenes: [
    S('Welcome to Chengdu', 'Welcome to the Chengdu teahouse! Sichuan Mahjong is fiery, like the food, and it’s hugely popular across Sichuan and on phone apps. Compared with Classic, there are only one hundred and eight tiles. Just the three suits, with no winds, no dragons and no flowers. Let me show you!', { tiles: ['1m', '5p', '9s'] }),
    S('New words', 'You’ll call Peng for a pung, Gang for a kong, and Hu to win, or Zimo on your own draw. There’s no Chi here, so you can’t call a discard for a run. But runs you build in your own hand still count.', { tiles: ['555p', '9999m', '345s'] }),
    S('The missing suit', 'Here’s the big rule. Your winning hand must be missing one whole suit. So pick the suit you’re weakest in, and throw it away early. At our table, the rule is checked when you win, so you don’t need to announce your suit first.', { tiles: ['123m', '456m', '789m', '222p', '55p'] }),
    S('Counting fan', 'Hands score fan, and each fan doubles. All pungs is one. One suit only, a pure suit, is two, and so is seven pairs. All simples, with no ones or nines, is one. And every set of four of a kind, called a root, adds one more. Four fan is the cap.', { tiles: ['2222s', '345s', '666s', '88s'] }),
    S('Points and paying', 'A hand is worth ten points, doubled for each fan. Win on a discard, and only the discarder pays. Win by self-draw, and all three players pay, with ten extra each.', { tiles: ['5p'] }),
    S('Wind and rain', 'Kongs pay on the spot, and they call it wind and rain. An open kong collects ten from each player, and a concealed kong collects twenty. And if the wall runs out, each player who isn’t ready pays twenty to each player who is.', { tiles: ['9999m'] }),
    S('An example', 'All pungs in Bamboo, and you draw the last tile yourself. All pungs, one. Pure suit, two. Three fan makes eighty points, plus ten for the self-draw. So all three players pay you ninety.', { tiles: ['111s', '333s', '555s', '777s', '99s'] }),
    S('Our simpler battle', 'One honest note. In a true Blood Battle, play carries on after someone wins, until three players have won. At our table, the hand ends at the first win, to keep things simple. Now, shall we try your test?', { board: 'seats' }),
  ],
  quiz: [
    Q('What must every winning hand in Sichuan be missing?', ['One whole suit', 'All the pairs', 'Every honour, and one pair'], 0, 'Your winning hand must lack one suit entirely. There are no honours in the set at all.'),
    Q('Can you call a discard to make a run?', ['No, but runs in your own hand count', 'Yes, from the player on your left', 'Only to win'], 0, 'There’s no Chi in Sichuan, but runs you build in your hand are fine.'),
    Q('You declare a concealed kong. What happens?', ['Each player pays you twenty on the spot', 'Nothing until the hand ends', 'You pay everyone ten'], 0, 'Wind and rain: a concealed kong collects twenty from each player, an open kong ten.'),
    Q('How many tiles are in a Sichuan set?', ['One hundred and eight', 'One hundred and forty-four', 'One hundred and fifty-two'], 0, 'Three suits of thirty-six tiles: one hundred and eight.'),
    Q('In a true Blood Battle, what happens after the first win?', ['Play goes on until three have won', 'Everyone draws again', 'The winner deals'], 0, 'Real Blood Battle plays on. Our table keeps it simple and ends the hand at the first win.'),
  ],
};
