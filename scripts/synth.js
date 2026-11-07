// Tiny deterministic DSP toolkit used to generate the seed library.
// Everything renders to mono Float32 at 44.1 kHz.
export const SR = 44100;
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
  const r = rng(seed);
  return () => r() * 2 - 1;
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
  let y = 0;
  return (x, fc = cutoff) => { const a = 1 - Math.exp(-TAU * fc / SR); y += a * (x - y); return y; };
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

/** Cheap Schroeder-style reverb (4 combs + 2 allpasses). */
export function reverb(mix = 0.25, size = 1) {
  const combs = [1557, 1617, 1491, 1422].map((n) => ({ buf: new Float32Array(Math.round(n * size)), i: 0 }));
  const aps = [225, 556].map((n) => ({ buf: new Float32Array(n), i: 0 }));
  return (x) => {
    let s = 0;
    for (const c of combs) { const y = c.buf[c.i]; c.buf[c.i] = x + y * 0.82; c.i = (c.i + 1) % c.buf.length; s += y; }
    s /= 4;
    for (const a of aps) { const y = a.buf[a.i]; const v = s + y * 0.5; a.buf[a.i] = v; a.i = (a.i + 1) % a.buf.length; s = y - v * 0.5; }
    return x * (1 - mix) + s * mix;
  };
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

/** Normalize to target peak and add short fades (skipped for seamless loops). */
export function finalize(buf, { peak = 0.89, loop = false, fade = 0.006 } = {}) {
  let max = 0;
  for (const v of buf) max = Math.max(max, Math.abs(v));
  const g = max > 0 ? peak / max : 1;
  const nf = loop ? 0 : Math.round(fade * SR);
  for (let i = 0; i < buf.length; i++) {
    let v = buf[i] * g;
    if (i < nf) v *= i / nf;
    if (i >= buf.length - nf) v *= (buf.length - 1 - i) / nf;
    buf[i] = v;
  }
  return buf;
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
