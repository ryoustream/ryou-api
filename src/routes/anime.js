const router = require('express').Router();
const anilist = require('../scrapers/anilist');

// GET /anime/search?q=naruto&page=1
router.get('/search', async (req, res, next) => {
  try {
    const { q, page = 1 } = req.query;
    if (!q) return res.status(400).json({ error: 'q is required' });
    const results = await anilist.search(q, Number(page));
    res.json({ results, page: Number(page) });
  } catch (e) { next(e); }
});

// GET /anime/trending?page=1&limit=20
router.get('/trending', async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const results = await anilist.getTrending(Number(page), Number(limit));
    res.json({ results });
  } catch (e) { next(e); }
});

// GET /anime/popular?page=1&limit=20
router.get('/popular', async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const results = await anilist.getPopular(Number(page), Number(limit));
    res.json({ results });
  } catch (e) { next(e); }
});

// GET /anime/recent?page=1&limit=20
router.get('/recent', async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const results = await anilist.getRecent(Number(page), Number(limit));
    res.json({ results });
  } catch (e) { next(e); }
});

// GET /anime/featured
router.get('/featured', async (req, res, next) => {
  try {
    const results = await anilist.getFeatured(6);
    res.json({ results });
  } catch (e) { next(e); }
});

// GET /anime/info/:id  (AniList ID)
router.get('/info/:id', async (req, res, next) => {
  try {
    const info = await anilist.getInfo(req.params.id);
    if (!info) return res.status(404).json({ error: 'Not found' });
    res.json(info);
  } catch (e) { next(e); }
});

module.exports = router;
