// Second batch of original sounds, synthesized from code and released as CC0 by Soundwell.
// Same rules as catalog.js: deterministic seeds, and a plain-language description for every sound.
import {
  render, phasor, sin, square, saw, tri, midi, noise, pinkNoise, brownNoise, lowpass, highpass,
  bandpass, delay, reverb, expDecay, adsr, sequence, rng,
} from './synth.js';
import { beat, kick, snare, piano, pad, grid, chords, drums } from './catalog.js';

const TAU = Math.PI * 2;
const sat = (x, k = 1.5) => Math.tanh(k * x);

/** Inharmonic struck-metal tone (bell, clang, chime). ratios/amps/decays per partial. */
function metal(f, ratios, rate = 3, amps = null) {
  return (lt) => {
    if (lt < 0) return 0;
    let s = 0;
    ratios.forEach((r, i) => { s += (amps ? amps[i] : 1 / (i + 1)) * sin(f * r * lt) * expDecay(lt, rate * (1 + i * 0.6)); });
    return s * Math.min(1, lt * 2000);
  };
}
const BELL = [1, 2, 2.4, 3, 4.2, 5.4];
const CLANG = [1, 2.76, 5.4, 8.93, 13.3];

/** Random event times: average `rate` per second over `len` seconds. */
function scatter(seed, len, rate, minGap = 0) {
  const r = rng(seed); const out = []; let t = r() / rate;
  while (t < len) { out.push(t); t += minGap + (-Math.log(1 - r()) / rate); }
  return out;
}

/** Additive brass voice: harmonics brighten with the envelope. */
function brass(n, lt) {
  const f = midi(n.note);
  const env = adsr(lt, 0.04, 0.15, 0.75, 0.25, n.dur);
  let s = 0;
  for (let k = 1; k <= 10; k++) s += sin(f * k * lt) * Math.exp(-k * (1.6 - env)) / k;
  return env * s * 0.6;
}
/** Bowed-string ensemble voice: detuned saws with a slow swell. */
function strings(n, lt) {
  const f = midi(n.note);
  const env = adsr(lt, 0.35, 0.3, 0.85, 0.6, n.dur);
  const vib = 0.003 * Math.sin(TAU * 5.2 * lt) * Math.min(1, lt);
  return env * (saw(f * (1 + vib) * lt) + saw(f * 1.004 * lt) + saw(f * 0.997 * lt)) * 0.18;
}
/** Long 808 bass drum with a pitch drop. */
function boom808(note = 33, decay = 1.6) {
  const f = midi(note);
  return (n, lt) => sat(sin(f * lt + 4 * (1 - Math.exp(-25 * lt))) * expDecay(lt, decay), 1.8);
}
/** Footstep: low thump + short gritty scuff. */
function step(seed, { body = 90, grit = 2500, weight = 1 } = {}) {
  const n = noise(seed); const bp = bandpass(grit, 1.5); const lp = lowpass(400);
  return (lt) => lt < 0 ? 0 : weight * (lp(n()) * 2.5 * expDecay(lt, 30) + sin(body * lt) * expDecay(lt, 40) * 0.6) + bp(n()) * expDecay(lt, 55) * 0.6;
}

export const CATALOG_MORE = [
  // ===================== SPORTS =====================
  {
    slug: 'referee-whistle', title: 'Referee Whistle', kind: 'sfx', category: 'Sports',
    tags: ['whistle', 'referee', 'sports', 'football', 'coach', 'gym', 'start', 'stop'],
    description: 'A sharp, trilling pea whistle: two short blasts and one long one, like a referee stopping play.',
    render: () => {
      const n = noise(1101); const bp = bandpass(3200, 6); const ph = phasor();
      const blasts = [[0, 0.18], [0.3, 0.18], [0.65, 0.9]];
      return render(1.75, (t) => {
        const on = blasts.find(([a, d]) => t >= a && t < a + d);
        if (!on) { ph(0); return 0; }
        const lt = t - on[0]; const env = Math.min(1, lt * 60) * Math.min(1, (on[1] - lt) * 40);
        const trill = 0.5 + 0.5 * sin(32 * lt);
        return env * (sin(ph(3150 + 180 * trill)) * (0.55 + 0.45 * trill) + bp(n()) * 0.25);
      });
    },
  },
  {
    slug: 'stadium-crowd-cheer', title: 'Stadium Crowd Cheer', kind: 'sfx', category: 'Sports',
    tags: ['crowd', 'cheer', 'stadium', 'applause', 'fans', 'touchdown', 'goal', 'sports', 'celebration'],
    description: 'A big stadium crowd erupting into a roar of cheers that swells, holds, and slowly settles. Celebratory.',
    render: () => {
      const p = pinkNoise(1111); const p2 = pinkNoise(1112); const n = noise(1113);
      const f1 = bandpass(550, 1.2); const f2 = bandpass(1100, 1.5); const f3 = bandpass(2600, 2); const hp = highpass(3000);
      const claps = scatter(1114, 6, 90); let ci = 0; let clap = 0;
      return render(6, (t) => {
        const swell = Math.min(1, t / 0.6) * (t < 3.5 ? 1 : Math.exp(-(t - 3.5) * 0.7));
        const wob = 0.8 + 0.2 * Math.sin(TAU * 0.7 * t) * Math.sin(TAU * 1.9 * t);
        if (ci < claps.length && t >= claps[ci]) { clap = 0.4 + 0.6 * ((ci * 7919) % 10) / 10; ci++; }
        clap *= 0.992;
        const voices = f1(p(), 520 + 60 * Math.sin(TAU * 0.3 * t)) * 1.1 + f2(p2(), 1050 + 120 * Math.sin(TAU * 0.5 * t)) * 0.9 + f3(p()) * 0.4;
        return swell * (voices * wob + hp(n()) * clap * 0.35);
      });
    },
  },
  {
    slug: 'stadium-crowd-ambience', title: 'Stadium Crowd Ambience', kind: 'sfx', category: 'Sports', loopable: true,
    tags: ['crowd', 'stadium', 'arena', 'murmur', 'fans', 'ambience', 'sports', 'background', 'loop'],
    description: 'The steady murmur of a packed stadium between plays, with scattered claps and distant shouts. Loops.',
    render: () => {
      const p = pinkNoise(1121); const f1 = bandpass(500, 1.3); const f2 = bandpass(1300, 2); const n = noise(1122); const hp = highpass(2500);
      const claps = scatter(1123, 12, 6); let ci = 0; let clap = 0;
      return render(12, (t) => {
        if (ci < claps.length && t >= claps[ci]) { clap = 0.5; ci++; }
        clap *= 0.99;
        const swell = 0.75 + 0.25 * Math.sin(TAU * t / 6) * Math.sin(TAU * t / 4);
        return (f1(p()) + f2(p()) * 0.5) * swell + hp(n()) * clap * 0.3;
      });
    },
  },
  {
    slug: 'stadium-air-horn', title: 'Stadium Air Horn', kind: 'sfx', category: 'Sports',
    tags: ['air horn', 'horn', 'stadium', 'hype', 'celebration', 'sports', 'blast', 'loud'],
    description: 'Three loud, brassy air-horn blasts, the last one held. Hype and celebration.',
    render: () => {
      const lp = lowpass(3500);
      const blasts = [[0, 0.25], [0.35, 0.25], [0.7, 1.1]];
      return render(1.95, (t) => {
        const on = blasts.find(([a, d]) => t >= a && t < a + d);
        if (!on) return lp(0);
        const lt = t - on[0]; const env = Math.min(1, lt * 80) * Math.min(1, (on[1] - lt) * 30);
        return env * sat(lp(saw(415 * t) + saw(523 * t) * 0.8 + saw(622 * t) * 0.6), 1.2);
      });
    },
  },
  {
    slug: 'game-clock-buzzer', title: 'Game Clock Buzzer', kind: 'sfx', category: 'Sports',
    tags: ['buzzer', 'end of game', 'shot clock', 'basketball', 'scoreboard', 'time up', 'sports'],
    description: 'A long, harsh, flat scoreboard buzzer that marks the end of a period. Loud and unmistakable.',
    render: () => { const lp = lowpass(2400); return render(1.6, (t) => lp(sat(square(110 * t) * 0.6 + saw(220.5 * t) * 0.4, 2)) * Math.min(1, t * 100)); },
  },
  {
    slug: 'football-kick-thump', title: 'Football Kick', kind: 'sfx', category: 'Sports',
    tags: ['kick', 'football', 'punt', 'field goal', 'ball', 'thump', 'sports', 'impact'],
    description: 'A solid leather thump of a foot striking a football, with a short airy follow-through.',
    render: () => {
      const n = noise(1131); const lp = lowpass(900); const bp = bandpass(700, 2);
      return render(0.6, (t) => lp(n()) * 3 * expDecay(t, 45) + sin(95 * t + 2 * (1 - Math.exp(-60 * t))) * expDecay(t, 22) * 0.9 + bp(n()) * 0.25 * Math.exp(-((t - 0.12) ** 2) / 0.004));
    },
  },
  {
    slug: 'basketball-bounce', title: 'Basketball Dribble', kind: 'sfx', category: 'Sports',
    tags: ['basketball', 'dribble', 'bounce', 'ball', 'gym', 'court', 'sports'],
    description: 'A basketball bouncing on a hardwood gym floor: a steady dribble, then a few quick settling bounces.',
    render: () => {
      const hits = [0, 0.5, 1, 1.5, 1.85, 2.1, 2.28, 2.4, 2.48];
      const n = noise(1141); const bp = bandpass(1400, 3);
      const f = sequence(hits.map((s, i) => ({ start: s, dur: 0.1, g: i < 4 ? 1 : 0.8 ** (i - 3) })), (h, lt) => h.g * (sin(140 * lt) * 0.9 + sin(300 * lt) * 0.35 + bp(n()) * 0.4) * expDecay(lt, 28), 0.25);
      return render(2.8, f);
    },
  },
  {
    slug: 'marching-snare-cadence', title: 'Marching Snare Cadence', kind: 'music', category: 'Drums', loopable: true,
    bpm: 112, mood: 'Energetic',
    tags: ['marching band', 'drumline', 'snare', 'cadence', 'football', 'halftime', 'sports', 'drums', 'loop'],
    description: 'A tight drumline cadence: crisp snare rolls and accents over a booming bass drum. Game-day energy.',
    render: () => {
      const b = beat(112); const s16 = b / 4;
      const ns = noise(1151); const hp = highpass(1200);
      const snr = (lt) => (hp(ns()) * 0.8 + sin(330 * lt) * 0.3) * expDecay(lt, 30);
      const pat = 'x.xxx.x.xxxx.x.xx.x.x.xxx.xxxxxx';
      const acc = 'x...x...x.......x...x...x...x...';
      const notes = [...pat.repeat(2)].map((c, i) => c === 'x' ? { start: i * s16, dur: s16, g: acc[i % 32] === 'x' ? 1 : 0.55 } : null).filter(Boolean);
      const sn = sequence(notes, (n, lt) => n.g * snr(lt), 0.15);
      const bd = sequence(grid([1, null, null, null, 1, null, 1, null, 1, null, null, null, 1, null, 1, 1].concat([1, null, null, null, 1, null, 1, null, 1, null, null, null, 1, null, null, null]), s16 * 2), (n, lt) => kick(lt) * 1.1, 0.4);
      const rv = reverb(0.15, 1.2);
      return render(64 * s16, (t) => rv(sn(t) * 0.7 + bd(t) * 0.8));
    },
  },
  {
    slug: 'victory-fanfare', title: 'Victory Fanfare', kind: 'music', category: 'Jingles',
    bpm: 120, key: 'C major', mood: 'Triumphant',
    tags: ['fanfare', 'victory', 'win', 'brass', 'trumpet', 'champion', 'celebration', 'sports', 'jingle'],
    description: 'A bold brass fanfare that climbs to a big, held major chord with a timpani roll. Winning-moment triumph.',
    render: () => {
      const b = beat(120);
      const mel = [{ note: 67, start: 0, dur: b * 0.5 }, { note: 67, start: b * 0.66, dur: b * 0.3 }, { note: 67, start: b, dur: b * 0.3 },
        { note: 72, start: b * 1.5, dur: b * 1.5 }, { note: 71, start: b * 3, dur: b * 0.5 }, { note: 72, start: b * 3.5, dur: b * 0.5 },
        { note: 76, start: b * 4, dur: b * 3 }];
      const harm = [60, 64, 67].map((note) => ({ note, start: b * 4, dur: b * 3 })).concat([{ note: 48, start: b * 4, dur: b * 3 }]);
      const tn = noise(1161); const lp = lowpass(200);
      const timp = (t) => (t > b * 2.5 && t < b * 4 ? lp(tn()) * 2.5 * ((t - b * 2.5) / (b * 1.5)) : 0) + (t >= b * 4 ? sin(65.4 * t) * expDecay(t - b * 4, 2.5) * 0.8 : 0);
      const f = sequence(mel.concat(harm), brass, 0.4); const rv = reverb(0.3, 1.3);
      return render(b * 7.6, (t) => rv(f(t) * 1.4 + timp(t) * 0.35));
    },
  },

  // ===================== NATURE =====================
  {
    slug: 'thunder-rumble', title: 'Thunder Rumble', kind: 'sfx', category: 'Nature',
    tags: ['thunder', 'storm', 'lightning', 'weather', 'rumble', 'rain', 'dramatic'],
    description: 'A sharp crack of nearby lightning followed by a long, rolling rumble of thunder fading into the distance.',
    render: () => {
      const b = brownNoise(1201); const n = noise(1202); const lp = lowpass(250); const lp2 = lowpass(3000);
      return render(7, (t) => {
        const crack = lp2(n()) * expDecay(t, 9) * 1.2;
        const roll = lp(b(), 120 + 200 * expDecay(t, 0.8)) * 3 * Math.min(1, t * 6) * expDecay(t, 0.45) * (0.7 + 0.3 * Math.sin(TAU * 1.3 * t) * Math.sin(TAU * 0.37 * t));
        return crack + roll;
      });
    },
  },
  {
    slug: 'forest-birds', title: 'Forest Birdsong', kind: 'sfx', category: 'Nature', loopable: true,
    tags: ['birds', 'birdsong', 'forest', 'morning', 'spring', 'nature', 'chirp', 'ambience', 'loop'],
    description: 'A bright spring morning in the woods: several small birds chirping and trilling over a soft breeze.',
    render: () => {
      const r = rng(1211); const calls = [];
      for (const t of scatter(1212, 11, 1.6, 0.15)) {
        const base = 2600 + r() * 2400; const kind = Math.floor(r() * 3); const notes = 2 + Math.floor(r() * 5);
        for (let k = 0; k < notes; k++) calls.push({ start: t + k * (0.07 + r() * 0.05), dur: 0.06, base, kind, g: 0.5 + r() * 0.5 });
      }
      const chirp = (c, lt) => {
        const x = lt / c.dur; if (x > 1) return 0;
        const sweep = c.kind === 0 ? 1 + 0.5 * x : c.kind === 1 ? 1.4 - 0.5 * x : 1 + 0.15 * Math.sin(TAU * 3 * x);
        return c.g * Math.sin(Math.PI * x) ** 2 * sin(c.base * sweep * lt);
      };
      const f = sequence(calls, chirp, 0); const p = pinkNoise(1213); const lp = lowpass(900); const rv = reverb(0.25, 1.2);
      return render(12, (t) => rv(f(t) * 0.35) + lp(p()) * 0.12);
    },
  },
  {
    slug: 'night-crickets', title: 'Night Crickets', kind: 'sfx', category: 'Nature', loopable: true,
    tags: ['crickets', 'night', 'summer', 'insects', 'countryside', 'nature', 'ambience', 'loop'],
    description: 'A warm summer night: a field of crickets chirping in steady pulses over a quiet, still background.',
    render: () => {
      const voices = [[4400, 0], [4700, 0.13], [4100, 0.31], [5000, 0.45]];
      const p = pinkNoise(1221); const lp = lowpass(500);
      return render(10, (t) => {
        let s = 0;
        for (const [f, off] of voices) {
          const cyc = (t + off) % 0.9; const burst = cyc < 0.24 ? 1 : 0;
          const pulse = Math.max(0, Math.sin(TAU * 30 * cyc)) ** 3;
          s += burst * pulse * sin(f * t) * 0.25;
        }
        return s + lp(p()) * 0.1;
      });
    },
  },
  {
    slug: 'babbling-brook', title: 'Babbling Brook', kind: 'sfx', category: 'Nature', loopable: true,
    tags: ['stream', 'brook', 'creek', 'water', 'river', 'flowing', 'relaxing', 'nature', 'ambience', 'loop'],
    description: 'A shallow stream trickling over stones, with gentle gurgles and bubbles. Calm and continuous.',
    render: () => {
      const p = pinkNoise(1231); const bp = bandpass(1200, 1); const r = rng(1232);
      const bubbles = scatter(1233, 10, 18).map((s) => ({ start: s, dur: 0.05, f: 500 + r() * 1100, g: 0.3 + r() * 0.5 }));
      const bub = sequence(bubbles, (b, lt) => b.g * sin(b.f * (1 + 6 * lt) * lt) * expDecay(lt, 45), 0.06);
      return render(10, (t) => bp(p(), 1000 + 400 * Math.sin(TAU * 0.4 * t)) * 0.9 + bub(t) * 0.3);
    },
  },
  {
    slug: 'heavy-rainstorm', title: 'Heavy Rainstorm', kind: 'sfx', category: 'Nature', loopable: true,
    tags: ['rain', 'storm', 'downpour', 'heavy rain', 'weather', 'thunder', 'ambience', 'loop'],
    description: 'A loud, dense downpour hammering the ground, with distant thunder rolling in the background.',
    render: () => {
      const n = noise(1241); const p = pinkNoise(1242); const hp = highpass(400); const lp = lowpass(9000); const b = brownNoise(1243); const lpb = lowpass(120);
      return render(14, (t) => lp(hp(n() * 0.6 + p())) * 0.8 + lpb(b()) * 3 * (0.3 + 0.7 * Math.max(0, Math.sin(TAU * t / 14)) ** 4));
    },
  },
  {
    slug: 'owl-hoot', title: 'Owl Hoot', kind: 'sfx', category: 'Nature',
    tags: ['owl', 'hoot', 'night', 'forest', 'spooky', 'bird', 'nature'],
    description: 'A soft, breathy owl calling twice in the night forest: a short hoot then a longer, wavering one.',
    render: () => {
      const n = noise(1251); const lp = lowpass(1200); const rv = reverb(0.35, 1.5);
      const hoot = (lt, len) => (lt < 0 || lt > len ? 0 : Math.sin(Math.PI * lt / len) ** 1.5) * (sin(390 * (1 - 0.05 * lt / len) * lt) + lp(n()) * 0.15);
      return render(2.6, (t) => rv(hoot(t, 0.3) + hoot(t - 0.55, 0.9) * (1 + 0.15 * Math.sin(TAU * 7 * t))) * 0.7);
    },
  },

  // ===================== FOLEY / HOUSEHOLD =====================
  {
    slug: 'footsteps-wood', title: 'Footsteps on Wood', kind: 'sfx', category: 'Foley',
    tags: ['footsteps', 'walking', 'steps', 'wood floor', 'indoor', 'foley', 'house'],
    description: 'Someone walking at a relaxed pace across a hollow wooden floor, eight steps.',
    render: () => {
      const r = rng(1301);
      const steps = Array.from({ length: 8 }, (_, i) => ({ start: 0.1 + i * 0.52 + r() * 0.04, dur: 0.2, w: i % 2 ? 0.85 : 1 }));
      const st = step(1302, { body: 110, grit: 1800 });
      const f = sequence(steps, (s, lt) => s.w * st(lt), 0.2); const rv = reverb(0.18, 0.8);
      return render(4.4, (t) => rv(f(t)));
    },
  },
  {
    slug: 'footsteps-gravel', title: 'Footsteps on Gravel', kind: 'sfx', category: 'Foley',
    tags: ['footsteps', 'walking', 'gravel', 'outdoor', 'path', 'crunch', 'foley'],
    description: 'Crunchy footsteps walking along a gravel path outdoors, each step a gritty crunch.',
    render: () => {
      const n = noise(1311); const bp = bandpass(3000, 1.2); const r = rng(1312);
      const steps = Array.from({ length: 8 }, (_, i) => ({ start: 0.05 + i * 0.5 + r() * 0.05, dur: 0.25 }));
      const f = sequence(steps, (s, lt) => {
        const grains = Math.max(0, Math.sin(TAU * 170 * lt + 9 * Math.sin(TAU * 23 * lt)));
        return bp(n()) * (0.4 + grains) * Math.min(1, lt * 120) * expDecay(lt, 14);
      }, 0.1);
      return render(4.3, f);
    },
  },
  {
    slug: 'running-footsteps', title: 'Running Footsteps', kind: 'sfx', category: 'Foley',
    tags: ['running', 'footsteps', 'sprint', 'chase', 'jogging', 'escape', 'foley'],
    description: 'Fast, urgent running footsteps on a hard floor, like someone sprinting down a hallway.',
    render: () => {
      const steps = Array.from({ length: 14 }, (_, i) => ({ start: 0.05 + i * 0.22, dur: 0.12, w: i % 2 ? 0.8 : 1 }));
      const st = step(1321, { body: 85, grit: 3000, weight: 1.2 });
      const f = sequence(steps, (s, lt) => s.w * st(lt), 0.15); const rv = reverb(0.2, 1);
      return render(3.3, (t) => rv(f(t)));
    },
  },
  {
    slug: 'door-creak', title: 'Creaky Door', kind: 'sfx', category: 'Household',
    tags: ['door', 'creak', 'squeak', 'hinge', 'haunted', 'old house', 'spooky', 'horror'],
    description: 'An old wooden door slowly swinging open on rusty hinges, with a long, wavering creak.',
    render: () => {
      const r = rng(1331); const b1 = bandpass(900, 8); const b2 = bandpass(2100, 10); const b3 = bandpass(3400, 12);
      let next = 0;
      return render(2.6, (t) => {
        const rate = 40 + 180 * Math.sin(Math.PI * Math.min(1, t / 2.4)) + 40 * Math.sin(TAU * 1.7 * t);
        let x = 0;
        if (t >= next) { x = 1; next = t + (1 / rate) * (0.85 + 0.3 * r()); }
        const env = Math.min(1, t * 8) * Math.min(1, (2.6 - t) * 3);
        return env * (b1(x) * 0.6 + b2(x) * 0.5 + b3(x) * 0.3) * 12;
      });
    },
  },
  {
    slug: 'glass-shatter', title: 'Glass Shatter', kind: 'sfx', category: 'Impacts',
    tags: ['glass', 'shatter', 'break', 'smash', 'window', 'crash', 'impact'],
    description: 'A pane of glass smashing: a bright crash followed by tinkling shards scattering on the floor.',
    render: () => {
      const r = rng(1341); const n = noise(1342); const hp = highpass(2500);
      const shards = scatter(1343, 2, 25).map((s) => ({ start: s * s * 0.8, dur: 0.08, f: 3000 + r() * 6000, g: (0.3 + r() * 0.7) * expDecay(s, 1.2) }));
      const tink = sequence(shards, (s, lt) => s.g * (sin(s.f * lt) + 0.5 * sin(s.f * 2.3 * lt)) * expDecay(lt, 40), 0.1);
      return render(2.2, (t) => hp(n()) * expDecay(t, 14) * 1.2 + sin(180 * t) * expDecay(t, 25) * 0.5 + tink(t) * 0.5);
    },
  },
  {
    slug: 'doorbell-ding-dong', title: 'Doorbell Ding-Dong', kind: 'sfx', category: 'Household',
    tags: ['doorbell', 'ding dong', 'bell', 'chime', 'visitor', 'front door', 'house'],
    description: 'A classic two-tone doorbell: a bright high "ding" followed by a lower, ringing "dong".',
    render: () => {
      const rv = reverb(0.25, 1);
      const ding = metal(midi(76), [1, 2, 3, 4.1], 1.6); const dong = metal(midi(72), [1, 2, 3, 4.1], 1.2);
      return render(2.6, (t) => rv(ding(t) * 0.6 + dong(t - 0.55) * 0.6));
    },
  },
  {
    slug: 'kettle-whistle', title: 'Kettle Whistle', kind: 'sfx', category: 'Household',
    tags: ['kettle', 'whistle', 'tea', 'boiling', 'kitchen', 'steam', 'house'],
    description: 'A stovetop kettle coming to the boil: a breathy hiss that rises into a shrill, steady whistle.',
    render: () => {
      const n = noise(1351); const bp = bandpass(1800, 3); const ph = phasor();
      return render(4, (t) => {
        const x = Math.min(1, t / 2.5);
        return bp(n(), 1500 + 900 * x) * (0.5 + 0.3 * x) + sin(ph(1700 + 500 * x + 25 * Math.sin(TAU * 6 * t))) * x * x * 0.5;
      });
    },
  },
  {
    slug: 'microwave-beeps', title: 'Microwave Beeps', kind: 'sfx', category: 'Household',
    tags: ['microwave', 'beep', 'kitchen', 'appliance', 'timer', 'done', 'house'],
    description: 'Three flat electronic beeps from a microwave oven telling you your food is ready.',
    render: () => render(1.5, (t) => { const c = t % 0.45; return c < 0.25 && t < 1.35 ? 0.5 * square(2000 * t) * Math.min(1, c * 300) * Math.min(1, (0.25 - c) * 300) : 0; }),
  },
  {
    slug: 'camera-shutter', title: 'Camera Shutter', kind: 'sfx', category: 'Household',
    tags: ['camera', 'shutter', 'photo', 'snapshot', 'click', 'picture', 'dslr'],
    description: 'The quick mechanical double-click of a camera shutter taking a photo.',
    render: () => {
      const n = noise(1361); const bp = bandpass(4000, 2); const bp2 = bandpass(1800, 2);
      return render(0.25, (t) => bp(n()) * expDecay(t, 120) * 2 + bp2(n()) * expDecay(t - 0.07, 90) * (t > 0.07 ? 2 : 0));
    },
  },
  {
    slug: 'zipper-pull', title: 'Zipper', kind: 'sfx', category: 'Foley',
    tags: ['zipper', 'zip', 'jacket', 'bag', 'clothing', 'foley'],
    description: 'A jacket zipper being pulled up in one quick, ratcheting zip.',
    render: () => {
      const n = noise(1371); const bp = bandpass(3500, 2); let next = 0;
      return render(0.7, (t) => {
        let x = 0; const rate = 120 + 500 * Math.sin(Math.PI * Math.min(1, t / 0.6));
        if (t >= next && t < 0.6) { x = 1; next = t + 1 / rate; }
        return bp(x * 3 + n() * 0.15) * Math.min(1, (0.62 - t) * 30);
      });
    },
  },
  {
    slug: 'page-turn', title: 'Page Turn', kind: 'sfx', category: 'Foley',
    tags: ['page', 'paper', 'book', 'turn', 'flip', 'reading', 'foley'],
    description: 'A single page of a paperback book being turned, a soft papery swish with a light flap at the end.',
    render: () => {
      const n = noise(1381); const bp = bandpass(2500, 1); const r = rng(1382); let crink = 0;
      return render(0.6, (t) => {
        if (r() < 0.004) crink = 1; crink *= 0.97;
        const env = Math.sin(Math.PI * Math.min(1, t / 0.45)) ** 2;
        return bp(n(), 1500 + 3000 * t) * env * (0.6 + crink) + (t > 0.42 ? n() * expDecay(t - 0.42, 60) * 0.5 : 0);
      });
    },
  },
  {
    slug: 'cash-register', title: 'Cash Register', kind: 'sfx', category: 'Household',
    tags: ['cash register', 'ka-ching', 'money', 'sale', 'purchase', 'shop', 'coins'],
    description: 'An old cash register: a mechanical clunk of the drawer opening and a bright bell "ching".',
    render: () => {
      const n = noise(1391); const lp = lowpass(800); const bell = metal(2600, BELL, 2.2); const rv = reverb(0.2);
      return render(1.6, (t) => rv(lp(n()) * expDecay(t, 25) * 2 + (t > 0.08 ? n() * expDecay(t - 0.08, 8) * 0.12 : 0) + bell(t - 0.12) * 0.5));
    },
  },
  {
    slug: 'car-horn', title: 'Car Horn', kind: 'sfx', category: 'Vehicles',
    tags: ['car', 'horn', 'honk', 'traffic', 'beep', 'vehicle', 'street'],
    description: 'A car horn honking twice, short then long. Impatient city traffic.',
    render: () => {
      const lp = lowpass(2000); const blasts = [[0, 0.2], [0.32, 0.7]];
      return render(1.1, (t) => {
        const on = blasts.find(([a, d]) => t >= a && t < a + d); if (!on) return lp(0);
        const lt = t - on[0];
        return lp(sat(square(405 * t) + square(507 * t), 1)) * Math.min(1, lt * 200) * Math.min(1, (on[1] - lt) * 100) * 0.6;
      });
    },
  },
  {
    slug: 'car-engine-start', title: 'Car Engine Start', kind: 'sfx', category: 'Vehicles',
    tags: ['car', 'engine', 'ignition', 'start', 'rev', 'motor', 'vehicle'],
    description: 'A car starter cranking, the engine catching, revving once, and settling into a low idle.',
    render: () => {
      const n = noise(1401); const lp = lowpass(600); const ph = phasor(); const hp = highpass(30);
      return render(4, (t) => hp(((t) => {
        if (t < 0.9) { const crank = Math.max(0, Math.sin(TAU * 9 * t)) ** 2; return lp(n()) * crank * 1.5 + sin(ph(60)) * crank * 0.3; }
        const lt = t - 0.9; const rpm = 30 + 70 * Math.exp(-((lt - 0.5) ** 2) / 0.12) + 10 * Math.exp(-lt * 3);
        const fire = Math.max(0, Math.sin(TAU * ph(rpm))) ** 4;
        return lp(fire * 1.2 + n() * 0.3 * fire, 400 + rpm * 6) * 1.6 * Math.min(1, lt * 20);
      })(t)));
    },
  },
  {
    slug: 'train-crossing-bell', title: 'Railroad Crossing Bell', kind: 'sfx', category: 'Vehicles',
    tags: ['train', 'railroad', 'crossing', 'bell', 'warning', 'ding', 'station'],
    description: 'A railroad crossing signal: a steady, fast ding-ding-ding of a warning bell.',
    render: () => {
      const bell = metal(1350, [1, 2.4, 3.9, 5.2], 5);
      const hits = Array.from({ length: 10 }, (_, i) => ({ start: i * 0.38, dur: 0.38 }));
      const f = sequence(hits, (h, lt) => bell(lt), 0.4); const rv = reverb(0.2);
      return render(4, (t) => rv(f(t) * 0.6));
    },
  },

  // ===================== CARTOON =====================
  {
    slug: 'cartoon-boing', title: 'Cartoon Boing', kind: 'sfx', category: 'Cartoon',
    tags: ['boing', 'spring', 'bounce', 'cartoon', 'funny', 'comedy', 'jump'],
    description: 'A springy, wobbling "boing" like a cartoon character bouncing off something. Silly and playful.',
    render: () => { const ph = phasor(); return render(0.9, (t) => sin(ph(180 + 120 * Math.sin(TAU * 14 * t) * expDecay(t, 3) + 80 * expDecay(t, 6))) * expDecay(t, 4) * 0.8); },
  },
  {
    slug: 'slide-whistle-up', title: 'Slide Whistle Up', kind: 'sfx', category: 'Cartoon',
    tags: ['slide whistle', 'whistle', 'rising', 'cartoon', 'funny', 'comedy', 'up'],
    description: 'A slide whistle gliding smoothly upward in pitch with a little wobble. Comic and goofy.',
    render: () => { const ph = phasor(); const n = noise(1501); const lp = lowpass(3000); return render(1.1, (t) => (sin(ph(500 * 2 ** (t * 1.8) * (1 + 0.01 * Math.sin(TAU * 6 * t)))) + lp(n()) * 0.05) * Math.min(1, t * 20) * Math.min(1, (1.1 - t) * 10) * 0.7); },
  },
  {
    slug: 'slide-whistle-down', title: 'Slide Whistle Down', kind: 'sfx', category: 'Cartoon',
    tags: ['slide whistle', 'whistle', 'falling', 'cartoon', 'funny', 'comedy', 'fail', 'down'],
    description: 'A slide whistle sliding down in pitch, the classic sound of something falling or failing.',
    render: () => { const ph = phasor(); return render(1.1, (t) => sin(ph(1600 * 2 ** (-t * 1.8) * (1 + 0.01 * Math.sin(TAU * 6 * t)))) * Math.min(1, t * 20) * Math.min(1, (1.1 - t) * 10) * 0.7); },
  },
  {
    slug: 'bubble-pop', title: 'Bubble Pop', kind: 'sfx', category: 'Cartoon',
    tags: ['pop', 'bubble', 'cork', 'cartoon', 'cute', 'ui', 'mouth pop'],
    description: 'A short, round, wet "bloop" pop, like a bubble bursting. Cute and light.',
    render: () => { const ph = phasor(); return render(0.18, (t) => sin(ph(300 + 2200 * t / 0.18)) * Math.sin(Math.PI * Math.min(1, t / 0.12)) * expDecay(t, 15)); },
  },
  {
    slug: 'cartoon-run-away', title: 'Cartoon Zip Away', kind: 'sfx', category: 'Cartoon',
    tags: ['zip', 'run', 'escape', 'fast', 'cartoon', 'dash', 'funny', 'whoosh'],
    description: 'A quick rising flurry of plinky notes ending in a whoosh, like a cartoon character dashing off-screen.',
    render: () => {
      const notes = grid([60, 64, 67, 72, 76, 79, 84, 88], 0.045, 0.04);
      const f = sequence(notes, (n, lt) => sin(midi(n.note) * lt) * expDecay(lt, 25), 0.1);
      const n = noise(1511); const bp = bandpass(1000, 2);
      return render(0.9, (t) => f(t) * 0.6 + (t > 0.3 ? bp(n(), 800 + 4000 * (t - 0.3)) * Math.sin(Math.PI * Math.min(1, (t - 0.3) / 0.6)) * 0.8 : 0));
    },
  },
  {
    slug: 'comedy-trombone-fail', title: 'Sad Trombone', kind: 'sfx', category: 'Cartoon',
    tags: ['fail', 'sad', 'trombone', 'wah wah', 'comedy', 'lose', 'oops', 'cartoon'],
    description: 'Four descending, droopy brass notes, the last one wobbling. The classic comic "you failed" sound.',
    render: () => {
      const b = 0.42; const notes = [{ note: 58, start: 0, dur: b * 0.85 }, { note: 57, start: b, dur: b * 0.85 }, { note: 56, start: b * 2, dur: b * 0.85 }, { note: 55, start: b * 3, dur: b * 2.2, wob: true }];
      const lp = lowpass(1400);
      const voice = (n, lt) => { const f = midi(n.note) * (n.wob ? 1 + 0.02 * Math.sin(TAU * 6 * lt) : 1); return brass({ ...n }, lt) * 0.3 + saw(f * lt) * adsr(lt, 0.05, 0.1, 0.6, 0.15, n.dur) * 0.25; };
      const f = sequence(notes, voice, 0.3);
      return render(b * 5.5, (t) => lp(f(t)));
    },
  },

  // ===================== SCI-FI =====================
  {
    slug: 'teleport-shimmer', title: 'Teleport Shimmer', kind: 'sfx', category: 'Sci-Fi',
    tags: ['teleport', 'beam', 'transport', 'magic', 'shimmer', 'sparkle', 'sci-fi', 'warp'],
    description: 'A sparkling, rising shimmer of glittering tones that swells and dissolves, like someone beaming away.',
    render: () => {
      const r = rng(1601); const sparks = scatter(1602, 1.8, 60).map((s) => ({ start: s, dur: 0.15, f: 1500 + r() * 5000 * (0.4 + s / 1.8) }));
      const f = sequence(sparks, (s, lt) => sin(s.f * lt) * expDecay(lt, 25), 0.15);
      const ph = phasor(); const rv = reverb(0.4, 1.3);
      return render(2.4, (t) => rv(f(t) * 0.25 * Math.sin(Math.PI * Math.min(1, t / 2)) + sin(ph(300 + 900 * t + 40 * Math.sin(TAU * 18 * t))) * 0.25 * Math.sin(Math.PI * Math.min(1, t / 1.9))));
    },
  },
  {
    slug: 'shield-up', title: 'Energy Shield Up', kind: 'sfx', category: 'Sci-Fi',
    tags: ['shield', 'force field', 'energy', 'barrier', 'power', 'sci-fi', 'defense'],
    description: 'A humming energy shield powering on: a resonant sweep upward that settles into a buzzing hum.',
    render: () => {
      const n = noise(1611); const bp = bandpass(400, 6);
      return render(2, (t) => { const x = Math.min(1, t / 0.6); return bp(n(), 300 + 2500 * x * (1 - x) * 4 * (t < 0.6 ? 1 : 0) + 300) * 0.8 + (saw(110 * t) * 0.15 + sin(220 * t) * 0.2) * x * (0.8 + 0.2 * Math.sin(TAU * 8 * t)) * Math.min(1, (2 - t) * 3); });
    },
  },
  {
    slug: 'robot-beeps', title: 'Robot Chatter', kind: 'sfx', category: 'Sci-Fi',
    tags: ['robot', 'droid', 'beeps', 'computer', 'chatter', 'bleep', 'sci-fi', 'cute'],
    description: 'A small, friendly robot "talking" in a quick string of bleeps, bloops, and chirps.',
    render: () => {
      const r = rng(1621); let t0 = 0; const notes = [];
      while (t0 < 1.6) { const d = 0.04 + r() * 0.1; notes.push({ start: t0, dur: d, f: 600 + r() * 1800, slide: (r() - 0.5) * 2 }); t0 += d + r() * 0.04; }
      const f = sequence(notes, (n, lt) => (lt < n.dur ? 1 : 0) * square(n.f * (1 + n.slide * lt / n.dur * 0.5) * lt) * 0.3, 0);
      const lp = lowpass(4000);
      return render(1.8, (t) => lp(f(t)));
    },
  },
  {
    slug: 'warp-drive', title: 'Warp Drive Jump', kind: 'sfx', category: 'Sci-Fi',
    tags: ['warp', 'hyperspace', 'jump', 'spaceship', 'engine', 'launch', 'sci-fi', 'whoosh'],
    description: 'A spaceship charging up with a rising whine, then blasting off with a deep boom and roar.',
    render: () => {
      const ph = phasor(); const n = noise(1631); const lp = lowpass(500); const b = brownNoise(1632);
      return render(3.5, (t) => {
        if (t < 1.5) return sin(ph(200 * 2 ** (t * 2.5))) * (t / 1.5) * 0.4 + lp(n(), 300 + t * 2000) * t * 0.3;
        const lt = t - 1.5;
        return sin(ph(45 + 30 * expDecay(lt, 4))) * expDecay(lt, 1.8) * 0.9 + lp(b(), 1500 * expDecay(lt, 1.5) + 100) * 2.5 * expDecay(lt, 1.2);
      });
    },
  },
  {
    slug: 'spaceship-door', title: 'Spaceship Door', kind: 'sfx', category: 'Sci-Fi',
    tags: ['door', 'spaceship', 'airlock', 'hydraulic', 'pneumatic', 'hiss', 'sci-fi', 'slide'],
    description: 'A sliding spaceship door: a pneumatic hiss, a smooth motorized slide, and a solid clunk.',
    render: () => {
      const n = noise(1641); const hp = highpass(2500); const lp = lowpass(300);
      return render(1.4, (t) => hp(n()) * expDecay(t, 6) * 0.6 + (t > 0.1 && t < 0.9 ? saw(90 * t + 10 * t * t) * 0.2 * Math.sin(Math.PI * (t - 0.1) / 0.8) : 0) + (t > 0.9 ? (lp(n()) * 3 + sin(70 * t) * 0.6) * expDecay(t - 0.9, 18) : 0));
    },
  },
  {
    slug: 'alien-ambience', title: 'Alien Planet Ambience', kind: 'sfx', category: 'Sci-Fi', loopable: true,
    tags: ['alien', 'planet', 'space', 'eerie', 'atmosphere', 'otherworldly', 'sci-fi', 'ambience', 'loop'],
    description: 'The air of a strange alien world: low wind, a pulsing hum, and odd distant chirps. Eerie and vast.',
    render: () => {
      const n = noise(1651); const bp = bandpass(300, 5); const r = rng(1652); const rv = reverb(0.5, 1.6);
      const calls = scatter(1653, 14, 0.8).map((s) => ({ start: s, dur: 0.6, f: 700 + r() * 900 }));
      const c = sequence(calls, (k, lt) => sin(k.f * (1 - 0.4 * lt) * lt + 3 * Math.sin(TAU * 11 * lt)) * Math.sin(Math.PI * Math.min(1, lt / 0.6)) * 0.3, 0);
      return render(14, (t) => rv(bp(n(), 250 + 120 * Math.sin(TAU * t / 7)) * 0.9 + sin(55 * t) * 0.25 * (0.6 + 0.4 * Math.sin(TAU * t / 3.5)) + c(t)));
    },
  },

  // ===================== GAME =====================
  {
    slug: 'retro-gem-pickup', title: 'Retro Gem Pickup', kind: 'sfx', category: 'Game',
    tags: ['pickup', 'gem', 'collect', 'item', '8bit', 'retro', 'reward', 'game'],
    description: 'A quick sparkly three-note arpeggio, rising. The sound of grabbing a gem in a retro game.',
    render: () => render(0.35, (t) => { const i = Math.min(3, Math.floor(t / 0.06)); const note = [76, 83, 88, 95][i]; return 0.3 * square(midi(note) * t) * expDecay(t, 6); }),
  },
  {
    slug: 'retro-laser-shot', title: 'Retro Laser Shot', kind: 'sfx', category: 'Game',
    tags: ['shoot', 'pew', 'laser', 'blaster', '8bit', 'retro', 'arcade', 'game'],
    description: 'A short, falling "pew" from an arcade spaceship blaster.',
    render: () => { const ph = phasor(); return render(0.22, (t) => 0.35 * square(ph(1800 * expDecay(t, 14) + 100)) * expDecay(t, 10)); },
  },
  {
    slug: 'retro-explosion', title: 'Retro 8-Bit Explosion', kind: 'sfx', category: 'Game',
    tags: ['explosion', 'boom', '8bit', 'retro', 'arcade', 'destroy', 'game'],
    description: 'A crunchy, low-fi arcade explosion: a burst of gritty noise that crumbles away.',
    render: () => {
      const n = noise(1701); let held = 0; let c = 0;
      return render(0.9, (t) => { const hold = Math.floor(8 + 60 * t); if (c++ % hold === 0) held = n(); return held * 0.6 * expDecay(t, 4); });
    },
  },
  {
    slug: 'menu-select', title: 'Menu Select Blip', kind: 'sfx', category: 'Game',
    tags: ['menu', 'select', 'cursor', 'blip', 'navigate', 'ui', 'game'],
    description: 'A tiny, clean blip for moving a cursor between menu options.',
    render: () => render(0.08, (t) => 0.4 * tri(1320 * t) * expDecay(t, 40)),
  },
  {
    slug: 'extra-life', title: 'Extra Life', kind: 'sfx', category: 'Game',
    tags: ['1up', 'extra life', 'bonus', 'reward', '8bit', 'retro', 'game'],
    description: 'A cheerful six-note rising chiptune jingle for earning a bonus life.',
    render: () => {
      const f = sequence(grid([76, 79, 88, 84, 86, 91], 0.09, 0.085), (n, lt) => 0.3 * square(midi(n.note) * lt) * (lt < n.dur ? 1 : 0), 0);
      return render(0.6, f);
    },
  },
  {
    slug: 'pause-jingle', title: 'Pause Sound', kind: 'sfx', category: 'Game',
    tags: ['pause', 'menu', 'stop', 'retro', 'ui', 'game'],
    description: 'Two quick, bright chiptune notes, down then up. Signals that the game is paused.',
    render: () => render(0.3, (t) => 0.3 * square(midi(t < 0.1 ? 84 : 91) * t) * (t % 0.1 < 0.085 ? 1 : 0) * (t < 0.2 ? 1 : expDecay(t - 0.2, 30))),
  },
  {
    slug: 'sword-clash', title: 'Sword Clash', kind: 'sfx', category: 'Impacts',
    tags: ['sword', 'clash', 'metal', 'blade', 'fight', 'medieval', 'clang', 'combat'],
    description: 'Two steel blades striking: a bright metallic clang with a long, shimmering ring.',
    render: () => {
      const ring = metal(1250, [1, 1.5, 2.73, 3.9, 5.6], 3.5); const n = noise(1711); const hp = highpass(3000);
      return render(1.5, (t) => ring(t) * 0.5 + hp(n()) * expDecay(t, 40) * 0.8);
    },
  },

  // ===================== IMPACTS & TRANSITIONS =====================
  {
    slug: 'metal-clang', title: 'Metal Clang', kind: 'sfx', category: 'Impacts',
    tags: ['metal', 'clang', 'pipe', 'hit', 'industrial', 'impact', 'bang'],
    description: 'A heavy metal pipe being struck, a hard clang that rings out with a hollow, inharmonic tone.',
    render: () => { const m = metal(240, CLANG, 2.5, [1, 0.8, 0.6, 0.4, 0.3]); const n = noise(1801); const lp = lowpass(3000); return render(2, (t) => m(t) * 0.6 + lp(n()) * expDecay(t, 60)); },
  },
  {
    slug: 'wood-knock-thud', title: 'Wooden Thud', kind: 'sfx', category: 'Impacts',
    tags: ['wood', 'thud', 'knock', 'hit', 'crate', 'box', 'impact'],
    description: 'A dull, solid thud of something hitting a wooden crate.',
    render: () => { const n = noise(1811); const bp = bandpass(380, 3); const lp = lowpass(1500); return render(0.4, (t) => bp(n()) * 4 * expDecay(t, 20) + sin(160 * t) * expDecay(t, 30) * 0.7 + lp(n()) * expDecay(t, 120) * 0.5); },
  },
  {
    slug: 'body-fall', title: 'Body Fall', kind: 'sfx', category: 'Foley',
    tags: ['fall', 'thud', 'body', 'drop', 'collapse', 'knockout', 'foley', 'impact'],
    description: 'A heavy, muffled thump of a body falling to the floor, with a short rustle of clothes.',
    render: () => { const n = noise(1821); const lp = lowpass(250); const bp = bandpass(2000, 1); return render(0.9, (t) => lp(n()) * 6 * expDecay(t, 14) + sin(55 * t) * expDecay(t, 10) * 0.8 + bp(n()) * 0.2 * expDecay(t - 0.05, 12) * (t > 0.05 ? 1 : 0)); },
  },
  {
    slug: 'cinematic-boom', title: 'Cinematic Boom', kind: 'sfx', category: 'Transitions',
    tags: ['boom', 'hit', 'trailer', 'cinematic', 'impact', 'bass drop', 'epic', 'transition'],
    description: 'A huge trailer-style impact: a deep sub-bass drop with a crashing hit and a long, dark tail.',
    render: () => {
      const n = noise(1831); const lp = lowpass(2000); const rv = reverb(0.4, 1.6); const ph = phasor();
      return render(4.5, (t) => rv(sin(ph(30 + 60 * expDecay(t, 5))) * expDecay(t, 0.9) * 1.1 + lp(n(), 4000 * expDecay(t, 3) + 200) * expDecay(t, 3) * 0.8));
    },
  },
  {
    slug: 'reverse-cymbal', title: 'Reverse Cymbal Swell', kind: 'sfx', category: 'Transitions',
    tags: ['reverse', 'cymbal', 'swell', 'riser', 'build up', 'transition', 'reverse crash'],
    description: 'A crash cymbal played backwards: a hissing shimmer that swells up and cuts off sharply.',
    render: () => { const n = noise(1841); const hp = highpass(4000); return render(2.2, (t) => hp(n()) * (t / 2.2) ** 3 * (0.8 + 0.2 * Math.sin(TAU * 13 * t)) * Math.min(1, (2.2 - t) * 200)); },
  },
  {
    slug: 'tape-stop', title: 'Tape Stop', kind: 'sfx', category: 'Transitions',
    tags: ['tape stop', 'slow down', 'power off', 'record scratch', 'stop', 'dj', 'transition'],
    description: 'Music grinding to a halt like a tape machine losing power, pitch sliding down to nothing.',
    render: () => {
      const ph1 = phasor(); const ph2 = phasor(); const ph3 = phasor(); const lp = lowpass(3000);
      return render(1.2, (t) => { const speed = Math.max(0, 1 - t / 1.1) ** 1.5; return lp(saw(ph1(220 * speed)) * 0.4 + saw(ph2(277 * speed)) * 0.3 + square(ph3(55 * speed)) * 0.3, 300 + 2700 * speed) * speed ** 0.5; });
    },
  },
  {
    slug: 'swoosh-deep', title: 'Deep Swoosh', kind: 'sfx', category: 'Transitions',
    tags: ['swoosh', 'whoosh', 'pass by', 'swing', 'transition', 'fast', 'air'],
    description: 'A deep, heavy whoosh of something big swinging past quickly.',
    render: () => { const n = noise(1851); const bp = bandpass(400, 1.5); return render(0.9, (t) => bp(n(), 200 + 900 * Math.sin(Math.PI * t / 0.9)) * Math.sin(Math.PI * t / 0.9) ** 2 * 2); },
  },

  // ===================== HORROR =====================
  {
    slug: 'ghostly-whispers', title: 'Ghostly Whispers', kind: 'sfx', category: 'Horror', loopable: true,
    tags: ['whisper', 'ghost', 'haunted', 'spooky', 'creepy', 'voices', 'horror', 'loop'],
    description: 'Breathy, unintelligible whispering voices drifting in and out in a dark, empty space. Unnerving.',
    render: () => {
      const n = noise(1901); const f1 = bandpass(700, 4); const f2 = bandpass(1500, 5); const f3 = bandpass(2800, 5); const rv = reverb(0.5, 1.5);
      return render(10, (t) => {
        const syl = Math.max(0, Math.sin(TAU * 3.3 * t + 2 * Math.sin(TAU * 0.7 * t))) * (0.4 + 0.6 * Math.max(0, Math.sin(TAU * t / 5)));
        const x = n();
        return rv((f1(x, 500 + 400 * Math.sin(TAU * 2.1 * t)) + f2(x, 1200 + 600 * Math.sin(TAU * 1.3 * t)) + f3(x) * 0.6) * syl * 1.2);
      });
    },
  },
  {
    slug: 'tension-stinger', title: 'Horror Tension Stinger', kind: 'sfx', category: 'Horror',
    tags: ['stinger', 'jump scare', 'tension', 'strings', 'shock', 'scary', 'horror', 'suspense'],
    description: 'A cluster of screeching, dissonant strings that crescendos fast and stabs, for a jump scare.',
    render: () => {
      const notes = [76, 77, 79, 80, 82].map((note) => ({ note, start: 0, dur: 1.8 }));
      const f = sequence(notes, (n, lt) => strings({ ...n }, lt), 0.8); const rv = reverb(0.35, 1.4); const lp = lowpass(5000);
      return render(2.6, (t) => rv(lp(f(t))) * (t < 1.5 ? (t / 1.5) ** 2 : 1) * 0.9);
    },
  },
  {
    slug: 'haunted-music-box', title: 'Haunted Music Box', kind: 'music', category: 'Ambient',
    bpm: 80, key: 'E minor', mood: 'Dark',
    tags: ['music box', 'creepy', 'haunted', 'horror', 'halloween', 'lullaby', 'spooky', 'detuned'],
    description: 'A slow, slightly out-of-tune music box playing a sad waltz that winds down. Creepy and childlike.',
    render: () => {
      const b = beat(80); const mel = [64, 67, 71, 69, 67, 66, 64, null, 59, 64, 67, 66, 64, 63, 64, null];
      const notes = grid(mel, b, b).map((n, i) => ({ ...n, start: n.start * (1 + i * 0.012) }));
      const f = sequence(notes, (n, lt) => { const fr = midi(n.note) * 2 * (1 + 0.008 * Math.sin(n.start * 9)); return (sin(fr * lt) + 0.3 * sin(fr * 4.1 * lt) * expDecay(lt, 8)) * expDecay(lt, 2.5); }, 1);
      const rv = reverb(0.4, 1.4);
      return render(b * 18, (t) => rv(f(t) * 0.4));
    },
  },

  // ===================== ALARMS =====================
  {
    slug: 'smoke-alarm', title: 'Smoke Alarm', kind: 'sfx', category: 'Alarms',
    tags: ['smoke alarm', 'fire alarm', 'beeping', 'warning', 'emergency', 'alert', 'loud'],
    description: 'A piercing smoke detector: three loud, high beeps, a pause, then three more.',
    render: () => render(3, (t) => { const c = t % 1.5; const on = c < 0.9 && c % 0.3 < 0.2; return on ? 0.4 * square(3150 * t) * Math.min(1, (c % 0.3) * 500) : 0; }),
  },
  {
    slug: 'school-bell', title: 'School Bell', kind: 'sfx', category: 'Alarms',
    tags: ['school bell', 'bell', 'ringing', 'class', 'recess', 'alarm', 'electric bell'],
    description: 'A loud electric school bell ringing continuously, a rapid metallic rattle, then stopping.',
    render: () => {
      const bell = metal(1050, [1, 2.3, 3.7, 5.1], 6);
      const hits = Array.from({ length: 50 }, (_, i) => ({ start: i * 0.05, dur: 0.05 }));
      const f = sequence(hits, (h, lt) => bell(lt), 0.5);
      return render(3, (t) => f(t) * 0.25);
    },
  },
  {
    slug: 'digital-watch-alarm', title: 'Digital Watch Alarm', kind: 'sfx', category: 'Alarms',
    tags: ['watch', 'alarm', 'beep', 'digital', 'wake up', 'timer', 'clock'],
    description: 'A tiny digital wristwatch alarm: quick pairs of thin, high beeps repeating.',
    render: () => render(2.4, (t) => { const c = t % 0.6; const on = (c < 0.07) || (c > 0.12 && c < 0.19); return on ? 0.35 * square(4096 * t) : 0; }),
  },
  {
    slug: 'game-show-correct', title: 'Game Show Correct', kind: 'sfx', category: 'Alarms',
    tags: ['correct', 'right answer', 'ding', 'game show', 'quiz', 'win', 'bell'],
    description: 'A bright, happy double bell "ding-ding" for a correct answer on a quiz show.',
    render: () => { const b1 = metal(1568, BELL, 2.5); const rv = reverb(0.25); return render(1.6, (t) => rv(b1(t) * 0.5 + b1(t - 0.18) * 0.5)); },
  },
  {
    slug: 'game-show-wrong', title: 'Game Show Wrong Buzzer', kind: 'sfx', category: 'Alarms',
    tags: ['wrong', 'incorrect', 'buzzer', 'game show', 'quiz', 'fail', 'error'],
    description: 'A loud, low, raspy buzzer for a wrong answer on a quiz show.',
    render: () => { const lp = lowpass(1600); return render(0.9, (t) => lp(sat(saw(98 * t) + saw(103 * t), 2)) * 0.6 * Math.min(1, (0.9 - t) * 20)); },
  },

  // ===================== MUSIC =====================
  {
    slug: 'trap-beat', title: 'Trap Beat', kind: 'music', category: 'Hip-Hop', loopable: true,
    bpm: 140, key: 'F minor', mood: 'Dark',
    tags: ['trap', 'hiphop', '808', 'beat', 'hi-hat rolls', 'rap', 'drums', 'loop'],
    description: 'A modern trap beat: booming 808 bass, sharp claps, and rattling hi-hat rolls over a dark bell melody.',
    render: () => {
      const b = beat(140); const s16 = b / 4;
      const nh = noise(2001); const hp = highpass(8000); const nc = noise(2002); const bpc = bandpass(1500, 1.5);
      const hatPat = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1];
      const hats = []; for (let bar = 0; bar < 4; bar++) hatPat.forEach((h, i) => { if (h) hats.push({ start: (bar * 32 + i) * s16 / 2, dur: 0.02 }); });
      const fh = sequence(hats, (n, lt) => nh() * expDecay(lt, 90), 0.05);
      const clapT = [8, 24, 40, 56].map((i) => ({ start: i * s16, dur: 0.1 }));
      const fc = sequence(clapT, (n, lt) => bpc(nc()) * (expDecay(lt, 25) + 0.6 * expDecay(lt - 0.012, 40) * (lt > 0.012 ? 1 : 0)), 0.2);
      const bassN = [0, 10, 16, 22, 32, 38, 48, 54].map((i, k) => ({ start: i * s16, dur: s16 * 6, note: [29, 29, 32, 27, 29, 29, 34, 32][k] }));
      const v808 = Object.fromEntries([27, 29, 32, 34].map((m) => [m, boom808(m, 1.3)]));
      const f8 = sequence(bassN, (n, lt) => v808[n.note](n, lt), 1.2);
      const mel = grid([77, null, 80, null, 84, null, 82, 80, null, null, 77, null, 75, null, null, null], s16 * 4);
      const bells = Object.fromEntries([75, 77, 80, 82, 84].map((m) => [m, metal(midi(m), BELL, 4)]));
      const fm = sequence(mel, (n, lt) => bells[n.note](lt), 0.6);
      const kk = sequence([0, 10, 16, 22, 32, 38, 48, 54].map((i) => ({ start: i * s16, dur: 0.2 })), (n, lt) => kick(lt), 0.3);
      return render(64 * s16, (t) => hp(fh(t)) * 0.35 + fc(t) * 0.6 + f8(t) * 0.55 + kk(t) * 0.5 + fm(t) * 0.12);
    },
  },
  {
    slug: 'drum-and-bass-break', title: 'Drum and Bass Break', kind: 'music', category: 'Drums', loopable: true,
    bpm: 174, mood: 'Energetic',
    tags: ['drum and bass', 'dnb', 'jungle', 'breakbeat', 'fast', 'drums', 'energetic', 'loop'],
    description: 'A fast, rolling drum-and-bass breakbeat with a deep, growling sub bass. Urgent and high-energy.',
    render: () => {
      const b = beat(174); const d = drums({ bpm: 174, bars: 4, k: 'x.........x.....', s: '....x.......x...', h: 'x.xxx.xxx.xxx.xx', seed: 2011 });
      const bass = sequence(grid([38, null, null, null, null, null, 38, null, 41, null, null, null, 36, null, null, null].concat([38, null, null, null, null, null, 38, null, 43, null, 41, null, 36, null, null, null]), b / 2, b / 2 * 1.6),
        (n, lt) => sat(sin(midi(n.note) * lt) + 0.3 * saw(midi(n.note) * lt), 1.5) * adsr(lt, 0.005, 0.2, 0.7, 0.1, n.dur), 0.2);
      const lp = lowpass(300);
      return render(16 * b, (t) => d(t) * 0.7 + lp(bass(t)) * 0.7);
    },
  },
  {
    slug: 'sad-piano', title: 'Sad Piano', kind: 'music', category: 'Cinematic', loopable: true,
    bpm: 66, key: 'A minor', mood: 'Sad',
    tags: ['piano', 'sad', 'emotional', 'melancholy', 'reflective', 'cinematic', 'slow', 'loop'],
    description: 'A slow, gentle solo piano in a minor key, with soft broken chords and a simple, aching melody.',
    render: () => {
      const b = beat(66); const prog = [[45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59], [40, 47, 52, 56]];
      const arps = prog.flatMap((ch, i) => [0, 1, 2, 3, 2, 1].map((k, j) => ({ note: ch[k], start: i * 4 * b + j * b * 2 / 3, dur: b })));
      const mel = [{ note: 76, start: 0, dur: 2 * b }, { note: 74, start: 2 * b, dur: b }, { note: 72, start: 3 * b, dur: b }, { note: 72, start: 4 * b, dur: 3 * b }, { note: 71, start: 7 * b, dur: b },
        { note: 71, start: 8 * b, dur: 2 * b }, { note: 74, start: 10 * b, dur: 2 * b }, { note: 71, start: 12 * b, dur: 3 * b }, { note: 68, start: 15 * b, dur: b }];
      const f = sequence(arps, piano, 2); const fm = sequence(mel, piano, 2); const rv = reverb(0.35, 1.4);
      return render(16 * b, (t) => rv(f(t) * 0.22 + fm(t) * 0.3));
    },
  },
  {
    slug: 'jazz-brush-groove', title: 'Jazz Brush Groove', kind: 'music', category: 'Jazz', loopable: true,
    bpm: 120, key: 'F major', mood: 'Relaxed',
    tags: ['jazz', 'swing', 'brushes', 'walking bass', 'lounge', 'cafe', 'smooth', 'loop'],
    description: 'A laid-back swing: brushed snare and ride cymbal with a warm walking upright bass. Cafe and lounge vibes.',
    render: () => {
      const b = beat(120); const sw = b * 2 / 3;
      const nr = noise(2021); const hp = highpass(6000); const nb = noise(2022); const bpb = bandpass(3000, 0.8);
      const ride = []; for (let i = 0; i < 16; i++) { ride.push({ start: i * b, dur: 0.3, g: 1 }); if (i % 2 === 1) ride.push({ start: i * b + sw, dur: 0.2, g: 0.6 }); }
      const fr = sequence(ride, (n, lt) => n.g * (hp(nr()) * 0.6 + 0.15 * sin(5100 * lt) + 0.1 * sin(7300 * lt)) * expDecay(lt, 9), 0.4);
      const brush = (t) => bpb(nb()) * (0.25 + 0.15 * Math.sin(TAU * t / b)) * 0.4 + ((t % (2 * b)) > b ? bpb(nb()) * expDecay((t % (2 * b)) - b, 12) * 0.7 : 0);
      const walk = [41, 45, 48, 50, 46, 50, 53, 51, 48, 52, 55, 52, 41, 43, 45, 47];
      const fb = sequence(grid(walk, b, b * 0.9), (n, lt) => (sin(midi(n.note) * lt) + 0.3 * sin(midi(n.note) * 2 * lt)) * expDecay(lt, 4) * Math.min(1, lt * 300), 0.2);
      const comp = sequence(chords([[53, 57, 60, 64], [58, 62, 65, 69], [60, 64, 67, 70], [53, 57, 60, 64]], 4 * b).map((n) => ({ ...n, start: n.start + sw, dur: b * 0.5 })), piano, 1);
      return render(16 * b, (t) => fr(t) * 0.35 + brush(t) + fb(t) * 0.55 + comp(t) * 0.1);
    },
  },
  {
    slug: 'uplifting-corporate', title: 'Uplifting Corporate', kind: 'music', category: 'Corporate', loopable: true,
    bpm: 118, key: 'G major', mood: 'Hopeful',
    tags: ['corporate', 'uplifting', 'positive', 'motivational', 'business', 'presentation', 'background', 'loop'],
    description: 'A bright, optimistic background track: plucky guitar-like patterns, warm pads, and a steady light beat.',
    render: () => {
      const b = beat(118); const s8 = b / 2;
      const prog = [[55, 59, 62], [52, 55, 59], [48, 52, 55], [50, 54, 57]];
      const plk = prog.flatMap((ch, i) => [0, 1, 2, 1, 0, 2, 1, 2].map((k, j) => ({ note: ch[k] + 12, start: i * 4 * b + j * s8, dur: s8 })));
      const fp = sequence(plk, (n, lt) => (sin(midi(n.note) * lt) * 0.6 + tri(midi(n.note) * 2 * lt) * 0.3) * expDecay(lt, 7), 0.4);
      const fpad = sequence(chords(prog, 4 * b), pad, 1); const lp = lowpass(1800); const dl = delay(s8 * 3 / 2, 0.3, 0.2);
      const d = drums({ bpm: 118, bars: 4, k: 'x.......x.x.....', s: '....x.......x...', h: '..x...x...x...x.', seed: 2031 });
      return render(16 * b, (t) => dl(fp(t)) * 0.3 + lp(fpad(t)) * 0.12 + d(t) * 0.35);
    },
  },
  {
    slug: 'cyberpunk-pulse', title: 'Cyberpunk Pulse', kind: 'music', category: 'Electronic', loopable: true,
    bpm: 100, key: 'D minor', mood: 'Dark',
    tags: ['cyberpunk', 'dark synth', 'electronic', 'pulse', 'futuristic', 'gritty', 'neon', 'loop'],
    description: 'A gritty, pulsing dark-synth groove: a driving sixteenth-note bass, heavy drums, and cold stabs.',
    render: () => {
      const b = beat(100); const s16 = b / 4;
      const roots = [38, 38, 34, 36];
      const bass = sequence(grid(roots.flatMap((r) => Array(16).fill(r).map((x, i) => (i % 4 === 3 ? x + 12 : x))), s16, s16 * 0.7), (n, lt) => sat(saw(midi(n.note) * lt) + saw(midi(n.note) * 1.01 * lt), 2) * expDecay(lt, 9), 0.05);
      const lp = lowpass(700);
      const stabs = sequence(roots.flatMap((r, i) => [r + 24, r + 27, r + 31].map((note) => ({ note, start: i * 4 * b + 1.5 * b, dur: s16 * 2 }))), (n, lt) => saw(midi(n.note) * lt) * expDecay(lt, 6), 0.3);
      const rv = reverb(0.35, 1.3);
      const d = drums({ bpm: 100, bars: 4, k: 'x.....x.x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', seed: 2041 });
      return render(16 * b, (t) => lp(bass(t), 400 + 400 * (0.5 + 0.5 * Math.sin(TAU * t / (4 * b)))) * 0.4 + rv(stabs(t)) * 0.12 + d(t) * 0.55);
    },
  },
  {
    slug: 'chiptune-boss-battle', title: 'Chiptune Boss Battle', kind: 'music', category: 'Chiptune', loopable: true,
    bpm: 168, key: 'E minor', mood: 'Intense',
    tags: ['chiptune', '8bit', 'boss', 'battle', 'intense', 'retro', 'game', 'action', 'loop'],
    description: 'A fast, urgent 8-bit battle theme in a minor key with a racing bass line. Final-boss tension.',
    render: () => {
      const b = beat(168); const s8 = b / 2;
      const mel = [76, 76, 79, 76, 81, 79, 76, 74, 76, null, 71, 74, 76, 79, 78, 74, 72, 72, 76, 72, 79, 76, 72, 71, 74, null, 78, 74, 71, 74, 75, 71];
      const bass = [40, 52, 40, 52, 40, 52, 40, 52, 47, 59, 47, 59, 47, 59, 47, 59, 36, 48, 36, 48, 36, 48, 36, 48, 35, 47, 35, 47, 39, 51, 39, 51];
      const fm = sequence(grid(mel, s8, s8 * 0.8), (n, lt) => 0.28 * square(midi(n.note) * lt) * (lt < n.dur ? 1 : 0), 0);
      const fb = sequence(grid(bass, s8, s8 * 0.7), (n, lt) => 0.32 * tri(midi(n.note) * lt) * (lt < n.dur ? 1 : 0), 0);
      const nn = noise(2051); let held = 0; let c = 0;
      const perc = sequence(grid(Array(32).fill(1).map((x, i) => (i % 2 ? 1 : null)), s8), (n, lt) => { if (c++ % 4 === 0) held = nn(); return held * 0.3 * expDecay(lt, 30); }, 0.05);
      return render(32 * s8, (t) => fm(t) + fb(t) + perc(t));
    },
  },
  {
    slug: 'tension-underscore', title: 'Tension Underscore', kind: 'music', category: 'Cinematic', loopable: true,
    bpm: 90, key: 'C minor', mood: 'Tense',
    tags: ['tension', 'suspense', 'thriller', 'strings', 'ostinato', 'cinematic', 'underscore', 'dark', 'loop'],
    description: 'A suspenseful underscore: low, pulsing string ostinato with a ticking pulse and a slow, rising drone.',
    render: () => {
      const b = beat(90); const s8 = b / 2;
      const ost = grid(Array(32).fill(0).map((_, i) => [48, 48, 51, 48, 50, 48, 51, 53][i % 8] - (i >= 16 ? 1 : 0)), s8, s8 * 0.8);
      const fo = sequence(ost, (n, lt) => saw(midi(n.note) * lt) * adsr(lt, 0.01, 0.1, 0.5, 0.05, n.dur), 0.05); const lp = lowpass(900);
      const drone = sequence([{ note: 36, start: 0, dur: 16 * b }, { note: 43, start: 8 * b, dur: 8 * b }], strings, 0.5);
      const tick = (t) => ((t % b) < 0.01 ? 1 : 0) * 0.4 + sin(3000 * (t % b)) * expDecay(t % b, 200) * 0.15;
      const rv = reverb(0.3, 1.4);
      return render(16 * b, (t) => rv(lp(fo(t)) * 0.3 + drone(t) * 0.25) + tick(t));
    },
  },
  {
    slug: 'bossa-nova-evening', title: 'Bossa Nova Evening', kind: 'music', category: 'Jazz', loopable: true,
    bpm: 132, key: 'D major', mood: 'Relaxed',
    tags: ['bossa nova', 'brazilian', 'latin', 'guitar', 'lounge', 'cafe', 'chill', 'loop'],
    description: 'A gentle bossa nova: syncopated nylon-guitar-style chords, a soft shaker, and a light bass. Breezy and warm.',
    render: () => {
      const b = beat(132); const s8 = b / 2;
      const prog = [[50, 54, 57, 61], [52, 55, 59, 62], [45, 49, 52, 55], [50, 54, 57, 61]];
      const comp = prog.flatMap((ch, i) => [0, 3, 6].flatMap((r) => ch.map((note) => ({ note, start: (i * 8 + r) * s8, dur: s8 * 0.9 }))));
      const fc = sequence(comp, (n, lt) => (sin(midi(n.note) * lt) * 0.6 + sin(midi(n.note) * 2 * lt) * 0.25 * expDecay(lt, 6)) * expDecay(lt, 4) * Math.min(1, lt * 600), 0.4);
      const bass = sequence(prog.flatMap((ch, i) => [{ note: ch[0] - 12, start: i * 4 * b, dur: b * 1.4 }, { note: ch[2] - 12, start: i * 4 * b + 1.5 * b, dur: b * 0.4 }, { note: ch[2] - 24, start: i * 4 * b + 2 * b, dur: b * 1.4 }, { note: ch[0] - 12, start: i * 4 * b + 3.5 * b, dur: b * 0.4 }]), (n, lt) => sin(midi(n.note) * lt) * expDecay(lt, 3), 0.2);
      const ns = noise(2061); const hp = highpass(6000);
      const shaker = sequence(grid(Array(32).fill(1), s8), (n, lt) => hp(ns()) * (0.5 + 0.5 * ((n.start / s8) % 2)) * expDecay(lt, 25), 0.1);
      const rim = sequence([3, 6, 10, 13, 19, 22, 26, 29].map((i) => ({ start: i * s8, dur: 0.05 })), (n, lt) => sin(1700 * lt) * expDecay(lt, 80), 0.05);
      return render(16 * b, (t) => fc(t) * 0.14 + bass(t) * 0.4 + shaker(t) * 0.25 + rim(t) * 0.2);
    },
  },
  {
    slug: 'lofi-rainy-day', title: 'Lo-fi Rainy Day', kind: 'music', category: 'Lo-fi', loopable: true,
    bpm: 75, key: 'E-flat major', mood: 'Calm',
    tags: ['lofi', 'chill', 'study', 'rain', 'relax', 'hiphop', 'mellow', 'cozy', 'loop'],
    description: 'A cozy lo-fi hip-hop loop: dusty, mellow jazz chords, a lazy beat, vinyl crackle, and soft rain.',
    render: () => {
      const b = beat(75);
      const prog = [[51, 55, 58, 62], [48, 51, 55, 58], [53, 56, 60, 63], [46, 50, 53, 56]];
      const fk = sequence(chords(prog, 4 * b).map((n) => ({ ...n, start: n.start + 0.02 * (n.note % 3) })), piano, 1.5);
      const d = drums({ bpm: 75, bars: 4, k: 'x......x..x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', seed: 2071 });
      const lp = lowpass(1600); const lpd = lowpass(3500); const r = rng(2072); const n = noise(2073); const p = pinkNoise(2074); const hp = highpass(1000);
      let crack = 0;
      return render(16 * b, (t) => { if (r() < 0.0006) crack = 0.6; crack *= 0.9; return lp(fk(t)) * 0.18 * (1 + 0.004 * Math.sin(TAU * 0.5 * t)) + lpd(d(t)) * 0.45 + n() * crack * 0.15 + hp(p()) * 0.05; });
    },
  },
  {
    slug: 'ambient-piano-space', title: 'Ambient Piano Space', kind: 'music', category: 'Ambient', loopable: true,
    bpm: 60, key: 'C major', mood: 'Peaceful',
    tags: ['ambient', 'piano', 'peaceful', 'sleep', 'meditation', 'spacious', 'calm', 'loop'],
    description: 'Sparse, gentle piano notes floating over a soft pad in a wide, echoing space. Peaceful and unhurried.',
    render: () => {
      const b = beat(60); const r = rng(2081); const scale = [60, 62, 64, 67, 69, 72, 74, 76, 79];
      const notes = []; for (let t = 0; t < 15; t += 0.75 + Math.floor(r() * 3) * 0.75) notes.push({ note: scale[Math.floor(r() * scale.length)], start: t, dur: 2 });
      const fp = sequence(notes, piano, 3); const fpad = sequence(chords([[48, 55, 60, 64], [45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59]], 4 * b), pad, 2);
      const rv = reverb(0.55, 1.7); const dl = delay(0.75, 0.4, 0.3); const lp = lowpass(900);
      return render(16 * b, (t) => rv(dl(fp(t) * 0.25) + lp(fpad(t)) * 0.12));
    },
  },
  {
    slug: 'reggae-skank', title: 'Island Reggae Groove', kind: 'music', category: 'World', loopable: true,
    bpm: 76, key: 'G major', mood: 'Relaxed',
    tags: ['reggae', 'island', 'caribbean', 'skank', 'one drop', 'summer', 'chill', 'loop'],
    description: 'A laid-back reggae groove: offbeat chord "skanks", a round, deep bass, and a one-drop beat.',
    render: () => {
      const b = beat(76);
      const prog = [[55, 59, 62], [55, 59, 62], [48, 52, 55], [50, 54, 57]];
      const skank = prog.flatMap((ch, i) => [0.5, 1.5, 2.5, 3.5].flatMap((o) => ch.map((note) => ({ note: note + 12, start: (i * 4 + o) * b, dur: 0.12 }))));
      const fs = sequence(skank, (n, lt) => (square(midi(n.note) * lt) * 0.3 + saw(midi(n.note) * lt) * 0.3) * expDecay(lt, 22), 0.1); const hp = highpass(500); const lp = lowpass(3000);
      const bassL = prog.flatMap((ch, i) => [{ note: ch[0] - 24, start: i * 4 * b, dur: b * 0.9 }, { note: ch[0] - 24, start: (i * 4 + 1.5) * b, dur: b * 0.4 }, { note: ch[1] - 24, start: (i * 4 + 2) * b, dur: b * 0.9 }, { note: ch[2] - 24, start: (i * 4 + 3) * b, dur: b * 0.9 }]);
      const fb = sequence(bassL, (n, lt) => sin(midi(n.note) * lt) * adsr(lt, 0.01, 0.2, 0.7, 0.08, n.dur), 0.1);
      const d = drums({ bpm: 76, bars: 4, k: '........x.......', s: '........x.......', h: 'x.x.x.x.x.x.x.x.', seed: 2091 });
      return render(16 * b, (t) => lp(hp(fs(t))) * 0.22 + fb(t) * 0.55 + d(t) * 0.5);
    },
  },
];
