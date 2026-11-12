# SoundWell

A free, fast, accessible library of sound effects and music. **7,305 original sounds**, all CC0 (public domain): effects, ambience layers, drum hits, tuned notes, and music loops and stems in all 12 keys. Most sounds are synthesized right in the browser from small recipes, so the whole app is one static page plus 168 MP3 files. Everything is mastered to consistent loudness, ambience, reverbs and ensembles are in stereo, and bright synth tones are rendered at double resolution to avoid aliasing.

## The current app: `site/`

`site/index.html` is a single self-contained page (no server, no build step needed to run it):

- **Library layout:** a side menu (Discover, All sounds, Packs, Stem kits, Loops, One-shots, Your creations, Saved, Mixer, Sequencer, Video, Game audio), 104 packs with cover art generated in the browser, and table-style rows with waveform, time, key and BPM. Dark by default, with a light theme.
- **Search** with synonyms, plus filters for type, category, key and tempo. Results load 40 at a time.
- **Cinematic score collection** (1,776 sounds): string ostinatos and pulses, legato strings, brass swells, heroic horn themes, choir, piano with strings, pizzicato, harp, tension beds and orchestral percussion, in all 12 keys at 90 and 120 BPM, plus braams, orchestral hits, swells, risers, timpani, cymbals, harp glissandos, celesta, choir and brass stabs and solo strings. Rendered with band-limited oscillators, detuned ensembles, Karplus-Strong plucked strings and a concert-hall reverb.
- **Spooky and horror collection** (202 sounds): creaks, ghostly whispers, dread drones, jump scares, horror risers, creepy music boxes, breathing, chains, footsteps in the dark, knocks, haunted wind, ghost moans, EVP static, scrapes, tolling bells, haunted organ, reversed swells and haunted-place ambiences.
- **Describe a sound:** type "a heavy wooden door slamming in a church" and get a custom sound (on claude.ai, Claude picks and tunes it; elsewhere it uses the closest keyword match). Creations are saved in the browser.
- **Layer mixer:** stack loops in sync, play one-shots as pads (keys 1–9), and download the mix as WAV.
- **Step sequencer**, modeled on the most-used sequencers (Elektron, Roland TR, Logic's Step Sequencer, FL Studio, Maschine, MPC, Splice Beatmaker):
  - Up to 8 tracks of any library sound, 16/32/64 steps, tempo 60–200 with tap tempo, swing.
  - Four pattern banks (A–D) that switch on the bar, plus a song mode that plays a chain like `AABA`.
  - Per-step edit lanes: velocity, chance, conditions (1:2, 2:4, Fill, 1st…), repeats/ratchets, nudge (micro-timing) and pitch.
  - Per-track length for polymeter, pan, filter, reverb send, choke groups (open/closed hats), mute, solo and a swap-for-similar-sound button.
  - Euclidean rhythms, shift, randomize, copy/paste, duplicate, humanize, undo/redo, and live recording from keys 1–8.
  - Nine genre templates (boom bap, trap, house, techno, lo-fi, reggaeton, drum & bass, afrobeats, cinematic).
  - Save in the browser or as a `.json` file; export the mix as WAV, stems (a WAV per track), or a MIDI file for any DAW.
- **Beat-making partner** in the sequencer:
  - **Describe a beat** (“dusty boom bap at 88 with a lazy snare”) and Claude writes the whole pattern, with a variation and a song chain. Without Claude it starts from the closest genre template.
  - **Make a B section** writes a variation into the next empty pattern; **Add a fill** copies the pattern with a drum fill at the end. Both chain it as `AAAB`.
  - **Beatbox it**: record yourself (“b” kick, “k”/“pf” snare, “ts” hi-hat) after a four-click count-in, or upload a voice memo. SoundWell hears each hit, sorts it and snaps it to the grid.
- **Make it yours (recipe knobs)**: every generated sound has Pitch, Length, Tone, Room and Drive knobs plus 🎲 New take. They change the recipe itself (oscillator pitch without changing length, envelope length, filter brightness, the random seed), so you get a new sound, not an edited copy. Save it to Your creations and use it anywhere, the sequencer included. “5 variations” on a generated sound now exports five real new takes.
- **Sound for video**: open a clip (it never leaves your device), add sounds at any moment on a timeline, drag or nudge them frame by frame, preview in sync, and export a WAV exactly as long as the video (optionally with the video's own sound) plus a CSV cue sheet and a project file.
- **Game audio**: build a pack for your game (from search, saved sounds, creations or “+ Game pack” on any sound), with a name to use in code, number of takes, pitch spread and volume for each sound. Export:
  - **Audio files for any engine**: every take as a 16-bit WAV, a `manifest.json`, a Godot 4 `AudioStreamRandomizer` resource per sound, a Unity `SoundWell.cs` helper (random take, no repeats, pitch spread), and Unreal steps.
  - **Procedural runtime for web games**: `soundwell.js` ships the recipes, not audio. It generates the sounds in the player's browser (in a worker), with a new take on demand: `SoundWell().load()`, `play(name, {volume, pan, rate, loop})`, `refresh(name)`. Plus a `demo.html`. About 170 KB (about 50 KB compressed) however many sounds it holds.
- **Community patterns:** on claude.ai, share patterns to a board everyone with access can load. Sharing needs Contributor access; the owner can remove any pattern.
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
