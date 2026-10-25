# Vietnamese Mahjong (Mạt chược): profile `vietnamese`

**Status:** a club profile. Vietnamese tables play many house rules. JongClub does not present this as the official ruleset. Source: `src/engine/rules/vietnamese.ts`.

## Tiles (152 by default)
- The standard 136: Characters (Vạn), Dots (Văn), Bamboo (Sách), winds and dragons.
- 8 flowers (4 plants, 4 seasons). These are bonus tiles: they are set aside and replaced from the back of the wall.
- 8 **Khung** jokers, two of each:
  - **Flower Joker** (花, Hoa): a bonus tile, set aside like a flower. Worth +1 phán each.
  - **Wind Joker** (喜, Hỷ): stands for any wind.
  - **Dragon Joker** (元, Nguyên): stands for any dragon.
  - **Number Joker** (合, Hợp): stands for any suited tile.
- House rule `jokers=off` removes the Khung and leaves 144 tiles.

## Hands and calls
- 13 tiles in hand; the dealer starts with 14. A win is four sets and a pair. Seven pairs and thirteen orphans are not used.
- Calls are Ăn (chow, from the player on your left only), Phỗng (pung), Chiếu (kong: exposed, concealed or added) and Ù (win). Robbing a kong is allowed.
- Jokers in the concealed hand can complete a pung, a chow (Number Joker only, because of what it stands for) or the pair, including a pair made of two jokers.
- A called pung may use one natural tile plus one joker (house rule `jokerCalls`, on by default). Chows can only be called with natural tiles.
- A joker may be discarded. A discarded joker is dead: nobody can claim it.

## Scoring (phán are added together, not doubled)
- One payment share is 20 × (1 + phán). A plain win (Ù muỗi, 0 phán) is worth one stake.
- How the hand was won: self-drawn (Tự bốc) 1; concealed hand with no calls (Bất cầu) 1; last tile 2; win after a kong 1; robbing a kong 1.
- Shape: all chows with no value pair (Ù phình) 1; all pungs (Ù tui tui) 3; half flush 3; full flush (Mủn cun) 6; all honours (Toàn chữ) 18.
- Honours:
  - Each dragon pung 1; seat wind pung 1; round wind pung 1.
  - Small three dragons 6 and big three dragons 12. Each replaces the separate dragon-pung phán.
  - Small four winds 24 and big four winds 36. Each replaces the separate wind phán.
- Flowers:
  - Seat flower (Hoa vị trí) 1 for each group (plants and seasons); a complete group of four is 2 instead.
  - Each Flower Joker 1.
  - No bonus tiles at all (Không hoa) 1.
- Win without any jokers: +1 phán (house rule `cleanBonus`, on by default).
- The big three dragons value (12) is a JongClub club value. The sources found do not list it.

## Payments (house rule `payout`)
- `discarder` (default): the discarder pays for the whole table (3 shares). A self-draw is paid by everyone.
- `shared`: the discarder pays 2 shares and the others pay 1 each.
- `discarderOnly`: the discarder pays 1 share.

## Other house rules
- `minValue`: 0 (default, so Ù muỗi is allowed), 1 or 3 phán.
- `flowers`: on or off.
- `dealerRetention`: when the dealer wins (default), on a win or a draw, or never.

## Not implemented (regional options)
- Laying an unused Khung down to score phán instead of keeping it in the hand.
- The "Thùng" frame joker that stands in for two tiles at once.
- 16-joker sets (Khung Xanh and Khung Đỏ as separate kinds) and sets with 16 flowers.
- A rule that a joker used to chow cannot later be swapped out.

## Sources consulted
WebFetch was blocked in this session. These sources were read through search-result extracts only:
- Translated Vietnamese rule sheet, *Vietnamese (Edward) Mahjong Translation* (Sloperama). Covers the 160-tile set with 8 Khung (red: Đại Hoa, Hỉ, Nguyên, Hợp), which jokers form pairs and pungs, and Khung laid down for phán.
- Vietnamese Wikipedia, *Mạt chược*. Covers jokers used to chow and pung, and that a pung beats a chow.
- Vietnamese rule guides: luatchoi.edu.vn, cge.edu.vn, dangnho.com, trochoidangian.com.vn, mylop.edu.vn. These cover the phán lists (Ù muỗi 0, Ù phình 1, Ù tui tui 3, Mủn cun 6, Toàn chữ 18, Tiểu tam nguyên 6, Tiểu tứ hỉ 24, Đại tứ hỉ 36, hoa vị trí 1, 4 hoa cùng loại 2, last tile 2) and the Khung groups (Hoa, Hỷ, Nguyên, Hợp).
- Aliette de Bodard's blog (a 16-joker Vietnamese set) and Sloperama's *Current trends in Vietnamese and Japanese tiles* (more jokers in newer sets).
- The sources disagree with each other. Values were chosen from the most common figures, and every disputed choice is a house rule.
