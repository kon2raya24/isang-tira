// Sound for Isang Tira. Real recordings (CC0, from Kenney): shells clacking on shells and knocking into
// wood, a handful scooped up, a heap poured into an ulo, and a few soft clicks for the menus. Around them,
// synthesized: a slow harana on a plucked guitar (Karplus-Strong), birds in the garden, the tick of
// Lola's clock. Nothing plays until start() runs from a tap or a key; the recordings load then.
const SAMPLES = { clack: 7, knock: 5, scoop: 3, stack: 6, shake: 1, tick: 2, ok: 1, glass: 1, pluck: 1, back: 1 };
const NOTE = (n) => 440 * 2 ** ((n - 69) / 12);
// a harana in 3/4: chords (as root, third, fifth) and a melody over them, one note per beat
const CHORDS = [[57, 60, 64], [52, 56, 59], [57, 60, 64], [50, 53, 57], [52, 55, 59], [57, 61, 64], [50, 53, 57], [52, 56, 59]];
const MELODY = [76, 74, 72, 71, 72, 74, 72, 71, 69, 74, 72, 69, 71, 72, 74, 72, 73, 76, 74, 72, 69, 71, 68, 71];

export function createAudio({ base = 'assets/sfx/' } = {}) {
  let ctx = null, master = null, music = null, sfx = null, amb = null, noise = null, muted = false;
  const buf = {}, mix = { music: 0.6, sfx: 1 }, strings = new Map();
  let playing = false, nextAt = 0, beat = 0, clockAt = 0, birdAt = 0;

  function start() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
    // a little room around everything
    const verb = ctx.createConvolver(), ir = ctx.createBuffer(2, ctx.sampleRate * 1.2, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3; }
    verb.buffer = ir; const wet = ctx.createGain(); wet.gain.value = 0.18; verb.connect(wet).connect(master);
    music = ctx.createGain(); music.gain.value = mix.music * 0.5; music.connect(master); music.connect(verb);
    sfx = ctx.createGain(); sfx.gain.value = mix.sfx; sfx.connect(master); const send = ctx.createGain(); send.gain.value = 0.35; sfx.connect(send).connect(verb);
    amb = ctx.createGain(); amb.gain.value = mix.music * 0.6; amb.connect(master);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    setInterval(schedule, 60);
    for (const [k, n] of Object.entries(SAMPLES)) for (let i = 0; i < n; i++) fetch(`${base}${k}${i}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject())).then((a) => ctx.decodeAudioData(a)).then((b) => { buf[k + i] = b; }).catch(() => { /* synth only */ });
  }
  function play(name, gain = 1, rate = 1, vary = 0.08, when = 0, out = sfx) {
    if (!ctx || muted) return false;
    const takes = Array.from({ length: SAMPLES[name] || 0 }, (_, i) => buf[name + i]).filter(Boolean);
    if (!takes.length) return false;
    const s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = takes[Math.floor(Math.random() * takes.length)]; s.playbackRate.value = rate * (1 + (Math.random() * 2 - 1) * vary);
    g.gain.value = gain; s.connect(g).connect(out); s.start(ctx.currentTime + when);
    return true;
  }
  function tone(freq, dur, type = 'sine', gain = 0.05, when = 0, out = sfx) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
  }
  // a plucked nylon string: Karplus-Strong, rendered once per note and kept
  function string(n) {
    if (strings.has(n)) return strings.get(n);
    const sr = ctx.sampleRate, len = Math.floor(sr * 2.2), b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0);
    const p = Math.max(2, Math.round(sr / NOTE(n))), ring = new Float32Array(p);
    for (let i = 0; i < p; i++) ring[i] = (Math.random() * 2 - 1) * (0.6 + 0.4 * Math.sin((i / p) * Math.PI));
    let k = 0, prev = 0;
    for (let i = 0; i < len; i++) { const v = ring[k]; d[i] = v; const nv = 0.5 * (v + prev) * 0.9965; prev = v; ring[k] = nv; k = (k + 1) % p; }
    strings.set(n, b); return b;
  }
  function pluck(n, when, gain) {
    if (!ctx) return;
    const s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    s.buffer = string(n); f.type = 'lowpass'; f.frequency.value = 2400; g.gain.value = gain;
    s.connect(f).connect(g).connect(music); s.start(ctx.currentTime + when);
  }
  function schedule() {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    // the clock on Lola's chest, and the garden
    if (clockAt < now) clockAt = now + 0.05;
    while (clockAt < now + 0.2) { const w = clockAt - now; hiss(0.012, 3800, 0.02, w, 'bandpass', amb); tone(2600, 0.02, 'sine', 0.006, w, amb); clockAt += 1; }
    if (now > birdAt) { birdAt = now + 4 + Math.random() * 9; bird(); }
    if (!playing) return;
    const spb = 60 / 84;
    if (nextAt < now) nextAt = now + 0.05;
    while (nextAt < now + 0.25) {
      const w = nextAt - now, bar = Math.floor(beat / 3) % CHORDS.length, b3 = beat % 3, ch = CHORDS[bar];
      if (b3 === 0) pluck(ch[0] - 12, w, 0.22);
      else { pluck(ch[1], w, 0.09); pluck(ch[2], w + 0.012, 0.08); }
      const m = MELODY[beat % MELODY.length];
      if (m && b3 !== 2) pluck(m, w + 0.02, 0.13);
      nextAt += spb; beat++;
    }
  }
  function hiss(dur, freq, gain, when = 0, type = 'bandpass', out = sfx) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise; f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  // a maya bird outside: a few quick chirps
  function bird() {
    const base = 3200 + Math.random() * 1400, n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const t = ctx.currentTime + i * (0.09 + Math.random() * 0.05), o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(base, t); o.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.3), t + 0.05);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.012, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      o.connect(g).connect(amb); o.start(t); o.stop(t + 0.1);
    }
  }
  let lastLand = 0;
  return {
    start,
    get started() { return !!ctx; },
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.8; },
    setMix(m) { Object.assign(mix, m); if (sfx) sfx.gain.value = mix.sfx; if (music) music.gain.value = mix.music * 0.5; if (amb) amb.gain.value = mix.music * 0.6; },
    setMusic(on) { if (on !== playing) { playing = on; if (on && ctx) nextAt = ctx.currentTime + 0.1; } },
    ui(kind) {
      if (!ctx || muted) return;
      if (kind === 'tick') { if (!play('tick', 0.35, 1.1)) tone(1800, 0.03, 'triangle', 0.02); }
      else if (kind === 'ok') { if (!play('ok', 0.4)) tone(880, 0.12, 'sine', 0.04); }
      else if (kind === 'back') play('back', 0.35);
      else if (kind === 'select') { if (!play('glass', 0.3, 1.2)) tone(1320, 0.08, 'sine', 0.03); }
    },
    // what the board does (from the view): each shell landing, a scoop, a capture...
    event(kind, info = {}) {
      if (!ctx || muted) return;
      switch (kind) {
        case 'land': {
          const now = ctx.currentTime; if (now - lastLand < 0.025) return; lastLand = now; // a heap pouring in: not every one
          const onShells = !info.empty, ulo = info.slot === 7 || info.slot === 15;
          if (onShells) play('clack', 0.55, ulo ? 0.9 : 1.05, 0.12);
          if (!onShells || ulo) { if (!play('knock', onShells ? 0.3 : 0.7, 1.5, 0.1)) tone(420, 0.06, 'triangle', 0.05); }
          if (!onShells) play('clack', 0.25, 1.3, 0.1);
          break;
        }
        case 'scoop': play('scoop', 0.5 + Math.min(0.4, info.n * 0.03), 1.1); break;
        case 'relay': play('scoop', 0.6, 0.95); tone(660, 0.12, 'sine', 0.025); break;
        case 'extra': [0, 4, 7, 12].forEach((k, i) => tone(NOTE(76 + k), 0.35, 'sine', 0.04, i * 0.07)); play('ok', 0.35, 1.2); break;
        case 'capture': case 'sweep': {
          const big = info.n >= 6;
          play('shake', 0.35, 1.1);
          for (let i = 0; i < Math.min(6, 2 + Math.floor(info.n / 3)); i++) play('stack', 0.45, 0.9 + Math.random() * 0.2, 0.1, 0.25 + i * 0.07);
          const up = info.who === 'lola' ? [0, 3, 7] : [0, 4, 7, 12];
          up.forEach((k, i) => tone(NOTE((info.who === 'lola' ? 69 : 72) + k), big ? 0.5 : 0.3, 'triangle', big ? 0.05 : 0.035, 0.2 + i * 0.08));
          break;
        }
        case 'dud': tone(196, 0.3, 'sine', 0.05); play('knock', 0.5, 0.8); break;
        case 'end': tone(262, 0.18, 'sine', 0.025); break;
        case 'par': case 'won': [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, 0.8, 'sine', 0.05, i * 0.11)); break;
        case 'lost': [392, 349.2, 329.6, 261.6].forEach((f, i) => tone(f, 0.6, 'sine', 0.04, i * 0.16)); break;
        case 'round': [0, 7, 12].forEach((k, i) => tone(NOTE(67 + k), 0.5, 'triangle', 0.04, i * 0.12)); break;
        case 'turn': tone(info.who === 'lola' ? 587 : 784, 0.14, 'sine', 0.025); break;
        default: break;
      }
    },
  };
}
