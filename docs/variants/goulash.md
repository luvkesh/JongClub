# American "Goulash" (after a wall game): house rule `goulash` on profile `american`

## What it is
In American Mah Jongg, a **wall game** is a hand where every tile is drawn and nobody declares Mah Jongg. Some tables then play a **goulash**. This is a table custom: it is **not** part of the NMJL's official rules. Under NMJL rules, jokers can never be passed in the Charleston, and after a wall game the deal passes as normal.

What the sources describe:
- **Trigger:** a wall game.
- **Dealer:** East stays East for the goulash hand. The deal then passes after the goulash, whoever wins it.
- **Charleston:** the goulash starts with a fresh deal and a Charleston. Home tables vary in how that Charleston works:
  - many let jokers be passed, which is the main thing that makes it "messy";
  - some pass more tiles (6 rather than 3);
  - some skip the optional second Charleston, or the courtesy pass.
- **Repeats:** if the goulash is itself a wall game, another goulash follows.
- Because the details vary, guides tell players to agree the house rule before play starts.

## What JongClub implements
House rule `goulash`, set by the table host in the lobby:
- `off` (default): the deal passes as usual. This follows NMJL play.
- `on`:
  - After a wall game, East keeps the deal for one more hand (`MahjongGame.advance` sets `state.goulash = true`).
  - In that hand's Charleston, jokers **may** be passed, but no one has to pass them. The AI keeps its jokers.
  - The next hand ends the goulash: the flag clears and the deal passes as normal.
- Nothing else changes: 3-tile passes, the second Charleston vote, the card and scoring all stay the same. No other variation is affected.
- The 6-tile passes are not implemented. They would need the Charleston picker to accept 6 tiles, which is a UI change.

UI follow-ups belong to the UI session:
- Let the human select jokers in the Charleston while `state.goulash` is true. The Charleston rack currently marks jokers non-interactive in `match.ts`.
- Show a "Goulash" banner.

## Sources consulted
WebFetch was blocked in this session; sources were read through search-result extracts only.
- Tom Sloper, *Mah-Jongg: The Western Game* (sloperama.com/shanghai/Images/mjwest.htm). Covers the wall game, the goulash played starting with a Charleston, and East staying East with the deal passing after the goulash, whoever wins.
- Wikipedia, *American mahjong*: wall games and the Charleston.
- Sage Mahjong, *Official American Mahjong Rules*, and Lara's Mahjong Edit, *Joker rules*. Under NMJL rules jokers cannot be passed in the Charleston, and some groups allow it as a house rule.
- Mahjician and Mini Mahj Daily, *What is the Charleston*: confirm the house rule before play.
