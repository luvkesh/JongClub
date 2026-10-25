# Taiwanese Mahjong: the Dubai club card

The Dubai club's printed cheat sheet (two cards, 101 lines) is now a scoring option for Taiwanese Mahjong in JongClub.
Pick **Scoring: Dubai club card (points)** in the table settings, or join the **Dubai Taiwanese Club** table in the lobby.
Standard Taiwanese still defaults to tai.

## How it compares with our tai scoring

| | Tai (Taiwan) | Dubai club card |
|---|---|---|
| Hand | 16 tiles, 5 sets + pair, 8 flowers | Same |
| Scoring | About 30 tai patterns; 300 base + 100 per tai | 101 lines, points added up; 1 point = 1 at the table |
| Special hands | None beyond 5 sets + pair | 13 Orphans, 16 Orphans, Nico Nico (7 pairs + a concealed pong) |
| Pattern families | Flushes, dragons, winds, concealed pungs | Also sister/brother/neighbour pongs and sheungs, terminal sets, dragon sequences, step-ups, jewel hands, "four in N ways" |
| Payments | Discarder pays; dealer tai added | Discarder pays; self-draw everyone pays |
| Extras | none | Calling (declare ready), dice triples, win within 4/7/10 tiles, heavenly and earthly hands, 7/8-flower instant wins, concealed-gong money, chasing penalty, drawn-game bank |
| Start | 10,000 | 1,000 |

The full card, with how JongClub reads each terse line, opens from the **Card** button at the table.
The code is `src/engine/rules/taiwaneseDubai.ts`; tests are in `test/taiwanese.test.ts`.

## Lines where the card is terse (our reading)

- **16 Orphans**: the card prints "258 + 158 + 369"; we use the usual knitted 147 / 258 / 369 in three different suits.
- **Sister** = same numbers in different suits; **Brother** = identical sheungs in one suit; **Neighbours** = consecutive pongs in one suit.
- **Mixed / Pure Dragon** = 123 + 456 + 789 across three suits / in one suit; exposed if any of the three was called.
- Whole-hand lines replace their smaller family lines: Neighbours replaces "5 Sets", Sister-Brother replaces sister/brother sheungs, All Step Up replaces "3 Sheungs", Little/Big Winds and Dragons replace the per-pong lines. Everything else stacks.
- **Self Draw: Flower Wall** also covers a win on a Gong replacement.
- **Closing/Calling**: press Call with a ready, concealed hand; it locks (no deposit).
- **Win within N tiles** counts tiles taken this hand: draws, calls and the winning tile.
- **Chasing tiles**: if all four players throw the same tile on the first go-round, East pays each player 5 (honour) or 10 (suit).
- **Draw Game (in bank)**: each player puts 5 in the bank; the next winner collects it.
- **7 Flowers**: holding seven, you take the eighth from whoever draws it, and they pay.
- **False Mahjong** can't happen: the table only lets you declare a real win.
