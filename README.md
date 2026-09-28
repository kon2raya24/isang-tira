# Isang Tira

A daily Sungka puzzle. One turn, one board a day, the same for everyone. Bank as many shells in your ulo as the solver's best (**par**), in three tries.

**Play:** https://isang-tira.vercel.app

## How it plays

- You get a new board every day at midnight Manila time, puzzle #1 being 2026-09-28.
- Tap a house to see where its **first handful** lands; tap again to sow. If the handful lands on shells, it relays, and counting the rest is up to you. That's the puzzle.
- Three tries. After a missed try, you can ask for **👵 Bulong ni Lola**: Lola Iska shows each whole sowing, relays included, for the rest of the day, and your share says so.
- When the day is done, share a spoiler-free result (`🟡🐚 8/8`), and watch Lola's hand play the perfect line.
- **Nakaraan** lets you play any past day for practice. **Stats** tracks your streak, par rate, and which try you reached par on. Only daily games count.
- It works offline and installs to the home screen.

### The week

| Day | Tier | What it asks |
| --- | --- | --- |
| Lunes | Madali | Know the rules and you can see it: no relays on the perfect line. |
| Martes | Pasimula | One relay, maybe two. |
| Miyerkules, Huwebes | Katamtaman | Follow the relays in your head. Thursday's line always captures. |
| Biyernes | Mahirap | Burnt houses change the path. |
| Sabado | Mahirap | Long lines and big captures. |
| Linggo | Mahabang Tira | The long Sunday sowing. |

The tiers follow what the feasibility spike measured: the week ramps in five steps, not seven.

## How the daily board is made

`src/daily.mjs` seeds a PRNG with the date and draws boards from that weekday's sampling profile. It keeps the first board that passes the weekday's gates: par, the number of sowings, relays on every perfect line, the gap to the obvious greedy line, and the chance that random play reaches par. The exact solver (`src/solver.mjs`) proves par. The generator runs in the browser, so there's no server, and every browser gets the same board.

The profiles come from the Isang Tira feasibility spike. Its generator code was throwaway, so the gates were rebuilt from the spike report. The rebuilt generator matches the report's median par on every weekday within one shell. It accepts candidates at about the reported rate on Mon, Fri, Sat and Sun, and at about half the rate on Tue–Thu, which only affects speed.

## Run locally

No build step:

```sh
python3 -m http.server 8000
```

Tests (Node 20+): `node --test test/*.test.mjs`. They cover:
- the rules engine and solver
- a year of daily boards: each passes its gates, and an independent brute-force solver agrees on par and perfect lines
- progress, streaks and share text
- the offline cache list

## Files

- `src/engine.mjs`, `src/solver.mjs`, `src/reference.mjs`: the rules, the exact solver, and an independent reference implementation.
- `src/daily.mjs`: dates, profiles, gates and the daily board.
- `src/progress.mjs`: tries, Lola's whisper, stats, streaks and share text.
- `src/app.mjs`: the page, board, animation and sound.
- `src/events.mjs`, `src/preview.mjs`, `src/timing.mjs`, `src/demos.mjs`: shared with the playtest.
- `sw.js`: offline cache. Bump `VERSION` on every change.

The playtest that came before this lives at [isang-tira-playtest](https://github.com/kon2raya24/isang-tira-playtest).

Made by [Lemmuel Turaya](https://kon2raya.netlify.app).

## License

MIT
