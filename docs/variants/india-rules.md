# India Rules (from the Mahjong Calling rulebook)

Source: the user's "MC-Rulebook / Founder Note" PDF (44 pages, Mahjong Calling, uploaded 2026-10-23,
copy in /mnt/project-files/uploads/hearth/). The book is written for a deck of cards; JongClub plays the
same rules with tiles ("card" in the book = "tile" here). Page numbers are the book's own.
The user asked (2026-10-23): rename "Mumbai" to "India Rules", make it the default game, and let a
player choose any one of the four rounds or all four.

Readings marked **[reading]** are JongClub's where the book is silent or unclear; questions sent to the user
are marked **[asked]**.

## Equipment and terms (pp. contents, 1-4)
- 144 tiles: three suits 1-9 (Cracks = characters, Bamboos, Rings = dots), winds E S W N, dragons
  Red, Green, White, four flowers and four seasons numbered 1-4.
- 55 Small Cards and 29 Big Cards (hand instructions). 2 dice.
- Starting points: 35,000 each (2 x 10,000, 9 x 1,000, 10 x 500, 10 x 100).
- Terminals = 1 and 9. Majors = honours + terminals. Minors = 2-8.
- Corresponding Dragons (CD): Cracks - Red, Bamboos - Green, Rings - White.
- Sets: Pung (claim from anyone with a pair in hand); Chow/Run (pure sequence, claim from the left only);
  Pure pair; Crochet (same number in the 3 suits); Knit (same number in 2 suits); Mixed Chow/Run
  (a sequence across the 3 different suits); Kong (four of a kind, extra card from the flower wall);
  Qwong (five of a kind using jokers, North round only, two extra cards).
- Mixed Bouquet = flowers/seasons numbered 1, 2, 3, 4 mixed. Pure Bouquet = all four flowers or all four seasons.
- Green Bamboos = 2, 3, 4, 6, 8 of Bamboos. Red Bamboos = 1, 5, 7, 9 of Bamboos.
- Ulta Pulta = Bamboos 2, 4, 5, 6, 8, 9 + Rings 1, 2, 3, 4, 5, 8, 9 (+ White Dragon in Big Card 19).

## The match (p. 5-6)
- A full game is 16 games: 4 rounds x 4 games, each player East (dealer) once per round.
  1 East round (Passport variations), 2 South round (Small Cards), 3 West round (Goulash),
  4 North round (East's choice: Passport, Small Cards with jokers, Goulash with jokers, or Big Cards).
  JongClub offers every mix of rounds (15 choices, house rule indiaRounds), always in wind order.
- Deal: East 14, others 13. Flowers/seasons are put aside face up and replaced from the flower wall,
  starting with East (face down in the West round).
- Play runs E, S, W, N. Priority on one discard: Mahjong, then Pung, then Chow. Two Mahjong calls:
  the player next in turn wins.
- Mixed chow, pair, knit and crochet can't be taken from a discard except to Mahjong. Displayed sets
  can't be changed. For Mahjong a discard may be taken from anyone for any set.
- Wrong Mahjong: the player is "dead" (plays on, can't win). JongClub only lets a real win be declared,
  so this never arises. Wrong tile count: dead.

## Classic (the user, 2026-10-25; not in the book)
- A play style: the East round's game in all four rounds, without passports. Four sets and a pair; sets may be
  pungs, kongs, chows, mixed chows and crochets; a knit is the pair only with a crochet (book p. 7; the user's
  notes of 2026-10-25 say a mixed chow; decision card asked). East-round payments and flowers.
- Built v136: house rule indiaRounds 'C' (india.ts CLASSIC, CLASSIC_GUIDE); tests in test/india-big.test.ts.
- Calls (book p. 6, confirmed by the user 2026-10-25): pairs, mixed chows, knits and crochets are never
  called from a discard; only pung, kong and a pure chow from the left are, and any tile to Mahjong.

## Round 1, East: Passport (pp. 7-11)
- Hand = 3+3+3+3+2. Sets: Pung, Chow, Mixed Chow, Crochet. Pair: pure pair, or a Knit only if the hand has a Crochet.
- Passport variations may replace sets; the table may make a passport compulsory to win.
  - JongClub (the user, 2026-10-24): compulsory by default; the optional way stays as a table setting.
- 9-card passports: 3 pungs in 3 different suits; 3 pungs in the same suit; 3 chows in 3 different suits;
  3 chows in the same suit; 3 crochets; 3 mixed chows.
- 6-card passports: 3 pairs in the same suit; 3 pairs in 3 different suits; 3 knits in the same 2 suits.
- 5-card passports: pung of any honour + pair of any honour; NEWS + another wind; GRW + an honour pair;
  crochet + knit.
- Combinations: 5+3+3+3, 6+3+3+2, 9+3+2, 5+6+3, 6+6+2, 9+5. The 2 is any pure pair (knit only with a crochet).
  The 3s after a passport: chow, mixed chow, pung (any suit or honour), crochet.
- Payments: winner gets 500 from each player; East pays 1000; if East wins everyone pays East 1000
  (East always gives and receives double).
  Normal hand 500 / 1000 (East). Concealed hand (all from the wall, only the last tile from a discard)
  1000 / 2000. Fully concealed (last tile self-drawn too) 2000 / 4000.
- Flowers, paid by all players even on a draw, East pays the same (not double):
  pair of own flower+season or pair of the round's flower+season 500; mixed bouquet 500; pure bouquet 1000.

## Round 2, South: Small Cards (pp. 12-25)
- After flowers are replaced every player draws a Small Card in secret (table rule: draw 3, keep 1).
- Compulsory exchange, 3 tiles each time, given blind and together:
  1. East-South and West-North; 2. East-North and South-West; 3. East-West and South-North.
- Then East may Tic-Tac-Toe (optional), once or three times: each player puts one tile face down in front
  of each other player (East first, then South, West, North); each picks up the three in front of them.
- Then East may order a wall exchange (optional), once or three times: each player puts 3 tiles face down
  and takes any 3 from the wall (not the flower wall, not the starting pile of 7, not their own pile);
  the put-down tiles are mixed back into the wall.
- Buying: a player may buy the discard of the player on their left for 100 points; it stays concealed and
  can be used in any set. The buy money goes to the winner of that game; on a draw it stays for the next winner.
- Claims as usual unless the card says "All cards from wall": then no discard may be taken, not even to
  Mahjong (buying still allowed).
- Payment per the card; East pays and receives double: Half limit 500/1000, Limit 1000/2000,
  Double limit 2000/4000, Super limit 4000/8000, Top limit 10000/20000. Flowers paid as in the East round.
- Draw: East keeps the deal, the buy money waits for the next winner, and an extra game is played in the
  round (another Small Card game or a Goulash game).
- The 55 Small Cards (value, then the hand):
  1 Lily of the Valley, double: pungs of Green and White dragons, 2 pungs of green bamboos, pair of green bamboos.
  2 Red Lily, double: pungs of Red and White dragons, 2 pungs of red bamboos, pair of red bamboos.
  3 Unique Wonders, double: 1 and 9 of each suit, NEWS, GRW, plus one more of any of them.
  4 Royal Ruby, double: pung of Red dragons, 3 pungs of red bamboos, pair of red bamboos.
  5 Imperial Jade, double: pung of Green dragons, 3 pungs of green bamboos, pair of green bamboos.
  6 Four Blessings, double: pungs/kongs of E, S, W, N + any pair (suit or dragon).
  7 Hitler's Blunder, limit: pung of any dragon, NEWS, 1-7 in one suit.
  8 Heavenly Twins, limit: seven pairs in one suit.
  9 Silly Bee, limit, all from wall: a chow in each suit, one mixed chow, pair (any minor, wind or dragon; not 1 or 9).
  10 Western Command, limit: any 3 pungs, one chow, a pair.
  11 Gertie's Garter, limit: 1-7 in two suits.
  12 Sparrows Sanctuary, limit: two pairs of 1 Bamboo and a pair of each green bamboo (2, 3, 4, 6, 8).
  13 Mixed Pung, limit, all from wall: 4 pungs and a pair either in one suit with honours, or 3 pungs in 3
     different suits + 1 pung of any suit/honour + any pair.
  14 Roberts, limit, all from wall: Red + Green dragon (one each) or 2 White dragons, and 4 mixed chows.
  15 Eternal Triangle, limit: NEWS + GRW + one more honour + a pair in each suit.
  16 Three Philosophers: GRW + a pair of winds + a chow in each suit; limit if the pair is your own wind,
     half limit otherwise.
  17 Red Lantern: pung of Red, pung of own wind, 1-7 in one suit with one of the run paired;
     limit if punged, double limit if concealed.
  18 Mixed Blossom, limit: pung of Red + pair of Green (or Green pung + Red pair) + 3 mixed chows.
  19 Apple Blossom, limit: pung of White, pair of Green, 3 mixed chows.
  20 Windy Chows: a chow in each suit, NEWS + one more wind; limit if the extra wind is your own, half limit otherwise.
  21 All Pair Ruby Jade Hand, limit: seven pairs from red and green bamboos, with a pair of Red and a pair of Green dragons.
  22 Ringlet, limit, all from wall: a pung (honours allowed), a chow, a mixed chow, a crochet and a knit.
  23 All Winds and Dragons, limit: 4 pungs/kongs and a pair of winds and dragons.
  24 Golden Staircase, limit: 1-9 in one suit, a concealed pung of a dragon or wind (never from a discard,
     even to Mahjong), a pair of winds or dragons.
  25 Buried Treasure, limit, all from wall: chows and pungs in one suit with winds and dragons, no kongs.
  26 All Pair Jade Hand, limit, all from wall: pair of Green dragons + a pair of each green bamboo + one repeated pair.
  27 A Run, A Pung and A Pair, limit: 1-9, a pung and a pair, all in one suit.
  28 Dragon Fly: GRW + a pung in each suit + a suit pair; limit if concealed, half limit if punged from a discard.
  29 Buried Treasure, double, all from wall: all hidden pungs and a pair, anything mixed.
  30 Greta's Garden, limit: NEWS + GRW + 1-7 in one suit.
  31 Three Scholars, limit: pungs/kongs of all three dragons + a pung/kong/chow + a pair (suit or wind).
  32 Wriggly Snake, limit: NEWS + 1-9 in one suit + one of them paired.
  33 Seventh Heaven, limit: NEWS + GRW + 1-7 in one suit (same as 30).
  34 Windy Chee, limit: a chow in each suit, NEWS, and one more of your own wind or the round wind.
  35 Knitting, limit: seven knits in the same 2 suits (numbers may repeat).
  36 Dragon Fly, limit: a pung of a dragon + one each of the other two dragons + 3 mixed chows.
  37 Hovering Angels, limit: pung of own wind or round wind, a pair of dragons, a chow in each suit.
  38 Windy Wonders, limit: a pung of winds, a pair of winds, 3 mixed chows.
  39 Windy Dragons, limit: 2 dragon pungs + a pair of each wind; only dragons may be punged; the pairs come from the wall, even to Mahjong.
  40 Gates of Heaven, limit: one suit: pung of 1s, pung of 9s, 2-8 and one more of 2-8.
  41 All Pair Major Hand, limit: 7 pairs of majors.
  42 Chinese Odds, limit: 4 pungs and a pair of odd numbers in one suit.
  43 Heads and Tails, limit: 4 pungs of 1s and 9s (any suits) and a pair of winds.
  44 Purity Hand, limit: 4 pungs and a pair in one suit, no honours.
  45 A Joker Hand, half limit, all from wall: any hand; scored as a Goulash hand if it is one, as another
     Small Card if it makes one, otherwise any 3+3+3+3+2.
  46 All Honour Hand, limit: 4 pungs and a pair of 1s, 9s, winds and dragons; terminals of one suit only.
  47 Ordinary Suit Hand, limit: 4 pungs/kongs in one suit with winds/dragons and a pair; one chow in that suit allowed.
  48 Windy Ones: NEWS + one more wind + pungs of 1s in all three suits; half limit if punged, limit if concealed.
  49 Windy Nines: as 48 with 9s.
  50 All Pair Hand, half limit: seven pairs in one suit with winds and/or dragons.
  51 Triple Knitting (Crochet), half limit: 4 crochets and a knit.
  52 Little Bastard, half limit: a chow in each suit, a mixed chow, a pair of 1s or 9s.
  53 Bomb Shell, half limit: chows of the same numbers in the 3 suits, GRW, a pair of winds.
  54 Little Robert, half limit: 3 chows, a pung and a pair in one suit; may use a pair of own wind (then a
     discard may be punged); otherwise all from wall.
  55 Dirty Pairs, half limit: any 7 pairs.
- Built (2026-10-23): src/engine/rules/indiaCards.ts (all 55 cards), southRound in india.ts,
  test/india-south.test.ts. JongClub's readings:
  - **[reading]** The four players are dealt four different cards from the 55, shuffled from the hand's seed.
    Your card shows on a pill above your rack; the others stay secret until Mahjong.
  - **[reading]** "All from the wall" blocks every claim, including the winning discard. Other cards allow
    only the claims their text names (for example a pung of own wind).
  - **[reading]** Pairs in all-pair hands must be different tiles. "Own wind" and "round wind" values use the
    seat and prevailing winds of that hand.
  - **[reading]** A Joker Hand pays another card's value when it makes one, otherwise half limit.
  - **[reading]** Half limit 500, limit 1000, double limit 2000, everyone pays the winner, East double.
    Flowers and seasons pay as in the East round.
  - "Draw 3, keep 1" is built (2026-10-24): each player is offered three cards after the deal and keeps one
    (at least 90 s at a timed table, no limit untimed or in lessons). East's Tic-Tac-Toe and wall exchanges are
    asked one step at a time: 0 or 1, then 1 or 3, for each. Buying from the left was built by the JongBot thread.
  - Not built yet: the card
    descriptions are English in every language for now. Bots chase their card from the wall and rarely claim.

## Round 3, West: Goulash (pp. 26-29, chart pp. 41-42)
- Same compulsory exchange as South; East may Tic-Tac-Toe and order wall exchanges. Flowers kept face down.
- Only pungs, kongs and one pure pair. No chows, crochets, knits, mixed chows. No buying.
- Discards may be taken for a pung or kong, and the last tile for Mahjong. After punging from a discard,
  the 4th tile can't be taken from a discard (kong from the wall only). A kong from a discard is exposed;
  a kong from the wall is concealed. A concealed kong must be shown once the player has 3 exposed
  pungs/kongs; flowers are then shown too.
- Penalty: when a player has 3 exposed pungs/kongs and another player throws their Mahjong tile, the
  thrower pays for all players (unless the thrower is also calling, i.e. one tile from Mahjong); no other
  player gets a count.
- Minimum 3 doubles to Mahjong. Points only count for a clean hand: one suit with honours (with an honour
  pung/kong; no double for that), or an honour hand with terminal pungs in one suit (major hand), or a
  terminal hand (pungs/kongs of 1s and 9s in any suits). A hand with more than one suit is dirty: no points.
- Doubles: 1 each: both terminal pungs (1s and 9s) in one suit; honour hand with terminal pungs in one suit;
  each dragon pung; 3 wind pungs; 3 concealed pungs; Mahjong on the last tile of the wall; all 3 dragon pungs
  (+1 more, 4 in all); own flower/season (each); round flower/season (3) (each); own wind pung; round wind
  pung (West). 2 each: 4 concealed pungs; 3 exposed kongs; 4 wind pungs (4 in all with own and round wind).
  3 each: all honours; clean suit (one suit, no honours); 3 concealed kongs; concealed Mahjong with pungs and
  kongs; 4 exposed kongs; terminal hand; bouquet (1-4 of flowers or seasons). 4: 4 concealed kongs.
  7: 4 wind pungs and a pair of dragons. 8: Earth's Blessing (Mahjong on East's first discard).
  9: Heaven's Blessing (East is dealt Mahjong).
- Points: pung minor 2 exposed / 4 concealed; pung major 4 / 8; kong minor 8 / 16; kong major 16 / 32;
  each flower/season 4; pair of majors 2. Mahjong +20.
- Score = points x 2^doubles (the Goulash Scoring Chart, 2-100 points by 1-10 doubles).
- East pays and receives double; the winner pays nobody; every player with a clean hand gets a score unless
  the penalty was paid; at least one pung/kong is needed for a count. An honour hand can't end with a
  terminal pair, and a suit hand can't end with an honour pair (needs an honour pung).

- Built (2026-10-23): src/engine/rules/indiaWest.ts, test/india-west.test.ts. JongClub's readings:
  - **[reading]** A dirty hand (more than one suit, not a terminal hand) can't go Mahjong at all, since its
    points don't count; the book's notes 8 and 9 point the same way.
  - **[reading]** "Concealed Mahjong" = no exposed pung or kong (the last tile may come from a discard).
    A pung completed by the winning discard counts as exposed.
  - **[reading]** 4 wind pungs with a dragon pair is worth 7 doubles in place of the 2 for 4 wind pungs;
    own and round wind pungs still add theirs. 4 concealed pungs replaces 3 concealed pungs, and the same for kongs.
  - **[reading]** Doubles stop at 10, where the Scoring Chart ends. Points are not capped. One hand can
    therefore pass the 35,000 starting points (the chart goes to 102,400).
  - **[reading]** A losing hand's count: its pungs and kongs (declared, or three of a kind in hand), one major
    pair, flowers; clean by the same test over every tile it holds; at least one pung or kong. Each other loser
    pays it (East double), the winner pays nobody. On a draw nobody scores.
  - **[reading]** A wall exchange takes three tiles from random places in the live wall and puts the
    player's three tiles in their places (mixing them back in). A flower taken is set aside and replaced.
  - **[reading]** Tic-Tac-Toe: the three tiles chosen go right, across and left, in the order picked.
  - Flowers lie face down on opponents' racks until Mahjong or that player's third exposed set.
  - Not built yet: the rule that a pung taken from a discard can't become a kong from a discard (JongClub
    never lets a discard turn an exposed pung into a kong anyway), and showing a concealed kong after
    3 exposed sets (concealed kongs are already on the table).

## Round 4, North: East's choice (pp. 30-40)
- Before each game East picks: East round (passport may be made compulsory; East-round scoring, no exchange),
  Small Cards with jokers, Goulash with jokers, or Big Cards. Exchanges as in the South round for all but East.
- Small Cards with jokers: flowers/seasons are jokers (not replaced, not paid); one Small Card each;
  jokers stand for anything; buying allowed; scoring per card. Usually the double-limit cards, but the table
  may use all.
- Goulash with jokers: East names a number; that number in the 3 suits is wild (one of each per player);
  same rules and scoring as the West round; no buying. A pair of the joker number can't be held unless used
  as a pung or pair. A pung from a discard needs a natural pair in hand. Jokers may make a kong, a pair or
  a pung to Mahjong, or a pung drawn from the wall.
- Big Cards: East picks one Big Card for everyone. Discard claims as before, buying from the left allowed,
  a bought or drawn tile may replace a joker in an exposed set, a discard may replace a joker only to Mahjong,
  "clean" sets may not use jokers. Qwong = 5 of a kind with a joker, 2 extra tiles. Flowers used as jokers
  are not replaced. Payment: normal 1000/2000 (East), concealed 2000/4000; flowers paid unless jokers.
- Built (2026-10-24, stage 4): East's choice before each deal (phase roundChoice, lockstep action 'rc',
  codes in india.ts NORTH_CHOICES), with East round (passport compulsory or optional), Small Cards with
  jokers and Goulash with jokers (1-9). Tests: test/india-north.test.ts. JongClub's readings:
  - **[reading]** East chooses before the tiles are dealt (the book: "when they are East"), so East can't
    pick a game to suit a hand already seen.
    Confirmed by the user 2026-10-25: East picks the game and the joker number before the deal.
  - **[reading]** Small Cards with jokers: one card each, dealt from the 8 fixed double-limit cards (table
    setting northCards: 'double' default, or 'all' 55). A joker stands in for any tile of the card, the
    pair included, and may be used in calls. The card's picture checks (e.g. "with an honour") are passed
    by a hand holding jokers.
  - **[reading]** Goulash with jokers: of each suit's joker number, the first copy a player holds is the
    joker and any second copy is a natural tile; a discarded joker-number tile is natural, punged only with
    a natural pair. Jokers may make a pung or the pair, never a pung from a discard (joker + natural).
  - **[user 2026-10-25]** Goulash with jokers: a set or pair may use two jokers but must keep at least one
    natural tile (no group of jokers alone; WildRules.natural). A joker-number tile standing as itself is natural.
  - **[user 2026-10-25]** A Mahjong on a discard still counts as concealed (nothing exposed) in every round.
  - "Clean" on a Big Card means no jokers in that set or pair (book p. 31). The Ulta Pulta cards' jokers: 1 and 9
    of Cracks, Red Dragon, 1 Bamboo, NEWS (cards 3, 19), plus flowers/seasons (card 29).
  - Big Cards built 2026-10-25 (stage 5): src/engine/rules/indiaBig.ts holds all 29 cards (components, jokers
    with caps, flowers mode, extras), the exact checker, the AI distance and the lay-down options; codes
    NORTH.big + n (101-129); game.declareGroup (lockstep 'l'); AI src/ai/indiaBigPlay.ts; tests
    test/india-big.test.ts (each card's tile count = 14 + extras, pictures complete, clean/cap/terminal rules).
    JongClub's readings, for the user to check:
  - **[reading]** Laying down: kongs, qwongs and runs of 4+ are laid down on your turn (from the hand, or by
    growing your pung or kong) and draw their extras then (kong 1, qwong 2, run 1; cards 27 and 28: qwong 1,
    kong 0, as the tile counts require). A finished hand must have every extra-earning group laid down, so the
    winning tile completes something else (a pair, a dragon, a set).
  - **[reading]** Laying down your own tiles keeps the hand concealed; only a claimed discard makes it normal
    (book: "the entire hand is picked from wall"). Buying doesn't spoil it either (as in the South round).
  - **[reading]** Calls take natural tiles: a pung or kong from a discard needs a natural pair or three in hand,
    of a kind the card uses in a kong, qwong or pung; a chow only on card 26 (from the left). A discard can't
    finish a run of four or more; draw or buy it instead. Win claims and buying as usual.
  - **[reading]** A drawn or bought tile may swap for a joker in anyone's laid-down group; the swap is also
    allowed with a discard when it makes Mahjong.
  - **[reading]** "1 each": one copy of each listed kind per player may be a joker, the rest are natural.
    "All" (cards 1, 8, 9, 17): every copy. Flowers as jokers: any number.
  - **[reading]** Odd kongs: 1, 3, 5, 7, 9 on cards 5 and 15; on T.O.E. cards (6, 14, 18) the odd kong is
    3, 5 or 7 beside the terminal kong. Card 14's odd pair may be a terminal (the book says so).
  - **[reading]** "Clean pair" with no kind named (cards 4, 7) may be any tile, honours included; Quad Kongs and
    card 10's pair: suits only (the book says so).
  - **[reading]** Card 2 (Terminal Chows): the three runs may repeat a suit (the book's example); jokers may be
    used anywhere but the pair. Card 3 / 29: a corresponding dragon for each kong's suit (Bamboos Green,
    Rings White); jokers may be the dragons on card 3.
  - **[reading]** Card 20: the dragon kong may be either kong's corresponding dragon; the suits may repeat.
  - **[reading]** Card 24 (Snakemix): only 1-1-4-7 earns an extra tile (book); the flower is natural (kept
    clean). Cards 21, 23, 24 keep flowers in the hand as the "0"; they aren't replaced or paid.
  - **[reading]** Card 4: "another player's exposed kong" = any kong on the table by another player, checked at
    the moment of Mahjong.
  - Not built yet: a kong declared with a joker outside Big Cards.
- The 29 Big Cards (pp. 33-40), each naming its own jokers:
  1 Breaking News, 2 Terminal Chows, 3 Ulta Pulta 3 Kongs, 4 Same Number Kongs, 5 Odd/Even Kongs, 6 T.O.E. 2,
  7 Sequential Kongs, 8 Major Konging, 9 E&W / N&S, 10 Quad Kongs, 11 Twin Kongs, 12 Triple Kongs,
  13 King Kong, 14 Royal Odds, 15 Royal Odd Kongs, 16 Royal Even Kongs, 17 Royal Konging, 18 T.O.E.,
  19 Ulta Pulta, 20 Kong Types, 21 Spiraling Sequences, 22 Terminal Kong, 23 56, 24 11-10 Snakemix,
  25 Royal Snake, 26 Qwong Kong, 27 Qwongitty Kong, 28 Royal Qwongs, 29 Ulta Pulta Qwongs.
  Full text: book pp. 33-40, transcribed into src/engine/rules/indiaBig.ts.
