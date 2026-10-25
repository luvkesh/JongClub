// Academy lesson: Zung Jung, following JongClub's `zung-jung` profile
// (src/engine/rules/zungJung.ts): Alan Kwan's modern system, 136 tiles with
// no flowers, pattern points that add (never double), a 320-point limit, a
// one-point Chicken Hand, bigger patterns replacing the smaller ones inside
// them, and settlement as JongClub reads the published rules (said so in the
// lesson): each player pays a self-draw, the discarder pays three times the
// points. The worked example was checked against zungJungScore.

import { S, Q, type Lesson } from '../lessonKit';

export const zungJungLesson: Lesson = {
  id: 'zung-jung',
  title: 'Zung Jung',
  scenes: [
    S('A modern system', 'Welcome to the Zung Jung salon! Zung Jung is a modern scoring system, designed in Hong Kong by Alan Kwan in two thousand and six, for fair and skilful play. The tiles and calls are just like Classic, with no flowers. What’s different is the scoring. Let me show you!', { tiles: ['123m', '456p', '789s', 'RdRdRd', 'EE'] }),
    S('Points that add up', 'In Zung Jung, patterns are worth points, and the points are simply added up. They never double. The total stops at three hundred and twenty, the limit. Any complete hand wins. A hand with no pattern at all is a chicken hand, worth just one point.', { tiles: ['123m', '456p', '789s', '777p', '55m'] }),
    S('Small patterns', 'The smallest patterns are worth five each. All sequences, four chows and a pair. A concealed hand, with nothing claimed before your winning tile. And no terminals, with no ones, nines or honours at all. Each dragon pung is ten, and so is a pung of your seat wind, or of the prevailing wind.', { tiles: ['234m', '345p', '567s', '678s', '22p'] }),
    S('One suit', 'Suits pay well. Mixed one-suit, one suit plus honours, is forty. Pure one-suit, with no honours, is eighty. Small three dragons, two dragon pungs and a dragon pair, is forty, and big three dragons is one hundred and thirty.', { tiles: ['123s', '456s', '789s', 'RdRdRd', '55s'] }),
    S('Lovely shapes', 'Look for shapes, too. Two identical sequences, the same run twice in one suit, is ten. The same run in all three suits is thirty-five. A nine-tile straight, one to nine in one suit, is forty. All triplets is thirty, and seven pairs is thirty.', { tiles: ['123s', '456s', '789s'] }),
    S('Bigger replaces smaller', 'One golden rule. A bigger pattern replaces the smaller one inside it. Big three dragons replaces its dragon pungs and small three dragons, so you count only the big one. Different patterns, though, simply add together.', { tiles: ['RdRdRd', 'GdGdGd', 'WdWdWd'] }),
    S('Who pays', 'Here’s how our table settles, and it’s our own reading of the published rules. Win by self-draw, and each other player pays you the points. Win on a discard, and the discarder pays for the whole table, three times the points.', { tiles: ['5p'] }),
    S('An example', 'You called a pung of Red Dragons, and the rest is Bamboo, one to nine, with a pair of fives. You win on a discard. Dragon pung, ten. Nine-tile straight, forty. Mixed one-suit, forty. That’s ninety points, and the discarder pays two hundred and seventy. Had you drawn it yourself, each player would pay ninety.', { tiles: ['RdRdRd', '123s', '456s', '789s', '55s'] }),
    S('Our table', 'Official Zung Jung has no minimum, and that’s our default. For a game with fewer tiny wins, the host can ask for five points to win. Now, shall we try your test?', { board: 'seats' }),
  ],
  quiz: [
    Q('How are Zung Jung points combined?', ['Added up', 'Each one doubles the score', 'Only the biggest counts'], 0, 'Zung Jung points are simply added up. They never double.'),
    Q('What is the most a hand can score?', ['Three hundred and twenty', 'One thousand', 'Eighty'], 0, 'The limit is three hundred and twenty points.'),
    Q('What is a chicken hand worth?', ['One point', 'Nothing, it can’t win', 'Five points'], 0, 'Any complete hand wins. With no other pattern, it’s a chicken hand, worth one point.'),
    Q('A ninety point hand wins on a discard. What does the discarder pay, at our table?', ['Two hundred and seventy', 'Ninety', 'One hundred and eighty'], 0, 'At our table, the discarder pays for the whole table: three times ninety is two hundred and seventy.'),
    Q('You have big three dragons. Do you also count each dragon pung?', ['No, the big pattern replaces them', 'Yes, ten for each', 'Only on a self-draw'], 0, 'A bigger pattern replaces the smaller ones inside it, so you count only big three dragons.'),
  ],
};
