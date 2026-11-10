// Renders only the procedural sounds added after the current proc.json (new families appended at the end
// of gens.js) and appends their lengths and waveforms. Use build-procedural.mjs for a full rebuild.
import { readFileSync, writeFileSync } from 'node:fs';
const E = new Function(readFileSync(new URL('./engine-core.js', import.meta.url), 'utf8') + '\nreturn SoundwellEngine();')();
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const proc = JSON.parse(readFileSync(new URL('./proc.json', import.meta.url), 'utf8')); const list = E.enumerate(); const from = proc.n.length; const t0 = Date.now(); let bad = 0;
for (let i = from; i < list.length; i++) { const e = list[i]; const o = E.renderEntry(e.g, e.p); const mid = new Float32Array(o.l.length); for (let k = 0; k < mid.length; k++) { mid[k] = (o.l[k] + o.r[k]) / 2; if (!Number.isFinite(mid[k])) bad++; }
  proc.n.push(mid.length); proc.pk += E.peaks(mid, 40).map((v) => B64[Math.min(63, Math.round(v / 100 * 63))]).join(''); }
writeFileSync(new URL('./proc.json', import.meta.url), JSON.stringify(proc)); console.log(`appended ${list.length - from} sounds (now ${proc.n.length}) in ${Math.round((Date.now() - t0) / 1000)}s, problems: ${bad}`);
