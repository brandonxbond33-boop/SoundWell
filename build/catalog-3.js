// Third batch: stem kits, ambience layers, matching stingers, creative effects. Original, CC0.
import {
  SR, render, phasor, sin, square, saw, tri, midi, noise, pinkNoise, brownNoise, lowpass, highpass,
  bandpass, delay, reverb, expDecay, adsr, sequence, rng,
} from './synth.js';
import { beat, kick, snare, pad, piano, grid, chords, drums } from './catalog.js';

const TAU = Math.PI * 2;
const sat = (x, k = 1.5) => Math.tanh(k * x);

/** Seamless loop: render a tail past the end and fold it back onto the start. */
function loopRender(len, fn, tail = 2.5) {
  const full = render(len + tail, fn); const n = Math.round(len * SR); const out = full.slice(0, n);
  for (let i = n; i < full.length; i++) out[i - n] += full[i];
  return out;
}
/** Continuous sounds (noise beds): crossfade the tail into the start instead of folding it. */
function loopRenderX(len, fn, tail = 2.5) {
  const full = render(len + tail, fn); const n = Math.round(len * SR); const out = full.slice(0, n); const X = Math.min(full.length - n, n);
  for (let i = 0; i < X; i++) { const a = (i / X) * Math.PI / 2; out[i] = full[i] * Math.sin(a) + full[n + i] * Math.cos(a); }
  return out;
}
function metal(f, ratios, rate = 3) {
  return (lt) => { if (lt < 0) return 0; let s = 0; ratios.forEach((r, i) => { s += sin(f * r * lt) * expDecay(lt, rate * (1 + i * 0.6)) / (i + 1); }); return s * Math.min(1, lt * 2000); };
}
function scatter(seed, len, rate, minGap = 0) {
  const r = rng(seed); const out = []; let t = r() / rate;
  while (t < len) { out.push(t); t += minGap + (-Math.log(1 - r()) / rate); }
  return out;
}
function brassV(n, lt) {
  const f = midi(n.note); const env = adsr(lt, n.att ?? 0.3, 0.3, 0.8, 0.5, n.dur); let s = 0;
  for (let k = 1; k <= 9; k++) s += sin(f * k * lt) * Math.exp(-k * (1.7 - env)) / k;
  return env * s * 0.5;
}
function stringV(n, lt) {
  const f = midi(n.note); const env = adsr(lt, n.att ?? 0.02, 0.08, 0.6, 0.08, n.dur);
  return env * (saw(f * lt) + saw(f * 1.005 * lt) * 0.7) * 0.3;
}
/** Vowel "ah" choir: saw through three formant band-passes. */
function choirPad(prog, len) {
  const f1 = bandpass(800, 6); const f2 = bandpass(1150, 7); const f3 = bandpass(2900, 8);
  const src = sequence(prog, (n, lt) => { const f = midi(n.note) * (1 + 0.004 * Math.sin(TAU * 5 * lt + n.note)); return adsr(lt, 0.8, 0.4, 0.85, 1, n.dur) * (saw(f * lt) + saw(f * 1.003 * lt)) * 0.3; }, 1.2);
  return (t) => { const x = src(t); return f1(x) * 1.2 + f2(x) * 0.8 + f3(x) * 0.35; };
}

// ---------------- kits ----------------
export const KITS = [
  { id: 'neon', name: 'Neon Groove', bpm: 120, key: 'A minor', bars: 8, desc: 'Bright synth-pop: punchy drums, a bouncing bass, warm chords, a hooky lead and a sparkling arpeggio.' },
  { id: 'lofi', name: 'Rainy Lo-fi', bpm: 80, key: 'C major', bars: 8, desc: 'Dusty lo-fi hip-hop: lazy drums, round bass, jazzy keys, a soft melody and a rain-and-vinyl texture.' },
  { id: 'epic', name: 'Epic Trailer', bpm: 100, key: 'D minor', bars: 8, desc: 'Cinematic and huge: taiko drums, driving strings, swelling brass and a wordless choir.' },
];

// Neon Groove: Am – F – C – G, two bars each.
const NB = beat(120); const NLEN = 32 * NB; const NROOTS = [45, 41, 48, 43];
const NCH = [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]];
// Rainy Lo-fi: Fmaj7 – Em7 – Dm7 – Cmaj7.
const LB = beat(80); const LLEN = 32 * LB; const LCH = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]];
// Epic: Dm – Bb – F – C.
const EB = beat(100); const ELEN = 32 * EB; const EROOTS = [38, 34, 41, 36]; const ECH = [[50, 53, 57], [50, 53, 58], [48, 53, 57], [48, 52, 55]];

const stem = (kit, name, extra) => ({ kind: 'music', loopable: true, kit, stem: name, ...extra });

export const CATALOG_3 = [
  // ===== Neon Groove kit =====
  { ...stem('neon', 'Drums', { slug: 'neon-groove-drums', title: 'Neon Groove · Drums', category: 'Stem Kits', bpm: 120, key: 'A minor', mood: 'Energetic',
    tags: ['stem', 'drums', 'synthpop', 'kit', 'beat', 'neon groove', 'loop'],
    description: 'Drum stem of the Neon Groove kit: punchy kick, crisp snare and off-beat open hats at 120 BPM. Layers with the other Neon stems.' }),
    render: () => { const d = drums({ bpm: 120, bars: 8, k: 'x...x...x...x..x', s: '....x.......x...', h: '..x...x...x...x.', seed: 3001 }); const n = noise(3002); const hp = highpass(6000);
      const oh = sequence(grid(Array(32).fill(0).map((_, i) => (i % 8 === 7 ? 1 : null)), NB / 2), (x, lt) => hp(n()) * expDecay(lt, 9) * 0.5, 0.3);
      return loopRender(NLEN, (t) => d(t) + oh(t)); } },
  { ...stem('neon', 'Bass', { slug: 'neon-groove-bass', title: 'Neon Groove · Bass', category: 'Stem Kits', bpm: 120, key: 'A minor', mood: 'Energetic',
    tags: ['stem', 'bass', 'synth bass', 'synthpop', 'kit', 'neon groove', 'loop'],
    description: 'Bass stem of the Neon Groove kit: a bouncing eighth-note synth bass with octave jumps, following Am, F, C, G.' }),
    render: () => { const pat = NROOTS.flatMap((r) => [r, r, r + 12, r, r, r + 12, r, r + 7].concat([r, r, r + 12, r, r + 10, r + 12, r, r + 7]));
      const f = sequence(grid(pat, NB / 2, NB / 2 * 0.8), (n, lt) => sat(saw(midi(n.note) * lt) + square(midi(n.note) * 0.5 * lt) * 0.4, 1.4) * adsr(lt, 0.005, 0.12, 0.5, 0.05, n.dur), 0.1);
      const lp = lowpass(900); return loopRender(NLEN, (t) => lp(f(t), 500 + 500 * (0.5 + 0.5 * Math.sin(TAU * t / (4 * NB))))); } },
  { ...stem('neon', 'Chords', { slug: 'neon-groove-chords', title: 'Neon Groove · Chords', category: 'Stem Kits', bpm: 120, key: 'A minor', mood: 'Hopeful',
    tags: ['stem', 'chords', 'pad', 'synth', 'kit', 'neon groove', 'loop'],
    description: 'Chord stem of the Neon Groove kit: warm, pulsing synth chords (Am, F, C, G) with a gentle sidechain-style pump.' }),
    render: () => { const f = sequence(chords(NCH, 8 * NB), pad, 1.5); const lp = lowpass(2200); const rv = reverb(0.3, 1.2);
      return loopRender(NLEN, (t) => { const pump = 0.55 + 0.45 * Math.min(1, ((t % NB) / NB) * 2.2); return rv(lp(f(t))) * pump; }); } },
  { ...stem('neon', 'Lead', { slug: 'neon-groove-lead', title: 'Neon Groove · Lead', category: 'Stem Kits', bpm: 120, key: 'A minor', mood: 'Happy',
    tags: ['stem', 'lead', 'melody', 'hook', 'synth', 'kit', 'neon groove', 'loop'],
    description: 'Lead stem of the Neon Groove kit: a catchy, bright synth hook with a slapback echo. Sits on top of the chords.' }),
    render: () => { const mel = [76, null, 72, 74, 76, null, 79, 76, 74, null, 72, null, 69, null, null, null, 72, null, 69, 72, 74, null, 72, 69, 67, null, 64, null, 65, 67, null, null,
      76, null, 72, 74, 76, null, 79, 81, 79, null, 76, null, 74, null, null, null, 72, 74, 76, null, 74, 72, 71, null, 67, null, 69, null, null, null, null, null];
      const f = sequence(grid(mel, NB / 2, NB / 2 * 0.9), (n, lt) => (saw(midi(n.note) * lt) * 0.5 + square(midi(n.note) * 1.004 * lt) * 0.3) * adsr(lt, 0.01, 0.15, 0.6, 0.1, n.dur), 0.2);
      const lp = lowpass(3500); const dl = delay(NB * 0.75, 0.35, 0.3); return loopRender(NLEN, (t) => dl(lp(f(t)))); } },
  { ...stem('neon', 'Arp', { slug: 'neon-groove-arp', title: 'Neon Groove · Arpeggio', category: 'Stem Kits', bpm: 120, key: 'A minor', mood: 'Dreamy',
    tags: ['stem', 'arpeggio', 'arp', 'sparkle', 'synth', 'kit', 'neon groove', 'loop'],
    description: 'Arpeggio stem of the Neon Groove kit: a glassy sixteenth-note arpeggio that sparkles above everything else.' }),
    render: () => { const arp = NCH.flatMap((ch) => Array(32).fill(0).map((_, i) => ch[[0, 1, 2, 1][i % 4]] + 12 + (i % 8 >= 4 ? 12 : 0)));
      const f = sequence(grid(arp, NB / 4, NB / 4 * 0.8), (n, lt) => (tri(midi(n.note) * lt) * 0.6 + sin(midi(n.note) * 2 * lt) * 0.2) * expDecay(lt, 10), 0.2);
      const dl = delay(NB * 0.75, 0.4, 0.35); return loopRender(NLEN, (t) => dl(f(t))); } },
  { ...stem('neon', 'Percussion', { slug: 'neon-groove-percussion', title: 'Neon Groove · Percussion', category: 'Stem Kits', bpm: 120, key: 'A minor', mood: 'Energetic',
    tags: ['stem', 'percussion', 'shaker', 'claps', 'kit', 'neon groove', 'loop'],
    description: 'Percussion stem of the Neon Groove kit: shaker sixteenths, layered claps and a syncopated rim click.' }),
    render: () => { const n = noise(3011); const hp = highpass(7000); const bp = bandpass(1400, 1.5); const n2 = noise(3012);
      const sh = sequence(grid(Array(128).fill(1), NB / 4), (x, lt) => hp(n()) * (x.start / (NB / 4) % 2 ? 0.5 : 0.25) * expDecay(lt, 30), 0.1);
      const cl = sequence(Array(16).fill(0).map((_, i) => ({ start: (i * 2 + 1) * NB, dur: 0.1 })), (x, lt) => bp(n2()) * (expDecay(lt, 25) + 0.7 * (lt > 0.011 ? expDecay(lt - 0.011, 30) : 0)), 0.2);
      const rim = sequence(Array(16).fill(0).map((_, i) => ({ start: i * 2 * NB + NB * 1.75, dur: 0.05 })), (x, lt) => sin(1800 * lt) * expDecay(lt, 90), 0.05);
      return loopRender(NLEN, (t) => sh(t) * 0.8 + cl(t) * 0.6 + rim(t) * 0.3); } },

  // ===== Rainy Lo-fi kit =====
  { ...stem('lofi', 'Drums', { slug: 'rainy-lofi-drums', title: 'Rainy Lo-fi · Drums', category: 'Stem Kits', bpm: 80, key: 'C major', mood: 'Calm',
    tags: ['stem', 'drums', 'lofi', 'hiphop', 'kit', 'rainy lofi', 'loop'],
    description: 'Drum stem of the Rainy Lo-fi kit: a lazy, muffled boom-bap groove at 80 BPM.' }),
    render: () => { const d = drums({ bpm: 80, bars: 8, k: 'x......x..x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.xx', seed: 3021 }); const lp = lowpass(3200); return loopRender(LLEN, (t) => lp(d(t))); } },
  { ...stem('lofi', 'Bass', { slug: 'rainy-lofi-bass', title: 'Rainy Lo-fi · Bass', category: 'Stem Kits', bpm: 80, key: 'C major', mood: 'Calm',
    tags: ['stem', 'bass', 'lofi', 'warm', 'kit', 'rainy lofi', 'loop'],
    description: 'Bass stem of the Rainy Lo-fi kit: a round, soft upright-style bass under Fmaj7, Em7, Dm7, Cmaj7.' }),
    render: () => { const notes = LCH.flatMap((ch, i) => [0, 1].flatMap((b) => [{ note: ch[0] - 12, start: (i * 8 + b * 4) * LB, dur: LB * 1.4 }, { note: ch[2] - 12, start: (i * 8 + b * 4 + 1.5) * LB, dur: LB * 0.5 }, { note: ch[0] - 12, start: (i * 8 + b * 4 + 2.5) * LB, dur: LB }]));
      const f = sequence(notes, (n, lt) => (sin(midi(n.note) * lt) + 0.25 * sin(midi(n.note) * 2 * lt)) * adsr(lt, 0.01, 0.3, 0.6, 0.1, n.dur), 0.2); return loopRender(LLEN, f); } },
  { ...stem('lofi', 'Keys', { slug: 'rainy-lofi-keys', title: 'Rainy Lo-fi · Keys', category: 'Stem Kits', bpm: 80, key: 'C major', mood: 'Calm',
    tags: ['stem', 'keys', 'piano', 'jazz chords', 'lofi', 'kit', 'rainy lofi', 'loop'],
    description: 'Keys stem of the Rainy Lo-fi kit: dusty, slightly detuned jazz piano chords with a slow tape wobble.' }),
    render: () => { const notes = LCH.flatMap((ch, i) => [0, 1.5, 4, 5.5, 6.5].flatMap((o) => ch.map((note, k) => ({ note, start: (i * 8 + o) * LB + k * 0.012, dur: LB * 2 })))); const f = sequence(notes, piano, 2); const lp = lowpass(2200);
      return loopRender(LLEN, (t) => lp(f(t * (1 + 0.0015 * Math.sin(TAU * 0.4 * t)))) * 0.6); } },
  { ...stem('lofi', 'Melody', { slug: 'rainy-lofi-melody', title: 'Rainy Lo-fi · Melody', category: 'Stem Kits', bpm: 80, key: 'C major', mood: 'Calm',
    tags: ['stem', 'melody', 'pluck', 'guitar', 'lofi', 'kit', 'rainy lofi', 'loop'],
    description: 'Melody stem of the Rainy Lo-fi kit: a sparse, soft plucked melody with a warm echo.' }),
    render: () => { const mel = [72, null, 76, null, 79, null, 77, 76, null, null, 74, null, null, null, null, null, 71, null, 74, null, 76, 74, 72, null, 69, null, null, null, 67, null, null, null,
      72, null, 76, null, 81, null, 79, 77, 76, null, 74, null, null, null, null, null, 72, null, 71, null, 67, null, 69, null, 72, null, null, null, null, null, null, null];
      const f = sequence(grid(mel, LB / 2, LB / 2), (n, lt) => (sin(midi(n.note) * lt) * 0.6 + tri(midi(n.note) * 2 * lt) * 0.15) * expDecay(lt, 4) * Math.min(1, lt * 500), 0.6);
      const dl = delay(LB * 0.75, 0.35, 0.3); const lp = lowpass(2500); return loopRender(LLEN, (t) => dl(lp(f(t)))); } },
  { ...stem('lofi', 'Texture', { slug: 'rainy-lofi-texture', title: 'Rainy Lo-fi · Rain & Vinyl', category: 'Stem Kits', bpm: 80, key: 'C major', mood: 'Calm',
    tags: ['stem', 'texture', 'vinyl', 'crackle', 'rain', 'lofi', 'kit', 'rainy lofi', 'loop'],
    description: 'Texture stem of the Rainy Lo-fi kit: soft rain on a window mixed with warm vinyl crackle and hiss.' }),
    render: () => { const p = pinkNoise(3031); const hp = highpass(900); const lp = lowpass(5000); const r = rng(3032); const n = noise(3033); let c = 0;
      return loopRenderX(LLEN, () => { if (r() < 0.0009) c = 0.4 + r() * 0.6; c *= 0.88; return lp(hp(p())) * 0.5 + n() * c * 0.5 + n() * 0.012; }); } },

  // ===== Epic Trailer kit =====
  { ...stem('epic', 'Taiko', { slug: 'epic-trailer-taiko', title: 'Epic Trailer · Taiko Drums', category: 'Stem Kits', bpm: 100, key: 'D minor', mood: 'Epic',
    tags: ['stem', 'taiko', 'drums', 'cinematic', 'trailer', 'kit', 'epic trailer', 'loop'],
    description: 'Drum stem of the Epic Trailer kit: thunderous taiko hits with a rolling build in the last bar.' }),
    render: () => { const n = noise(3041); const lp = lowpass(500);
      const pat = [1, 0, 0, 0.6, 0, 0, 1, 0, 0, 0, 0.7, 0, 0.5, 0, 0.8, 0]; const hits = [];
      for (let bar = 0; bar < 8; bar++) (bar === 7 ? Array(16).fill(0).map((_, i) => 0.4 + i * 0.04) : pat).forEach((g, i) => { if (g) hits.push({ start: (bar * 16 + i) * EB / 4, dur: 0.6, g }); });
      const f = sequence(hits, (h, lt) => h.g * (sin(62 * lt + 3 * (1 - Math.exp(-20 * lt))) * expDecay(lt, 4) + lp(n()) * expDecay(lt, 18) * 1.5), 0.9);
      const rv = reverb(0.3, 1.5); return loopRender(ELEN, (t) => rv(f(t))); } },
  { ...stem('epic', 'Strings', { slug: 'epic-trailer-strings', title: 'Epic Trailer · Strings', category: 'Stem Kits', bpm: 100, key: 'D minor', mood: 'Epic',
    tags: ['stem', 'strings', 'ostinato', 'cinematic', 'trailer', 'kit', 'epic trailer', 'loop'],
    description: 'String stem of the Epic Trailer kit: a driving, urgent eighth-note ostinato over Dm, Bb, F, C.' }),
    render: () => { const pat = EROOTS.flatMap((r) => Array(16).fill(0).map((_, i) => r + 12 + [0, 0, 12, 0, 7, 0, 12, 7][i % 8]));
      const f = sequence(grid(pat, EB / 2, EB / 2 * 0.85), stringV, 0.1); const lp = lowpass(2600); const rv = reverb(0.25, 1.4); return loopRender(ELEN, (t) => rv(lp(f(t)))); } },
  { ...stem('epic', 'Brass', { slug: 'epic-trailer-brass', title: 'Epic Trailer · Brass', category: 'Stem Kits', bpm: 100, key: 'D minor', mood: 'Epic',
    tags: ['stem', 'brass', 'horns', 'cinematic', 'trailer', 'kit', 'epic trailer', 'loop'],
    description: 'Brass stem of the Epic Trailer kit: big, swelling horn chords that rise on each chord change.' }),
    render: () => { const notes = ECH.flatMap((ch, i) => ch.map((note) => ({ note: note - 12, start: i * 8 * EB, dur: 7.5 * EB, att: 1.2 }))); const f = sequence(notes, brassV, 0.8); const rv = reverb(0.35, 1.5); return loopRender(ELEN, (t) => rv(f(t))); } },
  { ...stem('epic', 'Choir', { slug: 'epic-trailer-choir', title: 'Epic Trailer · Choir', category: 'Stem Kits', bpm: 100, key: 'D minor', mood: 'Epic',
    tags: ['stem', 'choir', 'voices', 'ah', 'cinematic', 'trailer', 'kit', 'epic trailer', 'loop'],
    description: 'Choir stem of the Epic Trailer kit: a wordless "ah" choir, slow and huge, holding each chord.' }),
    render: () => { const f = choirPad(chords(ECH, 8 * EB), ELEN); const rv = reverb(0.45, 1.7); return loopRender(ELEN, (t) => rv(f(t))); } },

  // ===== stingers that match the kits =====
  { slug: 'neon-success-sting', title: 'Neon Success Sting', kind: 'music', category: 'Jingles', bpm: 120, key: 'A minor', mood: 'Happy',
    tags: ['sting', 'success', 'win', 'jingle', 'synth', 'neon groove', 'transition'],
    description: 'A quick, bright synth flourish resolving upward. Matches the Neon Groove kit (A minor, 120 BPM) for wins and reveals.',
    render: () => { const f = sequence(grid([69, 72, 76, 79, 84], NB / 4, NB / 4).concat([{ note: 88, start: NB * 1.25, dur: NB * 2 }, { note: 84, start: NB * 1.25, dur: NB * 2 }, { note: 79, start: NB * 1.25, dur: NB * 2 }]),
      (n, lt) => (saw(midi(n.note) * lt) * 0.4 + tri(midi(n.note) * lt) * 0.4) * adsr(lt, 0.005, 0.2, 0.6, 0.6, n.dur), 0.8); const lp = lowpass(4000); const dl = delay(NB * 0.75, 0.3, 0.3); return render(NB * 5, (t) => dl(lp(f(t)))); } },
  { slug: 'neon-fail-sting', title: 'Neon Fail Sting', kind: 'music', category: 'Jingles', bpm: 120, key: 'A minor', mood: 'Sad',
    tags: ['sting', 'fail', 'lose', 'jingle', 'synth', 'neon groove', 'game over'],
    description: 'A short synth phrase that droops downward and fizzles. Matches the Neon Groove kit for losses and mistakes.',
    render: () => { const ph = phasor(); const lp = lowpass(2500); return render(NB * 4, (t) => { const i = Math.min(3, Math.floor(t / (NB * 0.5))); const note = [76, 72, 69, 68][i]; const bend = i === 3 ? -0.08 * Math.min(1, (t - 1.5 * NB) / NB) : 0;
      return lp(saw(ph(midi(note) * (1 + bend))) * 0.5) * (i < 3 ? expDecay(t % (NB * 0.5), 3) : expDecay(t - 1.5 * NB, 1.2)); }); } },
  { slug: 'epic-impact-sting', title: 'Epic Impact Sting', kind: 'music', category: 'Jingles', bpm: 100, key: 'D minor', mood: 'Epic',
    tags: ['sting', 'impact', 'hit', 'trailer', 'cinematic', 'epic trailer', 'boom'],
    description: 'One massive orchestral hit in D minor: taiko, low brass and choir together, with a long tail. Matches the Epic Trailer kit.',
    render: () => { const n = noise(3051); const lp = lowpass(600); const br = sequence([38, 45, 50, 53].map((note) => ({ note, start: 0, dur: 2.5, att: 0.03 })), brassV, 1.5); const ch = choirPad([50, 53, 57].map((note) => ({ note, start: 0, dur: 3 })), 4); const rv = reverb(0.4, 1.7);
      return render(5, (t) => rv(sin(55 * t + 3 * (1 - Math.exp(-20 * t))) * expDecay(t, 2) + lp(n()) * expDecay(t, 10) * 2 + br(t) * 0.8 + ch(t) * 0.5)); } },

  // ===== ambience layers (seamless, designed to stack) =====
  { slug: 'layer-light-rain', title: 'Light Rain Layer', kind: 'sfx', category: 'Ambience Layers', loopable: true, layer: true,
    tags: ['rain', 'light rain', 'drizzle', 'weather', 'layer', 'ambience', 'loop', 'relaxing'],
    description: 'A gentle, even drizzle with soft scattered drops. Built to sit under other layers without masking them.',
    render: () => { const p = pinkNoise(3101); const hp = highpass(1500); const lp = lowpass(7000); const r = rng(3102); const n = noise(3103); let d = 0;
      return loopRenderX(20, () => { if (r() < 0.0015) d = 0.3 + r() * 0.5; d *= 0.993; return lp(hp(p())) * 0.6 + hp(n()) * d * 0.3; }); } },
  { slug: 'layer-city-traffic', title: 'Distant City Traffic', kind: 'sfx', category: 'Ambience Layers', loopable: true, layer: true,
    tags: ['city', 'traffic', 'cars', 'urban', 'street', 'distant', 'layer', 'ambience', 'loop'],
    description: 'The low wash of a city a few blocks away: cars passing, a far-off horn and a constant urban rumble.',
    render: () => { const b = brownNoise(3111); const lp = lowpass(400); const p = pinkNoise(3112); const bp = bandpass(600, 1.5);
      const cars = [1.5, 5, 8.2, 11, 14.5, 17.8]; const horn = 9.6;
      return loopRenderX(20, (t) => { let pass = 0; for (const c of cars) pass += Math.exp(-((t - c) ** 2) / 0.9); const hn = t > horn && t < horn + 0.5 ? (square(330 * t) + square(415 * t)) * 0.03 * Math.sin(Math.PI * (t - horn) / 0.5) : 0;
        return lp(b()) * 1.8 + bp(p(), 400 + 500 * pass) * pass * 0.6 + hn; }); } },
  { slug: 'layer-cafe-murmur', title: 'Cafe Murmur', kind: 'sfx', category: 'Ambience Layers', loopable: true, layer: true,
    tags: ['cafe', 'coffee shop', 'restaurant', 'chatter', 'people', 'murmur', 'layer', 'ambience', 'loop'],
    description: 'A busy coffee shop: indistinct conversations all around, with the clink of cups and spoons now and then.',
    render: () => { const p = pinkNoise(3121); const f1 = bandpass(500, 2.5); const f2 = bandpass(1200, 3); const r = rng(3122);
      const clinks = scatter(3123, 20, 0.6).map((s) => ({ start: s, dur: 0.3, f: 2500 + r() * 2500 })); const cl = sequence(clinks, (c, lt) => metal(c.f, [1, 2.7, 4.2], 12)(lt), 0.3);
      return loopRenderX(20, (t) => { const v = 0.6 + 0.2 * Math.sin(TAU * 3.1 * t) * Math.sin(TAU * 1.7 * t + 1) + 0.2 * Math.sin(TAU * 4.3 * t + 2); const x = p(); return (f1(x, 450 + 150 * Math.sin(TAU * 2.3 * t)) + f2(x, 1100 + 300 * Math.sin(TAU * 1.9 * t)) * 0.6) * v * 1.5 + cl(t) * 0.12; }); } },
  { slug: 'layer-wind-trees', title: 'Wind in the Trees', kind: 'sfx', category: 'Ambience Layers', loopable: true, layer: true,
    tags: ['wind', 'trees', 'leaves', 'rustle', 'forest', 'breeze', 'layer', 'ambience', 'loop'],
    description: 'A steady breeze moving through leafy trees, swelling and easing with soft leaf rustles.',
    render: () => { const p = pinkNoise(3131); const bp = bandpass(700, 1.2); const n = noise(3132); const hp = highpass(3500);
      return loopRenderX(20, (t) => { const g = 0.5 + 0.3 * Math.sin(TAU * t / 10) + 0.2 * Math.sin(TAU * t / 4 + 1); return bp(p(), 500 + 400 * g) * g + hp(n()) * Math.max(0, g - 0.45) * 0.4; }); } },
  { slug: 'layer-room-tone', title: 'Room Tone with Air Conditioner', kind: 'sfx', category: 'Ambience Layers', loopable: true, layer: true,
    tags: ['room tone', 'air conditioner', 'hum', 'office', 'indoor', 'quiet', 'layer', 'ambience', 'loop'],
    description: 'The quiet sound of an indoor room: a soft air-conditioner hiss and a faint electrical hum. Great for filling silence in edits.',
    render: () => { const b = brownNoise(3141); const p = pinkNoise(3142); const lp = lowpass(1200); return loopRenderX(20, (t) => lp(p()) * 0.4 + b() * 0.3 + (sin(60 * t) * 0.04 + sin(120 * t) * 0.03 + sin(180 * t) * 0.01)); } },
  { slug: 'layer-underwater', title: 'Underwater', kind: 'sfx', category: 'Ambience Layers', loopable: true, layer: true,
    tags: ['underwater', 'ocean', 'diving', 'submerged', 'bubbles', 'deep', 'layer', 'ambience', 'loop'],
    description: 'Submerged and muffled: a deep, pressing rumble with slow currents and drifting bubbles.',
    render: () => { const b = brownNoise(3151); const lp = lowpass(300); const r = rng(3152); const bubs = scatter(3153, 20, 2.5).map((s) => ({ start: s, dur: 0.1, f: 300 + r() * 600 }));
      const bb = sequence(bubs, (x, lt) => sin(x.f * (1 + 4 * lt) * lt) * expDecay(lt, 30) * 0.4, 0.12); const lp2 = lowpass(1500);
      return loopRenderX(20, (t) => lp(b(), 180 + 80 * Math.sin(TAU * t / 5)) * 2.5 + lp2(bb(t))); } },
  { slug: 'layer-spaceship-interior', title: 'Spaceship Interior', kind: 'sfx', category: 'Ambience Layers', loopable: true, layer: true,
    tags: ['spaceship', 'starship', 'interior', 'hum', 'engine', 'sci-fi', 'bridge', 'layer', 'ambience', 'loop'],
    description: 'Inside a starship: a deep engine hum, circulating air and the odd soft computer chirp from the bridge.',
    render: () => { const p = pinkNoise(3161); const lp = lowpass(900); const chirps = sequence([2.2, 7.7, 13.1, 17.4].map((s, i) => ({ start: s, dur: 0.25, f: [1800, 1400, 2200, 1600][i] })), (x, lt) => sin(x.f * lt) * (lt < 0.08 || (lt > 0.12 && lt < 0.2) ? 1 : 0) * 0.08, 0);
      return loopRenderX(20, (t) => sin(50 * t) * 0.3 + sin(100 * t + 0.3) * 0.15 + saw(75 * t) * 0.04 + lp(p()) * 0.35 * (0.9 + 0.1 * Math.sin(TAU * t / 5)) + chirps(t)); } },
  { slug: 'layer-clock-shop', title: 'Clock Shop', kind: 'sfx', category: 'Ambience Layers', loopable: true, layer: true,
    tags: ['clocks', 'ticking', 'clock shop', 'time', 'tick tock', 'antique', 'layer', 'ambience', 'loop'],
    description: 'A room full of antique clocks, each ticking at its own pace, overlapping into a gentle mechanical rhythm.',
    render: () => { const n = noise(3171); const clocks = [[1, 2200, 0], [0.5, 3100, 0.13], [2, 1500, 0.31], [0.8, 2700, 0.47]];
      const hits = clocks.flatMap(([per, f, off]) => Array.from({ length: Math.round(20 / per) }, (_, i) => ({ start: off + i * per, dur: 0.05, f, g: i % 2 ? 0.7 : 1 })));
      const bp = bandpass(2500, 4); const f = sequence(hits, (h, lt) => h.g * (sin(h.f * lt) * 0.6 + n() * 0.4) * expDecay(lt, 120), 0.05); const rv = reverb(0.2, 0.9); return loopRenderX(20, (t) => rv(f(t))); } },

  // ===== creative effects =====
  { slug: 'magic-spell-cast', title: 'Magic Spell Cast', kind: 'sfx', category: 'Fantasy',
    tags: ['magic', 'spell', 'wizard', 'cast', 'fantasy', 'sparkle', 'whoosh', 'game'],
    description: 'A wizard casting a spell: a rising, glittering charge that bursts into a shower of sparkles.',
    render: () => { const r = rng(3201); const sparks = scatter(3202, 1.2, 50).map((s) => ({ start: 0.9 + s, dur: 0.2, f: 2500 + r() * 5000 })); const sp = sequence(sparks, (x, lt) => sin(x.f * lt) * expDecay(lt, 20), 0.2);
      const ph = phasor(); const n = noise(3203); const bp = bandpass(800, 3); const rv = reverb(0.4, 1.4);
      return render(2.8, (t) => rv((t < 0.9 ? sin(ph(300 * 2 ** (t * 3))) * (t / 0.9) * 0.35 + bp(n(), 400 + 3000 * t) * t * 0.4 : bp(n(), 2000) * expDecay(t - 0.9, 5) * 0.8) + sp(t) * 0.25)); } },
  { slug: 'portal-open', title: 'Portal Opening', kind: 'sfx', category: 'Fantasy',
    tags: ['portal', 'vortex', 'wormhole', 'rift', 'magic', 'sci-fi', 'swirl', 'fantasy'],
    description: 'A swirling portal tearing open: a deep drone swells while a whirling, resonant vortex spins faster and faster.',
    render: () => { const n = noise(3211); const bp = bandpass(500, 8); const b = brownNoise(3212); const lp = lowpass(200); const rv = reverb(0.4, 1.6);
      return render(4, (t) => { const x = Math.min(1, t / 3); const spin = 2 + 10 * x; return rv(bp(n(), 300 + 1500 * (0.5 + 0.5 * Math.sin(TAU * spin * t)) * (0.3 + x)) * x * 0.9 + lp(b()) * 2.5 * x + saw(55 * t) * 0.15 * x) * Math.min(1, (4 - t) * 3); }); } },
  { slug: 'potion-bubbling', title: 'Bubbling Potion', kind: 'sfx', category: 'Fantasy', loopable: true,
    tags: ['potion', 'cauldron', 'bubbling', 'brew', 'witch', 'magic', 'liquid', 'fantasy', 'loop'],
    description: 'A thick potion bubbling in a cauldron: wet, gloopy pops over a low simmer. Loops seamlessly.',
    render: () => { const r = rng(3221); const bubs = scatter(3222, 8, 9).map((s) => ({ start: s, dur: 0.12, f: 150 + r() * 400, g: 0.4 + r() * 0.6 })); const bb = sequence(bubs, (x, lt) => x.g * sin(x.f * (1 + 8 * lt) * lt) * Math.sin(Math.PI * Math.min(1, lt / 0.1)), 0); const b = brownNoise(3223); const lp = lowpass(500);
      return loopRender(8, (t) => bb(t) * 0.6 + lp(b()) * 0.8); } },
  { slug: 'crystal-sparkle', title: 'Crystal Sparkle', kind: 'sfx', category: 'Fantasy',
    tags: ['crystal', 'sparkle', 'twinkle', 'glitter', 'chime', 'magic', 'fairy', 'reveal'],
    description: 'A cascade of tiny crystal chimes tumbling down in pitch, glittering and delicate, like a fairy appearing.',
    render: () => { const notes = [96, 93, 91, 88, 86, 84, 81, 79].map((note, i) => ({ note, start: i * 0.07, dur: 1 })); const f = sequence(notes, (n, lt) => metal(midi(n.note), [1, 2.76, 5.4], 4)(lt), 1.2); const rv = reverb(0.45, 1.3); return render(2.2, (t) => rv(f(t) * 0.5)); } },
  { slug: 'heartbeat-accelerating', title: 'Heartbeat Speeding Up', kind: 'sfx', category: 'Horror',
    tags: ['heartbeat', 'pulse', 'panic', 'tension', 'fear', 'horror', 'suspense', 'anxiety'],
    description: 'A heartbeat that starts slow and calm, then races faster and louder as panic builds.',
    render: () => { const beats = []; let t = 0.1, bpm = 55; while (t < 7.5) { beats.push({ start: t, dur: 0.3, g: 0.5 + (bpm - 55) / 180 }); beats.push({ start: t + 60 / bpm * 0.28, dur: 0.3, g: (0.5 + (bpm - 55) / 180) * 0.7 }); t += 60 / bpm; bpm = Math.min(170, bpm * 1.12); }
      const lp = lowpass(150); const f = sequence(beats, (b, lt) => b.g * sin(48 * lt) * expDecay(lt, 14), 0.3); return render(8, (x) => lp(f(x)) * 3); } },
  { slug: 'glitch-ui-error', title: 'Glitch Error', kind: 'sfx', category: 'Interface',
    tags: ['glitch', 'error', 'digital', 'corrupt', 'ui', 'computer', 'hack', 'bug'],
    description: 'A digital error that stutters and corrupts: chopped, bit-crushed bleeps that cut out abruptly.',
    render: () => { const r = rng(3231); const segs = Array.from({ length: 10 }, (_, i) => ({ start: i * 0.045, f: 300 + r() * 1500, d: 0.03 })); let held = 0; let c = 0;
      return render(0.6, (t) => { const s = segs.find((x) => t >= x.start && t < x.start + x.d); if (!s) return 0; if (c++ % 6 === 0) held = square(s.f * t) * (r() > 0.2 ? 1 : 0); return Math.round(held * 4) / 4 * 0.5; }); } },
  { slug: 'hud-scan', title: 'HUD Scanner', kind: 'sfx', category: 'Sci-Fi',
    tags: ['scan', 'scanner', 'hud', 'analyze', 'interface', 'computer', 'sci-fi', 'targeting'],
    description: 'A sci-fi heads-up display scanning a target: a sweeping tone with ticking data clicks, ending in a confirm beep.',
    render: () => { const ph = phasor(); const rv = reverb(0.2); return render(2.2, (t) => { const sweep = t < 1.6 ? sin(ph(800 + 600 * Math.sin(TAU * 1.25 * t))) * 0.2 : 0; const tick = t < 1.6 && (t * 25) % 1 < 0.08 ? 0.3 * square(3000 * t) : 0; const conf = t > 1.65 ? sin(1760 * t) * expDecay(t - 1.65, 6) * 0.5 : 0; return rv(sweep + tick + conf); }); } },
  { slug: 'mechanical-keyboard', title: 'Mechanical Keyboard Typing', kind: 'sfx', category: 'Household',
    tags: ['keyboard', 'typing', 'mechanical', 'clicky', 'computer', 'office', 'keys', 'asmr'],
    description: 'Fast typing on a clicky mechanical keyboard, with a satisfying space bar thock every few words.',
    render: () => { const r = rng(3241); const keys = []; let t = 0.05; while (t < 3.8) { const space = r() < 0.15; keys.push({ start: t, dur: 0.06, space, f: 2500 + r() * 1500 }); t += space ? 0.18 : 0.07 + r() * 0.07; }
      const n = noise(3242); const bp = bandpass(3000, 2); const f = sequence(keys, (k, lt) => (k.space ? sin(180 * lt) * expDecay(lt, 40) * 0.8 : 0) + (bp(n(), k.f) * 2 + sin(k.f * 0.4 * lt) * 0.3) * expDecay(lt, 90) + (lt > 0.03 ? bp(n()) * expDecay(lt - 0.03, 120) : 0), 0.08); return render(4, f); } },
  { slug: 'coin-shower', title: 'Coin Shower', kind: 'sfx', category: 'Game',
    tags: ['coins', 'money', 'jackpot', 'treasure', 'reward', 'win', 'casino', 'game'],
    description: 'A jackpot of coins pouring out and bouncing: dozens of bright metallic pings tumbling over each other.',
    render: () => { const r = rng(3251); const coins = scatter(3252, 2.2, 30).map((s) => ({ start: s, dur: 0.3, f: 3000 + r() * 2500, g: 0.4 + r() * 0.6 })); const f = sequence(coins, (c, lt) => c.g * metal(c.f, [1, 1.47, 2.09], 10)(lt), 0.3); const rv = reverb(0.2); return render(2.8, (t) => rv(f(t) * 0.4)); } },
  { slug: 'vhs-rewind', title: 'VHS Rewind', kind: 'sfx', category: 'Transitions',
    tags: ['vhs', 'rewind', 'tape', 'retro', '80s', '90s', 'flashback', 'transition'],
    description: 'An old VHS tape rewinding: a fast, warbling, high-pitched chatter over mechanical whir, ending with a clunk.',
    render: () => { const n = noise(3261); const bp = bandpass(2000, 4); const ph = phasor(); const lp = lowpass(400);
      return render(2.4, (t) => { if (t > 2.1) return lp(n()) * expDecay(t - 2.1, 25) * 3; const w = Math.sin(TAU * 23 * t) * Math.sin(TAU * 7 * t); return bp(n(), 1500 + 1500 * w) * 0.6 + sin(ph(900 + 500 * w + 300 * t)) * 0.12 + saw(110 * t) * 0.05; }); } },
  { slug: 'record-scratch', title: 'Record Scratch', kind: 'sfx', category: 'Transitions',
    tags: ['record scratch', 'vinyl', 'dj', 'scratch', 'stop', 'freeze frame', 'comedy', 'transition'],
    description: 'A DJ scratching a vinyl record back and forth, the classic sound for a sudden stop or freeze-frame.',
    render: () => { const n = noise(3271); const bp = bandpass(1200, 3); return render(0.9, (t) => { const v = Math.sin(TAU * 4.5 * t) * (t < 0.7 ? 1 : 0); return bp(n(), 300 + 2500 * Math.abs(v)) * Math.abs(v) * 1.4; }); } },
  { slug: 'phone-vibrate-table', title: 'Phone Vibrating on a Table', kind: 'sfx', category: 'Household',
    tags: ['phone', 'vibrate', 'buzz', 'notification', 'table', 'cell phone', 'silent mode'],
    description: 'A phone on silent buzzing against a wooden table: two rattling bursts of vibration.',
    render: () => { const n = noise(3281); const bp = bandpass(900, 3); const lp = lowpass(1500); return render(2, (t) => { const on = (t > 0.05 && t < 0.6) || (t > 0.95 && t < 1.5); if (!on) return 0; const buzz = square(165 * t) * (0.7 + 0.3 * Math.sin(TAU * 31 * t)); return lp(buzz * 0.5 + bp(n()) * Math.max(0, buzz) * 1.2); }); } },
  { slug: 'elevator-ding', title: 'Elevator Ding', kind: 'sfx', category: 'Household',
    tags: ['elevator', 'lift', 'ding', 'arrival', 'bell', 'chime', 'hotel', 'office'],
    description: 'An elevator arriving at a floor: one clear, soft bell ding that rings out.',
    render: () => { const b = metal(1318, [1, 2.0, 3.01, 4.1], 1.3); const rv = reverb(0.2); return render(2, (t) => rv(b(t) * 0.6)); } },
  { slug: 'paper-crumple', title: 'Paper Crumple', kind: 'sfx', category: 'Foley',
    tags: ['paper', 'crumple', 'scrunch', 'throw away', 'trash', 'foley', 'crinkle'],
    description: 'A sheet of paper being crushed into a ball: a burst of crisp crackles and crinkles.',
    render: () => { const r = rng(3291); const n = noise(3292); const hp = highpass(2000); const crk = scatter(3293, 1.2, 70); let i = 0; let e = 0;
      return render(1.3, (t) => { while (i < crk.length && t >= crk[i]) { e = 0.4 + r() * 0.6; i++; } e *= 0.985; return hp(n()) * (e + 0.08 * Math.sin(Math.PI * Math.min(1, t / 1.2))); }); } },
  { slug: 'balloon-pop', title: 'Balloon Pop', kind: 'sfx', category: 'Cartoon',
    tags: ['balloon', 'pop', 'burst', 'party', 'bang', 'surprise', 'cartoon'],
    description: 'A party balloon bursting: one sharp, snappy bang with a quick rubbery flap.',
    render: () => { const n = noise(3301); const hp = highpass(800); return render(0.4, (t) => hp(n()) * expDecay(t, 45) * 1.5 + sin(140 * t) * expDecay(t, 35) * 0.6); } },
  { slug: 'water-splash', title: 'Drop Into Water', kind: 'sfx', category: 'Foley',
    tags: ['splash', 'water', 'drop', 'plop', 'pool', 'lake', 'dive', 'foley'],
    description: 'Something dropping into a pool: a deep "bloop" followed by a splash and settling ripples.',
    render: () => { const ph = phasor(); const n = noise(3311); const bp = bandpass(1500, 1); const r = rng(3312); const drops = scatter(3313, 1, 20).map((s) => ({ start: 0.15 + s, dur: 0.08, f: 800 + r() * 1500 })); const dr = sequence(drops, (d, lt) => sin(d.f * (1 + 3 * lt) * lt) * expDecay(lt, 40) * 0.3, 0.08);
      return render(1.6, (t) => sin(ph(250 + 900 * Math.min(1, t / 0.08))) * expDecay(t, 14) * 0.8 + bp(n(), 2500) * expDecay(t - 0.03, 6) * (t > 0.03 ? 0.7 : 0) + dr(t)); } },
  { slug: 'dial-up-modem', title: 'Dial-Up Modem', kind: 'sfx', category: 'Household',
    tags: ['modem', 'dial up', 'internet', 'retro', '90s', 'computer', 'nostalgia', 'connect'],
    description: 'A 90s modem connecting to the internet: dial tones, then a chaotic screech of handshake noise and static.',
    render: () => { const n = noise(3321); const bp = bandpass(1800, 2); const dtmf = [[697, 1209], [770, 1336], [852, 1477], [697, 1336], [941, 1336], [770, 1209]];
      return render(5, (t) => { if (t < 1.2) { const i = Math.floor(t / 0.2); const c = t % 0.2 < 0.12; const [a, b] = dtmf[i]; return c ? (sin(a * t) + sin(b * t)) * 0.3 : 0; }
        if (t < 2) return sin(2100 * t) * 0.35; if (t < 2.6) return (sin(1200 * t) * (Math.floor(t * 20) % 2) + sin(2400 * t) * (1 - Math.floor(t * 20) % 2)) * 0.3;
        return bp(n(), 1000 + 1500 * Math.abs(Math.sin(TAU * 3 * t))) * 0.7 + sin((1650 + 200 * Math.sin(TAU * 40 * t)) * t) * 0.15; }); } },
  { slug: 'countdown-321-go', title: 'Countdown 3-2-1 Go', kind: 'sfx', category: 'Game',
    tags: ['countdown', '3 2 1', 'go', 'race', 'start', 'beeps', 'timer', 'game'],
    description: 'A race-start countdown: three identical beeps one second apart, then a higher, longer "go" tone.',
    render: () => render(3.9, (t) => { const i = Math.floor(t); const lt = t - i; if (i < 3) return lt < 0.18 ? 0.4 * square(880 * t) * Math.min(1, (0.18 - lt) * 200) : 0; return lt < 0.75 ? 0.4 * square(1760 * t) * Math.min(1, (0.75 - lt) * 50) : 0; }) },
  { slug: 'tension-clock-loop', title: 'Ticking Tension Clock', kind: 'music', category: 'Cinematic', loopable: true, bpm: 120, mood: 'Tense',
    tags: ['clock', 'ticking', 'tension', 'countdown', 'suspense', 'timer', 'cinematic', 'loop'],
    description: 'A loud, tight tick-tock at 120 BPM with a low pulse underneath, for countdowns and suspense. Locks to the Neon Groove tempo.',
    render: () => { const n = noise(3331); const bp = bandpass(3000, 5); const bp2 = bandpass(2000, 5); const f = sequence(Array.from({ length: 16 }, (_, i) => ({ start: i * NB, dur: 0.05, hi: i % 2 === 0 })), (x, lt) => (x.hi ? bp(n()) : bp2(n())) * expDecay(lt, 90) * 3, 0.05);
      const pulse = sequence(Array.from({ length: 4 }, (_, i) => ({ start: i * 4 * NB, dur: 0.6 })), (x, lt) => sin(55 * lt) * expDecay(lt, 4), 0.6); return loopRender(16 * NB, (t) => f(t) + pulse(t) * 0.5); } },
];
