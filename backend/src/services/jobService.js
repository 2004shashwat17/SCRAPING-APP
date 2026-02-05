const redis = require('../utils/redisClient');
const { v4: uuidv4 } = require('uuid');

/**
 * Push a scraping job to Redis queue
 * Backend only pushes jobs - does NOT run scraping
 */
async function pushScrapeJob(jobData) {
  const jobId = uuidv4();
  
  const job = {
    job_id: jobId,
    cookie_file: jobData.cookieFile,
    user_id: jobData.userId,
    username: jobData.username,
    created_at: new Date().toISOString(),
    status: 'pending',
    ...jobData
  };

  try {
    // Push job to Redis queue
    await redis.lPush('scrape_queue', JSON.stringify(job));
    console.log(`✅ Job ${jobId} pushed to Redis queue`);
    
    return {
      success: true,
      job_id: jobId,
      message: 'Job queued successfully'
    };
  } catch (error) {
    console.error('Failed to push job to Redis:', error);
    throw new Error(`Failed to queue job: ${error.message}`);
  }
}

/**
 * Get job status from Redis
 */
async function getJobStatus(jobId) {
  try {
    const statusKey = `job:${jobId}:status`;
    const status = await redis.get(statusKey);
    return status ? JSON.parse(status) : null;
  } catch (error) {
    console.error('Failed to get job status:', error);
    return null;
  }
}

/**
 * Check Redis connection health
 */
async function checkRedisHealth() {
  try {
    await redis.ping();
    return { connected: true, message: 'Redis is healthy' };
  } catch (error) {
    return { connected: false, message: error.message };
  }
}

module.exports = {
  pushScrapeJob,
  getJobStatus,
  checkRedisHealth
};
