// Lola Iska's sala, upstairs in an old bahay na bato, on a sunny afternoon. Built in code, then dressed
// with real scans (envpack.mjs): wide narra floorboards, carved wall panels under warm plaster, a big
// capiz window with its sliding panels half open to the garden, balusters in the ventanilla under it and
// carved fretwork (calado) over it, a capiz lamp over the table, and Lola's things about the room.
// Units are metres; the tabletop is y = 0 and the board sits at its centre, long side along x. You sit at
// +z, Lola across from you at -z, her back to the window.
import * as THREE from './vendor/three.module.min.js';
import * as T from './tex.mjs';
import { loadProp, dressMaterial } from './envpack.mjs';

export const FLOOR = -0.76, WALL_Z = -1.75, SIDE_X = 2.8, CEIL = 2.35, FRONT_Z = 3.0;
export const TABLE = { w: 1.6, d: 0.95, t: 0.05 };
export const WINDOW = { x0: -1.5, x1: 1.5, y0: 0.08, y1: 1.95 };
export const GAP = { x0: -0.08, x1: 0.62 }; // where the sliding panels stand open

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...o });
function mesh(geo, mat, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = cast; m.receiveShadow = receive; return m;
}
const box = (w, h, d, mat, o) => mesh(new THREE.BoxGeometry(w, h, d), mat, o);
// a box whose UVs are in metres (so a tiled scan keeps its scale on every face)
function metricBox(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d), p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    const u = ax > 0.5 ? p.getZ(i) : p.getX(i), v = ay > 0.5 ? p.getZ(i) : p.getY(i);
    uv.setXY(i, u, v);
  }
  return g;
}
// a flat panel with UVs in metres
function metricPlane(w, h) { const g = new THREE.PlaneGeometry(w, h), p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) + w / 2, p.getY(i) + h / 2); return g; }

// The fretwork over the window: scrolls and leaves cut through a board, so the sun comes through in lace.
function caladoTex() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, 1024, 128);
  x.fillStyle = '#000';
  const unit = 128;
  for (let k = 0; k < 1024 / unit; k++) {
    const X = k * unit;
    // a four-petal flower in a diamond, joined by vines
    x.save(); x.translate(X + unit / 2, 64);
    for (let p = 0; p < 4; p++) { x.rotate(Math.PI / 2); x.beginPath(); x.ellipse(0, -22, 9, 17, 0, 0, Math.PI * 2); x.fill(); }
    x.beginPath(); x.arc(0, 0, 6, 0, Math.PI * 2); x.fill();
    for (const s of [-1, 1]) { x.beginPath(); x.ellipse(s * 46, -30, 12, 5, s * 0.6, 0, Math.PI * 2); x.fill(); x.beginPath(); x.ellipse(s * 46, 30, 12, 5, -s * 0.6, 0, Math.PI * 2); x.fill(); x.beginPath(); x.arc(s * 58, 0, 5, 0, Math.PI * 2); x.fill(); }
    x.restore();
  }
  x.fillStyle = '#fff'; x.fillRect(0, 0, 1024, 10); x.fillRect(0, 118, 1024, 10);
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t; // white = wood, black = cut through
}

// A turned table leg or baluster: a lathe profile, radius by height.
function turned(h, r, bulbs = 2) {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const v = i / 24, bead = Math.abs(Math.sin(v * Math.PI * bulbs)) ** 1.6;
    pts.push(new THREE.Vector2(r * (0.62 + 0.38 * bead) * (v < 0.06 || v > 0.94 ? 1.25 : 1), v * h));
  }
  return new THREE.LatheGeometry(pts, 14);
}

export function buildRoom({ low = false } = {}) {
  const group = new THREE.Group(); group.name = 'sala';
  const add = (...o) => { group.add(...o); return o[0]; };
  const mats = {
    floor: std('#5b3a22', { roughness: 0.55 }),
    plaster: std('#e8dcc4', { roughness: 0.95 }),
    panel: std('#3f2616', { roughness: 0.6 }),
    frame: std('#3a2415', { roughness: 0.55 }),
    ceiling: std('#4a3020', { roughness: 0.8 }),
    table: std('#3b2012', { roughness: 0.35 }),
    trim: std('#2e1c10', { roughness: 0.5 }),
  };
  const outside = new THREE.MeshBasicMaterial({ map: T.gardenPlate(), color: new THREE.Color(1.5, 1.45, 1.35), fog: false });
  const capizTex = T.capizSheet(4, 9, 64);
  const capiz = new THREE.MeshStandardMaterial({ map: capizTex, emissiveMap: capizTex, emissive: new THREE.Color('#ffe7c2'), emissiveIntensity: 0.55, roughness: 0.6, side: THREE.DoubleSide });

  // ---------- the floor, walls and ceiling ----------
  const W = SIDE_X * 2, D = FRONT_Z - WALL_Z, H = CEIL - FLOOR;
  add(mesh(metricPlane(W, D), mats.floor, { y: FLOOR, z: (FRONT_Z + WALL_Z) / 2, rx: -Math.PI / 2, cast: false }));
  const ceil = add(mesh(metricPlane(W, D), mats.ceiling, { y: CEIL, z: (FRONT_Z + WALL_Z) / 2, rx: Math.PI / 2, cast: false }));
  ceil.receiveShadow = false;
  for (let k = -2; k <= 2; k++) add(box(W, 0.16, 0.12, mats.trim, { y: CEIL - 0.08, z: k * 0.9 + 0.5, receive: false })); // the beams
  const WAIN = FLOOR + 1.0; // the carved panels come up to here
  // the back wall, around the window and the ventanilla under it
  const bw = (x0, x1, y0, y1, mat = mats.plaster) => add(mesh(metricBox(x1 - x0, y1 - y0, 0.2), mat, { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: WALL_Z - 0.1 }));
  const V0 = FLOOR + 0.16, V1 = WINDOW.y0 - 0.1; // the ventanilla's opening
  bw(-SIDE_X, WINDOW.x0, FLOOR, WINDOW.y0, mats.panel); bw(WINDOW.x1, SIDE_X, FLOOR, WINDOW.y0, mats.panel);
  bw(-SIDE_X, WINDOW.x0, WINDOW.y0, CEIL); bw(WINDOW.x1, SIDE_X, WINDOW.y0, CEIL);
  bw(WINDOW.x0, WINDOW.x1, FLOOR, V0, mats.panel); bw(WINDOW.x0, WINDOW.x1, V1, WINDOW.y0, mats.panel);
  bw(WINDOW.x0, WINDOW.x1, WINDOW.y1 + 0.36, CEIL);
  // the side walls and the one behind you: carved panels to waist height, plaster above
  for (const s of [-1, 1]) {
    add(mesh(metricBox(0.2, WAIN - FLOOR, D), mats.panel, { x: s * (SIDE_X + 0.1), y: (FLOOR + WAIN) / 2, z: (FRONT_Z + WALL_Z) / 2 }));
    add(mesh(metricBox(0.2, CEIL - WAIN, D), mats.plaster, { x: s * (SIDE_X + 0.1), y: (WAIN + CEIL) / 2, z: (FRONT_Z + WALL_Z) / 2 }));
    add(box(0.05, 0.06, D, mats.trim, { x: s * (SIDE_X - 0.02), y: WAIN, z: (FRONT_Z + WALL_Z) / 2 })); // the rail on top of the panels
  }
  add(mesh(metricBox(W, WAIN - FLOOR, 0.2), mats.panel, { y: (FLOOR + WAIN) / 2, z: FRONT_Z + 0.1 }));
  add(mesh(metricBox(W, CEIL - WAIN, 0.2), mats.plaster, { y: (WAIN + CEIL) / 2, z: FRONT_Z + 0.1 }));
  add(box(W, 0.06, 0.05, mats.trim, { y: WAIN, z: WALL_Z + 0.02 }));
  // a doorway on the right, into the dark of the house
  add(box(0.06, 2.1, 1.0, std('#120b07', { roughness: 1 }), { x: SIDE_X - 0.02, y: FLOOR + 1.05, z: 1.4, cast: false }));
  for (const dz of [-0.53, 0.53]) add(box(0.08, 2.2, 0.08, mats.frame, { x: SIDE_X - 0.04, y: FLOOR + 1.1, z: 1.4 + dz }));
  add(box(0.08, 0.1, 1.14, mats.frame, { x: SIDE_X - 0.04, y: FLOOR + 2.2, z: 1.4 }));

  // ---------- the window ----------
  const WZ = WALL_Z;
  // its frame
  add(box(WINDOW.x1 - WINDOW.x0 + 0.24, 0.1, 0.3, mats.frame, { y: WINDOW.y0 - 0.02, z: WZ + 0.02 })); // the sill
  add(box(WINDOW.x1 - WINDOW.x0 + 0.2, 0.08, 0.24, mats.frame, { y: WINDOW.y1 + 0.02, z: WZ }));
  for (const x of [WINDOW.x0 - 0.04, WINDOW.x1 + 0.04]) add(box(0.1, WINDOW.y1 - WINDOW.y0 + 0.1, 0.24, mats.frame, { x, y: (WINDOW.y0 + WINDOW.y1) / 2, z: WZ }));
  // the sliding capiz panels, four of them on two tracks; two are pushed aside to open the middle
  const PW = 0.78, PH = WINDOW.y1 - WINDOW.y0 - 0.04;
  const panel = (cx, z) => {
    const g = new THREE.Group(); g.position.set(cx, (WINDOW.y0 + WINDOW.y1) / 2, z);
    const pane = mesh(new THREE.PlaneGeometry(PW - 0.06, PH - 0.06), capiz, { receive: false }); g.add(pane);
    for (const sx of [-1, 1]) g.add(box(0.05, PH, 0.04, mats.frame, { x: sx * (PW / 2 - 0.025) }));
    for (const sy of [-1, 1]) g.add(box(PW, 0.05, 0.04, mats.frame, { y: sy * (PH / 2 - 0.025) }));
    g.add(box(PW, 0.035, 0.035, mats.frame, { y: -PH * 0.12 })); // a crossbar
    return add(g);
  };
  panel(-1.11, WZ + 0.04); panel(-0.47, WZ - 0.02);
  panel(GAP.x1 + PW / 2, WZ + 0.04); panel(1.11, WZ - 0.02);
  // the garden beyond, bright
  add(mesh(new THREE.PlaneGeometry(9, 5), outside, { y: 1.0, z: WZ - 1.6, cast: false, receive: false }));
  // the ventanilla: turned balusters in the low opening, a sliding board half open behind them
  const bal = new THREE.InstancedMesh(turned(V1 - V0, 0.022, 2), mats.frame, 20); bal.castShadow = true;
  const m4 = new THREE.Matrix4();
  for (let k = 0; k < 20; k++) { m4.makeTranslation(WINDOW.x0 + 0.08 + k * ((WINDOW.x1 - WINDOW.x0 - 0.16) / 19), V0, WZ - 0.05); bal.setMatrixAt(k, m4); }
  add(bal);
  add(box(1.4, V1 - V0, 0.03, mats.panel, { x: -0.75, y: (V0 + V1) / 2, z: WZ - 0.16 }));
  // the calado: carved fretwork over the window
  const cal = caladoTex();
  cal.repeat.set(3, 1);
  const caladoMat = new THREE.MeshStandardMaterial({ color: '#3a2415', alphaMap: cal, alphaTest: 0.5, roughness: 0.6, side: THREE.DoubleSide });
  add(mesh(new THREE.PlaneGeometry(WINDOW.x1 - WINDOW.x0, 0.34), caladoMat, { y: WINDOW.y1 + 0.2, z: WZ - 0.02 }));

  // ---------- the table ----------
  const top = new THREE.Shape(), rw = TABLE.w / 2, rd = TABLE.d / 2, rc = 0.05;
  top.moveTo(-rw + rc, -rd); top.lineTo(rw - rc, -rd); top.quadraticCurveTo(rw, -rd, rw, -rd + rc); top.lineTo(rw, rd - rc); top.quadraticCurveTo(rw, rd, rw - rc, rd);
  top.lineTo(-rw + rc, rd); top.quadraticCurveTo(-rw, rd, -rw, rd - rc); top.lineTo(-rw, -rd + rc); top.quadraticCurveTo(-rw, -rd, -rw + rc, -rd);
  const tg = new THREE.ExtrudeGeometry(top, { depth: TABLE.t - 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.008, bevelSegments: 3, curveSegments: 6 });
  tg.rotateX(Math.PI / 2); tg.translate(0, -0.006, 0);
  { const p = tg.attributes.position, uv = tg.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) + 1, p.getZ(i) + 1); }
  const tableTop = add(mesh(tg, mats.table, { cast: true }));
  tableTop.name = 'tabletop';
  const legGeo = turned(-FLOOR - TABLE.t - 0.04, 0.04, 3);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(mesh(legGeo, mats.table, { x: sx * (rw - 0.09), y: FLOOR, z: sz * (rd - 0.09) }));
  for (const s of [-1, 1]) { add(box(TABLE.w - 0.2, 0.09, 0.025, mats.table, { y: -TABLE.t - 0.05, z: s * (rd - 0.09) })); add(box(0.025, 0.09, TABLE.d - 0.2, mats.table, { x: s * (rw - 0.09), y: -TABLE.t - 0.05 })); }

  // ---------- the capiz lamp over the table ----------
  const lamp = new THREE.Group(); lamp.position.set(0, 1.42, 0.02); add(lamp);
  const disc = new THREE.CircleGeometry(0.022, 14);
  const discMat = new THREE.MeshStandardMaterial({ map: capizTex, emissiveMap: capizTex, color: '#f4ead8', emissive: new THREE.Color('#ffd9a0'), emissiveIntensity: 1.6, roughness: 0.5, side: THREE.DoubleSide, transparent: true, opacity: 0.92 });
  const rings = [[0.07, 10, 0.22], [0.12, 16, 0.3], [0.17, 22, 0.36], [0.22, 28, 0.3]];
  const nDisc = rings.reduce((a, [, n, l]) => a + n * Math.round(l / 0.042), 0);
  const discs = new THREE.InstancedMesh(disc, discMat, nDisc); discs.castShadow = false; discs.receiveShadow = false;
  let di = 0; const q = new THREE.Quaternion(), e = new THREE.Euler(), s1 = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
  const strands = [];
  for (const [r, n, len] of rings) for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + r * 7, count = Math.round(len / 0.042);
    for (let j = 0; j < count; j++) { const drop = 0.03 + j * 0.042 + (r > 0.2 ? 0.05 : 0) - r * 0.35; v.set(Math.cos(a) * r, -drop, Math.sin(a) * r); e.set(0, -a + Math.PI / 2, 0); q.setFromEuler(e); m4.compose(v, q, s1); discs.setMatrixAt(di, m4); strands.push({ a, r, j, i: di }); di++; }
  }
  lamp.add(discs);
  lamp.add(mesh(new THREE.TorusGeometry(0.23, 0.008, 6, 40), mats.frame, { rx: Math.PI / 2, cast: false }));
  lamp.add(mesh(new THREE.TorusGeometry(0.12, 0.006, 6, 30), mats.frame, { rx: Math.PI / 2, y: 0.02, cast: false }));
  lamp.add(mesh(new THREE.CylinderGeometry(0.004, 0.004, CEIL - 1.42, 6), std('#1a120c'), { y: (CEIL - 1.42) / 2, cast: false }));
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 4.6, 3) }));
  bulb.position.y = -0.1; lamp.add(bulb);

  // ---------- small things on the table, made here ----------
  // Lola's coffee, in a white enamel mug with a blue rim
  const mug = new THREE.Group(); mug.position.set(0.66, 0, -0.18); add(mug);
  const mugPts = [[0, 0], [0.036, 0], [0.04, 0.004], [0.04, 0.085], [0.042, 0.088], [0.037, 0.088], [0.035, 0.082], [0.035, 0.008], [0, 0.008]].map(([x, y]) => new THREE.Vector2(x, y));
  const enamel = new THREE.MeshPhysicalMaterial({ color: '#f3f1ea', roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.1 });
  mug.add(mesh(new THREE.LatheGeometry(mugPts, 28), enamel));
  mug.add(mesh(new THREE.TorusGeometry(0.041, 0.0025, 6, 28), std('#1d3f8a', { roughness: 0.3 }), { y: 0.087, rx: Math.PI / 2 }));
  mug.add(mesh(new THREE.TorusGeometry(0.024, 0.005, 8, 16, Math.PI * 1.2), enamel, { x: 0.042, y: 0.045, rz: -Math.PI * 0.6 }));
  const coffee = mesh(new THREE.CircleGeometry(0.035, 24), std('#2a150a', { roughness: 0.15, metalness: 0.1 }), { y: 0.07, rx: -Math.PI / 2, cast: false });
  mug.add(coffee);

  // ---------- the real things, when they load ----------
  const PROPS = [
    // [id, x, y, z, turn, scale]
    ['gallinera_chair', 0, FLOOR, -0.74, 0, 1],
    ['round_spectacles', 0.54, 0, -0.3, 2.6, 1],
    ['wooden_bowl_02', -0.62, 0, 0.22, 0.4, 1.35],
    ['gallinera_table', -SIDE_X + 0.3, FLOOR, -0.4, Math.PI / 2, 1],
    ['vintage_oil_lamp', -SIDE_X + 0.3, 'chest', -0.72, 0.3, 0.9],
    ['mantel_clock_01', -SIDE_X + 0.28, 'chest', -0.2, Math.PI / 2, 0.9],
    ['lambis_shell', -SIDE_X + 0.34, 'chest', 0.02, 1.2, 1],
    ['hanging_picture_frame_03', -SIDE_X + 0.02, 0.62, -0.4, Math.PI / 2, 1.1],
    ['carved_wooden_plate', -SIDE_X + 0.02, 0.72, 0.35, Math.PI / 2, 1],
    ['antique_ceramic_vase_01', -2.3, FLOOR, -1.45, 0.3, 1.2],
    ['potted_plant_02', 2.15, FLOOR, -1.35, 0.8, 1.1],
    ['wicker_basket_02', 1.9, FLOOR, 0.6, 0.6, 1],
  ];
  const props = new THREE.Group(); props.name = 'props'; add(props);
  async function dress(env) {
    const jobs = [];
    const surf = [
      [mats.floor, 'plank_flooring_04', [W / 1.6, D / 1.6], { rough: 0.9 }],
      [mats.plaster, 'beige_wall_001', [1 / 2.2, 1 / 2.2], { rough: 1, tint: '#fff4e2' }],
      [mats.panel, 'dark_paneled_wood', [1 / 1.2, 1 / 1.2], { rough: 0.9 }],
      [mats.frame, 'dark_wood', [1 / 0.8, 1 / 0.8], { rough: 0.9, tint: '#9a7a66' }],
      [mats.trim, 'dark_wood', [1 / 0.8, 1 / 0.8], { rough: 1, tint: '#6a5040' }],
      [mats.ceiling, 'wood_plank_wall', [W / 2, D / 2], { rough: 1, tint: '#c8a890' }],
      [mats.table, 'lacquered_cherry_wood', [1 / 1.1, 1 / 1.1], { rough: 0.62, tint: '#a8826c', flatRough: true }],
    ];
    for (const [m, id, rep, o] of surf) jobs.push(dressMaterial(env, m, id, rep, o));
    const chestTop = FLOOR + 0.49;
    for (const [id, x, y, z, ry, s] of PROPS) jobs.push(loadProp(env, id).then((tpl) => {
      if (!tpl) return;
      const o = tpl.clone(); o.position.set(x, y === 'chest' ? chestTop : y, z); o.rotation.y = ry; o.scale.setScalar(s); o.name = id;
      props.add(o);
    }));
    await Promise.all(jobs);
  }

  // the capiz strands sway a little in the breeze from the window
  const sway = new THREE.Vector3();
  function update(t) {
    if (low) return;
    let k = 0;
    for (const st of strands) {
      if ((k++ & 3) !== (Math.floor(t * 30) & 3)) continue; // a quarter of them each frame
      const w = Math.sin(t * 0.8 + st.a * 2) * 0.004 * (st.j + 1);
      sway.set(Math.cos(st.a) * st.r + w, -(0.03 + st.j * 0.042 + (st.r > 0.2 ? 0.05 : 0) - st.r * 0.35), Math.sin(st.a) * st.r + w * 0.5);
      e.set(w * 3, -st.a + Math.PI / 2, 0); q.setFromEuler(e); m4.compose(sway, q, s1); discs.setMatrixAt(st.i, m4);
    }
    discs.instanceMatrix.needsUpdate = true;
  }
  return { group, dress, update, mats, capiz, lamp, bulb, mug, coffee, tableTop, props };
}
