// Isang Tira: Sungka against Lola Iska, and the daily one-turn puzzle. Screens, board, animation,
// sound and storage. Rules come from engine.mjs (and match.mjs for the whole game); the animation
// only plays the rules' own events, so the screen can never disagree with the rules.
import { ULO, LOLA_ULO, isBurnt, legalHouses, distanceToUlo, makeBoard } from './engine.mjs';
import { newMatch, play as playSowing, nextRound, legal as legalFor, lolaMove, LEVELS } from './match.mjs';
import { sowEvents, turnEndEvents, applyEvent } from './events.mjs';
import { firstHandful, firstHandfulText, wholeSowing, wholeSowingText, slotName } from './preview.mjs';
import { stepMs } from './timing.mjs';
import { DEMOS } from './demos.mjs';
import { puzzleFor, manilaDate, addDays, msToNextPuzzle, EPOCH, TIERS, DAYS, weekday, puzzleNumber } from './daily.mjs';
import { newRecord, recordTry, useWhisper, stats, shareText, tryMark, MAX_TRIES, migrate } from './progress.mjs';

const Q = new URLSearchParams(location.search);
const TEST = Q.get('test') === '1';
const KEY = 'isangtira.v1';
const URL_SELF = 'https://isang-tira.vercel.app';
const TOP = [14, 13, 12, 11, 10, 9, 8]; // Lola's row on screen: L6..L0
const BOTTOM = [0, 1, 2, 3, 4, 5, 6];
const SPOTS = [[50, 28], [32, 42], [68, 42], [40, 62], [60, 62], [24, 24], [76, 24], [50, 78], [20, 60], [80, 60]];
const PULSE = [{ transform: 'scale(1)' }, { transform: 'scale(1.14)' }, { transform: 'scale(1)' }];
const SHAKE = [{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }];
const DIM = [{ opacity: 1 }, { opacity: 0.35 }, { opacity: 1 }];
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const reduced = () => (TEST && Q.get('motion') !== '1') || matchMedia('(prefers-reduced-motion: reduce)').matches;

// Lola Iska's lines. She is warm, a little teasing, and never gives the answer away.
const LOLA = {
  hello: ['Magandang araw, apo! Isang tira lang ngayon. Kaya mo \'yan.', 'O, apo, nandito ka na. Tingnan natin ang mga sigay ngayon.', 'Upo ka, apo. Isang tira, isang pagkakataon.'],
  extra: ['Isa pa! Sige, apo.', 'Ayan! Isa pang tira.', 'Tama ang bilang mo, apo.'],
  capture: ['Nakuha mo ang akin! Hmp, galing.', 'Aba, kinuha mo ang mga sigay ko!'],
  miss: ['Muntik na, apo. Subukan mo ulit.', 'Bilangin mong mabuti, anak. May mas maganda pa riyan.', 'Hindi pa \'yan ang pinakamaganda. Isa pa?'],
  par: ['Ayan! Pinakamagandang tira. Proud si Lola sa \'yo!', 'Galing ng apo ko! Sakto sa par.', 'Wala nang mas gaganda pa riyan, apo!'],
  lost: ['Hindi bale, apo. Bukas, may bagong laro si Lola.', 'Ganyan talaga ang sungka. Bukas ulit, ha?'],
  whisper: ['Sige, ibubulong ko sa \'yo kung saan hihinto ang bawat sigay. Pero ikaw pa rin ang pipili.'],
};
const say = (k) => LOLA[k][Math.floor(Math.random() * LOLA[k].length)];

// ---------- storage ----------
const store = {
  get() { if (TEST) return null; try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } },
  set(v) { if (TEST) return; try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage unavailable: keep playing */ } },
};
let data = migrate(store.get());
const save = () => store.set(data);

// ---------- sound ----------
const sound = (() => {
  let ctx = null;
  function tone(freq, dur, type = 'triangle', gain = 0.08, when = 0) {
    if (!ctx || data.muted) return;
    const t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  // a shell clicking into a wooden hole: a short knock plus a higher tick
  const click = (slot) => { tone(slot === ULO ? 170 : 380 + (slot % 8) * 32, 0.06, 'triangle', 0.07); tone(1900 + (slot % 5) * 90, 0.02, 'square', 0.015); };
  return {
    ensure() { if (TEST) return; try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); } catch { ctx = null; } },
    drop: click,
    extra() { [659.25, 880].forEach((f, i) => tone(f, 0.25, 'sine', 0.06, i * 0.07)); },
    capture() { [392, 523.25, 659.25].forEach((f, i) => tone(f, 0.3, 'triangle', 0.07, i * 0.06)); },
    dud() { tone(196, 0.3, 'sine', 0.06); },
    par() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.6, 'sine', 0.06, i * 0.1)); },
  };
})();

// ---------- the board ----------
function boardHtml(id, match = false) {
  const inner = (i) => `<span class="shells" aria-hidden="true"></span><span class="num"></span><span class="lbl" aria-hidden="true">${slotName(i)}</span>`;
  const mine = (i) => `<button type="button" class="h mine" data-slot="${i}">${inner(i)}</button>`;
  const theirs = (i) => `<div class="h" role="img" data-slot="${i}">${inner(i)}</div>`;
  return `<div class="board${match ? ' match' : ''}" id="${id}">
  ${match ? `<div class="lola-ulo counted" role="img" data-slot="${LOLA_ULO}"><span class="ulo-l">ulo ni Lola</span><span class="num"></span></div>` : '<div class="lola-ulo" aria-hidden="true"><span>ulo ni Lola</span></div>'}
  <div class="rows"><div class="row lola">${TOP.map(theirs).join('')}</div><div class="row you">${BOTTOM.map(mine).join('')}</div></div>
  <div class="ulo" role="img" data-slot="${ULO}"><span class="ulo-l">ulo mo</span><span class="num"></span></div>
  <div class="fx" aria-hidden="true"></div>
</div>`;
}

function paint(ctx, legal = []) {
  ctx.$b.querySelectorAll('[data-slot]').forEach(($h) => {
    const i = Number($h.dataset.slot), n = ctx.s[i];
    if (i === ULO) { $h.querySelector('.num').textContent = String(n); $h.setAttribute('aria-label', ctx.match ? `Your ulo: ${n} shells` : `Your ulo: ${n} banked this turn`); return; }
    if (i === LOLA_ULO) { $h.querySelector('.num').textContent = String(n); $h.setAttribute('aria-label', `Lola's ulo: ${n} shells`); return; }
    const burnt = isBurnt(ctx.burnt, i);
    $h.classList.toggle('burnt', burnt);
    $h.querySelector('.num').textContent = burnt ? '✕' : String(n);
    $h.querySelector('.shells').innerHTML = burnt ? '' : SPOTS.slice(0, Math.min(n, 10)).map(([x, y], k) => `<i style="left:${x}%;top:${y}%;--r:${(k * 47) % 180}deg"></i>`).join('');
    const d = i < 7 && !burnt ? distanceToUlo(ctx.burnt, i) : 0;
    $h.setAttribute('aria-label', `${i < 7 ? 'Your house' : "Lola's house"} ${slotName(i)}, ${burnt ? 'burnt' : `${n} shell${n === 1 ? '' : 's'}`}${d ? `, ${d} from your ulo` : ''}`);
    if (i < 7) { const ok = legal.includes(i); $h.setAttribute('aria-disabled', String(!ok)); $h.tabIndex = ok ? 0 : -1; }
  });
  if (ctx.match) { const sc = document.getElementById('score'); if (sc) { sc.innerHTML = `<span><b>${ctx.s[ULO]}</b>ikaw</span><i>vs</i><span><b>${ctx.s[LOLA_ULO]}</b>Lola</span>`; sc.setAttribute('aria-label', `You ${ctx.s[ULO]}, Lola ${ctx.s[LOLA_ULO]}`); } }
}

function center(ctx, slot) {
  const r = ctx.$b.getBoundingClientRect(), c = ctx.$b.querySelector(`[data-slot="${slot}"]`).getBoundingClientRect();
  return [c.left - r.left - ctx.$b.clientLeft + c.width / 2, c.top - r.top - ctx.$b.clientTop + c.height / 2];
}
function fxEl(ctx, cls, html, at) {
  const el = document.createElement('div');
  el.className = cls; el.innerHTML = html;
  el.style.transform = `translate(${at[0]}px, ${at[1]}px)`;
  $('.fx', ctx.$b).appendChild(el);
  return el;
}
async function move(el, from, to, ms, lift = 18) {
  const mid = [(from[0] + to[0]) / 2, lift >= 0 ? Math.min(from[1], to[1]) - lift : Math.max(from[1], to[1]) - lift];
  const pts = lift === 0 ? [from, to] : [from, mid, to];
  const a = el.animate(pts.map(([x, y]) => ({ transform: `translate(${x}px, ${y}px)` })), { duration: ms, easing: 'ease-in-out' });
  el.style.transform = `translate(${to[0]}px, ${to[1]}px)`;
  await a.finished;
}
const houseW = (ctx) => ctx.$b.querySelector('.h').getBoundingClientRect().width;
function handAt(ctx, slot) { const [x, y] = center(ctx, slot); const w = houseW(ctx); return [x, slot >= 8 && slot <= 14 ? y + 0.5 * w : y - 0.5 * w]; }
function newHand(ctx, cls, n, at) { const el = fxEl(ctx, cls, `<span>${n}</span>`, at); el.style.setProperty('--hand', `${Math.min(30, Math.round(0.6 * houseW(ctx)))}px`); return el; }
const rowOf = (slot) => (slot <= 6 ? 'you' : slot >= 8 && slot <= 14 ? 'lola' : 'ulo');
function flash(ctx, slot, kf, ms) { const el = ctx.$b.querySelector(`[data-slot="${slot}"]`); return el ? el.animate(kf, { duration: ms, easing: 'ease-out' }).finished : Promise.resolve(); }
function showRings(ctx, slots, whole) {
  clearRings(ctx);
  const size = houseW(ctx) + 10;
  slots.forEach((slot, k) => { const el = fxEl(ctx, `ring${whole ? ' ws' : ''}`, whole ? `<b>${k + 1}</b>` : '', center(ctx, slot)); el.style.setProperty('--d', `${size}px`); });
}
const clearRings = (ctx) => ctx.$b.querySelectorAll('.fx .ring').forEach((el) => el.remove());

let active = null; // the ctx currently animating, so a tap can speed it up
async function animate(ctx, events) {
  const fast = reduced();
  let hand = null, pos = null, inHand = 0, drops = 0;
  ctx.speed = ctx.base || 1; active = ctx;
  const ms = (e) => stepMs(e, drops) / ctx.speed;
  const dropHand = () => { if (hand) { hand.remove(); hand = null; } };
  for (const e of events) {
    if (!ctx.$b.isConnected) return false;
    if (fast) { applyEvent(ctx.s, e); if (e.t === 'drop') drops++; continue; }
    switch (e.t) {
      case 'lift': {
        applyEvent(ctx.s, e); paint(ctx); pos = e.slot; inHand = e.n;
        const at = handAt(ctx, pos);
        hand = newHand(ctx, ctx.lola ? 'hand lola-hand' : 'hand', inHand, at);
        const place = `translate(${at[0]}px, ${at[1]}px)`;
        await hand.animate([{ opacity: 0, transform: `${place} scale(0.4)` }, { opacity: 1, transform: `${place} scale(1)` }], { duration: ms(e) }).finished;
        break;
      }
      case 'drop': {
        drops++;
        const rows = rowOf(pos) + rowOf(e.slot);
        await move(hand, handAt(ctx, pos), handAt(ctx, e.slot), ms(e), rows === 'youyou' ? 10 : rows === 'lolalola' ? -10 : 0);
        pos = e.slot; inHand--; hand.firstChild.textContent = String(inHand);
        applyEvent(ctx.s, e); paint(ctx);
        if (!ctx.quiet) sound.drop(e.slot);
        flash(ctx, e.slot, PULSE, 160);
        break;
      }
      case 'relay':
        await flash(ctx, e.slot, PULSE, ms(e));
        applyEvent(ctx.s, e); paint(ctx); inHand = e.n; hand.firstChild.textContent = String(inHand);
        break;
      case 'extra': {
        dropHand();
        if (!ctx.quiet) sound.extra();
        const [ux, uc] = center(ctx, e.slot);
        const uy = uc - 0.3 * ctx.$b.querySelector(`[data-slot="${e.slot}"]`).getBoundingClientRect().height;
        const st = fxEl(ctx, 'stamp', 'ISA PA!', [ux, uy]);
        const pose = (k) => `translate(${ux}px, ${uy}px) rotate(-8deg) scale(${k})`;
        st.style.transform = pose(1);
        await st.animate([{ opacity: 0, transform: pose(0.4) }, { opacity: 1, transform: pose(1.12), offset: 0.35 }, { opacity: 1, transform: pose(1), offset: 0.75 }, { opacity: 0, transform: pose(1) }], { duration: ms(e) }).finished;
        st.remove();
        break;
      }
      case 'capture': case 'sweep': {
        dropHand();
        if (!ctx.quiet) sound.capture();
        const to = e.ulo ?? ULO, lolas = e.side === 'lola';
        const from = e.t === 'capture' ? e.opp : lolas ? 11 : 3;
        (e.t === 'capture' ? [e.opp, e.slot] : lolas ? TOP : BOTTOM).forEach((i) => ctx.$b.querySelector(`[data-slot="${i}"]`).classList.add('taken'));
        const chip = newHand(ctx, 'hand take', e.n, center(ctx, from));
        await move(chip, center(ctx, from), center(ctx, to), ms(e), 30);
        chip.remove();
        ctx.$b.querySelectorAll('.taken').forEach((el) => el.classList.remove('taken'));
        applyEvent(ctx.s, e); paint(ctx); flash(ctx, to, PULSE, 200);
        break;
      }
      case 'dud': dropHand(); if (!ctx.quiet) sound.dud(); await flash(ctx, e.slot, SHAKE, ms(e)); break;
      case 'end': dropHand(); await flash(ctx, e.slot, DIM, ms(e)); break;
      default: throw new Error(`unknown event ${e.t}`);
    }
  }
  dropHand();
  if (fast) paint(ctx);
  if (active === ctx) active = null;
  return true;
}

// ---------- today's game ----------
const $app = $('#app'), $live = $('#live');
const announce = (t) => { $live.textContent = ''; setTimeout(() => { $live.textContent = t; }, 30); };
const today = () => (TEST && Q.get('date')) || manilaDate();
let puzzle = null, rec = null, ui = null, run = 0;

const toState = (p) => ({ s: Uint8Array.from(p.board), burnt: p.burnt });
const lolaSays = (text) => { const el = $('#lola-line'); if (el) { el.textContent = text; el.parentElement.classList.remove('talk'); void el.offsetWidth; el.parentElement.classList.add('talk'); } };

function open(iso) {
  run++; mrun++; mui = null;
  prefs.mode = 'daily'; savePrefs();
  puzzle = puzzleFor(iso);
  const daily = iso === today();
  rec = data.records[iso] || newRecord(puzzle, daily);
  const { s, burnt } = toState(puzzle);
  ui = { s, burnt, busy: false, selected: null, $b: null, lola: false };
  render();
}

function header() {
  const t = TIERS[puzzle.tier];
  const archive = !rec.daily ? '<span class="tag">Archive · practice</span>' : '';
  return `<header class="top">
    <div><div class="kicker">Isang Tira #${puzzle.number} · ${esc(puzzle.day)} · ${esc(t.name)} ${archive}</div><h1>Isang Tira</h1></div>
    <div class="par" role="img" aria-label="Par ${puzzle.par}"><b>${puzzle.par}</b><span>par</span></div>
  </header>
  <nav class="tools" aria-label="Menu">
    <button type="button" class="small" data-act="help">Paano laruin</button>
    <button type="button" class="small" data-act="stats">Stats</button>
    <button type="button" class="small" data-act="archive">Nakaraan</button>
    <button type="button" class="small" data-act="mute" aria-label="Sound">${data.muted ? '🔇' : '🔊'}</button>
  </nav>`;
}

function marks() {
  const cells = [];
  for (let k = 0; k < MAX_TRIES; k++) {
    const s = rec.tries[k];
    cells.push(s === undefined ? `<span class="mk${k === rec.tries.length && !rec.done ? ' now' : ''}">${k + 1}</span>` : `<span class="mk played" title="${s} of ${puzzle.par}">${tryMark(s, puzzle.par)}<small>${s}</small></span>`);
  }
  return `<div class="marks" aria-label="Your tries">${cells.join('')}</div>`;
}

function render() {
  $app.innerHTML = `${modeTabs('daily')}${header()}
  <div class="lola"><div class="lola-face" aria-hidden="true">👵</div><p class="lola-bubble"><span id="lola-line"></span></p></div>
  <div class="meta">${marks()}<span class="spacer"></span><span id="mode" class="badge${rec.whisper ? ' ws' : ''}">${rec.whisper ? 'Bulong ni Lola: buong sowing' : 'Preview: unang dakot'}</span></div>
  ${boardHtml('b')}
  <p class="caption" id="caption"></p>
  <div class="panel" id="panel"></div>
  <p class="hint">Tap a house to see where its first handful lands, then tap again to sow. Tap during a sowing to speed it up. Keys 1–7 pick Y0–Y6.</p>`;
  ui.$b = $('#b');
  refresh();
  if (rec.done) { finished(); return; }
  lolaSays(rec.tries.length ? say('miss') : say('hello'));
  if (!data.seenRules && !TEST) help();
}

const legalNow = () => (!ui || ui.busy || rec.done ? [] : legalHouses(ui.s, ui.burnt));

function refresh() {
  paint(ui, legalNow());
  ui.$b.querySelectorAll('.h.mine').forEach(($h) => $h.classList.toggle('sel', Number($h.dataset.slot) === ui.selected));
  const $p = $('#panel');
  if (rec.done) return;
  const whisperBtn = rec.tries.length && !rec.whisper ? '<button type="button" class="ghost" data-act="whisper">👵 Bulong ni Lola</button>' : '';
  $p.innerHTML = `<button type="button" class="primary" data-act="sow"${ui.selected === null || ui.busy ? ' disabled' : ''}>${ui.selected === null ? 'Pumili ng bahay' : `Sow ${slotName(ui.selected)}`}</button>${ui.busy ? '' : whisperBtn}`;
}

const caption = (t) => { const el = $('#caption'); if (el) el.textContent = t; };

function select(h) {
  if (!ui || ui.busy || rec.done) return undefined;
  if (!legalNow().includes(h)) { caption(isBurnt(ui.burnt, h) ? `${slotName(h)} is burnt.` : `${slotName(h)} is empty.`); return undefined; }
  sound.ensure();
  if (ui.selected === h) return playMove(h);
  ui.selected = h;
  const n = ui.s[h];
  if (rec.whisper) { const w = wholeSowing(ui.s, ui.burnt, h); showRings(ui, w.stops, true); caption(`${slotName(h)} (${n}): ${wholeSowingText(w)}`); }
  else { const f = firstHandful(ui.s, ui.burnt, h); showRings(ui, [f.lands], false); caption(`${slotName(h)} (${n}): ${firstHandfulText(f)}`); }
  announce($('#caption').textContent);
  refresh();
  return undefined;
}

async function playMove(h) {
  ui.busy = true; clearRings(ui); ui.selected = null; refresh(); caption('');
  const { events, result } = sowEvents(ui.s, ui.burnt, h);
  const told = wholeSowingText(wholeSowing(ui.s, ui.burnt, h));
  if (!(await animate(ui, events))) return;
  ui.s = Uint8Array.from(result.state);
  if (result.outcome === 'extra' && legalHouses(ui.s, ui.burnt).length) {
    ui.busy = false; refresh();
    caption(`${slotName(h)}: ${told} Isa pa! Pumili ulit.`);
    lolaSays(say('extra'));
    ui.$b.querySelector(`[data-slot="${legalNow()[0]}"]`)?.focus({ preventScroll: true });
    return;
  }
  if (result.outcome === 'capture') lolaSays(say('capture'));
  const te = turnEndEvents(ui.s, ui.burnt);
  await animate(ui, te.events);
  ui.s = Uint8Array.from(te.result.state);
  const score = ui.s[ULO];
  rec = recordTry(rec, score);
  data.records[puzzle.iso] = rec;
  save();
  ui.busy = false;
  if (score >= puzzle.par) { sound.par(); celebrate(); }
  if (rec.done) { await wait(reduced() ? 0 : 700); finished(); return; }
  caption(`Tapos ang tira: ${score} of par ${puzzle.par}.`);
  lolaSays(say('miss'));
  $('#panel').innerHTML = `<p class="result no"><b>${score}</b> of par ${puzzle.par}</p><button type="button" class="primary" data-act="again">Subukan ulit (${MAX_TRIES - rec.tries.length} pa)</button>${rec.whisper ? '' : '<button type="button" class="ghost" data-act="whisper">👵 Bulong ni Lola</button>'}`;
  $('.marks').outerHTML = marks();
}

function celebrate(ctx = ui) {
  if (reduced() || !ctx) return;
  const at = center(ctx, ULO);
  for (let k = 0; k < 18; k++) {
    const el = fxEl(ctx, 'spark', '', at), a = (k / 18) * Math.PI * 2, r = 50 + (k % 3) * 18;
    el.animate([{ transform: `translate(${at[0]}px, ${at[1]}px)`, opacity: 1 }, { transform: `translate(${at[0] + Math.cos(a) * r}px, ${at[1] + Math.sin(a) * r}px) rotate(${k * 40}deg)`, opacity: 0 }], { duration: 900, easing: 'ease-out' }).finished.then(() => el.remove());
  }
}

function again() { const { s } = toState(puzzle); ui.s = s; ui.selected = null; render(); lolaSays(say('miss')); }

// ---------- the end of the day ----------
function finished() {
  const st = stats(data.records, today());
  lolaSays(rec.won ? say('par') : say('lost'));
  const head = rec.won ? `<b>${rec.best}</b> of par ${puzzle.par} · par ${rec.parTry === 1 ? 'on your first try!' : `on try ${rec.parTry}`}` : `<b>${rec.best}</b> of par ${puzzle.par}`;
  const next = rec.daily ? '<p class="fine">Bagong laro sa <b id="countdown"></b> (hatinggabi sa Maynila).</p>' : '';
  $('#panel').innerHTML = `<div class="done">
    <p class="result ${rec.won ? 'yes' : 'no'}">${head}${rec.whisper ? ' <span title="Lola whispered">👵</span>' : ''}</p>
    ${rec.daily ? `<p class="streak">🔥 Streak <b>${st.streak}</b> · best ${st.maxStreak} · ${st.wins}/${st.played} par</p>` : ''}
    <div class="btns"><button type="button" class="primary" data-act="share">I-share · Share</button><button type="button" data-act="replay">👵 Panoorin si Lola</button></div>
    <p id="copied" class="fine" role="status"></p>
    ${next}
  </div>`;
  $('.marks').outerHTML = marks();
  $('.hint')?.remove();
  paint(ui, []);
  if (rec.daily) tick();
}

let timer = 0;
function tick() {
  clearTimeout(timer);
  const el = $('#countdown');
  if (!el) return;
  const ms = msToNextPuzzle();
  if (ms <= 0) { open(today()); return; }
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
  el.textContent = `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  timer = setTimeout(tick, 1000);
}

// Lola's hand plays the easiest perfect line, drop by drop.
async function replay() {
  const me = ++run;
  const { s, burnt } = toState(puzzle);
  const ctx = { $b: ui.$b, s, burnt, speed: 1, quiet: false, lola: true };
  paint(ctx);
  lolaSays('Panoorin mo, apo. Ganito ang tira ni Lola.');
  caption(`Perfect line: ${puzzle.easiest.map(slotName).join(' → ')}${puzzle.perfectLines > 1 ? ` (1 of ${puzzle.perfectLines})` : ''}`);
  for (const h of puzzle.easiest) {
    if (me !== run || !ctx.$b.isConnected) return;
    const $h = ctx.$b.querySelector(`[data-slot="${h}"]`);
    $h.classList.add('sel');
    await wait(reduced() ? 0 : 600);
    $h.classList.remove('sel');
    if (!(await animate(ctx, sowEvents(ctx.s, burnt, h).events))) return;
  }
  await animate(ctx, turnEndEvents(ctx.s, burnt).events);
  lolaSays(`${ctx.s[ULO]}. Ganyan, apo. Bukas, ikaw na.`);
}

async function share() {
  const text = shareText(puzzle, rec, URL_SELF);
  let ok = false;
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) { await navigator.share({ text }); ok = true; }
    else { await navigator.clipboard.writeText(text); ok = true; }
  } catch { ok = false; }
  $('#copied').textContent = ok ? 'Nakopya! Paste it anywhere: no spoilers, only your shells.' : text;
}

// ---------- dialogs ----------
function dialog(html, cls = '') {
  const d = $('#dlg');
  d.className = cls;
  d.innerHTML = `${html}<div class="btns"><button type="button" class="primary" data-act="close">Sige · OK</button></div>`;
  d.showModal();
  return d;
}

function help() {
  data.seenRules = true; save();
  const d = dialog(`<h2>Paano laruin</h2>
  <p>One Sungka turn a day. Bank as many shells in your ulo as you can. <b>Par</b> is the best possible, proven by a solver. You get three tries.</p>
  <ol class="rules">
    <li>Pick a house in <b>your row</b> (bottom). Its shells go one per slot: along your row, into <b>your ulo</b>, then along Lola's row. Lola's ulo is skipped.</li>
    <li>Last shell in <b>your ulo</b>: <b>isa pa!</b> Choose again.</li>
    <li>Last shell in a house that <b>has shells</b>: scoop them all up and keep sowing.</li>
    <li>Last shell in <b>your own empty house</b>: capture Lola's house opposite, plus that shell. Nothing opposite? The turn just ends.</li>
    <li>Last shell in an <b>empty Lola house</b>: the turn ends.</li>
  </ol>
  <figure class="demo"><div aria-hidden="true">${boardHtml('demo')}</div><figcaption id="demo-cap"></figcaption></figure>
  <p class="fine">Tapping a house shows where its <b>first handful</b> lands. If it lands on shells, you'll have to count the rest yourself. Missed? Ask for <b>👵 Bulong ni Lola</b> and she'll show each whole sowing (your share will show 👵). Monday is gentle; the week gets harder; Sunday is long.</p>`, 'wide');
  runDemo(d);
}

async function runDemo(d) {
  const me = ++run;
  const $b = $('#demo', d);
  for (let k = 0; me === run && d.open; k = (k + 1) % DEMOS.length) {
    const x = DEMOS[k];
    const ctx = { $b, s: makeBoard(x.Y, x.L), burnt: 0, speed: 1, quiet: true };
    paint(ctx);
    $('#demo-cap', d).textContent = x.caption;
    if (TEST) return;
    const $h = $b.querySelector(`[data-slot="${x.house}"]`);
    $h.classList.add('sel');
    await wait(1300);
    if (me !== run || !d.open) return;
    $h.classList.remove('sel');
    await animate(ctx, sowEvents(ctx.s, 0, x.house).events);
    await wait(2000);
  }
}

function showStats() {
  const st = stats(data.records, today());
  const max = Math.max(1, ...Object.values(st.dist));
  const bar = (label, n) => `<div class="bar"><span>${label}</span><i style="--w:${(100 * n) / max}%"></i><b>${n}</b></div>`;
  dialog(`<h2>Stats</h2>
  <div class="nums"><div><b>${st.played}</b>played</div><div><b>${st.played ? Math.round((100 * st.wins) / st.played) : 0}%</b>par</div><div><b>${st.streak}</b>streak</div><div><b>${st.maxStreak}</b>best</div></div>
  <h3>Par sa ika-ilang tira</h3>
  ${bar('1', st.dist[1])}${bar('2', st.dist[2])}${bar('3', st.dist[3])}${bar('✕', st.dist.miss)}
  <p class="fine">Only the daily puzzle counts. Archive days are practice.</p>`);
}

function archive() {
  const t = today();
  const items = [];
  for (let iso = t, k = 0; iso >= EPOCH && k < 60; iso = addDays(iso, -1), k++) {
    const r = data.records[iso];
    const m = r ? r.tries.map((s) => tryMark(s, r.par)).join('') : '';
    items.push(`<button type="button" class="day${iso === t ? ' today' : ''}" data-act="play-day" data-iso="${iso}"><b>#${puzzleNumber(iso)}</b><span>${DAYS[weekday(iso)]} ${iso.slice(5)}</span>${m ? `<small class="mks">${m}</small>` : `<small>${iso === t ? 'Ngayon' : '·'}</small>`}</button>`);
  }
  dialog(`<h2>Mga nakaraang laro</h2><p class="fine">Play any past day for practice. The newest is at the top.</p><div class="days">${items.join('')}</div>`, 'wide');
}


// ---------- the game against Lola ----------
const MKEY = 'isangtira.match.v1';
const LEVEL_NAME = { madali: 'Madali', katamtaman: 'Katamtaman', mahirap: 'Mahirap' };
const LEVEL_NOTE = {
  madali: 'Madali: relaks lang si Lola, at minsan nagkakamali.',
  katamtaman: 'Katamtaman: bumibilang si Lola ng dalawang tira pauna.',
  mahirap: 'Mahirap: iniisip din ni Lola ang isasagot mo.',
};
const ROUNDS = [1, 3, null];
const roundsName = (r) => (r ? `${r} round` : 'Hanggang maubos');
const SPEEDS = [1, 2, 3];
const mstore = {
  get() { if (TEST) return null; try { return JSON.parse(localStorage.getItem(MKEY)); } catch { return null; } },
  set(v) { if (TEST) return; try { localStorage.setItem(MKEY, JSON.stringify(v)); } catch { /* storage unavailable: keep playing */ } },
};
const prefs = (() => {
  const p = mstore.get() || {};
  return {
    mode: p.mode === 'daily' ? 'daily' : 'match',
    level: LEVELS.includes(p.level) ? p.level : 'madali',
    rounds: ROUNDS.includes(p.rounds) ? p.rounds : 3,
    speed: SPEEDS.includes(p.speed) ? p.speed : 2,
    record: p.record && typeof p.record === 'object' ? p.record : {},
    seenRules: !!p.seenRules,
    saved: p.saved || null,
  };
})();
const savePrefs = () => mstore.set(prefs);

const LOLA_M = {
  hello: ['Tara, apo, maglaro tayo ng sungka! Ikaw ang mauna.', 'Upo ka, apo. Sige, ikaw muna.', 'O, apo, sungka tayo? Pagbibigyan kita... ngayon lang!'],
  yourTurn: ['Ikaw na, apo.', 'Sige, ikaw naman.', 'O, ikaw na.'],
  youExtra: ['Isa pa! Sige, apo.', 'Ayan! Isa pang tira.', 'Tama ang bilang mo, apo.'],
  youCapture: ['Aba! Kinuha mo ang mga sigay ko!', 'Hmp, galing mo, apo.', 'Aray ko! Ang dami mong nakuha.'],
  think: ['Hmm...', 'Teka, bibilangin ko...', 'Saan kaya...', 'Ito kaya?'],
  herExtra: ['Isa pa si Lola!', 'Hehe, isa pa ako.', 'Sakto! Isa pa.'],
  herCapture: ["Akin na 'yan, apo!", 'Salamat sa sigay, apo!', 'Hehe, huli ka!'],
  roundWon: ["Ang galing mo, apo! Panalo ka sa round na 'to."],
  roundLost: ["Hehe, akin ang round na 'to. Bawi ka!"],
  roundTie: ['Tabla! Parehas tayo.'],
  won: ["Panalo ka, apo! Proud si Lola sa 'yo.", 'Ikaw na ang bagong kampeon ng sungka!'],
  lost: ['Panalo si Lola! Pero ang galing mo rin, apo. Isa pa?', 'Hindi bale, apo. Isa pa tayo?'],
  tie: ['Tabla! Ang galing natin pareho.'],
};
const sayM = (k) => LOLA_M[k][Math.floor(Math.random() * LOLA_M[k].length)];

let match = null, mui = null, mrun = 0;
const packMatch = (m) => ({ ...m, s: Array.from(m.s) });
function unpackMatch(p) {
  if (!p || !Array.isArray(p.s) || p.s.length !== 16 || !LEVELS.includes(p.level) || !['you', 'lola'].includes(p.turn) || !['play', 'roundOver'].includes(p.phase)) return null;
  return { ...p, s: Uint8Array.from(p.s), rounds: Array.isArray(p.rounds) ? p.rounds : [] };
}
const saveMatch = () => { prefs.saved = match && match.phase !== 'over' ? packMatch(match) : null; savePrefs(); };
const freshMatch = () => Object.assign(newMatch({ rounds: prefs.rounds }), { level: prefs.level });
const modeTabs = (now) => `<nav class="modes-tab" aria-label="Laro"><button type="button" data-act="mode-match" aria-pressed="${now === 'match'}">🐚 Laban kay Lola</button><button type="button" data-act="mode-daily" aria-pressed="${now === 'daily'}">📅 Isang Tira ng Araw</button></nav>`;
const yourMove = () => !!mui && !mui.busy && match.phase === 'play' && match.turn === 'you';

function openMatch(fresh = false) {
  run++; mrun++;
  prefs.mode = 'match';
  puzzle = null; ui = null;
  if (fresh || !match) match = (!fresh && unpackMatch(prefs.saved)) || freshMatch();
  saveMatch();
  mui = { s: Uint8Array.from(match.s), burnt: match.burnt, busy: false, selected: null, $b: null, lola: false, match: true, base: prefs.speed };
  renderMatch();
  if (match.phase === 'roundOver') { roundOver(); return; }
  if (match.turn === 'lola') { lolaTurn(); return; }
  lolaSays(match.round === 1 && !match.rounds.length && match.s[ULO] === 0 ? sayM('hello') : sayM('yourTurn'));
  if (!prefs.seenRules && !TEST) matchHelp();
}

function renderMatch() {
  const m = match;
  $app.innerHTML = `${modeTabs('match')}
  <header class="top">
    <div><div class="kicker">Laban kay Lola Iska · ${esc(LEVEL_NAME[m.level])} · Round ${m.round}${m.limit ? ` of ${m.limit}` : ''}</div><h1>Sungka</h1></div>
    <div class="score" role="img" id="score"></div>
  </header>
  <nav class="tools" aria-label="Menu">
    <button type="button" class="small" data-act="m-help">Paano laruin</button>
    <button type="button" class="small" data-act="m-new">Bagong laro</button>
    <button type="button" class="small" data-act="speed" aria-label="Animation speed">Bilis ${prefs.speed}×</button>
    <button type="button" class="small" data-act="mute" aria-label="Sound">${data.muted ? '🔇' : '🔊'}</button>
  </nav>
  <div class="lola"><div class="lola-face" aria-hidden="true">👵</div><p class="lola-bubble"><span id="lola-line"></span></p></div>
  <p class="turn" id="turn" aria-live="polite"></p>
  ${boardHtml('b', true)}
  <p class="caption" id="caption"></p>
  <div class="panel" id="panel"></div>
  <p class="hint">Tap one of your houses (the bottom row) to see where its first handful lands, then tap again to sow. Tap during a sowing to speed it up. Keys 1–7 pick Y0–Y6.</p>`;
  mui.$b = $('#b');
  refreshMatch();
}

function refreshMatch() {
  if (!mui || !mui.$b) return;
  const mine = yourMove() ? legalFor(match, 'you') : [];
  paint(mui, mine);
  mui.$b.querySelectorAll('.h.mine').forEach(($h) => $h.classList.toggle('sel', Number($h.dataset.slot) === mui.selected));
  const playing = match.phase === 'play';
  mui.$b.classList.toggle('lola-turn', playing && match.turn === 'lola');
  mui.$b.classList.toggle('your-turn', playing && match.turn === 'you');
  $('#turn').textContent = !playing ? '' : match.turn === 'lola' ? 'Si Lola ang tumitira...' : mui.busy ? 'Sinasabog mo ang sigay...' : 'Ikaw na: pumili ng bahay sa ibaba.';
  if (playing && match.turn === 'you') $('#panel').innerHTML = `<button type="button" class="primary" data-act="m-sow"${mui.selected === null || mui.busy ? ' disabled' : ''}>${mui.selected === null ? 'Pumili ng bahay' : `Sow ${slotName(mui.selected)}`}</button>`;
  else if (playing) $('#panel').innerHTML = '';
}

function matchSelect(h) {
  if (!yourMove()) return undefined;
  if (!legalFor(match, 'you').includes(h)) { caption(isBurnt(match.burnt, h) ? `${slotName(h)} is sunog this round.` : `${slotName(h)} is empty.`); return undefined; }
  sound.ensure();
  if (mui.selected === h) return matchSow(h);
  mui.selected = h;
  const f = firstHandful(mui.s, mui.burnt, h);
  showRings(mui, [f.lands], false);
  caption(`${slotName(h)} (${mui.s[h]}): ${firstHandfulText(f)}`);
  announce($('#caption').textContent);
  refreshMatch();
  return undefined;
}

async function matchSow(h) {
  const me = mrun;
  mui.busy = true; clearRings(mui); mui.selected = null; caption(''); refreshMatch();
  const r = playSowing(match, h);
  saveMatch();
  if (!(await animate(mui, r.events)) || me !== mrun) return;
  mui.s = Uint8Array.from(match.s);
  mui.busy = false;
  if (r.result.outcome === 'capture') lolaSays(sayM('youCapture'));
  if (r.roundOver) { roundOver(); return; }
  if (r.again) { if (r.result.outcome !== 'capture') lolaSays(sayM('youExtra')); caption('Isa pa! Pumili ulit.'); refreshMatch(); mui.$b.querySelector(`[data-slot="${legalFor(match, 'you')[0]}"]`)?.focus({ preventScroll: true }); return; }
  refreshMatch();
  await lolaTurn();
}

// Lola's turn: she looks, points, and sows, again and again while she earns extra turns.
async function lolaTurn() {
  const me = mrun;
  let took = false;
  while (me === mrun && match.phase === 'play' && match.turn === 'lola') {
    mui.busy = true; refreshMatch();
    lolaSays(sayM('think'));
    await wait(reduced() ? 0 : 350 + 700 / prefs.speed);
    if (me !== mrun) return;
    const h = lolaMove(match, match.level);
    const $h = mui.$b.querySelector(`[data-slot="${h + 8}"]`);
    $h.classList.add('sel');
    caption(`Si Lola: ${slotName(h + 8)} (${mui.s[h + 8]})`);
    await wait(reduced() ? 0 : 600 / prefs.speed);
    $h.classList.remove('sel');
    if (me !== mrun) return;
    const r = playSowing(match, h);
    saveMatch();
    mui.lola = true;
    const ok = await animate(mui, r.events);
    mui.lola = false;
    if (!ok || me !== mrun) return;
    mui.s = Uint8Array.from(match.s);
    took = r.result.outcome === 'capture';
    if (took) lolaSays(sayM('herCapture'));
    if (r.roundOver) { mui.busy = false; roundOver(); return; }
    if (r.again) { if (!took) lolaSays(sayM('herExtra')); await wait(reduced() ? 0 : 450 / prefs.speed); }
  }
  if (me !== mrun) return;
  mui.busy = false;
  caption('');
  if (!took) lolaSays(sayM('yourTurn'));
  refreshMatch();
  mui.$b.querySelector(`[data-slot="${legalFor(match, 'you')[0]}"]`)?.focus({ preventScroll: true });
}

function roundOver() {
  refreshMatch();
  caption('');
  if (match.phase === 'over') { matchOver(); return; }
  const last = match.rounds[match.rounds.length - 1];
  lolaSays(last.winner === 'you' ? sayM('roundWon') : last.winner === 'lola' ? sayM('roundLost') : sayM('roundTie'));
  const n = nextRound(match);
  const burnt = (base) => [0, 1, 2, 3, 4, 5, 6].filter((h) => isBurnt(n.burnt, base + h)).length;
  const yb = burnt(0), lb = burnt(8);
  const note = `Sa susunod na round: ${yb ? `${yb} bahay mo ang sunog` : 'puno lahat ng bahay mo'}, at ${lb ? `${lb} kay Lola ang sunog` : 'puno lahat kay Lola'}. ${n.turn === 'you' ? 'Ikaw ang mauuna.' : 'Si Lola ang mauuna.'}`;
  $('#turn').textContent = '';
  $('#panel').innerHTML = `<div class="done">
    <p class="result ${last.winner === 'you' ? 'yes' : 'no'}">Round ${last.round}: ikaw <b>${last.you}</b> · Lola <b>${last.lola}</b></p>
    <p class="fine">${esc(note)}</p>
    <div class="btns"><button type="button" class="primary" data-act="m-next">Susunod na round ▶</button><button type="button" data-act="m-new">Bagong laro</button></div>
  </div>`;
  $('#panel [data-act="m-next"]').focus({ preventScroll: true });
}

function matchOver() {
  const w = match.winner;
  const rec = prefs.record[match.level] || { w: 0, l: 0, d: 0 };
  if (!match.recorded) { rec[w === 'you' ? 'w' : w === 'lola' ? 'l' : 'd']++; prefs.record[match.level] = rec; match.recorded = true; }
  saveMatch();
  if (w === 'you') { sound.par(); celebrate(mui); }
  lolaSays(w === 'you' ? sayM('won') : w === 'lola' ? sayM('lost') : sayM('tie'));
  const rows = match.rounds.map((r) => `<li>Round ${r.round}: ikaw ${r.you} · Lola ${r.lola}</li>`).join('');
  const how = match.limit ? '' : '<p class="fine">Hindi na makapuno ng kahit isang bahay ang natalo.</p>';
  $('#turn').textContent = '';
  $('#panel').innerHTML = `<div class="done">
    <p class="result ${w === 'you' ? 'yes' : 'no'}"><b>${w === 'you' ? 'Panalo ka!' : w === 'lola' ? 'Panalo si Lola!' : 'Tabla!'}</b></p>
    <ul class="rounds">${rows}</ul>${how}
    <p class="streak">Laban kay Lola (${esc(LEVEL_NAME[match.level])}): <b>${rec.w}</b> panalo · ${rec.l} talo${rec.d ? ` · ${rec.d} tabla` : ''}</p>
    <div class="btns"><button type="button" class="primary" data-act="m-again">Isa pa! · Play again</button><button type="button" data-act="m-new">Palitan ang antas</button></div>
  </div>`;
  $('#panel [data-act="m-again"]').focus({ preventScroll: true });
}

function nextOne() {
  if (!match || match.phase !== 'roundOver') return;
  match = nextRound(match);
  saveMatch();
  openMatch();
}

function newGameDialog() {
  const d = dialog(`<h2>Bagong laro</h2>
    <h3>Antas ni Lola</h3><div class="btns choose">${LEVELS.map((l) => `<button type="button" data-act="pick-level" data-v="${l}" aria-pressed="${l === prefs.level}">${LEVEL_NAME[l]}</button>`).join('')}</div>
    <p class="fine" id="level-note">${esc(LEVEL_NOTE[prefs.level])}</p>
    <h3>Haba ng laro</h3><div class="btns choose">${ROUNDS.map((r) => `<button type="button" data-act="pick-rounds" data-v="${r ?? 0}" aria-pressed="${r === prefs.rounds}">${roundsName(r)}</button>`).join('')}</div>
    <p class="fine">Hanggang maubos is the traditional game: round after round, until someone cannot fill a single house.</p>
    ${Object.keys(prefs.record).length ? `<p class="fine">${LEVELS.filter((l) => prefs.record[l]).map((l) => `${LEVEL_NAME[l]}: ${prefs.record[l].w} panalo, ${prefs.record[l].l} talo`).join(' · ')}</p>` : ''}`);
  d.lastElementChild.innerHTML = '<button type="button" class="primary" data-act="m-start">Simulan · Start</button><button type="button" data-act="close">Hindi muna</button>';
}

function matchHelp() {
  prefs.seenRules = true; savePrefs();
  const d = dialog(`<h2>Paano laruin ang Sungka</h2>
  <p>You and Lola take turns. Each of you has seven houses and an ulo; every house starts with 7 sigay. Bank more in your ulo than Lola.</p>
  <ol class="rules">
    <li>Pick a house in <b>your row</b> (bottom). Its shells go one per slot: along your row, into <b>your ulo</b>, then along Lola's row. Her ulo is skipped. Lola sows the same way from her side.</li>
    <li>Last shell in <b>your ulo</b>: <b>isa pa!</b> Choose again.</li>
    <li>Last shell in a house that <b>has shells</b>: scoop them all up and keep sowing.</li>
    <li>Last shell in <b>your own empty house</b>: capture Lola's house opposite, plus that shell. Nothing opposite? Your turn just ends.</li>
    <li>Last shell in an <b>empty house of Lola's</b>: your turn ends, and it's hers.</li>
    <li>When a side has no shells left, the other player keeps what is on theirs and the <b>round ends</b>. More in your ulo wins the round.</li>
    <li>Next round, each fills their houses with 7 from their ulo. Houses you cannot fill are <b>sunog</b> (burnt) and skipped for the round.</li>
  </ol>
  <figure class="demo"><div aria-hidden="true">${boardHtml('demo')}</div><figcaption id="demo-cap"></figcaption></figure>
  <p class="fine">Tapping a house shows where its first handful lands. If it lands on shells, the sowing keeps going: counting ahead is the skill.</p>`, 'wide');
  runDemo(d);
}

// ---------- input ----------
document.addEventListener('click', (ev) => {
  const t = ev.target.closest('button');
  if (!t) return;
  if (t.matches('#b .h.mine')) { if (mui && !ui) matchSelect(Number(t.dataset.slot)); else select(Number(t.dataset.slot)); return; }
  switch (t.dataset.act) {
    case 'sow': if (ui.selected !== null) select(ui.selected); break;
    case 'again': again(); break;
    case 'whisper': rec = useWhisper(rec); data.records[puzzle.iso] = rec; save(); lolaSays(say('whisper')); $('#mode').textContent = 'Bulong ni Lola: buong sowing'; $('#mode').classList.add('ws'); t.remove(); break;
    case 'share': share(); break;
    case 'replay': replay(); break;
    case 'help': help(); break;
    case 'stats': showStats(); break;
    case 'archive': archive(); break;
    case 'mute': data.muted = !data.muted; save(); t.textContent = data.muted ? '🔇' : '🔊'; break;
    case 'close': run++; $('#dlg').close(); break;
    case 'play-day': $('#dlg').close(); open(t.dataset.iso); break;
    case 'mode-match': if (!mui) openMatch(); break;
    case 'mode-daily': if (!ui) open(today()); break;
    case 'm-sow': if (mui && mui.selected !== null) matchSelect(mui.selected); break;
    case 'm-help': matchHelp(); break;
    case 'm-new': newGameDialog(); break;
    case 'm-again': match = freshMatch(); openMatch(); break;
    case 'm-next': nextOne(); break;
    case 'm-start': run++; $('#dlg').close(); match = freshMatch(); openMatch(); break;
    case 'pick-level': prefs.level = t.dataset.v; savePrefs(); t.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === t))); $('#level-note').textContent = LEVEL_NOTE[prefs.level]; break;
    case 'pick-rounds': prefs.rounds = Number(t.dataset.v) || null; savePrefs(); t.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === t))); break;
    case 'speed': prefs.speed = SPEEDS[(SPEEDS.indexOf(prefs.speed) + 1) % SPEEDS.length]; savePrefs(); if (mui) mui.base = prefs.speed; t.textContent = `Bilis ${prefs.speed}×`; break;
    default: break;
  }
});
document.addEventListener('pointerdown', () => { if (active) active.speed = 4; });
document.addEventListener('keydown', (ev) => {
  if (ev.repeat && /^([1-7]|Enter| )$/.test(ev.key)) { ev.preventDefault(); return; }
  if (active && (ev.key === ' ' || ev.key === 'Enter')) active.speed = 4;
  if (ev.ctrlKey || ev.metaKey || ev.altKey || $('#dlg').open) return;
  if (/^[1-7]$/.test(ev.key) && ui && !ui.busy && !rec.done) { ev.preventDefault(); const h = Number(ev.key) - 1; ui.$b.querySelector(`[data-slot="${h}"]`).focus({ preventScroll: true }); select(h); }
  else if (/^[1-7]$/.test(ev.key) && !ui && yourMove()) { ev.preventDefault(); const h = Number(ev.key) - 1; mui.$b.querySelector(`[data-slot="${h}"]`).focus({ preventScroll: true }); matchSelect(h); }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden && puzzle && ui && rec.daily && puzzle.iso !== today() && !ui.busy) open(today()); });

if (TEST ? Q.get('mode') === 'daily' : prefs.mode === 'daily') open(today()); else openMatch();
if ('serviceWorker' in navigator && !TEST) navigator.serviceWorker.register('sw.js').catch(() => { /* online-only then */ });

if (TEST) {
  // play a line of moves (house numbers), awaiting each sowing
  window.__it = {
    get puzzle() { return puzzle; }, get rec() { return rec; }, get ui() { return ui; },
    async play(moves) { for (const h of moves) { select(h); await select(h); } },
    again, replay, open,
    get match() { return match; }, get mui() { return mui; }, openMatch,
    async sow(h) { matchSelect(h); await matchSow(h); },
  };
  if (Q.get('level')) prefs.level = Q.get('level');
}
