// Bulk-import CC0 / CC BY sounds from Freesound (https://freesound.org/docs/api/).
//
//   FREESOUND_API_KEY=xxx npm run import:freesound -- --queries "rain:Nature,whoosh:Transitions" --pages 2 --peaks
//
// ⚠️  Before running this for a public, ad-funded site, read docs/ROADMAP.md → "Content sourcing".
// Freesound's API terms restrict commercial use without permission, and every sound keeps
// its own license. This importer skips NC (non-commercial) and Sampling+ sounds on purpose.
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, upsertSound } from '../server/db.js';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const API = process.env.FREESOUND_API_BASE || 'https://freesound.org/apiv2';
const KEY = process.env.FREESOUND_API_KEY || '';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] == null ? true : all[i + 1]]);
  return acc;
}, []));
const QUERIES = String(args.queries || [
  'rain:Nature', 'thunder:Nature', 'birds:Nature', 'footsteps:Foley', 'door:Household', 'whoosh:Transitions',
  'impact:Impacts', 'explosion:Impacts', 'ui click:Interface', 'notification:Interface', 'crowd:Ambience',
  'city ambience:Ambience', 'laser:Sci-Fi', 'monster:Horror', 'coin:Game', 'music loop:Loops',
].join(',')).split(',').map((q) => { const [query, category = 'Misc'] = q.split(':'); return { query: query.trim(), category: category.trim() }; });
const PAGES = Number(args.pages) || 1;
const WITH_PEAKS = !!args.peaks;

const LICENSE_MAP = [
  [/publicdomain\/zero\/1\.0/, 'CC0'],
  [/licenses\/by\/4\.0/, 'CC-BY-4.0'],
  [/licenses\/by\/3\.0/, 'CC-BY-3.0'],
];
export const mapLicense = (url) => LICENSE_MAP.find(([re]) => re.test(url || ''))?.[1] || null;

const MUSIC_TAGS = new Set(['music', 'melody', 'song', 'loop', 'beat', 'chords', 'bpm', 'instrumental']);
const stripHtml = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-').slice(0, 60);

async function get(path, params) {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: KEY ? { Authorization: `Token ${KEY}` } : {} });
  if (res.status === 429) { await new Promise((r) => setTimeout(r, 5000)); return get(path, params); }
  if (!res.ok) throw new Error(`Freesound ${res.status} ${res.statusText} for ${url.pathname}`);
  return res.json();
}

/** Download a preview and compute waveform peaks with ffmpeg (8 kHz mono is plenty). */
async function previewPeaks(previewUrl, bars = 120) {
  const res = await fetch(previewUrl);
  if (!res.ok) return null;
  const input = Buffer.from(await res.arrayBuffer());
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-ac', '1', '-ar', '8000', '-f', 'f32le', 'pipe:1'],
    { input, maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) return null;
  const f = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, Math.floor(r.stdout.byteLength / 4));
  const step = f.length / bars; const out = []; let max = 0;
  for (let b = 0; b < bars; b++) {
    let p = 0;
    for (let i = Math.floor(b * step); i < Math.floor((b + 1) * step); i++) p = Math.max(p, Math.abs(f[i]));
    out.push(p); max = Math.max(max, p);
  }
  return out.map((p) => Math.max(2, Math.round((p / (max || 1)) * 100)));
}

async function main() {
  const db = openDb(process.env.DB_PATH || join(ROOT, 'data', 'soundwell.db'));
  let added = 0; let skipped = 0;
  for (const { query, category } of QUERIES) {
    for (let page = 1; page <= PAGES; page++) {
      const data = await get('/search/text/', {
        query, page, page_size: 100,
        filter: 'license:("Creative Commons 0" OR "Attribution") duration:[0.1 TO 600]',
        fields: 'id,name,description,tags,license,duration,username,previews,url,num_downloads',
        sort: 'rating_desc',
      });
      for (const s of data.results) {
        const license = mapLicense(s.license);
        const preview = s.previews?.['preview-hq-mp3'];
        if (!license || !preview) { skipped++; continue; }
        const tags = (s.tags || []).map((t) => t.toLowerCase()).slice(0, 15);
        upsertSound(db, {
          slug: `fs-${s.id}-${slugify(s.name.replace(/\.(wav|mp3|flac|ogg|aiff?)$/i, ''))}`,
          title: s.name.replace(/\.(wav|mp3|flac|ogg|aiff?)$/i, '').replace(/[_-]+/g, ' ').trim().slice(0, 120),
          description: stripHtml(s.description).slice(0, 500),
          kind: tags.some((t) => MUSIC_TAGS.has(t)) && category === 'Loops' ? 'music' : 'sfx',
          category, tags, duration: s.duration, license,
          author: s.username, author_url: `https://freesound.org/people/${encodeURIComponent(s.username)}/`,
          source: 'freesound', source_id: String(s.id), source_url: s.url,
          // Full-quality downloads need OAuth2 per user; the HQ preview is the same recording at 128 kbps.
          file_url: preview, preview_url: preview,
          peaks: WITH_PEAKS ? await previewPeaks(preview) : null,
          downloads: 0,
        });
        added++;
      }
      process.stdout.write(`\r${query}: page ${page}/${PAGES} · ${added} imported, ${skipped} skipped   `);
      if (!data.next) break;
    }
  }
  console.log(`\nDone. Imported/updated ${added}, skipped ${skipped} (NC or missing preview).`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!KEY) console.warn('FREESOUND_API_KEY is not set; requests will fail unless a proxy injects credentials. Get a key at https://freesound.org/apiv2/apply');
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
