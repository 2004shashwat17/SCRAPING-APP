const axios = require('axios');

/**
 * Service to trigger scraping via webhook (for testing with local Docker)
 * In production, this would run Docker containers directly on the server
 */
class ScraperWebhookService {
  constructor() {
    // Get webhook URL from environment variable
    // For testing: set this to your ngrok URL
    this.webhookUrl = process.env.SCRAPER_WEBHOOK_URL || 'http://localhost:3001/webhook';
    this.activeJobs = new Map();
  }

  /**
   * Start Facebook scraper via webhook
   * @param {Object} user - User object with Facebook access token
   * @returns {Promise<Object>} Job status
   */
  async startScraping(user) {
    console.log(`[ScraperWebhook] Triggering scraper for user ${user.username}`);
    console.log(`[ScraperWebhook] Webhook URL: ${this.webhookUrl}`);

    try {
      const response = await axios.post(`${this.webhookUrl}/start-scraping`, {
        userId: user._id.toString(),
        accessToken: user.facebookAccessToken,
        username: user.username
      }, {
        timeout: 5000 // 5 second timeout
      });

      const jobId = response.data.jobId;
      
      this.activeJobs.set(jobId, {
        userId: user._id,
        username: user.username,
        startedAt: new Date(),
        status: 'running'
      });

      console.log(`[ScraperWebhook] Job started: ${jobId}`);
      
      return {
        jobId,
        status: 'running',
        message: 'Scraping started successfully',
        ...response.data
      };
    } catch (error) {
      console.error(`[ScraperWebhook] Error: ${error.message}`);
      
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Webhook server is not accessible. Make sure ngrok is running and SCRAPER_WEBHOOK_URL is set correctly.');
      }
      
      throw error;
    }
  }

  /**
   * Check status of scraping job
   * @param {string} jobId - Job ID
   * @returns {Promise<Object>} Job status
   */
  async getJobStatus(jobId) {
    try {
      const response = await axios.get(`${this.webhookUrl}/status/${jobId}`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return { status: 'not_found', message: 'Job not found' };
      }
      throw error;
    }
  }

  /**
   * Get logs from scraping job
   * @param {string} jobId - Job ID
   * @returns {Promise<string>} Container logs
   */
  async getJobLogs(jobId) {
    try {
      const response = await axios.get(`${this.webhookUrl}/logs/${jobId}`);
      return response.data.logs;
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error('Job not found');
      }
      throw error;
    }
  }

  /**
   * Stop scraping job
   * @param {string} jobId - Job ID
   * @returns {Promise<Object>} Result
   */
  async stopJob(jobId) {
    try {
      const response = await axios.post(`${this.webhookUrl}/stop/${jobId}`);
      this.activeJobs.delete(jobId);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return { status: 'not_found', message: 'Job not found' };
      }
      throw error;
    }
  }

  /**
   * Check if webhook server is healthy
   * @returns {Promise<boolean>}
   */
  async checkHealth() {
    try {
      const response = await axios.get(`${this.webhookUrl}/health`, { timeout: 3000 });
      return response.data.status === 'ok';
    } catch (error) {
      return false;
    }
  }
}

module.exports = new ScraperWebhookService();
