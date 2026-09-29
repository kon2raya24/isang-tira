import test from 'node:test';
import assert from 'node:assert/strict';
import { ULO, LOLA_ULO, makeBoard, sow, nextTable, housesTotal, legalHouses } from '../src/engine.mjs';
import { applyEvent } from '../src/events.mjs';
import { newMatch, play, nextRound, legal, lolaMove, sowingValue, LOLA, flip, flipBurnt, flipSlot, view, other, scoreOf, START, TOTAL } from '../src/match.mjs';

const total = (m) => m.s.reduce((a, b) => a + b, 0);
const seeded = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// Play a whole match with a chooser for each side; returns the finished match and how many sowings it took.
function playOut(chooseYou, chooseLola, { rounds = 3, seed = 1 } = {}) {
  const rand = seeded(seed);
  let m = newMatch({ rounds });
  let sowings = 0, turns = 0;
  for (;;) {
    if (m.phase === 'over') break;
    if (m.phase === 'roundOver') { m = nextRound(m); continue; }
    const h = m.turn === 'you' ? chooseYou(m, rand) : chooseLola(m, rand);
    const before = Uint8Array.from(m.s);
    const r = play(m, h);
    const copy = Uint8Array.from(before);
    for (const e of r.events) applyEvent(copy, e);
    assert.deepEqual(copy, m.s, 'the events replay to exactly the new board');
    assert.equal(total(m), TOTAL, 'no shell is ever lost or made');
    if (!r.again) turns++;
    sowings++;
    assert.ok(sowings < 5000, 'the match ends');
  }
  return { m, sowings, turns };
}
const randomMove = (m, rand) => { const hs = legal(m); return hs[Math.floor(rand() * hs.length)]; };
const lola = (level) => (m, rand) => lolaMove(m, level, rand);
const asYou = (level) => (m, rand) => lolaMove({ ...m, s: flip(m.s), burnt: flipBurnt(m.burnt) }, level, rand); // you, played like Lola

test('a new game: seven shells in each of the fourteen houses, empty ulos, and you start', () => {
  const m = newMatch();
  assert.equal(total(m), TOTAL);
  assert.deepEqual([...m.s.subarray(0, 7)], [7, 7, 7, 7, 7, 7, 7]);
  assert.equal(m.s[ULO], 0); assert.equal(m.s[LOLA_ULO], 0);
  assert.equal(m.turn, 'you'); assert.equal(m.phase, 'play');
  assert.deepEqual(legal(m), [0, 1, 2, 3, 4, 5, 6]);
});

test('seeing the board from Lola\'s side is an exact mirror', () => {
  const s = makeBoard([1, 2, 3, 4, 5, 6, 7], [8, 9, 10, 11, 12, 13, 14], { ulo: 20, lolaUlo: 30 });
  assert.deepEqual(flip(flip(s)), s);
  assert.equal(flip(s)[ULO], 30);
  assert.equal(flipBurnt(flipBurnt(0b0100001000000011)), 0b0100001000000011 & 0x7f7f);
  for (let i = 0; i < 16; i++) assert.equal(flipSlot(flipSlot(i)), i);
});

test('Lola sows by the same rules: her move is your move on the mirrored board', () => {
  const m = newMatch();
  m.s = makeBoard([2, 0, 3, 0, 1, 0, 4], [3, 1, 0, 2, 0, 5, 1], { ulo: 38, lolaUlo: 38 });
  m.turn = 'lola';
  const before = view(m, 'lola');
  const expect = sow(before.s, before.burnt, 3, nextTable(before.burnt));
  const r = play(m, 3);
  assert.equal(r.who, 'lola');
  assert.equal(r.result.outcome, expect.outcome);
  assert.deepEqual(flip(m.s), expect.state, 'the stored board is her result, seen from your side');
  assert.equal(m.s[LOLA_ULO], 38 + expect.gained);
});

test('the turn passes unless the last shell lands in the mover\'s own ulo', () => {
  const m = newMatch();
  let r = play(m, 0); // seven shells from Y0: the seventh lands in your ulo
  assert.equal(r.result.outcome, 'extra'); assert.ok(r.again); assert.equal(m.turn, 'you');
  const n = newMatch();
  n.s = makeBoard([0, 0, 0, 0, 0, 0, 2], [0, 0, 0, 3, 0, 0, 0], { ulo: 45, lolaUlo: 48 });
  r = play(n, 6); // one in your ulo, one in Lola's empty L0: your turn is over
  assert.equal(r.result.outcome, 'end'); assert.ok(!r.again); assert.equal(n.turn, 'lola');
});

test('a capture by Lola goes to her ulo, and yours stays as it was', () => {
  const m = newMatch();
  // her L0 has one shell; it lands in her empty L1, opposite your Y5 with four: she takes five
  m.s = makeBoard([0, 5, 0, 0, 0, 4, 0], [1, 0, 0, 0, 0, 0, 0], { ulo: 40, lolaUlo: 48 });
  m.turn = 'lola';
  const youBefore = m.s[ULO], herBefore = m.s[LOLA_ULO];
  const r = play(m, 0);
  assert.equal(r.result.outcome, 'capture');
  assert.equal(m.s[ULO], youBefore);
  assert.equal(m.s[LOLA_ULO], herBefore + 5);
  assert.equal(m.s[5], 0);
  assert.equal(m.turn, 'you');
});

test('when a side runs out, the mover keeps what is left, and the round ends when the houses are empty', () => {
  const m = newMatch();
  m.s = makeBoard([0, 0, 0, 0, 0, 0, 1], [0, 0, 0, 0, 0, 0, 0], { ulo: 50, lolaUlo: 47 });
  const r = play(m, 6); // the last shell goes to your ulo, but you have nothing left: the turn ends
  assert.ok(r.roundOver);
  assert.equal(m.phase, 'roundOver');
  assert.deepEqual(scoreOf(m), { you: 51, lola: 47 });
  assert.equal(m.rounds[0].winner, 'you');
  const n = newMatch();
  n.s = makeBoard([0, 0, 0, 3, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0], { ulo: 40, lolaUlo: 55 });
  const q = play(n, 3); // Lola has no shells: you sweep what is left on your side
  assert.ok(q.roundOver);
  assert.equal(housesTotal(n.s), 0);
  assert.equal(total(n), TOTAL);
});

test('the next round: seven to a house from each ulo, left to right; what cannot be filled is burnt', () => {
  const m = newMatch();
  m.s = makeBoard([0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0], { ulo: 60, lolaUlo: 38 });
  m.phase = 'roundOver';
  m.rounds.push({ round: 1, you: 60, lola: 38, winner: 'you' });
  const n = nextRound(m);
  assert.deepEqual([...n.s.subarray(0, 7)], [7, 7, 7, 7, 7, 7, 7]);
  assert.equal(n.s[ULO], 11);
  assert.deepEqual([...n.s.subarray(8, 15)], [7, 7, 7, 7, 7, 0, 0]);
  assert.equal(n.s[LOLA_ULO], 3);
  assert.equal(n.burnt, (1 << 13) | (1 << 14), 'her last two houses are sunog');
  assert.equal(n.turn, 'lola', 'the loser of the round starts the next');
  assert.equal(n.round, 2);
  assert.equal(total(n), TOTAL);
  // burnt houses are skipped: nothing is ever sown into them
  play(n, 4);
  assert.equal(n.s[13], 0); assert.equal(n.s[14], 0);
});

test('the match ends when someone cannot fill even one house', () => {
  const m = newMatch();
  m.s = makeBoard([0, 0, 0, 0, 0, 0, 1], [0, 0, 0, 0, 0, 0, 0], { ulo: 91, lolaUlo: 6 });
  play(m, 6);
  assert.equal(m.phase, 'over');
  assert.equal(m.winner, 'you');
});

test('whole games against every level of Lola: shells are never lost, the animation always agrees, and games end', () => {
  for (const level of ['madali', 'katamtaman', 'mahirap']) for (let seed = 1; seed <= 4; seed++) {
    const { m, sowings } = playOut(randomMove, lola(level), { seed, rounds: 3 });
    assert.equal(m.phase, 'over');
    assert.ok(m.rounds.length >= 1 && m.rounds.length <= 3);
    assert.ok(sowings > 20, `${level} ${seed}: a real game, not ${sowings} sowings`);
  }
  const { m } = playOut(asYou('katamtaman'), lola('katamtaman'), { seed: 2, rounds: null });
  assert.equal(m.phase, 'over', 'the traditional game also ends, when someone cannot fill a house');
  assert.ok(m.winner);
});

test('a round is a real back-and-forth: many turns each, not three or four', () => {
  for (const level of ['madali', 'katamtaman', 'mahirap']) {
    let turns = 0, rounds = 0;
    for (let seed = 1; seed <= 6; seed++) { const r = playOut(asYou('madali'), lola(level), { seed, rounds: 1 }); turns += r.turns; rounds += r.m.rounds.length; }
    assert.ok(turns / rounds >= 6, `${level}: ${(turns / rounds).toFixed(1)} turns a round`);
  }
});

test('a game lasts the rounds asked for, and the winner is whoever holds more shells after the last', () => {
  const { m } = playOut(randomMove, lola('madali'), { seed: 5, rounds: 1 });
  assert.equal(m.rounds.length, 1);
  const r = m.rounds[0];
  assert.equal(m.winner, r.you > r.lola ? 'you' : r.lola > r.you ? 'lola' : null);
});

test('Lola picks a legal house, and looks ahead: with a sure extra turn and nothing better, she takes it', () => {
  const m = newMatch();
  m.turn = 'lola';
  for (const level of Object.keys(LOLA)) for (let k = 0; k < 5; k++) assert.ok(legal(m, 'lola').includes(lolaMove(m, level, seeded(k))));
  // her L6 (index 6) holds one shell, one drop from her ulo; everything else loses shells to you
  const n = newMatch();
  n.s = makeBoard([0, 3, 0, 0, 2, 0, 0], [5, 0, 0, 0, 0, 0, 1], { ulo: 42, lolaUlo: 45 });
  n.turn = 'lola';
  const v = view(n, 'lola');
  assert.ok(sowingValue(v.s, v.burnt, 6, 2) > sowingValue(v.s, v.burnt, 0, 2));
  assert.equal(lolaMove(n, 'katamtaman', seeded(1)), 6);
});

test('Lola gets stronger by level, and every level beats random play over the first round', () => {
  const games = 8;
  const wins = (you, her) => { let w = 0; for (let seed = 1; seed <= games; seed++) { const { m } = playOut(you, her, { seed, rounds: 1 }); const r = m.rounds[0]; if (r.lola > r.you) w++; } return w; };
  assert.ok(wins(randomMove, lola('madali')) >= games * 0.6, 'Madali beats random');
  assert.ok(wins(asYou('madali'), lola('katamtaman')) >= games * 0.6, 'Katamtaman beats a Madali player');
  assert.ok(wins(asYou('madali'), lola('mahirap')) >= games * 0.75, 'Mahirap beats a Madali player');
  assert.ok(wins(asYou('madali'), lola('madali')) <= games * 0.75, 'Madali can be beaten');
});

test('the start of the game: every opening move is legal and the leftmost house earns another turn', () => {
  const m = newMatch();
  const v = view(m, 'you');
  assert.deepEqual(legalHouses(v.s, v.burnt), [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(sow(v.s, 0, 0).outcome, 'extra');
  assert.equal(other('you'), 'lola');
  assert.equal(START * 14, TOTAL);
  assert.equal(newMatch().limit, 3);
});
