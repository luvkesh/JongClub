# Mixed sets, passports and the special wind rounds

Indian and Dubai home tables (Mumbai, Kolkata, the UAE) add hands that the Hong Kong-style base doesn't have, and many give each wind round its own rules. No rulebook fixes these; clubs differ. What follows is JongClub's default reading. Everything that varies is a house rule.

Code: `src/engine/rules/special.ts` (shapes, cards), `src/engine/rules/windRounds.ts` (rounds), `src/engine/rules/classic.ts` (mixed-set scoring). Tests: `test/special-rounds.test.ts`.

## Classic: mixed sets and knits (house rule `mixedSets`, on)
| Piece | What it is | Faan |
|---|---|---|
| Mixed pung (crochet) | the same number once in each suit: 5m 5p 5s | 1 each |
| Mixed chow | three numbers in a row, one tile from each suit: 3m 4p 5s | 0 (counts as a set) |
| Knit pair | the same number in two suits: 7p 7s | 0 (counts as the pair) |
| Crochet | four mixed pungs and a knit | 6 |
| Knitting | seven knits from two suits | 4 (+1 concealed) |

- Mixed sets are concealed: they can't be claimed. Claimed sets are plain.
- A mixed chow takes one tile from each of the three suits (the reading we picked; some tables accept any mix of two suits).
- The older "Mixed hands" house rule (Mixed Triple Chow, Shifted Pungs...) is a different thing: patterns of ordinary sets. Both stay.

## Classic: flowers and seasons
On by default now (144 tiles). Your own flower and your own season are 1 faan each; all four flowers or all four seasons are 2.

## Special wind rounds (house rule `specialRounds`, off; Classic and Dubai Asian)
| Wind | Round | Rule |
|---|---|---|
| East | Passport | every win holds a passport, or two |
| South | Small Card | win with a hand from the Small Card (concealed) |
| West | Goulash | East picks 1 or 3 player exchanges and 1 or 3 wall exchanges; no chows; at least 3 faan |
| North | Big Card | win with a hand from the Big Card (concealed) |

### Passports (East)
- 5-passport: five different winds and dragons. 6-passport: six of them.
- 9-passport (house rule `passportNine`): 1 to 9 of one suit (default), or knitted 1-4-7 / 2-5-8 / 3-6-9 in three suits, or nine different terminals and honours.
- The rest of the hand is sets, plus a pair when two tiles are left: 5 + three sets; 6 + two sets + pair; 9 + set + pair; 5 + 6 + set; 6 + 6 + pair; 9 + 5 (the whole hand).
- Sets may be claimed; passports are built from your own tiles.
- Scoring: single 5 or 6 = 1 faan, single 9 = 2, two passports = 3; plus self-drawn, concealed hand and flowers.

### West: the goulash round
- Flowers are set aside as usual first.
- East chooses: 1 exchange between players (across) or 3 (right, across, left); then 1 or 3 wall exchanges, where everyone puts three tiles out of play and draws three.
- No chows at all, concealed ones included. Minimum 3 faan (an all-pungs hand is already 3).
- This is separate from the Goulash *mode* (a goulash after a wall game), which stays as it was.

### The cards (South and North)
Since 2026-10-30 (the user's choice) both card rounds use the club's own cards: the 55 Small Cards and 29 Big Cards of the Mahjong Calling rulebook, exactly as India Rules plays them (`indiaCards.ts`, `indiaBig.ts`), with each card's own calling rules and jokers.

- South: every player is dealt three Small Cards in secret after seeing their tiles, keeps one, and wins only with the hand it names. A card marked "all from the wall" takes no discard, not even to win.
- North: before the deal East picks one Big Card and everyone plays to it (kongs, qwongs and runs laid down for extra tiles, the card's own jokers).
- The table keeps its own faan scoring. A card's limit becomes faan so the book's 500 / 1000 / 2000 keep their ratio: half limit 3, limit 4, double limit 5. A Big Card pays 4, or 5 when nothing was claimed. Self-drawn adds 1 and flowers score as usual (on a Big Card only when the card treats flowers as bonus tiles). (`CARD_FAAN` in windRounds.ts; confirmed by the user 2026-10-30)
- India Rules' compulsory exchange, Tic-Tac-Toe and buying stay in India Rules only (confirmed by the user 2026-10-30).

JongClub's earlier Small and Big Card lists (`SMALL_CARD`, `BIG_CARD` in special.ts) are no longer dealt; they remain as reference shapes.

Each card has its own printed face (`src/ui/cardArt.ts`): a palette from its name and tiles, an emblem from its name, an engraved pattern, foil frame and corner numbers.

## Sources
WebFetch was blocked; read through search extracts only.
- Tom Sloper (Sloperama), weekly column on Mumbai-style play (sloperama.com/mahjongg/column399i.html): each round has its own rules; a passport is 5 or 6 unique honours used in the Special Hands round; some groups draw a card naming the hand to make.
- Sloperama FAQ 2b: Mumbai rounds include a chicken-hand round, a special-hands round, a goulash round and a dealer's-choice round.
- Mahjong India blog, "The Goulash": East decides the exchanges of three tiles; all pungs in one suit; East doubles.
- U3A beginners' guide: goulash exchanges across, right, left; no chows in a goulash.
- Sloperama's Western special hands: Knitting and Triple Knitting (Crochet).
