const { get } = require('../utils/http');
const cache = require('../utils/cache');
const gogo = require('./gogoanime');

// AniList ID -> Gogoanime ID mapping (persistent cache)
const mapping = new Map();

async function getGogoId(anilistId, title, titleAlt) {
  const key = `map_${anilistId}`;

  // Check in-memory map
  if (mapping.has(key)) return mapping.get(key);

  // Check cache
  const cached = cache.get(key);
  if (cached) { mapping.set(key, cached); return cached; }

  // Try Anime-Planet / MAL mapping via Jikan as bridge
  let gogoId = null;

  // Try direct search with title
  const titles = [title, titleAlt].filter(Boolean);
  for (const t of titles) {
    const results = await gogo.search(t).catch(() => []);
    if (results.length) {
      // Score each result by title similarity
      const scored = results.map(r => ({
        ...r,
        score: titleSimilarity(r.title, t),
      })).sort((a, b) => b.score - a.score);

      if (scored[0]?.score > 0.5) {
        gogoId = scored[0].id;
        break;
      }
    }
  }

  if (gogoId) {
    mapping.set(key, gogoId);
    cache.set(key, gogoId, cache.TTL.DAY);
  }

  return gogoId;
}

function titleSimilarity(a, b) {
  if (!a || !b) return 0;
  a = a.toLowerCase().replace(/[^a-z0-9 ]/g, '');
  b = b.toLowerCase().replace(/[^a-z0-9 ]/g, '');
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.8;

  const aWords = new Set(a.split(' '));
  const bWords = b.split(' ');
  const common = bWords.filter(w => aWords.has(w)).length;
  return common / Math.max(aWords.size, bWords.length);
}

module.exports = { getGogoId };
