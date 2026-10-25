// Academy lesson: Thai Mahjong, following JongClub's `thai` profile
// (src/engine/rules/thaiIndonesian.ts). Thailand has no written rulebook:
// families mostly play Cantonese, Hong Kong-style Mahjong with their own
// customs, so our table is the Hong Kong engine with flowers, a one-faan
// minimum and full gun on a discard (the discarder pays double the points,
// what the whole table would pay at half gun; a self-draw is paid by all
// three). It builds on the Hong Kong lesson. The worked example was checked
// against hongKongScore and hkFullGun.

import { S, Q, type Lesson } from '../lessonKit';

export const thaiLesson: Lesson = {
  id: 'thai',
  title: 'Thai Mahjong',
  base: 'hongkong',
  scenes: [
    S('Welcome to Bangkok', 'Sawasdee ka, and welcome to the Bangkok Teak House! In Thailand, Mahjong is mostly played by Thai Chinese families, at home, at Chinese New Year and at big family gatherings. There’s no written Thai rulebook. Most tables play Cantonese, Hong Kong-style Mahjong with their own customs. Compared with Classic, flowers are in, and points follow the half-spicy table. Let me show you!', { tiles: ['123m', '456p', '789s', 'RdRdRd', 'EE', 'F1'] }),
    S('How we differ from Hong Kong', 'If you’ve learned Hong Kong, you already know this game: the same tiles, the same calls, and the same faan. Our Thai table changes just two things. You need only one faan to win, not three. And on a discard, the discarder pays for the whole table. That’s called full gun.', { tiles: ['RdRdRd', '5p'] }),
    S('One faan to win', 'One faan is easy to find. A dragon pung will do, or a pung of your seat or round wind, or a concealed hand you draw yourself. But a hand with nothing in it at all, a chicken hand, can’t win at our table. So look for one little extra.', { tiles: ['RdRdRd', 'EEE'] }),
    S('Flowers', 'Flowers are in, so the set has one hundred and forty-four tiles. When you draw a flower, set it aside face up and draw again. Your own seat flower is worth a faan, and so is having no flowers at all. Collect all four plants, or all four seasons, for two faan.', { tiles: ['F1', 'F2', 'F3', 'F4'] }),
    S('Full gun', 'Win on a discard, and the discarder pays for the whole table: double the hand’s points, while the other two pay nothing. Win on your own draw, and all three players pay you the points. So at a Thai table, a careless discard really costs you!', { tiles: ['5p'] }),
    S('An example', 'You sit South. You called a chow, and you hold a pung of Red Dragons. Your one flower is the Plum, East’s flower, not yours. Red Dragons, one faan, and that’s enough to win! One faan is sixteen points. On a discard, the discarder pays you thirty-two. Draw it yourself, and self-draw makes two faan: each player pays you thirty-two.', { tiles: ['234m', 'RdRdRd', '567p', '678s', '99s', 'F1'] }),
    S('Check your table', 'Every Thai family plays a little differently. Some families keep a higher minimum, some share the payment with half gun, and some leave the flowers out. So our host can change the minimum, the flowers, seven pairs and who pays. Take a peek at the house rules first. Now, shall we try your test?', { board: 'seats' }),
  ],
  quiz: [
    Q('At our Thai table, how many faan do you need to win?', ['One', 'Three', 'None'], 0, 'Our Thai table needs just one faan. Hong Kong’s default is three.'),
    Q('Full gun: you win on a discard. Who pays?', ['The discarder pays for the whole table', 'The discarder pays the points, the others half', 'Everyone pays the same'], 0, 'With full gun, the discarder pays double the points, and the other two pay nothing.'),
    Q('A one faan hand wins on a discard. What does the discarder pay?', ['Thirty-two', 'Sixteen', 'Eight'], 0, 'One faan is sixteen points, and under full gun the discarder pays double: thirty-two.'),
    Q('Which hand can’t win at our Thai table?', ['A chicken hand, with no faan', 'A hand with a dragon pung', 'A concealed hand you draw yourself'], 0, 'You need one faan. A dragon pung gives one, and so does a concealed self-draw, but a chicken hand has none.'),
    Q('Is there one official Thai rulebook?', ['No, families keep their own customs', 'Yes, written in Bangkok', 'Yes, the same as Riichi'], 0, 'There’s no written Thai rulebook. Most families play Hong Kong-style Mahjong their own way, and our table sets sensible defaults.'),
  ],
};
