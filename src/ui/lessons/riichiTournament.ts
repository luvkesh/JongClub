// Academy lesson: Riichi tournament rules, following JongClub's
// `riichi-tournament` profile (src/engine/rules/riichiTournament.ts): the
// Riichi hand play with no red fives, no abortive draws and no nagashi
// mangan, thirty thousand to start, every hand of East and South played (no
// end on a bust), and uma at the end (+15,000 / +5,000 / −5,000 / −15,000,
// tied places sharing, no oka). Uma, red fives and open tanyao are house
// rules. It builds on the Riichi lesson.

import { S, Q, type Lesson } from '../lessonKit';

export const riichiTournamentLesson: Lesson = {
  id: 'riichi-tournament',
  title: 'Riichi tournament rules',
  base: 'riichi',
  scenes: [
    S('League night', 'Welcome to the League Hall! This is Riichi the way leagues and tournaments play it, with the World Riichi Championship and the European rules as our models. Everything from the Riichi lesson still holds: yaku, dora, furiten, han and fu. Compared with our Riichi table, and with Classic, the changes are about fairness: fewer lucky extras, and a match where every hand counts. Let me show you!', { tiles: ['234m', '567p', '345s', '678s', '22p'] }),
    S('No red fives', 'First, the tiles. At our Riichi table, three of the fives are red, and each red five is a free dora. Tournaments take them out, so every five is an ordinary five. The value of your hand comes from yaku, real dora and skill, not from a lucky red tile.', { tiles: ['5m', '5p', '5s'] }),
    S('No abortive draws', 'Next, the draw rules. There are no abortive draws here. Nine different terminals and honours on your first turn? Play it out. Four winds thrown, four kongs, or four riichi: the hand goes on. And if two players can win on the same tile, the first in turn order takes it. That’s called head bump.', { tiles: ['19m', '19p', '19s', 'ESW'] }),
    S('No nagashi mangan', 'Nagashi mangan is gone too. Throwing only terminals and honours all hand earns nothing special. If the wall runs out, the usual ready-hand payment still applies: players who aren’t ready pay three thousand in total to those who are.', { tiles: ['1m', '9p', 'N', 'Rd'] }),
    S('Thirty thousand', 'Everyone starts with thirty thousand points, and riichi still costs one thousand. We play an East round and a South round, a hanchan. And here’s a big change: the match doesn’t stop when someone drops below zero. Tournaments play every hand, so a player in trouble keeps going, and can still fight back.', { board: 'seats' }),
    S('Uma', 'When the last hand is over, places are rewarded. That bonus is called uma. First place gets fifteen thousand more. Second gets five thousand. Third loses five thousand, and fourth loses fifteen thousand. There’s no oka, the extra prize some parlours give to first place, because everyone simply returns the thirty thousand they started with.', { board: 'seats' }),
    S('An example', 'Say the match ends on forty-two thousand, thirty-one thousand, twenty-seven thousand and twenty thousand. Now add the uma. First becomes fifty-seven thousand. Second, thirty-six thousand. Third, twenty-two thousand. And fourth, five thousand. Every place matters, right to the last hand.', { board: 'seats' }),
    S('Ties', 'What if two players finish level? They share the uma for their places. Tie for second, and you share plus five thousand and minus five thousand: each of you gets nothing at all. Tie for first, and you share fifteen thousand and five thousand: ten thousand each.', { board: 'seats' }),
    S('House rules', 'Leagues tune these rules, so they’re house rules here. The host can choose a bigger uma, twenty and ten, or thirty and ten, or no uma at all. Red fives can come back, and all simples can be limited to closed hands. Check the house rules before you sit down. Now, shall we try your test?', { tiles: ['5m', '5p', '5s'] }),
  ],
  quiz: [
    Q('How many points does everyone start with at the tournament table?', ['Thirty thousand', 'Twenty-five thousand', 'Thirty-five thousand'], 0, 'Tournament Riichi starts everyone on thirty thousand, and returns the same at the end, so there’s no oka.'),
    Q('Are there red fives in tournament play?', ['No, every five is ordinary', 'Yes, three of them', 'Only in the South round'], 0, 'Tournaments take the red fives out. The host can bring them back as a house rule.'),
    Q('You finish the match in first place. What uma do you get?', ['Fifteen thousand more', 'Five thousand more', 'Nothing extra'], 0, 'First place gets fifteen thousand, second five thousand. Third and fourth lose five and fifteen thousand.'),
    Q('A player drops below zero in the East round. What happens?', ['Play goes on to the last hand', 'The match ends at once', 'They leave, and the others carry on'], 0, 'Tournaments play every hand. The match never ends early on a bust.'),
    Q('You hold nine different terminals and honours on your first turn. Can you call off the hand?', ['No, the hand is played out', 'Yes, and the dealer deals again', 'Only if you’re the dealer'], 0, 'There are no abortive draws at the tournament table. Play it out, or aim for thirteen orphans!'),
  ],
};
