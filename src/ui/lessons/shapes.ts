// Academy lesson: hand shapes beyond four sets and a pair. Seven pairs and
// thirteen orphans (which JongClub tables allow them: see `shapes` in each
// profile under src/engine/rules/), and the mixed chow and mixed pung
// patterns across the three suits. Those are named scoring patterns in
// Chinese Official (MCR) rules, and in Riichi as Sanshoku; JongClub's
// Classic, Dubai and Indian tables accept them as ordinary winning hands with
// no extra faan, and clubs that do score them do so as a house rule.

import { S, Q, type Lesson } from '../lessonKit';

export const shapesLesson: Lesson = {
  id: 'shapes',
  title: 'Hand shapes and variations',
  scenes: [
    S('More than one shape', 'Four sets and a pair is the shape you’ll see most. But some games, and some rounds, welcome other shapes too. Each table decides which ones count, so let me show you the common ones.', { hand: { title: 'The usual shape: four sets and a pair', groups: [{ tiles: '123m', label: 'Set' }, { tiles: '456p', label: 'Set' }, { tiles: '789s', label: 'Set' }, { tiles: 'RdRdRd', label: 'Set' }, { tiles: 'EE', label: 'Pair' }] } }),
    S('Seven pairs', 'First, seven pairs. Fourteen tiles, no sets at all, just seven pairs. Classic and Hong Kong welcome it, for four faan. Indian, Malaysian, Sichuan and Chinese Official tables allow it too, and Dubai hosts can switch it on or off. In Riichi it’s a scoring pattern called Chiitoitsu, and all seven pairs must be different.', { hand: { title: 'Seven pairs: fourteen tiles, no sets', groups: [{ tiles: '11m', label: 'Pair' }, { tiles: '44m', label: 'Pair' }, { tiles: '77p', label: 'Pair' }, { tiles: '22s', label: 'Pair' }, { tiles: '99s', label: 'Pair' }, { tiles: 'EE', label: 'Pair' }, { tiles: 'RdRd', label: 'Pair' }], facts: ['Classic and Hong Kong: 4 faan', 'Riichi: Chiitoitsu, all seven different'] } }),
    S('Where pairs don’t count', 'Taiwanese, Vietnamese and Singapore tables don’t use seven pairs, so stick to sets there. American tables are different again. Their card has its own pair hands, which must be played exactly as printed.', { table: { head: ['Table', 'Seven pairs?'], rows: [['Classic, Hong Kong, Indian, Malaysian, Sichuan, Chinese Official', 'Yes'], ['Riichi', 'Yes: Chiitoitsu, seven different pairs'], ['Dubai', 'The host decides'], ['Taiwanese, Vietnamese, Singapore', 'No: build sets'], ['American', 'Only the pair hands printed on the card']] } }),
    S('Thirteen orphans', 'Then there’s thirteen orphans. One of every terminal and every honour, plus one extra to make a pair. It’s a limit hand in Classic, Hong Kong, Riichi and Indian clubs. In Singapore it’s called the thirteen wonders.', { hand: { title: 'Thirteen orphans: one of every terminal and honour, plus one', groups: [{ tiles: '1m 9m 1p 9p 1s 9s', label: 'Terminals', sub: 'every 1 and 9' }, { tiles: 'E S W N', label: 'Winds', sub: 'one of each' }, { tiles: 'Rd Gd Wd Wd', label: 'Dragons', sub: 'one doubled for the pair', mark: 'hl' }], facts: ['A limit hand: Classic, Hong Kong, Riichi, Indian clubs'] } }),
    S('Mixed chows', 'Now a different idea, mixing the suits. The same run in all three suits, like two three four in Characters, Dots and Bamboo, is a mixed triple chow. Step it up one in each suit, one two three, then two three four, then three four five, and that’s mixed shifted chows.', { cards: [{ tiles: '234m 234p 234s', title: 'Mixed triple chow', text: 'The same run in all three suits.' }, { tiles: '123m 234p 345s', title: 'Mixed shifted chows', text: 'Up one step in each suit.' }] }),
    S('Mixed pungs', 'Pungs can do the same. Fives in all three suits is a triple pung. Three, four and five, each in a different suit, is mixed shifted pungs.', { cards: [{ tiles: '555m 555p 555s', title: 'Triple pung', text: 'The same number in all three suits.' }, { tiles: '333m 444p 555s', title: 'Mixed shifted pungs', text: 'Up one step in each suit.' }] }),
    S('Who scores them', 'At our Chinese Official table they score: mixed triple chow is eight fan, mixed shifted chows six, triple pung sixteen. Riichi calls the same run or pung in all three suits Sanshoku. At Classic, Hong Kong, Dubai and Indian tables, they’re good hands with no extra faan. Some clubs add them as a house rule for a round, so ask the host.', { table: { head: ['Pattern', 'Chinese Official', 'Riichi', 'Classic, Hong Kong, Dubai, Indian'], rows: [[{ tiles: '345m 345p 345s', text: 'Mixed triple chow' }, '8 fan', 'Sanshoku', 'A good hand, no extra faan'], [{ tiles: '123m 234p 345s', text: 'Mixed shifted chows' }, '6 fan', '—', 'No extra faan'], [{ tiles: '555m 555p 555s', text: 'Triple pung' }, '16 fan', 'Sanshoku', 'No extra faan']] } }),
  ],
  quiz: [
    Q('Which of these is a mixed triple chow?', [['The same run in three suits', '234m 234p 234s'], ['Three runs in one suit', '123m 456m 789m'], ['Three pungs of winds', 'EEE SSS WWW']], 0, 'A mixed triple chow is the same run in Characters, Dots and Bamboo.'),
    Q('Which tables never count seven pairs?', ['Taiwanese, Vietnamese and Singapore', 'Classic and Riichi', 'Every table'], 0, 'Seven pairs counts in Classic, Hong Kong, Riichi, Indian, Malaysian, Sichuan and Chinese Official play, and Dubai hosts choose. Taiwanese, Vietnamese and Singapore tables don’t use it.'),
    Q('In Riichi, what is the same run in all three suits called?', ['Sanshoku', 'Pon', 'Tsumo'], 0, 'Riichi calls the same run or pung in all three suits Sanshoku.'),
    Q('At a Classic table, does a mixed triple chow add faan?', ['No, but it still wins', 'Yes, eight faan', 'It isn’t allowed'], 0, 'At JongClub’s Classic table it’s a good hand with no extra faan. Chinese Official play scores it eight fan.'),
    Q('What is thirteen orphans made of?', ['Every terminal and honour, plus one', 'Seven pairs', 'Only dragons'], 0, 'Thirteen orphans is one of each terminal and honour, plus one more to make a pair.'),
  ],
};
