/**
 * Embed Providers — tidak perlu scraping server-side
 * URL-nya bisa langsung di-load di browser via iframe atau fetch
 */

// Provider yang bisa generate embed URL dari MAL ID / title
const PROVIDERS = {
  // 2embed — support MAL ID
  embed2: (malId, ep) =>
    `https://2embed.skin/embed/anime/mal/${malId}/${ep}`,

  // AnimeFrenzy embed
  animefrenzy: (title, ep) =>
    `https://animefrenzy.org/embed/${encodeURIComponent(title)}/${ep}`,

  // AnimeID embed
  animeid: (malId, ep) =>
    `https://embed.animeid.to/embed/${malId}/${ep}`,

  // Malsync compatible players
  animixplay: (malId, ep) =>
    `https://animixplay.to/v1/${malId}/${ep}`,
};

// Providers yang expose HLS langsung via API (no browser needed)
const API_PROVIDERS = [
  // anime-sama (French, but has API)
  {
    name: 'AnimeEpisode',
    getUrl: (malId, ep) =>
      `https://anime-episode.com/api/episode?mal=${malId}&ep=${ep}`,
  },
];

function getEmbedUrls(malId, title, ep) {
  return [
    {
      name: '2Embed',
      type: 'embed',
      url: `https://2embed.skin/embed/anime/mal/${malId}/${ep}`,
    },
    {
      name: 'AnimeID',
      type: 'embed',
      url: `https://embed.animeid.to/embed/${malId}/${ep}`,
    },
  ].filter(s => s.url);
}

module.exports = { getEmbedUrls, PROVIDERS };
