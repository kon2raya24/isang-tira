// Painted textures for what has no scan: capiz panes, the garden seen through the window, soft glows and
// light shafts, a scorch mark for a burnt house, the lamp's capiz discs, and the print on Lola's duster.
import * as THREE from './vendor/three.module.min.js';

let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
function canvas(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  return c;
}
function tex(c, { srgb = true, repeat = null } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

// One capiz pane: the flattened windowpane-oyster shell, translucent and pearly, with growth rings and a
// soft sheen. Laid out as a sheet of `cols` × `rows` squares between thin wooden laths.
export function capizSheet(cols = 4, rows = 6, px = 64) {
  seed = 11;
  const c = canvas(cols * px, rows * px, (x, w, h) => {
    x.fillStyle = '#e9dcc0'; x.fillRect(0, 0, w, h);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const X = i * px, Y = j * px, base = 220 + Math.floor(rnd() * 22);
      x.fillStyle = `rgb(${base + 12},${base + 4},${base - 18})`; x.fillRect(X, Y, px, px);
      // growth rings from a corner, like the real shell
      const cx = X + (rnd() < 0.5 ? 0 : px), cy = Y + (rnd() < 0.5 ? 0 : px);
      for (let r = px * 1.5; r > 4; r -= 3 + rnd() * 4) { x.strokeStyle = `rgba(${150 + rnd() * 60},${130 + rnd() * 50},${100 + rnd() * 40},${0.05 + rnd() * 0.08})`; x.lineWidth = 1 + rnd() * 1.5; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.stroke(); }
      // a pearly sheen
      const g = x.createLinearGradient(X, Y, X + px, Y + px); g.addColorStop(0, 'rgba(255,240,250,0.18)'); g.addColorStop(0.5, 'rgba(210,235,255,0.08)'); g.addColorStop(1, 'rgba(255,230,200,0.16)');
      x.fillStyle = g; x.fillRect(X, Y, px, px);
    }
    // the laths between the panes
    x.fillStyle = '#4a2c16';
    for (let i = 0; i <= cols; i++) x.fillRect(i * px - 2, 0, 4, h);
    for (let j = 0; j <= rows; j++) x.fillRect(0, j * px - 2, w, 4);
  });
  return tex(c);
}

// The garden outside, as a bright, out-of-focus plate: sky, a mango tree's canopy, the neighbour's roof.
export function gardenPlate() {
  seed = 23;
  const c = canvas(1024, 512, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#9fc4e6'); g.addColorStop(0.55, '#e8eef0'); g.addColorStop(1, '#f8ecd2');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    // a far roof line, galvanised iron catching the sun
    x.fillStyle = 'rgba(150,140,130,0.55)'; x.beginPath(); x.moveTo(0, h * 0.72); x.lineTo(w * 0.35, h * 0.62); x.lineTo(w * 0.6, h * 0.7); x.lineTo(w, h * 0.66); x.lineTo(w, h); x.lineTo(0, h); x.fill();
    // leaves: soft clumps of green, lit from the side
    for (let k = 0; k < 260; k++) {
      const side = k % 2 ? rnd() * 0.35 : 0.65 + rnd() * 0.35, X = side * w, Y = rnd() * h * 0.8, r = 20 + rnd() * 70;
      const gr = x.createRadialGradient(X - r * 0.3, Y - r * 0.3, 2, X, Y, r);
      const l = 0.6 + rnd() * 0.4;
      gr.addColorStop(0, `rgba(${Math.round(150 * l)},${Math.round(190 * l)},${Math.round(90 * l)},0.9)`); gr.addColorStop(1, `rgba(${Math.round(60 * l)},${Math.round(100 * l)},${Math.round(40 * l)},0)`);
      x.fillStyle = gr; x.beginPath(); x.arc(X, Y, r, 0, Math.PI * 2); x.fill();
    }
  });
  return tex(c);
}

// A soft round glow, for sprites: lamp halos, sparks, dust in the sun.
export function glow(inner = 'rgba(255,240,210,1)', outer = 'rgba(255,200,120,0)') {
  const c = canvas(128, 128, (x, w) => { const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, inner); g.addColorStop(0.25, inner.replace(/[\d.]+\)$/, '0.55)')); g.addColorStop(1, outer); x.fillStyle = g; x.fillRect(0, 0, w, w); });
  return tex(c);
}

// A shaft of sunlight: bright along its length, fading to its edges and its end.
export function shaft() {
  const c = canvas(64, 256, (x, w, h) => {
    const img = x.createImageData(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const u = i / (w - 1), v = j / (h - 1), edge = Math.sin(Math.PI * u) ** 2.2, fall = (1 - v) ** 1.4 * Math.min(1, v * 6);
      const a = edge * fall * 255, k = (j * w + i) * 4;
      img.data[k] = 255; img.data[k + 1] = 236; img.data[k + 2] = 200; img.data[k + 3] = a;
    }
    x.putImageData(img, 0, 0);
  });
  return tex(c);
}

// A burnt house: charcoal, cracked, with a glow still in the cracks.
export function scorch() {
  seed = 5;
  const c = canvas(256, 256, (x, w) => {
    const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(18,12,8,1)'); g.addColorStop(0.62, 'rgba(26,16,10,0.96)'); g.addColorStop(0.85, 'rgba(40,22,12,0.5)'); g.addColorStop(1, 'rgba(40,22,12,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, w);
    for (let k = 0; k < 900; k++) { const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * w * 0.42; x.fillStyle = `rgba(${60 + rnd() * 40},${40 + rnd() * 30},${30 + rnd() * 20},${rnd() * 0.5})`; x.fillRect(w / 2 + Math.cos(a) * r, w / 2 + Math.sin(a) * r, 2, 2); }
  });
  return tex(c);
}
export function embers() {
  seed = 9;
  const c = canvas(256, 256, (x, w) => {
    x.fillStyle = '#000'; x.fillRect(0, 0, w, w);
    x.lineCap = 'round';
    for (let k = 0; k < 26; k++) {
      let px = w / 2 + (rnd() - 0.5) * w * 0.6, py = w / 2 + (rnd() - 0.5) * w * 0.6;
      x.strokeStyle = `rgba(255,${90 + rnd() * 80},20,${0.5 + rnd() * 0.5})`; x.lineWidth = 1 + rnd() * 2;
      x.beginPath(); x.moveTo(px, py);
      for (let s = 0; s < 5; s++) { px += (rnd() - 0.5) * 26; py += (rnd() - 0.5) * 26; x.lineTo(px, py); }
      x.stroke();
    }
    const g = x.createRadialGradient(w / 2, w / 2, w * 0.3, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
    x.fillStyle = g; x.fillRect(0, 0, w, w);
  });
  return tex(c, { srgb: true });
}

// A dashed ring, for where a handful lands.
export function dashRing() {
  const c = canvas(256, 256, (x, w) => {
    x.strokeStyle = '#fff'; x.lineWidth = 12; x.setLineDash([22, 16]); x.lineCap = 'round';
    x.beginPath(); x.arc(w / 2, w / 2, w / 2 - 12, 0, Math.PI * 2); x.stroke();
  });
  return tex(c);
}
export function softRing() {
  const c = canvas(256, 256, (x, w) => {
    const g = x.createRadialGradient(w / 2, w / 2, w * 0.3, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.72, 'rgba(255,255,255,0.9)'); g.addColorStop(0.8, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, w);
  });
  return tex(c);
}

// The print on Lola's house dress: small flowers on a faded blue, the way every lola's duster looks.
export function duster() {
  seed = 31;
  const c = canvas(512, 512, (x, w) => {
    x.fillStyle = '#5d7fa6'; x.fillRect(0, 0, w, w);
    for (let k = 0; k < 140; k++) {
      const X = rnd() * w, Y = rnd() * w, r = 6 + rnd() * 9, col = ['#f2e6d8', '#e9a6a0', '#f4d58a', '#cfe3f0'][k % 4];
      x.fillStyle = col;
      for (let p = 0; p < 5; p++) { const a = (p / 5) * Math.PI * 2 + k; x.beginPath(); x.ellipse(X + Math.cos(a) * r * 0.6, Y + Math.sin(a) * r * 0.6, r * 0.45, r * 0.28, a, 0, Math.PI * 2); x.fill(); }
      x.fillStyle = '#c88a3a'; x.beginPath(); x.arc(X, Y, r * 0.22, 0, Math.PI * 2); x.fill();
      x.strokeStyle = '#3f7a4a'; x.lineWidth = 2; x.beginPath(); x.moveTo(X + r, Y + r * 0.4); x.quadraticCurveTo(X + r * 1.6, Y + r * 1.2, X + r * 2.2, Y + r * 0.8); x.stroke();
    }
  });
  return tex(c, { repeat: [3, 3] });
}
