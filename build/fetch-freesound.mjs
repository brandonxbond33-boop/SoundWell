// Pulls top-rated CC0 recordings from Freesound into the SoundWell library.
// Runs in GitHub Actions (see .github/workflows/freesound.yml) with FREESOUND_API_KEY set.
//   node --no-warnings build/fetch-freesound.mjs [--max 300]
// Only Creative Commons 0 sounds are taken, so the library stays "free for anything, no credit required".
// Each creator is still credited in the app. Writes site/media/fs-*.mp3 and build/freesound.json.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { master, peaks } from './synth.js';

const KEY = process.env.FREESOUND_API_KEY; if (!KEY) { console.error('FREESOUND_API_KEY is not set'); process.exit(1); }
const API = process.env.FREESOUND_API_BASE || 'https://freesound.org/apiv2';
const CFG = JSON.parse(readFileSync('build/freesound-queries.json', 'utf8'));
const OUT = 'build/freesound.json'; const MEDIA = 'site/media';
const MAX = Number(process.argv[process.argv.indexOf('--max') + 1]) || 300;
const lib = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { sounds: [] };
const have = new Set(lib.sounds.map((s) => s.fsid));
const SR = 44100; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let calls = 0;
async function api(path, params) {
  const url = new URL(API + path); for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  for (let tries = 0; tries < 4; tries++) {
    if (calls++) await sleep(1100); // stay under 60 requests a minute
    const res = await fetch(url, { headers: { Authorization: `Token ${KEY}` } });
    if (res.status === 429) { await sleep(15000); continue; }
    if (!res.ok) throw new Error(`Freesound ${res.status} for ${url.pathname}: ${(await res.text()).slice(0, 200)}`);
    return res.json();
  }
  throw new Error('Freesound kept rate-limiting');
}
const stripHtml = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim();
const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-').slice(0, 48);
const JUNK = /\b(stereo|mono|mic|mics|zoom|h[1-6]n?|tascam|dr\d+|rode|ntg\d*|sm\d+|mkh\d*|\d+k|\d+ ?bit|khz|hz|wav|aiff?|flac|mp3|edit(ed)?|final|take|version|v\d+|copy|untitled|sample|sfx|fx|recording|rec|processed|raw|normali[sz]ed|loop(ed)?|ms|xy|ortf|binaural)\b/gi;
const JUNK1 = new RegExp(JUNK.source, 'i');
function cleanTitle(name, tags) {
  let t = String(name).replace(/\.(wav|aiff?|flac|mp3|ogg|m4a|caf)$/i, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_\-.,()[\]#~+]+/g, ' ').replace(JUNK, ' ').replace(/\b\d+\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (t.length < 3 || !/[a-z]{3}/i.test(t)) t = tags.slice(0, 3).join(' ');
  return t.split(' ').slice(0, 6).map((w) => w.length > 2 || /^(on|in|of|a|an|to|by)$/i.test(w) === false ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase()).join(' ').slice(0, 48) || 'Recording';
}
function decode(buf) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-ac', '2', '-ar', String(SR), '-f', 'f32le', 'pipe:1'], { input: buf, maxBuffer: 1 << 30 });
  if (r.status !== 0) return null; const f = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, Math.floor(r.stdout.byteLength / 4));
  const n = f.length >> 1; const L = new Float32Array(n), R = new Float32Array(n); for (let i = 0; i < n; i++) { L[i] = f[2 * i]; R[i] = f[2 * i + 1]; } return [L, R];
}
/** Quality gate, silence trim, loudness match (the same mastering as the generated library), MP3 encode. */
function processAudio([L, R], bed) {
  const n = L.length; let pk = 0, clip = 0, sq = 0; for (let i = 0; i < n; i++) { const a = Math.max(Math.abs(L[i]), Math.abs(R[i])); pk = Math.max(pk, a); if (a > 0.999) clip++; sq += (L[i] * L[i] + R[i] * R[i]) / 2; }
  const rms = Math.sqrt(sq / (n || 1)); if (pk < 0.02 || rms < 0.002) return { why: 'too quiet' }; if (clip / n > 0.001) return { why: 'clipped' };
  const thr = Math.max(pk * 0.004, 0.0006); let a = 0, b = n - 1; while (a < n && Math.abs(L[a]) < thr && Math.abs(R[a]) < thr) a++; while (b > a && Math.abs(L[b]) < thr && Math.abs(R[b]) < thr) b--;
  a = Math.max(0, a - Math.round(SR * 0.01)); b = Math.min(n, b + Math.round(SR * 0.08)); const cap = Math.round(SR * (bed ? 40 : 12)); if (b - a > cap) b = a + cap;
  if (b - a < SR * 0.08) return { why: 'too short' };
  let l = L.slice(a, b), r = R.slice(a, b);
  [l, r] = master(l, r, { loop: bed, fade: 0.004 });
  if (bed) { const f = Math.round(SR * 0.4); for (let i = 0; i < f && i < l.length; i++) { const g = i / f; l[i] *= g; r[i] *= g; l[l.length - 1 - i] *= g; r[r.length - 1 - i] *= g; } }
  return { l, r };
}
function encode(l, r, file) {
  const inter = new Float32Array(l.length * 2); for (let i = 0; i < l.length; i++) { inter[2 * i] = l[i]; inter[2 * i + 1] = r[i]; }
  const res = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', 'pipe:0', '-c:a', 'libmp3lame', '-b:a', '192k', '-joint_stereo', '1', file], { input: Buffer.from(inter.buffer), maxBuffer: 1 << 30 });
  return res.status === 0;
}

const titles = new Map(); for (const s of lib.sounds) titles.set(s.title, (titles.get(s.title) || 0) + 1);
let added = 0; const report = { searched: 0, rejected: {} };
for (const { q, cat, bed = false, n } of CFG.queries) {
  if (lib.sounds.length >= MAX) break;
  const want = n || CFG.perQuery; let got = lib.sounds.filter((s) => s.query === q).length; if (got >= want) continue;
  const data = await api('/search/text/', {
    query: q, page_size: 60, sort: 'downloads_desc',
    filter: `license:"Creative Commons 0" duration:[0.15 TO ${bed ? 300 : 20}] avg_rating:[${CFG.minRating} TO *] num_ratings:[${CFG.minRatings} TO *] samplerate:[44100 TO *]`,
    fields: 'id,name,tags,description,username,url,license,duration,avg_rating,num_ratings,num_downloads,previews',
  }); report.searched++;
  const perUser = new Map();
  for (const s of data.results) {
    if (got >= want || lib.sounds.length >= MAX) break;
    if (have.has(s.id) || !/publicdomain\/zero/.test(s.license)) continue;
    if ((perUser.get(s.username) || 0) >= 2) continue;
    const pre = s.previews?.['preview-hq-ogg'] || s.previews?.['preview-hq-mp3']; if (!pre) continue;
    const res = await fetch(pre); if (!res.ok) continue;
    const pcm = decode(Buffer.from(await res.arrayBuffer())); if (!pcm) { report.rejected['undecodable'] = (report.rejected['undecodable'] || 0) + 1; continue; }
    const out = processAudio(pcm, bed); if (out.why) { report.rejected[out.why] = (report.rejected[out.why] || 0) + 1; continue; }
    const tags = [...new Set((s.tags || []).map((t) => t.toLowerCase().replace(/[-_]/g, ' ')).filter((t) => t.length > 2 && !/\d/.test(t) && !JUNK1.test(t)))].slice(0, 10);
    let title = cleanTitle(s.name, tags); const k = (titles.get(title) || 0) + 1; titles.set(title, k); if (k > 1) title = `${title} ${k}`;
    const slug = `fs-${slugify(title)}-${s.id}`; if (!encode(out.l, out.r, `${MEDIA}/${slug}.mp3`)) continue;
    const mid = new Float32Array(out.l.length); for (let i = 0; i < mid.length; i++) mid[i] = (out.l[i] + out.r[i]) / 2;
    let desc = stripHtml(s.description); desc = desc.length > 20 ? (desc.split(/(?<=[.!?])\s/)[0] || desc).slice(0, 220) : '';
    lib.sounds.push({ slug, title, desc: desc || `A real recording: ${title.toLowerCase()}.`, kind: 'sfx', cat, tags: [...new Set([...tags, 'recorded', 'field recording', 'real'])], mood: '', bpm: 0, key: '', loop: false, bed,
      dur: Math.round(out.l.length / SR * 100) / 100, n: out.l.length, kit: '', stem: '', layer: false, peaks: peaks(mid).filter((_, i) => i % 2 === 0),
      credit: { by: s.username, url: s.url, license: 'CC0', source: 'Freesound' }, fsid: s.id, query: q, rating: Math.round(s.avg_rating * 10) / 10 });
    have.add(s.id); perUser.set(s.username, (perUser.get(s.username) || 0) + 1); got++; added++;
    console.log(`+ ${title}  (${cat}, by ${s.username}, ★${s.avg_rating.toFixed(1)})`);
  }
}
writeFileSync(OUT, JSON.stringify(lib, null, 1));
console.log(`added ${added}, library now ${lib.sounds.length} recordings; ${report.searched} searches; rejected ${JSON.stringify(report.rejected)}`);
