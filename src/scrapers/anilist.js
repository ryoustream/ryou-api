const { post } = require('../utils/http');
const cache = require('../utils/cache');

const ANILIST = 'https://graphql.anilist.co';

const MEDIA_FIELDS = `
  id
  idMal
  title { romaji english native }
  type
  format
  status
  description(asHtml: false)
  startDate { year month day }
  endDate { year month day }
  season
  seasonYear
  episodes
  duration
  coverImage { extraLarge large medium color }
  bannerImage
  genres
  averageScore
  popularity
  trending
  studios(isMain: true) { nodes { name } }
  nextAiringEpisode { airingAt episode }
  trailer { id site }
`;

async function query(gql, variables = {}) {
  const res = await post(ANILIST,
    { query: gql, variables },
    { headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' } }
  );
  return res.data;
}

function formatAnime(m) {
  if (!m) return null;
  return {
    id: String(m.id),
    idMal: m.idMal,
    title: m.title?.english || m.title?.romaji,
    title_alt: m.title?.romaji,
    title_native: m.title?.native,
    type: m.format || m.type,
    status: formatStatus(m.status),
    year: m.seasonYear || m.startDate?.year,
    season: m.season,
    total_eps: m.episodes,
    duration: m.duration,
    rating: m.averageScore ? (m.averageScore / 10).toFixed(1) : null,
    popularity: m.popularity,
    trending: m.trending > 0,
    trending_score: m.trending,
    studio: m.studios?.nodes?.[0]?.name || null,
    genres: m.genres || [],
    poster: m.coverImage?.extraLarge || m.coverImage?.large,
    banner: m.bannerImage,
    synopsis: m.description?.replace(/<[^>]+>/g, '') || '',
    next_ep: m.nextAiringEpisode ? {
      ep: m.nextAiringEpisode.episode,
      airing_at: m.nextAiringEpisode.airingAt,
    } : null,
    color: m.coverImage?.color,
  };
}

function formatStatus(s) {
  const map = {
    RELEASING: 'ongoing',
    FINISHED: 'completed',
    NOT_YET_RELEASED: 'upcoming',
    CANCELLED: 'cancelled',
    HIATUS: 'hiatus',
  };
  return map[s] || s?.toLowerCase();
}

async function getTrending(page = 1, limit = 20) {
  const key = `trending_${page}_${limit}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const data = await query(`
    query($page: Int, $limit: Int) {
      Page(page: $page, perPage: $limit) {
        media(sort: TRENDING_DESC, type: ANIME, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `, { page, limit });

  const result = data.data.Page.media.map(formatAnime).filter(Boolean);
  cache.set(key, result, cache.TTL.MEDIUM);
  return result;
}

async function getPopular(page = 1, limit = 20) {
  const key = `popular_${page}_${limit}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const data = await query(`
    query($page: Int, $limit: Int) {
      Page(page: $page, perPage: $limit) {
        media(sort: POPULARITY_DESC, type: ANIME, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `, { page, limit });

  const result = data.data.Page.media.map(formatAnime).filter(Boolean);
  cache.set(key, result, cache.TTL.LONG);
  return result;
}

async function getRecent(page = 1, limit = 20) {
  const key = `recent_${page}_${limit}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const data = await query(`
    query($page: Int, $limit: Int) {
      Page(page: $page, perPage: $limit) {
        media(sort: UPDATED_AT_DESC, type: ANIME, isAdult: false, status: RELEASING) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `, { page, limit });

  const result = data.data.Page.media.map(formatAnime).filter(Boolean);
  cache.set(key, result, cache.TTL.SHORT);
  return result;
}

async function search(q, page = 1, limit = 20) {
  const key = `search_${q}_${page}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const data = await query(`
    query($q: String, $page: Int, $limit: Int) {
      Page(page: $page, perPage: $limit) {
        media(search: $q, type: ANIME, isAdult: false) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `, { q, page, limit });

  const result = data.data.Page.media.map(formatAnime).filter(Boolean);
  cache.set(key, result, cache.TTL.MEDIUM);
  return result;
}

async function getInfo(id) {
  const key = `info_${id}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const data = await query(`
    query($id: Int) {
      Media(id: $id, type: ANIME) {
        ${MEDIA_FIELDS}
        relations {
          edges {
            relationType
            node {
              id
              title { romaji english }
              format
              coverImage { medium }
            }
          }
        }
        recommendations(sort: RATING_DESC, perPage: 10) {
          nodes {
            mediaRecommendation {
              id
              title { romaji english }
              coverImage { large }
              format
              averageScore
            }
          }
        }
      }
    }
  `, { id: Number(id) });

  const m = data.data.Media;
  const result = {
    ...formatAnime(m),
    relations: m.relations?.edges?.map(e => ({
      type: e.relationType,
      id: String(e.node.id),
      title: e.node.title?.english || e.node.title?.romaji,
      format: e.node.format,
      poster: e.node.coverImage?.medium,
    })) || [],
    recommendations: m.recommendations?.nodes?.map(n => {
      const r = n.mediaRecommendation;
      return {
        id: String(r.id),
        title: r.title?.english || r.title?.romaji,
        poster: r.coverImage?.large,
        format: r.format,
        rating: r.averageScore ? (r.averageScore / 10).toFixed(1) : null,
      };
    }) || [],
  };

  cache.set(key, result, cache.TTL.LONG);
  return result;
}

async function getFeatured(limit = 5) {
  const key = `featured_${limit}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const data = await query(`
    query($limit: Int) {
      Page(page: 1, perPage: $limit) {
        media(sort: TRENDING_DESC, type: ANIME, isAdult: false, status: RELEASING, bannerImage_not: null) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `, { limit });

  const result = data.data.Page.media
    .filter(m => m.bannerImage)
    .map((m, i) => ({ ...formatAnime(m), featured: true, featured_order: i + 1 }));

  cache.set(key, result, cache.TTL.MEDIUM);
  return result;
}

module.exports = { getTrending, getPopular, getRecent, search, getInfo, getFeatured };
