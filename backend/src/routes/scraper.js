const express = require('express');
const router = express.Router();
const scraperService = require('../services/scraperService');

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
    const edaFile = path.join(scraperOutputDir, `eda_${req.query.username || 'shaswat'}.csv`);

    // Check if file exists
    if (!fs.existsSync(edaFile)) {
      return res.status(404).json({ error: 'EDA file not found for this user' });
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
        });
      })
      .on('error', (error) => {
        res.status(500).json({ error: error.message });
      });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
