# Cast portraits

Head-and-shoulders crops of the five regulars from the reference card art
(`website/refs/regulars.png`, the "At the table" design), 320 px square WebP.
`mei-face-256.webp` one folder up is Mei's crop at 256 px and fills every round
Mei mark in the game (narrator, guide dock, lessons, Ask Mei) via `--mei-face`.

Made 2026-11-13: crop a 180 px square around each face (centres in
regulars.png: Mei 858,214; Rex 1148,212; Hiro 1430,214; Lucky 882,594;
Amara 1150,596), Lanczos up, light unsharp mask (radius 2.2, 60 %), then down
to the stored size. Used by `src/cosmetics/castArt.ts` for seat plates.
