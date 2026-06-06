const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

// Routes
app.use('/anime', require('./routes/anime'));
app.use('/episode', require('./routes/episode'));
app.use('/live', require('./routes/live'));

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Ryou API',
    version: '1.0.0',
    endpoints: [
      'GET /anime/search?q=',
      'GET /anime/trending',
      'GET /anime/popular',
      'GET /anime/recent',
      'GET /anime/info/:id',
      'GET /episode/sources/:id',
      'GET /live/channels',
    ]
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Ryou API running on port ${PORT}`));
