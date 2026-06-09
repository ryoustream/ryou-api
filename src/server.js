const express = require('express');
const app = express();

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());

// Routes
app.use('/anime', require('./routes/anime'));
app.use('/episode', require('./routes/episode'));
app.use('/live', require('./routes/live'));
app.use('/test', require('./routes/test'));

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Ryou API',
    version: '1.1.0',
    endpoints: [
      'GET /anime/search?q=',
      'GET /anime/trending',
      'GET /anime/popular',
      'GET /anime/recent',
      'GET /anime/featured',
      'GET /anime/info/:id',
      'GET /episode/sources/:id?ep=',
      'GET /episode/list/:id',
      'GET /live/channels',
      'GET /test/allanime?q=',
      'GET /test/sources?id=&ep=',
      'GET /test/ping?url=',
    ]
  });
});

app.use((err, req, res, next) => {
  console.error('[API Error]', err.message);
  res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Ryou API v1.1.0 :${PORT}`));

module.exports = app;
