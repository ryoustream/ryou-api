const { get } = require('../utils/http');
const cheerio = require('cheerio');
const cache = require('../utils/cache');
const crypto = require('crypto');

const BASE = 'https://gogoanime3.co';
const AJAX = 'https://ajax.gogocdn.net';

// ===== SEARCH =====
async function search(query) {
  const key = `gogo_search_${query}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const res = await get(`${BASE}/search.html`, { params: { keyword: query } });
  const $ = cheerio.load(res.data);

  const results = [];
  $('.last_episodes .items li').each((_, el) => {
    const a = $(el).find('.name a');
    const img = $(el).find('.img img');
    const ep = $(el).find('.episode');
    results.push({
      id: a.attr('href')?.replace('/category/', '').trim(),
      title: a.text().trim(),
      poster: img.attr('src') || img.attr('data-original'),
      episodes: ep.text().replace('Episode', '').trim(),
    });
  });

  cache.set(key, results, cache.TTL.MEDIUM);
  return results;
}

// ===== ANIME INFO =====
async function getInfo(gogoId) {
  const key = `gogo_info_${gogoId}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const res = await get(`${BASE}/category/${gogoId}`);
  const $ = cheerio.load(res.data);

  const movieId = $('#movie_id').val();
  const alias = $('#alias_anime').val();

  // Episode list via AJAX
  const epListRes = await get(`${AJAX}/ajax/load-list-episode`, {
    params: {
      ep_start: 0,
      ep_end: 9999,
      id: movieId,
      default_ep: 0,
      alias,
    }
  });
  const $ep = cheerio.load(epListRes.data);
  const episodes = [];
  $ep('#episode_related li').each((_, el) => {
    const epNum = $ep(el).find('.name').text().replace('EP', '').trim();
    const href = $ep(el).find('a').attr('href')?.trim();
    episodes.push({
      ep: Number(epNum),
      id: href?.replace('/', ''),
    });
  });
  episodes.reverse();

  const result = {
    id: gogoId,
    movieId,
    alias,
    episodes,
  };

  cache.set(key, result, cache.TTL.MEDIUM);
  return result;
}

// ===== EPISODE SOURCES =====
// Gogoanime uses encrypted video URLs
async function getSources(episodeId) {
  const key = `gogo_src_${episodeId}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const res = await get(`${BASE}/${episodeId}`);
  const $ = cheerio.load(res.data);

  // Get iframe embed URL
  const iframeSrc = $('#load_anime .play-video iframe').attr('src') ||
                    $('div.play-video iframe').attr('src');

  if (!iframeSrc) throw new Error('No iframe found');

  // Extract from gogoplay/streamani
  const embedUrl = iframeSrc.startsWith('//') ? 'https:' + iframeSrc : iframeSrc;
  const sources = await extractFromEmbed(embedUrl);

  cache.set(key, sources, cache.TTL.SHORT);
  return sources;
}

async function extractFromEmbed(embedUrl) {
  try {
    const res = await get(embedUrl, {
      headers: { 'Referer': BASE }
    });
    const $ = cheerio.load(res.data);

    // Try to get script data
    const scriptContent = $('script').map((_, el) => $(el).html()).get().join('\n');

    // Look for sources array in script
    const sourcesMatch = scriptContent.match(/sources\s*:\s*\[([^\]]+)\]/);
    if (sourcesMatch) {
      const sources = [];
      const urlMatches = sourcesMatch[1].matchAll(/file\s*:\s*['"]([^'"]+)['"]/g);
      for (const m of urlMatches) {
        sources.push({
          name: 'Gogoanime',
          type: m[1].includes('.m3u8') ? 'hls' : 'mp4',
          url: m[1],
        });
      }
      if (sources.length) return sources;
    }

    // Fallback: look for direct HLS
    const hlsMatch = res.data.match(/https?:[^"'\s]+\.m3u8[^"'\s]*/);
    if (hlsMatch) {
      return [{ name: 'Gogoanime', type: 'hls', url: hlsMatch[0] }];
    }

    return [];
  } catch (e) {
    console.error('[Gogo] extractFromEmbed error:', e.message);
    return [];
  }
}

// ===== FIND GOGO ID BY TITLE =====
async function findGogoId(title) {
  const results = await search(title);
  if (!results.length) return null;

  // Try exact match first
  const exact = results.find(r =>
    r.title?.toLowerCase() === title.toLowerCase()
  );
  return (exact || results[0]).id;
}

// ===== RECENT EPISODES =====
async function getRecent(page = 1) {
  const key = `gogo_recent_${page}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const res = await get(`${AJAX}/ajax/page-recent-release.html`, {
    params: { page, type: 1 }
  });
  const $ = cheerio.load(res.data);

  const results = [];
  $('.items li').each((_, el) => {
    const a = $(el).find('.name a');
    const img = $(el).find('.img img');
    const ep = $(el).find('p.episode');
    results.push({
      id: a.attr('href')?.replace('/', '').split('-episode-')[0],
      episodeId: a.attr('href')?.replace('/', ''),
      title: a.text().trim(),
      poster: img.attr('src'),
      latestEp: ep.text().replace('Episode', '').trim(),
    });
  });

  cache.set(key, results, cache.TTL.SHORT);
  return results;
}

module.exports = { search, getInfo, getSources, findGogoId, getRecent };
