# Mixed hands and all-pairs hands

## Mixed hands (house rule `mixedHands`)
Patterns built from the same numbers across the three suits. Code: `src/engine/rules/mixed.ts`.

| Line | Shape | Faan | Tai |
|---|---|---|---|
| Mixed Triple Chow | 123 in all three suits | 1 | 2 |
| Mixed Shifted Chows | 123 + 234 + 345, one run per suit | 1 | 1 |
| Mixed Triple Pung | 555 in all three suits | 2 | 2 |
| Mixed Shifted Pungs | 444 + 555 + 666, one pung per suit | 1 | 1 |
| Mixed Triple Pair | in seven pairs, the same number paired in all three suits (each time) | 1 | – |

- Each family (chows, pungs) scores once: the triple beats the shifted pattern.
- On by default: Classic, Dubai Asian (Goulash & Hands), Custom UAE, Indian. Off by default: Hong Kong, Taiwanese (tai).
- Already scored under their own names, unchanged: Riichi (sanshoku doujun 2/1, doukou 2), MCR (Mixed Triple Chow 8, Mixed Shifted Chows 6, Triple Pung 16, Mixed Shifted Pungs 8, Mixed Double Chow 1, Double Pung 2), Dubai club card (Sister Pongs/Sheungs, Mixed Dragon).
- These faan and tai values are JongClub house values. The formal rulesets above are the sources; Classic and Hong Kong-style tables don't have a standard value.

## All-pairs hands
- Seven pairs already played in Classic, Hong Kong, Dubai Asian, Indian, Riichi/Sanma (chiitoitsu), MCR (plus Seven Shifted Pairs 88), Malaysian, Korean and Sichuan. Dubai card: Nico Nico. American card: Singles & Pairs.
- New: **Taiwanese Lì Gǔ Lì Gǔ** (嚦咕嚦咕), seven pairs plus one pung, concealed, 17 tiles, 8 tai (includes the concealed hand; self-draw +1). House rule `liGu`, on by default.
- New: **Singapore** seven pairs (house rule `sevenPairs`, off by default, 3 tai like the Malaysian profile).
- New: **Vietnamese** seven pairs (house rule `sevenPairs`, off by default, 3 phán; a JongClub house value, not from the Vietnamese sources).
- The AI and JongBot use these shapes (shanten), and JongBot names the pairs road when it is shorter.

## Scoring guide
The table's scroll icon opens `src/ui/scoringGuide.ts` (data in `scoringGuideData.ts`): how to win, how the score is paid, the scoring lines with values for the table's house rules, a live "your hand now" read, and lines from the last win marked. Dubai card tables list the card; American tables point to the Card button.
