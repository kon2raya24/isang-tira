// The offline cache must list every file the game loads, or it breaks without a connection.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const assets = JSON.parse(sw.match(/const ASSETS = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));

test('every source module, three.js, the board, the sala and its sounds, and every icon are precached, and every precached file exists', () => {
  const testOnly = new Set(['reference.mjs', 'helper-data.mjs']);
  for (const f of readdirSync(new URL('../src', import.meta.url))) if (f.endsWith('.mjs') && !testOnly.has(f)) assert.ok(assets.includes(`src/${f}`), `src/${f} missing from sw.js`);
  for (const v of ['three.module.min.js', 'three-fx.min.js', 'three-mocap.min.js']) assert.ok(assets.includes(`src/vendor/${v}`), `${v} missing from sw.js`);
  for (const d of ['assets/board', 'assets/env/props', 'assets/env/tex', 'assets/env/sky', 'assets/sfx']) for (const f of readdirSync(new URL(`../${d}`, import.meta.url))) if (!f.endsWith('.txt')) assert.ok(assets.includes(`${d}/${f}`), `${d}/${f} missing from sw.js`);
  const manifest = JSON.parse(readFileSync(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));
  for (const i of manifest.icons) assert.ok(assets.includes(i.src), `${i.src} missing from sw.js`);
  for (const a of assets.filter((x) => x !== './')) assert.ok(existsSync(new URL(`../${a}`, import.meta.url)), `${a} does not exist`);
});
