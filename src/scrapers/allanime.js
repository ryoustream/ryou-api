/**
 * AllAnime API Scraper
 * Public GraphQL endpoint — tidak perlu auth
 */
const axios = require('axios');
const cache = require('../utils/cache');

const API = 'https://api.allanime.day/api';
const SITE = 'https://allanime.to';

const client = axios.create({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': SITE,
    'Origin': SITE,
  },
});

async function gql(query, variables = {}) {
  const params = new URLSearchParams({
    variables: JSON.stringify(variables),
    extensions: JSON.stringify({
      persistedQuery: {
        version: 1,
        sha256Hash: hashQuery(query),
      },
    }),
  });
  const res = await client.get(`${API}?${params}`);
  return res.data;
}

// Simple hash placeholder — AllAnime uses persisted queries
// Fallback: POST body
async function gqlPost(query, variables = {}) {
  const res = await client.post(API, { query, variables }, {
    headers: { 'Content-Type': 'application/json' },
  });
  return res.data;
}

function hashQuery(q) {
  // Simplified — AllAnime accepts POST directly
  return '0';
}

// ===== SEARCH =====
async function search(query, page = 1) {
  const key = `alla_search_${query}_${page}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const q = `
    query($search: SearchInput, $limit: Int, $page: Int) {
      shows(search: $search, limit: $limit, page: $page, translationLanguages: ["sub", "dub"]) {
        edges {
          _id
          name
          englishName
          thumbnail
          season { year quarter }
          score
          type
          episodeCount
          status
        }
      }
    }
  `;

  try {
    const data = await gqlPost(q, {
      search: { query, allowAdult: false },
      limit: 20,
      page,
    });
    const shows = data?.data?.shows?.edges || [];
    const result = shows.map(formatShow);
    cache.set(key, result, cache.TTL.MEDIUM);
    return result;
  } catch (e) {
    console.error('[AllAnime search]', e.message);
    return [];
  }
}

// ===== EPISODE SOURCES =====
async function getEpisodeSources(showId, ep) {
  const key = `alla_src_${showId}_ep${ep}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const q = `
    query($showId: String!, $episodeString: String!, $languages: [String]) {
      episode(showId: $showId, episodeString: $episodeString, translationLanguages: $languages) {
        episodeInfo {
          vidInforssucks { vidInfo { sourceUrls } }
          vidInfosSub { vidInfo { sourceUrls } }
        }
        sourceUrls {
          sourceUrl
          sourceName
          type
          downloads { sourceName sourceUrl }
        }
      }
    }
  `;

  try {
    const data = await gqlPost(q, {
      showId,
      episodeString: String(ep),
      languages: ['sub'],
    });

    const episode = data?.data?.episode;
    if (!episode) return [];

    const sourceUrls = episode.sourceUrls || [];
    const sources = [];

    for (const s of sourceUrls) {
      if (!s.sourceUrl) continue;
      const url = decodeSourceUrl(s.sourceUrl);
      if (!url) continue;
      sources.push({
        name: s.sourceName || 'AllAnime',
        type: url.includes('.m3u8') ? 'hls' : 'mp4',
        url,
      });
    }

    if (sources.length) cache.set(key, sources, cache.TTL.SHORT);
    return sources;
  } catch (e) {
    console.error('[AllAnime sources]', e.message);
    return [];
  }
}

// AllAnime obfuscates URLs with simple cipher
function decodeSourceUrl(encoded) {
  if (!encoded) return null;
  if (encoded.startsWith('http')) return encoded;

  try {
    // Base64 decode attempt
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    if (decoded.startsWith('http')) return decoded;
  } catch {}

  try {
    // Hex decode
    if (/^[0-9a-fA-F]+$/.test(encoded)) {
      const decoded = Buffer.from(encoded, 'hex').toString('utf-8');
      if (decoded.startsWith('http')) return decoded;
    }
  } catch {}

  // Try simple substitution cipher AllAnime uses
  try {
    const cipher = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_';
    const plain  = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_';
    // AllAnime uses a shifted cipher — attempt decode
    const shifted = encoded.replace(/./g, c => {
      const i = cipher.indexOf(c);
      return i >= 0 ? plain[(i + 56) % 64] : c;
    });
    if (shifted.startsWith('http')) return shifted;
  } catch {}

  return null;
}

// ===== FIND SHOW ID =====
async function findShowId(title, titleAlt) {
  const titles = [title, titleAlt].filter(Boolean);
  for (const t of titles) {
    const results = await search(t);
    if (!results.length) continue;
    const scored = results.map(r => ({
      ...r,
      score: similarity(r.title, t),
    })).sort((a, b) => b.score - a.score);
    if (scored[0]?.score > 0.45) return scored[0]._id || scored[0].id;
  }
  return null;
}

function formatShow(s) {
  return {
    id: s._id,
    title: s.englishName || s.name,
    title_alt: s.name,
    poster: s.thumbnail,
    year: s.season?.year,
    total_eps: s.episodeCount,
    rating: s.score,
    status: s.status?.toLowerCase(),
    type: s.type,
  };
}

function similarity(a, b) {
  if (!a || !b) return 0;
  a = a.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  b = b.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.85;
  const aW = new Set(a.split(/\s+/));
  const bW = b.split(/\s+/);
  const common = bW.filter(w => w.length > 2 && aW.has(w)).length;
  return common / Math.max(aW.size, bW.length);
}

module.exports = { search, getEpisodeSources, findShowId };
