// Academy lesson: Indian Club Mahjong, following JongClub's `indian` club
// profile (src/engine/rules/indian.ts): a Hong Kong-style base with eight
// jokers and eight flowers, faan that double, and house rules the host sets.
// Indian clubs vary, so this is "how many clubs play", never "the rules".

import { S, Q, type Lesson } from '../lessonKit';

export const indianLesson: Lesson = {
  id: 'indian',
  title: 'Kolkata Joker Club',
  scenes: [
    S('Welcome to Calcutta', 'Namaste, and welcome to the Calcutta Club! Mahjong came to India with the Chinese community of Kolkata, and today it’s played in Kolkata, Mumbai and the Darjeeling hills. Compared with Classic, you’ll meet eight jokers, and a bonus for winning without them. Scoring is in faan, just like Classic. Every club has its own habits, so let me show you how many clubs like to play!', { tiles: ['J', 'F1', 'RdRdRd', 'EE'] }),
    S('The tiles', 'Here you’ll find the usual Characters, Dots, Bamboo, winds and dragons. Indian sets add eight flowers and eight jokers, which makes one hundred and fifty-two tiles. When you draw a flower, set it aside face up and draw a replacement.', { tiles: ['1m', '5p', '9s', 'E', 'Gd', 'F1', 'F5', 'J'] }),
    S('The jokers', 'A joker can stand for any tile in a pung, a kong or a chow in your hand. But by default, it can’t make up your pair. You may call a pung with one real tile and one joker, though chows are called with real tiles only. And once a joker is discarded, it’s dead, so nobody can claim it.', { tiles: ['77s J', '34p J', 'J'] }),
    S('Sets and winning', 'The goal is four sets and a pair, the way you learned it. Seven pairs and thirteen orphans are welcome here too, but jokers never count toward those two. You’ll need at least one faan to win, unless your host says otherwise.', { tiles: ['123m', '456p', '789s', 'RdRdRd', 'EE'] }),
    S('Counting faan', 'Hands are scored in faan, just like a Hong Kong club. Self-drawn is one, a concealed hand is one, and each pung of dragons, your seat wind or the round wind is one more. A seat flower adds one, and so does a hand with no flowers at all. And here’s a lovely Indian touch: win without using any jokers, and you get one bonus faan!', { tiles: ['RdRdRd', 'F1', 'NNN'] }),
    S('Faan double up', 'Every faan doubles the score, up to a limit of eight faan. One faan is worth thirty-two points, two faan is sixty-four, and three faan is one hundred and twenty-eight. So say you called a pung of Red Dragons, held no flowers and used no jokers. That’s three faan already!', { tiles: ['RdRdRd'] }),
    S('Who pays', 'Win on your own draw, and everyone pays you the full amount. Win on a discard, and by default the discarder pays double, while the other two pay half. Some clubs prefer the discarder to pay for everyone, and some like everyone to pay the same.', { tiles: ['5p'] }),
    S('Check your table', 'At JongClub, the host can switch the jokers and flowers off, allow a joker in the pair, change the minimum faan, and choose who pays. Indian clubs all play a little differently, so a quick look at the house rules saves any surprises. Now, shall we try your test?', { tiles: ['J', 'F5'] }),
  ],
  quiz: [
    Q('With the default house rules, where can’t a joker go?', [['In the pair', 'EE'], ['In a pung', 'RdRd J'], ['In a chow in your hand', '34p J']], 0, 'By default a joker can fill a pung, a kong or a chow in your hand, but not the pair. The host can allow it.'),
    Q('You win without using a single joker. What happens?', ['You earn one bonus faan', 'Nothing special', 'You lose a faan'], 0, 'A win with no jokers adds one faan, unless the host has turned that bonus off.'),
    Q('How does each extra faan change the score?', ['It doubles it', 'It adds ten points', 'It changes nothing'], 0, 'Faan double: one faan is thirty-two points, two is sixty-four, up to a limit of eight faan.'),
    Q('You win on a discard, with the default house rules. Who pays?', ['The discarder pays double, the others half', 'Only the discarder, one share', 'Nobody pays'], 0, 'By default the discarder pays double and the other two pay half. The host can choose a different way.'),
    Q('Is there one official set of Indian rules?', ['No, clubs differ, so check the house rules', 'Yes, every club plays the same', 'Yes, it’s all in one rulebook'], 0, 'Indian clubs mix their own habits. At JongClub the host sets the house rules, so check them before you play.'),
  ],
};
