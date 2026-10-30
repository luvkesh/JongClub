// Academy lesson: strategy (Foundations, Level 6), kept short since the user
// asked for no repeated lessons (2026-10-25): the three questions behind every
// discard, calling wisely, and playing to your card. Speed, waits, defence and
// value are taught once, in depth, in Mastering Mahjong (Levels 9-12).

import { S, Q, type Lesson } from '../lessonKit';

export const strategyLesson: Lesson = {
  id: 'strategy',
  title: 'Strategy',
  scenes: [
    S('Every turn is a choice', 'You know the rules. Now let’s play well! Every turn you choose one tile to let go. Three questions help: will this make my hand faster, will it make it worth more, and is it safe to throw? Mastering Mahjong, Levels 9 to 12, teaches each one in depth. For now, two habits to start with.', { list: [{ tiles: '34m', title: 'Is it faster?', text: 'Will this discard bring me closer to ready?' }, { tiles: 'RdRd', title: 'Is it worth more?', text: 'Does it keep my hand concealed, which pays double?' }, { tiles: 'N', title: 'Is it safe?', text: 'Could it be another player’s winning tile?' }] }),
    S('Calling wisely', 'Calling a pung or chow makes you faster, but it shows your tiles and costs value. In India Rules a concealed hand pays double, and a fully concealed one four times as much. Call when it brings you close to winning, or when someone else looks close. Not just because you can.', { list: [{ tiles: 'RdRdRd', title: 'Good call', text: 'It brings you close to ready, when speed matters.' }, { tiles: '678p', title: 'Think twice', text: 'An early run that gives up a concealed hand.' }] }),
    S('Your table habits', 'The second habit. In the South and North rounds, your card names your hand, so look for the card hand your tiles fit best, and stay flexible. Every game, practise the habits: count, read, then decide. Play a few hands with JongBot’s hints on, and you’ll feel it quickly. Well done!', { tiles: ['EE', 'SS', 'WW', 'NN'] }),
  ],
  quiz: [
    Q('Which three questions help you choose a discard?', ['Faster? Worth more? Safe to throw?', 'Prettiest tile? Oldest tile? Biggest number?', 'What did East throw last?'], 0, 'Speed, value and safety: ask all three, every turn.'),
    Q('Your hand holds a mixed chow and a crochet. Should you call a pung?', ['Usually not: stay concealed for double pay', 'Always call', 'Only if it is a dragon'], 0, 'Indian sets stay hidden anyway, so one call halves the pay for little speed.'),
    Q('Another player looks close, and one call makes you ready. Should you call?', ['Yes: now speed matters most', 'No, never call', 'Only for a dragon'], 0, 'Call when it brings you close to winning, or when someone else looks close.'),
    Q('In the South round, which small card should you aim for?', ['The one your tiles fit best', 'Always the same card', 'Whichever pays the most'], 0, 'Look for the card your tiles already fit, and stay flexible.'),
  ],
};
