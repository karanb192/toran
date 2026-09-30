import { distToSegment } from './physics.js';
import { VARIANTS, layout, buildToran, drawToran, drawBackground, drawNight } from './toran.js';
import { Bells } from './bell.js';
import { CITIES, GENTLE, cityForTimeZone, createWindSource, windForce, windLabel, gust } from './wind.js';
import { canRecord, recordClip } from './record.js';
import { loadDoors, ADD_URL } from './doors.js';

const $ = (id) => document.getElementById(id);
const canvas = $('scene');
const g = canvas.getContext('2d');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
if (params.has('og')) document.documentElement.classList.add('og');

const STEP = 1 / 120;
const CLIP_MS = 5000;
const S = {
  W: 0, H: 0, dpr: 1, door: null, T: null, bg: null,
  variant: 'genda', night: false, t: 0, acc: 0, last: 0,
  wind: GENTLE, live: false, force: windForce(GENTLE.speed, GENTLE.dir), place: '', windText: windLabel('', null), recording: false,
};
const bells = new Bells();
const ptr = { id: null, x: 0, y: 0, px: 0, py: 0, seen: false, dirty: false, speed: 0, grab: null, down: false, moved: 0, downT: 0, type: 'mouse' };
const play = { last: 0, start: 0, lock: 0 };
let doors = [];
let lastTouch = 0;

function variantFromHash() {
  const h = location.hash.slice(1);
  return VARIANTS[h] ? h : 'genda';
}

function resize() {
  S.dpr = Math.min(2, window.devicePixelRatio || 1);
  S.W = window.innerWidth;
  S.H = window.innerHeight;
  canvas.width = Math.round(S.W * S.dpr);
  canvas.height = Math.round(S.H * S.dpr);
  S.door = layout(S.W, S.H);
  const cap = $('caption');
  cap.style.left = S.door.x + 'px';
  cap.style.width = S.door.w + 'px';
  cap.style.top = S.door.y + S.door.h * 0.62 + 'px';
  rebuild();
}

function rebuild() {
  S.T = buildToran(S.variant, S.door, S.dpr);
  S.bg = drawBackground(S.W, S.H, S.door, S.variant, S.night, S.dpr);
  hangDoors();
  for (let i = 0; i < 240; i++) step(STEP);
}

function hangDoors() {
  const slots = S.T.leaves.length ? S.T.leaves : S.T.strands;
  slots.forEach((s) => (s.door = null));
  const order = slots.map((_, i) => i).sort((a, b) => ((a * 7919) % 31) - ((b * 7919) % 31));
  doors.forEach((d, i) => {
    if (i < order.length) slots[order[i]].door = d;
  });
}

const WF = { x: 0, y: 0 };
function step(dt) {
  S.t += dt;
  const scale = reduced ? 0.35 : 1;
  // Ease toward the target wind so a new reading never jolts the garland.
  const target = windForce(S.wind.speed, S.wind.dir);
  const k = 1 - Math.exp(-dt / 1.2);
  S.force.steady += (target.steady - S.force.steady) * k;
  S.force.gust += (target.gust - S.force.gust) * k;
  const steady = S.force.steady * scale;
  const amp = S.force.gust * scale;
  const t = S.t;
  S.T.world.step(dt, (p) => {
    WF.x = (steady + amp * gust(t, p.s)) * p.w;
    return WF;
  });
}

function brush(dt) {
  if (!ptr.dirty) {
    ptr.speed = 0;
    return;
  }
  ptr.dirty = false;
  const R = ptr.type === 'touch' ? 58 : 46;
  const dx = Math.max(-70, Math.min(70, ptr.x - ptr.px));
  const dy = Math.max(-70, Math.min(70, ptr.y - ptr.py));
  ptr.speed = Math.hypot(dx, dy) / Math.max(dt, 1 / 240);
  for (const p of S.T.world.points) {
    if (p.pinned || p === ptr.grab) continue;
    const d = distToSegment(p.x, p.y, ptr.px, ptr.py, ptr.x, ptr.y);
    if (d > R) continue;
    const f = (1 - d / R) ** 2;
    // Shift x and px together so the brush drags beads without flinging them; only the small kick becomes velocity.
    p.x += dx * f * 0.5;
    p.px += dx * f * 0.42;
    p.y += dy * f * 0.28;
    p.py += dy * f * 0.24;
    p.touched = Math.max(p.touched, f);
  }
  ptr.px = ptr.x;
  ptr.py = ptr.y;
}

function listen(now) {
  for (const b of S.T.bells) {
    const p = b.p;
    const v = Math.hypot(p.x - p.px, p.y - p.py) / STEP;
    const jolt = v - b.v;
    b.v += (v - b.v) * 0.25;
    b.flash *= 0.9;
    const touched = p.touched;
    p.touched = 0;
    if (now < b.cool) continue;
    let hit = 0;
    if (touched > 0.12 && ptr.speed > 60) hit = Math.min(1, 0.25 + ptr.speed / 1500);
    else if (jolt > 140) hit = Math.min(0.8, jolt / 900);
    if (!hit) continue;
    b.cool = now + 130;
    ring(b, hit, touched > 0.12);
  }
}

function ring(b, hit, byPlayer) {
  b.flash = 1;
  bells.ring(b.freq, hit);
  if (byPlayer) streak(performance.now());
}

// The secret: keep the bells ringing for six seconds without a pause and it turns to Diwali night.
function streak(now) {
  if (now - play.last > 1200) play.start = now;
  play.last = now;
  if (now > play.lock && now - play.start > 6000) {
    play.lock = now + 4000;
    play.start = now;
    setNight(!S.night);
  }
}

function setNight(on) {
  S.night = on;
  document.documentElement.classList.toggle('night', on);
  bells.setNight(on);
  S.bg = drawBackground(S.W, S.H, S.door, S.variant, S.night, S.dpr);
  say(on ? 'Diwali night.' : 'Morning again.');
}

function windRings(dt) {
  const over = S.wind.speed - 12;
  if (over <= 0 || reduced || Math.random() > (dt * over) / 40) return;
  const b = S.T.bells[Math.floor(Math.random() * S.T.bells.length)];
  b.p.x += (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 2);
}

function nearest(x, y, radius, list) {
  let best = null;
  let bd = radius;
  for (const item of list) {
    const d = Math.hypot(item.x - x, item.y - y);
    if (d < bd) {
      bd = d;
      best = item;
    }
  }
  return best;
}

function frame(ts) {
  const now = ts / 1000;
  const dt = Math.min(0.05, now - (S.last || now));
  S.last = now;
  if (ptr.grab) {
    ptr.grab.px = ptr.grab.x;
    ptr.grab.py = ptr.grab.y;
    ptr.grab.x = ptr.x;
    ptr.grab.y = ptr.y;
  }
  brush(dt);
  windRings(dt);
  S.acc += dt;
  let n = 0;
  while (S.acc >= STEP && n < 10) {
    step(STEP);
    S.acc -= STEP;
    n++;
  }
  listen(ts);
  draw();
  requestAnimationFrame(frame);
}

function draw() {
  g.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
  g.drawImage(S.bg, 0, 0, S.W, S.H);
  drawToran(g, S.T, S.t);
  if (S.night) drawNight(g, S.W, S.H, S.door, S.t);
  if (S.recording) {
    g.font = '600 15px "Iowan Old Style", Georgia, serif';
    g.fillStyle = S.night ? 'rgba(255,240,215,0.85)' : 'rgba(43,29,18,0.8)';
    g.textAlign = 'left';
    g.fillText('Toran', 16, 30);
    g.font = '13px "Iowan Old Style", Georgia, serif';
    g.fillText(S.windText, 16, 50);
    g.textAlign = 'right';
    g.fillText('toran.karanbansal.in', S.W - 16, S.H - 16);
  }
}

function setPtr(e) {
  const r = canvas.getBoundingClientRect();
  ptr.x = e.clientX - r.left;
  ptr.y = e.clientY - r.top;
}

canvas.addEventListener('pointerdown', (e) => {
  if (ptr.id !== null) return;
  canvas.setPointerCapture(e.pointerId);
  ptr.id = e.pointerId;
  ptr.type = e.pointerType;
  setPtr(e);
  ptr.px = ptr.x;
  ptr.py = ptr.y;
  ptr.down = true;
  ptr.moved = 0;
  ptr.downT = performance.now();
  touched();
  const reach = ptr.type === 'touch' ? 30 : 22;
  const bell = nearest(ptr.x, ptr.y, reach, S.T.bells.map((b) => ({ x: b.p.x, y: b.p.y, b })));
  if (bell) ring(bell.b, 0.7, true);
  const hit = nearest(ptr.x, ptr.y, reach, S.T.world.points.filter((p) => !p.pinned));
  if (hit) {
    ptr.grab = hit;
    hit.grabbed = true;
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (ptr.id !== null && e.pointerId !== ptr.id) return;
  const ox = ptr.x;
  const oy = ptr.y;
  if (e.pointerType === 'touch' && !ptr.down) return;
  setPtr(e);
  if (!ptr.seen) {
    ptr.px = ptr.x;
    ptr.py = ptr.y;
    ptr.seen = true;
  }
  ptr.moved += Math.hypot(ptr.x - ox, ptr.y - oy);
  ptr.dirty = true;
  touched();
});

function release(e) {
  if (e.pointerId !== ptr.id) return;
  if (ptr.grab) {
    const q = ptr.grab;
    q.px = q.x - (q.x - q.px) * 0.15;
    q.py = q.y - (q.y - q.py) * 0.15;
    q.grabbed = false;
  }
  ptr.grab = null;
  if (e.type === 'pointerup' && ptr.down && ptr.moved < 6 && performance.now() - ptr.downT < 350) tap(ptr.x, ptr.y);
  ptr.id = null;
  ptr.down = false;
  ptr.dirty = false;
  ptr.seen = false;
}
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('lostpointercapture', release);
canvas.addEventListener('pointerleave', () => (ptr.seen = false));

function tap(x, y) {
  let slot;
  if (S.T.leaves.length) {
    slot = nearest(x, y, 34, S.T.leaves.map((l) => ({ x: (l.pin.x + l.tip.x) / 2, y: (l.pin.y + l.tip.y) / 2, l })));
    slot = slot && slot.l;
  } else {
    const p = nearest(x, y, 30, S.T.strands.flatMap((s) => s.pts.slice(1).map((q) => ({ x: q.x, y: q.y, s }))));
    slot = p && p.s;
  }
  if (!slot) return;
  if (slot.door) showDoor(slot.door);
  else say('Nobody has hung a door here yet. ', 'Add yours', ADD_URL);
}

let captionTimer;
function say(text, linkText, href) {
  const cap = $('caption');
  clearTimeout(captionTimer);
  cap.hidden = false;
  cap.textContent = text;
  if (linkText) {
    const a = document.createElement('a');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = linkText;
    cap.append(a);
  }
  cap.classList.remove('fade');
  void cap.offsetWidth;
  cap.classList.add('fade');
  if (reduced) captionTimer = setTimeout(() => (cap.hidden = true), 7000);
}

function showDoor(d) {
  say(`A door in ${d.place}. ${d.line}`);
}

function touched() {
  lastTouch = performance.now();
}

function setVariant(v) {
  S.variant = v;
  const info = VARIANTS[v];
  $('script').textContent = info.script;
  $('script').lang = info.lang;
  document.querySelectorAll('.variants a').forEach((a) => {
    if (a.hash === '#' + v) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
  });
  rebuild();
}

window.addEventListener('hashchange', () => {
  setVariant(variantFromHash());
  say(VARIANTS[S.variant].blurb);
});

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(resize, 120);
});

document.addEventListener('visibilitychange', () => (document.hidden ? bells.pause() : bells.resume()));

const soundBtn = $('sound');
let soundWanted = false;
let soundVersion = 0;
try {
  const savedSound = localStorage.getItem('toran:sound');
  soundWanted = savedSound === 'on';
  if (savedSound === null && !reduced && !params.has('og') && localStorage.getItem('toran:sound-hint') !== 'seen') {
    // Save before animating so denied storage cannot cause a hint on every visit.
    localStorage.setItem('toran:sound-hint', 'seen');
    soundBtn.classList.add('sound-hint');
    soundBtn.addEventListener('animationend', () => soundBtn.classList.remove('sound-hint'), { once: true });
  }
} catch {}
soundBtn.setAttribute('aria-pressed', String(soundWanted));

async function startSound(preview = false) {
  const version = soundVersion;
  try {
    await bells.enable();
    // A pending browser resume must not undo a later mute.
    if (!soundWanted) {
      bells.disable();
      return;
    }
    if (version !== soundVersion) return;
    if (preview) {
      const mid = S.T.bells[Math.floor(S.T.bells.length / 2)];
      if (mid) ring(mid, 0.5, false);
    }
  } catch {
    if (version !== soundVersion) return;
    bells.disable();
    soundWanted = false;
    soundBtn.setAttribute('aria-pressed', 'false');
    say('Sound could not start. Tap the speaker to try again.');
  }
}

soundBtn.addEventListener('click', () => {
  soundBtn.classList.remove('sound-hint');
  soundWanted = !soundWanted;
  soundVersion++;
  soundBtn.setAttribute('aria-pressed', String(soundWanted));
  try {
    localStorage.setItem('toran:sound', soundWanted ? 'on' : 'off');
  } catch {}
  if (!soundWanted) {
    bells.disable();
    return;
  }
  startSound(true);
});

function resumeSavedSound(event) {
  if (!event.isTrusted || soundBtn.contains(event.target) || !soundWanted) return;
  if (!bells.on || bells.ctx?.state !== 'running') startSound();
}
// Touch may grant audio permission on release rather than on pointerdown.
for (const type of ['pointerdown', 'pointerup', 'click', 'keydown']) {
  document.addEventListener(type, resumeSavedSound, { capture: true });
}

const citySel = $('city');
for (const c of CITIES) citySel.add(new Option(c.name, c.id));
citySel.add(new Option('My location', 'here'));

const windSource = createWindSource();
let selectedCity = null;
let liveWindCity = null;
let windSelection = 0;
let windRequest = 0;

// A refresh that fails keeps the wind already showing. A new place that fails falls back to a
// gentle breeze with no place named, so the page never reports an outage.
async function loadWind(city, refresh = false) {
  const request = ++windRequest;
  const w = await windSource(city.lat, city.lon);
  if (request !== windRequest || city !== selectedCity) return;
  if (w) {
    S.wind = w;
    S.live = true;
    liveWindCity = city;
    S.windText = windLabel(city.name, w);
  } else if (!(refresh && S.live && liveWindCity === city)) {
    S.wind = GENTLE;
    S.live = false;
    liveWindCity = null;
    S.windText = windLabel(city.name, null);
  }
  $('windText').textContent = S.windText;
}

citySel.addEventListener('change', () => {
  const selection = ++windSelection;
  windRequest++;
  selectedCity = null;
  if (citySel.value !== 'here') {
    selectedCity = CITIES.find((c) => c.id === citySel.value);
    loadWind(selectedCity);
    return;
  }
  if (!navigator.geolocation) return;
  $('windText').textContent = 'Finding your wind';
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      if (selection !== windSelection) return;
      selectedCity = { name: 'your area', lat: pos.coords.latitude, lon: pos.coords.longitude };
      loadWind(selectedCity);
    },
    () => {
      if (selection !== windSelection) return;
      $('windText').textContent = 'Location blocked. Pick a city instead.';
    },
    { timeout: 10000, maximumAge: 600000 },
  );
});

const clipBtn = $('clip');
if (!canRecord(canvas)) clipBtn.hidden = true;
clipBtn.addEventListener('click', async () => {
  if (S.recording) return;
  S.recording = true;
  clipBtn.disabled = true;
  let left = CLIP_MS / 1000;
  clipBtn.textContent = 'Recording ' + left;
  const tick = setInterval(() => (clipBtn.textContent = 'Recording ' + --left), 1000);
  say(bells.on ? 'Recording. Play the bells.' : 'Recording without sound. Tap the speaker first for bells.');
  try {
    const blob = await recordClip(canvas, bells.on ? bells.stream() : null, CLIP_MS);
    showClip(blob);
  } catch {
    say('This browser could not record a clip.');
  } finally {
    clearInterval(tick);
    S.recording = false;
    clipBtn.disabled = false;
    clipBtn.textContent = 'Clip';
  }
});

function showClip(blob) {
  const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
  const url = URL.createObjectURL(blob);
  const sheet = $('clipSheet');
  $('clipVideo').src = url;
  const save = $('clipSave');
  save.href = url;
  save.download = 'toran.' + ext;
  const file = new File([blob], 'toran.' + ext, { type: blob.type });
  const share = $('clipShare');
  share.hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
  share.onclick = () => navigator.share({ files: [file], title: 'Toran', text: 'toran.karanbansal.in' }).catch(() => {});
  sheet.showModal();
}
$('clipClose').addEventListener('click', () => $('clipSheet').close());
$('aboutBtn').addEventListener('click', () => $('about').showModal());
$('aboutClose').addEventListener('click', () => $('about').close());

setInterval(() => {
  if (!doors.length || performance.now() - lastTouch < 6000) return;
  showDoor(doors[Math.floor(Math.random() * doors.length)]);
}, 12000);

S.variant = variantFromHash();
resize();
setVariant(S.variant);
say(soundWanted ? 'Tap or click to resume the bells.' : 'Brush the toran. Tap the speaker to hear the bells.');
const home = cityForTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
citySel.value = home.id;
selectedCity = home;
loadWind(home);
loadDoors().then((d) => {
  doors = d;
  hangDoors();
});
setInterval(() => selectedCity && loadWind(selectedCity, true), 15 * 60 * 1000);
requestAnimationFrame(frame);
