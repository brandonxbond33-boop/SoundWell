// Deterministic DSP toolkit used to generate the SoundWell library.
// Sounds render at 44.1 kHz (or 88.2 kHz internally when oversampled), in stereo via two passes:
// each pass renders the same seeded sound, and only reverbs and ensembles differ per channel.
export const BASE_SR = 44100;
export let SR = BASE_SR;
let CH = 0;            // channel being rendered (0 = left, 1 = right)
let SPATIAL = false;   // set when a reverb or ensemble is built, so dry sounds skip the second pass
export const channel = () => CH;
export const markSpatial = () => { SPATIAL = true; };
let WIDE = false;      // ambience beds: each channel gets its own noise texture (events stay in sync)
/** Equal-power gain for the channel being rendered; pan runs from -1 (left) to 1 (right). */
export const panGain = (pan) => { const a = (Math.max(-1, Math.min(1, pan)) + 1) * Math.PI / 4; return Math.SQRT2 * (CH ? Math.sin(a) : Math.cos(a)); };
export const panned = () => { markSpatial(); return panGain; };
const TAU = Math.PI * 2;

export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const midi = (n) => 440 * 2 ** ((n - 69) / 12);
export const sin = (ph) => Math.sin(TAU * ph);
export const square = (ph) => (ph % 1 < 0.5 ? 1 : -1);
export const saw = (ph) => 2 * (ph % 1) - 1;
export const tri = (ph) => 1 - 4 * Math.abs((ph % 1) - 0.5);

/** Render `seconds` of audio; fn(t, i) returns one sample. */
export function render(seconds, fn) {
  const n = Math.round(seconds * SR);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = fn(i / SR, i);
  return out;
}

/** Phase accumulator for oscillators with time-varying frequency. */
export function phasor() {
  let ph = 0;
  return (freq) => { ph += freq / SR; return ph; };
}

export function noise(seed) {
  const k = Math.sqrt(SR / BASE_SR); // same in-band level when oversampled
  const r = rng(seed);
  if (WIDE) { // shared + per-channel texture: wide but anchored (about 0.3 L/R correlation)
    markSpatial(); const own = rng(seed + 104729 * (CH + 1));
    return () => ((r() * 2 - 1) * 0.55 + (own() * 2 - 1) * 0.835) * k;
  }
  return () => (r() * 2 - 1) * k;
}
export function pinkNoise(seed) {
  const w = noise(seed);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  return () => {
    const x = w();
    b0 = 0.99886 * b0 + x * 0.0555179; b1 = 0.99332 * b1 + x * 0.0750759;
    b2 = 0.969 * b2 + x * 0.153852; b3 = 0.8665 * b3 + x * 0.3104856;
    b4 = 0.55 * b4 + x * 0.5329522; b5 = -0.7616 * b5 - x * 0.016898;
    const y = b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * 0.5362;
    b6 = x * 0.115926;
    return y * 0.11;
  };
}
export function brownNoise(seed) {
  const w = noise(seed);
  let y = 0;
  return () => { y = (y + 0.02 * w()) / 1.02; return y * 3.5; };
}

/** One-pole low-pass; cutoff may change per sample. */
export function lowpass(cutoff) {
  let y = 0, lf = NaN, a = 0;
  return (x, fc = cutoff) => { if (fc !== lf) { lf = fc; a = 1 - Math.exp(-TAU * fc / SR); } y += a * (x - y); return y; };
}
export function highpass(cutoff) {
  const lp = lowpass(cutoff);
  return (x, fc) => x - lp(x, fc);
}
/** Resonant state-variable band-pass. */
export function bandpass(center, q = 2) {
  let low = 0, band = 0;
  return (x, fc = center) => {
    const f = 2 * Math.sin(Math.PI * Math.min(fc, SR / 6) / SR);
    low += f * band;
    const high = x - low - band / q;
    band += f * high;
    return band;
  };
}

/** Feedback delay (echo). */
export function delay(seconds, feedback = 0.4, mix = 0.35) {
  const buf = new Float32Array(Math.round(seconds * SR));
  let i = 0;
  return (x) => {
    const d = buf[i];
    buf[i] = x + d * feedback;
    i = (i + 1) % buf.length;
    return x * (1 - mix) + d * mix;
  };
}

/**
 * Stereo room reverb (Freeverb topology: 8 damped combs + 4 allpasses). Tunings are scaled to the
 * sample rate and offset per channel, so the left and right tails decorrelate into a wide image.
 * `size` keeps the meaning of the older reverb (about 0.6 small room to 1.8 large hall).
 */
export const FV_COMBS = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
export const FV_APS = [556, 441, 341, 225];
export function stereoTank({ fb = 0.84, damp = 0.3, scale = 1, spread = 23 } = {}) {
  markSpatial(); const k = SR / BASE_SR; const off = CH ? spread : 0;
  const combs = FV_COMBS.map((n) => ({ b: new Float32Array(Math.max(8, Math.round((n * scale + off) * k))), i: 0, s: 0 }));
  const aps = FV_APS.map((n) => ({ b: new Float32Array(Math.max(4, Math.round((n + off) * k))), i: 0 }));
  return (inp) => {
    let out = 0;
    for (const c of combs) { const y = c.b[c.i]; c.s = y * (1 - damp) + c.s * damp; c.b[c.i] = inp + c.s * fb; c.i = (c.i + 1) % c.b.length; out += y; }
    for (const a of aps) { const y = a.b[a.i]; const o = y - out; a.b[a.i] = out + y * 0.5; a.i = (a.i + 1) % a.b.length; out = o; }
    return out;
  };
}
export function reverb(mix = 0.25, size = 1) {
  const sz = Math.min(1.8, Math.max(0.5, size));
  const tank = stereoTank({ fb: 0.74 + 0.08 * sz, damp: 0.32, scale: 0.65 + 0.35 * sz });
  const lp = lowpass(8000);
  return (x) => x * (1 - mix) + lp(tank(x * 0.12)) * mix * 0.48; // level matched to the previous reverb with broadband input
}

export const expDecay = (t, rate) => (t < 0 ? 0 : Math.exp(-rate * t));
export const adsr = (t, a, d, s, r, len) => {
  if (t < 0) return 0;
  if (t < a) return t / a;
  if (t < a + d) return 1 - (1 - s) * ((t - a) / d);
  if (t < len) return s;
  return Math.max(0, s * (1 - (t - len) / r));
};

/** Mix a list of notes [{start, dur, ...}] by summing voice(note, tLocal). */
export function sequence(notes, voice, tail = 1) {
  return (t) => {
    let s = 0;
    for (const n of notes) {
      const lt = t - n.start;
      if (lt >= 0 && lt < n.dur + tail) s += voice(n, lt);
    }
    return s;
  };
}

/**
 * Normalize to target peak and add short fades (skipped for seamless loops).
 * `maxRms` caps loudness so dense tones (square-wave beeps, buzzers) don't come out far louder
 * than everything else after peak normalization.
 */
export function finalize(buf, { peak = 0.89, loop = false, fade = 0.006, maxRms = Infinity } = {}) {
  let max = 0; let sq = 0;
  for (const v of buf) { max = Math.max(max, Math.abs(v)); sq += v * v; }
  let g = max > 0 ? peak / max : 1;
  const rms = Math.sqrt(sq / (buf.length || 1)) * g;
  if (rms > maxRms) g *= maxRms / rms;
  const nf = loop ? 0 : Math.round(fade * SR);
  for (let i = 0; i < buf.length; i++) {
    let v = buf[i] * g;
    if (i < nf) v *= i / nf;
    if (i >= buf.length - nf) v *= (buf.length - 1 - i) / nf;
    buf[i] = v;
  }
  return buf;
}

// ---------- high-quality rendering: oversampling, stereo, mastering ----------
const HB = (() => { // 63-tap windowed-sinc low-pass at 20 kHz for 2x decimation
  const N = 63, fc = 20000 / (2 * BASE_SR), h = []; let sum = 0;
  for (let i = 0; i < N; i++) { const m = i - (N - 1) / 2; const sinc = m === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * m) / (Math.PI * m); const w = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)) + 0.08 * Math.cos(4 * Math.PI * i / (N - 1)); h.push(sinc * w); sum += sinc * w; }
  return h.map((v) => v / sum);
})();
/** Halve the sample rate with an anti-alias filter. Loops filter circularly so the seam stays clean. */
export function decimate2(x, loop = false) {
  const n = Math.floor(x.length / 2); const out = new Float32Array(n); const H = (HB.length - 1) / 2; const L = x.length;
  for (let j = 0; j < n; j++) { const c = 2 * j; let s = 0; for (let k = 0; k < HB.length; k++) { let i = c + k - H; if (i < 0 || i >= L) { if (!loop) continue; i = (i + L) % L; } s += HB[k] * x[i]; } out[j] = s; }
  return out;
}
/** Remove DC and sub-sonic rumble (20 Hz, 12 dB/oct). Loops run twice so the filter has settled at the seam. */
function hpf20(x, loop) {
  const a = Math.exp(-2 * Math.PI * 20 / BASE_SR);
  for (let pass = 0; pass < 2; pass++) { let px = 0, py = 0, qx = 0, qy = 0; const runs = loop ? 2 : 1;
    for (let r = 0; r < runs; r++) for (let i = 0; i < x.length; i++) { const v = x[i]; const y1 = a * (py + v - px); px = v; py = y1; const y2 = a * (qy + y1 - qx); qx = y1; qy = y2; if (r === runs - 1) x[i] = y2; } }
  return x;
}
/** Smooth look-ahead peak limiter (1.5 ms look-ahead, 80 ms release). */
function limit(Lc, Rc, ceil, loop) {
  const n = Lc.length; const w = Math.round(0.0015 * BASE_SR); const rel = 1 - Math.exp(-1 / (0.08 * BASE_SR));
  const env = new Float32Array(n); for (let i = 0; i < n; i++) env[i] = Math.max(Math.abs(Lc[i]), Math.abs(Rc[i]));
  const need = new Float32Array(n); for (let i = 0; i < n; i++) { let m = 0; for (let k = -w; k <= w; k++) { let j = i + k; if (j < 0 || j >= n) { if (!loop) continue; j = (j + n) % n; } if (env[j] > m) m = env[j]; } need[i] = m > ceil ? ceil / m : 1; }
  let g = 1; const passes = loop ? 2 : 1;
  for (let p = 0; p < passes; p++) for (let i = 0; i < n; i++) { g = need[i] < g ? need[i] : g + (1 - g) * rel; if (g > need[i]) g = need[i]; if (p === passes - 1) { Lc[i] *= g; Rc[i] *= g; } }
}
/**
 * Master a stereo pair: sub-sonic high-pass, loudness (one-shots peak-normalized to -1 dBFS with an RMS cap;
 * loops matched to a common loudness with a gentle limiter), and click-free fades on one-shots.
 */
export function master(Lc, Rc, { loop = false, fade = 0.006, maxRms = 0.3, loopRms = 0.17 } = {}) {
  hpf20(Lc, loop); if (Rc !== Lc) hpf20(Rc, loop);
  let peak = 0, sq = 0; const n = Lc.length;
  for (let i = 0; i < n; i++) { const a = Lc[i], b = Rc[i]; peak = Math.max(peak, Math.abs(a), Math.abs(b)); sq += (a * a + b * b) / 2; }
  const rms = Math.sqrt(sq / (n || 1)); if (!peak) return [Lc, Rc];
  let g;
  if (loop) { g = Math.min(loopRms / (rms || 1), 2 * 0.95 / peak); }
  else { g = 0.89 / peak; if (rms * g > maxRms) g = maxRms / rms; }
  if (Rc === Lc) Rc = Float32Array.from(Lc);
  for (let i = 0; i < n; i++) { Lc[i] *= g; Rc[i] *= g; }
  if (peak * g > 0.95) limit(Lc, Rc, 0.95, loop);
  if (!loop) { const nf = Math.round(fade * BASE_SR); for (let i = 0; i < nf && i < n; i++) { const f = i / nf; Lc[i] *= f; Rc[i] *= f; Lc[n - 1 - i] *= f; Rc[n - 1 - i] *= f; } }
  return [Lc, Rc];
}
/**
 * Render a sound function to a finished stereo pair. `make()` must build and render the sound from scratch
 * (seeded, so both passes are identical apart from spatial effects). `os: 2` renders at 88.2 kHz and decimates.
 */
export function renderStereo(make, { loop = false, os = 1, maxRms = 0.3, wide = false } = {}) {
  const pass = (ch) => { CH = ch; SR = BASE_SR * os; WIDE = wide; let b; try { b = make(); } finally { SR = BASE_SR; CH = 0; WIDE = false; } return os === 2 ? decimate2(b, loop) : b; };
  SPATIAL = false; const Lc = pass(0); const spatial = SPATIAL; const Rc = spatial ? pass(1) : Lc;
  const [l, r] = master(Lc, Rc, { loop, maxRms }); return { l, r, stereo: spatial };
}

/** Downsample to `n` peak bars in 0..100 for the waveform display. */
export function peaks(buf, n = 120) {
  const out = [];
  const step = buf.length / n;
  let max = 0;
  for (let b = 0; b < n; b++) {
    let p = 0;
    const end = Math.min(buf.length, Math.floor((b + 1) * step));
    for (let i = Math.floor(b * step); i < end; i++) p = Math.max(p, Math.abs(buf[i]));
    out.push(p); max = Math.max(max, p);
  }
  return out.map((p) => Math.max(2, Math.round((p / (max || 1)) * 100)));
}
