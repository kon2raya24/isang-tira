// Builds assets/board/ from Poly Haven's "Sungka Board 02" (CC0, by Ulan Cabanilla): the carved board
// itself, the cowrie shells that come with it as a handful of templates, where each of the 16 holes is,
// and a resting place for every shell in every hole, worked out by dropping them in one at a time.
// usage: node tools/board.mjs [path to the downloaded model folder]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const SRC = process.argv[2] || '/private/var/www/others/bakbakan/.scratch/ph/sungka_board_02/';
const OUT = new URL('../assets/board/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const g = JSON.parse(readFileSync(SRC + 'sungka_board_02.gltf', 'utf8'));
const bin = readFileSync(SRC + 'sungka_board_02.bin');
function acc(i) {
  const a = g.accessors[i], bv = g.bufferViews[a.bufferView], n = { VEC3: 3, VEC2: 2, SCALAR: 1 }[a.type];
  const T = a.componentType === 5126 ? Float32Array : a.componentType === 5123 ? Uint16Array : Uint32Array;
  const off = bin.byteOffset + bv.byteOffset + (a.byteOffset || 0);
  return new T(bin.buffer.slice(off, off + a.count * n * T.BYTES_PER_ELEMENT));
}
const mesh = (k) => { const p = g.meshes[k].primitives[0]; return { pos: acc(p.attributes.POSITION), nor: acc(p.attributes.NORMAL), uv: acc(p.attributes.TEXCOORD_0), idx: acc(p.indices) }; };
const board = mesh(0), shells = mesh(1);

// ---------- the holes ----------
// Houses sit 97.55 mm apart in two rows 63 mm apart; the ulos are ovals at the ends.
const STEP = 0.09755, ROW = 0.0315, ULO_X = 0.3774;
const top = 0.0258;
// the height of the board's top surface, rasterised at 1 mm from its upward-facing triangles
const X0 = -0.47, Z0 = -0.11, CELL = 0.001, NX = 941, NZ = 191;
const H = new Float32Array(NX * NZ).fill(-1);
{
  const P = board.pos, I = board.idx;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ax = P[a], ay = P[a + 1], az = P[a + 2], bx = P[b], by = P[b + 1], bz = P[b + 2], cx = P[c], cy = P[c + 1], cz = P[c + 2];
    const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az); // y of the face normal (sign depends on winding)
    const area = Math.abs(ny);
    if (area < 1e-12) continue;
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - X0) / CELL)), i1 = Math.min(NX - 1, Math.ceil((Math.max(ax, bx, cx) - X0) / CELL));
    const j0 = Math.max(0, Math.floor((Math.min(az, bz, cz) - Z0) / CELL)), j1 = Math.min(NZ - 1, Math.ceil((Math.max(az, bz, cz) - Z0) / CELL));
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const x = X0 + i * CELL, z = Z0 + j * CELL;
      // barycentric
      const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      const w1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, w2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d, w3 = 1 - w1 - w2;
      if (w1 < -1e-6 || w2 < -1e-6 || w3 < -1e-6) continue;
      const y = w1 * ay + w2 * by + w3 * cy, k = j * NX + i;
      if (y > H[k]) H[k] = y;
    }
  }
}
const surf = (x, z) => {
  const fi = (x - X0) / CELL, fj = (z - Z0) / CELL, i = Math.max(0, Math.min(NX - 2, Math.floor(fi))), j = Math.max(0, Math.min(NZ - 2, Math.floor(fj))), u = fi - i, v = fj - j;
  const h = (a, b) => { const y = H[(j + b) * NX + i + a]; return y < 0 ? top : y; };
  return h(0, 0) * (1 - u) * (1 - v) + h(1, 0) * u * (1 - v) + h(0, 1) * (1 - u) * v + h(1, 1) * u * v;
};
// slots in the rules' order: 0-6 your houses (the near row, left to right), 7 your ulo (right end),
// 8-14 Lola's houses (the far row, right to left), 15 her ulo (left end)
const pits = [];
for (let i = 0; i < 7; i++) pits.push({ x: (i - 3) * STEP, z: ROW, r: 0.03 });
pits.push({ x: ULO_X, z: 0, rx: 0.062, rz: 0.041 });
for (let i = 0; i < 7; i++) pits.push({ x: (3 - i) * STEP, z: -ROW, r: 0.03 });
pits.push({ x: -ULO_X, z: 0, rx: 0.062, rz: 0.041 });
for (const p of pits) p.y = surf(p.x, p.z);

// ---------- the shells ----------
// The model's 67 shells are 7 sculpts placed many times; keep one of each, laid flat (back up, length
// along x), centred.
function components(m) {
  const n = m.pos.length / 3, par = Int32Array.from({ length: n }, (_, i) => i);
  const f = (i) => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
  const u = (a, b) => { a = f(a); b = f(b); if (a !== b) par[a] = b; };
  for (let t = 0; t < m.idx.length; t += 3) { u(m.idx[t], m.idx[t + 1]); u(m.idx[t], m.idx[t + 2]); }
  const groups = new Map();
  for (let i = 0; i < n; i++) { const r = f(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i); }
  return [...groups.values()];
}
function eig3(M) { // Jacobi, symmetric 3x3 -> [values, vectors(columns)]
  const a = M.map((r) => r.slice()), v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let s = 0; s < 50; s++) {
    let p = 0, q = 1; for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) if (Math.abs(a[i][j]) > Math.abs(a[p][q])) { p = i; q = j; }
    if (Math.abs(a[p][q]) < 1e-14) break;
    const th = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]), c = Math.cos(th), sn = Math.sin(th);
    for (let k = 0; k < 3; k++) { const x = a[k][p], y = a[k][q]; a[k][p] = c * x - sn * y; a[k][q] = sn * x + c * y; }
    for (let k = 0; k < 3; k++) { const x = a[p][k], y = a[q][k]; a[p][k] = c * x - sn * y; a[q][k] = sn * x + c * y; }
    for (let k = 0; k < 3; k++) { const x = v[k][p], y = v[k][q]; v[k][p] = c * x - sn * y; v[k][q] = sn * x + c * y; }
  }
  return [[a[0][0], a[1][1], a[2][2]], v];
}
const comps = components(shells);
// each shell is three pieces (the back, the lip, and a thin flat belly): for each belly, the two pieces nearest it
const cen = (vs) => { const c = [0, 0, 0]; for (const i of vs) for (let k = 0; k < 3; k++) c[k] += shells.pos[i * 3 + k] / vs.length; return c; };
const thin = (vs) => { const c = cen(vs); const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; for (const i of vs) { const d = [0, 1, 2].map((k) => shells.pos[i * 3 + k] - c[k]); for (let r = 0; r < 3; r++) for (let s2 = 0; s2 < 3; s2++) C[r][s2] += d[r] * d[s2]; } return Math.sqrt(Math.min(...eig3(C)[0]) / vs.length) < 0.0004; };
const info = comps.map((vs) => ({ vs, c: cen(vs), thin: thin(vs) }));
const seen = new Map();
for (const belly of info.filter((o) => o.thin)) {
  const near = info.filter((o) => !o.thin).sort((p1, p2) => Math.hypot(...p1.c.map((v, k) => v - belly.c[k])) - Math.hypot(...p2.c.map((v, k) => v - belly.c[k]))).slice(0, 2);
  const key = belly.vs.slice(0, 3).map((i) => shells.uv[i * 2].toFixed(3)).join();
  if (!seen.has(key)) seen.set(key, [...belly.vs, ...near[0].vs, ...near[1].vs]);
}
console.log('bellies', info.filter((o) => o.thin).length, 'unique shells', seen.size);
const LENGTH = [0.0185, 0.0195, 0.0205, 0.019, 0.02, 0.0178, 0.021]; // real sigay, about two centimetres long
const templates = [];
for (const vs of seen.values()) {
  const P = shells.pos, N = shells.nor, U = shells.uv;
  const c = cen(vs);
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const i of vs) { const d = [0, 1, 2].map((k) => P[i * 3 + k] - c[k]); for (let r = 0; r < 3; r++) for (let s = 0; s < 3; s++) C[r][s] += d[r] * d[s]; }
  const [vals, vecs] = eig3(C);
  const order = [0, 1, 2].sort((a, b) => vals[b] - vals[a]); // long, wide, flat
  let ax = order.map((k) => [vecs[0][k], vecs[1][k], vecs[2][k]]);
  const proj = (i, a) => (P[i * 3] - c[0]) * a[0] + (P[i * 3 + 1] - c[1]) * a[1] + (P[i * 3 + 2] - c[2]) * a[2];
  // which way is the back: the belly is flat, so the vertices crowd toward it
  const t = vs.map((i) => proj(i, ax[2])), mn = Math.min(...t), mx = Math.max(...t), mean = t.reduce((a, b) => a + b, 0) / t.length;
  if (mean > (mn + mx) / 2) ax[2] = ax[2].map((v) => -v);
  // right-handed: x = long, y = back (up), z = x × y
  const X = ax[0], Y = ax[2], Z = [X[1] * Y[2] - X[2] * Y[1], X[2] * Y[0] - X[0] * Y[2], X[0] * Y[1] - X[1] * Y[0]];
  const map = new Map(vs.map((v, k) => [v, k]));
  const pos = [], nor = [], uv = [], idx = [];
  let lo = [1, 1, 1], hi = [-1, -1, -1];
  for (const i of vs) {
    const d = [0, 1, 2].map((k) => P[i * 3 + k] - c[k]);
    const p = [X, Y, Z].map((a) => d[0] * a[0] + d[1] * a[1] + d[2] * a[2]);
    const n = [X, Y, Z].map((a) => N[i * 3] * a[0] + N[i * 3 + 1] * a[1] + N[i * 3 + 2] * a[2]);
    pos.push(...p); nor.push(...n); uv.push(U[i * 2], U[i * 2 + 1]);
    for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
  }
  // centred on its bounding box, scaled to a real sigay's length
  const mid = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2], k0 = LENGTH[templates.length % LENGTH.length] / (hi[0] - lo[0]);
  for (let k = 0; k < pos.length; k += 3) { pos[k] = (pos[k] - mid[0]) * k0; pos[k + 1] = (pos[k + 1] - mid[1]) * k0; pos[k + 2] = (pos[k + 2] - mid[2]) * k0; }
  const set = new Set(vs);
  for (let t2 = 0; t2 < shells.idx.length; t2 += 3) if (set.has(shells.idx[t2])) idx.push(map.get(shells.idx[t2]), map.get(shells.idx[t2 + 1]), map.get(shells.idx[t2 + 2]));
  templates.push({ pos, nor, uv, idx, size: [(hi[0] - lo[0]) * k0, (hi[1] - lo[1]) * k0, (hi[2] - lo[2]) * k0] });
}
console.log('templates', templates.map((t) => t.size.map((v) => (v * 1000).toFixed(1)).join('x')).join(' | '));

// ---------- resting places: shells dropped in one by one ----------
let seed = 20260930;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const HALF = 0.0034, RAD = 0.0064, SQ = 1.9; // a shell's half height; its reach sideways; how much flatter than a ball it stacks
function pile(p, N) {
  const out = [], ell = !!p.rx;
  for (let k = 0; k < N; k++) {
    let best = null;
    const grow = Math.min(1, 0.8 + k / 60); // big piles spread a little wider
    for (let s = 0; s < 420; s++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd());
      const x = p.x + Math.cos(a) * r * (ell ? p.rx - 0.011 : 0.023 * grow), z = p.z + Math.sin(a) * r * (ell ? p.rz - 0.01 : 0.023 * grow);
      let y = surf(x, z) + HALF, sup = null;
      for (const q of out) {
        const d = Math.hypot(q.x - x, q.z - z);
        if (d < 2 * RAD) { const yy = q.y + Math.sqrt(4 * RAD * RAD - d * d) / SQ; if (yy > y) { y = yy; sup = q; } }
      }
      const score = y + rnd() * 0.0012 + 0.02 * Math.hypot((x - p.x) / (ell ? p.rx : 0.03), (z - p.z) / (ell ? p.rz : 0.03)) * 0.02;
      if (!best || score < best.score) best = { x, y, z, score, sup };
    }
    // lying on what holds it up: the bowl's slope, or the shell underneath
    let nx, ny, nz;
    if (best.sup) { nx = best.x - best.sup.x; ny = (best.y - best.sup.y) * SQ; nz = best.z - best.sup.z; }
    else { const e = 0.002; nx = -(surf(best.x + e, best.z) - surf(best.x - e, best.z)) / (2 * e); nz = -(surf(best.x, best.z + e) - surf(best.x, best.z - e)) / (2 * e); ny = 1; }
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const tilt = 0.75; nx *= tilt; nz *= tilt; const l2 = Math.hypot(nx, ny, nz); nx /= l2; ny /= l2; nz /= l2;
    out.push({ x: best.x, y: best.y, z: best.z, n: [nx, ny, nz], yaw: rnd() * Math.PI * 2, flip: rnd() < 0.22 });
  }
  return out;
}
const layouts = pits.map((p, i) => pile(p, i === 7 || i === 15 ? 98 : 64));
// the handful in a hand: a cupped palm
const palm = (() => {
  const saved = surf;
  const out = [];
  for (let k = 0; k < 98; k++) {
    let best = null;
    for (let s = 0; s < 300; s++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 0.018, x = Math.cos(a) * r, z = Math.sin(a) * r * 0.8;
      let y = 0.03 - Math.sqrt(Math.max(0, 0.03 * 0.03 - r * r)) + HALF;
      for (const q of out) { const d = Math.hypot(q.x - x, q.z - z); if (d < 2 * RAD) y = Math.max(y, q.y + Math.sqrt(4 * RAD * RAD - d * d) / SQ); }
      const score = y + rnd() * 0.001;
      if (!best || score < best.score) best = { x, y, z, score };
    }
    out.push({ x: best.x, y: best.y, z: best.z, n: [0, 1, 0], yaw: rnd() * Math.PI * 2, flip: rnd() < 0.3 });
  }
  return out;
})();
const q = (v) => Math.round(v * 1e5); // 0.01 mm
const packPile = (l) => l.map((s) => [q(s.x), q(s.y), q(s.z), Math.round(s.n[0] * 1000), Math.round(s.n[1] * 1000), Math.round(s.n[2] * 1000), Math.round(s.yaw * 1000), s.flip ? 1 : 0]);

// ---------- write it all: one binary, one index ----------
const parts = [], index = { attribution: 'Sungka Board 02 by Ulan Cabanilla, Poly Haven (CC0)', top, step: STEP, row: ROW, pits: pits.map((p) => ({ x: +p.x.toFixed(5), y: +p.y.toFixed(5), z: +p.z.toFixed(5), ...(p.r ? { r: p.r } : { rx: p.rx, rz: p.rz }) })), meshes: {}, piles: layouts.map(packPile), palm: packPile(palm) };
let offset = 0;
const push = (arr, T) => { const a = T.from(arr); const b = Buffer.from(a.buffer); const o = offset; parts.push(b); offset += b.length; const pad = (4 - (offset % 4)) % 4; if (pad) { parts.push(Buffer.alloc(pad)); offset += pad; } return [o, a.length]; };
const addMesh = (name, m) => { index.meshes[name] = { pos: push(m.pos, Float32Array), nor: push(m.nor, Float32Array), uv: push(m.uv, Float32Array), idx: push(m.idx, m.pos.length / 3 > 65535 ? Uint32Array : Uint16Array), ...(m.size ? { size: m.size.map((v) => +v.toFixed(5)) } : {}) }; };
addMesh('board', { pos: Array.from(board.pos), nor: Array.from(board.nor), uv: Array.from(board.uv), idx: Array.from(board.idx) });
templates.forEach((t, k) => addMesh('shell' + k, t));
writeFileSync(OUT + 'sungka.bin', Buffer.concat(parts));
writeFileSync(OUT + 'sungka.json', JSON.stringify(index));
console.log('bin', (offset / 1024).toFixed(0), 'KB, json', (JSON.stringify(index).length / 1024).toFixed(0), 'KB');
// the textures, at 2k
const tx = SRC + 'textures2k/';
for (const [k, f, qual] of [['diff', 'sb_diff_2k.jpg', 85], ['nor', 'sb_nor_gl_2k.jpg', 88], ['arm', 'sb_arm_2k.jpg', 85]]) {
  execFileSync('python3', ['-c', `from PIL import Image; im = Image.open(${JSON.stringify(tx + f)}).convert('RGB'); im.save(${JSON.stringify(OUT + k + '.jpg')}, 'JPEG', quality=${qual}, optimize=True)`]);
}
console.log('done');
