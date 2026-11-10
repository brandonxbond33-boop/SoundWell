// Re-renders the 168 original (MP3) sounds through the high-quality pipeline: stereo, upgraded reverb,
// oversampling for bright tones, wide ambience beds and mastering. Writes stereo MP3s and refreshes
// the waveform peaks in sounds3.json.
//   node --no-warnings build-originals.mjs <sounds3.json> <mediaDir>    (from the repo root: build/sounds3.json site/media)
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { BASE_SR, renderStereo, peaks } from './synth.js';
import { CATALOG } from './catalog.js';
import { CATALOG_MORE } from './catalog-more.js';
import { CATALOG_3 } from './catalog-3.js';

const [JSON_PATH, MEDIA] = process.argv.slice(2);
if (!JSON_PATH || !MEDIA) { console.error('usage: node build-originals.mjs <sounds3.json> <mediaDir>'); process.exit(1); }
// Continuous beds get per-channel noise texture.
const WIDE = new Set(['rain-on-window', 'ocean-waves', 'howling-wind', 'campfire-crackle', 'heavy-rainstorm', 'babbling-brook', 'night-crickets', 'forest-birds',
  'stadium-crowd-ambience', 'stadium-crowd-cheer', 'ghostly-whispers', 'alien-ambience', 'thunder-rumble', 'rainy-lofi-texture', 'layer-light-rain', 'layer-city-traffic',
  'layer-cafe-murmur', 'layer-wind-trees', 'layer-room-tone', 'layer-underwater', 'layer-spaceship-interior']);
// Bright, lightly filtered oscillators without sample-count logic render at 88.2 kHz.
const OS = new Set(['laser-zap', 'error-buzz', 'power-up', 'power-down', 'retro-coin', 'retro-jump', 'retro-hurt', 'level-up-fanfare', 'game-over', 'alarm-siren', 'countdown-beeps',
  'synthwave-arp', 'chiptune-adventure', 'funky-bassline', 'cyberpunk-pulse', 'podcast-intro-jingle', 'game-clock-buzzer', 'stadium-air-horn', 'car-horn', 'microwave-beeps',
  'smoke-alarm', 'digital-watch-alarm', 'game-show-wrong', 'robot-beeps', 'extra-life', 'pause-jingle', 'retro-gem-pickup', 'retro-laser-shot', 'comedy-trombone-fail',
  'neon-groove-bass', 'neon-groove-lead', 'neon-success-sting', 'neon-fail-sting', 'hud-scan', 'tape-stop', 'victory-fanfare']);

const data = JSON.parse(readFileSync(JSON_PATH, 'utf8'));
const bySlug = new Map(data.sounds.map((s) => [s.slug, s]));
const all = [...CATALOG, ...CATALOG_MORE, ...CATALOG_3];
let done = 0; const t0 = Date.now(); const report = [];
for (const item of all) {
  const entry = bySlug.get(item.slug); if (!entry) { console.warn('not in sounds3.json:', item.slug); continue; }
  const { l, r, stereo } = renderStereo(() => item.render(), { loop: !!item.loopable, os: OS.has(item.slug) ? 2 : 1, maxRms: 0.3, wide: WIDE.has(item.slug) });
  const n = l.length; const inter = new Float32Array(n * 2); const mid = new Float32Array(n);
  for (let i = 0; i < n; i++) { inter[2 * i] = l[i]; inter[2 * i + 1] = r[i]; mid[i] = (l[i] + r[i]) / 2; }
  const res = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'f32le', '-ar', String(BASE_SR), '-ac', '2', '-i', 'pipe:0', '-c:a', 'libmp3lame', '-b:a', '192k', '-joint_stereo', '1', `${MEDIA}/${item.slug}.mp3`], { input: Buffer.from(inter.buffer) });
  if (res.status !== 0) throw new Error(`ffmpeg failed for ${item.slug}: ${res.stderr}`);
  entry.peaks = peaks(mid).filter((_, i) => i % 2 === 0); entry.n = n; entry.dur = Math.round(n / BASE_SR * 100) / 100;
  report.push(stereo); done++; if (done % 40 === 0) console.log(done, '/', all.length);
}
writeFileSync(JSON_PATH, JSON.stringify(data));
console.log(`re-rendered ${done} originals (${report.filter(Boolean).length} stereo, ${report.filter((x) => !x).length} centered) in ${Math.round((Date.now() - t0) / 1000)}s`);
