// The guided game: Mei sits beside a newcomer through a real hand and talks
// them through it. She speaks at the moments that matter (your first turn,
// a tile you can claim, being one tile from winning, the result) and drops a
// few tips along the way, each said once so the hand never feels crowded.
// Every version of the game has its own script: the welcome, the first move,
// the call names, and the moments that only happen at that table (the
// Charleston, riichi, flowers and animals, jokers, bites, house rules).
// Every line is fixed text, so all of it is recorded in Mei's voice; details
// that change (JongBot's suggestion, the tile set aside, this table's house
// rules) appear in the caption only.

import { narrator } from '../audio/voice';
import { FLOWER_JOKER, isAnimal, tileName } from '../engine/tiles';
import { h } from './dom';
import './coach.css';
import { tr } from '../i18n';
import { icon } from './icons';

export type ClaimKind = 'pung' | 'chow' | 'kong' | 'win';

/** Things that happen only at some tables. A script says a moment only if it has a line for it. */
export type Moment =
  | 'bonus'
  | 'animal'
  | 'flowerJoker'
  | 'joker'
  | 'swap'
  | 'house'
  | 'riichi'
  | 'riichiDone'
  | 'otherRiichi'
  | 'dora'
  | 'bite'
  | 'otherBite'
  | 'kongMoney'
  | 'vote';

export interface CoachScript {
  welcome: string;
  /** Your first discard, as the dealer. */
  first: string;
  tips: string[];
  claim: Partial<Record<ClaimKind, string>>;
  selfWin: string;
  ready: string;
  youWon: string;
  moments?: Partial<Record<Moment, string>>;
  /** The Charleston passes, by stage (right, across, left, then left, across, right). */
  charleston?: string[];
  /** The closing line on the results screen (else SHARED.end). */
  end?: string;
}

/** Lines every table shares. */
export const SHARED = {
  /** Your first turn when you aren't the dealer. */
  /** Your first draw from the wall, when you draw your own tiles (Auto-draw off). */
  draw: 'Your turn! Every turn starts the same way: take one new tile from the wall. Tap Draw a tile, or tap the wall itself.',
  firstLater: 'It’s your turn! The tile you just drew is glowing gold. Choose one tile to throw away. Tap it once to lift it, then tap it again to discard.',
  announce: 'Did you hear that? Every tile thrown into the middle is called out loud, so you always know what just went out.',
  otherCalled: 'Another player just called for a discard! Their new set sits face up beside their tiles, and play jumps to them.',
  youCalled: 'Well played! Your new set is face up on the table. Now discard one tile, just like a normal turn.',
  otherWon: 'Ah, another player finished first this time. That’s perfectly fine. Every hand teaches you something new.',
  drawn: 'The wall has run out, so nobody wins this hand. We call that a draw. It happens to everyone!',
  end: 'That’s our guided game! You know the rhythm now. Draw, discard, call when it helps, and listen for your winning tile. Shall we carry on with the lessons?',
};

const FIRST_EAST = 'You’re East, the dealer, so you go first. Your new tile is glowing gold. Choose one tile to throw away. Tap it once to lift it, then tap it again to discard.';

/** Classic Mahjong: the original guided game. */
const classic: CoachScript = {
  welcome:
    'Hello again! This time we’ll play a real hand together, and I’ll sit right here beside you. Your tiles are along the bottom of the table. Have a look while everyone takes their tiles.',
  first:
    'You’re East, the dealer, so you go first. The tile you just drew is glowing gold. Now choose one tile to throw away. Click it once to lift it, then click it again to discard.',
  tips: [
    'Your turn again. Draw, then discard. Look for lonely tiles that don’t fit with anything.',
    'Honours you only hold one of are often the first to go. They can never be part of a run.',
    'Keep tiles that sit close together, like four and five of the same suit. They’re already halfway to a run.',
    'Pairs are precious. Keep one or two, because every winning hand needs a pair.',
    'If you’re unsure, JongBot’s suggestion is lifted a little in your hand. Hover over any tile to see its name.',
    'Nice and steady! Watch what the others throw away. It tells you what they don’t need.',
  ],
  claim: {
    pung: 'Ooh, you can claim that tile! Press Pung to make three of a kind, or Pass if you’d rather keep going. Decide quickly! At a real table, and especially online, the chance is gone once the next player draws.',
    chow: 'That tile fits a run in your hand! Press Chow to take it. Remember, you can only chow from the player on your left. Be quick, the chance is gone once the next player draws.',
    kong: 'Four of a kind! Press Kong to claim it, and you’ll draw a replacement tile from the wall.',
    win: 'That’s your winning tile! Press Mahjong, quickly!',
  },
  selfWin: 'You’ve drawn your winning tile! Press Mahjong!',
  ready: 'Look at that! You’re only one tile away from Mahjong. Keep an eye on every discard.',
  youWon: 'Mahjong! You did it! Your very first winning hand. I’m so proud of you!',
};

const riichi: CoachScript = {
  welcome:
    'Welcome to the Tokyo table! This is Riichi, so remember the golden rule. Every win needs a yaku, and riichi itself is the easiest one. Have a look at your tiles while everyone takes theirs.',
  first: FIRST_EAST,
  tips: [
    'See the dora at the top of the screen? Each one in your winning hand adds a han. It’s a lovely bonus, but on its own it isn’t a yaku.',
    'Try to keep your hand closed. With no calls, you can declare riichi as soon as you’re one tile away.',
    'All simples is an easy yaku too. Twos to eights only, so ones, nines and honours can go early.',
    'A pung of dragons, your seat wind or the round wind is a yaku as well. So a pair of dragons is worth keeping.',
    'Careful with furiten! If you’ve thrown away one of your own winning tiles, you can’t call Ron. Only Tsumo will do.',
  ],
  claim: {
    pung: 'You can call Pon on that tile, for three of a kind. But calling opens your hand, so you can’t declare riichi afterwards. Make sure you’ll still have a yaku! Or press Pass. Be quick, the chance is gone once the next player draws.',
    chow: 'That tile fits a run! Call Chi to take it, but only from the player on your left. An open hand can’t declare riichi, so you’ll need another yaku.',
    kong: 'Four of a kind! Call Kan to claim it. You’ll draw a replacement tile, and a new dora is turned over.',
    win: 'That’s your winning tile! Press Ron, quickly!',
  },
  selfWin: 'You’ve drawn your winning tile yourself! Press Tsumo!',
  ready: 'Look at that! You’re one tile away from winning. That’s called tenpai. Watch every discard closely.',
  youWon: 'You won! Your very first Riichi hand, yaku and all. I’m so proud of you!',
  moments: {
    riichi: 'You’re ready, and your hand is closed! Press Riichi, then pick the tile to turn sideways. It costs a one thousand point stick, but it’s a yaku all by itself.',
    riichiDone: 'Riichi! Your hand is locked now. Every tile you draw goes straight back out, unless it’s the one that wins. Fingers crossed!',
    otherRiichi: 'Another player just declared riichi! They’re one tile away. Play it safe, and throw tiles they’ve already thrown themselves.',
    dora: 'A new dora has just been turned over! Check the top of the screen. More dora means a bigger hand.',
  },
};

const taiwanese: CoachScript = {
  welcome:
    'Welcome to the Jade Palace! In Taiwanese Mahjong you hold sixteen tiles, not thirteen, so you’re building five sets and a pair. Have a look while everyone takes their tiles.',
  first: 'You’re East, the dealer, so you go first, with seventeen tiles. Your new tile is glowing gold. Tap a tile once to lift it, then tap it again to discard.',
  tips: [
    'With sixteen tiles there’s room for everything. Look for runs and pairs, and let the lonely honours go.',
    'A concealed hand earns a tai, and so does winning on your own draw. So you don’t need to call every tile you see.',
    'A pung of dragons, your seat wind or the round wind is worth a tai each.',
    'Win on a discard, and only the discarder pays. So be a little careful once someone looks close.',
    'Keep an eye on the dealer. They add a tai to every hand they win or pay for.',
  ],
  claim: {
    pung: 'Ooh, you can claim that tile! Press Pong to make three of a kind, or Pass to keep your hand concealed. Be quick, the chance is gone once the next player draws.',
    chow: 'That tile fits a run in your hand! Press Chi to take it. You can only chi from the player on your left.',
    kong: 'Four of a kind! Press Gang to claim it, and you’ll draw a replacement tile.',
    win: 'That’s your winning tile! Press Hu, quickly!',
  },
  selfWin: 'You’ve drawn your winning tile! Press Zimo, and everyone pays you!',
  ready: 'Look at that! You’re only one tile away from winning. Keep an eye on every discard.',
  youWon: 'Hu! You did it! Five sets and a pair, all seventeen tiles in place. Wonderful!',
  moments: {
    bonus: 'See the flower beside your tiles? Flowers never stay in your hand. They go aside face up, and you draw a replacement. Your own seat flower is worth a tai!',
  },
};

const american: CoachScript = {
  welcome:
    'Welcome to the Manhattan table! In American Mahjong you play from a card. There are no chows, there are jokers, and before anyone discards, we pass tiles in the Charleston.',
  first: 'The Charleston’s done, and play begins! You’re East, so you hold fourteen tiles and discard first. Tap a tile once to lift it, then tap it again to throw it away.',
  tips: [
    'Tap Card at the top of the screen any time. Your closest hands are marked, so pick one or two and build toward them.',
    'The eight flowers all count as the same tile here, and they stay in your hand.',
    'You can call a discard to finish a group of three or more, and then you show it. Pairs can only be called for Mah Jongg.',
    'Watch the groups on the table. If a joker sits in one, you might be able to swap a real tile for it on your turn.',
    'A hand with no jokers at all is worth double. It’s a lovely bonus if you can manage it.',
  ],
  claim: {
    pung: 'You can call that tile to finish a group! Press Pung, and your group goes face up. Only call if it fits your hand on the card. Or press Pass. Be quick, the chance is gone once the next player draws.',
    kong: 'That tile makes four of a kind! Press Kong to call it, but only if it fits your hand on the card.',
    win: 'That’s your winning tile! Press Mah Jongg, quickly!',
  },
  selfWin: 'You’ve drawn the last tile for your hand! Press Mah Jongg!',
  ready: 'Look at that! You’re one tile away from a hand on the card. Listen for that last tile.',
  youWon: 'Mah Jongg! You did it! A hand straight off the card. I’m so proud of you!',
  moments: {
    joker: 'You’ve got a joker! Keep it close. It can stand in for any tile in a group of three or more, but never a pair.',
    swap: 'Ooh, look! You hold the real tile for a joker on the table. Press Swap to trade it, and the joker is yours.',
    vote: 'Now everyone votes on a second Charleston. If your hand already fits a hand on the card, you can stop here and start play.',
  },
  charleston: [
    'Here comes the Charleston! Pick three tiles you don’t want, and pass them to the right. Jokers can never be passed. JongBot’s pick is there if you’d like help.',
    'Lovely. Now pick three more, and pass them across the table.',
    'And the last pass of the first Charleston goes to the left. Choose your three.',
    'We’re passing again! The second Charleston goes to the left first.',
    'Now three tiles across the table.',
    'And the very last pass goes to the right. Then play begins!',
  ],
};

const HOUSE = 'Every club table plays a little differently. This table’s house rules are written just below me, so have a quick look.';

const uae: CoachScript = {
  welcome:
    'Welcome to the Dubai club! It’s the classic game of four sets and a pair, but here the host sets the house rules. Have a look at your tiles while everyone takes theirs.',
  first: FIRST_EAST,
  tips: [
    'You’ll usually need at least one faan to win here. A pung of dragons is an easy one.',
    'Having no flowers at all earns a faan, and so does your own seat flower.',
    'Keep tiles that sit close together, like four and five of the same suit. They’re already halfway to a run.',
    'Watch who looks close to winning. Depending on the house rules, the discarder might pay for the whole table!',
  ],
  claim: classic.claim,
  selfWin: classic.selfWin,
  ready: classic.ready,
  youWon: 'Mahjong! You did it! Your very first win at the Dubai club. Wonderful!',
  moments: {
    bonus: 'See the flower beside your tiles? It goes aside face up, and you draw a replacement. Your own seat flower is worth a faan here.',
    house: HOUSE,
  },
};

const indian: CoachScript = {
  welcome:
    'Namaste, and welcome to the Calcutta Club! It’s four sets and a pair, with flowers and eight jokers in the wall. Have a look at your tiles while everyone takes theirs.',
  first: FIRST_EAST,
  tips: [
    'Win without using any jokers, and you earn a bonus faan. A lovely Indian touch!',
    'You can call a pung with one real tile and a joker. But chows are called with real tiles only.',
    'Think twice before throwing a joker away. Once it’s discarded, it’s dead, and nobody can claim it.',
    'Every faan doubles the score. A pung of dragons and no flowers already makes two!',
  ],
  claim: classic.claim,
  selfWin: classic.selfWin,
  ready: classic.ready,
  youWon: 'Mahjong! You did it! Your very first win at the Calcutta Club. Wonderful!',
  moments: {
    bonus: 'See the flower set aside by your tiles? Flowers go face up beside you, and you draw a replacement. Your seat flower adds a faan.',
    joker: 'You’ve got a joker! It can stand for any tile in a pung, a kong or a run, but not in your pair. Hold on to it.',
    house: HOUSE,
  },
};

const vietnamese: CoachScript = {
  welcome:
    'Xin chào, and welcome to the Saigon table! It’s four sets and a pair, with flowers and eight Khung jokers. Have a look at your tiles while everyone takes theirs.',
  first: FIRST_EAST,
  tips: [
    'Phán are simply added up here, never doubled. A self-drawn win is one, and a concealed hand is one more.',
    'Only the Number Joker can help with a run, because only it stands for numbers.',
    'Win without using any jokers, and that’s a bonus phán!',
    'A discarded joker is dead, so nobody can claim it. Think twice before letting one go.',
    'Win on a discard, and by default the discarder pays for the whole table. So play carefully when someone looks close!',
  ],
  claim: {
    pung: 'Ooh, you can claim that tile! Press Phỗng to make three of a kind, or Pass if you’d rather keep going. Be quick, the chance is gone once the next player draws.',
    chow: 'That tile fits a run in your hand! Press Ăn to take it. You can only ăn from the player on your left.',
    kong: 'Four of a kind! Press Chiếu to claim it, and you’ll draw a replacement tile.',
    win: 'That’s your winning tile! Press Ù, quickly!',
  },
  selfWin: 'You’ve drawn your winning tile! Press Ù!',
  ready: 'Look at that! You’re only one tile away from Ù. Keep an eye on every discard.',
  youWon: 'Ù! You did it! Your very first win at the Saigon table. I’m so proud of you!',
  moments: {
    bonus: 'See the flower beside your tiles? It goes aside face up, and you draw a replacement straight away.',
    flowerJoker: 'That’s a Flower Joker! It’s a bonus tile, so it goes aside just like a flower, and you draw again.',
    joker: 'You’ve got a Khung joker! The Wind Joker stands for any wind, the Dragon Joker for any dragon, and the Number Joker for any suited tile.',
    house: HOUSE,
  },
};

const singapore: CoachScript = {
  welcome:
    'Welcome to Marina Bay! It’s four sets and a pair, with flowers, four cheeky animals, and tai capped at five. Have a look at your tiles while everyone takes theirs.',
  first: FIRST_EAST,
  tips: [
    'You need at least one tai to win. A pung of dragons, your seat wind or the prevailing wind is an easy one.',
    'All pungs, Pong Pong, is worth two tai. And a full colour hand is worth four!',
    'By default the shooter, the player who throws your winning tile, pays for the whole table. So mind what you throw!',
    'Ping Hu, all chows with no bonus tiles, waiting on two different tiles, is worth four tai.',
  ],
  claim: {
    pung: 'Ooh, you can claim that tile! Press Pong to make three of a kind, or Pass if you’d rather keep going. Be quick, the chance is gone once the next player draws.',
    chow: taiwanese.claim.chow,
    kong: 'Four of a kind! Press Kong to claim it. You’ll draw a replacement tile, and collect kong money on the spot!',
    win: taiwanese.claim.win,
  },
  selfWin: 'You’ve drawn your winning tile! Press Zimo, and everyone pays you double!',
  ready: taiwanese.ready,
  youWon: 'Hu! You did it! Your very first win at Marina Bay. I’m so proud of you!',
  moments: {
    bonus: 'See the flower beside your tiles? Bonus tiles go aside face up, and you draw a replacement. A flower with your seat number is worth a tai.',
    animal: 'An animal! It goes aside, worth one tai. Catch its partner, the cat with the mouse or the rooster with the centipede, and everyone pays you on the spot!',
    bite: 'A bite! Your animals have paired up, so everyone pays you right now. Lovely!',
    otherBite: 'Ooh, another player’s animals just bit! Everyone pays them on the spot.',
    kongMoney: 'Kong money! Every kong is paid a little on the spot, and double if it’s concealed.',
    house: 'Singapore tables all play a little differently. This table’s house rules are written just below me, so have a quick look.',
  },
};

const hongkong: CoachScript = {
  welcome:
    'Welcome to Harbour Jade, our Hong Kong table! It’s four sets and a pair, with flowers, and you need three faan to win. Have a look at your tiles while everyone takes theirs.',
  first: FIRST_EAST,
  tips: [
    'Three faan to win here. A dragon pung, a concealed hand and a self-draw together make three.',
    'A half flush, one suit plus honours, is worth three faan all by itself. See if one suit stands out in your hand.',
    'With flowers on, having no flowers at all is a faan, and so is your seat flower.',
    'Up to four faan, each one doubles the points. After that they rise by half steps.',
  ],
  claim: {
    pung: 'Ooh, you can claim that tile! Press Pung to make three of a kind, or Pass to keep your hand concealed. Be quick, the chance is gone once the next player draws.',
    chow: 'That tile fits a run in your hand! Press Sheung to take it. You can only sheung from the player on your left. Be quick, the chance is gone once the next player draws.',
    kong: 'Four of a kind! Press Gong to claim it, and you’ll draw a replacement tile.',
    win: 'That’s your winning tile! Press Sik Wu, quickly!',
  },
  selfWin: 'You’ve drawn your winning tile! Press Zi Mo, and everyone pays you!',
  ready: classic.ready,
  youWon: 'Sik Wu! You did it! Your very first win at the Hong Kong table. Wonderful!',
  moments: {
    bonus: 'See the flower beside your tiles? It goes aside face up, and you draw a replacement. Your own seat flower is worth a faan.',
    house: HOUSE,
  },
};

const mcr: CoachScript = {
  welcome:
    'Welcome to the tournament hall! This is Chinese Official play. You need eight fan to win, not counting flowers, so plan your hand around a pattern. Have a look at your tiles.',
  first: FIRST_EAST,
  tips: [
    'Look for the same run in all three suits. That’s a mixed triple chow, eight fan in one go.',
    'A half flush is six fan, and a full flush is twenty-four. One strong suit can carry a whole hand.',
    'Flowers add a fan each, but they don’t count toward the eight you need.',
    'A concealed hand is two fan, and four if you draw the winning tile yourself.',
  ],
  claim: {
    pung: 'You can call Peng on that tile, for three of a kind. Make sure your hand can still reach eight fan! Or press Pass. Be quick, the chance is gone once the next player draws.',
    chow: 'That tile fits a run! Press Chi to take it, but only from the player on your left. Be quick, the chance is gone once the next player draws.',
    kong: 'Four of a kind! Press Gang to claim it, and you’ll draw a replacement tile.',
    win: 'That’s your winning tile, and your hand has the fan! Press Hu, quickly!',
  },
  selfWin: 'You’ve drawn your winning tile! Press Zimo!',
  ready: 'Look at that! You’re one tile away from winning. Check that your hand will reach eight fan.',
  youWon: 'Hu! You did it! A tournament hand, eight fan and more. I’m so proud of you!',
  moments: {
    bonus: 'A flower! It goes aside face up, and you draw a replacement. It adds a fan, but not toward the eight you need.',
  },
};

const sichuan: CoachScript = {
  welcome:
    'Welcome to the Chengdu teahouse! Only three suits here, and no chow calls. Remember the big rule: your winning hand must be missing one whole suit. Have a look at your tiles.',
  first: 'You’re East, the dealer, so you go first. Pick the suit you hold the fewest of, and start throwing it away. Tap a tile once to lift it, then tap it again to discard.',
  tips: [
    'Keep clearing your missing suit. You can’t win while you still hold all three.',
    'All pungs is a fan, and one suit only is two. Each fan doubles the points.',
    'Four of a kind is a root, worth a fan, and a kong pays you on the spot.',
    'If the wall runs out, players who aren’t ready pay those who are. So try to be ready by the end.',
  ],
  claim: {
    pung: 'Ooh, you can claim that tile! Press Peng to make three of a kind, or Pass if you’d rather keep going. Be quick, the chance is gone once the next player draws.',
    kong: 'Four of a kind! Press Gang to claim it. You’ll draw a replacement tile, and collect kong money on the spot!',
    win: 'That’s your winning tile! Press Hu, quickly!',
  },
  selfWin: 'You’ve drawn your winning tile! Press Zimo, and everyone pays you!',
  ready: 'Look at that! You’re one tile away from winning. Keep an eye on every discard.',
  youWon: 'Hu! You did it! Your very first win at the Chengdu teahouse. Wonderful!',
  moments: {
    kongMoney: 'Wind and rain! A kong pays on the spot: ten from each player for an open kong, twenty for a concealed one.',
  },
};

const malaysian: CoachScript = {
  ...singapore,
  welcome:
    'Selamat datang, and welcome to Penang! It’s four sets and a pair, with flowers and four cheeky animals. Seven pairs counts here too. Have a look at your tiles while everyone takes theirs.',
  tips: [
    'You need at least one tai to win. A pung of dragons or your seat wind is an easy one.',
    'Seven pairs is worth three tai at our Malaysian table. Hold on to your pairs!',
    'Win on a discard, and the discarder pays double while the others pay single.',
    'All pungs, Pong Pong, is worth two tai, and each animal adds one.',
  ],
  youWon: 'Hu! You did it! Your very first win at the Penang table. I’m so proud of you!',
  moments: { ...singapore.moments, house: 'Malaysian tables all play a little differently. This table’s house rules are written just below me, so have a quick look.' },
};

const uaeTaiwanese: CoachScript = {
  ...taiwanese,
  welcome:
    'Welcome to Jumeirah Jade, our Dubai Taiwanese table! Sixteen tiles, five sets and a pair, and you need at least one tai to win. Have a look while everyone takes their tiles.',
  youWon: 'Hu! You did it! Your very first win at Dubai Taiwanese. Wonderful!',
  moments: { ...taiwanese.moments, house: HOUSE },
};

const uaeAmerican: CoachScript = {
  ...american,
  welcome:
    'Welcome to the Creek Card Room, our Dubai American table! You play from JongClub’s card, with jokers and the Charleston. And if nobody wins, a goulash follows, where jokers may be passed.',
  youWon: 'Mah Jongg! You did it! Your very first win at Dubai American. Wonderful!',
  moments: { ...american.moments, house: HOUSE },
};

const uaeCustom: CoachScript = {
  ...uae,
  welcome:
    'Welcome to the Majlis, our custom UAE table! It’s four sets and a pair, and the host has chosen every house rule. Have a look at your tiles while everyone takes theirs.',
  youWon: 'Mahjong! You did it! Your very first win at the custom UAE table. Wonderful!',
};

const korean: CoachScript = {
  welcome:
    'Welcome to Seoul Indigo! Just three of us at this table, with a smaller set. There’s no chow call, and you need two points to win. Flowers pay, but they don’t count toward those two. Have a look at your tiles.',
  first: FIRST_EAST,
  tips: [
    'Keep your hand concealed if you can. Concealed is a point, and a self-draw adds another.',
    'A pung of dragons, your seat wind or the round wind is a point. A pair of dragons is worth keeping.',
    'Only the one and nine of Characters are in this set, so watch the Dots and Bamboo closely.',
    'With only two opponents, a discard win is paid by the discarder alone. Mind what you throw!',
  ],
  claim: {
    pung: 'You can claim that tile! Press Pung for three of a kind, but check you’ll still reach two points with an open hand. Or press Pass. Be quick, the chance is gone once the next player draws.',
    kong: 'Four of a kind! Press Kong to claim it, and you’ll draw a replacement tile from the back of the wall.',
    win: 'That’s your winning tile, and your hand has the points! Press Mahjong, quickly!',
  },
  selfWin: 'You’ve drawn your winning tile! Press Mahjong, and both players pay you!',
  ready: 'Look at that! You’re one tile away from winning. If your hand is concealed, you can declare riichi for a free point.',
  youWon: 'Mahjong! You did it! Your very first win at the Seoul table. Wonderful!',
  moments: {
    bonus: 'A flower! It goes aside face up, and you draw a replacement. It pays a point, but doesn’t count toward the two you need.',
    riichi: 'You’re ready, and your hand is closed! Press Riichi, then pick the tile to turn sideways. It costs nothing here, and it’s worth a point.',
    riichiDone: 'Riichi! Your hand is locked now. Every tile you draw goes straight back out, unless it’s the one that wins.',
    otherRiichi: 'Another player just declared riichi! They’re one tile away. Play it safe, and throw tiles they’ve already thrown themselves.',
  },
};

export const SCRIPTS: Record<string, CoachScript> = {
  classic,
  riichi,
  taiwanese,
  american,
  uae,
  vietnamese,
  indian,
  singapore,
  hongkong,
  mcr,
  sichuan,
  malaysian,
  korean3: korean,
  // Three-player tables share their four-player game's script (no chi call ever comes up in Sanma).
  sanma: riichi,
  malaysian3: malaysian,
  'uae-taiwanese': uaeTaiwanese,
  'uae-american': uaeAmerican,
  'uae-custom': uaeCustom,
};

export const scriptFor = (variation: string): CoachScript => SCRIPTS[variation] ?? classic;

/**
 * Guided games that follow a lesson: Mei plays a Classic hand with you and
 * uses that lesson's words and customs as they come up. Each replaces the
 * table's welcome, tips and key lines; the rest comes from the table's script.
 */
const THEMES: Record<string, Partial<CoachScript>> = {
  // Level 3, Words at the table: every word, named at the moment it happens.
  words: {
    welcome:
      'Welcome back! This hand is all about the words you just learned. I’ll name things as they happen, so the words stick. Your tiles are your concealed hand, hidden from everyone else.',
    first:
      'You’re East, the dealer, so you go first. The gold tile is the one you just drew. Now discard, which means throw one tile away. Tap it once to lift it, then tap it again.',
    tips: [
      'Look at your suits: Characters, Dots and Bamboo. Twos to eights are simples. Ones and nines are terminals. Winds and dragons are honours.',
      'The tiles thrown into the middle are the discards. Japanese players call that the river.',
      'Two matching tiles make a pair. In Chinese, the pair is called the eyes. Every winning hand needs one.',
      'Your seat wind is the wind of your chair. The round wind is East this hand. If you sit East too, a pung of East counts for both, so it scores twice!',
      'A finished set is a meld once it’s face up. A chow is Chi, a pung is Peng or Pon, and a kong is Gang or Kan.',
      'Count your blocks: sets, half-sets and pairs. You want four sets and a pair, and then you can call Mahjong, or Hu.',
    ],
    claim: {
      chow: 'You can chow! A chow is a run of three, called Chi in Chinese and Japanese. You can only chow the tile from the player on your left.',
      pung: 'You can pung! Three of a kind, called Peng in Chinese and Pon in Japan. Calling it makes it a meld, face up for everyone to see.',
      kong: 'You can kong! Four of a kind, called Gang or Kan. You’ll draw a replacement tile straight after.',
      win: 'That tile wins your hand! Winning on a discard is called Ron in Japan. Tap Mahjong!',
    },
    selfWin: 'You drew your winning tile yourself! That’s a self-draw: Tsumo in Japan, Zimo in Chinese. Tap Mahjong!',
    ready: 'Your hand is ready! One more tile wins. In Japan that’s tenpai, and the tiles that would finish it are your wait.',
    youWon: 'Mahjong! You won. Hu, as they say in Chinese. And now you know the words for every part of it.',
    end: 'Lovely playing! Draw, discard, meld, wait, and Hu. You can talk Mahjong at any table now. Shall we carry on with the lessons?',
  },
  // Level 8, Tradition and etiquette: the customs of the table, as they come up.
  tradition: {
    welcome:
      'Welcome to the table! This time, let’s play like a proper club. The tiles have been washed and the wall is built. Sit tall, keep a steady pace, and enjoy the company.',
    first:
      'You’re East, so you open the hand. At a real table, you’d name your discard as you throw it, so everyone hears. Tap a tile once to lift it, then again to discard.',
    tips: [
      'Look at your Dots: the old copper coins, round with a square hole. The Bamboo are strings of coins, and the Characters are ten thousands.',
      'Keep a steady pace. A good player never keeps the table waiting.',
      'Once a tile is discarded, it stays down. Down is down, at every good club.',
      'Have a look at the one of Bamboo. That little bird is the sparrow, one of Mahjong’s oldest names.',
      'The dragons have meanings too. Red is the centre, Green is to prosper, and White is a clean blank board.',
      'Remember, never touch another player’s tiles, and only discard on your own turn. That’s the club spirit.',
    ],
    claim: {
      chow: 'You can chow! At a club, call it out clearly: Chow! Then take the tile and lay your run face up.',
      pung: 'You can pung! Call it out clearly, so everyone hears: Pung! A good call is loud and quick.',
      kong: 'You can kong! Call it clearly, lay all four face up, and draw a replacement tile.',
      win: 'That tile wins your hand! Call Mahjong clearly, and lay your tiles out for the table to see.',
    },
    selfWin: 'You drew your winning tile yourself! Call Mahjong, and show your hand to the table.',
    ready: 'Your hand is ready, one tile from winning. Stay calm and keep the pace, so nobody can read it on your face.',
    youWon: 'Mahjong! Beautifully played. Now, as every good sport does, thank the table.',
    end: 'Thank you for a lovely game! Four friends, one table, and a little luck and skill. That’s what Mahjong is all about. Shall we carry on with the lessons?',
  },
};

/** A table's script, with a lesson's theme laid over it. */
export const themedScript = (variation: string, theme?: string): CoachScript => {
  const base = scriptFor(variation);
  const t = theme ? THEMES[theme] : undefined;
  return t ? { ...base, ...t, claim: { ...base.claim, ...t.claim } } : base;
};


function scriptLines(s: CoachScript): string[] {
  return [
    s.welcome,
    s.first,
    ...s.tips,
    ...(s.charleston ?? []),
    ...Object.values(s.claim),
    s.selfWin,
    s.ready,
    s.youWon,
    ...Object.values(s.moments ?? {}),
    s.end,
  ].filter((l): l is string => !!l);
}

/** Every line the coach can say, at every table, for recording. */
export function coachLines(): string[] {
  const out = new Set<string>();
  for (const s of [...Object.values(SCRIPTS), ...Object.keys(THEMES).map((k) => themedScript('classic', k))]) for (const l of scriptLines(s)) out.add(l);
  for (const l of Object.values(SHARED)) out.add(l);
  return [...out];
}

export interface TurnInfo {
  ready: boolean;
  canWin: boolean;
  /** JongBot's advice text, shown under the line. */
  hint?: string;
  afterClaim?: boolean;
  /** You are the dealer making the hand's first discard. */
  dealer?: boolean;
  /** Riichi can be declared with this discard. */
  canRiichi?: boolean;
  /** A joker on the table can be swapped for a tile in your hand. */
  canSwap?: boolean;
  /** Jokers (wild tiles) in your hand. */
  jokers?: number;
}

/**
 * Mei's commentary for one guided hand. The match calls the event methods;
 * the coach decides what is worth saying and shows it as a caption panel.
 */
export class TutorialCoach {
  readonly el: HTMLElement;
  /** The guided game stops the clock; coach mode at an ordinary table keeps the table's pace. */
  readonly keepsPace: boolean = false;
  readonly script: CoachScript;
  private text: HTMLElement;
  private extra: HTMLElement;
  private said = new Set<string>();
  private turns = 0;
  private tip = 0;
  private wasReady = false;
  private muted = false;
  private current = '';
  /** Moments waiting for your next turn (the flower dealt to you, the house rules...). */
  private pending: { line: string; extra: string }[] = [];

  constructor(
    readonly variation: string = 'classic',
    readonly theme?: string,
  ) {
    this.script = themedScript(variation, theme);
    this.text = h('p', { class: 'coach-text' });
    this.extra = h('p', { class: 'coach-extra' });
    const replay = h('button', { class: 'coach-btn', title: tr('Hear that again'), 'aria-label': tr('Hear that again'), onclick: () => this.current && narrator.say(this.current), html: icon('replay') });
    const mute = h('button', { class: 'coach-btn', title: tr('Turn Mei’s voice on or off for this game'), 'aria-label': tr('Mei’s voice'), 'aria-pressed': 'true', html: icon('speaker') });
    mute.onclick = () => {
      this.muted = !this.muted;
      mute.innerHTML = icon(this.muted ? 'speakerOff' : 'speaker');
      mute.setAttribute('aria-pressed', String(!this.muted));
      if (this.muted) {
        this.queue = [];
        narrator.stop();
      }
    };
    // Hide folds the guide into Mei's portrait, off the table; tapping her brings it back (her voice carries on unless muted).
    const hide = h('button', { class: 'coach-btn coach-hide', title: tr('Hide Mei’s guide'), 'aria-label': tr('Hide Mei’s guide'), html: icon('chevronDown') });
    const portrait = h('button', { class: 'narrator', type: 'button', tabindex: '-1', title: tr('Show Mei’s guide'), 'aria-label': tr('Show Mei’s guide') }, 'M');
    this.el = h(
      'aside',
      { class: 'coach', 'aria-live': 'polite' },
      portrait,
      h('div', { class: 'coach-body' }, h('div', { class: 'coach-head' }, h('p', { class: 'eyebrow' }, tr('Guided game · Mei')), replay, mute, hide), this.text, this.extra),
    );
    const tuck = (on: boolean) => {
      this.el.classList.toggle('tucked', on);
      portrait.tabIndex = on ? 0 : -1;
      this.el.dispatchEvent(new Event('coach-tuck', { bubbles: true }));
    };
    hide.onclick = (e) => {
      e.stopPropagation();
      tuck(true);
    };
    portrait.onclick = () => this.el.classList.contains('tucked') && tuck(false);
    this.el.hidden = true;
    // In the table's corner dock long lines show five lines at a time; a tap shows all of it.
    this.text.title = tr('Tap to read all of it');
    this.text.addEventListener('click', () => this.el.classList.toggle('open'));
  }

  protected say(line: string | undefined, extra = '', once = true, urgent = false) {
    if (!line || (once && this.said.has(line))) return false;
    this.said.add(line);
    if (this.muted || !this.speaking || urgent) this.show(line, extra);
    if (!this.muted) this.voice(line, extra, urgent);
    return true;
  }

  private show(line: string, extra: string) {
    this.current = line;
    // Touch screens are tapped, not clicked (the recorded voice keeps the script's words).
    const touch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
    this.text.textContent = touch ? line.replace(/\bClick\b/g, 'Tap').replace(/\bclick\b/g, 'tap').replace(/\bclicking\b/g, 'tapping') : line;
    this.extra.textContent = extra;
    this.extra.title = extra;
    this.el.hidden = false;
    this.el.classList.remove('pop', 'open');
    void this.el.offsetWidth;
    this.el.classList.add('pop');
  }

  private speaking = false;
  private run = 0;
  /** Lines waiting for Mei to finish (at most two; the oldest is dropped). */
  private queue: { line: string; extra: string }[] = [];

  /** Let the current line finish (up to two lines wait their turn); urgent lines cut in. */
  private voice(line: string, extra: string, urgent: boolean) {
    if (this.speaking && !urgent) {
      this.queue.push({ line, extra });
      if (this.queue.length > 2) this.queue.shift();
      return;
    }
    if (urgent) this.queue = [];
    this.speaking = true;
    const run = ++this.run;
    this.show(line, extra);
    void narrator.say(line).then(() => {
      if (run !== this.run) return;
      this.speaking = false;
      const n = this.queue.shift();
      if (n && !this.muted) this.voice(n.line, n.extra, false);
    });
  }

  /** A caption-only update (no new line spoken). */
  protected note(extra: string) {
    this.extra.textContent = extra;
    this.extra.title = extra;
  }

  /** Keep a moment for your next turn, when there's room to talk about it. */
  private later(line: string | undefined, extra = '') {
    if (!line || this.said.has(line) || this.pending.some((p) => p.line === line)) return;
    this.pending.push({ line, extra });
  }

  /** The hand begins. `house` lists this table's house rules for the caption. */
  handStart(info: { house?: string } = {}) {
    this.say(this.script.welcome);
    if (info.house) this.later(this.script.moments?.house, info.house);
  }

  /** Your turn to discard. */
  myTurn(info: TurnInfo) {
    this.turns++;
    const m = this.script.moments ?? {};
    const extra = info.hint ? `JongBot: ${info.hint}` : '';
    if (info.canWin && this.say(this.script.selfWin, extra, true, true)) return;
    if (info.canRiichi && this.say(m.riichi, extra, true, true)) return;
    if (info.canSwap && this.say(m.swap, extra, true, true)) return;
    if (info.afterClaim && this.say(SHARED.youCalled, extra)) return;
    if (this.turns === 1 && this.say(info.dealer === false ? SHARED.firstLater : this.script.first, extra)) return;
    if (info.jokers) this.later(m.joker);
    if (info.ready && !this.wasReady) {
      this.wasReady = true;
      if (this.say(this.script.ready, extra)) return;
    }
    const p = this.pending.shift();
    if (p && this.say(p.line, [p.extra, extra].filter(Boolean).join(' · '))) return;
    // A tip on every other turn, until they run out.
    const tips = this.script.tips;
    if (this.turns % 2 === 0 && this.tip < tips.length && this.say(tips[this.tip++], extra)) return;
    this.note(extra);
  }

  /** Your turn starts and you take your own tile: said the first time only. */
  drawPrompt() {
    this.say(SHARED.draw, '', true, true);
  }

  /** You may claim the last discard. */
  claimOffer(kinds: ClaimKind[]) {
    const order: ClaimKind[] = ['win', 'kong', 'pung', 'chow'];
    const k = order.find((x) => kinds.includes(x) && this.script.claim[x]);
    if (k) this.say(this.script.claim[k], '', k !== 'win', true);
  }

  /** A bonus tile (flower, animal, Flower Joker) of yours was set aside. Said on your next turn. */
  bonusTile(kind: number) {
    const m = this.script.moments ?? {};
    const line = isAnimal(kind) ? (m.animal ?? m.bonus) : kind === FLOWER_JOKER ? (m.flowerJoker ?? m.bonus) : m.bonus;
    this.later(line, `Set aside: ${tileName(kind)}`);
  }

  /** The Charleston: your turn to choose three tiles for pass `stage` (0 to 5). */
  charleston(stage: number) {
    // Each pass is its own instruction, so it cuts in rather than queueing behind the last one.
    this.say(this.script.charleston?.[stage], '', true, true);
  }

  /** The vote on a second Charleston. */
  charlestonVote() {
    this.say(this.script.moments?.vote, '', true, true);
  }

  /** Someone declared riichi. */
  riichi(you: boolean) {
    this.say(this.script.moments?.[you ? 'riichiDone' : 'otherRiichi'], '', true, you);
  }

  /** A new dora was turned over (after a kong). */
  newDora(detail = '') {
    this.say(this.script.moments?.dora, detail);
  }

  /** Something was paid on the spot: an animal bite or kong money. `detail` is for the caption. */
  instantPaid(kind: 'bite' | 'kong', you: boolean, detail = '') {
    const m = this.script.moments ?? {};
    this.say(kind === 'kong' ? m.kongMoney : you ? m.bite : m.otherBite, detail);
  }

  /** Someone else discarded (the first one gets a word about the callers). */
  otherDiscard() {
    if (this.turns >= 1) this.say(SHARED.announce);
  }

  otherClaimed() {
    this.say(SHARED.otherCalled);
  }

  handEnd(outcome: 'you' | 'other' | 'draw') {
    this.pending = [];
    this.say(outcome === 'you' ? this.script.youWon : outcome === 'other' ? SHARED.otherWon : SHARED.drawn, '', false, true);
  }

  /** The closing line, for the results screen. */
  finish() {
    this.say(this.script.end ?? SHARED.end, '', false, true);
  }

  stop() {
    this.muted = true;
    this.queue = [];
    this.pending = [];
    narrator.stop();
  }
}
