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

module.exports = router;
