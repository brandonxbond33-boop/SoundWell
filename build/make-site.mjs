// Builds the public website into _site/: the app page as a full HTML document plus only the audio it plays
// (original MP3s, sound packs and seamless loops; recordings inside packs are not shipped twice).
//   node --no-warnings build/make-site.mjs
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
const OUT = '_site'; rmSync(OUT, { recursive: true, force: true }); mkdirSync(`${OUT}/media/sp`, { recursive: true });
const page = readFileSync('site/index.html', 'utf8');
writeFileSync(`${OUT}/index.html`, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="SoundWell: free sound effects, real recordings, music loops and a beat sequencer. Every sound is CC0, free for anything, no credit needed.">
<meta property="og:title" content="SoundWell · free sound effects and music"><meta property="og:description" content="Thousands of free CC0 sounds, real recordings and music tools, made by Helion Design Labs.">
</head><body>${page}</body></html>`);
const loops = new Set(JSON.parse(readFileSync('build/freesound.json', 'utf8')).sounds.filter((s) => s.loop).map((s) => s.slug + '.mp3'));
let n = 0;
for (const f of readdirSync('site/media')) { if (!f.endsWith('.mp3')) continue; if (f.startsWith('fs-') && !loops.has(f)) continue; copyFileSync(`site/media/${f}`, `${OUT}/media/${f}`); n++; }
for (const f of readdirSync('site/media/sp')) { copyFileSync(`site/media/sp/${f}`, `${OUT}/media/sp/${f}`); n++; }
writeFileSync(`${OUT}/.nojekyll`, ''); if (existsSync('site/CNAME')) copyFileSync('site/CNAME', `${OUT}/CNAME`);
console.log(`_site ready: ${n} audio files`);
