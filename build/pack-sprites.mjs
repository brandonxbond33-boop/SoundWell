// Bundles the Freesound recordings into "sound packs" (sprite MP3s) so the app needs a few dozen files instead of
// one per sound (claude.ai artifacts hold at most 511 files).
//   node --no-warnings build/pack-sprites.mjs
// Append-only: a sprite keeps its members, new recordings fill new sprites per category, and a sprite is only
// rebuilt when one of its members was removed. Each member is padded with silence, so the app can cut it out
// with a small safety margin regardless of how a browser's MP3 decoder handles encoder delay.
// Reads build/freesound.json and site/media/fs-*.mp3; writes site/media/sp/*.mp3 and build/sprites.json.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';

const SR = 44100; const GAP = 0.25; const MAX_BYTES = 3.8e6; const MAX_SOUNDS = 60; const KBPS = 192;
const lib = JSON.parse(readFileSync('build/freesound.json', 'utf8')).sounds.filter((s) => !s.loop); // seamless loops stay as their own files
const OUT = 'build/sprites.json';
const state = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { sprites: {}, map: {} };
mkdirSync('site/media/sp', { recursive: true });
const bySlug = new Map(lib.map((s) => [s.slug, s]));
const decode = (file) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-ac', '2', '-ar', String(SR), '-f', 'f32le', 'pipe:1'], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error('decode failed: ' + file); return new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.byteLength >> 2);
};
const keyOf = (s) => s.cat.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const estBytes = (s) => s.dur * KBPS * 125 + 2000;

// 1. drop sprites that lost a member (their remaining members get re-packed below)
for (const [name, members] of Object.entries(state.sprites)) {
  if (members.every((m) => bySlug.has(m))) continue;
  delete state.sprites[name]; const f = `site/media/${name}.mp3`; if (existsSync(f)) unlinkSync(f); console.log('rebuild', name);
}
const assigned = new Set(Object.values(state.sprites).flat());
// 2. new sprites for unassigned sounds, per category
const pending = new Map(); for (const s of lib) if (!assigned.has(s.slug)) { const k = keyOf(s); if (!pending.has(k)) pending.set(k, []); pending.get(k).push(s); }
let built = 0;
for (const [k, list] of pending) {
  list.sort((a, b) => a.slug.localeCompare(b.slug)); let group = []; let bytes = 0;
  const flush = () => { if (!group.length) return; let i = 1; while (state.sprites[`sp/${k}-${i}`]) i++; state.sprites[`sp/${k}-${i}`] = group.map((s) => s.slug); group = []; bytes = 0; };
  for (const s of list) { if (group.length && (bytes + estBytes(s) > MAX_BYTES || group.length >= MAX_SOUNDS)) flush(); group.push(s); bytes += estBytes(s); }
  flush();
}
// 3. encode sprites that have no file yet; positions are measured from the decoded members, and kept as they were for existing sprites
for (const slug of Object.keys(state.map)) if (!bySlug.has(slug)) delete state.map[slug];
for (const [name, members] of Object.entries(state.sprites)) {
  const file = `site/media/${name}.mp3`; if (existsSync(file) && members.every((m) => state.map[m] && state.map[m].f === name)) continue;
  const parts = []; let t = GAP;
  for (const slug of members) { const pcm = decode(`site/media/${slug}.mp3`); const n = pcm.length >> 1; state.map[slug] = { f: name, o: Math.round(t * 10000) / 10000, d: Math.round(n / SR * 10000) / 10000 }; parts.push(pcm); t += n / SR + GAP; }
  const buf = new Float32Array(Math.ceil(t * SR) * 2); let pos = Math.round(GAP * SR) * 2;
  for (const pcm of parts) { buf.set(pcm, pos); pos += pcm.length + Math.round(GAP * SR) * 2; }
  const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', 'pipe:0', '-c:a', 'libmp3lame', '-b:a', KBPS + 'k', '-joint_stereo', '1', file], { input: Buffer.from(buf.buffer), maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error('encode failed: ' + name); built++;
}
writeFileSync(OUT, JSON.stringify(state));
console.log(`${Object.keys(state.sprites).length} sound packs (${built} built now) holding ${Object.keys(state.map).length} recordings`);
