const express = require('express');
const router = express.Router();
const scraperService = require('../services/scraperService');
const jwt = require('jsonwebtoken');
const { spawn } = require('child_process');

// Get scraping job status
router.get('/status/:jobId', async (req, res) => {
  try {
    const status = await scraperService.getJobStatus(req.params.jobId);
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get scraping job logs
router.get('/logs/:jobId', async (req, res) => {
  try {
    const logs = await scraperService.getJobLogs(req.params.jobId);
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Middleware to authenticate JWT token (same pattern as auth)
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

// Start a scraper job (runs docker image and writes raw output to scraper_output/<userId>)
router.post('/run', authenticateToken, async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');

    const { fbid, accessToken: accessTokenFromBody } = req.body || {};
    if (!fbid || !/^[0-9]+$/.test(String(fbid))) return res.status(400).json({ error: 'fbid numeric required' });

    // Prefer token from DB (saved during OAuth), fall back to provided token in body
    let accessToken = accessTokenFromBody;
    if (!accessToken) {
      try {
        const User = require('../models/User');
        const user = await User.findById(req.userId).select('facebookAccessToken');
        if (user && user.facebookAccessToken) {
          accessToken = user.facebookAccessToken;
        }
      } catch (e) {
        console.error('Failed to load user token from DB:', e);
      }
    }

    if (!accessToken) return res.status(400).json({ error: 'accessToken required (provide in request or connect via OAuth)' });

    const userId = req.userId;
    const scraperOutputDir = path.join(__dirname, '..', '..', 'scraper_output', String(userId));
    fs.mkdirSync(scraperOutputDir, { recursive: true });

    // Create a persistent Job record and queue it for processing by the worker
    const Job = require('../models/Job');
    const jobId = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    const statusFile = path.join(scraperOutputDir, `scrape.${jobId}.status.json`);
    const startedAt = new Date().toISOString();

    const statusPayload = { jobId, status: 'queued', fbid: String(fbid), queuedAt: startedAt, logs: [] };
    try { fs.writeFileSync(statusFile, JSON.stringify(statusPayload, null, 2)); } catch (e) { console.error('Failed to write status file:', e); }

    const jobDoc = new Job({ jobId, userId, fbid, status: 'queued', outputPath: scraperOutputDir });
    await jobDoc.save();

    // Worker (running in background) will pick up queued jobs and run containers
    return res.status(202).json({ jobId, statusUrl: `/api/scraper/job/${userId}/${jobId}`, message: 'Job queued' });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

// Get job status for a user's job
router.get('/job/:userId/:jobId', authenticateToken, async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const { userId, jobId } = req.params;
    // ensure requester can only read their own jobs
    if (req.userId !== userId) return res.status(403).json({ error: 'Forbidden' });
    // Prefer Job record in DB
    try {
      const Job = require('../models/Job');
      const job = await Job.findOne({ jobId, userId: req.userId }).lean();
      if (job) return res.json({ job });
    } catch (e) {
      console.error('Failed to read job from DB', e.message || e);
    }

    // Fallback to legacy status file
    const statusFile = path.join(__dirname, '..', '..', 'scraper_output', String(userId), `scrape.${jobId}.status.json`);
    if (!fs.existsSync(statusFile)) return res.status(404).json({ error: 'Job not found' });
    const status = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Stop scraping job
router.post('/stop/:jobId', async (req, res) => {
  try {
    const result = await scraperService.stopJob(req.params.jobId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get dashboard statistics from EDA CSV
router.get('/dashboard/stats/:userId', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const csv = require('csv-parser');
    
    const userId = req.params.userId;
    const scraperOutputDir = path.join(__dirname, '..', '..', '..', 'scraper_output', userId);

    if (!fs.existsSync(scraperOutputDir)) {
      return res.status(404).json({ error: 'No scraper output found for this user' });
    }

    // Helper to normalize username (email -> name part, lowercase, alnum/underscore only)
    const normalize = (s) => {
      if (!s) return null;
      let name = String(s).trim();
      if (name.includes('@')) name = name.split('@')[0];
      name = name.toLowerCase().replace(/[^a-z0-9_-]/g, '');
      return name;
    };

    const requestedUsername = normalize(req.query.username);

    // Prefer exact username match if provided
    let edaFile = null;
    if (requestedUsername) {
      const candidate = path.join(scraperOutputDir, `eda_${requestedUsername}.csv`);
      if (fs.existsSync(candidate)) {
        edaFile = candidate;
      }
    }

    // Fallback: prefer cleaned 1_<fbid>.csv, else if raw 0_<fbid>.csv exists, trigger EDA generation
    if (!edaFile) {
      // look for cleaned files first
      const cleanedFiles = fs.readdirSync(scraperOutputDir).filter(f => f.startsWith('1_') && f.endsWith('.csv'));
      if (cleanedFiles.length > 0) {
        cleanedFiles.sort((a, b) => {
          const sa = fs.statSync(path.join(scraperOutputDir, a)).mtime.getTime();
          const sb = fs.statSync(path.join(scraperOutputDir, b)).mtime.getTime();
          return sb - sa;
        });
        edaFile = path.join(scraperOutputDir, cleanedFiles[0]);
      } else {
        // if no cleaned file, see if raw scraped 0_<fbid>.csv exists and trigger generator
        const rawFiles = fs.readdirSync(scraperOutputDir).filter(f => f.startsWith('0_') && f.endsWith('.csv'));
        if (rawFiles.length > 0) {
          rawFiles.sort((a, b) => {
            const sa = fs.statSync(path.join(scraperOutputDir, a)).mtime.getTime();
            const sb = fs.statSync(path.join(scraperOutputDir, b)).mtime.getTime();
            return sb - sa;
          });
          const chosenRaw = rawFiles[0];
          const fbidMatch = chosenRaw.match(/^0_(\d+)\.csv$/);
          const fbid = fbidMatch ? fbidMatch[1] : null;

          const statusFile = path.join(scraperOutputDir, 'eda.status.json');
          const outputName = fbid ? `1_${fbid}.csv` : `1_${Date.now()}.csv`;
          const outputPath = path.join(scraperOutputDir, outputName);

          // if already processing same input -> return 202
          try {
            if (fs.existsSync(statusFile)) {
              const status = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
              if (status && status.status === 'processing' && status.input === chosenRaw) {
                return res.status(202).json({ status: 'processing', message: 'EDA generation in progress' });
              }
            }
          } catch (e) {
            console.error('Failed reading status file', e);
          }

          // write processing status and spawn generator
          const statusPayload = { status: 'processing', input: chosenRaw, output: outputName, startedAt: new Date().toISOString() };
          try { fs.writeFileSync(statusFile, JSON.stringify(statusPayload, null, 2)); } catch (e) { console.error('Failed to write status file:', e); }

          const pythonCmd = process.env.PYTHON_PATH || 'python3';
          const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'generate_eda.py');
          try {
            const child = require('child_process').spawn(pythonCmd, [scriptPath, '--input', path.join(scraperOutputDir, chosenRaw), '--output', outputPath], { detached: false });
            child.stdout.on('data', (d) => console.log('[generate_eda]', d.toString()));
            child.stderr.on('data', (d) => console.error('[generate_eda]', d.toString()));
            child.on('close', (code) => {
              try {
                if (code === 0 && fs.existsSync(outputPath)) {
                  fs.writeFileSync(statusFile, JSON.stringify({ status: 'done', input: chosenRaw, output: outputName, finishedAt: new Date().toISOString() }, null, 2));
                } else {
                  fs.writeFileSync(statusFile, JSON.stringify({ status: 'failed', input: chosenRaw, output: outputName, finishedAt: new Date().toISOString(), code }, null, 2));
                }
              } catch (e) { console.error('Failed to update status file on child close:', e); }
            });
          } catch (e) {
            console.error('Failed to spawn EDA generator:', e);
            try { fs.writeFileSync(statusFile, JSON.stringify({ status: 'failed', input: chosenRaw, output: outputName, message: String(e), finishedAt: new Date().toISOString() }, null, 2)); } catch (ee) { }
          }

          return res.status(202).json({ status: 'processing', message: 'EDA generation started' });
        }

        // fall back to legacy eda_*.csv files
        const files = fs.readdirSync(scraperOutputDir).filter(f => f.startsWith('eda_') && f.endsWith('.csv'));
        if (files.length === 0) {
          return res.status(404).json({ error: 'EDA file not found for this user' });
        }
        files.sort((a, b) => {
          const sa = fs.statSync(path.join(scraperOutputDir, a)).mtime.getTime();
          const sb = fs.statSync(path.join(scraperOutputDir, b)).mtime.getTime();
          return sb - sa;
        });
        edaFile = path.join(scraperOutputDir, files[0]);
      }
    }

    const posts = [];
    const engagers = {};
    const locations = {};
    const monthlyPosts = {};
    const yearlyPosts = {};

    // Parse CSV
    fs.createReadStream(edaFile)
      .pipe(csv())
      .on('data', (row) => {
        posts.push(row);
        
        // Parse dates for monthly/yearly breakdown
        if (row.post_date && row.post_date.trim()) {
          try {
            const dateStr = row.post_date.trim();
            const dateParts = dateStr.split(' ');
            
            if (dateParts.length >= 3) {
              const month = dateParts[1];
              const year = dateParts[2];
              
              // Track yearly
              yearlyPosts[year] = (yearlyPosts[year] || 0) + 1;
              
              // Track monthly
              const monthKey = `${month} ${year}`;
              monthlyPosts[monthKey] = (monthlyPosts[monthKey] || 0) + 1;
            }
          } catch (e) {
            // Skip invalid dates
          }
        }
        
        // Parse locations
        if (row.post_location && row.post_location.trim()) {
          const location = row.post_location.trim();
          locations[location] = (locations[location] || 0) + 1;
        }
        
        // Parse engagers (commenters and likers)
        if (row.who_commented && row.who_commented.trim()) {
          const commenters = row.who_commented.split(',');
          commenters.forEach(person => {
            const name = person.trim();
            if (name) {
              engagers[name] = (engagers[name] || 0) + 1;
            }
          });
        }
        
        if (row.who_liked && row.who_liked.trim()) {
          const likers = row.who_liked.split(',');
          likers.forEach(person => {
            const name = person.trim();
            if (name) {
              engagers[name] = (engagers[name] || 0) + 1;
            }
          });
        }
      })
      .on('end', () => {
        // Calculate statistics
        const totalPosts = posts.length;
        const totalLocations = Object.keys(locations).length;
        
        // Get top engagers
        const topEngagers = Object.entries(engagers)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([name, count]) => ({ name, count }));
        
        // Get top 4 locations for heatmap
        const topLocations = Object.entries(locations)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([name, count]) => ({ name, count }));
        
        // Get all locations for statistics dialog
        const allLocations = Object.entries(locations).map(([name, count]) => ({
          name,
          count
        }));

        // Get monthly breakdown
        const monthlyData = Object.entries(monthlyPosts).map(([month, count]) => ({
          month,
          count
        }));

        // Get yearly breakdown
        const yearlyData = Object.entries(yearlyPosts)
          .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
          .map(([year, count]) => ({
            year: parseInt(year),
            count
          }));
        
        res.json({
          statistics: {
            totalPosts,
            totalLocations,
            locations: allLocations,
            monthlyData,
            yearlyData
          },
          engagement: {
            topEngagers
          },
          heatmap: {
            topLocations
          }
        ,
            usedFile: path.basename(edaFile)
          });
      })
      .on('error', (error) => {
        res.status(500).json({ error: error.message });
      });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// EDA generation status endpoint
router.get('/eda-status/:userId', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const userId = req.params.userId;
    const scraperOutputDir = path.join(__dirname, '..', '..', '..', 'scraper_output', userId);
    const statusFile = path.join(scraperOutputDir, 'eda.status.json');
    if (!fs.existsSync(scraperOutputDir) || !fs.existsSync(statusFile)) {
      return res.status(404).json({ status: 'not-found' });
    }
    const status = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
