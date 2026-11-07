# Roadmap: from prototype to a massive, free, ad-supported service

## Phase 0: today (this repo)

- Zero-dependency Node server, SQLite + FTS5 search, vanilla JS front end.
- 47 original CC0 sounds and music loops generated from code (`scripts/catalog.js`).
- Freesound importer for CC0/CC BY content (`scripts/import-freesound.js`).
- A single small VM can serve this for roughly the first 100k sounds.

## Content sourcing: read this before scaling ⚠️

A big library is only as good as its legal footing. An ad-funded site counts as **commercial use**.

| Source | Can we host it on an ad-supported site? |
|---|---|
| Your own recordings and generated sounds | ✅ Yes. The best long-term moat. |
| Freesound CC0 / CC BY sounds | ✅ The sounds themselves can be hosted. ⚠️ **But Freesound's API terms restrict commercial use without permission.** Email the Freesound team (MTG-UPF) for a commercial agreement before running the importer in production, or download through allowed channels and host the files yourself. Always keep the author credit and a link back. |
| Freesound CC BY-NC / Sampling+ | ❌ Skipped by the importer. NC means no commercial use, and that includes ad-funded hosting. |
| Wikimedia Commons, Internet Archive (public-domain recordings), Musopen | ✅ For items that really are CC0, public domain, or CC BY. Check each item. |
| OpenGameArt (CC0 / CC BY subset) | ✅ Same caveat: filter by license. |
| Pixabay, Zapsplat, Mixkit, BBC, Sonniss | ❌ Their licenses forbid redistribution or re-hosting on competing platforms. |
| Community uploads | ✅ With a contributor agreement (uploader confirms they own it and licenses it CC0/CC BY), moderation, and a DMCA process. |

**Recommendation:** Grow through original content (commission sound designers, run "sound packs" contests) and community uploads, plus CC0 imports. Get explicit permission before bulk-importing from any API.

## Phase 1: launch (≈ 0–100k sounds)

- [ ] Domain, HTTPS, and a CDN in front of `/media` (Cloudflare R2 or S3 + CloudFront). Media URLs are already immutable and cacheable.
- [ ] Move audio to object storage. Encode to MP3 (preview) + WAV/FLAC (download) with a worker queue.
- [ ] Loudness normalization at ingest (EBU R128, about −16 LUFS for previews) so previews don't jump in volume.
- [ ] Open Graph/Twitter cards and a server-rendered `/sound/:id` page for SEO. Long-tail search ("door creak sound effect free") is the main growth channel.
- [ ] sitemap.xml and JSON-LD `AudioObject` markup.
- [ ] Privacy-friendly analytics (Plausible/Umami). Cookie consent only when ads require it.

## Phase 2: ads that don't ruin it

- Start with **EthicalAds or Carbon** (one quiet unit, developer/creator audience), then add **AdSense or Ezoic** at scale.
- Placement rules (already in the UI): sidebar 300×250, in-feed every 10 rows, one unit on detail pages. Never next to download buttons. Space reserved to avoid layout shift. No audio ads, ever.
- Add the ad network's domains to the CSP in `server/index.js` (`script-src`, `frame-src`, `img-src`, `connect-src`).
- Optional "Soundwell Plus" (no ads, WAV, bulk zip downloads) as a second revenue line.
- Rough numbers: free SFX sites typically earn single-digit dollars RPM. 1M pageviews/month ≈ $2–8k/month, depending on geography and niche.

## Phase 3: massive scale (100k → 10M+ sounds)

- **Database:** Postgres (metadata, users, collections). SQLite's schema maps over one-to-one.
- **Search:** Meilisearch or Typesense (typo tolerance, facets, synonyms out of the box), or OpenSearch. Keep the `/api/search` contract so the front end doesn't change.
- **Semantic and audio search:** compute CLAP audio-text embeddings per sound and store them in pgvector. That enables "sounds like this," text-to-sound search, and upload-a-clip search.
- **Auto-tagging and descriptions:** run audio-captioning models at ingest to draft the plain-language description. A human reviews it for featured content.
- **Uploads:** resumable uploads, virus/format checks, duplicate detection via audio fingerprinting (Chromaprint), moderation queue, DMCA workflow.
- **Accounts:** optional. Sync saved sounds and collections across devices and give uploaders profiles. Downloads stay anonymous.

## Accessibility commitments (keep these as the site grows)

- Every sound ships with a text description. Make it a required field for uploads.
- Run axe-core in CI and do a manual screen-reader pass (VoiceOver, NVDA) each release.
- Nothing autoplays. Keyboard shortcuts can be turned off. Respect reduced motion and forced colors.
