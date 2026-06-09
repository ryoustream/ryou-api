const router = require('express').Router();
const gogo = require('../scrapers/gogoanime');
const allanime = require('../scrapers/allanime');
const mapper = require('../scrapers/mapper');
const anilist = require('../scrapers/anilist');
const cache = require('../utils/cache');

// GET /episode/sources/:anilistId?ep=1
router.get('/sources/:anilistId', async (req, res, next) => {
  try {
    const { anilistId } = req.params;
    const ep = Number(req.query.ep) || 1;
    const cacheKey = `src_${anilistId}_ep${ep}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const info = await anilist.getInfo(anilistId);
    if (!info) return res.status(404).json({ error: 'Anime not found' });

    let sources = [];

    // ===== TRY 1: AllAnime =====
    try {
      const allaId = await mapper.getAllAnimeId(anilistId, info.title, info.title_alt);
      if (allaId) {
        sources = await allanime.getEpisodeSources(allaId, ep);
      }
    } catch (e) {
      console.warn('[EP] AllAnime failed:', e.message);
    }

    // ===== TRY 2: Gogoanime =====
    if (!sources.length) {
      try {
        const gogoId = await mapper.getGogoId(anilistId, info.title, info.title_alt);
        if (gogoId) {
          const gogoInfo = await gogo.getInfo(gogoId);
          const epData = gogoInfo.episodes.find(e => e.ep === ep)
            || { id: `${gogoId}-episode-${ep}` };
          sources = await gogo.getSources(epData.id);
        }
      } catch (e) {
        console.warn('[EP] Gogo failed:', e.message);
      }
    }

    const result = {
      ep,
      animeId: anilistId,
      title: info.title,
      sources,
      message: sources.length ? undefined : 'Sumber video tidak ditemukan saat ini. Coba beberapa saat lagi.',
    };

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

    let episodes = [];
    let gogoId = null;

    // Try Gogo first for episode list (more reliable for count)
    try {
      gogoId = await mapper.getGogoId(anilistId, info.title, info.title_alt);
      if (gogoId) {
        const gogoInfo = await gogo.getInfo(gogoId);
        episodes = gogoInfo.episodes;
      }
    } catch {}

    // Fallback: generate from AniList total_eps
    if (!episodes.length && info.total_eps) {
      episodes = Array.from({ length: info.total_eps }, (_, i) => ({ ep: i + 1 }));
    }

    const result = { anilistId, gogoId, total: episodes.length, episodes };
    cache.set(cacheKey, result, cache.TTL.MEDIUM);
    res.json(result);
  } catch (e) { next(e); }
});

module.exports = router;

// GET /episode/embed/:anilistId?ep=1
// Returns embed URLs yang bisa langsung di-iframe di browser
router.get('/embed/:anilistId', async (req, res, next) => {
  try {
    const { anilistId } = req.params;
    const ep = Number(req.query.ep) || 1;

    const info = await anilist.getInfo(anilistId);
    if (!info) return res.status(404).json({ error: 'Not found' });

    const { getEmbedUrls } = require('../scrapers/embedproviders');
    const embeds = getEmbedUrls(info.idMal, info.title, ep);

    res.json({ ep, title: info.title, malId: info.idMal, embeds });
  } catch (e) { next(e); }
});
