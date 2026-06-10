// Procedural WebAudio SFX — zero asset files.

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

// call once on first user gesture
export function unlockAudio() {
  ensureCtx();
}

export function sfxLaser() {
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

  // low thump
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
