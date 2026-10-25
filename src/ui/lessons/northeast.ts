// Academy lesson: Northeast China (Dongbei) Mahjong, following JongClub's
// `northeast` profile (src/engine/rules/northeast.ts): 136 tiles with no
// flowers, the five-point checklist every win must pass (three suits; a one,
// nine or honour; a pung; a chow; an open hand), no seven pairs, doubles on a
// one-point base capped at four, and everyone paying, the discarder and the
// dealer double. Said plainly: local tables differ, and this is JongClub's
// reading. The worked example was checked against northeastScore and
// northeastPayments.

import { S, Q, type Lesson } from '../lessonKit';

export const northeastLesson: Lesson = {
  id: 'northeast',
  title: 'Northeast China',
  scenes: [
    S('Welcome to Harbin', 'Welcome to the Harbin winter hall! Northeast Mahjong, or Dongbei Mahjong, is the brisk game of Harbin, Changchun and Shenyang. Compared with Classic, there are no flowers and no seven pairs, and every winning hand must pass a checklist of five points. Each double doubles a single point, and everyone pays, the discarder double. Let me show you!', { tiles: ['123m', '777p', '456s', '678m', '22p'] }),
    S('New words', 'There are one hundred and thirty-six tiles: the suits, the winds and the dragons. You call Chi for a chow, Peng for a pung and Gang for a kong, and Hu to win, or Zimo on your own draw. You still need four sets and a pair. But here, not every four sets and a pair will do.', { tiles: ['123m', '555p', '9999s'] }),
    S('Point one: three suits', 'Here’s the checklist. Point one: your hand must hold all three suits. At least one Character, one Circle and one Bamboo, somewhere in your sets or your pair. A hand in only two suits can never win here, however pretty it is.', { tiles: ['3m', '5p', '7s'] }),
    S('Point two: a one, nine or honour', 'Point two: you need a one, a nine or an honour. It can sit in a run like one, two, three, in a pung of nines, in a dragon pung, or even in your pair. A hand of nothing but twos to eights won’t pass.', { tiles: ['123m', '999s', 'EE'] }),
    S('Points three and four', 'Point three: at least one pung or kong. Point four: at least one chow, a run. So a hand of all pungs fails, and so does a hand of all runs. You need one of each, at the very least.', { tiles: ['777p', '456s'] }),
    S('Point five: open the door', 'Point five: your hand must be open, with at least one set claimed from a discard. A fully concealed hand can’t win, even on your own draw. Some tables let a concealed hand win by self-draw, and our host can turn that on.', { tiles: ['123m'] }),
    S('A hand that fails', 'Look at this one. A claimed run, a pung, a pair of East, and runs to spare. It has ones and an honour, a pung, a chow, and it’s open. But where’s the Bamboo? There isn’t any, so it fails point one, and it can’t win. Always count your suits!', { tiles: ['123m', '456p', '789m', '555p', 'EE'] }),
    S('Doubles and paying', 'A hand is worth one point, doubled for each double. Your own draw is one. A clamp, winning on the middle tile of a run, like a five between a four and a six, is one. The dealer gets one, and so does a win on a kong’s replacement. Four doubles is the cap. Everyone pays, the discarder pays double, and the dealer pays double too.', { tiles: ['4s', '5s', '6s'] }),
    S('An example', 'You called a run of one, two, three of Characters. You hold a pung of seven Circles, and a four and six of Bamboo. A player who isn’t the dealer throws the five, and you win. A clamp, one double, makes two points. The discarder pays four, the dealer pays four, and the third player pays two.', { tiles: ['123m', '777p', '456s', '678m', '22p'] }),
    S('Our table', 'One honest note. Dongbei rules change from city to city, and many tables add a treasure tile or extra doubles. This is JongClub’s own reading: the five-point checklist, four simple doubles, and a cap of four. Now, shall we try your test?', { board: 'seats' }),
  ],
  quiz: [
    Q('Your hand has Characters and Circles, but no Bamboo. Can it win?', ['No, it needs all three suits', 'Yes, on your own draw', 'Yes, with a dragon pung'], 0, 'Point one of the checklist: every winning hand holds all three suits.'),
    Q('Your hand is all twos to eights, with no honours. What does it lack?', ['A one, nine or honour', 'A chow', 'A claimed set'], 0, 'Point two: somewhere in your sets or pair, you need a one, a nine or an honour.'),
    Q('You have four pungs and a pair, in all three suits. Can you win?', ['No, you also need a chow', 'Yes, all pungs is fine', 'Only on your own draw'], 0, 'Point four: every winning hand needs at least one chow, as well as a pung.'),
    Q('Your hand is fully concealed, with the default house rules. Can you win?', ['No, you must claim at least one set', 'Yes, on any tile', 'Only with a clamp'], 0, 'Point five: your hand must be open. The host can let a concealed hand win by self-draw.'),
    Q('A one double hand wins on a discard, and the discarder isn’t the dealer. What does the discarder pay?', ['Four', 'Two', 'Eight'], 0, 'One double makes two points, and the discarder pays double: four.'),
  ],
};
