# Soundwell build files

Backup of everything used to build the Soundwell page, so work can continue from the artifact link alone (no GitHub needed).
In the Soundwell repo these files are already in place, and they build `site/index.html` (run commands from the repo root as `node build/<script>`, or from inside `build/`). From the claude.ai artifact instead: read each file in `build/` from the artifact (Artifact tool, `action: "read"`, `path: "build/<file>"`) into one local folder.
Needs Node 22+ (and ffmpeg only for making new MP3s). Every sound is original, synthesized from code, CC0.

## What's where

| File | Purpose |
|---|---|
| `synth.js` | DSP toolkit and the high-quality render path: oscillators, noise, filters, the stereo Freeverb-style `reverb()`/`stereoTank()`, envelopes, `renderStereo()` (two seeded passes for stereo, optional 2x oversampling with a 63-tap anti-alias decimator, per-channel noise for wide beds) and `master()` (20 Hz high-pass, loudness for loops and one-shots, look-ahead limiter, fades). |
| `build-originals.mjs` | Re-renders the 168 MP3 originals through `renderStereo()` as 192 kbps stereo MP3s and refreshes their peaks: `node --no-warnings build/build-originals.mjs build/sounds3.json site/media`. |
| `catalog.js` | Batch 1: 47 original sounds (rendered to MP3) + shared voices (`drums`, `pad`, `piano`, …). |
| `catalog-more.js` | Batch 2: 76 sounds (MP3). |
| `catalog-3.js` | Batch 3: 45 sounds (MP3) incl. the 3 stem kits in their original keys. |
| `build-batch3.mjs` | Renders batch 3 to `<site>/media/*.mp3` and writes `sounds3.json`. Usage: `node build-batch3.mjs <siteDir> [onlySlug]` (needs `<siteDir>/sounds.json` with batches 1–2). |
| `sounds3.json` | Metadata + waveform peaks for all 168 MP3 sounds, plus kit definitions. The MP3s themselves are the artifact's `media/` files. |
| `gens.js` | **The procedural library** (7,137 sounds): 118 families, including the score families (`sc-*`: `section()` ensembles, `ks()` plucked strings, `hall()` reverb), each a parameter grid (or `list`) + `meta()` + `render()`. Add new families here. Mark continuous sounds (noise beds, pads, hums) `xfade: true` so their loops crossfade instead of folding the tail, ambience beds `wide: true` for per-channel noise texture, and add bright oscillator families to the `OS` set for 2x oversampling. Use `panned()` for moving or placed sources. |
| `seqfast.js` | Faster `sequence()` swapped into the engine (bit-identical output). |
| `assemble-engine.sh` | Builds `engine-core.js` = `function SoundwellEngine(){ synth + catalog voices + gens }`. Run after editing `gens.js`. |
| `engine-core.js` | Assembled engine. Embedded in the page; the page also runs it in a Web Worker to render sounds on demand. |
| `build-procedural.mjs` | Renders every procedural sound once (4 threads) to record length + 40-bar waveform → `proc.json`. ~3.5 min. |
| `proc.json` | `{n: [sample counts], pk: "<40 base64 chars per sound>"}` in enumeration order. |
| `build-procedural-append.mjs` | Renders only families appended to the end of `gens.js` and appends them to `proc.json` (fast; use the full build after changing existing families or the engine). |
| `check-engine.mjs` | Counts per category, duplicate titles, and render time / loudness for one sound per family. |
| `template.html.txt` | The page source with a `/*DATA*/` placeholder (engine already inlined). |
| `build-page.cjs` | `node build-page.cjs <dir> [out.html]` → injects sounds3.json + proc.json into the template → `index.html`. |
| `serve.mjs`, `test-page.cjs` | Local preview server (`node serve.mjs <siteDir>`, port 3190) and a Playwright smoke test. |

## Typical change: add a new sound family

1. Add a `G({ id, cat, kind, grid, meta, render })` block to `gens.js`. Keep `render` deterministic (seeded `rng`/`noise`).
2. `./assemble-engine.sh && node --no-warnings check-engine.mjs` (look for NAN / QUIET / slow renders).
3. `node --no-warnings build-procedural.mjs` → new `proc.json`.
4. Re-inline the engine into the template: replace the text between `<script>\nfunction SoundwellEngine() {` and its closing `</script>` in `template.html.txt` with the new `engine-core.js`.
5. `node build-page.cjs . index.html`, test, then publish `index.html` to the same artifact URL, and re-upload changed files in `build/`.

Order matters: the page pairs `proc.json` entries with `enumerate()` by position, so always rebuild `proc.json` after changing any grid.
Slugs are built from parameters (`<family>-<param values>`), so they stay stable when families or values are added; saved sounds and mixes keep working.

## Page features (all in `template.html.txt`)

Search with synonyms, category/type/key/tempo filters, paged list (40 at a time), Web Audio player, layer mixer with pads and WAV export, stem kits in 12 keys, song starter, sound editor with 5-variation export, scene builder and **Describe a sound** (both use the `sample` capability: Claude picks from a locally shortlisted set; keyword fallback without it). Custom sounds are recipes (`base slug + editor settings`) saved in the viewer's browser under *Your Creations*.

Step sequencer (`seq*` functions), pattern format v2: `{v: 2, title, bpm, swing, steps (16|32|64), cur, chain, song, tracks: [{slug, vol, pitch, pan, tone, send, choke, len, mute, solo, pats: {A: {s, p}, B…}}]}`. `s` uses `.` / `x` / `X` (off, hit, accent); `p` maps a step index to per-step values `{vel, chance, cond, rep, nudge, tune}`. `cleanPattern` also reads version 1 files (`tracks[].pat`). `stepHits` is the single rule for what a step plays, used by live playback and by `seqEvents`, which builds one seeded performance shared by the WAV mix, the stems and the MIDI file. Saved in localStorage (`seq-current`, `seq-saved`), as `.json` files (`format: 'soundwell-pattern'`), or exported. Community sharing uses the `db` capability: each person writes only `patterns/{their id}` (`{items: [...]}`, up to 40), everyone with view access reads, the owner can delete; names come from the `user` capability's profiles. Off claude.ai the community board is hidden.

## Limits to remember

Artifact: 511 files per version (≈168 MP3s used), 256 MB total, 16 MB per page. Downloads only allow certain extensions, so sounds are delivered as `.zip` (MP3 or WAV inside).

## Recipe knobs, beat partner, beatbox and video (all in `template.html.txt` and `synth.js`)

- **Recipe knobs** live in `synth.js` as `MOD` / `setMod(m, loop)`: `pitch` scales every `phasor()` frequency, `length` divides `expDecay` rates (and lengthens one-shot renders), `tone` scales filter cutoffs plus a gentle tilt, `seed` offsets `rng()` (and adds ±15 cents / ±8% length so pure tones vary too), and `room` / `drive` are applied per pass in `colour()`. `renderEntry(g, p, mod)` sets and clears them, so neutral knobs render every sound bit-identically (checked across all 118 families). The page passes knobs to the worker (`renderProc(s, m)`), caches renders in `modBufs`, and custom sounds store them as `custom.m`.
- **Beat partner**: `describeBeat` sends Claude (via `sample`) a shortlist of one-shot slugs and asks for JSON (`aiToPattern` validates it); `makeBSection` sends the current pattern; `addFill` is local. Fallbacks: `keywordBeat` (genre → template) and `variationB`.
- **Beatbox**: `bbOnsets` (energy jumps, 70 ms minimum gap), `bbFeatures` (FFT centroid and low-band share → kick below ~800 Hz, hi-hat above ~4 kHz, otherwise snare), `bbQuantize` (16ths with a phase search for latency). The microphone needs `getUserMedia`, which some hosts block; upload always works.
- **Video**: `VID` state; the `<video>` plays from an object URL and cues are scheduled on the audio clock from `video.currentTime`. Placements persist in localStorage per file name and size. Export renders an `OfflineAudioContext` exactly as long as the video at 48 kHz.
- **Game audio** (`GAME`, `renderGame`, `gameExport`): takes come from `gameTake` (take 1 is the sound as chosen; later takes are new recipe seeds, or small speed and volume nudges for recordings). `soundwellRuntime` is a real function in the page that `gameRuntimeJs` writes out with `toString()`, next to `SoundwellEngine.toString()` and the chosen recipes, so the runtime that ships is the code the page itself runs. Any `</script>` inside the page script must be written `<\/script>`.
- **Sound packs (sprites)**: `pack-sprites.mjs` bundles the Freesound recordings into `site/media/sp/*.mp3` (about 60 sounds or 3.8 MB each, 0.25 s of silence between sounds) and writes `build/sprites.json` (`map[slug] = {f, o, d}`). It is append-only, so published packs never change unless one of their sounds is removed. The app decodes a pack once (`spriteFile`, six cached) and cuts each sound out with a 30 ms margin (`spriteSlice`). Recordings download as WAV.
- **Freesound job**: `fetch-freesound.mjs` runs four searches at once (API calls throttled to under 60 a minute), applies each query's own `n`, `minRating`, `minRatings`, `bed` and `kind`, caps newer one-shots at 8 s and ambiences at 30 s, and stops at `FREESOUND_MAX_MB` (default 200) or `FREESOUND_MINUTES`. `freesound.json` keeps a `blocked` list of removed sounds.

