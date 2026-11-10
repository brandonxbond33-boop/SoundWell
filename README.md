# Soundwell

A free, fast, accessible library of sound effects and music. **5,360 original sounds**, all CC0 (public domain): effects, ambience layers, drum hits, tuned notes, and music loops and stems in all 12 keys. Most sounds are synthesized right in the browser from small recipes, so the whole app is one static page plus 168 MP3 files.

## The current app: `site/`

`site/index.html` is a single self-contained page (no server, no build step needed to run it):

- **Library layout:** a side menu (Discover, All sounds, Packs, Stem kits, Loops, One-shots, Your creations, Saved, Mixer), 104 packs with cover art generated in the browser, and table-style rows with waveform, time, key and BPM. Dark by default, with a light theme.
- **Search** with synonyms, plus filters for type, category, key and tempo. Results load 40 at a time.
- **Describe a sound:** type "a heavy wooden door slamming in a church" and get a custom sound (on claude.ai, Claude picks and tunes it; elsewhere it uses the closest keyword match). Creations are saved in the browser.
- **Layer mixer:** stack loops in sync, play one-shots as pads (keys 1–9), and download the mix as WAV.
- **Stem kits** (Neon Groove, Rainy Lo-fi, Epic Trailer) in all 12 keys, and a **song starter** that builds chords, bass, arpeggio, melody and drums in any key.
- **Sound editor:** speed/pitch, reverse, trim, fades, volume, and a pack of 5 natural variations.
- **Scene builder:** describe a scene ("cozy cabin in a thunderstorm") and get a layered soundscape.
- Downloads arrive as `.zip` files (MP3 or WAV plus a license note). Waveforms, keyboard shortcuts, light and dark themes, phone layout.

### Run it locally

```bash
node build/serve.mjs site      # http://localhost:3190
```

Any static file server works too. The page needs its `media/` folder next to it.

### Put it online

Upload the `site/` folder to any static host. No Git integration is required for these:

- **Netlify Drop:** drag the `site` folder onto https://app.netlify.com/drop
- **Cloudflare Pages:** create a project with **Direct Upload** and upload `site`

It also runs on claude.ai as an Artifact, where downloads and the Claude-powered features (Describe a sound, scene builder) use claude.ai's built-in capabilities. On a normal website, downloads use regular browser downloads and those two features fall back to keyword matching.

### Change or add sounds

Everything that generates the library lives in `build/`. See **[build/README.md](build/README.md)** for the pipeline: add a sound family to `build/gens.js`, then rebuild the engine, the waveform data and the page:

```bash
cd build && ./assemble-engine.sh && node --no-warnings build-procedural.mjs && cd ..
# re-inline build/engine-core.js into build/template.html.txt (see build/README.md), then:
node build/build-page.cjs build site/index.html
```

## The original server version

The first version of Soundwell (47 sounds) is a zero-dependency Node server with SQLite search. It is kept here as-is.

### Run it

Requirements: Node 22.5+ (uses the built-in `node:sqlite`) and `ffmpeg` (only for seeding).

```bash
npm run seed     # renders 47 original CC0 sounds + music loops to MP3 and builds the DB
npm start        # http://localhost:3000
npm test         # API tests
```

No `npm install` needed. There are zero dependencies.

#### Import from Freesound (optional)

```bash
FREESOUND_API_KEY=your_key npm run import:freesound -- --queries "rain:Nature,whoosh:Transitions" --pages 2 --peaks
```

Read **docs/ROADMAP.md → Content sourcing** first. Commercial (ad-funded) use of the Freesound API needs their permission.

### Layout

```
server/   index.js (HTTP, static files, Range streaming, CSP) · db.js (schema, FTS5) · search.js (queries, facets)
scripts/  synth.js (tiny DSP kit) · catalog.js (seed sounds) · seed.js · import-freesound.js
web/      index.html · styles.css · app.js · config.js
docs/     COMPETITIVE-ANALYSIS.md · ROADMAP.md
test/     api.test.js
```

### API

| Endpoint | Notes |
|---|---|
| `GET /api/search?q=&kind=sfx\|music&category=A,B&license=CC0&duration=short,medium,long,xlong&mood=&loopable=1&bpm_min=&bpm_max=&sort=relevance\|popular\|newest\|shortest\|longest&page=&per=` | Returns `{ total, page, pages, items, facets }` |
| `GET /api/sounds/:id` | Sound + `similar` |
| `GET /api/sounds/:id/download` | Counts the download, then serves the file |
| `POST /api/sounds/:id/play` | Play counter |
| `GET /api/stats` | Library totals |
