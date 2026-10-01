// The film look, after Tumbang Preso's. The frame is rendered in HDR, then:
// - ambient occlusion settles the shells into their holes and the room into its corners
// - a shallow depth of field keeps the eye on the board (the room and the window go soft)
// - bloom makes the capiz window, the lamp and the sparks glow
// - a filmic tone map, a warm afternoon grade, a vignette and fine grain
// - SMAA for clean edges
// Three levels (2 all, 1 without occlusion and depth of field, 0 plain). It steps down by itself when
// frames run slow, unless the level was chosen.
import * as THREE from './vendor/three.module.min.js';
import { EffectComposer, RenderPass, UnrealBloomPass, GTAOPass, OutputPass, SMAAPass, ShaderPass, BokehPass } from './vendor/three-fx.min.js';

// [contrast, saturation, tint, vignette, bloom strength, bloom threshold]
export const GRADE = {
  hapon: [1.06, 1.08, [1.05, 0.99, 0.9], 0.42, 0.32, 0.92], // the afternoon
  takipsilim: [1.1, 1.02, [1.08, 0.95, 0.9], 0.5, 0.42, 0.85], // a round's end: warmer, deeper
};

const Grade = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, contrast: { value: 1 }, sat: { value: 1 }, tint: { value: new THREE.Vector3(1, 1, 1) }, vig: { value: 0.4 }, grain: { value: 0.03 }, flash: { value: 0 }, lift: { value: new THREE.Vector3(0.012, 0.008, 0.004) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time, contrast, sat, vig, grain, flash; uniform vec3 tint, lift; varying vec2 vUv;
    float rnd(vec2 c){ return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5;
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      c = (c - 0.5) * contrast + 0.5;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, sat) * tint;
      c += lift * (1.0 - l); // warm shadows, like old film
      c *= mix(1.0, smoothstep(0.95, 0.2, length(d * vec2(1.2, 1.0))), vig);
      c += (rnd(vUv * 731.0 + fract(time) * 17.0) - 0.5) * grain;
      c = mix(c, vec3(1.0, 0.96, 0.88), flash * 0.5);
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

export function createPost(renderer, scene, camera, { level = 2, auto: auto0 = true } = {}) {
  let auto = auto0;
  let composer = null, gtao = null, bloom = null, grade = null, bokeh = null, lvl = level;
  const size = new THREE.Vector2();
  let focus = 0.8, aperture = 0.0022, dof = true;
  function build() {
    if (composer) composer.dispose();
    composer = null; gtao = bloom = grade = bokeh = null;
    if (lvl <= 0) return;
    renderer.getSize(size);
    const pr = renderer.getPixelRatio();
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(pr); composer.setSize(size.x, size.y);
    composer.addPass(new RenderPass(scene, camera));
    if (lvl >= 2) {
      gtao = new GTAOPass(scene, camera, size.x, size.y, undefined, { radius: 0.06, distanceExponent: 1.6, thickness: 0.05, scale: 1.2, samples: 16, distanceFallOff: 1 }, { radius: 6, rings: 2, samples: 12 });
      gtao.blendIntensity = 0.85;
      composer.addPass(gtao);
      bokeh = new BokehPass(scene, camera, { focus, aperture, maxblur: 0.006 });
      bokeh.enabled = dof;
      composer.addPass(bokeh);
    }
    bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.3, 0.6, 0.9);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    grade = new ShaderPass(Grade);
    composer.addPass(grade);
    composer.addPass(new SMAAPass());
    setGrade(gradeId);
  }
  let gradeId = 'hapon', mix = 0;
  function setGrade(id) { gradeId = id; grace = Math.max(grace, 3); }
  // slow frames: step down once the average stays under ~40 fps for a few seconds
  let avg = 1 / 60, slowT = 0, last = 0, grace = 6; // loading and shader compiles hitch at first: give it a few seconds
  const tint = new THREE.Vector3(), tA = new THREE.Vector3(), tB = new THREE.Vector3();
  function render(dt, { flash = 0, bloomBoost = 0 } = {}) {
    const t = performance.now() / 1000, real = last ? Math.min(1, t - last) : 1 / 60; last = t;
    avg = avg * 0.9 + real * 0.1;
    if (grace > 0) grace -= real; else slowT = avg > 1 / 40 ? slowT + real : Math.max(0, slowT - real);
    if (auto && slowT > 4 && lvl > 0) { lvl--; slowT = 0; grace = 3; build(); }
    if (!composer) { renderer.render(scene, camera); return; }
    // grades blend over a second or so
    mix += ((gradeId === 'takipsilim' ? 1 : 0) - mix) * Math.min(1, dt * 1.5);
    const A = GRADE.hapon, B = GRADE.takipsilim, L = (a, b) => a + (b - a) * mix;
    const u = grade.uniforms;
    u.time.value = t; u.flash.value = flash;
    u.contrast.value = L(A[0], B[0]); u.sat.value = L(A[1], B[1]); u.vig.value = L(A[3], B[3]);
    u.tint.value.copy(tint.copy(tA.fromArray(A[2])).lerp(tB.fromArray(B[2]), mix));
    bloom.strength = L(A[4], B[4]) + bloomBoost; bloom.threshold = L(A[5], B[5]);
    if (bokeh) { bokeh.enabled = dof; const bu = bokeh.uniforms; bu.focus.value = focus; bu.aperture.value = aperture; }
    composer.render(dt);
  }
  function resize() { if (!composer) return; renderer.getSize(size); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(size.x, size.y); }
  build();
  return {
    render, resize, setGrade,
    setAuto(b) { auto = b; },
    // what's sharp: the distance from the camera, and how shallow (0 turns it off)
    setFocus(d, ap = aperture) { focus = d; aperture = ap; dof = ap > 0; },
    get level() { return lvl; },
    setLevel(n) { lvl = n; build(); },
  };
}
