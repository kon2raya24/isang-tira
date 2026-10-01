// The sungkaan and its sigay: Poly Haven's hand-carved "Sungka Board 02" (CC0, by Ulan Cabanilla),
// converted by tools/board.mjs into one binary, three 2k textures and an index. The index knows where
// each of the 16 holes is and has a resting place worked out for every shell in every hole, so a hole
// with 23 shells shows a real heap of 23. The shells are the model's own seven sculpts, instanced.
import * as THREE from './vendor/three.module.min.js';

export const SLOTS = 16;
const tl = new THREE.TextureLoader();

export async function loadSungka(base = 'assets/board/', onProgress = null) {
  let done = 0;
  const tick = () => { done++; if (onProgress) onProgress(done / 4); };
  const [index, bin, diff, nor, arm] = await Promise.all([
    fetch(base + 'sungka.json').then((r) => { if (!r.ok) throw new Error('no board'); return r.json(); }),
    fetch(base + 'sungka.bin').then((r) => { if (!r.ok) throw new Error('no board'); return r.arrayBuffer(); }).then((b) => { tick(); return b; }),
    ...['diff', 'nor', 'arm'].map((k) => tl.loadAsync(base + k + '.jpg').then((t) => { tick(); return t; })),
  ]);
  diff.colorSpace = THREE.SRGBColorSpace;
  for (const t of [diff, nor, arm]) { t.flipY = false; t.anisotropy = 8; }
  const geo = (m) => {
    const g = new THREE.BufferGeometry(), f = ([o, n]) => new Float32Array(bin, o, n);
    g.setAttribute('position', new THREE.BufferAttribute(f(m.pos), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(f(m.nor), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(f(m.uv), 2));
    const [o, n] = m.idx, big = m.pos[1] / 3 > 65535;
    g.setIndex(new THREE.BufferAttribute(big ? new Uint32Array(bin, o, n) : new Uint16Array(bin, o, n), 1));
    g.computeBoundingSphere();
    return g;
  };
  const shells = Object.keys(index.meshes).filter((k) => k.startsWith('shell')).map((k) => ({ geo: geo(index.meshes[k]), size: index.meshes[k].size }));
  return { index, board: geo(index.meshes.board), shells, tex: { diff, nor, arm } };
}

// Varnished narra for the board; the shells get the same maps but a porcelain gloss.
export function sungkaMaterials(lib, { low = false } = {}) {
  const { diff, nor, arm } = lib.tex;
  const board = new THREE.MeshPhysicalMaterial({
    map: diff, normalMap: nor, normalScale: new THREE.Vector2(1, 1), roughnessMap: arm, metalnessMap: arm, aoMap: arm, aoMapIntensity: 1,
    roughness: 0.78, metalness: 0, clearcoat: low ? 0 : 0.3, clearcoatRoughness: 0.4, sheen: 0, color: '#ffffff',
  });
  const shell = new THREE.MeshPhysicalMaterial({
    map: diff, normalMap: nor, normalScale: new THREE.Vector2(0.7, 0.7), aoMap: arm, aoMapIntensity: 0.6,
    roughness: 0.38, metalness: 0, clearcoat: low ? 0.2 : 0.6, clearcoatRoughness: 0.15, color: '#f2e8d6',
  });
  return { board, shell };
}

// The pose of the k-th shell resting in a hole (or in the cupped palm): position, then which way it
// lies, turned about that, belly down or (sometimes) back down.
const up = new THREE.Vector3(0, 1, 0), nv = new THREE.Vector3(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qf = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
export function restPose(entry, pos, quat) {
  const [x, y, z, nx, ny, nz, yaw, flip] = entry;
  pos.set(x / 1e5, y / 1e5, z / 1e5);
  nv.set(nx, ny, nz).normalize();
  qa.setFromUnitVectors(up, nv);
  qb.setFromAxisAngle(up, yaw / 1000);
  quat.copy(qa).multiply(qb);
  if (flip) quat.multiply(qf);
  return pos;
}
