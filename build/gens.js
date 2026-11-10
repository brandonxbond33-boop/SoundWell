// ===== Soundwell procedural families. Runs inside SoundwellEngine() (browser worker + Node build). =====
const sat = (x, k = 1.5) => Math.tanh(k * x);
// Seamless loops. Rhythmic families fold their decaying tail back onto the start; continuous
// families (noise beds, pads, hums: marked xfade) crossfade the tail into the start instead.
let XF = false;
function loopRender(len, fn, tail = 2) {
  const full = render(len + tail, fn); const n = Math.round(len * SR); const out = full.slice(0, n);
  if (XF) { const X = Math.min(full.length - n, n); for (let i = 0; i < X; i++) { const a = (i / X) * Math.PI / 2; out[i] = full[i] * Math.sin(a) + full[n + i] * Math.cos(a); } }
  else for (let i = n; i < full.length; i++) out[i - n] += full[i];
  return out;
}
function metalTone(f, ratios, rate) { return (lt) => { if (lt < 0) return 0; let s = 0; for (let i = 0; i < ratios.length; i++) s += sin(f * ratios[i] * lt) * expDecay(lt, rate * (1 + i * 0.6)) / (i + 1); return s * Math.min(1, lt * 2000); }; }
function scatter(seed, len, rate) { const r = rng(seed); const out = []; let t = r() / rate; while (t < len) { out.push(t); t -= Math.log(1 - r()) / rate; } return out; }
const pick = (arr, i) => arr[i % arr.length];

// ---------- music theory ----------
const NOTES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MAJ = [0, 2, 4, 5, 7, 9, 11]; const MIN = [0, 2, 3, 5, 7, 8, 10];
const PROGS = [
  { id: 'pop', name: 'I–V–vi–IV', minor: false, deg: [0, 4, 5, 3], mood: 'Uplifting' },
  { id: 'sad-pop', name: 'vi–IV–I–V', minor: false, deg: [5, 3, 0, 4], mood: 'Emotional' },
  { id: 'doo-wop', name: 'I–vi–IV–V', minor: false, deg: [0, 5, 3, 4], mood: 'Nostalgic' },
  { id: 'jazz', name: 'ii–V–I–vi', minor: false, deg: [1, 4, 0, 5], seventh: true, mood: 'Smooth' },
  { id: 'gospel', name: 'I–IV–I–V', minor: false, deg: [0, 3, 0, 4], mood: 'Hopeful' },
  { id: 'epic', name: 'i–VI–III–VII', minor: true, deg: [0, 5, 2, 6], mood: 'Epic' },
  { id: 'dark', name: 'i–iv–v–i', minor: true, deg: [0, 3, 4, 0], mood: 'Dark' },
  { id: 'drive', name: 'i–VII–VI–VII', minor: true, deg: [0, 6, 5, 6], mood: 'Driving' },
  { id: 'rock', name: 'I–IV–V–IV', minor: false, deg: [0, 3, 4, 3], mood: 'Driving' },
  { id: 'ballad', name: 'I–iii–IV–V', minor: false, deg: [0, 2, 3, 4], mood: 'Tender' },
  { id: 'andalusian', name: 'i–VII–VI–v', minor: true, deg: [0, 6, 5, 4], mood: 'Dramatic' },
  { id: 'dreamy', name: 'IV–iii–ii–I', minor: false, deg: [3, 2, 1, 0], seventh: true, mood: 'Dreamy' },
];
function chordNotes(root, prog, i, oct = 48) { const sc = prog.minor ? MIN : MAJ; const d = prog.deg[i]; const n = (k) => oct + root + sc[(d + k) % 7] + 12 * Math.floor((d + k) / 7); const c = [n(0), n(2), n(4)]; if (prog.seventh) c.push(n(6)); return c; }
const keyName = (root, minor) => `${NOTES[root]} ${minor ? 'minor' : 'major'}`;

// ---------- reusable voices ----------
function stringV(n, lt) { const f = midi(n.note); const env = adsr(lt, n.att ?? 0.02, 0.08, 0.6, 0.08, n.dur); return env * (saw(f * lt) + saw(f * 1.005 * lt) * 0.7) * 0.3; }
function brassV(n, lt) { const f = midi(n.note); const env = adsr(lt, n.att ?? 0.3, 0.3, 0.8, 0.5, n.dur); let s = 0; for (let k = 1; k <= 9; k++) s += sin(f * k * lt) * Math.exp(-k * (1.7 - env)) / k; return env * s * 0.5; }
function slowStrings(n, lt) { const f = midi(n.note); const env = adsr(lt, 0.5, 0.3, 0.85, 0.8, n.dur); const vib = 0.003 * Math.sin(TAU * 5.2 * lt); return env * (saw(f * (1 + vib) * lt) + saw(f * 1.004 * lt) + saw(f * 0.997 * lt)) * 0.15; }
function pluckV(n, lt) { const f = midi(n.note); return (sin(f * lt) * 0.6 + tri(f * 2 * lt) * 0.25 + sin(f * 3 * lt) * 0.1 * expDecay(lt, 9)) * expDecay(lt, 3.5) * Math.min(1, lt * 800); }
function choirPad(prog) { const f1 = bandpass(800, 6), f2 = bandpass(1150, 7), f3 = bandpass(2900, 8); const src = sequence(prog, (n, lt) => { const f = midi(n.note) * (1 + 0.004 * Math.sin(TAU * 5 * lt + n.note)); return adsr(lt, 0.8, 0.4, 0.85, 1, n.dur) * (saw(f * lt) + saw(f * 1.003 * lt)) * 0.3; }, 1.2); return (t) => { const x = src(t); return f1(x) * 1.2 + f2(x) * 0.8 + f3(x) * 0.35; }; }
function step(seed, body, grit, weight) { const n = noise(seed); const bp = bandpass(grit, 1.5); const lp = lowpass(400); return (lt) => lt < 0 ? 0 : weight * (lp(n()) * 2.5 * expDecay(lt, 30) + sin(body * lt) * expDecay(lt, 40) * 0.6) + bp(n()) * expDecay(lt, 55) * 0.6; }

const GENS = [];
const G = (def) => GENS.push(def);

// ======================= SOUND EFFECTS =======================
G({ id: 'laser', cat: 'Sci-Fi', kind: 'sfx', grid: { w: [0, 1, 2], f: [0, 1, 2], sw: [0, 1, 2], len: [0, 1] },
  meta: (p) => ({ title: `Laser ${['Zap', 'Charge', 'Wobble'][p.sw]} (${['smooth', 'buzzy', 'harsh'][p.w]}, ${['high', 'mid', 'low'][p.f]}${p.len ? ', long' : ''})`,
    tags: ['laser', 'blaster', 'zap', 'pew', 'shoot', 'sci-fi', 'weapon', ['smooth', 'buzzy', 'harsh'][p.w]],
    desc: `A ${['smooth sine', 'buzzy square', 'harsh sawtooth'][p.w]} laser that ${['falls fast in pitch', 'rises as it fires', 'wobbles as it fires'][p.sw]}, ${['high', 'mid', 'low'][p.f]} in pitch.` }),
  render: (p) => { const ph = phasor(); const f0 = [1800, 1100, 600][p.f]; const L = [0.2, 0.45][p.len]; const wave = [sin, square, saw][p.w]; const lp = lowpass(6000);
    return render(L, (t) => { const x = t / L; const f = p.sw === 0 ? f0 * Math.exp(-4 * x) + 80 : p.sw === 1 ? f0 * 0.3 * (1 + 3 * x) : f0 * (0.6 + 0.4 * Math.sin(TAU * 18 * t)); return lp(wave(ph(f))) * expDecay(t, 4 / L) * 0.6; }); } });

G({ id: 'pickup', cat: 'Game', kind: 'sfx', grid: { pat: [0, 1, 2, 3, 4, 5], base: [0, 1, 2, 3], w: [0, 1] },
  meta: (p) => ({ title: `${['Coin', 'Gem', 'Star', 'Key', 'Heart', 'Bonus'][p.pat]} Pickup ${p.base + 1} (${['square', 'triangle'][p.w]})`,
    tags: ['pickup', 'collect', 'item', 'reward', 'retro', '8bit', 'chiptune', 'game', ['coin', 'gem', 'star', 'key', 'heart', 'bonus'][p.pat]],
    desc: `A short retro ${['coin', 'gem', 'star', 'key', 'heart', 'bonus'][p.pat]} pickup jingle on a ${['square', 'triangle'][p.w]} wave, ${['low', 'middle', 'high', 'very high'][p.base]} register.` }),
  render: (p) => { const pats = [[0, 7], [0, 4, 7, 12], [0, 7, 12, 19], [0, 5, 12], [0, 4, 7, 4, 12], [0, 2, 4, 7, 9, 12]]; const n = pats[p.pat]; const base = [64, 69, 76, 81][p.base]; const step = 0.055; const wave = [square, tri][p.w];
    return render(n.length * step + 0.25, (t) => { const i = Math.min(n.length - 1, Math.floor(t / step)); const lt = t - i * step; return 0.35 * wave(midi(base + n[i]) * t) * (i === n.length - 1 ? expDecay(lt, 8) : 1); }); } });

G({ id: 'jump', cat: 'Game', kind: 'sfx', grid: { dir: [0, 1], c: [0, 1, 2], base: [0, 1, 2, 3], w: [0, 1] },
  meta: (p) => ({ title: `Retro ${p.dir ? ['Drop', 'Stepped Fall', 'Wobbly Fall'][p.c] : ['Jump', 'Power-Up', 'Spring'][p.c]} ${p.base + 1} (${['square', 'triangle'][p.w]})`,
    tags: ['jump', 'retro', '8bit', 'platformer', 'game', p.dir ? 'fall' : 'power up', 'bounce'],
    desc: `A chiptune ${p.dir ? 'falling' : 'rising'} sweep with a ${['quick', 'stepped', 'springy'][p.c]} curve, like a platformer ${p.dir ? 'drop' : 'jump'}.` }),
  render: (p) => { const ph = phasor(); const f0 = [150, 220, 330, 440][p.base]; const L = [0.25, 0.5, 0.35][p.c]; const wave = [square, tri][p.w];
    return render(L, (t) => { const x = t / L; const y = p.dir ? 1 - x : x; const f = p.c === 1 ? f0 * 2 ** (Math.floor(y * 8) / 4) : p.c === 2 ? f0 * (1 + 2 * y) * (1 + 0.1 * Math.sin(TAU * 30 * t)) : f0 * (1 + 3 * y * y); return 0.35 * wave(ph(f)) * (1 - x * 0.6); }); } });

G({ id: 'bitboom', cat: 'Game', kind: 'sfx', grid: { size: [0, 1, 2], crunch: [0, 1, 2], len: [0, 1, 2] },
  meta: (p) => ({ title: `8-Bit Explosion (${['small', 'medium', 'huge'][p.size]}, ${['soft', 'gritty', 'crunchy'][p.crunch]}, ${['short', 'medium', 'long'][p.len]})`,
    tags: ['explosion', 'boom', '8bit', 'retro', 'arcade', 'destroy', 'game', 'blast'],
    desc: `A ${['small', 'medium', 'huge'][p.size]} low-fi arcade explosion with ${['soft', 'gritty', 'crunchy'][p.crunch]} noise, ${['short', 'medium', 'long'][p.len]} decay.` }),
  render: (p) => { const n = noise(4100 + p.size * 9 + p.crunch * 3 + p.len); let held = 0, c = 0; const L = [0.4, 0.8, 1.4][p.len]; const lp = lowpass([2500, 1500, 900][p.size]);
    return render(L, (t) => { const hold = Math.floor([4, 10, 20][p.crunch] + 60 * t); if (c++ % hold === 0) held = n(); return lp(held) * expDecay(t, 3 / L) * 1.5; }); } });

G({ id: 'click', cat: 'Interface', kind: 'sfx', grid: { f: [0, 1, 2, 3, 4], d: [0, 1, 2], body: [0, 1, 2] },
  meta: (p) => ({ title: `UI ${['Tick', 'Tap', 'Click', 'Clack', 'Thock'][p.f]} ${p.d * 3 + p.body + 1}`,
    tags: ['click', 'tap', 'button', 'ui', 'interface', 'tick', 'minimal', 'app'],
    desc: `A ${['very short', 'short', 'soft'][p.d]} interface ${['tick', 'tap', 'click', 'clack', 'thock'][p.f]} with a ${['thin', 'rounded', 'woody'][p.body]} body.` }),
  render: (p) => { const f = [3200, 2400, 1700, 1100, 700][p.f]; const r = [140, 80, 45][p.d]; const n = noise(4200 + p.f * 7 + p.body); const bp = bandpass(f * 1.5, 3);
    return render(0.15, (t) => (sin(f * t) * expDecay(t, r) + [0.1, 0.3, 0.2][p.body] * sin(f * [2.1, 0.5, 1.5][p.body] * t) * expDecay(t, r * 1.5) + bp(n()) * expDecay(t, r * 2) * 0.5) * 0.8); } });

G({ id: 'chime', cat: 'Interface', kind: 'sfx', grid: { pat: [0, 1, 2, 3, 4, 5, 6, 7], tim: [0, 1, 2], reg: [0, 1] },
  meta: (p) => ({ title: `${['Notification', 'Success', 'Message', 'Reminder', 'Complete', 'Welcome', 'Alert', 'Sparkle'][p.pat]} Chime (${['bell', 'marimba', 'glass'][p.tim]}${p.reg ? ', high' : ''})`,
    tags: ['notification', 'chime', 'alert', 'ui', 'app', 'ding', ['bell', 'marimba', 'glass'][p.tim], ['notification', 'success', 'message', 'reminder', 'complete', 'welcome', 'alert', 'sparkle'][p.pat]],
    desc: `A friendly ${['notification', 'success', 'message', 'reminder', 'task-complete', 'welcome', 'attention', 'sparkly'][p.pat]} chime played on a ${['bell', 'marimba', 'glass'][p.tim]} tone.` }),
  render: (p) => { const pats = [[0, 7], [0, 4, 7], [7, 0], [0, 0, 7], [0, 4, 7, 12], [0, 5, 9], [12, 7, 12], [0, 7, 12, 16, 19]]; const base = p.reg ? 79 : 72; const ratios = [[1, 2, 3.01, 4.1], [1, 3.9, 10], [1, 2.76, 5.4]][p.tim]; const rate = [3, 9, 4][p.tim]; const rv = reverb(0.2);
    const notes = pats[p.pat].map((o, i) => ({ start: i * 0.11, dur: 0.5, f: midi(base + o) })); const f = sequence(notes, (n, lt) => metalTone(n.f, ratios, rate)(lt), 1);
    return render(notes.length * 0.11 + 0.8, (t) => rv(f(t) * 0.5)); } });

G({ id: 'deny', cat: 'Interface', kind: 'sfx', grid: { f: [0, 1, 2, 3], pat: [0, 1, 2], tim: [0, 1] },
  meta: (p) => ({ title: `Error ${['Buzz', 'Double Buzz', 'Descending Beep'][p.pat]} ${p.f + 1} (${['raspy', 'clean'][p.tim]})`,
    tags: ['error', 'wrong', 'denied', 'fail', 'buzz', 'ui', 'negative', 'invalid'],
    desc: `A ${['raspy', 'clean'][p.tim]} ${['single buzz', 'double buzz', 'two-note descending beep'][p.pat]} that says "no".` }),
  render: (p) => { const f = [110, 150, 200, 280][p.f]; const wave = p.tim ? tri : square; const lp = lowpass(1800);
    return render(0.5, (t) => { let on = 0, ff = f; if (p.pat === 0) on = t < 0.3; else if (p.pat === 1) on = t < 0.14 || (t > 0.2 && t < 0.36); else { on = t < 0.4; ff = t < 0.18 ? f * 2 : f * 1.5; } return lp(wave(ff * t)) * (on ? 0.6 : 0); }); } });

G({ id: 'whoosh', cat: 'Transitions', kind: 'sfx', grid: { len: [0, 1, 2, 3], c: [0, 1, 2, 3], dir: [0, 1, 2] },
  meta: (p) => ({ title: `${['Quick', 'Swift', 'Slow', 'Long'][p.len]} Whoosh (${['deep', 'warm', 'airy', 'bright'][p.c]}, ${['pass-by', 'rising', 'falling'][p.dir]})`,
    tags: ['whoosh', 'swoosh', 'swish', 'transition', 'pass by', 'air', 'motion', ['deep', 'warm', 'airy', 'bright'][p.c]],
    desc: `A ${['quick', 'swift', 'slow', 'long'][p.len]}, ${['deep', 'warm', 'airy', 'bright'][p.c]} whoosh that ${['passes by', 'sweeps upward', 'sweeps downward'][p.dir]}. Good for transitions and fast motion.` }),
  render: (p) => { const L = [0.35, 0.7, 1.3, 2.2][p.len]; const c = [300, 700, 1500, 3000][p.c]; const n = noise(4300 + p.len * 13 + p.c * 3 + p.dir); const bp = bandpass(c, 1.5); const pg = p.dir === 0 ? panned() : null;
    return render(L, (t) => { const x = t / L; const env = p.dir === 1 ? x ** 2 * Math.min(1, (1 - x) * 12) : p.dir === 2 ? (1 - x) ** 2 * Math.min(1, x * 12) : Math.sin(Math.PI * x) ** 2; const fc = c * (p.dir === 1 ? 0.5 + x : p.dir === 2 ? 1.5 - x : 0.6 + 0.8 * Math.sin(Math.PI * x)); return bp(n(), fc) * env * 2 * (p.dir === 0 ? pg((x - 0.5) * 1.6) : 1); }); } });

G({ id: 'riser', cat: 'Transitions', kind: 'sfx', grid: { len: [0, 1, 2], type: [0, 1, 2], range: [0, 1, 2] },
  meta: (p) => ({ title: `${['Noise', 'Tone', 'Hybrid'][p.type]} Riser (${['2', '4', '8'][p.len]} s, ${['low', 'mid', 'high'][p.range]})`,
    tags: ['riser', 'build up', 'tension', 'transition', 'swell', 'cinematic', 'edm', 'uplifter'],
    desc: `A ${['2', '4', '8'][p.len]}-second build-up using ${['rising filtered noise', 'a climbing synth tone', 'noise and tone together'][p.type]}, ending ${['low', 'mid', 'high'][p.range]}.` }),
  render: (p) => { const L = [2, 4, 8][p.len]; const top = [800, 2000, 5000][p.range]; const n = noise(4400 + p.len * 9 + p.type * 3 + p.range); const bp = bandpass(500, 3); const ph = phasor(); const ph2 = phasor();
    return render(L, (t) => { const x = t / L; const env = x ** 1.6 * Math.min(1, (L - t) * 30); const nz = p.type !== 1 ? bp(n(), 200 + top * x * x) * 1.5 : 0; const tone = p.type !== 0 ? (saw(ph(top / 8 * 2 ** (x * 3))) * 0.3 + saw(ph2(top / 8 * 1.01 * 2 ** (x * 3))) * 0.3) : 0; return (nz + tone) * env; }); } });

G({ id: 'boom', cat: 'Impacts', kind: 'sfx', grid: { size: [0, 1, 2, 3], br: [0, 1, 2], tail: [0, 1, 2] },
  meta: (p) => ({ title: `${['Thud', 'Boom', 'Big Boom', 'Massive Impact'][p.size]} (${['dark', 'punchy', 'bright'][p.br]}, ${['dry', 'roomy', 'huge tail'][p.tail]})`,
    tags: ['impact', 'boom', 'hit', 'cinematic', 'trailer', 'explosion', 'bass', 'drop'],
    desc: `A ${['small', 'solid', 'big', 'massive'][p.size]} ${['dark', 'punchy', 'bright'][p.br]} impact with a ${['dry', 'roomy', 'huge, echoing'][p.tail]} tail.` }),
  render: (p) => { const n = noise(4500 + p.size * 9 + p.br * 3 + p.tail); const lp = lowpass([600, 1800, 5000][p.br]); const rv = reverb([0.05, 0.25, 0.45][p.tail], [0.6, 1.2, 1.7][p.tail]); const f0 = [90, 60, 45, 35][p.size]; const ph = phasor(); const L = [0.8, 1.5, 2.5, 4][p.size] + p.tail;
    return render(L, (t) => rv(sin(ph(f0 + f0 * 2 * expDecay(t, 12))) * expDecay(t, [8, 4, 2.2, 1.4][p.size]) + lp(n()) * expDecay(t, [30, 15, 8, 5][p.size]) * 0.9)); } });

G({ id: 'punch', cat: 'Impacts', kind: 'sfx', grid: { w: [0, 1, 2], snap: [0, 1, 2], pitch: [0, 1, 2] },
  meta: (p) => ({ title: `Punch ${['Light', 'Solid', 'Heavy'][p.w]} ${p.snap * 3 + p.pitch + 1}`,
    tags: ['punch', 'hit', 'fight', 'smack', 'kick', 'combat', 'impact', 'martial arts'],
    desc: `A ${['light', 'solid', 'heavy'][p.w]} fight punch with a ${['soft', 'crisp', 'sharp'][p.snap]} snap and ${['high', 'mid', 'low'][p.pitch]} body.` }),
  render: (p) => { const n = noise(4600 + p.w * 9 + p.snap * 3 + p.pitch); const hp = highpass(2000); const lp = lowpass(800); const f = [180, 120, 80][p.pitch];
    return render(0.4, (t) => sin(f * t) * expDecay(t, [30, 20, 12][p.w]) * (0.6 + p.w * 0.2) + lp(n()) * expDecay(t, 25) * 1.2 + hp(n()) * expDecay(t, [60, 90, 140][p.snap]) * 0.8); } });

G({ id: 'strike', cat: 'Impacts', kind: 'sfx', grid: { mat: [0, 1, 2, 3], f: [0, 1, 2, 3, 4, 5], d: [0, 1] },
  meta: (p) => ({ title: `${['Metal Pipe', 'Steel Plate', 'Anvil', 'Gong'][p.mat]} Hit ${p.f + 1}${p.d ? ' (long ring)' : ''}`,
    tags: ['metal', 'clang', 'hit', 'strike', 'industrial', 'impact', ['pipe', 'plate', 'anvil', 'gong'][p.mat]],
    desc: `A ${['hollow metal pipe', 'flat steel plate', 'heavy anvil', 'bronze gong'][p.mat]} being struck, ${['short', 'with a long ring'][p.d]}.` }),
  render: (p) => { const R = [[1, 2.76, 5.4, 8.93], [1, 1.59, 2.14, 2.65, 3.16], [1, 2.4, 4.6, 7.3], [1, 1.47, 2.09, 2.56, 3.2]][p.mat]; const f = [110, 160, 230, 330, 480, 700][p.f] * (p.mat === 3 ? 0.5 : 1); const m = metalTone(f, R, p.d ? 0.8 : 2.5); const n = noise(4700 + p.mat * 13 + p.f); const lp = lowpass(4000);
    return render(p.d ? 4 : 1.8, (t) => m(t) * 0.7 + lp(n()) * expDecay(t, 60) * 0.6); } });

G({ id: 'steps', cat: 'Foley', kind: 'sfx', grid: { surf: [0, 1, 2, 3, 4, 5], pace: [0, 1], w: [0, 1] },
  meta: (p) => ({ title: `Footsteps on ${['Wood', 'Concrete', 'Gravel', 'Grass', 'Snow', 'Metal'][p.surf]} (${p.pace ? 'running' : 'walking'}, ${p.w ? 'heavy' : 'light'})`,
    tags: ['footsteps', 'walking', 'steps', 'foley', p.pace ? 'running' : 'walking', ['wood', 'concrete', 'gravel', 'grass', 'snow', 'metal'][p.surf]],
    desc: `${p.w ? 'Heavy' : 'Light'} footsteps ${p.pace ? 'running' : 'walking'} on ${['a wooden floor', 'concrete', 'crunchy gravel', 'soft grass', 'packed snow', 'a metal walkway'][p.surf]}.` }),
  render: (p) => { const cnt = p.pace ? 12 : 8; const gap = p.pace ? 0.24 : 0.52; const r = rng(4800 + p.surf * 7 + p.pace * 3 + p.w); const n = noise(4801 + p.surf); const surf = p.surf;
    const bp = bandpass([1800, 2600, 3200, 1500, 900, 3000][surf], [1.5, 2, 1.2, 0.8, 1, 4][surf]); const lp = lowpass(400); const mt = metalTone(420, [1, 2.4, 4.2], 12);
    const steps = Array.from({ length: cnt }, (_, i) => ({ start: 0.05 + i * gap + r() * 0.03, dur: 0.3, g: i % 2 ? 0.85 : 1 }));
    const f = sequence(steps, (s, lt) => { const W = p.w ? 1.3 : 0.8; const thump = lp(n()) * 2.5 * expDecay(lt, 30) * W * [1, 1.1, 0.6, 0.4, 0.5, 0.8][surf]; const grain = surf === 2 || surf === 4 ? (0.4 + Math.max(0, Math.sin(TAU * 170 * lt + 9 * Math.sin(TAU * 23 * lt)))) : 1; const tex = bp(n()) * grain * expDecay(lt, [55, 70, 14, 18, 12, 60][surf]) * 0.8; return s.g * (thump + tex + (surf === 5 ? mt(lt) * 0.3 : 0)); }, 0.3);
    return render(cnt * gap + 0.4, f); } });

G({ id: 'knock', cat: 'Household', kind: 'sfx', grid: { pat: [0, 1, 2, 3, 4], surf: [0, 1, 2] },
  meta: (p) => ({ title: `${['Two Knocks', 'Three Knocks', 'Urgent Knocking', 'Shave and a Haircut Knock', 'Slow Knocks'][p.pat]} on ${['a Wooden Door', 'a Hollow Door', 'Glass'][p.surf]}`,
    tags: ['knock', 'door', 'knocking', 'visitor', 'house', ['wood', 'hollow door', 'glass'][p.surf]],
    desc: `${['Two knocks', 'Three knocks', 'Fast, urgent knocking', 'A rhythmic knock pattern', 'Slow, heavy knocks'][p.pat]} on ${['a solid wooden door', 'a hollow door', 'a glass pane'][p.surf]}.` }),
  render: (p) => { const pats = [[0, 0.22], [0, 0.2, 0.4], [0, 0.12, 0.24, 0.36, 0.48, 0.6, 0.72], [0, 0.3, 0.45, 0.6, 0.9, 1.5, 1.7], [0, 0.6, 1.2]]; const n = noise(4900 + p.pat * 3 + p.surf); const bp = bandpass([350, 220, 2200][p.surf], [3, 2, 6][p.surf]); const rv = reverb(0.15);
    const f = sequence(pats[p.pat].map((s) => ({ start: s + 0.05, dur: 0.2 })), (k, lt) => bp(n()) * 4 * expDecay(lt, [25, 18, 40][p.surf]) + sin([180, 110, 900][p.surf] * lt) * expDecay(lt, 30) * 0.5, 0.2);
    return render(pats[p.pat].at(-1) + 0.6, (t) => rv(f(t))); } });

G({ id: 'drip', cat: 'Nature', kind: 'sfx', grid: { f: [0, 1, 2, 3, 4], cnt: [0, 1, 2] },
  meta: (p) => ({ title: `Water ${['Drop', 'Drips', 'Dripping'][p.cnt]} ${p.f + 1}`,
    tags: ['water', 'drip', 'drop', 'plop', 'liquid', 'cave', 'faucet'],
    desc: `${['A single water drop', 'A few water drips', 'Steady dripping water'][p.cnt]} with a ${['deep', 'round', 'medium', 'bright', 'tiny'][p.f]} "plip".` }),
  render: (p) => { const cnt = [1, 3, 8][p.cnt]; const f0 = [600, 900, 1300, 1800, 2600][p.f]; const r = rng(5000 + p.f * 3 + p.cnt); const rv = reverb(0.35, 1.1);
    const drops = Array.from({ length: cnt }, (_, i) => ({ start: 0.05 + i * (0.4 + r() * 0.3), dur: 0.1, f: f0 * (0.9 + r() * 0.2) })); const fd = sequence(drops, (d, lt) => sin(d.f * (1 + 2.5 * lt / 0.05) * lt) * expDecay(lt, 40), 0.1);
    return render(drops.at(-1).start + 1, (t) => rv(fd(t) * 0.6)); } });

G({ id: 'toon', cat: 'Cartoon', kind: 'sfx', grid: { type: [0, 1, 2, 3], f: [0, 1, 2, 3], sp: [0, 1] },
  meta: (p) => ({ title: `${['Boing', 'Slide Whistle Up', 'Slide Whistle Down', 'Wobble'][p.type]} ${p.f + 1}${p.sp ? ' (fast)' : ''}`,
    tags: ['cartoon', 'funny', 'comedy', 'silly', ['boing', 'slide whistle', 'slide whistle', 'wobble'][p.type], ['spring', 'rising', 'falling', 'jelly'][p.type]],
    desc: `A ${p.sp ? 'quick' : 'classic'} cartoon ${['spring boing', 'slide whistle rising in pitch', 'slide whistle dropping in pitch', 'jelly wobble'][p.type]}, ${['low', 'mid', 'high', 'very high'][p.f]} pitch.` }),
  render: (p) => { const ph = phasor(); const f0 = [180, 300, 500, 800][p.f]; const L = p.sp ? 0.5 : 1;
    return render(L, (t) => { const x = t / L; let f; if (p.type === 0) f = f0 + f0 * 0.6 * Math.sin(TAU * 14 / L * t) * expDecay(t, 3 / L); else if (p.type === 1) f = f0 * 2 ** (x * 1.8); else if (p.type === 2) f = f0 * 3 * 2 ** (-x * 1.8); else f = f0 * (1 + 0.3 * Math.sin(TAU * 7 / L * t)); return sin(ph(f * (1 + 0.01 * Math.sin(TAU * 6 * t)))) * (p.type === 0 ? expDecay(t, 4 / L) : Math.min(1, t * 30) * Math.min(1, (L - t) * 10)) * 0.7; }); } });

G({ id: 'siren', cat: 'Alarms', kind: 'sfx', grid: { type: [0, 1, 2, 3, 4], f: [0, 1, 2], sp: [0, 1] },
  meta: (p) => ({ title: `${['Wail', 'Yelp', 'Hi-Lo', 'Beeping', 'Pulse'][p.type]} Alarm ${p.f + 1}${p.sp ? ' (fast)' : ''}`,
    tags: ['alarm', 'siren', 'warning', 'emergency', 'alert', ['wail', 'yelp', 'hi lo', 'beeping', 'pulse'][p.type]],
    desc: `A ${['rising and falling wail', 'fast yelping', 'two-tone hi-lo', 'repeating beep', 'pulsing'][p.type]} alarm${p.sp ? ', fast' : ''}, ${['low', 'mid', 'high'][p.f]} pitch.` }),
  render: (p) => { const ph = phasor(); const f0 = [500, 750, 1100][p.f]; const s = p.sp ? 2 : 1; const lp = lowpass(4000);
    return render(4, (t) => { let f = f0, g = 1; if (p.type === 0) f = f0 * (1 + 0.5 * (0.5 - 0.5 * Math.cos(TAU * 0.5 * s * t))); else if (p.type === 1) f = f0 * (1 + 0.6 * ((t * 4 * s) % 1)); else if (p.type === 2) f = Math.floor(t * 1.5 * s) % 2 ? f0 * 1.3 : f0; else if (p.type === 3) g = (t * 3 * s) % 1 < 0.5 ? 1 : 0; else g = 0.5 + 0.5 * Math.sin(TAU * 4 * s * t); return lp(square(ph(f)) * 0.4) * g; }); } });

G({ id: 'beep', cat: 'Alarms', kind: 'sfx', grid: { f: [0, 1, 2, 3, 4], pat: [0, 1, 2, 3] },
  meta: (p) => ({ title: `${['Single', 'Double', 'Triple', 'Countdown'][p.pat]} Beep ${p.f + 1}`,
    tags: ['beep', 'timer', 'electronic', 'digital', 'signal', 'tone', p.pat === 3 ? 'countdown' : 'beep'],
    desc: `${['One', 'Two quick', 'Three quick', 'Four countdown'][p.pat]} electronic beep${p.pat ? 's' : ''} at ${[440, 660, 880, 1320, 2000][p.f]} Hz.` }),
  render: (p) => { const f = [440, 660, 880, 1320, 2000][p.f]; const cnt = [1, 2, 3, 4][p.pat]; const gap = p.pat === 3 ? 0.6 : 0.15; const L = 0.1;
    return render(cnt * gap + 0.2, (t) => { const i = Math.floor(t / gap); const lt = t - i * gap; if (i >= cnt) return 0; const ff = p.pat === 3 && i === cnt - 1 ? f * 2 : f; const len = p.pat === 3 && i === cnt - 1 ? 0.4 : L; return lt < len ? sin(ff * t) * 0.5 * Math.min(1, lt * 400) * Math.min(1, (len - lt) * 400) : 0; }); } });

G({ id: 'bell', cat: 'Musical FX', kind: 'sfx', grid: { note: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], tim: [0, 1, 2] },
  meta: (p) => ({ title: `${['Bell', 'Glockenspiel', 'Tubular Bell'][p.tim]} · ${NOTES[p.note]}`, key: NOTES[p.note],
    tags: ['bell', 'tuned', 'note', 'musical', 'chime', ['bell', 'glockenspiel', 'tubular bell'][p.tim], NOTES[p.note].toLowerCase()],
    desc: `A single tuned ${['bell', 'glockenspiel', 'tubular bell'][p.tim]} note: ${NOTES[p.note]}. Play several to make a melody.` }),
  render: (p) => { const f = midi([72, 84, 60][p.tim] + p.note); const R = [[1, 2, 2.4, 3, 4.2, 5.4], [1, 2.76, 5.4], [1, 2.0, 3.01, 4.16, 5.43]][p.tim]; const m = metalTone(f, R, [1.5, 3, 0.7][p.tim]); const rv = reverb(0.2); return render([2.5, 1.5, 4][p.tim], (t) => rv(m(t) * 0.6)); } });

G({ id: 'bleep', cat: 'Sci-Fi', kind: 'sfx', grid: { seed: Array.from({ length: 30 }, (_, i) => i) },
  meta: (p) => ({ title: `Computer Bleeps ${p.seed + 1}`, tags: ['computer', 'bleeps', 'data', 'processing', 'sci-fi', 'robot', 'terminal', 'electronic'],
    desc: `A burst of computer bleeps and bloops, like a ${pick(['terminal processing data', 'robot thinking', 'spaceship console', 'retro mainframe', 'droid replying'], p.seed)}.` }),
  render: (p) => { const r = rng(5100 + p.seed); const notes = []; let t = 0; const L = 0.8 + r() * 1.4; const dens = 0.04 + r() * 0.08; const wave = r() < 0.5 ? square : sin; while (t < L) { const d = dens * (0.5 + r()); notes.push({ start: t, dur: d, f: 400 + r() * 2400 }); t += d * (1 + r() * 0.6); }
    const f = sequence(notes, (n, lt) => (lt < n.dur ? 1 : 0) * wave(n.f * lt) * 0.3, 0); const lp = lowpass(5000); return render(L + 0.1, (x) => lp(f(x))); } });

G({ id: 'magic', cat: 'Fantasy', kind: 'sfx', grid: { type: [0, 1, 2], f: [0, 1, 2], len: [0, 1, 2] },
  meta: (p) => ({ title: `${['Sparkle', 'Spell Cast', 'Healing'][p.type]} ${p.f * 3 + p.len + 1}`, tags: ['magic', 'fantasy', 'spell', 'sparkle', 'wizard', 'fairy', ['sparkle', 'cast', 'heal'][p.type]],
    desc: `A ${['short', 'medium', 'long'][p.len]} magical ${['sparkle of glittering chimes', 'spell cast that charges and bursts', 'healing shimmer that rises gently'][p.type]}.` }),
  render: (p) => { const L = [1, 2, 3.2][p.len]; const r = rng(5200 + p.type * 9 + p.f * 3 + p.len); const base = [2000, 3000, 4500][p.f]; const sparks = scatter(5201 + p.type * 9 + p.f * 3 + p.len, L * 0.8, 40).map((s) => ({ start: s, dur: 0.2, f: base * (0.6 + r() * 1.4) })); const sp = sequence(sparks, (x, lt) => sin(x.f * lt) * expDecay(lt, 18), 0.2); const ph = phasor(); const rv = reverb(0.45, 1.4); const n = noise(5202); const bp = bandpass(1000, 3);
    return render(L + 0.8, (t) => { const x = Math.min(1, t / L); const body = p.type === 0 ? 0 : p.type === 1 ? (x < 0.5 ? sin(ph(300 * 2 ** (x * 6))) * x : bp(n(), 2000) * expDecay(t - L / 2, 5)) * 0.4 : sin(ph(base / 6 * (1 + x))) * Math.sin(Math.PI * x) * 0.3; return rv(sp(t) * 0.3 * Math.sin(Math.PI * x) + body); }); } });

G({ id: 'stinger', cat: 'Horror', kind: 'sfx', grid: { dis: [0, 1, 2], reg: [0, 1, 2], len: [0, 1] },
  meta: (p) => ({ title: `Horror ${['Tension', 'Dread', 'Shock'][p.dis]} Stinger (${['low', 'mid', 'high'][p.reg]}${p.len ? ', long' : ''})`, tags: ['horror', 'stinger', 'jump scare', 'tension', 'scary', 'strings', 'suspense', 'creepy'],
    desc: `A ${['tense', 'dreadful', 'shocking'][p.dis]} string cluster in the ${['low', 'middle', 'high'][p.reg]} register that ${p.len ? 'swells slowly' : 'stabs fast'}.` }),
  render: (p) => { const base = [40, 55, 70][p.reg]; const cl = [[0, 1, 6], [0, 1, 2, 3], [0, 1, 2, 3, 4, 6]][p.dis]; const L = p.len ? 4 : 2; const notes = cl.map((o) => ({ note: base + o, start: 0, dur: L * 0.8 })); const f = sequence(notes, slowStrings, 0.8); const rv = reverb(0.4, 1.5); const lp = lowpass(5000);
    return render(L + 0.8, (t) => rv(lp(f(t))) * (p.len ? Math.min(1, (t / (L * 0.8)) ** 2) : Math.min(1, t * 20)) * 1.5); } });

G({ id: 'heart', cat: 'Horror', kind: 'sfx', loop: true, grid: { bpm: [0, 1, 2, 3, 4], i: [0, 1] },
  meta: (p) => ({ title: `Heartbeat ${[50, 70, 95, 120, 150][p.bpm]} BPM${p.i ? ' (pounding)' : ''}`, bpm: [50, 70, 95, 120, 150][p.bpm], loop: true, tags: ['heartbeat', 'pulse', 'heart', 'tension', 'horror', 'medical', 'loop'],
    desc: `A steady ${p.i ? 'pounding' : 'soft'} heartbeat at ${[50, 70, 95, 120, 150][p.bpm]} beats per minute, from ${['resting', 'calm', 'nervous', 'anxious', 'panicked'][p.bpm]}. Loops seamlessly.` }),
  render: (p) => { const bpm = [50, 70, 95, 120, 150][p.bpm]; const per = 60 / bpm; const cnt = Math.max(4, Math.round(6 / per)); const L = cnt * per; const beats = []; for (let i = 0; i < cnt; i++) { beats.push({ start: i * per, dur: 0.3, g: 1 }); beats.push({ start: i * per + per * 0.28, dur: 0.3, g: 0.7 }); } const lp = lowpass(150); const f = sequence(beats, (b, lt) => b.g * sin(48 * lt) * expDecay(lt, 14), 0.3); return loopRender(L, (t) => lp(f(t)) * (p.i ? 4 : 2.5), 0.5); } });

G({ id: 'typing', cat: 'Household', kind: 'sfx', grid: { sp: [0, 1, 2], cl: [0, 1, 2] },
  meta: (p) => ({ title: `Typing on a ${['Laptop', 'Office', 'Mechanical'][p.cl]} Keyboard (${['slow', 'steady', 'fast'][p.sp]})`, tags: ['typing', 'keyboard', 'computer', 'office', 'keys', 'writing', ['laptop', 'office', 'mechanical'][p.cl]],
    desc: `${['Slow', 'Steady', 'Fast'][p.sp]} typing on a ${['quiet laptop', 'standard office', 'clicky mechanical'][p.cl]} keyboard, with the occasional space bar.` }),
  render: (p) => { const r = rng(5300 + p.sp * 3 + p.cl); const keys = []; let t = 0.05; const g = [0.22, 0.13, 0.08][p.sp]; while (t < 4) { const sp = r() < 0.15; keys.push({ start: t, dur: 0.06, sp, f: [1800, 2600, 3200][p.cl] * (0.8 + r() * 0.4) }); t += sp ? g * 2 : g * (0.6 + r() * 0.8); } const n = noise(5301 + p.cl); const bp = bandpass(3000, 2);
    const f = sequence(keys, (k, lt) => (k.sp ? sin(170 * lt) * expDecay(lt, 40) * 0.6 : 0) + bp(n(), k.f) * [1, 1.6, 2.4][p.cl] * expDecay(lt, [140, 110, 90][p.cl]), 0.08); return render(4.1, f); } });

G({ id: 'glass', cat: 'Impacts', kind: 'sfx', grid: { size: [0, 1, 2], dens: [0, 1, 2] },
  meta: (p) => ({ title: `Glass ${['Clink', 'Break', 'Shatter'][p.size]} ${p.dens + 1}`, tags: ['glass', 'break', 'shatter', 'smash', 'crash', 'window', 'bottle'],
    desc: `${['A small glass clink and crack', 'A bottle breaking', 'A window shattering'][p.size]} with ${['a few', 'scattered', 'lots of'][p.dens]} tinkling shards.` }),
  render: (p) => { const r = rng(5400 + p.size * 3 + p.dens); const n = noise(5401 + p.size); const hp = highpass(2500); const sh = scatter(5402 + p.size * 3 + p.dens, 1.6, [8, 18, 35][p.dens]).map((s) => ({ start: s * s * 0.8 + 0.02, dur: 0.08, f: 3000 + r() * 6000, g: (0.3 + r() * 0.7) * expDecay(s, 1.2) })); const tk = sequence(sh, (s, lt) => s.g * (sin(s.f * lt) + 0.5 * sin(s.f * 2.3 * lt)) * expDecay(lt, 40), 0.1);
    return render([1, 1.8, 2.4][p.size], (t) => hp(n()) * expDecay(t, [30, 18, 12][p.size]) * [0.5, 0.9, 1.2][p.size] + tk(t) * 0.5); } });

G({ id: 'coins', cat: 'Game', kind: 'sfx', grid: { cnt: [0, 1, 2], f: [0, 1, 2] },
  meta: (p) => ({ title: `${['Coin Drop', 'Handful of Coins', 'Coin Jackpot'][p.cnt]} ${p.f + 1}`, tags: ['coins', 'money', 'cash', 'treasure', 'reward', 'casino', 'jackpot'],
    desc: `${['A single coin dropping and spinning', 'A handful of coins spilling', 'A pouring jackpot of coins'][p.cnt]}, ${['dull', 'bright', 'shiny'][p.f]} tone.` }),
  render: (p) => { const r = rng(5500 + p.cnt * 3 + p.f); const n = [1, 8, 40][p.cnt]; const L = [1, 1.4, 2.4][p.cnt]; const base = [2200, 3200, 4200][p.f]; const cs = (p.cnt === 0 ? [0.02, 0.2, 0.32, 0.4, 0.45, 0.48] : scatter(5501 + p.f, L - 0.4, n / (L - 0.4))).map((s, i) => ({ start: s, dur: 0.3, f: base * (0.85 + r() * 0.3), g: p.cnt === 0 ? 0.8 ** i : 0.4 + r() * 0.6 }));
    const f = sequence(cs, (c, lt) => c.g * metalTone(c.f, [1, 1.47, 2.09], 10)(lt), 0.3); const rv = reverb(0.2); return render(L, (t) => rv(f(t) * 0.4)); } });

// ---------- ambience beds (seamless 20 s loops) ----------
const amb = (id, cat, grid, meta, render) => G({ id, cat, kind: 'sfx', loop: true, layer: true, xfade: true, wide: true, grid, meta: (p) => ({ ...meta(p), loop: true, layer: true }), render });
amb('rain', 'Ambience Layers', { int: [0, 1, 2, 3], tone: [0, 1, 2] }, (p) => ({ title: `${['Drizzle', 'Steady Rain', 'Heavy Rain', 'Downpour'][p.int]} (${['on leaves', 'on a roof', 'on pavement'][p.tone]})`, tags: ['rain', 'weather', 'storm', 'ambience', 'layer', 'loop', ['drizzle', 'steady', 'heavy', 'downpour'][p.int], ['leaves', 'roof', 'pavement'][p.tone]],
  desc: `${['A light drizzle', 'Steady rain', 'Heavy rain', 'A pounding downpour'][p.int]} falling ${['on leaves', 'on a roof', 'on pavement'][p.tone]}. Seamless loop for layering.` }),
  (p) => { const pn = pinkNoise(6000 + p.int * 3 + p.tone); const n = noise(6001 + p.int); const hp = highpass([1800, 700, 400][p.tone]); const lp = lowpass([7000, 5000, 9000][p.tone]); const r = rng(6002 + p.int * 3 + p.tone); let d = 0; const rate = [0.0012, 0.002, 0.003, 0.004][p.int];
    return loopRender(20, () => { if (r() < rate) d = 0.3 + r() * 0.7; d *= 0.993; return lp(hp(pn() * [0.4, 0.7, 1, 1.3][p.int] + n() * [0, 0.1, 0.3, 0.5][p.int])) + hp(n()) * d * 0.25; }); });
amb('wind', 'Ambience Layers', { sp: [0, 1, 2, 3], tone: [0, 1, 2] }, (p) => ({ title: `${['Gentle Breeze', 'Steady Wind', 'Strong Wind', 'Howling Gale'][p.sp]} (${['low', 'whistling', 'airy'][p.tone]})`, tags: ['wind', 'breeze', 'gust', 'storm', 'weather', 'ambience', 'layer', 'loop', ['breeze', 'steady', 'strong', 'gale'][p.sp]],
  desc: `${['A gentle breeze', 'A steady wind', 'Strong, gusting wind', 'A howling gale'][p.sp]} with a ${['low, rumbling', 'whistling', 'light, airy'][p.tone]} tone. Seamless loop.` }),
  (p) => { const n = noise(6100 + p.sp * 3 + p.tone); const bp = bandpass([300, 600, 1200][p.tone], [1.5, 6, 1][p.tone]); const b = brownNoise(6101 + p.sp); const per = [10, 7, 5, 4][p.sp];
    return loopRender(20, (t) => { const g = 0.5 + 0.3 * Math.sin(TAU * t / per) + 0.2 * Math.sin(TAU * t / (per * 0.37) + 1); return bp(n(), [300, 600, 1200][p.tone] * (0.6 + 0.6 * g)) * g * [0.5, 0.8, 1.1, 1.4][p.sp] + b() * 0.3 * g * (p.sp / 3); }); });
amb('ocean', 'Ambience Layers', { per: [0, 1, 2], dist: [0, 1] }, (p) => ({ title: `Ocean Waves (${['gentle', 'rolling', 'crashing'][p.per]}, ${p.dist ? 'distant' : 'close'})`, tags: ['ocean', 'waves', 'sea', 'beach', 'shore', 'surf', 'ambience', 'layer', 'loop'],
  desc: `${['Gentle', 'Rolling', 'Crashing'][p.per]} waves on a beach, heard from ${p.dist ? 'a distance' : 'the shoreline'}. Seamless loop.` }),
  (p) => { const b = brownNoise(6200 + p.per * 3 + p.dist); const pn = pinkNoise(6201 + p.per); const lp = lowpass(p.dist ? 400 : 900); const per = [10, 6.67, 5][p.per];
    return loopRender(20, (t) => { const sw = 0.5 - 0.5 * Math.cos(TAU * t / per); return b() * (0.2 + 0.8 * sw) * 0.8 + lp(pn(), 300 + (p.dist ? 800 : 2500) * sw) * sw * [0.6, 0.9, 1.3][p.per]; }); });
amb('night', 'Ambience Layers', { dens: [0, 1, 2], f: [0, 1] }, (p) => ({ title: `Night Insects (${['sparse', 'chorus', 'dense'][p.dens]}, ${p.f ? 'high' : 'low'})`, tags: ['crickets', 'insects', 'night', 'summer', 'countryside', 'ambience', 'layer', 'loop'],
  desc: `A summer night with ${['a few crickets', 'a chorus of crickets', 'a dense field of insects'][p.dens]} chirping. Seamless loop.` }),
  (p) => { const vc = [2, 4, 7][p.dens]; const r = rng(6300 + p.dens * 3 + p.f); const pg = panned(); const voices = Array.from({ length: vc }, () => [(p.f ? 4800 : 3800) + r() * 900, r() * 0.9, [1, 0.9, 1.25][Math.floor(r() * 3)], pg((r() - 0.5) * 1.6)]); const pn = pinkNoise(6301); const lp = lowpass(500);
    return loopRender(20, (t) => { let s = 0; for (const [f, off, per, g] of voices) { const cyc = ((t + off) % (0.8 * per)); s += (cyc < 0.22 ? 1 : 0) * Math.max(0, Math.sin(TAU * 30 * cyc)) ** 3 * sin(f * t) * 0.22 * g; } return s + lp(pn()) * 0.1; }); });
amb('birds', 'Ambience Layers', { dens: [0, 1, 2, 3], tone: [0, 1] }, (p) => ({ title: `Birdsong (${['quiet', 'lively', 'busy', 'dawn chorus'][p.dens]}, ${p.tone ? 'meadow' : 'forest'})`, tags: ['birds', 'birdsong', 'forest', 'morning', 'spring', 'nature', 'ambience', 'layer', 'loop'],
  desc: `${['A few birds', 'Lively birdsong', 'Busy birdsong', 'A full dawn chorus'][p.dens]} in a ${p.tone ? 'sunny meadow' : 'leafy forest'}. Seamless loop.` }),
  (p) => { const r = rng(6400 + p.dens * 3 + p.tone); const calls = []; const pg = panned(); for (const t of scatter(6401 + p.dens * 3 + p.tone, 19, [0.6, 1.4, 2.4, 4][p.dens])) { const base = 2400 + r() * 2600; const pan = (r() - 0.5) * 1.6; const kind = Math.floor(r() * 3); const cnt = 2 + Math.floor(r() * 5); for (let k = 0; k < cnt; k++) calls.push({ start: t + k * (0.07 + r() * 0.05), dur: 0.06, base, kind, g: (0.5 + r() * 0.5) * pg(pan) }); }
    const f = sequence(calls, (c, lt) => { const x = lt / c.dur; if (x > 1) return 0; const sw = c.kind === 0 ? 1 + 0.5 * x : c.kind === 1 ? 1.4 - 0.5 * x : 1 + 0.15 * Math.sin(TAU * 3 * x); return c.g * Math.sin(Math.PI * x) ** 2 * sin(c.base * sw * lt); }, 0); const pn = pinkNoise(6402); const lp = lowpass(p.tone ? 1500 : 800); const rv = reverb(p.tone ? 0.1 : 0.3, 1.2);
    return loopRender(20, (t) => rv(f(t) * 0.35) + lp(pn()) * 0.12); });
amb('fire', 'Ambience Layers', { size: [0, 1, 2] }, (p) => ({ title: `${['Candle and Small Fire', 'Fireplace', 'Roaring Bonfire'][p.size]}`, tags: ['fire', 'fireplace', 'crackle', 'campfire', 'cozy', 'ambience', 'layer', 'loop'],
  desc: `${['A small, gentle fire', 'A cozy fireplace', 'A big roaring bonfire'][p.size]} crackling and popping. Seamless loop.` }),
  (p) => { const b = brownNoise(6500 + p.size); const r = rng(6501 + p.size); const n = noise(6502); const hp = highpass(1500); let pop = 0; return loopRender(20, () => { if (r() < [0.0006, 0.0012, 0.002][p.size]) pop = 0.5 + r(); pop *= 0.985; return b() * [0.2, 0.45, 0.8][p.size] + hp(n()) * pop; }); });
amb('stream', 'Ambience Layers', { size: [0, 1, 2] }, (p) => ({ title: `${['Trickling Creek', 'Babbling Brook', 'Rushing River'][p.size]}`, tags: ['water', 'stream', 'creek', 'river', 'brook', 'flowing', 'nature', 'ambience', 'layer', 'loop'],
  desc: `${['A tiny trickling creek', 'A babbling brook over stones', 'A fast, rushing river'][p.size]}. Seamless loop.` }),
  (p) => { const pn = pinkNoise(6600 + p.size); const bp = bandpass(1200, 1); const r = rng(6601 + p.size); const bubs = scatter(6602 + p.size, 19.5, [25, 18, 10][p.size]).map((s) => ({ start: s, dur: 0.05, f: 500 + r() * 1100, g: 0.3 + r() * 0.5 })); const bb = sequence(bubs, (x, lt) => x.g * sin(x.f * (1 + 6 * lt) * lt) * expDecay(lt, 45), 0.06); const b = brownNoise(6603);
    return loopRender(20, (t) => bp(pn(), 900 + 400 * Math.sin(TAU * 0.4 * t)) * [0.6, 0.9, 1.1][p.size] + bb(t) * [0.4, 0.3, 0.15][p.size] + b() * [0, 0.2, 0.6][p.size]); });
amb('crowd', 'Ambience Layers', { size: [0, 1, 2, 3], ex: [0, 1] }, (p) => ({ title: `${['Small Room', 'Busy Hall', 'Arena', 'Stadium'][p.size]} Crowd (${p.ex ? 'excited' : 'murmuring'})`, tags: ['crowd', 'people', 'chatter', 'audience', 'ambience', 'layer', 'loop', p.ex ? 'cheering' : 'murmur', ['room', 'hall', 'arena', 'stadium'][p.size]],
  desc: `A ${['small room', 'busy hall', 'large arena', 'packed stadium'][p.size]} of people ${p.ex ? 'excited and cheering on and off' : 'talking in a low murmur'}. Seamless loop.` }),
  (p) => { const pn = pinkNoise(6700 + p.size * 3 + p.ex); const f1 = bandpass(500, 2), f2 = bandpass(1200, 2.5); const rv = reverb([0.1, 0.25, 0.4, 0.5][p.size], [0.6, 1, 1.4, 1.7][p.size]); const n = noise(6701); const hp = highpass(2500); const cl = scatter(6702 + p.size, 19.5, p.ex ? 12 : 1); let ci = 0, c = 0;
    return loopRender(20, (t) => { while (ci < cl.length && t >= cl[ci]) { c = 0.4; ci++; } c *= 0.99; const v = 0.6 + 0.2 * Math.sin(TAU * 3.1 * t) * Math.sin(TAU * 1.7 * t) + (p.ex ? 0.4 * Math.max(0, Math.sin(TAU * t / 10)) ** 3 : 0); const x = pn(); return rv((f1(x) + f2(x) * 0.6) * v * 1.3 + hp(n()) * c * 0.3); }); });
amb('drone', 'Ambience Layers', { f: [0, 1, 2, 3, 4], tex: [0, 1, 2] }, (p) => ({ title: `${['Deep Space', 'Engine Room', 'Cavern', 'Reactor', 'Hyperspace'][p.f]} Drone (${['smooth', 'pulsing', 'gritty'][p.tex]})`, tags: ['drone', 'hum', 'sci-fi', 'space', 'dark', 'ambient', 'atmosphere', 'layer', 'loop', ['space', 'engine', 'cave', 'reactor', 'hyperspace'][p.f]],
  desc: `A ${['smooth', 'slowly pulsing', 'gritty'][p.tex]} ${['deep-space', 'engine-room', 'underground cavern', 'reactor-core', 'hyperspace'][p.f]} drone. Seamless background layer.` }),
  (p) => { const f0 = [36, 48, 55, 62, 74][p.f]; const pn = pinkNoise(6800 + p.f * 3 + p.tex); const lp = lowpass(600); const rv = reverb(0.4, 1.5);
    return loopRender(20, (t) => { const pulse = p.tex === 1 ? 0.6 + 0.4 * Math.sin(TAU * t / 2.5) : 1; const tone = sin(f0 * t) * 0.4 + sin(f0 * 1.5 * t + 0.4 * Math.sin(TAU * t / 10)) * 0.2 + (p.tex === 2 ? saw(f0 * 2 * t) * 0.08 : 0); return rv((tone + lp(pn(), 200 + 300 * (0.5 + 0.5 * Math.sin(TAU * t / 20))) * 0.4) * pulse); }); });
amb('roomtone', 'Ambience Layers', { type: [0, 1, 2, 3] }, (p) => ({ title: `Room Tone: ${['Quiet Bedroom', 'Office with AC', 'Server Room', 'Empty Warehouse'][p.type]}`, tags: ['room tone', 'background', 'hum', 'indoor', 'quiet', 'ambience', 'layer', 'loop', ['bedroom', 'office', 'server', 'warehouse'][p.type]],
  desc: `The background sound of ${['a quiet bedroom', 'an office with air conditioning', 'a humming server room', 'a big empty warehouse'][p.type]}. Fills silence in edits. Seamless loop.` }),
  (p) => { const b = brownNoise(6900 + p.type); const pn = pinkNoise(6901 + p.type); const lp = lowpass([500, 1200, 3000, 400][p.type]); const rv = reverb(p.type === 3 ? 0.5 : 0.05, 1.6); return loopRender(20, (t) => rv(lp(pn()) * [0.2, 0.4, 0.5, 0.3][p.type] + b() * 0.25 + [0, 0.04, 0.08, 0][p.type] * (sin(60 * t) + 0.6 * sin(120 * t) + 0.3 * sin(180 * t)) + (p.type === 2 ? sin(3150 * t) * 0.006 : 0))); });

G({ id: 'clock', cat: 'Household', kind: 'sfx', loop: true, grid: { tempo: [0, 1, 2, 3], f: [0, 1] },
  meta: (p) => ({ title: `Clock Ticking (${['slow', 'normal', 'fast', 'racing'][p.tempo]}, ${p.f ? 'small' : 'grandfather'})`, loop: true, bpm: [60, 120, 180, 240][p.tempo], tags: ['clock', 'ticking', 'tick tock', 'time', 'countdown', 'tension', 'loop'],
    desc: `A ${p.f ? 'small desk' : 'grandfather'} clock ticking at ${['a slow', 'a normal', 'a fast', 'a racing'][p.tempo]} pace (${[60, 120, 180, 240][p.tempo]} ticks a minute). Seamless loop.` }),
  render: (p) => { const per = 60 / [60, 120, 180, 240][p.tempo]; const n = noise(7000 + p.tempo * 3 + p.f); const bp1 = bandpass(p.f ? 3500 : 1800, 5), bp2 = bandpass(p.f ? 2800 : 1400, 5); const cnt = Math.round(8 / per); const rv = reverb(p.f ? 0.1 : 0.25);
    const f = sequence(Array.from({ length: cnt }, (_, i) => ({ start: i * per, dur: 0.05, hi: i % 2 === 0 })), (x, lt) => (x.hi ? bp1(n()) : bp2(n())) * expDecay(lt, 90) * 3, 0.05); return loopRender(cnt * per, (t) => rv(f(t)), 0.5); } });

// ======================= MUSIC =======================
const DRUMS = [
  ['House', 'x...x...x...x...', '....x.......x...', '..x...x...x...x.'], ['Techno', 'x...x...x...x...', '....x.......x...', 'xxxxxxxxxxxxxxxx'],
  ['Boom Bap', 'x.....x...x..x..', '....x.......x...', 'x.x.x.x.x.x.x.xx'], ['Trap', 'x......x..x.....', '........x.......', 'xxxxxxxxxxxxxxxx'],
  ['Drum and Bass', 'x.........x.....', '....x.......x...', 'x.xxx.xxx.xxx.xx'], ['Rock', 'x.......x.x.....', '....x.......x...', 'x.x.x.x.x.x.x.x.'],
  ['Funk', 'x..x..x...x..x..', '....x..x.x..x...', 'xxxxxxxxxxxxxxxx'], ['Reggae One Drop', '........x.......', '........x.......', 'x.x.x.x.x.x.x.x.'],
  ['Lo-fi', 'x......x..x.....', '....x.......x...', 'x.x.x.x.x.x.x.x.'], ['Breakbeat', 'x.x.......x.....', '....x..x.x..x..x', 'x.x.x.x.x.x.x.x.'],
  ['Disco', 'x...x...x...x...', '....x.......x...', '.x.x.x.x.x.x.x.x'], ['Half-time', 'x.........x.....', '........x.......', 'x.x.x.x.x.x.x.x.'],
];
G({ id: 'drumloop', cat: 'Drum Loops', kind: 'music', loop: true, grid: { g: DRUMS.map((_, i) => i), bpm: [80, 90, 100, 110, 120, 140, 170] },
  meta: (p) => ({ title: `${DRUMS[p.g][0]} Drums · ${p.bpm} BPM`, bpm: p.bpm, loop: true, mood: ['Energetic', 'Driving', 'Groovy', 'Dark', 'Energetic', 'Driving', 'Groovy', 'Relaxed', 'Calm', 'Groovy', 'Happy', 'Heavy'][p.g],
    tags: ['drums', 'beat', 'drum loop', 'percussion', 'loop', DRUMS[p.g][0].toLowerCase(), `${p.bpm} bpm`], desc: `A four-bar ${DRUMS[p.g][0].toLowerCase()} drum loop at ${p.bpm} BPM. Layer it with chord, bass and melody loops at the same tempo.` }),
  render: (p) => { const [, k, s, h] = DRUMS[p.g]; const d = drums({ bpm: p.bpm, bars: 4, k, s, h, seed: 7100 + p.g }); const lp = lowpass(p.g === 8 ? 3000 : 16000); return loopRender(16 * beat(p.bpm), (t) => lp(d(t)), 1); } });

const SONG_BPMS = [90, 100, 120];
const songMeta = (kind, inst) => (p) => { const pr = PROGS[p.prog]; const key = keyName(p.key, pr.minor); return { title: `${inst ? inst + ' ' : ''}${kind} · ${pr.name} · ${key} · ${p.bpm} BPM`, key, bpm: p.bpm, loop: true, mood: pr.mood,
  tags: [kind.toLowerCase(), inst ? inst.toLowerCase() : 'loop', 'songwriter', 'progression', pr.name.toLowerCase(), key.toLowerCase(), pr.minor ? 'minor' : 'major', `${p.bpm} bpm`, 'loop'],
  desc: `A four-bar ${inst ? inst.toLowerCase() + ' ' : ''}${kind.toLowerCase()} loop playing the ${pr.name} progression in ${key} at ${p.bpm} BPM. Layers with every other loop in the same key and tempo.` }; };
const songGrid = (extra = {}) => ({ prog: PROGS.map((_, i) => i), key: NOTES.map((_, i) => i), bpm: SONG_BPMS, ...extra });
const INSTS = ['Pad', 'Piano', 'Guitar', 'Strings'];
G({ id: 'chords', cat: 'Chord Loops', kind: 'music', loop: true, grid: songGrid({ inst: [0, 1, 2, 3] }), meta: (p) => songMeta('Chords', INSTS[p.inst])(p),
  render: (p) => { const B = beat(p.bpm); const pr = PROGS[p.prog]; const L = 16 * B; let notes = [];
    for (let i = 0; i < 4; i++) { const ch = chordNotes(p.key, pr, i, p.key > 6 ? 48 : 60); const t0 = i * 4 * B;
      if (p.inst === 0 || p.inst === 3) notes.push(...ch.map((note) => ({ note, start: t0, dur: 4 * B * 0.98 })));
      else if (p.inst === 1) [0, 1.5, 2.5].forEach((o) => notes.push(...ch.map((note, k) => ({ note, start: t0 + o * B + k * 0.008, dur: B }))));
      else [0, 1, 1.5, 2.5, 3, 3.5].forEach((o, j) => notes.push(...ch.map((note, k) => ({ note: note + (k === 0 ? -12 : 0), start: t0 + o * B + k * 0.012 * (j % 2 ? -1 : 1) + 0.03, dur: B * 0.5 })))); }
    const voice = [pad, piano, pluckV, slowStrings][p.inst]; const f = sequence(notes, voice, 1.5); const lp = lowpass([1800, 4000, 3500, 2600][p.inst]); const rv = reverb(0.25, 1.2); return loopRender(L, (t) => rv(lp(f(t)))); } });
G({ id: 'bass', cat: 'Bass Loops', kind: 'music', loop: true, grid: songGrid({ st: [0, 1] }), meta: (p) => songMeta('Bass', ['Sub', 'Pulse'][p.st])(p),
  render: (p) => { const B = beat(p.bpm); const pr = PROGS[p.prog]; const notes = [];
    for (let i = 0; i < 4; i++) { const r = chordNotes(p.key, pr, i, 36)[0]; const t0 = i * 4 * B; if (p.st === 0) { notes.push({ note: r, start: t0, dur: 2.5 * B }, { note: r, start: t0 + 2.5 * B, dur: 1.4 * B }); } else for (let k = 0; k < 8; k++) notes.push({ note: r + (k % 4 === 3 ? 12 : 0), start: t0 + k * B / 2, dur: B / 2 * 0.8 }); }
    const f = sequence(notes, (n, lt) => (p.st ? sat(saw(midi(n.note) * lt), 1.4) * 0.6 : sin(midi(n.note) * lt) + 0.3 * sin(midi(n.note) * 2 * lt)) * adsr(lt, 0.006, 0.15, 0.7, 0.06, n.dur), 0.2); const lp = lowpass(p.st ? 700 : 400); return loopRender(16 * B, (t) => lp(f(t)), 1); } });
G({ id: 'arp', cat: 'Arpeggio Loops', kind: 'music', loop: true, grid: songGrid(), meta: songMeta('Arpeggio', ''),
  render: (p) => { const B = beat(p.bpm); const pr = PROGS[p.prog]; const notes = [];
    for (let i = 0; i < 4; i++) { const ch = chordNotes(p.key, pr, i, 60); const seq = [ch[0], ch[1], ch[2], ch[0] + 12, ch[2] + 12, ch[1] + 12, ch[2], ch[1]]; for (let k = 0; k < 16; k++) notes.push({ note: seq[k % 8], start: i * 4 * B + k * B / 4, dur: B / 4 * 0.8 }); }
    const f = sequence(notes, (n, lt) => (tri(midi(n.note) * lt) * 0.6 + sin(midi(n.note) * 2 * lt) * 0.2) * expDecay(lt, 10), 0.2); const dl = delay(B * 0.75, 0.35, 0.3); return loopRender(16 * B, (t) => dl(f(t))); } });
G({ id: 'melody', cat: 'Melody Loops', kind: 'music', loop: true, grid: songGrid(), meta: songMeta('Melody', ''),
  render: (p) => { const B = beat(p.bpm); const pr = PROGS[p.prog]; const r = rng(7300 + p.prog * 37 + p.key * 3 + p.bpm); const sc = pr.minor ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9]; const rhythms = [[0, 1, 1.5, 2, 3], [0, 0.5, 1, 2, 2.5, 3], [0, 1.5, 2, 3.5], [0, 0.75, 1.5, 2, 3]]; const notes = []; let last = 2;
    for (let bar = 0; bar < 4; bar++) { const ch = chordNotes(p.key, pr, bar, 72); const rh = rhythms[Math.floor(r() * rhythms.length)]; rh.forEach((o, j) => { last = Math.max(0, Math.min(9, last + Math.floor(r() * 5) - 2)); const note = j === 0 ? ch[Math.floor(r() * 3)] : 72 + p.key - (p.key > 6 ? 12 : 0) + sc[last % 5] + 12 * Math.floor(last / 5); const nxt = rh[j + 1] ?? 4; notes.push({ note, start: (bar * 4 + o) * B, dur: (nxt - o) * B * 0.9 }); }); }
    const f = sequence(notes, (n, lt) => { const fr = midi(n.note) * (1 + 0.004 * Math.sin(TAU * 5.5 * lt) * Math.min(1, lt * 3)); return (sin(fr * lt) * 0.6 + sin(fr * 2 * lt) * 0.12 + tri(fr * lt) * 0.15) * adsr(lt, 0.02, 0.2, 0.7, 0.15, n.dur); }, 0.4); const dl = delay(B * 0.75, 0.3, 0.25); const rv = reverb(0.2); return loopRender(16 * B, (t) => rv(dl(f(t)))); } });

// ---------- stem kits in every key (original key ships as MP3) ----------
const KITDEF = {
  neon: { bpm: 120, root: 9, minor: true, name: 'Neon Groove', ch: [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]], roots: [45, 41, 48, 43] },
  lofi: { bpm: 80, root: 0, minor: false, name: 'Rainy Lo-fi', ch: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]] },
  epic: { bpm: 100, root: 2, minor: true, name: 'Epic Trailer', ch: [[50, 53, 57], [50, 53, 58], [48, 53, 57], [48, 52, 55]], roots: [38, 34, 41, 36] },
};
const KITSTEMS = { neon: ['Bass', 'Chords', 'Lead', 'Arp'], lofi: ['Bass', 'Keys', 'Melody'], epic: ['Strings', 'Brass', 'Choir'] };
const kitGrid = [];
for (const kit of Object.keys(KITSTEMS)) for (const stem of KITSTEMS[kit]) for (let t = 1; t < 12; t++) kitGrid.push({ kit, stem, t });
G({ id: 'kitstem', cat: 'Stem Kits', kind: 'music', loop: true, list: kitGrid,
  meta: (p) => { const K = KITDEF[p.kit]; const root = (K.root + p.t) % 12; const key = keyName(root, K.minor); return { title: `${K.name} · ${p.stem} · ${key}`, kit: p.kit, stem: p.stem, key, bpm: K.bpm, loop: true, mood: p.kit === 'epic' ? 'Epic' : 'Energetic',
    tags: ['stem', 'kit', K.name.toLowerCase(), p.stem.toLowerCase(), key.toLowerCase(), 'transposed', 'loop'], desc: `The ${p.stem.toLowerCase()} stem of the ${K.name} kit, transposed to ${key} (${K.bpm} BPM). Layers with the other ${K.name} stems in the same key.` }; },
  render: (p) => { const K = KITDEF[p.kit]; const T = p.t > 6 ? p.t - 12 : p.t; const B = beat(K.bpm); const L = 32 * B; const ch = K.ch.map((c) => c.map((n) => n + T));
    if (p.kit === 'neon') {
      const roots = K.roots.map((r) => r + T);
      if (p.stem === 'Bass') { const pat = roots.flatMap((r) => [r, r, r + 12, r, r, r + 12, r, r + 7, r, r, r + 12, r, r + 10, r + 12, r, r + 7]); const f = sequence(grid(pat, B / 2, B / 2 * 0.8), (n, lt) => sat(saw(midi(n.note) * lt) + square(midi(n.note) * 0.5 * lt) * 0.4, 1.4) * adsr(lt, 0.005, 0.12, 0.5, 0.05, n.dur), 0.1); const lp = lowpass(900); return loopRender(L, (t) => lp(f(t), 500 + 500 * (0.5 + 0.5 * Math.sin(TAU * t / (4 * B))))); }
      if (p.stem === 'Chords') { const f = sequence(chords(ch, 8 * B), pad, 1.5); const lp = lowpass(2200); const rv = reverb(0.3, 1.2); return loopRender(L, (t) => rv(lp(f(t))) * (0.55 + 0.45 * Math.min(1, ((t % B) / B) * 2.2))); }
      if (p.stem === 'Lead') { const mel = [76, null, 72, 74, 76, null, 79, 76, 74, null, 72, null, 69, null, null, null, 72, null, 69, 72, 74, null, 72, 69, 67, null, 64, null, 65, 67, null, null, 76, null, 72, 74, 76, null, 79, 81, 79, null, 76, null, 74, null, null, null, 72, 74, 76, null, 74, 72, 71, null, 67, null, 69, null, null, null, null, null].map((n) => n == null ? null : n + T); const f = sequence(grid(mel, B / 2, B / 2 * 0.9), (n, lt) => (saw(midi(n.note) * lt) * 0.5 + square(midi(n.note) * 1.004 * lt) * 0.3) * adsr(lt, 0.01, 0.15, 0.6, 0.1, n.dur), 0.2); const lp = lowpass(3500); const dl = delay(B * 0.75, 0.35, 0.3); return loopRender(L, (t) => dl(lp(f(t)))); }
      const arp = ch.flatMap((c) => Array(32).fill(0).map((_, i) => c[[0, 1, 2, 1][i % 4]] + 12 + (i % 8 >= 4 ? 12 : 0))); const f = sequence(grid(arp, B / 4, B / 4 * 0.8), (n, lt) => (tri(midi(n.note) * lt) * 0.6 + sin(midi(n.note) * 2 * lt) * 0.2) * expDecay(lt, 10), 0.2); const dl = delay(B * 0.75, 0.4, 0.35); return loopRender(L, (t) => dl(f(t)));
    }
    if (p.kit === 'lofi') {
      if (p.stem === 'Bass') { const notes = ch.flatMap((c, i) => [0, 1].flatMap((b) => [{ note: c[0] - 12, start: (i * 8 + b * 4) * B, dur: B * 1.4 }, { note: c[2] - 12, start: (i * 8 + b * 4 + 1.5) * B, dur: B * 0.5 }, { note: c[0] - 12, start: (i * 8 + b * 4 + 2.5) * B, dur: B }])); const f = sequence(notes, (n, lt) => (sin(midi(n.note) * lt) + 0.25 * sin(midi(n.note) * 2 * lt)) * adsr(lt, 0.01, 0.3, 0.6, 0.1, n.dur), 0.2); return loopRender(L, f); }
      if (p.stem === 'Keys') { const notes = ch.flatMap((c, i) => [0, 1.5, 4, 5.5, 6.5].flatMap((o) => c.map((note, k) => ({ note, start: (i * 8 + o) * B + k * 0.012, dur: B * 2 })))); const f = sequence(notes, piano, 2); const lp = lowpass(2200); return loopRender(L, (t) => lp(f(t * (1 + 0.0015 * Math.sin(TAU * 0.4 * t)))) * 0.6); }
      const mel = [72, null, 76, null, 79, null, 77, 76, null, null, 74, null, null, null, null, null, 71, null, 74, null, 76, 74, 72, null, 69, null, null, null, 67, null, null, null, 72, null, 76, null, 81, null, 79, 77, 76, null, 74, null, null, null, null, null, 72, null, 71, null, 67, null, 69, null, 72, null, null, null, null, null, null, null].map((n) => n == null ? null : n + T); const f = sequence(grid(mel, B / 2, B / 2), (n, lt) => (sin(midi(n.note) * lt) * 0.6 + tri(midi(n.note) * 2 * lt) * 0.15) * expDecay(lt, 4) * Math.min(1, lt * 500), 0.6); const dl = delay(B * 0.75, 0.35, 0.3); const lp = lowpass(2500); return loopRender(L, (t) => dl(lp(f(t))));
    }
    const roots = K.roots.map((r) => r + T);
    if (p.stem === 'Strings') { const pat = roots.flatMap((r) => Array(16).fill(0).map((_, i) => r + 12 + [0, 0, 12, 0, 7, 0, 12, 7][i % 8])); const f = sequence(grid(pat, B / 2, B / 2 * 0.85), stringV, 0.1); const lp = lowpass(2600); const rv = reverb(0.25, 1.4); return loopRender(L, (t) => rv(lp(f(t)))); }
    if (p.stem === 'Brass') { const notes = ch.flatMap((c, i) => c.map((note) => ({ note: note - 12, start: i * 8 * B, dur: 7.5 * B, att: 1.2 }))); const f = sequence(notes, brassV, 0.8); const rv = reverb(0.35, 1.5); return loopRender(L, (t) => rv(f(t))); }
    const f = choirPad(chords(ch, 8 * B)); const rv = reverb(0.45, 1.7); return loopRender(L, (t) => rv(f(t)));
  } });

G({ id: 'sting', cat: 'Jingles', kind: 'music', grid: { type: [0, 1, 2, 3], key: NOTES.map((_, i) => i) },
  meta: (p) => { const minor = p.type === 1 || p.type === 3; const key = keyName(p.key, minor); return { title: `${['Success', 'Fail', 'Reveal', 'Impact'][p.type]} Sting · ${key}`, key, mood: ['Happy', 'Sad', 'Dreamy', 'Epic'][p.type],
    tags: ['sting', 'stinger', 'jingle', 'transition', ['success', 'fail', 'reveal', 'impact'][p.type], key.toLowerCase()], desc: `A short musical ${['success flourish', 'fail phrase', 'shimmering reveal', 'orchestral impact'][p.type]} in ${key}. Pick the key that matches your music.` }; },
  render: (p) => { const k = p.key > 6 ? p.key - 12 : p.key; const r = 60 + k;
    if (p.type === 0) { const f = sequence(grid([r, r + 4, r + 7, r + 12, r + 16], 0.08, 0.08).concat([r + 12, r + 16, r + 19].map((note) => ({ note, start: 0.45, dur: 1 }))), (n, lt) => (saw(midi(n.note) * lt) * 0.4 + tri(midi(n.note) * lt) * 0.4) * adsr(lt, 0.005, 0.2, 0.6, 0.6, n.dur), 0.8); const lp = lowpass(4000); return render(2.2, (t) => lp(f(t))); }
    if (p.type === 1) { const ph = phasor(); const lp = lowpass(2500); return render(2, (t) => { const i = Math.min(3, Math.floor(t / 0.25)); const note = [r + 7, r + 3, r, r - 1][i]; return lp(saw(ph(midi(note) * (i === 3 ? 1 - 0.06 * Math.min(1, (t - 0.75) / 0.8) : 1))) * 0.5) * (i < 3 ? expDecay(t % 0.25, 3) : expDecay(t - 0.75, 1.3)); }); }
    if (p.type === 2) { const notes = [r + 12, r + 16, r + 19, r + 23, r + 24].map((note, i) => ({ note, start: i * 0.06, dur: 2 })); const f = sequence(notes, (n, lt) => metalTone(midi(n.note), [1, 2, 3.01], 1.5)(lt) * 0.4, 1.5); const pd = sequence([r, r + 4, r + 7].map((note) => ({ note, start: 0, dur: 2 })), pad, 1.5); const rv = reverb(0.45, 1.5); return render(3.5, (t) => rv(f(t) + pd(t) * 0.3)); }
    const n = noise(7500 + p.key); const lp = lowpass(600); const br = sequence([r - 24, r - 12, r - 5, r + 3 - 12].map((note) => ({ note, start: 0, dur: 2.5, att: 0.03 })), brassV, 1.5); const rv = reverb(0.4, 1.7); return render(4.5, (t) => rv(sin(55 * t + 3 * (1 - Math.exp(-20 * t))) * expDecay(t, 2) + lp(n()) * expDecay(t, 10) * 2 + br(t) * 0.8)); } });

// ======================= BATCH 5: more families =======================
const L3 = (a, i) => a[i];
// ---------- weapons ----------
G({ id: 'gunshot', cat: 'Weapons', kind: 'sfx', grid: { type: [0, 1, 2, 3], dist: [0, 1, 2], env: [0, 1, 2] },
  meta: (p) => ({ title: `${L3(['Pistol', 'Rifle', 'Shotgun', 'Cannon'], p.type)} Shot (${L3(['close', 'mid-range', 'distant'], p.dist)}, ${L3(['dry', 'indoor', 'outdoor echo'], p.env)})`,
    tags: ['gunshot', 'gun', 'shot', 'weapon', 'bang', 'action', L3(['pistol', 'rifle', 'shotgun', 'cannon'], p.type), L3(['close', 'mid', 'distant'], p.dist)],
    desc: `A ${L3(['pistol', 'rifle', 'shotgun', 'cannon'], p.type)} firing, heard ${L3(['up close', 'from mid-range', 'from far away'], p.dist)}${L3(['', ' indoors', ' outdoors with an echo'], p.env)}.` }),
  render: (p) => { const n = noise(8000 + p.type * 9 + p.dist * 3 + p.env); const hp = highpass(1200); const lp = lowpass(L3([9000, 3500, 1200], p.dist)); const lpb = lowpass(300); const rv = reverb(L3([0.03, 0.3, 0.2], p.env), L3([0.5, 0.9, 1.7], p.env)); const dl = delay(0.35, 0.3, p.env === 2 ? 0.35 : 0);
    const crack = L3([45, 30, 22, 12], p.type); const body = L3([140, 90, 70, 40], p.type); const L = [1, 1.4, 1.6, 3][p.type] + p.env * 0.8;
    return render(L, (t) => dl(rv(lp(hp(n()) * expDecay(t, crack) * 1.4 + lpb(n()) * expDecay(t, crack / 3) * 2 + sin(body * t) * expDecay(t, 12) * 0.8) * L3([1, 0.7, 0.45], p.dist)))); } });
G({ id: 'reload', cat: 'Weapons', kind: 'sfx', grid: { type: [0, 1, 2, 3], v: [0, 1, 2] },
  meta: (p) => ({ title: `${L3(['Pistol Slide', 'Rifle Bolt', 'Shotgun Pump', 'Revolver Spin'], p.type)} ${p.v + 1}`, tags: ['reload', 'weapon', 'gun', 'mechanical', 'click', 'cock', L3(['pistol', 'rifle', 'shotgun', 'revolver'], p.type)],
    desc: `The mechanical clicks of a ${L3(['pistol slide racking', 'rifle bolt cycling', 'shotgun pump action', 'revolver cylinder spinning'], p.type)}.` }),
  render: (p) => { const r = rng(8100 + p.type * 3 + p.v); const pats = [[0, 0.18], [0, 0.12, 0.35, 0.45], [0, 0.22], Array.from({ length: 14 }, (_, i) => i * 0.045)]; const n = noise(8101 + p.type); const bp = bandpass(L3([2800, 2200, 1500, 3500], p.type) * (0.9 + p.v * 0.1), 3); const lp = lowpass(600); const mt = metalTone(1800 + p.v * 200, [1, 2.3, 3.9], 30);
    const f = sequence(pats[p.type].map((s, i) => ({ start: s + 0.03, dur: 0.1, g: p.type === 3 ? 0.5 : i % 2 ? 0.8 : 1 })), (k, lt) => k.g * (bp(n()) * 4 * expDecay(lt, 60) + lp(n()) * expDecay(lt, 40) * (p.type === 2 ? 2 : 0.6) + mt(lt) * 0.2), 0.1);
    return render(pats[p.type].at(-1) + 0.35, f); } });
G({ id: 'blade', cat: 'Weapons', kind: 'sfx', grid: { type: [0, 1, 2], f: [0, 1, 2, 3], w: [0, 1] },
  meta: (p) => ({ title: `Sword ${L3(['Swing', 'Clash', 'Unsheathe'], p.type)} ${p.f + 1}${p.w ? ' (heavy)' : ''}`, tags: ['sword', 'blade', 'metal', 'fight', 'medieval', 'combat', L3(['swing', 'clash', 'unsheathe'], p.type)],
    desc: `A ${p.w ? 'heavy' : 'light'} sword ${L3(['slicing through the air', 'clashing against another blade', 'being drawn from its sheath'], p.type)}.` }),
  render: (p) => { const n = noise(8200 + p.type * 9 + p.f * 2 + p.w); const f0 = [900, 1200, 1600, 2100][p.f] * (p.w ? 0.7 : 1); const bp = bandpass(800, 2); const hp = highpass(3000); const ring = metalTone(f0, [1, 1.5, 2.73, 3.9, 5.6], p.w ? 2.5 : 4);
    if (p.type === 0) return render(0.6, (t) => { const x = t / 0.5; return bp(n(), 400 + 2000 * Math.sin(Math.PI * Math.min(1, x))) * Math.sin(Math.PI * Math.min(1, x)) ** 2 * 1.6 + sin(f0 * 2 * t) * 0.05 * Math.sin(Math.PI * Math.min(1, x)); });
    if (p.type === 1) return render(1.6, (t) => ring(t) * 0.5 + hp(n()) * expDecay(t, 40) * 0.8);
    return render(1.2, (t) => { const x = Math.min(1, t / 0.9); return hp(n()) * (0.3 + x) * Math.min(1, (1.0 - t) * 8 + 0.0001) * 0.6 * (t < 1 ? 1 : 0) + sin(f0 * (1 + x * 0.3) * t) * 0.08 * x + (t > 0.9 ? ring(t - 0.9) * 0.3 : 0); }); } });

// ---------- animals ----------
G({ id: 'frog', cat: 'Animals', kind: 'sfx', grid: { sp: [0, 1, 2], cnt: [0, 1, 2] },
  meta: (p) => ({ title: `${L3(['Tree Frog', 'Bullfrog', 'Toad'], p.sp)} ${L3(['Croak', 'Croaks', 'Chorus'], p.cnt)}`, tags: ['frog', 'croak', 'pond', 'swamp', 'night', 'animal', 'nature', L3(['tree frog', 'bullfrog', 'toad'], p.sp)],
    desc: `${L3(['A single', 'A few', 'A chorus of'], p.cnt)} ${L3(['high, chirpy tree frog', 'deep bullfrog', 'trilling toad'], p.sp)} croak${p.cnt ? 's' : ''}.` }),
  render: (p) => { const r = rng(8300 + p.sp * 3 + p.cnt); const cnt = [1, 4, 12][p.cnt]; const L = [1, 3, 6][p.cnt]; const rate = [45, 22, 60][p.sp]; const form = [1800, 500, 1100][p.sp]; const len = [0.15, 0.5, 1.2][p.sp];
    const calls = Array.from({ length: cnt }, (_, i) => ({ start: p.cnt ? r() * (L - len - 0.2) : 0.05, dur: len, f: form * (0.85 + r() * 0.3), rt: rate * (0.9 + r() * 0.2) })); const bp = bandpass(form, 4); const rv = reverb(0.2);
    const f = sequence(calls, (c, lt) => { const pulse = Math.max(0, Math.sin(TAU * c.rt * lt)) ** 6; return lt < c.dur ? saw(c.f * 0.25 * lt) * pulse * Math.sin(Math.PI * lt / c.dur) : 0; }, 0);
    return render(L, (t) => rv(bp(f(t)) * 3)); } });
G({ id: 'buzz', cat: 'Animals', kind: 'sfx', grid: { sp: [0, 1, 2], d: [0, 1, 2] },
  meta: (p) => ({ title: `${L3(['Bee', 'Fly', 'Mosquito'], p.sp)} Buzzing ${L3(['Past', 'Around', 'Close By'], p.d)}`, tags: ['insect', 'buzz', 'buzzing', 'bug', 'animal', 'summer', L3(['bee', 'fly', 'mosquito'], p.sp)],
    desc: `A ${L3(['bee', 'housefly', 'mosquito'], p.sp)} buzzing ${L3(['past your ear', 'around the room', 'right next to you'], p.d)}.` }),
  render: (p) => { const f0 = [210, 170, 600][p.sp]; const ph = phasor(); const lp = lowpass(4000); const pg = panned(); const L = [2, 4, 3][p.d];
    return render(L, (t) => { const x = t / L; const near = p.d === 0 ? Math.exp(-((x - 0.5) ** 2) / 0.03) : p.d === 1 ? 0.4 + 0.4 * Math.sin(TAU * 0.7 * t) ** 2 : 0.8 + 0.2 * Math.sin(TAU * 3 * t); const dop = p.d === 0 ? 1 + 0.06 * Math.tanh((0.5 - x) * 8) : 1 + 0.03 * Math.sin(TAU * 0.9 * t);
      return lp(saw(ph(f0 * dop * (1 + 0.02 * Math.sin(TAU * 13 * t))))) * near * 0.6 * Math.min(1, t * 10) * Math.min(1, (L - t) * 10) * pg(p.d === 0 ? Math.tanh((x - 0.5) * 5) * 0.9 : 0.8 * Math.sin(TAU * 0.35 * t + p.sp)); }); } });
G({ id: 'owl', cat: 'Animals', kind: 'sfx', grid: { pat: [0, 1], f: [0, 1, 2, 3] },
  meta: (p) => ({ title: `Owl ${p.pat ? 'Hoot Series' : 'Hoot'} ${p.f + 1}`, tags: ['owl', 'hoot', 'night', 'forest', 'bird', 'animal', 'spooky'],
    desc: `${p.pat ? 'A rhythmic series of soft owl hoots' : 'Two breathy owl hoots'} in a quiet night forest, ${['deep', 'low', 'mid', 'high'][p.f]} pitch.` }),
  render: (p) => { const f0 = [300, 360, 420, 500][p.f]; const n = noise(8400 + p.f); const lp = lowpass(1200); const rv = reverb(0.35, 1.5); const hoots = p.pat ? [[0, 0.25], [0.45, 0.2], [0.75, 0.2], [1.05, 0.5]] : [[0, 0.3], [0.55, 0.9]];
    return render(hoots.at(-1)[0] + hoots.at(-1)[1] + 1, (t) => rv(hoots.reduce((a, [s, d]) => { const lt = t - s; return a + (lt > 0 && lt < d ? Math.sin(Math.PI * lt / d) ** 1.5 * (sin(f0 * (1 - 0.05 * lt / d) * lt) + lp(n()) * 0.12) : 0); }, 0)) * 0.7); } });
G({ id: 'howl', cat: 'Animals', kind: 'sfx', grid: { f: [0, 1, 2], shape: [0, 1, 2] },
  meta: (p) => ({ title: `Wolf Howl ${p.f * 3 + p.shape + 1}`, tags: ['wolf', 'howl', 'night', 'moon', 'animal', 'wild', 'spooky', 'werewolf'],
    desc: `A lone wolf howling at the moon: a ${['low', 'mid', 'high'][p.f]} voice that ${['rises and falls once', 'rises, wavers and drops', 'starts low and climbs'][p.shape]}.` }),
  render: (p) => { const f0 = [330, 420, 520][p.f]; const ph = phasor(); const f1 = bandpass(700, 5), f2 = bandpass(1200, 6); const n = noise(8500 + p.f * 3 + p.shape); const rv = reverb(0.45, 1.7); const L = 3.5;
    return render(L + 1.2, (t) => { const x = Math.min(1, t / L); const curve = p.shape === 0 ? Math.sin(Math.PI * x) : p.shape === 1 ? Math.sin(Math.PI * x) + 0.15 * Math.sin(TAU * 2.5 * x) : x ** 0.7; const f = f0 * (0.75 + 0.45 * curve) * (1 + 0.012 * Math.sin(TAU * 5.5 * t));
      const src = saw(ph(f)) * 0.6 + n() * 0.05; const env = t < L ? Math.min(1, t * 3) * Math.min(1, (L - t) * 2) : 0; return rv((f1(src, 600 + 400 * curve) + f2(src) * 0.5) * env * 2); }); } });
G({ id: 'whale', cat: 'Animals', kind: 'sfx', grid: { f: [0, 1, 2], v: [0, 1, 2] },
  meta: (p) => ({ title: `Whale Song ${p.f * 3 + p.v + 1}`, tags: ['whale', 'whale song', 'ocean', 'underwater', 'animal', 'deep sea', 'calm'],
    desc: `A distant whale calling through deep water: long, ${['very low', 'low', 'mid'][p.f]} gliding moans with an underwater echo.` }),
  render: (p) => { const r = rng(8600 + p.f * 3 + p.v); const f0 = [90, 160, 280][p.f]; const ph = phasor(); const rv = reverb(0.6, 1.8); const lp = lowpass(1500); const pts = Array.from({ length: 5 }, () => f0 * (0.7 + r() * 0.9)); const L = 6;
    return render(L + 2, (t) => { const x = Math.min(0.999, t / L) * (pts.length - 1); const i = Math.floor(x); const fr = pts[i] + (pts[i + 1] - pts[i]) * (0.5 - 0.5 * Math.cos(Math.PI * (x - i))); const env = t < L ? Math.sin(Math.PI * t / L) ** 0.6 : 0; return rv(lp(sin(ph(fr)) + 0.3 * sin(ph(0) * 2)) * env * 0.8); }); } });

// ---------- vehicles ----------
G({ id: 'engine', cat: 'Vehicles', kind: 'sfx', loop: true, xfade: true, grid: { size: [0, 1, 2], rpm: [0, 1, 2, 3] },
  meta: (p) => ({ title: `${L3(['Motorbike', 'Car', 'Truck'], p.size)} Engine ${L3(['Idle', 'Cruising', 'Revving', 'Full Throttle'], p.rpm)}`, loop: true, tags: ['engine', 'motor', 'vehicle', 'loop', L3(['motorbike', 'car', 'truck'], p.size), L3(['idle', 'cruising', 'revving', 'throttle'], p.rpm)],
    desc: `A ${L3(['motorbike', 'car', 'diesel truck'], p.size)} engine ${L3(['idling', 'cruising steadily', 'revving', 'at full throttle'], p.rpm)}. Seamless loop.` }),
  render: (p) => { const base = [22, 14, 8][p.size] * [1, 2, 3, 4.5][p.rpm]; const n = noise(8700 + p.size * 4 + p.rpm); const lp = lowpass(300 + base * 20); const ph = phasor(); const L = 4;
    return loopRender(L, (t) => { const wob = 1 + 0.02 * Math.sin(TAU * 0.5 * t) + (p.rpm === 2 ? 0.25 * Math.max(0, Math.sin(TAU * t / 2)) ** 2 : 0); const fire = Math.max(0, Math.sin(TAU * ph(base * wob))) ** 4; return lp(fire * 1.3 + n() * 0.25 * (0.4 + fire)) * 1.5; }, 0.5); } });
G({ id: 'passby', cat: 'Vehicles', kind: 'sfx', grid: { size: [0, 1, 2], sp: [0, 1, 2] },
  meta: (p) => ({ title: `${L3(['Motorbike', 'Car', 'Truck'], p.size)} Passing By (${L3(['slow', 'fast', 'very fast'], p.sp)})`, tags: ['pass by', 'drive by', 'vehicle', 'traffic', 'road', 'doppler', L3(['motorbike', 'car', 'truck'], p.size)],
    desc: `A ${L3(['motorbike', 'car', 'truck'], p.size)} driving past ${L3(['slowly', 'quickly', 'at high speed'], p.sp)}, with the pitch dropping as it goes by.` }),
  render: (p) => { const base = [40, 28, 16][p.size] * [1.4, 2, 3][p.sp]; const n = noise(8800 + p.size * 3 + p.sp); const pn = pinkNoise(8801); const lp = lowpass(2000); const ph = phasor(); const L = [6, 4, 3][p.sp]; const sh = [0.04, 0.08, 0.12][p.sp];
    const pg = panned(); return render(L, (t) => { const x = (t / L - 0.5) * 2; const near = 1 / (1 + 12 * x * x); const dop = 1 + sh * Math.tanh(-x * 6); const fire = Math.max(0, Math.sin(TAU * ph(base * dop))) ** 3; return lp(fire * 0.9 + n() * 0.3 + pn() * 0.6, 500 + 3000 * near) * near * 1.4 * pg(Math.tanh(x * 2.5) * 0.85); }); } });
G({ id: 'horn', cat: 'Vehicles', kind: 'sfx', grid: { type: [0, 1, 2, 3], f: [0, 1, 2] },
  meta: (p) => ({ title: `${L3(['Car Horn', 'Truck Air Horn', 'Bicycle Bell', 'Train Horn'], p.type)} ${p.f + 1}`, tags: ['horn', 'honk', 'vehicle', 'traffic', 'warning', L3(['car', 'truck', 'bicycle bell', 'train'], p.type)],
    desc: `A ${L3(['car horn honking twice', 'big truck air horn blast', 'bicycle bell ringing', 'train horn sounding in the distance'], p.type)}, ${['low', 'mid', 'high'][p.f]} pitch.` }),
  render: (p) => { const k = [0.85, 1, 1.2][p.f]; const lp = lowpass(2500); const rv = reverb(p.type === 3 ? 0.4 : 0.1, 1.6);
    if (p.type === 2) { const b = metalTone(2600 * k, [1, 1.47, 2.4], 3); return render(1.4, (t) => rv(b(t) + b(t - 0.18)) * 0.4); }
    const fr = p.type === 0 ? [405, 507] : p.type === 1 ? [233, 294, 349] : [262, 330, 392, 466]; const segs = p.type === 0 ? [[0, 0.18], [0.3, 0.6]] : p.type === 1 ? [[0, 1.4]] : [[0, 1], [1.3, 1.8]];
    return render(segs.at(-1)[0] + segs.at(-1)[1] + 0.8, (t) => { const on = segs.find(([a, d]) => t >= a && t < a + d); const lt = on ? t - on[0] : 0; const g = on ? Math.min(1, lt * 60) * Math.min(1, (on[1] - lt) * 30) : 0; return rv(lp(sat(fr.reduce((s, f) => s + saw(f * k * t), 0), 1)) * g * 0.5); }); } });
G({ id: 'flyby', cat: 'Sci-Fi', kind: 'sfx', grid: { size: [0, 1, 2], sp: [0, 1, 2] },
  meta: (p) => ({ title: `Spaceship Flyby (${L3(['fighter', 'shuttle', 'cruiser'], p.size)}, ${L3(['slow', 'fast', 'very fast'], p.sp)})`, tags: ['spaceship', 'flyby', 'sci-fi', 'whoosh', 'space', 'starfighter', 'jet'],
    desc: `A ${L3(['small starfighter', 'shuttle', 'huge cruiser'], p.size)} streaking past ${L3(['slowly', 'fast', 'at incredible speed'], p.sp)}, with a whining engine and a Doppler swoop.` }),
  render: (p) => { const f0 = [900, 400, 120][p.size]; const n = noise(8900 + p.size * 3 + p.sp); const bp = bandpass(800, 1.5); const ph = phasor(); const ph2 = phasor(); const pg = panned(); const L = [5, 3, 2][p.sp]; const sh = [0.08, 0.15, 0.25][p.sp];
    return render(L, (t) => { const x = (t / L - 0.5) * 2; const near = 1 / (1 + 15 * x * x); const dop = 1 + sh * Math.tanh(-x * 5); return (saw(ph(f0 * dop)) * 0.25 + saw(ph2(f0 * 1.01 * dop)) * 0.25 + bp(n(), 300 + 4000 * near) * 1.2) * near * pg(Math.tanh(x * 2.5) * 0.9); }); } });

// ---------- weather ----------
G({ id: 'thunder', cat: 'Weather', kind: 'sfx', grid: { dist: [0, 1, 2], size: [0, 1, 2] },
  meta: (p) => ({ title: `Thunder ${L3(['Clap', 'Roll', 'Rumble'], p.size)} (${L3(['overhead', 'nearby', 'distant'], p.dist)})`, tags: ['thunder', 'storm', 'lightning', 'weather', 'rumble', 'rain', L3(['overhead', 'nearby', 'distant'], p.dist)],
    desc: `A ${L3(['sharp thunder clap', 'rolling peal of thunder', 'long low rumble'], p.size)} ${L3(['right overhead', 'nearby', 'far in the distance'], p.dist)}.` }),
  render: (p) => { const b = brownNoise(9000 + p.dist * 3 + p.size); const n = noise(9001 + p.size); const lp = lowpass(250); const lp2 = lowpass([4000, 1500, 500][p.dist]); const L = [3, 6, 9][p.size];
    return render(L, (t) => { const crack = p.dist < 2 ? lp2(n()) * expDecay(t, [8, 5, 3][p.dist]) * [1.4, 0.8, 0][p.dist] : 0; const roll = lp(b(), 120 + 200 * expDecay(t, 0.8)) * 3 * Math.min(1, t * [6, 3, 1.5][p.dist]) * expDecay(t, [1.2, 0.5, 0.35][p.size]) * (0.7 + 0.3 * Math.sin(TAU * 1.3 * t) * Math.sin(TAU * 0.37 * t)); return crack + roll; }); } });
G({ id: 'hail', cat: 'Weather', kind: 'sfx', loop: true, xfade: true, wide: true, layer: true, grid: { int: [0, 1, 2] },
  meta: (p) => ({ title: `Hail on a Roof (${L3(['light', 'heavy', 'pounding'], p.int)})`, loop: true, layer: true, tags: ['hail', 'storm', 'weather', 'roof', 'ice', 'ambience', 'layer', 'loop'],
    desc: `${L3(['Light', 'Heavy', 'Pounding'], p.int)} hail hammering on a roof, hundreds of hard little ticks. Seamless loop.` }),
  render: (p) => { const r = rng(9100 + p.int); const hits = scatter(9101 + p.int, 19.8, [40, 120, 300][p.int]).map((s) => ({ start: s, dur: 0.03, f: 2000 + r() * 4000, g: 0.3 + r() * 0.7 })); const n = noise(9102); const bp = bandpass(3000, 2); const f = sequence(hits, (h, lt) => h.g * (sin(h.f * lt) * 0.5 + bp(n()) * 0.8) * expDecay(lt, 150), 0.03); const pn = pinkNoise(9103); const hp = highpass(800);
    return loopRender(20, (t) => f(t) * 0.6 + hp(pn()) * [0.1, 0.25, 0.4][p.int]); } });

// ---------- sci-fi interface ----------
G({ id: 'hud', cat: 'Sci-Fi', kind: 'sfx', grid: { pat: [0, 1, 2, 3, 4, 5], f: [0, 1, 2, 3], tim: [0, 1] },
  meta: (p) => ({ title: `HUD ${L3(['Blip', 'Confirm', 'Select', 'Scan', 'Lock-On', 'Data Burst'], p.pat)} ${p.f + 1} (${p.tim ? 'soft' : 'digital'})`, tags: ['hud', 'interface', 'sci-fi', 'futuristic', 'ui', 'blip', 'computer', L3(['blip', 'confirm', 'select', 'scan', 'lock on', 'data'], p.pat)],
    desc: `A ${p.tim ? 'soft' : 'crisp digital'} futuristic interface ${L3(['blip', 'confirmation', 'selection tone', 'scan sweep', 'target lock-on', 'data burst'], p.pat)}.` }),
  render: (p) => { const f0 = [800, 1200, 1800, 2600][p.f]; const wave = p.tim ? sin : square; const ph = phasor(); const rv = reverb(0.15); const r = rng(9200 + p.pat * 8 + p.f * 2 + p.tim);
    const pats = [[[0, 0.05, 1]], [[0, 0.06, 1], [0.08, 0.1, 1.5]], [[0, 0.04, 1.5], [0.05, 0.04, 1]], null, [[0, 0.04, 1], [0.1, 0.04, 1], [0.2, 0.04, 1], [0.3, 0.25, 2]], Array.from({ length: 10 }, (_, i) => [i * 0.03, 0.025, 0.7 + r() * 1.3])];
    if (p.pat === 3) return render(0.9, (t) => rv(wave(ph(f0 * (0.5 + 1.5 * t / 0.8))) * 0.3 * Math.sin(Math.PI * Math.min(1, t / 0.8))));
    const segs = pats[p.pat]; return render(segs.at(-1)[0] + segs.at(-1)[1] + 0.3, (t) => { const s = segs.find(([a, d]) => t >= a && t < a + d); return rv(s ? wave(f0 * s[2] * t) * 0.35 * Math.min(1, (t - s[0]) * 500) * Math.min(1, (s[0] + s[1] - t) * 500) : 0); }); } });
G({ id: 'servo', cat: 'Sci-Fi', kind: 'sfx', grid: { size: [0, 1, 2], mv: [0, 1, 2, 3] },
  meta: (p) => ({ title: `${L3(['Small', 'Robot Arm', 'Heavy Mech'], p.size)} Servo ${L3(['Up', 'Down', 'Quick Twitch', 'Long Move'], p.mv)}`, tags: ['servo', 'motor', 'robot', 'mechanical', 'sci-fi', 'mech', 'machine'],
    desc: `A ${L3(['small', 'robotic arm', 'heavy mech'], p.size)} servo motor whining ${L3(['upward', 'downward', 'in a quick twitch', 'through a long move'], p.mv)}.` }),
  render: (p) => { const f0 = [900, 500, 200][p.size]; const ph = phasor(); const n = noise(9300 + p.size * 4 + p.mv); const bp = bandpass(f0 * 3, 3); const L = [0.6, 0.6, 0.25, 1.5][p.mv];
    return render(L + 0.1, (t) => { const x = Math.min(1, t / L); const f = f0 * (p.mv === 1 ? 1.5 - 0.6 * x : p.mv === 2 ? 1 + 0.5 * Math.sin(Math.PI * x) : 0.8 + 0.6 * x); const env = Math.min(1, t * 40) * Math.min(1, (L - t) * 40 + (t > L ? 0 : 0)); return t > L ? 0 : (saw(ph(f)) * 0.25 + bp(n()) * 0.4) * env * (p.size === 2 ? 1.3 : 1); }); } });
G({ id: 'power', cat: 'Sci-Fi', kind: 'sfx', grid: { dir: [0, 1], len: [0, 1, 2], f: [0, 1, 2] },
  meta: (p) => ({ title: `Power ${p.dir ? 'Down' : 'Up'} (${L3(['quick', 'medium', 'long'], p.len)}, ${L3(['low', 'mid', 'high'], p.f)})`, tags: ['power', p.dir ? 'power down' : 'power up', 'charge', 'sci-fi', 'machine', 'energy', 'electric'],
    desc: `A ${L3(['quick', 'medium', 'long'], p.len)} electronic ${p.dir ? 'power-down that winds to a stop' : 'power-up that charges and settles'}, ${['low', 'mid', 'high'][p.f]} register.` }),
  render: (p) => { const L = [0.6, 1.4, 3][p.len]; const f0 = [80, 160, 320][p.f]; const ph = phasor(); const ph2 = phasor(); const lp = lowpass(4000); const rv = reverb(0.2);
    return render(L + 0.4, (t) => { const x = Math.min(1, t / L); const y = p.dir ? 1 - x : x; const f = f0 * (1 + 7 * y * y); const env = p.dir ? (1 - x) ** 0.5 : Math.min(1, t * 10) * (t > L ? expDecay(t - L, 8) : 1); return rv(lp(saw(ph(f)) * 0.3 + sin(ph2(f * 2.01)) * 0.25) * env); }); } });
G({ id: 'forcefield', cat: 'Sci-Fi', kind: 'sfx', loop: true, xfade: true, layer: true, grid: { f: [0, 1, 2], tex: [0, 1, 2] },
  meta: (p) => ({ title: `Force Field Hum (${L3(['low', 'mid', 'high'], p.f)}, ${L3(['steady', 'pulsing', 'crackling'], p.tex)})`, loop: true, layer: true, tags: ['force field', 'shield', 'energy', 'hum', 'sci-fi', 'electric', 'loop', 'layer'],
    desc: `A ${L3(['steady', 'pulsing', 'crackling'], p.tex)} energy shield humming in the ${['low', 'middle', 'high'][p.f]} range. Seamless loop.` }),
  render: (p) => { const f0 = [60, 110, 220][p.f]; const n = noise(9400 + p.f * 3 + p.tex); const bp = bandpass(f0 * 8, 6); const r = rng(9401); let c = 0;
    return loopRender(8, (t) => { if (p.tex === 2 && r() < 0.002) c = 1; c *= 0.97; const pulse = p.tex === 1 ? 0.6 + 0.4 * Math.sin(TAU * 2 * t) : 1; return (saw(f0 * t) * 0.15 + sin(f0 * 2 * t) * 0.3 + bp(n()) * 0.3) * pulse + n() * c * 0.4; }, 0.5); } });

// ---------- cartoon extras ----------
G({ id: 'bonk', cat: 'Cartoon', kind: 'sfx', grid: { type: [0, 1, 2, 3], f: [0, 1, 2] },
  meta: (p) => ({ title: `Cartoon ${L3(['Bonk', 'Zip', 'Splat', 'Honk'], p.type)} ${p.f + 1}`, tags: ['cartoon', 'funny', 'comedy', 'silly', L3(['bonk', 'zip', 'splat', 'honk'], p.type), L3(['hit', 'fast', 'wet', 'horn'], p.type)],
    desc: `A cartoon ${L3(['bonk on the head with a woody knock', 'zip of something racing off', 'wet splat', 'squeeze-bulb horn honk'], p.type)}, ${['low', 'mid', 'high'][p.f]} pitch.` }),
  render: (p) => { const k = [0.8, 1, 1.3][p.f]; const ph = phasor(); const n = noise(9500 + p.type * 3 + p.f);
    if (p.type === 0) { const bp = bandpass(900 * k, 6); return render(0.6, (t) => bp(n()) * 5 * expDecay(t, 25) + sin(ph(500 * k * (1 + 0.3 * Math.sin(TAU * 20 * t) * expDecay(t, 6)))) * expDecay(t, 6) * 0.4); }
    if (p.type === 1) return render(0.4, (t) => sin(ph(400 * k * 2 ** (t * 12))) * Math.min(1, (0.4 - t) * 20) * 0.6);
    if (p.type === 2) { const lp = lowpass(1500 * k); return render(0.6, (t) => lp(n()) * expDecay(t, 9) * 1.8 + sin(ph(120 * k)) * expDecay(t, 20) * 0.5); }
    const lp = lowpass(2500); return render(0.7, (t) => { const on = t < 0.2 || (t > 0.3 && t < 0.55); return lp(sat(square(ph(380 * k * (1 + 0.02 * Math.sin(TAU * 30 * t)))), 2)) * (on ? 0.4 : 0); }); } });

// ---------- household ----------
G({ id: 'phonering', cat: 'Household', kind: 'sfx', grid: { type: [0, 1, 2, 3], f: [0, 1, 2] },
  meta: (p) => ({ title: `${L3(['Old Bell Phone', 'Office Phone', 'Marimba Ringtone', 'Chirpy Ringtone'], p.type)} Ringing ${p.f + 1}`, tags: ['phone', 'ringing', 'ringtone', 'call', 'telephone', L3(['bell', 'office', 'marimba', 'chirp'], p.type)],
    desc: `A ${L3(['classic bell telephone', 'beeping office phone', 'marimba-style ringtone', 'chirpy digital ringtone'], p.type)} ringing.` }),
  render: (p) => { const k = [0.9, 1, 1.12][p.f]; const rv = reverb(0.15);
    if (p.type === 0) { const b = metalTone(1500 * k, [1, 2.3, 3.7], 8); const hits = []; for (let ring = 0; ring < 2; ring++) for (let i = 0; i < 20; i++) hits.push({ start: ring * 2 + i * 0.05, dur: 0.05 }); const f = sequence(hits, (h, lt) => b(lt), 0.3); return render(3.6, (t) => rv(f(t) * 0.3)); }
    if (p.type === 1) return render(3.4, (t) => { const c = t % 2; return rv(c < 1 && (c * 20) % 2 < 1.6 ? (sin(440 * k * t) + sin(480 * k * t)) * 0.3 : 0); });
    const mel = p.type === 2 ? [72, 76, 79, 76, 72, 79, null, null, 72, 76, 79, 76, 72, 79] : [84, 88, 84, 91, null, null, 84, 88, 84, 91]; const f = sequence(grid(mel, 0.13, 0.12).map((n) => ({ ...n, note: n.note + Math.round(12 * Math.log2(k)) })), (n, lt) => p.type === 2 ? metalTone(midi(n.note), [1, 3.9, 10], 9)(lt) * 0.6 : sin(midi(n.note) * lt) * 0.4 * (lt < n.dur ? 1 : 0), 0.4); return render(mel.length * 0.13 + 0.6, (t) => rv(f(t))); } });
G({ id: 'doorbell', cat: 'Household', kind: 'sfx', grid: { mel: [0, 1, 2, 3], tim: [0, 1, 2] },
  meta: (p) => ({ title: `Doorbell ${L3(['Ding-Dong', 'Three-Tone', 'Westminster Chime', 'Electric Buzz'], p.mel)} (${L3(['chime', 'bright', 'soft'], p.tim)})`, tags: ['doorbell', 'door', 'visitor', 'chime', 'ding dong', 'house'],
    desc: `A ${L3(['two-note ding-dong', 'three-tone', 'four-note Westminster-style', 'buzzing electric'], p.mel)} doorbell with a ${L3(['ringing chime', 'bright', 'soft'], p.tim)} tone.` }),
  render: (p) => { const rv = reverb(0.25); const R = [[1, 2, 3, 4.1], [1, 2.76, 5.4], [1, 2.0, 3.01]][p.tim]; const rate = [1.4, 3, 2.2][p.tim];
    if (p.mel === 3) { const lp = lowpass(2000); return render(1.4, (t) => lp(sat(square(120 * t) + saw(240.5 * t), 1.5)) * (t < 1 ? 0.5 : 0)); }
    const mels = [[76, 72], [79, 76, 72], [76, 72, 74, 67]]; const m = mels[p.mel]; const f = sequence(m.map((note, i) => ({ start: i * 0.55, dur: 1, f: midi(note) })), (n, lt) => metalTone(n.f, R, rate)(lt) * 0.6, 2);
    return render(m.length * 0.55 + 2, (t) => rv(f(t))); } });
G({ id: 'alarmclock', cat: 'Household', kind: 'sfx', grid: { type: [0, 1, 2], f: [0, 1, 2] },
  meta: (p) => ({ title: `${L3(['Bell Alarm Clock', 'Digital Alarm Clock', 'Gentle Wake-Up Alarm'], p.type)} ${p.f + 1}`, tags: ['alarm clock', 'wake up', 'morning', 'alarm', 'clock', 'bedroom', L3(['bell', 'digital', 'gentle'], p.type)],
    desc: `A ${L3(['wind-up bell alarm clock rattling', 'digital alarm clock beeping', 'gentle rising chime alarm'], p.type)}.` }),
  render: (p) => { const k = [0.9, 1, 1.15][p.f];
    if (p.type === 0) { const b = metalTone(2200 * k, [1, 2.4, 3.9], 7); const hits = Array.from({ length: 60 }, (_, i) => ({ start: i * 0.035, dur: 0.035 })); const f = sequence(hits, (h, lt) => b(lt), 0.2); return render(2.6, (t) => f(t) * 0.25); }
    if (p.type === 1) return render(3, (t) => { const c = t % 1; return c < 0.6 && (c * 8) % 1 < 0.5 ? square(2000 * k * t) * 0.35 : 0; });
    const notes = [0, 4, 7, 12, 7, 4].flatMap((o, i) => [{ note: 72 + o, start: i * 0.3, dur: 0.6, g: 0.3 + i * 0.1 }]); const f = sequence(notes.map((n) => ({ ...n, note: n.note + Math.round(12 * Math.log2(k)) })), (n, lt) => n.g * metalTone(midi(n.note), [1, 3.9, 10], 6)(lt), 1); const rv = reverb(0.3); return render(3, (t) => rv(f(t))); } });
G({ id: 'appliance', cat: 'Household', kind: 'sfx', loop: true, xfade: true, layer: true, grid: { type: [0, 1, 2, 3] },
  meta: (p) => ({ title: `${L3(['Refrigerator Hum', 'Desk Fan', 'Washing Machine', 'Microwave Running'], p.type)}`, loop: true, layer: true, tags: ['appliance', 'hum', 'household', 'kitchen', 'loop', 'layer', 'ambience', L3(['fridge', 'fan', 'washing machine', 'microwave'], p.type)],
    desc: `The steady sound of a ${L3(['refrigerator humming', 'desk fan spinning', 'washing machine churning', 'microwave running'], p.type)}. Seamless loop.` }),
  render: (p) => { const pn = pinkNoise(9600 + p.type); const b = brownNoise(9601 + p.type); const lp = lowpass([400, 2500, 600, 1500][p.type]); const bp = bandpass(150, 3);
    return loopRender(12, (t) => { if (p.type === 0) return sin(60 * t) * 0.15 + sin(120 * t) * 0.1 + lp(b()) * 0.5; if (p.type === 1) return lp(pn()) * (0.8 + 0.2 * Math.sin(TAU * 18 * t)); if (p.type === 2) return lp(b()) * (0.6 + 0.4 * Math.max(0, Math.sin(TAU * t / 3))) * 1.5 + bp(pn()) * 0.3 * Math.sin(TAU * t / 1.5) ** 2; return sin(120 * t) * 0.12 + lp(pn()) * 0.4 + sin(1000 * t) * 0.01; }, 0.5); } });

// ---------- interface extras ----------
G({ id: 'toggle', cat: 'Interface', kind: 'sfx', grid: { on: [0, 1], tim: [0, 1, 2, 3, 4, 5] },
  meta: (p) => ({ title: `Toggle ${p.on ? 'Off' : 'On'} (${L3(['soft', 'clicky', 'bubbly', 'glassy', 'woody', 'digital'], p.tim)})`, tags: ['toggle', 'switch', 'on', 'off', 'ui', 'interface', 'settings', L3(['soft', 'clicky', 'bubbly', 'glassy', 'woody', 'digital'], p.tim)],
    desc: `A short ${L3(['soft', 'clicky', 'bubbly', 'glassy', 'woody', 'digital'], p.tim)} switch sound for turning a setting ${p.on ? 'off' : 'on'} (${p.on ? 'falls' : 'rises'} in pitch).` }),
  render: (p) => { const base = [700, 1400, 500, 2200, 600, 1000][p.tim]; const a = p.on ? 1.4 : 1, b = p.on ? 1 : 1.4; const ph = phasor(); const n = noise(9700 + p.tim); const bp = bandpass(base * 2, 4); const wave = p.tim === 5 ? square : sin;
    return render(0.16, (t) => { const f = base * (t < 0.04 ? a : b); return (wave(ph(p.tim === 2 ? f * (1 + 3 * Math.min(1, (t % 0.04) / 0.04)) : f)) * 0.5 + (p.tim === 1 || p.tim === 4 ? bp(n()) : 0)) * expDecay(t % 0.05, p.tim === 3 ? 25 : 60) * (t < 0.1 ? 1 : 0); }); } });
G({ id: 'swipe', cat: 'Interface', kind: 'sfx', grid: { dir: [0, 1, 2, 3], sp: [0, 1, 2], tone: [0, 1] },
  meta: (p) => ({ title: `Swipe ${L3(['Left', 'Right', 'Up', 'Down'], p.dir)} (${L3(['quick', 'normal', 'slow'], p.sp)}, ${p.tone ? 'airy' : 'paper'})`, tags: ['swipe', 'swish', 'ui', 'interface', 'card', 'page', 'gesture', L3(['left', 'right', 'up', 'down'], p.dir)],
    desc: `A ${L3(['quick', 'normal', 'slow'], p.sp)} ${p.tone ? 'airy' : 'papery'} swipe for a card or page moving ${L3(['left', 'right', 'up', 'down'], p.dir)}.` }),
  render: (p) => { const L = [0.12, 0.22, 0.35][p.sp]; const n = noise(9800 + p.dir * 6 + p.sp * 2 + p.tone); const bp = bandpass(2000, p.tone ? 1 : 2.5); const up = p.dir === 1 || p.dir === 2;
    return render(L + 0.05, (t) => { const x = Math.min(1, t / L); return bp(n(), (up ? 1200 + 3000 * x : 4200 - 3000 * x) * (p.tone ? 1.3 : 0.8)) * Math.sin(Math.PI * x) ** 2 * 1.6; }); } });
G({ id: 'downlifter', cat: 'Transitions', kind: 'sfx', grid: { len: [0, 1, 2], type: [0, 1, 2], range: [0, 1, 2] },
  meta: (p) => ({ title: `${L3(['Noise', 'Tone', 'Hybrid'], p.type)} Downlifter (${['1', '2', '4'][p.len]} s, ${L3(['low', 'mid', 'high'], p.range)} start)`, tags: ['downlifter', 'downsweep', 'transition', 'drop', 'fall', 'edm', 'cinematic', 'release'],
    desc: `A ${['1', '2', '4'][p.len]}-second falling sweep using ${L3(['filtered noise', 'a sinking synth tone', 'noise and tone'], p.type)}, starting ${['low', 'mid', 'high'][p.range]}. Use it right after a drop or big moment.` }),
  render: (p) => { const L = [1, 2, 4][p.len]; const top = [800, 2000, 5000][p.range]; const n = noise(9900 + p.len * 9 + p.type * 3 + p.range); const bp = bandpass(500, 3); const ph = phasor();
    return render(L, (t) => { const x = t / L; const env = (1 - x) ** 1.5 * Math.min(1, t * 60); return ((p.type !== 1 ? bp(n(), 150 + top * (1 - x) ** 2) * 1.4 : 0) + (p.type !== 0 ? saw(ph(top / 6 * 2 ** (-x * 3))) * 0.3 : 0)) * env; }); } });

// ---------- producer one-shots ----------
G({ id: 'drumhit', cat: 'Drum Hits', kind: 'sfx', list: [
    ...[0, 1, 2, 3].flatMap((tone) => [0, 1, 2].map((v) => ({ part: 'kick', tone, v }))), ...[0, 1, 2, 3].flatMap((tone) => [0, 1, 2].map((v) => ({ part: 'snare', tone, v }))),
    ...[0, 1, 2].flatMap((tone) => [0, 1, 2].map((v) => ({ part: 'hat', tone, v }))), ...[0, 1, 2].flatMap((tone) => [0, 1, 2].map((v) => ({ part: 'clap', tone, v }))),
    ...[0, 1, 2, 3].flatMap((tone) => [0, 1, 2].map((v) => ({ part: 'tom', tone, v }))), ...[0, 1, 2].flatMap((tone) => [0, 1].map((v) => ({ part: 'cymbal', tone, v }))),
    ...[0, 1, 2, 3, 4, 5].flatMap((tone) => [0, 1].map((v) => ({ part: 'perc', tone, v })))],
  meta: (p) => { const names = { kick: ['Punchy', 'Deep', 'Tight', 'Boomy'], snare: ['Tight', 'Fat', 'Rim', 'Clappy'], hat: ['Closed', 'Open', 'Pedal'], clap: ['Small', 'Room', 'Big'], tom: ['High', 'Mid', 'Low', 'Floor'], cymbal: ['Crash', 'Ride', 'Splash'], perc: ['Cowbell', 'Shaker', 'Tambourine', 'Woodblock', 'Conga', 'Bongo'] };
    const part = { kick: 'Kick', snare: 'Snare', hat: 'Hi-Hat', clap: 'Clap', tom: 'Tom', cymbal: 'Cymbal', perc: '' }[p.part]; const nm = `${names[p.part][p.tone]}${part ? ' ' + part : ''} ${p.v + 1}`;
    return { title: nm, tags: ['drum', 'one shot', 'sample', 'hit', 'percussion', 'beat making', p.part === 'perc' ? names.perc[p.tone].toLowerCase() : p.part, names[p.part][p.tone].toLowerCase()], desc: `A single ${nm.toLowerCase().replace(/ \d$/, '')} hit for beat making. Load it as a pad in the mixer and play it with the number keys.` }; },
  render: (p) => { const n = noise(10000 + ['kick', 'snare', 'hat', 'clap', 'tom', 'cymbal', 'perc'].indexOf(p.part) * 50 + p.tone * 5 + p.v); const v = 1 + (p.v - 1) * 0.12; const ph = phasor();
    if (p.part === 'kick') { const f0 = [55, 42, 65, 48][p.tone] * v; const dec = [7, 4, 12, 3][p.tone]; const click = highpass(3000); return render([0.5, 0.9, 0.35, 1.2][p.tone], (t) => sat(sin(ph(f0 + f0 * 3 * expDecay(t, 30))) * expDecay(t, dec), 1.3) + click(n()) * expDecay(t, 200) * 0.3); }
    if (p.part === 'snare') { const hp = highpass([2500, 1200, 3000, 1500][p.tone]); const f0 = [220, 180, 400, 200][p.tone] * v; return render(0.5, (t) => hp(n()) * expDecay(t, [25, 14, 50, 18][p.tone]) * (p.tone === 2 ? 0.5 : 1) + sin(ph(f0)) * expDecay(t, 25) * [0.5, 0.7, 0.8, 0.3][p.tone]); }
    if (p.part === 'hat') { const hp = highpass(7000 * v); return render([0.12, 0.7, 0.2][p.tone], (t) => hp(n() + square(4100 * t) * 0.2 + square(5900 * t) * 0.15) * expDecay(t, [60, 6, 35][p.tone]) * 0.8); }
    if (p.part === 'clap') { const bp = bandpass(1300 * v, 1.5); const rv = reverb([0.05, 0.3, 0.45][p.tone]); return render([0.3, 0.6, 1][p.tone], (t) => rv(bp(n()) * (expDecay(t, 25) + [0, 0.011, 0.022].reduce((a, d) => a + (t > d ? expDecay(t - d, 40) * 0.7 : 0), 0)) * 1.5)); }
    if (p.part === 'tom') { const f0 = [220, 160, 110, 80][p.tone] * v; return render(0.8, (t) => sin(ph(f0 * (1 + 0.5 * expDecay(t, 15)))) * expDecay(t, 6) + n() * expDecay(t, 60) * 0.2); }
    if (p.part === 'cymbal') { const hp = highpass(5000); const R = [3150, 4320, 5550, 6900, 8200]; return render([3, 2, 1.2][p.tone], (t) => hp(n() * 0.8 + R.reduce((a, f) => a + square(f * v * t), 0) * 0.1) * expDecay(t, [1.5, 3, 4][p.tone]) * (p.tone === 1 ? 0.6 : 0.9)); }
    const tone = p.tone; if (tone === 0) return render(0.5, (t) => (square(545 * v * t) + square(815 * v * t)) * 0.25 * expDecay(t, 12));
    if (tone === 1) { const hp = highpass(6000); return render(0.25, (t) => hp(n()) * Math.sin(Math.PI * Math.min(1, t / 0.2)) * 0.9); }
    if (tone === 2) { const hp = highpass(5000); return render(0.4, (t) => hp(n()) * (expDecay(t, 15) + 0.4 * expDecay(Math.max(0, t - 0.05), 20)) + metalTone(6000 * v, [1, 1.3, 1.7], 20)(t) * 0.2); }
    if (tone === 3) { const bp = bandpass(1800 * v, 8); return render(0.3, (t) => bp(n()) * 5 * expDecay(t, 40) + sin(1800 * v * t) * expDecay(t, 50) * 0.4); }
    const f0 = (tone === 4 ? 220 : 380) * v; return render(0.5, (t) => sin(ph(f0 * (1 + 0.15 * expDecay(t, 30)))) * expDecay(t, tone === 4 ? 9 : 14) + n() * expDecay(t, 80) * 0.15); } });
G({ id: 'note808', cat: 'Musical FX', kind: 'sfx', grid: { note: NOTES.map((_, i) => i), len: [0, 1] },
  meta: (p) => ({ title: `808 Bass · ${NOTES[p.note]}${p.len ? ' (long)' : ''}`, key: NOTES[p.note], tags: ['808', 'bass', 'sub', 'trap', 'hip hop', 'one shot', 'tuned', NOTES[p.note].toLowerCase()], desc: `A ${p.len ? 'long, sliding' : 'punchy'} 808 bass note tuned to ${NOTES[p.note]}. Play several to make a bassline.` }),
  render: (p) => { const f = midi(33 + p.note); const ph = phasor(); return render(p.len ? 2.5 : 1.2, (t) => sat(sin(ph(f * (1 + 1.5 * expDecay(t, 30)) * (p.len ? 1 - 0.03 * Math.min(1, t / 2) : 1))) * expDecay(t, p.len ? 1 : 2.5), 1.8)); } });
G({ id: 'notebass', cat: 'Musical FX', kind: 'sfx', grid: { note: NOTES.map((_, i) => i), tim: [0, 1] },
  meta: (p) => ({ title: `${p.tim ? 'Pluck' : 'Synth'} Bass · ${NOTES[p.note]}`, key: NOTES[p.note], tags: ['bass', 'synth bass', 'one shot', 'tuned', 'note', NOTES[p.note].toLowerCase()], desc: `A single ${p.tim ? 'plucked' : 'warm synth'} bass note tuned to ${NOTES[p.note]}.` }),
  render: (p) => { const f = midi(36 + p.note); const lp = lowpass(p.tim ? 1200 : 700); return render(1.2, (t) => lp(p.tim ? (saw(f * t) * 0.6 + sin(f * t) * 0.4) * expDecay(t, 5) : (saw(f * t) + saw(f * 1.006 * t)) * 0.4 * adsr(t, 0.01, 0.2, 0.7, 0.3, 0.8))); } });
G({ id: 'notepiano', cat: 'Musical FX', kind: 'sfx', grid: { oct: [0, 1, 2], note: NOTES.map((_, i) => i) },
  meta: (p) => ({ title: `Piano Note · ${NOTES[p.note]}${3 + p.oct}`, key: NOTES[p.note], tags: ['piano', 'note', 'keys', 'one shot', 'tuned', NOTES[p.note].toLowerCase()], desc: `A single soft piano note: ${NOTES[p.note]}${3 + p.oct}.` }),
  render: (p) => { const note = 48 + p.oct * 12 + p.note; return render(2.5, (t) => piano({ note }, t) * 0.8); } });
G({ id: 'notepluck', cat: 'Musical FX', kind: 'sfx', grid: { oct: [0, 1], note: NOTES.map((_, i) => i) },
  meta: (p) => ({ title: `Pluck Note · ${NOTES[p.note]}${4 + p.oct}`, key: NOTES[p.note], tags: ['pluck', 'guitar', 'harp', 'note', 'one shot', 'tuned', NOTES[p.note].toLowerCase()], desc: `A single plucked-string note: ${NOTES[p.note]}${4 + p.oct}.` }),
  render: (p) => { const note = 60 + p.oct * 12 + p.note; const rv = reverb(0.2); return render(2, (t) => rv(pluckV({ note }, t) * 0.8)); } });
G({ id: 'stab', cat: 'Musical FX', kind: 'sfx', grid: { note: NOTES.map((_, i) => i), minor: [0, 1] },
  meta: (p) => ({ title: `Chord Stab · ${keyName(p.note, p.minor)}`, key: keyName(p.note, p.minor), tags: ['chord', 'stab', 'synth', 'house', 'one shot', 'tuned', keyName(p.note, p.minor).toLowerCase()], desc: `A punchy synth chord stab: ${keyName(p.note, p.minor)}. Great for house and dance tracks.` }),
  render: (p) => { const r = 60 + (p.note > 6 ? p.note - 12 : p.note); const ch = [r, r + (p.minor ? 3 : 4), r + 7, r + 12]; const lp = lowpass(3000); const rv = reverb(0.25); return render(1.5, (t) => rv(lp(ch.reduce((a, n) => a + saw(midi(n) * t) + saw(midi(n) * 1.007 * t), 0) * 0.12 * expDecay(t, 6)))); } });

// ---------- ambient pad textures (music, every key) ----------
G({ id: 'padtex', cat: 'Pad Textures', kind: 'music', loop: true, xfade: true, grid: { key: NOTES.map((_, i) => i), minor: [0, 1], tim: [0, 1, 2] },
  meta: (p) => { const key = keyName(p.key, p.minor); return { title: `${L3(['Warm', 'Glassy', 'Dark'], p.tim)} Pad · ${key}`, key, loop: true, mood: L3(['Calm', 'Dreamy', 'Dark'], p.tim), tags: ['pad', 'ambient', 'texture', 'atmosphere', 'drone', 'loop', key.toLowerCase(), L3(['warm', 'glassy', 'dark'], p.tim)],
    desc: `A slowly evolving ${L3(['warm', 'glassy', 'dark'], p.tim)} ambient pad holding a ${key} chord. Seamless 16-second loop, great under any music in ${key}.` }; },
  render: (p) => { const r = 48 + (p.key > 6 ? p.key - 12 : p.key); const ch = [r, r + (p.minor ? 3 : 4), r + 7, r + 12, r + 14 + (p.minor ? 1 : 0)]; const lp = lowpass([1200, 4000, 600][p.tim]); const rv = reverb(0.5, 1.7);
    return loopRender(16, (t) => { let s = 0; ch.forEach((n, i) => { const f = midi(n); const amp = 0.5 + 0.5 * Math.sin(TAU * t / 16 * (i % 2 ? 1 : 2) + i); s += (p.tim === 1 ? sin(f * t) + 0.4 * sin(f * 2 * t) : saw(f * t) + saw(f * 1.004 * t)) * amp * 0.12; }); return rv(lp(s, [900, 3000, 500][p.tim] + 300 * Math.sin(TAU * t / 16))); }, 3); } });

// ======================= SCORE: orchestral loops and one-shots =======================
// Higher-fidelity voices: band-limited (PolyBLEP) oscillators, detuned ensembles with
// natural vibrato, Karplus-Strong plucked strings and a Freeverb-style concert hall.

function polyblep(t, dt) { if (t < dt) { t /= dt; return t + t - t * t - 1; } if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; } return 0; }
/** Concert hall: stereo Freeverb tank (see synth.js stereoTank), pre-delay and a high cut on the tail. */
function hall(mix = 0.3, size = 0.86, damp = 0.3, pre = 0.025, hc = 7000) {
  const tank = stereoTank({ fb: size, damp }); const pd = new Float32Array(Math.max(1, Math.round(pre * SR))); let pi = 0; const lp = lowpass(hc);
  return (x) => { const xin = pd[pi]; pd[pi] = x; pi = (pi + 1) % pd.length; return x * (1 - mix) + lp(tank(xin * 0.12)) * mix * 1.6; };
}
/** Bowed/blown ensemble: N detuned band-limited saws per note, delayed vibrato, 12 dB/oct dynamic low-pass. */
function section({ voices = 5, detune = 9, vib = 0.004, att = 0.08, rel = 0.35, sus = 0.85, bright = 3200, dyn = 0.65, seed = 1, width = 0.9 } = {}) {
  markSpatial(); const ch = channel();
  return (n, lt) => {
    if (!n.st) { const r = rng(seed + n.note * 7 + Math.round(n.start * 997)); n.st = { o: Array.from({ length: voices }, (_, k) => { const pan = voices > 1 ? (k / (voices - 1) - 0.5) * width : 0; const ang = (pan + 1) * Math.PI / 4; return { ph: r(), det: 1 + (r() - 0.5) * 2 * detune / 1200, vr: 4.8 + r() * 1.3, vp: r() * 6.28, g: Math.SQRT2 * (ch ? Math.sin(ang) : Math.cos(ang)) }; }), a: lowpass(bright), b: lowpass(bright) }; }
    const env = adsr(lt, n.att ?? att, 0.25, n.sus ?? sus, n.rel ?? rel, n.dur) * (n.vel ?? 1); if (env < 1e-5 && lt > n.dur) return 0;
    const st = n.st; let s = 0;
    if ((st.k = (st.k || 0) + 1) % 16 === 1) { // control rate: vibrato and filter update every 16 samples
      const f = midi(n.note); const va = vib * Math.min(1, Math.max(0, lt - 0.12) * 2.5);
      for (const o of st.o) o.dt = f * o.det * (1 + va * Math.sin(TAU * o.vr * lt + o.vp)) / SR;
      st.cut = (n.cut ?? bright) * ((1 - dyn) + dyn * env);
    }
    for (const o of st.o) { const dt = o.dt; o.ph += dt; if (o.ph >= 1) o.ph -= 1; s += (2 * o.ph - 1 - polyblep(o.ph, dt)) * o.g; }
    return st.b(st.a(s / voices, st.cut), st.cut) * env;
  };
}
const STRINGS = (o = {}) => section({ voices: 6, detune: 10, vib: 0.0045, att: 0.12, rel: 0.45, bright: 3600, ...o });
const SPICC = (o = {}) => section({ voices: 5, detune: 8, vib: 0, att: 0.006, rel: 0.06, sus: 0.35, bright: 4200, dyn: 0.5, ...o });
const BRASS = (o = {}) => section({ voices: 3, detune: 5, vib: 0.002, att: 0.09, rel: 0.4, bright: 2600, dyn: 0.92, ...o });
/** Karplus-Strong plucked string (harp, pizzicato). */
function ks({ damp = 0.996, tone = 0.5, seed = 1 } = {}) {
  markSpatial(); const ch = channel();
  return (n, lt) => {
    if (!n.ks) { const N = Math.max(2, Math.round(SR / midi(n.note))); const r = rng(seed + n.note * 13 + Math.round(n.start * 991)); const b = new Float32Array(N); let p = 0; for (let i = 0; i < N; i++) { p += (n.tone ?? tone) * ((r() * 2 - 1) - p); b[i] = p; } const pan = Math.max(-0.6, Math.min(0.6, (n.note - 64) / 30)); const ang = (pan + 1) * Math.PI / 4; n.ks = { b, i: 0, g: Math.SQRT2 * (ch ? Math.sin(ang) : Math.cos(ang)) }; }
    const k = n.ks; const y = k.b[k.i]; const j = (k.i + 1) % k.b.length; k.b[k.i] = (n.damp ?? damp) * 0.5 * (y + k.b[j]); k.i = j; return y * k.g * (n.vel ?? 1) * (lt < n.dur ? 1 : Math.exp(-(lt - n.dur) * 10));
  };
}
/** Same tone as catalog.js piano(), computed with recursive oscillators and decays (no per-sample sin/exp). */
function pianoFast(n, lt) {
  let st = n.pf;
  if (!st) { const f = midi(n.note); const T = 1 / SR; st = n.pf = { o: [1, 2, 3].map((k) => { const w = TAU * f * k; return { c: 2 * Math.cos(w * T), y1: Math.sin(w * lt), y2: Math.sin(w * (lt - T)) }; }), d0: Math.exp(-1.6 * lt), d2: Math.exp(-4.6 * lt), d3: Math.exp(-7.6 * lt), m0: Math.exp(-1.6 * T), m2: Math.exp(-4.6 * T), m3: Math.exp(-7.6 * T) }; }
  const [a, b, c] = st.o; const v = a.y1 * st.d0 + 0.4 * b.y1 * st.d2 + 0.15 * c.y1 * st.d3;
  for (const o of st.o) { const y = o.c * o.y1 - o.y2; o.y2 = o.y1; o.y1 = y; }
  st.d0 *= st.m0; st.d2 *= st.m2; st.d3 *= st.m3; return v * Math.min(1, lt * 400);
}
/** Choir: ensemble saws through vowel formants. */
function choirBus(notes, vowel = 0, seed = 1) {
  const F = [[800, 1150, 2900], [400, 800, 2600], [350, 2000, 2800]][vowel]; const f1 = bandpass(F[0], 6), f2 = bandpass(F[1], 7), f3 = bandpass(F[2], 8);
  const src = sequence(notes, section({ voices: 6, detune: 12, vib: 0.005, att: 0.5, rel: 0.8, bright: 5000, dyn: 0.2, seed }), 1.2);
  return (t) => { const x = src(t); return f1(x) * 1.3 + f2(x) * 0.8 + f3(x) * 0.35 + x * 0.05; };
}
/** Gentle body resonance for string sections. */
function stringBody() { const a = bandpass(280, 1.2), b = bandpass(1100, 1.5), c = bandpass(3000, 2); return (x) => x * 0.6 + a(x) * 0.35 + b(x) * 0.25 + c(x) * 0.12; }
function timp(f, vel = 1) { const R = [1, 1.5, 1.99, 2.44, 2.98]; return (lt) => { if (lt < 0) return 0; let s = 0; for (let i = 0; i < R.length; i++) s += sin(f * R[i] * (1 - 0.02 * expDecay(lt, 20)) * lt) * expDecay(lt, 2.2 * (1 + i * 0.7)) / (1 + i); return s * vel * Math.min(1, lt * 600); }; }
function bigDrum(seed, f0 = 50) { const n = noise(seed); const lp = lowpass(400); const ph = phasor(); return (lt, vel = 1) => lt < 0 ? 0 : vel * (sin(ph(f0 * (1 + 1.2 * expDecay(lt, 18)))) * expDecay(lt, 4.5) + lp(n()) * expDecay(lt, 22) * 1.6); }

const CINE = [5, 6, 10, 1]; const BRIGHT = [0, 2, 9, 4];
const scoreMeta = (kind, cat = 'Score Loops') => (p) => { const pr = PROGS[p.prog]; const key = keyName(p.key, pr.minor); return { title: `${kind} · ${pr.name} · ${key} · ${p.bpm} BPM`, key, bpm: p.bpm, loop: true, mood: pr.mood,
  tags: ['orchestral', 'score', 'cinematic', 'film', kind.toLowerCase(), pr.name.toLowerCase(), key.toLowerCase(), pr.minor ? 'minor' : 'major', `${p.bpm} bpm`, 'loop'],
  desc: `A four-bar orchestral ${kind.toLowerCase()} loop over the ${pr.name} progression in ${key} at ${p.bpm} BPM, recorded in a virtual concert hall. Layers with every other score loop in the same key and tempo.` }; };
const scoreGrid = (progs, extra = {}) => ({ prog: progs, key: NOTES.map((_, i) => i), bpm: [90, 120], ...extra });
const scCh = (p, i, oct) => chordNotes(p.key > 6 ? p.key - 12 : p.key, PROGS[p.prog], i, oct);

G({ id: 'sc-ostinato', cat: 'Score Loops', kind: 'music', loop: true, grid: scoreGrid(CINE), meta: scoreMeta('String Ostinato'),
  render: (p) => { const B = beat(p.bpm); const notes = []; const pat = [0, 0, 2, 0, 1, 0, 2, 1, 0, 0, 2, 0, 1, 2, 1, 2];
    for (let bar = 0; bar < 4; bar++) { const c = scCh(p, bar, 48); for (let k = 0; k < 16; k++) notes.push({ note: c[pat[k]] + (k % 8 === 4 ? 12 : 0), start: (bar * 16 + k) * B / 4, dur: B / 4 * 0.55, vel: k % 4 === 0 ? 1 : 0.7 }); }
    const f = sequence(notes, SPICC({ seed: 11 }), 0.2); const bd = stringBody(); const h = hall(0.32, 0.87); return loopRender(16 * B, (t) => h(bd(f(t))), 3); } });
G({ id: 'sc-pulse', cat: 'Score Loops', kind: 'music', loop: true, grid: scoreGrid(CINE), meta: scoreMeta('Low String Pulse'),
  render: (p) => { const B = beat(p.bpm); const notes = []; for (let bar = 0; bar < 4; bar++) { const r = scCh(p, bar, 36)[0]; for (let k = 0; k < 8; k++) notes.push({ note: r + (k === 7 ? 7 : 0), start: (bar * 8 + k) * B / 2, dur: B / 2 * 0.7, vel: 0.55 + 0.45 * (k / 7), att: 0.01 }); }
    const f = sequence(notes, section({ voices: 5, detune: 8, vib: 0, att: 0.01, rel: 0.1, sus: 0.6, bright: 1600, dyn: 0.7, seed: 12 }), 0.2); const h = hall(0.28, 0.86, 0.35); return loopRender(16 * B, (t) => h(f(t)) * 1.2, 3); } });
G({ id: 'sc-legato', cat: 'Score Loops', kind: 'music', loop: true, grid: scoreGrid([...CINE, ...BRIGHT]), meta: scoreMeta('Legato Strings'),
  render: (p) => { const B = beat(p.bpm); const notes = []; for (let bar = 0; bar < 4; bar++) { const c = scCh(p, bar, 60); for (const note of [c[0] - 12, ...c]) notes.push({ note, start: bar * 4 * B, dur: 4 * B * 0.98, att: 0.35, vel: 0.85 }); }
    const f = sequence(notes, STRINGS({ seed: 13 }), 1); const bd = stringBody(); const h = hall(0.4, 0.88); return loopRender(16 * B, (t) => h(bd(f(t))), 3); } });
G({ id: 'sc-brass', cat: 'Score Loops', kind: 'music', loop: true, grid: scoreGrid(CINE), meta: scoreMeta('Brass Swells'),
  render: (p) => { const B = beat(p.bpm); const notes = []; for (let bar = 0; bar < 4; bar++) { const c = scCh(p, bar, 48); for (const note of [c[0] - 12, c[0], c[1], c[2]]) notes.push({ note, start: bar * 4 * B, dur: 3.6 * B, att: 1.4 * B, rel: 0.25, vel: 1 }); }
    const f = sequence(notes, BRASS({ seed: 14 }), 0.6); const h = hall(0.34, 0.87, 0.35); return loopRender(16 * B, (t) => h(f(t)), 3); } });
G({ id: 'sc-horns', cat: 'Score Loops', kind: 'music', loop: true, grid: scoreGrid([...CINE, ...BRIGHT]), meta: scoreMeta('Heroic Horn Theme'),
  render: (p) => { const B = beat(p.bpm); const r = rng(9100 + p.prog * 41 + p.key * 7 + p.bpm); const sc = PROGS[p.prog].minor ? MIN : MAJ; const root = 60 + (p.key > 6 ? p.key - 12 : p.key); const mel = []; let deg = 4;
    const rh = [[0, 1.5, 2, 3], [0, 2, 3], [0, 1, 1.5, 2, 3], [0, 3]];
    for (let bar = 0; bar < 4; bar++) { const pat = bar === 3 ? [0] : rh[Math.floor(r() * 3)]; pat.forEach((o, j) => { if (j === 0) { const c = scCh(p, bar, 60); deg = sc.indexOf((c[r() < 0.5 ? 0 : 2] - root + 120) % 12); if (deg < 0) deg = 0; } else deg = Math.max(0, Math.min(9, deg + [-2, -1, 1, 1, 2][Math.floor(r() * 5)])); const next = pat[j + 1] ?? 4; mel.push({ note: root + sc[deg % 7] + 12 * Math.floor(deg / 7), start: (bar * 4 + o) * B, dur: (next - o) * B * 0.95, att: 0.06, vel: j === 0 ? 1 : 0.85 }); }); }
    const horn = sequence(mel, section({ voices: 4, detune: 6, vib: 0.004, att: 0.06, rel: 0.25, bright: 2200, dyn: 0.85, seed: 15 }), 0.5);
    const bed = sequence([0, 1, 2, 3].flatMap((bar) => scCh(p, bar, 48).map((note) => ({ note, start: bar * 4 * B, dur: 4 * B, att: 0.5, vel: 0.35 }))), STRINGS({ seed: 16 }), 1);
    const h = hall(0.36, 0.88); return loopRender(16 * B, (t) => h(horn(t) * 0.9 + bed(t) * 0.5), 3); } });
G({ id: 'sc-choir', cat: 'Score Loops', kind: 'music', loop: true, grid: scoreGrid(CINE, { vow: [0, 1] }), meta: (p) => scoreMeta(p.vow ? 'Choir "Oo"' : 'Choir "Ah"')(p),
  render: (p) => { const B = beat(p.bpm); const notes = []; for (let bar = 0; bar < 4; bar++) for (const note of scCh(p, bar, 57)) notes.push({ note, start: bar * 4 * B, dur: 4 * B * 0.98 }); const f = choirBus(notes, p.vow, 17); const h = hall(0.45, 0.89); return loopRender(16 * B, (t) => h(f(t)), 3); } });
G({ id: 'sc-piano', cat: 'Score Loops', kind: 'music', loop: true, grid: scoreGrid([...CINE, ...BRIGHT]), meta: scoreMeta('Piano and Strings'),
  render: (p) => { const B = beat(p.bpm); const notes = []; for (let bar = 0; bar < 4; bar++) { const c = scCh(p, bar, 60); const seq = [c[0] - 12, c[0], c[1], c[2], c[1], c[0] + 12, c[2], c[1]]; seq.forEach((note, k) => notes.push({ note, start: (bar * 8 + k) * B / 2, dur: B * 1.2 })); }
    const pn = sequence(notes, pianoFast, 2); const str = sequence([0, 1, 2, 3].flatMap((bar) => scCh(p, bar, 60).map((note) => ({ note, start: bar * 4 * B, dur: 4 * B, att: 0.8, vel: 0.4 }))), STRINGS({ seed: 18 }), 1); const h = hall(0.32, 0.87);
    return loopRender(16 * B, (t) => h(pn(t) * 0.55 + str(t) * 0.45), 3); } });
G({ id: 'sc-pizz', cat: 'Score Loops', kind: 'music', loop: true, grid: scoreGrid([...BRIGHT, ...CINE]), meta: scoreMeta('Pizzicato'),
  render: (p) => { const B = beat(p.bpm); const notes = []; const pat = [0, null, 2, 1, 0, 2, null, 1]; for (let bar = 0; bar < 4; bar++) { const c = scCh(p, bar, 60); pat.forEach((k, j) => { if (k != null) notes.push({ note: c[k] + (j === 5 ? 12 : 0), start: (bar * 8 + j) * B / 2, dur: B / 2, vel: j % 4 === 0 ? 1 : 0.7 }); }); notes.push({ note: c[0] - 12, start: bar * 4 * B, dur: B, vel: 1 }); }
    const f = sequence(notes, ks({ damp: 0.985, tone: 0.35, seed: 19 }), 0.4); const lp = lowpass(3500); const h = hall(0.3, 0.85); return loopRender(16 * B, (t) => h(lp(f(t))), 2); } });
G({ id: 'sc-harp', cat: 'Score Loops', kind: 'music', loop: true, grid: scoreGrid([...BRIGHT, ...CINE]), meta: scoreMeta('Harp Arpeggio'),
  render: (p) => { const B = beat(p.bpm); const notes = []; for (let bar = 0; bar < 4; bar++) { const c = scCh(p, bar, 60); const up = [c[0] - 12, c[0] - 5, c[0], c[1], c[2], c[0] + 12, c[1] + 12, c[2] + 12]; const seq = [...up, ...up.slice().reverse()]; seq.forEach((note, k) => notes.push({ note, start: (bar * 16 + k) * B / 4, dur: B * 1.5, vel: 0.8 })); }
    const f = sequence(notes, ks({ damp: 0.9975, tone: 0.28, seed: 20 }), 1.5); const h = hall(0.35, 0.88); return loopRender(16 * B, (t) => h(f(t)), 3); } });
G({ id: 'sc-tension', cat: 'Score Loops', kind: 'music', loop: true, grid: { key: NOTES.map((_, i) => i), bpm: [90, 120], v: [0, 1] },
  meta: (p) => { const key = keyName(p.key, true); return { title: `Tension Bed ${p.v ? '(ticking)' : '(drone)'} · ${key} · ${p.bpm} BPM`, key, bpm: p.bpm, loop: true, mood: 'Tense', tags: ['tension', 'suspense', 'thriller', 'orchestral', 'score', 'cinematic', 'underscore', key.toLowerCase(), `${p.bpm} bpm`, 'loop'],
    desc: `A suspenseful score bed in ${key}: a low string drone with uneasy high tremolo${p.v ? ' and a ticking col legno pulse' : ''} at ${p.bpm} BPM. Seamless loop.` }; },
  render: (p) => { const B = beat(p.bpm); const r = 36 + p.key; const L = 16 * B; const lo = sequence([{ note: r, start: 0, dur: L, att: 1.5, vel: 0.9 }, { note: r + 12, start: 0, dur: L, att: 2, vel: 0.5 }], STRINGS({ seed: 21, bright: 1200 }), 0);
    const hi = sequence([{ note: r + 37, start: 0, dur: L, att: 2, vel: 0.35 }, { note: r + 38, start: 0, dur: L, att: 3, vel: 0.3 }], section({ voices: 6, detune: 14, vib: 0.008, att: 2, bright: 6000, seed: 22 }), 0);
    const n = noise(9200 + p.key); const bp = bandpass(2500, 6); const tick = (t) => { if (!p.v) return 0; const lt = t % (B / 2); return bp(n()) * expDecay(lt, 120) * (Math.floor(t / (B / 2)) % 2 ? 0.6 : 1) * 3; };
    const h = hall(0.4, 0.88); return loopRender(L, (t) => h(lo(t) + hi(t) * (0.7 + 0.3 * Math.sin(TAU * 7 * t)) + tick(t)), 3); } });
const PERC = ['Epic Taiko', 'Military March', 'Hybrid Trailer', 'War Drums', 'Tribal Toms', 'Ticking Suspense'];
G({ id: 'sc-perc', cat: 'Score Loops', kind: 'music', loop: true, grid: { pat: PERC.map((_, i) => i), bpm: [80, 90, 100, 120, 140] },
  meta: (p) => ({ title: `${PERC[p.pat]} Percussion · ${p.bpm} BPM`, bpm: p.bpm, loop: true, mood: p.pat === 5 ? 'Tense' : 'Epic', tags: ['orchestral', 'percussion', 'drums', 'score', 'cinematic', 'trailer', PERC[p.pat].toLowerCase(), `${p.bpm} bpm`, 'loop'],
    desc: `A four-bar ${PERC[p.pat].toLowerCase()} orchestral percussion loop at ${p.bpm} BPM, in a big concert hall.` }),
  render: (p) => { const B = beat(p.bpm); const s16 = B / 4; const L = 64 * s16; const dk = bigDrum(9300 + p.pat, [55, 60, 45, 50, 90, 70][p.pat]); const tom = bigDrum(9301, 110); const n = noise(9302); const hp = highpass(1500); const bp = bandpass(2400, 5);
    const pats = [['x..x..x...x.x...', '....x.......x..x'], ['x.......x.......', 'x.xxx.x.xxx.x.xx'], ['x.....x...x.....', '....x.......x...'], ['x.x...x.x.x...x.', '....x..x....x.xx'], ['x..x..x.x..x.x..', '.x..x.x..x..x.xx'], ['x...............', 'x.x.x.x.x.x.x.x.']][p.pat];
    const hits = []; for (let bar = 0; bar < 4; bar++) for (let k = 0; k < 16; k++) { if (pats[0][k] === 'x') hits.push({ start: (bar * 16 + k) * s16, dur: 1, t: 'big', g: k % 4 === 0 ? 1 : 0.75 }); if (pats[1][k] === 'x') hits.push({ start: (bar * 16 + k) * s16, dur: 0.4, t: p.pat === 1 || p.pat === 2 ? 'snare' : p.pat === 5 ? 'tick' : 'tom', g: 0.7 }); }
    if (p.pat !== 5) hits.push({ start: 63 * s16, dur: 0.6, t: 'snare', g: 0.5 });
    const f = sequence(hits, (h, lt) => h.t === 'big' ? dk(lt, h.g) * 1.2 : h.t === 'tom' ? tom(lt, h.g) * 0.7 : h.t === 'tick' ? bp(n()) * expDecay(lt, 140) * 2.5 * h.g : (hp(n()) * expDecay(lt, 18) + sin(200 * lt) * expDecay(lt, 25) * 0.4) * h.g, 1.2);
    const sw = p.pat === 2 ? (t) => (t % (16 * B) > 12 * B ? hp(n()) * ((t % (16 * B)) - 12 * B) / (4 * B) * 0.25 : 0) : () => 0; const h = hall(0.3, 0.88, 0.3, 0.02); return loopRender(L, (t) => h(f(t) + sw(t)), 3); } });

// ---------- score one-shots ----------
const oneMeta = (title, tags, desc, key) => ({ title, tags: ['orchestral', 'score', 'cinematic', 'one shot', ...tags], desc, ...(key ? { key } : {}) });
G({ id: 'sc-braam', cat: 'Score One-Shots', kind: 'sfx', grid: { key: NOTES.map((_, i) => i), len: [0, 1] },
  meta: (p) => oneMeta(`Braam · ${NOTES[p.key]}${p.len ? ' (long)' : ''}`, ['braam', 'brass', 'trailer', 'impact', 'low', 'epic', NOTES[p.key].toLowerCase()], `A huge, growling low-brass "braam" on ${NOTES[p.key]}, the classic trailer impact${p.len ? ', held long' : ''}.`, NOTES[p.key]),
  render: (p) => { const r = 31 + p.key; const L = p.len ? 5 : 2.6; const notes = [r, r + 12, r + 19, r + 24].map((note) => ({ note, start: 0, dur: L - 1.2, att: 0.02, rel: 1, vel: 1, cut: 1800 })); const f = sequence(notes, section({ voices: 5, detune: 14, vib: 0, att: 0.02, rel: 1, bright: 1800, dyn: 0.95, seed: 30 }), 1.5); const dk = bigDrum(9400 + p.key, 40); const h = hall(0.35, 0.89);
    return render(L + 1.8, (t) => h(sat(f(t) * 2.2 * (1 + 0.15 * Math.sin(TAU * 31 * t) * expDecay(t, 2)), 1.6) * 0.7 + dk(t) * 0.8)); } });
G({ id: 'sc-hit', cat: 'Score One-Shots', kind: 'sfx', grid: { key: NOTES.map((_, i) => i), minor: [0, 1] },
  meta: (p) => oneMeta(`Orchestral Hit · ${keyName(p.key, p.minor)}`, ['hit', 'stab', 'tutti', 'impact', 'orchestra'], `A full-orchestra hit: brass, strings, timpani and cymbal together on a ${keyName(p.key, p.minor)} chord, with a long hall tail.`, keyName(p.key, p.minor)),
  render: (p) => { const r = 48 + (p.key > 6 ? p.key - 12 : p.key); const c = [r - 12, r, r + (p.minor ? 3 : 4), r + 7, r + 12, r + (p.minor ? 15 : 16)]; const st = { dur: 0.35, att: 0.008, rel: 0.5, vel: 1 };
    const br = sequence(c.slice(0, 4).map((note) => ({ note, start: 0, ...st })), BRASS({ seed: 31, bright: 3500 }), 1); const sr = sequence(c.slice(2).map((note) => ({ note, start: 0, ...st })), STRINGS({ seed: 32, att: 0.005 }), 1); const tp = timp(midi(r - 12)); const n = noise(9500 + p.key); const hp = highpass(4000); const h = hall(0.42, 0.89);
    return render(4, (t) => h(br(t) * 0.8 + sr(t) * 0.6 + tp(t) * 0.9 + hp(n()) * expDecay(t, 3) * 0.3)); } });
G({ id: 'sc-swell', cat: 'Score One-Shots', kind: 'sfx', grid: { key: NOTES.map((_, i) => i), minor: [0, 1] },
  meta: (p) => oneMeta(`String Swell · ${keyName(p.key, p.minor)}`, ['swell', 'crescendo', 'strings', 'build up', 'transition'], `Strings swelling from nothing to a big ${keyName(p.key, p.minor)} chord and cutting off. Lead into a downbeat with it.`, keyName(p.key, p.minor)),
  render: (p) => { const r = 48 + (p.key > 6 ? p.key - 12 : p.key); const L = 3.2; const notes = [r - 12, r, r + 7, r + 12, r + (p.minor ? 15 : 16), r + 19].map((note) => ({ note, start: 0, dur: L, att: L, rel: 0.08, vel: 1 })); const f = sequence(notes, STRINGS({ seed: 33, dyn: 0.9 }), 0.3); const bd = stringBody(); const h = hall(0.25, 0.86);
    return render(L + 1.5, (t) => h(bd(f(t)) * (t < L ? (t / L) ** 1.5 : 1))); } });
G({ id: 'sc-riser', cat: 'Score One-Shots', kind: 'sfx', grid: { len: [0, 1, 2], int: [0, 1, 2] },
  meta: (p) => oneMeta(`Orchestral Riser (${['4', '6', '8'][p.len]} s, ${['soft', 'building', 'massive'][p.int]})`, ['riser', 'build up', 'crescendo', 'trailer', 'transition', 'tension'], `A ${['soft', 'building', 'massive'][p.int]} orchestral build: strings sliding upward with a cymbal swell${p.int ? ' and a timpani roll' : ''}, ${['4', '6', '8'][p.len]} seconds.`),
  render: (p) => { const L = [4, 6, 8][p.len]; const f0 = midi(40); const v = Array.from({ length: 6 }, (_, k) => ({ ph: k / 6, det: 1 + (k - 2.5) * 0.004 })); const lp = lowpass(3000); const n = noise(9600 + p.len * 3 + p.int); const hp = highpass(5000); const tp = timp(midi(38)); const h = hall(0.35, 0.88);
    return render(L + 1.5, (t) => { if (t > L) return h(0); const x = t / L; const f = f0 * 2 ** (x * 2.5); let s = 0; for (const o of v) { const dt = f * o.det / SR; o.ph += dt; if (o.ph >= 1) o.ph -= 1; s += 2 * o.ph - 1 - polyblep(o.ph, dt); } const roll = p.int ? tp((t * 16) % 1 / 16) * x * 0.5 * p.int : 0; return h(lp(s / 6, 800 + 4000 * x) * x ** 1.5 * 0.8 + hp(n()) * x ** 3 * 0.35 * (1 + p.int * 0.5) + roll); }); } });
G({ id: 'sc-timpani', cat: 'Score One-Shots', kind: 'sfx', grid: { note: NOTES.map((_, i) => i), roll: [0, 1] },
  meta: (p) => oneMeta(`Timpani ${p.roll ? 'Roll' : 'Hit'} · ${NOTES[p.note]}`, ['timpani', 'drum', 'percussion', 'kettle drum', p.roll ? 'roll' : 'hit', NOTES[p.note].toLowerCase()], `A tuned timpani ${p.roll ? 'roll that crescendos into a final hit' : 'hit'} on ${NOTES[p.note]}.`, NOTES[p.note]),
  render: (p) => { const f = midi(41 + p.note); const h = hall(0.3, 0.87); if (!p.roll) { const tp = timp(f); return render(3.5, (t) => h(tp(t))); }
    const hits = Array.from({ length: 36 }, (_, i) => ({ start: i * 0.055, dur: 0.3, vel: 0.25 + 0.75 * (i / 35) })).concat([{ start: 2.05, dur: 2, vel: 1.4 }]); const fn = sequence(hits, (n, lt) => (n.tp ??= timp(f, n.vel))(lt), 1.5); return render(4.5, (t) => h(fn(t))); } });
G({ id: 'sc-cymbal', cat: 'Score One-Shots', kind: 'sfx', grid: { type: [0, 1, 2], v: [0, 1, 2] },
  meta: (p) => oneMeta(`${['Orchestral Crash Cymbal', 'Suspended Cymbal Swell', 'Gong'][p.type]} ${p.v + 1}`, ['cymbal', 'crash', 'gong', 'swell', 'percussion', 'orchestral', ['crash', 'swell', 'gong'][p.type]], `${['A big orchestral crash cymbal', 'A suspended cymbal rolled into a shimmering swell', 'A deep gong strike that blooms and rings'][p.type]}.`),
  render: (p) => { const n = noise(9700 + p.type * 3 + p.v); const hp = highpass(4000 + p.v * 1000); const h = hall(0.3, 0.88); const k = 1 + p.v * 0.08;
    if (p.type === 0) return render(4, (t) => h(hp(n() + [3150, 4320, 5550, 6900].reduce((a, f) => a + square(f * k * t), 0) * 0.08) * expDecay(t, 1.3) * Math.min(1, t * 2000)));
    if (p.type === 1) return render(5, (t) => { const x = Math.min(1, t / 3.5); return h(hp(n()) * x ** 2 * (t < 3.5 ? 1 : expDecay(t - 3.5, 3)) * 0.9); });
    const R = [1, 1.37, 1.83, 2.19, 2.71, 3.3, 4.1]; const f = 80 * k; return render(7, (t) => h(R.reduce((a, r, i) => a + sin(f * r * t) * expDecay(t, 0.35 + i * 0.15) * Math.min(1, t * (3 - i * 0.3)) / (1 + i * 0.4), 0) * 0.5 + hp(n()) * expDecay(t, 4) * 0.1)); } });
G({ id: 'sc-gliss', cat: 'Score One-Shots', kind: 'sfx', grid: { key: NOTES.map((_, i) => i), dir: [0, 1] },
  meta: (p) => oneMeta(`Harp Glissando ${p.dir ? 'Down' : 'Up'} · ${keyName(p.key, false)}`, ['harp', 'glissando', 'magic', 'sweep', 'fairy tale', 'transition'], `A sweeping harp glissando ${p.dir ? 'down' : 'up'} through the ${keyName(p.key, false)} scale.`, keyName(p.key, false)),
  render: (p) => { const r = 48 + (p.key > 6 ? p.key - 12 : p.key); const sc = []; for (let o = 0; o < 3; o++) for (const d of MAJ) sc.push(r + o * 12 + d); if (p.dir) sc.reverse(); const notes = sc.map((note, i) => ({ note, start: i * 0.045, dur: 2.5, vel: 0.5 + 0.5 * Math.sin(Math.PI * i / sc.length) })); const f = sequence(notes, ks({ damp: 0.9975, tone: 0.3, seed: 34 }), 1.5); const h = hall(0.4, 0.88);
    return render(sc.length * 0.045 + 3, (t) => h(f(t))); } });
G({ id: 'sc-celesta', cat: 'Score One-Shots', kind: 'sfx', grid: { oct: [0, 1], note: NOTES.map((_, i) => i) },
  meta: (p) => oneMeta(`Celesta · ${NOTES[p.note]}${5 + p.oct}`, ['celesta', 'bell', 'magic', 'twinkle', 'note', 'tuned', NOTES[p.note].toLowerCase()], `A single sparkling celesta note: ${NOTES[p.note]}${5 + p.oct}.`, NOTES[p.note]),
  render: (p) => { const f = midi(72 + p.oct * 12 + p.note); const h = hall(0.35, 0.86); return render(2.5, (t) => h((sin(f * t) * expDecay(t, 2.2) + sin(f * 2 * t) * 0.25 * expDecay(t, 4) + sin(f * 4.02 * t) * 0.08 * expDecay(t, 9)) * Math.min(1, t * 900) * 0.8)); } });
G({ id: 'sc-choirstab', cat: 'Score One-Shots', kind: 'sfx', grid: { key: NOTES.map((_, i) => i), minor: [0, 1] },
  meta: (p) => oneMeta(`Choir Stab · ${keyName(p.key, p.minor)}`, ['choir', 'voices', 'stab', 'ah', 'epic', 'vocal'], `A big choir "Ah" on a ${keyName(p.key, p.minor)} chord, short and powerful, with a hall tail.`, keyName(p.key, p.minor)),
  render: (p) => { const r = 57 + (p.key > 6 ? p.key - 12 : p.key) - 12; const notes = [r, r + (p.minor ? 3 : 4), r + 7, r + 12].map((note) => ({ note, start: 0, dur: 0.6, att: 0.03, rel: 0.4 })); const f = choirBus(notes, 0, 35); const h = hall(0.45, 0.89); return render(3.5, (t) => h(f(t) * 1.4)); } });
G({ id: 'sc-pizznote', cat: 'Score One-Shots', kind: 'sfx', grid: { oct: [0, 1], note: NOTES.map((_, i) => i) },
  meta: (p) => oneMeta(`Pizzicato · ${NOTES[p.note]}${3 + p.oct}`, ['pizzicato', 'pluck', 'strings', 'note', 'tuned', NOTES[p.note].toLowerCase()], `A single plucked string note: ${NOTES[p.note]}${3 + p.oct}.`, NOTES[p.note]),
  render: (p) => { const f = sequence([{ note: 48 + p.oct * 12 + p.note, start: 0, dur: 0.6 }], ks({ damp: 0.985, tone: 0.35, seed: 36 }), 0.5); const h = hall(0.3, 0.85); return render(1.6, (t) => h(f(t))); } });
G({ id: 'sc-solo', cat: 'Score One-Shots', kind: 'sfx', grid: { inst: [0, 1], note: NOTES.map((_, i) => i) },
  meta: (p) => oneMeta(`Solo ${p.inst ? 'Violin' : 'Cello'} · ${NOTES[p.note]}${p.inst ? 4 : 2}`, ['solo', p.inst ? 'violin' : 'cello', 'strings', 'sustain', 'note', 'tuned', NOTES[p.note].toLowerCase()], `A single expressive ${p.inst ? 'violin' : 'cello'} note held with vibrato: ${NOTES[p.note]}${p.inst ? 4 : 2}.`, NOTES[p.note]),
  render: (p) => { const note = (p.inst ? 67 : 36) + p.note; const f = sequence([{ note, start: 0, dur: 2.4, att: 0.25, rel: 0.5 }], section({ voices: 2, detune: 3, vib: 0.007, att: 0.25, rel: 0.5, bright: p.inst ? 5000 : 2200, seed: 37 }), 0.8); const bd = stringBody(); const h = hall(0.3, 0.86); return render(3.6, (t) => h(bd(f(t)))); } });
G({ id: 'sc-brassstab', cat: 'Score One-Shots', kind: 'sfx', grid: { key: NOTES.map((_, i) => i), minor: [0, 1] },
  meta: (p) => oneMeta(`Brass Stab · ${keyName(p.key, p.minor)}`, ['brass', 'stab', 'horns', 'trombone', 'accent', 'epic'], `A short, punchy brass section stab on a ${keyName(p.key, p.minor)} chord.`, keyName(p.key, p.minor)),
  render: (p) => { const r = 48 + (p.key > 6 ? p.key - 12 : p.key); const notes = [r - 12, r, r + (p.minor ? 3 : 4), r + 7].map((note) => ({ note, start: 0, dur: 0.25, att: 0.01, rel: 0.25, cut: 4000 })); const f = sequence(notes, BRASS({ seed: 38 }), 0.6); const h = hall(0.32, 0.87); return render(2.5, (t) => h(f(t))); } });

// ---------- enumeration + rendering API ----------
function product(grid) { let out = [{}]; for (const [k, vals] of Object.entries(grid)) out = out.flatMap((o) => vals.map((v) => ({ ...o, [k]: v }))); return out; }
function enumerate() {
  const list = [];
  for (const g of GENS) { const ps = g.list || product(g.grid); ps.forEach((p, i) => { const m = g.meta(p); list.push({ g: g.id, i, p, cat: g.cat, kind: g.kind, loop: !!(m.loop ?? g.loop), layer: !!(m.layer ?? g.layer), ...m }); }); }
  return list;
}
const BY_ID = Object.fromEntries(GENS.map((g) => [g.id, g]));
function renderEntry(gid, p) { const g = BY_ID[gid]; const m = g.meta(p); return renderStereo(() => { XF = !!g.xfade; try { return g.render(p); } finally { XF = false; } }, { loop: !!(m.loop ?? g.loop), os: OS.has(gid) ? 2 : 1, maxRms: 0.3, wide: !!g.wide }); }
/** Bright, lightly filtered oscillators render at 88.2 kHz to remove aliasing (families without sample-count logic only). */
const OS = new Set(['laser', 'pickup', 'jump', 'deny', 'siren', 'bleep', 'hud', 'toggle', 'alarmclock', 'bonk', 'phonering', 'horn', 'flyby', 'servo', 'power', 'downlifter', 'riser', 'stab', 'kitstem', 'sting', 'doorbell']);
return { enumerate, renderEntry, peaks, SR };
