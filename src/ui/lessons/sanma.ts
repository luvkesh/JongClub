// Academy lesson: Sanma, three-player Riichi, following JongClub's `sanma`
// profile (src/engine/rules/sanma.ts): 108 tiles (Characters 2–8 out), three
// seats, no chi, kita (Norths set aside as bonus dora), 35,000 to start,
// tsumo loss by default, 2,000 in ready-hand payments, and the two abortive
// rules that carry over to three players (nine terminals, nagashi mangan).
// It builds on the Riichi lesson.

import { S, Q, type Lesson } from '../lessonKit';

export const sanmaLesson: Lesson = {
  id: 'sanma',
  title: 'Sanma',
  base: 'riichi',
  scenes: [
    S('Welcome to Osaka', 'Welcome to Osaka Plum! Sanma is Riichi for three players, a favourite in Japanese parlours and online. Everything from the Riichi lesson still holds: yaku, dora, furiten, han and fu. Only a few things change, and they make big hands come quickly. Let me show you.', { tiles: ['1m', '9m', 'N'] }),
    S('A smaller set', 'The Characters from two to eight are taken out. Only the one and the nine of Characters stay, with all the Dots, Bamboo, winds and dragons. That’s one hundred and eight tiles. When the dora indicator is the one of Characters, the nine is dora.', { tiles: ['1m', '9m', '123456789p'] }),
    S('Three seats', 'You sit with two others: East, South and West. Nobody sits North, so a pung of North is no yaku. We play an East round and a South round, three hands each, as the deal goes round.', { tiles: ['E', 'S', 'W', 'N'] }),
    S('No chi', 'You may call Pon and Kan, but there’s no Chi. Runs you build in your own hand still count, so closed hands and riichi are very strong here.', { tiles: ['555p', '9999s', '345s'] }),
    S('Kita', 'Hold a North, and on your turn you may set it aside. That’s called kita. Each North set aside is a bonus dora, and you draw a replacement from the dead wall. It isn’t a call, so your hand stays closed. Just tap the Kita button.', { tiles: ['N', 'N'] }),
    S('Keep it or not', 'You never have to set a North aside. Keep it if your hand needs it, for a pair, or for thirteen orphans. And take care: another player may win on a North you set aside, just as on a discard.', { tiles: ['NN', '19m', '19p'] }),
    S('Paying', 'A discard win is paid by the discarder, as in Riichi. A self-draw is paid by the two others. At our table, the share the empty North seat would have paid is simply lost. That’s called tsumo loss. The host may split it between the two players instead.', { tiles: ['5p'] }),
    S('Points and draws', 'Everyone starts with thirty-five thousand points, and riichi still costs one thousand. If the wall runs out, players who aren’t ready pay two thousand in total to those who are.', { tiles: ['234p', '678s', 'RdRd'] }),
    S('Two old rules', 'Hold nine different terminals and honours on your very first turn, and you may call off the hand: the same dealer deals again. And if every one of your discards is a terminal or honour, none of them called, a drawn hand pays you a mangan. That’s nagashi mangan.', { tiles: ['19m', '19p', '19s', 'ESW'] }),
    S('House rules', 'Tables differ on a few things: tsumo loss or a split, red fives, and those old draw rules. Check the house rules before you sit down. Now, shall we try your test?', { tiles: ['5p', '5s'] }),
  ],
  quiz: [
    Q('Which tiles are taken out of the Sanma set?', ['The Characters from two to eight', 'All the honours', 'The red fives'], 0, 'Only the one and nine of Characters stay. Dots, Bamboo, winds and dragons are all kept.'),
    Q('You hold a North on your turn. What may you do with it?', ['Set it aside as a bonus dora', 'Call chi with it', 'Swap it for a joker'], 0, 'That’s kita: the North goes aside as a dora, and you draw a replacement.'),
    Q('Can you call a discard to make a run?', ['No: only pon and kan', 'Yes, from the player on your left', 'Only after riichi'], 0, 'There’s no chi in Sanma. Runs in your own hand still count.'),
    Q('The dora indicator is the one of Characters. Which tile is dora?', ['The nine of Characters', 'The two of Characters', 'The one of Dots'], 0, 'There is no two of Characters in Sanma, so the one points to the nine.'),
    Q('You win by self-draw at our table. Who pays?', ['The two other players', 'Only the dealer', 'Nobody, unless you declared riichi'], 0, 'Both other players pay. The empty North seat’s share is lost: that’s tsumo loss.'),
  ],
};
