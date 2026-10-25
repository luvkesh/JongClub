# Singapore / Malaysian Mahjong: profile `singapore`

**Status:** a club profile of common Singapore and Malaysian table rules. Stakes, tai lists and instant payments vary from table to table, so the host can change them. Source: `src/engine/rules/singapore.ts`.

## Tiles (148)
- The standard 136.
- 8 flowers: plants 梅蘭菊竹 and seasons 春夏秋冬, numbered 1–4 for the seats East, South, West and North.
- 4 animals: Cat 貓, Mouse 鼠, Rooster 雞 and Centipede 蜈.
- Flowers and animals are bonus tiles. They are set aside the moment they are drawn or dealt and replaced from the back of the wall.

## Hands and calls
- 13 tiles in hand; the dealer starts with 14. A win is four sets and a pair, or thirteen wonders (a limit hand). Seven pairs is not used.
- Chi (chow, from the player on your left), Pong, Kong (exposed, concealed or added) and Hu or Zimo (win). Robbing a kong is allowed.

## Tai (minimum 1 to win, capped at 5)
- Each dragon pung 1; seat wind pung 1; prevailing wind pung 1.
- Small three dragons 4. This replaces the separate dragon-pung tai.
- Bonus tiles:
  - Each seat flower 1. These are the plant and the season with your seat number.
  - A full set of four plants, or of four seasons, +1 each set.
  - Each animal 1.
- Ping Hu 4: all chows, a pair that is not a value honour, no flowers or animals, and an open wait (at least two winning tiles).
- Pong Pong (all pungs) 2. Half colour 2. Full colour 4.
- Win on a kong replacement 1. Robbing a kong 1. Last tile 1.
- Limit hands (5 tai): big three dragons, small four winds, big four winds, all honours, thirteen wonders.
- There is no tai for a self-draw or a concealed hand. A self-draw is rewarded through payment instead (see below).

## Payments
- One share for a 1-tai hand is 32 points. Each further tai doubles it: 32, 64, 128, 256, 512.
- Self-draw: everyone pays 2 shares.
- Discard win (house rule `payout`):
  - `shooter` (default): the shooter pays for the whole table, which is 2 shares plus 1 plus 1.
  - `shared`: the shooter pays 2 shares and each other player pays 1.

## Instant payments (paid on the spot, shown with the hand result)
- **Animal bites** (house rule `bites`, on by default):
  - Holding both Cat and Mouse, or both Rooster and Centipede: each other player pays 32. This doubles to 64 if the pair came in the opening deal.
  - Holding all four animals: a further 64 from each other player (128 in the deal).
- **Kong money** (house rule `kongMoney`, on by default):
  - Exposed or added kong: 32 from each other player.
  - Concealed kong: 64 from each other player.
  - A kong that is robbed never stands, so it pays nothing.
- Instant payments are recorded during the hand and settled when it ends, even if the wall runs out. They are listed in `HandResult.instant`.

## Other house rules
- `minValue`: 1 (default), 2 or 3 tai.
- `dealerRetention`: when the dealer wins (default), on a win or a draw, or never.

## Not implemented (regional options)
- Bites between different players: for example, the cat holder collecting when another player shows the mouse.
- Instant payments for seat flowers or a full flower set.
- "Fresh tile" protection.
- The $/tai stake tables themselves. JongClub uses points.

## Sources consulted
WebFetch was blocked in this session; sources were read through search-result extracts only.
- *Singaporean Mahjong scoring rules* (Wikipedia, via a 2006 mirror, and the Tabletopia Singapore Mahjong rules). These cover the animal tiles and their predator and prey pairs, animal and flower instant payments (2 points, 4 in the initial hand, 4 for a full group), the 5-point cap, and "paying for all players".
- TheSmartLocal, *Mahjong rules Singapore*. Covers the animals (cat, rat or mouse, rooster or chicken, centipede), a tai for each animal and flower, and the bonus for all four animals.
- PartyPot blog on scoring and stakes. Shooter-pays and self-draw charts on a 1/2 table: the shooter pays for everyone, and a self-draw is paid by all.
- Ogiuemaniax, *Thoughts on Singapore Mahjong* (background on the table culture).
