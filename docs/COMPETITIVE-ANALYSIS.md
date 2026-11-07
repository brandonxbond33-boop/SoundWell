# Competitive analysis

How Soundwell compares to existing sound and music libraries, and what we borrowed or improved.

> Library sizes and policies come from public knowledge as of late 2026 and change often.
> Check each site before quoting numbers publicly.

## The landscape

| Site | Model | Approx. library | Login to download? | License clarity | What they do well | Where they fall short |
|---|---|---|---|---|---|---|
| **Freesound** | Nonprofit, community uploads | 600k+ sounds | Yes | Mixed (CC0 / BY / BY-NC per sound) | Huge, deep catalog with real field recordings, good tags, an API | Dated UI. Mixed licenses trip people up (NC sounds look the same as the rest). Login wall. Slow search UX |
| **Pixabay (Sound Effects & Music)** | Ad-supported, free | Large, fast-growing | No | Simple own license | Clean UI, no login, quick previews | Own license (not CC) with redistribution limits. Weak filters (no BPM/key on SFX). Inconsistent quality |
| **Zapsplat** | Freemium + ads | 150k+ | Yes (free tier) | Own license, attribution on free tier | Massive pro-quality SFX, good categories | Login wall. Download caps and lower quality on the free tier. Busy ad layout |
| **Mixkit** (Envato) | Free funnel to paid | Small, curated | No | Own license | Beautiful, curated, fast | Small. Mostly a funnel to Envato Elements |
| **YouTube Audio Library** | Free, inside YouTube Studio | Thousands | Yes (YouTube account) | Clear, but YouTube-centric | Safe for YouTube Content ID | Locked inside YouTube Studio. Little use for games or apps |
| **Uppbeat** | Freemium music | Curated music | Yes | Credit codes + Content ID whitelist | Strong creator-focused music UX, mood browsing | Free downloads capped. Music-first, thin on SFX |
| **Epidemic Sound / Artlist** | Paid subscription | Very large, pro | Paid | Very clear | Best-in-class UI: waveforms, stems, "find similar", moods | Paid. This is the UX bar to match for free |
| **BBC Sound Effects** | Public archive | ~30k+ | No | RemArc license (personal/educational only) | Iconic archival recordings | No commercial use, so you can't build a product on it |
| **Sonniss GDC bundles** | Free yearly bundles | Huge zip archives | No | Royalty-free, no redistribution | Pro quality | Not browsable or searchable. Can't be re-hosted |

## Patterns worth copying

1. **Waveform-first list rows** (Epidemic, Artlist). You can tell a sound's shape before you play it. Click the waveform to jump to that point.
2. **One persistent player** (Epidemic, Uppbeat). Playback keeps going while you browse.
3. **No login to preview or download** (Pixabay, Mixkit). This is the biggest conversion factor on free sites.
4. **Mood, BPM, and key filters for music** (Uppbeat, Epidemic).
5. **"Find similar"** (Epidemic). It turns one good find into a session.
6. **Popular-search chips** on the home page (Pixabay). They help people who don't know what to type.

## Gaps we fill (Soundwell's differentiators)

| Problem on other sites | What Soundwell does |
|---|---|
| Licenses are confusing, and NC sounds look like everything else | **Only CC0 and CC BY are allowed** (enforced in the database). Each sound has a plain-English "Can I use this?" card and a **one-click credit line** formatted to paste. |
| Audio is inaccessible to Deaf/HoH users and screen-reader users | **Every sound has a written description** ("What it sounds like"). It's also indexed for search, so "something like a bubble popping" works. |
| Keyboard and screen-reader support is weak or missing | Full keyboard control (`/`, Space, N/P, ←/→, R, F, M, `?`), single-key shortcuts you can turn off (WCAG 2.1.4), live-region announcements, a native range slider for seeking, focus management on navigation. **0 axe-core violations** (WCAG 2.2 AA plus best practices) in light and dark. |
| Ads are intrusive (autoplaying video, layout shift, ads styled like download buttons) | Ad rules in the product: clearly labeled, **reserved space (no layout shift)**, never audio, never animated, never next to download buttons. In-feed ads appear every N rows. |
| Search is literal ("scary" finds nothing tagged "horror") | Prefix matching, stemming, and a synonym map (scary→horror/dark/tension, chill→calm/lofi, ui→interface/button), ranked with BM25 weighted toward titles. |
| Filter counts go to zero and dead-end you | **Multi-select facets with live counts** that leave out their own filter, removable filter chips, and a "no results" state with recovery actions. |
| Hover-to-play surprises people (an accessibility and etiquette problem) | Nothing plays until you ask. Auto-next is opt-in. |
| No "loopable" signal | **Seamless loop** filter and badge, plus a loop toggle in the player. |
| Slow pages | No framework, no build, about 12 KB of JS gzipped. SVG waveforms come from precomputed peaks, so audio isn't decoded to draw them. Audio is streamed with HTTP Range requests. |

## Still to match (see ROADMAP.md)

- Stems and alternate versions for music (Epidemic/Artlist).
- WAV downloads and more formats (Zapsplat).
- User uploads with moderation (Freesound).
- Collections you can share (Uppbeat playlists).
- Content ID–safe music registry for YouTube creators (Uppbeat, YouTube Audio Library).
- Audio-similarity search from embeddings ("sounds like this file").
