# Indian Club Mahjong: profile `indian`

**Status:** a configurable club profile, not an official ruleset. Source: `src/engine/rules/indian.ts`.

Mahjong reached India with the Chinese community of Kolkata (Tangra). It is played today in Kolkata, Mumbai and the Darjeeling and Kalimpong hills. No written standard for Indian play was found. Local articles say Indian tables use "differing rules", and clubs mix Hong Kong, Singapore and American habits. For that reason this profile starts from Hong Kong-style club play (as Classic and Dubai do) and adds the jokers and flowers that Indian sets usually carry. Everything that varies is a house rule. Lessons should present it as "how many Indian clubs play" and never as "the Indian rules".

## Tiles (152 by default)
- The standard 136, plus 8 flowers (bonus tiles, set aside and replaced).
- 8 jokers. A joker may stand for any tile.
- House rules: `jokers=off` gives 144 tiles, and `flowers=off` as well gives 136.

## Hands and calls
- 13 tiles in hand; the dealer starts with 14. Four sets and a pair, seven pairs, or thirteen orphans. Jokers never count toward seven pairs or thirteen orphans.
- Chow (from the player on your left), pung, kong, Mahjong. Robbing a kong is allowed.
- Jokers in the concealed hand may complete pungs, kongs and chows.
- A joker in the pair is **not allowed** by default (house rule `jokerPair` can allow it).
- A called pung may use one natural tile plus one joker (house rule `jokerCalls`, on by default). Chows are called with natural tiles only.
- Jokers may be discarded. A discarded joker is dead: nobody can claim it.

## Scoring (faan, doubled; limit 8 faan)
- Classic faan:
  - self-drawn 1, concealed 1;
  - all chows 1, all pungs 3, seven pairs 4;
  - each dragon pung, seat wind pung and round wind pung 1;
  - small three dragons 3, small four winds 6;
  - half flush 3, full flush 7;
  - win after a kong, robbing a kong and last tile 1 each;
  - limit hands: big three dragons, big four winds, all honours, four concealed pungs, thirteen orphans.
- Flower faan as in Dubai play: seat flower 1, a complete group of four 2, no flowers 1.
- Win without any jokers: +1 faan (house rule `cleanBonus`, on by default).
- Points are 16 × 2^faan.

## Payments (house rule `payout`)
- `halfGun` (default): the discarder pays double and the others pay half. On a self-draw, everyone pays.
- `fullGun`: the discarder pays for the whole table.
- `equal`: everyone pays the same.

## Other house rules
- `minValue`: 0, 1 (default) or 3 faan.
- `dealerRetention`: when the dealer wins (default), on a win or a draw, or never.

## Sources consulted
WebFetch was blocked in this session; sources were read through search-result extracts only.
- SheThePeople, *Mahjong: How This Ancient Chinese Game Is Finding New Ground In India*: Indian tables play Western, Singapore and local styles with "differing rules".
- Financial Express Mumbai, *Mahjong mania*: Mumbai club play.
- General joker conventions in Chinese-style home play: a joker can fill a pung, kong or chow but not the pair, and a discarded joker is dead. Found via sites.google.com/site/mahjrules and the NZ Clubs tournament rules ("loosies", with a bonus for a hand without them).
- Hong Kong scoring references, used for the faan base.
- **Gap:** no Kolkata, Mumbai or Darjeeling club rule sheet was found. A club's written rules should be used to set the house-rule defaults when one becomes available.
