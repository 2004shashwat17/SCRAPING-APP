const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const jwt = require('jsonwebtoken');

// Middleware to authenticate JWT token (same pattern as other routes)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.userId = decoded.userId;
    next();
  });
};

// List EDA files for a user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const baseDir = path.join(__dirname, '..', '..', 'scraper_output', String(userId));
    if (!fs.existsSync(baseDir)) return res.json({ files: [] });
    const files = fs.readdirSync(baseDir).filter(f => f.endsWith('.csv'));
    const result = files.map(f => {
      const stat = fs.statSync(path.join(baseDir, f));
      return { filename: f, size: stat.size, mtime: stat.mtime };
    });
    res.json({ files: result });
  } catch (err) {
    console.error('Error listing EDA files:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get summary stats for a single CSV file
router.get('/file', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { filename } = req.query;
    if (!filename) return res.status(400).json({ message: 'filename query param required' });
    const filePath = path.join(__dirname, '..', '..', 'scraper_output', String(userId), String(filename));
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'File not found' });

    // Parse CSV and compute simple stats
    const stats = {
      totalPosts: 0,
      locations: {},
      monthly: {},
      users: {},
    };

    const dateCols = ['created_time','created_at','date','post_date','timestamp'];
    const locCols = ['post_location','location','place','city'];
    const userCols = ['username','user','author','screen_name'];

    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          stats.totalPosts += 1;
          // location
          let loc = null;
          for (const c of locCols) if (!loc && row[c]) loc = row[c];
          if (loc) {
            const key = String(loc).trim();
            stats.locations[key] = (stats.locations[key] || 0) + 1;
          }
          // date -> month-year
          let dateVal = null;
          for (const c of dateCols) if (!dateVal && row[c]) dateVal = row[c];
          if (dateVal) {
            const d = new Date(dateVal);
            if (!isNaN(d.getTime())) {
              const monthYear = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
              stats.monthly[monthYear] = (stats.monthly[monthYear] || 0) + 1;
            }
          }
          // user
          let u = null;
          for (const c of userCols) if (!u && row[c]) u = row[c];
          if (u) {
            stats.users[u] = (stats.users[u] || 0) + 1;
          }
        })
        .on('end', () => resolve())
        .on('error', (err) => reject(err));
    });

    // Build response structure similar to frontend expectations
    const locationsArr = Object.keys(stats.locations).map(k => ({ name: k, count: stats.locations[k] })).sort((a,b)=>b.count-a.count);
    const monthlyArr = Object.keys(stats.monthly).map(k => ({ month: k, count: stats.monthly[k] })).sort((a,b)=> new Date(b.month) - new Date(a.month));
    const userArr = Object.keys(stats.users).map(k => ({ username: k, count: stats.users[k] })).sort((a,b)=>b.count-a.count);

    res.json({
      statistics: {
        totalPosts: stats.totalPosts,
        totalLocations: Object.keys(stats.locations).length,
        locations: locationsArr,
        monthlyData: monthlyArr,
      },
      engagement: {
        topEngagers: userArr.slice(0,5),
      },
      posts: [],
    });
  } catch (err) {
    console.error('Error reading EDA file:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
