const router = require('express').Router();

// Static channel list — bisa diupdate manual atau dari scraper
const CHANNELS = [
  { id: 'rcti', name: 'RCTI', category: 'entertainment', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/RCTI_logo.svg/200px-RCTI_logo.svg.png', url: '', type: 'hls', now_playing: 'Live' },
  { id: 'sctv', name: 'SCTV', category: 'entertainment', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/SCTV_logo_2017.svg/200px-SCTV_logo_2017.svg.png', url: '', type: 'hls', now_playing: 'Live' },
  { id: 'indosiar', name: 'Indosiar', category: 'entertainment', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Indosiar.svg/200px-Indosiar.svg.png', url: '', type: 'hls', now_playing: 'Live' },
  { id: 'mnctv', name: 'MNC TV', category: 'entertainment', logo: '', url: '', type: 'hls', now_playing: 'Live' },
  { id: 'gtv', name: 'GTV', category: 'entertainment', logo: '', url: '', type: 'hls', now_playing: 'Live' },
  { id: 'trans7', name: 'Trans7', category: 'entertainment', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/Trans7_logo.svg/200px-Trans7_logo.svg.png', url: '', type: 'hls', now_playing: 'Live' },
  { id: 'transtv', name: 'Trans TV', category: 'entertainment', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Trans_TV_logo.svg/200px-Trans_TV_logo.svg.png', url: '', type: 'hls', now_playing: 'Live' },
  { id: 'metro', name: 'Metro TV', category: 'news', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Metro_TV_logo.svg/200px-Metro_TV_logo.svg.png', url: '', type: 'hls', now_playing: 'Live' },
  { id: 'tvone', name: 'tvOne', category: 'news', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/TvOne_logo.svg/200px-TvOne_logo.svg.png', url: '', type: 'hls', now_playing: 'Live' },
  { id: 'cnnindonesia', name: 'CNN Indonesia', category: 'news', logo: '', url: '', type: 'hls', now_playing: 'Live' },
  { id: 'kompastv', name: 'Kompas TV', category: 'news', logo: '', url: '', type: 'hls', now_playing: 'Live' },
  { id: 'rkgtv', name: 'RKG TV (Anime)', category: 'anime', logo: '', url: '', type: 'hls', now_playing: 'Anime 24 Jam' },
];

// GET /live/channels
router.get('/channels', (req, res) => {
  const { category } = req.query;
  const channels = category
    ? CHANNELS.filter(c => c.category === category)
    : CHANNELS;
  res.json({ channels });
});

// GET /live/channels/:id
router.get('/channels/:id', (req, res) => {
  const ch = CHANNELS.find(c => c.id === req.params.id);
  if (!ch) return res.status(404).json({ error: 'Channel not found' });
  res.json(ch);
});

module.exports = router;
