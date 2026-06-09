const cache = require('../utils/cache');
const gogo = require('./gogoanime');
const allanime = require('./allanime');

const _map = new Map();

async function getGogoId(anilistId, title, titleAlt) {
  const key = `map_gogo_${anilistId}`;
  if (_map.has(key)) return _map.get(key);
  const cached = cache.get(key);
  if (cached !== undefined) { _map.set(key, cached); return cached; }
  const id = await gogo.findGogoId(title, titleAlt).catch(() => null);
  _map.set(key, id);
  cache.set(key, id, cache.TTL.DAY);
  return id;
}

async function getAllAnimeId(anilistId, title, titleAlt) {
  const key = `map_alla_${anilistId}`;
  if (_map.has(key)) return _map.get(key);
  const cached = cache.get(key);
  if (cached !== undefined) { _map.set(key, cached); return cached; }
  const id = await allanime.findShowId(title, titleAlt).catch(() => null);
  _map.set(key, id);
  cache.set(key, id, cache.TTL.DAY);
  return id;
}

module.exports = { getGogoId, getAllAnimeId };
