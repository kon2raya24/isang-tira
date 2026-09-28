// The ten playtest boards (with their solver-checked perfect lines), kept as fixtures for the engine,
// preview and event tests.
import { readFileSync } from 'node:fs';

const P = JSON.parse(readFileSync(new URL('./playtest-boards.json', import.meta.url), 'utf8'));
const W = P.playtest.Wednesday.picks;
export const boards = [
  ...P.playtest.Monday.picks.map((b, i) => ({ ...b, code: `M${i + 1}` })),
  ...[W[0], W[2], W[1], W[3]].map((b, i) => ({ ...b, code: `W${i + 1}` })),
  ...P.playtest.Saturday.picks.map((b, i) => ({ ...b, code: `S${i + 1}` })),
];
