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
    const cacheKey = `sources_${anilistId}_ep${ep}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    // Get anime info
    const info = await anilist.getInfo(anilistId);
    if (!info) return res.status(404).json({ error: 'Anime not found' });

    // Map to Gogo ID
    const gogoId = await mapper.getGogoId(anilistId, info.title, info.title_alt);
    if (!gogoId) {
      return res.json({ ep, sources: [], message: 'Anime tidak ditemukan di sumber video' });
    }

    // Get episode list
    const gogoInfo = await gogo.getInfo(gogoId);
    const epData = gogoInfo.episodes.find(e => e.ep === ep);
    if (!epData) {
      // Try with episode id pattern: gogoId-episode-N
      const guessId = `${gogoId}-episode-${ep}`;
      const sources = await gogo.getSources(guessId);
      const result = { ep, gogoId, sources };
      if (sources.length) cache.set(cacheKey, result, cache.TTL.SHORT);
      return res.json(result);
    }

    const sources = await gogo.getSources(epData.id);
    const result = { ep, gogoId, episodeId: epData.id, sources };
    if (sources.length) cache.set(cacheKey, result, cache.TTL.SHORT);
    res.json(result);
  } catch (e) { next(e); }
});

// GET /episode/list/:anilistId
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
      episodes = gogoInfo.episodes;
    }

    // Fallback dari total_eps AniList
    if (!episodes.length && info.total_eps) {
      episodes = Array.from({ length: info.total_eps }, (_, i) => ({ ep: i + 1 }));
    }

    const result = { anilistId, gogoId, total: episodes.length, episodes };
    cache.set(cacheKey, result, cache.TTL.MEDIUM);
    res.json(result);
  } catch (e) { next(e); }
});

module.exports = router;
