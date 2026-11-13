// Turns long ambience recordings (rain, cafes, forests, traffic…) into seamless loops, so the mixer and the
// scene builder can layer real recordings. The last few seconds are cross-faded into the start (equal power), so
// the loop's end flows straight back into its beginning.
//   node --no-warnings build/loop-beds.mjs
// Loops are kept as their own MP3 files (site/media/fs-*.mp3), not in sound packs: cutting a sound out of a pack
// leaves a small safety margin of silence, which would put a gap in a loop. Sound packs that held a converted
// recording are dropped from build/sprites.json, so pack-sprites.mjs rebuilds them without it.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { peaks } from './synth.js';

const SR = 44100; const MIN_DUR = 10;
const lib = JSON.parse(readFileSync('build/freesound.json', 'utf8'));
const spPath = 'build/sprites.json'; const sp = existsSync(spPath) ? JSON.parse(readFileSync(spPath, 'utf8')) : { sprites: {}, map: {} };
const decode = (file) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-ac', '2', '-ar', String(SR), '-f', 'f32le', 'pipe:1'], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error('decode failed: ' + file); const f = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.byteLength >> 2);
  const n = f.length >> 1; const L = new Float32Array(n), R = new Float32Array(n); for (let i = 0; i < n; i++) { L[i] = f[2 * i]; R[i] = f[2 * i + 1]; } return [L, R];
};
let done = 0; const drop = new Set();
for (const s of lib.sounds) {
  if (!s.bed || s.looped || s.dur < MIN_DUR) continue;
  const file = `site/media/${s.slug}.mp3`; if (!existsSync(file)) continue;
  const [L, R] = decode(file); const N = L.length; const F = Math.min(Math.round(SR * 3), Math.round(N * 0.15)); const M = N - F;
  const out = [new Float32Array(M), new Float32Array(M)];
  for (const [c, x] of [[0, L], [1, R]]) {
    const o = out[c]; o.set(x.subarray(0, M));
    for (let i = 0; i < F; i++) { const t = (i + 0.5) / F; o[i] = x[i] * Math.sin(t * Math.PI / 2) + x[M + i] * Math.cos(t * Math.PI / 2); }
  }
  const inter = new Float32Array(M * 2); for (let i = 0; i < M; i++) { inter[2 * i] = out[0][i]; inter[2 * i + 1] = out[1][i]; }
  const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', 'pipe:0', '-c:a', 'libmp3lame', '-b:a', '192k', '-joint_stereo', '1', file], { input: Buffer.from(inter.buffer), maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error('encode failed: ' + file);
  const mid = new Float32Array(M); for (let i = 0; i < M; i++) mid[i] = (out[0][i] + out[1][i]) / 2;
  Object.assign(s, { n: M, dur: Math.round(M / SR * 100) / 100, peaks: peaks(mid).filter((_, i) => i % 2 === 0), loop: true, looped: true });
  if (!s.tags.includes('loop')) s.tags.push('loop', 'seamless');
  if (sp.map[s.slug]) drop.add(sp.map[s.slug].f); done++;
}
for (const name of drop) { delete sp.sprites[name]; const f = `site/media/${name}.mp3`; if (existsSync(f)) unlinkSync(f); }
for (const slug of Object.keys(sp.map)) if (drop.has(sp.map[slug].f)) delete sp.map[slug];
writeFileSync('build/freesound.json', JSON.stringify(lib, null, 1)); writeFileSync(spPath, JSON.stringify(sp));
console.log(`looped ${done} ambience recordings; ${drop.size} sound packs will be rebuilt`);
