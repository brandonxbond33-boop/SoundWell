// Runtime configuration. Swap the ad provider here when you go live (see docs/ROADMAP.md).
window.SOUNDWELL_CONFIG = {
  ads: {
    enabled: true,
    // 'house' renders self-promo placeholders with reserved space (no layout shift).
    // Later: 'adsense' | 'carbon' | 'ethicalads' — keep audio-free, non-animated formats.
    provider: 'house',
    inFeedEvery: 10, // one ad row per N results
  },
};
