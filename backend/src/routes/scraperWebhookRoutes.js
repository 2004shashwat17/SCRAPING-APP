/**
 * Scraper Webhook Routes
 * Handles callbacks from playwright-fbscraping worker.py
 * Triggers ML analysis after scraping completes
 */

const express = require('express');
const axios = require('axios');
const router = express.Router();

const ML_API_URL = process.env.ML_API_URL || 'http://localhost:8000';

/**
 * Webhook endpoint - Called by worker.py after scraping completes
 * POST /api/scraping/complete
 */
router.post('/api/scraping/complete', async (req, res) => {
  try {
    const { job_id, user_id, csv_url, friends_url, status } = req.body;
    
    console.log('📡 Scraping webhook received:');
    console.log(`   Job ID: ${job_id}`);
    console.log(`   User: ${user_id}`);
    console.log(`   CSV: ${csv_url}`);
    console.log(`   Friends: ${friends_url}`);
    console.log(`   Status: ${status}`);
    
    if (!user_id || !csv_url) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: user_id or csv_url'
      });
    }
    
    // Trigger ML analysis
    console.log(`🤖 Triggering ML analysis for user: ${user_id}`);
    
    const mlResponse = await axios.post(
      `${ML_API_URL}/analyze`,
      {
        user_id: user_id,
        csv_url: csv_url,
        priority: 5
      },
      {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    const mlJob = mlResponse.data;
    console.log(`✅ ML analysis queued: ${mlJob.job_id}`);
    
    // TODO: Update user record in your database
    // Example:
    // await User.findOneAndUpdate(
    //   { fbUserId: user_id },
    //   { 
    //     mlJobId: mlJob.job_id,
    //     mlStatus: 'queued',
    //     scrapingCompletedAt: new Date(),
    //     csvUrl: csv_url,
    //     friendsUrl: friends_url
    //   }
    // );
    
    res.json({
      success: true,
      jobId: mlJob.job_id,
      status: mlJob.status,
      message: 'ML analysis queued successfully'
    });
    
  } catch (error) {
    console.error('❌ Webhook error:', error.message);
    
    // Check if ML API is down
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        success: false,
        error: 'ML API service unavailable',
        details: error.message
      });
    }
    
    // Check if ML API returned an error
    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        error: 'ML API error',
        details: error.response.data
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * Get ML analysis status
 * GET /api/analysis/status/:userId
 */
router.get('/api/analysis/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // TODO: Get job ID from your database
    // const user = await User.findOne({ fbUserId: userId });
    // const jobId = user?.mlJobId;
    
    // For now, try to get from ML API directly
    const statusResponse = await axios.get(
      `${ML_API_URL}/results/${userId}`,
      { timeout: 5000 }
    );
    
    res.json({
      success: true,
      status: 'completed',
      data: statusResponse.data
    });
    
  } catch (error) {
    if (error.response?.status === 404) {
      res.json({
        success: true,
        status: 'not_found',
        message: 'Analysis not completed yet'
      });
    } else {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
});

/**
 * Get ML analysis results
 * GET /api/analysis/results/:userId
 */
router.get('/api/analysis/results/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const resultsResponse = await axios.get(
      `${ML_API_URL}/results/${userId}`,
      { timeout: 5000 }
    );
    
    res.json({
      success: true,
      data: resultsResponse.data
    });
    
  } catch (error) {
    if (error.response?.status === 404) {
      res.status(404).json({
        success: false,
        error: 'Analysis results not found'
      });
    } else {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
});

/**
 * Dashboard polling endpoint
 * GET /api/analysis/poll/:userId
 * Returns real-time status for dashboard
 */
router.get('/api/analysis/poll/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Try to get results from ML API
    try {
      const resultsResponse = await axios.get(
        `${ML_API_URL}/results/${userId}`,
        { timeout: 3000 }
      );
      
      return res.json({
        status: 'completed',
        ready: true,
        data: resultsResponse.data
      });
      
    } catch (error) {
      // Results not ready yet
      if (error.response?.status === 404) {
        // TODO: Check scraping status from your database
        // const user = await User.findOne({ fbUserId: userId });
        
        return res.json({
          status: 'processing',
          ready: false,
          message: 'Analysis in progress...'
        });
      }
      
      throw error;
    }
    
  } catch (error) {
    res.status(500).json({
      status: 'error',
      ready: false,
      error: error.message
    });
  }
});

/**
 * Health check for ML API
 * GET /api/ml/health
 */
router.get('/api/ml/health', async (req, res) => {
  try {
    const healthResponse = await axios.get(
      `${ML_API_URL}/health`,
      { timeout: 5000 }
    );
    
    res.json({
      success: true,
      ml_api: healthResponse.data
    });
    
  } catch (error) {
    res.status(503).json({
      success: false,
      ml_api: 'unavailable',
      error: error.message
    });
  }
});

module.exports = router;
