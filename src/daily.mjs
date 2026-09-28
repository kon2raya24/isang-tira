// The daily board: one per calendar day in Manila time, the same for everyone, generated in the
// browser from the date alone. Each weekday samples boards from its profile and keeps the first one
// that passes its gates, so the week ramps from "know the rule" on Monday to long relays on Sunday.
// Profiles and gates follow the feasibility spike (SPIKE-REPORT.md in isang-tira-spike).
import { makeRng } from './prng.mjs';
import { makeBoard, distanceToUlo, isBurnt, nextTable } from './engine.mjs';
import { solve } from './solver.mjs';

export const EPOCH = '2026-09-28'; // puzzle #1
export const DAYS = ['Linggo', 'Lunes', 'Martes', 'Miyerkules', 'Huwebes', 'Biyernes', 'Sabado'];
export const MAX_CANDIDATES = 20000;

// The measured ramp has five tiers, not seven (see the report's "Does the week ramp?").
export const TIERS = {
  1: { name: 'Madali', blurb: 'Know the rules and you can see it.' },
  2: { name: 'Pasimula', blurb: 'One relay, maybe two.' },
  3: { name: 'Katamtaman', blurb: 'Follow the relays in your head.' },
  4: { name: 'Mahirap', blurb: 'Long lines, big captures.' },
  5: { name: 'Mahabang Tira', blurb: 'The long Sunday sowing.' },
};

// Sampling profiles, by weekday (0 = Sunday). shells: houses total; yPct: share on your row;
// yActive/lActive: occupied houses per row; plant: exact-to-ulo unplays; relayPlant: relay-into-ulo
// plants; burnt: burnt houses.
export const PROFILES = {
  1: { tier: 1, shells: [10, 24], yPct: [35, 55], yActive: [3, 4], lActive: [2, 5], maxHouse: 8, burnt: [0, 0], plant: [1, 1], relayPlant: [0, 0] },
  2: { tier: 2, shells: [10, 18], yPct: [42, 48], yActive: [4, 4], lActive: [2, 5], maxHouse: 8, burnt: [0, 0], plant: [0, 0], relayPlant: [1, 2] },
  3: { tier: 3, shells: [10, 29], yPct: [31, 51], yActive: [4, 5], lActive: [3, 5], maxHouse: 10, burnt: [0, 0], plant: [0, 0], relayPlant: [1, 4] },
  4: { tier: 3, shells: [13, 16], yPct: [46, 50], yActive: [4, 4], lActive: [3, 4], maxHouse: 11, burnt: [0, 0], plant: [0, 0], relayPlant: [2, 3] },
  5: { tier: 4, shells: [8, 16], yPct: [53, 54], yActive: [5, 7], lActive: [3, 3], maxHouse: 13, burnt: [2, 3], plant: [1, 6], relayPlant: [0, 0] },
  6: { tier: 4, shells: [16, 27], yPct: [32, 51], yActive: [5, 7], lActive: [2, 2], maxHouse: 14, burnt: [0, 0], plant: [2, 6], relayPlant: [0, 0] },
  0: { tier: 5, shells: [18, 40], yPct: [35, 60], yActive: [6, 7], lActive: [4, 7], maxHouse: 12, burnt: [0, 0], plant: [0, 0], relayPlant: [1, 2] },
};

// Gates, by weekday. Line-shape gates hold on every perfect line. randomMax caps the chance that
// random play reaches par, so no board is solved by flailing.
export const GATES = {
  1: { par: 3, sowings: [2, 4], relays: 0, gap: 0, randomMax: 0.35 },
  2: { par: 3, sowings: [2, 5], relays: 1, gap: 1, randomMax: 0.25 },
  3: { par: 3, sowings: [3, 6], relays: 2, gap: 1, randomMax: 0.15 },
  4: { par: 3, sowings: [3, 6], relays: 2, gap: 2, randomMax: 0.12, capture: true },
  5: { par: 3, sowings: [3, 6], relays: 2, gap: 2, randomMax: 0.12, burnt: [1, 3] },
  6: { par: 3, sowings: [4, 8], relays: 3, gap: 2, randomMax: 0.05 },
  0: { par: 3, sowings: [3, 8], relays: Infinity, gap: 1, randomMax: 0.08 },
};
const MAX_HANDFUL = 14, MAX_LINES = 3;

// ---------- dates, in Manila time (UTC+8, no daylight saving) ----------
const pad = (n) => String(n).padStart(2, '0');
export function manilaDate(now = new Date()) {
  const d = new Date(now.getTime() + 8 * 3600 * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
const dayMs = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
export const weekday = (iso) => new Date(dayMs(iso)).getUTCDay();
export const puzzleNumber = (iso) => Math.round((dayMs(iso) - dayMs(EPOCH)) / 86400000) + 1;
export const addDays = (iso, n) => { const d = new Date(dayMs(iso) + n * 86400000); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
// Milliseconds until the next Manila midnight, for the countdown.
export function msToNextPuzzle(now = new Date()) {
  const next = dayMs(addDays(manilaDate(now), 1)) - 8 * 3600 * 1000;
  return next - now.getTime();
}

// ---------- sampling ----------
function split(rng, total, parts, maxHouse) {
  // `parts` houses, each at least 1, summing to total, none over maxHouse (when possible)
  const out = Array(parts).fill(1);
  let left = total - parts;
  for (let guard = 0; left > 0 && guard < 10000; guard++) {
    const i = rng.int(parts);
    if (out[i] < maxHouse) { out[i]++; left--; }
  }
  return out;
}

export function sample(rng, p) {
  const Y = Array(7).fill(0), L = Array(7).fill(0);
  const burntY = [], burntL = [];
  const nb = rng.range(p.burnt[0], p.burnt[1]);
  const pool = rng.shuffle([...Array(14).keys()]);
  for (let k = 0; k < nb; k++) (pool[k] < 7 ? burntY : burntL).push(pool[k] % 7);
  const total = rng.range(p.shells[0], p.shells[1]);
  const yShells = Math.max(1, Math.round((total * rng.range(p.yPct[0], p.yPct[1])) / 100));
  const lShells = Math.max(1, total - yShells);
  const openY = [0, 1, 2, 3, 4, 5, 6].filter((i) => !burntY.includes(i));
  const openL = [0, 1, 2, 3, 4, 5, 6].filter((i) => !burntL.includes(i));
  const ya = Math.min(openY.length, yShells, rng.range(p.yActive[0], p.yActive[1]));
  const la = Math.min(openL.length, lShells, rng.range(p.lActive[0], p.lActive[1]));
  const yh = rng.shuffle(openY.slice()).slice(0, ya), lh = rng.shuffle(openL.slice()).slice(0, la);
  split(rng, yShells, ya, p.maxHouse).forEach((v, k) => { Y[yh[k]] = v; });
  split(rng, lShells, la, p.maxHouse).forEach((v, k) => { L[lh[k]] = v; });
  const burnt = burntY.reduce((m, i) => m | (1 << i), 0) | burntL.reduce((m, i) => m | (1 << (8 + i)), 0);
  const s = makeBoard(Y, L);
  for (let k = rng.range(p.plant[0], p.plant[1]); k > 0; k--) plant(rng, s, burnt, p.maxHouse);
  for (let k = rng.range(p.relayPlant[0], p.relayPlant[1]); k > 0; k--) relayPlant(rng, s, burnt, p.maxHouse);
  return { s, burnt };
}

// Tchoukaillon unplay: an empty house h gets exactly its distance to the ulo, taken one each from
// the houses between (which must all have a shell), so sowing h ends exactly in the ulo. Adds 1 shell.
function plant(rng, s, burnt, maxHouse) {
  const ok = [];
  for (let h = 0; h < 7; h++) {
    if (isBurnt(burnt, h) || s[h] !== 0) continue;
    const d = distanceToUlo(burnt, h);
    if (d > maxHouse) continue;
    let fine = true;
    for (let j = h + 1; j < 7; j++) if (!isBurnt(burnt, j) && s[j] === 0) fine = false;
    if (fine) ok.push(h);
  }
  if (!ok.length) return;
  const h = rng.pick(ok);
  s[h] = distanceToUlo(burnt, h);
  for (let j = h + 1; j < 7; j++) if (!isBurnt(burnt, j)) s[j]--;
}

// Relay into the ulo: house a's handful ends in house b, which then holds exactly b's distance to
// the ulo, so the relay ends in the ulo: an extra turn you only see by counting past the relay.
function relayPlant(rng, s, burnt, maxHouse) {
  const next = nextTable(burnt);
  const opts = [];
  for (let b = 1; b < 7; b++) {
    if (isBurnt(burnt, b)) continue;
    const db = distanceToUlo(burnt, b);
    if (db < 2 || db - 1 > maxHouse) continue;
    for (let a = 0; a < b; a++) {
      if (isBurnt(burnt, a)) continue;
      let n = 0;
      for (let p = a; p !== b; p = next[p]) n++;
      if (n <= maxHouse) opts.push([a, b, n, db]);
    }
  }
  if (!opts.length) return;
  const [a, b, n, db] = rng.pick(opts);
  s[a] = n;
  s[b] = db - 1;
}

// ---------- gates ----------
export function passes(sol, gate, burnt) {
  if (sol.capExceeded || !sol.lines || sol.perfectLines > MAX_LINES) return false;
  if (sol.par < gate.par || sol.greedyGap < gate.gap) return false;
  if (sol.sowingsMin < gate.sowings[0] || sol.sowingsMax > gate.sowings[1]) return false;
  const prob = Number(sol.randomParRate.n) / Number(sol.randomParRate.d);
  if (prob > gate.randomMax) return false;
  for (const l of sol.lines) {
    if (l.relaySegments > gate.relays || l.maxHandful > MAX_HANDFUL) return false;
    if (gate.capture && l.captures === 0) return false;
  }
  if (gate.burnt) {
    let n = 0;
    for (let i = 0; i < 15; i++) if (i !== 7 && isBurnt(burnt, i)) n++;
    if (n < gate.burnt[0] || n > gate.burnt[1]) return false;
  }
  return true;
}

const cache = new Map();

// The puzzle for a Manila date (YYYY-MM-DD). Deterministic: every browser gets the same board.
export function puzzleFor(iso) {
  if (cache.has(iso)) return cache.get(iso);
  const wd = weekday(iso);
  const p = PROFILES[wd], gate = GATES[wd];
  const rng = makeRng(`isang-tira:${iso}`);
  for (let i = 1; i <= MAX_CANDIDATES; i++) {
    const { s, burnt } = sample(rng, p);
    const sol = solve(s, burnt);
    if (!passes(sol, gate, burnt)) continue;
    const easiest = sol.easiest;
    const out = {
      iso, number: puzzleNumber(iso), weekday: wd, day: DAYS[wd], tier: p.tier, tierName: TIERS[p.tier].name,
      board: Array.from(s), burnt, par: sol.par, perfectLines: sol.perfectLines,
      lines: sol.lines.map((l) => l.moves), easiest: easiest.moves, candidate: i,
    };
    cache.set(iso, out);
    return out;
  }
  throw new Error(`no board for ${iso} in ${MAX_CANDIDATES} candidates`);
}
