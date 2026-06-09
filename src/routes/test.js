const router = require('express').Router();
const axios = require('axios');

// GET /test/ping?url=https://...
router.get('/ping', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.json({ error: 'url required' });
  try {
    const start = Date.now();
    const r = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://allanime.to/',
        'Origin': 'https://allanime.to',
      },
      validateStatus: () => true,
    });
    res.json({ status: r.status, ms: Date.now() - start, size: r.data?.length || 0 });
  } catch (e) {
    res.json({ error: e.message, code: e.code });
  }
});

// GET /test/allanime?q=naruto
router.get('/allanime', async (req, res) => {
  const { q = 'naruto' } = req.query;
  try {
    const allanime = require('../scrapers/allanime');
    const results = await allanime.search(q);
    res.json({ count: results.length, results: results.slice(0, 3) });
  } catch (e) {
    res.json({ error: e.message });
  }
});

// GET /test/sources?id=ANILIST_ID&ep=1
router.get('/sources', async (req, res) => {
  const { id = '20', ep = '1' } = req.query;
  try {
    const anilist = require('../scrapers/anilist');
    const mapper = require('../scrapers/mapper');
    const allanime = require('../scrapers/allanime');
    const info = await anilist.getInfo(id);
    const allaId = await mapper.getAllAnimeId(id, info.title, info.title_alt);
    const sources = allaId ? await allanime.getEpisodeSources(allaId, Number(ep)) : [];
    res.json({ title: info.title, allaId, ep: Number(ep), sources });
  } catch (e) {
    res.json({ error: e.message });
  }
});

module.exports = router;
