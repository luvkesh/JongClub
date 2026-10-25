// Academy lesson: Fujian (Fuzhou) Mahjong, following JongClub's `fujian`
// profile (src/engine/rules/fujian.ts), a sixteen-tile game built on the
// Taiwanese table: five sets and a pair, 144 tiles, a gold turned up each
// hand (the other copies of the tile turned up are wild), Three Golds Fall,
// a base of five plus flowers, golds and kongs, doubles for a self-draw, a
// clean hand and a full flush, and the discarder alone paying double. The
// worked examples were checked against fujianScore and fujianPayments.

import { S, Q, type Lesson } from '../lessonKit';

export const fujianLesson: Lesson = {
  id: 'fujian',
  title: 'Fujian Mahjong',
  base: 'taiwanese',
  scenes: [
    S('Welcome to Fuzhou', 'Welcome to the Fuzhou gold hall! Fujian Mahjong is the game of Fuzhou and much of Fujian province. Like Taiwanese, it’s a sixteen-tile game. Compared with Classic, your hand is five sets and a pair, a wild tile called gold changes every hand, and three golds win on the spot. Let me show you!', { tiles: ['123m', '456p', '789s', '222s', 'EEE', '55p'] }),
    S('Sixteen tiles', 'You hold sixteen tiles, and win with seventeen: five sets and a pair. There are no seven pairs here. All one hundred and forty-four tiles are used, flowers and seasons included. You call Chi for a chow, but only from the player on your left, Peng for a pung, Gang for a kong, and Hu to win.', { tiles: ['F1', 'F2', 'F5', 'F6'] }),
    S('The gold', 'After the deal, a tile is turned up from the back of the wall, and it stays out of play. If it’s a flower, it’s set aside and another is turned up. The other three copies of that tile are gold, wild for any tile in your hand.', { tiles: ['6m', '666m'] }),
    S('Using gold', 'Gold can finish a pung, a chow or the pair, but only in your own hand, never in a claimed set. You may throw gold away, but a discarded gold is dead, and nobody can claim it. Most players keep their gold, though, because each one in your hand is worth a point.', { tiles: ['44p 6m', '79s 6m', 'N 6m'] }),
    S('Three golds fall', 'Here’s the famous rule, three golds fall. Hold three golds, and you can win at once on your own draw, whatever the rest of your hand looks like. It scores thirty points, plus your flowers and golds, doubled for the self-draw. With no flowers, that’s sixty-six from each player.', { tiles: ['666m'] }),
    S('Counting points', 'Every other win has a base of five points. Add one for each flower and season, one for each gold in your hand, one for an exposed kong, and two for a concealed kong. Then come the doubles. A self-draw doubles, a clean hand with no gold in it doubles, and a full flush, one suit only, doubles too. There’s no cap.', { tiles: ['F3', '6m', '8888s'] }),
    S('Who pays', 'Win by self-draw, and all three players pay you the score. Win on a discard, and the discarder alone pays, and pays double. Everyone starts with one thousand points.', { tiles: ['9p'] }),
    S('An example', 'No gold in your hand, two flowers, and you draw the winning tile yourself. Base five, plus two flowers, is seven. A clean hand doubles it to fourteen, and the self-draw doubles it again to twenty-eight. Each player pays you twenty-eight. Had a gold filled a gap, it’s eight points, doubled once: sixteen each.', { tiles: ['123m', '456m', '789p', '234s', '666s', '99p', 'F1', 'F5'] }),
    S('Our table', 'One honest note. Fujian rules change from town to town, and this is JongClub’s own reading of the Fuzhou game. At our table, a gold standing for itself, as its own tile, still leaves the hand clean. Now, shall we try your test?', { board: 'seats' }),
  ],
  quiz: [
    Q('How many tiles make a winning hand in Fujian?', ['Seventeen: five sets and a pair', 'Fourteen: four sets and a pair', 'Sixteen: four sets and two pairs'], 0, 'Fujian is a sixteen-tile game. You win with seventeen: five sets and a pair.'),
    Q('The tile turned up is the two of Circles. Which tiles are gold?', [['The other three twos of Circles', '2p'], ['The threes of Circles', '3p'], ['Every Circles tile', '123p']], 0, 'Gold is the tile turned up itself: its other three copies are wild.'),
    Q('You draw your third gold. What can you do?', [['Win at once: three golds fall', '666m'], ['Nothing until your hand is complete', '666m'], ['Discard one for a bonus', '6m']], 0, 'Three golds in your hand win at once on your own draw, whatever the rest of your hand.'),
    Q('A hand worth fourteen points wins on a discard. What does the discarder pay?', ['Twenty-eight', 'Fourteen', 'Forty-two'], 0, 'On a discard the discarder alone pays, and pays double.'),
    Q('What does a concealed kong add to your points?', [['Two points', '8888s'], ['One point', '8888s'], ['A double', '8888s']], 0, 'An exposed kong adds one point, and a concealed kong adds two.'),
  ],
};
