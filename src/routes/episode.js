const router = require('express').Router();
const gogo = require('../scrapers/gogoanime');
const mapper = require('../scrapers/mapper');
const anilist = require('../scrapers/anilist');
const cache = require('../utils/cache');

// GET /episode/sources/:anilistId?ep=1
router.get('/sources/:anilistId', async (req, res, next) => {
  try {
    const { anilistId } = req.params;
    const ep = Number(req.query.ep) || 1;

    const cacheKey = `sources_${anilistId}_${ep}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    // Get anime info for title
    const info = await anilist.getInfo(anilistId);
    if (!info) return res.status(404).json({ error: 'Anime not found' });

    // Map to Gogoanime ID
    const gogoId = await mapper.getGogoId(anilistId, info.title, info.title_alt);
    if (!gogoId) {
      return res.json({
        ep,
        sources: [],
        subtitles: [],
        message: 'No stream source found for this anime',
      });
    }

    // Get episode list from gogo
    const gogoInfo = await gogo.getInfo(gogoId);
    const epData = gogoInfo.episodes.find(e => e.ep === ep);

    if (!epData) {
      return res.json({
        ep,
        sources: [],
        subtitles: [],
        message: `Episode ${ep} not found`,
      });
    }

    // Get streaming sources
    const sources = await gogo.getSources(epData.id);

    const result = {
      ep,
      animeId: anilistId,
      gogoId,
      episodeId: epData.id,
      sources: sources.map(s => ({
        name: s.name || 'Gogoanime',
        type: s.type,
        url: s.url,
      })),
      subtitles: [], // Will be handled client-side via subtitle scraping
    };

    cache.set(cacheKey, result, cache.TTL.SHORT);
    res.json(result);
  } catch (e) { next(e); }
});

// GET /episode/list/:anilistId — get episode count
router.get('/list/:anilistId', async (req, res, next) => {
  try {
    const { anilistId } = req.params;
    const cacheKey = `eplist_${anilistId}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const info = await anilist.getInfo(anilistId);
    if (!info) return res.status(404).json({ error: 'Not found' });

    const gogoId = await mapper.getGogoId(anilistId, info.title, info.title_alt);
    let episodes = [];

    if (gogoId) {
      const gogoInfo = await gogo.getInfo(gogoId).catch(() => ({ episodes: [] }));
      episodes = gogoInfo.episodes.map(e => ({
        ep: e.ep,
        id: e.id,
      }));
    } else {
      // Fallback: generate from AniList total_eps
      const total = info.total_eps || 1;
      episodes = Array.from({ length: total }, (_, i) => ({ ep: i + 1 }));
    }

    const result = { anilistId, gogoId, total: episodes.length, episodes };
    cache.set(cacheKey, result, cache.TTL.MEDIUM);
    res.json(result);
  } catch (e) { next(e); }
});

module.exports = router;
