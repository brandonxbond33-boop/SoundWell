# Soundwell

A free, fast, accessible library of sound effects and music. It has instant previews, plain-English licenses, one-click credits, and no login.

- **Search** with full-text ranking, prefix matching, synonyms ("scary" also finds horror), and multi-select facets with live counts.
- **Filters:** type, category, length, license, mood, BPM, and seamless loops.
- **Waveform rows and a persistent player.** Click a waveform to jump to that point. Loop, volume, next/previous, and keyboard shortcuts.
- **License clarity:** only CC0 and CC BY are allowed (enforced in the database). Each sound has a "Can I use this?" card and a credit line you can copy.
- **Accessibility:** a written description for every sound, full keyboard support, a screen-reader live region, and reduced-motion, high-contrast, and forced-colors support. 0 axe-core violations.
- **Ads:** slots with reserved space that never play audio and never shift the layout (`web/config.js`).
- **Saved sounds** (stored in your browser), light/dark/system themes, and layouts for phone, tablet, and desktop.

## Run it

Requirements: Node 22.5+ (uses the built-in `node:sqlite`) and `ffmpeg` (only for seeding).

```bash
cd soundwell
npm run seed     # renders 47 original CC0 sounds + music loops to MP3 and builds the DB
npm start        # http://localhost:3000
npm test         # API tests
```

No `npm install` needed. There are zero dependencies.

### Import from Freesound (optional)

```bash
FREESOUND_API_KEY=your_key npm run import:freesound -- --queries "rain:Nature,whoosh:Transitions" --pages 2 --peaks
```

Read **docs/ROADMAP.md → Content sourcing** first. Commercial (ad-funded) use of the Freesound API needs their permission.

## Layout

```
server/   index.js (HTTP, static files, Range streaming, CSP) · db.js (schema, FTS5) · search.js (queries, facets)
scripts/  synth.js (tiny DSP kit) · catalog.js (seed sounds) · seed.js · import-freesound.js
web/      index.html · styles.css · app.js · config.js
docs/     COMPETITIVE-ANALYSIS.md · ROADMAP.md
test/     api.test.js
```

## API

| Endpoint | Notes |
|---|---|
| `GET /api/search?q=&kind=sfx\|music&category=A,B&license=CC0&duration=short,medium,long,xlong&mood=&loopable=1&bpm_min=&bpm_max=&sort=relevance\|popular\|newest\|shortest\|longest&page=&per=` | Returns `{ total, page, pages, items, facets }` |
| `GET /api/sounds/:id` | Sound + `similar` |
| `GET /api/sounds/:id/download` | Counts the download, then serves the file |
| `POST /api/sounds/:id/play` | Play counter |
| `GET /api/stats` | Library totals |
