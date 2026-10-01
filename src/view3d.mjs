// The 3D view of Isang Tira, in three.js: Lola Iska's sala on a sunny afternoon, the carved sungkaan on
// her table, and every sigay as a real shell. It only shows what the rules say: the page hands it the
// rules' own events (a lift, each drop, a relay, a capture...) and it plays them, shell by shell, then
// tells the page when it is done. It never changes the game.
//
// Slots are the rules' numbering: 0-6 your houses, 7 your ulo, 8-14 Lola's houses, 15 her ulo.
import * as THREE from './vendor/three.module.min.js';
import { createPost } from './post.mjs';
import { loadSungka, sungkaMaterials, restPose } from './sungka3d.mjs';
import { buildRoom, FLOOR, WALL_Z, WINDOW, GAP } from './room.mjs';
import { loadEnv, loadSky, loadProp } from './envpack.mjs';
import * as T from './tex.mjs';

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOut = (t) => 1 - (1 - t) ** 3;
const ULO = 7, LOLA_ULO = 15;
const isHouse = (i) => i !== ULO && i !== LOLA_ULO;
const BOARD_TOP = 0.0258;
const HOVER = 0.085; // how high a handful travels over the board
const BOWL = new THREE.Vector3(-0.62, 0, 0.22); // Lola's bowl of spare shells
let rs = 20260930;
const rnd = () => ((rs = (rs * 16807) % 2147483647) / 2147483647);

export async function createView({ canvas, overlay, gfx = null, low = false, onProgress = null, test = false } = {}) {
  // ---------- the renderer ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: test });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1.25 : 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1b120c');
  const camera = new THREE.PerspectiveCamera(38, 1, 0.02, 30);
  scene.add(camera);
  const fixed = gfx !== null && gfx !== '' && gfx !== 'auto';
  const post = createPost(renderer, scene, camera, { level: fixed ? +gfx : low ? 1 : 2, auto: !fixed });
  const pmrem = new THREE.PMREMGenerator(renderer);

  // ---------- the room ----------
  const room = buildRoom({ low });
  scene.add(room.group);

  // ---------- light: a low afternoon sun through the window, the capiz lamp over the table ----------
  const hemi = new THREE.HemisphereLight('#ffe6c8', '#4a2e1c', 0.55);
  scene.add(hemi);
  const sunDir = new THREE.Vector3(0.36, -0.52, 1).normalize(); // toward the room, from the garden
  const sun = new THREE.DirectionalLight('#ffc98a', 3.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -2.2, right: 2.2, top: 1.8, bottom: -1.8, near: 0.5, far: 9 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.01; sun.shadow.radius = 2.5;
  sun.target.position.set(0.3, -0.2, -0.3);
  sun.position.copy(sun.target.position).addScaledVector(sunDir, -5);
  scene.add(sun, sun.target);
  // the rest of the window's light: soft, from behind Lola
  const windowFill = new THREE.DirectionalLight('#ffe4c4', 0.9);
  windowFill.position.set(0.2, 1.2, -1.4); windowFill.target.position.set(0, 0, 0.3);
  scene.add(windowFill, windowFill.target);
  const lamp = new THREE.SpotLight('#ffcf93', 6, 3.2, 0.6, 0.85, 2);
  lamp.position.set(0, 1.3, 0.05); lamp.target.position.set(0, 0, 0);
  lamp.castShadow = true; lamp.shadow.mapSize.set(low ? 512 : 1024, low ? 512 : 1024); lamp.shadow.bias = -0.00025; lamp.shadow.normalBias = 0.004; lamp.shadow.radius = 3;
  lamp.shadow.camera.near = 0.3; lamp.shadow.camera.far = 2.2;
  scene.add(lamp, lamp.target);
  // a light that follows your choice, so the shells in the chosen house glint
  const pick = new THREE.PointLight('#ffd98a', 0, 0.35, 2);
  scene.add(pick);
  // light shafts in the dusty air, from the open part of the window
  const shaftTex = T.shaft();
  const shafts = new THREE.Group();
  const shaftMat = new THREE.MeshBasicMaterial({ map: shaftTex, color: new THREE.Color(1.0, 0.86, 0.62), transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  for (let k = 0; k < 4; k++) {
    const len = 3.2, w = 0.5 + k * 0.08;
    const g = new THREE.PlaneGeometry(w, len); g.translate(0, -len / 2, 0);
    const m = new THREE.Mesh(g, shaftMat);
    const o = new THREE.Object3D();
    o.position.set(lerp(GAP.x0, GAP.x1, 0.2 + k * 0.2), lerp(WINDOW.y0, WINDOW.y1, 0.55 + (k % 2) * 0.2), WALL_Z + 0.05);
    o.lookAt(o.position.clone().add(sunDir));
    m.rotation.x = -Math.PI / 2; m.rotation.y = (k - 1.5) * 0.5;
    o.add(m); shafts.add(o);
  }
  scene.add(shafts);

  // ---------- the board and its shells ----------
  const lib = await loadSungka('assets/board/', (f) => onProgress && onProgress(0.15 + f * 0.6));
  const M = sungkaMaterials(lib, { low });
  const board = new THREE.Mesh(lib.board, M.board);
  board.castShadow = true; board.receiveShadow = true; board.name = 'sungkaan';
  scene.add(board);
  const pits = lib.index.pits.map((p, i) => ({ ...p, i, v: new THREE.Vector3(p.x, BOARD_TOP, p.z) }));
  const piles = lib.index.piles, palm = lib.index.palm;

  // the shells: up to 98, each its own sculpt and size, drawn instanced by sculpt
  const N = 98, V = lib.shells.length;
  const shells = [];
  const byVar = Array.from({ length: V }, () => []);
  for (let i = 0; i < N; i++) {
    const v = (i * 5 + Math.floor(i / 7)) % V;
    const s = { id: i, v, k: byVar[v].length, scale: 0.9 + rnd() * 0.18, pos: new THREE.Vector3(), quat: new THREE.Quaternion(), at: -1, fly: null, bounce: 0, visible: false, landed: true };
    byVar[v].push(s); shells.push(s);
  }
  const inst = lib.shells.map((t, v) => { const m = new THREE.InstancedMesh(t.geo, M.shell, byVar[v].length); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; scene.add(m); return m; });
  const slots = Array.from({ length: 16 }, () => []); // shell ids resting in (or flying to) each slot
  let burnt = 0;

  // Lola's bowl of spare shells, beside the board: where the shells wait when a puzzle uses fewer
  const bowlStand = new THREE.Mesh(new THREE.LatheGeometry([[0.03, 0], [0.05, 0.004], [0.07, 0.03], [0.078, 0.06], [0.072, 0.062], [0.062, 0.035], [0.035, 0.016], [0, 0.014]].map(([x, y]) => new THREE.Vector2(x, y)), 28), new THREE.MeshStandardMaterial({ color: '#5a3219', roughness: 0.5 }));
  bowlStand.position.copy(BOWL); bowlStand.castShadow = bowlStand.receiveShadow = true; scene.add(bowlStand);
  const pool = []; // resting places in the bowl
  {
    const R = 0.085, yb = 0.018, rMax = 0.055, out = [];
    for (let k = 0; k < N; k++) {
      let best = null;
      for (let t = 0; t < 260; t++) {
        const a = rnd() * TAU, r = Math.sqrt(rnd()) * rMax, x = Math.cos(a) * r, z = Math.sin(a) * r;
        let y = yb + R - Math.sqrt(R * R - r * r) + 0.0034, sup = null;
        for (const q of out) { const d = Math.hypot(q.x - x, q.z - z); if (d < 0.0128) { const yy = q.y + Math.sqrt(0.0128 * 0.0128 - d * d) / 1.9; if (yy > y) { y = yy; sup = q; } } }
        const sc = y + rnd() * 0.0015;
        if (!best || sc < best.sc) best = { x, y, z, sc, sup };
      }
      const n = best.sup ? new THREE.Vector3(best.x - best.sup.x, (best.y - best.sup.y) * 1.9, best.z - best.sup.z) : new THREE.Vector3(-best.x, R, -best.z);
      n.normalize(); n.x *= 0.7; n.z *= 0.7; n.normalize();
      out.push(best);
      pool.push([Math.round((best.x + BOWL.x) * 1e5), Math.round((best.y + BOWL.y) * 1e5), Math.round((best.z + BOWL.z) * 1e5), Math.round(n.x * 1000), Math.round(n.y * 1000), Math.round(n.z * 1000), Math.round(rnd() * 6283), rnd() < 0.25 ? 1 : 0]);
    }
  }
  const spare = []; // shell ids in the bowl
  const bowlPose = (k, pos, quat) => restPose(pool[Math.min(k, pool.length - 1)], pos, quat);

  // where the k-th shell in a slot rests
  const tmpQ = new THREE.Quaternion();
  function slotPose(slot, k, pos, quat) {
    const list = piles[slot], e = list[Math.min(k, list.length - 1)];
    restPose(e, pos, quat);
    if (k >= list.length) pos.y += (k - list.length + 1) * 0.004; // (a pile taller than we planned for)
    return pos;
  }

  // ---------- the hand: a handful of shells travelling over the board ----------
  const hand = { on: false, who: 'you', pos: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(), t0: 0, dur: 0, ids: [], fade: 0, tilt: new THREE.Vector3() };
  const hoverAt = (slot, out = new THREE.Vector3()) => out.copy(pits[slot].v).setY(BOARD_TOP + HOVER + (isHouse(slot) ? 0 : 0.01));
  const palmQ = new THREE.Quaternion(), palmE = new THREE.Euler();
  function palmPose(k, pos, quat, t) {
    const e = palm[Math.min(k, palm.length - 1)];
    restPose(e, pos, quat);
    // the cupped handful turns slowly and leans the way it is going
    palmE.set(hand.tilt.z * 2.2, t * 0.6, -hand.tilt.x * 2.2); palmQ.setFromEuler(palmE);
    pos.applyQuaternion(palmQ); quat.premultiply(palmQ);
    pos.add(hand.pos);
    return pos;
  }

  // ---------- flights ----------
  let vt = 0, timeScale = 1, slowUntil = 0; // the view's own clock (slows for a beat on big moments)
  const flights = new Set();
  const P0 = new THREE.Vector3(), P1 = new THREE.Vector3(), Q0 = new THREE.Quaternion(), Q1 = new THREE.Quaternion(), CTRL = new THREE.Vector3();
  function launch(s, toPos, toQuat, dur, { arc = 0.03, spin = 1, delay = 0, onLand = null } = {}) {
    s.fly = { p0: s.pos.clone(), q0: s.quat.clone(), p1: toPos.clone(), q1: toQuat.clone(), t0: vt + delay, dur: Math.max(0.06, dur), arc, axis: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(), spin: spin * (0.6 + rnd() * 0.8) * TAU, onLand };
    s.landed = false; s.visible = true;
    flights.add(s);
  }
  function stepFlights() {
    for (const s of flights) {
      const f = s.fly, u = clamp((vt - f.t0) / f.dur, 0, 1);
      if (u <= 0) { s.pos.copy(f.p0); s.quat.copy(f.q0); continue; }
      const k = u, top = Math.max(f.p0.y, f.p1.y) + f.arc;
      CTRL.set((f.p0.x + f.p1.x) / 2, top + f.arc * 0.6, (f.p0.z + f.p1.z) / 2);
      // a quadratic arc, falling faster at the end, like a thrown shell
      const w = k < 1 ? k * (0.85 + 0.15 * k) : 1;
      s.pos.set(0, 0, 0).addScaledVector(f.p0, (1 - w) ** 2).addScaledVector(CTRL, 2 * (1 - w) * w).addScaledVector(f.p1, w * w);
      s.quat.slerpQuaternions(f.q0, f.q1, easeOut(k));
      if (k < 1) { tmpQ.setFromAxisAngle(f.axis, f.spin * (1 - easeOut(k))); s.quat.premultiply(tmpQ); }
      if (u >= 1) { flights.delete(s); s.fly = null; s.landed = true; s.bounce = 1; s.pos.copy(f.p1); s.quat.copy(f.q1); if (f.onLand) f.onLand(s); }
    }
  }
  const STALE = new Error('stale');
  const waiters = [];
  const wait = (sec) => new Promise((r) => waiters.push({ at: vt + sec, r }));
  function stepWaiters() { for (let i = waiters.length - 1; i >= 0; i--) if (vt >= waiters[i].at) { waiters[i].r(); waiters.splice(i, 1); } }
  const waitRaw = (sec) => wait(sec);
  const settleRaw = () => settle();
  function settle() { if (!flights.size) return Promise.resolve(); return new Promise((r) => { const check = () => (flights.size ? waiters.push({ at: vt + 0.02, r: check }) : r()); check(); }); }

  // ---------- the counts, as a quiet label by each hole ----------
  const labels = [];
  const labelLayer = document.createElement('div'); labelLayer.className = 'labels'; labelLayer.setAttribute('aria-hidden', 'true');
  overlay.appendChild(labelLayer);
  for (let i = 0; i < 16; i++) {
    const el = document.createElement('div'); el.className = `cnt${isHouse(i) ? '' : ' big'}${i >= 8 ? ' hers' : ''}`;
    el.innerHTML = isHouse(i) ? '<b>0</b>' : `<small>${i === ULO ? 'Ikaw' : 'Lola'}</small><b>0</b>`;
    labelLayer.appendChild(el);
    labels.push({ el, b: el.querySelector('b'), n: -1, anchor: new THREE.Vector3() });
  }
  const handTag = document.createElement('div'); handTag.className = 'cnt inhand'; handTag.innerHTML = '<b>0</b>'; labelLayer.appendChild(handTag);
  const handTagB = handTag.querySelector('b');
  let showLabels = true;
  function anchors(aspect) {
    // just outside each hole, on the side facing its owner; the ulos beyond their ends
    for (let i = 0; i < 16; i++) {
      const p = pits[i], a = labels[i].anchor;
      if (i === ULO || i === LOLA_ULO) a.set(p.x + Math.sign(p.x) * 0.085, BOARD_TOP, 0);
      else a.set(p.x, BOARD_TOP, p.z + Math.sign(p.z) * 0.047);
    }
  }
  const proj = new THREE.Vector3();
  function toScreen(v, out) { proj.copy(v).project(camera); out.x = (proj.x * 0.5 + 0.5) * W; out.y = (-proj.y * 0.5 + 0.5) * H; out.z = proj.z; return out; }
  const scr = { x: 0, y: 0, z: 0 };
  function landedCount(slot) { let n = 0; for (const id of slots[slot]) if (shells[id].landed) n++; return n; }
  function stepLabels() {
    labelLayer.hidden = !showLabels || mode === 'title';
    if (labelLayer.hidden) return;
    for (let i = 0; i < 16; i++) {
      const L = labels[i];
      const n = isBurnt(i) ? -2 : landedCount(i);
      if (n !== L.n) {
        const up = L.n >= 0 && n > L.n;
        L.n = n; L.b.textContent = n === -2 ? '✕' : String(n);
        L.el.classList.toggle('zero', n === 0); L.el.classList.toggle('burnt', n === -2);
        if (up) { L.el.classList.remove('pop'); void L.el.offsetWidth; L.el.classList.add('pop'); }
      }
      toScreen(L.anchor, scr);
      L.el.style.transform = `translate3d(${scr.x.toFixed(1)}px, ${scr.y.toFixed(1)}px, 0) translate(-50%, -50%)`;
      L.el.classList.toggle('sel', i === selected || targets.includes(i));
    }
    const inHand = hand.on ? hand.ids.length : 0;
    handTag.hidden = !inHand; handTag.classList.toggle('hers', hand.who === 'lola');
    if (inHand) { handTagB.textContent = String(inHand); toScreen(P0.copy(hand.pos).setY(hand.pos.y + 0.04), scr); handTag.style.transform = `translate3d(${scr.x.toFixed(1)}px, ${scr.y.toFixed(1)}px, 0) translate(-50%, -100%)`; }
    for (const f of floats) { toScreen(f.at, scr); const u = clamp((vt - f.t0) / f.dur, 0, 1); f.el.style.transform = `translate3d(${scr.x.toFixed(1)}px, ${(scr.y - u * 60).toFixed(1)}px, 0) translate(-50%, -50%) scale(${(1 + 0.25 * Math.sin(Math.min(1, u * 4) * Math.PI)).toFixed(3)})`; f.el.style.opacity = String(u < 0.75 ? 1 : 1 - (u - 0.75) / 0.25); }
  }
  // words that float up from the board: +8, ISA PA!
  const floats = new Set();
  function floatText(slot, text, cls = '') {
    const el = document.createElement('div'); el.className = `float ${cls}`; el.textContent = text; labelLayer.appendChild(el);
    const f = { el, at: pits[slot].v.clone().setY(BOARD_TOP + 0.06), t0: vt, dur: 1.6 };
    floats.add(f);
    wait(f.dur).then(() => { el.remove(); floats.delete(f); });
  }

  // ---------- rings: your houses, your choice, where it lands ----------
  const ringGeo = new THREE.RingGeometry(0.0305, 0.0345, 48);
  ringGeo.rotateX(-Math.PI / 2);
  const rings = pits.map((p, i) => {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    m.position.set(p.x, BOARD_TOP + 0.0012, p.z);
    if (!isHouse(i)) m.scale.set(p.rx / 0.032, 1, p.rz / 0.032);
    m.renderOrder = 2; scene.add(m);
    return m;
  });
  const dashTex = T.dashRing();
  const targetMat = new THREE.MeshBasicMaterial({ map: dashTex, color: new THREE.Color(1.6, 1.3, 0.8), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const targetMeshes = Array.from({ length: 6 }, () => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.1).rotateX(-Math.PI / 2), targetMat); m.visible = false; m.renderOrder = 3; scene.add(m); return m; });
  let legal = [], selected = null, hover = null, focus = null, targets = [], whole = false;
  const stopTags = [];

  // ---------- a burnt house: charcoal in the bowl, embers in the cracks ----------
  const scorchMat = new THREE.MeshStandardMaterial({ map: T.scorch(), transparent: true, depthWrite: false, roughness: 1, emissiveMap: T.embers(), emissive: new THREE.Color('#ff6a1a'), emissiveIntensity: 1.2, polygonOffset: true, polygonOffsetFactor: -2 });
  const scorchGeo = (() => { const g = new THREE.CircleGeometry(0.029, 32, 0, TAU); g.rotateX(-Math.PI / 2); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const r = Math.hypot(p.getX(i), p.getZ(i)); p.setY(i, 0.0069 + 16.3 * r * r - BOARD_TOP + 0.0008); } g.computeVertexNormals(); return g; })();
  const scorches = pits.map((p, i) => { if (!isHouse(i)) return null; const m = new THREE.Mesh(scorchGeo, scorchMat); m.position.set(p.x, BOARD_TOP, p.z); m.visible = false; m.receiveShadow = true; m.renderOrder = 1; scene.add(m); return m; });
  const isBurnt = (i) => isHouse(i) && ((burnt >>> i) & 1) === 1;

  // ---------- sparks, dust in the sun, steam from the coffee ----------
  const glowTex = T.glow();
  const MAXP = 400;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(MAXP * 3), pCol = new Float32Array(MAXP * 3), pSize = new Float32Array(MAXP);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3)); pGeo.setAttribute('size', new THREE.BufferAttribute(pSize, 1));
  const pMat = new THREE.ShaderMaterial({
    uniforms: { map: { value: glowTex }, scale: { value: 400 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    vertexShader: 'attribute float size; varying vec3 vC; uniform float scale; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform sampler2D map; varying vec3 vC; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC * t.a, t.a); }',
  });
  const points = new THREE.Points(pGeo, pMat); points.frustumCulled = false; points.renderOrder = 5; scene.add(points);
  const parts = [];
  function emit(at, n, { color = [1.4, 1.1, 0.6], speed = 0.25, up = 0.3, life = 0.8, size = 0.012, grav = -0.6, spread = 1 } = {}) {
    for (let k = 0; k < n && parts.length < MAXP; k++) {
      const a = rnd() * TAU, s = speed * (0.4 + rnd() * 0.6) * spread;
      parts.push({ p: at.clone(), v: new THREE.Vector3(Math.cos(a) * s, up * (0.5 + rnd()), Math.sin(a) * s), life, t: 0, c: color, size: size * (0.6 + rnd() * 0.8), grav });
    }
  }
  // dust motes: always there, drifting in the sun's path
  const motes = [];
  for (let k = 0; k < (low ? 50 : 120); k++) motes.push({ p: new THREE.Vector3(lerp(-0.6, 1.2, rnd()), lerp(-0.4, 1.4, rnd()), lerp(-1.6, 0.4, rnd())), ph: rnd() * TAU, s: 0.002 + rnd() * 0.003 });
  const steam = [];
  function stepParticles(dt) {
    let n = 0;
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i]; q.t += dt;
      if (q.t >= q.life) { parts.splice(i, 1); continue; }
      q.v.y += q.grav * dt; q.p.addScaledVector(q.v, dt);
      if (q.p.y < BOARD_TOP + 0.003 && q.grav < 0) { q.p.y = BOARD_TOP + 0.003; q.v.multiplyScalar(0.4); q.v.y = Math.abs(q.v.y) * 0.3; }
    }
    const put = (p, c, a, size) => { if (n >= MAXP) return; pPos.set([p.x, p.y, p.z], n * 3); pCol.set([c[0] * a, c[1] * a, c[2] * a], n * 3); pSize[n] = size; n++; };
    for (const q of parts) { const a = 1 - q.t / q.life; put(q.p, q.c, a * a, q.size); }
    // the motes glow only where the sun is
    const tt = vt;
    for (const m of motes) {
      const x = m.p.x + Math.sin(tt * 0.13 + m.ph) * 0.08, y = m.p.y + Math.sin(tt * 0.07 + m.ph * 2) * 0.06, z = m.p.z + Math.cos(tt * 0.11 + m.ph) * 0.08;
      // distance from the sun's path through the gap in the window
      const rel = P1.set(x - 0.27, y - 1.0, z - WALL_Z), along = rel.dot(sunDir), off = rel.addScaledVector(sunDir, -along).length();
      const lit = along > 0 ? clamp(1 - off / 0.55, 0, 1) : 0;
      if (lit > 0.02) put(P0.set(x, y, z), [1, 0.85, 0.6], lit * 0.35 * dayLight, m.s);
    }
    // steam over Lola's coffee
    if (!low && Math.random() < dt * 5) steam.push({ p: new THREE.Vector3(room.mug.position.x + (rnd() - 0.5) * 0.02, 0.075, room.mug.position.z + (rnd() - 0.5) * 0.02), t: 0 });
    for (let i = steam.length - 1; i >= 0; i--) { const s = steam[i]; s.t += dt; if (s.t > 2.4) { steam.splice(i, 1); continue; } s.p.y += dt * 0.05; s.p.x += Math.sin(s.t * 2 + i) * dt * 0.01; put(s.p, [0.5, 0.45, 0.4], Math.sin((s.t / 2.4) * Math.PI) * 0.25, 0.02 + s.t * 0.015); }
    pGeo.setDrawRange(0, n);
    pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true; pGeo.attributes.size.needsUpdate = true;
  }

  // ---------- the camera ----------
  let W = 1, H = 1, mode = 'title', calm = false, dayLight = 1;
  const cam = { pos: new THREE.Vector3(1.2, 0.7, 1.5), look: new THREE.Vector3(0, 0.1, -0.4), fov: 40, gPos: new THREE.Vector3(), gLook: new THREE.Vector3(), gFov: 40, shake: 0, roll: 0, rate: 2.2, fly: null, punch: null };
  const portrait = () => W / H < 0.85;
  // your seat: the whole board in view, a little tilted toward you; on a tall phone the board runs up the screen
  // Fit the board (with room for its labels) inside the frame, leaving the top and bottom for the HUD.
  const fitCam = new THREE.PerspectiveCamera(), FIT = [[-0.5, -0.1], [0.5, -0.1], [-0.5, 0.1], [0.5, 0.1], [0, -0.1], [0, 0.1]].map(([x, z]) => new THREE.Vector3(x, BOARD_TOP, z));
  function fitDistance(look, dir, fov, box) {
    fitCam.fov = fov; fitCam.aspect = W / H; fitCam.updateProjectionMatrix();
    let lo = 0.25, hi = 4;
    for (let k = 0; k < 22; k++) {
      const d = (lo + hi) / 2;
      fitCam.position.copy(look).addScaledVector(dir, d); fitCam.lookAt(look); fitCam.updateMatrixWorld(true);
      let ok = true;
      for (const p of FIT) { proj.copy(p).project(fitCam); if (proj.x < -box[0] || proj.x > box[0] || proj.y < box[1] || proj.y > box[2]) { ok = false; break; } }
      if (ok) hi = d; else lo = d;
    }
    return hi;
  }
  const dirTmp = new THREE.Vector3();
  function playShot(out) {
    if (portrait()) {
      // the board runs up the screen: you look along it from Lola's ulo end, your row on the right
      out.look.set(0.035, 0, 0.0); out.fov = 30;
      const P = 1.12; dirTmp.set(-Math.cos(P), Math.sin(P), 0.0);
      out.pos.copy(out.look).addScaledVector(dirTmp, fitDistance(out.look, dirTmp, out.fov, [0.86, -0.8, 0.72]));
    } else {
      out.look.set(0, 0, -0.03); out.fov = 36;
      const P = 0.86, Y = 0.07; dirTmp.set(Math.sin(Y) * Math.cos(P), Math.sin(P), Math.cos(Y) * Math.cos(P));
      out.pos.copy(out.look).addScaledVector(dirTmp, fitDistance(out.look, dirTmp, out.fov, [0.94, -0.6, 0.5]));
    }
    return out;
  }
  const shotTmp = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 38 };
  function titleShot(t, out) {
    // a slow drift across the table toward the window, Lola's chair in the light
    const a = 0.35 + Math.sin(t * 0.05) * 0.18;
    out.pos.set(Math.sin(a) * 1.25 + 0.2, 0.42 + Math.sin(t * 0.07) * 0.04, Math.cos(a) * 1.25 - 0.1);
    out.look.set(-0.05, 0.08, -0.45); out.fov = 42;
    return out;
  }
  function orbitShot(t, out, r = 0.85, h = 0.55) {
    const a = 0.5 + t * 0.12;
    out.pos.set(Math.sin(a) * r, h, Math.cos(a) * r * 0.9 + 0.1); out.look.set(0, 0.02, -0.05); out.fov = 40;
    return out;
  }
  const tmpV = new THREE.Vector3(), tmpL = new THREE.Vector3();
  function stepCamera(dt, t) {
    let goal;
    if (mode === 'title') goal = titleShot(t, shotTmp);
    else if ((mode === 'round' || mode === 'over') && !calm) goal = orbitShot(t - modeT, shotTmp, mode === 'over' ? 0.95 : 0.85, mode === 'over' ? 0.5 : 0.62);
    else goal = playShot(shotTmp);
    if (debugCam) { goal = shotTmp; goal.pos.copy(debugCam.pos); goal.look.copy(debugCam.look); goal.fov = debugCam.fov; cam.pos.copy(goal.pos); cam.look.copy(goal.look); cam.fov = goal.fov; }
    cam.gPos.copy(goal.pos); cam.gLook.copy(goal.look); cam.gFov = goal.fov;
    // a punch-in: toward a point, for a beat
    if (cam.punch && !calm) {
      const p = cam.punch, u = clamp((t - p.t0) / p.dur, 0, 1), k = Math.sin(Math.min(1, u * 1.15) * Math.PI) ** 0.7 * p.amount;
      if (u >= 1) cam.punch = null;
      else { tmpV.copy(p.at).sub(cam.gPos).multiplyScalar(k * 0.72); cam.gPos.add(tmpV); cam.gLook.lerp(p.at, k * 0.8); cam.gFov -= k * 6; }
    } else if (cam.punch && calm) cam.punch = null;
    // the intro: a flight from the title shot into your seat
    if (cam.fly) {
      const f = cam.fly, u = clamp((t - f.t0) / f.dur, 0, 1), e = ease(u);
      if (u >= 1) cam.fly = null;
      cam.pos.lerpVectors(f.pos, cam.gPos, e).y += Math.sin(u * Math.PI) * 0.25;
      cam.look.lerpVectors(f.look, cam.gLook, e); cam.fov = lerp(f.fov, cam.gFov, e);
    } else {
      const k = 1 - Math.exp(-dt * (calm ? 3 : cam.rate));
      cam.pos.lerp(cam.gPos, k); cam.look.lerp(cam.gLook, k); cam.fov = lerp(cam.fov, cam.gFov, k);
    }
    // life: the slightest breathing, and a shake on big moments
    tmpV.copy(cam.pos); tmpL.copy(cam.look);
    if (!calm && mode !== 'title') { tmpV.x += Math.sin(t * 0.37) * 0.004; tmpV.y += Math.sin(t * 0.29) * 0.003; }
    if (cam.shake > 0 && !calm) { const s = cam.shake * cam.shake * 0.012; tmpV.x += (rnd() - 0.5) * s; tmpV.y += (rnd() - 0.5) * s; tmpL.x += (rnd() - 0.5) * s * 0.5; }
    cam.shake = Math.max(0, cam.shake - dt * 2.2);
    camera.position.copy(tmpV);
    camera.up.set(0, 1, 0);
    camera.lookAt(tmpL);
    if (camera.fov !== cam.fov) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
    // keep the board in focus
    post.setFocus(camera.position.distanceTo(tmpL), low ? 0 : mode === 'title' ? 0.004 : 0.0024);
  }
  let modeT = 0, debugCam = null;

  // ---------- keeping the shells where the rules say ----------
  const sp = new THREE.Vector3(), sq = new THREE.Quaternion();
  function place(id, slot, k) { const s = shells[id]; slotPose(slot, k, s.pos, s.quat); s.at = slot; s.visible = true; s.landed = true; }
  function toBowl(id) { const s = shells[id]; bowlPose(spare.length, s.pos, s.quat); spare.push(id); s.at = -1; s.visible = true; s.landed = true; }
  // Put the board in state s at once (or, with `animate`, let the shells that must move fly there).
  async function setBoard(s, b = 0, { animate = false, speed = 1, stagger = 0.03 } = {}) {
    gen++;
    burnt = b;
    for (let i = 0; i < 16; i++) if (scorches[i]) scorches[i].visible = isBurnt(i);
    await settle();
    // take the surplus off each slot, from the top of its pile; fill the short ones from what was taken
    const loose = [];
    for (let i = 0; i < 16; i++) while (slots[i].length > s[i]) loose.push(slots[i].pop());
    hand.ids.length = 0; hand.on = false;
    let need = 0; for (let i = 0; i < 16; i++) need += Math.max(0, s[i] - slots[i].length);
    while (loose.length < need && spare.length) loose.push(spare.pop());
    // anything left over goes back into the bowl
    while (loose.length > need) { const id = loose.pop(); if (animate) { const sh = shells[id]; bowlPose(spare.length, sp, sq); spare.push(id); sh.at = -1; launch(sh, sp, sq, 0.45 / speed, { arc: 0.08 }); } else toBowl(id); }
    let d = 0;
    for (let i = 0; i < 16; i++) while (slots[i].length < s[i] && loose.length) {
      const id = loose.pop(); const k = slots[i].length; slots[i].push(id);
      if (animate) { const sh = shells[id]; slotPose(i, k, sp, sq); sh.at = i; launch(sh, sp, sq, 0.42 / speed, { arc: 0.07, delay: d, onLand: landSound }); d += stagger / speed; }
      else place(id, i, k);
    }
    if (animate) await settle();
    else for (let i = 0; i < 16; i++) slots[i].forEach((id, k) => place(id, i, k));
  }

  // ---------- sound hooks (the page wires the audio in) ----------
  let sfx = () => {};
  function landSound(s) { const slot = s.at; sfx('land', { slot, n: slots[slot] ? slots[slot].length : 0, empty: slot >= 0 && slots[slot].length <= 1 }); }

  // ---------- playing the rules' events ----------
  let who = 'you';
  const ulOf = (w) => (w === 'lola' ? LOLA_ULO : ULO);
  let gen = 0;
  async function play(e, ms, by = 'you', speed = 1) {
    const sec = ms / 1000, g0 = gen;
    const wait = (x) => waitRaw(x).then(() => { if (g0 !== gen) throw STALE; });
    const settle = () => settleRaw().then(() => { if (g0 !== gen) throw STALE; });
    who = by;
    switch (e.t) {
      case 'lift': {
        hoverAt(e.slot, hand.pos); hand.from.copy(hand.pos); hand.to.copy(hand.pos); hand.on = true; hand.who = by; hand.fade = 0;
        lolaHook('lift', e.slot);
        const ids = slots[e.slot].splice(0);
        hand.ids.push(...ids);
        ids.forEach((id, k) => { const s = shells[id]; s.at = -2; palmPose(hand.ids.length - ids.length + k, sp, sq, vt); launch(s, sp, sq, Math.max(0.12, sec * 0.9), { arc: 0.01, spin: 0.2, delay: k * 0.008 }); s.inHand = true; });
        sfx('scoop', { n: ids.length, slot: e.slot });
        emit(pits[e.slot].v, 5, { color: [0.9, 0.7, 0.4], speed: 0.08, up: 0.12, life: 0.5, size: 0.008 });
        await wait(sec);
        break;
      }
      case 'drop': {
        hand.from.copy(hand.pos); hoverAt(e.slot, hand.to); hand.t0 = vt; hand.dur = sec;
        lolaHook('drop', e.slot);
        const id = hand.ids.pop();
        if (id !== undefined) {
          const s = shells[id], k = slots[e.slot].length;
          slots[e.slot].push(id); s.at = e.slot; s.inHand = false;
          slotPose(e.slot, k, sp, sq);
          // it leaves the hand as the hand arrives over the hole
          const lead = sec * 0.55;
          launch(s, sp, sq, clamp(0.2 / Math.sqrt(speed), 0.09, 0.22), { arc: 0.012, spin: 0.6, delay: lead, onLand: (sh) => { landSound(sh); if (!calm) emit(sp.clone(), 1, { color: [0.8, 0.65, 0.4], speed: 0.03, up: 0.03, life: 0.3, size: 0.006 }); } });
          // the shell is thrown from wherever the hand is when it lets go
          s.fly.fromHand = true;
        }
        await wait(sec);
        break;
      }
      case 'relay': {
        await settle();
        const ids = slots[e.slot].splice(0);
        hand.ids.push(...ids);
        ids.forEach((id, k) => { const s = shells[id]; s.at = -2; palmPose(hand.ids.length - ids.length + k, sp, sq, vt); launch(s, sp, sq, Math.max(0.12, sec * 0.8), { arc: 0.012, spin: 0.25, delay: k * 0.01 }); s.inHand = true; });
        sfx('relay', { n: ids.length, slot: e.slot });
        lolaHook('relay', e.slot);
        ringPulse(e.slot, 0.5);
        await wait(sec);
        break;
      }
      case 'extra': {
        await settle();
        handAway();
        sfx('extra', { who: by });
        const u = e.slot ?? ulOf(by);
        ringPulse(u, 1);
        if (!calm) { emit(pits[u].v.clone().setY(BOARD_TOP + 0.02), 26, { color: [1.6, 1.25, 0.6], speed: 0.22, up: 0.45, life: 0.9, size: 0.012 }); flash = 0.25; cam.shake = Math.max(cam.shake, 0.25); }
        floatText(u, 'ISA PA!', 'extra');
        lolaHook('extra', u);
        await wait(sec);
        break;
      }
      case 'capture': case 'sweep': {
        await settle();
        handAway();
        const to = e.ulo ?? ULO, from = e.t === 'capture' ? [e.opp, e.slot] : (e.side === 'lola' ? [8, 9, 10, 11, 12, 13, 14] : [0, 1, 2, 3, 4, 5, 6]);
        const ids = [];
        for (const i of from) ids.push(...slots[i].splice(0));
        const big = e.n >= 6;
        sfx(e.t, { n: e.n, who: by });
        lolaHook(e.t, e.t === 'capture' ? e.opp : to);
        if (!calm) {
          const focusAt = pits[e.t === 'capture' ? e.opp : to].v.clone();
          cam.punch = { at: focusAt.lerp(pits[to].v, 0.35), t0: vt, dur: 1.1 + Math.min(1, ids.length * 0.04), amount: big ? 1 : 0.6 };
          if (big) { timeScale = 0.35; slowUntil = performance.now() / 1000 + 0.45; }
          for (const i of from) if (slots[i]) emit(pits[i].v.clone().setY(BOARD_TOP + 0.01), 8, { color: [1.5, 1.1, 0.5], speed: 0.15, up: 0.25, life: 0.7, size: 0.01 });
        }
        ringPulse(to, 1);
        // the shells rise together, hang for a heartbeat, then pour into the ulo one after another
        const rise = 0.16;
        ids.forEach((id, k) => { const s = shells[id]; P1.copy(s.pos).setY(s.pos.y + 0.05 + rnd() * 0.03); launch(s, P1, s.quat, rise, { arc: 0.005, spin: 0.3, delay: k * 0.005 }); s.at = -3; });
        await wait(rise + 0.08);
        const gap = clamp(0.5 / Math.max(1, ids.length), 0.018, 0.05) / speed;
        ids.forEach((id, k) => {
          const s = shells[id], kk = slots[to].length; slots[to].push(id); s.at = to;
          slotPose(to, kk, sp, sq);
          launch(s, sp, sq, 0.36 / Math.sqrt(speed), { arc: 0.09, spin: 1.2, delay: k * gap, onLand: (sh) => { landSound(sh); } });
        });
        await wait(ids.length * gap + 0.36 / Math.sqrt(speed));
        await settle();
        if (!calm) { emit(pits[to].v.clone().setY(BOARD_TOP + 0.02), big ? 40 : 18, { color: [1.7, 1.3, 0.55], speed: 0.3, up: 0.5, life: 1, size: 0.013 }); flash = big ? 0.45 : 0.2; cam.shake = Math.max(cam.shake, big ? 0.55 : 0.3); }
        floatText(to, `+${e.n}`, by === 'lola' ? 'hers' : 'mine');
        await wait(Math.max(0.1, sec * 0.5));
        break;
      }
      case 'dud': {
        await settle();
        handAway();
        sfx('dud', {});
        emit(pits[e.slot].v.clone().setY(BOARD_TOP + 0.01), 10, { color: [0.35, 0.32, 0.3], speed: 0.06, up: 0.08, life: 0.7, size: 0.014, grav: 0 });
        lolaHook('dud', e.slot);
        await wait(sec);
        break;
      }
      case 'end': {
        await settle();
        handAway();
        sfx('end', {});
        lolaHook('end', e.slot);
        await wait(sec * 0.8);
        break;
      }
      default: throw new Error(`unknown event ${e.t}`);
    }
  }
  function handAway() { hand.on = false; hand.ids.length = 0; lolaHook('rest'); }
  const pulses = new Map();
  function ringPulse(slot, amount) { pulses.set(slot, { t0: vt, amount }); }

  function lolaHook() { /* Lola's own moves are told by the page: her lines and her toasts */ }

  // ---------- each frame ----------
  let flash = 0, last = performance.now(), running = true, frames = 0;
  const m4 = new THREE.Matrix4(), S = new THREE.Vector3(), HID = new THREE.Matrix4().makeScale(0, 0, 0);
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const real = Math.min(0.1, (now - last) / 1000); last = now;
    if (now / 1000 > slowUntil) timeScale = Math.min(1, timeScale + real * 3);
    const dt = real * timeScale;
    vt += dt;
    const t = now / 1000;
    // the hand glides from hole to hole
    if (hand.on) {
      const u = hand.dur > 0 ? clamp((vt - hand.t0) / hand.dur, 0, 1) : 1;
      const was = P0.copy(hand.pos);
      hand.pos.lerpVectors(hand.from, hand.to, ease(u));
      hand.pos.y += Math.sin(u * Math.PI) * 0.012 + Math.sin(vt * 3) * 0.002;
      hand.tilt.lerp(P1.copy(hand.pos).sub(was).multiplyScalar(dt > 0 ? 0.08 / dt : 0).clampLength(0, 0.12), Math.min(1, dt * 10));
    }
    // shells held in the hand follow it; thrown shells leave from where the hand was
    let hk = 0;
    for (const id of hand.ids) { const s = shells[id]; if (s.fly && s.fly.t0 > vt - s.fly.dur) { palmPose(hk, s.fly.p1, s.fly.q1, vt); } else if (!s.fly) palmPose(hk, s.pos, s.quat, vt); hk++; }
    for (const s of flights) if (s.fly.fromHand && vt < s.fly.t0) { s.fly.p0.copy(hand.pos); s.fly.p0.y -= 0.005; s.pos.copy(s.fly.p0); }
    stepFlights();
    stepWaiters();
    // draw every shell
    const counts = new Array(V).fill(0);
    for (const s of shells) {
      const im = inst[s.v];
      if (!s.visible) { im.setMatrixAt(s.k, HID); continue; }
      let y = 0;
      if (s.bounce > 0) { y = Math.sin(s.bounce * Math.PI) * 0.0022; s.bounce = Math.max(0, s.bounce - dt * 9); }
      S.setScalar(s.scale); P0.copy(s.pos); P0.y += y;
      m4.compose(P0, s.quat, S); im.setMatrixAt(s.k, m4); counts[s.v]++;
    }
    for (const im of inst) im.instanceMatrix.needsUpdate = true;
    // the rings
    for (let i = 0; i < 16; i++) {
      const r = rings[i], lg = legal.includes(i), pu = pulses.get(i);
      let op = 0;
      if (lg) op = 0.16 + 0.1 * Math.sin(t * 3 + i * 0.7);
      if (i === hover && lg) op = 0.45;
      if (i === focus) op = Math.max(op, 0.75);
      if (i === selected) op = 0.95;
      if (pu) { const u = (vt - pu.t0) / 0.9; if (u > 1) pulses.delete(i); else op = Math.max(op, (1 - u) * pu.amount); }
      r.material.opacity += (op - r.material.opacity) * Math.min(1, real * 14);
      r.material.color.set(i === focus && i !== selected ? '#fff4dc' : '#ffcf70');
      r.visible = r.material.opacity > 0.01;
    }
    targetMeshes.forEach((m, k) => {
      const slot = targets[k];
      m.visible = slot !== undefined;
      if (!m.visible) return;
      const p = pits[slot]; m.position.set(p.x, BOARD_TOP + 0.002, p.z); m.rotation.y = t * 0.6 * (k % 2 ? -1 : 1);
      const sc = isHouse(slot) ? 1 : 1.6; m.scale.set(sc * (1 + 0.04 * Math.sin(t * 4)), 1, sc * (1 + 0.04 * Math.sin(t * 4)));
    });
    targetMat.opacity = targets.length ? 0.9 : 0;
    // the pick light over your chosen house
    const glowAt = selected ?? (targets.length ? null : hover);
    if (glowAt !== null && glowAt !== undefined && legal.includes(glowAt)) { pick.position.copy(pits[glowAt].v).setY(BOARD_TOP + 0.09); pick.intensity += (0.05 - pick.intensity) * Math.min(1, real * 8); }
    else pick.intensity *= 1 - Math.min(1, real * 8);
    // embers breathe in burnt houses
    scorchMat.emissiveIntensity = 0.8 + Math.sin(t * 2.3) * 0.35 + Math.sin(t * 5.1) * 0.15;
    room.lamp.visible = mode === 'title' || !portrait() || mode === 'over';
    room.update(t);
    stepParticles(dt);
    stepCamera(real, t);
    stepLabels();
    flash = Math.max(0, flash - real * 2.2);
    post.render(real, { flash: calm ? 0 : flash, bloomBoost: calm ? 0 : flash * 0.5 });
    frames++;
  }

  // ---------- the real things, as they load ----------
  const envP = loadEnv('assets/env/').then(async (env) => {
    const sky = await loadSky(env, 'pine_attic', pmrem);
    if (sky) { scene.environment = sky; scene.environmentIntensity = 0.45; scene.environmentRotation.set(0, 2.2, 0); }
    await room.dress(env);
    const bowl = room.props.getObjectByName('wooden_bowl_02');
    if (bowl) bowlStand.visible = false;
    return env;
  }).catch(() => null);

  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    post.resize();
    pMat.uniforms.scale.value = H * renderer.getPixelRatio() * 0.6;
    anchors(W / H);
  }
  resize();
  // start with the bowl full
  for (let i = 0; i < N; i++) toBowl(i);
  requestAnimationFrame(frame);

  // ---------- what the page can do ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(BOARD_TOP - 0.008)), hit = new THREE.Vector3();
  return {
    renderer, scene, camera, post, envReady: envP, pits,
    get frames() { return frames; },
    get busy() { return flights.size > 0; },
    setBoard, play: (...a) => play(...a).catch((e) => { if (e !== STALE) throw e; }), settle, floatText,
    setSfx(f) { sfx = f; },
    setLegal(l) { legal = l.slice(); },
    setSelected(s) { selected = s; },
    setHover(s) { hover = s; },
    setFocus(s) { focus = s; },
    setTargets(list, isWhole = false) {
      targets = list.slice(0, targetMeshes.length); whole = isWhole;
      for (const el of stopTags) el.remove(); stopTags.length = 0;
    },
    setLabels(on) { showLabels = on; },
    setCalm(c) { calm = c; },
    setMode(m) {
      if (m === mode) return;
      if (mode === 'title' && m === 'play' && !calm) { cam.fly = { pos: cam.pos.clone(), look: cam.look.clone(), fov: cam.fov, t0: performance.now() / 1000, dur: 2.2 }; }
      mode = m; modeT = performance.now() / 1000;
      post.setGrade(m === 'round' || m === 'over' ? 'takipsilim' : 'hapon');
    },
    get mode() { return mode; },
    shake(a) { if (!calm) cam.shake = Math.max(cam.shake, a); },
    flash(a) { if (!calm) flash = Math.max(flash, a); },
    punch(slot, amount = 0.7, dur = 1.2) { if (!calm) cam.punch = { at: pits[slot].v.clone(), t0: performance.now() / 1000, dur, amount }; },
    // the house under a point on the screen, or -1
    pickAt(x, y) {
      const r = canvas.getBoundingClientRect();
      ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      if (!ray.ray.intersectPlane(plane, hit)) return -1;
      let best = -1, bd = Infinity;
      for (const p of pits) {
        const d = p.rx ? Math.hypot((hit.x - p.x) / p.rx, (hit.z - p.z) / p.rz) * 0.034 : Math.hypot(hit.x - p.x, hit.z - p.z);
        if (d < 0.042 && d < bd) { bd = d; best = p.i; }
      }
      return best;
    },
    // where something is on screen, for speech bubbles and such
    screenOf(what) {
      const v = what === 'lola' ? P1.set(0, 0.42, -0.62) : typeof what === 'number' ? P1.copy(pits[what].v) : P1.copy(what);
      toScreen(v, scr); return { x: scr.x, y: scr.y, onScreen: scr.z < 1 && scr.x > 0 && scr.x < W && scr.y > 0 && scr.y < H };
    },
    counts() { return slots.map((l) => l.length); },
    resize,
    stop() { running = false; },
    gfx(level) { if (level === 'auto') { post.setAuto(true); post.setLevel(low ? 1 : 2); } else { post.setAuto(false); post.setLevel(level); } },
    hand,
    debugCam(p, l, fov = 38) { debugCam = p ? { pos: new THREE.Vector3(...p), look: new THREE.Vector3(...l), fov } : null; },
  };
}
