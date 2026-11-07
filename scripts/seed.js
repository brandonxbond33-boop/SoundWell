// Renders the seed catalog to MP3 (via ffmpeg) and loads it into SQLite.
// Usage: npm run seed   (re-running is safe; rows upsert by slug)
import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, upsertSound } from '../server/db.js';
import { CATALOG } from './catalog.js';
import { SR, finalize, peaks } from './synth.js';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const MEDIA = join(ROOT, 'data', 'media', 'soundwell');
const dbPath = process.env.DB_PATH || join(ROOT, 'data', 'soundwell.db');
const force = process.argv.includes('--force');

if (spawnSync('ffmpeg', ['-version']).status !== 0) {
  console.error('ffmpeg is required to encode the seed library (https://ffmpeg.org/download.html).');
  process.exit(1);
}
mkdirSync(MEDIA, { recursive: true });
const db = openDb(dbPath);

let made = 0;
for (const item of CATALOG) {
  const file = join(MEDIA, `${item.slug}.mp3`);
  const buf = finalize(item.render(), { loop: !!item.loopable });
  if (force || !existsSync(file)) {
    const pcm = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
    const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'f32le', '-ar', String(SR), '-ac', '1',
      '-i', 'pipe:0', '-c:a', 'libmp3lame', '-b:a', '160k',
      '-metadata', `title=${item.title}`, '-metadata', 'artist=Soundwell', '-metadata', 'copyright=CC0 1.0', file], { input: pcm });
    if (r.status !== 0) { console.error(`ffmpeg failed for ${item.slug}:\n${r.stderr}`); process.exit(1); }
    made++;
  }
  upsertSound(db, {
    slug: item.slug, title: item.title, description: item.description, kind: item.kind,
    category: item.category, tags: item.tags, mood: item.mood ?? null, bpm: item.bpm ?? null,
    music_key: item.key ?? null, loopable: item.loopable, duration: +(buf.length / SR).toFixed(3),
    license: 'CC0', author: 'Soundwell Originals', author_url: null, source: 'soundwell', source_id: item.slug,
    file_url: `/media/soundwell/${item.slug}.mp3`, preview_url: `/media/soundwell/${item.slug}.mp3`,
    peaks: peaks(buf),
  });
  process.stdout.write(`\r${item.slug.padEnd(30)}`);
}
const total = db.prepare('SELECT count(*) AS n FROM sounds').get().n;
console.log(`\rSeeded ${CATALOG.length} sounds (${made} encoded). Library now has ${total} sounds. DB: ${dbPath}`);
