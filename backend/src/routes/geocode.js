const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const CACHE_FILE = path.join(__dirname, '..', '..', 'data', 'geocode_cache.json');

const readCache = () => {
  try {
    if (!fs.existsSync(CACHE_FILE)) return {};
    const raw = fs.readFileSync(CACHE_FILE, 'utf8');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
};

const writeCache = (obj) => {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(obj, null, 2));
  } catch (e) {
    // ignore
  }
};

// POST /api/geocode
// body: { locations: string[] }
// returns: { results: { [location]: [lat, lon] | null } }
router.post('/', async (req, res) => {
  try {
    const locations = Array.isArray(req.body.locations) ? req.body.locations : [];
    if (locations.length === 0) return res.json({ results: {} });

    const cache = readCache();
    const toFetch = [];
    const normalizedMap = {};
    locations.forEach(loc => {
      const key = String(loc).trim();
      if (!key) return;
      if (cache[key]) {
        normalizedMap[key] = cache[key];
      } else {
        toFetch.push(key);
      }
    });

    // Limit number of remote requests to 10 per call to be polite
    const limit = Math.min(toFetch.length, 10);
    for (let i = 0; i < limit; i++) {
      const loc = toFetch[i];
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(loc)}`;
        const r = await axios.get(url, { headers: { 'Accept-Language': 'en' }, timeout: 5000 });
        const data = r.data;
          if (Array.isArray(data) && data.length > 0) {
            const top = data[0];
            if (top && top.lat && top.lon) {
              cache[loc] = [parseFloat(top.lat), parseFloat(top.lon)];
              normalizedMap[loc] = cache[loc];
            } else {
              cache[loc] = null;
              normalizedMap[loc] = null;
            }
          } else {
            cache[loc] = null;
            normalizedMap[loc] = null;
          }
        } else {
          cache[loc] = null;
          normalizedMap[loc] = null;
        }
      } catch (e) {
        cache[loc] = null;
        normalizedMap[loc] = null;
      }
      // small delay between requests
      await new Promise(r => setTimeout(r, 600));
    }

    // persist cache
    writeCache(cache);

    res.json({ results: normalizedMap });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
