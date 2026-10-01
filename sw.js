// Offline play: the game's own files (three.js, the board, the sala's scans and sounds) are cached on install and served cache-first; the webfont is
// cached the first time it loads. Bump VERSION whenever a file changes so players get the update.
const VERSION = 'isangtira-v3';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'style.css',
  'src/app.mjs',
  'src/audio.mjs',
  'src/daily.mjs',
  'src/demos.mjs',
  'src/engine.mjs',
  'src/envpack.mjs',
  'src/events.mjs',
  'src/match.mjs',
  'src/post.mjs',
  'src/preview.mjs',
  'src/prng.mjs',
  'src/progress.mjs',
  'src/room.mjs',
  'src/solver.mjs',
  'src/sungka3d.mjs',
  'src/tex.mjs',
  'src/timing.mjs',
  'src/view3d.mjs',
  'src/vendor/three.module.min.js',
  'src/vendor/three-fx.min.js',
  'src/vendor/three-mocap.min.js',
  'assets/board/arm.jpg',
  'assets/board/diff.jpg',
  'assets/board/nor.jpg',
  'assets/board/sungka.bin',
  'assets/board/sungka.json',
  'assets/env/env.json',
  'assets/env/tex/beige_wall_001_arm.jpg',
  'assets/env/tex/beige_wall_001_diff.jpg',
  'assets/env/tex/beige_wall_001_nor.jpg',
  'assets/env/tex/dark_paneled_wood_arm.jpg',
  'assets/env/tex/dark_paneled_wood_diff.jpg',
  'assets/env/tex/dark_paneled_wood_nor.jpg',
  'assets/env/tex/dark_wood_arm.jpg',
  'assets/env/tex/dark_wood_diff.jpg',
  'assets/env/tex/dark_wood_nor.jpg',
  'assets/env/tex/lacquered_cherry_wood_arm.jpg',
  'assets/env/tex/lacquered_cherry_wood_diff.jpg',
  'assets/env/tex/lacquered_cherry_wood_nor.jpg',
  'assets/env/tex/plank_flooring_04_arm.jpg',
  'assets/env/tex/plank_flooring_04_diff.jpg',
  'assets/env/tex/plank_flooring_04_nor.jpg',
  'assets/env/tex/wood_plank_wall_arm.jpg',
  'assets/env/tex/wood_plank_wall_diff.jpg',
  'assets/env/tex/wood_plank_wall_nor.jpg',
  'assets/env/sky/pine_attic.hdr',
  'assets/env/props/antique_ceramic_vase_01.glb',
  'assets/env/props/carved_wooden_plate.glb',
  'assets/env/props/gallinera_chair.glb',
  'assets/env/props/gallinera_table.glb',
  'assets/env/props/hanging_picture_frame_03.glb',
  'assets/env/props/lambis_shell.glb',
  'assets/env/props/mantel_clock_01.glb',
  'assets/env/props/potted_plant_02.glb',
  'assets/env/props/round_spectacles.glb',
  'assets/env/props/vintage_oil_lamp.glb',
  'assets/env/props/wicker_basket_02.glb',
  'assets/env/props/wooden_bowl_02.glb',
  'assets/sfx/back0.mp3',
  'assets/sfx/clack0.mp3',
  'assets/sfx/clack1.mp3',
  'assets/sfx/clack2.mp3',
  'assets/sfx/clack3.mp3',
  'assets/sfx/clack4.mp3',
  'assets/sfx/clack5.mp3',
  'assets/sfx/clack6.mp3',
  'assets/sfx/glass0.mp3',
  'assets/sfx/knock0.mp3',
  'assets/sfx/knock1.mp3',
  'assets/sfx/knock2.mp3',
  'assets/sfx/knock3.mp3',
  'assets/sfx/knock4.mp3',
  'assets/sfx/ok0.mp3',
  'assets/sfx/pluck0.mp3',
  'assets/sfx/scoop0.mp3',
  'assets/sfx/scoop1.mp3',
  'assets/sfx/scoop2.mp3',
  'assets/sfx/shake0.mp3',
  'assets/sfx/stack0.mp3',
  'assets/sfx/stack1.mp3',
  'assets/sfx/stack2.mp3',
  'assets/sfx/stack3.mp3',
  'assets/sfx/stack4.mp3',
  'assets/sfx/stack5.mp3',
  'assets/sfx/tick0.mp3',
  'assets/sfx/tick1.mp3',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !font) return;
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    const hit = await cache.match(e.request, { ignoreSearch: url.origin === location.origin });
    if (hit) return hit;
    try {
      const res = await fetch(e.request);
      if (res.ok || res.type === 'opaque') cache.put(e.request, res.clone());
      return res;
    } catch {
      return (await cache.match('index.html')) || Response.error();
    }
  }));
});
