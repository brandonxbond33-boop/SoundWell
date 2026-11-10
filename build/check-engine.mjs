import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('./engine-core.js', import.meta.url), 'utf8');
const E = new Function(src + '\nreturn SoundwellEngine();')();
const list = E.enumerate(); const by = {}; for (const e of list) by[e.cat] = (by[e.cat] || 0) + 1;
console.log('total procedural', list.length); console.log(by);
const titles = new Set(); let dup = 0; for (const e of list) { if (titles.has(e.title)) { dup++; if (dup < 5) console.log('dup', e.title); } titles.add(e.title); } console.log('dup titles', dup);
// timing sample: one of each generator
const seen = new Set(); let tot = 0;
for (const e of list) { if (seen.has(e.g)) continue; seen.add(e.g); const t0 = Date.now(); const o = E.renderEntry(e.g, e.p); const b = o.l; const dt = Date.now() - t0; tot += dt; let bad = 0, sq = 0; for (const v of b) { if (!Number.isFinite(v)) bad++; sq += v * v; } const rms = Math.sqrt(sq / b.length); console.log(e.g.padEnd(10), (b.length / 44100).toFixed(2).padStart(6) + 's', 'rms', rms.toFixed(3), bad ? 'NAN' : '', rms < 0.02 ? 'QUIET' : '', dt + 'ms'); }
