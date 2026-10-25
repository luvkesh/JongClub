# JongClub brand

One logo everywhere: the **crest** (the gold fret-work medallion with the ivory East tile, cut from the original artwork) and the **embossed JONGCLUB wordmark** beneath it. Everything below has a fully transparent background unless it says otherwise.

## Transparent logo files (`transparent/`)

| File | What it is |
| --- | --- |
| `jongclub-logo.svg` | Full logo, crest over the embossed wordmark. True vector paths, no background. Scales to any size. |
| `jongclub-crest.svg` | The crest on its own, true vector. |
| `jongclub-logo-mono.svg`, `jongclub-crest-mono.svg` | One colour (gold `#c9a45c` by default, uses `currentColor` so it can be recoloured). For engraving, embossing, foil, watermarks and single-colour print. |
| `jongclub-logo-1024.png`, `jongclub-logo-2048.png` | Full logo as photographic PNG with alpha (the original's lighting and textures). |
| `jongclub-crest-1024.png`, `jongclub-crest-2048.png` | Crest as photographic PNG with alpha. |
| `jongclub-logo-vector-4096.png`, `jongclub-crest-vector-4096.png` | Large masters rendered from the vector files. Use these for print and big signage. |
| `jongclub-logo-mono-2048.png`, `jongclub-crest-mono-2048.png` | One-colour PNGs with alpha. |
| `transparency-check.png` | Every file composited on light, dark and green, to prove nothing carries a background. |

The photographic PNGs keep the look of the original image but are limited by its resolution (the crest is about 1,560 px across in the source, so the 2048 file is upscaled a little). For anything larger, use the SVGs or the 4096 vector masters.

## In the app

| File | Use |
| --- | --- |
| `png/jongclub-crest-{64..1024}.{png,webp}` | Transparent crest. The game inlines it via `src/brand.ts` (top bar, home, sign-in, clubs); the website copies it into `website/assets/`. |
| `jongclub-wordmark-embossed.svg` | The embossed gold JONGCLUB lettering (Cinzel SemiBold as paths, bevel filter). Always use this for the name. |
| `jongclub-wordmark-mono.svg` / `jongclub-wordmark.svg` | Flat one-colour and gradient versions of the lettering. |
| `png/jongclub-app-icon-*.png`, `favicon.ico`, `jongclub-app-icon.svg` | App icons. These intentionally sit on a dark felt square, because phone home screens need an opaque icon. |
| `jongclub-tile.svg`, `png/jongclub-tile-*.png` | The bare East tile for tiny sizes (16 to 48 px). |

`legacy/` holds the earlier simplified redraw of the mark and its lockups. They are superseded; don't use them in new work.

Colours: gold `#c9a45c` (highlight `#f0d9a0`, shadow `#8f6a2c`), ivory `#f6efdf`, jade `#1f6e3d`, felt `#163128` / `#0a1814`.

## Regenerate

- Transparent crest and vectors: `python3 -I brand/src/transparent/cut.py` (cuts the crest from `source/jongclub-logo-original.png`, removes the green ground, writes layer masks), trace the masks with `vtracer` (pip), then `python3 brand/src/transparent/assemble.py` and `node brand/src/transparent/render.mjs <svg> <png> <width>` for PNGs. The scripts run from a scratch folder; see the top of each.
- Embossed wordmark: `python3 brand/src/build-brand.py <Cinzel-SemiBold.woff2> <NotoSerifTC-Black subset with 東>`. Fonts are OFL from Google Fonts.
- App icons and favicon: `python3 brand/src/build-crest.py` (only its app-icon section still applies; the crest PNGs now come from the transparent cut).
