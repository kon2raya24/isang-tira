import test from 'node:test';
import assert from 'node:assert/strict';
import { newRecord, recordTry, useWhisper, stats, shareText, tryMark, MAX_TRIES, migrate } from '../src/progress.mjs';

const P = { iso: '2026-09-30', number: 3, day: 'Miyerkules', tierName: 'Katamtaman', par: 8 };

test('three tries a day; reaching par ends the day early', () => {
  let r = newRecord(P);
  r = recordTry(r, 5);
  assert.equal(r.done, false);
  r = recordTry(r, 8);
  assert.equal(r.done, true);
  assert.equal(r.won, true);
  assert.equal(r.parTry, 2);
  assert.equal(r.best, 8);
  assert.throws(() => recordTry(r, 8), /over/);
  let m = newRecord(P);
  for (let k = 0; k < MAX_TRIES; k++) m = recordTry(m, 4 + k);
  assert.equal(m.done, true);
  assert.equal(m.won, false);
  assert.equal(m.best, 6);
});

test('Lola\'s whisper can only be asked for after a missed try, and is remembered', () => {
  let r = newRecord(P);
  assert.throws(() => useWhisper(r), /first/);
  r = recordTry(r, 5);
  r = useWhisper(r);
  assert.equal(r.whisper, true);
  assert.equal(useWhisper(r), r, 'asking again changes nothing');
});

test('marks: a shell for par, a half for close, a dot for the rest', () => {
  assert.equal(tryMark(8, 8), '🐚');
  assert.equal(tryMark(7, 8), '🟡');
  assert.equal(tryMark(6, 8), '🟡');
  assert.equal(tryMark(5, 8), '⚫');
});

test('the share text is spoiler-free: day, marks and score, never a move', () => {
  let r = recordTry(recordTry(newRecord(P), 6), 8);
  const t = shareText(P, r, 'https://isang-tira.vercel.app');
  assert.match(t, /Isang Tira #3/);
  assert.match(t, /Miyerkules/);
  assert.match(t, /🟡🐚/);
  assert.match(t, /8\/8/);
  assert.doesNotMatch(t, /Y[0-6]/, 'no house names');
  r = useWhisper(recordTry(newRecord(P), 5));
  assert.match(shareText(P, recordTry(r, 8), ''), /👵/, 'a whispered day says so');
});

test('streaks count consecutive daily pars, and today not yet played keeps yesterday\'s streak alive', () => {
  const rec = (iso, won, extra = {}) => [iso, { iso, done: true, won, tries: won ? [8] : [1, 1, 1], parTry: won ? 1 : null, daily: true, ...extra }];
  const records = Object.fromEntries([
    rec('2026-09-28', true), rec('2026-09-29', true), rec('2026-09-30', false),
    rec('2026-10-01', true), rec('2026-10-02', true), rec('2026-10-03', true),
    rec('2026-09-20', true, { daily: false }), // archive games never count
  ]);
  const s = stats(records, '2026-10-04');
  assert.equal(s.played, 6);
  assert.equal(s.wins, 5);
  assert.equal(s.streak, 3, 'today is not played yet');
  assert.equal(s.maxStreak, 3);
  assert.deepEqual(s.dist, { 1: 5, 2: 0, 3: 0, miss: 1 });
  assert.equal(stats(records, '2026-10-05').streak, 0, 'missing a whole day breaks it');
});

test('bad or old saves come back empty rather than breaking the page', () => {
  assert.deepEqual(migrate(null), { v: 1, records: {}, seenRules: false, muted: false });
  assert.deepEqual(migrate({ v: 99 }).records, {});
  const ok = migrate({ v: 1, records: { '2026-09-28': { iso: '2026-09-28', tries: [3], done: false } }, seenRules: true });
  assert.equal(ok.seenRules, true);
  assert.ok(ok.records['2026-09-28']);
});
