// Drop-by-drop events for one sowing, derived from engine.mjs so the animation can never
// disagree with the rules. Applying the events in order to a copy of the state gives exactly
// the state that sow() / turnEnd() return.
import { ULO, opposite, nextTable, sow, turnEnd } from './engine.mjs';

export function sowEvents(state, burnt, house, next = nextTable(burnt)) {
  const result = sow(state, burnt, house, next);
  const events = [];
  let pos = house;
  result.handfuls.forEach((n, i) => {
    events.push({ t: i === 0 ? 'lift' : 'relay', slot: pos, n });
    for (let k = 0; k < n; k++) {
      pos = next[pos];
      events.push({ t: 'drop', slot: pos });
    }
  });
  if (pos !== result.last) throw new Error(`events walk ended at ${pos}, engine at ${result.last}`);
  if (result.outcome === 'extra') events.push({ t: 'extra', slot: ULO });
  else if (result.outcome === 'capture') events.push({ t: 'capture', slot: pos, opp: opposite(pos), n: result.captured });
  else events.push({ t: result.outcome, slot: pos });
  return { events, result };
}

export function turnEndEvents(state, burnt) {
  const result = turnEnd(state, burnt);
  return { events: result.swept ? [{ t: 'sweep', n: result.swept }] : [], result };
}

// Apply one event to s (a Uint8Array(16)) in place. Throws if the event does not fit the state.
// Captures and sweeps go to e.ulo (your ulo if absent), so Lola's moves in a match replay too.
export function applyEvent(s, e) {
  switch (e.t) {
    case 'lift':
    case 'relay':
      if (s[e.slot] !== e.n) throw new Error(`${e.t} ${e.n} from slot ${e.slot} holding ${s[e.slot]}`);
      s[e.slot] = 0;
      break;
    case 'drop':
      s[e.slot]++;
      break;
    case 'capture':
      if (s[e.slot] !== 1 || s[e.opp] + 1 !== e.n) throw new Error(`capture ${e.n} does not fit slots ${e.slot}/${e.opp}`);
      s[e.slot] = 0;
      s[e.opp] = 0;
      s[e.ulo ?? ULO] += e.n;
      break;
    case 'sweep': { // the mover's houses (yours unless the event says Lola's) into the mover's ulo
      const base = e.side === 'lola' ? 8 : 0;
      let t = 0;
      for (let h = base; h < base + 7; h++) { t += s[h]; s[h] = 0; }
      if (t !== e.n) throw new Error(`sweep ${e.n} but the houses held ${t}`);
      s[e.ulo ?? ULO] += t;
      break;
    }
    case 'extra':
    case 'dud':
    case 'end':
      break;
    default:
      throw new Error(`unknown event ${e.t}`);
  }
  return s;
}
