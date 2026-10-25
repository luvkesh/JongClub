// Academy lesson: Indonesian Mahjong, following JongClub's `indonesian`
// profile (src/engine/rules/thaiIndonesian.ts). Indonesia has no written
// rulebook: families mostly play Cantonese, Hong Kong-style Mahjong with
// their own customs, so our table is the Hong Kong engine with flowers, no
// minimum (any complete hand wins) and half gun on a discard (the discarder
// pays the points, the others half; a self-draw is paid by all three). It
// builds on the Hong Kong lesson. The worked example was checked against
// hongKongScore and hkHalfGun.

import { S, Q, type Lesson } from '../lessonKit';

export const indonesianLesson: Lesson = {
  id: 'indonesian',
  title: 'Indonesian Mahjong',
  base: 'hongkong',
  scenes: [
    S('Welcome to Jakarta', 'Selamat datang, and welcome to the Jakarta Pendopo! In Indonesia, Mahjong is loved by Chinese Indonesian families in Jakarta, Medan, Surabaya and beyond, often at Imlek, the Chinese New Year, and at family gatherings. There’s no written Indonesian rulebook. Most families play Cantonese, Hong Kong-style Mahjong with their own customs. Compared with Classic, flowers are in, and points follow the half-spicy table.', { tiles: ['123m', '456p', '789s', 'RdRdRd', 'EE', 'F1'] }),
    S('How we differ from Hong Kong', 'If you know Hong Kong, you know this game: the same tiles, the same calls, and the same faan. Our Indonesian table changes one big thing. There’s no minimum, so any complete hand wins, even one with no faan at all. And on a discard, we pay half gun, just like the Hong Kong default.', { tiles: ['123m', '456p', '789s', '777p', '55m'] }),
    S('Any hand wins', 'A hand with no faan still wins here. It’s worth eight points, the very bottom of the half-spicy table. So speed matters: a quick, plain hand can beat a slow, beautiful one. And each faan you do find still doubles the points, just as in Hong Kong.', { tiles: ['123m', '456p', '789s', '777p', '55m'] }),
    S('Flowers', 'Flowers are in, so the set has one hundred and forty-four tiles. When you draw a flower, set it aside face up and draw again. Your own seat flower is worth a faan, and so is having no flowers at all. Collect all four plants, or all four seasons, for two faan.', { tiles: ['F1', 'F2', 'F3', 'F4'] }),
    S('Half gun', 'Win on a discard, and the discarder pays the full points, while the other two pay half each. Win on your own draw, and all three players pay you the full points. Everyone at the table chips in, which keeps a family game friendly.', { tiles: ['5p'] }),
    S('An example', 'You sit South. You called a pung of Dots, and the rest is plain runs and a pair. Your one flower is the Plum, East’s flower, not yours. No faan at all, but it still wins! That’s eight points. The discarder pays you eight, and the other two pay four each.', { tiles: ['777p', '123m', '456p', '789s', '55m', 'F1'] }),
    S('Check your table', 'Indonesian families each play their own way. Some families keep a minimum, some ask the discarder to pay for everyone, and some play without flowers. Our host can change all of these, and seven pairs too. Take a peek at the house rules first. Now, shall we try your test?', { board: 'seats' }),
  ],
  quiz: [
    Q('At our Indonesian table, what is the smallest hand that can win?', ['Any complete hand, even with no faan', 'A hand worth one faan', 'A hand worth three faan'], 0, 'There’s no minimum here. Any complete hand wins, even a chicken hand.'),
    Q('Half gun: you win on a discard. Who pays what?', ['The discarder pays the points, the others half', 'The discarder pays for the whole table', 'Only the dealer pays'], 0, 'With half gun, the discarder pays the full points and the other two pay half each.'),
    Q('A hand with no faan wins on a discard. What does the discarder pay?', ['Eight', 'Sixteen', 'Nothing'], 0, 'No faan is eight points on the half-spicy table, and the discarder pays all eight. The others pay four each.'),
    Q('You win by self-draw. Who pays?', ['All three players pay the full points', 'Only the player on your left', 'All three players pay half'], 0, 'On a self-draw, all three players pay you the full points.'),
    Q('With flowers in, what is a hand with no flowers at all worth?', ['One faan', 'Nothing extra', 'Three faan'], 0, 'Having no flowers at all is worth one faan, and so is your own seat flower.'),
  ],
};
