// Real things for Lola's sala, CC0 scans from Poly Haven (converted by the Bakbakan tools):
// - surfaces: the narra floor, the lacquered table, the plaster and the carved wall panels, the window's wood
// - props: her gallinera chair and chest, spectacles, a carved bowl, a clock, a lamp, a vase, a plant...
// - a photographed interior for light and reflections
// Anything that fails to load leaves the plain stand-in where it was.
import * as THREE from './vendor/three.module.min.js';
import { GLTFLoader } from './vendor/three-mocap.min.js';
import { HDRLoader } from './vendor/three-fx.min.js';

export async function loadEnv(base = 'assets/env/') {
  const res = await fetch(base + 'env.json');
  if (!res.ok) throw new Error('no env');
  return { base, index: await res.json(), props: new Map(), tex: new Map(), sky: new Map() };
}

const gltf = new GLTFLoader(), texLoader = new THREE.TextureLoader();

export function loadProp(env, id) {
  if (!env || !env.index.props[id]) return Promise.resolve(null);
  if (!env.props.has(id)) env.props.set(id, gltf.loadAsync(env.base + 'props/' + id + '.glb').then((g) => {
    g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g.scene;
  }).catch(() => null));
  return env.props.get(id);
}

export function loadTex(env, id) {
  const t = env && env.index.tex[id];
  if (!t) return Promise.resolve(null);
  if (!env.tex.has(id)) env.tex.set(id, Promise.all(['diff', 'nor', 'arm'].map((k) => (t[k] ? texLoader.loadAsync(env.base + t[k]).catch(() => null) : null))).then(([diff, nor, arm]) => {
    if (diff) diff.colorSpace = THREE.SRGBColorSpace;
    for (const x of [diff, nor, arm]) if (x) { x.wrapS = x.wrapT = THREE.RepeatWrapping; x.anisotropy = 8; }
    return { diff, nor, arm };
  }));
  return env.tex.get(id);
}

// A scanned surface on a stand-in material: repeat is how many tiles across [u, v].
export async function dressMaterial(env, m, id, repeat = [1, 1], { rough = 1, tint = null, normal = 1, rot = 0, flatRough = false } = {}) {
  const t = await loadTex(env, id);
  if (!t || !t.diff) return false;
  const use = (x) => { if (!x) return null; const c = x.clone(); c.repeat.set(...repeat); c.rotation = rot; c.needsUpdate = true; return c; };
  m.map = use(t.diff); m.normalMap = use(t.nor); if (m.normalScale) m.normalScale.set(normal, normal);
  if (t.arm) { if (!flatRough) m.roughnessMap = use(t.arm); m.aoMap = use(t.arm); m.aoMapIntensity = 0.7; }
  m.roughness = rough; m.metalness = 0; m.color.set(tint || '#ffffff');
  m.needsUpdate = true;
  return true;
}

export function loadSky(env, id, pmrem) {
  const f = env && env.index.sky[id];
  if (!f) return Promise.resolve(null);
  if (!env.sky.has(id)) env.sky.set(id, new HDRLoader().loadAsync(env.base + f).then((t) => { t.mapping = THREE.EquirectangularReflectionMapping; const rt = pmrem.fromEquirectangular(t); t.dispose(); return rt.texture; }).catch(() => null));
  return env.sky.get(id);
}
