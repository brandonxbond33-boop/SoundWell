// Seed catalog: original sounds synthesized from code, released as CC0 by Soundwell.
// Each entry carries a plain-language `description` so the library is usable by
// screen-reader users and Deaf/hard-of-hearing creators (and helps search).
import {
  render, phasor, sin, square, saw, tri, midi, noise, pinkNoise, brownNoise, lowpass, highpass,
  bandpass, delay, reverb, expDecay, adsr, sequence, rng,
} from './synth.js';

const beat = (bpm) => 60 / bpm;

// ---------- reusable voices ----------
function kick(lt) {
  return sin(50 * lt + 20 * (1 - Math.exp(-30 * lt))) * expDecay(lt, 7);
}
function hat(n) { return (lt) => 0.25 * n() * expDecay(lt, 70); }
function snare(n) { return (lt) => (0.55 * n() + 0.3 * sin(185 * lt)) * expDecay(lt, 18); }
function pluck(n, lt) { const f = midi(n.note); return (sin(f * lt) * 0.7 + tri(f * 2 * lt) * 0.2) * expDecay(lt, 5); }
function pad(n, lt) {
  const f = midi(n.note);
  const env = adsr(lt, 0.4, 0.5, 0.8, 1.2, n.dur);
  return env * (saw(f * lt) * 0.25 + saw(f * 1.006 * lt) * 0.25 + sin(f * 0.5 * lt) * 0.3);
}
function chip(n, lt) {
  const f = midi(n.note);
  return 0.35 * square(f * lt) * (lt < n.dur * 0.9 ? 1 : 0) * expDecay(lt, 1.5);
}
function piano(n, lt) {
  const f = midi(n.note);
  return (sin(f * lt) + 0.4 * sin(2 * f * lt) * expDecay(lt, 3) + 0.15 * sin(3 * f * lt) * expDecay(lt, 6))
    * expDecay(lt, 1.6) * Math.min(1, lt * 400);
}

/** Notes helper: pattern of MIDI numbers (null = rest) on a fixed step grid. */
function grid(pattern, step, dur = step) {
  return pattern.map((note, i) => (note == null ? null : { note, start: i * step, dur })).filter(Boolean);
}
/** Chord progression: each chord held for `len` seconds. */
function chords(list, len) {
  return list.flatMap((ch, i) => ch.map((note) => ({ note, start: i * len, dur: len * 0.95 })));
}

/** Drum pattern strings: x = hit, . = rest. Returns sample fn. */
function drums({ bpm, bars = 2, k = 'x...x...x...x...', s = '....x.......x...', h = 'x.x.x.x.x.x.x.x.', seed = 7 }) {
  const step = beat(bpm) / 4;
  const mk = (pat) => [...pat.repeat(bars)].map((c, i) => (c === 'x' ? { start: i * step, dur: step } : null)).filter(Boolean);
  const nh = noise(seed), ns = noise(seed + 1);
  const hp = highpass(7000);
  const fk = sequence(mk(k), (n, lt) => kick(lt), 0.4);
  const fs = sequence(mk(s), (n, lt) => snare(ns)(lt), 0.3);
  const fh = sequence(mk(h), (n, lt) => hat(nh)(lt), 0.1);
  return (t) => fk(t) * 0.9 + fs(t) * 0.6 + hp(fh(t)) * 0.8;
}

export const CATALOG = [
  // ===================== SOUND EFFECTS =====================
  {
    slug: 'soft-ui-click', title: 'Soft UI Click', kind: 'sfx', category: 'Interface',
    tags: ['click', 'button', 'tap', 'ui', 'minimal', 'interface'],
    description: 'A very short, soft, high-pitched tick, like tapping a glass screen.',
    render: () => render(0.12, (t) => sin(2100 * t) * expDecay(t, 70) + 0.3 * sin(4200 * t) * expDecay(t, 120)),
  },
  {
    slug: 'confirm-chime', title: 'Confirm Chime', kind: 'sfx', category: 'Interface',
    tags: ['success', 'confirm', 'chime', 'positive', 'notification', 'ui'],
    description: 'Two bright bell tones rising in pitch, friendly and reassuring. Signals success.',
    render: () => {
      const rv = reverb(0.2);
      const f = sequence([{ note: 81, start: 0, dur: 0.1 }, { note: 88, start: 0.1, dur: 0.5 }],
        (n, lt) => sin(midi(n.note) * lt) * expDecay(lt, 6), 0.8);
      return render(0.9, (t) => rv(f(t)));
    },
  },
  {
    slug: 'error-buzz', title: 'Error Buzz', kind: 'sfx', category: 'Interface',
    tags: ['error', 'wrong', 'denied', 'buzz', 'negative', 'ui'],
    description: 'A short, low, raspy double buzz that clearly says "no" or "wrong".',
    render: () => {
      const lp = lowpass(1800);
      return render(0.45, (t) => lp(0.6 * square(140 * t) * (t < 0.15 || (t > 0.2 && t < 0.38) ? 1 : 0)));
    },
  },
  {
    slug: 'notification-pop', title: 'Notification Pop', kind: 'sfx', category: 'Interface',
    tags: ['notification', 'pop', 'bubble', 'message', 'alert', 'ui'],
    description: 'A quick upward "bloop", like a bubble popping. Light and playful.',
    render: () => { const p = phasor(); return render(0.3, (t) => sin(p(500 + 1800 * t)) * expDecay(t, 14)); },
  },
  {
    slug: 'toggle-switch', title: 'Toggle Switch', kind: 'sfx', category: 'Interface',
    tags: ['toggle', 'switch', 'click', 'on', 'off', 'ui', 'mechanical'],
    description: 'Two tiny mechanical clicks close together, like flipping a light switch.',
    render: () => {
      const n = noise(3); const bp = bandpass(3200, 4);
      return render(0.18, (t) => bp(n()) * (expDecay(t, 200) + 0.7 * expDecay(t - 0.045, 220) * (t > 0.045)));
    },
  },
  {
    slug: 'typing-keyboard', title: 'Keyboard Typing', kind: 'sfx', category: 'Household',
    tags: ['typing', 'keyboard', 'keys', 'office', 'computer', 'clicks'],
    description: 'Irregular rapid clicking of a mechanical keyboard, as if someone is typing a sentence.',
    render: () => {
      const r = rng(11); const n = noise(12); const bp = bandpass(2600, 1.5);
      const hits = []; let t0 = 0.05;
      while (t0 < 3.6) { hits.push({ start: t0, dur: 0.02, g: 0.6 + r() * 0.4 }); t0 += 0.07 + r() * 0.16 + (r() < 0.08 ? 0.35 : 0); }
      const f = sequence(hits, (h, lt) => h.g * (n() * expDecay(lt, 140) + 0.4 * sin(900 * lt) * expDecay(lt, 90)), 0.06);
      return render(3.8, (t) => bp(f(t)) * 2);
    },
  },
  {
    slug: 'clock-ticking', title: 'Clock Ticking', kind: 'sfx', category: 'Household', loopable: true,
    tags: ['clock', 'tick', 'tock', 'time', 'waiting', 'suspense', 'loop'],
    description: 'A steady wall-clock tick-tock, one tick per second, alternating slightly different pitches.',
    render: () => {
      const n = noise(5); const bp = bandpass(3000, 6);
      return render(4, (t) => { const lt = t % 1; const f = Math.floor(t) % 2 ? 2400 : 3000; return bp(n(), f) * expDecay(lt, 160) * 3; });
    },
  },
  {
    slug: 'door-knock', title: 'Door Knock', kind: 'sfx', category: 'Household',
    tags: ['door', 'knock', 'wood', 'visitor', 'house'],
    description: 'Three firm knocks on a wooden door, evenly spaced.',
    render: () => {
      const n = noise(9); const lp = lowpass(900);
      const f = sequence([0, 0.22, 0.44].map((s) => ({ start: s, dur: 0.1 })),
        (h, lt) => (sin(170 * lt) * 0.8 + lp(n()) * 2) * expDecay(lt, 38), 0.2);
      return render(1, f);
    },
  },
  {
    slug: 'water-drip', title: 'Water Drip', kind: 'sfx', category: 'Household', loopable: true,
    tags: ['water', 'drip', 'drop', 'leak', 'cave', 'loop'],
    description: 'Single water droplets falling into a still pool with a rising "plip" and a little cave echo.',
    render: () => {
      const dl = delay(0.21, 0.35, 0.3);
      return render(3.2, (t) => {
        const m = t % 0.8;
        return dl(sin(600 * m + 1100 * m * m) * expDecay(m, 28) * (m < 0.25 ? 1 : 0));
      });
    },
  },
  {
    slug: 'phone-ringing', title: 'Phone Ringing', kind: 'sfx', category: 'Household',
    tags: ['phone', 'ring', 'telephone', 'call', 'landline'],
    description: 'A classic landline ring: a warbling two-tone ring for two seconds, then a pause, twice.',
    render: () => render(6, (t) => {
      const on = (t % 3) < 1.6 ? 1 : 0;
      const warble = (Math.floor(t * 40) % 2) ? 1 : 0.6;
      return on * warble * (sin(440 * t) + sin(480 * t)) * 0.4;
    }),
  },
  {
    slug: 'rain-on-window', title: 'Rain on a Window', kind: 'sfx', category: 'Nature', loopable: true,
    tags: ['rain', 'weather', 'storm', 'ambience', 'relaxing', 'window', 'loop'],
    description: 'Steady medium rain hissing against glass with occasional heavier droplets. Calm and continuous.',
    render: () => {
      const p = pinkNoise(21); const hp = highpass(700); const lp = lowpass(6000);
      const r = rng(22); const n = noise(23); let drop = 0;
      return render(10, () => {
        if (r() < 0.0009) drop = 0.6 + r() * 0.4;
        drop *= 0.996;
        return lp(hp(p())) * 0.9 + n() * drop * 0.25;
      });
    },
  },
  {
    slug: 'ocean-waves', title: 'Ocean Waves', kind: 'sfx', category: 'Nature', loopable: true,
    tags: ['ocean', 'sea', 'waves', 'beach', 'shore', 'ambience', 'relaxing', 'loop'],
    description: 'Slow waves rolling onto a sandy beach and washing back out, about every eight seconds.',
    render: () => {
      const b = brownNoise(31); const p = pinkNoise(32); const lp = lowpass(800);
      return render(16, (t) => {
        const swell = 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / 8);
        return b() * (0.2 + 0.8 * swell) * 0.8 + lp(p(), 300 + 2500 * swell) * swell * 0.9;
      });
    },
  },
  {
    slug: 'howling-wind', title: 'Howling Wind', kind: 'sfx', category: 'Nature', loopable: true,
    tags: ['wind', 'storm', 'gust', 'cold', 'winter', 'ambience', 'eerie', 'loop'],
    description: 'Cold wind gusting and whistling, rising and falling in pitch. Lonely and eerie.',
    render: () => {
      const n = noise(41); const bp = bandpass(500, 8); const b = brownNoise(42);
      return render(12, (t) => {
        const fc = 380 + 260 * Math.sin((2 * Math.PI * t) / 6) + 90 * Math.sin((2 * Math.PI * t) / 1.7);
        return bp(n(), fc) * 0.7 + b() * 0.35 * (0.6 + 0.4 * Math.sin((2 * Math.PI * t) / 4));
      });
    },
  },
  {
    slug: 'campfire-crackle', title: 'Campfire Crackle', kind: 'sfx', category: 'Nature', loopable: true,
    tags: ['fire', 'campfire', 'crackle', 'fireplace', 'cozy', 'ambience', 'loop'],
    description: 'A cozy fire: a low, soft roar with frequent small pops and snaps of burning wood.',
    render: () => {
      const b = brownNoise(51); const r = rng(52); const n = noise(53); const hp = highpass(1500);
      let pop = 0;
      return render(10, () => {
        if (r() < 0.0012) pop = 0.5 + r();
        pop *= 0.985;
        return b() * 0.45 + hp(n()) * pop;
      });
    },
  },
  {
    slug: 'heartbeat', title: 'Heartbeat', kind: 'sfx', category: 'Horror', loopable: true,
    tags: ['heart', 'heartbeat', 'pulse', 'tension', 'suspense', 'horror', 'body', 'loop'],
    description: 'A deep, muffled "lub-dub" heartbeat at a resting pace of about 67 beats per minute.',
    render: () => render(5.4, (t) => {
      const m = t % 0.9;
      return sin(48 * t) * (expDecay(m, 22) + 0.7 * (m >= 0.24 ? expDecay(m - 0.24, 26) : 0));
    }),
  },
  {
    slug: 'creepy-drone-hit', title: 'Creepy Stinger', kind: 'sfx', category: 'Horror',
    tags: ['horror', 'scary', 'stinger', 'jumpscare', 'dissonant', 'tension'],
    description: 'A sudden harsh, dissonant orchestral-like stab that swells and fades into an unsettling hum.',
    render: () => {
      const rv = reverb(0.4, 1.3); const n = noise(61); const lp = lowpass(3000);
      return render(4, (t) => {
        const env = Math.min(1, t * 60) * expDecay(t, 1.2);
        const tone = saw(110 * t) + saw(116.5 * t) + saw(155.6 * t) + 0.5 * saw(233 * t);
        return rv(lp(tone * 0.25 + n() * 0.3 * expDecay(t, 10)) * env);
      });
    },
  },
  {
    slug: 'laser-zap', title: 'Laser Zap', kind: 'sfx', category: 'Sci-Fi',
    tags: ['laser', 'zap', 'blaster', 'shoot', 'scifi', 'space', 'weapon', 'game'],
    description: 'A fast, bright "pew" that sweeps sharply downward in pitch. Classic sci-fi blaster.',
    render: () => { const p = phasor(); return render(0.4, (t) => (sin(p(1900 - 4200 * t)) * 0.6 + square(p(0) * 0.5) * 0.2) * expDecay(t, 7)); },
  },
  {
    slug: 'sonar-ping', title: 'Sonar Ping', kind: 'sfx', category: 'Sci-Fi',
    tags: ['sonar', 'ping', 'submarine', 'radar', 'underwater', 'echo'],
    description: 'A pure, clear ping followed by fading echoes, like a submarine sonar in deep water.',
    render: () => { const dl = delay(0.45, 0.5, 0.45); const rv = reverb(0.3, 1.4); return render(4, (t) => rv(dl(sin(1100 * t) * expDecay(t, 3.5) * Math.min(1, t * 300)))); },
  },
  {
    slug: 'power-up', title: 'Power Up', kind: 'sfx', category: 'Sci-Fi',
    tags: ['power', 'charge', 'startup', 'energy', 'rising', 'scifi', 'boot'],
    description: 'An electric hum that rises quickly in pitch and brightness, like a machine charging up.',
    render: () => { const p = phasor(); const lp = lowpass(500); return render(1.3, (t) => lp(saw(p(120 + 900 * t * t)), 400 + 6000 * t) * Math.min(1, t * 4) * expDecay(t - 1.1, 25)); },
  },
  {
    slug: 'power-down', title: 'Power Down', kind: 'sfx', category: 'Sci-Fi',
    tags: ['power', 'shutdown', 'off', 'fail', 'falling', 'scifi', 'battery'],
    description: 'A machine winding down: a whine that falls in pitch and fades into silence.',
    render: () => { const p = phasor(); const lp = lowpass(2000); return render(1.6, (t) => lp(saw(p(Math.max(20, 900 - 600 * t))), 3000 - 1800 * t) * expDecay(t, 1.6)); },
  },
  {
    slug: 'engine-hum-loop', title: 'Spaceship Engine Hum', kind: 'sfx', category: 'Sci-Fi', loopable: true,
    tags: ['engine', 'hum', 'spaceship', 'drone', 'machine', 'ambience', 'scifi', 'loop'],
    description: 'A deep, steady mechanical rumble with a faint pulsing throb, like the inside of a starship.',
    render: () => { const lp = lowpass(260); const b = brownNoise(71); return render(8, (t) => lp(0.5 * square(55 * t) + 0.4 * sin(110 * t) + 0.3 * b()) * (0.85 + 0.15 * Math.sin(2 * Math.PI * t))); },
  },
  {
    slug: 'radio-static', title: 'Radio Static', kind: 'sfx', category: 'Sci-Fi',
    tags: ['static', 'radio', 'noise', 'interference', 'transmission', 'tuning'],
    description: 'Crackly radio static that fades in and out with bursts of interference.',
    render: () => { const n = noise(81); const bp = bandpass(2200, 1.2); const r = rng(82); let g = 0.5; return render(5, () => { if (r() < 0.0004) g = 0.2 + r() * 0.8; return bp(n()) * g; }); },
  },
  {
    slug: 'glitch-burst', title: 'Digital Glitch', kind: 'sfx', category: 'Sci-Fi',
    tags: ['glitch', 'digital', 'error', 'corrupt', 'cyberpunk', 'computer', 'hack'],
    description: 'Rapid stuttering digital chirps and buzzes, like corrupted data or a hacked screen.',
    render: () => render(1.4, (t) => {
      const seg = Math.floor(t * 22);
      const f = [180, 1200, 420, 2600, 90, 760][seg % 6];
      return square(f * t) * ((t * 22) % 1 < 0.65 ? 0.5 : 0) * (seg % 5 === 3 ? 0 : 1);
    }),
  },
  {
    slug: 'retro-coin', title: 'Retro Coin Pickup', kind: 'sfx', category: 'Game',
    tags: ['coin', 'pickup', 'collect', 'retro', '8bit', 'chiptune', 'game', 'reward'],
    description: 'Two quick bright square-wave notes jumping up, the classic 8-bit "collect a coin" sound.',
    render: () => render(0.5, (t) => 0.4 * square((t < 0.07 ? 988 : 1319) * t) * (t < 0.07 ? 1 : expDecay(t - 0.07, 8))),
  },
  {
    slug: 'retro-jump', title: 'Retro Jump', kind: 'sfx', category: 'Game',
    tags: ['jump', 'retro', '8bit', 'platformer', 'game', 'boing'],
    description: 'A springy 8-bit "boing" that quickly slides upward in pitch.',
    render: () => { const p = phasor(); return render(0.35, (t) => 0.4 * square(p(180 + 1800 * t)) * expDecay(t, 5)); },
  },
  {
    slug: 'retro-hurt', title: 'Retro Damage Hit', kind: 'sfx', category: 'Game',
    tags: ['hurt', 'damage', 'hit', 'retro', '8bit', 'game', 'ouch'],
    description: 'A crunchy 8-bit noise burst that drops in pitch, signaling the player took damage.',
    render: () => { const n = noise(91); let held = 0; return render(0.4, (t, i) => { if (i % Math.round(8 + t * 80) === 0) held = n(); return held * 0.5 * expDecay(t, 6); }); },
  },
  {
    slug: 'level-up-fanfare', title: 'Level Up Fanfare', kind: 'sfx', category: 'Game',
    tags: ['level', 'levelup', 'victory', 'win', 'fanfare', 'achievement', 'game', 'retro', 'jingle'],
    description: 'A short, triumphant ascending run of chiptune notes ending on a held high note.',
    render: () => { const notes = grid([72, 76, 79, 84, 79, 84], 0.09); notes[notes.length - 1].dur = 0.6; return render(1.3, sequence(notes, chip, 0.3)); },
  },
  {
    slug: 'game-over', title: 'Game Over', kind: 'sfx', category: 'Game',
    tags: ['game over', 'lose', 'fail', 'death', 'sad', 'retro', 'game', 'jingle'],
    description: 'A slow, descending sequence of sad chiptune notes, ending low. Clearly a defeat.',
    render: () => { const notes = grid([67, 66, 65, 64], 0.32, 0.3); notes[3].dur = 0.9; return render(2.4, sequence(notes, (n, lt) => chip(n, lt) * (0.8 + 0.2 * sin(6 * lt)), 0.4)); },
  },
  {
    slug: 'explosion-deep', title: 'Deep Explosion', kind: 'sfx', category: 'Impacts',
    tags: ['explosion', 'boom', 'blast', 'bomb', 'impact', 'action', 'rumble'],
    description: 'A big, deep boom with a sharp crack at the start and a long rumbling tail.',
    render: () => { const b = brownNoise(101); const n = noise(102); const lp = lowpass(500); const rv = reverb(0.3, 1.5); return render(3, (t) => rv(lp(b() * 2 + n() * expDecay(t, 25) * 2, 120 + 2500 * expDecay(t, 4)) * expDecay(t, 1.3) * Math.min(1, t * 400))); },
  },
  {
    slug: 'punch-impact', title: 'Punch Impact', kind: 'sfx', category: 'Impacts',
    tags: ['punch', 'hit', 'fight', 'impact', 'thud', 'action', 'combat'],
    description: 'A short, heavy, meaty thump, like a fist landing a solid hit.',
    render: () => { const n = noise(111); const lp = lowpass(1200); return render(0.5, (t) => (sin(60 * t + 8 * (1 - Math.exp(-40 * t))) * expDecay(t, 14) + lp(n()) * expDecay(t, 40) * 1.5)); },
  },
  {
    slug: 'whoosh-swipe', title: 'Fast Whoosh', kind: 'sfx', category: 'Transitions',
    tags: ['whoosh', 'swoosh', 'swipe', 'transition', 'fast', 'motion', 'air'],
    description: 'A quick rush of air sweeping past from one side to the other. Great for scene transitions.',
    render: () => { const n = noise(121); const bp = bandpass(800, 1.5); return render(0.9, (t) => bp(n(), 300 + 3000 * Math.sin(Math.PI * t / 0.9)) * Math.sin(Math.PI * t / 0.9) ** 2 * 1.5); },
  },
  {
    slug: 'cinematic-riser', title: 'Cinematic Riser', kind: 'sfx', category: 'Transitions',
    tags: ['riser', 'build', 'tension', 'trailer', 'cinematic', 'transition', 'swell'],
    description: 'A six-second build of noise and climbing tones that grows louder and higher, then cuts off.',
    render: () => { const n = noise(131); const bp = bandpass(400, 2); const p = phasor(); const p2 = phasor(); return render(6, (t) => { const k = t / 6; return (bp(n(), 300 + 6000 * k * k) * 0.6 + saw(p(110 * 2 ** (k * 3))) * 0.15 + saw(p2(111.5 * 2 ** (k * 3))) * 0.15) * k * k; }); },
  },
  {
    slug: 'countdown-beeps', title: 'Countdown Beeps', kind: 'sfx', category: 'Alarms',
    tags: ['countdown', 'beep', 'timer', 'race', 'start', 'go'],
    description: 'Three short medium beeps one second apart, then one long higher beep: "3, 2, 1, go!"',
    render: () => render(4, (t) => (t < 3 ? sin(880 * t) * ((t % 1) < 0.15 ? 1 : 0) : sin(1760 * t) * (t < 3.7 ? 1 : 0)) * 0.6),
  },
  {
    slug: 'alarm-siren', title: 'Alarm Siren', kind: 'sfx', category: 'Alarms', loopable: true,
    tags: ['alarm', 'siren', 'emergency', 'warning', 'alert', 'danger', 'loop'],
    description: 'A loud electronic siren sweeping up and down in pitch, urgent and attention-grabbing.',
    render: () => { const p = phasor(); return render(4, (t) => tri(p(700 + 400 * Math.sin(2 * Math.PI * t / 2))) * 0.6); },
  },
  {
    slug: 'temple-bell', title: 'Temple Bell', kind: 'sfx', category: 'Alarms',
    tags: ['bell', 'gong', 'temple', 'meditation', 'zen', 'ring', 'calm'],
    description: 'One deep, rich bell strike with a shimmering overtone that rings out for several seconds.',
    render: () => { const rv = reverb(0.3, 1.6); return render(6, (t) => rv((0.5 * sin(196 * t) + 0.3 * sin(196 * 2.76 * t) * expDecay(t, 1.5) + 0.2 * sin(196 * 5.4 * t) * expDecay(t, 3) + 0.15 * sin(197.5 * t)) * expDecay(t, 0.8) * Math.min(1, t * 500))); },
  },

  // ===================== MUSIC =====================
  {
    slug: 'lofi-study-chords', title: 'Lo-fi Study Chords', kind: 'music', category: 'Lo-fi', loopable: true,
    bpm: 80, key: 'C major', mood: 'Calm',
    tags: ['lofi', 'chill', 'study', 'chords', 'relaxing', 'jazzy', 'background', 'loop'],
    description: 'Warm, mellow electric-piano chords (Cmaj7, Am7, Fmaj7, G7) over a lazy drum beat. Cozy and relaxed.',
    render: () => {
      const b = beat(80); const len = 4 * b;
      const prog = chords([[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]], len);
      const keys = sequence(prog, (n, lt) => piano(n, lt) * 0.18, 1.5);
      const d = drums({ bpm: 80, bars: 4, k: 'x.....x...x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' });
      const lp = lowpass(3500); const n = noise(141);
      return render(4 * len, (t) => lp(keys(t) + d(t) * 0.45) + n() * 0.004);
    },
  },
  {
    slug: 'dark-ambient-drone', title: 'Dark Ambient Drone', kind: 'music', category: 'Ambient', loopable: true,
    key: 'A minor', mood: 'Dark',
    tags: ['dark', 'drone', 'ambient', 'horror', 'tension', 'space', 'underscore', 'loop'],
    description: 'A slow, deep, evolving low drone with distant dissonant overtones. Brooding and unsettling.',
    render: () => { const rv = reverb(0.45, 1.6); const lp = lowpass(700); return render(20, (t) => rv(lp(0.4 * saw(55 * t) + 0.3 * saw(55.4 * t) + 0.2 * sin(82.4 * t + 0.3 * Math.sin(0.4 * t)) + 0.12 * sin(116.5 * t) * (0.5 + 0.5 * Math.sin(2 * Math.PI * t / 10)), 400 + 200 * Math.sin(2 * Math.PI * t / 20)))); },
  },
  {
    slug: 'calm-meditation-pad', title: 'Calm Meditation Pad', kind: 'music', category: 'Ambient', loopable: true,
    key: 'D major', mood: 'Calm',
    tags: ['meditation', 'calm', 'pad', 'ambient', 'yoga', 'sleep', 'peaceful', 'loop'],
    description: 'Soft, airy synth chords gently swelling in and out. Peaceful, spacious, and slow.',
    render: () => { const rv = reverb(0.5, 1.5); const lp = lowpass(1500); const prog = chords([[50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61]], 4); const f = sequence(prog, pad, 1.5); return render(16, (t) => rv(lp(f(t) * 0.25))); },
  },
  {
    slug: 'driving-house-beat', title: 'Driving House Beat', kind: 'music', category: 'Drums', loopable: true,
    bpm: 124, mood: 'Energetic',
    tags: ['house', 'drums', 'beat', 'dance', 'edm', 'four on the floor', 'club', 'loop'],
    description: 'A punchy four-on-the-floor kick with crisp off-beat hi-hats and claps. Danceable and driving.',
    render: () => { const b = beat(124); const d = drums({ bpm: 124, bars: 4, k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.' }); return render(16 * b, d); },
  },
  {
    slug: 'boom-bap-beat', title: 'Boom Bap Beat', kind: 'music', category: 'Drums', loopable: true,
    bpm: 90, mood: 'Groovy',
    tags: ['hiphop', 'boom bap', 'drums', 'beat', 'rap', 'groove', 'loop'],
    description: 'A classic head-nodding hip-hop drum groove with a heavy kick and a snappy snare on two and four.',
    render: () => { const b = beat(90); const d = drums({ bpm: 90, bars: 4, k: 'x.....x...x..x..', s: '....x.......x...', h: 'x.x.x.x.x.x.x.xx' }); return render(16 * b, d); },
  },
  {
    slug: 'synthwave-arp', title: 'Neon Synthwave Arp', kind: 'music', category: 'Electronic', loopable: true,
    bpm: 110, key: 'A minor', mood: 'Energetic',
    tags: ['synthwave', 'retrowave', '80s', 'arpeggio', 'synth', 'neon', 'driving', 'loop'],
    description: 'A pulsing 80s-style synth arpeggio over a deep bass and steady beat. Nostalgic night-drive energy.',
    render: () => {
      const b = beat(110); const step = b / 4;
      const roots = [57, 53, 48, 55];
      const arp = roots.flatMap((r) => [0, 7, 12, 15, 12, 7, 0, 7, 12, 15, 19, 15, 12, 7, 12, 15].map((o) => r + o));
      const lead = sequence(grid(arp, step, step * 0.8), (n, lt) => (saw(midi(n.note) * lt) * 0.5 + square(midi(n.note) * 1.003 * lt) * 0.2) * expDecay(lt, 6), 0.3);
      const bass = sequence(grid(roots.flatMap((r) => Array(8).fill(r - 24)), b / 2, b / 2 * 0.9), (n, lt) => saw(midi(n.note) * lt) * expDecay(lt, 3), 0.1);
      const lp = lowpass(2500); const lpb = lowpass(400); const dl = delay(step * 3, 0.35, 0.25);
      const d = drums({ bpm: 110, bars: 4, k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' });
      return render(16 * b, (t) => dl(lp(lead(t))) * 0.25 + lpb(bass(t)) * 0.45 + d(t) * 0.5);
    },
  },
  {
    slug: 'chiptune-adventure', title: 'Chiptune Adventure', kind: 'music', category: 'Chiptune', loopable: true,
    bpm: 140, key: 'C major', mood: 'Happy',
    tags: ['chiptune', '8bit', 'retro', 'game', 'adventure', 'happy', 'nes', 'loop'],
    description: 'An upbeat, bouncy 8-bit melody with a pulsing square-wave bass. Cheerful video-game adventure.',
    render: () => {
      const b = beat(140); const step = b / 2;
      const mel = [72, 76, 79, 76, 77, 81, 79, null, 76, 79, 84, 83, 81, 79, 77, 76,
        74, 77, 81, 77, 76, 79, 77, null, 74, 76, 77, 79, 76, 74, 72, null];
      const bass = [48, 48, 55, 55, 53, 53, 55, 55, 50, 50, 55, 55, 48, 55, 48, null];
      const fm = sequence(grid(mel, step, step * 0.85), (n, lt) => 0.3 * square(midi(n.note) * lt) * (lt < n.dur ? 1 : 0), 0.02);
      const fb = sequence(grid(bass.flatMap((x) => [x, x]), step, step * 0.6), (n, lt) => 0.3 * tri(midi(n.note) * lt) * (lt < n.dur ? 1 : 0), 0.02);
      const nn = noise(151);
      const hats = sequence(grid(Array(32).fill(1), step), (n, lt) => nn() * 0.12 * expDecay(lt, 60), 0.05);
      return render(32 * step, (t) => fm(t) + fb(t) + hats(t));
    },
  },
  {
    slug: 'gentle-piano-theme', title: 'Gentle Piano Theme', kind: 'music', category: 'Cinematic',
    bpm: 72, key: 'C major', mood: 'Hopeful',
    tags: ['piano', 'emotional', 'hopeful', 'cinematic', 'soft', 'inspiring', 'underscore'],
    description: 'A tender solo-piano progression (C, G, Am, F) with a simple melody on top. Hopeful and heartfelt.',
    render: () => {
      const b = beat(72); const len = 4 * b; const rv = reverb(0.35, 1.4);
      const prog = [[48, 55, 64], [43, 55, 62], [45, 57, 60], [41, 57, 60]];
      const arps = prog.flatMap((ch, i) => [0, 1, 2, 1, 2, 1, 0, 1].map((k, j) => ({ note: ch[k] + (k === 0 ? 0 : 12), start: i * len + j * (b / 2), dur: b / 2 })));
      const melody = [{ note: 76, start: 0, dur: 2 * b }, { note: 74, start: 2 * b, dur: 2 * b }, { note: 74, start: len, dur: 3 * b }, { note: 72, start: 2 * len, dur: 2 * b }, { note: 76, start: 2 * len + 2 * b, dur: 2 * b }, { note: 77, start: 3 * len, dur: 2 * b }, { note: 76, start: 3 * len + 2 * b, dur: 2 * b }];
      const f = sequence([...arps.map((n) => ({ ...n, v: 0.12 })), ...melody.map((n) => ({ ...n, v: 0.22 }))], (n, lt) => piano(n, lt) * n.v, 2.5);
      return render(4 * len + 2.5, (t) => rv(f(t)));
    },
  },
  {
    slug: 'epic-trailer-drums', title: 'Epic Trailer Drums', kind: 'music', category: 'Cinematic', loopable: true,
    bpm: 100, mood: 'Epic',
    tags: ['epic', 'trailer', 'drums', 'taiko', 'cinematic', 'battle', 'action', 'loop'],
    description: 'Thunderous, booming taiko-style drums in a driving war rhythm with a big hall echo.',
    render: () => {
      const b = beat(100); const step = b / 4; const rv = reverb(0.35, 1.7); const n = noise(161); const lp = lowpass(900);
      const pat = 'x..x..x.x...x.x.x..x..x.x.x.xxxx';
      const hits = [...pat.repeat(2)].map((c, i) => (c === 'x' ? { start: i * step, dur: 0.4, g: i % 4 === 0 ? 1 : 0.7 } : null)).filter(Boolean);
      const f = sequence(hits, (h, lt) => h.g * (sin(65 * lt + 6 * (1 - Math.exp(-25 * lt))) * expDecay(lt, 6) + lp(n()) * expDecay(lt, 30)), 0.8);
      return render(16 * b, (t) => rv(f(t)));
    },
  },
  {
    slug: 'funky-bassline', title: 'Funky Bassline', kind: 'music', category: 'Electronic', loopable: true,
    bpm: 105, key: 'E minor', mood: 'Groovy',
    tags: ['funk', 'bass', 'groove', 'slap', 'disco', 'loop'],
    description: 'A bouncy, syncopated synth-bass groove with octave jumps over a tight beat. Funky and playful.',
    render: () => {
      const b = beat(105); const step = b / 4;
      const line = [40, null, 52, 40, null, 40, 43, null, 45, null, 57, 45, 47, null, 43, 45];
      const bass = sequence(grid([...line, ...line, ...line, ...line], step, step * 0.7), (n, lt) => (saw(midi(n.note) * lt) * 0.6 + sin(midi(n.note) * lt)) * expDecay(lt, 9), 0.05);
      const lp = lowpass(700);
      const d = drums({ bpm: 105, bars: 4, k: 'x.....x...x.....', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx' });
      return render(16 * b, (t) => lp(bass(t)) * 0.6 + d(t) * 0.45);
    },
  },
  {
    slug: 'music-box-lullaby', title: 'Music Box Lullaby', kind: 'music', category: 'Ambient',
    bpm: 90, key: 'F major', mood: 'Whimsical',
    tags: ['music box', 'lullaby', 'kids', 'sleep', 'whimsical', 'gentle', 'bells', 'cute'],
    description: 'A delicate, tinkling music-box melody in a slow waltz. Sweet, innocent, a little nostalgic.',
    render: () => {
      const b = beat(90); const rv = reverb(0.3, 1.2);
      const mel = [77, 81, 84, 81, 77, null, 76, 79, 84, 79, 76, null, 74, 77, 81, 77, 74, null, 72, 76, 79, 77, 77, null];
      const f = sequence(grid(mel, b, b), (n, lt) => (sin(midi(n.note) * 2 * lt) + 0.3 * sin(midi(n.note) * 6.1 * lt) * expDecay(lt, 8)) * expDecay(lt, 3) * 0.3, 1.5);
      return render(mel.length * b + 1.5, (t) => rv(f(t)));
    },
  },
  {
    slug: 'podcast-intro-jingle', title: 'Podcast Intro Jingle', kind: 'music', category: 'Jingles',
    bpm: 120, key: 'G major', mood: 'Happy',
    tags: ['podcast', 'intro', 'jingle', 'logo', 'upbeat', 'youtube', 'opener', 'corporate'],
    description: 'A five-second bright, upbeat sting: plucky synth notes climb to a final chord with a cymbal swell.',
    render: () => {
      const b = beat(120); const rv = reverb(0.25);
      const notes = [...grid([67, 71, 74, 79, 78, 79], b / 2, b / 2), ...[67, 71, 74, 79].map((note) => ({ note, start: 3 * b, dur: 2.5 * b }))];
      const f = sequence(notes, (n, lt) => pluck(n, lt) * 0.25, 2);
      const n = noise(171); const hp = highpass(5000);
      return render(5.5, (t) => rv(f(t) + hp(n()) * 0.15 * Math.max(0, Math.min(1, (t - 1.5) / 1.4)) * (t < 3 * b ? 1 : expDecay(t - 3 * b, 3))));
    },
  },
];
