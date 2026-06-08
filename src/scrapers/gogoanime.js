const axios = require('axios');
const cheerio = require('cheerio');
const cache = require('../utils/cache');

// Multi-domain fallback — Gogoanime sering ganti domain
const GOGO_DOMAINS = [
  'https://gogoanime3.co',
  'https://gogoanime.tel',
  'https://gogoanime.so',
  'https://anitaku.bz',
  'https://anitaku.pe',
];
const AJAX_DOMAINS = [
  'https://ajax.gogocdn.net',
  'https://ajax.gogo-load.com',
];

const client = axios.create({
  timeout: 12000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.130 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  }
});

async function tryGet(paths, params = {}) {
  const domains = Array.isArray(paths[0]) ? paths : paths.map(p => [null, p]);
  for (const [domainList, path] of domains) {
    const list = domainList || GOGO_DOMAINS;
    for (const base of list) {
      try {
        const res = await client.get(base + path, { params });
        if (res.status === 200 && res.data) return res;
      } catch {}
    }
  }
  throw new Error('All domains failed: ' + paths[0]);
}

// ===== SEARCH =====
async function search(query) {
  const key = `gogo_search_${query}`;
  const cached = cache.get(key);
  if (cached) return cached;

  try {
    const res = await tryGet([[GOGO_DOMAINS, '/search.html']], { keyword: query });
    const $ = cheerio.load(res.data);
    const results = [];
    $('.last_episodes .items li, ul.items li').each((_, el) => {
      const a = $(el).find('.name a, p.name a');
      const img = $(el).find('.img img, div.img img');
      const ep = $(el).find('.episode, p.episode');
      const href = a.attr('href') || '';
      const id = href.replace('/category/', '').replace('/', '').trim();
      if (id) results.push({
        id,
        title: a.text().trim(),
        poster: img.attr('src') || img.attr('data-original') || '',
        latestEp: ep.text().replace('Episode', '').trim(),
      });
    });
    cache.set(key, results, cache.TTL.MEDIUM);
    return results;
  } catch (e) {
    console.error('[Gogo search]', e.message);
    return [];
  }
}

// ===== ANIME INFO + EPISODE LIST =====
async function getInfo(gogoId) {
  const key = `gogo_info_${gogoId}`;
  const cached = cache.get(key);
  if (cached) return cached;

  try {
    const res = await tryGet([[GOGO_DOMAINS, `/category/${gogoId}`]]);
    const $ = cheerio.load(res.data);

    const movieId = $('#movie_id').val();
    const alias = $('#alias_anime').val();
    if (!movieId) throw new Error('movie_id not found');

    // Ep list via AJAX
    const ajaxRes = await tryGet(
      [[AJAX_DOMAINS, '/ajax/load-list-episode']],
      { ep_start: 0, ep_end: 9999, id: movieId, default_ep: 0, alias }
    );
    const $ep = cheerio.load(ajaxRes.data);
    const episodes = [];
    $ep('#episode_related li').each((_, el) => {
      const epNum = $ep(el).find('.name').text().replace('EP', '').trim();
      const href = $ep(el).find('a').attr('href')?.trim().replace('/', '') || '';
      if (epNum && href) episodes.push({ ep: Number(epNum), id: href });
    });
    episodes.sort((a, b) => a.ep - b.ep);

    const result = { id: gogoId, movieId, alias, episodes };
    cache.set(key, result, cache.TTL.MEDIUM);
    return result;
  } catch (e) {
    console.error('[Gogo info]', e.message);
    return { id: gogoId, episodes: [] };
  }
}

// ===== STREAM SOURCES =====
async function getSources(episodeId) {
  const key = `gogo_src_${episodeId}`;
  const cached = cache.get(key);
  if (cached) return cached;

  try {
    const res = await tryGet([[GOGO_DOMAINS, `/${episodeId}`]]);
    const $ = cheerio.load(res.data);

    // Get embed iframe
    const iframeSrc = $('div.play-video iframe, #load_anime iframe').attr('src') || '';
    if (!iframeSrc) {
      console.warn('[Gogo] No iframe for', episodeId);
      return [];
    }

    const embedUrl = iframeSrc.startsWith('//') ? 'https:' + iframeSrc : iframeSrc;
    const sources = await extractSources(embedUrl);

    if (sources.length) {
      cache.set(key, sources, cache.TTL.SHORT);
    }
    return sources;
  } catch (e) {
    console.error('[Gogo getSources]', e.message);
    return [];
  }
}

async function extractSources(embedUrl) {
  const sources = [];
  try {
    const res = await client.get(embedUrl, {
      headers: { 'Referer': GOGO_DOMAINS[0] },
      timeout: 10000,
    });

    const html = res.data;

    // Pattern 1: sources array in script
    const srcMatch = html.match(/sources\s*:\s*\[([^\]]+)\]/);
    if (srcMatch) {
      const urlMatches = [...srcMatch[1].matchAll(/file\s*:\s*['"]([^'"]+)['"]/g)];
      for (const m of urlMatches) {
        sources.push({
          name: m[1].includes('1080') ? 'HD 1080p' :
                m[1].includes('720') ? 'HD 720p' :
                m[1].includes('480') ? 'SD 480p' : 'Auto',
          type: m[1].includes('.m3u8') ? 'hls' : 'mp4',
          url: m[1],
        });
      }
    }

    // Pattern 2: direct m3u8 URL
    if (!sources.length) {
      const hlsMatches = [...html.matchAll(/https?:[^"'\s\\]+\.m3u8[^"'\s\\]*/g)];
      const seen = new Set();
      for (const m of hlsMatches) {
        if (!seen.has(m[0])) {
          seen.add(m[0]);
          sources.push({ name: 'HLS', type: 'hls', url: m[0] });
        }
      }
    }

    // Pattern 3: mp4 fallback
    if (!sources.length) {
      const mp4Matches = [...html.matchAll(/https?:[^"'\s\\]+\.mp4[^"'\s\\]*/g)];
      for (const m of mp4Matches.slice(0, 2)) {
        sources.push({ name: 'MP4', type: 'mp4', url: m[0] });
      }
    }

  } catch (e) {
    console.error('[Gogo extractSources]', e.message);
  }

  return sources;
}

// ===== TITLE → GOGO ID MAPPING =====
async function findGogoId(title, titleAlt) {
  const titles = [title, titleAlt].filter(Boolean);
  for (const t of titles) {
    const results = await search(t);
    if (!results.length) continue;
    const scored = results.map(r => ({
      ...r,
      score: similarity(r.title, t),
    })).sort((a, b) => b.score - a.score);
    if (scored[0]?.score > 0.45) return scored[0].id;
  }
  return null;
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

module.exports = { search, getInfo, getSources, findGogoId };
