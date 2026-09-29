// A whole game of Sungka against Lola Iska: both sides take turns, round after round, until one
// player cannot fill a single house. Both players use exactly the puzzle's rules (engine.mjs); Lola's
// sowings run the engine on the board seen from her side, so there is one rules engine for both.
//
// The board is always stored from your side: 0-6 your houses, 7 your ulo, 8-14 Lola's houses, 15 her
// ulo. A move is a house 0-6 counted from the mover's own left.
import { ULO, LOLA_ULO, legalHouses, nextTable, sow, turnEnd, housesTotal } from './engine.mjs';
import { sowEvents, turnEndEvents } from './events.mjs';

export const START = 7, TOTAL = 98;
export const LEVELS = ['madali', 'katamtaman', 'mahirap'];
export const other = (who) => (who === 'you' ? 'lola' : 'you');

// Seeing the board from the other side: houses and ulos swap rows.
export function flip(s) {
  const t = new Uint8Array(16);
  for (let i = 0; i < 8; i++) { t[i] = s[i + 8]; t[i + 8] = s[i]; }
  return t;
}
export const flipBurnt = (b) => ((b & 0x7f) << 8) | ((b >>> 8) & 0x7f);
export const flipSlot = (i) => (i + 8) % 16;
export const view = (m, who) => (who === 'you' ? { s: m.s, burnt: m.burnt } : { s: flip(m.s), burnt: flipBurnt(m.burnt) });
export const uloOf = (who) => (who === 'you' ? ULO : LOLA_ULO);
export const houseSlot = (who, h) => (who === 'you' ? h : h + 8);

// rounds: how many rounds the game lasts (null: the traditional way, until someone cannot fill a house).
export function newMatch({ first = 'you', rounds = 3 } = {}) {
  const s = new Uint8Array(16);
  for (let i = 0; i < 7; i++) { s[i] = START; s[8 + i] = START; }
  return { s, burnt: 0, turn: first, round: 1, starter: first, limit: rounds, phase: 'play', rounds: [], winner: null };
}

export function legal(m, who = m.turn) {
  const v = view(m, who);
  return legalHouses(v.s, v.burnt);
}

// Events from the mover's side, turned to the stored board: slots flipped for Lola, and each capture,
// sweep and extra turn tagged with whose ulo it goes to.
function place(events, who) {
  return events.map((e) => {
    const out = who === 'you' ? { ...e } : { ...e, slot: e.slot === undefined ? undefined : flipSlot(e.slot), ...(e.opp !== undefined ? { opp: flipSlot(e.opp) } : {}) };
    if (e.t === 'capture' || e.t === 'sweep') { out.ulo = uloOf(who); out.side = who; }
    if (e.t === 'extra') out.slot = uloOf(who);
    return out;
  });
}

// One sowing by whoever's turn it is. Updates m and returns what happened: the drop-by-drop events
// (on the stored board), the engine's result, whether the same player goes again, and whether the
// round ended.
export function play(m, house) {
  if (m.phase !== 'play') throw new Error(`no move in phase ${m.phase}`);
  const who = m.turn, v = view(m, who);
  const { events, result } = sowEvents(v.s, v.burnt, house);
  let s = result.state;
  const all = place(events, who);
  const back = (x) => (who === 'you' ? x : flip(x));
  if (result.outcome === 'extra' && legalHouses(s, v.burnt).length) {
    m.s = back(s);
    return { who, events: all, result, again: true, roundOver: false };
  }
  // the turn ends; if the other side is empty, the mover keeps the shells left on theirs
  const te = turnEndEvents(s, v.burnt);
  all.push(...place(te.events, who));
  s = te.result.state;
  m.s = back(s);
  if (housesTotal(m.s) === 0) { endRound(m); return { who, events: all, result, again: false, roundOver: true, swept: te.result.swept }; }
  m.turn = other(who);
  return { who, events: all, result, again: false, roundOver: false, swept: te.result.swept };
}

function endRound(m) {
  const you = m.s[ULO], lola = m.s[LOLA_ULO];
  const winner = you > lola ? 'you' : lola > you ? 'lola' : null;
  m.rounds.push({ round: m.round, you, lola, winner });
  m.phase = 'roundOver';
  if (you < START || lola < START) { m.phase = 'over'; m.winner = you < START ? 'lola' : 'you'; }
  else if (m.limit && m.round >= m.limit) { m.phase = 'over'; m.winner = winner; } // whoever holds more; null is a draw
}

// The next round: each player fills their houses, left to right, seven shells each, from their ulo.
// Houses they cannot fill are burnt (sunog) for the round; what is left over stays in the ulo. The
// player who lost the round starts it.
export function nextRound(m) {
  if (m.phase !== 'roundOver') throw new Error(`next round in phase ${m.phase}`);
  const s = new Uint8Array(16);
  let burnt = 0;
  for (const [base, ulo] of [[0, ULO], [8, LOLA_ULO]]) {
    let bank = m.s[ulo];
    for (let h = 0; h < 7; h++) {
      if (bank >= START) { s[base + h] = START; bank -= START; } else burnt |= 1 << (base + h);
    }
    s[ulo] = bank;
  }
  const last = m.rounds[m.rounds.length - 1];
  const first = last.winner ? other(last.winner) : other(m.starter);
  return { ...m, s, burnt, turn: first, starter: first, round: m.round + 1, phase: 'play' };
}

export const scoreOf = (m) => ({ you: m.s[ULO], lola: m.s[LOLA_ULO] });

// ---------- Lola's play ----------
// Lola decides one sowing at a time, the way a person does, looking a few sowings ahead. (Searching
// every turn to the end would be unfair and dull: from the opening board one turn can chain its way
// to 95 of the 98 shells, and the game would be over before it starts.)
export const LOLA = {
  madali: { depth: 1, careless: 0.35, reply: 0 },
  katamtaman: { depth: 2, careless: 0.05, reply: 0 },
  mahirap: { depth: 3, careless: 0, reply: 0.8 },
};

// How good sowing house h is for the mover (s, burnt from the mover's side), looking `depth` sowings
// ahead: what it banks, plus the best follow-up if it earns another turn, less (for Mahirap) the most
// the other player could bank with one sowing in reply.
export function sowingValue(s, burnt, h, depth, reply = 0, next = nextTable(burnt)) {
  const r = sow(s, burnt, h, next);
  if (r.outcome === 'extra') {
    const hs = legalHouses(r.state, burnt);
    if (!hs.length) return r.gained + turnEnd(r.state, burnt).swept;
    if (depth <= 1) return r.gained + 1.5; // another turn is worth something even unseen
    let best = -Infinity;
    for (const k of hs) best = Math.max(best, sowingValue(r.state, burnt, k, depth - 1, reply, next));
    return r.gained + best;
  }
  const t = turnEnd(r.state, burnt);
  let v = r.gained + t.swept;
  if (reply && housesTotal(t.state)) {
    const theirs = flip(t.state), tb = flipBurnt(burnt), tn = nextTable(tb);
    let most = 0;
    for (const k of legalHouses(theirs, tb)) most = Math.max(most, sowingValue(theirs, tb, k, 1, 0, tn));
    v -= reply * most;
  }
  return v;
}

// Lola's next sowing: a house 0-6 from her own left.
export function lolaMove(m, level = 'katamtaman', rand = Math.random) {
  const p = LOLA[level] || LOLA.katamtaman;
  const v = view(m, 'lola');
  const hs = legalHouses(v.s, v.burnt);
  if (rand() < p.careless) return hs[Math.floor(rand() * hs.length)];
  const next = nextTable(v.burnt);
  let best = [], top = -Infinity;
  for (const h of hs) {
    const val = sowingValue(v.s, v.burnt, h, p.depth, p.reply, next);
    if (val > top + 1e-9) { top = val; best = [h]; } else if (Math.abs(val - top) <= 1e-9) best.push(h);
  }
  return best[Math.floor(rand() * best.length)];
}
