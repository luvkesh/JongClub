# JongClub

**The Table Awaits.** Learn. Play. Master.

JongClub: a premium 3D Mahjong club in the browser. Classic Mahjong (Phase 1)
and Japanese Riichi (Phase 2, first variation) against AI opponents on a Three.js
table, with JongBot hints, the NEWS round framework, Jong Points and a basic profile.

## Run it

```bash
npm install
npm run dev            # local dev server
npm test               # engine + AI tests (vitest)
npm run build          # typecheck + production build in dist/
npm run build:artifact # single self-contained HTML in dist-artifact/jongclub.html
```

## What is in Phase 1

| Brief item | Where |
| --- | --- |
| Landing / home with 3D table, shuffle loop, "Sit at the Table" | `src/ui/app.ts` (home), `src/render/table3d.ts` (orbit + scatter) |
| 3D table, tiles with thickness, rounded edges, shadows, reflections | `src/render/table3d.ts`, faces drawn in `src/render/tileFaces.ts` |
| Four players, AI opponents (4 levels × 5 personalities) | `src/ai/players.ts` |
| Classic Mahjong as a rule profile | `src/engine/rules/classic.ts` |
| NEWS round framework (configurable winds, dealer rotation, length) | `src/engine/rounds.ts` |
| Draw / discard / chow / pung / kong, win detection, scoring | `src/engine/game.ts`, `src/engine/hand.ts` |
| Hand results and match results | `src/ui/match.ts`, `src/ui/app.ts` (`showResults`) |
| Lobby with open tables and Create a Table | `src/ui/app.ts` (`play`) |
| Profile, Jong Points, Club Level, achievements, history | `src/progression/profile.ts` |
| JongBot (What should I do? / Why? / Analyse my hand) | `src/ai/jongbot.ts` |
| One tile set (Classic Ivory) and one table (Classic Green) | `tileFaces.ts`, `table3d.ts` |
| Core animations (deal, draw, discard arc, melds, win reveal, camera) with Minimal / Classic / Cinematic speeds | `table3d.ts`, `match.ts` |
| Sound effects plus separate Music / Effects / Ambient volumes | `src/audio/sound.ts` (recorded tile samples, see Sound effects) |

Passport, Club and Collection have Phase 1 versions (variation stamps, league ladder,
owned cosmetics) that point at what arrives later.

## Mahjong Academy (`src/ui/academy.ts`, `src/audio/voice.ts`)

Every lesson (Basics, Riichi, Taiwanese, American, Dubai club) is a short story told
one scene at a time by Mei, the club host, with a board diagram or tiles on screen,
captions, and Mei's recorded voiceover (Kokoro TTS, Apache-2.0: a warm female voice with a light
Chinese accent), embedded in `src/audio/narration.gen.ts`. After editing lesson text, re-record with
`npx vite-node scripts/narration-lines.ts > lines.json` and `python3 scripts/record-narration.py lines.json
"af_heart+zf_xiaoxiao@0.5"`. Lines without a clip fall back to the device's most natural voice; Settings has
a Tutorial voice picker. Captions are always shown, and voice can be switched off per device.

Background music (`src/audio/zen.ts`) is a generated traditional ensemble: guzheng, pipa
(with tremolo), erhu, xiao, a muyu woodblock, wind chimes, a temple bell and a low drone, in the
D gong pentatonic mode, through a hall reverb.

Each lesson ends with a test. A wrong answer explains why and asks again; the lesson
counts as learned (and unlocks its practice table) only at 80% right first time.

Guided game (`src/ui/coach.ts`): Level 2 of the Academy (and the button after the Basics test) deals a
real hand at a gentle table while Mei commentates: your first turn, tips, claims you can make, being one
tile from ready, and the result. Her lines are fixed text, so they are recorded with the narration.

Table callers (`src/audio/callers.ts`): every discard and claim is called out loud in that player's voice.
Eight recorded voices (four female, four male) live in `src/audio/callers.gen.ts`; each match seats two of
each, fixed by the match seed. Re-record with `npx vite-node scripts/caller-phrases.ts > scripts/caller-phrases.json`
then `python3 scripts/record-callers.py`. Settings: Tile calls, Speak all content (reads prompts and hints
aloud); JongBot hints also have a Speak button.

Your hand (`src/ui/handOrder.ts`): sorted by suit (small gaps between suits) or by number, with the
drawn tile sorted in and marked. Drag tiles (3D rack or phone tray) into your own order; Sort re-sorts.
Group sets pulls complete pungs and runs to the left.

Table view: wheel or pinch to zoom, right-drag, Shift+drag or two-finger drag to tilt and turn, or the
control cluster on the left; saved per device. Hovering any face-up tile shows its name in the club's
own tooltip (`src/ui/tooltip.ts`), which replaces every native tooltip in the app.

Placement (`src/progression/placement.ts`, `src/ui/placement.ts`): "Already play? Take a 2-minute placement" on a first
visit to Learn and in the Academy header. Ten questions (tile names, sets, words, the deal, waits, a best discard, faan,
Riichi) mark the beginner lessons a player has shown they know as done and suggest an AI level and first table;
the result is stored per account (`jongclub.placement.v1[:account]`).

Phones (`src/ui/tabbar.ts`): on narrow or short screens the nine-tab strip becomes five tabs at the foot: Play (Play,
Variations, Daily), Learn, Club (Club, World Tour), Collection and You (Profile, Settings), with sub-tabs above the page.
Desktop keeps the top navigation. The bar is part of the lobby shell, so it never shows during a match.

## Phases 3 and 4 (club, competition, cosmetics, AI, replays)

- **Live tables** (`src/net`): peer-to-peer over the claude.ai artifact `room`
  capability. The host's browser referees; every action is a compact lockstep entry in
  presence, so games are deterministic (match seed + per-hand seed + action log). Left
  players are taken over by AI after 6 s. Outside claude.ai, play is local against AI.
- **Ranked**: per-variation Elo against a field near your rating, JongBot off, 20 s turns.
  Purchases never change rating.
- **Tournaments, daily challenges, club roster** (`src/club`): AI-simulated fields,
  five daily challenges with a streak, leaderboards (global, regional, friends).
- **Passport, Profile analytics, Collection and The Atelier**: stamps per destination,
  per-variation stats and insights, cosmetics bought with Jong Points only.
- **Expert AI** (`src/ai/danger.ts`, `strategy.ts`): opponent reading, push-or-fold,
  personality-tuned caution; **game review** (`src/ai/review.ts`) powers the replay viewer.
- **Rules**: robbing the kong; Riichi red fives (house rule 0/3/4).

## Sound effects (`src/audio/sound.ts`)

Tile sounds are real recordings, not synthesis: tile-on-tile clacks, tiles landing on felt
and the riichi stick on wood. Each event is built from several takes, and every hit picks a
different take with slightly different pitch, level, tone and stereo position, so a wash, a
deal or a discard never repeats exactly. The wash layers dense, uneven clatter from several
hands over soft felt friction; dealing pushes rows together and sets blocks down; melds flam
three or four tiles; a win knocks the hand down tile by tile. The tile material in the
Atelier changes playback (heavier jade and stone, brighter glass, wood for bamboo, metal
hits for metal). Win, score and turn cues keep soft synthesised chimes.

The 41 prepared samples (trimmed, normalised, mono, 124 KB) are in `assets/sfx/` and embedded
as data URLs in `src/audio/sfx.gen.ts`. Rebuild them with
`python3 scripts/build-sfx.py <path to dice-box-threejs public/sounds>` (needs ffmpeg and numpy).

| Samples | Source | Licence |
| --- | --- | --- |
| `clack-*` (tile on tile), `wood-*` (bamboo tiles, riichi stick), `metal-*` (metal tiles) | `public/sounds/dicehit/` of [`@3d-dice/dice-box-threejs`](https://github.com/3d-dice/dice-box-threejs) 0.0.12 (plastic, wood and metal hit recordings) | MIT, (c) 2022 3D Dice; the upstream [3DDiceRoller](https://github.com/MajorVictory/3DDiceRoller) by MajorVictory is released into the public domain (Unlicense) |
| `felt-*` (tile landing on the felt), `table-*` (riichi stick on the table) | `public/sounds/surfaces/` of the same package | same |

## Architecture

```
src/engine/   pure game logic, no DOM
  tiles.ts      tile kinds, names, parsing
  hand.ts       decomposition, shanten, waits (variant neutral)
  rounds.ts     NEWS round framework
  state.ts      plain-data GameState (serialisable for replay / network)
  game.ts       MahjongGame state machine
  rules/        RuleProfile interface, Classic profile, variation registry
src/ai/       evaluate.ts (shared analysis), players.ts (opponents), jongbot.ts (hints)
src/render/   Three.js table and canvas tile faces
src/audio/    sound effects (recorded samples), music, voices
src/progression/ profile, Jong Points, Club Level, rating, achievements
src/ui/       app shell, screens, match controller
```

Rules never live in UI code. The engine reads everything variant-specific from a
`RuleProfile` (tile set, players, hand size, calls, winning shapes, minimum value,
round structure, scoring, payments, house rules). Adding Riichi, Taiwanese, American
or UAE play means adding a profile in `src/engine/rules/` and registering it in
`rules/index.ts`. Variants that break the "four sets and a pair" shape (American
card hands, Taiwanese 16-tile hands) will supply their own win checker through the
profile rather than changing `hand.ts`.

The renderer derives every tile's pose from `GameState` and tweens to it, so any
state change animates without per-action animation code.

## Classic rules as implemented

136 tiles, 13-tile hands, dealer starts with 14. Chow from the player on your left
only; pung and kong from anyone; concealed and added kongs with a replacement tile
from the back of the wall. Win priority: Mahjong beats pung/kong beats chow; nearest
player in turn order wins ties. Special hands: Seven Pairs, Thirteen Orphans.

Scoring is in faan, limit 8. `points = 16 × 2^faan`. Self-draw: each opponent pays
the points. Discard win: discarder pays double, the other two pay half. House rules:
minimum faan (0 / 1 / 3) and when the dealer keeps the deal.

## Riichi rules as implemented (`src/engine/rules/riichi.ts`)

136 tiles, 14-tile dead wall, 25,000 starting points, East + South by default.
Every win needs a yaku. Riichi (1000 stick, hand locks, ippatsu, double riichi),
dora and kan dora from the dead wall, ura dora under riichi. Furiten: permanent
from your own discards, temporary after passing a win, locked after riichi.

Yaku: riichi, double riichi, ippatsu, menzen tsumo, pinfu, tanyao, iipeikou,
yakuhai (dragons, seat and round wind), haitei/houtei, rinshan, sanshoku,
ittsu, chanta, junchan, toitoi, sanankou, sankantsu, honroutou, shousangen,
chiitoitsu, ryanpeikou, honitsu, chinitsu, with yakuman (kokushi, suuankou,
daisangen, the wind yakuman, tsuuiisou, chinroutou, ryuuiisou, chuuren, suukantsu).
Han and fu scoring with mangan, haneman, baiman, sanbaiman and yakuman tiers,
honba (300 per counter), noten payments at a drawn hand, dealer keeps the deal
on a win or when ready at a draw, and the match ends when anyone drops below zero.
House rules: open tanyao on or off; red fives 0, 3 or 4.

Red fives: one red copy each of 5m, 5p and 5s by default (a second red 5p with
four); each in the winning hand is +1 han, listed as "Red five", and like dora is
not a yaku. Robbing the kong: when someone adds a tile to an exposed pung, others
who can win on it may claim it (Chankan, 1 han; the kong maker pays). It is on in
Classic, Riichi, Taiwanese and Dubai, off in American.

Abortive draws (house rule, on by default): nine terminals (kyuushu kyuuhai, the
player's choice on their first uninterrupted turn; the AI takes it with too few kinds
for a realistic kokushi), four winds, four kongs between two or more players, four
riichi, and three ron (abortive by default, or head bump). The dealer keeps the deal
and a counter goes on; riichi sticks stay on the table. Nagashi mangan (house rule, on
by default) is paid as a self-drawn mangan in place of the ready-hand payments.
Kokushi may rob a concealed kong.

Not yet: kan dora timing variants, double ron (a discard to two winners goes to the
first in turn).

## Sanma, Malaysian three-player and placement scoring

- **Sanma** (`rules/sanma.ts`): 108 tiles (Characters 2-8 removed; 1m indicates 9m),
  three seats, no chi, 35,000 points, kita (a North set aside as dora with a
  replacement draw, no new dora; others may ron on it, which is not chankan).
  House rules: tsumo loss (default) or point split, red fives, open tanyao.
  Honba 100 per payer (200 on ron); ready-hand payments total 2,000.
- **Malaysian three-player** (`rules/malaysian3.ts`): the common Malaysian 3P table
  drops the whole Characters suit; animals and flowers as in Malaysian. House rule:
  keep Characters 1 and 9.
- **MCR knitted hands**: Knitted Straight (12 fan, alone or with a set and a pair),
  Lesser Honours and Knitted Tiles (12), Greater Honours and Knitted Tiles (24).
- **Classic flowers and seasons** (house rule, off by default): 144 tiles, seat flower
  and seat season 1 faan each, a full set of four 2 faan.
- **Placement scoring** (`src/club/placement.ts`): uma +15/+5/-5/-15 (or 20/10, 30/10;
  three seats +15/0/-15) plus the score difference per 1,000 (per 100 at small-stake
  tables); ties share. Shown on match results and selectable for club tournaments.

## Taiwanese, American and Dubai club

- **Taiwanese** (`rules/taiwanese.ts`): 16-tile hands, five sets and a pair, eight
  flowers set aside and replaced, scoring in tai (base 300 + 100 per tai), only the
  discarder pays on a discard win, dealer tai and dealer streak.
- **American** (`rules/american.ts`, `ai/american.ts`): JongClub's own card (not the
  NMJL card), 8 jokers, 8 interchangeable flowers, the Charleston with an optional
  second pass, exposures and joker swaps, jokerless bonus, discarder pays double.
- **Dubai Club Mahjong** (`rules/uae.ts`): a configurable club profile built on Hong
  Kong-style play. Not an official UAE ruleset. House rules: flowers, minimum faan,
  chow, seven pairs, payout (half gun / full gun / equal) and dealer retention.

Not yet in Classic: multiplayer, ranked rating changes, replay.

## Sign-in and developer mode (`src/auth`, `src/dev`)

- **Play first** (`src/auth/prompt.ts`, `nudge.ts`): a first visit goes straight into the club as a guest, and "Sit at
  the Table" starts the guided game with Mei. Sign-in is offered gently ("Save your progress?") on the results card and
  when a guest earns something (a lesson passed, a placement); at most once a session, then not for three sessions, and
  never again on its own after three "Not now"s. Other code can call `promptSignIn(reason)`.
- **Sign-in** (`src/auth/signin.ts`): Google, Apple or email, from Settings or an offer. Each account keeps its own
  profile slot on this device (`jongclub.profile.v1:<account id>`); a guest's progress carries over on first sign-in.
  Email accounts are local (PBKDF2-hashed password) until there is a server. Google and Apple run as a labelled demo
  until `VITE_GOOGLE_CLIENT_ID` / `VITE_APPLE_SERVICES_ID` (+ `VITE_APPLE_REDIRECT_URI`) are set (`src/auth/config.ts`).
  Settings has the Account row (sign in, sign out).
- **Developer mode** (`src/dev`): tap the version line at the bottom of Settings seven times. The panel grants Jong
  Points, club levels and rating, unlocks the whole collection, lessons, variations and achievements, replays today's
  daily, resets the profile, and at the table shows every hand and speeds up AI and animations
  (hooks: `sleep` in `ui/dom.ts`, `layout` in `render/table3d.ts`).

## Club server (`server/`), private clubs, etiquette and reminders

- **Server** (`server/`, `npm run server`): Node built-ins only. Accounts (email with scrypt; Google and Apple ID
  tokens checked against the providers' keys), signed sessions, profile sync (last write wins per field), ratings,
  private clubs, reminder opt-ins, and a WebSocket relay with the claude.ai room semantics, so live tables work
  at any domain. The game uses it when `VITE_JONGCLUB_SERVER` (or localStorage `jongclub.server.v1`) is set
  (`src/net/api.ts`, `src/net/cloud.ts`, `src/progression/cloudSync.ts`); otherwise everything stays local as before.
  How to run it and what going live needs: `server/README.md`.
- **Private clubs** (`src/club/privateClubs.ts`, `src/ui/clubs.ts`, from the Club screen): found a club with a crest,
  variation and house rules, invite by link (`?club=CODE`), club tables, a weekly league (4/2/1/0) and a leaderboard.
  Without a server a club lives on this device with members from the AI roster.
- **Invites and etiquette** (`src/ui/live.ts`, `src/net/etiquette.ts`, `src/ui/etiquette.ts`): "Invite a friend" shares
  `?table=CODE`, which opens the app at that table; preset phrases and gestures (no free text), rate-limited, with a
  Settings switch to hide them; watchers join by code, never see concealed tiles, and are counted on the table.
- **Reminders and the streak shield** (`src/club/reminders.ts`, `src/ui/reminders.ts`, `src/club/streakShield.ts`):
  opt-in notifications (daily ready, a friend at a table, streak ending) while the app is open or installed; email
  opt-ins are recorded on the server. One free streak shield a week covers a single missed day.
