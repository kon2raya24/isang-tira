# Isang Tira

Sungka, the Filipino shell game, against **Lola Iska**. You and Lola take turns, round after round, on the traditional board with seven shells in every house. There is also a **daily one-turn puzzle**: one board a day, the same for everyone.

**Play:** https://isang-tira.vercel.app

## Laban kay Lola (the game)

- You start. Pick one of your houses (the bottom row) and sow its shells one per slot, into your ulo and on along Lola's row. Lola sows the same way from her side.
- The rules:
  - Last shell in your own ulo: another turn.
  - Last shell on shells: scoop them up and keep sowing.
  - Last shell in your own empty house: capture the house opposite.
  - Last shell in one of Lola's empty houses: her turn.
- **Rounds:** when one side runs out, the other player keeps what is left on theirs, and the round ends. Next round, each player fills their houses with seven from their ulo. Houses they can't fill are **sunog** (burnt) and skipped for the round.
- **How long a game lasts:** 1 round, 3 rounds (the default), or **hanggang maubos**, the traditional game that goes on until someone can't fill a single house. The winner is whoever holds more shells at the end.
- **How Lola plays.** She decides one sowing at a time with a short look-ahead, the way a person does:
  - **Madali:** one sowing ahead, and she sometimes slips.
  - **Katamtaman:** two sowings ahead.
  - **Mahirap:** three sowings ahead, and she weighs your best reply.
  - She deliberately doesn't search a whole turn to its end. From the opening board, one turn can chain extra turns and relays to 95 of the 98 shells, so a perfect searcher would end the game at once.
- Your game is saved as you play, and your record against each level is kept. *Bilis* sets the animation speed.

## The daily puzzle

### How it plays

- You get a new board every day at midnight Manila time, puzzle #1 being 2026-09-28.
- Tap a house to see where its **first handful** lands; tap again to sow. If the handful lands on shells, it relays, and counting the rest is up to you. That's the puzzle.
- Three tries. After a missed try, you can ask for **👵 Bulong ni Lola**: Lola Iska shows each whole sowing, relays included, for the rest of the day, and your share says so.
- When the day is done, share a spoiler-free result (`🟡🐚 8/8`), and watch Lola's hand play the perfect line.
- **Nakaraan** lets you play any past day for practice. **Stats** tracks your streak, par rate, and which try you reached par on. Only daily games count.
- It works offline and installs to the home screen.

#### The week

| Day | Tier | What it asks |
| --- | --- | --- |
| Lunes | Madali | Know the rules and you can see it: no relays on the perfect line. |
| Martes | Pasimula | One relay, maybe two. |
| Miyerkules, Huwebes | Katamtaman | Follow the relays in your head. Thursday's line always captures. |
| Biyernes | Mahirap | Burnt houses change the path. |
| Sabado | Mahirap | Long lines and big captures. |
| Linggo | Mahabang Tira | The long Sunday sowing. |

The tiers follow what the feasibility spike measured: the week ramps in five steps, not seven.

## The look: Lola's sala, in 3D

The game is played in a real-time three.js scene: Lola Iska's sala upstairs in an old bahay na bato, on a sunny afternoon.

- **The board** is Poly Haven's hand-carved Filipino *Sungka Board 02* (CC0, by Ulan Cabanilla) at 2k. Its own seven cowrie sculpts are the sigay, instanced; `tools/board.mjs` measures where every hole is and works out a resting place for every shell in every hole by dropping them in one at a time, so a house with 23 shells shows a real heap of 23.
- **The shells** arc from house to house as you sow, one by one, each landing with a clack (Kenney CC0 samples). A relay scoops the heap back into the handful. A capture lifts the shells, holds them for a beat, and pours them into the ulo, with a slow-motion punch-in, sparks and a floating +N. Burnt (sunog) houses are charred, with embers still glowing.
- **The counts** sit by every hole and tick up as each shell lands; the handful carries its own count.
- **The room**: wide narra floorboards, carved wall panels, a capiz window half open to the garden, balusters under it and fretwork over it, a capiz lamp over the table. Lola's gallinera chair and chest, her spectacles and coffee, a clock, an oil lamp, a vase and a plant are Poly Haven scans. A low sun comes through the window with dust in its beams.
- **The camera** flies in from the title shot, frames the whole board in landscape and runs it up the screen on a phone, punches in on big captures, and circles the table at the end of a round. *Kalmado* (or the device's reduced-motion setting) keeps it still, with no shake or flashes.
- **The film look** (`src/post.mjs`): ambient occlusion, a shallow depth of field, bloom, a warm grade, vignette and grain, SMAA. It steps down by itself on slow devices; `?gfx=0|1|2` pins the level.
- **Sound** (`src/audio.mjs`): Kenney CC0 shells and wood, a harana plucked on a synthesized nylon string, birds outside, Lola's clock.
- **The front end**: a title over the live scene, a loading bar, a gold HUD, Lola's lines in a dialogue box, toasts, a pause menu, and a settings screen (graphics, music and effects volume, camera, sowing speed, counts).

The page's own board is still there, out of sight: keys 1–7, Tab and the arrow keys move through your houses (the 3D board shows a focus ring), and screen readers read every house. If WebGL is not available, or with `?gl=0`, that board is shown and the game plays as before.

Lola herself is not modelled: her chair, her things and her voice are at the table, and her handful travels over the board on its own.

## How the daily board is made

`src/daily.mjs` seeds a PRNG with the date and draws boards from that weekday's sampling profile. It keeps the first board that passes the weekday's gates: par, the number of sowings, relays on every perfect line, the gap to the obvious greedy line, and the chance that random play reaches par. The exact solver (`src/solver.mjs`) proves par. The generator runs in the browser, so there's no server, and every browser gets the same board.

The profiles come from the Isang Tira feasibility spike. Its generator code was throwaway, so the gates were rebuilt from the spike report. The rebuilt generator matches the report's median par on every weekday within one shell. It accepts candidates at about the reported rate on Mon, Fri, Sat and Sun, and at about half the rate on Tue–Thu, which only affects speed.

## Run locally

No build step:

```sh
python3 -m http.server 8000
```

Test hooks: `?test=1` (no saves, instant sowing; add `motion=1` to see it), `mode=daily`, `date=YYYY-MM-DD`, `level=`, `title=1`, `gfx=`, `gl=0`, and `window.__it`.

Tests (Node 20+): `node --test test/*.test.mjs`. They cover:
- the rules engine and solver
- the game against Lola: turns, captures into the right ulo, rounds and burnt houses, and whole games where no shell is lost and the animation always matches the board. They also check that a round takes many turns, and that Lola's levels really do get harder.
- a year of daily boards: each passes its gates, and an independent brute-force solver agrees on par and perfect lines
- progress, streaks and share text
- the offline cache list

## Files

- `src/engine.mjs`, `src/solver.mjs`, `src/reference.mjs`: the rules, the exact solver, and an independent reference implementation.
- `src/match.mjs`: the whole game against Lola: turns for both sides (Lola's sowings run the same engine on the mirrored board), rounds, burnt houses, and how Lola chooses.
- `src/daily.mjs`: dates, profiles, gates and the daily board.
- `src/progress.mjs`: tries, Lola's whisper, stats, streaks and share text.
- `src/app.mjs`: the page: screens, the flat board, input, saves.
- `src/view3d.mjs`, `src/room.mjs`, `src/sungka3d.mjs`, `src/post.mjs`, `src/envpack.mjs`, `src/tex.mjs`, `src/audio.mjs`: the 3D sala, its board and shells, the film look, the scans, painted textures and sound.
- `assets/board/` (from `tools/board.mjs`), `assets/env/` (Poly Haven props, surfaces and a sky, converted with the Bakbakan tools), `assets/sfx/` (Kenney CC0).
- `src/events.mjs`, `src/preview.mjs`, `src/timing.mjs`, `src/demos.mjs`: shared with the playtest.
- `sw.js`: offline cache. Bump `VERSION` on every change.

The playtest that came before this lives at [isang-tira-playtest](https://github.com/kon2raya24/isang-tira-playtest).

Made by [Lemmuel Turaya](https://kon2raya.netlify.app).

## License

MIT
