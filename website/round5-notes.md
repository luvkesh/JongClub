# Website round 5: what changed (16 Oct 2026, version 6)

Link: https://claude.ai/artifact/EqppjpqKCxaWsXERLb2wZw

1. **Opening and rooms bands:** these now take looping videos (muted, lazy-loaded, with a poster, and a still for reduced motion). They show stills until the two videos are recorded.
2. **Music:** the game's Zen music plays on the site, switched on and off from the header. It starts off, and the choice is remembered.
3. **Language:** a minimal icon at the top right opens English, 简体中文, 繁體中文, 日本語, العربية (right to left) and हिन्दी. The site starts in the browser's language.
4. **Scroll-spy:** the header link for the section you're reading is underlined in gold.
5. **Repeated titles and "Chapter":** these are gone. Each section has its own short kicker, and the Roman numerals are removed.
6. **Numbers in the timeline:** these are now icons.
7. **Broken icon placement:** fixed. A stray style was stretching the badges.
8. **Empty space in Tea, Gold & Dice:** the tea photo now fills the full height, and the dice photo sits in the notes column.
9. **Empty space in Variations:** the screenshot and the story now sit side by side, with a family breakdown (4 formal rulesets, 9 regional families, 2 house-rule traditions).
10. **The Atelier:** it is now one carousel with Tiles, Racks and Rooms tabs, showing one piece at a time with arrows, thumbnails, swipe and the keyboard.
11. **The details:** "And the Details" stays as its own section.
12. **Buy Jong Points:** this is added to "How pieces are earned" as *Coming at launch*. The promise reads "Bought or earned, nothing in the Atelier changes gameplay or your rating."
13. **Chacklate logo bite:** it is now a real cut-out shape rather than a mask, checked on light, dark and green at 16-200px. The files are in jongclub/brand/chacklate/.

**Mei's audio tour:** an invite card ("Let Mei show you around") and a Mei button in the header start it. Browsers only allow sound after a tap, so it can't start by itself. While she speaks, a card shows her portrait, name, a speaking ring and a live caption, with a stop button.
- She starts 500ms after scrolling settles on a section, and fades out when you move on.
- The music dips under her voice.
- She pauses when the tab is hidden.
- Her voice is English, and the captions are translated.
- Her scripts are in jongclub/website/tour/lines.json.

**Mini-games section:** this sits after Tea, Gold & Dice, with a header link.
- It shows the 12 shipped games with their 3D icons (they sway on hover).
- It has three screenshots (Solitaire, 3D Dimensions, Triple Match) and covers the daily puzzle (+150 JP), up to 600 JP a day per game, the three levels, and that ratings are never touched.
- Mei has a line for this section.
- The Jong Points card now names the Mini-games.

**Game screenshots:** the screenshots were retaken from the current game, so they show the new fonts.

**For a native speaker to check:**
- the room names (Hong Kong Tea House, Tokyo Jansō, Al Fahidi Majlis)
- the season tile-set names
- short headings such as "The House" and "Rounds"
- the grammatical gender guessed for Lucky and Amara in Arabic and Hindi

**Still needed:** Chacklate's real email, address and social links.
