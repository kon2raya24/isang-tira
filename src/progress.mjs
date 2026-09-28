// Your record for each day, streaks, stats and the share text. Pure: the page does the storage.
import { addDays } from './daily.mjs';

export const MAX_TRIES = 3;
const VERSION = 1;

export const newRecord = (p, daily = true) => ({ iso: p.iso, par: p.par, tries: [], best: 0, done: false, won: false, parTry: null, whisper: false, daily });

// One finished turn. Reaching par, or using the last try, ends the day.
export function recordTry(r, score) {
  if (r.done) throw new Error('the day is over');
  const tries = [...r.tries, score];
  const won = score >= r.par;
  return { ...r, tries, best: Math.max(r.best, score), won: r.won || won, parTry: r.parTry ?? (won ? tries.length : null), done: won || tries.length >= MAX_TRIES };
}

// Lola whispers the whole sowing of each house, but only once you've tried on your own.
export function useWhisper(r) {
  if (!r.tries.length) throw new Error('try it yourself first');
  return r.whisper ? r : { ...r, whisper: true };
}

export const tryMark = (score, par) => (score >= par ? '🐚' : score >= par - 2 ? '🟡' : '⚫');

export function shareText(p, r, url) {
  const marks = r.tries.map((s) => tryMark(s, p.par)).join('');
  const how = r.won ? (r.parTry === 1 ? 'sa unang tira!' : `sa ika-${r.parTry} tira`) : 'hindi umabot';
  return [`Isang Tira #${p.number} · ${p.day} · ${p.tierName}`, `${marks} ${r.best}/${p.par} ${how}${r.whisper ? ' 👵' : ''}`, url].filter(Boolean).join('\n');
}

// Stats over daily games only (archive games are practice). The streak counts consecutive days that
// reached par, ending today or, if today isn't finished yet, yesterday.
export function stats(records, today) {
  const daily = Object.values(records).filter((r) => r.daily && r.done);
  const won = new Set(daily.filter((r) => r.won).map((r) => r.iso));
  const dist = { 1: 0, 2: 0, 3: 0, miss: 0 };
  for (const r of daily) { if (r.won) dist[r.parTry]++; else dist.miss++; }
  let streak = 0, day = records[today]?.done ? today : addDays(today, -1);
  while (won.has(day)) { streak++; day = addDays(day, -1); }
  let maxStreak = 0, run = 0;
  for (const iso of [...won].sort()) { run = won.has(addDays(iso, -1)) ? run + 1 : 1; maxStreak = Math.max(maxStreak, run); }
  return { played: daily.length, wins: won.size, streak, maxStreak, dist };
}

export function migrate(saved) {
  const fresh = { v: VERSION, records: {}, seenRules: false, muted: false };
  if (!saved || typeof saved !== 'object' || saved.v !== VERSION) return fresh;
  const records = {};
  for (const [k, r] of Object.entries(saved.records || {})) if (r && typeof r === 'object' && Array.isArray(r.tries) && /^\d{4}-\d{2}-\d{2}$/.test(k)) records[k] = r;
  return { ...fresh, records, seenRules: !!saved.seenRules, muted: !!saved.muted };
}
