const NodeCache = require('node-cache');

// TTL in seconds
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

module.exports = {
  get: (key) => cache.get(key),
  set: (key, value, ttl) => cache.set(key, value, ttl),
  del: (key) => cache.del(key),
  // Named TTLs
  TTL: {
    SHORT: 60,       // 1 min — sources/streams
    MEDIUM: 300,     // 5 min — episode lists
    LONG: 3600,      // 1 hour — anime info
    DAY: 86400,      // 1 day — static data
  }
};
