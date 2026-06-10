// Audio: BGM via HTMLAudio, SFX via WebAudio.
// Laser/boost use generated samples (public/sfx/) with procedural fallbacks;
// the rest are synthesized oscillators/noise.

let ctx = null;
let master = null;

function ensureCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

// ---------------------------------------------------------------- BGM

const tracks = {
  title: new Audio("/audio/title-bgm.mp3"),
  level: new Audio("/audio/level-bgm.mp3"),
};
// level runs hot so it cuts through laser/explosion SFX during play
const TRACK_VOLUME = { title: 0.55, level: 0.85 };
for (const [k, a] of Object.entries(tracks)) {
  a.loop = true;
  a.volume = TRACK_VOLUME[k];
  a.preload = "auto";
}

let currentTrack = null;
let unlocked = false; // a play() actually succeeded — playback is permitted
let blocked = false;  // the most recent play() attempt was rejected by autoplay policy
let lastAttempt = 0;

function tryPlayCurrent() {
  if (!currentTrack) return;
  const a = tracks[currentTrack];
  if (!a.paused) {
    unlocked = true;
    blocked = false;
    return;
  }
  const now = performance.now();
  if (now - lastAttempt < 400) return; // don't spam play() promises
  lastAttempt = now;
  a.play().then(
    () => { unlocked = true; blocked = false; },
    () => { blocked = true; }
  );
}

export function playMusic(name) {
  if (currentTrack === name) return;
  currentTrack = name;
  for (const [k, a] of Object.entries(tracks)) {
    if (k === name) {
      a.currentTime = 0;
    } else {
      a.pause();
    }
  }
  tryPlayCurrent();
}

// call on any user gesture (and on gamepad activity — it may or may not
// count as activation depending on the browser; harmless either way)
export function unlockAudio() {
  ensureCtx();
  tryPlayCurrent();
}

// call every frame: retries a stalled/blocked track and resumes the SFX
// context. Gamepad-only sessions recover here the moment any gesture lands.
export function ensureMusic() {
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
  if (currentTrack && tracks[currentTrack].paused) tryPlayCurrent();
}

// true while the browser is refusing playback (needs a key/tap/click)
export function audioBlocked() {
  return blocked && !unlocked;
}

// debug/smoke-test breadcrumb
window.__bgm = () => {
  const a = currentTrack ? tracks[currentTrack] : null;
  return {
    track: currentTrack,
    unlocked,
    blocked,
    paused: a?.paused ?? null,
    readyState: a?.readyState ?? null,
    networkState: a?.networkState ?? null,
    error: a?.error ? { code: a.error.code, message: a.error.message } : null,
    duration: a?.duration ?? null,
    currentTime: a?.currentTime ?? null,
  };
};

// ---------------------------------------------------------------- sampled SFX

const buffers = {};

export async function loadSfx() {
  const c = ensureCtx();
  const files = [
    ["laser", "/sfx/laser.mp3"],
    ["boost", "/sfx/boost.mp3"],
    ["transform", "/sfx/transform.mp3"],
    ["voice-vega", "/voice/bark-vega.wav"],
    ["voice-hex", "/voice/bark-hex.wav"],
    ["voice-anvil", "/voice/bark-anvil.wav"],
    ["voice-warning", "/voice/warning.wav"],
    ["voice-bossdown", "/voice/bossdown.wav"],
    ["voice-gameover", "/voice/gameover.wav"],
    ["voice-villain-intro", "/voice/villain-intro.wav"],
    ["voice-villain-rage", "/voice/villain-rage.wav"],
    ["voice-gw-vega", "/voice/gw-vega.wav"],
    ["voice-gw-hex", "/voice/gw-hex.wav"],
    ["voice-gw-anvil", "/voice/gw-anvil.wav"],
    ["voice-gw-fighter", "/voice/gw-fighter.wav"],
  ];
  await Promise.all(
    files.map(async ([name, url]) => {
      try {
        const data = await fetch(url).then((r) => r.arrayBuffer());
        buffers[name] = await c.decodeAudioData(data);
      } catch {
        // missing/undecodable assets fall back to procedural or silence
      }
    })
  );
}

export function playVoice(name) {
  playBuffer(`voice-${name}`, 1.0);
}

function playBuffer(name, vol = 1, rate = 1) {
  if (!buffers[name]) return false;
  const c = ensureCtx();
  const src = c.createBufferSource();
  src.buffer = buffers[name];
  src.playbackRate.value = rate;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(g).connect(master);
  src.start();
  return true;
}

// ---------------------------------------------------------------- SFX

export function sfxLaser() {
  // slight pitch jitter keeps rapid fire from sounding machine-stamped
  if (playBuffer("laser", 0.38, 0.94 + Math.random() * 0.12)) return;
  const c = ensureCtx();
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(1400, t);
  osc.frequency.exponentialRampToValueAtTime(280, t + 0.12);
  gain.gain.setValueAtTime(0.18, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + 0.14);
}

export function sfxTransform(toGerwalk) {
  // reverse transform plays slightly pitched down — feels like re-folding
  if (playBuffer("transform", 0.85, toGerwalk ? 1 : 0.86)) return;
  const c = ensureCtx();
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(toGerwalk ? 180 : 420, t);
  osc.frequency.exponentialRampToValueAtTime(toGerwalk ? 420 : 180, t + 0.4);
  gain.gain.setValueAtTime(0.2, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + 0.55);
}

export function sfxBoost() {
  if (playBuffer("boost", 0.8)) return;
  const c = ensureCtx();
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(60, t);
  osc.frequency.exponentialRampToValueAtTime(220, t + 0.5);
  gain.gain.setValueAtTime(0.3, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + 1);
}

function noiseBuffer(c, seconds) {
  const buf = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export function sfxExplosion(big = false) {
  const c = ensureCtx();
  const t = c.currentTime;
  const dur = big ? 0.9 : 0.45;

  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, dur);
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(big ? 1200 : 2200, t);
  filter.frequency.exponentialRampToValueAtTime(80, t + dur);
  const gain = c.createGain();
  gain.gain.setValueAtTime(big ? 0.55 : 0.3, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter).connect(gain).connect(master);
  src.start(t);

  const osc = c.createOscillator();
  const og = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(big ? 90 : 140, t);
  osc.frequency.exponentialRampToValueAtTime(30, t + dur * 0.8);
  og.gain.setValueAtTime(0.5, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.8);
  osc.connect(og).connect(master);
  osc.start(t);
  osc.stop(t + dur);
}

export function sfxHit() {
  const c = ensureCtx();
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(220, t);
  osc.frequency.exponentialRampToValueAtTime(60, t + 0.2);
  gain.gain.setValueAtTime(0.3, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + 0.25);
}

export function sfxRing() {
  const c = ensureCtx();
  const t = c.currentTime;
  for (const [freq, delay] of [[660, 0], [880, 0.07], [1320, 0.14]]) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t + delay);
    gain.gain.exponentialRampToValueAtTime(0.2, t + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.25);
    osc.connect(gain).connect(master);
    osc.start(t + delay);
    osc.stop(t + delay + 0.3);
  }
}

export function sfxRoll() {
  const c = ensureCtx();
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(300, t);
  osc.frequency.exponentialRampToValueAtTime(900, t + 0.3);
  gain.gain.setValueAtTime(0.12, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + 0.4);
}

export function sfxAlarm() {
  const c = ensureCtx();
  const t = c.currentTime;
  for (let i = 0; i < 3; i++) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(520, t + i * 0.5);
    osc.frequency.setValueAtTime(390, t + i * 0.5 + 0.25);
    gain.gain.setValueAtTime(0.12, t + i * 0.5);
    gain.gain.setValueAtTime(0.0001, t + i * 0.5 + 0.45);
    osc.connect(gain).connect(master);
    osc.start(t + i * 0.5);
    osc.stop(t + i * 0.5 + 0.46);
  }
}

export function sfxEnemyShot() {
  const c = ensureCtx();
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(420, t);
  osc.frequency.exponentialRampToValueAtTime(110, t + 0.25);
  gain.gain.setValueAtTime(0.14, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + 0.28);
}

export function sfxSelect() {
  const c = ensureCtx();
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(440, t);
  osc.frequency.setValueAtTime(660, t + 0.06);
  gain.gain.setValueAtTime(0.15, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + 0.2);
}
