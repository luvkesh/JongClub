// Academy lesson: Vietnamese Mahjong (Mạt chược), following JongClub's
// `vietnamese` club profile (src/engine/rules/vietnamese.ts): Khung jokers,
// flowers, phán added up, and who pays. Tables vary, so the host sets the
// house rules.

import { S, Q, type Lesson } from '../lessonKit';

export const vietnameseLesson: Lesson = {
  id: 'vietnamese',
  title: 'Vietnamese Mahjong',
  scenes: [
    S('Welcome to Saigon', 'Xin chào, and welcome to Saigon! Vietnamese Mahjong, Mạt chược, is played in homes and cafés all over Vietnam. Compared with Classic, it adds flowers and eight special jokers, and scores are counted in phán, which are added up. Every family plays it a little differently, so think of this as how our club plays. Let me show you!', { tiles: ['JF', 'JW', 'JD', 'JN'] }),
    S('The tiles', 'You’ll know most of these already: Characters, Dots, Bamboo, the winds and the dragons. On top of those come eight flowers, and eight special jokers called Khung. That makes one hundred and fifty-two tiles in all.', { tiles: ['1m', '5p', '9s', 'E', 'Rd', 'F1', 'F5', 'JN'] }),
    S('Four kinds of joker', 'There are two of each Khung. The Flower Joker is a bonus tile, so you set it aside like a flower and draw again. The Wind Joker stands for any wind, the Dragon Joker for any dragon, and the Number Joker for any suited tile.', { tiles: ['JF', 'JF', 'JW', 'JW', 'JD', 'JD', 'JN', 'JN'] }),
    S('Using a joker', 'In your hand, a joker can finish a pung or the pair, and even two jokers can make a pair. Only the Number Joker can help with a chow, because only it stands for numbers. You can call a pung with one real tile and one joker, but chows are called with real tiles only. And a discarded joker is dead, so nobody can claim it.', { tiles: ['RdRd JD', '45s JN', 'E JW'] }),
    S('New words', 'Now the Vietnamese words. You’ll call Ăn for a chow, but only from the player on your left. Phỗng is a pung, Chiếu is a kong, and when you win, you call Ù! The goal is the one you know, four sets and a pair. Seven pairs and thirteen orphans aren’t used here.', { tiles: ['123m', '456p', '789s', 'RdRdRd', 'EE'] }),
    S('Counting phán', 'Hands are scored in phán, and they’re simply added up, never doubled. Win on your own draw for one phán, with a concealed hand for one more, and each dragon pung adds another. A full flush, every tile from one suit, is six. And big three dragons, a pung of all three dragons, is twelve. Win without using any jokers, and that’s a bonus phán too!', { tiles: ['RdRdRd', 'GdGdGd', '234m'] }),
    S('Who pays', 'A share is twenty points for the win itself, plus twenty for every phán. So a plain win with no phán at all is twenty, and a three phán hand is eighty. Win on your own draw, and everyone pays you a share. Win on a discard, and by default the discarder pays for the whole table, three shares!', { tiles: ['5p'] }),
    S('Check your table', 'Vietnamese tables love their house rules, and nobody plays one official set. At JongClub, the host can turn the jokers or flowers off, set a minimum phán to win, and choose who pays on a discard. So before you sit down, just peek at the house rules. Now, shall we try your test?', { tiles: ['JW', 'JD', 'JN'] }),
  ],
  quiz: [
    Q('You draw a Flower Joker. What happens?', [['Set it aside and draw again', 'JF'], ['Use it as any wind', 'JW'], ['Discard it at once', '5p']], 0, 'The Flower Joker is a bonus tile. Set it aside like a flower, draw a replacement, and it adds one phán.'),
    Q('Which joker can help you make a chow?', [['The Number Joker', 'JN'], ['The Wind Joker', 'JW'], ['The Dragon Joker', 'JD']], 0, 'Only the Number Joker stands for suited tiles, so only it can sit in a run.'),
    Q('How do phán work?', ['They’re added together', 'Each one doubles the score', 'Only the biggest one counts'], 0, 'In Vietnamese play, phán are simply added up. A share is twenty points for the win, plus twenty for every phán.'),
    Q('Someone discards a joker. Can you claim it?', ['No, a discarded joker is dead', 'Yes, for any set', 'Only to win'], 0, 'A discarded joker is dead. Nobody can claim it.'),
    Q('You win on a discard, with the default house rules. Who pays?', ['The discarder pays for the whole table', 'Everyone pays the same', 'Nobody pays'], 0, 'By default the discarder pays three shares. The host can change this in the house rules.'),
    Q('What do you call to claim a tile for a pung?', ['Phỗng', 'Ăn', 'Ù'], 0, 'Phỗng is a pung. Ăn is a chow, Chiếu is a kong, and Ù is the win.'),
  ],
};
