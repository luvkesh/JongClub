# Chacklate Experiences mark (placeholder)

A designed placeholder for the studio behind JongClub, made because no official Chacklate logo was found (the Nibbland repository holds only a README). Swap these files for the official logo when it exists; the website reads `chacklate-logo-dark-bg.svg` and `chacklate-mark.svg`.

The idea: a square of chocolate with a bite taken from one corner and a gold play mark pressed into it. CHACKLATE is set in Cinzel SemiBold (the JongClub wordmark's face) and GAMES in Jost Medium, both converted to paths.

| File | Use |
| --- | --- |
| `chacklate-logo-dark-bg.svg` | Full logo for dark backgrounds (cream lettering). Transparent. |
| `chacklate-logo-light-bg.svg` | Full logo for light backgrounds (cocoa lettering). Transparent. |
| `chacklate-logo-mono.svg` | One colour, `currentColor` (gold by default). |
| `chacklate-mark.svg`, `chacklate-mark-mono.svg` | The chocolate square alone. |
| `png/` | Transparent PNGs: logos at 2048 wide, marks at 1024. |

Regenerate: `python3 brand/chacklate/src/build.py <Cinzel-SemiBold.woff2> <Jost-Medium.woff2>` (both OFL, Google Fonts).
