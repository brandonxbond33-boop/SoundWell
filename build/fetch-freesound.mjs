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
const DEADLINE = Date.now() + (Number(process.env.FREESOUND_MINUTES) || 40) * 60000; // stop early and keep what we have; the next run continues
const lib = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { sounds: [] };
const have = new Set([...lib.sounds.map((s) => s.fsid), ...(lib.blocked || [])]); // blocked: removed by hand, never re-import
const SR = 44100; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let gate = Promise.resolve(); const throttle = () => (gate = gate.then(() => sleep(1100))); // stay under 60 API requests a minute
const MAX_MB = Number(process.env.FREESOUND_MAX_MB) || 200; // total size of the recordings, so the app stays within hosting limits
import { readdirSync, statSync } from 'node:fs';
let mediaBytes = readdirSync(MEDIA).filter((f) => f.startsWith('fs-')).reduce((a, f) => a + statSync(`${MEDIA}/${f}`).size, 0);
const full = () => lib.sounds.length >= MAX || Date.now() > DEADLINE || mediaBytes > MAX_MB * 1e6;
async function api(path, params) {
  const url = new URL(API + path); for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  for (let tries = 0; tries < 4; tries++) {
    await throttle();
    const res = await fetch(url, { headers: { Authorization: `Token ${KEY}` }, signal: AbortSignal.timeout(60000) });
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
/** Music: loops keep their exact length (trimming would break the loop); phrases get a short fade-out. */
function processMusic([L, R], loopable) {
  const n = L.length; let pk = 0, clip = 0, sq = 0; for (let i = 0; i < n; i++) { const a = Math.max(Math.abs(L[i]), Math.abs(R[i])); pk = Math.max(pk, a); if (a > 0.999) clip++; sq += (L[i] * L[i] + R[i] * R[i]) / 2; }
  const rms = Math.sqrt(sq / (n || 1)); if (pk < 0.02 || rms < 0.004) return { why: 'too quiet' }; if (clip / n > 0.01) return { why: 'clipped' };
  if (n < SR * 0.8) return { why: 'too short' };
  const cap = Math.round(SR * 32); let loop = loopable && n <= cap; let l = L.slice(0, Math.min(n, cap)), r = R.slice(0, Math.min(n, cap));
  [l, r] = master(l, r, { loop: true, fade: loop ? 0 : 0.004 });
  if (!loop) { const f = Math.min(Math.round(SR * 0.5), l.length >> 2); for (let i = 0; i < f; i++) { const g = i / f; l[l.length - 1 - i] *= g; r[r.length - 1 - i] *= g; } }
  return { l, r, loop };
}
const keyOf = (t) => { const km = String(t || '').trim().match(/^([A-G])([#b]?)\s*(major|minor|maj|min)$/i); return km ? `${km[1].toUpperCase()}${km[2] === 'b' ? '♭' : km[2]} ${/^min/i.test(km[3]) ? 'minor' : 'major'}` : ''; };
const NOTE_RX = /\b([A-G])(#|b|sharp|flat)?\s?(maj(or)?|min(or)?|m)?\b/;
function musicMeta(s) {
  const ac = s.ac_analysis || {}; const text = `${s.name} ${(s.tags || []).join(' ')}`;
  let bpm = 0; const m = text.match(/(\d{2,3})\s?-?bpm|bpm\s?-?(\d{2,3})/i); if (m) bpm = +(m[1] || m[2]); const named = !!m;
  if (!(bpm >= 50 && bpm <= 200)) bpm = 0;
  let key = '';
  { const m2 = s.name.replace(/[_-]/g, ' ').match(/\b([A-G])(#|b)?\s?(maj|major|min|minor|m)?\b(?=\s|$|\.)/); if (m2 && (m2[3] || /\bkey\b|\bin [A-G]/i.test(s.name))) key = `${m2[1]}${m2[2] === 'b' ? '♭' : m2[2] || ''} ${/^m(in(or)?)?$/.test(m2[3] || '') ? 'minor' : 'major'}`; }
  const loopable = ac.ac_loop === true || (s.tags || []).some((x) => /^loop(s|able)?$/i.test(x)) || /\bloop/i.test(s.name);
  // Freesound's own analysis fills the gaps: tempo only for loops, key only for pitched material
  if (!bpm && loopable) { bpm = Math.round(+s.bpm || +ac.ac_tempo || 0); if (!(bpm >= 50 && bpm <= 200)) bpm = 0; }
  if (!key && !/drum|percussion|beat|djembe|tabla|bongo|conga|cajon|shaker/i.test(text)) key = keyOf(s.tonality || ac.ac_tonality);
  return { bpm, key, loopable, named };
}
/** Quality gate, silence trim, loudness match (the same mastering as the generated library), MP3 encode. */
function processAudio([L, R], bed, strict) {
  const n = L.length; let pk = 0, clip = 0, sq = 0; for (let i = 0; i < n; i++) { const a = Math.max(Math.abs(L[i]), Math.abs(R[i])); pk = Math.max(pk, a); if (a > 0.999) clip++; sq += (L[i] * L[i] + R[i] * R[i]) / 2; }
  const rms = Math.sqrt(sq / (n || 1)); if (pk < 0.02 || rms < 0.002) return { why: 'too quiet' }; if (clip / n > 0.001) return { why: 'clipped' };
  const thr = Math.max(pk * 0.004, 0.0006); let a = 0, b = n - 1; while (a < n && Math.abs(L[a]) < thr && Math.abs(R[a]) < thr) a++; while (b > a && Math.abs(L[b]) < thr && Math.abs(R[b]) < thr) b--;
  a = Math.max(0, a - Math.round(SR * 0.01)); b = Math.min(n, b + Math.round(SR * 0.08)); const cap = Math.round(SR * (strict ? (bed ? 30 : 8) : (bed ? 40 : 12))); if (b - a > cap) b = a + cap;
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
async function runQuery({ q, cat, bed = false, n, minRating, minRatings, minDownloads, kind = 'sfx', music = false }) {
  if (music) kind = 'music';
  if (full()) return;
  const want = n || CFG.perQuery; let got = lib.sounds.filter((s) => s.query === q).length; if (got >= want) return; const strict = minRating != null;
  const data = await api('/search/text/', {
    query: q, page_size: 60, sort: 'downloads_desc',
    filter: `license:"Creative Commons 0" duration:[${music ? '1 TO 40' : `0.15 TO ${bed ? 90 : 20}`}] avg_rating:[${minRating ?? CFG.minRating} TO *] num_ratings:[${minRatings ?? CFG.minRatings} TO *]${minDownloads ? ` num_downloads:[${minDownloads} TO *]` : ''} samplerate:[44100 TO *]`,
    fields: 'id,name,tags,description,username,url,license,duration,avg_rating,num_ratings,num_downloads,previews' + (music ? ',bpm,tonality' : ''),
  }); report.searched++;
  const perUser = new Map();
  for (const s of data.results) {
    if (got >= want || full()) break;
    if (have.has(s.id) || !/publicdomain\/zero/.test(s.license)) continue;
    if ((perUser.get(s.username) || 0) >= 2) continue;
    have.add(s.id); // claim it so a parallel search doesn't take it too
    const pre = s.previews?.['preview-hq-ogg'] || s.previews?.['preview-hq-mp3']; if (!pre) continue;
    let res; try { res = await fetch(pre, { signal: AbortSignal.timeout(60000) }); } catch { continue; } if (!res.ok) continue;
    let pcm; try { pcm = decode(Buffer.from(await res.arrayBuffer())); } catch { pcm = null; } if (!pcm) { report.rejected['undecodable'] = (report.rejected['undecodable'] || 0) + 1; continue; }
    const mm = music ? musicMeta(s) : null; const out = music ? processMusic(pcm, mm.loopable) : processAudio(pcm, bed, strict); if (out.why) { report.rejected[out.why] = (report.rejected[out.why] || 0) + 1; continue; }
    const tags = [...new Set((s.tags || []).map((t) => t.toLowerCase().replace(/[-_]/g, ' ')).filter((t) => t.length > 2 && !/\d/.test(t) && !JUNK1.test(t)))].slice(0, 10);
    let title = cleanTitle(s.name, tags); if (mm && mm.bpm && (mm.named || mm.loopable)) title = `${title} ${mm.bpm} BPM`; const k = (titles.get(title) || 0) + 1; titles.set(title, k); if (k > 1) title = `${title} ${k}`;
    const slug = `fs-${slugify(title)}-${s.id}`; const file = `${MEDIA}/${slug}.mp3`; if (!encode(out.l, out.r, file)) continue; mediaBytes += statSync(file).size;
    const mid = new Float32Array(out.l.length); for (let i = 0; i < mid.length; i++) mid[i] = (out.l[i] + out.r[i]) / 2;
    let desc = stripHtml(s.description); desc = desc.length > 20 ? (desc.split(/(?<=[.!?])\s/)[0] || desc).slice(0, 220) : '';
    lib.sounds.push({ slug, title, desc: desc || (mm ? `Played by ${s.username}${mm.key ? ', in ' + mm.key : ''}.` : `A real recording: ${title.toLowerCase()}.`), kind, cat, tags: [...new Set([...tags, ...(mm ? ['played', 'real', 'music', ...(out.loop ? ['loop'] : [])] : ['recorded', 'field recording', 'real'])])], mood: '', bpm: mm ? mm.bpm : 0, key: mm ? mm.key : '', loop: !!(mm && out.loop), bed,
      dur: Math.round(out.l.length / SR * 100) / 100, n: out.l.length, kit: '', stem: '', layer: false, peaks: peaks(mid).filter((_, i) => i % 2 === 0),
      credit: { by: s.username, url: s.url, license: 'CC0', source: 'Freesound' }, fsid: s.id, query: q, rating: Math.round(s.avg_rating * 10) / 10 });
    perUser.set(s.username, (perUser.get(s.username) || 0) + 1); got++; added++;
    writeFileSync(OUT, JSON.stringify(lib, null, 1));
    console.log(`+ ${title}  (${cat}, by ${s.username}, ★${s.avg_rating.toFixed(1)})`);
  }
}
// tempo and key for music imported before Freesound's analysis fields were read (150 sounds per request)
const needs = lib.sounds.filter((s) => s.kind === 'music' && s.credit && s.fsid && !s.key && !s.keyChecked);
for (let i = 0; i < needs.length && !full(); i += 100) {
  const batch = needs.slice(i, i + 100);
  try {
    const data = await api('/search/text/', { query: '', filter: `id:(${batch.map((s) => s.fsid).join(' OR ')})`, fields: 'id,bpm,tonality', page_size: 150 });
    const got = new Map(data.results.map((r) => [r.id, r]));
    for (const s of batch) { const r = got.get(s.fsid); s.keyChecked = true; if (!r) continue; const k = keyOf(r.tonality); if (k) s.key = k; const b = Math.round(+r.bpm || 0); if (!s.bpm && b >= 50 && b <= 200 && s.loop) s.bpm = b; }
  } catch (e) { console.log('! backfill: ' + e.message); }
}
if (needs.length) { writeFileSync(OUT, JSON.stringify(lib, null, 1)); console.log(`backfill: ${needs.filter((s) => s.key).length}/${needs.length} music sounds now have a key`); }
// four searches at a time; API calls still go out one by one through the throttle
const queue = [...CFG.queries];
await Promise.all(Array.from({ length: 4 }, async () => { while (queue.length && !full()) { const q = queue.shift(); try { await runQuery(q); } catch (e) { console.log('! ' + q.q + ': ' + e.message); } } }));
writeFileSync(OUT, JSON.stringify(lib, null, 1));
console.log(`added ${added}, library now ${lib.sounds.length} recordings, ${Math.round(mediaBytes / 1e6)} MB; ${report.searched} searches; rejected ${JSON.stringify(report.rejected)}`);
