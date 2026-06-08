const cache = require('../utils/cache');
const gogo = require('./gogoanime');

const _map = new Map();

async function getGogoId(anilistId, title, titleAlt) {
  const key = `map_${anilistId}`;
  if (_map.has(key)) return _map.get(key);
  const cached = cache.get(key);
  if (cached !== undefined) { _map.set(key, cached); return cached; }

  const gogoId = await gogo.findGogoId(title, titleAlt).catch(() => null);

  // Cache even null to avoid re-search
  _map.set(key, gogoId);
  cache.set(key, gogoId, cache.TTL.DAY);
  return gogoId;
}

module.exports = { getGogoId };
