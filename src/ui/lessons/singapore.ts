// Academy lesson: Singapore and Malaysian Mahjong, following JongClub's
// `singapore` club profile (src/engine/rules/singapore.ts): 148 tiles with
// four animals, tai capped at five, the shooter pays, and animal bites and
// kong money paid on the spot. Tables vary, so the host sets the house rules.

import { S, Q, type Lesson } from '../lessonKit';

export const singaporeLesson: Lesson = {
  id: 'singapore',
  title: 'Singapore Mahjong',
  scenes: [
    S('Welcome to Singapore', 'Hello, and welcome to Marina Bay! In Singapore and Malaysia, Mahjong is a family favourite, especially around Chinese New Year. Compared with Classic, there are animal tiles, scores in tai with a cap of five, and a few things paid on the spot. Every table has its own little rules, so let me show you how our club plays!', { tiles: ['Cat', 'Mse', 'Rst', 'Cpd'] }),
    S('The tiles', 'You’ll see the usual Characters, Dots, Bamboo, winds and dragons. Then come eight flowers, four plants and four seasons, each numbered one to four for the seats East, South, West and North. Add four animals, and that’s one hundred and forty-eight tiles.', { tiles: ['1m', '5p', '9s', 'E', 'Rd', 'F1', 'F5', 'Cat'] }),
    S('Flowers and animals', 'Flowers and animals are bonus tiles. The moment you draw one, or find one in your opening hand, set it aside face up and draw a replacement. Each animal is worth one tai, and so is each flower with your seat number.', { tiles: ['F1', 'F5', 'Rst'] }),
    S('Animal bites', 'Now for my favourite part! The cat catches the mouse, and the rooster eats the centipede. Hold both of a pair, and everyone pays you on the spot, double if they came in your opening hand. Collect all four animals, and there’s an even bigger bite!', { tiles: ['Cat', 'Mse', 'Rst', 'Cpd'] }),
    S('Sets and winning', 'You win with four sets and a pair, or the thirteen wonders, a limit hand, worth the most a hand can score. The words are Chi for a chow, from the player on your left, Pong for a pung, and Kong for four of a kind. Win on a discard with Hu, or on your own draw with Zimo. And every kong pays you a little on the spot, double if it’s concealed.', { tiles: ['123m', '456p', '789s', 'RdRdRd', 'EE'] }),
    S('Counting tai', 'You need at least one tai to win, and five tai is the limit. A dragon pung, your seat wind or the prevailing wind is one tai each. All pungs, called Pong Pong, is two. Full colour, every tile from one suit, is four. And Ping Hu, all chows with no bonus tiles, waiting on two different tiles, is four tai too!', { tiles: ['234m', '567p', '345s', '678s', '22p'] }),
    S('Who pays', 'A one tai hand is worth thirty-two points, and each extra tai doubles it: sixty-four, then one hundred and twenty-eight, all the way to five hundred and twelve. Win on your own draw, and everyone pays you double. Win on a discard, and by default the shooter, the player who threw your winning tile, pays for the whole table!', { tiles: ['5p'] }),
    S('Check your table', 'Singapore tables all play a little differently. At JongClub, the host can raise the minimum tai, share the payment on a discard, and switch animal bites or kong money off. So take a quick look at the house rules before you play. Now, shall we try your test?', { tiles: ['Cat', 'Mse'] }),
  ],
  quiz: [
    Q('You draw the Rooster. What do you do?', [['Set it aside and draw again', 'Rst'], ['Keep it in your hand', 'Rst'], ['Discard it', 'Rst']], 0, 'Animals are bonus tiles. Set them aside face up and draw a replacement. Each one is worth one tai.'),
    Q('Which pair of animals bites?', [['Cat and Mouse', 'Cat Mse'], ['Cat and Rooster', 'Cat Rst'], ['Mouse and Centipede', 'Mse Cpd']], 0, 'The cat catches the mouse, and the rooster eats the centipede. Hold both of a pair and everyone pays you on the spot.'),
    Q('What’s the most tai a hand can score?', ['Five', 'Eight', 'Thirteen'], 0, 'Tai are capped at five, and a limit hand scores the full five.'),
    Q('You win on a discard, with the default house rules. Who pays?', ['The shooter pays for the whole table', 'Everyone pays the same', 'Nobody pays'], 0, 'By default the shooter, the player who discarded, pays for everyone. The host can choose to share it instead.'),
    Q('Does winning on your own draw earn a tai?', ['No, but everyone pays you double', 'Yes, one tai', 'Yes, two tai'], 0, 'There’s no tai for a self-draw here. Instead, every player pays you double.'),
  ],
};
