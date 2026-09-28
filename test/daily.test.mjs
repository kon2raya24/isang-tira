import test from 'node:test';
import assert from 'node:assert/strict';
import { puzzleFor, manilaDate, weekday, puzzleNumber, addDays, msToNextPuzzle, GATES, EPOCH, passes } from '../src/daily.mjs';
import { playLine } from '../src/engine.mjs';
import { solve } from '../src/solver.mjs';
import { brute } from '../src/reference.mjs';
import { isBurnt } from '../src/engine.mjs';

// engine state -> the reference's published rows ('x' = burnt)
const rows = (s, burnt) => ({
  Y: [0, 1, 2, 3, 4, 5, 6].map((i) => (isBurnt(burnt, i) ? 'x' : s[i])),
  L: [0, 1, 2, 3, 4, 5, 6].map((i) => (isBurnt(burnt, 8 + i) ? 'x' : s[8 + i])),
});

test('the day turns over at midnight in Manila, for everyone', () => {
  assert.equal(manilaDate(new Date('2026-09-28T15:59:59Z')), '2026-09-28');
  assert.equal(manilaDate(new Date('2026-09-28T16:00:00Z')), '2026-09-29', 'midnight in Manila is 16:00 UTC');
  assert.equal(msToNextPuzzle(new Date('2026-09-28T15:00:00Z')), 3600 * 1000);
  assert.equal(weekday('2026-09-28'), 1, 'a Monday');
  assert.equal(puzzleNumber(EPOCH), 1);
  assert.equal(puzzleNumber('2026-10-05'), 8);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('the same date always gives the same board', () => {
  const a = puzzleFor('2026-11-11');
  const b = JSON.parse(JSON.stringify(a));
  assert.deepEqual(puzzleFor('2026-11-11'), b);
  assert.notDeepEqual(puzzleFor('2026-11-12').board, a.board);
});

test('a year of daily boards: each is found fast, passes its gates, and an independent solver agrees on par', () => {
  let iso = EPOCH, slowest = 0;
  const seen = new Set();
  for (let d = 0; d < 366; d++, iso = addDays(iso, 1)) {
    const t0 = performance.now();
    const p = puzzleFor(iso);
    slowest = Math.max(slowest, performance.now() - t0);
    const s = Uint8Array.from(p.board);
    const sol = solve(s, p.burnt);
    assert.ok(passes(sol, GATES[p.weekday], p.burnt), iso);
    for (const line of p.lines) assert.equal(playLine(s, p.burnt, line).score, p.par, `${iso} line ${line}`);
    if (d % 3 === 0) {
      const ref = brute(rows(s, p.burnt));
      assert.equal(ref.par, p.par, `${iso}: reference par`);
      assert.equal(ref.perfectLines, p.perfectLines, `${iso}: reference perfect lines`);
    }
    const key = `${p.board.join()}|${p.burnt}`;
    assert.ok(!seen.has(key), `${iso} repeats an earlier board`);
    seen.add(key);
  }
  assert.ok(slowest < 400, `slowest day took ${slowest.toFixed(0)} ms`);
});

test('the week ramps: Sunday and Saturday have bigger pars than Monday', () => {
  const med = (wd) => {
    const pars = [];
    let iso = EPOCH;
    for (let d = 0; d < 140; d++, iso = addDays(iso, 1)) if (weekday(iso) === wd) pars.push(puzzleFor(iso).par);
    pars.sort((a, b) => a - b);
    return pars[pars.length >> 1];
  };
  assert.ok(med(6) > med(1) + 3 && med(0) > med(1) + 3, `Mon ${med(1)} Sat ${med(6)} Sun ${med(0)}`);
});
