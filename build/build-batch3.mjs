import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { CATALOG_3, KITS } from './catalog-3.js';
import { SR, finalize, peaks } from './synth.js';
const SITE = process.argv[2]; const only = process.argv[3];
const base = JSON.parse(readFileSync(`${SITE}/sounds.json`, 'utf8')).filter((s) => s.id <= 123);
let id = 124; const out = []; const slugs = new Set(base.map((s) => s.slug));
for (const c of CATALOG_3) {
  if (slugs.has(c.slug)) throw new Error('dup ' + c.slug); slugs.add(c.slug);
  const t0 = Date.now(); const raw = c.render(); let nan = 0; for (const v of raw) if (!Number.isFinite(v)) nan++;
  const buf = finalize(raw, { loop: !!c.loopable, maxRms: 0.3 }); let sq = 0, dc = 0; for (const v of buf) { sq += v * v; dc += v; }
  const rms = Math.sqrt(sq / buf.length);
  if (!only || only === c.slug) {
    const pcm = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
    const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'f32le', '-ar', String(SR), '-ac', '1', '-i', 'pipe:0', '-c:a', 'libmp3lame', '-b:a', '160k', `${SITE}/media/${c.slug}.mp3`], { input: pcm });
    if (r.status !== 0) throw new Error(String(r.stderr));
  }
  console.log(c.slug.padEnd(28), (buf.length / SR).toFixed(2).padStart(6) + 's', 'rms', rms.toFixed(3), nan ? 'NAN' : '', Math.abs(dc / buf.length) > 0.02 ? 'DC' : '', rms < 0.03 ? 'QUIET' : '', `${Date.now() - t0}ms`);
  out.push({ id: id++, slug: c.slug, title: c.title, desc: c.description, kind: c.kind, cat: c.category, tags: c.tags, mood: c.mood || '', bpm: c.bpm || 0, key: c.key || '',
    loop: !!c.loopable, dur: Math.round(buf.length / SR * 100) / 100, n: buf.length, kit: c.kit || '', stem: c.stem || '', layer: !!c.layer,
    peaks: peaks(buf).filter((_, i) => i % 2 === 0) });
}
// Featured order: newest batch first, then the rest as before.
writeFileSync(`${SITE}/sounds3.json`, JSON.stringify({ kits: KITS, sounds: [...out, ...base] }));
console.log('new', out.length, 'total', out.length + base.length);
