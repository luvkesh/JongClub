// Academy lesson: Malaysian Mahjong, following JongClub's `malaysian` club
// profile (src/engine/rules/malaysian.ts): Singapore tiles and tai, plus seven
// pairs for three tai, a host-raised cap, and a shared payment on a discard
// (discarder double, others single; self-draw: everyone double). Tables vary,
// so this is how our club plays, not official rules.

import { S, Q, type Lesson } from '../lessonKit';

export const malaysianLesson: Lesson = {
  id: 'malaysian',
  title: 'Malaysian Mahjong',
  scenes: [
    S('Welcome to Penang', 'Selamat datang, and welcome to Penang! Malaysian Mahjong is loved in Kuala Lumpur, Penang and Johor Bahru, especially at Chinese New Year. It’s a close cousin of the Singapore game. Compared with Classic, you’ll meet four animals, bites, and scores in tai. Every table keeps its own customs, so here’s how ours plays.', { tiles: ['Cat', 'Mse', 'Rst', 'Cpd'] }),
    S('New words', 'You’ll call Chi for a chow, from the player on your left, Pong for a pung, and Kong for four of a kind. Win on a discard with Hu, or on your own draw with Zimo.', { tiles: ['345s', '555p', '9999m'] }),
    S('Bonus tiles and bites', 'There are eight flowers and four animals, one hundred and forty-eight tiles in all. Bonus tiles go aside face up, and you draw again. Catch the cat and the mouse, or the rooster and the centipede, and everyone pays you on the spot. That’s a bite.', { tiles: ['F1', 'Cat', 'Mse'] }),
    S('How we differ from Singapore', 'Our Malaysian table differs from Singapore in three ways. Seven pairs is allowed, for three tai. The host may raise the cap from five tai to eight or ten. And on a discard, the payment is shared, as you’ll see in a moment.', { tiles: ['11m', '44m', '77p', '22s', '99s', 'EE', 'RdRd'] }),
    S('Counting tai', 'You need at least one tai to win. Each tai doubles the points: one tai is thirty-two, two is sixty-four, and three is one hundred and twenty-eight. Pong Pong, all pungs, is two tai. Each animal is one, and so is a dragon pung, or a pung of your seat wind.', { tiles: ['RdRdRd', 'Rst'] }),
    S('Who pays', 'Win on a discard, and the discarder pays double, while the other two pay single. Win on your own draw, and everyone pays you double. The host can switch to shooter pays, the Singapore way.', { tiles: ['5p'] }),
    S('An example', 'All pungs, with a cat set aside, and you win on a discard. Pong Pong, two. The cat, one. Three tai, one hundred and twenty-eight points. The discarder pays two hundred and fifty-six, and the others pay one hundred and twenty-eight each.', { tiles: ['222m', '444m', '555p', '888s', '66p', 'Cat'] }),
    S('Check your table', 'Malaysian tables all play a little differently. The host can change the minimum, the cap, who pays, seven pairs, bites and kong money. So take a peek at the house rules first. Now, shall we try your test?', { board: 'seats' }),
  ],
  quiz: [
    Q('At our Malaysian table, what is seven pairs worth?', ['Three tai', 'Nothing, it isn’t allowed', 'Five tai'], 0, 'Seven pairs is allowed here, for three tai. The host can switch it off.'),
    Q('You win on a discard. Who pays what?', ['The discarder pays double, the others single', 'The shooter pays for everyone', 'Everyone pays the same'], 0, 'By default the discarder pays double and the other two pay single.'),
    Q('Which animals make a bite?', [['Cat and Mouse', 'Cat Mse'], ['Cat and Rooster', 'Cat Rst'], ['Mouse and Centipede', 'Mse Cpd']], 0, 'The cat catches the mouse, and the rooster eats the centipede.'),
    Q('What is a three tai hand worth?', ['One hundred and twenty-eight', 'Ninety-six', 'Three hundred'], 0, 'Thirty-two for one tai, doubled for each tai after: one hundred and twenty-eight.'),
  ],
};
