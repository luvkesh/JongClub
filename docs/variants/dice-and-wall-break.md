# Dice, East and the wall break (the opening)

What JongClub plays before every deal, per variation. Code: `src/engine/opening.ts` (rules),
`src/ui/opening.ts` (the ceremony and caption card), `src/render/wallMarkers.ts` (tokens),
`TableRenderer.wallPose / breakWall` in `src/render/table3d.ts` (the wall ring).
Readings marked **[reading]** are JongClub's where sources disagree or are silent.

## What happens at the table

1. **Throw for East** (first hand of a match only). Every player throws the variation's dice in turn;
   the highest total is East. Players tied on the highest total (only they) throw again until one is
   ahead. The throws come from the match seed, so every client of a live table and every replay agree.
   Guided games with Mei, daily challenges and late joiners skip it (seat 0 stays East there).
2. **East throws to break the wall** (every hand). The total counts the walls counter-clockwise with
   East's own wall as 1 (E 1, S 2, W 3, N 4, E 5...). That wall is broken that many stacks in from its
   owner's right-hand end. Tiles are then dealt clockwise from the break; the back of the wall (where
   replacement tiles come from) ends on the other side of the break.
3. **The wall opens and is marked.** The marked section at the back steps in from the wall, and three
   tokens are set on the wall: brass (front, the next tile to draw), bronze (back, the last stack of the
   main wall), ivory with a gold rim (the marked section). Front and back are for the opening; the marked
   section's token stays for the hand.

Pacing (user, 2026-10-25): your own throws wait for **Roll** (the throw for East, and the break throw
when you are East or own the wall in a two-throw table); the result of the throw for East waits for
**Continue**. The break is unhurried: the total is counted round the table on the seat plates, then the
stacks are counted along the wall one by one (each lifts with its number), then the counted section slides
out. Not counting your presses, the break takes about 12-15 s each hand (the throw for East adds about 8 s at the first hand).
**Skip** on the card (or Escape) jumps straight to the deal; the "Minimal" table speed leaves the
ceremony out (the wall is still broken in the right place). Portrait phones step the camera back to
the whole wall during the opening and return to the river framing for the deal.

## Per variation

| Variation | Dice | Break throws | Wall broken | Marked section |
|---|---|---|---|---|
| **India Rules** (default) | 2 | East once | counted CCW from East | **Flower wall**: the 2 x total tiles counted off |
| Riichi, Riichi tournament, Sanma | 2 | East once | counted CCW from East | **Dead wall** 7 stacks (14 tiles) right of the break; dora indicator 3rd stack from the break |
| American (house card), Wright-Patterson, UAE American | 2 | East once | **East's own wall** always | none (the last 2 stacks show as the back) |
| Chinese Classical, MCR, EMA, European, Beijing, Northeast, Shanghai, Guangdong, Wuhan, Sichuan, Zung Jung | 2 | **Twice**: East, then that wall's owner; both totals count the stacks | counted CCW from East's throw | **Loose tiles**: the 2 stacks at the break |
| Taiwanese, Fujian, Filipino, UAE Taiwanese | 3 | East once | counted CCW from East | **Last 16** tiles never drawn (their dead wall) |
| Hong Kong, Singapore, Malaysian, Indonesian, Thai, Vietnamese, Indian (old), Korean, Dubai/UAE Asian, Custom | 3 | East once | counted CCW from East | **Loose tiles** (2 stacks) |

Counts past the end of a wall carry on round the corner into the next wall.

## Sources and readings

- **India Rules**: the user's Mahjong Calling rulebook, p. 5 (2 dice in the box). "All players roll the
  dice and the highest roll becomes East... East rolls the dice again... if East rolls an 8, with East being
  1, South is 2 and so counting in a circle... North will be 8. North then takes the pile in front of them
  and counts double the number of cards from the number rolled... and keeps that aside for the flower wall."
  **[reading]** With tiles, "double the number of cards" = that many two-high stacks; they are counted
  from the owner's right-hand end, and the deal continues from the break toward the owner's left (the
  book: when a pile runs out "the person on the left picks their pile"). The flower wall is the back of
  the wall, so flowers and kongs draw from it. The book's re-throw on a tied highest roll is not spelled
  out; JongClub has the tied players throw again (the user's ask, 2026-10-24).
- **Riichi**: WRC/EMA-style rules ("East rolls two dice and counts that number of players counter-clockwise,
  starting with himself... counting from the right the same number of stacks"; "the seven tile stacks to
  the right of the break make up the dead wall"). **[reading]** Riichi tables traditionally seat by drawing
  wind tiles and then roll for the first dealer; JongClub uses the throw for East everywhere.
- **American**: NMJL-style play: highest roll is East; East rolls again and breaks **East's own wall**,
  counting stacks from the right. Older booklets use 3 dice; current play uses 2 (JongClub: 2).
- **Chinese classical / MCR family**: the two-throw method (Sloperama and older Chinese rule books: the first
  throw picks the wall, the owner throws again and the totals are added; the two stacks at the break are the
  loose tiles). **[reading]** Some groups throw once; JongClub follows the two-throw tradition here.
- **Taiwanese**: dealer throws three dice, counts counter-clockwise from themselves; the last 16 tiles are
  not drawn (mahjongo.com Taiwan; UChicago rules).
- **Hong Kong and South-East Asia**: three dice, one throw by East, counted counter-clockwise; loose tiles at
  the break. **[reading]** for Singapore, Malaysia, Indonesia, Thailand, Vietnam and Korea, which share the
  Hong Kong table habit in most club write-ups.
- Three-seat tables keep four walls; the count runs round the four walls.

Corrections from the user's own club practice override any reading here.
